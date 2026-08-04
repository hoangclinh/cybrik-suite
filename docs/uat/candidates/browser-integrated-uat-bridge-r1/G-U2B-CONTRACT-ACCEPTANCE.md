# G-U2B replay-state contract R1.1 acceptance

Status: `ACCEPTED — CONTRACT ONLY — OPENS BOUNDED TDD RED ONLY`.

Prepared and accepted by: delegated technical governor under the active Founder delegation.

R1.1 erratum re-accepted at: `2026-08-04T12:00:26+07:00`.

Release dates: unchanged. Runtime/demo/UAT: `HOLD`. Production authority: Founder only.

This record accepts one immutable SOC architecture proposal. It does not claim an implemented
migration, adapter, route, PostgreSQL policy, browser flow, runtime, UAT result, demo or release.
The `SUITE ACCEPTANCE PENDING` status embedded in the accepted SOC artifact describes its state
before this successor record; this record satisfies that pending gate without rewriting its bytes.

Authority instrument: `docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`, SHA-256
`55a2f094328a9cff2f2af5968a14cb4371ba8215376f3869b5f12f9108a248f7` at the Suite predecessor.
This record exercises only the instrument's technical contract-acceptance authority and
deliberately declines canonical merge, release and every Founder-only production action.

## 1. Scope and predecessor

This packet succeeds `G-U1-RED-ACCEPTANCE.md` and preserves its exact content. The predecessor is:

| Property | Exact value |
|---|---|
| Suite commit | `ef2be01f5e7f67d2b6cabf22cc02af9d9d0d600a` |
| Suite tree | `b1227935da8aee79b6572385bb4c0c5ab9ba3814` |
| Path | `docs/uat/candidates/browser-integrated-uat-bridge-r1/G-U1-RED-ACCEPTANCE.md` |
| Bytes | `17397` |
| SHA-256 | `8902ff41169aa4dc1eb97dc16b390c5762aecf4db1a7571015206b1332b55f92` |

G-U1 opened bounded G-U2 test-first work but did not resolve contradictions between the accepted
pre-target replay ordering, the proposed `0026` row and the process-local G-U2A reservation seam.
G-U2B repairs that contract before any migration or PostgreSQL adapter is written.

This decision supersedes only an implied byte-for-byte preservation requirement for the fourteen
named create/replay/hardening tests whose port contract G-U2B replaces. G-U1's substantive rule
remains: every backend RED must become satisfiable without deleting, omitting or weakening an
assertion. The fourteen tests may be re-authored only to express equivalent or stronger accepted
invariants through the new two-phase port; the unchanged status/checkpoint test and all unaffected
regressions remain byte-preservation inputs.

## 2. Accepted SOC identity

Repository: `cybrik-soc-command-center`.

| Property | Exact value |
|---|---|
| Branch | `codex/uat-browser-g-u2b-data-boundary-r1` |
| Commit | `3e1e84db1d94961a026d485cbea2a29a795851a7` |
| Tree | `c1ffb8242f1048791a476169d6c968a7cd267c73` |
| Parent | `fbad9cf95f4a8466046ca3336b36e15b812b3901` |
| Commit subject | `docs: clarify pre-bind alert mismatch state` |
| Hosted ref at acceptance | exact commit above |
| Hosted check runs / legacy statuses | `0 / 0`; no hosted-green claim |
| Proposal path | `docs/architecture/INTEGRATED-INVESTIGATION-REPLAY-STATE-G-U2B-R1.md` |
| Git blob | `c11629738b0d20cf44be4498e7252a48dfb09b75` |
| Bytes | `49436` |
| SHA-256 | `bcb33a3d6abcac4e51ea48aa1275009cc51a698e306daaebc8862be6503d8f6a` |
| Committed scope | exactly the one proposal path for the bounded R1.1 erratum |
| Worktree after commit | clean |

`git diff --cached --check` passed. `gitleaks git --staged --no-banner` scanned `2.30 KB` of staged
erratum content and reported no leaks.
The branch was pushed and `git ls-remote` resolved its hosted ref to the exact accepted commit. A
later branch tip is not accepted implicitly; the commit, tree, blob and SHA-256 above are authority.

