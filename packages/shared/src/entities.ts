/**
 * Entity shapes returned by the API. These mirror the DB tables in
 * apps/server/src/db/schema.ts but use ISO date strings (the wire format)
 * instead of Date objects.
 *
 * Drizzle's `$inferSelect` types live server-side and use Date — useful
 * inside server code, not on the wire. These manual shapes are the
 * cross-the-wire truth and are what client code consumes.
 */
import type { TaskStatus, TaskDifficulty, ProjectStatus } from './schemas.js';

export interface ApiUser {
  id: string;
  januaId: string;
  email: string;
  name: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string | null;
}

export interface ApiProject {
  id: string;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  status: ProjectStatus;
  startDate?: string | null;
  targetEndDate?: string | null;
  endDate?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTaskMetadata {
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  manualStatus?: string;
  notes?: string;
  section?: string;
  sectionEn?: string;
  statusHistory?: Array<{ status: string; timestamp: string; note?: string }>;
  [key: string]: unknown;
}

export interface ApiTask {
  id: string;
  projectId: string;
  legacyId?: string | null;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  status: TaskStatus;
  assigneeId?: string | null;
  estimatedHours?: number | null;
  difficulty?: TaskDifficulty | null;
  phase?: number | null;
  section?: string | null;
  sectionEn?: string | null;
  progress: number;
  actualHours?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  completedAt?: string | null;
  dependencies: string[];
  metadata?: ApiTaskMetadata | null;
  createdAt: string;
  updatedAt: string;
  // Populated fields from joins. The server flattens `assignee` to a display
  // string (the user's name or 'Unassigned') for the read path, and exposes
  // the full user record under `assigneeDetails`. See
  // apps/server/src/routes/tasks.ts:48-52.
  assignee?: string;
  assigneeDetails?: Pick<ApiUser, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
  project?: Pick<ApiProject, 'id' | 'name' | 'nameEn'> | null;
}

export interface ApiProjectStats {
  totalTasks: number;
  memberCount: number;
  tasksByStatus: Partial<Record<TaskStatus, number>>;
}
