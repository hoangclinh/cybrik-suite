# contracts/asyncapi

Status: `PROPOSED` packet present — **NOT ACCEPTED**. Format pin: AsyncAPI 3.0.0 (ADR-0001 D4).

Event/stream contracts. `cybrik-suite-events.v1.asyncapi.yaml` catalogs the first cross-product
event subset (statused `PROPOSED — NOT ACCEPTED`, version 0.1.0). It is **bus-agnostic by
decision** (ADR-0006 E4): no `servers`, no protocol bindings — only channels, operations, and
messages. Every message payload is the `cybrik.envelope.v1` CloudEvents-style envelope; the
concrete `data` schema is identified per event. The bus itself is out of scope (belongs to
ADR-0003, still PROPOSED). Moving out of `PROPOSED` requires explicit Founder approval.
