# ADR-0015 — Deployment priority, data sovereignty, and provider-neutral platform boundary

- Status: `PROPOSED` — **NOT ACCEPTED**. This ADR decides nothing until the Founder accepts it.
  It is not implementation, dependency, substrate, product-selection, provisioning, deployment,
  release or production authority, and it grants none if accepted.
- Date raised: 2026-08-23
- Date decided: — (not decided)
- Decider: Founder
- Type: **consolidation + governance**. This is **not** a technology-selection ADR. No Kubernetes
  distribution, virtualization product, cloud provider, hosting provider, storage product,
  database, orchestrator or hypervisor is selected, ranked or eliminated here.
- Scope: suite-wide deployment architecture governance across `cybrik-suite`,
  `cybrik-soc-command-center`, `cybrik-cyber-ai-platform` and `cybrik-security-tool-fabric`,
  and the authority rules that bind derived deployment/controller layers.
- Supersedes: nothing. Amends no accepted ADR text. Where it consolidates an existing accepted
  requirement it restates that requirement's own qualified status verbatim (§1.5).
- Founder policy consolidated by this ADR:
  [FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md](FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md)
  — `DECIDED — RECORDED` (Founder, 2026-08-23). That packet is the **authority**; this ADR is the
  **consolidation** of it into suite architecture and is not accepted by it.

## 0. Label vocabulary — how to read this ADR

Every normative or descriptive claim below carries **one or more** of these labels. A claim without
a label is framing, not authority.

**Claim/authority labels.** Exactly this closed set; nothing else is a claim label.

| Label | Meaning | Binding? | Who may change it |
|---|---|---|---|
| `HISTORICAL_FINDING` | A fact about what the repositories already recorded before this ADR. Dated provenance. Never rewritten to match current policy. | **No** | Nobody — it is history |
| `FOUNDER_POLICY` | A Founder decision this ADR consolidates into suite architecture. **New as of 2026-08-23**; not retroactive | **Yes** | Founder |
| `ARCHITECTURAL_INVARIANT` | A binding architecture rule proposed here, effective only on acceptance | **Yes** | Founder, by a later ADR |
| `DECISION` | A binding decision statement in §3 | **Yes** | Founder, by a later ADR |
| `OPEN_QUESTION` | Explicitly unresolved. Acceptance of this ADR does **not** close it | **No** | A later bounded decision |
| `OPTIONAL_PROFILE` | Permitted but never mandatory; may not become a release or core dependency | **No** | Founder, per profile |

**Evidence-provenance classes.** A separate, orthogonal axis describing *how reproducible a cited
source is*. These are **never** claim labels, are never binding, and are never combined with a claim
label using `+`:

| Provenance class | Meaning |
|---|---|
| `COMMIT_BOUND_REPRODUCIBLE` | Pinned to an exact Git commit or tag object; any reviewer can recover the same bytes. **Only this class may support a binding conclusion.** |
| `NON_AUTHORITATIVE_CONTEXT_ONLY` | Readable but not pinnable to a commit — an untracked file, or a working directory that is not a Git repository. Usable as context and corroboration; **never** load-bearing for a binding conclusion. |

**Compound classification.** A single item legitimately carries more than one claim label — a
`HISTORICAL_FINDING` that a `FOUNDER_POLICY` then incorporates is both, and remains both. Compound
labels are written most-binding-first and joined with **`+`**, which is the **only** compound
syntax used in this ADR. A `/` never denotes a compound label anywhere in this document.

**Precedence, used only where two labels would give conflicting force:**

1. `OPEN_QUESTION` wins over every other label **for the sub-question it names**. An item labelled
   `OPEN_QUESTION` creates no binding requirement about that sub-question, whatever else it carries.
2. `FOUNDER_POLICY` and `ARCHITECTURAL_INVARIANT` are binding, and where both apply the invariant
   text is the operative wording.
3. `OPTIONAL_PROFILE` never becomes mandatory by association with a binding label.
4. `HISTORICAL_FINDING` never acquires binding force from a co-label; it stays dated provenance. A
   section labelled `HISTORICAL_FINDING` alone MUST NOT introduce a requirement of its own; where a
   historical finding has a binding consequence, that consequence is written as a numbered invariant
   in §4 and the historical section refers to it descriptively.

**Where binding language may appear.** Normative keywords `MUST`, `MUST NOT`, `SHOULD`, `MAY` are
used in the RFC 2119 sense, apply only to `ARCHITECTURAL_INVARIANT` and `FOUNDER_POLICY` items, and
take effect only after acceptance. Sections labelled `OPEN_QUESTION` describe what is unresolved and
**create no binding requirement of their own**; where a binding rule is adjacent to an open
question, the rule lives in §4 as a numbered invariant and the open section cites it by number.

---

## 1. Context

### 1.1 The historical deployment architecture was provider-neutral with on-prem first class

`HISTORICAL_FINDING` — `PROVIDER_NEUTRAL_WITH_ON_PREM_FIRST_CLASS`.

`cybrik-suite:docs/strategy/03-REFERENCE-ARCHITECTURE.md` (status `[PROPOSAL]`, 2026-07-22) opens
its architectural drivers with *"Local/on-prem/air-gapped là deployment mode hạng nhất"* —
local/on-prem/air-gapped is a first-class deployment mode — and its §10 deployment-tier table
describes a sovereign/air-gap tier with private registry, offline update station and no
phone-home. `cybrik-soc-command-center:governance/ADR/ADR-0016-sovereign-airgapped-ai-copilot.md`
and `…/ADR-0017-dual-diode-a05-mtslcd.md` position the product as a national-sovereignty SOC.

No pre-existing suite ADR selects, mandates or ranks any cloud provider. The scan is stated as an
exact, boundary-aware, independently reproducible command against a pinned commit, so a reviewer can
re-run it rather than trust the result:

```sh
git -C cybrik-suite grep -n -I -E \
  "(^|[^A-Za-z0-9_])(AWS|aws|Aws|GCP|gcp|Azure|azure|AZURE|amazonaws|EKS|GKE|AKS)([^A-Za-z0-9_]|$)" \
  d2b5c7fe799beb94b1dcf0661350de10417da0a3 -- \
  "docs/adr/ADR-0001-*.md" "docs/adr/ADR-0002-*.md" "docs/adr/ADR-0003-*.md" \
  "docs/adr/ADR-0004-*.md" "docs/adr/ADR-0005-*.md" "docs/adr/ADR-0006-*.md" \
  "docs/adr/ADR-0007-*.md" "docs/adr/ADR-0008-*.md" "docs/adr/ADR-0009-*.md" \
  "docs/adr/ADR-0010-*.md" "docs/adr/ADR-0011-*.md" "docs/adr/ADR-0012-*.md" \
  "docs/adr/ADR-0013-*.md" "docs/adr/ADR-0014-*.md"
# → no output, exit status 1 (zero matches)
```

The token-boundary groups `(^|[^A-Za-z0-9_])` and `([^A-Za-z0-9_]|$)` are what make the result
meaningful: a naive substring search for `eks` matches `weeks` and `seeks`, and R2's stated method
would have. Two controls were run against this exact expression — it produces **no** match on the
string `this breaks and leaks`, and it **does** match the known-positive
`docs/security/RESPONSIBLE-DISCLOSURE-POLICY.md` at the same commit, so the zero result is a real
absence rather than a broken pattern.

The path list is explicit and deliberately excludes this file. ADR-0015 discusses AWS extensively
(§10), so any glob including it will match, and a claim of "zero matches across every ADR file"
would be false the moment this ADR exists. The verified claim is about ADR-0001 … ADR-0014 at
`BASE_SHA`, nothing wider. The two status-flip application files are also outside the path list, so
the claim does not extend to them.

### 1.2 AWS-primary was derived drift, not Founder authority

`HISTORICAL_FINDING`. Each row below is established by the repository evidence in its third column,
which is what makes it citable. `soc-autonomous-state:CURRENT_STATE.json` states the same findings
but is `NON_AUTHORITATIVE_OPERATIONAL_MIRROR` (no commit identity) and supports nothing on its own:

| Finding | Value | Corroborating repository evidence |
|---|---|---|
| `AWS_PRIMARY_FOUNDER_AUTHORITY` | `NOT_FOUND` | No accepted suite ADR names a provider (C1) |
| `AWS_PRIMARY_DEPLOYMENT_DECISION` | `VOID_UNRATIFIED_DERIVED_DRIFT` | The AWS estate exists only in a derived repository |
| `PRODUCT_CORE_CONTAMINATED` | `NO` | No provider-specific infrastructure service is mandatory to any product domain/core contract. The one provider-origin SDK in the products sits in a `PRODUCT_IMPLEMENTATION_ADAPTER` speaking a portable protocol (Decision B, §5.1, §10.2) |
| `RC1_TAG_CONTAMINATED` | `NO` — **scoped to dependency-bearing runtime paths**, not to document text | At `v1.0.0-rc1` exactly one declared provider-SDK dependency exists across all four repositories, and it is a portable S3-protocol client pointed at self-hosted SeaweedFS. Provider **text** does occur at the tag in architecture, governance and research documents; that is not contamination. See §10.2 for the full scoped statement |
| `CONTRACTS_CONTAMINATED` | `NO` | `cybrik-suite:contracts/` declares no provider-bound schema; the packet is itself `PROPOSED — NOT ACCEPTED` |
| `DERIVED_DEPLOYMENT_LAYER_CONTAMINATED` | `YES` | `soc-production-infrastructure:terraform/` declares `provider "aws"` (primary + DR region) and `provider "cloudflare"`, with VPC/ALB/IAM/security-group/observability/S3-WORM/S3-DR modules |

`soc-production-infrastructure:architecture/PRODUCTION_PLATFORM_DECISION.json` carries
`"verdict": "ACCEPTED"` and `"architecture_tier": "T0"`, derived from
`cybrik-suite:docs/adr/evidence/ADR-0004-EVIDENCE.md` and `…/ADR-0005-EVIDENCE.md`. Both of those
sources are `DRAFT` evidence documents per `cybrik-suite:docs/adr/README.md`, not accepted ADRs,
and no Founder acceptance record exists for that platform verdict.

`soc-production-infrastructure:QUARANTINE_NOTICE.md` already classifies the AWS Terraform estate
as `QUARANTINED_REFERENCE_IMPLEMENTATION` / `PRESERVED_AS_DEFERRED_REFERENCE_PROFILE`. That notice
is a derived-layer artifact. It records the disposition; it does not confer architecture authority.
This ADR exists to place the disposition under suite architecture authority.

### 1.3 The new Founder deployment priority (new policy, not retroactive)

`FOUNDER_POLICY`. **Authoritative provenance:**
`cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md`, a Founder
decision record written under the repository's canonical `FOUNDER-DECISION-PACKET-*` convention and
identified by the Git commit that introduces it. That packet — not this ADR, and not any derived
artifact — is what a reviewer must read to confirm the policy. It records the policy only; it
accepts nothing, selects nothing, and authorizes nothing.

`soc-autonomous-state:CURRENT_STATE.json` previously carried the only written form of this policy.
That working directory is **not a Git repository**, so it has no commit identity and cannot be
pinned. It is now classified `NON_AUTHORITATIVE_OPERATIONAL_MIRROR` and is **not** part of this
ADR's binding authority closure. Where the mirror and the packet differ, the packet governs.

This ordering is **new**. It MUST NOT be read back into, or used to re-date, any historical
document. Historical documents are provider-neutral with on-prem first class (C1); they were never
a P1/P2/P3 ordering, and this ADR does not retroactively make them one. Where a derived artifact
states an older phrasing of the third priority (`soc-production-infrastructure:QUARANTINE_NOTICE.md`
records P3 as `HYBRID_CLOUD`), that phrasing is dated provenance and is corrected forward by
Decision A, not edited backward.

### 1.4 Substrate status is undecided

