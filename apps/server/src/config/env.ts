import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a number')
    .default('3001')
    .transform(Number),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ALLOWED_ORIGINS: z.string().optional(),
  JANUA_ISSUER: z.string().url().optional(),
  JANUA_AUDIENCE: z.string().optional(),
  JANUA_JWKS_URI: z.string().url().optional(),
});

export type Env = z.output<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = ['Invalid environment configuration:'];
    for (const issue of result.error.issues) {
      lines.push(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error(lines.join('\n'));
  }
  return result.data;
}

/**
 * Resolve the CORS allowlist. In production, refuses an empty list so the
 * operator is forced to set ALLOWED_ORIGINS explicitly rather than silently
 * locking every browser out.
 */
export function resolveCorsOrigins(env: Env): string[] {
  if (env.NODE_ENV !== 'production') {
    return ['http://localhost:5173', 'http://localhost:3000'];
  }
  const parsed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parsed.length === 0) {
    throw new Error(
      'ALLOWED_ORIGINS is empty in production. Refusing to start with an ' +
        'empty CORS allowlist — every browser request would silently fail. ' +
        'Set ALLOWED_ORIGINS to a comma-separated list of trusted origins.',
    );
  }
  return parsed;
}

/**
 * Production requires Janua configuration. verifyJWT already fails closed at
 * request time, but surfacing this at boot gives operators a clearer signal.
 */
export function assertJanuaConfiguredIfProduction(env: Env): void {
  if (env.NODE_ENV !== 'production') return;
  if (!env.JANUA_ISSUER || !env.JANUA_AUDIENCE || !env.JANUA_JWKS_URI) {
    throw new Error(
      'JANUA_ISSUER / JANUA_AUDIENCE / JANUA_JWKS_URI are required in production ' +
        'for JWT verification. Refusing to start — without these, verifyJWT fails ' +
        'closed on every authenticated request.',
    );
  }
}
