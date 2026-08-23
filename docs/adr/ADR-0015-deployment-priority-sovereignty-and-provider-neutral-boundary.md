# ADR-0015 — Deployment priority, data sovereignty, and provider-neutral platform boundary

- Status: `ACCEPTED` (Founder, 2026-08-23) — decision record only; architecture/governance
  authority only. It is not implementation, dependency, substrate, product-selection,
  provisioning, deployment, release or production authority, and it grants none. Accepted subject:
  the exact independently reviewed R6 bytes, commit `6580a4fcdf8d24e203b6e6f98a15dae3c2fea789`, tree
  `c49f77f2f12eb34fc498f17043b2a223b8bfcef6`.
- Date raised: 2026-08-23
- Date decided: 2026-08-23 (Founder acceptance; applied by the docs-only
  [ADR-0015 status-flip application](ADR-0015-STATUS-FLIP-APPLICATION.md))
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

## Acceptance recorded — 2026-08-23

The Founder explicitly accepted this ADR on 2026-08-23, applying to the exact independently
reviewed R6 subject only — commit `6580a4fcdf8d24e203b6e6f98a15dae3c2fea789`, tree
`c49f77f2f12eb34fc498f17043b2a223b8bfcef6` — after independent review returned
`FINAL_ADR_REVIEW_VERDICT = PASS`, `FOUNDER_ACCEPTANCE_SAFE = YES`, `ADR_REVIEW_FINDINGS = NONE`.
The status flip is applied by the docs-only
[ADR-0015 status-flip application](ADR-0015-STATUS-FLIP-APPLICATION.md), which is the acceptance
record. The lifecycle transition is `PROPOSED` → `ACCEPTED` under
[docs/adr/README.md](README.md), Decider Founder.

- **What is accepted.** The architecture/governance decisions of the reviewed R6 bytes, including
  the ADR-authored architectural invariants (`INV-1` … `INV-22`, Decision A.2 and Decisions B–J)
  that §0, §3, §4 and §17 classified as `NOT YET ACCEPTED` / inert while this ADR was `PROPOSED`.
  Under §0 they take effect on acceptance; this record is that acceptance. The condition named in
  §2 as `ACCEPTED_SUITE_WIDE_ARCHITECTURE_HOME = OPEN (pending explicit Founder acceptance of
  ADR-0015)` is satisfied by this acceptance.
- **What is not created by it.** The Founder deployment-priority policy (Decision A.1, §1.3, §6.1)
  remains separately rooted in
  `cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` at R3 commit
  `e800a283fd6f001a579987630839435206b73160` (`S9`), in force by that packet since 2026-08-23.
  This acceptance does not create, re-decide, extend or backdate that policy (Acceptance Criterion
  1A).
- **What remains open.** All eleven open questions `OPEN-1` … `OPEN-11` (§14) remain `OPEN`
  exactly as written, per `INV-20` and Acceptance Criterion 6 — including
  `CANONICAL_T0_T1_T2_SEMANTICS`, `OFFLINE_INSTALL_UPDATE_CONTRACT`,
  `S3_COMPATIBILITY_MINIMUM_CONTRACT`, `AI_DNS_TOCTOU_EGRESS_GUARD`,
  `OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION`, `VIRTUALIZATION_SUBSTRATE_SELECTION`,
  `KUBERNETES_DISTRIBUTION_SELECTION`, Platform Contract slot semantics and the per-module
  `PRODUCT_CORE` vs `PRODUCT_IMPLEMENTATION_ADAPTER` classification. `KUBERNETES_PRIMARY_SUBSTRATE`
  and `VIRTUALIZATION_SUBSTRATE` remain `UNDECIDED`; every candidate remains `NOT_SELECTED`.
