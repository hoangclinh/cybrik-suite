# Product Module Sovereignty Classification Map (OPEN-11)

Status: PROPOSED — PER-MODULE CLASSIFICATION MAP (v0.1.0-proposed)

> **Note:** Submitted to resolve the per-module classification gap under OPEN-11. Acceptance requires separate Founder / Governor decision. This document proposes an exhaustive, file-accurate classification across all three product repositories at their exact Release Candidate 1 (RC1) commits, but does not claim that OPEN-11 is already accepted or closed. The complete 1,650-file machine-verifiable ledger is recorded in [`docs/architecture/PRODUCT-MODULE-CLASSIFICATION-LEDGER.json`](PRODUCT-MODULE-CLASSIFICATION-LEDGER.json).

## 1. Purpose & Governing Architectural Rules (ADR-0015 §5.1)

In accordance with accepted `cybrik-suite:docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md §5.1`, Decision E, and normative invariants `INV-1`, `INV-3`, `INV-4`, `INV-5`, `INV-14`, and `INV-21`, this map proposes the concrete, file-level boundary partition across all three product repositories:

* **PRODUCT_CORE** (`INV-21`): Domain logic, authority logic, security invariants, portable business/application contracts reached only through explicit ports. Knows no provider and no substrate. A whole repository MUST NOT be classified as `PRODUCT_CORE`.
* **PRODUCT_IMPLEMENTATION_ADAPTER** (Decision E): Realizes a `PRODUCT_CORE` port. Contains concrete protocol, runtime, and storage implementation knowledge (S3 protocol, OpenAI-compatible HTTP, PostgreSQL wire, Valkey KV, Ed25519/JCS, mTLS RFC 9068). Must NOT make a provider-specific infrastructure service mandatory to the domain/core contract. Ships with the product.
* **PROVIDER_ADAPTER**: Binds Platform Contract capability to concrete provider infrastructure (optional profile). Lives in deployment layer / infrastructure configurations, NOT within product core.
* **SUPPORTING_TOOLING_OR_TEST**: Non-production code (unit tests, integration test fixtures, test doubles, in-memory mock stores, linting/build configurations).
* **DEPLOYMENT_PROFILE_OR_CONFIG**: Executable container compose / deployment configurations.
* **GOVERNANCE_OR_DOCUMENTATION**: Governance policies, ADRs, runbooks, security disclosures, license dossiers.

---

## 2. Exhaustive Per-Module Classification Inventory

### 2.1 `cybrik-cyber-ai-platform` (RC1: `f0bf4c630d8e93a0531d16b4522ce0425996a624` — 221 tracked files)

