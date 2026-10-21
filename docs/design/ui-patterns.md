# UI/UX Patterns Documentation

## 🎨 Design Philosophy

The MADLAB interface follows modern design principles emphasizing clarity, accessibility, and user delight.

### Core Principles
1. **Clarity First**: Information hierarchy and visual clarity
2. **Progressive Disclosure**: Show complexity gradually
3. **Consistent Patterns**: Reusable UI patterns
4. **Responsive by Default**: Mobile-first approach
5. **Accessible Always**: WCAG 2.1 AA compliance

## 🎯 Visual Hierarchy

### Typography Scale
```css
/* Heading Hierarchy */
.text-4xl  /* h1: 36px - Page titles */
.text-3xl  /* h2: 30px - Section headers */
.text-2xl  /* h3: 24px - Subsections */
.text-xl   /* h4: 20px - Card titles */
.text-lg   /* h5: 18px - Emphasis text */
.text-base /* Body: 16px - Default text */
.text-sm   /* Small: 14px - Secondary text */
.text-xs   /* Tiny: 12px - Labels, hints */
```

### Color System

#### Semantic Colors
```css
/* Primary Actions */
--color-primary: blue-600 (light) / blue-400 (dark)

/* Success States */
--color-success: green-600 / green-400

/* Warning States */
--color-warning: yellow-600 / yellow-400

/* Error States */
--color-error: red-600 / red-400

/* Neutral */
--color-neutral: gray-600 / gray-400
```

#### Theme Palettes
```css
/* Light Theme */
--bg-primary: white
--bg-secondary: gray-50
--text-primary: gray-900
--text-secondary: gray-600

/* Dark Theme */
--bg-primary: gray-900
--bg-secondary: gray-800
--text-primary: white
--text-secondary: gray-400
```

## 🧩 Component Patterns

### Card Pattern
```tsx
<div className="
  bg-white dark:bg-gray-800 
  rounded-lg shadow-sm 
  border border-gray-200 dark:border-gray-700
  p-4 md:p-6
">
  {/* Card content */}
</div>
```

### Button Patterns

#### Primary Button
```tsx
<button className="
  px-4 py-2 
  bg-blue-600 hover:bg-blue-700 
  text-white rounded-lg 
  transition-colors
  focus:ring-2 focus:ring-blue-500
">
  Primary Action
</button>
```

#### Secondary Button
```tsx
<button className="
  px-4 py-2 
  bg-gray-100 hover:bg-gray-200 
  dark:bg-gray-700 dark:hover:bg-gray-600
  text-gray-700 dark:text-gray-300 
  rounded-lg transition-colors
">
  Secondary Action
</button>
```

#### Icon Button
```tsx
<button className="
  p-2 rounded-lg
  hover:bg-gray-100 dark:hover:bg-gray-700
  transition-colors
  focus:ring-2 focus:ring-gray-500
">
  <Icon className="w-5 h-5" />
</button>
```

### Input Patterns

#### Text Input
```tsx
<input className="
  w-full px-3 py-2 
  bg-gray-50 dark:bg-gray-900 
  border border-gray-200 dark:border-gray-700 
  rounded-lg
  focus:ring-2 focus:ring-blue-500
  focus:border-transparent
"/>
```

#### Select Dropdown
```tsx
<select className="
  w-full px-3 py-2 
  bg-gray-50 dark:bg-gray-900 
  border border-gray-200 dark:border-gray-700 
  rounded-lg
  focus:ring-2 focus:ring-blue-500
">
  <option>Option 1</option>
</select>
```

### Modal Pattern
```tsx
<div className="
  fixed inset-0 z-50 
  flex items-center justify-center 
  bg-black/50 backdrop-blur-sm
">
  <div className="
    bg-white dark:bg-gray-800 
    rounded-xl shadow-xl 
    max-w-md w-full mx-4 
    max-h-[90vh] overflow-y-auto
  ">
    {/* Modal content */}
  </div>
</div>
```

## 📱 Responsive Patterns

### Breakpoint System
```css
/* Mobile First Approach */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Responsive Grid
```tsx
<div className="
  grid grid-cols-1 
  sm:grid-cols-2 
  lg:grid-cols-3 
  xl:grid-cols-4 
  gap-4
">
  {/* Grid items */}
</div>
```

### Responsive Text
```tsx
<h1 className="
  text-2xl 
  sm:text-3xl 
  lg:text-4xl
">
  Responsive Heading
</h1>
```

### Responsive Spacing
```tsx
<div className="
  p-4 sm:p-6 lg:p-8
  space-y-4 sm:space-y-6
">
  {/* Content */}
</div>
```

## 🎭 Animation Patterns

### Transitions
```css
/* Smooth color transitions */
.transition-colors { transition: color 150ms; }

/* All property transitions */
.transition-all { transition: all 150ms; }

/* Transform transitions */
.transition-transform { transition: transform 150ms; }
```

### Hover Effects
```tsx
/* Scale on hover */
<div className="hover:scale-105 transition-transform">

/* Shadow on hover */
<div className="hover:shadow-lg transition-shadow">

