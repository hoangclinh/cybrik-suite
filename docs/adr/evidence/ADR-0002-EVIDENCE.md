# ADR-0002 Evidence Packet — Cyber AI implementation stack

- Status: `DRAFT` — recommendation only. Backs a `PROPOSED — NOT DECIDED` ADR; this packet
  informs a decision, it does not make one. Nothing here is implemented, verified, or piloted.
- Date: 2026-07-24
- Backs: [ADR-0002](../ADR-0002-cyber-ai-implementation-stack.md)
- Scope: `cybrik-cyber-ai-platform` — implementation language + service framework, storage
  (relational/vector/graph), local+remote model runtime abstraction, RAG/CTI pipeline stack,
  agent framework posture, evaluation + supply-chain tooling. Contract versioning of anything
  named here inherits [ADR-0001](../ADR-0001-suite-contract-versioning-policy.md); the event/
  identity model it must serialize is [ADR-0006](../ADR-0006-cross-product-event-and-identity-model.md).
- Prepared by: orchestrator, under Founder delegation of overnight technical decisions
  (Wave 1). **Produces a recommendation for the orchestrator decision; it does not accept the
  ADR.** ADR acceptance remains a Founder gate.

## 0. Source-labelling key

Per [evidence/README.md](README.md) and sprint §6: `FACT` (verified against the primary
source cited), `RESEARCH` (summarized from a primary/official source via its published
page/repo, not independently reproduced/built here), `PROPOSAL` (our position, ours to
defend), `INFERENCE` (reasoning from labelled facts), `UNKNOWN` (open question; material ones
appear in the Founder/orchestrator decision list). All external URLs accessed **2026-07-24**.
Internal cross-repo references use `repo:path` form and are code state as read on 2026-07-24,
not a claim of implemented suite capability.

## 1. Decision criteria

Stated before scoring. Drawn from `../../strategy/03-REFERENCE-ARCHITECTURE.md` §1/§6/§11,
`../../strategy/07-SOLO-FOUNDER-AI-OPERATING-MODEL.md` §5/§11, and
`../../strategy/08-EVALUATION-SECURITY-COMPLIANCE.md` §2/§4.

| # | Criterion | Why it matters |
|---|---|---|
| A-C1 | ML/runtime compatibility | The stack must run the actual inference/embedding runtimes (binary wheels, GPU, tokenizers). A language/version chosen for longevity that lacks GPU ML wheels is a non-starter (explicit driver: choose a Python baseline with real runtime compatibility, not longevity). |
| A-C2 | Sovereign / air-gap fit | Local/on-prem/air-gapped is a first-class deployment mode (`03 §1`); no phone-home, offline install/verify, permissive licenses that survive an offline private registry (`03 §10` T2). |
| A-C3 | Solo-founder operability + SOC-stack alignment | One person operates all three products; reusing SOC's Python/FastAPI/SQLAlchemy knowledge and its LLM-adapter code lowers burden (`07 §5`, "0 new framework nếu chưa có ADR và removal/exit strategy"). |
| A-C4 | No model authority / security posture | Model has no credential, DB access, or shell (`03 §1`); retrieval is policy/tenant/classification-filtered before ranking (`03 §6.1`); retrieved content is untrusted to the prompt (`04 §10`). |
| A-C5 | Evaluation + observability fit | Trajectories must be inspectable for the seven eval layers (`08 §2`); model-as-judge is only a signal, material security claims need deterministic/human validation (`07 §11`). |
| A-C6 | Multi-tenancy / RBAC-RLS / marking propagation | Per-product DB isolation, tenant + marking on every store; no cross-product DB join (`03 §3.2`). |
| A-C7 | License + supply-chain compatibility | Permissive licenses only for anything shipped into an air-gapped customer; SBOM/AI-BOM + signed provenance obligations (`02 §7`, CRA driver). |

## 2. External research

### 2.1 Language + service framework baseline

