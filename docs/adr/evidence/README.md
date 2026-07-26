# docs/adr/evidence — ADR evidence packets

- Status: `DRAFT` (process document + catalog)
- Date: 2026-07-23 · catalog rows refreshed 2026-07-26 after GATE A4 closed

An **evidence packet** is the research artifact backing one ADR. It informs the Founder's
decision; it never makes the decision. Packets may contain a `RECOMMENDATION`, but an ADR's
status changes only when the Founder records acceptance.

## Packet format

Each packet is one file, `ADR-XXXX-EVIDENCE.md`, with these sections in order:

1. **Header** — status (`DRAFT`), date, ADR link, scope of the packet.
2. **Decision criteria** — the criteria options are scored against, stated before scoring.
3. **External research** — claims about standards/products, each labeled and sourced:
   - `FACT` — verified against the primary source cited.
   - `RESEARCH` — summarized from a primary source; not independently reproduced.
   - `PROPOSAL` — our suggested position, ours to defend.
   - `INFERENCE` — reasoning derived from labeled facts; could be wrong.
   - `UNKNOWN` — open question; must appear in the Founder decision list if material.
   - Every external claim cites a primary/official URL **and access date**.
4. **Option analysis** — every option from the ADR, each with criteria scoring and explicit
   trade-offs. No option may be preferred solely for popularity.
5. **RECOMMENDATION** — clearly labeled, with the consequences the Founder is accepting if
   they follow it. Never contains the words "accepted" or "approved".
6. **Founder decisions required** — exact, answerable questions (A/B/C or yes/no).
7. **Evidence limitations** — what was not verified, prototyped, or measured.

## Hard rules

- No packet may claim anything in the suite is implemented, verified, or piloted.
- No packet may embed a real schema/OpenAPI/AsyncAPI/MCP contract; illustrative field lists
  must be marked `ILLUSTRATIVE — NOT A CONTRACT`.
- Secondary sources (blog roundups, marketing claims) are not admissible for external facts.
- Superseded packets are kept and marked, never deleted.

## Catalog

| Packet | Backs | Status |
|---|---|---|
| [ADR-0001-EVIDENCE.md](ADR-0001-EVIDENCE.md) | [ADR-0001](../ADR-0001-suite-contract-versioning-policy.md) | `DRAFT` — recommendation made; ADR since `ACCEPTED` (2026-07-24) |
| [ADR-0002-EVIDENCE.md](ADR-0002-EVIDENCE.md) | [ADR-0002](../ADR-0002-cyber-ai-implementation-stack.md) | `DRAFT` — recommendation made; ADR since `ACCEPTED` (2026-07-24) |
| [ADR-0003-EVIDENCE.md](ADR-0003-EVIDENCE.md) | [ADR-0003](../ADR-0003-durable-agent-orchestration.md) | `DRAFT` — Wave 2 read-ahead recommendation; ADR since `ACCEPTED` (GATE A4, 2026-07-26 — decision only). This packet's own body still carries pre-closure `GATE A4 unopened` wording (open residual, board §14.8.3); the ADR catalog is authoritative |
| [ADR-0004-EVIDENCE.md](ADR-0004-EVIDENCE.md) | [ADR-0004](../ADR-0004-tool-fabric-control-plane-executor-split.md) | `DRAFT` — recommendation made; ADR since `ACCEPTED` (2026-07-24) |
| [ADR-0005-EVIDENCE.md](ADR-0005-EVIDENCE.md) | [ADR-0005](../ADR-0005-sandbox-substrate.md) | `DRAFT` — Wave 2 read-ahead recommendation; ADR since `ACCEPTED` (GATE A4, 2026-07-26 — decision only). Repaired for the S4-pooling rule on 2026-07-26, but its header/§7/§15/§17 still carry pre-closure `GATE A4 is not open` wording (open residual, board §14.8.3); the ADR catalog is authoritative |
| [ADR-0006-EVIDENCE.md](ADR-0006-EVIDENCE.md) | [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md) | `DRAFT` — recommendation made; ADR since `ACCEPTED` (2026-07-24) |
