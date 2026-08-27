# contracts/ — Cross-product contracts

Status: first cross-product contract packet is present, statused `PROPOSED` — **NOT ACCEPTED**
(version 0.1.0). No contract has been accepted; no product may implement any of these until
explicit Founder acceptance (ADR-0001 D5).

* **[Platform Contract Proposal](platform/CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md)**: `ACCEPTED (Founder, 2026-08-24) — ARCHITECTURE CONTRACT AUTHORITY ONLY` (v0.1.0)
  * Defines the 13 foundational capability slots required from underlying infrastructure to support the product. Evaluated under the strict boundaries of ADR-0015.
* **[Storage S3-Compatibility Subset Specification](storage/CYBRIK-S3-COMPATIBILITY-SUBSET-V1-SPECIFICATION.md)**: `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` (v0.1.0-proposed)
  * Defines the normative minimum S3-compatible object storage subset interface under Platform Contract Slot 5 (`storage`), elaborating open item `OPEN-2` (`S3_COMPATIBILITY_MINIMUM_CONTRACT`).
* **[Offline Installation & Update Manifest Specification](lifecycle/CYBRIK-OFFLINE-INSTALL-UPDATE-V1-SPECIFICATION.md)**: `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` (v0.1.0-proposed)
  * Defines the normative offline installation, air-gapped update manifest, and atomic rollback specification under Platform Contract Slot 13 (`artifact_update_mechanism`), elaborating open item `OPEN-1` (`OFFLINE_INSTALL_UPDATE_CONTRACT`).
* **[Provider Capability Negotiation Specification](platform/CYBRIK-PROVIDER-CAPABILITY-NEGOTIATION-V1-SPECIFICATION.md)**: `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` (v0.1.0-proposed)
  * Defines the normative provider capability advertisement, discovery, graceful degradation, and lease negotiation protocol under Platform Contract Proposal §6, elaborating open item `OPEN-5` (`OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION`).

This directory is the single home for interfaces shared between CYBRIK Suite products.
Product repositories implement contracts defined here; contracts are never retro-fitted from
implementations without review.

The v1 packet (all `PROPOSED — NOT ACCEPTED`): shared JSON Schemas under `json-schema/` (envelope,
data marking, capability, tool execution request/result, delegation chain, execution receipt,
approval request/decision, common defs); event bindings under `asyncapi/`; a control-plane REST
mapping under `openapi/`; MCP mapping notes under `mcp/`; the inventory/compatibility manifest
under `compatibility/`; and conformance fixtures under `examples/`. Format pins: OpenAPI 3.1.x,
JSON Schema 2020-12, AsyncAPI 3.0.0, MCP 2025-11-25 (ADR-0001 D4).

The **W2-D AI model-inference + alert-summarization packet** (all `ACCEPTED FOR IMPLEMENTATION`,
v0.1.0, not stable v1/GA; accepted at Gate W2-D — Codex under Founder delegation, 2026-07-24) is
**additive to, and disjoint from,** the v0.1 packet: it
introduces the `cybrik.model-*` / `cybrik.alert-summarization-*` JSON Schemas under `json-schema/`,
inference lifecycle events (`asyncapi/cybrik-ai-inference-events.v1.asyncapi.yaml`), an
inference-plane REST mapping (`openapi/cybrik-ai-inference-plane.v1.openapi.yaml`), provider-adapter
mapping notes under `adapters/`, its own compatibility manifest under `compatibility/`, and fixtures
under `examples/inference/`. It **reuses the accepted common-defs, data-marking, and envelope
primitives by `$ref` without modifying them**, names a model only by a policy-selected `model_class`
token (no vendor/endpoint on the wire), and grants a model **no tool/agent/approval authority**
(disjoint from the accepted Tool-Fabric packet, ADR-0004; MCP out of scope). See
`compatibility/cybrik-suite-inference-packet.v1.manifest.json`.

