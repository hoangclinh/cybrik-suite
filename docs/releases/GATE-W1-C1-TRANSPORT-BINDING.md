# Gate W1-C1 — `soc.get_alert_context` invocation transport-binding packet acceptance (2026-07-27)

- Status: `DECISION RECORD` — **Gate W1-C1 outcome: ACCEPTED FOR IMPLEMENTATION** (packet v0.1.0;
  **not** stable v1/GA, **not** an ADR-0001 immutable bundle tag).
- Date: 2026-07-27
- Repository: `cybrik-suite`
- Branch / reviewed tree: `codex/w1-c1-transport-acceptance-r1`, isolated worktree
  `w1-c1-transport-acceptance-r1`. **No merge to `main`. No push. No release.**
- Exact base commit: `4d5fb4b701f79194313975302cc0a63e0dd2a8ea`
  (`feat(contracts): propose W1 alert context transport binding`).
- Authority: W1 coordinator lifecycle decision under **coordinator-delegated Founder authority**,
  bounded to a single local commit in this worktree. The delegation covers the
  acceptance-for-implementation flip and its evidence only. It does **not** authorize promotion to
  stable v1/GA, creating a bundle tag, wiring CI, changing anything inside
  `cybrik-soc-command-center`, merging, pushing, or releasing.
- Reviewed packet: `contracts/compatibility/cybrik-suite-alert-context-transport-binding.v1.manifest.json`
  and its 15 declared members — the binding schema
  `contracts/json-schema/cybrik.soc-alert-context-invocation-binding.v1.schema.json`, the examples
  manifest `contracts/examples/alert-context-transport/examples-manifest.json`, and the 13
  positive / negative-schema / negative-semantic fixtures under
  `contracts/examples/alert-context-transport/`.

## 1. Decision

**ACCEPTED FOR IMPLEMENTATION — v0.1.0, not stable v1/GA, NOT IMPLEMENTED.**

The acceptance covers the transport-binding profile shape as the basis for implementation: the
restriction-only reuse of the accepted W2-B tool-execution request, result and receipt envelopes;
the closed caller-argument channel that can never assert `authorization_binding`; the exact
capability pin `soc.get_alert_context@0.1.0` at `R0` with `side_effects=false`; the restricted
envelope status set and outcome mapping; the constrained RFC 8785/JCS projections and the lossless
reconstruction back into the accepted C1 business request; the bound-receipt profile under a
deferred signing envelope; and the standalone static packet-integrity evidence.

Acceptance is a **recorded contract decision, not evidence**. It changes no runtime behavior and
demonstrates none.

### Non-claims — gates this acceptance does **not** open

Recorded verbatim in the manifest as `acceptance.non_claims` and enforced as an exact allowlist by
the validator:

1. no runtime implementation or runtime behavior is accepted, verified or demonstrated;
2. no endpoint, path, operation, queue, AsyncAPI channel or MCP transport surface is accepted;
3. no capability-registry entry is accepted or registered;
4. no Fabric tool-execution grant is accepted or minted, and **W2-F inference delegation is never
   Fabric tool authority**;
5. no deployment, environment rollout or operational enablement is accepted;
6. no CI wiring or pipeline registration is accepted;
7. no Bundle v0.1.1 membership or bundle tag is accepted (`x-cybrik-is-bundle-tag` stays `false`);
8. no merge, push, release or release certification is accepted.

### Open runtime obligations — unchanged by acceptance

`TR-4`, `TR-5`, `TR-6`, `TR-7`, `TR-8` remain **open declared-only runtime obligations**. The
validator fails closed if any of them is promoted into the fixture-exercised set or dropped from
either `open_runtime_obligations` or `acceptance.open_runtime_obligations`.

`proof_limits` stays: `runtime_authorization_proven=false`, `policy_completion_runtime_proven=false`,
`kill_switch_runtime_proven=false`, `endpoint_or_transport_implemented=false`, `release_ready=false`;
`capability_scope.implementation_status` stays `NOT IMPLEMENTED`.