`HISTORICAL_FINDING` + `OPEN_QUESTION`. Recorded by Founder authority in
`cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` §1.4
(`KUBERNETES_PRIMARY_SUBSTRATE = UNDECIDED`, `VIRTUALIZATION_SUBSTRATE = UNDECIDED`); the
per-candidate detail below mirrors `soc-autonomous-state:CURRENT_STATE.json`
(`substrate_and_candidates`), which is `NON_AUTHORITATIVE_OPERATIONAL_MIRROR`:

```
KUBERNETES_PRIMARY_SUBSTRATE = UNDECIDED
KUBERNETES_STATUS            = OPTIONAL_CANDIDATE_PENDING_ARCHITECTURE_CONTRACT
RKE2 = NOT_SELECTED    K3S = NOT_SELECTED    OPENSHIFT = NOT_SELECTED
VMWARE = NOT_SELECTED  PROXMOX = NOT_SELECTED  OPENSTACK = NOT_SELECTED
```

Existing Helm/Kubernetes work is `UNRATIFIED_REFERENCE_CANDIDATE`, not architecture authority.
In the suite, `cybrik-suite:integration/helm/README.md` is `SCAFFOLD` — *"intentionally empty …
No charts exist."* The only substantive chart is
`soc-production-infrastructure:helm/cybrik-soc/`, which lives in a derived repository.

### 1.5 Cited ADR statuses, verified from source at authoring time (2026-08-23)

`HISTORICAL_FINDING`. Verified by reading the ADR bytes, not an index or a summary.

| ADR | Verified status string (source) | How this ADR may use it |
|---|---|---|
| `cybrik-suite` ADR-0005 — Sandbox substrate | `ACCEPTED` (GATE A4, 2026-07-26) — *"decision only; no implementation, dependency or runtime authority"* | Isolation semantics are binding as **decided policy**; no profile may be claimed implemented or qualified |
| `cybrik-suite` ADR-0001 / ADR-0004 / ADR-0006 | `ACCEPTED` (2026-07-24) | Contract-versioning policy, control-plane/executor split, cross-product event and identity model |
| `cybrik-suite` ADR-0007 — Org hierarchy & external-authority boundary | `ACCEPTED` (W2-C1, 2026-07-24) — **model only; its contract delta stays `PROPOSED — NOT APPLIED`** | The authority-boundary *model* only |
| `cybrik-suite` ADR-0008 — Internal service delegation & workload identity | `ACCEPTED FOR IMPLEMENTATION` (W2-F, 2026-07-24) — **v0.1.0, not stable v1/GA** | The E2/E3 two-layer trust seam, at that strength |
| `cybrik-soc-command-center` ADR-0016 — Sovereign air-gapped AI copilot | **`ACCEPTED MỘT PHẦN`** (ACCEPTED IN PART, Founder 2026-07-18): model choice + environment strategy settled; *hardware tier, diode and sidecar remain `PROPOSED`*; §S7 states the air-gap/diode/vLLM/GPU/RAG parts are **design or V2, not built** | May be cited **only** for the settled part, and only as *sovereignty intent*. MUST NOT be cited as evidence that air-gap exists |
| `cybrik-soc-command-center` ADR-0017 — Controlled cross-domain, dual diode + data guard | **`ACCEPTED`** — *"hướng đã được Founder chốt"* (direction settled by Founder, 2026-07-18); **devices, cost and sprint remain open** | The **trust-domain-exchange model** is accepted. Concrete devices are not |
| `cybrik-soc-command-center` ADR-0018 — Sovereign encryption & key management | **`PROPOSED`** (explicitly *"chờ Founder duyệt; CHƯA implement"*) | MUST NOT be cited as accepted. Its pluggable-crypto-provider requirement enters this ADR only as a **capability slot** (§5.2 slot 9), not as an accepted mandate |
| `cybrik-soc-command-center` ADR-0019 — Sovereign SIEM (Wazuh/OpenSearch/NSM) | **Accepted as to direction — V2 target, DEFERRED** (Founder 2026-07-19); does **not** supersede `cybrik-soc-command-center` ADR-0015 (Security Onion SIEM/NSM foundation) until a stated V2 activation trigger fires | May be cited as *direction* with its defer qualification stated. MUST NOT be cited as an active mandate |
| `cybrik-soc-command-center` ADR-0020 — SIEM backend adapter swap-ready | **`Proposed`** (awaiting approval alongside ADR-0019) | MUST NOT be cited as accepted. Its *seam-at-the-protocol* reasoning is referenced as **rationale**, not authority |

Three further status hazards are recorded so they are not repeated. This section is
`HISTORICAL_FINDING` only and states no requirement of its own; the binding citation rules are
`INV-16` in §4:

- **Number collision across repositories.** This ADR is `cybrik-suite` ADR-0015. A different,
  unrelated `cybrik-soc-command-center` ADR-0015 (Security Onion SIEM/NSM foundation, `ACCEPTED`
  2026-07-18) already exists. ADR numbers are per-repository, never suite-global — which is why
  `INV-16` requires repository-qualified citation, matching `cybrik-suite:CLAUDE.md`.
- **Number collision within SOC.** Number 0016 was claimed by three unmerged branches, and
  `…/ADR-0016-sovereign-airgapped-ai-copilot.md` documents the collision explicitly. A worktree
  artifact can therefore carry a different ADR under the same number — which is why `INV-16`
  requires resolution against committed `main` bytes.
- **Qualifier loss.** `cybrik-suite:docs/adr/README.md` is authoritative on suite ADR status and
  carries qualifiers (`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`, *decision only*) that a bare
  "ACCEPTED" drops — which is why `INV-16` requires the qualifier to travel with the citation.

---

## 2. Problem

Four failures are visible in the record, and none is closed by an existing decision.

1. **Priority has no architecture home.** The Founder deployment priority exists only in a derived
   controller state file and derived reports. No suite ADR ratifies it, so nothing structurally
   prevents the next planner from re-deriving a different one.
2. **A provider became "primary" with no authority.** An AWS estate, a hosted-provider matrix and
   a self-declared `"verdict": "ACCEPTED"` platform decision were produced in the derived layer
   from `DRAFT` evidence. No Founder record authorized any of it.
3. **Candidate sets silently excluded the actual priorities.**
   `soc-production-infrastructure:plans/PRODUCTION_HOST_PROVIDER_MATRIX.json` evaluates exactly
   four candidates — Hetzner Cloud, DigitalOcean, Linode/Akamai, AWS EC2 — every one of them a
   hosted/foreign public provider. A scan for `on-prem`, `private cloud`, `bare-metal`, `colo`,
   `Proxmox`, `VMware`, `OpenStack` in that file returns **zero** matches. The matrix correctly
   labels itself `ADVISORY_ONLY_NON_BINDING`; the defect is the **omission**, which makes an
   advisory ranking structurally incapable of recommending P1 or P2.
4. **Sovereignty, isolation and portability requirements are scattered and differently qualified.**
   They live across an accepted suite ADR, a partly-accepted SOC ADR, a direction-accepted SOC ADR,
   two proposed SOC ADRs, and several `[PROPOSAL]` / `DRAFT` strategy and evidence documents. There
   is no single place that states which of them bind, at what strength, and what remains open.

This ADR fixes (1)–(3) by establishing authority rules, and fixes (4) by consolidating — without
promoting any proposal into authority merely because its content agrees with current policy.

---

## 3. Decision

On acceptance, the following ten decisions become binding. Each is elaborated in its own section
below.

### Decision A — Deployment priority

`FOUNDER_POLICY` + `ARCHITECTURAL_INVARIANT`.

```
P1 = ON_PREMISE
P2 = PRIVATE_CLOUD
P3 = SOVEREIGN_CONTROLLED_CROSS_DOMAIN_OR_OPTIONAL_HYBRID
FOREIGN_PUBLIC_CLOUD = DEFERRED_OPTIONAL_DEPLOYMENT_PROFILE
```

- P1 and P2 MUST be supported deployment profiles for any release that claims general
  availability of the product.
- Foreign public cloud MUST NOT become a release dependency, a core dependency, a CI-gating
  dependency, or a precondition for qualifying P1 or P2.
- No artifact MAY describe a foreign-public-cloud deployment as "the production architecture",
  "primary", or "the target" without a separately accepted ADR that says so.

### Decision B — Provider-neutral core

`ARCHITECTURAL_INVARIANT`.

- Product core MUST remain provider-neutral.
- A mandatory provider SDK or provider-specific service identifier MUST NOT enter the core runtime
  contract without a separately accepted architecture decision.
- Protocol-compatible libraries ARE allowed where the protocol itself is portable, and a library's
  vendor origin alone MUST NOT be treated as an infrastructure dependency.

### Decision C — Customer-controlled data plane

`ARCHITECTURAL_INVARIANT`.

Every primary supported deployment profile (P1, P2) MUST be able to keep the enumerated data
classes (§7) inside customer-controlled infrastructure. Any external transmission MUST be
explicit, policy-controlled, and separately classified.

### Decision D — AI sovereignty

`ARCHITECTURAL_INVARIANT`.

Local/private AI MUST remain supported with no mandatory public-cloud LLM. The current
implementation status is described exactly as it is (§7.3), including one `OPEN_QUESTION`.

### Decision E — Platform contract boundary

`ARCHITECTURAL_INVARIANT`.

Four layers are defined (§5). The top **product layer** has two distinguished parts —
`PRODUCT_CORE` (domain logic, authority logic, security invariants and portable contracts, behind
explicit ports) and `PRODUCT_IMPLEMENTATION_ADAPTER` (portable realizations of those ports, which
MAY hold concrete protocol/runtime/storage knowledge). Below it sit `PLATFORM_CONTRACT`,
`DEPLOYMENT_PROFILE` and `PROVIDER_ADAPTER`. The Platform Contract MUST be capability-based and MUST
NOT name vendors, and the normative conformance subject is the `VERSIONED_DEPLOYMENT_PROFILE`
(§5.3).

### Decision F — Isolation semantics

`ARCHITECTURAL_INVARIANT`.

Accepted ADR-0005 isolation requirements are preserved. A `VERSIONED_DEPLOYMENT_PROFILE` MUST NOT
be selected that cannot meet the isolation required by the risk classes it admits, and a provider
adapter MUST NOT declare support for a `VERSIONED_DEPLOYMENT_PROFILE` whose **mandatory** isolation
capabilities it cannot satisfy. Optional capabilities are not required of every optional adapter.

The conformance subject is the `VERSIONED_DEPLOYMENT_PROFILE`, never `T0`/`T1`/`T2` — those tokens
carry no executable conformance meaning until the canonical tier contract is accepted (§6.2).

### Decision G — Deployment profile / tier semantics

`ARCHITECTURAL_INVARIANT` + `OPEN_QUESTION` — a compound item (§0). The two halves are separated so
neither borrows force from the other:

**Binding half** (`ARCHITECTURAL_INVARIANT`, recorded as `INV-15` and `INV-17` in §4): `T0`/`T1`/`T2`
have no executable conformance meaning, MUST NOT be used as a normative conformance target, and the
normative conformance subject is the `VERSIONED_DEPLOYMENT_PROFILE` defined in §5.3.

**Open half** (`OPEN_QUESTION` — `CANONICAL_T0_T1_T2_SEMANTICS = OPEN`): what the tokens should
canonically mean is not decided here and is not decided by this ADR's acceptance. At least four
incompatible in-repository usages exist across two orthogonal axes (§6.2). Resolving them requires
one versioned tier contract, produced as separate bounded work.

### Decision H — Provider adapter governance

`ARCHITECTURAL_INVARIANT`.

Every deployment/provider adapter MUST satisfy the versioned mandatory baseline of every
`VERSIONED_DEPLOYMENT_PROFILE` it declares support for. Provider-specific capabilities MUST be
namespaced, optional, and capability-advertised, and MUST NOT alter data-sovereignty, authority,
isolation or artifact-integrity semantics (§8).

