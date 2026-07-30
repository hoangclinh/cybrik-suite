# Deterministic replay and evidence

Status: `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED`
Version: `0.1.0`

## Replay record

Each replay fixture has:

```text
case_id
credential_context { tenant_id, org_scope_ref }
events[] { sequence, virtual_time_ms, kind, payload }
expected { accepted, error_codes, final_root_remaining? }
```

Sequences start at one and increase by exactly one. Virtual time is supplied
by the fixture and never moves backward. No wall clock, random source,
network, service, database, broker, container, or concurrency primitive is
consulted.

Event kinds are:

- `grant`: a public bounds-grant payload;
- `reserve`: a public request plus public result;
- `release`: a public release payload;
- `cancel-root`: a deterministic lifecycle control record.

Every nested public payload is validated against its JSON Schema before replay.

## Positive proof

The positive replay creates a finite root, admits a child and grandchild,
releases the grandchild, and finally releases the child. It demonstrates:

- drawdown at each admission;
- no credit creation at spawn;
- `consumed + returned = current available` at release;
- return only to an open parent;
- consumed credit absent from final root remainder; and
- byte-deterministic trace and verdict under the explicit virtual clock.

## Negative proof

Each semantic negative replay is structurally valid and fails exactly one
named invariant: parent overdraw, no-mint spawn, tenant mismatch, org-scope
mismatch, idempotency conflict, double release, over-return accounting,
closed-parent admission, or root-cancel remint.

Negative-schema fixtures are separate. They prove that authority-shaped extra
properties, zero grant/request vectors, short idempotency keys, mixed
admission outcomes, and incomplete release accounting fail structurally.

## Evidence level

L1 is static schema, fixture, inventory, and integrity conformance. L2 is
offline deterministic replay plus synthetic-tree property proof. L1/L2 are
local labels in this packet, not gate identifiers and not analyst tiers.

Passing L1/L2 says only that the proposal is internally coherent. It does not
accept ADR-0012, implement enforcement, run a vertical, satisfy W0-T10 or
W0-T11, or provide runtime, UAT, release, deployment, or production evidence.
