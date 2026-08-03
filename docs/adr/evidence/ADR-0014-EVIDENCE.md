# ADR-0014 evidence — receipt trust and durability

Status: `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`

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

The proposal adds a Node validator and mutation suite that check:

- exact packet membership and SHA-256 values;
- exact proposal lifecycle and non-claims;
- accepted-source reuse pins;
- public-only Ed25519 bundles and RFC 7638 `kid` reproduction;
- monotone generation and key states, predecessor key retention, and single-active signing;
- durable intent-before-dispatch and receipt-before-result ordering;
- fail-closed completion mapping, append-only records, replay without re-signing, and retention
  coupling;
- release-date immutability and Founder-controlled production.

Green static evidence is not a runtime claim. The test fixtures use public deterministic values
only and contain no private signing key, credential, customer data, or production configuration.

## Alternatives considered

1. Documentation only: rejected because the two design gates would have no executable evidence.
2. A new OpenAPI route profile: rejected because W2-B and C1 already authorize contract-first use
   of the generic route profile; duplicating it risks drift and overclaim.
3. A Suite-selected database or KMS: rejected as Fabric ownership overreach.
4. Deleting retired verification keys: rejected because it makes retained receipts unverifiable.
5. Re-signing on replay: rejected because one execution could acquire multiple content addresses.

## Evidence limitations

- No product runtime implements this proposal.
- No live key generation, distribution, rotation, revocation, signing, or verification was run.
- No database, migration, failover, backup, restore, or rollback exercise was run.
- JSON Schema proves shape only; the Node validator supplies the cross-document semantic checks.
- Independent review and any acceptance decision remain pending.
