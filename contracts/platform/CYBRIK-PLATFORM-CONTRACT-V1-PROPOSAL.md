# Platform Contract Proposal (v1.0.0-proposed)

**Status:** PROPOSED
**Authoring Phase:** v0.1.0-proposed to v1.0.0-proposed (Architecture/governance proposal; no implementation authority).

## 1. Overview
This contract defines the 13 minimum capability slots (ADR-0015 §5.2) required to form the substrate for the CYBRIK Autonomous Security Operations platform. It serves as an architectural agreement detailing expectations between the control plane, data plane, and underlying platform capability providers.

This contract explicitly defines boundaries and non-goals to prevent capability bloat.

### Non-Goals & Boundaries
* **Does NOT** select a Kubernetes distribution (RKE2, K3s, OpenShift, etc. are NOT selected).
* **Does NOT** select a hypervisor (VMware, Proxmox, OpenStack, etc. are NOT selected).
* **Does NOT** select a cloud provider.
* **Does NOT** mutate product or infrastructure source code.
* **Does NOT** reopen RC1 or staging qualification.

## 2. Capability Slots

The platform requires 13 fundamental capability slots to operate. Providers MUST fulfill these to the levels required by their respective `VERSIONED_DEPLOYMENT_PROFILE`.

### Slot 1: OCI Image Runtime
A compliant runtime to execute Open Container Initiative images.

### Slot 2: Execution Isolation
Defines sandbox and isolation per ADR-0005 profiles. Required to run multi-tenant or untrusted workloads securely.

### Slot 3: Orchestration
Orchestration of compute and container life cycles.

### Slot 4: Network Segmentation & DNS Egress Guards
Network micro-segmentation capabilities and strict DNS-based egress controls to prevent data exfiltration.

### Slot 5: Persistent Storage & Minimum S3 Compatibility Subset
S3-compatible object storage requiring:
- CRUD operations
- Multipart upload
- Presigning
- SigV4 auth
- Path-style addressing
- Standard error codes
- Optional Object Lock/WORM per OPEN-2

### Slot 6: Relational Datastore
- PostgreSQL >= 16.4
- TLS enforced
- Dedicated roles
- RLS with NOBYPASSRLS

### Slot 7: In-Memory Cache / Key-Value
- Valkey 8+ / Redis 7.2+
- TLS enforced
- Authenticated
- `noeviction` eviction policy

### Slot 8: Secret Management
Requires customer-controlled secret boundaries (e.g., dedicated KMS, HSM, or strictly bounded secret domains).

### Slot 9: Identity & Workload Authentication
Workload mTLS and scoped service identity bridging.

### Slot 10: Observability
- Prometheus metrics endpoint compatibility.
- Structured JSON logging.

### Slot 11: AI / Model Runtime
- Local/private model runtime (e.g., vLLM/Ollama).
- Model provenance validation.
- Airgap capability.
- Optional cloud fallback with circuit breaker.

### Slot 12: Sovereign Cross-Domain Exchange & Hybrid Controls
- `SOVEREIGN_CONTROLLED_CROSS_DOMAIN_EXCHANGE`.
- Strict default-deny egress policies across sovereign boundaries.

### Slot 13: Artifact & Offline Update Mechanism
- Signed offline bundles.
- Operator trust root validation.
- Offline installation support.
- Migration reversibility.
- Rollback capability (per OPEN-1).

## 3. VERSIONED_DEPLOYMENT_PROFILE Specification (INV-17)

A `VERSIONED_DEPLOYMENT_PROFILE` specifies a concrete set of configurations against the 13 slots.

### Structure
* **profile_id**: String identifier.
* **profile_version**: Semver version of the profile.
* **capability_set**: Key-value mappings mapping the 13 slots to specific constraints.
* **strength**: Specification of which slots are `MANDATORY` or `OPTIONAL` for the profile.
* **sovereignty_class**: E.g., `PUBLIC`, `SOVEREIGN`, `AIRGAP`.
* **isolation_floor**: The minimum execution isolation level required (mapping to ADR-0005).

## 4. Canonical Tier Semantics Normalization (OPEN-4)

To prevent confusion, the following orthogonal axes are strictly disambiguated:
* **DATA_PLANE_CAPACITY_TIER**: Focuses strictly on throughput, capacity, and scaling limits (e.g., T0, T1, T2).
* **ISOLATION_TIER**: Focuses strictly on sandboxing technologies, boundary enforcement, and workload isolation levels (ADR-0005).
* **VERSIONED_DEPLOYMENT_PROFILE**: Defines the conformance subject, packaging the deployment requirements (slots + capabilities).

## 5. Optional Provider Capability Negotiation Protocol (OPEN-5)

To allow platform environments to auto-discover capabilities without manual hardcoding, an optional negotiation protocol is defined:
* **Namespaced Provider Capabilities**: Capabilities are advertised in strict namespaces to avoid collision.
* **Capability Advertisement Schema**: A structured JSON mechanism (`cybrik.provider-capability-advertisement.v1.schema.json`) for the platform to declare its supported extensions (e.g., Object Lock).
* **Fail-Closed Discovery**: If discovery fails or is unsupported, the platform defaults to assuming the minimum baseline capability is absent, requiring manual overrides or failing safely.
