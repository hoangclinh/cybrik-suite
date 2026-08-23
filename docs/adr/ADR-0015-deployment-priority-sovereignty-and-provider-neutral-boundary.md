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

## 0. Label vocabulary — how to read this ADR

Every normative or descriptive claim below carries exactly one of these labels. A claim without a
label is framing, not authority.

| Label | Meaning | Who may change it |
|---|---|---|
| `HISTORICAL_FINDING` | A fact about what the repositories already recorded before this ADR. Dated provenance. Never rewritten to match current policy. | Nobody — it is history |
| `FOUNDER_POLICY` | A Founder decision this ADR asks to ratify into suite architecture. **New as of 2026-08-23**; not retroactive | Founder |
| `ARCHITECTURAL_INVARIANT` | A binding architecture rule proposed here, effective only on acceptance | Founder, by a later ADR |
| `OPEN_QUESTION` | Explicitly unresolved. Acceptance of this ADR does **not** close it | A later bounded decision |
| `OPTIONAL_PROFILE` | Permitted but never mandatory; may not become a release or core dependency | Founder, per profile |

Normative keywords `MUST`, `MUST NOT`, `SHOULD`, `MAY` are used in the RFC 2119 sense and apply
only to `ARCHITECTURAL_INVARIANT` and `FOUNDER_POLICY` items, and only after acceptance.

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

No accepted suite ADR selects, mandates or ranks any cloud provider. A repository scan of every
`docs/adr/ADR-00*.md` in `cybrik-suite` for `AWS`/`GCP`/`Azure`/`EKS`/`GKE`/`AKS`/managed-service
identifiers returns **zero** matches.

### 1.2 AWS-primary was derived drift, not Founder authority

`HISTORICAL_FINDING` — the following are recorded in
`soc-autonomous-state:CURRENT_STATE.json` (`historical_findings`) and are corroborated by
repository evidence:

| Finding | Value | Corroborating repository evidence |
|---|---|---|
| `AWS_PRIMARY_FOUNDER_AUTHORITY` | `NOT_FOUND` | No accepted suite ADR names a provider (C1) |
| `AWS_PRIMARY_DEPLOYMENT_DECISION` | `VOID_UNRATIFIED_DERIVED_DRIFT` | The AWS estate exists only in a derived repository |
| `PRODUCT_CORE_CONTAMINATED` | `NO` | No provider SDK/service in any product runtime path (Decision B, §10.2) |
| `RC1_TAG_CONTAMINATED` | `NO` | At `v1.0.0-rc1` the only AWS-shaped hits are the S3-protocol client and its SigV4 credential env names, both pointed at self-hosted SeaweedFS (Decision B, §10.2) |
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

`FOUNDER_POLICY` — recorded 2026-08-23 in `soc-autonomous-state:CURRENT_STATE.json`
(`new_founder_policy`), with `stop_reason`
`FOUNDER_ARCHITECTURE_POLICY_RATIFIED_PENDING_CONSOLIDATION_ADR` and `next_action`
`CLAUDE_WORK_AUTHOR_DEPLOYMENT_ARCHITECTURE_CONSOLIDATION_ADR`.

This ordering is **new**. It MUST NOT be read back into, or used to re-date, any historical
document. Historical documents are provider-neutral with on-prem first class (C1); they were never
a P1/P2/P3 ordering, and this ADR does not retroactively make them one. Where a derived artifact
states an older phrasing of the third priority (`soc-production-infrastructure:QUARANTINE_NOTICE.md`
records P3 as `HYBRID_CLOUD`), that phrasing is dated provenance and is corrected forward by
Decision A, not edited backward.

### 1.4 Substrate status is undecided

`HISTORICAL_FINDING` / `OPEN_QUESTION` — preserved unchanged from
`soc-autonomous-state:CURRENT_STATE.json` (`substrate_and_candidates`):

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

Three further status hazards are recorded so they are not repeated:

- **Number collision across repositories.** This ADR is `cybrik-suite` ADR-0015. A different,
  unrelated `cybrik-soc-command-center` ADR-0015 (Security Onion SIEM/NSM foundation, `ACCEPTED`
  2026-07-18) already exists. ADR numbers are per-repository, never suite-global. Every citation
  MUST be repository-qualified per `cybrik-suite:CLAUDE.md`.

- SOC ADR numbering collided: number 0016 was claimed by three unmerged branches, and
  `…/ADR-0016-sovereign-airgapped-ai-copilot.md` documents the collision explicitly. Any citation
  of a SOC ADR number MUST be resolved against `main` bytes, never against a worktree artifact.
