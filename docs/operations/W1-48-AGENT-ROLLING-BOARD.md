# W1 early-entry transition and fixed 48-agent rolling board

- **Prepared:** 2026-07-26
- **Coordination decision:** `W1 READ-AHEAD/PACKET PREPARATION GO`
- **Product-writer decision:** `FAB-C0 BOUNDED HARDENING WRITER GO`; W1 runtime writers remain
  `NO-GO`
- **Integration decision:** `NO-GO FOR DELEGATED ROUTINE INTEGRATION`
- **W0 closure:** `NO-GO`; `COMPLETE=0`
- **Release impact:** none. W0–W6 dates and the 2026-12-21 → 2026-12-31 release window remain
  unchanged.

This board applies the standing direction to keep the fixed roster of 48 agent identities moving
and to pull later-wave work forward when evidence is ready. It does not invent a task 49, claim
that 48 processes run simultaneously, accept a contract/ADR, or grant commit, merge, push,
deployment, database, credential or release authority.

## 1. Transition decision

W1 read-ahead starts now while W0 remains open. This is not an early release-date change:

- the roadmap defines waves as outcome themes rather than blocking phases and permits later-wave
  work to enter early when its contracts/evidence are ready;
- W1 still begins formally on 2026-08-01 and ends on 2026-08-23;
- the Week-1 target remains a real shadow walking skeleton:
  SOC scoped alert context → Cyber AI job/checkpoint/cancel → Fabric R0
  `get_alert_context` with delegation/receipt → schema-valid bundle returned to SOC;
- W0-T10 proves offline contract/simulated-consumer conformance only and is not evidence of that
  live walking skeleton.

Therefore:

| Gate | Disposition | Meaning |
|---|---|---|
| W1-E0 — read-ahead, threat/eval design and proposal packets | `GO` | May inspect and draft without lifecycle/status promotion |
| W1-C1 — alert-context capability-specific contract proposal | `ACCEPTED — CLOSED 2026-07-26` | `ACCEPTED FOR IMPLEMENTATION v0.1.0` as the local commit `3a2c715...` only; not pushed, not merged, no endpoint/registry/product/runtime authority |
| W1-C2 — investigation lifecycle/create/status/cancel/bundle-read contract proposal | `ACCEPTED — CLOSED 2026-07-26` | `ACCEPTED FOR IMPLEMENTATION v0.1.0` as the local commit `ed95e51...` only; Cyber AI producer / SOC consumer ownership preserved; Bundle v0.1.1 adoption, v0.1.0 supersession and consumer migration each still separately gated |
| GATE A4 — ADR-0003/ADR-0005 evidence and decision packet | `ACCEPTED — CLOSED 2026-07-26` | ADR-0003 and ADR-0005 `ACCEPTED` as decisions only; no implementation, dependency or substrate selection follows |
| W1 product implementation | `HOLD` | Requires exact repo/base/path/acceptance/test/commit authority |
| W1 integration/live shadow | `HOLD` | Requires accepted contracts, product revisions and explicit integration authority |
| Routine delegated integration | `NO-GO` | Hosted enforcement and Founder delegation remain absent |
| External release | `NO-GO` | Release-register RB-001 responsible-disclosure blocker remains open |

The contract packet's historical approval-ingress forward gap also uses the string `RB-001`.
Always label it `RB-001(contract-forward-gap)` and label the release blocker
`RB-001(release-disclosure)`; they are different concerns.

### 1.1 Exact-root audit snapshot

| Repository | Exact audited state | W1/W2 implication |
|---|---|---|
| Suite | canonical `55e94c2...`, dirty; W0 applications exist only in isolated local commits | Never use the dirty canonical root as a writer base |
| SOC | canonical `1b6671c...`, 23 modified + 1 untracked; I03 clean at `5ba200f...` | No scoped alert-context, `shadow_remote`, Investigation API or live bundle path |
| Cyber AI | canonical `281b252...`, 21 modified + 2 untracked; exact clean T10 worktree available | Committed branch has 5 warning-as-error failures and a P1 missing real redaction call; W1 job/runtime absent |
| Fabric | canonical `3292a65...`, 17 modified + 81 untracked plus nested markers; clean application commit `6f72616...` | Runtime surface is still health/version only; use `6f72616...` for bounded follow-on |

SOC PostgreSQL evidence is revision-scoped: GitHub run `30155207123` proves 20 real-PG
org-hierarchy cases at `6fe0c46...` using PostgreSQL 16, `cybrik_app NOBYPASSRLS` and migration
upgrade→downgrade→upgrade (`2728 passed`, zero skips). Current `1b6671c...` adds six `/org/me`
real-PG cases and 28 intentionally RED UI specs but has no equivalent current-HEAD CI; `e2e-org`
remains disabled. Do not repeat the stale claim that A4c has no real-PG evidence, and do not
overclaim that current HEAD/UI is certified.

Fabric W2-F conformance is also scope-bound: W2-F service delegation is for the SOC→Cyber AI
inference seam and is disjoint from Tool-Fabric tool-grant/MCP execution authority.

## 2. Capacity and ownership

- Logical roster: exactly 48 immutable task identities from the W0 board.
- Runtime capacity: at most seven live slots including the coordinator.
- Writer cap: at most four; normal waves use at most three so an independent reviewer remains
  available.
- Current transition wave: E1 read-only audits completed; exact two-path Fabric hardening
  (`FAB-C0`, base `6f72616...`) is evidence-ready but uncommitted; W0-I01/T01 and W0-I02/R05 were
  accepted on 2026-07-26 as `ACCEPTED FOR IMPLEMENTATION v0.1.0` and now exist as two path-limited
  local commits — 16 paths at `3a2c715...` and 32 paths at `ed95e51...`, both parented on
  `3ef8e05...`. Neither branch is pushed or merged.
- Every future writer requires one repo, explicit base SHA, isolated worktree, exact allowlist,
  collision map, RED/acceptance command and named reviewer.
- A completed/stale session never creates a replacement identity. A retry keeps the same task ID.

## 3. Implementer assignments — 12

| Immutable task ID | W1 assignment | Owner | Admission |
|---|---|---|---|
| W0-I01 | Alert-context capability-specific schemas, descriptor fixture and compatibility proposal | Suite contracts | `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`; 16-path packet at `3a2c715...`; no push, merge, endpoint, registry, product or runtime authority |
| W0-I02 | Investigation create/status/checkpoint/cancel/bundle-read wire proposal | Suite contracts | `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`; 32-path packet at `ed95e51...`; no push, merge, server, transport, product or runtime authority |
| W0-I03 | Scoped SOC alert-context read API and authorization seam | SOC Alert | `HOLD` on W0-I01 acceptance and exact product authority |
| W0-I04 | SOC `shadow_remote` client/flag, correlation and rollback-compatible embedded path | SOC Copilot | `HOLD` on W0-I02 and transport acceptance |
| W0-I05 | Pure Cyber AI job/checkpoint/cancel state-machine and ports | Cyber AI orchestration | `HOLD` on ADR-0003/explicit bounded authority |
| W0-I06 | Cyber AI investigation producer and W2-D/W2-F relying-party composition | Cyber AI API/worker | `HOLD` on lifecycle/transport contracts and runtime trust gates |
| W0-I07 | Fabric R0 registry/invocation for `soc.get_alert_context` | Fabric control plane | `HOLD` on W0-I01 and product runtime authority |
| W0-I08 | Fabric receipt/idempotency/kill-switch domain and storage ports | Fabric control plane | `HOLD` on receipt-envelope/runtime decisions |
| W0-I09 | SOC Investigation Bundle viewer and human accept/edit/reject seam | SOC portal | `HOLD` on accepted read API and service-seeded fixture |
| W0-I10 | Durable Cyber AI persistence/outbox/relay | Cyber AI worker/store | `HOLD` on ADR-0003 and real-store authority |
| W0-I11 | Provenance containment on `6f72616...`, then publisher capability-pack SDK/conformance | Fabric contract/registry SDK | `FAB-C0 EVIDENCE READY — UNCOMMITTED` on exact two-path allowlist; atomic loader proof and SDK remain held |
| W0-I12 | Per-product CI/SBOM/release-verification packets | Each product locally | `PREPARATION GO`; no release manifest |

