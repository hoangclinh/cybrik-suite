# Release Candidate v1.0.0-rc1 — CYBRIK Suite

- **Document ID:** `CYBRIK-RC-V1.0.0-RC1`
- **Document Status:** `DRAFT`
- **Release Candidate:** `v1.0.0-rc1`
- **Milestone:** SOC Post-UAT Production Release Candidate
- **Release Status:** `CANDIDATE_READY_FOR_STAGING_QUALIFICATION`
- **Staging Qualification:** `IN_PROGRESS / PENDING_HUMAN_PR_MERGE`
- **Manifest Binding:** [`releases/manifests/release-candidate-v1.0.0-rc1.manifest.json`](../../releases/manifests/release-candidate-v1.0.0-rc1.manifest.json)
- **Timestamp:** `2026-08-21T16:20:00+07:00` (`Asia/Ho_Chi_Minh`) — the revision timestamp, equal to
  the manifest's `timestamp` and the derived snapshot's `snapshot_timestamp`. Individual observations
  carry their own times: the Cyber AI and Fabric rollups at `13:30`, the SOC rollup at `16:20`, the
  Suite rollup at `16:05`, and the `security.txt` probe at `13:30` and again in this revision
  (§2.1, §9.4).
- **`cybrik-suite` content base:** `7065a7034991e43a1f486d67f84777766b5d0cba` — advanced in this
  revision from `4498bdd3…` (an ancestor), verified 3/3 green under hosted run `32464960479` at
  exactly that head (§2, §2.1, §2.3).
- **Provenance model:** `MANIFEST_BINDS_CONTENT_BASE_WITH_EXTERNAL_RELEASE_TAG_ENVELOPE` — the
  in-repository manifest binds the authoring **content base**; the external release-candidate tag
  `v1.0.0-rc1` (`NOT_CREATED`) binds the final **post-merge** release (§2.3)
- **Residual-item classification:** every item in §9 carries exactly one class from the taxonomy in
  §9.0 — no item is both blocking and deferred
- **Derived snapshot:** [`docs/releases/evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json`](evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json)
  — `DERIVED_RELEASE_EVIDENCE=true`, `AUTHORITATIVE_ORCHESTRATION_STATE=false` (§9.7)

> **Status honesty.** `CANDIDATE_READY_FOR_STAGING_QUALIFICATION` means the candidate is
> assembled, its Suite-local contract validation is green, and the human governance boundaries
> `HB-1`..`HB-5` are closed. It does **not** mean the candidate is qualified, piloted, or GA.
> Staging qualification is `IN_PROGRESS` and blocked on one thing: `PENDING_HUMAN_PR_MERGE` —
> all four pins are unmerged pull-request heads awaiting required human review (§2). The prior
> revision's second blocker, a **failing `type` check at the pinned `cybrik-cyber-ai-platform`
> head**, is **cleared**: the pin has been advanced to `b5ab09c8…`, whose PR #11 rollup is 8/8
> green (§2.1, §9.3a). All four pinned components now carry a green rollup, and
> **all four are bound to an exact hosted run identifier whose `head_sha` equals the pin** (§2.1,
> §9.3). An earlier revision applied the Founder-adjudicated **W2-I status flip** to the artifact
> bytes (§9.1) and recorded the **Fabric path-gating proof** (§9.2a); those bytes now sit inside the
> content base `7065a703…`, so hosted CI has covered them (§4.2). **This** revision advances the
> Suite content base to `7065a703…`, aligns the release catalogs
> ([`docs/releases/README.md`](README.md), [`docs/README.md`](../README.md)) with the fact that a
> release *candidate* manifest exists and `RB-001` is `RESOLVED`, replaces stale `PROPOSED` /
> `UNAPPLIED` prose in the transport validator's header, and reclassifies the `security.txt`
> publication item (§9.4) — a classification change on unchanged facts that waives nothing. §9
> records every item this document could **not** verify — including three fields of the derived
> snapshot that have **no in-repository record at all**, and four cited evidence documents that
> **do not exist** (§9.7).
> Nothing here promotes any contract packet to stable v1/GA, and nothing here is an ADR-0001
> immutable bundle tag.

---

## 1. Release Candidate Overview

`v1.0.0-rc1` is the first assembled release candidate of the CYBRIK Suite. It pins one exact
commit per product repository, names the cross-product contract baselines those commits implement
against, and records the security posture and rollback path under which the candidate may enter
staging qualification.

The candidate covers the four-repository suite topology:

| Repository | Role | Release Scope in this Candidate |
|---|---|---|
| `cybrik-suite` | Cross-product contracts, suite docs, integration harness, release control | Contract packets, responsible-disclosure policy, RFC 9116 `security.txt`, this manifest |
| `cybrik-soc-command-center` | SOC truth: alerts, cases, assets, analyst identity | `soc-portal` (Next.js), `api` (FastAPI + RLS) |
| `cybrik-cyber-ai-platform` | Model runtime, inference/summarization plane, prompt governance | `ai-api` (FastAPI), `ai-worker` (AsyncIO), `packages/ai-core` |
| `cybrik-security-tool-fabric` | Tool execution authority, policy/approval, sandbox, execution receipts | `fabric-control` (FastAPI), Go 1.22 `executor` |

Release blocker **RB-001** (no verified responsible-disclosure channel) is
**RESOLVED (2026-08-20)** per [`RELEASE-BLOCKERS.md`](RELEASE-BLOCKERS.md), closed under human
boundary `HB-3` with the canonical intake address `security@cybrik.ai`. No `BLOCKING — OPEN`
entry exists in the register, so this manifest is created without a Founder waiver clause.

---

## 2. Adopted Repository SHAs — the Four Final Evaluated PR Heads