The **W2-F internal service-delegation + workload-identity packet** (all `ACCEPTED FOR
IMPLEMENTATION`, v0.1.0, not stable v1/GA; accepted at Gate W2-F — Codex under Founder delegation,
2026-07-24) is **additive to, and disjoint from,** both packets. It governs the IDENTITY/DELEGATION
seam in front of the W2-D inference operations (internal SOC → Cyber AI), realizing the ADR-0006
E2/E3 two-layer trust seam per ADR-0008: transport mTLS workload identity (SPIFFE-compatible, not
required) plus a short-lived (`<=120s`), asymmetric, certificate-bound (`cnf`) RFC 9068 delegation
token. It introduces the `cybrik.svc-*` JSON Schemas under `json-schema/`, delegation →
inference-operation mapping notes under `adapters/`, its own compatibility manifest under
`compatibility/`, and fixtures under `examples/svc/`. It **reuses common-defs and data-marking by
`$ref` without modifying them**, declares **no server/endpoint** and **no MCP/tool authority**, and
keeps the external-authority (A05) boundary distinct (ADR-0007 OD-3). See
`compatibility/cybrik-suite-svc-delegation-packet.v1.manifest.json`.

The **investigation-lifecycle service-delegation binding** is an additive restriction profile,
status **ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED** (v0.1.0; not stable v1/GA; Gate
W2-F-LIFECYCLE-BINDING, 2026-07-31). It reuses the
accepted W2-F schemas unchanged and fixes the relying-party audience to
`svc:cyber-ai-lifecycle`. Only `investigation.create`, `investigation.status`, and
`investigation.cancel` are externally delegatable, with one exact scope each. The
`listInvestigationCheckpoints` REST read maps to `investigation.status`/read;
`investigation.checkpoint` remains an internal producer write. `readInvestigationBundle` /
`investigation.bundle_read` is already an accepted business lifecycle operation with the accepted
v0.1.1 response contract; this accepted binding grants it no delegation authority, so no caller
may mint and no relying party may consume a bundle-read delegation token under this profile. Any
future binding requires a separately accepted implementation and contract gate. See
`compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json`.

The **W2-G organizational-hierarchy + external-authority-boundary packet** (all `ACCEPTED FOR
IMPLEMENTATION`, v0.1.0, not stable v1/GA; accepted at Gate W2-G — Codex under Founder delegation,
2026-07-24) is **additive to, and disjoint from,** all three packets above. It is the contract
realization of the ADR-0007 org-hierarchy model (accepted at Gate W2-C1) per ADR-0009 — applying
the contract delta D-1..D-8. It introduces the `cybrik.org-*` JSON Schemas under `json-schema/`
(org_node / lifecycle / membership / scope-grant / edge / external-exchange / aggregate
request+result + shared defs), org → SOC mapping notes under `adapters/`, its own compatibility
manifest under `compatibility/`, and fixtures under `examples/org/`. It **reuses common-defs and
data-marking by `$ref` without modifying them**, encodes INV-1 (hierarchy ≠ raw read) and INV-2
(external authority never super-admin) structurally, declares **no server/endpoint** and **no
MCP/tool authority**, and keeps the A05 boundary distinct. The SOC migration/API/UI it maps onto are
owned + separately gated by `cybrik-soc-command-center` and are `NOT IMPLEMENTED`. See
`compatibility/cybrik-suite-org-hierarchy-packet.v1.manifest.json`.

