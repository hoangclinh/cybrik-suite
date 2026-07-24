# Gate W2-G — organizational-hierarchy + external-authority contract packet acceptance (2026-07-24)

- Status: `DECISION RECORD` — **Gate W2-G outcome: ACCEPTED FOR IMPLEMENTATION** (packet v0.1.0;
  **not** stable v1/GA, **not** an ADR-0001 immutable bundle tag). Every member of the W2-G
  organizational-hierarchy + external-authority-boundary packet is `ACCEPTED FOR IMPLEMENTATION` at
  v0.1.0. This authorizes products to implement contract-first against v0.1.0; it does **not**
  promote to a stable version, create a bundle tag, or close any release blocker.
- Date: 2026-07-24
- Branch / reviewed tree: `codex/w2g-org-hierarchy-contract`. No merge to `main`.
- Authority: Founder-delegated **technical** Gate W2-G (delegation of the technical accept/-hold
  decision to Codex; executed and recorded by the suite lead). Delegation covers the technical gate
  decision and the acceptance-for-implementation flip only. It does **not** authorize promotion to
  stable v1/GA, creating an immutable bundle tag, changing anything inside
  `cybrik-soc-command-center`, or merging to `main`. No agent inferred approval from CI.
- Reviewed packet: the 9 org-hierarchy JSON Schemas
  (`contracts/json-schema/cybrik.org-common-defs.v1`, `cybrik.org-node.v1`,
  `cybrik.org-node-lifecycle.v1`, `cybrik.org-membership.v1`, `cybrik.org-scope-grant.v1`,
  `cybrik.org-edge.v1`, `cybrik.org-external-exchange.v1`, `cybrik.org-aggregate-request.v1`,
  `cybrik.org-aggregate-result.v1`), all positive + negative fixtures
  (`contracts/examples/org/`), the org-hierarchy → SOC mapping notes
  (`contracts/adapters/cybrik-org-hierarchy-mapping-notes.v1.md`), and the compatibility manifest
  (`contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json`). Model basis:
  [ADR-0007](../adr/ADR-0007-org-hierarchy-and-external-authority-boundary.md) (org-hierarchy &
  external-authority model, `ACCEPTED` at Gate W2-C1); contract-profile decision:
  [ADR-0009](../adr/ADR-0009-org-hierarchy-and-external-authority-contract-profile.md).

## 1. Decision

**ACCEPTED FOR IMPLEMENTATION — v0.1.0, not stable v1/GA.** The gate rule is: accept for
implementation only if the post-validator security/trust and standards review surfaces **no
Critical or High** trust defect. The review surfaces **0 Critical and 0 High** trust or schema
defects; the packet is internally coherent at v0.1.0, additive to and disjoint from the accepted
v0.1 cross-product packet, the accepted W2-D inference packet, and the accepted W2-F
service-delegation packet, carries no tool/agent authority (MCP out of scope), keeps the
external-authority (A05) boundary distinct (never ancestor/member/internal-token/auto-execute), and
introduces no operational endpoint, migration, server, or CA/secret. Under the rule, the packet is
therefore **ACCEPTED FOR IMPLEMENTATION** at v0.1.0.

This is an implementation-authorization acceptance only. It is **not** a stable v1/GA promotion,
**not** an immutable bundle tag (`x-cybrik-is-bundle-tag` stays `false`), and does **not** close any
release blocker. Runtime-only invariants recorded in the manifest (`invariants.runtime_only`:
FC-1/FC-2/FC-6/FC-7/FC-9/FC-10 + acyclicity / tree-relationship / dimension-subset / SoD) remain
explicit and REQUIRED of every implementation — a green validator run proves standards conformance
and fixture coverage, not runtime enforcement, and not the presence of any migration/API/UI.

### Gate decisions resolved (G-W2G-1..5, accepted exactly as delegated)