- RESEARCH — The strategy technology baseline already names the stack: "Python + FastAPI +
  Pydantic cho API/worker hai sản phẩm mới" and two Cyber AI processes "`ai-api` + `ai-worker`;
  model runtime (Ollama/vLLM) là engine độc lập" (internal: `../../strategy/03-REFERENCE-ARCHITECTURE.md`
  §11, §3.2 — a PROPOSAL, not a decision).
- FACT (code state) — The SOC product already runs Python `>=3.11`, **FastAPI** `>=0.115` on
  uvicorn, **SQLAlchemy 2.0 async** (`sqlalchemy[asyncio]>=2.0.30`) + **asyncpg**, Alembic
  migrations, httpx async client, Postgres with RLS `FORCE`; modular monolith. Source:
  `cybrik-soc-command-center:services/api/pyproject.toml` and module layout, read 2026-07-24.
  This is the concrete "SOC stack" ADR-0002 is asked to align with (A-C3).
- FACT — FastAPI is built on Starlette + Pydantic and targets modern typed Python.
  <https://fastapi.tiangolo.com/>
- FACT — Pydantic v2's validation core is compiled (`pydantic-core`, Rust); it is the
  validation layer FastAPI and Pydantic AI build on. <https://docs.pydantic.dev/latest/>
- FACT — SQLAlchemy 2.0 provides first-class `asyncio` support via `create_async_engine`.
  <https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html>

#### 2.1.1 Python version × ML-runtime compatibility (the flagged contradiction)

- RESEARCH — Python **3.14** was released **2025-10-07** (PEP 745 schedule); it makes the
  free-threaded build (PEP 779, no-GIL) officially supported and defers annotation evaluation.
  <https://peps.python.org/pep-0745/>, <https://docs.python.org/3/whatsnew/3.14.html>
