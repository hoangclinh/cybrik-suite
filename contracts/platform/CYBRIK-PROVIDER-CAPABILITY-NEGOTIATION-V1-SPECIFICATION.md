# CYBRIK Provider Capability Negotiation Specification (v0.1.0-proposed)

**Status:** PROPOSED (Open-Item OPEN-5 Elaboration) — NOT ACCEPTED
**Authoring Phase:** v0.1.0-proposed (Architecture contract proposal; no implementation or deployment authority)
**Decider:** FOUNDER
**Reference Target Schema:** [`contracts/json-schema/cybrik.provider-capability-negotiation.v1.schema.json`](../json-schema/cybrik.provider-capability-negotiation.v1.schema.json)
**Normative Governance Authority:** `cybrik-suite:docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md` §8.2, §8.3, §8.4; `contracts/platform/CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md` §6

---

## 1. Overview & Scope

### 1.1 Purpose
This normative specification defines the **Optional Provider Capability Negotiation Protocol (v1)**, addressing open item `OPEN-5` (`OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION`) delegated by ADR-0015 §8.4 and Platform Contract Proposal §6.

The protocol governs the dynamic advertisement, discovery, feature matching, graceful degradation, and lease issuance handshake between **CYBRIK Core** (the control plane and workload runtime consumer) and **Runtime Capability Providers** (underlying virtualization, orchestration, OS runtime, storage, and database deployment substrates).

### 1.2 Motivation
Static environment hardcoding introduces vendor coupling, violates substrate neutrality (`INV-10`), and creates configuration fragility across sovereign deployment tiers (`onprem-airgap-v1`, `onprem-standard-v1`, `private-cloud-v1`, `hybrid-sovereign-v1`). Conversely, unconstrained runtime dynamism introduces the risk of silent security degradation.

This protocol establishes a mathematically provable, fail-closed handshake mechanism:
1. Enabling dynamic auto-discovery of substrate features across heterogeneous infrastructure environments.
2. Permitting optional capabilities (e.g., hardware GPU acceleration, storage Object Lock, eBPF network fast-paths, distributed caching) to degrade gracefully to deterministic core fallbacks.
3. Enforcing an absolute fail-closed boundary on all mandatory capability slots and sovereign isolation guarantees.

### 1.3 Non-Goals & Boundaries
To prevent architectural drift and preserve strict SDLC boundaries, this specification:
* **Does NOT** select a cloud provider, hypervisor, or Kubernetes distribution (`ADR-0015` §14, `OPEN-6`, `OPEN-7`, `OPEN-8`).
* **Does NOT** mutate product or infrastructure source code.
* **Does NOT** authorize production deployment, release candidate promotion, or staging qualification.
* **Does NOT** permit degradation, weakening, or software-bypass of mandatory platform contract slots or isolation floors (`S0`–`S4`).
* **Does NOT** introduce unauthenticated, unverified, or ambient capability claims.

---

## 2. Normative Invariants & Boundary Rules

All protocol implementations, schema validators, and runtime adapters MUST strictly comply with the following architectural invariants:

### INV-NEG-01: Mandatory Slot Fail-Closed Invariant
The 9 core mandatory runtime capability slots specified in `ADR-0015` §5.2 and Platform Contract Proposal §3—as well as any additional slots declared `MANDATORY` by the referenced `VERSIONED_DEPLOYMENT_PROFILE`—**MUST NEVER** be degraded, negotiated down, substituted with a weaker posture, or omitted:
1. `oci_container_runtime` (Rootless posture, load-time image verification)
2. `isolation_substrate` (Structural isolation floor `S0`–`S4` per `ADR-0005`)
3. `network_segmentation` (Default-deny boundaries, DNS egress mediation seam)
4. `storage` (Minimum 14-operation S3-compatible subset per `OPEN-2`)
5. `database` (Relational ACID transactions, row-level security semantics)
6. `secrets` (Zero-exfiltration memory lifecycle, startup presence verification)
7. `crypto` (Pluggable provider seam, Ed25519/JCS signing per `ADR-0018`)
8. `identity_workload_identity` (E2/E3 mTLS + short-lived delegation token per `ADR-0006`/`ADR-0008`)
9. `artifact_update_mechanism` (RFC 8785 JCS offline manifest signature verification & rollback per `OPEN-1`)

