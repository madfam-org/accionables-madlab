import { eq, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users } from '../db/schema.js';
import type { JWTPayload } from '../middleware/auth.js';

/**
 * Upsert the local `users` row that mirrors a Janua identity.
 *
 * Called on every authenticated request that needs a local user UUID
 * (createdBy, assigneeId, etc). Uses a single ON CONFLICT statement so
 * there is no read-then-write race between concurrent requests for the
 * same janua_id.
 *
 * Returns the local `users.id` (UUID).
 *
 * NOTE on email collisions: the users table has a UNIQUE on email as well
 * as janua_id. If a new janua_id arrives with an email already bound to a
 * different janua_id, this upsert will fail on the email index. That is
 * an account-linking concern and is out of scope here — it requires
 * product policy (auto-link? refuse? ask user?). For now, the error
 * surfaces as a 500 and the caller should handle it.
 */
export async function upsertLocalUser(payload: JWTPayload): Promise<string> {
  if (!payload.sub) {
    throw new Error('Cannot upsert local user: JWT payload has no sub claim');
  }
  if (!payload.email) {
    throw new Error('Cannot upsert local user: JWT payload has no email claim');
  }

  const januaId = payload.sub;
  const email = payload.email.toLowerCase();
  const name = payload.name ?? email;

  const result = await db
    .insert(users)
    .values({
      januaId,
      email,
      name,
      role: 'member',
      isActive: true,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.januaId,
      set: {
        email,
        name,
        lastSeenAt: new Date(),
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: users.id });

  if (!result.length) {
    // Should be impossible with ON CONFLICT DO UPDATE ... RETURNING, but
    // guard anyway so a future schema change doesn't silently drop the row.
    throw new Error(`Failed to upsert local user for januaId=${januaId}`);
  }

  return result[0].id;
}

/**
 * Look up a local user id by Janua sub WITHOUT creating one. Returns null
 * if no local row exists. Useful for read paths where you don't want to
 * touch the write path.
 */
export async function findLocalUserIdByJanuaId(januaId: string): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.januaId, januaId))
    .limit(1);
  return rows[0]?.id ?? null;
}
