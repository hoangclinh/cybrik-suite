# Resource-bounds contract packet

Status: `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`
Version: `0.1.0`
Gate: `W2-H — accepted for implementation; static conformance only`

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

Acceptance is permission to implement against this packet later, never
implementation itself. Green static checks accept nothing on their own and
provide no runtime, UAT, release, production, T10, or T11 evidence.
