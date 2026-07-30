# ADR-0002 — Cyber AI implementation stack

- Status: `ACCEPTED`
- Date raised: 2026-07-23
- Date decided: 2026-07-24
- Decider: Founder
- Acceptance record: Founder approved all recommended answers G1–G7 on 2026-07-24 at
  GATE A3 (Wave 1), recorded in the
  [Wave 1 decision packet](FOUNDER-DECISION-PACKET-WAVE-1.md). Status flip applied by an
  AI agent under explicit Founder authorization, per ADR-0001 D5. No agent inferred approval.
- Scope: `cybrik-cyber-ai-platform` (language, framework, storage, model runtime seam,
  agent-controller ownership, evaluation/supply-chain candidates)
- Evidence: [evidence/ADR-0002-EVIDENCE.md](evidence/ADR-0002-EVIDENCE.md) — retained as
  decision provenance.

## Context

`cybrik-cyber-ai-platform` owns model runtime abstraction, model/prompt registry, RAG/CTI
pipelines, durable agent orchestration, Investigation Graph/Bundle, and AI evaluation.
The implementation stack must remain local/air-gap capable, multi-tenant, auditable, and
operable by one Founder while keeping model/framework code outside the security authority path.

The evidence packet evaluated Python compatibility, runtime adapters, storage topology,
agent-framework ownership, evaluation tooling, supply-chain obligations, and alignment with the
existing SOC stack. This ADR accepts the architectural direction, not an implementation claim.

## Decision

The Founder accepted G1–G7 exactly as recommended on 2026-07-24:

- **G1 — Language and service framework.** Use **Python + FastAPI + Pydantic v2 +
  SQLAlchemy 2.0 async**, structured as `ai-api` + `ai-worker`, aligned with the SOC stack
  where sharing operational knowledge reduces solo-Founder burden.
- **G2 — Python compatibility baseline.** Start with **Python 3.12** and permit
  **Python 3.11 as the fallback** if the target CUDA/driver wheel-coverage spike finds any
  blocking gap. The live compatibility choice is 3.11 versus 3.12 only. Python
  3.13/3.14/free-threaded builds are deferred and are not adopted by this decision.
- **G3 — Model runtime seam.** Build a **thin CYBRIK-owned OpenAI-compatible adapter** seeded
  from the SOC `LLMClient` / `OpenAICompatClient` / SSRF-guard patterns. It presents one seam
  over Ollama (development), vLLM (GPU production), and llama.cpp (CPU/air-gap), with
  constrained structured output and streaming. A model receives no credential, database, or
  shell authority.
- **G4 — Storage.** Begin with **one PostgreSQL + pgvector `>=0.8.2`** for relational,
  vector, full-text, and Investigation-Graph-as-tables workloads, with per-product schema
  isolation and RLS. Split to OpenSearch, Apache AGE, or a dedicated graph engine only when
  measured limits justify it.
- **G5 — Agent-controller ownership.** A **thin CYBRIK-owned deterministic domain state
  machine** owns budgets, evidence, receipts, and allowed transitions. Any agent SDK,
  including Pydantic AI, is a replaceable library rather than the contract or authority core.
  The durability substrate remains governed by ADR-0003.
- **G6 — Evaluation and supply chain.** Inspect AI, Ragas, self-hosted observability,
  SBOM/AI-BOM, and Cosign are **candidates to prototype and measure**, not adopted dependencies.
  Their use is gated by the evaluation/security criteria in the canonical strategy.
- **G7 — Measured unknowns.** Carry the evidence packet's unknowns as explicit deferrals:
  target-hardware wheel coverage; embedding/reranker quality and latency; graph-as-tables
  scaling; evaluation-framework fit; model/tool license verification; and the durable
  orchestration substrate.

## Consequences

- CYBRIK owns the stable model and orchestration seams; model runtimes and agent SDKs remain
  replaceable behind those seams.
- Python 3.12 is directional but reversible to the exact SOC floor, 3.11, if the authorized
  wheel-coverage spike proves it necessary.
- A single PostgreSQL reduces T0/T1 operating burden but creates a measured obligation to
  observe vector/FTS/graph workload limits before splitting storage.
- Model/runtime/tool licenses and offline artifacts require recurring re-verification before
  every externally shipped bundle.
- Anything crossing a product boundary must serialize the accepted ADR-0006 model and be
  governed under ADR-0001.
- `NOT IMPLEMENTED`: no Cyber AI service, source skeleton, dependency, database, model adapter,
  runtime integration, RAG pipeline, controller, store, or evaluation harness is built or
  piloted by accepting this ADR.

## Decision history

- 2026-07-23 — raised as `PROPOSED — NOT DECIDED`.
- 2026-07-24 — `ACCEPTED` at GATE A3 per Founder approval of G1–G7, informed by
  [evidence/ADR-0002-EVIDENCE.md](evidence/ADR-0002-EVIDENCE.md).
