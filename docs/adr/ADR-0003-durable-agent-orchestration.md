# ADR-0003 — Durable agent orchestration

- Status: `ACCEPTED` (GATE A4, 2026-07-26) — decision only; no implementation, dependency or
  runtime authority
- Date raised: 2026-07-23
- Date decided: 2026-07-26 (GATE A4)
- Decider: Founder
- Scope: `cybrik-cyber-ai-platform` orchestration plane; touches Tool Fabric call semantics

## Decision recorded at GATE A4 — 2026-07-26

GATE A4 was answered on 2026-07-26 under **Founder-delegated current-thread authority**, recorded in
[FOUNDER-DECISION-PACKET-WAVE-2.md](FOUNDER-DECISION-PACKET-WAVE-2.md) and applied by the docs-only
[ADR-0003 status-flip application](ADR-0003-STATUS-FLIP-APPLICATION.md). Option A was accepted:
`H1..H11` are all `yes`, and this ADR moved from `PROPOSED — NOT DECIDED` to `ACCEPTED`.

The accepted answers are recorded verbatim in `FOUNDER-DECISION-PACKET-WAVE-2.md` §4. In summary:
an in-house PostgreSQL durable state machine behind a narrow `DurableExecutionPort` with the CYBRIK
deterministic controller retaining authority (H1, H5); DBOS pre-qualified only as a spike-gated
fallback behind the same port (H2, H10); Temporal and Prefect rejected as the T0/T1 substrate (H3);
same PostgreSQL with a separate orchestration schema and `FORCE RLS` (H4); durable
`waiting_approval` with policy-digest, cancel and kill-switch recheck (H6); orchestration
idempotency key plus a mandatory effect ledger giving an exact-once-effect *illusion* only (H7);
transactional outbox with at-least-once delivery and `event_id` dedup, broker pin still deferred
(H8); immutable versioned digest-pinned workflow definitions (H9); and the ADR-0002 dependency
recorded as **resolved**, with broker pin, DBOS unknowns, resume reliability and approval-ingress
carried as explicit deferrals (H11).

**This acceptance is a decision record only.** It authorizes no implementation, no dependency
selection or installation, no spike or benchmark run, no database, container, microVM, netns or
broker start, and no staging, commit, merge, push, deployment, release or release-date action. Each
of those remains behind its own separate gate. No durable controller, store, outbox, worker loop,
timer or restart proof exists in any product repository, and none is claimed here.

The sections below are the framing that GATE A4 answered; they are retained unchanged as the record
of what was decided against.

## Context

Investigations are long-running, interruptible, and must survive process restarts with a
complete audit trail. The strategy documents require durable agent orchestration, but the
substrate is undecided.

## Decision needed

1. Durability substrate: dedicated durable-execution engine vs. event-sourced in-house state
   machine vs. queue+checkpoint model.
2. Determinism/replay requirements for agent steps that call non-deterministic models.
3. Failure semantics: retries, compensation, human-approval pause/resume, timeout policy.
4. Where orchestration state lives relative to the Investigation Graph/Bundle (same store or
   separate), and what appears in execution receipts (interacts with Tool Fabric, ADR-0004).
5. Idempotency contract for tool calls issued through the Tool Fabric gateway.

## Options to evaluate (no selection made)

Candidate classes only (no product selection): durable-workflow engines, event-sourcing over
a log/bus, database-backed state machines with outbox. Evidence and prototypes required
before a decision.

## Consequences to evaluate

Operational footprint on sovereign/on-prem deployments, replay/audit fidelity for
compliance, coupling between orchestration substrate and agent framework choice (ADR-0002).
