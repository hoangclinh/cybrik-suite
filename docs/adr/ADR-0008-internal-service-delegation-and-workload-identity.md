# ADR-0008 — Internal service delegation & workload-identity profile

- Status: `ACCEPTED FOR IMPLEMENTATION` (v0.1.0; not stable v1/GA, not an ADR-0001 immutable bundle tag)
- Date raised: 2026-07-24
- Date decided: 2026-07-24
- Decider: Founder (technical Gate W2-F delegated to Codex; executed and recorded by the suite lead)
- Acceptance record: Gate W2-F decision record
  [docs/releases/GATE-W2-F-SERVICE-DELEGATION-ACCEPTANCE-2026-07-24.md](../releases/GATE-W2-F-SERVICE-DELEGATION-ACCEPTANCE-2026-07-24.md).
  Acceptance-for-implementation was authorized by explicit Founder delegation of the technical
  Gate W2-F to Codex, per ADR-0001 D5. No agent inferred approval; a green validator run is a
  conformance signal only, never acceptance by itself.
- Scope: the INTERNAL cross-service identity + application-delegation seam between
  `cybrik-soc-command-center` (mint side) and `cybrik-cyber-ai-platform` (relying party) — the
  concrete realization of the two-layer trust seam accepted in ADR-0006 (E2 workload identity,
  E3 delegation). Transport substrate selection (SPIRE vs. minimal internal CA), executor
  transport, and the Tool-Fabric tool-grant chain are explicitly **out of scope** (owned by
  ADR-0004/ADR-0005 and their gates).
- Contract realization: the W2-F service-delegation packet
  (`contracts/json-schema/cybrik.svc-*`, `contracts/examples/svc/`,
  `contracts/adapters/cybrik-svc-delegation-mapping-notes.v1.md`,
  `contracts/compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json`). This ADR
  decides the model; the packet expresses it contract-first; neither implements it.

## Context

ADR-0006 accepted a two-layer cross-product trust model — E2 mTLS workload identity at the
transport layer and E3 delegation at the application layer — but left the concrete delegation
credential, its lifetime and binding, and the mint/validate responsibility split undecided. The
first seam that needs it is internal: SOC hands a downstream AI inference/summarization operation
(the W2-D packet) to the Cyber AI platform on behalf of an analyst session. That call must carry
**who is acting, for which tenant/org, over which operation, up to which data marking**, and must
be **impossible to replay, redirect (confused deputy), or escalate** if the credential leaks.

Three properties make this a security decision rather than a plumbing one:

1. A leaked bearer credential must be **useless without the presenter's private key**
   (sender-constrained / proof-of-possession), so exfiltrating a token is not enough to act.
2. The relying party must **re-authorize the named operation** against the token and must never
   trust the caller's request body over the token, nor the token over the mTLS peer certificate.
3. The **external-authority (A05) boundary** (ADR-0007 OD-3) must stay a distinct trust context:
   an internal delegation identity is never reused across it, and an external identity is never
   accepted at this internal seam.

The abstraction must be **vendor-neutral and offline-capable**: it may be SPIFFE-compatible but
must not hard-depend on SPIRE or any single issuer runtime, and verification must fail closed in
an air-gapped deployment where trust is a locally-pinned bundle.

## Decision

Adopt a **two-layer internal service-delegation profile**. All standards are cited to their
official specifications.

### D1 — Transport layer (E2): mTLS workload identity, vendor-neutral, SPIFFE-compatible

- Production peer-to-peer calls on this seam are **mutually-authenticated mTLS**. Each workload
  has a per-deployment trust-domain identity. The model **supports** SPIFFE IDs
  (`spiffe://<trust-domain>/<path>`, per the SPIFFE-ID specification) and SVIDs but **does not
  require SPIFFE and hard-depends on no particular issuer runtime** — SPIRE is one valid
  implementation, not a mandate. The issuer choice (SPIRE vs. a minimal internal CA) remains the
  measured spike of ADR-0004 F4/F8, not decided here.
- **Development only:** loopback / Unix-domain-socket transport with an **ephemeral, in-process
  PKI** (short-lived dev CA, never persisted, never a production trust root) is permitted for the
  local T0 loop. A dev/test key scheme (`env`/`file`) MUST NOT hold production private material.

### D2 — Application layer (E3): short-lived, asymmetric, certificate-bound delegation token

The delegation credential is a **JWT access token** following the OAuth 2.0 JWT access-token
profile (**RFC 9068**):

- **Explicit typing.** `typ` is `at+jwt` (RFC 9068 §2.1) so a token minted for another purpose is
  not accepted as a delegation token (RFC 8725 §3.11).
- **Asymmetric-only signing.** `alg` is an asymmetric JWS algorithm (RFC 7518: ES*/PS*/RS*/EdDSA).
  Every symmetric `HS*` and the unsecured `none` algorithm is **structurally inexpressible**
  (RFC 8725 §3.1/§3.2; RFC 9068 §4). A token is verified against pinned public JWKS trust
  (RFC 7517), never a shared secret.
- **Strict lifetime and time validation.** `iat`/`nbf`/`exp` are required NumericDates
  (RFC 7519 §2). Lifetime `exp - iat` has a **hard ceiling of 120 seconds** (a longer-lived token
  is not a valid W2-F token). The relying party rejects a token outside its `nbf..exp` window
  within a small bounded `clock_skew_seconds`.
- **Replay key.** `jti` (RFC 7519 §4.1.7) is required and unguessable (min length 16); the relying
  party keeps a replay cache and rejects a second presentation of a seen `jti` within its window.
