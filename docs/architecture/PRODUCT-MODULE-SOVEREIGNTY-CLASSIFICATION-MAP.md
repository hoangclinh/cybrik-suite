# Product Module Sovereignty Classification Map

Status: `ACCEPTED CLASSIFICATION MAP` (Under ADR-0015 §5.1 & Founder Decision 2026-08-24)  
Authority: **ADR-0015 (§5.1, §14 OPEN-11)**  
Commit Anchor: `ce2656b75010495700f34967ecd06ec6044fe73d`  
Evaluated Product Repositories (Pinned RC1 Commits):
- `cybrik-soc-command-center` @ `695aed8e0e12c9d0e11de5f474e3384d1a4b490f`
- `cybrik-cyber-ai-platform` @ `f0bf4c630d8e93a0531d16b4522ce0425996a624`
- `cybrik-security-tool-fabric` @ `1a419014ebb432eb56ac35242e0a193fe65a62c6`

---

## 1. Governing Architectural Rules (ADR-0015 §5.1)

In accordance with accepted ADR-0015 §5.1 and normative invariants `INV-1`, `INV-3`, `INV-4`, `INV-5`, `INV-14`, and `INV-21`, the four-layer architecture strictly partitions product repositories into distinct internal layers:

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
│                               PostgreSQL wire, Valkey KV, Ed25519/JCS).      │
│                               Provider-portable by construction.             │
│                               Ships with the product.                         │
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

### 1.1 Category Definitions & Invariants
1. **`PRODUCT_CORE`** (`INV-21`): The domain-logic, authority-logic, security-invariant, and portable-contract subset **within** a product repository, reached only through explicit ports. It MUST NOT import, reference, or branch on a provider identity, a provider service name, or a substrate identity. A whole repository MUST NOT be classified as `PRODUCT_CORE`.
2. **`PRODUCT_IMPLEMENTATION_ADAPTER`** (Decision B): Realizes a `PRODUCT_CORE` port. It MAY contain concrete protocol, runtime, and storage implementation knowledge, and it MUST remain provider-portable: the protocol it speaks must be satisfiable by more than one deployment without changing the core contract. It MUST NOT make a provider-specific infrastructure service mandatory to the domain/core contract, and it MUST NOT leak a provider identity through a port signature. Ships with the product.
3. **`PROVIDER_ADAPTER`**: Binds a Platform Contract capability to one concrete infrastructure/provider realization (e.g. AWS ECS/RDS/S3, GCP Cloud Run/Cloud SQL/GCS) and is an `OPTIONAL_PROFILE`. Lives in deployment/infrastructure configurations, NOT within product core.
4. **`SUPPORTING_TOOLING_OR_TEST`**: Non-production code (unit tests, integration test fixtures, test doubles, linting/build configurations).
5. **`GOVERNANCE_OR_DOCUMENTATION`**: Governance policies, ADRs, runbooks, security disclosures, license dossiers.

---

## 2. Exhaustive Per-Module Classification Inventory

### 2.1 `cybrik-soc-command-center` (RC1: `695aed8e0e12c9d0e11de5f474e3384d1a4b490f`)

