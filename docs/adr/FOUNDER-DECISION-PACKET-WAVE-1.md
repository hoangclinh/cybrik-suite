# Founder Decision Packet — Wave 1 (ADR-0002, ADR-0004)

- Status: `APPROVED — DECIDED`. The Founder approved all recommended answers G1–G7 and
  F1–F9 on 2026-07-24 and explicitly authorized an AI agent to apply the ADR-0002/ADR-0004
  status-flip commit under ADR-0001 D5. The authoritative accepted decisions now live in
  [ADR-0002](ADR-0002-cyber-ai-implementation-stack.md) and
  [ADR-0004](ADR-0004-tool-fabric-control-plane-executor-split.md).
- Date: 2026-07-24 (drafted and decided)
- Evidence: [ADR-0002 packet](evidence/ADR-0002-EVIDENCE.md) ·
  [ADR-0004 packet](evidence/ADR-0004-EVIDENCE.md)
- Sprint context: [ADR-DECISION-SPRINT-2026-07.md](ADR-DECISION-SPRINT-2026-07.md) ·
  gate: **GATE A3 CLOSED 2026-07-24**.
- Inherited constraints (accepted Wave 0): ADR-0002 must serialize the
  [ADR-0006](ADR-0006-cross-product-event-and-identity-model.md) envelope/identity model and
  version anything shipped under [ADR-0001](ADR-0001-suite-contract-versioning-policy.md);
  ADR-0004's identity (E2), delegation (E3), and receipt-signing (E5) **model** is already
  accepted and is *not reopened* — this packet decides the *implementation split*, not the model.

## 0. Founder answers — recorded 2026-07-24

### ADR-0002 (G1–G7)

| # | Founder answer |
|---|---|
| G1 | **YES** — Python + FastAPI + Pydantic v2 + SQLAlchemy 2.0 async, `ai-api` + `ai-worker`, aligned to SOC. |
| G2 | **PYTHON 3.12 INITIAL; 3.11 FALLBACK** if the target CUDA/driver wheel-coverage spike finds a blocking gap. Python 3.13/3.14/free-threaded remain deferred. |
| G3 | **YES** — thin CYBRIK-owned OpenAI-compatible seam over Ollama/vLLM/llama.cpp; constrained output and streaming; no model authority. |
| G4 | **YES** — one PostgreSQL + pgvector `>=0.8.2`; split/AGE/OpenSearch only on measured limits. |
| G5 | **YES** — CYBRIK deterministic state machine owns budgets/evidence/receipts; SDKs are replaceable libraries; durability belongs to ADR-0003. |
| G6 | **YES** — Inspect AI, Ragas, self-hosted observability, SBOM/AI-BOM, and Cosign are candidates to prototype, not adopted dependencies. |
| G7 | **YES** — carry the evidence packet's measured unknowns as explicit deferrals. |

### ADR-0004 (F1–F9)

| # | Founder answer |
|---|---|
| F1 | **YES** — reject a single-process shipped target; permit only a T0 dev loop with untrusted classes disabled. |
| F2 | **YES** — separate control plane and executor tier over authenticated mTLS, ready for disposable executors. |
| F3 | **YES** — disposable per invocation for R1/R2/R3 and S1/S2/S3; pooled S0 for R0 only when policy permits. |
| F4 | **YES** — SPIFFE-style mTLS workload identity; issuer implementation deferred to a measured spike. |
| F5 | **YES** — credential and egress brokers stay control-side; executors receive only single-use scoped short-lived credentials. |
| F6 | **YES** — the control plane signs receipts; executors attest; signing key never resides on an executor. |
| F7 | **YES** — idempotency, bounded execution, kill switches, and default-deny/fail-closed behavior are mandatory. |
| F8 | **YES** — defer issuer, transport, receipt envelope, executor attestation, and sandbox substrate to measured decisions. |
| F9 | **YES** — keep the SOC external-approval ingress gap as an open contract-first dependency. |

All Founder answers follow the packet recommendations without deviation. The earlier overnight
technical delegation was insufficient by itself for a status flip; the Founder's explicit
2026-07-24 authorization quoted in the status-flip commit closes that D5 requirement. This
approval accepts architectural decisions only: it does not accept a cross-product contract,
approve a dependency install, claim implementation, or open GATE A4.