/* Brightness on hover */
<div className="hover:brightness-110 transition-all">
```

### Loading States
```tsx
/* Pulse animation */
<div className="animate-pulse bg-gray-200 rounded">

/* Spin animation */
<div className="animate-spin">
  <Loader />
</div>

/* Custom shimmer */
<div className="animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200">
```

## 🎯 Interaction Patterns

### Focus States
```css
/* Visible focus indicators */
.focus:ring-2 
.focus:ring-blue-500 
.focus:ring-offset-2

/* Focus within containers */
.focus-within:ring-2
.focus-within:ring-blue-500
```

### Active States
```css
/* Button press effect */
.active:scale-95
.active:bg-blue-700

/* Selected state */
.selected:bg-blue-100
.selected:border-blue-500
```

### Disabled States
```css
/* Disabled styling */
.disabled:opacity-50
.disabled:cursor-not-allowed
.disabled:pointer-events-none
```

## 📊 Data Display Patterns

### Table Pattern
```tsx
<table className="w-full">
  <thead className="bg-gray-50 dark:bg-gray-800">
    <tr>
      <th className="px-4 py-2 text-left">Header</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
      <td className="px-4 py-2">Data</td>
    </tr>
  </tbody>
</table>
```

### List Pattern
```tsx
<ul className="space-y-2">
  <li className="
    p-4 rounded-lg 
    bg-white dark:bg-gray-800 
    border border-gray-200 dark:border-gray-700
    hover:shadow-md transition-shadow
  ">
    {/* List item content */}
  </li>
</ul>
```

### Badge Pattern
```tsx
<span className="
  inline-flex items-center 
  px-2 py-1 
  text-xs font-medium 
  bg-blue-100 text-blue-800 
  dark:bg-blue-900 dark:text-blue-200 
  rounded-full
">
  Badge Text
</span>
```

## 🌈 Theme Patterns

### Theme Toggle
```tsx
const ThemeToggle = () => {
  const { theme, setTheme } = useAppStore();
  
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </button>
  );
};
```

### Theme-Aware Colors
```tsx
/* Automatic theme switching */
<div className="
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-white
  border-gray-200 dark:border-gray-700
">
```

## ♿ Accessibility Patterns

### ARIA Labels
```tsx
<button aria-label="Close dialog">
  <X className="w-5 h-5" />
</button>

<nav aria-label="Main navigation">
  {/* Navigation items */}
</nav>
```

### Keyboard Navigation
```tsx
<div 
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleAction();
    }
  }}
>
```

### Screen Reader Support
```tsx
<span className="sr-only">
  Loading, please wait...
</span>

<div role="status" aria-live="polite">
  {statusMessage}
</div>
```

### Focus Management
```tsx
useEffect(() => {
  if (isOpen) {
    modalRef.current?.focus();
  }
}, [isOpen]);
```

## 📐 Layout Patterns

### Container Pattern
```tsx
<div className="container mx-auto px-4 sm:px-6 lg:px-8">
  {/* Content with consistent padding */}
</div>
```

### Sidebar Layout
```tsx
<div className="flex">
  <aside className="w-64 flex-shrink-0">
    {/* Sidebar */}
  </aside>
  <main className="flex-1">
    {/* Main content */}
  </main>
</div>
```

### Sticky Header
```tsx
<header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b">
  {/* Header content */}
</header>
```

## 🎪 Special Effects

### Glassmorphism
```css
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

### Gradient Backgrounds
```tsx
<div className="bg-gradient-to-r from-blue-500 to-purple-600">
  {/* Content */}
</div>
```

### Shadow Elevation
```css
/* Elevation levels */
.shadow-sm   /* Subtle: 1dp */
.shadow      /* Default: 2dp */
.shadow-md   /* Medium: 4dp */
.shadow-lg   /* Large: 8dp */
.shadow-xl   /* Extra: 16dp */
.shadow-2xl  /* Extreme: 24dp */
```

## 📱 Mobile Patterns

### Touch Targets
```css
/* Minimum 44x44px touch targets */
.min-h-[44px] 
.min-w-[44px]
```

### Swipe Gestures
```tsx
const handleTouchStart = (e: TouchEvent) => {
  startX = e.touches[0].clientX;
};

const handleTouchEnd = (e: TouchEvent) => {
  const endX = e.changedTouches[0].clientX;
  if (startX - endX > 50) {
    // Swiped left
  }
};
```

### Mobile Menu
```tsx
<div className={`
  fixed inset-0 z-50 lg:hidden
  transform transition-transform
  ${isOpen ? 'translate-x-0' : '-translate-x-full'}
`}>
  {/* Mobile menu content */}
</div>
```

## 🎉 Micro-interactions

### Button Feedback
```css
/* Ripple effect on click */
@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

.ripple::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  animation: ripple 600ms;
}
```

### Success Animation
{% raw %}
```tsx
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ type: "spring" }}
>
  <CheckCircle className="text-green-500" />
</motion.div>
```
{% endraw %}

---

*For implementation examples, see the [Component Documentation](../components/README.md)*