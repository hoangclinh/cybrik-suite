# Founder Decision Packet — W2-I inference path ownership

- Status: `DECIDED — OPTION A — W2-D SINGLE OWNER`
- Prepared: 2026-07-26
- W2-D lifecycle: `ACCEPTED FOR IMPLEMENTATION` v0.1.0; unchanged
- W2-I lifecycle: `PROPOSED — NOT ACCEPTED`; Gate `NOT OPENED`
- Release impact: none; this packet changes no W0–W6 date and certifies no runtime

This packet resolves documentation/contract ownership before any possible W2-I acceptance. It
does not accept W2-I, change an accepted OpenAPI byte, authorize product implementation, or
declare an operational endpoint.

## 1. Confirmed current state

The accepted W2-B Fabric mapping and accepted W2-D inference mapping are disjoint:

- W2-B owns six Fabric operations under capabilities, invocations, receipts, and approvals;
- W2-D owns four inference operations:
  `GET /api/v1/model-classes`,
  `GET /api/v1/model-classes/{model_class}/health`,
  `POST /api/v1/inferences`, and
  `POST /api/v1/summarizations`.

The W2-I proposal repeats exactly those four W2-D path+method pairs to add global AND-required
`mutualTLS` plus `delegationToken` security. This is proposal overlap, not an accepted-versus-
accepted collision and not current runtime evidence. All three OpenAPI documents omit `servers`.

Authoritative sources:

- `cybrik-suite:contracts/openapi/cybrik-ai-inference-plane.v1.openapi.yaml`;
- `cybrik-suite:contracts/openapi/cybrik-ai-inference-transport-plane.v1.openapi.yaml`;
- `cybrik-suite:contracts/compatibility/cybrik-suite-inference-transport-packet.v1.manifest.json`.

## 2. Decision requested

| Option | Meaning |
|---|---|
| **A — Single-owner compatible revision (recommended)** | W2-D remains the sole owner of the four inference operations. W2-I is treated as a candidate security-binding revision/supersession of the W2-D OpenAPI member, never as a second independent path owner. A later bounded gate must define the compatible version transition and status-flip evidence. |
| B — Standards-based overlay | Keep W2-D as owner and represent W2-I only through a separately pinned OpenAPI Overlay profile/toolchain. This adds a new standard/tooling gate and remains unaccepted until that evidence is complete. |
| C — Reject/defer W2-I | Keep W2-D unchanged and leave transport enforcement entirely to product-local implementations until a new proposal is prepared. |

Option A is recommended because it preserves one canonical operation owner and keeps the
machine-readable mTLS/delegation binding in the same governed OpenAPI revision that owns the
operations.

## 3. Gate answers for Option A

| Gate item | Recommended answer | Decision |
|---|---|---|
| G-W2I-1 — W2-D is the sole current owner of the four inference path+method pairs | Yes | **Yes — Founder, 2026-07-26** |
| G-W2I-2 — W2-I may not be accepted as an independent second OpenAPI path owner | Yes | **Yes — Founder, 2026-07-26** |
| G-W2I-3 — transport security binding must enter through a separately reviewed compatible W2-D revision/supersession | Yes | **Yes — Founder, 2026-07-26** |
| G-W2I-4 — accepted W2-D bytes remain unchanged until that later status-flip change | Yes | **Yes — Founder, 2026-07-26** |
| G-W2I-5 — all mappings remain `NO SERVER / NO ENDPOINT`; deployment and credentials stay product-owned | Yes | **Yes — Founder, 2026-07-26** |

## 4. Required follow-on if Option A is selected

The follow-on change must:

1. define the exact pre-v1 compatibility/version transition under ADR-0001;
2. state which filename/manifest member supersedes the accepted W2-D OpenAPI mapping;
3. preserve all four W2-D request/response schema bindings;
4. add the W2-F-derived mTLS plus certificate-bound delegation requirements without granting
   tool, agent, approval, or model authority;
5. provide positive/negative transport fixtures, per-member hashes, OpenAPI validation, and a
   consumer compatibility matrix;
6. keep W2-I `PROPOSED` until an explicit, separately recorded status flip.

The current W2-I validator already proves proposal consistency. It does not prove the version
transition, product transport, real mTLS, JWT/JWKS verification, or any deployed endpoint.

## 5. Recorded Founder decision

- Option: **A — Single-owner compatible revision**
- G-W2I-1..5: **yes**
- Conditions: W2-I remains proposed; any transport binding must enter through a separately
  reviewed compatible W2-D revision/supersession and separate status-flip evidence.
- Decided by: **Founder**
- Decided on: **2026-07-26**
- Decision evidence: exact W0 Bundle A response recorded in
  `cybrik-suite:docs/adr/FOUNDER-DECISION-QUEUE-W0.md`.

W2-I remains `PROPOSED — NOT ACCEPTED`; W2-D is the sole accepted owner of the four inference
operations, and accepted W2-D bytes remain unchanged.
