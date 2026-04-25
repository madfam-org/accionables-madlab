/**
 * Type Mappers
 * Convert between API types (backend schema) and Frontend types (UI expectations)
 */

import type { ApiTask, ApiTaskDifficulty, ApiTaskStatus } from './types';
import type { Task, TaskStatus } from '@/data/types';

/**
 * Map API difficulty to frontend difficulty (1-5 scale)
 */
export function mapDifficultyToNumber(difficulty?: ApiTaskDifficulty): 1 | 2 | 3 | 4 | 5 {
  switch (difficulty) {
    case 'easy':
      return 1;
    case 'medium':
      return 3;
    case 'hard':
      return 4;
    case 'expert':
      return 5;
    default:
      return 1;
  }
}

/**
 * Map frontend difficulty (1-5) to API difficulty
 */
export function mapNumberToDifficulty(difficulty: 1 | 2 | 3 | 4 | 5): ApiTaskDifficulty {
  if (difficulty <= 2) return 'easy';
  if (difficulty === 3) return 'medium';
  if (difficulty === 4) return 'hard';
  return 'expert';
}

/**
 * Map API status to frontend status
 */
export function mapApiStatusToFrontend(status: ApiTaskStatus): TaskStatus {
  switch (status) {
    case 'not-started':
      return 'not_started';
    case 'in-progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'blocked':
      return 'review'; // Map blocked to review for now
    case 'cancelled':
      return 'not_started';
    default:
      return 'not_started';
  }
}

/**
 * Map frontend status to API status
 */
export function mapFrontendStatusToApi(status: TaskStatus): ApiTaskStatus {
  switch (status) {
    case 'not_started':
      return 'not-started';
    case 'planning':
      return 'not-started';
    case 'in_progress':
      return 'in-progress';
    case 'review':
      return 'in-progress';
    case 'completed':
      return 'completed';
    default:
      return 'not-started';
  }
}

/**
 * Map API Task to Frontend Task
 * This is the core mapping function that converts backend data to frontend format
 */
export function mapApiTaskToFrontend(apiTask: ApiTask): Task {
  return {
    id: apiTask.legacyId || apiTask.id, // Prefer legacyId for backwards compatibility
    name: apiTask.title,
    nameEn: apiTask.titleEn || apiTask.title,
    assignee: apiTask.assignee || apiTask.assigneeDetails?.name || 'Unassigned',
    hours: apiTask.estimatedHours || 0,
    section: apiTask.metadata?.section || apiTask.section || '',
    sectionEn: apiTask.metadata?.sectionEn || apiTask.sectionEn || '',
    phase: apiTask.phase || 1,
    difficulty: mapDifficultyToNumber(apiTask.difficulty ?? undefined),
    dependencies: apiTask.dependencies || [],
    manualStatus: apiTask.metadata?.manualStatus as TaskStatus | undefined || mapApiStatusToFrontend(apiTask.status),
    statusHistory: apiTask.metadata?.statusHistory?.map(entry => ({
      status: entry.status as TaskStatus,
      updatedAt: new Date(entry.timestamp),
      updatedBy: 'Unknown',
      notes: entry.note,
    })),
  };
}

/**
 * Map Frontend Task updates to API update payload
 */
export function mapFrontendTaskToApiUpdate(task: Partial<Task>): Record<string, any> {
  const payload: Record<string, any> = {};

  if (task.name !== undefined) {
    payload.title = task.name;
  }

  if (task.nameEn !== undefined) {
    payload.titleEn = task.nameEn;
  }

  if (task.hours !== undefined) {
    payload.estimatedHours = task.hours;
  }

  if (task.difficulty !== undefined) {
    payload.difficulty = mapNumberToDifficulty(task.difficulty);
  }

  if (task.phase !== undefined) {
    payload.phase = task.phase;
  }

  if (task.dependencies !== undefined) {
    payload.dependencies = task.dependencies;
  }

  if (task.manualStatus !== undefined) {
    payload.status = mapFrontendStatusToApi(task.manualStatus);
    // Store in metadata as well for history
    payload.metadata = {
      ...payload.metadata,
      manualStatus: task.manualStatus,
    };
  }

  // Preserve section info in metadata
  if (task.section !== undefined || task.sectionEn !== undefined) {
    payload.metadata = {
      ...payload.metadata,
      section: task.section,
      sectionEn: task.sectionEn,
    };
  }

  return payload;
}

/**
 * Batch map API tasks to frontend tasks
 */
export function mapApiTasksToFrontend(apiTasks: ApiTask[]): Task[] {
  return apiTasks.map(mapApiTaskToFrontend);
}
