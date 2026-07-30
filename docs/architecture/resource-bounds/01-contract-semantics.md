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
does not change the parent version or remainder.

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

Root cancellation closes the root and all descendants. All closed-state
transitions fail closed; no later release can re-mint credit and no later
reservation can reopen the tree. This consumes accepted W1-C2 cancellation
and ADR-0003 durability as dependencies only and changes neither accepted
member.

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
