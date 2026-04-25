import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { dbStub } = vi.hoisted(() => ({
  dbStub: {
    select: vi.fn(),
  },
}));
vi.mock('../config/database.js', () => ({
  db: dbStub,
  pool: {},
  checkDatabaseConnection: vi.fn(),
  closeDatabaseConnection: vi.fn(),
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { userRoutes } from './users.js';

/**
 * Builds a chainable drizzle-style stub that resolves to `rows` when awaited.
 * Mirrors the helper used by tasks.test.ts.
 */
function chainableSelectReturning(rows: unknown[]) {
  const builder: any = {
    from: () => builder,
    where: () => builder,
    then: (resolve: (v: unknown) => void) => resolve(rows),
  };
  return builder;
}

describe('userRoutes — GET /api/users', () => {
  let app: FastifyInstance;
  const OLD_ENV = { ...process.env };

  beforeEach(async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development' };
    delete process.env.JANUA_ISSUER;

    app = Fastify({ logger: false });
    await app.register(userRoutes, { prefix: '/api' });
    await app.ready();

    dbStub.select.mockReset();
  });

  afterEach(async () => {
    await app.close();
    process.env = OLD_ENV;
  });

  it('returns 401 without Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users' });
    expect(res.statusCode).toBe(401);
  });

  it('returns DB rows with source=db when the table is populated', async () => {
    dbStub.select.mockReturnValueOnce(
      chainableSelectReturning([
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Aldo',
          displayName: null,
          role: 'CEO MADFAM',
          avatarUrl: null,
          isActive: true,
        },
      ]),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: 'Bearer dev-token-mock-user' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.source).toBe('db');
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Aldo',
      role: 'CEO MADFAM',
    });
  });

  it('falls back to the seed list with source=fallback when the table is empty', async () => {
    dbStub.select.mockReturnValueOnce(chainableSelectReturning([]));

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: 'Bearer dev-token-mock-user' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.source).toBe('fallback');
    // The 5 canonical team members.
    expect(body.data).toHaveLength(5);
    expect(body.data.map((u: { name: string }) => u.name)).toEqual([
      'Aldo',
      'Nuri',
      'Luis',
      'Silvia',
      'Caro',
    ]);
    // Fallback rows MUST NOT carry a fake id (would mislead callers).
    for (const row of body.data) {
      expect(row.id).toBeUndefined();
    }
  });

  it('returns 500 when the DB query throws', async () => {
    dbStub.select.mockImplementationOnce(() => {
      throw new Error('connection refused');
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: 'Bearer dev-token-mock-user' },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json().success).toBe(false);
  });
});