- RESEARCH — Support windows (source: <https://devguide.python.org/versions/>): **3.13**
  released 2024-10, security support ~to 2029-10; **3.12** ~to 2028-10; each line gets ~2 years
  of bugfix then ~3 years security-only.
- RESEARCH — **PyTorch** added `torch.compile` support for CPython **3.13** (Beta) in the
  **2.6** release (early 2025); free-threaded (3.13t) and **3.14** support landed later and
  staged (tracked in PyTorch issue #130249). Upstream `pypa/manylinux` removed CPython
  **3.13t** (free-threaded) on **2026-05-07** as experimental, superseded by non-experimental
  3.14t; PyTorch dropped `cp313t` wheels from its binary-build matrix accordingly (PyTorch
  issue #182949, taking effect with the PyTorch 2.13 line).
  <https://pytorch.org/blog/pytorch2-6/>,
  <https://github.com/pytorch/pytorch/issues/130249>,
  <https://github.com/pytorch/pytorch/issues/182949>
- INFERENCE — The GPU inference/embedding stack (PyTorch, and vLLM which builds on it) is the
  binding constraint on Python version, **not** language longevity. As of 2026-07-24 the
  broadest, least-surprising binary-wheel coverage across PyTorch + vLLM + CUDA + tokenizers +
  sentence-transformers sits at **Python 3.12**, with **3.13 / 3.14 / free-threaded** still
  stabilizing in the ML wheel ecosystem and therefore deferred as a baseline, not offered as the
  live gate (§3.1, §5 G2). Choosing 3.14 purely
  because it is newest / longest-supported would risk missing GPU wheels — the exact failure
  the ADR warns against.
- INFERENCE — Because the model runtime (Ollama/vLLM) is a **separate engine process**
  (`03 §3.2`), the inference server's own interpreter is decoupled from `ai-api`/`ai-worker`.
  But `ai-worker` still imports ML libraries directly for local embedding/reranking/tokenization,
  so its interpreter version is constrained by the same wheels. The version decision therefore
  applies to `ai-api`/`ai-worker`, and 3.12 also sits at/above the SOC floor (3.11), preserving
  A-C3 alignment.
- UNKNOWN — Exact current PyTorch/vLLM release numbers and whether **3.13/3.14 GPU wheels are
  GA** for the specific CUDA/driver the target hardware will run was not built/measured here.
  This is a carried measured unknown (§8), to be pinned by a wheel-coverage spike before any
  version above 3.12 is committed.

### 2.2 Model runtime abstraction (local + remote behind one seam)

- RESEARCH — Strategy already fixes the runtime split: "Ollama dev, vLLM production, API
  OpenAI-compatible" and a Model Router with "OpenAI-compatible adapter; timeout/circuit
  breaker" (`03 §11`, `03 §6.1`); default model profile is **Qwen** with a "deterministic test
  stub" (`04 §5.1`); watchlist re-verifies "Qwen/vLLM/Ollama licenses" quarterly (`02 §10`).
- FACT (code state) — The SOC already contains the adapter seed ADR-0002 proposes to reuse, in
  `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/copilot/llm.py`:
  - `LLMClient` (Protocol) — the single swappable interface upper layers depend on.
  - `OpenAICompatClient` — OpenAI-compatible HTTP client (Ollama dev / vLLM prod) using httpx
    with `follow_redirects=False`, `verify=True`, bounded `httpx.Timeout`, response-byte cap,
    redirect-status rejection; API key resolved from a `secret_ref` and placed only in the
    `Authorization` header, never in messages.
  - `StubLLMClient` — deterministic no-network stub for tests/CI (incl. injection tests).
  - **SSRF guard** `validate_llm_base_url()` + `_all_ips_internal()` — deny-by-default host
    allowlist and a requirement that every resolved IP be internal (loopback/private/link-local),
    i.e. an *inverse* SSRF guard enforcing data-sovereignty of the model endpoint; it reuses the
    tenant-facing outbound guard in `.../platform/outbound.py`.
  - `build_llm_client(settings)` factory selecting impl by `settings.llm_provider`.
- FACT (code state) — The SOC adapter is **non-streaming**: `chat()` performs a single
  non-streaming POST and parses the full JSON body; there is no SSE/stream path.
  (`.../copilot/llm.py`, read 2026-07-24.)
- INFERENCE — This adapter is a strong seed for the Cyber AI model seam (A-C3, A-C4: the SSRF
  guard already enforces "no model authority" at the network layer). Two gaps must be closed
  for the AI platform: (a) **streaming** (agent trajectories and long generations need
  token/SSE streaming), and (b) a **third backend behind the same seam** — llama.cpp for
  CPU-only / strict air-gap in addition to Ollama (dev/T0) and vLLM (GPU prod/T1).
- RESEARCH — Runtime licenses (permissive, air-gap-safe): **vLLM Apache-2.0**
  <https://github.com/vllm-project/vllm>; **Ollama MIT** <https://github.com/ollama/ollama>;
  **llama.cpp MIT** <https://github.com/ggml-org/llama.cpp>. All permit offline redistribution
  in a private registry (A-C2, A-C7).
- RESEARCH — **Constrained/structured output** is available across the seam: vLLM guided
  decoding (`guided_json`) with **XGrammar** (default) or **Outlines** backends; **Outlines**
  provides JSON-Schema/regex/CFG constraints for HF models; llama.cpp exposes GBNF grammars.
  <https://docs.vllm.ai/>, <https://github.com/dottxt-ai/outlines>,
  <https://github.com/mlc-ai/xgrammar>. This supports typed tool/plan output without trusting
  free-form model text (A-C4).
- UNKNOWN — Qwen (and any embedding/reranker) **model-weight licenses** and model cards must be
  audited per deployment tier; not audited weight-by-weight here (`02 §10` watchlist).

### 2.3 Storage: relational + vector + graph

- RESEARCH — Strategy fixes the initial engine: "PostgreSQL cho metadata/policy/audit/eval;
  pgvector giai đoạn đầu"; RAG "Ban đầu dùng PostgreSQL + pgvector … Chỉ chuyển vector/graph
  workload sang OpenSearch hoặc graph engine riêng khi đo được giới hạn" (`03 §11`, `03 §6.3`).
  Per-product DB isolation, "tuyệt đối không join cross-product database" (`03 §3.2`).
- FACT — **pgvector** latest is **0.8.5**; **iterative index scans** were added in **0.8.0**;
  half-precision `halfvec` in **0.7.0**; supports HNSW + IVFFlat; PostgreSQL **13+**. Verified
  against the project repository. <https://github.com/pgvector/pgvector>
- INFERENCE — pgvector `>=0.8.0` iterative scans materially help filtered/policy-aware vector
  search (the tenant/classification pre-filter of `03 §6.1`) by continuing the index scan until
  enough post-filter results are found, reducing the "over-fetch then filter" penalty. Pinning
  `>=0.8.2` (a maintenance point on the 0.8 line) is a conservative floor that guarantees
  iterative scans + HNSW while leaving 0.8.5 as the current target.
- RESEARCH — **Apache AGE** (Apache-2.0) provides openCypher graph queries as a PostgreSQL
  extension, i.e. a same-engine path to a property graph if graph-as-tables is outgrown.
  <https://age.apache.org/>
- INFERENCE — A single PostgreSQL instance can carry relational + vector (pgvector) + full-text
  (native FTS) + Investigation-Graph-as-tables at T0/T1 for one founder (A-C3, A-C6: RLS + per-
  product schema isolation reuse SOC's proven RLS-`FORCE` pattern). Splitting to OpenSearch or a
  dedicated/AGE graph engine is a *measured* upgrade (`03 §6.3`), not an upfront commitment.
- FACT — **OCSF** current stable schema is **v1.8.0** (Linux Foundation project) — used only
  for telemetry-shaped payloads per accepted ADR-0006, not as the store model.
  <https://schema.ocsf.io/>, <https://ocsf.io/> (re-verification of marking-attribute coverage
  remains UNKNOWN, carried from the ADR-0006 packet §2.2).

### 2.4 RAG / CTI pipeline

- RESEARCH — Strategy fixes the RAG/CTI shape: hybrid lexical/vector/graph retrieval with
  "policy/tenant/classification filter trước ranking" and a CTI pipeline of "STIX/TAXII ingest,
  dedup, confidence/marking/expiry, signed offline bundles" (`03 §6.1`); full intake→quarantine→
  signature/hash/license check→normalize→policy→chunk→lexical+vector+graph index→eval canary→
  publish (`03 §6.3`). Retrieved content is "untrusted data đối với prompt" (`04 §10`).
- FACT — **STIX 2.1** and **TAXII 2.1** are **OASIS Standards** (published 2021-06-23); air-gap
  uses signed export bundles over the same object model. <https://www.oasis-open.org/2021/06/23/stix-v2-1-and-taxii-v2-1-oasis-standards-are-published/>
- RESEARCH — **MITRE ATT&CK** must be version-pinned: **Data Source** objects were
  **deprecated in ATT&CK v18 (Oct 2025)** — superseded by the new **Detection Strategy /
  Analytics + Log Sources** framework (ATT&CK Specification 3.3.0; legacy Data Sources retained
  for backward compatibility, slated for removal in Spec 4.0.0). The current release is **v19.1
  (2026-04-28)**. The schema must therefore store an ATT&CK **version** rather than hard-code the
  old Data Source model (`02 §3.1`). <https://attack.mitre.org/resources/versions/>,
  <https://attack.mitre.org/resources/updates/updates-october-2025/>
- INFERENCE — Hybrid PostgreSQL FTS + pgvector satisfies the "hybrid lexical/vector" half in one
  engine; a reranker + graph-as-tables covers the rest at T0/T1. Embedding + reranker model
  choice is deferred to benchmark (§8).
- UNKNOWN — Concrete local, permissively-licensed **embedding + reranker** candidates
  (e.g. sentence-transformers / BGE-family) were not benchmarked or license-audited here
  (Recall@K, nDCG@K per `08 §4.3`); carried measured unknown.

### 2.5 Agent framework posture

- RESEARCH — The single most load-bearing constraint: "Không chọn agent framework làm lõi
  contract. Có thể dùng library trong implementation nhưng state, policy, evidence và receipt
  phải là domain model của CYBRIK" (`03 §14`). Orchestration is a CYBRIK-owned durable state
  machine: "LLM đề xuất plan; deterministic controller validate plan và chọn allowed transition",
  no "unbounded think/reflect until done", each node typed I/O + timeout + retry + max fan-out,
  budgets over time/tokens/bytes/tool-calls/egress/money (`03 §6.1`, `03 §6.2`).
- RESEARCH — **Pydantic AI** is MIT-licensed, typed-Python, and integrates durable-execution
  backends (Temporal / **DBOS** / Prefect) — i.e. it can be a *library* under a CYBRIK state
  machine without owning state. <https://ai.pydantic.dev/>,
  <https://github.com/pydantic/pydantic-ai>
- RESEARCH — **DBOS** is a lightweight durable-execution library that checkpoints workflow state
  in Postgres and resumes from the last completed step after failure.
  <https://docs.dbos.dev/>. Durability substrate choice (DBOS vs an in-house transactional
  outbox) belongs to **ADR-0003**, not this ADR.
- INFERENCE — The compliant posture is a **thin in-house deterministic domain state machine**
  that owns budgets/evidence/receipts/transitions, with any SDK (Pydantic AI or none) confined
  to a swappable library seam. This keeps agent trajectories inspectable for `08 §2` (A-C5) and
  keeps authority in CYBRIK domain code (A-C4).

### 2.6 Evaluation + supply chain

- RESEARCH — Eval must span seven layers (component→task→trajectory→e2e→online shadow→ops→
  security) with GA gates like "citation validity 100%, unsupported material claim rate ≤1%,
  zero fabricated source/object ID" and bilingual (English/Vietnamese) eval sets (`08 §2`,
  `08 §4.1`, `04 §5.2`); "Model-as-judge chỉ là signal; material security claims cần
  deterministic/human validation" (`07 §11`).
- RESEARCH — **Inspect AI** (UK AI Security Institute / `UKGovernmentBEIS`) is **MIT**-licensed,
  full-code Python, with dataset→Task→Solver→Scorer primitives, multi-turn/agent tool workflows,
  built-in sandboxed execution, and a log viewer — a self-hostable harness fitting the trajectory/
  security eval layers. <https://github.com/UKGovernmentBEIS/inspect_ai>,
  <https://inspect.aisi.org.uk/>
- RESEARCH — **Ragas** targets RAG-pipeline metrics + synthetic test-set generation (complements,
  not replaces, Inspect). <https://github.com/explodinggradients/ragas>
- RESEARCH — Supply chain (`02 §7`): **SPDX 3.0 + AI profile** and **CycloneDX** for SBOM/AI-BOM,
  **SLSA** signed provenance, **Sigstore Cosign** with self-managed keys and offline
  verification. <https://spdx.dev/>, <https://cyclonedx.org/>, <https://slsa.dev/>,
  <https://docs.sigstore.dev/>
- INFERENCE — Inspect AI + Ragas + self-hosted observability + Cosign-signed SBOM/AI-BOM are
  candidate tools to *prototype under a spike*, not adopt now; their fit to the GA gates and their
  lock-in/licenses are measured unknowns (§8).

### 2.7 AI-risk standards crosswalk (posture, not a tool choice)

- RESEARCH — Security/eval must crosswalk NIST AI RMF, NIST GenAI Profile (AI 600-1),
  NIST AI 100-2e2025, MITRE ATLAS, OWASP GenAI/Agentic — "Không dùng một checklist duy nhất như
  bằng chứng 'AI secure'" (`02 §5`). This constrains the eval harness to be multi-framework, not
  a single checklist.

## 3. Option analysis

Language is effectively fixed by A-C3 (Python, aligned to SOC) and A-C1; the live choices are
the Python **version baseline**, the **storage topology**, the **model-runtime adapter**, and the
**agent-framework posture**. Each is scored against §1.

### 3.1 Python version baseline

The live gate is deliberately narrow: **3.11 vs 3.12** — the SOC floor versus one minor above
it. Both sit inside the mature GPU/ML-wheel band today (A-C1), so this is a small, reversible
choice, not a bet on longevity. **3.13 and 3.14/free-threaded are not on the table for the
initial baseline**; they are carried as a *later* upgrade gated on the wheel-coverage spike
(§8.1). Framing the question this way is the point of the ADR's "choose on runtime
compatibility, not longevity slogans" driver: the newest interpreter is explicitly **not** the
default answer.

| Option | A-C1 runtime | A-C2 sovereign | A-C3 SOC-align | A-C7 license | Trade-off |
|---|---|---|---|---|---|
| 3.11 (SOC floor) | Strong — most-settled GPU/ML wheel coverage of the pair | Strong | **Strongest** — identical to the SOC floor, zero interpreter divergence | Strong | Oldest of the live pair; bugfix window closes sooner (~2027-10, then security-only); forgoes 3.12 typing/stdlib and per-interpreter-GIL groundwork |
| **3.12 (recommended)** | Strong — GPU/ML wheel coverage broad and current | Strong | Strong — one minor above the SOC floor, same async stack | Strong | One release newer than SOC today, so a few slow-moving pure-Python libs may trail briefly; SOC could later raise its own floor to match |
| 3.13 / 3.14 / free-threaded (deferred, not chosen) | Not-yet — 3.14 newest, ML wheel ecosystem still stabilizing; upstream dropped experimental `cp313t` (2026-05-07) and PyTorch dropped matching wheels | Strong | Neutral-to-weak (interpreter divergence from SOC) | Strong | Longest support window but highest wheel-gap risk — the exact failure the ADR warns against; revisit only after §8.1 spike |

Recommendation: **3.12 as the initial baseline; 3.11 is the fully acceptable fallback if a
wheel-coverage spike (§8.1) finds any target-CUDA gap at 3.12.** 3.13/3.14/free-threaded are
deferred, not ranked — no evidence here justifies jumping past the 3.11/3.12 band. Either live
choice is reversible-with-cost.

### 3.2 Storage topology

| Option | A-C1 | A-C2 | A-C3 | A-C6 tenancy | Trade-off |
|---|---|---|---|---|---|
| **Single PostgreSQL + pgvector (>=0.8.2), graph-as-tables (recommended)** | Strong | Strong (one engine, offline) | Strong (reuses SOC Postgres+RLS) | Strong (RLS, per-product schema) | Graph/vector scale ceiling unmeasured; must resist premature split |
| PG + pgvector + Apache AGE (same-engine graph) | Strong | Strong | Medium (new extension to operate) | Strong | Adds an extension before graph limits are measured |
| Polyglot now (PG + OpenSearch + graph DB) | Medium | Weak-medium (more services to run offline) | Weak (three engines for one founder) | Medium | Premature operational load; violates `07 §5` minimal-tech |

Recommendation: **single PostgreSQL + pgvector**, upgrade to AGE/OpenSearch/graph engine only on
measured limits (`03 §6.3`). Reversible-with-cost.

### 3.3 Model-runtime adapter

| Option | A-C3 | A-C4 no-authority | A-C2 | Trade-off |
|---|---|---|---|---|
| **Thin in-house OpenAI-compatible adapter seeded from SOC (recommended)** | Strong (reuses `LLMClient`/`OpenAICompatClient`/SSRF guard) | Strong (SSRF/inverse-egress guard already present) | Strong (Ollama/vLLM/llama.cpp all permissive, offline) | Must add streaming + a 3rd (llama.cpp) backend behind the seam |
| Adopt a heavy agent framework's provider layer as the seam | Weak | Medium | Medium | Couples the model seam to a framework (violates `03 §14`) |
| Direct per-backend SDKs, no seam | Weak | Weak | Medium | Re-implements SSRF/policy per backend; drift risk |

Recommendation: **thin in-house adapter**, one seam over Ollama (T0)/vLLM (GPU prod)/llama.cpp
(CPU air-gap), constrained structured output on, streaming added.

### 3.4 Agent-framework posture

| Option | A-C4 authority | A-C5 inspectable | A-C3 | Trade-off |
|---|---|---|---|---|
| **In-house deterministic state machine owns budgets/evidence/receipts; SDK optional library (recommended)** | Strong | Strong | Medium-strong | We own the controller code |
| Framework-as-core (SDK owns state/policy/loop) | Weak (violates `03 §14`) | Medium | Medium | Authority leaves CYBRIK domain model |
| No framework, ad-hoc loops | Medium | Weak | Weak | Reinvents plumbing badly |

Recommendation: **in-house state machine; Pydantic AI (or none) as a swappable library only**;
durability substrate deferred to ADR-0003.

## 4. RECOMMENDATION (not a decision)

For the orchestrator decision (Founder-delegated). None of this accepts ADR-0002; status stays
`PROPOSED`.

1. **Language/framework:** Python + FastAPI + Pydantic v2 + SQLAlchemy 2.0 async, two processes
   `ai-api` + `ai-worker`, aligned to the verified SOC stack (A-C3).
2. **Python baseline:** the live gate is **3.11 vs 3.12** only — recommend **3.12** as the
   initial baseline, with **3.11 (the exact SOC floor) as the acceptable fallback** if the
   wheel-coverage spike (§8.1) finds any gap on the target CUDA/driver. **3.13/3.14/free-threaded
   are deferred, not selected**, and revisited only after that spike. Resolves the
   version-vs-runtime contradiction by making ML-wheel coverage — not longevity — the deciding
   criterion, and by refusing to jump past the mature 3.11/3.12 band on a longevity slogan.
   *(reversible-with-cost)*
3. **Model runtime:** thin in-house OpenAI-compatible adapter **seeded from the SOC
   `LLMClient`/`OpenAICompatClient`/SSRF-guard code**, one seam over Ollama (T0 dev), vLLM (GPU
   prod), llama.cpp (CPU/strict air-gap); constrained structured output (XGrammar/Outlines/GBNF)
   on; **add streaming** and the **llama.cpp backend** (both absent in the SOC seed).
4. **Storage:** single **PostgreSQL + pgvector `>=0.8.2`** as the initial relational+vector+FTS+
   graph-as-tables engine, per-product schema isolation + RLS; split to OpenSearch / Apache AGE /
   dedicated graph only on measured limits. *(reversible-with-cost)*
5. **RAG/CTI:** hybrid PG-FTS + pgvector with policy/tenant/classification pre-filter; STIX 2.1 /
   TAXII 2.1 ingest + signed offline bundles; version-pinned ATT&CK; retrieved content treated as
   untrusted to the prompt. Embedding/reranker candidates deferred to benchmark.
6. **Agent framework:** thin in-house deterministic domain state machine owning
   budgets/evidence/receipts/transitions; any SDK (Pydantic AI) only a swappable library;
   durability (DBOS vs in-house outbox) → ADR-0003.
7. **Eval + supply chain:** prototype **Inspect AI + Ragas + self-hosted observability** and
   **SBOM/AI-BOM (SPDX 3.0 + AI profile / CycloneDX) + Cosign** as *candidates*, gated by `08`
   metrics; model-as-judge is a signal only.

Consequences the decider accepts if following this: two schema layers to govern under ADR-0001;
a recurring model/runtime **license re-verification** chore (`02 §10`); commitment to close the
streaming + llama.cpp gaps in the reused adapter; acceptance that storage and Python-version
choices are reversible but carry migration cost if the measured unknowns break them.

## 5. Founder / orchestrator decisions required

Answer form and recommended answer in the last column. Reversibility noted.

| # | Question | Form | Recommended |
|---|---|---|---|
| G1 | Language/framework = Python + FastAPI + Pydantic v2 + SQLAlchemy 2.0 async, `ai-api` + `ai-worker`, aligned to SOC stack? | yes/no | **yes** |
| G2 | Python compatibility baseline for the live gate? (ML-wheel-driven, not longevity; 3.13/3.14 deferred pending §8.1 spike, not offered here) | **3.11** / **3.12** | **3.12** initial, **3.11** fallback on any §8.1 gap (reversible) |
| G3 | Model adapter = thin in-house OpenAI-compatible seam seeded from SOC `LLMClient`/`OpenAICompatClient`/SSRF guard, over Ollama/vLLM/llama.cpp, constrained output on, streaming added? | yes/no | **yes** |
| G4 | Storage = single PostgreSQL + pgvector `>=0.8.2` (relational+vector+FTS+graph-as-tables); split/AGE/OpenSearch only on measured limits? | yes/no | **yes** (reversible) |
| G5 | Agent framework = in-house deterministic state machine owns budgets/evidence/receipts; SDK (Pydantic AI) only a swappable library; durability → ADR-0003? | yes/no | **yes** |
| G6 | Eval + supply chain = Inspect AI + Ragas + self-hosted observability + SBOM/AI-BOM + Cosign as *candidates to prototype* (not adopt)? | yes/no | **yes** |
| G7 | Endorse the carried measured unknowns (§8) as deferrals rather than deciding them now? | yes/no | **yes** |

## 6. Reversible decisions vs measured deferrals

- **Reversible-with-cost (decide now, can migrate):** G2 Python baseline (3.12→3.13/3.14 later),
  G4 storage topology (single PG→split later). These are chosen now to unblock work; migration
  paths exist but carry cost.
- **Directional, low reversal cost:** G1, G3, G5, G6 (posture/seam choices; the *seam* is the
  hedge — backends and libraries swap behind it).
- **Measured deferrals (do NOT decide now):** everything in §8.

## 7. Illustrative field list (ILLUSTRATIVE — NOT A CONTRACT)

No schema or contract is created by this packet. Any field names elsewhere are narrative only.

## 8. Evidence limitations / carried measured unknowns

1. **Python × GPU ML wheels** — exact current PyTorch/vLLM versions and 3.13/3.14 GPU-wheel GA
   state on the target CUDA/driver not built/measured (UNKNOWN, §2.1.1).
2. **DBOS vs in-house outbox** for durability — belongs to ADR-0003; not decided here.
3. **Runtime hardware** — GPU sizing for vLLM prod and CPU envelope for llama.cpp air-gap not
   measured.
4. **Graph/embedding/eval benchmarks** — graph-as-tables vs AGE vs OpenSearch scaling;
   embedding/reranker Recall@K/nDCG@K; Inspect/Ragas fit to `08` GA gates — none benchmarked.
5. **Framework lock-in & licenses** — Pydantic AI lock-in surface; Qwen/embedding/reranker
   **model-weight** licenses; Inspect/Ragas licenses re-verification before adoption.
6. **External version/license claims** were verified against official project pages/repos/spec
   sites via their published content on 2026-07-24. Directly fetched to primary source here:
   pgvector (0.8.5, repo README/changelog), OCSF (v1.8.0, schema site), the Python 3.14.0 date
   (PEP 745), the PyTorch 2.6 release blog + tracking issues #130249/#182949, the MITRE ATT&CK
   version and October-2025 update pages, and the OASIS STIX/TAXII 2.1 announcement. Component
   **licenses** (vLLM/Ollama/llama.cpp/Inspect/Ragas/Pydantic AI/DBOS) were summarized from each
   project's stated license but not re-opened file-by-file here, and **model-weight** licenses
   (Qwen/embedding/reranker) were not audited weight-by-weight; re-verify each `LICENSE`/release
   note/model card before any spike or contract.
7. **Nothing is implemented.** No language, framework, store, model, adapter, pipeline, or eval
   harness is built, wired, or piloted in `cybrik-cyber-ai-platform`. `NOT IMPLEMENTED`. The SOC
   code cited (adapter, RLS) is existing state in another repo, read read-only, not a claim of
   suite capability.
