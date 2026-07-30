# Gate W2-F — internal service-delegation + workload-identity packet acceptance (2026-07-24)

- Status: `DECISION RECORD` — **Gate W2-F outcome: ACCEPTED FOR IMPLEMENTATION** (packet v0.1.0;
  **not** stable v1/GA, **not** an ADR-0001 immutable bundle tag). Every member of the W2-F
  service-delegation packet is `ACCEPTED FOR IMPLEMENTATION` at v0.1.0. This authorizes products
  to implement contract-first against v0.1.0; it does **not** promote to a stable version, create a
  bundle tag, or close any release blocker.
- Date: 2026-07-24
- Branch / reviewed tree: `codex/w2f-service-delegation`. No merge to `main`.
- Authority: Founder-delegated **technical** Gate W2-F (delegation of the technical accept/-hold
  decision to Codex; executed and recorded by the suite lead). Delegation covers the technical
  gate decision and the acceptance-for-implementation flip only. It does **not** authorize
  promotion to stable v1/GA, creating an immutable bundle tag, or merging to `main`. No agent
  inferred approval from CI.
- Reviewed packet: the 4 service-delegation JSON Schemas
  (`contracts/json-schema/cybrik.svc-common-defs.v1`, `cybrik.svc-delegation-token.v1`,
  `cybrik.svc-delegation-request.v1`, `cybrik.svc-trust-metadata.v1`), all positive + negative
  fixtures (`contracts/examples/svc/`), the delegation → inference-operation mapping notes
  (`contracts/adapters/cybrik-svc-delegation-mapping-notes.v1.md`), and the compatibility manifest
  (`contracts/compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json`). Model basis:
  [ADR-0008](../adr/ADR-0008-internal-service-delegation-and-workload-identity.md) (realizing the
  ADR-0006 E2/E3 two-layer trust seam).

## 1. Decision

**ACCEPTED FOR IMPLEMENTATION — v0.1.0, not stable v1/GA.** The gate rule is: accept for
implementation only if the post-validator security/trust and standards review surfaces **no
Critical or High** trust defect. The review surfaces **0 Critical and 0 High** trust or schema
defects; the packet is internally coherent at v0.1.0, additive to and disjoint from the accepted
v0.1 cross-product packet and the accepted W2-D inference packet, carries no tool/agent authority
on the delegation seam (MCP out of scope), keeps the external-authority (A05) boundary distinct,
and introduces no operational endpoint or CA/secret. Under the rule, the packet is therefore
**ACCEPTED FOR IMPLEMENTATION** at v0.1.0.

This is an implementation-authorization acceptance only. It is **not** a stable v1/GA promotion,
**not** an immutable bundle tag (`x-cybrik-is-bundle-tag` stays `false`), and does **not** close
any release blocker. Runtime-only invariants recorded in the manifest
(`trust_invariants.runtime_only` SR-1..SR-10, `cross_ref_integrity`) remain explicit and REQUIRED
of every implementation — a green validator run proves standards conformance and fixture coverage,
not running enforcement, and not the presence of an operational CA/mTLS deployment.

### Gate decisions resolved (G-W2F-1..5, accepted exactly as delegated)

| ID | Decision | Outcome |
|---|---|---|
| G-W2F-1 | Two-layer trust seam — transport mTLS workload identity (SPIFFE-compatible, SPIFFE not required, no SPIRE hard-dependency) + application-layer short-lived asymmetric certificate-bound delegation token — is the internal SOC → Cyber AI cross-service identity contract | **ACCEPTED** |
| G-W2F-2 | The delegation token is an RFC 9068 `at+jwt`, asymmetric-only, `<=120s`, `cnf`-bound, with strict `iss`/`aud`/`jti`/time validation and required tenant/org/actor/operation/marking claims | **ACCEPTED** |
| G-W2F-3 | SOC mints downstream delegation tokens; Cyber AI validates **and** re-authorizes the named operation (never trusts the caller body over the token, nor the token over the mTLS peer certificate) | **ACCEPTED** |
| G-W2F-4 | The external-authority (A05) boundary is a **distinct** trust context; internal delegation identities and external identities are never reused across it (ADR-0007 OD-3) | **ACCEPTED** |
| G-W2F-5 | The packet is disjoint from the Tool-Fabric tool-grant chain (ADR-0004) and from MCP; it maps only to neutral W2-D inference operation tokens with no server/endpoint | **ACCEPTED** |

## 2. Evidence — validators, negative tests, secret scan

Reproducible from the committed lockfile: `cd tools/contract-validation && npm ci && npm run validate`.

- **JSON Schema 2020-12 / fixtures / trust invariants (`validate:svc`)** — PASS. 4 svc schemas
  loaded/compiled (reusing `common-defs` + `data-marking` unmodified); **3/3 positive** fixtures
  validate; **7/7 negative-schema** fixtures rejected; **9/9 negative-semantic** fixtures
  structurally valid (only a runtime invariant rejects them, against a fixed test clock
  NOW=1900000000); 5 manifest members (+2 accepted primitives reused unmodified); **44
  trust-invariant assertions** pass (SI-1..SI-9 structural + SR-1..SR-10 runtime, each exercised
  by a fixture — asymmetric-only signing, explicit typing, replay key, sender-constrained `cnf`,
  complete claim set, single strict audience, no static bearer / forwarded user token, hard
  short-TTL ceiling; time window, short-TTL, audience, cross-tenant, org-scope, operation binding,
  marking non-escalation, `jti` replay, proof-of-possession, issuer/key pinning).