- `cybrik-suite:docs/adr/README.md` is authoritative on suite ADR status and carries qualifiers
  (`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`, *decision only*) that a bare "ACCEPTED" drops.
  Citations MUST carry the qualifier.

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

Four layers are defined — `PRODUCT_CORE`, `PLATFORM_CONTRACT`, `DEPLOYMENT_PROFILE`,
`PROVIDER_ADAPTER` (§5). The Platform Contract MUST be capability-based and MUST NOT name vendors.

### Decision F — Isolation semantics

`ARCHITECTURAL_INVARIANT`.

Accepted ADR-0005 isolation requirements are preserved. A deployment profile MUST NOT be selected
that cannot meet the isolation profile required by the risk classes it admits, and a provider
profile MUST NOT claim support for a tier whose **mandatory** isolation capabilities it cannot
satisfy. Optional capabilities are not required of every optional profile.

### Decision G — Deployment profile / tier semantics

`OPEN_QUESTION`. `CANONICAL_T0_T1_T2_SEMANTICS = OPEN`.

The token `T0`/`T1`/`T2` is **reserved** and MUST NOT be given canonical meaning by this ADR. At
least four incompatible in-repository usages exist across two orthogonal axes (§6.2). One
versioned tier contract MUST exist before any downstream implementation relies on the names.

### Decision H — Provider adapter governance

`ARCHITECTURAL_INVARIANT`.

Every provider/deployment adapter MUST satisfy the versioned mandatory baseline of every
deployment tier/profile it claims to support. Provider-specific capabilities MUST be namespaced,
optional, and capability-advertised, and MUST NOT alter data-sovereignty, authority, isolation or
artifact-integrity semantics (§8).

### Decision I — Provider selection authority

`ARCHITECTURAL_INVARIANT`.

A controller MAY produce advisory provider matrices. It MUST NOT freeze a provider as primary
architecture without explicit Founder or delegated authority, and any provider-selection record
MUST carry the eight fields in §9.1. Candidate sets MUST NOT omit P1/P2 (§9.2).

### Decision J — No synthesized mandatory requirements

`ARCHITECTURAL_INVARIANT`.

A planner or controller MUST NOT manufacture a mandatory requirement by selecting a
provider-native managed service. Every mandatory architecture requirement MUST trace to one of
five sources; anything untraceable remains `ADVISORY`, `CANDIDATE` or `OPEN` (§10.3).

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
| `INV-8` | A provider profile MUST NOT claim a tier whose **mandatory** capabilities it cannot satisfy (Decisions F, H) |
| `INV-9` | Optional capabilities MUST NOT be required of every optional provider profile (Decisions F, H) |
| `INV-10` | Provider-specific capability names MUST be namespaced and capability-advertised (Decision H) |
| `INV-11` | A provider adapter MUST NOT weaken sovereignty, authority, isolation or artifact-integrity semantics (Decision H) |
| `INV-12` | A controller MUST NOT freeze a provider as primary architecture without explicit authority (Decision I) |
| `INV-13` | A provider candidate set MUST include the P1/P2 deployment priorities (Decision I) |
| `INV-14` | Every mandatory requirement MUST trace to one of the five authority sources in §10.3 (Decision J) |
| `INV-15` | `T0`/`T1`/`T2` MUST NOT be relied on by implementation until one versioned tier contract exists (Decision G) |
| `INV-16` | Status citations MUST carry the source ADR's own qualifier; `PROPOSED` MUST NOT be cited as `ACCEPTED` (§1.5) |

---

## 5. Architecture Layers

`ARCHITECTURAL_INVARIANT` (Decision E).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PRODUCT_CORE        domain truth, contracts, policy, authority, receipts     │
│                     provider-neutral; knows no provider, no substrate        │
├──────────────────────────────────────────────────────────────────────────────┤
│ PLATFORM_CONTRACT   capability-based, versioned, vendor-free                 │
│                     "what a platform must be able to do", never "who"        │
├──────────────────────────────────────────────────────────────────────────────┤
│ DEPLOYMENT_PROFILE  a named, versioned bundle of Platform Contract           │
│                     capabilities at stated mandatory/optional strength       │
├──────────────────────────────────────────────────────────────────────────────┤
│ PROVIDER_ADAPTER    one concrete realization; OPTIONAL_PROFILE by default    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Layer rules

- `PRODUCT_CORE` MUST NOT import, reference or branch on a provider identity, a provider service
  name, or a substrate identity.