A declaration of support names a `VERSIONED_DEPLOYMENT_PROFILE` identifier and version. An adapter
MUST NOT declare support against a tier name, because no accepted contract gives `T0`/`T1`/`T2` a
conformance meaning (§6.2).

### Decision I — Provider selection authority

`ARCHITECTURAL_INVARIANT`.

A controller MAY produce advisory provider matrices. It MUST NOT freeze a provider as primary
architecture without explicit Founder or delegated authority, and any provider-selection record
MUST carry the eight fields in §9.1. Candidate sets MUST NOT omit P1/P2 (§9.2).

### Decision J — No synthesized mandatory requirements

`ARCHITECTURAL_INVARIANT`.

A planner or controller MUST NOT manufacture a mandatory requirement by selecting a
provider-native managed service. Every mandatory architecture requirement MUST trace to one of
at least one valid authority source, with all known applicable supporting sources recorded;
anything untraceable remains `ADVISORY`, `CANDIDATE` or `OPEN` (§10.3).

---

## 4. Normative Invariants

Consolidated, numbered for citation. All are `ARCHITECTURAL_INVARIANT` and all are inert until
this ADR is accepted.

| # | Invariant |
|---|---|
| `INV-1` | Product core MUST remain provider-neutral (Decision B) |
| `INV-2` | Foreign public cloud MUST NOT be a release, core, or CI-gating dependency (Decision A) |
| `INV-3` | P1 and P2 MUST keep every §7.1 data class inside customer-controlled infrastructure (Decision C) |
| `INV-4` | Every external transmission MUST be explicit, policy-controlled and separately classified (Decision C) |
| `INV-5` | A mandatory public-cloud LLM MUST NOT be required by any supported profile (Decision D) |
| `INV-6` | The Platform Contract MUST be capability-based and MUST NOT name vendors (Decision E) |
| `INV-7` | A profile MUST NOT be selected that cannot meet the isolation required by the risk classes it admits (Decision F) |
| `INV-8` | An adapter MUST NOT declare support for a `VERSIONED_DEPLOYMENT_PROFILE` whose **mandatory** capabilities it cannot satisfy (Decisions F, H) |
| `INV-9` | Optional capabilities MUST NOT be required of every optional provider adapter (Decisions F, H) |
| `INV-10` | Provider-specific capability names MUST be namespaced and capability-advertised (Decision H) |
| `INV-11` | A provider adapter MUST NOT weaken sovereignty, authority, isolation or artifact-integrity semantics (Decision H) |
| `INV-12` | A controller MUST NOT freeze a provider as primary architecture without explicit authority (Decision I) |
| `INV-13` | A provider candidate set MUST include the P1/P2 deployment priorities (Decision I) |
| `INV-14` | Every mandatory architecture requirement MUST trace to **at least one** valid authority source in §10.3, and **all** known applicable supporting authority sources MUST be recorded (Decision J) |
| `INV-15` | `T0`/`T1`/`T2` have **no executable conformance meaning** until the canonical tier contract is accepted, and MUST NOT be used as a normative conformance target (Decision G) |
| `INV-16` | Status citations MUST carry the source ADR's own qualifier and MUST NOT cite `PROPOSED` material as `ACCEPTED`; every ADR citation MUST be repository-qualified (ADR numbers are per-repository, never suite-global) and MUST resolve against committed `main` bytes rather than a worktree artifact (§1.5) |
| `INV-17` | The normative conformance subject MUST be a `VERSIONED_DEPLOYMENT_PROFILE` carrying identifier, version, capability set and per-capability strength (§5.3) |
| `INV-18` | Where Vietnamese legal interpretation bears on a deployment choice it MUST be marked `LEGAL_REVIEW_REQUIRED`, routed to legal review, and recorded separately from the architecture record (§7.2) |
| `INV-19` | No artifact MAY assert that S3-compatible systems are interchangeable; the required storage subset MUST be fixed by a versioned contract before portability beyond the proven path is claimed (§14.1) |
| `INV-20` | The four maturity states MUST be kept distinct, and `TESTED`/`QUALIFIED` MUST NOT be asserted retroactively, by inference, or by association (§7.4) |
| `INV-21` | A whole repository MUST NOT be classified as `PRODUCT_CORE`; `PRODUCT_CORE` and `PRODUCT_IMPLEMENTATION_ADAPTER` MUST be distinguished within a product repository, and an implementation adapter MUST NOT make a provider-specific infrastructure service mandatory to the domain/core contract (§5.1) |
| `INV-22` | Every material source supporting a binding conclusion MUST be `COMMIT_BOUND_REPRODUCIBLE` — pinned to an exact Git commit or tag object, never to a mutable ref such as `HEAD` (§16.1) |

---

## 5. Architecture Layers

`ARCHITECTURAL_INVARIANT` (Decision E).

Four layers. The top layer has **two parts**, and conflating them was the defect R1 carried: a
product repository is not uniformly substrate-unaware.

