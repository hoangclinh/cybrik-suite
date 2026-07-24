# contracts/compatibility

Status: `PROPOSED` packet present — **NOT ACCEPTED**.

Version compatibility matrices between products. `cybrik-suite-contract-packet.v1.manifest.json`
is the inventory and compatibility record for the first cross-product contract packet
(version 0.1.0). It is **not** an ADR-0001 immutable bundle tag — bundle tagging is a
Founder-gated act reserved for `ACCEPTED` contracts, and every member of this packet is
`PROPOSED`. The manifest records format pins, ADR basis and out-of-scope ADRs (0003/0005),
member inventory, per-event correlation semantics (ADR-0006 E6), cross-artifact digest bindings,
and forward-compatibility gaps (RB-001 approval-ingress, MARK-001 SOC marking backfill).
The manifest now also records the monotonic non-escalation / no-downgrade runtime invariants
(risk, isolation, egress, expiry, SemVer) the control plane MUST enforce and that JSON Schema cannot.
Pre-GA, no N-1 obligation attaches yet (ADR-0001 D2), but every future incompatibility MUST be
recorded here.

`cybrik-suite-inference-packet.v1.manifest.json` (W2-D AI model-inference + alert-summarization)
and `cybrik-suite-svc-delegation-packet.v1.manifest.json` (W2-F internal service-delegation +
workload-identity) are **additive, disjoint** packets, each `ACCEPTED FOR IMPLEMENTATION` at v0.1.0
(not stable v1/GA, not bundle tags; Gate W2-D / Gate W2-F, 2026-07-24). Each is the single source
of truth for its own whole-packet lifecycle state, records its ADR basis and out-of-scope ADRs, its
member inventory, the accepted primitives it reuses unmodified, and its structural + runtime-only
trust invariants. The W2-F manifest additionally declares `wire_scope: NO SERVER / NO ENDPOINT` and
`mcp_scope: OUT OF SCOPE`, and asserts disjointness from ADR-0004 (tool-grant chain) and ADR-0007
(org delta / A05 boundary).
