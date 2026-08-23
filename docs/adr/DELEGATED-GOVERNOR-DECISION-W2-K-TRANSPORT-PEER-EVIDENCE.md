# Delegated Governor Decision — Gate W2-K transport peer evidence

Current status: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED** under R4 below.

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

Historical R2 status at that amendment: **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED** (unchanged).
This amendment closed only the
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
and its test joined the then-23-validator canonical `validate.mjs` orchestrator. At R2, 23 was the
truthful canonical count. The current orchestrator later grew to 25 registered steps; these 25 validators
were the present-day count before the Fabric runtime-producer gate registration; it now has 27 registered
validators; the Fabric runtime-producer gate and its regression suite then brought it to 29.
These 32 validators are the present-day count and additionally include the C8 topology grant
validator and its test. `docs/adr/README.md` gained the additive W2-K paragraph, ADR-0013
catalog row, and Governor-decision row via the existing W2-I P2-3 additive-byte pin, which now also
carries the exact W2-K additions. No other file changes, and no packet schema, fixture, or manifest
byte under `contracts/` changes.

Before R4 superseded its acceptance boundary, this amendment explicitly denied:

- ADR-0013 acceptance or any change to its then-current
  `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED` status;
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

## R3 amendment — governance-free wire instances

Base commit: `440dc0e86e0453e74c71ef85a01be777ba674b7c`.

Historical R3 status at that amendment: **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED** (unchanged).

The Codex Governor authorizes exactly 25 paths for R3, and no other:

1. `docs/adr/DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE.md` (this file)
2. `docs/adr/ADR-0013-transport-peer-evidence-adapter-profile.md`
3. `tools/contract-validation/tests/validate-transport-peer.test.mjs`
4. `contracts/compatibility/cybrik-suite-transport-peer-evidence-packet.v1.manifest.json`
5. `contracts/examples/transport-peer/examples-manifest.json`
6. `contracts/examples/transport-peer/negative-schema/peer-evidence-error.leaky-error-body.json`
7. `contracts/examples/transport-peer/negative-schema/peer-evidence.client-supplied-thumbprint-source.json`
8. `contracts/examples/transport-peer/negative-schema/peer-evidence.conveys-authorization-true.json`
9. `contracts/examples/transport-peer/negative-schema/peer-evidence.raw-certificate-material.json`
10. `contracts/examples/transport-peer/negative-schema/peer-evidence.root-authority-axis.json`
11. `contracts/examples/transport-peer/negative-schema/peer-evidence.sha1-thumbprint-alg.json`
12. `contracts/examples/transport-peer/negative-schema/peer-evidence.trusted-boundary-adapter.json`
13. `contracts/examples/transport-peer/negative-semantic/peer-evidence.chain-not-verified.json`
14. `contracts/examples/transport-peer/negative-semantic/peer-evidence.channel-evidence-absent.json`
15. `contracts/examples/transport-peer/negative-semantic/peer-evidence.channel-evidence-held.json`
16. `contracts/examples/transport-peer/negative-semantic/peer-evidence.not-mutual-tls.json`
17. `contracts/examples/transport-peer/negative-semantic/peer-evidence.peer-thumbprint-absent.json`
18. `contracts/examples/transport-peer/negative-semantic/peer-evidence.relying-party-thumbprint-mismatch.json`
19. `contracts/examples/transport-peer/negative-semantic/peer-evidence.token-cnf-thumbprint-mismatch.json`
20. `contracts/examples/transport-peer/negative-semantic/peer-evidence.unverified-thumbprint-source.json`
21. `contracts/examples/transport-peer/positive/peer-evidence-error.chain-not-verified.json`
22. `contracts/examples/transport-peer/positive/peer-evidence.verified-chain.json`
23. `contracts/examples/transport-peer/positive/truth-table.no-degrade.json`
24. `contracts/json-schema/cybrik.transport-peer-evidence-error.v1.schema.json`
25. `contracts/json-schema/cybrik.transport-peer-evidence.v1.schema.json`

R3 removes `x-cybrik-lifecycle` only from the two wire schemas and all 18 fixture documents: 17
wire-instance fixtures plus one non-wire truth table. It recuts the directly affected example and
compatibility digests and adds fail-closed tests plus the decision rationale in ADR-0013. Proposal
lifecycle state remains represented by status metadata on the schema roots, examples manifest,
compatibility manifest, ADR, and decision record. Reintroducing a governance marker into an
evidence or denial instance is rejected by the schemas; the truth table remains digest-pinned and
test-governed rather than wire-schema validated.

