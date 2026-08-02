# Delegated Governor Runtime/UAT Reconciliation — 2026-07-31

Status: `ACTIVE — NON-PRODUCTION RUNTIME AUTHORITY`.

Effective: `2026-07-31 07:00 Asia/Ho_Chi_Minh` (`2026-07-31 00:00 UTC`).

This is the status of a governance record. It is not a product-readiness verdict.

## 1. Decision

The Founder directives reproduced verbatim in Appendix A authorize Codex to run development
containers and local environments, maintain a local build for UAT/demo/POC, and create internal
builds or release candidates when their evidence gates pass. The later delegation also authorizes
reviewed push, canonical merge and release while reserving production to the Founder. Read
together with the objective's retained public-release boundary, `release` here means an internal
build or non-production RC; external publication, a public release tag and GA remain Founder-only.

Effective immediately:

1. The dated `2026-12-20` Founder go/no-go checkpoint for the stable v1.0/public-GA decision is
   not a prerequisite for collecting non-production runtime evidence. No separate gate identifier
   is created or used by this decision.
2. Local development stacks, non-production integration tests, `DEMO_READY_LOCAL`, controlled
   UAT/POC and internal/RC artifacts may run before `2026-12-20` after their applicable technical
   admission gates pass.
3. Opening runtime authority does not certify any build. Every profile remains `NOT PROVEN` until
   the exact build satisfies that profile's evidence contract.
4. Public GA/external-publication decisions and every production action remain Founder-controlled.

This changes execution authority only. It does not open or promote any product writer or runtime
writer; those lanes retain their separately recorded `NO-GO` or bounded implementation gates.

This decision supersedes only forward-looking statements that prohibit all runtime, local-stack,
demo or UAT activity until the dated stable-v1.0 checkpoint. Earlier packets remain immutable
historical evidence and their technical, security, scope and acceptance findings remain binding
unless separately superseded.

For forward-looking runtime authority, this record controls over contradictory present-tense or
undated blanket-prohibition wording in the following exact records:

| Earlier record | Narrow supersession |
|---|---|
| `W1-CANONICAL-STATE-RECONCILIATION-R1.md` | its forward-looking blanket runtime/local-stack/demo/UAT hold only |
| `W1-CI3-DEPENDENCY-REMEDIATION-R1.md` | its forward-looking blanket runtime/local-stack/demo/UAT hold only |
| `W1-CI4-NODE24-ACTION-PINS-R1.md` | its forward-looking blanket runtime/local-stack/demo/UAT hold only |
| `W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md` | §8 NO-GO 16 and the matching status rows only as a prohibition on future bounded non-production execution |
| `W1-BLOCKER-4-BALLOT-SUPPLEMENT-R1.md` | the matching forward-looking wait-until-stable restriction only |
| `W1-I03-PF-PERSIST-GRANT.md` and `W1-I03-PF-PERSIST-R2-EVIDENCE.md` | their matching forward-looking wait-until-stable restrictions only |
| `W1-I03-MARKING-FLOOR-R2-DECISION-PACKET.md` | its matching forward-looking no-local-stack restriction only |
| `W0-B05-INFERENCE-TRANSPORT-R3-EVIDENCE.md` | its matching forward-looking runtime/demo/UAT restriction only |
| `../adr/W1-CONTRACT-RECONCILIATION-APPLICATION.md` | its forward-looking runtime/local-stack/demo/UAT/POC/RC prohibition only |
| `../adr/FOUNDER-DECISION-PACKET-W0-IR01-CONTROLLED-INTEGRATION.md` | its matching forward-looking no-local-stack restriction only |
| the current header of `W1-48-AGENT-ROLLING-BOARD.md` | execution is replaced by the admission-gated current authority row; runtime writers remain `NO-GO` and all dated lane history is preserved |
| the current preamble of `W1-E2-EVIDENCE-REGISTER.md` | execution is replaced by the admission-gated current authority statement; runtime writers remain `NO-GO` and all dated evidence history is preserved |

Those records retain their measured evidence and historical dispositions. They no longer impose a
blanket wait-until-stable restriction on bounded non-production execution.

## 2. Dates and release contract

No roadmap date, milestone, feature contract or stable-v1.0 quality gate moves:

- W1 remains `2026-08-01 → 2026-08-23`;
- the stable-v1.0 Founder go/no-go remains `2026-12-20`;
- the published v1.0 release window remains `2026-12-21 → 2026-12-31`; and
- completing a technical gate early permits the correctly labelled non-production build or RC to
  be produced early, but does not permit it to be relabelled as stable v1.0 or GA.

## 3. Admission gate for non-production runtime

Before starting a local stack or UAT candidate, the Governor must record:

1. the exact canonical commit and tree SHA for Suite, SOC, Cyber AI and Tool Fabric;
2. required hosted CI green for the exact candidate tuple, with skipped jobs called out;
3. the reviewed contracts, feature flags and capability lifecycle states used by the candidate;
4. synthetic, sanitized or otherwise approved test data only;
5. no production credentials, production configuration, production data or production traffic;
6. start, stop, reset and seed procedures with an explicit rollback path;
7. tenant-isolation and authorization-negative smoke tests for the exercised path;
8. no open Critical or High finding on the exercised path;
9. an evidence location for logs, digests, limitations and the final profile verdict; and
10. local-only or otherwise explicitly bounded network exposure.

