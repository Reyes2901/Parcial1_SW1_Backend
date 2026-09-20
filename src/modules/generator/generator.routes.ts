// modules/generator/generator.routes.ts
// POST /diagrams/:id/generate (§7.7, §7.8, §8)

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { requireProjectRole } from '../../shared/role-guard';
import { prisma } from '../../shared/prisma';
import { NotFoundError } from '../../shared/errors';
import type { UMLModel } from '../../domain/uml-model';
import { SpringBootGeneratorService } from './generator.service';
import { GenerationsService } from '../generations/generations.service';

const generatorService = new SpringBootGeneratorService();
const generationsService = new GenerationsService();

export async function generatorRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/diagrams/:id/generate',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const diagram = await prisma.diagram.findUnique({ where: { id } });
      if (!diagram) throw new NotFoundError('Diagram', id);

      const model = diagram.umlModel as unknown as UMLModel;

      // Validate: MCU must have at least one class to generate code
      if (!model.classes || model.classes.length === 0) {
        return reply.status(400).send({
          error: 'El diagrama debe tener al menos una clase para generar código',
          code: 'EMPTY_DIAGRAM',
        });
      }

      // Generate Spring Boot project file tree
      const files = generatorService.generateProject(model);

      // Save generation to database
      const generation = await generationsService.createGeneration(
        id,
        request.currentUser!.userId,
        files
      );

      return reply.status(201).send({
        generationId: generation.id,
        diagramId: id,
        fileCount: Object.keys(files).length,
        status: generation.status,
      });
    }
  );
}


