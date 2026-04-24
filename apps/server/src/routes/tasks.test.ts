import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// vi.mock is hoisted. Use vi.hoisted() so the stub object is available inside
// the factory without ReferenceError.
const { dbStub } = vi.hoisted(() => ({
  dbStub: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('../config/database.js', () => ({
  db: dbStub,
  pool: {},
  checkDatabaseConnection: vi.fn(),
  closeDatabaseConnection: vi.fn(),
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { taskRoutes } from './tasks.js';

function chainableSelectReturning(rows: unknown[]) {
  // Drizzle's builder is chainable and thenable. We return a Promise-like object
  // that also exposes the chain methods so intermediate `.leftJoin/.where/.limit/
  // .offset` calls keep returning `this` until something awaits it.
  const builder: any = {
    from: () => builder,
    leftJoin: () => builder,
    where: () => builder,
    groupBy: () => builder,
    limit: () => builder,
    offset: () => builder,
    then: (resolve: (v: unknown) => void) => resolve(rows),
  };
  return builder;
}

describe('taskRoutes — integration (verifyJWT → validation → handler)', () => {
  let app: FastifyInstance;
  const OLD_ENV = { ...process.env };

  beforeEach(async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development' };
    delete process.env.JANUA_ISSUER;

    app = Fastify({ logger: false });
    await app.register(taskRoutes, { prefix: '/api' });
    await app.ready();

    dbStub.select.mockReset();
    dbStub.insert.mockReset();
    dbStub.update.mockReset();
    dbStub.delete.mockReset();
  });

  afterEach(async () => {
    await app.close();
    process.env = OLD_ENV;
  });

  it('GET /api/tasks returns 401 without Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/tasks returns 200 with the dev-mock token (dev mode)', async () => {
    dbStub.select.mockReturnValueOnce(chainableSelectReturning([]));
    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { authorization: 'Bearer dev-token-mock-user' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.limit).toBe(100);
    expect(body.offset).toBe(0);
  });

  it('GET /api/tasks coerces phase=2 into a number', async () => {
    let capturedPhase: unknown = undefined;
    dbStub.select.mockImplementationOnce(() => {
      const builder: any = {
        from: () => builder,
        leftJoin: () => builder,
        where: (cond: any) => { capturedPhase = cond; return builder; },
        limit: () => builder,
        offset: () => builder,
        then: (r: any) => r([]),
      };
      return builder;
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks?phase=2',
      headers: { authorization: 'Bearer dev-token-mock-user' },
    });
    expect(res.statusCode).toBe(200);
    // Just verifying that the query path succeeded with a coerced phase value
    // rather than rejecting '2' as a non-number. The where-clause capture
    // protects against a regression to the old `parseInt` path.
    expect(capturedPhase).toBeDefined();
  });

  it('POST /api/tasks 400s on a body missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { authorization: 'Bearer dev-token-mock-user' },
      payload: { title: 'no projectId' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Validation failed');
  });

  it('POST /api/tasks 400s when projectId is not a UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { authorization: 'Bearer dev-token-mock-user' },
      payload: { projectId: 'not-a-uuid', title: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/tasks 201s with a valid body and returns the inserted row', async () => {
    const inserted = {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Write docs',
      status: 'not-started',
    };
    dbStub.insert.mockImplementationOnce(() => ({
      values: () => ({ returning: async () => [inserted] }),
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { authorization: 'Bearer dev-token-mock-user' },
      payload: {
        projectId: '00000000-0000-0000-0000-000000000001',
        title: 'Write docs',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toEqual(inserted);
  });

  it('DELETE /api/tasks/:id 400s on a non-uuid id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/tasks/not-a-uuid',
      headers: { authorization: 'Bearer dev-token-mock-user' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH /api/tasks/bulk routes to the bulk handler (not /:id)', async () => {
    // Regression guard: if /tasks/bulk is registered AFTER /tasks/:id, Fastify
    // would match "bulk" as an :id and the Zod UUID check would 400.
    dbStub.update.mockImplementation(() => ({
      set: () => ({ where: () => ({ returning: async () => [{ id: 'x' }] }) }),
    }));
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/bulk',
      headers: { authorization: 'Bearer dev-token-mock-user' },
      payload: {
        updates: [{ id: '00000000-0000-0000-0000-000000000001', status: 'completed' }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});
