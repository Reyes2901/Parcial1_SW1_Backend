// modules/projects/invitations.routes.ts
// Invitation links with predefined role, revocable (§7.2, §8)

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { ProjectsService } from './projects.service';
import type { ProjectRole } from '@prisma/client';

const service = new ProjectsService();

export async function invitationsRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /projects/:id/invitations — Create invitation link (§8)
  fastify.post(
    '/projects/:id/invitations',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as { role?: ProjectRole; expiresInDays?: number }) || {};
      const role = body.role || 'editor';
      const invitation = await service.createInvitation(
        id,
        role,
        request.currentUser!.userId,
        body.expiresInDays
      );
      return reply.status(201).send(invitation);
    }
  );

  // GET /projects/:id/invitations — List project invitations (owner only)
  fastify.get(
    '/projects/:id/invitations',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const invitations = await service.listInvitations(id, request.currentUser!.userId);
      return reply.send(invitations);
    }
  );

  // DELETE /projects/:id/invitations/:invitationId — Revoke invitation
  fastify.delete(
    '/projects/:id/invitations/:invitationId',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id, invitationId } = request.params as { id: string; invitationId: string };
      const result = await service.revokeInvitation(id, invitationId, request.currentUser!.userId);
      return reply.send(result);
    }
  );

  // POST /projects/join/:token — Accept invitation
  fastify.post(
    '/projects/join/:token',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const result = await service.acceptInvitation(
        token,
        request.currentUser!.userId
      );
      return reply.send(result);
    }
  );
}
