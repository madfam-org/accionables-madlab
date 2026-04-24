import { FastifyRequest, FastifyReply } from 'fastify';
import { createRemoteJWKSet, jwtVerify, errors as joseErrors, type JWTPayload as JoseJWTPayload } from 'jose';
import { getJanuaConfig } from '../config/auth.js';

export interface JWTPayload {
  sub: string;
  email: string;
  name?: string;
  email_verified?: boolean;
  org_id?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

const DEV_MOCK_TOKEN = 'dev-token-mock-user';

// Lazily-initialized JWKS so a bad/missing config fails loudly on first request,
// not at module load.
let jwksResolver: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksResolverKey: string | null = null;

function getJWKS(jwksUri: string) {
  if (jwksResolver && jwksResolverKey === jwksUri) return jwksResolver;
  jwksResolver = createRemoteJWKSet(new URL(jwksUri), {
    cacheMaxAge: 60 * 60 * 1000,
    cooldownDuration: 30 * 1000,
  });
  jwksResolverKey = jwksUri;
  return jwksResolver;
}

function toAppPayload(payload: JoseJWTPayload): JWTPayload {
  return {
    sub: String(payload.sub ?? ''),
    email: String(payload.email ?? ''),
    name: payload.name as string | undefined,
    email_verified: payload.email_verified as boolean | undefined,
    org_id: payload.org_id as string | undefined,
    roles: payload.roles as string[] | undefined,
    iat: payload.iat,
    exp: payload.exp,
  };
}

/**
 * JWT verification middleware with full RS256 signature verification via Janua JWKS.
 *
 * Dev mock (`dev-token-mock-user`) is only accepted when NODE_ENV === 'development'.
 * Production requires a valid Janua config and a signed token matching iss+aud.
 */
export async function verifyJWT(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.substring(7);

  // Dev-only escape hatch. Explicitly gated on NODE_ENV so a production misconfig
  // can't accidentally accept this string.
  if (isDevelopment && token === DEV_MOCK_TOKEN) {
    request.user = {
      sub: 'mock-user-id-12345',
      email: 'aldo@madlab.io',
      name: 'Aldo (Dev Mode)',
    };
    return;
  }

  const januaConfig = getJanuaConfig();
  if (!januaConfig) {
    // Fail closed: if Janua isn't configured, no real tokens can be verified.
    // Refuse rather than silently accepting unverified JWTs (the prior behavior).
    request.log.error('verifyJWT called but Janua is not configured (JANUA_ISSUER/AUDIENCE/JWKS_URI missing)');
    return reply.code(500).send({
      error: 'Server misconfigured',
      message: 'Authentication is not configured',
    });
  }

  try {
    const { payload } = await jwtVerify(token, getJWKS(januaConfig.jwksUri), {
      issuer: januaConfig.issuer,
      audience: januaConfig.audience,
      algorithms: ['RS256'],
    });
    request.user = toAppPayload(payload);
  } catch (error) {
    // Map jose's typed errors to a stable 401 response without leaking details.
    if (
      error instanceof joseErrors.JWTExpired ||
      error instanceof joseErrors.JWTClaimValidationFailed ||
      error instanceof joseErrors.JWSSignatureVerificationFailed ||
      error instanceof joseErrors.JWSInvalid ||
      error instanceof joseErrors.JWTInvalid
    ) {
      request.log.info({ err: error.code }, 'JWT rejected');
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
    request.log.error(error, 'JWT verification failed');
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Token verification failed',
    });
  }
}

/**
 * Optional auth — attaches user if a valid token is present, otherwise continues.
 * Still performs full signature verification when a token is supplied.
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return;

  const token = authHeader.substring(7);
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment && token === DEV_MOCK_TOKEN) {
    request.user = {
      sub: 'mock-user-id-12345',
      email: 'aldo@madlab.io',
      name: 'Aldo (Dev Mode)',
    };
    return;
  }

  const januaConfig = getJanuaConfig();
  if (!januaConfig) return; // no config → behave like no token

  try {
    const { payload } = await jwtVerify(token, getJWKS(januaConfig.jwksUri), {
      issuer: januaConfig.issuer,
      audience: januaConfig.audience,
      algorithms: ['RS256'],
    });
    request.user = toAppPayload(payload);
  } catch {
    // Intentionally silent — optional auth.
  }
}

export function requireRoles(...requiredRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRoles = request.user.roles || [];
    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Required roles: ${requiredRoles.join(', ')}`,
      });
    }
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}
