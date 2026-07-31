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
- Any recovery must preserve every prior result. A later, genuinely distinct objective does so
  through the immutable lineage policy and a separately reviewed admission boundary; it cannot
  reinterpret R3 or create another PostgreSQL retry.
- A missing runtime-admission item is `HOLD`.
- Any failed tenant-isolation, authorization or secret-boundary check is `NO-GO`.
- `RUNTIME_AUTHORIZED` permits bounded non-production execution only; it proves no `DEMO_READY_LOCAL`, UAT pass, POC readiness, RC readiness or GA claim.