## 4. Test/eval/fuzz assignments — 12

| Immutable task ID | W1 assignment | Admission |
|---|---|---|
| W0-T01 | Standalone validators and semantic negatives for W1-C1/W1-C2 | Both packets `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`; validators/tests stay `CI: NOT WIRED`; no push, merge or runtime authority |
| W0-T02 | SOC alert-context tenant/org/clearance/marking/no-existence-leak RED suite | `READ-ONLY DESIGN`; execute after accepted route shape |
| W0-T03 | SOC `shadow_remote` failback, no-side-effect and audit-correlation properties | `READ-ONLY DESIGN` |
| W0-T04 | Cyber AI transition graph, retry/cancel/checkpoint/outbox properties | `READ-ONLY DESIGN`; no durability claim |
| W0-T05 | Deterministic stub plus Ollama/vLLM/llama.cpp port compatibility matrix | `READ-ONLY/EXISTING TEST REPLAY` |
| W0-T06 | Claim/evidence/citation/abstention golden and adversarial evaluation | `READ-ONLY DESIGN` |
| W0-T07 | Fabric capability/registry/package conformance and digest replay | `READ-ONLY/EXISTING TEST REPLAY` |
| W0-T08 | Fabric tool-grant, mTLS/PoP, replay, tenant/org/marking negatives | `READ-ONLY DESIGN`; W2-F inference token is explicitly not Fabric execution authority |
| W0-T09 | Receipt/approval/idempotency/kill-switch fail-closed negatives | `READ-ONLY DESIGN`; runtime absent |
| W0-T10 | Real four-repo shadow vertical harness | `HOLD`; offline W0-T10 is not a substitute |
| W0-T11 | Walking-skeleton latency/resource baseline with exact environment tuple | `HOLD` until real vertical exists |
| W0-T12 | Locked/offline install, SBOM and supply-chain verification | `READ-ONLY GAP AUDIT`; remediation separately gated |

## 5. Independent review assignments — 6

| Immutable task ID | W1 assignment | Admission |
|---|---|---|
| W0-R01 | Cross-product W1 contract/ownership architecture review | `ACTIVE READ-ONLY` |
| W0-R02 | SOC authz/runtime/PostgreSQL and UI-E2E evidence review | `ACTIVE READ-ONLY` |
| W0-R03 | Cyber AI state/model/runtime correctness review | `ACTIVE READ-ONLY` |
| W0-R04 | Fabric control-plane/executor/trust-boundary review | `ACTIVE READ-ONLY` |
| W0-R05 | OpenAPI/AsyncAPI/schema compatibility and supersession review | `ACTIVE READ-ONLY` |
| W0-R06 | Claim-to-evidence and lifecycle wording review | `ACTIVE READ-ONLY` for review; the tool-side gate it held in §14.8.4 was repaired and **closed 2026-07-26** under the bounded write authority recorded in §14.9 (validator `PASS`, `tests 77 · pass 77 · fail 0`, manual only, **CI: NOT WIRED**); the wording residual in §14.8.3 stays open |

No reviewer may approve its own authored proposal or implementation.

## 6. Security/red-team assignments — 5

| Immutable task ID | W1 assignment | Admission |
|---|---|---|
| W0-S01 | SOC→AI→Fabric confused-deputy, tenant/org and marking attack tree | `ACTIVE READ-ONLY` |
| W0-S02 | Model prompt/injection/SSRF/exfiltration and telemetry immutability | `ACTIVE READ-ONLY` |
| W0-S03 | Fabric delegation/approval/receipt/kill-switch trust-boundary abuse | `ACTIVE READ-ONLY` |
| W0-S04 | Four-repo lock/SBOM/action pin/offline-install supply-chain audit | `ACTIVE READ-ONLY` |
| W0-S05 | Full shadow vertical adversarial plan and stop conditions | `ACTIVE READ-ONLY`; execution held |

## 7. Research/benchmark assignments — 5

| Immutable task ID | W1 assignment | Admission |
|---|---|---|
| W0-B01 | AiSOC pinned comparator and same-tier execution protocol | `ACTIVE READ-ONLY`; no superiority claim |
| W0-B02 | Qwen/vLLM/llama.cpp runtime/profile benchmark design | `ACTIVE READ-ONLY`; no vendor selection |
| W0-B03 | PostgreSQL/pgvector and graph-as-tables measurement plan | `ACTIVE READ-ONLY` |
| W0-B04 | ADR-0003 durability substrate evidence and Gate A4 decision packet | `DECISION READY`; no decision/status flip |
| W0-B05 | ADR-0005 isolation mapping plus issuer/transport/receipt-envelope/attestation spike design | `DECISION READY` for ADR-0005; measured runtime choices still deferred |

## 8. Integration/release assignments — 4

| Immutable task ID | W1 assignment | Admission |
|---|---|---|
| W0-IR01 | Re-audit enforceable hosted branch protection/review/check gates | `ACTIVE READ-ONLY`; routine integration stays `NO-GO` |
| W0-IR02 | Exact per-repo W1 commands, runtime prerequisites and evidence routing | `ACTIVE READ-ONLY` |
| W0-IR03 | Current base SHA, dirty-path collision, isolated-worktree and merge-queue map | `ACTIVE READ-ONLY` |
| W0-IR04 | W1 admission/completion audit against the real walking-skeleton outcome | `ACTIVE READ-ONLY`; cannot pass from offline T10 |

## 9. Documentation/claims/operations assignments — 4

| Immutable task ID | W1 assignment | Admission |
|---|---|---|
| W0-D01 | W1 architecture/contract/product documentation ownership map | `ACTIVE READ-ONLY` |
| W0-D02 | W1 claim-to-evidence ledger and live-vs-offline wording guard | `PREPARATION GO` |
| W0-D03 | Rolling-wave handoff/account/model-independent operations | `ACTIVE`; no credential handling |
| W0-D04 | W1 decision queue, Vietnamese/English terminology and Founder packet | `PREPARATION GO`; no lifecycle promotion |

## 10. First rolling dispatch

### Wave E1 — current, zero product writers

1. Suite roadmap/release/contract transition audit.
2. SOC exact-HEAD, W2-J PostgreSQL/UI-E2E and W1 surface audit.
3. Cyber AI exact-HEAD, model-runtime/state/durability audit.
4. Fabric exact-HEAD, registry/invocation/receipt gap audit.
5. Coordinator reconciles all evidence and current dirty roots.

