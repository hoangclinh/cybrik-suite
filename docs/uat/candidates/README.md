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
- Process rule: a completed runtime attempt must be recorded in a new result artifact and must not
  reuse the pre-run authorization artifact as result evidence; this distinction is review-enforced
  when the result update is committed.
- A missing runtime-admission item is `HOLD`.
- Any failed tenant-isolation, authorization or secret-boundary check is `NO-GO`.
- `RUNTIME_AUTHORIZED` permits bounded non-production execution only; it proves no `DEMO_READY_LOCAL`, UAT pass, POC readiness, RC readiness or GA claim.
