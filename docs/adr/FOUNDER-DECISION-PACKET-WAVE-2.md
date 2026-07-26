# Founder Decision Packet — Wave 2 / GATE A4

- **Prepared:** 2026-07-26
- **Status:** `ACCEPTED — GATE A4 CLOSED 2026-07-26 — STATUS FLIP APPLIED — NO IMPLEMENTATION AUTHORITY`
- **Decisions:** ADR-0003 durable orchestration and ADR-0005 sandbox/isolation substrate mapping
- **Recommendation:** Option A; H1–H11=yes and J1–J10=yes
- **Decision:** Option A **accepted 2026-07-26** under Founder-delegated current-thread authority;
  ADR-0003 `H1..H11` accepted and ADR-0005 `J1..J10` accepted; ADR-0003 and ADR-0005 are now
  `ACCEPTED`
- **Decision scope:** decision record only — GATE A4 is closed and both ADRs are `ACCEPTED`, and
  nothing beyond that record was granted.
- **Release impact:** none. This packet changes no W0–W6 date, contract lifecycle, product status,
  dependency, deployment or release state.

This packet closed the missing decision-packet prerequisite recorded in the ADR sprint. It packaged
the existing read-ahead evidence into exact answerable decisions, and those decisions were answered
on 2026-07-26. The exact scope of that answer:

- This acceptance flips ADR-0003 and ADR-0005 to `ACCEPTED` and grants nothing else: no
  implementation, no dependency selection or installation, no spike or benchmark run, no database,
  container, microVM, netns or broker start, and no staging, commit, merge, push, deployment,
  release or release-date authority.
- The two docs-only evidence-linked status-flip applications listed in §9 are `APPLIED 2026-07-26`.
  They record the flip and nothing more. **Scope of this statement: GATE A4's own effect.** No
  contract lifecycle status moved *because of GATE A4*, and nothing in this packet touched the
  W1-C1/W1-C2 contract gate. That gate was answered **separately** on the same date and is now
  `ACCEPTED — W1-C1/C2 CONTRACT GATE CLOSED 2026-07-26 — LOCAL COMMITS ONLY — NOT PUSHED`, with both
  packets at `ACCEPTED FOR IMPLEMENTATION v0.1.0`; see
  [FOUNDER-DECISION-PACKET-W1-C1-C2.md](FOUNDER-DECISION-PACKET-W1-C1-C2.md), which is authoritative
  on that gate. The earlier reading of this bullet — that the contract gate remains
  `DECISION READY — CONTRACT GATE NOT OPEN` — was true only before that separate decision and is
  dated history. Neither acceptance grants the other anything: GATE A4 grants no contract
  acceptance, the contract gate grants no ADR status change, and neither opens a product or runtime
  writer or any push, merge, deployment or release authority.

## 1. Why GATE A4 is on the W1/W2 critical path

The W1 walking skeleton requires Cyber AI job state/checkpoint/cancel and Fabric R0 execution. W2
then requires durable orchestration and isolated analysis. Current product state does not prove
either:

- Cyber AI has a bounded model-runtime/summarization seam but no durable investigation controller,
  worker loop, persistence, outbox, effect ledger, timer or restart proof.
- Fabric has offline contract conformance and an executor tier-label scaffold, but no registry,
  invocation, receipt ledger, sandbox driver, broker or isolation runtime.
- W0-T10 is offline conformance only.

ADR-0002 already fixes the CYBRIK-owned deterministic controller and single-PostgreSQL starting
posture. ADR-0004 already fixes the control-plane/executor split and requires disposable isolation
for untrusted classes. GATE A4 chooses the substrate below those accepted boundaries; it does not
reopen them.

## 2. Evidence refresh

The 2026-07-24 evidence packets contain stale current-state sentences saying Cyber AI was
documentation-only and Fabric had no source. The recommendations remain applicable, but current
evidence is now:

| Product | Current exact evidence | Still missing |
|---|---|---|
| Cyber AI | committed branch `281b2529...`; partial model-runtime/summarization code; exact clean T10 worktree; unintegrated I05/I06 hardening/eval evidence | durable controller/store/outbox/worker, real PostgreSQL/RLS/restart, investigation API/producer, production runtime profiles |
| Fabric | clean capability application commit `6f72616...`; canonical dirty W2-H offline conformance; minimal health/version service and tier parser | registry/invocation/policy/receipt/kill switch, real control↔executor transport, sandbox drivers, brokers and tool runtime |

This refresh changes no option score: both products still need the substrate decisions before they
can truthfully claim the corresponding runtime capability.

