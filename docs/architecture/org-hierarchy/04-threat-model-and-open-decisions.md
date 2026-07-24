# Org-Hierarchy Threat Model & Open Decisions — CYBRIK Suite

- Status: `PROPOSED — NOT ACCEPTED`
- Packet: [Organizational hierarchy & external-authority boundary](README.md)
- Date: 2026-07-24
- Gate: W2-C0 (research/architecture only; Founder-delegated Codex decision 2026-07-24)
- Depends on: [02-domain-model.md](02-domain-model.md) (INV-1/INV-2, entities, edges),
  [01-vietnam-coordination-evidence.md](01-vietnam-coordination-evidence.md) (A05 as sovereign
  external authority), `ADR-0006` (cross-tenant reject, delegation chain, marking).

> **Status honesty.** This is a *threat model for a proposed model*. No control here is
> implemented or verified. "MUST/MUST NOT" states a **design requirement** on any future
> implementation, not an existing property. Nothing certifies a mitigation as effective.

---

## 1. Scope, method, assets

This threat-models the two new trust relationships the domain model introduces on top of the
accepted per-tenant isolation boundary: (a) an **internal governance hierarchy** across
`org_node`s, and (b) an **external authority exchange edge** (the A05 reference case). Method is
STRIDE-per-interaction plus explicit abuse cases; each abuse case names the invariant it attacks,
the mitigation, and the residual risk.

**Assets to protect (ranked):**

1. **Descendant raw case/alert/asset data** — must not leak upward by virtue of hierarchy (INV-1).
2. **Tenant isolation** — the fail-closed boundary `org_node` must never weaken (ADR-0006).
3. **Authority-bound / evidentiary outbound data** — anything crossing to an A05-class endpoint;
   integrity + chain-of-custody + minimization (01 §5).
4. **Grant integrity** — membership, scope, delegation, exchange, and break-glass grants; their
   issuance, expiry, and revocation.
5. **Audit trail** — the append-only record that makes every crossing accountable.

**Trust boundaries (attacker sits on the far side of each):**

- **TB-T** tenant isolation boundary (existing, ADR-0006).
- **TB-H** intra-deployment hierarchy edge (parent↔child, peer↔peer) — **new**.
- **TB-X** external authority exchange edge (deployment ↔ A05 / national authority) — **new**;
  crosses an organizational *and* legal/jurisdictional edge (01 §1).
- **TB-M** model/agent output boundary — model output is untrusted input and may never populate
  identity/authority fields (ADR-0006 `actor`; ADR-0004 risk classes).

---

## 2. Fail-closed access rules (normative for any future implementation)

These are the decision rules an authorization engine MUST apply. All are **deny-by-default**.

- **FC-1 — Default deny.** Absent an explicit, unexpired, in-scope grant, every read/action is
  denied. Empty scope arrays mean "nothing", never "everything" (mirrors delegation-chain
  `scope`).
- **FC-2 — Tenant first.** Authoritative tenant derives from the caller credential, never from a
  payload value; any cross-tenant mismatch is rejected before hierarchy is even evaluated
  (ADR-0006). Hierarchy can only *narrow*, never widen, the tenant decision.
- **FC-3 — Hierarchy ≠ read (INV-1).** Ancestry grants governance (task, aggregate roll-up,
  policy) only. Raw descendant records require a *separate* `descendant`/`delegated` grant **and**
  an object-level need-to-know predicate. Ancestor status alone → deny.
- **FC-4 — Aggregate is de-identified.** Cross-tier visibility defaults to `aggregate`
  (counts/metrics, no raw records). An aggregate that could re-identify a small cell MUST be
  suppressed/banded before release (see OD-2).
- **FC-5 — External is exchange-only (INV-2).** An `external` node (A05) can never be a
  `parent_id`, never holds tenant-admin/global-read, and never auto-executes an inbound directive.
  Every exchange is a per-exchange authorized, marked, residency-checked, minimized, audited act.
