import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// No DB access required by phases route, but mock the database module so the
// import graph (verifyJWT → ... → config) does not require a real connection.
vi.mock('../config/database.js', () => ({
  db: {},
  pool: {},
  checkDatabaseConnection: vi.fn(),
  closeDatabaseConnection: vi.fn(),
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { phasesRoutes } from './phases.js';
import { DEFAULT_PROJECT_PHASES } from '../data/phases.js';

describe('phasesRoutes — GET /api/phases', () => {
  let app: FastifyInstance;
  const OLD_ENV = { ...process.env };

  beforeEach(async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development' };
    delete process.env.JANUA_ISSUER;

    app = Fastify({ logger: false });
    await app.register(phasesRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    process.env = OLD_ENV;
  });

  it('returns 401 without Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/phases' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with the canonical phase list under dev-mock token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/phases',
      headers: { authorization: 'Bearer dev-token-mock-user' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Spec invariant: 5 MADLAB phases.
    expect(body.data).toHaveLength(5);
    // Same data the constant exports — guards against accidental shape drift.
    expect(body.data).toEqual(DEFAULT_PROJECT_PHASES.map((p) => ({ ...p })));
  });

  it('each phase has the required shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/phases',
      headers: { authorization: 'Bearer dev-token-mock-user' },
    });
    const body = res.json();
    for (const phase of body.data) {
      expect(typeof phase.number).toBe('number');
      expect(typeof phase.title.es).toBe('string');
      expect(typeof phase.title.en).toBe('string');
      expect(typeof phase.dateRange).toBe('string');
      expect(typeof phase.taskCount).toBe('number');
    }
  });
});
