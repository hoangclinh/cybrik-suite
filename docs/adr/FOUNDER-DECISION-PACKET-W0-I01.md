# Founder Decision Packet — W0-I01 Investigation contract packet

- Status: `DECIDED — OPTION A — INCLUDED IN A3 SUITE PROVENANCE COMMIT`
- Prepared: 2026-07-26
- Contract lifecycle: `ACCEPTED FOR IMPLEMENTATION — not stable v1/GA`
- Release impact: none; this packet does not change any fixed release date or certify a release
- Review source snapshot:
  `cybrik-worktrees/w0-48/w0-i01-contracts-r1` (execution worktree, not a documentation
  source of truth)

This packet presents a bounded cross-product contract decision. It does not accept the proposal,
authorize a status flip, merge a worktree, or certify a runtime consumer. Under ADR-0001 D5,
acceptance requires an explicit Founder answer followed by a separate evidence-linked status-flip
change. Silence, a green validator, or this document is not acceptance.

## 1. Decision requested

Choose one disposition for the proposed W0-I01 packet:

| Option | Meaning |
|---|---|
| **A — Accept for implementation (recommended)** | Accept the five-member v0.1.0 packet: one shared investigation-definitions schema plus Investigation, Claim, Evidence, and Investigation Bundle payload schemas, subject to all boundaries in §3 |
| B — Revise | Return exact fields/invariants requiring change; packet remains `PROPOSED` |
| C — Reject | Reject this packet; no product may implement its members |

If Option A is chosen, confirm each decision below:

| Gate item | Recommended answer | Decision |
|---|---|---|
| G-W0I01-1 — `investigation_id` is required on every investigation-scoped artifact | Yes | **Yes — Founder, 2026-07-26** |
| G-W0I01-2 — grounded assertion and honest abstention are mandatory structural invariants | Yes | **Yes — Founder, 2026-07-26** |
| G-W0I01-3 — Claim/Evidence carry no tool, agent, approval, or action authority | Yes | **Yes — Founder, 2026-07-26** |
| G-W0I01-4 — product-owned content is referenced by digest-bound object reference, never inlined | Yes | **Yes — Founder, 2026-07-26** |
| G-W0I01-5 — OpenAPI, AsyncAPI, and MCP bindings are deferred to a separate later contract change | Yes | **Yes — Founder, 2026-07-26** |

## 2. Evidence available

The standalone proposal validator currently reports:

- 5 schemas loaded and 4 payload schemas compiled;
- 9/9 positive fixtures;
- 8/8 schema-negative fixtures rejected;
- 9/9 semantic-negative fixtures structurally valid and evaluated;
- 45/45 declared fixture-verifiable invariants;
- 4/4 derivation self-checks;
- no P0–P3 finding in the final independent review.

This evidence shows internal proposal consistency only. The validator is deliberately not wired
into the suite-wide validator while the packet is unaccepted.

## 3. Acceptance boundaries

An acceptance decision would:

- authorize implementation against the exact proposed schema packet after its separate status
  flip;
- preserve SOC ownership of alerts, cases, assets, and analyst identity;
- preserve Tool Fabric ownership of execution authority and approvals;
- keep claim statements and confidence advisory-only.

It would not:

- create a server, endpoint, event channel, MCP tool, model authority, approval, or action trigger;
- verify any product runtime consumer;
- close TR-5, whose proof requires a future consumer-authorization gate against real product code;
- accept the separate W2-I inference transport packet;
- change a release date, create a stable v1/GA bundle, or authorize a commit, merge, or push.

## 4. Collision-free status-flip scope

If the Founder explicitly selects Option A, the subsequent status-flip change must be path-bounded
to the I01 proposal members, fixtures, standalone validator, and their local catalog entries.
`contracts/README.md` must not be copied wholesale from the I01 worktree: it collides with the
current accepted-packet catalog in the main suite worktree and requires a dedicated reconciliation.
I01 owns no `contracts/openapi/`, `contracts/asyncapi/`, or `contracts/mcp/` path.

## 5. Recorded Founder decision

- Option: **A — Accept for implementation**
- G-W0I01-1..5: **yes**
- Conditions: application must remain path-bounded by §4 and
  `cybrik-suite:docs/operations/W0-I01-POST-DECISION-APPLICATION-BRIEF.md`; this decision does not
  itself flip lifecycle bytes, accept W2-I, close TR-5, or authorize commit/merge/push/release.
- Decided by: **Founder**
- Decided on: **2026-07-26**
- Decision evidence: exact W0 Bundle A response recorded in
  `cybrik-suite:docs/adr/FOUNDER-DECISION-QUEUE-W0.md`.

Bundle B Option A was explicitly approved by the Founder on 2026-07-26 with G-W0BB-1..10=yes.
It authorizes the exact 12-entry canonical Suite application and the single local path-limited
Suite provenance commit described in
`FOUNDER-DECISION-PACKET-W0-BUNDLE-B-APPLICATIONS.md`; it does not waive validation/review or
authorize push, merge or release.

The exact application has now passed its standalone and aggregate validators plus independent
review with no remaining P0–P3. In the A3 Suite provenance commit containing this record, W0-I01
is `ACCEPTED FOR IMPLEMENTATION` at v0.1.0. This is not stable v1/GA, proves no runtime consumer
and does not close TR-5, which remains `declared_runtime_only`. I02 may start only after the exact
A3 commit exists.
