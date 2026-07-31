# Delegated Governor Decision — Gate W2-K transport peer evidence

Status: **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED**.

Base commit: `3604c56507f5d3f831ff19b229b9cde5c508c6f3`.

## Decision

The Codex Governor records a zero-collision scan for `W2-K`, `ADR-0013`, and `transport-peer` at the
exact base above and sets Gate W2-K to:

**OPEN FOR BOUNDED PROPOSAL WRITING AND STATIC CONFORMANCE ONLY**.

This authority covers only the two proposed schemas, synthetic conformance fixtures, compatibility
manifest, ADR/architecture notes, one standalone read-only validator, its test, and bounded registry
rows. It grants no contract acceptance, product implementation, runtime execution, UAT, release,
deployment, or production authority.

Canonical orchestrator registration and the ADR catalog row are deliberately deferred. These 21 validators
remain the truthful canonical count, while the existing W2-I P2-3 additive-byte pin keeps
`docs/adr/README.md` byte-stable. The W2-K validator therefore stays standalone until a separate
reconciliation changes both pins together.

## Denial list

This gate explicitly denies:

- dependency install or dependency changes;
- formatter or auto-fix execution;
- workflow or lockfile changes;
- edits in any sibling repository;
- edits to runtime-admission candidates or accepted W2-H artifacts;
- opening a listener, starting a database, stack, server, process, migration, or container;
- secret, credential, token, key, certificate, customer-data, or production-data handling;
- server selection, install, pin, fork, vendor, or runtime probe; and
- any claim that static green proves runtime, UAT, T11, release, deployment, or production readiness.

## Closure condition

The bounded writing gate closes when exact packet bytes, RED/GREEN test evidence, member digests,
independent review, and hosted required checks are recorded. Acceptance remains a separate decision.
