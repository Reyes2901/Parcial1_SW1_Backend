// shared/role-guard.ts
// Role-based access control — validates user role in a project (§7.1)

import { FastifyRequest, FastifyReply } from 'fastify';
import { ProjectRole } from '@prisma/client';
import { prisma } from './prisma';
import { ForbiddenError, UnauthorizedError, NotFoundError } from './errors';

/**
 * Creates a Fastify preHandler that checks if the current user has
 * at least one of the required roles in the project.
 */
export function requireProjectRole(...roles: ProjectRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const user = request.currentUser;
    if (!user) {
      throw new UnauthorizedError();
    }

    const params = request.params as Record<string, string>;
    let projectId: string | undefined;

    if (params.projectId) {
      projectId = params.projectId;
    } else if (params.diagramId) {
      const diagram = await prisma.diagram.findUnique({
        where: { id: params.diagramId },
        select: { projectId: true },
      });
      if (!diagram) {
        throw new NotFoundError('Diagram', params.diagramId);
      }
      projectId = diagram.projectId;
    } else if (params.id) {
      // Check if params.id is a project ID
      const project = await prisma.project.findUnique({
        where: { id: params.id },
        select: { id: true },
      });

      if (project) {
        projectId = project.id;
      } else {
        // Check if params.id is a diagram ID
        const diagram = await prisma.diagram.findUnique({
          where: { id: params.id },
          select: { projectId: true },
        });
        if (diagram) {
          projectId = diagram.projectId;
        }
      }
    }

    if (!projectId) {
      throw new ForbiddenError('Could not determine project context for role check');
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.userId,
        },
      },
    });

    if (!membership || !roles.includes(membership.role)) {
      throw new ForbiddenError(
        `Requires one of roles: ${roles.join(', ')}. You have: ${membership?.role ?? 'none'}`
      );
    }
  };
}
