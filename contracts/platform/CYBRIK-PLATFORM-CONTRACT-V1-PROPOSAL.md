# Platform Contract Proposal (v0.1.0-proposed)

**Status:** PROPOSED
**Authoring Phase:** v0.1.0-proposed to v0.1.0-proposed (Architecture/governance proposal; no implementation authority).

## 1. Overview
This contract defines the 13 minimum capability slots (cybrik-suite:docs/adr/ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md §5.2) required to form the substrate for the CYBRIK Autonomous Security Operations platform. It serves as an architectural agreement detailing expectations between the control plane, data plane, and underlying platform capability providers.

This contract explicitly defines boundaries and non-goals to prevent capability bloat. It is purely capability-based and vendor-free. Specific technologies are merely reference targets and provider adapter realizations, not normative hard dependencies.

### Non-Goals & Boundaries
* **Does NOT** select an orchestration distribution.
* **Does NOT** select a hypervisor.
* **Does NOT** select a cloud provider.
* **Does NOT** mutate product or infrastructure source code.
* **Does NOT** reopen RC1 or staging qualification.

## 2. Capability Slots

The platform requires 13 fundamental capability slots to operate. Providers MUST fulfill these to the levels required by their respective `VERSIONED_DEPLOYMENT_PROFILE`.

### Slot 1: `oci_container_runtime`
OCI / container runtime: image format, rootless posture, verification at load.

### Slot 2: `isolation_substrate`
Isolation substrate: cybrik-suite:docs/adr/ADR-0005-sandbox-substrate.md isolation classes and observable guarantees.

### Slot 3: `orchestration_capability`
Orchestration capability: scheduling, lifecycle, health, rollout/rollback.

### Slot 4: `network_segmentation`
Network segmentation: default-deny, segment boundaries, egress mediation, DNS TOCTOU guard seam.

### Slot 5: `storage`
Storage: durability, integrity, retention, immutability, minimum S3-Compatible Object Store subset per OPEN-2.

### Slot 6: `database`
Database: Relational Datastore with ACID transactions, isolation-level, backup/restore, RLS-compatible semantics.

### Slot 7: `cache`
Cache: In-memory Key-Value Cache with consistency, eviction semantics, noeviction.

### Slot 8: `secrets`
Secrets: Secret Management for storage, rotation, non-exfiltration, startup-presence validation.

### Slot 9: `crypto`
Crypto: pluggable provider seam with a stable interface per cybrik-soc-command-center:governance/ADR/ADR-0018-sovereign-encryption-key-management.md (PROPOSED).

### Slot 10: `identity_workload_identity`
Identity / workload identity: E2/E3 two-layer trust seam of cybrik-suite:docs/adr/ADR-0006-cross-product-event-and-identity-model.md (ACCEPTED) and cybrik-suite:docs/adr/ADR-0008-internal-service-delegation-and-workload-identity.md (ACCEPTED FOR IMPLEMENTATION — v0.1.0, not stable v1/GA).

### Slot 11: `observability`
Observability: trace/metric/log semantics and sovereignty classification.

### Slot 12: `ai_model_runtime`
AI / model runtime: local/private inference, egress posture, model provenance.

### Slot 13: `artifact_update_mechanism`
Artifact / update mechanism: signed bundles, offline install/update, trust root, rollback per OPEN-1.

## 3. VERSIONED_DEPLOYMENT_PROFILE Specification (INV-17)

A `VERSIONED_DEPLOYMENT_PROFILE` specifies a concrete set of configurations against the 13 slots.

### Structure
* **profile_id**: String identifier.
* **Core Slot Constraints**: The 9 core runtime slots (oci_container_runtime, isolation_substrate, network_segmentation, storage, database, secrets, crypto, identity_workload_identity, artifact_update_mechanism) MUST be explicitly defined with strength "MANDATORY".
* **Evidence Binding**: Capability advertisements MUST cryptographically or explicitly bind to conformance evidence. All slots within `capability_set` require non-vacuous constraints arrays (minimum 1 item, minimum 2 characters per item, matching alphanumeric/period/hyphen/underscore). Advertised capabilities must explicitly link to `conformance_evidence` via `evidence_references`.
* **profile_version**: Semver version of the profile.
* **capability_set**: Key-value mappings mapping the 13 slots to specific constraints.
* **strength**: Specification of which slots are `MANDATORY` or `OPTIONAL` for the profile.
* **sovereignty_class**: E.g., `SOVEREIGN_CUSTOMER_CONTROLLED`, `CONTROLLED_CROSS_DOMAIN`, `OPTIONAL_HYBRID`.
* **isolation_policy**: Structural isolation policy modeling minimum execution isolation floor (S0-S4), admitted risk classes, disposable execution requirements, network egress isolation, and downgrade guarantees.