- **FC-6 — Marking/residency gate on every crossing.** Any object crossing TB-H or TB-X is
  evaluated against its `data-marking` + residency; the receiver enforces it; TLP:AMBER+STRICT /
  TLP:RED / residency caveats can deny outright. Unmarked data does not cross.
- **FC-7 — Grants expire and revoke immediately.** Every grant is time-boxed; revocation and
  expiry take effect at once; idempotent replay after expiry/revocation MUST NOT re-authorize
  (delegation-chain `expires_at` semantics).
- **FC-8 — Confused-deputy defense on exchange.** An exchange grant binds `audience` to the
  specific external peer and a bounded `purpose`; a grant presented to any other audience/purpose
  is rejected (delegation-chain `audience`).
- **FC-9 — Availability never widens authority.** External unreachability queues the exchange; it
  never fails *open* into a broader grant, and internal operation never blocks on the external
  edge (01 §5; 02 §4).
- **FC-10 — Fail-closed on ambiguity.** Unknown tier config, missing jurisdiction, or an
  unresolvable node → deny and audit, never a permissive fallback.

---

## 3. STRIDE per new boundary (summary)

| Threat | TB-H (hierarchy) | TB-X (external / A05) |
|---|---|---|
| **Spoofing** | Forged membership/role or asserted node identity | Impersonated authority peer; forged inbound "A05 tasking" |
| **Tampering** | Altered tier/parent edges; grant splicing | Tampered outbound payload; altered marking to dodge a residency gate |
| **Repudiation** | Ancestor denies reading descendant data | Deployment or authority denies what was exchanged |
| **Information disclosure** | Roll-up leaks raw/small-cell data; sibling/parent over-exposure | Over-broad share to authority; minimization failure; evidentiary leak |
| **Denial of service** | Escalation/tasking flooding a node | External edge outage stalls internal ops (must not) |
| **Elevation of privilege** | Ancestor → descendant raw reader; role self-escalation; break-glass abuse | External peer → super-admin / org root (INV-2) |

Cross-cutting: **TB-M** — model/agent output attempting to populate `actor`, membership, scope,
or an exchange authorization. Mitigation: those fields are written only by authenticated service
code; model output is data, never authority (ADR-0006).

---

## 4. Abuse cases → mitigations (residual risk noted)

**AC-1 — "Ancestor read-through."** A top-tier coordinator tries to read a commune analyst's raw
case via roll-up drill-down. *Attacks INV-1.* **Mitigation:** FC-3/FC-4 — drill-down requires an
explicit descendant/delegated grant + need-to-know; otherwise the UI surfaces a request path, not
data (03 §2.3). **Residual:** a *granted* descendant read is legitimate but broad — bound it by
purpose/expiry and audit every access (02 §7).

**AC-2 — Small-cell re-identification.** An aggregate ("1 critical incident in commune X")
uniquely identifies a case. *Attacks INV-1 via FC-4.* **Mitigation:** suppression/banding of
small cells. **Residual / OPEN (OD-2):** whether a differential-privacy floor is required.

**AC-3 — External authority escalation to super-admin.** A05 liaison credential is treated as an
internal admin or org root. *Attacks INV-2.* **Mitigation:** FC-5 — `external` boundary_kind can
never be an ancestor or admin; exchange-only surface (03 §2.7); must fail UAT RBAC negative test
(UAT gate P4). **Residual:** misconfiguration risk → covered by UAT negative-isolation evidence.

**AC-4 — Auto-executing inbound directive.** A (possibly spoofed) "A05 tasks us: run X" executes
without approval. *Attacks INV-2 + TB-X spoofing.* **Mitigation:** FC-5 — inbound tasking enters a
review queue and the normal policy/approval/tool path; peer authentication + `audience`/`purpose`
binding (FC-8). **Residual:** depends on strength of peer authentication — OPEN (OD-5).

**AC-5 — Over-share / minimization failure to authority.** A raw dump is sent when an aggregate or
one delegated object would suffice. *Attacks asset #3.* **Mitigation:** FC-6 + minimization default
(02 §4), marking/residency gate, human-visible "what is shared vs withheld" (03 §2.7).
**Residual:** legal compulsion may demand more than minimization prefers — that is a *governed
workflow with audit*, not a standing grant (INV-2); the tension is real and jurisdiction-specific
(OD-4).

