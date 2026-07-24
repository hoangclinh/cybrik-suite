# Contract-Gap Assessment & Delta Proposal — Org Hierarchy vs Accepted v0.1.0

- Status: `ACCEPTED / APPLIED TO CONTRACT PACKET` (Gate W2-G, 2026-07-24) — the D-1..D-8 delta
  proposed here is now **applied** as the accepted `cybrik.org-*` JSON Schema packet v0.1.0. The
  **SOC runtime** it maps onto (migration/RLS/API/UI) remains **`NOT IMPLEMENTED`** — owned and
  separately gated by `cybrik-soc-command-center` (see §7). Assessment authored under W2-C0; the
  open decisions it depends on were resolved at W2-C1 (§6); the contract delta was applied at W2-G.
- Packet: [Organizational hierarchy & external-authority boundary](README.md)
- Date: 2026-07-24 (delta applied at Gate W2-G)
- Gate: authored under W2-C0; open decisions resolved at W2-C1; **contract delta ACCEPTED/APPLIED at
  Gate W2-G** ([ADR-0009](../../adr/ADR-0009-org-hierarchy-and-external-authority-contract-profile.md);
  [Gate W2-G record](../../releases/GATE-W2-G-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md))
- Assessed against: the **accepted-for-implementation** contract packet v0.1.0 under
  `cybrik-suite:contracts/json-schema/` (per `x-cybrik-status: ACCEPTED FOR IMPLEMENTATION`,
  `x-cybrik-contract-version: 0.1.0`).

> **Status honesty & scope.** As of Gate W2-G this document's D-1..D-8 delta is **applied to the
> contract packet**: each delta is realized as an accepted `cybrik.org-*` JSON Schema (see §4 for
> the concrete `$id`s and the compatibility manifest
> [`cybrik-suite-org-hierarchy-packet.v1.manifest.json`](../../../contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json)
> for the authoritative inventory). **Applying the contract delta implements nothing.** No product
> migration, RLS/RBAC join, API, or UI is created by this acceptance; the SOC runtime is owned by
> `cybrik-soc-command-center` and remains `NOT IMPLEMENTED` (§7). The concept names in §3–§4 below
> that were *illustrative* are now realized under the exact schema `$id`s named in §4; the SOC
> surface names in §7 (migration `0022`, endpoints, UI routes) remain **illustrative,
> non-normative** mapping targets, not accepted SOC identifiers.

---

## 1. Method

For each domain-model concept ([02](02-domain-model.md)) we record: (a) what the **current
accepted v0.1.0 surface already provides** that helps, and (b) the **exact missing concept**.
Then §4 proposes a minimal, additive, backward-compatible *future* delta. Current surface is read
directly from the accepted schemas:

- `cybrik.common-defs.v1` — `tenantId`, `actor` (`type`,`id`,`delegated_by`,`tenant_id`),
  `objectRef`, `tlpMarking`, `classification`, `riskClass`, digests, timestamps, trace.
- `cybrik.delegation-chain.v1` — ordered digest-bound `grants` with `issuer`/`subject`/
  `audience`/`purpose`/`scope`(`capabilities`,`resource_patterns`,`max_risk_class`)/
  `constraints`(`max_uses`,`separation_of_duties`)/`issued_at`/`not_before`/`expires_at`.
- `cybrik.data-marking.v1` — `classification`, `tlp`, `handling[]`, `origin_marking`.

---

## 2. What the current v0.1.0 surface already gives us (helps)