## 4. Canonical Tier Semantics Normalization (OPEN-4)

To prevent confusion, the following orthogonal axes are strictly disambiguated. This fully establishes the resolution of OPEN-4 subject to independent verification:
* **Authoritative SOC Capacity-Tier Namespace**: Remains intact for throughput and capacity only (T0/T1/T2). Bare T0/T1/T2 has no ambiguous suite-wide conformance meaning.
* **Isolation/Trust Terminology**: Separately namespaced for sandboxing technologies, boundary enforcement, and workload isolation levels (S0/S1/S2/S3/S4).
* **VERSIONED_DEPLOYMENT_PROFILE**: This is the executable deployment-conformance subject, packaging the deployment requirements (slots + capabilities).

## 5. Minimum S3 Subset Specification (OPEN-2)

**Role**: `cybrik.storage-s3-compatibility-subset.v1.schema.json` is a `PROPOSED_SUBORDINATE_CONTRACT_ARTIFACT` defining a candidate minimum interface subset. Platform Contract acceptance does NOT itself constitute final Founder acceptance of the S3 compatibility contract or unresolved Object Lock, retention, error-semantics, or profile-applicability decisions.

The `storage` capability requires a strict minimum S3 compatibility subset including:
- **CRUD**: PutObject, GetObject, HeadObject, DeleteObject, DeleteObjects, ListObjectsV2, HeadBucket, CreateBucket
- **Multipart**: CreateMultipartUpload, UploadPart, CompleteMultipartUpload, AbortMultipartUpload
- **Presigning**: URL presigning for delegation
- **Authentication**: SigV4 authentication header parsing with SHA-256 payload signing
- **Addressing**: path-style addressing mandatory
- **Versioning**: PutBucketVersioning, GetBucketVersioning
- **Retention**: optional Object Lock / Retention
- **Error mapping**: standard error code mappings

## 6. Optional Provider Capability Negotiation Protocol (OPEN-5)

**Role**: `cybrik.provider-capability-advertisement.v1.schema.json` is a `PROPOSED_SUBORDINATE_CONTRACT_ARTIFACT`. It defines the static CAPABILITY_DECLARATION, CAPABILITY_ADVERTISEMENT, PROFILE_BINDING, EVIDENCE_BINDING, and FAIL_CLOSED_DEGRADATION boundary. It MUST NOT be described as completing the detailed runtime/provider negotiation protocol.

To allow platform environments to auto-discover capabilities without manual hardcoding, an optional negotiation protocol is defined:
* **Namespaced Provider Capabilities**: Capabilities are advertised in strict namespaces (`provider_namespace`) to avoid collision.
* **Capability Advertisement Schema**: A structured JSON mechanism (`cybrik.provider-capability-advertisement.v1.schema.json`) to declare supported capabilities, conformance evidence (`conformance_evidence`), and authenticated discovery (`authenticated_discovery`).
* **Claim Types**: Advertisements MUST specify `claim_type` as either `PARTIAL_CAPABILITY_ADVERTISEMENT` or `FULL_PROFILE_CONFORMANCE_DECLARATION`. A `FULL_PROFILE_CONFORMANCE_DECLARATION` requires all 13 slots, and consumers fail closed on any missing slot for the claimed profile. Partial advertisements are evaluated via a fail-closed resolution against mandatory profile requirements (if any required slot is omitted or fails verification, the overall capability set is rejected).
* **Degradation Behavior**: Must specify `degradation_behavior` as `FAIL_CLOSED`. If capability discovery fails, times out, is unauthenticated, or fails verification, the consumer MUST treat the capability as absent and fail closed.

