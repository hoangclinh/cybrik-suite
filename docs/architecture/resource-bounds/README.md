# Resource-bounds contract packet

Status: `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`
Version: `0.1.0`
Gate: `W2-H — bounded proposal writing and static conformance only`

This directory explains the Suite-owned resource-bounds contract instrument.
It contains no product implementation, endpoint, server, transport binding,
deployment, or environment configuration.

The packet has one load-bearing rule: a child reservation is subtracted from
its parent when admitted, so spawn never creates credit. Finite root bounds
therefore imply finite admitted fanout independently of tree depth.

Read:

1. [Contract semantics](01-contract-semantics.md)
2. [Deterministic replay and evidence](02-deterministic-replay-and-evidence.md)
3. [ADR-0012](../../adr/ADR-0012-resource-bounds-contract-profile.md)

Green static checks do not accept the proposal and provide no runtime, UAT,
release, production, T10, or T11 evidence.
