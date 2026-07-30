# ADR-0012 — Resource-bounds contract profile

- Status: `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`
- Contract version: `0.1.0` (pre-v1; not a bundle tag)
- Date raised: 2026-07-31
- Gate: `W2-H — OPEN FOR BOUNDED PROPOSAL WRITING AND STATIC CONFORMANCE ONLY`
- Lane: `W0-T11/RB` (instrument sub-lane; no task 49)
- Acceptance record: none

## Context

Finite execution cannot be inferred from agent depth. A shallow fanout can
overdraw a system, while a deep tree can remain bounded if every admission
conserves a finite root allocation. The Suite therefore needs a provider-neutral
accounting vocabulary that can express root bounds, child reservations,
all-or-nothing admission, terminal release, and deterministic replay without
creating a new authority mechanism.

W0-T11 remains `HOLD until real vertical exists`. This packet is an instrument
for later measurement, not a T11 latency/resource baseline and not progress
toward W0-T10.

## Proposed decision

Adopt, subject to a later acceptance decision, six JSON Schema 2020-12
documents under `cybrik.res-*`, a fixed deterministic fixture corpus, one
compatibility manifest, and static architecture guidance.

### Conserved vector

`resourceVector` contains exactly six nonnegative integer credit dimensions:

1. `cpu_millis`
2. `memory_byte_millis`
3. `model_tokens`
4. `tool_calls`
5. `retrieved_bytes`
6. `egress_bytes`

A root grant and a reservation request must have at least one positive
dimension. Deadlines, elapsed time, and peak memory are excluded because they
are limits or observations, not additive conserved credits.

### Admission and conservation

A child reservation subtracts its complete requested vector from the open
parent at admission time. Admission is all-or-nothing. Spawning creates no
credit, parent remainder is monotone between valid returns, and a finite root
therefore permits only finite admitted fanout even when logical fanout is
unbounded. Depth is an independent control and is neither inferred from nor
substituted for conservation.

Every request names a parent kind, identifier, and expected version. Every
event carries a strictly monotone sequence and fixture-supplied virtual time.
These are replay/accounting fields only.

### Release and closure

For each resource dimension, a release must satisfy:

> `consumed + returned == target reservation current available`

Only the unused `returned` vector may rejoin a still-open parent. `consumed`
never returns. A reservation is terminal after one valid release; a closed
root or reservation never reopens. Root cancellation closes the full subtree
and no later release or spawn may re-mint any of its credit.

Root-cancel propagation depends on accepted W1-C2 lifecycle semantics.
Durable no-remint accounting depends on accepted ADR-0003. These are
one-directional dependencies only: this proposal changes no W1-C2 or ADR-0003
byte, adds no obligation to either, and requests no re-acceptance.

### Derived-only authority

The authenticated caller credential is the tenant authority. Payload
`tenant_id` is advisory and must match it. `org_scope_ref` is also advisory and
must match authenticated policy. `grant_id`, `request_id`, `reservation_id`,
`release_id`, idempotency keys, and parent references are accounting state.
None is a credential, capability, permission, delegation, or approval.
`confers_authority` is structurally fixed to `false` on public accounting
objects.

### Existing investigation budget remains separate

The accepted W1-C2
`cybrik.investigation-create-request.v1` contract already contains
`budget.{deadline_seconds,max_model_calls,max_tool_calls,max_retrieved_bytes}`.
That object declares caps for one investigation request. This proposal
accounts conserved quantities across a call tree. There is no mapping between
the two in this packet.

Likewise, this proposal does not rename, extend, deprecate, replace, or map
`budget_exceeded`, `BUDGET_*`, `over_input_budget`,
`over_output_budget`, or `fallbackInfo.reason = "budget"`. Resource errors use
the disjoint `RES_*` namespace.

## Contract members

- `cybrik.res-common-defs.v1.schema.json`
- `cybrik.res-bounds-grant.v1.schema.json`
- `cybrik.res-reservation-request.v1.schema.json`
- `cybrik.res-reservation-result.v1.schema.json`
- `cybrik.res-release.v1.schema.json`
- `cybrik.res-bounds-error.v1.schema.json`

The compatibility manifest pins the six schemas, the examples manifest, all
22 fixtures, and itself using a non-circular self-digest algorithm.

## Evidence ceiling

- **L1, static only:** official JSON Schema 2020-12 compilation, positive
  validation, intentional negative-schema rejection, inventory and digest
  verification.
- **L2, static only:** deterministic fixture replay and seeded property checks
  for conservation, no-mint, monotone drawdown, finite admission, release, and
  cancellation.

These labels are local evidence labels, not gates or SOC analyst tiers. A green
check is conformance evidence only. It accepts no contract, starts no server,
and supplies no integration, runtime, UAT, release, deployment, production,
T10, or T11 evidence.

## Consequences and deferred work

This proposal establishes a precise accounting vocabulary and a reproducible
static proof target. Product ownership, enforcement placement, persistence,
concurrency, crash recovery, operational limits, telemetry, deployment, and
all product implementations remain deferred to separately authorized work.
Release dates remain unchanged.
