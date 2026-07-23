# Founder Decision Packet — Wave 0 (ADR-0001, ADR-0006)

- Status: `APPROVED — DECIDED`. The Founder answered all questions on 2026-07-24 (GATE A2
  closed). Founder answers are recorded in §0 below; the authoritative accepted text now
  lives in the ADRs themselves:
  [ADR-0001](ADR-0001-suite-contract-versioning-policy.md) ·
  [ADR-0006](ADR-0006-cross-product-event-and-identity-model.md).
  Sections 1–3 are retained unmodified as decision provenance.
- Date: 2026-07-23 (drafted) · 2026-07-24 (decided)
- Evidence: [ADR-0001 packet](evidence/ADR-0001-EVIDENCE.md) ·
  [ADR-0006 packet](evidence/ADR-0006-EVIDENCE.md)
- Sprint context: [ADR-DECISION-SPRINT-2026-07.md](ADR-DECISION-SPRINT-2026-07.md)

## 0. Founder answers — recorded 2026-07-24

### ADR-0001 (D1–D7)

| # | Founder answer |
|---|---|
| D1 | **C** — per-contract SemVer plus immutable suite bundle tags. |
| D2 | **YES WITH SCOPE** — N-1 bundle compatibility is mandatory starting with the first GA bundle. Pre-GA bundles may migrate rapidly, but every incompatibility must be explicit in compatibility records and release notes; no silent breakage. |
| D3 | **YES** — deprecation requires two minor releases AND at least 180 days, except documented security emergency. |
| D4 | **PIN NOW** — OpenAPI 3.1.x profile, with exact patch pinned in each accepted bundle; JSON Schema 2020-12; AsyncAPI 3.0.0; MCP specification 2025-11-25. Future format upgrades require compatibility evidence and ADR/contract governance. |
| D5 | **REVISED** — acceptance requires explicit Founder authorization recorded with evidence links in a status-flip commit. The Founder does not have to type the commit personally; an AI agent may execute the exact status flip only after explicit Founder approval. No agent may infer approval. |
| D6 | **YES** — no release manifest or accepted bundle may reference a `PROPOSED` contract. |
| D7 | **YES** — 24-month LTS attaches to GA bundle tags, not individual floating files. |

### ADR-0006 (E1–E7)

| # | Founder answer |
|---|---|
| E1 | **B** — CloudEvents-style envelope with CYBRIK extensions and versioned CYBRIK payloads; OCSF-aligned payloads only where an OCSF class fits. |
| E2 | **YES** — SPIFFE-style workload identity model; issuer/substrate implementation remains for ADR-0004. |
| E3 | **YES** — ordered digest-bound delegation grants, referenced in events and embedded in receipts. |
| E4 | **YES** — bus remains out of scope; envelope is bus-agnostic and bus choice belongs to ADR-0003. |
| E5 | **YES** — Tool Fabric control plane signs receipts; executors attest evidence to the control plane. |
| E6 | **REVISED CONDITIONAL** — not a mandatory triple on every event: trace context is required for operational cross-product workflow events and is created at the boundary when absent; `investigation_id` is required only for investigation-scoped events and absent/optional for non-investigation event classes; causation reference is required for derived events and absent for legitimate root events; correlation semantics must be defined per event class and enforced by accepted schemas later. |
| E7 | **YES** — retain `cybrik.<product>.<entity>.<action>.v<major>` event-type naming. |

Deviations from the packet's recommendations: D5 and E6 were **revised** by the Founder
(see answers above); all other answers follow the recommendations. The draft acceptance
texts in §3 are **superseded** by the actual accepted Decision sections in the ADRs.

## 1. ADR-0001 — contract/versioning policy

**Recommended: Option C** — per-contract-file SemVer 2.0.0 + periodically tagged immutable
suite bundles; LTS and release manifests reference bundles only.

**Rejected/deferred alternatives:**

- A (per-file only) — rejected: no supportable unit for the 24-month LTS commitment or for
  air-gapped delivery; the compatibility matrix becomes an unbounded release artifact.
- B (bundle only) — rejected: lockstep coupling; an AI-only contract change would force
  SOC/Fabric re-validation, violating the "SOC undisturbed" driver.

**Consequences if you follow the recommendation:**

- Security: execution-time references pin version + digest, so stale/substituted contracts
  are detectable; unknown fields in security decisions fail closed.
- Operability: two concepts to govern (file SemVer, bundle tags); bundle tagging is a
  recurring Founder-gated act; the between-bundles compatibility matrix still exists.

**Questions (answer each):**

| # | Question | Answer form |
|---|---|---|
| D1 | Versioning unit? | A / B / **C (recommended)** |
| D2 | N-1 bundle compatibility mandatory for every product? | yes / no |
| D3 | Deprecation window = two minor releases AND ≥180 days (security emergencies excepted)? | yes / no |
| D4 | Pin formats now — OpenAPI (3.1.x or 3.2.x?), JSON Schema 2020-12, AsyncAPI 3.0.0, MCP 2025-11-25? | per-format pick / defer |
| D5 | Acceptance = Founder-authored status-flip commit with evidence links, and nothing else? | yes / no |
| D6 | Release manifests may never reference `PROPOSED` contracts? | yes / no |
| D7 | 24-month LTS attaches to bundle tags? | yes / no |

## 2. ADR-0006 — event envelope + identity/delegation

