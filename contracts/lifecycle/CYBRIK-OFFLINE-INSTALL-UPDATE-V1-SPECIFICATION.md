# CYBRIK Offline Installation & Update Manifest Contract Specification (v0.1.0-proposed)

- **Document Status:** `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED`
- **Contract Version:** `0.1.0`
- **Platform Capability Slot:** `Slot 13: artifact_update_mechanism`
- **Authority:** Architecture Contract Authority Only (Subordinate to ADR-0015 & Platform Contract Proposal v0.1.0)
- **Decider:** FOUNDER
- **Normative Invariant Citations:** `INV-1`, `INV-3`, `INV-5`, `INV-17`, `INV-21`, `INV-22`, `ADR-0001`, `ADR-0005`, `ADR-0006`, `ADR-0008`, `ADR-0015`

---

## 1. Executive Summary & Normative Scope

### 1.1 Context & Purpose
Under the CYBRIK Autonomous Security Operations Platform Contract (ADR-0015 §5.2), capability **Slot 13 (`artifact_update_mechanism`)** mandates a cryptographically verifiable, deterministic, and provider-neutral mechanism for offline installation, air-gapped updates, trust root anchoring, and rollback guarantees.

This specification elaborates **OPEN-1 (`OFFLINE_INSTALL_UPDATE_CONTRACT`)**, providing the complete normative requirements for:
1. Air-gapped bundle archive packaging (POSIX.1-2001 PAX format), directory hierarchy, and OCI image layout.
2. Cryptographic signature and trust anchoring via detached Ed25519 (strictly 64 octets) and ECDSA P-256 (IEEE P1363 64 octets or strict DER) signatures over RFC 8785 JSON Canonicalization Scheme (JCS) and I-JSON (RFC 7493) payloads.
3. Operator-owned root trust store, monotone sequence/version numbers, anti-rollback freshness constraints, offline key rotation state machines, and Key Revocation Lists (KRL/CRL).
4. Exact SHA-256 digest and byte-size pinning across every container image, Python wheel, binary, database migration script, and metadata file in the archive, with exhaustive 1:1 archive entry whitelisting (fail-closed extraction abort on any unlisted entry).
5. Deterministic four-phase update-station execution workflow with closed declarative action grammar (forbidding arbitrary shell execution), pre-apply journaling/snapshot, crash-replay recovery, and idempotent procedural rollback.
6. Formal binding to the schema `cybrik.offline-install-update-manifest.v1.schema.json`.

### 1.2 Normative Conformance Language
The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in BCP 14 ([RFC 2119], [RFC 8174]) when, and only when, they appear in all capitals, as shown here.

### 1.3 Strict Non-Claims and Operational Boundaries
In accordance with ADR-0015 §1.2 and Platform Contract §1.1, this specification maintains strict non-claims:
- **NO Production Deployment Authority:** Acceptance of this specification establishes an architectural and contract boundary only. It does **NOT** authorize deployment to production environments.
- **NO Founder Gate Bypass:** This specification does **NOT** bypass Founder release gates, staging qualification gates, or RC1 baseline controls.
- **NO Runtime Engine Selection:** This specification does **NOT** select a specific container runtime (e.g., containerd vs CRI-O), hypervisor, or Kubernetes distribution (retaining `OPEN-6` and `OPEN-7` under separate Founder decision).
- **NO Remote Network Dependency:** Verification and execution MUST NOT initiate outbound network connections or rely on remote trust endpoints (`jku`, `jwk`, `x5u`, `bundle_uri`).

---

## 2. Air-Gapped Bundle Architecture & Archive Layout

### 2.1 Archive Container Packaging
An offline installation or update bundle MUST be packaged as a single POSIX.1-2001 PAX format archive (optionally compressed using `gzip` or `zstandard`, indicated by `.tar`, `.tar.gz`, or `.tar.zst` file extensions).

The archive root MUST contain exactly one canonical update manifest named `manifest.json` and its companion detached cryptographic signature named `manifest.sig` at the top level. All referenced artifact files MUST reside within subdirectories relative to the archive root.

```text
cybrik-bundle-<release_tag>.tar
├── manifest.json                                 # Canonical update manifest (RFC 8785 JCS / I-JSON)
├── manifest.sig                                  # Detached cryptographic signature (64-byte Ed25519/ECDSA)
├── images/                                       # OCI container image tarballs / layout
│   ├── cybrik-soc-portal-v1.2.3.tar
│   ├── cybrik-ai-api-v1.2.3.tar
│   └── cybrik-fabric-control-v1.2.3.tar
├── wheels/                                       # Immutable Python wheels
│   ├── cybrik_ai_core-0.1.0-py3-none-any.whl
│   └── cybrik_fabric_control-0.1.0-py3-none-any.whl
├── binaries/                                     # Architecture-pinned executables
│   └── cybrik-executor-linux-amd64
├── migrations/                                   # Transactional DB schema migrations
│   ├── 0001_initial_schema.up.sql
│   ├── 0001_initial_schema.down.sql
│   ├── 0002_add_audit_tables.up.sql
│   └── 0002_add_audit_tables.down.sql
├── configs/                                      # Declarative configuration definitions
│   └── deployment-profile.json
└── procedures/                                   # Human/Automated runbooks & rollback guides
    └── ROLLBACK-PROCEDURE.md
```

