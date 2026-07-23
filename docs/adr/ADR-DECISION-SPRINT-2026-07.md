# ADR Decision Sprint — 2026-07

- Status: `DRAFT` (operating plan; decides nothing by itself)
- Date: 2026-07-23 · updated 2026-07-24 (Wave 0 gate closed)
- Owner: Founder (decider) · AI agents (research/evidence/drafting only)
- Scope: the six suite ADRs in `docs/adr/`; no product code, no contract acceptance
- Progress: **GATE A2 CLOSED 2026-07-24** — the Founder answered the Wave 0 packet;
  [ADR-0001](ADR-0001-suite-contract-versioning-policy.md) and
  [ADR-0006](ADR-0006-cross-product-event-and-identity-model.md) are `ACCEPTED`.
  **Wave 1 is NOT STARTED** and does not start without separate Founder authorization
  (GATE A3 work authorization). RB-001 remains `BLOCKING — OPEN`.

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
| 1 | ADR-0002, ADR-0004 | Evidence packets + decision packet Wave 1 | GATE A3 |
| 2 | ADR-0003, ADR-0005 | Evidence packets + decision packet Wave 2 | GATE A4 |

Wave 1 and Wave 2 work does not start until the previous gate is answered, **except**
read-only research, which may run ahead at any time (it produces evidence, not decisions).

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

- Any change to ADR statuses (all remain `PROPOSED — NOT DECIDED` until the Founder acts).
- Any file under `contracts/` (contract-first means contracts follow accepted ADRs, not
  precede them).
- Any edit in `cybrik-soc-command-center`, `cybrik-cyber-ai-platform`, or
  `cybrik-security-tool-fabric`.
- Resolution of RB-001 (responsible-disclosure channel) — separate Founder workstream; it
  continues to block all releases.
