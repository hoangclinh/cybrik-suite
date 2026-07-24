# Org-Hierarchy Domain Model — CYBRIK Suite

- Status: `ACCEPTED` as architectural model at Gate W2-C1 (2026-07-24, via ADR-0007); no schema,
  contract, code, or UI is accepted or implemented by this acceptance.
- Packet: [Organizational hierarchy & external-authority boundary](README.md)
- Date: 2026-07-24
- Gate: authored under W2-C0; model accepted at W2-C1 (Founder-delegated Codex decision 2026-07-24)
- Owner concern: cross-product model (this repo). Implementation, if ever accepted, is split
  across `cybrik-soc-command-center`, `cybrik-security-tool-fabric`, and
  `cybrik-cyber-ai-platform` per the ownership boundaries in `cybrik-suite:CLAUDE.md`.
- Depends on / aligns with: `ADR-0006` (cross-product event & identity model, `ACCEPTED`),
  `ADR-0001` (contract/versioning policy, `ACCEPTED`).

> **Status honesty.** This is a *model proposal only*. Nothing here is implemented, accepted,
> or wired to any schema. No contract is edited by this packet (see
> [05-contract-delta-proposal.md](05-contract-delta-proposal.md) for a *proposed, not applied*
> delta). Every concept below is a candidate for a future Founder-gated ADR.

---

## 0. Purpose and framing

Government and large-enterprise SOC deployments are not flat single-tenant systems. A national
or federated security operation spans **organizational tiers** (central → regional → local) and
must interoperate with **external authorities** it does not own and cannot administer (in the
Vietnamese reference context, the "A05" connection — see
[01-vietnam-coordination-evidence.md](01-vietnam-coordination-evidence.md)).

This document proposes a **portable** domain model. Vietnam is the *motivating* reference case,
not a hard-coded structure. The same primitives must express US federal/state/local, EU
national-CERT federations, or a multinational MSSP serving many client organizations. Country
specifics live only in **configuration and data**, never in the model or schemas.

Two invariants govern everything below and are repeated because they are the whole point:

- **INV-1 — Hierarchy is authority routing, not data access.** Being an ancestor of a node
  grants *governance* capabilities (tasking, roll-up of aggregates, policy) — it does **not**
  grant automatic read access to descendants' raw case/alert/asset data. Raw-data access is
  always a separate, explicit, audited grant subject to need-to-know.
- **INV-2 — An external authority connection is not a super-admin.** The A05 (or any external
  upper-boundary) connection is an **exchange peer across a trust boundary**, gated by
  contract, marking, and per-exchange authorization. It is never modeled as the root of the
  org tree and never receives blanket administrative rights over tenants.

---

## 1. Core entities

### 1.1 `tenant` vs `org_node` — the central separation

The single most important modeling decision is to **separate the isolation boundary from the
governance hierarchy**.

| Concept | `tenant` | `org_node` |
|---|---|---|
| Answers | "Whose data isolation domain is this?" | "Where does this sit in the chain of authority?" |
| Cardinality | Coarse; the hard security/isolation boundary | Fine; a tree of governance units |
| Owned by | Suite platform (isolation is enforced everywhere) | Deployment configuration |
| Existing contract surface | `tenantId` (accepted v0.1 `common-defs`) | **none today** — this is the gap |
| Cross-boundary default | Deny; mismatch MUST be rejected (ADR-0006) | Governance edges are explicit, typed, audited |

Design rule: **`org_node` never weakens `tenant` isolation.** The tenant remains the ADR-0006
cross-tenant rejection boundary. Org hierarchy is expressed *within or across* tenants only
through explicit typed edges (§4–§6), each of which is independently authorized and audited. A
deployment MAY map one tenant per org_node (strict isolation), one tenant spanning many
org_nodes (shared-platform, org-unit sub-partitioning), or a hybrid. The model must not assume
either.

> **Why not just nest tenants?** Because tenancy is the fail-closed isolation primitive the
> accepted contracts already enforce. Overloading it with governance semantics would make
> "my parent can see my data" the *default*, which violates INV-1. Keeping them separate makes
> raw-data sharing an explicit act, not a side effect of where you sit in the tree.

### 1.2 `org_node`

A node in the governance tree. Proposed conceptual fields (illustrative — **not** a schema):

- `org_node_id` — opaque stable id.
- `parent_id` — nullable; null only for a deployment root. A node has at most one governance
  parent (tree, not DAG) to keep authority unambiguous. Cross-branch relationships are modeled
  as **exchange edges** (§6), not second parents.
- `tier` — an integer or ordinal referencing the deployment's configured **tier ladder**
  (§2). Tiers are labels over depth, not hard-coded names.
- `tenant_binding` — which tenant(s) this node's data lives in (see §1.1).
- `jurisdiction` — see §3.
- `labels` — deployment-configurable display names in each supported locale (VI/EN at minimum);
  the model stores keys, the UI resolves labels (see
  [03-ux-information-architecture.md](03-ux-information-architecture.md)).
- `status` — `active` / `suspended` / `archived`. Never hard-deleted while audit references
  exist.
