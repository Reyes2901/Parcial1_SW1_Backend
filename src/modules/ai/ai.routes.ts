// modules/ai/ai.routes.ts
// POST /diagrams/:id/ai/command      — AI command by text
// POST /diagrams/:id/ai/from-image   — AI command by image (base64)
// POST /diagrams/:id/ai/from-audio   — AI command by audio (base64, transcribed)
// POST /diagrams/:id/ai/undo         — Undo last AI operation

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { requireProjectRole } from '../../shared/role-guard';
import { prisma } from '../../shared/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { validateCommands } from '../../domain/validator';
import { applyCommands } from '../../domain/applier';
import type { UMLModel } from '../../domain/uml-model';
import type { UMLCommand } from '../../domain/uml-command';
import { geminiClient } from './gemini.client';
import { DESTRUCTIVE_OPERATIONS } from './tools';
import type { Prisma } from '@prisma/client';

interface ProcessedResult {
  commands: UMLCommand[];
  message: string;
  requiresConfirmation: boolean;
  pendingConfirmation: UMLCommand[];
  autoApplied: UMLCommand[];
}

function splitCommands(rawCommands: UMLCommand[], message: string): ProcessedResult {
  const autoApplied = rawCommands.filter((c) => !DESTRUCTIVE_OPERATIONS.has(c.type));
  const pendingConfirmation = rawCommands.filter((c) => DESTRUCTIVE_OPERATIONS.has(c.type));
  return {
    commands: rawCommands,
    message,
    requiresConfirmation: pendingConfirmation.length > 0,
    pendingConfirmation,
    autoApplied,
  };
}

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  // -------- Shared helper: apply result, persist audit, return response --------
  async function persistAndRespond(
    diagramId: string,
    userId: string,
    currentModel: UMLModel,
    result: ProcessedResult,
    userMessageText: string,
    agentType: 'text' | 'image' | 'voice',
  ) {
    let conversation = await prisma.aiConversation.findFirst({
      where: { diagramId, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.aiConversation.create({
        data: { diagramId, userId, agentType },
      });
    }

    await prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: userMessageText },
    });

    const assistantMsg = await prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: 'assistant', content: result.message },
    });

    const validation = validateCommands(currentModel, result.autoApplied);
    if (!validation.valid) {
      throw new ValidationError('AI generated invalid commands', validation.errors);
    }

    const modelAfterSafe = applyCommands(currentModel, result.autoApplied);

    const operation = await prisma.aiOperation.create({
      data: {
        diagramId,
        messageId: assistantMsg.id,
        commands: result.commands as unknown as Prisma.InputJsonValue,
        modelBefore: currentModel as unknown as Prisma.InputJsonValue,
        modelAfter: modelAfterSafe as unknown as Prisma.InputJsonValue,
        applied: !result.requiresConfirmation,
      },
    });

    await prisma.diagram.update({
      where: { id: diagramId },
      data: {
        umlModel: modelAfterSafe as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });

    return {
      model: modelAfterSafe,
      message: result.message,
      requiresConfirmation: result.requiresConfirmation,
      pendingConfirmation: result.pendingConfirmation,
      operationId: operation.id,
    };
  }

  // -------- Guard: GEMINI_API_KEY must be configured --------
  function ensureConfigured(reply: any): boolean {
    if (!process.env.GEMINI_API_KEY) {
      reply.status(503).send({
        error: 'El proveedor de IA no está configurado. Contacta al administrador.',
        code: 'AI_NOT_CONFIGURED',
      });
      return false;
    }
    return true;
  }

  // -------- POST /diagrams/:id/ai/command — text --------
  fastify.post(
    '/diagrams/:id/ai/command',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { message: string; operationId?: string };

      if (!body.message && !body.operationId) {
        throw new ValidationError('Either "message" or "operationId" (to confirm) is required');
      }

      const diagram = await prisma.diagram.findUnique({ where: { id } });
      if (!diagram) throw new NotFoundError('Diagram', id);

      const currentModel = diagram.umlModel as unknown as UMLModel;

      // Confirmation flow (unchanged)
      if (body.operationId) {
        const operation = await prisma.aiOperation.findUnique({ where: { id: body.operationId } });
        if (!operation) throw new NotFoundError('AiOperation', body.operationId);
        if (operation.applied) throw new ValidationError('Operation already applied');

        const commands = operation.commands as unknown as UMLCommand[];
        const destructiveCommands = commands.filter((c) => DESTRUCTIVE_OPERATIONS.has(c.type));

        const validation = validateCommands(currentModel, destructiveCommands);
        if (!validation.valid) {
          throw new ValidationError('Validation failed for confirmed commands', validation.errors);
        }

        const newModel = applyCommands(currentModel, destructiveCommands);

        await prisma.$transaction([
          prisma.diagram.update({
            where: { id },
            data: {
              umlModel: newModel as unknown as Prisma.InputJsonValue,
              version: { increment: 1 },
            },
          }),
          prisma.aiOperation.update({
            where: { id: body.operationId },
            data: { applied: true, modelAfter: newModel as unknown as Prisma.InputJsonValue },
          }),
        ]);

        return reply.send({
          model: newModel,
          message: 'Destructive operations applied after confirmation',
          requiresConfirmation: false,
        });
      }

      if (!ensureConfigured(reply)) return;

      const userId = request.currentUser!.userId;

      const raw = await geminiClient.modifyFromText(currentModel, body.message);
      const result = splitCommands(raw.commands, raw.message);

      const response = await persistAndRespond(id, userId, currentModel, result, body.message, 'text');
      return reply.send(response);
    }
  );

  // -------- POST /diagrams/:id/ai/from-image — image (base64) --------
  fastify.post(
    '/diagrams/:id/ai/from-image',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { image: string; mimeType: string; message?: string };

      if (!body.image || !body.mimeType) {
        throw new ValidationError('Fields "image" (base64) and "mimeType" are required');
      }
      if (!ensureConfigured(reply)) return;

      const diagram = await prisma.diagram.findUnique({ where: { id } });
      if (!diagram) throw new NotFoundError('Diagram', id);

      const currentModel = diagram.umlModel as unknown as UMLModel;
      const userId = request.currentUser!.userId;
      const userText = body.message || '[Imagen] Generar/modificar diagrama desde imagen';

      const raw = await geminiClient.modifyFromImage(
        currentModel,
        body.image,
        body.mimeType,
        body.message || 'Genera o modifica el diagrama UML basándote en esta imagen.',
      );
      const result = splitCommands(raw.commands, raw.message);

      const response = await persistAndRespond(id, userId, currentModel, result, userText, 'image');
      return reply.send(response);
    }
  );

  // -------- POST /diagrams/:id/ai/from-audio — audio (base64 → transcribe → text) --------
  fastify.post(
    '/diagrams/:id/ai/from-audio',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { audio: string; mimeType: string };

      if (!body.audio || !body.mimeType) {
        throw new ValidationError('Fields "audio" (base64) and "mimeType" are required');
      }
      if (!ensureConfigured(reply)) return;

      const diagram = await prisma.diagram.findUnique({ where: { id } });
      if (!diagram) throw new NotFoundError('Diagram', id);

      const currentModel = diagram.umlModel as unknown as UMLModel;
      const userId = request.currentUser!.userId;

      // 1. Transcribe
      const transcription = await geminiClient.transcribeAudio(body.audio, body.mimeType);
      if (!transcription) {
        throw new ValidationError('No se pudo transcribir el audio');
      }

      // 2. Reuse text flow
      const raw = await geminiClient.modifyFromText(currentModel, transcription);
      const result = splitCommands(raw.commands, raw.message);

      const response = await persistAndRespond(
        id,
        userId,
        currentModel,
        result,
        `[Audio] "${transcription}"`,
        'voice',
      );
      return reply.send({ ...response, transcription });
    }
  );

  // -------- POST /diagrams/:id/ai/undo --------
  fastify.post(
    '/diagrams/:id/ai/undo',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const lastOperation = await prisma.aiOperation.findFirst({
        where: { diagramId: id, applied: true },
        orderBy: { message: { createdAt: 'desc' } },
      });

      if (!lastOperation) throw new NotFoundError('No applied AI operations to undo');

      const modelBefore = lastOperation.modelBefore as unknown as UMLModel;

      await prisma.$transaction([
        prisma.diagram.update({
          where: { id },
          data: {
            umlModel: modelBefore as unknown as Prisma.InputJsonValue,
            version: { increment: 1 },
          },
        }),
        prisma.aiOperation.update({
          where: { id: lastOperation.id },
          data: { applied: false },
        }),
      ]);

      return reply.send({ model: modelBefore, message: 'Last AI operation undone' });
    }
  );
}