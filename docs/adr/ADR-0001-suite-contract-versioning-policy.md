# ADR-0001 — Suite contract/versioning policy

- Status: `PROPOSED — NOT DECIDED`
- Date raised: 2026-07-23
- Decider: Founder
- Scope: `cybrik-suite:contracts/` and every product that implements a suite contract

## Context

The suite is contract-first: cross-product interfaces (REST, events, schemas, MCP) live in
`contracts/` and products implement them. No policy yet defines how contracts are versioned,
how breaking changes are handled, or what compatibility products must guarantee.

## Decision needed

1. Versioning scheme per contract type (e.g. SemVer per contract file vs. suite-wide contract
   version) and how versions appear in paths/headers/topics.
2. Breaking-change rules: what constitutes breaking for REST, events, JSON Schema, MCP; the
   deprecation window; whether N-1 compatibility is mandatory.
3. Acceptance workflow: how a contract moves `PROPOSED → ACCEPTED → DEPRECATED`, who signs
   off, and how acceptance is recorded (this ADR should define the mechanics currently only
   sketched in `contracts/README.md`).
4. Conformance: whether `tests/contract/` runs against pinned contract versions and whether a
   release manifest may reference unaccepted contracts (proposed: no).

## Options to evaluate (no selection made)

- A: SemVer per contract file + compatibility matrix in `contracts/compatibility/`.
- B: Suite-wide contract bundle version released as a unit.
- C: Hybrid — per-file SemVer with periodically tagged suite bundles.

## Consequences to evaluate

Migration burden per product, release coupling, tooling for conformance checks, LTS
implications from the roadmap (24-month LTS target mentioned in strategy document 05).
