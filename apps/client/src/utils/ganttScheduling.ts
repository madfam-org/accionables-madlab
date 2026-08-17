/**
 * Gantt Scheduling Utilities
 * Extracted from app store for use with React Query data
 */

import { Task } from '../data/types';
import { GanttTask } from '../stores/appStore';
import { getISOWeek } from './dateHelpers';
import { getSmartTaskProgress } from './progressHelpers';

/**
 * Calculate task duration based on hours and complexity
 */
/** One workday of scheduling capacity. 8h = 480 canonical minutes (D14). */
const WORK_HOURS_PER_DAY = 8;

export const calculateTaskDuration = (task: Task): number => {
  // task.hours arrives as FRACTIONAL hours derived from canonical minutes
  // (D14; see api/mappers.ts) — a 100-minute task is 1.67h and schedules
  // inside a single workday instead of inflating to a rounded 2h.
  const baseDays = Math.ceil(task.hours / WORK_HOURS_PER_DAY);
  const complexityMultiplier = {
    1: 1.0,    // Easy
    2: 1.2,    // Medium
    3: 1.5,    // Hard
    4: 2.0,    // Very Hard
    5: 2.5     // Expert
  }[task.difficulty] || 1.0;

  return Math.max(1, Math.ceil(baseDays * complexityMultiplier));
};

/**
 * Add work days (excluding weekends)
 */
export const addWorkDays = (startDate: Date, workDays: number): Date => {
  const result = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < workDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
      daysAdded++;
    }
  }

  return result;
};

/**
 * Get task color based on difficulty
 */
export const getTaskColor = (task: Task): string => {
  const colors = {
    1: '#10b981', // emerald-500 - Easy
    2: '#3b82f6', // blue-500 - Medium
    3: '#f59e0b', // amber-500 - Hard
    4: '#f97316', // orange-500 - Very Hard
    5: '#ef4444'  // red-500 - Expert
  };
  return colors[task.difficulty as keyof typeof colors] || colors[1];
};

/**
 * Phase date constraints (from project timeline)
 */
export const PHASE_CONSTRAINTS: Record<number, { start: Date; end: Date }> = {
  1: { start: new Date('2025-08-11'), end: new Date('2025-09-05') },
  2: { start: new Date('2025-09-06'), end: new Date('2025-09-25') },
  3: { start: new Date('2025-09-26'), end: new Date('2025-10-05') },
  4: { start: new Date('2025-10-06'), end: new Date('2025-10-20') },
  5: { start: new Date('2025-10-21'), end: new Date('2025-10-31') }
};

/**
 * Calculate critical path using CPM (Critical Path Method)
 */
const calculateCriticalPath = (taskMap: Map<string, GanttTask>): Set<string> => {
  const criticalPath = new Set<string>();

  const earliestTimes = new Map<string, { start: number; finish: number }>();
  const latestTimes = new Map<string, { start: number; finish: number }>();

  // Forward pass - calculate earliest times
  const calculateEarliestTimes = (taskId: string, visited: Set<string> = new Set()): number => {
    if (visited.has(taskId)) return earliestTimes.get(taskId)?.finish || 0;
    visited.add(taskId);

    const task = taskMap.get(taskId);
    if (!task) return 0;

    let earliestStart = 0;
    task.dependencies.forEach(depId => {
      const depFinish = calculateEarliestTimes(depId, visited);
      earliestStart = Math.max(earliestStart, depFinish);
    });

    const duration = Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const earliestFinish = earliestStart + duration;

    earliestTimes.set(taskId, { start: earliestStart, finish: earliestFinish });
    return earliestFinish;
  };

  // Calculate earliest times for all tasks
  taskMap.forEach((_, taskId) => calculateEarliestTimes(taskId));

  // Find project completion time
  let projectEnd = 0;
  earliestTimes.forEach(times => {
    projectEnd = Math.max(projectEnd, times.finish);
  });

  // Backward pass - calculate latest times
  const calculateLatestTimes = (taskId: string, visited: Set<string> = new Set()): number => {
    if (visited.has(taskId)) return latestTimes.get(taskId)?.start || projectEnd;
    visited.add(taskId);

    const task = taskMap.get(taskId);
    if (!task) return projectEnd;

    let latestFinish = projectEnd;
    task.successors.forEach(sucId => {
      const sucStart = calculateLatestTimes(sucId, visited);
      latestFinish = Math.min(latestFinish, sucStart);
    });

    const duration = Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const latestStart = latestFinish - duration;

    latestTimes.set(taskId, { start: latestStart, finish: latestFinish });
    return latestStart;
  };

  // Calculate latest times for all tasks
  taskMap.forEach((_, taskId) => calculateLatestTimes(taskId));

  // Identify critical path - tasks with zero float
  taskMap.forEach((_, taskId) => {
    const earliest = earliestTimes.get(taskId);
    const latest = latestTimes.get(taskId);

    if (earliest && latest) {
      const float = latest.start - earliest.start;
      if (float === 0) {
        criticalPath.add(taskId);
      }
    }
  });

  return criticalPath;
};

/**
 * Schedule project using auto-scheduling with dependency resolution
 */
