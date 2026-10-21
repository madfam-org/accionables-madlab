# React Architecture

## 🏗️ Component Hierarchy

The MADLAB application follows a clear component hierarchy with well-defined responsibilities and data flow patterns.

```
App.tsx (Root)
├── Header.tsx (Navigation & Settings)
├── FilterBar.tsx (Search & Filtering)
├── TeamSummary.tsx (Statistics Dashboard)
├── PhaseSection.tsx[] (Phase Management)
│   └── TaskCard.tsx[] (Individual Tasks)
├── ExportModal.tsx (Data Export)
└── LoadingSpinner.tsx (Loading States)
```

## 📦 Component Architecture Patterns

### 1. Container vs Presentational Components

#### Container Components
- Manage state and business logic
- Connect to Zustand store
- Handle data transformation
- Examples: `App`, `PhaseSection`

```typescript
// Container pattern example
export const PhaseSection: React.FC<PhaseSectionProps> = ({ phase }) => {
  const { language, viewMode, collapsedPhases, filteredTasks, togglePhase } = useAppStore();
  
  // Business logic
  const isCollapsed = collapsedPhases.has(phase);
  const phaseTasks = filteredTasks.filter(task => task.phase === phase);
  
  return (
    // Render UI based on state
  );
};
```

#### Presentational Components
- Focus on UI rendering
- Receive data via props
- Minimal internal state
- Examples: `ProgressBar`, `LoadingSpinner`

{% raw %}
```typescript
// Presentational pattern example
export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  value, 
  showLabel, 
  size = 'md' 
}) => {
  // Pure UI rendering
  return (
    <div className={`progress-bar ${size}`}>
      <div style={{ width: `${value}%` }} />
      {showLabel && <span>{value}%</span>}
    </div>
  );
};
```
{% endraw %}

### 2. Composition Patterns

#### Higher-Order Patterns
```typescript
// Modal wrapper pattern
const withModal = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return (props: P & { isOpen: boolean; onClose: () => void }) => {
    if (!props.isOpen) return null;
    
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <Component {...props} />
        </div>
      </div>
    );
  };
};
```

#### Children as Function Pattern
```typescript
// Tooltip provider pattern
export const TooltipProvider: React.FC<{
  children: (tooltip: TooltipState) => React.ReactNode;
}> = ({ children }) => {
  const tooltip = useTooltip();
  return <>{children(tooltip)}</>;
};
```

## 🔄 State Management Patterns

### 1. Zustand Store Integration

```typescript
// Store hook pattern
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // State
      theme: 'auto',
      language: 'es',
      
      // Actions
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      
      // Computed values
      get filteredTasks() {
        return computed filtering logic;
      }
    }),
    {
      name: 'madlab-settings',
      partialize: (state) => ({ 
        theme: state.theme, 
        language: state.language 
      })
    }
  )
);
```

### 2. Local State Patterns

#### Form State Management
```typescript
// Form state pattern
export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    scope: 'filtered',
    language: 'es',
    includeFields: defaultFields
  });

  const handleFieldChange = useCallback((field: string, value: boolean) => {
    setOptions(prev => ({
      ...prev,
      includeFields: {
        ...prev.includeFields,
        [field]: value
      }
    }));
  }, []);
};
```

#### Toggle State Pattern
```typescript
// Toggle state pattern
export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const toggleDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);
};
```

## 🎨 Styling Architecture

### 1. Tailwind CSS Integration

#### Component Styling Pattern
```typescript
// Conditional styling pattern
const cardClass = viewMode === 'grid' 
  ? 'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 card-hover animate-fadeIn'
  : 'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 card-hover animate-fadeIn mb-3';
```

#### Theme-Aware Styling
```typescript
// Theme-aware styling pattern
const getDifficultyColor = (difficulty: number) => {
  const colors = [
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    // ...more colors
  ];
  return colors[difficulty - 1] || colors[0];
};
```

### 2. Custom CSS Integration

#### Animation Patterns
```css
/* Custom animations in index.css */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}
```

## 🔧 Hook Patterns