- `PLATFORM_CONTRACT` MUST express requirements as **capabilities with observable semantics**
  (behaviour, failure mode, guarantee), never as a product name.
- A `DEPLOYMENT_PROFILE` MUST declare, per capability, whether it is `MANDATORY` or `OPTIONAL` for
  that profile, and MUST be versioned.
- A `PROVIDER_ADAPTER` MUST advertise the capability set it satisfies and MUST fail closed rather
  than silently degrade a capability it cannot provide.
- Dependencies point **downward only**: core → contract → profile → adapter. An adapter MUST NOT
  introduce a requirement upward into the contract or the core.

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
Firecracker + jailer at T0) without defining them, and
`cybrik-suite:docs/operations/W0-RECOVERY-WAVE-2-EVIDENCE.md` states plainly: *"Suite T0/T1/T2
profiles remain proposals."* So an accepted ADR depends on a vocabulary whose only definitions sit
in `[PROPOSAL]` and `DRAFT` documents.

Therefore:

- This ADR **reserves** `T0`/`T1`/`T2` as suite tier tokens and defines none of them.
- A single **versioned tier contract** MUST be produced before any downstream implementation
  relies on the names (`INV-15`).
- Until then, every document using `T0`/`T1`/`T2` SHOULD name its axis explicitly (for example
  "capacity tier T1" vs "substrate tier T1") so the two axes stop colliding silently.
- Documents MAY continue to use the tokens as dated historical provenance; nothing is rewritten.

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

This ADR makes an **architectural and product-priority** decision. It makes **no legal judgment**,
and nothing in it states or implies that public cloud is unlawful.

Where Vietnamese legal interpretation bears on a deployment choice, it MUST be marked
`LEGAL_REVIEW_REQUIRED` and routed to legal review, separately from the architecture record.
Existing instances that are already routed and MUST NOT be re-decided here:

- data-sharing obligations to A05 and the MTSLCD channel (`cybrik-soc-command-center` ADR-0017);
- state-cipher obligations under the 2011 Cipher Law for classified data
  (`cybrik-soc-command-center` ADR-0018 — status `PROPOSED`);
- distribution-licence clearance (`cybrik-soc-command-center:docs/licensing/LEGAL-REVIEW-QD14-DOSSIER.md`,
  recorded as awaiting final legal counter-signature).

Technical architecture conclusions and legal conclusions MUST be kept in separate records.

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
- The guards' resolver is injectable specifically so an air-gapped deployment can pin resolution —
  the seam for a fix exists; the decision does not.

**Normative:**

- A supported deployment profile MUST NOT require a public-cloud LLM (`INV-5`).
- No document MAY describe these guards as mathematically absolute, or as closing DNS rebinding,
  while `AI_DNS_TOCTOU_EGRESS_GUARD` is `OPEN`.
- SOC ADR-0016 MUST be cited with its `ACCEPTED IN PART` qualifier, and MUST NOT be cited as
  evidence that air-gap is built (its own §S7 states the air-gap/diode/GPU parts are design or V2).

### 7.4 Claim discipline — requirement vs implemented vs qualified

`ARCHITECTURAL_INVARIANT`. Three distinct states MUST be kept distinct in every artifact:

| State | Meaning |
|---|---|
| `ARCHITECTURAL_REQUIREMENT` | Decided as policy; nothing is built |
| `IMPLEMENTED` | Code exists and runs; not proven end to end under the required conditions |
| `QUALIFIED` | An authoritative end-to-end qualification exists, with evidence |

Applied to the areas this ADR touches:

- **Offline / air-gap.** `FULL_AIR_GAP_PRODUCTION_QUALIFIED` MUST NOT be claimed. Current evidence
  supports an *offline-capable architecture* with bounded implemented seams —
  `cybrik-security-tool-fabric:tests/control-plane/test_offline_no_network.py`, the lock/offline
  build path in `cybrik-cyber-ai-platform:.github/workflows/ci.yml` — while
  `cybrik-suite:docs/operations/W0-RECOVERY-WAVE-2-EVIDENCE.md` records that *"No end-to-end signed
  offline update, operator-owned trust root, offline upgrade/rollback or private update-station
  workflow exists."* Status: `ARCHITECTURAL_REQUIREMENT` = yes; `IMPLEMENTED` = partial, bounded
  seams only; `QUALIFIED` = **no**. See `OPEN-1`.
