# ADR-0003 durable agent orchestration — status-flip application

- **Prepared:** 2026-07-26
- **Applied:** 2026-07-26
- **Status:** `APPLIED 2026-07-26 — ADR-0003 STATUS FLIP RECORDED — NO IMPLEMENTATION AUTHORITY`
- **Applies to:** [ADR-0003 — Durable agent orchestration](ADR-0003-durable-agent-orchestration.md)
- **Resulting ADR status:** `ACCEPTED` (GATE A4, 2026-07-26) — decision only; no implementation,
  dependency, substrate, spike, benchmark, container, microVM, netns, broker, Git, deployment or
  release authority follows
- **Applied under:** GATE A4 Option A **accepted 2026-07-26** under Founder-delegated
  current-thread authority (`H1..H11=yes`, `J1..J10=yes`)
- **Release impact:** none. W0–W6 dates and the 2026-12-21 → 2026-12-31 release window remain
  unchanged. No release claim is made or implied.

This is a docs-only application that records a status flip. It moved ADR-0003 from
`PROPOSED — NOT DECIDED` to `ACCEPTED` as a **decision record only**. It does **not** adopt or
install any dependency, start any database, broker or container, open any Cyber AI or Fabric
product/runtime writer, or authorize any spike, benchmark, staging, commit, merge, push, deployment
or release. GATE A4 itself is
`ACCEPTED — GATE A4 CLOSED 2026-07-26 — STATUS FLIP APPLIED — NO IMPLEMENTATION AUTHORITY`.

## 1. Evidence sources

| Source | Exact reference |
|---|---|
| Decision packet | `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` §4 (H1–H11) |
| Supporting analysis and draft acceptance wording | `docs/adr/evidence/ADR-0003-EVIDENCE.md` §12 |
| ADR under application | `docs/adr/ADR-0003-durable-agent-orchestration.md` |
| Accepted upstream boundary | `docs/adr/ADR-0002-cyber-ai-implementation-stack.md` (`ACCEPTED` 2026-07-24) |
| Accepted upstream boundary | `docs/adr/ADR-0006-cross-product-event-and-identity-model.md` (`ACCEPTED` 2026-07-24) |
| Lane | W0-B04 — `DECISION READY`; no decision, no status flip |

Evidence is documentary and analytical only. No durable controller, store, outbox, worker loop,
timer, restart proof, real PostgreSQL run or benchmark exists in any product repository today.

## 2. Decisions carried forward by this application — H1–H11

Recorded verbatim from `FOUNDER-DECISION-PACKET-WAVE-2.md` §4. Each entry was answered `yes` at
GATE A4 on 2026-07-26 and is now part of the accepted ADR-0003 decision record. None of them
selects a dependency, authorizes a spike or opens implementation.

| Gate | Accepted answer |
|---|---|
| H1 | Yes — in-house PostgreSQL durable state machine behind a narrow `DurableExecutionPort`; CYBRIK controller remains authority |
| H2 | Yes — pre-qualify DBOS/MIT only as a spike-gated fallback behind the same port |
| H3 | Yes — reject Temporal for T0/T1 and reject Prefect as the substrate; Temporal revisitable only on measured large-T2 need |
| H4 | Yes — same PostgreSQL, separate orchestration schema, FORCE RLS, no cross-product joins |
| H5 | Yes — deterministic controller validates plans, transitions, budgets and bounded nodes; substrate only persists |
| H6 | Yes — durable `waiting_approval`, policy-digest recheck, cancel/kill-switch recheck, retry/compensation/timeout and receipt preservation |
| H7 | Yes — orchestration idempotency key + mandatory effect ledger; Fabric dedup; exact-once-effect illusion only |
| H8 | Yes — transactional outbox always; at-least-once and `event_id` dedup; exact broker pin deferred |
| H9 | Yes — workflow definitions immutable/versioned/digest-pinned; retry is a new attempt |
| H10 | Yes — authorize a separately scoped A4 comparison spike; flip to DBOS only if in-house invariants fail and DBOS unknowns resolve |
| H11 | Yes — record the ADR-0002 dependency as resolved; carry broker pin, DBOS unknowns, resume reliability and approval-ingress as explicit deferrals |

