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
| W1-G1 — alert-context transport-binding acceptance | `ACCEPTED — CLOSED 2026-07-27` | `ACCEPTED FOR IMPLEMENTATION` (packet v0.1.0, not stable v1/GA, `NOT IMPLEMENTED`) as the local commit `a976a205…` only, parent `4d5fb4b…`, exact 6 paths, branch tip `codex/w1-c1-transport-acceptance-r1`; static contract decision only — TR-4..TR-8 runtime evidence, an endpoint, a live capability-registry entry, a Fabric invocation grant, CI wiring and Bundle adoption each remain open; not pushed, not merged (§1.3, §14.11) |
| W1 product implementation | `HOLD` | Requires exact repo/base/path/acceptance/test/commit authority |
| W1 integration/live shadow | `HOLD` | Requires accepted contracts, product revisions and explicit integration authority |
| Routine delegated integration | `NO-GO` | Hosted enforcement and Founder delegation remain absent |
| External release | `NO-GO` | Release-register RB-001 responsible-disclosure blocker remains open |

The contract packet's historical approval-ingress forward gap also uses the string `RB-001`.
Always label it `RB-001(contract-forward-gap)` and label the release blocker
`RB-001(release-disclosure)`; they are different concerns.

### 1.1 Exact-root audit snapshot — audited 2026-07-26

This table is the **2026-07-26** audit. It stands unedited as dated history. Reviewed local product
commits landed after it, so three of its `W1/W2 implication` cells no longer describe the current
state; §1.2 records the verified 2026-07-27 state and names exactly which cells it supersedes.

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

### 1.2 Product-evidence reconciliation — 2026-07-27

Verified from live Git on 2026-07-27. Every commit, parent and path count below was read from the
product repository itself; the per-lane test, coverage and review figures are **as reported by each
product lane** and were not re-executed from this control worktree. Full record: §14.10.

Reviewed evidence advanced again **later the same day**: §1.3 records the 2026-07-27
runtime-evidence reconciliation and names exactly which cells below it supersedes. The table below
stands unedited as dated history.

| Lane | Verified current state | What it does not prove |
|---|---|---|
| Suite — W1 alert-context transport binding | local commit `4d5fb4b701f79194313975302cc0a63e0dd2a8ea`, parent `3a2c71555a423465855ffaddcb663c8b704dbfbd`, exact 18 paths, branch `codex/w1-i01-alert-context-transport-binding-r1`; status `PROPOSED — NOT ACCEPTED`; standalone validator `PASS`, `33/33` tests, `88.27%` branch coverage; final Fable review `PASS`, no open P0–P3 | static only: no acceptance, no endpoint, no capability-registry entry, no Fabric invocation grant, no runtime and no CI wiring |
| Cyber AI — W1 lifecycle producer | docs gate `e14d6312eabf2e1bc7d9d826ecff323a7c390fb7`, producer `c9530b9623c68fec3b35f63bf41720d34a28cea3` (child of the gate commit), branch `codex/w1-i05-orchestration-foundation-r1`; `611` tests, `97.46%` full coverage, service/checkpoints at 100%, `ruff`/format/`mypy` green; final reviews `PASS`, no open P0–P2; `docs/contracts/W1-C2-LIFECYCLE-MAPPING.md` remains `DRAFT` | in-process only: no transport, no database, no durability, no delivery, no attempt lineage and no TR-8 evidence |
| SOC — alert-context idempotency binding | local commit `87e95cd2add7233176ca442bb5870b5913fdd0eb`, parent `51e2106e0c7e3a4c0637ef31983cfdfe16edc0e5`, exact 7 paths, branch `codex/w1-i03-marking-floor-r1`; current offline `191` alert-context unit/contract tests `PASS` in the existing environment; independent review `PASS`, no open P0–P2 | no PostgreSQL, no RLS, no HTTP and no runtime proof; durable atomic put-if-absent/CAS remains mandatory and unimplemented |
| Fabric — W1 exchange binding | local commit `87b4cf388038c6dd2e1a74e13f4131306a80ba92`, parent `1789480be4774d014a94227bc4436357d2e4b674`, exact 3 paths, branch `codex/w0-i07b-apply-r1`; full suite `318` tests `PASS`; independent review `PASS`, no open P0–P2 | no R0 live registry entry and no invocation runtime |

**Which §1.1 implication cells this supersedes.** The SOC cell "No scoped alert-context,
`shadow_remote`, Investigation API or live bundle path" is superseded only as to scoped
alert-context *module* work, which now exists in the commit above; `shadow_remote`, the
Investigation API and a live bundle path are still absent. The Cyber AI cell "Committed branch has
5 warning-as-error failures and a P1 missing real redaction call; W1 job/runtime absent" is
superseded on the two commits above, which report `ruff`/format/`mypy` green and no open P0–P2;
it stands unchanged for canonical `281b252...`, and no W1 runtime exists on any of them. The Fabric
cell "Runtime surface is still health/version only" stands: the commit above is contract/validation
work, and no R0 registry entry or invocation runtime was added.

**Nothing here promotes anything.** These are reviewed local commits on separate branches. No
product or runtime writer is promoted by any row above, none of these commits is pushed, merged or
released, and the Suite C1, C2 and transport-binding commits remain **sibling commits that are not
integrated into one canonical root**. `W0 COMPLETE=0` and W0 closure stays `NO-GO`; W1
runtime/live-integration stays `HOLD`/`NO-GO`; **CI: NOT WIRED** for every lane above. The live
shadow blockers are unchanged: the SOC `shadow_remote` route, the Fabric R0 registry/invocation
surface, and integration authority with CI. Test evidence above is test evidence — it is not
runtime proof and does not satisfy the §11 exit criteria.

### 1.3 Runtime-evidence reconciliation — 2026-07-27, second same-day record

Verified from live Git later on 2026-07-27 under the two-path bounded authority recorded in §14.11.
Every commit, parent, path count, branch tip and worktree state below was re-read from the owning
repository; the per-lane test, coverage and review figures are **as reported by each product lane**
and were not re-executed from this control worktree. Register §6 carries the matching evidence
table.

Evidence advanced a third time later on 2026-07-27: §1.4 records the HTTP-evidence reconciliation
and names exactly which cells below it supersedes. The table below stands unedited as dated
history.

| Lane | Verified current state | What it does not prove |
|---|---|---|
| Suite — W1-C1 transport-binding acceptance (G1) | accepted local commit `a976a205601de22dae59e5112e37ae29707fda0e`, parent `4d5fb4b701f79194313975302cc0a63e0dd2a8ea`, exact 6 paths, branch tip `codex/w1-c1-transport-acceptance-r1`; flips the transport-binding packet to `ACCEPTED FOR IMPLEMENTATION` (packet v0.1.0, not stable v1/GA, `NOT IMPLEMENTED`); reported: standalone validator `PASS`, `35` tests, `88.09%` branch coverage; final independent review W0-R05 `PASS`, no open P0–P2 | **static contract decision only** — TR-4..TR-8 runtime evidence, an endpoint, a live capability-registry entry, a Fabric invocation grant, CI wiring and Bundle adoption each remain open; not pushed, not merged |
| Cyber AI — W1 relying-party composition | code commit `35ad17e39ae1c7b0d9a80b3c9a082d0e7769fa5e`, parent `c9530b9623c68fec3b35f63bf41720d34a28cea3`; reported `636` tests with `ruff`, format and `mypy` green; independent review W0-R03 `PASS` with one P2 governance finding; docs record `42133a5224d51b2c3e2cc6deccdf0d41ac831d9c`, parent `35ad17e…`, exactly 2 paths, branch tip `codex/w1-i06-relying-correlation-r1`, records that P2 closed | still **in-process only** — no HTTP transport, no durability, no bundle delivery and no Fabric tool-execution authority |
| SOC — scoped alert-context runtime | runtime commit `ff1aec3e591283ac00cb6665f3f4bb57ccb68ff6`, parent `87e95cd2add7233176ca442bb5870b5913fdd0eb`; remediation `f4d234bba09ae1bea7a63b3348be3640a701065d`, parent `ff1aec3…`, branch tip `codex/w1-i03-soc-context-runtime-r1`; independent W0-R02 review: initial P1, then re-review `PASS`. Reported real-PostgreSQL evidence at exact `f4d234b…`: PostgreSQL 16.14; runtime roles `NOBYPASSRLS`; migration 0023 single head with upgrade→downgrade→upgrade plus base roundtrip; `FORCE ROW LEVEL SECURITY`; grants limited to SELECT+INSERT; `10` focused + `58` migration/RLS + `258` alert-context + `6` temporary ASGI route probes; full backend `3016 passed` with `5` Redis skips; obtained with **no repository write** | explicit residuals stay open: the route-against-DB probe ran from `/tmp` and is **not** a permanent CI job; the org-enabled route stays inert and fail-closed; TTL enforcement and a true multi-connection race proof remain open; no `shadow_remote` and no live bundle path |
| Fabric — W0-I07 R0 domain attempt | **not a commit and not promotable**: worktree `w1-i07-fabric-r0-domain-r1` at base `87b4cf388038c6dd2e1a74e13f4131306a80ba92` remains dirty with exactly 30 authorized paths, zero staged, after the hard 1200 s timeout. The completed **W0-R04 read-only audit** finds the dirty tree **technically GREEN** — reported `388` full tests plus `113` targeted tests passing; `ruff`, format, `mypy`, `bandit` and Go checks green; no P0–P2 findings; three P3 | `PAUSED — UNCOMMITTED` under the hard-timeout policy: a technically GREEN dirty tree is **not product evidence** until it lands as a reviewed commit under its own bounded writer authority; promotes nothing; the latest committed Fabric state remains `87b4cf3…` (§1.2) |

