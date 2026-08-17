# Platform elevation audit — accionables as the ecosystem's planning engine

**Date:** 2026-08-16. **Trigger:** operator directive to advance this repo's
mission as a concern-separate platform, with nauta as the first integration.
**Method:** code-first inventory (schema, routes, client stores, CI runs,
enclii declaration) — findings below cite what was read, not what docs claim.

## The central finding: the code outgrew the mission statement

`ECOSYSTEM.md` declares "lead-gen + community engagement… not a major
platform." The code disagrees: a Fastify server with Janua-verified routes
for projects/phases/tasks/users/agents, a drizzle schema with dependencies,
phases, assignees, progress and status history, and a rich client (Gantt with
critical-path scheduling, filters, grouping, offline indicator, a11y
announcer). The elevation is not a rewrite — it is **joining halves that
already exist and updating the mission to match**.

## Findings (severity-ordered)

1. **CORRECTED (same day, deeper read + live-cluster check):** the client
   IS fully wired (React Query hooks with optimistic mutations over an
   `api/` layer; `App.tsx` renders `useTasks()`), the server IS deployed
   (k8s manifests, nginx `/api` proxy, both pods Running). The REAL top
   finding: **production is 113 days stale** (server pod: 27 restarts,
   image from ~April) — the Aug-13 red pipeline is only the visible tip of
   a promotion chain that has not delivered since spring. Every fix in this
   audit reaches nobody until the deploy chain revives (finding 3). The
   original text of this finding claimed the halves were never joined; that
   was wrong, and the correction is recorded rather than rewritten away
   (prohibition 4 applies to audits too).
2. **Standing prohibition 2 violated** — `agents.ts` called Ollama/Groq/
   Together directly. **Fixed in #37** (Selva-only, fail-closed, truthful
   /info and .env.example).
3. **Staging deploys red since 2026-08-13 — RESOLVED 2026-08-17.** The
   diagnosis evolved twice: `ENCLII_DEPLOY_TOKEN` turned out to be a
   **phantom** — the 2026-08-13 bootstrap runbook (enclii#396) records it
   "names no repo in the org has". The real blocker: this was the ONLY repo
   in the ecosystem whose `main` carried branch protection, so the Actions
   digest commit hit GH006 while every sibling (nauta, janua, enclii
   unprotected; karafiel's plan lacks the feature) pushed freely. The
   operator removed the protection (org-convention alignment) and the
   pipeline was re-run. **Standing follow-up so the safety intent is not
   lost:** adopt org-wide **rulesets with a GitOps-bot bypass** — real
   protection the digest commits can traverse — and drop the phantom
   `ENCLII_DEPLOY_TOKEN || GITHUB_TOKEN` fallback from the workflow so the
   next reader is not sent hunting a token that never existed.
4. **No tenancy.** `users`/`projects` carry no workspace/org scoping — one
   global namespace. Platform-grade multi-client use (and any nauta bridge
   that scopes per engagement) needs a `workspaceId` spine + scoped queries.
5. **Time base is integer hours** (`estimatedHours`/`actualHours`; Gantt
   utils assume 8-hour days). Ecosystem doctrine D14 (nauta
   `docs/DECISIONS_LOG.md`) stores minutes. Migration: minutes columns with
   hour-compat reads; Gantt scheduling parameterized on minutes.
6. **No time ledger.** `actualHours` is a mutable aggregate — no entries, no
   attribution, no audit trail. The nauta bridge should NOT duplicate
   nauta's `TimeEntry`; see integration contract below for who owns what.
7. **The server is not declared in `enclii.yaml`'s service list** (client
   only) — the k8s manifests deploy it fine, but enclii tooling
   (`enclii logs`, service registry) cannot see it. Declaration gap, not a
   deploy gap (corrected alongside finding 1).
8. **Lint debt:** 68 eslint warnings (0 errors) server-side.
9. **Mission docs stale** (`ECOSYSTEM.md` type/status/services) — update
   as capabilities land, never ahead of them (prohibition 4).

## Integration contract with nauta (first and foremost)

**Concern separation, stated once:** *nauta owns the engagement* (client
relationship, scope, hours ledger, SLA, billing evidence); *accionables owns
the plan* (tasks, dependencies, phases, critical path, schedules). The bridge
is data, not merged ownership:

- **nauta → accionables:** an Initiative may link to an accionables project
  (`external_refs`, provider `accionables`, the pattern nauta already uses
  for karafiel). Planning depth (task breakdown, dependencies, Gantt) lives
  here; nauta renders summaries.
- **accionables → nauta:** per-project rollups — planned minutes, scheduled
  window, % complete — via a service-scoped read API (Janua service auth,
  same doctrine as karafiel's seam). nauta's plan-vs-actual (D14) then shows
  *planned from accionables, consumed from nauta's own TimeEntry*. Time is
  **logged once, in nauta**; accionables never grows a second ledger for
  engagement hours (its `actualHours` stays for internal/event projects).
- **Shared scheduling core:** extract `ganttScheduling.ts` into
  `packages/scheduling` (minutes-based, tested critical path), consumable by
  both the client and — later — nauta's roadmap rendering.

## Elevation waves

| Wave | Items | Exit |
|---|---|---|
| **A — Truth & plumbing** (now) | #37 Selva routing ✅ · ENCLII_DEPLOY_TOKEN (operator) · server declared in enclii.yaml + prod deploy · lint debt to zero | Staging green; API reachable in prod |
| **B — Freshness & minutes** | ~~Join the halves~~ (already joined — see corrected finding 1) · minutes migration (#39) + Gantt on minutes · server declared in enclii.yaml · deploy-chain revival (token + staging + promote) so 113-day-stale prod receives everything since spring | Prod pods run current images; the Gantt schedules in minutes |
| **C — Platform spine** | `workspaceId` tenancy + scoped queries · `packages/scheduling` extraction with critical-path tests | Two workspaces coexist without seeing each other |
| **D — nauta bridge** | external_refs link · service-scoped rollup API · nauta plan-vs-actual consumes it | An initiative on crea's roadmap shows planned-vs-consumed from both systems |
| **E — Mission match** | ECOSYSTEM.md re-typed (platform), docs INDEX updated, deployed-services table truthful | Docs equal reality |

Waves ship in order; each is PR-sized work, CI-green merges, pod-verified
deploys — the house discipline.
