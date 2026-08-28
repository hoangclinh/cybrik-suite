# CYBRIK Provider Capability Negotiation Specification (v0.1.0-proposed)

**Status:** PROPOSED (Open-Item Elaboration) — NOT ACCEPTED
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
4. `storage` (Exact 17-operation S3-compatible closed baseline per `OPEN-2`: `PutObject`, `GetObject`, `HeadObject`, `DeleteObject`, `DeleteObjects`, `ListObjectsV2`, `HeadBucket`, `CreateBucket`, `PutObjectRetention`, `GetObjectRetention`, `PutObjectLegalHold`, `GetObjectLegalHold`, `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`, `ListParts`)
5. `database` (Relational ACID transactions, row-level security semantics)
6. `secrets` (Zero-exfiltration memory lifecycle, startup presence verification)
7. `crypto` (Pluggable provider seam, Ed25519/JCS signing per `ADR-0018`)
8. `identity_workload_identity` (E2/E3 mTLS + short-lived delegation token per `ADR-0006`/`ADR-0008`)
9. `artifact_update_mechanism` (RFC 8785 JCS offline manifest signature verification & rollback per `OPEN-1`)

If a provider fails to advertise, satisfy, or provide valid conformance evidence for ANY mandatory slot required by the target profile, CYBRIK Core **MUST** abort negotiation immediately with a terminal status (`TERMINAL_REJECTED`) and enforce `degradation_behavior: "FAIL_CLOSED"`.

Furthermore, each `slot_id` in `advertised_capabilities` MUST be unique across the advertisement (duplicate slot advertisements strictly prohibited). A full-profile conformance declaration (`FULL_PROFILE_CONFORMANCE_DECLARATION`) strictly requires all 13 runtime capability slots regardless of negotiation outcome or disposition (even for `REJECTED_FAIL_CLOSED`). Any advertisement containing duplicate slot definitions MUST be rejected immediately (`TERMINAL_REJECTED`).

Furthermore, storage Object Lock WORM retention is strictly non-degradable whenever the target deployment profile mandates immutable storage (`profile.slots.storage.specification.immutable_storage_required === true`). Any capability negotiation lease attempting to degrade `storage_object_lock` or Slot 5 (`storage`) to `disposition: "GRANTED_DEGRADED"` or `status: "GRANTED_DEGRADED"` under an immutable storage profile MUST be rejected with fatal semantic violation `DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`.

### INV-NEG-02: Namespacing & Sovereign Isolation Invariant (`ADR-0015` §8.2)
1. **Namespace Isolation**: All provider-specific capabilities MUST be scoped under an explicit provider namespace (`provider_namespace` matching `^[a-z0-9][a-z0-9-_]*[a-z0-9]$`). Provider identifiers MUST NOT collide with core contract names.
2. **Sovereignty Non-Contamination**: Provider-specific capabilities MUST NOT alter customer data sovereignty policies (`ADR-0015` §7.1), cross-domain diode controls (`ADR-0017`), or transmit customer data outside sovereign boundaries.
3. **Authority Model Preservation**: Provider capabilities MUST NOT alter authority semantics (who signs, delegates, approves, or audits) or bypass workload identity boundaries (`ADR-0008`).
4. **Isolation Floor Preservation**: Provider capabilities MUST NOT lower the execution isolation floor or relax sandboxing guarantees established by `ADR-0005`.
5. **Evidence Bijection & Pass Invariant**: All `conformance_evidence` records MUST have `status: "PASS"`, valid 64-hex SHA-256 digests (`evidence_pack_digest` matching `^[a-f0-9]{64}$`), and strict 1-to-1 bijection with declared capabilities (every evidence record must be referenced by at least one capability, and no unreferenced/dangling evidence records are allowed).
6. **Unconditional Target Profile Digest Binding & Disk Equality**: EVERY advertisement shape (standalone partial capability advertisement, standalone full profile conformance declaration, or nested within a negotiation handshake) MUST bind a valid `target_profile_digest` (`target_profile_digest` matching `^[a-f0-9]{64}$`) that strictly equals the exact disk SHA-256 digest of the declared deployment profile (`contracts/examples/platform/<target_profile_id>.profile.json`), preventing unanchored capability claims, counterfeit digests, and profile downgrade attacks.
7. **Mandatory Slot Coherence & Canonical Evidence**: All declared capabilities in an advertisement MUST be coherent with the referenced deployment profile mandatory slots (e.g., `cache` and `observability` MUST be declared with `is_mandatory: true` when bound to `onprem-standard-v1` where those slots are designated `MANDATORY`). Full-profile declarations (`FULL_PROFILE_CONFORMANCE_DECLARATION`) strictly require declaring all 13 runtime capability slots regardless of negotiation outcome or disposition (even for `REJECTED_FAIL_CLOSED`). Furthermore, storage capability declarations MUST designate `urn:cybrik:evidence:storage:s3:conformance:v1:object-lock` as the single canonical Object Lock evidence URN (with valid `status: "PASS"` and 64-hex `evidence_pack_digest`), with other URN formats categorized as compatibility aliases or legacy forms.

