# CI/CD Automation

What runs automatically when you push to a branch or open a PR. For
deployment-platform context (enclii / ArgoCD), see `./README.md`.

## Workflows

`.github/workflows/ci.yml` — quality gates and build.
`.github/workflows/enclii-build.yml` — image build + sign on push to `main`.

### Quality gates (per PR + per push)

Eight required status checks gate every merge into `main`. Branch
protection enforces them; see ECOSYSTEM.md for the full list.

| Job | What it runs |
|---|---|
| `Server Lint` | `eslint src --ext .ts` in apps/server |
| `Server Type Check` | `tsc --noEmit` in apps/server |
| `Server Unit Tests` | `vitest run` in apps/server |
| `Client Lint` | `eslint .` in apps/client |
| `Client Type Check` | `tsc --noEmit` in apps/client |
| `Client Unit Tests` | `vitest --run` in apps/client |
| `E2E Tests` | Playwright against a real Postgres + Fastify stack — see e2e job below |
| `Build Application` | `npm run build` over both workspaces, uploads `apps/client/dist/` |

The E2E job specifically:
1. Starts Postgres 16 as a service container
2. `drizzle-kit db:push` to apply the schema
3. Seeds (legacy task imports fail-soft)
4. Starts the Fastify API in the background with `NODE_ENV=development`
5. Polls `/api/health` with a 60-second budget
6. Runs Playwright (uses `dev-token-mock-user` storage state — the dev-only
   auth bypass)
7. On failure: dumps the server log inline + uploads `playwright-report/`
   and `/tmp/server.log` artifacts

### Image build (`enclii-build.yml`)

Triggers on push to `main` only, paths-filtered to `apps/**` and
`infra/k8s/production/**`. Builds and signs the container images for
server and client, pushes them to the MADFAM registry, and auto-commits
the new image digests into `infra/k8s/production/kustomization.yaml`.
ArgoCD then reconciles the namespace.

## Branch protection

`main` is protected. Required:
- All 8 quality-gate checks above must be green
- Linear history (rebase merges only)
- No force pushes
- No deletions

`enforce_admins: false` — admins can override in true emergencies, but the
gates are documented to catch real regressions, so overriding should be
rare. The `enclii-build` workflow is NOT a required check; it runs after
merge to build + sign images, and ArgoCD reconciles from the resulting
kustomization.yaml update.

## Adding a new required check

1. Add the job to `.github/workflows/ci.yml`
2. Use a stable, descriptive `name:` (this becomes the check name)
3. Open a PR — the new job runs and reports back
4. Once green, update branch protection via `gh api`:
   ```bash
   gh api -X PUT /repos/madfam-org/accionables-madlab/branches/main/protection \
     --input <updated-protection.json>
   ```
   (Get the current shape with `gh api /repos/.../protection > current.json`,
   edit, re-PUT.)

## Local pre-commit checklist

Run before pushing to save a CI round-trip:

```bash
npm run lint --workspace=apps/server
npm run type-check --workspace=apps/server
npm run test --workspace=apps/server
npm run lint --workspace=apps/client
npm run type-check --workspace=apps/client
npm run test --workspace=apps/client
```

Or `npm run build` to exercise the full build path.