### 1. Custom Hook Architecture

#### Tooltip Hook Pattern
```typescript
// Custom hook pattern
export const useTooltip = (options: UseTooltipOptions = {}) => {
  const [tooltip, setTooltip] = useState<TooltipState>({
    isVisible: false,
    position: { x: 0, y: 0 }
  });
  
  const showTooltip = useCallback((event: MouseEvent) => {
    // Tooltip logic
  }, []);
  
  const hideTooltip = useCallback(() => {
    // Hide logic
  }, []);
  
  const bindTooltip = useCallback((ref: RefObject<HTMLElement>) => {
    // Binding logic
  }, []);
  
  return { tooltip, bindTooltip };
};
```

### 2. Effect Patterns

#### Cleanup Pattern
```typescript
// Effect cleanup pattern
useEffect(() => {
  const element = ref.current;
  if (!element) return;

  element.addEventListener('mouseenter', showTooltip);
  element.addEventListener('mouseleave', hideTooltip);

  return () => {
    element.removeEventListener('mouseenter', showTooltip);
    element.removeEventListener('mouseleave', hideTooltip);
  };
}, []);
```

## 🚀 Performance Patterns

### 1. Optimization Techniques

#### Memoization Pattern
```typescript
// Memoization pattern
const TaskCard = React.memo<TaskCardProps>(({ task }) => {
  const memoizedProgress = useMemo(() => {
    return calculateProgress(task);
  }, [task.dependencies, task.difficulty]);
  
  const handleClick = useCallback(() => {
    // Event handler
  }, []);
  
  return (
    // Component JSX
  );
});
```

#### Virtual Rendering Pattern
```typescript
// Virtual rendering for large lists
const VirtualizedTaskList = ({ tasks }: { tasks: Task[] }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  
  const visibleTasks = useMemo(() => {
    return tasks.slice(visibleRange.start, visibleRange.end);
  }, [tasks, visibleRange]);
  
  return (
    <div className="virtual-list">
      {visibleTasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
};
```

### 2. Lazy Loading Patterns

#### Component Lazy Loading
```typescript
// Lazy component loading
const ExportModal = React.lazy(() => import('./components/ExportModal'));

// Usage with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
</Suspense>
```

## 🧪 Testing Patterns

### 1. Component Testing Pattern

```typescript
// Component testing example
describe('TaskCard', () => {
  const mockTask: Task = {
    id: 'T001',
    name: 'Test Task',
    assignee: 'John Doe',
    hours: 8,
    difficulty: 3,
    dependencies: []
  };

  it('renders task information correctly', () => {
    render(<TaskCard task={mockTask} />);
    
    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('8h')).toBeInTheDocument();
  });
});
```

### 2. Hook Testing Pattern

```typescript
// Hook testing example
describe('useTooltip', () => {
  it('shows tooltip on hover', () => {
    const { result } = renderHook(() => useTooltip());
    
    act(() => {
      // Simulate hover
    });
    
    expect(result.current.tooltip.isVisible).toBe(true);
  });
});
```

## 🎯 Best Practices

### 1. Component Design Principles

- **Single Responsibility**: Each component has one clear purpose
- **Props Interface**: Clear, typed props with defaults
- **Error Boundaries**: Graceful error handling
- **Accessibility**: ARIA labels and keyboard navigation

### 2. Performance Best Practices

- **Minimize Re-renders**: Use React.memo and useMemo strategically
- **Event Handler Optimization**: useCallback for event handlers
- **Bundle Splitting**: Lazy load non-critical components
- **Image Optimization**: Lazy load images and use proper formats

### 3. Code Organization

- **File Structure**: Logical grouping by feature
- **Import Order**: Third-party, internal, relative imports
- **Type Definitions**: Co-located with components
- **Custom Hooks**: Reusable logic extraction

### 4. State Management Best Practices

- **Minimal State**: Only store what's necessary
- **Derived State**: Compute values in selectors
- **Action Creators**: Clear, descriptive action names
- **Persistence**: Only persist user preferences