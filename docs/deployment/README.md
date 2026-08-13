# Deployment

Production deployment is handled by **enclii**, MADFAM's internal platform that
provisions and manages the K8s namespace, ArgoCD application, Cloudflare
tunnel routes, and Janua client. This file is a quick orientation; for
ecosystem-wide context see `ECOSYSTEM.md` at the repo root.

## How a change reaches production

```
git push origin main
        │
        ▼
GitHub Actions / ci.yml          → quality gates (server/client × lint/type-check/test, e2e, build)
GitHub Actions / enclii-build    → docker image build + sign + push to madfam registry
        │                          (auto-commits new image digest into infra/k8s/production/kustomization.yaml)
        ▼
ArgoCD watches infra/k8s/production/
        │
        ▼
K8s rollout in the app's namespace
```

There is **no CI-side `deploy` step** to a third-party platform. Image build
+ ArgoCD sync are the deployment.

## Required production environment

The server refuses to start in production without these (intentional —
fail-closed behavior added in stability Wave 1):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (platform-managed shared Postgres) |
| `JANUA_ISSUER` | OIDC issuer URL for Janua |
| `JANUA_AUDIENCE` | Token audience the API expects |
| `JANUA_JWKS_URI` | Public key set for RS256 verification |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist (empty = startup refuses) |
| `NODE_ENV` | Must be `production` to enable strict checks |

Optional (silent no-op when unset):
- `SENTRY_DSN` — enables server-side error tracking
- `VITE_SENTRY_DSN` — enables client-side error tracking (build-time)

These are managed via the K8s secret materialized by enclii. The full
required-variable list is enforced in code at `apps/server/src/config/env.ts`;
secret provisioning itself is documented in MADFAM internal docs.

## Local production-mode build

```bash
# Build artifacts
npm run build                    # builds both workspaces

# Run server in prod mode locally (requires DATABASE_URL + JANUA_*)
NODE_ENV=production \
  DATABASE_URL=postgresql://... \
  JANUA_ISSUER=... \
  JANUA_AUDIENCE=... \
  JANUA_JWKS_URI=... \
  ALLOWED_ORIGINS=https://your.origin \
  node apps/server/dist/index.js

# Health probe
curl http://localhost:3001/api/health        # readiness — does SELECT 1
curl http://localhost:3001/api/health/live   # liveness — no DB touch
```

If `DATABASE_URL` includes `sslmode=require` (or `prefer`/`verify-ca`/
`verify-full`), the pool enables SSL automatically. See
`apps/server/src/config/database.ts` for the resolution logic.

## What runs where

| Component | Where | Image |
|---|---|---|
| API (Fastify) | app namespace, K8s | `apps/server/Dockerfile` (built by enclii-build.yml) |
| Client (React) | app namespace, K8s, served via nginx | `apps/client/Dockerfile` |
| Postgres | shared platform Postgres | platform-managed |
| TLS / routing | Cloudflare tunnel → enclii ingress | platform-managed |
| Auth | Janua OIDC | `auth.madfam.io` |

## Pre-deploy checklist

Quality gates run automatically in CI; once those are green and the PR
merges, the rest is platform-managed. Manual checks that matter:

- [ ] Required env vars set in the K8s secret for the namespace
- [ ] `infra/k8s/production/kustomization.yaml` has the correct image digests
      (auto-committed by enclii-build but worth a glance after a major bump)
- [ ] If JWT/auth changed: confirm staging accepts a real Janua token
- [ ] If schema changed: drizzle migrations applied (`npm run db:migrate`
      against the prod DB, gated through the platform)

## Rollback

ArgoCD-driven. Revert the offending commit, push to main, the next
enclii-build run will roll the image digest backward and ArgoCD reconciles.
Don't try to roll back at the K8s level directly — kustomization.yaml
is the source of truth and ArgoCD will overwrite manual edits.

## Related docs

- `ECOSYSTEM.md` (repo root) — how MADLAB fits into the broader MADFAM stack
- `infra/k8s/production/` — the actual manifests
- `.github/workflows/ci.yml` — quality gates
- `.github/workflows/enclii-build.yml` — image build + sign
