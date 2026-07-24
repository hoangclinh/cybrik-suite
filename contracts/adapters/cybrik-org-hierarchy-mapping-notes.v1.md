# CYBRIK org-hierarchy → SOC implementation mapping notes v1

Status: **ACCEPTED FOR IMPLEMENTATION** (v0.1.0; not stable v1/GA). Accepted at Gate W2-G
(Codex under Founder delegation, 2026-07-24). Acceptance authorizes contract-first implementation
at v0.1.0; it is **not** a stable v1/GA promotion and **not** an ADR-0001 immutable bundle tag.

Contract version: 0.1.0 · ADR basis: ADR-0007 (org-hierarchy & external-authority model, `ACCEPTED`
at Gate W2-C1), ADR-0009 (org-hierarchy + external-authority contract profile, this gate), ADR-0006
(cross-product event & identity model), ADR-0001 (versioning).

## Purpose and the boundary this note makes explicit

This note records how the W2-G organizational-hierarchy packet (`cybrik.org-*`) maps **onto** the
implementation surface owned by `cybrik-soc-command-center` — a database migration, an API, and a
UI wave — **without** any of that surface being created, decided, or implemented in this repository.
It exists to keep one boundary durable:

> **The org-hierarchy packet is a set of JSON Schema validation contracts plus this mapping note. It
> declares NO operational server, endpoint, host, route, URL, database, migration file, or client
> code. It grants no tool/agent/MCP authority. The SOC repository owns and gates its own migration,
> API, and UI; those artifacts do not live here and are `NOT IMPLEMENTED`.**

The identifiers below (migration `0022`, endpoint shapes, UI routes, a React scope context) are an
**illustrative, non-normative mapping target** for the owning product — concept names, not proposed
identifiers and not an accepted API/DB contract. Per `cybrik-suite:CLAUDE.md` ownership boundaries,
SOC truth (org structure, memberships, cases) is owned by `cybrik-soc-command-center`; nothing here
authorizes a change inside that repository (a separate Founder-gated migration).

`$id`s in the referenced schemas use the RFC 2606 `.example` documentation domain as identifiers,
not endpoints.

## Object → owner → implementation-surface mapping

Every object is contract-first here and product-implemented there. The middle column is the schema
this repo owns; the right column is the **illustrative** SOC surface it maps onto (not built here).

| Packet schema (owned here) | Concept | Illustrative SOC implementation surface (owned by `cybrik-soc-command-center`, NOT built here) |
|---|---|---|
| `cybrik.org-node.v1` (D-1) | governance-tree node | `org_node` table rows; migration `0022_org_hierarchy` adds `org_node`, `org_edge` (see below). `parent_id` FK is same-tenant + internal (DB CHECK + app guard). |
| `cybrik.org-node-lifecycle.v1` (D-1) | governed status transition | `org_node.status` transition + append-only `org_node_lifecycle` audit row; **no `DELETE`** of a referenced node — archive only (a DB-level guard, not a hard delete). |
| `cybrik.org-membership.v1` (D-2) | actor ↔ node ↔ role | `org_membership` table (internal nodes only); backs the RBAC/RLS join. |
| `cybrik.org-scope-grant.v1` (D-4, D-7) | hierarchical authorization + break-glass | `org_scope_grant` table; AND-composed with tenant RLS + RBAC at query time; break-glass rows are loud + self-revoking. |
| `cybrik.org-edge.v1` (D-5) | typed governance/exchange edge | `org_edge` table; same-tenant + acyclic (app + DB CHECK); `parent`/`tasking` never confer raw read. |
| `cybrik.org-external-exchange.v1` (D-6) | A05 external crossing | `org_external_exchange` table + a **distinct** exchange surface (not the internal switcher); inbound lands in a review queue, never auto-executes. |
| `cybrik.org-aggregate-request.v1` / `-result.v1` (D-8) | de-identified roll-up | a read-only aggregate query path (k=5 small-cell floor); returns counts only, never raw records / objectRefs. |
| `cybrik.org-common-defs.v1` | shared primitives | `$ref` target only; no table of its own. |

### Migration `0022` (illustrative target; owned + gated by SOC)

A single additive migration in `cybrik-soc-command-center` would introduce the tables above. It is
**additive and reversible**: it adds tables/columns and a feature flag; it does not alter or drop
any accepted v0.1 SOC surface. The migration, its exact DDL, and its own acceptance gate live in
the SOC repository — **not here**. Rollback = drop the additive tables + clear the flag (see
Feature flag & rollback below); it never hard-deletes referenced audit history.

### API surface (illustrative target; owned + gated by SOC)

