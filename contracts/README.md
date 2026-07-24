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

| Directory | Will contain |
|---|---|
| `openapi/` | REST API contracts (OpenAPI) |
| `asyncapi/` | Event/stream contracts (AsyncAPI) |
| `json-schema/` | Shared data object schemas (JSON Schema) |
| `mcp/` | MCP server/tool capability contracts |
| `compatibility/` | Version compatibility matrices between products |

## Lifecycle

Every contract file must carry a status header: `PROPOSED` → `ACCEPTED` → `DEPRECATED`.
Moving a contract out of `PROPOSED` requires explicit Founder approval. Do not scaffold
placeholder OpenAPI/schema files as if they were accepted contracts.