| ID | Decision | Outcome |
|---|---|---|
| G-W2G-1 | The ADR-0007 org-hierarchy model contract delta D-1..D-8 is **APPLIED** as the accepted `cybrik.org-*` JSON Schema packet (v0.1.0), additive to and disjoint from the accepted v0.1 / W2-D / W2-F packets, reusing `common-defs`/`data-marking` by `$ref` unmodified | **ACCEPTED** |
| G-W2G-2 | INV-1 (hierarchy ≠ raw read) is encoded structurally: ancestor reach is aggregate-only; raw descendant access requires an `explicit-descendant-grant` with a non-empty `raw_scope` + need-to-know; parent/tasking edges never confer raw read | **ACCEPTED** |
| G-W2G-3 | INV-2 (external authority never super-admin) is encoded structurally across org-node/org-edge/org-membership/org-external-exchange; an external peer is never an ancestor/member/internal-token, and an inbound directive never auto-executes | **ACCEPTED** |
| G-W2G-4 | Tiers are DATA (ordinal + locale label keys; no fixed tier names); aggregates apply a k=5 small-cell floor and never carry raw records; external crossings are marked/residency-gated (deny-by-default) and never downgrade marking; referenced nodes are archived (no hard-delete) | **ACCEPTED** |
| G-W2G-5 | The packet declares **NO** operational server/endpoint and grants **NO** tool/agent/MCP authority; the SOC migration (illustrative `0022`)/API/UI it maps onto are owned + separately gated by `cybrik-soc-command-center` and are `NOT IMPLEMENTED` here; the surface ships feature-flag-OFF with a documented rollback/backfill | **ACCEPTED** |

## 2. Evidence — validators, negative tests, secret scan

Reproducible from the committed lockfile: `cd tools/contract-validation && npm ci && npm run validate`.

- **JSON Schema 2020-12 / fixtures / invariants / integrity (`validate:org`)** — PASS. 9 org
  schemas loaded/compiled (reusing `common-defs` + `data-marking` unmodified); **21/21 positive**
  fixtures validate; **10/10 negative-schema** fixtures rejected; **6/6 negative-semantic** fixtures
  structurally valid (only a relying-party invariant rejects them, against a fixed test clock
  NOW=1899635200 = 2030-03-13T12:26:40Z); **42/42 invariant assertions** pass (INV-1/INV-2 +
  D-1..D-8 structural + FC-* properties, each exercised by a fixture and each negative-schema
  fixture proven to carry the offending shape — no vacuous pass); **21/21 runtime-positive** accept
  + **6/6 runtime-negative** reject against the fixed reference topology; per-member **SHA-256
  integrity** verified against the manifest (10/10 members); 2 accepted primitives reused
  unmodified; mapping-note NO-operational-server + UAT-trace + feature-flag-OFF assertions pass.
- **Lifecycle consistency** — PASS. The compatibility manifest is the single source of truth for
  lifecycle state; `validate-org.mjs` accepts exactly two consistent whole-packet states
  (`PROPOSED`/not-accepted or `ACCEPTED FOR IMPLEMENTATION`/accepted) and **fails a half-flipped
  packet**. All 9 schemas, the compatibility manifest, and the examples-manifest agree on
  `ACCEPTED FOR IMPLEMENTATION` at v0.1.0; `x-cybrik-is-bundle-tag` remains `false`; accepted-state
  acceptance metadata (gate, decided_by, decided_on, evidence[]) is present. The manifest declares
  `wire_scope: NO SERVER / NO ENDPOINT` and `mcp_scope: OUT OF SCOPE`, and asserts ADR-0004 and
  ADR-0008 out of scope — all enforced by the validator.
- **Accepted v0.1 base packet (`validate:schemas`)** — PASS, unchanged. **25 hardening assertions**
  retained; the accepted base primitives (`common-defs`, `data-marking`) are reused by `$ref` and
  were not modified or re-versioned by this gate.
- **Accepted W2-D inference packet (`validate:inference`)** and **W2-F service-delegation packet
  (`validate:svc`)** — PASS, unchanged. **39** and **44** trust-invariant assertions respectively;
  both disjoint from and untouched by this packet.
- **OpenAPI 3.1.x / AsyncAPI 3.0.0** — PASS, unchanged. This packet declares no wire spec of its own
  (no server/endpoint/channel).
- **Whitespace / status hygiene** — `git diff --check` clean; every W2-G artifact carries an
  accurate lifecycle header.
- **Secret scan (gitleaks 8.30.1, pinned; matches CI)** — CLEAN. No key material, CA, private key,
  or secret is a wire field anywhere in the packet.

A green validator run is a standards-conformance and fixture-coverage signal, not a proof of runtime
enforcement of the FC-* / acyclicity / tree-relationship / dimension-subset / SoD invariants, and
not, by itself, acceptance.

