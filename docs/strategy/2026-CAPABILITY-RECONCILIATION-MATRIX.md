# 2026 Canonical Capability Reconciliation Matrix

- **Document Version:** 1.0.0
- **Effective Date:** 2026-09-04
- **Classification:** CYBRIK Platform Architecture & Strategy Contract
- **Target Release:** CYBRIK Suite 2026 Full Competitive Release (Feature Complete 2026-11-15, Release 2026-12-31)
- **Status:** `PROPOSED — READY FOR CANONICAL MERGE (COHORT_2026_01_IN_AUDIT_REMEDIATION)`

---

## 1. Executive Context & Invariants

This matrix establishes the authoritative, cross-product reconciliation for the **10 Canonical Capability Pillars** defined in [`docs/strategy/06-ROADMAP-2026-2029.md`](docs/strategy/06-ROADMAP-2026-2029.md). 

Under the CYBRIK 2026 Full Competitive Release mandate:
1. **Zero-Mock Rule:** No capability may be delivered as a mock, synthetic-only stub, or permanent "preview". Every production pathway must satisfy typed JSON Schema contracts (Draft 2020-12), end-to-end integration tests, and verifiable evidence.
2. **Triad Product Ownership:**
   - **`cybrik-soc-command-center` (Lane A):** System of Record for alerts, cases, assets, IOCs, tenant RBAC, audit viewers, and analyst investigation workspaces.
   - **`cybrik-cyber-ai-platform` (Lane B):** Local multi-runtime model execution, hybrid RAG, STIX 2.1 CTI fusion, bounded durable multi-agent orchestration, and golden/adversarial evaluation.
   - **`cybrik-security-tool-fabric` (Lane C):** Signed capability registry, REST/MCP tool gateway, S1/S2 sandbox execution, credential/egress brokering, four-eyes approval engine, and immutable execution receipt ledgers.
   - **`cybrik-suite` (Lane D / Meta):** Vendor-neutral contracts, integration test harnesses, release packaging, and deployment profiles (T0/T1/T2).
3. **Competitive Parity Baseline:** Every pillar is reconciled against major enterprise platforms—Splunk Enterprise Security, Microsoft Sentinel / Security Copilot, Palo Alto Networks Cortex XSIAM, Torq Hyperautomation, and CrowdStrike Charlotte AI—specifically addressing air-gapped sovereignty, verifiable provenance, and fail-closed safety.

---

## 2. 10 Canonical Pillars Reconciliation Matrix

