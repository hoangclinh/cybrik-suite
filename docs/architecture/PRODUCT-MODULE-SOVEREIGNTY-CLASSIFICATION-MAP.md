# Product Module Sovereignty Classification Map

## Governing Architectural Rules (ADR-0015 §5.1)

In accordance with ADR-0015 §5.1, the boundary definitions for all modules are strictly enforced:

* **PRODUCT_CORE**: Domain logic, authority logic, security invariants, portable business/application contracts reached only through explicit ports. Knows no provider, no substrate.
  * **INV-21**: The whole repository MUST NOT be classified as `PRODUCT_CORE`.
* **PRODUCT_IMPLEMENTATION_ADAPTER**: Realizes a `PRODUCT_CORE` port. Provider-portable realization (e.g., S3 protocol, OpenAI-compatible HTTP, PostgreSQL wire, Valkey KV, Ed25519/JCS, mTLS RFC 9068). Ships with the product. Must NOT make a provider-specific infrastructure service mandatory to the domain contract.
* **PROVIDER_ADAPTER**: Binds Platform Contract capability to concrete provider infrastructure (optional profile). Not included in core distributions by default.
* **SUPPORTING_TOOLING_OR_TEST**: Non-production code (tests, scripts, dev-only tools).
* **GOVERNANCE_OR_DOCUMENTATION**: ADRs, readmes, security advisories, release notes.

The architectural invariants (INV-1, INV-3, INV-4, INV-5, INV-14, INV-21) enforce clean isolation, zero provider-lock-in at the domain level, and explicit port-adapter structures.

## Module Classification Pass (OPEN-11)

### cybrik-soc-command-center (RC1: 695aed8e0e12c9d0e11de5f474e3384d1a4b490f)

| Module Path / Name | Classification | Port / Protocol Boundary | Provider Neutrality Verification | Sovereignty & Isolation |
| --- | --- | --- | --- | --- |
| `packages/api-contracts` | `PRODUCT_CORE` | Internal Domain Ports (Schema/Types) | Defines wire-agnostic data models; no SDK dependencies. | S4 Data Floor |
| `packages/design-system` | `PRODUCT_CORE` | Internal Domain Ports (React/UI) | Agnostic UI component primitives; zero vendor-specific API calls. | S1 Client UI |
| `services/api/src/cybrik_soc/modules/*` | `PRODUCT_CORE` | Internal Domain Ports (Services) | Implements core SOC/SOAR logic using explicit platform interfaces; zero external SDKs. | S4 Data Floor |
| `services/api/src/cybrik_soc/platform/*` | `PRODUCT_IMPLEMENTATION_ADAPTER` | PostgreSQL Wire, Valkey KV, HTTP, Ed25519/JCS | Connects via open protocols (PG Wire, Redis RESP). No hard dependency on RDS/ElastiCache. | S3 Infra Floor |
| `tests/*` | `SUPPORTING_TOOLING_OR_TEST` | N/A | Mocked and strictly local execution. | N/A |
| `docs/*`, `AGENTS.md`, `README.md` | `GOVERNANCE_OR_DOCUMENTATION` | N/A | Documentation artifacts. | N/A |

### cybrik-cyber-ai-platform (RC1: f0bf4c630d8e93a0531d16b4522ce0425996a624)

| Module Path / Name | Classification | Port / Protocol Boundary | Provider Neutrality Verification | Sovereignty & Isolation |
| --- | --- | --- | --- | --- |
| `packages/ai-core/src/cybrik_ai_core/*` | `PRODUCT_CORE` | Internal Domain Ports | Orchestration, policy, and authority logic; completely agnostic to LLM providers. | S4 Data Floor |
| `services/ai-api/src/cybrik_ai_api/adapters/*` | `PRODUCT_IMPLEMENTATION_ADAPTER` | OpenAI-compatible HTTP, REST | Uses standard HTTP schemas (OpenAI compat) for model interactions; prevents vendor lock-in. | S3 Infra Floor |
| `services/ai-api/src/cybrik_ai_api/investigations`, `orchestration`, `summarize` | `PRODUCT_CORE` | Internal Domain Ports | Core orchestration loops driven by generic capabilities. | S4 Data Floor |
| `services/ai-worker/src/cybrik_ai_worker/*` | `PRODUCT_IMPLEMENTATION_ADAPTER` | Task Queue Wire Protocol | Binds worker loop to agnostic message queues. | S3 Infra Floor |
| `tests/*` | `SUPPORTING_TOOLING_OR_TEST` | N/A | Testing assertions and mocks. | N/A |
| `docs/*`, `AGENTS.md`, `README.md` | `GOVERNANCE_OR_DOCUMENTATION` | N/A | Documentation artifacts. | N/A |

### cybrik-security-tool-fabric (RC1: 1a419014ebb432eb56ac35242e0a193fe65a62c6)

| Module Path / Name | Classification | Port / Protocol Boundary | Provider Neutrality Verification | Sovereignty & Isolation |
| --- | --- | --- | --- | --- |
| `src/control-plane/cybrik_fabric_control/contracts`, `invocation`, `registry` | `PRODUCT_CORE` | Internal Domain Ports | Represents fabric state, lifecycle, and capabilities. Zero cloud dependencies. | S4 Data Floor |
| `src/control-plane/cybrik_fabric_control/app.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` | HTTP, mTLS RFC 9068 | Implements the control plane HTTP listener with agnostic TLS handling. | S3 Infra Floor |
| `src/executor/internal/tier`, `version`, `boundary` | `PRODUCT_CORE` | Internal Domain Ports (Go Interfaces) | Executor security tiering and isolation rules; purely computational logic. | S4 Data Floor |
| `src/executor/cmd/executor` | `PRODUCT_IMPLEMENTATION_ADAPTER` | Local OS Syscalls, Stdio | Binds executor to standard OS process boundaries and pipes. | S2 Execution |
| `tests/*` | `SUPPORTING_TOOLING_OR_TEST` | N/A | Contract and conformance test suites. | N/A |
| `docs/*`, `src/README.md` | `GOVERNANCE_OR_DOCUMENTATION` | N/A | Documentation artifacts. | N/A |

## Resolution of OPEN-11

This map formally resolves OPEN-11 by completing the exhaustive per-module classification pass across all three product repositories at their RC1 commits. It ensures that the boundary definition from ADR-0015 §5.1 is preserved in full, and successfully validates that no repository is mono-classified as `PRODUCT_CORE` (INV-21).
