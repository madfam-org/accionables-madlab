# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MADLAB is a collaborative educational project between MADFAM and La Ciencia Del Juego, focused on bringing gamified science and technology learning to primary schools in Mexico. The project addresses topics aligned with global Sustainable Development Goals (SDGs) and Mexican national competency standards.

## Key Project Details

- **Duration**: 81 days (August 11 - October 31, 2025)
- **Team**: 5 members (Aldo, Nuri, Luis, Silvia, Caro)
- **Focus Areas**: Clean water, clean energy, and recycling
- **Target**: 20-100 students per 3-hour presentation

## Architecture

This is a **monorepo** using npm workspaces with two main applications:

### Frontend (`/apps/client`)
- **Framework**: React 18 + TypeScript + Vite
- **State Management**: Zustand with persistence
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Testing**: Vitest (unit) + Playwright (E2E)

### Backend (`/apps/server`)
- **Framework**: Fastify
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (via Docker)

### Key Directories
```
apps/
├── client/
│   ├── src/
│   │   ├── components/    # React components (32 files)
│   │   ├── hooks/         # Custom React hooks (9 files)
│   │   ├── stores/        # Zustand state management
│   │   ├── utils/         # Business logic utilities
│   │   ├── data/          # Static data (tasks, translations)
│   │   └── api/           # API client integration
│   └── e2e/               # Playwright E2E tests
└── server/
    └── src/
        ├── routes/        # API endpoints
        └── db/            # Database schema
docs/                      # Comprehensive documentation (36 files)
```

## Common Commands

```bash
# Development
npm run dev              # Start client dev server (localhost:5173)
npm run dev:server       # Start API server (localhost:3001)
npm run dev:all          # Start both concurrently

# Testing
npm test                          # Run unit tests in all workspaces
npm test --workspace=apps/server  # Server Vitest suite (auth, validation, routes)
npm test --workspace=apps/client  # Client Vitest suite (hooks, components, utils)
npm run test:e2e                  # Run Playwright E2E tests

# Building
npm run build            # Build all workspaces

# Docker (for PostgreSQL)
npm run docker:up        # Start PostgreSQL container
npm run docker:down      # Stop container
```

## Dashboard Features

- **Bilingual Support**: Spanish/English toggle with complete translation system
- **Theme System**: Auto/light/dark mode with localStorage persistence
- **Responsive Design**: Mobile-first approach with touch-friendly interactions
- **Task Management**: 109 tasks across 5 project phases with filtering and search
- **Gantt Chart**: Visual timeline with task scheduling
- **Export**: Multi-format (PDF/CSV/JSON/TXT)
- **Team Visualization**: Individual task assignments and hour tracking

## Team Structure

- **Aldo**: CEO MADFAM, Tech Lead (116.5 hours, 24 tasks)
- **Nuri**: Strategy Officer MADFAM (86.5 hours, 19 tasks)
- **Luis**: La Ciencia del Juego Representative (102 hours, 20 tasks)
- **Silvia**: Marketing Guru (115.5 hours, 23 tasks)
- **Caro**: Designer and Teacher (102 hours, 22 tasks)

## Development Guidelines

### When Adding Features

- **Maintain Bilingual Support**: Update `src/data/translations.ts` for any new UI strings
- **Preserve Responsive Design**: Use Tailwind responsive classes (sm:, md:, lg:)
- **Follow Component Patterns**: Check existing components in `src/components/`
- **Update State**: Use Zustand store in `src/stores/appStore.ts`

### Code Quality

- TypeScript strict mode enabled
- ESLint for linting
- Prettier for formatting (4-space tabs, single quotes)
- Run `npm run lint` before committing

### Accessibility Standards

- Minimum 44px touch targets for mobile
- Proper ARIA labels and semantic HTML
- Keyboard navigation support
- Color contrast compliance for both themes

## Project Context

This is a high-stakes educational initiative with specific deliverables and timelines. When making changes:

- Respect the bilingual nature of all communications
- Maintain the project's educational and professional tone
- Consider the collaborative nature of the team structure
- Keep the gamified learning objectives in mind

## Documentation

Comprehensive documentation is available in `/docs/`:
- **[INDEX.md](./docs/INDEX.md)** - Complete documentation navigation
- **[Architecture](./docs/architecture/)** - System design and patterns
- **[Components](./docs/components/)** - React component library
- **[Guides](./docs/guides/)** - Developer workflow guides
- **[Tutorials](./docs/tutorials/)** - Step-by-step learning guides

## Stability Remediation — Waves 0–3 (2026-04-24)

Four waves: real authentication + route gating + request validation (Wave 0);
identity bridge + bootstrap hardening + client bearer + lint unblocked
(Wave 1); vuln burn-down + DB pool + real CI gates (Wave 2); shared zod
contract + a11y fixes + auth-key unification + E2E auth + waitlist hardening
(Wave 3). Server: 109 tests (was 0). Client: 155 tests (was 140). Both
workspace lints clean. Vulns: 25 high/critical → 0.

### Resolved
- ~~🔴 Trust-the-payload JWT verification~~ — `apps/server/src/middleware/auth.ts`
  now performs real RS256 signature verification via `jose` + JWKS. The
  dev-mock token `dev-token-mock-user` is strictly gated on
  `NODE_ENV === 'development'` and will not be accepted in prod. Missing Janua
  config now **fails closed** instead of silently accepting tokens.
