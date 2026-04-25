#!/usr/bin/env tsx
/**
 * Database Seed Script
 *
 * Migrates all legacy static tasks (110 rows across 5 phases, see
 * `data/legacyTasks.ts`) into the `tasks` table, plus the 5 team members and
 * the canonical "MADLAB Educational Platform" project.
 *
 * Idempotent — re-running the seed never duplicates rows. Dedup keys:
 *   - users:           by `email`        (`{name}@madlab.mx`)
 *   - projects:        by `name`         ("MADLAB Educational Platform")
 *   - project_members: by (projectId, userId)
 *   - tasks:           by `legacyId`     ("phase.section.index", e.g. "1.1.1")
 *
 * Usage:
 *   npm run seed
 *   or
 *   tsx src/scripts/seed.ts
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { eq, and } from 'drizzle-orm';
import { users, projects, tasks, projectMembers } from '../db/schema.js';
import { DEFAULT_TEAM_MEMBERS } from '../data/teamMembers.js';
import {
  LEGACY_TASKS,
  type LegacyDifficulty,
  type LegacyTask,
  type LegacyTaskStatus,
} from '../data/legacyTasks.js';

// ---------------------------------------------------------------------------
// Helpers (pure — exercised by unit tests)
// ---------------------------------------------------------------------------

/**
 * Map the legacy 1–5 difficulty number to the `task_difficulty` enum.
 * Mirrors `apps/client/src/api/mappers.ts::mapNumberToDifficulty`. If the two
 * ever diverge, round-trips through the API would corrupt the field, so this
 * mapping must stay in lockstep.
 */
export function mapDifficulty(difficulty: LegacyDifficulty): 'easy' | 'medium' | 'hard' | 'expert' {
  if (difficulty <= 2) return 'easy';
  if (difficulty === 3) return 'medium';
  if (difficulty === 4) return 'hard';
  return 'expert';
}

/**
 * The legacy data has no `manualStatus` set today, but a few imported edits
 * may use the snake_case form ('not_started', 'in_progress'). Normalise to the
 * hyphen form the `task_status` enum requires; pass through anything that
 * already matches the enum, and fall back to 'not-started' for unknown values.
 */
export function normalizeLegacyStatus(
  status: LegacyTaskStatus | string | undefined,
): 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'cancelled' {
  if (!status) return 'not-started';
  const enumValues = ['not-started', 'in-progress', 'completed', 'blocked', 'cancelled'] as const;
  if ((enumValues as readonly string[]).includes(status)) {
    return status as (typeof enumValues)[number];
  }
  // Tolerate the legacy snake_case TaskStatus from `apps/client/src/data/types.ts`.
  const snakeMap: Record<string, (typeof enumValues)[number]> = {
    not_started: 'not-started',
    in_progress: 'in-progress',
    planning: 'not-started',
    review: 'in-progress',
  };
  return snakeMap[status] ?? 'not-started';
}

/**
 * Result counts returned from `runSeed` — exposed for tests and CLI summary.
 */
export interface SeedResult {
  usersCreated: number;
  usersExisting: number;
  projectCreated: boolean;
  membersAdded: number;
  tasksInserted: number;
  tasksSkipped: number;
  unknownAssignees: string[];
}

// ---------------------------------------------------------------------------
// Core seed (db is injected so tests can mock it)
// ---------------------------------------------------------------------------

interface SeedDeps {
  db: NodePgDatabase;
  /** Logger; tests pass `() => {}` to keep output clean. */
  log?: (...args: unknown[]) => void;
}