| Path / Subsystem | Boundary Classification | Implementation Status | Port / Protocol Interface & Traceability |
|---|---|---|---|
| `packages/ai-core/src/cybrik_ai_core/authority.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Pure domain authority model and evaluation logic. |
| `packages/ai-core/src/cybrik_ai_core/marking.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Data classification and tagging domain invariants. |
| `packages/ai-core/src/cybrik_ai_core/policy.py` | `PRODUCT_CORE` | `IMPLEMENTED` | AI inference safety and usage policy definitions. |
| `packages/ai-core/src/cybrik_ai_core/prompts.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Domain prompt assembly and template rendering. |
| `packages/ai-core/src/cybrik_ai_core/telemetry.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Internal domain metrics and event types. |
| `packages/ai-core/src/cybrik_ai_core/errors.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Domain exception hierarchy. |
| `packages/ai-core/src/cybrik_ai_core/contract/ (common.py, inference.py, lifecycle.py, summarization.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Wire-agnostic Pydantic contract models. |
| `packages/ai-core/src/cybrik_ai_core/modelrt/ (budget.py, port.py, resilience.py, types.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Abstract model runtime port, token budget tracker, circuit-breaker. |
| `packages/ai-core/src/cybrik_ai_core/orchestration/ (attempt.py, checkpoints.py, controller.py, durable.py, durable_controller.py, ports.py, state.py, errors.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Durable investigation execution loop and state machine. |
| `packages/ai-core/src/cybrik_ai_core/orchestration/memory.py` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | In-memory dev/test state store adapter. |
| `packages/ai-core/src/cybrik_ai_core/security/ (egress.py, untrusted.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Inverse-SSRF policy guard (with ADR-0015 §7.3 DNS TOCTOU caveat) and untrusted input tagging. |
| `packages/ai-core/src/cybrik_ai_core/delegation/ (audit.py, contract.py, ports.py, trust.py, verifier.py, errors.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Service delegation token domain verification logic. |
| `packages/ai-core/src/cybrik_ai_core/delegation/replay.py` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | In-memory dev/test token replay store. |
| `packages/ai-core/src/cybrik_ai_core/delegation/ (certbind.py, jose.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | RFC 8705 certificate thumbprint verification and RFC 9068 at+jwt token parsing. |
| `services/ai-api/src/cybrik_ai_api/adapters/ollama.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Realizes modelrt.port over OpenAI-compatible HTTP / REST against local Ollama engine. |
| `services/ai-api/src/cybrik_ai_api/adapters/stub.py` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | In-memory deterministic model runtime test double. |
| `services/ai-api/src/cybrik_ai_api/orchestration/postgres.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Realizes durable checkpoint store over PostgreSQL wire protocol (asyncpg / SQLAlchemy). |
| `services/ai-api/migrations/ (alembic.ini, env.py, script.py.mako, versions/)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Alembic database schema migrations for PostgreSQL durable state tables. |
| `services/ai-api/src/cybrik_ai_api/transport_security.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | ASGI TLS-extension resolver (AsgiTlsTransportResolver) extracting TLS client certificates from ASGI transport scope (opt-in; default deny-all); no HTTP header reading, no full PKI chain validation. |
| `services/ai-api/src/cybrik_ai_api/investigations/ (service.py, relying_party.py, projection.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Domain investigation service, relying party orchestration, and projection logic. |
| `services/ai-api/src/cybrik_ai_api/investigations/api.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoint adapter exposing investigation operations. |
| `services/ai-api/src/cybrik_ai_api/summarize/service.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Core alert summarization business logic. |
| `services/ai-api/src/cybrik_ai_api/app.py, runtime_composition.py, runtime_settings.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | ASGI application factory, DI wiring, and configuration environment parsing. |
| `services/ai-worker/src/cybrik_ai_worker/` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `SCAFFOLD` | Async background worker package scaffold; unpopulated at RC1. |
| `tests/` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Unit, contract, and lifecycle test suites. |
| `docs/, AGENTS.md, CLAUDE.md, README.md, pyproject.toml, packages/*/pyproject.toml, services/*/pyproject.toml, .gitignore, .github/` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Architectural documentation, ADRs, build configurations, and repository metadata. |

---

### 2.2 `cybrik-security-tool-fabric` (RC1: `1a419014ebb432eb56ac35242e0a193fe65a62c6` — 132 tracked files)

| Path / Subsystem | Boundary Classification | Implementation Status | Port / Protocol Interface & Traceability |
|---|---|---|---|
| `src/control-plane/cybrik_fabric_control/contracts/ (alert_context.py, capability.py, effects.py, invocation.py, provenance.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Tool invocation schemas, provenance, and capability contracts. |
| `src/control-plane/cybrik_fabric_control/contracts/ (jcs.py, loader.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | RFC 8785 JCS canonicalization and JSON schema loading implementation. |
| `src/control-plane/cybrik_fabric_control/invocation/ (models.py, ports.py, service.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Pure in-process R0 soc.get_alert_context@0.1.0 domain ports, models, and service. |
| `src/control-plane/cybrik_fabric_control/registry/packet.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Tool capability registry packet parsing implementation. |
| `src/control-plane/cybrik_fabric_control/app.py, liveness.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `SCAFFOLD` | FastAPI HTTP control plane and liveness listener; Wave 0 scaffold, unwired/feature-off R0 at RC1. |
| `src/executor/internal/tier/tier.go` | `PRODUCT_CORE` | `SCAFFOLD` | Go models for opaque R0-R3 labels; scaffold (no runtime isolation semantics at RC1). |
| `src/executor/internal/version/version.go` | `PRODUCT_CORE` | `SCAFFOLD` | Go package defining SemVer constant 0.0.0 and getter; scaffold at RC1. |
| `src/executor/cmd/executor/main.go` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `SCAFFOLD` | CLI entrypoint scaffold; does not implement active isolation or tool execution at RC1 per cybrik-suite:docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md §7.4. |
| `contracts-vendor/json-schema/` | `PRODUCT_CORE` | `IMPLEMENTED` | Vendored suite contract JSON Schemas. |
| `tests/, contracts-vendor/fixtures/, src/executor/internal/*/*_test.go` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Control plane unit tests, contract conformance suites, test fixtures, and executor Go tests. |
| `docs/, AGENTS.md, CLAUDE.md, README.md, SECURITY.md, src/README.md, src/control-plane/README.md, src/executor/README.md, src/executor/tiers/` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Architecture records (ADR-0001..ADR-0004), security policies, specifications. |
| `src/control-plane/pyproject.toml, requirements*.in, requirements*.lock, src/executor/go.mod, src/executor/go.sum, src/executor/.golangci.yml, Dockerfile` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Build configurations, Go module definitions, dependency locks, and Dockerfiles. |

---

### 2.3 `cybrik-soc-command-center` (RC1: `695aed8e0e12c9d0e11de5f474e3384d1a4b490f` — 1,297 tracked files)

| Path / Subsystem | Boundary Classification | Implementation Status | Port / Protocol Interface & Traceability |
|---|---|---|---|
| `apps/soc-portal/src/ (components/, pages/, hooks/, services/, context/, lib/, App.tsx, main.tsx)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | React/TypeScript frontend presentation adapter interacting with SOC REST APIs. |
| `apps/soc-portal/src/ (tests/, **/*.test.tsx, **/*.test.ts, **/*.spec.ts)` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Frontend UI component and integration test suites. |
| `apps/soc-portal/ (package.json, package-lock.json, tsconfig*.json, vite.config.ts, tailwind.config.js, postcss.config.js, .eslintrc*, README.md)` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Frontend UI build manifests, TypeScript configs, and application documentation. |
| `services/api/src/cybrik_soc/modules/alert/ (context/authorize.py, context/clearance.py, context/digest.py, context/models.py, context/ports.py, context/redact.py, context/service.py, context/wire.py, metrics.py, pagination.py, related.py, triage.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Alert context domain service, clearance, metrics, and triage domain logic. |
| `services/api/src/cybrik_soc/modules/alert/ (api.py, context/api.py, context/reader_pg.py, context/store_pg.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, PostgreSQL alert context storage/reader, and SQLAlchemy ORM models. |
| `services/api/src/cybrik_soc/modules/asset/ (api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP router and SQLAlchemy PostgreSQL persistence models for assets. |
| `services/api/src/cybrik_soc/modules/audit/ (api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP router and SQLAlchemy PostgreSQL persistence models for audit events. |
| `services/api/src/cybrik_soc/modules/authorization/matrix.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Authorization matrix and RBAC domain definitions. |
| `services/api/src/cybrik_soc/modules/authorization/deps.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI dependency injection adapter for authorization. |
| `services/api/src/cybrik_soc/modules/case/service.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Case management and incident lifecycle domain service. |
| `services/api/src/cybrik_soc/modules/case/ (api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints and SQLAlchemy PostgreSQL persistence models for cases. |
| `services/api/src/cybrik_soc/modules/connector/ (api.py, bootstrap.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, bootstrap loader, and SQLAlchemy database persistence models for connectors. |
| `services/api/src/cybrik_soc/modules/copilot/ (gateway.py, lifecycle_create.py, shadow_remote_contract.py, tools.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Copilot domain gateway, lifecycle logic, shadow remote contracts, and tool definitions. |
| `services/api/src/cybrik_soc/modules/copilot/llm.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Outbound model client; enforces DNS sovereignty guard (socket.getaddrinfo validation, OPEN-3 caveat). |
| `services/api/src/cybrik_soc/modules/copilot/ (api.py, models.py, shadow_remote.py, shadow_suggest_worker.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, SQLAlchemy models, shadow remote client, and background worker. |
| `services/api/src/cybrik_soc/modules/datalake/ (lifecycle.py, retention.py, search.py, service.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Datalake lifecycle management, retention policies, search abstraction, and domain service. |
| `services/api/src/cybrik_soc/modules/datalake/ (api.py, es_adapter.py, opensearch_adapter.py, orm.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, Elasticsearch/OpenSearch client adapters, and SQLAlchemy persistence models. |
| `services/api/src/cybrik_soc/modules/forensics/ (access_control.py, case_link.py, classification.py, clearance.py, collectors.py, copilot_summary.py, custody.py, evidence.py, integrity_sweep.py, legal_report.py, linkage.py, pcap_analysis.py, report.py, timeline.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Forensic artifact parsing, custody tracking, integrity sweep, PCAP analysis, and evidence domain logic. |
| `services/api/src/cybrik_soc/modules/forensics/ (api.py, endpoint.py, models.py, repo.py, search.py, store.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, repository, search adapter, and local filesystem WORM storage adapter. |
| `services/api/src/cybrik_soc/modules/geoip/metrics.py` | `PRODUCT_CORE` | `IMPLEMENTED` | GeoIP resolution metrics and domain calculations. |
| `services/api/src/cybrik_soc/modules/geoip/ (api.py, reader.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints and MaxMind GeoIP database reader adapter. |
| `services/api/src/cybrik_soc/modules/hunt/ (copilot_suggest.py, executions.py, hunts.py, ioc_pivot.py, pivot.py, promote.py, query_spec.py, sigma.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Threat hunting hypothesis engine, Sigma rule translator, query generator, and execution coordinator. |
| `services/api/src/cybrik_soc/modules/hunt/compiler_sql.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | PostgreSQL SQL query compiler adapter for hunt query specifications. |
| `services/api/src/cybrik_soc/modules/hunt/ (api.py, datalake.py, models.py, orm.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, datalake client adapter, and SQLAlchemy database persistence models for hunts. |
| `services/api/src/cybrik_soc/modules/identity/ (membership.py, service.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Identity lifecycle, group membership, and principal scoping domain logic. |
| `services/api/src/cybrik_soc/modules/identity/ (api.py, membership_api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints and SQLAlchemy database persistence models for identities. |
| `services/api/src/cybrik_soc/modules/ingest/ (ecs.py, field_maps.py, log_parsers.py, log_parsers_bsd.py, log_parsers_ext.py, normalizers.py, ocsf.py, security_onion.py, service.py, source_labels.py, time_guard.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Log ingestion normalizers (OCSF, ECS, Security Onion, BSD syslog), time verification, and domain models. |
| `services/api/src/cybrik_soc/modules/ingest/ (api.py, models.py, pf_bridge.py, source_health.py, source_health_worker.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, SQLAlchemy models, packet-fabric consumer bridge, and background health polling worker. |
| `services/api/src/cybrik_soc/modules/ioc/ (match.py, metrics.py, normalize.py, stix.py, taxii.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | STIX/TAXII domain models, indicator normalization, and match engine. |
| `services/api/src/cybrik_soc/modules/ioc/ (api.py, csv_import.py, feeds_api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, CSV feed ingestion adapter, and SQLAlchemy database persistence models. |
| `services/api/src/cybrik_soc/modules/org/ (contract.py, scoping.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Multi-organization scoping and tenant isolation domain logic. |
| `services/api/src/cybrik_soc/modules/org/ (api.py, models.py, session.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, session management adapter, and SQLAlchemy database models. |
| `services/api/src/cybrik_soc/modules/prefs/ (api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | User preference HTTP router and SQLAlchemy database persistence models. |
| `services/api/src/cybrik_soc/modules/siem/ (correlation.py, engine.py, field_mapping.py, rules.py, sigma.py, sigma_match.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Sigma rule parser, correlation engine, and alert generation algorithms. |
| `services/api/src/cybrik_soc/modules/siem/ (api.py, orm.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints and database persistence models for SIEM rules and alerts. |
| `services/api/src/cybrik_soc/modules/soar/ (actions.py, audit.py, context.py, copilot_draft.py, copilot_seam.py, copilot_tool.py, engine.py, guards.py, library.py, playbook.py, report.py, runtime.py, samples.py, serialize.py, simulate.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | SOAR playbook engine, execution runtime, approval guards, action simulation, and copilot seam logic. |
| `services/api/src/cybrik_soc/modules/soar/ (api.py, connectors/fortigate.py, expire_worker.py, orm.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, DB models, background expiration worker, and FortiGate REST API connector. |
| `services/api/src/cybrik_soc/modules/tenant/service.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Multi-tenant isolation and policy domain logic. |
| `services/api/src/cybrik_soc/modules/tenant/ (api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints and SQLAlchemy database persistence models for tenants. |
| `services/api/src/cybrik_soc/modules/ueba/ (alerts.py, baseline.py, baseline_pack.py, classification.py, detect.py, detectors_ah.py, detectors_bc.py, detectors_dx.py, detectors_lm.py, detectors_pg.py, detectors_ua.py, engine.py, events.py, features.py, findings.py, iforest.py, risk.py, stats.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | User and Entity Behavior Analytics statistical engine, Isolation Forest model, risk scoring, baseline detectors. |
| `services/api/src/cybrik_soc/modules/ueba/ (api.py, learning_worker.py, orm.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, database persistence models, and background baseline learning worker. |
| `services/api/src/cybrik_soc/modules/vulnerability/ (compliance.py, consolidation.py, correlation.py, cve_enrichment.py, exceptions.py, intel.py, lifecycle.py, models.py, parsers/common.py, parsers/generic.py, parsers/greenbone.py, parsers/grype.py, parsers/nmap.py, parsers/nuclei.py, parsers/trivy.py, policy_config.py, remediation.py, reporting.py, rescore.py, risk.py, service.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Vulnerability lifecycle management, risk rescoring, consolidation, domain dataclasses (models.py), and report parsers. |
| `services/api/src/cybrik_soc/modules/vulnerability/ (api.py, orm.py, repo.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, SQLAlchemy ORM models, and database repository adapters. |
| `services/api/src/cybrik_soc/platform/ (audit_support.py, client_ip.py, context.py, errors.py, hooks.py, logging.py, provenance.py, security_txt.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Internal platform context models, error structures, provenance logging utilities. |
| `services/api/src/cybrik_soc/platform/ (database.py, http_body.py, outbound.py, rate_limit.py, secrets.py, security.py, signing.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | PostgreSQL connection pool, httpx outbound client with SSRF guard, Redis rate limiting, JWT verification, Ed25519 signing. |
| `services/api/src/cybrik_soc/platform/svc_delegation/ (algorithms.py, errors.py, issuer.py, models.py, scopes.py, signer.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Service delegation token model and RFC 9068 minting specifications. |
| `services/api/src/cybrik_soc/platform/svc_delegation/ (factory.py, principal_adapter.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Delegation token issuer factory and authentication principal adapter. |
| `ops/pf-workers/pf_workers/ (__init__.py, alert_writer.py, config.py, correlation_processor.py, dlq_processor.py, envelope.py, indexer.py, normalizer.py, parquet_archiver.py, pipeline_health.py, producer_bridge.py, retention_sweep.py, s3util.py, siem_matcher.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Packet-fabric background stream processing adapters (Kafka consumers, OpenSearch indexers, S3 boto3 SeaweedFS archiver, Parquet writers). |
| `ops/pf-workers/pf_workers/correlation_rules/` | `PRODUCT_CORE` | `IMPLEMENTED` | Declarative correlation detection rules (YAML). |
| `deploy/pf/ (.env.t1.example, certs/, docker-compose.pf-demo.yml, docker-compose.pf-workers.yml, docker-compose.t0.yml, docker-compose.t1.bench.yml, docker-compose.t1.dev.yml, docker-compose.t1.yml, staging/docker-compose.staging.yml, opensearch/, topics-init*.sh)` | `DEPLOYMENT_PROFILE_OR_CONFIG` | `IMPLEMENTED` | Executable Docker Compose topology definitions and scripts for T0, T1, staging, and demo data-plane pipelines. |
| `services/api/src/cybrik_soc/modules/*/__init__.py, services/api/src/cybrik_soc/modules/*/README.md, services/api/src/cybrik_soc/modules/ioc/STIX-TAXII-INTEGRATION-NOTES.md` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Module documentation and package namespace initialization files. |
| `services/api/alembic/ (env.py, script.py.mako, versions/)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Alembic PostgreSQL database migration definitions. |
| `services/api/tests/, ops/pf-workers/tests/, scripts/` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Unit, integration, and benchmark test suites. |
| `docs/, governance/ADR/, reports/, third-party/, services/api/Dockerfile, services/api/alembic.ini, ops/pf-workers/Dockerfile, pyproject.toml` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Architecture decision records, sprint review dossiers, third-party license notices, SBOM documentation, and Docker build specifications. |

---

### 2.4 Architecture Seams & Planned Adapters (Future Evolution — Non-RC1 Tree)

| Path / Subsystem | Boundary Classification | Implementation Status | Port / Protocol Interface & Traceability |
|---|---|---|---|
| `*vLLM model runtime adapter*` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `PLANNED` | Planned local inference engine realization (ADR-0002 G3); not present in RC1 tree. |
| `*llama.cpp model runtime adapter*` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `PLANNED` | Planned embedded inference engine realization (ADR-0002 G3); not present in RC1 tree. |

---

## 3. Boundary & Sovereignty Invariant Verification

1. **Verification of Invariant `INV-1` & `INV-21` (No Mono-Core Repository)**:
   - Every product repository exhibits an explicit division between `PRODUCT_CORE` and `PRODUCT_IMPLEMENTATION_ADAPTER`.
   - Zero repositories are classified wholesale as `PRODUCT_CORE`.
2. **Verification of Decision E & ADR-0015 §5.1 (Portable Implementation Adapters)**:
   - `boto3` in `cybrik-soc-command-center:ops/pf-workers/pf_workers/s3util.py` connects to self-hosted SeaweedFS via S3 wire protocol; it does NOT mandate AWS cloud infrastructure.
   - LLM adapters in `cybrik-cyber-ai-platform` connect via OpenAI-compatible HTTP to local engines (Ollama); zero mandatory public cloud endpoints exist.
   - Control plane and executor in `cybrik-security-tool-fabric` are at `SCAFFOLD` maturity at RC1 (unwired R0 in-process context domain; no active runtime sandbox execution or isolation implemented at RC1 per cybrik-suite:docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md §7.4).
3. **Verification of Invariant `INV-3` & `INV-5` (Data Sovereignty & Local Inference)**:
   - Under the proposed architecture and Platform Contract requirements, customer-controlled data classes are specified to remain within sovereign boundaries without mandatory external telemetry or foreign cloud dependencies.
   - No mandatory public cloud LLM or telemetry service is embedded in any product core.
   - The DNS validate-then-connect caveat (`OPEN-3`) remains identified and tracked.
