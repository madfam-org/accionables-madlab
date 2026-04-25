/**
 * useTeamMembers — React Query hook for the project team roster.
 *
 * Server source: `GET /api/users`. The endpoint reads from the local
 * `users` table and falls back to the canonical seed list when empty.
 *
 * Replaces the static import from `apps/client/src/data/teamMembers.ts`.
 * The static file is retained as `initialData` so existing synchronous
 * consumers (e.g. exportUtils) keep working during the React Query
 * fetch + revalidation cycle.
 */

import { useQuery } from '@tanstack/react-query';
import { usersApi, type ApiUser } from '@/api/domain';
import { teamMembers as seedMembers } from '@/data/teamMembers';

export const teamMemberKeys = {
  all: ['team-members'] as const,
  list: () => [...teamMemberKeys.all, 'list'] as const,
};

export function useTeamMembers() {
  return useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: async (): Promise<ApiUser[]> => {
      const response = await usersApi.getAll();
      return response.data;
    },
    // Team roster is small and stable; 5 minutes is enough to avoid
    // hammering /api/users on every page navigation.
    staleTime: 1000 * 60 * 5,
    initialData: seedMembers as ApiUser[],
  });
}
