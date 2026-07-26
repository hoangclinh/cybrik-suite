# W1 E2 proposal and bounded-hardening evidence register

- **Prepared:** 2026-07-26
- **Status:** `ACTIVE — LOCAL COMMIT AND WORKTREE EVIDENCE ONLY — NOT PUSHED, NOT INTEGRATED`
- **Scope:** GATE A4 decision packet, W1-C1 alert-context contract, W1-C2 investigation
  lifecycle contract and FAB-C0 provenance containment
- **Authority:** no push, merge, dependency install, database/container, deployment,
  release or release-date authority
- **Product-evidence reconciliation:** 2026-07-27 — see §5
- **Runtime-evidence reconciliation:** 2026-07-27, later same day — see §6
- **HTTP-evidence reconciliation:** 2026-07-27, third same-day record — see §7
- **Fabric W0-I07 disposition:** 2026-07-27, fourth same-day record — see §8
- **Fabric W0-I07 remediation grant:** 2026-07-27, fifth same-day record — see §9

This register records exact current evidence without promoting a product runtime or release claim.
W0 remains `NO-GO` with `COMPLETE=0`; W1 runtime writers remain `NO-GO`. Sections §1–§4 are
control- and contract-scoped; §5 records reviewed local **product** commit evidence added on
2026-07-27 and promotes nothing; §6 records the later-same-day runtime-evidence reconciliation —
including the 2026-07-27 W1-C1 transport-binding acceptance — and likewise promotes nothing beyond
recording that acceptance; §7 records the third same-day HTTP-evidence reconciliation — a reopened
docs-only gate, a hard-stopped uncommitted implementation attempt and an adverse independent
technical review — and promotes nothing at all; §8 records the fourth same-day record — the
delegated coordinator disposition of the paused Fabric W0-I07 attempt — and likewise promotes
nothing; §9 records the fifth same-day record — the fresh prospective bounded grant for the
Fabric W0-I07 remediation — which authorizes one future bounded writer attempt under its own
terms and promotes nothing by itself.

## 1. Current evidence

| Lane | Exact base/commit | Current disposition | Verification |
|---|---|---|---|
| GATE A4 | Suite local docs on canonical dirty root | `ACCEPTED — GATE A4 CLOSED 2026-07-26`; ADR-0003 and ADR-0005 are `ACCEPTED` (decision only; no implementation authority) | Independent re-review: no P0–P3; Option A accepted under Founder-delegated current-thread authority; both status-flip applications `APPLIED 2026-07-26`. The W1 control validator and its test suite are **GREEN** against the current tree — validator `PASS`, `tests 77 · pass 77 · fail 0`, measured manually on 2026-07-26 after the W0-R06 repair; see §3 item 10 and `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §13.1 and §14.9. **Static/documentary only; CI: NOT WIRED, and no CI result is claimed for this row** |
| W0-I01/T01 — W1-C1 alert context | accepted local commit `3a2c71555a423465855ffaddcb663c8b704dbfbd`, parent `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619`, branch `codex/w1-i01-alert-context-proposal-r1` | `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`; exact 16 paths, not pushed | Standalone validator `PASS`; 21/21 tests; 87.27% branch coverage against the declared 80% branch floor; full accepted-contract regression green; member-set digest `sha256:e4cfbf8c6f6ccfe545a91d63b0bee6de4c616a28e3f1a61c320f8fde747e1d35` (13/13 member hashes match); final independent review W0-R05 `PASS`, no open P0–P2 |
| W0-I02/R05 — W1-C2 investigation lifecycle | accepted local commit `ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4`, parent `3ef8e0536f8210f2739c6fa0e32e37f8dc27d619`, branch `codex/w1-i02-investigation-lifecycle-proposal-r1` | `ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`; exact 32 paths, not pushed | Standalone validator `PASS`; 31/31 tests; 97.44% branch coverage; official Ajv strict eight clean compilations, Spectral/AsyncAPI zero errors; aggregate SHA-256 `0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e` (30/30 member digests match); final independent review W0-T01 `PASS`, no open P0–P3 |
| W0-I11 — FAB-C0 provenance containment | base `6f72616ed2b216fa63cca6090ebee4e162952ca4`; `w1-fab-c0-provenance-r1` | `EVIDENCE READY — UNCOMMITTED`; exact two dirty paths, zero staged | Independent final review: no P0–P3; 39 focused, 74 regression and 14 exact T10 tests; source SHA-256 `ae8cfa7a0b15483377a4344eca37d2b5aefbb2b4030cf70cad9e6ca0175540de` |

The GATE A4 control-test count was `37/37` before the §14.4 validator repair, `52/52` after it and
`61/61` after the §14.6 status-flip repair. Those three counts are **superseded history**, and so is
the `tests 77 · pass 9 · fail 68` RED state recorded here until 2026-07-26: the §14.7
contract-acceptance reconciliation updated the documents without landing the matching validator
bytes, so the on-disk tool briefly still pinned the pre-acceptance `cd872a0e…`/`16099c17…` digests
and rejected the correct current documents. That was a tool defect, not a document defect, and no
document was edited to satisfy it. The W0-R06 repair recorded in board §14.9 closed it. The measured
current state is validator `PASS` with `tests 77 · pass 77 · fail 0` — recorded in §3 item 10 and in
board §13.1. The Wave-2 packet SHA-256 previously pinned in this row
(`55d56f8f491f…`, itself preceded by `bba17c1f5842…` and `556804f75435…`) is **superseded**: the
packet bytes changed when GATE A4 closed, and no new packet digest is pinned here. Both the
validator run and the test run are manual and documentary only — **CI: NOT WIRED**, no CI
result is claimed, and the GATE A4 acceptance recorded above is a decision record that flips two ADR
statuses and grants nothing else.

**Evidence-file authority.** This register records measured evidence; it is not the authority on
status. `docs/adr/README.md` is authoritative on ADR status, `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md`
on the GATE A4 disposition, `docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` on the W1-C1/C2 contract
gate, the four `*-APPLICATION.md` files on what each application applied, and
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` on the roster, gate dispositions and every bounded
write authority (§14.1–§14.9). The Wave 2 evidence packets under `docs/adr/evidence/` are dated
`DRAFT` read-ahead research: they informed GATE A4 and decide nothing, and where their bodies still
read as pre-closure they are the wording residual tracked in board §14.8.3 — never a status source.

