import { describe, it, expect } from 'vitest';
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  bulkUpdateTasksSchema,
  createProjectSchema,
  taskStatusSchema,
  projectStatusSchema,
  validateRequest,
} from './validation.js';

describe('taskStatusSchema / projectStatusSchema — must mirror db/schema.ts', () => {
  // If these drift from db/schema.ts, Drizzle inserts will 500 at runtime.
  it('taskStatusSchema matches the taskStatusEnum members', () => {
    expect(taskStatusSchema.options).toEqual([
      'not-started', 'in-progress', 'completed', 'blocked', 'cancelled',
    ]);
  });

  it('projectStatusSchema matches the projectStatusEnum members', () => {
    expect(projectStatusSchema.options).toEqual([
      'planning', 'active', 'on-hold', 'completed', 'archived',
    ]);
  });
});

describe('createTaskSchema', () => {
  const valid = {
    projectId: '00000000-0000-0000-0000-000000000001',
    title: 'Write docs',
  };

  it('accepts a minimal valid payload and applies defaults', () => {
    const parsed = createTaskSchema.parse(valid);
    expect(parsed.status).toBe('not-started');
    expect(parsed.phase).toBe(1);
    expect(parsed.dependencies).toEqual([]);
    expect(parsed.metadata).toEqual({});
  });

  it('rejects a non-uuid projectId', () => {
    expect(() => createTaskSchema.parse({ ...valid, projectId: 'not-a-uuid' })).toThrow();
  });

  it('rejects an empty title', () => {
    expect(() => createTaskSchema.parse({ ...valid, title: '' })).toThrow();
  });

  it('rejects estimatedHours out of bounds', () => {
    expect(() => createTaskSchema.parse({ ...valid, estimatedHours: -1 })).toThrow();
    expect(() => createTaskSchema.parse({ ...valid, estimatedHours: 2000 })).toThrow();
  });

  it('rejects phase outside 1..10', () => {
    expect(() => createTaskSchema.parse({ ...valid, phase: 0 })).toThrow();
    expect(() => createTaskSchema.parse({ ...valid, phase: 11 })).toThrow();
  });

  it('rejects an unknown status value', () => {
    expect(() => createTaskSchema.parse({ ...valid, status: 'totally-fake' })).toThrow();
  });
});

describe('updateTaskSchema', () => {
  it('accepts a partial payload', () => {
    expect(() => updateTaskSchema.parse({ progress: 50 })).not.toThrow();
  });

  it('rejects progress > 100', () => {
    expect(() => updateTaskSchema.parse({ progress: 150 })).toThrow();
  });

  it('allows assigneeId to be null (unassign)', () => {
    const parsed = updateTaskSchema.parse({ assigneeId: null });
    expect(parsed.assigneeId).toBeNull();
  });
});

describe('taskQuerySchema — query string coercion', () => {
  it('coerces numeric strings into numbers and applies defaults', () => {
    const parsed = taskQuerySchema.parse({ phase: '3' });
    expect(parsed.phase).toBe(3);
    expect(parsed.limit).toBe(100);
    expect(parsed.offset).toBe(0);
  });

  it('rejects non-numeric strings for phase/limit/offset', () => {
    expect(() => taskQuerySchema.parse({ phase: 'abc' })).toThrow();
    expect(() => taskQuerySchema.parse({ limit: 'xx' })).toThrow();
  });
});

describe('bulkUpdateTasksSchema', () => {
  it('requires at least one update', () => {
    expect(() => bulkUpdateTasksSchema.parse({ updates: [] })).toThrow();
  });

  it('caps the batch size at 100', () => {
    const updates = Array.from({ length: 101 }, () => ({
      id: '00000000-0000-0000-0000-000000000001',
      status: 'completed' as const,
    }));
    expect(() => bulkUpdateTasksSchema.parse({ updates })).toThrow();
  });
});

describe('createProjectSchema — reconciled with DB shape', () => {
  // Regression guard: before Wave 0, this schema asked for eventDate/eventType/
  // ownerId/settings, which don't exist on the projects table. Validated inserts
  // were guaranteed to fail at the DB.
  it('does NOT accept the old eventDate field', () => {
    const parsed = createProjectSchema.parse({
      name: 'Test',
      eventDate: '2026-05-01T00:00:00Z',
    } as any);
    expect((parsed as any).eventDate).toBeUndefined();
  });

  it('accepts the real DB fields and applies defaults', () => {
    const parsed = createProjectSchema.parse({ name: 'Demo' });
    expect(parsed.status).toBe('planning');
    expect(parsed.metadata).toEqual({});
  });

  it('rejects invalid status values', () => {
    expect(() => createProjectSchema.parse({ name: 'Demo', status: 'eventy' } as any)).toThrow();
  });
});

describe('validateRequest helper', () => {
  it('returns success with post-transform data for schemas with defaults', () => {
    const result = validateRequest(taskQuerySchema, { phase: '2' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phase).toBe(2);
      expect(result.data.limit).toBe(100);
    }
  });

  it('returns errors without throwing on invalid input', () => {
    const result = validateRequest(createTaskSchema, { title: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
