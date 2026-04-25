# Infrastructure

MADLAB runs on **enclii**, MADFAM's internal platform. This file is the
infrastructure-level orientation; for the deploy-flow walkthrough see
`../deployment/README.md`, and for ecosystem-wide context see
`ECOSYSTEM.md` at the repo root.

## Application stack

### Client (`apps/client`)
- React 18 + TypeScript + Vite
- Zustand (with persistence) for client state
- TanStack Query for server state
- Tailwind CSS
- Served via nginx in the prod image

### Server (`apps/server`)
- Fastify 5 (Node 20+)
- Drizzle ORM 0.45 + `pg`
- Janua JWT verification via `jose` + JWKS
- Sentry (`@sentry/node`) gated on optional `SENTRY_DSN`

### Shared
- `packages/shared` — Zod schemas, entity types, response envelopes; both
  client and server import from this single source of truth.

### Data
- Postgres 16, shared `data/postgres` namespace (platform-managed —
  not in-namespace)

## Where things run

| Component | Where |
|---|---|
| API + Client images | `madlab` namespace, K8s |
| Postgres | `data/postgres` namespace, K8s, shared platform DB |
| TLS / public ingress | Cloudflare tunnel → enclii ingress |
| Auth | Janua at `auth.madfam.io` (RS256 JWKS) |
| Image registry | MADFAM internal registry (signed) |
| GitOps controller | ArgoCD watches `infra/k8s/production/` |

## Local development

```bash
# Postgres only (recommended — run server + client on host for fast iteration)
npm run docker:up

# Or full stack via compose
docker compose up -d

# Run server (host, with hot reload)
npm run dev:server

# Run client (host, with hot reload)
npm run dev

# Both at once
npm run dev:all
```

## Configuration files

### Build / packaging
- `apps/client/vite.config.ts` — Vite config
- `apps/server/tsconfig.json` — server TS config
- `packages/shared/tsconfig.json` — shared package TS config
- `apps/*/Dockerfile` — multi-stage prod images (development target also
  used by `docker-compose.yml`)

### Infrastructure-as-code
- `infra/k8s/production/kustomization.yaml` — image digests, ConfigMap +
  Secret references; auto-updated by `enclii-build.yml` on push to main
- `infra/k8s/production/{server,client}-deployment.yaml` — pod specs
- `infra/k8s/production/{server,client}-service.yaml` — services
- `infra/k8s/production/network-policies.yaml` — namespace network rules
- `infra/k8s/production/secrets-template.yaml` — shape of the secret
  enclii materializes (real values come from the platform vault)

## Production environment

The server fails to start in production without these (intentional —
see `apps/server/src/config/env.ts`):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (use `sslmode=require` for the shared DB) |
| `JANUA_ISSUER` | Janua issuer URL |
| `JANUA_AUDIENCE` | Token audience |
| `JANUA_JWKS_URI` | Public JWKS endpoint |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist (empty → startup refuses) |
| `NODE_ENV=production` | Required for strict checks to engage |

Optional:
- `SENTRY_DSN`, `VITE_SENTRY_DSN` — error tracking. Silent no-op when unset.

## Health probes

- `GET /api/health` — readiness. Does `SELECT 1` with a 500ms timeout.
  Returns 200 + structured `checks` on success, 503 on failure.
- `GET /api/health/live` — liveness. Does NOT touch the DB. A transient
  DB blip should never restart the pod.

## Observability

- **Logs**: pino → stdout → captured by the platform log pipeline
- **Errors**: Sentry on both server and client when DSN is set
- **Metrics**: not yet wired (P3 backlog item)

## Related docs

- `../deployment/README.md` — how a change reaches prod
- `../deployment/AUTOMATION.md` — what CI runs and what gates merges
- `../architecture/README.md` — system design
- `ECOSYSTEM.md` (repo root) — MADFAM stack context