**Rider — W0-R01 Option B (Fable independent review).** The final cross-agent review raised one
non-blocking W1-C2 finding. Option B was recorded: the finding is disclosed as a LOW advisory and
changed no accepted contract byte, so both accepted commits carry exactly the reviewed bytes. It is
not a P0–P3 defect and it opens no gate.

## 2. Evidence boundaries

### GATE A4

- Option A was accepted on 2026-07-26 under Founder-delegated current-thread authority. It flipped
  ADR-0003 and ADR-0005 to `ACCEPTED` through the two docs-only status-flip applications, and it
  granted nothing else.
- Implementation, dependency selection or installation, spike, benchmark, DB/container/microVM/netns
  /broker start, product/runtime writers, staging, commit, merge, push, deployment and release each
  remain separately gated.
- Only policy-approved S0/R0 metadata workers may be pooled; S4 and every R1/R2/R3 execution remain
  per-invocation disposable under accepted ADR-0004 F3. Accepting `J2` accepted that wording
  verbatim; it did not reopen pooled S4.
- No dependency or sandbox runtime is selected or installed.

### W1-C1 alert context

- The accepted contract defines `soc.get_alert_context@0.1.0` as R0 and side-effect-free.
- Credential-derived authorization precedes cache/idempotency lookup.
- Tenant, full org scope, actor, policy, capability, schema and input digests are bound.
- Internal references expose no arbitrary locator; W2-F inference delegation is not Fabric tool
  execution authority.
- SOC owns the RFC 8785/JCS context projection and digest.
- Acceptance is contract-first at `v0.1.0` — not stable v1/GA. Static evidence does not prove timing
  equivalence, audit equivalence, runtime authorization or no-existence-leak behavior.

### W1-C2 investigation lifecycle

- Cyber AI remains lifecycle/checkpoint/event/Bundle producer and authority.
- SOC remains authenticated requestor/consumer/viewer; W2-D remains the inference-path owner.
- Bundle v0.1.1 remains a proposed successor candidate only; accepted v0.1.0 bytes are unchanged and
  supersession or consumer migration requires its own explicit Founder decision.
- TR-8 evidence maps only to the sanitized-error positive and existence-decoy negative fixtures;
  timing equivalence remains runtime-only.

### FAB-C0

- The bounded verifier now validates canonical relative paths, descriptor-rooted no-follow opens,
  directory-entry identity, regular file type, closed tree inventory and normalized failures.
- This proves verifier containment only. The loader later reopens paths by pathname, so a mutable
  privileged local tree is not an atomic verify-and-load snapshot.
- Stronger closure requires an immutable/snapshot mount or a load-from-verified-descriptor design.

## 3. Remaining gates

1. **Publication gate.** Obtain explicit authority before pushing either accepted branch; neither
   accepted commit has been pushed.
2. **Merge gate.** Obtain explicit authority before either accepted branch reaches `main`.
3. Obtain separate exact product/base/path/test/reviewer authority before SOC, Cyber AI or Fabric
   runtime work.
4. Keep delegated routine integration and external release `NO-GO`.
5. **Pinned-row correction gate — closed.** The pre-acceptance §1 aggregate/coverage/test-count
   attributes, the matching decision-packet §1 rows and the matching pins in
   `tools/operations/validate-w1-control.mjs` and its test file were repaired together under a
   separate bounded five-path authority recorded in
   `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.4, then re-pinned to the committed bytes of
   the accepted commits under the nineteen-path authority recorded in §14.7 of that board. Both
   repairs changed documentation and validator bytes only. No open gate remains from this item.
6. **Stale ADR sprint header — closed 2026-07-26.** `docs/adr/ADR-DECISION-SPRINT-2026-07.md` was
   repaired on disk on 2026-07-26; its progress block and §3 wave-board row now record
   **GATE A4 CLOSED 2026-07-26** and the W1-C1/C2 contract gate closure. No open gate remains from
   this item.
7. **Stale S4-pooling wording — closed 2026-07-26.** `docs/adr/evidence/ADR-0005-EVIDENCE.md`
   (§5 matrix `S4` row, §7.1 item 2, §8, §12, §15) previously contradicted accepted ADR-0004 F3. It
   was repaired on disk on 2026-07-26 — header note, §2.2, §3, §5, §7.1, §8, §12, §14 (new risk row
   SR-11) and §15 — and now matches the governing GATE A4 J2 wording;
   `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` §4 records the same resolution. **The governing
   rule stands permanently:** only policy-approved S0/R0 metadata workers may be pooled, and S4 — an
   R3 class — is never pooled under accepted ADR-0004 F3. No open gate remains from this item.
8. **CI wiring gate.** Validator/test registration and pipeline invocation remain unwired for every
   lane in §4.
9. **GATE A4 status flip — applied 2026-07-26; outside-allowlist reconciliation closed 2026-07-26.**
   Option A was accepted under Founder-delegated current-thread authority; ADR-0003 `H1..H11` and
   ADR-0005 `J1..J10` are accepted, both ADR files read `ACCEPTED` (GATE A4, 2026-07-26) — decision
   only, and both status-flip applications are `APPLIED 2026-07-26`. The flip was applied inside the
   exact twelve-path allowlist recorded in `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.6. The
   documents left outside that allowlist were reconciled afterwards under the nineteen-path
   authority recorded in §14.7 of that board, and the index layer under the nine-path authority
   recorded in §14.8. The earlier `52/52` green claim in this item is **withdrawn as stale**: the
   current control-validator measurement is item 10.
10. **Control validator/test gate — CLOSED 2026-07-26.** Measured from this tree after the W0-R06
    repair recorded in board §14.9: `node tools/operations/validate-w1-control.mjs` returns
    **PASS** (`tasks=48`, categories `I 12 · T 12 · R 6 · S 5 · B 5 · IR 4 · D 4`,
    `GATE_A4={"H":11,"J":10}`, `CONTRACT_GATE={"C1":10,"C2":10}`), and `node --test
    tools/operations/tests/validate-w1-control.test.mjs` returns `tests 77 · pass 77 · fail 0`.
    The documented coverage command `node --test --experimental-test-coverage
    tools/operations/tests/validate-w1-control.test.mjs` returns the same 77/77 with
    `validate-w1-control.mjs` at line 98.31% · branch 92.93% · funcs 97.87%. The validator also
    returns `PASS` when `docs/strategy/06-ROADMAP-2026-2029.md` is supplied from `HEAD` instead of
    the dirty working copy; that file was not edited.
    *Superseded history:* until 2026-07-26 this item recorded the tool as RED at
    `tests 77 · pass 9 · fail 68` — all 68 from one assertion — because the validator still pinned
    the pre-acceptance `cd872a0e…`/`16099c17…` digests, `PROPOSED — NOT ACCEPTED` candidate rows and
    `DECISION READY — PROPOSED ONLY` register anchors that §14.6/§14.7 had superseded in the
    documents. The documents were correct and the tool was stale; no document was altered to satisfy
    it. All three commands are manual and **static/documentary only** — **CI: NOT WIRED**, no CI
    result is claimed, and a green control validator is a documentary consistency check that
    promotes no gate, no writer and no release.