## 3. Frozen G-U0 inputs

The coordinator re-measured these three source files at the accepted SOC bytes:

| Frozen source | SHA-256 |
|---|---|
| `ALERT-ORG-ATTRIBUTION-RLS-G-U0.md` | `121ba2e43f5687df7c7bb4c6ebda16fe65182228740df0c0a50c495726695f56` |
| `INTEGRATED-INVESTIGATION-BFF-G-U0.md` | `a75f1a7ccc33346cdb4e3bf1e7eeeef1674f1454db37ca0d20812439df2d0b56` |
| `BROWSER-INTEGRATED-UAT-G-U0.md` | `477c39992004b197137db73704961b3f6486f2c3a7484bf99995e9fae3e537a5` |

All matched their frozen identities. G-U2B supersedes only the exact statements listed in the
accepted proposal. It does not edit or silently reinterpret the remaining G-U0 surfaces.

## 4. Accepted architecture

The following decisions are normative for the next RED packet:

1. `alert_investigation_replay_keys` is a durable T0 envelope with tenant FORCE RLS, no parent-alert
   policy, no alert FK and no alert-derived owner, marking, residency, attribution, context,
   projection, receipt or upstream result identifier.
2. The T0 function atomically claims or looks up the address and compares the full prebinding before
   target access. It returns only opaque handles and never joins the binding table.
3. `session_id` is immutable first-claim audit provenance outside the frozen prebinding digest;
   otherwise-identical session rotation therefore does not create a false 409.
4. `alert_investigation_bindings` is created at T1 only after a live target read. It owns the exact
   parent alert FK, authoritative context and restrictive parent-alert tenant+org FORCE RLS.
   A requested/authoritative alert-ID mismatch before valid T1 binding follows the existing closed
   target-refusal path to binding-free `retryable`, non-disclosing 404 and no upstream call. Only
   context drift while recovering an already valid `bound` record tombstones binding plus envelope.
5. `cybrik_app` has no direct table privileges. Narrow `SECURITY DEFINER` functions require an exact
   `NOLOGIN NOBYPASSRLS` executor, `pg_catalog`-only search path, schema-qualified objects, PUBLIC
   revocation and real-role PostgreSQL proof.
6. Active claims use claim ID, epoch and state fencing. Retryable reacquisition uses state plus the
   last epoch because retryable rows deliberately have no active claim ID.
7. Expired `dispatched` state never authorizes an automatic second create. Its fail-closed seal is
   an envelope-only expired-epoch CAS, needs no target/binding visibility, never loads a tombstone
   and maps every win/loss/error outcome to the existing non-disclosing 404.
8. `sealed_dispatch_indeterminate` is reserved exclusively to the seal function. Normal T4/finalize
   paths must reject it; the deferred trigger exclusion is exact to that reason.
9. The browser port has no tombstone-load method and cannot return retained upstream identifiers.
10. The context digest defensively adds attribution digest and marking-policy version to the frozen
    owner, marking, residency and exact projected-alert JCS-content domain.
11. Automatic post-dispatch recovery remains disabled until G-U2C proves stable-token dedupe against
    the real Cyber AI internal client. A mock or prose assertion is insufficient.

The public schemas and bodies remain frozen. Conditions behind existing tokens broaden exactly as
accepted: same-prebinding live contention uses the existing retryable 503; a retained retryable
address still gives different-prebinding 409; expired-dispatched `Indeterminate` and every seal
outcome use the existing non-disclosing 404.

The accepted `0026` repair is the single normative source for its two-table replay/binding design.
The accepted `0024` responsibility is amended only by `UNIQUE (tenant_id, id)` on `alerts`, required
for composite child FKs. This is contract text, not migration authorization.

### 4.1 Accepted residuals, not solved claims

- Upstream reconciliation after an indeterminate dispatch still needs a separately governed G-U2C
  lane and real-client stable-token evidence.
- The binding parent FK uses `ON DELETE RESTRICT`; an investigated alert cannot be hard-deleted until
  a future governed evidence-retention/purge contract archives or removes the complete lineage.
