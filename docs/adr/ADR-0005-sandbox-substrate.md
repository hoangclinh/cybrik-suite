# ADR-0005 — Sandbox substrate

- Status: `ACCEPTED` (GATE A4, 2026-07-26) — decision only; no implementation, dependency or
  runtime authority
- Date raised: 2026-07-23
- Date decided: 2026-07-26 (GATE A4)
- Decider: Founder
- Scope: `cybrik-security-tool-fabric` sandbox control plane

## Decision recorded at GATE A4 — 2026-07-26

GATE A4 was answered on 2026-07-26 under **Founder-delegated current-thread authority**, recorded in
[FOUNDER-DECISION-PACKET-WAVE-2.md](FOUNDER-DECISION-PACKET-WAVE-2.md) and applied by the docs-only
[ADR-0005 status-flip application](ADR-0005-STATUS-FLIP-APPLICATION.md). Option A was accepted:
`J1..J10` are all `yes`, and this ADR moved from `PROPOSED — NOT DECIDED` to `ACCEPTED`.

The accepted answers are recorded verbatim in `FOUNDER-DECISION-PACKET-WAVE-2.md` §5. In summary:
risk-tiered sandbox-profile floors, with the capability→profile binding left to the Capability
Registry/PDP and policy able only to raise isolation (J1); a hardened rootless OCI substrate floor
for S0 and no-file S4, where **only policy-approved S0/R0 metadata workers may be pooled while S4
remains per-invocation disposable under accepted ADR-0004 F3** (J2); a disposable no-network gVisor
`runsc` floor for S1 with no 1:1 capability-risk binding decided here (J3); a mandatory Firecracker
microVM floor for S2 (J4) and Firecracker plus a separate netns and control-side egress broker for
S3 (J5); R4 destructive capabilities denied to agents in 1.x (J6); a Kata `RuntimeClass` wrapper at
T1/T2 and direct Firecracker+jailer at T0 (J7); fail-closed behaviour when required isolation is
unavailable, never downgrading S2/S3 (J8); macOS as dev-loop-only with S2/S3 requiring a Linux
host/CI with KVM and no native parity claim (J9); and kernel/hardware/profile/version pins deferred
to a Linux benchmark and escape-test spike (J10).

**This acceptance is a decision record only.** It authorizes no implementation, no dependency,
substrate or image selection or installation, no spike or benchmark run, no container, microVM,
netns or broker start, and no staging, commit, merge, push, deployment, release or release-date
action. Each of those remains behind its own separate gate. No sandbox driver, isolation runtime,
egress broker, benchmark or escape test exists or has been run in any product repository, and none
is claimed here.

The sections below are the framing that GATE A4 answered; they are retained unchanged as the record
of what was decided against.

## Context

Tool Fabric must run security tools — some untrusted, some handling hostile input (malware
analysis, parsing attacker-controlled data) — inside sandboxes governed by its sandbox
control plane. The isolation substrate is undecided.

## Decision needed

1. Isolation technology class: containers with hardened runtimes, microVMs, gVisor-style
   user-space kernels, or a tiered mix chosen per tool risk class.
2. Tool risk classification: which classes exist (e.g. read-only lookup vs. active scanner vs.
   detonation) and which substrate each requires.
3. Network policy: default-deny egress, broker-mediated exceptions, DNS control.
4. Artifact handling: how sandbox outputs (files, captures) are extracted, scanned, and stored
   without contaminating the host or the repositories.
5. Portability: what must work on customer-managed on-prem clusters vs. only in managed
   environments.

## Options to evaluate (no selection made)

Candidate classes only; concrete products to be evaluated with threat-model evidence before
a decision.

## Consequences to evaluate

Kernel/hypervisor requirements at customer sites, startup latency per invocation (interacts
with ADR-0004 executor model), operational monitoring, CRA/compliance implications of the
chosen substrate's update posture.
