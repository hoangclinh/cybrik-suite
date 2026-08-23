# ADR-0015 deployment priority, data sovereignty and provider-neutral boundary — status-flip application

- **Prepared:** 2026-08-23
- **Applied:** 2026-08-23
- **Status:** `APPLIED 2026-08-23 — ADR-0015 STATUS FLIP RECORDED — ARCHITECTURE/GOVERNANCE AUTHORITY ONLY — NO IMPLEMENTATION AUTHORITY`
- **Applies to:** [ADR-0015 — Deployment priority, data sovereignty and provider-neutral platform boundary](ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md)
- **Resulting ADR status:** `ACCEPTED` (Founder, 2026-08-23) — decision record only; no
  implementation, dependency, substrate, provider, Platform Contract, provisioning, deployment,
  release or production authority follows
- **Applied under:** explicit Founder acceptance, 2026-08-23, of the exact independently reviewed
  R6 subject (below). Decider `FOUNDER`.
- **Release impact:** none. No release date, gate, runtime, tag or production state changes. No
  release claim is made or implied.

This is a docs-only application that records a status flip. It moved ADR-0015 from `PROPOSED —
NOT ACCEPTED` to `ACCEPTED` as a **decision record only**. It does **not** select a provider,
Kubernetes distribution, virtualization platform or any product; does **not** authorize any
Platform Contract implementation, product-code, contract, test, Helm, Terraform, controller-state,
infrastructure, deployment, migration, cutover, DNS/cloud mutation, secret rotation, RC1 mutation,
public release or production action; and does **not** close any of ADR-0015's open questions.

## 1. Founder decision — binding record

| Field | Value |
|---|---|
| `ADR_ID` | `ADR-0015` |
| `FOUNDER_DECISION` | `ACCEPT` |
| `DECIDER` | `FOUNDER` |
| `DECISION_DATE` | 2026-08-23 |
| `REVIEWED_R6_COMMIT` | `6580a4fcdf8d24e203b6e6f98a15dae3c2fea789` |
| `REVIEWED_R6_TREE` | `c49f77f2f12eb34fc498f17043b2a223b8bfcef6` |
| `ACCEPTED_SUBJECT` | the exact ADR bytes at that commit/tree (`docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md`, blob `4c18ea8914b239989bc96496f7b376e342e26ccd`) |
| `INDEPENDENT_REVIEW_VERDICT` | `PASS` (`FINAL_ADR_REVIEW_VERDICT = PASS`, `ADR_REVIEW_FINDINGS = NONE`) |
| `FOUNDER_ACCEPTANCE_SAFE` | `YES` |
| `ACCEPTANCE_SCOPE` | `ARCHITECTURE_GOVERNANCE_ONLY` |
| `ADR_STATUS_BEFORE` | `PROPOSED — NOT ACCEPTED` |
| `ADR_STATUS_AFTER` | `ACCEPTED` (Founder, 2026-08-23) — decision record only |
| `PRODUCTION_DEPLOYMENT_AUTHORITY` | `CLOSED` |
| `PRODUCTION_DEPLOYED` | `NO` |
| `READY_FOR_PRODUCTION_ROLLOUT_DECISION` | `NO` |
| `KUBERNETES_DISTRIBUTION_SELECTION` | `OPEN` (`KUBERNETES_PRIMARY_SUBSTRATE = UNDECIDED`) |
| `VIRTUALIZATION_SUBSTRATE_SELECTION` | `OPEN` (`VIRTUALIZATION_SUBSTRATE = UNDECIDED`) |
| `IMPLEMENTATION_AUTHORITY_GRANTED` | `NO` |

Recorded from the Founder's explicit acceptance directive of 2026-08-23, transcribed by an AI agent
acting solely as recording agent. No Founder signature, cryptographic signature, external receipt
or timestamp beyond the acceptance date is synthesized or implied; the Git commit containing this
file is its durable identity.

## 2. Evidence sources

