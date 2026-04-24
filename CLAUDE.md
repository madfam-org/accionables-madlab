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

## Stability Remediation — Waves 0 & 1 (2026-04-24)

Combined: real authentication, full route gating, request validation, 76
server tests + 147 client tests, bootstrap hardened, client bearer/401 flow,
lint unblocked, vulns triaged.

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
- ~~🟡 npm vulns — auto-fixable tier~~ — 25 → 9 remaining (all 3 remaining
  need major-version bumps, tracked separately).
- ~~🔴 R3: Unauthenticated admin endpoint~~ — `/waitlist/stats` gated with
  `[verifyJWT, requireRoles('admin')]`.

### Outstanding
- **🟡 Auth storage key drift** — `AuthContext` stores under `madlab_auth`
  (JSON blob), but `api/client.ts` reads from `auth_token`/`auth_user`. Until
  unified, bearer header is empty for existing users. Task #21.
- **🟡 3 breaking-bump vulns remain** — `@fastify/jwt` → 10 (closes fast-jwt
  CRITICAL iss-validation), `fastify` → 5 (sendWebStream DoS), `drizzle-orm`
  → 0.45 (SQL injection via identifiers). Each needs its own focused PR.
  Task #22.
- **🟡 6 jsx-a11y violations** surfaced once lint started working; rules
  downgraded to warnings to keep CI green. Task #20.
- **🟡 No server SSL/retry on DB pool** — Task #9.
- **🟡 No observability SDK** — stdout logs only. Task #12.

### New server env vars
`verifyJWT` requires these in production (fail-closed if missing):
- `JANUA_ISSUER`
- `JANUA_AUDIENCE`
- `JANUA_JWKS_URI`

In development, if these are unset and the request does NOT use the dev-mock
token, the request 500s. This is intentional — no silent auth bypass.
