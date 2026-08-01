# Resource-bounds contract semantics

Status: `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`
Version: `0.1.0`

## State model

A root grant introduces one finite six-dimensional credit vector. An admitted
reservation owns an accounting slice of an open parent. Its identifier is a
ledger reference, never permission to perform work.

For every admission and every dimension `d`:

```text
requested[d] <= parent.remaining[d]
parent.remaining.after[d] =
  parent.remaining.before[d] - requested[d]
child.reserved[d] = child.remaining[d] = requested[d]
```

The result is all-or-nothing: `admitted` carries one reservation and no error;
`denied` carries one fail-closed `RES_*` error and no reservation. A denial
does not change the parent version or remainder. Replay accepts a denial as a
real outcome: it is recorded, and the tree continues from the untouched state.

Every non-grant record — reservation request, reservation result, release, and
root closure — names the root grant whose tree it belongs to. That binding is
`kind` and `id` only. It carries no `expected_version`, because it is an
identity statement rather than a compare-and-set against root state, and it
confers no authority: naming a root grant is not possession of it. A record
naming a foreign tree fails closed on `RES_PARENT_NOT_FOUND`. The grant itself
takes no such property; it is the root.

## Ledger sequence

Within one root tree, sequences start at `1` and increase by exactly `1`, with
no gap, no repeat, and no reordering; a violation is `RES_SEQUENCE_VIOLATION`.
The rule enforced is dense, not merely monotone.

A dense sequence from `1` means
**exactly one serialization point per root tree**.
Every record in a tree is ordered by a single counter, so the v0.1
model admits no concurrent independent writers within one root and no
partitioned or per-branch sub-sequences. This is a deliberate v0.1 limit,
chosen because it makes replay total and reproducible from fixture bytes
alone. It is a contract-level statement only and makes no throughput, scaling,
or runtime-concurrency claim. Density is a cross-record property, so the
single-record schema constrains only `integer, minimum 1`; the rule lives in
the wording here and in the replay model.

## Conserved dimensions

The fixed vector is `cpu_millis`, `memory_byte_millis`, `model_tokens`,
`tool_calls`, `retrieved_bytes`, and `egress_bytes`. Values are nonnegative
integers. Grants and requests require a non-zero vector. No dynamic dimension
name is admitted, preventing an unreviewed resource axis.

Deadlines and peak memory are intentionally absent. A deadline is a temporal
limit and peak memory is a non-additive observation; neither can participate
in conserved-parent arithmetic.

## Release

For each dimension:

```text
release.consumed[d] + release.returned[d]
  = target.current_available[d]
```

The target must be open, at the expected version, with no open child. Only
`returned` is added to an open parent's remainder. `consumed` never returns.
The target then closes and cannot be released twice or used as a parent.

## Root closure

One terminal root record covers both normal completion and cancellation
through a shared closure-reason vocabulary (`completed`, `cancelled`,
`failed`, `expired`), hoisted once into the common definitions so the release
reason and the closure reason cannot drift apart. `closes_descendants` is
fixed `true`, so partial or selective closure is structurally unrepresentable.

At closure, and for each dimension:

```text
closure.final_consumed[d] + closure.final_unused[d]
  = closing grant.bounds[d]
```

The root's remaining credit becomes zero and every still-open descendant is
closed with zero remaining. A root closure returns credit to nobody — the root
has no parent — and mints nothing: the unused remainder is extinguished, not
banked, forwarded, or re-minted. Any mismatch fails closed on
`RES_RELEASE_ACCOUNTING_MISMATCH`, the code the release path already uses for
this class of conservation failure. Closure mints no new `RES_*` code.

All closed-state transitions fail closed; no later release can re-mint credit
and no later reservation can reopen the tree. This consumes accepted W1-C2
cancellation and ADR-0003 durability as dependencies only and changes neither
accepted member.

## Error reporting

`cybrik.res-bounds-error.v1` is the standalone failure document for every
`res-*` operation without a dedicated result schema. `retriable` is derived
from `code`, not asserted independently: it is `true` for exactly
`RES_INSUFFICIENT_REMAINDER` and `RES_ACTIVE_CHILDREN`, where a byte-identical
re-issue could later succeed because *peer* state changed, and `false` for
every other code — including `RES_VERSION_CONFLICT` and
`RES_IDEMPOTENCY_CONFLICT`, where the caller must change the bytes.
`fail_closed` is `true` for all fifteen codes. `retriable` is advisory: it
grants no capacity, admission, queue position, priority, or authority, and a
retriable error is a refusal exactly as complete as a non-retriable one.

## Identity and authority

Authoritative tenant comes from the caller credential. `tenant_id` is an
advisory equality check. `org_scope_ref` is an advisory policy-scope equality
check. Every ID, idempotency key, lineage reference, version, sequence, and
virtual time is accounting state only. `confers_authority:false` is explicit
on public grant/request/result/release objects.

No identifier is a capability, credential, permission, delegation, or
approval. No model output can establish any of those properties.

## Vocabulary boundary

The accepted investigation `budget` caps one create request. This proposal
conserves credits across a call tree, with no mapping to that object.
`budget_exceeded`, `BUDGET_*`, `over_input_budget`, `over_output_budget`, and
`fallbackInfo.reason = "budget"` keep their existing meanings. `RES_*` errors
are separate.

This is static contract design only. It supplies no runtime, UAT, release, or
production evidence.
