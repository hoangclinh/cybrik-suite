# Platform Contract Slot 5: Storage S3-Compatible Subset Specification v1

**Status:** `PROPOSED (Open-Item Elaboration) — NOT ACCEPTED`
**Authoring Phase:** `v0.1.0-proposed` (Architecture / governance proposal; carries no product, runtime, or deployment authority)
**Document Identifier:** `contracts/storage/CYBRIK-S3-COMPATIBILITY-SUBSET-V1-SPECIFICATION.md`
**Contract Version:** `0.1.0-proposed`
**Governing Architecture Records:** `ADR-0015` (§5.2 Slot 5, §14.1 `OPEN-2`), `ADR-0001` (Versioning), `ADR-0005` (Isolation Substrate), `ADR-0014` (Receipt Trust & Durability)
**Platform Contract Placement:** Slot 5 (`storage`)
**Authority Scope:** `ARCHITECTURE_CONTRACT_AUTHORITY_ONLY`

---

## 1. Overview, Authority Scope & Non-Claims

This specification defines the normative minimum S3-compatible object storage interface contract under **Platform Contract Slot 5 (`storage`)** for the CYBRIK Autonomous Security Operations platform. It formalizes the elaboration of open item **`OPEN-2` (`S3_COMPATIBILITY_MINIMUM_CONTRACT`)** established in `ADR-0015` §14.1.

### 1.1 Authority Scope
This document operates strictly under `ARCHITECTURE_CONTRACT_AUTHORITY_ONLY`. It provides the technical specification required for platform capability providers to advertise, test, and prove conformance against Platform Contract Slot 5.

### 1.2 Strict Non-Claims & Governance Boundaries
In accordance with `ADR-0015` and `CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md`:
* **No Provider Selection**: This specification does **NOT** select, mandate, or endorse any specific cloud provider (e.g., AWS, GCP, Azure, Cloudflare) or on-premise / self-hosted storage substrate (e.g., MinIO, SeaweedFS, Ceph, Garage).
* **No Implementation Authority**: This specification does **NOT** authorize product, runtime, or infrastructure source code changes.
* **No Production or Release Authority**: This proposal does **NOT** authorize production deployment, staging promotion, or release tagging.
* **Open-Item Retention**: The presence of this specification in the repository does **NOT** automatically close `OPEN-2`. Final closure of `OPEN-2` requires explicit Founder decision and formal governance acceptance.
* **Informative References**: Any references to concrete storage engines, tools, or SDKs within this document are strictly non-normative illustrative examples.

---

## 2. Platform Contract Slot 5 Architectural Placement

Platform Contract Slot 5 (`storage`) provides the durable object persistence layer across all CYBRIK Suite planes:

```
+-----------------------------------------------------------------------------+
|                             CYBRIK SUITE PLANES                             |
|                                                                             |
|  +------------------------+  +---------------------+  +------------------+  |
|  |     Control Plane      |  |     Data Plane      |  | Forensics / WORM |  |
|  |  (Receipts, Bundles,   |  |  (Parquet Logs,     |  | (Evidence Locks, |  |
|  |   Update Manifests)    |  |   Model Artifacts)  |  |   Audit Trails)  |  |
|  +-----------+------------+  +----------+----------+  +--------+---------+  |
+--------------|--------------------------|----------------------|------------+
               |                          |                      |
               +--------------------+     |     +----------------+
                                    |     |     |
                                    v     v     v
+-----------------------------------------------------------------------------+
|                    PLATFORM CONTRACT SLOT 5: STORAGE                        |
|                                                                             |
|      Normative Minimum S3-Compatible Subset Interface (OPEN-2 v1)          |
|                                                                             |
|   +---------------------+  +--------------------+  +--------------------+   |
|   |   Object CRUD (5)   |  | Bucket/Listing (3) |  |   Multipart (5)    |   |
|   |  - PutObject        |  |  - HeadBucket      |  |  - CreateMPU       |   |
|   |  - GetObject        |  |  - CreateBucket    |  |  - UploadPart      |   |
|   |  - HeadObject       |  |  - ListObjectsV2   |  |  - CompleteMPU     |   |
|   |  - DeleteObject     |  +--------------------+  |  - AbortMPU        |   |
|   |  - DeleteObjects    |  | Bucket Vers. (2)   |  |  - ListParts       |   |
|   +---------------------+  |  - PutBucketVers.  |  +--------------------+   |
|                            |  - GetBucketVers.  |                           |
|                            +--------------------+                           |
|                            |  WORM / Lock (4)   |  15-Op Baseline (Non-Lock)|
|                            |  - PutObjRetention |  19-Op with Object Lock   |
|                            |  - GetObjRetention |                           |
|                            |  - PutObjLegalHold |                           |
|                            |  - GetObjLegalHold |                           |
|                            +--------------------+                           |
|                                                                             |
|   Wire Invariants:                                                          |
|   * Path-Style Addressing Mandatory  * AWS SigV4 (AWS4-HMAC-SHA256)         |
|   * Strict RFC 3986 URL Encoding     * Strict Checksum & Digest Validation  |
|   * Strict Payload Type Gating       * Normative S3 XML Error Schema        |
+-----------------------------------------------------------------------------+
```

---

## 3. Normative System Invariants

A conforming Platform Contract Slot 5 storage provider MUST satisfy the following core invariants:

* **`INV-S3-01` (Closed Operation Inventory — 15-Op Baseline / 19 Ops with Object Lock)**: The provider MUST implement the closed operation vocabulary reconciled with accepted Platform Contract Proposal §5: exactly the 15-operation baseline (8 CRUD/Bucket: `PutObject`, `GetObject`, `HeadObject`, `DeleteObject`, `DeleteObjects`, `ListObjectsV2`, `HeadBucket`, `CreateBucket`; 5 Multipart: `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`, `ListParts`; 2 Bucket Versioning: `PutBucketVersioning`, `GetBucketVersioning`) on non-immutable deployment profiles, and exactly 19 operations when Object Lock is included (adding `PutObjectRetention`, `GetObjectRetention`, `PutObjectLegalHold`, `GetObjectLegalHold`). No unapproved subset omission or surplus operation is permitted.
* **`INV-S3-02` (Mandatory Path-Style Addressing)**: The provider MUST support path-style request routing (`https://{endpoint}/{bucket}/{key}`) without requiring DNS-level virtual-host bucket resolution.
* **`INV-S3-03` (AWS SigV4 Authentication)**: The provider MUST authenticate requests signed with `AWS4-HMAC-SHA256` in compliance with AWS Signature Version 4.
* **`INV-S3-04` (Strict RFC 3986 URL Path Encoding & Normalized Object Keys)**: Request URI paths MUST adhere to RFC 3986 unreserved character preservation and uppercase percent-encoding rules. All `s3://` URIs and path-style URLs MUST conform to normalized object keys without dot-segments (`..`, `/.`), repeated slashes (`//`), or trailing slashes (`/`).
* **`INV-S3-05` (Strict End-to-End Digest Verification, Payload Type Gating & Strict Error Dispatch)**: The provider MUST compute and validate payload digests against `Content-MD5` and `x-amz-content-sha256` headers. Payload inputs across storage operations and digest calculations MUST be strictly type-gated (`string`, `Buffer`, `Uint8Array` only; `null`/`undefined`/`Date`/`Uint16Array`/`Function` fail closed with `TypeError` in digest helper routines and HTTP 400 `InvalidDigest` / `MALFORMED_PAYLOAD_TYPE` in dispatchers). The `x-amz-content-sha256` header is unconditionally mandatory on all `PutObject` requests (missing header returns HTTP 400 `InvalidDigest`). The `x-amz-content-sha256` header value must strictly match exact lowercase 64-hex SHA-256 (`^[a-f0-9]{64}$`) or `'UNSIGNED-PAYLOAD'` (case-sensitive, no leading/trailing whitespace, no uppercase). `STREAMING-*` SHA-256 headers (e.g. `STREAMING-AWS4-HMAC-SHA256-PAYLOAD`) are malformed header syntax not part of this closed subset and MUST be rejected with HTTP 400 `InvalidDigest` (`UNSUPPORTED_STREAMING_PAYLOAD_SHA256`). On `PutObject`, the provider MUST compute the payload SHA-256 digest and verify it against `x-amz-content-sha256` (when not `'UNSIGNED-PAYLOAD'`) as well as verifying `Content-MD5` (when provided), failing closed strictly with `BadDigest` (HTTP 400) on payload digest mismatch and `InvalidDigest` (HTTP 400) on malformed digest headers, invalid payload types (`MALFORMED_PAYLOAD_TYPE`), or missing mandatory `x-amz-content-sha256`. Returning `InvalidArgument` or `AccessDenied` in lieu of `BadDigest`/`InvalidDigest` is strictly forbidden. On `CompleteMultipartUpload`, every referenced part in the completion manifest MUST exist and its declared ETag MUST match the stored part ETag recorded during `UploadPart` via exact string matching (without quote stripping or normalization); any missing part or stored-ETag mismatch MUST be rejected with HTTP 400 `InvalidPart`.
* **`INV-S3-06` (Version-Level Object Lock Immutability & Version-Scoped Evidence)**: The provider MUST enforce WORM retention on individual object versions in both `COMPLIANCE` and `GOVERNANCE` modes, preventing premature deletion or overwrite of protected version IDs until the retain-until date expires. Every retention and legal-hold evidence assertion (`objectRetentionCompliance`) MUST strictly bind to an explicit non-empty `version_id`. Key-level or unversioned evidence assertions are strictly prohibited.
* **`INV-S3-07` (Legal Hold Independence)**: Legal hold status MUST operate independently of retention expiration dates, preventing version deletion while `Status=ON`.
* **`INV-S3-08` (Standard Error Taxonomy & Canonical Error Code Declaration)**: Errors MUST return standard HTTP status codes and the normative S3 XML error envelope conforming to the 13-error taxonomy. Storage conformance profiles MUST declare exactly all 13 canonical S3 error codes.
* **`INV-S3-09` (Multipart Upload Integrity, Manifest Ordering, Cardinality & Size Boundaries)**: Multipart uploads MUST be atomic upon completion, guarantee part checksum consistency, and enforce strict manifest ordering, cardinality, and part/object size boundary rules during `CompleteMultipartUpload`. Parts listed in the completion manifest MUST be sorted in strictly ascending numerical order by `PartNumber` (1 to 10,000) with strictly positive cardinality (1 to 10,000 parts) and zero duplicate part numbers. Part count MUST NOT exceed 10,000 (exceeding returns HTTP 400 `InvalidArgument` `TOO_MANY_PARTS`). All part numbers MUST fall within the range $1 \le \text{part\_number} \le 10000$ (out of range returns HTTP 400 `InvalidArgument` `INVALID_PART_NUMBER`). Completing a multipart upload with an empty parts list (`parts: []` or 0 parts) returns HTTP 400 `InvalidArgument` (`EMPTY_PARTS_LIST`), not `InvalidPart`. All non-strictly-ascending part sequences (including both duplicate part numbers e.g. [1, 1] and descending part numbers e.g. [2, 1]) MUST be classified under canonical HTTP 400 `InvalidPartOrder`. `CompleteMultipartUpload` fails closed with HTTP 400 `InvalidPart` when `storedParts` state is absent or when manifest or stored part ETags are missing/mismatched. Declared part ETags MUST match stored part ETags via exact string matching (without quote stripping or normalization), or be rejected with HTTP 400 `InvalidPart`. Furthermore, stored part sizes (`sp.size`, `sp.size_bytes`, `sp.Size`) are unconditionally mandatory; missing or non-integer stored part sizes, negative part sizes, or string-encoded sizes MUST be rejected with HTTP 400 `InvalidPart` (`InvalidPartSize`). If provided, declared `total_parts` and `total_size_bytes` in `CompleteMultipartUpload` MUST be strictly non-negative integer types matching exactly the actual count of manifest parts and the aggregate sum of stored parts byte sizes; any non-number type, string-encoded value (e.g. `"1"`), or value mismatch MUST be rejected with HTTP 400 `InvalidPart` (`TotalPartsMismatch` / `TotalSizeMismatch`). Part sizes must be strictly non-negative integers: all non-final parts MUST be at least 5 MiB (5,242,880 bytes) in size up to 5 GiB (5,368,709,120 bytes) (5 MiB minimum non-final part size, rejecting non-final parts < 5 MiB with HTTP 400 `EntityTooSmall`); the final part MAY be 0 bytes or greater up to 5 GiB (0-byte minimum final part size); all individual parts MUST NOT exceed 5 GiB (5,368,709,120 bytes) maximum individual part size; and the aggregate assembled object size MUST NOT exceed 5 TiB (5,497,558,138,880 bytes) maximum aggregate object size (exceeding aggregate size returns HTTP 400 `EntityTooLarge` `TOTAL_SIZE_EXCEEDED`).
* **`INV-S3-10` (Strong Consistency)**: Read-after-write consistency MUST be guaranteed for `PutObject`, `CompleteMultipartUpload`, and `DeleteObject`.

