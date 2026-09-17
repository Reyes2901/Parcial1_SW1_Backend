// modules/users/users.service.ts
// User service — user queries

import { prisma } from '../../shared/prisma';
import { NotFoundError } from '../../shared/errors';

export class UsersService {
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return user;
  }

  async getUserByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }
}
