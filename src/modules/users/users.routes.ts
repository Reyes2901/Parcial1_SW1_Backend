// modules/users/users.routes.ts

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/auth-middleware';
import { UsersService } from './users.service';

const usersService = new UsersService();

export async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /users/me — Get current user profile
  fastify.get(
    '/users/me',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const user = await usersService.getUserById(request.currentUser!.userId);
      return reply.send(user);
    }
  );
}