If a provider fails to advertise, satisfy, or provide valid conformance evidence for ANY mandatory slot required by the target profile, CYBRIK Core **MUST** abort negotiation immediately with a terminal status (`TERMINAL_REJECTED`) and enforce `degradation_behavior: "FAIL_CLOSED"`.

### INV-NEG-02: Namespacing & Sovereign Isolation Invariant (`ADR-0015` §8.2)
1. **Namespace Isolation**: All provider-specific capabilities MUST be scoped under an explicit provider namespace (`provider_namespace` matching `^[a-z0-9][a-z0-9-_]*[a-z0-9]$`). Provider identifiers MUST NOT collide with core contract names.
2. **Sovereignty Non-Contamination**: Provider-specific capabilities MUST NOT alter customer data sovereignty policies (`ADR-0015` §7.1), cross-domain diode controls (`ADR-0017`), or transmit customer data outside sovereign boundaries.
3. **Authority Model Preservation**: Provider capabilities MUST NOT alter authority semantics (who signs, delegates, approves, or audits) or bypass workload identity boundaries (`ADR-0008`).
4. **Isolation Floor Preservation**: Provider capabilities MUST NOT lower the execution isolation floor or relax sandboxing guarantees established by `ADR-0005`.

### INV-NEG-03: Symmetry & Graceful Degradation on Optional Features (`ADR-0015` §8.3)
1. **Provider Optionality**: An optional capability missing from a provider adapter is NOT a defect and MUST NOT be reported as non-conformance (`INV-9`).
2. **Core Graceful Fallback**: When an optional capability (e.g., `ai_model_runtime` GPU acceleration, `storage` Object Lock, `cache` clustering, `observability` distributed tracing) is absent or unsupported, CYBRIK Core MUST gracefully degrade to a deterministic fallback strategy (`CORE_EMULATION_FALLBACK` or `FEATURE_DISABLED_GRACEFUL`).
3. **Transparent Lease Disposition**: The resulting capability lease MUST explicitly record the granted disposition (`GRANTED_FULL`, `GRANTED_DEGRADED`, `REJECTED_UNSUPPORTED`) and the exact fallback strategy applied for each negotiated optional feature.

### INV-NEG-04: Cryptographic Evidence & Finite Lease Invariant
1. **Evidence Binding**: Every advertised capability (mandatory or optional) MUST explicitly reference valid, non-vacuous conformance test identifiers (`evidence_references`) present in the `conformance_evidence` array.
2. **Finite Lease Lifespan**: Agreements are issued as finite `agreed_capability_lease` tokens with explicit `issued_at`, `expires_at`, and `lease_ttl_seconds` (max 86,400 seconds / 24 hours). Unrenewed or expired leases MUST be rejected.
3. **Replay & Injection Defense**: Handshakes MUST include cryptographically random client nonces (`client_nonce`) and server nonces (`server_nonce`) to prevent replay, pre-computation, or cross-session capability injection.

---

## 3. Protocol Handshake Sequence & State Machine

The negotiation handshake executes as a three-phase exchange between CYBRIK Core and the Target Provider Adapter:

```
+----------------+                                   +-------------------+
|  CYBRIK Core   |                                   |  Provider Adapter |
+----------------+                                   +-------------------+
       |                                                       |
       |  Phase 1: NegotiationRequest (Initiation)             |
       |------------------------------------------------------>|
       |  - target_profile_id & digest                         |
       |  - requested_slots (mandatory baseline)               |
       |  - requested_optional_capabilities & fallbacks        |
       |  - client_nonce                                       |
       |                                                       |
       |  Phase 2: AdvertisementResponse (Advertisement)       |
       |<------------------------------------------------------|
       |  - claim_type (FULL / PARTIAL)                        |
       |  - advertised_capabilities (with fallback modes)      |
       |  - conformance_evidence (test identifiers & reports)  |
       |  - server_nonce, authenticated_discovery: true        |
       |                                                       |
       | [Core Evaluation & Evidence Verification]             |
       |  - Check all mandatory slots satisfied                |
       |  - Verify evidence references & profile digest        |
       |  - Compute optimal vs degraded feature assignments   |
       |                                                       |
       |  Phase 3: AgreedCapabilityLease (Lease Grant/Reject)  |
       |------------------------------------------------------>|
       |  - lease_id, TTL, issued_at / expires_at              |
       |  - lease_status (ACTIVE_OPTIMAL / ACTIVE_DEGRADED)    |
       |  - mandatory_slots_satisfied                          |
       |  - negotiated_optional_capabilities & active modes    |
       v                                                       v
```

