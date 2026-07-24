# ADR-0004 — Tool Fabric control-plane / executor split

- Status: `ACCEPTED`
- Date raised: 2026-07-23
- Date decided: 2026-07-24
- Decider: Founder
- Acceptance record: Founder approved all recommended answers F1–F9 on 2026-07-24 at
  GATE A3 (Wave 1), recorded in the
  [Wave 1 decision packet](FOUNDER-DECISION-PACKET-WAVE-1.md). Status flip applied by an
  AI agent under explicit Founder authorization, per ADR-0001 D5. No agent inferred approval.
- Scope: `cybrik-security-tool-fabric` control-plane/executor trust boundary
- Evidence: [evidence/ADR-0004-EVIDENCE.md](evidence/ADR-0004-EVIDENCE.md) — retained as
  decision provenance.

## Context

Tool Fabric combines a trust-critical control plane—capability registry, policy and approval,
credential/egress brokers, receipt ledger, and kill switches—with execution of security tools
that may process hostile input. The process and trust split determines whether a compromised
executor can reach credentials, policy authority, signing keys, other tenants, or unrestricted
egress.

The evidence packet evaluated a single-process service, a separate control-plane/executor tier,
and per-invocation disposable isolation. This ADR accepts the boundary and lifecycle model while
leaving measured implementation choices and the sandbox substrate to later governed decisions.

## Decision

The Founder accepted F1–F9 exactly as recommended on 2026-07-24:

- **F1 — Reject a single-process shipped target.** Option A is rejected as the production
  security model. It is permitted only as a T0 development loop with all untrusted-input
  capability classes disabled.
- **F2 — Baseline boundary.** Use Option B as the always-on baseline: a separate,
  trust-critical control-plane service and an executor tier in a distinct trust zone over an
  authenticated mTLS channel, ready for per-invocation disposable executors.
- **F3 — Risk-tiered executor lifecycle.** Disposable per-invocation isolation is mandatory
  for untrusted-input classes R1/R2/R3 and sandbox profiles S1/S2/S3. Pooled long-lived S0
  workers are permitted for R0 read-metadata capabilities only when policy permits.
- **F4 — Workload identity.** Use the SPIFFE-style mTLS workload-identity model accepted in
  ADR-0006 E2. The issuer implementation—SPIRE versus a minimal internal CA—remains a measured
  spike, not a decision in this ADR.
- **F5 — Control-side credential and egress brokers.** Executors receive only single-use,
  scoped, short-lived credentials and broker-mediated egress. They never receive the raw
  delegation token, never persist a credential, and never return a credential to the model.
- **F6 — Receipt integrity.** The Tool Fabric control plane signs receipts; executors attest
  evidence to it, as fixed by ADR-0006 E5. A receipt-signing key never exists on an executor.
- **F7 — Mandatory execution properties.** Every invocation is idempotent and bounded by
  time, CPU, RAM, output, and egress budgets. Global, tenant, tool, and action kill switches
  fail closed. Missing policy, required approval, credential, or receipt storage causes denial
  for the affected side-effecting class.
- **F8 — Measured implementation deferrals.** Defer the workload-identity issuer, executor
  transport, receipt signing envelope, executor-attestation mechanism, and sandbox substrate
  to explicit spikes/ADRs. ADR-0005 owns the sandbox substrate decision.
- **F9 — Preserve the approval-ingress gap as an open dependency.** The SOC currently lacks an
  accepted durable, digest-bound cross-product contract for a Fabric-originated approval request
  and an authenticated approval response, including an external/on-call approver. ADR-0004
  records but does not close that dependency; it must be resolved contract-first under ADR-0001.

## Consequences

- Production operation requires at least two trust tiers and lifecycle/attestation controls
  for disposable executors.
- Untrusted workloads pay per-invocation isolation latency; R0/S0 retains a policy-gated pooled
  path to avoid unnecessary cost.
- Credential, egress, policy, approval, and receipt authority remain control-side by
  construction, reducing the blast radius of a fully compromised executor.
- Policy may raise isolation but never lower the required floor.
- The exact issuer, transport, signing-envelope, executor attestation, and sandbox technologies
  remain unselected until their measured gates are complete.
- The SOC approval-ingress contract remains a blocking cross-product dependency for the
  `Alert → Investigation → Tool request → Approval → Receipt → Case` vertical slice.
- `NOT IMPLEMENTED`: no Tool Fabric control plane, executor, broker, sandbox, issuer,
  attestation mechanism, or receipt signer is built or piloted by accepting this ADR.

## Decision history

- 2026-07-23 — raised as `PROPOSED — NOT DECIDED`.
- 2026-07-24 — `ACCEPTED` at GATE A3 per Founder approval of F1–F9, informed by
  [evidence/ADR-0004-EVIDENCE.md](evidence/ADR-0004-EVIDENCE.md).
