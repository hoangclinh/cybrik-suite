# Topology-only rehearsal records

Status: `PROPOSED — STATIC CONTROL IMPLEMENTED — NO RUNTIME AUTHORITY`.

This registry is separate from `docs/uat/candidates/`. A topology rehearsal is a bounded,
non-product preflight and is not a runtime-admission candidate, UAT attempt, demo or release.

Only `docs/uat/topology-rehearsals/*/topology-rehearsal.json` is discoverable. The dedicated policy
currently permits zero prepared records or the single exact future record
`postgres-loopback-internal-v1-r1`; no record exists yet. Preparing or validating a record does not
authorize execution. The policy and validator code jointly pin the current record bytes, phase,
consumption state and append-only prior-state digest sequence. Artifact roles require distinct paths
and digests. Any authorized or closed record must retain a detached Founder SSHSIG over its exact
grant under namespace `cybrik-uat-topology-rehearsal-v1`; unsigned, self-authored or drifted grants
fail closed. Any future authorization must remain separately reviewed and exact-action.
