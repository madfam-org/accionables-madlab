import React, { useState } from 'react';
import { GanttTask } from '../../stores/appStore';
import { useAppStore } from '../../stores/appStore';
import { translations } from '../../data/translations';

interface GanttTaskBarProps {
  task: GanttTask;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const GanttTaskBar: React.FC<GanttTaskBarProps> = ({ 
  task, 
  x, 
  y, 
  width, 
  height 
}) => {
  const { language } = useAppStore();
  const t = translations[language];
  const [isHovered, setIsHovered] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  };

  const getDifficultyText = (difficulty: number) => {
    const levels = {
      1: language === 'es' ? 'Fácil' : 'Easy',
      2: language === 'es' ? 'Medio' : 'Medium',
      3: language === 'es' ? 'Difícil' : 'Hard',
      4: language === 'es' ? 'Muy Difícil' : 'Very Hard',
      5: language === 'es' ? 'Experto' : 'Expert'
    };
    return levels[difficulty as keyof typeof levels] || '';
  };

  const taskLabel = language === 'es' ? task.name : task.nameEn;
  const ariaLabel = `${task.id} - ${taskLabel} (${task.assignee}, ${task.hours}h, ${task.progress}%)`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="absolute group cursor-pointer appearance-none bg-transparent border-0 p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
      style={{
        left: x,
        top: y + 10, // Center vertically with some padding
        width: width,
        height: height
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      {/* Task Bar */}
      <div
        className={`relative h-full rounded shadow-sm transition-all duration-200 ${
          task.milestone 
            ? 'transform rotate-45' 
            : ''
        } ${
          isHovered 
            ? 'shadow-lg transform -translate-y-1' 
            : ''
        } ${
          task.criticalPath 
            ? 'ring-2 ring-red-500' 
            : ''
        }`}
        style={{
          backgroundColor: task.color,
          opacity: task.milestone ? 0.8 : 0.9
        }}
      >
        {/* Progress Overlay */}
        {!task.milestone && (
          <div
            className="absolute left-0 top-0 bottom-0 bg-black bg-opacity-20 rounded-l"
            style={{ width: `${task.progress}%` }}
          />
        )}

        {/* Task Label */}
        {width > 60 && (
          <div className="absolute inset-0 flex items-center px-2">
            <span 
              className="text-xs font-medium text-white truncate"
              style={{ 
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                maxWidth: width - 16
              }}
            >
              {task.id}
            </span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {isHovered && (
        <div 
          className="absolute z-30 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-xl p-3 min-w-[250px]"
          style={{
            bottom: height + 10,
            left: Math.max(0, width / 2 - 125), // Center tooltip, but keep in bounds
          }}
        >
          {/* Arrow */}
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #374151'
            }}
          />

          {/* Content */}
          <div className="space-y-2">
            <div className="font-medium">
              {task.id} - {language === 'es' ? task.name : task.nameEn}
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <span className="text-gray-300">{t.assignedTo}:</span>
                <span className="ml-1 text-white">{task.assignee}</span>
              </div>
              <div>
                <span className="text-gray-300">{t.duration}:</span>
                <span className="ml-1 text-white">{task.hours}h</span>
              </div>
              <div>
                <span className="text-gray-300">{t.difficulty}:</span>
                <span className="ml-1 text-white">{getDifficultyText(task.difficulty)}</span>
              </div>
              <div>
                <span className="text-gray-300">{t.progress}:</span>
                <span className="ml-1 text-white">{task.progress}%</span>
              </div>
            </div>

            <div className="text-xs">
              <div className="text-gray-300">{t.timeline}:</div>
              <div className="text-white">
                {formatDate(task.startDate)} - {formatDate(task.endDate)}
              </div>
            </div>

            {task.dependencies.length > 0 && (
              <div className="text-xs">
                <div className="text-gray-300">{t.dependencies}:</div>
                <div className="text-white">
                  {task.dependencies.join(', ')}
                </div>
              </div>
            )}

            {task.milestone && (
              <div className="text-xs text-yellow-400 font-medium">
                ◆ {language === 'es' ? 'Hito del proyecto' : 'Project Milestone'}
              </div>
            )}

            {task.criticalPath && (
              <div className="text-xs text-red-400 font-medium">
                ⚠ {language === 'es' ? 'Ruta crítica' : 'Critical Path'}
              </div>
            )}
          </div>
        </div>
      )}
    </button>
  );
};