// shared/auth-middleware.ts
// JWT auth middleware for Fastify — validates tokens and attaches user to request

import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './errors';

export interface JwtPayload {
  userId: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: JwtPayload;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7);
  request.currentUser = verifyToken(token);
}