## 1. ADR-0002 — Cyber AI implementation stack

**Recommended posture** (full reasoning in the [evidence packet](evidence/ADR-0002-EVIDENCE.md)):
Python + FastAPI + Pydantic v2 + SQLAlchemy 2.0 async (`ai-api` + `ai-worker`) aligned to the
verified SOC stack; **Python 3.12 baseline with 3.11 (the exact SOC floor) as the acceptable
fallback** — the live gate is **3.11 vs 3.12 only** (ML-wheel-driven, not longevity), while
3.13/3.14/free-threaded are **deferred** behind a GPU-wheel-coverage spike and are **not**
offered as the live gate; a **thin in-house
OpenAI-compatible model adapter** seeded from SOC `LLMClient`/`OpenAICompatClient`/SSRF-guard
code over Ollama/vLLM/llama.cpp with constrained structured output and streaming added; **single
PostgreSQL + pgvector `>=0.8.2`** (relational+vector+FTS+graph-as-tables) split only on measured
limits; a **thin in-house deterministic agent state machine** owning budgets/evidence/receipts
with any SDK (Pydantic AI) confined to a swappable library; Inspect AI + Ragas + self-hosted
observability + SBOM/AI-BOM + Cosign as **candidates to prototype**, not adopt.

**Key honesty note (the flagged contradiction).** The recommendation does **not** adopt Python
3.13/3.14 for longevity: as of 2026-07-24 the broadest GPU/ML binary-wheel coverage
(PyTorch + vLLM + CUDA + tokenizers) sits at **3.12**; free-threaded 3.13t was dropped upstream
(manylinux, 2026-05-07) and 3.14t is still stabilizing. The recommended baseline is **3.12 with
3.11 (the exact SOC floor) as the acceptable fallback** if a wheel-coverage spike finds any gap on
the target CUDA/driver; the live gate is **3.11 vs 3.12 only**, and no version above 3.12 —
3.13/3.14/free-threaded — is committed or offered here: those are deferred pending that spike
(evidence §2.1.1, §3.1, §8).

**Rejected / deferred alternatives:**

- Framework-as-core agent SDK (SDK owns state/policy/loop) — rejected: authority leaves the
  CYBRIK domain model (`03 §14`); SDK stays a swappable library only.
- Polyglot storage now (PG + OpenSearch + graph DB) — rejected as premature: three engines for
  one founder; single-PG split is a *measured* upgrade (`03 §6.3`).
- Python 3.13 / 3.14 / free-threaded as the initial baseline — deferred, not offered as the live
  gate: highest GPU-wheel-gap risk, the exact failure the ADR warns against; revisited only after
  the §8.1 wheel-coverage spike.

**Consequences if you follow the recommendation:** two schema layers to govern under ADR-0001; a
recurring model/runtime **license re-verification** chore (`02 §10`); a commitment to close the
**streaming + llama.cpp** gaps in the reused SOC adapter; storage and Python-version choices
reversible but with migration cost if the measured unknowns break them.

**Questions (recommended answers carried from evidence §5):**

| # | Question | Form | Recommended |
|---|---|---|---|
| G1 | Language/framework = Python + FastAPI + Pydantic v2 + SQLAlchemy 2.0 async, `ai-api` + `ai-worker`, aligned to SOC? | yes/no | **yes** |
| G2 | Python compatibility baseline for the live gate? (ML-wheel-driven, not longevity; 3.13/3.14 deferred pending the §8.1 spike, not offered here) | **3.11** / **3.12** | **3.12** initial, **3.11** fallback on any §8.1 gap (reversible) |
| G3 | Model adapter = thin in-house OpenAI-compatible seam seeded from SOC, over Ollama/vLLM/llama.cpp, constrained output on, streaming added? | yes/no | **yes** |
| G4 | Storage = single PostgreSQL + pgvector `>=0.8.2`; split/AGE/OpenSearch only on measured limits? | yes/no | **yes** (reversible) |
| G5 | Agent framework = in-house deterministic state machine owns budgets/evidence/receipts; SDK only a swappable library; durability → ADR-0003? | yes/no | **yes** |
| G6 | Eval + supply chain = Inspect AI + Ragas + self-hosted observability + SBOM/AI-BOM + Cosign as *candidates to prototype* (not adopt)? | yes/no | **yes** |
| G7 | Endorse the carried measured unknowns (evidence §8) as deferrals rather than deciding them now? | yes/no | **yes** |

