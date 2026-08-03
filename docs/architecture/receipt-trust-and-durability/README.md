# Receipt trust and durability packet

Status: `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`

This directory explains the Suite-owned contract floor for Fabric-owned receipt verification
trust and durable completion. It contains no product code, signer, key, ledger, endpoint,
deployment, or runtime configuration.

Read in order:

1. [Trust-bundle lifecycle](01-trust-bundle-lifecycle.md)
2. [Durable commit and failure semantics](02-durable-commit-and-failure-semantics.md)
3. [ADR-0014](../../adr/ADR-0014-receipt-trust-and-durability-profile.md)

The accepted W2-B route mapping is reused and not duplicated. Acceptance of this packet would
authorize contract-first implementation only. Runtime, integrated UAT, release, and production
remain separate gates.
