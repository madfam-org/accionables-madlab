import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyJWT, optionalAuth, requireRoles } from './auth.js';

type AnyReply = Pick<FastifyReply, 'code' | 'send'>;
type AnyRequest = Partial<FastifyRequest> & { log: any; headers: Record<string, string | undefined> };

function makeReply() {
  let statusCode = 200;
  let sent: unknown = undefined;
  const reply = {
    code(c: number) { statusCode = c; return reply as AnyReply; },
    send(payload: unknown) { sent = payload; return reply as AnyReply; },
  };
  return {
    reply: reply as AnyReply,
    get statusCode() { return statusCode; },
    get sent() { return sent; },
  };
}

const silentLog = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

function makeRequest(headers: Record<string, string | undefined> = {}): AnyRequest {
  return { headers, log: silentLog } as AnyRequest;
}

describe('verifyJWT — development mock token', () => {
  const OLD_ENV = { ...process.env };
  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development' };
    delete process.env.JANUA_ISSUER;
    delete process.env.JANUA_AUDIENCE;
    delete process.env.JANUA_JWKS_URI;
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('accepts the dev mock token and attaches a mock user', async () => {
    const r = makeReply();
    const req = makeRequest({ authorization: 'Bearer dev-token-mock-user' });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(200);
    expect((req as any).user?.sub).toBe('mock-user-id-12345');
  });

  it('rejects missing Authorization header', async () => {
    const r = makeReply();
    const req = makeRequest({});
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(401);
  });

  it('rejects non-Bearer scheme', async () => {
    const r = makeReply();
    const req = makeRequest({ authorization: 'Basic abc123' });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(401);
  });

  it('fails closed (500) when a non-mock token is presented and Janua is not configured', async () => {
    const r = makeReply();
    const req = makeRequest({ authorization: 'Bearer anything.else.here' });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    // Critical: previous implementation silently accepted unverified tokens here.
    expect(r.statusCode).toBe(500);
  });
});

describe('verifyJWT — production safety', () => {
  const OLD_ENV = { ...process.env };
  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production' };
    delete process.env.JANUA_ISSUER;
    delete process.env.JANUA_AUDIENCE;
    delete process.env.JANUA_JWKS_URI;
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('rejects the dev mock token in production', async () => {
    const r = makeReply();
    const req = makeRequest({ authorization: 'Bearer dev-token-mock-user' });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    // Must NOT return 200 — the mock token is a development-only escape hatch.
    expect(r.statusCode).not.toBe(200);
    expect((req as any).user).toBeUndefined();
  });

  it('fails closed when Janua is not configured', async () => {
    const r = makeReply();
    const req = makeRequest({ authorization: 'Bearer foo.bar.baz' });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(500);
  });
});

