# CYBRIK MCP mapping notes v1

- Status: `PROPOSED` — **NOT ACCEPTED**
- Contract version: 0.1.0
- Format pin: **MCP 2025-11-25** (ADR-0001 D4)
- Scope: how the Model Context Protocol adapts onto the PROPOSED cross-product schemas in
  this packet. Notes only — no server endpoints, no secrets, no transport addresses.

## 1. Position (non-negotiable)

MCP is an **adapter/capability protocol, not a trust boundary** (ADR-0006). Identity, policy,
approval, credentials, and receipts live **below** MCP, in the Tool Fabric control plane.
**Nothing may treat an MCP session as a trust boundary.** An MCP server is an adapter in front
of the Tool Fabric control plane; it never calls an executor or backend directly
(strategy 05 §2.3).

## 2. Mapping

| MCP 2025-11-25 concept | CYBRIK contract binding |
|---|---|
| `tools/list` result item | Projection of a `cybrik.capability.v1` registry entry the actor is authorized to see. Discovery MUST filter by authorization; unseen capabilities are omitted, not denied-on-call only. |
| Tool `name` | Capability `name` (e.g. `soc.search_related_events`). |
| Tool `inputSchema` | The capability `input_schema_ref` target (JSON Schema 2020-12). |
| Tool `outputSchema` | The capability `output_schema_ref` target. |
| `tools/call` request | Maps to exactly one `cybrik.tool-execution-request.v1`. There is **no bypass** of REST/control-plane policy; the same policy, delegation, and approval path applies. |
| `tools/call` result | Maps to `cybrik.tool-execution-result.v1`. Tool output returned to the model is **untrusted data** (strategy 05 §11.6). |
| Elicitation / approval | MCP MUST NOT self-authorize side effects. `approval_required` is surfaced from the control plane as `cybrik.approval-request.v1`; the decision is `cybrik.approval-decision.v1`, made by an authenticated human, not by the MCP session. |
| Structured content / resource links | Larger output is referenced by scoped owner-issued locator + digest, never an arbitrary public URL. |

## 3. Identity, transport, and authorization

- **Remote MCP** MUST use authentication + mTLS. **stdio** MCP is only for a local trusted
  client and still requires a process identity (strategy 05 §2.3).
- The MCP session carries **no authority of its own**. The control plane derives the
  authoritative tenant and actor from the underlying credential and the digest-bound
  delegation chain (`delegation_ref`), and re-checks authorization at execution time.
- Model-asserted `tenant_id` / `actor` / `approval` / credential fields arriving through
  `tools/call` arguments are ignored or rejected (strategy 05 §11.1).

## 4. What this note does NOT do

- It does not define an MCP server manifest schema (deferred to a later packet).
- It does not select a transport, endpoint, or deployment.
- It does not grant MCP any trust, policy, or approval authority.
