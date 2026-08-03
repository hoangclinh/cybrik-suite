# Browser Integrated UAT Bridge R1

Status: `PROPOSED — NOT IMPLEMENTED — NOT RUN`.

Recorded: `2026-08-04T00:30:15+07:00` (`Asia/Ho_Chi_Minh`).

This is a design, implementation and evidence-closure plan for connecting a browser-facing SOC
wave to the already admitted SOC → Cyber AI → Tool Fabric backend candidate. It is **not** a
runtime-admission record, contains no `runtime-admission.json`, grants no execution authority and
does not claim that a browser URL, UI account, BFF bridge, integrated UI stack or UAT result exists.

The shortest honest path is sequential at the trust boundary and parallel inside each phase:

1. preserve and execute the exact backend candidate once;
2. accept its terminal evidence only if every backend gate passes;
3. build a separate SOC-owned UI/BFF source wave against that immutable evidence;
4. admit and run the browser UAT once under the accepted UAT standard.

This order prevents the current circular failure mode: UI work cannot be used as evidence that the
unrun backend works, and a changed UI commit cannot silently mutate the already authorized backend
tuple.

---

## 1. Status vocabulary

Every statement in this packet has one of these meanings:

- **`CONFIRMED CURRENT`** — directly supported by a repository path or immutable candidate record
  listed in the evidence map.
- **`PROPOSED`** — the intended architecture or gate; it is not accepted implementation evidence.
- **`NOT IMPLEMENTED`** — no qualifying source/evidence was found in the exact candidate scope.
- **`NOT RUN`** — source or an admission record may exist, but the corresponding runtime/UAT has
  not executed.

The present state is `BACKEND_PENDING`. It is not `BACKEND_PROVED`, `UI_SOURCE_READY`,
`UI_AUTHORIZED`, `UAT_RUNNING` or `PASS`.

---

## 2. Confirmed current facts

### 2.1 Backend admission

`CONFIRMED CURRENT`:

- `runtime-admission-soc-ai-lifecycle-mtls-r1` derives `RUNTIME_AUTHORIZED` for one bounded,
  non-production backend execution.
- Its current attempt is `not_run`, with `executed_checks=0`, `passed_checks=0` and
  `failed_checks=0`.
- Its independent Phase A review is `GO — P0=0, P1=0, P2=0`.
- The admitted path permits only four loopback binds: PostgreSQL `127.0.0.1:55432`, SOC
  `127.0.0.1:58442`, Cyber AI `127.0.0.1:58443` and Tool Fabric `127.0.0.1:58444`.
- It excludes Ollama, Internet egress, public binds, production traffic, production data,
  production configuration and production credentials.
- A consumed attempt cannot be retried. Failure is terminal evidence.
- The backend harness exposes no browser URL and creates no UI account.

Therefore backend admission is permission to gather evidence, not backend proof and not UAT.

### 2.2 Existing product surfaces

`CONFIRMED CURRENT` at the exact backend tuple:

- SOC has a Next.js portal and same-origin `/api/*` proxy support. It also owns alert truth,
  org/tenant authorization, a create-only lifecycle client and alert-context authorization logic.
- Cyber AI has injected lifecycle and summarization application surfaces. Its lifecycle runtime is
  off by default and requires explicit transport, trust, signature and PostgreSQL composition.
- Tool Fabric has an injection-only two-route runtime producer reference and durable
  process-local receipt adapters. Its source explicitly says `NOT DEPLOYABLE` / `NOT
  RUNTIME-WIRED` outside a supplied composition.
- Suite owns the bounded integrated harness, admission, orchestration and evidence controls.

These facts do **not** establish a browser-to-backend bridge. No current evidence proves that the
SOC portal can start an integrated investigation, observe its governed progress or render its
Fabric receipt through one SOC-owned browser origin.

### 2.3 Explicitly not implemented or not proven

The following remain `NOT IMPLEMENTED` or `NOT RUN` for this wave:

- a SOC BFF projection joining SOC truth to Cyber AI lifecycle state and Fabric receipt evidence;
- an accepted browser-facing contract for that projection;
- persona P1–P6 synthetic identities/fixtures for this exact surface;
- the browser screens, VI/EN strings and all required error/loading/empty states;
- browser E2E, negative-isolation, accessibility, responsive and localization evidence;
- a deterministic model-runtime composition for this browser wave;
- an optional Ollama composition and its separate supplemental evidence;
- a signed UI-UAT admission artifact, browser URL or UAT credentials;
- any runtime, demo, UAT, release, GA or production pass.

---

## 3. Immutable backend baseline

The backend proof, when run, MUST remain bound to this exact tuple:

| Repository | Commit | Tree |
|---|---|---|
| `cybrik-suite` | `8e6f05f823b237b8c1b93e630182d570062b239e` | `1cfc07c2c5c2ddc7789533297f7ac8661ba2aa3a` |
| `cybrik-soc-command-center` | `abfdfde96afc6daa2868694de993c623daa8862e` | `241ef24a33246918ff5cf133e7d8d004823fdf06` |
| `cybrik-cyber-ai-platform` | `51377267c6adbd7860270253cb212681001c7b1e` | `831a24ffd3033f966f35a9daab9f5d8af81e8b64` |
| `cybrik-security-tool-fabric` | `50aff1df146d6e98b33d9f82617781595bcf1512` | `2b4d516eef0a3b0ae05b44a225515efef749f25b` |

Immutability rules:

1. Backend execution uses clean detached worktrees at these exact commits and trees.
2. No UI change is made in, copied into or overlaid on those worktrees.
3. A backend result is accepted only when its terminal seal binds this tuple, the authorization,
   every stage receipt and the terminal absence proof.
4. Any source change before backend execution invalidates this exact admission; it does not create
   permission to patch-and-retry.
5. After `BACKEND_PROVED`, the UI wave gets a **new, separately pinned source tuple**. That UI tuple
   references the immutable backend result path and SHA-256 as a non-authorizing prerequisite; it
   never rewrites the backend result.
6. Cyber AI and Tool Fabric remain internal services. The fastest proposed UI tuple keeps their
   exact backend commits unchanged unless a separately reviewed contract gap proves a product
   change necessary.

---

## 4. Proposed architecture

### 4.1 Trust and traffic shape

`PROPOSED`:

```text
Browser
  |
  | same-origin HTTPS/session; no service token or Fabric grant in browser
  v
SOC portal (public UI owner)
  |
  | /api/* same-origin
  v
SOC API / BFF (public application boundary)
  |-- reads SOC-owned alerts, cases, org scope, actor and marking
  |-- derives authority server-side; projects one browser-safe view
  |
  +---- internal authenticated call ----> Cyber AI lifecycle/orchestration
                                            |
                                            +-- ModelRuntime
                                            |     |-- deterministic stub (mandatory core)
                                            |     `-- Ollama (optional supplemental lane)
                                            |
                                            `---- governed internal call ----> Tool Fabric
                                                                                |
                                                                                `-- receipt