describe('verifyJWT — real RS256 signature verification', () => {
  const OLD_ENV = { ...process.env };
  const originalFetch = globalThis.fetch;

  // jose's generateKeyPair returns KeyLike; we don't import the type here to
  // avoid lib-dom dependency, and we only pass the key back to jose.
  let publicJwk: any;
  let privateKey: any;

  beforeEach(async () => {
    const { publicKey, privateKey: priv } = await generateKeyPair('RS256', { extractable: true });
    privateKey = priv;
    publicJwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };

    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      JANUA_ISSUER: 'https://test.janua.local',
      JANUA_AUDIENCE: 'madlab-api',
      JANUA_JWKS_URI: 'https://test.janua.local/.well-known/jwks.json',
    };

    // Stub fetch so createRemoteJWKSet sees our test key without real network.
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
  });
  afterEach(() => {
    process.env = OLD_ENV;
    globalThis.fetch = originalFetch;
  });

  async function sign(payload: Record<string, unknown>, overrides: { exp?: number; iss?: string; aud?: string } = {}) {
    const iss = overrides.iss ?? 'https://test.janua.local';
    const aud = overrides.aud ?? 'madlab-api';
    const jwt = new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(iss)
      .setAudience(aud)
      .setIssuedAt();
    if (overrides.exp !== undefined) {
      jwt.setExpirationTime(overrides.exp);
    } else {
      jwt.setExpirationTime('5m');
    }
    return jwt.sign(privateKey);
  }

  it('accepts a validly-signed token and attaches user claims', async () => {
    const token = await sign({
      sub: 'janua-user-42',
      email: 'user@example.com',
      name: 'Test User',
      roles: ['member'],
    });
    const r = makeReply();
    const req = makeRequest({ authorization: `Bearer ${token}` });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(200);
    expect((req as any).user?.sub).toBe('janua-user-42');
    expect((req as any).user?.email).toBe('user@example.com');
    expect((req as any).user?.roles).toEqual(['member']);
  });

  it('rejects an expired token', async () => {
    const token = await sign({ sub: 'u1', email: 'e@x' }, { exp: Math.floor(Date.now() / 1000) - 60 });
    const r = makeReply();
    const req = makeRequest({ authorization: `Bearer ${token}` });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(401);
  });

  it('rejects a wrong issuer', async () => {
    const token = await sign({ sub: 'u1', email: 'e@x' }, { iss: 'https://evil.example.com' });
    const r = makeReply();
    const req = makeRequest({ authorization: `Bearer ${token}` });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(401);
  });

  it('rejects a wrong audience', async () => {
    const token = await sign({ sub: 'u1', email: 'e@x' }, { aud: 'some-other-api' });
    const r = makeReply();
    const req = makeRequest({ authorization: `Bearer ${token}` });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(401);
  });

  it('rejects a token signed with a different key', async () => {
    const { privateKey: otherKey } = await generateKeyPair('RS256', { extractable: true });
    const bad = await new SignJWT({ sub: 'u1', email: 'e@x' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://test.janua.local')
      .setAudience('madlab-api')
      .setExpirationTime('5m')
      .sign(otherKey);
    const r = makeReply();
    const req = makeRequest({ authorization: `Bearer ${bad}` });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(401);
  });

  it('rejects a syntactically invalid token', async () => {
    const r = makeReply();
    const req = makeRequest({ authorization: 'Bearer not.a.jwt' });
    await verifyJWT(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(401);
  });
});

describe('requireRoles', () => {
  it('401s when no user on the request', async () => {
    const r = makeReply();
    const req = makeRequest({});
    await requireRoles('admin')(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(401);
  });

  it('403s when user lacks the required role', async () => {
    const r = makeReply();
    const req = makeRequest({});
    (req as any).user = { sub: 'u', email: 'e@x', roles: ['member'] };
    await requireRoles('admin')(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(403);
  });

  it('passes when user has at least one required role', async () => {
    const r = makeReply();
    const req = makeRequest({});
    (req as any).user = { sub: 'u', email: 'e@x', roles: ['admin'] };
    await requireRoles('admin', 'owner')(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(200);
  });
});

describe('optionalAuth', () => {
  const OLD_ENV = { ...process.env };
  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development' };
    delete process.env.JANUA_ISSUER;
    delete process.env.JANUA_AUDIENCE;
    delete process.env.JANUA_JWKS_URI;
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('is a no-op when no Authorization header is present', async () => {
    const r = makeReply();
    const req = makeRequest({});
    await optionalAuth(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(200);
    expect((req as any).user).toBeUndefined();
  });

  it('attaches dev-mock user when the mock token is provided in dev', async () => {
    const r = makeReply();
    const req = makeRequest({ authorization: 'Bearer dev-token-mock-user' });
    await optionalAuth(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(200);
    expect((req as any).user?.sub).toBe('mock-user-id-12345');
  });

  it('silently ignores an invalid token without 401ing', async () => {
    const r = makeReply();
    const req = makeRequest({ authorization: 'Bearer garbage' });
    await optionalAuth(req as FastifyRequest, r.reply as FastifyReply);
    expect(r.statusCode).toBe(200);
    expect((req as any).user).toBeUndefined();
  });
});
