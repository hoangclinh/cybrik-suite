# Release Candidate v1.0.0-rc1 — CYBRIK Suite

- **Document ID:** `CYBRIK-RC-V1.0.0-RC1`
- **Document Status:** `DRAFT`
- **Release Candidate:** `v1.0.0-rc1`
- **Milestone:** SOC Post-UAT Production Release Candidate
- **Release Status:** `CANDIDATE_READY_FOR_STAGING_QUALIFICATION`
- **Staging Qualification:** `IN_PROGRESS / PENDING_HUMAN_PR_MERGE`
- **Manifest Binding:** [`releases/manifests/release-candidate-v1.0.0-rc1.manifest.json`](../../releases/manifests/release-candidate-v1.0.0-rc1.manifest.json)
- **Timestamp:** `2026-08-21T12:57:30+07:00` (`Asia/Ho_Chi_Minh`)

> **Status honesty.** `CANDIDATE_READY_FOR_STAGING_QUALIFICATION` means the candidate is
> assembled, its Suite-local contract validation is green, and the human governance boundaries
> `HB-1`..`HB-5` are closed. It does **not** mean the candidate is qualified, piloted, or GA.
> Staging qualification is `IN_PROGRESS` and blocked on one thing: `PENDING_HUMAN_PR_MERGE` —
> all four pins are unmerged pull-request heads awaiting required human review (§2). The prior
> revision's second blocker, a **failing `type` check at the pinned `cybrik-cyber-ai-platform`
> head**, is **cleared**: the pin has been advanced to `b5ab09c8…`, whose PR #11 rollup is 8/8
> green (§2.1, §9.3a). All four pinned components now carry a green rollup. §9 records
> every item this document could **not** verify. Nothing here promotes any contract packet to
> stable v1/GA, and nothing here is an ADR-0001 immutable bundle tag.

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
GitHub API (commit object, PR #11 head ref, compare, check-runs and workflow-runs endpoints) at
2026-08-21T12:57:30+07:00. No fetch was performed into any product repository — this change is
scoped to `cybrik-suite` only.

| # | Repository | Pinned PR Head | PR | Branch | Commit Subject |
|---|---|---|---|---|---|
| 1 | `cybrik-suite` | `be7e7361fd3c23384b1b0d2aa5042ed6c245339a` | [#56] | `fix/rc-manifest-contracts` | `fix(release): bind cyber-ai circuit breaker head 5d0c2d4 and clarify provenance model` |
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
reason: the prior revision's failing `type` check at the Cyber AI pin has been cleared by advancing
that pin to `b5ab09c8…` (§2.1, §9.3a).

The `cybrik-suite` pin `be7e7361…` is the local authoring parent of the commit carrying this
revision and has **not yet been pushed** to PR #56, so no hosted rollup exists at that exact SHA;
the green Suite rollup recorded in §2.1 was observed at its verified ancestor `afc9150a…`.

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
| `cybrik-suite` | `c518d8e344c412dc884135e3947213c5de41739f` | **Rebase rewrite.** Not an ancestor (merge base `55e94c28…`); identical subject carried at `f051192…`, a verified ancestor of `be7e7361…`; the prior manifest pin `afc9150a…` is the pinned head's direct parent, and `7f41296…` is also an ancestor | `VALID_SUCCESSOR_CONTAINING_AUTHORIZED_SUBJECT` |
| `cybrik-soc-command-center` | `992eabdcdd8a70bd44c7a21119df2211c9e02c8c` | **Ancestor.** Verified ancestor of `2822b9e1…`; the previous manifest pins `7be18872…` and `c0f75f6d…` are also ancestors | `VALID_SUCCESSOR_CONTAINING_AUTHORIZED_SUBJECT` |
| `cybrik-cyber-ai-platform` | `b867220fdc07d736e625e5fac88c6baf4d0d431f` | **Rebase rewrite.** Not an ancestor (merge base `2dd7aca2…`; pin 35 ahead / 3 behind); subject `test(w2i): add contract-to-runtime transport conformance test suite for v0.2.0` carried at `f9dad52…`, a verified ancestor of `b5ab09c8…` (pin 5 ahead); the previous manifest pin `5d0c2d43…` is the pinned head's **direct parent** (1 ahead / 0 behind), and `6793e217…` (2 ahead) and `ccbfb4f8…` (3 ahead) are also ancestors | `VALID_SUCCESSOR_CONTAINING_AUTHORIZED_SUBJECT` |
| `cybrik-security-tool-fabric` | `9a80ebebd00bae90b1f3e379c27d672b263124d4` | **Rebase rewrite.** Not an ancestor (merge base `3292a65a…`); subject `docs(security): update SECURITY.md to active responsible disclosure policy` carried at `49bc3d8` on the pinned branch | `VERIFIED_EQUIVALENT_REWRITE` |

CI status was read back from each pull request's GitHub status-check rollup **at the pinned head**
on 2026-08-21T12:57:30+07:00. **All four components are green.**

| Repository | Rollup Observed At | Observed Check Rollup | Verdict |
|---|---|---|:---:|
| `cybrik-suite` | `afc9150a…` (ancestor of the pin) | **3 / 3** distinct checks successful — `secret-scan`, `contract standards validation`, `topology rehearsal tests`; 6 rollup entries because each is reported by two workflow triggers; 0 failing | **GREEN** |
| `cybrik-soc-command-center` | `2822b9e1…` (the pin) | **9 / 9** successful — `api`, `backup-tool`, `pf-workers`, `web`, `secret-scan`, `dependency-scan`, `sbom`, `e2e`, `e2e-org`; 1 skipped (`alert-context-route-db`); 0 failing | **GREEN** |
| `cybrik-cyber-ai-platform` | `b5ab09c8…` (the pin) | **8 / 8** successful — `scaffold-integrity`, `lockfile-integrity`, `secret-scan`, `security-supply-chain`, `lint`, `type`, `test`, `build-offline`; 0 skipped; 0 failing | **GREEN** |
| `cybrik-security-tool-fabric` | `0e4fee8d…` (the pin) | **4 / 4** successful — `scaffold-integrity`, `secret-scan`, `detect`, `admission-gate`; 2 skipped (`control-plane`, `executor`); 0 failing | **GREEN** |

The Cyber AI entry is the change in this revision. The prior pin `5d0c2d43…` failed `type` (exit
code 1, workflow run `32451755425`, job `96681490549`), which skipped `test` and `build-offline`
and left that pin with no hosted test evidence. Its direct child `b5ab09c8…`, pinned here, fixes
the `mypy --strict` breaker-state read in the resilience tests and takes the full suite green under
workflow run `32452271445`: `type` `96682896755`, `test` `96682973118`, `build-offline`
`96683084302`. The pin therefore now carries hosted test evidence **at the pin itself**, including
for the W2-I conformance suite (§3.1, §4.1, §9.3a).

Two scope limits apply to this all-green rollup. First, the Suite row was observed at the pin's
**ancestor** `afc9150a…`, not at `be7e7361…`, which is not yet pushed. Second, a green hosted
rollup is a **check-state observation**, not a re-executed suite (§9.2) and not a merge: all four
pins remain unmerged heads under `PENDING_REQUIRED_HUMAN_REVIEW`.

The control record `soc-autonomous-state:VERIFIED_SUBJECTS.json` (recorded
2026-08-21T10:35:00+07:00) predates the SOC, Cyber AI and Suite hardening heads: it records
`SUCCESS` for the **ancestor** heads `7be18872…`, `ccbfb4f8…` and `f051192…`, and for the Fabric
pin `0e4fee8d…` exactly. The rollups above are an observation of check state, **not** a
re-execution of any suite. The SOC pin's rollup is complete and green, but no run identifier for it
is bound in this repository (§9.3); the Cyber AI pin's rollup is complete and **green**, and its
run and check identifiers **are** recorded above and in the manifest (§9.3a).

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
| `cybrik-soc-command-center` | `4480a412…` ([SOC UAT surface evidence](../uat/evidence/SOC-UAT-SURFACE-TECHNICAL-EVIDENCE-2026-08-19.md), CI run `32164562480`, 8/8 required contexts) | `2822b9e1…` | **Divergent** — merge base `1b6671cc…`; pin is 11 commits ahead and 56 behind the evidenced SHA | **Does NOT carry forward.** That CI run belongs to the evidenced SHA. The pin's own PR #13 checks are complete and green as re-observed at 2026-08-21T12:57:30+07:00, but that run is not bound in this repository (§2.1). See §9.3. |

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
   — `be7e7361…` here, `afc9150a…` in the prior revision. That pin is a content-base marker, not a
   claim that `be7e7361…` is the released Suite commit.
2. **Pre-merge heads are mutable identities.** Every pin in §2 is an unmerged PR head under branch
   protection, and three of the four branches have already been rebased at least once (§2.1), which
   rewrites SHAs while preserving subjects. Only a post-merge `main` SHA is stable enough to be a
   release identity.

The consequence for readers — and the specific ambiguity `ABMB-04` raises: **a content-base pin
must never be read as a released SHA.** Nothing in §2 has been released, tagged, deployed, or
promoted. `v1.0.0-rc1` as a *tag* does not exist yet.

The envelope may be created only when all of the following hold:

- all four pull requests (#56, #13, #11, #6) are merged to their repositories' `origin/main`;
- each merged SHA has its own completed, green check rollup — every *pre-merge* pin now has one
  (§2.1), but no merged SHA exists yet, and the Suite pin `be7e7361…` has not been pushed;
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
| **W2-I** — inference-plane transport binding | [`contracts/compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json`](../../contracts/compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json) | `0.2.0` | **`ACCEPTED`** — Decision Council, boundary `HB-4`, 2026-08-20. **Artifact status flip NOT applied; see §9.1** |

The **W2-I acceptance decision is closed**: boundary `HB-4` (`W2_I_ACCEPTANCE`) is `CLOSED` with
resolution `SATISFIED_BY_COUNCIL_DECISION_ACCEPT`, recorded at
`soc-autonomous-state:AUTHORITY_INBOX.json` `INBOX-007` (decision `ACCEPT`, 2026-08-20T19:15+07:00).
The **in-repository artifact bytes have not yet been flipped** to match that decision — the delta
record still carries `x-cybrik-status: PROPOSED` and `x-cybrik-applied: false`. Under ADR-0001 D5
the status flip is a separate, separately recorded change. §9.1 tracks that gap.

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
| `cybrik-cyber-ai-platform` | + W2-I transport conformance (suite introduced at ancestor head `6793e217…`, present on the pinned branch) | Previously recorded as **276** unit/contract tests at `b867220f…`; the hosted PR #11 `test` check is **`SUCCESS` at the pin `b5ab09c8…`** (check run `96682973118`, workflow run `32452271445`) — pass/fail only, no per-test transcript | PR #11 rollup 2026-08-21T12:57:30+07:00 | **No local re-run; hosted pass/fail at the pin, no transcript; see §9.2, §9.3a** |
| `cybrik-security-tool-fabric` | pytest control plane at `147a1d83…` | **172 / 172 passed** | [Tool Fabric Runtime evidence §5.1](../operations/TOOL-FABRIC-RUNTIME-ENGINEERING-EVIDENCE.md) | No |
| `cybrik-security-tool-fabric` | Go 1.22 executor (`go test ./...`, incl. `FuzzParse`) | All passed | [Tool Fabric Runtime evidence §5.2](../operations/TOOL-FABRIC-RUNTIME-ENGINEERING-EVIDENCE.md) | No |
| `cybrik-soc-command-center` | CI run `32164562480` attempt 2 at `4480a412…` | **8 / 8 required contexts successful**; Playwright `31 passed`; pytest `279 collected / 278 passed / 1 skipped` | [SOC UAT surface evidence](../uat/evidence/SOC-UAT-SURFACE-TECHNICAL-EVIDENCE-2026-08-19.md) | No — and this run is on a **divergent** SHA (§2.2) |
| all four PR heads | hosted PR checks at the pinned heads | **All four green** — Suite 3/3 (at ancestor `afc9150a…`), SOC 9/9, Cyber AI 8/8, Fabric 4/4; 0 failing anywhere | GitHub status-check rollups observed 2026-08-21T12:57:30+07:00 (§2.1) | **Check state observed, no suite re-executed (§2.1)** |
| `cybrik-suite` | `node tools/contract-validation/validate-inference.mjs` | **PASS (exit 0)** | Executed 2026-08-21 at content base `f051192…` — §4.2 | **Yes — inputs byte-identical at the current base (§4.2)** |

### 4.2 Suite Contract Validation Executed for this Candidate

Executed on 2026-08-21 at the prior content base `f051192…`. It was **not** re-run at the current
content base `be7e7361…`: every byte under `contracts/` and `tools/contract-validation/` is
identical between the two commits (`git diff f051192…be7e736 -- contracts/ tools/contract-validation/`
is empty, verified), so the run's inputs are unchanged. The validator's `ajv` dependency is not installed in
this worktree and dependency installation is Founder-gated, so no re-run was attempted.

```text
$ node tools/contract-validation/validate-inference.mjs
=== W2-D inference packet — JSON Schema / fixtures / trust-invariant validation ===
counts: {"inference_schemas_loaded":8,"inference_schemas_compiled":8,"positive_total":8,
"positive_pass":8,"negative_schema_total":8,"negative_schema_reject":8,
"negative_semantic_total":4,"negative_semantic_structurally_valid":4,
"reused_accepted_members":3,"manifest_members":11,"wire_refs_total":43,
"wire_refs_external_resolved":18,"asyncapi_messages_checked":5,
"asyncapi_messages_data_bound":5,"invariants_checked":39,"invariants_ok":39}

OK — inference packet passes JSON Schema 2020-12 compile/ref-resolution, all fixtures,
and every trust invariant (lifecycle: ACCEPTED FOR IMPLEMENTATION at v0.1.0).

exit 0
```

All **39 / 39** trust invariants hold, all **8 / 8** positive fixtures validate, all **8 / 8**
negative-schema fixtures are rejected, and all **4 / 4** negative-semantic fixtures are
structurally valid (rejected only by a runtime trust invariant, as designed). The counts are
byte-identical to the prior revision's run.

The validator's `node_modules` tree was **borrowed read-only** from the canonical `cybrik-suite`
checkout rather than installed — dependency installation is Founder-gated in this repository — and
the borrowed tree was detached again immediately after the run. No lockfile, `package.json`, or
dependency byte in this repository was changed.

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

Reverting this release candidate at the Suite level is a single-commit revert of the manifest and
this document. No contract packet is promoted, re-versioned, or bundle-tagged by this candidate,
so a revert restores the prior governance state exactly and leaves W2-B/W2-D/W2-F/W2-G packet
acceptance untouched.

---

## 7. Gate Status — Authoritative Post-UAT

All five human governance boundaries (`HB-1`..`HB-5`) are **`CLOSED`** per
`soc-autonomous-state:HUMAN_BOUNDARIES.json` (`open_boundary_count: 0`). The gate table below is
the authoritative post-UAT status for this candidate.

| Gate | Boundary | Status | Authority Record | Remaining Requirement |
|---|---|---|---|---|
| `RESPONSIBLE_DISCLOSURE` / `RB-001` | `HB-3` | **`RESOLVED`** (2026-08-20) | `INBOX-005`, `INBOX-006`; [`RELEASE-BLOCKERS.md`](RELEASE-BLOCKERS.md) | Public serving of `security.txt` at the canonical URL (§9.4) |
| `W2_I_ACCEPTANCE` — transport binding v0.2.0 | `HB-4` | **`ACCEPTED`** (Decision Council, 2026-08-20) | `INBOX-007`, decision `ACCEPT` | Apply the artifact status flip to the in-repo delta record (§9.1) |
| `SOC_UAT_RATIFICATION` — Candidate R22 Founder UAT | `HB-5` | **`PASS` / `RATIFIED`** (Founder, 2026-08-20) | `INBOX-008`, decision `PASS`; walkthrough `PASS` at `INBOX-002` | — |
| `HOSTED_INTEGRATION_CONTROL` | `HB-1` | **`PASS`** (Founder, 2026-08-20) | `INBOX-004` | — |
| `UAT_PERSONA_EVIDENCE` — human accessibility session | `HB-2` | **`PASS`** (Founder / human reviewer, 2026-08-20) | `INBOX-003` | — |
| **Staging Qualification** | — | **`IN_PROGRESS / PENDING_HUMAN_PR_MERGE`** | `soc-autonomous-state:CURRENT_STATE.json` | Human review + merge of PRs #56 / #13 / #11 / #6; rollback targets re-established (§6.4). The Cyber AI CI blocker is **cleared** (§9.3a) |

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
evaluated candidate; the pins in §2 are unmerged PR heads whose suites were not re-executed
locally (§9.2, §9.3), and no rollback target is bound to a pin (§9.6). All four pins now carry a
green hosted rollup (§2.1), which removes the prior revision's red-pin objection but adds no gate
authority. In particular, the ratified `CYBER_AI_RUNTIME` gate was ratified against the UAT
candidate, **not** against `b5ab09c8…`; a green rollup at that head is a check-state observation,
not evidence that the gate applies to it. Engineering satisfaction
(`*_ENGINEERING_SATISFIED`) remains a distinct and lesser claim than gate status, and gate status
remains a distinct and lesser claim than qualification.

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
| W2-I delta record | `cybrik-suite:contracts/compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json` |
| W2-I conformance suite | `cybrik-cyber-ai-platform:tests/contract/test_w2i_transport_conformance.py` |
| Human boundary register | `soc-autonomous-state:HUMAN_BOUNDARIES.json` |
| Authority inbox | `soc-autonomous-state:AUTHORITY_INBOX.json` |
| Verified PR-head subjects | `soc-autonomous-state:VERIFIED_SUBJECTS.json` |

---

## 9. Open Items — Not Verified by this Document

These are recorded rather than resolved. Each must be closed before staging qualification can be
claimed. Items 9.1–9.7 carry forward from the prior revision with their status updated against the
current pin set. **9.3a is now CLOSED** — the Cyber AI CI blocker recorded in the prior revision
is resolved by this revision's re-pin.

### 9.1 W2-I is accepted by decision but not by artifact bytes

Boundary `HB-4` is `CLOSED` with `SATISFIED_BY_COUNCIL_DECISION_ACCEPT` and `INBOX-007` records
decision `ACCEPT` for *W2-I Inference Plane Transport Binding v0.2.0*. The **decision** is
therefore authoritative and this document records it as `ACCEPTED` (§3, §7).

The **artifact** has not caught up. The only W2-I artifact in this repository is
[`contracts/compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json`](../../contracts/compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json),
which still declares `x-cybrik-status: PROPOSED`, `x-cybrik-not-accepted: true` and
`x-cybrik-applied: false`, and whose own text states that a status flip requires explicit recorded
authorization (ADR-0001 D5) and that no release manifest may reference the PROPOSED bytes
(ADR-0001 D6). The forward-looking path the prior manifest revision named,
`contracts/compatibility/cybrik-suite-inference-plane.v0.2.0-candidate.manifest.json`, **still does
not exist**; the manifest now records it as `planned_packet_manifest` with
`planned_packet_manifest_present: false` and points `declared_artifact` at the file that does
exist. Existing in-repo governance records also still read the old way:
[`FOUNDER-DECISION-PACKET-FOUNDER-UAT-IMPLEMENTATION-WAVE.md`](../adr/FOUNDER-DECISION-PACKET-FOUNDER-UAT-IMPLEMENTATION-WAVE.md)
holds `UAT-A2B` at `HOLD` and records W2-I as `PROPOSED — NOT ACCEPTED`.

**Closing action:** apply the `HB-4` decision to the artifact — flip the delta record's status
with the acceptance evidence and SHA-256 recorded, and reconcile the ADR decision packet — so the
bytes and the decision agree.

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

### 9.3 The pinned SOC head has no CI evidence in this repository

`2822b9e1…` is divergent from the UAT-evidenced `4480a412…` (merge base `1b6671cc…`; 11 commits
ahead, 56 behind). The `8 / 8 required contexts` result belongs to the evidenced SHA. The control
record `soc-autonomous-state:VERIFIED_SUBJECTS.json` records `SUCCESS` for the **ancestor** head
`7be18872…`, not for this pin. At the pin itself, PR #13's rollup has since **completed green** —
re-observed 2026-08-21T12:57:30+07:00 as 9 successful / 1 skipped / 0 failing — which resolves the
*incompleteness* noted in the prior revision. What remains open is that **no run identifier or result for that run
is committed in this repository**, so `cybrik-suite` still cannot corroborate its own SOC pin.
**Closing action:** bind PR #13's completed run identifier and result into this repository, or
adopt a SOC SHA on `origin/main` with its own green run.

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
transcript. No test count is bound to the pin, so §9.2 stays open on its own terms. Two further
provenance notes: the task authorizing this re-pin quoted the commit subject as `fix(test): call
breaker.state() method correctly in resilience tests to satisfy mypy strict`; the subject recorded
above and in the manifest is the one the commit actually carries, read from the GitHub commits API.
And the fourth pin, `cybrik-suite` `be7e7361…`, has no rollup at that exact SHA because it is not
yet pushed (§2, §2.1).

### 9.4 `security.txt` publication is unverified

The file is present and RFC 9116 field-conformant locally (§5.3), but serving at
`https://cybrik.ai/.well-known/security.txt` was not observed; `HB-3` itself records
`public_security_txt_status: PENDING_PUBLIC_WEB_DEPLOYMENT (404)`. It is also unsigned (the RFC's
optional PGP signature). This does **not** reopen `RB-001` — the blocker was the absence of a
verified intake channel, and that channel is verified. **Closing action:** verify the canonical URL
returns the file with `Content-Type: text/plain; charset=utf-8`.

### 9.5 None of the four pins is on `main`, and none is merged

All four pinned heads live only on feature/chore branches, and all four pull requests are
`PENDING_REQUIRED_HUMAN_REVIEW` under branch protection. A release candidate pinned to unmerged
branch commits cannot be reproduced from `origin/main`. This is the stated cause of the
`IN_PROGRESS / PENDING_HUMAN_PR_MERGE` staging-qualification status and is **human-only work** —
no machine action can close it. **Closing action:** human review and merge of PRs #56, #13, #11
and #6, then re-pin this manifest to the resulting `main` commits.

### 9.6 Rollback targets are not re-established against the pins

Because no product evidence SHA is an ancestor of its pin (§2.2), the rehearsed rollback target
images (§6.3) no longer correspond to the pinned code. The rehearsed procedure is unaffected; the
targets are. **Closing action:** re-establish a known-stable rollback image per service against the
pinned heads and re-run the `SCENARIO-TRIAD-UAT-001` smoke flow plus `NEG-1..NEG-4`.

### 9.7 The gate authority of record lives outside this repository

The previous revision of this document cited `docs/uat/founder-uat-readiness.v1.json` as the source
of the `LIVE_VERTICAL` / `DEPLOY_ROLLBACK_REHEARSAL` / `CYBER_AI_RUNTIME` `FAIL` statuses. **That
file does not exist** — not at that path, not elsewhere in `cybrik-suite`, and not in any of the
three product repositories (verified by `git ls-files` across all four). The reference was dangling
and has been removed.

The gate statuses in §7.1 are therefore sourced from
`soc-autonomous-state:founder-uat-r22/FOUNDER-UAT-DECISION.md`,
`soc-autonomous-state:HUMAN_BOUNDARIES.json` and `soc-autonomous-state:AUTHORITY_INBOX.json` —
control-plane artifacts that are **outside every suite repository**. Nothing committed in
`cybrik-suite` corroborates them, so this repository cannot independently reproduce its own release
candidate's gate status. **Closing action:** commit a gate-status artifact of record into
`cybrik-suite:docs/uat/`, derived from the Founder UAT decision, so the release manifest and its
gate evidence live in the same repository.

---

## 10. Approval

This document and its manifest are Suite-local artifacts. Promotion of `v1.0.0-rc1` beyond
`CANDIDATE_READY_FOR_STAGING_QUALIFICATION` — and any push, tag, or external publication —
requires explicit Founder approval per `cybrik-suite:CLAUDE.md`.
