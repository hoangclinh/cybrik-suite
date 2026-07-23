# ADR-0003 — Durable agent orchestration

- Status: `PROPOSED — NOT DECIDED`
- Date raised: 2026-07-23
- Decider: Founder
- Scope: `cybrik-cyber-ai-platform` orchestration plane; touches Tool Fabric call semantics

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