### Wave E2 — closed 2026-07-26, decisions recorded

E2 ran with at most three isolated writers after E1 review and a fresh collision map. Its three
items are now decided:

1. W0-D04/B04: the Gate A4 evidence/decision packet for ADR-0003 and ADR-0005 was answered on
   2026-07-26; both ADRs are `ACCEPTED` as decisions only, applied through two docs-only
   status-flip applications.
2. W0-I01/T01: the alert-context capability packet and its standalone RED/validator suite are
   `ACCEPTED FOR IMPLEMENTATION v0.1.0` as the 16-path local commit `3a2c715...`.
3. W0-I02/R05: the investigation lifecycle/transport packet is `ACCEPTED FOR IMPLEMENTATION
   v0.1.0` as the 32-path local commit `ed95e51...`, preserving W2-D as the sole existing
   inference-path owner.

Independent R01/R05/S01 review was completed before each decision; the two final reviews are
cross-lane (`W0-R05` for W1-C1, `W0-T01` for W1-C2). The two accepted packets exist only as local
commits: nothing was pushed, merged or released, and no product or runtime writer was opened.

### Wave E3 — exact product decision bundle

Only after E2 evidence:

1. present exact contract lifecycle questions and exact product path allowlists;
2. request any required Founder decision/status-flip/commit authority;
3. dispatch at most three product writers: SOC context, Cyber AI job foundation and Fabric R0;
4. reserve reviewer capacity and keep the live vertical harness read-only until all inputs are
   exact committed revisions.

## 11. Exit criteria

### W1 early-entry preparation complete

- E1 audits reconciled against exact current roots;
- Gate A4 and both W1 contract packets are decided: Gate A4 closed 2026-07-26 (decisions only) and
  both contract packets `ACCEPTED FOR IMPLEMENTATION v0.1.0` as local commits only, with negative
  fixtures and owner maps intact;
- all 48 task identities have a current assignment and no task 49 exists;
- no product, lifecycle, release or integration claim exceeds evidence.

### W1 Investigation Spine outcome complete

The board may not declare this until exact revisions prove:

- real SOC scoped alert context with tenant/org/marking authorization;
- real Cyber AI create/status/checkpoint/cancel path with durable evidence appropriate to its
  accepted substrate;
- real Fabric R0 invocation with delegation, idempotency, receipt and kill switch;
- correlated SOC→AI→Fabric→SOC shadow run returning a schema-valid bundle;
- degraded/failback path, no side effect, security negatives and audit/eval evidence;
- product-local CI and independent review green.

Offline schema validation, mock-only orchestration, a no-DB suite or the W0-T10 PASS alone cannot
satisfy these exit criteria.

## 12. Next-wave rule

When W1 Investigation Spine is evidence-complete, the same 48 immutable identities are reassigned
to W2 Evidence Intelligence. No new task identity is created. W2 may read ahead earlier, but its
RAG/CTI/Graph/workspace implementation still requires accepted contracts, ADR decisions and exact
product authority. The coordinator repeats E1 audit → E2 proposal → E3 decision → bounded writers
→ independent review → exact completion audit for every later wave through W6.

## 13. Machine validation

Run from the `cybrik-suite` root:

```bash
node tools/operations/validate-w1-control.mjs
node --test --experimental-test-coverage \
  tools/operations/tests/validate-w1-control.test.mjs
```

Both commands are run manually. **CI: NOT WIRED** — neither command is registered in any pipeline,
and no CI result is claimed anywhere on this board.

The validator fails closed on roster drift from the exact 48 IDs, a task 49, W0 closure promotion,
W1 runtime-writer promotion, offline-T10/live-vertical conflation, formal W1 date drift, release
window drift, GATE A4 status/recommendation drift, incomplete H1–H11/J1–J10 decisions, or conflated
`RB-001(contract-forward-gap)` and `RB-001(release-disclosure)` labels. It also rejects reverting an
applied ADR status flip, pooled S4 execution, or carrying the already-resolved ADR-0002 dependency
as an open H11 deferral.

The **required** post-§14.7 pin set — what the validator fails closed on — is reversion of the
recorded W1-C1/C2 contract acceptance: loss of the
accepted local commits `3a2c715…`/`ed95e51…`, of their shared parent `3ef8e05…`, of the exact
16-/32-path counts, of the final digests `e4cfbf8c…`/`0fcac6ede…`, of the `21/21` and `31/31` test
counts, of the `87.27%`/`97.44%` branch-coverage figures, of the standalone validator `PASS`
results, of the cross-lane `W0-R05 PASS`/`W0-T01 PASS` reviews, or of the W0-R01 Option B
LOW-advisory rider. Reintroducing any superseded candidate pin (`ce9921d3…`, `cd872a0e…`, `90.39%`
line coverage, `87.87%` branch coverage, `18/18` tests, `f79702c6…`, `16099c17…`, `10/10` or `29/29`
tests, `86.67%` line coverage, `97.39%` branch coverage) into a **live** evidence row must also fail
closed, while the same values stay readable inside dated history sections. The `CI: NOT WIRED`,
static/documentary-only, `W0 COMPLETE=0`, W0 `NO-GO` and W1 `HOLD` posture lines, the
`APPLIED 2026-07-26` application rows, and the Bundle v0.1.1 proposed-successor / v0.1.0
authoritative guard must all stay pinned.

The validator and its test suite live in `tools/operations/`, which is outside the docs-only
allowlists of §14.1–§14.8. §14.9 records the separate bounded write authority under which the
tool-side gate was finished. The pin set above describes required behaviour; §13.1 records the
measured state of the on-disk implementation, which now carries the post-acceptance pins.

### 13.1 Measured validator state — GREEN, 2026-07-26

Measured from this worktree on 2026-07-26 after the §14.9 repair. Both commands are run **manually**
and are **static/documentary only**.

| Command | Measured result |
|---|---|
| `node tools/operations/validate-w1-control.mjs` | **PASS** — `tasks=48`, `categories={"I":12,"T":12,"R":6,"S":5,"B":5,"IR":4,"D":4}`, `GATE_A4={"H":11,"J":10}`, `CONTRACT_GATE={"C1":10,"C2":10}` |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0` |
| `node --test --experimental-test-coverage tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0`; `validate-w1-control.mjs` line 98.31% · branch 92.93% · funcs 97.87% |

The roadmap release-window guard is anchored on the roadmap heading
`### Release — 2026-12-21 → 2026-12-31`, which is present in the committed `HEAD` bytes of
`docs/strategy/06-ROADMAP-2026-2029.md` as well as in the working copy. The validator was
re-run with the roadmap supplied from `git show HEAD:docs/strategy/06-ROADMAP-2026-2029.md`
instead of the dirty working copy and still returned `PASS` with `tasks=48`; the roadmap file
itself was not edited and remains outside every allowlist in §14.

**CI: NOT WIRED** — neither command is registered in any pipeline and no CI result is claimed
anywhere on this board. A green validator is a documentary consistency check over control
documents; it is **not** product evidence, and it promotes nothing: `W0 COMPLETE=0`, W0 closure
`NO-GO`, W1 product implementation and integration/live shadow `HOLD`, W1 runtime writers,
delegated routine integration and external release `NO-GO`.

