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

The **W2-D AI model-inference + alert-summarization packet** (all `PROPOSED — NOT ACCEPTED`,
v0.1.0; Gate W2-D not yet opened) is **additive to, and disjoint from,** the v0.1 packet: it
introduces the `cybrik.model-*` / `cybrik.alert-summarization-*` JSON Schemas under `json-schema/`,
inference lifecycle events (`asyncapi/cybrik-ai-inference-events.v1.asyncapi.yaml`), an
inference-plane REST mapping (`openapi/cybrik-ai-inference-plane.v1.openapi.yaml`), provider-adapter
mapping notes under `adapters/`, its own compatibility manifest under `compatibility/`, and fixtures
under `examples/inference/`. It **reuses the accepted common-defs, data-marking, and envelope
primitives by `$ref` without modifying them**, names a model only by a policy-selected `model_class`
token (no vendor/endpoint on the wire), and grants a model **no tool/agent/approval authority**
(disjoint from the accepted Tool-Fabric packet, ADR-0004; MCP out of scope). See
`compatibility/cybrik-suite-inference-packet.v1.manifest.json`.

| Directory | Will contain |
|---|---|
| `openapi/` | REST API contracts (OpenAPI) |
| `asyncapi/` | Event/stream contracts (AsyncAPI) |
| `json-schema/` | Shared data object schemas (JSON Schema) |
| `mcp/` | MCP server/tool capability contracts |
| `adapters/` | Provider-adapter mapping notes (wire/adapter boundary; W2-D inference packet) |
| `compatibility/` | Version compatibility matrices between products |
| `examples/` | Conformance fixtures (positive/negative) for the validators |

## Lifecycle

Every contract file must carry a status header: `PROPOSED` → `ACCEPTED` → `DEPRECATED`.
Moving a contract out of `PROPOSED` requires explicit Founder approval. Do not scaffold
placeholder OpenAPI/schema files as if they were accepted contracts.
