# Release Candidate v1.0.0-rc1 — CYBRIK Suite

- **Document ID:** `CYBRIK-RC-V1.0.0-RC1`
- **Document Status:** `DRAFT`
- **Release Candidate:** `v1.0.0-rc1`
- **Milestone:** SOC Post-UAT Production Release Candidate
- **Release Status:** `CANDIDATE_READY_FOR_STAGING_QUALIFICATION`
- **Manifest Binding:** [`releases/manifests/release-candidate-v1.0.0-rc1.manifest.json`](../../releases/manifests/release-candidate-v1.0.0-rc1.manifest.json)
- **Timestamp:** `2026-08-20T20:10:00+07:00` (`Asia/Ho_Chi_Minh`)

> **Status honesty.** `CANDIDATE_READY_FOR_STAGING_QUALIFICATION` means the candidate is
> assembled and its Suite-local contract validation is green. It does **not** mean the candidate
> is qualified, piloted, or GA. Founder UAT gates (`LIVE_VERTICAL`, `DEPLOY_ROLLBACK_REHEARSAL`,
> `CYBER_AI_RUNTIME`) remain `FAIL` pending ratification, and §9 records every item this
> document could **not** verify. Nothing here promotes any contract packet to stable v1/GA, and
> nothing here is an ADR-0001 immutable bundle tag.

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
**RESOLVED (2026-08-20)** per [`RELEASE-BLOCKERS.md`](RELEASE-BLOCKERS.md). No `BLOCKING — OPEN`
entry exists in the register, so this manifest is created without a Founder waiver clause.

---

## 2. Adopted Repository SHAs

The manifest adopts these exact commits. Each SHA below was resolved against the local canonical
checkout on 2026-08-20 (`git cat-file -t` → `commit` for all four).

| Repository | Adopted SHA | Commit Subject | Branch Provenance |
|---|---|---|---|
| `cybrik-suite` | `353d5f5d786641bd41b2055d4ee9b554f7834345` | `fix(release): align release candidate manifest with adopted SHAs and governance status` | `fix/rc-manifest-contracts` (this branch; not on `main`) |
| `cybrik-soc-command-center` | `c0f75f6d08d25b16f1a3ef8921b4ba98348a194a` | `docs(security): add active SECURITY.md referencing suite responsible disclosure policy` | `chore/sec-md-soc`, `codex/w2j-org-assets-vertical` (**not on `origin/main`**) |
| `cybrik-cyber-ai-platform` | `b867220fdc07d736e625e5fac88c6baf4d0d431f` | `test(w2i): add contract-to-runtime transport conformance test suite for v0.2.0` | `feature/rc-w2i-conformance` (**not on `origin/main`**) |
| `cybrik-security-tool-fabric` | `9a80ebebd00bae90b1f3e379c27d672b263124d4` | `docs(security): update SECURITY.md to active responsible disclosure policy` | `chore/sec-md-fabric`, `codex/w2h-auth-org-conformance` (**not on `origin/main`**) |

### 2.1 Relationship to the SHAs Carried in the Engineering Evidence Records

The engineering evidence records committed to this repository were produced against *earlier*
commits. The adopted SHAs are **not** the evidenced SHAs. The relationship differs per repository
and is material to how far each evidence record carries:

| Repository | Evidenced SHA | Adopted SHA | Ancestry (verified via `git merge-base --is-ancestor`) | Evidence Carry-Forward |
|---|---|---|---|---|
| `cybrik-cyber-ai-platform` | `281b2529…` ([Cyber AI Runtime evidence](../operations/CYBER-AI-RUNTIME-ENGINEERING-EVIDENCE.md)) | `b867220f…` | Evidenced SHA **is an ancestor** of the adopted SHA. Delta = `SECURITY.md` + `tests/contract/test_w2i_transport_conformance.py` (test-only, 819 insertions) | **Carries forward.** The delta adds tests and a security doc; it changes no runtime source. |
| `cybrik-security-tool-fabric` | `147a1d83…` ([Deploy/Rollback evidence](../operations/DEPLOY-ROLLBACK-REHEARSAL-ENGINEERING-EVIDENCE.md)) | `9a80ebeb…` | Evidenced SHA **is an ancestor** of the adopted SHA | **Carries forward** for the evidenced tree; the delta is `SECURITY.md` activation. |
| `cybrik-soc-command-center` | `4480a412…` ([SOC UAT surface evidence](../uat/evidence/SOC-UAT-SURFACE-TECHNICAL-EVIDENCE-2026-08-19.md), CI run `32164562480`, 8/8 required contexts) | `c0f75f6d…` | **Divergent — neither is an ancestor of the other.** Merge base is `1b6671cc…` | **Does NOT carry forward.** The adopted SOC SHA has no CI evidence of its own in this repository. See §9. |

