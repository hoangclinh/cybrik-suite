# ADR Decision Sprint — 2026-07

- Status: `DRAFT` (operating plan; decides nothing by itself)
- Date: 2026-07-23 · updated 2026-07-24 (Wave 0 and Wave 1 gates closed; Wave 2 read-ahead evidence prepared)
- Owner: Founder (decider) · AI agents (research/evidence/drafting only)
- Scope: the six suite ADRs in `docs/adr/`; no product code, no contract acceptance
- Progress: **GATE A2 CLOSED 2026-07-24** — the Founder answered the Wave 0 packet;
  [ADR-0001](ADR-0001-suite-contract-versioning-policy.md) and
  [ADR-0006](ADR-0006-cross-product-event-and-identity-model.md) are `ACCEPTED`.
  **GATE A3 CLOSED 2026-07-24** — the Founder approved all recommended G1–G7/F1–F9 answers;
  [ADR-0002](ADR-0002-cyber-ai-implementation-stack.md) and
  [ADR-0004](ADR-0004-tool-fabric-control-plane-executor-split.md) are `ACCEPTED`.
  **Wave 2 read-ahead evidence for ADR-0003/ADR-0005 is drafted; GATE A4 is NOT OPEN and no
  Wave 2 decision packet/status flip exists.** RB-001 remains `BLOCKING — OPEN`.

## 1. Objective

Reach Founder-decided ADRs fast enough to protect the 2026 Full Feature Complete target
(2026-11-15 per `../strategy/07-SOLO-FOUNDER-AI-OPERATING-MODEL.md` §10) **without cutting
2026 feature scope**. The sprint produces evidence packets and decision packets; only the
Founder moves any ADR out of `PROPOSED`.

The first vertical slice this sprint unblocks is:

```text
Alert → Investigation → Tool request → Approval → Receipt → Case
```

Every hop of that slice depends on ADR-0001 (how contracts are versioned/accepted) and
ADR-0006 (what envelope/identity/delegation crosses product boundaries). Those two are
therefore Wave 0.

## 2. Dependency graph

```text
ADR-0001 (contract/versioning policy)
   │
   ▼
ADR-0006 (event envelope + identity/delegation model)
   │
   ├──────────────┬
   ▼              ▼
ADR-0002          ADR-0004
(Cyber AI stack)  (Fabric control-plane/executor split)
   │              │
   ▼              ▼
ADR-0003          ADR-0005
(durable orchestration)  (sandbox substrate)
```

Rationale (PROPOSAL):

- ADR-0001 first: it defines how *any* accepted interface is versioned, deprecated, and
  conformance-tested. Accepting ADR-0006's envelope without a versioning policy would create
  an unversioned de-facto contract.
- ADR-0006 second: envelope + identity/delegation semantics are consumed by every later
  choice — the orchestration substrate (ADR-0003) must persist/replay them, the executor
  split (ADR-0004) must attest against them, and the implementation stack (ADR-0002) must
  serialize them.
- ADR-0002/0004 before ADR-0003/0005: orchestration substrate choice is constrained by the
  Cyber AI stack; sandbox substrate choice is constrained by the executor split.

Dependency here means *decision ordering*, not waterfall implementation ordering — see §5.

## 3. Wave board

| Wave | ADRs | Sprint output | Founder gate |
|---|---|---|---|
| 0 | ADR-0001, ADR-0006 | [ADR-0001 evidence](evidence/ADR-0001-EVIDENCE.md), [ADR-0006 evidence](evidence/ADR-0006-EVIDENCE.md), [Founder decision packet Wave 0](FOUNDER-DECISION-PACKET-WAVE-0.md) | GATE A2 — **CLOSED 2026-07-24**: Founder answered D1–D7 / E1–E7; both ADRs `ACCEPTED` |
| 1 | ADR-0002, ADR-0004 | [ADR-0002 evidence](evidence/ADR-0002-EVIDENCE.md), [ADR-0004 evidence](evidence/ADR-0004-EVIDENCE.md), [Founder decision packet Wave 1](FOUNDER-DECISION-PACKET-WAVE-1.md) | GATE A3 — **CLOSED 2026-07-24**: Founder approved G1–G7/F1–F9; both ADRs `ACCEPTED` |
| 2 | ADR-0003, ADR-0005 | [ADR-0003 evidence](evidence/ADR-0003-EVIDENCE.md), [ADR-0005 evidence](evidence/ADR-0005-EVIDENCE.md); decision packet Wave 2 still owed | GATE A4 — **NOT OPEN** |

