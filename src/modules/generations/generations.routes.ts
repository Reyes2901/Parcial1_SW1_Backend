// modules/generations/generations.routes.ts
// GET /generations/:id/files, PATCH /generations/:id/files/*, GET /generations/:id/download (§7.8, §8)

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { ValidationError } from '../../shared/errors';
import { GenerationsService } from './generations.service';
import { createZipStream } from '../generator/zip';

const service = new GenerationsService();

export async function generationsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /generations/:id/files — Get file tree and contents
  fastify.get(
    '/generations/:id/files',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await service.getGenerationFiles(id);
      return reply.send(result);
    }
  );

  // PATCH /generations/:id/files/:path — Edit content of a generated file (§8)
  fastify.patch(
    '/generations/:id/files/:path',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const params = request.params as Record<string, string>;
      const body = (request.body as { content?: string; path?: string; filePath?: string }) || {};
      const filePath = params.path || params['*'] || body.path || body.filePath;

      if (!filePath) {
        throw new ValidationError('File path is required');
      }
      if (typeof body.content !== 'string') {
        throw new ValidationError('File content must be a string');
      }

      const result = await service.updateFileContent(id, filePath, body.content);
      return reply.send(result);
    }
  );

  // PATCH /generations/:id/files/* — Edit content of a generated file (wildcard path for nested paths)
  fastify.patch(
    '/generations/:id/files/*',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const params = request.params as Record<string, string>;
      const body = (request.body as { content?: string; path?: string; filePath?: string }) || {};
      const filePath = params['*'] || params.path || body.path || body.filePath;

      if (!filePath) {
        throw new ValidationError('File path is required');
      }
      if (typeof body.content !== 'string') {
        throw new ValidationError('File content must be a string');
      }

      const result = await service.updateFileContent(id, filePath, body.content);
      return reply.send(result);
    }
  );

  // PATCH /generations/:id/files — Alternative path for editing file content via JSON body
  fastify.patch(
    '/generations/:id/files',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as { content?: string; path?: string; filePath?: string }) || {};
      const filePath = body.path || body.filePath;

      if (!filePath) {
        throw new ValidationError('File path is required in request body');
      }
      if (typeof body.content !== 'string') {
        throw new ValidationError('File content must be a string');
      }

      const result = await service.updateFileContent(id, filePath, body.content);
      return reply.send(result);
    }
  );

  // GET /generations/:id/download — Package project into .zip and stream download
  fastify.get(
    '/generations/:id/download',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { files } = await service.getGenerationFiles(id);

      const zipStream = createZipStream(files);

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="project-generation-${id}.zip"`);

      return reply.send(zipStream);
    }
  );
}
