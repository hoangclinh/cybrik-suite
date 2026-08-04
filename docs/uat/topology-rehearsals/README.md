# Topology-only rehearsal records

Status: `PROPOSED — STATIC CONTROL IMPLEMENTED — NO RUNTIME AUTHORITY`.

This registry is separate from `docs/uat/candidates/`. A topology rehearsal is a bounded,
non-product preflight and is not a runtime-admission candidate, UAT attempt, demo or release.

Only `docs/uat/topology-rehearsals/*/topology-rehearsal.json` is discoverable. The dedicated policy
permits at most the single exact record `postgres-loopback-internal-v1-r1`, and the registry now
holds one proposed HOLD record for it. That record carries only its diagnosis and the independent
review of that diagnosis; the review attests the diagnosis bytes and not the record bytes, so
record-level independent review remains owed before any authorization. Preparing or validating a
record does not authorize execution. The policy and validator code jointly pin the current record
bytes, phase, consumption state and append-only prior-state digest sequence. The probe executable
digest in the record is a proposal-time observation of the host binary, not attempt evidence; no
probe, listener, container or PostgreSQL process has been run. Artifact roles require distinct paths
and digests. Any authorized or closed record must retain a detached Founder SSHSIG over its exact
grant under namespace `cybrik-uat-topology-rehearsal-v1`; unsigned, self-authored or drifted grants
fail closed. Any future authorization must remain separately reviewed and exact-action.