- **Isolation (ADR-0005).** `gVisor`/`runsc`, `Firecracker`, `jailer`, `KVM`, Kata `RuntimeClass`
  and the control-side egress broker are **accepted architectural/isolation requirements** at
  ADR-0005's own stated strength — *"decision only"*. ADR-0005 states in its own bytes that *"No
  sandbox driver, isolation runtime, egress broker, benchmark or escape test exists or has been run
  in any product repository, and none is claimed here."* No profile MAY be described as implemented
  or qualified for these. Its `J10` kernel/hardware/profile/version pins remain deferred to a spike
  that has not run.
- **S3 compatibility.** See §14.1 / `OPEN-2`.

---

## 8. Provider Adapter Governance

`ARCHITECTURAL_INVARIANT` (Decision H).

### 8.1 The baseline rule

Every provider/deployment adapter MUST satisfy the **versioned mandatory baseline of every
deployment tier/profile it claims to support**. Claiming a profile is a conformance assertion, not
a label.

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

- A provider profile MUST NOT claim a tier whose **mandatory** capabilities it cannot satisfy
  (`INV-8`).
- An **optional** provider profile MUST NOT be required to implement every **optional** capability
  (`INV-9`). Optionality is not a defect, and absence of an optional capability MUST NOT be
  reported as non-conformance.
- Where a provider cannot satisfy a mandatory capability, the adapter MUST fail closed and the
  profile claim MUST be withdrawn — it MUST NOT be satisfied by a weaker substitute presented under
  the same capability name.

### 8.4 Capability negotiation

`OPEN_QUESTION` — `OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION`. The **governance rule** above is
decided here. The **detailed negotiation protocol** — discovery encoding, version matching,
degradation reporting, conformance test format — is delegated to the Platform Contract and is not
specified by this ADR.

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

The one recurring false positive is worth fixing permanently, because it is exactly the Decision B
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
provider-native managed services. Every mandatory architecture requirement MUST trace to exactly
one of:

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
| Product core (`cybrik-soc-command-center`, `cybrik-cyber-ai-platform`, `cybrik-security-tool-fabric`) | **None.** No provider coupling exists to remove (§10.2). No code change is required, requested or authorized by this ADR |
| `cybrik-suite:contracts/` | **None.** No contract is amended. The packet remains `PROPOSED — NOT ACCEPTED` at v0.1.0 |
| `v1.0.0-rc1` tags | **None.** No re-tag, no re-cut, no re-qualification. `RC1_TAG_CONTAMINATED = NO` |
| Accepted ADRs 0001–0014 | **None.** No status flip, no supersession, no byte change |
| `soc-production-infrastructure` (derived) | **Reclassified, not deleted.** AWS estate becomes `OPTIONAL_REFERENCE_ONLY`; the platform verdict and provider matrix become advisory input (§9, §10) |
| `soc-autonomous-state` (derived controller) | Its recorded policy gains an architecture home. The controller MUST NOT treat this ADR as accepted until the Founder accepts it |
| Documents using `T0`/`T1`/`T2` | **No rewrite.** Tokens are reserved; existing usages remain dated provenance until the tier contract lands (§6.2) |
| `cybrik-suite:docs/adr/README.md` (ADR catalog) | **Not modified by this proposal.** The catalog is authoritative on ADR status; adding a `PROPOSED` row is a status-authority action. See §18 |

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

### 14.1 `S3_COMPATIBILITY_MINIMUM_CONTRACT` — why `OPEN-2` cannot be closed

`OPEN_QUESTION` (`OPEN-2`). It MUST NOT be written anywhere that *"all S3-compatible systems are
interchangeable."*

Current evidence proves only a **bounded SeaweedFS-compatible path**. From
`cybrik-soc-command-center:ops/pf-workers/`, the surface actually exercised is: `put_object`,
`get_object`, `head_object`, `head_bucket`, `create_bucket`, `delete_objects` and paginated
listing, under SigV4 with **path-style addressing forced** (SeaweedFS does not support
virtual-host buckets), plus a specific error-code mapping (`NoSuchKey`, `NoSuchBucket`, `404`,
`NotFound` treated as absent).

Nothing proves portability beyond that. A future contract MUST define the subset actually
required, and MUST state for each whether it is mandatory:

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

**Founder policy and controller state (derived — authority record for the policy, not for
architecture):**
- `soc-autonomous-state:CURRENT_STATE.json` — `historical_findings`, `new_founder_policy`,
  `substrate_and_candidates`, `open_architecture_questions`, `next_governance_action`