11. **Everything the two acceptances did not grant.** No push, merge, release or release-date
    authority; no implementation, dependency selection or installation, spike, benchmark, database,
    container, microVM, netns or broker start; and no product/runtime writer promotion. Gates 1–4,
    8 and 10 above are unaffected by either acceptance.

## 4. Accepted candidate evidence, final reviews and applied applications

The values below are recomputed from the **committed bytes of the two accepted local commits**.
They match §1 exactly.

| Lane | Final digest re-verified from committed bytes | Final independent review | Superseded pre-acceptance values, retained as history |
|---|---|---|---|
| W1-C1 alert-context lane | `sha256:e4cfbf8c6f6ccfe545a91d63b0bee6de4c616a28e3f1a61c320f8fde747e1d35` (`MEMBER-SET-SHA256/v1`, 13/13 member hashes match, 0 mismatches) | **W0-R05 `PASS`**, no open P0–P2 | aggregates `ce9921d3…` then `cd872a0e…`; `90.39%` line coverage → `87.87%` branch → `87.27%` branch; `18/18` tests → `21/21` |
| W1-C2 investigation-lifecycle lane | `0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e` (declared aggregate rule, 30/30 member digests match, 0 mismatches) | **W0-T01 `PASS`**, no open P0–P3 | aggregates `f79702c6…` then `16099c17…`; `10/10` then `29/29` tests → `31/31`; `86.67%` line coverage → `97.39%` branch → `97.44%` branch |

Attributes **never** superseded: W1-C1 16 paths; W1-C2 32 paths, Ajv strict eight clean compilations
and zero Spectral/AsyncAPI errors; both accepted commits rooted at parent
`3ef8e0536f8210f2739c6fa0e32e37f8dc27d619`.

The two final reviews are **cross-lane**: W1-C1 was reviewed by W0-R05 and W1-C2 by W0-T01,
consistent with the rule that no reviewer approves its own authored proposal.

### 4.1 Applied applications

Applied under **Founder-delegated current-thread authority** recorded in
`docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md` §8 and
`docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` §9.

| Application | Path | Status |
|---|---|---|
| W1-C1 alert-context application | `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` | `APPLIED 2026-07-26` |
| W1-C2 investigation-lifecycle application | `docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md` | `APPLIED 2026-07-26` |
| ADR-0003 durable agent orchestration | `docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md` | `APPLIED 2026-07-26` |
| ADR-0005 sandbox substrate | `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` | `APPLIED 2026-07-26` |

The two W1 contract applications accept their packets at `v0.1.0` only; they adopt no Bundle v0.1.1,
supersede no v0.1.0 and migrate no consumer. The two ADR applications record the GATE A4 status flip
and nothing more. No application selects or installs a dependency/substrate, runs a spike or
benchmark, or grants push, merge, integration, deployment, release or release-date authority.

### 4.2 Bounded documentation authorities applied, in order

Each set below was bounded separately; none widened an earlier one, and the earlier records stand
unedited as provenance.

