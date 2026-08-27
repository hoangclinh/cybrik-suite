# Platform Contract Slot 5: Storage S3-Compatible Subset Specification v1

**Status:** `PROPOSED (Open-Item OPEN-2 Elaboration) — NOT ACCEPTED`
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
|   |   Object CRUD (5)   |  |  WORM / Lock (4)   |  |   Multipart (4)    |   |
|   |  - PutObject        |  |  - PutObjRetention |  |  - CreateMPU       |   |
|   |  - GetObject        |  |  - GetObjRetention |  |  - UploadPart      |   |
|   |  - HeadObject       |  |  - PutObjLegalHold |  |  - CompleteMPU     |   |
|   |  - DeleteObject     |  |  - GetObjLegalHold |  |  - AbortMPU        |   |
|   |  - ListObjectsV2    |  |                    |  |                    |   |
|   +---------------------+  +--------------------+  +--------------------+   |
|                                                                             |
|   Wire Invariants:                                                          |
|   * Path-Style Addressing Mandatory  * AWS SigV4 (AWS4-HMAC-SHA256)         |
|   * Strict RFC 3986 URL Encoding     * Strict Checksum & Digest Validation  |
|   * Normative S3 XML Error Schema    * Strong Read-After-Write Consistency  |
+-----------------------------------------------------------------------------+
```

---

## 3. Normative System Invariants

A conforming Platform Contract Slot 5 storage provider MUST satisfy the following core invariants:

* **`INV-S3-01` (Exact 13 Mandatory Operations)**: The provider MUST implement exactly the 13 required operations specified in §4. No subset omission is permitted.
* **`INV-S3-02` (Mandatory Path-Style Addressing)**: The provider MUST support path-style request routing (`https://{endpoint}/{bucket}/{key}`) without requiring DNS-level virtual-host bucket resolution.
* **`INV-S3-03` (AWS SigV4 Authentication)**: The provider MUST authenticate requests signed with `AWS4-HMAC-SHA256` in compliance with AWS Signature Version 4.
* **`INV-S3-04` (Strict RFC 3986 URL Path Encoding)**: Request URI paths MUST adhere to RFC 3986 unreserved character preservation and uppercase percent-encoding rules.
* **`INV-S3-05` (Strict End-to-End Digest Verification)**: The provider MUST compute and validate payload digests against `Content-MD5` and `x-amz-content-sha256` headers, failing closed with `InvalidDigest` on mismatch.
* **`INV-S3-06` (Object Lock Immutability)**: The provider MUST enforce WORM retention in both `COMPLIANCE` and `GOVERNANCE` modes, preventing premature deletion or modification of locked objects.
* **`INV-S3-07` (Legal Hold Independence)**: Legal hold status MUST operate independently of retention expiration dates, preventing deletion while `Status=ON`.
* **`INV-S3-08` (Standard Error Taxonomy)**: Errors MUST return standard HTTP status codes and the normative S3 XML error envelope.
* **`INV-S3-09` (Multipart Upload Integrity)**: Multipart uploads MUST be atomic upon completion and guarantee part checksum consistency.
* **`INV-S3-10` (Strong Consistency)**: Read-after-write consistency MUST be guaranteed for `PutObject`, `CompleteMultipartUpload`, and `DeleteObject`.

---

## 4. Required Operations Inventory (Exact 13 Operations)

The Platform Contract Slot 5 interface consists of exactly 13 mandatory operations, categorized into three functional groups:

| # | Operation Identifier | HTTP Verb & Path Pattern | Functional Category | Purpose / Architectural Consumer |
|---|---|---|---|---|
| 1 | `PutObject` | `PUT /{bucket}/{key+}` | Object CRUD | Write object data, metadata, and checksums |
| 2 | `GetObject` | `GET /{bucket}/{key+}` | Object CRUD | Read object payload and user metadata |
| 3 | `HeadObject` | `HEAD /{bucket}/{key+}` | Object CRUD | Retrieve object headers, ETag, and metadata |
| 4 | `DeleteObject` | `DELETE /{bucket}/{key+}` | Object CRUD | Remove an unprotected object version |
| 5 | `ListObjectsV2` | `GET /{bucket}?list-type=2` | Object CRUD | Paginated listing of objects by prefix |
| 6 | `PutObjectRetention` | `PUT /{bucket}/{key+}?retention` | WORM / Object Lock | Set retention mode and `RetainUntilDate` |
| 7 | `GetObjectRetention` | `GET /{bucket}/{key+}?retention` | WORM / Object Lock | Query current retention configuration |
| 8 | `PutObjectLegalHold` | `PUT /{bucket}/{key+}?legal-hold` | WORM / Object Lock | Apply or lift an indefinite legal hold |
| 9 | `GetObjectLegalHold` | `GET /{bucket}/{key+}?legal-hold` | WORM / Object Lock | Query current legal hold status |
| 10 | `CreateMultipartUpload` | `POST /{bucket}/{key+}?uploads` | Multipart Upload | Initiate a multi-part segmented upload session |
| 11 | `UploadPart` | `PUT /{bucket}/{key+}?uploadId={id}&partNumber={n}` | Multipart Upload | Upload an individual bounded part segment |
| 12 | `CompleteMultipartUpload` | `POST /{bucket}/{key+}?uploadId={id}` | Multipart Upload | Assemble uploaded parts into a single object |
| 13 | `AbortMultipartUpload` | `DELETE /{bucket}/{key+}?uploadId={id}` | Multipart Upload | Cancel session and reclaim allocated part storage |

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
  * `x-amz-content-sha256`: Hexadecimal SHA-256 digest of the request body (or `UNSIGNED-PAYLOAD` where permitted by profile).
* **Optional Headers**:
  * `Content-MD5`: Base64-encoded 128-bit MD5 digest of the payload.
  * `Content-Type`: MIME type of the payload (default: `application/octet-stream`).
  * `x-amz-meta-*`: User-defined metadata key-value pairs.
  * `x-amz-object-lock-mode`: `COMPLIANCE` | `GOVERNANCE` (for atomic lock creation).
  * `x-amz-object-lock-retain-until-date`: ISO 8601 UTC timestamp for retention expiry.
  * `x-amz-object-lock-legal-hold`: `ON` | `OFF`.
* **Request Body**: Binary octet stream representing object contents.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**:
    * `ETag`: Double-quoted MD5 hex digest (`"<md5-hex>"`).
    * `x-amz-request-id`: Opaque tracking identifier.
    * `x-amz-version-id`: Version identifier if versioning is active.
  * **Response Body**: Empty.
* **Failure Modes**:
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` or `x-amz-content-sha256` does not match calculated payload digest.
  * `400 Bad Request` (`EntityTooLarge`): Payload exceeds maximum allowed single-put size (5 GiB).
  * `403 Forbidden` (`AccessDenied`): Missing write permissions or attempt to overwrite a locked object.
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
  * `404 Not Found`: Returns HTTP 404 with empty body when object or bucket does not exist.

---

### 5.4 Operation 4: `DeleteObject`

Deletes an object version or places a delete marker on unversioned/version-enabled buckets.

* **HTTP Method**: `DELETE`
* **Resource Path**: `/{bucket}/{key+}`
* **Optional Query Parameters**:
  * `versionId`: Specific version to permanently remove.
* **Optional Headers**:
  * `x-amz-bypass-governance-retention`: `true` | `false` (requires administrative bypass privilege).
* **Success Response**:
  * **HTTP Status**: `204 No Content`
  * **Response Headers**:
    * `x-amz-delete-marker`: `true` if a delete marker was created.
    * `x-amz-version-id`: Version ID of the created delete marker or deleted version.
  * **Response Body**: Empty.
* **Failure Modes**:
  * `403 Forbidden` (`AccessDenied`): Object is protected by an active Object Lock (`COMPLIANCE` mode, unexpired `GOVERNANCE` mode without bypass, or active `LegalHold`).
  * `404 Not Found` (`NoSuchBucket`): Target bucket does not exist.

---

### 5.5 Operation 5: `ListObjectsV2`

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
  * `404 Not Found` (`NoSuchBucket`): Specified bucket does not exist.

---

### 5.6 Operation 6: `PutObjectRetention`

Configures or extends the WORM retention configuration for a specific object version.

* **HTTP Method**: `PUT`
* **Resource Path**: `/{bucket}/{key+}?retention`
* **Optional Query Parameters**:
  * `versionId`: Target object version ID.
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
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` mismatch on XML body.
  * `403 Forbidden` (`AccessDenied`): Attempting to shorten `RetainUntilDate` in `COMPLIANCE` mode or altering `GOVERNANCE` retention without bypass authorization.
  * `404 Not Found` (`NoSuchKey`): Object does not exist.
  * `404 Not Found` (`ObjectLockConfigurationNotFoundError`): Object Lock is not enabled on the parent bucket.

