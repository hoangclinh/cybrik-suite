# contracts/ — Cross-product contracts

Status: first cross-product contract packet is present, statused `PROPOSED` — **NOT ACCEPTED**
(version 0.1.0). No contract has been accepted; no product may implement any of these until
explicit Founder acceptance (ADR-0001 D5).

This directory is the single home for interfaces shared between CYBRIK Suite products.
Product repositories implement contracts defined here; contracts are never retro-fitted from
implementations without review.

The v1 packet (all `PROPOSED — NOT ACCEPTED`): shared JSON Schemas under `json-schema/` (envelope,
data marking, capability, tool execution request/result, delegation chain, execution receipt,
approval request/decision, common defs); event bindings under `asyncapi/`; a control-plane REST
mapping under `openapi/`; MCP mapping notes under `mcp/`; the inventory/compatibility manifest
under `compatibility/`; and conformance fixtures under `examples/`. Format pins: OpenAPI 3.1.x,
JSON Schema 2020-12, AsyncAPI 3.0.0, MCP 2025-11-25 (ADR-0001 D4).

The **W2-D AI model-inference + alert-summarization packet** (all `ACCEPTED FOR IMPLEMENTATION`,
v0.1.0, not stable v1/GA; accepted at Gate W2-D — Codex under Founder delegation, 2026-07-24) is
**additive to, and disjoint from,** the v0.1 packet: it
introduces the `cybrik.model-*` / `cybrik.alert-summarization-*` JSON Schemas under `json-schema/`,
inference lifecycle events (`asyncapi/cybrik-ai-inference-events.v1.asyncapi.yaml`), an
inference-plane REST mapping (`openapi/cybrik-ai-inference-plane.v1.openapi.yaml`), provider-adapter
mapping notes under `adapters/`, its own compatibility manifest under `compatibility/`, and fixtures
under `examples/inference/`. It **reuses the accepted common-defs, data-marking, and envelope
primitives by `$ref` without modifying them**, names a model only by a policy-selected `model_class`
token (no vendor/endpoint on the wire), and grants a model **no tool/agent/approval authority**
(disjoint from the accepted Tool-Fabric packet, ADR-0004; MCP out of scope). See
`compatibility/cybrik-suite-inference-packet.v1.manifest.json`.

The **W2-F internal service-delegation + workload-identity packet** (all `ACCEPTED FOR
IMPLEMENTATION`, v0.1.0, not stable v1/GA; accepted at Gate W2-F — Codex under Founder delegation,
2026-07-24) is **additive to, and disjoint from,** both packets. It governs the IDENTITY/DELEGATION
seam in front of the W2-D inference operations (internal SOC → Cyber AI), realizing the ADR-0006
E2/E3 two-layer trust seam per ADR-0008: transport mTLS workload identity (SPIFFE-compatible, not
required) plus a short-lived (`<=120s`), asymmetric, certificate-bound (`cnf`) RFC 9068 delegation
token. It introduces the `cybrik.svc-*` JSON Schemas under `json-schema/`, delegation →
inference-operation mapping notes under `adapters/`, its own compatibility manifest under
`compatibility/`, and fixtures under `examples/svc/`. It **reuses common-defs and data-marking by
`$ref` without modifying them**, declares **no server/endpoint** and **no MCP/tool authority**, and
keeps the external-authority (A05) boundary distinct (ADR-0007 OD-3). See
`compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json`.

The **investigation-lifecycle service-delegation binding** is an additive restriction proposal,
status **PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED** (v0.1.0; not stable v1/GA). It reuses the
accepted W2-F schemas unchanged and fixes the relying-party audience to
`svc:cyber-ai-lifecycle`. Only `investigation.create`, `investigation.status`, and
`investigation.cancel` are externally delegatable, with one exact scope each. The
`listInvestigationCheckpoints` REST read maps to `investigation.status`/read;
`investigation.checkpoint` remains an internal producer write. `readInvestigationBundle` /
`investigation.bundle_read` is already an accepted business lifecycle operation with the accepted
v0.1.1 response contract; this proposed binding grants it no delegation authority, so no caller
may mint and no relying party may consume a bundle-read delegation token under this proposal. Any
future binding requires a separately accepted implementation and contract gate. See
`compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json`.

The **W2-G organizational-hierarchy + external-authority-boundary packet** (all `ACCEPTED FOR
IMPLEMENTATION`, v0.1.0, not stable v1/GA; accepted at Gate W2-G — Codex under Founder delegation,
2026-07-24) is **additive to, and disjoint from,** all three packets above. It is the contract
realization of the ADR-0007 org-hierarchy model (accepted at Gate W2-C1) per ADR-0009 — applying
the contract delta D-1..D-8. It introduces the `cybrik.org-*` JSON Schemas under `json-schema/`
(org_node / lifecycle / membership / scope-grant / edge / external-exchange / aggregate
request+result + shared defs), org → SOC mapping notes under `adapters/`, its own compatibility
manifest under `compatibility/`, and fixtures under `examples/org/`. It **reuses common-defs and
data-marking by `$ref` without modifying them**, encodes INV-1 (hierarchy ≠ raw read) and INV-2
(external authority never super-admin) structurally, declares **no server/endpoint** and **no
MCP/tool authority**, and keeps the A05 boundary distinct. The SOC migration/API/UI it maps onto are
owned + separately gated by `cybrik-soc-command-center` and are `NOT IMPLEMENTED`. See
`compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json`.

| Directory | Will contain |
|---|---|
| `openapi/` | REST API contracts (OpenAPI) |
| `asyncapi/` | Event/stream contracts (AsyncAPI) |
| `json-schema/` | Shared data object schemas (JSON Schema) |
| `mcp/` | MCP server/tool capability contracts |
| `adapters/` | Mapping notes (boundary docs): W2-D provider-adapter wire boundary; W2-F delegation → inference-operation mapping; W2-G org-hierarchy → SOC migration/API/UI mapping |
| `compatibility/` | Version compatibility matrices between products |
| `examples/` | Conformance fixtures (positive/negative) for the validators |

## Lifecycle

Every contract file must carry a status header: `PROPOSED` → `ACCEPTED` → `DEPRECATED`.
Moving a contract out of `PROPOSED` requires explicit Founder approval. Do not scaffold
placeholder OpenAPI/schema files as if they were accepted contracts.
