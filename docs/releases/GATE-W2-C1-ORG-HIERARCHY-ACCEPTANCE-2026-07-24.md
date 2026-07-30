# Gate W2-C1 — Org-hierarchy & external-authority architecture acceptance (2026-07-24)

- Status: `DECISION RECORD` — **Gate W2-C1 outcome: architecture & process ACCEPTED**. This gate
  accepts (a) [`ADR-0007`](../adr/ADR-0007-org-hierarchy-and-external-authority-boundary.md) as a
  suite architectural **model** plus the six open-decision **constraints** OD-1..OD-6, and (b) the
  [UAT Gate Standard](../uat/UAT-GATE-STANDARD.md) as a mandatory suite **process** standard. It
  accepts **no contract, no schema, no product code, and no UI**.
- Date: 2026-07-24
- Branch / reviewed tree: `codex/w2c-org-hierarchy-a05`, baseline `df86042`
  (`docs(w2c): org-hierarchy & external-authority packet + PROPOSED ADR-0007`), CI green.
- Authority: Founder-delegated Gate W2-C1 decision to Codex. Delegation covers recording these
  decisions and accepting the architecture/model and the UAT process standard **only**. It does
  **not** authorize any contract/schema change, any product implementation, any UI wave, closing
  a release blocker, or merging to `main`.

## 1. Decision

**ACCEPTED — architecture & process only.**

- **ADR-0007** moves `PROPOSED — NOT DECIDED` → `ACCEPTED`. The architectural model (configurable
  3–4-tier org model; `tenant`↔`org_node` separation; A05 as an external trust boundary not a
  tier; hierarchy ≠ raw-data access INV-1; external authority never super-admin INV-2; portability)
  is accepted as suite policy, and the six carried open decisions are resolved as constraints (§2).
- **UAT Gate Standard** moves `PROPOSED — NOT ACCEPTED` → `ACCEPTED` as a mandatory suite process
  standard: every UI/behavior wave requires the persona matrix and a Codex pass/fail
  recommendation to the Founder. **No UAT is claimed executed** and **no UI is certified** by this
  acceptance.

## 2. Open decisions resolved (OD-1..OD-6)

Recorded normatively in
[`ADR-0007` §Gate W2-C1 decision log](../adr/ADR-0007-org-hierarchy-and-external-authority-boundary.md#gate-w2-c1-decision-log--open-decisions-resolved-2026-07-24)
and in
[packet 04 §6](../architecture/org-hierarchy/04-threat-model-and-open-decisions.md#6-open-decisions--resolved-at-gate-w2-c1-2026-07-24):

| OD | Decision |
|---|---|
| OD-1 | One tenant may contain many `org_node`s; each `org_node` in exactly one tenant; no cross-tenant hierarchy edges; A05/external peer is not an `org_node`/tenant member. *(Selects one-tenant-many-nodes as default.)* |
| OD-2 | Cross-tier `aggregate` default = configurable small-cell suppression **k = 5** + time/category coarsening; no differential privacy until evaluated; raw/unsuppressed detail needs a separate scoped grant. |
| OD-3 | External-exchange identity/auth context is **distinct** from internal user/service JWT/SSO; no credential reuse. |
| OD-4 | Residency/jurisdiction as **policy-as-data** (allowed processing/exchange zones + data marking), deny-by-default; legal compulsion via an explicit governed, audited workflow — never a hidden bypass. |
| OD-5 | External-peer minimum **mTLS + signed envelope + audience/nonce/timestamp/replay protection + rotation/revocation**; hardware-backed keys preferred/required where supported. |
| OD-6 | Break-glass only from an explicit scenario catalog; default read-only / 15 min; ≤ 60 min needs a second human approval; loud audit + notification, auto-revoke, mandatory after-action review; write/action stays risk-class approval gated. |

## 3. Explicitly NOT accepted / NOT changed by this gate

- **No contract or schema.** The [contract delta (packet 05)](../architecture/org-hierarchy/05-contract-delta-proposal.md)
  remains `PROPOSED — NOT APPLIED`. Nothing under `contracts/` is edited; no version is bumped;
  no `x-cybrik-status` is flipped. Each delta (D-1..D-8) is a separate Founder gate with its own
  ADR-0001 SemVer treatment and validator run.
- **No product code and no UI.** No concern is implemented in `cybrik-soc-command-center`,
  `cybrik-security-tool-fabric`, or `cybrik-cyber-ai-platform`. No UI wave is submitted, executed,
  or certified.
- **Legal/evidence `[UNKNOWN]`s stay open.** Primary-gazette confirmation of the load-bearing
  Vietnamese legal/authority claims, the concrete legal basis of any specific external peer, and
  evidentiary/chain-of-custody legal requirements remain `[UNKNOWN]`
  ([packet 01](../architecture/org-hierarchy/01-vietnam-coordination-evidence.md)). They constrain
  jurisdiction-specific operational reliance, not this generic architecture.
- **No release blocker closed and no `main` merge.** RB-001 stays OPEN; work stays on
  `codex/w2c-org-hierarchy-a05`.

## 4. Checks recorded at the decision head

- Contract standards validators (`tools/contract-validation`, `npm run validate`): **ALL GREEN**
  (JSON Schema 2020-12, OpenAPI 3.1.x at fail-severity=error, AsyncAPI 3.0.0). No contract file
  was touched by this gate, so this is a no-regression confirmation.
- Secret scan (gitleaks 8.30.1, `.gitleaks.toml`): **0 findings** on working tree and full history.
- Internal doc cross-links / anchors updated for the changed §6 heading and the new ADR decision
  log; repo-qualified references only across product boundaries.

## 5. Remaining implementation gates (not opened here)

1. Contract-delta gate(s) for D-1..D-8 (per packet 05) — each additive/versioned per ADR-0001,
   validator-gated, Founder-accepted before any product builds against it.
2. Per-product implementation gates in the owning repos once a delta is accepted (ownership per
   `cybrik-suite:CLAUDE.md`).
3. UI-wave gates: each hierarchy/A05 UI wave must clear the now-accepted UAT Gate Standard
   (persona matrix + evidence + Codex pass/fail → Founder ratification).
4. Legal/evidence confirmation gate for the `[UNKNOWN]` claims before any operational reliance in
   a specific jurisdiction.
