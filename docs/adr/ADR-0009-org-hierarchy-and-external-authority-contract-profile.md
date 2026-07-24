# ADR-0009 — Organizational-hierarchy & external-authority contract profile

- Status: `ACCEPTED FOR IMPLEMENTATION` (v0.1.0; not stable v1/GA, not an ADR-0001 immutable bundle tag)
- Date raised: 2026-07-24
- Date decided: 2026-07-24
- Decider: Founder (technical Gate W2-G delegated to Codex; executed and recorded by the suite lead)
- Acceptance record: Gate W2-G decision record
  [docs/releases/GATE-W2-G-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md](../releases/GATE-W2-G-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md).
  Acceptance-for-implementation was authorized by explicit Founder delegation of the technical
  Gate W2-G to Codex, per ADR-0001 D5. No agent inferred approval; a green validator run is a
  conformance signal only, never acceptance by itself.
- Scope: the cross-product **contract realization** of the ADR-0007 organizational-hierarchy &
  external-authority-boundary model (`ACCEPTED` at Gate W2-C1) — i.e. the contract delta D-1..D-8
  that ADR-0007 §Consequences and
  [05-contract-delta-proposal.md](../architecture/org-hierarchy/05-contract-delta-proposal.md)
  left `PROPOSED — NOT APPLIED`. This ADR **applies** that delta as accepted JSON Schemas; it does
  **not** re-decide the model (ADR-0007 owns it), and it builds **no** product artifact. The SOC
  migration/API/UI the packet maps onto are owned and separately gated by
  `cybrik-soc-command-center` and are explicitly **out of scope** and **`NOT IMPLEMENTED`** here.
- Contract realization: the W2-G org-hierarchy packet
  (`contracts/json-schema/cybrik.org-*`, `contracts/examples/org/`,
  `contracts/adapters/cybrik-org-hierarchy-mapping-notes.v1.md`,
  `contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json`). The compatibility
  manifest is the single source of truth for the packet's whole-packet lifecycle state. This ADR
  decides that the delta is applied contract-first; the packet expresses it; neither implements it.

## Context

ADR-0007 accepted, at Gate W2-C1, a portable organizational-hierarchy model and the six
open-decision constraints OD-1..OD-6 — but explicitly as **architecture/model only**: it edited no
schema, accepted no contract, and left the contract delta
([05](../architecture/org-hierarchy/05-contract-delta-proposal.md)) `PROPOSED — NOT APPLIED` as a
**separate** Founder gate. That gate is W2-G, and this ADR records it.

The delta must apply the model **without weakening any accepted invariant** and without introducing
a wire endpoint or tool authority. Three properties make applying it a security decision rather
than a mechanical schema addition:

1. **Hierarchy must not become a raw-read channel (INV-1).** Governance ancestry gives task,
   de-identified aggregate roll-up, and policy — never automatic raw descendant records. The schema
   itself must make ancestor-raw structurally inexpressible; raw descendant reach must require a
   separate, explicit, non-empty grant plus object-level need-to-know.
2. **An external authority must never be super-admin (INV-2).** The Vietnamese "A05" reference peer
   is an exchange party the tenant cannot administer: never a parent/ancestor, never an `org_node`
   member, never re-using an internal token, and an inbound directive never auto-executes.
3. **Tiers and jurisdictions are DATA, not constants.** The reorganizations that motivate the model
   (police 4→3 tiers; ministry mergers) mean any fixed tier-name or agency enum ships staleness.
   The contract must carry ordinals + locale label keys + policy-as-data, and hard-code none of it.

The realization must stay **additive to, and disjoint from,** the accepted v0.1 cross-product
packet, the accepted W2-D inference packet, and the accepted W2-F service-delegation packet: it
introduces the `cybrik.org-*` namespace and `$ref`s the accepted `common-defs`/`data-marking`
primitives **unmodified**.

## Decision

Apply the ADR-0007 contract delta as the accepted `cybrik.org-*` JSON Schema packet at v0.1.0. Each
delta below was `PROPOSED` in [05 §4](../architecture/org-hierarchy/05-contract-delta-proposal.md)
and is now `APPLIED (ACCEPTED FOR IMPLEMENTATION)` as the named schema(s). Structural properties
are enforced by the schemas and exercised by fixtures; the runtime-only invariants
(§Consequences) remain REQUIRED of every implementation.

