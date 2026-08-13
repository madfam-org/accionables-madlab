# accionables-madlab — Ecosystem Context

> **MADLAB — gamified science-and-tech educational events for Mexican primary schools.**

This is the public, repo-level ecosystem context. Detailed platform topology,
operational procedures, and the full internal tooling reference live in MADFAM
internal docs (private repo `madfam-org/internal-devops`), not in any public
repo.

---

## 1. What this repo is

MADLAB is a live educational event product: 3-hour gamified science-and-tech presentations for primary schools (grupos of 20–100 students), aligned to Mexican national competency standards + UN SDGs (water, clean energy, recycling). This repo ships the client app (waitlist, stats, ND-profile signups) + content scripts. Not a major platform — ecosystem role is lead-gen + community engagement for the broader MADFAM learning pillar.

**Pillar**: Learning / Event product
**Type**: service
**Status**: production (limited)

### Deployed services

| Service | Public domain | Container port |
|---|---|---|
| `madlab-client` | (internal/event) | 3000 |

### Upstream dependencies (this repo consumes)

- postgres (waitlist, event signups)
- janua (admin auth)
- phynd-crm (lead webhook)

### Downstream consumers (this repo is consumed by)

- phynd-crm (waitlist leads)
- MADFAM events team (scheduling + delivery)

### Key environment variables

- `DATABASE_URL` — Postgres.
- `JANUA_JWKS_URI` — Janua admin auth.
- `CRM_WEBHOOK_URL` / `CRM_WEBHOOK_SECRET` — lead forwarding.
- `LOCAL_SERVICES`, `LOCAL_DB`, `LOCAL_DESTRUCTIVE` — local operator
  acknowledgement guards; do not set these in committed env files.

---

## 2. How this fits the MADFAM stack

- **Deployment**: this service deploys on **enclii**, MADFAM's internal
  platform (GitOps: CI builds and signs images, commits digests to
  `infra/k8s/production/kustomization.yaml`, and the platform reconciles).
  See `docs/deployment/README.md` for the walkthrough.
- **Auth**: authenticated endpoints verify Janua-issued JWTs (RS256) against
  the public JWKS endpoint configured via `JANUA_JWKS_URI` (see
  `apps/server/.env.example`). HS256 is not accepted.
- **CORS**: explicit allowlist per service via `ALLOWED_ORIGINS`; wildcards
  are banned.
- **Images**: `@sha256:`-pinned in every manifest; mutable tags are rejected
  by platform policy.

Everything deeper — cluster and node topology, operational access, the
platform CLI reference, cross-repo operational conventions — is intentionally
not documented here. Cluster access (kubeconfig, SSH) is bootstrap/break-glass
only and lives in MADFAM internal docs.

---

## Document provenance

Generated 2026-04-23 as part of the "each repo stands alone" docs sweep;
**sanitized 2026-08-12 to the public repo boundary** (internal topology,
sibling-repo operational map, and platform CLI reference relocated to MADFAM
internal docs — see `internal-devops/docs/repo-boundary-contract.md`). If this
file is ever re-rendered from the shared template, re-apply the public-safe
trim before committing: this repo is public.

<!-- Boundary checkpoint 2026-08-12 (owner: MADFAM platform team): this file
     is the public summary; full ecosystem/topology context is private-sink.
     Policy: internal-devops/docs/repo-boundary-contract.md -->