**Superseded history — earlier measurement, 2026-07-26.** Before the tool-side pins were landed,
the same two commands returned `FAIL` (`W1 board W1-C1 final-evidence row must pin the final
member-set digest`, `validateBoardFinalEvidence`) and `tests 77 · pass 9 · fail 68`, because the
on-disk validator was still pinned to the **pre-acceptance** §14.4 values —
`W1_C1_DIGEST = cd872a0e…`, `W1_C2_DIGEST = 16099c17…`, candidate rows ending
`PROPOSED — NOT ACCEPTED`, register anchors requiring `DECISION READY — PROPOSED ONLY`. All 68
failures were one defect routed through a single assertion. That state was assigned to **W0-R06**;
the accepted pins were subsequently landed in `tools/operations/`, the residual release-window
anchor defect was repaired under §14.9, and the gate is closed. No document was ever edited to
satisfy the stale tool. The earlier `37/37`, `52/52` and `61/61` counts are likewise superseded
history, as are the `RED 9/77` claims that stood in this section, in
`docs/operations/W1-E2-EVIDENCE-REGISTER.md` §1/§3/§4.3, in §14.8.4 below and in
`docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` gate 8 until 2026-07-26.

## 14. W1-48 gate-repair record — docs-only, no status flip

Recorded under **Founder-delegated current-thread authority** scoped to **application preparation
and documentation only**. Nothing in this section accepts a packet, flips an ADR or contract
status, or promotes any gate in §1.

### 14.1 Exact write allowlist — eight docs-only paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md` | application |
| 2 | `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` | application |
| 3 | `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` | application |
| 4 | `docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` | application |
| 5 | `docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` | decision packet |
| 6 | `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` | decision packet |
| 7 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |
| 8 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |

No other path is added, edited, staged, committed, merged, pushed or deleted. `docs/strategy/` and
`tools/operations/` are explicitly **outside** this allowlist, so every pinned-row correction that
would require editing `tools/operations/validate-w1-control.mjs` was deferred out of that task and
carried out later under the separate bounded authority recorded in §14.4.

### 14.2 Pre-acceptance candidate evidence — dated history, superseded by §14.7.2

**As recorded on 2026-07-26 before the contract acceptance**, and retained here as provenance
only. The current accepted evidence is in §14.7.2; every value in this table is superseded.

| Lane (pre-acceptance) | Digest re-verified from the then-current candidate bytes | Static verification at that date | Final independent review |
|---|---|---|---|
| W1-C1 alert-context lane — pre-acceptance | `cd872a0e8d25c8de6224bf5f9aecaeba795836cee77355d416690ee47524502c` | 16 new paths; standalone validator `PASS`; 18/18 adversarial tests; 87.87% branch coverage against the declared 80% branch floor | **R05 `PASS`**, no open P0–P2 |
| W1-C2 investigation-lifecycle lane — pre-acceptance | `16099c17f01e7410e87860f5d9ce084a7fa8e2cad0a3e59b90a1ccb66643dd6f` | 32 new paths; standalone validator `PASS`; 29/29 tests; Ajv strict eight clean compilations; 97.39% branch coverage | **T01 `PASS`**, no open P0–P3 |

Both reviews are cross-lane; no reviewer approved its own authored proposal. At the date of this
record the four applications stood at `APPLICATION READY ONLY` and both packets at
`PROPOSED — NOT ACCEPTED`. That is the state of the record on 2026-07-26 **before** the GATE A4 and
W1-C1/C2 decisions; it is not current status. See §14.6, §14.7 and §14.7.2.

### 14.3 Posture unchanged by this record

- **CI: NOT WIRED**; all evidence is static/documentary only and no CI result is claimed.
- `W0 COMPLETE=0`; W0 closure `NO-GO`.
- W1 product implementation and W1 integration/live shadow remain `HOLD`; W1 runtime writers remain
  `NO-GO`; delegated routine integration and external release remain `NO-GO`.
- W1 formal dates 2026-08-01 → 2026-08-23 and the 2026-12-21 → 2026-12-31 release window are
  unchanged; no date moves.

### 14.4 Pinned-row repair record — docs and validator only, no status flip

The pinned-row correction deferred by §14.1 was carried out as a separate bounded task under
**Founder-delegated current-thread authority** scoped to **documentation and validator bytes only**.

#### 14.4.1 Exact write allowlist — five paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` | decision packet |
| 2 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |
| 3 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 4 | `tools/operations/validate-w1-control.mjs` | validator |
| 5 | `tools/operations/tests/validate-w1-control.test.mjs` | validator test suite |

No other path was added, edited, staged, committed, merged, pushed or deleted. `docs/strategy/` and
both W1 acceptance applications stayed **outside** this allowlist.

#### 14.4.2 What the repair changed

- The stale W1-C1 aggregate `ce9921d3…` and `90.39%` line-coverage wording were replaced by the
  member-set digest `cd872a0e…` (13/13 member hashes match) and `87.87%` branch coverage against
  the declared 80% branch floor, with standalone validator `PASS`, 18/18 adversarial tests, 16
  paths and final cross-lane review `R05 PASS`.
- The stale W1-C2 aggregate `f79702c6…`, `10/10` test count and `86.67%` line-coverage wording were
  replaced by the aggregate `16099c17…` (30/30 member digests match), `29/29` tests and `97.39%`
  branch coverage, with standalone validator `PASS`, Ajv strict eight clean compilations, 32 paths
  and final cross-lane review `T01 PASS`.
- The matching validator pins and test suite were updated in the same change, and the validator now
  fails closed on reintroduction of any stale pin.

#### 14.4.3 What the repair did not change

Task identities, gate dispositions in §1, all W0–W6 dates, the 2026-12-21 → 2026-12-31 release
window, and every posture line in §14.3 are unchanged. Nothing was accepted, status-flipped,
staged, committed, installed, merged, pushed or deployed, and no network, database or container was
reached.

#### 14.4.4 Residual gate — closed by §14.5

The reconciliation wording in `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` §8/§10 and
`docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` §9/§11 described the pinned-row
correction as open. Those two files were outside the five-path allowlist, so that wording was
carried as a **separate residual gate**; their re-verified evidence already matched the repaired
pins, so the mismatch was descriptive only. That wording was reconciled on 2026-07-26 under the
seven-path documentation authority recorded in §14.5, which closed this residual gate.

### 14.5 Downstream documentation reconciliation record — docs-only, no status flip

Recorded under **Founder-delegated current-thread authority** scoped to **downstream documentation
reconciliation only**. This section accepts nothing, flips no ADR or contract status, opens no gate
in §1, and creates no task identity.

#### 14.5.1 Exact write allowlist — seven docs-only paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` | decision packet |
| 2 | `docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md` | application |
| 3 | `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` | application |
| 4 | `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` | application |
| 5 | `docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` | application |
| 6 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |
| 7 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |

This seven-path set is a strict subset of the §14.1 eight-path documentation allowlist; it drops
`docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md`, which was already reconciled by the §14.4 repair.
`docs/strategy/`, `docs/adr/ADR-DECISION-SPRINT-2026-07.md`, `docs/adr/evidence/` and
`tools/operations/` are explicitly **outside** this allowlist and were **not** edited by this
reconciliation. No path was added, staged, committed, merged, pushed or deleted.