### 2.2 Canonical Path Rules & Strict Archive Traversal Safety
To prevent path traversal, directory escape, alias collisions, archive injection, and malicious file creation during extraction:

1. **Relative Path Construction:** Every entry in `artifacts[].path` MUST be a relative path strictly matching the regular expression:
   ```regex
   ^(?!/)(?!^\./)(?!.*\.\.)(?!.*(?:/\.|//|/$))[a-z0-9._/-]+[a-z0-9._-]$
   ```
2. **Prohibited Path Elements:**
   - MUST NOT start with a forward slash (`/`) or dot-slash (`./`).
   - MUST NOT contain parent directory traversal sequences (`..`).
   - MUST NOT contain hidden directory dot-segments (`/.` or `/../`).
   - MUST NOT contain double slashes (`//`).
   - MUST NOT terminate with a trailing slash (`/`).
3. **Normalized Path Uniqueness:** All artifact paths MUST be unique under POSIX and RFC 3986 path normalization. If two artifacts resolve to the same normalized filesystem location (e.g., `images/app.tar` and `images/./app.tar`), the bundle MUST fail validation immediately.
4. **Symlink & Hardlink Proscription:** Bundles MUST NOT contain symlinks targeting files outside the bundle root, broken symlinks, parent symlinks (`..`), or hardlinks pointing across extraction boundaries.
5. **Exhaustive 1:1 Archive Entry Manifest Binding & Fail-Closed Whitelisting:**
   - EVERY entry in the tar archive (excluding the root directory itself, `manifest.json`, and `manifest.sig`) MUST be explicitly listed in `artifacts[]` with its exact relative path, SHA-256 digest, and byte size.
   - Any unlisted file, unrecognized directory entry, hardlink, absolute symlink, parent-traversing symlink, FIFO / named pipe, unix socket, block device node, or character device node encountered during archive traversal MUST cause an immediate fail-closed extraction abort, workspace purge, and recording of an `ARCHIVE_UNLISTED_ENTRY_ABORT` audit violation.

### 2.3 Container Image Layout Requirements
Container images within the `images/` directory MUST conform to one of two standard formats:
1. **OCI Image Archive (`.tar`):** An archive generated per the [OCI Image Specification v1.0+], containing `oci-layout`, `index.json`, `manifest.json`, and layer blobs.
2. **Docker v2 Image Archive (`.tar`):** A standard image tarball generated via `docker save` or `podman save`, containing manifest, config, and layer tarballs.

Every image archive MUST be pinned by its exact SHA-256 digest in `artifacts[]`. The update station MUST load images directly into the local host container storage without performing remote image pulls.

### 2.4 Database Migration Script Packaging
Database migration scripts within the `migrations/` directory MUST satisfy:
1. **Bidirectional Migration Pairs:** Every forward migration script (`<seq>_<name>.up.sql`) MUST have an accompanying reverse migration script (`<seq>_<name>.down.sql`).
2. **Transactional Execution:** All SQL statements in a migration script MUST be executable within an ACID transaction block (`BEGIN` ... `COMMIT`).
3. **Idempotence & Reversibility:** Down-migrations MUST cleanly restore the database schema and constraints to the exact pre-migration state without data corruption. Manifests MUST declare `"migration_reversibility_guaranteed": true`.

---

## 3. Cryptographic Signing, Key Management & Trust Store Model

### 3.1 Canonical Manifest Signing Recipe (RFC 8785 JCS & RFC 7493 I-JSON)
To eliminate signature malleability caused by JSON whitespace, key ordering, and floating-point variances, manifest signatures MUST be generated and verified using the **RFC 8785 JSON Canonicalization Scheme (JCS)** under strict **I-JSON (RFC 7493)** constraints.

#### Strict I-JSON & JCS Invariants:
1. **Duplicate Key Prohibition:** In accordance with RFC 7493 §2.2 and RFC 8785 §3.2.4, JSON objects MUST NOT contain duplicate keys. Update-station JSON parsers MUST operate in strict duplicate-rejection mode and fail closed immediately upon encountering duplicate object keys.
2. **IEEE-754 Safe Integer Range Invariant:** In accordance with RFC 7493 §2.1, all numeric values (e.g., `size_bytes`, `timeout_seconds`, sequence numbers) MUST be exact integers within the IEEE-754 double-precision safe integer range $[-(2^{53}-1), 2^{53}-1]$ (i.e. $[-9007199254740991, 9007199254740991]$). Floating-point values, scientific notation, or numbers outside this range MUST be rejected.
3. **Strict UTF-8 Encoding:** Payloads MUST be strictly UTF-8 encoded without a Byte Order Mark (BOM).
4. **Detached Signature File:** The primary cryptographic signature MUST be provided as a detached file `manifest.sig` (located in the pax archive root or delivered alongside a standalone manifest). The signature MAY additionally be mirrored in the `bundle_signature` field of `manifest.json`.

