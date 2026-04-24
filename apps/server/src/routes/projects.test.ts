import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { dbStub, upsertLocalUserMock } = vi.hoisted(() => ({
  dbStub: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  upsertLocalUserMock: vi.fn(),
}));
vi.mock('../config/database.js', () => ({
  db: dbStub,
  pool: {},
  checkDatabaseConnection: vi.fn(),
  closeDatabaseConnection: vi.fn(),
}));
vi.mock('../services/users.js', () => ({
  upsertLocalUser: upsertLocalUserMock,
  findLocalUserIdByJanuaId: vi.fn(),
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { projectRoutes } from './projects.js';

describe('projectRoutes — POST /projects uses upsertLocalUser for createdBy', () => {
  let app: FastifyInstance;
  const OLD_ENV = { ...process.env };

  beforeEach(async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development' };
    delete process.env.JANUA_ISSUER;

    app = Fastify({ logger: false });
    await app.register(projectRoutes, { prefix: '/api' });
    await app.ready();

    dbStub.select.mockReset();
    dbStub.insert.mockReset();
    upsertLocalUserMock.mockReset();
  });

  afterEach(async () => {
    await app.close();
    process.env = OLD_ENV;
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/projects', payload: { name: 'x' } });
    expect(res.statusCode).toBe(401);
    expect(upsertLocalUserMock).not.toHaveBeenCalled();
  });

  it('calls upsertLocalUser and uses the returned UUID for createdBy', async () => {
    upsertLocalUserMock.mockResolvedValueOnce('resolved-local-user-uuid');

    let insertedValues: any = undefined;
    dbStub.insert.mockImplementationOnce(() => ({
      values: (v: unknown) => {
        insertedValues = v;
        return { returning: async () => [{ id: 'new-project-id', ...(v as any) }] };
      },
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: 'Bearer dev-token-mock-user' },
      payload: { name: 'Demo' },
    });

    expect(res.statusCode).toBe(201);
    expect(upsertLocalUserMock).toHaveBeenCalledTimes(1);
    // The middleware attaches a mock user in development mode; upsert gets it.
    expect(upsertLocalUserMock.mock.calls[0][0]).toMatchObject({
      sub: 'mock-user-id-12345',
      email: 'aldo@madlab.io',
    });
    expect(insertedValues.createdBy).toBe('resolved-local-user-uuid');
  });

  it('returns 500 if upsertLocalUser fails', async () => {
    upsertLocalUserMock.mockRejectedValueOnce(new Error('db exploded'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: 'Bearer dev-token-mock-user' },
      payload: { name: 'Demo' },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json().error).toMatch(/authenticated user/);
    expect(dbStub.insert).not.toHaveBeenCalled();
  });

  it('400s on invalid body (empty name) without calling upsert', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: 'Bearer dev-token-mock-user' },
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(upsertLocalUserMock).not.toHaveBeenCalled();
  });
});