**Allowlist history, in order.** §14.1 eight docs-only paths (application preparation) → §14.4.1
five paths, docs plus `tools/operations/` validator and its test suite (pinned-row repair) → §14.5.1
seven docs-only paths (this downstream reconciliation). Each set was bounded separately; none
widened an earlier one, and the earlier records above stand unedited as provenance.

#### 14.5.2 What this reconciliation changed

Stale residual wording only, after two upstream repairs that had already landed on disk:

- **ADR sprint header (B04 lane).** `docs/adr/ADR-DECISION-SPRINT-2026-07.md` had already been
  repaired on 2026-07-26 to record that the Wave 2 decision packet exists while GATE A4 stays
  `NOT OPEN` and no ADR status is flipped. Downstream claims that it "still states no Wave 2
  decision packet exists" and that it is "not edited here" were marked closed in
  `FOUNDER-DECISION-PACKET-WAVE-2.md` §11, `ADR-0003-STATUS-FLIP-APPLICATION.md` §6.7,
  `ADR-0005-STATUS-FLIP-APPLICATION.md` §8.7 and `W1-E2-EVIDENCE-REGISTER.md` §3.
- **ADR-0005 evidence S4-pooling wording (D02 lane).** `docs/adr/evidence/ADR-0005-EVIDENCE.md` had
  already been repaired on 2026-07-26 so that its header, §2.2, §3, §5, §7.1, §8, §12, §14 (new
  SR-11) and §15 match the governing GATE A4 J2 wording. Downstream claims that the file "remains
  stale on disk" and is "not edited" were rewritten as a closed historical issue in
  `FOUNDER-DECISION-PACKET-WAVE-2.md` §10, `ADR-0005-STATUS-FLIP-APPLICATION.md` §2/§4/§8.2 and
  `W1-E2-EVIDENCE-REGISTER.md` §3, **retaining the governing rule in full**: only policy-approved
  S0/R0 metadata workers may be pooled, and S4 — an R3 class — is never pooled under accepted
  ADR-0004 F3.
- **Pinned-row correction (§14.4).** The two W1 acceptance applications' §8/§10 and §9/§11
  reconciliation sections now record the correction as closed, with the final values
  (`cd872a0e…`, `87.87%` branch; `16099c17…`, `29/29`, `97.39%` branch) and the superseded values
  (`ce9921d3…`, `90.39%` line; `f79702c6…`, `10/10`, `86.67%` line) retained as history.
- **Register §1 GATE A4 row refresh.** The Wave-2 packet SHA-256 and the control-test-suite count
  in `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §1 were re-measured after these edits, with the
  superseded values kept inline as provenance.

#### 14.5.3 What this reconciliation did not change

Task identities, gate dispositions in §1, the §14.2 candidate evidence, all W0–W6 dates and
the 2026-12-21 → 2026-12-31 release window are unchanged. Every posture line in §14.3 still holds:
**CI: NOT WIRED**; all evidence static/documentary only; `W0 COMPLETE=0` and W0 closure `NO-GO`;
W1 product implementation and integration/live shadow `HOLD`; W1 runtime writers, delegated routine
integration and external release `NO-GO`.

**Lifecycle state as recorded at that reconciliation, 2026-07-26 — dated history, not current
status.** At that point GATE A4 was still `NOT OPEN`, ADR-0003 and ADR-0005 were still
`PROPOSED — NOT DECIDED`, the W1-C1 and W1-C2 packets were still `PROPOSED — NOT ACCEPTED`, and all
four applications were still `APPLICATION READY ONLY`. This reconciliation accepted nothing and
status-flipped nothing, and staged, committed, installed, merged, pushed and deployed nothing; no
network, database or container was reached. Those four lifecycle states were **superseded later the
same day** by the GATE A4 record in §14.6 and the contract-acceptance record in §14.7, which carry
the current status.

### 14.6 GATE A4 status-flip record — decision only, no implementation authority

Recorded under **Founder-delegated current-thread authority** on 2026-07-26. Option A was accepted
with `H1..H11=yes` and `J1..J10=yes`; ADR-0003 and ADR-0005 are `ACCEPTED` as **decisions only**,
applied through the two docs-only status-flip applications
(`docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md` and `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md`,
both `APPLIED 2026-07-26`).

#### 14.6.1 Exact write allowlist — twelve paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/adr/ADR-0003-durable-agent-orchestration.md` | ADR |
| 2 | `docs/adr/ADR-0005-sandbox-substrate.md` | ADR |
| 3 | `docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md` | application |
| 4 | `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` | application |
| 5 | `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` | decision packet |
| 6 | `docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` | decision packet |
| 7 | `docs/adr/ADR-DECISION-SPRINT-2026-07.md` | sprint plan |
| 8 | `docs/adr/README.md` | ADR catalog |
| 9 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |
| 10 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 11 | `tools/operations/validate-w1-control.mjs` | validator |
| 12 | `tools/operations/tests/validate-w1-control.test.mjs` | validator test suite |

`docs/strategy/`, `docs/README.md`, `README.md`, both Wave 2 evidence packets,
`docs/adr/FOUNDER-DECISION-PACKET-WAVE-1.md` and
`docs/operations/OVERNIGHT-HANDOFF-2026-07-24.md` were **outside** this twelve-path allowlist. The
documents among them that carried pre-closure GATE A4 wording were carried as a residual
reconciliation item and picked up afterwards under §14.7.

#### 14.6.2 What this record does and does not grant

- ADR-0003 and ADR-0005 move from `PROPOSED — NOT DECIDED` to `ACCEPTED` (GATE A4, 2026-07-26).
  That is a **decision record**; it is not implementation authority.
- No implementation, dependency, spike, benchmark, database, container, microVM, netns or
  broker authority follows from this record, and nothing was staged, committed, merged, pushed,
  deployed or released.
- The governing sandbox rule is unchanged: only policy-approved S0/R0 metadata workers may be
  pooled, and S4 — an R3 class — is never pooled under accepted ADR-0004 F3.
- Task identities, the §1 dispositions other than the GATE A4 row, all W0–W6 dates and the
  2026-12-21 → 2026-12-31 release window are unchanged.

### 14.7 W1-C1/C2 contract-acceptance current-state reconciliation

Recorded under **Founder-delegated current-thread authority** on 2026-07-26, scoped to the
**documentation and validator record of an already-taken decision**. Option A was accepted with
`C1-1..C1-10=yes` and `C2-1..C2-10=yes`; both packets are `ACCEPTED FOR IMPLEMENTATION v0.1.0` and
exist as two path-limited local commits on their own branches. This section records that state; it
did not take the decision and grants nothing beyond the record.

#### 14.7.1 Exact write allowlist — nineteen paths

| # | Path | Kind |
|---|---|---|
| 1 | `README.md` | repository index |
| 2 | `docs/README.md` | docs index |
| 3 | `docs/adr/README.md` | ADR catalog |
| 4 | `docs/adr/evidence/README.md` | evidence catalog |
| 5 | `docs/adr/ADR-DECISION-SPRINT-2026-07.md` | sprint plan |
| 6 | `docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` | decision packet |
| 7 | `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` | decision packet |
| 8 | `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` | application |
| 9 | `docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` | application |
| 10 | `docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md` | application |
| 11 | `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` | application |
| 12 | `docs/adr/ADR-0003-durable-agent-orchestration.md` | ADR |
| 13 | `docs/adr/ADR-0005-sandbox-substrate.md` | ADR |
| 14 | `docs/adr/evidence/ADR-0005-EVIDENCE.md` | evidence packet |
| 15 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |
| 16 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 17 | `docs/operations/OVERNIGHT-HANDOFF-2026-07-24.md` | handoff record |
| 18 | `tools/operations/validate-w1-control.mjs` | validator |
| 19 | `tools/operations/tests/validate-w1-control.test.mjs` | validator test suite |

