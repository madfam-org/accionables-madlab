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
npm test                 # Run unit tests
npm run test:e2e         # Run Playwright E2E tests

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

## Known Issues — Audit 2026-04-23

See `/Users/aldoruizluna/labspace/claudedocs/ECOSYSTEM_AUDIT_2026-04-23.md` for the full ecosystem audit.

- ~~**🔴 R3: Unauthenticated admin endpoint**~~ — Fixed 2026-04-23: `GET /waitlist/stats` now runs `[verifyJWT, requireRoles('admin')]` as fastify `preHandler`.
- **🟡 UI: Unauthorized redirect TODO** — `apps/client/src/api/client.ts:50` `// TODO: Handle unauthorized (redirect to login)`. Users hit 401 silently.