- `boundary_kind` — `internal` (a governed tier inside the deployment) or `external` (an
  exchange peer such as A05; see §6, INV-2). External nodes are **not** administrable and do
  **not** appear as ancestors of internal nodes.

### 1.3 `org_membership`

Binds an `actor` (ADR-0006 `common-defs.actor`) to an `org_node` with a **role**. Membership is
what turns "I am at node X" into "I may do Y at node X." Roles are deployment-configurable but
map to a small set of **capability archetypes** (analyst, org-unit admin, tenant admin, tier
coordinator, external liaison — see [04](04-threat-model-and-open-decisions.md) persona work and
the [UAT persona matrix](../../uat/UAT-GATE-STANDARD.md)).

Membership does **not** by itself confer descendant data access — it confers node-scoped
capability. Descendant access is governed by scope (§2) plus need-to-know (§2.5).

---

## 2. Tiers and scopes

### 2.1 Configurable tier ladder (3–4 tiers, portable)

A deployment declares an ordered **tier ladder**, e.g.:

- VN reference (illustrative, subject to the evidence doc; the 2025 administrative
  reorganization is time-sensitive — see [01](01-vietnam-coordination-evidence.md)):
  `central → provincial → (district) → commune/local`, 3–4 tiers, with A05 as an **external**
  upper boundary *above/beside* central rather than a tier the product administers.
- US reference: `federal → state → local`.
- MSSP reference: `MSSP-HQ → region → client-org`.

The product ships **no** fixed tier names. The ladder is data. The model only needs: ordinal
depth, a display-label key per locale, and per-tier default policy hints.

### 2.2 Scope kinds

Every capability a membership grants is qualified by a **scope kind** describing *which nodes'
data/objects it reaches*:

| Scope kind | Reaches | Typical use | Raw data? |
|---|---|---|---|
| `own-node` | only the actor's node | day-to-day analyst work | yes, within tenant + need-to-know |
| `descendant` | the subtree below the node | supervisory review | **only** where an explicit descendant-read grant + need-to-know exist (INV-1) |
| `aggregate` | counts/metrics/rollups over the subtree, **no raw records** | tier dashboards, national posture | **no** — de-identified aggregates only |
| `delegated` | a specific object/case shared by another node | joint investigation | yes, but *only* the delegated object, time-boxed |

`aggregate` is the default cross-tier visibility. It exists specifically so that a central tier
can see *posture* (how many incidents, severities, trends) **without** pulling subordinate raw
data — the concrete mechanism enforcing INV-1.

### 2.3 Escalation (up) — §5 detail

`descendant`/`delegated` raw access is the exception, reached by **escalation**: a lower node
*pushes* a case/alert upward (or accepts an upward pull request that it authorizes). Escalation
is an explicit, audited transfer or share, not an ambient ancestor privilege.

### 2.4 Tasking (down) — §5 detail

An ancestor may **task** a descendant (assign work, request an action, set a policy) without
reading the descendant's raw data. Tasking flows through the ADR-0006 delegation-chain +
(future) tool-execution path so that *authority to direct* is separate from *authority to read*.

### 2.5 Need-to-know

Even within a legitimate scope + tenant, access to a specific record requires a **need-to-know**
predicate (case assignment, marking clearance, purpose binding). Need-to-know is evaluated at
the object, layered on top of scope. Scope says "you *could* reach this subtree"; need-to-know
says "you may read *this* record, for *this* purpose, now." This mirrors the accepted
delegation-chain `purpose`/`scope` fields (ADR-0006 E3).

---

## 3. Jurisdiction, data residency, and marking

- **`jurisdiction`** — a node attribute naming the legal/geographic authority domain the node
  operates under. Drives residency and cross-domain rules. Portable: a code (e.g. ISO 3166
  region) plus a free policy profile, never hard-coded to Vietnam.
- **Data residency** — records carry a residency constraint derived from their originating
  node's jurisdiction. An exchange or escalation that would move data across a residency
  boundary MUST be gated (allow / redact / deny per policy), and the decision audited. The model
  reuses and *extends* the accepted `cybrik.data-marking` object (classification + TLP +
  handling caveats) with residency/jurisdiction handling tokens; see
  [05-contract-delta-proposal.md](05-contract-delta-proposal.md).
- **Marking on every crossing** — any object crossing a node/tier/domain boundary carries its
  `data-marking`, and the receiving side enforces it. TLP:AMBER+STRICT / TLP:RED and residency
  caveats can block a crossing outright. Marking is authoritative in the payload; the envelope
  scalar `marking` is only a routing copy (ADR-0006).

---

## 4. Cross-domain / A05 exchange (external upper boundary)

The A05 connection is the reference instance of a **cross-domain exchange edge** to an
`external` `org_node`. Properties (restating INV-2 concretely):

- **Not an ancestor.** The external node is not in the internal tier ladder; it cannot be a
  `parent_id` of an internal node; it never receives tenant-admin or global-read rights.