## 7. Offline Install & Update Manifest (OPEN-1)

**Role**: `cybrik.offline-install-update-manifest.v1.schema.json` is a `PROPOSED_SUBORDINATE_CONTRACT_ARTIFACT`. Platform Contract acceptance does NOT itself accept the complete: offline installation process, offline update process, upgrade model, rollback model, mirror/update-station workflow, or air-gap qualification.

The `artifact_update_mechanism` capability defines an offline update manifest (`cybrik.offline-install-update-manifest.v1.schema.json`) requiring:
- `release_tag`
- `operator_trust_root` (key ID, fingerprint, algorithm)
- Array of `artifacts` with strict hex SHA-256 validation and unique paths.
- `canonicalization_scheme`: strictly required to be "RFC_8785_JCS".
- Canonical Signature Recipe: The `bundle_signature` MUST be computed as the detached cryptographic signature over the canonical JSON (RFC 8785 JSON Canonicalization Scheme - JCS) representation of the offline manifest object omitting the `bundle_signature` field itself, verified against the `operator_trust_root` public key.
- `migration_reversibility_guaranteed: true`
- `rollback_procedure_reference`
- `update_station_workflow`

## 8. Normative Two-Phase Validation Requirement

Platform contract artifacts MUST pass a strict two-phase validation sequence to be considered structurally and semantically valid:

* **Phase 1: Structural Validation**
  Documents MUST pass structural JSON Schema validation against the normative cybrik.*.v1.schema.json schemas (draft 2020-12).

* **Phase 2: Semantic Validation**
  Documents MUST pass semantic validation enforcing referential integrity and normalization invariants that cannot be fully captured in JSON Schema:
  * **Evidence-Reference Referential Integrity**: Every `evidence_references` item in a capability slot constraint MUST resolve to a unique `conformance_evidence.test_identifier` declared within the same document.
  * **Normalized Artifact-Path Target Uniqueness**: In offline install/update manifests, there MUST be no duplicate target paths under RFC 3986 / POSIX path normalization (e.g., `/a/b` and `/a/../a/b` are duplicates and must be rejected).


## 9. Acceptance Scope

Future Platform Contract acceptance grants `ARCHITECTURE_CONTRACT_AUTHORITY_ONLY`.
It does NOT grant:
- PRODUCT_IMPLEMENTATION
- DEPLOYMENT_IMPLEMENTATION
- PROVIDER_SELECTION
- KUBERNETES_SELECTION
- VIRTUALIZATION_SELECTION
- PRODUCTION_DEPLOYMENT
- RELEASE_AUTHORITY

## 10. Required Open-Item Effect Matrix

The exact effect matrix for all relevant OPEN items is defined below.
*(Explicitly state: A schema existing in Git is not sufficient reason to mark an OPEN item closed).*

- **OPEN-1** = PARTIALLY_UNBLOCKED
- **OPEN-2** = PARTIALLY_UNBLOCKED
- **OPEN-3** = UNAFFECTED
- **OPEN-4** = RESOLVED_BY_PROPOSAL_IF_ACCEPTED, subject to independent verification
- **OPEN-5** = PARTIALLY_UNBLOCKED
- **OPEN-6** = REQUIRES_SEPARATE_DECISION
- **OPEN-7** = REQUIRES_SEPARATE_DECISION
- **OPEN-8** = REQUIRES_SEPARATE_DECISION
- **OPEN-9** = REQUIRES_SEPARATE_LEGAL_TRACK
- **OPEN-10** = RESOLVED_BY_PROPOSAL_IF_ACCEPTED
- **OPEN-11** = PARTIALLY_UNBLOCKED / SEPARATE_CLASSIFICATION_REQUIRED

## 11. Next Action Sequence

Following future Platform Contract integration, the successor action sequence is strictly:
`RECONCILE_ACCEPTED_PLATFORM_CONTRACT → REBUILD_OPEN_ITEM_DEPENDENCY_DAG → SELECT_NEXT_SINGLE_BOUNDED_TASK`.
No provider/substrate implementation authority is inferred from contract acceptance.
