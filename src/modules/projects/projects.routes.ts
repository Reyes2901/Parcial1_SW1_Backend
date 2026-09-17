// modules/projects/projects.routes.ts
// CRUD proyectos + membresías + roles (§7.2, §8)

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { requireProjectRole } from '../../shared/role-guard';
import { ProjectsService } from './projects.service';
import type { ProjectRole } from '@prisma/client';

const service = new ProjectsService();

export async function projectsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /projects — List projects for current user
  fastify.get(
    '/projects',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const projects = await service.listProjects(request.currentUser!.userId);
      return reply.send(projects);
    }
  );

  // POST /projects — Create a new project
  fastify.post(
    '/projects',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const body = request.body as { name: string };
      const project = await service.createProject(
        body.name,
        request.currentUser!.userId
      );
      return reply.status(201).send(project);
    }
  );

  // GET /projects/:id — Get project details
  fastify.get(
    '/projects/:id',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor', 'viewer')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const project = await service.getProject(id);
      return reply.send(project);
    }
  );

  // PUT /projects/:id — Update project
  fastify.put(
    '/projects/:id',
    { preHandler: [authMiddleware, requireProjectRole('owner')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { name: string };
      const project = await service.updateProject(
        id,
        body.name,
        request.currentUser!.userId
      );
      return reply.send(project);
    }
  );

  // DELETE /projects/:id — Delete project
  fastify.delete(
    '/projects/:id',
    { preHandler: [authMiddleware, requireProjectRole('owner')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await service.deleteProject(id, request.currentUser!.userId);
      return reply.send(result);
    }
  );

  // GET /projects/:id/members — List project members
  fastify.get(
    '/projects/:id/members',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor', 'viewer')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const members = await service.listMembers(id);
      return reply.send(members);
    }
  );

  // PUT /projects/:id/members/:userId — Update a member's role (owner only)
  fastify.put(
    '/projects/:id/members/:userId',
    { preHandler: [authMiddleware, requireProjectRole('owner')] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const body = request.body as { role: ProjectRole };
      const result = await service.updateMemberRole(
        id,
        userId,
        body.role,
        request.currentUser!.userId
      );
      return reply.send(result);
    }
  );

  // DELETE /projects/:id/members/:userId — Remove a member (owner only)
  fastify.delete(
    '/projects/:id/members/:userId',
    { preHandler: [authMiddleware, requireProjectRole('owner')] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const result = await service.removeMember(
        id,
        userId,
        request.currentUser!.userId
      );
      return reply.send(result);
    }
  );
}
