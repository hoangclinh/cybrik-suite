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
|   |  - DeleteObjects    |                          |  - ListParts       |   |
|   +---------------------+  +--------------------+  +--------------------+   |
|                            |  WORM / Lock (4)   |                           |
|                            |  - PutObjRetention |                           |
|                            |  - GetObjRetention |                           |
|                            |  - PutObjLegalHold |                           |
|                            |  - GetObjLegalHold |                           |
|                            +--------------------+                           |
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

* **`INV-S3-01` (Exact 17 Mandatory Operations)**: The provider MUST implement exactly the 17 required operations specified in §4. No subset omission is permitted.
* **`INV-S3-02` (Mandatory Path-Style Addressing)**: The provider MUST support path-style request routing (`https://{endpoint}/{bucket}/{key}`) without requiring DNS-level virtual-host bucket resolution.
* **`INV-S3-03` (AWS SigV4 Authentication)**: The provider MUST authenticate requests signed with `AWS4-HMAC-SHA256` in compliance with AWS Signature Version 4.
* **`INV-S3-04` (Strict RFC 3986 URL Path Encoding)**: Request URI paths MUST adhere to RFC 3986 unreserved character preservation and uppercase percent-encoding rules.
* **`INV-S3-05` (Strict End-to-End Digest Verification)**: The provider MUST compute and validate payload digests against `Content-MD5` and `x-amz-content-sha256` headers, failing closed with `BadDigest` on payload digest mismatch and `InvalidDigest` on malformed digest headers.
* **`INV-S3-06` (Version-Level Object Lock Immutability)**: The provider MUST enforce WORM retention on individual object versions in both `COMPLIANCE` and `GOVERNANCE` modes, preventing premature deletion or overwrite of protected version IDs until the retain-until date expires.
* **`INV-S3-07` (Legal Hold Independence)**: Legal hold status MUST operate independently of retention expiration dates, preventing version deletion while `Status=ON`.
* **`INV-S3-08` (Standard Error Taxonomy)**: Errors MUST return standard HTTP status codes and the normative S3 XML error envelope conforming to the 12-error taxonomy.
* **`INV-S3-09` (Multipart Upload Integrity)**: Multipart uploads MUST be atomic upon completion and guarantee part checksum consistency and ordered assembly.
* **`INV-S3-10` (Strong Consistency)**: Read-after-write consistency MUST be guaranteed for `PutObject`, `CompleteMultipartUpload`, and `DeleteObject`.

---

## 4. Required Operations Inventory (Exact 17 Operations)

The Platform Contract Slot 5 interface consists of exactly 17 mandatory operations, categorized into four functional groups:

