# ADR-0010 — Capability-name canonicalization across JSON Schema runtimes

- Status: `ACCEPTED FOR IMPLEMENTATION — APPLIED`
- Date raised: 2026-07-26
- Decided and applied: 2026-07-26
- Decider: Founder
- Decision evidence:
  `FOUNDER-DECISION-PACKET-W0-I07B.md` and
  `FOUNDER-DECISION-PACKET-W0-BUNDLE-B-APPLICATIONS.md`
- Scope: `cybrik.capability.v1.schema.json` capability-name validation across the Suite and
  product vendor snapshots
- Version: pre-GA patch `0.1.1`; not stable v1/GA

## Context

The accepted-for-implementation v0.1.0 capability schema used an anchored expression for dotted
lowercase names. Python's regular-expression `$` semantics admit exactly one final LF, while
ECMAScript rejects it. Because JSON Schema implementations delegate `pattern` to their host
regular-expression engine, identical contract data could receive different decisions.

This is a trust-boundary defect: a capability name participates in registry lookup, policy,
digest-pinned invocation, logs, and receipts. A hidden control character can cause ambiguous
identity, validator disagreement, or audit-display confusion.

## Decision

Retain the existing structural dotted-name pattern and add this unanchored disallowed-character
guard to `properties.name`:

```json
"not": { "pattern": "[^a-z0-9_.]" }
```

Classify the correction as pre-GA patch `0.1.1`:

- the lexical intent was already dotted lowercase canonical form;
- the accepted expression already rejected the disputed value in ECMAScript/Ajv;
- the correction preserves canonical positives and changes no object shape, field meaning,
  risk class, side effect or wire operation;
- the incompatibility remains explicitly recorded because Python-admitted non-canonical inputs
  are now rejected.

The packet snapshot also advances to mutable pre-GA snapshot `0.1.1`. Only the capability member
has contract version `0.1.1`; the other twelve members remain at `0.1.0`. The snapshot is not an
ADR-0001 immutable bundle tag and is not a stable v1/GA promotion.

## Application evidence and boundary

- Founder approved Bundle A Option A and G-W0I07B-1..5=yes on 2026-07-26.
- Founder approved Bundle B Option A and G-W0BB-1..10=yes on 2026-07-26.
- The strict Fabric regression demonstrated that `"fabric.isolate_host\n"` was accepted by the
  v0.1.0 Python validator.
- The revision-bound canonical Suite/Fabric fixture inventory found four capability documents,
  four candidate-valid and zero candidate-invalid.
- The candidate lexical matrix passed ECMAScript, Ajv 8.20.0 and Python jsonschema 4.26.0 for
  four canonical positives and thirteen non-canonical negatives.
- The canonical Suite validator verifies the mixed member versions and all thirteen member
  SHA-256 digests.

Inventory evidence covers repository fixtures/static snapshots only. No live Fabric
registry/store exists in the reviewed implementation, so this ADR makes no live-registry,
deployed-runtime or production-enforcement claim. Product vendor refresh and GREEN evidence are
separately provenance-pinned to the Suite application commit.

## Compatibility, migration and rollback

- Never auto-trim or auto-lowercase signed capability descriptors.
- A rejected name requires owner-reviewed rename and regenerated digest, signature, references,
  policies and receipts.
- If a registry is added later, enforce zero active invalid registrations or explicitly
  quarantine each offender before enabling this rule there.
- Retain the exact v0.1.0 schema and vendor snapshot as content-addressed rollback evidence.
- Rollback selects the retained v0.1.0 snapshot; it does not edit v0.1.1 in place or silently
  replay rejected registrations.

## Consequences

Positive:

- Python jsonschema and ECMAScript/Ajv agree on the tested lexical matrix.
- Control characters, whitespace and case drift fail closed without non-portable regex anchors.
- Existing canonical capability names remain valid.

Cost and residual risk:

- Any undiscovered non-canonical stored name would require owner-reviewed migration.
- Other JSON Schema runtimes remain a residual risk until their product toolchains execute the
  shared matrix.
- Contract validation does not replace ingestion, uniqueness, signing, lookup, policy or receipt
  enforcement.

## Decision history

- 2026-07-26 — raised as `PROPOSED — NOT DECIDED — NOT APPLIED`.
- 2026-07-26 — Founder approved the rule as pre-GA patch `0.1.1` through Bundle A.
- 2026-07-26 — Founder authorized the bounded Suite-to-Fabric application and two local
  path-limited provenance commits through Bundle B.
- 2026-07-26 — canonical Suite application recorded as
  `ACCEPTED FOR IMPLEMENTATION — APPLIED`; product vendor refresh remains separately gated by the
  exact Suite provenance commit and Fabric validation.