| Order | Authority scope | Paths | Record |
|---|---|---|---|
| 1 | Application preparation, docs only | 8 docs paths | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.1 |
| 2 | Pinned-row repair, docs plus validator bytes | 5 paths, incl. `tools/operations/validate-w1-control.mjs` and its test suite | same board §14.4 |
| 2a | **D02-lane evidence-file correction**, S4-pooling wording in the ADR-0005 evidence packet | `docs/adr/evidence/ADR-0005-EVIDENCE.md` — separate bounded evidence-file authority; **no numbered board §14.x allowlist records its exact path count** | same board §14.5.2 (recorded there as already landed); `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` §4.2/§4.4; `docs/adr/FOUNDER-DECISION-PACKET-WAVE-2.md` §10 |
| 3 | Downstream documentation reconciliation, docs only | 7 docs paths | same board §14.5 |
| 4 | GATE A4 status-flip record | 12 paths | same board §14.6 |
| 5 | Contract-acceptance current-state reconciliation | 19 paths | same board §14.7 |
| 6 | W0-D03 index and current-state reconciliation, docs only | 9 docs paths | same board §14.8 |
| 7 | **W0-R06 tool-side repair** — control validator, its test suite and the claim wording that had gone stale against the measured state | 8 paths, incl. `tools/operations/validate-w1-control.mjs` and its test suite | same board §14.9 (allowlist §14.9.1; measured evidence §14.9.3) |
| 8 | **W0-D02 product-evidence reconciliation, 2026-07-27** — record reviewed local product commits and correct control wording that had gone stale against them | 2 docs-only paths: this register and `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | same board §14.10 (allowlist §14.10.1; measured evidence §14.10.3) |
| 9 | **W0-D02 runtime-evidence reconciliation, 2026-07-27, later same day** — record the W1-C1 transport-binding acceptance, Cyber AI/SOC runtime-adjacent evidence and the paused Fabric W0-I07 attempt with its W0-R04 audit result; ends with exactly one authorized local commit | 2 docs-only paths: this register and `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | same board §14.11 (allowlist §14.11.1; measured evidence §14.11.3) |
| 10 | **W0-D03 HTTP-evidence reconciliation, 2026-07-27, third same-day record** — record the reopened W1-I06C HTTP ingress gate, the hard-stopped Opus R2 attempt (13-path dirty tree, uncommitted) and its adverse W0-R03 NO-GO technical review; close the W0-I07 admission-wording P3 transparently; ends with exactly one authorized local commit | 2 docs-only paths: this register and `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | same board §14.12 (allowlist §14.12.1; measured evidence §14.12.3) |
| 11 | **W0-D04 Fabric W0-I07 disposition, 2026-07-27, fourth same-day record** — record the delegated coordinator disposition of the paused Fabric W0-I07 attempt: `HOLD`, commit and replacement writer refused within the exhausted attempt, tree stays `PAUSED — UNCOMMITTED` and not product evidence; queue (not decide) the Cyber AI W1-I06C remediation; ends with exactly one authorized local commit | 3 docs-only paths: `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md` (new), this register and `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | same board §14.13 (allowlist §14.13.1; measured evidence §14.13.4) |
| 12 | **W0-D04 Fabric W0-I07 remediation grant, 2026-07-27, fifth same-day record** — record the fresh prospective bounded grant the disposition packet §5 requires: same immutable task W0-I07, Opus 5 in a brand-new session (never resuming exhausted session `5da9e0a9`), five-path product edit allowlist inside the unchanged 30-path dirty set, RED-first idempotency/aliasing remediation, stop-before-commit with independent Fable pre-commit review, one status-honest `SCAFFOLD` product commit only after GO with no P0–P2, fresh post-commit Fable review; ends with exactly one authorized local commit | 3 docs-only paths: `docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md` (new), this register and `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | same board §14.14 (allowlist §14.14.1; measured evidence §14.14.4) |

Set **2a** is placed here because board §14.5.2 records it as **already landed on disk on
2026-07-26** before set 3. Its position relative to sets 1 and 2 is **not recorded** anywhere, and
none is asserted; it changed **executor-lifecycle wording only** and moved no isolation floor, ADR
status, gate disposition, dependency choice or date.

`docs/strategy/` was outside every one of these sets and was never edited by any of them. Set 6
additionally excluded all of `contracts/`, all of `tools/operations/` and
`docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md`. Set 7 excluded
`docs/strategy/06-ROADMAP-2026-2029.md`, all of `contracts/`,
`docs/adr/FOUNDER-DECISION-PACKET-W1-C1-C2.md`, the two ADR files, the two ADR status-flip
applications, `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md`, `docs/adr/README.md`,
`docs/README.md` and the root `README.md`. Set 8 excluded all of `tools/operations/` — the control
validator and its test suite were re-run unchanged, not edited — as well as all of `contracts/`,
all of `docs/adr/`, `docs/operations/README.md`, `docs/README.md`, the root `README.md` and
`docs/strategy/06-ROADMAP-2026-2029.md`, whose pre-existing unrelated dirty edit was left exactly
as found. No set staged, committed, merged, pushed, deployed or released anything, none installed a
dependency or reached a database, container or network, and none wrote to a product repository.
Set 9 repeated set 8's exact two-path scope and exclusions — the control validator and its test
suite were again re-run unchanged, not edited — with one difference recorded in board §14.11.1: its
authority ends with exactly one authorized local commit of the two allowlisted paths, and nothing
else; the roadmap's pre-existing dirty edit stayed unstaged and untouched. Set 10 repeats set 9's
exact two-path scope, exclusions and single-commit termination — subject
`docs(control): record W1 HTTP hard stop` — with the control validator and its test suite once more
re-run unchanged, not edited, and the roadmap's pre-existing dirty edit again left unstaged and
untouched. Set 11 widens the scope by exactly one **new** docs path — the disposition packet
`docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md` — alongside the same two control documents,
keeps every exclusion of sets 9–10, terminates in exactly one authorized local commit — subject
`docs(control): queue Fabric disposition` — and again re-runs the control validator and its test
suite unchanged, with the roadmap's pre-existing dirty edit left unstaged and untouched. Set 12
repeats set 11's shape exactly — one **new** docs path, `docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md`,
alongside the same two control documents; every exclusion of sets 9–11 kept (the disposition
packet itself was **not** edited); exactly one authorized local commit — subject
`docs(control): grant Fabric R0 remediation` — the control validator and its test suite once
more re-run unchanged, and the roadmap's pre-existing dirty edit again left byte-for-byte
untouched and unstaged.

### 4.3 CI and posture

- **CI: NOT WIRED** for all four applications and both accepted contract lanes. No validator, test,
  orchestration, persistence, restart-survival, isolation-benchmark or escape-test job is
  registered in any pipeline. Every result recorded above is **static/documentary only** from
  manual reproducible execution; **no CI result is claimed**.
- The W1 control validator and its test suite are **GREEN** against the current tree — validator
  `PASS`, `tests 77 · pass 77 · fail 0`, coverage line 98.31% · branch 92.93% · funcs 97.87% —
  measured manually on 2026-07-26 after the W0-R06 repair. That is §3 item 10, now closed; the
  earlier `tests 77 · pass 9 · fail 68` RED is dated history. This result is a documentary
  consistency check over the control documents only. It is **not** product, runtime or CI evidence,
  it does not close W0 and it opens no writer, and it is separate from the per-lane W1-C1/W1-C2
  evidence above, which comes from each packet's own standalone validator and test suite run in its
  own worktree — those remain `PASS`, `21/21` and `31/31` respectively.
- `W0 COMPLETE=0` and W0 closure `NO-GO`. W1 runtime writers remain `HOLD`/`NO-GO`. Delegated
  routine integration and external release remain `NO-GO`.
- W1 formal dates (2026-08-01 → 2026-08-23), all W0–W6 dates and the 2026-12-21 → 2026-12-31
  release window are **unchanged**; no release claim is made.

## 5. Product-evidence reconciliation — 2026-07-27

Added on 2026-07-27 under the two-path documentation authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.10. Every commit SHA, parent, path count and
branch below was **verified directly against the product repository** on 2026-07-27. The test,
coverage and review figures are **as reported by each product lane** and were not re-executed from
this control worktree; no product dependency, database, container or network was reached to obtain
them. This section records evidence only — it accepts nothing, promotes no writer and moves no gate.

Evidence advanced again **later on 2026-07-27**: §6 records the second reconciliation and names
exactly which §5.1 cells it supersedes. This section stands unedited as dated history.

### 5.1 Reviewed local product commits

| Lane | Verified commit evidence | Reported lane evidence | Verified boundary — what it does not prove |
|---|---|---|---|
| Suite — W1 alert-context transport binding | `4d5fb4b701f79194313975302cc0a63e0dd2a8ea`, parent `3a2c71555a423465855ffaddcb663c8b704dbfbd`, exact 18 paths, branch `codex/w1-i01-alert-context-transport-binding-r1` | standalone validator `PASS`; `33/33` tests; `88.27%` branch coverage; final Fable review `PASS`, no open P0–P3 | packet manifest reads `PROPOSED — NOT ACCEPTED` (`x-cybrik-not-accepted: true`); **static only** — no endpoint, no capability-registry entry, no Fabric invocation grant, no runtime, no CI wiring, no acceptance |
| Cyber AI — W1 lifecycle producer | docs gate `e14d6312eabf2e1bc7d9d826ecff323a7c390fb7`; producer `c9530b9623c68fec3b35f63bf41720d34a28cea3`, parented on that gate commit; branch `codex/w1-i05-orchestration-foundation-r1` | `611` tests; `97.46%` full coverage, service and checkpoints at 100%; `ruff`, format and `mypy` green; final reviews `PASS`, no open P0–P2 | `docs/contracts/W1-C2-LIFECYCLE-MAPPING.md` remains `DRAFT`; **in-process only** — no transport, no database, no durability, no delivery, no attempt lineage, no TR-8 evidence |
| SOC — alert-context idempotency binding | `87e95cd2add7233176ca442bb5870b5913fdd0eb`, parent `51e2106e0c7e3a4c0637ef31983cfdfe16edc0e5`, exact 7 paths, branch `codex/w1-i03-marking-floor-r1` | current offline `191` alert-context unit/contract tests `PASS` using the existing environment; independent review `PASS`, no open P0–P2 | explicitly **no PostgreSQL, no RLS, no HTTP, no runtime proof**; a durable atomic put-if-absent/CAS remains **mandatory** and unimplemented |
| Fabric — W1 exchange binding | `87b4cf388038c6dd2e1a74e13f4131306a80ba92`, parent `1789480be4774d014a94227bc4436357d2e4b674`, exact 3 paths, branch `codex/w0-i07b-apply-r1` | full suite `318` tests `PASS`; independent review `PASS`, no open P0–P2 | no R0 live registry entry and no invocation runtime yet |
| Control — this repository | `HEAD` before this reconciliation `b8181ff8389a58f0ca61011006d1469a27c1d5b6` | control validator `PASS`; `77/77` tests; branch `92.93%` — manually re-run against the current dirty control worktree after the two documents were edited | documentary consistency check over control documents only; the validator and its test suite were **not modified**; **CI: NOT WIRED** |

### 5.2 Synthesis

- Product evidence advanced on four lanes. Nothing about W0 or W1 disposition moved with it:
  `W0 COMPLETE=0` and W0 closure stays `NO-GO`; W1 runtime and live integration stay
  `HOLD`/`NO-GO`; **CI: NOT WIRED** for every lane in §5.1.
- **No product writer is promoted by any row in §5.1.** Reviewed local commits are evidence, not
  authority. Each writer still needs its own exact repo/base/path/test/reviewer authority.
- Nothing above is pushed, merged or released, and the Suite C1, C2 and transport-binding commits
  are still **sibling commits that have not been integrated into one canonical root**.
- The live-shadow blockers are unchanged and remain open: the SOC `shadow_remote` route, the Fabric
  R0 registry/invocation surface, and integration authority together with CI wiring.
- **Test evidence is not runtime proof.** Offline suites, an in-process producer, contract
  validators and a static transport packet do not demonstrate the live SOC→AI→Fabric→SOC path; the
  W1 Investigation Spine exit criteria in board §11 remain unmet.
- The pre-existing unrelated dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was preserved
  untouched, and the fixed W0–W6 and 2026-12-21 → 2026-12-31 release dates are unchanged.

## 6. Runtime-evidence reconciliation — 2026-07-27, second same-day record

Added later on 2026-07-27 under the two-path bounded authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.11, which ends with exactly one authorized
local commit of the two allowlisted paths. Every commit SHA, parent, path count, branch tip and
worktree state below was **verified directly against the owning repository** on 2026-07-27; the
test, coverage, lint and review figures are **as reported by each lane** and were not re-executed
from this control worktree; no product repository was written to and no product dependency,
database, container or network was reached from this worktree to obtain them. This section records
evidence and one already-taken lifecycle decision — the 2026-07-27 W1-C1 transport-binding
acceptance — and promotes nothing else.

Evidence advanced a third time **later on 2026-07-27**: §7 records the HTTP-evidence
reconciliation and names exactly which §6.1 cells it supersedes. This section stands unedited as
dated history.

### 6.1 Verified evidence

| Lane | Verified commit evidence | Reported lane evidence | Verified boundary — what it does not prove |
|---|---|---|---|
| Suite — W1-C1 transport-binding acceptance (G1) | `a976a205601de22dae59e5112e37ae29707fda0e`, parent `4d5fb4b701f79194313975302cc0a63e0dd2a8ea`, exact 6 paths, branch tip `codex/w1-c1-transport-acceptance-r1`; flips the packet to `ACCEPTED FOR IMPLEMENTATION` (packet v0.1.0, not stable v1/GA, `NOT IMPLEMENTED`) | standalone validator `PASS`; `35` tests; `88.09%` branch coverage; final independent review W0-R05 `PASS`, no open P0–P2 | **static contract decision only** — TR-4..TR-8 runtime evidence, an endpoint, a live capability-registry entry, a Fabric invocation grant, CI wiring and Bundle adoption each remain open; not pushed, not merged |
| Cyber AI — W1 relying-party composition | code `35ad17e39ae1c7b0d9a80b3c9a082d0e7769fa5e`, parent `c9530b9623c68fec3b35f63bf41720d34a28cea3`; docs record `42133a5224d51b2c3e2cc6deccdf0d41ac831d9c`, parent `35ad17e…`, exactly 2 paths; branch tip `codex/w1-i06-relying-correlation-r1` | `636` tests; `ruff`, format and `mypy` green; independent review W0-R03 `PASS` with one P2 governance finding, recorded closed by the two-path docs record | still **in-process only** — no HTTP transport, no durability, no bundle delivery, no Fabric tool-execution authority |
| SOC — scoped alert-context runtime | runtime `ff1aec3e591283ac00cb6665f3f4bb57ccb68ff6`, parent `87e95cd2add7233176ca442bb5870b5913fdd0eb`; remediation `f4d234bba09ae1bea7a63b3348be3640a701065d`, parent `ff1aec3…`; branch tip `codex/w1-i03-soc-context-runtime-r1` | independent W0-R02 review: initial P1, then re-review `PASS`. Real PostgreSQL at exact `f4d234b…`: PostgreSQL 16.14; runtime roles `NOBYPASSRLS`; migration 0023 single head, upgrade→downgrade→upgrade plus base roundtrip; `FORCE ROW LEVEL SECURITY`; grants SELECT+INSERT only; `10` focused + `58` migration/RLS + `258` alert-context + `6` temporary ASGI route probes; full backend `3016 passed`, `5` Redis skips; **no repository write**. The durable atomic put-if-absent implementation is committed and real-PG tested | residuals stay open: the `/tmp` route-against-DB probe is not a permanent CI job; the org-enabled route stays inert and fail-closed; TTL enforcement and **true multi-connection contention evidence** remain open; no `shadow_remote`, no live bundle path |
| Fabric — W0-I07 R0 domain attempt | **not a commit**: worktree `w1-i07-fabric-r0-domain-r1`, base `87b4cf388038c6dd2e1a74e13f4131306a80ba92`, dirty with exactly 30 authorized paths, zero staged, after the hard 1200 s timeout | completed W0-R04 read-only audit: dirty tree **technically GREEN** — `388` full tests plus `113` targeted passing; `ruff`, format, `mypy`, `bandit` and Go checks green; no P0–P2; three P3 | `PAUSED — UNCOMMITTED` under the hard-timeout policy; a technically GREEN dirty tree is **not product evidence** until committed and reviewed under its own bounded writer authority; latest committed Fabric state remains `87b4cf3…` |
| Control — this repository | `HEAD` before this reconciliation `2cb80c7052534304f616a8c6db2a49553b92132b` | control validator `PASS`; `77/77` tests; branch `92.93%` — re-run unchanged against the current dirty control worktree after the two documents were edited | documentary consistency check over control documents only; the validator and its test suite were **not modified**; **CI: NOT WIRED** |

### 6.2 Which §5.1 cells this supersedes

- **Suite transport binding** — superseded **only as to acceptance**: the packet-manifest state
  `PROPOSED — NOT ACCEPTED` recorded in §5.1 became `ACCEPTED FOR IMPLEMENTATION` at `a976a205…`;
  every other §5.1 boundary in that cell (no endpoint, no capability-registry entry, no Fabric
  invocation grant, no runtime, no CI wiring) stands.
- **Cyber AI** — the `611`-test figure at `c9530b9…` is superseded by the reported `636`-test
  child commit; the in-process-only boundary stands unchanged.
- **SOC** — "no PostgreSQL, no RLS, no HTTP, no runtime proof" is superseded **only as far as the
  reported evidence reaches** (real-PostgreSQL RLS/migration proof and six temporary ASGI route
  probes at `f4d234b…`), and the claim that a durable atomic put-if-absent/CAS is "unimplemented"
  is withdrawn: the implementation is committed and real-PG tested, with only true
  multi-connection contention evidence still open alongside the other named residuals.
- **Fabric** — **not superseded**: the W0-I07 attempt is uncommitted; `87b4cf3…` remains the
  latest committed Fabric state.

### 6.3 Synthesis

- The W1-C1 transport contract gate is `ACCEPTED — CLOSED 2026-07-27` as a static contract
  decision at `a976a205…` only. W1 integration/live shadow and the board §11 W1 Investigation
  Spine outcome remain `HOLD`/`NO-GO`; `W0 COMPLETE=0` and W0 closure stays `NO-GO`;
  **CI: NOT WIRED** for every lane in §6.1.
- The critical live-shadow blockers are now: a committed, independently reviewed Fabric R0 domain
  (then an authenticated HTTP surface and a live registry entry); Cyber AI HTTP transport,
  durability and bundle delivery (G2); the SOC `shadow_remote` route plus a permanent
  route-against-DB CI job and real org mapping; and canonical integration authority together with
  CI wiring.
- **The paused Fabric W0-I07 attempt is promoted nowhere.** Its technically GREEN audit result is
  an observation about an uncommitted dirty tree, not product evidence, and opens no writer.
- **No product writer is promoted by any row in §6.1.** Reviewed local commits are evidence, not
  authority; each future writer still needs its own exact repo/base/path/test/reviewer authority.
- Nothing in §6.1 is pushed, merged or released; the dirty canonical roots stay untouched; the
  fixed roster of 48 stands with no task 49.
- **Test evidence is not runtime proof.** The board §11 exit criteria remain unmet.
- The pre-existing unrelated dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was preserved
  untouched and unstaged; the formal W1 dates 2026-08-01 → 2026-08-23 and the
  2026-12-21 → 2026-12-31 release window are unchanged.

## 7. HTTP-evidence reconciliation — 2026-07-27, third same-day record

Added later again on 2026-07-27 under the two-path bounded authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.12, which ends with exactly one authorized
local commit of the two allowlisted paths. The commit lineage, path counts, branch tip and
worktree state below were **verified directly against the owning repository** on 2026-07-27; the
gate-review, session, test, coverage, lint and review figures are **as reported by the lane and
its independent reviewers** and were not re-executed from this control worktree; no product
repository was written to and no product dependency, database, container or network was reached
from this worktree to obtain them. This section records evidence only — it accepts nothing,
promotes no writer and moves no gate.

### 7.1 Verified evidence

| Lane | Verified commit evidence | Reported lane evidence | Verified boundary — what it does not prove |
|---|---|---|---|
| Cyber AI — W1-I06C HTTP ingress gate and attempt | docs-only gate lineage on branch `codex/w1-i06c-http-ingress-r2`: original gate `c568045b1794eaefc34eed717c2ce94959d929a4` (parent `42133a5224d51b2c3e2cc6deccdf0d41ac831d9c`), amendment `b33b73e9aa0e873409edc858804e6898ac2302b2`, review closure `de41faa316c56740aca7e366618b3408e5c028bc`, and **gate-reopen commit `866b7db91d9352a9a0d2bd74618d642dfef0493b`** (parent `de41faa3…`, exactly 1 docs path), recorded after a prior implementation attempt's correct gate-§I.5 STOP and clean rollback to `de41faa3…`; worktree `w1-i06c-http-ingress-r2` at HEAD `866b7db9…` is dirty with **exactly the 13 gate-manifest paths, zero staged — uncommitted** | independent Fable review of the reopened docs-only gate: **GO**, no P0–P2. Opus R2 implementation session `06a2c154-50c7-4525-851c-ee9ecfd47219`: initial 600 s cycle plus **exactly one** healthy 600 s extension under board §15, then **hard-stopped — no third cycle** requested or granted. Independent **W0-R03 technical review of the resulting dirty tree: NO-GO** — P1 static-gate failures (`ruff` 7 findings, format 4 files, `mypy` 9 errors) and P2 RED-first evidence packaging — while targeted tests report `138 passed` and the full pytest suite `696 passed` at `97.43%` coverage | `PAUSED — UNCOMMITTED` and **not product evidence**: green test counts inside a NO-GO-reviewed, uncommitted dirty tree promote nothing; the latest committed Cyber AI state is the docs-only gate lineage ending at `866b7db9…`, which contains no transport code; no HTTP transport, durability or bundle-delivery claim advances |
| Control — this repository | `HEAD` before this reconciliation `214c87ad383499ae2b0408e4b98c0da6f9555d13` | control validator `PASS`; `77/77` tests; branch `92.93%` — re-run unchanged against the current dirty control worktree after the two documents were edited | documentary consistency check over control documents only; the validator and its test suite were **not modified**; **CI: NOT WIRED** |

### 7.2 Which §6.1 cells this supersedes

- **Cyber AI** — superseded **only as to the latest committed state**: after the docs record
  `42133a5…` (branch tip `codex/w1-i06-relying-correlation-r1`), four docs-only gate commits
  ending at `866b7db9…` on branch `codex/w1-i06c-http-ingress-r2` are now the latest committed
  Cyber AI state (`c568045b…` touched the gate manifest plus `docs/operations/README.md`; the
  other three touch only the gate manifest). The **in-process-only boundary stands unchanged**:
  no committed HTTP transport, durability or bundle delivery exists, and the HTTP code slice
  exists only as the uncommitted, NO-GO-reviewed 13-path dirty tree above.
- **Suite, SOC, Fabric, Control** — **not superseded**: the G1 acceptance at `a976a205…`, the
  SOC real-PostgreSQL evidence at `f4d234b…` with its named residuals, and the Fabric W0-I07
  pause (technically GREEN, `PAUSED — UNCOMMITTED`, latest committed Fabric state `87b4cf3…`)
  each stand exactly as §6 records them.

### 7.3 Synthesis

- The W1-I06C HTTP attempt is `PAUSED — UNCOMMITTED` with an **adverse independent technical
  review outstanding**: W0-R03 `NO-GO` on P1 static-gate failures (`ruff` 7, format 4 files,
  `mypy` 9) and P2 RED-first evidence packaging. Unlike the technically GREEN Fabric W0-I07
  pause, resumption here must first clear those findings — and the reopened grant was consumed
  by the hard stop, so resumption also requires a fresh bounded grant.
- The passing test figures inside that tree (`138` targeted, `696` full, `97.43%` coverage) are
  recorded truthfully and promote nothing: they sit alongside failing static gates in an
  uncommitted tree and are **not product evidence**.
- The board §15 runtime rule was honoured exactly: one initial cycle, one healthy 600 s
  extension, a hard stop, no third cycle, and the task ended reporting partial evidence.
- The board §3 W0-I07 admission-wording P3 from the prior control review is closed transparently
  in board §14.12.4: the former "`HOLD` on W0-I01" dependency was removed only because it was
  discharged — the W1-C1 packet was accepted on 2026-07-26 and the W1-G1 transport-binding
  acceptance closed on 2026-07-27 — not because the dependency was erased historically; the
  superseded wording remains readable in the committed history at `2cb80c7…` and earlier.
- Nothing in §7.1 is pushed, merged or released; no product or runtime writer is promoted;
  `W0 COMPLETE=0` and W0 closure stays `NO-GO`; W1 integration/live shadow stays `HOLD`/`NO-GO`;
  **CI: NOT WIRED** for every lane in §7.1; the fixed roster of 48 stands with no task 49.
- The pre-existing unrelated dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was preserved
  untouched and unstaged; the formal W1 dates 2026-08-01 → 2026-08-23 and the
  2026-12-21 → 2026-12-31 release window are unchanged.

## 8. Fabric W0-I07 disposition — 2026-07-27, fourth same-day record

Added later again on 2026-07-27 under the three-path bounded authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.13, which ends with exactly one authorized
local commit of the three allowlisted paths. This section records a **delegated coordinator
decision already taken** under the Founder delegation granted to the coordinator — not a request
for a user decision. The worktree facts were **re-verified read-only against the Fabric
repository** on 2026-07-27; the audit figures are **as reported by W0-R04** and were not
re-executed from this control worktree; no product repository was written to. Full decision
text: `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md`; board summary: board §1.5.

The fresh prospective bounded grant that this section's "future action" preconditions require
was recorded **later on 2026-07-27**: §9 carries that fifth same-day record. The disposition
itself — `HOLD`, refusals within the exhausted attempt — is not superseded and this section
stands unedited as dated history.

### 8.1 Verified evidence and recorded disposition

| Item | Verified / reported state | Recorded disposition |
|---|---|---|
| Fabric — W0-I07 R0 domain attempt | **re-verified 2026-07-27, read-only:** worktree `w1-i07-fabric-r0-domain-r1`, branch `codex/w1-i07-fabric-r0-domain-r1`, HEAD/base `87b4cf388038c6dd2e1a74e13f4131306a80ba92` (parent `1789480be4774d014a94227bc4436357d2e4b674`); branch tip equals base — no commit produced; exactly **30 dirty paths, zero staged** (3 tracked modified unstaged + 27 untracked, enumerated in packet §1) — unchanged since §6.1. **As reported by W0-R04:** technically GREEN — `388` full + `113` targeted tests passing; `ruff`, format, `mypy`, `bandit`, Go green; no P0–P2; **three P3** (count/severity recorded here; itemized content held by the W0-R04 lane report; unresolved and undispositioned). Attempt ended at the hard 1200 s timeout; its runtime grant is consumed | `HOLD` — the tree stays `PAUSED — UNCOMMITTED` and **not product evidence**; commit and replacement writer **refused** within the exhausted logical attempt; latest committed Fabric state remains `87b4cf3…`. Future action requires all of: a fresh prospective bounded grant recorded before work; no resumption of the exhausted Claude session and no task-identity reuse or minting to evade the board §15 timeout; resolution or explicit disposition of the three P3 findings; a fresh independent review after any commit before the result may count as product evidence |
| Cyber AI — W1-I06C remediation | `PAUSED — UNCOMMITTED` with the adverse W0-R03 `NO-GO` review outstanding, exactly as §7 records | **queued, not decided** — requires its own fresh bounded grant; nothing about it is granted or scheduled here |
| Control — this repository | `HEAD` before this record `b0e21cbfc1ca25e96243835c6b3f443ed032d331` | control validator `PASS`; `77/77` tests — re-run unchanged against the current dirty control worktree after the three documents were written; documentary consistency check only; validator and test suite **not modified**; **CI: NOT WIRED** |

### 8.2 Synthesis

- This record decides the disposition of one paused attempt and nothing else. No gate opens or
  closes: W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`, and G2/G3 stay closed; W1 integration/live
  shadow stays `HOLD`/`NO-GO`; `W0 COMPLETE=0` and W0 closure stays `NO-GO`.
