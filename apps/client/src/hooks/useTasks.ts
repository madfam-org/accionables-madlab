/**
 * useTasks Hook
 * React Query hooks for task data fetching and mutations
 * Includes optimistic updates for instant UI feedback
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/api/client';
import { mapApiTasksToFrontend, mapFrontendTaskToApiUpdate } from '@/api/mappers';
import type { Task } from '@/data/types';
import type { TaskFilters, UpdateTaskPayload, CreateTaskPayload } from '@/api/types';

// Query keys for cache management
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters?: TaskFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

/**
 * Fetch all tasks with optional filtering
 */
export function useTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: async () => {
      const response = await tasksApi.getAll(filters);
      // Map API tasks to frontend format
      return mapApiTasksToFrontend(response.data);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch single task by ID
 */
export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      const response = await tasksApi.getById(id);
      return mapApiTasksToFrontend([response.data])[0];
    },
    enabled: !!id,
  });
}

/**
 * Create new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(payload),
    onSuccess: () => {
      // Invalidate all task queries to refetch
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Update task with optimistic updates
 * This is crucial for drag-and-drop and Gantt chart interactions
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      // Convert frontend format to API format
      const apiUpdates = mapFrontendTaskToApiUpdate(updates);
      return tasksApi.update(id, apiUpdates as UpdateTaskPayload);
    },

    // Optimistic update: Update cache immediately before server responds
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches to prevent optimistic update being overwritten
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());

      // Optimistically update to the new value
      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          );
        }
      );

      // Return context with snapshot for rollback
      return { previousTasks };
    },

    // If mutation fails, use the context to roll back
    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      console.error('Task update failed:', err);
    },

    // Always refetch after error or success to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Bulk update multiple tasks
 * Useful for batch operations
 */
export function useBulkUpdateTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskIds, updates }: { taskIds: string[]; updates: Partial<Task> }) => {
      const apiUpdates = mapFrontendTaskToApiUpdate(updates);
      // Server expects { updates: [{id, ...fields}, ...] }, not the old
      // { taskIds, updates } shape. The bulk schema only accepts a subset
      // (status/progress/phase/startDate/endDate) and rejects null; strip
      // down before sending so the request validates.
      const u = apiUpdates as Record<string, unknown>;
      const bulkPatch: Record<string, unknown> = {};
      for (const key of ['status', 'progress', 'phase'] as const) {
        if (u[key] !== undefined && u[key] !== null) bulkPatch[key] = u[key];
      }
      for (const key of ['startDate', 'endDate'] as const) {
        if (typeof u[key] === 'string') bulkPatch[key] = u[key];
      }
      return tasksApi.bulkUpdate({
        updates: taskIds.map((id) => ({ id, ...bulkPatch })),
      });
    },

    onMutate: async ({ taskIds, updates }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((task) =>
            taskIds.includes(task.id) ? { ...task, ...updates } : task
          );
        }
      );

      return { previousTasks };
    },

    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      console.error('Bulk task update failed:', err);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Delete task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());

      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.filter((task) => task.id !== id);
        }
      );

      return { previousTasks };
    },

    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      console.error('Task deletion failed:', err);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Helper: Prefetch tasks
 * Useful for preloading data on navigation
 */
export function prefetchTasks(queryClient: QueryClient, filters?: TaskFilters) {
  return queryClient.prefetchQuery({
    queryKey: taskKeys.list(filters),
    queryFn: async () => {
      const response = await tasksApi.getAll(filters);
      return mapApiTasksToFrontend(response.data);
    },
  });
}
