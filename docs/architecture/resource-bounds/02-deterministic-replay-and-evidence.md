# Deterministic replay and evidence

Status: `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`
Version: `0.1.0`

## Replay record

Each replay fixture has:

```text
case_id
credential_context { tenant_id, org_scope_ref }
events[] { sequence, virtual_time_ms, kind, payload }
expected { accepted, error_codes, final_root_remaining? }
```

Sequences start at one and increase by exactly one, with no gap, no repeat,
and no reordering; a violation is `RES_SEQUENCE_VIOLATION`. That dense rule
means exactly one serialization point per root tree. Virtual time is supplied
by the fixture and never moves backward. No wall clock, random source,
network, service, database, broker, container, or concurrency primitive is
consulted.

Every nested public record carries exactly its envelope's `sequence` and
`virtual_time_ms`. A nested sequence mismatch is
`RES_SEQUENCE_VIOLATION`; nested time earlier than the envelope is
`RES_VIRTUAL_TIME_ROLLBACK`, including time running backwards inside one
ledger position, while nested time later than the envelope is
`RES_RESULT_MISMATCH`.

Event kinds are:

- `grant`: a public bounds-grant payload;
- `reserve`: a public request plus public result;
- `release`: a public release payload;
- `root-closure`: a public root-closure payload.

Every nested public payload is validated against its JSON Schema before replay,
including the `root-closure` payload against `cybrik.res-root-closure.v1`.

Every non-grant payload names the root grant of the tree it belongs to, and a
record naming a foreign tree is refused as `RES_PARENT_NOT_FOUND` wherever it
appears — request, result, release, or closure.

## Positive proof

The positive replay creates a finite root, admits a child and grandchild,
releases the grandchild, and finally releases the child. It demonstrates:

- drawdown at each admission;
- no credit creation at spawn;
- `consumed + returned = current available` at release;
- return only to an open parent;
- consumed credit absent from final root remainder; and
- byte-deterministic trace and verdict under the explicit virtual clock.

A second positive replay exercises denial. A `reserve` event whose result is
`denied` must carry exactly one `RES_*` error and no reservation, and must
leave the parent's version and remainder unchanged. The denial is recorded in
the trace and the tree continues from that untouched state, so the outcome
`01-contract-semantics.md` describes is representable in replay rather than
schema-only.

Terminal root closure is replayed too. The closure record's
`final_consumed + final_unused` is reconciled against the closing grant's
original bounds dimension by dimension; the root is left with zero remaining,
every still-open descendant is closed with zero remaining, and the unused
remainder is extinguished rather than returned or re-minted.

The denied-then-admitted positive replay binds a justified denial, returns
credit through a sibling release, and admits the same canonical request with
the parent's current version. A later identity-matching event reproduces the
recorded admitted result projection exactly. Its terminal closure derives
`final_consumed` from validated releases and `final_unused` from the root plus
all still-open reservation remainders, exercising both halves of settlement.

## Negative proof

Each semantic negative replay is structurally valid and fails exactly one
named invariant: parent overdraw, no-mint spawn, tenant mismatch, org-scope
mismatch, idempotency conflict, double release, over-return accounting,
closed-parent admission, root-closure remint, foreign root binding,
root-closure accounting mismatch, or a sequence gap.

The R3 negatives additionally pin a sum-correct but ledger-wrong closure
split, nested-record/envelope sequence mismatch, an unjustified denial, and a
denial-bound idempotency conflict. In-memory cases cover the two virtual-time
directions, wrong denial code, stale version and denial, and admitted-result
projection drift without multiplying fixtures.

Negative-schema fixtures are separate. They prove that authority-shaped extra
properties, zero grant/request vectors, short idempotency keys, mixed
admission outcomes, incomplete release accounting, an omitted root binding, a
partial-closure claim, and a `code`/`retriable` contradiction fail
structurally.

## Evidence level

L1 is static schema, fixture, inventory, and integrity conformance. L2 is
offline deterministic replay plus a seeded synthetic-tree property proof. The
property proof runs under a seeded deterministic generator with no wall clock,
platform RNG, network, or concurrency, and covers admission drawdown, release
return-and-consume, and terminal root closure, so conservation is read off
replayed state rather than off the generator's own arithmetic. L1/L2 are local
labels in this packet, not gate identifiers and not analyst tiers.

Passing L1/L2 says only that the packet is internally coherent. It does not
accept ADR-0012 — that came from the recorded Governor decision — and it does
not implement enforcement, run a vertical, satisfy W0-T10 or W0-T11, or provide
runtime, UAT, release, deployment, or production evidence.
