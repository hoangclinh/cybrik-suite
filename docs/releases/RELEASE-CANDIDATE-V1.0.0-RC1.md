# Release Candidate v1.0.0-rc1 — CYBRIK Suite

- **Document ID:** `CYBRIK-RC-V1.0.0-RC1`
- **Document Status:** `DRAFT`
- **Release Candidate:** `v1.0.0-rc1`
- **Milestone:** SOC Post-UAT Production Release Candidate
- **Release Status:** `CANDIDATE_READY_FOR_STAGING_QUALIFICATION`
- **Staging Qualification:** `IN_PROGRESS / PENDING_HUMAN_PR_MERGE`
- **Manifest Binding:** [`releases/manifests/release-candidate-v1.0.0-rc1.manifest.json`](../../releases/manifests/release-candidate-v1.0.0-rc1.manifest.json)
- **Timestamp:** `2026-08-21T13:30:00+07:00` (`Asia/Ho_Chi_Minh`)
- **Derived snapshot:** [`docs/releases/evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json`](evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json)
  — `DERIVED_RELEASE_EVIDENCE=true`, `AUTHORITATIVE_ORCHESTRATION_STATE=false` (§9.7)

> **Status honesty.** `CANDIDATE_READY_FOR_STAGING_QUALIFICATION` means the candidate is
> assembled, its Suite-local contract validation is green, and the human governance boundaries
> `HB-1`..`HB-5` are closed. It does **not** mean the candidate is qualified, piloted, or GA.
> Staging qualification is `IN_PROGRESS` and blocked on one thing: `PENDING_HUMAN_PR_MERGE` —
> all four pins are unmerged pull-request heads awaiting required human review (§2). The prior
> revision's second blocker, a **failing `type` check at the pinned `cybrik-cyber-ai-platform`
> head**, is **cleared**: the pin has been advanced to `b5ab09c8…`, whose PR #11 rollup is 8/8
> green (§2.1, §9.3a). All four pinned components now carry a green rollup, and in this revision
> **all four are bound to an exact hosted run identifier whose `head_sha` equals the pin** (§2.1,
> §9.3). This revision also applies the Founder-adjudicated **W2-I status flip** to the artifact
> bytes (§9.1) and records the **Fabric path-gating proof** (§9.2a). §9 records every item this
> document could **not** verify — including three fields of the derived snapshot that have **no
> in-repository record at all**, and four cited evidence documents that **do not exist** (§9.7).
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
four pins were additionally re-verified read-only against the GitHub Actions runs and jobs API at
2026-08-21T13:30:00+07:00 (§2.1). No fetch was performed into any product repository — this change
is scoped to `cybrik-suite` only.

