# Topology-only rehearsal records

Status: `PROPOSED — STATIC CONTROL IMPLEMENTED — NO RUNTIME AUTHORITY`.

This registry is separate from `docs/uat/candidates/`. A topology rehearsal is a bounded,
non-product preflight and is not a runtime-admission candidate, UAT attempt, demo or release.

Only `docs/uat/topology-rehearsals/*/topology-rehearsal.json` is discoverable. The dedicated policy
currently permits zero prepared records or the single exact future record
`postgres-loopback-internal-v1-r1`; no record exists yet. Preparing or validating a record does not
authorize execution. Any future authorization must remain separately reviewed and exact-action.
