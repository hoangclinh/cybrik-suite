# W1 SOC to Cyber AI lifecycle-create golden SOSIM evidence

Status: `ACTIVE CANDIDATE EVIDENCE — TEST-ONLY — SOSIM — NOT UAT — NOT mTLS — NOT DEPLOYMENT — NOT RELEASE PROOF`.

Date: 2026-07-31.

## 1. Purpose and boundary

This packet records the smallest Suite-owned cross-product proof for the admitted
SOC-to-Cyber-AI lifecycle-create seam. It executes real product classes in one Python process:

- SOC `LifecycleCreateClient` and `AsymmetricJwtDelegationIssuer`;
- Cyber AI FastAPI lifecycle ingress, delegation verifier, relying party, and investigation
  service;
- `httpx.ASGITransport` between the two product surfaces.

The positive path injects a **test-only** trusted-transport resolver. No TLS handshake,
certificate-chain validation, revocation check, socket, container, database, deployment, or
hosted multi-repository checkout is exercised. The proof therefore must not be relabeled as
UAT, mTLS, deployment readiness, or release readiness.

## 2. Pinned candidate lineage and immutable product tuple

| Repository | Commit | Tree |
|---|---|---|
| Suite base | `ae0998ea7661fd47bb33d7328c4f811671429a72` | `3e6a02b12892c25c73bd0d392de0f0c6b6665e10` |
| SOC Command Center | `abfdfde96afc6daa2868694de993c623daa8862e` | `241ef24a33246918ff5cf133e7d8d004823fdf06` |
| Cyber AI Platform | `a7defd3a7b41faa8e654d6d7567cb2e59b9363fb` | `81e58824d95f800d8e6d424c25207901aceaccfa` |

The runner rejects a product checkout unless both its commit and tree match this tuple and the
checkout is clean. It also requires a clean Suite checkout descended from the pinned Suite base
and exact equality between Suite `HEAD` and the externally supplied reviewed-candidate commit.
That required external input avoids a self-referential in-file commit hash while still binding a
review or CI execution to exact Suite harness bytes.

## 3. RED-first and GREEN evidence

The initial targeted positive test imported both product packages at the exact pins and failed
only at the intentional composition placeholder:

```text
NotImplementedError: SOSIM lifecycle application composition is incomplete
1 failed in 0.26s
```

After composition, the exact runner invocation passed:

```text
....                                                                     [100%]
4 passed in 0.22s
```

This local result covers:

1. trusted create using exact audience `svc:cyber-ai-lifecycle`, operation
   `investigation.create`, and singleton scope `investigation.lifecycle:create`;
2. full tenant, organization, service actor, delegator, and marking preservation in the
   returned status;
3. deny-all transport failing closed through the SOC client's sanitized error while producing
   no run state;
4. absence of status, cancel, checkpoint, and bundle methods from the SOC client surface; and
5. the synthetic fixture's Suite-base lineage, exact product-pin tuple, and explicit nonclaims.

## 4. Secret and trust posture

The test generates an ephemeral ES256 private key at runtime. The key remains in process memory,
is never written or printed, and is exposed to Cyber AI only as a public JWK. The fixture stores
no token, private key, certificate, customer identifier, production log, or hosted-environment
fact. Cyber AI performs real signature, pinned-trust, claim, scope, and proof-of-possession
verification and composes the real replay guard; only the peer transport identity is supplied by
a test fake. This four-test Suite slice does not itself exercise duplicate-token replay refusal.

## 5. Gate disposition and remaining blockers

This candidate may establish a create-only cross-product **SOSIM** gate after bounded review and
the Suite repository's required hosted checks pass on the exact candidate head. It cannot close
integrated UAT.

True integrated UAT remains blocked on deployment-supplied transport attestation, demonstrated
shared runtime signer/trust-provider composition, and the applicable runtime-admission record.
SOC status/cancel lifecycle support is also outside this create-only slice. Release dates remain
unchanged, and production remains Founder-controlled.