| Domain-model need | Existing accepted field that helps | How far it goes |
|---|---|---|
| Isolation boundary (`tenant`) | `common-defs.tenantId`; `actor.tenant_id`; delegation-chain `tenant_id` + cross-tenant-invalid rule | **Fully** covers INV-2's tenant-first, cross-tenant-reject requirement (FC-2). No change needed. |
| Who is acting | `common-defs.actor` (+`delegated_by` hint) | Covers persona identity; model-output cannot populate it. |
| Case-specific delegation (§5.1) | `delegation-chain.grant` with `scope.resource_patterns` + `purpose` + `expires_at` | A single case-share **already expressible**: pattern names the case, `purpose`/`expires_at` bound it, revocation/expiry semantics defined. |
| Confused-deputy defense on external exchange (§4, FC-8) | `grant.audience` (reject on mismatch) | The A05 `audience`-binding mechanism **already exists**; only an external audience *class* convention is missing. |
| Per-crossing marking (§3, FC-6) | `data-marking` (`classification`,`tlp`,`handling`,`origin_marking`) | Classification + TLP + caveats + provenance present; **residency/jurisdiction token is missing**. |
| Risk-bounded authority | `scope.max_risk_class` + `riskClass` | Reused unchanged for tasking/exchange risk ceilings. |
| Expiry / replay / SoD | `expires_at`, `not_before`, `constraints.max_uses`, `separation_of_duties` | Covers FC-7 and break-glass time-boxing primitives. |
| Object references across a crossing | `common-defs.objectRef` (digest-bound, owner-dereferenced) | Reused for escalated/delegated/exchanged objects. |

**Takeaway:** the *authorization and marking machinery* is largely sufficient. The gap is
**structural/organizational vocabulary**, not authorization primitives.

---

## 3. Missing concepts (exact gaps vs v0.1.0)

None of the following exists in any accepted schema today:

1. **`org_node` / tier structure.** No node, no `parent_id`, no `tier`, no `boundary_kind`
   (`internal`/`external`). The accepted surface has `tenantId` only (02 §1.1 explicitly names
   this as *the* gap). → **new object.**
2. **`jurisdiction` / data-residency.** `data-marking` has classification/TLP/handling but **no
   residency or jurisdiction token**, so FC-6 residency gating has nothing to evaluate. → **new
   marking field(s).**
3. **`scope` *kind*** (`own-node` / `descendant` / `aggregate` / `delegated`). `delegation-chain`
   scopes by capability/resource pattern/risk, but has **no notion of hierarchical reach** or of
   an **aggregate-only, no-raw-records** visibility mode (the INV-1 enforcement mechanism). →
   **new scope-kind concept.**
4. **`org_membership` / role→archetype binding.** No object binds an `actor` to an `org_node` with
   a node-scoped role. → **new object.**
5. **Escalation / tasking edges.** No typed representation of "escalate up" (down→up object
   transfer/share) or "task down" (authority-to-direct **without** read). `delegation-chain`
   expresses a case-share but not the directional edge semantics or the tasking/read split (02 §5,
   §6). → **new edge/event types.**
6. **Roll-up / aggregate exchange.** No object for de-identified subtree aggregates (the concrete
   INV-1 cross-tier mechanism, 02 §2.2). → **new aggregate payload concept.**
7. **External-exchange authorization *class*.** Mechanism exists (`audience`); the **`external`
   audience convention** and the exchange directionality (outbound-submission vs inbound-directive)
   do not. → **convention + possibly a distinct grant type (OD-3).**
8. **Break-glass grant type.** Time-boxing primitives exist; a **distinct, loud, role-gated
   break-glass grant** with mandatory oversight notification does not (02 §5.3). → **new grant
   variant.**

---

## 4. The delta (proposed at W2-C0; **APPLIED to the contract packet at Gate W2-G**)

Additive and backward-compatible; gated and versioned per ADR-0001. Each item below was proposed
here and is now **`APPLIED (ACCEPTED FOR IMPLEMENTATION)`** as the named accepted schema — the
authoritative inventory + per-member SHA-256 is the
[compatibility manifest](../../../contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json).
The original proposal wording is retained below for traceability; the **Applied as** line records
the realization.