### D1 — `org_node` structure + governed lifecycle (tier is DATA)

`cybrik.org-node.v1` + `cybrik.org-node-lifecycle.v1`. `tier` is a numeric `tierOrdinal` (no fixed
tier-name enum); `labels` REQUIRE a catalog `label_key` (no hard-coded administrative display
string; `additionalProperties:false`, no `label`/`name` field). `parent_id` is a single nullable
governance parent (**tree, not DAG**); an `external` (A05) boundary node MUST have a null
`parent_id`. Status enum carries **no `deleted`** value; the lifecycle `operation` enum is
`suspend|reactivate|archive|restore` (no hard-delete of a referenced node), REQUIRES an `audit_ref`,
and a `backfill` is only meaningful on an `archive` transition (reorg-churn AC-11). Encodes INV-2 /
FC-2 / FC-10.

### D2 — `org_membership` (actor → internal node → role)

`cybrik.org-membership.v1`. `node_boundary_kind` is const `internal` (an external peer is never an
`org_node` member); `confers_descendant_raw` is const `false` (membership never confers descendant
raw by itself). Encodes INV-1 / INV-2 / FC-1.

### D3 — jurisdiction / data-residency policy-as-data (deny-by-default)

Realized as the shared `jurisdiction` / `residencyZone` `$defs` in `cybrik.org-common-defs.v1`,
`$ref`d by `org-node` and `org-external-exchange`. The accepted `cybrik.data-marking.v1` is
**REUSED UNMODIFIED** — no minor bump is applied to it; the org packet does not re-version an
accepted member. Residency is evaluated deny-by-default at runtime (FC-6 / FC-10).

### D4 — `scope_kind` + `subject_relationship`: the INV-1 raw/aggregate split

`cybrik.org-scope-grant.v1`. `subject_relationship='ancestor-governance'` forces
`scope_kind='aggregate'` and forbids `raw_scope`; an `aggregate` grant forbids `raw_scope` and
requires `aggregate_scope` (de-identified only); `scope_kind='descendant'` requires an
`explicit-descendant-grant` with a **non-empty** `raw_scope.patterns` (`minItems:1` — an empty raw
scope DENIES, never grant-all). Encodes INV-1 / FC-1 / FC-3 / FC-4.

### D5 — typed governance/exchange edges (governance ≠ read)

`cybrik.org-edge.v1`. A `parent` edge MUST have an internal `from_node` and `confers_raw_read=false`
(no external-as-ancestor, no read-through); a `tasking` edge MUST have `confers_raw_read=false`
(authority-to-direct, not read). Encodes INV-1 / INV-2 / FC-2 / FC-3.

### D6 — external-authority (A05) exchange: distinct auth, never auto-executes

`cybrik.org-external-exchange.v1`. The `external_peer.boundary_kind` is const `external`;
`authorization` is `additionalProperties:false` with `auth_context` const `external-distinct` (no
internal token can live there, OD-3) and pins `mtls` + `signed_envelope` + `replay_protection`
const `true` (OD-5 transport floor); `auto_execute` is const `false` and an `inbound-directive`
REQUIRES a `review_queue_ref` (it lands in review, never auto-executes). Encodes INV-2 / FC-5 /
FC-6 / FC-8 / FC-9.

### D7 — break-glass grant variant (loud, read-only default, self-revoking)

`cybrik.org-scope-grant.v1` `break_glass` block. `oversight_notification` / `high_severity_audit` /
`after_action_review` all const `true`; `max_duration_seconds` ceiling `3600` (60-min hard cap);
over the 900s read-only default REQUIRES a `second_approval`; `mechanism='break-glass'` REQUIRES the
oversight block. Encodes OD-6 / INV-1 / FC-7.

### D8 — aggregate roll-up request + result (de-identified, k=5 floor)

`cybrik.org-aggregate-request.v1` + `cybrik.org-aggregate-result.v1`. The request `scope_kind` is
const `aggregate`, `additionalProperties:false` (no raw reach expressible). The result is
`additionalProperties:false`; every unsuppressed cell `count` has `minimum:5` (the OD-2 `k=5`
small-cell floor, `smallCellFloor` const `5`) and the cell is `additionalProperties:false` (no raw
`object_refs` drill-down). Encodes INV-1 / FC-4.