- **What it does not authorize.** Architecture/governance authority only (§12, "What acceptance
  would *not* authorize"). `PRODUCTION_DEPLOYMENT_AUTHORITY = CLOSED`; `PRODUCTION_DEPLOYED = NO`;
  `READY_FOR_PRODUCTION_ROLLOUT_DECISION = NO`. No production deployment, rollout, traffic cutover,
  DNS or cloud mutation, customer or database migration, secret rotation, public release, RC1
  mutation, provider, Kubernetes-distribution or virtualization selection, AWS cleanup execution,
  Platform Contract implementation, `OPEN-3` remediation, product-code or infrastructure change is
  authorized.
- **Byte discipline.** No decision, invariant, open-question, source-table or evidence text below
  this block was changed by the acceptance; the body is the reviewed R6 text verbatim. Proposal-time
  wording in the body ("while this ADR is `PROPOSED`", "not yet accepted", "inert until accepted",
  "on acceptance") is dated provenance of the proposal and is read as satisfied by this record; the
  operative status is this header and the catalog. No Founder signature, cryptographic signature or
  external receipt is synthesized; the Git commit containing this record is its durable identity.

## 0. Label vocabulary — how to read this ADR

Every normative or descriptive claim below carries **one or more** of these labels. A claim without
a label is framing, not authority.

**Claim/authority labels.** Exactly this closed set; nothing else is a claim label.

| Label | Meaning | Binding? | Who may change it |
|---|---|---|---|
| `HISTORICAL_FINDING` | A fact about what the repositories already recorded before this ADR. Dated provenance. Never rewritten to match current policy. | **No** | Nobody — it is history |
| `FOUNDER_POLICY` | A proposition that the Founder decision packet (`S9`) itself states, reproduced here and consolidated into suite architecture. Already in force by the packet's own authority since 2026-08-23, independently of this ADR's acceptance; not retroactive. Only a packet-stated proposition carries this label — a rule authored by this ADR is never `FOUNDER_POLICY`, whatever it consolidates | **Yes** — by the packet, not by this ADR | Founder |
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
Most-binding-first means: binding labels (`FOUNDER_POLICY`, `ARCHITECTURAL_INVARIANT`, `DECISION`,
in that table order) precede non-binding ones, and between two non-binding labels the precedence
list below decides the order (`OPEN_QUESTION` before `OPTIONAL_PROFILE` before `HISTORICAL_FINDING`).

**Precedence, used only where two labels would give conflicting force:**

1. `OPEN_QUESTION` wins over every other label **for the sub-question it names**. An item labelled
   `OPEN_QUESTION` creates no binding requirement about that sub-question, whatever else it carries.
2. `FOUNDER_POLICY` and `ARCHITECTURAL_INVARIANT` are both binding and are never carried by one
   item (an ADR-authored rule is never `FOUNDER_POLICY`). Where an invariant builds on a policy,
   the packet's wording governs the policy and the invariant adds only what it states itself.
3. `OPTIONAL_PROFILE` never becomes mandatory by association with a binding label.
4. `HISTORICAL_FINDING` never acquires binding force from a co-label; it stays dated provenance. A
   section labelled `HISTORICAL_FINDING` alone MUST NOT introduce a requirement of its own; where a
   historical finding has a binding consequence, that consequence is written as a numbered invariant
   in §4 and the historical section refers to it descriptively.

**Where binding language may appear.** Normative keywords `MUST`, `MUST NOT`, `SHOULD`, `MAY` are
used in the RFC 2119 sense and apply only to `ARCHITECTURAL_INVARIANT` and `FOUNDER_POLICY` items.
An `ARCHITECTURAL_INVARIANT` takes effect only after acceptance of this ADR. A `FOUNDER_POLICY` item
is already in force by the packet; this ADR's restatement of it adds no force and does not depend
on acceptance. Sections labelled `OPEN_QUESTION` describe what is unresolved and
**create no binding requirement of their own**; where a binding rule is adjacent to an open
question, the rule lives in §4 as a numbered invariant and the open section cites it by number.

---

## 1. Context

### 1.1 The historical deployment architecture was provider-neutral with on-prem first class

`HISTORICAL_FINDING` — `PROVIDER_NEUTRAL_WITH_ON_PREM_FIRST_CLASS`.

`cybrik-suite:docs/strategy/03-REFERENCE-ARCHITECTURE.md` (status `[PROPOSAL]`, 2026-07-22;
source `S7` in §16.1) opens its architectural drivers with *"Local/on-prem/air-gapped là deployment
mode hạng nhất"* — local/on-prem/air-gapped is a first-class deployment mode — and its §10
deployment-tier table describes a sovereign/air-gap tier with private registry, offline update
station and no phone-home. `cybrik-soc-command-center:governance/ADR/ADR-0016-sovereign-airgapped-ai-copilot.md`
and `…/ADR-0017-dual-diode-a05-mtslcd.md` (`C1`) position the product as a national-sovereignty SOC.

No pre-existing suite ADR selects, mandates or ranks any cloud provider (`S5`). The scan is stated
as an exact, boundary-aware, independently reproducible command against a pinned commit, so a
reviewer can re-run it rather than trust the result:

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

The pathspec list is explicit and deliberately excludes this file. ADR-0015 discusses AWS
extensively (§10), so any glob including it will match, and a claim of "zero matches across every
ADR file" would be false the moment this ADR exists. The verified claim is about the files that the
**14 pathspecs** above resolve to at `BASE_SHA`, nothing wider. Those 14 pathspecs resolve to
**16 files**, not 14: the `ADR-0003-*.md` and `ADR-0005-*.md` pathspecs each match both the ADR and
its status-flip application file. The resolved set is reproducible with
`git -C cybrik-suite grep -l -e '' d2b5c7fe799beb94b1dcf0661350de10417da0a3 -- <the same 14 pathspecs>`
and is, in full:

```
docs/adr/ADR-0001-suite-contract-versioning-policy.md
docs/adr/ADR-0002-cyber-ai-implementation-stack.md
docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md
docs/adr/ADR-0003-durable-agent-orchestration.md
docs/adr/ADR-0004-tool-fabric-control-plane-executor-split.md
docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md
docs/adr/ADR-0005-sandbox-substrate.md
docs/adr/ADR-0006-cross-product-event-and-identity-model.md
docs/adr/ADR-0007-org-hierarchy-and-external-authority-boundary.md
docs/adr/ADR-0008-internal-service-delegation-and-workload-identity.md
docs/adr/ADR-0009-org-hierarchy-and-external-authority-contract-profile.md
docs/adr/ADR-0010-capability-name-canonicalization.md
docs/adr/ADR-0011-inference-plane-transport-binding-profile.md
docs/adr/ADR-0012-resource-bounds-contract-profile.md
docs/adr/ADR-0013-transport-peer-evidence-adapter-profile.md
docs/adr/ADR-0014-receipt-trust-and-durability-profile.md
```

The two status-flip application files are therefore **inside** the scan, and the zero result covers
them. The scan, its resolved file set and its two controls are recorded as source `S5` in §16.1.

### 1.2 AWS-primary was derived drift, not Founder authority

`HISTORICAL_FINDING`. Each row below is established by the repository evidence in its third column,
cited by §16.1 source ID, which is what makes it citable. `soc-autonomous-state:CURRENT_STATE.json`
(`X1` — provenance class `NON_AUTHORITATIVE_CONTEXT_ONLY`, role: operational mirror) states the same
findings but has no commit identity and supports nothing on its own. The Founder packet (`S9`, §1.3)
records the first two values under Founder authority; the repository evidence below is what that
record rests on:

| Finding | Value | Corroborating repository evidence |
|---|---|---|
| `AWS_PRIMARY_FOUNDER_AUTHORITY` | `NOT_FOUND` | No suite ADR at `BASE_SHA` names, selects or ranks a provider (`S5`); the authoritative catalog lists no provider-selection decision (`S1`); the historical architecture driver is provider-neutral with on-prem first class (`S7`); recorded as `NOT_FOUND` by Founder authority (`S9` §1.3) |
| `AWS_PRIMARY_DEPLOYMENT_DECISION` | `VOID_UNRATIFIED_DERIVED_DRIFT` | The AWS estate exists only in the derived layer (`X2`, context only); no product repository carries a provider SDK other than a portable S3 client at RC1 (`R1`); recorded as `VOID_UNRATIFIED_DERIVED_DRIFT` by Founder authority (`S9` §1.3) |
| `PRODUCT_CORE_CONTAMINATED` | `NO` | No provider-specific infrastructure service is mandatory to any product domain/core contract (`R1`). The one provider-origin SDK in the products sits in a `PRODUCT_IMPLEMENTATION_ADAPTER` speaking a portable protocol (`C4`; Decision B, §5.1, §10.2) |
| `RC1_TAG_CONTAMINATED` | `NO` — **scoped to dependency-bearing runtime paths**, not to document text | At `v1.0.0-rc1` exactly one declared provider-SDK dependency exists across all four repositories (`R1`), and it is a portable S3-protocol client pointed at self-hosted SeaweedFS (`C4`, `C9`). Provider **text** does occur at the tag in architecture, governance and research documents; that is not contamination. See §10.2 for the full scoped statement |
| `CONTRACTS_CONTAMINATED` | `NO` | `cybrik-suite:contracts/` carries no provider-identifier or provider-SDK token in any of its 386 committed files (`S6`); the packet is itself `PROPOSED — NOT ACCEPTED` (`S8`) |
| `DERIVED_DEPLOYMENT_LAYER_CONTAMINATED` | `YES` | `soc-production-infrastructure:terraform/` declares `provider "aws"` (primary + DR region) and `provider "cloudflare"`, with VPC/ALB/IAM/security-group/observability/S3-WORM/S3-DR modules (`X2`; a historical observation about a non-reproducible derived layer, carrying no binding conclusion) |

`soc-production-infrastructure:architecture/PRODUCTION_PLATFORM_DECISION.json` (`X2`) carries
`"verdict": "ACCEPTED"` and `"architecture_tier": "T0"` and declares four `derived_from` inputs:
the two suite evidence packets `cybrik-suite:docs/adr/evidence/ADR-0004-EVIDENCE.md` and
`…/ADR-0005-EVIDENCE.md` (`S10`), `cybrik-soc-command-center:deploy/`, and Cloudflare authoritative
DNS. The two suite evidence packets are `DRAFT` evidence documents per
`cybrik-suite:docs/adr/README.md` (`S1`), not accepted ADRs; the other two inputs are a product
deployment directory and an external service, not decision records. None of the four is a Founder
decision or an accepted suite ADR, and no Founder acceptance record exists for that platform
verdict.

`soc-production-infrastructure:QUARANTINE_NOTICE.md` (`X2`) already classifies the AWS Terraform
estate as `QUARANTINED_REFERENCE_IMPLEMENTATION` and `PRESERVED_AS_DEFERRED_REFERENCE_PROFILE`. That notice
is a derived-layer artifact. It records the disposition; it does not confer architecture authority.
This ADR exists to place the disposition under suite architecture authority.

### 1.3 The new Founder deployment priority (new policy, not retroactive)

`FOUNDER_POLICY`. **Authoritative provenance:**
`cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` (`S9`), a Founder
decision record written under the repository's canonical `FOUNDER-DECISION-PACKET-*` convention and
identified by the Git commit that introduces it. That packet — not this ADR, and not any derived
artifact — is what a reviewer must read to confirm the policy. It records the policy only; it
accepts nothing, selects nothing, and authorizes nothing. The policy is in force by that packet,
and acceptance of this ADR is **not** required to establish it (Decision A.1). The architectural
consequences this ADR draws from the policy are Decision A.2 — ADR-authored, `ARCHITECTURAL_INVARIANT`,
not yet accepted — and are never presented as Founder policy.

`soc-autonomous-state:CURRENT_STATE.json` previously carried the only written form of this policy.
That working directory is **not a Git repository**, so it has no commit identity and cannot be
pinned. Its provenance class is `NON_AUTHORITATIVE_CONTEXT_ONLY` and its role is that of an
operational mirror (`X1`, §16.1). The packet's own §3 records it under the descriptive label
`NON_AUTHORITATIVE_OPERATIONAL_MIRROR`; this ADR reads that label as the *role* "operational mirror",
not as a third provenance class — the only provenance classes are the two defined in §0. The mirror is
**not** part of this ADR's binding authority closure. Where the mirror and the packet differ, the
packet governs.

This ordering is **new**. It MUST NOT be read back into, or used to re-date, any historical
document. Historical documents are provider-neutral with on-prem first class (`S7`, `S5`; §1.1);
they were never a P1/P2/P3 ordering, and this ADR does not retroactively make them one. Where a
derived artifact states an older phrasing of the third priority
(`soc-production-infrastructure:QUARANTINE_NOTICE.md`, `X2`, records P3 as `HYBRID_CLOUD`), that
phrasing is dated provenance and is corrected forward by Decision A.1, not edited backward.

### 1.4 Substrate status is undecided

`OPEN_QUESTION` + `HISTORICAL_FINDING`. Recorded by Founder authority in
`cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` §1.4 (`S9`;
`KUBERNETES_PRIMARY_SUBSTRATE = UNDECIDED`, `VIRTUALIZATION_SUBSTRATE = UNDECIDED`); the
per-candidate detail below mirrors `soc-autonomous-state:CURRENT_STATE.json`
(`substrate_and_candidates`) — `X1`, provenance class `NON_AUTHORITATIVE_CONTEXT_ONLY`, role
operational mirror — and binds nothing:

```
KUBERNETES_PRIMARY_SUBSTRATE = UNDECIDED
KUBERNETES_STATUS            = OPTIONAL_CANDIDATE_PENDING_ARCHITECTURE_CONTRACT
RKE2 = NOT_SELECTED    K3S = NOT_SELECTED    OPENSHIFT = NOT_SELECTED
VMWARE = NOT_SELECTED  PROXMOX = NOT_SELECTED  OPENSTACK = NOT_SELECTED
```

Existing Helm/Kubernetes work is `UNRATIFIED_REFERENCE_CANDIDATE`, not architecture authority.
In the suite, `cybrik-suite:integration/helm/README.md` (`S8`) is `SCAFFOLD` — *"intentionally
empty … No charts exist."* The only substantive chart is
`soc-production-infrastructure:helm/cybrik-soc/` (`X2`), which lives in a derived, non-reproducible
working directory.

### 1.5 Cited ADR statuses, verified from source at authoring time (2026-08-23)

`HISTORICAL_FINDING`. Verified by reading the ADR bytes (`S2`, `S11`, `C1`, `C11`), not an index or
a summary; the authoritative catalog (`S1`) agrees. The third column describes how this ADR uses each
source; the citation discipline it describes is not a rule of this section — it is `INV-16` in §4.

| ADR | Verified status string (source) | How this ADR uses it (citation discipline: `INV-16`) |
|---|---|---|
| `cybrik-suite` ADR-0005 — Sandbox substrate (`S2`) | `ACCEPTED` (GATE A4, 2026-07-26) — *"decision only; no implementation, dependency or runtime authority"* | Isolation semantics are binding as **decided policy**; no profile is claimed implemented or qualified (`INV-20`) |
| `cybrik-suite` ADR-0001, ADR-0004 and ADR-0006 (`S11`) | `ACCEPTED` (2026-07-24) | Contract-versioning policy, control-plane/executor split, cross-product event and identity model |
| `cybrik-suite` ADR-0007 — Org hierarchy & external-authority boundary (`S11`) | `ACCEPTED` (W2-C1, 2026-07-24) — **model only; its contract delta stays `PROPOSED — NOT APPLIED`** | The authority-boundary *model* only |
| `cybrik-suite` ADR-0008 — Internal service delegation & workload identity (`S11`) | `ACCEPTED FOR IMPLEMENTATION` (W2-F, 2026-07-24) — **v0.1.0, not stable v1/GA** | The E2/E3 two-layer trust seam, at that strength |
| `cybrik-soc-command-center` ADR-0016 — Sovereign air-gapped AI copilot (`C1`) | **`ACCEPTED MỘT PHẦN`** (ACCEPTED IN PART, Founder 2026-07-18): model choice + environment strategy settled; *hardware tier, diode and sidecar remain `PROPOSED`*; §S7 states the air-gap/diode/vLLM/GPU/RAG parts are **design or V2, not built** | Cited **only** for the settled part, and only as *sovereignty intent*; not cited as evidence that air-gap exists (`INV-16`, `INV-20`) |
| `cybrik-soc-command-center` ADR-0017 — Controlled cross-domain, dual diode + data guard (`C1`) | **`ACCEPTED`** — *"hướng đã được Founder chốt"* (direction settled by Founder, 2026-07-18); **devices, cost and sprint remain open** | The **trust-domain-exchange model** is accepted. Concrete devices are not |
| `cybrik-soc-command-center` ADR-0018 — Sovereign encryption & key management (`C1`) | **`PROPOSED`** (explicitly *"chờ Founder duyệt; CHƯA implement"*) | Not cited as accepted (`INV-16`). Its pluggable-crypto-provider requirement enters this ADR only as a **capability slot** (§5.2 slot 9), not as an accepted mandate |
| `cybrik-soc-command-center` ADR-0019 — Sovereign SIEM (Wazuh/OpenSearch/NSM) (`C1`) | **Accepted as to direction — V2 target, DEFERRED** (Founder 2026-07-19); does **not** supersede `cybrik-soc-command-center` ADR-0015 (Security Onion SIEM/NSM foundation) until a stated V2 activation trigger fires | Cited as *direction* with its defer qualification stated; not cited as an active mandate (`INV-16`) |
| `cybrik-soc-command-center` ADR-0020 — SIEM backend adapter swap-ready (`C1`) | **`Proposed`** (awaiting approval alongside ADR-0019) | Not cited as accepted (`INV-16`). Its *seam-at-the-protocol* reasoning is referenced as **rationale**, not authority |
| `cybrik-soc-command-center` ADR-0021 — Event bus + event store for the PF track, F-14 (`C11`) | **`ĐÃ CHỐT — Founder duyệt theo đề xuất, 2026-07-20`** (settled; Founder-approved as proposed, F-14): the PF data-plane architecture in effect; its status line adds that the PF licence set is Founder-approved (QĐ-D, 2026-07-22) and points to the QD-14 dossier for final legal confirmation — the dossier's own recorded status is `C10` (§7.2) | Cited for its Founder-approved adoption of the `DATA-PLANE-V2` §4 capacity-axis tiers as packaged data-plane configurations within the SOC scope (§6.2). Not cited as suite-wide deployment-tier authority, and no legal conclusion is drawn from its legal-gate wording (`INV-18`) |

Three further status hazards are recorded so they are not repeated. This section is
`HISTORICAL_FINDING` only and states no requirement of its own; the binding citation rules are
`INV-16` in §4:

- **Number collision across repositories.** This ADR is `cybrik-suite` ADR-0015. A different,
  unrelated `cybrik-soc-command-center` ADR-0015 (Security Onion SIEM/NSM foundation, `ACCEPTED`
  2026-07-18; `C1`) already exists. ADR numbers are per-repository, never suite-global — which is why
  `INV-16` requires repository-qualified citation, matching `cybrik-suite:CLAUDE.md`.
- **Number collision within SOC.** Number 0016 was claimed by three unmerged branches (recorded
  in `…/ADR-0019-sovereign-siem-wazuh-opensearch-nsm.md`, `C1`, which took 0019 for that reason), and
  `…/ADR-0016-sovereign-airgapped-ai-copilot.md` (`C1`) documents on `main` which ADR owns 0016 and
  that the dual-diode copy under the same number is a worktree artifact. A worktree
  artifact can therefore carry a different ADR under the same number — which is why `INV-16`
  requires resolution against committed `main` bytes.
- **Qualifier loss.** `cybrik-suite:docs/adr/README.md` (`S1`) is authoritative on suite ADR status and
  carries qualifiers (`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`, *decision only*) that a bare
  "ACCEPTED" drops — which is why `INV-16` requires the qualifier to travel with the citation.

---

## 2. Problem

Four failures were visible in the record when this ADR was first proposed (R1, 2026-08-23). Each is
classified below by its state at R6 against current evidence, using one of `HISTORICAL_CAUSE` (what
produced it), `CURRENTLY_REMEDIATED`, `PARTIALLY_REMEDIATED` or `STILL_OPEN` — per-failure state
markers for this section only, not §0 claim labels, and binding on nothing. None is closed *by
this ADR*, which is `PROPOSED`; where something has since been remediated, the remediation and its
source are named rather than the original wording preserved.

1. **Priority had no durable authority record — remediated; it still has no accepted architecture
   home — open.** `PARTIALLY_REMEDIATED`.
   - `HISTORICAL_CAUSE`: before R3 of this ADR, the 2026-08-23 Founder deployment priority was
     written only in a derived controller state file (`soc-autonomous-state:CURRENT_STATE.json`,
     `X1`) and derived reports — an unversioned working directory with no commit identity. That
     provenance weakness was real and is retained as history (§1.3).
   - `CURRENTLY_REMEDIATED` — durable authority record: since commit `e800a283…` the policy has a
     Git-identity-bound authoritative record under the repository's canonical
     `FOUNDER-DECISION-PACKET-*` convention (`S9`). `CURRENT_STATE.json` is now an operational
     mirror only (`NON_AUTHORITATIVE_CONTEXT_ONLY`) and is no longer the policy authority.
     `FOUNDER_POLICY_DURABLE_AUTHORITY_RECORD = CLOSED (S9)`.
   - `STILL_OPEN` — accepted architecture home: no **accepted** suite-wide deployment-architecture
     ADR consolidates the policy, so accepted architecture still contains nothing that prevents a
     planner from re-deriving a different ordering. This ADR is that consolidation and is
     `PROPOSED`; recording `S9` did not accept it, and `S9` decides nothing beyond its own §1.
     `ACCEPTED_SUITE_WIDE_ARCHITECTURE_HOME = OPEN (pending explicit Founder acceptance of ADR-0015)`.
2. **A provider became "primary" with no authority.** `PARTIALLY_REMEDIATED`.
   - `HISTORICAL_CAUSE`: an AWS estate, a hosted-provider matrix and a self-declared
     `"verdict": "ACCEPTED"` platform decision were produced in the derived layer (`X2`), citing
     `DRAFT` suite evidence among their inputs. No Founder record authorized any of it.
   - `CURRENTLY_REMEDIATED` — the authority question: the Founder packet (`S9` §1.3) records
     `AWS_PRIMARY_FOUNDER_AUTHORITY = NOT_FOUND` and
     `AWS_PRIMARY_DEPLOYMENT_DECISION = VOID_UNRATIFIED_DERIVED_DRIFT` under Founder authority, and
     the derived layer's own `QUARANTINE_NOTICE.md` (`X2`) already self-classifies the estate as a
     quarantined reference implementation.
   - `STILL_OPEN` — the architecture rule: no accepted suite decision places that disposition under
     suite architecture authority or prevents a derived layer from freezing a provider again. §10
     and `INV-12` propose exactly that and bind only on acceptance.
3. **Candidate sets silently excluded the actual priorities.** `STILL_OPEN`.
   - `HISTORICAL_CAUSE`: `soc-production-infrastructure:plans/PRODUCTION_HOST_PROVIDER_MATRIX.json`
     (`X2`) evaluates exactly four candidates — Hetzner Cloud, DigitalOcean, Linode/Akamai, AWS EC2 —
     every one of them a hosted/foreign public provider. A scan for `on-prem`, `private cloud`,
     `bare-metal`, `colo`, `Proxmox`, `VMware`, `OpenStack` in that file returns **zero** matches.
     The matrix correctly labels itself `ADVISORY_ONLY_NON_BINDING`; the defect is the
     **omission**, which makes an advisory ranking structurally incapable of recommending P1 or P2.
   - Nothing in accepted architecture yet requires a candidate set to include P1/P2; `INV-13`
     proposes that requirement and binds only on acceptance.
4. **Sovereignty, isolation and portability requirements are scattered and differently qualified.**
   `STILL_OPEN`. They live across an accepted suite ADR, a partly-accepted SOC ADR, a
   direction-accepted SOC ADR, two proposed SOC ADRs, and several `[PROPOSAL]` or `DRAFT` strategy
   and evidence documents. There is no single place that states which of them bind, at what
   strength, and what remains open. This ADR is the proposed single place.

This ADR proposes to close the open halves of (1)–(3) by establishing authority rules, and (4) by
consolidating — effective only on acceptance, and without promoting any proposal into authority
merely because its content agrees with current policy.

---

## 3. Decision

On acceptance, the following ten decisions become binding — with one stated exception: Decision
A.1 restates Founder policy that is already in force by the Founder decision packet and does not
wait on, or result from, acceptance of this ADR. Each decision is elaborated in its own section
below.

### Decision A — Deployment priority

Decision A has two halves with different authority. They are separated so that neither borrows
force from the other: the first is Founder policy that already exists; the second is what this ADR
proposes to build on it.

**Founder-policy half — Decision A.1, existing Founder policy** (`FOUNDER_POLICY`). Authority:
the Founder decision packet
`cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` at commit
`e800a283fd6f001a579987630839435206b73160` (`S9`), status `DECIDED — RECORDED` (Founder,
2026-08-23). The four value assignments below are reproduced exactly from the packet's §1.2
`NEW_FOUNDER_DEPLOYMENT_POLICY` block (the block name and indentation are omitted; the values are
identical). They are **already in force** by that packet; acceptance of this ADR is **not** required to establish them, and this ADR
adds nothing to them.

```
P1 = ON_PREMISE
P2 = PRIVATE_CLOUD
P3 = SOVEREIGN_CONTROLLED_CROSS_DOMAIN_OR_OPTIONAL_HYBRID
FOREIGN_PUBLIC_CLOUD = DEFERRED_OPTIONAL_DEPLOYMENT_PROFILE
```

The packet's own boundaries travel with these values (packet §2): new policy dated 2026-08-23, not
backdated; no technology selected; no production rollout authority; no implementation authorized;
AWS not banned; scope exhaustive — only the packet's §1 statements are decided, and nothing beyond
them may be inferred from it.

**Proposed half — Decision A.2, ADR-authored architectural consequences**
(`ARCHITECTURAL_INVARIANT`). The three rules below are **not** in the Founder packet. They are
proposed by this ADR as architectural consequences of A.1. Status while this ADR is `PROPOSED`:
**NOT YET ACCEPTED**. They become binding architecture only through explicit Founder acceptance of
ADR-0015 (§17, Acceptance Criterion 1B), and that acceptance grants no implementation authority.
The dependency clauses of the second rule are consolidated as `INV-2` in §4; the rest of A.2 is
binding as Decision text only.

- P1 and P2 MUST be supported deployment profiles for any release that claims general
  availability of the product.
- Foreign public cloud MUST NOT become a release dependency, a core dependency, a CI-gating
  dependency (these three clauses are `INV-2`), or a precondition for qualifying P1 or P2.
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

The conformance subject is the `VERSIONED_DEPLOYMENT_PROFILE`, never `T0`/`T1`/`T2` — as bare
tokens they carry no suite-wide executable conformance meaning until the canonical tier contract is
accepted (§6.2).

### Decision G — Deployment profile / tier semantics

`ARCHITECTURAL_INVARIANT` + `OPEN_QUESTION` — a compound item (§0). The two halves are separated so
neither borrows force from the other:

**Binding half** (`ARCHITECTURAL_INVARIANT`, recorded as `INV-15` and `INV-17` in §4): bare
`T0`/`T1`/`T2` have no suite-wide executable conformance meaning and MUST NOT be used as a normative
conformance target; the normative conformance subject is the `VERSIONED_DEPLOYMENT_PROFILE` defined
in §5.3, and a tier reference that names its vocabulary, axis and version is context, never that
subject. An approved meaning within one scope (§6.2 usage #3) does not create a suite-wide one.

**Open half** (`OPEN_QUESTION` — `CANONICAL_T0_T1_T2_SEMANTICS = OPEN`): what the tokens should
canonically mean **suite-wide** is not decided here and is not decided by this ADR's acceptance. At
least four in-repository usages exist across two orthogonal axes, mutually incompatible across
those axes, one of them Founder-approved and authoritative within the SOC data-plane capacity scope
(§6.2). The open question is the cross-axis
collision, not the status of any one definition. Resolving it requires one versioned tier contract
that names the axes, produced as separate bounded work.

### Decision H — Provider adapter governance

`ARCHITECTURAL_INVARIANT`.

Every deployment/provider adapter MUST satisfy the versioned mandatory baseline of every
`VERSIONED_DEPLOYMENT_PROFILE` it declares support for. Provider-specific capabilities MUST be
namespaced, optional, and capability-advertised, and MUST NOT alter data-sovereignty, authority,
isolation or artifact-integrity semantics (§8).

A declaration of support names a `VERSIONED_DEPLOYMENT_PROFILE` identifier and version. An adapter
MUST NOT declare support against a bare tier name, because no accepted suite-wide contract gives
`T0`/`T1`/`T2` a conformance meaning independent of axis and vocabulary (§6.2).

### Decision I — Provider selection authority

`ARCHITECTURAL_INVARIANT`.

A controller MAY produce advisory provider matrices. It MUST NOT freeze a provider as primary
architecture without explicit Founder or delegated authority, and any provider-selection record
MUST carry the eight fields in §9.1. Candidate sets MUST NOT omit P1/P2 (§9.2).

### Decision J — No synthesized mandatory requirements

`ARCHITECTURAL_INVARIANT`.

A planner or controller MUST NOT manufacture a mandatory requirement by selecting a
provider-native managed service. Source traceability of mandatory architecture requirements is
governed by `INV-14` (§4), which is the single canonical statement of that rule; §10.3 fixes what
counts as a valid authority source under it. A requirement that is untraceable under `INV-14`
remains `ADVISORY`, `CANDIDATE` or `OPEN` (§10.3).

---

## 4. Normative Invariants

Consolidated, numbered for citation. All are `ARCHITECTURAL_INVARIANT` and all are inert until
this ADR is accepted.

| # | Invariant |
|---|---|
| `INV-1` | Product core MUST remain provider-neutral (Decision B) |
| `INV-2` | Foreign public cloud MUST NOT be a release, core, or CI-gating dependency (Decision A.2) |
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
| `INV-15` | Bare `T0`/`T1`/`T2` have **no suite-wide executable conformance meaning** until the canonical tier contract is accepted, and MUST NOT be used as a normative conformance target; a tier reference that names its vocabulary, axis and version is context, never the conformance subject (`INV-17`) (Decision G) |
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

**Why the split is required.** Accepted `cybrik-suite` ADR-0002 (`S3`) already decided that concrete
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
- The worked example is `cybrik-soc-command-center:ops/pf-workers/pf_workers/s3util.py` (`C4`): an S3
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
| 10 | Identity / workload identity | the E2/E3 two-layer trust seam of suite ADR-0006 (`ACCEPTED`) and ADR-0008 (`ACCEPTED FOR IMPLEMENTATION`, v0.1.0, not stable v1/GA) (`S11`) |
| 11 | Observability | trace/metric/log semantics and their sovereignty classification (§7.1) |
| 12 | AI / model runtime | local/private inference, egress posture, model provenance |
| 13 | Artifact / update mechanism | signed bundles, offline install/update, trust root, rollback |

Slots 1–13 are the **minimum**. A later Platform Contract MAY add slots; it MUST NOT silently drop
one.

### 5.3 `VERSIONED_DEPLOYMENT_PROFILE` — the normative conformance subject

`ARCHITECTURAL_INVARIANT` (`INV-17`).

Because no accepted suite-wide contract gives bare `T0`/`T1`/`T2` a conformance meaning independent
of axis and vocabulary (§6.2), this ADR needs a conformance subject that exists independently of the
unresolved tier vocabulary. That subject is the
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

`FOUNDER_POLICY` (Decision A.1, the packet's exact values, in force since 2026-08-23) for the first
two columns. The third column is the consequence proposed by Decision A.2 (`ARCHITECTURAL_INVARIANT`,
not yet accepted); it is not in the packet and is not Founder policy.

| Priority | Packet value (Decision A.1, `FOUNDER_POLICY`) | Proposed consequence (Decision A.2, `ARCHITECTURAL_INVARIANT`) |
|---|---|---|
| **P1** | `ON_PREMISE` | Primary. MUST be a supported profile for any GA release |
| **P2** | `PRIVATE_CLOUD` | Primary. MUST be a supported profile for any GA release |
| **P3** | `SOVEREIGN_CONTROLLED_CROSS_DOMAIN_OR_OPTIONAL_HYBRID` | — (not an A.2 rule; terminology governed by §6.3) |
| — | `FOREIGN_PUBLIC_CLOUD = DEFERRED_OPTIONAL_DEPLOYMENT_PROFILE` | `OPTIONAL_PROFILE`; never a release, core or CI-gating dependency (`INV-2`) |

### 6.2 Tier vocabulary — RESERVED, not defined here

`OPEN_QUESTION` — `CANONICAL_T0_T1_T2_SEMANTICS = OPEN` (Decision G).

The evidence does **not** support consolidating the vocabulary now. At least four in-repository
usages exist, on two orthogonal axes, and one of them is already authoritative within its own
scope:

| # | Usage | Axis | Source and status |
|---|---|---|---|
| 1 | T0 Developer/POC · T1 Enterprise (3+ nodes **or** conformant Kubernetes) · T2 Sovereign/Air-gap | substrate + trust boundary | `cybrik-suite:docs/strategy/03-REFERENCE-ARCHITECTURE.md` §10 — document status `[PROPOSAL]` (`S7`) |
| 2 | T0 single host/Compose · T1 **conformant Kubernetes** · T2 sovereign/air-gap | substrate (narrower T1 than #1) | `cybrik-suite:docs/adr/evidence/ADR-0005-EVIDENCE.md`, `…/ADR-0004-EVIDENCE.md` — both `DRAFT` (`S10`; status per `S1`) |
| 3 | T0 demo/dev ≤2k EPS · T1 standard 3-broker cluster 10–50k EPS · T2 NFR = T1 scaled, 50k sustained/100k burst | **throughput/capacity** (three packaged data-plane sizes) | `cybrik-soc-command-center:docs/architecture/DATA-PLANE-V2.md` §4 (`C6`) — **`ĐÃ CHỐT — Founder duyệt 2026-07-20`** (settled, Founder-approved; *"the official target architecture of the data plane"*); adopted as packaged configurations by SOC ADR-0021 (`C11`) — **`ĐÃ CHỐT — Founder duyệt theo đề xuất, 2026-07-20`**. **Authoritative within the SOC data-plane capacity scope.** Not a suite-wide deployment-tier definition |
| 4 | `architecture_tier: "T0"` = hardened Linux container host, "scales deterministically to T1 Kubernetes"; `RECOMMENDED_CANDIDATE_FOR_T0` and `HIGHER_COMPLEXITY_T1_FOUNDATION` applied to hosted VPS providers | derived platform + provider sizing | `soc-production-infrastructure:architecture/PRODUCTION_PLATFORM_DECISION.json`, `…:plans/PRODUCTION_HOST_PROVIDER_MATRIX.json` — derived layer (`X2`, context only) |

Usages #1/#2 and #3 are **not reconcilable by naming alone**: under #1 a T2 deployment is defined
by its trust boundary (air-gap), while under #3 a T2 deployment is defined by throughput. A
sovereign air-gapped site running at 1k EPS is simultaneously "T2" under #1 and "T0" under #3.
`cybrik-soc-command-center:docs/operations/T1-BRINGUP-EVIDENCE-2026-07-22.md` (`C6`) shows the
collision concretely: the file `deploy/pf/docker-compose.t1.yml` is recorded as carrying *production T2
sizing*.

Accepted suite ADR-0005 answer `J7` (`S2`) **uses** the labels (Kata `RuntimeClass` at T1/T2, direct
Firecracker + jailer at T0) without defining them or naming an axis. The status of the definitions
differs by axis, and is recorded exactly:

- **Substrate / trust-boundary axis (usages #1 and #2).** Every definition sits in a document that
  is itself not accepted: `cybrik-suite:docs/strategy/03-REFERENCE-ARCHITECTURE.md` (`S7`) carries
  `Trạng thái: [PROPOSAL]` in its own header, and the two evidence files (`S10`) are `DRAFT` per the
  authoritative catalog `cybrik-suite:docs/adr/README.md` (`S1`). Both facts are reproducible from
  the committed tree at `BASE_SHA d2b5c7fe799beb94b1dcf0661350de10417da0a3`.
- **Capacity / scale axis (usage #3).** `cybrik-soc-command-center:docs/architecture/DATA-PLANE-V2.md`
  (`C6`) is **Founder-approved and settled** — its own header reads `Trạng thái: ĐÃ CHỐT — Founder
  duyệt 2026-07-20` together with ADR-0021, and calls itself the official target architecture of
  the data plane. Its §4 defines `T0`/`T1`/`T2` by event throughput as three packaged, per-deployment
  data-plane sizes (T0 demo/dev ≤2k EPS; T1 standard 10–50k EPS; T2 NFR 50k sustained / 100k
  burst — the V2 acceptance configuration). SOC ADR-0021 (`C11`), equally Founder-approved
  (`ĐÃ CHỐT — Founder duyệt theo đề xuất, 2026-07-20`), adopts those sizes as its packaged
  configurations ("T0 compose 1-node → T2 NFR"). That vocabulary is therefore **authoritative
  within the SOC data-plane capacity scope**: it is neither a proposal nor a draft, and this ADR
  does not demote it. What it is **not** is a suite-wide deployment-tier definition — it says
  nothing about substrate, trust boundary or sovereignty, and it was decided within one product's
  data-plane scope.

So the reason `CANONICAL_T0_T1_T2_SEMANTICS` stays open is **not** that every definition is
unaccepted. It is **semantic collision across axes**: the same bare token legitimately carries an
authoritative capacity meaning in one scope and a proposed substrate/trust-boundary meaning in
another, and one system receives different labels under each — the 1k-EPS air-gapped site above is
"T2" on one axis and "T0" on the other. Until a canonical, versioned naming contract disambiguates
the axes, a bare `T0`/`T1`/`T2` cannot act as a suite-wide executable conformance vocabulary; and an
accepted suite ADR (ADR-0005) already depends on the tokens without naming an axis.

`NON_AUTHORITATIVE_CONTEXT_ONLY` (§0; `X3`) — a further observation, retained because it is useful
and load-bearing on nothing: an operations file `docs/operations/W0-RECOVERY-WAVE-2-EVIDENCE.md`
exists **untracked** in the canonical `cybrik-suite` checkout and states *"Suite T0/T1/T2 profiles
remain proposals."* It is absent from the committed tree at `BASE_SHA`, is therefore not
reproducible from repository identity, and is **not** cited as proof of anything in this ADR. It
corroborates the committed evidence above; it does not carry it. R1 wrongly used it as an
authoritative source, and this correction removes that dependency rather than committing an
unrelated file to satisfy the citation.

**Bare T0/T1/T2 have no suite-wide executable conformance meaning until the canonical tier contract
is accepted** (`INV-15`, §4). Consequently:

- This ADR **reserves** `T0`/`T1`/`T2` as suite tier tokens and defines none of them suite-wide.
- The normative conformance subject used throughout this ADR is `VERSIONED_DEPLOYMENT_PROFILE`
  (§5.3), never a bare tier name. A claim such as "T1" that does not name the vocabulary, axis and
  version it refers to falls under `INV-15` and `INV-17`; the existence of an approved capacity-axis
  vocabulary in the SOC data plane does not change that.
- The binding rules are `INV-15` and `INV-17` in §4. This section states what is unresolved; it
  creates no requirement of its own.
- Existing documents using `T0`/`T1`/`T2` keep them as dated evidence and context — and, for
  `DATA-PLANE-V2.md` §4 and SOC ADR-0021, as authoritative meaning within their own SOC data-plane
  scope. Nothing is rewritten, nothing is demoted, and no such usage becomes a suite-wide
  conformance target by being quoted here.

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

A concrete instance requiring classification under this rule already exists in the derived layer
(`X2`, context only — the rule does not depend on it):
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

Instances that touch legal interpretation, none of them re-decided here, each stated at its
source's own status:

- data-sharing obligations to A05 and the MTSLCD channel (`cybrik-soc-command-center` ADR-0017,
  `C1`);
- state-cipher obligations under the 2011 Cipher Law for classified data
  (`cybrik-soc-command-center` ADR-0018 — status `PROPOSED`, `C1`);
- distribution-licence clearance (`cybrik-soc-command-center:docs/licensing/LEGAL-REVIEW-QD14-DOSSIER.md`,
  `C10`). At the pinned commit the dossier's own recorded status is: **Founder-signed on
  2026-07-22 (`DA KY DUYET`) as the final internal sign-off.** The dossier states that the company
  has no separate legal function, that the Founder signature is therefore the final approval
  signature, and that no separate internal legal signature exists or is outstanding; four residual
  items (its §3.3, §3.4, §3.6, §3.9) are retained as proposals; and an independent **external**
  legal review is recommended **optionally**, only where a customer contract requires it before
  external distribution. The dossier is therefore *closed at internal-approval level* and is **not**
  awaiting a legal counter-signature. This ADR's `LEGAL_REVIEW_REQUIRED` marker on this item is
  this ADR's own separation rule (`INV-18`) applied to a legal touchpoint — not a statement about
  the dossier's approval status, and not a claim that any legal conclusion in it is unsettled.

Keeping technical-architecture conclusions and legal conclusions in separate records is the binding
part, and it lives in `INV-18`. The legal interpretations themselves remain unresolved (`OPEN-9`).

### 7.3 AI sovereignty — current implementation status, stated exactly

`ARCHITECTURAL_INVARIANT` (Decision D) plus a precise status statement.

**What is true today, from source:**

- The primary runtime path does **not** support a public LLM. The model-seam guard in
  `cybrik-cyber-ai-platform:packages/ai-core/src/cybrik_ai_core/security/egress.py` (`A1`) treats the base
  URL as *"trusted server config only, never request-derived"*, requires an allowlisted host
  (default: loopback only), requires that **every** resolved address be loopback/link-local/private,
  disallows redirects, and fails closed. Its own comment states that a hosted/cloud provider is
  refused and that relaxing this is a distinct Founder decision. The SOC copilot applies the same
  posture in `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/copilot/llm.py` (`C2`;
  `validate_llm_base_url`), rejecting a base URL that resolves to a public address on sovereignty
  grounds.
- **The guard is a strong control, not an absolute one.** `OPEN_QUESTION` —
  `AI_DNS_TOCTOU_EGRESS_GUARD = OPEN`. Both guards resolve the host at **validation** time and the
  request is then issued against the **hostname**, so the connection re-resolves; the validated
  address is not pinned to the socket. A validate-then-connect window therefore exists. The same
  pattern appears in `cybrik-soc-command-center:services/api/src/cybrik_soc/platform/outbound.py`
  (`C3`), whose docstring claims *"connect toi chinh IP da resolve"* (connect to the resolved IP itself — the source file is written in unaccented Vietnamese and is quoted verbatim)
  while `guarded_get` issues the request against the original hostname URL — the claim is stronger
  than the implementation. Closing this window (address pinning, a pinned/injected resolver at the
  transport, or an equivalent) is an open hardening decision.
- **The two guards are not symmetric on resolver injection**, and R1 overstated this. Verified:
  `cybrik-cyber-ai-platform:packages/ai-core/src/cybrik_ai_core/security/egress.py` (`A1`) takes an
  injected `resolver: Resolver = _default_resolver` parameter, so an air-gapped deployment or a test
  can pin resolution — a seam for a fix exists there. `cybrik-soc-command-center:services/api/src/
  cybrik_soc/modules/copilot/llm.py` (`C2`) calls `socket.getaddrinfo(host, port)` directly inside its
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
  test_offline_no_network.py` (`F1`) is a committed no-network contract test, and
  `cybrik-cyber-ai-platform:.github/workflows/ci.yml` (`A4`) carries a lock/offline build path. Both
  are build- and contract-scoped seams, not an install/update path. `QUALIFIED` is **no**: the
  committed `cybrik-suite:contracts/` tree at `BASE_SHA` (`S6`) holds 386 files and **none** of them
  is an offline install, update, upgrade/rollback, update-station or operator-trust-root contract,
  and no accepted suite ADR records such a qualification (`S1`). The requirement itself is accepted
  — `cybrik-suite` ADR-0001 states that air-gapped deliveries reference bundles only and ADR-0008
  requires fail-closed behaviour when trust cannot be resolved offline (`S4`), and ADR-0002 requires
  the stack to remain local/air-gap capable (`S3`). See `OPEN-1`.
- **Isolation (ADR-0005).** `gVisor`/`runsc`, `Firecracker`, `jailer`, `KVM`, Kata `RuntimeClass`
  and the control-side egress broker are **accepted architectural/isolation requirements** at
  ADR-0005's own stated strength — *"decision only"* (`S2`). ADR-0005 states in its own bytes that *"No
  sandbox driver, isolation runtime, egress broker, benchmark or escape test exists or has been run
  in any product repository, and none is claimed here."* A scan of the committed trees confirms no
  sandbox/isolation runtime test exists in any repository. `IMPLEMENTED`, `TESTED` and `QUALIFIED`
  are therefore all **no**, and no profile MAY be described otherwise. Its `J10`
  kernel/hardware/profile/version pins remain deferred to a spike that has not run.
- **AI egress guard.** `IMPLEMENTED` in both products (`A1`, `C2`). `TESTED` covers the
  **validation policy only** — `cybrik-cyber-ai-platform:tests/ai_core/test_security.py` (`A3`)
  exercises scheme rejection, allowlist rejection, public-resolution rejection, empty-resolution and
  resolver-error wrapping, and `cybrik-soc-command-center:services/api/tests/unit/test_llm_adapter.py`
  (`C8`) exercises the SOC guard's `validate_llm_base_url` — allowlist rejection, public-address
  rejection on sovereignty grounds with `socket.getaddrinfo` monkeypatched, internal-address
  acceptance, scheme rejection, and rejection of an external base URL at client construction.
  **No test in either repository covers connect-time address pinning**, which is precisely the open
  item (`OPEN-3`). `QUALIFIED` is **no**.
- **Storage / S3 compatibility.** `TESTED` is **conditional**:
  `cybrik-soc-command-center:ops/pf-workers/tests/test_parquet_archiver.py` (`C5`) runs pure-unit coverage
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
assertion against a profile identifier and version, not a label — and never against a bare tier
name, which has no suite-wide executable conformance meaning (§6.2).

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
  (`X2`) is therefore `NON_AUTHORITATIVE` and MUST be treated as advisory input only.

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

The existing `soc-production-infrastructure:plans/PRODUCTION_HOST_PROVIDER_MATRIX.json` (`X2`) is the
worked negative example: four candidates, all hosted/foreign public
(Hetzner Cloud · DigitalOcean · Linode/Akamai · AWS EC2), zero on-premise, private-cloud or
bare-metal candidates. Under this rule, that candidate set is **incomplete for P1/P2 purposes**
and MUST NOT be used as the basis of any binding selection. Its `ADVISORY_ONLY_NON_BINDING` label
is accurate and is preserved; the artifact is retained as dated provenance.

---

## 10. AWS Drift Disposition

`ARCHITECTURAL_INVARIANT` + `HISTORICAL_FINDING` (Decision A.1 policy applied). The historical half is the
absence-of-authority finding (§10.1 first bullet) and the RC1 findings of §10.2; the binding half is
the classification, retention and adapter conditions of §10.1 and the Decision B application in §10.2.

### 10.1 Disposition

- AWS-primary architecture had **no Founder authority** (`AWS_PRIMARY_FOUNDER_AUTHORITY =
  NOT_FOUND` — recorded by Founder authority at `S9` §1.3, and established from repository evidence
  at `S5`, `S1` and `S7` as set out in §1.2).
- AWS-specific derived architecture is classified:

```
SUPERSEDED_AS_PRIMARY
NON_AUTHORITATIVE
OPTIONAL_REFERENCE_ONLY
```

- Historical artifacts MUST be **retained** for forensic and provenance purposes. This ADR deletes
  nothing, and MUST NOT be executed as a deletion instruction. Concretely retained (`X2`):
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
| **Textual / reference mentions** of provider identifiers | Two figures are kept apart and never substituted for each other. **Raw boundary-token hit files** — the mechanical, reproducible result of the §1.1 token expression (`R1`): `cybrik-suite` **2**, `cybrik-soc-command-center` **12**, `cybrik-cyber-ai-platform` **0**, `cybrik-security-tool-fabric` **0**. **Semantic provider-reference files** — a reviewed classification of each raw hit as a genuine cloud-provider reference or a lexical coincidence: `cybrik-suite` **2**, `cybrik-soc-command-center` **11**, `cybrik-cyber-ai-platform` **0**, `cybrik-security-tool-fabric` **0**. The single difference is `cybrik-soc-command-center:services/api/tests/unit/test_no_hardcoded_colors.py`, whose only hit is the CSS named colour `azure` inside a colour-name list (line 52: `… aquamarine azure beige …`) — a lexical hit, not a cloud-provider reference. The 11 SOC semantic references: architecture documents (`docs/architecture/ENCRYPTION-KEY-MANAGEMENT.md`, `docs/architecture/SIEM-STACK-SOVEREIGNTY-RESEARCH.md` — cloud KMS rejected), governance ADRs (SOC ADR-0018, ADR-0019 — cloud KMS rejected), research documents (`docs/research/SOC-TIER-PERSONA-RESEARCH.md`, `docs/research/GA2-COMPETITIVE-GAP-ANALYSIS.md` — Microsoft Sentinel/Azure comparison), the S16 runbook (`C9`, `aws` CLI against SeaweedFS), `deploy/pf/docker-compose.t1.yml` ("AWS S3-style endpoint"), the S3 client `ops/pf-workers/pf_workers/s3util.py` (`C4`), one Sigma rule (Azure AD Connect exclusion) and one vulnerability-scanner fixture (`aws-access-key-id` secret rule). The 2 suite semantic references: `.gitleaks.toml` (AWS/GCP/Azure key rules) and `docs/security/RESPONSIBLE-DISCLOSURE-POLICY.md` (cloud providers out of scope). R3 stated "roughly twenty" and "eighteen" from a naive substring search (which also matches `laws` and `flaws`); R4 corrected to the boundary-aware raw counts; R5 separates the raw counts from the semantic classification |
| **Dependency-bearing runtime/provider requirement** | **Exactly one**, in `cybrik-soc-command-center:ops/pf-workers/` (`R1`, `C4`). Zero in `cybrik-suite`, `cybrik-cyber-ai-platform` and `cybrik-security-tool-fabric` |

`RC1_TAG_CONTAMINATED = NO` is therefore a statement about **dependency-bearing runtime paths**, not
a claim of tag-wide absence of cloud-provider text. Comparing sovereign alternatives against named
public clouds in an architecture or research document is the analysis working correctly; it is not
coupling. Verification method for the dependency claim (`R1`): scan of every `pyproject.toml`,
`package.json`, `requirements*.txt` and `go.mod` tracked at the RC1 peeled commit in all four
repositories for provider SDKs (`boto3`, `botocore`, `aws-sdk`, `@aws-*`, `azure-*`,
`google-cloud-*`, `oci-sdk`), plus a scan for provider-SDK imports in tracked Python sources.
Verification method for the textual claim (`R1`): `git grep -l -I -E` with the §1.1 token-boundary
expression across all tracked files at each of the four RC1 peeled commits gives the **raw
boundary-token hit** count; each hit is then read and classified as a genuine cloud-provider
reference or a lexical coincidence, giving the **semantic provider-reference** count, with every
classification stated per file in the table. The expression is not altered to exclude the
coincidence, because this ADR defines no principled lexical filter; the reviewed classification is
recorded instead, so both figures remain reproducible.

The one dependency is worth characterizing permanently, because it is exactly the Decision B
case. `cybrik-soc-command-center:ops/pf-workers/pf_workers/s3util.py` (`C4`) uses `boto3` as an
**S3-protocol client** against self-hosted SeaweedFS: `endpoint_url` is a configured SeaweedFS
address (`PF_SEAWEED_S3_ENDPOINT`, default `http://localhost:8333`), addressing style is forced to
`path` because SeaweedFS does not support virtual-host buckets, and `ops/pf-workers/pyproject.toml`
declares the dependency as *"boto3 -> client S3 SeaweedFS"*. The
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` variables in
`cybrik-soc-command-center:docs/operations/RUNBOOK-S16-LAKE-DUAL-WRITE.md` (`C9`, lines 165–166) are
the SigV4 credential env-var **names** that S3-protocol tooling reads — in that runbook they are
exported for the `aws` CLI invoked with `--endpoint-url http://localhost:8333` (SeaweedFS), and boto3
reads the same names — assigned from `PF_SEAWEED_S3_*` values.

There is no AWS endpoint, no AWS account and no AWS service in that path. Under Decision B this
MUST NOT be classified as an AWS infrastructure dependency. A library's vendor origin, an SDK's
env-var naming convention, and a protocol's originating vendor are **not** provider coupling;
provider coupling is a **non-portable endpoint, service or identity requirement**.

### 10.3 Traceability of mandatory requirements

`ARCHITECTURAL_INVARIANT` (Decision J).

A planner or controller MUST NOT manufacture a mandatory requirement merely by selecting
provider-native managed services. The traceability rule itself is stated exactly once, as `INV-14`
in §4, and is not restated here. This section fixes what `INV-14` means by a **valid authority
source** — any of the following five kinds, and nothing else:

1. an **accepted ADR** (cited with its own status qualifier);
2. an **accepted contract**;
3. **Founder authority**;
4. a **binding release requirement**;
5. a **verified implementation constraint** (a constraint demonstrated from code or measurement).

A requirement that traces to none of these remains `ADVISORY`, `CANDIDATE` or `OPEN`. It MUST NOT
be recorded as mandatory, MUST NOT gate a release, and MUST NOT be used to justify a provider
choice. Under `INV-14`, a trace that records only one of several known applicable authorities is
incomplete, not compliant.

Worked negative example, retained as provenance:
`soc-production-infrastructure:architecture/PRODUCTION_PLATFORM_DECISION.json` (`X2`) derives a
platform verdict from four declared inputs. Its two suite-evidence inputs,
`cybrik-suite:docs/adr/evidence/ADR-0004-EVIDENCE.md` and `…/ADR-0005-EVIDENCE.md` (`S10`), are
`DRAFT` **evidence** documents, not accepted ADRs (`cybrik-suite:docs/adr/README.md`, `S1`); its
other two inputs, `cybrik-soc-command-center:deploy/` and Cloudflare authoritative DNS, are a
deployment directory and an external service — none of the five source kinds above. Under `INV-14`
that verdict is `ADVISORY`, not mandatory.

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
| Documents using `T0`/`T1`/`T2` | **No rewrite.** Tokens are reserved suite-wide; existing usages remain dated provenance — and, for `DATA-PLANE-V2` §4 and SOC ADR-0021, authoritative meaning within their own SOC data-plane scope — until the tier contract lands (§6.2) |
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
| 5 | **Consolidate the T0/T1/T2 vocabulary now** by adopting the suite `[PROPOSAL]` definitions | Would promote a `[PROPOSAL]` or `DRAFT` definition into authority purely because it is the most-cited one, and would silently override the Founder-approved orthogonal capacity axis of `DATA-PLANE-V2` §4 (`C6`) within its own scope |
| 6 | **Promote SOC ADR-0018/ADR-0020 into this ADR's authority** because their content aligns with sovereignty policy | Both are `PROPOSED`. Content alignment is not authority. They enter only as a capability slot (§5.2 #9) and as rationale (§8) |
| 7 | **Declare the AI egress guard sufficient** and close the sovereignty question | Overstates the implementation. The validate-then-connect window is real and unclosed (§7.3) |

---

## 14. Open Questions

`OPEN_QUESTION`. These questions remain unresolved at proposal time. Accepting this ADR does **not**
close any of them; their required preservation through acceptance — unclosed, and not converted
into an implementation or maturity claim — is governed by `INV-20` (§4) and Acceptance Criterion 6
(§17). This section creates no requirement of its own.

| ID | Question | Status | Where resolution belongs |
|---|---|---|---|
| `OPEN-1` | `OFFLINE_INSTALL_UPDATE_CONTRACT` | **OPEN** | A versioned contract covering signed offline bundles, operator-owned trust root, offline install, upgrade, rollback and update-station workflow. No such contract exists in `cybrik-suite:contracts/` |
| `OPEN-2` | `S3_COMPATIBILITY_MINIMUM_CONTRACT` | **OPEN** | Platform Contract slot 5 (§14.1) |
| `OPEN-3` | `AI_DNS_TOCTOU_EGRESS_GUARD` | **OPEN** | A bounded hardening decision on the model-seam and copilot guards (§7.3) |
| `OPEN-4` | `CANONICAL_T0_T1_T2_SEMANTICS` | **OPEN** — usages on different axes collide; one of them is Founder-approved within the SOC data-plane capacity scope, none is suite-wide (§6.2) | One versioned tier contract that names the axes |
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
`cybrik-soc-command-center:ops/pf-workers/` (`C4`, `C5`), the surface actually exercised is: `put_object`,
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
own ADR in `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/forensics/__init__.py`
(`C7`), and the current evidence store is a filesystem WORM implementation. Whether Object Lock becomes a
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
  deployment-priority and provider policy of 2026-08-23, Git-identity-bound by R3 commit
  `e800a283fd6f001a579987630839435206b73160` on this branch (the file is unchanged since).
  **This is the sole authority for that policy.**
- *(context only, `X1`)* `soc-autonomous-state:CURRENT_STATE.json` — provenance class
  `NON_AUTHORITATIVE_CONTEXT_ONLY`; role: operational mirror. Not a Git repository, so it has no
  commit identity. It states the same findings but supports no binding conclusion in this ADR

**Suite architecture (`cybrik-suite` @ `d2b5c7fe799beb94b1dcf0661350de10417da0a3`):**
- `docs/adr/README.md` — authoritative ADR-status catalog and lifecycle rule (`S1`)
- `docs/adr/ADR-0005-sandbox-substrate.md` — `ACCEPTED` (GATE A4, 2026-07-26), decision only (`S2`)
- `docs/adr/ADR-0002-cyber-ai-implementation-stack.md` — `ACCEPTED`; `G3`/`G4`/`G5` seams;
  local/air-gap capability requirement (`S3`)
- `docs/adr/ADR-0001-*.md`, `ADR-0004-*.md`, `ADR-0006-*.md`, `ADR-0007-*.md`, `ADR-0008-*.md` —
  statuses and qualifiers as read from the ADR bytes (`S11`; offline/air-gap requirement of
  ADR-0001 and ADR-0008 under `S4`)
- `docs/adr/evidence/ADR-0004-EVIDENCE.md`, `docs/adr/evidence/ADR-0005-EVIDENCE.md` — `DRAFT` (`S10`)
- `docs/strategy/03-REFERENCE-ARCHITECTURE.md` — `[PROPOSAL]`; §1 drivers, §10 deployment tiers (`S7`)
- `docs/strategy/06-ROADMAP-2026-2029.md` — T0/T1/T2 manifests as a future deliverable
- `docs/strategy/08-EVALUATION-SECURITY-COMPLIANCE.md` — egress/exfiltration evaluation posture
- *(not cited as authority)* `docs/operations/W0-RECOVERY-WAVE-2-EVIDENCE.md` —
  `NON_AUTHORITATIVE_CONTEXT_ONLY`: untracked in the canonical checkout, absent from the
  committed tree at `BASE_SHA`, therefore not reproducible from repository identity. Retained as a
  corroborating observation only; no normative decision in this ADR depends on it (§6.2)
- `contracts/README.md` — packet `PROPOSED — NOT ACCEPTED` (v0.1.0) (`S8`)
- `contracts/` — 386 committed files; no offline-install/update or storage contract; no
  provider-identifier token (`S6`)
- `integration/helm/README.md` — `SCAFFOLD`, no charts (`S8`)

**SOC (`cybrik-soc-command-center` @ RC1 peeled commit `695aed8e0e12c9d0e11de5f474e3384d1a4b490f`):**
- `governance/ADR/ADR-0015-security-onion-siem-nsm-foundation.md` — `ACCEPTED` (Founder,
  2026-07-18); number collision with this ADR, unrelated subject (`C1`)
- `governance/ADR/ADR-0016-sovereign-airgapped-ai-copilot.md` — `ACCEPTED MỘT PHẦN` (`C1`)
- `governance/ADR/ADR-0017-dual-diode-a05-mtslcd.md` — `ACCEPTED` as to direction (`C1`)
- `governance/ADR/ADR-0018-sovereign-encryption-key-management.md` — `PROPOSED` (`C1`)
- `governance/ADR/ADR-0019-sovereign-siem-wazuh-opensearch-nsm.md` — direction accepted, V2,
  deferred (`C1`)
- `governance/ADR/ADR-0020-siem-backend-adapter-swap-ready.md` — `Proposed` (`C1`)
- `governance/ADR/ADR-0021-event-bus-event-store-f14.md` — `ĐÃ CHỐT — Founder duyệt theo đề xuất,
  2026-07-20`; adopts the `DATA-PLANE-V2` §4 capacity-axis tiers as packaged configurations (`C11`)
- `docs/architecture/DATA-PLANE-V2.md` — `ĐÃ CHỐT — Founder duyệt 2026-07-20`; §4 defines the
  capacity-axis T0/T1/T2, authoritative within the SOC data-plane scope (`C6`)
- `docs/operations/T1-BRINGUP-EVIDENCE-2026-07-22.md` — T1 file carrying T2 sizing (`C6`)
- `services/api/src/cybrik_soc/modules/copilot/llm.py` — sovereignty base-URL guard (`C2`)
- `services/api/src/cybrik_soc/platform/outbound.py` — tenant-facing SSRF guard (`C3`)
- `services/api/tests/unit/test_llm_adapter.py` — unit test of the sovereignty guard's validation
  policy; no connect-time pinning test (`C8`)
- `services/api/src/cybrik_soc/modules/forensics/__init__.py` — WORM object storage as an open
  checklist item (`C7`)
- `ops/pf-workers/pyproject.toml`, `ops/pf-workers/pf_workers/s3util.py` — boto3 as SeaweedFS
  S3-protocol client (`C4`)
- `ops/pf-workers/tests/test_parquet_archiver.py` — conditional S3 test, skips without a cluster (`C5`)
- `docs/operations/RUNBOOK-S16-LAKE-DUAL-WRITE.md` — SigV4 env-var names bound to SeaweedFS values (`C9`)
- `docs/licensing/LEGAL-REVIEW-QD14-DOSSIER.md` — Founder-signed 2026-07-22 as final internal
  sign-off; no separate internal legal signature; external legal review optional (`C10`)

**Cyber AI (`cybrik-cyber-ai-platform` @ RC1 peeled commit `f0bf4c630d8e93a0531d16b4522ce0425996a624` — *not* current `HEAD`):**
- `packages/ai-core/src/cybrik_ai_core/security/egress.py` — inverse-SSRF model-seam guard (`A1`)
- `services/ai-api/src/cybrik_ai_api/adapters/ollama.py` — guard applied at adapter construction (`A2`)
- `tests/ai_core/test_security.py` — validation-policy unit coverage of the guard (`A3`)
- `.github/workflows/ci.yml` — offline/lock build path (`A4`)

**Tool Fabric (`cybrik-security-tool-fabric` @ RC1 peeled commit `1a419014ebb432eb56ac35242e0a193fe65a62c6`):**
- `tests/control-plane/test_offline_no_network.py` — bounded no-network contract test (`F1`)

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
| `S2` | `cybrik-suite` | `d2b5c7fe…` | `docs/adr/ADR-0005-sandbox-substrate.md` | `COMMIT_BOUND_REPRODUCIBLE` | `ACCEPTED`, decision only (§1.5); isolation floors; "no sandbox driver … has been run" and `J10` pins deferred (§7.4, Decision F); `J7` uses `T0`/`T1`/`T2` without defining them (§6.2) |
| `S3` | `cybrik-suite` | `d2b5c7fe…` | `docs/adr/ADR-0002-cyber-ai-implementation-stack.md` | `COMMIT_BOUND_REPRODUCIBLE` | `G3`/`G4`/`G5` permit concrete implementation adapters (§5, `INV-21`); *"must remain local/air-gap capable"* — an accepted air-gap requirement (§7.4) |
| `S4` | `cybrik-suite` | `d2b5c7fe…` | `docs/adr/ADR-0001-*.md`, `docs/adr/ADR-0008-*.md` | `COMMIT_BOUND_REPRODUCIBLE` | Offline/air-gap as an accepted requirement: bundle-only air-gapped delivery; fail-closed when trust cannot be resolved offline (§7.4) |
| `S5` | `cybrik-suite` | `d2b5c7fe…` | the 14 pathspecs in the §1.1 command, resolving to the **16 files** enumerated in §1.1 (both status-flip application files included); positive control `docs/security/RESPONSIBLE-DISCLOSURE-POLICY.md` at the same commit | `COMMIT_BOUND_REPRODUCIBLE` | Zero provider-identifier matches in every pre-existing suite ADR file ADR-0001 … ADR-0014 — no suite ADR names, selects or ranks a provider (§1.1, §1.2, §1.3, §10.1) |
| `S6` | `cybrik-suite` | `d2b5c7fe…` | `contracts/` (386 committed files) | `COMMIT_BOUND_REPRODUCIBLE` | No offline-install/update or storage contract exists (`OPEN-1`, `OPEN-2`, §7.4); no provider-identifier or provider-SDK token in any committed contract file (§1.2 `CONTRACTS_CONTAMINATED = NO`) |
| `S7` | `cybrik-suite` | `d2b5c7fe…` | `docs/strategy/03-REFERENCE-ARCHITECTURE.md` | `COMMIT_BOUND_REPRODUCIBLE` | `[PROPOSAL]` status; §1 on-prem-first, provider-neutral driver; §10 tier axis (§1.1, §1.2, §1.3, §6.2, §10.1) |
| `S8` | `cybrik-suite` | `d2b5c7fe…` | `integration/helm/README.md`, `contracts/README.md` | `COMMIT_BOUND_REPRODUCIBLE` | Helm `SCAFFOLD`; contracts `PROPOSED — NOT ACCEPTED` (§1.2, §1.4, §11) |
| `S9` | `cybrik-suite` | `e800a283fd6f001a579987630839435206b73160` (R3 commit on this branch; file unchanged since) | `docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` | `COMMIT_BOUND_REPRODUCIBLE` | **Sole authority for the Founder deployment policy** (§1.3, §1.4, Decision A.1); §1.3 of the packet records `AWS_PRIMARY_FOUNDER_AUTHORITY = NOT_FOUND` and `AWS_PRIMARY_DEPLOYMENT_DECISION = VOID_UNRATIFIED_DERIVED_DRIFT` under Founder authority (§1.2, §10.1) |
| `S10` | `cybrik-suite` | `d2b5c7fe…` | `docs/adr/evidence/ADR-0004-EVIDENCE.md`, `docs/adr/evidence/ADR-0005-EVIDENCE.md` | `COMMIT_BOUND_REPRODUCIBLE` | `DRAFT` evidence documents (status per `S1`); the second, narrower tier usage (§6.2 #2); the two cited **suite-evidence inputs** to the derived platform decision — two of the four inputs that the `X2` artifact's `derived_from` field declares (the other two being `cybrik-soc-command-center:deploy/` and Cloudflare authoritative DNS) — cited as drift provenance only, never as authority, exclusivity or platform selection (§1.2, §10.3) |
| `S11` | `cybrik-suite` | `d2b5c7fe…` | `docs/adr/ADR-0001-suite-contract-versioning-policy.md`, `docs/adr/ADR-0004-tool-fabric-control-plane-executor-split.md`, `docs/adr/ADR-0006-cross-product-event-and-identity-model.md`, `docs/adr/ADR-0007-org-hierarchy-and-external-authority-boundary.md`, `docs/adr/ADR-0008-internal-service-delegation-and-workload-identity.md` | `COMMIT_BOUND_REPRODUCIBLE` | Suite ADR status strings and qualifiers as read from the ADR bytes (§1.5, Acceptance Criterion 5); the E2/E3 two-layer trust seam of ADR-0006 and ADR-0008 (§5.2 slot 10) |
| `C1` | `cybrik-soc-command-center` | `695aed8e…` (RC1) | `governance/ADR/ADR-0015 … ADR-0020` | `COMMIT_BOUND_REPRODUCIBLE` | Verified SOC ADR statuses and qualifiers (§1.5, §7.2); sovereign-SOC positioning of ADR-0016/ADR-0017 (§1.1); the ADR-0015 cross-repository number collision and the intra-SOC 0016 collision that ADR-0016 documents (§1.5) |
| `C2` | `cybrik-soc-command-center` | `695aed8e…` | `services/api/src/cybrik_soc/modules/copilot/llm.py` | `COMMIT_BOUND_REPRODUCIBLE` | Sovereignty guard; `socket.getaddrinfo` at line 98, no injection point (§7.3, §7.4) |
| `C3` | `cybrik-soc-command-center` | `695aed8e…` | `services/api/src/cybrik_soc/platform/outbound.py` | `COMMIT_BOUND_REPRODUCIBLE` | Docstring claims IP pinning; `client.get(url…)` at line 69 uses the hostname (§7.3) |
| `C4` | `cybrik-soc-command-center` | `695aed8e…` | `ops/pf-workers/pf_workers/s3util.py`, `ops/pf-workers/pf_workers/parquet_archiver.py`, `ops/pf-workers/pyproject.toml` | `COMMIT_BOUND_REPRODUCIBLE` | boto3 as a portable S3 client; `endpoint_url` + path addressing; the S3 operations actually exercised (`s3util.py` and the archiver's `put_object`) (§1.2, §5.1, §10.2, §14.1) |
| `C5` | `cybrik-soc-command-center` | `695aed8e…` | `ops/pf-workers/tests/test_parquet_archiver.py` | `COMMIT_BOUND_REPRODUCIBLE` | Conditional `TESTED` — the S3 section skips when no cluster answers (§7.4, §14.1) |
| `C6` | `cybrik-soc-command-center` | `695aed8e…` | `docs/architecture/DATA-PLANE-V2.md`, `docs/operations/T1-BRINGUP-EVIDENCE-2026-07-22.md` | `COMMIT_BOUND_REPRODUCIBLE` | `DATA-PLANE-V2.md`: status exactly as written `ĐÃ CHỐT — Founder duyệt 2026-07-20` (settled, Founder-approved, the official target data-plane architecture); its §4 defines `T0`/`T1`/`T2` on a capacity/throughput axis as three packaged data-plane sizes — an **approved, authoritative tier meaning within the SOC data-plane scope**, and one side of the cross-axis collision (§6.2 #3). Not evidence that all tier definitions are proposal/draft, and not a suite-wide deployment-tier definition. `T1-BRINGUP-EVIDENCE`: records `deploy/pf/docker-compose.t1.yml` as carrying production T2 sizing, showing the collision concretely (§6.2) |
| `C7` | `cybrik-soc-command-center` | `695aed8e…` | `services/api/src/cybrik_soc/modules/forensics/__init__.py` | `COMMIT_BOUND_REPRODUCIBLE` | WORM / Object Lock is an open checklist item (§14.1) |
| `C8` | `cybrik-soc-command-center` | `695aed8e…` | `services/api/tests/unit/test_llm_adapter.py` | `COMMIT_BOUND_REPRODUCIBLE` | `TESTED` for the SOC sovereignty guard covers validation policy only — allowlist, public-address rejection with `socket.getaddrinfo` monkeypatched, internal-address acceptance, scheme, external base URL at client construction; no connect-time pinning test (§7.4, `OPEN-3`) |
| `C9` | `cybrik-soc-command-center` | `695aed8e…` | `docs/operations/RUNBOOK-S16-LAKE-DUAL-WRITE.md` | `COMMIT_BOUND_REPRODUCIBLE` | `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` are SigV4 env-var names assigned from `PF_SEAWEED_S3_*` values and exported for the `aws` CLI against `--endpoint-url http://localhost:8333` (lines 165–168); no AWS endpoint, account or service (§1.2, §10.2) |
| `C10` | `cybrik-soc-command-center` | `695aed8e…` | `docs/licensing/LEGAL-REVIEW-QD14-DOSSIER.md` | `COMMIT_BOUND_REPRODUCIBLE` | Dossier status as written at the pinned commit: Founder-signed 2026-07-22 as final internal sign-off; no separate internal legal signature exists; external independent legal review optional, contract-triggered (§7.2). Supports a status statement inside an `OPEN_QUESTION` section only; no binding conclusion rests on it |
| `C11` | `cybrik-soc-command-center` | `695aed8e0e12c9d0e11de5f474e3384d1a4b490f` (RC1) | `governance/ADR/ADR-0021-event-bus-event-store-f14.md` | `COMMIT_BOUND_REPRODUCIBLE` | Status exactly as written: `ĐÃ CHỐT — Founder duyệt theo đề xuất, 2026-07-20` (F-14) — settled, Founder-approved as proposed; the PF data-plane architecture (Kafka KRaft + OpenSearch/Parquet-SeaweedFS + Valkey) in effect. Role: adopts the `DATA-PLANE-V2` §4 capacity-axis `T0`/`T1`/`T2` as packaged configurations ("T0 compose 1-node → T2 NFR") within the SOC data-plane scope — evidence that the tokens already carry an authoritative meaning in one scope (§1.5, §6.2). Not cited as suite-wide deployment-tier authority; its legal-gate wording is recorded, not adjudicated (`C10`, §7.2) |
| `A1` | `cybrik-cyber-ai-platform` | `f0bf4c63…` (RC1) | `packages/ai-core/src/cybrik_ai_core/security/egress.py` | `COMMIT_BOUND_REPRODUCIBLE` | Injected `resolver` at line 72; public addresses refused by design (§7.3) |
| `A2` | `cybrik-cyber-ai-platform` | `f0bf4c63…` | `services/ai-api/src/cybrik_ai_api/adapters/ollama.py` | `COMMIT_BOUND_REPRODUCIBLE` | Guard applied at construction, line 82 (§7.3). **Differs from current `HEAD`**; the RC1 bytes are the cited ones |
| `A3` | `cybrik-cyber-ai-platform` | `f0bf4c63…` | `tests/ai_core/test_security.py` | `COMMIT_BOUND_REPRODUCIBLE` | `TESTED` covers validation policy only, never connect-time pinning (§7.4) |
| `A4` | `cybrik-cyber-ai-platform` | `f0bf4c63…` | `.github/workflows/ci.yml` | `COMMIT_BOUND_REPRODUCIBLE` | Offline/locked build path (`uv sync --locked`, `uv export --frozen`) (§7.4). **Differs from current `HEAD` and is dirty in the working tree**; the RC1 bytes are the cited ones |
| `F1` | `cybrik-security-tool-fabric` | `1a419014…` (RC1) | `tests/control-plane/test_offline_no_network.py` | `COMMIT_BOUND_REPRODUCIBLE` | Bounded offline no-network contract test (§7.4) |
| `R1` | all four repositories | the four RC1 peeled commits above | dependency manifests (`pyproject.toml`, `package.json`, `requirements*.txt`, `go.mod`) and tracked Python imports, scanned for provider SDKs; plus every tracked file scanned for the §1.1 token expression, each hit then classified | `COMMIT_BOUND_REPRODUCIBLE` | Exactly one dependency-bearing provider SDK at RC1, in `ops/pf-workers/` (§1.2, §10.2); **raw boundary-token hit files**: `cybrik-suite` 2, `cybrik-soc-command-center` 12, `cybrik-cyber-ai-platform` 0, `cybrik-security-tool-fabric` 0; **semantic provider-reference files** after reviewed classification: 2, 11, 0, 0 — the one lexical false positive is `services/api/tests/unit/test_no_hardcoded_colors.py` (CSS named colour `azure`) (§10.2) |
| `X1` | `soc-autonomous-state` | **none — not a Git repository** | `CURRENT_STATE.json` | `NON_AUTHORITATIVE_CONTEXT_ONLY` (role: operational mirror) | Context only. Superseded as policy provenance by `S9` (§1.2, §1.3, §1.4) |
| `X2` | `soc-production-infrastructure` | **none — not a Git repository** | `terraform/`, `helm/`, `council/`, `plans/`, `architecture/`, `discovery/`, `QUARANTINE_NOTICE.md` | `NON_AUTHORITATIVE_CONTEXT_ONLY` | Derived-layer drift observations only (§1.2, §1.3, §2, §6.2, §7.1, §9, §10); no binding conclusion rests on the existence or content of these files |
| `X3` | `cybrik-suite` | **untracked at BASE** | `docs/operations/W0-RECOVERY-WAVE-2-EVIDENCE.md` | `NON_AUTHORITATIVE_CONTEXT_ONLY` | Corroboration only; no binding conclusion depends on it (§6.2) |

`X1`, `X2` and `X3` are the complete set of non-reproducible sources in this ADR. No
`ARCHITECTURAL_INVARIANT`, `FOUNDER_POLICY` or `DECISION` rests on any of them. Where a binding
section cites `X2` (§7.1, §9, §10.1), the citation identifies the derived artifact the rule is
applied *to*; the rule's justification traces to `S1`, `S5`, `S7`, `S9` and `R1`.

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

1. **Founder policy reproduced; ADR-authored consequences reviewed — two distinct confirmations.**
   - **1A — Existing policy reproduced, not extended and not re-decided.** The Founder confirms
     that Decision A.1 and §6.1 reproduce `P1 = ON_PREMISE`, `P2 = PRIVATE_CLOUD`,
     `P3 = SOVEREIGN_CONTROLLED_CROSS_DOMAIN_OR_OPTIONAL_HYBRID` and
     `FOREIGN_PUBLIC_CLOUD = DEFERRED_OPTIONAL_DEPLOYMENT_PROFILE` exactly as recorded in
     `cybrik-suite:docs/adr/FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md` at
     `e800a283…` (`S9`), as **new** policy dated 2026-08-23, neither modified nor backdated. That
     policy is already in force by the packet. Acceptance of this ADR is **not** needed to
     establish it, and this criterion does not re-decide it.
   - **1B — ADR-authored invariants explicitly reviewed.** The Founder explicitly reviews the three
     Decision A.2 rules — GA releases support P1 and P2; foreign public cloud is never a release,
     core or CI-gating dependency (`INV-2`) or a P1/P2 qualification precondition; no artifact calls a
     foreign-public-cloud deployment "primary", "the production architecture" or "the target"
     without a separately accepted ADR — which are **not** in the packet and are **not yet
     authorized** by anyone. Acceptance of this ADR is what would make them binding architecture.
     Even then, acceptance grants no implementation, provisioning, deployment or release authority.
2. **Invariants ratified — complete set.** All twenty-two invariants `INV-1` … `INV-22` (§4) are
   accepted as written, or amended before acceptance. The reviewer confirms the set is complete and
   contiguous, that no invariant was omitted from review, and that no `INV-` reference elsewhere in
   this ADR is dangling.
3. **No technology selected.** The reviewer confirms this ADR selects no Kubernetes distribution,
   virtualization product, cloud/hosting provider or storage/database/model product, and that
   `KUBERNETES_PRIMARY_SUBSTRATE` remains `UNDECIDED` with every listed candidate `NOT_SELECTED`.
4. **AWS disposition correct.** AWS is recorded as `SUPERSEDED_AS_PRIMARY`, `NON_AUTHORITATIVE`
   and `OPTIONAL_REFERENCE_ONLY`; artifacts retained; not banned; not primary.
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
the lifecycle `PROPOSED` → `ACCEPTED` or `REJECTED` → (`SUPERSEDED`). R1 left the catalog unedited and
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
  Independent review returned `CHANGES_REQUIRED`, `FOUNDER_ACCEPTANCE_SAFE = NO`.
- **R4** — this file revised only, to fix the exact R3 review findings. Exactly one file. The
  Founder packet and `docs/adr/README.md` are unchanged. R1, R2 and R3 history retained, not
  amended or squashed. Independent review returned `CHANGES_REQUIRED`,
  `FOUNDER_ACCEPTANCE_SAFE = NO`, with three findings.
- **R5** — this file revised only, to close the three R4 review findings. Exactly one file. The
  Founder packet and `docs/adr/README.md` are unchanged. R1–R4 history retained, not amended or
  squashed. Independent review returned `CHANGES_REQUIRED`, `FOUNDER_ACCEPTANCE_SAFE = NO`; all
  R4 findings passed, two findings remained.
- **R6** — this file revised only, to close the two R5 review findings. Exactly one file. The
  Founder packet and `docs/adr/README.md` are unchanged. R1–R5 history retained, not amended or
  squashed.

R6 corrects, in order: §2 temporally qualified — the pre-R3 representation of the Founder
deployment priority only in derived controller state is now a `HISTORICAL_CAUSE`, the durable
Git-bound authority record is `CURRENTLY_REMEDIATED` by `S9` at `e800a283…`, and the accepted
suite-wide architecture home is `STILL_OPEN` pending explicit Founder acceptance of this ADR, with
each of the four failures classified individually rather than declared uniformly unclosed; and the
tier-vocabulary evidence corrected — `DATA-PLANE-V2.md` §4 (`C6`) and SOC ADR-0021 (new row `C11`)
recorded at their exact Founder-approved status as an authoritative capacity-axis `T0`/`T1`/`T2`
within the SOC data-plane scope, the §6.2 claim that every definition sits in unaccepted material
replaced by the per-axis statement, the reason `CANONICAL_T0_T1_T2_SEMANTICS` stays open restated
as cross-axis semantic collision, `C1` narrowed to ADR-0015 … ADR-0020, and Decision G, `INV-15`,
§5.3, §8.1 and `OPEN-4` qualified so that *bare* tokens have no *suite-wide* executable conformance
meaning while `VERSIONED_DEPLOYMENT_PROFILE` remains the sole conformance subject. No policy,
status, open question, invariant number or technology position changed in R6.

R5 corrects, in order: Decision A split into A.1 (the packet's exact Founder-policy values,
`FOUNDER_POLICY`, already in force by the packet at `e800a283…` and not dependent on this ADR's
acceptance) and A.2 (the three ADR-authored rules, `ARCHITECTURAL_INVARIANT`, not yet accepted,
binding only through Founder acceptance of ADR-0015), with §0, §1.3, §3, §6.1 and `INV-2` aligned and
Acceptance Criterion 1 split into 1A (policy reproduced, not extended, not re-decided) and 1B (the
ADR-authored invariants explicitly reviewed); every `FOUNDER_POLICY` occurrence audited against the
packet's §1 and §2; `S10` and its §1.2, §2 and §10.3 references corrected from "the only inputs" to
two of the four inputs the derived platform decision declares, with the other two named and none of
them promoted to authority; and the RC1 textual-mention figures separated into raw boundary-token
hit files (2 / 12 / 0 / 0, mechanical) and semantic provider-reference files (2 / 11 / 0 / 0,
reviewed), with the single lexical false positive — the CSS named colour `azure` in
`test_no_hardcoded_colors.py` — stated rather than filtered, in §10.2 and row `R1` alike.
`RC1_TAG_CONTAMINATED = NO` keeps its dependency-bearing scope unchanged. No policy, status, open
question, invariant number or technology position changed in R5.

R4 corrects, in order: every cross-repository source-ID citation re-checked for semantic support,
with the `C1` and `C2` mis-citations for provider-neutral history and absent AWS Founder authority
replaced by `S5`, `S7`, `S1` and `S9`; dependency-table rows added for every materially cited source that
lacked one (`S10`, `S11`, `C8`, `C9`, `C10`), `S9` pinned to its exact commit, and the `S2`, `S3`,
`S5`, `S6`, `S7`, `C1`, `C4`, `C6`, `R1`, `X1`, `X2` rows corrected to describe exactly the claims they
support; Decision J reduced to a reference to `INV-14`, the single canonical traceability rule, and
the §10.3 restatement removed; the provider scan described as 14 pathspecs resolving to 16 files at
`BASE_SHA`, with the resolved set enumerated; `NON_AUTHORITATIVE_OPERATIONAL_MIRROR` no longer used
as a provenance class — `CURRENT_STATE.json` is provenance class `NON_AUTHORITATIVE_CONTEXT_ONLY`
with the plain role "operational mirror"; `+` confirmed as the only compound syntax and compound
labels ordered most-binding-first (§1.4, §10), with the ordering rule made explicit in §0; standalone
RFC 2119 directives removed from the pure `HISTORICAL_FINDING` table in §1.5 and from the
`OPEN_QUESTION` prose of §14, each now referring to the governing invariant; the QD-14 dossier
status restated from the pinned bytes (Founder-signed 2026-07-22 as final internal sign-off, no
counter-signature pending, external legal review optional); and, found during the source-closure
audit, the §10.2 textual-mention file counts corrected from a substring-search figure to the
boundary-aware counts. No policy, status, open question, decision, invariant number or technology
position changed in R4.

R3 corrects, in order: Founder-policy provenance moved from an unversioned working directory into a
Git-identity-bound record; every material cross-repository source pinned to an exact commit or tag
object rather than mutable `HEAD`; all four RC1 tag identities resolved and recorded, including the
two repositories whose `HEAD` is not RC1; a §16.1 source dependency table added; acceptance criteria
extended to the complete `INV-1 … INV-22` and `OPEN-1 … OPEN-11` sets; compound-label syntax
normalized to `+` only, with evidence-provenance classes separated from claim labels;
R2's undefined ad-hoc label (`NON_AUTHORITATIVE_WORKTREE_ONLY_EVIDENCE`, no longer used anywhere in
this ADR) replaced by the defined `NON_AUTHORITATIVE_CONTEXT_ONLY` provenance class; the provider scan restated as an exact boundary-aware command with controls; Decision J
grammar repaired; and the duplicate source-trace invariant removed, leaving `INV-14` canonical.

In R3 through R6, as in R1 and R2: no Founder signature, cryptographic signature or acceptance
receipt was synthesized; the recording agent added no policy beyond the Founder directive; and this
ADR was not accepted.

R2 corrects, in order: catalog registration; a non-reproducible worktree-only evidence dependency;
unresolved tier names used as a normative conformance target; an over-broad ADR-scan claim; an
over-broad RC1 claim; an asymmetric resolver-injection claim; a three-state maturity model missing
`TESTED`; a `PRODUCT_CORE` boundary that contradicted accepted ADR-0002; and three normative-language
defects (single-label model, binding text inside open-question sections, and "exactly one" authority
source).

No product, contract, test, infrastructure, Terraform, Helm, deployment or controller file was
modified in producing any revision. No technology was selected in any revision.
