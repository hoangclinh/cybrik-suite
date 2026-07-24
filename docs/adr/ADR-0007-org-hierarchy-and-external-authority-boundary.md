# ADR-0007 — Organizational hierarchy & external-authority boundary model

- Status: `PROPOSED — NOT DECIDED`
- Date raised: 2026-07-24
- Decider: Founder
- Scope: cross-product model (this repo). Any future implementation splits across
  `cybrik-soc-command-center`, `cybrik-security-tool-fabric`, and `cybrik-cyber-ai-platform`
  per `cybrik-suite:CLAUDE.md` ownership boundaries.
- Depends on / aligns with: `ADR-0006` (cross-product event & identity model, `ACCEPTED`),
  `ADR-0001` (contract/versioning policy, `ACCEPTED`).
- Supporting packet (decides nothing by itself):
  [architecture/org-hierarchy](../architecture/org-hierarchy/README.md) — evidence (01), domain
  model (02), UX IA (03), threat model (04), contract-gap/delta (05); and the
  [UAT Gate Standard](../uat/UAT-GATE-STANDARD.md).

> **Status honesty.** This ADR is `PROPOSED`. It decides nothing until the Founder gates it. No
> product may implement against it (ADR README lifecycle rule). It edits no schema and accepts no
> contract; the [contract delta](../architecture/org-hierarchy/05-contract-delta-proposal.md) is
> proposed-not-applied.

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

## Decision (proposed — to be ratified or revised by the Founder)

Adopt, as a suite-level architectural model (not an implementation), the following:

1. **Configurable 3–4-tier org model.** A deployment declares an ordered **tier ladder** as data
   (ordinal depth + per-locale label keys + policy hints). The product ships **no** fixed tier
   names (no hard-coded "district"/"province"). Supports 3–4+ tiers portably (VN, US
   federal/state/local, MSSP HQ/region/client).
2. **`tenant` ↔ `org_node` separation.** The **tenant** stays the fail-closed isolation boundary
   (ADR-0006 cross-tenant reject). The **`org_node`** is a separate governance tree. `org_node`
   **never weakens** tenant isolation; cross-node data movement re-checks tenant. Deployments may
   map one-tenant-per-node, one-tenant-many-nodes, or hybrid (default cardinality is an open
   decision).
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

## Open decisions (must be resolved before implementation)

Carried from [04 §6](../architecture/org-hierarchy/04-threat-model-and-open-decisions.md#6-open-decisions-carried-to-a-future-founder-gated-adr):
OD-1 tenant↔org_node cardinality default; OD-2 aggregate small-cell / DP floor; OD-3
external-exchange authorization type (reuse vs distinct); OD-4 residency policy expression +
legal-compulsion governance; OD-5 external-peer authentication strength; OD-6 break-glass scenario
catalog.

## Alternatives considered (rejected in the model, not by this ADR)

- **Nest tenants for hierarchy** — rejected: overloads the fail-closed isolation primitive and
  makes "my parent can see my data" the default, violating INV-1 (02 §1.1).
- **Model A05 as the org-tree root / top tier** — rejected: it is a sovereign external authority
  the tenant cannot administer; violates INV-2 (01 §1).
- **Hard-code Vietnamese tiers/agencies** — rejected: Vietnam's own structure changed in 2025;
  encoding it guarantees staleness and breaks portability.

## Decision record

Not decided. Awaiting Founder gating. On acceptance, the status flip and any contract delta are
applied only under explicit Founder authorization (ADR-0001 D5 mechanics; ADR-0006 precedent) — no
agent infers approval.
