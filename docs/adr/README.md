# docs/adr — Suite-level Architecture Decision Records

Status: catalog of ADRs. ADR-0001/ADR-0006 were `ACCEPTED` at GATE A2 and
ADR-0002/ADR-0004 at GATE A3 on 2026-07-24. ADR-0003/ADR-0005 are `ACCEPTED` at GATE A4 on
2026-07-26 — decision only; that acceptance grants no implementation, dependency, substrate, spike,
DB/container/broker, Git, deployment or release authority; ADR-0007 (org hierarchy &
external-authority boundary) is `ACCEPTED`
at GATE W2-C1 on 2026-07-24 (architectural model + open-decision constraints only; its contract
delta stays `PROPOSED — NOT APPLIED`, a separate gate); ADR-0008 (internal service delegation &
workload identity) is `ACCEPTED FOR IMPLEMENTATION` at GATE W2-F on 2026-07-24 (v0.1.0; not stable
v1/GA), realizing the ADR-0006 E2/E3 two-layer trust seam contract-first; ADR-0009 (org-hierarchy &
external-authority contract profile) is `ACCEPTED FOR IMPLEMENTATION` at GATE W2-G on 2026-07-24
(v0.1.0; not stable v1/GA), applying the ADR-0007 contract delta; and ADR-0010 (capability-name
canonicalization) is `ACCEPTED FOR IMPLEMENTATION — APPLIED` on 2026-07-26 (pre-GA patch 0.1.1).
All ten suite ADRs are therefore decided; none is still `PROPOSED`. Accepted ADRs record
architectural policy/model decisions only — no technical capability is implemented by their
acceptance.

| ADR | Title | Status |
|---|---|---|
| [ADR-0001](ADR-0001-suite-contract-versioning-policy.md) | Suite contract/versioning policy | `ACCEPTED` (2026-07-24) |
| [ADR-0002](ADR-0002-cyber-ai-implementation-stack.md) | Cyber AI implementation stack | `ACCEPTED` (2026-07-24) |
| [ADR-0003](ADR-0003-durable-agent-orchestration.md) | Durable agent orchestration | `ACCEPTED` (GATE A4, 2026-07-26) — decision only |
| [ADR-0004](ADR-0004-tool-fabric-control-plane-executor-split.md) | Tool Fabric control-plane/executor split | `ACCEPTED` (2026-07-24) |
| [ADR-0005](ADR-0005-sandbox-substrate.md) | Sandbox substrate | `ACCEPTED` (GATE A4, 2026-07-26) — decision only |
| [ADR-0006](ADR-0006-cross-product-event-and-identity-model.md) | Cross-product event and identity model | `ACCEPTED` (2026-07-24) |
| [ADR-0007](ADR-0007-org-hierarchy-and-external-authority-boundary.md) | Organizational hierarchy & external-authority boundary model | `ACCEPTED` (W2-C1, 2026-07-24) — model only; contract delta not applied |
| [ADR-0008](ADR-0008-internal-service-delegation-and-workload-identity.md) | Internal service delegation & workload-identity profile | `ACCEPTED FOR IMPLEMENTATION` (W2-F, 2026-07-24) — v0.1.0, not stable v1/GA |
| [ADR-0009](ADR-0009-org-hierarchy-and-external-authority-contract-profile.md) | Org-hierarchy & external-authority contract profile | `ACCEPTED FOR IMPLEMENTATION` (W2-G, 2026-07-24) — v0.1.0, not stable v1/GA; applies the ADR-0007 contract delta, re-decides no model |
| [ADR-0010](ADR-0010-capability-name-canonicalization.md) | Capability-name canonicalization across JSON Schema runtimes | `ACCEPTED FOR IMPLEMENTATION — APPLIED` (2026-07-26) — pre-GA patch 0.1.1, not stable v1/GA |

Lifecycle: `PROPOSED` → `ACCEPTED` / `REJECTED` → (`SUPERSEDED`). Only the Founder moves an
ADR out of `PROPOSED`. Product repositories may not implement against a `PROPOSED` ADR, and an
`ACCEPTED` ADR is a decision record — it is not by itself implementation authority.

`docs/README.md`, the root `README.md` and `docs/operations/README.md` were reconciled to this
catalog on 2026-07-26 under the nine-path documentation authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.8. Still carrying pre-closure GATE A4 wording on
disk, and therefore still an **open residual reconciliation gate** (board §14.8.3, also tracked in
[FOUNDER-DECISION-PACKET-WAVE-2.md](FOUNDER-DECISION-PACKET-WAVE-2.md) §12): both Wave 2 evidence
packets, `docs/operations/OVERNIGHT-HANDOFF-2026-07-24.md`,
[FOUNDER-DECISION-PACKET-WAVE-1.md](FOUNDER-DECISION-PACKET-WAVE-1.md) and `contracts/README.md`.
Each is outside the nine-path allowlist and awaits its own bounded authority. **This catalog is
authoritative on ADR status.**

## Decision-sprint documents (support material — decide nothing by themselves)

