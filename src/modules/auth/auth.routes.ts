// modules/auth/auth.routes.ts
// Auth routes — no business logic here, delegates to service (§10)

import { FastifyInstance } from 'fastify';
import { AuthService } from './auth.service';
import { GoogleOAuthProvider } from './google-oauth.provider';

const authService = new AuthService(new GoogleOAuthProvider());

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /auth/register — Register new user with email and password
  fastify.post('/auth/register', async (request, reply) => {
    const body = request.body as { email: string; password?: string; name?: string };
    const result = await authService.register(body.email, body.password, body.name);
    return reply.status(201).send(result);
  });

  // POST /auth/login — Login with email and password
  fastify.post('/auth/login', async (request, reply) => {
    const body = request.body as { email: string; password?: string };
    const result = await authService.login(body.email, body.password);
    return reply.status(200).send(result);
  });

  // POST /auth/google — Login/register with Google OAuth code (§8)
  fastify.post('/auth/google', async (request, reply) => {
    const body = (request.body as { code?: string; redirectUri?: string }) || {};

    if (!body.code) {
      return reply.status(400).send({ error: 'Missing OAuth code' });
    }

    const result = await authService.loginWithGoogle(body.code);
    return reply.status(200).send(result);
  });

  // POST /auth/logout — Client-side logout (invalidate on client) (§8)
  fastify.post('/auth/logout', async (_request, reply) => {
    return reply.status(200).send({ message: 'Logged out successfully' });
  });
}