Wave 1 is decided and closed. Wave 2 evidence is read-ahead research; it **recommends, it does
not decide**. ADR-0003/ADR-0005 stay `PROPOSED — NOT DECIDED` until a Wave 2 decision packet
exists and the Founder explicitly answers at GATE A4.

## 4. Exit criteria per wave

A wave is complete only when all of the following hold:

1. Each ADR in the wave has an evidence packet under `evidence/` following
   [evidence/README.md](evidence/README.md) (claims labeled FACT / RESEARCH / PROPOSAL /
   INFERENCE / UNKNOWN, primary sources with URL + access date).
2. Each option in the ADR has explicit criteria scoring and trade-offs — no option is
   selected merely for popularity.
3. A Founder decision packet exists with A/B/C or yes/no questions and DRAFT (not approved)
   acceptance text.
4. The Founder has explicitly answered; the answer is recorded by the Founder (or with
   the Founder's explicit written approval) in the ADR itself — never by an agent
   unprompted.
5. Verification: all six ADRs' status lines match reality (nothing marked accepted without
   Founder record), links resolve, and the release-blocker register is unchanged unless the
   Founder changed it.

## 5. No-waterfall operating cadence

Per `../strategy/07-SOLO-FOUNDER-AI-OPERATING-MODEL.md` §6 and §10:

- Each wave is a micro-loop of hours-to-two-days, not a phase. Evidence gathering for wave
  N+1 runs concurrently with the Founder gate of wave N.
- Prototype spikes are allowed under feature branches/flags in product repositories **only
  after** their governing ADR is accepted, and are labeled spike, never `IMPLEMENTED`.
- Sequencing decisions (what to spike first) may be adjusted weekly by evidence; the target
  release scope (ten pillars, Full Feature Complete 2026) is not reduced by this sprint —
  resequencing "how", never cutting "what".
- One writer task per repository/module at a time; parallel read-only researchers are
  unbounded (WIP limits from strategy document 07 §5).

## 6. Evidence rules

1. External claims cite **primary/official sources only** (spec bodies, standards
   organizations, vendor's own docs), with URL and access date.
2. Every claim carries one label: `FACT` (verified against primary source), `RESEARCH`
   (summarized from primary source, not independently reproduced), `PROPOSAL` (our
   suggested position), `INFERENCE` (our reasoning from facts), `UNKNOWN` (open question).
3. Research never becomes an implementation fact: no evidence packet may state that a
   contract, tool, schema, or identity mechanism is implemented anywhere in the suite.
   Nothing is implemented.
4. Recommendations must account for: local/air-gapped deployment, multi-tenancy, RBAC/RLS,
   audit/replay, no direct model authority, per-capability approval, and versioned
   evidence/receipts (drivers from `../strategy/03-REFERENCE-ARCHITECTURE.md` §1).
5. MCP is an adapter/capability protocol, not a trust boundary (research baseline in
   `../strategy/02-INTERNATIONAL-RESEARCH-AND-STANDARDS.md` §4).
6. Evidence packets recommend; they never accept. Only the Founder accepts.

## 7. Out of scope for this sprint

- Any ADR status change without explicit Founder authorization under ADR-0001 D5. ADR-0001,
  ADR-0002, ADR-0004, and ADR-0006 are accepted; ADR-0003/ADR-0005 remain proposed.
- Any file under `contracts/` (contract-first means contracts follow accepted ADRs, not
  precede them).
- Any edit in `cybrik-soc-command-center`, `cybrik-cyber-ai-platform`, or
  `cybrik-security-tool-fabric`.
- Resolution of RB-001 (responsible-disclosure channel) — separate Founder workstream; it
  continues to block all releases.
