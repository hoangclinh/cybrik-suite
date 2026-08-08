# ADR-0014 — Receipt signer trust and durability profile

- Status: `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`
- Date raised: 2026-08-03
- Decider: Codex Governor under Founder-delegated authority after independent review
- Scope: Suite contract for Fabric-owned receipt trust and durable completion semantics
- Evidence: [ADR-0014 evidence](evidence/ADR-0014-EVIDENCE.md)

## Context

The accepted F8 profile fixes signed receipt bytes, Ed25519, RFC 8785 JCS, RFC 7638 `kid`, and
offline trust-bundle lookup. It deliberately leaves key lifecycle, bundle distribution, signer
placement, and ledger durability open. The accepted W2-B `createInvocation` and `getReceipt`
mapping notes already authorize contract-first route-profile implementation, and the accepted C1
binding reuses them byte-unchanged. This ADR therefore does not duplicate or reopen the route.

Before this decision, the UAT admission gate remained `HOLD` on two implementation-phase decisions:

- key lifecycle and trust-bundle design;
- durable receipt-store design and observable failure semantics.

These decisions are coupled: retaining a receipt longer than its verification keys produces a
durable but unverifiable security record.

## Decision

Adopt `cybrik.receipt-trust-bundle.v1` and `cybrik.receipt-durability-statement.v1` as a
provider-neutral design floor. This acceptance authorizes Fabric to implement against the profile.
It does not authorize runtime, UAT,
deployment, release, or production.

### Trust-bundle lifecycle

1. Bundle generations increase monotonically and identify their immediate predecessor.
2. A successor retains every predecessor `kid`; a key leaves signing service through a monotone
   state transition, never deletion.
3. States are `active → retiring → retired`, with any state able to transition to `revoked`.
   Revocation is terminal and carries time, reason, and whether it is prospective or retroactive.
4. At most one receipt-signer key is active in a generation.
5. Bundles contain public OKP/Ed25519 material only. `kid` is recomputed from the RFC 7638
   thumbprint; private `d` material is forbidden.
6. Verification is offline. `bundle_uri` is an identifier, never a fetch instruction. Missing or
   stale local bundle state fails closed.
7. The `bundle_digest` already signed by F8 remains signing-time provenance. A verifier may use a
   later locally held bundle when it retains the same `kid`; equality with the historical bundle
   digest is not silently introduced as a verification precondition.

### Durable completion

1. Fabric durably commits an authoritative invocation intent before dispatch.
2. Fabric signs, durably commits, and read-after-write verifies a completion receipt before a
   completed result is released.
3. Failure to durably commit a required receipt never maps to `completed`; it exposes no
   `receipt_id`, business output, or success claim.
4. Application runtime cannot update or delete committed receipts. A future correction or
   supersession mechanism requires a separately versioned contract.
5. An idempotent replay returns the exact stored receipt and never signs again.
6. Receipt retention cannot exceed retention of the bundle generations needed to verify it.
7. The contract fixes ordering and observable failure semantics, not the database, replication,
   backup, RPO, RTO, HSM, KMS, or distribution product.

## Ownership

- `cybrik-suite` owns these cross-product contracts and static evidence only.
- `cybrik-security-tool-fabric` owns signer authorization, key generation, trust distribution,
  durable ledger, storage implementation, and runtime authority.
- SOC continues to own alert, case, analyst, tenant, and policy truth.
- Cyber AI continues to own model and orchestration semantics and may never sign a receipt or
  author a trust bundle.

## Acceptance criteria

Acceptance requires all of the following in one bounded review:

1. exact member and reuse-pin hashes recompute from repository bytes;
2. the proposal lifecycle cannot half-flip or self-accept;
3. RFC 7638 identity, public-only material, generation, retention, and key-state tests pass;
4. durable ordering, failure mapping, append-only, no-resign, and retention-coupling tests pass;
5. validator branch coverage remains at least 80%;
6. independent review reports no open P0, P1, or P2;
7. release dates remain unchanged and production remains Founder-controlled.

Acceptance of this ADR and packet closes design only. The bounded gate record in the same reviewed
change records that closure. Product implementation, hosted CI, current-tree coverage, runtime negatives,
rollback evidence, and integrated UAT would remain separate gates.

## Open product decisions

Fabric must separately choose and review:

- production HSM/KMS and signing authorization policy;
- key ceremony, bundle distribution, operating freshness, and compromise runbook;
- ledger engine, tenant isolation, replication, backup, restore, RPO, RTO, and retention period;
- any receipt correction or supersession contract.

These choices may strengthen the profile but may not weaken its fail-closed floor.

## Non-claims and rollback

This acceptance creates no signer, key, ledger, endpoint, deployment, runtime, UAT, release, GA, or
production authority. Static green validates packet integrity and named fixtures only.

Before product implementation, rollback is a bounded revert of this accepted packet, validator,
tests, catalogs, and docs. After durable receipts exist, rollback must never delete or mutate them;
the profile must be superseded through an explicit versioned decision.
