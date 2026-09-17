// src/server.ts
// Main Fastify server application entrypoint

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { AppError } from './shared/errors';

// Import route modules
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { projectsRoutes } from './modules/projects/projects.routes';
import { invitationsRoutes } from './modules/projects/invitations.routes';
import { diagramsRoutes } from './modules/diagrams/diagrams.routes';
import { locksRoutes } from './modules/diagrams/locks.routes';
import { aiRoutes } from './modules/ai/ai.routes';
import { xmiImportRoutes } from './modules/import/xmi-import.routes';
import { imageImportRoutes } from './modules/import/image-import.routes';
import { generatorRoutes } from './modules/generator/generator.routes';
import { generationsRoutes } from './modules/generations/generations.routes';

export function buildServer() {
  const server = Fastify({
    logger: true,
  });

  // Register plugins
  server.register(cors, { origin: true });
  server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

  // Centralized Error Handler (§10)
  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.name,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    server.log.error(error);
    return reply.status(500).send({
      error: 'InternalServerError',
      message: error.message || 'An unexpected error occurred',
    });
  });

  // Health check endpoint
  server.get('/health', async () => ({ status: 'ok', timestamp: new Date() }));

  // Register API routes
  server.register(authRoutes);
  server.register(usersRoutes);
  server.register(projectsRoutes);
  server.register(invitationsRoutes);
  server.register(diagramsRoutes);
  server.register(locksRoutes);
  server.register(aiRoutes);
  server.register(xmiImportRoutes);
  server.register(imageImportRoutes);
  server.register(generatorRoutes);
  server.register(generationsRoutes);

  return server;
}

if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  const server = buildServer();
  server.listen({ port: PORT, host: HOST }, (err, address) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
    console.log(`Server listening on ${address}`);
  });
}
