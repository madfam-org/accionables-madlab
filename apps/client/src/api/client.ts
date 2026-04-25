/**
 * API Client
 * Axios-based HTTP client for communicating with the MADLAB Fastify backend
 *
 * Auth integration notes (2026-04-24):
 *   - Server side now requires JWT on every CRUD route (verifyJWT preHandler).
 *     The request interceptor below attaches `Authorization: Bearer <token>`
 *     when a token is present in localStorage under the key `auth_token`.
 *   - On 401 responses we clear local auth state and trigger the registered
 *     logout handler (typically `AuthContext.signOut`). React-router-dom is
 *     installed but not yet wired into <App />, and there is no `/login`
 *     route. The logout handler is the correct seam: AuthContext owns the
 *     redirect-to-IdP flow (`signIn` redirects to Janua's OAuth authorize
 *     endpoint). If no handler is registered (e.g. interceptor fires before
 *     <AuthProvider /> mounts) we fall back to a hard `window.location`
 *     reload so the user at least lands in a clean unauthenticated state.
 *
 *   Storage-key alignment (resolved 2026-04-24): AuthContext now persists
 *     auth state under `auth_token` (raw JWT) and `auth_user` (JanuaUser
 *     JSON), matching what the request interceptor reads. Refresh-token /
 *     expiry metadata is kept by AuthContext under `auth_token_meta`. The
 *     legacy single-blob `madlab_auth` key is migrated on mount and is
 *     still cleared by the 401 handler below as defense-in-depth.
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import * as Sentry from '@sentry/react';
import type {
  ApiResponse,
  ApiTask,
  ApiTasksResponse,
  ApiProject,
  ApiProjectsResponse,
  TaskFilters,
  CreateTaskPayload,
  UpdateTaskPayload,
  BulkUpdateTasksPayload,
} from './types';

// ============================================================================
// Auth Storage Keys
// ============================================================================

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_USER_KEY = 'auth_user';
// AuthContext currently uses this key for its JSON blob — clear it on 401
// to keep local state consistent until the keys are unified.
const AUTH_CONTEXT_LEGACY_KEY = 'madlab_auth';

// ============================================================================
// Logout Handler Registration
// ============================================================================
//
// The axios interceptor lives outside the React tree, so it cannot call
// `useAuth().signOut()` directly. Instead, AuthProvider registers its
// signOut callback via `setAuthLogoutHandler` on mount, and the 401
// interceptor invokes whatever is currently registered.
//
// This pattern keeps the API client framework-agnostic while still letting
// it cooperate with AuthContext's redirect/cleanup logic.

type LogoutHandler = () => void;
let registeredLogoutHandler: LogoutHandler | null = null;

export function setAuthLogoutHandler(handler: LogoutHandler | null): void {
  registeredLogoutHandler = handler;
}

/**
 * Internal: invoked by the response interceptor on 401.
 * Exported for tests; not part of the public API surface.
 */
export function handleUnauthorized(): void {
  // Always clear local auth state, regardless of whether a handler is set.
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_CONTEXT_LEGACY_KEY);
  } catch {
    // localStorage may be unavailable (private mode, SSR) — ignore.
  }

  if (registeredLogoutHandler) {
    // Preferred path: let AuthContext handle state reset + any redirect.
    registeredLogoutHandler();
    return;
  }

  // Fallback: no handler registered (interceptor fired before AuthProvider
  // mounted, or in a non-React context). Force a full reload to '/' so the
  // app re-bootstraps in a clean unauthenticated state. We use
  // window.location here as a last resort because react-router-dom is not
  // yet wired into <App /> and we have no router instance to call.
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

// ============================================================================
// Axios Instance Configuration
// ============================================================================

