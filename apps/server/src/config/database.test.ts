import { describe, it, expect, vi } from 'vitest';
import {
  resolveSslDecision,
  buildPoolConfig,
  pingDatabase,
  waitForDatabase,
} from './database.js';

// ---------------------------------------------------------------------------
// SSL resolution
// ---------------------------------------------------------------------------

describe('resolveSslDecision', () => {
  it('disables SSL when sslmode is absent', () => {
    const d = resolveSslDecision('postgresql://u:p@h/db');
    expect(d.enabled).toBe(false);
    expect(d.sslmode).toBeNull();
  });

  it('disables SSL when sslmode=disable', () => {
    const d = resolveSslDecision('postgresql://u:p@h/db?sslmode=disable');
    expect(d.enabled).toBe(false);
  });

  it('enables SSL when sslmode=require', () => {
    const d = resolveSslDecision('postgresql://u:p@h/db?sslmode=require', {});
    expect(d.enabled).toBe(true);
    // Default secure: require cert validation.
    expect(d.rejectUnauthorized).toBe(true);
  });

  it('enables SSL when sslmode=prefer', () => {
    const d = resolveSslDecision('postgresql://u:p@h/db?sslmode=prefer', {});
    expect(d.enabled).toBe(true);
    expect(d.rejectUnauthorized).toBe(true);
  });

  it('forces rejectUnauthorized=true for verify-full regardless of env override', () => {
    const d = resolveSslDecision('postgresql://u:p@h/db?sslmode=verify-full', {
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
    } as NodeJS.ProcessEnv);
    expect(d.enabled).toBe(true);
    expect(d.rejectUnauthorized).toBe(true);
  });

  it('forces rejectUnauthorized=true for verify-ca regardless of env override', () => {
    const d = resolveSslDecision('postgresql://u:p@h/db?sslmode=verify-ca', {
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
    } as NodeJS.ProcessEnv);
    expect(d.rejectUnauthorized).toBe(true);
  });

  it('honors DATABASE_SSL_REJECT_UNAUTHORIZED=false for require', () => {
    const d = resolveSslDecision('postgresql://u:p@h/db?sslmode=require', {
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
    } as NodeJS.ProcessEnv);
    expect(d.enabled).toBe(true);
    expect(d.rejectUnauthorized).toBe(false);
  });

  it('does NOT silently disable validation on a typo of the env var', () => {
    const d = resolveSslDecision('postgresql://u:p@h/db?sslmode=require', {
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'no', // not "false"
    } as NodeJS.ProcessEnv);
    expect(d.rejectUnauthorized).toBe(true);
  });

  it('treats an unparseable URL as no-SSL (conservative fallback)', () => {
    const d = resolveSslDecision('not-a-url');
    expect(d.enabled).toBe(false);
  });
});

describe('buildPoolConfig', () => {
  it('omits ssl when SSL is disabled', () => {
    const cfg = buildPoolConfig('postgresql://u:p@h/db');
    expect(cfg.ssl).toBeUndefined();
    expect(cfg.connectionString).toContain('postgresql://');
  });

  it('sets ssl.rejectUnauthorized=true by default when SSL is enabled', () => {
    const cfg = buildPoolConfig('postgresql://u:p@h/db?sslmode=require', {});
    expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('passes through rejectUnauthorized=false when explicitly opted-in', () => {
    const cfg = buildPoolConfig('postgresql://u:p@h/db?sslmode=require', {
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
    } as NodeJS.ProcessEnv);
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
  });
});

// ---------------------------------------------------------------------------
// pingDatabase
// ---------------------------------------------------------------------------

describe('pingDatabase', () => {
  it('returns ok=true when SELECT 1 succeeds', async () => {
    const fakePool = { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) };
    const result = await pingDatabase(500, fakePool as never);
    expect(result).toEqual({ ok: true });
    expect(fakePool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns ok=false with error when query rejects', async () => {
    const fakePool = { query: vi.fn().mockRejectedValue(new Error('connection refused')) };
    const result = await pingDatabase(500, fakePool as never);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/connection refused/);
  });

  it('returns ok=false on timeout when query hangs', async () => {
    // Query that never resolves — timeout should fire first.
    const fakePool = {
      query: vi.fn().mockImplementation(() => new Promise(() => {})),
    };
    const result = await pingDatabase(20, fakePool as never);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timed out after 20ms/);
  });
});

// ---------------------------------------------------------------------------
// waitForDatabase — retry / backoff
// ---------------------------------------------------------------------------

describe('waitForDatabase', () => {
  it('returns immediately when the first attempt succeeds', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const sleep = vi.fn().mockResolvedValue(undefined);
    await waitForDatabase({
      poolOverride: { query } as never,
      sleep,
      attemptTimeoutMs: 100,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries with exponential backoff and eventually succeeds', async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ rows: [] });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onAttempt = vi.fn();

    await waitForDatabase({
      poolOverride: { query } as never,
      sleep,
      onAttempt,
      initialDelayMs: 10,
      maxDelayMs: 80,
      totalTimeoutMs: 5_000,
      attemptTimeoutMs: 100,
    });

    expect(query).toHaveBeenCalledTimes(3);
    // Two failures => two sleeps before the successful third attempt.
    expect(sleep).toHaveBeenCalledTimes(2);
    // Exponential backoff: first sleep ~10ms, second ~20ms.
    expect(sleep.mock.calls[0]?.[0]).toBe(10);
    expect(sleep.mock.calls[1]?.[0]).toBe(20);
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });

  it('caps the per-attempt delay at maxDelayMs', async () => {
    const query = vi.fn().mockRejectedValue(new Error('boom'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    // Force timeout via a stubbed clock so we don't actually wait.
    const realNow = Date.now;
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    sleep.mockImplementation(async (ms: number) => {
      now += ms;
    });

    try {
      await expect(
        waitForDatabase({
          poolOverride: { query } as never,
          sleep,
          initialDelayMs: 100,
          maxDelayMs: 200,
          totalTimeoutMs: 1000,
          attemptTimeoutMs: 50,
        }),
      ).rejects.toThrow(/not reachable/);

      // Delays: 100, 200, 200, 200, 200... none should exceed maxDelayMs.
      const delays = sleep.mock.calls.map((c) => c[0] as number);
      expect(delays.length).toBeGreaterThan(0);
      for (const d of delays) {
        expect(d).toBeLessThanOrEqual(200);
      }
      // First delay is the initial value.
      expect(delays[0]).toBe(100);
      // Subsequent delays are capped.
      if (delays.length > 1) expect(delays[1]).toBe(200);
    } finally {
      vi.spyOn(Date, 'now').mockRestore();
      // restore in case spyOn pattern above is flaky across versions
      Date.now = realNow;
    }
  });

  it('throws after exhausting the total timeout', async () => {
    const query = vi.fn().mockRejectedValue(new Error('refused'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    let now = 0;
    const realNow = Date.now;
    Date.now = () => now;
    sleep.mockImplementation(async (ms: number) => {
      now += ms;
    });

    try {
      await expect(
        waitForDatabase({
          poolOverride: { query } as never,
          sleep,
          initialDelayMs: 100,
          maxDelayMs: 100,
          totalTimeoutMs: 350,
          attemptTimeoutMs: 50,
        }),
      ).rejects.toThrow(/Database is not reachable.*refused/);
      // With 100ms delays inside a 350ms budget we expect ~4 attempts.
      expect(query.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(query.mock.calls.length).toBeLessThanOrEqual(5);
    } finally {
      Date.now = realNow;
    }
  });
});