## 2. ADR-0004 — Tool Fabric control-plane / executor split

**Recommended posture** (full reasoning in the [evidence packet](evidence/ADR-0004-EVIDENCE.md)):
a **risk-tiered** split. The single-process **Option A is rejected** as the shipped security
model (permitted only as a T0 dev-loop with untrusted classes disabled). **Option B is the
always-on baseline boundary** — a trust-critical control plane (registry, policy, approval broker,
credential broker, egress broker, receipt ledger, kill switch) and a separate executor tier over
an authenticated mTLS channel, ready for per-invocation disposable executors.
**Disposable per-invocation isolation (Option C) is mandatory** for every hostile/untrusted-input
class (R1/R2/R3, sandbox profiles S1/S2/S3); **R0 read-metadata may use pooled long-lived S0
workers only when policy permits**. Identity is **SPIFFE-style mTLS** (accepted E2, issuer
implementation deferred); **credential + egress brokers stay control-side** (executors never hold
long-lived credentials or an open egress path); the **control plane signs receipts, executors
attest** (accepted E5). **Idempotency, bounded execution, and default-deny/fail-closed** (kill
switch, missing policy/approval/receipt store → deny) are mandatory properties of the split.
Measured implementation choices are **deferred**: issuer (SPIRE vs. minimal internal CA), executor
transport, receipt signing-envelope (COSE/JWS/in-toto-style), executor attestation mechanism, and
sandbox substrate (→ ADR-0005).

**Recorded gap — SOC external-approval ingress.** There is **no accepted contract** for how a
Fabric-originated approval-required reaches a human approver's inbox, nor how a SOC-authenticated,
digest-bound approval returns to Fabric — including approvals arriving from **outside** the live
SOC session (external/on-call approver). This sits on the `Alert → … → Approval → Receipt → Case`
slice and is a cross-product contract owed under ADR-0001; it is **recorded and surfaced here,
not closed by ADR-0004** (evidence §2.7, §8).

**Rejected / deferred alternatives:**

- Option A (single service, internal module boundary) — rejected as the security model: a tool
  compromise shares the process with credentials, policy, and the receipt signer, and untrusted
  input would run in-process (violates `03 §7.3` and contradicts accepted E5). Acceptable only as
  a T0 dev-loop shape with untrusted classes disabled.
- Pure Option C for *all* classes — rejected as wasteful: per-invocation latency on R0 metadata
  reads buys no isolation (no untrusted input runs there).
- Signing receipts at the executor / a non-SPIFFE identity model — off the table by accepted
  ADR-0006 E5/E2, not reopened.

**Consequences if you follow the recommendation:** a two-tier system to operate (control plane +
executors) with a sandbox substrate to run T0→T2; per-invocation latency on untrusted classes as
the price of containment; a standing obligation to keep the signing key and credentials off
executors by construction; and an **open** approval-ingress contract that must be closed before
the vertical slice runs end-to-end.

**Questions (recommended answers carried from evidence §12.1 — F1–F9 preserved, not collapsed):**