`docs/strategy/` and every path under `contracts/` are explicitly **outside** this allowlist and
were not edited by this reconciliation; the accepted contract bytes are unchanged. This nineteen-path
set supersedes the earlier §14.1/§14.4.1/§14.5.1/§14.6.1 sets as the current documentation
authority; none of those earlier records is edited by it, and each stands as provenance.

**Allowlist history, in order.** §14.1 eight docs-only paths (application preparation) → §14.4.1
five paths, docs plus validator and its test suite (pinned-row repair) → §14.5.1 seven docs-only
paths (downstream reconciliation) → §14.6.1 twelve paths (GATE A4 status-flip record) → §14.7.1
nineteen paths (this contract-acceptance reconciliation).

#### 14.7.2 Accepted contract evidence — current, re-verified from the committed bytes

| Lane | Accepted local commit and parent | Final digest re-verified from the committed bytes | Static verification | Final independent review |
|---|---|---|---|---|
| W0-I01/T01 — W1-C1 alert context | `3a2c71555a423465855ffaddcb663c8b704dbfbd`, parent `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619` | `e4cfbf8c6f6ccfe545a91d63b0bee6de4c616a28e3f1a61c320f8fde747e1d35` (13/13 member hashes match) | exactly 16 paths; standalone validator `PASS`; 21/21 tests; 87.27% branch coverage against the declared 80% branch floor | **W0-R05 `PASS`**, no open P0–P2 |
| W0-I02/R05 — W1-C2 investigation lifecycle | `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`, parent `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619` | `0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e` (30/30 member digests match) | exactly 32 paths; standalone validator `PASS`; 31/31 tests; Ajv strict eight clean compilations, Spectral/AsyncAPI zero errors; 97.44% branch coverage | **W0-T01 `PASS`**, no open P0–P3 |

Both reviews are cross-lane; no reviewer approved its own authored proposal. The superseded
pre-acceptance values are retained in §14.2, in
`docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` §9 and in
`docs/operations/W1-E2-EVIDENCE-REGISTER.md` §4.

**Rider — W0-R01 Option B (Fable independent review).** The final cross-agent review raised one
non-blocking finding on the W1-C2 lane. Option B was recorded: the finding is disclosed as a **LOW
advisory** and changed **no accepted contract byte**, so both accepted commits carry exactly the
reviewed bytes. It is not a P0–P3 defect and it opens no gate.

#### 14.7.3 What this reconciliation changed, and what it did not

Changed: current-state lifecycle wording only. The four applications now read `APPLIED 2026-07-26`,
the two contract packets read `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`, ADR-0003
and ADR-0005 read `ACCEPTED` (GATE A4, 2026-07-26) — decision only, and every live evidence row is
re-pinned to the committed bytes of the two accepted commits. Dated pre-acceptance paragraphs are
kept verbatim as provenance.

Not changed and not granted:

- Nothing was staged, committed, merged, pushed, deployed or released by this reconciliation,
  and no dependency was installed and no database, container or network was reached.
- Neither accepted branch is pushed and neither is merged to `main`; publication, merge, release
  and release-date authority each remain separate Founder decisions.
- No product or runtime writer opened. SOC, Cyber AI and Fabric W1 writers remain `HOLD`; W1
  runtime writers, delegated routine integration and external release remain `NO-GO`.
- Bundle v0.1.1 remains a proposed successor candidate; v0.1.0 remains the authoritative Bundle
  contract with unchanged bytes; adoption, supersession and consumer migration are three separate
  future decisions.
- **CI: NOT WIRED.** Every figure above is static/documentary only from manual reproducible
  execution; no CI result is claimed.
- `W0 COMPLETE=0` and W0 closure `NO-GO`. The 48 immutable task identities, all W0–W6 dates, the
  formal W1 window 2026-08-01 → 2026-08-23 and the 2026-12-21 → 2026-12-31 release window are
  unchanged.

#### 14.7.4 Residual documentation gate — narrowed by §14.8, still open

`docs/operations/OVERNIGHT-HANDOFF-2026-07-24.md` (path 17) and the two Wave 2 evidence packets
still carry pre-closure GATE A4 wording on disk. `docs/adr/evidence/ADR-0005-EVIDENCE.md` (path 14)
was repaired for the S4-pooling rule but its header still reads `GATE A4 remains NOT OPEN`, and
`docs/adr/evidence/ADR-0003-EVIDENCE.md` is outside this allowlist entirely. This is a **wording**
residual only: the authoritative status is carried by `docs/adr/README.md`,
`docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` and the two ADR files.

The §14.8 reconciliation closed the index half of this gate — the root `README.md`,
`docs/README.md`, `docs/adr/README.md`, `docs/adr/evidence/README.md` and
`docs/operations/README.md` now match the accepted status and label every remaining stale file.
The gate stays **open** for the evidence packets, the handoff record,
`docs/adr/FOUNDER-DECISION-PACKET-WAVE-1.md` and `contracts/README.md`; see §14.8.3.

### 14.8 W0-D03 index and current-state reconciliation — docs-only, no status flip

Recorded under **Founder-delegated current-thread authority** on 2026-07-26, scoped to
**documentation only**. This section accepts nothing, flips no ADR or contract status, promotes no
gate in §1, and creates no task identity. It ran as a single logical task with **one** bounded
600-second extension under §15 — the extension was granted on evidenced progress in the W1-C2
application and this board, and no second extension was requested.

#### 14.8.1 Exact write allowlist — nine docs-only paths

| # | Path | Kind |
|---|---|---|
| 1 | `README.md` | repository index |
| 2 | `docs/README.md` | docs index |
| 3 | `docs/adr/README.md` | ADR catalog |
| 4 | `docs/adr/evidence/README.md` | evidence catalog |
| 5 | `docs/operations/README.md` | operations catalog |
| 6 | `docs/adr/ADR-DECISION-SPRINT-2026-07.md` | sprint plan |
| 7 | `docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` | application |
| 8 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |
| 9 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |

`docs/strategy/` (including the roadmap), every path under `contracts/`, every path under
`tools/operations/`, and `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` are explicitly
**outside** this allowlist and were not edited. No path was added, staged, committed, merged,
pushed or deleted.

**Allowlist history, in order.** §14.1 eight docs-only paths (application preparation) → §14.4.1
five paths, docs plus validator and its test suite (pinned-row repair) → §14.5.1 seven docs-only
paths (downstream reconciliation) → §14.6.1 twelve paths (GATE A4 status-flip record) → §14.7.1
nineteen paths (contract-acceptance reconciliation) → §14.8.1 nine docs-only paths (this index
reconciliation). Each set was bounded separately; none widened an earlier one, and every earlier
record stands unedited as provenance.

#### 14.8.2 What this reconciliation changed