- **The refusals are effective now:** no commit of the W0-I07 dirty tree and no replacement
  writer inside the exhausted attempt. A technically GREEN dirty tree remains an audit
  observation, not product evidence, and the completed W0-R04 audit does **not** carry over as
  the fresh post-commit review a future grant requires.
- Nothing is pushed, merged or released; no dependency is installed; no secret is read; no
  status is promoted; no implementation authority follows.
- The fixed roster of 48 stands with no task 49; category counts stay I 12 · T 12 · R 6 · S 5 ·
  B 5 · IR 4 · D 4.
- The pre-existing unrelated dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was preserved
  untouched and unstaged; the formal W1 dates 2026-08-01 → 2026-08-23 and the
  2026-12-21 → 2026-12-31 release window are unchanged.

## 9. Fabric W0-I07 remediation grant — 2026-07-27, fifth same-day record

Added later again on 2026-07-27 under the three-path bounded authority recorded in
`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.14, which ends with exactly one authorized
local commit of the three allowlisted paths. This section records the **fresh prospective
bounded grant** that the §8 disposition and the packet §5 preconditions require before any
future action on the paused Fabric W0-I07 tree. The worktree facts were **re-verified read-only
against the Fabric repository** on 2026-07-27; the reassessment figures are **as reported by
W0-R04A** and were not re-executed from this control worktree; no product repository was
written to. Full grant text: `docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md`; board
summary: board §1.6. The grant authorizes one future bounded writer attempt under its own
terms; it promotes nothing by itself, and no writer session was opened by this record.

### 9.1 Verified basis and recorded grant

| Item | Verified / reported state | Recorded grant |
|---|---|---|
| Fabric — W0-I07 R0 domain attempt | **re-verified 2026-07-27, read-only:** worktree `w1-i07-fabric-r0-domain-r1`, branch `codex/w1-i07-fabric-r0-domain-r1`, HEAD/base `87b4cf388038c6dd2e1a74e13f4131306a80ba92`; branch tip equals base — still no commit; exactly **30 dirty `-uall` paths, zero staged**, matching the disposition-packet §1 enumeration path-for-path — unchanged since §8.1. **As reported by W0-R04A** (fresh reassessment by the W0-R04 lane): no P0–P2; **117 targeted tests green** (supersedes the earlier `113` targeted figure, which stands in dated history); the three P3 findings re-characterized — **blocking** (idempotency `store.record`-before-outcome ordering compounded by nested returned-document aliasing), cosmetic (S105 rename of the W2F TOKEN DIGEST constant), optional (shallow-freeze docstring caveat) | prospective bounded grant recorded (grant §1–§6): grantee the same immutable task **W0-I07**; writer **Opus 5 in a brand-new session**, never resuming exhausted session `5da9e0a9`; runtime one initial 600 s cycle plus at most one healthy 600 s extension under board §15; product edits limited to **five already-dirty paths** — `src/control-plane/cybrik_fabric_control/invocation/service.py`, `tests/control-plane/test_r0_invocation_service.py`, `tests/control-plane/test_r0_invocation_security.py`, plus optional **docstring-only** caveats in `invocation/models.py`/`invocation/ports.py` — with the other 25 dirty paths read-only until staging and the dirty set held at exactly the same 30 paths; permitted behavior exactly: RED tests proving a failed post-condition leaves the store empty/key reusable and that returned-document mutation cannot affect replay, then `store.record` moved after the successful complete/validated outcome, deterministic deep copy at record and replay, the S105 rename, optional one-sentence caveats; no new paths, deletions or dependencies; writer **stops before commit**; independent Fable pre-commit review must return **GO with no P0–P2** before the same session stages exactly all 30 paths and makes **one status-honest `SCAFFOLD` local commit**; a **fresh post-commit Fable review** follows before anything counts as product evidence; exact STOP conditions in grant §6 |
| Control — this repository | `HEAD` before this record `3d79deb841c67e245cbfd1ace29a97b04ad5e339` | control validator `PASS`; `77/77` tests — re-run unchanged against the current dirty control worktree after the three documents were written; documentary consistency check only; validator and test suite **not modified**; **CI: NOT WIRED** |

### 9.2 Synthesis

- This record grants one future bounded remediation attempt and nothing else. The packet §5
  preconditions are addressed as follows: item 1 by this grant itself; item 2 by the
  brand-new-session/no-identity-reuse binding; item 3 by the explicit P3 disposition in grant
  §1 (blocking P3 must be resolved in the tree; S105 resolved by rename; shallow-freeze caveat
  dispositioned optional); item 4 by the mandated fresh post-commit review.
- **Nothing is promoted now.** The tree stays `PAUSED — UNCOMMITTED` and **not product
  evidence**; the §8 refusals within the exhausted attempt stand; the latest committed Fabric
  state remains `87b4cf3…`. Neither the W0-R04 audit nor the W0-R04A reassessment carries over
  as either of the grant's required reviews.
- No gate opens or closes: W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`, G2/G3 stay closed; W1
  integration/live shadow stays `HOLD`/`NO-GO`; `W0 COMPLETE=0` and W0 closure stays `NO-GO`.
- The queued Cyber AI W1-I06C remediation (§7, §8) remains **queued, not decided**.
- Nothing is pushed, merged or released; no dependency is installed; no secret is read; no
  status is promoted.
- The fixed roster of 48 stands with no task 49; category counts stay I 12 · T 12 · R 6 · S 5 ·
  B 5 · IR 4 · D 4.
- The pre-existing unrelated dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was preserved
  byte-for-byte untouched and unstaged; the formal W1 dates 2026-08-01 → 2026-08-23 and the
  2026-12-21 → 2026-12-31 release window are unchanged.
