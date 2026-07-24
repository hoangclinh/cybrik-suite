# contracts/json-schema

Status: `PROPOSED` packet present — **NOT ACCEPTED**. Format pin: JSON Schema 2020-12 (ADR-0001 D4).

Shared data object schemas. The first cross-product contract packet lives here, all statused
`PROPOSED — NOT ACCEPTED` (`x-cybrik-status`), contract version 0.1.0:

- `cybrik.common-defs.v1` — shared primitives (digests, ids, tenant, trace, risk/isolation, markings, actor, objectRef).
- `cybrik.data-marking.v1` — structured TLP/classification/handling marking.
- `cybrik.envelope.v1` — CloudEvents-style cross-product envelope (ADR-0006 E1).
- `cybrik.capability.v1` — signed, digest-pinned capability registry entry (ADR-0004).
- `cybrik.tool-execution-request.v1` / `cybrik.tool-execution-result.v1` — invocation request/result.
- `cybrik.delegation-chain.v1` — digest-bound delegation chain (ADR-0006 E3).
- `cybrik.execution-receipt.v1` — control-plane-signed receipt (ADR-0004 F6 / ADR-0006 E5).
- `cybrik.approval-request.v1` / `cybrik.approval-decision.v1` — approval-ingress pair (ADR-0004 F9 / RB-001).

Inventory and cross-artifact digest bindings: `../compatibility/cybrik-suite-contract-packet.v1.manifest.json`.
Conformance fixtures: `../examples/`. Moving any file out of `PROPOSED` requires explicit Founder approval.

## W2-F internal service-delegation packet (additive; `ACCEPTED FOR IMPLEMENTATION`, v0.1.0)

Disjoint `cybrik.svc-*` schemas realizing the ADR-0006 E2/E3 two-layer trust seam (ADR-0008),
accepted at Gate W2-F (2026-07-24). They **reuse** `cybrik.common-defs.v1` and
`cybrik.data-marking.v1` by `$ref`, unmodified:

- `cybrik.svc-common-defs.v1` — shared identity/delegation primitives (asymmetric-only `jwtAlg`,
  `jti`, `certThumbprint`/`cnf`, SPIFFE `spiffeId`/`trustDomain`, `issuerId`/`audienceId`, `scope`,
  `operationRef`, RFC 8693 `actorClaim`, `secretRef`/`jwksRef` references, opaque `orgNodeRef`).
- `cybrik.svc-delegation-token.v1` — decoded RFC 9068 `at+jwt` delegation token: asymmetric header,
  `cnf`-bound, strict `iss`/`aud`/`iat`/`nbf`/`exp`/`jti`, and the CYBRIK
  tenant/actor/operation/marking authorization claims.
- `cybrik.svc-delegation-request.v1` — relying-party validation view binding the token to the mTLS
  transport and the advisory body (`additionalProperties:false`: no static bearer / forwarded user
  token).
- `cybrik.svc-trust-metadata.v1` — pinned trust config with fail-closed constants
  (`max_token_ttl_seconds` const 120, `require_cnf`/`require_mtls` const true, asymmetric-only
  `accepted_algs`, non-empty `accepted_issuers`).

Inventory: `../compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json`. Fixtures:
`../examples/svc/`. No server/endpoint, no MCP/tool authority, no inline key material.