- **D-1 — New `cybrik.org-node.v_next` object.** `org_node_id`, nullable `parent_id`, `tier`
  (ordinal into a configured ladder), `tenant_binding`, `jurisdiction`, locale `labels` (keys
  only), `status`, `boundary_kind` (`internal`/`external`). Tree, not DAG (single parent).
  **Applied as** `cybrik.org-node.v1` + `cybrik.org-node-lifecycle.v1` (`APPLIED`): `tier` is a
  numeric `tierOrdinal` with no tier-name enum; `labels` require a catalog `label_key`; status has
  no `deleted`; lifecycle `operation` is `suspend|reactivate|archive|restore` (no hard-delete),
  requires `audit_ref`, backfill only on `archive`.
- **D-2 — New `cybrik.org-membership.v_next` object.** Binds `actor` → `org_node` → role, role
  mapping to capability archetypes (analyst / org-unit admin / tenant admin / tier coordinator /
  external liaison). Confers node-scoped capability, **not** descendant read.
  **Applied as** `cybrik.org-membership.v1` (`APPLIED`): `node_boundary_kind` const `internal`,
  `confers_descendant_raw` const `false`.
- **D-3 — Extend `cybrik.data-marking` (minor, additive).** Add optional `jurisdiction` (e.g. ISO
  3166 region) and `residency` handling tokens. Additive optional fields → SemVer minor; existing
  payloads stay valid. Enables FC-6 residency gating.
  **Applied as** the shared `jurisdiction`/`residencyZone` `$defs` in `cybrik.org-common-defs.v1`,
  `$ref`d by `org-node` + `org-external-exchange` (`APPLIED`). The accepted `cybrik.data-marking.v1`
  is **REUSED UNMODIFIED** — no minor bump was applied to it (the org packet does not re-version an
  accepted member).
- **D-4 — Add a `scope_kind` concept to hierarchical grants.** `own-node` | `descendant` |
  `aggregate` | `delegated`, layered on the existing `delegation-chain.scope`, with `aggregate`
  meaning **no raw records** by contract. Encodes INV-1 in the schema.
  **Applied as** `cybrik.org-scope-grant.v1` (`APPLIED`): ancestor-governance forces
  `scope_kind=aggregate` + `raw_scope:false`; descendant requires an `explicit-descendant-grant`
  with non-empty `raw_scope.patterns` (`minItems:1`).
- **D-5 — Typed org edges/events.** `escalation` (down→up), `tasking` (up→down, no read),
  `case-delegation` (peer, reuses delegation-chain), `exchange` (external, marked+minimized). Event
  types follow `cybrik.<product>.<entity>.<action>.v<major>` (ADR-0006 E7).
  **Applied as** `cybrik.org-edge.v1` (`APPLIED`): a `parent` edge has an internal `from_node` and
  `confers_raw_read=false`; a `tasking` edge has `confers_raw_read=false`.
- **D-6 — External-exchange convention.** An `external` audience class + explicit exchange
  direction, reusing `grant.audience`/`purpose` (FC-8). Decide reuse-vs-distinct-type at OD-3.
  **Applied as** `cybrik.org-external-exchange.v1` (`APPLIED`, distinct-type per OD-3):
  `authorization` `additionalProperties:false` with `auth_context` const `external-distinct`, pins
  mTLS + signed-envelope + replay-protection, `auto_execute` const `false`, inbound-directive
  requires `review_queue_ref`.
- **D-7 — Break-glass grant variant.** Reuses `expires_at`/`max_uses`/`separation_of_duties`; adds
  a mandatory oversight-notification + high-severity-audit requirement.
  **Applied as** the `break_glass` block in `cybrik.org-scope-grant.v1` (`APPLIED`): oversight +
  high-severity-audit + after-action-review all const `true`, 3600s ceiling, second approval over
  the 900s read-only default.
- **D-8 — Aggregate roll-up payload.** A de-identified subtree-metrics object with small-cell
  suppression/banding (OD-2), never carrying `objectRef`s to raw records.
  **Applied as** `cybrik.org-aggregate-request.v1` + `cybrik.org-aggregate-result.v1` (`APPLIED`):
  request `scope_kind` const `aggregate`; result `additionalProperties:false`; unsuppressed cell
  `count` `minimum:5` (`smallCellFloor` const `5`); no raw `object_refs` drill-down.

