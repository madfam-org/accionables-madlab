import { describe, it, expect } from 'vitest';
import {
  LEGACY_TASKS,
  LEGACY_TASKS_BY_PHASE,
  type LegacyTask,
} from './legacyTasks.js';
import { DEFAULT_TEAM_MEMBERS } from './teamMembers.js';

describe('LEGACY_TASKS — shape and integrity', () => {
  it('contains the expected number of tasks across all phases', () => {
    // Spec: 5 phases × declared per-phase counts === total array length.
    const declaredTotal = Object.values(LEGACY_TASKS_BY_PHASE).reduce((a, b) => a + b, 0);
    expect(LEGACY_TASKS.length).toBe(declaredTotal);
    expect(LEGACY_TASKS.length).toBe(110);
  });

  it('partitions tasks by phase exactly per LEGACY_TASKS_BY_PHASE', () => {
    const counts = LEGACY_TASKS.reduce<Record<number, number>>((acc, t) => {
      acc[t.phase] = (acc[t.phase] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual(LEGACY_TASKS_BY_PHASE);
  });

  it('every task has all required fields populated with the right types', () => {
    // Catches accidental schema drift if someone hand-edits the array.
    for (const task of LEGACY_TASKS) {
      expect(typeof task.id).toBe('string');
      expect(task.id).toMatch(/^[1-5]\.\d+\.\d+$/); // phase.section.index
      expect(typeof task.name).toBe('string');
      expect(task.name.length).toBeGreaterThan(0);
      expect(typeof task.nameEn).toBe('string');
      expect(task.nameEn.length).toBeGreaterThan(0);
      expect(typeof task.assignee).toBe('string');
      expect(task.assignee.length).toBeGreaterThan(0);
      expect(typeof task.hours).toBe('number');
      expect(task.hours).toBeGreaterThan(0);
      expect([1, 2, 3, 4, 5]).toContain(task.difficulty);
      expect(Array.isArray(task.dependencies)).toBe(true);
      expect(typeof task.phase).toBe('number');
      expect([1, 2, 3, 4, 5]).toContain(task.phase);
      expect(typeof task.section).toBe('string');
      expect(typeof task.sectionEn).toBe('string');
    }
  });

  it('has no duplicate legacyIds (idempotency precondition)', () => {
    const ids = LEGACY_TASKS.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every task.id matches its declared phase prefix', () => {
    // "2.3.1" must live in phase 2 — guards against copy-paste errors.
    for (const task of LEGACY_TASKS) {
      const declaredPhase = Number(task.id.split('.')[0]);
      expect(declaredPhase).toBe(task.phase);
    }
  });

  it('every dependency references an existing task id', () => {
    const known = new Set(LEGACY_TASKS.map((t) => t.id));
    for (const task of LEGACY_TASKS) {
      for (const dep of task.dependencies) {
        expect(known.has(dep)).toBe(true);
      }
    }
  });

  it('every assignee matches a known team member name (or "All")', () => {
    const validNames = new Set<string>([
      ...DEFAULT_TEAM_MEMBERS.map((m) => m.name),
      'All',
    ]);
    const offenders: LegacyTask[] = LEGACY_TASKS.filter((t) => !validNames.has(t.assignee));
    expect(offenders).toEqual([]);
  });

  it('the export is frozen so consumers cannot mutate the canonical list', () => {
    expect(Object.isFrozen(LEGACY_TASKS)).toBe(true);
    expect(Object.isFrozen(LEGACY_TASKS_BY_PHASE)).toBe(true);
  });
});