The **F8 receipt-integrity signature profile packet** is
`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED` (v0.2.0, not stable v1/GA) and remains
**additive to, and disjoint from,** every packet above. The delegated Governor accepts compact JWS,
RFC 8785 JCS, RFC 7638 unpadded base64url `kid`, and Ed25519-only signatures as the contract answer
to the envelope ADR-0004 F8 deferred. It introduces `cybrik.receipt-signature-statement.v1` and
`cybrik.receipt-signature-envelope.v1` under `json-schema/`, its own compatibility manifest under
`compatibility/`, and fixtures under `examples/receipt-integrity/` — including a frozen, byte-exactly
reproducible Ed25519 test vector. It **reuses `cybrik.execution-receipt.v1` and
`cybrik.common-defs.v1` by `$ref` without modifying them**. The profile digests the *exact
transmitted* receipt (removing only `receipt_digest` and `signature`, injecting no schema default),
signs an ordinary compact JWS with an included payload under EdDSA/Ed25519 only, and rejects
`alg=none` together with every embedded or remote key parameter. Version 0.2.0 adds strict raw-JSON
admission, removes the earlier `receipt_id` narrowing, binds signing-time `trust_bundle_ref` inside
the signed statement, and gives each forbidden JOSE header parameter an executable probe. It also
records the accepted F8 profile as authoritative for signed-v1 digest semantics—excluding both
`receipt_digest` and `signature`—without changing the accepted receipt-schema bytes whose prose
remains divergent. **Contract acceptance authorizes implementation against this profile only; it
creates no issuer, signer, key lifecycle, ledger, runtime, UAT, release, deployment, or production
authority.** Credential lease, workload attestation, a production issuer/signer, and the whole key
lifecycle remain open prerequisites listed in the manifest's `future_prerequisites`. See
`compatibility/cybrik-suite-receipt-integrity-proposal.v1.manifest.json` and
`../docs/adr/DELEGATED-GOVERNOR-DECISION-F8-RECEIPT-INTEGRITY.md`.

| Directory | Will contain |
|---|---|
| `openapi/` | REST API contracts (OpenAPI) |
| `asyncapi/` | Event/stream contracts (AsyncAPI) |
| `json-schema/` | Shared data object schemas (JSON Schema) |
| `mcp/` | MCP server/tool capability contracts |
| `adapters/` | Mapping notes (boundary docs): W2-D provider-adapter wire boundary; W2-F delegation → inference-operation mapping; W2-G org-hierarchy → SOC migration/API/UI mapping |
| `compatibility/` | Version compatibility matrices between products |
| `examples/` | Conformance fixtures (positive/negative) for the validators |
| `platform/` | Platform contract proposals and provider capability negotiation specifications |
| `storage/` | Platform contract storage specifications (S3 compatibility subset) |
| `lifecycle/` | Platform lifecycle and offline installation/update specifications |

## Lifecycle

Every contract file must carry a status header: `PROPOSED` → `ACCEPTED` → `DEPRECATED`.
Moving a contract out of `PROPOSED` requires explicit Founder approval. Do not scaffold
placeholder OpenAPI/schema files as if they were accepted contracts.

The previously delegated Governor authority recorded in
`../docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md` is the accepted exception for the
F8 contract-only decision; it does not replace this generic rule for other proposals. Runtime,
UAT, release, and deployment remain separately gated, and production remains Founder-controlled.

## W2-H resource-bounds packet (`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`)

This additive v0.1.0 accepted contract introduces seven `cybrik.res-*` JSON Schemas, a deterministic
fixture/replay corpus, and one compatibility manifest. Its conserved credits are additive
quantities only: CPU milliseconds, memory-byte-milliseconds, model tokens, tool calls, retrieved
bytes, and egress bytes. A child reservation subtracts from its parent at admission; spawn never
mints credits; unused credits may return only to an open parent; consumed credits and closed roots
never reopen.

Tenant authority remains credential-derived and org scope advisory; no resource identifier grants
permission. The accepted investigation `budget` object remains distinct and byte-unmodified, with
no implicit mapping. Acceptance is permission to implement later: no OpenAPI, AsyncAPI, MCP,
endpoint, runtime, UAT, T10/T11, release, deployment, or production authority follows. See
`compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json`,
`../docs/adr/ADR-0012-resource-bounds-contract-profile.md` and
`../docs/releases/GATE-W2-H-RESOURCE-BOUNDS-ACCEPTANCE-2026-08-01.md`.

## W2-K transport peer-evidence packet (`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`)

This additive v0.1.0 accepted contract defines server-neutral, fail-closed evidence derived from a
serving-side verified mutual-TLS chain. It reuses the accepted W2-F certificate-thumbprint
primitive, selects no server, conveys no authorization, and makes raw certificate material
structurally inexpressible. Anycorn `0.20.0` remains HOLD and is not installed or pinned.