**Which §1.2 cells this supersedes.** The Suite transport-binding cell is superseded **only as to
acceptance**: `PROPOSED — NOT ACCEPTED` became `ACCEPTED FOR IMPLEMENTATION` at `a976a205…`; every
other boundary in that cell — no endpoint, no capability-registry entry, no Fabric invocation
grant, no runtime, no CI wiring — stands. The Cyber AI cell's `611`-test figure at `c9530b9…` is
superseded by the reported `636`-test child commit above, and the P2 governance finding raised
against it is recorded closed by the two-path docs commit; the in-process-only boundary stands
unchanged. The SOC cell's "no PostgreSQL, no RLS, no HTTP and no runtime proof" is superseded
**only as far as the reported evidence reaches** — real-PostgreSQL RLS/migration proof and six
temporary ASGI route probes at `f4d234b…` — while the named residuals stay open. The §1.2 SOC
claim that a durable atomic put-if-absent/CAS "remains mandatory and unimplemented" is also
superseded: the durable atomic implementation is **committed and real-PG tested** at the commits
above; only **true multi-connection contention evidence** remains open. The Fabric cell is **not
superseded**: the I07 attempt is uncommitted — audited technically GREEN by W0-R04 but still not
product evidence — and the latest committed Fabric state remains `87b4cf3…`.

**Decision effects, recorded truthfully.** The W1-C1 transport contract gate is now
`ACCEPTED — CLOSED 2026-07-27` (§1 table, W1-G1 row) as a static contract decision. W1
integration/live shadow and the §11 W1 Investigation Spine outcome stay `HOLD`/`NO-GO`, and W0
closure stays `NO-GO` with `W0 COMPLETE=0`. The critical live-shadow blockers are now:

1. **Fabric** — a committed, independently reviewed R0 domain (the paused I07 attempt is audited
   technically GREEN but uncommitted, so it is not yet product evidence), followed later by an
   authenticated HTTP surface and a live registry entry;
2. **Cyber AI** — HTTP transport, durability and bundle delivery (G2);
3. **SOC** — the `shadow_remote` route, a permanent route-against-DB CI job and real org mapping;
4. **Canonical integration** — integration authority on one canonical root together with CI
   wiring.

Nothing in this subsection promotes any writer or gate beyond the W1-G1 row above: none of these
commits is pushed, merged or released, the dirty canonical roots stay untouched, the fixed roster
of 48 stands with no task 49, and the formal W1 dates and the 2026-12-21 → 2026-12-31 release
window are unchanged. Full bounded record: §14.11.

### 1.4 HTTP-evidence reconciliation — 2026-07-27, third same-day record

Verified from live Git later again on 2026-07-27 under the two-path bounded authority recorded in
§14.12. The commit lineage, path counts, branch tip and worktree state below were re-read from the
owning repository; the gate-review, session, test, coverage, lint and review figures are **as
reported by the lane and its independent reviewers** and were not re-executed from this control
worktree. Register §7 carries the matching evidence table.

| Lane | Verified current state | What it does not prove |
|---|---|---|
| Cyber AI — W1-I06C HTTP ingress gate and attempt | docs-only gate lineage on branch `codex/w1-i06c-http-ingress-r2`: original gate `c568045b1794eaefc34eed717c2ce94959d929a4` (parent `42133a5224d51b2c3e2cc6deccdf0d41ac831d9c`), amendment `b33b73e9aa0e873409edc858804e6898ac2302b2`, review closure `de41faa316c56740aca7e366618b3408e5c028bc`, and **gate-reopen commit `866b7db91d9352a9a0d2bd74618d642dfef0493b`** (parent `de41faa3…`, exactly 1 docs path), recorded after a prior implementation attempt's correct gate-§I.5 STOP and clean rollback to `de41faa3…`. Reported: independent Fable review of the reopened docs-only gate **GO**, no P0–P2; Opus R2 implementation session `06a2c154-50c7-4525-851c-ee9ecfd47219` ran the initial 600 s cycle plus **exactly one** healthy 600 s extension under §15, then **hard-stopped — no third cycle**. Worktree `w1-i06c-http-ingress-r2` at HEAD `866b7db9…` is dirty with **exactly the 13 gate-manifest paths, zero staged — uncommitted**. Independent **W0-R03 technical review of that dirty tree: NO-GO** — P1 static-gate failures (`ruff` 7 findings, format 4 files, `mypy` 9 errors) and P2 RED-first evidence packaging — while targeted tests report `138 passed` and the full pytest suite `696 passed` at `97.43%` coverage | `PAUSED — UNCOMMITTED` and **not product evidence**: green test counts inside a NO-GO-reviewed, uncommitted dirty tree promote nothing; the latest committed Cyber AI state is the docs-only gate lineage ending at `866b7db9…`, which contains no transport code; no HTTP transport, durability, bundle-delivery or Fabric tool-execution claim advances |

**Which §1.3 cells this supersedes.** The Cyber AI cell is superseded **only as to the latest
committed state**: after the docs record `42133a5…` (branch tip
`codex/w1-i06-relying-correlation-r1`), four docs-only gate commits ending at `866b7db9…` on
branch `codex/w1-i06c-http-ingress-r2` are now the latest committed Cyber AI state (`c568045b…`
touched the gate manifest plus `docs/operations/README.md`; the other three touch only the gate
manifest). The **in-process-only boundary stands unchanged** — no committed HTTP transport,
durability or bundle delivery exists, and the HTTP code slice exists only as the uncommitted,
NO-GO-reviewed 13-path dirty tree above. The Suite, SOC, Fabric and Control cells are **not
superseded**: the G1 acceptance at `a976a205…`, the SOC real-PostgreSQL evidence at `f4d234b…`
with its named residuals, and the Fabric W0-I07 pause (technically GREEN, `PAUSED — UNCOMMITTED`,
latest committed Fabric state `87b4cf3…`) each stand exactly as §1.3 records them.

**Decision effects, recorded truthfully.** None — this reconciliation flips no gate and promotes
no writer. Unlike the technically GREEN Fabric W0-I07 pause, this pause carries an **adverse
independent technical review outstanding** (W0-R03 `NO-GO` with open P1/P2), so any resumption
must first clear those findings, and the reopened grant was consumed by the hard stop, so
resumption also requires a fresh bounded grant. The four live-shadow blockers in §1.3 are
unchanged; W1 integration/live shadow and the §11 outcome stay `HOLD`/`NO-GO`; `W0 COMPLETE=0`
and W0 closure stays `NO-GO`; nothing is pushed, merged or released; the fixed roster of 48
stands with no task 49; and the formal W1 dates and the 2026-12-21 → 2026-12-31 release window
are unchanged. Full bounded record: §14.12.

### 1.5 Fabric W0-I07 disposition — 2026-07-27, fourth same-day record

Recorded later again on 2026-07-27 under the three-path bounded authority in §14.13, as a
**delegated coordinator decision already taken** under the Founder delegation granted to the
coordinator — not a request for a user decision. The worktree facts were re-verified live and
read-only from the Fabric repository; full packet:
`docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md`.

- **Verified:** worktree `w1-i07-fabric-r0-domain-r1` still sits at base
  `87b4cf388038c6dd2e1a74e13f4131306a80ba92` with exactly 30 dirty paths (3 tracked modified
  unstaged + 27 untracked, enumerated in the packet §1), zero staged — unchanged since §1.3.
- **Decision:** `HOLD` — the tree stays `PAUSED — UNCOMMITTED`; any commit from within the
  current exhausted logical attempt is **refused**, and any replacement writer inside that
  attempt is **refused**. The tree remains **not product evidence**; the latest committed
  Fabric state remains `87b4cf3…`.
- **Future action** requires all of: a fresh prospective bounded grant recorded before work;
  no resumption of the exhausted Claude session and no task-identity reuse or minting to evade
  the §15 timeout; resolution or explicit disposition of the three W0-R04 P3 findings; and a
  fresh independent review after any commit before the result may count as product evidence.
- **Queued, not decided:** the separate Cyber AI W1-I06C remediation (§1.4) stays queued behind
  its own fresh bounded grant.
- **Nothing else moves:** G2/G3 stay closed, W1 integration/live shadow stays `HOLD`/`NO-GO`,
  `W0 COMPLETE=0` with W0 closure `NO-GO`, the roster of 48 stands with no task 49, and all
  dates are unchanged. Full bounded record: §14.13.

### 1.6 Fabric W0-I07 remediation grant — 2026-07-27, fifth same-day record

Recorded later again on 2026-07-27 under the three-path bounded authority in §14.14, as the
**fresh prospective bounded grant** that §1.5 and the disposition packet §5 require before any
future action on the paused Fabric W0-I07 tree. Full grant text:
`docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md`.

The granted writer subsequently completed **later on 2026-07-27**: §1.7 records the resulting
local commit and its fresh post-commit review as the sixth same-day record. This section stands
unedited as dated history.

