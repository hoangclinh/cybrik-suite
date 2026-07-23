# ADR-0001 — Suite contract/versioning policy

- Status: `ACCEPTED`
- Date raised: 2026-07-23
- Date decided: 2026-07-24
- Decider: Founder
- Acceptance record: Founder decision granted 2026-07-24 at GATE A2 (Wave 0), answering
  D1–D7 of the [Wave 0 decision packet](FOUNDER-DECISION-PACKET-WAVE-0.md). Status flip
  applied by an AI agent under explicit Founder authorization, per the acceptance mechanics
  decided in D5 below. No agent inferred approval.
- Scope: `cybrik-suite:contracts/` and every product that implements a suite contract
- Evidence: [evidence/ADR-0001-EVIDENCE.md](evidence/ADR-0001-EVIDENCE.md) (research and
  recommendation that informed this decision; retained unmodified as decision provenance)

## Context

The suite is contract-first: cross-product interfaces (REST, events, schemas, MCP) live in
`contracts/` and products implement them. Before this decision, no policy defined how
contracts are versioned, how breaking changes are handled, or what compatibility products
must guarantee. The options evaluated (A: per-file SemVer only; B: suite-wide bundle
version only; C: hybrid) and their criteria scoring are preserved in the evidence packet.

## Decision

The Founder decided D1–D7 as follows on 2026-07-24:

- **D1 — Versioning unit (Option C).** Each contract file in `contracts/` is versioned
  with SemVer 2.0.0. The suite additionally tags **immutable suite bundles** — named sets
  of specific accepted contract versions. Release manifests, LTS commitments, and T2
  (air-gapped) deliveries reference bundles only.
- **D2 — N-1 bundle compatibility (yes, with scope).** N-1 bundle compatibility is
  **mandatory starting with the first GA bundle**. Pre-GA bundles may migrate rapidly, but
  **every** incompatibility must be explicit in compatibility records and release notes.
  No silent breakage, ever.
- **D3 — Deprecation window (yes).** Deprecation requires **two minor releases AND at
  least 180 days**, except in a documented security emergency.
- **D4 — Format pins (pin now).** Authoring formats are pinned as follows:
  - OpenAPI: **3.1.x profile**, with the exact patch version pinned in each accepted
    bundle;
  - JSON Schema: **2020-12**;
  - AsyncAPI: **3.0.0**;
  - MCP specification: **2025-11-25**.
  Future format upgrades require compatibility evidence and ADR/contract governance.
- **D5 — Acceptance mechanics (revised from the packet's draft).** Acceptance requires
  **explicit Founder authorization recorded with evidence links in a status-flip commit**.
  The Founder does not have to type the commit personally; an AI agent may execute the
  exact status flip **only after explicit Founder approval**. No agent may infer approval.
- **D6 — No PROPOSED references (yes).** No release manifest or accepted bundle may
  reference a `PROPOSED` contract.
- **D7 — LTS unit (yes).** The 24-month LTS commitment attaches to **GA bundle tags**, not
  to individual floating contract files.

## Consequences

- Two versioning concepts must be governed: per-file SemVer and immutable bundle tags.
  Bundle tagging is a recurring Founder-gated act; a compatibility matrix remains
  necessary between bundle tags.
- Products migrate per file day-to-day; bundles are alignment points, not lockstep gates.
  From the first GA bundle onward, every product carries a hard N-1 bundle obligation.
- Every incompatibility — including pre-GA — is a recorded, communicated event; silence is
  a policy violation.
- Contract acceptance is auditable: each `PROPOSED → ACCEPTED` flip traces to an explicit
  Founder authorization with evidence links in the status-flip commit.
- Format pins (OpenAPI 3.1.x, JSON Schema 2020-12, AsyncAPI 3.0.0, MCP 2025-11-25) are
  policy commitments; upgrading any of them is itself a governed change requiring
  compatibility evidence.
- `NOT IMPLEMENTED`: no contract files, bundle tooling, compatibility matrix, conformance
  tests (`tests/contract/`), or CI diffing exist yet. This ADR accepts **policy only**;
  every technical capability above remains to be built under future authorized work.

## Decision history

- 2026-07-23 — raised as `PROPOSED — NOT DECIDED` with options A/B/C.
- 2026-07-24 — `ACCEPTED` per Founder decisions D1–D7 (GATE A2, Wave 0), informed by the
  evidence packet. Options A and B rejected for the reasons recorded in
  [evidence/ADR-0001-EVIDENCE.md](evidence/ADR-0001-EVIDENCE.md) §3.
