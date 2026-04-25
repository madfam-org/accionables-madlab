import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Sparkles,
  Brain,
  Clock,
  ArrowRight,
  CheckCircle2,
  Moon,
  Sun,
  Play,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useDemoProjects, type DemoProject } from '../hooks/useDemoProjects';
import { useAppStore } from '../stores/appStore';
import { waitlistApi } from '../api/waitlist';

export function LandingPage() {
  const { data: demoProjects = [] } = useDemoProjects();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitlistCount, setWaitlistCount] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const navigate = useNavigate();
  const { setCulminatingEvent, setGanttConfig } = useAppStore();

  // Fetch waitlist count for social proof
  useEffect(() => {
    waitlistApi.getCount()
      .then((response) => {
        if (response.success && response.count > 0) {
          setWaitlistCount(response.display);
        }
      })
      .catch(() => {
        // Silently fail - social proof is optional
      });
  }, []);

  const handleTryDemo = (project: DemoProject) => {
    // Set the culminating event from the demo project
    setCulminatingEvent(project.event);
    // Configure Gantt to show convergence
    setGanttConfig({
      showConvergence: true,
      startDate: new Date(),
      endDate: new Date(project.event.date.getTime() + 7 * 24 * 60 * 60 * 1000), // event + 1 week
    });
    // Navigate to the app
    navigate('/app');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await waitlistApi.signup({ email });
      if (response.success) {
        setSubmitted(true);
        // Refresh count after signup
        waitlistApi.getCount().then((countResponse) => {
          if (countResponse.success && countResponse.count > 0) {
            setWaitlistCount(countResponse.display);
          }
        });
      } else {
        setError(response.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Unable to join waitlist. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${
      theme === 'dark'
        ? 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100'
        : 'bg-gradient-to-b from-stone-50 via-white to-stone-100 text-slate-800'
    }`}>
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={`fixed top-6 right-6 p-3 rounded-full transition-all duration-300 ${
          theme === 'dark'
            ? 'bg-slate-700/50 hover:bg-slate-700 text-amber-300'
            : 'bg-stone-200/50 hover:bg-stone-200 text-slate-600'
        }`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Hero Section */}
      <header className="container mx-auto px-6 pt-20 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo/Brand */}
          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full mb-8 ${
            theme === 'dark' ? 'bg-slate-800/50' : 'bg-stone-100'
          }`}>
            <Brain className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} size={24} />
            <span className="font-medium tracking-wide">MADLAB</span>
          </div>

          {/* Headline */}
          <h1 className={`text-4xl md:text-6xl font-light leading-tight mb-6 ${
            theme === 'dark' ? 'text-slate-100' : 'text-slate-800'
          }`}>
            Project management that{' '}
            <span className={`font-medium ${
              theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
            }`}>
              gets your brain
            </span>
          </h1>

          {/* Subheadline */}
          <p className={`text-xl md:text-2xl font-light leading-relaxed mb-12 max-w-2xl mx-auto ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            An event convergence orchestrator designed for neurodivergent minds.
            Visual calm. AI assistance. Synchronized flow.
          </p>

          {/* Waitlist Form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className={`flex flex-col sm:flex-row gap-3 p-2 rounded-2xl ${
                theme === 'dark' ? 'bg-slate-800/50' : 'bg-stone-100'
              }`}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={isLoading}
                  className={`flex-1 px-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500 transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-700/50 text-slate-100 placeholder-slate-500'
                      : 'bg-white text-slate-800 placeholder-slate-400'
                  } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                    isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:gap-3'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      Join Waitlist
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
              {error && (
                <div className="flex items-center justify-center gap-2 mt-3 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <p className={`text-sm mt-4 ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
              }`}>
                {waitlistCount ? (
                  <>Join {waitlistCount} others on the list.</>
                ) : (
                  <>No spam. Just updates when we launch.</>
                )}
              </p>
            </form>
          ) : (
            <div className={`max-w-md mx-auto p-6 rounded-2xl ${
              theme === 'dark' ? 'bg-slate-800/50' : 'bg-stone-100'
            }`}>
              <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={48} />
              <p className="text-lg font-medium">You're on the list!</p>
              <p className={`text-sm mt-2 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                We'll reach out when MADLAB is ready for you.
              </p>
              {waitlistCount && (
                <p className={`text-xs mt-3 ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                }`}>
                  You're joining {waitlistCount} other early adopters.
                </p>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Value Props */}
      <section className={`py-20 ${
        theme === 'dark' ? 'bg-slate-800/30' : 'bg-stone-50'
      }`}>
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className={`text-2xl md:text-3xl font-light text-center mb-16 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Built different, for those who think different
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Visual Calm */}
              <ValueCard
                theme={theme}
                icon={<Moon size={28} />}
                title="Visual Calm"
                description="An interface that feels like an eyes and brain massage. Muted colors, generous spacing, no visual noise."
              />

              {/* AI Agents */}
              <ValueCard
                theme={theme}
                icon={<Sparkles size={28} />}
                title="AI That Helps"
                description="Agents that handle executive function gaps. Break down tasks, send reminders, draft communications."
              />

              {/* Event Convergence */}
              <ValueCard
                theme={theme}
                icon={<Calendar size={28} />}
                title="Event Convergence"
                description="Everything flows toward the moment. Not scattered tasks — synchronized movement toward your goal."
              />

              {/* Time Awareness */}
              <ValueCard
                theme={theme}
                icon={<Clock size={28} />}
                title="Time Blindness Aids"
                description="Visual countdowns, smart reminders, transition warnings. Time becomes visible and manageable."
              />

              {/* Multiplayer */}
              <ValueCard
                theme={theme}
                icon={<Users size={28} />}
                title="Multiplayer First"
                description="Collaborate without chaos. Shared events, personal views. Your interface adapts to your brain."
              />

              {/* ND Profiles */}
              <ValueCard
                theme={theme}
                icon={<Brain size={28} />}
                title="ND Profiles"
                description="ADHD, Autism, Dyslexia presets — or calibrate your own. The tool adapts to you, not the other way around."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Try It Now - Demo Projects */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-12">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${
                theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
              }`}>
                <Zap size={16} />
                <span className="text-sm font-medium">No signup required</span>
              </div>
              <h2 className={`text-3xl md:text-4xl font-light mb-4 ${
                theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
              }`}>
                Try it now with a sample project
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Experience the convergence flow instantly. Pick a scenario that resonates with you.
              </p>
            </div>

            {/* Demo Project Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {demoProjects.slice(0, 6).map((project) => (
                <DemoProjectCard
                  key={project.id}
                  project={project}
                  theme={theme}
                  onTry={() => handleTryDemo(project)}
                />
              ))}
            </div>

            {/* Quick Access CTA */}
            <div className="text-center mt-12">
              <Link
                to="/app"
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                Or start with a blank canvas
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className={`py-20 ${
        theme === 'dark' ? 'bg-slate-800/30' : 'bg-stone-50'
      }`}>
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className={`text-2xl md:text-3xl font-light mb-8 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              You've tried everything
            </h2>
            <p className={`text-lg leading-relaxed mb-8 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Notion, Asana, Monday, Todoist — they all felt like work.
              Cluttered interfaces. Guilt-inducing red badges.
              Systems designed for brains that work differently than yours.
            </p>
            <p className={`text-xl font-light ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              MADLAB is the first tool built{' '}
              <span className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}>
                with
              </span>{' '}
              your brain, not against it.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 ${
        theme === 'dark' ? 'bg-slate-800/30' : 'bg-stone-50'
      }`}>
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className={`text-3xl md:text-4xl font-light mb-6 ${
              theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
            }`}>
              Ready for calm?
            </h2>
            <p className={`text-lg mb-8 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Join the waitlist. Be first to experience MADLAB.
            </p>

            {!submitted && (
              <form onSubmit={handleSubmit} className="max-w-md mx-auto">
                <div className={`flex flex-col sm:flex-row gap-3 p-2 rounded-2xl ${
                  theme === 'dark' ? 'bg-slate-800/50' : 'bg-white'
                }`}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={isLoading}
                    className={`flex-1 px-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500 transition-all ${
                      theme === 'dark'
                        ? 'bg-slate-700/50 text-slate-100 placeholder-slate-500'
                        : 'bg-stone-50 text-slate-800 placeholder-slate-400'
                    } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                      isLoading ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Join Waitlist'
                    )}
                  </button>
                </div>
                {error && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
              </form>
            )}

            {/* Dashboard Preview Link */}
            <Link
              to="/app"
              className={`inline-flex items-center gap-2 mt-8 text-sm transition-colors ${
                theme === 'dark'
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Preview the dashboard
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 border-t ${
        theme === 'dark' ? 'border-slate-800' : 'border-stone-200'
      }`}>
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Brain size={20} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
              <span className="font-medium">MADLAB</span>
            </div>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
            }`}>
              Built for neurodivergent minds. By neurodivergent minds.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface ValueCardProps {
  theme: 'light' | 'dark';
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ValueCard({ theme, icon, title, description }: ValueCardProps) {
  return (
    <div className={`p-6 rounded-2xl transition-all duration-300 ${
      theme === 'dark'
        ? 'bg-slate-800/50 hover:bg-slate-800/70'
        : 'bg-white hover:shadow-lg'
    }`}>
      <div className={`mb-4 ${
        theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
      }`}>
        {icon}
      </div>
      <h3 className={`text-lg font-medium mb-2 ${
        theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
      }`}>
        {title}
      </h3>
      <p className={`text-sm leading-relaxed ${
        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
      }`}>
        {description}
      </p>
    </div>
  );
}

interface DemoProjectCardProps {
  project: DemoProject;
  theme: 'light' | 'dark';
  onTry: () => void;
}

function DemoProjectCard({ project, theme, onTry }: DemoProjectCardProps) {
  return (
    <button
      type="button"
      onClick={onTry}
      aria-label={`Try ${project.nameEn}`}
      className={`group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer text-left w-full appearance-none border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        theme === 'dark'
          ? 'bg-slate-800/70 hover:bg-slate-800'
          : 'bg-white hover:shadow-xl'
      }`}
    >
      {/* Gradient Header */}
      <span className={`block h-24 bg-gradient-to-r ${project.gradient} relative`}>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl opacity-90 group-hover:scale-110 transition-transform duration-300">
            {project.icon}
          </span>
        </span>
        {/* Days Badge */}
        <span className="absolute top-3 right-3 px-2 py-1 bg-black/30 backdrop-blur-sm rounded-full text-white text-xs font-medium">
          {project.daysUntilEvent} days
        </span>
      </span>

      {/* Content */}
      <span className="block p-5">
        <span className={`block text-lg font-semibold mb-1 ${
          theme === 'dark' ? 'text-slate-100' : 'text-slate-800'
        }`}>
          {project.nameEn}
        </span>
        <span className={`block text-sm mb-4 line-clamp-2 ${
          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
        }`}>
          {project.descriptionEn}
        </span>

        {/* Meta */}
        <span className="flex items-center justify-between">
          <span className={`flex items-center gap-4 text-xs ${
            theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
          }`}>
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {project.taskCount} tasks
            </span>
          </span>

          {/* Try Button (visual only — outer card is the actual button) */}
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r ${project.gradient} text-white opacity-90 group-hover:opacity-100`}
            aria-hidden="true"
          >
            <Play size={14} />
            Try it
          </span>
        </span>
      </span>

      {/* Hover Overlay */}
      <span className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
    </button>
  );
}
