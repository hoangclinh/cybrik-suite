# docs/releases

Status: **no product release exists — one release *candidate* does.** A release-candidate manifest
for `v1.0.0-rc1` exists at
[`releases/manifests/release-candidate-v1.0.0-rc1.manifest.json`](../../releases/manifests/release-candidate-v1.0.0-rc1.manifest.json),
with its specification at
[RELEASE-CANDIDATE-V1.0.0-RC1.md](RELEASE-CANDIDATE-V1.0.0-RC1.md). It is a **candidate**, not a
release: `release_status` is `CANDIDATE_READY_FOR_STAGING_QUALIFICATION`, `staging_qualification_status`
is `IN_PROGRESS / PENDING_HUMAN_PR_MERGE`, **no release tag `v1.0.0-rc1` exists in any repository**,
and all four pinned heads are unmerged pull-request heads under `PENDING_REQUIRED_HUMAN_REVIEW`.
No release notes have been written, because nothing has been released.

| Document | Content |
|---|---|
| [RELEASE-CANDIDATE-V1.0.0-RC1.md](RELEASE-CANDIDATE-V1.0.0-RC1.md) | Specification for release candidate `v1.0.0-rc1`, governing [`releases/manifests/release-candidate-v1.0.0-rc1.manifest.json`](../../releases/manifests/release-candidate-v1.0.0-rc1.manifest.json). Records the four-repository content-base pin set (`cybrik-suite` at `7065a703…`), the hosted CI rollup at each pin, and the residual-item classification taxonomy (§9.0). Binds the **content base** only; the post-merge release is bound by the external tag `v1.0.0-rc1`, which is `NOT_CREATED`. Derived, non-authoritative evidence snapshot: [`evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json`](evidence/QUALIFICATION-SNAPSHOT-v1.0.0-rc1.json) |
| [RELEASE-BLOCKERS.md](RELEASE-BLOCKERS.md) | Active register of suite-level blocking release decisions. Currently: **RB-001 `RESOLVED` (2026-08-20, Founder sign-off)** — the verified responsible-disclosure intake channel `security@cybrik.ai` / `report@cybrik.ai` (routed to `contact@bpech.com`, delivery-tested end-to-end), the published policy, and an active `SECURITY.md` in all four repositories. **No release blocker is open.** Serving `security.txt` at the public canonical URL remains outstanding and is classified `EXTERNAL_RESOURCE_REQUIREMENT / POST_DEPLOYMENT_REQUIRED` — it does not reopen RB-001 and does not gate staging qualification (RC1 §9.0, §9.4) |
| [GATE-W2-B-CONTRACT-ACCEPTANCE-2026-07-24.md](GATE-W2-B-CONTRACT-ACCEPTANCE-2026-07-24.md) | Gate W2-B decision record. Outcome: **ACCEPTED FOR IMPLEMENTATION** (packet v0.1.0; not stable v1/GA, not a bundle tag) after the two High trust blockers (W2B-H1, W2B-H2) were resolved contract-first |
| [GATE-W2-C1-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md](GATE-W2-C1-ORG-HIERARCHY-ACCEPTANCE-2026-07-24.md) | Gate W2-C1 decision record. Outcome: **architecture & process ACCEPTED** — ADR-0007 org-hierarchy model + open-decision constraints OD-1..OD-6, and the UAT Gate Standard as a suite process standard. Accepts **no** contract/schema/code/UI; the contract delta stays `PROPOSED — NOT APPLIED` |
| [GATE-W2-D-INFERENCE-ACCEPTANCE-2026-07-24.md](GATE-W2-D-INFERENCE-ACCEPTANCE-2026-07-24.md) | Gate W2-D decision record. Outcome: **ACCEPTED FOR IMPLEMENTATION** (W2-D AI model-inference + alert-summarization packet v0.1.0; not stable v1/GA, not a bundle tag). Resolves G-W2D-1..5; status-flip only (no wire-semantics change); TR-1..TR-6 remain required runtime gates |
| [GATE-W2-F-SERVICE-DELEGATION-ACCEPTANCE-2026-07-24.md](GATE-W2-F-SERVICE-DELEGATION-ACCEPTANCE-2026-07-24.md) | Gate W2-F decision record. Outcome: **ACCEPTED FOR IMPLEMENTATION** (W2-F internal service-delegation + workload-identity packet v0.1.0; not stable v1/GA, not a bundle tag). Resolves G-W2F-1..5; realizes ADR-0006 E2/E3 via ADR-0008; SR-1..SR-10 remain required runtime gates; no server/endpoint, no tool/MCP authority |
| [GATE-W2-H-RESOURCE-BOUNDS-ACCEPTANCE-2026-08-01.md](GATE-W2-H-RESOURCE-BOUNDS-ACCEPTANCE-2026-08-01.md) | Gate W2-H decision record. Outcome: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED** (resource-bounds v0.1.0; not stable v1/GA, not a bundle tag). Atomic governance-metadata/digest flip only; all 36 fixture bytes and all seven schema semantic projections remain pinned; W0-T11 stays `HOLD`, release dates are unchanged, and runtime, UAT, T10/T11, deployment and production remain unauthorized |
| [GATE-W2-K-TRANSPORT-PEER-EVIDENCE-ACCEPTANCE-2026-08-01.md](GATE-W2-K-TRANSPORT-PEER-EVIDENCE-ACCEPTANCE-2026-08-01.md) | Gate W2-K decision record. Outcome: **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED** (transport peer-evidence v0.1.0; not stable v1/GA). Atomic governance-metadata/digest flip only; 18 fixture bytes and both wire-schema semantic projections remain pinned; A1–A7, N1/N9, Anycorn HOLD, runtime, UAT, release, deployment, and production remain open or unauthorized |
| [GATE-UAT-MTLS-K5-S1-ACCEPTANCE-2026-08-01.md](GATE-UAT-MTLS-K5-S1-ACCEPTANCE-2026-08-01.md) | K5/S1 historically admit internal B1 for bounded isolated UAT evaluation; D1 now records B1 `installed=true`, `pinned=true`, product `selected=false`, and HOLD only in `suite_uat_tool_lock_only`. D2 remains HOLD and UAT/DEMO/POC/RC/stable-v1/GA remain NO-GO |

Release notes and cross-product release coordination documents are added here per release, only for
real, verified release candidates. `v1.0.0-rc1` is the first such candidate; release *notes* follow
a release, and no release has occurred.
