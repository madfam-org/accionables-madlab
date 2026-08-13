# Runbook

The operational runbook for this service lives in MADFAM internal docs
(`internal-devops`, `docs/imported/accionables-madlab-RUNBOOK.md`), together
with the historical session handoff it superseded. Public repos don't carry
cluster topology, operational procedures, or secret-bootstrap steps — see the
repository boundary contract in MADFAM internal docs.

For everything a contributor needs without cluster access:

- Local development: `docs/guides/getting-started.md` and
  `docs/infrastructure/README_INFRA.md`
- How a change reaches production (CI → image build → GitOps sync):
  `docs/deployment/README.md` and `docs/deployment/AUTOMATION.md`

<!-- Boundary checkpoint 2026-08-12 (owner: MADFAM platform team): operational
     detail is private-sink; this stub is the public summary. Policy:
     internal-devops/docs/repo-boundary-contract.md -->
