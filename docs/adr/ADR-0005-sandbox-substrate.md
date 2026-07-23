# ADR-0005 — Sandbox substrate

- Status: `PROPOSED — NOT DECIDED`
- Date raised: 2026-07-23
- Decider: Founder
- Scope: `cybrik-security-tool-fabric` sandbox control plane

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
