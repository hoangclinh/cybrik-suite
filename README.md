# CYBRIK Suite — Meta / Control Repository

> Status: repository/product implementation remains `SCAFFOLD` / `NOT IMPLEMENTED`
> (bootstrapped 2026-07-23). Within it: `docs/strategy/README.md` and documents 01–08 are
> **CANONICAL** (Founder decision 2026-07-23); ADRs are `PROPOSED — NOT DECIDED`; contracts,
> integration harnesses, tests, and release manifests remain unimplemented.

This is the **meta/control repository** for the CYBRIK Suite. It contains **no product source
code**. It exists to hold what must be shared and governed across the product repositories:
strategy and architecture documentation, cross-product contracts, integration and compatibility
test harnesses, and release control.

## The Suite

| Repository | Role |
|---|---|
| `cybrik-suite` (this repo) | Docs, contracts, integration, release control. No product code. |
| `cybrik-soc-command-center` | SOC platform. Owns SOC truth: alerts, cases, assets, analyst identity. |
| `cybrik-cyber-ai-platform` | Cyber AI product. Model runtime, RAG/CTI pipelines, agent orchestration, evaluation. `NOT IMPLEMENTED`. |
| `cybrik-security-tool-fabric` | Tool Fabric product. Capability registry, REST/MCP gateway, policy/approval, sandbox, execution receipts. `NOT IMPLEMENTED`. |

All four repositories are **independent sibling Git repositories**. No submodules, no source
symlinks, no relative runtime imports between them. Cross-repository references in documentation
use the repository-qualified form `repo-name:path/to/file`.

## Layout

- `docs/` — strategy (**CANONICAL** — imported from SOC and canonicalized 2026-07-23),
  architecture, ADRs (`PROPOSED` briefs), security, evaluation, operations, releases
  (incl. the active `RELEASE-BLOCKERS` register), migration records. See `docs/README.md`.
- `contracts/` — cross-product API/event/schema/MCP contracts. **Empty by design** until the
  first contract is proposed and accepted. See `contracts/README.md`.
- `integration/` — cross-product integration composition and fixtures. Empty by design.
- `tests/` — contract and end-to-end test harnesses. Empty by design.
- `releases/` — suite-level release manifests. Empty by design.
- `scripts/` — operational scripts for this repository only.

## Working in this repository

Read `CLAUDE.md` and `AGENTS.md` before making changes. Key rules:

- Contract-first: product repositories implement contracts defined here; contracts are not
  retro-fitted to implementations.
- Approval gates: structural changes, contract acceptance, and anything touching another
  repository require explicit Founder approval.
- Before editing any other repository from a cross-repo session, read that repository's own
  `CLAUDE.md`/`AGENTS.md` first.
