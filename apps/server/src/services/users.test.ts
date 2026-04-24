import { describe, it, expect, beforeEach, vi } from 'vitest';

const { dbStub } = vi.hoisted(() => ({
  dbStub: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));
vi.mock('../config/database.js', () => ({
  db: dbStub,
  pool: {},
  checkDatabaseConnection: vi.fn(),
  closeDatabaseConnection: vi.fn(),
}));

import { upsertLocalUser, findLocalUserIdByJanuaId } from './users.js';

describe('upsertLocalUser', () => {
  beforeEach(() => {
    dbStub.insert.mockReset();
    dbStub.select.mockReset();
  });

  function mockInsertReturning(rows: unknown[]) {
    dbStub.insert.mockImplementationOnce(() => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: async () => rows,
        }),
      }),
    }));
  }

  function captureInsertValues() {
    const captured: { values?: unknown; conflict?: unknown } = {};
    dbStub.insert.mockImplementationOnce(() => ({
      values: (v: unknown) => {
        captured.values = v;
        return {
          onConflictDoUpdate: (c: unknown) => {
            captured.conflict = c;
            return { returning: async () => [{ id: 'local-uuid-1' }] };
          },
        };
      },
    }));
    return captured;
  }

  it('returns the local UUID from the upsert', async () => {
    mockInsertReturning([{ id: 'local-uuid-42' }]);
    const id = await upsertLocalUser({ sub: 'janua-1', email: 'u@x.com' });
    expect(id).toBe('local-uuid-42');
  });

  it('lowercases the email', async () => {
    const captured = captureInsertValues();
    await upsertLocalUser({ sub: 'janua-1', email: 'MiXeD@Case.COM' });
    expect((captured.values as any).email).toBe('mixed@case.com');
  });

  it('falls back to email when name is absent', async () => {
    const captured = captureInsertValues();
    await upsertLocalUser({ sub: 'janua-1', email: 'anon@example.com' });
    expect((captured.values as any).name).toBe('anon@example.com');
  });

  it('uses the provided name when present', async () => {
    const captured = captureInsertValues();
    await upsertLocalUser({ sub: 'janua-1', email: 'a@b.com', name: 'Ada Lovelace' });
    expect((captured.values as any).name).toBe('Ada Lovelace');
  });

  it('throws if sub is missing — never silently create an anonymous user', async () => {
    await expect(
      upsertLocalUser({ sub: '', email: 'x@y.com' } as any),
    ).rejects.toThrow(/sub claim/);
    expect(dbStub.insert).not.toHaveBeenCalled();
  });

  it('throws if email is missing', async () => {
    await expect(
      upsertLocalUser({ sub: 'janua-1', email: '' } as any),
    ).rejects.toThrow(/email claim/);
    expect(dbStub.insert).not.toHaveBeenCalled();
  });

  it('throws when the upsert returns no row', async () => {
    mockInsertReturning([]);
    await expect(
      upsertLocalUser({ sub: 'janua-1', email: 'x@y.com' }),
    ).rejects.toThrow(/Failed to upsert/);
  });

  it('targets users.januaId as the conflict column', async () => {
    const captured = captureInsertValues();
    await upsertLocalUser({ sub: 'janua-1', email: 'a@b.com' });
    // Shape check: Drizzle's onConflictDoUpdate receives { target, set }.
    expect(captured.conflict).toBeDefined();
    expect((captured.conflict as any).target).toBeDefined();
    expect((captured.conflict as any).set).toBeDefined();
    expect((captured.conflict as any).set.email).toBe('a@b.com');
  });
});

describe('findLocalUserIdByJanuaId', () => {
  beforeEach(() => dbStub.select.mockReset());

  it('returns the id when a row exists', async () => {
    dbStub.select.mockImplementationOnce(() => {
      const builder: any = {
        from: () => builder,
        where: () => builder,
        limit: () => Promise.resolve([{ id: 'local-1' }]),
      };
      return builder;
    });
    const id = await findLocalUserIdByJanuaId('janua-1');
    expect(id).toBe('local-1');
  });

  it('returns null when no row matches', async () => {
    dbStub.select.mockImplementationOnce(() => {
      const builder: any = {
        from: () => builder,
        where: () => builder,
        limit: () => Promise.resolve([]),
      };
      return builder;
    });
    const id = await findLocalUserIdByJanuaId('nobody');
    expect(id).toBeNull();
  });
});
