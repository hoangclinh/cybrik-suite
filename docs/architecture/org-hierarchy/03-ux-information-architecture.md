# Org-Hierarchy UX Information Architecture — CYBRIK Suite

- Status: `PROPOSED — NOT ACCEPTED`
- Packet: [Organizational hierarchy & external-authority boundary](README.md)
- Date: 2026-07-24
- Gate: W2-C0 (research/architecture only)
- Scope: information architecture and interaction *model* only. **No mockups, no visual design,
  no component implementation.** UI ownership is `cybrik-soc-command-center` (SOC surfaces) and
  the respective product repos; this repo only proposes the cross-product IA the domain model
  ([02-domain-model.md](02-domain-model.md)) implies.

> **Status honesty.** Nothing here is built. This is a specification of *what the interface must
> express and constrain*, so that any future UI wave can be judged against it (see the
> [UAT gate standard](../../uat/UAT-GATE-STANDARD.md)).

---

## 1. IA principles

1. **The UI never shows more than the scope allows.** Screen content is a function of the
   viewer's node, membership role, scope kind, marking clearance, and need-to-know — computed
   server-side, never trusted from the client. "Hierarchy visibility" in the UI defaults to
   **aggregate** across descendants; raw records appear only where an explicit grant exists
   (mirrors domain-model INV-1).
2. **Marking and provenance are always visible.** Every record, list row, dashboard tile, and
   exchange shows its data marking (classification/TLP/residency) and where it came from. No
   unlabelled data crosses a boundary in the UI.
3. **Authority actions are distinct from read actions.** "Task a subordinate" and "escalate to
   parent" and "exchange with A05" are first-class, separately-permissioned actions — never a
   side effect of viewing.
4. **Everything is configurable per deployment and per locale.** Tier names, node labels, role
   names, and authority labels are data; the shell resolves them. Vietnamese and English are
   first-class at launch.
5. **Degraded/disconnected is a normal state, not an error.** Air-gapped and intermittently
   connected deployments are designed for, not bolted on.

---

## 2. Information architecture surfaces

### 2.1 Configurable labels & localization

- All org/tier/role/authority names render from a **label catalog** keyed by locale. The domain
  model stores keys; the UI resolves VI/EN (extensible to more locales).
- No English-only or Vietnamese-only strings baked into components. Numbers, dates, and
  severity terms localize. RTL not required for VI/EN but the layout must not assume LTR-only
  widths (VI strings run longer than EN — design for expansion).
- A deployment with US or MSSP tier ladders reuses the same catalog mechanism; nothing is
  Vietnam-specific in the shell.

### 2.2 Hierarchy switcher (scope selector)

- A persistent control showing **the node the user is currently acting as / viewing**, with the
  configured tier label. Switching is bounded to nodes the membership authorizes.
- Switching node **re-scopes the entire surface** (dashboards, lists, search) and is itself an
  audited action. The current node + scope kind is always visible so a user never misreads
  whose data they are seeing.
- For multi-tier coordinators, the switcher distinguishes **"my node"** from **"subtree
  (aggregate)"** from **"a specific descendant (delegated/escalated)"** — the three visibility
  modes of the domain model §2.2, made explicit in the chrome.

### 2.3 Roll-up dashboards (aggregate-first)

- Tier/coordinator dashboards default to **aggregate** metrics over the subtree: counts,
  severities, SLA/trend posture — **no raw records** (enforces INV-1 at the presentation layer).
- Drilling from an aggregate into a raw record is a **guarded transition**: it requires (and
  visibly indicates) an explicit descendant/delegated grant + need-to-know. If the viewer lacks
  it, the drill-down surfaces a *request-access / request-escalation* path, not the data.
- Small-cell protection: aggregates that would re-identify a small population must be suppressed
  or banded (open decision — differential-privacy floor, tracked in
  [04](04-threat-model-and-open-decisions.md)).

### 2.4 Scoped search

- Search is **scope-bounded by construction**: results only include what the current node +
  scope + marking + need-to-know permit. There is no "search everything" affordance that
  bypasses scope.
- Cross-tier search returns **aggregate hits** ("N matching cases in 3 subordinate nodes") not
  raw records unless a grant exists; each restricted hit offers a request path, never a leak of
  content or metadata beyond what marking allows.

### 2.5 Data provenance & marking display

- Every object view shows: origin node, jurisdiction/residency, classification + TLP +
  handling caveats, and (for shared/escalated/exchanged objects) the **chain of custody** — who
  shared it, under what grant/purpose, until when.
- Boundary crossings (escalation, exchange to A05) render the marking prominently and warn
  before an action that would move data across a residency or trust boundary.

### 2.6 Escalation & tasking UI

- **Escalate (up):** from a case/alert, an explicit action that shares/transfers the object to a
  parent node, choosing marking and scope; shows exactly what the recipient will be able to see.
- **Task (down):** from a node, assign work / request an action / set policy on a descendant —
  **without** opening the descendant's raw data. The UI must make clear that tasking does not
  grant read access.
- **Case-specific delegation:** share one case with a peer/parent for a bounded purpose and
  time; the UI shows the grant, its expiry, and a one-click revoke.
- All three show their audit trail inline.

### 2.7 Cross-domain / A05 exchange surface

- A distinct **exchange** surface (not the internal hierarchy switcher) for the external
  authority peer. Clearly labelled as an **external trust boundary** (domain-model INV-2): the
  UI must never present A05 as an internal tier or as an admin over the deployment.
- Outbound submission and inbound tasking are visibly different flows, each showing marking,
  minimization (what is being shared vs withheld), residency gate outcome, per-exchange
  authorization, and full audit.
- Inbound external tasking lands in a review queue and enters the normal approval/tool path — it
  never auto-executes.

### 2.8 Disconnected / air-gapped states

- A first-class connectivity indicator per external/exchange edge: `connected` /
  `intermittent` / `air-gapped` / `queued (n pending)`.
- Internal operation never blocks on external availability. Outbound exchanges queue and show
  pending/aged state; inbound arrives via whatever transport (including manual import), with
  provenance intact.
- The UI distinguishes "no data because disconnected" from "no data because empty" from "no data
  because not permitted" — three different empty states with three different next actions (see
  the [UAT gate](../../uat/UAT-GATE-STANDARD.md) empty/error/loading requirements).

---

## 3. Cross-cutting UI states (every surface, every wave)

For each surface above, the following states must exist and be verifiable at UAT:

- **Loading**, **empty** (distinguishing the three "no data" causes in §2.8), **error**
  (recoverable + fatal), **partial** (some subtree nodes unreachable).
- **Permission-denied vs not-found** must be indistinguishable where leaking existence would
  itself be a disclosure (scope-boundary hygiene).
- **Localized** in VI and EN, including error and empty copy.
- **Accessible** (see UAT gate: keyboard, contrast, screen-reader labels, focus order) and
  **responsive** (analyst desktop, ops wall/large display, and constrained/field devices).

---

## 4. Explicit non-goals

- No mockups, wireframes, design tokens, or component code in this packet.
- No claim that any of this is implemented — SOC/product UI ownership and delivery are separate,
  gated work.
- No bypass affordance (no "god view", no "search all tenants", no A05 super-admin console) —
  such an affordance would violate domain-model INV-1/INV-2 and must fail UAT RBAC/isolation
  testing by design.
