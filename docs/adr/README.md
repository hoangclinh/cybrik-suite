# docs/adr — Suite-level Architecture Decision Records

Status: catalog of ADRs. ADR-0001/ADR-0006 were `ACCEPTED` at GATE A2 and
ADR-0002/ADR-0004 at GATE A3 on 2026-07-24. ADR-0003/ADR-0005 remain
`PROPOSED — NOT DECIDED`; ADR-0007 (org hierarchy & external-authority boundary) is `ACCEPTED`
at GATE W2-C1 on 2026-07-24 (architectural model + open-decision constraints only; its contract
delta stays `PROPOSED — NOT APPLIED`, a separate gate); ADR-0008 (internal service delegation &
workload identity) is `ACCEPTED FOR IMPLEMENTATION` at GATE W2-F on 2026-07-24 (v0.1.0; not stable
v1/GA), realizing the ADR-0006 E2/E3 two-layer trust seam contract-first. Accepted ADRs record
architectural policy/model decisions only — no technical capability is implemented by their
acceptance.

| ADR | Title | Status |
|---|---|---|
| [ADR-0001](ADR-0001-suite-contract-versioning-policy.md) | Suite contract/versioning policy | `ACCEPTED` (2026-07-24) |
| [ADR-0002](ADR-0002-cyber-ai-implementation-stack.md) | Cyber AI implementation stack | `ACCEPTED` (2026-07-24) |
| [ADR-0003](ADR-0003-durable-agent-orchestration.md) | Durable agent orchestration | `PROPOSED` |
| [ADR-0004](ADR-0004-tool-fabric-control-plane-executor-split.md) | Tool Fabric control-plane/executor split | `ACCEPTED` (2026-07-24) |
| [ADR-0005](ADR-0005-sandbox-substrate.md) | Sandbox substrate | `PROPOSED` |
| [ADR-0006](ADR-0006-cross-product-event-and-identity-model.md) | Cross-product event and identity model | `ACCEPTED` (2026-07-24) |
| [ADR-0007](ADR-0007-org-hierarchy-and-external-authority-boundary.md) | Organizational hierarchy & external-authority boundary model | `ACCEPTED` (W2-C1, 2026-07-24) — model only; contract delta not applied |
| [ADR-0008](ADR-0008-internal-service-delegation-and-workload-identity.md) | Internal service delegation & workload-identity profile | `ACCEPTED FOR IMPLEMENTATION` (W2-F, 2026-07-24) — v0.1.0, not stable v1/GA |

Lifecycle: `PROPOSED` → `ACCEPTED` / `REJECTED` → (`SUPERSEDED`). Only the Founder moves an
ADR out of `PROPOSED`. Product repositories may not implement against a `PROPOSED` ADR.

## Decision-sprint documents (support material — decide nothing by themselves)

| Document | Purpose | Status |
|---|---|---|
| [ADR-DECISION-SPRINT-2026-07.md](ADR-DECISION-SPRINT-2026-07.md) | Sprint plan: dependency graph, wave board, exit criteria, evidence rules | `DRAFT` — GATE A2/A3 closed; Wave 2 evidence ready, GATE A4 not open |
| [evidence/README.md](evidence/README.md) | Evidence-packet format and catalog | `DRAFT` |
| [evidence/ADR-0001-EVIDENCE.md](evidence/ADR-0001-EVIDENCE.md) | Evidence + recommendation for ADR-0001 | `DRAFT` — ADR-0001 since `ACCEPTED` (2026-07-24) |
| [evidence/ADR-0002-EVIDENCE.md](evidence/ADR-0002-EVIDENCE.md) | Evidence + recommendation for ADR-0002 | `DRAFT` — ADR-0002 since `ACCEPTED` (2026-07-24) |
| [evidence/ADR-0003-EVIDENCE.md](evidence/ADR-0003-EVIDENCE.md) | Evidence + recommendation for ADR-0003 | `DRAFT` — Wave 2 read-ahead; ADR still `PROPOSED` |
| [evidence/ADR-0004-EVIDENCE.md](evidence/ADR-0004-EVIDENCE.md) | Evidence + recommendation for ADR-0004 | `DRAFT` — ADR-0004 since `ACCEPTED` (2026-07-24) |
| [evidence/ADR-0005-EVIDENCE.md](evidence/ADR-0005-EVIDENCE.md) | Evidence + recommendation for ADR-0005 | `DRAFT` — Wave 2 read-ahead; ADR still `PROPOSED` |
| [evidence/ADR-0006-EVIDENCE.md](evidence/ADR-0006-EVIDENCE.md) | Evidence + recommendation for ADR-0006 | `DRAFT` — ADR-0006 since `ACCEPTED` (2026-07-24) |
| [FOUNDER-DECISION-PACKET-WAVE-0.md](FOUNDER-DECISION-PACKET-WAVE-0.md) | Wave 0 Founder answers (recorded) + superseded draft acceptance texts | `APPROVED — DECIDED` (2026-07-24) |
| [FOUNDER-DECISION-PACKET-WAVE-1.md](FOUNDER-DECISION-PACKET-WAVE-1.md) | Wave 1 Founder answers + superseded draft acceptance texts | `APPROVED — DECIDED` (2026-07-24) |
