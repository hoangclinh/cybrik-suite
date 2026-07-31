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

Canonical orchestrator registration and the ADR catalog row were deliberately deferred in R1.
The R2 amendment below authorizes and records the bounded reconciliation that closes this deferral:
the canonical count becomes 23 and the existing W2-I P2-3 additive-byte mechanism carries the
exact W2-K catalog additions without changing any W2-I or W2-H proposal byte or status.

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

## R2 amendment — canonical registration reconciliation

Status: **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED** (unchanged). This amendment closes only the
deferred-registration item above; it does not reopen or widen the Decision or Denial list.

The Codex Governor authorizes exactly these seven paths for the R2 canonical-registration
reconciliation, and no other:

1. `tools/contract-validation/validate.mjs`
2. `tools/contract-validation/tests/validate-resource-bounds.test.mjs`
3. `tools/contract-validation/tests/validate-transport.test.mjs`
4. `tools/contract-validation/tests/validate-transport-peer.test.mjs`
5. `docs/adr/README.md`
6. `tools/contract-validation/README.md`
7. `docs/adr/DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE.md` (this file)

Canonical registration is complete: within this bounded authority, `validate-transport-peer.mjs`
and its test join the canonical `validate.mjs` orchestrator. These 23 validators are now the
truthful canonical count, and `docs/adr/README.md` gains the additive W2-K paragraph, ADR-0013
catalog row, and Governor-decision row via the existing W2-I P2-3 additive-byte pin, which now also
carries the exact W2-K additions. No other file changes, and no packet schema, fixture, or manifest
byte under `contracts/` changes.

This amendment explicitly denies:

- ADR-0013 acceptance or any change to its `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED` status;
- any contract-byte change — no JSON Schema, fixture, example, or compatibility-manifest byte under
  `contracts/` may change under this authority;
- runtime authority — no socket, listener, database, container, or process;
- UAT authority — no runtime-admission candidate or T10/T11 measurement; hosted checks may execute
  static validators only and convey no UAT authority;
- release authority — no tag, package, or artifact publication;
- deployment authority — no environment, infrastructure, or configuration change; and
- production authority — no production credential, data, or configuration of any kind.

Canonical registration is orchestration and catalog bookkeeping only. `npm run validate` including
the W2-K step, and the ADR catalog listing ADR-0013, remain static conformance and documentation
signals; neither is acceptance, implementation, runtime, UAT, release, deployment, or production
proof.