- **Lifecycle consistency** — PASS. The compatibility manifest is the single source of truth for
  lifecycle state; `validate-svc.mjs` accepts exactly two consistent whole-packet states
  (`PROPOSED`/not-accepted or `ACCEPTED FOR IMPLEMENTATION`/accepted) and **fails a half-flipped
  packet**. All 4 schemas, the compatibility manifest, and the examples-manifest agree on
  `ACCEPTED FOR IMPLEMENTATION` at v0.1.0; `x-cybrik-is-bundle-tag` remains `false`; accepted-state
  acceptance metadata (gate, decided_by, decided_on, evidence[]) is present. The manifest declares
  `wire_scope: NO SERVER / NO ENDPOINT` and `mcp_scope: OUT OF SCOPE`, and asserts ADR-0004 and
  ADR-0007 out of scope — all enforced by the validator.
- **Accepted v0.1 base packet (`validate:schemas`)** — PASS, unchanged. **25 hardening assertions**
  retained; the accepted base primitives (`common-defs`, `data-marking`) are reused by `$ref` and
  were not modified or re-versioned by this gate.
- **Accepted W2-D inference packet (`validate:inference`)** — PASS, unchanged. **39 trust-invariant
  assertions**; disjoint from and untouched by this packet.
- **OpenAPI 3.1.x / AsyncAPI 3.0.0** — PASS, unchanged. This packet declares no wire spec of its
  own (no server/endpoint/channel).
- **Whitespace / status hygiene** — `git diff --check` clean; every W2-F artifact carries an
  accurate lifecycle header.
- **Secret scan (gitleaks 8.30.1, pinned; matches CI)** — CLEAN. No key material, CA, private key,
  or secret is a wire field anywhere in the packet (signing/JWKS material is referenced only).

A green validator run is a standards-conformance and fixture-coverage signal, not a proof of
runtime enforcement of the SR-1..SR-10 / cross-ref invariants, and not, by itself, acceptance.

## 3. What did NOT change with this acceptance

- **Additive only.** The accepted v0.1 base packet and the accepted W2-D inference packet are
  **unchanged**; base primitives remain `ACCEPTED FOR IMPLEMENTATION` and are reused unmodified.
  No accepted `$id`, event type, or channel is redefined.
- No promotion to stable v1/GA and no immutable bundle tag: packet stays v0.1.0,
  `x-cybrik-is-bundle-tag=false`.
- No security invariant was relaxed: all **44** svc trust-invariant assertions, the base **25**
  hardenings, and the W2-D **39** invariants remain and pass.
- Disjointness preserved: the delegation seam and the accepted tool-execution seam (ADR-0004) stay
  disjoint (no tool/agent/MCP authority); the external-authority (A05) boundary stays distinct
  (ADR-0007 OD-3); the ADR-0007 org delta stays `PROPOSED — NOT APPLIED` (`org_scope`
  opaque/advisory only).
- No merge to `main`; no secrets, product dependencies, migrations, deployments, remote
  configuration, or operational CA/mTLS deployment were introduced. The only install performed is
  the isolated, pinned validation toolchain (`npm ci`, `ignore-scripts=true`), whose
  `node_modules` is gitignored.

## 4. Remaining, still-required runtime gates (not closed by this acceptance)

Acceptance-for-implementation authorizes contract-first implementation only. The following remain
the responsibility of each implementing product and are **not** proven by a green validator run:

- **SR-1** time-window rejection (future `nbf` / past `exp`, within bounded `clock_skew_seconds`).
- **SR-2** short-TTL enforcement (`exp - iat <= 120s`, even if within the window).
- **SR-3** audience match (`aud == self_audience`; confused-deputy defense).
- **SR-4** cross-tenant rejection (authoritative tenant is the token; advisory body never elevates).
- **SR-5** org-scope match (advisory hint MUST match the token; no authority alone).
- **SR-6** operation binding (`operation.name == token cybrik.operation.name`).
- **SR-7** marking non-escalation (request `data_marking <= token cybrik.marking` on the lattice).
- **SR-8** `jti` replay-cache rejection (second presentation within the window).
- **SR-9** proof-of-possession (mTLS peer thumbprint `== cnf['x5t#S256']`).
- **SR-10** issuer/key pinning, rotation, and revocation — fail closed when trust cannot be
  resolved (offline/air-gapped included); plus per-decision audit.

Promotion to a stable v1/GA version or an ADR-0001 immutable bundle tag remains a **separate
Founder gate** (ADR-0001 D6). Until such a bundle tag exists, no release manifest may reference any
member as GA.

## 5. Do not claim

- The packet is accepted **for implementation at v0.1.0 only**. It is **not** stable, **not** GA,
  **not** a bundle tag, and confers no release authorization.
- A green validator/secret-scan run is a conformance and fixture-coverage signal, not a proof of
  runtime enforcement of the SR-1..SR-10 / cross-ref invariants, and not proof of an operational
  CA/mTLS deployment.
- Nothing here is implemented, verified against a running system, piloted, or GA.