---

### 5.7 Operation 7: `GetObjectRetention`

Queries the active WORM retention configuration of an object version.

* **HTTP Method**: `GET`
* **Resource Path**: `/{bucket}/{key+}?retention`
* **Optional Query Parameters**:
  * `versionId`: Target object version ID.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document containing current `<Retention>` (`Mode` and `RetainUntilDate`).
* **Failure Modes**:
  * `404 Not Found` (`NoSuchObjectLockConfiguration` / `ObjectLockConfigurationNotFoundError`): Object or bucket has no retention configured.
  * `404 Not Found` (`NoSuchKey`): Object does not exist.

---

### 5.8 Operation 8: `PutObjectLegalHold`

Applies or releases an indefinite legal hold on an object version.

* **HTTP Method**: `PUT`
* **Resource Path**: `/{bucket}/{key+}?legal-hold`
* **Optional Query Parameters**:
  * `versionId`: Target object version ID.
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
  * `400 Bad Request` (`InvalidDigest`): Body MD5 mismatch.
  * `404 Not Found` (`NoSuchKey`): Object does not exist.
  * `404 Not Found` (`ObjectLockConfigurationNotFoundError`): Object Lock is not enabled on the parent bucket.

---

### 5.9 Operation 9: `GetObjectLegalHold`

Retrieves the legal hold status of an object version.

* **HTTP Method**: `GET`
* **Resource Path**: `/{bucket}/{key+}?legal-hold`
* **Optional Query Parameters**:
  * `versionId`: Target object version ID.
* **Success Response**:
  * **HTTP Status**: `200 OK`
  * **Response Headers**: `Content-Type: application/xml`
  * **Response Body**: XML document returning `<LegalHold><Status>ON|OFF</Status></LegalHold>`.
* **Failure Modes**:
  * `404 Not Found` (`NoSuchObjectLockConfiguration` / `ObjectLockConfigurationNotFoundError`): No legal hold configured.
  * `404 Not Found` (`NoSuchKey`): Object does not exist.

---

### 5.10 Operation 10: `CreateMultipartUpload`

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
  * `404 Not Found` (`NoSuchBucket`): Bucket does not exist.

---

### 5.11 Operation 11: `UploadPart`

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
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` or SHA-256 mismatch.
  * `400 Bad Request` (`EntityTooLarge`): Part size exceeds 5 GiB limit.
  * `404 Not Found` (`NoSuchUpload`): `UploadId` is invalid or expired.

---

### 5.12 Operation 12: `CompleteMultipartUpload`

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
  * `400 Bad Request` (`InvalidPart`): Declared part ETag does not match stored part ETag.
  * `400 Bad Request` (`InvalidPartOrder`): Parts are not sorted in ascending numerical order.
  * `404 Not Found` (`NoSuchUpload`): Upload session does not exist.

---

### 5.13 Operation 13: `AbortMultipartUpload`

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

## 6. Object Lock, WORM & Retention Semantics

WORM (Write-Once-Read-Many) guarantees are essential for forensic evidence preservation, immutable audit ledgers (ADR-0014), and compliance verification.

### 6.1 Prerequisites for Object Lock
* **Bucket-Level Enablement**: Object Lock MUST be enabled at bucket creation time. An object cannot be locked in a bucket that lacks Object Lock support.
* **Versioning Prerequisite**: Buckets with Object Lock enabled MUST maintain versioning in the `Enabled` state. Versioning cannot be suspended on an Object Lock enabled bucket.

### 6.2 Retention Modes

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
|  |    shortened                      |  |    s3:BypassGovernanceRetention|  |
|  |  * RetainUntilDate CAN be extended|  |    header                      |  |
|  +-----------------------------------+  +--------------------------------+  |
+-----------------------------------------------------------------------------+
```

