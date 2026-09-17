import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server';
import type { FastifyInstance } from 'fastify';

describe('Fastify Routes - Contract Verification (§8)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });

  it('POST /auth/google requires code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /auth/logout returns 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Logged out');
  });

  it('Protected routes require Bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/projects',
    });
    expect(res.statusCode).toBe(401);

    const diagramRes = await app.inject({
      method: 'GET',
      url: '/diagrams/any-id',
    });
    expect(diagramRes.statusCode).toBe(401);

    const genRes = await app.inject({
      method: 'GET',
      url: '/generations/any-id/files',
    });
    expect(genRes.statusCode).toBe(401);
  });

  it('POST /auth/register validates email and password length', async () => {
    const resNoEmail = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { password: '123' },
    });
    expect(resNoEmail.statusCode).toBe(400);

    const resShortPass = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: '123' },
    });
    expect(resShortPass.statusCode).toBe(400);
  });

  it('POST /auth/login validates required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(400);
  });
});
