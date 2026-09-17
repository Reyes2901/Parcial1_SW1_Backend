// modules/generations/generations.service.ts
// Generations service — manages stored code trees and edits (§7.8)

import { prisma } from '../../shared/prisma';
import { NotFoundError } from '../../shared/errors';
import type { GeneratedFileTree } from '../generator/zip';
import type { Prisma } from '@prisma/client';

export class GenerationsService {
  async createGeneration(diagramId: string, userId: string, files: GeneratedFileTree) {
    const generation = await prisma.generation.create({
      data: {
        diagramId,
        userId,
        files: files as unknown as Prisma.InputJsonValue,
        status: 'completed',
      },
    });
    return generation;
  }

  async getGenerationFiles(generationId: string) {
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
    });

    if (!generation) {
      throw new NotFoundError('Generation', generationId);
    }

    return {
      id: generation.id,
      diagramId: generation.diagramId,
      createdAt: generation.createdAt,
      files: generation.files as unknown as GeneratedFileTree,
    };
  }

  async updateFileContent(generationId: string, filePath: string, newContent: string) {
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
    });

    if (!generation) {
      throw new NotFoundError('Generation', generationId);
    }

    const currentFiles = (generation.files as unknown as GeneratedFileTree) || {};

    if (!(filePath in currentFiles)) {
      throw new NotFoundError(`File "${filePath}" in Generation`, generationId);
    }

    const updatedFiles = {
      ...currentFiles,
      [filePath]: newContent,
    };

    const updated = await prisma.generation.update({
      where: { id: generationId },
      data: {
        files: updatedFiles as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      message: 'File updated successfully',
      filePath,
      generationId: updated.id,
    };
  }
}