- **Verified:** worktree `w1-i07-fabric-r0-domain-r1` re-verified live and read-only — still at
  base `87b4cf388038c6dd2e1a74e13f4131306a80ba92`, branch tip equal to base, exactly 30 dirty
  `-uall` paths matching the packet §1 enumeration path-for-path, zero staged — unchanged since
  §1.5.
- **Basis, as reported:** the **W0-R04A reassessment** of the same dirty tree — no P0–P2;
  **117 targeted tests green** (supersedes the earlier `113` targeted figure; dated history
  stands); the three W0-R04 P3 findings re-characterized as one **blocking** (idempotency
  record-before-outcome ordering compounded by nested returned-document aliasing), one cosmetic
  (S105 rename of the W2F TOKEN DIGEST constant) and one optional (shallow-freeze docstring
  caveat) — the grant's §1 table is the explicit P3 disposition packet §5 item 3 requires.
- **Grant, in brief:** grantee is the same immutable task **W0-I07**; writer is **Opus 5 in a
  brand-new session** — the exhausted session `5da9e0a9` is never resumed; runtime is one
  initial 600 s cycle plus at most one healthy 600 s extension under §15; product edits are
  limited to **five already-dirty paths** (`invocation/service.py`, the two
  `test_r0_invocation_*` test files, and optional **docstring-only** caveats in
  `invocation/models.py`/`invocation/ports.py`); permitted behavior is exactly RED-first tests
  proving a failed post-condition leaves the store empty/key reusable and that returned-document
  mutation cannot affect replay, then moving `store.record` after the successful
  complete/validated outcome with deterministic deep copy at record and replay, the S105 rename,
  and the optional one-sentence caveats; the other 25 dirty paths stay read-only until staging
  and the dirty set must remain exactly the same 30 paths; the writer **stops before commit**
  for an independent Fable pre-commit review, and only after **GO with no P0–P2** may the same
  new session stage exactly all 30 paths and make one status-honest `SCAFFOLD` local commit,
  followed by a **fresh post-commit Fable review** before anything counts as product evidence.
- **Nothing moves on this grant alone:** the tree stays `PAUSED — UNCOMMITTED` and not product
  evidence until the writer completes under the grant and both reviews pass; no push, merge,
  release or install; G2/G3 stay closed, W1 integration/live shadow stays `HOLD`/`NO-GO`,
  `W0 COMPLETE=0` with W0 closure `NO-GO`, the roster of 48 stands with no task 49, and all
  dates are unchanged. Full bounded record: §14.14.

### 1.7 Fabric W0-I07 post-commit evidence — 2026-07-27, sixth same-day record

Recorded later again on 2026-07-27 under the three-path bounded authority in §14.15. The
granted W0-I07 remediation writer completed under the §1.6 grant, and the mandated fresh
post-commit review has reported. Commit facts were re-verified live and read-only from the
Fabric repository; review and execution figures are **as reported**. Full record:
`docs/operations/W1-I07-FABRIC-POST-COMMIT-EVIDENCE.md`.

- **Verified:** local Fabric commit `d38f910a44d6454285b393cb89df4a6ade4eb855`, parent
  `87b4cf388038c6dd2e1a74e13f4131306a80ba92` (the exact grant base), subject
  `feat(control-plane): scaffold W1 R0 invocation domain`, branch tip
  `codex/w1-i07-fabric-r0-domain-r1`; exactly the **30 paths** of the disposition-packet §1
  enumeration, now committed; working tree **clean, zero staged**; **no upstream, not pushed**.