| Subsystem / Path | Boundary Classification | Port / Protocol Interface | Provider Neutrality & Traceability Proof | Isolation / Sovereignty |
|---|---|---|---|---|
| `services/api/src/cybrik_soc/modules/alerts/` | `PRODUCT_CORE` | Alert ingestion, deduplication, and triage domain port | Pure Python business logic; zero cloud SDK imports; schema-driven. | S0 Deterministic Service |
| `services/api/src/cybrik_soc/modules/cases/` | `PRODUCT_CORE` | Case management & incident timeline domain port | Pure domain models (SQLModel/Pydantic); no provider branching. | S0 Deterministic Service |
| `services/api/src/cybrik_soc/modules/copilot/` | `PRODUCT_CORE` | Copilot investigation planner & prompt assembly | Includes sovereignty URL guard (`socket.getaddrinfo` validation); model-agnostic. | S0 Deterministic Service |
| `services/api/src/cybrik_soc/modules/forensics/` | `PRODUCT_CORE` | Forensic artifact parsing and evidence model | Evidence integrity tracking; WORM checklist item; no vendor lock. | S0 Deterministic Service |
| `services/api/src/cybrik_soc/modules/investigations/` | `PRODUCT_CORE` | Investigation graph & bundle state domain port | Implements bundle serialization and checkpoint semantics per suite contract. | S0 Deterministic Service |
| `services/api/src/cybrik_soc/contracts/` | `PRODUCT_CORE` | Suite JSON Schema Pydantic bindings | Concrete domain schemas; zero vendor-specific fields. | S0 Deterministic Service |
| `services/api/src/cybrik_soc/platform/outbound.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | Outbound HTTP / SSRF Guard Seam | Portable httpx client with IP validation; connects to arbitrary HTTP endpoints. | S0 Deterministic Service |
| `services/api/src/cybrik_soc/platform/db.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | PostgreSQL Wire Protocol (libpq/asyncpg) | Standard SQL dialect; connects to self-hosted PostgreSQL or managed DB. | S0 Deterministic Service |
| `services/api/src/cybrik_soc/platform/cache.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | Redis RESP Protocol (Valkey / Redis) | Standard in-memory KV operations; compatible with self-hosted Valkey. | S0 Deterministic Service |
| `services/api/src/cybrik_soc/platform/auth.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | RFC 9068 / JWT / mTLS token validation | Pluggable asymmetric cryptographic verification (Ed25519/RSA). | S0 Deterministic Service |
| `services/api/src/cybrik_soc/platform/crypto.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | Pluggable Crypto Provider Seam | Sovereign key derivation; aligns with SOC ADR-0018 direction. | S0 Deterministic Service |
| `ops/pf-workers/pf_workers/s3util.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | S3 Protocol (boto3 against SeaweedFS) | Forces path-style addressing and custom endpoint URL (`PF_SEAWEED_S3_ENDPOINT`). Portable. | S0 Deterministic Service |
| `ops/pf-workers/pf_workers/parquet_archiver.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | Kafka Consumer + Parquet + S3 PutObject | Streams events to Parquet format; stores via portable S3 adapter. | S0 Deterministic Service |
| `services/web/` | `PRODUCT_CORE` / `PRODUCT_IMPLEMENTATION_ADAPTER` | React/Next.js UI & REST API Client | UI domain components (Core) + browser Fetch API adapter. | S1 Client Browser |
| `tests/` | `SUPPORTING_TOOLING_OR_TEST` | pytest, unittest mocks | In-memory SQLite, mocked S3/LLM; zero live infrastructure dependency. | N/A |
| `docs/`, `governance/ADR/`, `deploy/` | `GOVERNANCE_OR_DOCUMENTATION` | Markdown, Docker Compose templates | Non-executable architecture documents, local development compose profiles. | N/A |

### 2.2 `cybrik-cyber-ai-platform` (RC1: `f0bf4c630d8e93a0531d16b4522ce0425996a624`)

| Subsystem / Path | Boundary Classification | Port / Protocol Interface | Provider Neutrality & Traceability Proof | Isolation / Sovereignty |
|---|---|---|---|---|
| `packages/ai-core/src/cybrik_ai_core/security/egress.py` | `PRODUCT_CORE` | Inverse-SSRF Egress Policy Guard | Injected `resolver` interface; private/allowlisted IP enforcement; provider-neutral. | S0 Deterministic Service |
| `packages/ai-core/src/cybrik_ai_core/graph/` | `PRODUCT_CORE` | Investigation Graph & Hypothesis Engine | Graph traversal, entity linking, anomaly scoring; pure computation. | S0 Deterministic Service |
| `packages/ai-core/src/cybrik_ai_core/models/` | `PRODUCT_CORE` | AI Domain Models & Evidence Bundles | Domain entities and event structures; vendor-agnostic. | S0 Deterministic Service |
| `services/ai-api/src/cybrik_ai_api/services/` | `PRODUCT_CORE` | Investigation Orchestration & Summarization | Multi-turn reasoning loops and prompt pipelines; depends only on core ports. | S0 Deterministic Service |
| `services/ai-api/src/cybrik_ai_api/adapters/ollama.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | OpenAI-compatible HTTP REST (Ollama) | Thin client realizing the model port; speaks standard chat completions API. | S0 Deterministic Service |
| `services/ai-api/src/cybrik_ai_api/adapters/vllm.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | OpenAI-compatible HTTP REST (vLLM) | Standard vLLM inference adapter; local/air-gap capable. | S0 Deterministic Service |
| `services/ai-api/src/cybrik_ai_api/adapters/llama_cpp.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | OpenAI-compatible HTTP REST (llama.cpp) | Embedded/local llama.cpp server adapter; zero cloud requirement. | S0 Deterministic Service |
| `services/ai-api/src/cybrik_ai_api/delegation/` | `PRODUCT_IMPLEMENTATION_ADAPTER` | RFC 9068 Delegation Token Verification | Validates short-lived certificate-bound delegation tokens from SOC. | S0 Deterministic Service |
| `services/ai-worker/src/cybrik_ai_worker/` | `PRODUCT_IMPLEMENTATION_ADAPTER` | Asynchronous Job Worker Loop | Connects worker processes to Redis/Valkey task queues. | S0 Deterministic Service |
| `tests/` | `SUPPORTING_TOOLING_OR_TEST` | pytest, Mock LLM servers | Unit and integration test suites; offline execution verified. | N/A |
| `docs/`, `AGENTS.md`, `README.md` | `GOVERNANCE_OR_DOCUMENTATION` | Markdown documentation | Technical documentation and agent instructions. | N/A |

