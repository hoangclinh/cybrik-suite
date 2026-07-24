# contracts/mcp

Status: `PROPOSED` packet present — **NOT ACCEPTED**. Format pin: MCP 2025-11-25 (ADR-0001 D4).

MCP server/tool capability contracts. `cybrik-mcp-mapping-notes.v1.md` records how MCP adapts
onto the packet's shared schemas (statused `PROPOSED — NOT ACCEPTED`, version 0.1.0). Notes only:
no server endpoints, transports, or secrets. Non-negotiable position (ADR-0006): **MCP is an
adapter/capability protocol, not a trust boundary** — identity, policy, approval, credentials,
and receipts live below MCP in the Tool Fabric control plane. Moving out of `PROPOSED` requires
explicit Founder approval.
