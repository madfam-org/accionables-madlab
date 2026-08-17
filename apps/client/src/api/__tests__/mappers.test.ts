import { describe, expect, it } from 'vitest';
import { mapApiTasksToFrontend, mapFrontendTaskToApiUpdate } from '../mappers';
import type { ApiTask } from '../types';

/**
 * Canonical time at the client seam (D14): minutes-first reads preserve the
 * exact unit as fractional hours; writes send minutes so the server's
 * canonicalTime keeps the compat column in sync — never a whole-hour round.
 */
describe('mappers — canonical minutes (D14)', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    projectId: '22222222-2222-2222-2222-222222222222',
    title: 'T',
    status: 'not-started',
    progress: 0,
    dependencies: [],
    createdAt: '2026-08-16T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z',
  } as unknown as ApiTask;

  it('prefers estimatedMinutes and derives FRACTIONAL hours (100 min = 1.67h, not 2)', () => {
    const [task] = mapApiTasksToFrontend([
      { ...base, estimatedMinutes: 100, estimatedHours: 2 } as ApiTask,
    ]);
    expect(task.hours).toBeCloseTo(100 / 60, 5);
  });

  it('falls back to legacy hours when minutes are absent', () => {
    const [task] = mapApiTasksToFrontend([{ ...base, estimatedHours: 3 } as ApiTask]);
    expect(task.hours).toBe(3);
  });

  it('writes minutes, rounded to a whole minute never a whole hour', () => {
    const payload = mapFrontendTaskToApiUpdate({ hours: 1.25 });
    expect(payload.estimatedMinutes).toBe(75);
    expect('estimatedHours' in payload).toBe(false);
  });
});
