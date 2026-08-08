# Topology-only rehearsal records

Status: `PROPOSED — STATIC CONTROL IMPLEMENTED — NO RUNTIME AUTHORITY`.

This registry is separate from `docs/uat/candidates/`. A topology rehearsal is a bounded,
non-product preflight and is not a runtime-admission candidate, UAT attempt, demo or release.

Only `docs/uat/topology-rehearsals/*/topology-rehearsal.json` is discoverable. The dedicated policy
permits at most the single exact record `postgres-loopback-internal-v1-r1`, and the registry now
holds one proposed HOLD record for it. That record carries only its diagnosis and the
`diagnosis_review` of that diagnosis; the `diagnosis_review` attests the diagnosis bytes and not the
record bytes, so a `record_review` artifact and its record review binding, carrying the
record-level review of the exact record bytes, remain owed before any authorization. Every phase inventory is
exhaustive: proposed permits exactly `diagnosis` and `diagnosis_review`, authorized adds
`record_review`, `grant` and `authorization_signature`, and closed adds `result`,
`evidence_manifest` and `result_review`. Preparing or validating a record does not authorize
execution. The policy and validator code jointly pin the current record
bytes, phase, consumption state and append-only prior-state digest sequence. The probe executable
digest in the record is a proposal-time observation of the host binary, not attempt evidence; no
probe, listener, container or PostgreSQL process has been run. Artifact roles require distinct paths
and digests. Any authorized or closed record must retain a detached Founder SSHSIG over its exact
grant under namespace `cybrik-uat-topology-rehearsal-v1`; unsigned, self-authored or drifted grants
fail closed. Any future authorization must remain separately reviewed and exact-action.

## Record review attestation — `CYBRIK-TOPOLOGY-RECORD-REVIEW/v1`

The `record_review` artifact is machine-checked, not taken on trust. It must be a `.json`
attestation whose bytes are bounded canonical JSON: exactly `JSON.stringify(value, null, 2)`
followed by one LF, encoded UTF-8, LF line endings, no BOM, no trailing bytes and at most 65536
bytes. Compact, re-indented, CRLF, BOM-prefixed, duplicate-keyed or trailing-byte serializations
fail closed.

The attestation must carry the exact ordered ten-key inventory — no extra key, no missing key and
no reordering — of `schema`, `record_path`, `reviewed_phase`, `reviewed_record_sha256`,
`reviewer_identity`, `reviewer_independent_of_record_author`, `reviewer_mode`, `decision`,
`findings` and `grants_execution_authority`.

Those values are crosschecked against the record they claim: `schema` must be
`CYBRIK-TOPOLOGY-RECORD-REVIEW/v1`, `record_path` must name this record, `reviewed_phase` must be
`proposed`, and `reviewed_record_sha256` must be a lowercase 64-hex digest equal to the record
review binding digest. `reviewer_identity` must be a bounded non-blank control-character-free
string, `reviewer_independent_of_record_author` must be `true`, `reviewer_mode` must be
`read_only`, and `grants_execution_authority` must be `false`. `decision` is exactly
`RECORD_BYTES_APPROVED` or `RECORD_BYTES_REJECTED` and must be coherent with `findings`: approved
if and only if the bounded findings list (at most 32 entries, each carrying the exact ordered keys
`id`, `severity` and `summary`, with unique `id` and a `P0`–`P3` `severity`) is empty. An
authorized or closed record requires an approved review of the proposed bytes, so a well-formed
`RECORD_BYTES_REJECTED` attestation is a refusal to approve and blocks the record.

Non-claim: an approved record review is a self-declared, digest-bound assertion about record bytes.
It is not a signed identity proof, it does not cryptographically prove that the reviewer is
independent of the record author, and it
grants no execution, runtime, UAT, demo, release or production authority — no Docker effect, no
PostgreSQL RED run, no merge and no production change.
The detached Founder exact-action SSHSIG over the exact grant remains separately required and is
unchanged by this control.

## Image identity separation — `CYBRIK-TOPOLOGY-REHEARSAL-GRANT/v1`

A record and its grant keep two distinct image identities and never conflate them. The
`topology.image` block of a record is the **selected required image identity**: what the rehearsal
would be permitted to run. It carries `repository`, `tag`, `platform`, `index digest`,
`manifest digest`, `pull_policy` and a `resolution_state`, and it may never carry a
`local image ID` — a host-local identifier is not a selection. While `resolution_state` is
`UNRESOLVED` the platform and both digests are `null`; nothing has been resolved from a registry and
nothing has been observed on a host. The committed proposed HOLD record is exactly that: an
`UNRESOLVED` selection of `postgres:16-alpine` with `pull_policy` `never`.

The **observed host image identity** is the separate, timestamped statement of what a host actually
has. It repeats `repository`, `tag`, `platform`, `index digest` and `manifest digest`, and adds the
`local image ID` and an `observed_at` instant. An exact-action grant carries both identities and is
refused unless they agree exactly: same repository, same tag, same platform, same `index digest` and
same `manifest digest`. The `local image ID` is a host-local content identifier and must equal
neither digest. An unresolved selection can never be granted.

Non-claim: this separation is a static byte- and field-level control over declared identities. It
performs no registry lookup, no pull, no digest resolution and no host inspection, it proves no
image exists, and it
grants no runtime, UAT, demo, merge, release or production authority.