## 3. Options — Option A selected 2026-07-26

| Option | Meaning |
|---|---|
| **A — accept both recommendations (SELECTED 2026-07-26)** | Decide H1–H11 and J1–J10 `yes`; flip ADR-0003 and ADR-0005 to `ACCEPTED` through the two docs-only evidence-linked status-flip applications. Implementation, dependency selection, spike, benchmark, DB/container/broker, staging, commit, merge, push, deployment and release each remain separately gated. |
| B — decide durability only (not selected) | Decide H1–H11 `yes`; keep ADR-0005 proposed. W1 pure controller/port work may prepare, but sandbox/runtime work stays closed. |
| C — defer GATE A4 (not selected) | Keep both ADRs proposed; permit read-only/proposal work only. W1 durable runtime and all W2 isolated-analysis implementation remain blocked. |

## 4. ADR-0003 exact decisions — H1–H11 (all accepted 2026-07-26)

| Gate | Accepted decision |
|---|---|
| H1 | **Yes** — in-house PostgreSQL durable state machine behind a narrow `DurableExecutionPort`; CYBRIK controller remains authority |
| H2 | **Yes** — pre-qualify DBOS/MIT only as a spike-gated fallback behind the same port |
| H3 | **Yes** — reject Temporal for T0/T1 and reject Prefect as the substrate; Temporal revisitable only on measured large-T2 need |
| H4 | **Yes** — same PostgreSQL, separate orchestration schema, FORCE RLS, no cross-product joins |
| H5 | **Yes** — deterministic controller validates plans, transitions, budgets and bounded nodes; substrate only persists |
| H6 | **Yes** — durable `waiting_approval`, policy-digest recheck, cancel/kill-switch recheck, retry/compensation/timeout and receipt preservation |
| H7 | **Yes** — orchestration idempotency key + mandatory effect ledger; Fabric dedup; exact-once-effect illusion only |
| H8 | **Yes** — transactional outbox always; at-least-once and `event_id` dedup; exact broker pin deferred |
| H9 | **Yes** — workflow definitions immutable/versioned/digest-pinned; retry is a new attempt |
| H10 | **Yes** — authorize a separately scoped A4 comparison spike; flip to DBOS only if in-house invariants fail and DBOS unknowns resolve |
| H11 | **Yes** — record the ADR-0002 dependency as resolved; carry broker pin, DBOS unknowns, resume reliability and approval-ingress as explicit deferrals |

The exact supporting analysis and draft acceptance wording remain in
`docs/adr/evidence/ADR-0003-EVIDENCE.md` §12.

## 5. ADR-0005 exact decisions — J1–J10 (all accepted 2026-07-26)

| Gate | Accepted decision |
|---|---|
| J1 | **Yes** — risk-tiered sandbox-profile floors; capability→profile binding remains a Capability Registry/PDP decision and policy may only raise isolation |
| J2 | **Yes** — hardened rootless OCI substrate floor for S0 and no-file S4; only policy-approved S0/R0 metadata workers may be pooled, while S4 remains per-invocation disposable under accepted ADR-0004 F3 |
| J3 | **Yes** — disposable no-network gVisor `runsc` floor for S1; no 1:1 capability-risk binding is decided here |
| J4 | **Yes** — Firecracker microVM mandatory floor for S2; gVisor may be defense-in-depth only, and any R2 execution remains disposable under ADR-0004 F3 |
| J5 | **Yes** — Firecracker + separate netns + control-side egress broker for S3; any R2/R3 execution remains disposable under ADR-0004 F3 |
| J6 | **Yes** — R4 destructive remains denied to agents in 1.x |
| J7 | **Yes** — Kata `RuntimeClass` wrapper for T1/T2; direct Firecracker+jailer at T0 |
| J8 | **Yes** — fail closed when required isolation is unavailable; never downgrade S2/S3; never run raw file/PCAP in API/host process |
| J9 | **Yes** — macOS is dev-loop-only; S2/S3 require Linux host/CI with KVM; no native parity claim |
| J10 | **Yes** — defer kernel/hardware/profile/version pins to a Linux benchmark and escape-test spike |

The exact supporting analysis and draft acceptance wording remain in
`docs/adr/evidence/ADR-0005-EVIDENCE.md` §15.

## 6. Post-decision sequence — steps 1–2 done, steps 3–6 still gated