**Recommended: Option B** — CloudEvents-style envelope with CYBRIK extension attributes
(tenant, marking, delegation reference, causation/correlation); versioned CYBRIK JSON
Schema payloads for workflow events; OCSF-aligned payloads only where an OCSF class fits.
Identity: SPIFFE-style workload identity; analyst identity via short-lived delegation
tokens; delegation chain as digest-bound grants embedded in signed receipts.

**Rejected/deferred alternatives:**

- A (OCSF as envelope) — rejected: OCSF is a security-telemetry taxonomy; investigation/
  approval/receipt workflow events have no natural OCSF class. OCSF is retained for
  telemetry-shaped payloads.
- C (in-house envelope) — rejected: ~90% attribute-equivalent to CloudEvents already, but
  with zero ecosystem leverage and sole documentation/migration burden on one founder.
- SPIRE-vs-minimal-issuer — deferred to ADR-0004 evidence (implementation, not model).
- Canonical bus (Kafka) — proposed as out of scope; envelope stays bus-agnostic, bus lands
  with ADR-0003 evidence.

**Consequences if you follow the recommendation:**

- Security: envelope identity/tenant attributes are written only by authenticated service
  code — model output can never populate them; receipts carry the full delegation chain by
  digest, so "who allowed this, on whose behalf" is answerable from a receipt alone;
  approval grants are digest-bound to capability + arguments + policy (stale approvals die
  automatically). MCP stays an adapter, never a trust boundary.
- Operability: an alignment pass renames the strategy document 05 §2.2 sketch fields to
  CloudEvents attribute names; CYBRIK extension attributes become contracts you must
  version under ADR-0001; partial OCSF adoption must be stated honestly in interop claims.

**Questions (answer each):**

| # | Question | Answer form |
|---|---|---|
| E1 | Envelope? | A / **B (recommended)** / C |
| E2 | SPIFFE-style workload identity model (issuer decided under ADR-0004)? | yes / no |
| E3 | Delegation chain = ordered digest-bound grants, referenced in events, embedded in receipts? | yes / no |
| E4 | Bus decision out of scope here (envelope bus-agnostic; bus lands with ADR-0003)? | yes / no |
| E5 | Fabric control plane signs receipts (executors attest)? | yes / no |
| E6 | Mandatory causation/correlation triple (`trace_id` + `investigation_id` + causation ref) on every cross-product event? | yes / no |
| E7 | Keep `cybrik.<product>.<entity>.<action>.v<major>` event-type naming? | yes / no |

## 3. Proposed acceptance texts — `SUPERSEDED`

> **SUPERSEDED 2026-07-24.** These draft wordings were provenance input only. They assumed
> unrevised D5 and E6; the Founder revised both. The authoritative accepted text is the
> Decision section of each ADR:
> [ADR-0001](ADR-0001-suite-contract-versioning-policy.md) ·
> [ADR-0006](ADR-0006-cross-product-event-and-identity-model.md).
> Original draft text retained below, unmodified, for provenance.

These are prepared wordings only. They take effect **only** if the Founder personally
records them into the ADRs (per gate rules in `../../CLAUDE.md`). No agent may apply them.

### 3.1 ADR-0001 (draft wording, assumes D1=C and yes on D2–D7)

> Decision: Each contract file in `contracts/` is versioned with SemVer 2.0.0 and carries a
> status header and content digest. The suite periodically tags immutable bundles — named
> sets of specific accepted contract versions. Release manifests, LTS commitments
> (24 months for GA), and T2 deliveries reference bundles only; a bundle may not contain
> `PROPOSED` contracts. Products maintain N-1 bundle compatibility. Breaking changes
> require a major version; risk-class or side-effect changes to capabilities are always
> major. Deprecation requires two minor releases and ≥180 days except security
> emergencies. Unknown fields are tolerated additively except in security decisions, which
> fail closed. Contracts are accepted solely by a Founder-authored status-flip commit
> linking the evidence relied upon. Conformance tests pin bundle tags and diff changed
> contracts against their last accepted version.

### 3.2 ADR-0006 (draft wording, assumes E1=B and yes on E2–E7)

> Decision: Cross-product events use a CloudEvents-style envelope (required attributes
> `id`, `source`, `specversion`, `type`) with CYBRIK extension attributes for tenant,
> data marking, delegation reference, correlation (`investigation_id`), and causation
> (causing event id), plus W3C Trace Context `trace_id`. Workflow-event payloads are
> versioned CYBRIK JSON Schemas; OCSF-aligned payloads are used only where an OCSF class
> fits the data. Workload identity follows the SPIFFE model — per-deployment trust domain,
> short-lived credentials, mTLS — with the issuer implementation selected under ADR-0004.
> Analyst identity remains SOC-owned and crosses boundaries only as short-lived,
> audience- and purpose-bound delegation tokens. Delegation is an ordered chain of
> digest-bound grants (analyst→agent, approver→agent-for-action) referenced in events and
> embedded in execution receipts, which the Tool Fabric control plane signs. Envelope
> extensions and payload schemas are versioned under ADR-0001. The event bus is out of
> scope of this ADR; the envelope is bus-agnostic. MCP is an adapter and is not a trust
> boundary.

## 4. GATE A2 — CLOSED 2026-07-24

The Founder returned answers to D1–D7 and E1–E7 on 2026-07-24 (recorded in §0); ADR-0001
and ADR-0006 are `ACCEPTED`. Wave 1 (ADR-0002/0004) remains **NOT STARTED** pending
separate Founder authorization; contract drafting is **not** authorized by this gate
closure. Commit of the Wave 0 documentation set requires separate authorization
(GATE A2-COMMIT).