### 3.1 Handshake Phases

#### Phase 1: Negotiation Initiation (`negotiation_request`)
CYBRIK Core initiates the handshake upon substrate boot or scheduled lease renewal. The request contains:
* `request_id`: Unique correlation UUID for the handshake.
* `timestamp`: RFC 3339 UTC timestamp.
* `target_profile_id` & `target_profile_version`: The target deployment profile (e.g. `onprem-standard-v1`).
* `requested_slots`: Explicit list of required platform slots (minimum 9 core slots).
* `requested_optional_capabilities`: Desired optional features with priority levels and preferred fallback modes.
* `client_nonce`: High-entropy nonce (16–64 alphanumeric/hex characters).
* `degradation_policy`: Fallback policy (`FAIL_CLOSED_ON_MANDATORY_GRACEFUL_ON_OPTIONAL` or `FAIL_CLOSED_STRICT`).

#### Phase 2: Capability Advertisement (`advertisement_response`)
The Provider Adapter responds with its supported capabilities:
* `response_id`: Unique response identifier.
* `timestamp`: RFC 3339 UTC timestamp.
* `server_nonce`: High-entropy server nonce.
* `claim_type`: `FULL_PROFILE_CONFORMANCE_DECLARATION` or `PARTIAL_CAPABILITY_ADVERTISEMENT`.
* `advertised_capabilities`: Array of capability descriptors declaring `slot_id`, `is_mandatory`, `supported_features`, `degradation_fallback` details, and `evidence_references`.
* `conformance_evidence`: Concrete test execution records (`test_identifier`, `verification_method`, `report_uri`).
* `authenticated_discovery: true`: Enforces mutual authentication on discovery seam.
* `degradation_behavior: "FAIL_CLOSED"`: Provider-side fail-closed guarantee.

#### Phase 3: Capability Resolution & Lease Grant (`agreed_capability_lease`)
CYBRIK Core validates the response:
1. Verifies the `server_nonce` and authenticates the provider.
2. Checks that every slot required by the target profile is advertised and backed by valid conformance evidence. If any mandatory slot is missing, negotiation fails closed (`REJECTED_FAIL_CLOSED`).
3. For each requested optional capability, determines whether it can be granted in full (`GRANTED_FULL`) or degraded (`GRANTED_DEGRADED`) to a valid core fallback mode.
4. Issues the signed/authenticated `agreed_capability_lease` containing active runtime configuration.

### 3.2 Protocol State Machine

```
      +------------------------+
      |      DISCONNECTED      |
      +------------------------+
                  |
                  | Send NegotiationRequest
                  v
      +------------------------+
      |       NEGOTIATING      |
      +------------------------+
                  |
                  | Receive AdvertisementResponse
                  v
      +------------------------+
      |   EVALUATING_EVIDENCE  |
      +------------------------+
         /         |          \
        /          |           \
 [Mandatory Fail]  |            \ [All Mandatory OK +
 [or Evidence Bad] |             \ Optional Degraded]
      /            |              \
     v             |               v
+------------+     |       +-------------------+
|  TERMINAL  |     |       |      ACTIVE       |
|  REJECTED  |     |       |     DEGRADED      |
+------------+     |       +-------------------+
 (Fail Closed)     |                 |
                   v                 |
          +-------------------+      |
          |      ACTIVE       |      |
          |      OPTIMAL      |      |
          +-------------------+      |
                   \                 /
                    \               /  TTL Expired / Re-negotiate
                     v             v
                +---------------------+
                |    LEASE_EXPIRED    |
                +---------------------+
```

