# Product Module Sovereignty Classification Map (OPEN-11)

**Status: PROPOSED — PER-MODULE CLASSIFICATION MAP (v0.1.0-proposed)**

> **Note:** Submitted to resolve the per-module classification gap under OPEN-11. Acceptance requires separate Founder / Governor decision. This document proposes an exhaustive classification but does not claim that OPEN-11 is already accepted or closed.

## 1. Purpose

This document provides an exhaustive per-module classification of the CYBRIK platform against the four-layer boundary defined in ADR-0015, based exactly on the Release Candidate 1 (RC1) commits.

## 2. Classification Inventory

### 2.1 `cybrik-cyber-ai-platform` (RC1: `f0bf4c630d8e93a0531d16b4522ce0425996a624`)

| Path | Classification | Implementation Status | Notes |
|---|---|---|---|
| `packages/ai-core/src/cybrik_ai_core/authority.py`, `errors.py`, `marking.py`, `policy.py`, `prompts.py`, `telemetry.py` | `PRODUCT_CORE` | IMPLEMENTED | |
| `packages/ai-core/src/cybrik_ai_core/contract/` (`common.py`, `inference.py`, `lifecycle.py`, `summarization.py`) | `PRODUCT_CORE` | IMPLEMENTED | |
| `packages/ai-core/src/cybrik_ai_core/modelrt/` (`budget.py`, `port.py`, `resilience.py`, `types.py`) | `PRODUCT_CORE` | IMPLEMENTED | |
| `packages/ai-core/src/cybrik_ai_core/orchestration/` (`attempt.py`, `checkpoints.py`, `controller.py`, `durable.py`, `durable_controller.py`, `errors.py`, `memory.py`, `ports.py`, `state.py`) | `PRODUCT_CORE` | IMPLEMENTED | |
| `packages/ai-core/src/cybrik_ai_core/security/` (`egress.py`, `untrusted.py`) | `PRODUCT_CORE` | IMPLEMENTED | |
| `packages/ai-core/src/cybrik_ai_core/delegation/` (`audit.py`, `certbind.py`, `contract.py`, `errors.py`, `jose.py`, `ports.py`, `replay.py`, `trust.py`, `verifier.py`) | `PRODUCT_CORE` / `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | RFC 8705/9068 |
| `services/ai-api/src/cybrik_ai_api/adapters/ollama.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | |
| `services/ai-api/src/cybrik_ai_api/adapters/stub.py` | `SUPPORTING_TOOLING_OR_TEST` | IMPLEMENTED | |
| `services/ai-api/src/cybrik_ai_api/orchestration/postgres.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | |
| `services/ai-api/src/cybrik_ai_api/transport_security.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | |
| `services/ai-api/src/cybrik_ai_api/investigations/` | `PRODUCT_CORE` / `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | `api.py` adapter, `service.py`/`relying_party.py` core |
| `services/ai-api/src/cybrik_ai_api/summarize/service.py` | `PRODUCT_CORE` | IMPLEMENTED | |
| `services/ai-api/src/cybrik_ai_api/app.py`, `runtime_composition.py`, `runtime_settings.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | |
| `services/ai-worker/src/cybrik_ai_worker/` | `PRODUCT_IMPLEMENTATION_ADAPTER` | SCAFFOLD | Unpopulated at RC1 |
| *vLLM adapter* | `PRODUCT_IMPLEMENTATION_ADAPTER` | PLANNED | Architecture seam (ADR-0002 G3), not implemented at RC1 |
| *llama.cpp adapter* | `PRODUCT_IMPLEMENTATION_ADAPTER` | PLANNED | Architecture seam (ADR-0002 G3), not implemented at RC1 |

### 2.2 `cybrik-security-tool-fabric` (RC1: `1a419014ebb432eb56ac35242e0a193fe65a62c6`)

| Path | Classification | Implementation Status | Notes |
|---|---|---|---|
| `src/control-plane/cybrik_fabric_control/contracts/` (`alert_context.py`, `capability.py`, `effects.py`, `invocation.py`, `jcs.py`, `loader.py`, `provenance.py`) | `PRODUCT_CORE` | IMPLEMENTED | |
| `src/control-plane/cybrik_fabric_control/invocation/` (`models.py`, `ports.py`, `service.py`) | `PRODUCT_CORE` | IMPLEMENTED | In-process R0 `soc.get_alert_context@0.1.0` |
| `src/control-plane/cybrik_fabric_control/registry/packet.py` | `PRODUCT_CORE` | IMPLEMENTED | |
| `src/control-plane/cybrik_fabric_control/app.py`, `liveness.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | Health/liveness HTTP listener, unwired/feature-off R0 |
| `src/executor/internal/tier/tier.go`, `internal/version/version.go` | `PRODUCT_CORE` | IMPLEMENTED | Go models |
| `src/executor/cmd/executor/main.go` | `PRODUCT_IMPLEMENTATION_ADAPTER` | SCAFFOLD | CLI runner scaffold |

### 2.3 `cybrik-soc-command-center` (RC1: `695aed8e0e12c9d0e11de5f474e3384d1a4b490f`)

| Path | Classification | Implementation Status | Notes |
|---|---|---|---|
| `services/api/src/cybrik_soc/modules/alerts/`, `cases/`, `investigations/`, `intelligence/`, `ueba/`, `vulnerability/`, `compliance/`, `audit/`, `orchestration/` | `PRODUCT_CORE` | IMPLEMENTED | |
| `services/api/src/cybrik_soc/modules/copilot/domain_logic` | `PRODUCT_CORE` | IMPLEMENTED | Domain logic |
| `services/api/src/cybrik_soc/modules/copilot/llm.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | Adheres to ADR-0015 §7.3 DNS validate-then-connect caveat (OPEN-3) using `socket.getaddrinfo` sovereignty guard |
| `services/api/src/cybrik_soc/modules/forensics/domain_models` | `PRODUCT_CORE` | IMPLEMENTED | Domain models |
| `services/api/src/cybrik_soc/modules/forensics/storage` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | Filesystem storage adapter |
| `services/api/src/cybrik_soc/platform/db.py`, `cache.py`, `outbound.py`, `auth.py`, `crypto.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | PostgreSQL, Valkey, httpx, JWT, crypto seams |
| `services/api/src/cybrik_soc/contracts/` | `PRODUCT_CORE` | IMPLEMENTED | |
| `ops/pf-workers/pf_workers/s3util.py`, `parquet_archiver.py`, `run.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | IMPLEMENTED | boto3 against SeaweedFS, Kafka consumer, Parquet writer |
| `deploy/pf/docker-compose.t0.yml`, `t1.yml`, `t2.yml` | `DEPLOYMENT_PROFILE_OR_CONFIG` | IMPLEMENTED | Executable data-plane configs, NOT documentation |
