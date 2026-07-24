# Contract-Gap Assessment & Delta Proposal — Org Hierarchy vs Accepted v0.1.0

- Status: `PROPOSED — NOT ACCEPTED` (assessment + *proposed, not applied* delta)
- Packet: [Organizational hierarchy & external-authority boundary](README.md)
- Date: 2026-07-24
- Gate: W2-C0 (research/architecture only)
- Assessed against: the **accepted-for-implementation** contract packet v0.1.0 under
  `cybrik-suite:contracts/json-schema/` (per `x-cybrik-status: ACCEPTED FOR IMPLEMENTATION`,
  `x-cybrik-contract-version: 0.1.0`).

> **Status honesty & scope.** This document **edits no schema and no contract**. It is a written
> gap analysis plus a *future* delta sketch. Applying any of it is a separate Founder gate
> (`cybrik-suite:CLAUDE.md` — "accepting a contract"). Field names below are **illustrative
> concept names**, not proposed identifiers. Nothing here bumps a contract version; a real delta
> would follow ADR-0001 SemVer rules and go through the validators unchanged.

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

## 4. Proposed *future* delta (NOT applied)

Additive and backward-compatible; a real proposal would be gated and versioned per ADR-0001.

- **D-1 — New `cybrik.org-node.v_next` object.** `org_node_id`, nullable `parent_id`, `tier`
  (ordinal into a configured ladder), `tenant_binding`, `jurisdiction`, locale `labels` (keys
  only), `status`, `boundary_kind` (`internal`/`external`). Tree, not DAG (single parent).
- **D-2 — New `cybrik.org-membership.v_next` object.** Binds `actor` → `org_node` → role, role
  mapping to capability archetypes (analyst / org-unit admin / tenant admin / tier coordinator /
  external liaison). Confers node-scoped capability, **not** descendant read.
- **D-3 — Extend `cybrik.data-marking` (minor, additive).** Add optional `jurisdiction` (e.g. ISO
  3166 region) and `residency` handling tokens. Additive optional fields → SemVer minor; existing
  payloads stay valid. Enables FC-6 residency gating.
- **D-4 — Add a `scope_kind` concept to hierarchical grants.** `own-node` | `descendant` |
  `aggregate` | `delegated`, layered on the existing `delegation-chain.scope`, with `aggregate`
  meaning **no raw records** by contract. Encodes INV-1 in the schema.
- **D-5 — Typed org edges/events.** `escalation` (down→up), `tasking` (up→down, no read),
  `case-delegation` (peer, reuses delegation-chain), `exchange` (external, marked+minimized). Event
  types follow `cybrik.<product>.<entity>.<action>.v<major>` (ADR-0006 E7).
- **D-6 — External-exchange convention.** An `external` audience class + explicit exchange
  direction, reusing `grant.audience`/`purpose` (FC-8). Decide reuse-vs-distinct-type at OD-3.
- **D-7 — Break-glass grant variant.** Reuses `expires_at`/`max_uses`/`separation_of_duties`; adds
  a mandatory oversight-notification + high-severity-audit requirement.
- **D-8 — Aggregate roll-up payload.** A de-identified subtree-metrics object with small-cell
  suppression/banding (OD-2), never carrying `objectRef`s to raw records.

**Compatibility note:** D-3 is additive-optional (minor bump). D-1/D-2/D-4–D-8 are **new**
objects/conventions (additive; no breaking change to accepted schemas). None removes or narrows
an existing field. The accepted v0.1.0 packet remains valid and untouched until a Founder gate
accepts any of this.

---

## 5. What is explicitly NOT proposed here

- No edit to any file under `contracts/`. This packet leaves the validators' inputs unchanged.
- No version bump, no new `$id`, no `x-cybrik-status` flip.
- No implementation in any product repo (ownership per `cybrik-suite:CLAUDE.md`).
- No Vietnam-specific enum, agency code, or tier name in any schema — those remain configuration
  and data (01 §5; 02 §8).

## 6. Open items feeding the gate

OD-1 (cardinality), OD-2 (DP floor for D-8), OD-3 (D-6 reuse vs distinct type), OD-4 (D-3
residency expression + compulsion governance), OD-5 (external-peer auth) — all tracked in
[04 §6](04-threat-model-and-open-decisions.md#6-open-decisions-carried-to-a-future-founder-gated-adr).
Each must be decided before the corresponding delta is proposed for acceptance.
