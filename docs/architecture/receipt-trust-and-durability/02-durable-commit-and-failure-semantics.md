# Durable commit and failure semantics

Status: `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`

## Required ordering

```text
authorize -> commit intent -> dispatch -> observe -> sign receipt
          -> commit receipt -> read-after-write verify -> release result
```

The intent binds authoritative tenant, idempotency key, capability and version/digest, input and
policy digests, delegation reference, approval reference when required, and execution bounds. It
is committed before dispatch so crash recovery can distinguish never-dispatched from unresolved
work.

The completion receipt is signed by the Fabric control plane, committed to the authoritative
ledger, and read-after-write verified before a completed result is released. An uncertain commit
is resolved by the same tenant-partitioned idempotency key and binding digest; the capability is
not executed again merely because the caller retried.

## Failure mapping

- Intent commit failure: deny or report unavailable before dispatch.
- Signer failure: do not acknowledge completion.
- Receipt commit or verification failure: return failed/unavailable, no `receipt_id`, no business
  output, and never `completed`.
- Crash after intent but before completion: recovery records a terminal failed/timed-out outcome
  or reconciles authoritative executor evidence; it never resolves to silent disappearance.
- Performed-but-unrecorded side effect: alarm-grade reconciliation state. It must never be called
  completed, and it must not be hidden by retrying execution.

## Ledger invariants

- Receipts are append-only under the application role.
- Replay returns exact stored bytes and does not re-sign.
- Retrieval uses the same authoritative tenant partition and verifies binding and signature before
  exposure.
- Receipt retention does not exceed the retained public keys and bundle generations needed for
  verification.
- Rollback disables new execution but preserves receipts, intents, bundle generations, and audit
  evidence.

## Product decisions left to Fabric

Fabric selects the database or ledger engine, schema, FORCE RLS or equivalent tenant isolation,
replication, backup, restore, RPO, RTO, encryption, and retention policy. Those choices require
product-level implementation and runtime evidence; this Suite proposal supplies neither.
