# Product Module Sovereignty Classification Map (OPEN-11)

Status: PROPOSED — PER-MODULE CLASSIFICATION MAP (v0.1.0-proposed)

> **Note:** Submitted to resolve the per-module classification gap under OPEN-11. Acceptance requires separate Founder / Governor decision. This document proposes an exhaustive, file-accurate classification across all three product repositories at their exact Release Candidate 1 (RC1) commits, but does not claim that OPEN-11 is already accepted or closed. The complete 1,650-file machine-verifiable ledger is recorded in [`docs/architecture/PRODUCT-MODULE-CLASSIFICATION-LEDGER.json`](PRODUCT-MODULE-CLASSIFICATION-LEDGER.json).

## 1. Purpose & Governing Architectural Rules (ADR-0015 §5.1)

In accordance with accepted `cybrik-suite:docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md §5.1`, Decision E, and normative invariants `INV-1`, `INV-3`, `INV-4`, `INV-5`, `INV-14`, and `INV-21`, this map proposes the concrete, file-level boundary partition across all three product repositories:

* **PRODUCT_CORE** (`INV-21`): Domain logic, authority logic, security invariants, portable business/application contracts reached only through explicit ports. Knows no provider and no substrate. A whole repository MUST NOT be classified as `PRODUCT_CORE`.
* **PRODUCT_IMPLEMENTATION_ADAPTER** (Decision E): Realizes a `PRODUCT_CORE` port. Contains concrete protocol, runtime, and storage implementation knowledge (S3 protocol, OpenAI-compatible HTTP, PostgreSQL wire, Valkey KV, Ed25519/JCS, mTLS RFC 9068, vendor scanner format parsers). Must NOT make a provider-specific infrastructure service mandatory to the domain/core contract. Ships with the product.
* **PROVIDER_ADAPTER**: Binds Platform Contract capability to concrete provider infrastructure (optional profile). Lives in deployment layer / infrastructure configurations, NOT within product core.
* **SUPPORTING_TOOLING_OR_TEST**: Non-production code (unit tests, integration test fixtures, test doubles, in-memory mock stores, linting/build configurations, developer test automation).
* **DEPLOYMENT_PROFILE_OR_CONFIG**: Executable container compose / deployment configurations, systemd services/timers, desktop launch scripts, environment configuration templates.
* **GOVERNANCE_OR_DOCUMENTATION**: Governance policies, ADRs, sprint closure dossiers, runbooks, security disclosures, license dossiers, package markers, typing markers, test documentation, unpopulated scaffold packages.

### 1.1 Mixed-Role Source File Resolution Rule
When a historical RC1 source file combines an abstract port/contract interface with an embedded test/demo double or concrete network client (e.g. `packages/ai-core/src/cybrik_ai_core/orchestration/checkpoints.py`, `src/control-plane/cybrik_fabric_control/invocation/ports.py`, `services/api/src/cybrik_soc/modules/soar/connectors/__init__.py`, `services/api/src/cybrik_soc/modules/soar/library.py`, `services/api/src/cybrik_soc/modules/ioc/taxii.py`, `services/api/src/cybrik_soc/modules/hunt/executions.py`), it is classified at the file level by its concrete executable realization (`PRODUCT_IMPLEMENTATION_ADAPTER`). Traceability notes explicitly document the mixed composition to avoid overstating runtime readiness or attributing production execution authority to test doubles.

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
| `packages/ai-core/src/cybrik_ai_core/orchestration/ (attempt.py, controller.py, durable.py, durable_controller.py, ports.py, state.py, errors.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Durable investigation execution loop and state machine. |
| `packages/ai-core/src/cybrik_ai_core/orchestration/checkpoints.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Mixed-role file containing CheckpointLog port combined with built-in InMemoryCheckpointLog dev/test double; classified as PRODUCT_IMPLEMENTATION_ADAPTER per file-level realization rule §1.1. |
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
| `services/ai-worker/ (pyproject.toml, src/cybrik_ai_worker/__init__.py, src/cybrik_ai_worker/py.typed)` | `GOVERNANCE_OR_DOCUMENTATION` | `SCAFFOLD` | Async background worker package scaffold; unpopulated at RC1. |
| `tests/ (excluding README.md), .github/` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Unit, contract, and lifecycle test suites and CI workflows (excluding test documentation). |
| `packages/**/__init__.py, services/ai-api/**/__init__.py` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Python package namespace initialization and module markers (excluding services/ai-worker/). |
| `docs/, AGENTS.md, CLAUDE.md, README.md, SECURITY.md, tests/README.md, pyproject.toml, packages/*/pyproject.toml, services/ai-api/pyproject.toml, uv.lock, .python-version, .gitleaks.toml, .gitignore, packages/*/src/*/py.typed, services/ai-api/src/*/py.typed` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Architectural documentation, ADRs, test suite documentation, build configurations, typing markers, security policies, and repository metadata (excluding services/ai-worker/). |

