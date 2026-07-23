# ADR-0006 — Cross-product event and identity model

- Status: `ACCEPTED`
- Date raised: 2026-07-23
- Date decided: 2026-07-24
- Decider: Founder
- Acceptance record: Founder decision granted 2026-07-24 at GATE A2 (Wave 0), answering
  E1–E7 of the [Wave 0 decision packet](FOUNDER-DECISION-PACKET-WAVE-0.md). Status flip
  applied by an AI agent under explicit Founder authorization, per ADR-0001 D5 acceptance
  mechanics. No agent inferred approval.
- Scope: all four repositories; contracts under `cybrik-suite:contracts/`
- Evidence: [evidence/ADR-0006-EVIDENCE.md](evidence/ADR-0006-EVIDENCE.md) (research and
  recommendation that informed this decision; retained unmodified as decision provenance)

## Context

The three products must exchange events (alert context, investigation progress, tool
results) and must agree on who/what is acting: human analysts (identity owned by SOC),
AI agents, and tool executors. Before this decision, no shared event envelope or
identity/attestation model existed. The envelope options evaluated (A: OCSF-as-envelope;
B: CloudEvents-style + typed payloads; C: in-house) and their criteria scoring are
preserved in the evidence packet.

## Decision

The Founder decided E1–E7 as follows on 2026-07-24:

- **E1 — Envelope (Option B).** Cross-product events use a **CloudEvents-style envelope
  with CYBRIK extension attributes** (tenant, data marking, delegation reference,
  correlation/causation) and **versioned CYBRIK payloads**. OCSF-aligned payloads are used
  **only where an OCSF class genuinely fits** the data (telemetry-shaped payloads); suite
  workflow events carry CYBRIK JSON Schema payloads.
- **E2 — Workload identity (yes).** The suite adopts the **SPIFFE-style workload identity
  model** — per-deployment trust domain, short-lived credentials, mTLS. The
  issuer/substrate **implementation** (SPIRE vs. minimal internal issuer) remains a
  decision for ADR-0004.
- **E3 — Delegation chain (yes).** Delegation is an **ordered chain of digest-bound
  grants** (e.g. analyst→agent, approver→agent-for-action), **referenced in events** and
  **embedded in execution receipts**.
- **E4 — Bus out of scope (yes).** The event bus remains **out of scope** of this ADR. The
  envelope is **bus-agnostic**; the bus choice belongs to ADR-0003.
- **E5 — Receipt signing (yes).** The **Tool Fabric control plane signs receipts**;
  executors attest evidence to the control plane.
- **E6 — Correlation/causation (REVISED — conditional, not a mandatory triple on every
  event).** The packet's proposed always-mandatory triple is replaced by conditional
  requirements:
  - **trace context** is required for operational cross-product workflow events and is
    created at the boundary when absent;
  - **`investigation_id`** is required **only** for investigation-scoped events and is
    absent/optional for non-investigation event classes;
  - a **causation reference** is required for derived events and absent for legitimate
    root events;
  - **correlation semantics must be defined per event class** and enforced by accepted
    schemas later.
- **E7 — Event-type naming (yes).** Event types retain the
  `cybrik.<product>.<entity>.<action>.v<major>` naming shape.

**MCP position (restated as part of this decision):** MCP is an **adapter/capability
protocol, not a trust boundary**. Identity, policy, approval, and receipts live below MCP;
nothing may treat an MCP session as a trust boundary.

## Consequences

- Two schema layers must be governed under ADR-0001's policy: CYBRIK envelope extension
  attributes and versioned payload schemas. The strategy document 05 §2.2 envelope sketch
  requires a renaming/alignment pass to CloudEvents attribute names.
- OCSF adoption is deliberately partial (telemetry-shaped payloads only); interop claims
  must state this honestly.
- Envelope identity/tenant attributes are written only by authenticated service code —
  model output can never populate them. Receipts alone answer "who allowed this, on whose
  behalf, for what" via the digest-bound delegation chain.
- Analyst identity remains SOC-owned and crosses product boundaries only as short-lived,
  audience- and purpose-bound delegation tokens.
- Because E6 is conditional, each event class must declare its correlation semantics; the
  enforcement point is the accepted schema for that class, drafted later under ADR-0001's
  contract workflow. Root events without causation and non-investigation events without
  `investigation_id` are legitimate by design, not schema violations.
- `NOT IMPLEMENTED`: no envelope schema, extension-attribute contract, identity issuer,
  delegation token, receipt format, or event class exists in code or contracts. This ADR
  accepts the **model only**; all technical capability remains to be built under future
  authorized work (contracts first, per ADR-0001).

## Decision history

- 2026-07-23 — raised as `PROPOSED — NOT DECIDED`.
- 2026-07-24 — `ACCEPTED` per Founder decisions E1–E7 (GATE A2, Wave 0), informed by the
  evidence packet; E6 accepted in revised conditional form rather than the packet's
  mandatory-triple proposal. Options A and C rejected for the reasons recorded in
  [evidence/ADR-0006-EVIDENCE.md](evidence/ADR-0006-EVIDENCE.md) §3.