| # | Operation Identifier | HTTP Verb & Path Pattern | Functional Category | Purpose / Architectural Consumer |
|---|---|---|---|---|
| 1 | `PutObject` | `PUT /{bucket}/{key+}` | Object CRUD | Write object data, metadata, and checksums |
| 2 | `GetObject` | `GET /{bucket}/{key+}` | Object CRUD | Read object payload and user metadata |
| 3 | `HeadObject` | `HEAD /{bucket}/{key+}` | Object CRUD | Retrieve object headers, ETag, and metadata |
| 4 | `DeleteObject` | `DELETE /{bucket}/{key+}` | Object CRUD | Remove an object version or place a delete marker |
| 5 | `DeleteObjects` | `POST /{bucket}?delete` | Object CRUD | Multi-object batch deletion in a single request |
| 6 | `HeadBucket` | `HEAD /{bucket}` | Bucket / Listing | Verify bucket existence and caller access |
| 7 | `CreateBucket` | `PUT /{bucket}` | Bucket / Listing | Create a storage bucket with Object Lock support |
| 8 | `ListObjectsV2` | `GET /{bucket}?list-type=2` | Bucket / Listing | Paginated listing of objects by prefix and delimiter |
| 9 | `CreateMultipartUpload` | `POST /{bucket}/{key+}?uploads` | Multipart Upload | Initiate a multi-part segmented upload session |
| 10 | `UploadPart` | `PUT /{bucket}/{key+}?uploadId={id}&partNumber={n}` | Multipart Upload | Upload an individual bounded part segment |
| 11 | `CompleteMultipartUpload` | `POST /{bucket}/{key+}?uploadId={id}` | Multipart Upload | Assemble uploaded parts into a single coherent object |
| 12 | `AbortMultipartUpload` | `DELETE /{bucket}/{key+}?uploadId={id}` | Multipart Upload | Cancel session and reclaim allocated part storage |
| 13 | `ListParts` | `GET /{bucket}/{key+}?uploadId={id}` | Multipart Upload | List uploaded parts for an in-progress upload session |
| 14 | `PutObjectRetention` | `PUT /{bucket}/{key+}?retention` | WORM / Object Lock | Set retention mode and `RetainUntilDate` on a version |
| 15 | `GetObjectRetention` | `GET /{bucket}/{key+}?retention` | WORM / Object Lock | Query current retention configuration of a version |
| 16 | `PutObjectLegalHold` | `PUT /{bucket}/{key+}?legal-hold` | WORM / Object Lock | Apply or lift an indefinite legal hold on a version |
| 17 | `GetObjectLegalHold` | `GET /{bucket}/{key+}?legal-hold` | WORM / Object Lock | Query current legal hold status of a version |

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
  * `400 Bad Request` (`BadDigest`): `Content-MD5` does not match calculated payload digest.
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` header is malformed (not valid 128-bit Base64).
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
  * `400 Bad Request` (`InvalidPart`): Declared part ETag does not match stored part ETag or part is missing.
  * `400 Bad Request` (`InvalidPartOrder`): Parts are not sorted in ascending numerical order by part number.
  * `404 Not Found` (`NoSuchUpload`): Upload session does not exist.

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

### 5.14 Operation 14: `PutObjectRetention`

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
  * `400 Bad Request` (`BadDigest`): `Content-MD5` mismatch on XML body.
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` is malformed Base64.
  * `400 Bad Request` (`InvalidArgument`): Malformed XML payload or invalid retention mode.
  * `403 Forbidden` (`AccessDenied`): Attempting to shorten `RetainUntilDate` in `COMPLIANCE` mode or altering `GOVERNANCE` retention without bypass authorization.
  * `404 Not Found` (`NoSuchKey`): Object or version does not exist.
  * `404 Not Found` (`ObjectLockConfigurationNotFoundError`): Object Lock is not enabled on the parent bucket.

---

### 5.15 Operation 15: `GetObjectRetention`

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
  * `404 Not Found` (`ObjectLockConfigurationNotFoundError`): Object or bucket has no retention configured, or Object Lock is not enabled on the bucket.
  * `404 Not Found` (`NoSuchKey`): Object or version does not exist.

---

### 5.16 Operation 16: `PutObjectLegalHold`

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
  * `400 Bad Request` (`BadDigest`): Body MD5 mismatch.
  * `400 Bad Request` (`InvalidDigest`): `Content-MD5` is malformed Base64.
  * `400 Bad Request` (`InvalidArgument`): Malformed XML body or invalid `Status` string.
  * `404 Not Found` (`NoSuchKey`): Object or version does not exist.
  * `404 Not Found` (`ObjectLockConfigurationNotFoundError`): Object Lock is not enabled on the parent bucket.

---

### 5.17 Operation 17: `GetObjectLegalHold`

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

1. **Version ID Granularity**:
   * Object Lock retention rules (`COMPLIANCE`, `GOVERNANCE`) and Legal Holds apply strictly to **individual version IDs** (`versionId`) within a versioning-enabled bucket, rather than globally across the mutable key path pointer.
   * Each object version possesses its own independent retention metadata (`Mode`, `RetainUntilDate`) and legal hold flag (`Status=ON|OFF`).

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

