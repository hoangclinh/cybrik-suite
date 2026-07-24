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

## W2-G organizational-hierarchy packet (additive; `ACCEPTED FOR IMPLEMENTATION`, v0.1.0)

Disjoint `cybrik.org-*` schemas realizing the ADR-0007 org-hierarchy & external-authority model
(ADR-0009), accepted at Gate W2-G (2026-07-24). They **reuse** `cybrik.common-defs.v1` and
`cybrik.data-marking.v1` by `$ref`, unmodified:

- `cybrik.org-common-defs.v1` — shared org primitives (`tierOrdinal`, `labels`/`labelKey`,
  `orgNodeStatus`, `jurisdiction`/`residencyZone` policy-as-data, `smallCellFloor` const 5,
  `grantTemporal` expiry/revocation/`audit_ref` envelope).
- `cybrik.org-node.v1` / `cybrik.org-node-lifecycle.v1` (D-1) — governance-tree node (tier is DATA,
  no fixed tier names; tree not DAG; external node has null `parent_id`) + governed lifecycle
  (`suspend|reactivate|archive|restore`, no hard-delete; backfill only on archive).
- `cybrik.org-membership.v1` (D-2) — actor → internal node → role; `node_boundary_kind` const
  `internal`, `confers_descendant_raw` const `false`.
- `cybrik.org-scope-grant.v1` (D-4, D-7) — the INV-1 raw/aggregate split (ancestor-governance is
  aggregate-only; descendant raw requires an explicit-descendant-grant + non-empty `raw_scope`) +
  the loud, self-revoking break-glass block (k=900s default, 3600s ceiling, second approval).
- `cybrik.org-edge.v1` (D-5) — typed governance/exchange edge; `parent`/`tasking` never confer raw
  read; external is never a `parent` ancestor.
- `cybrik.org-external-exchange.v1` (D-6) — A05 crossing: distinct `external-distinct` auth (no
  internal token), mTLS + signed-envelope + replay floor, `auto_execute` const `false`, inbound
  lands in a review queue.
- `cybrik.org-aggregate-request.v1` / `cybrik.org-aggregate-result.v1` (D-8) — de-identified roll-up;
  request `scope_kind` const `aggregate`; result cells `count` `minimum:5`, no raw `object_refs`.

Inventory: `../compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json`. Fixtures:
`../examples/org/`. No server/endpoint, no MCP/tool authority, no inline key material.