| State | Invariant Condition | Resulting Operational Posture |
|---|---|---|
| `NEGOTIATING` | Handshake initiated, awaiting provider response. | Workloads blocked from initialization. |
| `EVALUATING_EVIDENCE` | Response received; core performing structural & evidence checks. | Workloads blocked; fail-closed timeout active. |
| `ACTIVE_OPTIMAL` | All mandatory slots valid; all requested optional capabilities granted full support. | Full performance / full feature operation. |
| `ACTIVE_DEGRADED` | All mandatory slots valid; one or more optional capabilities degraded to fallback. | Normal operation under documented fallback constraints. |
| `TERMINAL_REJECTED` | Any mandatory slot missing, unauthenticated, or invalid evidence. | Zero workload execution; system fails closed. |
| `LEASE_EXPIRED` | Lease TTL elapsed without successful renewal. | Workload paused / immediate fail-closed teardown. |

---

## 4. Graceful Degradation Taxonomy & Fallback Matrix

When an optional capability is not offered or cannot be verified, the handshake MUST resolve to a deterministic fallback mode per the following normative matrix:

| Slot # | Capability Slot | Mandatory Core Baseline (No Degradation Allowed) | Optional Substrate Feature | Graceful Degradation Fallback Mode |
|---|---|---|---|---|
| **Slot 1** | `oci_container_runtime` | OCI compliance, rootless execution, image digest verification | Advanced CRI hardware offload / custom runtime plugins | `CORE_EMULATION_FALLBACK`: Fall back to standard rootless `runc`/`crun` runner. |
| **Slot 2** | `isolation_substrate` | Profile isolation floor (`S0`–`S4`) per `ADR-0005` | Direct KVM / nested microVM hardware acceleration | `CORE_EMULATION_FALLBACK`: Fall back to software-isolated sandbox if within profile floor; otherwise `TERMINAL_REJECTED`. |
| **Slot 3** | `orchestration_capability` | Basic scheduling, readiness/liveness probes, health lifecycle | Topology spread constraints, dynamic pod autoscaling | `FEATURE_DISABLED_GRACEFUL`: Fall back to static replica counts and standard round-robin scheduling. |
| **Slot 4** | `network_segmentation` | Default-deny network policy, segment boundaries, DNS egress mediation | eBPF kernel fast-path bypass, hardware network encryption | `CORE_EMULATION_FALLBACK`: Fall back to kernel iptables / standard netfilter firewalling. |
| **Slot 5** | `storage` | 14 mandatory S3 operations (`OPEN-2`), SigV4, path-style addressing | Object Lock / WORM retention headers | `FEATURE_DISABLED_GRACEFUL`: Application-layer SHA-256 integrity verification; object lock disabled. |
| **Slot 6** | `database` | Relational datastore, ACID transactions, row-level security (RLS) | Read-replica auto-routing, sharded clustering | `CORE_EMULATION_FALLBACK`: Fall back to single primary transaction pool with read-after-write consistency. |
| **Slot 7** | `cache` | In-memory key-value cache, predictable consistency, `noeviction` | Multi-node cluster replication | `FEATURE_DISABLED_GRACEFUL`: Fall back to standalone single-node cache instance with in-memory fallback. |
| **Slot 8** | `secrets` | Secret storage, rotation hooks, zero exfiltration, startup presence check | Hardware HSM envelope key wrapping | `CORE_EMULATION_FALLBACK`: Fall back to software envelope encryption with operator-injected master secret. |
| **Slot 9** | `crypto` | Pluggable crypto seam, Ed25519/JCS signing (`ADR-0018`) | Post-quantum hybrid cipher suites, hardware PKCS#11 | `CORE_EMULATION_FALLBACK`: Fall back to standard RFC 8785 Ed25519 software cryptographic module. |
| **Slot 10** | `identity_workload_identity` | E2/E3 mTLS, short-lived delegation token (`ADR-0008`) | Dynamic SPIRE/SPIFFE workload attestation server | `CORE_EMULATION_FALLBACK`: Fall back to static certificate-bound bootstrap token authentication. |
| **Slot 11** | `observability` | Sovereign structured logging, standard metrics | External OpenTelemetry collector egress export | `FEATURE_DISABLED_GRACEFUL`: Fall back to sovereign local append-only log files; remote egress disabled. |
| **Slot 12** | `ai_model_runtime` | Sovereign local model execution, loopback DNS guard (`ADR-0015` §7.3) | Hardware GPU / NPU tensor acceleration | `CORE_EMULATION_FALLBACK`: Fall back to local CPU tensor runtime (quantized) with adjusted latency budget. |
| **Slot 13** | `artifact_update_mechanism` | Signed offline bundles, RFC 8785 signature verify, rollback (`OPEN-1`) | Live delta binary streaming | `FEATURE_DISABLED_GRACEFUL`: Fall back to full signed offline bundle package installation. |

