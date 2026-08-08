# Delegated Governor Decision — F8 receipt-integrity contract profile

- **Effective timestamp:** `2026-08-03T06:48:44+07:00`
- **Governance date / timezone:** `2026-08-03` / `Asia/Ho_Chi_Minh`
- **Decider:** Codex Governor under
  `docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md`
- **Reviewed base:** `745237dcd7a4c446234cee3b79e14c835fedf853`
- **Gate:** `F8-RECEIPT-INTEGRITY-PROFILE`
- **Decision:** `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`
- **Runtime / product / UAT / release / deployment:** `NOT AUTHORIZED`
- **Production:** remains Founder-controlled
- **Release dates:** unchanged

## 1. Scope

This decision accepts only the Suite-owned F8 v0.2.0 receipt-integrity contract profile and its
static conformance evidence. The accepted profile consists of compact JWS with an included JCS
payload, RFC 8785 canonicalization, RFC 7638 unpadded base64url key identifiers, and Ed25519-only
signatures. It authorizes product teams to implement against these contract semantics after the
separate prerequisite gates below pass.

The accepted `cybrik.execution-receipt.v1` and `cybrik.common-defs.v1` bytes remain unchanged.
This decision changes only F8 lifecycle/governance metadata, F8 documentation, packet digests, and
the validator/tests that fail closed on those declarations. It does not alter a wire property,
constraint, required-field list, fixture payload, compact JWS, receipt digest, or signature.

## 2. Decisions

1. **F8-Q1 / OD-F8-1 — compact JWS + JCS:** accepted. The existing corpus is JSON-native and the
   chosen profile introduces no new wire-format dependency. A COSE or in-toto implementation is
   not an acceptance prerequisite; the absence of a second implementation remains an evidence
   limitation.
2. **F8-Q2 / OD-F8-2 — canonicalization:** accept RFC 8785 JCS.
3. **F8-Q3 / OD-F8-3 — key identifier:** accept RFC 7638 unpadded base64url thumbprint rendering;
   reject the earlier private hexadecimal rendering.
4. **F8-Q4 / OD-F8-4 — algorithm:** accept Ed25519-only with no in-band algorithm negotiation. A
   future migration requires a new profile version and separate acceptance.
5. **F8-Q5 / OD-F8-5 — lifecycle sequencing:** key-lifecycle and trust-bundle design remains a
   mandatory gate before runtime implementation.
6. **F8-Q6 / OD-F8-6 — signed-v1 digest semantics:** the F8 profile is authoritative for signed-v1
   receipt digests, excluding both `receipt_digest` and `signature`. The divergent prose in the
   accepted receipt schema is documented but its bytes are not repaired or versioned by this
   decision.
7. **F8-Q7 / OD-F8-7 — trust-bundle reference:** accept the signed `trust_bundle_ref` as
   signing-time provenance. Retention, revocation, freshness, distribution, and compromise
   recovery remain mandatory open key-lifecycle work.

## 3. Evidence

- The pre-acceptance packet validator passed with 10 packet files, two positive fixtures, four
  negative fixtures, seven rejection rules, 24 mutation probes, one explicit accepted-contract
  divergence, and one historical-rotation verification case.
- The focused pre-acceptance Node suite passed `34/34`; it includes strict raw-JSON admission,
  RFC 7638 kid reproduction, frozen Ed25519 signing/verification, exact forbidden-header probes,
  digest divergence evidence, rotation verification, official Ajv 2020-12 compilation, and
  accepted receipt-schema conformance.
- An independent F8 security review returned `GO` for contract-only acceptance with no open P0,
  P1, or P2 finding. It confirmed closure of the former nonstandard-kid and duplicate protected-
  header findings while retaining runtime/key-lifecycle gaps.
- At the reviewed base, the accepted reference schemas had no Git diff. Their SHA-256 values were
  `423ce118ae1ddabb0b3d1f13a65526e761356b9f14aa9974555976812cc0839d` for
  `cybrik.execution-receipt.v1` and
  `cecc415ca472eb841985517504fdc721ab303f977f0a2fa1998c37c3514116c0` for
  `cybrik.common-defs.v1`.
- Acceptance application is test-first: the focused suite was changed first and produced an
  intended RED on the still-`PROPOSED` status, absent `decisions`, and absent decision record.

## 4. Remaining findings

All four manifest prerequisites remain `OPEN`: credential lease, workload attestation, production
issuer/signer, and key lifecycle. Key generation, retention, rotation, revocation, trust-bundle
distribution/freshness, compromise recovery, signing authorization, HSM/KMS placement, and ledger
durability are not implemented.

The static packet has no independent JOSE implementation result, no RFC 8785 conformance-suite
result, and no formal threat model. These are implementation-evidence gaps, not permission to
weaken the accepted profile. The accepted receipt-schema prose remains visibly divergent; product
implementation of signed-v1 receipts must follow this F8 profile's two-key exclusion rule.

## 5. Action

Apply the exact lifecycle state `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED` to the F8 packet,
its two schemas, examples manifest, member inventory, and F8-specific catalogs. Record OD-F8-1
through OD-F8-7 as decided, recalculate every affected raw member digest plus manifest self and
aggregate digests, and keep the validator fail-closed on all acceptance and non-implementation
metadata.

This is contract-only acceptance. Runtime, signer/issuer, product wiring, UAT, demo, release,
deployment, stable-v1/GA, and production remain outside this action. Runtime is NOT AUTHORIZED.

## 6. Rollback

Before any product implementation consumes this profile, rollback is a bounded revert of this
acceptance application's F8 lifecycle metadata, decision/catalog additions, validator/test
expectations, and recut packet digests. The v0.2.0 proposal bytes remain recoverable from the
reviewed base and the pre-acceptance member/aggregate digests in repository history and evidence.

After a product implementation begins, do not silently revert or reinterpret wire semantics.
Supersede the profile with an explicitly versioned contract and migration decision. Rollback never
authorizes deletion or mutation of durable receipts, production keys, trust bundles, or audit
evidence. Production remains Founder-controlled.
