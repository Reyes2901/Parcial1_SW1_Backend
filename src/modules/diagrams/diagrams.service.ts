// modules/diagrams/diagrams.service.ts
// Diagrams CRUD + versioning + MCU persistence (§7.2)

import { prisma } from '../../shared/prisma';
import { NotFoundError, ConflictError } from '../../shared/errors';
import type { UMLModel } from '../../domain/uml-model';
import type { Prisma } from '@prisma/client';

export class DiagramsService {
  /** Create an empty diagram */
  async createDiagram(projectId: string, name: string): Promise<{ id: string; name: string; umlModel: UMLModel; version: number }> {
    const emptyModel: UMLModel = {
      id: '',
      name,
      version: 1,
      classes: [],
      relations: [],
    };

    const diagram = await prisma.diagram.create({
      data: {
        projectId,
        name,
        umlModel: emptyModel as unknown as Prisma.InputJsonValue,
        version: 1,
      },
    });

    // Update the model ID to match the diagram ID
    const model: UMLModel = { ...emptyModel, id: diagram.id };
    await prisma.diagram.update({
      where: { id: diagram.id },
      data: { umlModel: model as unknown as Prisma.InputJsonValue },
    });

    return { id: diagram.id, name: diagram.name, umlModel: model, version: diagram.version };
  }

  /** List diagrams in a project */
  async listDiagrams(projectId: string) {
    return prisma.diagram.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        version: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Get a diagram with its full UML model */
  async getDiagram(diagramId: string) {
    const diagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
    });
    if (!diagram) {
      throw new NotFoundError('Diagram', diagramId);
    }
    return diagram;
  }

  /** Update the full UML model (debounced save from client) */
  async updateDiagramModel(diagramId: string, umlModel: UMLModel, expectedVersion: number) {
    const diagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
    });
    if (!diagram) {
      throw new NotFoundError('Diagram', diagramId);
    }

    // Optimistic concurrency check
    if (diagram.version !== expectedVersion) {
      throw new ConflictError(
        `Version conflict: expected ${expectedVersion}, current is ${diagram.version}`
      );
    }

    const updated = await prisma.diagram.update({
      where: { id: diagramId },
      data: {
        umlModel: umlModel as unknown as Prisma.InputJsonValue,
        version: diagram.version + 1,
      },
    });

    return updated;
  }

  /** Create a versioned snapshot */
  async createVersion(diagramId: string, userId: string) {
    const diagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
    });
    if (!diagram) {
      throw new NotFoundError('Diagram', diagramId);
    }

    const version = await prisma.diagramVersion.create({
      data: {
        diagramId,
        version: diagram.version,
        umlModel: diagram.umlModel as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });

    return version;
  }

  /** List versions of a diagram */
  async listVersions(diagramId: string) {
    return prisma.diagramVersion.findMany({
      where: { diagramId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        createdAt: true,
        creator: { select: { id: true, name: true } },
      },
    });
  }

  /** Restore a version */
  async restoreVersion(diagramId: string, versionId: string) {
    const version = await prisma.diagramVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.diagramId !== diagramId) {
      throw new NotFoundError('DiagramVersion', versionId);
    }

    const updated = await prisma.diagram.update({
      where: { id: diagramId },
      data: {
        umlModel: version.umlModel as Prisma.InputJsonValue,
        version: {
          increment: 1,
        },
      },
    });

    return updated;
  }

  /** Acquire a class lock (§7.2) */
  async acquireLock(diagramId: string, classId: string, userId: string) {
    // Clean up expired locks
    await prisma.classLock.deleteMany({
      where: {
        diagramId,
        expiresAt: { lt: new Date() },
      },
    });

    // Check if already locked by someone else
    const existing = await prisma.classLock.findUnique({
      where: { diagramId_classId: { diagramId, classId } },
    });

    if (existing && existing.lockedBy !== userId) {
      throw new ConflictError(`Class "${classId}" is locked by another user`);
    }

    // Upsert the lock (30s expiration per §7.2)
    const expiresAt = new Date(Date.now() + 30 * 1000);

    const lock = await prisma.classLock.upsert({
      where: { diagramId_classId: { diagramId, classId } },
      update: { expiresAt },
      create: { diagramId, classId, lockedBy: userId, expiresAt },
    });

    return lock;
  }

  /** Release a class lock */
  async releaseLock(diagramId: string, classId: string, userId: string) {
    const existing = await prisma.classLock.findUnique({
      where: { diagramId_classId: { diagramId, classId } },
    });

    if (!existing) {
      return { message: 'No lock found' };
    }

    if (existing.lockedBy !== userId) {
      throw new ConflictError('Cannot release a lock held by another user');
    }

    await prisma.classLock.delete({
      where: { diagramId_classId: { diagramId, classId } },
    });

    return { message: 'Lock released' };
  }

  /** List active locks */
  async listLocks(diagramId: string) {
    // Clean up expired
    await prisma.classLock.deleteMany({
      where: { diagramId, expiresAt: { lt: new Date() } },
    });

    return prisma.classLock.findMany({
      where: { diagramId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  }
}