export const scheduleProject = (tasks: Task[], projectStart: Date, showCriticalPath: boolean = false): GanttTask[] => {
  const scheduled: GanttTask[] = [];
  const taskMap = new Map<string, GanttTask>();

  // Create initial gantt tasks
  tasks.forEach(task => {
    const ganttTask: GanttTask = {
      ...task,
      startDate: new Date(projectStart),
      endDate: new Date(projectStart),
      weekNumber: task.weekNumber,
      progress: getSmartTaskProgress(task),
      criticalPath: false,
      predecessors: [...task.dependencies],
      successors: [],
      milestone: task.hours === 0,
      color: getTaskColor(task)
    };
    taskMap.set(task.id, ganttTask);
  });

  // Topological sort based on dependencies
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: string[] = [];

  const visit = (taskId: string) => {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) return; // Circular dependency

    visiting.add(taskId);
    const task = taskMap.get(taskId);
    if (task) {
      task.dependencies.forEach(depId => {
        if (taskMap.has(depId)) {
          visit(depId);
        }
      });
    }
    visiting.delete(taskId);
    visited.add(taskId);
    sorted.push(taskId);
  };

  Array.from(taskMap.keys()).forEach(visit);

  // Group tasks by phase
  const tasksByPhase: Map<number, GanttTask[]> = new Map();
  for (let phase = 1; phase <= 5; phase++) {
    tasksByPhase.set(phase, []);
  }
  sorted.forEach(taskId => {
    const task = taskMap.get(taskId);
    if (task) {
      const phaseTasks = tasksByPhase.get(task.phase) || [];
      phaseTasks.push(task);
      tasksByPhase.set(task.phase, phaseTasks);
    }
  });

  // Schedule tasks phase by phase
  for (let phase = 1; phase <= 5; phase++) {
    const phaseTasks = tasksByPhase.get(phase) || [];
    const phaseRange = PHASE_CONSTRAINTS[phase];
    if (!phaseRange || phaseTasks.length === 0) continue;

    let currentDate = new Date(phaseRange.start);

    phaseTasks.forEach((task) => {
      let earliestStart = new Date(currentDate);

      // Check dependencies
      task.dependencies.forEach(depId => {
        const dependency = taskMap.get(depId);
        if (dependency && dependency.endDate) {
          const depEnd = new Date(dependency.endDate);
          depEnd.setDate(depEnd.getDate() + 1);
          if (depEnd > earliestStart) {
            earliestStart = depEnd;
          }
        }
      });

      if (earliestStart < phaseRange.start) {
        earliestStart = new Date(phaseRange.start);
      }

      const duration = calculateTaskDuration(task);
      let endDate = addWorkDays(earliestStart, duration);

      if (endDate > phaseRange.end) {
        endDate = new Date(phaseRange.end);
      }

      task.startDate = earliestStart;
      task.endDate = endDate;
      task.weekNumber = getISOWeek(earliestStart);

      currentDate = new Date(endDate);
      currentDate.setDate(currentDate.getDate() + 1);

      scheduled.push(task);
    });
  }

  // Calculate critical path if enabled
  if (showCriticalPath) {
    taskMap.forEach(task => {
      if (!task.successors) {
        task.successors = [];
      }
    });

    taskMap.forEach(task => {
      task.dependencies.forEach(depId => {
        const dependency = taskMap.get(depId);
        if (dependency && !dependency.successors.includes(task.id)) {
          dependency.successors.push(task.id);
        }
      });
    });

    const criticalPathTasks = calculateCriticalPath(taskMap);

    scheduled.forEach(task => {
      task.criticalPath = criticalPathTasks.has(task.id);
    });
  }

  return scheduled;
};

/**
 * Manual scheduling with step-wise distribution within phases
 */
export const manualScheduleProject = (tasks: Task[], _projectStart: Date): GanttTask[] => {
  const scheduled: GanttTask[] = [];
  const taskMap = new Map<string, GanttTask>();

  // Group tasks by phase
  const tasksByPhase = new Map<number, Task[]>();
  tasks.forEach(task => {
    if (!tasksByPhase.has(task.phase)) {
      tasksByPhase.set(task.phase, []);
    }
    tasksByPhase.get(task.phase)!.push(task);
  });

  // Schedule each phase's tasks step-wise
  tasksByPhase.forEach((phaseTasks, phase) => {
    const phaseRange = PHASE_CONSTRAINTS[phase];
    if (!phaseRange) return;

    const phaseDuration = Math.ceil((phaseRange.end.getTime() - phaseRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const daysPerTask = Math.max(2, Math.floor(phaseDuration / phaseTasks.length));

    phaseTasks.forEach((task, index) => {
      const startOffset = index * daysPerTask;
      const startDate = new Date(phaseRange.start);
      startDate.setDate(startDate.getDate() + startOffset);

      if (startDate > phaseRange.end) {
        startDate.setTime(phaseRange.end.getTime());
        startDate.setDate(startDate.getDate() - 2);
      }

      const duration = calculateTaskDuration(task);
      let endDate = addWorkDays(startDate, duration);

      if (endDate > phaseRange.end) {
        endDate = new Date(phaseRange.end);
      }

      const ganttTask: GanttTask = {
        ...task,
        startDate,
        endDate,
        weekNumber: getISOWeek(startDate),
        progress: getSmartTaskProgress(task),
        criticalPath: false,
        predecessors: [...task.dependencies],
        successors: [],
        milestone: task.hours === 0,
        color: getTaskColor(task)
      };

      taskMap.set(task.id, ganttTask);
      scheduled.push(ganttTask);
    });
  });

  // Build successors relationships
  scheduled.forEach(task => {
    task.dependencies.forEach(depId => {
      const dependency = taskMap.get(depId);
      if (dependency && !dependency.successors.includes(task.id)) {
        dependency.successors.push(task.id);
      }
    });
  });

  return scheduled;
};