**AC-6 — Cross-tenant leak via a shared org tree.** A node spanning tenants is used to bridge
isolation. *Attacks TB-T.* **Mitigation:** FC-2 — `org_node` never weakens tenant; every
cross-node data move re-checks tenant (02 §1.1). **Residual:** shared-platform deployments
concentrate risk → default cardinality is an OPEN decision (OD-1).

**AC-7 — Grant splicing / replay.** An expired or reordered delegation is replayed to regain
access. *Attacks asset #4.* **Mitigation:** FC-7 + digest-bound chain (parent_digest linkage);
replay-after-expiry MUST NOT re-authorize (delegation-chain). **Residual:** clock-skew handling is
an implementation concern for the future gate.

**AC-8 — Break-glass as a backdoor.** A role uses emergency access to routinely read descendant
data. *Attacks INV-1.* **Mitigation:** break-glass is pre-authorized, role-gated, loud
(high-severity audit + owner/oversight notification), time-boxed, self-revoking, and never a
standing capability (02 §5.3). **Residual:** insider with a legitimate break-glass role — detection
(loud audit + after-action review), not prevention.

**AC-9 — Marking downgrade to dodge a gate.** An actor relabels TLP:RED as TLP:GREEN to pass FC-6.
*Attacks asset #3.* **Mitigation:** marking is authoritative in the payload and carried with
provenance; downgrades are themselves audited privileged actions; origin_marking preserved
(data-marking `origin_marking`). **Residual:** requires that relabeling be a governed, logged
action — a forward requirement.

**AC-10 — Existence disclosure via denied drill-down.** "Permission denied" on a specific node
reveals that a sensitive case exists. *Attacks INV-1 indirectly.* **Mitigation:** denied ≈
not-found where existence is itself sensitive (03 §3; UAT 3.2). **Residual:** usability tension,
accepted by design.

**AC-11 — Reorg-churn stale authority.** A 2025-style tier reorg (01 §0/§3) leaves stale
`parent_id`/membership granting access post-restructure. *Attacks FC-1.* **Mitigation:** grants
expire (FC-7); nodes reference stable internal IDs with editable metadata, not hard-coded
codes/names (01 §5). **Residual:** migration correctness is a future-implementation concern.

---

## 5. Residual-risk posture

The model reduces the *systemic* risks (hierarchy→read, external→super-admin, cross-tenant leak)
to configuration/insider/authentication-strength risks that are **detectable via audit** and
**testable via the UAT negative-isolation gate**. It does not claim to eliminate insider misuse or
legal-compulsion tension; it makes them **loud, bounded, and accountable** rather than silent.

---

## 6. Open decisions (carried to a future Founder-gated ADR)

- **OD-1 — tenant↔org_node cardinality default.** One-tenant-per-node (strict) vs
  one-tenant-many-nodes (shared) vs hybrid. Trades isolation strength against operability
  (AC-6). *Recommendation: default strict; shared is an explicit, audited opt-in.*
- **OD-2 — small-cell / differential-privacy floor.** Whether `aggregate` needs a formal DP floor
  vs suppression/banding (AC-2).
- **OD-3 — external-exchange authorization type.** Reuse delegation-chain with an `external`
  audience class, or a distinct exchange-grant type (02 §9).
- **OD-4 — residency policy expression.** How jurisdiction/residency profiles are expressed
  portably and how legal-compulsion overrides are governed and audited (AC-5).
- **OD-5 — external-peer authentication strength.** How an inbound A05 directive is authenticated
  before it even reaches the review queue (AC-4). `[UNKNOWN]` in the evidence base; must not be
  assumed.
- **OD-6 — break-glass scenario catalog.** Which scenarios/roles qualify, and the after-action
  review process (AC-8).

None of these is decided here. All require Founder gating before any implementation.