Read/authorization endpoints (e.g. resolve a node's ancestors/descendants, list memberships,
evaluate a scope grant, request an aggregate roll-up, submit/receive an external exchange) map
1:1 onto the packet schemas as **request/response validation contracts**. This packet defines the
payload shapes; it defines **no** OpenAPI server, path, or channel. Each endpoint re-checks tenant
(FC-2), AND-composes tenant RLS + RBAC + the scope grant (FC-1), and enforces the runtime
invariants below (a green validator run does not).

### UI surface (illustrative target; owned + gated by SOC; UAT-gated)

- **Canonical org scope in the URL.** Every scoped view carries the acting node and visibility mode
  in a **canonical URL** of the form `/org/:orgNodeId/:scopeKind/...` (e.g.
  `/org/on-district/aggregate/dashboard`), so scope is deep-linkable, auditable, and never implicit.
  `:orgNodeId` is the opaque `org_node_id` (never a tier name); `:scopeKind` is one of
  `own-node|descendant|aggregate|delegated`.
- **React org-scope context.** A single `OrgScopeProvider` React context is the one source of the
  current `{ orgNodeId, scopeKind, tenantId }`; the hierarchy switcher (03 §2.2) writes it, the URL
  mirrors it, and every data hook reads scope from it — no component fetches cross-scope data out of
  band. Switching node re-scopes the whole surface and is an audited action.
- **A05 exchange is a distinct surface**, never the internal switcher; it is labelled an external
  trust boundary and never presents A05 as an internal tier or admin (INV-2).
- Every UI wave surfacing this MUST clear the [UAT Gate Standard](../../docs/uat/UAT-GATE-STANDARD.md);
  see the W2-G UAT trace. A single failed negative-isolation test (INV-1 / INV-2 / cross-tenant) is
  an automatic FAIL of the whole wave.

## Feature flag & rollback (default OFF)

The org-hierarchy surface ships **behind a feature flag that defaults OFF**. With the flag off, the
product behaves exactly as the accepted v0.1 single-tier surface (backward compatible). Turning it
on is a deployment decision, not a contract change. **Rollback** is: clear the flag (surface
reverts to flat) and, if needed, reverse the additive migration `0022` — which drops the additive
tables and never hard-deletes referenced audit history (a node is archived via
`cybrik.org-node-lifecycle`, never row-deleted; D-1). **Backfill on reorg churn** (AC-11): archiving
a node MAY reassign its live memberships/edges to a **same-tenant internal** successor via
`org-node-lifecycle.backfill` — never across tenants or to an external peer.

## Runtime invariants the implementing product MUST enforce (not proven by a green validator)

These are the negative-semantic invariants the schemas cannot enforce (a schema cannot compare two
field values, walk a tree, evaluate wall-clock time, or compare a marking to its source). They are
REQUIRED of every implementation and map to the compatibility manifest `trust_invariants.runtime_only`:

1. **Same-tenant, acyclic tree (FC-2 / OD-1).** Every edge's `from_node.tenant_binding ==
   to_node.tenant_binding`; endpoints never form a cycle (including `from == to`); `parent_id`
   resolves to a same-tenant internal node. Hierarchy never weakens tenant isolation.
2. **Hierarchy ≠ raw read (INV-1 / FC-3).** An `ancestor-governance` grant is aggregate-only; raw
   descendant access requires an `explicit-descendant-grant` with a **non-empty** `raw_scope` +
   need-to-know. A missing/empty raw scope denies (never fail-opens). A sibling/unrelated target is
   not a valid descendant — the relying party verifies the tree relationship matches
   `subject_relationship`.
3. **Aggregate is de-identified (FC-4 / OD-2).** Cross-tier default is `aggregate`; every
   unsuppressed cell count `>= 5`; no cell carries a raw record / objectRef.
4. **External is exchange-only (INV-2 / FC-5).** An `external` (A05) node is never a parent/ancestor,
   never an `org_node` member, never reuses an internal token; an inbound directive never
   auto-executes.
5. **Marking / residency gate (FC-6 / OD-4, AC-9).** Marking is re-checked on every crossing and is
   **never downgraded** relative to the source; residency is deny-by-default.
6. **Grants expire and revoke immediately (FC-7).** An expired or revoked grant re-authorizes
   nothing on idempotent replay; break-glass over 900s requires a second human approval and
   self-revokes.
7. **No hard-delete of referenced nodes (D-1).** A referenced node is archived, never row-deleted;
   backfill stays same-tenant + internal.

## Out of scope

The SOC migration/API/UI themselves (owned + gated by `cybrik-soc-command-center` — not built here);
the Tool-Fabric tool-grant chain and MCP (ADR-0004); the internal service-delegation seam (ADR-0008
/ W2-F — `org_scope` is opaque/advisory there); durable orchestration / bus (ADR-0003); sandbox
substrate (ADR-0005); differential privacy (explicitly not adopted at OD-2). None of these is
decided or implemented by this note.