2. **`InvalidDigest` (`HTTP 400 Bad Request`)**:
   * **Semantic Trigger**: The value provided in the `Content-MD5` header is **malformed** and cannot be parsed as a valid 128-bit MD5 digest (e.g., contains non-base64 characters, invalid padding, or decodes to a byte sequence whose length is not exactly 16 bytes).
   * **Cause**: Syntactically invalid header syntax or encoding error by the client.
   * **Error Code**: `<Code>InvalidDigest</Code>`.

### 8.2 Payload SHA-256 Validation (`x-amz-content-sha256`)
* The server MUST verify the received payload against the 64-character hexadecimal SHA-256 digest provided in `x-amz-content-sha256` (when not `UNSIGNED-PAYLOAD`).
* Syntactically invalid SHA-256 header values (e.g., length $\neq 64$, non-hex characters) MUST be rejected with HTTP 400 (`InvalidDigest` or `InvalidArgument`).
* SHA-256 hash mismatches during AWS SigV4 authorization MUST result in signature authentication failure rejected with HTTP 403 `AccessDenied` or HTTP 400 `BadDigest`.

### 8.3 ETag Formats
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

### 9.1 Normative 12-Error Code Taxonomy

Conforming providers MUST implement and return exactly the 12 error codes defined below:

| # | Error Code (`<Code>`) | HTTP Status | Trigger Condition / Semantic Meaning |
|---|---|---|---|
| 1 | `BadDigest` | `400 Bad Request` | The `Content-MD5` or payload checksum calculated by the server does not match the digest value specified in the request header. |
| 2 | `InvalidDigest` | `400 Bad Request` | The `Content-MD5` header value is malformed (e.g., non-base64 characters or decoded length $\neq 16$ bytes). |
| 3 | `NoSuchBucket` | `404 Not Found` | The specified target bucket does not exist. |
| 4 | `NoSuchKey` | `404 Not Found` | The specified object key does not exist in the bucket. |
| 5 | `NoSuchUpload` | `404 Not Found` | The specified multipart `UploadId` does not exist, has been aborted, or has already completed. |
| 6 | `ObjectLockConfigurationNotFoundError` | `404 Not Found` | Object Lock is not enabled on the parent bucket, or no retention/legal-hold configuration exists for the requested object version. |
| 7 | `PreconditionFailed` | `412 Precondition Failed` | At least one condition specified in conditional headers (`If-Match`, `If-None-Match`, `If-Modified-Since`, `If-Unmodified-Since`) evaluated to false. |
| 8 | `AccessDenied` | `403 Forbidden` | Invalid authentication credentials, SigV4 signature mismatch, missing permissions, or attempt to overwrite/delete a WORM-locked object version. |
| 9 | `EntityTooLarge` | `400 Bad Request` | Proposed object payload or part segment exceeds the maximum allowed size boundary (5 GiB). |
| 10 | `InvalidArgument` | `400 Bad Request` | An invalid argument or malformed XML body was supplied (e.g., part number outside 1–10,000, unknown retention mode, malformed XML structure). |
| 11 | `InvalidPart` | `400 Bad Request` | One or more declared parts in `CompleteMultipartUpload` were not found or the provided part ETag does not match the stored part ETag. |
| 12 | `InvalidPartOrder` | `400 Bad Request` | The list of parts in `CompleteMultipartUpload` was not in ascending numerical order by part number. |

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
2. **Schema & Fixture Closure**: Schema `cybrik.storage-s3-compatibility-subset.v1.schema.json` and associated test fixtures updated to reflect the exact 17-operation closed inventory.
3. **Automated Test Validation**: 100% test pass across canonical contract validation suites (`validate:platform`, `validate:schemas`, `validate:s3`).
4. **Provider-Neutral Verification**: Reconfirmation that the specification contains zero proprietary SDK tokens, vendor-specific lock-ins, or cloud provider hard dependencies.