| Source | Exact reference |
|---|---|
| ADR under application | `docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md` at R6 commit `6580a4fcdf8d24e203b6e6f98a15dae3c2fea789`, tree `c49f77f2f12eb34fc498f17043b2a223b8bfcef6` |
| Review lineage (preserved, not squashed) | BASE `d2b5c7fe799beb94b1dcf0661350de10417da0a3` → R1 `94d0c59ecde03f44f9b4dbb5235ade542d15ab0b` → R2 `54b5ec516781808429c5f14130284047361d8acf` → R3 `e800a283fd6f001a579987630839435206b73160` → R4 `915f3b317bce9f131920d45f195b2d52beaf90cf` → R5 `cc041784d4cff72617d57072ecb27f4d71c71d0d` → R6 `6580a4fcdf8d24e203b6e6f98a15dae3c2fea789` |
| Independent review of R6 | `FINAL_ADR_REVIEW_VERDICT = PASS`, `FOUNDER_ACCEPTANCE_SAFE = YES`, `ADR_REVIEW_FINDINGS = NONE`; earlier rounds R1–R5 each returned `CHANGES_REQUIRED` and were corrected in the next revision (ADR-0015 §19) |
| Founder deployment-priority policy (**separate authority, not created here**) | `docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` at R3 commit `e800a283fd6f001a579987630839435206b73160` (ADR-0015 source `S9`), `DECIDED — RECORDED` (Founder, 2026-08-23) |
| Authoritative catalog | `docs/adr/README.md` — lifecycle `PROPOSED` → `ACCEPTED` / `REJECTED` → (`SUPERSEDED`); "This catalog is authoritative on ADR status" |
| Prior status-flip precedent (convention followed) | `docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md`, `docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md` (`APPLIED 2026-07-26`) |

Evidence is documentary only. Exact-bytes safety was verified before the flip: the worktree HEAD,
tree and ADR blob matched the reviewed R6 identity above, and the worktree was clean.

## 3. Governing precedence

1. The Founder acceptance directive of 2026-08-23 governs this application. It accepts the exact
   reviewed R6 bytes and nothing else; any later revision of ADR-0015 would require its own review
   and its own acceptance.
2. The Founder deployment-priority **policy** (ADR-0015 Decision A.1, §1.3, §6.1) is governed by
   `FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md`, in force by that packet since
   2026-08-23 independently of this acceptance. This application does not create, re-decide, extend
   or backdate that policy (ADR-0015 Acceptance Criterion 1A). Where the packet and the ADR's
   restatement of it differ, the packet governs.
3. The ADR-authored architectural invariants (ADR-0015 Decision A.2 and Decisions B–J, `INV-1` …
   `INV-22`) were classified `NOT YET ACCEPTED` / inert while ADR-0015 was `PROPOSED`. By this
   acceptance they become accepted architecture authority under the catalog lifecycle (ADR-0015
   Acceptance Criterion 1B and 2). They remain decision records: not implementation authority.
