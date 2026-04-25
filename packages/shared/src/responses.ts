/**
 * Standard API response envelopes. Every server route returns one of these.
 */
import type { ApiTask, ApiProject, ApiProjectStats } from './entities.js';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  error?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: unknown;
}

export interface ApiTasksResponse {
  success: boolean;
  data: ApiTask[];
  count: number;
  limit?: number;
  offset?: number;
}

export interface ApiProjectsResponse {
  success: boolean;
  data: Array<ApiProject & { stats?: ApiProjectStats }>;
}
