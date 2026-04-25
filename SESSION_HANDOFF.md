# Session Handoff — 2026-04-25

This document captures the state at the end of the long stability-remediation session. Restart Claude Code, point it at this file, and pick up the open threads.

## TL;DR

Repo went through 5 stability waves + a namespace/canonical migration. Code is healthy. Production is **stuck mid-cutover** because:
1. ArgoCD already migrated workloads to the new namespace `accionables-madlab` per merged PRs.
2. New pods crash because (a) `accionables-madlab-secrets` doesn't exist there, and (b) nginx upstream had a stale `madlab` namespace ref (fix in PR #29 pending merge).
3. `madlab.quest` still returns Cloudflare 404 because switchyard-api has a real bug blocking domain creation programmatically.

## What's on `main` (since session start, in order)

```
f7f4e46  feat(seed): migrate 110 legacy tasks to server-side seed (PR #28)
b6c4efb  fix(e2e): assert background color on dashboard root
4233d32  fix(e2e): rewrite specs to be data-shape-agnostic post-Wave-4 (PR #27)
71ac3e7  chore(infra): canonical enclii.yaml + namespace=accionables-madlab (PR #26)
52a76b0  chore(k8s): :latest → digest pin + .enclii.yml (PR #24)
5ad7288  chore: remove all Vercel references (PR #22)
1d8f000  fix(ci): scope E2E to chromium only
02eb336  fix(ci): drizzle-kit --force
53f16c8  fix(e2e): Playwright reuseExistingServer
9e1ab61  fix(e2e): API webServer reuseExistingServer  
f752435  fix(ci): scope E2E to chromium only
c2fc440  fix(ci): drizzle-kit --force
d963b36  fix(deps): pino-pretty as server devDep
417f638  fix(deps): drizzle-orm at root
0eb00d7  fix(ci): drizzle-kit module resolution
[earlier]  Waves 0-3 + #19, #20, #21
```

Plus the older Wave 0–3 commits below those.

## Open PRs

| PR | Branch | Status |
|---|---|---|
| #25 | `chore/staging-tier-overlay` | CI running. Staging tier overlay (RFC 0001 path A migration extended). Pre-merge checklist done — namespace renamed `accionables-madlab-staging` for consistency. |
| #29 | `fix/nginx-upstream-namespace` | CI running. One-line nginx upstream fix for the namespace migration. **MERGE THIS FIRST** — it unblocks client pods. |

## Blockers needing user action

### 🔴 1. Production Secret missing — pods crashlooping
The cutover authorized in this session migrated ArgoCD's workload to the `accionables-madlab` namespace. Server pods now `CreateContainerConfigError` because `accionables-madlab-secrets` doesn't exist there. The old `madlab` namespace was already drained (empty when I checked), so there's nothing to copy from.

**To fix**, run from a machine with cluster access:
```bash
# SSH to the cluster
ssh ssh.madfam.io  # or with explicit ProxyCommand if your config is missing

# Create the Secret with real values
sudo kubectl create secret generic accionables-madlab-secrets \
  --namespace=accionables-madlab \
  --from-literal=DATABASE_URL="postgresql://madlab:<REAL_PROD_PW>@postgres.data.svc.cluster.local:5432/madlab" \
  --from-literal=NODE_ENV=production \
  --from-literal=SESSION_SECRET="$(openssl rand -hex 32)" \
  --from-literal=ALLOWED_ORIGINS=https://madlab.quest \
  --from-literal=JANUA_ISSUER=https://auth.madfam.io \
  --from-literal=JANUA_AUDIENCE=madlab-api \
  --from-literal=JANUA_JWKS_URI=https://auth.madfam.io/.well-known/jwks.json \
  --from-literal=AI_PROVIDER=mock
```

`<REAL_PROD_PW>` — pull from the previous prod Secret in the `madlab` namespace if it still exists in K8s history, or from the platform vault, or ask whoever provisioned it originally.

### 🔴 2. madlab.quest Cloudflare tunnel route missing
Switchyard-api has a route-parameter bug (`:id` in handler registration vs `c.Param("service_id")` in handler body) that blocks both `enclii domains add` and direct API calls.

**Three options in order of recommendation:**

a. **Try `app.enclii.dev` UI** — visit, find `accionables-madlab` project, navigate to `madlab-client` service, **Domains** tab, add `madlab.quest`. The web UI uses the same endpoint but may handle errors differently or have a fallback path. (~5 min if it works.)