---

## 4. Required Operations Inventory (15-Operation Baseline / 19 Operations with Object Lock)

The Platform Contract Slot 5 interface vocabulary consists of a 15-operation closed baseline on non-immutable profiles and extends to 19 operations when Object Lock is included, categorized into five functional groups:

| # | Operation Identifier | HTTP Verb & Path Pattern | Functional Category | Purpose / Architectural Consumer | Profile Applicability |
|---|---|---|---|---|---|
| 1 | `PutObject` | `PUT /{bucket}/{key+}` | Object CRUD | Write object data, metadata, and checksums | Baseline (All Profiles) |
| 2 | `GetObject` | `GET /{bucket}/{key+}` | Object CRUD | Read object payload and user metadata | Baseline (All Profiles) |
| 3 | `HeadObject` | `HEAD /{bucket}/{key+}` | Object CRUD | Retrieve object headers, ETag, and metadata | Baseline (All Profiles) |
| 4 | `DeleteObject` | `DELETE /{bucket}/{key+}` | Object CRUD | Remove an object version or place a delete marker | Baseline (All Profiles) |
| 5 | `DeleteObjects` | `POST /{bucket}?delete` | Object CRUD | Multi-object batch deletion in a single request | Baseline (All Profiles) |
| 6 | `HeadBucket` | `HEAD /{bucket}` | Bucket / Listing | Verify bucket existence and caller access | Baseline (All Profiles) |
| 7 | `CreateBucket` | `PUT /{bucket}` | Bucket / Listing | Create a storage bucket with Object Lock support | Baseline (All Profiles) |
| 8 | `ListObjectsV2` | `GET /{bucket}?list-type=2` | Bucket / Listing | Paginated listing of objects by prefix and delimiter | Baseline (All Profiles) |
| 9 | `CreateMultipartUpload` | `POST /{bucket}/{key+}?uploads` | Multipart Upload | Initiate a multi-part segmented upload session | Baseline (All Profiles) |
| 10 | `UploadPart` | `PUT /{bucket}/{key+}?uploadId={id}&partNumber={n}` | Multipart Upload | Upload an individual bounded part segment | Baseline (All Profiles) |
| 11 | `CompleteMultipartUpload` | `POST /{bucket}/{key+}?uploadId={id}` | Multipart Upload | Assemble uploaded parts into a single coherent object | Baseline (All Profiles) |
| 12 | `AbortMultipartUpload` | `DELETE /{bucket}/{key+}?uploadId={id}` | Multipart Upload | Cancel session and reclaim allocated part storage | Baseline (All Profiles) |
| 13 | `ListParts` | `GET /{bucket}/{key+}?uploadId={id}` | Multipart Upload | List uploaded parts for an in-progress upload session | Baseline (All Profiles) |
| 14 | `PutBucketVersioning` | `PUT /{bucket}?versioning` | Bucket Versioning | Enable or suspend version tracking on a bucket | Baseline (All Profiles) |
| 15 | `GetBucketVersioning` | `GET /{bucket}?versioning` | Bucket Versioning | Retrieve version tracking status on a bucket | Baseline (All Profiles) |
| 16 | `PutObjectRetention` | `PUT /{bucket}/{key+}?retention` | WORM / Object Lock | Set retention mode and `RetainUntilDate` on a version | Object Lock / Immutable Profiles |
| 17 | `GetObjectRetention` | `GET /{bucket}/{key+}?retention` | WORM / Object Lock | Query current retention configuration of a version | Object Lock / Immutable Profiles |
| 18 | `PutObjectLegalHold` | `PUT /{bucket}/{key+}?legal-hold` | WORM / Object Lock | Apply or lift an indefinite legal hold on a version | Object Lock / Immutable Profiles |
| 19 | `GetObjectLegalHold` | `GET /{bucket}/{key+}?legal-hold` | WORM / Object Lock | Query current legal hold status of a version | Object Lock / Immutable Profiles |

---

## 5. Detailed Operation Specifications

### 5.1 Operation 1: `PutObject`

Writes an object payload and associated metadata to the specified bucket and key.

* **HTTP Method**: `PUT`
* **Resource Path**: `/{bucket}/{key+}`
* **Required Headers**:
  * `Host`: Storage endpoint host.
  * `Authorization`: AWS SigV4 signature string.
  * `x-amz-date` or `Date`: ISO 8601 UTC timestamp (`YYYYMMDD'T'HHMMSS'Z'`).
  * `x-amz-content-sha256`: Hexadecimal SHA-256 digest of the request body (or `'UNSIGNED-PAYLOAD'` where permitted by profile). Unconditionally mandatory on all `PutObject` requests (missing header returns HTTP 400 `InvalidDigest`); must strictly match exact lowercase 64-hex SHA-256 (`^[a-f0-9]{64}$`) or `'UNSIGNED-PAYLOAD'` (case-sensitive, no leading/trailing whitespace, no uppercase).
* **Optional Headers**:
  * `Content-MD5`: Base64-encoded 128-bit MD5 digest of the payload.
  * `Content-Type`: MIME type of the payload (default: `application/octet-stream`).
  * `x-amz-meta-*`: User-defined metadata key-value pairs.
  * `x-amz-object-lock-mode`: `COMPLIANCE` | `GOVERNANCE` (for atomic lock creation).
  * `x-amz-object-lock-retain-until-date`: ISO 8601 UTC timestamp for retention expiry.
  * `x-amz-object-lock-legal-hold`: `ON` | `OFF`.
* **Request Body**: Binary octet stream representing object contents. Payload inputs MUST be raw octet buffers (`Buffer` / `Uint8Array`) or UTF-8 `string`. Plain objects, numbers, booleans, arrays, or other structured non-byte types MUST fail closed with HTTP 400 `InvalidDigest` (`MALFORMED_PAYLOAD_TYPE`).
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**:
    * `ETag`: Double-quoted MD5 hex digest (`"<md5-hex>"`).
    * `x-amz-request-id`: Opaque tracking identifier.
    * `x-amz-version-id`: Version identifier if versioning is active.
  * **Response Body**: Empty.
* **Failure Modes**:
  * `400 Bad Request` (`BadDigest`): `Content-MD5` or computed SHA-256 does not match calculated payload digest.
  * `400 Bad Request` (`InvalidDigest`): `x-amz-content-sha256` header is missing, malformed (not matching `^[a-f0-9]{64}$` or `'UNSIGNED-PAYLOAD'`), `Content-MD5` header is malformed (not valid 128-bit Base64), or payload input fails type gating (plain objects, numbers, booleans, arrays, or other structured non-byte types triggering `MALFORMED_PAYLOAD_TYPE`).
  * `400 Bad Request` (`EntityTooLarge`): Payload exceeds maximum allowed single-put size (5 GiB).
  * `403 Forbidden` (`AccessDenied`): Missing write permissions or attempt to overwrite a locked object version.
  * `404 Not Found` (`NoSuchBucket`): Target bucket does not exist.

---

### 5.2 Operation 2: `GetObject`

Retrieves an object payload and its stored metadata.

* **HTTP Method**: `GET`
* **Resource Path**: `/{bucket}/{key+}`
* **Optional Query Parameters**:
  * `versionId`: Target object version ID.
* **Optional Headers**:
  * `Range`: Byte range specification (`bytes=start-end`).
  * `If-Match`, `If-None-Match`, `If-Modified-Since`, `If-Unmodified-Since`: Conditional read headers.
* **Success Response**:
  * **HTTP Status**: `200 OK` (or `206 Partial Content` when `Range` is provided).
  * **Response Headers**:
    * `Content-Type`: Stored MIME type.
    * `Content-Length`: Size of the returned body in bytes.
    * `ETag`: Double-quoted ETag string.
    * `Last-Modified`: RFC 7231 HTTP-date timestamp.
    * `x-amz-meta-*`: Stored user metadata headers.
    * `x-amz-version-id`: Specific object version ID.
  * **Response Body**: Binary octet stream.
