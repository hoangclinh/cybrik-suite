# docs/adr — Suite-level Architecture Decision Records

Status: catalog of ADRs. ADR-0001 and ADR-0006 were `ACCEPTED` by the Founder on
2026-07-24 (GATE A2, Wave 0). All other entries remain `PROPOSED — NOT DECIDED` briefs:
they frame decisions the Founder must make; none selects a technology, framework, or
vendor. Accepted ADRs record **policy/model decisions only** — no technical capability is
implemented.

| ADR | Title | Status |
|---|---|---|
| [ADR-0001](ADR-0001-suite-contract-versioning-policy.md) | Suite contract/versioning policy | `ACCEPTED` (2026-07-24) |
| [ADR-0002](ADR-0002-cyber-ai-implementation-stack.md) | Cyber AI implementation stack | `PROPOSED` |
| [ADR-0003](ADR-0003-durable-agent-orchestration.md) | Durable agent orchestration | `PROPOSED` |
| [ADR-0004](ADR-0004-tool-fabric-control-plane-executor-split.md) | Tool Fabric control-plane/executor split | `PROPOSED` |
| [ADR-0005](ADR-0005-sandbox-substrate.md) | Sandbox substrate | `PROPOSED` |
| [ADR-0006](ADR-0006-cross-product-event-and-identity-model.md) | Cross-product event and identity model | `ACCEPTED` (2026-07-24) |

Lifecycle: `PROPOSED` → `ACCEPTED` / `REJECTED` → (`SUPERSEDED`). Only the Founder moves an
ADR out of `PROPOSED`. Product repositories may not implement against a `PROPOSED` ADR.

## Decision-sprint documents (support material — decide nothing by themselves)

| Document | Purpose | Status |
|---|---|---|
| [ADR-DECISION-SPRINT-2026-07.md](ADR-DECISION-SPRINT-2026-07.md) | Sprint plan: dependency graph, wave board, exit criteria, evidence rules | `DRAFT` — Wave 0 gate closed 2026-07-24; Wave 1 NOT STARTED |
| [evidence/README.md](evidence/README.md) | Evidence-packet format and catalog | `DRAFT` |
| [evidence/ADR-0001-EVIDENCE.md](evidence/ADR-0001-EVIDENCE.md) | Evidence + recommendation for ADR-0001 | `DRAFT` — ADR-0001 since `ACCEPTED` (2026-07-24) |
| [evidence/ADR-0006-EVIDENCE.md](evidence/ADR-0006-EVIDENCE.md) | Evidence + recommendation for ADR-0006 | `DRAFT` — ADR-0006 since `ACCEPTED` (2026-07-24) |
| [FOUNDER-DECISION-PACKET-WAVE-0.md](FOUNDER-DECISION-PACKET-WAVE-0.md) | Wave 0 Founder answers (recorded) + superseded draft acceptance texts | `APPROVED — DECIDED` (2026-07-24) |