```

Only the SOC origin is browser-reachable. The browser MUST NOT call Cyber AI or Tool Fabric
directly, receive service-delegation tokens, hold Fabric grants, choose a tenant/org authority
binding or see unredacted internal receipts. SOC derives the authoritative tenant, actor, org
scope and clearance from its authenticated session and returns a purpose-built, marked projection.

### 4.2 Repository ownership

| Repository | Owns in this wave | Must not own |
|---|---|---|
| `cybrik-soc-command-center` | Browser UI, session/authentication, persona-facing routes, SOC BFF projection, alert/case/org truth, marking and browser-safe audit references | Model semantics, AI orchestration internals, Fabric grants or tool-execution policy |
| `cybrik-cyber-ai-platform` | Investigation lifecycle, model-runtime port, prompt/model policy, orchestration/checkpoints and AI-safe result semantics | Browser routes, SOC identity truth or Tool Fabric execution authority |
| `cybrik-security-tool-fabric` | Capability/policy decision, invocation, containment boundary and verifiable execution receipt | Browser UI, SOC tenant membership or AI planning |
| `cybrik-suite` | Cross-product contract proposal, exact tuple/admission, deterministic integrated composition, browser harness and evidence index | Product source or production deployment |

There is no A05 ancestor, super-admin or auto-execution path. A05 remains an external exchange
boundary; this wave has no positive external-exchange feature.

### 4.3 Deterministic core and optional Ollama

The mandatory browser UAT uses the real SOC UI/BFF, real internal Cyber AI application boundary
and real Tool Fabric application boundary, but injects a deterministic `ModelRuntime` adapter with:

- versioned synthetic inputs and canonical outputs;
- fixed model capability and health documents;
- deterministic timing checkpoints and error cases;
- no network, model download, random free-form generation or external account;
- digest-bound prompts, outputs, citations and expected receipts.

This keeps authorization, isolation, orchestration and receipt paths real while removing model
nondeterminism from the acceptance oracle. A passing stub lane is mandatory.

Ollama is an optional, non-blocking supplemental lane after the deterministic core passes. It must
use an explicitly pinned model identity/digest, an opt-in local-only adapter and the same budgets,
marking and egress constraints. An Ollama failure cannot be hidden by the deterministic lane and
cannot change its expected evidence; conversely, Ollama availability is not a prerequisite for
the core UAT. No operator should start Ollama until that supplemental lane is separately admitted.

### 4.4 Source anchors and proposed change boundary

The following exact existing paths anchor review. Presence is evidence of a source seam only, not
of integrated browser readiness.

| Owner | Exact existing source path | Current role |
|---|---|---|
| SOC | `cybrik-soc-command-center:apps/soc-portal/next.config.mjs` | optional same-origin `/api/*` proxy |
| SOC | `cybrik-soc-command-center:apps/soc-portal/components/AppShell.tsx` | portal shell and AI panel placement |
| SOC | `cybrik-soc-command-center:apps/soc-portal/components/AiPanel.tsx` | existing user-facing AI panel seam |
| SOC | `cybrik-soc-command-center:apps/soc-portal/app/alerts/page.tsx` | SOC-owned alert surface |
| SOC | `cybrik-soc-command-center:apps/soc-portal/lib/api.ts` | browser-to-SOC API client seam |
| SOC | `cybrik-soc-command-center:services/api/src/cybrik_soc/main.py` | SOC API composition root |
| SOC | `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/copilot/lifecycle_create.py` | create-only caller-owned mTLS client |
| SOC | `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/alert/context/api.py` | SOC-owned alert-context HTTP boundary |
| SOC | `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/alert/context/service.py` | fail-closed alert-context service |
| Cyber AI | `cybrik-cyber-ai-platform:services/ai-api/src/cybrik_ai_api/app.py` | injected lifecycle ingress composition |
| Cyber AI | `cybrik-cyber-ai-platform:services/ai-api/src/cybrik_ai_api/investigations/api.py` | accepted internal lifecycle routes |
| Cyber AI | `cybrik-cyber-ai-platform:services/ai-api/src/cybrik_ai_api/runtime_composition.py` | off-by-default PostgreSQL runtime composition |
| Cyber AI | `cybrik-cyber-ai-platform:services/ai-api/src/cybrik_ai_api/summarize/service.py` | model-runtime consumer and alert-context resolver seam |
| Tool Fabric | `cybrik-security-tool-fabric:src/control-plane/cybrik_fabric_control/runtime_routes.py` | injection-only internal invocation/receipt routes |
| Tool Fabric | `cybrik-security-tool-fabric:src/control-plane/cybrik_fabric_control/runtime_adapters.py` | runtime producer and receipt adapters |
| Tool Fabric | `cybrik-security-tool-fabric:src/control-plane/cybrik_fabric_control/contracts/alert_context.py` | alert-context shape/policy predicates |
| Suite | `cybrik-suite:integration/compose/integrated-uat/scripts/run_integrated_uat.py` | exact one-shot backend runner |
| Suite | `cybrik-suite:integration/compose/integrated-uat/src/cybrik_suite_integrated_uat/orchestrator.py` | master backend orchestration/sealing |
| Suite | `cybrik-suite:integration/compose/soc-ai-fabric-alert-context-mtls/` | bounded three-service alert-context composition |

`PROPOSED` change boundary:

- SOC owns all product changes needed to expose the integrated browser projection, including tests
  beside the existing portal/API seams above.
- Suite owns a new browser composition/evidence harness only after the browser contract is
  reviewed. Its exact path and allowlist are selected at G-U0; this packet does not create them.
- Cyber AI and Tool Fabric receive no UI code and no public route. Product changes there require a
  separately evidenced contract gap and a new exact UI source tuple.

No route name or payload in this document is an accepted contract. G-U0 must freeze those bytes
before implementation so a convenient ad-hoc BFF cannot become accidental authority.

---

## 5. One-way state machine

```text
BACKEND_PENDING
      |
      | G-B0..G-B3 all pass
      v
BACKEND_PROVED
      |
      | G-U0..G-U6 all pass
      v
UI_SOURCE_READY
      |
      | first half of G-U7: exact signed UI admission
      v
UI_AUTHORIZED
      |
      | admitted runner consumes authorization before opening services
      v
UAT_RUNNING
      |
      +----------------------+
      |                      |
      v                      v
PASS                    FAIL_TERMINAL
```

Rules:

- Only the listed forward transitions exist. There is no `retry`, `resume`, `force-pass` or state
  alias.
- `BACKEND_PROVED` requires a passed terminal backend result, not merely Phase A authorization.
- A failed backend attempt remains terminal in its backend series. UI work cannot reinterpret it.
- `UI_SOURCE_READY` means exact source and static/hosted evidence are ready; it means no listener,
  URL, account or UAT has run.
- UI authorization is externally signed, exact-bit, bounded, expiring and one-shot. Consumption
  occurs before any child process/listener starts.
- Any isolation, authorization, marking, secret-boundary or teardown failure produces
  `FAIL_TERMINAL` immediately.
- `PASS` is a browser-wave technical result only. It is not demo, POC, RC, GA, public release or
  production authority.

---

## 6. Gates

### Backend gates

| Gate | Required evidence | Transition effect | Current status |
|---|---|---|---|
| **G-B0 — exact preflight** | Revalidate exact four-repository commit/tree/cleanliness, hosted required checks, allowlisted aggregate, external roots, pinned Python/B1 artifact, allowed signer and absence of all four ports | Keeps candidate eligible for its already recorded authorization | `EVIDENCE PRESENT; IMMEDIATE PRE-RUN RECHECK REQUIRED` |
| **G-B1 — Founder signature** | Unexpired canonical payload, SSHSIG namespace `cybrik-uat-soc-ai-fabric-v1`, public signer verification and exact payload digest; no private key enters an agent/repository | Permits the one exact runner invocation | `PENDING` |
| **G-B2 — one-shot execution** | Authorization consumed before service start; exact runner only; separate processes, loopback mTLS, PostgreSQL, synthetic seed, N1–N10 and F1–F2 execute | Remains `BACKEND_PENDING` while running | `NOT RUN` |
| **G-B3 — terminal closure** | All admitted checks pass; stage receipts and terminal seal bind the tuple; four ports/processes/containers/PKI/restricted material are absent; result artifact is distinct and digest-pinned; independent review has P0=P1=P2=0 | `BACKEND_PENDING → BACKEND_PROVED`; any failure ends backend lane terminally | `NOT RUN` |

### UI gates

| Gate | Required evidence | Transition effect | Current status |
|---|---|---|---|
| **G-U0 — scope and contract freeze** | Browser use cases, SOC-only public boundary, sanitized BFF view, P1–P6 matrix, state/error vocabulary, exact paths/allowlist and backend-result digest reviewed; no authority supplied by request body | Opens bounded TDD work only | `PROPOSED` |
| **G-U1 — RED contract/security tests** | Failing tests first for positive flows and every negative boundary: cross-tenant, sibling/parent/descendant raw read, marking, A05 internal access, direct AI/Fabric access, token/receipt leakage and replay | Proves the tests can detect absent/wrong behavior | `NOT IMPLEMENTED` |
| **G-U2 — SOC BFF GREEN** | Minimal SOC-owned projection; server-derived identity/scope; internal client timeouts/budgets; uniform non-disclosing errors; audit references; unit/integration coverage at least 80% for the changed scope | Establishes the only public application boundary | `NOT IMPLEMENTED` |
| **G-U3 — SOC portal GREEN** | Alert-to-investigation journey, governed status/checkpoints/receipt projection, explicit marking/scope, loading/error/three empty states, VI/EN and no hidden authorization in UI state | Establishes source-complete browser behavior | `NOT IMPLEMENTED` |
| **G-U4 — deterministic integrated harness** | Real SOC UI/BFF + internal AI/Fabric boundaries with canonical deterministic model adapter; fixed synthetic clock/IDs/fixtures; no Internet/Ollama dependency; repeat runs produce matching normalized evidence digest | Establishes a stable UAT oracle | `NOT IMPLEMENTED` |
| **G-U5 — P1–P6 UAT matrix** | Every mandatory cell passes, including negative isolation and A05 negative-only rows; functional flows, failure states and teardown are evidenced without customer data | Establishes persona/security behavior | `NOT RUN` |
| **G-U6 — quality and source closure** | Keyboard/SR + automated accessibility, WCAG 2.1 AA, desktop/ops-wall/constrained viewports, VI/EN, screenshot/video/log index, exact source tuple, green hosted checks, secret/supply-chain scans, coverage and independent P0=P1=P2=0 review | `BACKEND_PROVED → UI_SOURCE_READY` | `NOT RUN` |
| **G-U7 — signed browser-UAT run** | Separate exact signed one-shot UI admission; private loopback-only services; documented URL and synthetic accounts disclosed only after start; authorization atomically consumed; full evidence and terminal absence proof | `UI_SOURCE_READY → UI_AUTHORIZED → UAT_RUNNING → PASS|FAIL_TERMINAL` | `NOT AUTHORIZED` |

No gate is satisfied by prose, a scaffold, an unexecuted test, a screenshot without a reproducible
attempt, a static test standing in for a real boundary, or an Ollama-only happy path.

---

## 7. Synthetic persona matrix

All identities, tenants, nodes, alerts, investigations and receipts are generated fixtures. No
production-derived or customer data is allowed. Each row is tested in VI and EN where user-facing.

| Persona | Mandatory positive path | Mandatory negative path | Key evidence |
|---|---|---|---|
| **P1 Central/top-tier coordinator** | View allowed aggregate, start an authorized synthetic investigation, observe governed result | Cannot read descendant raw alerts by default; aggregate URL/result cannot reveal raw object refs | Browser video, API log, absent raw identifiers, audit ref |
| **P2 Mid-tier coordinator** | Own node + permitted subtree aggregate; escalation/tasking behavior only where contracted | Cannot escape subtree, read sibling branch or widen `include_descendants` from browser input | Attempt/denial pair and scoped query evidence |
| **P3 Local operator** | Work own-node alert and escalate through the allowed workflow | Cannot read sibling, parent or unrelated-tenant data; cannot request aggregate authority | Attempt/denial pair with non-disclosing response |
| **P4 A05/external liaison** | **N/A in this wave — no positive A05 exchange surface is implemented** | Negative-only: cannot enter internal SOC UI, appear in org tree, read tenant data, call AI/Fabric, administer or auto-execute inbound tasking | Login/route/API denial and org-tree absence evidence |
| **P5 Tenant admin** | Manage the synthetic tenant within accepted SOC administration scope | Cannot cross tenant or self-grant raw descendant access without the separately audited grant path | Cross-tenant attempt, denial, audit evidence |
| **P6 Analyst** | Open assigned alert, start allowed investigation, follow checkpoints and view sanitized receipt/result | Cannot access unassigned/out-of-scope records, service tokens, raw grants or restricted fields above clearance | Primary-flow video plus DOM/network redaction checks |

P4 `N/A` for positive exchange does not certify an A05 feature. It certifies only that the internal
wave preserves INV-2 by having no external-authority escalation path. Any future A05 exchange
surface is a new wave and must add positive exchange tests without weakening these negatives.

For every persona the matrix also covers:

- success, loading, recoverable error, fatal error;
- disconnected, genuinely empty and not-permitted empty states;
- partial internal-service unavailability;
- replay/idempotency and refresh/reconnect behavior;
- keyboard, screen reader, contrast, reduced motion and text scaling;
- analyst desktop, large ops wall and constrained/field viewport;
- visible classification/TLP and scope; no color-only marking;
- browser storage, DOM, console, network and evidence-artifact secret scans.

---

## 8. Evidence map

### 8.1 Authoritative current candidate evidence

| Evidence | What it proves | What it does not prove |
|---|---|---|
| `cybrik-suite:docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/runtime-admission.json` | Machine-readable exact tuple, current zero-count attempt, one-shot boundary, checks and production exclusions | A passed backend run or any browser UAT |
| `cybrik-suite:docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/06-integrated-master-phase-a-authorization.md` | Exact Phase A backend authorization and limitations | Signature, execution or terminal result |
| `cybrik-suite:docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/07-independent-phase-a-review.md` | Independent preflight GO with no P0/P1/P2 | Runtime success |
| `cybrik-suite:docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/02-architecture-and-acceptance.md` | Historical architecture/acceptance evolution and required backend properties | Current exact tuple identity by itself; §3 and evidence/06 are newer authority |
| `cybrik-suite:docs/uat/candidates/README.md` | Candidate registry rules and current series summary | Product feature readiness |
| `cybrik-suite:docs/uat/UAT-GATE-STANDARD.md` | Accepted P1–P6 process and evidence bar | A UI design or completed UAT |
| `cybrik-suite:docs/architecture/org-hierarchy/02-domain-model.md` | INV-1/INV-2 ownership and external-boundary semantics | Implemented UI |
| `cybrik-suite:docs/architecture/org-hierarchy/03-ux-information-architecture.md` | Proposed hierarchy/A05 UX constraints | Implemented UI |
| `cybrik-suite:docs/architecture/org-hierarchy/04-threat-model-and-open-decisions.md` | Fail-closed hierarchy/external-exchange abuse cases | Runtime enforcement by this wave |
| `cybrik-suite:docs/architecture/org-hierarchy/05-contract-delta-proposal.md` | Proposed UI/contract milestones and negative-isolation gate | Accepted product source |
| `cybrik-suite:docs/strategy/06-ROADMAP-2026-2029.md` | Fixed roadmap and release milestones | Authority to accelerate or move them |
| `cybrik-suite:docs/operations/DELEGATED-GOVERNOR-RUNTIME-UAT-RECONCILIATION-2026-07-31.md` | Conditional early non-production runtime/UAT governance | Production authority |

### 8.2 Evidence required to close this plan

The future UI-wave packet must add and digest-pin:

1. the backend terminal result, terminal seal and independent review;
2. the accepted browser/BFF contract and threat model;
3. the exact UI source tuple and per-repository allowlist aggregate;
4. RED/GREEN/refactor transcripts, coverage and hosted check identities;
5. the canonical synthetic fixture catalog and deterministic-output digests;
6. the P1–P6 coverage table;
7. screenshot/video indices, negative-isolation log, accessibility output and VI/EN evidence;
8. secret scans of browser storage, DOM, console, network captures and retained artifacts;
9. the signed one-shot UI admission receipt without private-key material;
10. the terminal UAT result and absence proof, distinct from its pre-run authorization.

Evidence artifacts must be synthetic, sanitized, bounded and stored in an approved external
mode-`0700` evidence root or an explicitly cleared owning-product wave record. No key, token,
password, production log or customer payload may enter Git.

---

## 9. Acceptance criteria

This browser bridge may be recommended `PASS` only if all conditions below are proven together:

1. G-B0 through G-B3 pass on the immutable backend tuple, producing `BACKEND_PROVED`.
2. G-U0 through G-U7 pass on a separately pinned exact UI tuple.
3. The browser has one public trust boundary: SOC. Direct browser access to AI/Fabric is absent
   and tested.
4. SOC derives identity, tenant, org scope and clearance server-side. Advisory browser fields
   cannot widen authority.
5. Cyber AI remains the owner of orchestration/model semantics; Tool Fabric remains the owner of
   execution authority/receipts; Suite remains the contract/harness owner.
6. The mandatory deterministic model lane is reproducible and independent of Ollama/network.
7. Every applicable P1–P6 cell passes. P4 is negative-only and gains no internal authority.
8. All isolation, marking, error non-disclosure, replay, secret-boundary and teardown assertions
   pass. Any one failure is `FAIL_TERMINAL`.
9. Functional, accessibility, responsive, localization, loading/error/empty and degraded-service
   evidence meets `UAT-GATE-STANDARD.md`.
10. Changed code has unit, integration and browser E2E tests, at least 80% coverage for the changed
    scope, green exact-head hosted checks and an independent review with P0=P1=P2=0.
11. The UI authorization and result are distinct immutable artifacts; the result binds exact
    source, evidence and absence-proof digests.
12. All services, ports, child processes, containers, ephemeral PKI and restricted material are
    absent at terminal state.

A technical `PASS` does not automatically authorize a demo, POC, RC, public release or production.
Each stays `HOLD` until its applicable gate passes. Production remains Founder-only.

---

## 10. Open decisions

These decisions must be closed at G-U0; this document deliberately does not invent accepted bytes:

| ID | Decision | Required disposition |
|---|---|---|
| **OD-UI-1** | Exact SOC BFF resource names, methods and schema | Contract review; no request-body authority fields |
| **OD-UI-2** | Which existing SOC alert/AI-panel surface hosts the primary journey | UX review against existing information architecture |
| **OD-UI-3** | Browser-safe projection of AI checkpoints and Fabric receipts | Explicit allowlist; marking and provenance visible; credentials/grants excluded |
| **OD-UI-4** | Synthetic persona credential mechanism and expiry | Local-only, generated, non-production, no hardcoded secret in Git |
| **OD-UI-5** | Exact Suite browser harness path, ports and external evidence roots | Disjoint loopback-only admission with terminal absence proof |
| **OD-UI-6** | Deterministic model fixture/version/digest and canonicalization rule | Repeatability proof and failure-injection catalog |
| **OD-UI-7** | Optional Ollama model identity and hardware/resource envelope | Supplemental only; separately admitted; never core-pass prerequisite |
| **OD-UI-8** | Evidence retention duration and artifact size ceiling | Data-handling and cleanup review before execution |
| **OD-UI-9** | Whether any AI/Fabric product change is truly necessary | Default `NO`; require a demonstrated contract gap and new tuple |
| **OD-UI-10** | UAT URL, synthetic accounts and operator handoff | Generated only after G-U7 authorizes and starts the stack |

---

## 11. Release and production invariants

- W1 remains `2026-08-01 → 2026-08-23`.
- Founder stable-v1.0/public-GA go/no-go remains `2026-12-20`.
- The release window remains `2026-12-21 → 2026-12-31`.
- All other W0–W6 milestones remain unchanged.
- Runtime, demo, UAT, POC, RC and release remain `HOLD` until their own evidence gates pass.
- Production deployment, production configuration/data/credentials and production rollout remain
  Founder-only regardless of a technical UAT result.

No action in this plan authorizes a stack start, listener, dependency install, database migration,
commit, push, merge, release or production change.

---

## 12. Independent reviewer response template

```text
Review target:
  browser-integrated-uat-bridge-r1 / <exact revision or digest>

Review mode:
  read-only | no runtime | no network | no production

Exact inputs reviewed:
  - backend candidate record path + SHA-256:
  - backend terminal result path + SHA-256:
  - backend tuple digest:
  - UI source tuple digest:
  - contract/threat-model paths + SHA-256:
  - persona matrix/evidence index paths + SHA-256:

Gate findings:
  - G-B0:
  - G-B1:
  - G-B2:
  - G-B3:
  - G-U0:
  - G-U1:
  - G-U2:
  - G-U3:
  - G-U4:
  - G-U5:
  - G-U6:
  - G-U7:

Boundary findings:
  - SOC-only browser/BFF boundary:
  - AI/Fabric internal-only boundary:
  - server-derived tenant/org/actor/clearance:
  - A05 negative-only / no ancestor or super-admin path:
  - deterministic core / optional Ollama separation:
  - release dates unchanged:
  - production Founder-only:

Severity counts:
  P0=
  P1=
  P2=
  P3=

Unsupported or missing evidence:
  -

Verdict:
  GO | CONDITIONAL GO | NO-GO

Permitted next transition:
  <one exact state transition, or NONE>

Residual risks and required follow-up:
  -
```

A reviewer must return `NO-GO` if an exact input is missing, a claimed pass relies on indirect
evidence, the backend tuple was mutated, AI/Fabric became browser-reachable, P4 gained internal
authority, or a failed/consumed attempt is being presented as retryable.
