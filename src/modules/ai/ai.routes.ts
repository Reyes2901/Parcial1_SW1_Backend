// modules/ai/ai.routes.ts
// POST /diagrams/:id/ai/command — AI command endpoint (§7.4, §8)
// POST /diagrams/:id/ai/undo — Undo last AI operation

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { requireProjectRole } from '../../shared/role-guard';
import { prisma } from '../../shared/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { validateCommands } from '../../domain/validator';
import { applyCommands } from '../../domain/applier';
import type { UMLModel } from '../../domain/uml-model';
import type { UMLCommand } from '../../domain/uml-command';
import { AIOrchestrator } from './orchestrator';
import { OpenAILLMProvider } from './llm.provider';
import { DESTRUCTIVE_OPERATIONS } from './tools';
import type { Prisma } from '@prisma/client';

const orchestrator = new AIOrchestrator(new OpenAILLMProvider());

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /diagrams/:id/ai/command — Send a natural language command
  fastify.post(
    '/diagrams/:id/ai/command',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        message: string;
        confirmDestructive?: boolean;
        operationId?: string;
      };

      if (!body.message && !body.operationId) {
        throw new ValidationError('Either "message" or "operationId" (to confirm) is required');
      }

      const diagram = await prisma.diagram.findUnique({ where: { id } });
      if (!diagram) throw new NotFoundError('Diagram', id);

      const currentModel = diagram.umlModel as unknown as UMLModel;

      // If confirming a previous destructive operation
      if (body.operationId) {
        const operation = await prisma.aiOperation.findUnique({
          where: { id: body.operationId },
        });
        if (!operation) throw new NotFoundError('AiOperation', body.operationId);
        if (operation.applied) throw new ValidationError('Operation already applied');

        const commands = operation.commands as unknown as UMLCommand[];
        const destructiveCommands = commands.filter((c) =>
          DESTRUCTIVE_OPERATIONS.has(c.type)
        );

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
            data: {
              applied: true,
              modelAfter: newModel as unknown as Prisma.InputJsonValue,
            },
          }),
        ]);

        return reply.send({
          model: newModel,
          message: 'Destructive operations applied after confirmation',
          requiresConfirmation: false,
        });
      }

      // Guard: LLM_API_KEY must be configured
      if (!process.env.LLM_API_KEY) {
        return reply.status(503).send({
          error: 'El proveedor de IA no está configurado. Contacta al administrador.',
          code: 'AI_NOT_CONFIGURED',
        });
      }

      const userId = request.currentUser!.userId;

      // Process new message
      // Get or create conversation
      let conversation = await prisma.aiConversation.findFirst({
        where: { diagramId: id, userId },
        orderBy: { createdAt: 'desc' },
      });

      if (!conversation) {
        conversation = await prisma.aiConversation.create({
          data: { diagramId: id, userId, agentType: 'text' },
        });
      }

      // Store user message
      await prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: body.message,
        },
      });

      // Call AI orchestrator
      const result = await orchestrator.processCommand(currentModel, body.message);

      // Store assistant message
      const assistantMsg = await prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: result.message,
        },
      });

      // Apply non-destructive commands
      const validation = validateCommands(currentModel, result.autoApplied);
      if (!validation.valid) {
        throw new ValidationError('AI generated invalid commands', validation.errors);
      }

      const modelAfterSafe = applyCommands(currentModel, result.autoApplied);

      // Save operation for audit + potential undo
      const operation = await prisma.aiOperation.create({
        data: {
          diagramId: id,
          messageId: assistantMsg.id,
          commands: result.commands as unknown as Prisma.InputJsonValue,
          modelBefore: currentModel as unknown as Prisma.InputJsonValue,
          modelAfter: modelAfterSafe as unknown as Prisma.InputJsonValue,
          applied: !result.requiresConfirmation,
        },
      });

      // Persist the model with safe commands applied
      await prisma.diagram.update({
        where: { id },
        data: {
          umlModel: modelAfterSafe as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });

      return reply.send({
        model: modelAfterSafe,
        message: result.message,
        requiresConfirmation: result.requiresConfirmation,
        pendingConfirmation: result.pendingConfirmation,
        operationId: operation.id,
      });
    }
  );

  // POST /diagrams/:id/ai/undo — Undo last AI operation
  fastify.post(
    '/diagrams/:id/ai/undo',
    { preHandler: [authMiddleware, requireProjectRole('owner', 'editor')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const lastOperation = await prisma.aiOperation.findFirst({
        where: { diagramId: id, applied: true },
        orderBy: { message: { createdAt: 'desc' } },
      });

      if (!lastOperation) {
        throw new NotFoundError('No applied AI operations to undo');
      }

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

      return reply.send({
        model: modelBefore,
        message: 'Last AI operation undone',
      });
    }
  );
}