| Document | Purpose | Status |
|---|---|---|
| [ADR-DECISION-SPRINT-2026-07.md](ADR-DECISION-SPRINT-2026-07.md) | Sprint plan: dependency graph, wave board, exit criteria, evidence rules | `DRAFT` — GATE A2/A3 closed 2026-07-24; GATE A4 closed 2026-07-26 |
| [evidence/README.md](evidence/README.md) | Evidence-packet format and catalog | `DRAFT` |
| [evidence/ADR-0001-EVIDENCE.md](evidence/ADR-0001-EVIDENCE.md) | Evidence + recommendation for ADR-0001 | `DRAFT` — ADR-0001 since `ACCEPTED` (2026-07-24) |
| [evidence/ADR-0002-EVIDENCE.md](evidence/ADR-0002-EVIDENCE.md) | Evidence + recommendation for ADR-0002 | `DRAFT` — ADR-0002 since `ACCEPTED` (2026-07-24) |
| [evidence/ADR-0003-EVIDENCE.md](evidence/ADR-0003-EVIDENCE.md) | Evidence + recommendation for ADR-0003 | `DRAFT` — Wave 2 read-ahead; ADR-0003 since `ACCEPTED` (GATE A4, 2026-07-26); this file still carries pre-closure wording (open residual reconciliation gate) |
| [evidence/ADR-0004-EVIDENCE.md](evidence/ADR-0004-EVIDENCE.md) | Evidence + recommendation for ADR-0004 | `DRAFT` — ADR-0004 since `ACCEPTED` (2026-07-24) |
| [evidence/ADR-0005-EVIDENCE.md](evidence/ADR-0005-EVIDENCE.md) | Evidence + recommendation for ADR-0005 | `DRAFT` — Wave 2 read-ahead; ADR-0005 since `ACCEPTED` (GATE A4, 2026-07-26); this file still carries pre-closure wording (open residual reconciliation gate) |
| [evidence/ADR-0006-EVIDENCE.md](evidence/ADR-0006-EVIDENCE.md) | Evidence + recommendation for ADR-0006 | `DRAFT` — ADR-0006 since `ACCEPTED` (2026-07-24) |
| [FOUNDER-DECISION-PACKET-WAVE-0.md](FOUNDER-DECISION-PACKET-WAVE-0.md) | Wave 0 Founder answers (recorded) + superseded draft acceptance texts | `APPROVED — DECIDED` (2026-07-24) |
| [FOUNDER-DECISION-PACKET-WAVE-1.md](FOUNDER-DECISION-PACKET-WAVE-1.md) | Wave 1 Founder answers + superseded draft acceptance texts | `APPROVED — DECIDED` (2026-07-24); its closing note still says GATE A4 is not open — open residual, board §14.8.3 |
| [FOUNDER-DECISION-PACKET-WAVE-2.md](FOUNDER-DECISION-PACKET-WAVE-2.md) | Wave 2 (GATE A4) decision packet for ADR-0003/ADR-0005 | Answered 2026-07-26; Option A accepted with `H1..H11=yes` / `J1..J10=yes` — decision only |
| [FOUNDER-DECISION-PACKET-W1-C1-C2.md](FOUNDER-DECISION-PACKET-W1-C1-C2.md) | W1-C1/C2 contract-gate decision packet (separate gate; flips no ADR status) | Answered 2026-07-26 with `C1-1..C1-10=yes` / `C2-1..C2-10=yes` |
| [ADR-0003-STATUS-FLIP-APPLICATION.md](ADR-0003-STATUS-FLIP-APPLICATION.md) | Docs-only application of the ADR-0003 GATE A4 status flip | `APPLIED 2026-07-26` — decision record only, no implementation authority |
| [ADR-0005-STATUS-FLIP-APPLICATION.md](ADR-0005-STATUS-FLIP-APPLICATION.md) | Docs-only application of the ADR-0005 GATE A4 status flip | `APPLIED 2026-07-26` — decision record only, no implementation authority |
| [W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md](W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md) | Recorded acceptance of the W1-C1 alert-context packet | `APPLIED 2026-07-26`; packet `ACCEPTED FOR IMPLEMENTATION v0.1.0` as the 16-path local commit `3a2c715…` only — not pushed, not merged, not released |
| [W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md](W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md) | Recorded acceptance of the W1-C2 investigation-lifecycle packet | `APPLIED 2026-07-26`; packet `ACCEPTED FOR IMPLEMENTATION v0.1.0` as the 32-path local commit `ed95e51…` only — not pushed, not merged, not released; Bundle v0.1.1 stays `PROPOSED` and v0.1.0 stays authoritative |
| [FOUNDER-DECISION-PACKET-W0-IR01-CONTROLLED-INTEGRATION.md](FOUNDER-DECISION-PACKET-W0-IR01-CONTROLLED-INTEGRATION.md) | W0-IR01 controlled integration and hosted control gate; asks `G-IR01` — may routine integration stop being Founder-manual? | `DECIDED — OPTION Z — FOUNDER-MANUAL` (2026-07-29). `G-IR01` answered `NO-GO`; routine delegated integration stays `NO-GO` and each integration action stays an explicit per-action manual grant. Independent review run `18ad27e1-ef5e-49f9-a8fa-725306c810b6` `PASS`, `P0=P1=P2=0`, five `P3` retained. Imported here docs-only on 2026-07-29 as an exact byte copy — import is not acceptance, not canonical integration and opens no gate. Board §16, register §28 |
| [FOUNDER-DECISION-PACKET-W0-T11-RESOURCE-BUDGET.md](FOUNDER-DECISION-PACKET-W0-T11-RESOURCE-BUDGET.md) | W0-T11 resource-budget contract instrument — scope, naming and sequencing questions `T11-RB-1` … `T11-RB-8` | `DECIDED — PARKED — DOCS-ONLY — NO GATE OPENED — NOT INTEGRATED` (2026-07-29). Operative naming `res-bounds-*` with `resource-bounds/`; the `res-budget` and `res-envelope` generations are superseded; parked until W1-C1 and W1-C2 are canonically integrated. No gate opens and **no ADR number is allocated** — this catalog stays authoritative on ADR status. Independent review run `60adebd4-d22f-4134-8918-1dfd83e89712` `PASS`, `P0=P1=P2=0`, five `P3` retained. Imported here docs-only on 2026-07-29 as an exact byte copy. Board §16, register §28 |
