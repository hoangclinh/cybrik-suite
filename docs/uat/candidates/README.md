# Runtime Admission Candidates

Status: `ACTIVE` registry for non-production runtime-admission records only.

Each candidate record lives at `docs/uat/candidates/<candidate-id>/runtime-admission.json`.

Rules:

- Candidate discovery validates only `docs/uat/candidates/*/runtime-admission.json`.
- This `README.md` is documentation, not a candidate.
- `docs/uat/templates/runtime-admission.hold.json` is a template, not a candidate.
- The parent directory must equal `candidate_id`; each candidate ID and
  `(attempt_accounting.series_id, attempt_ordinal)` pair is unique.
- Every candidate in one series keeps the first candidate's `max_attempts`. A failure-history row
  must resolve to the exact prior failed `NO-GO` candidate and match its counts, evidence path and
  evidence SHA-256.
- At most one registry candidate may derive `RUNTIME_AUTHORIZED`.
- `docs/uat/runtime-admission-lineage-policy.json` is the immutable legacy bridge for the terminal
  R1/R2/R3 records. It pins each record by path and SHA-256 without changing those records. The
  validator seals this exact three-entry list; future candidates cannot be added to it.
- Every candidate not pinned by that legacy bridge must declare
  `attempt_accounting.objective_lineage` with stable `capability_id` and `objective_id`.
  The pair must be registered in the policy's `allowed_objectives`; a terminal pair cannot be
  reopened under another `series_id`, including after a future series reaches terminal `NO-GO`.
- Cross-series evidence may be referenced only as a digest-pinned
  `historical_prerequisite`. It grants no execution authority; its bytes cannot be copied into the
  new candidate's current attempt, evidence artifacts or failure history; and it does not promote
  any runtime, UAT, POC, RC or release verdict. Registry-wide SHA-256 ownership enforces this even
  when a candidate omits the prerequisite declaration.
- Process rule: a completed runtime attempt must be recorded in a new result artifact and must not
  reuse the pre-run authorization artifact as result evidence; this distinction is review-enforced
  when the result update is committed.
- Current series status: `runtime-admission-ai-pg` consumed both original admitted ordinals. R1
  and R2 remain `NO-GO`. R3 records the one bounded `admitted_command_defect` recovery allowed by
  the canonical validator, preserves both failure histories, and is also `NO-GO` after consuming
  its one reviewed non-production PostgreSQL attempt. The exact test file reported `25 passed`
  with no skips, including all 13 integration-marked tests, but the pre-run authorization artifact
  incorrectly required literal `13 passed`. The mismatch is recorded without retry or broader
  authority.
- Current series status: `runtime-admission-soc-ai-lifecycle-mtls` is a distinct objective
  (`cybrik.suite.golden-workflow` / `golden-uat-v1`) and is `RUNTIME_AUTHORIZED` at attempt `1` of
  `2`, with `not_run` status, `execution_authorized` `true` and zero executed, passed and failed
  checks. No admitted runtime result exists yet. The exact four-repository tuple, hosted checks,
  one-shot signed admission, loopback boundary and lifecycle procedures are recorded in the
  candidate. Current static evidence is integrated master `164 passed`, D2 bounded
  `1692 passed, 2 skipped`, Alert bounded `250 passed`, and Cyber AI `1044 passed, 17 skipped` at
  `93.04%` branch coverage. No listener, PostgreSQL runtime or runtime-result artifact has
  executed. This is backend runtime permission only; it is not a UAT or demo pass. The
  carried-forward dependency substate remains `D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN`.
  `D1` pins the isolated B1 dependency preflight: wheel
  `d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c`, patch
  `1090569a745fc8cf9aa543505fc6616ebc724e6a16864ecb122cf4888954394e`, dedicated lock
  `e05c5e281e230b2089e356d716212a6d2c2e4320a3a30dc8dfd126216faa3add`, and no-socket probe
  `91ddea52e76a1334724b187d5ea0a90e8fdf7a84bd3108b8057689de9092dc45`. The raw Anycorn High
  is excluded from the exact exercised path; B1 stays `in_triage` pending D2 runtime proof. The
  four bounded loopback binds are authorized but no listener is opened by the current record. The
  candidate pins `runtime-admission-ai-pg-r3` only as
  a non-authorizing `historical_prerequisite`, which grants no execution authority and does not
  reopen the terminal R1/R2/R3 results.
- Any recovery must preserve every prior result. A later, genuinely distinct objective does so
  through the immutable lineage policy and a separately reviewed admission boundary; it cannot
  reinterpret R3 or create another PostgreSQL retry.
- A missing runtime-admission item is `HOLD`.
- Any failed tenant-isolation, authorization or secret-boundary check is `NO-GO`.
- `RUNTIME_AUTHORIZED` permits bounded non-production execution only; it proves no `DEMO_READY_LOCAL`, UAT pass, POC readiness, RC readiness or GA claim.
