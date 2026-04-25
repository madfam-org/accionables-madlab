import { useState } from 'react';
import { Bot, ChevronDown, ChevronUp, Settings, Sparkles } from 'lucide-react';
import { AgentType, AGENT_PERSONALITIES } from '../../types/agents';
import { useAgentStore } from '../../stores/agentStore';
import { useAppStore } from '../../stores/appStore';
import { AgentSuggestionCard } from './AgentSuggestionCard';

interface AgentPanelProps {
  position?: 'sidebar' | 'floating' | 'bottom';
}

export function AgentPanel({ position = 'sidebar' }: AgentPanelProps) {
  const { language, ndProfile } = useAppStore();
  const {
    activeAgents,
    toggleAgent,
    getActiveSuggestions,
    clearAllSuggestions,
    getAgentEffectiveness,
  } = useAgentStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const activeSuggestions = getActiveSuggestions();
  const agentTypes: AgentType[] = ['breakdown', 'reminder', 'draft', 'calm', 'focus', 'celebrate'];

  // Filter suggestions based on ND profile agent preferences
  const filteredSuggestions = activeSuggestions.filter((s) => {
    const prefs = ndProfile.agents;
    switch (s.agentType) {
      case 'breakdown':
        return prefs.breakdownAgent;
      case 'reminder':
        return prefs.reminderAgent;
      case 'draft':
        return prefs.draftAgent;
      case 'calm':
        return prefs.calmAgent;
      default:
        return activeAgents.has(s.agentType);
    }
  });

  const containerClasses = {
    sidebar: 'w-full',
    floating: 'fixed bottom-4 right-4 w-96 shadow-2xl rounded-2xl',
    bottom: 'fixed bottom-0 left-0 right-0 shadow-2xl',
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${
        position === 'floating' ? 'rounded-2xl' : ''
      } ${containerClasses[position]}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="flex flex-1 items-center gap-2 cursor-pointer bg-transparent border-0 p-0 text-left appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-indigo-500" />
            {filteredSuggestions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {filteredSuggestions.length}
              </span>
            )}
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {language === 'es' ? 'Asistentes IA' : 'AI Assistants'}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={language === 'es' ? 'Configuración de agentes' : 'Agent settings'}
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={
              isExpanded
                ? language === 'es' ? 'Colapsar panel' : 'Collapse panel'
                : language === 'es' ? 'Expandir panel' : 'Expand panel'
            }
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Agent Settings Panel */}
          {showSettings && (
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                {language === 'es' ? 'Agentes Activos' : 'Active Agents'}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {agentTypes.map((agentType) => {
                  const personality = AGENT_PERSONALITIES[agentType];
                  const isActive = activeAgents.has(agentType);
                  const effectiveness = getAgentEffectiveness(agentType);

                  return (
                    <button
                      key={agentType}
                      onClick={() => toggleAgent(agentType)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                        isActive
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-300 dark:border-indigo-600'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 opacity-60'
                      }`}
                    >
                      <span className="text-xl">{personality.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {language === 'es' ? personality.name : personality.nameEn}
                        </div>
                        {isActive && (
                          <div className="flex items-center gap-1">
                            <div className="h-1 flex-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${effectiveness * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {Math.round(effectiveness * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {filteredSuggestions.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  {language === 'es'
                    ? 'Tus asistentes están listos para ayudarte'
                    : 'Your assistants are ready to help'}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  {language === 'es'
                    ? 'Las sugerencias aparecerán aquí'
                    : 'Suggestions will appear here'}
                </p>
              </div>
            ) : (
              <>
                {filteredSuggestions.map((suggestion) => (
                  <AgentSuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    compact={position === 'bottom'}
                  />
                ))}
                {filteredSuggestions.length > 1 && (
                  <button
                    onClick={clearAllSuggestions}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                  >
                    {language === 'es' ? 'Descartar todas' : 'Dismiss all'}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