1. **`COMPLIANCE` Mode**:
   * **Absolute Immutability**: Protected object versions cannot be deleted, overwritten, or modified by any authenticated identity, root account, or storage administrator until `RetainUntilDate` has elapsed.
   * **Monotone Extension Rule**: The `RetainUntilDate` MAY be extended to a later timestamp (`new_date > existing_date`). Any request attempting to shorten or remove the retention date MUST be rejected with HTTP 403 `AccessDenied`.
   * **Mode Permanence**: An object version in `COMPLIANCE` mode cannot be downgraded to `GOVERNANCE` mode or unlocked.

2. **`GOVERNANCE` Mode**:
   * **Privileged Override**: Standard deletion and overwrite attempts are blocked.
   * **Bypass Authorization**: Users possessing explicit administrative governance bypass permissions can bypass retention by providing the header `x-amz-bypass-governance-retention: true`.

### 6.3 Legal Hold Semantics
* **Indefinite Duration**: A Legal Hold maintains an explicit status flag (`Status=ON` or `Status=OFF`). While `Status=ON`, the object version cannot be deleted regardless of whether its retention period has expired or if no retention period was configured.
* **Orthogonality**: Legal Hold status is orthogonal to and independent from retention mode (`COMPLIANCE`/`GOVERNANCE`) and `RetainUntilDate`.
* **Explicit Release**: A Legal Hold does not expire automatically; it requires an explicit `PutObjectLegalHold` call with `<Status>OFF</Status>`.

### 6.4 Timestamp & Date Normalization
* All retention dates MUST be formatted as ISO 8601 UTC strings terminating in `Z` or millisecond precision (e.g., `2031-08-27T00:00:00.000Z`).
* Providers MUST evaluate expiration using synchronized UTC clocks.

---

## 7. Addressing, URL Encoding & AWS SigV4 Compatibility

### 7.1 Path-Style Addressing
Conforming providers MUST support path-style request addressing as the normative default:

