import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../config/database.js';
import { waitlist } from '../db/schema.js';
import { count, eq } from 'drizzle-orm';
import { verifyJWT, requireRoles } from '../middleware/auth.js';

// In-memory TTL cache for /waitlist/count. The endpoint is intentionally
// public ("social proof"), so it's a trivial DoS / DB-hammer surface without
// caching. 60s freshness is fine for a "1,200+ on the list" widget.
const WAITLIST_COUNT_TTL_MS = 60_000;
let waitlistCountCache: { value: number; fetchedAt: number } | null = null;

async function getWaitlistCount(): Promise<number> {
  const now = Date.now();
  if (waitlistCountCache && now - waitlistCountCache.fetchedAt < WAITLIST_COUNT_TTL_MS) {
    return waitlistCountCache.value;
  }
  const [{ value }] = await db.select({ value: count() }).from(waitlist);
  waitlistCountCache = { value, fetchedAt: now };
  return value;
}

// Test-only seam: clear the cache between assertions.
export function __resetWaitlistCountCacheForTests(): void {
  waitlistCountCache = null;
}

function bucketForDisplay(n: number): { displayCount: number; display: string } {
  if (n < 10) return { displayCount: n, display: `${n}` };
  if (n < 100) {
    const v = Math.floor(n / 10) * 10;
    return { displayCount: v, display: `${v}+` };
  }
  const v = Math.floor(n / 100) * 100;
  return { displayCount: v, display: `${v}+` };
}

// Validation schema
const waitlistSignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  source: z.string().max(100).default('landing'),
  referrer: z.string().max(2000).optional(),
  name: z.string().max(255).optional(),
  ndProfile: z.enum(['adhd', 'autism', 'dyslexia', 'other']).optional(),
  useCase: z.string().max(1000).optional(),
});

export async function waitlistRoutes(fastify: FastifyInstance) {
  /**
     * POST /api/waitlist
     * Sign up for the waitlist
     */
  fastify.post<{ Body: unknown }>('/waitlist', async (request, reply) => {
    const result = waitlistSignupSchema.safeParse(request.body);

    if (!result.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: result.error.errors,
      });
    }

    const { email, source, referrer, name, ndProfile, useCase } = result.data;

    try {
      // Check if email already exists
      const existing = await db
        .select({ id: waitlist.id })
        .from(waitlist)
        .where(eq(waitlist.email, email.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(200).send({
          success: true,
          message: 'You\'re already on the waitlist!',
          alreadySignedUp: true,
        });
      }

      // Get IP country from headers (set by proxy/CDN — Cloudflare in front
      // of enclii sets cf-ipcountry; x-country is a generic fallback some
      // CDNs use).
      const ipCountry = (request.headers['cf-ipcountry'] ||
                request.headers['x-country']) as string | undefined;

      // Insert new signup
      const [newSignup] = await db.insert(waitlist).values({
        email: email.toLowerCase(),
        source,
        referrer,
        name,
        ndProfile,
        useCase,
        ipCountry,
        userAgent: request.headers['user-agent'],
      }).returning({ id: waitlist.id, createdAt: waitlist.createdAt });

      fastify.log.info(`New waitlist signup: ${email} from ${source}`);

      return reply.code(201).send({
        success: true,
        message: 'You\'re on the list! We\'ll reach out when MADLAB is ready.',
        id: newSignup.id,
      });
    } catch (error) {
      // Handle unique constraint violation (race condition)
      if ((error as any)?.code === '23505') {
        return reply.code(200).send({
          success: true,
          message: 'You\'re already on the waitlist!',
          alreadySignedUp: true,
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to join waitlist',
      });
    }
  });

  /**
     * GET /api/waitlist/count
     * Get total waitlist signups (public — used as "social proof" on the
     * landing page). Cached server-side for WAITLIST_COUNT_TTL_MS to avoid
     * hammering the DB on every page view, and uses an aggregate COUNT(*)
     * instead of fetching every row.
     */
  fastify.get('/waitlist/count', async (_request, reply) => {
    try {
      const total = await getWaitlistCount();
      const { displayCount, display } = bucketForDisplay(total);
      return reply.send({ success: true, count: displayCount, display });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get count',
      });
    }
  });

  /**
     * GET /api/waitlist/stats (admin only)
     * Requires a Janua JWT with `admin` in the `roles` claim.
     */
  fastify.get(
    '/waitlist/stats',
    { preHandler: [verifyJWT, requireRoles('admin')] },
    async (_request, reply) => {
      try {
        const all = await db.select().from(waitlist);

        const stats = {
          total: all.length,
          bySource: {} as Record<string, number>,
          byNdProfile: {} as Record<string, number>,
          byDay: {} as Record<string, number>,
        };

        for (const signup of all) {
          // By source
          const src = signup.source || 'unknown';
          stats.bySource[src] = (stats.bySource[src] || 0) + 1;

          // By ND profile
          if (signup.ndProfile) {
            stats.byNdProfile[signup.ndProfile] = (stats.byNdProfile[signup.ndProfile] || 0) + 1;
          }

          // By day
          const day = signup.createdAt.toISOString().split('T')[0];
          stats.byDay[day] = (stats.byDay[day] || 0) + 1;
        }

        return reply.send({
          success: true,
          stats,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to get stats',
        });
      }
    });
}
