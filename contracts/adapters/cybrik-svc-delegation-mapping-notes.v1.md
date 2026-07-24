# CYBRIK service-delegation → inference-operation mapping notes v1

Status: **ACCEPTED FOR IMPLEMENTATION** (v0.1.0; not stable v1/GA). Accepted at Gate W2-F
(Codex under Founder delegation, 2026-07-24). Acceptance authorizes contract-first implementation
at v0.1.0; it is **not** a stable v1/GA promotion and **not** an ADR-0001 immutable bundle tag.

Contract version: 0.1.0 · ADR basis: ADR-0006 (E2/E3 two-layer trust seam), ADR-0008 (internal
service-delegation profile), ADR-0001 (versioning).

## Purpose and the identity/wire boundary

This note records how a W2-F **delegation token** authorizes a **W2-D inference operation** across
the internal SOC → Cyber AI seam. It exists to make one boundary explicit and durable:

> **A delegation token names a neutral operation token only; it never imports, modifies, or
> re-states any W2-D schema, and it grants no tool/agent authority.**

The W2-F packet governs the **identity/delegation seam in front of** the W2-D inference operations.
The two packets are **additive and disjoint**: W2-F introduces the `cybrik.svc-*` namespace; W2-D
owns the `cybrik.model-*` / `cybrik.alert-summarization-*` namespace, unchanged and referenced only
by a vendor-neutral `cybrik.operation` token.

This is a mapping note, not a runtime, SDK, client, or deployment. It declares **no** servers,
hosts, routes, channels, endpoints, URLs, credentials, or key material. `$id`s in the referenced
schemas use the RFC 2606 `.example` documentation domain as identifiers, not endpoints.

## Operation-token mapping (delegation → W2-D)

The `cybrik.operation.name` claim is a dotted, vendor-neutral token. It **names** a downstream
W2-D operation without carrying any W2-D field:

| `cybrik.operation.name` | Downstream W2-D operation (named, not imported) | Governing W2-D schema (unchanged) |
|---|---|---|
| `ai.inference.create` | Create a model-inference request | `cybrik.model-inference-request.v1` |
| `ai.summarization.create` | Create an alert-summarization request | `cybrik.alert-summarization-request.v1` |

The mapping is a **naming convention only**. The delegation token authorizes the *right to invoke*
the named operation up to its `max_risk_class` and `cybrik.marking`; the W2-D request body itself
is validated by the W2-D packet, separately. No W2-D field (`model_class`, `redaction_policy`,
`limits`, `alert_refs`, …) appears in, or is constrained by, the W2-F token.

## What the token carries vs. what the relying party re-derives

| Concern | On the delegation token (authoritative) | Advisory request body (never elevates) |
|---|---|---|
| Tenant | `cybrik.tenant_id` | `tenant_id` — MUST equal the token; mismatch rejected |
| Actor | `cybrik.actor` (tenant-scoped, RFC 8693 delegation) | `actor` — audit correlation only |
| Operation | `cybrik.operation.name` | `operation.name` — MUST equal the token; mismatch rejected |
| Data marking ceiling | `cybrik.marking` (highest authorized) | `data_marking` — MUST be `<=` the token on the lattice |
| Org scope | `cybrik.org_scope` (opaque/advisory) | `org_scope` — MUST match when present; no authority alone |
| Proof-of-possession | `cnf['x5t#S256']` | mTLS `peer_cert_thumbprint` — MUST equal `cnf` |
| Audience | `aud` (single value) | relying party `self_audience` — MUST equal `aud` |

The relying party (Cyber AI) validates signature + RFC 8725 strict `iss`/`aud`/`exp`/`nbf`/`jti`
**before** consulting the body, then re-authorizes the named operation. It never trusts the body
over the token, nor the token over the mTLS peer certificate.

## Trust invariants the delegation seam MUST preserve

1. **Sender-constrained, never bearer.** The mTLS peer certificate thumbprint MUST equal
   `cnf['x5t#S256']` (RFC 8705); a token presented without its bound client certificate is
   rejected. `require_cnf` and `require_mtls` are const `true`.
2. **Short-lived by construction.** `exp - iat <= 120s` (const ceiling); an over-long token is
   rejected even if currently within its window, and even if the signature verifies.
3. **Asymmetric, pinned trust.** `alg` is asymmetric-only (no `HS*`/`none`); `iss` MUST be pinned
   in `accepted_issuers` and `kid` MUST resolve to a pinned JWKS key; verification fails closed
   when trust cannot be resolved (offline/air-gapped included).
4. **Single strict audience.** `aud` is a single value matched exactly to the relying party's
   `self_audience` (confused-deputy defense; RFC 9700 §2.3).
5. **No forwarded user token, no static bearer.** Delegation is the RFC 8693 `act`/actor claim;
   the request view is `additionalProperties: false`, so an `on_behalf_of_user_token` or inline
   `authorization` bearer has nowhere to live.
6. **No tool/agent authority.** A delegation token authorizes a named inference/summarization
   operation only. It grants **no** tool/function/MCP/shell authority and MAY only *reference* an
   accepted `cybrik.delegation-chain.v1` tool grant (`cybrik.delegation_ref`) for correlation —
   never substitute for it. Tool execution stays governed by the Tool-Fabric packet (ADR-0004).
7. **Replay / rotation / revocation are runtime, fail-closed.** The relying party keeps a `jti`
   replay cache, handles JWKS `kid` rotation and issuer/kid revocation, and audits each decision.
   JSON Schema cannot track cross-request or wall-clock state; these are required of every
   implementation and are **not** proven by a green validator run.

## Out of scope

The Tool-Fabric tool-grant chain and MCP servers/tools/actions (ADR-0004); the transport issuer
choice — SPIRE vs. minimal internal CA (ADR-0004 F4/F8); durable agent orchestration / bus
(ADR-0003); sandbox substrate (ADR-0005); the org-hierarchy contract delta (ADR-0007, `org_scope`
opaque/advisory only here); the external-authority (A05) boundary, which is a distinct trust
context whose identities are never accepted at this internal seam (ADR-0007 OD-3). None of these
is decided or implemented by this note.
