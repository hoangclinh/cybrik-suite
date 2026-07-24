# ADR-0007 — Organizational hierarchy & external-authority boundary model

- Status: `ACCEPTED` (Gate W2-C1, 2026-07-24) — architectural model & open-decision constraints
  only; **no contract, schema, code, or UI is accepted or implemented by this ADR**.
- Date raised: 2026-07-24
- Date accepted: 2026-07-24 (Gate W2-C1)
- Decider: Founder (decision executed under explicit Founder delegation to Codex, Gate W2-C1)
- Scope: cross-product model (this repo). Any future implementation splits across
  `cybrik-soc-command-center`, `cybrik-security-tool-fabric`, and `cybrik-cyber-ai-platform`
  per `cybrik-suite:CLAUDE.md` ownership boundaries.
- Depends on / aligns with: `ADR-0006` (cross-product event & identity model, `ACCEPTED`),
  `ADR-0001` (contract/versioning policy, `ACCEPTED`).
- Supporting packet (decides nothing by itself):
  [architecture/org-hierarchy](../architecture/org-hierarchy/README.md) — evidence (01), domain
  model (02), UX IA (03), threat model (04), contract-gap/delta (05); and the
  [UAT Gate Standard](../uat/UAT-GATE-STANDARD.md).

> **Status honesty.** This ADR is `ACCEPTED` as an **architectural model and a set of
> open-decision constraints** (Gate W2-C1). Acceptance records decisions; it implements nothing.
> It edits no schema and accepts no contract; the
> [contract delta](../architecture/org-hierarchy/05-contract-delta-proposal.md) remains
> `PROPOSED — NOT APPLIED` and is a **separate** Founder gate. No product may treat this ADR as
> authorization to build the `org_node`/exchange surface — each delta and UI wave is gated on its
> own. Legal/evidence unknowns flagged below remain `[UNKNOWN]`; they constrain operational
> reliance, not this generic architecture.

## Context

Government and large-enterprise SOC deployments are not flat single-tenant systems. A national or
federated security operation spans **organizational tiers** and must interoperate with **external
authorities it does not own and cannot administer** — in the motivating reference context, the
Vietnamese "A05" (Cục An ninh mạng và phòng, chống tội phạm sử dụng công nghệ cao, a department
under the Ministry of Public Security). The reference is used only to *motivate* a **portable**
model; the product hard-codes none of it. The evidence base
([01](../architecture/org-hierarchy/01-vietnam-coordination-evidence.md)) tags every claim
`[CONFIRMED]`/`[INFERRED]`/`[UNKNOWN]` and notes Vietnam's 2025 reorganizations (police 4→3 tiers;
MIC→MoST) precisely to argue tiers/authorities must be **configuration, not constants**. No legal
authority is invented; several load-bearing legal claims rest on secondary sources and are flagged
for primary-gazette confirmation.

## Decision (ACCEPTED at Gate W2-C1)

Adopt, as a suite-level architectural model (not an implementation), the following:

1. **Configurable 3–4-tier org model.** A deployment declares an ordered **tier ladder** as data
   (ordinal depth + per-locale label keys + policy hints). The product ships **no** fixed tier
   names (no hard-coded "district"/"province"). Supports 3–4+ tiers portably (VN, US
   federal/state/local, MSSP HQ/region/client).
2. **`tenant` ↔ `org_node` separation.** The **tenant** stays the fail-closed isolation boundary
   (ADR-0006 cross-tenant reject). The **`org_node`** is a separate governance tree. `org_node`
   **never weakens** tenant isolation; cross-node data movement re-checks tenant. Deployments may
   map one-tenant-per-node, one-tenant-many-nodes, or hybrid. **Default (OD-1, W2-C1):
   one-tenant-many-nodes; each `org_node` in exactly one tenant; no cross-tenant hierarchy edges.**
3. **A05 as an external trust boundary, not a tier.** An external national authority is an
   `external` exchange peer — never a `parent_id`, never tenant-admin/global-read, never an org
   root, and inbound directives never auto-execute (they enter the normal policy/approval/tool
   path). Interaction is per-exchange authorized, marked, residency-checked, minimized, and
   audited across a jurisdictional edge.
4. **Hierarchy implies no raw-data access (INV-1).** Ancestry grants governance only (task,
   de-identified aggregate roll-up, policy). Raw descendant records require a *separate* explicit
   grant **plus** object-level need-to-know. `aggregate` (no raw records) is the default cross-tier
   visibility.
5. **External authority is never super-admin (INV-2).** Restated as a hard invariant and as a
   mandatory UAT negative-isolation test (P4 liaison).
6. **International portability.** Country specifics live in configuration and data only; the model,
   schemas, and shell stay vendor/jurisdiction-neutral, designed for reorg churn (stable internal
   IDs + editable display metadata).

## Consequences to evaluate

- **Contract surface:** requires the additive, backward-compatible future delta in
  [05](../architecture/org-hierarchy/05-contract-delta-proposal.md) (new `org_node`/`org_membership`
  objects, `scope_kind`, residency marking fields, typed edges, break-glass, aggregate payload).
  None applied here; each needs its own gate and SemVer treatment (ADR-0001).
- **Security posture:** the threat model
  ([04](../architecture/org-hierarchy/04-threat-model-and-open-decisions.md)) reduces systemic
  risks (ancestor read-through, external super-admin, cross-tenant leak) to auditable, UAT-testable
  configuration/insider/auth-strength risks; it does not eliminate insider misuse or
  legal-compulsion tension.
