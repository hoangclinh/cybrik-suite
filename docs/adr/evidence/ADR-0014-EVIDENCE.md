# ADR-0014 evidence — receipt trust and durability

Status: `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`

## Confirmed inputs

- `contracts/compatibility/cybrik-suite-receipt-integrity-proposal.v1.manifest.json` accepts the
  F8 signature profile but leaves key lifecycle, production signer, and durable ledger open.
- `docs/adr/DELEGATED-GOVERNOR-DECISION-F8-RECEIPT-INTEGRITY.md` makes key lifecycle and
  trust-bundle design mandatory before runtime implementation.
- `docs/adr/ADR-0004-tool-fabric-control-plane-executor-split.md` fixes receipt signing and ledger
  authority in the Fabric control plane and keeps signing keys out of executors.
- `contracts/openapi/cybrik-fabric-control-plane.v1.openapi.yaml` contains accepted contract-first
  `createInvocation` and `getReceipt` mapping notes, with no operational server or deployment.
- `contracts/compatibility/cybrik-suite-alert-context-transport-binding.v1.manifest.json` reuses
  those operations byte-unchanged and does not grant runtime or deployment authority.

The packet pins the exact bytes of these three contract sources. It changes none of them.

## Executable evidence

The accepted packet adds a Node validator and mutation suite that check:

- exact packet membership and SHA-256 values;
- coherent proposed/accepted not-implemented lifecycle and exact non-claims;
- accepted-source reuse pins;
- public-only Ed25519 bundles and RFC 7638 `kid` reproduction;
- monotone generation and key states, predecessor key retention, and single-active signing;
- durable intent-before-dispatch and receipt-before-result ordering;
- fail-closed completion mapping, append-only records, replay without re-signing, and retention
  coupling;
- release-date immutability and Founder-controlled production.

Green static evidence is not a runtime claim. The test fixtures use public deterministic values
only and contain no private signing key, credential, customer data, or production configuration.

## Independent proposal review and acceptance measurement

- Proposal commit: `fb93534810618e93c5b5e95e06b482030824b558`.
- Proposal tree: `38cd2780ea82ba8d37c7cc295c45b389fd0e8f8e`.
- Reviewed 32-path aggregate SHA-256: `6b0bcc5c87f3fa05236094791bd75d1344aaf1acd2554e3e0cb3e320dae50aca`.
- Proposal-diff internal independent review: GO with no open P0, P1, or P2.
- Proposal-diff Claude Opus independent review: GO with no open P0, P1, or P2.
- Acceptance reconciliation measurement on Node.js 26.0.0:
  `node --experimental-test-coverage --test tools/contract-validation/tests/validate-receipt-trust-durability.test.mjs`
  produced 22/22 tests and 95.99% line, at least 89.03% branch, and 96.15% function coverage.
  The coordinator reproduced 89.03% branch in three consecutive runs with the declared dependency
  root; the independent Opus review observed 89.41% with a separate byte-identical locked
  dependency tree. The acceptance decision records the conservative lower observed value and the
  only gated conclusion: branch coverage remains above the 80% floor in both environments.
- Runtime-producer gate measurement on Node.js 26.0.0:
  `node --experimental-test-coverage --test tools/operations/tests/validate-fabric-runtime-producer-gate.test.mjs`
  produced 13/13 tests and 80.82% line, 89.74% branch, and 87.50% function coverage.
- Tree checks: JSON parse, syntax, diff integrity, and current-tree gitleaks all green.

The delegated acceptance closes only the two design prerequisites. The machine gate remains
runtime `HOLD` on product implementation/review, canonical hosted CI, runtime negative/rollback
evidence, and current-Suite-tree coverage.

## Alternatives considered

1. Documentation only: rejected because the two design gates would have no executable evidence.
2. A new OpenAPI route profile: rejected because W2-B and C1 already authorize contract-first use
   of the generic route profile; duplicating it risks drift and overclaim.
3. A Suite-selected database or KMS: rejected as Fabric ownership overreach.
4. Deleting retired verification keys: rejected because it makes retained receipts unverifiable.
5. Re-signing on replay: rejected because one execution could acquire multiple content addresses.

## Evidence limitations

- No product runtime implements this accepted design.
- No live key generation, distribution, rotation, revocation, signing, or verification was run.
- No database, migration, failover, backup, restore, or rollback exercise was run.
- JSON Schema proves shape only; the Node validator supplies the cross-document semantic checks.
- Clean-clone `npm ci`, aggregate 25-step validation, hosted CI, and product runtime remain pending.
