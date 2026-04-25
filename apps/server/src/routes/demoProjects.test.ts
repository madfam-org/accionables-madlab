import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../config/database.js', () => ({
  db: {},
  pool: {},
  checkDatabaseConnection: vi.fn(),
  closeDatabaseConnection: vi.fn(),
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { demoProjectRoutes } from './demoProjects.js';

describe('demoProjectRoutes — GET /api/demo-projects', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(demoProjectRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('is public — no Authorization header required', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/demo-projects' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Six canonical demo templates.
    expect(body.data).toHaveLength(6);
  });

  it('returns each template with a fresh ISO event.date', async () => {
    const before = Date.now();
    const res = await app.inject({ method: 'GET', url: '/api/demo-projects' });
    const after = Date.now();
    const body = res.json();

    for (const project of body.data) {
      expect(typeof project.id).toBe('string');
      expect(typeof project.event.date).toBe('string');
      const eventTs = new Date(project.event.date).getTime();
      expect(Number.isFinite(eventTs)).toBe(true);
      // event.date is now + N days (always in the future relative to "now").
      expect(eventTs).toBeGreaterThan(before);
      // Bounded above by (now + 365 days) — sanity check, the max template
      // is 60 days out.
      expect(eventTs).toBeLessThan(after + 365 * 24 * 60 * 60 * 1000);
    }
  });

  it('returns the expected set of template ids', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/demo-projects' });
    const ids = res.json().data.map((p: { id: string }) => p.id).sort();
    expect(ids).toEqual(
      [
        'concert',
        'final-exam',
        'presentation',
        'product-launch',
        'retreat',
        'wedding',
      ].sort(),
    );
  });
});
