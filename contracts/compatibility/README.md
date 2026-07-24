# contracts/compatibility

Status: `PROPOSED` packet present — **NOT ACCEPTED**.

Version compatibility matrices between products. `cybrik-suite-contract-packet.v1.manifest.json`
is the inventory and compatibility record for the first cross-product contract packet
(version 0.1.0). It is **not** an ADR-0001 immutable bundle tag — bundle tagging is a
Founder-gated act reserved for `ACCEPTED` contracts, and every member of this packet is
`PROPOSED`. The manifest records format pins, ADR basis and out-of-scope ADRs (0003/0005),
member inventory, per-event correlation semantics (ADR-0006 E6), cross-artifact digest bindings,
and forward-compatibility gaps (RB-001 approval-ingress, MARK-001 SOC marking backfill).
Pre-GA, no N-1 obligation attaches yet (ADR-0001 D2), but every future incompatibility MUST be
recorded here.
