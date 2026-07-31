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

`cybrik-suite-inference-packet.v1.manifest.json` (W2-D AI model-inference + alert-summarization),
`cybrik-suite-svc-delegation-packet.v1.manifest.json` (W2-F internal service-delegation +
workload-identity), and `cybrik-suite-org-hierarchy-packet.v1.manifest.json` (W2-G
organizational-hierarchy + external-authority-boundary) are **additive, disjoint** packets, each
`ACCEPTED FOR IMPLEMENTATION` at v0.1.0 (not stable v1/GA, not bundle tags; Gate W2-D / Gate W2-F /
Gate W2-G, 2026-07-24). Each is the single source of truth for its own whole-packet lifecycle state,
records its ADR basis and out-of-scope ADRs, its member inventory, the accepted primitives it reuses
unmodified, and its structural + runtime-only trust invariants. The W2-F and W2-G manifests each
declare `wire_scope: NO SERVER / NO ENDPOINT` and `mcp_scope: OUT OF SCOPE`. The W2-G manifest is the
contract realization of ADR-0007 (org model) per ADR-0009, records per-member SHA-256 integrity and
the D-1..D-8 → schema traceability, asserts disjointness from ADR-0004 (tool-grant chain) and
ADR-0008 (the service-delegation seam, where `org_scope` is opaque/advisory), and records the
feature-flag-OFF / backfill / rollback compatibility stance for the (separately gated, `NOT
IMPLEMENTED`) SOC surface.

`cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json` is a separate
additive restriction profile over the accepted W2-F and investigation-lifecycle packets. It is
**ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED** (v0.1.0; not stable v1/GA; Gate
W2-F-LIFECYCLE-BINDING, 2026-07-31) and reuses the accepted
schemas unchanged. It records the exact `svc:cyber-ai-lifecycle` audience, three externally
delegatable operation/scope pairs, the status/read treatment of `listInvestigationCheckpoints`,
and the fail-closed rule that checkpoint producer writes are not delegatable. It also preserves
`readInvestigationBundle` / `investigation.bundle_read` as an accepted business lifecycle
operation with accepted v0.1.1 response contract while declining only W2-F delegation authority
under this accepted profile: no caller may mint and no relying party may consume a bundle-read delegation
token. Any future binding requires a separately accepted implementation and contract gate. Its
fixtures prove static conformance only; they do not implement or prove a runtime.

`cybrik-suite-investigation-packet.v1.manifest.json` (W0-I01 Investigation/Claim/Evidence/Bundle)
is an **additive, disjoint** packet, `ACCEPTED FOR IMPLEMENTATION` at v0.1.0 (not stable v1/GA)
by explicit Founder Option A with G-W0I01-1..5 `yes` on 2026-07-26. It closes the roadmap Week 0
schema gap, reuses common-defs/data-marking unmodified, and records the
grounded-assertion / honest-abstention structural invariants (TI-1..TI-7) and the
marking-non-downgrade / cross-tenant / citation-dereference / lifecycle-ordering runtime-only
invariants (TR-1..TR-4) a schema alone cannot enforce. Its `trust_invariants` are split into
**three evidence classes**, and the manifest/validator deliberately do not blur them: `structural`
(TI-*, enforced by the JSON Schemas themselves), `runtime_only_fixture_exercised` (TR-1..TR-4 —
the platform must enforce these, but `validate-investigation.mjs` proves, with a concrete
violating/satisfying fixture pair per rule, that each fixture actually exercises it), and
`runtime_only_declared_not_fixture_verifiable` (TR-5 — "claim output is not authority" constrains
a *downstream consumer's* future behavior, not this payload's shape, so no fixture can exercise
it; the validator reports it verbatim as `declared_runtime_only`, never as passed, and the
manifest names the future **CONSUMER-AUTHZ-GATE** — not yet opened, no such gate exists — required
to actually close it against a real consumer implementation). It declares `wire_scope: NO SERVER /
NO ENDPOINT` (JSON Schema payloads only; no OpenAPI/AsyncAPI/MCP delta) and `mcp_scope: OUT OF
SCOPE`. Acceptance authorizes contract-first implementation only; it proves no product runtime
consumer and does not close TR-5.

`cybrik-suite-resource-bounds-packet.v1.manifest.json` is the Gate W2-H
**PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED** resource-accounting packet (v0.1.0, not a bundle
tag). It inventories six `cybrik.res-*` schemas plus the deterministic fixture/replay corpus and
pins every member. The packet proves only Suite-side schema, conservation-property, and replay
coherence. It introduces no authority axis, server, endpoint, OpenAPI, AsyncAPI, MCP, runtime,
UAT, T10/T11, release, deployment, or production claim. ADR-0012 remains proposed.