- **Exchange, not membership.** Interaction is modeled as typed, contract-bound **exchanges**
  (report submission, indicator sharing, tasking receipt, request-for-information), each:
  - authorized per-exchange (a delegation-chain grant with a bounded `purpose` and `audience`
    set to the external peer — confused-deputy defense, ADR-0006);
  - marked and residency-checked (§3) before it leaves;
  - minimized (share the least — often an aggregate or a specific delegated object, not a raw
    dump);
  - fully audited on both the decision and the payload digest.
- **Directionality is explicit.** "Report up to A05" (outbound submission) and "A05 tasks us"
  (inbound directive) are distinct exchange types with distinct authorization. Inbound tasking
  from an external authority does **not** auto-execute; it enters the normal
  policy/approval/tool path like any other request.
- **Disconnected/air-gapped tolerated.** The exchange edge may be intermittent or one-way
  (e.g. sneakernet to an air-gapped authority). The model treats the external peer as
  eventually-reachable, queues exchanges, and never blocks internal operation on external
  availability. UX states in [03](03-ux-information-architecture.md).

---

## 5. Escalation, tasking, delegation, break-glass

### 5.1 Case-specific delegation

Joint work between nodes (peer-to-peer or up/down) uses **case-specific delegation**: node A
shares case C with node B for purpose P until time T. Implemented conceptually as an ADR-0006
delegation-chain grant whose `scope.resource_patterns` names the specific case and whose
`purpose`/`expires_at` bound it. Sharing a case never shares the node; revoking the grant
(or its expiry) ends the access, and the audit trail shows exactly what was reachable when.

### 5.2 Escalation up / tasking down

- **Escalation (up):** a lower node transfers or shares an object upward; ownership/marking
  travel with it; the higher node's access is exactly what was escalated, nothing more.
- **Tasking (down):** a higher node directs a lower node. Tasking carries authority-to-direct,
  not authority-to-read. A task may *request* an escalation, which the lower node must
  affirmatively grant.

### 5.3 Break-glass

An emergency-access path for exceptional situations (imminent-harm, major-incident) where
normal need-to-know would delay a legitimate action. Requirements:

- **Pre-authorized, role-gated, and rare** — only specific roles, only declared break-glass
  scenarios.
- **Loud, not silent** — every break-glass use raises a high-severity audit event and a
  notification to the owning node and to oversight; it is designed to be *noticed*.
- **Time-boxed and self-revoking** — access expires quickly and is reviewed after the fact.
- **Never a backdoor for hierarchy** — break-glass does not turn an ancestor into a
  raw-data reader by default; it is a specific, logged exception, not a standing capability.

### 5.4 Revocation

Every grant (membership, scope grant, case delegation, exchange authorization, break-glass) is
**revocable** and **expiring**. Revocation is immediate and audited; downstream idempotent
replay after revocation/expiry MUST NOT re-authorize (consistent with delegation-chain
`expires_at` semantics, ADR-0006 E3). Revoking a node's membership does not delete its audit
history.

---

## 6. Edge types (summary)

| Edge | Direction | Confers | Confers raw read? |
|---|---|---|---|
| `parent` (tier) | up→down governance | tasking, aggregate roll-up, policy | **no** (INV-1) |
| `escalation` | down→up | transfer/share of a specific object | only the escalated object |
| `tasking` | up→down | authority to direct / request action | no |
| `case-delegation` | any peer | scoped, time-boxed object share | only the delegated object |
| `exchange` (external/A05) | in/out across trust boundary | contract-bound, marked, minimized exchange | only what is explicitly, per-exchange shared |

Every edge is: explicitly created, individually authorized, marking-/residency-checked where it
moves data, time-bounded, revocable, and audited.

---

## 7. Audit

A dedicated, append-only audit surface records, at minimum: node/membership lifecycle, every
scope/delegation/exchange/break-glass grant and revocation, every raw-data access under
`descendant`/`delegated`/break-glass, every cross-domain exchange (decision + payload digest),
and every residency/marking gate outcome. Audit is per-tenant and its records are themselves
marked. Aggregate roll-ups to a tier are computed from audit/telemetry **without** exposing the
underlying raw records (INV-1).

---

## 8. What this model deliberately does NOT do

- It does not make an ancestor a reader of descendant raw data by default (INV-1).
- It does not make A05 / any external authority a super-admin or org-tree root (INV-2).
- It does not hard-code Vietnamese tiers, agency names, or legal authorities — those are
  configuration/data, and the evidence doc marks what is confirmed/inferred/unknown.
- It does not introduce a second governance parent (no authority-ambiguous DAG).
- It does not implement anything: no schema, no table, no code. See
  [05-contract-delta-proposal.md](05-contract-delta-proposal.md) for the *proposed* contract
  work, which is **not applied**.

## 9. Open questions

Tracked in [04-threat-model-and-open-decisions.md](04-threat-model-and-open-decisions.md) §Open
decisions. Highlights: tenant↔org_node cardinality default; whether `aggregate` needs a
differential-privacy floor to prevent small-cell re-identification; how residency policy
profiles are expressed portably; whether external-exchange authorization needs a distinct
grant type or reuses delegation-chain with an `external` audience class.