* **Failure Modes**:
  * `304 Not Modified`: Conditional header check evaluated false.
  * `404 Not Found` (`NoSuchKey`): Object does not exist.
  * `404 Not Found` (`NoSuchBucket`): Bucket does not exist.
  * `412 Precondition Failed` (`PreconditionFailed`): `If-Match` or `If-Unmodified-Since` check failed.

---

### 5.3 Operation 3: `HeadObject`

Retrieves object metadata and existence headers without returning the payload body.

* **HTTP Method**: `HEAD`
* **Resource Path**: `/{bucket}/{key+}`
* **Optional Query Parameters**:
  * `versionId`: Target object version ID.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: Identical to `GetObject` response headers (`Content-Length`, `Content-Type`, `ETag`, `Last-Modified`, `x-amz-meta-*`, `x-amz-version-id`).
  * **Response Body**: Empty (MUST NOT return a body).
* **Failure Modes**:
  * `403 Forbidden` (`AccessDenied`): Missing read permissions.
  * `404 Not Found` (`NoSuchKey` / `NoSuchBucket`): Returns HTTP 404 with empty body when object or bucket does not exist.

---

### 5.4 Operation 4: `DeleteObject`

Deletes an object version or places a delete marker on version-enabled buckets.

* **HTTP Method**: `DELETE`
* **Resource Path**: `/{bucket}/{key+}`
* **Optional Query Parameters**:
  * `versionId`: Specific version ID to permanently remove.
* **Optional Headers**:
  * `x-amz-bypass-governance-retention`: `true` | `false` (requires administrative bypass privilege).
* **Success Response**:
  * **HTTP Status**: `204 No Content`
  * **Response Headers**:
    * `x-amz-delete-marker`: `true` if a delete marker was created.
    * `x-amz-version-id`: Version ID of the created delete marker or deleted version.
  * **Response Body**: Empty.
* **Failure Modes**:
  * `403 Forbidden` (`AccessDenied`): Object version is protected by an active Object Lock (`COMPLIANCE` mode, unexpired `GOVERNANCE` mode without bypass, or active `LegalHold`).
  * `404 Not Found` (`NoSuchBucket`): Target bucket does not exist.

---

### 5.5 Operation 5: `DeleteObjects`

Performs batch deletion of multiple specified object keys or version IDs in a single request.

* **HTTP Method**: `POST`
* **Resource Path**: `/{bucket}?delete`
* **Required Headers**:
  * `Host`: Storage endpoint host.
  * `Authorization`: AWS SigV4 signature string.
  * `Content-Type`: `application/xml`
  * `Content-MD5`: Base64-encoded MD5 digest of the XML request body.
* **Optional Headers**:
  * `x-amz-bypass-governance-retention`: `true` | `false`.
* **Request Body**: XML document conforming to `Delete`:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Quiet>false</Quiet>
    <Object>
      <Key>evidence/trace-001.log</Key>
    </Object>
    <Object>
      <Key>evidence/trace-002.log</Key>
      <VersionId>v1.0.0-sample-version</VersionId>
    </Object>
  </Delete>
  ```
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document returning `DeleteResult`:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <Deleted>
        <Key>evidence/trace-001.log</Key>
        <DeleteMarker>true</DeleteMarker>
        <DeleteMarkerVersionId>dm-sample-001</DeleteMarkerVersionId>
      </Deleted>
      <Deleted>
        <Key>evidence/trace-002.log</Key>
        <VersionId>v1.0.0-sample-version</VersionId>
      </Deleted>
    </DeleteResult>
    ```
* **Failure Modes**:
  * `400 Bad Request` (`BadDigest`): `Content-MD5` does not match calculated XML payload digest.
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` is malformed Base64.
  * `400 Bad Request` (`InvalidArgument`): Malformed XML body or empty object list.
  * `404 Not Found` (`NoSuchBucket`): Target bucket does not exist.
  * *Partial Item Errors*: If an individual version ID cannot be deleted due to active WORM Object Lock or missing permissions, the response returns `200 OK` with an embedded `<Error>` element containing `<Code>AccessDenied</Code>` for that specific key and version.

---

### 5.6 Operation 6: `HeadBucket`

Determines if a bucket exists and the caller has permission to access it.

* **HTTP Method**: `HEAD`
* **Resource Path**: `/{bucket}`
* **Required Headers**:
  * `Host`: Storage endpoint host.
  * `Authorization`: AWS SigV4 signature string.
* **Request Body**: Empty.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**:
    * `x-amz-bucket-region`: Region of the bucket.
    * `x-amz-request-id`: Tracking identifier.
  * **Response Body**: Empty.
* **Failure Modes**:
  * `403 Forbidden` (`AccessDenied`): Caller lacks permission to access the bucket.
  * `404 Not Found` (`NoSuchBucket`): Bucket does not exist.

---

### 5.7 Operation 7: `CreateBucket`

Creates a new storage bucket with optional Object Lock support.

* **HTTP Method**: `PUT`
* **Resource Path**: `/{bucket}`
* **Required Headers**:
  * `Host`: Storage endpoint host.
  * `Authorization`: AWS SigV4 signature string.
* **Optional Headers**:
  * `x-amz-bucket-object-lock-enabled`: `true` | `false` (enables Object Lock WORM capability on the bucket).
* **Optional Request Body**: XML document specifying `CreateBucketConfiguration` (e.g., `LocationConstraint`).
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**:
    * `Location`: Path of the created bucket (`/{bucket}`).
  * **Response Body**: Empty.
* **Failure Modes**:
  * `400 Bad Request` (`InvalidArgument`): Invalid bucket name or malformed configuration XML.
  * `403 Forbidden` (`AccessDenied`): Caller lacks bucket creation permissions.

---

### 5.8 Operation 8: `ListObjectsV2`

Returns a paginated list of objects matching optional prefix and delimiter constraints.

* **HTTP Method**: `GET`
* **Resource Path**: `/{bucket}?list-type=2`
* **Optional Query Parameters**:
  * `prefix`: Filter keys beginning with prefix string.
  * `delimiter`: Group keys matching delimiter into `CommonPrefixes`.
  * `max-keys`: Maximum keys per response page (integer, 1–1000, default: 1000).
  * `continuation-token`: Pagination token from prior `NextContinuationToken`.
  * `start-after`: Key after which listing begins.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document adhering to S3 `ListBucketResult`:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <Name>example-bucket</Name>
      <Prefix>audit/2026/</Prefix>
      <MaxKeys>1000</MaxKeys>
      <IsTruncated>false</IsTruncated>
      <Contents>
        <Key>audit/2026/receipt-001.json</Key>
        <LastModified>2026-08-27T12:00:00.000Z</LastModified>
        <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
        <Size>4096</Size>
        <StorageClass>STANDARD</StorageClass>
      </Contents>
    </ListBucketResult>
    ```
* **Failure Modes**:
  * `403 Forbidden` (`AccessDenied`): Caller lacks list permissions on the bucket.
  * `404 Not Found` (`NoSuchBucket`): Specified bucket does not exist.

---

### 5.9 Operation 9: `CreateMultipartUpload`

Initiates a multi-part upload session for large objects, returning a unique `UploadId`.

* **HTTP Method**: `POST`
* **Resource Path**: `/{bucket}/{key+}?uploads`
* **Optional Headers**:
  * `Content-Type`: MIME type of the final assembled object.
  * `x-amz-meta-*`: User-defined metadata for the final object.
  * `x-amz-object-lock-mode`: `COMPLIANCE` | `GOVERNANCE`.
  * `x-amz-object-lock-retain-until-date`: Retention expiration date.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document returning `InitiateMultipartUploadResult`:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <Bucket>example-bucket</Bucket>
      <Key>large-evidence.tar.gz</Key>
      <UploadId>VXBsb2FkIElEIGV4YW1wbGU</UploadId>
    </InitiateMultipartUploadResult>
    ```
* **Failure Modes**:
  * `403 Forbidden` (`AccessDenied`): Caller lacks write permissions.
  * `404 Not Found` (`NoSuchBucket`): Bucket does not exist.

---

### 5.10 Operation 10: `UploadPart`

Uploads an individual segment (part) in an active multipart upload session.

* **HTTP Method**: `PUT`
* **Resource Path**: `/{bucket}/{key+}?uploadId={UploadId}&partNumber={PartNumber}`
* **Required Query Parameters**:
  * `uploadId`: Valid upload session identifier from `CreateMultipartUpload`.
  * `partNumber`: Integer segment index (1 to 10,000 inclusive).
* **Optional Headers**:
  * `Content-MD5`: Base64 MD5 of the part payload.
  * `x-amz-content-sha256`: Hexadecimal SHA-256 digest of the part payload.
* **Request Body**: Binary octet stream for the part (minimum 5 MiB for non-final parts; up to 5 GiB).
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**:
    * `ETag`: Double-quoted MD5 hex digest of the uploaded part (`"<md5-hex>"`).
* **Failure Modes**:
  * `400 Bad Request` (`BadDigest`): `Content-MD5` does not match calculated part payload digest.
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` is malformed Base64.
  * `400 Bad Request` (`EntityTooLarge`): Part size exceeds 5 GiB limit.
  * `400 Bad Request` (`InvalidArgument`): Part number outside valid range (1–10,000).
  * `404 Not Found` (`NoSuchUpload`): `UploadId` is invalid or expired.
  * `404 Not Found` (`NoSuchBucket`): Bucket does not exist.

---

### 5.11 Operation 11: `CompleteMultipartUpload`

Assembles previously uploaded parts into a single coherent object.

* **HTTP Method**: `POST`
* **Resource Path**: `/{bucket}/{key+}?uploadId={UploadId}`
* **Required Query Parameters**:
  * `uploadId`: Target upload session ID.
