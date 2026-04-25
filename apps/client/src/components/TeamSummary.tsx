import React, { useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { translations } from '../data/translations';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { User, Clock, CheckSquare, Users } from 'lucide-react';
import { Task } from '../data/types';

interface TeamSummaryProps {
  tasks: Task[];
}

export const TeamSummary: React.FC<TeamSummaryProps> = ({ tasks }) => {
  const { language } = useAppStore();
  const t = translations[language];
  const { data: teamMembers = [] } = useTeamMembers();

  // Calculate stats for each team member including "All"
  const teamMemberStats = useMemo(() => {
    const individualStats = teamMembers.map(member => {
      const memberTasks = tasks.filter(task => task.assignee === member.name);
      return {
        ...member,
        tasks: memberTasks.length,
        hours: memberTasks.reduce((sum, task) => sum + task.hours, 0)
      };
    });

    // Add "All" team stats
    const allTasks = tasks.filter(task => task.assignee === 'All');
    const wholeTeamStats = {
      name: 'All',
      role: 'Equipo Completo',
      roleEn: 'Whole Team',
      tasks: allTasks.length,
      hours: allTasks.reduce((sum, task) => sum + task.hours, 0)
    };

    return [...individualStats, wholeTeamStats];
  }, [tasks]);

  const getColorForMember = (name: string) => {
    const colors = {
      'Aldo': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      'Nuri': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      'Luis': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
      'Silvia': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400 border-pink-200 dark:border-pink-800',
      'Caro': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
      'All': 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-800 dark:from-indigo-900/30 dark:to-purple-900/30 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700'
    };
    return colors[name as keyof typeof colors] || colors['Aldo'];
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t.teamSummary}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {teamMemberStats.map(member => (
          <div
            key={member.name}
            className={`rounded-lg border-2 p-4 transition-all hover:shadow-lg ${getColorForMember(member.name)}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-white/50 dark:bg-gray-800/50 flex items-center justify-center">
                {member.name === 'All' ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-base">
                  {member.name}
                </h3>
                <p className="text-xs opacity-80">
                  {language === 'es' ? member.role : member.roleEn}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <CheckSquare className="w-4 h-4" />
                  <span className="text-sm font-medium">{member.tasks}</span>
                </div>
                <span className="text-xs opacity-80">{t.tasks}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{member.hours}</span>
                </div>
                <span className="text-xs opacity-80">{t.hours}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