Stale **current-state** wording in the indexes and the sprint plan only. Dated historical
paragraphs — §14.2, §14.5.3 and every "as recorded on 2026-07-26 before …" block — are kept
verbatim as provenance and were not touched.

- **Root `README.md`.** `ADRs are PROPOSED — NOT DECIDED` replaced by "ADR-0001 … ADR-0010 are all
  decided", with `docs/adr/README.md` named authoritative and an accepted ADR restated as a
  decision record, never implementation authority. `contracts/` no longer reads "**Empty by
  design**"; `integration/`, `tests/` and `releases/` now read "directory scaffold only".
- **`docs/README.md`.** The `adr/` row no longer reads `ADR-0003/0005 PROPOSED`; it records the
  GATE A4 closure as decision-only and adds ADR-0008/0009/0010. The `operations/` row no longer
  reads "empty".
- **`docs/adr/README.md`.** ADR-0009 and ADR-0010 added to the catalog table and header; the
  decision-sprint table now lists the Wave 2 packet, the W1-C1/C2 packet and all four applications
  with their `APPLIED 2026-07-26` status; the residual-gate paragraph narrowed to the files that
  are still stale.
- **`docs/adr/evidence/README.md`.** The ADR-0003 and ADR-0005 rows no longer read "ADR remains
  `PROPOSED`"; each now records the GATE A4 acceptance and flags that the packet body itself is
  still stale.
- **`docs/operations/README.md`.** This board and the evidence register added; the handoff record
  labelled as dated and superseded.
- **`docs/adr/ADR-DECISION-SPRINT-2026-07.md`.** Scope line made explicit that the sprint owns
  ADR-0001 … ADR-0006 and that ADR-0007 … ADR-0010 were decided at their own W2 gates.
- **This board.** §13 rewritten so the post-§14.7 pin set reads as *required* behaviour, plus the
  new §13.1 recording the measured validator state at the time (RED; superseded by the GREEN
  measurement now in §13.1, see §14.9).
- **`docs/operations/W1-E2-EVIDENCE-REGISTER.md`.** §1 and §3 item **10** — the control
  validator/test gate, not item 9, which is the GATE A4 status flip — no longer claim a green
  control-test run; both carried the measured RED and pointed at §13.1. Superseded by §14.9: item
  10 is now closed with the measured GREEN result.

`docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` was re-read in full and needed
no change: it already reads `APPLIED 2026-07-26` against commit
`ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`, parent `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619`,
32 paths, aggregate `0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e`, `31/31`,
`97.44%` branch coverage, `W0-T01 PASS`, the W0-R01 Option B LOW advisory, Bundle v0.1.1
`PROPOSED` with v0.1.0 authoritative, and the three separate future decisions.

#### 14.8.3 Residual documentation gate — still open, outside this allowlist

| File | Stale wording still on disk |
|---|---|
| `docs/adr/evidence/ADR-0003-EVIDENCE.md` | header, §6, §12 and the closing note still say GATE A4 is unopened and ADR-0003 stays `PROPOSED — NOT DECIDED` |
| `docs/adr/evidence/ADR-0005-EVIDENCE.md` | narrowed 2026-07-26 by §14.9: the dated correction note in the header is now scoped historically and points at the authoritative status. The rest of the packet body — the `Status`/`Wave / gate` lines, §7, §15 and §17 — still says GATE A4 is not open and ADR-0003/ADR-0005 stay `PROPOSED — NOT DECIDED` |
| `docs/operations/OVERNIGHT-HANDOFF-2026-07-24.md` | §3.2, §4 and §5 still say GATE A4 is not open |
| `docs/adr/FOUNDER-DECISION-PACKET-WAVE-1.md` | closing note still says GATE A4 remains not open until its Wave 2 decision packet is prepared |
| `contracts/README.md` | header still says no contract has been accepted |

This remains a **wording** residual only. `docs/adr/README.md` is authoritative on ADR status and
now names every file in this table. Each needs its own bounded authority; `contracts/` in
particular is outside every documentation allowlist recorded in §14.

#### 14.8.4 Residual tool-side gate — CLOSED 2026-07-26 by §14.9

*As recorded on 2026-07-26 by the §14.8 reconciliation:* `tools/operations/validate-w1-control.mjs`
and its test suite were still pinned to the pre-acceptance §14.4 values and therefore failed against
the correct current documents — `tests 77 · pass 9 · fail 68`, all from one assertion.
`tools/operations/` was outside that task's allowlist, so nothing there was edited and no document
was bent to satisfy the stale tool. The gate was **open** and assigned to **W0-R06**.

**Current disposition: CLOSED 2026-07-26.** W0-R06 finished the tool-side repair under the bounded
write authority recorded in §14.9. Measured result: validator `PASS`, `tests 77 · pass 77 · fail 0`,
manual and static-only, **CI: NOT WIRED**. The `RED 9/77` figures above are dated history; §13.1
carries the current measurement. Closing this gate promoted nothing: `W0 COMPLETE=0`, W0 closure
`NO-GO`, W1 writers `HOLD`/`NO-GO`.

#### 14.8.5 What this reconciliation did not change

- Nothing was staged, committed, merged, pushed, deployed or released; no dependency was installed
  and no database, container or network was reached.
- No status flip, no contract acceptance, no gate promotion in §1. GATE A4 stays
  `ACCEPTED — CLOSED 2026-07-26` and all four applications stay `APPLIED 2026-07-26`.
- The 48 immutable task identities are unchanged and no task 49 exists.
- **CI: NOT WIRED**; all evidence remains static/documentary only and no CI result is claimed.
- `W0 COMPLETE=0` and W0 closure `NO-GO`; W1 product implementation and integration/live shadow
  `HOLD`; W1 runtime writers, delegated routine integration and external release `NO-GO`.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31 release
  window are unchanged.
- Both accepted local commits remain unpushed, unmerged and unreleased; Bundle v0.1.1 remains a
  proposed successor and v0.1.0 remains the authoritative Bundle contract.

### 14.9 W0-R06 tool-side repair record — validator and claim wording, no status flip

Recorded under **Founder-delegated current-thread authority** on 2026-07-26 as a bounded repair of
the failed W0-T11 review. Owner: logical task **W0-R06** (claim-to-evidence and lifecycle wording
review). This section accepts nothing, flips no ADR or contract status, promotes no gate in §1,
opens no product or runtime writer, and creates no task identity. It closes the tool-side gate that
§14.8.4 held open, and repairs the claim wording that had gone stale against the measured state.

#### 14.9.1 Exact write allowlist — eight paths

| # | Path | Kind |
|---|---|---|
| 1 | `tools/operations/validate-w1-control.mjs` | control validator |
| 2 | `tools/operations/tests/validate-w1-control.test.mjs` | validator test suite |
| 3 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |
| 4 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 5 | `docs/operations/README.md` | operations catalog |
| 6 | `docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` | application |
| 7 | `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` | GATE A4 packet |
| 8 | `docs/adr/evidence/ADR-0005-EVIDENCE.md` | evidence packet |

`docs/strategy/06-ROADMAP-2026-2029.md` is explicitly **outside** this allowlist and was not edited;
the release-window repair below re-anchors the *validator* on bytes the roadmap already has. Every
path under `contracts/`, `docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md`, the two ADR files, the two
ADR status-flip applications, `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md`,
`docs/adr/README.md`, `docs/README.md` and the root `README.md` are also outside it and were not
edited. No path was added, renamed, staged, committed, merged, pushed or deleted.