| # | Question | Form | Recommended |
|---|---|---|---|
| F1 | Reject a **single-process shipped target** (Option A) as the security model — permitting it only as a T0 dev-loop with untrusted classes disabled? | yes/no | **yes** |
| F2 | Boundary = Option **B** baseline: separate control-plane service + executor tier over an authenticated mTLS channel, **ready for per-invocation disposable executors**? | yes/no | **yes** |
| F3 | Executor lifecycle = **risk-tiered**: disposable per-invocation isolation (C) **mandatory** for untrusted-input classes (R1/R2/R3, S1/S2/S3); pooled long-lived **S0** workers for **R0** read-metadata **only when policy permits**? | yes/no | **yes** (reversible) |
| F4 | Identity = **SPIFFE-style mTLS** workload identity per accepted ADR-0006 E2, issuer implementation (SPIRE vs. minimal internal CA) **deferred to a measured spike**? | yes/no | **yes** (E2 fixed; issuer deferred) |
| F5 | Credential + egress **brokers stay control-side**; executors get only **single-use, scoped, short-lived** credentials + broker-mediated egress, never the raw delegation token, never a credential at rest? | yes/no | **yes** |
| F6 | Receipts **signed by the control plane**, executors **attest** (fixed by accepted ADR-0006 E5); signing key never on an executor? | yes/no | **yes** (fixed) |
| F7 | **Idempotency, bounded execution, and default-deny/fail-closed** (kill switch, missing policy/approval/receipt store → deny) are mandatory properties of the split? | yes/no | **yes** |
| F8 | **Defer** the measured/among-equivalents choices — issuer (SPIRE vs. internal CA), executor transport (queue vs. RPC), receipt signing-envelope (COSE/JWS/in-toto-style), executor attestation mechanism, and sandbox substrate (→ ADR-0005)? | yes/no | **yes** |
| F9 | Record the **confirmed SOC gap** (evidence §2.7: in-memory/per-process approval state; no external Fabric ingress; no receipts in SOC code) as an open cross-product dependency owed a durable, digest-bound approval-ingress contract under ADR-0001, **not** closed by this ADR? | yes/no | **yes** |

## 3. Reversible now vs. deferred-measured (explicit, both ADRs)

- **Reversible-with-cost (decide now, migrate later if measurement demands):** G2 Python baseline
  (3.12 initial, 3.11 fallback; 3.13/3.14 deferred), G4 storage topology (single PG → split),
  F3 executor lifecycle tiering (R0/S0 pooled cut can tighten to per-invocation).
- **Directional, low reversal cost (the *seam/boundary* is the hedge):** G1, G3, G5, G6; F2
  boundary, F5 control-side brokers.
- **Fixed by accepted Wave 0 ADRs (not reopened):** F4 identity model + F6 receipt-signing side
  (ADR-0006 E2/E5); anything shipped is versioned under ADR-0001.
- **Deferred-measured — do NOT decide now (spikes/benchmarks first):**
  - ADR-0002: GPU-wheel coverage for 3.13/3.14 on target CUDA; embedding/reranker benchmarks;
    graph-as-tables vs. AGE/OpenSearch scaling; Inspect/Ragas fit to `08` gates; model-weight and
    tool licenses; durability substrate (DBOS vs. in-house outbox → ADR-0003).
  - ADR-0004: issuer implementation (SPIRE vs. internal CA); executor transport; receipt
    signing-envelope; executor attestation mechanism; sandbox substrate (→ ADR-0005); resolution
    of the SOC external-approval ingress gap.

## 4. Proposed acceptance texts — `SUPERSEDED`

> **SUPERSEDED 2026-07-24.** These draft wordings were provenance input. The Founder accepted
> all recommended G1–G7/F1–F9 answers without deviation and explicitly authorized the status
> flip. The authoritative accepted text is the Decision section of ADR-0002 and ADR-0004.
> Original drafts remain below unmodified as decision provenance.

### 4.1 ADR-0002 (draft wording, assumes G1–G7 = recommended)

