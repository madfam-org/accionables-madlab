/**
 * API Response & Payload Types
 *
 * These now come from @madlab/shared — single source of truth that the
 * server validates with at runtime. Hand-maintained types previously
 * drifted from the server (e.g. BulkUpdateTasksPayload had the wrong
 * shape; createProjectSchema had phantom eventDate/eventType fields).
 */
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskQueryInput,
  BulkUpdateTasksInput,
  CreateProjectInput,
  UpdateProjectInput,
} from '@madlab/shared';

export type {
  ApiUser,
  ApiProject,
  ApiTask,
  ApiTaskMetadata,
  ApiProjectStats,
  ApiResponse,
  ApiErrorResponse,
  ApiTasksResponse,
  ApiProjectsResponse,
  TaskStatus as ApiTaskStatus,
  TaskDifficulty as ApiTaskDifficulty,
  ProjectStatus as ApiProjectStatus,
} from '@madlab/shared';

// Mutation payloads — accept the *input* type (pre-defaults), since callers
// frequently omit fields with server defaults.
export type CreateTaskPayload = Partial<CreateTaskInput> &
  Pick<CreateTaskInput, 'projectId' | 'title'>;

export type UpdateTaskPayload = UpdateTaskInput;

export type BulkUpdateTasksPayload = BulkUpdateTasksInput;

// Query params — the schema's input type uses strings (HTTP query strings),
// but client callers naturally pass strongly-typed values, so we relax to
// the parsed shape minus the limit/offset defaults.
export type TaskFilters = Partial<{
  projectId: string;
  assigneeId: string;
  status: TaskQueryInput['status'];
  phase: number;
  difficulty: TaskQueryInput['difficulty'];
  limit: number;
  offset: number;
}>;

export type CreateProjectPayload = Partial<CreateProjectInput> & Pick<CreateProjectInput, 'name'>;
export type UpdateProjectPayload = UpdateProjectInput;