### Boundaries kept distinct (fail-closed disjointness)

- **ADR-0004 tool-grant chain.** This packet grants **no** tool/function/agent/MCP authority.
  Hierarchy is authority routing + de-identified visibility; an escalated/delegated object
  references an `objectRef` but confers no tool grant. Tool execution stays governed by the
  accepted Tool-Fabric packet. MCP is out of scope.
- **ADR-0008 internal service-delegation seam (W2-F).** `org_scope` on that seam is opaque/advisory
  only (ADR-0008 D4). This packet defines the **authoritative** org model but does not run at, or
  depend on, that transport seam, and grants no delegation-token/transport authority.
- **No wire endpoint.** The packet declares no OpenAPI server, AsyncAPI channel, host, route, or
  URL, and no key/secret/CA is ever a wire field. `$id`s use the RFC 2606 `.example` documentation
  domain as identifiers, not endpoints.

## Consequences

- The suite has an accepted, contract-first organizational-hierarchy + external-authority model:
  products MAY now implement against the W2-G org packet v0.1.0.
- INV-1 and INV-2 are encoded **structurally** where a JSON Schema can express them (ancestor-raw
  inexpressible, external-as-ancestor/member/internal-token inexpressible, inbound never
  auto-executes, k=5 floor, no hard-delete). The remaining properties are **runtime-only** and are
  REQUIRED of every implementation, **not** proven by a green validator run: FC-1 default-deny,
  FC-2 tenant-first + cross-tenant-edge rejection, acyclicity, tree-relationship (sibling/unrelated
  is not a descendant), FC-6 marking non-downgrade + residency deny-by-default, FC-7 expiry/
  revocation, FC-9 availability-never-widens-authority, FC-10 fail-closed-on-ambiguity, the D-8
  dimension-subset rule, and SoD (self-authorization rejected).
- **`NOT IMPLEMENTED`:** accepting this ADR builds no database migration (illustrative `0022`), no
  RLS/RBAC join, no API, and no UI. The implementing surface is owned and separately gated by
  `cybrik-soc-command-center`; it ships behind a **feature flag that defaults OFF** (with the flag
  off the product behaves as the accepted v0.1 single-tier surface), and its rollback = clear the
  flag + reverse the additive migration, never a hard-delete of referenced audit history. Any UI
  wave surfacing hierarchy or A05 exchange MUST clear the
  [UAT Gate Standard](../uat/UAT-GATE-STANDARD.md) (persona matrix P1–P4 incl. the A05 liaison; a
  single failed negative-isolation test is an automatic FAIL of the wave).
- **Additive only.** The accepted v0.1 / W2-D / W2-F packets are unchanged; `common-defs` and
  `data-marking` are reused by `$ref` unmodified. No accepted `$id`, event type, or channel is
  redefined.
- Legal/authority `[UNKNOWN]`s carried by ADR-0007 (primary-gazette confirmation of the
  Vietnamese authority claims) remain open; they constrain jurisdiction-specific operational
  reliance, not this portable contract.

## Standards cited

JSON Schema 2020-12 (schema dialect + format pins per ADR-0001 D4), RFC 2606 (reserved `.example`
domain), ISO 3166 (region convention for residency, as data), and the suite ADRs ADR-0007
(org-hierarchy & external-authority model), ADR-0006 (cross-product event & identity model),
ADR-0001 (contract/versioning policy). OpenAPI 3.1.x and AsyncAPI 3.0.0 are format pins the packet
does **not** exercise (it declares no wire spec).

## Decision history

- 2026-07-24 — raised and decided the same day: `ACCEPTED FOR IMPLEMENTATION` at Gate W2-G under
  explicit Founder delegation (ADR-0001 D5), applying the ADR-0007 contract delta D-1..D-8 as the
  accepted `cybrik.org-*` packet. Recorded in the Gate W2-G decision record. The
  [05 contract delta](../architecture/org-hierarchy/05-contract-delta-proposal.md) moves from
  `PROPOSED — NOT APPLIED` to `ACCEPTED / APPLIED TO CONTRACT PACKET` (SOC runtime still
  `NOT IMPLEMENTED`). Promotion to a stable v1/GA version or an ADR-0001 immutable bundle tag
  remains a separate Founder gate (ADR-0001 D6).
