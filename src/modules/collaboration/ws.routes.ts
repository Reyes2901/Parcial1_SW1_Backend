import { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as decoding from 'lib0/decoding';

const AWARENESS_MSG_TYPE = 3;
const DIAGRAM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_PAYLOAD_BYTES = 1_048_576; // 1 MiB

type RoomAwarenessState = { doc: Y.Doc; awareness: Awareness };

interface ExtendedWebSocket extends WebSocket {
  diagramId?: string;
  isAlive?: boolean;
}

const rooms = new Map<string, Set<ExtendedWebSocket>>();
const roomAwarenessStates = new Map<string, RoomAwarenessState>();
const awarenessClientIdsBySocket = new WeakMap<ExtendedWebSocket, Set<number>>();

function getOrCreateAwarenessState(diagramId: string): RoomAwarenessState {
  const existing = roomAwarenessStates.get(diagramId);
  if (existing) return existing;
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const state: RoomAwarenessState = { doc, awareness };
  roomAwarenessStates.set(diagramId, state);
  return state;
}

function decodeAwarenessUpdateClients(update: Uint8Array): { present: number[]; removed: number[] } {
  const present: number[] = [];
  const removed: number[] = [];
  try {
    const decoder = decoding.createDecoder(update);
    const len = decoding.readVarUint(decoder);
    for (let i = 0; i < len; i++) {
      const clientId = decoding.readVarUint(decoder);
      decoding.readVarUint(decoder);
      const state = JSON.parse(decoding.readVarString(decoder));
      if (state === null) removed.push(clientId);
      else present.push(clientId);
    }
  } catch {
    // best-effort
  }
  return { present, removed };
}

function broadcastAwarenessRemoval(
  diagramId: string,
  disconnectedSocket: ExtendedWebSocket,
  removedClientIds: number[],
): void {
  if (removedClientIds.length === 0) return;
  const roomState = roomAwarenessStates.get(diagramId);
  if (!roomState) return;

  const known = removedClientIds.filter((id) => roomState.awareness.meta.has(id));
  if (known.length === 0) return;

  removeAwarenessStates(roomState.awareness, known, disconnectedSocket);
  const awarenessUpdate = encodeAwarenessUpdate(roomState.awareness, known);

  const framedUpdate = new Uint8Array(1 + awarenessUpdate.length);
  framedUpdate[0] = AWARENESS_MSG_TYPE;
  framedUpdate.set(awarenessUpdate, 1);

  const payload = JSON.stringify({
    diagramData: Buffer.from(framedUpdate).toString('base64'),
  });

  const room = rooms.get(diagramId);
  if (!room) return;
  for (const client of room) {
    if (client === disconnectedSocket) continue;
    if (client.readyState !== 1) continue;
    try {
      client.send(payload);
    } catch {
      // ignore
    }
  }
}

function broadcast(
  diagramId: string,
  message: string,
  exclude: ExtendedWebSocket | null,
): void {
  const room = rooms.get(diagramId);
  if (!room) return;
  for (const client of room) {
    if (client === exclude) continue;
    if (client.readyState !== 1) continue;
    try {
      client.send(message);
    } catch {
      // ignore
    }
  }
}

export async function collaborationWsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/ws/diagrams/:diagramId',
    { websocket: true },
    (connection, request) => {
      const socket: ExtendedWebSocket =
        (connection as unknown as { socket: ExtendedWebSocket }).socket || connection;
      const { diagramId } = request.params as { diagramId: string };

      if (!diagramId || !DIAGRAM_ID_RE.test(diagramId)) {
        socket.close(1008, 'Invalid diagramId');
        return;
      }

      socket.diagramId = diagramId;
      socket.isAlive = true;
      socket.on('pong', () => {
        socket.isAlive = true;
      });

      let room = rooms.get(diagramId);
      if (!room) {
        room = new Set();
        rooms.set(diagramId, room);
      }
      room.add(socket);
      awarenessClientIdsBySocket.set(socket, new Set());
      getOrCreateAwarenessState(diagramId);

      console.log(`[ws] user joined diagram ${diagramId} (total: ${room.size})`);

      if (room.size > 1) {
        for (const client of room) {
          if (client !== socket && client.readyState === 1) {
            client.send(JSON.stringify({ type: 'send-full-state-to-peer' }));
          }
        }
      }

      socket.on('message', (raw: Buffer | string) => {
        const message = typeof raw === 'string' ? raw : raw.toString('utf-8');
        if (message.length > MAX_PAYLOAD_BYTES) return;

        try {
          const parsed = JSON.parse(message) as Record<string, unknown>;

          if (parsed.type === 'request-full-state') {
            for (const client of room!) {
              if (client !== socket && client.readyState === 1) {
                client.send(JSON.stringify({ type: 'send-full-state-to-peer' }));
              }
            }
            return;
          }

          if (typeof parsed.diagramData === 'string') {
            const roomState = roomAwarenessStates.get(diagramId);
            if (roomState) {
              const decoded = Buffer.from(parsed.diagramData, 'base64');
              if (decoded.length > 0 && decoded[0] === AWARENESS_MSG_TYPE) {
                const awarenessUpdate = new Uint8Array(decoded.subarray(1));
                applyAwarenessUpdate(roomState.awareness, awarenessUpdate, socket);
                const { present, removed } = decodeAwarenessUpdateClients(awarenessUpdate);
                const socketIds = awarenessClientIdsBySocket.get(socket);
                if (socketIds) {
                  for (const id of present) socketIds.add(id);
                  for (const id of removed) socketIds.delete(id);
                }
              }
            }
            broadcast(diagramId, message, socket);
            return;
          }

          // JSON desconocido: ignorar
        } catch {
          // No es JSON: mensaje Yjs puro en base64 → envolver
          const wrapped = JSON.stringify({ diagramData: message });
          broadcast(diagramId, wrapped, socket);
        }
      });

      socket.on('close', () => {
        const r = rooms.get(diagramId);
        if (r) {
          r.delete(socket);
          const socketIds = awarenessClientIdsBySocket.get(socket);
          if (socketIds && socketIds.size > 0) {
            broadcastAwarenessRemoval(diagramId, socket, Array.from(socketIds));
          }
          console.log(`[ws] user left diagram ${diagramId} (total: ${r.size})`);
          if (r.size === 0) {
            rooms.delete(diagramId);
            const roomState = roomAwarenessStates.get(diagramId);
            if (roomState) {
              roomState.awareness.destroy();
              roomState.doc.destroy();
              roomAwarenessStates.delete(diagramId);
            }
          }
        }
      });

      socket.on('error', (err: Error) => {
        console.error(`[ws] client error in diagram ${diagramId}:`, err.message);
      });
    },
  );

  const heartbeatInterval = setInterval(() => {
    for (const room of rooms.values()) {
      for (const client of room) {
        if (client.isAlive === false) {
          client.terminate();
          continue;
        }
        client.isAlive = false;
        try {
          client.ping();
        } catch {
          client.terminate();
        }
      }
    }
  }, 30_000);

  fastify.addHook('onClose', async () => {
    clearInterval(heartbeatInterval);
    for (const room of rooms.values()) {
      for (const client of room) {
        try {
          client.close();
        } catch {
          // ignore
        }
      }
    }
    rooms.clear();
    for (const state of roomAwarenessStates.values()) {
      state.awareness.destroy();
      state.doc.destroy();
    }
    roomAwarenessStates.clear();
  });
}