const apiClient: AxiosInstance = axios.create({
  baseURL: '/api', // Proxied by Vite to http://localhost:3001/api
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT bearer token if present
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // localStorage unavailable — proceed without auth header.
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 by clearing auth + triggering logout,
// forward other server errors to Sentry for visibility.
//
// Sentry routing rules (added 2026-04-24):
//   - 401: skipped. Expected during auth-token expiry; AuthContext owns the
//     redirect flow. Logging these would spam every signed-out tab refresh.
//   - Network errors (no `response`): skipped. These represent the user being
//     offline / the API being unreachable — better tracked via uptime probes
//     than per-user issue reports, which would otherwise flood Sentry from
//     mobile users with flaky connections.
//   - Everything else (4xx other than 401, all 5xx): forwarded with light
//     request context. captureException is a safe no-op when Sentry isn't
//     initialized (dev without VITE_SENTRY_DSN).
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401) {
      handleUnauthorized();
      return Promise.reject(error);
    }
    if (!error.response) {
      // Network error / request never reached the server. Don't spam Sentry.
      return Promise.reject(error);
    }

    Sentry.captureException(error, {
      tags: {
        statusCode: String(status),
        source: 'apiClient',
      },
      contexts: {
        request: {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status,
        },
      },
    });
    return Promise.reject(error);
  }
);

// ============================================================================
// API Methods
// ============================================================================

/**
 * Health Check
 */
export async function checkHealth(): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.get('/health');
  return data;
}

/**
 * Projects API
 */
export const projectsApi = {
  /**
   * Get all projects with statistics
   */
  async getAll(): Promise<ApiProjectsResponse> {
    const { data } = await apiClient.get<ApiProjectsResponse>('/projects');
    return data;
  },

  /**
   * Get single project by ID
   */
  async getById(id: string): Promise<ApiResponse<ApiProject>> {
    const { data } = await apiClient.get<ApiResponse<ApiProject>>(`/projects/${id}`);
    return data;
  },

  /**
   * Create new project
   */
  async create(payload: Partial<ApiProject>): Promise<ApiResponse<ApiProject>> {
    const { data } = await apiClient.post<ApiResponse<ApiProject>>('/projects', payload);
    return data;
  },

  /**
   * Update project
   */
  async update(id: string, payload: Partial<ApiProject>): Promise<ApiResponse<ApiProject>> {
    const { data } = await apiClient.patch<ApiResponse<ApiProject>>(`/projects/${id}`, payload);
    return data;
  },

  /**
   * Delete project
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const { data } = await apiClient.delete<ApiResponse<void>>(`/projects/${id}`);
    return data;
  },
};

/**
 * Tasks API
 */
export const tasksApi = {
  /**
   * Get all tasks with optional filtering
   */
  async getAll(filters?: TaskFilters): Promise<ApiTasksResponse> {
    const { data } = await apiClient.get<ApiTasksResponse>('/tasks', {
      params: filters,
    });
    return data;
  },

  /**
   * Get single task by ID
   */
  async getById(id: string): Promise<ApiResponse<ApiTask>> {
    const { data } = await apiClient.get<ApiResponse<ApiTask>>(`/tasks/${id}`);
    return data;
  },

  /**
   * Create new task
   */
  async create(payload: CreateTaskPayload): Promise<ApiResponse<ApiTask>> {
    const { data } = await apiClient.post<ApiResponse<ApiTask>>('/tasks', payload);
    return data;
  },

  /**
   * Update task
   */
  async update(id: string, payload: UpdateTaskPayload): Promise<ApiResponse<ApiTask>> {
    const { data } = await apiClient.patch<ApiResponse<ApiTask>>(`/tasks/${id}`, payload);
    return data;
  },

  /**
   * Bulk update multiple tasks
   */
  async bulkUpdate(payload: BulkUpdateTasksPayload): Promise<ApiResponse<ApiTask[]>> {
    const { data } = await apiClient.patch<ApiResponse<ApiTask[]>>('/tasks/bulk', payload);
    return data;
  },

  /**
   * Delete task
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const { data } = await apiClient.delete<ApiResponse<void>>(`/tasks/${id}`);
    return data;
  },
};

// Export the configured client for custom requests
export default apiClient;