**Compatibility note:** D-3 was realized additively as shared `$defs` in `org-common-defs` (the
accepted `data-marking` was reused unmodified, so no minor bump was applied to it). D-1/D-2/D-4–D-8
are **new** `cybrik.org-*` objects/conventions (additive; no breaking change to accepted schemas).
None removes or narrows an existing field. The accepted v0.1.0 base packet remains valid and
untouched; the org packet reuses `common-defs`/`data-marking` by `$ref`. Applying the delta does
**not** implement it in any product (§7).

---

## 5. What this acceptance does NOT do

The contract delta is applied; **everything below remains true and unchanged by Gate W2-G**:

- **No implementation in any product repo.** No SOC migration, RLS/RBAC join, API, or UI is created
  (ownership per `cybrik-suite:CLAUDE.md`; see §7). Applying the contract implements nothing.
- **No change to the accepted v0.1 base packet.** `common-defs`/`data-marking` are reused by `$ref`
  and were not modified or re-versioned; no accepted `$id`, event type, or channel is redefined.
- **No new wire surface.** The org packet declares no OpenAPI server, AsyncAPI channel, host, route,
  or URL, and grants no tool/agent/MCP authority (ADR-0004 stays the tool-grant seam; ADR-0008
  stays the delegation seam, where `org_scope` is opaque/advisory).
- **No stable v1/GA and no bundle tag.** Packet stays v0.1.0, `x-cybrik-is-bundle-tag=false`.
- **No Vietnam-specific enum, agency code, or tier name** in any schema — those remain configuration
  and data (01 §5; 02 §8).

## 6. Open items feeding the gate — RESOLVED at W2-C1 (delta still NOT APPLIED)