### 4.1 Prohibited Degradation Attempts
Any attempt to negotiate a degradation on a mandatory baseline (such as permitting public cloud model egress, relaxing default-deny network rules, bypassing database ACID guarantees, or executing as root) is **STRICTLY PROHIBITED** and MUST result in an unrecoverable `TERMINAL_REJECTED` handshake state.

---

## 5. Message Schema Formalization

The negotiation handshake document structure is formalized in JSON Schema 2020-12 at [`contracts/json-schema/cybrik.provider-capability-negotiation.v1.schema.json`](../json-schema/cybrik.provider-capability-negotiation.v1.schema.json).

### 5.1 Document Root Structure
A capability negotiation handshake document captures the complete tripartite interaction:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json",
  "handshake_id": "hs-9f8a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "protocol_version": "1.0.0",
  "provider_namespace": "cybrik-reference",
  "target_profile_id": "onprem-standard-v1",
  "target_profile_version": "1.0.0",
  "target_profile_digest": "190dbf1dfaa6c153646f6eee6f7e6535cf84e736d25d039d0f8ec3bb564f7a9f",
  "negotiation_status": "DEGRADED_LEASE_GRANTED",
  "negotiation_request": { ... },
  "advertisement_response": { ... },
  "agreed_capability_lease": { ... },
  "evidence_binding_verified": true
}
```

### 5.2 Field Constraints & Definitions

| Path | Type | Constraints / Invariant | Description |
|---|---|---|---|
| `/handshake_id` | `string` | Min length 1, pattern `^[a-z0-9_-]+$` | Unique correlation ID for the handshake session. |
| `/protocol_version` | `string` | Const `"1.0.0"` | Semver version of the negotiation protocol. |
| `/provider_namespace` | `string` | Pattern `^[a-z0-9][a-z0-9-_]*[a-z0-9]$` | Authoritative namespace identifier of the provider. |
| `/target_profile_id` | `string` | Enum `["onprem-standard-v1", "onprem-airgap-v1", "private-cloud-v1", "hybrid-sovereign-v1"]` | Target deployment profile being negotiated against. |
| `/target_profile_version` | `string` | Const `"1.0.0"` | Version of the deployment profile. |
| `/target_profile_digest` | `string` | Pattern `^[a-f0-9]{64}$` | SHA-256 digest of the referenced deployment profile artifact. |
| `/negotiation_status` | `string` | Enum `["AGREED_LEASE_GRANTED", "DEGRADED_LEASE_GRANTED", "TERMINAL_REJECTED"]` | Final outcome status of the negotiation handshake. |
| `/negotiation_request/requested_slots` | `array` | MinItems 9, MaxItems 13, unique items | List of required slots (must include 9 core mandatory slots). |
| `/negotiation_request/client_nonce` | `string` | Pattern `^[a-zA-Z0-9_-]{16,64}$` | Client replay-prevention nonce. |
| `/advertisement_response/server_nonce` | `string` | Pattern `^[a-zA-Z0-9_-]{16,64}$` | Server replay-prevention nonce. |
| `/advertisement_response/claim_type` | `string` | Enum `["PARTIAL_CAPABILITY_ADVERTISEMENT", "FULL_PROFILE_CONFORMANCE_DECLARATION"]` | Scope of the capability claim. |
| `/advertisement_response/authenticated_discovery` | `boolean` | Const `true` | Enforces authenticated discovery seam. |
| `/advertisement_response/degradation_behavior` | `string` | Const `"FAIL_CLOSED"` | Provider-side fail-closed degradation declaration. |
| `/agreed_capability_lease/lease_ttl_seconds` | `integer` | Minimum 1, Maximum 86400 | Authorized lifespan of the capability lease. |
| `/agreed_capability_lease/mandatory_slots_satisfied` | `array` | MinItems 9, MaxItems 13, unique items | Array of verified mandatory slot identifiers. |
| `/agreed_capability_lease/fail_closed_violations` | `array` | Array of strings | Must be empty for active leases; non-empty for rejected handshakes. |
| `/evidence_binding_verified` | `boolean` | `true` when lease is granted | Verification marker confirming all evidence references resolved. |

---

## 6. Normative Two-Phase Validation Requirement

To be deemed valid, any capability negotiation document or runtime handshake exchange MUST pass a strict two-phase validation sequence:

### Phase 1: Structural JSON Schema Validation
1. Document MUST validate without error against `cybrik.provider-capability-negotiation.v1.schema.json` (JSON Schema 2020-12).
2. Document MUST adhere to all `additionalProperties: false` object closures.
3. All format constraints (RFC 3339 timestamps, SHA-256 hex patterns, namespace identifiers) MUST pass strict regex verification.

### Phase 2: Semantic Conformance & Referential Integrity
1. **Evidence Referential Integrity (`SR-NEG-01`)**: Every item in `evidence_references` within `advertisement_response.advertised_capabilities` MUST resolve to an exact `test_identifier` defined in `advertisement_response.conformance_evidence`.
2. **Profile Digest Matching (`SR-NEG-02`)**: `target_profile_digest` MUST exactly match the SHA-256 hash of the on-disk `contracts/examples/platform/<target_profile_id>.profile.json` document.
3. **Mandatory Slot Completeness (`SR-NEG-03`)**: For any granted lease (`AGREED_LEASE_GRANTED` or `DEGRADED_LEASE_GRANTED`), `agreed_capability_lease.mandatory_slots_satisfied` MUST contain all 9 mandatory slots:
   * `oci_container_runtime`, `isolation_substrate`, `network_segmentation`, `storage`, `database`, `secrets`, `crypto`, `identity_workload_identity`, `artifact_update_mechanism`.
4. **Degradation Integrity (`SR-NEG-04`)**: If any optional capability has `disposition: "GRANTED_DEGRADED"`, `fallback_applied` MUST NOT be `"NONE"`, and the resulting `negotiation_status` MUST be `"DEGRADED_LEASE_GRANTED"`.
5. **Temporal Consistency (`SR-NEG-05`)**: `agreed_capability_lease.expires_at` MUST be strictly later than `agreed_capability_lease.issued_at`, and the interval MUST equal `lease_ttl_seconds`.

---

## 7. Governance, Non-Claims & Open-Item Traceability

### 7.1 Acceptance Scope
This document operates under **ARCHITECTURE CONTRACT AUTHORITY ONLY**.
In accordance with `ADR-0015` §14 and Platform Contract Proposal §9, authoring this specification:
* **DOES NOT** constitute final Founder acceptance of the negotiation protocol.
* **DOES NOT** grant product, runtime, or deployment implementation authority.
* **DOES NOT** select or endorse any specific infrastructure vendor or public cloud provider.

### 7.2 Open-Item Traceability Matrix

| Open Item ID | Title in ADR-0015 | Governance Mandate | Effect of This Specification |
|---|---|---|---|
| `OPEN-5` | `OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION` | ADR-0015 §8.2, §8.3, §8.4: Define discovery encoding, version matching, degradation reporting, and conformance evidence. | **ELABORATED & FORMALIZED (PROPOSED)**. Provides normative specification, JSON Schema 2020-12, and handshake fixture. |
| `OPEN-10` | Platform Contract Slot Semantics | ADR-0015 §5.2: 13 capability slots defined. | **UPHELD**. Operates strictly over the 13 defined capability slots without adding unapproved slots. |
| `OPEN-2` | Minimum S3 Compatibility Subset | Platform Contract §5: 14 mandatory S3 operations. | **UPHELD**. Enforces S3 operations as non-degradable mandatory baseline under Slot 5 (`storage`). |
| `OPEN-6`/`7`/`8` | Substrate & Provider Selection | ADR-0015 §14: Architecture authority only. | **PRESERVED**. Retains substrate neutrality; zero vendor lock-in. |

---