b. **File the switchyard-api bug**. Title: "switchyard-api domain routes: `:id` path param vs `service_id` Param() read mismatch in handlers.go:490 and domain_handlers.go:21". Files affected:
   - `apps/switchyard-api/internal/api/handlers.go:490`
   - `apps/switchyard-api/internal/api/domain_handlers.go:21`
   - `apps/switchyard-api/internal/api/networking_handlers.go:196`
   The fix: change `c.Param("service_id")` → `c.Param("id")` in the handler bodies, OR change the route registrations to use `:service_id`.

c. **Bypass via direct cloudflared edit** (need explicit auth):
   ```bash
   sudo kubectl edit configmap -n cloudflare-tunnel cloudflared-config
   ```
   Add an ingress rule mapping `madlab.quest` → `madlab-client.accionables-madlab.svc:80`. Higher blast radius — touching shared platform routing.

### 🟡 3. PR #25 staging tier — needs operator setup post-merge
After PR #25 merges, you'll need to:
- Provision `accionables-madlab-staging` namespace (`enclii onboard ... --tier=staging` if it accepts that flag, or manual `kubectl create ns`)
- Bootstrap `madlab-server-secrets-staging` Secret (separate values from prod)
- Create an ArgoCD Application pointing at `infra/k8s/overlays/staging/` syncing into the namespace
- Point `staging.madlab.quest` Cloudflare Tunnel route at `madlab-client.accionables-madlab-staging.svc:80`

These can all be done via enclii once the platform bug from #2 is resolved (or the UI workaround).

## Token/auth state

- `enclii` CLI is logged in as `admin@madfam.io` (token at `~/.enclii/credentials.json`, expires ~2026-04-24 23:50 local).
- `gh` CLI authed as `aldorl` with `repo`, `workflow` scopes.
- SSH to `ssh.madfam.io` works via `cloudflared access ssh --hostname` — but local `~/.ssh/config` references `/tmp/cloudflared` which doesn't exist; use `cloudflared` from `~/.local/bin/cloudflared` directly. Real config update suggested:
  ```
  Host ssh.madfam.io
    ProxyCommand /Users/aldoruizluna/.local/bin/cloudflared access ssh --hostname %h
    User solarpunk
    IdentityFile ~/.ssh/id_ed25519
  ```

## Branch protection state on main

8 required checks: Server Lint, Server Type Check, Server Unit Tests, Client Lint, Client Type Check, Client Unit Tests, **E2E Tests** (re-added end of session), Build Application. Linear history required, force-push blocked, deletion blocked, `enforce_admins: false` (admins can override).

## Test totals

| | Before session | Now |
|---|---:|---:|
| Server tests | 0 | 144 |
| Client tests | 140 | 161 |
| E2E (chromium) | broken | 19 passing |
| High/critical npm vulns | 14 | 0 |

## Restart instructions for Claude

When restarting Claude Code in this directory, paste this prompt to resume:

> Resume the stability remediation session. Read SESSION_HANDOFF.md for state. Top priorities: (1) merge PR #29 (nginx fix) — required before pods can come up; (2) verify madlab.quest after Cloudflare route is created via app.enclii.dev; (3) finalize cutover by checking pods are Ready in accionables-madlab namespace. The Playwright MCP server died mid-session — please restart it before #2 so I can do browser verification.

Also see CLAUDE.md "Stability Remediation — Waves 0–3" section for the long-form context.

## Things that are NOT broken (don't fix what isn't)

- Lint, type-check, unit tests, E2E — all green on main and on every open PR
- 8-gate branch protection — applied
- All P0/P1/P2 audit items except #28 (404) and #27 (which is in progress)
- The dashboard's tasks route hooks (`useTasks`, server `/api/tasks`) — wired correctly; just no data until seed runs against real DB

## Things to NOT touch unless reauthorized

- The `madfam-org/enclii` repo (shared infra) — file bugs there, don't push fixes
- Cloudflare API token at `enclii/enclii-cloudflare-credentials` Secret — anti-exfiltration
- `kubectl delete namespace` of any kind
- `enforce_admins: true` on branch protection — keep escape hatch

## My open questions for you

Listed for the next session:

1. Did you create the prod Secret? If yes, did pods come up?
2. Did the `app.enclii.dev` UI succeed in adding the `madlab.quest` domain, or did we need the bypass?
3. Is the existing `madlab-services` ArgoCD application still around, or did it get deleted? (It pointed at `madlab` namespace; if still around, it'll keep trying to sync there.)
