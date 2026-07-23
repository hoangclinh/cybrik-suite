# contracts/ — Cross-product contracts

Status: `SCAFFOLD` — **no contracts exist yet.** Every subdirectory is intentionally empty.

This directory is the single home for interfaces shared between CYBRIK Suite products.
Product repositories implement contracts defined here; contracts are never retro-fitted from
implementations without review.

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