* **Request Body**: XML document specifying ordered part list:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Part>
      <PartNumber>1</PartNumber>
      <ETag>"1b2cf535f27731c974343645a3985328"</ETag>
    </Part>
    <Part>
      <PartNumber>2</PartNumber>
      <ETag>"ee960779f74b46ae364bc9f623099abb"</ETag>
    </Part>
  </CompleteMultipartUpload>
  ```
* **Multipart Manifest Ordering & Cardinality Rules**:
  * The manifest MUST contain at least 1 and at most 10,000 `<Part>` elements ($1 \le \text{part count} \le 10000$). Exceeding 10,000 parts returns HTTP 400 `InvalidArgument` (`TOO_MANY_PARTS`).
  * Part numbers MUST fall within the range $1 \le \text{part\_number} \le 10000$. Part numbers outside this range return HTTP 400 `InvalidArgument` (`INVALID_PART_NUMBER`).
  * Parts MUST be listed in strictly ascending numerical order by `PartNumber` ($1 \le \text{PartNumber}_1 < \text{PartNumber}_2 < \dots < \text{PartNumber}_n \le 10000$).
  * Duplicate part numbers are strictly forbidden (strict inequality $\text{PartNumber}_i < \text{PartNumber}_{i+1}$ is required).
  * Any violation of strictly ascending order (including descending parts, unsorted parts, or duplicate part numbers) MUST be rejected with HTTP 400 `InvalidPartOrder`.
  * Manifest wrappers, manifests, manifest parts, and stored parts MUST be plain objects (or null-prototype objects) whose fields are own properties (`Object.prototype.hasOwnProperty`). Class instances, non-plain prototypes, or prototype-inherited `part_number`, `etag`, or `size_bytes` MUST fail closed: class instances, non-plain prototypes, or prototype-inherited manifest wrappers / inherited `parts` arrays trigger HTTP 400 `InvalidArgument` (`EMPTY_PARTS_LIST` / semantic validation error), while prototype-inherited part descriptors (`part_number`, `etag`, `size_bytes`) or prototype-inherited totals (`total_parts`, `total_size_bytes`) trigger HTTP 400 `InvalidPart` (`InvalidPartNumber` / `MissingManifestPartETag` / `MissingStoredPartETag` / `InvalidPartSize` / `TotalPartsMismatch` / `TotalSizeMismatch`).
  * Every listed part MUST reference an existing uploaded part whose stored ETag matches the `<ETag>` in the manifest; missing parts or ETag mismatches MUST be rejected with HTTP 400 `InvalidPart`.
  * ETags across multipart upload manifests and stored parts MUST be double-quoted strings matching regex `^\"[a-fA-F0-9]{32}(?:-[0-9]{1,5})?\"$` exactly. Unquoted ETags, asymmetric quotes, or non-hex payloads are strictly malformed and rejected with HTTP 400 `InvalidPart` (`InvalidETagFormat`).
  * Declared `total_parts` and `total_size_bytes` (if provided) MUST be strictly non-negative integer types exactly equal to the actual count of manifest parts and the aggregate sum of stored parts byte sizes; any non-number type, string-encoded value (e.g. `"1"`), or value mismatch returns HTTP 400 `InvalidPart` (`TotalPartsMismatch` / `TotalSizeMismatch`).
  * Part sizes MUST be strictly non-negative integers: every part except the final part in the assembled object MUST be at least 5 MiB (5,242,880 bytes) up to 5 GiB (5,368,709,120 bytes); the final part MAY be 0 bytes or greater up to 5 GiB; missing or non-integer stored part sizes (`sp.size`, `sp.size_bytes`, `sp.Size`), negative part sizes, or string sizes MUST be rejected with HTTP 400 `InvalidPart` (`InvalidPartSize`).
  * Maximum individual part size is 5 GiB (5,368,709,120 bytes) and maximum aggregate object size is 5 TiB (5,497,558,138,880 bytes); exceeding aggregate size returns HTTP 400 `EntityTooLarge` (`TOTAL_SIZE_EXCEEDED`).
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document returning `CompleteMultipartUploadResult`:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <Location>http://storage.local/example-bucket/large-evidence.tar.gz</Location>
      <Bucket>example-bucket</Bucket>
      <Key>large-evidence.tar.gz</Key>
      <ETag>"3a5b6c7d8e9f-2"</ETag>
    </CompleteMultipartUploadResult>
    ```
* **Failure Modes**:
  * `400 Bad Request` (`InvalidPart`): Declared part ETag does not match stored part ETag, referenced part was not uploaded, manifest or stored part ETag is malformed (not matching regex `^\"[a-fA-F0-9]{32}(?:-[0-9]{1,5})?\"$` exactly, unquoted, asymmetric quotes, or non-hex payload -> `InvalidETagFormat`), missing / non-integer stored part size (`sp.size`, `sp.size_bytes`, `sp.Size` -> `InvalidPartSize`), manifest parts or stored parts are class instances, non-plain prototypes, or have prototype-inherited `part_number`, `etag`, or `size_bytes` (failing plain object prototype or own-property resolution), or declared `total_parts` / `total_size_bytes` fails type-check (non-number or string-encoded such as `"1"`, or prototype-inherited -> `TotalPartsMismatch` / `TotalSizeMismatch`) or mismatches actual parts count or sum of stored parts byte sizes.
  * `400 Bad Request` (`InvalidPartOrder`): Parts in the manifest are not sorted in strictly ascending numerical order by part number, or contain duplicate part numbers.
  * `400 Bad Request` (`InvalidArgument`): Manifest XML is malformed, part count exceeds 10,000 (`TOO_MANY_PARTS`), part number is outside the valid range 1–10,000 (`INVALID_PART_NUMBER`), manifest contains zero parts, or manifest wrapper / manifest parts array fails plain object prototype or own-property resolution (class instances, non-plain prototypes, or prototype-inherited manifest wrappers / parts list -> `EMPTY_PARTS_LIST`).
  * `400 Bad Request` (`EntityTooLarge`): Individual part exceeds 5 GiB or aggregate assembled object size exceeds 5 TiB (`TOTAL_SIZE_EXCEEDED`).
  * `400 Bad Request` (`EntityTooSmall`): Non-final part is smaller than 5 MiB.
  * `404 Not Found` (`NoSuchUpload`): Upload session does not exist, has expired, or has already completed/aborted.
  * `404 Not Found` (`NoSuchBucket`): Target bucket does not exist.

---

### 5.12 Operation 12: `AbortMultipartUpload`

Aborts a multipart upload session and releases storage associated with any uploaded parts.

* **HTTP Method**: `DELETE`
* **Resource Path**: `/{bucket}/{key+}?uploadId={UploadId}`
* **Required Query Parameters**:
  * `uploadId`: Target upload session ID.
* **Success Response**:
  * **HTTP Status**: `204 No Content`
  * **Response Body**: Empty.
* **Failure Modes**:
  * `404 Not Found` (`NoSuchUpload`): Upload session does not exist.

---

### 5.13 Operation 13: `ListParts`

Lists the parts that have been uploaded for a specific active multipart upload session.

* **HTTP Method**: `GET`
* **Resource Path**: `/{bucket}/{key+}?uploadId={UploadId}`
* **Required Query Parameters**:
  * `uploadId`: Target upload session ID.
* **Optional Query Parameters**:
  * `max-parts`: Maximum number of parts to return (integer, 1–1000, default: 1000).
  * `part-number-marker`: Part number after which listing begins.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document returning `ListPartsResult`:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <ListPartsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <Bucket>example-bucket</Bucket>
      <Key>large-evidence.tar.gz</Key>
      <UploadId>VXBsb2FkIElEIGV4YW1wbGU</UploadId>
      <PartNumberMarker>0</PartNumberMarker>
      <NextPartNumberMarker>2</NextPartNumberMarker>
      <MaxParts>1000</MaxParts>
      <IsTruncated>false</IsTruncated>
      <Part>
        <PartNumber>1</PartNumber>
        <LastModified>2026-08-27T12:05:00.000Z</LastModified>
        <ETag>"1b2cf535f27731c974343645a3985328"</ETag>
        <Size>5242880</Size>
      </Part>
      <Part>
        <PartNumber>2</PartNumber>
        <LastModified>2026-08-27T12:06:00.000Z</LastModified>
        <ETag>"ee960779f74b46ae364bc9f623099abb"</ETag>
        <Size>5242880</Size>
      </Part>
    </ListPartsResult>
    ```
* **Failure Modes**:
  * `400 Bad Request` (`InvalidArgument`): Invalid query parameter (e.g., negative `max-parts`).
  * `404 Not Found` (`NoSuchUpload`): Upload session does not exist, was aborted, or already completed.
  * `404 Not Found` (`NoSuchBucket`): Specified bucket does not exist.

---

### 5.14 Operation 14: `PutBucketVersioning`

Configures or toggles the versioning state of an existing storage bucket.

* **HTTP Method**: `PUT`
* **Resource Path**: `/{bucket}?versioning`
* **Query Parameters**:
  * `versioning`: Directive sub-resource flag.
* **Required Headers**:
  * `Host`: Storage endpoint host.
  * `Authorization`: AWS SigV4 signature string.
  * `x-amz-date` or `Date`: ISO 8601 UTC timestamp.
  * `Content-Type`: `application/xml`
* **Optional Headers**:
  * `Content-MD5`: Base64 MD5 of the XML body.
* **Request Body**: XML document conforming to `VersioningConfiguration`:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Status>Enabled</Status>
  </VersioningConfiguration>
  ```
  *(Allowed `Status` values: `Enabled` | `Suspended`)*
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Body**: Empty.
* **Failure Modes**:
  * `400 Bad Request` (`InvalidArgument`): Malformed XML payload or invalid status value.
  * `403 Forbidden` (`AccessDenied`): Missing bucket management permissions or attempting to suspend versioning on an Object Lock enabled bucket.
  * `404 Not Found` (`NoSuchBucket`): Target bucket does not exist.

---

### 5.15 Operation 15: `GetBucketVersioning`

Retrieves the active versioning configuration status of a storage bucket.

* **HTTP Method**: `GET`
* **Resource Path**: `/{bucket}?versioning`
* **Query Parameters**:
  * `versioning`: Directive sub-resource flag.