1. ~~Record exact Founder answer and independently review this packet.~~ **Done 2026-07-26.**
2. ~~Prepare two docs-only ADR status-flip applications with evidence links; do not combine them
   with product code.~~ **Done and applied 2026-07-26** (§9). Steps 3–6 below are **not** authorized
   by that acceptance; each needs its own separate gate.
3. Authorize the Cyber AI pure controller/port foundation separately:
   `orchestration/{types,ports,state_machine,effects,outbox,errors}.py` plus focused tests; no
   database/broker.
4. Run the ADR-0003 comparison spike separately before any fallback adoption.
5. Run Linux-only ADR-0005 benchmark/escape spikes separately; do not install substrate components
   on the normal product writer path.
6. Only after those proofs authorize real persistence/outbox and sandbox-driver slices.

## 7. Boundaries retained

- The recorded acceptance is a decision only. No further status flip follows from a recommendation,
  green test or agent consensus.
- No DBOS, Temporal, Prefect, gVisor, Firecracker or Kata dependency is adopted by this packet.
- A microVM does not move credentials, policy or receipt-signing authority into an executor.
- Tool Fabric W2-F inference delegation is not Fabric tool execution authority.
- Exact runtime/transport, receipt envelope, issuer, broker and product-path decisions retain their
  own gates.
- No merge, push, deployment, credential, release or release-date authority is granted.

## 8. Exact recorded decision shorthand

```text
Duyệt GATE A4 Option A: ADR-0003 H1..H11=yes; ADR-0005 J1..J10=yes; ADR-0003 và ADR-0005 chuyển sang `ACCEPTED` (docs-only status flip đã áp dụng); không mở implementation, không install dependency, không chạy spike/benchmark/DB/container/broker, không stage/commit/merge/push, không deploy hoặc release.
```

That answer was recorded on 2026-07-26. GATE A4 is closed and both ADRs are `ACCEPTED` as decision
records only.

## 9. Applied status-flip applications

**Authority basis.** GATE A4 Option A was recorded with `H1..H11=yes` and `J1..J10=yes` under
**Founder-delegated current-thread authority**, scoped to this thread and to the twelve paths
listed in `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.6. That authority covers the ADR
status flip and its documentation record and nothing else. Dependency/substrate selection or
installation, spike/benchmark execution, DB/container/microVM/netns/broker start, product/runtime
writers, staging, commit, merge, push, deployment, integration, release and release-date authority
each remain with the Founder and are each separately gated.

Under that delegated authority, and under no wider authority, the two separate docs-only
evidence-linked status-flip applications have been applied:

| Application | Path | Status |
|---|---|---|
| ADR-0003 durable agent orchestration | `docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md` | `APPLIED 2026-07-26` |
| ADR-0005 sandbox substrate | `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` | `APPLIED 2026-07-26` |

Each application records the ADR status flip only. Neither adopts/installs a dependency or
substrate, runs a spike or benchmark, starts a database, container, microVM, netns or broker, opens
a product/runtime writer, or grants staging, commit, merge, push, integration, deployment, release
or release-date authority.

**CI: NOT WIRED** for either application. No orchestration, persistence, restart-survival,
isolation-benchmark or escape-test job is registered in any pipeline, and no CI result is claimed.
Both applications record static/documentary evidence only.

## 10. S4 pooling — evidence conflict closed 2026-07-26

**Governing rule, unchanged.** The §5 `J2` row above is the governing wording: hardened rootless
OCI is the substrate **floor** for S0 and no-file S4, but only policy-approved S0/R0 metadata
workers may be pooled, while S4 remains per-invocation disposable under accepted ADR-0004 F3.
S4 is an R3 class, so **S4 may never be pooled** — under any policy, in any tier, in any
environment. Substrate floor and executor lifecycle are separate questions; sharing a floor does
not share a lifecycle. This rule binds every future document, benchmark, spike plan and acceptance
text and is not reopened by the closure recorded below.

**History.** `docs/adr/evidence/ADR-0005-EVIDENCE.md` previously carried earlier read-ahead wording
that treated S4 as poolable — its §5 matrix `S4` row, §7.1 recommendation item 2, §8
rejected-alternatives note, §12 spike plan and §15 J2/draft acceptance text — contradicting accepted
ADR-0004 F3, under which disposable per-invocation isolation is mandatory for R1/R2/R3 and pooled
long-lived S0 workers are permitted for R0 read-metadata capabilities only when policy permits.

**Closure.** That wording was repaired on disk on 2026-07-26 under a separate bounded evidence-file
authority. The evidence file now carries the correction in its header note, §2.2, §3
neighbouring-ADR table, §5 matrix (`S0` and `S4` rows), §7.1 item 2, §8 rejected alternatives, §12
spike plan, §14 (new risk row SR-11) and §15.1 `J2`/§15.2 draft acceptance text, and it now matches
the governing wording above. The correction changed **executor-lifecycle wording only**: no
recommended isolation floor, ADR status, dependency or substrate choice, gate disposition or release
date moved — *and at the moment that D02-lane evidence-file correction was applied, GATE A4 had not
yet been answered, so the file was correct to read `NOT OPEN` at that point.* That is the historical
state at the correction, not a current claim: **GATE A4 closed later the same day, 2026-07-26, and
that closure — `ACCEPTED — GATE A4 CLOSED 2026-07-26`, ADR-0003 and ADR-0005 `ACCEPTED` as decisions
only — is authoritative**, as recorded in the status block of this packet and in
`docs/adr/README.md`. `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` §4 records the same resolution
in full. This is no longer a residual gate. The 2026-07-26 GATE A4 closure did not reopen it:
accepting `J2` accepted the governing wording above verbatim, so pooled S4 stays foreclosed by
accepted ADR-0004 F3.

## 11. ADR sprint header — repaired 2026-07-26

`docs/adr/ADR-DECISION-SPRINT-2026-07.md` previously stated in its progress block that Wave 2
read-ahead evidence was drafted and that **no Wave 2 decision packet/status flip exists**. This
packet contradicted the first half of that sentence: a Wave 2 decision packet does exist.

That header was repaired on disk on 2026-07-26 under a separate bounded authority, which recorded
this packet as existing and awaiting an answer. It was updated again later the same day, under the
twelve-path authority recorded in `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.6, once GATE A4
was answered. Its progress block now records **GATE A4 CLOSED 2026-07-26** with ADR-0003 and
ADR-0005 `ACCEPTED` (decision only; no implementation authority), and its §3 wave-board Wave 2 gate
column now reads "GATE A4 — **CLOSED 2026-07-26**: Option A accepted under Founder-delegated
current-thread authority; both ADRs `ACCEPTED` (decision only)". This is no longer a residual gate.

