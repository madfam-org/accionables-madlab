import { describe, it, expect, beforeEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  runSeed,
  mapDifficulty,
  normalizeLegacyStatus,
} from './seed.js';
import { LEGACY_TASKS } from '../data/legacyTasks.js';
import { DEFAULT_TEAM_MEMBERS } from '../data/teamMembers.js';

// ---------------------------------------------------------------------------
// In-memory drizzle stub
// ---------------------------------------------------------------------------
//
// We don't spin up Postgres for this test — the goal is to exercise control
// flow (idempotency on rerun, assignee resolution, status mapping). The mock
// just records every insert and replays them through the matching `select`
// query so subsequent runs see them as "existing".

interface UserRow {
  id: string;
  email: string;
  name: string;
}
interface ProjectRow {
  id: string;
  name: string;
}
interface MemberRow {
  projectId: string;
  userId: string;
}
interface TaskRow {
  id: string;
  legacyId: string | null;
  projectId: string;
  assigneeId: string | null;
  status: string;
  difficulty: string;
  estimatedHours: number;
  metadata: Record<string, unknown>;
  dependencies: unknown;
}

class FakeDb {
  users: UserRow[] = [];
  projects: ProjectRow[] = [];
  members: MemberRow[] = [];
  tasks: TaskRow[] = [];
  insertCalls = 0;

  private nextId = 1;
  private id() {
    return `uuid-${this.nextId++}`;
  }

  // Drizzle's API is a builder chain. We expose only the subset `runSeed`
  // exercises and short-circuit the chain to a thenable that resolves to
  // the rows we want.
  select() {
    return {
      from: (_table: unknown) => ({
        where: (_predicate: { __table: string; __key: string; __value: string }) => ({
          limit: async (_n: number) => {
            const { __table, __key, __value } = _predicate;
            return this.find(__table, __key, __value);
          },
        }),
      }),
    };
  }

  insert(table: { __name: string }) {
    const persist = (row: Record<string, unknown>) => {
      this.insertCalls++;
      return this.persist(table.__name, row);
    };
    return {
      values: (row: Record<string, unknown>) => {
        // Drizzle's values() result is BOTH a thenable (await it directly to
        // execute INSERT without RETURNING) AND it exposes `.returning()`. We
        // emulate both shapes so the seed can use either path.
        let resolved = false;
        let cached: Record<string, unknown> | undefined;
        const ensure = () => {
          if (!resolved) {
            resolved = true;
            cached = persist(row);
          }
          return cached;
        };
        return {
          returning: async () => {
            const created = ensure();
            return created ? [created] : [];
          },
          then: <T,>(onFulfilled?: (v: unknown) => T) => {
            ensure();
            return Promise.resolve(undefined).then(onFulfilled);
          },
        };
      },
    };
  }

  private persist(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
    const id = this.id();
    if (tableName === 'users') {
      this.users.push({
        id,
        email: row.email as string,
        name: row.name as string,
      });
      return { ...row, id };
    }
    if (tableName === 'projects') {
      this.projects.push({ id, name: row.name as string });
      return { ...row, id };
    }
    if (tableName === 'project_members') {
      this.members.push({
        projectId: row.projectId as string,
        userId: row.userId as string,
      });
      return { ...row, id };
    }
    if (tableName === 'tasks') {
      this.tasks.push({
        id,
        legacyId: (row.legacyId as string) ?? null,
        projectId: row.projectId as string,
        assigneeId: (row.assigneeId as string) ?? null,
        status: row.status as string,
        difficulty: row.difficulty as string,
        estimatedHours: row.estimatedHours as number,
        metadata: row.metadata as Record<string, unknown>,
        dependencies: row.dependencies,
      });
      return { ...row, id };
    }
    throw new Error(`unknown table: ${tableName}`);
  }

  private find(table: string, key: string, value: string): unknown[] {
    const get = (obj: object, k: string) => (obj as unknown as Record<string, unknown>)[k];
    if (table === 'users') return this.users.filter((u) => get(u, key) === value);
    if (table === 'projects') return this.projects.filter((p) => get(p, key) === value);
    if (table === 'tasks') return this.tasks.filter((t) => get(t, key) === value);
    if (table === 'project_members') {
      // Predicate is an `and(...)` shape — we encoded it as a composite key.
      return this.members.filter((m) => m.projectId === value || m.userId === value);
    }
    return [];
  }
}

// ---------------------------------------------------------------------------
// drizzle-orm shim — replace eq/and so the FakeDb sees a serialisable
// predicate. The real drizzle returns SQL expression objects; we just
// piggyback on the same module export so `runSeed` doesn't know the
// difference.
// ---------------------------------------------------------------------------

import { vi } from 'vitest';

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    eq: (column: { __table: string; __key: string }, value: string) => ({
      __table: column.__table,
      __key: column.__key,
      __value: value,
    }),
    // For `and(eq(projectId, X), eq(userId, Y))` we just return the first;
    // FakeDb.find treats project_members specially.
    and: (...preds: Array<{ __table: string; __key: string; __value: string }>) => preds[0],
  };
});