- **Review, as reported:** fresh post-commit **W0-R04C** review — **PASS, no P0–P2**, five P3
  findings (targeted-count wording; `dataclasses.replace` factory-guard bypass; TR-4/5/7
  runtime-proof wording; `request_id` excluded from the binding so replay carries the original
  request's correlation; validator recompilation performance) — all five open.
- **Executed evidence, as reported:** full suite `391 passed`; targeted-selection discrepancy
  recorded honestly — the writer reported `120` over six files while the post-commit re-run of
  the five changed test files yielded `116`; `mypy` strict success on `16` source files; `39`
  vendored hashes and the pinned Suite blobs exact; `bandit` zero; Go `vet`/`gofmt`/build/test
  green; pre-existing `ruff` debt outside the diff.
- **Which §1.3 cell this supersedes.** The Fabric W0-I07 cell only: `PAUSED — UNCOMMITTED`
  ended — the 30-path dirty tree landed as the reviewed commit above, and the latest committed
  Fabric state is now `d38f910…`. **Classification is strict:** the commit may count **only**
  as local, independently reviewed product evidence toward live-shadow **blocker 1** —
  unmerged, unpushed, `SCAFFOLD`/in-process; it is not runtime, transport, release or GA
  evidence. Residuals stand: TR-6 signed emitted receipt, TR-8 timing/audit, TR-4/5/7 runtime
  proof, durable idempotency/concurrency, and no HTTP/MCP/registry/sandbox/broker/database.
- **Decision effects, recorded truthfully:** live-shadow **blocker 1 is locally resolved
  only**; blockers 2–4 (Cyber AI G2 transport/durability/delivery; SOC `shadow_remote`/CI/org
  mapping; canonical integration with CI) stand open, so **W1 integration/live shadow stays
  `HOLD`/`NO-GO`**. G2/G3 stay closed, `W0 COMPLETE=0` with W0 closure `NO-GO`, the roster of
  48 stands with no task 49, and all dates are unchanged. Full bounded record: §14.15.

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
| W0-I06 | Cyber AI investigation producer and W2-D/W2-F relying-party composition | Cyber AI API/worker | `HOLD` on lifecycle/transport contracts and runtime trust gates; the bounded W1-I06C HTTP ingress attempt in worktree `w1-i06c-http-ingress-r2` (gate reopened at `866b7db9…`) is `PAUSED — UNCOMMITTED` after the §15 hard stop and is reviewed **NO-GO** by W0-R03 (P1 static gates, P2 evidence packaging) — **not** product evidence (§1.4) |
| W0-I07 | Fabric R0 registry/invocation for `soc.get_alert_context` | Fabric control plane | `HOLD` on product runtime authority; the bounded R0 domain attempt in worktree `w1-i07-fabric-r0-domain-r1` (base `87b4cf3…`) is `PAUSED — UNCOMMITTED` under the hard-timeout policy — audited technically GREEN by the W0-R04 read-only audit but **not** product evidence until committed and reviewed (§1.3). The former "`HOLD` on W0-I01" wording in this row was removed only because that dependency was **discharged** — W1-C1 accepted 2026-07-26 and W1-G1 closed 2026-07-27 — not because it was erased historically (§14.12.4). Disposition recorded 2026-07-27 (§1.5, §14.13, `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md`): `HOLD` — commit and replacement writer **refused** for the exhausted attempt; future action needs a fresh prospective bounded grant, resolution or explicit disposition of the three W0-R04 P3 findings, and a fresh post-commit independent review. That fresh prospective bounded grant was recorded later on 2026-07-27 (§1.6, §14.14, `docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md`), based on the W0-R04A reassessment, with the P3 disposition inside it. The granted writer then **completed** later on 2026-07-27: local commit `d38f910…` (parent `87b4cf3…`, exactly the 30 paths, clean tree, no upstream) with fresh post-commit review **W0-R04C `PASS`, no P0–P2, five P3** — countable **only** as local, independently reviewed, unmerged/unpushed `SCAFFOLD` product evidence toward live-shadow blocker 1 (§1.7, §14.15, `docs/operations/W1-I07-FABRIC-POST-COMMIT-EVIDENCE.md`); the admission stays `HOLD` on product runtime authority and no runtime, transport, registry or HTTP claim advances |
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
| W0-R03 | Cyber AI state/model/runtime correctness review | `ACTIVE READ-ONLY`; completed the 2026-07-27 technical review of the paused W1-I06C HTTP dirty tree — **NO-GO**: P1 static-gate failures (`ruff` 7 findings, format 4 files, `mypy` 9 errors) and P2 RED-first evidence packaging, while targeted `138` and full `696` tests pass at `97.43%` coverage; still **not** product evidence (§1.4) |
| W0-R04 | Fabric control-plane/executor/trust-boundary review | `ACTIVE READ-ONLY`; completed the 2026-07-27 read-only audit of the paused W0-I07 worktree — technically GREEN, no P0–P2, three P3, still **not** product evidence (§1.3); that audit result now feeds the recorded W0-I07 disposition (§1.5, `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md`), and it does **not** carry over as the fresh post-commit review any future grant requires; the lane's later **W0-R04A reassessment** of the same dirty tree (no P0–P2, `117` targeted green, three P3 re-characterized: one blocking, one cosmetic, one optional) is the reported basis of the 2026-07-27 remediation grant (§1.6, `docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md`) and likewise does **not** carry over as either of that grant's required reviews; the lane's fresh post-commit **W0-R04C** review of the resulting commit `d38f910…` — **PASS, no P0–P2, five P3** — is recorded 2026-07-27 (§1.7, §14.15, `docs/operations/W1-I07-FABRIC-POST-COMMIT-EVIDENCE.md`) |
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

### 14.10 W1-D04 product-evidence reconciliation record — docs-only, no status flip

Recorded on **2026-07-27** under **Founder-delegated current-thread authority** scoped to
documentation only. Owner: logical task **W0-D02** (claim-to-evidence ledger and
live-vs-offline wording guard). This section records reviewed local **product** commits as
evidence, corrects control wording that had gone stale against them, and does nothing else: it
accepts no packet, flips no ADR or contract status, promotes no gate in §1, opens no product or
runtime writer, and creates no task identity.

#### 14.10.1 Exact write allowlist — two paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 2 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |

Everything else is outside this allowlist and was not edited: all of `tools/operations/`
(including `validate-w1-control.mjs` and its test suite), all of `contracts/`, all of `docs/adr/`,
`docs/operations/README.md`, `docs/README.md`, the root `README.md` and
`docs/strategy/06-ROADMAP-2026-2029.md`. That roadmap file carries a **pre-existing, unrelated
dirty working-copy edit** which was left exactly as found; its fixed release dates are unchanged.
No path was added, renamed, staged, committed, merged, pushed or deleted, and no product
repository was written to — every product fact below was **read** from live Git.

**Allowlist history, in order.** §14.1 eight docs-only paths → §14.4.1 five paths → §14.5.1 seven
docs-only paths → §14.6.1 twelve paths → §14.7.1 nineteen paths → §14.8.1 nine docs-only paths →
§14.9.1 eight paths → §14.10.1 two docs-only paths (this record). Each set was bounded separately;
none widened an earlier one, and every earlier record stands unedited as provenance.

#### 14.10.2 Verified product-commit evidence — 2026-07-27

Commits, parents, path counts and branch containment were verified directly against each product
repository. The test, coverage and review figures are **as reported by each product lane**; they
were not re-executed from this control worktree, and no product dependency, database, container or
network was reached to obtain them.

| Lane | Commit and parent, verified | Reported lane evidence | Scope boundary, verified |
|---|---|---|---|
| Suite W1 alert-context transport binding | `4d5fb4b701f79194313975302cc0a63e0dd2a8ea`, parent `3a2c71555a423465855ffaddcb663c8b704dbfbd`, exact 18 paths, branch `codex/w1-i01-alert-context-transport-binding-r1` | validator `PASS`; `33/33` tests; `88.27%` branch coverage; final Fable review `PASS`, no open P0–P3 | packet manifest records `PROPOSED — NOT ACCEPTED`; **static only** — no endpoint, no capability-registry entry, no Fabric invocation grant, no runtime, no CI wiring and no acceptance |
| Cyber AI W1 lifecycle producer | docs gate `e14d6312eabf2e1bc7d9d826ecff323a7c390fb7`; producer `c9530b9623c68fec3b35f63bf41720d34a28cea3`, whose parent is that gate commit; branch `codex/w1-i05-orchestration-foundation-r1` | `611` tests; `97.46%` full coverage with service and checkpoints at 100%; `ruff`, format and `mypy` green; final reviews `PASS`, no open P0–P2 | `docs/contracts/W1-C2-LIFECYCLE-MAPPING.md` remains `DRAFT`; **in-process only** — no transport, database, durability, delivery or attempt lineage, and no TR-8 evidence |
| SOC alert-context idempotency binding | `87e95cd2add7233176ca442bb5870b5913fdd0eb`, parent `51e2106e0c7e3a4c0637ef31983cfdfe16edc0e5`, exact 7 paths, branch `codex/w1-i03-marking-floor-r1` | current offline `191` alert-context unit/contract tests `PASS` in the existing environment; independent review `PASS`, no open P0–P2 | explicitly **no PostgreSQL, no RLS, no HTTP and no runtime proof**; a durable atomic put-if-absent/CAS remains mandatory and is not implemented |
| Fabric W1 exchange binding | `87b4cf388038c6dd2e1a74e13f4131306a80ba92`, parent `1789480be4774d014a94227bc4436357d2e4b674`, exact 3 paths, branch `codex/w0-i07b-apply-r1` | full suite `318` tests `PASS`; independent review `PASS`, no open P0–P2 | no R0 live registry entry and no invocation runtime yet |

Each of the four lanes lives on its **own branch**; none is pushed, merged or released, and the
Suite C1, C2 and transport-binding commits are still sibling commits that have not been integrated
into one canonical root.

#### 14.10.3 Control-side measured evidence — 2026-07-27

Control `HEAD` before this reconciliation: `b8181ff8389a58f0ca61011006d1469a27c1d5b6`. Commands run
manually from this worktree root against the current — deliberately dirty — control tree:

| Command | Measured result |
|---|---|
| `node tools/operations/validate-w1-control.mjs` | **PASS** — `tasks=48`, `categories={"I":12,"T":12,"R":6,"S":5,"B":5,"IR":4,"D":4}`, `GATE_A4={"H":11,"J":10}`, `CONTRACT_GATE={"C1":10,"C2":10}` |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0` |
| `node --test --experimental-test-coverage tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0`; `validate-w1-control.mjs` branch `92.93%` |

The validator and its test suite were **not modified** by this reconciliation; both were re-run
unchanged after the two documents above were edited. All three commands are **manual** and
**static/documentary only** — **CI: NOT WIRED** for every one of them, and no CI result is claimed.

#### 14.10.4 What this reconciliation corrected

- §1.1 is now dated as the **2026-07-26** audit snapshot and its rows stand unedited as history.
- §1.2 records the verified 2026-07-27 state and names exactly which §1.1 implication cells it
  supersedes: the SOC cell only as to scoped alert-context module work, and the Cyber AI
  warning-as-error/redaction cell only on the two commits named above. The Fabric
  health/version-only cell is **not** superseded, and every "W1 runtime absent" statement stands.
- The evidence register gained the matching dated product-evidence section and the eighth row of
  its bounded-authority table.

#### 14.10.5 What this reconciliation did not change and did not grant

- **No implementation, Git or release authority.** Nothing was staged, committed, merged, pushed,
  deployed or released; no branch or remote was created or configured; no dependency was installed;
  no database, container, microVM, netns or broker was started; no network was reached; no
  formatter or auto-fixer was run; and no product repository was written to.
- No status flip, no contract acceptance, no gate promotion in §1. GATE A4 stays
  `ACCEPTED — CLOSED 2026-07-26`, the W1-C1/C2 contract gate stays `ACCEPTED — CLOSED 2026-07-26`,
  and all four applications stay `APPLIED 2026-07-26`. The Suite transport-binding packet stays
  `PROPOSED — NOT ACCEPTED`.
- **No product writer is promoted by any row in §1.2 or §14.10.2.** Reviewed local product commits
  are evidence, not authority; each future writer still requires one repo, an explicit base SHA, an
  isolated worktree, an exact allowlist, a collision map, a RED/acceptance command and a named
  reviewer.
- **Test evidence is not runtime proof.** Offline suites, in-process producers, contract validators
  and static packets do not demonstrate the live SOC→AI→Fabric→SOC path, and the §11 exit criteria
  are unmet.
- The 48 immutable task identities are unchanged; category counts stay I 12 · T 12 · R 6 · S 5 ·
  B 5 · IR 4 · D 4; no task 49 exists and no replacement identity was created.
- `W0 COMPLETE=0` and W0 closure `NO-GO`; W1 product implementation and integration/live shadow
  `HOLD`; W1 runtime writers, delegated routine integration and external release `NO-GO`.
- The live-shadow blockers are unchanged and remain open: the SOC `shadow_remote` route, the Fabric
  R0 registry/invocation surface, and integration authority together with CI wiring.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31 release
  window are unchanged; the pre-existing dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was
  preserved untouched.
- Both accepted local contract commits remain unpushed, unmerged and unreleased; Bundle v0.1.1
  remains a proposed successor and v0.1.0 remains the authoritative Bundle contract.
- The §14.8.3 wording residual stays **open** for the files listed there; this record opened no
  authority over any of them.

### 14.11 W1-D04 runtime-evidence reconciliation record — docs-only, one bounded local commit

Recorded on **2026-07-27**, later the same day as §14.10, under **coordinator-delegated Founder
authority** scoped to documentation and **exactly one bounded local commit**. Owner: logical task
**W0-D02** (claim-to-evidence ledger and live-vs-offline wording guard). The task ran as one
logical session with **one** bounded 600-second extension under §15, granted on evidenced progress
(new bytes inside the allowlist) and used to incorporate the completed W0-R04 Fabric audit; no
second extension was requested. This section records the 2026-07-27 W1-C1 transport-binding
acceptance as an already-taken lifecycle decision, records reviewed product runtime-adjacent
evidence, marks the paused Fabric W0-I07 attempt as non-evidence, and corrects control wording
that had gone stale against all of it. It accepts nothing itself, flips no other status, promotes
no writer, and creates no task identity.

#### 14.11.1 Exact write allowlist — two paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 2 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |

Everything else is outside this allowlist and was not edited: all of `tools/operations/`
(including `validate-w1-control.mjs` and its test suite), all of `contracts/`, all of `docs/adr/`,
`docs/operations/README.md`, `docs/README.md`, the root `README.md` and
`docs/strategy/06-ROADMAP-2026-2029.md`. That roadmap file still carries its **pre-existing,
unrelated dirty working-copy edit**, which was left exactly as found and was **not staged**; its
fixed release dates are unchanged. No path was added, renamed, merged, pushed or deleted, and no
product repository was written to.

Unlike §14.1–§14.10, this authority ends with **exactly one authorized local commit** of the two
allowlisted paths in this control worktree — subject `docs(control): reconcile W1 runtime
evidence` — and nothing else: no push, no merge, no remote change, no release, no dependency
install, no formatter.

**Allowlist history, in order.** §14.1 eight docs-only paths → §14.4.1 five paths → §14.5.1 seven
docs-only paths → §14.6.1 twelve paths → §14.7.1 nineteen paths → §14.8.1 nine docs-only paths →
§14.9.1 eight paths → §14.10.1 two docs-only paths → §14.11.1 two docs-only paths (this record).
Each set was bounded separately; none widened an earlier one, and every earlier record stands
unedited as provenance.

#### 14.11.2 Verified evidence — 2026-07-27

Commits, parents, path counts, branch tips and the Fabric worktree state below were **verified
from live Git** on 2026-07-27 from this session; the test, coverage, lint and review figures are
**as reported by each lane** and were not re-executed from this control worktree. The full
per-lane table is §1.3; register §6 carries the matching evidence table.

- **Suite — W1-C1 transport binding (G1).** Local commit
  `a976a205601de22dae59e5112e37ae29707fda0e`, parent `4d5fb4b701f79194313975302cc0a63e0dd2a8ea`,
  exact 6 paths, branch tip `codex/w1-c1-transport-acceptance-r1`, flips the packet to
  `ACCEPTED FOR IMPLEMENTATION` (packet v0.1.0, not stable v1/GA, `NOT IMPLEMENTED`); reported:
  standalone validator `PASS`, `35` tests, `88.09%` branch coverage; final independent review
  W0-R05 `PASS`, no open P0–P2. Static contract decision only — TR-4..TR-8 runtime evidence,
  endpoint, live registry, Fabric invocation grant, CI wiring and Bundle adoption remain open.
- **Cyber AI.** Code commit `35ad17e39ae1c7b0d9a80b3c9a082d0e7769fa5e`, parent
  `c9530b9623c68fec3b35f63bf41720d34a28cea3`; reported `636` tests with `ruff`, format and `mypy`
  green; independent review W0-R03 `PASS` with one P2 governance finding; docs record
  `42133a5224d51b2c3e2cc6deccdf0d41ac831d9c`, parent `35ad17e…`, exactly 2 paths, branch tip
  `codex/w1-i06-relying-correlation-r1`, records that P2 closed. Still in-process only.
- **SOC.** Runtime commit `ff1aec3e591283ac00cb6665f3f4bb57ccb68ff6`, parent
  `87e95cd2add7233176ca442bb5870b5913fdd0eb`, plus remediation
  `f4d234bba09ae1bea7a63b3348be3640a701065d`, parent `ff1aec3…`, branch tip
  `codex/w1-i03-soc-context-runtime-r1`; W0-R02 initial P1, then re-review `PASS`; reported
  real-PostgreSQL evidence at `f4d234b…` as itemized in §1.3, obtained with no repository write.
  The durable atomic put-if-absent implementation is committed and real-PG tested; only true
  multi-connection contention evidence remains open, alongside the other §1.3 residuals.
- **Fabric — W0-I07 attempt.** Not a commit: worktree `w1-i07-fabric-r0-domain-r1` dirty at base
  `87b4cf388038c6dd2e1a74e13f4131306a80ba92` with exactly 30 authorized paths, zero staged, after
  the hard 1200 s timeout. The completed W0-R04 read-only audit reports the dirty tree technically
  GREEN — `388` full tests plus `113` targeted, `ruff`/format/`mypy`/`bandit`/Go green, no P0–P2,
  three P3 — and it stays `PAUSED — UNCOMMITTED` and **not product evidence** under the
  hard-timeout policy until it lands as a reviewed commit under its own bounded writer authority.

#### 14.11.3 Control-side measured evidence — 2026-07-27

Control `HEAD` before this reconciliation: `2cb80c7052534304f616a8c6db2a49553b92132b`. Commands run
manually from this worktree root against the current — deliberately dirty — control tree after the
two documents were edited:

| Command | Measured result |
|---|---|
| `node tools/operations/validate-w1-control.mjs` | **PASS** — `tasks=48`, `categories={"I":12,"T":12,"R":6,"S":5,"B":5,"IR":4,"D":4}`, `GATE_A4={"H":11,"J":10}`, `CONTRACT_GATE={"C1":10,"C2":10}` |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0` |
| `node --test --experimental-test-coverage tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0`; `validate-w1-control.mjs` branch `92.93%` |

The validator and its test suite were **not modified** by this reconciliation; all three commands
are **manual** and **static/documentary only** — **CI: NOT WIRED** for every one of them, and no
CI result is claimed.

#### 14.11.4 What this reconciliation corrected

- The §1 gate table gained the dated W1-G1 row recording the 2026-07-27 transport-binding
  acceptance; no other §1 disposition moved.
- §1.2 is marked as the earlier same-day snapshot and stands unedited; the new §1.3 records the
  verified later state and names exactly which §1.2 cells it supersedes — including withdrawing
  the stale claim that the SOC durable atomic put-if-absent/CAS is unimplemented.
- The §3 W0-I07 admission and the §5 W0-R04 assignment now carry the paused-attempt disposition:
  audited technically GREEN, `PAUSED — UNCOMMITTED`, not product evidence.
- The evidence register gained the matching header pointer, the ninth row of its
  bounded-authority table and the dated §6 runtime-evidence section.

#### 14.11.5 What this reconciliation did not change and did not grant

- Beyond the single authorized local commit named in §14.11.1, nothing was staged, committed,
  merged, pushed, deployed or released; no branch or remote was created or configured; no
  dependency was installed; no database, container, microVM, netns or broker was started; no
  formatter or auto-fixer was run; and no product repository was written to.
- No status flip beyond recording the already-taken W1-G1 transport acceptance. GATE A4 and the
  W1-C1/C2 contract gate stay `ACCEPTED — CLOSED 2026-07-26`, all four applications stay
  `APPLIED 2026-07-26`, and Bundle v0.1.1 remains a proposed successor with v0.1.0 authoritative.
- **The paused Fabric W0-I07 attempt is promoted nowhere.** A technically GREEN dirty tree under
  the hard-timeout policy is an audit observation, not product evidence, and opens no writer.
- **Test evidence is not runtime proof.** The §11 exit criteria remain unmet; the live-shadow
  blockers are exactly the four listed in §1.3.
- The 48 immutable task identities are unchanged; category counts stay I 12 · T 12 · R 6 · S 5 ·
  B 5 · IR 4 · D 4; no task 49 exists and no replacement identity was created.
- `W0 COMPLETE=0` and W0 closure `NO-GO`; W1 product implementation and integration/live shadow
  `HOLD`; W1 runtime writers, delegated routine integration and external release `NO-GO`.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31 release
  window are unchanged; the pre-existing dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was
  preserved untouched and left unstaged.
- The §14.8.3 wording residual stays **open** for the files listed there; this record opened no
  authority over any of them.

### 14.12 W0-D03 HTTP-evidence reconciliation record — docs-only, one bounded local commit

Recorded on **2026-07-27**, later the same day as §14.11, under **coordinator-delegated Founder
authority** scoped to documentation and **exactly one bounded local commit**. Owner: logical task
**W0-D03** (rolling-wave handoff/account/model-independent operations). This section records the
reopened W1-I06C HTTP ingress gate, the hard-stopped Opus R2 implementation attempt and its
adverse W0-R03 technical review as evidence, closes the prior control-review P3 on the W0-I07
admission wording transparently, and does nothing else: it accepts no packet, flips no ADR,
contract or gate status, promotes no gate in §1, opens no product or runtime writer, and creates
no task identity.

#### 14.12.1 Exact write allowlist — two paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 2 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |

Everything else is outside this allowlist and was not edited: all of `tools/operations/`
(including `validate-w1-control.mjs` and its test suite), all of `contracts/`, all of `docs/adr/`,
`docs/operations/README.md`, `docs/README.md`, the root `README.md` and
`docs/strategy/06-ROADMAP-2026-2029.md`. That roadmap file still carries its **pre-existing,
unrelated dirty working-copy edit**, which was left exactly as found and was **not staged**; its
fixed release dates are unchanged. No path was added, renamed, merged, pushed or deleted, and no
product repository was written to — every product fact below was **read** from live Git.

Like §14.11, this authority ends with **exactly one authorized local commit** of the two
allowlisted paths in this control worktree — subject `docs(control): record W1 HTTP hard stop` —
and nothing else: no push, no merge, no remote change, no release, no dependency install, no
formatter.

**Allowlist history, in order.** §14.1 eight docs-only paths → §14.4.1 five paths → §14.5.1 seven
docs-only paths → §14.6.1 twelve paths → §14.7.1 nineteen paths → §14.8.1 nine docs-only paths →
§14.9.1 eight paths → §14.10.1 two docs-only paths → §14.11.1 two docs-only paths → §14.12.1 two
docs-only paths (this record). Each set was bounded separately; none widened an earlier one, and
every earlier record stands unedited as provenance.

#### 14.12.2 Verified evidence — 2026-07-27

The commit lineage, path counts, branch tip and worktree state were **verified from live Git** on
2026-07-27 from this session; the gate-review, session, test, coverage, lint and review figures
are **as reported by the lane and its independent reviewers** and were not re-executed from this
control worktree. The full per-lane table is §1.4; register §7 carries the matching evidence
table.

- **Gate reopen, verified.** After a prior implementation attempt's correct gate-§I.5 STOP and
  clean rollback to `de41faa316c56740aca7e366618b3408e5c028bc` (the gate's §N records both), the
  gate manifest was reopened by commit `866b7db91d9352a9a0d2bd74618d642dfef0493b`, parent
  `de41faa3…`, touching exactly one docs path
  (`docs/operations/W1-I06C-HTTP-INGRESS-GATE.md`), widening the manifest to exactly thirteen
  paths, on branch `codex/w1-i06c-http-ingress-r2` in `cybrik-cyber-ai-platform`.
- **Gate review, as reported.** An independent Fable review of the reopened docs-only gate
  returned **GO** with no P0–P2 findings. That review covered the gate record, not the later
  code slice.
- **Implementation attempt, as reported.** The Opus R2 session
  `06a2c154-50c7-4525-851c-ee9ecfd47219` ran the initial 600 s cycle plus **exactly one**
  healthy 600 s extension under §15 — granted on evidenced progress — and was then
  **hard-stopped with no third cycle** requested or granted, exactly as §15 requires.
- **Resulting tree, verified.** Worktree `w1-i06c-http-ingress-r2` at HEAD `866b7db9…` is dirty
  with **exactly the thirteen gate-manifest paths, zero staged — unstaged and uncommitted**.
- **Technical review, as reported.** The independent **W0-R03** review of that dirty tree
  returned **NO-GO**: **P1** static-gate failures — `ruff` 7 findings, format 4 files, `mypy` 9
  errors — and **P2** RED-first evidence packaging. In the same tree, targeted tests report
  `138 passed` and the full pytest suite `696 passed` at `97.43%` coverage. The disposition is
  `PAUSED — UNCOMMITTED`, and the tree is **not product evidence**: green test counts alongside
  failing static gates in an uncommitted, NO-GO-reviewed tree promote nothing.

#### 14.12.3 Control-side measured evidence — 2026-07-27

Control `HEAD` before this reconciliation: `214c87ad383499ae2b0408e4b98c0da6f9555d13`. Commands
run manually from this worktree root against the current — deliberately dirty — control tree
after the two documents were edited:

| Command | Measured result |
|---|---|
| `node tools/operations/validate-w1-control.mjs` | **PASS** — `tasks=48`, `categories={"I":12,"T":12,"R":6,"S":5,"B":5,"IR":4,"D":4}`, `GATE_A4={"H":11,"J":10}`, `CONTRACT_GATE={"C1":10,"C2":10}` |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0` |
| `node --test --experimental-test-coverage tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0`; `validate-w1-control.mjs` branch `92.93%` |

The validator and its test suite were **not modified** by this reconciliation; all three commands
are **manual** and **static/documentary only** — **CI: NOT WIRED** for every one of them, and no
CI result is claimed.

#### 14.12.4 What this reconciliation corrected

- §1.3 is marked as the earlier same-day snapshot and stands unedited; the new §1.4 records the
  verified later state and names exactly which §1.3 cells it supersedes — the Cyber AI cell only
  as to the latest committed docs-only state, with the in-process-only boundary standing.
- The §3 W0-I06 admission and the §5 W0-R03 assignment now carry the paused-attempt disposition:
  hard-stopped under §15, `PAUSED — UNCOMMITTED`, reviewed **NO-GO** by W0-R03, not product
  evidence.
- **Prior control-review P3 — closed transparently.** Through board revisions `b8181ff…` and
  `2cb80c7…` the §3 W0-I07 row read "`HOLD` on W0-I01 and product runtime authority"; the §14.11
  edit shortened it to "`HOLD` on product runtime authority" without stating why. The truthful
  reason, now recorded in the row itself: the W0-I01 dependency was **discharged** — the W1-C1
  packet was accepted on 2026-07-26 and the W1-G1 transport-binding acceptance closed on
  2026-07-27 — it was **not** erased historically, and the superseded wording remains readable in
  the committed history at `2cb80c7…` and earlier.
- The evidence register gained the matching header pointer, the tenth row of its
  bounded-authority table and the dated §7 HTTP-evidence section.

#### 14.12.5 What this reconciliation did not change and did not grant

- Beyond the single authorized local commit named in §14.12.1, nothing was staged, committed,
  merged, pushed, deployed or released; no branch or remote was created or configured; no
  dependency was installed; no database, container, microVM, netns or broker was started; no
  formatter or auto-fixer was run; and no product repository was written to.
- **No status flip of any kind.** GATE A4 and the W1-C1/C2 contract gate stay
  `ACCEPTED — CLOSED 2026-07-26`, W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`, all four
  applications stay `APPLIED 2026-07-26`, and Bundle v0.1.1 remains a proposed successor with
  v0.1.0 authoritative.
- **The hard-stopped W1-I06C HTTP attempt is promoted nowhere.** A NO-GO-reviewed uncommitted
  dirty tree is an audit observation, not product evidence, and opens no writer; resumption
  requires clearing the W0-R03 P1/P2 findings under a fresh bounded grant.
- Earlier evidence stands exactly as recorded: the SOC real-PostgreSQL evidence at `f4d234b…`
  with its named residuals, the Cyber AI relying-party commits `35ad17e…`/`42133a5…`, the G1
  acceptance at `a976a205…`, and the Fabric W0-I07 pause — technically GREEN, hard-stopped,
  uncommitted, latest committed Fabric state `87b4cf3…`.
- **Test evidence is not runtime proof.** The §11 exit criteria remain unmet; the four
  live-shadow blockers listed in §1.3 are unchanged.
- The 48 immutable task identities are unchanged; category counts stay I 12 · T 12 · R 6 · S 5 ·
  B 5 · IR 4 · D 4; no task 49 exists and no replacement identity was created.
- `W0 COMPLETE=0` and W0 closure `NO-GO`; W1 product implementation and integration/live shadow
  `HOLD`; W1 runtime writers, delegated routine integration and external release `NO-GO`.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31 release
  window are unchanged; the pre-existing dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was
  preserved untouched and left unstaged.
- The §14.8.3 wording residual stays **open** for the files listed there; this record opened no
  authority over any of them.

### 14.13 W0-D04 Fabric W0-I07 disposition record — docs-only, one bounded local commit

Recorded on **2026-07-27**, the fourth same-day record after §14.12, under
**coordinator-delegated Founder authority** scoped to documentation and **exactly one bounded
local commit**. Owner: logical task **W0-D04** (decision-packet author). This section records
the **delegated coordinator disposition of the paused Fabric W0-I07 R0 domain attempt** — a
decision already taken under the Founder delegation granted to the coordinator, not a request —
and does nothing else: it accepts no packet, flips no ADR, contract or gate status, promotes no
gate in §1, opens no product or runtime writer, and creates no task identity.

#### 14.13.1 Exact write allowlist — three paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md` | **new** disposition packet |
| 2 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 3 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |

Everything else is outside this allowlist and was not edited: all of `tools/operations/`
(including `validate-w1-control.mjs` and its test suite), all of `contracts/`, all of
`docs/adr/`, `docs/operations/README.md`, `docs/README.md`, the root `README.md` and
`docs/strategy/06-ROADMAP-2026-2029.md`. That roadmap file still carries its **pre-existing,
unrelated dirty working-copy edit**, which was left exactly as found and was **not staged**; its
fixed release dates are unchanged. No path was added outside the allowlist, none was renamed,
merged, pushed or deleted, and no product repository was written to — every Fabric fact below
was **read** from live Git, read-only. `docs/operations/README.md` is outside this allowlist,
so its index does not yet list the new packet; that is a known, bounded residual of this record,
not an omission to be silently fixed outside a grant.

Like §14.11 and §14.12, this authority ends with **exactly one authorized local commit** of the
three allowlisted paths in this control worktree — subject
`docs(control): queue Fabric disposition` — and nothing else: no push, no merge, no remote
change, no release, no dependency install, no formatter.

**Allowlist history, in order.** §14.1 eight docs-only paths → §14.4.1 five paths → §14.5.1
seven docs-only paths → §14.6.1 twelve paths → §14.7.1 nineteen paths → §14.8.1 nine docs-only
paths → §14.9.1 eight paths → §14.10.1 two docs-only paths → §14.11.1 two docs-only paths →
§14.12.1 two docs-only paths → §14.13.1 three docs-only paths (this record). Each set was
bounded separately; none widened an earlier one, and every earlier record stands unedited as
provenance.

#### 14.13.2 Verified evidence — 2026-07-27, re-read live

Re-verified read-only from the Fabric repository on 2026-07-27 from this session; the audit
figures are **as reported by W0-R04** and were not re-executed from this control worktree.

- **Worktree state, verified.** `w1-i07-fabric-r0-domain-r1`, branch
  `codex/w1-i07-fabric-r0-domain-r1`, HEAD/base `87b4cf388038c6dd2e1a74e13f4131306a80ba92`
  (parent `1789480be4774d014a94227bc4436357d2e4b674`); the branch tip equals the base — the
  attempt produced **no commit**. Dirty with exactly **30 paths, zero staged** — 3 tracked
  modified unstaged plus 27 untracked, enumerated in the packet §1 — matching §1.3/§14.11.2
  byte-for-byte in count and identity; the tree has not drifted since that record.
- **Audit, as reported.** The completed W0-R04 read-only audit: technically GREEN — `388` full
  plus `113` targeted tests passing; `ruff`, format, `mypy`, `bandit` and Go checks green; no
  P0–P2; **three P3**, recorded in control docs by count and severity only, itemized content
  held by the W0-R04 lane report; unresolved and undispositioned at this record.
- **Timeout history, as recorded.** The attempt ran to the hard 1200 s timeout (§1.3/§14.11.2),
  consistent with the §15 ceiling of one initial 600 s cycle plus one and only one 600 s
  extension; the logical attempt's runtime grant is consumed.

#### 14.13.3 Disposition recorded

The full decision text is `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md` §4–§7; §1.5
carries the board summary. In brief: `HOLD`; commit and replacement writer **refused** within
the exhausted logical attempt; the tree stays `PAUSED — UNCOMMITTED` and **not product
evidence**; any future action requires a fresh prospective bounded grant recorded before work,
no resumption of the exhausted Claude session, no task-identity reuse or minting to evade the
§15 timeout, resolution or explicit disposition of the three W0-R04 P3 findings, and a fresh
independent review after any commit; the separate Cyber AI W1-I06C remediation is queued, not
decided.

#### 14.13.4 Control-side measured evidence — 2026-07-27

Control `HEAD` before this record: `b0e21cbfc1ca25e96243835c6b3f443ed032d331`. Commands run
manually from this worktree root against the current — deliberately dirty — control tree after
the three documents were written:

| Command | Measured result |
|---|---|
| `node tools/operations/validate-w1-control.mjs` | **PASS** — `tasks=48`, `categories={"I":12,"T":12,"R":6,"S":5,"B":5,"IR":4,"D":4}`, `GATE_A4={"H":11,"J":10}`, `CONTRACT_GATE={"C1":10,"C2":10}` |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0` |

The validator and its test suite were **not modified** by this record; both commands are
**manual** and **static/documentary only** — **CI: NOT WIRED** for both, and no CI result is
claimed.

#### 14.13.5 What this record did not change and did not grant

- Beyond the single authorized local commit named in §14.13.1, nothing was staged, committed,
  merged, pushed, deployed or released; no branch or remote was created or configured; no
  dependency was installed; no database, container, microVM, netns or broker was started; no
  formatter or auto-fixer was run; and no product repository was written to.
- **No status flip of any kind.** GATE A4 and the W1-C1/C2 contract gate stay
  `ACCEPTED — CLOSED 2026-07-26`, W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`, and G2/G3 stay
  closed — no gate beyond W1-G1 opens or advances.
- **The paused Fabric W0-I07 attempt is promoted nowhere and its refusals are effective now:**
  no commit and no replacement writer inside the exhausted attempt. The technically GREEN audit
  remains an observation about an uncommitted dirty tree, not product evidence.
- The queued Cyber AI W1-I06C remediation is **queued only** — nothing about it is decided,
  granted or scheduled by this record.
- W1 product implementation and integration/live shadow stay `HOLD`; W1 runtime writers,
  delegated routine integration and external release stay `NO-GO`; `W0 COMPLETE=0` and W0
  closure `NO-GO`; the §11 exit criteria remain unmet and the four live-shadow blockers in
  §1.3 are unchanged.
- The 48 immutable task identities are unchanged; category counts stay I 12 · T 12 · R 6 ·
  S 5 · B 5 · IR 4 · D 4; no task 49 exists and no replacement identity was created.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31
  release window are unchanged; the pre-existing dirty edit in
  `docs/strategy/06-ROADMAP-2026-2029.md` was preserved untouched and left unstaged.
- The §14.8.3 wording residual stays **open**, and the `docs/operations/README.md` index
  residual named in §14.13.1 is recorded, not fixed; this record opened no authority over
  either.

### 14.14 W0-D04 Fabric W0-I07 remediation-grant record — docs-only, one bounded local commit

Recorded on **2026-07-27**, the fifth same-day record after §14.13, under
**coordinator-delegated Founder authority** scoped to documentation and **exactly one bounded
local commit**. Owner: logical task **W0-D04** (prospective-grant author). This section records
the **fresh prospective bounded grant for the Fabric W0-I07 remediation** — the grant that
§1.5/§14.13 and the disposition packet §5 require before any future action on the paused tree —
and does nothing else: it accepts no packet, flips no ADR, contract or gate status, promotes no
gate in §1, opens no product or runtime writer **now** (the granted writer runs later, only
under the grant's own terms), and creates no task identity.

#### 14.14.1 Exact write allowlist — three paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md` | **new** prospective grant |
| 2 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 3 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |

Everything else is outside this allowlist and was not edited: all of `tools/operations/`
(including `validate-w1-control.mjs` and its test suite), all of `contracts/`, all of
`docs/adr/`, `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md`,
`docs/operations/README.md`, `docs/README.md`, the root `README.md` and
`docs/strategy/06-ROADMAP-2026-2029.md`. That roadmap file still carries its **pre-existing,
unrelated dirty working-copy edit**, which was left exactly as found — byte-for-byte — and was
**not staged**; its fixed release dates are unchanged. No path was added outside the allowlist,
none was renamed, merged, pushed or deleted, and no product repository was written to — every
Fabric fact below was **read** from live Git, read-only. `docs/operations/README.md` is outside
this allowlist, so its index lists neither the disposition packet nor the new grant; that
remains a known, bounded residual, recorded and not silently fixed outside a grant.

Like §14.11–§14.13, this authority ends with **exactly one authorized local commit** of the
three allowlisted paths in this control worktree — subject
`docs(control): grant Fabric R0 remediation` — and nothing else: no push, no merge, no remote
change, no release, no dependency install, no formatter.

**Allowlist history, in order.** §14.1 eight docs-only paths → §14.4.1 five paths → §14.5.1
seven docs-only paths → §14.6.1 twelve paths → §14.7.1 nineteen paths → §14.8.1 nine docs-only
paths → §14.9.1 eight paths → §14.10.1 two docs-only paths → §14.11.1 two docs-only paths →
§14.12.1 two docs-only paths → §14.13.1 three docs-only paths → §14.14.1 three docs-only paths
(this record). Each set was bounded separately; none widened an earlier one, and every earlier
record stands unedited as provenance.

#### 14.14.2 Basis evidence — 2026-07-27, worktree re-read live; reassessment as reported

- **Worktree state, verified.** `w1-i07-fabric-r0-domain-r1`, branch
  `codex/w1-i07-fabric-r0-domain-r1`, HEAD/base `87b4cf388038c6dd2e1a74e13f4131306a80ba92`;
  branch tip equals base — still no commit on the attempt. Dirty with exactly **30 `-uall`
  paths, zero staged**, compared path-for-path against the disposition-packet §1 enumeration —
  the tree has not drifted since §14.13.2.
- **Reassessment, as reported.** The **W0-R04A reassessment** by the W0-R04 review lane, not
  re-executed from this control worktree: no P0–P2; **117 targeted tests green** (supersedes
  the earlier `113` targeted figure, which stands in dated history); the three W0-R04 P3
  findings re-characterized — **blocking**: idempotency `store.record`-before-outcome ordering
  compounded by nested returned-document aliasing; **cosmetic**: S105 rename of the W2F TOKEN
  DIGEST constant; **optional**: shallow-freeze docstring caveat.

#### 14.14.3 Grant recorded

The full grant text is `docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md`; §1.6 carries the
board summary. In brief: grantee **W0-I07** (same immutable identity); writer **Opus 5 in a
brand-new session**, never resuming exhausted session `5da9e0a9`; runtime one initial 600 s
cycle plus at most one healthy 600 s extension under §15; product edit allowlist of exactly
**five already-dirty paths** with the other 25 read-only until staging and the dirty set held
at exactly 30 paths; permitted behavior exactly RED-first post-condition/aliasing tests, the
`store.record` move after successful complete/validated outcome, deterministic deep copy at
record and replay, the S105 rename and optional one-sentence docstring caveats; writer stops
before commit; independent Fable pre-commit review must return **GO with no P0–P2** before the
same session stages exactly all 30 paths and makes one status-honest `SCAFFOLD` local commit;
a fresh post-commit Fable review follows before anything counts as product evidence. Exact
STOP conditions are enumerated in the grant §6.

#### 14.14.4 Control-side measured evidence — 2026-07-27

Control `HEAD` before this record: `3d79deb841c67e245cbfd1ace29a97b04ad5e339`. Commands run
manually from this worktree root against the current — deliberately dirty — control tree after
the three documents were written:

| Command | Measured result |
|---|---|
| `node tools/operations/validate-w1-control.mjs` | **PASS** — `tasks=48`, `categories={"I":12,"T":12,"R":6,"S":5,"B":5,"IR":4,"D":4}`, `GATE_A4={"H":11,"J":10}`, `CONTRACT_GATE={"C1":10,"C2":10}` |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0` |

The validator and its test suite were **not modified** by this record; both commands are
**manual** and **static/documentary only** — **CI: NOT WIRED** for both, and no CI result is
claimed.

#### 14.14.5 What this record did not change and did not grant

- Beyond the single authorized local commit named in §14.14.1, nothing was staged, committed,
  merged, pushed, deployed or released; no branch or remote was created or configured; no
  dependency was installed; no database, container, microVM, netns or broker was started; no
  formatter or auto-fixer was run; and no product repository was written to.
- **No status flip of any kind.** GATE A4 and the W1-C1/C2 contract gate stay
  `ACCEPTED — CLOSED 2026-07-26`, W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`, and G2/G3 stay
  closed — no gate beyond W1-G1 opens or advances.
- **The grant is prospective and promotes nothing now.** The Fabric W0-I07 tree stays
  `PAUSED — UNCOMMITTED` and not product evidence; the §1.5 refusals against the exhausted
  attempt stand — the granted writer is a **new** bounded attempt under the same immutable
  identity, and no writer session was opened by this record.
- The queued Cyber AI W1-I06C remediation remains **queued only** — nothing about it is
  decided, granted or scheduled by this record.
- W1 product implementation and integration/live shadow stay `HOLD`; W1 runtime writers,
  delegated routine integration and external release stay `NO-GO`; `W0 COMPLETE=0` and W0
  closure `NO-GO`; the §11 exit criteria remain unmet and the four live-shadow blockers in
  §1.3 are unchanged.
- The 48 immutable task identities are unchanged; category counts stay I 12 · T 12 · R 6 ·
  S 5 · B 5 · IR 4 · D 4; no task 49 exists and no replacement identity was created.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31
  release window are unchanged; the pre-existing dirty edit in
  `docs/strategy/06-ROADMAP-2026-2029.md` was preserved untouched and left unstaged.
- The §14.8.3 wording residual stays **open**, and the `docs/operations/README.md` index
  residual named in §14.13.1/§14.14.1 is recorded, not fixed; this record opened no authority
  over either.

### 14.15 W0-D04 Fabric W0-I07 post-commit evidence record — docs-only, one bounded local commit

Recorded on **2026-07-27**, the sixth same-day record after §14.14, under
**coordinator-delegated Founder authority** scoped to documentation and **exactly one bounded
local commit**. Owner: logical task **W0-D04** (evidence reconciler). This section records the
**outcome of the §14.14 remediation grant** — the granted writer's completed local Fabric
commit and its fresh post-commit W0-R04C review — and does nothing else: it accepts no packet,
flips no ADR, contract or gate status, opens no product or runtime writer, promotes nothing
beyond the strict evidence classification below, and creates no task identity.

#### 14.15.1 Exact write allowlist — three paths

| # | Path | Kind |
|---|---|---|
| 1 | `docs/operations/W1-I07-FABRIC-POST-COMMIT-EVIDENCE.md` | **new** post-commit evidence record |
| 2 | `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` | this board |
| 3 | `docs/operations/W1-E2-EVIDENCE-REGISTER.md` | evidence register |

Everything else is outside this allowlist and was not edited: all of `tools/operations/`
(including `validate-w1-control.mjs` and its test suite), all of `contracts/`, all of
`docs/adr/`, `docs/operations/W1-I07-FABRIC-DISPOSITION-PACKET.md`,
`docs/operations/W1-I07-FABRIC-REMEDIATION-GRANT.md`, `docs/operations/README.md`,
`docs/README.md`, the root `README.md` and `docs/strategy/06-ROADMAP-2026-2029.md`. That
roadmap file still carries its **pre-existing, unrelated dirty working-copy edit**, which was
left exactly as found — byte-for-byte — and was **not staged**; its fixed release dates are
unchanged. No path was added outside the allowlist, none was renamed, merged, pushed or
deleted, and no product repository was written to — every Fabric fact below was **read** from
live Git, read-only. `docs/operations/README.md` is outside this allowlist, so its index lists
neither the disposition packet, the grant, nor the new evidence record; that remains a known,
bounded residual, recorded and not silently fixed outside a grant.

Like §14.11–§14.14, this authority ends with **exactly one authorized local commit** of the
three allowlisted paths in this control worktree — subject
`docs(control): record reviewed Fabric R0 scaffold` — and nothing else: no push, no merge, no
remote change, no release, no dependency install, no formatter.

**Allowlist history, in order.** §14.1 eight docs-only paths → §14.4.1 five paths → §14.5.1
seven docs-only paths → §14.6.1 twelve paths → §14.7.1 nineteen paths → §14.8.1 nine docs-only
paths → §14.9.1 eight paths → §14.10.1 two docs-only paths → §14.11.1 two docs-only paths →
§14.12.1 two docs-only paths → §14.13.1 three docs-only paths → §14.14.1 three docs-only paths
→ §14.15.1 three docs-only paths (this record). Each set was bounded separately; none widened
an earlier one, and every earlier record stands unedited as provenance.

#### 14.15.2 Verified commit facts — 2026-07-27, re-read live, read-only

- **Commit:** `d38f910a44d6454285b393cb89df4a6ade4eb855`, subject
  `feat(control-plane): scaffold W1 R0 invocation domain` — status-honest scaffold wording.
- **Parent:** `87b4cf388038c6dd2e1a74e13f4131306a80ba92`, the exact §14.14 grant base; branch
  tip `codex/w1-i07-fabric-r0-domain-r1` equals the commit.
- **Paths:** exactly **30** (4865 insertions, 15 deletions) — the disposition-packet §1
  enumeration path-for-path, now committed.
- **Working tree:** clean, zero staged, zero untracked; the long-standing
  `PAUSED — UNCOMMITTED` state is ended by this commit.
- **Not pushed:** no upstream configured, no remote change, no push.

#### 14.15.3 Review and execution evidence — as reported

The pre-commit protocol steps (writer stop, independent pre-commit GO with no P0–P2, staging of
exactly the 30 paths) are as reported by the remediation lane. The **fresh post-commit
W0-R04C review** reports **PASS, no P0–P2**, with **five P3** findings, all open:

1. targeted-count wording (writer `120` over six files vs post-review `116` over the five
   changed test files);
2. `dataclasses.replace` factory-guard bypass;
3. TR-4/5/7 runtime-proof wording;
4. `request_id` excluded from the binding, so a replayed result carries the original request's
   correlation;
5. validator recompilation performance.

Executed evidence, as reported and not re-executed here: full suite `391 passed`; the targeted
discrepancy above recorded honestly; `mypy` strict success on `16` source files; `39` vendored
hashes and pinned Suite blobs exact; `bandit` zero; Go `vet`/`gofmt`/build/test green;
pre-existing `ruff` debt outside the diff. Full record:
`docs/operations/W1-I07-FABRIC-POST-COMMIT-EVIDENCE.md`; board summary §1.7.

#### 14.15.4 Control-side measured evidence — 2026-07-27

Control `HEAD` before this record: `1220f90bd701ae0b818a3ab0049247edc8fb5fe9`. Commands run
manually from this worktree root against the current — deliberately dirty — control tree after
the three documents were written:

| Command | Measured result |
|---|---|
| `node tools/operations/validate-w1-control.mjs` | **PASS** — `tasks=48`, `categories={"I":12,"T":12,"R":6,"S":5,"B":5,"IR":4,"D":4}`, `GATE_A4={"H":11,"J":10}`, `CONTRACT_GATE={"C1":10,"C2":10}` |
| `node --test tools/operations/tests/validate-w1-control.test.mjs` | **GREEN** — `tests 77 · pass 77 · fail 0` |

The validator and its test suite were **not modified** by this record; both commands are
**manual** and **static/documentary only** — **CI: NOT WIRED** for both, and no CI result is
claimed.

#### 14.15.5 What this record did not change and did not grant

- Beyond the single authorized local commit named in §14.15.1, nothing was staged, committed,
  merged, pushed, deployed or released; no branch or remote was created or configured; no
  dependency was installed; no database, container, microVM, netns or broker was started; no
  formatter or auto-fixer was run; and no product repository was written to.
- **No status flip of any kind.** GATE A4 and the W1-C1/C2 contract gate stay
  `ACCEPTED — CLOSED 2026-07-26`, W1-G1 stays `ACCEPTED — CLOSED 2026-07-27`, and G2/G3 stay
  closed — no gate beyond W1-G1 opens or advances.
- **The evidence classification is strict and exhaustive.** The Fabric commit `d38f910…`
  counts **only** as local, independently reviewed, unmerged/unpushed `SCAFFOLD`/in-process
  product evidence toward live-shadow blocker 1, which is thereby **locally resolved only**;
  blockers 2–4 stand and W1 integration/live shadow stays `HOLD`/`NO-GO`. No runtime,
  transport, endpoint, registry, sandbox, broker, database, release or GA claim is made or may
  be derived from this record.
- The five W0-R04C P3 findings and the residual obligations (TR-6 signed emitted receipt,
  TR-8 timing/audit, TR-4/5/7 runtime proof, durable idempotency/concurrency) stay **open**
  with no remediation scheduled; the queued Cyber AI W1-I06C remediation remains **queued
  only**.
- W1 product implementation and integration/live shadow stay `HOLD`; W1 runtime writers,
  delegated routine integration and external release stay `NO-GO`; `W0 COMPLETE=0` and W0
  closure `NO-GO`; the §11 exit criteria remain unmet.
- The 48 immutable task identities are unchanged; category counts stay I 12 · T 12 · R 6 ·
  S 5 · B 5 · IR 4 · D 4; no task 49 exists and no replacement identity was created.
- W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the 2026-12-21 → 2026-12-31
  release window are unchanged; the pre-existing dirty edit in
  `docs/strategy/06-ROADMAP-2026-2029.md` was preserved untouched and left unstaged.
- The §14.8.3 wording residual stays **open**, and the `docs/operations/README.md` index
  residual named in §14.13.1–§14.15.1 is recorded, not fixed; this record opened no authority
  over either.

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
