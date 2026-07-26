# CYBRIK Suite — Meta / Control Repository

> Status: repository/product implementation remains `SCAFFOLD` / `NOT IMPLEMENTED`
> (bootstrapped 2026-07-23). Within it: `docs/strategy/README.md` and documents 01–08 are
> **CANONICAL** (Founder decision 2026-07-23); ADR-0001 … ADR-0010 are all decided — `ACCEPTED`
> or `ACCEPTED FOR IMPLEMENTATION` — with `docs/adr/README.md` authoritative on per-ADR status,
> and an accepted ADR is a decision record, never implementation authority; `contracts/` holds
> both accepted-for-implementation pre-GA packets and proposed candidates; integration harnesses,
> tests, and release manifests remain unimplemented and no release exists.

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
  architecture, ADRs (all ten decided; see `docs/adr/README.md`), security, evaluation,
  operations (active W1 board and evidence register), releases (incl. the active
  `RELEASE-BLOCKERS` register), migration records. See `docs/README.md`.
- `contracts/` — cross-product API/event/schema/MCP contracts. Populated: some packets are
  `ACCEPTED FOR IMPLEMENTATION` at pre-GA `v0.1.0`/`v0.1.1` (not stable v1/GA), others remain
  `PROPOSED`. See `contracts/README.md`, whose own header has not yet been reconciled to this
  state and is tracked as an open residual in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.8.3.
- `integration/` — cross-product integration composition and fixtures. Directory scaffold only;
  no harness implemented.
- `tests/` — contract and end-to-end test harnesses. Directory scaffold only; no harness
  implemented.
- `releases/` — suite-level release manifests. Directory scaffold only; no release manifest and
  no release exists.
- `scripts/` — operational scripts for this repository only.

## Working in this repository

Read `CLAUDE.md` and `AGENTS.md` before making changes. Key rules:

- Contract-first: product repositories implement contracts defined here; contracts are not
  retro-fitted to implementations.
- Approval gates: structural changes, contract acceptance, and anything touching another
  repository require explicit Founder approval.
- Before editing any other repository from a cross-repo session, read that repository's own
  `CLAUDE.md`/`AGENTS.md` first.