export async function runSeed({ db, log = console.log }: SeedDeps): Promise<SeedResult> {
  const result: SeedResult = {
    usersCreated: 0,
    usersExisting: 0,
    projectCreated: false,
    membersAdded: 0,
    tasksInserted: 0,
    tasksSkipped: 0,
    unknownAssignees: [],
  };

  // -------------------------------------------------------------------------
  // 1. Upsert team members → users
  // -------------------------------------------------------------------------
  log('Step 1: upserting team members...');
  const userMap = new Map<string, string>(); // displayName → user.id

  for (const member of DEFAULT_TEAM_MEMBERS) {
    const email = `${member.name.toLowerCase()}@madlab.mx`;
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

    let userId: string;
    if (existing.length > 0) {
      userId = existing[0].id;
      result.usersExisting++;
    } else {
      const [created] = await db
        .insert(users)
        .values({
          januaId: `mock-janua-${member.name.toLowerCase()}`,
          email,
          name: member.name,
          displayName: member.name,
          avatarUrl: member.avatar,
          metadata: {
            role: member.role,
            roleEn: member.roleEn,
            isTeamMember: true,
          },
        })
        .returning();
      userId = created.id;
      result.usersCreated++;
    }

    userMap.set(member.name, userId);
  }
  // Tasks assigned to "All" → owner (Aldo). Done as a soft alias rather than
  // a real user; the multi-assignee model is out of scope for the seed.
  const aldoId = userMap.get('Aldo');
  if (aldoId) userMap.set('All', aldoId);

  log(`  → users: ${result.usersCreated} created, ${result.usersExisting} existing`);

  // -------------------------------------------------------------------------
  // 2. Upsert main project
  // -------------------------------------------------------------------------
  log('Step 2: upserting project...');
  const PROJECT_NAME = 'MADLAB Educational Platform';
  const existingProject = await db
    .select()
    .from(projects)
    .where(eq(projects.name, PROJECT_NAME))
    .limit(1);

  let projectId: string;
  if (existingProject.length > 0) {
    projectId = existingProject[0].id;
  } else {
    const [created] = await db
      .insert(projects)
      .values({
        name: PROJECT_NAME,
        nameEn: PROJECT_NAME,
        description:
          'Gamified science and technology learning program for primary schools in Mexico, focused on SDGs (clean water, clean energy, recycling)',
        descriptionEn:
          'Gamified science and technology learning program for primary schools in Mexico, focused on SDGs (clean water, clean energy, recycling)',
        status: 'active',
        startDate: new Date('2025-08-11'),
        targetEndDate: new Date('2025-10-31'),
        metadata: {
          duration: 81,
          targetAudience: '20-100 students per 3-hour presentation',
          sdgFocus: ['Clean Water', 'Clean Energy', 'Recycling'],
          teamSize: 5,
          phases: 5,
        },
      })
      .returning();
    projectId = created.id;
    result.projectCreated = true;
  }

  // -------------------------------------------------------------------------
  // 3. Add team members to project
  // -------------------------------------------------------------------------
  log('Step 3: adding members to project...');
  for (const member of DEFAULT_TEAM_MEMBERS) {
    const userId = userMap.get(member.name);
    if (!userId) continue;

    const existingMembership = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .limit(1);

    if (existingMembership.length === 0) {
      await db.insert(projectMembers).values({
        projectId,
        userId,
        role: member.name === 'Aldo' ? 'owner' : 'member',
      });
      result.membersAdded++;
    }
  }

  // -------------------------------------------------------------------------
  // 4. Insert legacy tasks (idempotent on legacyId)
  // -------------------------------------------------------------------------
  log(`Step 4: inserting ${LEGACY_TASKS.length} legacy tasks...`);
  const seenAssignees = new Set<string>();

  for (const legacyTask of LEGACY_TASKS) {
    // Idempotency: skip if a row with this legacyId already exists.
    const existing = await db
      .select()
      .from(tasks)
      .where(eq(tasks.legacyId, legacyTask.id))
      .limit(1);

    if (existing.length > 0) {
      result.tasksSkipped++;
      continue;
    }

    const assigneeId = userMap.get(legacyTask.assignee);
    if (!assigneeId && !seenAssignees.has(legacyTask.assignee)) {
      seenAssignees.add(legacyTask.assignee);
      result.unknownAssignees.push(legacyTask.assignee);
      log(
        `  ⚠️  unknown assignee "${legacyTask.assignee}" on task ${legacyTask.id} — leaving NULL`,
      );
    }

    const metadata: Record<string, unknown> = {
      section: legacyTask.section,
      sectionEn: legacyTask.sectionEn,
    };
    if (legacyTask.manualStatus) metadata.manualStatus = legacyTask.manualStatus;
    if (legacyTask.statusHistory) metadata.statusHistory = legacyTask.statusHistory;

    await db.insert(tasks).values({
      projectId,
      legacyId: legacyTask.id,
      title: legacyTask.name,
      titleEn: legacyTask.nameEn,
      description: `${legacyTask.section} - ${legacyTask.name}`,
      descriptionEn: `${legacyTask.sectionEn} - ${legacyTask.nameEn}`,
      status: normalizeLegacyStatus(legacyTask.manualStatus),
      assigneeId: assigneeId ?? null,
      estimatedHours: Math.round(legacyTask.hours),
      difficulty: mapDifficulty(legacyTask.difficulty),
      phase: legacyTask.phase,
      section: legacyTask.section,
      sectionEn: legacyTask.sectionEn,
      dependencies: legacyTask.dependencies,
      metadata,
    });

    result.tasksInserted++;
  }

  log(`  → tasks: ${result.tasksInserted} inserted, ${result.tasksSkipped} skipped`);
  return result;
}

// Re-exported for tests that need the raw shape (e.g. legacyTasks shape test).
export { LEGACY_TASKS };
export type { LegacyTask };

// ---------------------------------------------------------------------------
// CLI entry point — only runs when invoked as a script, not when imported.
// ---------------------------------------------------------------------------

const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://madlab:madlab@localhost:5432/madlab';
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  console.log('🌱 Starting database seed...\n');
  runSeed({ db })
    .then(async (result) => {
      console.log('\n🎉 Seed completed:');
      console.log(`  - Users:     ${result.usersCreated} created, ${result.usersExisting} existing`);
      console.log(`  - Project:   ${result.projectCreated ? 'created' : 'existing'}`);
      console.log(`  - Members:   ${result.membersAdded} added`);
      console.log(
        `  - Tasks:     ${result.tasksInserted} inserted, ${result.tasksSkipped} skipped`,
      );
      if (result.unknownAssignees.length > 0) {
        console.log(`  - ⚠️  Unknown assignees: ${result.unknownAssignees.join(', ')}`);
      }
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('❌ Seed failed:', error);
      await pool.end();
      process.exit(1);
    });
}