* **Required Headers**:
  * `Host`: Storage endpoint host.
  * `Authorization`: AWS SigV4 signature string.
  * `x-amz-date` or `Date`: ISO 8601 UTC timestamp.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document returning `VersioningConfiguration`:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <Status>Enabled</Status>
    </VersioningConfiguration>
    ```
    *(If versioning has never been configured on the bucket, returns an empty `<VersioningConfiguration xmlns="..."/>` element or empty body with 200 OK).*
* **Failure Modes**:
  * `403 Forbidden` (`AccessDenied`): Missing read permissions.
  * `404 Not Found` (`NoSuchBucket`): Target bucket does not exist.

---

### 5.16 Operation 16: `PutObjectRetention`

Configures or extends the WORM retention configuration for a specific object version. In conformance with version-scoped WORM immutability, retention configuration MUST bind to an explicit object version ID.

* **HTTP Method**: `PUT`
* **Resource Path**: `/{bucket}/{key+}?retention`
* **Query Parameters**:
  * `versionId`: (Mandatory for version-scoped compliance evidence) Target object version ID.
* **Optional Headers**:
  * `Content-MD5`: Base64 MD5 of the XML body.
  * `x-amz-bypass-governance-retention`: `true` | `false`.
* **Request Body**: XML document conforming to `Retention`:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <Retention xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Mode>COMPLIANCE</Mode>
    <RetainUntilDate>2031-08-27T00:00:00.000Z</RetainUntilDate>
  </Retention>
  ```
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Body**: Empty.
* **Failure Modes**:
  * `400 Bad Request` (`BadDigest`): `Content-MD5` mismatch on XML body.
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` is malformed Base64.
  * `400 Bad Request` (`InvalidArgument`): Malformed XML payload or invalid retention mode.
  * `403 Forbidden` (`AccessDenied`): Attempting to shorten `RetainUntilDate` in `COMPLIANCE` mode or altering `GOVERNANCE` retention without bypass authorization.
  * `404 Not Found` (`NoSuchKey`): Object or version does not exist.
  * `404 Not Found` (`ObjectLockConfigurationNotFoundError`): Object Lock is not enabled on the parent bucket.

---

### 5.17 Operation 17: `GetObjectRetention`

Queries the active WORM retention configuration of a specific object version.

* **HTTP Method**: `GET`
* **Resource Path**: `/{bucket}/{key+}?retention`
* **Query Parameters**:
  * `versionId`: (Mandatory for version-scoped compliance evidence) Target object version ID.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document containing current `<Retention>` (`Mode` and `RetainUntilDate`).
* **Failure Modes**:
  * `404 Not Found` (`ObjectLockConfigurationNotFoundError`): Object or bucket has no retention configured, or Object Lock is not enabled on the bucket.
  * `404 Not Found` (`NoSuchKey`): Object or version does not exist.

---

### 5.18 Operation 18: `PutObjectLegalHold`

Applies or releases an indefinite legal hold on a specific object version.

* **HTTP Method**: `PUT`
* **Resource Path**: `/{bucket}/{key+}?legal-hold`
* **Query Parameters**:
  * `versionId`: (Mandatory for version-scoped compliance evidence) Target object version ID.
* **Optional Headers**:
  * `Content-MD5`: Base64 MD5 of the XML body.
* **Request Body**: XML document conforming to `LegalHold`:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <LegalHold xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Status>ON</Status>
  </LegalHold>
  ```
  *(Allowed `Status` values: `ON` | `OFF`)*
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Body**: Empty.
* **Failure Modes**:
  * `400 Bad Request` (`BadDigest`): Body MD5 mismatch.
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` is malformed Base64.
  * `400 Bad Request` (`InvalidArgument`): Malformed XML body or invalid `Status` string.
  * `404 Not Found` (`NoSuchKey`): Object or version does not exist.
  * `404 Not Found` (`ObjectLockConfigurationNotFoundError`): Object Lock is not enabled on the parent bucket.

---

### 5.19 Operation 19: `GetObjectLegalHold`

Retrieves the legal hold status of a specific object version.

* **HTTP Method**: `GET`
* **Resource Path**: `/{bucket}/{key+}?legal-hold`
* **Query Parameters**:
  * `versionId`: (Mandatory for version-scoped compliance evidence) Target object version ID.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document returning `<LegalHold><Status>ON|OFF</Status></LegalHold>`.
* **Failure Modes**:
  * `404 Not Found` (`ObjectLockConfigurationNotFoundError`): No legal hold configured, or Object Lock is not enabled on the bucket.
  * `404 Not Found` (`NoSuchKey`): Object or version does not exist.

---

## 6. Object Lock, WORM & Retention Semantics

WORM (Write-Once-Read-Many) guarantees are essential for forensic evidence preservation, immutable audit ledgers (ADR-0014), and regulatory compliance verification.

### 6.1 Prerequisites for Object Lock
* **Bucket-Level Enablement**: Object Lock MUST be enabled at bucket creation time (e.g., via the `x-amz-bucket-object-lock-enabled: true` header during `CreateBucket`). An object cannot be locked in a bucket that was created without Object Lock support.
* **Versioning Prerequisite**: Buckets with Object Lock enabled MUST maintain versioning in the `Enabled` state. Versioning cannot be suspended or disabled on an Object Lock enabled bucket.

### 6.2 Version-Level WORM Granularity & Version Lifecycle

```
+-----------------------------------------------------------------------------+
|                     VERSION-LEVEL WORM RETENTION MODEL                      |
|                                                                             |
|  Bucket: cybrik-forensics (Object Lock Enabled, Versioning Enabled)         |
|                                                                             |
|  Key: evidence/2026/incident-1042.bundle                                    |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | Version ID: v3 (Current / Latest)                                     |  |
|  | - Status: Delete Marker (placed via DeleteObject without versionId)   |  |
|  | - Mutation: Permitted at any time                                      |  |
|  +-----------------------------------------------------------------------+  |
|                                     |                                       |
|  +-----------------------------------------------------------------------+  |
|  | Version ID: v2 (Non-Current)                                          |  |
|  | - Payload: Updated forensics report                                    |  |
|  | - Mode: UNPROTECTED                                                    |  |
|  | - Mutation: Permanent deletion permitted (DeleteObject?versionId=v2)   |  |
|  +-----------------------------------------------------------------------+  |
|                                     |                                       |
|  +-----------------------------------------------------------------------+  |
|  | Version ID: v1 (Original Evidence Snapshot)                           |  |
|  | - Payload: 2026-08-27 raw memory capture                              |  |
|  | - Mode: COMPLIANCE, RetainUntilDate: 2036-08-27                       |  |
|  | - Legal Hold: ON                                                      |  |
|  | - Immutability: CANNOT be deleted, overwritten, or truncated           |  |
|  |   DeleteObject?versionId=v1 ---> FAILS CLOSED: HTTP 403 AccessDenied  |  |
|  +-----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
```

1. **Version ID Granularity & Mandatory Evidence Binding**:
   * Object Lock retention rules (`COMPLIANCE`, `GOVERNANCE`) and Legal Holds apply strictly to **individual version IDs** (`versionId`) within a versioning-enabled bucket, rather than globally across the mutable key path pointer.
   * Each object version possesses its own independent retention metadata (`Mode`, `RetainUntilDate`) and legal hold flag (`Status=ON|OFF`).
   * **Mandatory Version-Scoped Evidence**: Every retention and legal-hold evidence assertion (including `objectRetentionCompliance` in `cybrik.storage-s3-compatibility-subset.v1.schema.json`) MUST strictly bind to an explicit non-empty `version_id`. Evidence assertions omitting `version_id` or scoping retention to a bare key path are strictly non-conforming and invalid.

2. **Permitted Key-Level Mutations (Non-Destructive Versioning)**:
   * **Writing New Versions**: Clients MAY execute `PutObject` or multipart upload operations against an existing key containing locked versions. The storage engine creates a new, distinct version ID for the newly written payload, which becomes the current (latest) version of the key. Prior locked versions remain fully intact and immutable under their respective version IDs.
   * **Placing Delete Markers**: Calling `DeleteObject` without specifying a `versionId` is permitted on a key with locked versions. This operation writes a new `DeleteMarker` version as the current version; it does **NOT** delete, truncate, or alter any existing underlying protected object versions.

3. **Immutability of Protected Versions**:
   * A protected version ID cannot be overwritten, modified, or permanently deleted until its `RetainUntilDate` has passed (and its Legal Hold status is `OFF`).
   * Explicit permanent deletion requests targeting a locked version ID (e.g., `DELETE /{bucket}/{key}?versionId={lockedVersionId}` or `DeleteObjects` specifying that `VersionId`) MUST fail closed with HTTP 403 `AccessDenied`.

### 6.3 Retention Modes

```
+-----------------------------------------------------------------------------+
|                           OBJECT LOCK RETENTION MODES                       |
|                                                                             |
|  +-----------------------------------+  +--------------------------------+  |
|  |          COMPLIANCE MODE          |  |        GOVERNANCE MODE         |  |
|  |                                   |  |                                |  |
|  |  * Absolute WORM Immutability     |  |  * Privileged Protection       |  |
|  |  * CANNOT be overwritten/deleted  |  |  * Standard delete/overwrite   |  |
|  |    by ANY user (including admin)  |  |    fails closed (HTTP 403)     |  |
|  |  * RetainUntilDate cannot be      |  |  * Can be bypassed only with   |  |
|  |    shortened                      |  |    x-amz-bypass-governance-    |  |
|  |  * RetainUntilDate CAN be extended|  |    retention: true             |  |
|  +-----------------------------------+  +--------------------------------+  |
+-----------------------------------------------------------------------------+
```

1. **`COMPLIANCE` Mode**:
   * **Absolute Immutability**: Protected object versions cannot be deleted, overwritten, or modified by any authenticated identity, root account, or storage administrator until `RetainUntilDate` has elapsed.
   * **Monotone Extension Rule**: The `RetainUntilDate` MAY be extended to a later timestamp (`new_date > existing_date`). Any request attempting to shorten or remove the retention date MUST be rejected with HTTP 403 `AccessDenied`.
   * **Mode Permanence**: An object version in `COMPLIANCE` mode cannot be downgraded to `GOVERNANCE` mode or unlocked.

2. **`GOVERNANCE` Mode**:
   * **Privileged Override**: Standard deletion and overwrite attempts are blocked with HTTP 403 `AccessDenied`.
   * **Bypass Authorization**: Users possessing explicit administrative governance bypass permissions can bypass retention by providing the header `x-amz-bypass-governance-retention: true`.

### 6.4 Legal Hold Semantics
* **Indefinite Duration**: A Legal Hold maintains an explicit status flag (`Status=ON` or `Status=OFF`). While `Status=ON`, the object version cannot be deleted regardless of whether its retention period has expired or if no retention period was configured.
* **Orthogonality**: Legal Hold status is orthogonal to and independent from retention mode (`COMPLIANCE`/`GOVERNANCE`) and `RetainUntilDate`.
* **Explicit Release**: A Legal Hold does not expire automatically; it requires an explicit `PutObjectLegalHold` call with `<Status>OFF</Status>`.

### 6.5 Timestamp & Date Normalization
* All retention dates MUST be formatted as ISO 8601 UTC strings terminating in `Z` or millisecond precision (e.g., `2031-08-27T00:00:00.000Z`).
* Providers MUST evaluate expiration using synchronized UTC clocks.

### 6.6 Version-Scoped Evidence Assertions & Invariants
For regulatory compliance, forensic integrity, and non-repudiation:
1. **Explicit Version Binding**: All retention and legal-hold evidence records (e.g., forensic bundles, execution receipts, audit ledgers) MUST capture and verify the exact non-empty `version_id` returned by the storage provider upon `PutObject` or `CompleteMultipartUpload`.
2. **Key-Level Ambiguity Rejection**: Storing or asserting retention against a mutable key path without an explicit `version_id` is strictly non-conforming. A key path can refer to new versions or delete markers created subsequent to the evidence capture; therefore, only the immutable `version_id` provides durable WORM integrity.
3. **Evidence Conformance Contract**: Conforming evidence objects MUST satisfy the `objectRetentionCompliance` schema contract (`cybrik.storage-s3-compatibility-subset.v1.schema.json`), requiring non-empty `bucket`, `object_key`, `version_id`, `retention_mode`, `retain_until_date`, `legal_hold`, and `object_sha256`.

---

## 7. Addressing, URL Encoding & AWS SigV4 Compatibility

### 7.1 Path-Style Addressing & Canonical URI Formatting
Conforming providers MUST support path-style request addressing as the normative default:

$$\text{URI} = \text{https://}\{\text{endpoint}\}/\{\text{bucket}\}/\{\text{key}\}$$

Canonical S3 URI references across the platform adhere to the standard scheme:

$$\text{S3 URI} = \text{s3://}\{\text{bucket}\}/\{\text{key}\}$$

Virtual-host style addressing (`https://{bucket}.{endpoint}/{key}`) is non-normative and optional for on-premise / bare-metal environments.