- **UX/UAT:** any UI wave surfacing hierarchy or A05 exchange must clear the
  [UAT Gate Standard](../uat/UAT-GATE-STANDARD.md) (persona matrix incl. A05 liaison; bilingual
  VI/EN; accessibility AA; responsive; evidence-based negative-isolation tests).
- **Legal accuracy:** load-bearing Vietnamese legal/authority claims remain secondary-sourced;
  confirm against the official gazette before any operational reliance. Do not treat the reported
  10 Dec 2025 unified Cybersecurity Law as settled here.

## Gate W2-C1 decision log — open decisions resolved (2026-07-24)

The six open decisions carried from
[04 §6](../architecture/org-hierarchy/04-threat-model-and-open-decisions.md#6-open-decisions--resolved-at-gate-w2-c1-2026-07-24)
are **decided** here as architectural constraints. Each binds any *future* contract delta and
implementation; none is itself an implementation. Where a decision differs from a prior packet
*recommendation*, the decision below governs.

- **OD-1 — tenant↔org_node cardinality: DECIDED.** One tenant MAY contain many `org_node`s; each
  `org_node` belongs to **exactly one** tenant. Hierarchy edges **across tenants are forbidden**
  (FC-2 unchanged: `org_node` never weakens tenant isolation; cross-node moves re-check tenant).
  An A05 / external peer is **not** an `org_node` and **not** a tenant member (reinforces INV-2).
  *(This selects one-tenant-many-nodes as the default, superseding 04 §6's "default strict"
  recommendation; strict one-node-per-tenant remains a valid deployment configuration.)*
- **OD-2 — aggregate small-cell floor: DECIDED.** The cross-tier `aggregate` default applies
  **configurable small-cell suppression (k = 5)** plus time/category coarsening. **No differential
  privacy** is adopted until separately evaluated. Raw / unsuppressed detail requires a **separate
  scoped grant** (never delivered by the aggregate path). Encodes FC-4 / AC-2.
- **OD-3 — external-exchange authorization type: DECIDED (distinct).** External-exchange
  identity/auth context is **distinct** from internal user/service JWT/SSO; **no credential
  reuse** across the boundary. The `external` audience convention (FC-8) is carried by this
  distinct context, not by an internal token.
- **OD-4 — residency / jurisdiction expression: DECIDED.** Residency/jurisdiction is expressed as
  **policy-as-data** — allowed processing/exchange zones plus data marking — evaluated
  **deny-by-default** (FC-6 / FC-10). Legal compulsion is handled by an **explicit governed
  workflow with audit**, never a hidden bypass or a standing grant (AC-5; INV-2).
- **OD-5 — external-peer authentication strength: DECIDED (floor).** Minimum: **mTLS + signed
  envelope + audience/nonce/timestamp/replay protection + key rotation/revocation.**
  **Hardware-backed keys are preferred, and required where the deployment supports them.** Gates
  inbound directives before they reach the review queue (AC-4). *(The concrete legal basis for a
  given peer remains `[UNKNOWN]` per 01 and does not lower this technical floor.)*
- **OD-6 — break-glass catalog: DECIDED.** Break-glass fires **only** from an explicit scenario
  catalog; default **read-only, 15 minutes**; up to a **60-minute** maximum that **requires a
  second human approval**. It is **loud** (high-severity audit + notification), **auto-revokes**,
  and mandates an **after-action review**. Write/action access remains **risk-class approval
  gated** (never granted by break-glass alone). Encodes AC-8 / FC-7.

**Still `[UNKNOWN]` and explicitly not decided here** (do not block this generic architecture):
the primary-gazette confirmation of the load-bearing Vietnamese legal/authority claims (01), the
concrete legal basis/mandate of any specific external peer, and evidentiary/chain-of-custody legal
requirements. These constrain *operational reliance and any jurisdiction-specific deployment*,
not the portable model accepted here.

## Alternatives considered (rejected in the model, not by this ADR)

- **Nest tenants for hierarchy** — rejected: overloads the fail-closed isolation primitive and
  makes "my parent can see my data" the default, violating INV-1 (02 §1.1).
- **Model A05 as the org-tree root / top tier** — rejected: it is a sovereign external authority
  the tenant cannot administer; violates INV-2 (01 §1).
- **Hard-code Vietnamese tiers/agencies** — rejected: Vietnam's own structure changed in 2025;
  encoding it guarantees staleness and breaks portability.

## Decision record

**ACCEPTED at Gate W2-C1 on 2026-07-24**, under explicit Founder delegation to Codex, on branch
`codex/w2c-org-hierarchy-a05` (baseline `df86042`, CI green). The gate accepts the architectural
model (§Decision) and the six open-decision constraints (§Gate W2-C1 decision log) as suite
policy. It does **not** accept or apply any contract/schema, and authorizes no product code or UI
— the [contract delta](../architecture/org-hierarchy/05-contract-delta-proposal.md) stays
`PROPOSED — NOT APPLIED` and each delta/UI wave is a separate Founder gate (ADR-0001 D5 mechanics;
ADR-0006 precedent). Legal/evidence `[UNKNOWN]`s remain open and gate only jurisdiction-specific
operational reliance. See
[`docs/releases/GATE-W2-C1-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md`](../releases/GATE-W2-C1-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md)
for the gate record.