## 12. Open residual gate — outside-allowlist reconciliation

The 2026-07-26 status flip was applied inside the exact twelve-path allowlist recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.6. Documents **outside** that allowlist were not
edited and still describe the pre-closure posture. This is recorded here as an **open residual
reconciliation gate**, not as a contradiction of the decision above:

| Stale document (outside the allowlist) | Stale wording still on disk |
|---|---|
| `docs/README.md` | **reconciled 2026-07-26** under board §14.8; the `adr/` row now records the GATE A4 closure as decision-only. No residual |
| `docs/adr/evidence/ADR-0003-EVIDENCE.md` | header, §6 and §12 still say GATE A4 is not open and ADR-0003 stays `PROPOSED — NOT DECIDED` |
| `docs/adr/evidence/ADR-0005-EVIDENCE.md` | **narrowed 2026-07-26** under board §14.9: the dated correction note in the header is scoped historically and points at the authoritative status. The rest of the body — the `Status`/`Wave / gate` lines, §7, §15 and §17 — still says GATE A4 is not open and ADR-0003/ADR-0005 stay `PROPOSED — NOT DECIDED` |
| `docs/operations/OVERNIGHT-HANDOFF-2026-07-24.md` | §3.2, §4 and §5 still say GATE A4 is not open and that a Wave 2 decision packet is still owed |
| `docs/adr/FOUNDER-DECISION-PACKET-WAVE-1.md` | its closing note still says GATE A4 remains not open until its Wave 2 decision packet is prepared |

Reconciling the remaining files requires its own bounded authority with its own write allowlist.
Until that happens, **this packet, the two applied applications, the two ADR files, the ADR catalog,
the ADR sprint, the W1 board and the E2 register are authoritative** on GATE A4 disposition, and the
files above are stale history. The Wave 2 evidence packets under `docs/adr/evidence/` are dated
`DRAFT` read-ahead research that informed this gate; they never carried authority over its
disposition, before or after closure. Nothing in that reconciliation may change a decision, a gate disposition,
a date or a release claim.

## 13. Standing posture unchanged

`W0 COMPLETE=0` and W0 closure `NO-GO`. W1 runtime writers remain `HOLD`/`NO-GO`. Delegated routine
integration and external release remain `NO-GO`. The 2026-12-21 → 2026-12-31 release window is
unchanged and no release claim is made. The GATE A4 acceptance moved none of these.