| # | Canonical Pillar | Core Contract Schemas | Triad Repository Mapping | Implementation State | Verification Evidence | Competitive Parity vs. Enterprise Closed Platforms |
|---|---|---|---|---|---|---|
| **1** | **Local LLM Runtime & Multi-Model Routing** | `cybrik.ai-bom.v1.schema.json`<br>`cybrik.model-inference-request.v1.schema.json`<br>`cybrik.model-capability.v1.schema.json` | `cybrik-cyber-ai-platform`<br>`cybrik-suite` | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(T0/T1/T2 Runtimes: vLLM, Ollama, llama.cpp, Triton, Stub) | `test_stub_adapter.py`<br>`test_ollama_adapter.py`<br>`test_competitive_schemas.py` | Targets sovereign air-gap isolation and cryptographic AI-BOM model provenance without cloud egress dependencies. |
| **2** | **Policy-Enforced RAG & Data Ingestion** | `cybrik.ai-bom.v1.schema.json`<br>`cybrik.data-marking.v1.schema.json`<br>`cybrik.org-scope-grant.v1.schema.json` | `cybrik-cyber-ai-platform`<br>`cybrik-soc-command-center` | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(PostgreSQL + pgvector, quarantine, classification filter) | `test_marking.py`<br>`test_egress.py`<br>`validate-runtime-admission.test.mjs` | Implements policy-enforced pre-ranking tenant isolation, TLP filtering, and offline knowledge pack updates. |
| **3** | **Threat Intelligence & Structured CTI** | `cybrik.stix-cti-bundle.v1.schema.json`<br>`cybrik.data-marking.v1.schema.json` | `cybrik-cyber-ai-platform`<br>`cybrik-soc-command-center` | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(STIX 2.1, ATT&CK, CVE, CISA KEV, TAXII 2.1) | `test_competitive_schemas.py`<br>`cybrik.stix-cti-bundle.v1.schema.json`<br>MISP/OpenCTI offline importer | Aligns with STIX 2.1 specifications, CISA KEV ransomware tracking, ATT&CK technique pinning, and cryptographic citation linking. |
| **4** | **Bounded Durable Multi-Agent Orchestrator** | `cybrik.investigation-bundle.v1.schema.json`<br>`cybrik.investigation-checkpoint.v1.schema.json`<br>`cybrik.investigation-create-request.v1.schema.json` | `cybrik-cyber-ai-platform`<br>`cybrik-soc-command-center` | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(Durable state machine, checkpoints, replay, contradiction detection) | `test_orchestration_controller.py`<br>`test_orchestration_checkpoints.py`<br>`test_investigation_service.py` | Provides deterministic checkpoint recovery, step/token resource bounds, explicit abstention semantics, and investigation graph bundles. |
| **5** | **Signed Capability Registry & MCP Gateway** | `cybrik.capability.v1.schema.json`<br>`cybrik.tool-execution-request.v1.schema.json`<br>`cybrik.svc-delegation-token.v1.schema.json` | `cybrik-security-tool-fabric`<br>`cybrik-suite` | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(REST / MCP 2025-11-25 gateway, signed manifest, kill switches) | `test_capability_conformance.py`<br>`test_wire_contracts.py`<br>`test_svc_delegation.py` | Implements Model Context Protocol (MCP 2025-11-25) gateway, SPIFFE delegation tokens, and cryptographic capability kill switches. |
| **6** | **Security Investigation Tool Packs** | `cybrik.soc-get-alert-context.v1.schema.json`<br>`cybrik.tool-execution-result.v1.schema.json` | `cybrik-security-tool-fabric`<br>`cybrik-soc-command-center` | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(R0–R3 typed packs: SIEM, OpenSearch, Wazuh, IOC, CVE, PCAP) | `test_alert_context_conformance.py`<br>`validate-alert-context-transport.test.mjs` | Provides scoped security query bindings, structured alert context, and stdout redaction. |
| **7** | **Isolated Analysis Sandbox** | `cybrik.execution-receipt.v1.schema.json`<br>`cybrik.common-defs.v1.schema.json` ($defs/isolationProfile) | `cybrik-security-tool-fabric` | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(S0 pooled, S1/S2 disposable container, network-isolated) | `test_fabric_partition.py`<br>`test_validate_evidence_chain.py` | Defines lightweight S1/S2 disposable execution profiles, archive decompression ratio guards, and derived artifact provenance hashes. |
| **8** | **Detection Engineering Lifecycle** | `cybrik.capability.v1.schema.json`<br>`cybrik.investigation-bundle.v1.schema.json` | `cybrik-security-tool-fabric`<br>`cybrik-soc-command-center`<br>(Fabric control plane & SOC detection bridge) | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(Sigma, YARA, YARA-X, Suricata compile/replay/test/rollback) | `test_scaffold_integrity.py`<br>`validate-platform-contract.test.mjs` | Provides syntax compilation via native tooling, false-positive backtesting design, and signed rule rollback mechanisms. |
| **9** | **Controlled Action & Approval Broker** | `cybrik.approval-request.v1.schema.json`<br>`cybrik.approval-decision.v1.schema.json`<br>`cybrik.execution-receipt.v1.schema.json` | `cybrik-security-tool-fabric`<br>`cybrik-soc-command-center` | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(R0–R3 risk tiers, four-eyes gate, credential/egress broker, A4) | `test_policy.py`<br>`test_egress.py`<br>`validate-receipt-integrity.test.mjs` | Enforces R0-R3 risk tiers, multi-party four-eyes approval workflow, ephemeral credential leases, and fail-closed execution bounds. |
| **10** | **Immutable Audit, AI-BOM & Evaluation** | `cybrik.execution-receipt-ledger.v1.schema.json`<br>`cybrik.ai-bom.v1.schema.json`<br>`cybrik.receipt-trust-bundle.v1.schema.json` | `cybrik-suite`<br>`cybrik-security-tool-fabric`<br>`cybrik-cyber-ai-platform` | **IMPLEMENTED_UNINTEGRATED (IN_AUDIT_REMEDIATION)**<br>(Merkle hash ledger, AI-BOM, golden/adversarial eval suites) | `test_competitive_schemas.py`<br>`test_receipt_integrity.py`<br>`validate-receipt-trust-durability.test.mjs` | Implements append-only Merkle receipt ledgers, cryptographic replay verification, golden evaluation suites, and AI-BOM supply-chain manifests. |

