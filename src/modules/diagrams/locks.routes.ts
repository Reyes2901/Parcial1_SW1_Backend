// modules/diagrams/locks.routes.ts
// Optimistic class locking (§7.2)

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { requireProjectRole } from '../../shared/role-guard';
import { DiagramsService } from './diagrams.service';

const service = new DiagramsService();

export async function locksRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /diagrams/:id/locks — Acquire a lock on a class
  fastify.post(
    '/diagrams/:id/locks',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { classId: string };
      const lock = await service.acquireLock(
        id,
        body.classId,
        request.currentUser!.userId
      );
      return reply.status(200).send(lock);
    }
  );

  // DELETE /diagrams/:id/locks/:classId — Release a lock
  fastify.delete(
    '/diagrams/:id/locks/:classId',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id, classId } = request.params as { id: string; classId: string };
      const result = await service.releaseLock(
        id,
        classId,
        request.currentUser!.userId
      );
      return reply.send(result);
    }
  );

  // GET /diagrams/:id/locks — List active locks
  fastify.get(
    '/diagrams/:id/locks',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor', 'viewer')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const locks = await service.listLocks(id);
      return reply.send(locks);
    }
  );
}
