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

The previously delegated Governor authority recorded in
`../../docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md` is the accepted exception for the
F8 contract-only decision; it does not replace this generic rule for other proposals. Runtime,
UAT, release, and deployment remain separately gated, and production remains Founder-controlled.

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

## W0-I01 Investigation/Claim/Evidence/Bundle packet (additive; `ACCEPTED FOR IMPLEMENTATION`, v0.1.0)

Disjoint `cybrik.investigation-*` / `cybrik.claim.*` / `cybrik.evidence.*` /
`cybrik.investigation-bundle.*` schemas closing the roadmap Week 0 schema gap ("Investigation/
Claim/Evidence/Capability/Receipt schemas v0"; Capability and Receipt already exist above).
Explicit Founder Option A with G-W0I01-1..5 `yes` accepted this packet for implementation on
2026-07-26; this is not a stable v1/GA promotion and creates no runtime consumer or transport
binding. The packet **reuses** `cybrik.common-defs.v1` and `cybrik.data-marking.v1` by `$ref`,
unmodified:

- `cybrik.investigation-common-defs.v1` — shared enums (`investigationStatus`, `claimStatus`,
  `evidenceKind`, `confidenceLevel`, `abstentionReason`).
- `cybrik.investigation.v1` — the investigation record; `investigation_id` is the correlation
  anchor every other member below requires (ADR-0006 E6). `status='abstained'` requires
  `abstention_reason`; `status='closed'` requires `closed_at`.
- `cybrik.claim.v1` — a grounded assertion or an honest abstention. `status='asserted'` requires
  `confidence` and a non-empty `evidence_refs` (a claim can never assert with zero cited
  evidence); `status='abstained'` requires `abstention_reason` and forbids `confidence`.
  `statement`/`confidence` are untrusted advisory output and MUST NOT be consumed as an
  authorization, approval, or action trigger (TR-5) — that is a downstream-consumer invariant, not
  a wire-shape one, so it cannot be fixture-verified here; see the compatibility manifest's
  `runtime_only_declared_not_fixture_verifiable` for the required future consumer/authz gate.
- `cybrik.evidence.v1` — a digest-bound reference (`source_ref`) to a product-owned object,
  never an inlined copy; `excerpt` is a short, bounded pointer only.
- `cybrik.investigation-bundle.v1` — the SOC-facing response: a digest manifest of `claims`
  (`minItems: 1` — no silent-empty bundle) and `evidence`, plus its own content `digest` for
  structural replay.

None of the four carries a capability, delegation, approval, tool, or MCP field (disjoint from
ADR-0004). Inventory: `../compatibility/cybrik-suite-investigation-packet.v1.manifest.json`.
Fixtures: `../examples/investigation/`. Validator (standalone, not wired into the shared
orchestrator): `../../tools/contract-validation/validate-investigation.mjs`. No server/endpoint,
no MCP/tool authority. TR-5 remains `declared_runtime_only` until a future real-consumer
authorization gate proves advisory-only consumption.

## F8 receipt-integrity signature profile (`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`, v0.2.0)

Two disjoint `cybrik.receipt-signature-*` schemas carrying the delegated-Governor-accepted contract
answer for the receipt-signing envelope ADR-0004 F8 deferred. They **reuse**
`cybrik.common-defs.v1` and
`cybrik.execution-receipt.v1` by `$ref`, unmodified — `cybrik.execution-receipt.v1` already describes
its own `signature` field as a reference to a deferred envelope, and this is a candidate for exactly
that reference:

- `cybrik.receipt-signature-statement.v1` — the object that is actually signed. It never carries the
  receipt, only a digest binding: profile + version, the reused receipt contract `$id` + version,
  the canonicalization id, `receipt_id`, `receipt_digest`, `kid`, `signed_at`, and signing-time
  `trust_bundle_ref`. Digest profile
  `CYBRIK-RECEIPT-JCS/v1` hashes `UTF-8(profile) || 0x00 || RFC-8785-JCS(receipt)` over the *exact
  transmitted* receipt with only `receipt_digest` and `signature` removed. **No schema `default` is
  ever materialized**, so an absent `output_artifacts` and an explicitly empty one digest
  differently — the fixture pins both values to keep that provable.
- `cybrik.receipt-signature-envelope.v1` — the transport shape. An ordinary compact JWS with an
  **included** payload (never detached, never RFC 7797 `b64=false`), **EdDSA over Ed25519 only**
  (`alg=none` rejected), protected-header key set exactly `{alg, kid, typ}`, and **no key material
  anywhere**: `jwk`, `jku`, `x5u`, `x5c`, `x5t`, `x5t#S256` and `epk` are all forbidden and `kid`
  resolves only against a pinned external trust bundle. `signature_locator` is
  `cybrik-ledger://receipt-signatures/sha256/<64 hex>`, the SHA-256 of the exact compact JWS bytes,
  and is the string the receipt's own `signature` carries.

Version 0.2.0 also applies strict raw-JSON admission, removes the earlier `receipt_id` narrowing,
and exercises every forbidden JOSE header parameter. The accepted F8 profile is authoritative for
signed-v1 digest semantics and excludes both `receipt_digest` and `signature`; the reused accepted
receipt-schema bytes remain unchanged and their divergent prose remains explicitly documented.

Receipts are **control-plane observed, not executor-attested**: the Tool Fabric control plane signs
and a receipt-signing key never exists on an executor (ADR-0004 F6; ADR-0006 E5). Inventory:
`../compatibility/cybrik-suite-receipt-integrity-proposal.v1.manifest.json`. Fixtures:
`../examples/receipt-integrity/`. Validator: `../../tools/contract-validation/validate-receipt-integrity.mjs`
(`npm run validate:f8:receipt-integrity`, `npm run test:f8:receipt-integrity`). The only key in the
packet is a **TEST-ONLY** Ed25519 public JWK whose private half is derived at test runtime from
`SHA-256("CYBRIK-F8-TEST-ONLY-ED25519-SEED/v1")`; no PEM or private key exists in the tree, and that
kid must never appear in a real trust bundle. **This contract acceptance implements no runtime and
names no production signer.** Credential lease, workload attestation, a production issuer/signer,
and key lifecycle remain open prerequisites; UAT, release, deployment, and production remain
separately gated. See the manifest's `future_prerequisites` and
`../../docs/adr/DELEGATED-GOVERNOR-DECISION-F8-RECEIPT-INTEGRITY.md`.

## W2-H resource-bounds packet (`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`, v0.1.0)

The additive `cybrik.res-*` family is the accepted static contract for conserved accounting
across a call tree:

- `cybrik.res-common-defs.v1` — additive credit vector, identifiers, parent reference, sequence,
  virtual time, and derived-only authority constants.
- `cybrik.res-bounds-grant.v1` — finite root credits; an accounting grant, never permission.
- `cybrik.res-reservation-request.v1` / `cybrik.res-reservation-result.v1` — all-or-nothing
  admission that draws down the parent at reservation time.
- `cybrik.res-release.v1` — terminal accounting where consumed plus returned equals the target's
  current remainder; returned unused credits may flow only to an open parent.
- `cybrik.res-root-closure.v1` — the single terminal root record for completion and cancellation,
  where final consumed plus final unused equals the original grant bounds and the remainder is
  extinguished rather than returned or re-minted.
- `cybrik.res-bounds-error.v1` — fail-closed resource-specific errors, deliberately disjoint from
  `budget_exceeded`, `BUDGET_*`, and the inference budget error classes.

Inventory: `../compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`. Fixtures:
`../examples/resource-bounds/`. Acceptance is permission to implement later; this packet defines
no deadline or peak-memory conservation, server, endpoint, MCP tool, runtime, UAT, release,
deployment, or production surface.

## W2-K transport peer evidence (`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`, v0.1.0)

- `cybrik.transport-peer-evidence.v1` — server-neutral channel evidence with `x5t#S256`,
  serving-side chain verification, three-way thumbprint equality inputs, and no authority axis.
- `cybrik.transport-peer-evidence-error.v1` — closed TPE denial vocabulary with fail-closed true
  and degraded false.

Both schemas select no server and prove no runtime, UAT, release, deployment, or production state.
