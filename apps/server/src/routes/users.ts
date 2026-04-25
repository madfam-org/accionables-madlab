import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users } from '../db/schema.js';
import { verifyJWT } from '../middleware/auth.js';
import { DEFAULT_TEAM_MEMBERS } from '../data/teamMembers.js';

/**
 * Users route — local-cache-of-Janua-users read endpoint.
 *
 * Auth posture: authenticated. Returns the project's team members.
 *
 * Behavior:
 *   - Returns active rows from the `users` table (canonical).
 *   - If the table has no active users (fresh DB / no one has signed in
 *     yet), falls back to `DEFAULT_TEAM_MEMBERS` so the dashboard still
 *     renders. The fallback rows have no `id` field (since they don't
 *     exist in the DB yet) — clients should not assume `id` is present.
 */
export async function userRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/users
   * Returns active team members. Each row contains:
   *   { id?, name, role, roleEn, avatar }
   * `id` is present for real DB rows, absent for the static fallback.
   */
  fastify.get('/users', { preHandler: verifyJWT }, async (_request, reply) => {
    try {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          displayName: users.displayName,
          role: users.role,
          avatarUrl: users.avatarUrl,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.isActive, true));

      if (rows.length === 0) {
        // Fresh / empty DB: surface the canonical seed list so the UI has
        // something to render. Once any real user signs in, the table will
        // start populating and this branch stops firing.
        return reply.send({
          success: true,
          data: DEFAULT_TEAM_MEMBERS.map((m) => ({
            name: m.name,
            role: m.role,
            roleEn: m.roleEn,
            avatar: m.avatar,
          })),
          source: 'fallback',
        });
      }

      // Map DB rows into the shape the client expects. The `users` table
      // doesn't track Spanish vs English role variants today, so we surface
      // `role` for both `role` and `roleEn`. When/if a bilingual role
      // schema is added, this is the seam to update.
      const data = rows.map((u) => ({
        id: u.id,
        name: u.displayName ?? u.name,
        role: u.role ?? 'member',
        roleEn: u.role ?? 'member',
        avatar: u.avatarUrl ?? '👤',
      }));

      return reply.send({
        success: true,
        data,
        source: 'db',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch users',
      });
    }
  });
}
