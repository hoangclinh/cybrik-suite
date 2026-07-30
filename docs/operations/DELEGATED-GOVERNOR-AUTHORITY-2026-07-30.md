# Delegated Governor Authority — 2026-07-30

Status: `ACTIVE — FORWARD-LOOKING GOVERNANCE`.

## 1. Delegation

The Founder delegates the following CYBRIK technical-governance decisions to the Codex
coordinator:

1. review technical evidence and issue `GO`, `HOLD` or `NO-GO`;
2. accept or reject technical gates without a Founder ballot;
3. create bounded commits after exact-scope review;
4. push reviewed refs;
5. merge reviewed changes to the canonical branch; and
6. create releases after the applicable release gate passes.

No additional Ballot or Founder approval is required for those actions. Earlier packets and dated
records remain immutable evidence of the authority in force when they were written, but any
forward-looking requirement in them for a separate Founder technical ballot, per-action push
grant, canonical-merge grant or release grant is superseded by this delegation.

## 2. Reserved authority

Production remains Founder-controlled. This delegation does not authorize:

- production deployment, production rollout, production data access or production configuration;
- production credentials, secrets, signing keys or identity-provider changes;
- destructive history rewriting or force-pushing protected refs; or
- purchasing or changing third-party billing.

A canonical merge or release is not production deployment.

## 3. Mandatory gates

Delegated authority does not waive evidence:

- exact scope and unrelated-work preservation must be checked before commit;
- required tests, lint, type checks, security scans and dependency audit must pass;
- material security or compatibility findings remain blocking until explicitly disposed;
- hosted required checks must pass before canonical merge;
- release artifacts must be reproducible and traceable to the reviewed commit;
- rollback or revert mechanics must be stated for a merge or release; and
- any action that exceeds the reviewed scope returns to `HOLD`.

The coordinator may use independent model review where it adds value. A provider outage, quota
failure or missing reviewer transcript does not create a permanent external approval dependency:
Codex performs and records the fallback review.

## 4. Unchanged program constraints

- Every published release date and milestone remains unchanged.
- Runtime, local stack, demo and UAT remain `NO-GO` until the existing G-C `stable-v1.0` trigger.
- The fixed roster remains 48 immutable task identities; this delegation creates no task 49.
- Production remains Founder-controlled even after a technical release gate passes.

## 5. Decision record

Each exercised action records the reviewed commit, exact path scope, verification evidence,
remaining nonblocking findings, hosted-check result where applicable, action performed and
rollback path. Self-authorization alone is never evidence that a gate passed.
