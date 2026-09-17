// modules/import/xmi-import.routes.ts
// POST /diagrams/:id/import/xmi (§7.5, §8)

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { requireProjectRole } from '../../shared/role-guard';
import { prisma } from '../../shared/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { parseXMI } from './xmi-parser';
import { validateCommands } from '../../domain/validator';
import { applyCommands } from '../../domain/applier';
import type { UMLModel } from '../../domain/uml-model';
import type { Prisma } from '@prisma/client';

export async function xmiImportRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/diagrams/:id/import/xmi',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const diagram = await prisma.diagram.findUnique({ where: { id } });
      if (!diagram) throw new NotFoundError('Diagram', id);

      let xmlContent = '';

      if (request.isMultipart()) {
        const data = await request.file();
        if (!data) throw new ValidationError('No file uploaded');
        const buffer = await data.toBuffer();
        xmlContent = buffer.toString('utf-8');
      } else if (typeof request.body === 'string') {
        xmlContent = request.body;
      } else if (request.body && typeof (request.body as Record<string, unknown>).xml === 'string') {
        xmlContent = (request.body as Record<string, unknown>).xml as string;
      } else {
        throw new ValidationError('Expected XMI XML file upload or raw XML text body');
      }

      const { commands, warnings } = parseXMI(xmlContent);

      if (commands.length === 0) {
        throw new ValidationError('No valid UML elements found in XMI file', { warnings });
      }

      const currentModel = diagram.umlModel as unknown as UMLModel;
      const validation = validateCommands(currentModel, commands);

      if (!validation.valid) {
        throw new ValidationError('XMI import validation failed', {
          validationErrors: validation.errors,
          warnings,
        });
      }

      const updatedModel = applyCommands(currentModel, commands);

      await prisma.diagram.update({
        where: { id },
        data: {
          umlModel: updatedModel as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });

      return reply.send({
        model: updatedModel,
        commandsAppliedCount: commands.length,
        warnings,
      });
    }
  );
}