A missing item is `HOLD`. A failed tenant-isolation, authorization or secret-boundary check is
`NO-GO` and requires immediate stop and evidence preservation.

The admission record must exist before any stack starts at
`docs/uat/candidates/<candidate-id>/runtime-admission.json`. It records `candidate_id`,
`recorded_at`, the four-repository `commit` and `tree` tuple, `hosted_ci`, `contracts`,
`test_data`, `production_exclusion`, `lifecycle_procedures`, `negative_smoke`,
`open_findings`, `evidence`, `network_exposure` and the final `disposition`. Those fields map
one-to-one to items 1–10 above; logs and artifact digests live beside the record under the same
candidate directory.

Any candidate represented as UAT, or any UI/behavior wave, is additionally bound by the accepted
suite process standard `../uat/UAT-GATE-STANDARD.md`. The ten runtime-admission items alone cannot
produce a UAT pass, `DEMO_READY_LOCAL` or `CUSTOMER_POC_READY` verdict for such a wave. The
standard's persona matrix, VI/EN localization, accessibility, responsive coverage,
negative-visibility evidence, screenshots/video, isolation log and evidence index remain
mandatory. Codex records pass/fail; the ratification must be recorded by the Founder or by the
Governor acting under the exact Founder-delegated technical-decision authority. No agent summary
self-certifies a UAT pass.

## 4. Profile gates remain independent

Runtime authority and readiness are different claims:

- `RUNTIME_AUTHORIZED` means the admission record permits bounded non-production execution.
- `DEMO_READY_LOCAL` requires the full Alert → Investigation → Evidence Bundle → analyst
  decision/case flow, production contract paths, degraded-mode proof and the exact evidence listed
  in the Governor objective.
- `CUSTOMER_POC_READY` additionally requires clean install, safe defaults, no-phone-home behavior,
  reset/backup evidence and a clear support boundary.
- `RC_READY` additionally requires the closed candidate contract, signed artifacts,
  install/upgrade/rollback evidence and the applicable full test/eval/security suite.
- `FULL_RELEASE_READY` and public GA remain subject to the stable-v1.0 evidence contract and
  Founder go/no-go.

`RUNTIME_AUTHORIZED`, `DEMO_READY_LOCAL`, `CUSTOMER_POC_READY`, `RC_READY` and
`FULL_RELEASE_READY` are readiness profiles, not gate identifiers.

No mock, scaffold, source digest, green unit suite or agent summary may be promoted into a stronger
profile claim.

## 5. Reserved boundaries

This decision does not authorize:

- production deploy, rollout, rollback, traffic, data, configuration, identity or credentials;
- external publication, a public release tag or a GA claim;
- acceptance of a Critical or High risk;
- breaking a public contract or changing a locked architecture, trust, tenant, authorization,
  cryptographic, sandbox or updater boundary without its protected decision; or
- force-push, destructive history rewriting or irreversible data operations.

This decision alone also authorizes no product-code or configuration change inside
`cybrik-soc-command-center` or another product repository, no dependency installation, no
database migration, no deployment and no formatter or auto-fixer. If an admitted local candidate
requires one of those separately protected actions, it remains `HOLD` until that exact action has
its own recorded authorization. Existing read-only validation and already-authorized canonical
start/stop/reset/seed procedures remain subject to their original scope.

Secrets, signing keys and identity-provider changes remain governed by
`DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`; the signed-artifact requirement for `RC_READY`
creates no permission to access or modify that material.

## 6. Evidence and rollback

Each execution records the candidate tuple, commands, environment, results, artifacts and digests.
Stopping or resetting the bounded environment is the runtime rollback. Reverting the canonical
commit that introduced this decision is the governance rollback; it does not erase evidence
already collected.

This document performs no runtime action by itself. At publication time, the integrated UAT
candidate remains `NOT PROVEN`.

## Appendix A. Founder directive provenance

Source: Founder directives in the Cybrik Governor task, recorded on `2026-07-31`. The operative
phrases are reproduced verbatim so this record applies delegated authority rather than inventing
it:

- “chạy test, lint, type check, build, local container và môi trường development”
- “dựng local demo, UAT hoặc POC”
- “phát hành internal build hoặc RC đúng cấp độ evidence.”
- “anh cho em cả quyền push, merge nhánh chuẩn, release. Production vẫn do anh”

The same Founder objective retains “external publication, public release tag hoặc GA go/no-go”
for the Founder. This record therefore does not promote the delegated internal/RC release
authority into public publication or GA authority.

The source directives originated in the Founder task thread and had no prior independent
in-repository artifact. This appendix becomes their reviewable repository provenance record; it
does not claim an earlier repository source.

## Appendix B. Exact UAT-MTLS-D1 dependency authorization

