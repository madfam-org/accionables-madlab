# Advanced Tutorials

Step-by-step guides for advanced MADLAB features and customization.

## Table of Contents

1. [Creating Custom Components](#creating-custom-components)
2. [Extending the Zustand Store](#extending-the-zustand-store)
3. [Adding New Grouping Options](#adding-new-grouping-options)
4. [Implementing Custom Export Formats](#implementing-custom-export-formats)
5. [Creating Custom Gantt Views](#creating-custom-gantt-views)
6. [Building Accessibility-First Features](#building-accessibility-first-features)
7. [Performance Optimization Techniques](#performance-optimization-techniques)

---

## 1. Creating Custom Components

### Tutorial: Building a Custom Task Filter Component

**Goal**: Create a custom date range filter component that integrates with the existing filter system.

#### Step 1: Create the Component File

```bash
touch src/components/DateRangeFilter.tsx
```

#### Step 2: Define the Component Structure

```tsx
// src/components/DateRangeFilter.tsx
import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

interface DateRangeFilterProps {
  compact?: boolean;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ compact = false }) => {
  const { language } = useAppStore();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const handleApply = () => {
    // Integrate with store's filter system
    console.log('Filter by date range:', startDate, endDate);
  };

  return (
    <div className={compact ? 'flex gap-2' : 'flex flex-col gap-2'}>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-500" aria-hidden="true" />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          aria-label={language === 'es' ? 'Fecha de inicio' : 'Start date'}
        />
        <span>-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          aria-label={language === 'es' ? 'Fecha de fin' : 'End date'}
        />
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {language === 'es' ? 'Aplicar' : 'Apply'}
        </button>
      </div>
    </div>
  );
};
```

#### Step 3: Add Tests

```tsx
// src/components/__tests__/DateRangeFilter.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangeFilter } from '../DateRangeFilter';

describe('DateRangeFilter', () => {
  it('should render date inputs', () => {
    render(<DateRangeFilter />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
  });

  it('should update dates on change', () => {
    render(<DateRangeFilter />);
    const [startInput] = screen.getAllByRole('textbox');

    fireEvent.change(startInput, { target: { value: '2025-08-11' } });
    expect(startInput).toHaveValue('2025-08-11');
  });
});
```

#### Step 4: Integrate with UnifiedToolbarV2

```tsx
// src/components/UnifiedToolbarV2.tsx
import { DateRangeFilter } from './DateRangeFilter';

// Add to toolbar
<div className="flex flex-wrap gap-4">
  {/* Existing filters */}
  <DateRangeFilter compact={true} />
</div>
```

**Key Learnings**:
- Follow existing component patterns
- Integrate with Zustand store
- Maintain accessibility standards
- Add comprehensive tests

---

## 2. Extending the Zustand Store

### Tutorial: Adding Task Tagging System

**Goal**: Add a tagging system to categorize tasks.

#### Step 1: Extend Types

```tsx
// src/data/types.ts
export interface Task {
  // ... existing properties
  tags?: string[];  // Add tags property
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  count: number;
}
```

#### Step 2: Update Store Interface

```tsx
// src/stores/appStore.ts
interface AppState {
  // ... existing state
  tags: Tag[];
  selectedTags: string[];

  // ... existing actions
  addTag: (tag: Tag) => void;
  removeTag: (tagId: string) => void;
  toggleTagFilter: (tagId: string) => void;
  addTaskTag: (taskId: string, tagId: string) => void;
  removeTaskTag: (taskId: string, tagId: string) => void;
}
```

#### Step 3: Implement Store Actions

```tsx
// In create() callback
tags: [],
selectedTags: [],

addTag: (tag) => set((state) => ({
  tags: [...state.tags, tag],
})),

removeTag: (tagId) => set((state) => ({
  tags: state.tags.filter(t => t.id !== tagId),
  selectedTags: state.selectedTags.filter(id => id !== tagId),
})),

toggleTagFilter: (tagId) => set((state) => ({
  selectedTags: state.selectedTags.includes(tagId)
    ? state.selectedTags.filter(id => id !== tagId)
    : [...state.selectedTags, tagId],
})),

addTaskTag: (taskId, tagId) => set((state) => ({
  tasks: state.tasks.map(task =>
    task.id === taskId
      ? { ...task, tags: [...(task.tags || []), tagId] }
      : task
  ),
})),
```

#### Step 4: Create Tag Management Component

{% raw %}
```tsx
// src/components/TagManager.tsx
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

export const TagManager: React.FC = () => {
  const { tags, addTag, removeTag } = useAppStore();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');

  const handleAddTag = () => {
    if (!newTagName.trim()) return;

    addTag({
      id: `tag-${Date.now()}`,
      name: newTagName,
      color: newTagColor,
      count: 0,
    });

    setNewTagName('');
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Manage Tags</h3>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="Tag name"
          className="flex-1 px-3 py-2 border rounded-lg"
        />
        <input
          type="color"
          value={newTagColor}
          onChange={(e) => setNewTagColor(e.target.value)}
          className="w-12 h-10 rounded-lg cursor-pointer"
        />
        <button
          onClick={handleAddTag}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <div
            key={tag.id}
            className="flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ backgroundColor: tag.color + '20', color: tag.color }}
          >
            <span>{tag.name}</span>
            <span className="text-xs opacity-70">({tag.count})</span>
            <button onClick={() => removeTag(tag.id)} className="hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```
{% endraw %}

**Key Learnings**:
- Extend types first
- Update store interface
- Implement actions with immutability
- Create UI components last

---

## 3. Adding New Grouping Options

### Tutorial: Group Tasks by Priority

**Goal**: Add "priority" as a grouping option.

#### Step 1: Update Types

```tsx
// src/components/GroupingSelector.tsx
export type GroupingOption = 'phase' | 'assignee' | 'difficulty' | 'week' | 'priority';
```

#### Step 2: Add Priority to Task Data

```tsx
// src/data/types.ts
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  // ... existing properties
  priority?: Priority;
}
```

#### Step 3: Implement Grouping Logic

```tsx
// src/utils/taskGrouping.ts
export const groupTasks = (
  tasks: Task[],
  groupBy: GroupingOption,
  language: Language
): Map<string, Task[]> => {
  const groups = new Map<string, Task[]>();

  tasks.forEach(task => {
    let key: string;

    switch (groupBy) {
      case 'priority':
        const priorityLabels = {
          critical: language === 'es' ? 'Crítico' : 'Critical',
          high: language === 'es' ? 'Alto' : 'High',
          medium: language === 'es' ? 'Medio' : 'Medium',
          low: language === 'es' ? 'Bajo' : 'Low',
        };
        key = priorityLabels[task.priority || 'medium'];
        break;

      // ... existing cases
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(task);
  });

  return groups;
};
```

#### Step 4: Update GroupingSelector UI

```tsx
// src/components/GroupingSelector.tsx
const options: { value: GroupingOption; label: string }[] = [
  { value: 'phase', label: t.groupByPhase },
  { value: 'assignee', label: t.groupByAssignee },
  { value: 'difficulty', label: t.groupByDifficulty },
  { value: 'week', label: t.groupByWeek },
  { value: 'priority', label: language === 'es' ? 'Prioridad' : 'Priority' },
];
```

#### Step 5: Add Translations

```tsx
// src/data/translations.ts
export const translations = {
  es: {
    // ... existing
    groupByPriority: 'Prioridad',
  },
  en: {
    // ... existing
    groupByPriority: 'Priority',
  },
};
```

**Key Learnings**:
- Extend enums properly
- Update all related utilities
- Add translations
- Test with different languages

---

## 4. Implementing Custom Export Formats

### Tutorial: Add Markdown Export

**Goal**: Export project data as formatted Markdown.

#### Step 1: Create Export Utility

```tsx
// src/utils/exportMarkdown.ts
import { Task } from '../data/types';

export const exportAsMarkdown = (tasks: Task[], language: 'es' | 'en'): string => {
  const title = language === 'es' ? '# Proyecto MADLAB\n\n' : '# MADLAB Project\n\n';

  let markdown = title;
  markdown += `**${language === 'es' ? 'Total de tareas' : 'Total tasks'}**: ${tasks.length}\n\n`;

  // Group by phase
  const phases = new Map<number, Task[]>();
  tasks.forEach(task => {
    if (!phases.has(task.phase)) {
      phases.set(task.phase, []);
    }
    phases.get(task.phase)!.push(task);
  });

  // Generate markdown for each phase
  phases.forEach((phaseTasks, phaseNumber) => {
    markdown += `## ${language === 'es' ? 'Fase' : 'Phase'} ${phaseNumber}\n\n`;

    phaseTasks.forEach(task => {
      markdown += `### ${language === 'es' ? task.name : task.nameEn}\n\n`;
      markdown += `- **${language === 'es' ? 'Asignado a' : 'Assigned to'}**: ${task.assignee}\n`;
      markdown += `- **${language === 'es' ? 'Horas' : 'Hours'}**: ${task.hours}h\n`;
      markdown += `- **${language === 'es' ? 'Dificultad' : 'Difficulty'}**: ${task.difficulty}/5\n`;

      if (task.dependencies.length > 0) {
        markdown += `- **${language === 'es' ? 'Dependencias' : 'Dependencies'}**: ${task.dependencies.join(', ')}\n`;
      }

      markdown += '\n';
    });
  });

  return markdown;
};

export const downloadMarkdown = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
```

#### Step 2: Add to Export Modal

```tsx
// src/components/EnhancedExportModal.tsx
import { exportAsMarkdown, downloadMarkdown } from '../utils/exportMarkdown';

const handleExport = () => {
  switch (format) {
    case 'markdown':
      const markdownContent = exportAsMarkdown(filteredTasks, language);
      downloadMarkdown(markdownContent, 'madlab-tasks.md');
      break;

    // ... existing cases
  }
};

// Add to format options
<option value="markdown">Markdown (.md)</option>
```

**Key Learnings**:
- Keep export logic separate from UI
- Support bilingual exports
- Handle file downloads properly
- Provide preview before export

---

## 5. Creating Custom Gantt Views

### Tutorial: Add Resource Utilization View

**Goal**: Create a Gantt view showing team member workload over time.

#### Step 1: Create Utility Function

```tsx
// src/utils/resourceUtilization.ts
import { Task } from '../data/types';
import { getISOWeek } from './dateHelpers';

interface ResourceUtilization {
  assignee: string;
  weeklyHours: Map<number, number>;
  totalHours: number;
  peakHours: number;
  avgHours: number;
}

export const calculateResourceUtilization = (
  tasks: Task[]
): ResourceUtilization[] => {
  const utilization = new Map<string, ResourceUtilization>();

  tasks.forEach(task => {
    if (!utilization.has(task.assignee)) {
      utilization.set(task.assignee, {
        assignee: task.assignee,
        weeklyHours: new Map(),
        totalHours: 0,
        peakHours: 0,
        avgHours: 0,
      });
    }

    const resource = utilization.get(task.assignee)!;

    // Distribute hours across weeks (simplified)
    const weekNumber = task.startDate
      ? getISOWeek(new Date(task.startDate))
      : 33; // Default week

    const currentHours = resource.weeklyHours.get(weekNumber) || 0;
    resource.weeklyHours.set(weekNumber, currentHours + task.hours);
    resource.totalHours += task.hours;
  });

  // Calculate peaks and averages
  utilization.forEach(resource => {
    const hours = Array.from(resource.weeklyHours.values());
    resource.peakHours = Math.max(...hours);
    resource.avgHours = resource.totalHours / hours.length;
  });

  return Array.from(utilization.values());
};
```

#### Step 2: Create Visualization Component

{% raw %}
```tsx
// src/components/GanttChart/ResourceUtilizationView.tsx
import { useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { calculateResourceUtilization } from '../../utils/resourceUtilization';

export const ResourceUtilizationView: React.FC = () => {
  const { filteredTasks } = useAppStore();

  const utilization = useMemo(
    () => calculateResourceUtilization(filteredTasks),
    [filteredTasks]
  );

  return (
    <div className="p-4">
      <h3 className="text-xl font-bold mb-4">Resource Utilization</h3>

      {utilization.map(resource => (
        <div key={resource.assignee} className="mb-6">
          <h4 className="font-semibold mb-2">{resource.assignee}</h4>

          <div className="flex items-center gap-2 mb-2 text-sm">
            <span>Total: {resource.totalHours}h</span>
            <span>Peak: {resource.peakHours}h/week</span>
            <span>Avg: {resource.avgHours.toFixed(1)}h/week</span>
          </div>

          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex">
            {Array.from(resource.weeklyHours.entries()).map(([week, hours]) => {
              const percentage = (hours / 40) * 100; // 40h = 100%
              const color = percentage > 100 ? 'bg-red-500' :
                           percentage > 75 ? 'bg-yellow-500' :
                           'bg-green-500';

              return (
                <div
                  key={week}
                  className={`flex-1 ${color}`}
                  style={{ height: `${Math.min(percentage, 100)}%` }}
                  title={`Week ${week}: ${hours}h`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
```
{% endraw %}

**Key Learnings**:
- Use memoization for expensive calculations
- Visualize data effectively
- Provide meaningful tooltips
- Consider mobile responsiveness

---

## 6. Building Accessibility-First Features

### Tutorial: Create an Accessible Notification System

**Goal**: Build a notification system that works with screen readers.

#### Step 1: Create Notification Component

```tsx
// src/components/AccessibleNotification.tsx
import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface AccessibleNotificationProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export const AccessibleNotification: React.FC<AccessibleNotificationProps> = ({
  notifications,
  onDismiss,
}) => {
  const [announced, setAnnounced] = useState<Set<string>>(new Set());

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  const colors = {
    success: 'bg-green-100 border-green-500 text-green-900',
    error: 'bg-red-100 border-red-500 text-red-900',
    info: 'bg-blue-100 border-blue-500 text-blue-900',
  };

  useEffect(() => {
    notifications.forEach(notification => {
      if (!announced.has(notification.id)) {
        setAnnounced(prev => new Set(prev).add(notification.id));

        // Auto-dismiss after duration
        if (notification.duration) {
          setTimeout(() => {
            onDismiss(notification.id);
          }, notification.duration);
        }
      }
    });
  }, [notifications, announced, onDismiss]);

  return (
    <>
      {/* Visual notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => {
          const Icon = icons[notification.type];

          return (
            <div
              key={notification.id}
              className={`flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg ${colors[notification.type]} animate-slideIn`}
              role="alert"
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <p className="flex-1">{notification.message}</p>
              <button
                onClick={() => onDismiss(notification.id)}
                className="flex-shrink-0 hover:opacity-70"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {notifications[notifications.length - 1]?.message}
      </div>
    </>
  );
};
```

#### Step 2: Create Notification Hook

```tsx
// src/hooks/useNotifications.ts
import { useState, useCallback } from 'react';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((
    type: 'success' | 'error' | 'info',
    message: string,
    duration = 5000
  ) => {
    const id = `notification-${Date.now()}`;
    setNotifications(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications,
    addNotification,
    dismissNotification,
  };
};
```

#### Step 3: Integrate with App

```tsx
// src/App.tsx
import { AccessibleNotification } from './components/AccessibleNotification';
import { useNotifications } from './hooks/useNotifications';

function App() {
  const { notifications, addNotification, dismissNotification } = useNotifications();

  // Use anywhere in your app:
  // addNotification('success', 'Task completed!');

  return (
    <div>
      {/* ... existing content */}
      <AccessibleNotification
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  );
}
```

**Key Learnings**:
- Separate visual and screen reader announcements
- Use `role="alert"` for important notifications
- Auto-dismiss with configurable duration
- Provide dismiss buttons with labels

---

## 7. Performance Optimization Techniques

### Tutorial: Optimizing Large Task Lists

**Goal**: Improve rendering performance for 1000+ tasks.

#### Step 1: Implement Virtualization

```bash
npm install react-virtual
```

{% raw %}
```tsx
// src/components/VirtualizedTaskList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { TaskCard } from './TaskCard';
import { Task } from '../data/types';

interface VirtualizedTaskListProps {
  tasks: Task[];
  view: 'grid' | 'list';
}

export const VirtualizedTaskList: React.FC<VirtualizedTaskListProps> = ({
  tasks,
  view,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (view === 'grid' ? 200 : 100),
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <TaskCard task={tasks[virtualRow.index]} view={view} />
          </div>
        ))}
      </div>
    </div>
  );
};
```
{% endraw %}

#### Step 2: Memoize Expensive Calculations

```tsx
// src/components/StatsGrid.tsx
import { useMemo } from 'react';

export const StatsGrid: React.FC = () => {
  const { filteredTasks } = useAppStore();

  const stats = useMemo(() => {
    // Only recalculate when filteredTasks changes
    return {
      totalTasks: filteredTasks.length,
      totalHours: filteredTasks.reduce((sum, t) => sum + t.hours, 0),
      // ... more calculations
    };
  }, [filteredTasks]);

  return (/* ... */);
};
```

#### Step 3: Implement Debounced Search

```tsx
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Usage in search component
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 300);

useEffect(() => {
  setFilter('search', debouncedSearch);
}, [debouncedSearch, setFilter]);
```

#### Step 4: Code Splitting with Lazy Loading

```tsx
// src/App.tsx
import { lazy, Suspense } from 'react';

const GanttChart = lazy(() => import('./components/GanttChart/GanttChart'));
const ExportModal = lazy(() => import('./components/EnhancedExportModal'));

function App() {
  return (
    <div>
      <Suspense fallback={<LoadingSpinner />}>
        {viewMode === 'gantt' && <GanttChart />}
      </Suspense>
    </div>
  );
}
```

**Key Learnings**:
- Use virtualization for long lists
- Memoize expensive calculations
- Debounce user input
- Lazy load heavy components
- Monitor performance with React DevTools

---

## Best Practices Summary

### 1. Code Organization
- Keep components small and focused
- Extract reusable logic into hooks
- Separate business logic from UI
- Use TypeScript for type safety

### 2. Performance
- Memoize expensive calculations
- Use virtualization for large lists
- Implement code splitting
- Optimize bundle size

### 3. Accessibility
- Use semantic HTML
- Add ARIA labels
- Support keyboard navigation
- Test with screen readers

### 4. Testing
- Write tests alongside features
- Test user interactions
- Mock external dependencies
- Aim for 80%+ coverage

### 5. State Management
- Keep state close to where it's used
- Use Zustand for global state
- Normalize complex data structures
- Avoid prop drilling

---

**Last Updated**: November 22, 2024
**Difficulty**: Advanced
**Estimated Time**: 2-4 hours per tutorial

*Master advanced MADLAB development techniques with these hands-on tutorials*
