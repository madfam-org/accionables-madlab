import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { useResponsive } from '../hooks/useResponsive';

interface TooltipProps {
  content: ReactNode;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  delay?: number;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  showOnMobile?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  title,
  position = 'auto',
  delay = 500,
  className = '',
  children,
  disabled = false,
  showOnMobile = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const responsive = useResponsive();

  // Don't show tooltips on mobile unless explicitly enabled
  const shouldShow = !responsive.isTouch || showOnMobile;

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spacing = 8;

    let finalPosition = position;
    let x = 0;
    let y = 0;

    // Auto position detection
    if (position === 'auto') {
      const spaceAbove = triggerRect.top;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceLeft = triggerRect.left;
      const spaceRight = viewportWidth - triggerRect.right;

      if (spaceAbove > tooltipRect.height + spacing) {
        finalPosition = 'top';
      } else if (spaceBelow > tooltipRect.height + spacing) {
        finalPosition = 'bottom';
      } else if (spaceLeft > tooltipRect.width + spacing) {
        finalPosition = 'left';
      } else if (spaceRight > tooltipRect.width + spacing) {
        finalPosition = 'right';
      } else {
        finalPosition = 'top'; // Fallback
      }
    }

    // Calculate coordinates based on position
    switch (finalPosition) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - spacing;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + spacing;
        break;
      case 'left':
        x = triggerRect.left - tooltipRect.width - spacing;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + spacing;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Ensure tooltip stays within viewport
    x = Math.max(spacing, Math.min(x, viewportWidth - tooltipRect.width - spacing));
    y = Math.max(spacing, Math.min(y, viewportHeight - tooltipRect.height - spacing));

    setActualPosition(finalPosition);
    setCoords({ x, y });
  };

  const showTooltip = () => {
    if (disabled || !shouldShow) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Handle touch events for mobile
  const handleTouchStart = () => {
    if (!showOnMobile || disabled) return;
    setIsVisible(true);
    
    // Auto-hide after 3 seconds on mobile
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 3000);
  };

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
      
      // Recalculate on scroll or resize
      const handleRecalculate = () => calculatePosition();
      window.addEventListener('scroll', handleRecalculate, true);
      window.addEventListener('resize', handleRecalculate);
      
      return () => {
        window.removeEventListener('scroll', handleRecalculate, true);
        window.removeEventListener('resize', handleRecalculate);
      };
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getArrowClasses = () => {
    const base = 'absolute w-0 h-0 border-solid';
    switch (actualPosition) {
      case 'top':
        return `${base} -bottom-2 left-1/2 -translate-x-1/2 border-t-8 border-x-4 border-x-transparent border-t-gray-900 dark:border-t-gray-700`;
      case 'bottom':
        return `${base} -top-2 left-1/2 -translate-x-1/2 border-b-8 border-x-4 border-x-transparent border-b-gray-900 dark:border-b-gray-700`;
      case 'left':
        return `${base} -right-2 top-1/2 -translate-y-1/2 border-l-8 border-y-4 border-y-transparent border-l-gray-900 dark:border-l-gray-700`;
      case 'right':
        return `${base} -left-2 top-1/2 -translate-y-1/2 border-r-8 border-y-4 border-y-transparent border-r-gray-900 dark:border-r-gray-700`;
      default:
        return '';
    }
  };

  return (
    <>
      {/*
        eslint-disable-next-line jsx-a11y/no-static-element-interactions --
        Wrapper is a transparent tooltip trigger around `children`; keyboard
        accessibility is provided via onFocus/onBlur which propagate from the
        actual interactive child element. Adding an interactive role here
        would incorrectly steal semantics from the wrapped content.
      */}
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onTouchStart={handleTouchStart}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`fixed z-[9999] px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none animate-fade-in ${className}`}
          style={{
            left: `${coords.x}px`,
            top: `${coords.y}px`,
            maxWidth: '250px'
          }}
        >
          {title && (
            <div className="font-semibold mb-1 text-gray-100">{title}</div>
          )}
          <div className="text-gray-200">{content}</div>
          <div className={getArrowClasses()} />
        </div>
      )}
    </>
  );
};

// Specialized tooltip for task cards
interface TaskTooltipProps {
  task: {
    name: string;
    assignee: string;
    hours: number;
    difficulty: number;
    section: string;
    dependencies?: string[];
  };
  children: ReactNode;
}

export const TaskTooltip: React.FC<TaskTooltipProps> = ({ task, children }) => {
  const content = (
    <div className="space-y-2">
      <div>
        <span className="text-gray-400">Assignee:</span> {task.assignee}
      </div>
      <div>
        <span className="text-gray-400">Duration:</span> {task.hours}h
      </div>
      <div>
        <span className="text-gray-400">Difficulty:</span> {'⭐'.repeat(task.difficulty)}
      </div>
      <div>
        <span className="text-gray-400">Section:</span> {task.section}
      </div>
      {task.dependencies && task.dependencies.length > 0 && (
        <div>
          <span className="text-gray-400">Dependencies:</span> {task.dependencies.length}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip title={task.name} content={content} showOnMobile>
      {children}
    </Tooltip>
  );
};

// Specialized tooltip for team members
interface TeamTooltipProps {
  member: {
    name: string;
    role: string;
    taskCount: number;
    totalHours: number;
  };
  children: ReactNode;
}

export const TeamTooltip: React.FC<TeamTooltipProps> = ({ member, children }) => {
  const content = (
    <div className="space-y-2">
      <div>
        <span className="text-gray-400">Role:</span> {member.role}
      </div>
      <div>
        <span className="text-gray-400">Tasks:</span> {member.taskCount}
      </div>
      <div>
        <span className="text-gray-400">Total Hours:</span> {member.totalHours}h
      </div>
      <div>
        <span className="text-gray-400">Avg per Task:</span> {(member.totalHours / member.taskCount).toFixed(1)}h
      </div>
    </div>
  );

  return (
    <Tooltip title={member.name} content={content}>
      {children}
    </Tooltip>
  );
};

// Difficulty level tooltip helper
export const DifficultyTooltip: React.FC<{ level: number; children: ReactNode }> = ({ level, children }) => {
  const descriptions = {
    1: 'Very Easy - Simple task requiring basic knowledge',
    2: 'Easy - Straightforward task with clear requirements',
    3: 'Medium - Moderate complexity requiring some expertise',
    4: 'Hard - Complex task requiring advanced skills',
    5: 'Very Hard - Critical task requiring expert knowledge'
  };

  return (
    <Tooltip 
      title={`Difficulty Level ${level}`} 
      content={descriptions[level as keyof typeof descriptions]}
    >
      {children}
    </Tooltip>
  );
};