---

## 3. Deep-Dive Pillar Analysis & Technical Realization

### Pillar 1: Local LLM Runtime & Multi-Model Routing
- **Architectural Seam:** Inference Transport Binding Profile ([`ADR-0011`](file:///Users/hoanglinh/Claude/Projects/soc-autonomous-state/worktrees/wt-open-contracts-consolidation/docs/adr/ADR-0011-inference-plane-transport-binding-profile.md)).
- **Hardware Profiles:**
  - **T0 (Developer):** Apple Silicon / Linux Workstation (32GB Unified Memory, GGUF/Ollama / llama.cpp runtime, Qwen-2.5-Coder-14B / 32B-Instruct-Q4).
  - **T1 (On-Premises Single-Node):** 1x-2x NVIDIA RTX 4090 / A6000 Ada (48-96GB VRAM, vLLM / AWQ, Qwen-2.5-72B-Instruct-AWQ).
  - **T2 (Sovereign Air-Gap Cluster):** 4x-8x NVIDIA H100/H200 NVLink (vLLM / Triton, Tensor Parallelism = 4/8, Qwen-2.5-72B / DeepSeek-V2.5).
- **AI-BOM Integration:** Pinned by `cybrik.ai-bom.v1.schema.json` capturing exact weights SHA-256 digests, SPDX license terms, runtime engine constraints, and prompt registry hashes.
- **Fail-Closed Routing:** Model routing degrades gracefully to deterministic rule-based triage when VRAM or inference latency SLOs are breached.

### Pillar 2: Policy-Enforced RAG & Incremental Ingestion
- **Storage Substrate:** PostgreSQL 16 + pgvector with HNSW indexing and hybrid reciprocal rank fusion (BM25 + vector cosine distance).
- **Tenant & Marking Guard:** Strict pre-retrieval filtering applying `cybrik.data-marking.v1.schema.json` (TLP level, classification, purpose limitation, tenant isolation). Raw alerts are never ingested verbatim without redaction and scope binding.
- **Air-Gap Knowledge Packs:** Versioned, signed offline archives containing MITRE ATT&CK Enterprise v15+, CISA KEV catalog, and CVE vulnerability databases.

### Pillar 3: Threat Intelligence & Structured CTI (STIX 2.1)
- **Unified Contract:** `cybrik.stix-cti-bundle.v1.schema.json` enforces RFC-compliant STIX 2.1 bundle formatting with rich typed extensions for:
  - MITRE ATT&CK tactics, techniques, and sub-techniques (`attack-pattern`).
  - Vulnerability definitions with CVSS v3.1 scoring and CISA KEV ransomware campaign flags (`vulnerability`).
  - Threat indicators with Sigma/YARA pattern types and validity windows (`indicator`).
  - Adversary groups, aliases, and motivations (`threat-actor`).
  - Semantic relationships and sightings (`relationship`).
- **Citation Linking:** Citations in `cybrik.investigation-bundle.v1.schema.json` bind directly to CTI indicators with SHA-256 content digests.

### Pillar 4: Bounded Durable Multi-Agent Orchestrator
- **State Machine Architecture:** State checkpoints serialized via `cybrik.investigation-checkpoint.v1.schema.json` into PostgreSQL durable stores.
- **Specialized Roles:**
  - **Triage Agent:** Scopes alert context, queries asset inventory, checks CTI reputation.
  - **Forensic Investigation Agent:** Reconstructs attack timeline, queries SIEM logs, evaluates sandbox artifacts.
  - **Hypothesis Formulation & Contradiction Agent:** Evaluates competing hypotheses, flags counter-evidence, triggers explicit abstention when data is incomplete.
  - **Detection Engineer Agent:** Drafts Sigma/YARA candidate rules based on observed indicators.
  - **Response Planner Agent:** Formulates reversible containment proposals (R3) under strict policy approval.
- **Resource Envelope:** Guaranteed bounded execution governed by max iterations (default: 20), token budget ceilings, wall-clock timeouts, and explicit cancellation listeners.

### Pillar 5: Signed Capability Registry & REST/MCP Gateway
- **Specification Pin:** Model Context Protocol (MCP) version `2025-11-25` and OpenAPI 3.1.x.
- **Security Primitives:**
  - Every capability is registered with a cryptographic digest (`cybrik.capability.v1.schema.json`).
  - Workload identity delegation via SPIFFE IDs and signed tokens (`cybrik.svc-delegation-token.v1.schema.json`).
  - Granular emergency kill switches at global, tenant, tool, and action levels.

### Pillar 6: Security Investigation Tool Packs
- **Canonical Tool Families:**
  - `cybrik.siem.search_events.v1`: Scoped OpenSearch/Wazuh/Elastic log search.
  - `cybrik.cti.lookup_indicator.v1`: Fast STIX 2.1 / MISP / OpenCTI reputation queries.
  - `cybrik.cve.lookup_vulnerability.v1`: CVE and CISA KEV exploit lookup.
  - `cybrik.attack.lookup_technique.v1`: MITRE ATT&CK technique and mitigation retrieval.
  - `cybrik.asset.get_identity.v1`: Scoped asset context, IP/MAC history, owner identity.
  - `cybrik.case.update_evidence.v1`: Bidirectional sync with SOC case management.

### Pillar 7: Isolated Analysis Sandbox
- **Isolation Profiles:**
  - **S0 (Pooled):** Long-lived read-only metadata inspection (R0 only).
  - **S1 (Disposable Container):** Ephemeral Linux container, strictly zero network egress, read-only rootfs, 512MB RAM cap, 1 CPU cap, 60s timeout for static log/archive/PE analysis.
  - **S2 (Isolated Network Emulation):** Ephemeral sandbox with sinkholed DNS/HTTP for dynamic PCAP replay and Suricata inspection.
- **Anti-Evasion & Safety:** Strict archive decompression recursion limits (max depth: 3), decompression ratio guards (max 100:1), and device/symlink sanitization.

### Pillar 8: Detection Engineering Lifecycle
- **End-to-End Pipeline:**
  1. *Authoring:* Agent drafts Sigma, YARA, YARA-X, or Suricata rules based on investigation graph nodes.
  2. *Compilation & Linting:* Verification via native compilers (`sigma-cli`, `yara-x`, `suricata -t`).
  3. *Historical Backtesting:* Replay against indexed telemetry in the data plane to calculate true positive and false positive rates.
  4. *Signing & Packaging:* Content packages cryptographically signed by the Detection Authority.
  5. *Rollback Mechanism:* Reversible state transition with zero-downtime rule deactivation.

### Pillar 9: Controlled Action & Approval Broker
- **Risk Classification:**
  - **R0 (Read-Metadata):** Scoped alert/asset lookups. Auto-approved under tenant policy.
  - **R1 (Read-Data):** SIEM log queries, file extraction. Auto-approved with rate limiting and audit logging.
  - **R2 (Active Observation):** Live host polling, port scan probe. Requires SOC policy match.
  - **R3 (Reversible Containment):** Temporary host isolation, firewall block, account lockout. Requires mandatory multi-party ("four-eyes") approval, resolved argument binding, TTL expiration, and automated rollback plan.
  - **R4 (Destructive / Irreversible):** Strictly disabled by default in all production profiles.
- **Credential & Egress Broker:** Single-use credential leases generated on-demand with 60s TTL; executors never hold permanent API keys or service tokens.

### Pillar 10: Immutable Audit, Receipt Ledger, Golden Eval & AI-BOM
- **Execution Receipt Ledger:** Governed by `cybrik.execution-receipt-ledger.v1.schema.json`.
  - Append-only sequence numbers linked by rolling SHA-256 hash chains and binary Merkle trees.
  - Control-plane cryptographic signatures (Ed25519 / ECDSA-P256) verifying every block.
  - Structural replay allows complete independent audit of every decision and tool execution.
- **Evaluation & AI-BOM:**
  - Golden evaluation harness executing nightly regression tests across sanitized real-world attack scenarios.
  - Adversarial injection suites verifying prompt injection resistance, data exfiltration guards, and hallucination bounds.
  - AI-BOM manifest generated with every model deployment ensuring 100% supply-chain traceability.

---

## 4. Eight Core Integration Packs Status

| # | Integration Pack | Target Standard / Systems | Implementation State | Verification Method |
|---|---|---|---|---|
| **1** | **CYBRIK Native** | Alert, Case, Asset, IOC, Audit, Data Plane | **IN_DEVELOPMENT (COHORT_2026_01)** | `test_soc_ai_lifecycle_create.py`, `validate-alert-context.test.mjs` |
| **2** | **Event / SIEM** | OpenSearch, Wazuh, Syslog, CEF, OCSF | **IN_DEVELOPMENT (COHORT_2026_01)** | Conformance fixtures in `wt-impl-fabric-consolidated` |
| **3** | **Network Security** | Suricata, Security Onion, PCAP Replay | **IN_DEVELOPMENT (COHORT_2026_01)** | S2 sandbox replay harness, Suricata syntax compiler |
| **4** | **CTI** | STIX 2.1, TAXII 2.1, MISP, OpenCTI | **IN_DEVELOPMENT (COHORT_2026_01)** | `cybrik.stix-cti-bundle.v1.schema.json`, `test_competitive_schemas.py` |
| **5** | **Vulnerability & Knowledge** | CVE, CISA KEV, MITRE ATT&CK v15+ | **IN_DEVELOPMENT (COHORT_2026_01)** | STIX 2.1 vulnerability extension, offline knowledge packs |
| **6** | **Endpoint / Artifact** | Generic Artifact Intake, Host Isolation Adapter | **IN_DEVELOPMENT (COHORT_2026_01)** | S1 sandbox extractor, SHA-256 artifact manifest |
| **7** | **Response & Remediation** | OpenC2, Typed Webhook, Reversible Block | **IN_DEVELOPMENT (COHORT_2026_01)** | R3 approval broker, credential broker, TTL rollback |
| **8** | **Extensibility & SDK** | REST, MCP 2025-11-25, Connector SDK | **IN_DEVELOPMENT (COHORT_2026_01)** | `cybrik.capability.v1.schema.json`, conformance test kit |

---

## 5. Machine-Safe Execution DAG (Next Unblocked Steps)

The following deterministic Directed Acyclic Graph (DAG) defines the machine-safe execution sequence across all development lanes to guarantee 2026 Full Feature Complete:

```mermaid
flowchart TD
    subgraph Core_Contracts ["Phase 1: Canonical Contract Baseline (Cohort 2026-01 Remediation)"]
        C1["cybrik.investigation-bundle.v1.schema.json"]
        C2["cybrik.stix-cti-bundle.v1.schema.json"]
        C3["cybrik.ai-bom.v1.schema.json"]
        C4["cybrik.execution-receipt-ledger.v1.schema.json"]
        C_VAL["test_competitive_schemas.py (100% Pass)"]
        C1 --> C_VAL
        C2 --> C_VAL
        C3 --> C_VAL
        C4 --> C_VAL
    end

    subgraph Lane_B ["Lane B: Cyber AI Platform (Wave 2-3)"]
        B1["Investigation Graph & Bundle Assembled"]
        B2["STIX 2.1 CTI Offline Importer"]
        B3["Durable Orchestrator Contradiction Engine"]
        B4["AI-BOM Generator & Evaluator"]
        C_VAL --> B1
        C_VAL --> B2
        C_VAL --> B3
        C_VAL --> B4
    end

    subgraph Lane_C ["Lane C: Security Tool Fabric (Wave 3-4)"]
        F1["S1/S2 Sandbox Isolation Runners"]
        F2["Sigma/YARA Detection Lifecycle Engine"]
        F3["R3 Four-Eyes Approval Broker"]
        F4["Immutable Receipt Ledger Store"]
        C_VAL --> F1
        C_VAL --> F2
        C_VAL --> F3
        C_VAL --> F4
    end

    subgraph Lane_A ["Lane A: SOC Command Center (Wave 2-4)"]
        A1["Investigation Graph & Timeline Workspace"]
        A2["CTI Threat Intelligence Dashboard"]
        A3["Approval Inbox & Dry-Run Inspector"]
        A4["Audit Receipt & AI-BOM Ledger Viewer"]
        B1 --> A1
        B2 --> A2
        F3 --> A3
        F4 --> A4
    end

    subgraph Release_Assurance ["Phase 5: Release Packaging & Verification (Wave 5-6)"]
        R1["T0/T1/T2 Signed Offline Installer"]
        R2["Golden/Adversarial Evaluation Suite (1000 Cases)"]
        R3["Independent Penetration Test & PSIRT Drills"]
        R4["CYBRIK Suite v1.0 Full Competitive Release"]
        A1 --> R1
        A2 --> R1
        A3 --> R2
        A4 --> R2
        R1 --> R3
        R2 --> R3
        R3 --> R4
    end
```

### Deterministic DAG Action Items:
1. **DAG-01 (Contracts Merge):** Merge `feat/suite-competitive-schemas-and-aibom-v1` into suite canonical branch with all 4 validated Draft 2020-12 schemas and this matrix document.
2. **DAG-02 (Lane B Ingestion):** Wire `cybrik.stix-cti-bundle.v1` schema into Cyber AI CTI ingestion pipeline (`wt-cyber-ai-open3`) for offline STIX 2.1 / CISA KEV bundle import.
3. **DAG-03 (Lane B Graph):** Extend Cyber AI Investigation Projection to emit full `cybrik.investigation-bundle.v1` instances with nodes, edges, citations, and hypotheses.
4. **DAG-04 (Lane C Ledger):** Bind Tool Fabric execution receipt logger to produce `cybrik.execution-receipt-ledger.v1` Merkle tree segments upon batch sealing.
5. **DAG-05 (Lane C Sandbox):** Finalize S1 container isolation runtime with strict no-network, read-only, and memory resource constraints.
6. **DAG-06 (Lane A Workspace):** Render the full investigation knowledge graph and verifiable citation viewer in SOC Command Center frontend.

---

## 6. Verification and Acceptance Authority

- **Contract Conformance:** Validated via `python3 -m pytest tests/contracts/test_competitive_schemas.py` and `node tools/contract-validation/`.
- **Governing ADRs:** [`ADR-0001`](file:///Users/hoanglinh/Claude/Projects/soc-autonomous-state/worktrees/wt-open-contracts-consolidation/docs/adr/ADR-0001-suite-contract-versioning-policy.md) (Versioning), [`ADR-0002`](file:///Users/hoanglinh/Claude/Projects/soc-autonomous-state/worktrees/wt-open-contracts-consolidation/docs/adr/ADR-0002-cyber-ai-implementation-stack.md) (AI Stack), [`ADR-0004`](file:///Users/hoanglinh/Claude/Projects/soc-autonomous-state/worktrees/wt-open-contracts-consolidation/docs/adr/ADR-0004-tool-fabric-control-plane-executor-split.md) (Fabric Split), [`ADR-0006`](file:///Users/hoanglinh/Claude/Projects/soc-autonomous-state/worktrees/wt-open-contracts-consolidation/docs/adr/ADR-0006-cross-product-event-and-identity-model.md) (Identity & Events), [`ADR-0010`](file:///Users/hoanglinh/Claude/Projects/soc-autonomous-state/worktrees/wt-open-contracts-consolidation/docs/adr/ADR-0010-capability-name-canonicalization.md) (Capabilities), [`ADR-0014`](file:///Users/hoanglinh/Claude/Projects/soc-autonomous-state/worktrees/wt-open-contracts-consolidation/docs/adr/ADR-0014-receipt-trust-and-durability-profile.md) (Receipts), [`ADR-0015`](file:///Users/hoanglinh/Claude/Projects/soc-autonomous-state/worktrees/wt-open-contracts-consolidation/docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md) (Deployment Sovereignty).