Both canonical `s3://` URIs and path-style URLs MUST conform to strict regex patterns where the lookahead immediately following the bucket delimiter is `(?!\./)` (without start-of-string anchor `^`), explicitly rejecting dot-segments immediately following the bucket slash (e.g., `s3://bucket/./key` or `https://endpoint/bucket/./key`), and incorporating the full RFC 3986 unreserved character set (including `~`) and uppercase percent-encoded sequences `%[0-9A-F]{2}`:
* **Canonical S3 URI Regex**: `^s3://[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]/(?!/)(?!\./)(?!.*\.\.)(?!.*(?:/\.|//|/$))(?:[a-zA-Z0-9._/~-]|%[0-9A-F]{2})+$`
* **Path-Style URL Regex**: `^https?://[a-zA-Z0-9.-]+(?::[0-9]+)?/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]/(?!/)(?!\./)(?!.*\.\.)(?!.*(?:/\.|//|/$))(?:[a-zA-Z0-9._/~-]|%[0-9A-F]{2})+$`

### 7.2 Strict RFC 3986 URL Path Encoding & Object Key Normalization
In accordance with RFC 3986, AWS SigV4 canonicalization, and platform storage contracts:
1. **Unreserved Characters**: The characters `A-Z`, `a-z`, `0-9`, `-`, `_`, `.`, `~` MUST NOT be percent-encoded.
2. **Reserved Characters**: All other characters (e.g., spaces, punctuation) MUST be percent-encoded using uppercase hexadecimal notation (`%XX` / `%[0-9A-F]{2}`).
3. **Hierarchy Delimiters**: Forward slash (`/`) characters representing key hierarchy separators in URI paths MUST NOT be percent-encoded. Redundant sequential slashes (`//`) must not be ambiguously collapsed prior to signature verification.
4. **Object Key Normalization & Dot-Segment Rejection**: All `s3://` URIs (`s3://{bucket}/{key}`) and path-style URLs (`http(s)://{endpoint}/{bucket}/{key}`) MUST conform to normalized object keys without dot-segments (`..`, `/.`), repeated slashes (`//`), or trailing slashes (`/`), composed of RFC 3986 unreserved characters (`a-zA-Z0-9._/~-`) and uppercase percent-encoded sequences (`%[0-9A-F]{2}`). Specifically:
   * **Leading Slash Prohibition**: Object keys MUST NOT begin with a leading slash (`/`) or leading relative dot-slash (`./`).
   * **Dot-Segment Prohibition**: Object keys MUST NOT contain dot-segments (`..`, `/.`, `/./`, `/../`) representing directory traversal or relative path components.
   * **Repeated Slash Prohibition**: Object keys MUST NOT contain repeated, redundant, or adjacent slashes (`//`).
   * **Trailing Slash Prohibition**: Object keys MUST NOT terminate with a trailing slash (`/`).
   * **Normative Key Pattern**: Standalone object keys MUST strictly match the normative regex pattern `^(?!\/)(?!\.\/)(?!.*\.\.)(?!.*(?:\/\.|\/\/|\/$))(?:[a-zA-Z0-9._/~-]|%[0-9A-F]{2})+$`.
   * **Normative S3 URI & Path-Style URL Regex Patterns**: In `s3://` URIs and path-style URLs, the lookahead immediately following the bucket delimiter `/` MUST be `(?!\./)` (without `^`) so that dot-segments immediately following the bucket slash (e.g., `s3://bucket/./key` or `https://endpoint/bucket/./key`) are explicitly shown as rejected:
     * Canonical S3 URI pattern: `^s3://[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]/(?!/)(?!\./)(?!.*\.\.)(?!.*(?:/\.|//|/$))(?:[a-zA-Z0-9._/~-]|%[0-9A-F]{2})+$`
     * Path-style URL pattern: `^https?://[a-zA-Z0-9.-]+(?::[0-9]+)?/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]/(?!/)(?!\./)(?!.*\.\.)(?!.*(?:/\.|//|/$))(?:[a-zA-Z0-9._/~-]|%[0-9A-F]{2})+$`

### 7.3 AWS SigV4 Canonical Request Construction
Requests MUST be signed using `AWS4-HMAC-SHA256`. The signature computation follows the canonical four-step pipeline:

```
Step 1: Construct Canonical Request
------------------------------------
CanonicalRequest =
  HTTPMethod + '\n' +
  CanonicalURI + '\n' +
  CanonicalQueryString + '\n' +
  CanonicalHeaders + '\n' +
  SignedHeaders + '\n' +
  HashedPayload

Step 2: Construct String to Sign
---------------------------------
StringToSign =
  "AWS4-HMAC-SHA256" + '\n' +
  RequestDateTime + '\n' +
  CredentialScope + '\n' +
  HexEncode(SHA256(CanonicalRequest))

Where:
  CredentialScope = DateStamp + '/' + Region + '/' + "s3" + '/' + "aws4_request"

Step 3: Derive Signing Key
---------------------------
kDate    = HMAC-SHA256("AWS4" + SecretKey, DateStamp)
kRegion  = HMAC-SHA256(kDate, Region)
kService = HMAC-SHA256(kRegion, "s3")
kSigning = HMAC-SHA256(kService, "aws4_request")

Step 4: Calculate Signature
----------------------------
Signature = HexEncode(HMAC-SHA256(kSigning, StringToSign))
```

* **Canonical Headers**: Header names must be lowercased, trimmed of leading/trailing whitespace, sorted lexicographically by ASCII byte value, and formatted as `name:value\n`.
* **Signed Headers**: Semicolon-delimited list of lowercased header names included in canonical headers.

---

## 8. Checksum & Digest Validation Rules

To prevent data corruption in transit and at rest, providers MUST enforce strict digest validation:

```
+-----------------------------------------------------------------------------+
|                          DIGEST VALIDATION FLOW                             |
|                                                                             |
|   Client Request                                    Storage Provider        |
|  +--------------------------------+                +---------------------+  |
|  | Headers:                       |                | 1. Parse Header     |  |
|  | - Content-MD5: <base64>        |  ----------->  |    Malformed?       |  |
|  | - x-amz-content-sha256: <hex>  |   (Payload)    +----------+----------+  |
|  +--------------------------------+                           |             |
|                                                 +-------------+-------------+
|                                                 | YES (malformed syntax)    | NO (valid syntax)
|                                                 v                           v
|                                      +---------------------+     +---------------------+
|                                      | Reject Immediately  |     | 2. Compute SHA-256  |
|                                      | HTTP 400 Bad Request|     |    and MD5 over     |
|                                      | Code: InvalidDigest |     |    received bytes   |
|                                      +---------------------+     +----------+----------+
|                                                                             |
|                                            [ Digest Mismatch? ] <-----------+
|                                                    |
|                                +-------------------+-------------------+
|                                | YES (hash mismatch)                   | NO (hash matches)
|                                v                                       v
|                     +---------------------+                 +--------------------+
|                     | Reject Immediately  |                 | Store Object       |
|                     | HTTP 400 Bad Request|                 | Return 200 OK      |
|                     | Code: BadDigest     |                 | ETag: "<md5-hex>"  |
|                     +---------------------+                 +--------------------+
+-----------------------------------------------------------------------------+
```

### 8.1 Differentiation Between `BadDigest` and `InvalidDigest`
Conforming storage providers MUST strictly differentiate between digest calculation mismatches and header formatting errors:

1. **`BadDigest` (`HTTP 400 Bad Request`)**:
   * **Semantic Trigger**: The client supplied a syntactically valid Base64-encoded 128-bit MD5 digest in the `Content-MD5` header (or valid checksum header), but the digest calculated by the storage provider over the received payload bytes does **not match** the client's declared value.
   * **Cause**: In-transit network bit corruption, payload truncation, or erroneous client-side checksum generation.
   * **Error Code**: `<Code>BadDigest</Code>`.
   * **Strict Error Dispatch**: Storage providers MUST return HTTP 400 with `<Code>BadDigest</Code>`. Providers MUST NOT return `InvalidArgument` or `AccessDenied` for payload checksum or digest mismatches.

2. **`InvalidDigest` (`HTTP 400 Bad Request`)**:
   * **Semantic Trigger**: The value provided in the `Content-MD5` header is **malformed** and cannot be parsed as a valid 128-bit MD5 digest (e.g., contains non-base64 characters, invalid padding, or decodes to a byte sequence whose length is not exactly 16 bytes).
   * **Cause**: Syntactically invalid header syntax or encoding error by the client.
   * **Error Code**: `<Code>InvalidDigest</Code>`.
   * **Strict Error Dispatch**: Storage providers MUST return HTTP 400 with `<Code>InvalidDigest</Code>`. Providers MUST NOT return `InvalidArgument` for malformed digest header values.

