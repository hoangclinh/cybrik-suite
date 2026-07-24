# Organizational hierarchy & external-authority boundary — architecture packet

- Status: architectural model **ACCEPTED at Gate W2-C1** (2026-07-24) via
  [`ADR-0007`](../../adr/ADR-0007-org-hierarchy-and-external-authority-boundary.md); the
  [contract delta (05)](05-contract-delta-proposal.md) remains `PROPOSED — NOT APPLIED` (separate
  Founder gate). The packet still decides nothing by itself — the ADR carries the decision.
- Date: 2026-07-24
- Gate: authored under **W2-C0** (research/architecture); model & open-decision constraints
  accepted at **W2-C1** (Founder-delegated Codex decision 2026-07-24).
- Owner concern: cross-product model — this repo (`cybrik-suite`). No product source code, no
  schema, and no contract is changed by this packet.
- Aligns with: `ADR-0006` (cross-product event & identity model, `ACCEPTED`), `ADR-0001`
  (contract/versioning policy, `ACCEPTED`).

> **Status honesty.** The **architectural model and open-decision constraints are accepted**
> (Gate W2-C1, via ADR-0007) — as architecture/process, not as running capability. **Nothing here
> is implemented or wired to a schema**, and the accepted contract packet under
> `cybrik-suite:contracts/` is **not edited** by this work — [05](05-contract-delta-proposal.md)
> stays a *proposed, not applied* delta gated separately.
> The Vietnamese structure is the *motivating reference* for a **portable** model; the product
> hard-codes none of it. Legal/authority claims are tagged `[CONFIRMED]` / `[INFERRED]` /
> `[UNKNOWN]`; nothing invents legal authority.

## What this packet answers

The W2-C0 question: **how would the suite model a 3–4-tier organizational hierarchy, tenant/org
separation, and an external national-authority (the Vietnamese "A05") trust boundary — portably,
fail-closed, and without hierarchy implying raw-data access — before any implementation is
gated?**

## Documents

| # | Document | Purpose | Status |
|---|----------|---------|--------|
| 01 | [Vietnam coordination evidence base](01-vietnam-coordination-evidence.md) | Sourced open-research evidence on A05, national cyber bodies, and the 2025 tier reforms; `[CONFIRMED]`/`[INFERRED]`/`[UNKNOWN]` tags | Evidence base; `[UNKNOWN]`s remain open (W2-C1) |
| 02 | [Org-hierarchy domain model](02-domain-model.md) | Portable `tenant`↔`org_node` model, tier ladder, scopes, edges, invariants INV-1/INV-2 | Model `ACCEPTED` (W2-C1, via ADR-0007) |
| 03 | [UX information architecture](03-ux-information-architecture.md) | Interaction *model* the domain implies (no mockups/visuals) | Model `ACCEPTED` (W2-C1, via ADR-0007) |
| 04 | [Threat model & open decisions](04-threat-model-and-open-decisions.md) | Security threat model for the hierarchy / A05 exchange: fail-closed access rules, abuse cases + mitigations, open decisions | Model `ACCEPTED`; OD-1..OD-6 **resolved** (W2-C1) |
| 05 | [Contract-gap assessment & delta proposal](05-contract-delta-proposal.md) | Gap vs accepted contract v0.1.0; proposed *future* delta only (not applied) | `PROPOSED — NOT APPLIED` (separate gate) |

Related, in this repo:

- [UAT Gate Standard](../../uat/UAT-GATE-STANDARD.md) — persona matrix (each tier, A05 liaison,
  tenant admin, analyst) + bilingual/accessibility/responsive/evidence/Codex pass-fail rules that
  any future UI wave surfacing hierarchy or A05 exchange must clear. `ACCEPTED` as a suite process
  standard (W2-C1); certifies no UI and claims no executed UAT.
- The suite ADR that carries this model's decision, [`ADR-0007`](../../adr/README.md), is
  `ACCEPTED` at Gate W2-C1 (architectural model + open-decision constraints only).

## Reading order

01 (evidence) → 02 (model) → 04 (threat model) → 03 (UX IA) → 05 (contract gap) → UAT standard.

## What this packet deliberately does NOT do

- Does not accept or apply a **contract** (the ADR-0007 acceptance at W2-C1 is architecture/model
  only; the [05](05-contract-delta-proposal.md) delta stays a separate Founder gate — see
  `cybrik-suite:CLAUDE.md` approval gates).
- Does not implement anything in any product repo, and touches no owned concern of
  `cybrik-soc-command-center`, `cybrik-security-tool-fabric`, or `cybrik-cyber-ai-platform`.
- Does not hard-code Vietnamese tiers, agency names, unit codes, or legal duties.
- Does not assert any unverified legal authority — see the honesty flags in [01](01-vietnam-coordination-evidence.md#7-key-honesty-flags-carried-forward-as-open-items).
