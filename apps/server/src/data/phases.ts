/**
 * MADLAB project phases — the canonical source of truth.
 *
 * Lives on the server so the client cannot stale-cache phase metadata in its
 * SPA bundle. The client used to import this from `apps/client/src/data/phases.ts`;
 * that file now re-fetches from `GET /api/phases` and falls back to this list
 * (kept in shape via the shared `PhaseInfo` contract below).
 *
 * Why static (not a `phases` table)?
 *   - The 5 MADLAB phases are project-level metadata, not per-tenant data.
 *   - `projects.metadata` (jsonb) can override these per-project later if needed.
 *   - Avoids a migration + table + CRUD surface for what is, today, 5 rows of
 *     constants. KISS.
 */

export interface PhaseInfo {
  number: number;
  title: {
    es: string;
    en: string;
  };
  dateRange: string;
  taskCount: number;
}

export const DEFAULT_PROJECT_PHASES: ReadonlyArray<PhaseInfo> = Object.freeze([
  {
    number: 1,
    title: {
      es: 'Fase 1: Fundación',
      en: 'Phase 1: Foundation',
    },
    dateRange: 'Aug 11 - Sep 5, 2025',
    taskCount: 25,
  },
  {
    number: 2,
    title: {
      es: 'Fase 2: Desarrollo de Contenido',
      en: 'Phase 2: Content Development',
    },
    dateRange: 'Sep 6-25, 2025',
    taskCount: 25,
  },
  {
    number: 3,
    title: {
      es: 'Fase 3: Preparación del Piloto',
      en: 'Phase 3: Pilot Preparation',
    },
    dateRange: 'Sep 26 - Oct 5, 2025',
    taskCount: 15,
  },
  {
    number: 4,
    title: {
      es: 'Fase 4: Piloto e Iteración',
      en: 'Phase 4: Pilot & Iteration',
    },
    dateRange: 'Oct 6-20, 2025',
    taskCount: 20,
  },
  {
    number: 5,
    title: {
      es: 'Fase 5: Listos para el Lanzamiento',
      en: 'Phase 5: Launch Ready',
    },
    dateRange: 'Oct 21-31, 2025',
    taskCount: 24,
  },
]);