### 8.2 Payload Digest Validation (`Content-MD5` and `x-amz-content-sha256`), Raw Octet Hashing, Payload Type Gating & Part Integrity Verification
* **Payload Type Gating & Permitted Types**: Payload inputs across storage operations and digest calculations MUST be strictly type-gated. Only `string` (evaluated strictly as raw UTF-8 octets without speculative decoding), `Buffer`, and `Uint8Array` are permitted payload representations. Any unsupported or invalid types—specifically including `null`, `undefined` (when a payload argument is passed or expected), `Date`, `Uint16Array`, `Function`, plain object, number, boolean, array, or other structured non-byte types—MUST fail closed:
  - In low-level digest calculation routines (`computePayloadSha256`, `computePayloadMd5`), throw a strict `TypeError` with message `"Invalid payload type: payload must be a string, Buffer, or Uint8Array"`.
  - In protocol dispatch and request validation pipelines (`dispatchS3PutObject`, `dispatchS3Error`), fail closed immediately with HTTP 400 `<Code>InvalidDigest</Code>` and reason `MALFORMED_PAYLOAD_TYPE`.
* **Raw UTF-8 Octet Payload Hashing**: Cryptographic digest computation (for `x-amz-content-sha256` SHA-256 validation and `Content-MD5` / `ETag` MD5 calculation) MUST evaluate string and text payloads strictly as raw UTF-8 octets ($C \to \text{UTF-8}(C)$) without heuristic Base64 interpretation or speculative payload sniffing. Implementations MUST NOT inspect string payloads for Base64 characteristics or decode Base64-encoded strings into binary byte buffers prior to computing digests. Strings MUST be converted to raw bytes using strict UTF-8 encoding, ensuring deterministic, bit-for-bit digest reproducibility across all platform planes and clients.
* **Own-Property Resolution on Headers & Payload Digest Inputs**: All request header lookups (including `x-amz-content-sha256`, `Content-MD5`, and custom metadata headers) and payload digest properties MUST be resolved strictly as direct own properties (`Object.prototype.hasOwnProperty.call(...)`). Prototype-inherited headers, prototype-poisoned header dictionaries, or prototype-inherited payload fields MUST be treated as absent or malformed and fail closed immediately with HTTP 400 `<Code>InvalidDigest</Code>` (`MALFORMED_HEADER_SYNTAX`).
* **`PutObject` Payload Digest Verification**: On `PutObject`, the server MUST verify the received payload against the 64-character lowercase hexadecimal SHA-256 digest provided in `x-amz-content-sha256` (or profile-authorized `'UNSIGNED-PAYLOAD'`) and the Base64 MD5 digest provided in `Content-MD5` (when provided).
  * The `x-amz-content-sha256` header is **unconditionally mandatory** on all `PutObject` requests. Missing or omitted `x-amz-content-sha256` header MUST be rejected strictly with HTTP 400 `<Code>InvalidDigest</Code>`.
  * The `x-amz-content-sha256` header value must strictly match exact lowercase 64-hex SHA-256 (`^[a-f0-9]{64}$`) or `'UNSIGNED-PAYLOAD'` (case-sensitive, no leading/trailing whitespace, no uppercase).
  * `STREAMING-*` SHA-256 headers (e.g. `STREAMING-AWS4-HMAC-SHA256-PAYLOAD`, `STREAMING-AWS4-ECDSA-P256-SHA256-PAYLOAD`, and any streaming payload auth variants) are malformed header syntax not part of this closed subset; `STREAMING-*` SHA-256 header validation is executed unconditionally before any MD5 validation or payload digest comparisons, immediately returning HTTP 400 `<Code>InvalidDigest</Code>` (`UNSUPPORTED_STREAMING_PAYLOAD_SHA256`). Storage providers MUST NOT evaluate MD5 or compute payload digests when a `STREAMING-*` SHA-256 header is encountered; rather, the request MUST fail closed immediately during initial header validation with HTTP 400 `<Code>InvalidDigest</Code>`. Storage providers MUST NOT return `BadDigest` or `InvalidArgument` for streaming header sentinels because streaming payload framing is rejected at header ingestion prior to payload verification.
  * Syntactically invalid digest header values (e.g., missing mandatory header on `PutObject`, non-hex characters, uppercase characters, or length $\neq 64$ in SHA-256 headers, unsupported `STREAMING-*` payload headers, or malformed Base64 in `Content-MD5`) or invalid payload types (`null`, `undefined`, `Date`, `Uint16Array`, `Function`, plain objects, numbers, booleans, arrays, or other structured non-byte types triggering `MALFORMED_PAYLOAD_TYPE` / `TypeError`) MUST be rejected strictly with HTTP 400 `<Code>InvalidDigest</Code>`. Storage providers MUST NOT return `InvalidArgument` for malformed digest headers or invalid payload types.
  * Calculated digest mismatches against the received payload bytes MUST be rejected strictly with HTTP 400 `<Code>BadDigest</Code>`. Specifically, both `XAmzContentSHA256Mismatch` and `PAYLOAD_SHA256_MISMATCH` (as well as `PAYLOAD_DIGEST_MISMATCH`) map strictly to HTTP 400 `<Code>BadDigest</Code>`. Storage providers MUST NOT return `AccessDenied` or `InvalidArgument` in lieu of `BadDigest` for payload digest discrepancies.
* **`CompleteMultipartUpload` Part Integrity & `InvalidPart` Handling**: During `CompleteMultipartUpload`, the storage provider MUST verify each part listed in the completion manifest against previously uploaded parts for the upload session.
  * If a referenced part was not uploaded (missing part) or if the part's declared ETag in the manifest does not match the stored part ETag recorded during `UploadPart` via exact string matching (without quote stripping or normalization), the provider MUST reject the completion request with HTTP 400 `<Code>InvalidPart</Code>`.
  * Storage providers MUST NOT return `InvalidArgument` or `NoSuchUpload` in lieu of `InvalidPart` when part integrity checks fail or referenced parts are missing from an active upload session.

### 8.3 ETag Formats
* For single-part `PutObject` uploads, `ETag` MUST be the double-quoted lowercase hex MD5 digest: `"<md5-hex>"`.
* For multipart uploads assembled via `CompleteMultipartUpload`, `ETag` MUST follow the multipart composite format: `"<hex-digest>-<part-count>"`.

### 8.4 Multipart Manifest Ordering, Cardinality, Part Integrity, Total Invariants & Size Thresholds (`INV-S3-09`)
For multipart upload completion via `CompleteMultipartUpload`:
* **Strict Ascending Ordering**: The `<Part>` list in the completion manifest MUST be sorted in strictly ascending numerical order by `PartNumber`. If any part number is less than or equal to the preceding part number ($\text{PartNumber}_{i+1} \le \text{PartNumber}_i$), the storage provider MUST reject the request immediately with HTTP 400 `<Code>InvalidPartOrder</Code>`. All non-strictly-ascending part sequences (including both duplicate part numbers e.g. [1, 1] and descending part numbers e.g. [2, 1]) MUST be classified under canonical HTTP 400 `InvalidPartOrder`.
* **Plain Object Prototype & Own-Property Resolution on Multipart Upload Manifests & Part Descriptors**: Manifest wrappers, manifests, manifest parts, and stored parts MUST be plain objects (or null-prototype objects) whose fields are own properties (`Object.prototype.hasOwnProperty`). Class instances, non-plain prototypes, or prototype-inherited `part_number`, `etag`, or `size_bytes` MUST fail closed:
  * Manifest wrappers and manifests MUST be plain objects (or null-prototype objects). Passing class instances, non-plain prototypes, or prototype-inherited manifest structures (such as inherited `manifest` wrappers or inherited `parts` arrays) MUST fail closed with HTTP 400 `<Code>InvalidArgument</Code>` (`EMPTY_PARTS_LIST` / semantic validation error).
  * Manifest parts and stored parts MUST be plain objects (or null-prototype objects) whose fields (`part_number`, `etag`, `size_bytes`, `sha256`) are resolved strictly as own properties (`Object.prototype.hasOwnProperty.call(...)`). Any class instances, non-plain prototypes, or prototype-inherited part fields (`part_number`, `etag`, `size_bytes`) on manifest parts or stored parts MUST fail closed with HTTP 400 `<Code>InvalidPart</Code>` (`InvalidPartNumber` / `MissingManifestPartETag` / `MissingStoredPartETag` / `InvalidPartSize`).
  * Declared totals (`total_parts`, `total_size_bytes`) MUST be evaluated strictly as own properties; prototype-inherited `total_parts` or `total_size_bytes` MUST fail closed with HTTP 400 `<Code>InvalidPart</Code>` (`TotalPartsMismatch` / `TotalSizeMismatch`).
* **Cardinality & Part Bounds**:
  * **Part Count Limit**: Completion manifests MUST contain between 1 and 10,000 parts ($1 \le \text{part count} \le 10000$). Part counts exceeding 10,000 MUST be rejected with HTTP 400 `<Code>InvalidArgument</Code>` (`TOO_MANY_PARTS`).
  * **Part Number Range**: Part numbers MUST fall within the range $1 \le \text{part\_number} \le 10000$. Part numbers outside this range ($< 1$ or $> 10000$) MUST be rejected with HTTP 400 `<Code>InvalidArgument</Code>` (`INVALID_PART_NUMBER`).
  * **Empty Manifest**: Completing a multipart upload with an empty parts list (`parts: []` or 0 parts) returns HTTP 400 `<Code>InvalidArgument</Code>` (`EMPTY_PARTS_LIST`), not `InvalidPart`. Duplicate part numbers violate strictly ascending order and MUST be rejected with HTTP 400 `InvalidPartOrder`.
