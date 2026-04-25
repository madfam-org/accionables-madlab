/**
 * usePhases — React Query hook for the canonical project phase metadata.
 *
 * Replaces the static import from `apps/client/src/data/phases.ts`.
 * The static file is retained as a fallback only (used by `useTasks` paths
 * that cannot be made async, and by tests). Once everything renders via
 * this hook, the static file can be removed.
 *
 * `staleTime: Infinity` because the phase list is project-level constants
 * — they do not change between renders. We only refetch on explicit
 * invalidation (e.g. an admin updates project metadata).
 */

import { useQuery } from '@tanstack/react-query';
import { phasesApi, type ApiPhaseInfo } from '@/api/domain';
import { projectPhases } from '@/data/phases';

export const phaseKeys = {
  all: ['phases'] as const,
  list: () => [...phaseKeys.all, 'list'] as const,
};

export function usePhases() {
  return useQuery({
    queryKey: phaseKeys.list(),
    queryFn: async (): Promise<ApiPhaseInfo[]> => {
      const response = await phasesApi.getAll();
      return response.data;
    },
    // Phase metadata is effectively static. Trust local cache aggressively.
    staleTime: Infinity,
    // Bundle-shipped fallback — instant first paint, no loading state in UI.
    initialData: projectPhases as ApiPhaseInfo[],
  });
}

/**
 * Build a "Phase N: Title (date range)" label for a given phase number.
 *
 * Pure helper — accepts the phase list as input so it can be used inside
 * components that already have the data from `usePhases()`.
 */
export function buildPhaseTitle(
  phases: ReadonlyArray<ApiPhaseInfo>,
  phase: number,
  language: 'es' | 'en',
): string {
  const phaseInfo = phases.find((p) => p.number === phase);
  if (!phaseInfo) return '';
  return `${phaseInfo.title[language]} (${phaseInfo.dateRange})`;
}
