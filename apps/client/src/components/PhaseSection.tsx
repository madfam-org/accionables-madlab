import React from 'react';
import { useAppStore } from '../stores/appStore';
import { usePhases, buildPhaseTitle } from '../hooks/usePhases';
import { EnhancedTaskCard } from './EnhancedTaskCard';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Task } from '../data/types';

interface PhaseSectionProps {
  phase: number;
  tasks: Task[];
}

export const PhaseSection: React.FC<PhaseSectionProps> = ({ phase, tasks }) => {
  const { language, viewMode, collapsedPhases, togglePhase } = useAppStore();

  const { data: phases = [] } = usePhases();
  const isCollapsed = collapsedPhases.has(phase);
  const phaseTasks = tasks.filter(task => task.phase === phase);
  const phaseTitle = buildPhaseTitle(phases, phase, language);

  if (phaseTasks.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => togglePhase(phase)}
        className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 transition-all group btn-ripple"
      >
        <h2 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white text-left">
          {phaseTitle}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {phaseTasks.length} tasks
          </span>
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
          ) : (
            <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
          )}
        </div>
      </button>

      {!isCollapsed && (
        <div className={`mt-4 animate-fadeIn ${
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-3'
        }`}>
          {phaseTasks.map((task, index) => (
            <div
              key={task.id}
              style={{ animationDelay: `${index * 50}ms` }}
              className="animate-fadeIn"
            >
              <EnhancedTaskCard task={task} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
