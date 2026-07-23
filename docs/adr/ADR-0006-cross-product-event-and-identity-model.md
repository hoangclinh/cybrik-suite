# ADR-0006 — Cross-product event and identity model

- Status: `PROPOSED — NOT DECIDED`
- Date raised: 2026-07-23
- Decider: Founder
- Scope: all four repositories; contracts under `cybrik-suite:contracts/`

## Context

The three products must exchange events (alert context, investigation progress, tool
results) and must agree on who/what is acting: human analysts (identity owned by SOC),
AI agents, and tool executors. No shared event envelope or identity/attestation model
exists yet.

## Decision needed

1. Event envelope: schema standard (e.g. OCSF-aligned vs. CloudEvents-style envelope with
   OCSF payloads vs. in-house), ordering/delivery guarantees, and the canonical bus
   (interacts with the Kafka direction sketched in strategy document 03 — sketch, not
   decision).
2. Identity model: how analyst identity (SOC-owned) is asserted to Cyber AI and Tool Fabric;
   whether workload identity uses SPIFFE-style attestation as researched in strategy
   document 02.
3. Delegation chain: how "analyst X approved agent Y to run tool Z" is represented,
   verified, and embedded in execution receipts.
4. Event and identity versioning under the policy of ADR-0001.

## Options to evaluate (no selection made)

To be enumerated per sub-decision; standards candidates referenced in strategy documents 02
and 05 are research input, not selections.

## Consequences to evaluate

Auditability of the full analyst→agent→tool chain, sovereign deployment constraints
(no external IdP dependency), replay/forensics quality, coupling to orchestration
(ADR-0003) and executor attestation (ADR-0004).
