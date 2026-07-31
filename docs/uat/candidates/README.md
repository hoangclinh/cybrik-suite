# Runtime Admission Candidates

Status: `ACTIVE` registry for non-production runtime-admission records only.

Each candidate record lives at `docs/uat/candidates/<candidate-id>/runtime-admission.json`.

Rules:

- Candidate discovery validates only `docs/uat/candidates/*/runtime-admission.json`.
- This `README.md` is documentation, not a candidate.
- `docs/uat/templates/runtime-admission.hold.json` is a template, not a candidate.
- A missing runtime-admission item is `HOLD`.
- Any failed tenant-isolation, authorization or secret-boundary check is `NO-GO`.
- `RUNTIME_AUTHORIZED` permits bounded non-production execution only; it proves no `DEMO_READY_LOCAL`, UAT pass, POC readiness, RC readiness or GA claim.