4. Where proposal-time wording in the accepted R6 body ("while this ADR is `PROPOSED`", "not yet
   accepted", "inert until accepted", "on acceptance") meets this record, the wording is dated
   provenance of the proposal and is read as satisfied; the operative status is the ADR header and
   the catalog. No body text was rewritten to say so, by design (§5).

## 4. What the applied status flip did and did not do

The flip moved ADR-0015 out of `PROPOSED — NOT ACCEPTED` to `ACCEPTED` (Founder, 2026-08-23). It:

- **did** make ADR-0015's ten decisions (A–J) and twenty-two invariants (`INV-1` … `INV-22`)
  accepted suite architecture/governance authority, at the strength each states for itself;
- **did** give the Founder deployment-priority policy its accepted suite-wide architecture home,
  closing the condition ADR-0015 §2 recorded as
  `ACCEPTED_SUITE_WIDE_ARCHITECTURE_HOME = OPEN (pending explicit Founder acceptance of ADR-0015)`;
- **did not** create, re-decide or backdate the Founder deployment-priority policy, which remains
  rooted in the Founder decision packet at `e800a283…`;
- **did not** close any open question. `OPEN-1` … `OPEN-11` remain `OPEN` exactly as written in
  ADR-0015 §14 — `OFFLINE_INSTALL_UPDATE_CONTRACT`, `S3_COMPATIBILITY_MINIMUM_CONTRACT`,
  `AI_DNS_TOCTOU_EGRESS_GUARD`, `CANONICAL_T0_T1_T2_SEMANTICS`,
  `OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION`, `VIRTUALIZATION_SUBSTRATE_SELECTION`,
  `KUBERNETES_DISTRIBUTION_SELECTION`, `PROVIDER_SELECTION_AUTHORITY_MODEL`, the legal
  interpretation of deployment location (`LEGAL_REVIEW_REQUIRED`), Platform Contract slot semantics,
  and `PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY` (per-module classification);
- **did not** select, rank or eliminate any cloud, hosting, Kubernetes, virtualization, storage,
  database, orchestrator, hypervisor or model-serving product; every candidate remains
  `NOT_SELECTED` and both substrate questions remain `UNDECIDED`;
- **did not** authorize production deployment, production rollout, traffic cutover, DNS mutation,
  cloud mutation, customer migration, production database migration, secret rotation, a public
  GitHub Release, RC1 mutation, AWS cleanup execution, Platform Contract implementation, AI DNS
  TOCTOU (`OPEN-3`) remediation, product-code modification or infrastructure implementation;
- **did not** change `PRODUCTION_DEPLOYMENT_AUTHORITY = CLOSED`, `PRODUCTION_DEPLOYED = NO` or
  `READY_FOR_PRODUCTION_ROLLOUT_DECISION = NO`;
- **did not** alter the status of any other ADR, contract, tag, evidence document or product file;
- **did not** modify any decision, invariant, open-question, source-table or evidence text of
  ADR-0015 — only its header status metadata and an "Acceptance recorded" block were added.

## 5. File scope of this application

Exactly three governance files, all under `docs/adr/`:

| File | Change |
|---|---|
| `ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md` | Header `Status` / `Date decided` metadata flipped; one "Acceptance recorded — 2026-08-23" block added after the header. Body from §0 onward is the reviewed R6 text, byte-for-byte |
| `README.md` | Authoritative catalog transition for ADR-0015 (`PROPOSED` → `ACCEPTED`) and one additive row for this application; no other ADR status altered |
| `ADR-0015-STATUS-FLIP-APPLICATION.md` | This record (new) |

No product code, contract, test, Helm, Terraform, controller-state, infrastructure or release file
was touched. The application is one bounded commit on top of R6; R1–R6 history is retained, not
amended, squashed or merged.

## 6. Residual gates

1. **Implementation of any ADR-0015 invariant** — requires its own separately authorized, bounded
   packet per product repository, with exact repo, base SHA, path allowlist, RED/acceptance command
   and named reviewer. Not opened here.
2. **Platform Contract definition and the first `VERSIONED_DEPLOYMENT_PROFILE`** (`OPEN-10`,
   `OPEN-5`, `OPEN-2`) — separate bounded work; not authorized here.
3. **Canonical `T0`/`T1`/`T2` tier contract naming the axes** (`OPEN-4`) — separate bounded work.
4. **Offline install/update contract** (`OPEN-1`) — separate bounded work.
5. **AI DNS TOCTOU egress-guard hardening** (`OPEN-3`) — separate bounded hardening decision.
6. **Kubernetes-distribution and virtualization-substrate selection** (`OPEN-7`, `OPEN-6`) —
   separate technology-selection decisions; `UNDECIDED`.
7. **Provider-selection delegation model** (`OPEN-8`) and any future provider adapter — separate
   decisions under ADR-0015 §9; `PRODUCTION_DEPLOYMENT_AUTHORITY` remains `CLOSED`.
8. **Legal interpretation** (`OPEN-9`) — `LEGAL_REVIEW_REQUIRED`, recorded separately from
   architecture per `INV-18`.
9. **Per-module `PRODUCT_CORE` vs `PRODUCT_IMPLEMENTATION_ADAPTER` classification** (`OPEN-11`) —
   per-repository bounded pass.
10. **Merge and push of the acceptance commit** — not performed by this application; separate
    action under the repository's normal integration authority.
