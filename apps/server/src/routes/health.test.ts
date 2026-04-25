import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { pingDatabaseMock } = vi.hoisted(() => ({
  pingDatabaseMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  pool: {},
  db: {},
  pingDatabase: pingDatabaseMock,
  checkDatabaseConnection: vi.fn(),
  closeDatabaseConnection: vi.fn(),
  waitForDatabase: vi.fn(),
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';

describe('healthRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    pingDatabaseMock.mockReset();
    app = Fastify({ logger: false });
    await app.register(healthRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ----- /api/health -----

  it('GET /api/health returns 200 with status=ok when DB is up', async () => {
    pingDatabaseMock.mockResolvedValueOnce({ ok: true });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.checks).toEqual({ database: 'ok' });
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('GET /api/health returns 503 with status=degraded on DB failure', async () => {
    pingDatabaseMock.mockResolvedValueOnce({ ok: false, error: 'connection refused' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('degraded');
    expect(body.checks).toEqual({ database: 'fail', error: 'connection refused' });
  });

  it('GET /api/health returns 503 on DB timeout', async () => {
    pingDatabaseMock.mockResolvedValueOnce({
      ok: false,
      error: 'database ping timed out after 500ms',
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json().checks.error).toMatch(/timed out/);
  });

  it('GET /api/health uses a 500ms ping timeout', async () => {
    pingDatabaseMock.mockResolvedValueOnce({ ok: true });
    await app.inject({ method: 'GET', url: '/api/health' });
    expect(pingDatabaseMock).toHaveBeenCalledWith(500);
  });

  it('GET /api/health does NOT retry inside the handler', async () => {
    pingDatabaseMock.mockResolvedValueOnce({ ok: false, error: 'down' });
    await app.inject({ method: 'GET', url: '/api/health' });
    // Single call — the handler must surface the failure rather than retry.
    expect(pingDatabaseMock).toHaveBeenCalledTimes(1);
  });

  // ----- /api/health/ready -----

  it('GET /api/health/ready returns 200 when DB is up', async () => {
    pingDatabaseMock.mockResolvedValueOnce({ ok: true });
    const res = await app.inject({ method: 'GET', url: '/api/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ready: true });
  });

  it('GET /api/health/ready returns 503 when DB is down', async () => {
    pingDatabaseMock.mockResolvedValueOnce({ ok: false, error: 'no route' });
    const res = await app.inject({ method: 'GET', url: '/api/health/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ ready: false, reason: 'database_unavailable' });
  });

  // ----- /api/health/live -----

  it('GET /api/health/live returns 200 without touching the DB', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ alive: true });
    expect(pingDatabaseMock).not.toHaveBeenCalled();
  });
});