---

## 3. Contract Baselines

Cross-product contract governance for this candidate, as recorded in the manifest's
`contract_governance` block.

| Gate | Packet Manifest | Version | Governance Status |
|---|---|---|---|
| **W2-F** — internal service delegation + workload identity | [`contracts/compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json) | `0.1.0` | `ACCEPTED FOR IMPLEMENTATION` (Gate W2-F, 2026-07-24) |
| **W2-G** — organizational hierarchy + external-authority boundary | [`contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json) | `0.1.0` | `ACCEPTED FOR IMPLEMENTATION` (Gate W2-G, 2026-07-24) |
| **W2-D** — AI model-inference + alert summarization | [`contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json) | `0.1.0` | `ACCEPTED FOR IMPLEMENTATION` (Gate W2-D, 2026-07-24) |
| **W2-I** — inference-plane transport binding | `contracts/compatibility/cybrik-suite-inference-plane.v0.2.0-candidate.manifest.json` | `0.2.0-candidate` | `COUNCIL_ACCEPTED_BASELINE` — **artifact not present in this repository; see §9.1** |

Both W2-F and W2-G packets are `x-cybrik-packet-version: 0.1.0` with
`x-cybrik-is-bundle-tag: false`. Neither is a stable v1/GA promotion; per ADR-0001 D2 no N-1
compatibility obligation attaches pre-GA, but every future incompatibility must be recorded in the
packet manifests.

### 3.1 W2-I Transport Execution Posture

The manifest records the W2-I transport posture as
`BOUNDED_FAIL_CLOSED_ADAPTER (NO_EXTERNAL_AUTHORITY_ESCALATION)`. Concretely, at the adopted
`cybrik-cyber-ai-platform` SHA the transport conformance suite
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
| `cybrik-cyber-ai-platform` | + W2-I transport conformance at `b867220f…` | Manifest records **276** unit/contract tests passing | Manifest `contract_conformance_status` | **No — see §9.2** |
| `cybrik-security-tool-fabric` | pytest control plane at `147a1d83…` | **172 / 172 passed** | [Tool Fabric Runtime evidence §5.1](../operations/TOOL-FABRIC-RUNTIME-ENGINEERING-EVIDENCE.md) | No |
| `cybrik-security-tool-fabric` | Go 1.22 executor (`go test ./...`, incl. `FuzzParse`) | All passed | [Tool Fabric Runtime evidence §5.2](../operations/TOOL-FABRIC-RUNTIME-ENGINEERING-EVIDENCE.md) | No |
| `cybrik-soc-command-center` | CI run `32164562480` attempt 2 at `4480a412…` | **8 / 8 required contexts successful**; Playwright `31 passed`; pytest `279 collected / 278 passed / 1 skipped` | [SOC UAT surface evidence](../uat/evidence/SOC-UAT-SURFACE-TECHNICAL-EVIDENCE-2026-08-19.md) | No — and this run is on a **divergent** SHA (§2.1) |
| `cybrik-suite` | `node tools/contract-validation/validate-inference.mjs` | **PASS (exit 0)** | Executed 2026-08-20 for this RC — §4.2 | **Yes** |

### 4.2 Suite Contract Validation Executed for this Candidate

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
structurally valid (rejected only by a runtime trust invariant, as designed).

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

Each service's rollback target is the last known-stable image for that service. Note that for
`cybrik-cyber-ai-platform` the rehearsed rollback target (`281b2529…`) is the **evidenced
ancestor** of the adopted SHA, so the rehearsed procedure applies directly. For
`cybrik-soc-command-center` the rollback target must be re-established against the adopted SHA
before staging qualification, because the adopted SHA is divergent from the evidenced one (§2.1,
§9.3).

### 6.5 Manifest / Contract Rollback

Reverting this release candidate at the Suite level is a single-commit revert of the manifest and
this document. No contract packet is promoted, re-versioned, or bundle-tagged by this candidate,
so a revert restores the prior governance state exactly and leaves W2-B/W2-D/W2-F/W2-G packet
acceptance untouched.

---

## 7. Gate Status at Candidate Assembly

| Gate | Status | Blocking Requirement |
|---|---|---|
| `RB-001` responsible disclosure | **RESOLVED (2026-08-20)** | — |
| `LIVE_VERTICAL` | `FAIL` | Founder UAT ratification |
| `DEPLOY_ROLLBACK_REHEARSAL` | `FAIL` | Founder UAT ratification |
| `CYBER_AI_RUNTIME` | `FAIL` | Live vertical staging integration |
| `W2-I` transport acceptance | See §9.1 | Exact successor SHA-256 acceptance (`UAT-A2B`) |

Engineering satisfaction (`*_ENGINEERING_SATISFIED = YES` in the evidence records) is a distinct
and lesser claim than gate status. This candidate does not flip any gate.

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
| W2-I conformance suite | `cybrik-cyber-ai-platform:tests/contract/test_w2i_transport_conformance.py` |

---

## 9. Open Items — Not Verified by this Document

These are recorded rather than resolved. Each must be closed before staging qualification can be
claimed.

### 9.1 W2-I packet manifest reference is dangling

The manifest's `contract_governance.w2_i_inference_transport.packet_manifest` points at
`contracts/compatibility/cybrik-suite-inference-plane.v0.2.0-candidate.manifest.json`. **That file
does not exist** — not in `cybrik-suite`, and not in any of the three product repositories
(verified by `git ls-files` across all four). `contracts/compatibility/` contains exactly four
manifests: the base contract packet, the W2-D inference packet, the W2-G org-hierarchy packet, and
the W2-F service-delegation packet.

The reference is therefore **forward-looking**, and the `COUNCIL_ACCEPTED_BASELINE` status it
carries is not corroborated by any artifact in this repository. Existing governance records state
the opposite: [`FOUNDER-DECISION-PACKET-FOUNDER-UAT-IMPLEMENTATION-WAVE.md`](../adr/FOUNDER-DECISION-PACKET-FOUNDER-UAT-IMPLEMENTATION-WAVE.md)
holds `UAT-A2B` at **`HOLD — reviewed artifact is green but not acceptance-closed`** and records
W2-I as `PROPOSED — NOT ACCEPTED`, and [`founder-uat-readiness.v1.json`](../uat/founder-uat-readiness.v1.json)
records the W2-I gate as `FAIL`. **Closing action:** create and accept the exact v0.2.0-candidate
packet manifest under `contracts/compatibility/`, with its SHA-256 recorded at acceptance, or
correct the manifest reference.

### 9.2 The `276` conformance count was not re-executed here

`contract_conformance_status` claims `VERIFIED (276 unit/contract tests passing)`. The committed
evidence record measures **258 / 258** at the ancestor SHA `281b2529…`; the adopted SHA adds the
W2-I transport conformance file (17 test functions plus parameterization), which is consistent
with 276 but was **not** re-run to confirm. Re-execution was not attempted because the suite
requires dependency installation, which is Founder-gated in this repository. **Closing action:**
attach a test-session transcript at `b867220f…` showing `276 passed`.

### 9.3 The adopted SOC SHA has no CI evidence

`c0f75f6d…` is divergent from the UAT-evidenced `4480a412…` (merge base `1b6671cc…`), and the diff
between them is large (107 files, ~17k deletions). The `8 / 8 required contexts` result belongs to
the evidenced SHA, not the adopted one. **Closing action:** either adopt a SOC SHA on `origin/main`
with its own green CI run, or attach a green CI run for `c0f75f6d…`.

### 9.4 `security.txt` publication is unverified

The file is present and RFC 9116 field-conformant locally (§5.3), but serving at
`https://cybrik.ai/.well-known/security.txt` was not observed. It is also unsigned (the RFC's
optional PGP signature). **Closing action:** verify the canonical URL returns the file with
`Content-Type: text/plain; charset=utf-8`.

### 9.5 Three of four adopted SHAs are not on their repository's `main`

`c0f75f6d…`, `b867220f…`, and `9a80ebeb…` all live only on feature/chore branches (§2). A release
candidate pinned to unmerged branch commits cannot be reproduced from `origin/main`.
**Closing action:** merge the adopted work to `main` in each repository and re-pin, or record an
explicit Founder waiver for branch-pinned adoption.

---

## 10. Approval

This document and its manifest are Suite-local artifacts. Promotion of `v1.0.0-rc1` beyond
`CANDIDATE_READY_FOR_STAGING_QUALIFICATION` — and any push, tag, or external publication —
requires explicit Founder approval per `cybrik-suite:CLAUDE.md`.