Source: Founder directives in the same Cybrik Governor task, applied on `2026-08-01`. The authority
chain is reproduced verbatim before the Governor's exact-action decision:

- “Thay vì cần Ballot hoặc chấp thuận từ anh, anh cho em quyền review và thay founder quyết định”
- “anh cho em cả quyền push, merge nhánh chuẩn, release. Production vẫn do anh”

These directives delegate non-production operating decisions to the Codex Governor while retaining
production with the Founder. Acting under that delegation, the Codex Governor records:

- `UAT-MTLS-D1=AUTHORIZED-EXACT-ACTION`;
- authority is limited to the exact D1 paths, HTTPS endpoints, pinned tools, isolated dependency
  environment, build, audit, SBOM/VEX, license inventory, offline reinstall and dependency-only
  tests enumerated in
  `docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md` §6.2 and Gate UAT-MTLS-D1;
- the action is consumed by the isolated B1 artifact and evidence on the D1 branch; it grants no
  reusable or product-wide dependency authority;
- raw official Anycorn remains uninstalled/unpinned, product `selected=false`, and the internal B1
  artifact remains confined to `suite_uat_tool_lock_only`;
- `UAT-MTLS-D2=HOLD`; no listener, product process, PostgreSQL runtime, migration, certificate,
  secret, customer data, deployment, public release, GA or production action is authorized; and
- production and public GA remain Founder-controlled.

This appendix is the separately recorded exact-action authorization required by §5. It supersedes
only §5's default dependency-installation HOLD for this consumed D1 action. Every other reserved
boundary remains unchanged.

## Appendix C. Exact D2 coverage-only closure recovery authorization

Source: the Founder objective supplied to the active Cybrik Governor task and applied on
`2026-08-02`. It directs the Codex Governor to perform bounded dependency installation, build and
local development/UAT preparation without waiting for an ordinary operating decision, while
retaining production, public GA, legal/compliance decisions, acceptance of Critical/High risk and
material trust-boundary changes with the Founder.

Acting under that delegation, the Codex Governor records:

- `UAT-MTLS-D2-CLOSURE-RECOVERY=AUTHORIZED-EXACT-ACTION`;
- authority is limited to the exact roots, pinned executables, lock and requirements digests,
  56-wheel inventory, commands, HTTPS endpoint classes, negative gates, evidence and rollback in
  `docs/operations/DELEGATED-GOVERNOR-D2-COVERAGE-CLOSURE-RECOVERY-2026-08-02.md`;
- the action is one-shot and is consumed by the first `--execute` attempt against the exact fresh
  closure and evidence roots recorded there;
- it grants no reusable or product-wide dependency authority and does not authorize Coverage.py
  extraction, Anycorn execution, a product process, listener, certificate, database, migration,
  deployment, legal/compliance claim or acceptance of Critical/High risk;
- `UAT-MTLS-D2=HOLD`; runtime remains not run and cannot receive release credit from this action;
  and
- production and public GA remain Founder-controlled.

This appendix supersedes §5's default dependency-installation HOLD only for that one local,
reversible closure-recovery attempt. Every other reserved boundary remains unchanged.

## Appendix D. Exact D2 coverage-only closure recovery R2 authorization

Appendix C is immutable consumed history. R1 executed once at Suite commit
`26d680fbfc1bc9cb25c63f089569c60fcbc54e2b`, tree
`df54838f6cc84785f50483f869e0bd3a41b56572`, and failed before network with
`requirements_identity_mismatch`. Attempt
`7a8f6f6e1c09abf421e327bf5093348c2f0a23a97d73a39fdab038504ab16e11` removed the fresh R1
closure root and preserved the R1 evidence root. Appendix C is not reopened or reused.

Acting under the same delegated non-production authority, the Codex Governor records:

- `UAT-MTLS-D2-CLOSURE-RECOVERY-R2=AUTHORIZED-EXACT-RETRY`;
- R2 is limited to the same exact ten repository paths, dependency set, executable identities,
  endpoint classes, evidence and exclusions as R1, with the fresh `-r2` closure/evidence roots;
- R2 must verify the two pinned R1 evidence files and absent R1 closure root, then complete two
  offline stdout exports and the D1 historical-header reconstruction before creating an R2 root;
- the unchanged D1 full requirements SHA-256 is
  `93ec6936e7999ee68e04434b563581ccc5a2e3b4010e252554048b7f75bf1603`; the path-stable
  header-free body SHA-256 is
  `bf3fc708b271e245eacc1b0696f6892935fec9f45fda762fd5d041d0bdb7d07d`;
- only a successful non-mutating `--check-only` pre-proof may precede the sole R2 `--execute`;
- the first R2 root-creating execute attempt consumes Appendix D. Any R2 failure exhausts this
  authority and cannot create an automatic R3; and
- `UAT-MTLS-D2=HOLD`; runtime remains not run, and production/public GA remain Founder-controlled.

This appendix corrects only the deterministic header/path defect proven by R1. It grants no
Coverage.py, Anycorn/B1, product process, listener, database, certificate, migration, deployment,
legal/risk acceptance or release authority.
