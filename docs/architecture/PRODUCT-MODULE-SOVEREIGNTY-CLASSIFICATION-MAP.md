# Product Module Sovereignty Classification Map (OPEN-11)

**Status: PROPOSED — PER-MODULE CLASSIFICATION MAP (v0.1.0-proposed)**

> **Note:** Submitted to resolve the per-module classification gap under OPEN-11. Acceptance requires separate Founder / Governor decision. This document proposes an exhaustive classification across all three product repositories at their exact Release Candidate 1 (RC1) commits, but does not claim that OPEN-11 is already accepted or closed.

## 1. Purpose & Governing Architectural Rules (ADR-0015 §5.1)

In accordance with accepted ADR-0015 §5.1 and normative invariants `INV-1`, `INV-3`, `INV-4`, `INV-5`, `INV-14`, and `INV-21`, this map establishes the concrete, file-by-file boundary partition across all three product repositories:

* **PRODUCT_CORE** (`INV-21`): Domain logic, authority logic, security invariants, portable business/application contracts reached only through explicit ports. Knows no provider and no substrate. A whole repository MUST NOT be classified as `PRODUCT_CORE`.
* **PRODUCT_IMPLEMENTATION_ADAPTER** (Decision B): Realizes a `PRODUCT_CORE` port. Contains concrete protocol, runtime, and storage implementation knowledge (S3 protocol, OpenAI-compatible HTTP, PostgreSQL wire, Valkey KV, Ed25519/JCS, mTLS RFC 9068). Must NOT make a provider-specific infrastructure service mandatory to the domain/core contract. Ships with the product.
* **PROVIDER_ADAPTER**: Binds Platform Contract capability to concrete provider infrastructure (optional profile). Lives in deployment layer / infrastructure configurations, NOT within product core.
* **SUPPORTING_TOOLING_OR_TEST**: Non-production code (unit tests, integration test fixtures, test doubles, linting/build configurations).
* **DEPLOYMENT_PROFILE_OR_CONFIG**: Executable container compose / deployment configurations.
* **GOVERNANCE_OR_DOCUMENTATION**: Governance policies, ADRs, runbooks, security disclosures, license dossiers.

---

## 2. Exhaustive Per-Module Classification Inventory

### 2.1 `cybrik-cyber-ai-platform` (RC1: `f0bf4c630d8e93a0531d16b4522ce0425996a624`)

