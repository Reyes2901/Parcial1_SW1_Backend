// shared/prisma.ts
// Singleton Prisma client instance

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
