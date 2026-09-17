// modules/diagrams/diagrams.routes.ts
// CRUD diagramas + versiones (§7.2, §8)

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { requireProjectRole } from '../../shared/role-guard';
import { DiagramsService } from './diagrams.service';
import type { UMLModel } from '../../domain/uml-model';

const service = new DiagramsService();

export async function diagramsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /projects/:id/diagrams — List diagrams in a project
  fastify.get(
    '/projects/:id/diagrams',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor', 'viewer')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const diagrams = await service.listDiagrams(id);
      return reply.send(diagrams);
    }
  );

  // POST /projects/:id/diagrams — Create a diagram
  fastify.post(
    '/projects/:id/diagrams',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { name: string };
      const diagram = await service.createDiagram(id, body.name);
      return reply.status(201).send(diagram);
    }
  );

  // GET /diagrams/:id — Get diagram with full MCU
  fastify.get(
    '/diagrams/:id',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor', 'viewer')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const diagram = await service.getDiagram(id);
      return reply.send(diagram);
    }
  );

  // PUT /diagrams/:id — Update diagram MCU (debounced save)
  fastify.put(
    '/diagrams/:id',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { umlModel: UMLModel; version: number };
      const diagram = await service.updateDiagramModel(id, body.umlModel, body.version);
      return reply.send(diagram);
    }
  );

  // POST /diagrams/:id/versions — Create a snapshot
  fastify.post(
    '/diagrams/:id/versions',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const version = await service.createVersion(id, request.currentUser!.userId);
      return reply.status(201).send(version);
    }
  );

  // GET /diagrams/:id/versions — List versions
  fastify.get(
    '/diagrams/:id/versions',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor', 'viewer')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const versions = await service.listVersions(id);
      return reply.send(versions);
    }
  );

  // POST /diagrams/:id/versions/:versionId/restore — Restore a version
  fastify.post(
    '/diagrams/:id/versions/:versionId/restore',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id, versionId } = request.params as { id: string; versionId: string };
      const diagram = await service.restoreVersion(id, versionId);
      return reply.send(diagram);
    }
  );
}