vi.mock('../db/schema.js', () => {
  const col = (table: string, key: string) => ({ __table: table, __key: key });
  return {
    users: {
      __name: 'users',
      id: col('users', 'id'),
      email: col('users', 'email'),
      name: col('users', 'name'),
    },
    projects: {
      __name: 'projects',
      id: col('projects', 'id'),
      name: col('projects', 'name'),
    },
    tasks: {
      __name: 'tasks',
      id: col('tasks', 'id'),
      legacyId: col('tasks', 'legacyId'),
    },
    projectMembers: {
      __name: 'project_members',
      projectId: col('project_members', 'projectId'),
      userId: col('project_members', 'userId'),
    },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mapDifficulty', () => {
  it('maps the legacy 1-5 scale to the task_difficulty enum', () => {
    expect(mapDifficulty(1)).toBe('easy');
    expect(mapDifficulty(2)).toBe('easy');
    expect(mapDifficulty(3)).toBe('medium');
    expect(mapDifficulty(4)).toBe('hard');
    expect(mapDifficulty(5)).toBe('expert');
  });
});

describe('normalizeLegacyStatus', () => {
  it('passes through valid task_status enum values unchanged', () => {
    expect(normalizeLegacyStatus('not-started')).toBe('not-started');
    expect(normalizeLegacyStatus('in-progress')).toBe('in-progress');
    expect(normalizeLegacyStatus('completed')).toBe('completed');
    expect(normalizeLegacyStatus('blocked')).toBe('blocked');
    expect(normalizeLegacyStatus('cancelled')).toBe('cancelled');
  });

  it('translates the legacy snake_case TaskStatus values', () => {
    expect(normalizeLegacyStatus('not_started')).toBe('not-started');
    expect(normalizeLegacyStatus('in_progress')).toBe('in-progress');
    expect(normalizeLegacyStatus('planning')).toBe('not-started');
    expect(normalizeLegacyStatus('review')).toBe('in-progress');
  });

  it('defaults to not-started for absent or unknown values', () => {
    expect(normalizeLegacyStatus(undefined)).toBe('not-started');
    expect(normalizeLegacyStatus('garbage' as never)).toBe('not-started');
  });
});

describe('runSeed — idempotency and assignee resolution', () => {
  let fakeDb: FakeDb;

  beforeEach(() => {
    fakeDb = new FakeDb();
  });

  it('inserts every legacy task and every team member on first run', async () => {
    const result = await runSeed({
      db: fakeDb as unknown as NodePgDatabase,
      log: () => {},
    });

    expect(result.usersCreated).toBe(DEFAULT_TEAM_MEMBERS.length);
    expect(result.usersExisting).toBe(0);
    expect(result.projectCreated).toBe(true);
    expect(result.tasksInserted).toBe(LEGACY_TASKS.length);
    expect(result.tasksSkipped).toBe(0);
    expect(result.unknownAssignees).toEqual([]);

    expect(fakeDb.tasks).toHaveLength(LEGACY_TASKS.length);
    // Spot-check one row
    const t111 = fakeDb.tasks.find((t) => t.legacyId === '1.1.1');
    expect(t111).toBeDefined();
    expect(t111!.estimatedHours).toBe(2);
    expect(t111!.difficulty).toBe('easy');
    expect(t111!.status).toBe('not-started');
    expect(t111!.assigneeId).not.toBeNull();
  });

  it('is idempotent — a second run inserts zero tasks and zero users', async () => {
    await runSeed({ db: fakeDb as unknown as NodePgDatabase, log: () => {} });
    const callsBefore = fakeDb.insertCalls;

    const second = await runSeed({
      db: fakeDb as unknown as NodePgDatabase,
      log: () => {},
    });

    expect(second.usersCreated).toBe(0);
    expect(second.usersExisting).toBe(DEFAULT_TEAM_MEMBERS.length);
    expect(second.projectCreated).toBe(false);
    expect(second.tasksInserted).toBe(0);
    expect(second.tasksSkipped).toBe(LEGACY_TASKS.length);
    expect(second.membersAdded).toBe(0);
    // No new INSERTs should have been issued.
    expect(fakeDb.insertCalls).toBe(callsBefore);
  });

  it('routes "All" assignees to the Aldo user (existing legacy convention)', async () => {
    await runSeed({ db: fakeDb as unknown as NodePgDatabase, log: () => {} });

    const aldo = fakeDb.users.find((u) => u.name === 'Aldo');
    expect(aldo).toBeDefined();
    const allTasks = LEGACY_TASKS.filter((t) => t.assignee === 'All');
    // Sanity — the legacy data does have at least one "All" task.
    expect(allTasks.length).toBeGreaterThan(0);

    for (const t of allTasks) {
      const persisted = fakeDb.tasks.find((row) => row.legacyId === t.id);
      expect(persisted?.assigneeId).toBe(aldo!.id);
    }
  });

  it('persists section info and dependencies on tasks', async () => {
    await runSeed({ db: fakeDb as unknown as NodePgDatabase, log: () => {} });

    const t114 = fakeDb.tasks.find((t) => t.legacyId === '1.1.4');
    expect(t114).toBeDefined();
    expect(t114!.dependencies).toEqual(['1.1.1']);
    expect((t114!.metadata as Record<string, string>).section).toBe(
      'Configuración de Infraestructura del Proyecto',
    );
    expect((t114!.metadata as Record<string, string>).sectionEn).toBe(
      'Project Infrastructure Setup',
    );
  });
});
