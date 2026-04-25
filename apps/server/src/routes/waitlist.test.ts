import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { dbStub } = vi.hoisted(() => ({
  dbStub: { select: vi.fn(), insert: vi.fn() },
}));
vi.mock('../config/database.js', () => ({
  db: dbStub,
  pool: {},
  checkDatabaseConnection: vi.fn(),
  closeDatabaseConnection: vi.fn(),
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { waitlistRoutes, __resetWaitlistCountCacheForTests } from './waitlist.js';

function mockCountQuery(value: number, calls = { n: 0 }) {
  dbStub.select.mockImplementationOnce(() => {
    calls.n += 1;
    const builder: any = {
      from: () => Promise.resolve([{ value }]),
    };
    return builder;
  });
}

describe('GET /waitlist/count', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(waitlistRoutes, { prefix: '/api' });
    await app.ready();
    dbStub.select.mockReset();
    __resetWaitlistCountCacheForTests();
  });
  afterEach(async () => { await app.close(); });

  it('returns the exact count when below 10 (no bucket)', async () => {
    mockCountQuery(3);
    const res = await app.inject({ method: 'GET', url: '/api/waitlist/count' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, count: 3, display: '3' });
  });

  it('buckets to nearest 10 when 10..99', async () => {
    mockCountQuery(57);
    const res = await app.inject({ method: 'GET', url: '/api/waitlist/count' });
    expect(res.json()).toMatchObject({ count: 50, display: '50+' });
  });

  it('buckets to nearest 100 when ≥ 100', async () => {
    mockCountQuery(1234);
    const res = await app.inject({ method: 'GET', url: '/api/waitlist/count' });
    expect(res.json()).toMatchObject({ count: 1200, display: '1200+' });
  });

  it('caches the count — second call within TTL does NOT hit the DB', async () => {
    const calls = { n: 0 };
    mockCountQuery(42, calls);

    const r1 = await app.inject({ method: 'GET', url: '/api/waitlist/count' });
    const r2 = await app.inject({ method: 'GET', url: '/api/waitlist/count' });

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r1.json().count).toBe(40);
    expect(r2.json().count).toBe(40);
    // Only one DB call across two requests — proves the cache is doing its job.
    expect(dbStub.select).toHaveBeenCalledTimes(1);
  });

  it('refetches when the cache is reset (simulates TTL expiry)', async () => {
    mockCountQuery(10);
    await app.inject({ method: 'GET', url: '/api/waitlist/count' });

    __resetWaitlistCountCacheForTests();
    mockCountQuery(20);
    const r2 = await app.inject({ method: 'GET', url: '/api/waitlist/count' });

    expect(r2.json().count).toBe(20);
    expect(dbStub.select).toHaveBeenCalledTimes(2);
  });

  it('uses an aggregate COUNT(*) — does not load rows into memory', async () => {
    // Regression guard: the previous implementation did `select({id}).from(waitlist)`
    // and then `.length` — O(N) row fetch per request. The new code passes a
    // value-aliased aggregate; we capture the select() argument shape.
    let capturedSelect: any = undefined;
    dbStub.select.mockImplementationOnce((arg: any) => {
      capturedSelect = arg;
      const builder: any = { from: () => Promise.resolve([{ value: 7 }]) };
      return builder;
    });

    await app.inject({ method: 'GET', url: '/api/waitlist/count' });

    expect(capturedSelect).toBeDefined();
    // The shape is { value: count() }; the value field's type comes from drizzle.
    // We just assert the key exists — that proves we're not selecting `id`.
    expect(Object.keys(capturedSelect)).toEqual(['value']);
  });
});
