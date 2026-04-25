import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema.js';

const { Pool } = pg;

// ============================================================================
// SSL resolution
// ----------------------------------------------------------------------------
// Drive SSL config off the DATABASE_URL so operators control it the same way
// they would with psql/libpq. We do NOT silently disable certificate validation
// — `rejectUnauthorized` defaults to `true` and is overridable via an explicit
// env flag (DATABASE_SSL_REJECT_UNAUTHORIZED=false). This avoids the common
// foot-gun where a "make SSL work" change accidentally accepts any cert.
// ============================================================================

/**
 * sslmode values that imply an encrypted connection. Mirrors libpq:
 *   disable, allow → no SSL
 *   prefer, require, verify-ca, verify-full → SSL
 * If sslmode is missing we default to no SSL (matches local docker-compose).
 */
const SSL_ENABLING_MODES = new Set(['prefer', 'require', 'verify-ca', 'verify-full']);

export interface SslDecision {
  enabled: boolean;
  /** Only meaningful when enabled. Defaults to true (secure). */
  rejectUnauthorized: boolean;
  /** Mode actually parsed from URL — useful for logging. */
  sslmode: string | null;
}

/**
 * Inspect a DATABASE_URL and decide if/how SSL should be configured.
 * Pure function so it's trivially unit-testable.
 */
export function resolveSslDecision(
  databaseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): SslDecision {
  let sslmode: string | null = null;
  try {
    // pg connection strings are URL-shaped; URL parses them fine.
    const url = new URL(databaseUrl);
    sslmode = url.searchParams.get('sslmode');
  } catch {
    // Not a URL we can parse — be conservative and assume no SSL hint.
    sslmode = null;
  }

  const enabled = sslmode !== null && SSL_ENABLING_MODES.has(sslmode);
  if (!enabled) {
    return { enabled: false, rejectUnauthorized: true, sslmode };
  }

  // verify-ca / verify-full always require cert validation regardless of env.
  if (sslmode === 'verify-ca' || sslmode === 'verify-full') {
    return { enabled: true, rejectUnauthorized: true, sslmode };
  }

  // For prefer/require, allow operators to opt out of validation explicitly.
  // Default is `true` — fail closed, never accept any cert silently.
  const flag = env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  const rejectUnauthorized = flag === undefined ? true : flag.toLowerCase() !== 'false';
  return { enabled: true, rejectUnauthorized, sslmode };
}

/**
 * Build the pg.PoolConfig from a connection string. Exported for tests.
 */
export function buildPoolConfig(
  databaseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): pg.PoolConfig {
  const ssl = resolveSslDecision(databaseUrl, env);
  const config: pg.PoolConfig = {
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
  if (ssl.enabled) {
    config.ssl = { rejectUnauthorized: ssl.rejectUnauthorized };
  }
  return config;
}

// ============================================================================
// Pool / Drizzle bootstrap
// ============================================================================

const connectionString =
  process.env.DATABASE_URL || 'postgresql://madlab:madlab@postgres:5432/madlab';

export const pool = new Pool(buildPoolConfig(connectionString));

// Initialize Drizzle ORM with schema
export const db = drizzle(pool, { schema });

// ============================================================================
// Health check
// ----------------------------------------------------------------------------
// Used by both the readiness probe and the periodic health endpoint. We accept
// an AbortSignal-style timeout so the HTTP handler can fail fast rather than
// stack up requests against a sick pool.
// ============================================================================

export interface DbHealthResult {
  ok: boolean;
  /** Populated only when ok=false. Stringified, never the raw error object. */
  error?: string;
}

/**
 * Run `SELECT 1` against the pool with an upper-bound timeout.
 * Default timeout is intentionally short (500ms) — health checks must be fast.
 */
export async function pingDatabase(
  timeoutMs = 500,
  poolOverride: Pick<pg.Pool, 'query'> = pool,
): Promise<DbHealthResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`database ping timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    // Don't keep the event loop alive just for this timer.
    timer.unref?.();
  });

  try {
    await Promise.race([poolOverride.query('SELECT 1'), timeout]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Legacy boolean health check kept for backward compatibility with existing
 * test mocks (projects.test.ts, tasks.test.ts, users.test.ts mock this name).
 * New code should prefer pingDatabase().
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  const result = await pingDatabase();
  return result.ok;
}

// ============================================================================
// Startup readiness with exponential backoff
// ----------------------------------------------------------------------------
// K8s cold-starts routinely race the API ahead of the DB. Rather than crash
// loop and spam restarts, retry SELECT 1 with bounded exponential backoff
// before giving up. Total budget ~30s so we surface real outages quickly.
// ============================================================================

export interface WaitForDatabaseOptions {
  /** Initial delay between attempts in ms. */
  initialDelayMs?: number;
  /** Per-attempt cap on the delay. */
  maxDelayMs?: number;
  /** Total wall-clock budget across all attempts and waits. */
  totalTimeoutMs?: number;
  /** Per-attempt query timeout. */
  attemptTimeoutMs?: number;
  /** Override pool (for tests). */
  poolOverride?: Pick<pg.Pool, 'query'>;
  /** Override sleep (for tests — keeps unit tests fast). */
  sleep?: (ms: number) => Promise<void>;
  /** Optional observer hook for logging attempts. */
  onAttempt?: (info: { attempt: number; error: string; nextDelayMs: number }) => void;
}

type DefaultableKeys = 'initialDelayMs' | 'maxDelayMs' | 'totalTimeoutMs' | 'attemptTimeoutMs';
const DEFAULTS: Required<Pick<WaitForDatabaseOptions, DefaultableKeys>> = {
  initialDelayMs: 500,
  maxDelayMs: 5000,
  totalTimeoutMs: 30_000,
  attemptTimeoutMs: 2_000,
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });

/**
 * Block until the database accepts SELECT 1 or the total timeout elapses.
 * Throws on final failure — callers should treat that as fatal and exit.
 */
export async function waitForDatabase(opts: WaitForDatabaseOptions = {}): Promise<void> {
  const initialDelayMs = opts.initialDelayMs ?? DEFAULTS.initialDelayMs;
  const maxDelayMs = opts.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const totalTimeoutMs = opts.totalTimeoutMs ?? DEFAULTS.totalTimeoutMs;
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? DEFAULTS.attemptTimeoutMs;
  const sleep = opts.sleep ?? defaultSleep;

  const start = Date.now();
  let attempt = 0;
  let delay = initialDelayMs;
  let lastError = 'unknown error';

  // We measure budget against wall-clock so a single slow attempt can't blow
  // past the cap. The first attempt runs immediately (no leading sleep).
  while (Date.now() - start < totalTimeoutMs) {
    attempt += 1;
    const result = await pingDatabase(attemptTimeoutMs, opts.poolOverride ?? pool);
    if (result.ok) return;

    lastError = result.error ?? 'unknown error';

    const elapsed = Date.now() - start;
    const remaining = totalTimeoutMs - elapsed;
    if (remaining <= 0) break;

    const nextDelay = Math.min(delay, maxDelayMs, remaining);
    opts.onAttempt?.({ attempt, error: lastError, nextDelayMs: nextDelay });

    await sleep(nextDelay);
    delay = Math.min(delay * 2, maxDelayMs);
  }

  throw new Error(
    `Database is not reachable after ${attempt} attempts in ${
      Date.now() - start
    }ms. Last error: ${lastError}`,
  );
}

// ============================================================================
// Graceful shutdown
// ============================================================================

export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}
