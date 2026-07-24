# UAT Gate Standard — CYBRIK Suite UI Waves

- Status: `PROPOSED — NOT ACCEPTED`
- Date: 2026-07-24
- Gate: W2-C0 (research/architecture only; Founder-delegated Codex decision 2026-07-24)
- Applies to: **every UI wave** across all suite products that surface organizational
  hierarchy, tenancy, or external-authority (A05) exchange. Referenced by the org-hierarchy
  packet ([architecture index](../architecture/org-hierarchy/README.md)).
- Decision authority: **Codex decides pass/fail and reports the recommendation to the Founder.**
  A wave is not "done" until it passes this gate; Codex records evidence and the pass/fail call,
  the Founder ratifies.

> **Status honesty.** This is a *standard proposal*. It gates future UI work; it does not certify
> any existing UI. No UI is `IMPLEMENTED`, `VERIFIED`, or `PILOTED` by this document.

---

## 1. Purpose

Define the **minimum, repeatable acceptance bar** every user-facing wave must clear before it is
considered acceptable. The gate exists to make INV-1 (hierarchy ≠ raw-data access) and INV-2
(external authority ≠ super-admin) *verifiable properties of the shipped UI*, not just design
intentions — plus the usual functional/quality/accessibility bar.

The gate is **evidence-based**: claims of passing require captured screenshots/video and, for
isolation properties, negative-test evidence (the thing that must NOT be visible is shown to be
not visible).

---

## 2. Persona matrix (mandatory coverage)

Every UI wave MUST be exercised from the perspective of **each** persona below. A wave that
touches only some surfaces still reports each persona's result for the surfaces in scope (with
"N/A — not in this wave" where genuinely out of scope).

| # | Persona | Represents | Primary concern the gate checks |
|---|---|---|---|
| P1 | **Central / top-tier coordinator** | highest internal tier | aggregate roll-up works; can task down; **cannot** read descendant raw data by default (INV-1) |
| P2 | **Mid-tier coordinator** (e.g. provincial/regional) | middle tier | sees own node + subtree aggregate; escalation up and tasking down both work and are audited |
| P3 | **Local / lowest-tier operator** | bottom tier (e.g. commune/local) | own-node work; can escalate up; is NOT over-exposed to siblings/parents |
| P4 | **A05 / external-authority liaison** | external upper trust boundary | exchange in/out only; **no** internal admin, **no** tenant read, **no** org-tree membership (INV-2) |
| P5 | **Tenant admin** | isolation-domain administrator | manages within tenant; **cannot** cross tenant isolation (ADR-0006); cannot self-grant descendant raw read without audit |
| P6 | **Analyst** | day-to-day SOC user | own-node + assigned cases + need-to-know; clean functional path; correct empty/error/loading |

Configurable-tier note: deployments with only 3 tiers collapse P2 or the tier ladder
accordingly; the persona *roles* (coordinator / operator / liaison / tenant-admin / analyst)
are the invariant, the tier count is configuration.

---

## 3. Test dimensions (every persona × every in-scope surface)

Each cell of the matrix is evaluated across all of these dimensions. All must pass.

### 3.1 Functional
- Primary tasks for the persona complete end-to-end.
- Hierarchy switcher, roll-up dashboards, scoped search, escalation, tasking, exchange, and
  provenance/marking display behave per [UX IA](../architecture/org-hierarchy/03-ux-information-architecture.md).

### 3.2 RBAC / tenant / org isolation (the core of this gate)
- **Positive:** the persona can do exactly what its scope permits.
- **Negative (evidence required):** the persona is demonstrably **unable** to:
  - read descendant raw records without an explicit grant (INV-1);
  - cross tenant isolation (ADR-0006 cross-tenant reject);
  - see a sibling's or parent's data outside scope;
  - (P4) reach any internal admin/tenant surface, or appear as an org ancestor (INV-2).
- **Provenance & marking:** every visible object shows correct marking/residency; boundary
  crossings enforce it. No unlabelled data.
- Permission-denied does not leak existence where existence is itself sensitive.

### 3.3 Error / loading / empty
- Loading, error (recoverable + fatal), and the **three distinct empty states**
  (disconnected / empty / not-permitted) each render correctly with an appropriate next action.
- Partial-subtree-unreachable state renders (some descendants down) without failing the whole
  view.

### 3.4 Accessibility
- Keyboard-only operation of all primary flows; visible focus order.
- Screen-reader labels on controls, marking badges, and the hierarchy switcher.
- Contrast meets WCAG 2.1 AA; no color-only encoding of marking/severity (TLP must have a
  text/label, not just a color).
- Respects reduced-motion and text-scaling.

### 3.5 Responsive
- Analyst desktop, large ops-wall display, and a constrained/field viewport all usable.
- No loss of marking/scope indicators at any breakpoint.

### 3.6 Localization (Vietnamese / English)
- All UI, including error/empty/permission copy and marking labels, renders correctly in **VI**
  and **EN**.
- VI string expansion does not clip or break layout; dates/numbers localized.
- Configurable tier/role/authority labels resolve from the catalog in both locales.

---

## 4. Evidence requirements

A wave submission to the gate MUST include:

1. **Screenshot evidence** for each persona × surface × key state (at minimum: primary success,
   each empty/error state, and each negative-isolation result showing the withheld data is
   absent). VI and EN captures for representative screens.
2. **Video (screen capture)** of each persona's primary end-to-end flow and of each
   negative-isolation test being performed live (attempt → denied/absent).
3. An **isolation test log**: for every INV-1 / INV-2 / cross-tenant claim, the concrete
   attempt and its blocked outcome.
4. **Accessibility check output** (automated scan + manual keyboard/SR notes).
5. A **coverage table** mapping each persona × dimension to pass / fail / N-A with a link to the
   evidence artifact.

Evidence must be reproducible and must not contain real customer data, production logs, or
secrets (use synthetic fixtures — consistent with `cybrik-suite:CLAUDE.md` data-handling
boundary). Evidence artifacts live with the owning product's wave records, not in this repo,
unless synthetic and explicitly cleared.

---

## 5. Pass/fail rule

- **PASS** requires: every in-scope persona × dimension cell is `pass` (or justified `N/A`), all
  negative-isolation tests demonstrably blocked, and complete evidence.
- **Any** failed isolation (INV-1, INV-2, cross-tenant) negative test is an **automatic FAIL**
  of the entire wave regardless of functional completeness — these are safety properties, not
  quality nice-to-haves.
- A single failing accessibility-AA, localization, or empty/error-state item is a **FAIL** for
  that surface; the wave may pass partially only with explicit Founder-ratified carve-out.
- **Codex records the pass/fail recommendation and evidence index; the Founder ratifies.** No
  agent self-certifies a wave as passed.

---

## 6. What this gate does not do

- It does not design the UI or prescribe visuals (see [UX IA](../architecture/org-hierarchy/03-ux-information-architecture.md)).
- It does not accept any contract or ADR.
- It does not certify anything as passed today — no UI wave has been submitted or judged.