## 2. Applied changes

Lifecycle flip `PROPOSED — NOT ACCEPTED` → `ACCEPTED FOR IMPLEMENTATION`, applied within an exact
six-path write allowlist (five paths originally delegated, plus the examples manifest added by an
explicit coordinator scope correction once it was identified as the packet's third lifecycle
document):

| # | Path | Change |
|---|---|---|
| 1 | `contracts/compatibility/cybrik-suite-alert-context-transport-binding.v1.manifest.json` | lifecycle flip; new `acceptance` record; `proof_limits.accepted_for_implementation=true`; provenance re-pinned to this base/worktree/date; verification scope + counts + `ci_wiring` re-stated; stale proposal language removed; member SHAs and member-set digest recomputed |
| 2 | `contracts/json-schema/cybrik.soc-alert-context-invocation-binding.v1.schema.json` | lifecycle flip and status sentence in `description`; no structural change to `$defs`, `oneOf`, or any constraint |
| 3 | `contracts/examples/alert-context-transport/examples-manifest.json` | lifecycle flip and description restated; **no fixture row, filename, kind or trust-invariant citation changed** |
| 4 | `tools/contract-validation/validate-alert-context-transport.mjs` | two-state fail-closed lifecycle table with `EXPECTED_STATE = 'ACCEPTED'`; acceptance-record checks; half-flip and stale-proposal-language rejection |
| 5 | `tools/contract-validation/tests/validate-alert-context-transport.test.mjs` | acceptance-state tests (32 adversarial + 3 positive) |
| 6 | `docs/releases/GATE-W1-C1-TRANSPORT-BINDING.md` | this gate record (new) |

No other repository path was written. `package.json`, `package-lock.json`, the README, the control
board, other contracts and all dependency files are untouched. Nothing was installed; no network was
used; no secret was read.

### Validator lifecycle model

`EXPECTED_STATE` selects one entry of a frozen two-state table:

- `PROPOSED` — `status='PROPOSED — NOT ACCEPTED'`, `notAccepted=true`,
  `acceptedForImplementation=false`, no acceptance record permitted, and `ACCEPTED FOR
  IMPLEMENTATION` forbidden anywhere in a lifecycle document.
- `ACCEPTED` — `status='ACCEPTED FOR IMPLEMENTATION'`, `notAccepted=false`,
  `acceptedForImplementation=true`, acceptance record mandatory, and `PROPOSED`, `NOT ACCEPTED`,
  `proposal-only`, `records no acceptance` all rejected as stale lifecycle text.

An unrecognised `EXPECTED_STATE` leaves the table entry null and every lifecycle check fails closed
rather than passing by default. All three lifecycle documents — binding schema, examples manifest,
compatibility manifest — must carry one identical `status/not_accepted` pair; a document left behind
in the other state is a rejected half-flip. The supersession bar (`/supersed/i`) is unconditional in
both states: this packet builds on the accepted C1 packet and never replaces it.

## 3. Digest changes

Recomputed from actual bytes, not asserted:

| Pin | Before | After |
|---|---|---|
| member `json-schema/cybrik.soc-alert-context-invocation-binding.v1.schema.json` `sha256` | `d44571485b05980821ef231d639f37804b9f78530d81d314eeb884946dc3da1f` | `8e7c0c67daa793e575b1c879643c92721733851f61a027b24ac1b36974d3eb98` |
| member `examples/alert-context-transport/examples-manifest.json` `sha256` | `6c399a2978d46c3d01ea6fd4b6b0daf970b46bed38089a96ad64a5215f9d3d6a` | `70e621eb65cd5631216f05a28de34309eadbfc05c9dbed593ca5594e956ce3bb` |
| `member_set_integrity.member_set_digest` | `sha256:8a1082ca166f12545b7f2ab0db6af4c43c93611aee9ced3fb88a49080a90d8b1` | `sha256:144821eea67ef4778e14a1285fbd67cbde263a9cee057e6fd454956a2d258fa7` |