### INV-NEG-03: Symmetry & Graceful Degradation on Optional Features (`ADR-0015` §8.3)
1. **Deterministic Fallbacks**: Optional capabilities (e.g. GPU inference acceleration, distributed caching) MAY be degraded if and only if deterministic core emulation or graceful feature disabling is available. For deployment profiles requiring immutable storage / WORM compliance, Object Lock and WORM retention capabilities MUST NEVER be degraded or disabled.
2. **Finite Lease Lifespan**: Agreements are issued as finite `agreed_capability_lease` tokens with explicit `target_profile_id`, `target_profile_digest`, `issued_at`, `valid_until`, and `ttl_seconds` (max 86,400 seconds / 24 hours). Exact millisecond equality `(valid_until_ms - issued_at_ms) === ttl_seconds * 1000` is strictly enforced with zero tolerance (no `Math.floor` rounding, truncation, or subsecond drift). Unrenewed or expired leases MUST be rejected.
3. **Degradation Transparency**: All applied fallbacks MUST be explicitly recorded in `agreed_capability_lease.negotiated_optional_capabilities` with active runtime operating mode.
4. **Strict Status-Pair Coupling & Multiset Lease Equality**: Handshake outcome status and lease status MUST be strictly coupled: `AGREED_LEASE_GRANTED` pairs ONLY with `ACTIVE_OPTIMAL` (where every requested optional capability is resolved and granted fully without fallback, i.e., all items have `disposition: "GRANTED_FULL"` and `fallback_applied: "NONE"`); `DEGRADED_LEASE_GRANTED` pairs ONLY with `ACTIVE_DEGRADED` (requiring at least one capability with `GRANTED_DEGRADED` and a non-`"NONE"` fallback); `TERMINAL_REJECTED` pairs ONLY with `REJECTED_FAIL_CLOSED`. Furthermore, both `requested_optional_capabilities` and `negotiated_optional_capabilities` arrays MUST NOT contain duplicate composite identity `(capability_name, slot_id)` entries (strict composite key set uniqueness per array and exact 1-to-1 bijection across arrays). `negotiation_request.requested_optional_capabilities` and `agreed_capability_lease.negotiated_optional_capabilities` MUST satisfy strict bidirectional composite-identity `(capability_name, slot_id)` multiset equality; any surplus, leftover, or unrequested lease entry is strictly prohibited.
5. **Strict Biconditional Disposition/Fallback Coupling**: Across all agreed capability leases and within each item of `negotiated_optional_capabilities`, disposition and fallback application are strictly biconditionally coupled:
   - `disposition: "GRANTED_FULL"` if and only if `fallback_applied: "NONE"`.
   - `fallback_applied: "NONE"` if and only if `disposition: "GRANTED_FULL"`.
   - If `disposition` is `GRANTED_DEGRADED` or `REJECTED_UNSUPPORTED`, `fallback_applied` MUST NOT be `"NONE"`.

### INV-NEG-04: Evidence & Verifiable Discovery Invariant (`ADR-0015` §8.4)
1. **Mutual Discovery Authentication**: Capability advertisement MUST occur over an authenticated discovery seam (`authenticated_discovery: true`) using mutual TLS or cryptographic token binding (`ADR-0006`). Ambient unauthenticated advertisements MUST be rejected.
2. **Evidence Binding & URN Naming**: Every claimed capability MUST reference verifiable conformance test evidence (`conformance_evidence`) formatted as structured URNs matching `^urn:cybrik:evidence:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$`. All `conformance_evidence` records MUST have `status: "PASS"`, valid 64-hex SHA-256 digests (`evidence_pack_digest`), and strict 1-to-1 bijection with declared capabilities (every evidence record must be referenced by at least one capability, and no unreferenced/dangling evidence records are allowed). For storage Object Lock capabilities, `urn:cybrik:evidence:storage:s3:conformance:v1:object-lock` is designated as the single canonical URN (with other URN formats such as `urn:cybrik:evidence:storage:object-lock:v1` or namespace-qualified `urn:cybrik:evidence:storage-object-lock:...` recognized as compatibility aliases or legacy forms), requiring an exact 1-to-1 matching with a `conformance_evidence[].test_identifier` entry verifying test execution with `status: "PASS"`. Unbacked claims or dangling references MUST be treated as absent and fail validation.
3. **Profile Digest Binding**: The provider advertisement and granted lease MUST bind the target deployment profile SHA-256 digest (`target_profile_digest`), preventing profile downgrade attacks.

