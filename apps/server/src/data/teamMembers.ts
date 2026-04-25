/**
 * MADLAB team members — fallback / seed source.
 *
 * The canonical source is the `users` table, populated via
 * `services/users.ts::upsertLocalUser` on every authenticated request.
 * This list is used:
 *   1. As a seed in `scripts/seed.ts` (already there, copied — left as-is).
 *   2. As a fallback returned by `GET /api/users` when the table is empty
 *      (fresh dev DB, or before any user has authenticated).
 *
 * Production data overrides this file. Once real users have signed in, the
 * table reflects reality and this list is no longer returned.
 */

export interface TeamMemberSeed {
  /** Stable identifier — uses the first name as the legacy app does. */
  name: string;
  /** Spanish role label. */
  role: string;
  /** English role label. */
  roleEn: string;
  /** Emoji avatar, kept for visual continuity with the existing UI. */
  avatar: string;
}

export const DEFAULT_TEAM_MEMBERS: ReadonlyArray<TeamMemberSeed> = Object.freeze([
  { name: 'Aldo', role: 'CEO MADFAM', roleEn: 'CEO MADFAM', avatar: '👨‍💼' },
  {
    name: 'Nuri',
    role: 'Oficial de Estrategia MADFAM',
    roleEn: 'Strategy Officer MADFAM',
    avatar: '👩‍💼',
  },
  {
    name: 'Luis',
    role: 'Rep. La Ciencia del Juego',
    roleEn: 'La Ciencia del Juego Rep.',
    avatar: '👨‍🔬',
  },
  {
    name: 'Silvia',
    role: 'Gurú de Marketing',
    roleEn: 'Marketing Guru',
    avatar: '👩‍🎨',
  },
  {
    name: 'Caro',
    role: 'Diseñadora y Maestra',
    roleEn: 'Designer and Teacher',
    avatar: '👩‍🎓',
  },
]);