* **Part Verification & Fail-Closed Integrity**: Each declared `<PartNumber>` and `<ETag>` pair MUST match a part previously uploaded under the active `UploadId`. Declared part ETags MUST match stored part ETags via exact string matching without quote stripping or normalization. `CompleteMultipartUpload` fails closed with HTTP 400 `<Code>InvalidPart</Code>` when `storedParts` state is absent or when manifest or stored part ETags are missing/mismatched. Storage providers MUST NOT return `InvalidArgument` or `NoSuchUpload` in lieu of `InvalidPart` when `storedParts` state is absent, part integrity checks fail, or referenced parts are missing from an active upload session.
* **Strict Double-Quoted ETag Format Invariant**: ETags across multipart upload manifests and stored parts MUST be double-quoted strings matching regex `^\"[a-fA-F0-9]{32}(?:-[0-9]{1,5})?\"$` exactly. Unquoted ETags, asymmetric quotes, or non-hex payloads are strictly malformed and rejected with HTTP 400 `<Code>InvalidPart</Code>` (`InvalidETagFormat`).
* **Mandatory Stored-Part Sizes & Manifest Substitution Prohibition**: Stored-part sizes (`sp.size`, `sp.size_bytes`, `sp.Size`) are unconditionally mandatory for all completed parts in `CompleteMultipartUpload`. Missing or non-integer stored-part sizes MUST be rejected with HTTP 400 `<Code>InvalidPart</Code>` (`InvalidPartSize`). Manifest-only size substitution is strictly forbidden: the storage provider MUST verify part sizes from authoritative server-side stored part state recorded during `UploadPart`, and MUST NOT substitute unverified manifest declarations.
* **Declared Total Invariants (`total_parts` and `total_size_bytes`)**: In `CompleteMultipartUpload`, declared `total_parts` and `total_size_bytes` (if provided in the manifest or upload completion request):
  * **Strict Integer Type Enforcement**: Both `total_parts` and `total_size_bytes` MUST be strictly non-negative integers (`typeof value === 'number'`). Non-number, string-encoded (e.g., `"1"`), boolean, float, or null types fail type-checking and MUST be rejected with HTTP 400 `<Code>InvalidPart</Code>` (`TotalPartsMismatch` for invalid `total_parts`, `TotalSizeMismatch` for invalid `total_size_bytes`). Coercion or string-parsing is strictly prohibited.
  * **`total_parts` Invariant**: The declared `total_parts` value MUST strictly be a positive integer matching exactly the actual count of parts in the completion manifest ($|\text{manifest.parts}|$). Any mismatch between declared `total_parts` and actual parts count, or any non-number/string-encoded value (e.g., `"1"`), MUST be rejected with HTTP 400 `<Code>InvalidPart</Code>` (`TotalPartsMismatch`).
  * **`total_size_bytes` Invariant**: The declared `total_size_bytes` value MUST strictly be a non-negative integer matching exactly the aggregate sum of stored parts byte sizes ($\sum_{i=1}^n \text{storedPart}_i.\text{size\_bytes}$). Any mismatch between declared `total_size_bytes` and the computed sum of stored parts byte sizes, or any non-number/string-encoded value (e.g., `"10485760"`), MUST be rejected with HTTP 400 `<Code>InvalidPart</Code>` (`TotalSizeMismatch`).
* **Part & Object Size Thresholds**:
  * **Strict Non-Negative Integer Requirement**: Part sizes MUST be strictly non-negative integers. Negative part sizes, non-integer values, or string-encoded sizes MUST be rejected with HTTP 400 `<Code>InvalidPart</Code>` (`InvalidPartSize`).
  * **Minimum Non-Final Part Size**: 5 MiB (5,242,880 bytes). All parts except the final part in the assembled object MUST be at least 5 MiB in size up to 5 GiB (5,368,709,120 bytes). Any non-final part smaller than 5 MiB MUST be rejected with HTTP 400 `<Code>EntityTooSmall</Code>`.
  * **Minimum Final Part Size**: 0 bytes. The final part in the assembled object MAY be between 0 bytes and 5 GiB (5,368,709,120 bytes) without triggering size rejection.
  * **Maximum Individual Part Size**: 5 GiB (5,368,709,120 bytes). Any individual part exceeding 5 GiB MUST be rejected with HTTP 400 `<Code>EntityTooLarge</Code>`.
  * **Maximum Aggregate Object Size**: 5 TiB (5,497,558,138,880 bytes). The aggregate assembled object size across all completed parts (up to 10,000 parts $\times$ 5 GiB) MUST NOT exceed 5 TiB. Aggregate assembled objects exceeding 5 TiB MUST be rejected with HTTP 400 `<Code>EntityTooLarge</Code>` (`TOTAL_SIZE_EXCEEDED`).

---

## 9. Normative Error Taxonomy & Status Mappings

Conforming storage providers MUST format all error responses as XML adhering to the standard S3 error schema:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>ErrorCode</Code>
  <Message>Human readable error description</Message>
  <Resource>/bucket/key</Resource>
  <RequestId>tx-request-id-trace</RequestId>
</Error>
```

### 9.1 Normative 13-Error Code Taxonomy

Conforming providers MUST implement and return exactly the 13 error codes defined below. Storage conformance profiles MUST declare exactly all 13 canonical S3 error codes without omission or substitution:

| # | Error Code (`<Code>`) | HTTP Status | Trigger Condition / Semantic Meaning |
|---|---|---|---|
| 1 | `BadDigest` | `400 Bad Request` | The `Content-MD5` or payload checksum calculated by the server does not match the digest value specified in the request header (including `XAmzContentSHA256Mismatch` and `PAYLOAD_SHA256_MISMATCH`). Strictly mandated for all payload digest mismatches (providers MUST NOT return `InvalidArgument` or `AccessDenied`). |
| 2 | `InvalidDigest` | `400 Bad Request` | The `Content-MD5` or digest header value is malformed (e.g., non-base64 characters or decoded length $\neq 16$ bytes for MD5, malformed/uppercase/whitespace SHA-256 string, or unsupported `STREAMING-*` payload headers such as `STREAMING-AWS4-HMAC-SHA256-PAYLOAD` triggering `UNSUPPORTED_STREAMING_PAYLOAD_SHA256`), mandatory `x-amz-content-sha256` header is missing on `PutObject`, payload inputs fail type gating (`null`, `undefined`, `Date`, `Uint16Array`, `Function`, plain objects, numbers, booleans, arrays, or other structured non-byte types failing raw octet buffer or UTF-8 string requirement, triggering `TypeError` in helper routines or `MALFORMED_PAYLOAD_TYPE` in dispatchers), or headers/payload inputs fail own-property resolution (inherited headers or payload properties triggering `MALFORMED_HEADER_SYNTAX`). `STREAMING-*` SHA-256 header validation is executed unconditionally before any MD5 validation or payload digest comparisons, immediately returning HTTP 400 `InvalidDigest` (`UNSUPPORTED_STREAMING_PAYLOAD_SHA256`). Strictly mandated for malformed digest strings, unsupported streaming payload sentinels, missing `x-amz-content-sha256`, invalid payload types (`MALFORMED_PAYLOAD_TYPE`), or prototype-inherited headers (providers MUST NOT return `InvalidArgument` or `BadDigest`). |
| 3 | `NoSuchBucket` | `404 Not Found` | The specified target bucket does not exist. |
| 4 | `NoSuchKey` | `404 Not Found` | The specified object key does not exist in the bucket. |
| 5 | `NoSuchUpload` | `404 Not Found` | The specified multipart `UploadId` does not exist, has been aborted, or has already completed. |
| 6 | `ObjectLockConfigurationNotFoundError` | `404 Not Found` | Object Lock is not enabled on the parent bucket, or no retention/legal-hold configuration exists for the requested object version. |
| 7 | `PreconditionFailed` | `412 Precondition Failed` | At least one condition specified in conditional headers (`If-Match`, `If-None-Match`, `If-Modified-Since`, `If-Unmodified-Since`) evaluated to false. |
| 8 | `AccessDenied` | `403 Forbidden` | Invalid authentication credentials, SigV4 signature mismatch, missing permissions, or attempt to overwrite/delete a WORM-locked object version. |
| 9 | `EntityTooLarge` | `400 Bad Request` | Proposed object payload or individual part segment exceeds maximum allowed size (5 GiB) or aggregate assembled object size exceeds maximum allowed size (5 TiB, `TOTAL_SIZE_EXCEEDED`). |
| 10 | `EntityTooSmall` | `400 Bad Request` | Proposed part size in multipart upload is below the minimum allowed part size boundary (5 MiB for non-final parts). |
| 11 | `InvalidArgument` | `400 Bad Request` | An invalid argument or malformed XML body was supplied (e.g., part number outside 1–10,000 `INVALID_PART_NUMBER`, part count exceeding 10,000 `TOO_MANY_PARTS`, empty parts list, class instances, non-plain prototypes, or prototype-inherited manifest wrappers / parts list `EMPTY_PARTS_LIST`, unknown retention mode, malformed XML structure). MUST NOT be returned in lieu of `BadDigest` or `InvalidDigest`. |
| 12 | `InvalidPart` | `400 Bad Request` | One or more declared parts in `CompleteMultipartUpload` were not found, the provided part ETag does not match the stored part ETag, manifest or stored part ETag is malformed (not matching regex `^\"[a-fA-F0-9]{32}(?:-[0-9]{1,5})?\"$` exactly, unquoted, asymmetric quotes, or non-hex payload -> `InvalidETagFormat`), a completed part lacks a mandatory valid integer stored-part size (`sp.size`, `sp.size_bytes`, `sp.Size` -> `InvalidPartSize`), manifest parts or stored parts are class instances, non-plain prototypes, or have prototype-inherited `part_number`, `etag`, or `size_bytes` (failing plain object prototype or own-property resolution), or declared `total_parts` / `total_size_bytes` (if provided) fails type-check (non-number or string-encoded such as `"1"`, or prototype-inherited -> `TotalPartsMismatch` / `TotalSizeMismatch`) or does not match actual manifest parts count or sum of stored parts byte sizes. |
| 13 | `InvalidPartOrder` | `400 Bad Request` | The list of parts in `CompleteMultipartUpload` was not in strictly ascending numerical order by part number, or contained duplicate part numbers. |

---

## 10. Subordinate Contract Artifact & Schema Alignment

This specification serves as the normative prose baseline for the subordinate schema artifact:
* **Schema Location**: `contracts/json-schema/cybrik.storage-s3-compatibility-subset.v1.schema.json`
* **JSON Schema Dialect**: `https://json-schema.org/draft/2020-12/schema`
* **Conformance Test Location**: `tools/contract-validation/tests/validate-s3-compatibility.test.mjs`

Any implementation declaring conformance with Platform Contract Slot 5 MUST satisfy both the schema validation rules and the behavioral invariants defined herein.

---

## 11. Acceptance Checklist & Transition Requirements

To advance this specification from `PROPOSED` to `ACCEPTED`, the following conditions MUST be met:

1. **Founder Decision**: Formal review and acceptance recorded in a dedicated Founder Decision Packet.
2. **Schema & Fixture Closure**: Schema `cybrik.storage-s3-compatibility-subset.v1.schema.json` and associated test fixtures reconciled to reflect the 15-operation baseline (non-immutable profiles) and 19 operations when Object Lock is included.
3. **Automated Test Validation**: 100% test pass across canonical contract validation suites (`validate:platform`, `validate:schemas`, `validate:s3`).
4. **Provider-Neutral Verification**: Reconfirmation that the specification contains zero proprietary SDK tokens, vendor-specific lock-ins, or cloud provider hard dependencies.