The two flipped members are the only member rows whose bytes changed; the other 13 members are
byte-unchanged.

`member_count` stays 15. Reused accepted source bytes are unchanged: all 8 `reused_unmodified` pins
(W2-B envelopes, `common-defs`, `data-marking`, accepted C1 schema, Fabric control-plane OpenAPI,
accepted W2-F delegation token) and all 13 accepted-C1 `source_members` pins re-verify against the
bytes on disk **and** against the accepted C1 manifest declaration. `source_commit` stays
`3a2c71555a423465855ffaddcb663c8b704dbfbd`.

## 4. Commands

Run from the repository root against an existing dependency install. Nothing is installed and no
network is used. This worktree carries no local `node_modules`, so the documented dependency-root
override was used:

```
export CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT=<directory whose node_modules provides ajv 8.20.0 and ajv-formats 3.0.1>

node tools/contract-validation/validate-alert-context-transport.mjs
node --test tools/contract-validation/tests/validate-alert-context-transport.test.mjs
node --test --experimental-test-coverage \
  tools/contract-validation/tests/validate-alert-context-transport.test.mjs
```

## 5. Evidence status — GREEN

**Standalone validator — PASS**, 0 errors:

```
LIFECYCLE_STATE=ACCEPTED
STATUS=ACCEPTED_FOR_IMPLEMENTATION_NOT_ACCEPTED_FLAG=false
IMPLEMENTATION_STATUS=NOT IMPLEMENTED
ACCEPTED_FOR_IMPLEMENTATION=true
ACCEPTED_ON=2026-07-27
RUNTIME_AUTHORIZATION_PROVEN=false
KILL_SWITCH_RUNTIME_PROVEN=false
```

Verified counts: 1 schema compiled; 4/4 positive fixtures valid; 6/6 negative-schema fixtures
rejected; 3/3 negative-semantic fixtures structurally valid; 5 bound-output digests and 3 business
context digests re-derived; 3 bound-result correlations; 2 business-request conformance checks and 2
lossless reconstructions; 8 reused-artifact pins; 13 accepted-C1 source-member pins; 15 manifest
member hashes; 1 member-set digest.

**Standalone test suite — PASS**, 35 tests, **35 pass, 0 fail** — 32 adversarial rejection cases plus
3 positive checks, matching the manifest's declared `verification.test_case_counts`.

### Lifecycle coherence

All three lifecycle documents — binding schema, examples manifest, compatibility manifest — now carry
one identical pair, `ACCEPTED FOR IMPLEMENTATION` / `x-cybrik-not-accepted=false`, at contract
version `0.1.0`. No stale proposal lifecycle assertion (`PROPOSED`, `NOT ACCEPTED`, `proposal-only`,
`records no acceptance`) survives in any of them, and no supersession claim appears anywhere.

This mirrors the accepted W1 C1 packet at `3a2c71555a423465855ffaddcb663c8b704dbfbd`, whose
acceptance flipped all three of its lifecycle documents together.

### Route to this record

The acceptance was first applied under a five-path allowlist that omitted the examples manifest. The
validator refused that state as a lifecycle half-flip and no commit was made. The allowlist was then
widened by exactly one path under an explicit coordinator scope correction, and the flip was
completed. The half-flip was never worked around by weakening the validator or by excluding the
examples manifest from the lifecycle set.

## 6. Posture

Local-only. Exactly one local commit on `codex/w1-c1-transport-acceptance-r1`, carrying only the six
paths listed in section 2. **No push, no merge, no tag, no release**, no dependency installation, no
database migration, no deployment, no CI change, no formatter or auto-fixer run, and no access to
any secret material. Nothing outside this repository was read or written, and
`cybrik-soc-command-center` was not touched.