| Path / Subsystem | Boundary Classification | Implementation Status | Port / Protocol Interface & Traceability |
|---|---|---|---|
| `packages/ai-core/src/cybrik_ai_core/authority.py`, `marking.py`, `policy.py`, `prompts.py`, `telemetry.py`, `errors.py` | `PRODUCT_CORE` | IMPLEMENTED | Pure domain authority, prompt assembly, and policy invariants; no cloud SDKs. |
| `packages/ai-core/src/cybrik_ai_core/contract/` (`common.py`, `inference.py`, `lifecycle.py`, `summarization.py`) | `PRODUCT_CORE` | IMPLEMENTED | Wire-agnostic Pydantic contract models for inference and summarization. |
| `packages/ai-core/src/cybrik_ai_core/modelrt/` (`budget.py`, `port.py`, `resilience.py`, `types.py`) | `PRODUCT_CORE` | IMPLEMENTED | Abstract model runtime port interface, token budget tracking, circuit-breaker logic. |
| `packages/ai-core/src/cybrik_ai_core/orchestration/` (`attempt.py`, `checkpoints.py`, `controller.py`, `durable.py`, `durable_controller.py`, `memory.py`, `ports.py`, `state.py`, `errors.py`) | `PRODUCT_CORE` | IMPLEMENTED | State machine and execution loop for durable multi-turn investigations. |
| `packages/ai-core/src/cybrik_ai_core/security/` (`egress.py`, `untrusted.py`) | `PRODUCT_CORE` | IMPLEMENTED | Inverse-SSRF policy guard (with ADR-0015 §7.3 DNS validate-then-connect caveat) and untrusted input tagging. |
| `packages/ai-core/src/cybrik_ai_core/delegation/` (`audit.py`, `contract.py`, `ports.py`, `replay.py`, `trust.py`, `verifier.py`, `errors.py`) | `PRODUCT_CORE` | IMPLEMENTED | Pure domain verifier logic for service delegation tokens. |
| `packages/ai-core/src/cybrik_ai_core/delegation/` (`certbind.py`, `jose.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | RFC 8705 certificate thumbprint verification and RFC 9068 `at+jwt` token parsing. |
| `services/ai-api/src/cybrik_ai_api/adapters/ollama.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | Realizes `modelrt.port` over OpenAI-compatible HTTP / REST against local Ollama engine. |
| `services/ai-api/src/cybrik_ai_api/adapters/stub.py` | `SUPPORTING_TOOLING_OR_TEST` | IMPLEMENTED | In-memory deterministic model runtime test double. |
| `services/ai-api/src/cybrik_ai_api/orchestration/postgres.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | Realizes durable checkpoint store over PostgreSQL wire protocol (asyncpg / SQLAlchemy). |
| `services/ai-api/src/cybrik_ai_api/transport_security.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | ASGI middleware validating mTLS client certificates and header-based client bindings. |
| `services/ai-api/src/cybrik_ai_api/investigations/` (`service.py`, `relying_party.py`, `projection.py`) | `PRODUCT_CORE` | IMPLEMENTED | Domain investigation service, relying party orchestration, and projection logic. |
| `services/ai-api/src/cybrik_ai_api/investigations/api.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoint adapter exposing investigation operations. |
| `services/ai-api/src/cybrik_ai_api/summarize/service.py` | `PRODUCT_CORE` | IMPLEMENTED | Core alert summarization business logic. |
| `services/ai-api/src/cybrik_ai_api/app.py`, `runtime_composition.py`, `runtime_settings.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | ASGI application factory, DI wiring, and configuration environment parsing. |
| `services/ai-worker/src/cybrik_ai_worker/` | `PRODUCT_IMPLEMENTATION_ADAPTER` | SCAFFOLD | Async background worker package scaffold; unpopulated at RC1. |
| *vLLM adapter* (planned seam) | `PRODUCT_IMPLEMENTATION_ADAPTER` | PLANNED | Architecture seam (ADR-0002 G3); not implemented at RC1. |
| *llama.cpp adapter* (planned seam) | `PRODUCT_IMPLEMENTATION_ADAPTER` | PLANNED | Architecture seam (ADR-0002 G3); not implemented at RC1. |
| `tests/` | `SUPPORTING_TOOLING_OR_TEST` | IMPLEMENTED | Unit, contract, and lifecycle test suites. |
| `docs/`, `AGENTS.md`, `README.md` | `GOVERNANCE_OR_DOCUMENTATION` | IMPLEMENTED | Architectural documentation, ADRs, and repository metadata. |

---

### 2.2 `cybrik-security-tool-fabric` (RC1: `1a419014ebb432eb56ac35242e0a193fe65a62c6`)

| Path / Subsystem | Boundary Classification | Implementation Status | Port / Protocol Interface & Traceability |
|---|---|---|---|
| `src/control-plane/cybrik_fabric_control/contracts/` (`alert_context.py`, `capability.py`, `effects.py`, `invocation.py`, `jcs.py`, `loader.py`, `provenance.py`) | `PRODUCT_CORE` | IMPLEMENTED | Tool invocation schemas, RFC 8785 JCS canonicalization, capability contracts. |
| `src/control-plane/cybrik_fabric_control/invocation/` (`models.py`, `ports.py`, `service.py`) | `PRODUCT_CORE` | IMPLEMENTED | Pure in-process R0 `soc.get_alert_context@0.1.0` domain service. |
| `src/control-plane/cybrik_fabric_control/registry/packet.py` | `PRODUCT_CORE` | IMPLEMENTED | Tool capability registry packet validation and parsing. |
| `src/control-plane/cybrik_fabric_control/app.py`, `liveness.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | SCAFFOLD | FastAPI HTTP control plane and liveness listener; Wave 0 scaffold, unwired/feature-off R0 at RC1. |
| `src/executor/internal/tier/tier.go`, `internal/version/version.go` | `PRODUCT_CORE` | SCAFFOLD | Go models for isolation tiers (S0-S4) and SemVer; version `0.0.0` explicitly denotes scaffold. |
| `src/executor/cmd/executor/main.go` | `PRODUCT_IMPLEMENTATION_ADAPTER` | SCAFFOLD | CLI sandbox launcher entrypoint; scaffold at RC1. |
| `contracts-vendor/` | `PRODUCT_CORE` | IMPLEMENTED | Vendored suite contract JSON Schemas and compatibility manifests. |
| `tests/` | `SUPPORTING_TOOLING_OR_TEST` | IMPLEMENTED | Control plane unit tests and contract conformance suites. |
| `docs/`, `AGENTS.md`, `README.md`, `src/README.md` | `GOVERNANCE_OR_DOCUMENTATION` | IMPLEMENTED | Architecture records (ADR-0001..ADR-0004), security policies, specifications. |

---

### 2.3 `cybrik-soc-command-center` (RC1: `695aed8e0e12c9d0e11de5f474e3384d1a4b490f`)

| Path / Subsystem | Boundary Classification | Implementation Status | Port / Protocol Interface & Traceability |
|---|---|---|---|
| `services/api/src/cybrik_soc/modules/audit/` (`models.py`, `service.py`, `contract.py`) | `PRODUCT_CORE` | IMPLEMENTED | SOC audit trail domain logic and event models. |
| `services/api/src/cybrik_soc/modules/audit/api.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoint routing for audit events. |
| `services/api/src/cybrik_soc/modules/auth/` (`models.py`, `service.py`, `tokens.py`) | `PRODUCT_CORE` | IMPLEMENTED | Authentication domain logic, RBAC policies, and user permission models. |
| `services/api/src/cybrik_soc/modules/auth/api.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoints for authentication and login. |
| `services/api/src/cybrik_soc/modules/cases/` (`models.py`, `service.py`, `timeline.py`, `contract.py`) | `PRODUCT_CORE` | IMPLEMENTED | Case management, incident lifecycle, and timeline aggregation logic. |
| `services/api/src/cybrik_soc/modules/cases/` (`api.py`, `orm.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI endpoints and SQLAlchemy database persistence models for cases. |
| `services/api/src/cybrik_soc/modules/copilot/` (`models.py`, `planner.py`, `prompt.py`, `service.py`) | `PRODUCT_CORE` | IMPLEMENTED | Copilot domain investigation planning, prompt assembly, and context reasoning. |
| `services/api/src/cybrik_soc/modules/copilot/llm.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | Outbound model client; enforces DNS sovereignty guard (`socket.getaddrinfo` validation, OPEN-3 caveat). |
| `services/api/src/cybrik_soc/modules/copilot/api.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoints for copilot interactions. |
| `services/api/src/cybrik_soc/modules/datalake/` (`models.py`, `schema.py`, `query.py`) | `PRODUCT_CORE` | IMPLEMENTED | Datalake domain query abstractions and schema definitions. |
| `services/api/src/cybrik_soc/modules/datalake/` (`api.py`, `client.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI endpoints and search engine / storage query client adapters. |
| `services/api/src/cybrik_soc/modules/events/` (`models.py`, `filter.py`, `normalizer.py`) | `PRODUCT_CORE` | IMPLEMENTED | Event normalization and filtering domain logic. |
| `services/api/src/cybrik_soc/modules/events/api.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoints for event ingestion and queries. |
| `services/api/src/cybrik_soc/modules/forensics/` (`models.py`, `evidence.py`, `types.py`) | `PRODUCT_CORE` | IMPLEMENTED | Forensic artifact parsing, evidence tracking, and custody verification logic. |
| `services/api/src/cybrik_soc/modules/forensics/` (`api.py`, `storage.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI endpoints and local filesystem WORM storage adapter. |
| `services/api/src/cybrik_soc/modules/hunt/` (`models.py`, `engine.py`, `rules.py`) | `PRODUCT_CORE` | IMPLEMENTED | Threat hunting hypothesis engine and query generator. |
| `services/api/src/cybrik_soc/modules/hunt/api.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoints for threat hunting queries. |
| `services/api/src/cybrik_soc/modules/ingest/` (`models.py`, `normalizers.py`, `ocsf.py`, `security_onion.py`, `service.py`, `time_guard.py`) | `PRODUCT_CORE` | IMPLEMENTED | Log ingestion normalizers (OCSF, Security Onion), time verification, and domain models. |
| `services/api/src/cybrik_soc/modules/ingest/` (`api.py`, `pf_bridge.py`, `source_health_worker.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI endpoints, packet-fabric consumer bridge, and background health polling worker. |
| `services/api/src/cybrik_soc/modules/ioc/` (`models.py`, `match.py`, `normalize.py`, `stix.py`, `taxii.py`) | `PRODUCT_CORE` | IMPLEMENTED | STIX/TAXII domain models, indicator normalization, and match engine. |
| `services/api/src/cybrik_soc/modules/ioc/` (`api.py`, `feeds_api.py`, `csv_import.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoints and CSV feed ingestion adapter. |
| `services/api/src/cybrik_soc/modules/org/` (`contract.py`, `models.py`, `scoping.py`) | `PRODUCT_CORE` | IMPLEMENTED | Multi-organization scoping and tenant isolation domain logic. |
| `services/api/src/cybrik_soc/modules/org/` (`api.py`, `session.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoints and session management adapter. |
| `services/api/src/cybrik_soc/modules/prefs/models.py` | `PRODUCT_CORE` | IMPLEMENTED | User preference domain models. |
| `services/api/src/cybrik_soc/modules/prefs/api.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoints for user preferences. |
| `services/api/src/cybrik_soc/modules/siem/` (`correlation.py`, `engine.py`, `field_mapping.py`, `rules.py`, `sigma.py`, `sigma_match.py`) | `PRODUCT_CORE` | IMPLEMENTED | Sigma rule parser, correlation engine, and alert generation algorithms. |
| `services/api/src/cybrik_soc/modules/siem/` (`api.py`, `orm.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI endpoints and database persistence models for SIEM rules and alerts. |
| `services/api/src/cybrik_soc/modules/soar/` (`actions.py`, `context.py`, `engine.py`, `guards.py`, `library.py`, `playbook.py`, `report.py`, `runtime.py`, `serialize.py`, `simulate.py`, `copilot_draft.py`, `copilot_seam.py`, `copilot_tool.py`) | `PRODUCT_CORE` | IMPLEMENTED | SOAR playbook engine, execution runtime, approval guards, action simulation, and copilot seam logic. |
| `services/api/src/cybrik_soc/modules/soar/` (`api.py`, `orm.py`, `expire_worker.py`, `connectors/fortigate.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI endpoints, DB models, background expiration worker, and FortiGate REST API connector. |
| `services/api/src/cybrik_soc/modules/tenant/` (`models.py`, `service.py`) | `PRODUCT_CORE` | IMPLEMENTED | Multi-tenant isolation and policy domain logic. |
| `services/api/src/cybrik_soc/modules/tenant/api.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoints for tenant management. |
| `services/api/src/cybrik_soc/modules/ueba/` (`alerts.py`, `baseline.py`, `baseline_pack.py`, `classification.py`, `detect.py`, `detectors_*.py`, `engine.py`, `events.py`, `features.py`, `findings.py`, `iforest.py`, `risk.py`, `stats.py`) | `PRODUCT_CORE` | IMPLEMENTED | User and Entity Behavior Analytics statistical engine, Isolation Forest model, risk scoring, baseline detectors. |
| `services/api/src/cybrik_soc/modules/ueba/` (`api.py`, `orm.py`, `learning_worker.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI endpoints, database persistence models, and background baseline learning worker. |
| `services/api/src/cybrik_soc/modules/vulnerability/` (`compliance.py`, `consolidation.py`, `correlation.py`, `cve_enrichment.py`, `exceptions.py`, `intel.py`, `lifecycle.py`, `models.py`, `policy_config.py`, `remediation.py`, `reporting.py`, `rescore.py`, `risk.py`, `service.py`, `parsers/`) | `PRODUCT_CORE` | IMPLEMENTED | Vulnerability lifecycle management, risk rescoring, consolidation, and report parsers (Generic, Greenbone, Grype, Nmap, Nuclei, Trivy). |
| `services/api/src/cybrik_soc/modules/vulnerability/` (`api.py`, `orm.py`, `repo.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | FastAPI HTTP endpoints, SQLAlchemy ORM models, and database repository adapters. |
| `services/api/src/cybrik_soc/platform/` (`audit_support.py`, `client_ip.py`, `context.py`, `errors.py`, `hooks.py`, `logging.py`, `provenance.py`, `security_txt.py`) | `PRODUCT_CORE` | IMPLEMENTED | Internal platform context models, error structures, provenance logging utilities. |
| `services/api/src/cybrik_soc/platform/` (`database.py`, `http_body.py`, `outbound.py`, `rate_limit.py`, `secrets.py`, `security.py`, `signing.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | PostgreSQL connection pool, httpx outbound client with SSRF guard, Redis rate limiting, JWT verification, Ed25519 signing. |
| `services/api/src/cybrik_soc/platform/svc_delegation/` (`algorithms.py`, `models.py`, `scopes.py`, `signer.py`, `issuer.py`, `errors.py`) | `PRODUCT_CORE` | IMPLEMENTED | Service delegation token model and RFC 9068 minting specifications. |
| `services/api/src/cybrik_soc/platform/svc_delegation/` (`factory.py`, `principal_adapter.py`) | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | Delegation token issuer factory and authentication principal adapter. |
| `services/api/src/cybrik_soc/contracts/` | `PRODUCT_CORE` | IMPLEMENTED | Pydantic model definitions for inter-service contracts. |
| `ops/pf-workers/pf_workers/s3util.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | S3 wire protocol client using `boto3` configured with path-style addressing against self-hosted SeaweedFS. |
| `ops/pf-workers/pf_workers/parquet_archiver.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | Kafka event stream consumer and Apache Parquet file format archiver. |
| `deploy/pf/docker-compose.t0.yml`, `docker-compose.t1.yml` | `DEPLOYMENT_PROFILE_OR_CONFIG` | IMPLEMENTED | Executable Docker Compose topology definitions for T0 and T1 data-plane pipelines. |
| `services/api/tests/`, `ops/pf-workers/tests/`, `scripts/tests/` | `SUPPORTING_TOOLING_OR_TEST` | IMPLEMENTED | Unit and integration test suites. |
| `docs/`, `governance/ADR/`, `reports/`, `third-party/` | `GOVERNANCE_OR_DOCUMENTATION` | IMPLEMENTED | Architecture decision records, sprint review dossiers, third-party license notices, and SBOM documentation. |

---

## 3. Boundary & Sovereignty Invariant Verification

1. **Verification of Invariant `INV-1` & `INV-21` (No Mono-Core Repository)**:
   - Every product repository exhibits an explicit division between `PRODUCT_CORE` and `PRODUCT_IMPLEMENTATION_ADAPTER`.
   - Zero repositories are classified wholesale as `PRODUCT_CORE`.
2. **Verification of Decision B (Portable Implementation Adapters)**:
   - `boto3` in `cybrik-soc-command-center:ops/pf-workers/pf_workers/s3util.py` connects to self-hosted SeaweedFS via S3 wire protocol; it does NOT mandate AWS cloud infrastructure.
   - LLM adapters in `cybrik-cyber-ai-platform` connect via OpenAI-compatible HTTP to local engines (Ollama); zero mandatory public cloud endpoints exist.
   - Control plane in `cybrik-security-tool-fabric` executes tools via standard Linux kernel isolation without requiring proprietary cloud sandboxes.
3. **Verification of Invariant `INV-3` & `INV-5` (Data Sovereignty & Local Inference)**:
   - Customer-controlled data classes remain entirely inside sovereign customer infrastructure.
   - No mandatory public cloud LLM or telemetry service is embedded in any product core.
   - The DNS validate-then-connect caveat (`OPEN-3`) remains identified and tracked.