**Allowlist history, in order.** §14.1 eight docs-only paths → §14.4.1 five paths → §14.5.1 seven
docs-only paths → §14.6.1 twelve paths → §14.7.1 nineteen paths → §14.8.1 nine docs-only paths →
§14.9.1 eight paths (this repair). Each set was bounded separately; none widened an earlier one, and
every earlier record stands unedited as provenance.

#### 14.9.2 What this repair changed

- **Release-window guard, `validate-w1-control.mjs`.** The guard was anchored on the roadmap bullet
  `- **Release target:** 2026-12-21; …`, which exists **only in the uncommitted working copy** of
  the roadmap. Against the committed `HEAD` bytes the guard therefore failed, so the validator was
  passing on a dirty tree and would have failed on the document it protects. It is now anchored on
  `### Release — 2026-12-21 → 2026-12-31`, present in `HEAD` and in the working copy alike. The
  window itself is unchanged: 2026-12-21 → 2026-12-31.
- **Release-window negative test.** It used an unguarded first-occurrence replacement of the bare
  date range, which could mutate an unrelated line or nothing at all. It now targets the exact
  guarded heading, asserts that heading occurs exactly once, and asserts the mutation is not a
  no-op before asserting the throw. The register posture test had the same fragility — both
  disclosures now legitimately occur twice — and was changed to `replaceAll` with the same
  no-op assertion. Test count is unchanged at 77; no test was added or removed.
- **Claim wording.** Every live claim that the control validator is `RED` at `tests 77 · pass 9 ·
  fail 68`, or that its repair gate is open/assigned to W0-R06, was replaced with the measured
  final result. The RED figures survive only inside explicitly dated superseded-history paragraphs
  (§13.1, §14.8.4, register §3 item 10). Touched: §5, §13, §13.1, §14.8.2, §14.8.3, §14.8.4 here;
  register §1, §3 item 10 and §4.3; `docs/operations/README.md`; W1-C2 application gate 8.
- **Register cross-references.** `§3 item 9` pointers that meant the control validator/test
  measurement were corrected to `§3 item 10`; item 9 is the GATE A4 status flip.
- **Wave-2 packet scope.** The bullet reading "No contract lifecycle status moved, and the
  W1-C1/W1-C2 contract gate is untouched and still `DECISION READY — CONTRACT GATE NOT OPEN`" was
  scoped to GATE A4's own effect, with the separately-closed contract gate named.
- **`docs/adr/evidence/ADR-0005-EVIDENCE.md`.** The dated 2026-07-26 executor-lifecycle correction
  note no longer asserts, as current fact, that GATE A4 remains `NOT OPEN`; it is scoped to what was
  true at the correction and points at the authoritative status. **No technical decision substance
  changed**: the isolation floor, the S0/R0-only pooling rule and S4's per-invocation disposable
  lifecycle under accepted ADR-0004 F3 are byte-identical.

#### 14.9.3 Measured command evidence — 2026-07-26, after completion

Run from the `cybrik-suite` worktree root, manually, in this order:

| Command | Measured result |
|---|---|
| `node tools/operations/validate-w1-control.mjs` | **PASS** — `tasks=48`, `categories={"I":12,"T":12,"R":6,"S":5,"B":5,"IR":4,"D":4}`, `GATE_A4={"H":11,"J":10}`, `CONTRACT_GATE={"C1":10,"C2":10}`, both gate dispositions `accepted:true` on `2026-07-26`, `pushed/merged/released` all `false` |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0 · cancelled 0 · skipped 0 · todo 0` |
| `node --test --experimental-test-coverage tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0`; `validate-w1-control.mjs` line 98.31% · branch 92.93% · funcs 97.87% |
| `git diff --check` | clean — no whitespace or conflict-marker error |
| Validator re-run with `git show HEAD:docs/strategy/06-ROADMAP-2026-2029.md` substituted for the working-copy roadmap | **PASS** — `tasks=48`; the roadmap file was not modified |

All five are **manual** and **static/documentary only**. **CI: NOT WIRED** — no command here is
registered in any pipeline and no CI result is claimed.

#### 14.9.4 What this repair did not change and did not grant

- **No implementation, Git or release authority.** Nothing was staged, committed, merged, pushed,
  deployed or released; no branch or remote was created or configured; no dependency was installed;
  no database, container, microVM, netns or broker was started; no network was reached; no
  formatter or auto-fixer was run.
- No status flip, no contract acceptance, no gate promotion in §1. GATE A4 stays
  `ACCEPTED — CLOSED 2026-07-26`, the W1-C1/C2 contract gate stays
  `ACCEPTED — CLOSED 2026-07-26`, and all four applications stay `APPLIED 2026-07-26`.
- The 48 immutable task identities are unchanged; category counts stay I 12 · T 12 · R 6 · S 5 ·
  B 5 · IR 4 · D 4; no task 49 exists and no replacement identity was created.
- `W0 COMPLETE=0` and W0 closure `NO-GO`; W1 product implementation and integration/live shadow
  `HOLD`; W1 runtime writers, delegated routine integration and external release `NO-GO`. **A green
  validator is not W0 completion evidence and opens no writer.**
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31 release
  window are unchanged.
- Both accepted local commits — `3a2c71555a423465855ffaddcb663c8b704dbfbd` (16 paths) and
  `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4` (32 paths), shared parent
  `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619` — remain unpushed, unmerged and unreleased.
- Bundle v0.1.1 remains `PROPOSED` as a successor candidate only, v0.1.0 remains the authoritative
  Bundle contract, and the W0-R01 Option B finding remains a **LOW advisory** that changed no
  accepted contract byte.
- S4 remains per-invocation disposable and is never pooled under accepted ADR-0004 F3.
- The §14.8.3 wording residual stays **open** for `docs/adr/evidence/ADR-0003-EVIDENCE.md`,
  `docs/operations/OVERNIGHT-HANDOFF-2026-07-24.md`,
  `docs/adr/FOUNDER-DECISION-PACKET-WAVE-1.md`, `contracts/README.md` and the remaining body of
  `docs/adr/evidence/ADR-0005-EVIDENCE.md`. Each needs its own bounded authority.

## 15. Coordinator runtime rule — bounded single extension

A healthy task may receive **one and only one** extra cycle, capped at **600 seconds**, and only
when process or CI progress is evidenced.

| Condition | Disposition |
|---|---|
| Evidenced process or CI progress on a healthy task | one extra cycle, ≤ 600s, once only |
| A second extension request for the same task | **denied**; the task ends and reports partial evidence |
| Quota exhaustion | **never** grounds for an extension |
| Permission loop | **never** grounds for an extension |
| Deadlock | **never** grounds for an extension |
| Scope drift | **never** grounds for an extension |

Evidence of progress means an observable artifact advancing — new bytes written inside the task's
allowlist, a validator/test run producing a new result, or a CI job advancing state. Elapsed time,
retry count, agent confidence and "almost done" are not evidence. An extension never widens a write
allowlist, never grants staging/commit/merge/push authority, never promotes a gate in §1, and never
creates a replacement identity — a retry keeps the same immutable task ID.