### 2.3 `cybrik-security-tool-fabric` (RC1: `1a419014ebb432eb56ac35242e0a193fe65a62c6`)

| Subsystem / Path | Boundary Classification | Port / Protocol Interface | Provider Neutrality & Traceability Proof | Isolation / Sovereignty |
|---|---|---|---|---|
| `src/control-plane/cybrik_fabric_control/contracts/` | `PRODUCT_CORE` | Tool Execution & Capability Definition Ports | Vendor-neutral tool execution request/response models; ADR-0004 compliant. | S0 Deterministic Service |
| `src/control-plane/cybrik_fabric_control/invocation/` | `PRODUCT_CORE` | Tool Invocation Lifecycle & Policy Engine | Policy approval checks and parameter validation; zero external dependencies. | S0 Deterministic Service |
| `src/control-plane/cybrik_fabric_control/receipt/` | `PRODUCT_CORE` | Execution Receipt Canonical Digest Engine | Computes RFC 8785 JCS digests over tool outputs; cryptographically deterministic. | S0 Deterministic Service |
| `src/control-plane/cybrik_fabric_control/app.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | FastAPI HTTP & mTLS Transport Adapter | Serves REST/MCP control plane; agnostic mTLS handshake validation. | S0 Deterministic Service |
| `src/executor/internal/tier/` | `PRODUCT_CORE` | Sandbox Isolation Tier Classifier (Go) | S0–S4 isolation policy and capability constraint logic. | S0 Deterministic Service |
| `src/executor/internal/version/` | `PRODUCT_CORE` | Protocol & Semantic Version Validator (Go) | Pure semantic versioning logic; no external dependencies. | S0 Deterministic Service |
| `src/executor/cmd/executor/` | `PRODUCT_IMPLEMENTATION_ADAPTER` | Linux Process / Seccomp / Stdio Adapter | Launches disposable execution sandboxes; standard Linux kernel primitives. | S1/S2 Disposable Sandbox |
| `tests/` | `SUPPORTING_TOOLING_OR_TEST` | pytest, go test | Offline no-network contract tests (`test_offline_no_network.py`). | N/A |
| `docs/`, `AGENTS.md`, `README.md` | `GOVERNANCE_OR_DOCUMENTATION` | Markdown documentation | Technical specifications and agent instructions. | N/A |

---

## 3. Provider-Neutrality & Boundary Invariant Verification

1. **Verification of Invariant `INV-1` & `INV-21` (No Mono-Core Repository)**:
   - Every product repository contains a clean, explicit division between `PRODUCT_CORE` and `PRODUCT_IMPLEMENTATION_ADAPTER`.
   - Zero repositories are classified wholesale as `PRODUCT_CORE`.
2. **Verification of Decision B (Portable Implementation Adapters)**:
   - `boto3` in `cybrik-soc-command-center:ops/pf-workers/pf_workers/s3util.py` connects to self-hosted SeaweedFS via S3 wire protocol; it does NOT import or mandate AWS cloud infrastructure.
   - LLM adapters in `cybrik-cyber-ai-platform` connect via OpenAI-compatible HTTP to local engines (Ollama, vLLM, llama.cpp); zero mandatory public cloud endpoints exist.
   - Control plane in `cybrik-security-tool-fabric` executes tools via standard Linux kernel isolation (namespaces, seccomp) without requiring proprietary cloud sandboxes.
3. **Verification of Invariant `INV-3` & `INV-5` (Data Sovereignty & Local Inference)**:
   - Customer-controlled data classes remain entirely inside sovereign customer infrastructure.
   - No mandatory public cloud LLM or telemetry service is embedded in any product core.

---

## 4. Formal Resolution of OPEN-11

- **Pre-Resolution State**: ADR-0015 resolved the **definition** of the four-layer boundary in §5.1, while leaving the **per-module classification** open as `OPEN-11`.
- **Resolution**: This document completes the exhaustive per-module classification across all three product repositories at their exact RC1 peeled commits.
- **Disposition**:
  - `OPEN-11` is **RESOLVED** as to the initial per-module classification map for Release Candidate v1.0.0-rc1.
  - Any future addition of a product module MUST register its classification against this map prior to release qualification.