This amendment grants no acceptance, runtime, UAT, release, deployment, or production authority.
It authorizes no product implementation, server selection, dependency or lockfile change, workflow
change, listener, process, database, container, migration, certificate handling, tag, publication,
environment change, or production action. Anycorn `0.20.0` remains HOLD. Acceptance remains a
future, separately reviewed decision and must not change a wire-contract byte.

## R4 amendment — atomic acceptance for implementation

Base commit: `ef61285f7674672007a7c3a76bae08d5b1d0ef70`.

Status: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED** (v0.1.0; not stable v1/GA).

R4 supersedes the R2 acceptance denial and supersedes the R3 zero-wire-contract-byte sentence.
Those clauses correctly prevented earlier proposal and cleanup scopes from silently accepting the
packet, but they cannot remain the terminal disposition after a separately reviewed atomic
acceptance. R4 permits governance-metadata and digest-only contract edits. It permits no wire semantic
change: no JSON Schema constraint, property, required field, `$ref`, denial class,
fixture payload, endpoint, or runtime behavior may change. All 18 fixture bytes remain byte-identical.

The Codex Governor authorizes exactly 21 paths for R4, and no other:

1. `docs/adr/DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE.md`
2. `docs/adr/ADR-0013-transport-peer-evidence-adapter-profile.md`
3. `docs/releases/GATE-W2-K-TRANSPORT-PEER-EVIDENCE-ACCEPTANCE-2026-08-01.md`
4. `docs/releases/README.md`
5. `docs/adr/README.md`
6. `docs/architecture/README.md`
7. `docs/architecture/transport-peer-evidence/README.md`
8. `docs/architecture/transport-peer-evidence/01-server-candidate-matrix.md`
9. `contracts/README.md`
10. `contracts/json-schema/README.md`
11. `contracts/examples/README.md`
12. `contracts/compatibility/README.md`
13. `tools/contract-validation/README.md`
14. `tools/contract-validation/validate-transport-peer.mjs`
15. `tools/contract-validation/tests/validate-transport-peer.test.mjs`
16. `tools/contract-validation/tests/validate-transport.test.mjs`
17. `tools/contract-validation/validate.mjs`
18. `contracts/json-schema/cybrik.transport-peer-evidence.v1.schema.json`
19. `contracts/json-schema/cybrik.transport-peer-evidence-error.v1.schema.json`
20. `contracts/examples/transport-peer/examples-manifest.json`
21. `contracts/compatibility/cybrik-suite-transport-peer-evidence-packet.v1.manifest.json`

This decision accepts the exact W2-K v0.1.0 transport peer-evidence contract for product
implementation. It is not an implementation result and grants no runtime, UAT, release, deployment, or production authority.
It selects, installs, and pins no server; Anycorn `0.20.0`
remains HOLD. A1–A7 remain open, N1 and N9 remain `requires_runtime`, and every later product,
runtime-admission, UAT, release, deployment, and production action remains separately gated.

## R5 amendment — K5 live-fact metadata/control and S1 evaluation boundary

Status: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED**. K5 authorizes metadata/control changes
only in the eight existing W2-K carriers: this decision, ADR-0013, the compatibility manifest,
`contracts/README.md`, `contracts/compatibility/README.md`, the server-candidate matrix, the W2-K
gate record, and the W2-K test. Every wire schema, fixture, member digest and aggregate digest
remains byte-identical.

Raw Anycorn `0.20.0` remains `id=anycorn`,
`artifact_scope=official_upstream_distribution`, unselected, `installed=false`, `pinned=false` and
HOLD with its High finding. Hypercorn and Granian receive the same artifact scope and remain
unassessed/uninstalled/unpinned. S1 admits only the distinct B1 row
`id=anycorn-cybrik-uat-b1`, version `0.20.0+cybrik.1`, for bounded isolated UAT evaluation. B1 is
`selected=false`, `installed=true`, `pinned=true`, and HOLD after the exact D1 artifact; its only install scope is
`suite_uat_tool_lock_only`. ID plus artifact scope is authoritative, so PEP 440 public-version
equivalence cannot collapse B1 into the raw release.

`D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN` is the current live-fact amendment. The packet
retains `server_neutral=true` and `selected_server=null`. D2 remains **HOLD**.
UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO. The completed D1 facts grant no runtime, release,
deployment, or production authority.
