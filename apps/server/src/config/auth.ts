/**
 * Janua Authentication Configuration
 *
 * This module configures JWT verification for Janua IdP integration.
 * Janua is an open-source authentication platform (https://github.com/madfam-io/janua)
 */

export interface JanuaConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
}

// JSON Web Key type (RS256)
export interface JWK {
  kty: string;           // Key type (e.g., "RSA")
  use?: string;          // Public key use (e.g., "sig")
  kid?: string;          // Key ID
  alg?: string;          // Algorithm (e.g., "RS256")
  n?: string;            // RSA modulus
  e?: string;            // RSA exponent
  x5c?: string[];        // X.509 certificate chain
  x5t?: string;          // X.509 certificate thumbprint
}

export interface JanuaUser {
  sub: string;           // Janua user ID
  email: string;         // User email
  email_verified: boolean;
  name?: string;         // Display name
  given_name?: string;   // First name
  family_name?: string;  // Last name
  picture?: string;      // Avatar URL
  org_id?: string;       // Organization ID (for multi-tenant)
  roles?: string[];      // RBAC roles
  iat: number;           // Issued at
  exp: number;           // Expiration
}

/**
 * Get Janua configuration from environment
 */
export function getJanuaConfig(): JanuaConfig | null {
  const issuer = process.env.JANUA_ISSUER;
  const audience = process.env.JANUA_AUDIENCE;
  const jwksUri = process.env.JANUA_JWKS_URI;

  if (!issuer || !audience || !jwksUri) {
    return null;
  }

  return { issuer, audience, jwksUri };
}

/**
 * Check if Janua is configured
 */
export function isJanuaConfigured(): boolean {
  return getJanuaConfig() !== null;
}

/**
 * JWKS cache for performance
 */
interface JWKSCache {
  keys: JWK[];
  fetchedAt: number;
  ttl: number; // milliseconds
}

let jwksCache: JWKSCache | null = null;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch JWKS from Janua with caching
 */
export async function fetchJWKS(): Promise<JWK[]> {
  const config = getJanuaConfig();
  if (!config) {
    throw new Error('Janua not configured');
  }

  // Check cache
  if (jwksCache && Date.now() - jwksCache.fetchedAt < jwksCache.ttl) {
    return jwksCache.keys;
  }

  // Fetch fresh JWKS
  try {
    const response = await fetch(config.jwksUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }

    const data = await response.json() as { keys: JWK[] };

    // Update cache
    jwksCache = {
      keys: data.keys,
      fetchedAt: Date.now(),
      ttl: JWKS_CACHE_TTL,
    };

    return data.keys;
  } catch (error) {
    // If we have stale cache, use it as fallback
    if (jwksCache) {
      console.warn('Using stale JWKS cache due to fetch error:', error);
      return jwksCache.keys;
    }
    throw error;
  }
}

/**
 * Clear JWKS cache (useful for testing or key rotation)
 */
export function clearJWKSCache(): void {
  jwksCache = null;
}
