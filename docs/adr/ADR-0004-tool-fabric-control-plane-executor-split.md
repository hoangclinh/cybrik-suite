# ADR-0004 — Tool Fabric control-plane / executor split

- Status: `PROPOSED — NOT DECIDED`
- Date raised: 2026-07-23
- Decider: Founder
- Scope: `cybrik-security-tool-fabric` architecture

## Context

Tool Fabric combines a trust-critical control plane (signed capability registry, policy/
approval, credential/egress broker, receipts) with execution of untrusted or semi-trusted
security tools. How strictly these are separated determines the security boundary of the
whole suite.

## Decision needed

1. Process/trust boundary: control plane and executors in separate processes, separate hosts,
   or separate trust zones; what crosses the boundary and over which protocol.
2. Executor model: long-lived workers vs. per-invocation sandboxes (interacts with ADR-0005).
3. Credential flow: how brokered credentials reach an executor without persisting there, and
   how egress policy is enforced at the executor.
4. Receipt integrity: where execution receipts are signed (control plane vs. executor) and
   what makes them tamper-evident.
5. Blast-radius containment: what a fully compromised executor can and cannot do.

## Options to evaluate (no selection made)

- A: Single service, internal module boundary (fastest, weakest isolation).
- B: Control-plane service + executor pool over an authenticated queue/API.
- C: B plus per-invocation sandbox isolation for every tool run.

## Consequences to evaluate

Latency vs. isolation, operational complexity for on-prem customers, attestation of executor
identity (ties into cross-product identity, ADR-0006).
