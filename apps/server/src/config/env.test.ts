import { describe, it, expect } from 'vitest';
import { parseEnv, resolveCorsOrigins, assertJanuaConfiguredIfProduction } from './env.js';

describe('parseEnv', () => {
  it('applies defaults for development', () => {
    const env = parseEnv({ DATABASE_URL: 'postgresql://u:p@h/db' } as any);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.HOST).toBe('0.0.0.0');
  });

  it('coerces PORT from a numeric string', () => {
    const env = parseEnv({ PORT: '8080', DATABASE_URL: 'x' } as any);
    expect(env.PORT).toBe(8080);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => parseEnv({ PORT: 'abc', DATABASE_URL: 'x' } as any)).toThrow(/PORT/);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({} as any)).toThrow(/DATABASE_URL/);
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() =>
      parseEnv({ NODE_ENV: 'staging', DATABASE_URL: 'x' } as any),
    ).toThrow();
  });

  it('rejects a malformed JANUA_JWKS_URI', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'x',
        JANUA_JWKS_URI: 'not-a-url',
      } as any),
    ).toThrow();
  });

  it('accepts an absent SENTRY_DSN — observability is optional in dev', () => {
    const env = parseEnv({ DATABASE_URL: 'x' } as any);
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it('accepts a valid SENTRY_DSN URL', () => {
    const env = parseEnv({
      DATABASE_URL: 'x',
      SENTRY_DSN: 'https=//abc@o0.ingest.sentry.io/1'.replace('=', ':'),
    } as any);
    expect(env.SENTRY_DSN).toBe('https://abc@o0.ingest.sentry.io/1');
  });

  it('rejects a malformed SENTRY_DSN', () => {
    expect(() =>
      parseEnv({ DATABASE_URL: 'x', SENTRY_DSN: 'not-a-url' } as any),
    ).toThrow(/SENTRY_DSN/);
  });
});

describe('resolveCorsOrigins', () => {
  it('returns localhost defaults in development', () => {
    const env = parseEnv({ DATABASE_URL: 'x' } as any);
    expect(resolveCorsOrigins(env)).toEqual([
      'http://localhost:5173',
      'http://localhost:3000',
    ]);
  });

  it('parses comma-separated ALLOWED_ORIGINS in production', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'x',
      ALLOWED_ORIGINS: 'https://madlab.app, https://app.madlab.io',
      JANUA_ISSUER: 'https://auth.example.com',
      JANUA_AUDIENCE: 'madlab-api',
      JANUA_JWKS_URI: 'https://auth.example.com/.well-known/jwks.json',
    } as any);
    expect(resolveCorsOrigins(env)).toEqual([
      'https://madlab.app',
      'https://app.madlab.io',
    ]);
  });

  it('REFUSES an empty ALLOWED_ORIGINS in production — regression guard for silent CORS fail', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'x',
      JANUA_ISSUER: 'https://a.example.com',
      JANUA_AUDIENCE: 'a',
      JANUA_JWKS_URI: 'https://a.example.com/jwks',
    } as any);
    expect(() => resolveCorsOrigins(env)).toThrow(/ALLOWED_ORIGINS is empty/);
  });

  it('treats whitespace-only ALLOWED_ORIGINS as empty in production', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'x',
      ALLOWED_ORIGINS: ' , , ',
      JANUA_ISSUER: 'https://a.example.com',
      JANUA_AUDIENCE: 'a',
      JANUA_JWKS_URI: 'https://a.example.com/jwks',
    } as any);
    expect(() => resolveCorsOrigins(env)).toThrow(/ALLOWED_ORIGINS/);
  });
});

describe('assertJanuaConfiguredIfProduction', () => {
  it('is a no-op in development even when Janua vars are missing', () => {
    const env = parseEnv({ DATABASE_URL: 'x' } as any);
    expect(() => assertJanuaConfiguredIfProduction(env)).not.toThrow();
  });

  it('throws in production if any Janua var is missing', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'x',
      JANUA_ISSUER: 'https://a.example.com',
      JANUA_AUDIENCE: 'a',
      // JANUA_JWKS_URI intentionally missing
    } as any);
    expect(() => assertJanuaConfiguredIfProduction(env)).toThrow(/JANUA_/);
  });

  it('passes in production when all three Janua vars are set', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'x',
      JANUA_ISSUER: 'https://a.example.com',
      JANUA_AUDIENCE: 'a',
      JANUA_JWKS_URI: 'https://a.example.com/jwks',
    } as any);
    expect(() => assertJanuaConfiguredIfProduction(env)).not.toThrow();
  });
});