The K5 live-fact amendment distinguishes every raw server row with
`artifact_scope=official_upstream_distribution` from the S1-admitted internal evaluation row
`anycorn-cybrik-uat-b1` / `0.20.0+cybrik.1`. B1 is scoped only to
`suite_uat_tool_lock_only` and is now `selected=false`, `installed=true`, `pinned=true`, and `HOLD`
after the exact D1 artifact. `D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN` records only this
live fact. `server_neutral=true` and `selected_server=null` remain unchanged; D2 and every
UAT/release gate remain HOLD or NO-GO.

The validator and fixtures are static-only. Separate processes, loopback TLS, development PKI,
PostgreSQL durability, UAT, release, deployment, and production remain out of scope. Inventory:
`compatibility/cybrik-suite-transport-peer-evidence-packet.v1.manifest.json`.

## Receipt trust and durability

`cybrik.receipt-trust-bundle.v1` and `cybrik.receipt-durability-statement.v1` are
**ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED**. They fix a public-key lifecycle, offline
verification, durable ordering, fail-closed completion, append-only replay, and retention
coupling without selecting a signer, key store, ledger, endpoint, deployment, or production
configuration. See `compatibility/cybrik-suite-receipt-trust-durability-proposal.v1.manifest.json`.

## Open-Item Elaboration Specifications (`PROPOSED (Open-Item Elaboration) — NOT ACCEPTED`)

The following normative specifications elaborate open items identified in `ADR-0015` and `CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md`. All carry status `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED` (v0.1.0-proposed) under `ARCHITECTURE_CONTRACT_AUTHORITY_ONLY`:

### 1. Storage S3-Compatibility Subset (`contracts/storage/CYBRIK-S3-COMPATIBILITY-SUBSET-V1-SPECIFICATION.md`)
* **Status:** `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED`
* **Open Item:** `OPEN-2` (`S3_COMPATIBILITY_MINIMUM_CONTRACT`)
* **Slot:** Slot 5 (`storage`)
* **Normative Schema:** `contracts/json-schema/cybrik.storage-s3-compatibility-subset.v1.schema.json`
* **Coverage:** 13 core S3 operations (`PutObject`, `GetObject`, `HeadObject`, `DeleteObject`, `DeleteObjects`, `ListObjectsV2`, `HeadBucket`, `CreateBucket`, `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`, `ListParts`), WORM/Object Lock compliance mode, single-defect negative fixtures, and path-style addressing.

### 2. Offline Installation & Update Manifest (`contracts/lifecycle/CYBRIK-OFFLINE-INSTALL-UPDATE-V1-SPECIFICATION.md`)
* **Status:** `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED`
* **Open Item:** `OPEN-1` (`OFFLINE_INSTALL_UPDATE_CONTRACT`)
* **Slot:** Slot 13 (`artifact_update_mechanism`)
* **Normative Schema:** `contracts/json-schema/cybrik.offline-install-update-manifest.v1.schema.json`
* **Coverage:** Air-gapped bundle archive packaging, detached Ed25519 signatures over RFC 8785 JCS canonical manifest, manifest_sequence anti-rollback, zero symlink pax archive, operator root trust store, exact SHA-256 artifact pinning, and deterministic four-phase update workflow with atomic rollback.

### 3. Provider Capability Negotiation Protocol (`contracts/platform/CYBRIK-PROVIDER-CAPABILITY-NEGOTIATION-V1-SPECIFICATION.md`)
* **Status:** `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED`
* **Open Item:** `OPEN-5` (`OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION`)
* **Placement:** Platform Contract Proposal §6
* **Normative Schema:** `contracts/json-schema/cybrik.provider-capability-negotiation.v1.schema.json`
* **Coverage:** Dynamic capability advertisement, discovery, negotiation, graceful degradation, and agreed capability lease handshake with fail-closed enforcement on all mandatory capability slots.
