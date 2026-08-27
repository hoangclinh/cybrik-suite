# docs/contracts/ — CYBRIK Cross-Product Contract Index

**Status:** `ACTIVE — DOCUMENTATION INDEX`

This directory provides the documentation index for all cross-product contracts, platform contract specifications, and open-item elaborations across the CYBRIK Autonomous Security Operations platform.

The canonical contract source files, JSON schemas, wire definitions, and conformance fixtures reside in [`contracts/`](../../contracts/README.md).

---

## 1. Platform Contract Specifications & Open-Item Elaborations

The following normative specifications elaborate the foundational platform contract slots and open items established in `ADR-0015` and `CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md`. All open-item elaboration specifications carry status `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` under `ARCHITECTURE_CONTRACT_AUTHORITY_ONLY`:

| Specification Document | Open Item / Slot | Status | Normative Schema |
|---|---|---|---|
| [`CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md`](../../contracts/platform/CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md) | 13 Platform Slots (§5.2) | `ACCEPTED (Founder, 2026-08-24) — ARCHITECTURE CONTRACT AUTHORITY ONLY` | [`cybrik.platform-contract.v1.schema.json`](../../contracts/json-schema/cybrik.platform-contract.v1.schema.json) |
| [`CYBRIK-S3-COMPATIBILITY-SUBSET-V1-SPECIFICATION.md`](../../contracts/storage/CYBRIK-S3-COMPATIBILITY-SUBSET-V1-SPECIFICATION.md) | `OPEN-2` / Slot 5 (`storage`) | `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` | [`cybrik.storage-s3-compatibility-subset.v1.schema.json`](../../contracts/json-schema/cybrik.storage-s3-compatibility-subset.v1.schema.json) |
| [`CYBRIK-OFFLINE-INSTALL-UPDATE-V1-SPECIFICATION.md`](../../contracts/lifecycle/CYBRIK-OFFLINE-INSTALL-UPDATE-V1-SPECIFICATION.md) | `OPEN-1` / Slot 13 (`artifact_update_mechanism`) | `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` | [`cybrik.offline-install-update-manifest.v1.schema.json`](../../contracts/json-schema/cybrik.offline-install-update-manifest.v1.schema.json) |
| [`CYBRIK-PROVIDER-CAPABILITY-NEGOTIATION-V1-SPECIFICATION.md`](../../contracts/platform/CYBRIK-PROVIDER-CAPABILITY-NEGOTIATION-V1-SPECIFICATION.md) | `OPEN-5` / §6 (Capability Negotiation) | `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` | [`cybrik.provider-capability-negotiation.v1.schema.json`](../../contracts/json-schema/cybrik.provider-capability-negotiation.v1.schema.json) |

### 1.1 Slot 5: Storage S3-Compatibility Subset (`OPEN-2`)
* **Specification:** [`contracts/storage/CYBRIK-S3-COMPATIBILITY-SUBSET-V1-SPECIFICATION.md`](../../contracts/storage/CYBRIK-S3-COMPATIBILITY-SUBSET-V1-SPECIFICATION.md)
* **Status:** `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` (v0.1.0-proposed)
* **Normative Schema:** `contracts/json-schema/cybrik.storage-s3-compatibility-subset.v1.schema.json`
* **Summary:** Defines the exact 17 mandatory S3 operations required for control plane, data plane, and WORM compliance persistence (`PutObject`, `GetObject`, `HeadObject`, `DeleteObject`, `DeleteObjects`, `ListObjectsV2`, `HeadBucket`, `CreateBucket`, `PutObjectRetention`, `GetObjectRetention`, `PutObjectLegalHold`, `GetObjectLegalHold`, `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`, `ListParts`). Mandates version-scoped Object Lock WORM, path-style addressing, AWS SigV4 authentication, and strict `BadDigest`/`InvalidDigest` error dispatch.

### 1.2 Slot 13: Offline Installation & Update Manifest (`OPEN-1`)
* **Specification:** [`contracts/lifecycle/CYBRIK-OFFLINE-INSTALL-UPDATE-V1-SPECIFICATION.md`](../../contracts/lifecycle/CYBRIK-OFFLINE-INSTALL-UPDATE-V1-SPECIFICATION.md)
* **Status:** `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` (v0.1.0-proposed)
* **Normative Schema:** `contracts/json-schema/cybrik.offline-install-update-manifest.v1.schema.json`
* **Summary:** Defines air-gapped bundle packaging, detached cryptographic signatures over RFC 8785 JCS canonicalized manifests, operator-owned root trust anchors, exact SHA-256 artifact pinning, and a four-phase update workflow with atomic rollback guarantees.

### 1.3 Capability Negotiation Protocol (`OPEN-5`)
* **Specification:** [`contracts/platform/CYBRIK-PROVIDER-CAPABILITY-NEGOTIATION-V1-SPECIFICATION.md`](../../contracts/platform/CYBRIK-PROVIDER-CAPABILITY-NEGOTIATION-V1-SPECIFICATION.md)
* **Status:** `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` (v0.1.0-proposed)
* **Normative Schema:** `contracts/json-schema/cybrik.provider-capability-negotiation.v1.schema.json`
* **Summary:** Defines the dynamic advertisement, discovery, negotiation, graceful degradation, and lease issuance handshake between CYBRIK Core and substrate capability providers. Enforces strict fail-closed boundaries on all mandatory slots.

---

## 2. Accepted Cross-Product Contract Packets

The following contract packets have been formally accepted through the CYBRIK SDLC governance process:

* **W2-D AI Model Inference & Alert Summarization:** `ACCEPTED FOR IMPLEMENTATION` (v0.1.0; Gate W2-D). See [`contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json).
* **W2-F Internal Service Delegation & Workload Identity:** `ACCEPTED FOR IMPLEMENTATION` (v0.1.0; Gate W2-F). See [`contracts/compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json).
* **W2-G Organizational Hierarchy & Authority Boundary:** `ACCEPTED FOR IMPLEMENTATION` (v0.1.0; Gate W2-G). See [`contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json).
* **F8 Receipt Integrity Signature Profile:** `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED` (v0.2.0; Delegated Governor Decision). See [`contracts/compatibility/cybrik-suite-receipt-integrity-proposal.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-receipt-integrity-proposal.v1.manifest.json).
* **W2-H Resource Bounds Packet:** `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED` (v0.1.0; Gate W2-H). See [`contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json).
* **W2-K Transport Peer-Evidence Packet:** `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED` (v0.1.0; Gate W2-K). See [`contracts/compatibility/cybrik-suite-transport-peer-evidence-packet.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-transport-peer-evidence-packet.v1.manifest.json).
* **Receipt Trust & Durability:** `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED` (v0.1.0). See [`contracts/compatibility/cybrik-suite-receipt-trust-durability-proposal.v1.manifest.json`](../../contracts/compatibility/cybrik-suite-receipt-trust-durability-proposal.v1.manifest.json).

---

## 3. Validation Toolchain

To validate all schemas, fixtures, and contract invariants across the repository:

```bash
# Run all 31 canonical validators
npm --prefix tools/contract-validation run validate

# Run unit test suites (including platform, s3, transport, receipt, and governance tests)
npm --prefix tools/contract-validation test

# Run dedicated platform contract validation suite
npm --prefix tools/contract-validation run validate:platform
```