---

## 3. Protocol Architecture & Handshake Flow

The capability negotiation protocol is executed as an authenticated, three-phase exchange:

```
  CYBRIK Core (Consumer)                             Provider Adapter
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
        |  - lease_id, target_profile_id, target_profile_digest |
        |  - issued_at / valid_until, ttl_seconds               |
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
* `requested_slots`: Explicit list of required platform slots. Every negotiation request MUST contain ALL 9 core mandatory runtime slots (`oci_container_runtime`, `isolation_substrate`, `network_segmentation`, `storage`, `database`, `secrets`, `crypto`, `identity_workload_identity`, `artifact_update_mechanism`).
* `requested_optional_capabilities`: Desired optional features with priority levels and preferred fallback modes.
* `client_nonce`: High-entropy nonce (16–64 alphanumeric/hex characters).
* `degradation_policy`: Fallback policy (`FAIL_CLOSED_ON_MANDATORY_GRACEFUL_ON_OPTIONAL` or `FAIL_CLOSED_STRICT`).

#### Phase 2: Capability Advertisement (`advertisement_response`)
The Provider Adapter responds with its supported capabilities:
* `response_id`: Unique response identifier.
* `timestamp`: RFC 3339 UTC timestamp.
* `server_nonce`: High-entropy server nonce.
* `target_profile_digest`: Valid 64-hex SHA-256 digest (`^[a-f0-9]{64}$`). EVERY advertisement shape (standalone partial, standalone full, or nested within negotiation) MUST bind a valid `target_profile_digest` that strictly equals the exact disk SHA-256 digest of the declared deployment profile.
* `claim_type`: `FULL_PROFILE_CONFORMANCE_DECLARATION` or `PARTIAL_CAPABILITY_ADVERTISEMENT`. Full-profile conformance declarations (`FULL_PROFILE_CONFORMANCE_DECLARATION`) strictly declare all 13 runtime capability slots regardless of negotiation outcome or disposition (even for `REJECTED_FAIL_CLOSED`), where every capability descriptor explicitly declares `is_mandatory`, `supported_features`, `degradation_fallback`, and designates canonical Object Lock evidence (`urn:cybrik:evidence:storage:s3:conformance:v1:object-lock`) on the storage slot (`slot_id: "storage"`).
* `advertised_capabilities`: Array of capability descriptors declaring `slot_id`, `is_mandatory`, `supported_features`, `degradation_fallback` details, and structured `evidence_references` URNs matching `^urn:cybrik:evidence:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$`. Each `slot_id` in `advertised_capabilities` MUST be unique across the advertisement (duplicate slot advertisements strictly prohibited). All declared capabilities must be coherent with the profile mandatory slots (e.g. `cache`, `observability` marked `is_mandatory: true` when bound to `onprem-standard-v1`). Full-profile declarations strictly declare all 13 runtime capability slots with `is_mandatory`, `supported_features`, `degradation_fallback`, and designate canonical Object Lock evidence (`urn:cybrik:evidence:storage:s3:conformance:v1:object-lock`) on the storage slot.
* `conformance_evidence`: Concrete test execution records (`test_identifier` matching URN pattern `^urn:cybrik:evidence:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$`, required `status: "PASS"`, required 64-character hex `evidence_pack_digest` matching `^[a-f0-9]{64}$`, and optional `executed_at` timestamp / `report_uri`). All `conformance_evidence` records MUST have `status: "PASS"`, valid 64-hex SHA-256 digests, and strict 1-to-1 bijection with declared capabilities (every evidence record must be referenced by at least one capability, and no unreferenced/dangling evidence records are allowed).
* `authenticated_discovery: true`: Enforces mutual authentication on discovery seam.
* `degradation_behavior: "FAIL_CLOSED"`: Provider-side fail-closed guarantee.

#### Phase 3: Capability Resolution & Lease Grant (`agreed_capability_lease`)
CYBRIK Core validates the response:
1. Verifies the `server_nonce` and authenticates the provider.
2. Checks that every slot required by the target profile is advertised, that each `slot_id` in `advertised_capabilities` is unique (duplicate slot advertisements strictly prohibited), and backed by valid conformance evidence satisfying strict 1-to-1 bijection (`status: "PASS"`, valid 64-hex SHA-256 digest, no dangling evidence). If any mandatory slot is missing or duplicate slot advertisements are present, negotiation fails closed (`REJECTED_FAIL_CLOSED`).
3. For each requested optional capability, determines whether it can be granted in full (`GRANTED_FULL`) with `fallback_applied: "NONE"`, or degraded (`GRANTED_DEGRADED`) to a valid core fallback mode with a non-`"NONE"` fallback applied. Under `ACTIVE_OPTIMAL`, every requested optional capability must be resolved and granted fully without fallback (`disposition: "GRANTED_FULL"` and `fallback_applied: "NONE"` across all items in `negotiated_optional_capabilities`).
4. Issues the signed/authenticated `agreed_capability_lease` containing active runtime configuration. The agreed capability lease (`negotiated_optional_capabilities`) MUST contain exactly the same multiset of `(capability_name, slot_id)` pairs as requested in `negotiation_request.requested_optional_capabilities`—no surplus, omitted, or unrequested entries permitted. Both `requested_optional_capabilities` and `negotiated_optional_capabilities` arrays MUST NOT contain duplicate composite identity `(capability_name, slot_id)` entries (strict composite key set uniqueness per array and exact 1-to-1 bijection across arrays).

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

| State / Status Pair | Invariant Condition | Resulting Operational Posture |
|---|---|---|
| `NEGOTIATING` | Handshake initiated, awaiting provider response. | Workloads blocked from initialization. |
| `EVALUATING_EVIDENCE` | Response received; core performing structural & evidence checks. | Workloads blocked; fail-closed timeout active. |
| `AGREED_LEASE_GRANTED` / `ACTIVE_OPTIMAL` | All mandatory slots valid; every requested optional capability resolved and granted fully without fallback (`disposition: "GRANTED_FULL"`, `fallback_applied: "NONE"`). Strict 1-to-1 status pair. | Full performance / full feature operation. |
| `DEGRADED_LEASE_GRANTED` / `ACTIVE_DEGRADED` | All mandatory slots valid; one or more optional capabilities degraded to fallback. Strict 1-to-1 status pair. | Normal operation under documented fallback constraints. |
| `TERMINAL_REJECTED` / `REJECTED_FAIL_CLOSED` | Any mandatory slot missing, unauthenticated, or invalid evidence. Strict 1-to-1 status pair. | Zero workload execution; system fails closed. |
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
| **Slot 5** | `storage` | Exact 17-operation closed baseline (`PutObject`, `GetObject`, `HeadObject`, `DeleteObject`, `DeleteObjects`, `ListObjectsV2`, `HeadBucket`, `CreateBucket`, `PutObjectRetention`, `GetObjectRetention`, `PutObjectLegalHold`, `GetObjectLegalHold`, `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`, `ListParts`; `OPEN-2`), SigV4, path-style addressing | Object Lock / WORM retention headers (when optional in profile) | `FEATURE_DISABLED_GRACEFUL`: Application-layer SHA-256 integrity verification; object lock disabled (strictly forbidden if profile requires immutable storage, i.e. `profile.slots.storage.specification.immutable_storage_required === true`; fatal error `DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`). |
| **Slot 6** | `database` | Relational datastore, ACID transactions, row-level security (RLS) | Read-replica auto-routing, sharded clustering | `CORE_EMULATION_FALLBACK`: Fall back to single primary transaction pool with read-after-write consistency. |
| **Slot 7** | `cache` | In-memory key-value cache, predictable consistency, `noeviction` | Multi-node cluster replication | `FEATURE_DISABLED_GRACEFUL`: Fall back to standalone single-node cache instance with in-memory fallback. |
| **Slot 8** | `secrets` | Secret storage, rotation hooks, zero exfiltration, startup presence check | Hardware HSM envelope key wrapping | `CORE_EMULATION_FALLBACK`: Fall back to software envelope encryption with operator-injected master secret. |
| **Slot 9** | `crypto` | Pluggable crypto seam, Ed25519/JCS signing (`ADR-0018`) | Post-quantum hybrid cipher suites, hardware PKCS#11 | `CORE_EMULATION_FALLBACK`: Fall back to standard RFC 8785 Ed25519 software cryptographic module. |
| **Slot 10** | `identity_workload_identity` | E2/E3 mTLS, short-lived delegation token (`ADR-0008`) | Dynamic SPIRE/SPIFFE workload attestation server | `CORE_EMULATION_FALLBACK`: Fall back to static certificate-bound bootstrap token authentication. |
| **Slot 11** | `observability` | Sovereign structured logging, standard metrics | External OpenTelemetry collector egress export | `FEATURE_DISABLED_GRACEFUL`: Fall back to sovereign local append-only log files; remote egress disabled. |
| **Slot 12** | `ai_model_runtime` | Sovereign local model execution, loopback DNS guard (`ADR-0015` §7.3) | Hardware GPU / NPU tensor acceleration | `CORE_EMULATION_FALLBACK`: Fall back to local CPU tensor runtime (quantized) with adjusted latency budget. |
| **Slot 13** | `artifact_update_mechanism` | Signed offline bundles, RFC 8785 signature verify, rollback (`OPEN-1`) | Live delta binary streaming | `FEATURE_DISABLED_GRACEFUL`: Fall back to full signed offline bundle package installation. |

### 4.1 Prohibited Degradation Attempts
Any attempt to negotiate a degradation on a mandatory baseline (such as permitting public cloud model egress, relaxing default-deny network rules, bypassing database ACID guarantees, degrading Object Lock / WORM retention when the profile requires immutable storage, or executing as root) is **STRICTLY PROHIBITED** and MUST result in an unrecoverable `TERMINAL_REJECTED` handshake state.

Specifically, **storage Object Lock WORM is strictly non-degradable whenever the target deployment profile requires immutable storage** (`profile.slots.storage.specification.immutable_storage_required === true`). Any capability negotiation lease granting `storage_object_lock` or `slot_id === 'storage'` under `disposition: "GRANTED_DEGRADED"` or `status: "GRANTED_DEGRADED"` violates profile immutability and MUST trigger fatal semantic error `DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`.

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
  "target_profile_digest": "5be09c271422654a281dcf14d0dbb4968d23337157bd38e39f52d1cf3c4b5050",
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
| `/target_profile_digest` | `string` | Pattern `^[a-f0-9]{64}$` | SHA-256 digest of the referenced deployment profile artifact. EVERY advertisement shape (standalone partial, standalone full, or nested within negotiation) MUST bind a valid `target_profile_digest` that strictly equals the exact disk SHA-256 digest of the declared deployment profile. |
| `/negotiation_status` | `string` | Enum `["AGREED_LEASE_GRANTED", "DEGRADED_LEASE_GRANTED", "TERMINAL_REJECTED"]` | Final outcome status of the negotiation handshake. Strictly coupled to `lease_status` (`AGREED_LEASE_GRANTED` <-> `ACTIVE_OPTIMAL`, `DEGRADED_LEASE_GRANTED` <-> `ACTIVE_DEGRADED`, `TERMINAL_REJECTED` <-> `REJECTED_FAIL_CLOSED`). |
| `/negotiation_request/requested_slots` | `array` | MinItems 9, MaxItems 13, unique items | Explicit list of requested slots. MUST contain all 9 core mandatory runtime slots (`oci_container_runtime`, `isolation_substrate`, `network_segmentation`, `storage`, `database`, `secrets`, `crypto`, `identity_workload_identity`, `artifact_update_mechanism`). |
| `/negotiation_request/requested_optional_capabilities` | `array` | Unique composite keys `(capability_name, slot_id)` | Array of requested optional capability descriptors. Both `requested_optional_capabilities` and `negotiated_optional_capabilities` arrays MUST NOT contain duplicate composite identity `(capability_name, slot_id)` entries (strict composite key set uniqueness per array and exact 1-to-1 bijection across arrays). |
| `/negotiation_request/client_nonce` | `string` | Pattern `^[a-zA-Z0-9_-]{16,64}$` | Client replay-prevention nonce. |
| `/advertisement_response/server_nonce` | `string` | Pattern `^[a-zA-Z0-9_-]{16,64}$` | Server replay-prevention nonce. |
| `/advertisement_response/claim_type` | `string` | Enum `["PARTIAL_CAPABILITY_ADVERTISEMENT", "FULL_PROFILE_CONFORMANCE_DECLARATION"]` | Scope of the capability claim. Full-profile conformance declarations (`FULL_PROFILE_CONFORMANCE_DECLARATION`) strictly declare all 13 capability slots regardless of negotiation outcome or disposition (even for `REJECTED_FAIL_CLOSED`), with `is_mandatory`, `supported_features`, `degradation_fallback`, and designate canonical Object Lock evidence (`urn:cybrik:evidence:storage:s3:conformance:v1:object-lock`) on the storage slot. |
| `/advertisement_response/advertised_capabilities` | `array` | MinItems 1, unique `slot_id` items | Array of capability descriptors. Each `slot_id` in `advertised_capabilities` MUST be unique (duplicate slot advertisements strictly prohibited). Full-profile declarations strictly declare all 13 capability slots regardless of negotiation outcome or disposition (even for `REJECTED_FAIL_CLOSED`), with `is_mandatory`, `supported_features`, `degradation_fallback`, and designate canonical Object Lock evidence (`urn:cybrik:evidence:storage:s3:conformance:v1:object-lock`) on the storage slot. All declared capabilities must be coherent with the profile mandatory slots (e.g. `cache`, `observability` marked `is_mandatory: true` when bound to `onprem-standard-v1`). |
| `/advertisement_response/advertised_capabilities[].is_mandatory` | `boolean` | Boolean flag | Indicates whether the advertised slot capability is mandatory for the declared profile. All declared capabilities MUST be coherent with profile mandatory slots (e.g. `cache`, `observability` marked `is_mandatory: true` when bound to `onprem-standard-v1`). |
| `/advertisement_response/advertised_capabilities[].supported_features` | `array` | MinItems 1, non-empty strings | List of supported features declared for the capability slot. |
| `/advertisement_response/advertised_capabilities[].degradation_fallback` | `object` | Object with `fallback_supported`, `fallback_mode`, optional `degradation_notes` | Graceful degradation fallback specification for the capability slot. |
| `/advertisement_response/advertised_capabilities[].evidence_references` | `array` | MinItems 1, items pattern `^urn:cybrik:evidence:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$` | Evidence URN references backing the advertised capability. The single canonical Object Lock evidence URN is `urn:cybrik:evidence:storage:s3:conformance:v1:object-lock` (other URN formats are compatibility aliases or legacy forms). |
| `/advertisement_response/conformance_evidence` | `array` | MinItems 1, unique test identifiers | Concrete test execution records. All `conformance_evidence` records MUST have `status: "PASS"`, valid 64-hex SHA-256 digests, and strict 1-to-1 bijection with declared capabilities (every evidence record must be referenced by at least one capability, and no unreferenced/dangling evidence records are allowed). |
| `/advertisement_response/conformance_evidence[].test_identifier` | `string` | Pattern `^urn:cybrik:evidence:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$` | Unique test evidence URN identifier (canonical Object Lock evidence URN: `urn:cybrik:evidence:storage:s3:conformance:v1:object-lock`), requiring strict 1-to-1 bijection with `evidence_references` and verified passing status (`status: "PASS"`). |
| `/advertisement_response/conformance_evidence[].status` | `string` | Const `"PASS"` | Evaluation outcome of the conformance test run, strictly required to be PASS. |
| `/advertisement_response/conformance_evidence[].evidence_pack_digest` | `string` | Pattern `^[a-f0-9]{64}$` | Valid 64-character lowercase hexadecimal SHA-256 digest of the raw evidence pack artifact. |
| `/advertisement_response/conformance_evidence[].executed_at` | `string` | RFC 3339 date-time | Optional execution timestamp of the test. |
| `/advertisement_response/conformance_evidence[].report_uri` | `string` | URI format | Optional URI referencing the detailed test execution report. |
| `/advertisement_response/authenticated_discovery` | `boolean` | Const `true` | Enforces authenticated discovery seam. |
| `/advertisement_response/degradation_behavior` | `string` | Const `"FAIL_CLOSED"` | Provider-side fail-closed degradation declaration. |
| `/agreed_capability_lease/target_profile_id` | `string` | Enum `["onprem-standard-v1", "onprem-airgap-v1", "private-cloud-v1", "hybrid-sovereign-v1"]` | Deployment profile ID bound to the agreed lease. |
| `/agreed_capability_lease/target_profile_digest` | `string` | Pattern `^[a-f0-9]{64}$` | SHA-256 digest of profile bound to the agreed lease. |
| `/agreed_capability_lease/issued_at` | `string` | RFC 3339 date-time | Issuance timestamp of the capability lease. |
| `/agreed_capability_lease/valid_until` | `string` | RFC 3339 date-time | Expiration timestamp of the capability lease (`valid_until_ms > issued_at_ms`). |
| `/agreed_capability_lease/ttl_seconds` | `integer` | Minimum 1, Maximum 86400 | Authorized lifespan of the capability lease in seconds. Enforces exact millisecond equality with zero tolerance: `(valid_until_ms - issued_at_ms) === ttl_seconds * 1000` (no rounding, truncation, or subsecond drift permitted). |
| `/agreed_capability_lease/lease_status` | `string` | Enum `["ACTIVE_OPTIMAL", "ACTIVE_DEGRADED", "REJECTED_FAIL_CLOSED"]` | Granted lease status. Strictly coupled to `negotiation_status`. |
| `/agreed_capability_lease/mandatory_slots_satisfied` | `array` | MinItems 9, MaxItems 13, unique items | Array of verified mandatory slot identifiers. |
| `/agreed_capability_lease/negotiated_optional_capabilities` | `array` | Unique composite keys `(capability_name, slot_id)` | Array of resolved optional capability descriptors. Both `requested_optional_capabilities` and `negotiated_optional_capabilities` arrays MUST NOT contain duplicate composite identity `(capability_name, slot_id)` entries (strict composite key set uniqueness per array and exact 1-to-1 bijection across arrays). `negotiation_request.requested_optional_capabilities` and `agreed_capability_lease.negotiated_optional_capabilities` MUST satisfy strict bidirectional composite-identity `(capability_name, slot_id)` multiset equality; any surplus, leftover, or unrequested lease entry is strictly prohibited. |
| `/agreed_capability_lease/negotiated_optional_capabilities[].disposition` | `string` | Enum `["GRANTED_FULL", "GRANTED_DEGRADED", "REJECTED_UNSUPPORTED"]` | Resolution disposition of the capability. Strictly biconditionally coupled to `fallback_applied` (`GRANTED_FULL` <=> `NONE`). Under `ACTIVE_OPTIMAL`, all items must have `disposition: "GRANTED_FULL"`. |
| `/agreed_capability_lease/negotiated_optional_capabilities[].fallback_applied` | `string` | Enum `["CORE_EMULATION_FALLBACK", "FEATURE_DISABLED_GRACEFUL", "NONE"]` | Fallback mode applied. Strictly biconditionally coupled to `disposition` (`NONE` <=> `GRANTED_FULL`; non-`NONE` for `GRANTED_DEGRADED` and `REJECTED_UNSUPPORTED`). Under `ACTIVE_OPTIMAL`, all items must have `fallback_applied: "NONE"`. |
| `/agreed_capability_lease/fail_closed_violations` | `array` | Array of strings | Must be empty for active leases; non-empty for rejected handshakes. |
| `/evidence_binding_verified` | `boolean` | `true` when lease is granted | Verification marker confirming all evidence references resolved. |

---

## 6. Normative Two-Phase Validation Requirement

To be deemed valid, any capability negotiation document or runtime handshake exchange MUST pass a strict two-phase validation sequence:

### Phase 1: Structural JSON Schema Validation
1. Document MUST validate without error against `cybrik.provider-capability-negotiation.v1.schema.json` (JSON Schema 2020-12).
2. Document MUST adhere to all `additionalProperties: false` object closures.
3. All format constraints (RFC 3339 timestamps, SHA-256 hex patterns, namespace identifiers) MUST pass strict regex verification.
4. Status-pair coupling MUST be enforced structurally: `AGREED_LEASE_GRANTED` pairs ONLY with `ACTIVE_OPTIMAL`, `DEGRADED_LEASE_GRANTED` pairs ONLY with `ACTIVE_DEGRADED`, and `TERMINAL_REJECTED` pairs ONLY with `REJECTED_FAIL_CLOSED`.
5. Strict biconditional disposition/fallback coupling MUST be enforced structurally for each item in `negotiated_optional_capabilities`: `disposition: "GRANTED_FULL"` <=> `fallback_applied: "NONE"`, and `disposition: ["GRANTED_DEGRADED", "REJECTED_UNSUPPORTED"]` => `fallback_applied !== "NONE"`.
6. Under `ACTIVE_OPTIMAL` lease status, schema MUST enforce that every item in `negotiated_optional_capabilities` has `disposition: "GRANTED_FULL"` and `fallback_applied: "NONE"`.

### Phase 2: Semantic Conformance & Referential Integrity
1. **Evidence Referential Integrity & Strict Bijection (`SR-NEG-01`)**: Every item in `evidence_references` within `advertisement_response.advertised_capabilities` MUST be a valid URN matching `^urn:cybrik:evidence:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$` and MUST resolve to an exact 1-to-1 `test_identifier` defined in `advertisement_response.conformance_evidence` verifying passing execution (`status: "PASS"`) and carrying a valid 64-character hex `evidence_pack_digest`. All `conformance_evidence` records MUST have `status: "PASS"`, valid 64-hex SHA-256 digests, and strict 1-to-1 bijection with declared capabilities (every evidence record must be referenced by at least one capability, and no unreferenced/dangling evidence records are allowed).
2. **Profile Digest Matching (`SR-NEG-02`)**: `target_profile_digest` (on root document, capability advertisements whether standalone partial, standalone full, or nested within negotiation, and `agreed_capability_lease`) MUST strictly equal the exact disk SHA-256 digest of the declared deployment profile (`contracts/examples/platform/<target_profile_id>.profile.json`).
3. **Mandatory Slot Completeness, Slot Uniqueness & Requested-to-Lease Closure (`SR-NEG-03`)**: Every negotiation request (`negotiation_request.requested_slots`) MUST explicitly contain all 9 core mandatory runtime slots (`oci_container_runtime`, `isolation_substrate`, `network_segmentation`, `storage`, `database`, `secrets`, `crypto`, `identity_workload_identity`, `artifact_update_mechanism`). In `advertisement_response.advertised_capabilities`, each `slot_id` MUST be unique (duplicate slot advertisements strictly prohibited). A full-profile conformance declaration (`FULL_PROFILE_CONFORMANCE_DECLARATION`) strictly requires all 13 slots regardless of negotiation outcome or disposition (even for `REJECTED_FAIL_CLOSED`). For any granted lease (`AGREED_LEASE_GRANTED` or `DEGRADED_LEASE_GRANTED`), `agreed_capability_lease.mandatory_slots_satisfied` MUST contain all slots marked mandatory in the referenced deployment profile (including all 9 core slots), and all mandatory slots MUST be advertised with verified evidence references. Furthermore, both `requested_optional_capabilities` and `negotiated_optional_capabilities` arrays MUST NOT contain duplicate composite identity `(capability_name, slot_id)` entries (strict composite key set uniqueness per array and exact 1-to-1 bijection across arrays). `negotiation_request.requested_optional_capabilities` and `agreed_capability_lease.negotiated_optional_capabilities` MUST satisfy strict bidirectional composite-identity `(capability_name, slot_id)` multiset equality: every requested optional capability declared in `negotiation_request.requested_optional_capabilities` MUST be resolved in the lease by matching exact composite identity `(capability_name, slot_id)` and cardinality in `agreed_capability_lease.negotiated_optional_capabilities`, and no surplus, leftover, or unrequested lease entries are permitted. Any omitted, surplus, mismatched composite identity, or unmapped requested optional capability MUST fail semantic validation.
4. **Storage Slot 17-Operation Baseline & Canonical Object Lock Evidence Verification (`SR-NEG-04`)**: Slot 5 (`storage`) advertisements MUST reference the exact 17-operation closed baseline (`PutObject`, `GetObject`, `HeadObject`, `DeleteObject`, `DeleteObjects`, `ListObjectsV2`, `HeadBucket`, `CreateBucket`, `PutObjectRetention`, `GetObjectRetention`, `PutObjectLegalHold`, `GetObjectLegalHold`, `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`, `ListParts`) with verifiable Object Lock retention evidence. `urn:cybrik:evidence:storage:s3:conformance:v1:object-lock` is designated as the single canonical Object Lock evidence URN (with other URN formats such as `urn:cybrik:evidence:storage:object-lock:v1` or namespace-qualified `urn:cybrik:evidence:storage-object-lock:...` recognized only as compatibility aliases or legacy forms), requiring an exact 1-to-1 match with a `conformance_evidence[].test_identifier` entry bearing verified passing status (`status: "PASS"`).
5. **Degradation Integrity, Biconditional Coupling & Status-Pair Closure (`SR-NEG-05`)**: Handshake outcome status and lease status MUST strictly couple: `AGREED_LEASE_GRANTED` pairs ONLY with `ACTIVE_OPTIMAL`, where every requested optional capability must be resolved and granted fully without fallback (every capability item in `negotiated_optional_capabilities` MUST have `disposition: "GRANTED_FULL"` and `fallback_applied: "NONE"`; zero degraded or unsupported capabilities permitted). `DEGRADED_LEASE_GRANTED` pairs ONLY with `ACTIVE_DEGRADED`, requiring at least one agreed capability to have `disposition: "GRANTED_DEGRADED"` (or `status: "GRANTED_DEGRADED"`) with `fallback_applied !== "NONE"`. Strict biconditional coupling `disposition === "GRANTED_FULL" <=> fallback_applied === "NONE"` MUST hold across all capability entries. For profiles requiring immutable storage (`profile.slots.storage.specification.immutable_storage_required === true`), Object Lock / WORM degradation is strictly forbidden.
6. **Temporal Consistency & Exact Millisecond TTL Validation (`SR-NEG-06`)**: `agreed_capability_lease.valid_until` MUST be strictly later than `agreed_capability_lease.issued_at` (`Date.parse(valid_until) > Date.parse(issued_at)`), and `agreed_capability_lease.ttl_seconds` MUST satisfy exact millisecond equality with zero tolerance: `(Date.parse(valid_until) - Date.parse(issued_at)) === ttl_seconds * 1000` (no `Math.floor`, truncation, or subsecond drift permitted).
7. **Non-Degradability of Immutable Storage (`SR-NEG-07`)**: Whenever the target deployment profile mandates immutable storage (`profile.slots.storage.specification.immutable_storage_required === true`), storage Object Lock WORM retention is strictly non-degradable: NO capability in `agreed_capability_lease.negotiated_optional_capabilities` or `agreed_capabilities` with `slot_id === 'storage'` or `capability_name === 'storage_object_lock'` may have `disposition: "GRANTED_DEGRADED"` or `status: "GRANTED_DEGRADED"`. Any attempt to grant a degraded storage capability lease under an immutable storage profile MUST fail validation with fatal error `DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`.

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
| `OPEN-2` | Minimum S3 Compatibility Subset | Platform Contract §5: 17 mandatory S3 operations. | **UPHELD**. Enforces exact 17-operation S3 closed baseline as non-degradable mandatory baseline under Slot 5 (`storage`). |
| `OPEN-6`/`7`/`8` | Substrate & Provider Selection | ADR-0015 §14: Architecture authority only. | **PRESERVED**. Retains substrate neutrality; zero vendor lock-in. |

---