---

### 2.2 `cybrik-security-tool-fabric` (RC1: `1a419014ebb432eb56ac35242e0a193fe65a62c6` — 132 tracked files)

| Path / Subsystem | Boundary Classification | Implementation Status | Port / Protocol Interface & Traceability |
|---|---|---|---|
| `src/control-plane/cybrik_fabric_control/contracts/ (alert_context.py, capability.py, effects.py, invocation.py, provenance.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Tool invocation schemas, provenance, and capability contracts. |
| `src/control-plane/cybrik_fabric_control/contracts/ (jcs.py, loader.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | RFC 8785 JCS canonicalization and JSON schema loading implementation. |
| `src/control-plane/cybrik_fabric_control/invocation/ (models.py, service.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Pure in-process R0 soc.get_alert_context@0.1.0 domain models and service. |
| `src/control-plane/cybrik_fabric_control/invocation/ports.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Mixed-role file containing IdempotencyStore port combined with DevTestOnlyInMemoryIdempotencyStore test double; classified as PRODUCT_IMPLEMENTATION_ADAPTER per file-level realization rule §1.1. |
| `src/control-plane/cybrik_fabric_control/registry/packet.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Tool capability registry packet parsing implementation. |
| `src/control-plane/cybrik_fabric_control/app.py, liveness.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `SCAFFOLD` | FastAPI HTTP control plane and liveness listener; Wave 0 scaffold, unwired/feature-off R0 at RC1. |
| `src/control-plane/cybrik_fabric_control/**/__init__.py` | `GOVERNANCE_OR_DOCUMENTATION` | `SCAFFOLD` | Control plane package namespace markers and scaffold entrypoints (implements no product concern at RC1). |
| `src/executor/internal/tier/tier.go` | `PRODUCT_CORE` | `SCAFFOLD` | Go models for opaque R0-R3 labels; scaffold (no runtime isolation semantics at RC1). |
| `src/executor/internal/version/version.go` | `GOVERNANCE_OR_DOCUMENTATION` | `SCAFFOLD` | Go package defining SemVer constant 0.0.0 and getter; scaffold metadata at RC1. |
| `src/executor/cmd/executor/main.go` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `SCAFFOLD` | CLI entrypoint scaffold; does not implement active isolation or tool execution at RC1 per cybrik-suite:docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md §7.4. |
| `contracts-vendor/json-schema/` | `PRODUCT_CORE` | `IMPLEMENTED` | Vendored suite contract JSON Schemas. |
| `tests/ (excluding **/README.md), contracts-vendor/fixtures/, contracts-vendor/contracts.lock.json, contracts-vendor/compatibility/*.manifest.json, src/executor/internal/*/*_test.go, src/executor/cmd/executor/main_test.go, .github/` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Control plane unit tests, contract conformance suites, test fixtures, compatibility manifests, executor Go tests, and CI workflows (excluding test documentation). |
| `docs/, AGENTS.md, CLAUDE.md, README.md, SECURITY.md, src/README.md, src/control-plane/README.md, src/executor/README.md, src/executor/tiers/, tests/**/README.md, contracts-vendor/README.md, .gitignore, src/control-plane/cybrik_fabric_control/py.typed, src/control-plane/cybrik_fabric_control/__about__.py` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Architecture records (ADR-0001..ADR-0004), security policies, specifications, test suite documentation (tests/README.md, conformance/README.md, control-plane/README.md, executor/README.md), contracts-vendor README, typing markers, metadata, and repository metadata. |
| `src/control-plane/pyproject.toml, requirements*.in, requirements*.lock, src/executor/go.mod, src/executor/go.sum, src/executor/.golangci.yml, Dockerfile, src/control-plane/Dockerfile, src/executor/Dockerfile` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Build configurations, Go module definitions, dependency locks, and Dockerfiles. |

---

### 2.3 `cybrik-soc-command-center` (RC1: `695aed8e0e12c9d0e11de5f474e3384d1a4b490f` — 1,297 tracked files)

| Path / Subsystem | Boundary Classification | Implementation Status | Port / Protocol Interface & Traceability |
|---|---|---|---|
| `START-CYBRIK.command, STOP-CYBRIK.command` | `DEPLOYMENT_PROFILE_OR_CONFIG` | `IMPLEMENTED` | Desktop launch scripts invoking Docker Compose for local development stack. |
| `Makefile, services/api/.coverage, services/api/dump.rdb` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Developer build automation Makefile, test coverage database, and Redis transient database snapshot. |
| `.dockerignore, .gitignore, .gitleaks.toml, .gitleaksignore, CLAUDE.md, LICENSE, README.md, SECURITY.md, SPRINT-0-CLOSURE.md, SPRINT-0-IMPLEMENTATION-PLAN.md` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Root repository metadata, license, security policy, and sprint closure records. |
| `apps/soc-portal/ (app/, components/, lib/, public/)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Next.js React frontend presentation adapter interacting with SOC REST APIs. |
| `apps/soc-portal/ (e2e/, ui-review/, playwright.config.ts)` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Frontend UI E2E, review, and test suites. |
| `apps/soc-portal/ (package.json, package-lock.json, tsconfig.json, next.config.mjs, next-env.d.ts, Dockerfile, README.md)` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Next.js frontend portal configuration and build manifests. |
| `connectors/ (generic-webhook/README.md, security-onion/README.md)` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Connector architecture documentation and integration guides. |
| `deploy/ (docker/docker-compose*.yml, pf/docker-compose*.yml, pf/staging/docker-compose.staging.yml, cron/, systemd/, log-collection/agent/cybrik-log-agent/ (agent.conf, install.ps1, install.sh), log-collection/fluent-bit/ (*.conf), log-collection/vector/vector.yaml, pf/certs/, pf/opensearch/, pf/*.sh, docker/initdb/, docker/dev-up.sh, docker/.env.example, pf/.env.t1.example)` | `DEPLOYMENT_PROFILE_OR_CONFIG` | `IMPLEMENTED` | Executable Docker Compose topologies, systemd services/timers, cron jobs, shell launch scripts, environment configuration templates (.env.t1.example, .env.example), and log agent configurations. |
| `deploy/log-collection/signer/ (cybrik_webhook_signer.py, signer_lib.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Ed25519 webhook signature generator CLI and adapter library. |
| `deploy/ (docker/dev_endpoints.py, docker/screenshots/capture.mjs)` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Development endpoint helpers and screenshot automation scripts (excluding container Dockerfiles). |
| `deploy/ (README.md, **/README.md, **/AGENT-DESIGN.md, docker/backup/Dockerfile, docker/screenshots/Dockerfile)` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Deployment documentation, agent designs, and container build specifications. |
| `packages/api-contracts/ (openapi/generic-webhook.v0.yaml, schemas/*.json)` | `PRODUCT_CORE` | `IMPLEMENTED` | Wire-agnostic API schemas and OpenAPI definitions. |
| `packages/design-system/tokens/ (tokens.css, tokens.json)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Frontend design system tokens and style definitions. |
| `scripts/ (demo_ready_local_digest.py, e2e_smoke.py, run-final-gate.sh, tests/, ui-review/)` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Smoke test, digest generator, and UI review development scripts. |
| `ops/backup/cybrik_backup/ (backup.py, cli.py, crypto.py, drill.py, logging_setup.py, manifest.py, pgclient.py, restore.py, retention.py, snapshot.py, __main__.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | PostgreSQL backup, restore, and drill CLI tool adapter (including __main__.py entrypoint). |
| `ops/backup/tests/` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Backup and restore drill unit tests. |
| `ops/backup/ (INTEGRATION-CHECKLIST.md, README.md, pyproject.toml)` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Backup service documentation and package build manifest. |
| `ops/pf-bench/ (pf_bench/ (config.py, consumer_indexer.py, event.py, producer.py, report.py), scripts/)` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Packet-fabric benchmark producer and consumer test harness (excluding package metadata and initializers). |
| `ops/pf-bench/ (pyproject.toml, .gitignore, pf_bench/__init__.py)` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Packet-fabric benchmark harness package manifest, marker, and git metadata. |
| `ops/pf-workers/pf_workers/ (alert_writer.py, config.py, correlation_processor.py, dlq_processor.py, envelope.py, indexer.py, normalizer.py, parquet_archiver.py, pipeline_health.py, producer_bridge.py, retention_sweep.py, s3util.py, siem_matcher.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Packet-fabric background stream processing adapters (Kafka consumers, OpenSearch indexers, S3 boto3 SeaweedFS archiver, Parquet writers). |
| `ops/pf-workers/pf_workers/correlation_rules/ (*.yml)` | `PRODUCT_CORE` | `IMPLEMENTED` | Declarative correlation detection rules (YAML). |
| `ops/pf-workers/ (tests/, scripts/)` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Packet-fabric worker test suites and e2e integration scripts. |
| `ops/pf-workers/ (Dockerfile, Dockerfile.dockerignore, README.md, pyproject.toml, .gitignore)` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Packet-fabric worker build specifications and documentation. |
| `services/api/content/sigma/ (*.yml), services/api/content/ueba_baselines/ (*.yml)` | `PRODUCT_CORE` | `IMPLEMENTED` | Declarative Sigma detection rules and UEBA baseline definitions. |
| `services/api/content/sigma/tests/ (*.json)` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Sigma detection rule test fixtures. |
| `services/api/content/sigma/NOTICE.md` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Sigma rules third-party attribution notice. |
| `services/api/alembic/ (env.py, script.py.mako, versions/)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Alembic PostgreSQL database migration definitions. |
| `services/api/scripts/, services/api/tests/, .github/` | `SUPPORTING_TOOLING_OR_TEST` | `IMPLEMENTED` | Service unit/integration test suites, seed scripts, and verification harnesses. |
| `services/api/src/cybrik_soc/ (config.py, main.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI ASGI application entrypoint, CORS configuration, and environment variable settings. |
| `services/api/src/cybrik_soc/modules/alert/ (context/authorize.py, context/clearance.py, context/digest.py, context/models.py, context/ports.py, context/redact.py, context/service.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Alert context domain service, clearance, frozen value dataclasses (context/models.py), and abstract ports. |
| `services/api/src/cybrik_soc/modules/alert/ (api.py, context/api.py, context/reader_pg.py, context/store_pg.py, context/wire.py, metrics.py, pagination.py, related.py, triage.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, PostgreSQL alert context storage/reader, wire composition adapter, and SQLAlchemy ORM models. |
| `services/api/src/cybrik_soc/modules/asset/ (api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP router and SQLAlchemy PostgreSQL persistence models for assets. |
| `services/api/src/cybrik_soc/modules/audit/ (api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP router and SQLAlchemy PostgreSQL persistence models for audit events. |
| `services/api/src/cybrik_soc/modules/authorization/matrix.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Authorization matrix and RBAC domain definitions. |
| `services/api/src/cybrik_soc/modules/authorization/deps.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI dependency injection adapter for authorization. |
| `services/api/src/cybrik_soc/modules/case/ (service.py, api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Case persistence service, FastAPI endpoints, and SQLAlchemy PostgreSQL persistence models for cases. |
| `services/api/src/cybrik_soc/modules/connector/ (api.py, bootstrap.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, bootstrap loader, and SQLAlchemy database persistence models for connectors. |
| `services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py` | `PRODUCT_CORE` | `IMPLEMENTED` | Copilot shadow remote contract definition. |
| `services/api/src/cybrik_soc/modules/copilot/llm.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Outbound model client; enforces DNS sovereignty guard (socket.getaddrinfo validation, OPEN-3 caveat). |
| `services/api/src/cybrik_soc/modules/copilot/ (api.py, gateway.py, lifecycle_create.py, models.py, shadow_remote.py, shadow_suggest_worker.py, tools.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | AI Gateway, FastAPI HTTP endpoints, httpx outbound clients, SQLAlchemy models, shadow remote client, and background workers. |
| `services/api/src/cybrik_soc/modules/datalake/ (retention.py, search.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Datalake retention policies and search abstraction. |
| `services/api/src/cybrik_soc/modules/datalake/ (api.py, es_adapter.py, lifecycle.py, opensearch_adapter.py, orm.py, service.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, Elasticsearch/OpenSearch client adapters, datalake index lifecycle management (ILM/ISM rollover), service coordinator, and SQLAlchemy persistence models. |
| `services/api/src/cybrik_soc/modules/forensics/ (access_control.py, case_link.py, classification.py, clearance.py, collectors.py, copilot_summary.py, custody.py, evidence.py, integrity_sweep.py, legal_report.py, linkage.py, pcap_analysis.py, report.py, timeline.py, search.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Forensic artifact parsing, custody tracking, integrity sweep, PCAP analysis, metadata search query engine, and evidence domain logic. |
| `services/api/src/cybrik_soc/modules/forensics/ (api.py, endpoint.py, models.py, repo.py, store.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, repository, search adapter, and local filesystem WORM storage adapter. |
| `services/api/src/cybrik_soc/modules/geoip/ (api.py, metrics.py, reader.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, SQLAlchemy resolution metrics, and MaxMind GeoIP database reader adapter. |
| `services/api/src/cybrik_soc/modules/hunt/ (copilot_suggest.py, hunts.py, ioc_pivot.py, pivot.py, promote.py, query_spec.py, sigma.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Threat hunting hypothesis engine, Sigma rule translator, query generator, and hunt definitions. |
| `services/api/src/cybrik_soc/modules/hunt/executions.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Mixed-role file containing CanonicalQueryExecutor Protocol port combined with concrete execution coordinator and SQL/DSL query reproduction compiler; classified as PRODUCT_IMPLEMENTATION_ADAPTER per file-level realization rule §1.1. |
| `services/api/src/cybrik_soc/modules/hunt/compiler_sql.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | PostgreSQL SQL query compiler adapter for hunt query specifications. |
| `services/api/src/cybrik_soc/modules/hunt/ (api.py, datalake.py, models.py, orm.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, datalake client adapter, and SQLAlchemy database persistence models for hunts. |
| `services/api/src/cybrik_soc/modules/identity/ (api.py, membership.py, membership_api.py, models.py, service.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, membership service, and SQLAlchemy database persistence models for identities. |
| `services/api/src/cybrik_soc/modules/ingest/ (ecs.py, field_maps.py, log_parsers.py, log_parsers_bsd.py, log_parsers_ext.py, normalizers.py, ocsf.py, source_labels.py, time_guard.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Log ingestion normalizers (OCSF, ECS, BSD syslog), time verification, and domain models. |
| `services/api/src/cybrik_soc/modules/ingest/ (api.py, models.py, pf_bridge.py, security_onion.py, service.py, source_health.py, source_health_worker.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, SQLAlchemy models, packet-fabric consumer bridge, Security Onion adapter, and background health polling worker. |
| `services/api/src/cybrik_soc/modules/ioc/ (normalize.py, stix.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | STIX/TAXII domain models and indicator normalization. |
| `services/api/src/cybrik_soc/modules/ioc/ (api.py, csv_import.py, feeds_api.py, match.py, metrics.py, models.py, taxii.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, CSV feed ingestion adapter, match persistence engine, SQLAlchemy models, and TAXII client adapter (taxii.py with TaxiiClient classified as PRODUCT_IMPLEMENTATION_ADAPTER under mixed-role rule §1.1). |
| `services/api/src/cybrik_soc/modules/org/ (contract.py, scoping.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Multi-organization scoping and tenant isolation domain logic. |
| `services/api/src/cybrik_soc/modules/org/ (api.py, models.py, session.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, session management adapter, and SQLAlchemy database models. |
| `services/api/src/cybrik_soc/modules/prefs/ (api.py, models.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | User preference HTTP router and SQLAlchemy database persistence models. |
| `services/api/src/cybrik_soc/modules/siem/ (correlation.py, engine.py, field_mapping.py, rules.py, sigma.py, sigma_match.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Sigma rule parser, correlation engine, and alert generation algorithms. |
| `services/api/src/cybrik_soc/modules/siem/ (api.py, orm.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints and database persistence models for SIEM rules and alerts. |
| `services/api/src/cybrik_soc/modules/soar/ (actions.py, audit.py, context.py, copilot_draft.py, copilot_tool.py, engine.py, guards.py, playbook.py, report.py, samples.py, serialize.py, simulate.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | SOAR playbook engine, execution logic, approval guards, action simulation, and tool definitions. |
| `services/api/src/cybrik_soc/modules/soar/ (api.py, connectors/__init__.py, connectors/fortigate.py, copilot_seam.py, expire_worker.py, library.py, orm.py, runtime.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, DB models, background expiration worker, copilot seam persistence, built-in StubFirewallConnector adapter, action library stub wiring, and FortiGate REST connector (soar/connectors/__init__.py and soar/library.py classified as PRODUCT_IMPLEMENTATION_ADAPTER under mixed-role rule §1.1). |
| `services/api/src/cybrik_soc/modules/tenant/ (api.py, models.py, service.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints and SQLAlchemy database persistence models for tenants. |
| `services/api/src/cybrik_soc/modules/ueba/ (alerts.py, baseline.py, baseline_pack.py, classification.py, detect.py, detectors_ah.py, detectors_bc.py, detectors_dx.py, detectors_lm.py, detectors_pg.py, detectors_ua.py, engine.py, events.py, features.py, findings.py, iforest.py, risk.py, stats.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | User and Entity Behavior Analytics statistical engine, Isolation Forest model, risk scoring, baseline detectors. |
| `services/api/src/cybrik_soc/modules/ueba/ (api.py, learning_worker.py, orm.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI endpoints, database persistence models, and background baseline learning worker. |
| `services/api/src/cybrik_soc/modules/vulnerability/ (compliance.py, consolidation.py, correlation.py, cve_enrichment.py, exceptions.py, intel.py, lifecycle.py, models.py, parsers/common.py, policy_config.py, remediation.py, reporting.py, rescore.py, risk.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Vulnerability lifecycle management, risk rescoring, consolidation, domain dataclasses (models.py), normalized finding dataclasses (parsers/common.py), and policy config serialization. |
| `services/api/src/cybrik_soc/modules/vulnerability/ (api.py, orm.py, repo.py, service.py, parsers/generic.py, parsers/greenbone.py, parsers/grype.py, parsers/nmap.py, parsers/nuclei.py, parsers/trivy.py, parsers/__init__.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | FastAPI HTTP endpoints, SQLAlchemy ORM models, database repository adapters, vulnerability service parsing coordinator (direct parsers.parse_report dependency), scanner parser registry, and vendor-specific report format parser adapters (Greenbone XML, Grype JSON, Nmap XML, Nuclei JSON, Trivy JSON). |
| `services/api/src/cybrik_soc/platform/ (client_ip.py, context.py, logging.py, provenance.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Internal platform context models, error structures, provenance logging utilities. |
| `services/api/src/cybrik_soc/platform/ (audit_support.py, database.py, errors.py, hooks.py, http_body.py, outbound.py, rate_limit.py, secrets.py, security.py, signing.py, security_txt.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | PostgreSQL connection pool, httpx outbound client with SSRF guard, Redis rate limiting, JWT verification, Ed25519 signing, RFC 9116 security.txt resolver, FastAPI error handlers. |
| `services/api/src/cybrik_soc/platform/svc_delegation/ (algorithms.py, errors.py, models.py, scopes.py)` | `PRODUCT_CORE` | `IMPLEMENTED` | Service delegation token model, error types, algorithms, and RFC 9068 minting specifications. |
| `services/api/src/cybrik_soc/platform/svc_delegation/ (factory.py, issuer.py, principal_adapter.py, signer.py)` | `PRODUCT_IMPLEMENTATION_ADAPTER` | `IMPLEMENTED` | Delegation token issuer, signer adapter, factory, and authentication principal adapter. |
| `services/api/src/cybrik_soc/**/__init__.py (excluding soar/connectors/__init__.py and vulnerability/parsers/__init__.py), ops/backup/**/__init__.py, ops/pf-workers/**/__init__.py` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Python package markers and namespace initialization files across backend services (excluding executable adapters and pf-bench). |
| `services/api/src/cybrik_soc/modules/*/README.md, services/api/src/cybrik_soc/modules/ioc/STIX-TAXII-INTEGRATION-NOTES.md` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Module documentation and integration notes under services/api/src/cybrik_soc/modules/. |
| `docs/, governance/, reports/, artifacts/, backlog/, third-party/, services/api/Dockerfile, services/api/alembic.ini, pyproject.toml, services/api/pyproject.toml` | `GOVERNANCE_OR_DOCUMENTATION` | `IMPLEMENTED` | Architecture decision records, sprint review dossiers, third-party license notices, SBOM documentation, and build/metadata specifications. |

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
   - Scanner format adapters in `cybrik-soc-command-center:services/api/src/cybrik_soc/modules/vulnerability/parsers/` encapsulate third-party report formats (Greenbone XML, Grype JSON, Nmap XML, Nuclei JSON, Trivy JSON) as `PRODUCT_IMPLEMENTATION_ADAPTER` with normalized finding dataclasses in `common.py`.
   - Control plane and executor in `cybrik-security-tool-fabric` are at `SCAFFOLD` maturity at RC1 (unwired R0 in-process context domain; no active runtime sandbox execution or isolation implemented at RC1 per cybrik-suite:docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md §7.4).
3. **Verification of Invariant `INV-3` & `INV-5` (Data Sovereignty & Local Inference)**:
   - Under the proposed architecture and Platform Contract requirements, customer-controlled data classes are specified to remain within sovereign boundaries without mandatory external telemetry or foreign cloud dependencies.
   - No mandatory public cloud LLM or telemetry service is embedded in any product core.
   - The DNS validate-then-connect caveat (`OPEN-3`) remains identified and tracked.