```
┌─ PRODUCT LAYER ──────────────────────────────────────────────────────────────┐
│ PRODUCT_CORE                  domain logic, authority logic, security        │
│                               invariants, portable business/application      │
│                               contracts — expressed behind explicit ports.   │
│                               Knows no provider and no substrate.            │
│ ── ports ────────────────────────────────────────────────────────────────    │
│ PRODUCT_IMPLEMENTATION_       portable realizations of those ports. MAY hold  │
│ ADAPTER                       concrete protocol/runtime/storage knowledge     │
│                               (S3 protocol, OpenAI-compatible HTTP,           │
│                               PostgreSQL wire). Provider-portable by          │
│                               construction. Ships with the product.           │
├──────────────────────────────────────────────────────────────────────────────┤
│ PLATFORM_CONTRACT             capability-based, versioned, vendor-free.      │
│                               "what a platform must be able to do", not who. │
├──────────────────────────────────────────────────────────────────────────────┤
│ DEPLOYMENT_PROFILE            a named, VERSIONED_DEPLOYMENT_PROFILE bundling │
│                               Platform Contract capabilities at stated       │
│                               MANDATORY / OPTIONAL strength.                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ PROVIDER_ADAPTER              one concrete infrastructure realization;       │
│                               OPTIONAL_PROFILE by default.                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Why the split is required.** Accepted `cybrik-suite` ADR-0002 already decided that concrete
implementation lives inside the products: `G3` accepts *"a thin CYBRIK-owned OpenAI-compatible
adapter"* presenting one seam over Ollama, vLLM and llama.cpp; `G4` accepts *"one PostgreSQL +
pgvector"*; `G5` makes any agent SDK *"a replaceable library rather than the contract or authority
core"*. Its Consequences state that *"CYBRIK owns the stable model and orchestration seams; model
runtimes and agent SDKs remain replaceable behind those seams."* A model in which whole product
repositories are substrate-unaware `PRODUCT_CORE` contradicts an accepted ADR. The corrected model
matches it: the **seam** is core, the **realization behind the seam** is a
`PRODUCT_IMPLEMENTATION_ADAPTER`.

### 5.1 Layer rules

- `PRODUCT_CORE` is **not a repository**; it is the domain-logic, authority-logic,
  security-invariant and portable-contract subset **within** a product repository, reached only
  through explicit ports. It MUST NOT import, reference or branch on a provider identity, a
  provider service name, or a substrate identity. A whole repository MUST NOT be classified as
  `PRODUCT_CORE` (`INV-21`).
- A `PRODUCT_IMPLEMENTATION_ADAPTER` realizes a `PRODUCT_CORE` port. It **MAY** contain concrete
  protocol, runtime and storage implementation knowledge, and it **MUST** remain provider-portable:
  the protocol it speaks must be satisfiable by more than one deployment without changing the core
  contract. It **MUST NOT** make a provider-specific infrastructure service mandatory to the
  domain/core contract, and it **MUST NOT** leak a provider identity through a port signature.
- The worked example is `cybrik-soc-command-center:ops/pf-workers/pf_workers/s3util.py`: an S3
  protocol client, concrete about SigV4 and path-style addressing, pointed at self-hosted SeaweedFS
  through a configured `endpoint_url`. Concrete, and portable. That is exactly a
  `PRODUCT_IMPLEMENTATION_ADAPTER` — not `PRODUCT_CORE`, and not a `PROVIDER_ADAPTER`.
- `PROVIDER_ADAPTER` differs from `PRODUCT_IMPLEMENTATION_ADAPTER` by **what it binds**: the former
  binds a Platform Contract capability to one concrete *infrastructure/provider* realization and is
  an `OPTIONAL_PROFILE`; the latter binds a product port to a *portable protocol* and ships with the
  product.
- `PLATFORM_CONTRACT` MUST express requirements as **capabilities with observable semantics**
  (behaviour, failure mode, guarantee), never as a product name.
- A `VERSIONED_DEPLOYMENT_PROFILE` MUST declare, per capability, whether it is `MANDATORY` or
  `OPTIONAL` for that profile, and MUST carry a profile identifier and version.
- A `PROVIDER_ADAPTER` MUST advertise the capability set it satisfies and MUST fail closed rather
  than silently degrade a capability it cannot provide.
- Dependencies point **downward only**: core → (port) → implementation adapter → contract → profile
  → provider adapter. No lower layer MAY introduce a requirement upward into the core contract.

### 5.2 Platform Contract capability slots

`ARCHITECTURAL_INVARIANT` for the *slot list*; `OPEN_QUESTION` for every slot's detailed
semantics. **No vendor is selected here, and none may be inferred from this list.**

| # | Capability slot | What the contract must eventually fix (not fixed here) |
|---|---|---|
| 1 | OCI / container runtime | image format, rootless posture, verification at load |
| 2 | Isolation substrate | the isolation classes of ADR-0005 and their observable guarantees |
| 3 | Orchestration capability | scheduling, lifecycle, health, rollout/rollback semantics |
| 4 | Network segmentation | default-deny posture, segment boundaries, egress mediation |
| 5 | Storage | durability, integrity, retention, immutability semantics |
| 6 | Database | transaction, isolation-level, backup/restore and RLS-compatible semantics |
| 7 | Cache | consistency and eviction semantics relied on by the core |
| 8 | Secrets | storage, rotation, non-exfiltration, startup-presence validation |
| 9 | Crypto | pluggable provider seam with a stable interface (the requirement raised, still `PROPOSED`, in SOC ADR-0018) |
| 10 | Identity / workload identity | the E2/E3 two-layer trust seam of suite ADR-0006 (`ACCEPTED`) and ADR-0008 (`ACCEPTED FOR IMPLEMENTATION`, v0.1.0, not stable v1/GA) |
| 11 | Observability | trace/metric/log semantics and their sovereignty classification (§7.1) |
| 12 | AI / model runtime | local/private inference, egress posture, model provenance |
| 13 | Artifact / update mechanism | signed bundles, offline install/update, trust root, rollback |

Slots 1–13 are the **minimum**. A later Platform Contract MAY add slots; it MUST NOT silently drop
one.

### 5.3 `VERSIONED_DEPLOYMENT_PROFILE` — the normative conformance subject

`ARCHITECTURAL_INVARIANT` (`INV-17`).

Because no accepted contract gives `T0`/`T1`/`T2` a conformance meaning (§6.2), this ADR needs a
conformance subject that exists independently of the unresolved tier vocabulary. That subject is the
`VERSIONED_DEPLOYMENT_PROFILE`.

A `VERSIONED_DEPLOYMENT_PROFILE` is a record that MUST carry:

| Field | Meaning |
|---|---|
| profile identifier | a stable name that is **not** a tier token |
| profile version | so conformance is asserted against exact semantics |
| capability set | which Platform Contract slots are in scope |
| strength per capability | `MANDATORY` or `OPTIONAL`, stated per capability |
| sovereignty class | which §7.1 data classes the profile keeps customer-controlled |
| isolation floor | the ADR-0005 isolation classes the profile admits |

Every conformance statement in this ADR — Decisions F, H and I, and `INV-7` … `INV-13` — takes a
`VERSIONED_DEPLOYMENT_PROFILE` as its subject. No profile exists yet; defining the first ones is
part of the Platform Contract work (`OPEN-10`). Until one exists, no adapter can validly declare
support for anything, which is the intended fail-closed position.

---

## 6. Deployment Priority

### 6.1 The ordering

`FOUNDER_POLICY` (new 2026-08-23) — see Decision A for the normative text.

| Priority | Profile | Status |
|---|---|---|
| **P1** | `ON_PREMISE` | Primary. MUST be a supported profile |
| **P2** | `PRIVATE_CLOUD` | Primary. MUST be a supported profile |
| **P3** | `SOVEREIGN_CONTROLLED_CROSS_DOMAIN_OR_OPTIONAL_HYBRID` | Supported composition, per §6.3 |
| — | `FOREIGN_PUBLIC_CLOUD` | `DEFERRED_OPTIONAL_DEPLOYMENT_PROFILE` — `OPTIONAL_PROFILE` |

### 6.2 Tier vocabulary — RESERVED, not defined here

`OPEN_QUESTION` — `CANONICAL_T0_T1_T2_SEMANTICS = OPEN` (Decision G).

The evidence does **not** support consolidating the vocabulary now. At least four in-repository
usages exist, on two orthogonal axes:

| # | Usage | Axis | Source and status |
|---|---|---|---|
| 1 | T0 Developer/POC · T1 Enterprise (3+ nodes **or** conformant Kubernetes) · T2 Sovereign/Air-gap | substrate + trust boundary | `cybrik-suite:docs/strategy/03-REFERENCE-ARCHITECTURE.md` §10 — document status `[PROPOSAL]` |
| 2 | T0 single host/Compose · T1 **conformant Kubernetes** · T2 sovereign/air-gap | substrate (narrower T1 than #1) | `cybrik-suite:docs/adr/evidence/ADR-0005-EVIDENCE.md`, `…/ADR-0004-EVIDENCE.md` — both `DRAFT` |
| 3 | T0 demo/dev ≤2k EPS · T1 3-broker cluster 10–50k EPS · T2 = T1 scaled, 50k sustained/100k burst | **throughput/capacity** | `cybrik-soc-command-center:docs/architecture/DATA-PLANE-V2.md` §4, cited by SOC ADR-0021 |
| 4 | `architecture_tier: "T0"` = hardened Linux container host, "scales deterministically to T1 Kubernetes"; `RECOMMENDED_CANDIDATE_FOR_T0` / `HIGHER_COMPLEXITY_T1_FOUNDATION` applied to hosted VPS providers | derived platform + provider sizing | `soc-production-infrastructure:architecture/PRODUCTION_PLATFORM_DECISION.json`, `…:plans/PRODUCTION_HOST_PROVIDER_MATRIX.json` — derived layer |

Usages #1/#2 and #3 are **not reconcilable by naming alone**: under #1 a T2 deployment is defined
by its trust boundary (air-gap), while under #3 a T2 deployment is defined by throughput. A
sovereign air-gapped site running at 1k EPS is simultaneously "T2" under #1 and "T0" under #3.
`cybrik-soc-command-center:docs/operations/T1-BRINGUP-EVIDENCE-2026-07-22.md` shows the collision
concretely: the file `deploy/pf/docker-compose.t1.yml` is recorded as carrying *production T2
sizing*.

Accepted suite ADR-0005 answer `J7` **uses** the labels (Kata `RuntimeClass` at T1/T2, direct
Firecracker + jailer at T0) without defining them. Every definition of the labels sits in a document
that is itself not accepted: `cybrik-suite:docs/strategy/03-REFERENCE-ARCHITECTURE.md` carries
`Trạng thái: [PROPOSAL]` in its own header, and the two evidence files are `DRAFT` per the
authoritative catalog `cybrik-suite:docs/adr/README.md`. Both facts are reproducible from the
committed tree at `BASE_SHA d2b5c7fe799beb94b1dcf0661350de10417da0a3`. So an accepted ADR depends on
a vocabulary whose only definitions sit in `[PROPOSAL]` and `DRAFT` documents.

`NON_AUTHORITATIVE_CONTEXT_ONLY` (§0) — a further observation, retained because it is useful and
load-bearing on nothing: an operations file `docs/operations/W0-RECOVERY-WAVE-2-EVIDENCE.md`
exists **untracked** in the canonical `cybrik-suite` checkout and states *"Suite T0/T1/T2 profiles
remain proposals."* It is absent from the committed tree at `BASE_SHA`, is therefore not
reproducible from repository identity, and is **not** cited as proof of anything in this ADR. It
corroborates the committed evidence above; it does not carry it. R1 wrongly used it as an
authoritative source, and this correction removes that dependency rather than committing an
unrelated file to satisfy the citation.

**T0/T1/T2 has no executable conformance meaning until the canonical tier contract is accepted**
(`INV-15`, §4). Consequently:

- This ADR **reserves** `T0`/`T1`/`T2` as suite tier tokens and defines none of them.
- The normative conformance subject used throughout this ADR is `VERSIONED_DEPLOYMENT_PROFILE`
  (§5.3), never a tier name.
- The binding rules are `INV-15` and `INV-17` in §4. This section states what is unresolved; it
  creates no requirement of its own.
- Existing documents using `T0`/`T1`/`T2` keep them as dated evidence and context. Nothing is
  rewritten, and no such usage becomes a conformance target by being quoted here.

### 6.3 P3 terminology — cross-domain exchange is not "Hybrid Cloud"

`ARCHITECTURAL_INVARIANT`.

- `SOVEREIGN_CONTROLLED_CROSS_DOMAIN_EXCHANGE` is the preferred term for guarded/diode
  trust-domain exchange of the kind modelled by SOC ADR-0017 (`ACCEPTED` as to direction; devices,
  cost and sprint open). It denotes a controlled boundary between trust domains, which need not
  involve any cloud at all — ADR-0017's own channel is a dedicated state network (MTSLCD),
  explicitly *not* the internet.
- `HYBRID_CLOUD` MUST mean an actual deployment **composition** spanning private and public/cloud
  environments.
- These two MUST NOT be used as synonyms. Calling a diode/guard boundary "hybrid cloud" imports a
  public-cloud dependency into a sovereignty control, which is the exact drift this ADR blocks.

---

## 7. Data Sovereignty

### 7.1 Data classes that MUST stay customer-controlled

`ARCHITECTURAL_INVARIANT` (Decision C). For P1 and P2, at minimum:

| Class | Notes |
|---|---|
| Alerts | Includes raw and normalized event payloads |
| Cases | Includes case narrative, timeline, disposition |
| Tenant data | Tenant registry, membership, org hierarchy, scope grants |
| Identity / session | Credentials, tokens, refresh families, delegation chains |
| Audit | Immutable audit and custody records |
| AI prompts / context | Prompt text, retrieved context, tool arguments and results |
| Investigation evidence | Bundles, claims, checkpoints, attachments |
| Tool / Fabric receipts | **When implemented.** No receipt-producing runtime exists today (§7.4) |
| Backups | Including snapshots, exports and DR copies |
| Secrets | Including key material, trust bundles, signing keys |
| Operational telemetry | Traces, metrics, logs — including anything derived from the classes above |

Any transmission of any of these outside customer-controlled infrastructure MUST be:

1. **explicit** — declared in a profile, never implicit in a library default or an SDK fallback;
2. **policy-controlled** — subject to a policy decision the operator can inspect and deny;
3. **separately classified** — recorded with its data class, destination trust domain, and legal
   basis, and MUST NOT be introduced by an adapter (`INV-11`).

A concrete instance requiring classification under this rule already exists in the derived layer:
`soc-production-infrastructure:architecture/PRODUCTION_PLATFORM_DECISION.json` declares
`edge_proxy_and_dns: "CLOUDFLARE_EDGE_DNS_AND_TLS_TERMINATION"`, and the Terraform estate declares
`provider "cloudflare"`. Terminating TLS at a third-party edge places request content outside the
customer trust boundary. This ADR does **not** adjudicate that arrangement; it records that any
profile carrying it MUST classify it under this section before that profile may be called P1 or P2.

### 7.2 Legal boundary

`OPEN_QUESTION` — `LEGAL_REVIEW_REQUIRED`.

The binding rule is `INV-18` in §4: legal touchpoints are marked `LEGAL_REVIEW_REQUIRED`, routed to
legal review, and recorded separately from the architecture record. This section adds no requirement
of its own; it records what is unresolved and where.

This ADR makes an **architectural and product-priority** decision. It makes **no legal judgment**,
and nothing in it states or implies that public cloud is unlawful.

Instances already routed to legal review, none of them re-decided here:

- data-sharing obligations to A05 and the MTSLCD channel (`cybrik-soc-command-center` ADR-0017);
- state-cipher obligations under the 2011 Cipher Law for classified data
  (`cybrik-soc-command-center` ADR-0018 — status `PROPOSED`);
- distribution-licence clearance (`cybrik-soc-command-center:docs/licensing/LEGAL-REVIEW-QD14-DOSSIER.md`,
  recorded as awaiting final legal counter-signature).

Keeping technical-architecture conclusions and legal conclusions in separate records is the binding
part, and it lives in `INV-18`. The legal interpretations themselves remain unresolved (`OPEN-9`).

### 7.3 AI sovereignty — current implementation status, stated exactly

`ARCHITECTURAL_INVARIANT` (Decision D) plus a precise status statement.

**What is true today, from source:**

- The primary runtime path does **not** support a public LLM. The model-seam guard in
  `cybrik-cyber-ai-platform:packages/ai-core/src/cybrik_ai_core/security/egress.py` treats the base
  URL as *"trusted server config only, never request-derived"*, requires an allowlisted host
  (default: loopback only), requires that **every** resolved address be loopback/link-local/private,
  disallows redirects, and fails closed. Its own comment states that a hosted/cloud provider is
  refused and that relaxing this is a distinct Founder decision. The SOC copilot applies the same
  posture in `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/copilot/llm.py`
  (`validate_llm_base_url`), rejecting a base URL that resolves to a public address on sovereignty
  grounds.
- **The guard is a strong control, not an absolute one.** `OPEN_QUESTION` —
  `AI_DNS_TOCTOU_EGRESS_GUARD = OPEN`. Both guards resolve the host at **validation** time and the
  request is then issued against the **hostname**, so the connection re-resolves; the validated
  address is not pinned to the socket. A validate-then-connect window therefore exists. The same
  pattern appears in `cybrik-soc-command-center:services/api/src/cybrik_soc/platform/outbound.py`,
  whose docstring claims *"connect toi chinh IP da resolve"* (connect to the resolved IP itself — the source file is written in unaccented Vietnamese and is quoted verbatim)
  while `guarded_get` issues the request against the original hostname URL — the claim is stronger
  than the implementation. Closing this window (address pinning, a pinned/injected resolver at the
  transport, or an equivalent) is an open hardening decision.
- **The two guards are not symmetric on resolver injection**, and R1 overstated this. Verified:
  `cybrik-cyber-ai-platform:packages/ai-core/src/cybrik_ai_core/security/egress.py` takes an
  injected `resolver: Resolver = _default_resolver` parameter, so an air-gapped deployment or a test
  can pin resolution — a seam for a fix exists there. `cybrik-soc-command-center:services/api/src/
  cybrik_soc/modules/copilot/llm.py` calls `socket.getaddrinfo(host, port)` directly inside its
  internal-only check and exposes **no injection point**; a fix there requires a code change, not
  configuration.
- **No exploitability is claimed or demonstrated.** What is established from source is structural:
  validation resolves an address, the transport is then given the hostname, and the validated
  address is not pinned to the socket. Whether that window is reachable in any deployed
  configuration has not been tested, and this ADR asserts nothing about it.

**Normative:**

- A supported deployment profile MUST NOT require a public-cloud LLM (`INV-5`).
- No document MAY describe these guards as mathematically absolute, or as closing DNS rebinding,
  while `AI_DNS_TOCTOU_EGRESS_GUARD` is `OPEN`.
- SOC ADR-0016 MUST be cited with its `ACCEPTED IN PART` qualifier, and MUST NOT be cited as
  evidence that air-gap is built (its own §S7 states the air-gap/diode/GPU parts are design or V2).

### 7.4 Claim discipline — the four maturity states

`ARCHITECTURAL_INVARIANT` (`INV-20`). Four **independent** states MUST be kept distinct in every
artifact. They are not a ladder that can be climbed by assertion: each state requires its own
evidence, and none implies the next.

| State | Requires | Explicitly does **not** imply |
|---|---|---|
| `ARCHITECTURAL_REQUIREMENT` | A decision record fixing the requirement as policy | That anything is built |
| `IMPLEMENTED` | Code exists in a committed tree and runs | That it is `TESTED` — code that no test exercises is `IMPLEMENTED` and nothing more |
| `TESTED` | A committed, runnable test exercises the behaviour, with its scope stated (unit / integration / skipped-by-default / conditional) | That it is `QUALIFIED` — a passing unit test is not a qualification |
| `QUALIFIED` | The **applicable authoritative qualification procedure** was executed end to end under the required conditions, with retained evidence | Anything beyond the exact scope qualified |

An item MUST NOT be marked `TESTED` or `QUALIFIED` retroactively, by inference, or by association
with a neighbouring item. A test that is skipped when its dependency is unreachable MUST be recorded
as **conditionally** `TESTED`, with the skip condition named.

Applied to the areas this ADR touches:

| Area | `ARCHITECTURAL_REQUIREMENT` | `IMPLEMENTED` | `TESTED` | `QUALIFIED` |
|---|---|---|---|---|
| Offline install / update | **Yes** | **Partial** — bounded seams only | **Partial** — bounded seams only | **No** |
| Isolation (ADR-0005 profiles) | **Yes**, at ADR-0005's stated strength | **No** | **No** | **No** |
| AI egress guard (sovereignty) | **Yes** | **Yes** — both guards | **Partial** — validation policy only | **No** |
| Storage / S3 compatibility | **Yes** | **Yes** — one bounded SeaweedFS path | **Conditional** — see below | **No** |

- **Offline / air-gap.** `FULL_AIR_GAP_PRODUCTION_QUALIFIED` MUST NOT be claimed. `IMPLEMENTED` and
  `TESTED` are both **partial and bounded**: `cybrik-security-tool-fabric:tests/control-plane/
  test_offline_no_network.py` is a committed no-network contract test, and
  `cybrik-cyber-ai-platform:.github/workflows/ci.yml` carries a lock/offline build path. Both are
  build- and contract-scoped seams, not an install/update path. `QUALIFIED` is **no**: the committed
  `cybrik-suite:contracts/` tree at `BASE_SHA` holds 386 files and **none** of them is an offline
  install, update, upgrade/rollback, update-station or operator-trust-root contract, and no accepted
  suite ADR records such a qualification. The requirement itself is accepted — `cybrik-suite`
  ADR-0001 states that air-gapped deliveries reference bundles only, ADR-0002 requires the stack to
  remain local/air-gap capable, and ADR-0008 requires fail-closed behaviour when trust cannot be
  resolved offline. See `OPEN-1`.
- **Isolation (ADR-0005).** `gVisor`/`runsc`, `Firecracker`, `jailer`, `KVM`, Kata `RuntimeClass`
  and the control-side egress broker are **accepted architectural/isolation requirements** at
  ADR-0005's own stated strength — *"decision only"*. ADR-0005 states in its own bytes that *"No
  sandbox driver, isolation runtime, egress broker, benchmark or escape test exists or has been run
  in any product repository, and none is claimed here."* A scan of the committed trees confirms no
  sandbox/isolation runtime test exists in any repository. `IMPLEMENTED`, `TESTED` and `QUALIFIED`
  are therefore all **no**, and no profile MAY be described otherwise. Its `J10`
  kernel/hardware/profile/version pins remain deferred to a spike that has not run.
- **AI egress guard.** `IMPLEMENTED` in both products. `TESTED` covers the **validation policy
  only** — `cybrik-cyber-ai-platform:tests/ai_core/test_security.py` exercises scheme rejection,
  allowlist rejection, public-resolution rejection, empty-resolution and resolver-error wrapping,
  and `cybrik-soc-command-center:services/api/tests/unit/test_llm_adapter.py` exercises the SOC
  guard. **No test covers connect-time address pinning**, which is precisely the open item
  (`OPEN-3`). `QUALIFIED` is **no**.
- **Storage / S3 compatibility.** `TESTED` is **conditional**:
  `cybrik-soc-command-center:ops/pf-workers/tests/test_parquet_archiver.py` runs pure-unit coverage
  (schema stability, partition keys, dedup, round-trip, compression) unconditionally, but its S3
  section calls `list_buckets()` first and **skips when no cluster answers**, so the object-store
  path is exercised only when a SeaweedFS cluster is reachable. `QUALIFIED` is **no**. See §14.1 /
  `OPEN-2`.

---

## 8. Provider Adapter Governance

`ARCHITECTURAL_INVARIANT` (Decision H).

### 8.1 The baseline rule

Every deployment/provider adapter MUST satisfy the **versioned mandatory baseline of every
`VERSIONED_DEPLOYMENT_PROFILE` it declares support for**. A declaration of support is a conformance
assertion against a profile identifier and version, not a label — and never against a tier name,
which has no executable conformance meaning (§6.2).

### 8.2 Provider-specific capabilities

A provider-specific capability:

- MUST be **namespaced** (a provider-scoped identifier that cannot collide with a contract
  capability name);
- MUST be **optional** unless a separately accepted decision makes it mandatory;
- MUST be **capability-advertised**, so the core discovers it rather than assuming it;
- MUST NOT alter mandatory data-sovereignty semantics;
- MUST NOT alter authority semantics (who may decide, approve, delegate or sign);
- MUST NOT weaken isolation semantics;
- MUST NOT weaken artifact-integrity semantics;
- MUST NOT become a core requirement without a separately accepted versioned contract or ADR.

### 8.3 Symmetry rule — no over-reach in either direction

- An adapter MUST NOT declare support for a `VERSIONED_DEPLOYMENT_PROFILE` whose **mandatory**
  capabilities it cannot satisfy (`INV-8`).
- An **optional** provider adapter MUST NOT be required to implement every **optional** capability
  (`INV-9`). Optionality is not a defect, and absence of an optional capability MUST NOT be
  reported as non-conformance.
- Where a provider cannot satisfy a mandatory capability, the adapter MUST fail closed and the
  support declaration MUST be withdrawn — it MUST NOT be satisfied by a weaker substitute presented
  under the same capability name.

### 8.4 Capability negotiation

`OPEN_QUESTION` — `OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION`.

The binding governance rules are §8.2 and §8.3, recorded as `INV-10` and `INV-11` in §4. This
section adds no requirement.

What remains unresolved: the negotiation protocol itself — discovery encoding, version matching,
degradation reporting and conformance-test format. It is delegated to the Platform Contract and is
not specified by this ADR.

---

## 9. Provider Selection Authority

`ARCHITECTURAL_INVARIANT` (Decision I).

### 9.1 What a controller may and may not do

- A controller **MAY** produce advisory provider matrices, cost comparisons and capability
  assessments.
- A controller **MUST NOT** freeze a provider as primary architecture without explicit Founder or
  specifically delegated authority.
- A self-declared verdict in a derived artifact is **not** authority. The existing
  `"verdict": "ACCEPTED"` in `soc-production-infrastructure:architecture/PRODUCTION_PLATFORM_DECISION.json`
  is therefore `NON_AUTHORITATIVE` and MUST be treated as advisory input only.

Any future provider selection MUST identify all eight of:

| # | Field | Meaning |
|---|---|---|
| 1 | authority record | the Founder or delegated decision that authorizes the selection |
| 2 | deployment profile | which profile the selection applies to |
| 3 | required capabilities | the mandatory Platform Contract capabilities in scope |
| 4 | candidate set | every candidate considered, including those rejected |
| 5 | decision criteria | the criteria and their weights, fixed before scoring |
| 6 | evidence | the measurements or facts behind each score |
| 7 | scope | what the decision does and does not authorize |
| 8 | binding vs advisory | stated explicitly, not inferred |

### 9.2 Candidate-set completeness

Candidate sets MUST NOT omit the primary deployment priorities merely because managed
public-cloud primitives are easier to compare, cheaper to score, or better documented.

The existing `soc-production-infrastructure:plans/PRODUCTION_HOST_PROVIDER_MATRIX.json` is the
worked negative example: four candidates, all hosted/foreign public
(Hetzner Cloud · DigitalOcean · Linode/Akamai · AWS EC2), zero on-premise, private-cloud or
bare-metal candidates. Under this rule, that candidate set is **incomplete for P1/P2 purposes**
and MUST NOT be used as the basis of any binding selection. Its `ADVISORY_ONLY_NON_BINDING` label
is accurate and is preserved; the artifact is retained as dated provenance.

---

## 10. AWS Drift Disposition

`HISTORICAL_FINDING` + `ARCHITECTURAL_INVARIANT` (Decision A applied).

### 10.1 Disposition

- AWS-primary architecture had **no Founder authority** (`AWS_PRIMARY_FOUNDER_AUTHORITY =
  NOT_FOUND`, corroborated at C1/C2).
- AWS-specific derived architecture is classified:

```
SUPERSEDED_AS_PRIMARY
NON_AUTHORITATIVE
OPTIONAL_REFERENCE_ONLY
```

- Historical artifacts MUST be **retained** for forensic and provenance purposes. This ADR deletes
  nothing, and MUST NOT be executed as a deletion instruction. Concretely retained:
  `soc-production-infrastructure:terraform/**`, `…:helm/**`, `…:council/**`, `…:plans/**`,
  `…:architecture/**`, `…:discovery/**` and `…:QUARANTINE_NOTICE.md`.
- **AWS is not forbidden.** No provider is banned by this ADR. A future AWS deployment adapter MAY
  exist if and only if:
  1. a Founder or customer need justifies it;
  2. it satisfies the applicable Platform Contract and every mandatory capability of the profile it
     claims (§8);
  3. it does not become a release or core dependency (`INV-2`).

### 10.2 What is *not* contaminated

`PRODUCT_CORE_CONTAMINATED = NO`, `RC1_TAG_CONTAMINATED = NO`, `CONTRACTS_CONTAMINATED = NO`.

**Scope of the RC1 statement — corrected.** R1 claimed the only AWS-shaped hits at `v1.0.0-rc1` were
the S3 client and its credential env names. That is false as stated, and the two things it conflated
must stay separated:

| | At `v1.0.0-rc1` |
|---|---|
| **Textual / reference mentions** of `AWS`, `GCP` or `Azure` | **Present**, across roughly twenty `cybrik-suite` files and eighteen `cybrik-soc-command-center` files — architecture documents (`docs/architecture/ENCRYPTION-KEY-MANAGEMENT.md`, `docs/architecture/SIEM-STACK-SOVEREIGNTY-RESEARCH.md`), governance ADRs (SOC ADR-0018, ADR-0019), research documents (`docs/research/SOC-TIER-PERSONA-RESEARCH.md`, `docs/research/GA2-COMPETITIVE-GAP-ANALYSIS.md`), release/evidence records, secret-scanner configuration and contract example payloads |
| **Dependency-bearing runtime/provider requirement** | **Exactly one**, in `cybrik-soc-command-center:ops/pf-workers/`. Zero in `cybrik-suite`, `cybrik-cyber-ai-platform` and `cybrik-security-tool-fabric` |

`RC1_TAG_CONTAMINATED = NO` is therefore a statement about **dependency-bearing runtime paths**, not
a claim of tag-wide absence of cloud-provider text. Comparing sovereign alternatives against named
public clouds in an architecture or research document is the analysis working correctly; it is not
coupling. Verification method for the dependency claim: scan of every `pyproject.toml`,
`package.json`, `requirements*.txt` and `go.mod` tracked at the tag in all four repositories for
provider SDKs (`boto3`, `botocore`, `aws-sdk`, `@aws-*`, `azure-*`, `google-cloud-*`, `oci-sdk`),
plus a scan for provider-SDK imports in tracked Python sources.

The one dependency is worth characterizing permanently, because it is exactly the Decision B
case. `cybrik-soc-command-center:ops/pf-workers/pf_workers/s3util.py` uses `boto3` as an
**S3-protocol client** against self-hosted SeaweedFS: `endpoint_url` is a configured SeaweedFS
address (`PF_SEAWEED_S3_ENDPOINT`, default `http://localhost:8333`), addressing style is forced to
`path` because SeaweedFS does not support virtual-host buckets, and `ops/pf-workers/pyproject.toml`
declares the dependency as *"boto3 -> client S3 SeaweedFS"*. The
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` variables in
`cybrik-soc-command-center:docs/operations/RUNBOOK-S16-LAKE-DUAL-WRITE.md` are the SigV4 credential
env-var **names** the SDK reads, assigned from `PF_SEAWEED_S3_*` values.

There is no AWS endpoint, no AWS account and no AWS service in that path. Under Decision B this
MUST NOT be classified as an AWS infrastructure dependency. A library's vendor origin, an SDK's
env-var naming convention, and a protocol's originating vendor are **not** provider coupling;
provider coupling is a **non-portable endpoint, service or identity requirement**.

### 10.3 Traceability of mandatory requirements

`ARCHITECTURAL_INVARIANT` (Decision J).

A planner or controller MUST NOT manufacture a mandatory requirement merely by selecting
provider-native managed services. Every mandatory architecture requirement MUST trace to **at least
one** of the following, and **all** applicable supporting sources MUST be recorded where known
(`INV-14`). A requirement legitimately supported by several accepted authorities MUST list them
all; recording only one is an incomplete trace, not a compliant one:

1. an **accepted ADR** (cited with its own status qualifier);
2. an **accepted contract**;
3. **Founder authority**;
4. a **binding release requirement**;
5. a **verified implementation constraint** (a constraint demonstrated from code or measurement).

A requirement that traces to none of these remains `ADVISORY`, `CANDIDATE` or `OPEN`. It MUST NOT
be recorded as mandatory, MUST NOT gate a release, and MUST NOT be used to justify a provider
choice.

Worked negative example, retained as provenance:
`soc-production-infrastructure:architecture/PRODUCTION_PLATFORM_DECISION.json` derives a platform
verdict from `cybrik-suite:docs/adr/evidence/ADR-0004-EVIDENCE.md` and `…/ADR-0005-EVIDENCE.md`.
Both are `DRAFT` **evidence** documents, not accepted ADRs (`cybrik-suite:docs/adr/README.md`).
Under this rule that verdict is `ADVISORY`, not mandatory.

---

## 11. Compatibility / Migration Impact

`ARCHITECTURAL_INVARIANT` where marked; otherwise description.

| Area | Impact |
|---|---|
| Product repositories (`cybrik-soc-command-center`, `cybrik-cyber-ai-platform`, `cybrik-security-tool-fabric`) | **None.** These repositories contain both `PRODUCT_CORE` and `PRODUCT_IMPLEMENTATION_ADAPTER` code and are **not** classified wholesale as either (§5.1, `INV-21`). No provider-specific infrastructure service is mandatory to any core contract (§10.2). No code change is required, requested or authorized by this ADR; the per-module classification against the §5.1 boundary is `OPEN-11` |
| `cybrik-suite:contracts/` | **None.** No contract is amended. The packet remains `PROPOSED — NOT ACCEPTED` at v0.1.0 |
| `v1.0.0-rc1` tags | **None.** No re-tag, no re-cut, no re-qualification. `RC1_TAG_CONTAMINATED = NO` |
| Accepted ADRs 0001–0014 | **None.** No status flip, no supersession, no byte change |
| `soc-production-infrastructure` (derived) | **Reclassified, not deleted.** AWS estate becomes `OPTIONAL_REFERENCE_ONLY`; the platform verdict and provider matrix become advisory input (§9, §10) |
| `soc-autonomous-state` (derived controller) | Its recorded policy gains an architecture home. The controller MUST NOT treat this ADR as accepted until the Founder accepts it |
| Documents using `T0`/`T1`/`T2` | **No rewrite.** Tokens are reserved; existing usages remain dated provenance until the tier contract lands (§6.2) |
| `cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` | **New file.** Records the Founder policy durably under the repository's canonical `FOUNDER-DECISION-PACKET-*` convention. Records policy only — accepts no ADR, selects no technology, authorizes no implementation or rollout |
| `cybrik-suite:docs/adr/README.md` (ADR catalog) | **Additive registration only.** One prose paragraph and one table row register ADR-0015 as `PROPOSED`, Decider `FOUNDER`. No existing ADR status is altered, and registration is not acceptance. See §18 |

No migration is required by this ADR. It is a governance consolidation.

---

## 12. Consequences

### If accepted

1. The Founder deployment priority has a single architecture home, and a future planner that
   re-derives a cloud-primary architecture is in violation of a citable invariant rather than in a
   grey area.
2. The four-layer boundary gives every future deployment decision a place to land: capability
   questions to the Platform Contract, bundling questions to a Deployment Profile, vendor questions
   to a Provider Adapter — and none of them to the core.
3. Provider selection becomes an evidenced, authority-bearing act with a fixed eight-field record,
   and incomplete candidate sets are detectable rather than plausible.
4. The AWS estate stops being ambiguous: preserved, reclassified, non-authoritative, and not banned.
5. `boto3`-against-SeaweedFS stops being re-litigated on every audit.

### Costs and risks

1. **Reserving the tier vocabulary has a real cost.** Downstream work that wants to say "T1" must
   either name its axis or wait for the tier contract. This is deliberate: silently freezing one of
   four incompatible meanings would be worse (§6.2).
2. **The Platform Contract is now on the critical path** for anything that wants to claim profile
   conformance. Its 13 slots are declared but unspecified.
3. **Nothing here makes P1 or P2 real.** No on-premise deployment is qualified by this ADR. The
   open items in §14 are the honest gap.
4. **This ADR adds governance overhead** to provider work that previously proceeded unblocked. That
   is the intended trade.

### What acceptance would *not* authorize

Acceptance authorizes **no** implementation, dependency installation, substrate or product
selection, spike, benchmark, provisioning, container/microVM/network start, migration, staging,
deployment, release, GA or production action. Each remains behind its own separate gate, and
production remains Founder-controlled.

---

## 13. Alternatives Considered

| # | Alternative | Why not |
|---|---|---|
| 1 | **Do nothing** — leave the priority in the controller state file | Leaves the exact gap that produced the drift: derived layers self-authorize because no architecture record contradicts them |
| 2 | **Write a technology-selection ADR** — pick the Kubernetes distribution and virtualization product now | Out of scope by construction, and unsupported: `KUBERNETES_PRIMARY_SUBSTRATE = UNDECIDED`, every candidate `NOT_SELECTED`. Selecting now would repeat the drift with a different vendor |
| 3 | **Ban public cloud outright** | Wrong on the facts and wrong in kind. The decision is a product/architecture priority, not a legal or moral prohibition. A banned-forever rule would also block a legitimate future customer-driven adapter |
| 4 | **Delete the AWS estate** | Destroys forensic provenance for the exact drift being corrected, and exceeds this task's scope |
| 5 | **Consolidate the T0/T1/T2 vocabulary now** by adopting the suite `[PROPOSAL]` definitions | Would promote a `[PROPOSAL]`/`DRAFT` definition into authority purely because it is the most-cited one, and would silently invalidate the orthogonal capacity axis in `DATA-PLANE-V2` |
| 6 | **Promote SOC ADR-0018/ADR-0020 into this ADR's authority** because their content aligns with sovereignty policy | Both are `PROPOSED`. Content alignment is not authority. They enter only as a capability slot (§5.2 #9) and as rationale (§8) |
| 7 | **Declare the AI egress guard sufficient** and close the sovereignty question | Overstates the implementation. The validate-then-connect window is real and unclosed (§7.3) |

---

## 14. Open Questions

These MUST survive acceptance. Accepting this ADR does **not** close any of them.

| ID | Question | Status | Where it must be resolved |
|---|---|---|---|
| `OPEN-1` | `OFFLINE_INSTALL_UPDATE_CONTRACT` | **OPEN** | A versioned contract covering signed offline bundles, operator-owned trust root, offline install, upgrade, rollback and update-station workflow. No such contract exists in `cybrik-suite:contracts/` |
| `OPEN-2` | `S3_COMPATIBILITY_MINIMUM_CONTRACT` | **OPEN** | Platform Contract slot 5 (§14.1) |
| `OPEN-3` | `AI_DNS_TOCTOU_EGRESS_GUARD` | **OPEN** | A bounded hardening decision on the model-seam and copilot guards (§7.3) |
| `OPEN-4` | `CANONICAL_T0_T1_T2_SEMANTICS` | **OPEN** — not conclusively resolved by binding evidence (§6.2) | One versioned tier contract |
| `OPEN-5` | `OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION` | Governance rule **decided** here (§8.2/§8.3); detailed protocol **OPEN** | Platform Contract |
| `OPEN-6` | `VIRTUALIZATION_SUBSTRATE_SELECTION` | **OPEN** — VMware/Proxmox/OpenStack all `NOT_SELECTED` | A separate bounded technology-selection decision |
| `OPEN-7` | `KUBERNETES_DISTRIBUTION_SELECTION` | **OPEN** — Kubernetes itself `UNDECIDED`; RKE2/K3s/OpenShift all `NOT_SELECTED` | A separate bounded technology-selection decision |
| `OPEN-8` | `PROVIDER_SELECTION_AUTHORITY_MODEL` — who holds delegated selection authority, and under what bound | **OPEN** | A delegation record; §9 fixes the *record format*, not the *delegate* |
| `OPEN-9` | Legal interpretation of deployment location and cross-domain obligations | **OPEN** — `LEGAL_REVIEW_REQUIRED` | Legal review, recorded separately from architecture (§7.2) |
| `OPEN-10` | Platform Contract slot semantics (all 13 slots, §5.2) | **OPEN** | The Platform Contract itself |
| `OPEN-11` | `PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY` — the **definition** is resolved in §5.1; the **per-module classification** of existing product code against it is not | **OPEN** (definition resolved, classification open) | A bounded per-repository classification pass, owned by each product repository |

### 14.1 `S3_COMPATIBILITY_MINIMUM_CONTRACT` — why `OPEN-2` cannot be closed

`OPEN_QUESTION` (`OPEN-2`). The binding rule — no assertion that S3-compatible systems are
interchangeable, and no portability claim beyond the proven path until a versioned contract fixes
the required subset — is `INV-19` in §4. This section records the evidence and what is unresolved;
it creates no requirement of its own.

Current evidence proves only a **bounded SeaweedFS-compatible path**. From
`cybrik-soc-command-center:ops/pf-workers/`, the surface actually exercised is: `put_object`,
`get_object`, `head_object`, `head_bucket`, `create_bucket`, `delete_objects` and paginated
listing, under SigV4 with **path-style addressing forced** (SeaweedFS does not support
virtual-host buckets), plus a specific error-code mapping (`NoSuchKey`, `NoSuchBucket`, `404`,
`NotFound` treated as absent).

`TESTED` status is **conditional**, not absolute: the archiver's unit coverage runs
unconditionally, but its S3 section calls `list_buckets()` and skips when no cluster answers, so the
object-store path is exercised only against a reachable SeaweedFS (§7.4).

Nothing proves portability beyond that. The subset a future contract has to fix, and whether each
element is mandatory, is exactly what remains open:

- object CRUD
- multipart upload
- presigning
- versioning
- retention
- Object Lock
- error semantics
- authentication semantics
- addressing style

`Object Lock` is the live one: WORM object storage is recorded as a checklist item requiring its
own ADR in `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/forensics/__init__.py`,
and the current evidence store is a filesystem WORM implementation. Whether Object Lock becomes a
mandatory capability of the storage slot is part of `OPEN-2`, and is not decided here.

---

## 15. Non-Goals

This ADR explicitly does **not**:

1. select a Kubernetes distribution, or decide whether Kubernetes is used at all;
2. select a virtualization product, hypervisor or bare-metal provisioning method;
3. select a cloud, hosting, storage, database, cache, secrets, observability or model-serving
   product;
4. define `T0`/`T1`/`T2` (it reserves them);
5. specify the Platform Contract (it declares the slot list and the layer rules);
6. specify the capability-negotiation protocol (it fixes only the governance rule);
7. adjudicate any legal question;
8. authorize provisioning, deployment, release or production;
9. modify, supersede, re-date or re-status any existing ADR, contract, tag or product file;
10. delete, move or rewrite any historical artifact;
11. accept itself, or record any acceptance.

---

## 16. Evidence / References

All paths are repository-qualified. Statuses are the sources' own, verified 2026-08-23.

**Founder policy — authoritative record (`S9`):**
- `cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` — the Founder
  deployment-priority and provider policy of 2026-08-23, Git-identity-bound by the R3 commit on this
  branch. **This is the sole authority for that policy.**
- *(context only, `X1`)* `soc-autonomous-state:CURRENT_STATE.json` —
  `NON_AUTHORITATIVE_OPERATIONAL_MIRROR`. Not a Git repository, so it has no commit identity. It
  states the same findings but supports no binding conclusion in this ADR

**Suite architecture (`cybrik-suite` @ `d2b5c7fe799beb94b1dcf0661350de10417da0a3`):**
- `docs/adr/README.md` — authoritative ADR-status catalog and lifecycle rule
- `docs/adr/ADR-0005-sandbox-substrate.md` — `ACCEPTED` (GATE A4, 2026-07-26), decision only
- `docs/adr/evidence/ADR-0004-EVIDENCE.md`, `docs/adr/evidence/ADR-0005-EVIDENCE.md` — `DRAFT`
- `docs/strategy/03-REFERENCE-ARCHITECTURE.md` — `[PROPOSAL]`; §1 drivers, §10 deployment tiers
- `docs/strategy/06-ROADMAP-2026-2029.md` — T0/T1/T2 manifests as a future deliverable
- `docs/strategy/08-EVALUATION-SECURITY-COMPLIANCE.md` — egress/exfiltration evaluation posture
- *(not cited as authority)* `docs/operations/W0-RECOVERY-WAVE-2-EVIDENCE.md` —
  `NON_AUTHORITATIVE_CONTEXT_ONLY`: untracked in the canonical checkout, absent from the
  committed tree at `BASE_SHA`, therefore not reproducible from repository identity. Retained as a
  corroborating observation only; no normative decision in this ADR depends on it (§6.2)
- `contracts/README.md` — packet `PROPOSED — NOT ACCEPTED` (v0.1.0)
- `integration/helm/README.md` — `SCAFFOLD`, no charts

**SOC (`cybrik-soc-command-center` @ RC1 peeled commit `695aed8e0e12c9d0e11de5f474e3384d1a4b490f`):**
- `governance/ADR/ADR-0016-sovereign-airgapped-ai-copilot.md` — `ACCEPTED MỘT PHẦN`
- `governance/ADR/ADR-0017-dual-diode-a05-mtslcd.md` — `ACCEPTED` as to direction
- `governance/ADR/ADR-0018-sovereign-encryption-key-management.md` — `PROPOSED`
- `governance/ADR/ADR-0019-sovereign-siem-wazuh-opensearch-nsm.md` — direction accepted, V2,
  deferred
- `governance/ADR/ADR-0020-siem-backend-adapter-swap-ready.md` — `Proposed`
- `docs/architecture/DATA-PLANE-V2.md` §4 — capacity-axis T0/T1/T2
- `docs/operations/T1-BRINGUP-EVIDENCE-2026-07-22.md` — T1 file carrying T2 sizing
- `services/api/src/cybrik_soc/modules/copilot/llm.py` — sovereignty base-URL guard
- `services/api/src/cybrik_soc/platform/outbound.py` — tenant-facing SSRF guard
- `services/api/src/cybrik_soc/modules/forensics/__init__.py` — WORM object storage as an open
  checklist item
- `ops/pf-workers/pyproject.toml`, `ops/pf-workers/pf_workers/s3util.py` — boto3 as SeaweedFS
  S3-protocol client
- `docs/operations/RUNBOOK-S16-LAKE-DUAL-WRITE.md` — SigV4 env-var names bound to SeaweedFS values
- `docs/licensing/LEGAL-REVIEW-QD14-DOSSIER.md` — legal review pending counter-signature

**Cyber AI (`cybrik-cyber-ai-platform` @ RC1 peeled commit `f0bf4c630d8e93a0531d16b4522ce0425996a624` — *not* current `HEAD`):**
- `packages/ai-core/src/cybrik_ai_core/security/egress.py` — inverse-SSRF model-seam guard
- `services/ai-api/src/cybrik_ai_api/adapters/ollama.py` — guard applied at adapter construction
- `.github/workflows/ci.yml` — offline/lock build path

**Tool Fabric (`cybrik-security-tool-fabric` @ RC1 peeled commit `1a419014ebb432eb56ac35242e0a193fe65a62c6`):**
- `tests/control-plane/test_offline_no_network.py` — bounded no-network contract test

### 16.1 Source dependency table — pinned identities

`INV-22`. Every source supporting a binding conclusion is pinned to an exact Git object below. No
binding conclusion rests on a mutable ref such as `HEAD`, on a branch name, or on an unversioned
working directory. R2 cited product-repository sources as `HEAD`; that was wrong on two counts —
`HEAD` moves, and for `cybrik-cyber-ai-platform` it is **not** the release state.

All four release tags are annotated tag objects, so both the tag object and its peeled commit are
recorded:

| Repository | Anchor | Tag object | Peeled commit | Tree |
|---|---|---|---|---|
| `cybrik-suite` | `BASE_SHA` (this branch's base) | — | `d2b5c7fe799beb94b1dcf0661350de10417da0a3` | — |
| `cybrik-suite` | `refs/tags/v1.0.0-rc1` | `e3844e8caf14fe5e141ef20cae76277f73fdff9c` | `1c70605c5d9fde29d1bb812ea5d0e0f9d302b830` | `e333d1dc3171f9fa6d7056dca7823b935f586def` |
| `cybrik-soc-command-center` | `refs/tags/v1.0.0-rc1` | `c47950c16d83c201bf9fdc31e2d5eecaf94eb9f0` | `695aed8e0e12c9d0e11de5f474e3384d1a4b490f` | `a30ef4e141ae1e39223c2f80e11a1a7d51f5aa54` |
| `cybrik-cyber-ai-platform` | `refs/tags/v1.0.0-rc1` | `61b0dc73ef9e98b9b7381707ba197ba018bd818f` | `f0bf4c630d8e93a0531d16b4522ce0425996a624` | `fb160e4b45cce66c301ab7f5f1822c3d66044631` |
| `cybrik-security-tool-fabric` | `refs/tags/v1.0.0-rc1` | `f4c4d4fe39c8fef7e0c9e25c68655092f19966ac` | `1a419014ebb432eb56ac35242e0a193fe65a62c6` | `ec11b4b65bbb945a34412821322c2de978f34f32` |

**`HEAD` is not RC1 everywhere**, which is why R2's `HEAD` citations were unsafe: at authoring time
`cybrik-soc-command-center` and `cybrik-security-tool-fabric` had `HEAD` equal to their RC1 commit,
but `cybrik-suite` (`d2b5c7f…` vs `1c70605…`) and `cybrik-cyber-ai-platform` (`281b252…` vs
`f0bf4c6…`) did not. Every product-repository claim below is pinned to the **RC1 peeled commit**,
and each was re-verified at that commit rather than carried over from R2.

| ID | Repository | Commit / tag object | Path or scope | Authority class | Claim supported |
|---|---|---|---|---|---|
| `S1` | `cybrik-suite` | `d2b5c7fe…` (BASE) | `docs/adr/README.md` | `COMMIT_BOUND_REPRODUCIBLE` | Authoritative ADR-status catalog and lifecycle (§1.5, §18) |
| `S2` | `cybrik-suite` | `d2b5c7fe…` | `docs/adr/ADR-0005-sandbox-substrate.md` | `COMMIT_BOUND_REPRODUCIBLE` | Isolation floors; "no sandbox driver … has been run" (§7.4, Decision F) |
| `S3` | `cybrik-suite` | `d2b5c7fe…` | `docs/adr/ADR-0002-cyber-ai-implementation-stack.md` | `COMMIT_BOUND_REPRODUCIBLE` | `G3`/`G4`/`G5` permit concrete implementation adapters (§5, `INV-21`) |
| `S4` | `cybrik-suite` | `d2b5c7fe…` | `docs/adr/ADR-0001-*.md`, `docs/adr/ADR-0008-*.md` | `COMMIT_BOUND_REPRODUCIBLE` | Offline/air-gap as an accepted requirement (§7.4) |
| `S5` | `cybrik-suite` | `d2b5c7fe…` | the 14 explicit ADR paths in the §1.1 command | `COMMIT_BOUND_REPRODUCIBLE` | Zero provider-identifier matches in pre-existing ADRs (§1.1) |
| `S6` | `cybrik-suite` | `d2b5c7fe…` | `contracts/` (386 committed files) | `COMMIT_BOUND_REPRODUCIBLE` | No offline-install/update or storage contract exists (`OPEN-1`, `OPEN-2`) |
| `S7` | `cybrik-suite` | `d2b5c7fe…` | `docs/strategy/03-REFERENCE-ARCHITECTURE.md` | `COMMIT_BOUND_REPRODUCIBLE` | `[PROPOSAL]` status; §1 on-prem-first driver; §10 tier axis (§1.1, §6.2) |
| `S8` | `cybrik-suite` | `d2b5c7fe…` | `integration/helm/README.md`, `contracts/README.md` | `COMMIT_BOUND_REPRODUCIBLE` | Helm `SCAFFOLD`; contracts `PROPOSED — NOT ACCEPTED` (§1.4, §11) |
| `S9` | `cybrik-suite` | *(the R3 commit on this branch)* | `docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` | `COMMIT_BOUND_REPRODUCIBLE` | **Sole authority for the Founder deployment policy** (§1.3, §1.4, Decision A) |
| `C1` | `cybrik-soc-command-center` | `695aed8e…` (RC1) | `governance/ADR/ADR-0016 … ADR-0020` | `COMMIT_BOUND_REPRODUCIBLE` | Verified SOC ADR statuses (§1.5) |
| `C2` | `cybrik-soc-command-center` | `695aed8e…` | `services/api/src/cybrik_soc/modules/copilot/llm.py` | `COMMIT_BOUND_REPRODUCIBLE` | Sovereignty guard; `socket.getaddrinfo` at line 98, no injection point (§7.3) |
| `C3` | `cybrik-soc-command-center` | `695aed8e…` | `services/api/src/cybrik_soc/platform/outbound.py` | `COMMIT_BOUND_REPRODUCIBLE` | Docstring claims IP pinning; `client.get(url…)` at line 69 uses the hostname (§7.3) |
| `C4` | `cybrik-soc-command-center` | `695aed8e…` | `ops/pf-workers/pf_workers/s3util.py`, `ops/pf-workers/pyproject.toml` | `COMMIT_BOUND_REPRODUCIBLE` | boto3 as a portable S3 client; `endpoint_url` + path addressing (§10.2, §14.1) |
| `C5` | `cybrik-soc-command-center` | `695aed8e…` | `ops/pf-workers/tests/test_parquet_archiver.py` | `COMMIT_BOUND_REPRODUCIBLE` | Conditional `TESTED` — the S3 section skips when no cluster answers (§7.4) |
| `C6` | `cybrik-soc-command-center` | `695aed8e…` | `docs/architecture/DATA-PLANE-V2.md`, `docs/operations/T1-BRINGUP-EVIDENCE-2026-07-22.md` | `COMMIT_BOUND_REPRODUCIBLE` | Competing capacity-axis tier vocabulary (§6.2) |
| `C7` | `cybrik-soc-command-center` | `695aed8e…` | `services/api/src/cybrik_soc/modules/forensics/__init__.py` | `COMMIT_BOUND_REPRODUCIBLE` | WORM / Object Lock is an open checklist item (§14.1) |
| `A1` | `cybrik-cyber-ai-platform` | `f0bf4c63…` (RC1) | `packages/ai-core/src/cybrik_ai_core/security/egress.py` | `COMMIT_BOUND_REPRODUCIBLE` | Injected `resolver` at line 72; public addresses refused by design (§7.3) |
| `A2` | `cybrik-cyber-ai-platform` | `f0bf4c63…` | `services/ai-api/src/cybrik_ai_api/adapters/ollama.py` | `COMMIT_BOUND_REPRODUCIBLE` | Guard applied at construction, line 82 (§7.3). **Differs from current `HEAD`**; the RC1 bytes are the cited ones |
| `A3` | `cybrik-cyber-ai-platform` | `f0bf4c63…` | `tests/ai_core/test_security.py` | `COMMIT_BOUND_REPRODUCIBLE` | `TESTED` covers validation policy only, never connect-time pinning (§7.4) |
| `A4` | `cybrik-cyber-ai-platform` | `f0bf4c63…` | `.github/workflows/ci.yml` | `COMMIT_BOUND_REPRODUCIBLE` | Offline/locked build path (`uv sync --locked`, `uv export --frozen`) (§7.4). **Differs from current `HEAD` and is dirty in the working tree**; the RC1 bytes are the cited ones |
| `F1` | `cybrik-security-tool-fabric` | `1a419014…` (RC1) | `tests/control-plane/test_offline_no_network.py` | `COMMIT_BOUND_REPRODUCIBLE` | Bounded offline no-network contract test (§7.4) |
| `R1` | all four repositories | the four RC1 tag objects above | `pyproject.toml`, `package.json`, `requirements*.txt`, `go.mod`; tracked Python imports | `COMMIT_BOUND_REPRODUCIBLE` | Exactly one dependency-bearing provider SDK at RC1 (§10.2) |
| `X1` | `soc-autonomous-state` | **none — not a Git repository** | `CURRENT_STATE.json` | `NON_AUTHORITATIVE_CONTEXT_ONLY` / `NON_AUTHORITATIVE_OPERATIONAL_MIRROR` | Context only. Superseded as policy provenance by `S9` |
| `X2` | `soc-production-infrastructure` | **none — not a Git repository** | `terraform/`, `helm/`, `QUARANTINE_NOTICE.md`, `architecture/`, `plans/` | `NON_AUTHORITATIVE_CONTEXT_ONLY` | Derived-layer drift observations (§9.2, §10) |
| `X3` | `cybrik-suite` | **untracked at BASE** | `docs/operations/W0-RECOVERY-WAVE-2-EVIDENCE.md` | `NON_AUTHORITATIVE_CONTEXT_ONLY` | Corroboration only; no binding conclusion depends on it (§6.2) |

`X1`, `X2` and `X3` are the complete set of non-reproducible sources in this ADR. No
`ARCHITECTURAL_INVARIANT`, `FOUNDER_POLICY` or `DECISION` rests on any of them.

**Derived deployment layer (`NON_AUTHORITATIVE_CONTEXT_ONLY`, no commit identity; retained as provenance):**
- `soc-production-infrastructure:QUARANTINE_NOTICE.md`
- `soc-production-infrastructure:terraform/` — `provider "aws"` ×2 regions, `provider "cloudflare"`
- `soc-production-infrastructure:helm/cybrik-soc/`
- `soc-production-infrastructure:architecture/PRODUCTION_PLATFORM_DECISION.json` — self-declared
  `"verdict": "ACCEPTED"`
- `soc-production-infrastructure:plans/PRODUCTION_HOST_PROVIDER_MATRIX.json` —
  `ADVISORY_ONLY_NON_BINDING`, four hosted candidates, no P1/P2 candidate

---

## 17. Acceptance Criteria

Acceptance requires all of the following, in one bounded Founder review:

1. **Priority ratified.** The Founder confirms `P1 = ON_PREMISE`, `P2 = PRIVATE_CLOUD`,
   `P3 = SOVEREIGN_CONTROLLED_CROSS_DOMAIN_OR_OPTIONAL_HYBRID`, and foreign public cloud as
   `DEFERRED_OPTIONAL_DEPLOYMENT_PROFILE`, as **new** policy dated 2026-08-23 — not backdated. The
   text under review is
   `cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md`, and the
   reviewer confirms this ADR's Decision A does not extend it.
2. **Invariants ratified — complete set.** All twenty-two invariants `INV-1` … `INV-22` (§4) are
   accepted as written, or amended before acceptance. The reviewer confirms the set is complete and
   contiguous, that no invariant was omitted from review, and that no `INV-` reference elsewhere in
   this ADR is dangling.
3. **No technology selected.** The reviewer confirms this ADR selects no Kubernetes distribution,
   virtualization product, cloud/hosting provider or storage/database/model product, and that
   `KUBERNETES_PRIMARY_SUBSTRATE` remains `UNDECIDED` with every listed candidate `NOT_SELECTED`.
4. **AWS disposition correct.** AWS is recorded as `SUPERSEDED_AS_PRIMARY` /
   `NON_AUTHORITATIVE` / `OPTIONAL_REFERENCE_ONLY`; artifacts retained; not banned; not primary.
5. **Status citations correct.** Every ADR cited in §1.5 carries its source's own qualifier; no
   `PROPOSED` material is cited as `ACCEPTED`.
6. **Open questions preserved — complete set.** All eleven open questions `OPEN-1` … `OPEN-11`
   (§14) remain open after acceptance, and the reviewer confirms none was silently closed or
   converted into an implementation claim.
7. **Claim discipline preserved.** No `FULL_AIR_GAP_PRODUCTION_QUALIFIED` claim; no
   "all S3-compatible systems are interchangeable" claim; no claim that the AI egress guard is
   absolute; no claim that any ADR-0005 isolation profile is implemented or qualified.
8. **Separation preserved.** No legal conclusion is drawn; every legal touchpoint is marked
   `LEGAL_REVIEW_REQUIRED`.
9. **Source closure reproducible.** The reviewer confirms every binding conclusion traces to a
   `COMMIT_BOUND_REPRODUCIBLE` source in the §16.1 table, that the pinned Git identities resolve, and
   that the only non-reproducible sources are `X1`, `X2` and `X3` — none of which carries a binding
   conclusion.
10. **Catalog already consistent.** No catalog action is required at acceptance time.
   `cybrik-suite:docs/adr/README.md` already registers ADR-0015 as `PROPOSED`, Decider `FOUNDER`,
   under the lifecycle it defines. The reviewer confirms only that the registration still reads
   `PROPOSED` and that no existing ADR status was altered by it. Founder acceptance is then a
   **separate status transition**, `PROPOSED` → `ACCEPTED`, applied to both this ADR and its catalog
   row after independent review and under explicit Founder authority — never as a side effect of
   this review (§18).

On acceptance, and only then, this ADR moves from `PROPOSED` to `ACCEPTED` under the lifecycle in
`cybrik-suite:docs/adr/README.md`. Acceptance is a decision record. It is not implementation
authority.

---

## 18. Catalog registration (not part of the decision)

`cybrik-suite:docs/adr/README.md` states *"This catalog is authoritative on ADR status"* and defines
the lifecycle `PROPOSED` → `ACCEPTED` / `REJECTED` → (`SUPERSEDED`). R1 left the catalog unedited and
deferred the question to acceptance time. That was the wrong reading: a lifecycle that **begins** at
`PROPOSED` requires a proposal to be registered at `PROPOSED`, or the authoritative catalog is
silently incomplete while a proposal is in flight.

R2 therefore registers ADR-0015 in that catalog as `PROPOSED`, Decider `FOUNDER`. The registration:

- **is not** acceptance, ratification, or implementation authority;
- **alters no existing ADR's status** — it is purely additive, one prose paragraph and one row;
- scopes, rather than contradicts, the catalog's earlier statement that no suite ADR is still
  `PROPOSED`, in the same additive manner the catalog already uses for ADR-0011 and later records.

Founder acceptance later is a **separate status transition**, `PROPOSED` → `ACCEPTED`, applied to
this file and its catalog row together, after independent review and under explicit Founder
authority. Until that transition, no product repository may implement against this ADR.

## 19. Authoring provenance

Authored as a `PROPOSED` proposal only. No acceptance, no signature, and no acceptance receipt is
synthesized or implied.

- **R1** — this file created. Independent review returned `CHANGES_REQUIRED`,
  `FOUNDER_ACCEPTANCE_SAFE = NO`.
- **R2** — this file revised and `docs/adr/README.md` amended additively to register the proposal at
  `PROPOSED`. Exactly two files, both governance documents. Independent review returned
  `CHANGES_REQUIRED`, `FOUNDER_ACCEPTANCE_SAFE = NO`.
- **R3** — under an explicit Founder directive to record the 2026-08-23 policy durably, this file
  revised, `docs/adr/README.md` amended additively again, and
  `docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` created using the
  repository's existing canonical Founder-decision convention rather than a new parallel authority
  system. Exactly three governance files. R1 and R2 history retained, not amended or squashed.

R3 corrects, in order: Founder-policy provenance moved from an unversioned working directory into a
Git-identity-bound record; every material cross-repository source pinned to an exact commit or tag
object rather than mutable `HEAD`; all four RC1 tag identities resolved and recorded, including the
two repositories whose `HEAD` is not RC1; a §16.1 source dependency table added; acceptance criteria
extended to the complete `INV-1 … INV-22` and `OPEN-1 … OPEN-11` sets; compound-label syntax
normalized to `+` only, with evidence-provenance classes separated from claim labels;
R2's undefined ad-hoc label (`NON_AUTHORITATIVE_WORKTREE_ONLY_EVIDENCE`, no longer used anywhere in
this ADR) replaced by the defined `NON_AUTHORITATIVE_CONTEXT_ONLY` provenance class; the provider scan restated as an exact boundary-aware command with controls; Decision J
grammar repaired; and the duplicate source-trace invariant removed, leaving `INV-14` canonical.

In R3, as in R1 and R2: no Founder signature, cryptographic signature or acceptance receipt was
synthesized; the recording agent added no policy beyond the Founder directive; and this ADR was not
accepted.

R2 corrects, in order: catalog registration; a non-reproducible worktree-only evidence dependency;
unresolved tier names used as a normative conformance target; an over-broad ADR-scan claim; an
over-broad RC1 claim; an asymmetric resolver-injection claim; a three-state maturity model missing
`TESTED`; a `PRODUCT_CORE` boundary that contradicted accepted ADR-0002; and three normative-language
defects (single-label model, binding text inside open-question sections, and "exactly one" authority
source).

No product, contract, test, infrastructure, Terraform, Helm, deployment or controller file was
modified in producing any revision. No technology was selected in any revision.