## 3. What did NOT change with this acceptance

- **Additive only.** The accepted v0.1 base packet, the accepted W2-D inference packet, and the
  accepted W2-F service-delegation packet are **unchanged**; base primitives remain `ACCEPTED FOR
  IMPLEMENTATION` and are reused unmodified. No accepted `$id`, event type, or channel is redefined.
- No promotion to stable v1/GA and no immutable bundle tag: packet stays v0.1.0,
  `x-cybrik-is-bundle-tag=false`.
- No security invariant was relaxed: all **42** org invariant assertions, the base **25**
  hardenings, the W2-D **39**, and the W2-F **44** invariants remain and pass.
- Disjointness preserved: the org packet grants no tool/agent/MCP authority (ADR-0004 stays the
  tool-grant seam); `org_scope` remains opaque/advisory on the W2-F service-delegation seam
  (ADR-0008 D4); the external-authority (A05) boundary stays distinct.
- **No change inside `cybrik-soc-command-center`.** The SOC migration/API/UI remain owned and
  separately gated there and are `NOT IMPLEMENTED` here. No merge to `main`; no secrets, product
  dependencies, migrations, deployments, or remote configuration were introduced. The only install
  performed is the isolated, pinned validation toolchain (`npm ci`, `ignore-scripts=true`), whose
  `node_modules` is gitignored.

## 4. Remaining, still-required runtime gates (not closed by this acceptance)

Acceptance-for-implementation authorizes contract-first implementation only. The following remain
the responsibility of the implementing product (`cybrik-soc-command-center`) and are **not** proven
by a green validator run:

- **FC-1** default-deny: absent an explicit, unexpired, in-scope grant every read/action is denied;
  AND-composed with tenant RLS + RBAC; an empty raw scope denies (never grant-all).
- **FC-2** tenant-first (OD-1): authoritative tenant derives from the caller credential; reject a
  cross-tenant hierarchy edge (`from_node.tenant_binding != to_node.tenant_binding`) and any
  cross-tenant grant; backfill stays same-tenant + internal.
- **Acyclicity** and **tree-relationship**: reject an edge whose endpoints form a cycle (including
  `from == to`); verify the subject's tree relationship to `target_node` matches
  `subject_relationship` (a sibling/unrelated node is not a valid descendant target).
- **FC-6** marking/residency gate (AC-9): marking re-checked on every crossing and never downgraded
  relative to `origin_marking`; residency deny-by-default.
- **FC-7** grants expire and revoke immediately on idempotent replay; break-glass over 900s requires
  a second human approval and self-revokes.
- **FC-9** availability never widens authority (external unreachability queues, never elevates).
- **FC-10** fail-closed on ambiguity (unknown tier config / missing jurisdiction / unresolved
  relationship denies).
- **D-8 dimension-subset** and **SoD** (self-authorization rejected).

The UI surface additionally remains gated on the [UAT Gate Standard](../uat/UAT-GATE-STANDARD.md):
the P1–P4 persona matrix (top-tier coordinator / mid-tier coordinator / local operator / A05
external liaison), with the URL-canonical org scope + `OrgScopeProvider` context negative-isolation
tests (INV-1 no ancestor raw-read; INV-2 no A05 internal admin/tenant read/ancestor membership;
cross-tenant). A single failed negative-isolation test is an automatic FAIL of the whole wave.

Promotion to a stable v1/GA version or an ADR-0001 immutable bundle tag remains a **separate Founder
gate** (ADR-0001 D6). Until such a bundle tag exists, no release manifest may reference any member
as GA.

## 5. Do not claim

- The packet is accepted **for implementation at v0.1.0 only**. It is **not** stable, **not** GA,
  **not** a bundle tag, and confers no release authorization.
- A green validator/secret-scan run is a conformance and fixture-coverage signal, not a proof of
  runtime enforcement of the FC-* / acyclicity / tree-relationship / dimension-subset / SoD
  invariants, and not proof of any migration/API/UI.
- Nothing here is implemented, verified against a running system, piloted, or GA. The SOC
  migration (illustrative `0022`)/RLS/API/UI are owned by `cybrik-soc-command-center` and are `NOT
  IMPLEMENTED`.