The manifest pins the **exact head of the final evaluated pull request** in each of the four
repositories. The `cybrik-suite`, `cybrik-soc-command-center` and `cybrik-security-tool-fabric`
SHAs were resolved against the local canonical checkouts on 2026-08-21 (`git cat-file -t` →
`commit`) and their commit subjects read back from those objects. The `cybrik-cyber-ai-platform`
head `b5ab09c8…` is **not present in any local checkout**; it was resolved read-only through the
GitHub API (commit object, PR #11 head ref, compare, check-runs and workflow-runs endpoints). All
four pins were additionally re-verified read-only against the GitHub Actions runs and jobs API — the
`cybrik-cyber-ai-platform` and `cybrik-security-tool-fabric` rollups at 2026-08-21T13:30:00+07:00 and
the `cybrik-suite` and `cybrik-soc-command-center` rollups at 2026-08-21T16:20:00+07:00, after this
revision's Suite commit and the SOC rebase respectively (§2.1). No fetch was performed into any
product repository — this change is scoped to `cybrik-suite` only.

| # | Repository | Pinned PR Head | PR | Branch | Commit Subject |
|---|---|---|---|---|---|
| 1 | `cybrik-suite` | `7065a7034991e43a1f486d67f84777766b5d0cba` | [#56] | `fix/rc-manifest-contracts` | `fix(docs): align W2-I prose, ADR catalog, and release classification taxonomy` |
| 2 | `cybrik-soc-command-center` | `34b6302e6bdc34e3fb334c079680e76166d9b476` | [#13] | `fix/copilot-draft-auth` | `docs(backup): record verified age encrypted restore drill evidence (RTO 1.7s, 56 tables)` |
| 3 | `cybrik-cyber-ai-platform` | `b5ab09c8194bc88cfa7c2fdbb53c672efd06a722` | [#11] | `feature/rc-w2i-conformance` | `fix(test): widen breaker state read to satisfy mypy strict in resilience tests` |
| 4 | `cybrik-security-tool-fabric` | `0e4fee8d08ff9a67c200ce6c5f97a6f277581be9` | [#6] | `chore/sec-md-fabric` | `ci: trigger fresh PR checks on rebased branch` |

The `cybrik-suite` pin is the **content base** this document and its manifest were authored
against — its own commit cannot contain its own SHA. This is the recorded
`MANIFEST_BINDS_CONTENT_BASE_WITH_EXTERNAL_RELEASE_TAG_ENVELOPE` provenance model, not an
oversight. §2.3 states that model in full: the manifest binds the immutable **content base**, and
the **external release-tag envelope** `v1.0.0-rc1` — created after merge, outside this file —
binds the released main-line SHAs.

**None of the four pins is on its repository's `origin/main`.** Every one is an unmerged PR head
whose branch-protection state is `PENDING_REQUIRED_HUMAN_REVIEW`. That is why staging
qualification reads `PENDING_HUMAN_PR_MERGE` rather than `READY` (§7, §9.5). It is now the **only**
CI-shaped reason: the prior revision's failing `type` check at the Cyber AI pin has been cleared by
advancing that pin to `b5ab09c8…` (§2.1, §9.3a), and every pin now has a green hosted run at the pin
itself. The non-CI open items in §9 — chiefly the unsourced evidence documents (§9.7) and the
unbound rollback targets (§9.6) — remain.

The `cybrik-suite` pin `7065a703…` is the local authoring parent of the commit carrying this
revision. **It has been pushed**, and it has its own hosted run — `32464960479`, 3/3 green (§2.1) —
so the Suite rollup is observed at the pin itself, not at an ancestor.

**The SOC pin advanced in this revision.** The prior pin `2822b9e1…` was `BEHIND` `origin/main`,
and `main` requires strict up-to-date checks, so that head could **never** satisfy branch
protection — recorded as pre-merge blocker 1 of `CODEX-ADJ-005`. Updating the branch necessarily
produced a new SHA. PR #13 is now rebased onto `origin/main` `4480a412…` and pinned at
`34b6302…`, which carries the age-encrypted restore drill (§6.4b). `2822b9e1…` is **not** an
ancestor of the new pin. This removes a branch-protection *impossibility*; it does not merge
anything (§9.5).

### 2.1 Relationship to the Authorized R22 Subjects

Each pin is classified against the authorized RC subject recorded for its repository. Three of the
four branches (`cybrik-suite`, `cybrik-cyber-ai-platform`, `cybrik-security-tool-fabric`) were
**rebased** after the subject was authorized, so the authorized SHA is no longer an ancestor of the
pinned head; the authorized *commit subject* is carried at a rewritten SHA on the pinned branch.
Ancestry below was verified with `git merge-base --is-ancestor` for the Suite, SOC and Fabric
pins. The Cyber AI pin `b5ab09c8…` is absent from every local checkout, so its ancestry was
verified read-only through the GitHub compare API instead (`status`, `ahead_by`, `behind_by`,
`merge_base_commit`); no fetch was performed into that repository.

| Repository | Authorized R22 Subject | Containment vs. Pinned Head | Classification |
|---|---|---|---|
| `cybrik-suite` | `c518d8e344c412dc884135e3947213c5de41739f` | **Rebase rewrite.** Not an ancestor (merge base `55e94c28…`); identical subject carried at `f051192…`, a verified ancestor of `7065a703…`; `7003835…` is the pinned head's direct parent, and the prior manifest pins `4498bdd3…` and `eba517bf…`, plus `be7e7361…`, `afc9150a…` and `7f41296…`, are also ancestors (each checked locally with `git merge-base --is-ancestor`) | `VALID_SUCCESSOR_CONTAINING_AUTHORIZED_SUBJECT` |
| `cybrik-soc-command-center` | `992eabdcdd8a70bd44c7a21119df2211c9e02c8c` | **Rebase rewrite.** PR #13 was updated onto `origin/main` `4480a412…`, so neither the authorized SHA nor the previous manifest pin `2822b9e1…` is an ancestor of `34b6302…` (merge base with `2822b9e1…` is `1b6671cc…`). The authorized subject `fix(copilot): enforce soar:author authorization check on draft_playbook seam` is carried at `15f2f7b`, a verified ancestor of the pinned head. **`origin/main` `4480a412…` is itself now a verified ancestor** (pin 10 ahead) | `VALID_SUCCESSOR_CONTAINING_AUTHORIZED_SUBJECT` |
| `cybrik-cyber-ai-platform` | `b867220fdc07d736e625e5fac88c6baf4d0d431f` | **Rebase rewrite.** Not an ancestor (merge base `2dd7aca2…`; pin 35 ahead / 3 behind); subject `test(w2i): add contract-to-runtime transport conformance test suite for v0.2.0` carried at `f9dad52…`, a verified ancestor of `b5ab09c8…` (pin 5 ahead); the previous manifest pin `5d0c2d43…` is the pinned head's **direct parent** (1 ahead / 0 behind), and `6793e217…` (2 ahead) and `ccbfb4f8…` (3 ahead) are also ancestors | `VALID_SUCCESSOR_CONTAINING_AUTHORIZED_SUBJECT` |
| `cybrik-security-tool-fabric` | `9a80ebebd00bae90b1f3e379c27d672b263124d4` | **Rebase rewrite.** Not an ancestor (merge base `3292a65a…`); subject `docs(security): update SECURITY.md to active responsible disclosure policy` carried at `49bc3d8` on the pinned branch | `VERIFIED_EQUIVALENT_REWRITE` |

CI status was verified from the **GitHub Actions runs and jobs API by exact run identifier** — the
Cyber AI and Fabric runs at 2026-08-21T13:30:00+07:00, the SOC run at 2026-08-21T16:20:00+07:00 and
the Suite run at 2026-08-21T16:05:00+07:00 (each re-observed after this revision's Suite commit and
the SOC rebase).
For every component the run object was fetched by id and its `head_sha` compared against the pin. **All four components are green, and all four runs sit at the pin
itself** — the prior revision's Suite caveat (rollup observed only at an ancestor) is closed.

| Repository | Run ID | Run `head_sha` = pin? | Observed Check Rollup | Verdict |
|---|---|:---:|---|:---:|
| `cybrik-suite` | `32464960479` (`contracts`) | **yes** — `7065a703…` | **3 / 3** successful — `secret-scan` (`96719525344`), `contract standards validation` (`96719525219`), `topology rehearsal tests` (`96719524994`); 0 skipped; 0 failing. Companion push-event run `32464954616` at the same head is also 3/3 green | **GREEN** |
| `cybrik-soc-command-center` | `32460749335` (`ci`) | **yes** — `34b6302…` | **9 / 9** successful — `api`, `backup-tool`, `pf-workers`, `web`, `secret-scan`, `dependency-scan`, `sbom`, `e2e`, `e2e-org`; 1 skipped (`alert-context-route-db`); 0 failing. A **fresh** qualification run at the rebased head, not the superseded run `32447499849` | **GREEN** |
| `cybrik-cyber-ai-platform` | `32452271445` (`ci`) | **yes** — `b5ab09c8…` | **8 / 8** successful — `scaffold-integrity`, `lockfile-integrity`, `secret-scan`, `security-supply-chain`, `lint`, `type`, `test`, `build-offline`; 0 skipped; 0 failing. The `test` job's own log reads **`1065 passed, 17 skipped, 9 warnings in 20.38s`** | **GREEN** |
| `cybrik-security-tool-fabric` | `32389505003` (`ci`) | **yes** — `0e4fee8d…` | **4 / 4** successful — `scaffold-integrity`, `secret-scan`, `detect`, `admission-gate`; 2 **path-gated** skips (`control-plane`, `executor`), proven correct in §9.2a; 0 failing | **GREEN** |

Per-job identifiers for all four runs are recorded in the manifest under
`repositories.<repo>.ci_checks`, so every green claim above is traceable to a specific job.

The Cyber AI entry is the change in this revision. The prior pin `5d0c2d43…` failed `type` (exit
code 1, workflow run `32451755425`, job `96681490549`), which skipped `test` and `build-offline`
and left that pin with no hosted test evidence. Its direct child `b5ab09c8…`, pinned here, fixes
the `mypy --strict` breaker-state read in the resilience tests and takes the full suite green under
workflow run `32452271445`: `type` `96682896755`, `test` `96682973118`, `build-offline`
`96683084302`. The pin therefore now carries hosted test evidence **at the pin itself**, including
for the W2-I conformance suite (§3.1, §4.1, §9.3a).

The Suite pin advanced again in this revision, to `7065a703…` — the direct child of `7003835…`,
and the authoring parent of the commit carrying this document — which has its own hosted run,
`32464960479`, green 3/3, plus a companion push-event run `32464954616` at the same head. The pin
advances at every revision by construction, because the content base is always the authoring
parent (§2.3); the prior pin `4498bdd3…` was itself 3/3 green under `32458843295` and remains a
truthful record of what the prior revision evaluated. It is an ancestor of `7065a703…`.

One scope limit still applies to the all-green rollup: a green hosted run is a **check-state
observation**, not a re-executed suite (§9.2) and not a merge. All four pins remain unmerged heads
under `PENDING_REQUIRED_HUMAN_REVIEW` (§9.5). One test count is now bound — the Cyber AI `test`
job's own log line at the pin, read read-only from the job-logs API (§4.1) — but no run emits a
per-test **transcript** into this repository, and **no coverage figure is bound for any
component**.

The control record `soc-autonomous-state:VERIFIED_SUBJECTS.json` (recorded
2026-08-21T10:35:00+07:00) predates the SOC, Cyber AI and Suite hardening heads: it records
`SUCCESS` for the **ancestor** heads `7be18872…`, `ccbfb4f8…` and `f051192…`, and for the Fabric
pin `0e4fee8d…` exactly. The rollups above are an observation of check state, **not** a
re-execution of any suite. **Every** pin's run and job identifiers are now recorded above and in
the manifest, including the SOC pin's — which closes the corroboration gap the prior revision
recorded at §9.3.

### 2.2 Relationship to the SHAs Carried in the Engineering Evidence Records

The prior revision of this section pointed at three evidence documents that **do not exist in any
suite repository**. Rather than repeat dangling links, this revision states the ancestry facts and
routes every dependent claim to §2.2a, where each one is either re-sourced or explicitly withdrawn.
Ancestry below was verified with `git merge-base --is-ancestor` and `git rev-list --count`, except
for the Cyber AI pin, which was compared through the GitHub compare API (§2.1):

| Repository | Evidenced SHA | Pinned Head | Ancestry (verified) | Evidence Carry-Forward |
|---|---|---|---|---|
| `cybrik-cyber-ai-platform` | `281b2529…` | `b5ab09c8…` | **Divergent** — merge base `2dd7aca2…`; pin is 35 commits ahead, evidenced SHA 1 commit off-line (`feat(auth): add fail-closed service delegation verifier (W2-H1)`) | **Does NOT carry forward.** The `258 / 258` figure is **withdrawn** (§2.2a). The pin has its own hosted `test` result at the pin — `1065 passed, 17 skipped, 0 failed` (§2.1, §4.1). |
| `cybrik-security-tool-fabric` | `147a1d83…` | `0e4fee8d…` | **Divergent** — merge base `3292a65a…`; pin is 29 commits ahead, evidenced SHA 1 commit off-line (`feat(contracts): load the auth/org vendored snapshot as its own registry`) | **Does NOT carry forward.** The `172 / 172` and Go executor figures are **withdrawn** (§2.2a). The pin's control-plane and executor verification is **inherited** through proven path gating (§9.2a), not re-executed. |
| `cybrik-soc-command-center` | `4480a412…` (CI run `32164562480`, 8/8 required contexts) | `34b6302…` | **Ancestor** — `4480a412…` is a verified ancestor of the pin (pin 10 ahead). This is a **provenance improvement**: under the prior pin `2822b9e1…` the same SHA was divergent (11 ahead / 56 behind) | **Carries forward as ancestry.** The UAT-walkthrough surface is contained in the pin. The per-run figures (`Playwright 31 passed`, `pytest 279 / 278 / 1`) are still **withdrawn** as pin-bound (§2.2a): they belong to run `32164562480` at the ancestor, not to the pin, which has its own qualification run (§2.1). |

### 2.2a Evidence Reconciliation — What Replaced the Five Missing Documents

The prior revision recorded that the specification cited **five** evidence documents present in no
suite repository, leaving every headline product test result and the entire adversarial security
matrix unsourced in-repository. `CODEX-ADJ-005` pre-merge item 2 repeated that finding. It is
resolved here by **re-sourcing or withdrawal** — no missing document was authored to close the gap,
because authoring one would be inventing release evidence.

| Was cited as | Disposition | Now sourced from |
|---|---|---|
| `docs/operations/CYBER-AI-RUNTIME-ENGINEERING-EVIDENCE.md` | **Replaced with current exact evidence** | GitHub Actions run `32452271445`, job `test` (`96682973118`), **at the pin** `b5ab09c8…` — log line `1065 passed, 17 skipped, 9 warnings in 20.38s`; full rollup 8/8 green |
| `docs/operations/TOOL-FABRIC-RUNTIME-ENGINEERING-EVIDENCE.md` | **Replaced with current exact evidence** | GitHub Actions run `32389505003` **at the pin** `0e4fee8d…` — 4/4 green, 2 path-gated skips proven correct from the `detect` job's own log and the PR #6 file list (§9.2a) |
| `docs/operations/LIVE-VERTICAL-TRIAD-ENGINEERING-EVIDENCE.md` | **Replaced with Founder UAT ratification** | Candidate R22 Founder UAT Ratification, `LIVE_VERTICAL` gate **PASS** (HB-5, 2026-08-20) — `soc-autonomous-state:founder-uat-r22/FOUNDER-UAT-DECISION.md`, sha256 `78bc11ca…` |
| `docs/operations/DEPLOY-ROLLBACK-REHEARSAL-ENGINEERING-EVIDENCE.md` | **Partially replaced; remainder `POST_MERGE_REQUIRED`** | Linear Alembic downgrade qualification in CI + Docker Compose rollback-target inheritance (§6.4a). The service-rehearsal numbers are **not** re-sourced — they are reclassified `POST_MERGE_REQUIRED` because the targets must be rebuilt from merged SHAs |
| `docs/uat/evidence/SOC-UAT-SURFACE-TECHNICAL-EVIDENCE-2026-08-19.md` | **Replaced with Founder UAT walkthrough pass** | Candidate R22 Founder UAT walkthrough — `FOUNDER_PRODUCT_ACCEPTANCE` **PASS** and `SOC_UAT_SURFACE` gate **PASS** (HB-5, 2026-08-20), same decision record, sha256 `78bc11ca…` |

**Withdrawn, not re-sourced.** Six figures previously carried only by the missing documents are
removed from this specification's claims rather than restated: Cyber AI `258 / 258` and `96.63%`
coverage; Fabric `172 / 172` and the Go executor / `FuzzParse` results; Playwright `31 passed`; and
pytest `279 collected / 278 passed / 1 skipped`.

**Scope limits that survive the reconciliation.** The two Founder-UAT replacements are **human gate
ratifications, not machine transcripts**. In particular the `NEG-1..NEG-6` negative security matrix
is now ratified at **gate** level and remains unsourced at **scenario** level: no per-case
identifier, input, expected rejection or observed rejection is bound in any suite repository. That
is a real, narrower open item, and it is carried in §9.7 rather than closed.

Zero dangling evidence paths remain in this document.

[#56]: `cybrik-suite` PR 56
[#13]: `cybrik-soc-command-center` PR 13
[#11]: `cybrik-cyber-ai-platform` PR 11
[#6]: `cybrik-security-tool-fabric` PR 6

### 2.3 Provenance Model — Content Base vs. External Release-Tag Envelope

The manifest's `provenance_model` is
`MANIFEST_BINDS_CONTENT_BASE_WITH_EXTERNAL_RELEASE_TAG_ENVELOPE`. It is a **two-part** binding, and
each part answers a different question:

| Binding | Where it lives | What it binds | State today |
|---|---|---|---|
| **Content base** | `releases/manifests/release-candidate-v1.0.0-rc1.manifest.json`, in this repository | The exact commits that were *evaluated*: one pre-merge PR head per product repository, plus the `cybrik-suite` **authoring parent** of the commit that carries the manifest | **Bound** — the four SHAs in §2 |
| **Release-tag envelope** | An external tag `v1.0.0-rc1`, created *after* merge, outside this file | The commits that are *released*: the merged `origin/main` SHAs of all four repositories | **NOT_CREATED** — no such tag exists in any repository |

Why the manifest cannot do both jobs:

1. **A manifest cannot contain its own SHA.** The commit that adds or edits the manifest gets its
   hash *after* the bytes are fixed, so the `cybrik-suite` pin is necessarily the authoring parent
   — `7065a703…` here, `4498bdd3…` in the prior revision. That pin is a content-base marker, not a
   claim that `7065a703…` is the released Suite commit. It follows that the pin **advances at every
   revision**; each value truthfully records the content base that revision was authored against,
   and the release identity is carried by the tag `v1.0.0-rc1`, never by the pin.
2. **Pre-merge heads are mutable identities.** Every pin in §2 is an unmerged PR head under branch
   protection, and three of the four branches have already been rebased at least once (§2.1), which
   rewrites SHAs while preserving subjects. Only a post-merge `main` SHA is stable enough to be a
   release identity.

The consequence for readers — and the specific ambiguity `ABMB-04` raises: **a content-base pin
must never be read as a released SHA.** Nothing in §2 has been released, tagged, deployed, or
promoted. `v1.0.0-rc1` as a *tag* does not exist yet.

The envelope may be created only when all of the following hold:

- all four pull requests (#56, #13, #11, #6) are merged to their repositories' `origin/main`;
- each merged SHA has its own completed, green check rollup — every *pre-merge* pin now has one, at
  the pin itself (§2.1) — but no merged SHA exists yet;
- the open items in §9 are closed; and
- the Founder explicitly approves. Tag creation, push and publication are **not** delegated by this
  document or its manifest (§10).

---

## 3. Contract Baselines

Cross-product contract governance for this candidate, as recorded in the manifest's
`contract_governance` block.

| Gate | Packet Manifest | Version | Governance Status |
|---|---|---|---|
| **W2-F** — internal service delegation + workload identity | [`contracts/compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json) | `0.1.0` | `ACCEPTED FOR IMPLEMENTATION` (Gate W2-F, 2026-07-24) |
| **W2-G** — organizational hierarchy + external-authority boundary | [`contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json) | `0.1.0` | `ACCEPTED FOR IMPLEMENTATION` (Gate W2-G, 2026-07-24) |
| **W2-D** — AI model-inference + alert summarization | [`contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json) | `0.1.0` | `ACCEPTED FOR IMPLEMENTATION` (Gate W2-D, 2026-07-24) |
| **W2-I** — inference-plane transport binding | absorbed into the **W2-D** manifest above (there is one manifest for these operations, before and after the flip) | `0.2.0` | **`ACCEPTED FOR IMPLEMENTATION`** — Decision Council, boundary `HB-4`, 2026-08-20; **status flip applied to the artifact bytes 2026-08-21 (§9.1)** |

The **W2-I acceptance decision is closed and now applied**. Boundary `HB-4` (`W2_I_ACCEPTANCE`) is
`CLOSED` with resolution `SATISFIED_BY_COUNCIL_DECISION_ACCEPT`, recorded at
`soc-autonomous-state:AUTHORITY_INBOX.json` `INBOX-007` (decision `ACCEPT`, 2026-08-20T19:15+07:00).
Unlike the prior revision, the in-repository artifact bytes now match that decision: the four
transport-binding members are `ACCEPTED FOR IMPLEMENTATION` inside the accepted W2-D packet
manifest, the v0.1.0 OpenAPI member is relabelled `SUPERSEDED-SUPPORTED` (byte-frozen), ADR-0011 is
`ACCEPTED`, and the companion delta is consumed (`x-cybrik-applied: true`). §9.1 records the flip in
full, including what it deliberately did **not** do.

**W2-I is listed against the W2-D manifest on purpose.** Founder Option A (`G-W2I-2`) permits
exactly one compatibility manifest for the four inference operations. The binding entered as a
successor *revision* of the W2-D-owned OpenAPI member, not as a packet of its own, so there is no
separate W2-I manifest to cite — and the forward-looking
`…inference-plane.v0.2.0-candidate.manifest.json` the prior revision named as *planned* is
**withdrawn** rather than pending.

**Accepted ≠ implementable everywhere.** The two GET operations remain blocked on the undischarged
W2-F operation-token amendment: no delegation token may lawfully authorize `listModelClasses` or
`getModelClassHealth` yet (§9.1). The two POST operations are unaffected.

**Classification — `DEFERRED_NON_BLOCKING_GOVERNANCE_ITEM` (§9.0).** The W2-F operation-token
vocabulary amendment for the two **read** tokens is *deferred to post-RC1* and is **not** a blocker
for `v1.0.0-rc1`. The reason is exact rather than tolerant: the delegation tokens that `v1.0.0-rc1`
authorizes are the two **create** tokens `ai.inference.create` and `ai.alert_summarization.create`,
both already accepted W2-F vocabulary; `v1.0.0-rc1` claims no authorized read-token operation, so
the missing read vocabulary removes nothing this candidate offers. The amendment is a *governance*
act at W2-F's own gate — amending it here would edit bytes accepted at a different gate. Until it is
recorded, `listModelClasses` and `getModelClassHealth` are accepted **transport** contract shape with
no lawful **delegation** authorization, and no implementation may present a token for either. That
constraint is a scope statement about the two reads, **not** a residual blocker against the
candidate.

Both W2-F and W2-G packets are `x-cybrik-packet-version: 0.1.0` with
`x-cybrik-is-bundle-tag: false`. Neither is a stable v1/GA promotion; per ADR-0001 D2 no N-1
compatibility obligation attaches pre-GA, but every future incompatibility must be recorded in the
packet manifests.

### 3.1 W2-I Transport Execution Posture

The manifest records the W2-I transport posture as
`BOUNDED_FAIL_CLOSED_ADAPTER (NO_EXTERNAL_AUTHORITY_ESCALATION)`. Concretely, at the ancestor head
`6793e217…` — a verified ancestor of the pinned `cybrik-cyber-ai-platform` head `b5ab09c8…`, whose
own `test` check is now green (§2.1, §9.3a) — the transport conformance suite
(`tests/contract/test_w2i_transport_conformance.py`, 17 test functions plus parameterization)
asserts that the relying party:

- accepts only mTLS with a certificate-bound (`cnf`) delegation token;
- rejects certificate-thumbprint mismatch, audience mismatch, expiry (including at the skew
  boundary), replay of a seen `jti`, symmetric `alg`, and a missing `cnf`;
- **denies rather than allows when the replay store is unavailable** — the fail-closed property;
- preserves tenant and data marking such that an advisory request body can never elevate the
  token's tenant nor escalate its marking;
- maps every transport denial class to exactly one typed `(type, title, status, detail)` problem
  tuple, with the problem `type` a dotted token rather than a dereferenceable URL.

---

## 4. Test Pass Matrices

### 4.1 Per-Repository Suites

| Repository | Suite | Result | Source | Re-executed for this RC? |
|---|---|---|---|---|
| `cybrik-cyber-ai-platform` | pytest (ai-api, ai-core, ai-worker, contract) **at the pin** `b5ab09c8…` | **1065 passed, 17 skipped, 0 failed** (`9 warnings in 20.38s`) | Job `96682973118` of run `32452271445` — the `test` job's own log, read read-only from the job-logs API (§2.2a) | **Hosted, at the pin. No coverage figure is published into this repository.** |
| `cybrik-cyber-ai-platform` | + W2-I transport conformance (suite introduced at ancestor head `6793e217…`, present on the pinned branch) | Previously recorded as **276** unit/contract tests at `b867220f…`; the hosted PR #11 `test` check is **`SUCCESS` at the pin `b5ab09c8…`** (job `96682973118`, run `32452271445`) — pass/fail only, no per-test transcript | Run `32452271445` verified by id 2026-08-21T13:30:00+07:00 (unchanged in this revision) | **No local re-run; hosted pass/fail at the pin, no transcript; see §9.2, §9.3a** |
| `cybrik-security-tool-fabric` | control plane + Go executor **at the pin** `0e4fee8d…` | **Not re-executed at the pin — `INHERITED`.** Both jobs are path-gated skips, proven correct: PR #6 changes exactly one file (`SECURITY.md`) and zero bytes under either plane's trigger paths (§9.2a) | Run `32389505003`, `detect` job `96492567174` execution log + PR #6 file list | **No. Verification is inherited from the base commit on `main`; no test count is claimed at this pin.** |
| `cybrik-soc-command-center` | Founder UAT walkthrough of the SOC surface at `4480a412…` | **`FOUNDER_PRODUCT_ACCEPTANCE` PASS** and **`SOC_UAT_SURFACE` gate PASS** — core SOC portal, persona flows P1–P6, tenant switching, Cyber AI Copilot, Live Vertical triad | `soc-autonomous-state:founder-uat-r22/FOUNDER-UAT-DECISION.md` (sha256 `78bc11ca…`), HB-5, 2026-08-20 | **Human ratification, not a machine transcript.** `4480a412…` is a verified ancestor of the pin (§2.2). The Playwright and pytest figures from run `32164562480` are **withdrawn** as pin-bound (§2.2a). |
| all four PR heads | hosted CI runs at the pinned heads | **All four green, each at the pin itself** — Suite 3/3 (run `32464960479`), SOC 9/9 (run `32460749335`), Cyber AI 8/8 (run `32452271445`), Fabric 4/4 + 2 path-gated skips (run `32389505003`); 0 failing anywhere | GitHub Actions runs + jobs API by exact run id, 2026-08-21T13:30:00+07:00 to 16:20:00+07:00 (§2.1) | **Check state verified, no suite re-executed by this repository (§2.1, §9.2)** |
| `cybrik-suite` | `node tools/contract-validation/validate-transport.mjs` | **PASS (exit 0)** — lifecycle `ACCEPTED FOR IMPLEMENTATION` | Executed 2026-08-21 against the flipped bytes — §4.2 | **Yes — re-run for the W2-I flip (§9.1)** |
| `cybrik-suite` | `node --test tools/contract-validation/tests/validate-transport.test.mjs` | **204 / 204 passed**, validator line + branch coverage above the 80% floor | Executed 2026-08-21 — §4.2 | **Yes** |
| `cybrik-suite` | `node tools/contract-validation/validate-inference.mjs` | **PASS (exit 0)** | Executed 2026-08-21 against the flipped W2-D manifest — §4.2 | **Yes** |

> **Sourcing note.** The prior revision flagged the Cyber AI `258 / 258`, the Fabric `172 / 172`,
> the Go executor results and the SOC `8 / 8` / Playwright / pytest figures as reproduced from
> evidence documents that exist in **no** suite repository. Those figures are now **withdrawn**
> rather than left standing, and the rows above carry what is actually observable at the pins
> instead (§2.2a). Two limits remain and are not papered over: nothing in this table was
> re-executed **by this repository** (§9.2), and no **coverage** figure is bound for any component.

### 4.2 Suite Contract Validation Executed for this Candidate

Re-executed on 2026-08-21 **against the flipped bytes** this candidate carries (§9.1). The W2-I flip
changed `contracts/`, so once it was applied a re-run became mandatory rather than optional, and it
has been re-run at every revision since — including this one, whose only tooling change is the
comment-only validator header noted below.
The same validators run in hosted CI under the `contract standards validation` check of run
`32464960479` at the pinned head (§2.1), so the local and hosted results agree. They were
**re-executed again for this revision** against the bytes it carries: `validate-transport.mjs`
`PASS` (exit 0), `validate-inference.mjs` `PASS` (exit 0), and the aggregate `validate.mjs`
**30 / 31 validators clean** with one failure — the pre-existing local `dependency-compat` install
defect described below, which none of the files this revision changes touches. This revision's only
tooling change is a **comment-only** header block in `tools/contract-validation/validate-transport.mjs`,
replacing stale `PROPOSED` / `UNAPPLIED` prose with the applied `ACCEPTED FOR IMPLEMENTATION` state
the file's own two-state machine already enforced. No executable line moved; the validators and the
`204 / 204` harness were re-run *after* the edit and are unchanged.

**Hosted coverage of the contract bytes is now claimed — and only of those bytes.** The prior
revision could not claim it: the W2-I status-prose alignment in
`contracts/openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml` — comment and
`description` text only; no path, operation, parameter, request body, response binding or `security`
requirement moved — re-pinned that member's SHA-256 in the accepted W2-D packet manifest, in the
consumed delta (both pin sites) and in this candidate's manifest, and re-pinned the packet
manifest's own post-flip digest in the delta, all *after* the then-current pin `4498bdd3…`. Those
edits now sit **inside** the content-base pin `7065a703…`, and run `32464960479` is 3/3 green at
exactly that head, including `contract standards validation` (job `96719525219`). Everything under
`contracts/` in this working tree is byte-identical to `contracts/` at `7065a703…` (`git diff
--quiet 7065a703 -- contracts/`, zero diff), so the hosted check has covered these exact contract
bytes.

**What is still not hosted-covered** is the revision that carries *this* document: it changes only
release documentation, release catalogs, the derived qualification snapshot and one comment-only
header block in `tools/contract-validation/validate-transport.mjs`. It touches no contract member,
no fixture and no digest-pinned artifact, so it neither dilutes nor extends the coverage above — but
its own bytes need a hosted rollup at the successor head before hosted CI may be said to cover them.
That is a `POST_MERGE_REQUIRED` sequencing fact (§9.0), not a defect:
the digest chain is fully self-consistent, which is exactly what `validate-transport.mjs` verifies.

```text
$ node tools/contract-validation/validate-transport.mjs
=== W2-I inference-plane transport binding vs. the ACCEPTED W2-D packet — ... ===
OK — ... Lifecycle: ACCEPTED FOR IMPLEMENTATION — schemas/fixtures v0.1.0,
successor OpenAPI v0.2.0.
exit 0

$ node tools/contract-validation/validate-inference.mjs
=== W2-D inference packet — JSON Schema / fixtures / trust-invariant validation ===
OK — inference packet passes JSON Schema 2020-12 compile/ref-resolution, all fixtures,
and every trust invariant (lifecycle: ACCEPTED FOR IMPLEMENTATION at v0.1.0).
exit 0

$ node --test tools/contract-validation/tests/validate-transport.test.mjs
# tests 204   # pass 204   # fail 0
```

What the transport run proves at this lifecycle, beyond schema compilation and the 5 positive /
9 negative-schema / 8 negative-semantic fixtures: **39 / 39** structural `TT-1..TT-9` assertions;
**8 / 8** negative-semantic fixtures rejected on exactly their declared `TX` rule, witnessing each
of `TX-1..TX-8` once; **4** candidate-member + **2** upstream-accepted + **1** examples-manifest +
**22 / 22** support-fixture SHA-256 digests verified; the accepted W2-D manifest proven to declare
all four absorbed members at digests agreeing with the delta, to relabel the predecessor
`SUPERSEDED-SUPPORTED` and byte-frozen, and to record the gate decision; and a name-blind sweep of
**4** OpenAPI documents / **19** declared pairs proving all **4 / 4** owned pairs keep exactly one
`CURRENT` owner, carry no residual proposed successor, and keep the superseded predecessor on disk.

The inference run's member count moved from `11` to `15` — the four absorbed W2-I members — and now
verifies **4** member digests, which the pre-W2-I rows do not carry (repairing those is a separate
recorded gate, `G-W2I-4`).

**One local check fails, and it is unrelated to this change.**
`tools/contract-validation/tests/dependency-compat.test.mjs` fails in this worktree with
`MODULE_NOT_FOUND` for `brace-expansion-v5/package.json`. The alias the lockfile declares
(`brace-expansion-v5` → `npm:brace-expansion@5.0.9`) is simply absent from the local `node_modules`
install; `package.json`, `package-lock.json` and `tools/contract-validation/vendor/` are all
**unmodified** by this revision, which changes **no test file at all**. (The ADR-catalog `P2-3`
guard in `tests/validate-transport.test.mjs` — which pinned ADR-0011's **pre-flip** `PROPOSED` wording
and was moved onto the recorded `ACCEPTED (HB-4)` catalog rows — was changed by the *prior* revision
and now sits inside the content base `7065a703…`; the guard's base-byte SHA-256 pin is
unchanged and still holds, so the catalog is still byte-pinned outside its three registered W2-I
additions.) Hosted CI installs from the lockfile with `npm ci`
and the same check passed in run `32464960479` at the pinned head. Repairing the local install would
require a dependency installation, which is Founder-gated in this repository, so it was not
attempted.

### 4.3 Negative Security Matrix (Adversarial Vectors)

**Sourcing.** The document this matrix was reproduced from exists in no suite repository (§2.2a).
The `LIVE_VERTICAL` gate that the matrix supports is **ratified `PASS` by the Founder** (HB-5,
2026-08-20, `soc-autonomous-state:founder-uat-r22/FOUNDER-UAT-DECISION.md`, sha256 `78bc11ca…`), so
the gate is sourced. The **per-scenario rows below are not**: no case identifier, input, expected
rejection or observed rejection is bound in any suite repository. They are retained as the
specification's stated design intent, explicitly **unsourced at scenario level**, and tracked as an
open item in §9.7. Do not cite an individual row as evidence.

| Vector | Attack | Boundary | Invariant | Observed | Verdict |
|---|---|---|---|---|---|
| NEG-1 | Cross-tenant claim tampering (`tenant-globex` body vs `tenant-acme` token) | Cyber AI & Fabric PDP | SR-4 | `403 tenant_mismatch`; no model runtime or sandbox dispatched | PASS |
| NEG-2 | Expired delegation token (`now > exp`) | Cyber AI ingress verifier | SR-1 | `401 token_expired` before any contract dereference | PASS |
| NEG-3 | `alg: "none"` / unsigned token | JOSE parser (both planes) | SI-1 / SR-10 | `400 unsupported_algorithm` at structural boundary | PASS |
| NEG-4 | Replayed `jti` presentation | Fabric anti-replay cache | SR-8 | `409 replay_detected`; execution refused | PASS |
| NEG-5 | Audience misdirection (`svc:soc-notifier` token → `svc:security-tool-fabric`) | Fabric PDP | SR-3 | `403 audience_mismatch`; confused deputy prevented | PASS |
| NEG-6 | Marking downgrade (`confidential` input → `public` output request) | Cyber AI policy engine | TR-1 / SI-9 | `InferenceDenied` / `marking_downgrade`; output forced to lattice upper bound | PASS |

**Classification — `POST_MERGE_REQUIRED` (§9.0).** Scenario-level rehearsal *execution* of
`NEG-1..NEG-6` is classified `POST_MERGE_REQUIRED` in whole, not merely the post-rollback re-run.
The matrix exercises a live four-service topology whose application images are built from source, so
producing a per-case identifier, input, expected rejection and observed rejection requires images
built from the **exact post-merge** main-line SHAs of all four repositories. Those SHAs do not exist
yet (§9.5), and building and publishing from an unmerged state needs deployment authority reserved to
the Founder by `cybrik-suite:CLAUDE.md`. The gate-level `LIVE_VERTICAL` `PASS` is unaffected — it is
Founder-ratified at `HB-5` and is not re-derived from these rows.

**Closing action.** After all four pull requests merge, rebuild the topology from the merged
main-line SHAs, re-run `NEG-1..NEG-6` against those **exact post-merge images**, and bind the
per-case transcript into this repository. The narrower prior claim — that NEG-1 through NEG-4 were
**re-executed post-rollback** — rested on the same missing document and is subsumed by this
classification (§6.4a): re-running the matrix against a *restored* environment needs the same
rebuilt rollback target images.

---

## 5. Security Properties

### 5.1 Zero Privilege Escalation

The candidate's contract surface makes tool/agent authority **structurally unreachable** from the
inference plane, rather than merely policy-forbidden. Enforced by the W2-D validator as
brittle-on-purpose invariants (all green in §4.2):

| Invariant | Property |
|---|---|
| **TI-1** | No vendor lock-in: no `model`/`provider`/`endpoint`/`api_key`/`base_url`/`vendor` field exists on any request; `additionalProperties: false` makes pinning structurally impossible. |
| **TI-2** | **No tool/agent/action authority:** no `tools`/`capability`/`delegation_ref`/`approval_id`/`mcp` field on any inference request; `model-capability.tool_calling` is a required `const "disabled"`. |
| **TI-4** | Mandatory bounds: `max_input_tokens`, `max_output_tokens`, `max_context_tokens`, `limits`, and `deadline_seconds` are all required — a model class with no limits is not registrable. |
| **TI-5** | Replay control: `idempotency_key` `minLength: 16` on both request schemas and on the OpenAPI parameter. |
| **TI-6** | Cross-tenant guard: `actor.tenant_id` required at the authorization site on every request. |

Layered on top, the W2-I transport binding asserts that an advisory request body can never
elevate the token tenant or escalate the token marking (§3.1), and the W2-F packet keeps the
application-delegation token **disjoint** from the ADR-0004 digest-bound tool-grant chain: a
delegation token may *reference* a tool grant (`cybrik.delegation_ref`) but never substitutes for
one and confers no tool, action, or agent authority. Model output is treated as untrusted
advisory data throughout.

### 5.2 Fail-Closed Transport

| Surface | Fail-Closed Behaviour |
|---|---|
| Redaction (TI-3) | `redactionPolicy.on_unresolved` is `const "deny"`; `redaction_policy` is required on every request. A request asking to `proceed` on unresolved redaction is schema-rejected. |
| Replay store outage (W2-I) | The relying party **denies rather than allows** when the replay store is unavailable, and the returned class never leaks which dependency was down. |
| Token validation (SR-1/3/8/10) | Expiry, audience, replay, and algorithm failures each terminate evaluation before any downstream dispatch (§4.3). |
| Tenant isolation | Tenant is the fail-closed isolation boundary per ADR-0006; a mismatch drops the request with no model-runtime or sandbox dispatch. |
| Event payloads | Every inference AsyncAPI message must bind a typed `data` payload on the accepted envelope — an event without one is rejected (5 / 5 messages data-bound in §4.2). |
| Contract `$ref` containment | A `$ref` that escapes `contracts/` is a validation failure, not a filesystem read. |

### 5.3 RFC 9116 `security.txt`

- **File:** [`public/.well-known/security.txt`](../../public/.well-known/security.txt) (byte-identical
  copy of record at [`docs/security/security.txt`](../security/security.txt), which matches the
  specification embedded in [`RESPONSIBLE-DISCLOSURE-POLICY.md`](../security/RESPONSIBLE-DISCLOSURE-POLICY.md) §6.1).
- **Field conformance (verified by inspection against RFC 9116):**

| Field | Value | RFC 9116 Requirement | Result |
|---|---|---|---|
| `Contact` | `mailto:security@cybrik.ai`, `mailto:report@cybrik.ai` | REQUIRED, one or more, in priority order | PASS |
| `Expires` | `2027-08-20T00:00:00.000Z` | REQUIRED, exactly one, SHOULD be < 1 year out | PASS (exactly 1 year from 2026-08-20) |
| `Canonical` | `https://cybrik.ai/.well-known/security.txt` | OPTIONAL, `https` URI | PASS |
| `Policy` | `https://cybrik.ai/security` | OPTIONAL | PASS |
| `Preferred-Languages` | `en` | OPTIONAL, MUST appear at most once | PASS |
| `Hiring` | `https://cybrik.ai/careers` | OPTIONAL | PASS |

- **Intake channel:** `security@cybrik.ai` (secondary `report@cybrik.ai`) routed to
  `contact@bpech.com` via Cloudflare Email Routing, delivery tested end-to-end — the evidence
  that closed RB-001.
- **SLA on receipt:** CRITICAL 24h / HIGH 48h / MEDIUM 72h / LOW 7d initial response, with a
  90-day embargo ([policy §4](../security/RESPONSIBLE-DISCLOSURE-POLICY.md)).
- **Publication is NOT verified here.** Serving of the file at the canonical
  `https://cybrik.ai/.well-known/security.txt` URL was not observed — re-probed `404` on
  2026-08-21. Classified `EXTERNAL_RESOURCE_REQUIREMENT / POST_DEPLOYMENT_REQUIRED`, gating class
  `POST_DEPLOYMENT_REQUIRED`; it does not gate staging qualification. See §9.0 and §9.4.

---

## 6. Rollback Procedures

### 6.1 Rollback Trigger

The deployment supervisor rolls back automatically when **3 consecutive health probes fail** on
any service in the topology. Probe endpoints:

| Service | Port | Probe |
|---|---|---|
| `soc-portal` | 3000 | `GET /healthz` |
| `soc-api` | 8000 | `GET /api/v1/health` |
| `ai-api` | 8080 | `GET /healthz` |
| `fabric-control` | 8081 | `GET /healthz` |
| `ai-worker` | — | heartbeat / IPC |
| `fabric-executor` | — | disposable; `--tier` parameter |

### 6.2 Rollback Sequence

1. **Trigger** — supervisor records the third consecutive failed probe and trips the threshold.
2. **Drain** — the ingress traffic router drains in-flight connections from the faulty instance.
3. **Provision** — the known-stable snapshot for that service is deployed by exact image SHA.
4. **Probe** — the restored instance must return `200 OK` (with `circuit_breaker: CLOSED` for
   `ai-api`) before it is eligible for traffic.
5. **Re-route** — traffic switches to the stable instance.
6. **Terminate** — the faulty container is terminated only after the switch completes.
7. **Verify** — the full `SCENARIO-TRIAD-UAT-001` smoke flow and the NEG-1..NEG-4 negative
   security matrix are re-executed against the restored environment.

### 6.3 Rehearsed Outcome — Reclassified `POST_MERGE_REQUIRED`

The rehearsal was recorded in a document that exists in no suite repository (§2.2a). Its figures
are **not** re-sourced, and they are **not** restated as pin-bound:

| Rehearsed observation | Status |
|---|---|
| Recovery time **6.0 s**, zero downtime, zero data loss | `POST_MERGE_REQUIRED` |
| Rollback target `cybrik-cyber-ai-platform:281b2529…` restored to `200 OK` at **1.9 ms** | `POST_MERGE_REQUIRED` — and `281b2529…` is off-line from the pin |
| **4 / 4** services healthy post-rollback | `POST_MERGE_REQUIRED` |
| **7 / 7** smoke stages green (`SCENARIO-TRIAD-UAT-001`) | `POST_MERGE_REQUIRED` |
| **NEG-1..NEG-4** all PASS post-rollback | `POST_MERGE_REQUIRED` |

What **is** qualified now, and by what, is stated in §6.4a. The `DEPLOY_ROLLBACK_REHEARSAL` gate
itself is ratified `PASS` by the Founder (HB-5, 2026-08-20); that is a gate ratification, not a
re-measurement of the figures above.

### 6.4 Rollback Targets for this Candidate

Each service's rollback target is the last known-stable image for that service. Under the current
pin set **no product rollback target image is an ancestor of its pin**: the rehearsed Cyber AI
target `281b2529…` is off-line from `b5ab09c8…` after the branch rebase, and the Fabric target
`147a1d83…` is off-line from `0e4fee8d…`. The SOC position **improved** — the pin `34b6302…` now
contains `origin/main` `4480a412…` as a verified ancestor (§2.2) — but that is source ancestry, not
a built image. The rehearsed *procedure* (§6.2) is unchanged and still applies, and every rollback
**target image** must be re-established against the pinned heads before staging qualification can
be claimed (§9.3, §9.6).

### 6.4a Rollback Qualification That Does Hold Today

Two parts of the rollback story are qualified now and do not depend on the missing rehearsal
document. The third is the part that must wait for merge.

**Database rollback — `VERIFIED`.** Linear Alembic downgrade is qualified, and the qualification is
enforced on every CI run rather than performed once:

- `cybrik-soc-command-center:.github/workflows/ci.yml`, job `api`, step
  `Migration test (upgrade -> downgrade -> upgrade)` runs `alembic upgrade head`,
  `alembic downgrade base`, `alembic upgrade head`. A non-reversible migration fails a **required
  check**.
- The qualification commit `cybrik-soc-command-center@64e0350d` — a verified ancestor of the SOC
  pin — re-ran the full round trip against real PostgreSQL 16.14 on a dedicated scratch database. A
  **1628-line schema fingerprint** (columns, indexes, constraints, policies, RLS flags, grants,
  functions) was **byte-identical** before and after, and `downgrade base` left nothing behind but
  `alembic_version` — no orphaned tables, functions, enums or indexes.
- **22 / 22 revisions** individually passed `downgrade -1 / upgrade +1 → schema unchanged`, so
  reversibility holds revision-by-revision, not only for the chain as a whole.
- A new guard, `services/api/tests/unit/test_migration_reversibility.py`, catches the failure mode
  the CI round-trip **cannot**: an empty `downgrade()` body, where alembic silently leaves schema
  behind and the round trip still passes green.
- **No migration was modified** to achieve this.

**Rollback target inheritance — `STRUCTURALLY_VERIFIED`.** The deployment topology builds
application images from the checked-out source tree rather than pulling a published tag:
`cybrik-soc-command-center:deploy/pf/staging/docker-compose.staging.yml` declares `build:` for the
application services, and pins `image:` only for third-party infrastructure (Kafka, OpenSearch,
SeaweedFS, Valkey). The consequence is that the rollback target is **inherited from the git
subject** — checking out the prior SHA and re-running compose reconstructs the prior image, and no
separate image-registry pin can drift away from the source pin. That is why this manifest binds no
image tag. The cost is that a rollback requires an image **rebuild**.

**Service rehearsal numbers — `POST_MERGE_REQUIRED`.** Because targets are built from source,
re-establishing them requires images built from the four pinned heads. The pins are unmerged PR
heads under branch protection, and building and publishing from an unmerged state needs deployment
authority that `cybrik-suite:CLAUDE.md` reserves to the Founder. After merge: rebuild the targets
from the merged main-line SHAs, re-run the positive smoke stages and the `NEG-1..NEG-4` matrix
against the restored environment, and record the measured recovery time (§9.6). The **post-rollback**
`NEG-1..NEG-4` re-run named here is the narrower half of the same obligation: scenario-level
execution of the full `NEG-1..NEG-6` matrix against the exact post-merge images is classified
`POST_MERGE_REQUIRED` in whole (§9.0, §4.3).

### 6.4b Database Backup and Restore — Three Separate Claims

`CODEX-ADJ-005` pre-merge item 3 caught an unencrypted local drill being cited in support of an
**encrypted** production-backup control claim. These three claims are therefore kept apart, and
collapsing them is the error the classification exists to prevent.

| Claim | State | Basis |
|---|---|---|
| **Backup encryption implementation** | **`VERIFIED`** | `cybrik-soc-command-center:ops/backup` — the `age` path leaves no plaintext on disk; the artifact digest is verifiable **without** the decryption key; fail-closed is demonstrated both ways: flipping one byte makes `verify` exit 1 and aborts the drill **before** any temporary database is created, and backing up as the `NOBYPASSRLS` role `cybrik_app` exits 3 having written **zero** files, so no silently-incomplete copy is produced |
| **Local restore drill** | **`VERIFIED`** | Two real drills, both passed — see below |
| **Production key custody / off-system storage / live verification** | **`POST_DEPLOYMENT`** | Not claimed — see below |

**Local drills (both `VERIFIED`).**

| | Unencrypted | Age-encrypted |
|---|---|---|
| Report | `reports/evidence/restore-drill/20260820T164433Z/DRILL-REPORT.md` | `reports/evidence/restore-drill/20260821T075437Z/DRILL-REPORT.md` |
| Report sha256 | `30cb3786c144923dcfe5f6a42f4313f68192467af160ad67a3b702aa85cc6045` | `69c6cd23a06f1a8cc2540eef6811bc0a74d305c7d98ee157efccae313d425a6c` |
| Machine record sha256 | `b93daed3e6542deaf8263a256a83bbbfcb065663d35321b0976872ab517bec11` | `84f159015ba298e9be1a9c99360c2923508d636923705057909c22b286e20a5e` |
| Encryption provider | `none` | **`age`** |
| Encrypted artifact sha256 | — | `d072543b3bedfe01d35aa3adeb5c592389c28ca80d3c28ca8dbb4cd6c04c1563` |
| Measured RTO (restore step only) | **0.40 s** | **1.7 s** |
| Total drill time | 0.5 s | 2.318 s |
| Tables compared exactly | **56** | **56** (0 range-checked) |
| Rows restored | 2128 | 2288 |
| Full-checksum tables | `audit_events`, `copilot_audit` | `audit_events`, `copilot_audit` |
| Findings | none | none |
| Result | **PASS** | **PASS** |

Both are drills against a developer PostgreSQL 16.14 instance, and the RTO covers the **restore
step only**, not a full recovery procedure. The encrypted drill is carried by the **pinned SOC head
itself** (`34b6302…`), which is what closes `CODEX-ADJ-005` pre-merge item 3: the encrypted-backup
control claim now has matching encrypted-drill evidence instead of resting on the unencrypted
drill.

**Production, deliberately not claimed.**

| Concern | State | Why |
|---|---|---|
| `PRODUCTION_BACKUP_KEY_CUSTODY` | `EXTERNAL_RESOURCE` | The drill used a locally held `age` identity. Where the recipient's private half lives, who may use it, how it rotates and how its use is audited are properties of a production secret manager that does not exist. Production credentials and signing keys are Founder-gated and outside every suite repository's data-handling boundary |
| `PRODUCTION_OFF_SYSTEM_STORAGE` | `EXTERNAL_RESOURCE` | Both drills wrote and read on the same host as the database. Off-system retention, immutability / object-lock and retention-period enforcement need unprovisioned production storage |
| `PRODUCTION_BACKUP_ENCRYPTION_LIVE_VERIFICATION` | `POST_DEPLOYMENT_REQUIRED` | Verifying the control against the real production database — real volume, real schedule, real key custody, measured production RPO/RTO — is only possible after deployment. Not blocked on evidence; blocked on there being a production system |

No suite artifact asserts that production backup keys are provisioned or rotated, or that backups
are replicated off-system.

### 6.4c Performance Baseline

A performance baseline now exists —
`soc-autonomous-state:reports/evidence/performance/PERFORMANCE_BASELINE_EVIDENCE.json`, sha256
`e73c2b2cc09a8fdf1b2b5bdbfb919250b3073893aae694e69d4d0d14b6354745`. It is a **micro-benchmark of
four in-process code paths on one developer workstation** (macOS / Python 3.12). It is not a load
profile, throughput figure, saturation test or service-level latency measurement: no HTTP request,
no database round trip and no concurrency is measured. rc1 declares no performance objective, and
this baseline establishes none.

| Metric | Tool | Exact subject | n | p50 | p95 | p99 | mean |
|---|---|---|---:|---:|---:|---:|---:|
| `soc_module_import_ms` | `time.perf_counter()` around `import cybrik_soc.config, logging` | `cybrik-soc-command-center@2822b9e1` — **off-pin** | 50 | 0.0002 ms | 0.0004 ms | 73.698 ms | 0.9894 ms |
| `cyber_ai_delegation_key_resolution_ms` | `time.perf_counter()` around `PinnedTrustProvider.resolve_key()` | `cybrik-cyber-ai-platform@6793e217` — **ancestor of the pin** (2 behind) | 1000 | 0.0001 ms | 0.0001 ms | 0.0001 ms | 0.0001 ms |
| `soc_log_scrubbing_latency_ms` | `time.perf_counter()` around `cybrik_soc.platform.logging.redact()` | `cybrik-soc-command-center@2822b9e1` — **off-pin** | 1000 | 0.0061 ms | 0.008 ms | 0.0082 ms | 0.0064 ms |
| `cyber_ai_circuit_breaker_pass_latency_ms` | `time.perf_counter()` around `CircuitBreaker.allow()` + `record_success()` | `cybrik-cyber-ai-platform@6793e217` — **ancestor of the pin** (2 behind) | 1000 | 0.0001 ms | 0.0001 ms | 0.0002 ms | 0.0001 ms |

Three caveats are load-bearing. **Subject drift:** the two SOC metrics were measured at
`2822b9e1…`, which the pin rebase has left off-line — they are recorded with their real subjects
and are **not** restated as pin-bound. **An internal inconsistency:** the first row's p99
(73.698 ms) exceeds its own max (49.4619 ms), which is impossible for one sample set; the source
artifact is reproduced verbatim rather than silently corrected, and at n=50 the p99 estimator is
meaningless anyway. **Coverage of the hardened paths:** the delegation-key row measures exactly the
`(issuer, kid)` path hardened for `ABMB-01`, but the circuit-breaker row measures only the
`CLOSED`-state pass path and does **not** exercise the half-open single-probe property.

### 6.5 Manifest / Contract Rollback

Reverting this release candidate at the Suite level is a single-commit revert of the manifest, this
document and the W2-I flip. This revision **does** move contract state — the prior revision's claim
that no contract packet is touched no longer holds (§9.1) — but the revert stays bounded and total:

- the superseded predecessor is **byte-frozen and still on disk**, so reverting restores it as
  `CURRENT` from the exact reviewed bytes rather than reconstructing them;
- the accepted W2-D manifest returns to its exact pre-flip digest
  `e04c8617c3348d7a642cd95a672902d51aa4a2b41a198614b8ee121101ea207b`, which the consumed delta pins
  alongside the post-flip digest specifically so a revert is verifiable;
- no packet is re-versioned or bundle-tagged: `x-cybrik-packet-version` stays `0.1.0` and
  `x-cybrik-is-bundle-tag` stays `false` on both sides of the flip;
- W2-B / W2-F / W2-G acceptance is untouched, and the accepted W2-F operation-token table was never
  edited (§9.1).

**Reverting the bytes does not reverse the decision.** `HB-4` accepted W2-I on 2026-08-20; undoing
that would require its own recorded decision. A revert returns the artifacts to a state that
disagrees with the control plane — which is a legitimate rollback posture, but it must be recorded
as such rather than read as a withdrawal of acceptance.

---

## 7. Gate Status — Authoritative Post-UAT

All five human governance boundaries (`HB-1`..`HB-5`) are **`CLOSED`** per
`soc-autonomous-state:HUMAN_BOUNDARIES.json` (`open_boundary_count: 0`). The gate table below is
the authoritative post-UAT status for this candidate.

| Gate | Boundary | Status | Authority Record | Remaining Requirement |
|---|---|---|---|---|
| `RESPONSIBLE_DISCLOSURE` / `RB-001` | `HB-3` | **`RESOLVED`** (2026-08-20) | `INBOX-005`, `INBOX-006`; [`RELEASE-BLOCKERS.md`](RELEASE-BLOCKERS.md) | Public serving of `security.txt` at the canonical URL — classified `EXTERNAL_RESOURCE_REQUIREMENT / POST_DEPLOYMENT_REQUIRED`, gating class `POST_DEPLOYMENT_REQUIRED`, so it does **not** gate staging qualification and does **not** reopen `RB-001` (§9.0, §9.4) |
| `W2_I_ACCEPTANCE` — transport binding v0.2.0 | `HB-4` | **`ACCEPTED`** (Decision Council, 2026-08-20); **artifact flip applied 2026-08-21** | `INBOX-007`, decision `ACCEPT` | Amend the accepted W2-F operation-token table — undischarged. Classified `DEFERRED_NON_BLOCKING_GOVERNANCE_ITEM` (§9.0): it scopes out the two GET operations and does **not** gate this candidate, whose delegation tokens are the two accepted create tokens (§3, §9.1) |
| `SOC_UAT_RATIFICATION` — Candidate R22 Founder UAT | `HB-5` | **`PASS` / `RATIFIED`** (Founder, 2026-08-20) | `INBOX-008`, decision `PASS`; walkthrough `PASS` at `INBOX-002` | — |
| `HOSTED_INTEGRATION_CONTROL` | `HB-1` | **`PASS`** (Founder, 2026-08-20) | `INBOX-004` | — |
| `UAT_PERSONA_EVIDENCE` — human accessibility session | `HB-2` | **`PASS`** (Founder / human reviewer, 2026-08-20) | `INBOX-003` | — |
| **Staging Qualification** | — | **`IN_PROGRESS / PENDING_HUMAN_PR_MERGE`** | `soc-autonomous-state:CURRENT_STATE.json` | Human review + merge of PRs #56 / #13 / #11 / #6, then required CI at every merged SHA; rollback target images rebuilt from the merged SHAs (§6.4a, §9.6); scenario-level `NEG-1..NEG-6` rehearsal executed against the exact post-merge images and a pin-bound coverage figure — both `POST_MERGE_REQUIRED` (§9.0, §4.3, §9.7). **Cleared:** the Cyber AI CI blocker (§9.3a), the SOC branch-protection impossibility (§9.5), and the five unsourced evidence references (§2.2a) |

### 7.1 Ten-Gate Milestone Resolution

`soc-autonomous-state:founder-uat-r22/FOUNDER-UAT-DECISION.md` §2 records the formal human
authority action for all ten milestone gates. Every gate is ratified **`PASS`** — including
`LIVE_VERTICAL`, `DEPLOY_ROLLBACK_REHEARSAL` and `CYBER_AI_RUNTIME`, which the **previous revision
of this document reported as `FAIL` pending ratification**. That ratification has since occurred
(`HB-5`, 2026-08-20), so those three entries are superseded:

| Gate | Owner | Machine Engineering Status | Human Authority Action | Ratification |
|---|---|---|---|:---:|
| `SUITE_LOCAL_GATES` | `cybrik-suite` | `ENGINEERING_SATISFIED` | Satisfied on verified local baseline | `PASS` |
| `HOSTED_INTEGRATION_CONTROL` | `cybrik-suite` | `ENGINEERING_SATISFIED` | Founder hosted branch-protection review | `PASS` |
| `RESPONSIBLE_DISCLOSURE` | Founder | `ENGINEERING_SATISFIED` | Founder channel approval & RB-001 resolution | `PASS` |
| `W2_I_ACCEPTANCE` | `cybrik-suite` | `ENGINEERING_SATISFIED` | Decision Council acceptance vote | `PASS` |
| `SOC_UAT_SURFACE` | `cybrik-soc-command-center` | `ENGINEERING_SATISFIED` | Confirmed in UAT | `PASS` |
| `CYBER_AI_RUNTIME` | `cybrik-cyber-ai-platform` | `ENGINEERING_SATISFIED` | Model runtime confirmed in UAT | `PASS` |
| `TOOL_FABRIC_RUNTIME` | `cybrik-security-tool-fabric` | `ENGINEERING_SATISFIED` | Capability gate confirmed in UAT | `PASS` |
| `LIVE_VERTICAL` | `cybrik-suite` | `ENGINEERING_SATISFIED` | Triad scenario confirmed in UAT | `PASS` |
| `UAT_PERSONA_EVIDENCE` | `cybrik-soc-command-center` | `ENGINEERING_SATISFIED_MACHINE_EVIDENCE` | Human accessibility session completed | `PASS` |
| `DEPLOY_ROLLBACK_REHEARSAL` | `cybrik-suite` | `ENGINEERING_SATISFIED` | Deploy/rollback rehearsal confirmed in UAT | `PASS` |

Ten ratified gates are **not** staging qualification. Gate ratification is a statement about the
evaluated candidate; the pins in §2 are unmerged PR heads whose suites were not re-executed locally
(§9.2), and no rollback target is bound to a pin (§9.6). All four pins now carry a green hosted run
**at the pin itself** (§2.1), which removes the prior revision's red-pin and ancestor-observation
objections but adds no gate authority. In particular, the ratified `CYBER_AI_RUNTIME` gate was
ratified against the UAT candidate, **not** against `b5ab09c8…`; a green run at that head is a
check-state observation, not evidence that the gate applies to it. The same caution now applies more
sharply to `CYBER_AI_RUNTIME`, `TOOL_FABRIC_RUNTIME`, `LIVE_VERTICAL` and
`DEPLOY_ROLLBACK_REHEARSAL`. The engineering-evidence documents that previously stood behind their
`ENGINEERING_SATISFIED` column exist in no suite repository; each is now re-sourced or withdrawn
(§2.2a), which changes what a reader can check but not what the column means. That column is still
reproduced from the ratification record rather than corroborated here. Engineering satisfaction
(`*_ENGINEERING_SATISFIED`) remains a distinct and lesser claim than gate status, and gate status
remains a distinct and lesser claim than qualification.

Two of the re-sourcings deserve naming in this table's terms. `LIVE_VERTICAL` is ratified `PASS` at
**gate** level while its `NEG-1..NEG-6` scenarios remain unsourced at **scenario** level and their
execution is classified `POST_MERGE_REQUIRED` (§9.0, §4.3), and
`DEPLOY_ROLLBACK_REHEARSAL` is ratified `PASS` while its rehearsal figures are reclassified
`POST_MERGE_REQUIRED` and only its database-rollback and target-inheritance halves are qualified
today (§6.4a). A ratified gate does not import evidence that was never committed.

Nothing in this table is reproducible from `cybrik-suite` alone. The derived snapshot at
[`docs/releases/evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json`](evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json)
projects it into this repository for convenience and marks every gate
`in_repository_corroboration: ABSENT` for exactly that reason (§9.7).

---

## 8. Repository-Qualified Reference Index

| Reference | Repository-qualified path |
|---|---|
| RC manifest | `cybrik-suite:releases/manifests/release-candidate-v1.0.0-rc1.manifest.json` |
| Disclosure policy | `cybrik-suite:docs/security/RESPONSIBLE-DISCLOSURE-POLICY.md` |
| RFC 9116 file | `cybrik-suite:public/.well-known/security.txt` |
| W2-F packet | `cybrik-suite:contracts/compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json` |
| W2-G packet | `cybrik-suite:contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json` |
| W2-D packet | `cybrik-suite:contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json` |
| W2-I delta record (consumed, `x-cybrik-applied: true`) | `cybrik-suite:contracts/compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json` |
| W2-I successor OpenAPI (`CURRENT`) | `cybrik-suite:contracts/openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml` |
| W2-I predecessor (`SUPERSEDED-SUPPORTED`, byte-frozen) | `cybrik-suite:contracts/openapi/cybrik-ai-inference-plane.v1.openapi.yaml` |
| ADR-0011 decision record (`ACCEPTED`) | `cybrik-suite:docs/adr/ADR-0011-inference-plane-transport-binding-profile.md` |
| Transport conformance validator | `cybrik-suite:tools/contract-validation/validate-transport.mjs` |
| Derived qualification snapshot (non-authoritative) | `cybrik-suite:docs/releases/evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json` |
| W2-I conformance suite | `cybrik-cyber-ai-platform:tests/contract/test_w2i_transport_conformance.py` |
| Human boundary register | `soc-autonomous-state:HUMAN_BOUNDARIES.json` |
| Authority inbox | `soc-autonomous-state:AUTHORITY_INBOX.json` |
| Verified PR-head subjects | `soc-autonomous-state:VERIFIED_SUBJECTS.json` |
| Founder UAT decision (ten-gate ratification) | `soc-autonomous-state:founder-uat-r22/FOUNDER-UAT-DECISION.md` |
| Human accessibility session (HB-2) | `soc-autonomous-state:founder-uat-r22/ACCESSIBILITY-HUMAN-SESSION.md` |
| Codex adjudication ledger | `soc-autonomous-state:CODEX_DECISIONS.json` |
| Codex challenge reports | `soc-autonomous-state:reports/codex-challenges/` |
| Performance baseline evidence | `soc-autonomous-state:reports/evidence/performance/PERFORMANCE_BASELINE_EVIDENCE.json` |
| Restore drill — unencrypted | `cybrik-soc-command-center:reports/evidence/restore-drill/20260820T164433Z/DRILL-REPORT.md` |
| Restore drill — `age`-encrypted | `cybrik-soc-command-center:reports/evidence/restore-drill/20260821T075437Z/DRILL-REPORT.md` |
| Migration round-trip CI enforcement | `cybrik-soc-command-center:.github/workflows/ci.yml` (job `api`, step `Migration test (upgrade -> downgrade -> upgrade)`) |
| Migration reversibility guard | `cybrik-soc-command-center:services/api/tests/unit/test_migration_reversibility.py` |
| Staging compose topology (rollback target inheritance) | `cybrik-soc-command-center:deploy/pf/staging/docker-compose.staging.yml` |

Every path listed above was resolved at 2026-08-21T16:20:00+07:00 — the `cybrik-suite` paths against
this worktree, the `cybrik-soc-command-center` paths against the local canonical checkout, and the
`soc-autonomous-state` paths against the control plane.

The five evidence documents the prior revision listed here as **absent from every suite repository**
are no longer cited as sources anywhere in this specification. Each is re-sourced or withdrawn in
§2.2a, and the digests of the artifacts that replaced them are bound in §6.4b, §6.4c and §9.7.
**Zero dangling evidence paths remain.**

---

## 9. Open Items — Not Verified by this Document

These are recorded rather than resolved. Items 9.1–9.7 carry forward from the prior revision with
their status updated against the current pin set. **Not every item below gates staging
qualification** — §9.0 states which class each one carries and what that class costs.

### 9.0 Residual Item Classification Taxonomy

Every residual item in this document carries **exactly one** class. The classes are disjoint: an
item is never simultaneously a blocker and a deferral, and no item's top-level status may disagree
with the section that details it.

| Class | Meaning | Gates staging qualification? |
|---|---|:---:|
| `BLOCKING_OPEN` | Must be closed before `v1.0.0-rc1` may leave `CANDIDATE_READY_FOR_STAGING_QUALIFICATION` | **Yes** |
| `POST_MERGE_REQUIRED` | Cannot be executed before the four pull requests merge, because it needs artifacts built from the **exact post-merge** main-line SHAs. Not a defect and not a waiver — a sequencing fact | **Yes**, after merge |
| `POST_DEPLOYMENT_REQUIRED` | Cannot be verified until a production deployment exists | No — after GA/deployment |
| `DEFERRED_NON_BLOCKING_GOVERNANCE_ITEM` | A governance act at a **different** gate that this candidate does not depend on, deliberately deferred to post-RC1. It constrains *future* scope, not this candidate's claims | **No** |
| `EXTERNAL_RESOURCE` | The authority or artifact of record lives outside every suite repository; nothing committed here can close it | No — records the gap |

Classification of the residual items, authoritative for this document:

| Item | Class | Where detailed |
|---|---|---|
| W2-F operation-token vocabulary amendment for the two **read** tokens | `DEFERRED_NON_BLOCKING_GOVERNANCE_ITEM` | §3, §9.1 |
| Scenario-level `NEG-1..NEG-6` rehearsal **execution** | `POST_MERGE_REQUIRED` | §4.3, §9.7 |
| Rollback targets re-established against the pins; service-rehearsal figures | `POST_MERGE_REQUIRED` | §6.3, §6.4a, §9.6 |
| Product test suites re-executed against their pinned heads | `POST_MERGE_REQUIRED` | §9.2 |
| Merge of PRs #56 / #13 / #11 / #6 under branch protection | `BLOCKING_OPEN` (human-only) | §9.5 |
| `security.txt` served at the public canonical URL | `EXTERNAL_RESOURCE_REQUIREMENT / POST_DEPLOYMENT_REQUIRED` — gating class `POST_DEPLOYMENT_REQUIRED`; non-`RB-001` | §5.3, §9.4 |
| Independent post-flip security / compatibility review of the W2-I bytes | `BLOCKING_OPEN` | §9.1 |
| Coverage figure bound at a pin | `POST_MERGE_REQUIRED` | §9.7 |
| Production backup key custody; off-system storage | `EXTERNAL_RESOURCE` | §6.4b, §9.7 |
| Live production backup-encryption verification | `POST_DEPLOYMENT_REQUIRED` | §6.4b, §9.7 |
| Gate authority of record held in the control plane | `EXTERNAL_RESOURCE` | §9.7 |

**Reading rule.** `DEFERRED_NON_BLOCKING_GOVERNANCE_ITEM` and `EXTERNAL_RESOURCE` items are
recorded but do **not** hold `v1.0.0-rc1` at its current status. `BLOCKING_OPEN` and
`POST_MERGE_REQUIRED` items do. That is the whole of the difference, and no prose elsewhere in this
document overrides this table.

**Compound labels.** One row above carries a compound label,
`EXTERNAL_RESOURCE_REQUIREMENT / POST_DEPLOYMENT_REQUIRED`. That is **not** a second class and it
does not break disjointness: the part before the slash names *where the artifact of record lives*,
and the part after it is the **single gating class**. Where a compound label appears, read the
gating class only; it is always named explicitly in the row and again in the section that details
the item.

**Closed by earlier revisions and retained for history:** **9.1** (the W2-I status flip is applied
to the artifact bytes), **9.2a** (the two skipped Fabric checks are proven correct path-gated
skips), **9.3** (the pinned SOC head's CI run identifier is bound here) and **9.3a** (the Cyber AI
pin is green). **9.7** remains *partially* closed: a derived, explicitly non-authoritative snapshot
exists in-repo, but the gate authority of record has not moved.

**Resolved by this revision.** Three previously-empty snapshot fields — `codex_challenges`,
`performance_evidence` and `database_restore_drill` — now carry derived indexes of real
control-plane and SOC records (§6.4b, §6.4c, §9.7). The five dangling evidence documents are
resolved by **re-sourcing or withdrawal** (§2.2a); zero dangling paths remain. And the SOC pin is
rebased onto `origin/main`, removing the branch-protection *impossibility* recorded as
`CODEX-ADJ-005` pre-merge blocker 1 (§2, §9.5).

**Reclassified by this revision.** The `security.txt` publication item moves from `BLOCKING_OPEN`
to `EXTERNAL_RESOURCE_REQUIREMENT / POST_DEPLOYMENT_REQUIRED` (§9.4). It is a reclassification of an
item whose facts are unchanged — the file is still not served, and the 404 still stands — made
because its closing action is a production deployment and therefore cannot precede one. `RB-001`
remains `RESOLVED` and is untouched. Nothing is waived and no authority is granted.

**Sharpened, not closed.** Resolving the five references narrowed two items rather than removing
them, and both now carry the class `POST_MERGE_REQUIRED` (§9.0): the `NEG-1..NEG-6` matrix is
ratified at **gate** level but unsourced at **scenario** level, and its scenario-level rehearsal must
be executed against the exact post-merge images (§4.3); the service rollback-rehearsal figures are
reclassified rather than re-sourced (§6.3, §6.4a). Six specific figures are **withdrawn** rather than restated (§2.2a).
Every claim added in this revision that is not a hosted CI fact or a git ancestry fact is
reproduced from outside this repository and is marked as such.

### 9.1 **CLOSED** — the W2-I status flip is applied to the artifact bytes

**Status: closed by the Founder-adjudicated flip carried in this revision.**

Boundary `HB-4` is `CLOSED` with `SATISFIED_BY_COUNCIL_DECISION_ACCEPT` and `INBOX-007` records
decision `ACCEPT` for *W2-I Inference Plane Transport Binding v0.2.0*, decided 2026-08-20. The
prior revision recorded that the **decision** was authoritative while the **artifact** had not
caught up. It has now caught up. Applied 2026-08-21, as a single whole-packet act:

| Artifact | Before | After |
|---|---|---|
| `contracts/openapi/…contract-0.2.0.openapi.yaml` | `PROPOSED` / `PROPOSED-SUCCESSOR` | `ACCEPTED FOR IMPLEMENTATION` / `CURRENT` |
| `contracts/json-schema/cybrik.transport-common-defs.v1.schema.json` | `PROPOSED` | `ACCEPTED FOR IMPLEMENTATION` |
| `contracts/json-schema/cybrik.inference-transport-binding.v1.schema.json` | `PROPOSED` | `ACCEPTED FOR IMPLEMENTATION` |
| `contracts/json-schema/cybrik.transport-authorization-error.v1.schema.json` | `PROPOSED` | `ACCEPTED FOR IMPLEMENTATION` |
| `contracts/examples/transport/examples-manifest.json` | `PROPOSED` | `ACCEPTED FOR IMPLEMENTATION` |
| `contracts/compatibility/…v1.manifest.json` (W2-D, the **one** governing manifest) | no candidate material (ADR-0001 D6) | absorbed all four members; predecessor row relabelled `SUPERSEDED-SUPPORTED`; acceptance recorded under `w2i_transport_binding_acceptance` |
| `contracts/compatibility/…w2i-proposed-delta.json` | `PROPOSED`, `x-cybrik-applied: false` | `ACCEPTED FOR IMPLEMENTATION`, `x-cybrik-applied: true` — **consumed**, no residual authority |
| [`docs/adr/ADR-0011-…`](../adr/ADR-0011-inference-plane-transport-binding-profile.md) | `PROPOSED — NOT DECIDED` | `ACCEPTED`, decided 2026-08-20 at `HB-4` |

Four properties of the flip are worth stating because each was a way it could have gone wrong:

1. **The superseded predecessor was relabelled, never rewritten.**
   `contracts/openapi/cybrik-ai-inference-plane.v1.openapi.yaml` is byte-identical before and after
   (`731f4d27…`), keeping its own `x-cybrik-status: ACCEPTED FOR IMPLEMENTATION`. Supersession is
   recorded in the **manifest member row**, which is what `G-W2I-4` requires. It is
   `SUPERSEDED-SUPPORTED`, not retired: retirement floor is `max(2027-02-16, two subsequent minor
   releases)`, the release-count bound is unmet, so **no retirement date exists** and none is
   authorized.
2. **Still exactly one manifest and one owner.** No second compatibility manifest was created —
   the forward-looking `…inference-plane.v0.2.0-candidate.manifest.json` the prior revision named as
   *planned* is **withdrawn**, because a second manifest is precisely the shape Founder Option A
   rejected (`G-W2I-2`). Per `(method, path)` pair there is one `CURRENT` owner (the successor), one
   `SUPERSEDED-SUPPORTED` document, and zero proposals.
3. **The delta was consumed, not deleted.** Its own pre-flip plan said to delete it; the Founder
   adjudication directed marking it applied instead. It is retained as the review trail — the
   pre-flip digests, the D2 compatibility disclosure and the open items all survive audit — and is
   inert: `x-cybrik-applied: true`, `x-cybrik-is-manifest: false`, and `x-cybrik-grants` still
   denies all acceptance authority. Every member records **both** its reviewed digest
   (`sha256_at_proposal`) and its applied digest, so the claim *"the flip changed only the lifecycle
   header"* is checkable rather than asserted.
4. **The conformance harness was made lifecycle-aware, not loosened.**
   `tools/contract-validation/validate-transport.mjs` previously pinned the delta to `PROPOSED` and
   would have rejected any flip. It now enforces the **post-flip** invariants with equal strength and
   inverts `D6`: the accepted manifest must declare every absorbed member at a digest agreeing with
   the delta, must relabel the predecessor `SUPERSEDED-SUPPORTED` and byte-frozen, and must record the
   gate decision. A half-flip in either direction — a member ahead of its packet, or a packet ahead
   of its members — is rejected. `204 / 204` harness tests pass, above the 80% line and branch
   coverage floor.

**Not closed by the flip.** `HB-4` accepted the W2-I binding; it did **not** amend the accepted W2-F
service-delegation operation-token table, and amending W2-F would edit bytes accepted at a different
gate. So `ai.model_classes.list` and `ai.model_class_health.read` are now accepted *transport*
vocabulary that accepted *delegation* vocabulary does not define: **no W2-F delegation token may
lawfully authorize either GET operation** until that separate amendment is reviewed and recorded.
This was a `BLOCKING` item **before** acceptance. After acceptance it is reclassified
`DEFERRED_NON_BLOCKING_GOVERNANCE_ITEM` (§9.0), and the reclassification is a narrowing of scope,
not a relaxation of the constraint: `v1.0.0-rc1` authorizes only the two accepted **create**
delegation tokens, so the missing read vocabulary withdraws nothing this candidate claims, while the
prohibition on presenting a delegation token for either GET stands in full and unamended. Read-token
expansion is deferred to post-RC1 and is decided at W2-F's own gate, never here. The obligation is
carried in the accepted manifest (`w2i_transport_binding_acceptance.carried_forward_obligations`), in
the consumed delta (`gate.open_items`), and as `OD-W2I-2` in ADR-0011.

Also still open, and **not** reclassified: no independent post-flip security/compatibility review
(`BLOCKING_OPEN`, §9.0) and **no runtime evidence of any kind**.

**Disclosure — this revision rewrote accepted, digest-pinned bytes, and re-pinned them.** The flip
above left the successor OpenAPI's *narrative* text describing itself as `PROPOSED — NOT ACCEPTED`
and the predecessor as still `CURRENT`, contradicting the structured fields the same flip had already
moved. This revision aligns that prose — the header comment block, the predecessor-lifecycle
paragraph, the operation-token note and one response `description`. It is the completion of the same
whole-packet act (ADR-0001 D5), performed under the same rule: **no** path, operation, `operationId`,
parameter, request body, `required` flag, response binding or `security` requirement moved. Because
the bytes changed, the member's SHA-256 was re-derived and re-pinned in **all four** sites that bind
it — the accepted W2-D packet manifest, both pin sites in the consumed delta, and this candidate's
manifest — and the packet manifest's own post-flip digest (`sha256_after_flip`) was re-pinned in the
delta. `validate-transport.mjs` verifies that whole chain and passes, which is what makes the rewrite
auditable rather than silent. The pre-flip revert digest `e04c8617…` is untouched, so §6.5 still
holds. What is **not** claimed: hosted CI coverage of these exact bytes (§4.2).

### 9.2 No product test suite was re-executed against its pinned head

- **Cyber AI:** the `276` conformance count was measured at `b867220f…`, which after the branch
  rebase is **not an ancestor** of the pin `b5ab09c8…` (§2.2). The conformance file
  `tests/contract/test_w2i_transport_conformance.py` is present at the pin's ancestry, and the pin
  adds a `cryptography` upgrade (`PYSEC-2026-3552`), an issuer-binding auth fix, a half-open
  circuit-breaker single-probe fix and a `mypy --strict` test correction that no local run covers.
  The hosted PR #11 `test` check **is green at the pin itself** (§9.3a), so a hosted pass/fail
  signal now exists — but the hosted run emits no per-test transcript into this repository, so
  there is still no test count or transcript bound to the pin.
- **Fabric:** the `172 / 172` control-plane and Go executor results belong to `147a1d83…`, which
  is off-line from the pin `0e4fee8d…` (§2.2). Those figures are now **withdrawn** (§2.2a). At the
  pin, both planes are path-gated skips whose verification is **inherited** from the base commit on
  `main` (§9.2a) — correct, but inherited is not re-executed.
- Re-execution was not attempted because it requires dependency installation, which is
  Founder-gated in this repository.

**Narrowed by this revision.** The Cyber AI `test` job's own log **was** read at the pin and reads
`1065 passed, 17 skipped, 9 warnings in 20.38s` (§4.1). That is a real count at the real pin, and
it supersedes the prior statement that no test count is bound to any pin. Two limits survive: it is
a hosted-log observation rather than a transcript committed here, and **no coverage figure is bound
for any component** — the withdrawn Cyber AI `96.63%` is not replaced.

**Closing action:** attach test-session transcripts taken at `b5ab09c8…` and `0e4fee8d…`, and bind
a coverage figure measured at a pin.

### 9.2a **CLOSED** — the two skipped Fabric checks are proven correct path-gated skips

**Status: closed. Disposition `VALID_PATH_GATED_INHERITED_VERIFICATION`.**

Fabric's run `32389505003` is 4/4 green with two skips, `control-plane` and `executor`. A skip is
not self-evidently benign — it looks identical whether the check was correctly gated out or silently
lost — so the disposition is proven from three independent read-only observations rather than
assumed.

**1. What PR #6 actually changes.** Exactly one file:

| Status | Diff | Path |
|---|---|---|
| modified | `+12 / -7` | `SECURITY.md` |

`changed_files: 1`, base `main`, head `0e4fee8d…`. **Zero** changes under `src/control-plane/`,
`tests/control-plane/`, `tests/conformance/`, `contracts-vendor/` or `src/executor/`.

**2. What the detector gates on.** `.github/workflows/ci.yml`, job `detect`, step `filter`:

| Output | Trigger pattern |
|---|---|
| `control_plane` | `^(src/control-plane/\|tests/control-plane/\|tests/conformance/\|contracts-vendor/)` |
| `executor` | `^src/executor/` |
| both | `^\.github/` |

Each plane job runs only under `if: needs.detect.outputs.<plane> == 'true'`. `SECURITY.md` matches
none of the three patterns.

**3. What the detector actually did.** Not inferred — the `detect` job (`96492567174`) prints its
own diff, and the log at `2026-08-20T16:02:28Z` reads:

```text
changed files:
SECURITY.md
```

Both outputs therefore resolved `false` and both plane jobs were skipped by their `if:` conditions.

**Why this cannot be a broken detector.** The filter is deliberately **fail-open**: an unresolvable
diff base (force-push, first push) or a failed `git diff` runs **both** planes and emits a warning.
Neither the `base unresolved` nor the `diff measurement failed` path appears in the job log. A skip
is therefore only reachable when the diff resolved *and* genuinely matched nothing.

**What the skips mean.** Because zero bytes changed under either plane's trigger paths, the
control-plane and executor verification carried by the base commit on `main` is **inherited
unchanged**. The skip asserts nothing about those planes beyond what `main` already established.

**What this does not prove.** It does not re-execute either suite, binds no test transcript at this
pin, and grants no runtime, deployment or release authority. Fabric runtime remains `HOLD`, and
§9.2 stays open on its own terms.

### 9.3 **CLOSED** — the pinned SOC head's CI run is now bound in this repository

**Status: closed by this revision.**

An earlier revision observed the SOC pin's own rollup complete and green but recorded that **no run
identifier for it was committed here**, so `cybrik-suite` could not corroborate its own SOC pin.
That was closed by binding run `32447499849` at `2822b9e1…`.

**Re-bound at the rebased pin.** That run is now superseded along with its head. `CODEX-ADJ-005`
found `2822b9e1…` `BEHIND` `origin/main` under strict up-to-date checks (§9.5), so the branch was
rebased and re-pinned at `34b6302…`, and `2822b9e1…` is **not** an ancestor of the new pin. A run
against a head that is not an ancestor proves nothing about the pin, so a **fresh** run was required
rather than carried forward.

Workflow run **`32460749335`** (`ci`, event `pull_request`, branch `fix/copilot-draft-auth`) was
fetched by id from the GitHub Actions API on 2026-08-21T16:20:00+07:00: `status: completed`,
`conclusion: success`, and `head_sha` **`34b6302e6bdc34e3fb334c079680e76166d9b476`** — exactly this
pin. Its full job inventory is recorded in the manifest: nine jobs concluded `success` (`api`
`96707087898`, `backup-tool` `96707087953`, `pf-workers` `96707088017`, `web` `96707087901`,
`secret-scan` `96707087717`, `dependency-scan` `96707087963`, `sbom` `96707087909`, `e2e`
`96710255755`, `e2e-org` `96710255709`); one, `alert-context-route-db` (`96707088555`), was skipped;
none failed. The `api` job's `Migration test (upgrade -> downgrade -> upgrade)` step is part of this
green result, which is what makes the Alembic downgrade qualification in §6.4a CI-enforced rather
than a one-off measurement.

**Residual, non-blocking:** the hosted run reports pass/fail only and emits no per-test transcript
into this repository, so the SOC pin carries no test count (§9.2). The **divergence item is closed**
in the other direction, though: the UAT-evidenced `4480a412…` is now a verified **ancestor** of the
pin rather than divergent from it (§2.2).

### 9.3a **CLOSED** — the Cyber AI pin is green; `type`, `test` and `build-offline` all pass

**Status: closed by re-pin in this revision.** The prior revision bound
`cybrik-cyber-ai-platform` at `5d0c2d43880f8e54e358015ca92d89ba8d09ddc0`, whose PR #11 rollup was
complete and **red**: 5 successful, `type` failed (exit code 1; workflow run `32451755425`, job
`96681490549`), and `test` and `build-offline` skipped as a consequence. The recorded closing
action was to fix `type` in the owning repository, let `test` run to completion, and re-pin here.

That happened. `cybrik-cyber-ai-platform` produced `b5ab09c8194bc88cfa7c2fdbb53c672efd06a722` —
the direct child of `5d0c2d43…`, subject `fix(test): widen breaker state read to satisfy mypy
strict in resilience tests` — and its PR #11 rollup, observed 2026-08-21T12:57:30+07:00, is **complete and
green**: 8 successful, 0 skipped, 0 failing, under workflow run `32452271445` (`type`
`96682896755`, `test` `96682973118`, `build-offline` `96683084302`). This manifest revision binds
that head. Both problems recorded here are resolved: there is no failing check at any pinned head,
and the pin's hosted `test` signal — the evidence cited for the W2-I conformance suite (§3.1,
§4.1) — is present at the pin itself rather than only at an ancestor.

The manifest now records `ci_status_recorded: SUCCESS` for this component, carries the cleared
condition as `blocking_condition_history`, and the staging-qualification status no longer carries
`BLOCKED_ON_FAILING_CYBER_AI_TYPE_CHECK`.

**Residual, non-blocking:** a green hosted `test` check is a pass/fail observation, not a
transcript. No test count is bound to the pin, so §9.2 stays open on its own terms. One provenance
note: the task authorizing this re-pin quoted the commit subject as `fix(test): call
breaker.state() method correctly in resilience tests to satisfy mypy strict`; the subject recorded
above and in the manifest is the one the commit actually carries, read from the GitHub commits API.
An earlier revision also recorded that the `cybrik-suite` pin `be7e7361…` had no rollup at that
exact SHA because it was not pushed — **that is closed too**. The Suite pin has advanced three times
since, and now sits at `7065a703…` with its own green run `32464960479` plus a companion push-event
run `32464954616` at the same head (§2.1).

**Superseded, and now stronger.** The statement above that "no test count is bound to the pin" no
longer holds for this component. The `test` job's own log at the pin (`96682973118`) reads
`1065 passed, 17 skipped, 9 warnings in 20.38s`, read read-only from the job-logs API and bound in
§2.1, §4.1 and the manifest. It remains a hosted-log observation rather than a transcript committed
here, and **no coverage figure** is published into this repository.

### 9.4 `security.txt` is not served at the public canonical URL

**Status: `EXTERNAL_RESOURCE_REQUIREMENT / POST_DEPLOYMENT_REQUIRED`** (§9.0, and mirrored in the
derived snapshot). Read that compound label precisely: the **gating class is
`POST_DEPLOYMENT_REQUIRED`**, and `EXTERNAL_RESOURCE_REQUIREMENT` names only *where the artifact of
record lives* — the public web edge at `cybrik.ai`, outside every suite repository. It is not a
second gating class, so the §9.0 disjointness rule is intact. **This item does not gate staging
qualification.**

**Verified here.** The file exists at
[`public/.well-known/security.txt`](../../public/.well-known/security.txt), is byte-identical to the
copy of record at [`docs/security/security.txt`](../security/security.txt), matches the
specification embedded in
[`RESPONSIBLE-DISCLOSURE-POLICY.md`](../security/RESPONSIBLE-DISCLOSURE-POLICY.md) §6.1, and is RFC
9116 field-conformant on every required and optional field (§5.3). The in-repository path is the
canonical `.well-known/` location. That is the whole of what a repository can verify.

**Not verified, and not verifiable from here.** Serving at the public canonical URL was re-observed
negative on 2026-08-21, unchanged from the earlier probe:

```text
$ curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://cybrik.ai/.well-known/security.txt
404 text/html; charset=utf-8
```

The origin returns the site's HTML 404 page, not the file — matching `HB-3`'s own
`public_security_txt_status: PENDING_PUBLIC_WEB_DEPLOYMENT (404)`. The file is also unsigned (the
RFC's optional PGP signature). No commit in any suite repository can change either fact: publishing
at that URL is a **production web deployment**, which `cybrik-suite:CLAUDE.md` reserves to the
Founder and which by definition cannot be verified before a deployment exists.

**Reclassified by this revision, from `BLOCKING_OPEN`.** The reclassification rests on facts already
recorded here, not on a new judgement: (1) `RB-001`'s substance was the *absence of a verified
intake channel*, and that channel — `security@cybrik.ai` / `report@cybrik.ai` routed to
`contact@bpech.com`, delivery-tested end-to-end — is verified, which is why `RB-001` is `RESOLVED`
(2026-08-20, Founder sign-off); (2) the §7 gate table already carries public serving as a
*remaining requirement of a resolved gate*, not as a reopening of it; and (3) the closing action is
a production deployment, so the item satisfies `POST_DEPLOYMENT_REQUIRED` on the definition §9.0
gives it. **What this changes:** the item no longer holds `v1.0.0-rc1` at
`CANDIDATE_READY_FOR_STAGING_QUALIFICATION`. **What it does not change:** `RB-001` stays `RESOLVED`
and is not reopened, weakened or re-litigated; the file is still not served; the 404 above still
stands; and no deployment, publication or production authority is granted, claimed or implied by
this or any other line in this document.

**Closing action (unchanged):** deploy the file to `https://cybrik.ai/.well-known/security.txt` and
verify it returns `200` with `Content-Type: text/plain; charset=utf-8`.

### 9.5 None of the four pins is on `main`, and none is merged

All four pinned heads live only on feature/chore branches, and all four pull requests are
`PENDING_REQUIRED_HUMAN_REVIEW` under branch protection. A release candidate pinned to unmerged
branch commits cannot be reproduced from `origin/main`. This is the stated cause of the
`IN_PROGRESS / PENDING_HUMAN_PR_MERGE` staging-qualification status and is **human-only work** —
no machine action can close it.

**One obstruction was removed by this revision.** `CODEX-ADJ-005` recorded as pre-merge blocker 1
that PR #13 was `BEHIND` `origin/main` while `main` requires strict up-to-date checks — that head
could never satisfy branch protection at all, regardless of review. The branch is now rebased onto
`origin/main` `4480a412…` and re-pinned at `34b6302…` with its own qualification run. That converts
an *impossibility* into ordinary pending review. It merges nothing.

**Closing action:** human review and merge of PRs #56, #13, #11 and #6, then re-pin this manifest
to the resulting `main` commits, and run required CI against every merged SHA
(`CODEX_POST_MERGE_REQUIREMENTS`).

### 9.6 Rollback targets are not re-established against the pins

**Status: open, and weaker than the prior revision recorded.**

Because no product evidence SHA is an ancestor of its pin (§2.2), the rehearsed rollback target
images (§6.3) no longer correspond to the pinned code. The rehearsed *procedure* (§6.2) is
unaffected; the *targets* are.

Two qualifications this revision adds. First, the **Suite-level** rollback path (§6.5) is
materially different after §9.1: this candidate now **does** move contract state — the W2-I flip
absorbed four members into the accepted W2-D manifest and relabelled a fifth. Reverting is still a
single-commit revert and still bounded, because the superseded predecessor is byte-frozen and on
disk and the accepted manifest returns to its exact pre-flip digest
`e04c8617c3348d7a642cd95a672902d51aa4a2b41a198614b8ee121101ea207b`. But the prior revision's claim
that *"no contract packet is promoted"* no longer holds, and reverting the **bytes** does not by
itself reverse the `HB-4` **decision** — that would need its own recorded decision.

Second, the rollback rehearsal outcome formerly asserted in §6.3 was **unsourced in this
repository**. This revision does not restate it: every figure is reclassified `POST_MERGE_REQUIRED`
(§6.3), and the parts of the rollback story that **can** be qualified today are qualified
explicitly in §6.4a — linear Alembic downgrade (`VERIFIED`, CI-enforced, 22/22 revisions, identical
1628-line schema fingerprint) and rollback-target inheritance (`STRUCTURALLY_VERIFIED`, images built
from source rather than pulled by tag).

Third, §6.4a states *why* this item cannot close before merge rather than merely that it hasn't.
Because the compose topology builds application images from the checked-out tree, re-establishing a
rollback target requires an image **rebuild** from a merged main-line SHA. Building and publishing
from an unmerged PR head would need deployment authority that `cybrik-suite:CLAUDE.md` reserves to
the Founder. The item is therefore `POST_MERGE_REQUIRED` by construction, not by omission.

**Closing action:** after merge, rebuild a known-stable rollback image per service from the merged
main-line SHAs, re-run the `SCENARIO-TRIAD-UAT-001` smoke flow plus `NEG-1..NEG-4` against the
restored environment, and record the measured recovery time.

### 9.7 The gate authority of record lives outside this repository — partially addressed

**Status: partially closed. A derived artifact exists and is now reconciled against exact evidence;
the authority gap itself does not move.**

The previous revision of this document cited `docs/uat/founder-uat-readiness.v1.json` as the source
of the `LIVE_VERTICAL` / `DEPLOY_ROLLBACK_REHEARSAL` / `CYBER_AI_RUNTIME` `FAIL` statuses. **That
file does not exist** — not at that path, not elsewhere in `cybrik-suite`, and not in any of the
three product repositories. The reference was dangling and has been removed.

The gate statuses in §7.1 are sourced from
`soc-autonomous-state:founder-uat-r22/FOUNDER-UAT-DECISION.md`,
`soc-autonomous-state:HUMAN_BOUNDARIES.json` and `soc-autonomous-state:AUTHORITY_INBOX.json` —
control-plane artifacts **outside every suite repository**.

**What this revision adds.** Per the Founder adjudication, a derived gate-status artifact is now
committed at
[`docs/releases/evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json`](evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json).
It carries `DERIVED_RELEASE_EVIDENCE: true` and `AUTHORITATIVE_ORCHESTRATION_STATE: false`, and both
flags are load-bearing: the snapshot is a **projection**, not a source. Where it and the control
plane disagree, the control plane wins. Every field carries an `in_repository_corroboration` value
so a reader can tell the two classes of claim apart:

- **`VERIFIED`** — the four components' CI facts and the W2-I contract state. This repository
  observed these itself (read-only GitHub Actions API by exact run id, `head_sha` compared to the
  pin in every case; the flipped contract bytes are here and the validators check them).
- **`ABSENT`** — every governance gate. `HB-1`..`HB-5` and the ten-gate ratification are reproduced
  from the control plane and **nothing committed here reproduces them independently**. The one
  exception is `HB-4`'s `artifact_status_flip_applied`, which is checkable here (§9.1).

So the honest scope of the closure is: the snapshot removes the *absence of an in-repo artifact*. It
does **not** make `cybrik-suite` able to reproduce its own gate status, because a derived file that
claimed to be authoritative would recreate the exact gap it was written to document.

**The three previously-empty fields are now populated — as derived indexes.** The prior revision
recorded `codex_challenges`, `performance_evidence` and `database_restore_drill` as
`NO_IN_REPOSITORY_RECORD` and deliberately left them empty, on the grounds that emitting a count or
a `PASS` without a record would be inventing release evidence. Real records now exist, so each
field carries a **derived projection** of one:

| Field | Now | Source of record | Corroboration here |
|---|---|---|---|
| `codex_challenges` | `DERIVED_INDEX_COMMITTED`, `count_recorded_here: 5` — `ADJ-001`..`ADJ-005` with subject, verdict, output-artifact sha256 and disposition | `soc-autonomous-state:CODEX_DECISIONS.json`; reports under `soc-autonomous-state:reports/codex-challenges/` | `ABSENT` — the digests pin the bytes read, they do not make the verdicts checkable here |
| `performance_evidence` | `DERIVED_BASELINE_COMMITTED` — four micro-benchmarks with tool, exact subject, n and percentiles (§6.4c) | `soc-autonomous-state:reports/evidence/performance/PERFORMANCE_BASELINE_EVIDENCE.json`, sha256 `e73c2b2cc09a8fdf1b2b5bdbfb919250b3073893aae694e69d4d0d14b6354745` | `ABSENT` |
| `database_restore_drill` | `DERIVED_DRILL_EVIDENCE_COMMITTED` — two passed drills, one unencrypted and one `age`-encrypted, each with report digest, provider, measured RTO and table/row reconciliation (§6.4b) | `cybrik-soc-command-center:reports/evidence/restore-drill/` — the encrypted drill is carried by the pinned SOC head itself | `ABSENT` in `cybrik-suite` |

The Codex index carries all five adjudications:

| ID | Subject | Verdict | Output sha256 | Disposition |
|---|---|---|---|---|
| `CODEX-ADJ-001` | W2-I Inference Plane Transport Binding v0.2.0 Candidate | `COUNCIL_HOLD` | — (ledger entry only) | **Discharged** — Council `ACCEPT` at HB-4; the flip is applied here and is validator-checkable (§9.1) |
| `CODEX-ADJ-002` | Candidate R22 Machine Completeness | `ENGINEERING_DEVELOPMENT_COMPLETE` | — (ledger entry only) | **Superseded by human ratification** — machine completeness is not gate acceptance; the ten gates were ratified `PASS` at HB-5 |
| `CODEX-ADJ-003` | Pre-Remediation Exact-Subject Challenge Evaluation | `PRE_REMEDIATION_FAIL` | `a01d766d1109bc681c4495e3181300f49f1f79ab18539f9fd41a2ac55dfa2270` | **Remediated** — `ABMB-02` (backup encryption scope) is the direct cause of the encrypted drill in §6.4b |
| `CODEX-ADJ-004` | Post-Remediation Exact-Subject Challenge Evaluation | `POST_REMEDIATION_FAIL` | `f13ebf07cb27ea9f9380eaa2202eea4c8992889b340f1141827fcf034d936b18` | **Partially discharged** — maps to §9.1 `APPLIED`, §9.2 `OPEN`, §9.3 `BOUND`, §9.6 `POST_MERGE_REQUIRED`, §9.7 (this snapshot) |
| `CODEX-ADJ-005` | Post-Adjudication Exact-Subject Challenge Evaluation | `POST_ADJUDICATION_FAIL` | `bdb818be08f7e3c43456cc6063296624bc29ea99d6de5dc52d5319335588093e` | **All three pre-merge items addressed by this revision** — SOC pin rebased (§2, §9.5), five evidence references reconciled (§2.2a), encrypted drill bound (§6.4b). `CODEX_POST_MERGE_REQUIREMENTS` remain **open** and human-only |

Two interim reports in the same series are indexed but not mapped to a ledger entry:
`CODEX_EXACT_SUBJECT_CHALLENGE_REPORT.md` (sha256 `0b17b7c7…`, blockers concern an earlier pin
tuple) and `CODEX_EXACT_SUBJECT_CHALLENGE_REPORT_POST_REMEDIATION.md` (sha256 `0c2b2ada…`, raised
the half-open circuit-breaker defect resolved by advancing the Cyber AI pin).

**The five dangling evidence references are resolved.** They are resolved by **re-sourcing or
withdrawal** — see §2.2a for the full mapping. Two are replaced by hosted CI evidence measured at
the pins themselves, two by the Founder UAT ratification record, and one is split: its
database-rollback and target-inheritance halves are qualified now (§6.4a) and its service-rehearsal
figures are reclassified `POST_MERGE_REQUIRED` (§6.3). Six figures are **withdrawn** rather than
restated. **No missing document was authored**, because authoring one would be the exact failure
this section was written to prevent. Zero dangling evidence paths remain in this specification.

**What this did not fix.** Resolving a reference is not the same as reproducing the evidence:

- The `NEG-1..NEG-6` matrix is ratified at **gate** level (`LIVE_VERTICAL` `PASS`, HB-5) and
  remains unsourced at **scenario** level — no per-case identifier, input, expected rejection or
  observed rejection is bound in any suite repository. Scenario-level rehearsal **execution** is
  classified `POST_MERGE_REQUIRED` (§9.0): it needs a topology built from the exact post-merge
  main-line SHAs, which do not exist yet (§4.3, §9.5).
- **No coverage figure** is bound for any component; the withdrawn Cyber AI `96.63%` is not
  replaced.
- The performance baseline is a workstation micro-benchmark, and two of its four metrics were
  measured against a SOC subject the rebase left **off-pin** (§6.4c).
- For backups, only the **local** drill is `VERIFIED`. Production key custody and off-system
  storage are `EXTERNAL_RESOURCE`, and live production verification is `POST_DEPLOYMENT_REQUIRED`
  (§6.4b).
- Every verdict and measurement added here is `ABSENT` for in-repository corroboration.

**Closing actions:** (a) after merge, re-run `NEG-1..NEG-6` against the exact post-merge images and
bind the per-case transcript, and bind a coverage figure measured at a merged SHA — both
`POST_MERGE_REQUIRED` (§9.0); (b) re-measure the performance baseline against the current pins, or state
explicitly that rc1 makes no performance claim; (c) after deployment, verify the encrypted-backup
control against production with measured RPO/RTO and a key-custody attestation; (d) the underlying
authority gap remains: the gates of record stay in the control plane, and only moving them would
truly close this item.

---

## 10. Approval

This document and its manifest are Suite-local artifacts. Promotion of `v1.0.0-rc1` beyond
`CANDIDATE_READY_FOR_STAGING_QUALIFICATION` — and any push, tag, or external publication —
requires explicit Founder approval per `cybrik-suite:CLAUDE.md`.