- Replay-key rows are not deletable by the runtime and accumulate; retention cannot erase conflict
  history without a new reviewed contract.
- Context/marking/attribution-policy drift intentionally invalidates replay. Its availability impact
  must be measured, not relaxed silently.
- Lease duration, retention period and bounded reconciliation cadence remain undecided operational
  values. No production default is accepted here.

## 5. Review chronology

The original R1 Claude reviews used the explicit Work pool, Opus and 1DevTool. Counts are
`P0/P1/P2/P3`, not a generic severity translation. The bounded R1.1 erratum received a separate
independent Codex architecture/security re-review with `0/0/0/0`; it has no Claude run ID and is
therefore not added to the historical 1DevTool metadata JSON.

The durable metadata snapshot is `G-U2B-REVIEW-RUN-METADATA.json`, `2625` bytes, SHA-256
`523a7b55c857cb5fdbd180efd8cebff90708831a24a121dab512166ce2b0385f`. It pins each local
`meta.json` digest, duration, exit/status and output character count. 1DevTool recorded
`contentCaptured=false`; no review transcript artifact is claimed. The disposition summaries below
and repeated exact-byte reviews are the portable evidence retained by this gate.

| Run ID | Duration | Verdict | Counts |
|---|---:|---|---|
| `26e0ded8-cc71-4559-97d6-a063852c990c` | 437 s | `NO-GO` | `1/5/10/5` |
| `b7c4484a-a632-4574-999d-481ad8a70c8e` | 446 s | `NO-GO` | `0/2/6/6` |
| `ea12f0c0-bcb6-4882-a046-9e07f4d13d41` | 575 s | `NO-GO` | `0/2/4/3` |
| `ad5061b5-1d34-41e2-8944-2fcc73981ddd` | 529 s | `NO-GO` | `0/1/5/6` |
| `121d881a-65fb-4a5c-b928-972410e7b717` | 477 s | `GO` | `0/0/0/3` |
| `d11334d3-fbc2-486b-977e-d0404dbbd23a` | 164 s | focused `GO` | `0/0/0/0` |

The four NO-GO rounds caused substantive contract repairs: two-phase persistence, pre-target
non-enumeration, parent-RLS ownership, session-domain correction, closed recovery outcomes,
envelope-only indeterminate seal, exact public mapping, complete typed ports, exact supersession and
real PostgreSQL proof obligations. They were not administratively waived.

The final focused Opus review closed the remaining three proposal P3 wording/constraint findings
and introduced no new finding. An additional internal advisory review reached the same result but
had no durable run identity, so it is not counted as portable acceptance evidence.

The R1.1 re-review independently confirmed that binding-free `retryable` removes the pre-bind
alert-ID mismatch contradiction without adding a public state/token/route or weakening parent RLS.

## 6. Gate decision

Under delegated technical governor authority:

> **ACCEPT** the proposal at SOC commit
> `3e1e84db1d94961a026d485cbea2a29a795851a7`, blob
> `c11629738b0d20cf44be4498e7252a48dfb09b75`, SHA-256
> `bcb33a3d6abcac4e51ea48aa1275009cc51a698e306daaebc8862be6503d8f6a`,
> as the single normative G-U2B replay/`0026` contract repair, with `0024` amended only by
> `UNIQUE (tenant_id, id)` on `alerts`.

This acceptance satisfies the contract-repair prerequisite and opens only the exact TDD RED scope
below. It does not establish PostgreSQL/RLS behavior or `BACKEND_PROVED`.

## 7. Exact next scope

The next SOC checkpoint may change tests only:

1. add `services/api/tests/unit/copilot/test_investigation_bridge_reservation_contract.py`;
2. re-author only the fourteen create/replay/hardening tests named in proposal section 8, preserving
   the unchanged status/checkpoint test and every unaffected regression; and
3. add `services/api/tests/integration/test_investigation_bridge_bindings_pg.py` as real PostgreSQL
   RED/proof coverage for schema, FORCE RLS, grants, executor, functions, races and immutability.

The two re-authored source baselines are pinned at G-U2A commit
`1114aadd98adadb31115758c06e629537b6c9a50`, tree
`3e5f176001f70a6b1eef13f849c8e88c5be20f85`:

| Path | Git blob | Bytes | SHA-256 |
|---|---|---:|---|
| `services/api/tests/unit/copilot/test_integrated_investigation_replay.py` | `0bd51167a7a30ad2be8997880aafbd8779749696` | `12646` | `5a10ab17d2bc14e5edae2b7e3450fff2b03f516387feb6a2b652a73c9623fe98` |
| `services/api/tests/unit/copilot/test_investigation_bridge_kernel_hardening.py` | `7fb7ac997721337a0ba8dca5e00abea570ae3d91` | `16090` | `14b3ab1bb9aa2a27eb7ccc1be7f2491c670783e912d11331000c669f52321295` |

The no-DB/unit checkpoint must execute and demonstrate an intended RED caused by the missing
accepted implementation, not syntax, collection setup, unrelated dependencies or a weakened
assertion. The PostgreSQL file may be authored and statically/collection validated, but this gate
does not authorize starting or connecting to PostgreSQL; its real-role RED must execute under a
separate database-runtime grant before any migration or adapter implementation. No production code
may be changed before the applicable valid RED is observed. The RED checkpoint must be independently
reviewed and separately accepted before any GREEN implementation scope opens.

The PostgreSQL file must carry the repository's explicit DB guard (`requires_db` and the
`CYBRIK_TEST_DB` admission convention). Its permitted collection check runs with `CYBRIK_TEST_DB`
unset and must preserve evidence that no engine/connection attempt occurred; a guarded test that is
accidentally selected is a gate failure, not an acceptable environmental RED.

## 8. Not opened by this gate

This gate does not open:

- migrations `0024`–`0026`, backfill or database mutation;
- product source, route, adapter, internal-client or portal changes;
- dependency or lockfile changes, installation or upgrades;
- a listener, PostgreSQL instance, local stack, browser session or integrated runtime;
- G-U2C stable-token client work, G-U3 portal work or any later browser gate;
- merge to a canonical branch under this gate record;
- UAT, demo, POC, RC, GA, release or production activity.

The exact test-only scope in section 7 is the sole permitted SOC change beyond the already accepted
documentation commit. Production remains Founder-only even if every future non-production gate
passes.

## 9. Stop conditions

Stop and return for a new decision if:

- any accepted commit, tree, blob, byte count or SHA-256 differs;
- a frozen G-U0 identity or the Suite predecessor differs;
- either pinned G-U2A test baseline above differs before the bounded RED edit begins;
- a second normative `0026` definition is required;
- `0024` needs any amendment beyond the exact composite uniqueness above;
- RED needs product code, migration application, runtime, database startup or dependency change;
- T0 needs alert-derived content or a parent-alert policy;
- a tombstone load or second-create path appears necessary;
- the exact SECURITY DEFINER executor proof is unsatisfiable;
- a real-client stable-token dedupe prerequisite is assumed rather than proven; or
- a new P0, P1 or P2 finding appears against the accepted bytes.

On stop: preserve the exact worktree and evidence, record the failing identity, make no compensating
scope expansion and do not reinterpret HOLD as permission.

Rollback for this documentation-only, unmerged Suite record is branch-local: before any canonical
integration, abandon the branch or revert exactly the two Suite files recorded by this checkpoint.
There is no database/runtime rollback because this gate authorizes and executes neither. After any
future canonical integration, rollback requires a separately reviewed forward/revert decision that
preserves the accepted SOC artifact and predecessor evidence; it is not implicit in this packet.

## 10. Effective posture

| Surface | State after this decision |
|---|---|
| G-U2B contract | `ACCEPTED` at the immutable identity above |
| G-U2B no-DB/unit RED | `OPEN — BOUNDED TEST-ONLY; EXECUTION REQUIRED` |
| G-U2B PostgreSQL proof source | `OPEN TO AUTHOR/GUARDED-COLLECT ONLY; REAL DB RED HOLD` |
| G-U2B migration / adapter | `HOLD` |
| G-U2C | `HOLD` |
| G-U3 and later browser gates | `HOLD` |
| Runtime/demo/UAT | `HOLD` |
| Release dates | unchanged |
| Production | Founder only |