- **Sender-constrained (proof-of-possession).** `cnf` with `x5t#S256` (**RFC 8705** §3.1) binds
  the token to the presenter's mTLS client certificate. The relying party compares the mTLS peer
  certificate's SHA-256 thumbprint to `cnf` and rejects on mismatch, so a stolen token cannot be
  replayed without the bound private key (RFC 9700 / BCP 240 sender-constrained tokens). `cnf` is
  **required** — a non-sender-constrained bearer token is never accepted.
- **Single strict audience.** `aud` (RFC 7519; RFC 9068 §2.2) is a **single value, not an array**;
  the relying party matches it exactly to its own `self_audience` and rejects any other
  (confused-deputy defense; RFC 9700 §2.3; RFC 8725 §3.9).
- **Pinned issuer / key.** `iss` (RFC 9068 §2.2) MUST be in the relying party's pinned
  `accepted_issuers`; `kid` (RFC 7515 §4.1.4) MUST resolve to a pinned JWKS key. Verification
  **fails closed** when trust cannot be resolved (offline/air-gapped included; RFC 8725 §3.8).
- **Complete authorization claim set.** Alongside the registered claims, the token carries the
  CYBRIK namespaced claims `cybrik.tenant_id`, `cybrik.actor` (tenant-scoped), `cybrik.operation`
  (a vendor-neutral operation token, e.g. `ai.inference.create`), and `cybrik.marking` (the
  highest data marking authorized). An under-specified token authorizes nothing.
- **Delegation, not impersonation.** Delegation is expressed by the RFC 8693 §4.1 `act`/actor
  claim (the acting party keeps its own identity; a nested `act` is a prior actor in the composite
  chain), **never** by forwarding an end-user credential. The request-validation view is
  `additionalProperties: false`, so a static bearer or an `on_behalf_of_user_token` has nowhere to
  live.

### D3 — Responsibility split: SOC mints, Cyber AI validates AND re-authorizes

- **SOC** operates the downstream-mint port: it signs delegation tokens with a private key held
  outside the contract (referenced only, `hsm`/`kms`-ready; never inline).
- **Cyber AI** is the relying party: after JWKS signature verification and the RFC 8725 strict
  `iss`/`aud`/`exp`/`nbf`/`jti` checks, it **re-authorizes the named operation** and cross-checks
  the advisory request body against the token. It **never** trusts the body over the token, nor
  the token over the mTLS peer certificate. Fail-closed on every axis:
  cross-tenant, org-scope mismatch, operation mismatch, marking escalation, replay, rotation, and
  revocation are all **rejections**.

### D4 — Boundaries kept distinct (fail-closed disjointness)

- **A05 external-authority boundary (ADR-0007 OD-3).** The trust domain here is INTERNAL only.
  External identities are never accepted at this seam; an internal delegation identity is never
  reused across the external boundary.
- **ADR-0004 tool-grant chain.** This application-delegation token is **disjoint** from the
  accepted digest-bound `cybrik.delegation-chain.v1` tool-execution grant. It grants **no**
  tool/function/agent/MCP authority and MAY only reference such a chain (`cybrik.delegation_ref`)
  for correlation, never substitute for it. Tool execution stays governed by the Tool-Fabric
  packet.
- **ADR-0007 org delta.** `org_scope` here is opaque/advisory only and carries no authority; the
  authoritative org/tenant derives from the caller credential, not from the hint. The ADR-0007
  contract delta remains `PROPOSED — NOT APPLIED`; this profile does not depend on it.
- **No wire endpoint, no MCP.** The packet declares no OpenAPI server, AsyncAPI channel, host,
  route, or URL, and no key/secret/CA is ever a wire field. `$id`s use the RFC 2606 `.example`
  documentation domain as identifiers, not endpoints.

## Consequences

- The internal SOC → Cyber AI seam has an accepted, contract-first identity/delegation model:
  products MAY now implement against the W2-F packet v0.1.0.
- A leaked delegation token is inert without its bound client certificate and expires within
  ≤120s; confused-deputy redirection and cross-tenant/marking escalation are rejected by
  construction plus required runtime checks.
- The relying party carries a **replay cache**, **rotation** (JWKS `kid` roll) and **revocation**
  (issuer/kid de-pin) handling, and **audit** of each authorization decision — all fail-closed.
  These are runtime obligations (SR-1..SR-10 in the manifest), **not** proven by a green validator
  run.
- The transport issuer (SPIRE vs. minimal CA), key-management lifecycle (HSM/KMS rotation cadence),
  and the durable bus remain **unselected** here (ADR-0004 F4/F8, ADR-0003, ADR-0005).
- `NOT IMPLEMENTED`: accepting this ADR builds no mint service, no relying-party validator, no CA,
  no mTLS deployment, and no key store. It authorizes contract-first implementation only.

## Standards cited

RFC 9068 (JWT access-token profile), RFC 8705 (OAuth 2.0 mTLS / certificate-bound `cnf`),
RFC 8693 (token exchange — delegation `act`/actor semantics), RFC 8725 / BCP 225 (JWT best
current practices), RFC 9700 / BCP 240 (OAuth 2.0 security best current practice), RFC 7519 (JWT),
RFC 7515 (JWS), RFC 7517 (JWK/JWKS), RFC 7518 (JWA), RFC 6749 (OAuth 2.0 scope), the SPIFFE-ID
specification (SPIFFE ID / trust domain), RFC 3986 (URI), RFC 2606 (reserved `.example` domain).

## Decision history

- 2026-07-24 — raised and decided the same day: `ACCEPTED FOR IMPLEMENTATION` at Gate W2-F under
  explicit Founder delegation (ADR-0001 D5), realizing the ADR-0006 E2/E3 seam. Recorded in the
  Gate W2-F decision record. Promotion to a stable v1/GA version or an ADR-0001 immutable bundle
  tag remains a separate Founder gate (ADR-0001 D6).