- ~~🔴 Unauthenticated CRUD on tasks/projects/agents~~ — every mutating route
  and most reads now run `{ preHandler: verifyJWT }`. Public surface is only
  `/health`, `/agents/status`, `POST /waitlist`, `GET /waitlist/count`.
- ~~🔴 Unauthenticated LLM endpoints~~ — `POST /agents/breakdown` and
  `POST /agents/draft` now require auth. With `AI_PROVIDER` set to
  `groq`/`together`/`custom`, these were burning API keys publicly.
- ~~🔴 `createdBy` hardcoded in `POST /projects`~~ — now calls
  `upsertLocalUser(request.user!)` from `src/services/users.ts`, which does a
  single `INSERT … ON CONFLICT` on `users.janua_id`. Project creation no
  longer FK-fails once real auth is on.
- ~~🔴 CORS silently broken in prod~~ — `src/config/env.ts`
  `resolveCorsOrigins()` throws at boot if `ALLOWED_ORIGINS` is empty in
  production rather than silently locking every browser out. Server also
  refuses to start in prod without `JANUA_*` vars set.
- ~~🟡 Routes bypassed Zod validation~~ — every handler validates body,
  query, and params via `schemas/validation.ts`. `as any` casts removed;
  pagination enforced via `limit`/`offset`.
- ~~🟡 `createProjectSchema` drift from DB~~ — reconciled; regression tests
  pin it. `taskStatusSchema` order matches `taskStatusEnum`.
- ~~🟡 Client never sent bearer tokens~~ — `apps/client/src/api/client.ts`
  request interceptor attaches `Authorization: Bearer <token>`; 401 response
  clears auth state and invokes a logout handler registered by AuthContext.
- ~~🟡 Latent routing bug~~ — `/tasks/bulk` now registers before `/tasks/:id`.
- ~~🟡 No global error handler~~ — `src/config/errorHandler.ts` returns a
  generic 500 for server errors (no stack leak) and echoes 4xx messages.
- ~~🟡 No rate limiting~~ — `@fastify/rate-limit` mounted globally at
  300 req/min, using forwarded-for for identification.
- ~~🟡 Baseline ESLint broken~~ — root `.eslintrc.js` deleted; workspaces own
  their configs; both `npm run lint --workspace=apps/...` pass (warnings only).
- ~~🟡 npm vulns — non-breaking tier~~ — `npm audit fix` brought 25 → 9.
- ~~🟡 npm vulns — breaking tier~~ — fastify 4→5 + plugin majors,
  drizzle-orm 0.33→0.45, @fastify/jwt removed (unused); 9 → 0 high/critical.
- ~~🟡 DB pool ignored SSL, no retry, no real health probe~~ — `database.ts`
  parses `sslmode` from `DATABASE_URL` (prefer/require/verify-ca/verify-full);
  `waitForDatabase` runs an exponential-backoff ping (500→5000ms, 30s budget)
  before `fastify.listen`; `/api/health` does a real `SELECT 1` (200 ok /
  503 degraded); split `/api/health/live` exists for K8s liveness (no DB
  touch — a transient blip should never restart the pod).
- ~~🟡 CI didn't actually gate~~ — `.github/workflows/ci.yml` refactored
  into 6 explicit jobs (server/client × lint/type-check/test). Removed
  `continue-on-error: true` from type-check (root cause of TS errors slipping
  through historically).
- ~~🔴 R3: Unauthenticated admin endpoint~~ — `/waitlist/stats` gated with
  `[verifyJWT, requireRoles('admin')]`.
- ~~🟡 Schema drift between client/server~~ — Wave 3 added `packages/shared`
  workspace; both sides import Zod schemas + entity types from one source.
  Surfaced 3 real drift bugs (bulk-update payload mismatch, assignee shape
  confusion, bulk-fields-allow-null mismatch) — all fixed.
- ~~🟡 Auth storage key drift~~ — AuthContext now writes auth_token + auth_user
  + auth_token_meta. Migration on mount splits any legacy `madlab_auth` blob.
- ~~🟡 6 jsx-a11y violations~~ — fixed; rules restored to `error`.
- ~~🟡 E2E suite 401'd every API call~~ — Playwright global-setup now seeds
  `localStorage.auth_token=dev-token-mock-user`; webServer config spins up
  both Fastify API and Vite client with `NODE_ENV=development`.
- ~~🟡 `/waitlist/count` was O(N) per hit~~ — aggregate `count(*)` + 60s
  in-memory TTL cache. Endpoint is intentionally public (social proof).

### Outstanding
- **🟢 User must enable branch protection** — required check names are
  documented in task #23. CI gates exist; they just need to be required.
- **🟡 No observability SDK** — stdout logs only. Task #12.
- **🟡 Domain data still in client `src/data/`** — phases/teamMembers/
  demoProjects shipped in the SPA bundle. Task #15.
- **🟡 E2E doesn't run against a real server in CI** — playwright config is
  ready, but the workflow doesn't yet spin up docker-compose. Task #14.
- **🟢 4 dev-only moderate vulns remain** — all in `drizzle-kit`'s
  `@esbuild-kit/*` transitive (esbuild). Runtime is clean.

### New server env vars
`verifyJWT` requires these in production (fail-closed if missing):
- `JANUA_ISSUER`
- `JANUA_AUDIENCE`
- `JANUA_JWKS_URI`

In development, if these are unset and the request does NOT use the dev-mock
token, the request 500s. This is intentional — no silent auth bypass.