$$\text{URI} = \text{https://}\{\text{endpoint}\}/\{\text{bucket}\}/\{\text{key}\}$$

Virtual-host style addressing (`https://{bucket}.{endpoint}/{key}`) is non-normative and optional for on-premise / bare-metal environments.

### 7.2 Strict RFC 3986 URL Path Encoding
In accordance with RFC 3986 and AWS SigV4 canonicalization:
1. **Unreserved Characters**: The characters `A-Z`, `a-z`, `0-9`, `-`, `_`, `.`, `~` MUST NOT be percent-encoded.
2. **Reserved Characters**: All other characters (e.g., spaces, punctuation) MUST be percent-encoded using uppercase hexadecimal notation (`%XX`).
3. **Hierarchy Delimiters**: Forward slash (`/`) characters representing key hierarchy separators in URI paths MUST NOT be percent-encoded. Redundant sequential slashes (`//`) must not be ambiguously collapsed prior to signature verification.

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
|  | Headers:                       |                | 1. Compute SHA-256  |  |
|  | - Content-MD5: <base64>        |  ----------->  |    and MD5 over     |  |
|  | - x-amz-content-sha256: <hex>  |   (Payload)    |    received bytes   |  |
|  +--------------------------------+                +----------+----------+  |
|                                                               |             |
|                                    [ Digest Mismatch? ] <-----+             |
|                                            |                                |
|                        +-------------------+-------------------+            |
|                        | YES                                   | NO         |
|                        v                                       v            |
|             +---------------------+                 +--------------------+  |
|             | Reject Immediately  |                 | Store Object       |  |
|             | HTTP 400 Bad Request|                 | Return 200 OK      |  |
|             | Code: InvalidDigest |                 | ETag: "<md5-hex>"  |  |
|             +---------------------+                 +--------------------+  |
+-----------------------------------------------------------------------------+
```

1. **`Content-MD5` Validation**: When the client supplies `Content-MD5`, the server MUST compute the MD5 digest over the received payload bytes. If the computed digest does not match the header, the request MUST be rejected with HTTP 400 `InvalidDigest`.
2. **`x-amz-content-sha256` Validation**: The server MUST verify the received payload against the hex SHA-256 digest provided in `x-amz-content-sha256`. Any mismatch MUST result in immediate rejection.
3. **ETag Formats**:
   * For single-part `PutObject` uploads, `ETag` MUST be the double-quoted lowercase hex MD5 digest: `"<md5-hex>"`.
   * For multipart uploads assembled via `CompleteMultipartUpload`, `ETag` MUST follow the multipart composite format: `"<hex-digest>-<part-count>"`.

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

### 9.1 Normative Error Code Table

| Error Code (`<Code>`) | HTTP Status | Trigger Condition / Semantic Meaning |
|---|---|---|
| `InvalidDigest` | `400 Bad Request` | `Content-MD5` or SHA-256 digest does not match the received body. |
| `EntityTooLarge` | `400 Bad Request` | Proposed object or part exceeds maximum size boundary (5 GiB). |
| `InvalidArgument` | `400 Bad Request` | Malformed XML payload, invalid part number, or invalid retention mode. |
| `InvalidPart` | `400 Bad Request` | Part ETag in `CompleteMultipartUpload` does not match uploaded part. |
| `InvalidPartOrder` | `400 Bad Request` | Parts in `CompleteMultipartUpload` are not in ascending numerical order. |
| `AccessDenied` | `403 Forbidden` | Invalid credentials, SigV4 signature failure, or attempt to overwrite/delete a WORM-locked object. |
| `NoSuchBucket` | `404 Not Found` | The specified target bucket does not exist. |
| `NoSuchKey` | `404 Not Found` | The specified object key does not exist in the bucket. |
| `NoSuchUpload` | `404 Not Found` | The specified multipart `UploadId` is invalid, aborted, or completed. |
| `ObjectLockConfigurationNotFoundError` | `404 Not Found` | Object Lock is not enabled on the bucket, or object lacks retention configuration. |
| `PreconditionFailed` | `412 Precondition Failed` | At least one condition specified in `If-Match` or `If-Unmodified-Since` failed. |
| `InternalError` | `500 Internal Server Error` | Unrecoverable storage engine failure. |

---

## 10. Subordinate Contract Artifact & Schema Alignment

This specification serves as the normative prose baseline for the subordinate schema artifact:
* **Schema Location**: `contracts/json-schema/cybrik.storage-s3-compatibility-subset.v1.schema.json`
* **JSON Schema Dialect**: `https://json-schema.org/draft/2020-12/schema`
* **Conformance Test Location**: `tools/contract-validation/tests/validate-platform-contract.test.mjs`

Any implementation declaring conformance with Platform Contract Slot 5 MUST satisfy both the schema validation rules and the behavioral invariants defined herein.

---

## 11. Acceptance Checklist & Transition Requirements

To advance this specification from `PROPOSED` to `ACCEPTED`, the following conditions MUST be met:

1. **Founder Decision**: Formal review and acceptance recorded in a dedicated Founder Decision Packet.
2. **Schema & Fixture Closure**: Schema `cybrik.storage-s3-compatibility-subset.v1.schema.json` and associated test fixtures updated to reflect the exact 13-operation inventory.
3. **Automated Test Validation**: 100% test pass across canonical contract validation suites (`validate:platform`, `validate:schemas`).
4. **Provider-Neutral Verification**: Reconfirmation that the specification contains zero proprietary SDK tokens, vendor-specific lock-ins, or cloud provider hard dependencies.
