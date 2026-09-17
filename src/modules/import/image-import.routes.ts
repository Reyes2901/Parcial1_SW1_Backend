// modules/import/image-import.routes.ts
// POST /diagrams/:id/import/image (§7.6, §8)
// Returns UMLCommand[] WITHOUT applying — frontend previews and user confirms.

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { requireProjectRole } from '../../shared/role-guard';
import { prisma } from '../../shared/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { OpenAIModuleVisionProvider } from './vision.provider';

const visionProvider = new OpenAIModuleVisionProvider();

export async function imageImportRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/diagrams/:id/import/image',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const diagram = await prisma.diagram.findUnique({ where: { id } });
      if (!diagram) throw new NotFoundError('Diagram', id);

      if (!request.isMultipart()) {
        throw new ValidationError('Expected multipart/form-data with image file');
      }

      const file = await request.file();
      if (!file) throw new ValidationError('No image file uploaded');

      const mimeType = file.mimetype;
      if (!mimeType.startsWith('image/')) {
        throw new ValidationError(`Invalid file type "${mimeType}". Only image files are allowed.`);
      }

      const buffer = await file.toBuffer();
      const extractedCommands = await visionProvider.extractCommandsFromImage(buffer, mimeType);

      // Return commands WITHOUT applying them (§7.6)
      return reply.send({
        diagramId: id,
        commands: extractedCommands,
        applied: false,
        message: 'Image processed successfully. Preview commands before confirming.',
      });
    }
  );
}
