# contracts/json-schema

Status: `PROPOSED` packet present — **NOT ACCEPTED**. Format pin: JSON Schema 2020-12 (ADR-0001 D4).

Shared data object schemas. The first cross-product contract packet lives here, all statused
`PROPOSED — NOT ACCEPTED` (`x-cybrik-status`), contract version 0.1.0:

- `cybrik.common-defs.v1` — shared primitives (digests, ids, tenant, trace, risk/isolation, markings, actor, objectRef).
- `cybrik.data-marking.v1` — structured TLP/classification/handling marking.
- `cybrik.envelope.v1` — CloudEvents-style cross-product envelope (ADR-0006 E1).
- `cybrik.capability.v1` — signed, digest-pinned capability registry entry (ADR-0004).
- `cybrik.tool-execution-request.v1` / `cybrik.tool-execution-result.v1` — invocation request/result.
- `cybrik.delegation-chain.v1` — digest-bound delegation chain (ADR-0006 E3).
- `cybrik.execution-receipt.v1` — control-plane-signed receipt (ADR-0004 F6 / ADR-0006 E5).
- `cybrik.approval-request.v1` / `cybrik.approval-decision.v1` — approval-ingress pair (ADR-0004 F9 / RB-001).

Inventory and cross-artifact digest bindings: `../compatibility/cybrik-suite-contract-packet.v1.manifest.json`.
Conformance fixtures: `../examples/`. Moving any file out of `PROPOSED` requires explicit Founder approval.
