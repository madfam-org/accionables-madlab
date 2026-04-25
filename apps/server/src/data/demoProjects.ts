/**
 * Demo project templates served from the landing page.
 *
 * Public, unauthenticated read — the landing page is pre-auth. These are
 * marketing/demo-only fixtures, not real `projects` rows; do NOT seed them
 * into the `projects` table.
 *
 * The previous client implementation called `daysFromNow(N)` at module import
 * time, which baked the "now" timestamp into the SPA bundle. Serving from
 * the API lets each request compute fresh dates.
 */

export type DemoEventType =
  | 'concert'
  | 'launch'
  | 'exam'
  | 'presentation'
  | 'retreat'
  | 'deadline'
  | 'custom';

export type DemoCategory = 'creative' | 'academic' | 'professional' | 'personal';

export interface DemoProjectEvent {
  id: string;
  name: string;
  nameEn: string;
  /** ISO-8601 string, computed per-request. */
  date: string;
  description: string;
  descriptionEn: string;
  type: DemoEventType;
}

export interface DemoProject {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  gradient: string;
  event: DemoProjectEvent;
  taskCount: number;
  daysUntilEvent: number;
  category: DemoCategory;
}

interface DemoProjectTemplate {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  gradient: string;
  taskCount: number;
  daysUntilEvent: number;
  category: DemoCategory;
  event: Omit<DemoProjectEvent, 'date'>;
}

const TEMPLATES: ReadonlyArray<DemoProjectTemplate> = Object.freeze([
  {
    id: 'concert',
    name: 'Concierto de Primavera',
    nameEn: 'Spring Concert',
    description: 'Organiza un concierto indie en un venue local. 3 semanas de preparación intensa.',
    descriptionEn: 'Organize an indie concert at a local venue. 3 weeks of intense preparation.',
    icon: '🎵',
    gradient: 'from-purple-500 to-pink-500',
    taskCount: 24,
    daysUntilEvent: 21,
    category: 'creative',
    event: {
      id: 'demo-concert',
      name: 'Concierto de Primavera',
      nameEn: 'Spring Concert',
      description: 'El momento en que todo cobra sentido',
      descriptionEn: 'The moment everything comes together',
      type: 'concert',
    },
  },
  {
    id: 'product-launch',
    name: 'Lanzamiento de App',
    nameEn: 'App Launch',
    description: 'Lanza tu aplicación móvil al mundo. Marketing, PR, y preparación técnica.',
    descriptionEn: 'Launch your mobile app to the world. Marketing, PR, and technical prep.',
    icon: '🚀',
    gradient: 'from-blue-500 to-cyan-500',
    taskCount: 32,
    daysUntilEvent: 14,
    category: 'professional',
    event: {
      id: 'demo-launch',
      name: 'Launch Day',
      nameEn: 'Launch Day',
      description: 'Momento del lanzamiento público',
      descriptionEn: 'Public launch moment',
      type: 'launch',
    },
  },
  {
    id: 'final-exam',
    name: 'Examen Final',
    nameEn: 'Final Exam',
    description: 'Prepárate para tu examen final de matemáticas. Estudio estructurado sin pánico.',
    descriptionEn: 'Prepare for your final math exam. Structured study without panic.',
    icon: '📝',
    gradient: 'from-emerald-500 to-teal-500',
    taskCount: 18,
    daysUntilEvent: 10,
    category: 'academic',
    event: {
      id: 'demo-exam',
      name: 'Examen Final',
      nameEn: 'Final Exam',
      description: '3 horas que definen el semestre',
      descriptionEn: '3 hours that define the semester',
      type: 'exam',
    },
  },
  {
    id: 'retreat',
    name: 'Retiro de Equipo',
    nameEn: 'Team Retreat',
    description: 'Planifica un retiro de team building para 15 personas. Logística y actividades.',
    descriptionEn: 'Plan a team building retreat for 15 people. Logistics and activities.',
    icon: '🏕️',
    gradient: 'from-amber-500 to-orange-500',
    taskCount: 28,
    daysUntilEvent: 28,
    category: 'professional',
    event: {
      id: 'demo-retreat',
      name: 'Retiro de Equipo',
      nameEn: 'Team Retreat',
      description: 'Fin de semana de conexión',
      descriptionEn: 'Weekend of connection',
      type: 'retreat',
    },
  },
  {
    id: 'presentation',
    name: 'Pitch a Inversionistas',
    nameEn: 'Investor Pitch',
    description: 'Prepara una presentación convincente para levantar tu primera ronda.',
    descriptionEn: 'Prepare a compelling presentation to raise your first round.',
    icon: '🎤',
    gradient: 'from-red-500 to-rose-500',
    taskCount: 16,
    daysUntilEvent: 7,
    category: 'professional',
    event: {
      id: 'demo-pitch',
      name: 'Demo Day',
      nameEn: 'Demo Day',
      description: '10 minutos que pueden cambiarlo todo',
      descriptionEn: '10 minutes that could change everything',
      type: 'presentation',
    },
  },
  {
    id: 'wedding',
    name: 'Mi Boda',
    nameEn: 'My Wedding',
    description: 'El día más importante merece una planificación sin estrés.',
    descriptionEn: 'The most important day deserves stress-free planning.',
    icon: '💒',
    gradient: 'from-pink-500 to-fuchsia-500',
    taskCount: 45,
    daysUntilEvent: 60,
    category: 'personal',
    event: {
      id: 'demo-wedding',
      name: 'El Gran Día',
      nameEn: 'The Big Day',
      description: 'El comienzo de una nueva aventura',
      descriptionEn: 'The beginning of a new adventure',
      type: 'custom',
    },
  },
]);

/**
 * Compute the demo projects with a fresh `event.date` (now + daysUntilEvent).
 *
 * Time is fixed at 20:00 local-server time, matching the original client
 * implementation (`date.setHours(20, 0, 0, 0)`).
 *
 * Pass `now` for deterministic tests; defaults to wall-clock `new Date()`.
 */
export function buildDemoProjects(now: Date = new Date()): DemoProject[] {
  return TEMPLATES.map((template) => {
    const eventDate = new Date(now);
    eventDate.setDate(eventDate.getDate() + template.daysUntilEvent);
    eventDate.setHours(20, 0, 0, 0);

    return {
      id: template.id,
      name: template.name,
      nameEn: template.nameEn,
      description: template.description,
      descriptionEn: template.descriptionEn,
      icon: template.icon,
      gradient: template.gradient,
      taskCount: template.taskCount,
      daysUntilEvent: template.daysUntilEvent,
      category: template.category,
      event: {
        ...template.event,
        date: eventDate.toISOString(),
      },
    };
  });
}