H11 note: the ADR-0002 dependency is **resolved**, not deferred. It must not be re-carried as an
open H11 deferral.

## 3. CI and verification posture

**CI: NOT WIRED** for anything in this application. There is no pipeline job, no orchestration
test suite, no persistence test and no restart-survival harness registered for ADR-0003. No CI
result is claimed.

The only executable verification touching this document is the suite control validator, which
checks documentary invariants — not orchestration behavior:

```bash
node tools/operations/validate-w1-control.mjs
node --test tools/operations/tests/validate-w1-control.test.mjs
```

## 4. Static-only boundaries

- **Static/documentary evidence only.** No durability, no replay fidelity, no restart survival, no
  exactly-once effect behavior and no latency figure is demonstrated.
- No PostgreSQL instance, schema, RLS policy, outbox table, broker or worker process exists or is
  started.
- No DBOS, Temporal or Prefect dependency is adopted, installed, pinned or evaluated by execution.
- The exact broker pin remains deferred.
- Resume reliability and approval-ingress remain explicit carried deferrals.
- `DurableExecutionPort` is a proposed port name, not an implemented interface.
- Nothing here proves the live W1 walking skeleton. Offline W0-T10 conformance is not a substitute.

## 5. What the applied status flip did and did not do

The flip moved ADR-0003 out of `PROPOSED — NOT DECIDED` to `ACCEPTED`. It does **not**:

- authorize the Cyber AI pure controller/port foundation — that is a separate authorization for
  `orchestration/{types,ports,state_machine,effects,outbox,errors}.py` plus focused tests, with no
  database and no broker;
- authorize the ADR-0003 comparison spike, which runs separately and before any fallback adoption;
- authorize real persistence, outbox or relay slices, which come only after those proofs;
- install a dependency, start a database/container, or select a broker;
- authorize any commit, merge, push, deployment, credential handling, release or release-date
  change;
- promote W1 runtime writers, which remain `NO-GO`, or change `W0 COMPLETE=0`.

## 6. Residual gates

1. **GATE A4 — closed 2026-07-26.** Option A was accepted under Founder-delegated current-thread
   authority; `H1..H11` are `yes` and ADR-0003 is `ACCEPTED` as a decision record. No open gate
   remains from this item, and no implementation authority may be inferred from it. Gates 2–7
   below are unaffected and remain open.
2. **Separate Cyber AI controller/port authorization** with exact repo, base SHA, path allowlist,
   RED/acceptance command and named reviewer.
3. **Separate ADR-0003 comparison spike** (H10) before any DBOS fallback adoption.
4. **Broker pin** (H8) — deferred, no product selected.
5. **Resume reliability and approval-ingress** (H11) — carried deferrals.
6. **Real persistence/outbox authorization** — held until spike proofs exist.
7. **`ADR-DECISION-SPRINT-2026-07.md` stale header — closed 2026-07-26.** Its progress block
   previously stated that no Wave 2 decision packet exists, which
   `FOUNDER-DECISION-PACKET-WAVE-2.md` contradicted. That file was outside this application's write
   allowlist; it was repaired on disk on 2026-07-26 under a separate bounded authority and its
   progress block and §3 wave-board row now record the Wave 2 decision packet at `DECISION READY`
   with **GATE A4 still `NOT OPEN`, no ADR status flipped** and ADR-0003 still
   `PROPOSED — NOT DECIDED` **at that time**. That header was subsequently updated again when
   GATE A4 closed on 2026-07-26; it now records the closure and ADR-0003 as `ACCEPTED`. No open
   gate remains from this item; gates 2–6 above are unaffected.
   See `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §3 for the closure record.

This application is `APPLIED 2026-07-26` and ADR-0003 is `ACCEPTED` as a decision record only.
Every implementation, dependency, spike, benchmark, DB/container/broker, Git, deployment and
release action listed in §5 remains separately gated.