The open decisions that shape this delta were **resolved at Gate W2-C1** (2026-07-24) and are now
binding constraints on any future delta — recorded in
[04 §6](04-threat-model-and-open-decisions.md#6-open-decisions--resolved-at-gate-w2-c1-2026-07-24)
and normatively in
[`ADR-0007` §Gate W2-C1 decision log](../../adr/ADR-0007-org-hierarchy-and-external-authority-boundary.md#gate-w2-c1-decision-log--open-decisions-resolved-2026-07-24):
OD-1 = one-tenant-many-nodes (shapes D-1 `tenant_binding`); OD-2 = small-cell suppression k=5, no
DP (shapes D-8); OD-3 = **distinct** external-exchange auth, no credential reuse (shapes D-6);
OD-4 = residency policy-as-data, deny-by-default + governed legal-compulsion workflow (shapes
D-3); OD-5 = mTLS + signed-envelope floor (shapes D-6 peer auth); OD-6 = break-glass catalog
(shapes D-7).

**Resolving the decisions at W2-C1 did not apply the delta; Gate W2-G did.** The delta (D-1..D-8)
was accepted and applied as the `cybrik.org-*` packet v0.1.0 at Gate W2-G (2026-07-24) under
explicit Founder delegation — recorded in
[ADR-0009](../../adr/ADR-0009-org-hierarchy-and-external-authority-contract-profile.md) and the
[Gate W2-G decision record](../../releases/GATE-W2-G-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md), with
each delta's ADR-0001 SemVer treatment and a green validator run cited as evidence. Promotion to a
stable v1/GA version or an immutable bundle tag remains a **separate** Founder gate (ADR-0001 D6).

## 7. SOC implementation mapping gates (`NOT IMPLEMENTED` — owned + gated by `cybrik-soc-command-center`)

Applying the contract packet authorizes the owning product to implement against it; it builds
nothing here. The mapping onto the SOC surface is recorded normatively in
[`contracts/adapters/cybrik-org-hierarchy-mapping-notes.v1.md`](../../../contracts/adapters/cybrik-org-hierarchy-mapping-notes.v1.md).
The identifiers below (migration `0022`, endpoints, UI routes) are **illustrative, non-normative**
targets for `cybrik-soc-command-center` — each is its **own** Founder-gated step there, and none is
built in this repository.

| # | SOC implementation gate (illustrative; NOT built here) | Contract it maps onto | Status |
|---|---|---|---|
| M1 | **Migration `0022_org_hierarchy`** — additive tables `org_node` / `org_node_lifecycle` / `org_membership` / `org_scope_grant` / `org_edge` / `org_external_exchange`; adds columns + a feature flag; alters/drops no accepted v0.1 SOC surface | D-1/D-2/D-4/D-5/D-6 schemas | `NOT IMPLEMENTED` |
| M2 | **Tenant RLS + RBAC** — every scoped query AND-composes tenant RLS + node RBAC + the scope grant; `parent_id`/edges are same-tenant + internal (DB CHECK + app guard); reject cross-tenant edges (FC-2) | INV-1/INV-2, FC-1/FC-2 | `NOT IMPLEMENTED` |
| M3 | **API** — read/authorization endpoints (resolve ancestors/descendants, list memberships, evaluate a scope grant, request an aggregate roll-up, submit/receive an external exchange) as request/response **validation contracts**; no OpenAPI server is defined by this packet | all `cybrik.org-*` payload schemas | `NOT IMPLEMENTED` |
| M4 | **UI** — canonical org scope in the URL `/org/:orgNodeId/:scopeKind/...` (opaque `org_node_id`, never a tier name); a single `OrgScopeProvider` React context is the one source of `{ orgNodeId, scopeKind, tenantId }` and every data hook reads scope from it (no out-of-band cross-scope fetch); A05 exchange is a **distinct** surface, never the internal switcher | D-1/D-4/D-6 + UAT | `NOT IMPLEMENTED` |
| M5 | **Feature flag (default OFF)** — with the flag off the product behaves as the accepted v0.1 single-tier surface (backward compatible); turning it on is a deployment decision, not a contract change | backward_compatibility | `NOT IMPLEMENTED` |
| M6 | **Backfill (reorg-churn AC-11)** — archiving a node MAY reassign live memberships/edges to a **same-tenant internal** successor via `org-node-lifecycle.backfill`; never cross-tenant / external; stable opaque `org_node_id` + editable label metadata absorb tier renames | D-1 lifecycle | `NOT IMPLEMENTED` |
| M7 | **Rollback** — clear the feature flag (surface reverts to flat v0.1) and reverse the additive migration; a referenced node is archived (never row-deleted, D-1); audit history is never hard-deleted | D-1, compatibility_and_backfill | `NOT IMPLEMENTED` |

### UAT negative-isolation gate (P1–P4; owned by SOC, `NOT RUN`)

Any UI wave surfacing hierarchy or A05 exchange MUST clear the
[UAT Gate Standard](../../uat/UAT-GATE-STANDARD.md). Each persona is exercised against every
in-scope surface with **evidence-required negative-isolation** tests driven off the canonical URL
org scope + `OrgScopeProvider` context — a single failed negative-isolation test is an automatic
FAIL of the whole wave. No UAT is claimed run here.

| Persona | Positive | Negative-isolation (evidence required) |
|---|---|---|
| **P1 — central / top-tier coordinator** | aggregate roll-up works; can task down | **cannot** read descendant raw data by default (INV-1); the URL scope `/org/:node/aggregate/...` never yields raw records/objectRefs |
| **P2 — mid-tier coordinator** | sees own node + subtree aggregate; escalation up + tasking down both work and are audited | switching node re-scopes the whole surface via `OrgScopeProvider`; cannot read a sibling subtree's raw data; cannot cross a tenant boundary |
| **P3 — local / lowest-tier operator** | own-node work; can escalate up | is **not** over-exposed to siblings/parents; a deep-linked `/org/:siblingNode/...` URL denies (tree-relationship check), not silently widens |
| **P4 — A05 / external liaison** | exchange in/out only | **no** internal admin surface, **no** tenant read, **no** org-tree membership, never appears as an org ancestor (INV-2); an inbound directive lands in the review queue, never auto-executes |
