import { z } from 'zod';

// ============================================================================
// Enums — these MUST mirror apps/server/src/db/schema.ts exactly. The
// validation tests pin enum order; if you change an enum here, change it
// there.
// ============================================================================

export const taskStatusSchema = z.enum([
  'not-started',
  'in-progress',
  'completed',
  'blocked',
  'cancelled',
]);

export const taskDifficultySchema = z.enum(['easy', 'medium', 'hard', 'expert']);

export const projectStatusSchema = z.enum([
  'planning',
  'active',
  'on-hold',
  'completed',
  'archived',
]);

// Used by agent breakdown requests, NOT by project schemas (project status
// is `projectStatusSchema`).
export const eventTypeSchema = z.enum([
  'concert',
  'launch',
  'exam',
  'presentation',
  'retreat',
  'deadline',
  'custom',
]);

// ============================================================================
// Common
// ============================================================================

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// ============================================================================
// Tasks
// ============================================================================

export const createTaskSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  titleEn: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  assigneeId: z.string().uuid().optional(),
  status: taskStatusSchema.default('not-started'),
  estimatedHours: z.number().min(0).max(1000).optional(),
  difficulty: taskDifficultySchema.optional(),
  phase: z.number().int().min(1).max(10).default(1),
  section: z.string().max(100).optional(),
  sectionEn: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  dependencies: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleEn: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  status: taskStatusSchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  actualHours: z.number().min(0).max(1000).optional(),
  difficulty: taskDifficultySchema.optional(),
  phase: z.number().int().min(1).max(10).optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const taskQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: taskStatusSchema.optional(),
  phase: z.string().regex(/^\d+$/).transform(Number).optional(),
  difficulty: taskDifficultySchema.optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default('100'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0'),
});

export const bulkUpdateTasksSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid('Invalid task ID'),
        status: taskStatusSchema.optional(),
        progress: z.number().min(0).max(100).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        phase: z.number().int().min(1).max(10).optional(),
      }),
    )
    .min(1, 'At least one update required')
    .max(100, 'Too many updates'),
});

// ============================================================================
// Projects — mirror apps/server/src/db/schema.ts projects table.
// `createdBy` is set server-side from the authenticated user, NOT accepted
// from the client.
// ============================================================================

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  nameEn: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  descriptionEn: z.string().max(5000).optional(),
  status: projectStatusSchema.default('planning'),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  nameEn: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  descriptionEn: z.string().max(5000).optional(),
  status: projectStatusSchema.optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetEndDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Waitlist
// ============================================================================

export const waitlistSignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  source: z.string().max(100).default('landing'),
  referrer: z.string().max(2000).optional(),
  name: z.string().max(255).optional(),
  ndProfile: z.enum(['adhd', 'autism', 'dyslexia', 'other']).optional(),
  useCase: z.string().max(1000).optional(),
});

// ============================================================================
// Agents
// ============================================================================

export const breakdownRequestSchema = z.object({
  eventName: z.string().min(1, 'Event name is required').max(200),
  eventDescription: z.string().min(10, 'Description too short').max(2000),
  eventDate: z.string().datetime('Invalid event date'),
  eventType: eventTypeSchema,
  teamSize: z.number().int().min(1).max(50).default(1),
  constraints: z.array(z.string().max(500)).max(10).optional(),
  preferences: z
    .object({
      language: z.enum(['es', 'en']).default('es'),
      detailLevel: z.enum(['minimal', 'moderate', 'detailed']).default('moderate'),
      includeTimeEstimates: z.boolean().default(true),
    })
    .optional(),
});

export const draftCommunicationSchema = z.object({
  type: z.enum(['update', 'reminder', 'handoff', 'announcement']),
  context: z.string().min(10).max(2000),
  recipients: z.array(z.string()).min(1).max(20),
  tone: z.enum(['formal', 'casual', 'urgent']).default('casual'),
  language: z.enum(['es', 'en']).default('es'),
});

export const reminderRequestSchema = z.object({
  taskId: z.string().uuid(),
  taskTitle: z.string(),
  dueDate: z.string().datetime(),
  context: z.string().max(500).optional(),
  aggressiveness: z.enum(['gentle', 'moderate', 'persistent']).default('moderate'),
});

// ============================================================================
// Validation helper
// ============================================================================

/**
 * Accepts any Zod schema and returns the parsed output type (after defaults
 * + transforms), so callers get the correct post-parse type even when the
 * schema's input type differs from its output (e.g. string → number via
 * z.string().transform(Number)).
 */
export function validateRequest<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
):
  | { success: true; data: z.output<S> }
  | { success: false; errors: z.ZodError['errors'] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.errors };
}

// ============================================================================
// Inferred input types
// ============================================================================

export type TaskStatus = z.output<typeof taskStatusSchema>;
export type TaskDifficulty = z.output<typeof taskDifficultySchema>;
export type ProjectStatus = z.output<typeof projectStatusSchema>;

export type CreateTaskInput = z.output<typeof createTaskSchema>;
export type UpdateTaskInput = z.output<typeof updateTaskSchema>;
export type TaskQueryInput = z.output<typeof taskQuerySchema>;
export type BulkUpdateTasksInput = z.output<typeof bulkUpdateTasksSchema>;

export type CreateProjectInput = z.output<typeof createProjectSchema>;
export type UpdateProjectInput = z.output<typeof updateProjectSchema>;

export type WaitlistSignupInput = z.output<typeof waitlistSignupSchema>;

export type BreakdownRequestInput = z.output<typeof breakdownRequestSchema>;
export type DraftCommunicationInput = z.output<typeof draftCommunicationSchema>;
export type ReminderRequestInput = z.output<typeof reminderRequestSchema>;