#### Signature Computation Algorithm:
1. Construct the complete manifest JSON object containing all required fields except `bundle_signature`.
2. Apply RFC 8785 JCS canonicalization to serialize the object into an unambiguous, deterministic UTF-8 byte stream $M_{canon}$.
3. Compute the cryptographic signature $\Sigma$ over $M_{canon}$ using the operator private key corresponding to `operator_trust_root.signing_key_id`:
   $$\Sigma = \text{Sign}(K_{priv}, M_{canon})$$
4. Write $\Sigma$ to `manifest.sig` as raw binary bytes or hexadecimal/base64 text.
5. If mirroring into `manifest.json`, inject $\Sigma$ into the `bundle_signature` property formatted according to the algorithm profile (128 hex characters or 88 base64 characters).

```mermaid
flowchart TD
    A[Raw Manifest Object] --> B[Remove 'bundle_signature' Field]
    B --> C[Validate Strict I-JSON Rules: No Dups, Safe Ints]
    C --> D[Apply RFC 8785 JCS Canonicalization]
    D --> E[Canonical UTF-8 Bytes M_canon]
    E --> F[Cryptographic Sign with K_priv]
    F --> G[Write Detached manifest.sig]
    G --> H[Inject 'bundle_signature' into manifest.json]
```

#### Verification Algorithm:
1. Parse `manifest.json` and extract `bundle_signature` (or read detached `manifest.sig`).
2. Verify strict I-JSON rules: reject if duplicate keys or out-of-range numbers are present.
3. Create a shallow copy of the manifest object, deleting the `bundle_signature` key.
4. Canonicalize the remaining object using RFC 8785 JCS into byte sequence $M'_{canon}$.
5. Look up the trusted public key $K_{pub}$ in the local operator root trust store matching `signing_key_id` and `public_key_fingerprint`.
6. Verify $\Sigma$ against $M'_{canon}$ using $K_{pub}$ and `operator_trust_root.signature_algorithm`:
   $$\text{Verify}(K_{pub}, M'_{canon}, \Sigma) \stackrel{?}{=} \text{TRUE}$$
7. If verification fails, the bundle MUST be rejected immediately.

### 3.2 Supported Signature Algorithms & Parameter Closure
The `operator_trust_root.signature_algorithm` MUST be explicitly declared and restricted to one of the following approved cryptographic suites:

| Algorithm Identifier | Description | Key Specification | Signature Encoding |
|---|---|---|---|
| `ed25519` | EdDSA over Curve25519 (RFC 8032) — **REQUIRED / RECOMMENDED** | 256-bit Ed25519 public key (32 octets) | Exactly 64 octets (128 hex characters conforming to `^[a-f0-9]{128}$` or 88 Base64 characters conforming to `^[A-Za-z0-9+/]{86}==$`) |
| `ecdsa-p256-sha256` | ECDSA over NIST P-256 with SHA-256 (FIPS 186-4) | 256-bit P-256 public key (SPKI DER) | IEEE P1363 ($r \|\| s$, exactly 64 octets, 128 hex chars or 88 base64 chars) or strict ASN.1 DER (70–72 octets Base64) |

#### Cryptographic Rejections & Proscriptions:
- **RSA-PSS / RSA Suites Rejected:** RSA signatures (including `rsa-pss-sha256`, PKCS#1 v1.5) are PROHIBITED and REJECTED due to key-size ambiguity, padding vulnerabilities, and excessive parsing overhead in air-gapped micro-verifiers.
- **Embedded / In-Band Header Signatures Rejected:** In-band signature envelopes (e.g., JOSE/JWT headers with embedded JWK/x5c key declarations) MUST NOT be used for bundle authentication.
- **Weak Primitives Rejected:** `none`, `md5`, `sha1`, `secp256k1`, `dsa` MUST be rejected unconditionally.

### 3.3 Operator Root Trust Store Architecture
Air-gapped environments MUST maintain a local, operator-curated, write-protected root trust store on the update station host.

```text
/etc/cybrik/trust-store/
├── trust-store.json                              # Machine-readable trust root registry
├── trust-store.sig                               # Detached operator signature over trust-store.json
├── keys/                                         # Public key material (SPKI PEM / DER)
│   ├── key-ops-root-2026.pub.pem
│   └── key-ops-release-2026a.pub.pem
└── crl/                                          # Signed Key Revocation Lists
    └── crl-2026-08.json
```

#### Key Fingerprint Specification:
Key fingerprints MUST strictly conform to the format `^sha256:[a-f0-9]{64}$`, computed as the lowercase SHA-256 hexadecimal digest of the canonical SubjectPublicKeyInfo (SPKI) DER byte encoding of the public key, prefixed with `sha256:`.

The `trust-store.json` file registers trusted signing keys and monotone sequence watermarks:
```json
{
  "trust_store_version": 1,
  "minimum_freshness_sequence": 1,
  "operator_identity": "urn:cybrik:operator:sovereign-soc",
  "trusted_roots": [
    {
      "signing_key_id": "key-ops-release-2026a",
      "public_key_fingerprint": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "signature_algorithm": "ed25519",
      "public_key_path": "keys/key-ops-release-2026a.pub.pem",
      "status": "ACTIVE",
      "valid_from": "2026-01-01T00:00:00Z",
      "valid_until": "2027-01-01T00:00:00Z"
    }
  ]
}
```

### 3.4 Signed Operator Trust-Store Lifecycle & Anti-Rollback Freshness Constraints
Keys and trust stores in the operator trust store transition through a strict monotone lifecycle with anti-rollback freshness enforcement:

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: Operator Commissioning & SPKI Binding
    ACTIVE --> RETIRING: Successor Key Deployed in Trust Store
    RETIRING --> RETIRED: Rotation Grace Period Expired
    ACTIVE --> REVOKED: Compromise / Key Emergency
    RETIRING --> REVOKED: Compromise / Key Emergency
    RETIRED --> REVOKED: Retrospective Compromise
    REVOKED --> [*]
```

1. **Monotone Sequence Numbers:** The trust store MUST maintain a strictly increasing monotone positive integer sequence `trust_store_version`.
2. **Anti-Rollback Freshness Enforcement:** Update stations MUST persist the high-watermark `trust_store_version` and reject any incoming trust store where `trust_store_version < current_watermark`.
3. **Bundle Freshness Invariant:** Manifests MUST NOT reference keys or versions below `minimum_freshness_sequence`. Any update bundle signed with a key marked `RETIRED` or revoked in `crl.json` MUST be rejected immediately.
4. **Key Lifecycle States:**
   - **ACTIVE:** Authorized to sign new update bundles and verify current installations.
   - **RETIRING:** Authorized to verify existing and in-flight bundles; prohibited from signing new bundles.
   - **RETIRED:** Retained for historical audit and rollback verification only; cannot sign.
   - **REVOKED:** Immediately prohibited from all verification and installation activities.

### 3.5 Offline Revocation Model (KRL / CRL)
1. **Revocation List Distribution:** In air-gapped environments, revocation lists MUST be distributed out-of-band via operator media and cryptographically signed by the operator master key.
2. **Mandatory Revocation Checking:** Before validating a manifest signature, the update station verifier MUST query the local CRL. If either `signing_key_id` or `public_key_fingerprint` appears in the active revocation list, verification MUST terminate with a fatal `KEY_REVOKED` error.
3. **Prohibition of Network Lookups:** The verifier MUST NOT attempt online OCSP queries or fetch CRLs over network interfaces.

---

## 4. Exact Digest Pinning & Artifact Integrity Verification

### 4.1 SHA-256 Digest Pinning
Every artifact included in the bundle archive MUST have an exact SHA-256 cryptographic checksum declared in the `artifacts[]` table of `manifest.json`.

- The `sha256` value MUST be a lowercase 64-character hexadecimal string conforming to `^[a-f0-9]{64}$`.
- The `size_bytes` value MUST be an exact positive integer representing the byte length of the uncompressed or stored artifact file.

```json
{
  "name": "cybrik-ai-api-image",
  "path": "images/cybrik-ai-api-v1.2.3.tar",
  "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
  "size_bytes": 412589056
}
```

### 4.2 Streaming Verification Protocol & Exhaustive Entry Check
During bundle ingestion and verification:
1. **Pre-Allocation & Disk Quota Check:** The update station calculates the sum of all `artifacts[].size_bytes` plus required staging headroom ($\ge 2.5\times$). If available disk storage is insufficient, ingestion terminates before extraction.
2. **Streaming Digest Calculation:** As files are extracted or read from the archive, their contents are streamed through a SHA-256 digest accumulator.
3. **Fail-Closed Digest Matching & Whitelist Reconciler:**
   - The computed SHA-256 digest and total byte count are compared against the manifest entries. If any byte diverges or the digest does not match, the entire staging workspace is purged and the update is rejected.
   - Every archive entry is reconciled against `artifacts[]`. Any unlisted file or unexpected node type immediately halts the workflow.

---

## 5. Deterministic Update Station Workflow Engine & Crash-Atomic Cutover

### 5.1 Update Station State Machine
The update station executes a deterministic four-stage lifecycle with persistent pre-apply journaling and crash recovery:

```mermaid
stateDiagram-v2
    [*] --> RECEIVED: Ingest Bundle Archive
    RECEIVED --> STAGED_VERIFIED: Stage 1: Crypto & Hash Verification Pass
    RECEIVED --> REJECTED: Stage 1 Verification Failure
    STAGED_VERIFIED --> PREFLIGHT_VALIDATED: Stage 2: Preflight Checks Pass
    STAGED_VERIFIED --> FAILED_PREFLIGHT: Stage 2 Preflight Failure
    PREFLIGHT_VALIDATED --> JOURNAL_RECORDED: Stage 2: Write Atomic Pre-Apply Journal
    JOURNAL_RECORDED --> APPLYING: Stage 3: Begin Atomic Cutover
    APPLYING --> CUTOVER_ACTIVE: All Apply Steps & Health Probes Pass
    APPLYING --> ROLLING_BACK: Apply Step Failure / Health Probe Timeout / Crash Recovery
    ROLLING_BACK --> ROLLED_BACK: Stage 4: Rollback Steps Complete
    ROLLING_BACK --> UNRECOVERABLE: Rollback Step Failure (Manual Intervention)
    CUTOVER_ACTIVE --> [*]
    REJECTED --> [*]
    FAILED_PREFLIGHT --> [*]
    ROLLED_BACK --> [*]
```

### 5.2 Closed Declarative Action Grammar (No Arbitrary Shell Execution)
To eliminate arbitrary command injection and privilege escalation vectors, workflow steps MUST NOT contain arbitrary shell script commands or unconstrained binary executions.

All workflow steps (`preflight_steps`, `apply_steps`, `rollback_steps`) MUST be structured declarative objects conforming to the closed action grammar:

| Action Verb | Purpose & Scope | Target Specification | Execution Invariants |
|---|---|---|---|
| `VERIFY_DIGEST` | Validate cryptographic SHA-256 digest and byte size | Artifact path or volume reference | Read-only; fail-closed on mismatch |
| `PRELOAD_OCI_IMAGE` | Ingest OCI image archive into local container runtime storage | Path to `.tar` image archive in `images/` | No network egress; local socket only |
| `APPLY_SQL_MIGRATION` | Execute forward (`.up.sql`) or reverse (`.down.sql`) migration script | Path to SQL migration script in `migrations/` | Wrapped in ACID transaction block |
| `HEALTH_PROBE` | Execute deterministic HTTP GET or TCP readiness/liveness probe | Local endpoint URI (e.g. `http://127.0.0.1:8080/healthz`) | Timeout bounded; failure triggers rollback |
| `RESTORE_DATABASE_SNAPSHOT` | Restore database schema/data from verified pre-apply snapshot | Path to pre-apply snapshot file | Idempotent restoration on rollback |

#### Declarative Step Object Structure:
```json
{
  "step_id": "apply-load-portal-image",
  "action": "PRELOAD_OCI_IMAGE",
  "target": "images/cybrik-soc-portal-v0.1.0.tar",
  "description": "Preload SOC portal container image into local runtime storage",
  "timeout_seconds": 60,
  "parameters": {}
}
```

### 5.3 Stage 1: Ingestion, Strict Archive Traversal & Staged Verification
In Stage 1, the update station processes the raw bundle in an isolated staging workspace (`/tmp/cybrik-update-staging-<uuid>/`) with permissions `0700` without modifying live production state:

1. **Phase 1 Structural Schema Validation:** Validate `manifest.json` against `cybrik.offline-install-update-manifest.v1.schema.json`.
2. **Phase 2 Semantic Path & Whitelist Validation:** Normalize all `artifacts[].path` entries; ensure no duplicate paths, traversal tokens, or unlisted archive entries exist.
3. **Trust Anchor Resolution:** Retrieve `operator_trust_root.signing_key_id` from `/etc/cybrik/trust-store/trust-store.json`. Verify key is `ACTIVE` and not revoked in `crl.json`. Verify public key fingerprint matches `operator_trust_root.public_key_fingerprint` conforming to `^sha256:[a-f0-9]{64}$`.
4. **Canonical Signature Verification:** Reconstruct canonical manifest bytes omitting `bundle_signature` via RFC 8785 JCS under I-JSON rules; verify `bundle_signature` (or `manifest.sig`) with the trusted public key.
5. **Artifact Integrity Verification:** Streamingly unpack each artifact to the staging directory; compute SHA-256 digest and byte size; verify 100% concordance with `artifacts[]`.

### 5.4 Stage 2: Pre-Apply Validation, Pre-Apply Journaling & Database Snapshot
Stage 2 executes all declarative actions specified in `update_station_workflow.preflight_steps` sequentially:

1. **Storage & Capacity Probing:** Verify disk volumes for database, container image store, and application logs have at least 2.5× the required deployment capacity.
2. **Host Dependency & Substrate Checks:** Validate container runtime socket responsiveness, kernel parameter compliance, and isolation substrate readiness (ADR-0005 S0–S4).
3. **Database Preflight & Consistent Snapshot:**
   - Verify active database connectivity and transactional lock availability.
   - Generate a consistent pre-update database snapshot written to `/var/backups/cybrik/snapshots/pre-<bundle_id>.sql`.
   - Verify existence of corresponding down-migration scripts for all pending migrations.
4. **Atomic Pre-Apply Journaling:**
   - Write persistent update journal to `/var/lib/cybrik/journal/<bundle_id>.journal` with `fsync()` recording:
     * `bundle_identifier`
     * `release_tag`
     * `pre_update_release_tag`
     * `journal_state`: `"PREFLIGHT_COMMITTED"`
     * `snapshot_path`: `/var/backups/cybrik/snapshots/pre-<bundle_id>.sql`
     * `completed_steps`: `[]`

If any preflight step fails, the update station halts immediately, records diagnostics, purges the staging area, and leaves the live system unaffected.

### 5.5 Stage 3: Atomic Cutover & Crash-Replay Recovery
Stage 3 executes all declarative actions specified in `update_station_workflow.apply_steps` in strict deterministic order:

1. **Journal State Transition:** Atomically update journal state to `"APPLYING"` with `fsync()`.
2. **Container Image Pre-Loading (`PRELOAD_OCI_IMAGE`):** Load OCI image tarballs from `images/` into the local container runtime image store.
3. **Transactional Database Migration (`APPLY_SQL_MIGRATION`):**
   - Open database transaction block.
   - Execute forward migration scripts (`migrations/*.up.sql`) in sequential numerical order.
   - Commit transaction and record migration state in schema history table.
4. **Workload Rollout & Cutover:**
   - Deploy new container workload instances alongside existing versions (blue-green or rolling canary).
   - Switch local traffic router / ingress endpoints to new instances.
   - Drain active connections from superseded instances.
5. **Post-Deployment Health Probe Gate (`HEALTH_PROBE`):**
   - Execute local readiness and liveness probes against core service endpoints (`/healthz`, `/readyz`).
   - Monitor error rates and latency across a configurable stabilization window (default: 120 seconds).
6. **Crash-Replay Recovery:**
   - If a host crash, kernel panic, or power outage occurs while journal state is `"APPLYING"`, the update-station verifier upon daemon restart reads `/var/lib/cybrik/journal/<bundle_id>.journal`.
   - If recovery is triggered, the verifier deterministically replays remaining idempotent apply steps or initiates automated rollback using the recorded pre-update database snapshot.
7. **Completion:** On successful stabilization, mark journal state as `"CUTOVER_ACTIVE"`, decommission superseded container instances, and archive the installation manifest to `/var/log/cybrik/updates/`.

### 5.6 Stage 4: Automated & Idempotent Procedural Rollback
If any error occurs during Stage 3 (`apply_steps`), if post-deployment health probes fail before stabilization completes, or if crash recovery aborts:

1. **Immediate Execution of Rollback Steps:** The update station immediately transitions journal state to `"ROLLING_BACK"` and executes `update_station_workflow.rollback_steps` referencing `rollback_procedure_reference`.
2. **Traffic Reversion:** Traffic routing and internal service delegations are immediately switched back to the previous stable workload instances.
3. **Database Schema Rollback (`APPLY_SQL_MIGRATION` / `RESTORE_DATABASE_SNAPSHOT`):**
   - If database migrations were committed, execute reverse migration scripts (`migrations/*.down.sql`) in reverse numerical order within a transaction block.
   - If down-migrations fail or mid-flight corruption is detected, execute declarative action `RESTORE_DATABASE_SNAPSHOT` targeting the Stage 2 pre-apply snapshot.
4. **Runtime Cleanup:** Stop and remove newly spawned failing container instances; prune transient staging files.
5. **Finalization:** Atomically write `"ROLLED_BACK"` to `/var/lib/cybrik/journal/<bundle_id>.journal` and record failure telemetry to `/var/log/cybrik/updates/failure.log`.

---

## 6. Manifest Structure & Schema Specification

### 6.1 Manifest Properties Reference
The offline update manifest is governed by the schema `cybrik.offline-install-update-manifest.v1.schema.json`.

| Property | Type | Requirement | Description |
|---|---|---|---|
| `bundle_identifier` | `string` | **REQUIRED** | Unique alphanumeric bundle ID matching `^[a-z0-9][a-z0-9-_]+$` |
| `release_tag` | `string` | **REQUIRED** | SemVer release tag matching `^v(0\|[1-9]\d*)\.(0\|[1-9]\d*)\.(0\|[1-9]\d*)(?:-([a-z0-9.-]+))?$` |
| `operator_trust_root` | `object` | **REQUIRED** | Operator signing key metadata containing `signing_key_id`, `public_key_fingerprint` (`^sha256:[a-f0-9]{64}$`), and `signature_algorithm` (`ed25519` or `ecdsa-p256-sha256`) |
| `bundle_signature` | `string` | **REQUIRED** | Detached cryptographic signature over canonical JCS manifest bytes (exactly 64 octets Ed25519 or ECDSA P-256) |
| `artifacts` | `array` | **REQUIRED** | List of $\ge 1$ artifacts with `name`, `path`, `sha256`, and `size_bytes` |
| `migration_reversibility_guaranteed` | `boolean` | **REQUIRED** | MUST be constant `true` |
| `rollback_procedure_reference` | `string` | **REQUIRED** | URI/reference to rollback documentation (min length: 5) |
| `update_station_workflow` | `object` | **REQUIRED** | Workflow object containing `preflight_steps[]`, `apply_steps[]`, and `rollback_steps[]` adhering to closed declarative action grammar |
| `canonicalization_scheme` | `string` | **REQUIRED** | MUST be constant `"RFC_8785_JCS"` |

### 6.2 Complete Normative Example

```json
{
  "bundle_identifier": "cybrik-soc-update-20260827-01",
  "release_tag": "v0.1.0",
  "operator_trust_root": {
    "signing_key_id": "key-ops-release-2026a",
    "public_key_fingerprint": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "signature_algorithm": "ed25519"
  },
  "bundle_signature": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "artifacts": [
    {
      "name": "cybrik-soc-portal-image",
      "path": "images/cybrik-soc-portal-v0.1.0.tar",
      "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "size_bytes": 314572800
    },
    {
      "name": "cybrik-ai-api-image",
      "path": "images/cybrik-ai-api-v0.1.0.tar",
      "sha256": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
      "size_bytes": 419430400
    },
    {
      "name": "cybrik-fabric-control-image",
      "path": "images/cybrik-fabric-control-v0.1.0.tar",
      "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
      "size_bytes": 262144000
    },
    {
      "name": "db-migration-0001-up",
      "path": "migrations/0001_initial_schema.up.sql",
      "sha256": "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
      "size_bytes": 14320
    },
    {
      "name": "db-migration-0001-down",
      "path": "migrations/0001_initial_schema.down.sql",
      "sha256": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
      "size_bytes": 4820
    },
    {
      "name": "rollback-playbook",
      "path": "procedures/ROLLBACK-PROCEDURE.md",
      "sha256": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
      "size_bytes": 8290
    }
  ],
  "migration_reversibility_guaranteed": true,
  "rollback_procedure_reference": "file://procedures/ROLLBACK-PROCEDURE.md",
  "update_station_workflow": {
    "preflight_steps": [
      {
        "step_id": "preflight-storage-verify",
        "action": "VERIFY_DIGEST",
        "target": "images/cybrik-soc-portal-v0.1.0.tar",
        "description": "Verify container image artifact digest before apply"
      },
      {
        "step_id": "preflight-health-check",
        "action": "HEALTH_PROBE",
        "target": "http://127.0.0.1:8080/healthz",
        "description": "Verify live host database and API readiness",
        "timeout_seconds": 30
      }
    ],
    "apply_steps": [
      {
        "step_id": "apply-preload-portal",
        "action": "PRELOAD_OCI_IMAGE",
        "target": "images/cybrik-soc-portal-v0.1.0.tar",
        "description": "Preload SOC portal container image"
      },
      {
        "step_id": "apply-preload-ai",
        "action": "PRELOAD_OCI_IMAGE",
        "target": "images/cybrik-ai-api-v0.1.0.tar",
        "description": "Preload Cyber AI API container image"
      },
      {
        "step_id": "apply-preload-fabric",
        "action": "PRELOAD_OCI_IMAGE",
        "target": "images/cybrik-fabric-control-v0.1.0.tar",
        "description": "Preload Fabric Control container image"
      },
      {
        "step_id": "apply-db-migration",
        "action": "APPLY_SQL_MIGRATION",
        "target": "migrations/0001_initial_schema.up.sql",
        "description": "Execute initial schema forward migration"
      },
      {
        "step_id": "apply-health-probe",
        "action": "HEALTH_PROBE",
        "target": "http://127.0.0.1:8080/healthz",
        "description": "Verify core services health after rollout",
        "timeout_seconds": 120
      }
    ],
    "rollback_steps": [
      {
        "step_id": "rollback-db-migration",
        "action": "APPLY_SQL_MIGRATION",
        "target": "migrations/0001_initial_schema.down.sql",
        "description": "Rollback database schema migration"
      },
      {
        "step_id": "rollback-restore-snapshot",
        "action": "RESTORE_DATABASE_SNAPSHOT",
        "target": "/var/backups/cybrik/snapshots/pre-v0.1.0.sql",
        "description": "Restore pre-apply database snapshot"
      },
      {
        "step_id": "rollback-health-probe",
        "action": "HEALTH_PROBE",
        "target": "http://127.0.0.1:8080/healthz",
        "description": "Verify recovered service health",
        "timeout_seconds": 60
      }
    ]
  },
  "canonicalization_scheme": "RFC_8785_JCS"
}
```

---

## 7. Deployment Profile Alignment & Isolation Matrix

### 7.1 Slot 13 Profile Matrix
The `artifact_update_mechanism` capability (Slot 13) is evaluated across the four canonical CYBRIK deployment profiles (ADR-0015 §6):

| Deployment Profile | Profile ID | Slot 13 Strength | Air-Gap Requirement | Verification Mode |
|---|---|---|---|---|
| **On-Premises Air-Gapped** | `onprem-airgap-v1` | `MANDATORY` | Full Air-Gap (S3 Isolation Floor) | Local Root Trust Store + Offline CRL |
| **On-Premises Standard** | `onprem-standard-v1` | `MANDATORY` | Air-Gap Capable / Local Mirror | Local Root Trust Store + Offline CRL |
| **Hybrid Sovereign** | `hybrid-sovereign-v1` | `MANDATORY` | Dual (Local Core + Controlled Egress) | Local Root Trust Store + Operator Mirror |
| **Private Cloud** | `private-cloud-v1` | `MANDATORY` | Dedicated Sovereign VPC / Subnet | Local Root Trust Store + Operator Key Registry |

### 7.2 Isolation Floor Guarantees (ADR-0005)
1. **S3 Air-Gap Isolation:** In `onprem-airgap-v1`, all image loading, artifact extraction, and migration operations MUST execute with `FAIL_CLOSED_NO_EGRESS` network posture.
2. **Deterministic Workspace Disposal:** Staging directories and temporary extraction artifacts MUST be created with restricted POSIX permissions (`0700`) and securely purged upon workflow completion or failure.

---

## 8. Threat Model & Failure Mode Analysis

| Threat / Failure Scenario | Attack Vector / Mechanism | Mitigation & Contractual Guarantee |
|---|---|---|
| **Tampered Artifact in Transit** | Modifying container image layer or SQL migration script inside the tarball archive. | **Fail-Closed Digest Verification:** Streaming SHA-256 computation over artifact bytes matches against signed `manifest.json`. Any divergence immediately halts the update. |
| **Unlisted Archive Entry / Archive Bomb** | Injecting unlisted files, FIFOs, device nodes, or symlinks into the PAX archive. | **Exhaustive 1:1 Archive Whitelisting:** Every archive entry MUST match an entry in `artifacts[]`. Any unlisted entry or unexpected file type causes immediate fail-closed extraction abort and workspace purge. |
| **Manifest Modification / Forgery** | Altering `artifacts[].sha256` or workflow steps in `manifest.json`. | **RFC 8785 JCS Cryptographic Signing:** Detached signature verification fails because attacker cannot forge signature under operator private key. |
| **Arbitrary Code Execution via Workflow** | Embedding malicious shell scripts or arbitrary commands in workflow steps. | **Closed Declarative Action Grammar:** Steps restricted to `VERIFY_DIGEST`, `PRELOAD_OCI_IMAGE`, `APPLY_SQL_MIGRATION`, `HEALTH_PROBE`, `RESTORE_DATABASE_SNAPSHOT`, forbidding arbitrary shell execution. |
| **Path Traversal / Host File Overwrite** | Malicious relative paths (e.g., `../../../../etc/shadow`). | **Strict Path Regex & Normalization:** Schema regex `^(?!/)...` and Phase 2 POSIX normalization reject all dot-segments, absolute paths, and aliased paths. |
| **Compromised Signing Key** | Adversary obtains an older or compromised operator signing key. | **Offline CRL / Revocation Check:** Verifier consults local `crl.json` before signature check; revoked `signing_key_id` or fingerprint triggers fatal abort. |
| **Replay of Deprecated / Vulnerable Bundle** | Attacker replays a validly signed, older bundle containing known vulnerabilities. | **Monotone Sequence & Freshness Watermark:** Update station enforces strictly monotone `trust_store_version` and `release_tag` progression, rejecting downgrade attempts. |
| **System Crash During Cutover** | Power loss, kernel panic, or verifier crash during container rollout or SQL migration. | **Pre-Apply Journaling & Crash-Replay Recovery:** Persistent atomic journal at `/var/lib/cybrik/journal/<bundle_id>.journal` enables deterministic crash recovery or rollback from pre-apply snapshot. |
| **Partial Failure During Apply** | Uncaught error during container rollout or SQL migration. | **Stage 4 Automated Rollback & ACID Migrations:** Reversible SQL migrations (`migration_reversibility_guaranteed: true`) and declarative rollback steps restore pre-update state. |
| **Disk Exhaustion During Extraction** | Large bundle exhausts host disk space, causing denial of service. | **Preflight Quota Reservation:** Stage 2 preflight validates $\ge 2.5\times$ aggregate `size_bytes` disk headroom before any extraction begins. |

---

## 9. Governance, Lifecycle & Non-Claims

### 9.1 Lifecycle Status
This document is statused as **`PROPOSED (Open-Item Elaboration) — NOT ACCEPTED`**.

Moving this contract from `PROPOSED` to `ACCEPTED FOR IMPLEMENTATION` requires formal Founder approval under ADR-0001 lifecycle governance.

### 9.2 Resolution of Open Item OPEN-1
This specification fully elaborates and satisfies the architectural and contract requirements for **OPEN-1 (`OFFLINE_INSTALL_UPDATE_CONTRACT`)** under ADR-0015 §14.

Upon Founder review and acceptance:
- `OPEN-1` status transitions to `RESOLVED` (Architecture Contract Authority Only).
- Product repositories (`cybrik-soc-command-center`, `cybrik-cyber-ai-platform`, `cybrik-security-tool-fabric`) obtain the normative standard for building offline packaging tooling and update-station agents without introducing provider lock-in or unverified dependencies.
