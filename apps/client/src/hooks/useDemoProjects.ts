/**
 * useDemoProjects — React Query hook for the public landing-page demo
 * project templates.
 *
 * Server source: `GET /api/demo-projects` (public, no auth). The server
 * recomputes `event.date` per request relative to "now"; this avoids
 * the previous client-side bundle bug where the dates were frozen at
 * SPA build time.
 *
 * The shape returned here is mapped from the API DTO into the in-memory
 * shape the existing landing page expects (`Date` instead of ISO string,
 * matching the local `DemoProject` type used by the app store).
 */

import { useQuery } from '@tanstack/react-query';
import {
  demoProjectsApi,
  type ApiDemoProject,
  type ApiDemoCategory,
} from '@/api/domain';
import type { CulminatingEvent, EventType } from '@/stores/appStore';

export interface DemoProject {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  gradient: string;
  event: CulminatingEvent;
  taskCount: number;
  daysUntilEvent: number;
  category: ApiDemoCategory;
}

export const demoProjectKeys = {
  all: ['demo-projects'] as const,
  list: () => [...demoProjectKeys.all, 'list'] as const,
};

function mapApiToDomain(api: ApiDemoProject): DemoProject {
  return {
    id: api.id,
    name: api.name,
    nameEn: api.nameEn,
    description: api.description,
    descriptionEn: api.descriptionEn,
    icon: api.icon,
    gradient: api.gradient,
    taskCount: api.taskCount,
    daysUntilEvent: api.daysUntilEvent,
    category: api.category,
    event: {
      id: api.event.id,
      name: api.event.name,
      nameEn: api.event.nameEn,
      // Server returns ISO-8601; consumers (Gantt config, app store)
      // expect a `Date` object.
      date: new Date(api.event.date),
      description: api.event.description,
      descriptionEn: api.event.descriptionEn,
      type: api.event.type as EventType,
    },
  };
}

export function useDemoProjects() {
  return useQuery({
    queryKey: demoProjectKeys.list(),
    queryFn: async (): Promise<DemoProject[]> => {
      const response = await demoProjectsApi.getAll();
      return response.data.map(mapApiToDomain);
    },
    // Demo dates are recomputed per request; clients can safely cache for
    // a few minutes without surfacing stale dates to the user.
    staleTime: 1000 * 60 * 5,
  });
}
