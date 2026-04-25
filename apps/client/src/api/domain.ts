/**
 * Domain data API client.
 *
 * Routes added in Wave 4 (#15) to migrate static client-side domain data
 * (phases, team members, demo projects) onto the server. Each method below
 * has a corresponding server route in apps/server/src/routes/.
 */

import apiClient from './client';

// ============================================================================
// Phases
// ============================================================================

export interface ApiPhaseInfo {
  number: number;
  title: { es: string; en: string };
  dateRange: string;
  taskCount: number;
}

export interface ApiPhasesResponse {
  success: boolean;
  data: ApiPhaseInfo[];
}

// ============================================================================
// Users (team members)
// ============================================================================

export interface ApiUser {
  /** Present for DB-backed rows; absent for the static fallback. */
  id?: string;
  name: string;
  role: string;
  roleEn: string;
  avatar: string;
}

export interface ApiUsersResponse {
  success: boolean;
  data: ApiUser[];
  /** 'db' when sourced from the users table, 'fallback' when seeded. */
  source: 'db' | 'fallback';
}

// ============================================================================
// Demo projects
// ============================================================================

export type ApiDemoEventType =
  | 'concert'
  | 'launch'
  | 'exam'
  | 'presentation'
  | 'retreat'
  | 'deadline'
  | 'custom';

export type ApiDemoCategory = 'creative' | 'academic' | 'professional' | 'personal';

export interface ApiDemoProjectEvent {
  id: string;
  name: string;
  nameEn: string;
  /** ISO-8601 string. */
  date: string;
  description: string;
  descriptionEn: string;
  type: ApiDemoEventType;
}

export interface ApiDemoProject {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  gradient: string;
  event: ApiDemoProjectEvent;
  taskCount: number;
  daysUntilEvent: number;
  category: ApiDemoCategory;
}

export interface ApiDemoProjectsResponse {
  success: boolean;
  data: ApiDemoProject[];
}

// ============================================================================
// API methods
// ============================================================================

export const phasesApi = {
  /** GET /api/phases — auth required. */
  async getAll(): Promise<ApiPhasesResponse> {
    const { data } = await apiClient.get<ApiPhasesResponse>('/phases');
    return data;
  },
};

export const usersApi = {
  /** GET /api/users — auth required. */
  async getAll(): Promise<ApiUsersResponse> {
    const { data } = await apiClient.get<ApiUsersResponse>('/users');
    return data;
  },
};

export const demoProjectsApi = {
  /** GET /api/demo-projects — public. */
  async getAll(): Promise<ApiDemoProjectsResponse> {
    const { data } = await apiClient.get<ApiDemoProjectsResponse>('/demo-projects');
    return data;
  },
};