**Suite architecture (`cybrik-suite`):**
- `docs/adr/README.md` — authoritative ADR-status catalog and lifecycle rule
- `docs/adr/ADR-0005-sandbox-substrate.md` — `ACCEPTED` (GATE A4, 2026-07-26), decision only
- `docs/adr/evidence/ADR-0004-EVIDENCE.md`, `docs/adr/evidence/ADR-0005-EVIDENCE.md` — `DRAFT`
- `docs/strategy/03-REFERENCE-ARCHITECTURE.md` — `[PROPOSAL]`; §1 drivers, §10 deployment tiers
- `docs/strategy/06-ROADMAP-2026-2029.md` — T0/T1/T2 manifests as a future deliverable
- `docs/strategy/08-EVALUATION-SECURITY-COMPLIANCE.md` — egress/exfiltration evaluation posture
- `docs/operations/W0-RECOVERY-WAVE-2-EVIDENCE.md` — tier profiles remain proposals; no offline
  update/trust-root/rollback workflow exists
- `contracts/README.md` — packet `PROPOSED — NOT ACCEPTED` (v0.1.0)
- `integration/helm/README.md` — `SCAFFOLD`, no charts

**SOC (`cybrik-soc-command-center`):**
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

**Cyber AI (`cybrik-cyber-ai-platform`):**
- `packages/ai-core/src/cybrik_ai_core/security/egress.py` — inverse-SSRF model-seam guard
- `services/ai-api/src/cybrik_ai_api/adapters/ollama.py` — guard applied at adapter construction
- `.github/workflows/ci.yml` — offline/lock build path

**Tool Fabric (`cybrik-security-tool-fabric`):**
- `tests/control-plane/test_offline_no_network.py` — bounded no-network contract test

**Derived deployment layer (non-authoritative; retained as provenance):**
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
   `DEFERRED_OPTIONAL_DEPLOYMENT_PROFILE`, as **new** policy dated 2026-08-23 — not backdated.
2. **Invariants ratified.** `INV-1` … `INV-16` are accepted as written, or amended before
   acceptance.
3. **No technology selected.** The reviewer confirms this ADR selects no Kubernetes distribution,
   virtualization product, cloud/hosting provider or storage/database/model product, and that
   `KUBERNETES_PRIMARY_SUBSTRATE` remains `UNDECIDED` with every listed candidate `NOT_SELECTED`.
4. **AWS disposition correct.** AWS is recorded as `SUPERSEDED_AS_PRIMARY` /
   `NON_AUTHORITATIVE` / `OPTIONAL_REFERENCE_ONLY`; artifacts retained; not banned; not primary.
5. **Status citations correct.** Every ADR cited in §1.5 carries its source's own qualifier; no
   `PROPOSED` material is cited as `ACCEPTED`.
6. **Open questions preserved.** `OPEN-1` … `OPEN-10` remain open after acceptance, and the
   reviewer confirms none was silently closed.
7. **Claim discipline preserved.** No `FULL_AIR_GAP_PRODUCTION_QUALIFIED` claim; no
   "all S3-compatible systems are interchangeable" claim; no claim that the AI egress guard is
   absolute; no claim that any ADR-0005 isolation profile is implemented or qualified.
8. **Separation preserved.** No legal conclusion is drawn; every legal touchpoint is marked
   `LEGAL_REVIEW_REQUIRED`.
9. **Catalog reconciliation decided.** The Founder directs whether
   `cybrik-suite:docs/adr/README.md` is updated to list this ADR, and by whom (§18).

On acceptance, and only then, this ADR moves from `PROPOSED` to `ACCEPTED` under the lifecycle in
`cybrik-suite:docs/adr/README.md`. Acceptance is a decision record. It is not implementation
authority.

---

## 18. Discoverability note (not part of the decision)

`cybrik-suite:docs/adr/README.md` states *"This catalog is authoritative on ADR status"* and
currently records that no suite ADR is `PROPOSED`. This proposal deliberately does **not** edit
that catalog: writing a status row into the authoritative status record is itself a
status-authority action, and this ADR claims none. The catalog is therefore **out of date with
respect to this file until the Founder or a delegated Governor reconciles it**. That reconciliation
is item 9 of the acceptance criteria.

## 19. Authoring provenance

Authored as a `PROPOSED` proposal only. No acceptance, no signature, and no acceptance receipt is
synthesized or implied. No product, contract, infrastructure, Terraform, Helm, deployment or
controller file was modified in producing this ADR. The only file created is this one.