| # | Repository | Pinned PR Head | PR | Branch | Commit Subject |
|---|---|---|---|---|---|
| 1 | `cybrik-suite` | `eba517bfa70b767c19df5f0c9fbdd4358290faea` | [#56] | `fix/rc-manifest-contracts` | `fix(release): bind verified green cyber-ai head b5ab09c in rc manifest and docs` |
| 2 | `cybrik-soc-command-center` | `2822b9e18831e4fc180cb50c455b5e67e3ed365a` | [#13] | `fix/copilot-draft-auth` | `hardening(config): enforce strict fail-closed DSN and rate-limit backend validation in production` |
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

The `cybrik-suite` pin `eba517bf…` is the local authoring parent of the commit carrying this
revision. **It has been pushed**, and it has its own hosted run — `32452878301`, 3/3 green (§2.1) —
which closes the prior revision's caveat that the Suite rollup could only be observed at an
ancestor.

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
| `cybrik-suite` | `c518d8e344c412dc884135e3947213c5de41739f` | **Rebase rewrite.** Not an ancestor (merge base `55e94c28…`); identical subject carried at `f051192…`, a verified ancestor of `eba517bf…`; the prior manifest pin `be7e7361…` is the pinned head's direct parent, and `afc9150a…` and `7f41296…` are also ancestors | `VALID_SUCCESSOR_CONTAINING_AUTHORIZED_SUBJECT` |
| `cybrik-soc-command-center` | `992eabdcdd8a70bd44c7a21119df2211c9e02c8c` | **Ancestor.** Verified ancestor of `2822b9e1…`; the previous manifest pins `7be18872…` and `c0f75f6d…` are also ancestors | `VALID_SUCCESSOR_CONTAINING_AUTHORIZED_SUBJECT` |
| `cybrik-cyber-ai-platform` | `b867220fdc07d736e625e5fac88c6baf4d0d431f` | **Rebase rewrite.** Not an ancestor (merge base `2dd7aca2…`; pin 35 ahead / 3 behind); subject `test(w2i): add contract-to-runtime transport conformance test suite for v0.2.0` carried at `f9dad52…`, a verified ancestor of `b5ab09c8…` (pin 5 ahead); the previous manifest pin `5d0c2d43…` is the pinned head's **direct parent** (1 ahead / 0 behind), and `6793e217…` (2 ahead) and `ccbfb4f8…` (3 ahead) are also ancestors | `VALID_SUCCESSOR_CONTAINING_AUTHORIZED_SUBJECT` |
| `cybrik-security-tool-fabric` | `9a80ebebd00bae90b1f3e379c27d672b263124d4` | **Rebase rewrite.** Not an ancestor (merge base `3292a65a…`); subject `docs(security): update SECURITY.md to active responsible disclosure policy` carried at `49bc3d8` on the pinned branch | `VERIFIED_EQUIVALENT_REWRITE` |

CI status was verified from the **GitHub Actions runs and jobs API by exact run identifier** on
2026-08-21T13:30:00+07:00. For every component the run object was fetched by id and its `head_sha`
compared against the pin. **All four components are green, and all four runs sit at the pin
itself** — the prior revision's Suite caveat (rollup observed only at an ancestor) is closed.

| Repository | Run ID | Run `head_sha` = pin? | Observed Check Rollup | Verdict |
|---|---|:---:|---|:---:|
| `cybrik-suite` | `32452878301` (`contracts`) | **yes** — `eba517bf…` | **3 / 3** successful — `secret-scan` (`96684462876`), `contract standards validation` (`96684462998`), `topology rehearsal tests` (`96684463076`); 0 skipped; 0 failing | **GREEN** |
| `cybrik-soc-command-center` | `32447499849` (`ci`) | **yes** — `2822b9e1…` | **9 / 9** successful — `api`, `backup-tool`, `pf-workers`, `web`, `secret-scan`, `dependency-scan`, `sbom`, `e2e`, `e2e-org`; 1 skipped (`alert-context-route-db`); 0 failing | **GREEN** |
| `cybrik-cyber-ai-platform` | `32452271445` (`ci`) | **yes** — `b5ab09c8…` | **8 / 8** successful — `scaffold-integrity`, `lockfile-integrity`, `secret-scan`, `security-supply-chain`, `lint`, `type`, `test`, `build-offline`; 0 skipped; 0 failing | **GREEN** |
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

The Suite pin advanced in this revision. The prior revision pinned `be7e7361…`, an unpushed local
head with no hosted run, and had to cite the ancestor `afc9150a…` instead. This revision pins
`eba517bf…` — the direct child of `be7e7361…`, and the authoring parent of the commit carrying this
document — which **does** have its own hosted run, `32452878301`, green 3/3.

One scope limit still applies to the all-green rollup: a green hosted run is a **check-state
observation**, not a re-executed suite (§9.2) and not a merge. All four pins remain unmerged heads
under `PENDING_REQUIRED_HUMAN_REVIEW` (§9.5), and no run emits a per-test transcript into this
repository, so **pass/fail is bound here but test counts are not**.

The control record `soc-autonomous-state:VERIFIED_SUBJECTS.json` (recorded
2026-08-21T10:35:00+07:00) predates the SOC, Cyber AI and Suite hardening heads: it records
`SUCCESS` for the **ancestor** heads `7be18872…`, `ccbfb4f8…` and `f051192…`, and for the Fabric
pin `0e4fee8d…` exactly. The rollups above are an observation of check state, **not** a
re-execution of any suite. **Every** pin's run and job identifiers are now recorded above and in
the manifest, including the SOC pin's — which closes the corroboration gap the prior revision
recorded at §9.3.

### 2.2 Relationship to the SHAs Carried in the Engineering Evidence Records

The engineering evidence records committed to this repository were produced against *earlier*
commits. The pinned PR heads are **not** the evidenced SHAs. After the branch rebases, **none of
the three product evidence SHAs is an ancestor of its pin** — a regression in provenance strength
against the prior RC pin set, where the Cyber AI and Fabric evidence SHAs were ancestors. Ancestry
below was verified with `git merge-base --is-ancestor` and `git rev-list --count`, except for the
Cyber AI pin, which was compared through the GitHub compare API (§2.1):

| Repository | Evidenced SHA | Pinned Head | Ancestry (verified) | Evidence Carry-Forward |
|---|---|---|---|---|
| `cybrik-cyber-ai-platform` | `281b2529…` ([Cyber AI Runtime evidence](../operations/CYBER-AI-RUNTIME-ENGINEERING-EVIDENCE.md)) | `b5ab09c8…` | **Divergent** — merge base `2dd7aca2…`; pin is 35 commits ahead, evidenced SHA 1 commit off-line (`feat(auth): add fail-closed service delegation verifier (W2-H1)`) | **Does NOT carry forward as ancestry.** The `258 / 258` result belongs to a commit that is not an ancestor of the pin. The pin does, however, have its own green hosted `test` check (§2.1). See §9.2. |
| `cybrik-security-tool-fabric` | `147a1d83…` ([Deploy/Rollback evidence](../operations/DEPLOY-ROLLBACK-REHEARSAL-ENGINEERING-EVIDENCE.md)) | `0e4fee8d…` | **Divergent** — merge base `3292a65a…`; pin is 29 commits ahead, evidenced SHA 1 commit off-line (`feat(contracts): load the auth/org vendored snapshot as its own registry`) | **Does NOT carry forward as ancestry.** The `172 / 172` and Go executor results belong to an off-line commit. See §9.2. |
| `cybrik-soc-command-center` | `4480a412…` ([SOC UAT surface evidence](../uat/evidence/SOC-UAT-SURFACE-TECHNICAL-EVIDENCE-2026-08-19.md), CI run `32164562480`, 8/8 required contexts) | `2822b9e1…` | **Divergent** — merge base `1b6671cc…`; pin is 11 commits ahead and 56 behind the evidenced SHA | **Does NOT carry forward.** That CI run belongs to the evidenced SHA. The pin has its own green run `32447499849`, now bound in this repository (§2.1, §9.3), but it is a different run proving a different thing. |

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
   — `eba517bf…` here, `be7e7361…` in the prior revision. That pin is a content-base marker, not a
   claim that `eba517bf…` is the released Suite commit.
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
| `cybrik-cyber-ai-platform` | pytest (ai-api, ai-core, ai-worker, contract) at `281b2529…` | **258 / 258 passed**, 96.63% coverage | [Cyber AI Runtime evidence §](../operations/CYBER-AI-RUNTIME-ENGINEERING-EVIDENCE.md) | No |
| `cybrik-cyber-ai-platform` | + W2-I transport conformance (suite introduced at ancestor head `6793e217…`, present on the pinned branch) | Previously recorded as **276** unit/contract tests at `b867220f…`; the hosted PR #11 `test` check is **`SUCCESS` at the pin `b5ab09c8…`** (job `96682973118`, run `32452271445`) — pass/fail only, no per-test transcript | Run `32452271445` verified by id 2026-08-21T13:30:00+07:00 | **No local re-run; hosted pass/fail at the pin, no transcript; see §9.2, §9.3a** |
| `cybrik-security-tool-fabric` | pytest control plane at `147a1d83…` | **172 / 172 passed** | [Tool Fabric Runtime evidence §5.1](../operations/TOOL-FABRIC-RUNTIME-ENGINEERING-EVIDENCE.md) | No |
| `cybrik-security-tool-fabric` | Go 1.22 executor (`go test ./...`, incl. `FuzzParse`) | All passed | [Tool Fabric Runtime evidence §5.2](../operations/TOOL-FABRIC-RUNTIME-ENGINEERING-EVIDENCE.md) | No |
| `cybrik-soc-command-center` | CI run `32164562480` attempt 2 at `4480a412…` | **8 / 8 required contexts successful**; Playwright `31 passed`; pytest `279 collected / 278 passed / 1 skipped` | [SOC UAT surface evidence](../uat/evidence/SOC-UAT-SURFACE-TECHNICAL-EVIDENCE-2026-08-19.md) | No — and this run is on a **divergent** SHA (§2.2) |
| all four PR heads | hosted CI runs at the pinned heads | **All four green, each at the pin itself** — Suite 3/3 (run `32452878301`), SOC 9/9 (run `32447499849`), Cyber AI 8/8 (run `32452271445`), Fabric 4/4 + 2 path-gated skips (run `32389505003`); 0 failing anywhere | GitHub Actions runs + jobs API by exact run id, 2026-08-21T13:30:00+07:00 (§2.1) | **Check state verified, no suite re-executed (§2.1, §9.2)** |
| `cybrik-suite` | `node tools/contract-validation/validate-transport.mjs` | **PASS (exit 0)** — lifecycle `ACCEPTED FOR IMPLEMENTATION` | Executed 2026-08-21 against the flipped bytes — §4.2 | **Yes — re-run for the W2-I flip (§9.1)** |
| `cybrik-suite` | `node --test tools/contract-validation/tests/validate-transport.test.mjs` | **204 / 204 passed**, validator line + branch coverage above the 80% floor | Executed 2026-08-21 — §4.2 | **Yes** |
| `cybrik-suite` | `node tools/contract-validation/validate-inference.mjs` | **PASS (exit 0)** | Executed 2026-08-21 against the flipped W2-D manifest — §4.2 | **Yes** |

> **Sourcing caveat on the first five rows.** The Cyber AI `258 / 258`, the Fabric `172 / 172`, the
> Go executor results and the SOC `8 / 8` / Playwright / pytest figures are reproduced from evidence
> documents that **do not exist in any of the four suite repositories** (§9.7). They are neither
> re-executed (§9.2) nor readable here. They are left standing, flagged, rather than silently
> deleted or silently trusted.

### 4.2 Suite Contract Validation Executed for this Candidate

Re-executed on 2026-08-21 **against the flipped bytes** carried by this revision (§9.1). Unlike the
prior revision — which could not re-run and relied on `contracts/` being byte-identical to an
earlier base — the W2-I flip changes `contracts/`, so a re-run was mandatory rather than optional.
The same validators run in hosted CI under the `contract standards validation` check of run
`32452878301` at the pinned head (§2.1), so the local and hosted results agree.

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
install; `package.json`, `package-lock.json`, `tools/contract-validation/vendor/` and the test file
itself are all **unmodified** by this revision. Hosted CI installs from the lockfile with `npm ci`
and the same check passed in run `32452878301` at the pinned head. Repairing the local install would
require a dependency installation, which is Founder-gated in this repository, so it was not
attempted.

### 4.3 Negative Security Matrix (Adversarial Vectors)

Reproduced from the [Live Vertical Triad evidence](../operations/LIVE-VERTICAL-TRIAD-ENGINEERING-EVIDENCE.md) §5.

| Vector | Attack | Boundary | Invariant | Observed | Verdict |
|---|---|---|---|---|---|
| NEG-1 | Cross-tenant claim tampering (`tenant-globex` body vs `tenant-acme` token) | Cyber AI & Fabric PDP | SR-4 | `403 tenant_mismatch`; no model runtime or sandbox dispatched | PASS |
| NEG-2 | Expired delegation token (`now > exp`) | Cyber AI ingress verifier | SR-1 | `401 token_expired` before any contract dereference | PASS |
| NEG-3 | `alg: "none"` / unsigned token | JOSE parser (both planes) | SI-1 / SR-10 | `400 unsupported_algorithm` at structural boundary | PASS |
| NEG-4 | Replayed `jti` presentation | Fabric anti-replay cache | SR-8 | `409 replay_detected`; execution refused | PASS |
| NEG-5 | Audience misdirection (`svc:soc-notifier` token → `svc:security-tool-fabric`) | Fabric PDP | SR-3 | `403 audience_mismatch`; confused deputy prevented | PASS |
| NEG-6 | Marking downgrade (`confidential` input → `public` output request) | Cyber AI policy engine | TR-1 / SI-9 | `InferenceDenied` / `marking_downgrade`; output forced to lattice upper bound | PASS |

NEG-1 through NEG-4 were **re-executed post-rollback** and passed again
([Deploy/Rollback evidence §5.3](../operations/DEPLOY-ROLLBACK-REHEARSAL-ENGINEERING-EVIDENCE.md)).

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
  `https://cybrik.ai/.well-known/security.txt` URL was not observed. See §9.4.

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

### 6.3 Rehearsed Outcome

The rehearsal ([Deploy/Rollback evidence §4–§5](../operations/DEPLOY-ROLLBACK-REHEARSAL-ENGINEERING-EVIDENCE.md))
injected a reversible 503 circuit-breaker fault into `ai-api` and observed:

- **Recovery time: 6.0 seconds**, zero downtime, zero data loss;
- rollback target `cybrik-cyber-ai-platform:281b2529…` restored to `200 OK` at 1.9 ms latency;
- **4 / 4 services healthy** post-rollback;
- **7 / 7 smoke stages green** (`SCENARIO-TRIAD-UAT-001`);
- **NEG-1..NEG-4 all PASS** post-rollback.

### 6.4 Rollback Targets for this Candidate

Each service's rollback target is the last known-stable image for that service. Under the current
pin set **no product rollback target is an ancestor of its pin** (§2.2): the rehearsed Cyber AI
target `281b2529…` is off-line from `b5ab09c8…` after the branch rebase, the Fabric target
`147a1d83…` is off-line from `0e4fee8d…`, and the SOC pin `2822b9e1…` is divergent from the
evidenced `4480a412…`. The rehearsed *procedure* (§6.2) is unchanged and still applies, but every
rollback **target image** must be re-established against the pinned heads before staging
qualification can be claimed (§9.3, §9.6).

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
| `RESPONSIBLE_DISCLOSURE` / `RB-001` | `HB-3` | **`RESOLVED`** (2026-08-20) | `INBOX-005`, `INBOX-006`; [`RELEASE-BLOCKERS.md`](RELEASE-BLOCKERS.md) | Public serving of `security.txt` at the canonical URL (§9.4) |
| `W2_I_ACCEPTANCE` — transport binding v0.2.0 | `HB-4` | **`ACCEPTED`** (Decision Council, 2026-08-20); **artifact flip applied 2026-08-21** | `INBOX-007`, decision `ACCEPT` | Amend the accepted W2-F operation-token table — undischarged, and blocking both GET operations (§9.1) |
| `SOC_UAT_RATIFICATION` — Candidate R22 Founder UAT | `HB-5` | **`PASS` / `RATIFIED`** (Founder, 2026-08-20) | `INBOX-008`, decision `PASS`; walkthrough `PASS` at `INBOX-002` | — |
| `HOSTED_INTEGRATION_CONTROL` | `HB-1` | **`PASS`** (Founder, 2026-08-20) | `INBOX-004` | — |
| `UAT_PERSONA_EVIDENCE` — human accessibility session | `HB-2` | **`PASS`** (Founder / human reviewer, 2026-08-20) | `INBOX-003` | — |
| **Staging Qualification** | — | **`IN_PROGRESS / PENDING_HUMAN_PR_MERGE`** | `soc-autonomous-state:CURRENT_STATE.json` | Human review + merge of PRs #56 / #13 / #11 / #6; rollback targets re-established (§6.4); the unsourced evidence documents committed or their claims re-sourced (§9.7). The Cyber AI CI blocker is **cleared** (§9.3a) |

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
`DEPLOY_ROLLBACK_REHEARSAL`: the engineering-evidence documents behind their
`ENGINEERING_SATISFIED` column **do not exist in any suite repository** (§9.7), so that column is
reproduced from the ratification record rather than corroborated here. Engineering satisfaction
(`*_ENGINEERING_SATISFIED`) remains a distinct and lesser claim than gate status, and gate status
remains a distinct and lesser claim than qualification.

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

Five references cited elsewhere in this document are **absent from every suite repository** and are
deliberately not listed above as if they resolved:
`docs/operations/CYBER-AI-RUNTIME-ENGINEERING-EVIDENCE.md`,
`docs/operations/TOOL-FABRIC-RUNTIME-ENGINEERING-EVIDENCE.md`,
`docs/operations/LIVE-VERTICAL-TRIAD-ENGINEERING-EVIDENCE.md`,
`docs/operations/DEPLOY-ROLLBACK-REHEARSAL-ENGINEERING-EVIDENCE.md` and
`docs/uat/evidence/SOC-UAT-SURFACE-TECHNICAL-EVIDENCE-2026-08-19.md` (§9.7).

---

## 9. Open Items — Not Verified by this Document

These are recorded rather than resolved. Each must be closed before staging qualification can be
claimed. Items 9.1–9.7 carry forward from the prior revision with their status updated against the
current pin set.

**Closed by this revision:** **9.1** (the W2-I status flip is applied to the artifact bytes),
**9.2a** (the two skipped Fabric checks are proven correct path-gated skips) and **9.3** (the pinned
SOC head's CI run identifier is now bound here). **9.3a** was closed by the prior revision's re-pin
and is retained for history. **9.7** is *partially* closed: a derived, explicitly non-authoritative
snapshot now exists in-repo, but the gate authority of record has not moved.

**Newly recorded, not previously tracked:** three snapshot fields — `codex_challenges`,
`performance_evidence` and `database_restore_drill` — have **no in-repository record at all**, and
five evidence documents cited by §2.2, §4 and §6 **do not exist in any suite repository**.
Both are recorded under §9.7. The second is a genuine regression in confidence, not a formatting
issue: several headline test results in §4.1 turn out to be unsourced here rather than merely
un-re-executed.

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
This was a `BLOCKING` item before acceptance and survives it undischarged. It is carried in the
accepted manifest (`w2i_transport_binding_acceptance.carried_forward_obligations`), in the consumed
delta (`gate.open_items`), and as `OD-W2I-2` in ADR-0011. Also still open: no independent post-flip
security/compatibility review, and **no runtime evidence of any kind**.

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
  is off-line from the pin `0e4fee8d…` (§2.2).
- Re-execution was not attempted because it requires dependency installation, which is
  Founder-gated in this repository.

**Closing action:** attach test-session transcripts taken at `b5ab09c8…` and `0e4fee8d…`.

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

`2822b9e1…` is divergent from the UAT-evidenced `4480a412…` (merge base `1b6671cc…`; 11 commits
ahead, 56 behind), so the `8 / 8 required contexts` result belongs to the evidenced SHA and not to
the pin. The control record `soc-autonomous-state:VERIFIED_SUBJECTS.json` likewise records `SUCCESS`
for the **ancestor** head `7be18872…`, not for this pin. The prior revision observed the pin's own
rollup complete and green but recorded that **no run identifier for it was committed here**, so
`cybrik-suite` could not corroborate its own SOC pin.

That identifier is now bound. Workflow run **`32447499849`** (`ci`, branch `fix/copilot-draft-auth`)
was fetched by id from the GitHub Actions API on 2026-08-21T13:30:00+07:00: `status: completed`,
`conclusion: success`, and `head_sha` **`2822b9e18831e4fc180cb50c455b5e67e3ed365a`** — exactly this
pin. Its full job inventory is recorded in the manifest: nine jobs concluded `success` (`api`
`96669703600`, `backup-tool` `96669703658`, `pf-workers` `96669703523`, `web` `96669703591`,
`secret-scan` `96669703467`, `dependency-scan` `96669703568`, `sbom` `96669703319`, `e2e`
`96671897544`, `e2e-org` `96671897528`); one, `alert-context-route-db` (`96669704101`), was skipped;
none failed.

**Residual, non-blocking:** the hosted run reports pass/fail only and emits no per-test transcript
into this repository, so the SOC pin still carries no test count (§9.2), and the divergence from the
UAT-evidenced SHA is unchanged (§2.2).

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
The prior revision also recorded that the fourth pin, `cybrik-suite` `be7e7361…`, had no rollup at
that exact SHA because it was not pushed — **that is now closed too**: this revision advances the
Suite pin to `eba517bf…`, which has its own green run `32452878301` (§2.1).

### 9.4 `security.txt` publication is unverified

**Status: open, re-verified negative in this revision.**

The file is present and RFC 9116 field-conformant locally (§5.3), but it is still **not served**.
Unlike the prior revision, which inherited the claim from `HB-3`, this revision observed the
canonical URL directly on 2026-08-21T13:30:00+07:00:

```text
$ curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://cybrik.ai/.well-known/security.txt
404 text/html; charset=utf-8
```

The origin returns the site's HTML 404 page, not the file — matching `HB-3`'s own
`public_security_txt_status: PENDING_PUBLIC_WEB_DEPLOYMENT (404)`. The file is also unsigned (the
RFC's optional PGP signature).

This does **not** reopen `RB-001` — the blocker was the absence of a verified intake channel, and
that channel is verified. **Closing action:** deploy the file to the canonical URL and verify it
returns `200` with `Content-Type: text/plain; charset=utf-8`.

### 9.5 None of the four pins is on `main`, and none is merged

All four pinned heads live only on feature/chore branches, and all four pull requests are
`PENDING_REQUIRED_HUMAN_REVIEW` under branch protection. A release candidate pinned to unmerged
branch commits cannot be reproduced from `origin/main`. This is the stated cause of the
`IN_PROGRESS / PENDING_HUMAN_PR_MERGE` staging-qualification status and is **human-only work** —
no machine action can close it. **Closing action:** human review and merge of PRs #56, #13, #11
and #6, then re-pin this manifest to the resulting `main` commits.

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

Second, the rollback rehearsal outcome in §6.3 is itself **unsourced in this repository**: the
evidence document it cites does not exist (§9.7). So the targets are not merely stale — the
rehearsal they came from cannot be re-read here.

**Closing action:** re-establish a known-stable rollback image per service against the pinned heads,
re-run the `SCENARIO-TRIAD-UAT-001` smoke flow plus `NEG-1..NEG-4`, and commit the rehearsal
evidence document the specification already cites.

### 9.7 The gate authority of record lives outside this repository — partially addressed

**Status: partially closed. A derived artifact now exists; the authority gap itself does not move.**

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

**Three fields have no in-repository record at all.** The adjudication's snapshot shape names
`codex_challenges`, `performance_evidence` and `database_restore_drill`. Searching this repository
for each returns nothing:

| Field | In-repo record | Recorded as |
|---|---|---|
| `codex_challenges` | none — no identifier, ledger, disposition or transcript anywhere | `NO_IN_REPOSITORY_RECORD`, `count_recorded_here: 0` |
| `performance_evidence` | none — no latency distribution, throughput figure, load profile or saturation test | `NO_IN_REPOSITORY_RECORD` |
| `database_restore_drill` | none — §6.3 describes a **service rollback rehearsal**, which demonstrates no dump, restore, PITR or data-loss measurement | `NO_IN_REPOSITORY_RECORD` |

Those keys are present and **deliberately empty**. Emitting a count or a `PASS` for any of them
would be inventing release evidence — the single most likely failure mode for a derived snapshot,
and the reason each field instead states what is missing and what would close it.

**A second dangling-reference defect, of the same class as the one above — and larger.** §2.2, §4.1,
§4.3, §6.3 and §6.4 cite **five** evidence documents. **None of them exists in any of the four suite
repositories** (every relative link resolved against disk, and each filename searched across the org
via GitHub code search on 2026-08-21T13:30:00+07:00 — 0 results each):

| Cited path | Cited from | What depends on it |
|---|---|---|
| `docs/operations/CYBER-AI-RUNTIME-ENGINEERING-EVIDENCE.md` | §4.1 | Cyber AI `258 / 258`, 96.63% coverage |
| `docs/operations/TOOL-FABRIC-RUNTIME-ENGINEERING-EVIDENCE.md` | §4.1 | Fabric control plane `172 / 172`; Go executor results |
| `docs/operations/LIVE-VERTICAL-TRIAD-ENGINEERING-EVIDENCE.md` | §4.3 | the entire `NEG-1..NEG-6` negative security matrix |
| `docs/operations/DEPLOY-ROLLBACK-REHEARSAL-ENGINEERING-EVIDENCE.md` | §4.3, §6.3, §6.4 | 6.0 s recovery, zero data loss, 4/4 healthy, 7/7 smoke stages, `NEG-1..NEG-4` post-rollback |
| `docs/uat/evidence/SOC-UAT-SURFACE-TECHNICAL-EVIDENCE-2026-08-19.md` | §2.2, §4.1 | SOC `8 / 8` required contexts, Playwright `31 passed`, pytest `279 / 278 / 1` |

This matters more than a broken link, and it is worse than §9.2. §9.2 says those suites were not
*re-executed* against the pins; this says the records they were originally read from are **not
readable here at all**. Between them, the five documents are the sole cited source for every
headline product test result and for the whole adversarial security matrix in this specification.

Those claims are left standing in §2.2, §4 and §6 as reproduced from their cited sources and
flagged, rather than silently deleted or silently trusted — deleting them would hide the gap, and
trusting them would assert evidence this repository does not hold.

**Closing actions:** (a) commit the five missing evidence documents, or re-source every claim
depending on them and remove the dangling links; (b) commit a Codex-challenge record, a
performance record and a database-restore-drill record — or state explicitly that rc1 makes no claim
on those axes — and re-derive the snapshot; (c) the underlying authority gap remains: the gates of
record stay in the control plane, and only moving them would truly close this item.

---

## 10. Approval

This document and its manifest are Suite-local artifacts. Promotion of `v1.0.0-rc1` beyond
`CANDIDATE_READY_FOR_STAGING_QUALIFICATION` — and any push, tag, or external publication —
requires explicit Founder approval per `cybrik-suite:CLAUDE.md`.