> Decision: `cybrik-cyber-ai-platform` is implemented in **Python** (FastAPI + Pydantic v2 +
> SQLAlchemy 2.0 async) as `ai-api` + `ai-worker`, aligned to the SOC stack. The compatibility
> **baseline is Python 3.12** with **3.11 (the exact SOC floor) as the acceptable fallback**,
> chosen for GPU/ML binary-wheel coverage, not longevity; the live gate is **3.11 vs 3.12 only**,
> and 3.13/3.14/free-threaded are deferred pending a GPU-wheel-coverage spike on the target
> CUDA/driver — not adopted here. The model runtime is a **thin in-house OpenAI-compatible adapter** seeded from the
> SOC `LLMClient`/`OpenAICompatClient`/SSRF-guard code, one seam over Ollama (dev), vLLM (GPU
> prod), and llama.cpp (CPU/air-gap), with constrained structured output and streaming; the model
> holds no credential, DB, or shell authority. Storage is a **single PostgreSQL + pgvector
> `>=0.8.2`** (relational + vector + FTS + Investigation-Graph-as-tables) with per-product schema
> isolation and RLS; a split to OpenSearch/Apache AGE/dedicated graph is a measured upgrade only.
> Agent orchestration is a **thin in-house deterministic domain state machine** that owns
> budgets, evidence, receipts, and transitions; any agent SDK (e.g. Pydantic AI) is a swappable
> library, never the core; the durability substrate is decided under ADR-0003. Inspect AI, Ragas,
> self-hosted observability, and SBOM/AI-BOM (SPDX 3.0 + AI profile / CycloneDX) + Cosign are
> candidates to prototype under spike, gated by the `08` evaluation metrics, not adopted by this
> decision. Anything shipped is versioned under ADR-0001 and serializes the ADR-0006 model.
> `NOT IMPLEMENTED`: no code, store, model, adapter, pipeline, or eval harness is built or piloted.

### 4.2 ADR-0004 (draft wording, assumes F1–F9 = recommended)

> Decision: `cybrik-security-tool-fabric` separates a **trust-critical control plane** (capability
> registry, policy decision point, approval broker, credential broker, egress broker, receipt
> ledger, kill switch) from a **separate executor tier** in a distinct trust zone, communicating
> over an authenticated **mTLS** channel (Option B as the always-on baseline, ready for
> per-invocation disposable executors; the single-process Option A is **rejected** as the shipped
> model, permitted only as a T0 dev-loop with untrusted classes disabled). Executor lifecycle
> is **risk-tiered**: **disposable per-invocation isolation is mandatory** for every
> hostile/untrusted-input class (R1/R2/R3; sandbox profiles S1/S2/S3), a fresh environment per run
> destroyed after, with no host mounts and no cross-invocation residue; **R0 read-metadata may use
> pooled long-lived S0 API workers**. Policy may only raise isolation, never lower it. Executors
> carry **SPIFFE-style workload identity** (ADR-0006 E2) in a per-deployment trust domain. The
> **credential and egress brokers remain control-side**: executors receive only short-lived,
> audience-scoped credentials (never the raw delegation token, never returned to the model, never
> persisted) and egress only through the broker's allowlist/proxy. The **control plane signs
> receipts and executors attest evidence** to it (ADR-0006 E5); the signing key is never on an
> executor. Side-effecting classes **fail closed** when policy/approval/receipt storage is
> unavailable; every invocation is **idempotent and bounded** (time/CPU/RAM/output/egress budget),
> and the global/tenant/tool/action kill switches fail closed. The issuer implementation (SPIRE
> vs. minimal internal CA), executor transport,
> receipt signing-envelope, executor attestation mechanism, and sandbox substrate (ADR-0005) are
> deferred to measured spikes. The **SOC external-approval ingress** path is an **open
> cross-product dependency** owed a contract under ADR-0001 and is not resolved by this decision.
> Anything shipped is versioned under ADR-0001. `NOT IMPLEMENTED`: no control plane, executor,
> broker, sandbox, issuer, or receipt signer is built or piloted.

## 5. GATE A3 — CLOSED 2026-07-24

The Founder approved all recommended G1–G7 and F1–F9 answers and explicitly authorized:

> "PHÊ DUYỆT GATE A3 THEO TOÀN BỘ KHUYẾN NGHỊ G1–G7 VÀ F1–F9. CHO PHÉP CẬP NHẬT
> ADR-0002 VÀ ADR-0004 THÀNH ACCEPTED VÀ COMMIT STATUS-FLIP."

ADR-0002 and ADR-0004 are `ACCEPTED`. This gate closure authorizes the architectural status
flip only. Cross-product contracts still follow ADR-0001 acceptance mechanics, GATE A4 remains
not open until its Wave 2 decision packet is prepared, and RB-001 remains untouched and
`BLOCKING — OPEN`.
