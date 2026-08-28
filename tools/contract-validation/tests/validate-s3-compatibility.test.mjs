import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import {
  dispatchS3Error,
  dispatchS3PutObject,
  dispatchS3CompleteMultipartUpload,
  computePayloadMd5,
  computePayloadSha256,
  isMalformedBase64Md5,
  isMalformedSha256,
  isMalformedPayloadType,
  getOwn,
  hasOwnAccessors,
  verifyDigestErrorDispatch,
  verifyMalformedHeaderDispatch,
  validateS3MultipartSemantics,
  validatePlatformSemantics,
  validateS3ConformanceProfileSemantics,
  S3_CANONICAL_ERROR_CODES,
  S3_15_BASELINE_OPS,
  S3_4_OBJECT_LOCK_OPS,
  S3_19_CLOSED_OPS,
  S3_15_OPERATIONS,
  S3_19_OPERATIONS,
} from '../validate-schemas.mjs';

const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const ajv = new Ajv2020({
  strict: true,
  strictTypes: false,
  strictRequired: false,
  allErrors: true,
  allowUnionTypes: true,
});
addFormats(ajv);

for (const kw of [
  'x-cybrik-status',
  'x-cybrik-lifecycle',
  'x-cybrik-not-accepted',
  'x-cybrik-contract-version',
  'x-cybrik-format-pins',
]) {
  ajv.addKeyword({ keyword: kw });
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const JSON_SCHEMA_DIR = join(ROOT, 'contracts/json-schema');
const EXAMPLES_STORAGE_DIR = join(ROOT, 'contracts/examples/storage');
const S3_SCHEMA_FILE = 'cybrik.storage-s3-compatibility-subset.v1.schema.json';
const S3_SCHEMA_PATH = join(JSON_SCHEMA_DIR, S3_SCHEMA_FILE);

assert.ok(existsSync(S3_SCHEMA_PATH), `S3 schema file missing: ${S3_SCHEMA_PATH}`);
const s3SchemaDoc = JSON.parse(readFileSync(S3_SCHEMA_PATH, 'utf8'));
ajv.addSchema(s3SchemaDoc, s3SchemaDoc.$id);

const S3_SCHEMA_ID = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
const PROFILE_DEF_ID = `${S3_SCHEMA_ID}#/$defs/storageConformanceProfile`;
const RETENTION_DEF_ID = `${S3_SCHEMA_ID}#/$defs/objectRetentionCompliance`;
const MULTIPART_DEF_ID = `${S3_SCHEMA_ID}#/$defs/multipartUploadManifest`;
const RETENTION_MODE_DEF_ID = `${S3_SCHEMA_ID}#/$defs/retentionMode`;
const LEGAL_HOLD_DEF_ID = `${S3_SCHEMA_ID}#/$defs/legalHoldStatus`;
const BUCKET_NAME_DEF_ID = `${S3_SCHEMA_ID}#/$defs/bucketName`;
const OBJECT_KEY_DEF_ID = `${S3_SCHEMA_ID}#/$defs/objectKey`;
const S3_URI_DEF_ID = `${S3_SCHEMA_ID}#/$defs/s3Uri`;
const PATH_STYLE_URL_DEF_ID = `${S3_SCHEMA_ID}#/$defs/pathStyleUrl`;
const S3_OP_DEF_ID = `${S3_SCHEMA_ID}#/$defs/s3Operation`;

const BASELINE_15_S3_OPERATIONS = [
  'PutObject',
  'GetObject',
  'HeadObject',
  'DeleteObject',
  'DeleteObjects',
  'ListObjectsV2',
  'HeadBucket',
  'CreateBucket',
  'CreateMultipartUpload',
  'UploadPart',
  'CompleteMultipartUpload',
  'AbortMultipartUpload',
  'ListParts',
  'PutBucketVersioning',
  'GetBucketVersioning',
];

const OBJECT_LOCK_4_S3_OPERATIONS = [
  'PutObjectRetention',
  'GetObjectRetention',
  'PutObjectLegalHold',
  'GetObjectLegalHold',
];

const CLOSED_19_S3_OPERATIONS = [
  ...BASELINE_15_S3_OPERATIONS,
  ...OBJECT_LOCK_4_S3_OPERATIONS,
];

const CLOSED_17_S3_OPERATIONS = [
  'PutObject',
  'GetObject',
  'HeadObject',
  'DeleteObject',
  'DeleteObjects',
  'ListObjectsV2',
  'HeadBucket',
  'CreateBucket',
  'PutObjectRetention',
  'GetObjectRetention',
  'PutObjectLegalHold',
  'GetObjectLegalHold',
  'CreateMultipartUpload',
  'UploadPart',
  'CompleteMultipartUpload',
  'AbortMultipartUpload',
  'ListParts',
];

const CLOSED_13_S3_ERROR_CODES = [
  'BadDigest',
  'InvalidDigest',
  'NoSuchBucket',
  'NoSuchKey',
  'NoSuchUpload',
  'ObjectLockConfigurationNotFoundError',
  'PreconditionFailed',
  'AccessDenied',
  'EntityTooLarge',
  'EntityTooSmall',
  'InvalidArgument',
  'InvalidPart',
  'InvalidPartOrder',
];

test('schema governance and lifecycle invariants', () => {
  assert.equal(s3SchemaDoc.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(s3SchemaDoc.$id, S3_SCHEMA_ID);
  assert.equal(s3SchemaDoc['x-cybrik-status'], 'PROPOSED');
  assert.equal(s3SchemaDoc['x-cybrik-lifecycle'], 'PROPOSED');
  assert.equal(s3SchemaDoc['x-cybrik-not-accepted'], true);
  assert.equal(s3SchemaDoc['x-cybrik-contract-version'], '0.1.0');
});

test('validate positive storage fixtures', () => {
  const positives = [
    {
      file: 's3-storage-conformance-profile.json',
      schemaId: PROFILE_DEF_ID,
      alsoTestRoot: true,
    },
    {
      file: 's3-object-retention-compliance.json',
      schemaId: RETENTION_DEF_ID,
      alsoTestRoot: false,
    },
    {
      file: 's3-multipart-upload-manifest.json',
      schemaId: MULTIPART_DEF_ID,
      alsoTestRoot: false,
    },
  ];

  for (const pos of positives) {
    const filePath = join(EXAMPLES_STORAGE_DIR, 'positive', pos.file);
    assert.ok(existsSync(filePath), `Positive fixture missing: ${filePath}`);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

    const validDef = ajv.validate(pos.schemaId, data);
    assert.ok(
      validDef,
      `Positive fixture ${pos.file} failed against ${pos.schemaId}: ${ajv.errorsText()}`
    );

    if (pos.alsoTestRoot) {
      const validRoot = ajv.validate(S3_SCHEMA_ID, data);
      assert.ok(
        validRoot,
        `Positive fixture ${pos.file} failed against root schema: ${ajv.errorsText()}`
      );
    }
  }
});

const EXPECTED_STORAGE_NEGATIVES = {
  'invalid-s3-unsupported-operation.json': {
    schemaId: PROFILE_DEF_ID,
    keyword: 'enum',
    instancePath: '/required_operations/16',
  },
  'invalid-s3-missing-retention-mode.json': {
    schemaId: RETENTION_DEF_ID,
    keyword: 'required',
    instancePath: '',
    missingProperty: 'retention_mode',
  },
  'invalid-s3-missing-version-id-evidence.json': {
    schemaId: RETENTION_DEF_ID,
    keyword: 'required',
    instancePath: '',
    missingProperty: 'version_id',
  },
  'invalid-s3-malformed-digest.json': {
    schemaId: MULTIPART_DEF_ID,
    keyword: 'pattern',
    instancePath: '/parts/0/sha256',
  },
  'invalid-s3-dot-segment-path.json': {
    schemaId: RETENTION_DEF_ID,
    keyword: 'pattern',
    instancePath: '/object_key',
  },
  'invalid-s3-unsupported-error-code.json': {
    schemaId: PROFILE_DEF_ID,
    keyword: 'enum',
    instancePath: '/required_error_codes/11',
  },
  'invalid-s3-missing-mandatory-op.json': {
    schemaId: PROFILE_DEF_ID,
    keyword: 'minItems',
    instancePath: '/required_operations',
  },
};

const EXPECTED_STORAGE_DISPATCH_NEGATIVES = {
  'invalid-s3-dispatch-mismatched-content-md5.json': {
    http_status: 400,
    error_code: 'BadDigest',
    error_condition: 'PAYLOAD_DIGEST_MISMATCH',
  },
  'invalid-s3-dispatch-malformed-content-md5-header.json': {
    http_status: 400,
    error_code: 'InvalidDigest',
    error_condition: 'MALFORMED_HEADER_SYNTAX',
  },
};

test('validate negative storage fixtures (single-defect isolation and dispatch error mapping)', () => {
  const negativeFiles = readdirSync(join(EXAMPLES_STORAGE_DIR, 'negative')).filter((f) =>
    f.endsWith('.json')
  );
  const expectedTotal =
    Object.keys(EXPECTED_STORAGE_NEGATIVES).length +
    Object.keys(EXPECTED_STORAGE_DISPATCH_NEGATIVES).length;
  assert.equal(
    negativeFiles.length,
    expectedTotal,
    `Must have exactly ${expectedTotal} negative fixtures in contracts/examples/storage/negative`
  );

  for (const file of negativeFiles) {
    const filePath = join(EXAMPLES_STORAGE_DIR, 'negative', file);
    assert.ok(existsSync(filePath), `Missing negative fixture: ${filePath}`);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

    if (EXPECTED_STORAGE_DISPATCH_NEGATIVES[file]) {
      const exp = EXPECTED_STORAGE_DISPATCH_NEGATIVES[file];
      assert.equal(data.http_status, exp.http_status, `Status mismatch for ${file}`);
      assert.equal(data.error_code, exp.error_code, `Error code mismatch for ${file}`);
      assert.equal(data.error_condition, exp.error_condition, `Condition mismatch for ${file}`);
      assert.ok(data.expected_error, `Negative dispatch fixture ${file} must declare expected_error`);
      assert.equal(data.expected_error.error_code, exp.error_code, `expected_error.error_code mismatch for ${file}`);
      assert.equal(data.expected_error.error_condition, exp.error_condition, `expected_error.error_condition mismatch for ${file}`);
      continue;
    }

    const expected = EXPECTED_STORAGE_NEGATIVES[file];
    assert.ok(expected, `No expected defect mapping for negative fixture ${file}`);

    const valid = ajv.validate(expected.schemaId, data);
    assert.ok(!valid, `Negative fixture ${file} unexpectedly passed validation`);

    const filteredErrors = ajv.errors.filter((e) => e.keyword !== 'if');
    assert.equal(
      filteredErrors.length,
      1,
      `Expected exactly 1 isolated defect for ${file}, found ${filteredErrors.length}: ${JSON.stringify(filteredErrors)}`
    );

    const error = filteredErrors[0];
    assert.equal(error.keyword, expected.keyword, `Mismatch keyword for ${file}`);
    assert.equal(error.instancePath, expected.instancePath, `Mismatch instancePath for ${file}`);

    if (expected.missingProperty) {
      assert.equal(
        error.params.missingProperty,
        expected.missingProperty,
        `Mismatch missingProperty for ${file}`
      );
    }
  }
});

test('Platform Contract Slot 5: 15-op baseline (including PutBucketVersioning, GetBucketVersioning) and 19-op full lock closed sets', () => {
  // 1. Cardinality and uniqueness invariants
  assert.equal(BASELINE_15_S3_OPERATIONS.length, 15, 'Baseline set must contain exactly 15 operations');
  assert.equal(new Set(BASELINE_15_S3_OPERATIONS).size, 15, 'Baseline operations must be distinct');
  assert.equal(OBJECT_LOCK_4_S3_OPERATIONS.length, 4, 'Object Lock set must contain exactly 4 operations');
  assert.equal(new Set(OBJECT_LOCK_4_S3_OPERATIONS).size, 4, 'Object Lock operations must be distinct');
  assert.equal(CLOSED_19_S3_OPERATIONS.length, 19, 'Full lock set must contain exactly 19 operations');
  assert.equal(new Set(CLOSED_19_S3_OPERATIONS).size, 19, 'Full lock operations must be distinct');

  // 2. 15-op baseline includes PutBucketVersioning and GetBucketVersioning
  assert.ok(BASELINE_15_S3_OPERATIONS.includes('PutBucketVersioning'), '15-op baseline must include PutBucketVersioning');
  assert.ok(BASELINE_15_S3_OPERATIONS.includes('GetBucketVersioning'), '15-op baseline must include GetBucketVersioning');

  // 3. 15-op baseline includes 8 CRUD operations and 5 Multipart operations
  const CRUD_8 = ['PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects', 'ListObjectsV2', 'HeadBucket', 'CreateBucket'];
  const MULTIPART_5 = ['CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload', 'AbortMultipartUpload', 'ListParts'];
  const VERSIONING_2 = ['PutBucketVersioning', 'GetBucketVersioning'];

  for (const op of [...CRUD_8, ...MULTIPART_5, ...VERSIONING_2]) {
    assert.ok(BASELINE_15_S3_OPERATIONS.includes(op), `15-op baseline must contain '${op}'`);
  }

  // 4. 19-op full lock closed set contains 15 baseline + 4 Object Lock operations
  for (const op of BASELINE_15_S3_OPERATIONS) {
    assert.ok(CLOSED_19_S3_OPERATIONS.includes(op), `19-op full lock set must contain baseline op '${op}'`);
  }
  for (const op of OBJECT_LOCK_4_S3_OPERATIONS) {
    assert.ok(CLOSED_19_S3_OPERATIONS.includes(op), `19-op full lock set must contain lock op '${op}'`);
    assert.ok(!BASELINE_15_S3_OPERATIONS.includes(op), `15-op baseline must not contain lock op '${op}'`);
  }

  // 5. Excluded non-S3 operations rejected from both 15-op and 19-op closed sets
  const baselineSet = new Set(BASELINE_15_S3_OPERATIONS);
  const fullLockSet = new Set(CLOSED_19_S3_OPERATIONS);
  const excludedOps = ['DeleteBucket', 'ListBuckets', 'RestoreObjectTier', 'PutObjectAclUnsupported', 'SelectObjectContent'];
  for (const excl of excludedOps) {
    assert.ok(!baselineSet.has(excl), `15-op baseline must reject '${excl}'`);
    assert.ok(!fullLockSet.has(excl), `19-op full lock set must reject '${excl}'`);
  }
});

test('cover all 19 S3 operations in closed operations catalog', () => {
  const validateOp = ajv.getSchema(S3_OP_DEF_ID);
  assert.ok(validateOp, `Missing schema for ${S3_OP_DEF_ID}`);

  for (const op of CLOSED_19_S3_OPERATIONS) {
    assert.ok(validateOp(op), `Operation '${op}' must be valid in s3Operation definition`);
  }

  // Non-S3 operations or excluded operations must fail
  assert.ok(!validateOp('PutObjectAclUnsupported'));
  assert.equal(validateOp.errors.length, 1);
  assert.ok(!validateOp('RestoreObjectTier'));
  assert.equal(validateOp.errors.length, 1);
  assert.ok(!validateOp('ListBuckets'));
  assert.equal(validateOp.errors.length, 1);
  assert.ok(!validateOp('DeleteBucket'));
  assert.equal(validateOp.errors.length, 1);
  assert.ok(!validateOp('SelectObjectContent'));
  assert.equal(validateOp.errors.length, 1);
});

test('cover all 13 S3 error codes in conformance profile error code enum (Finding R15-01 / OPEN-2)', () => {
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  for (const errCode of CLOSED_13_S3_ERROR_CODES) {
    const mutated = {
      ...baseProfile,
      required_error_codes: [errCode, ...CLOSED_13_S3_ERROR_CODES.filter((c) => c !== errCode)],
    };
    assert.ok(ajv.validate(PROFILE_DEF_ID, mutated), `Error code '${errCode}' must be valid`);
  }

  const badErrorCodeProfile = {
    ...baseProfile,
    required_error_codes: ['NonExistentErrorCode', ...CLOSED_13_S3_ERROR_CODES.slice(1)],
  };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, badErrorCodeProfile));
  assert.equal(ajv.errors.length, 1);
  assert.equal(ajv.errors[0].keyword, 'enum');
  assert.equal(ajv.errors[0].instancePath, '/required_error_codes/0');
});

test('object lock retention modes coverage (COMPLIANCE, GOVERNANCE)', () => {
  const validateMode = ajv.getSchema(RETENTION_MODE_DEF_ID);
  assert.ok(validateMode, `Missing schema for ${RETENTION_MODE_DEF_ID}`);

  assert.ok(validateMode('COMPLIANCE'), 'COMPLIANCE must be valid');
  assert.ok(validateMode('GOVERNANCE'), 'GOVERNANCE must be valid');

  const invalidModes = ['STANDARD', 'BYPASS_GOVERNANCE', 'compliance', 'governance', 'NONE'];
  for (const m of invalidModes) {
    assert.ok(!validateMode(m), `Mode '${m}' must be rejected`);
    assert.equal(validateMode.errors.length, 1, `Expected exactly 1 error for invalid mode '${m}'`);
  }
});

test('legal hold status coverage (ON, OFF)', () => {
  const validateHold = ajv.getSchema(LEGAL_HOLD_DEF_ID);
  assert.ok(validateHold, `Missing schema for ${LEGAL_HOLD_DEF_ID}`);

  assert.ok(validateHold('ON'), 'ON must be valid');
  assert.ok(validateHold('OFF'), 'OFF must be valid');

  const invalidStatuses = ['ENABLED', 'DISABLED', 'on', 'off', 'TRUE', 'FALSE', 'PENDING'];
  for (const s of invalidStatuses) {
    assert.ok(!validateHold(s), `Status '${s}' must be rejected`);
    assert.equal(validateHold.errors.length, 1, `Expected exactly 1 error for invalid status '${s}'`);
  }
});

test('path formatting and bucket naming rules', () => {
  const validateBucket = ajv.getSchema(BUCKET_NAME_DEF_ID);
  assert.ok(validateBucket, `Missing schema for ${BUCKET_NAME_DEF_ID}`);

  const validBuckets = [
    'my-bucket',
    'cybrik-audit-vault',
    'telemetry.archive-2026',
    'abc',
    'a'.repeat(63),
  ];
  for (const b of validBuckets) {
    assert.ok(validateBucket(b), `Bucket '${b}' must be valid`);
  }

  const invalidBuckets = [
    'MyBucket', // uppercase
    'ab', // too short (<3)
    'a'.repeat(64), // too long (>63)
    '-bucket', // leading dash
    'bucket-', // trailing dash
    '.bucket', // leading dot
    'bucket.', // trailing dot
    'bucket with space',
    'bucket/nested',
  ];
  for (const b of invalidBuckets) {
    assert.ok(!validateBucket(b), `Bucket '${b}' must be rejected`);
    assert.equal(validateBucket.errors.length, 1, `Expected 1 error for invalid bucket '${b}'`);
  }
});

test('object key normalization and path formatting with strict dot-segment rejection', () => {
  const validateKey = ajv.getSchema(OBJECT_KEY_DEF_ID);
  assert.ok(validateKey, `Missing schema for ${OBJECT_KEY_DEF_ID}`);

  const validKeys = [
    'evidence.tar.gz',
    'forensics/2026/08/incident-1042-evidence.bundle',
    'a/b/c/d/file.json',
    'raw-pcaps/2026/08/27/traffic.pcap.zst',
  ];
  for (const k of validKeys) {
    assert.ok(validateKey(k), `Object key '${k}' must be valid`);
  }

  const invalidKeys = [
    '/leading/slash/key', // leading slash forbidden
    'adjacent//slashes', // double slash forbidden
    '', // empty forbidden
    './leading-dot-slash/key', // leading ./ forbidden
    '../dot-dot/key', // leading .. forbidden
    'key/../dot-dot', // interior .. forbidden
    'key/./dot-slash', // interior /. forbidden
    'key/trailing-slash/', // trailing slash forbidden
    'key/.hidden', // interior /. forbidden
  ];
  for (const k of invalidKeys) {
    assert.ok(!validateKey(k), `Object key '${k}' must be rejected`);
    assert.equal(validateKey.errors.length, 1, `Expected 1 error for invalid key '${k}'`);
  }
});

test('s3 URI and path-style URL formatting', () => {
  const validateUri = ajv.getSchema(S3_URI_DEF_ID);
  const validateUrl = ajv.getSchema(PATH_STYLE_URL_DEF_ID);

  assert.ok(validateUri('s3://cybrik-audit/evidence/bundle.tar.gz'));
  assert.ok(!validateUri('http://cybrik-audit/evidence/bundle.tar.gz'));
  assert.ok(!validateUri('s3:///evidence/bundle.tar.gz'));

  assert.ok(validateUrl('https://storage.internal.cybrik:9000/cybrik-audit/evidence/bundle.tar.gz'));
  assert.ok(validateUrl('http://127.0.0.1:9000/bucket/key'));
  assert.ok(!validateUrl('https://storage.internal.cybrik//key'));
});

test('mandatory addressing style and auth mechanism constants', () => {
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  // Addressing style must be path_style
  const badAddressing = { ...baseProfile, addressing_style: 'virtual_host' };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, badAddressing));
  assert.equal(ajv.errors.length, 1);
  assert.equal(ajv.errors[0].keyword, 'const');

  // Auth mechanism must be AWS4-HMAC-SHA256
  const badAuth = { ...baseProfile, auth_mechanism: 'Bearer' };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, badAuth));
  assert.equal(ajv.errors.length, 1);
  assert.equal(ajv.errors[0].keyword, 'const');
});

test('mandatory operations boolean flags must all be true', () => {
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  for (const flag of [
    'crud',
    'multipart_upload',
    'presigning',
    'sig_v4',
    'path_style_access',
    'versioning',
    'error_mappings',
  ]) {
    const mutated = {
      ...baseProfile,
      mandatory_operations: {
        ...baseProfile.mandatory_operations,
        [flag]: false,
      },
    };
    assert.ok(!ajv.validate(PROFILE_DEF_ID, mutated), `Flag '${flag}: false' must be rejected`);
    assert.equal(ajv.errors.length, 1, `Expected 1 error when '${flag}' is false`);
    assert.equal(ajv.errors[0].keyword, 'const');
  }
});

test('mandate root and profile WORM support (object_lock, retention_modes, legal_hold)', () => {
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  // Root and Profile: object_lock_supported must be const true
  assert.ok(ajv.validate(PROFILE_DEF_ID, baseProfile));
  assert.ok(ajv.validate(S3_SCHEMA_ID, baseProfile));

  const badObjectLock = { ...baseProfile, object_lock_supported: false, required_operations: baseProfile.required_operations.slice(0, 15) };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, badObjectLock));
  assert.ok(ajv.errors.some(e => e.keyword === 'const' && e.instancePath === '/object_lock_supported'));

  const missingObjectLock = { ...baseProfile };
  delete missingObjectLock.object_lock_supported;
  assert.ok(!ajv.validate(PROFILE_DEF_ID, missingObjectLock));
  assert.equal(ajv.errors[0].keyword, 'required');
  assert.equal(ajv.errors[0].params.missingProperty, 'object_lock_supported');

  // retention_modes_supported must contain at least 2 items (COMPLIANCE and GOVERNANCE)
  const singleMode = { ...baseProfile, retention_modes_supported: ['COMPLIANCE'] };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, singleMode));
  assert.equal(ajv.errors[0].keyword, 'minItems');

  const invalidMode = { ...baseProfile, retention_modes_supported: ['COMPLIANCE', 'INVALID_MODE'] };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, invalidMode));
  assert.equal(ajv.errors[0].keyword, 'enum');

  const dupMode = { ...baseProfile, retention_modes_supported: ['COMPLIANCE', 'COMPLIANCE'] };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, dupMode));
  assert.equal(ajv.errors[0].keyword, 'uniqueItems');

  // legal_hold_supported must be const true
  const badLegalHold = { ...baseProfile, legal_hold_supported: false };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, badLegalHold));
  assert.equal(ajv.errors[0].keyword, 'const');

  const missingLegalHold = { ...baseProfile };
  delete missingLegalHold.legal_hold_supported;
  assert.ok(!ajv.validate(PROFILE_DEF_ID, missingLegalHold));
  assert.equal(ajv.errors[0].keyword, 'required');
  assert.equal(ajv.errors[0].params.missingProperty, 'legal_hold_supported');
});

test('require version_id on objectRetentionCompliance and storageConformanceEvidence', () => {
  const EVIDENCE_DEF_ID = `${S3_SCHEMA_ID}#/$defs/storageConformanceEvidence`;
  const sampleRetentionPath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-object-retention-compliance.json');
  const baseRetention = JSON.parse(readFileSync(sampleRetentionPath, 'utf8'));

  // Valid record passes on both defs
  assert.ok(ajv.validate(RETENTION_DEF_ID, baseRetention));
  assert.ok(ajv.validate(EVIDENCE_DEF_ID, baseRetention));

  // Missing version_id must fail
  const missingVersion = { ...baseRetention };
  delete missingVersion.version_id;
  assert.ok(!ajv.validate(RETENTION_DEF_ID, missingVersion));
  assert.equal(ajv.errors.length, 1);
  assert.equal(ajv.errors[0].keyword, 'required');
  assert.equal(ajv.errors[0].params.missingProperty, 'version_id');

  assert.ok(!ajv.validate(EVIDENCE_DEF_ID, missingVersion));
  assert.equal(ajv.errors.length, 1);
  assert.equal(ajv.errors[0].keyword, 'required');
  assert.equal(ajv.errors[0].params.missingProperty, 'version_id');

  // version_id pattern assertions: ^[a-zA-Z0-9._-]+$
  const validVersionIds = [
    'v1.0.0-snapshot-20260827',
    'v1',
    'version_123',
    'abc.def-ghi_123',
    '3',
  ];
  for (const vid of validVersionIds) {
    const mutated = { ...baseRetention, version_id: vid };
    assert.ok(ajv.validate(RETENTION_DEF_ID, mutated), `version_id '${vid}' must be valid`);
  }

  const invalidVersionIds = [
    '', // empty (fails minLength and pattern)
    'version with spaces',
    'v1@latest',
    'v1#hash',
    'v1$lock',
    'v1/segment',
  ];
  for (const vid of invalidVersionIds) {
    const mutated = { ...baseRetention, version_id: vid };
    assert.ok(!ajv.validate(RETENTION_DEF_ID, mutated), `version_id '${vid}' must be rejected`);
    assert.ok(ajv.errors.some((e) => e.instancePath === '/version_id'));
  }
});

test('executable BadDigest and InvalidDigest dispatch verification and in-memory negative assertions (Finding 5 / INV-S3-05)', () => {
  // 1. Verify mismatched Content-MD5 fixture
  const mismatchedFixturePath = join(
    EXAMPLES_STORAGE_DIR,
    'negative',
    'invalid-s3-dispatch-mismatched-content-md5.json'
  );
  assert.ok(existsSync(mismatchedFixturePath), `Missing fixture: ${mismatchedFixturePath}`);
  const mismatchedFixture = JSON.parse(readFileSync(mismatchedFixturePath, 'utf8'));

  assert.equal(mismatchedFixture.http_status, 400);
  assert.equal(mismatchedFixture.error_code, 'BadDigest');
  assert.deepEqual(mismatchedFixture.forbidden_error_codes, ['InvalidArgument', 'AccessDenied']);

  const badDigestDispatch = verifyDigestErrorDispatch(mismatchedFixture);
  assert.equal(badDigestDispatch.status, 400);
  assert.equal(badDigestDispatch.code, 'BadDigest');
  assert.equal(badDigestDispatch.http_status, 400);
  assert.equal(badDigestDispatch.error_code, 'BadDigest');

  // Also verify string/error-condition argument form
  const badDigestDirect = verifyDigestErrorDispatch('PAYLOAD_DIGEST_MISMATCH');
  assert.equal(badDigestDirect.status, 400);
  assert.equal(badDigestDirect.code, 'BadDigest');

  // 2. Verify malformed Content-MD5 header fixture
  const malformedFixturePath = join(
    EXAMPLES_STORAGE_DIR,
    'negative',
    'invalid-s3-dispatch-malformed-content-md5-header.json'
  );
  assert.ok(existsSync(malformedFixturePath), `Missing fixture: ${malformedFixturePath}`);
  const malformedFixture = JSON.parse(readFileSync(malformedFixturePath, 'utf8'));

  assert.equal(malformedFixture.http_status, 400);
  assert.equal(malformedFixture.error_code, 'InvalidDigest');
  assert.deepEqual(malformedFixture.forbidden_error_codes, ['InvalidArgument', 'AccessDenied']);

  const malformedHeader =
    malformedFixture.headers?.['Content-MD5'] ?? malformedFixture.content_md5_header;
  const invalidDigestDispatch = verifyMalformedHeaderDispatch(malformedHeader);
  assert.equal(invalidDigestDispatch.status, 400);
  assert.equal(invalidDigestDispatch.code, 'InvalidDigest');
  assert.equal(invalidDigestDispatch.http_status, 400);
  assert.equal(invalidDigestDispatch.error_code, 'InvalidDigest');

  // Also verify object condition form
  const invalidDigestObj = verifyMalformedHeaderDispatch(malformedFixture);
  assert.equal(invalidDigestObj.status, 400);
  assert.equal(invalidDigestObj.code, 'InvalidDigest');

  // 3. In-memory negative assertions: returning InvalidArgument or AccessDenied throws validation failure
  assert.throws(
    () => verifyDigestErrorDispatch({ status: 400, code: 'InvalidArgument' }),
    /Strict error dispatch violation.*InvalidArgument/
  );
  assert.throws(
    () => verifyDigestErrorDispatch({ status: 403, code: 'AccessDenied' }),
    /Strict error dispatch violation.*AccessDenied/
  );
  assert.throws(
    () => verifyDigestErrorDispatch({ http_status: 400, error_code: 'InvalidArgument' }),
    /Strict error dispatch violation.*InvalidArgument/
  );
  assert.throws(
    () => verifyDigestErrorDispatch({ http_status: 403, error_code: 'AccessDenied' }),
    /Strict error dispatch violation.*AccessDenied/
  );
  assert.throws(
    () => verifyDigestErrorDispatch({ status: 500, code: 'BadDigest' }),
    /Strict error dispatch violation/
  );

  assert.throws(
    () => verifyMalformedHeaderDispatch({ header: 'malformed-hdr!@#', status: 400, code: 'InvalidArgument' }),
    /Strict error dispatch violation.*InvalidArgument/
  );
  assert.throws(
    () => verifyMalformedHeaderDispatch({ header: 'malformed-hdr!@#', status: 403, code: 'AccessDenied' }),
    /Strict error dispatch violation.*AccessDenied/
  );
  assert.throws(
    () => verifyMalformedHeaderDispatch({ content_md5_header: 'malformed-hdr!@#', http_status: 400, error_code: 'InvalidArgument' }),
    /Strict error dispatch violation.*InvalidArgument/
  );
  assert.throws(
    () => verifyMalformedHeaderDispatch({ content_md5_header: 'malformed-hdr!@#', http_status: 403, error_code: 'AccessDenied' }),
    /Strict error dispatch violation.*AccessDenied/
  );
  assert.throws(
    () => verifyMalformedHeaderDispatch({ header: 'malformed-hdr!@#', status: 500, code: 'InvalidDigest' }),
    /Strict error dispatch violation/
  );
});

test('non-tautological cryptographic S3 digest dispatch verification (OPEN-2 Finding 3)', () => {
  // Real payload byte buffers
  const payloadA = Buffer.from('CYBRIK_IMMUTABLE_EVIDENCE_PAYLOAD_2026_ALPHA');
  const payloadB = Buffer.from('CYBRIK_IMMUTABLE_EVIDENCE_PAYLOAD_2026_BETA');
  const emptyPayload = Buffer.alloc(0);
  const binaryPayload = Buffer.from([0x00, 0xff, 0x42, 0x13, 0x37, 0xca, 0xfe, 0xba, 0xbe]);

  const digestA = computePayloadMd5(payloadA);
  const digestB = computePayloadMd5(payloadB);
  const digestEmpty = computePayloadMd5(emptyPayload);
  const digestBinary = computePayloadMd5(binaryPayload);

  // 1. Positive matches: valid payload bytes + matching Content-MD5 header
  const matchA = dispatchS3PutObject({ payloadBytes: payloadA, contentMd5Header: digestA, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(matchA.http_status, 200);
  assert.equal(matchA.error_code, null);

  const matchAErr = dispatchS3Error({ payloadBytes: payloadA, contentMd5Header: digestA, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(matchAErr.http_status, 200);
  assert.equal(matchAErr.error_code, null);

  const matchB = dispatchS3PutObject({ payloadBytes: payloadB, contentMd5Header: digestB, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(matchB.http_status, 200);
  assert.equal(matchB.error_code, null);

  const matchEmpty = dispatchS3PutObject({ payloadBytes: emptyPayload, contentMd5Header: digestEmpty, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(matchEmpty.http_status, 200);
  assert.equal(matchEmpty.error_code, null);

  const matchBinary = dispatchS3PutObject({ payloadBytes: binaryPayload, contentMd5Header: digestBinary, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(matchBinary.http_status, 200);
  assert.equal(matchBinary.error_code, null);

  // 2. Real byte mismatch: ALWAYS returns BadDigest (HTTP 400), strictly never InvalidArgument or AccessDenied
  const mismatch1 = dispatchS3PutObject({ payloadBytes: payloadA, contentMd5Header: digestB, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(mismatch1.http_status, 400);
  assert.equal(mismatch1.error_code, 'BadDigest');
  assert.equal(mismatch1.reason, 'PAYLOAD_DIGEST_MISMATCH');
  assert.notEqual(mismatch1.error_code, 'InvalidArgument');
  assert.notEqual(mismatch1.error_code, 'AccessDenied');

  const mismatch1Err = dispatchS3Error({ payloadBytes: payloadA, contentMd5Header: digestB, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(mismatch1Err.http_status, 400);
  assert.equal(mismatch1Err.error_code, 'BadDigest');
  assert.equal(mismatch1Err.reason, 'PAYLOAD_DIGEST_MISMATCH');

  const mismatch2 = dispatchS3PutObject({ payloadBytes: payloadB, contentMd5Header: digestA, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(mismatch2.http_status, 400);
  assert.equal(mismatch2.error_code, 'BadDigest');
  assert.equal(mismatch2.reason, 'PAYLOAD_DIGEST_MISMATCH');
  assert.notEqual(mismatch2.error_code, 'InvalidArgument');
  assert.notEqual(mismatch2.error_code, 'AccessDenied');

  // End-to-end verification via verifyDigestErrorDispatch
  const verifiedMismatch = verifyDigestErrorDispatch(payloadA, digestB);
  assert.equal(verifiedMismatch.http_status, 400);
  assert.equal(verifiedMismatch.error_code, 'BadDigest');
  assert.equal(verifiedMismatch.reason, 'PAYLOAD_DIGEST_MISMATCH');

  const verifiedMismatchObj = verifyDigestErrorDispatch({ payloadBytes: payloadA, contentMd5Header: digestB });
  assert.equal(verifiedMismatchObj.http_status, 400);
  assert.equal(verifiedMismatchObj.error_code, 'BadDigest');
  assert.equal(verifiedMismatchObj.reason, 'PAYLOAD_DIGEST_MISMATCH');

  // 3. Malformed base64 header: ALWAYS returns InvalidDigest (HTTP 400), strictly never InvalidArgument or AccessDenied
  const malformedHeaders = [
    'invalid-base64-header-!@#$%',
    'short',
    'not-16-bytes-base64==',
    'AAAA==',
    '1B2M2Y8AsgTpgAmY7PhCfgAA==',
    '',
    '   ',
    null,
    undefined,
    12345,
    {},
    [],
  ];

  for (const badHdr of malformedHeaders) {
    const malformedRes = dispatchS3PutObject({ payloadBytes: payloadA, contentMd5Header: badHdr, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
    assert.equal(malformedRes.http_status, 400, `Malformed header ${badHdr} must return HTTP 400`);
    assert.equal(malformedRes.error_code, 'InvalidDigest', `Malformed header ${badHdr} must return InvalidDigest`);
    assert.equal(malformedRes.reason, 'MALFORMED_HEADER_SYNTAX');
    assert.notEqual(malformedRes.error_code, 'InvalidArgument');
    assert.notEqual(malformedRes.error_code, 'AccessDenied');

    const verifiedMalformed = verifyMalformedHeaderDispatch(payloadA, badHdr);
    assert.equal(verifiedMalformed.http_status, 400);
    assert.equal(verifiedMalformed.error_code, 'InvalidDigest');
    assert.equal(verifiedMalformed.reason, 'MALFORMED_HEADER_SYNTAX');
  }

  // 4. Unit tests: an engine returning 400 InvalidArgument or 403 AccessDenied for a digest error throws a validation failure
  const mockEngineReturningInvalidArgument = (_payload, _header) => ({
    http_status: 400,
    error_code: 'InvalidArgument',
  });

  const mockEngineReturningAccessDenied = (_payload, _header) => ({
    http_status: 403,
    error_code: 'AccessDenied',
  });

  assert.throws(
    () => verifyDigestErrorDispatch(mockEngineReturningInvalidArgument(payloadA, digestB)),
    /Strict error dispatch violation.*InvalidArgument/
  );
  assert.throws(
    () => verifyDigestErrorDispatch(mockEngineReturningAccessDenied(payloadA, digestB)),
    /Strict error dispatch violation.*AccessDenied/
  );
  assert.throws(
    () => verifyMalformedHeaderDispatch(mockEngineReturningInvalidArgument(payloadA, 'bad-hdr!@#')),
    /Strict error dispatch violation.*InvalidArgument/
  );
  assert.throws(
    () => verifyMalformedHeaderDispatch(mockEngineReturningAccessDenied(payloadA, 'bad-hdr!@#')),
    /Strict error dispatch violation.*AccessDenied/
  );
});

test('S3 multipart upload manifest fixtures strict part ordering and size closure verification (Finding R13-02 / OPEN-2)', () => {
  const multipartFiles = [
    join(EXAMPLES_STORAGE_DIR, 'positive', 's3-multipart-upload-manifest.json'),
    join(EXAMPLES_STORAGE_DIR, 'negative', 'invalid-s3-malformed-digest.json'),
  ];

  for (const filePath of multipartFiles) {
    assert.ok(existsSync(filePath), `Multipart fixture missing: ${filePath}`);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

    // 1. Array of parts must exist
    assert.ok(Array.isArray(data.parts), `Fixture ${filePath} must have parts array`);
    assert.ok(data.parts.length > 0, `Fixture ${filePath} parts array must not be empty`);

    // 2. part_numbers must be unique and strictly ascending (1 <= p_1 < p_2 < ... < p_n)
    const partNumbers = data.parts.map((p) => p.part_number);
    const uniquePartNumbers = new Set(partNumbers);
    assert.equal(
      uniquePartNumbers.size,
      partNumbers.length,
      `Fixture ${filePath} must have unique part_numbers: ${JSON.stringify(partNumbers)}`
    );

    for (let i = 0; i < partNumbers.length; i++) {
      assert.ok(
        Number.isInteger(partNumbers[i]) && partNumbers[i] >= 1,
        `Part number at index ${i} must be positive integer`
      );
      if (i > 0) {
        assert.ok(
          partNumbers[i] > partNumbers[i - 1],
          `Part numbers must be strictly ascending: ${partNumbers[i - 1]} < ${partNumbers[i]}`
        );
      }
    }

    // 3. total_parts === parts.length
    assert.equal(
      data.total_parts,
      data.parts.length,
      `Fixture ${filePath}: total_parts (${data.total_parts}) must equal parts.length (${data.parts.length})`
    );

    // 4. total_size_bytes === sum(part.size_bytes)
    const sumSizeBytes = data.parts.reduce((acc, p) => acc + p.size_bytes, 0);
    assert.equal(
      data.total_size_bytes,
      sumSizeBytes,
      `Fixture ${filePath}: total_size_bytes (${data.total_size_bytes}) must equal sum(part.size_bytes) (${sumSizeBytes})`
    );
  }
});

test('validateS3MultipartSemantics comprehensive validation (Finding R13-02 / OPEN-2)', () => {
  const samplePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-multipart-upload-manifest.json');
  assert.ok(existsSync(samplePath), `Missing sample multipart manifest: ${samplePath}`);
  const validManifest = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. Positive: valid multipart manifest passes schema and semantic validation
  assert.ok(ajv.validate(MULTIPART_DEF_ID, validManifest), 'Sample multipart manifest must pass Ajv validation');
  assert.doesNotThrow(
    () => validateS3MultipartSemantics(validManifest),
    'Valid multipart manifest must pass validateS3MultipartSemantics'
  );

  // 2. Negative: duplicate part numbers (same ETag) rejected by schema and semantic validation with InvalidPartOrder (Finding R17-01 / OPEN-2)
  const dupPartSameEtag = JSON.parse(JSON.stringify(validManifest));
  dupPartSameEtag.parts.push({
    part_number: 2,
    etag: "\"c8f9e2b1d0a3c4e5f6a7b8c9d0e1f2a3\"",
    sha256: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    size_bytes: 5242880,
  });
  dupPartSameEtag.total_parts = 4;
  dupPartSameEtag.total_size_bytes = 20971520;

  // Schema validation rejects duplicate part entries (uniqueItems constraint)
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, dupPartSameEtag), 'Duplicate part with same ETag must fail Ajv validation');
  // Semantic validation rejects with InvalidPartOrder
  assert.throws(
    () => validateS3MultipartSemantics(dupPartSameEtag),
    /strictly ascending order by part_number with no duplicates.*\(InvalidPartOrder\)/,
    'Duplicate part_number with same ETag must throw InvalidPartOrder'
  );
  assert.throws(
    () => validatePlatformSemantics(dupPartSameEtag, MULTIPART_DEF_ID),
    /InvalidPartOrder/,
    'Duplicate part_number with same ETag must fail validatePlatformSemantics with /InvalidPartOrder/'
  );
  // Error dispatch mapping for same-ETag duplicate part
  const dispatchDupSame = dispatchS3Error('InvalidPartOrder');
  assert.equal(dispatchDupSame.http_status, 400);
  assert.equal(dispatchDupSame.error_code, 'InvalidPartOrder');
  const dispatchDupSameCondition = dispatchS3Error('DUPLICATE_PART_NUMBER');
  assert.equal(dispatchDupSameCondition.http_status, 400);
  assert.equal(dispatchDupSameCondition.error_code, 'InvalidPartOrder');
  const dispatchDupSameObj = dispatchS3Error({ error_code: 'InvalidPartOrder' });
  assert.equal(dispatchDupSameObj.http_status, 400);
  assert.equal(dispatchDupSameObj.error_code, 'InvalidPartOrder');

  // 2b. Negative: duplicate part numbers (different ETags) rejected with InvalidPartOrder (Finding R17-01 / OPEN-2)
  const dupPartDiffEtag = JSON.parse(JSON.stringify(validManifest));
  dupPartDiffEtag.parts.push({
    part_number: 1,
    etag: "\"ffffffffffffffffffffffffffffffff\"",
    sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    size_bytes: 5242880,
  });
  dupPartDiffEtag.total_parts = 4;
  dupPartDiffEtag.total_size_bytes = 20971520;

  // Semantic validation rejects with InvalidPartOrder
  assert.throws(
    () => validateS3MultipartSemantics(dupPartDiffEtag),
    /strictly ascending order by part_number with no duplicates.*\(InvalidPartOrder\)/,
    'Duplicate part_number with different ETag must throw InvalidPartOrder'
  );
  assert.throws(
    () => validatePlatformSemantics(dupPartDiffEtag, MULTIPART_DEF_ID),
    /InvalidPartOrder/,
    'Duplicate part_number with different ETag must fail validatePlatformSemantics with /InvalidPartOrder/'
  );
  // Error dispatch mapping for different-ETag duplicate part
  const dispatchDupDiff = dispatchS3Error('InvalidPartOrder');
  assert.equal(dispatchDupDiff.http_status, 400);
  assert.equal(dispatchDupDiff.error_code, 'InvalidPartOrder');
  const dispatchDupDiffCondition = dispatchS3Error({ error_condition: 'DUPLICATE_PART' });
  assert.equal(dispatchDupDiffCondition.http_status, 400);
  assert.equal(dispatchDupDiffCondition.error_code, 'InvalidPartOrder');
  const dispatchDupDiffReason = dispatchS3Error({ reason: 'INVALID_PART_ORDER' });
  assert.equal(dispatchDupDiffReason.http_status, 400);
  assert.equal(dispatchDupDiffReason.error_code, 'InvalidPartOrder');

  // 3. Negative: descending part numbers throws InvalidPartOrder
  const descendingParts = JSON.parse(JSON.stringify(validManifest));
  descendingParts.parts = [
    validManifest.parts[2], // part 3
    validManifest.parts[1], // part 2
    validManifest.parts[0], // part 1
  ];
  assert.throws(
    () => validateS3MultipartSemantics(descendingParts),
    /strictly ascending order by part_number with no duplicates.*\(InvalidPartOrder\)/,
    'Descending part numbers must throw InvalidPartOrder'
  );

  // 3b. Negative: unordered / out-of-order part numbers throws InvalidPartOrder
  const unorderedParts = JSON.parse(JSON.stringify(validManifest));
  unorderedParts.parts = [
    validManifest.parts[0], // part 1
    validManifest.parts[2], // part 3
    validManifest.parts[1], // part 2
  ];
  assert.throws(
    () => validateS3MultipartSemantics(unorderedParts),
    /strictly ascending order by part_number with no duplicates.*\(InvalidPartOrder\)/,
    'Unordered part numbers must throw InvalidPartOrder'
  );

  // 4. Negative: empty or missing parts array
  const emptyPartsManifest = JSON.parse(JSON.stringify(validManifest));
  emptyPartsManifest.parts = [];
  assert.throws(
    () => validateS3MultipartSemantics(emptyPartsManifest),
    /Semantic error: multipart upload manifest parts array must be non-empty/
  );

  // 5. Negative: total_parts mismatch throws /total_parts .* does not match parts array length/
  const totalPartsMismatchHigh = JSON.parse(JSON.stringify(validManifest));
  totalPartsMismatchHigh.total_parts = 5; // actual is 3
  assert.throws(
    () => validateS3MultipartSemantics(totalPartsMismatchHigh),
    /total_parts .* does not match parts array length/,
    'total_parts mismatch (high) must throw /total_parts .* does not match parts array length/'
  );

  const totalPartsMismatchLow = JSON.parse(JSON.stringify(validManifest));
  totalPartsMismatchLow.total_parts = 2; // actual is 3
  assert.throws(
    () => validateS3MultipartSemantics(totalPartsMismatchLow),
    /total_parts .* does not match parts array length/,
    'total_parts mismatch (low) must throw /total_parts .* does not match parts array length/'
  );

  // 6. Negative: total_size_bytes mismatch throws /total_size_bytes .* does not match sum of part sizes/
  const totalSizeMismatchHigh = JSON.parse(JSON.stringify(validManifest));
  totalSizeMismatchHigh.total_size_bytes = 15728641; // off by 1
  assert.throws(
    () => validateS3MultipartSemantics(totalSizeMismatchHigh),
    /total_size_bytes .* does not match sum of part sizes/,
    'total_size_bytes mismatch (high) must throw /total_size_bytes .* does not match sum of part sizes/'
  );

  const totalSizeMismatchLow = JSON.parse(JSON.stringify(validManifest));
  totalSizeMismatchLow.total_size_bytes = 10485760; // actual sum is 15728640
  assert.throws(
    () => validateS3MultipartSemantics(totalSizeMismatchLow),
    /total_size_bytes .* does not match sum of part sizes/,
    'total_size_bytes mismatch (low) must throw /total_size_bytes .* does not match sum of part sizes/'
  );
});

test('S3 multipart schema integer boundaries for part numbers and sizes (Finding R14-01 / OPEN-2)', () => {
  const samplePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-multipart-upload-manifest.json');
  const baseManifest = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. part_number bounds (minimum: 1, maximum: 10000)
  const badPartNumLow = JSON.parse(JSON.stringify(baseManifest));
  badPartNumLow.parts[0].part_number = 0;
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badPartNumLow), 'part_number = 0 must be rejected');
  assert.ok(ajv.errors.some(e => e.keyword === 'minimum' && e.instancePath === '/parts/0/part_number'));

  const badPartNumHigh = JSON.parse(JSON.stringify(baseManifest));
  badPartNumHigh.parts[0].part_number = 10001;
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badPartNumHigh), 'part_number = 10001 must be rejected');
  assert.ok(ajv.errors.some(e => e.keyword === 'maximum' && e.instancePath === '/parts/0/part_number'));

  const validPartNumMax = JSON.parse(JSON.stringify(baseManifest));
  validPartNumMax.parts[0].part_number = 10000;
  validPartNumMax.parts = [validPartNumMax.parts[0]];
  validTotalPartsMax(validPartNumMax);
  assert.ok(ajv.validate(MULTIPART_DEF_ID, validPartNumMax), 'part_number = 10000 must be valid in schema');

  // 2. size_bytes bounds (minimum: 0, maximum: 5368709120)
  const badSizeLow = JSON.parse(JSON.stringify(baseManifest));
  badSizeLow.parts[0].size_bytes = -1;
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badSizeLow), 'size_bytes = -1 must be rejected');
  assert.ok(ajv.errors.some(e => e.keyword === 'minimum' && e.instancePath === '/parts/0/size_bytes'));

  const badSizeHigh = JSON.parse(JSON.stringify(baseManifest));
  badSizeHigh.parts[0].size_bytes = 5368709121;
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badSizeHigh), 'size_bytes = 5368709121 must be rejected');
  assert.ok(ajv.errors.some(e => e.keyword === 'maximum' && e.instancePath === '/parts/0/size_bytes'));

  const validSizeZero = JSON.parse(JSON.stringify(baseManifest));
  validSizeZero.parts[0].size_bytes = 0;
  assert.ok(ajv.validate(MULTIPART_DEF_ID, validSizeZero), 'size_bytes = 0 must be valid in schema');

  const validSizeMax = JSON.parse(JSON.stringify(baseManifest));
  validSizeMax.parts[0].size_bytes = 5368709120;
  assert.ok(ajv.validate(MULTIPART_DEF_ID, validSizeMax), 'size_bytes = 5368709120 must be valid in schema');

  // 3. total_parts bounds (minimum: 1, maximum: 10000)
  const badTotalPartsLow = JSON.parse(JSON.stringify(baseManifest));
  badTotalPartsLow.total_parts = 0;
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badTotalPartsLow), 'total_parts = 0 must be rejected');
  assert.ok(ajv.errors.some(e => e.keyword === 'minimum' && e.instancePath === '/total_parts'));

  const badTotalPartsHigh = JSON.parse(JSON.stringify(baseManifest));
  badTotalPartsHigh.total_parts = 10001;
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badTotalPartsHigh), 'total_parts = 10001 must be rejected');
  assert.ok(ajv.errors.some(e => e.keyword === 'maximum' && e.instancePath === '/total_parts'));

  function validTotalPartsMax(m) {
    m.total_parts = 10000;
    m.parts[0].part_number = 10000;
    m.total_size_bytes = m.parts[0].size_bytes;
  }
  const validTotalPartsMaxObj = JSON.parse(JSON.stringify(baseManifest));
  validTotalPartsMaxObj.total_parts = 10000;
  assert.ok(ajv.validate(MULTIPART_DEF_ID, validTotalPartsMaxObj), 'total_parts = 10000 must be valid in schema');

  // 4. total_size_bytes bounds (minimum: 0, maximum: 5497558138880)
  const badTotalSizeLow = JSON.parse(JSON.stringify(baseManifest));
  badTotalSizeLow.total_size_bytes = -1;
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badTotalSizeLow), 'total_size_bytes = -1 must be rejected');
  assert.ok(ajv.errors.some(e => e.keyword === 'minimum' && e.instancePath === '/total_size_bytes'));

  const badTotalSizeHigh = JSON.parse(JSON.stringify(baseManifest));
  badTotalSizeHigh.total_size_bytes = 5497558138881;
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badTotalSizeHigh), 'total_size_bytes = 5497558138881 must be rejected');
  assert.ok(ajv.errors.some(e => e.keyword === 'maximum' && e.instancePath === '/total_size_bytes'));

  const validTotalSizeZero = JSON.parse(JSON.stringify(baseManifest));
  validTotalSizeZero.total_size_bytes = 0;
  assert.ok(ajv.validate(MULTIPART_DEF_ID, validTotalSizeZero), 'total_size_bytes = 0 must be valid in schema');

  const validTotalSizeMax = JSON.parse(JSON.stringify(baseManifest));
  validTotalSizeMax.total_size_bytes = 5497558138880;
  assert.ok(ajv.validate(MULTIPART_DEF_ID, validTotalSizeMax), 'total_size_bytes = 5497558138880 must be valid in schema');
});

test('in-memory validation: S3 multipart upload manifest size thresholds and invariants (Finding R14-03 / OPEN-2)', () => {
  const samplePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-multipart-upload-manifest.json');
  const validManifest = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. Non-final part with size below 5242880 bytes (5 MiB) throws EntityTooSmall
  const smallNonFinalPart = JSON.parse(JSON.stringify(validManifest));
  smallNonFinalPart.parts[0].size_bytes = 5242879; // 1 byte below 5 MiB
  smallNonFinalPart.total_size_bytes = 5242879 + 5242880 + 5242880;
  assert.throws(
    () => validateS3MultipartSemantics(smallNonFinalPart),
    /Semantic error: multipart upload manifest part 1 size \(5242879 bytes\) is below minimum non-final part size of 5242880 bytes \(5 MiB\) \(EntityTooSmall\)/
  );

  // 2. Final part with size below 5242880 bytes (e.g. 1024 bytes, 0 bytes) is permitted
  const smallFinalPart = JSON.parse(JSON.stringify(validManifest));
  smallFinalPart.parts[2].size_bytes = 1024; // < 5 MiB is allowed on final part
  smallFinalPart.total_size_bytes = 5242880 + 5242880 + 1024;
  assert.doesNotThrow(
    () => validateS3MultipartSemantics(smallFinalPart),
    'Final part with size < 5 MiB must be permitted'
  );

  const zeroFinalPart = JSON.parse(JSON.stringify(validManifest));
  zeroFinalPart.parts[2].size_bytes = 0; // 0 bytes allowed on final part
  zeroFinalPart.total_size_bytes = 5242880 + 5242880 + 0;
  assert.doesNotThrow(
    () => validateS3MultipartSemantics(zeroFinalPart),
    'Final part with size 0 bytes must be permitted'
  );

  // 3. Negative: Part with negative size throws error
  const negativePartSize = JSON.parse(JSON.stringify(validManifest));
  negativePartSize.parts[0].size_bytes = -1;
  negativePartSize.total_size_bytes = -1 + 5242880 + 5242880;
  assert.throws(
    () => validateS3MultipartSemantics(negativePartSize),
    /Semantic error: multipart upload manifest part 1 size \(-1 bytes\) cannot be negative/
  );

  // 4. Negative: Part exceeding 5368709120 bytes (5 GiB) throws EntityTooLarge
  const oversizedPart = JSON.parse(JSON.stringify(validManifest));
  oversizedPart.parts[0].size_bytes = 5368709121; // 5 GiB + 1 byte
  oversizedPart.total_size_bytes = 5368709121 + 5242880 + 5242880;
  assert.throws(
    () => validateS3MultipartSemantics(oversizedPart),
    /Semantic error: multipart upload manifest part 1 size \(5368709121 bytes\) exceeds maximum part size of 5368709120 bytes \(5 GiB\) \(EntityTooLarge\)/
  );

  // 5. Negative: Total manifest size exceeding 5497558138880 bytes (5 TiB) throws EntityTooLarge
  const oversizedManifest = JSON.parse(JSON.stringify(validManifest));
  oversizedManifest.total_size_bytes = 5497558138881; // 5 TiB + 1 byte
  assert.throws(
    () => validateS3MultipartSemantics(oversizedManifest),
    /Semantic error: multipart upload manifest total_size_bytes/
  );
});

test('validateS3MultipartSemantics part size thresholds and non-final/final part rules (Finding R14-03 / OPEN-2)', () => {
  const samplePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-multipart-upload-manifest.json');
  assert.ok(existsSync(samplePath), `Missing sample multipart manifest: ${samplePath}`);
  const baseManifest = JSON.parse(readFileSync(samplePath, 'utf8'));

  const FIVE_MIB = 5 * 1024 * 1024; // 5,242,880 bytes
  const FIVE_GIB = 5 * 1024 * 1024 * 1024; // 5,368,709,120 bytes
  const ONE_KIB = 1024; // 1,024 bytes

  // 1. Non-final part below 5 MiB (e.g. 1 KiB) is rejected with /below minimum non-final part size|EntityTooSmall/
  const manifestNonFinalSmall = JSON.parse(JSON.stringify(baseManifest));
  manifestNonFinalSmall.parts[0].size_bytes = ONE_KIB;
  manifestNonFinalSmall.total_size_bytes = ONE_KIB + FIVE_MIB + FIVE_MIB;
  assert.throws(
    () => validateS3MultipartSemantics(manifestNonFinalSmall),
    /below minimum non-final part size|EntityTooSmall/,
    'Non-final part below 5 MiB must be rejected with /below minimum non-final part size|EntityTooSmall/'
  );

  // 2. Multipart manifest with 0-byte final part and preceding >= 5 MiB parts passes
  const manifestZeroByteFinal = JSON.parse(JSON.stringify(baseManifest));
  manifestZeroByteFinal.parts[2].size_bytes = 0;
  manifestZeroByteFinal.total_size_bytes = FIVE_MIB + FIVE_MIB + 0;
  assert.doesNotThrow(
    () => validateS3MultipartSemantics(manifestZeroByteFinal),
    'Multipart manifest with 0-byte final part and preceding >= 5 MiB parts must pass validateS3MultipartSemantics'
  );

  // 3. Single-part manifest of 1 KiB passes (since it is the final part)
  const manifestSinglePart1KiB = {
    upload_id: "mp-upload-single-part-1kib-test-01",
    bucket: "cybrik-telemetry-archive",
    object_key: "single-part/data.bin",
    total_parts: 1,
    total_size_bytes: ONE_KIB,
    overall_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    parts: [
      {
        part_number: 1,
        etag: "\"9b10e4ede7fa2d398e621d2345f8bcf0\"",
        sha256: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
        size_bytes: ONE_KIB
      }
    ]
  };
  assert.doesNotThrow(
    () => validateS3MultipartSemantics(manifestSinglePart1KiB),
    'Single-part manifest of 1 KiB must pass validateS3MultipartSemantics since it is the final part'
  );

  // 4. Part exceeding 5 GiB is rejected
  const manifestExceeding5GiB = JSON.parse(JSON.stringify(baseManifest));
  manifestExceeding5GiB.parts[1].size_bytes = FIVE_GIB + 1;
  manifestExceeding5GiB.total_size_bytes = FIVE_MIB + (FIVE_GIB + 1) + FIVE_MIB;
  assert.throws(
    () => validateS3MultipartSemantics(manifestExceeding5GiB),
    /exceeds maximum allowed part size|EntityTooLarge/,
    'Part exceeding 5 GiB must be rejected'
  );

  // Also test single-part manifest exceeding 5 GiB is rejected
  const manifestSingleExceeding5GiB = {
    upload_id: "mp-upload-single-part-huge-test-01",
    bucket: "cybrik-telemetry-archive",
    object_key: "single-part/huge.bin",
    total_parts: 1,
    total_size_bytes: FIVE_GIB + 1,
    overall_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    parts: [
      {
        part_number: 1,
        etag: "\"9b10e4ede7fa2d398e621d2345f8bcf0\"",
        sha256: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
        size_bytes: FIVE_GIB + 1
      }
    ]
  };
  assert.throws(
    () => validateS3MultipartSemantics(manifestSingleExceeding5GiB),
    /exceeds maximum allowed part size|EntityTooLarge/,
    'Single part exceeding 5 GiB must be rejected'
  );
});

test('EntityTooSmall dispatch mapping, error conditions, and schema validation (Finding R15-01 / OPEN-2)', () => {
  const samplePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. Schema validation: EntityTooSmall is valid in required_error_codes
  const profileWithEntityTooSmall = {
    ...baseProfile,
    required_error_codes: [...CLOSED_13_S3_ERROR_CODES],
  };
  assert.ok(
    ajv.validate(PROFILE_DEF_ID, profileWithEntityTooSmall),
    `Conformance profile with all 13 error codes including EntityTooSmall must pass schema validation: ${ajv.errorsText()}`
  );
  assert.ok(
    ajv.validate(S3_SCHEMA_ID, profileWithEntityTooSmall),
    `Root S3 schema must validate profile with EntityTooSmall: ${ajv.errorsText()}`
  );

  // 1b. Schema validation: unsupported error code is rejected by enum keyword
  const profileWithUnsupportedCode = {
    ...baseProfile,
    required_error_codes: ['EntityTooTiny', ...CLOSED_13_S3_ERROR_CODES.slice(1)],
  };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, profileWithUnsupportedCode));
  assert.equal(ajv.errors.length, 1);
  assert.equal(ajv.errors[0].keyword, 'enum');
  assert.equal(ajv.errors[0].instancePath, '/required_error_codes/0');

  // 2. Dispatch mapping: dispatchS3Error string triggers
  const dispatchDirect = dispatchS3Error('EntityTooSmall');
  assert.equal(dispatchDirect.http_status, 400);
  assert.equal(dispatchDirect.error_code, 'EntityTooSmall');
  assert.equal(dispatchDirect.status, 400);
  assert.equal(dispatchDirect.code, 'EntityTooSmall');
  assert.equal(dispatchDirect.reason, 'PART_TOO_SMALL');

  const dispatchPartTooSmall = dispatchS3Error('PART_TOO_SMALL');
  assert.equal(dispatchPartTooSmall.http_status, 400);
  assert.equal(dispatchPartTooSmall.error_code, 'EntityTooSmall');
  assert.equal(dispatchPartTooSmall.status, 400);
  assert.equal(dispatchPartTooSmall.code, 'EntityTooSmall');

  const dispatchNonFinalPart = dispatchS3Error('NON_FINAL_PART_TOO_SMALL');
  assert.equal(dispatchNonFinalPart.http_status, 400);
  assert.equal(dispatchNonFinalPart.error_code, 'EntityTooSmall');

  // 3. Dispatch mapping: dispatchS3Error object triggers
  const dispatchObjCode = dispatchS3Error({ error_code: 'EntityTooSmall' });
  assert.equal(dispatchObjCode.http_status, 400);
  assert.equal(dispatchObjCode.error_code, 'EntityTooSmall');

  const dispatchObjCondition = dispatchS3Error({ error_condition: 'PART_TOO_SMALL' });
  assert.equal(dispatchObjCondition.http_status, 400);
  assert.equal(dispatchObjCondition.error_code, 'EntityTooSmall');

  const dispatchObjReason = dispatchS3Error({ reason: 'NON_FINAL_PART_TOO_SMALL' });
  assert.equal(dispatchObjReason.http_status, 400);
  assert.equal(dispatchObjReason.error_code, 'EntityTooSmall');

  // 4. Semantic dispatch integration: validateS3MultipartSemantics throws EntityTooSmall for non-final part < 5 MiB
  const multipartPath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-multipart-upload-manifest.json');
  const validManifest = JSON.parse(readFileSync(multipartPath, 'utf8'));

  const smallNonFinalManifest = JSON.parse(JSON.stringify(validManifest));
  smallNonFinalManifest.parts[0].size_bytes = 5242879; // 1 byte below 5 MiB
  smallNonFinalManifest.total_size_bytes = 5242879 + 5242880 + 5242880;
  assert.throws(
    () => validateS3MultipartSemantics(smallNonFinalManifest),
    /EntityTooSmall/,
    'Non-final part below 5 MiB must throw EntityTooSmall error'
  );
});

test('storage conformance profile required_error_codes must contain all 13 canonical error codes (Finding R16-01 / OPEN-2)', () => {
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  // 1. Positive baseline: all 13 canonical error codes pass validatePlatformSemantics
  assert.doesNotThrow(() => validatePlatformSemantics(baseProfile, PROFILE_DEF_ID));
  assert.doesNotThrow(() => validatePlatformSemantics(baseProfile, S3_SCHEMA_ID));

  // 2. Missing each of the 13 canonical error codes fails validatePlatformSemantics with exact error message
  for (const code of S3_CANONICAL_ERROR_CODES) {
    const mutated = {
      ...baseProfile,
      required_error_codes: S3_CANONICAL_ERROR_CODES.filter((c) => c !== code),
    };
    assert.throws(
      () => validatePlatformSemantics(mutated, PROFILE_DEF_ID),
      new RegExp(`Semantic error: storage conformance profile required_error_codes is missing required canonical error code '${code}'`)
    );
  }
});

test('storage conformance profile omitting EntityTooSmall or any canonical code is rejected by schema and semantics (Finding R16-01 / OPEN-2)', () => {
  const samplePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. Omission of EntityTooSmall (12 codes): rejected by schema (minItems: 13) and semantics (/missing required canonical error code/)
  const profileOmittingEntityTooSmall = {
    ...baseProfile,
    required_error_codes: CLOSED_13_S3_ERROR_CODES.filter((c) => c !== 'EntityTooSmall'),
  };
  assert.equal(profileOmittingEntityTooSmall.required_error_codes.length, 12, 'Must have exactly 12 error codes');

  // Ajv schema validation rejection with minItems: 13
  const validDef = ajv.validate(PROFILE_DEF_ID, profileOmittingEntityTooSmall);
  assert.ok(!validDef, 'Profile with 12 codes omitting EntityTooSmall must fail schema validation against PROFILE_DEF_ID');
  assert.ok(
    ajv.errors.some((e) => e.keyword === 'minItems' && e.instancePath === '/required_error_codes' && e.params?.limit === 13),
    `Schema error must be minItems with limit 13 on /required_error_codes, got: ${ajv.errorsText()}`
  );

  const validRoot = ajv.validate(S3_SCHEMA_ID, profileOmittingEntityTooSmall);
  assert.ok(!validRoot, 'Profile with 12 codes omitting EntityTooSmall must fail schema validation against root S3_SCHEMA_ID');
  assert.ok(
    ajv.errors.some((e) => e.keyword === 'minItems' && e.instancePath === '/required_error_codes' && e.params?.limit === 13),
    `Root schema error must be minItems with limit 13 on /required_error_codes, got: ${ajv.errorsText()}`
  );

  // Semantic validation rejection with /missing required canonical error code/
  assert.throws(
    () => validatePlatformSemantics(profileOmittingEntityTooSmall, PROFILE_DEF_ID),
    /missing required canonical error code/,
    'Profile omitting EntityTooSmall must fail semantic validation with /missing required canonical error code/'
  );
  assert.throws(
    () => validatePlatformSemantics(profileOmittingEntityTooSmall, S3_SCHEMA_ID),
    /missing required canonical error code/,
    'Profile omitting EntityTooSmall must fail semantic validation with /missing required canonical error code/ against root schema'
  );

  // 2. Exhaustive omission coverage across all 13 canonical error codes
  for (const omittedCode of CLOSED_13_S3_ERROR_CODES) {
    const profileOmittingCode = {
      ...baseProfile,
      required_error_codes: CLOSED_13_S3_ERROR_CODES.filter((c) => c !== omittedCode),
    };
    assert.equal(profileOmittingCode.required_error_codes.length, 12);

    const validSchema = ajv.validate(PROFILE_DEF_ID, profileOmittingCode);
    assert.ok(!validSchema, `Profile omitting '${omittedCode}' must fail schema validation`);
    assert.ok(
      ajv.errors.some((e) => e.keyword === 'minItems' && e.instancePath === '/required_error_codes'),
      `Schema error must be minItems on /required_error_codes when omitting '${omittedCode}'`
    );

    assert.throws(
      () => validatePlatformSemantics(profileOmittingCode, PROFILE_DEF_ID),
      new RegExp(`missing required canonical error code '${omittedCode}'`),
      `Profile omitting '${omittedCode}' must throw semantic error explicitly naming '${omittedCode}'`
    );
  }
});

test('InvalidPartOrder dispatch mapping and validateS3MultipartSemantics duplicate/descending part classification (Finding R17-01 / OPEN-2)', () => {
  // 1. Dispatch mapping: string triggers
  for (const trigger of ['InvalidPartOrder', 'DUPLICATE_PART', 'INVALID_PART_ORDER', 'PART_OUT_OF_ORDER']) {
    const res = dispatchS3Error(trigger);
    assert.equal(res.http_status, 400, `Trigger '${trigger}' must map to http_status 400`);
    assert.equal(res.error_code, 'InvalidPartOrder', `Trigger '${trigger}' must map to error_code 'InvalidPartOrder'`);
    assert.equal(res.status, 400, `Trigger '${trigger}' must map to status 400`);
    assert.equal(res.code, 'InvalidPartOrder', `Trigger '${trigger}' must map to code 'InvalidPartOrder'`);
  }

  // 2. Dispatch mapping: object triggers
  const objTriggers = [
    { error_code: 'InvalidPartOrder' },
    { code: 'InvalidPartOrder' },
    { error_condition: 'DUPLICATE_PART' },
    { error_condition: 'INVALID_PART_ORDER' },
    { error_condition: 'PART_OUT_OF_ORDER' },
    { reason: 'DUPLICATE_PART' },
    { reason: 'INVALID_PART_ORDER' },
    { reason: 'PART_OUT_OF_ORDER' },
    { reason: 'InvalidPartOrder' },
  ];
  for (const obj of objTriggers) {
    const res = dispatchS3Error(obj);
    assert.equal(res.http_status, 400, `Object ${JSON.stringify(obj)} must map to http_status 400`);
    assert.equal(res.error_code, 'InvalidPartOrder', `Object ${JSON.stringify(obj)} must map to error_code 'InvalidPartOrder'`);
    assert.equal(res.status, 400, `Object ${JSON.stringify(obj)} must map to status 400`);
    assert.equal(res.code, 'InvalidPartOrder', `Object ${JSON.stringify(obj)} must map to code 'InvalidPartOrder'`);
  }

  // 3. Semantic validation: duplicate and descending parts classification under InvalidPartOrder
  const samplePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-multipart-upload-manifest.json');
  const validManifest = JSON.parse(readFileSync(samplePath, 'utf8'));

  // Duplicate part at same position
  const dupManifest = JSON.parse(JSON.stringify(validManifest));
  dupManifest.parts = [
    { part_number: 1, etag: '"a"', sha256: 'a'.repeat(64), size_bytes: 5242880 },
    { part_number: 1, etag: '"b"', sha256: 'b'.repeat(64), size_bytes: 5242880 },
  ];
  dupManifest.total_parts = 2;
  dupManifest.total_size_bytes = 10485760;
  assert.throws(
    () => validateS3MultipartSemantics(dupManifest),
    /Semantic error: multipart upload manifest parts must be in strictly ascending order by part_number with no duplicates \(found part 1 after 1\) \(InvalidPartOrder\)/,
    'Duplicate part numbers must throw exact InvalidPartOrder semantic error'
  );

  // Descending part
  const descManifest = JSON.parse(JSON.stringify(validManifest));
  descManifest.parts = [
    { part_number: 2, etag: '"a"', sha256: 'a'.repeat(64), size_bytes: 5242880 },
    { part_number: 1, etag: '"b"', sha256: 'b'.repeat(64), size_bytes: 5242880 },
  ];
  descManifest.total_parts = 2;
  descManifest.total_size_bytes = 10485760;
  assert.throws(
    () => validateS3MultipartSemantics(descManifest),
    /Semantic error: multipart upload manifest parts must be in strictly ascending order by part_number with no duplicates \(found part 1 after 2\) \(InvalidPartOrder\)/,
    'Descending part numbers must throw exact InvalidPartOrder semantic error'
  );
});

test('dispatchS3PutObject x-amz-content-sha256 validation (OPEN-2 Finding 1)', () => {
  const payload = Buffer.from('CYBRIK_IMMUTABLE_TEST_PAYLOAD_SHA256_VERIFICATION');
  const validSha256 = createHash('sha256').update(payload).digest('hex');
  const mismatchedSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  const malformedSha256 = 'not-a-valid-64-hex-sha256!';

  // 1. Matching SHA256 returns 200
  const matchRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': validSha256 });
  assert.equal(matchRes.http_status, 200);
  assert.equal(matchRes.error_code, null);

  // 2. UNSIGNED-PAYLOAD returns 200
  const unsignedRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(unsignedRes.http_status, 200);
  assert.equal(unsignedRes.error_code, null);

  // 3. STREAMING-AWS4-HMAC-SHA256-PAYLOAD is rejected with HTTP 400 InvalidDigest
  const streamingRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD' });
  assert.equal(streamingRes.http_status, 400);
  assert.equal(streamingRes.error_code, 'InvalidDigest');
  assert.equal(streamingRes.code, 'InvalidDigest');
  assert.equal(streamingRes.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  // 4. Mismatched SHA256 returns 400 BadDigest / PAYLOAD_SHA256_MISMATCH
  const mismatchRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': mismatchedSha256 });
  assert.equal(mismatchRes.http_status, 400);
  assert.equal(mismatchRes.error_code, 'BadDigest');
  assert.equal(mismatchRes.code, 'BadDigest');
  assert.equal(mismatchRes.reason, 'PAYLOAD_SHA256_MISMATCH');

  // 5. Malformed SHA256 returns 400 InvalidDigest / MALFORMED_HEADER_SYNTAX
  const malformedRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': malformedSha256 });
  assert.equal(malformedRes.http_status, 400);
  assert.equal(malformedRes.error_code, 'InvalidDigest');
  assert.equal(malformedRes.code, 'InvalidDigest');
  assert.equal(malformedRes.reason, 'MALFORMED_HEADER_SYNTAX');

  // 6. dispatchS3Error mapping for PAYLOAD_SHA256_MISMATCH and MALFORMED_HEADER_SYNTAX
  const errDispatchSha = dispatchS3Error('PAYLOAD_SHA256_MISMATCH');
  assert.equal(errDispatchSha.http_status, 400);
  assert.equal(errDispatchSha.error_code, 'BadDigest');
  assert.equal(errDispatchSha.reason, 'PAYLOAD_SHA256_MISMATCH');

  const errDispatchMal = dispatchS3Error('MALFORMED_HEADER_SYNTAX');
  assert.equal(errDispatchMal.http_status, 400);
  assert.equal(errDispatchMal.error_code, 'InvalidDigest');
  assert.equal(errDispatchMal.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('dispatchS3CompleteMultipartUpload storedParts validation with Map and Object (OPEN-2 Finding 3)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  // 1. Success with Map
  const validMap = new Map([
    [1, { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
    [2, { etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }],
  ]);
  const okMapRes = dispatchS3CompleteMultipartUpload(manifest, validMap);
  assert.equal(okMapRes.http_status, 200);
  assert.equal(okMapRes.error_code, null);

  // 2. Success with Object
  const validObj = {
    1: { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    2: { etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
  };
  const okObjRes = dispatchS3CompleteMultipartUpload(manifest, validObj);
  assert.equal(okObjRes.http_status, 200);
  assert.equal(okObjRes.error_code, null);

  // 3. Missing part with Map -> MissingStoredPartETag
  const missingMap = new Map([
    [1, { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
  ]);
  const missingMapRes = dispatchS3CompleteMultipartUpload(manifest, missingMap);
  assert.equal(missingMapRes.http_status, 400);
  assert.equal(missingMapRes.error_code, 'InvalidPart');
  assert.equal(missingMapRes.code, 'InvalidPart');
  assert.ok(missingMapRes.reason === 'MissingStoredPartETag' || missingMapRes.reason === 'MISSING_PART');

  // 4. Missing part with Object -> MissingStoredPartETag
  const missingObj = {
    1: { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
  };
  const missingObjRes = dispatchS3CompleteMultipartUpload(manifest, missingObj);
  assert.equal(missingObjRes.http_status, 400);
  assert.equal(missingObjRes.error_code, 'InvalidPart');
  assert.ok(missingObjRes.reason === 'MissingStoredPartETag' || missingObjRes.reason === 'MISSING_PART');

  // 5. ETag mismatch with Map -> ETagMismatch
  const mismatchMap = new Map([
    [1, { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
    [2, { etag: '"ffffffffffffffffffffffffffffffff"', size_bytes: 5242880 }],
  ]);
  const mismatchMapRes = dispatchS3CompleteMultipartUpload(manifest, mismatchMap);
  assert.equal(mismatchMapRes.http_status, 400);
  assert.equal(mismatchMapRes.error_code, 'InvalidPart');
  assert.equal(mismatchMapRes.code, 'InvalidPart');
  assert.ok(mismatchMapRes.reason === 'ETagMismatch' || mismatchMapRes.reason === 'PART_ETAG_MISMATCH');

  // 6. ETag mismatch with Object -> ETagMismatch
  const mismatchObj = {
    1: { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    2: { etag: '"ffffffffffffffffffffffffffffffff"', size_bytes: 5242880 },
  };
  const mismatchObjRes = dispatchS3CompleteMultipartUpload(manifest, mismatchObj);
  assert.equal(mismatchObjRes.http_status, 400);
  assert.equal(mismatchObjRes.error_code, 'InvalidPart');
  assert.ok(mismatchObjRes.reason === 'ETagMismatch' || mismatchObjRes.reason === 'PART_ETAG_MISMATCH');

  // 7. dispatchS3Error mapping for InvalidPart, PartNotFound, ETagMismatch, MISSING_PART, PART_ETAG_MISMATCH
  for (const trigger of ['InvalidPart', 'INVALID_PART', 'PartNotFound', 'PART_NOT_FOUND', 'MISSING_PART']) {
    const res = dispatchS3Error(trigger);
    assert.equal(res.http_status, 400);
    assert.equal(res.error_code, 'InvalidPart');
  }
  for (const trigger of ['ETagMismatch', 'ETAG_MISMATCH', 'PART_ETAG_MISMATCH']) {
    const res = dispatchS3Error(trigger);
    assert.equal(res.http_status, 400);
    assert.equal(res.error_code, 'InvalidPart');
  }
});
test('dispatchS3PutObject with valid MD5 but mismatched x-amz-content-sha256 rejects payload (OPEN-2 / Finding 3)', () => {
  const payload = Buffer.from('CYBRIK_IMMUTABLE_AUDIT_LOG_PAYLOAD_SHA256_TEST_2026');
  const validMd5 = computePayloadMd5(payload);
  const validSha256 = computePayloadSha256(payload);

  const mismatchedSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  const malformedSha256 = 'not-a-valid-64-hex-sha256!';

  // 1. Positive: valid MD5 and matching x-amz-content-sha256 passes
  const matchedRes = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': validSha256,
  });
  assert.equal(matchedRes.http_status, 200);
  assert.equal(matchedRes.error_code, null);

  // 2. Negative: valid MD5 but mismatched x-amz-content-sha256 returns HTTP 400 BadDigest
  const mismatchRes = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': mismatchedSha256,
  });
  assert.equal(mismatchRes.http_status, 400);
  assert.equal(mismatchRes.error_code, 'BadDigest');
  assert.equal(mismatchRes.reason, 'PAYLOAD_SHA256_MISMATCH');

  // Also via dispatchS3Error with options object
  const mismatchErrRes = dispatchS3Error({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': mismatchedSha256,
  });
  assert.equal(mismatchErrRes.http_status, 400);
  assert.equal(mismatchErrRes.error_code, 'BadDigest');
  assert.equal(mismatchErrRes.reason, 'PAYLOAD_SHA256_MISMATCH');

  // 3. Negative: valid MD5 but malformed x-amz-content-sha256 returns HTTP 400 InvalidDigest
  const malformedRes = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': malformedSha256,
  });
  assert.equal(malformedRes.http_status, 400);
  assert.equal(malformedRes.error_code, 'InvalidDigest');
  assert.equal(malformedRes.reason, 'MALFORMED_HEADER_SYNTAX');

  // 4. Negative: valid x-amz-content-sha256 but mismatched MD5 returns HTTP 400 BadDigest
  const mismatchMd5Res = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: '1B2M2Y8AsgTpgAmY7PhCfg==',
    'x-amz-content-sha256': validSha256,
  });
  assert.equal(mismatchMd5Res.http_status, 400);
  assert.equal(mismatchMd5Res.error_code, 'BadDigest');
  assert.equal(mismatchMd5Res.reason, 'PAYLOAD_DIGEST_MISMATCH');

  // 5. Negative: valid x-amz-content-sha256 but malformed MD5 returns HTTP 400 InvalidDigest
  const malformedMd5Res = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: 'malformed-md5!@#',
    'x-amz-content-sha256': validSha256,
  });
  assert.equal(malformedMd5Res.http_status, 400);
  assert.equal(malformedMd5Res.error_code, 'InvalidDigest');
  assert.equal(malformedMd5Res.reason, 'MALFORMED_HEADER_SYNTAX');

  // 6. Helper coverage: isMalformedSha256 and computePayloadSha256
  assert.equal(isMalformedSha256(validSha256), false);
  assert.equal(isMalformedSha256(''), true);
  assert.equal(isMalformedSha256(null), true);
  assert.equal(isMalformedSha256(12345), true);
  assert.equal(isMalformedSha256('abc'), true);
  assert.equal(computePayloadSha256('hello'), createHash('sha256').update('hello').digest('hex'));
  assert.throws(() => computePayloadSha256(null), TypeError);
  assert.throws(() => computePayloadSha256(undefined), TypeError);
});

test('dispatchS3CompleteMultipartUpload with missing part and stored-ETag mismatch returns HTTP 400 InvalidPart (OPEN-2 / Finding 4)', () => {
  const storedParts = [
    {
      part_number: 1,
      etag: '"d41d8cd98f00b204e9800998ecf8427e"',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      size_bytes: 5242880,
    },
    {
      part_number: 2,
      etag: '"098f6bcd4621d373cade4e832627b4f6"',
      sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      size_bytes: 5242880,
    },
  ];

  // 1. Positive: valid completion with matching parts and ETags returns HTTP 200
  const validCompletion = dispatchS3CompleteMultipartUpload({
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' },
    ],
    storedParts,
  });
  assert.equal(validCompletion.http_status, 200);
  assert.equal(validCompletion.error_code, null);

  // 2. Negative: missing part (part 3 specified in completion request, but only parts 1 & 2 stored) returns HTTP 400 InvalidPart
  const missingPartRes = dispatchS3CompleteMultipartUpload({
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
      { part_number: 3, etag: '"ffffffffffffffffffffffffffffffff"' },
    ],
    storedParts,
  });
  assert.equal(missingPartRes.http_status, 400);
  assert.equal(missingPartRes.error_code, 'InvalidPart');
  assert.ok(missingPartRes.reason === 'MissingStoredPartETag' || missingPartRes.reason === 'MISSING_PART');

  // 3. Negative: stored-ETag mismatch (part 2 specified with wrong ETag) returns HTTP 400 InvalidPart
  const mismatchedEtagRes = dispatchS3CompleteMultipartUpload({
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
      { part_number: 2, etag: '"ffffffffffffffffffffffffffffffff"' },
    ],
    storedParts,
  });
  assert.equal(mismatchedEtagRes.http_status, 400);
  assert.equal(mismatchedEtagRes.error_code, 'InvalidPart');
  assert.ok(mismatchedEtagRes.reason === 'ETagMismatch' || mismatchedEtagRes.reason === 'PART_ETAG_MISMATCH');

  // 4. Negative: empty parts list returns HTTP 400 InvalidArgument (EmptyPartsList)
  const emptyPartsRes = dispatchS3CompleteMultipartUpload({
    parts: [],
    storedParts,
  });
  assert.equal(emptyPartsRes.http_status, 400);
  assert.equal(emptyPartsRes.error_code, 'InvalidArgument');
  assert.equal(emptyPartsRes.reason, 'EmptyPartsList');

  // 5. Negative: duplicate part in completion returns HTTP 400 InvalidPartOrder
  const dupPartRes = dispatchS3CompleteMultipartUpload({
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
      { part_number: 1, etag: '"098f6bcd4621d373cade4e832627b4f6"' },
    ],
    storedParts,
  });
  assert.equal(dupPartRes.http_status, 400);
  assert.equal(dupPartRes.error_code, 'InvalidPartOrder');
  assert.equal(dupPartRes.reason, 'DUPLICATE_PART');

  // 6. Negative: descending part numbers in completion returns HTTP 400 InvalidPartOrder
  const descPartRes = dispatchS3CompleteMultipartUpload({
    parts: [
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' },
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
    ],
    storedParts,
  });
  assert.equal(descPartRes.http_status, 400);
  assert.equal(descPartRes.error_code, 'InvalidPartOrder');
  assert.equal(descPartRes.reason, 'PARTS_NOT_ASCENDING');

  // 7. Negative: non-final part too small returns HTTP 400 EntityTooSmall
  const smallPartStored = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 1024 },
    { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
  ];
  const smallPartRes = dispatchS3CompleteMultipartUpload({
    parts: [{ part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }, { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' }],
    storedParts: smallPartStored,
  });
  assert.equal(smallPartRes.http_status, 400);
  assert.equal(smallPartRes.error_code, 'EntityTooSmall');

  // 8. Negative: part too large returns HTTP 400 EntityTooLarge
  const largePartStored = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5368709121 },
  ];
  const largePartRes = dispatchS3CompleteMultipartUpload({
    parts: [{ part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }],
    storedParts: largePartStored,
  });
  assert.equal(largePartRes.http_status, 400);
  assert.equal(largePartRes.error_code, 'EntityTooLarge');

  // 9. Dispatch S3 error mapping for InvalidPart string and object triggers
  for (const trigger of ['InvalidPart', 'INVALID_PART', 'MISSING_PART', 'PART_ETAG_MISMATCH', 'ETAG_MISMATCH', 'PART_NOT_FOUND']) {
    const res = dispatchS3Error(trigger);
    assert.equal(res.http_status, 400, `Trigger '${trigger}' must return http_status 400`);
    assert.equal(res.error_code, 'InvalidPart', `Trigger '${trigger}' must return error_code 'InvalidPart'`);
  }

  for (const trigger of ['EmptyPartsList', 'EMPTY_PARTS_LIST', 'InvalidArgument']) {
    const res = dispatchS3Error(trigger);
    assert.equal(res.http_status, 400, `Trigger '${trigger}' must return http_status 400`);
    assert.equal(res.error_code, 'InvalidArgument', `Trigger '${trigger}' must return error_code 'InvalidArgument'`);
    if (trigger === 'EmptyPartsList' || trigger === 'EMPTY_PARTS_LIST') {
      assert.equal(res.reason, 'EmptyPartsList');
    }
  }

  for (const obj of [{ error_code: 'InvalidPart' }, { code: 'InvalidPart' }, { error_condition: 'MISSING_PART' }, { reason: 'PART_ETAG_MISMATCH' }]) {
    const res = dispatchS3Error(obj);
    assert.equal(res.http_status, 400);
    assert.equal(res.error_code, 'InvalidPart');
  }

  for (const obj of [{ error_code: 'InvalidArgument' }, { code: 'InvalidArgument' }, { error_condition: 'EmptyPartsList' }, { reason: 'EMPTY_PARTS_LIST' }]) {
    const res = dispatchS3Error(obj);
    assert.equal(res.http_status, 400);
    assert.equal(res.error_code, 'InvalidArgument');
  }
});

test('dispatchS3Error and dispatchS3CompleteMultipartUpload full taxonomy and branch coverage', () => {
  // 1. All 13 canonical error codes string dispatch
  const stringCodes = [
    { trigger: 'NoSuchBucket', status: 404, code: 'NoSuchBucket' },
    { trigger: 'NoSuchKey', status: 404, code: 'NoSuchKey' },
    { trigger: 'NoSuchUpload', status: 404, code: 'NoSuchUpload' },
    { trigger: 'ObjectLockConfigurationNotFoundError', status: 404, code: 'ObjectLockConfigurationNotFoundError' },
    { trigger: 'PreconditionFailed', status: 412, code: 'PreconditionFailed' },
    { trigger: 'AccessDenied', status: 403, code: 'AccessDenied' },
    { trigger: 'InvalidArgument', status: 400, code: 'InvalidArgument' },
    { trigger: 'EntityTooLarge', status: 400, code: 'EntityTooLarge' },
    { trigger: 'PART_TOO_LARGE', status: 400, code: 'EntityTooLarge' },
    { trigger: 'PAYLOAD_TOO_LARGE', status: 400, code: 'EntityTooLarge' },
    { trigger: 'EntityTooSmall', status: 400, code: 'EntityTooSmall' },
    { trigger: 'PART_TOO_SMALL', status: 400, code: 'EntityTooSmall' },
    { trigger: 'NON_FINAL_PART_TOO_SMALL', status: 400, code: 'EntityTooSmall' },
    { trigger: 'InvalidPartOrder', status: 400, code: 'InvalidPartOrder' },
    { trigger: 'PARTS_NOT_ASCENDING', status: 400, code: 'InvalidPartOrder' },
    { trigger: 'DUPLICATE_PART_NUMBER', status: 400, code: 'InvalidPartOrder' },
  ];

  for (const { trigger, status, code } of stringCodes) {
    const res = dispatchS3Error(trigger);
    assert.equal(res.http_status, status);
    assert.equal(res.error_code, code);
  }

  // 2. All 13 canonical error codes object dispatch
  for (const code of CLOSED_13_S3_ERROR_CODES) {
    const res = dispatchS3Error({ error_code: code });
    assert.equal(res.error_code, code);
    const res2 = dispatchS3Error({ code });
    assert.equal(res2.error_code, code);
  }

  // 3. CompleteMultipartUpload with Map storedParts and Object storedParts
  const storedMap = new Map([
    [1, { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
    [2, { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }],
  ]);
  const mapRes = dispatchS3CompleteMultipartUpload({
    parts: [{ part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }, { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' }],
    storedParts: storedMap,
  });
  assert.equal(mapRes.http_status, 200);

  const storedObj = {
    1: { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    2: { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
  };
  const objRes = dispatchS3CompleteMultipartUpload({
    manifest: {
      parts: [{ PartNumber: 1, ETag: '"d41d8cd98f00b204e9800998ecf8427e"' }, { PartNumber: 2, ETag: '"098f6bcd4621d373cade4e832627b4f6"' }],
    },
    storedParts: storedObj,
  });
  assert.equal(objRes.http_status, 200);

  // 4. Invalid part numbers (non-integer, <= 0)
  assert.equal(
    dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 0 }] }).error_code,
    'InvalidArgument'
  );
  assert.equal(
    dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1.5 }] }).error_code,
    'InvalidArgument'
  );
  assert.equal(
    dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 'one' }] }).error_code,
    'InvalidArgument'
  );

  // 5. Malformed base64 MD5 string trigger and fallback object/primitive triggers in dispatchS3Error
  const malformedStrRes = dispatchS3Error('invalid-base64-md5-string!');
  assert.equal(malformedStrRes.http_status, 400);
  assert.equal(malformedStrRes.error_code, 'InvalidDigest');

  const fallbackObjRes = dispatchS3Error({ some_random_key: 'value' });
  assert.equal(fallbackObjRes.http_status, 400);
  assert.equal(fallbackObjRes.error_code, 'InvalidDigest');
  assert.equal(fallbackObjRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const fallbackPrimRes = dispatchS3Error(12345);
  assert.equal(fallbackPrimRes.http_status, 400);
  assert.equal(fallbackPrimRes.error_code, 'InvalidDigest');
  assert.equal(fallbackPrimRes.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('validateS3MultipartSemantics exhaustive error conditions', () => {
  const samplePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-multipart-upload-manifest.json');
  const validManifest = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 0. Non-object manifest
  assert.throws(() => validateS3MultipartSemantics(null), /multipart manifest must be an object/);
  assert.throws(() => validateS3MultipartSemantics('not-an-obj'), /multipart manifest must be an object/);

  // 1. Non-array parts
  const nonArrayParts = JSON.parse(JSON.stringify(validManifest));
  nonArrayParts.parts = 'not-an-array';
  assert.throws(() => validateS3MultipartSemantics(nonArrayParts), /multipart upload manifest parts array must be non-empty/);

  // 2. Empty parts array
  const emptyParts = JSON.parse(JSON.stringify(validManifest));
  emptyParts.parts = [];
  assert.throws(() => validateS3MultipartSemantics(emptyParts), /multipart upload manifest parts array must be non-empty/);

  // 3. total_parts mismatch
  const totalPartsMismatch = JSON.parse(JSON.stringify(validManifest));
  totalPartsMismatch.total_parts = 999;
  assert.throws(() => validateS3MultipartSemantics(totalPartsMismatch), /total_parts.*does not match parts array length/);

  // 4. total_size_bytes mismatch
  const totalSizeMismatch = JSON.parse(JSON.stringify(validManifest));
  totalSizeMismatch.total_size_bytes = 999;
  assert.throws(() => validateS3MultipartSemantics(totalSizeMismatch), /total_size_bytes.*does not match sum of part sizes/);

  // 5. Negative part size
  const negSizePart = JSON.parse(JSON.stringify(validManifest));
  negSizePart.parts[0].size_bytes = -1;
  assert.throws(() => validateS3MultipartSemantics(negSizePart), /cannot be negative/);

  // 6. Non-final part size too small
  const smallPart = JSON.parse(JSON.stringify(validManifest));
  smallPart.parts[0].size_bytes = 1024;
  assert.throws(() => validateS3MultipartSemantics(smallPart), /below minimum non-final part size/);

  // 7. Part size > 5 GiB
  const giantPart = JSON.parse(JSON.stringify(validManifest));
  giantPart.parts[0].size_bytes = 5368709121;
  giantPart.total_size_bytes = 5368709121 + giantPart.parts[1].size_bytes;
  assert.throws(() => validateS3MultipartSemantics(giantPart), /exceeds maximum part size of 5368709120 bytes/);

  // 8. Total size > 5 TiB
  const partSize = 5000000000; // 5 GB per part <= 5 GiB max
  const partCount = 1100; // 1100 * 5 GB = 5.5 TB > 5 TiB (5497558138880 bytes)
  const parts1100 = Array.from({ length: partCount }, (_, idx) => ({
    part_number: idx + 1,
    etag: '"etag"',
    sha256: 'a'.repeat(64),
    size_bytes: partSize
  }));
  const totalSizeBytes = partCount * partSize;
  const over5TiB = {
    parts: parts1100,
    total_parts: partCount,
    total_size_bytes: totalSizeBytes
  };
  assert.throws(() => validateS3MultipartSemantics(over5TiB), /exceeds maximum total size of 5497558138880 bytes/);
});

test('verifyDigestErrorDispatch and verifyMalformedHeaderDispatch invalid dispatch exception branches', () => {
  const payload = Buffer.from('TEST_PAYLOAD');
  const validMd5 = computePayloadMd5(payload);

  // Calling verifyDigestErrorDispatch with valid matching digest throws because result.error_code !== 'BadDigest'
  assert.throws(
    () => verifyDigestErrorDispatch(payload, validMd5),
    /Strict error dispatch violation: payload byte digest mismatch must exclusively map to BadDigest/
  );

  // Calling verifyMalformedHeaderDispatch with valid matching digest throws because result.error_code !== 'InvalidDigest'
  assert.throws(
    () => verifyMalformedHeaderDispatch(payload, validMd5),
    /Strict error dispatch violation: malformed digest header must exclusively map to InvalidDigest/
  );

  // Calling verifyMalformedHeaderDispatch with valid base64 MD5 string throws because it is not malformed
  assert.throws(
    () => verifyMalformedHeaderDispatch(validMd5),
    /is a valid base64 MD5 digest, not a malformed header error condition/
  );

  // Calling verify functions with invalid HTTP status code throws
  assert.throws(
    () => verifyDigestErrorDispatch({ http_status: 500, code: 'BadDigest' }),
    /Strict error dispatch violation: payload byte digest mismatch must exclusively map to HTTP 400/
  );
  assert.throws(
    () => verifyMalformedHeaderDispatch({ http_status: 500, code: 'InvalidDigest' }),
    /Strict error dispatch violation: malformed digest header must exclusively map to HTTP 400/
  );
});

test('dispatchS3PutObject and dispatchS3Error exhaustive reason taxonomy and helper functions', () => {
  const payload = Buffer.from('TEST_PAYLOAD');
  const validMd5 = computePayloadMd5(payload);
  const validSha = computePayloadSha256(payload);

  // 1. dispatchS3PutObject options
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: validMd5, 'x-amz-content-sha256': validSha }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: 123 }).error_code, 'InvalidDigest');
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': 123 }).error_code, 'InvalidDigest');
  assert.equal(dispatchS3PutObject({}).error_code, 'InvalidDigest');

  // 2. dispatchS3Error string triggers
  assert.equal(dispatchS3Error('BadDigest').error_code, 'BadDigest');
  assert.equal(dispatchS3Error('PAYLOAD_DIGEST_MISMATCH').error_code, 'BadDigest');
  const shaMisRes = dispatchS3Error('PAYLOAD_SHA256_MISMATCH');
  assert.equal(shaMisRes.error_code, 'BadDigest');
  assert.equal(shaMisRes.reason, 'PAYLOAD_SHA256_MISMATCH');
  assert.equal(dispatchS3Error('InvalidDigest').error_code, 'InvalidDigest');
  assert.equal(dispatchS3Error('MALFORMED_HEADER_SYNTAX').error_code, 'InvalidDigest');
  const shaMalRes = dispatchS3Error('MALFORMED_SHA256_HEADER_SYNTAX');
  assert.equal(shaMalRes.error_code, 'InvalidDigest');
  assert.equal(shaMalRes.reason, 'MALFORMED_HEADER_SYNTAX');

  // 3. dispatchS3Error object reasons
  assert.equal(dispatchS3Error({ reason: 'PAYLOAD_DIGEST_MISMATCH' }).error_code, 'BadDigest');
  assert.equal(dispatchS3Error({ reason: 'PAYLOAD_SHA256_MISMATCH' }).error_code, 'BadDigest');
  assert.equal(dispatchS3Error({ reason: 'MALFORMED_DIGEST_HEADER' }).error_code, 'InvalidDigest');
  assert.equal(dispatchS3Error({ reason: 'MALFORMED_HEADER_SYNTAX' }).error_code, 'InvalidDigest');
  assert.equal(dispatchS3Error({ reason: 'PART_TOO_SMALL' }).error_code, 'EntityTooSmall');
  assert.equal(dispatchS3Error({ reason: 'NON_FINAL_PART_TOO_SMALL' }).error_code, 'EntityTooSmall');
  assert.equal(dispatchS3Error({ reason: 'PART_TOO_LARGE' }).error_code, 'EntityTooLarge');
  assert.equal(dispatchS3Error({ reason: 'PAYLOAD_TOO_LARGE' }).error_code, 'EntityTooLarge');
  assert.equal(dispatchS3Error({ reason: 'DUPLICATE_PART' }).error_code, 'InvalidPartOrder');
  assert.equal(dispatchS3Error({ reason: 'PART_OUT_OF_ORDER' }).error_code, 'InvalidPartOrder');
  assert.equal(dispatchS3Error({ reason: 'MISSING_PART' }).error_code, 'InvalidPart');
  assert.equal(dispatchS3Error({ reason: 'PART_ETAG_MISMATCH' }).error_code, 'InvalidPart');
  assert.equal(dispatchS3Error({ reason: 'ETAG_MISMATCH' }).error_code, 'InvalidPart');
  assert.equal(dispatchS3Error({ reason: 'PART_NOT_FOUND' }).error_code, 'InvalidPart');
  assert.equal(dispatchS3Error({ reason: 'EMPTY_PARTS_LIST' }).error_code, 'InvalidArgument');
  assert.equal(dispatchS3Error({ reason: 'EmptyPartsList' }).error_code, 'InvalidArgument');

  // 4. isMalformedBase64Md5 branches
  assert.equal(isMalformedBase64Md5(''), true);
  assert.equal(isMalformedBase64Md5('   '), true);
  assert.equal(isMalformedBase64Md5(null), true);
  assert.equal(isMalformedBase64Md5(undefined), true);
  assert.equal(isMalformedBase64Md5(12345), true);
  assert.equal(isMalformedBase64Md5('short=='), true);
  assert.equal(isMalformedBase64Md5('AAAAAAAAAAAAAAAAAAAAAA=='), false);
  assert.equal(isMalformedBase64Md5('AAAAAAAAAAAAAAAAAAAAAB=='), true);

  // 5. isMalformedSha256 branches
  assert.equal(isMalformedSha256(''), true);
  assert.equal(isMalformedSha256('   '), true);
  assert.equal(isMalformedSha256(null), true);
  assert.equal(isMalformedSha256(undefined), true);
  assert.equal(isMalformedSha256(12345), true);
  assert.equal(isMalformedSha256('not-64-chars'), true);
  assert.equal(isMalformedSha256('a'.repeat(64)), false);
  assert.equal(isMalformedSha256('A'.repeat(64)), true);
  assert.equal(isMalformedSha256('z'.repeat(64)), true);

  // 6. computePayloadSha256 & computePayloadMd5 string & Buffer branches
  assert.equal(computePayloadSha256('hello'), computePayloadSha256(Buffer.from('hello')));
  assert.equal(computePayloadMd5('hello'), computePayloadMd5(Buffer.from('hello')));

  // 7. Additional dispatchS3Error and dispatchS3PutObject branch coverage
  assert.equal(dispatchS3Error('XAmzContentSHA256Mismatch').reason, 'XAmzContentSHA256Mismatch');
  assert.equal(dispatchS3Error(payload, validMd5).http_status, 200);
  assert.equal(dispatchS3Error({ payloadBytes: payload, 'x-amz-content-sha256': validSha }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payloadBytes: payload }).http_status, 400);
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1.5 }] }).error_code, 'InvalidArgument');
});

test('dispatchS3CompleteMultipartUpload fail-closed storedParts validation and strict ETag assertions (Finding 1 & 2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
    ],
  };

  // 1. Missing or non-object storedParts -> MissingStoredPartState
  const noStoredRes = dispatchS3CompleteMultipartUpload(manifest);
  assert.equal(noStoredRes.http_status, 400);
  assert.equal(noStoredRes.error_code, 'InvalidPart');
  assert.equal(noStoredRes.reason, 'MissingStoredPartState');

  const nullStoredRes = dispatchS3CompleteMultipartUpload(manifest, null);
  assert.equal(nullStoredRes.http_status, 400);
  assert.equal(nullStoredRes.error_code, 'InvalidPart');
  assert.equal(nullStoredRes.reason, 'MissingStoredPartState');

  const strStoredRes = dispatchS3CompleteMultipartUpload(manifest, 'invalid-state');
  assert.equal(strStoredRes.http_status, 400);
  assert.equal(strStoredRes.error_code, 'InvalidPart');
  assert.equal(strStoredRes.reason, 'MissingStoredPartState');

  // 2. Part missing ETag or blank ETag in manifest -> MissingManifestPartETag
  const missingEtagManifest = {
    parts: [
      { part_number: 1, etag: '' },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' },
    ],
  };
  const validStored = new Map([
    [1, { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
    [2, { etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }],
  ]);
  const missingEtagRes = dispatchS3CompleteMultipartUpload(missingEtagManifest, validStored);
  assert.equal(missingEtagRes.http_status, 400);
  assert.equal(missingEtagRes.error_code, 'InvalidPart');
  assert.equal(missingEtagRes.reason, 'MissingManifestPartETag');

  const noEtagFieldManifest = {
    parts: [
      { part_number: 1 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' },
    ],
  };
  const noEtagRes = dispatchS3CompleteMultipartUpload(noEtagFieldManifest, validStored);
  assert.equal(noEtagRes.http_status, 400);
  assert.equal(noEtagRes.error_code, 'InvalidPart');
  assert.equal(noEtagRes.reason, 'MissingManifestPartETag');

  // 3. Stored part missing or stored part ETag missing/blank -> MissingStoredPartETag
  const missingPartStored = new Map([
    [1, { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
  ]);
  const missingPartRes = dispatchS3CompleteMultipartUpload(manifest, missingPartStored);
  assert.equal(missingPartRes.http_status, 400);
  assert.equal(missingPartRes.error_code, 'InvalidPart');
  assert.equal(missingPartRes.reason, 'MissingStoredPartETag');

  const blankStoredEtag = new Map([
    [1, { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
    [2, { etag: '  ', size_bytes: 5242880 }],
  ]);
  const blankStoredRes = dispatchS3CompleteMultipartUpload(manifest, blankStoredEtag);
  assert.equal(blankStoredRes.http_status, 400);
  assert.equal(blankStoredRes.error_code, 'InvalidPart');
  assert.equal(blankStoredRes.reason, 'MissingStoredPartETag');

  // 4. Stored part ETag mismatch -> ETagMismatch
  const mismatchStored = new Map([
    [1, { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
    [2, { etag: '"ffffffffffffffffffffffffffffffff"', size_bytes: 5242880 }],
  ]);
  const mismatchRes = dispatchS3CompleteMultipartUpload(manifest, mismatchStored);
  assert.equal(mismatchRes.http_status, 400);
  assert.equal(mismatchRes.error_code, 'InvalidPart');
  assert.equal(mismatchRes.reason, 'ETagMismatch');

  // 5. dispatchS3Error supports all new InvalidPart reasons
  for (const reason of ['MissingStoredPartState', 'MissingManifestPartETag', 'MissingStoredPartETag', 'ETagMismatch']) {
    const errRes = dispatchS3Error(reason);
    assert.equal(errRes.http_status, 400);
    assert.equal(errRes.error_code, 'InvalidPart');
    assert.equal(errRes.reason, reason);
    const objErrRes = dispatchS3Error({ reason });
    assert.equal(objErrRes.http_status, 400);
    assert.equal(objErrRes.error_code, 'InvalidPart');
  }
});

test('dispatchS3CompleteMultipartUpload fails closed with InvalidPart when storedParts is absent, manifest part ETag is missing/blank, and stored part ETag is missing/blank (OPEN-2 / Finding 2)', () => {
  const validStored = new Map([
    [1, { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
    [2, { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }]
  ]);

  const validManifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }
    ]
  };

  // 1. Positive baseline with valid storedParts and valid ETags passes
  const validRes = dispatchS3CompleteMultipartUpload(validManifest, validStored);
  assert.equal(validRes.http_status, 200);
  assert.equal(validRes.error_code, null);

  // 2. Fails closed with InvalidPart when storedParts is absent (undefined / null)
  const noStoredRes1 = dispatchS3CompleteMultipartUpload(validManifest);
  assert.equal(noStoredRes1.http_status, 400);
  assert.equal(noStoredRes1.error_code, 'InvalidPart');

  const noStoredRes2 = dispatchS3CompleteMultipartUpload(validManifest, null);
  assert.equal(noStoredRes2.http_status, 400);
  assert.equal(noStoredRes2.error_code, 'InvalidPart');

  const noStoredRes3 = dispatchS3CompleteMultipartUpload({ parts: validManifest.parts });
  assert.equal(noStoredRes3.http_status, 400);
  assert.equal(noStoredRes3.error_code, 'InvalidPart');

  // 3. Fails closed with InvalidPart when manifest part ETag is missing/undefined
  const missingManifestEtag = {
    parts: [
      { part_number: 1, size_bytes: 5242880 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }
    ]
  };
  const missingManifestEtagRes = dispatchS3CompleteMultipartUpload(missingManifestEtag, validStored);
  assert.equal(missingManifestEtagRes.http_status, 400);
  assert.equal(missingManifestEtagRes.error_code, 'InvalidPart');

  // 4. Fails closed with InvalidPart when manifest part ETag is empty string or whitespace
  const emptyManifestEtag = {
    parts: [
      { part_number: 1, etag: '', size_bytes: 5242880 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }
    ]
  };
  const emptyManifestEtagRes = dispatchS3CompleteMultipartUpload(emptyManifestEtag, validStored);
  assert.equal(emptyManifestEtagRes.http_status, 400);
  assert.equal(emptyManifestEtagRes.error_code, 'InvalidPart');

  const blankManifestEtag = {
    parts: [
      { part_number: 1, etag: '   ', size_bytes: 5242880 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }
    ]
  };
  const blankManifestEtagRes = dispatchS3CompleteMultipartUpload(blankManifestEtag, validStored);
  assert.equal(blankManifestEtagRes.http_status, 400);
  assert.equal(blankManifestEtagRes.error_code, 'InvalidPart');

  // 5. Fails closed with InvalidPart when stored part ETag is missing/undefined
  const missingStoredEtag = new Map([
    [1, { part_number: 1, size_bytes: 5242880 }],
    [2, { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }]
  ]);
  const missingStoredEtagRes = dispatchS3CompleteMultipartUpload(validManifest, missingStoredEtag);
  assert.equal(missingStoredEtagRes.http_status, 400);
  assert.equal(missingStoredEtagRes.error_code, 'InvalidPart');

  // 6. Fails closed with InvalidPart when stored part ETag is empty string or whitespace
  const emptyStoredEtag = new Map([
    [1, { part_number: 1, etag: '', size_bytes: 5242880 }],
    [2, { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }]
  ]);
  const emptyStoredEtagRes = dispatchS3CompleteMultipartUpload(validManifest, emptyStoredEtag);
  assert.equal(emptyStoredEtagRes.http_status, 400);
  assert.equal(emptyStoredEtagRes.error_code, 'InvalidPart');

  const blankStoredEtag = new Map([
    [1, { part_number: 1, etag: '   ', size_bytes: 5242880 }],
    [2, { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }]
  ]);
  const blankStoredEtagRes = dispatchS3CompleteMultipartUpload(validManifest, blankStoredEtag);
  assert.equal(blankStoredEtagRes.http_status, 400);
  assert.equal(blankStoredEtagRes.error_code, 'InvalidPart');

  // 7. Exact string ETag comparison: no quote stripping / normalization
  const unquotedStoredEtag = new Map([
    [1, { part_number: 1, etag: 'd41d8cd98f00b204e9800998ecf8427e', size_bytes: 5242880 }],
    [2, { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }]
  ]);
  const unquotedRes = dispatchS3CompleteMultipartUpload(validManifest, unquotedStoredEtag);
  assert.equal(unquotedRes.http_status, 400);
  assert.equal(unquotedRes.error_code, 'InvalidPart');
  assert.ok(unquotedRes.reason === 'InvalidETagFormat' || unquotedRes.reason === 'ETagMismatch');

  // 8. No fallback to sha256 when etag is missing on stored part
  const shaOnlyStored = new Map([
    [1, { part_number: 1, sha256: 'd41d8cd98f00b204e9800998ecf8427e00000000000000000000000000000000', size_bytes: 5242880 }],
    [2, { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }]
  ]);
  const shaOnlyStoredRes = dispatchS3CompleteMultipartUpload(validManifest, shaOnlyStored);
  assert.equal(shaOnlyStoredRes.http_status, 400);
  assert.equal(shaOnlyStoredRes.error_code, 'InvalidPart');
  assert.equal(shaOnlyStoredRes.reason, 'MissingStoredPartETag');

  // 9. No fallback to sha256 when etag is missing on manifest part
  const shaOnlyManifest = {
    parts: [
      { part_number: 1, sha256: 'd41d8cd98f00b204e9800998ecf8427e00000000000000000000000000000000', size_bytes: 5242880 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }
    ]
  };
  const shaOnlyManifestRes = dispatchS3CompleteMultipartUpload(shaOnlyManifest, validStored);
  assert.equal(shaOnlyManifestRes.http_status, 400);
  assert.equal(shaOnlyManifestRes.error_code, 'InvalidPart');
  assert.equal(shaOnlyManifestRes.reason, 'MissingManifestPartETag');

  // 10. Empty parts list returns InvalidArgument with EmptyPartsList
  const emptyRes = dispatchS3CompleteMultipartUpload({ parts: [] }, validStored);
  assert.equal(emptyRes.http_status, 400);
  assert.equal(emptyRes.error_code, 'InvalidArgument');
  assert.equal(emptyRes.reason, 'EmptyPartsList');
});

test('dispatchS3PutObject rejects streaming payload sentinel STREAMING-AWS4-HMAC-SHA256-PAYLOAD with HTTP 400 InvalidDigest (Finding 1 / OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_STREAMING_SENTINEL_REJECTION_PAYLOAD');
  const res = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD',
  });
  assert.equal(res.http_status, 400, 'Streaming payload sentinel must return HTTP 400');
  assert.equal(res.error_code, 'InvalidDigest', 'Streaming payload sentinel must return InvalidDigest');
  assert.equal(res.code, 'InvalidDigest');
  assert.equal(res.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');
});

test('dispatchS3CompleteMultipartUpload zero parts returns HTTP 400 InvalidArgument with EmptyPartsList (Finding 2 / OPEN-2)', () => {
  const storedParts = new Map([
    [1, { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
  ]);

  // 1. Empty array manifest.parts returns HTTP 400 InvalidArgument (EmptyPartsList)
  const emptyPartsRes = dispatchS3CompleteMultipartUpload({ parts: [] }, storedParts);
  assert.equal(emptyPartsRes.http_status, 400);
  assert.equal(emptyPartsRes.error_code, 'InvalidArgument');
  assert.equal(emptyPartsRes.reason, 'EmptyPartsList');

  // 2. Direct empty array as argument returns HTTP 400 InvalidArgument (NonPlainPrototypeManifest)
  const directEmptyRes = dispatchS3CompleteMultipartUpload([], storedParts);
  assert.equal(directEmptyRes.http_status, 400);
  assert.equal(directEmptyRes.error_code, 'InvalidArgument');
  assert.equal(directEmptyRes.reason, 'NonPlainPrototypeManifest');
});

test('dispatchS3CompleteMultipartUpload fails with MissingStoredPartETag when stored part has only sha256 but no etag (Finding 3 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    ],
  };
  const storedWithoutEtag = new Map([
    [1, { part_number: 1, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', size_bytes: 5242880 }],
  ]);

  const res = dispatchS3CompleteMultipartUpload(manifest, storedWithoutEtag);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'InvalidPart');
  assert.equal(res.reason, 'MissingStoredPartETag');
});

test('dispatchS3CompleteMultipartUpload fails with InvalidStoredPartShape when stored-part entry is null (Finding 4 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    ],
  };
  const storedWithNullEntry = new Map([
    [1, null],
  ]);

  const res = dispatchS3CompleteMultipartUpload(manifest, storedWithNullEntry);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'InvalidPart');
  assert.equal(res.reason, 'InvalidStoredPartShape');
});

test('dispatchS3CompleteMultipartUpload fails with InvalidETagFormat on unquoted ETags and ETagMismatch on mismatched quoted ETags (Finding 5 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    ],
  };
  const storedUnquoted = new Map([
    [1, { part_number: 1, etag: 'd41d8cd98f00b204e9800998ecf8427e', size_bytes: 5242880 }],
  ]);

  const res = dispatchS3CompleteMultipartUpload(manifest, storedUnquoted);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'InvalidPart');
  assert.ok(res.reason === 'InvalidETagFormat' || res.reason === 'ETagMismatch');

  // Also test manifest unquoted vs stored quoted
  const manifestUnquoted = {
    parts: [
      { part_number: 1, etag: 'd41d8cd98f00b204e9800998ecf8427e', size_bytes: 5242880 },
    ],
  };
  const storedQuoted = new Map([
    [1, { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
  ]);
  const res2 = dispatchS3CompleteMultipartUpload(manifestUnquoted, storedQuoted);
  assert.equal(res2.http_status, 400);
  assert.equal(res2.error_code, 'InvalidPart');
  assert.ok(res2.reason === 'InvalidETagFormat' || res2.reason === 'ETagMismatch');

  // Mismatched quoted ETags return ETagMismatch
  const storedMismatchedQuoted = new Map([
    [1, { part_number: 1, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }],
  ]);
  const res3 = dispatchS3CompleteMultipartUpload(manifest, storedMismatchedQuoted);
  assert.equal(res3.http_status, 400);
  assert.equal(res3.error_code, 'InvalidPart');
  assert.equal(res3.reason, 'ETagMismatch');
});

test('dispatchS3PutObject and dispatchS3CompleteMultipartUpload positional calling and additional option variants', () => {
  const payload = Buffer.from('TEST_PAYLOAD');
  const validMd5 = computePayloadMd5(payload);
  const validSha = computePayloadSha256(payload);

  // Positional dispatchS3PutObject
  assert.equal(dispatchS3PutObject(payload, validMd5, validSha).http_status, 200);
  assert.equal(dispatchS3PutObject(payload, 'bad-md5').http_status, 400);

  // dispatchS3CompleteMultipartUpload with manifest wrapper object
  const manifestWrap = {
    manifest: {
      parts: [
        { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
      ],
    },
    storedParts: new Map([[1, { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }]]),
  };
  assert.equal(dispatchS3CompleteMultipartUpload(manifestWrap).http_status, 200);

  // dispatchS3CompleteMultipartUpload with non-object/null first argument
  assert.equal(dispatchS3CompleteMultipartUpload(null).http_status, 400);
  assert.equal(dispatchS3CompleteMultipartUpload(undefined).http_status, 400);
  assert.equal(dispatchS3CompleteMultipartUpload(12345).http_status, 400);

  // dispatchS3Error object branches without error_code
  assert.equal(dispatchS3Error({ reason: 'EmptyPartsList' }).error_code, 'InvalidArgument');
  assert.equal(dispatchS3Error({ reason: 'INVALID_ARGUMENT' }).error_code, 'InvalidArgument');
});

test('strict PutObject SHA256 validation, safe storedParts array lookup, multipart bounds, and error mappings (OPEN-2 Findings 1, 2, 3)', () => {
  const payload = Buffer.from('TEST_IMMUTABLE_STORAGE_BOUNDS_AND_HASH');
  const validSha = computePayloadSha256(payload);

  // 1. Strict lowercase SHA256 validation
  const upperSha = validSha.toUpperCase();
  const upperRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': upperSha });
  assert.equal(upperRes.http_status, 400);
  assert.equal(upperRes.error_code, 'InvalidDigest');

  const nonHexRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': 'g'.repeat(64) });
  assert.equal(nonHexRes.http_status, 400);
  assert.equal(nonHexRes.error_code, 'InvalidDigest');

  const mismatchShaRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': '0'.repeat(64) });
  assert.equal(mismatchShaRes.http_status, 400);
  assert.equal(mismatchShaRes.error_code, 'BadDigest');

  // 2. Safe storedParts array lookup with holes / undefined / null elements
  const storedArrayWithHoles = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    null,
    undefined,
    { part_number: 3, etag: '"1a79a4d60de6718e8e5b326e338ae533"', size_bytes: 5242880 },
  ];
  const manifestHoles = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' },
    ],
  };
  const holesRes = dispatchS3CompleteMultipartUpload(manifestHoles, storedArrayWithHoles);
  assert.equal(holesRes.http_status, 400);
  assert.equal(holesRes.error_code, 'InvalidPart');

  // Max 10,000 parts limit
  const over10kParts = Array.from({ length: 10001 }, (_, i) => ({
    part_number: i + 1,
    etag: '"d41d8cd98f00b204e9800998ecf8427e"',
    size_bytes: 5242880,
  }));
  const tooManyRes = dispatchS3CompleteMultipartUpload({ parts: over10kParts }, storedArrayWithHoles);
  assert.equal(tooManyRes.http_status, 400);
  assert.equal(tooManyRes.error_code, 'InvalidArgument');

  // 3. Part number range check: part_number < 1 or > 10000 -> InvalidPartNumber / InvalidArgument
  const zeroPartNumRes = dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 0, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }] }, storedArrayWithHoles);
  assert.equal(zeroPartNumRes.http_status, 400);
  assert.equal(zeroPartNumRes.error_code, 'InvalidArgument');

  const over10kPartNumRes = dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 10001, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }] }, storedArrayWithHoles);
  assert.equal(over10kPartNumRes.http_status, 400);
  assert.equal(over10kPartNumRes.error_code, 'InvalidArgument');

  // 4. Part size exceeding 5 GiB -> EntityTooLarge / PartSizeExceeded
  const storedOver5GiB = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5 * 1024 * 1024 * 1024 + 1 },
  ];
  const manifestOver5GiB = {
    parts: [{ part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }],
  };
  const partSizeExceededRes = dispatchS3CompleteMultipartUpload(manifestOver5GiB, storedOver5GiB);
  assert.equal(partSizeExceededRes.http_status, 400);
  assert.equal(partSizeExceededRes.error_code, 'EntityTooLarge');

  // 5. Total size exceeding 5 TiB -> EntityTooLarge / TotalSizeExceeded
  const parts5TiB = Array.from({ length: 1025 }, (_, i) => ({
    part_number: i + 1,
    etag: '"d41d8cd98f00b204e9800998ecf8427e"',
    size: 5 * 1024 * 1024 * 1024, // 5 GiB each * 1025 = 5.00488 TiB > 5 TiB
  }));
  const storedParts5TiB = parts5TiB.map(p => ({ part_number: p.part_number, etag: p.etag, size_bytes: p.size }));
  const totalSizeExceededRes = dispatchS3CompleteMultipartUpload({ parts: parts5TiB }, storedParts5TiB);
  assert.equal(totalSizeExceededRes.http_status, 400);
  assert.equal(totalSizeExceededRes.error_code, 'EntityTooLarge');

  // --- dispatchS3Error mapping verification ---
  const reasonsToTest = [
    { reason: 'MissingXAmzContentSHA256', code: 'InvalidDigest', status: 400 },
    { reason: 'TooManyParts', code: 'InvalidArgument', status: 400 },
    { reason: 'InvalidPartNumber', code: 'InvalidArgument', status: 400 },
    { reason: 'PartSizeExceeded', code: 'EntityTooLarge', status: 400 },
    { reason: 'TotalSizeExceeded', code: 'EntityTooLarge', status: 400 },
  ];

  for (const { reason, code, status } of reasonsToTest) {
    // String trigger
    const strRes = dispatchS3Error(reason);
    assert.equal(strRes.http_status, status, `String trigger ${reason} status`);
    assert.equal(strRes.error_code, code, `String trigger ${reason} code`);
    assert.equal(strRes.reason, reason, `String trigger ${reason} reason`);

    // Object trigger with reason
    const objRes = dispatchS3Error({ reason });
    assert.equal(objRes.http_status, status, `Object trigger ${reason} status`);
    assert.equal(objRes.error_code, code, `Object trigger ${reason} code`);
  }
});

test('dispatchS3PutObject without x-amz-content-sha256 returns HTTP 400 InvalidDigest even with valid MD5 (Finding 1 / OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_IMMUTABLE_PUTOBJECT_PAYLOAD_NO_SHA256_TEST_2026');
  const validMd5 = computePayloadMd5(payload);

  // 1. PutObject with valid MD5 but omitted x-amz-content-sha256 returns HTTP 400 InvalidDigest
  const resNoSha = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: validMd5,
  });
  assert.equal(resNoSha.http_status, 400);
  assert.equal(resNoSha.error_code, 'InvalidDigest');
  assert.equal(resNoSha.code, 'InvalidDigest');

  // 2. PutObject with null x-amz-content-sha256 returns HTTP 400 InvalidDigest
  const resNullSha = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': null,
  });
  assert.equal(resNullSha.http_status, 400);
  assert.equal(resNullSha.error_code, 'InvalidDigest');

  // 3. PutObject with non-string x-amz-content-sha256 returns HTTP 400 InvalidDigest
  const resNonStringSha = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': 12345,
  });
  assert.equal(resNonStringSha.http_status, 400);
  assert.equal(resNonStringSha.error_code, 'InvalidDigest');
});

test('dispatchS3PutObject with uppercase SHA-256 returns HTTP 400 InvalidDigest (Finding 1 / OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_IMMUTABLE_PUTOBJECT_PAYLOAD_UPPERCASE_SHA256_2026');
  const validSha256 = computePayloadSha256(payload);
  const uppercaseSha256 = validSha256.toUpperCase();
  assert.notEqual(validSha256, uppercaseSha256, 'Test payload SHA-256 must contain hex characters that differ when uppercased');

  // 1. PutObject with uppercase SHA-256 returns HTTP 400 InvalidDigest
  const resUpper = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': uppercaseSha256,
  });
  assert.equal(resUpper.http_status, 400);
  assert.equal(resUpper.error_code, 'InvalidDigest');
  assert.equal(resUpper.code, 'InvalidDigest');

  // 2. Mixed-case SHA-256 returns HTTP 400 InvalidDigest
  const mixedCaseSha256 = validSha256.slice(0, 32).toUpperCase() + validSha256.slice(32).toLowerCase();
  const resMixed = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': mixedCaseSha256,
  });
  assert.equal(resMixed.http_status, 400);
  assert.equal(resMixed.error_code, 'InvalidDigest');

  // 3. Helper isMalformedSha256 rejects uppercase SHA-256
  assert.equal(isMalformedSha256(uppercaseSha256), true);
  assert.equal(isMalformedSha256(mixedCaseSha256), true);
});

test('dispatchS3PutObject with whitespace-padded SHA-256 returns HTTP 400 InvalidDigest (Finding 1 / OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_IMMUTABLE_PUTOBJECT_PAYLOAD_WHITESPACE_SHA256_2026');
  const validSha256 = computePayloadSha256(payload);

  // 1. PutObject with leading & trailing whitespace returns HTTP 400 InvalidDigest
  const resPadded = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': `  ${validSha256}  `,
  });
  assert.equal(resPadded.http_status, 400);
  assert.equal(resPadded.error_code, 'InvalidDigest');
  assert.equal(resPadded.code, 'InvalidDigest');

  // 2. PutObject with leading tab returns HTTP 400 InvalidDigest
  const resLeadingTab = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': `\t${validSha256}`,
  });
  assert.equal(resLeadingTab.http_status, 400);
  assert.equal(resLeadingTab.error_code, 'InvalidDigest');

  // 3. PutObject with trailing newline returns HTTP 400 InvalidDigest
  const resTrailingNl = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': `${validSha256}\n`,
  });
  assert.equal(resTrailingNl.http_status, 400);
  assert.equal(resTrailingNl.error_code, 'InvalidDigest');

  // 4. Helper isMalformedSha256 rejects whitespace-padded SHA-256
  assert.equal(isMalformedSha256(` ${validSha256} `), true);
  assert.equal(isMalformedSha256(`\t${validSha256}`), true);
  assert.equal(isMalformedSha256(`${validSha256}\n`), true);
});

test('dispatchS3CompleteMultipartUpload with storedParts = [null] or {1: null} returns HTTP 400 InvalidPart (InvalidStoredPartShape) without throwing TypeError (Finding 2 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    ],
  };

  // 1. Array with null entry: storedParts = [null]
  assert.doesNotThrow(() => {
    const resArrayNull = dispatchS3CompleteMultipartUpload(manifest, [null]);
    assert.equal(resArrayNull.http_status, 400);
    assert.equal(resArrayNull.error_code, 'InvalidPart');
    assert.equal(resArrayNull.code, 'InvalidPart');
    assert.equal(resArrayNull.reason, 'InvalidStoredPartShape');
  });

  // 2. Object with null entry: storedParts = { 1: null }
  assert.doesNotThrow(() => {
    const resObjNull = dispatchS3CompleteMultipartUpload(manifest, { 1: null });
    assert.equal(resObjNull.http_status, 400);
    assert.equal(resObjNull.error_code, 'InvalidPart');
    assert.equal(resObjNull.code, 'InvalidPart');
    assert.equal(resObjNull.reason, 'InvalidStoredPartShape');
  });

  // 3. Multi-element array with null entries and mixed valid entries
  assert.doesNotThrow(() => {
    const multiManifest = {
      parts: [
        { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
        { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
      ],
    };
    const resMultiArray = dispatchS3CompleteMultipartUpload(multiManifest, [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
      null,
    ]);
    assert.equal(resMultiArray.http_status, 400);
    assert.equal(resMultiArray.error_code, 'InvalidPart');
    assert.equal(resMultiArray.reason, 'InvalidStoredPartShape');
  });

  // 4. Object with undefined or null entries across multiple part keys
  assert.doesNotThrow(() => {
    const multiManifest = {
      parts: [
        { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
        { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
      ],
    };
    const resMultiObj = dispatchS3CompleteMultipartUpload(multiManifest, {
      1: { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
      2: null,
    });
    assert.equal(resMultiObj.http_status, 400);
    assert.equal(resMultiObj.error_code, 'InvalidPart');
    assert.equal(resMultiObj.reason, 'InvalidStoredPartShape');
  });
});

test('dispatchS3CompleteMultipartUpload with part_number = 10001 returns HTTP 400 InvalidArgument (Finding 3 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 10001, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    ],
  };
  const storedParts = new Map([
    [10001, { part_number: 10001, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
  ]);

  const res = dispatchS3CompleteMultipartUpload(manifest, storedParts);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'InvalidArgument');
  assert.equal(res.code, 'InvalidArgument');

  // Semantic validation also throws InvalidArgument
  assert.throws(
    () => validateS3MultipartSemantics({
      parts: [{ part_number: 10001, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880, sha256: 'a'.repeat(64) }],
      total_parts: 1,
      total_size_bytes: 5242880,
    }),
    /InvalidArgument/
  );
});

test('dispatchS3CompleteMultipartUpload with 10,001 parts returns HTTP 400 InvalidArgument (Finding 3 / OPEN-2)', () => {
  const partCount = 10001;
  const parts = Array.from({ length: partCount }, (_, i) => ({
    part_number: i + 1,
    etag: `"${createHash('md5').update(String(i + 1)).digest('hex')}"`,
    size_bytes: 5242880,
  }));

  const manifest = {
    parts,
    total_parts: partCount,
  };

  const storedMap = new Map(parts.map((p) => [p.part_number, p]));

  const res = dispatchS3CompleteMultipartUpload(manifest, storedMap);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'InvalidArgument');
  assert.equal(res.code, 'InvalidArgument');

  // Semantic validator also rejects > 10000 parts with InvalidArgument
  assert.throws(
    () => validateS3MultipartSemantics({
      parts: parts.map((p) => ({ ...p, sha256: 'a'.repeat(64) })),
      total_parts: partCount,
      total_size_bytes: partCount * 5242880,
    }),
    /InvalidArgument/
  );
});

test('dispatchS3CompleteMultipartUpload with 1,025 x 5 GiB parts (total > 5 TiB) returns HTTP 400 EntityTooLarge (Finding 3 / OPEN-2)', () => {
  const FIVE_GIB = 5 * 1024 * 1024 * 1024; // 5,368,709,120 bytes
  const partCount = 1025; // 1,025 * 5 GiB = 5,502,926,848,000 bytes > 5,497,558,138,880 bytes (5 TiB)

  const parts = Array.from({ length: partCount }, (_, i) => ({
    part_number: i + 1,
    etag: `"${createHash('md5').update(String(i + 1)).digest('hex')}"`,
    size_bytes: FIVE_GIB,
  }));

  const totalSizeBytes = partCount * FIVE_GIB;
  const manifest = {
    parts,
    total_parts: partCount,
    total_size_bytes: totalSizeBytes,
  };

  const storedMap = new Map(parts.map((p) => [p.part_number, p]));

  const res = dispatchS3CompleteMultipartUpload(manifest, storedMap);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'EntityTooLarge');
  assert.equal(res.code, 'EntityTooLarge');

  // Semantic validator also rejects total_size > 5 TiB with EntityTooLarge
  assert.throws(
    () => validateS3MultipartSemantics({
      parts: parts.map((p) => ({ ...p, sha256: 'a'.repeat(64) })),
      total_parts: partCount,
      total_size_bytes: totalSizeBytes,
    }),
    /EntityTooLarge/
  );
});

test('dispatchS3PutObject and verify helpers branch coverage for property aliases and options', () => {
  const payload = Buffer.from('CYBRIK_PROPERTY_ALIAS_TEST_PAYLOAD');
  const validMd5 = computePayloadMd5(payload);
  const validSha = computePayloadSha256(payload);

  // Property aliases for MD5 and SHA256
  assert.equal(dispatchS3PutObject({ payload, content_md5_header: validMd5, x_amz_content_sha256: validSha }).http_status, 200);
  assert.equal(dispatchS3PutObject({ body: payload, contentMd5: validMd5, contentSha256Header: validSha }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, 'Content-MD5': validMd5, xAmzContentSha256: validSha }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, content_md5: validMd5, sha256Header: validSha }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: validMd5, content_sha256_header: validSha }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: validMd5, contentSha256: validSha }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: validMd5, 'X-Amz-Content-Sha256': validSha }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: validMd5, headers: { 'x-amz-content-sha256': validSha } }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: validMd5, headers: { 'X-Amz-Content-Sha256': validSha } }).http_status, 200);

  // verifyDigestErrorDispatch condition object forms
  assert.equal(verifyDigestErrorDispatch({ error_code: 'BadDigest', http_status: 400 }).error_code, 'BadDigest');
  assert.equal(verifyDigestErrorDispatch({ code: 'BadDigest', status: 400 }).error_code, 'BadDigest');
  assert.equal(verifyDigestErrorDispatch('BadDigest').error_code, 'BadDigest');

  // verifyMalformedHeaderDispatch condition object forms
  assert.equal(verifyMalformedHeaderDispatch({ error_code: 'InvalidDigest', http_status: 400 }).error_code, 'InvalidDigest');
  assert.equal(verifyMalformedHeaderDispatch({ code: 'InvalidDigest', status: 400 }).error_code, 'InvalidDigest');
  assert.equal(verifyMalformedHeaderDispatch('MALFORMED_HEADER_SYNTAX').error_code, 'InvalidDigest');

  assert.throws(
    () => verifyDigestErrorDispatch({ code: 'WrongCode' }),
    /Strict error dispatch violation/
  );
  assert.throws(
    () => verifyDigestErrorDispatch({ status: 500 }),
    /Strict error dispatch violation/
  );
  assert.throws(
    () => verifyMalformedHeaderDispatch({ code: 'WrongCode' }),
    /Strict error dispatch violation/
  );
  assert.throws(
    () => verifyMalformedHeaderDispatch({ status: 500 }),
    /Strict error dispatch violation/
  );
});

test('dispatchS3CompleteMultipartUpload with genuinely sparse storedParts array returns HTTP 400 InvalidPart (MissingStoredPartETag) without throwing TypeError (Finding 2 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
    ],
  };

  // Case A: Sparse array created via index assignment (sparse = []; sparse[5] = ...)
  const sparse = [];
  sparse[5] = { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 };

  assert.doesNotThrow(() => {
    const res = dispatchS3CompleteMultipartUpload(manifest, sparse);
    assert.equal(res.http_status, 400);
    assert.equal(res.error_code, 'InvalidPart');
    assert.equal(res.code, 'InvalidPart');
    assert.equal(res.reason, 'MissingStoredPartETag');
  });

  // Case B: Sparse array created via Array constructor with empty slots (arr = new Array(3); arr[1] = ...)
  const arr = new Array(3);
  arr[1] = { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 };

  assert.doesNotThrow(() => {
    const res = dispatchS3CompleteMultipartUpload(manifest, arr);
    assert.equal(res.http_status, 400);
    assert.equal(res.error_code, 'InvalidPart');
    assert.equal(res.code, 'InvalidPart');
    assert.equal(res.reason, 'MissingStoredPartETag');
  });

  // Case C: Single part manifest requesting part 1, sparse array only has index 5 with part 2
  const singleManifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    ],
  };
  const sparseOnlyPart2 = [];
  sparseOnlyPart2[5] = { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 };

  assert.doesNotThrow(() => {
    const res = dispatchS3CompleteMultipartUpload(singleManifest, sparseOnlyPart2);
    assert.equal(res.http_status, 400);
    assert.equal(res.error_code, 'InvalidPart');
    assert.equal(res.code, 'InvalidPart');
    assert.equal(res.reason, 'MissingStoredPartETag');
  });
});

test('dispatchS3CompleteMultipartUpload with negative final-part size returns HTTP 400 InvalidPart (InvalidPartSize) (Finding 1 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size: -1 },
    ],
  };
  const stored = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size: -1 },
  ];

  const res = dispatchS3CompleteMultipartUpload(manifest, stored);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'InvalidPart');
  assert.equal(res.code, 'InvalidPart');
  assert.equal(res.reason, 'InvalidPartSize');

  // Also verify storedPart size_bytes negative
  const storedBytes = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: -100 },
  ];
  const resBytes = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }] },
    storedBytes
  );
  assert.equal(resBytes.http_status, 400);
  assert.equal(resBytes.error_code, 'InvalidPart');
  assert.equal(resBytes.reason, 'InvalidPartSize');
});

test('dispatchS3CompleteMultipartUpload with string size returns HTTP 400 InvalidPart (InvalidPartSize) (Finding 1 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size: "9999999999" },
    ],
  };
  const stored = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size: "9999999999" },
  ];

  const res = dispatchS3CompleteMultipartUpload(manifest, stored);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'InvalidPart');
  assert.equal(res.code, 'InvalidPart');
  assert.equal(res.reason, 'InvalidPartSize');

  // Also verify string size_bytes in storedPart
  const resStoredStr = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }] },
    [{ part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: "5242880" }]
  );
  assert.equal(resStoredStr.http_status, 400);
  assert.equal(resStoredStr.error_code, 'InvalidPart');
  assert.equal(resStoredStr.reason, 'InvalidPartSize');
});

test('dispatchS3CompleteMultipartUpload with non-final part < 5 MiB returns HTTP 400 EntityTooSmall (Finding 5 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 1024 }, // 1 KiB < 5 MiB
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
    ],
  };
  const stored = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 1024 },
    { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
  ];

  const res = dispatchS3CompleteMultipartUpload(manifest, stored);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'EntityTooSmall');
  assert.equal(res.code, 'EntityTooSmall');
  assert.equal(res.reason, 'NON_FINAL_PART_TOO_SMALL');

  // Also verify with size property
  const resSizeProp = dispatchS3CompleteMultipartUpload(
    {
      parts: [
        { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size: 5242879 },
        { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size: 5242880 },
      ],
    },
    [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size: 5242879 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size: 5242880 },
    ]
  );
  assert.equal(resSizeProp.http_status, 400);
  assert.equal(resSizeProp.error_code, 'EntityTooSmall');
  assert.equal(resSizeProp.code, 'EntityTooSmall');
});

test('dispatchS3Error coverage for InvalidPartSize, INVALID_PART_SIZE, and XAmzContentSHA256Mismatch (Finding 1 & 2 / OPEN-2)', () => {
  assert.equal(dispatchS3Error('InvalidPartSize').error_code, 'InvalidPart');
  assert.equal(dispatchS3Error('InvalidPartSize').reason, 'InvalidPartSize');
  assert.equal(dispatchS3Error('INVALID_PART_SIZE').error_code, 'InvalidPart');
  assert.equal(dispatchS3Error('INVALID_PART_SIZE').reason, 'InvalidPartSize');

  assert.equal(dispatchS3Error({ code: 'InvalidPart', reason: 'InvalidPartSize' }).error_code, 'InvalidPart');
  assert.equal(dispatchS3Error({ reason: 'InvalidPartSize' }).reason, 'InvalidPartSize');
  assert.equal(dispatchS3Error({ code: 'InvalidPart', reason: 'INVALID_PART_SIZE' }).error_code, 'InvalidPart');
  assert.equal(dispatchS3Error({ reason: 'INVALID_PART_SIZE' }).reason, 'InvalidPartSize');

  assert.equal(dispatchS3Error('XAmzContentSHA256Mismatch').error_code, 'BadDigest');
  assert.equal(dispatchS3Error('XAmzContentSHA256Mismatch').reason, 'XAmzContentSHA256Mismatch');
  assert.equal(dispatchS3Error({ reason: 'XAmzContentSHA256Mismatch' }).error_code, 'BadDigest');
  assert.equal(dispatchS3Error({ reason: 'XAmzContentSHA256Mismatch' }).reason, 'XAmzContentSHA256Mismatch');
});

test('dispatchS3CompleteMultipartUpload enforces stored part size and rejects missing stored size and manifest-only size with InvalidPartSize (Finding 1 / OPEN-2)', () => {
  // 1. Missing stored part size (sp = { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }) returns HTTP 400 InvalidPart (InvalidPartSize)
  const manifestNoSize = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
    ],
  };
  const storedNoSize = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
  ];
  const resNoSize = dispatchS3CompleteMultipartUpload(manifestNoSize, storedNoSize);
  assert.equal(resNoSize.http_status, 400);
  assert.equal(resNoSize.error_code, 'InvalidPart');
  assert.equal(resNoSize.code, 'InvalidPart');
  assert.equal(resNoSize.reason, 'InvalidPartSize');

  // Also test with Map
  const storedMapNoSize = new Map([
    [1, { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }],
  ]);
  const resMapNoSize = dispatchS3CompleteMultipartUpload(manifestNoSize, storedMapNoSize);
  assert.equal(resMapNoSize.http_status, 400);
  assert.equal(resMapNoSize.error_code, 'InvalidPart');
  assert.equal(resMapNoSize.reason, 'InvalidPartSize');

  // Also test with Object
  const storedObjNoSize = {
    1: { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
  };
  const resObjNoSize = dispatchS3CompleteMultipartUpload(manifestNoSize, storedObjNoSize);
  assert.equal(resObjNoSize.http_status, 400);
  assert.equal(resObjNoSize.error_code, 'InvalidPart');
  assert.equal(resObjNoSize.reason, 'InvalidPartSize');

  // 2. Manifest-only size: manifest has size_bytes but stored part has no size (sp = { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' }) -> returns HTTP 400 InvalidPart (InvalidPartSize)
  const manifestWithSize = {
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    ],
  };
  const resManifestOnlySize = dispatchS3CompleteMultipartUpload(manifestWithSize, storedNoSize);
  assert.equal(resManifestOnlySize.http_status, 400);
  assert.equal(resManifestOnlySize.error_code, 'InvalidPart');
  assert.equal(resManifestOnlySize.code, 'InvalidPart');
  assert.equal(resManifestOnlySize.reason, 'InvalidPartSize');

  const resManifestOnlySizeMap = dispatchS3CompleteMultipartUpload(manifestWithSize, storedMapNoSize);
  assert.equal(resManifestOnlySizeMap.http_status, 400);
  assert.equal(resManifestOnlySizeMap.error_code, 'InvalidPart');
  assert.equal(resManifestOnlySizeMap.reason, 'InvalidPartSize');

  const resManifestOnlySizeObj = dispatchS3CompleteMultipartUpload(manifestWithSize, storedObjNoSize);
  assert.equal(resManifestOnlySizeObj.http_status, 400);
  assert.equal(resManifestOnlySizeObj.error_code, 'InvalidPart');
  assert.equal(resManifestOnlySizeObj.reason, 'InvalidPartSize');

  // 3. Positive comparison: when stored part HAS valid size, completion succeeds
  const storedWithSize = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
  ];
  const resValidStoredSize = dispatchS3CompleteMultipartUpload(manifestWithSize, storedWithSize);
  assert.equal(resValidStoredSize.http_status, 200);
  assert.equal(resValidStoredSize.error_code, null);
});

test('dispatchS3PutObject with nested headers: { "Content-MD5": base64Md5 } correctly validates payload MD5 (Finding 2 / OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_TEST_NESTED_HEADERS_MD5_EXTRACTION_2026');
  const validMd5 = computePayloadMd5(payload);
  const invalidMd5 = computePayloadMd5(Buffer.from('DIFFERENT_PAYLOAD_BYTES'));
  const malformedMd5 = 'not-valid-base64!';

  // 1. Matching MD5 in nested headers passes with HTTP 200
  const validRes = dispatchS3PutObject({
    payloadBytes: payload,
    headers: { 'Content-MD5': validMd5 },
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  });
  assert.equal(validRes.http_status, 200);
  assert.equal(validRes.error_code, null);

  // Also verify lowercase header key 'content-md5' in nested headers
  const validLowerRes = dispatchS3PutObject({
    payloadBytes: payload,
    headers: { 'content-md5': validMd5 },
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  });
  assert.equal(validLowerRes.http_status, 200);
  assert.equal(validLowerRes.error_code, null);

  // 2. Mismatched MD5 in nested headers returns HTTP 400 BadDigest (PAYLOAD_DIGEST_MISMATCH)
  const mismatchRes = dispatchS3PutObject({
    payloadBytes: payload,
    headers: { 'Content-MD5': invalidMd5 },
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  });
  assert.equal(mismatchRes.http_status, 400);
  assert.equal(mismatchRes.error_code, 'BadDigest');
  assert.equal(mismatchRes.reason, 'PAYLOAD_DIGEST_MISMATCH');

  // 3. Malformed base64 MD5 in nested headers returns HTTP 400 InvalidDigest (MALFORMED_HEADER_SYNTAX)
  const malformedRes = dispatchS3PutObject({
    payloadBytes: payload,
    headers: { 'Content-MD5': malformedMd5 },
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  });
  assert.equal(malformedRes.http_status, 400);
  assert.equal(malformedRes.error_code, 'InvalidDigest');
  assert.equal(malformedRes.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('dispatchS3Error("XAmzContentSHA256Mismatch") returns BadDigest (Finding 4 / OPEN-2)', () => {
  // String argument
  const strRes = dispatchS3Error('XAmzContentSHA256Mismatch');
  assert.equal(strRes.http_status, 400);
  assert.equal(strRes.error_code, 'BadDigest');
  assert.equal(strRes.status, 400);
  assert.equal(strRes.code, 'BadDigest');
  assert.equal(strRes.reason, 'XAmzContentSHA256Mismatch');

  // Object arguments
  const objReasonRes = dispatchS3Error({ reason: 'XAmzContentSHA256Mismatch' });
  assert.equal(objReasonRes.http_status, 400);
  assert.equal(objReasonRes.error_code, 'BadDigest');
  assert.equal(objReasonRes.status, 400);
  assert.equal(objReasonRes.code, 'BadDigest');
  assert.equal(objReasonRes.reason, 'XAmzContentSHA256Mismatch');

  const objConditionRes = dispatchS3Error({ error_condition: 'XAmzContentSHA256Mismatch' });
  assert.equal(objConditionRes.http_status, 400);
  assert.equal(objConditionRes.error_code, 'BadDigest');
  assert.equal(objConditionRes.reason, 'XAmzContentSHA256Mismatch');
});

test('negative storage fixtures executed through dispatcher match error_code and error_condition (Finding 5 / OPEN-2)', () => {
  const negativeFiles = readdirSync(join(EXAMPLES_STORAGE_DIR, 'negative')).filter((f) =>
    f.endsWith('.json')
  );

  for (const file of negativeFiles) {
    const filePath = join(EXAMPLES_STORAGE_DIR, 'negative', file);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

    if (EXPECTED_STORAGE_DISPATCH_NEGATIVES[file]) {
      const exp = EXPECTED_STORAGE_DISPATCH_NEGATIVES[file];
      const dispatched = dispatchS3Error(data);

      assert.equal(dispatched.http_status, exp.http_status, `HTTP status mismatch for ${file}`);
      assert.equal(dispatched.error_code, exp.error_code, `Error code mismatch for ${file}`);
      assert.equal(dispatched.code, exp.error_code, `Code mismatch for ${file}`);
      assert.equal(
        dispatched.reason,
        exp.error_condition,
        `Condition mismatch for ${file}: expected ${exp.error_condition}, got ${dispatched.reason}`
      );
      assert.equal(data.expected_error.error_code, exp.error_code);
      assert.equal(data.expected_error.error_condition, exp.error_condition);
    }
  }
});

test('dispatchS3CompleteMultipartUpload sparse array lookup prevents prototype poisoning when Array.prototype has part numbers', () => {
  // Setup: Poison Array.prototype with a valid part object at index 1
  Array.prototype[1] = {
    part_number: 1,
    etag: '"d41d8cd98f00b204e9800998ecf8427e"',
    size_bytes: 5242880,
  };

  try {
    const manifest = {
      parts: [
        { part_number: 1, etag: '"098f6bcd4621d373cade4e832627b4f6"' },
      ],
    };

    // Case 1: Sparse array with empty slot at index 0 and 1
    // Array(2) has length 2, but neither index 0 nor 1 is an own property
    const sparseArr = new Array(2);
    const resSparse = dispatchS3CompleteMultipartUpload(manifest, sparseArr);
    assert.equal(resSparse.http_status, 400);
    assert.equal(resSparse.error_code, 'InvalidPart');
    assert.equal(resSparse.code, 'InvalidPart');
    assert.equal(resSparse.reason, 'MissingStoredPartETag');

    // Case 2: Array where slot 0 is populated but slot 1 is a hole
    const partialArr = [{ part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 }];
    partialArr.length = 2; // slot 1 is a hole, should NOT pick up Array.prototype[1]
    const resPartial = dispatchS3CompleteMultipartUpload(manifest, partialArr);
    assert.equal(resPartial.http_status, 400);
    assert.equal(resPartial.error_code, 'InvalidPart');
    assert.equal(resPartial.reason, 'MissingStoredPartETag');

    // Case 3: Array where element at index 1 was deleted
    const deletedArr = [
      { part_number: 0, etag: '"00000000000000000000000000000000"', size_bytes: 5242880 },
      { part_number: 1, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
    ];
    delete deletedArr[1];
    const resDeleted = dispatchS3CompleteMultipartUpload(manifest, deletedArr);
    assert.equal(resDeleted.http_status, 400);
    assert.equal(resDeleted.error_code, 'InvalidPart');
    assert.equal(resDeleted.code, 'InvalidPart');
    assert.equal(resDeleted.reason, 'MissingStoredPartETag');

    // Case 4: Object inheriting prototype properties without own property
    const inheritedObj = Object.create({ 1: { part_number: 1, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 } });
    const resInheritedObj = dispatchS3CompleteMultipartUpload(manifest, inheritedObj);
    assert.equal(resInheritedObj.http_status, 400);
    assert.equal(resInheritedObj.error_code, 'InvalidPart');
    assert.equal(resInheritedObj.reason, 'NonPlainPrototypeStoredPart');
  } finally {
    delete Array.prototype[1];
  }
});

test('dispatchS3PutObject with non-object headers value (e.g. headers: "invalid", headers: 123, headers: null) returns HTTP 400 InvalidDigest', () => {
  const payload = Buffer.from('CYBRIK_PUT_OBJECT_HOSTILE_HEADERS_TEST_2026');

  // Case 1: headers is string ('invalid')
  const resStr = dispatchS3PutObject({
    payloadBytes: payload,
    headers: 'invalid',
  });
  assert.equal(resStr.http_status, 400);
  assert.equal(resStr.error_code, 'InvalidDigest');
  assert.equal(resStr.status, 400);
  assert.equal(resStr.code, 'InvalidDigest');

  // Case 2: headers is number (123)
  const resNum = dispatchS3PutObject({
    payloadBytes: payload,
    headers: 123,
  });
  assert.equal(resNum.http_status, 400);
  assert.equal(resNum.error_code, 'InvalidDigest');
  assert.equal(resNum.status, 400);
  assert.equal(resNum.code, 'InvalidDigest');

  // Case 3: headers is null
  const resNull = dispatchS3PutObject({
    payloadBytes: payload,
    headers: null,
  });
  assert.equal(resNull.http_status, 400);
  assert.equal(resNull.error_code, 'InvalidDigest');
  assert.equal(resNull.status, 400);
  assert.equal(resNull.code, 'InvalidDigest');

  // Case 4: headers is boolean (true / false)
  const resBool = dispatchS3PutObject({
    payloadBytes: payload,
    headers: true,
  });
  assert.equal(resBool.http_status, 400);
  assert.equal(resBool.error_code, 'InvalidDigest');

  const resBoolFalse = dispatchS3PutObject({
    payloadBytes: payload,
    headers: false,
  });
  assert.equal(resBoolFalse.http_status, 400);
  assert.equal(resBoolFalse.error_code, 'InvalidDigest');

  // Case 5: headers is array ([])
  const resArr = dispatchS3PutObject({
    payloadBytes: payload,
    headers: [],
  });
  assert.equal(resArr.http_status, 400);
  assert.equal(resArr.error_code, 'InvalidDigest');

  // Case 6: headers is string even if top-level valid sha256 is present
  const resStrWithSha = dispatchS3PutObject({
    payloadBytes: payload,
    headers: 'hostile-header-string',
    'x-amz-content-sha256': computePayloadSha256(payload),
  });
  assert.equal(resStrWithSha.http_status, 400);
  assert.equal(resStrWithSha.error_code, 'InvalidDigest');
  assert.equal(resStrWithSha.reason, 'MALFORMED_HEADER_SYNTAX');

  // Case 7: headers is number even if top-level valid sha256 is present
  const resNumWithSha = dispatchS3PutObject({
    payloadBytes: payload,
    headers: 42,
    'x-amz-content-sha256': computePayloadSha256(payload),
  });
  assert.equal(resNumWithSha.http_status, 400);
  assert.equal(resNumWithSha.error_code, 'InvalidDigest');
  assert.equal(resNumWithSha.reason, 'MALFORMED_HEADER_SYNTAX');

  // Case 8: headers in dispatchS3Error with non-object values does not throw
  assert.doesNotThrow(() => {
    const errResStr = dispatchS3Error({ payloadBytes: payload, headers: 'invalid-headers-string' });
    assert.ok(errResStr);
  });
  assert.doesNotThrow(() => {
    const errResNum = dispatchS3Error({ payloadBytes: payload, headers: 999 });
    assert.ok(errResNum);
  });
  assert.doesNotThrow(() => {
    const errResNull = dispatchS3Error({ payloadBytes: payload, headers: null });
    assert.ok(errResNull);
  });
});

test('negative storage payload fixtures executed through real dispatchS3PutObject and dispatchS3Error match error code and condition', () => {
  // 1. invalid-s3-dispatch-malformed-content-md5-header.json
  const malformedMd5FixturePath = join(
    EXAMPLES_STORAGE_DIR,
    'negative/invalid-s3-dispatch-malformed-content-md5-header.json'
  );
  const malformedData = JSON.parse(readFileSync(malformedMd5FixturePath, 'utf8'));

  // Test via dispatchS3Error
  const malformedErrResult = dispatchS3Error(malformedData);
  assert.equal(malformedErrResult.http_status, 400);
  assert.equal(malformedErrResult.error_code, 'InvalidDigest');
  assert.equal(malformedErrResult.status, 400);
  assert.equal(malformedErrResult.code, 'InvalidDigest');
  assert.equal(malformedErrResult.reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(malformedData.expected_error.error_code, 'InvalidDigest');
  assert.equal(malformedData.expected_error.error_condition, 'MALFORMED_HEADER_SYNTAX');

  // Test via real dispatchS3PutObject
  const malformedPutResult = dispatchS3PutObject(malformedData);
  assert.equal(malformedPutResult.http_status, 400);
  assert.equal(malformedPutResult.error_code, 'InvalidDigest');
  assert.equal(malformedPutResult.status, 400);
  assert.equal(malformedPutResult.code, 'InvalidDigest');
  assert.equal(malformedPutResult.reason, 'MALFORMED_HEADER_SYNTAX');

  // Also test with explicit parameters
  const malformedHeaderVal = malformedData.headers?.['Content-MD5'] ?? malformedData.content_md5_header;
  const malformedExplicitPutResult = dispatchS3PutObject({
    payloadBytes: Buffer.from('test payload'),
    contentMd5Header: malformedHeaderVal,
    'x-amz-content-sha256': computePayloadSha256('test payload'),
  });
  assert.equal(malformedExplicitPutResult.http_status, 400);
  assert.equal(malformedExplicitPutResult.error_code, 'InvalidDigest');
  assert.equal(malformedExplicitPutResult.reason, 'MALFORMED_HEADER_SYNTAX');

  // 2. invalid-s3-dispatch-mismatched-content-md5.json
  const mismatchedMd5FixturePath = join(
    EXAMPLES_STORAGE_DIR,
    'negative/invalid-s3-dispatch-mismatched-content-md5.json'
  );
  const mismatchedData = JSON.parse(readFileSync(mismatchedMd5FixturePath, 'utf8'));

  // Test via dispatchS3Error
  const mismatchedErrResult = dispatchS3Error(mismatchedData);
  assert.equal(mismatchedErrResult.http_status, 400);
  assert.equal(mismatchedErrResult.error_code, 'BadDigest');
  assert.equal(mismatchedErrResult.status, 400);
  assert.equal(mismatchedErrResult.code, 'BadDigest');
  assert.equal(mismatchedErrResult.reason, 'PAYLOAD_DIGEST_MISMATCH');
  assert.equal(mismatchedData.expected_error.error_code, 'BadDigest');
  assert.equal(mismatchedData.expected_error.error_condition, 'PAYLOAD_DIGEST_MISMATCH');

  // Test via real dispatchS3PutObject
  const mismatchedPutResult = dispatchS3PutObject(mismatchedData);
  assert.equal(mismatchedPutResult.http_status, 400);
  assert.equal(mismatchedPutResult.error_code, 'BadDigest');
  assert.equal(mismatchedPutResult.status, 400);
  assert.equal(mismatchedPutResult.code, 'BadDigest');
  assert.equal(mismatchedPutResult.reason, 'PAYLOAD_DIGEST_MISMATCH');

  // Also test with explicit parameters
  const mismatchedHeaderVal = mismatchedData.headers?.['Content-MD5'] ?? mismatchedData.content_md5_declared;
  const mismatchedExplicitPutResult = dispatchS3PutObject({
    payloadBytes: Buffer.from('Checksum Failure'),
    contentMd5Header: mismatchedHeaderVal,
    'x-amz-content-sha256': computePayloadSha256('Checksum Failure'),
  });
  assert.equal(mismatchedExplicitPutResult.http_status, 400);
  assert.equal(mismatchedExplicitPutResult.error_code, 'BadDigest');
  assert.equal(mismatchedExplicitPutResult.reason, 'PAYLOAD_DIGEST_MISMATCH');
});

test('dispatchS3PutObject headers fail-closed, string payload non-heuristic hashing, and multipart total verification (OPEN-2 Findings 1, 2, 3)', () => {
  // 1. computePayloadMd5 and computePayloadSha256: no base64 heuristic decoding on string input
  const base64Str = 'SGVsbG8gQ1lCUklL'; // "Hello CYBRIK" in base64
  const utf8Buf = Buffer.from(base64Str, 'utf8');
  assert.equal(computePayloadSha256(base64Str), createHash('sha256').update(utf8Buf).digest('hex'));
  assert.equal(computePayloadMd5(base64Str), createHash('md5').update(utf8Buf).digest('base64'));
  assert.notEqual(computePayloadSha256(base64Str), createHash('sha256').update('Hello CYBRIK').digest('hex'));

  // 2. dispatchS3PutObject fails closed with InvalidDigest and MALFORMED_HEADER_SYNTAX on invalid headers
  const reqNullHeaders = {
    payloadBytes: Buffer.from('test'),
    headers: null,
    'x-amz-content-sha256': computePayloadSha256('test')
  };
  const resNull = dispatchS3PutObject(reqNullHeaders);
  assert.equal(resNull.http_status, 400);
  assert.equal(resNull.error_code, 'InvalidDigest');
  assert.equal(resNull.reason, 'MALFORMED_HEADER_SYNTAX');

  const reqArrayHeaders = {
    payloadBytes: Buffer.from('test'),
    headers: ['Content-MD5', 'x-amz-content-sha256'],
    'x-amz-content-sha256': computePayloadSha256('test')
  };
  const resArray = dispatchS3PutObject(reqArrayHeaders);
  assert.equal(resArray.http_status, 400);
  assert.equal(resArray.error_code, 'InvalidDigest');
  assert.equal(resArray.reason, 'MALFORMED_HEADER_SYNTAX');

  // 3. dispatchS3CompleteMultipartUpload: TotalPartsMismatch
  const validStoredParts = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 1024 }
  ];
  const manifestPartsMismatch = {
    total_parts: 3, // Expected 3, but parts.length is 2
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' }
    ]
  };
  const resPartsMismatch = dispatchS3CompleteMultipartUpload(manifestPartsMismatch, validStoredParts);
  assert.equal(resPartsMismatch.http_status, 400);
  assert.equal(resPartsMismatch.error_code, 'InvalidPart');
  assert.equal(resPartsMismatch.reason, 'TotalPartsMismatch');

  // 4. dispatchS3CompleteMultipartUpload: TotalSizeMismatch
  const manifestSizeMismatch = {
    total_parts: 2,
    total_size_bytes: 9999999, // Actual size is 5242880 + 1024 = 5243904
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' }
    ]
  };
  const resSizeMismatch = dispatchS3CompleteMultipartUpload(manifestSizeMismatch, validStoredParts);
  assert.equal(resSizeMismatch.http_status, 400);
  assert.equal(resSizeMismatch.error_code, 'InvalidPart');
  assert.equal(resSizeMismatch.reason, 'TotalSizeMismatch');

  // 5. dispatchS3CompleteMultipartUpload: Total parts and size matching succeeds
  const manifestMatching = {
    total_parts: 2,
    total_size_bytes: 5243904,
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"' },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"' }
    ]
  };
  const resMatching = dispatchS3CompleteMultipartUpload(manifestMatching, validStoredParts);
  assert.equal(resMatching.http_status, 200);
  assert.equal(resMatching.error_code, null);
});

test('literal string payload "YWJjZA==" is hashed as UTF-8 raw bytes rather than decoded base64 bytes "abcd" (OPEN-2)', () => {
  const literalPayload = 'YWJjZA==';
  const expectedRawBytes = Buffer.from('YWJjZA==', 'utf8');
  const base64DecodedBytes = Buffer.from('abcd', 'utf8');

  const rawSha256 = createHash('sha256').update(expectedRawBytes).digest('hex');
  const rawMd5 = createHash('md5').update(expectedRawBytes).digest('base64');
  const decodedSha256 = createHash('sha256').update(base64DecodedBytes).digest('hex');
  const decodedMd5 = createHash('md5').update(base64DecodedBytes).digest('base64');

  // Verify raw hashes do not equal decoded base64 hashes
  assert.notEqual(rawSha256, decodedSha256);
  assert.notEqual(rawMd5, decodedMd5);

  // 1. computePayloadSha256 & computePayloadMd5 hashes raw UTF-8 octets
  assert.equal(computePayloadSha256(literalPayload), rawSha256);
  assert.notEqual(computePayloadSha256(literalPayload), decodedSha256);
  assert.equal(computePayloadMd5(literalPayload), rawMd5);
  assert.notEqual(computePayloadMd5(literalPayload), decodedMd5);

  // 2. dispatchS3PutObject with raw UTF-8 SHA256 succeeds (HTTP 200)
  const putRawRes = dispatchS3PutObject({
    payloadBytes: literalPayload,
    'x-amz-content-sha256': rawSha256,
  });
  assert.equal(putRawRes.http_status, 200);
  assert.equal(putRawRes.error_code, null);

  // 3. dispatchS3PutObject with decoded SHA256 returns HTTP 400 BadDigest (PAYLOAD_SHA256_MISMATCH)
  const putDecodedRes = dispatchS3PutObject({
    payloadBytes: literalPayload,
    'x-amz-content-sha256': decodedSha256,
  });
  assert.equal(putDecodedRes.http_status, 400);
  assert.equal(putDecodedRes.error_code, 'BadDigest');
  assert.equal(putDecodedRes.reason, 'PAYLOAD_SHA256_MISMATCH');

  // 4. dispatchS3PutObject with raw UTF-8 MD5 succeeds (HTTP 200)
  const putRawMd5Res = dispatchS3PutObject({
    payloadBytes: literalPayload,
    contentMd5Header: rawMd5,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  });
  assert.equal(putRawMd5Res.http_status, 200);
  assert.equal(putRawMd5Res.error_code, null);

  // 5. dispatchS3PutObject with decoded MD5 returns HTTP 400 BadDigest (PAYLOAD_DIGEST_MISMATCH)
  const putDecodedMd5Res = dispatchS3PutObject({
    payloadBytes: literalPayload,
    contentMd5Header: decodedMd5,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  });
  assert.equal(putDecodedMd5Res.http_status, 400);
  assert.equal(putDecodedMd5Res.error_code, 'BadDigest');
  assert.equal(putDecodedMd5Res.reason, 'PAYLOAD_DIGEST_MISMATCH');
});

test('dispatchS3PutObject with headers: undefined or headers: null fails closed with HTTP 400 InvalidDigest (MALFORMED_HEADER_SYNTAX) (OPEN-2)', () => {
  const payload = 'data';
  const validSha = computePayloadSha256(payload);

  // 1. headers: undefined (fail-closed when headers property is explicitly present as undefined)
  const resUndefined = dispatchS3PutObject({
    headers: undefined,
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
  });
  assert.equal(resUndefined.http_status, 400);
  assert.equal(resUndefined.error_code, 'InvalidDigest');
  assert.equal(resUndefined.status, 400);
  assert.equal(resUndefined.code, 'InvalidDigest');
  assert.equal(resUndefined.reason, 'MALFORMED_HEADER_SYNTAX');

  const errResUndefined = dispatchS3Error({
    headers: undefined,
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
  });
  assert.equal(errResUndefined.http_status, 400);
  assert.equal(errResUndefined.error_code, 'InvalidDigest');
  assert.equal(errResUndefined.status, 400);
  assert.equal(errResUndefined.code, 'InvalidDigest');
  assert.equal(errResUndefined.reason, 'MALFORMED_HEADER_SYNTAX');

  // 2. headers: null
  const resNull = dispatchS3PutObject({
    payloadBytes: payload,
    headers: null,
    'x-amz-content-sha256': validSha,
  });
  assert.equal(resNull.http_status, 400);
  assert.equal(resNull.error_code, 'InvalidDigest');
  assert.equal(resNull.status, 400);
  assert.equal(resNull.code, 'InvalidDigest');
  assert.equal(resNull.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('s3Uri and pathStyleUrl schema validation rejects ../, leading ./, repeated slashes //, and trailing slash / (OPEN-2)', () => {
  const validateUri = ajv.getSchema(S3_URI_DEF_ID);
  const validateUrl = ajv.getSchema(PATH_STYLE_URL_DEF_ID);

  // Valid positive baseline
  assert.ok(validateUri('s3://cybrik-audit/evidence/bundle.tar.gz'));
  assert.ok(validateUri('s3://my-bucket/a/b/c/file.json'));
  assert.ok(validateUrl('https://storage.internal.cybrik:9000/cybrik-audit/evidence/bundle.tar.gz'));
  assert.ok(validateUrl('http://127.0.0.1:9000/bucket/key'));

  // Negative: s3Uri with leading dot-segment ./ (OPEN-2 Finding 1)
  const invalidUriDotSlash = [
    's3://my-bucket/./secret.json',
    's3://my-bucket/./a/b.json',
  ];
  for (const uri of invalidUriDotSlash) {
    assert.ok(!validateUri(uri), `s3Uri '${uri}' with leading './' must be rejected`);
    assert.equal(validateUri.errors[0].keyword, 'pattern');
  }

  // Negative: s3Uri with ../ (dot-dot traversal)
  const invalidUriDotDot = [
    's3://my-bucket/../secret.json',
    's3://my-bucket/dir/../secret.json',
    's3://my-bucket/a/b/../../secret.json',
  ];
  for (const uri of invalidUriDotDot) {
    assert.ok(!validateUri(uri), `s3Uri '${uri}' with '../' must be rejected`);
    assert.equal(validateUri.errors[0].keyword, 'pattern');
  }

  // Negative: s3Uri with repeated slashes //
  const invalidUriDoubleSlash = [
    's3://my-bucket//secret.json',
    's3://my-bucket/dir//secret.json',
    's3://my-bucket/a/b///c.json',
  ];
  for (const uri of invalidUriDoubleSlash) {
    assert.ok(!validateUri(uri), `s3Uri '${uri}' with '//' must be rejected`);
    assert.equal(validateUri.errors[0].keyword, 'pattern');
  }

  // Negative: s3Uri with trailing slash /
  const invalidUriTrailingSlash = [
    's3://my-bucket/dir/',
    's3://my-bucket/evidence/bundle.tar.gz/',
    's3://my-bucket/a/b/c/',
  ];
  for (const uri of invalidUriTrailingSlash) {
    assert.ok(!validateUri(uri), `s3Uri '${uri}' with trailing '/' must be rejected`);
    assert.equal(validateUri.errors[0].keyword, 'pattern');
  }

  // Negative: pathStyleUrl with leading dot-segment ./ (OPEN-2 Finding 1)
  const invalidUrlDotSlash = [
    'https://storage.local/my-bucket/./secret.json',
    'http://127.0.0.1:9000/my-bucket/./secret.json',
  ];
  for (const url of invalidUrlDotSlash) {
    assert.ok(!validateUrl(url), `pathStyleUrl '${url}' with leading './' must be rejected`);
    assert.equal(validateUrl.errors[0].keyword, 'pattern');
  }

  // Negative: pathStyleUrl with ../ (dot-dot traversal)
  const invalidUrlDotDot = [
    'http://127.0.0.1:9000/my-bucket/../secret.json',
    'https://storage.internal.cybrik:9000/my-bucket/dir/../secret.json',
    'http://localhost:9000/bucket/a/b/../../file.json',
  ];
  for (const url of invalidUrlDotDot) {
    assert.ok(!validateUrl(url), `pathStyleUrl '${url}' with '../' must be rejected`);
    assert.equal(validateUrl.errors[0].keyword, 'pattern');
  }

  // Negative: pathStyleUrl with repeated slashes // in path
  const invalidUrlDoubleSlash = [
    'http://127.0.0.1:9000/my-bucket//secret.json',
    'https://storage.internal.cybrik:9000/my-bucket/dir//secret.json',
    'https://storage.internal.cybrik:9000//my-bucket/key',
  ];
  for (const url of invalidUrlDoubleSlash) {
    assert.ok(!validateUrl(url), `pathStyleUrl '${url}' with '//' must be rejected`);
    assert.equal(validateUrl.errors[0].keyword, 'pattern');
  }

  // Negative: pathStyleUrl with trailing slash /
  const invalidUrlTrailingSlash = [
    'http://127.0.0.1:9000/my-bucket/dir/',
    'https://storage.internal.cybrik:9000/cybrik-audit/evidence/bundle.tar.gz/',
    'http://localhost:9000/bucket/key/',
  ];
  for (const url of invalidUrlTrailingSlash) {
    assert.ok(!validateUrl(url), `pathStyleUrl '${url}' with trailing '/' must be rejected`);
    assert.equal(validateUrl.errors[0].keyword, 'pattern');
  }
});

test('dispatchS3CompleteMultipartUpload with mismatched total_parts or total_size_bytes returns HTTP 400 InvalidPart (OPEN-2)', () => {
  const baseManifest = {
    upload_id: 'mp-upload-test-totals-01',
    bucket: 'cybrik-telemetry-archive',
    object_key: 'multipart/data.bin',
    total_parts: 2,
    total_size_bytes: 10485760,
    parts: [
      { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
      { part_number: 2, etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
    ],
  };
  const storedParts = {
    1: { etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
    2: { etag: '"098f6bcd4621d373cade4e832627b4f6"', size_bytes: 5242880 },
  };

  // 1. Positive baseline: matching totals returns HTTP 200
  const okRes = dispatchS3CompleteMultipartUpload(baseManifest, storedParts);
  assert.equal(okRes.http_status, 200);
  assert.equal(okRes.error_code, null);

  // 2. Mismatched total_parts (high: 5 vs actual 2) returns HTTP 400 InvalidPart
  const badTotalPartsHigh = { ...baseManifest, total_parts: 5 };
  const resTotalPartsHigh = dispatchS3CompleteMultipartUpload(badTotalPartsHigh, storedParts);
  assert.equal(resTotalPartsHigh.http_status, 400);
  assert.equal(resTotalPartsHigh.error_code, 'InvalidPart');
  assert.equal(resTotalPartsHigh.status, 400);
  assert.equal(resTotalPartsHigh.code, 'InvalidPart');
  assert.equal(resTotalPartsHigh.reason, 'TotalPartsMismatch');

  // 3. Mismatched total_parts (low: 1 vs actual 2) returns HTTP 400 InvalidPart
  const badTotalPartsLow = { ...baseManifest, total_parts: 1 };
  const resTotalPartsLow = dispatchS3CompleteMultipartUpload(badTotalPartsLow, storedParts);
  assert.equal(resTotalPartsLow.http_status, 400);
  assert.equal(resTotalPartsLow.error_code, 'InvalidPart');
  assert.equal(resTotalPartsLow.status, 400);
  assert.equal(resTotalPartsLow.code, 'InvalidPart');
  assert.equal(resTotalPartsLow.reason, 'TotalPartsMismatch');

  // 3b. String total_parts: "1" returns HTTP 400 InvalidPart (TotalPartsMismatch) (Finding 3 / OPEN-2)
  const stringTotalPartsManifest = { ...baseManifest, total_parts: "1" };
  const resStringTotalParts = dispatchS3CompleteMultipartUpload(stringTotalPartsManifest, storedParts);
  assert.equal(resStringTotalParts.http_status, 400);
  assert.equal(resStringTotalParts.error_code, 'InvalidPart');
  assert.equal(resStringTotalParts.status, 400);
  assert.equal(resStringTotalParts.code, 'InvalidPart');
  assert.equal(resStringTotalParts.reason, 'TotalPartsMismatch');

  // 4. Mismatched total_size_bytes (high: 10485761 vs actual 10485760) returns HTTP 400 InvalidPart
  const badTotalSizeHigh = { ...baseManifest, total_size_bytes: 10485761 };
  const resTotalSizeHigh = dispatchS3CompleteMultipartUpload(badTotalSizeHigh, storedParts);
  assert.equal(resTotalSizeHigh.http_status, 400);
  assert.equal(resTotalSizeHigh.error_code, 'InvalidPart');
  assert.equal(resTotalSizeHigh.status, 400);
  assert.equal(resTotalSizeHigh.code, 'InvalidPart');
  assert.equal(resTotalSizeHigh.reason, 'TotalSizeMismatch');

  // 5. Mismatched total_size_bytes (low: 5242880 vs actual 10485760) returns HTTP 400 InvalidPart
  const badTotalSizeLow = { ...baseManifest, total_size_bytes: 5242880 };
  const resTotalSizeLow = dispatchS3CompleteMultipartUpload(badTotalSizeLow, storedParts);
  assert.equal(resTotalSizeLow.http_status, 400);
  assert.equal(resTotalSizeLow.error_code, 'InvalidPart');
  assert.equal(resTotalSizeLow.status, 400);
  assert.equal(resTotalSizeLow.code, 'InvalidPart');
  assert.equal(resTotalSizeLow.reason, 'TotalSizeMismatch');

  // 5b. String total_size_bytes: "100" returns HTTP 400 InvalidPart (TotalSizeMismatch) (Finding 3 / OPEN-2)
  const stringTotalSizeManifest = { ...baseManifest, total_size_bytes: "100" };
  const resStringTotalSize = dispatchS3CompleteMultipartUpload(stringTotalSizeManifest, storedParts);
  assert.equal(resStringTotalSize.http_status, 400);
  assert.equal(resStringTotalSize.error_code, 'InvalidPart');
  assert.equal(resStringTotalSize.status, 400);
  assert.equal(resStringTotalSize.code, 'InvalidPart');
  assert.equal(resStringTotalSize.reason, 'TotalSizeMismatch');

  // 6. dispatchS3Error mapping for TOTAL_PARTS_MISMATCH and TOTAL_SIZE_BYTES_MISMATCH
  for (const trigger of ['TOTAL_PARTS_MISMATCH', 'TotalPartsMismatch', 'TOTAL_SIZE_BYTES_MISMATCH', 'TotalSizeBytesMismatch', 'TotalSizeMismatch']) {
    const errResStr = dispatchS3Error(trigger);
    assert.equal(errResStr.http_status, 400);
    assert.equal(errResStr.error_code, 'InvalidPart');

    const errResObj = dispatchS3Error({ reason: trigger });
    assert.equal(errResObj.http_status, 400);
    assert.equal(errResObj.error_code, 'InvalidPart');
  }
});

test('dispatchS3Error({ headers: { "x-amz-content-sha256": "STREAMING-AWS4-HMAC-SHA256-PAYLOAD" } }) returns HTTP 400 InvalidDigest (UNSUPPORTED_STREAMING_PAYLOAD_SHA256) (Finding 4 / OPEN-2)', () => {
  const res = dispatchS3Error({
    headers: {
      'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD',
    },
  });
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'InvalidDigest');
  assert.equal(res.status, 400);
  assert.equal(res.code, 'InvalidDigest');
  assert.equal(res.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  // Direct option without headers wrapper
  const resDirect = dispatchS3Error({
    'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD',
  });
  assert.equal(resDirect.http_status, 400);
  assert.equal(resDirect.error_code, 'InvalidDigest');
  assert.equal(resDirect.status, 400);
  assert.equal(resDirect.code, 'InvalidDigest');
  assert.equal(resDirect.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  // String and object reason triggers
  const strRes = dispatchS3Error('UNSUPPORTED_STREAMING_PAYLOAD_SHA256');
  assert.equal(strRes.http_status, 400);
  assert.equal(strRes.error_code, 'InvalidDigest');
  assert.equal(strRes.status, 400);
  assert.equal(strRes.code, 'InvalidDigest');
  assert.equal(strRes.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  const objRes = dispatchS3Error({ reason: 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256' });
  assert.equal(objRes.http_status, 400);
  assert.equal(objRes.error_code, 'InvalidDigest');
  assert.equal(objRes.status, 400);
  assert.equal(objRes.code, 'InvalidDigest');
  assert.equal(objRes.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  const objConditionRes = dispatchS3Error({ error_condition: 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256' });
  assert.equal(objConditionRes.http_status, 400);
  assert.equal(objConditionRes.error_code, 'InvalidDigest');
  assert.equal(objConditionRes.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');
});

test('negative storage fixtures loop dispatches literal string payloads without heuristic base64 decode (Finding 5 / OPEN-2)', () => {
  const negativeFiles = readdirSync(join(EXAMPLES_STORAGE_DIR, 'negative')).filter((f) =>
    f.endsWith('.json')
  );

  for (const file of negativeFiles) {
    const filePath = join(EXAMPLES_STORAGE_DIR, 'negative', file);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

    if (EXPECTED_STORAGE_DISPATCH_NEGATIVES[file]) {
      const exp = EXPECTED_STORAGE_DISPATCH_NEGATIVES[file];

      // Dispatched directly with raw fixture data
      const putResult = dispatchS3PutObject(data);
      assert.equal(putResult.http_status, exp.http_status, `PutObject status mismatch for ${file}`);
      assert.equal(putResult.error_code, exp.error_code, `PutObject error_code mismatch for ${file}`);
      assert.equal(putResult.reason, exp.error_condition, `PutObject reason mismatch for ${file}`);

      const errResult = dispatchS3Error(data);
      assert.equal(errResult.http_status, exp.http_status, `dispatchS3Error status mismatch for ${file}`);
      assert.equal(errResult.error_code, exp.error_code, `dispatchS3Error error_code mismatch for ${file}`);
      assert.equal(errResult.reason, exp.error_condition, `dispatchS3Error reason mismatch for ${file}`);

      // Also verify when payload is mutated to literal Base64-looking string 'YWJjZA=='
      const base64StrPayload = 'YWJjZA==';
      const mutatedFixture = {
        ...data,
        payload: base64StrPayload,
        payloadBytes: undefined,
      };
      const mutatedPutResult = dispatchS3PutObject(mutatedFixture);
      assert.equal(mutatedPutResult.http_status, exp.http_status);
      assert.equal(mutatedPutResult.error_code, exp.error_code);
    }
  }
});

test('dispatchS3PutObject and dispatchS3Error content_md5_declared and content_md5_computed branch coverage', () => {
  const payload = Buffer.from('test');
  const validMd5 = computePayloadMd5(payload);
  const validSha = computePayloadSha256(payload);

  const matchingDeclared = {
    content_md5_declared: validMd5,
    content_md5_computed: validMd5,
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
  };
  const mismatchDeclared = {
    content_md5_declared: validMd5,
    content_md5_computed: 'mismatched-computed-md5',
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
  };

  const putMatch = dispatchS3PutObject(matchingDeclared);
  assert.equal(putMatch.http_status, 200);

  const putMismatch = dispatchS3PutObject(mismatchDeclared);
  assert.equal(putMismatch.http_status, 400);
  assert.equal(putMismatch.error_code, 'BadDigest');
  assert.equal(putMismatch.reason, 'PAYLOAD_DIGEST_MISMATCH');

  const errMatch = dispatchS3Error(matchingDeclared);
  assert.equal(errMatch.http_status, 200);

  const errMismatch = dispatchS3Error(mismatchDeclared);
  assert.equal(errMismatch.http_status, 400);
  assert.equal(errMismatch.error_code, 'BadDigest');
  assert.equal(errMismatch.reason, 'PAYLOAD_DIGEST_MISMATCH');
});

test('verifyDigestErrorDispatch and verifyMalformedHeaderDispatch object request shape branch coverage', () => {
  const payload = Buffer.from('TEST_PAYLOAD');
  const validSha = computePayloadSha256(payload);

  // verifyDigestErrorDispatch with mismatched MD5 returns BadDigest
  const digestResult = verifyDigestErrorDispatch({
    payloadBytes: payload,
    contentMd5Header: '1B2M2Y8AsgTpgAmY7PhCfg==',
    'x-amz-content-sha256': validSha,
  });
  assert.equal(digestResult.http_status, 400);
  assert.equal(digestResult.error_code, 'BadDigest');

  // verifyMalformedHeaderDispatch with malformed header returns InvalidDigest
  const malformedResult = verifyMalformedHeaderDispatch({
    payloadBytes: payload,
    content_md5_header: 'invalid-base64!',
    'x-amz-content-sha256': validSha,
  });
  assert.equal(malformedResult.http_status, 400);
  assert.equal(malformedResult.error_code, 'InvalidDigest');
});

test('dispatchS3PutObject and dispatchS3Error guard inherited invalid headers (Finding 1 / OPEN-2)', () => {
  const payload = Buffer.from('TEST_INHERITED_HEADERS');
  const validSha = computePayloadSha256(payload);

  for (const invalidHeaders of [null, undefined, 'invalid-string', 123, [], false]) {
    const protoObj = Object.create({ headers: invalidHeaders });
    protoObj.payloadBytes = payload;
    protoObj['x-amz-content-sha256'] = validSha;

    const putRes = dispatchS3PutObject(protoObj);
    assert.equal(putRes.http_status, 400, `dispatchS3PutObject must fail closed on inherited headers: ${invalidHeaders}`);
    assert.equal(putRes.error_code, 'InvalidDigest');
    assert.equal(putRes.reason, 'MALFORMED_HEADER_SYNTAX');

    const errRes = dispatchS3Error(protoObj);
    assert.equal(errRes.http_status, 400, `dispatchS3Error must fail closed on inherited headers: ${invalidHeaders}`);
    assert.equal(errRes.error_code, 'InvalidDigest');
    assert.equal(errRes.reason, 'MALFORMED_HEADER_SYNTAX');
  }
});

test('dispatchS3PutObject and dispatchS3Error prioritize streaming SHA sentinel before MD5 validation and mismatch (Finding 2 / OPEN-2)', () => {
  const payload = Buffer.from('TEST_STREAMING_PRIORITY');
  const mismatchedMd5 = '1B2M2Y8AsgTpgAmY7PhCfg==';
  const malformedMd5 = 'not-valid-base64!';

  // In dispatchS3PutObject with mismatched MD5 and streaming SHA
  const putMismatchedMd5 = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: mismatchedMd5,
    'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD',
  });
  assert.equal(putMismatchedMd5.http_status, 400);
  assert.equal(putMismatchedMd5.error_code, 'InvalidDigest');
  assert.equal(putMismatchedMd5.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  // In dispatchS3PutObject with malformed MD5 and streaming SHA
  const putMalformedMd5 = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: malformedMd5,
    'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD',
  });
  assert.equal(putMalformedMd5.http_status, 400);
  assert.equal(putMalformedMd5.error_code, 'InvalidDigest');
  assert.equal(putMalformedMd5.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  // In dispatchS3Error with mismatched declared/computed MD5 and streaming SHA
  const errDeclaredMismatch = dispatchS3Error({
    payloadBytes: payload,
    content_md5_declared: '1111111111111111111111==',
    content_md5_computed: '2222222222222222222222==',
    'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD',
  });
  assert.equal(errDeclaredMismatch.http_status, 400);
  assert.equal(errDeclaredMismatch.error_code, 'InvalidDigest');
  assert.equal(errDeclaredMismatch.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  // In dispatchS3Error with malformed MD5 and streaming SHA
  const errMalformedMd5 = dispatchS3Error({
    payloadBytes: payload,
    contentMd5Header: malformedMd5,
    'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD',
  });
  assert.equal(errMalformedMd5.http_status, 400);
  assert.equal(errMalformedMd5.error_code, 'InvalidDigest');
  assert.equal(errMalformedMd5.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  // In dispatchS3Error with mismatched MD5 and streaming SHA
  const errMismatchedMd5 = dispatchS3Error({
    payloadBytes: payload,
    contentMd5Header: mismatchedMd5,
    'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD',
  });
  assert.equal(errMismatchedMd5.http_status, 400);
  assert.equal(errMismatchedMd5.error_code, 'InvalidDigest');
  assert.equal(errMismatchedMd5.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  // Wrapped headers object
  const compoundHeaders = {
    payloadBytes: payload,
    headers: {
      'Content-MD5': mismatchedMd5,
      'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD',
    },
  };

  const putWrapped = dispatchS3PutObject(compoundHeaders);
  assert.equal(putWrapped.http_status, 400);
  assert.equal(putWrapped.error_code, 'InvalidDigest');
  assert.equal(putWrapped.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  const errWrapped = dispatchS3Error(compoundHeaders);
  assert.equal(errWrapped.http_status, 400);
  assert.equal(errWrapped.error_code, 'InvalidDigest');
  assert.equal(errWrapped.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');
});

test('RFC 3986 valid keys containing ~ and %20 pass schema and URI checks (Finding 3 / OPEN-2)', () => {
  const validateKey = ajv.getSchema(OBJECT_KEY_DEF_ID);
  const validateUri = ajv.getSchema(S3_URI_DEF_ID);
  const validateUrl = ajv.getSchema(PATH_STYLE_URL_DEF_ID);

  assert.ok(validateKey, `Schema validator missing for ${OBJECT_KEY_DEF_ID}`);
  assert.ok(validateUri, `Schema validator missing for ${S3_URI_DEF_ID}`);
  assert.ok(validateUrl, `Schema validator missing for ${PATH_STYLE_URL_DEF_ID}`);

  const validKeySamples = [
    'path~v1/%20file.json',
    'audit-logs/~2026/evidence%20bundle.tar.gz',
    'releases/v1.0.0~rc1/%20payload.json',
    'prefix~beta/nested%20dir/item.txt',
    'path~v1/file~2.json',
    '%20leading-space-encoded/file.json',
  ];

  for (const key of validKeySamples) {
    assert.ok(validateKey(key), `Object key '${key}' containing ~ or %20 must pass schema validation`);
  }

  const validUriSamples = [
    's3://my-bucket/path~v1/%20file.json',
    's3://cybrik-audit/audit-logs/~2026/evidence%20bundle.tar.gz',
    's3://telemetry.archive-2026/releases/v1.0.0~rc1/%20payload.json',
    's3://my-bucket/prefix~beta/nested%20dir/item.txt',
  ];

  for (const uri of validUriSamples) {
    assert.ok(validateUri(uri), `s3Uri '${uri}' containing ~ or %20 must pass schema validation`);
  }

  const validUrlSamples = [
    'https://storage.local/my-bucket/path~v1/%20file.json',
    'https://storage.internal.cybrik:9000/cybrik-audit/audit-logs/~2026/evidence%20bundle.tar.gz',
    'http://127.0.0.1:9000/my-bucket/releases/v1.0.0~rc1/%20payload.json',
    'http://localhost:8080/my-bucket/prefix~beta/nested%20dir/item.txt',
  ];

  for (const url of validUrlSamples) {
    assert.ok(validateUrl(url), `pathStyleUrl '${url}' containing ~ or %20 must pass schema validation`);
  }
});

test('CompleteMultipartUpload rejects unquoted, asymmetrically quoted, and same-unquoted ETags with HTTP 400 InvalidPart / InvalidETagFormat (OPEN-2 / OPEN-5)', () => {
  const validStoredParts = new Map([
    [1, { etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }],
  ]);

  // 1. Unquoted ETag in manifest
  const unquotedManifest = {
    parts: [{ part_number: 1, etag: '0123456789abcdef0123456789abcdef', size_bytes: 5242880 }],
    total_parts: 1,
    total_size_bytes: 5242880,
  };
  const resUnquoted = dispatchS3CompleteMultipartUpload(unquotedManifest, validStoredParts);
  assert.equal(resUnquoted.http_status, 400);
  assert.equal(resUnquoted.error_code, 'InvalidPart');
  assert.equal(resUnquoted.code, 'InvalidPart');
  assert.equal(resUnquoted.reason, 'InvalidETagFormat');

  // 2. Asymmetrically quoted ETag (leading quote only)
  const leadingQuotedManifest = {
    parts: [{ part_number: 1, etag: '"etag', size_bytes: 5242880 }],
    total_parts: 1,
    total_size_bytes: 5242880,
  };
  const resLeading = dispatchS3CompleteMultipartUpload(leadingQuotedManifest, validStoredParts);
  assert.equal(resLeading.http_status, 400);
  assert.equal(resLeading.error_code, 'InvalidPart');
  assert.equal(resLeading.reason, 'InvalidETagFormat');

  // 3. Asymmetrically quoted ETag (trailing quote only)
  const trailingQuotedManifest = {
    parts: [{ part_number: 1, etag: 'etag"', size_bytes: 5242880 }],
    total_parts: 1,
    total_size_bytes: 5242880,
  };
  const resTrailing = dispatchS3CompleteMultipartUpload(trailingQuotedManifest, validStoredParts);
  assert.equal(resTrailing.http_status, 400);
  assert.equal(resTrailing.error_code, 'InvalidPart');
  assert.equal(resTrailing.reason, 'InvalidETagFormat');

  // 4. Same-unquoted ETags (both manifest and stored parts have identical unquoted etag)
  const sameUnquotedStored = new Map([
    [1, { etag: '0123456789abcdef0123456789abcdef', size_bytes: 5242880 }],
  ]);
  const resSameUnquoted = dispatchS3CompleteMultipartUpload(unquotedManifest, sameUnquotedStored);
  assert.equal(resSameUnquoted.http_status, 400);
  assert.equal(resSameUnquoted.error_code, 'InvalidPart');
  assert.equal(resSameUnquoted.reason, 'InvalidETagFormat');

  // 5. Stored part with unquoted ETag when manifest is double-quoted
  const validManifest = {
    parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }],
    total_parts: 1,
    total_size_bytes: 5242880,
  };
  const resStoredUnquoted = dispatchS3CompleteMultipartUpload(validManifest, sameUnquotedStored);
  assert.equal(resStoredUnquoted.http_status, 400);
  assert.equal(resStoredUnquoted.error_code, 'InvalidPart');
  assert.equal(resStoredUnquoted.reason, 'InvalidETagFormat');

  // 6. dispatchS3Error mapping verification for InvalidETagFormat
  for (const trigger of ['InvalidETagFormat', 'INVALID_ETAG_FORMAT']) {
    const errRes = dispatchS3Error(trigger);
    assert.equal(errRes.http_status, 400);
    assert.equal(errRes.error_code, 'InvalidPart');
    assert.equal(errRes.reason, 'InvalidETagFormat');
  }
  const objErrRes = dispatchS3Error({ reason: 'InvalidETagFormat' });
  assert.equal(objErrRes.http_status, 400);
  assert.equal(objErrRes.error_code, 'InvalidPart');
  assert.equal(objErrRes.reason, 'InvalidETagFormat');
});

test('dispatchS3PutObject and dispatchS3Error reject inherited valid headers with HTTP 400 InvalidDigest / MALFORMED_HEADER_SYNTAX (OPEN-2 / OPEN-5)', () => {
  const payloadBytes = Buffer.from('CYBRIK_INHERITED_HEADERS_SECURITY_REJECTION_TEST_2026');
  const validSha = computePayloadSha256(payloadBytes);

  // 1. Inherited headers object (Object.create({ headers: { 'x-amz-content-sha256': validSha } }))
  const inheritedHeadersOnly = Object.create({
    headers: { 'x-amz-content-sha256': validSha },
  });
  const resPutInherited = dispatchS3PutObject(inheritedHeadersOnly);
  assert.equal(resPutInherited.http_status, 400);
  assert.equal(resPutInherited.error_code, 'InvalidDigest');
  assert.equal(resPutInherited.code, 'InvalidDigest');
  assert.equal(resPutInherited.reason, 'MALFORMED_HEADER_SYNTAX');

  const resErrInherited = dispatchS3Error(inheritedHeadersOnly);
  assert.equal(resErrInherited.http_status, 400);
  assert.equal(resErrInherited.error_code, 'InvalidDigest');
  assert.equal(resErrInherited.code, 'InvalidDigest');
  assert.equal(resErrInherited.reason, 'MALFORMED_HEADER_SYNTAX');

  // 2. Inherited headers with payloadBytes attached
  const inheritedWithPayload = Object.create({
    headers: { 'x-amz-content-sha256': validSha },
  });
  inheritedWithPayload.payloadBytes = payloadBytes;

  const resPutPayload = dispatchS3PutObject(inheritedWithPayload);
  assert.equal(resPutPayload.http_status, 400);
  assert.equal(resPutPayload.error_code, 'InvalidDigest');
  assert.equal(resPutPayload.reason, 'MALFORMED_HEADER_SYNTAX');

  const resErrPayload = dispatchS3Error(inheritedWithPayload);
  assert.equal(resErrPayload.http_status, 400);
  assert.equal(resErrPayload.error_code, 'InvalidDigest');
  assert.equal(resErrPayload.reason, 'MALFORMED_HEADER_SYNTAX');

  // 3. Own headers container with inherited header field
  const inheritedInsideHeaders = {
    payloadBytes,
    headers: Object.create({ 'x-amz-content-sha256': validSha }),
  };

  const resPutInner = dispatchS3PutObject(inheritedInsideHeaders);
  assert.equal(resPutInner.http_status, 400);
  assert.equal(resPutInner.error_code, 'InvalidDigest');
  assert.equal(resPutInner.reason, 'MALFORMED_HEADER_SYNTAX');

  const resErrInner = dispatchS3Error(inheritedInsideHeaders);
  assert.equal(resErrInner.http_status, 400);
  assert.equal(resErrInner.error_code, 'InvalidDigest');
  assert.equal(resErrInner.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('dispatchS3CompleteMultipartUpload rejects regex-invalid double-quoted ETags with HTTP 400 InvalidPart / InvalidETagFormat (OPEN-2)', () => {
  const invalidEtags = [
    '""', // empty double-quoted string
    '"nothex"', // non-hex string
    '"0123456789abcdef0123456789abcdef-123456"', // 6-digit part suffix exceeding {1,5} limit
    '"0123456789abcdef"', // too short (16 hex chars)
    '"0123456789abcdef0123456789abcdef0123456789abcdef"', // too long (48 hex chars)
    '"0123456789abcdef0123456789abcdef-"', // hyphen without part number
    '"0123456789abcdef0123456789abcdef-abc"', // non-numeric part suffix
    '"zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"', // non-hex characters of length 32
  ];

  const validStoredPart = {
    part_number: 1,
    etag: '"d41d8cd98f00b204e9800998ecf8427e"',
    size_bytes: 5242880,
  };

  for (const badEtag of invalidEtags) {
    // 1. Invalid ETag in manifest parts
    const manifestWithBadEtag = {
      parts: [
        { part_number: 1, etag: badEtag, size_bytes: 5242880 },
      ],
    };
    const validStoredMap = new Map([[1, validStoredPart]]);
    const resManifest = dispatchS3CompleteMultipartUpload(manifestWithBadEtag, validStoredMap);
    assert.equal(resManifest.http_status, 400, `Manifest bad ETag '${badEtag}' must return 400`);
    assert.equal(resManifest.error_code, 'InvalidPart', `Manifest bad ETag '${badEtag}' must return InvalidPart`);
    assert.equal(resManifest.status, 400);
    assert.equal(resManifest.code, 'InvalidPart');
    assert.equal(resManifest.reason, 'InvalidETagFormat', `Manifest bad ETag '${badEtag}' must have reason InvalidETagFormat`);

    // 2. Invalid ETag in stored parts (with valid ETag in manifest)
    const validManifest = {
      parts: [
        { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
      ],
    };
    const storedWithBadEtag = new Map([
      [1, { part_number: 1, etag: badEtag, size_bytes: 5242880 }],
    ]);
    const resStored = dispatchS3CompleteMultipartUpload(validManifest, storedWithBadEtag);
    assert.equal(resStored.http_status, 400, `Stored bad ETag '${badEtag}' must return 400`);
    assert.equal(resStored.error_code, 'InvalidPart', `Stored bad ETag '${badEtag}' must return InvalidPart`);
    assert.equal(resStored.reason, 'InvalidETagFormat', `Stored bad ETag '${badEtag}' must have reason InvalidETagFormat`);

    // 3. Both manifest and stored parts have the same invalid ETag
    const storedSameBadEtag = new Map([
      [1, { part_number: 1, etag: badEtag, size_bytes: 5242880 }],
    ]);
    const resBoth = dispatchS3CompleteMultipartUpload(manifestWithBadEtag, storedSameBadEtag);
    assert.equal(resBoth.http_status, 400, `Matched bad ETag '${badEtag}' must still return 400`);
    assert.equal(resBoth.error_code, 'InvalidPart', `Matched bad ETag '${badEtag}' must still return InvalidPart`);
    assert.equal(resBoth.reason, 'InvalidETagFormat', `Matched bad ETag '${badEtag}' must still have reason InvalidETagFormat`);
  }

  // 4. Positive valid ETags (32-hex single part and 1-5 digit multipart suffix) succeed
  const validEtags = [
    '"d41d8cd98f00b204e9800998ecf8427e"',
    '"0123456789abcdef0123456789abcdef-1"',
    '"0123456789abcdef0123456789abcdef-123"',
    '"0123456789abcdef0123456789abcdef-12345"',
  ];

  for (const goodEtag of validEtags) {
    const manifest = { parts: [{ part_number: 1, etag: goodEtag, size_bytes: 5242880 }] };
    const stored = new Map([[1, { part_number: 1, etag: goodEtag, size_bytes: 5242880 }]]);
    const resGood = dispatchS3CompleteMultipartUpload(manifest, stored);
    assert.equal(resGood.http_status, 200, `Valid ETag '${goodEtag}' must return 200`);
    assert.equal(resGood.error_code, null);
  }
});

test('prototype input hardening: inherited payload, payloadBytes, headers, or parts fail closed across S3 dispatchers and validators (OPEN-2 / OPEN-5)', () => {
  const payloadBytes = Buffer.from('CYBRIK_PROTOTYPE_HARDENING_REGRESSION_TEST_2026');
  const validSha = computePayloadSha256(payloadBytes);

  // 1. dispatchS3PutObject and dispatchS3Error with prototype-inherited payload
  const protoPayload = Object.create({ payload: payloadBytes, 'x-amz-content-sha256': validSha });
  const resPutProtoPayload = dispatchS3PutObject(protoPayload);
  assert.equal(resPutProtoPayload.http_status, 400, 'Inherited payload in dispatchS3PutObject must fail closed with 400');
  assert.equal(resPutProtoPayload.error_code, 'InvalidDigest');

  const resErrProtoPayload = dispatchS3Error(protoPayload);
  assert.equal(resErrProtoPayload.http_status, 400, 'Inherited payload in dispatchS3Error must fail closed with 400');
  assert.equal(resErrProtoPayload.error_code, 'InvalidDigest');

  // 2. dispatchS3PutObject and dispatchS3Error with prototype-inherited payloadBytes
  const protoPayloadBytes = Object.create({ payloadBytes, 'x-amz-content-sha256': validSha });
  const resPutProtoBytes = dispatchS3PutObject(protoPayloadBytes);
  assert.equal(resPutProtoBytes.http_status, 400, 'Inherited payloadBytes in dispatchS3PutObject must fail closed with 400');
  assert.equal(resPutProtoBytes.error_code, 'InvalidDigest');

  const resErrProtoBytes = dispatchS3Error(protoPayloadBytes);
  assert.equal(resErrProtoBytes.http_status, 400, 'Inherited payloadBytes in dispatchS3Error must fail closed with 400');
  assert.equal(resErrProtoBytes.error_code, 'InvalidDigest');

  // 3. dispatchS3PutObject and dispatchS3Error with prototype-inherited body
  const protoBody = Object.create({ body: payloadBytes, 'x-amz-content-sha256': validSha });
  const resPutProtoBody = dispatchS3PutObject(protoBody);
  assert.equal(resPutProtoBody.http_status, 400, 'Inherited body in dispatchS3PutObject must fail closed with 400');
  assert.equal(resPutProtoBody.error_code, 'InvalidDigest');

  const resErrProtoBody = dispatchS3Error(protoBody);
  assert.equal(resErrProtoBody.http_status, 400, 'Inherited body in dispatchS3Error must fail closed with 400');
  assert.equal(resErrProtoBody.error_code, 'InvalidDigest');

  // 4. dispatchS3PutObject and dispatchS3Error with prototype-inherited headers
  const protoHeaders = Object.create({
    headers: { 'x-amz-content-sha256': validSha },
    payloadBytes,
  });
  const resPutProtoHeaders = dispatchS3PutObject(protoHeaders);
  assert.equal(resPutProtoHeaders.http_status, 400, 'Inherited headers in dispatchS3PutObject must fail closed with 400');
  assert.equal(resPutProtoHeaders.error_code, 'InvalidDigest');
  assert.equal(resPutProtoHeaders.reason, 'MALFORMED_HEADER_SYNTAX');

  const resErrProtoHeaders = dispatchS3Error(protoHeaders);
  assert.equal(resErrProtoHeaders.http_status, 400, 'Inherited headers in dispatchS3Error must fail closed with 400');
  assert.equal(resErrProtoHeaders.error_code, 'InvalidDigest');
  assert.equal(resErrProtoHeaders.reason, 'MALFORMED_HEADER_SYNTAX');

  // 5. dispatchS3CompleteMultipartUpload with prototype-inherited parts
  const validPartsList = [
    { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 },
  ];
  const validStoredMap = new Map([
    [1, { part_number: 1, etag: '"d41d8cd98f00b204e9800998ecf8427e"', size_bytes: 5242880 }],
  ]);

  const protoPartsManifest = Object.create({ parts: validPartsList });
  const resProtoParts = dispatchS3CompleteMultipartUpload(protoPartsManifest, validStoredMap);
  assert.equal(resProtoParts.http_status, 400, 'Inherited parts in dispatchS3CompleteMultipartUpload must fail closed with 400');
  assert.equal(resProtoParts.error_code, 'InvalidArgument');
  assert.equal(resProtoParts.reason, 'NonPlainPrototypeWrapper');

  // 6. dispatchS3CompleteMultipartUpload with prototype-inherited manifest wrapper
  const protoManifestWrap = Object.create({
    manifest: { parts: validPartsList },
    storedParts: validStoredMap,
  });
  const resProtoWrap = dispatchS3CompleteMultipartUpload(protoManifestWrap);
  assert.equal(resProtoWrap.http_status, 400, 'Inherited manifest wrapper in dispatchS3CompleteMultipartUpload must fail closed with 400');
  assert.equal(resProtoWrap.error_code, 'InvalidArgument');
  assert.equal(resProtoWrap.reason, 'NonPlainPrototypeWrapper');

  // 7. validateS3MultipartSemantics with prototype-inherited parts throws semantic error
  assert.throws(
    () => validateS3MultipartSemantics(protoPartsManifest),
    /Semantic error: multipart upload manifest parts array must be an own property \(inherited parts prohibited\)/,
    'validateS3MultipartSemantics must reject inherited parts array'
  );

  // 8. dispatchS3CompleteMultipartUpload with prototype-inherited total_parts or total_size_bytes on Object.prototype
  try {
    Object.prototype.total_parts = 999;
    const plainManifestTotalParts = { parts: validPartsList };
    const resProtoTotalParts = dispatchS3CompleteMultipartUpload(plainManifestTotalParts, validStoredMap);
    assert.equal(resProtoTotalParts.http_status, 400, 'Inherited total_parts must fail closed with 400');
    assert.equal(resProtoTotalParts.error_code, 'InvalidPart');
    assert.equal(resProtoTotalParts.reason, 'TotalPartsMismatch');
  } finally {
    delete Object.prototype.total_parts;
  }

  try {
    Object.prototype.total_size_bytes = 999;
    const plainManifestTotalSize = { parts: validPartsList };
    const resProtoTotalSize = dispatchS3CompleteMultipartUpload(plainManifestTotalSize, validStoredMap);
    assert.equal(resProtoTotalSize.http_status, 400, 'Inherited total_size_bytes must fail closed with 400');
    assert.equal(resProtoTotalSize.error_code, 'InvalidPart');
    assert.equal(resProtoTotalSize.reason, 'TotalSizeMismatch');
  } finally {
    delete Object.prototype.total_size_bytes;
  }

  // 9. dispatchS3PutObject / dispatchS3Error with prototype-inherited sha256 or md5 direct keys
  const protoDirectSha = Object.create({ 'x-amz-content-sha256': validSha });
  protoDirectSha.payloadBytes = payloadBytes;
  const resPutProtoDirectSha = dispatchS3PutObject(protoDirectSha);
  assert.equal(resPutProtoDirectSha.http_status, 400, 'Inherited direct sha256 header must fail closed with 400');
  assert.equal(resPutProtoDirectSha.error_code, 'InvalidDigest');

  const resErrProtoDirectSha = dispatchS3Error(protoDirectSha);
  assert.equal(resErrProtoDirectSha.http_status, 400, 'Inherited direct sha256 header in dispatchS3Error must fail closed with 400');
  assert.equal(resErrProtoDirectSha.error_code, 'InvalidDigest');
});

test('non-enumerable inherited prototype properties fail closed with HTTP 400 InvalidDigest (MALFORMED_HEADER_SYNTAX) (OPEN-2 / OPEN-5)', () => {
  const payloadBytes = Buffer.from('CYBRIK_NON_ENUMERABLE_INHERITED_HEADERS_2026');
  const validSha = computePayloadSha256(payloadBytes);
  const validMd5 = computePayloadMd5(payloadBytes);

  // 1. Direct non-enumerable inherited x-amz-content-sha256
  const protoSha = Object.defineProperty({}, 'x-amz-content-sha256', {
    value: 'UNSIGNED-PAYLOAD',
    enumerable: false,
    configurable: true,
    writable: true,
  });
  const optDirectSha = Object.create(protoSha);
  optDirectSha.payloadBytes = payloadBytes;

  const resPutDirectSha = dispatchS3PutObject(optDirectSha);
  assert.equal(resPutDirectSha.http_status, 400);
  assert.equal(resPutDirectSha.error_code, 'InvalidDigest');
  assert.equal(resPutDirectSha.code, 'InvalidDigest');
  assert.equal(resPutDirectSha.reason, 'MALFORMED_HEADER_SYNTAX');

  const resErrDirectSha = dispatchS3Error(optDirectSha);
  assert.equal(resErrDirectSha.http_status, 400);
  assert.equal(resErrDirectSha.error_code, 'InvalidDigest');
  assert.equal(resErrDirectSha.code, 'InvalidDigest');
  assert.equal(resErrDirectSha.reason, 'MALFORMED_HEADER_SYNTAX');

  // 2. Direct non-enumerable inherited contentMd5Header / Content-MD5
  const protoMd5 = Object.defineProperty({}, 'contentMd5Header', {
    value: validMd5,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  const optDirectMd5 = Object.create(protoMd5);
  optDirectMd5.payloadBytes = payloadBytes;
  optDirectMd5['x-amz-content-sha256'] = validSha;

  const resPutDirectMd5 = dispatchS3PutObject(optDirectMd5);
  assert.equal(resPutDirectMd5.http_status, 400);
  assert.equal(resPutDirectMd5.error_code, 'InvalidDigest');
  assert.equal(resPutDirectMd5.reason, 'MALFORMED_HEADER_SYNTAX');

  const resErrDirectMd5 = dispatchS3Error(optDirectMd5);
  assert.equal(resErrDirectMd5.http_status, 400);
  assert.equal(resErrDirectMd5.error_code, 'InvalidDigest');
  assert.equal(resErrDirectMd5.reason, 'MALFORMED_HEADER_SYNTAX');

  // 3. Non-enumerable inherited property inside headers object
  const protoHdr = Object.defineProperty({}, 'x-amz-content-sha256', {
    value: 'UNSIGNED-PAYLOAD',
    enumerable: false,
    configurable: true,
    writable: true,
  });
  const optNestedHdr = {
    payloadBytes,
    headers: Object.create(protoHdr),
  };

  const resPutNestedHdr = dispatchS3PutObject(optNestedHdr);
  assert.equal(resPutNestedHdr.http_status, 400);
  assert.equal(resPutNestedHdr.error_code, 'InvalidDigest');
  assert.equal(resPutNestedHdr.reason, 'MALFORMED_HEADER_SYNTAX');

  const resErrNestedHdr = dispatchS3Error(optNestedHdr);
  assert.equal(resErrNestedHdr.http_status, 400);
  assert.equal(resErrNestedHdr.error_code, 'InvalidDigest');
  assert.equal(resErrNestedHdr.reason, 'MALFORMED_HEADER_SYNTAX');

  // 4. Non-enumerable inherited Content-MD5 inside headers object
  const protoHdrMd5 = Object.defineProperty({}, 'Content-MD5', {
    value: validMd5,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  const optNestedHdrMd5 = {
    payloadBytes,
    'x-amz-content-sha256': validSha,
    headers: Object.create(protoHdrMd5),
  };

  const resPutNestedMd5 = dispatchS3PutObject(optNestedHdrMd5);
  assert.equal(resPutNestedMd5.http_status, 400);
  assert.equal(resPutNestedMd5.error_code, 'InvalidDigest');
  assert.equal(resPutNestedMd5.reason, 'MALFORMED_HEADER_SYNTAX');

  const resErrNestedMd5 = dispatchS3Error(optNestedHdrMd5);
  assert.equal(resErrNestedMd5.http_status, 400);
  assert.equal(resErrNestedMd5.error_code, 'InvalidDigest');
  assert.equal(resErrNestedMd5.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('dispatchS3CompleteMultipartUpload and validateS3MultipartSemantics plain prototype and own-only field extraction (OPEN-2 / Finding 1)', () => {
  const validEtag = '"d41d8cd98f00b204e9800998ecf8427e"';
  const validPart = { part_number: 1, etag: validEtag, size_bytes: 5242880 };
  const validStoredMap = new Map([[1, { part_number: 1, etag: validEtag, size_bytes: 5242880 }]]);

  // 1. Non-plain prototype wrapper -> NonPlainPrototypeWrapper
  const protoWrapper = Object.create({ manifest: { parts: [validPart] }, storedParts: validStoredMap });
  const resWrap = dispatchS3CompleteMultipartUpload(protoWrapper);
  assert.equal(resWrap.http_status, 400);
  assert.equal(resWrap.error_code, 'InvalidArgument');
  assert.equal(resWrap.reason, 'NonPlainPrototypeWrapper');

  // 2. Non-plain prototype manifest in wrapper -> NonPlainPrototypeManifest
  const protoManifest = Object.create({ parts: [validPart] });
  const resManifest = dispatchS3CompleteMultipartUpload({ manifest: protoManifest, storedParts: validStoredMap });
  assert.equal(resManifest.http_status, 400);
  assert.equal(resManifest.error_code, 'InvalidArgument');
  assert.equal(resManifest.reason, 'NonPlainPrototypeManifest');

  // 3. Non-plain prototype part in manifest.parts -> NonPlainPrototypePart
  const protoPart = Object.create(validPart);
  const resPart = dispatchS3CompleteMultipartUpload({ parts: [protoPart], storedParts: validStoredMap });
  assert.equal(resPart.http_status, 400);
  assert.equal(resPart.error_code, 'InvalidPart');
  assert.equal(resPart.reason, 'NonPlainPrototypePart');

  // 4. Non-plain prototype stored part in Map -> NonPlainPrototypeStoredPart
  const protoStoredMap = new Map([[1, Object.create(validPart)]]);
  const resStoredMap = dispatchS3CompleteMultipartUpload({ parts: [validPart], storedParts: protoStoredMap });
  assert.equal(resStoredMap.http_status, 400);
  assert.equal(resStoredMap.error_code, 'InvalidPart');
  assert.equal(resStoredMap.reason, 'NonPlainPrototypeStoredPart');

  // 5. Non-plain prototype stored part in Object -> NonPlainPrototypeStoredPart
  const protoStoredObj = { 1: Object.create(validPart) };
  const resStoredObj = dispatchS3CompleteMultipartUpload({ parts: [validPart], storedParts: protoStoredObj });
  assert.equal(resStoredObj.http_status, 400);
  assert.equal(resStoredObj.error_code, 'InvalidPart');
  assert.equal(resStoredObj.reason, 'NonPlainPrototypeStoredPart');

  // 6. Null-prototype objects (Object.create(null)) are valid plain objects
  const nullProtoPart = Object.create(null);
  nullProtoPart.part_number = 1;
  nullProtoPart.etag = validEtag;
  nullProtoPart.size_bytes = 5242880;

  const nullProtoManifest = Object.create(null);
  nullProtoManifest.parts = [nullProtoPart];

  const nullProtoStoredPart = Object.create(null);
  nullProtoStoredPart.part_number = 1;
  nullProtoStoredPart.etag = validEtag;
  nullProtoStoredPart.size_bytes = 5242880;

  const nullProtoWrapper = Object.create(null);
  nullProtoWrapper.manifest = nullProtoManifest;
  nullProtoWrapper.storedParts = new Map([[1, nullProtoStoredPart]]);

  const resNullProto = dispatchS3CompleteMultipartUpload(nullProtoWrapper);
  assert.equal(resNullProto.http_status, 200);
  assert.equal(resNullProto.error_code, null);

  // 7. validateS3MultipartSemantics rejects non-plain parts
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [protoPart] }),
    /Semantic error: multipart (?:upload )?manifest part/
  );

  // 8. validateS3MultipartSemantics accepts null-prototype manifest and parts
  assert.equal(validateS3MultipartSemantics(nullProtoManifest), true);
});

test('class-instance wrapper fails closed with HTTP 400 InvalidArgument in dispatchS3CompleteMultipartUpload (OPEN-2 / Personal-B)', () => {
  const validEtag = '"d41d8cd98f00b204e9800998ecf8427e"';
  const validStoredMap = new Map([
    [1, { part_number: 1, etag: validEtag, size_bytes: 5242880 }],
  ]);

  // 1. Class instance wrapper with getter for manifest
  class ManifestGetterWrapper {
    get manifest() {
      return { parts: [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }] };
    }
  }
  const resManifestGetter = dispatchS3CompleteMultipartUpload(new ManifestGetterWrapper(), validStoredMap);
  assert.equal(resManifestGetter.http_status, 400);
  assert.equal(resManifestGetter.error_code, 'InvalidArgument');
  assert.equal(resManifestGetter.status, 400);
  assert.equal(resManifestGetter.code, 'InvalidArgument');
  assert.ok(resManifestGetter.reason === 'EmptyPartsList' || resManifestGetter.reason === 'NonPlainPrototypeWrapper');

  // 2. Class instance wrapper with getter for parts
  class PartsGetterWrapper {
    get parts() {
      return [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }];
    }
  }
  const resPartsGetter = dispatchS3CompleteMultipartUpload(new PartsGetterWrapper(), validStoredMap);
  assert.equal(resPartsGetter.http_status, 400);
  assert.equal(resPartsGetter.error_code, 'InvalidArgument');
  assert.equal(resPartsGetter.status, 400);
  assert.equal(resPartsGetter.code, 'InvalidArgument');
  assert.ok(resPartsGetter.reason === 'EmptyPartsList' || resPartsGetter.reason === 'NonPlainPrototypeWrapper');

  // 3. Class instance wrapper with method instead of data property
  class MethodWrapper {
    manifest() {
      return { parts: [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }] };
    }
    parts() {
      return [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }];
    }
  }
  const resMethodWrapper = dispatchS3CompleteMultipartUpload(new MethodWrapper(), validStoredMap);
  assert.equal(resMethodWrapper.http_status, 400);
  assert.equal(resMethodWrapper.error_code, 'InvalidArgument');
  assert.equal(resMethodWrapper.status, 400);
  assert.equal(resMethodWrapper.code, 'InvalidArgument');
  assert.ok(resMethodWrapper.reason === 'EmptyPartsList' || resMethodWrapper.reason === 'NonPlainPrototypeWrapper');

  // 4. Empty class instance
  class EmptyWrapper {}
  const resEmptyWrapper = dispatchS3CompleteMultipartUpload(new EmptyWrapper(), validStoredMap);
  assert.equal(resEmptyWrapper.http_status, 400);
  assert.equal(resEmptyWrapper.error_code, 'InvalidArgument');
  assert.equal(resEmptyWrapper.status, 400);
  assert.equal(resEmptyWrapper.code, 'InvalidArgument');
  assert.ok(resEmptyWrapper.reason === 'EmptyPartsList' || resEmptyWrapper.reason === 'NonPlainPrototypeWrapper');
});

test('prototype-inherited part_number, etag, and size_bytes fail closed with HTTP 400 InvalidPart in dispatchS3CompleteMultipartUpload (OPEN-2 / Personal-B)', () => {
  const validEtag = '"d41d8cd98f00b204e9800998ecf8427e"';
  const validStoredMap = new Map([
    [1, { part_number: 1, etag: validEtag, size_bytes: 5242880 }],
  ]);

  // 1. Prototype-inherited part_number on manifest part
  const protoPartNum = Object.create({ part_number: 1, etag: validEtag });
  const resProtoPartNum = dispatchS3CompleteMultipartUpload({ parts: [protoPartNum] }, validStoredMap);
  assert.equal(resProtoPartNum.http_status, 400);
  assert.equal(resProtoPartNum.error_code, 'InvalidPart');
  assert.equal(resProtoPartNum.status, 400);
  assert.equal(resProtoPartNum.code, 'InvalidPart');

  // 2. Prototype-inherited etag on manifest part (with own part_number)
  const protoPartEtag = Object.create({ etag: validEtag });
  protoPartEtag.part_number = 1;
  const resProtoPartEtag = dispatchS3CompleteMultipartUpload({ parts: [protoPartEtag] }, validStoredMap);
  assert.equal(resProtoPartEtag.http_status, 400);
  assert.equal(resProtoPartEtag.error_code, 'InvalidPart');
  assert.equal(resProtoPartEtag.status, 400);
  assert.equal(resProtoPartEtag.code, 'InvalidPart');

  // 3. Prototype-inherited etag on stored part (with own size_bytes and part_number)
  const protoStoredEtagPart = Object.create({ etag: validEtag, size_bytes: 5242880 });
  protoStoredEtagPart.part_number = 1;
  const storedProtoEtagMap = new Map([[1, protoStoredEtagPart]]);
  const resProtoStoredEtag = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: validEtag }] },
    storedProtoEtagMap
  );
  assert.equal(resProtoStoredEtag.http_status, 400);
  assert.equal(resProtoStoredEtag.error_code, 'InvalidPart');
  assert.equal(resProtoStoredEtag.status, 400);
  assert.equal(resProtoStoredEtag.code, 'InvalidPart');

  // 4. Prototype-inherited size_bytes on stored part (with own etag and part_number)
  const protoStoredSizePart = Object.create({ size_bytes: 5242880 });
  protoStoredSizePart.etag = validEtag;
  protoStoredSizePart.part_number = 1;
  const storedProtoSizeMap = new Map([[1, protoStoredSizePart]]);
  const resProtoStoredSize = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: validEtag }] },
    storedProtoSizeMap
  );
  assert.equal(resProtoStoredSize.http_status, 400);
  assert.equal(resProtoStoredSize.error_code, 'InvalidPart');
  assert.equal(resProtoStoredSize.status, 400);
  assert.equal(resProtoStoredSize.code, 'InvalidPart');

  // 5. Prototype-inherited etag and size_bytes on stored part in Map
  const protoStoredPartBoth = Object.create({ etag: validEtag, size_bytes: 5242880 });
  const storedProtoBothMap = new Map([[1, protoStoredPartBoth]]);
  const resProtoBothStored = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: validEtag }] },
    storedProtoBothMap
  );
  assert.equal(resProtoBothStored.http_status, 400);
  assert.equal(resProtoBothStored.error_code, 'InvalidPart');
  assert.equal(resProtoBothStored.status, 400);
  assert.equal(resProtoBothStored.code, 'InvalidPart');

  // 6. Prototype-inherited stored parts dictionary object (Object.create({ 1: { ... } }))
  const protoStoredObj = Object.create({
    1: { part_number: 1, etag: validEtag, size_bytes: 5242880 },
  });
  const resProtoStoredObj = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: validEtag }] },
    protoStoredObj
  );
  assert.equal(resProtoStoredObj.http_status, 400);
  assert.equal(resProtoStoredObj.error_code, 'InvalidPart');
  assert.equal(resProtoStoredObj.status, 400);
  assert.equal(resProtoStoredObj.code, 'InvalidPart');
});

test('validateS3MultipartSemantics throws Semantic error on non-plain prototype manifests and parts (OPEN-2 / Personal-B)', () => {
  const validEtag = '"d41d8cd98f00b204e9800998ecf8427e"';

  // 1. Prototype-inherited parts array on manifest
  const protoManifestParts = Object.create({
    parts: [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }],
  });
  assert.throws(
    () => validateS3MultipartSemantics(protoManifestParts),
    /Semantic error: multipart upload manifest parts array must be an own property \(inherited parts prohibited\)/
  );

  // 2. Prototype-inherited total_parts on manifest
  const protoManifestTotalParts = Object.create({ total_parts: 1 });
  protoManifestTotalParts.parts = [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }];
  assert.throws(
    () => validateS3MultipartSemantics(protoManifestTotalParts),
    /Semantic error: multipart upload manifest total_parts must be an own property \(inherited total_parts prohibited\)/
  );

  // 3. Prototype-inherited total_size_bytes on manifest
  const protoManifestTotalSize = Object.create({ total_size_bytes: 5242880 });
  protoManifestTotalSize.parts = [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }];
  assert.throws(
    () => validateS3MultipartSemantics(protoManifestTotalSize),
    /Semantic error: multipart upload manifest total_size_bytes must be an own property \(inherited total_size_bytes prohibited\)/
  );

  // 4. Prototype-inherited part_number on part
  const protoPartNum = Object.create({ part_number: 1 });
  protoPartNum.etag = validEtag;
  protoPartNum.size_bytes = 5242880;
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [protoPartNum] }),
    /Semantic error: multipart manifest part part_number must be an own property \(inherited part_number prohibited\)/
  );

  // 5. Prototype-inherited etag on part
  const protoPartEtag = Object.create({ etag: validEtag });
  protoPartEtag.part_number = 1;
  protoPartEtag.size_bytes = 5242880;
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [protoPartEtag] }),
    /Semantic error: multipart manifest part etag must be an own property \(inherited etag prohibited\)/
  );

  // 6. Prototype-inherited size_bytes on part
  const protoPartSize = Object.create({ size_bytes: 5242880 });
  protoPartSize.part_number = 1;
  protoPartSize.etag = validEtag;
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [protoPartSize] }),
    /Semantic error: multipart manifest part size_bytes must be an own property \(inherited size_bytes prohibited\)/
  );

  // 7. Class-instance manifest wrapper with getter for parts
  class ClassManifest {
    get parts() {
      return [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }];
    }
  }
  assert.throws(
    () => validateS3MultipartSemantics(new ClassManifest()),
    /Semantic error: multipart upload manifest parts array must be an own property \(inherited parts prohibited\)/
  );

  // 8. Class-instance part with getters on prototype
  class ClassPart {
    get part_number() {
      return 1;
    }
    get etag() {
      return validEtag;
    }
    get size_bytes() {
      return 5242880;
    }
  }
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [new ClassPart()] }),
    /Semantic error: multipart manifest part part_number must be an own property \(inherited part_number prohibited\)/
  );
});

test('dispatchS3CompleteMultipartUpload rejects direct Array manifests with HTTP 400 InvalidArgument (OPEN-2 / OPEN-5)', () => {
  const validEtag = '"d41d8cd98f00b204e9800998ecf8427e"';
  const validPart = { part_number: 1, etag: validEtag, size_bytes: 5242880 };
  const validStoredMap = new Map([[1, { part_number: 1, etag: validEtag, size_bytes: 5242880 }]]);

  // 1. Direct non-empty Array passed as manifestOrOptions
  const directArray = [validPart];
  const resDirectArray = dispatchS3CompleteMultipartUpload(directArray, validStoredMap);
  assert.equal(resDirectArray.http_status, 400);
  assert.equal(resDirectArray.error_code, 'InvalidArgument');
  assert.equal(resDirectArray.status, 400);
  assert.equal(resDirectArray.code, 'InvalidArgument');

  // 2. Direct empty Array passed as manifestOrOptions
  const resDirectEmpty = dispatchS3CompleteMultipartUpload([], validStoredMap);
  assert.equal(resDirectEmpty.http_status, 400);
  assert.equal(resDirectEmpty.error_code, 'InvalidArgument');
  assert.equal(resDirectEmpty.status, 400);
  assert.equal(resDirectEmpty.code, 'InvalidArgument');

  // 3. Direct multi-element Array passed without storedParts
  const multiPartArray = [
    { part_number: 1, etag: validEtag, size_bytes: 5242880 },
    { part_number: 2, etag: validEtag, size_bytes: 5242880 },
  ];
  const resMultiArray = dispatchS3CompleteMultipartUpload(multiPartArray);
  assert.equal(resMultiArray.http_status, 400);
  assert.equal(resMultiArray.error_code, 'InvalidArgument');
  assert.equal(resMultiArray.status, 400);
  assert.equal(resMultiArray.code, 'InvalidArgument');
});

test('dispatchS3CompleteMultipartUpload rejects storedParts with unreferenced null, primitive, function, or non-plain entries with HTTP 400 InvalidPart (OPEN-2 / OPEN-5)', () => {
  const validEtag = '"d41d8cd98f00b204e9800998ecf8427e"';
  const manifest = {
    parts: [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }],
  };
  const validPart = { part_number: 1, etag: validEtag, size_bytes: 5242880 };

  // 1. Map storedParts containing unreferenced null entry
  const mapWithNull = new Map([
    [1, validPart],
    [2, null],
  ]);
  const resMapNull = dispatchS3CompleteMultipartUpload(manifest, mapWithNull);
  assert.equal(resMapNull.http_status, 400);
  assert.equal(resMapNull.error_code, 'InvalidPart');
  assert.equal(resMapNull.status, 400);
  assert.equal(resMapNull.code, 'InvalidPart');

  // 2. Map storedParts containing unreferenced primitive number entry
  const mapWithNumber = new Map([
    [1, validPart],
    [2, 12345],
  ]);
  const resMapNum = dispatchS3CompleteMultipartUpload(manifest, mapWithNumber);
  assert.equal(resMapNum.http_status, 400);
  assert.equal(resMapNum.error_code, 'InvalidPart');
  assert.equal(resMapNum.status, 400);
  assert.equal(resMapNum.code, 'InvalidPart');

  // 3. Map storedParts containing unreferenced primitive string entry
  const mapWithString = new Map([
    [1, validPart],
    [2, 'invalid-primitive-part'],
  ]);
  const resMapStr = dispatchS3CompleteMultipartUpload(manifest, mapWithString);
  assert.equal(resMapStr.http_status, 400);
  assert.equal(resMapStr.error_code, 'InvalidPart');
  assert.equal(resMapStr.status, 400);
  assert.equal(resMapStr.code, 'InvalidPart');

  // 4. Map storedParts containing unreferenced primitive boolean entry
  const mapWithBool = new Map([
    [1, validPart],
    [2, true],
  ]);
  const resMapBool = dispatchS3CompleteMultipartUpload(manifest, mapWithBool);
  assert.equal(resMapBool.http_status, 400);
  assert.equal(resMapBool.error_code, 'InvalidPart');
  assert.equal(resMapBool.status, 400);
  assert.equal(resMapBool.code, 'InvalidPart');

  // 5. Map storedParts containing unreferenced function entry
  const mapWithFunc = new Map([
    [1, validPart],
    [2, () => ({ etag: validEtag, size_bytes: 5242880 })],
  ]);
  const resMapFunc = dispatchS3CompleteMultipartUpload(manifest, mapWithFunc);
  assert.equal(resMapFunc.http_status, 400);
  assert.equal(resMapFunc.error_code, 'InvalidPart');
  assert.equal(resMapFunc.status, 400);
  assert.equal(resMapFunc.code, 'InvalidPart');

  // 6. Map storedParts containing unreferenced non-plain prototype entry
  const mapWithNonPlain = new Map([
    [1, validPart],
    [2, Object.create({ part_number: 2, etag: validEtag, size_bytes: 5242880 })],
  ]);
  const resMapNonPlain = dispatchS3CompleteMultipartUpload(manifest, mapWithNonPlain);
  assert.equal(resMapNonPlain.http_status, 400);
  assert.equal(resMapNonPlain.error_code, 'InvalidPart');
  assert.equal(resMapNonPlain.status, 400);
  assert.equal(resMapNonPlain.code, 'InvalidPart');

  // 7. Object storedParts containing unreferenced null entry
  const objWithNull = {
    1: validPart,
    2: null,
  };
  const resObjNull = dispatchS3CompleteMultipartUpload(manifest, objWithNull);
  assert.equal(resObjNull.http_status, 400);
  assert.equal(resObjNull.error_code, 'InvalidPart');
  assert.equal(resObjNull.status, 400);
  assert.equal(resObjNull.code, 'InvalidPart');

  // 8. Object storedParts containing unreferenced primitive number entry
  const objWithNumber = {
    1: validPart,
    2: 99999,
  };
  const resObjNum = dispatchS3CompleteMultipartUpload(manifest, objWithNumber);
  assert.equal(resObjNum.http_status, 400);
  assert.equal(resObjNum.error_code, 'InvalidPart');
  assert.equal(resObjNum.status, 400);
  assert.equal(resObjNum.code, 'InvalidPart');

  // 9. Object storedParts containing unreferenced primitive string entry
  const objWithString = {
    1: validPart,
    2: 'not-a-part-object',
  };
  const resObjStr = dispatchS3CompleteMultipartUpload(manifest, objWithString);
  assert.equal(resObjStr.http_status, 400);
  assert.equal(resObjStr.error_code, 'InvalidPart');
  assert.equal(resObjStr.status, 400);
  assert.equal(resObjStr.code, 'InvalidPart');

  // 10. Object storedParts containing unreferenced function entry
  const objWithFunc = {
    1: validPart,
    2: function () {},
  };
  const resObjFunc = dispatchS3CompleteMultipartUpload(manifest, objWithFunc);
  assert.equal(resObjFunc.http_status, 400);
  assert.equal(resObjFunc.error_code, 'InvalidPart');
  assert.equal(resObjFunc.status, 400);
  assert.equal(resObjFunc.code, 'InvalidPart');

  // 11. Object storedParts containing unreferenced non-plain prototype entry
  const objWithNonPlain = {
    1: validPart,
    2: Object.create(validPart),
  };
  const resObjNonPlain = dispatchS3CompleteMultipartUpload(manifest, objWithNonPlain);
  assert.equal(resObjNonPlain.http_status, 400);
  assert.equal(resObjNonPlain.error_code, 'InvalidPart');
  assert.equal(resObjNonPlain.status, 400);
  assert.equal(resObjNonPlain.code, 'InvalidPart');

  // 12. Array storedParts containing unreferenced null / primitive / function / non-plain
  const arrWithNull = [validPart, null];
  const resArrNull = dispatchS3CompleteMultipartUpload(manifest, arrWithNull);
  assert.equal(resArrNull.http_status, 400);
  assert.equal(resArrNull.error_code, 'InvalidPart');

  const arrWithPrimitive = [validPart, 42];
  const resArrPrim = dispatchS3CompleteMultipartUpload(manifest, arrWithPrimitive);
  assert.equal(resArrPrim.http_status, 400);
  assert.equal(resArrPrim.error_code, 'InvalidPart');

  const arrWithFunc = [validPart, () => {}];
  const resArrFunc = dispatchS3CompleteMultipartUpload(manifest, arrWithFunc);
  assert.equal(resArrFunc.http_status, 400);
  assert.equal(resArrFunc.error_code, 'InvalidPart');

  const arrWithNonPlain = [validPart, Object.create(validPart)];
  const resArrNonPlain = dispatchS3CompleteMultipartUpload(manifest, arrWithNonPlain);
  assert.equal(resArrNonPlain.http_status, 400);
  assert.equal(resArrNonPlain.error_code, 'InvalidPart');
});

test('payload type-gating across computePayloadSha256, computePayloadMd5, dispatchS3PutObject, and dispatchS3Error (OPEN-2 / OPEN-5)', () => {
  const validPayloadStr = 'CYBRIK_PAYLOAD_STRING_TEST_2026';
  const validPayloadBuf = Buffer.from(validPayloadStr);
  const validPayloadUint8 = new Uint8Array(validPayloadBuf);

  const validSha = computePayloadSha256(validPayloadBuf);
  const validMd5 = computePayloadMd5(validPayloadBuf);

  // 1. Valid types (string, Buffer, Uint8Array) pass in computePayloadSha256 and computePayloadMd5
  assert.equal(computePayloadSha256(validPayloadStr), validSha);
  assert.equal(computePayloadSha256(validPayloadBuf), validSha);
  assert.equal(computePayloadSha256(validPayloadUint8), validSha);
  assert.equal(computePayloadMd5(validPayloadStr), validMd5);
  assert.equal(computePayloadMd5(validPayloadBuf), validMd5);
  assert.equal(computePayloadMd5(validPayloadUint8), validMd5);

  // 2. Invalid types throw TypeError in computePayloadSha256 and computePayloadMd5
  const nonTypePayloads = [null, undefined];
  const malformedPayloads = [
    { key: 'object' },
    12345,
    true,
    ['array', 'item'],
    () => 'func',
    Symbol('sym'),
    new Date(),
    new Uint16Array([1, 2, 3]),
    new Uint32Array([10, 20]),
  ];

  for (const inv of [...nonTypePayloads, ...malformedPayloads]) {
    assert.throws(() => computePayloadSha256(inv), TypeError);
    assert.throws(() => computePayloadMd5(inv), TypeError);
  }

  // 3. dispatchS3PutObject fails closed with HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
  for (const inv of malformedPayloads) {
    const resPutObj = dispatchS3PutObject({ payload: inv, 'x-amz-content-sha256': validSha });
    assert.equal(resPutObj.http_status, 400);
    assert.equal(resPutObj.error_code, 'InvalidDigest');
    assert.equal(resPutObj.reason, 'MALFORMED_PAYLOAD_TYPE');

    const resPutPos = dispatchS3PutObject(inv, validMd5, validSha);
    assert.equal(resPutPos.http_status, 400);
    assert.equal(resPutPos.error_code, 'InvalidDigest');
    assert.equal(resPutPos.reason, 'MALFORMED_PAYLOAD_TYPE');
  }

  // 4. dispatchS3Error fails closed with HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
  for (const inv of malformedPayloads) {
    const resErrObj = dispatchS3Error({ payload: inv, contentMd5Header: validMd5 });
    assert.equal(resErrObj.http_status, 400);
    assert.equal(resErrObj.error_code, 'InvalidDigest');
    assert.equal(resErrObj.reason, 'MALFORMED_PAYLOAD_TYPE');

    const resErrPos = dispatchS3Error(inv, validMd5);
    assert.equal(resErrPos.http_status, 400);
    assert.equal(resErrPos.error_code, 'InvalidDigest');
    assert.equal(resErrPos.reason, 'MALFORMED_PAYLOAD_TYPE');
  }

  // 5. dispatchS3Error with condition string 'MALFORMED_PAYLOAD_TYPE' returns InvalidDigest
  const strRes = dispatchS3Error('MALFORMED_PAYLOAD_TYPE');
  assert.equal(strRes.http_status, 400);
  assert.equal(strRes.error_code, 'InvalidDigest');
  assert.equal(strRes.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('regression: structured object payloads fail closed with HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE) in dispatchS3PutObject and dispatchS3Error (OPEN-2 / OPEN-5)', () => {
  const malformedPayloads = [
    { a: 1 },
    { b: 2 },
    [1, 2, 3],
    12345,
    true,
    false,
    () => 'func_bad',
    new Date(),
    new Uint16Array([4, 5, 6]),
  ];

  const validMd5 = '1B2M2Y8AsgTpgAmY7PhCfg==';
  const validSha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  for (const badPayload of malformedPayloads) {
    // 1. dispatchS3PutObject with direct structured payload
    const resDirect = dispatchS3PutObject(badPayload);
    assert.equal(resDirect.http_status, 400);
    assert.equal(resDirect.error_code, 'InvalidDigest');
    assert.equal(resDirect.status, 400);
    assert.equal(resDirect.code, 'InvalidDigest');
    assert.equal(resDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 2. dispatchS3PutObject with positional payload and valid headers
    const resPositional = dispatchS3PutObject(badPayload, validMd5, validSha);
    assert.equal(resPositional.http_status, 400);
    assert.equal(resPositional.error_code, 'InvalidDigest');
    assert.equal(resPositional.status, 400);
    assert.equal(resPositional.code, 'InvalidDigest');
    assert.equal(resPositional.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 3. dispatchS3PutObject with options wrapper containing payload
    const resOptPayload = dispatchS3PutObject({
      payload: badPayload,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    });
    assert.equal(resOptPayload.http_status, 400);
    assert.equal(resOptPayload.error_code, 'InvalidDigest');
    assert.equal(resOptPayload.status, 400);
    assert.equal(resOptPayload.code, 'InvalidDigest');
    assert.equal(resOptPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 4. dispatchS3PutObject with options wrapper containing payloadBytes
    const resOptBytes = dispatchS3PutObject({
      payloadBytes: badPayload,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    });
    assert.equal(resOptBytes.http_status, 400);
    assert.equal(resOptBytes.error_code, 'InvalidDigest');
    assert.equal(resOptBytes.status, 400);
    assert.equal(resOptBytes.code, 'InvalidDigest');
    assert.equal(resOptBytes.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 5. dispatchS3PutObject with options wrapper containing body
    const resOptBody = dispatchS3PutObject({
      body: badPayload,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    });
    assert.equal(resOptBody.http_status, 400);
    assert.equal(resOptBody.error_code, 'InvalidDigest');
    assert.equal(resOptBody.status, 400);
    assert.equal(resOptBody.code, 'InvalidDigest');
    assert.equal(resOptBody.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 6. dispatchS3Error with direct structured payload
    const resErrDirect = dispatchS3Error(badPayload);
    assert.equal(resErrDirect.http_status, 400);
    assert.equal(resErrDirect.error_code, 'InvalidDigest');
    assert.equal(resErrDirect.status, 400);
    assert.equal(resErrDirect.code, 'InvalidDigest');
    assert.equal(resErrDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 7. dispatchS3Error with positional payload and header
    const resErrPositional = dispatchS3Error(badPayload, validMd5);
    assert.equal(resErrPositional.http_status, 400);
    assert.equal(resErrPositional.error_code, 'InvalidDigest');
    assert.equal(resErrPositional.status, 400);
    assert.equal(resErrPositional.code, 'InvalidDigest');
    assert.equal(resErrPositional.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 8. dispatchS3Error with request options wrapper
    const resErrOpt = dispatchS3Error({
      payload: badPayload,
      contentMd5Header: validMd5,
    });
    assert.equal(resErrOpt.http_status, 400);
    assert.equal(resErrOpt.error_code, 'InvalidDigest');
    assert.equal(resErrOpt.status, 400);
    assert.equal(resErrOpt.code, 'InvalidDigest');
    assert.equal(resErrOpt.reason, 'MALFORMED_PAYLOAD_TYPE');
  }

  // 9. dispatchS3Error with string condition and reason objects
  const resErrStr = dispatchS3Error('MALFORMED_PAYLOAD_TYPE');
  assert.equal(resErrStr.http_status, 400);
  assert.equal(resErrStr.error_code, 'InvalidDigest');
  assert.equal(resErrStr.status, 400);
  assert.equal(resErrStr.code, 'InvalidDigest');
  assert.equal(resErrStr.reason, 'MALFORMED_PAYLOAD_TYPE');

  const resErrReason = dispatchS3Error({ reason: 'MALFORMED_PAYLOAD_TYPE' });
  assert.equal(resErrReason.http_status, 400);
  assert.equal(resErrReason.error_code, 'InvalidDigest');
  assert.equal(resErrReason.status, 400);
  assert.equal(resErrReason.code, 'InvalidDigest');
  assert.equal(resErrReason.reason, 'MALFORMED_PAYLOAD_TYPE');

  const resErrCond = dispatchS3Error({ error_condition: 'MALFORMED_PAYLOAD_TYPE' });
  assert.equal(resErrCond.http_status, 400);
  assert.equal(resErrCond.error_code, 'InvalidDigest');
  assert.equal(resErrCond.status, 400);
  assert.equal(resErrCond.code, 'InvalidDigest');
  assert.equal(resErrCond.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 10. dispatchS3Error with non-plain prototype options returns MALFORMED_HEADER_SYNTAX
  const nonPlainCondition = Object.create({ reason: 'MALFORMED_PAYLOAD_TYPE' });
  const resNonPlain = dispatchS3Error(nonPlainCondition);
  assert.equal(resNonPlain.http_status, 400);
  assert.equal(resNonPlain.error_code, 'InvalidDigest');
  assert.equal(resNonPlain.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('isMalformedPayloadType gating and getOwn accessor defense (OPEN-2 / OPEN-5)', () => {
  // 1. isMalformedPayloadType: null and undefined return true
  assert.equal(isMalformedPayloadType(undefined), true);
  assert.equal(isMalformedPayloadType(null), true);

  // 2. isMalformedPayloadType: string, Buffer, Uint8Array return false
  assert.equal(isMalformedPayloadType('hello'), false);
  assert.equal(isMalformedPayloadType(''), false);
  assert.equal(isMalformedPayloadType(Buffer.from('test')), false);
  assert.equal(isMalformedPayloadType(Buffer.alloc(0)), false);
  assert.equal(isMalformedPayloadType(new Uint8Array([1, 2, 3])), false);
  assert.equal(isMalformedPayloadType(new Uint8Array(0)), false);

  // 3. isMalformedPayloadType: structured, primitive, and other view types return true
  assert.equal(isMalformedPayloadType(123), true);
  assert.equal(isMalformedPayloadType(true), true);
  assert.equal(isMalformedPayloadType(false), true);
  assert.equal(isMalformedPayloadType(Symbol('sym')), true);
  assert.equal(isMalformedPayloadType(123n), true);
  assert.equal(isMalformedPayloadType({}), true);
  assert.equal(isMalformedPayloadType({ a: 1 }), true);
  assert.equal(isMalformedPayloadType([]), true);
  assert.equal(isMalformedPayloadType([1, 2]), true);
  assert.equal(isMalformedPayloadType(() => {}), true);
  assert.equal(isMalformedPayloadType(new Date()), true);
  assert.equal(isMalformedPayloadType(new RegExp('abc')), true);
  assert.equal(isMalformedPayloadType(new Error('err')), true);
  assert.equal(isMalformedPayloadType(new Map()), true);
  assert.equal(isMalformedPayloadType(new Set()), true);
  assert.equal(isMalformedPayloadType(new ArrayBuffer(8)), true);
  assert.equal(isMalformedPayloadType(new Uint16Array([1, 2])), true);
  assert.equal(isMalformedPayloadType(new Uint32Array([1, 2])), true);
  assert.equal(isMalformedPayloadType(new Float32Array([1.5])), true);
  assert.equal(isMalformedPayloadType(new DataView(new ArrayBuffer(8))), true);

  // 4. getOwn: data properties vs accessor properties vs prototype properties
  const plainObj = { foo: 'bar', num: 42 };
  assert.equal(getOwn(plainObj, 'foo'), 'bar');
  assert.equal(getOwn(plainObj, 'num'), 42);
  assert.equal(getOwn(plainObj, 'missing'), undefined);
  assert.equal(getOwn(null, 'foo'), undefined);
  assert.equal(getOwn(undefined, 'foo'), undefined);
  assert.equal(getOwn('string', 'length'), undefined);

  const getterObj = {
    get evil() { return 'getter-value'; },
    safe: 'data-value'
  };
  assert.equal(getOwn(getterObj, 'evil'), undefined);
  assert.equal(getOwn(getterObj, 'safe'), 'data-value');

  const setterObj = {
    set evil(v) {},
    safe: 'data-value'
  };
  assert.equal(getOwn(setterObj, 'evil'), undefined);
  assert.equal(getOwn(setterObj, 'safe'), 'data-value');

  const protoParent = { inherited: 'parent-value' };
  const childObj = Object.create(protoParent);
  childObj.own = 'child-value';
  assert.equal(getOwn(childObj, 'own'), 'child-value');
  assert.equal(getOwn(childObj, 'inherited'), undefined);

  // 5. hasOwnAccessors detection
  assert.equal(hasOwnAccessors(plainObj), false);
  assert.equal(hasOwnAccessors(getterObj), true);
  assert.equal(hasOwnAccessors(setterObj), true);
  assert.equal(hasOwnAccessors(null), false);
  assert.equal(hasOwnAccessors(undefined), false);
  assert.equal(hasOwnAccessors(123), false);

  // 6. Throwing proxy catch branch coverage
  const throwingProxy = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error('descriptor boom');
    },
    ownKeys() {
      throw new Error('ownKeys boom');
    }
  });
  assert.equal(getOwn(throwingProxy, 'prop'), undefined);
  assert.equal(hasOwnAccessors(throwingProxy), true);
});

test('strict dispatch gating: null/undefined and accessor defense fail closed with HTTP 400 InvalidDigest MALFORMED_PAYLOAD_TYPE (OPEN-2 / OPEN-5)', () => {
  const validSha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const validMd5 = '1B2M2Y8AsgTpgAmY7PhCfg==';

  // 1. Direct null and undefined to dispatchS3PutObject
  const putNull = dispatchS3PutObject(null);
  assert.equal(putNull.http_status, 400);
  assert.equal(putNull.error_code, 'InvalidDigest');
  assert.equal(putNull.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putUndef = dispatchS3PutObject(undefined);
  assert.equal(putUndef.http_status, 400);
  assert.equal(putUndef.error_code, 'InvalidDigest');
  assert.equal(putUndef.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putNoArgs = dispatchS3PutObject();
  assert.equal(putNoArgs.http_status, 400);
  assert.equal(putNoArgs.error_code, 'InvalidDigest');
  assert.equal(putNoArgs.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Direct null and undefined to dispatchS3Error
  const errNull = dispatchS3Error(null);
  assert.equal(errNull.http_status, 400);
  assert.equal(errNull.error_code, 'InvalidDigest');
  assert.equal(errNull.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errUndef = dispatchS3Error(undefined);
  assert.equal(errUndef.http_status, 400);
  assert.equal(errUndef.error_code, 'InvalidDigest');
  assert.equal(errUndef.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errNoArgs = dispatchS3Error();
  assert.equal(errNoArgs.http_status, 400);
  assert.equal(errNoArgs.error_code, 'InvalidDigest');
  assert.equal(errNoArgs.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3. Explicit null/undefined payload in options object to dispatchS3PutObject
  const putNullPayload = dispatchS3PutObject({ payload: null, 'x-amz-content-sha256': validSha });
  assert.equal(putNullPayload.http_status, 400);
  assert.equal(putNullPayload.error_code, 'InvalidDigest');
  assert.equal(putNullPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putUndefPayload = dispatchS3PutObject({ payload: undefined, 'x-amz-content-sha256': validSha });
  assert.equal(putUndefPayload.http_status, 400);
  assert.equal(putUndefPayload.error_code, 'InvalidDigest');
  assert.equal(putUndefPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putNullBody = dispatchS3PutObject({ body: null, 'x-amz-content-sha256': validSha });
  assert.equal(putNullBody.http_status, 400);
  assert.equal(putNullBody.error_code, 'InvalidDigest');
  assert.equal(putNullBody.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putNullBytes = dispatchS3PutObject({ payloadBytes: null, 'x-amz-content-sha256': validSha });
  assert.equal(putNullBytes.http_status, 400);
  assert.equal(putNullBytes.error_code, 'InvalidDigest');
  assert.equal(putNullBytes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 4. Explicit null/undefined payload in options object to dispatchS3Error
  const errNullPayload = dispatchS3Error({ payload: null, contentMd5Header: validMd5 });
  assert.equal(errNullPayload.http_status, 400);
  assert.equal(errNullPayload.error_code, 'InvalidDigest');
  assert.equal(errNullPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errUndefPayload = dispatchS3Error({ payload: undefined, contentMd5Header: validMd5 });
  assert.equal(errUndefPayload.http_status, 400);
  assert.equal(errUndefPayload.error_code, 'InvalidDigest');
  assert.equal(errUndefPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errNullBody = dispatchS3Error({ body: null, contentMd5Header: validMd5 });
  assert.equal(errNullBody.http_status, 400);
  assert.equal(errNullBody.error_code, 'InvalidDigest');
  assert.equal(errNullBody.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errNullBytes = dispatchS3Error({ payloadBytes: null, contentMd5Header: validMd5 });
  assert.equal(errNullBytes.http_status, 400);
  assert.equal(errNullBytes.error_code, 'InvalidDigest');
  assert.equal(errNullBytes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 5. Accessor properties on dispatchS3PutObject options
  const putGetterPayload = {
    get payload() { return Buffer.from('payload-from-getter'); },
    'x-amz-content-sha256': validSha
  };
  const resPutGetterPayload = dispatchS3PutObject(putGetterPayload);
  assert.equal(resPutGetterPayload.http_status, 400);
  assert.equal(resPutGetterPayload.error_code, 'InvalidDigest');
  assert.equal(resPutGetterPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putGetterHeaders = {
    payload: Buffer.from('test'),
    get headers() { return { 'x-amz-content-sha256': validSha }; }
  };
  const resPutGetterHeaders = dispatchS3PutObject(putGetterHeaders);
  assert.equal(resPutGetterHeaders.http_status, 400);
  assert.equal(resPutGetterHeaders.error_code, 'InvalidDigest');
  assert.equal(resPutGetterHeaders.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putGetterInsideHeaders = {
    payload: Buffer.from('test'),
    headers: {
      get 'x-amz-content-sha256'() { return validSha; }
    }
  };
  const resPutGetterInsideHeaders = dispatchS3PutObject(putGetterInsideHeaders);
  assert.equal(resPutGetterInsideHeaders.http_status, 400);
  assert.equal(resPutGetterInsideHeaders.error_code, 'InvalidDigest');
  assert.equal(resPutGetterInsideHeaders.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 6. Accessor properties on dispatchS3Error options
  const errGetterPayload = {
    get payload() { return Buffer.from('payload-from-getter'); },
    contentMd5Header: validMd5
  };
  const resErrGetterPayload = dispatchS3Error(errGetterPayload);
  assert.equal(resErrGetterPayload.http_status, 400);
  assert.equal(resErrGetterPayload.error_code, 'InvalidDigest');
  assert.equal(resErrGetterPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errGetterHeaders = {
    payload: Buffer.from('test'),
    get headers() { return { 'content-md5': validMd5 }; }
  };
  const resErrGetterHeaders = dispatchS3Error(errGetterHeaders);
  assert.equal(resErrGetterHeaders.http_status, 400);
  assert.equal(resErrGetterHeaders.error_code, 'InvalidDigest');
  assert.equal(resErrGetterHeaders.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errGetterInsideHeaders = {
    payload: Buffer.from('test'),
    headers: {
      get 'Content-MD5'() { return validMd5; }
    }
  };
  const resErrGetterInsideHeaders = dispatchS3Error(errGetterInsideHeaders);
  assert.equal(resErrGetterInsideHeaders.http_status, 400);
  assert.equal(resErrGetterInsideHeaders.error_code, 'InvalidDigest');
  assert.equal(resErrGetterInsideHeaders.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('regression: null and undefined dispatch return HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE) in dispatchS3PutObject and dispatchS3Error (OPEN-2 / OPEN-5)', () => {
  // 1. dispatchS3PutObject direct null and undefined
  const putNull = dispatchS3PutObject(null);
  assert.equal(putNull.http_status, 400);
  assert.equal(putNull.error_code, 'InvalidDigest');
  assert.equal(putNull.status, 400);
  assert.equal(putNull.code, 'InvalidDigest');
  assert.equal(putNull.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putUndef = dispatchS3PutObject(undefined);
  assert.equal(putUndef.http_status, 400);
  assert.equal(putUndef.error_code, 'InvalidDigest');
  assert.equal(putUndef.status, 400);
  assert.equal(putUndef.code, 'InvalidDigest');
  assert.equal(putUndef.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. dispatchS3PutObject options with payload: null and payload: undefined
  const putOptNull = dispatchS3PutObject({ payload: null });
  assert.equal(putOptNull.http_status, 400);
  assert.equal(putOptNull.error_code, 'InvalidDigest');
  assert.equal(putOptNull.status, 400);
  assert.equal(putOptNull.code, 'InvalidDigest');
  assert.equal(putOptNull.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putOptUndef = dispatchS3PutObject({ payload: undefined });
  assert.equal(putOptUndef.http_status, 400);
  assert.equal(putOptUndef.error_code, 'InvalidDigest');
  assert.equal(putOptUndef.status, 400);
  assert.equal(putOptUndef.code, 'InvalidDigest');
  assert.equal(putOptUndef.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3. dispatchS3Error direct null and undefined
  const errNull = dispatchS3Error(null);
  assert.equal(errNull.http_status, 400);
  assert.equal(errNull.error_code, 'InvalidDigest');
  assert.equal(errNull.status, 400);
  assert.equal(errNull.code, 'InvalidDigest');
  assert.equal(errNull.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errUndef = dispatchS3Error(undefined);
  assert.equal(errUndef.http_status, 400);
  assert.equal(errUndef.error_code, 'InvalidDigest');
  assert.equal(errUndef.status, 400);
  assert.equal(errUndef.code, 'InvalidDigest');
  assert.equal(errUndef.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('regression: accessor properties in dispatchS3PutObject and dispatchS3Error return HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE) without throwing (OPEN-2 / OPEN-5)', () => {
  // 1. Accessor getter for payload that throws or returns value in dispatchS3PutObject
  const throwPayloadGetter = {
    get payload() {
      throw new Error('Explosive payload accessor');
    }
  };
  const resPutThrowPayload = dispatchS3PutObject(throwPayloadGetter);
  assert.equal(resPutThrowPayload.http_status, 400);
  assert.equal(resPutThrowPayload.error_code, 'InvalidDigest');
  assert.equal(resPutThrowPayload.status, 400);
  assert.equal(resPutThrowPayload.code, 'InvalidDigest');
  assert.equal(resPutThrowPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const returnPayloadGetter = {
    get payload() {
      return 'data-from-getter';
    }
  };
  const resPutReturnPayload = dispatchS3PutObject(returnPayloadGetter);
  assert.equal(resPutReturnPayload.http_status, 400);
  assert.equal(resPutReturnPayload.error_code, 'InvalidDigest');
  assert.equal(resPutReturnPayload.status, 400);
  assert.equal(resPutReturnPayload.code, 'InvalidDigest');
  assert.equal(resPutReturnPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Accessor getter for code that throws or returns value in dispatchS3PutObject
  const throwCodeGetter = {
    get code() {
      throw new Error('Explosive code accessor');
    }
  };
  const resPutThrowCode = dispatchS3PutObject(throwCodeGetter);
  assert.equal(resPutThrowCode.http_status, 400);
  assert.equal(resPutThrowCode.error_code, 'InvalidDigest');
  assert.equal(resPutThrowCode.status, 400);
  assert.equal(resPutThrowCode.code, 'InvalidDigest');
  assert.equal(resPutThrowCode.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3. Accessor getter for payload in dispatchS3Error
  const resErrThrowPayload = dispatchS3Error(throwPayloadGetter);
  assert.equal(resErrThrowPayload.http_status, 400);
  assert.equal(resErrThrowPayload.error_code, 'InvalidDigest');
  assert.equal(resErrThrowPayload.status, 400);
  assert.equal(resErrThrowPayload.code, 'InvalidDigest');
  assert.equal(resErrThrowPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const resErrReturnPayload = dispatchS3Error(returnPayloadGetter);
  assert.equal(resErrReturnPayload.http_status, 400);
  assert.equal(resErrReturnPayload.error_code, 'InvalidDigest');
  assert.equal(resErrReturnPayload.status, 400);
  assert.equal(resErrReturnPayload.code, 'InvalidDigest');
  assert.equal(resErrReturnPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 4. Accessor getter for code in dispatchS3Error
  const resErrThrowCode = dispatchS3Error(throwCodeGetter);
  assert.equal(resErrThrowCode.http_status, 400);
  assert.equal(resErrThrowCode.error_code, 'InvalidDigest');
  assert.equal(resErrThrowCode.status, 400);
  assert.equal(resErrThrowCode.code, 'InvalidDigest');
  assert.equal(resErrThrowCode.reason, 'MALFORMED_PAYLOAD_TYPE');

  const returnCodeGetter = {
    get code() {
      return 'NoSuchKey';
    }
  };
  const resErrReturnCode = dispatchS3Error(returnCodeGetter);
  assert.equal(resErrReturnCode.http_status, 400);
  assert.equal(resErrReturnCode.error_code, 'InvalidDigest');
  assert.equal(resErrReturnCode.status, 400);
  assert.equal(resErrReturnCode.code, 'InvalidDigest');
  assert.equal(resErrReturnCode.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('regression: prototype-inherited option keys return HTTP 400 InvalidDigest (MALFORMED_HEADER_SYNTAX) in dispatchS3PutObject and dispatchS3Error', () => {
  const inheritedPayload = Object.create({ payload: 'hello' });
  const resInhPayload = dispatchS3PutObject(inheritedPayload);
  assert.equal(resInhPayload.http_status, 400);
  assert.equal(resInhPayload.error_code, 'InvalidDigest');
  assert.equal(resInhPayload.reason, 'MALFORMED_HEADER_SYNTAX');

  const inheritedBytes = Object.create({ payloadBytes: 'hello' });
  const resInhBytes = dispatchS3PutObject(inheritedBytes);
  assert.equal(resInhBytes.http_status, 400);
  assert.equal(resInhBytes.error_code, 'InvalidDigest');
  assert.equal(resInhBytes.reason, 'MALFORMED_HEADER_SYNTAX');

  const inheritedBody = Object.create({ body: 'hello' });
  const resInhBody = dispatchS3PutObject(inheritedBody);
  assert.equal(resInhBody.http_status, 400);
  assert.equal(resInhBody.error_code, 'InvalidDigest');
  assert.equal(resInhBody.reason, 'MALFORMED_HEADER_SYNTAX');

  const inheritedHeaders = Object.create({ headers: {} });
  const resInhHeaders = dispatchS3PutObject(inheritedHeaders);
  assert.equal(resInhHeaders.http_status, 400);
  assert.equal(resInhHeaders.error_code, 'InvalidDigest');
  assert.equal(resInhHeaders.reason, 'MALFORMED_HEADER_SYNTAX');

  const inheritedSha = Object.create({ 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  const resInhSha = dispatchS3PutObject(inheritedSha);
  assert.equal(resInhSha.http_status, 400);
  assert.equal(resInhSha.error_code, 'InvalidDigest');
  assert.equal(resInhSha.reason, 'MALFORMED_HEADER_SYNTAX');

  const inheritedErrPayload = Object.create({ payload: 'hello' });
  const resInhErrPayload = dispatchS3Error(inheritedErrPayload);
  assert.equal(resInhErrPayload.http_status, 400);
  assert.equal(resInhErrPayload.error_code, 'InvalidDigest');
  assert.equal(resInhErrPayload.reason, 'MALFORMED_HEADER_SYNTAX');

  const inheritedErrBytes = Object.create({ payloadBytes: 'hello' });
  const resInhErrBytes = dispatchS3Error(inheritedErrBytes);
  assert.equal(resInhErrBytes.http_status, 400);
  assert.equal(resInhErrBytes.error_code, 'InvalidDigest');
  assert.equal(resInhErrBytes.reason, 'MALFORMED_HEADER_SYNTAX');

  const inheritedErrBody = Object.create({ body: 'hello' });
  const resInhErrBody = dispatchS3Error(inheritedErrBody);
  assert.equal(resInhErrBody.http_status, 400);
  assert.equal(resInhErrBody.error_code, 'InvalidDigest');
  assert.equal(resInhErrBody.reason, 'MALFORMED_HEADER_SYNTAX');

  const inheritedErrHeaders = Object.create({ headers: {} });
  const resInhErrHeaders = dispatchS3Error(inheritedErrHeaders);
  assert.equal(resInhErrHeaders.http_status, 400);
  assert.equal(resInhErrHeaders.error_code, 'InvalidDigest');
  assert.equal(resInhErrHeaders.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('inherited headers getter invocation defense across dispatchS3PutObject and dispatchS3Error (OPEN-2)', () => {
  // 1. Prototype with explosive headers getter
  let putGetterInvoked = false;
  const protoPut = Object.defineProperty({}, 'headers', {
    get() {
      putGetterInvoked = true;
      throw new Error('Explosive prototype headers getter invoked on dispatchS3PutObject!');
    }
  });
  const putObj = Object.create(protoPut);
  putObj.payload = Buffer.from('test-payload');

  const resPut = dispatchS3PutObject(putObj);
  assert.equal(putGetterInvoked, false, 'Prototype headers getter must NOT be invoked by dispatchS3PutObject');
  assert.equal(resPut.http_status, 400);
  assert.equal(resPut.error_code, 'InvalidDigest');
  assert.equal(resPut.reason, 'MALFORMED_HEADER_SYNTAX');

  // 2. dispatchS3Error with prototype explosive headers getter
  let errGetterInvoked = false;
  const protoErr = Object.defineProperty({}, 'headers', {
    get() {
      errGetterInvoked = true;
      throw new Error('Explosive prototype headers getter invoked on dispatchS3Error!');
    }
  });
  const errObj = Object.create(protoErr);
  errObj.payload = Buffer.from('test-payload');

  const resErr = dispatchS3Error(errObj);
  assert.equal(errGetterInvoked, false, 'Prototype headers getter must NOT be invoked by dispatchS3Error');
  assert.equal(resErr.http_status, 400);
  assert.equal(resErr.error_code, 'InvalidDigest');
  assert.equal(resErr.reason, 'MALFORMED_HEADER_SYNTAX');

  // 3. Safe descriptor lookup: own headers getter must NOT execute arbitrary code
  let ownPutGetterInvoked = false;
  const ownGetterPutObj = {
    payload: Buffer.from('test-payload')
  };
  Object.defineProperty(ownGetterPutObj, 'headers', {
    get() {
      ownPutGetterInvoked = true;
      return { 'Content-MD5': 'some-md5' };
    },
    enumerable: true,
    configurable: true
  });
  const resOwnPut = dispatchS3PutObject(ownGetterPutObj);
  assert.equal(resOwnPut.http_status, 400);
  assert.equal(resOwnPut.error_code, 'InvalidDigest');

  // 4. Inherited getter on headers property (e.g. proto for headers object has getter)
  let innerGetterInvoked = false;
  const headersProto = Object.defineProperty({}, 'Content-MD5', {
    get() {
      innerGetterInvoked = true;
      throw new Error('Explosive headers property getter invoked!');
    }
  });
  const badHeadersObj = Object.create(headersProto);
  const resNestedProto = dispatchS3PutObject({
    payload: Buffer.from('test-payload'),
    headers: badHeadersObj
  });
  assert.equal(innerGetterInvoked, false, 'Inner prototype headers property getter must NOT be invoked');
  assert.equal(resNestedProto.http_status, 400);
  assert.equal(resNestedProto.error_code, 'InvalidDigest');
  assert.equal(resNestedProto.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('validateS3ConformanceProfileSemantics strict 15/19 operation set and canonical error code validation (OPEN-2)', () => {
  const baseProfile = {
    provider_identifier: 'minio-enterprise-s3',
    mandatory_operations: {
      crud: true,
      multipart_upload: true,
      presigning: true,
      sig_v4: true,
      path_style_access: true,
      versioning: true,
      error_mappings: true
    },
    object_lock_supported: true,
    retention_modes_supported: ['COMPLIANCE', 'GOVERNANCE'],
    legal_hold_supported: true,
    required_operations: [...S3_19_CLOSED_OPS],
    addressing_style: 'path_style',
    auth_mechanism: 'AWS4-HMAC-SHA256',
    required_error_codes: [...S3_CANONICAL_ERROR_CODES]
  };

  // 1. Positive 19-operation full lock profile passes
  assert.doesNotThrow(() => validateS3ConformanceProfileSemantics(baseProfile));

  // 2. Positive 15-operation profile (object_lock_supported: false) passes
  const nonLockProfile = {
    ...baseProfile,
    object_lock_supported: false,
    required_operations: [...S3_15_BASELINE_OPS]
  };
  assert.doesNotThrow(() => validateS3ConformanceProfileSemantics(nonLockProfile));

  // 3. Duplicate operations in required_operations are strictly rejected
  const dupOpsProfile = {
    ...baseProfile,
    required_operations: [...S3_19_CLOSED_OPS, 'PutObject']
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(dupOpsProfile),
    /required_operations contains duplicate operation 'PutObject'/
  );

  // 4. Missing baseline operation (e.g. PutBucketVersioning) is rejected
  const missingVersioningProfile = {
    ...baseProfile,
    required_operations: S3_19_CLOSED_OPS.filter(op => op !== 'PutBucketVersioning')
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(missingVersioningProfile),
    /missing required S3 operation 'PutBucketVersioning'/
  );

  // 5. object_lock_supported: true missing Object Lock operation (e.g. PutObjectRetention) is rejected
  const missingLockProfile = {
    ...baseProfile,
    required_operations: S3_19_CLOSED_OPS.filter(op => op !== 'PutObjectRetention')
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(missingLockProfile),
    /missing required Object Lock S3 operation 'PutObjectRetention'/
  );

  // 6. object_lock_supported: false containing Object Lock operation is rejected
  const falseLockWithLockOps = {
    ...nonLockProfile,
    required_operations: [...S3_15_BASELINE_OPS.slice(0, 14), 'PutObjectRetention']
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(falseLockWithLockOps),
    /object_lock_supported === false must not contain Object Lock operation 'PutObjectRetention'/
  );

  // 7. object_lock_supported: false with wrong count (!== 15) is rejected
  const falseLockWrongCount = {
    ...nonLockProfile,
    required_operations: S3_15_BASELINE_OPS.slice(0, 14)
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(falseLockWrongCount),
    /must contain exactly 15 operations/
  );

  // 8. Missing canonical error code in required_error_codes is rejected
  for (const code of S3_CANONICAL_ERROR_CODES) {
    const missingCodeProfile = {
      ...baseProfile,
      required_error_codes: S3_CANONICAL_ERROR_CODES.filter(c => c !== code)
    };
    assert.throws(
      () => validateS3ConformanceProfileSemantics(missingCodeProfile),
      new RegExp(`required_error_codes is missing required canonical error code '${code}'`)
    );
  }

  // 9. Non-object profile is rejected
  assert.throws(
    () => validateS3ConformanceProfileSemantics(null),
    /storage conformance profile must be an object/
  );
});

test('regression: options objects with inherited throwing headers getters return HTTP 400 InvalidDigest without throwing', () => {
  // 1. Inherited throwing headers getter on prototype: Object.create({ get headers() { throw new Error('attack'); } })
  const attackObj = Object.create({
    get headers() {
      throw new Error('attack');
    }
  });

  // dispatchS3PutObject must return HTTP 400 InvalidDigest without throwing
  const putRes = dispatchS3PutObject(attackObj);
  assert.equal(putRes.http_status, 400);
  assert.equal(putRes.error_code, 'InvalidDigest');
  assert.equal(putRes.status, 400);
  assert.equal(putRes.code, 'InvalidDigest');
  assert.ok(
    putRes.reason === 'MALFORMED_HEADER_SYNTAX' || putRes.reason === 'MALFORMED_PAYLOAD_TYPE',
    `Expected reason MALFORMED_HEADER_SYNTAX or MALFORMED_PAYLOAD_TYPE, got ${putRes.reason}`
  );

  // dispatchS3Error must return HTTP 400 InvalidDigest without throwing
  const errRes = dispatchS3Error(attackObj);
  assert.equal(errRes.http_status, 400);
  assert.equal(errRes.error_code, 'InvalidDigest');
  assert.equal(errRes.status, 400);
  assert.equal(errRes.code, 'InvalidDigest');
  assert.ok(
    errRes.reason === 'MALFORMED_HEADER_SYNTAX' || errRes.reason === 'MALFORMED_PAYLOAD_TYPE',
    `Expected reason MALFORMED_HEADER_SYNTAX or MALFORMED_PAYLOAD_TYPE, got ${errRes.reason}`
  );

  // 2. Inherited throwing headers getter with own payload properties
  const attackWithPayload = Object.create({
    get headers() {
      throw new Error('attack');
    }
  });
  attackWithPayload.payload = Buffer.from('CYBRIK_TEST_DATA');
  attackWithPayload['x-amz-content-sha256'] = 'UNSIGNED-PAYLOAD';

  const putPayloadRes = dispatchS3PutObject(attackWithPayload);
  assert.equal(putPayloadRes.http_status, 400);
  assert.equal(putPayloadRes.error_code, 'InvalidDigest');
  assert.ok(
    putPayloadRes.reason === 'MALFORMED_HEADER_SYNTAX' || putPayloadRes.reason === 'MALFORMED_PAYLOAD_TYPE'
  );

  const errPayloadRes = dispatchS3Error(attackWithPayload);
  assert.equal(errPayloadRes.http_status, 400);
  assert.equal(errPayloadRes.error_code, 'InvalidDigest');
  assert.ok(
    errPayloadRes.reason === 'MALFORMED_HEADER_SYNTAX' || errPayloadRes.reason === 'MALFORMED_PAYLOAD_TYPE'
  );

  // 3. Plain options object containing headers property that itself has inherited throwing getters
  const attackNestedHeaders = {
    payload: Buffer.from('CYBRIK_TEST_DATA'),
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    headers: Object.create({
      get 'Content-MD5'() {
        throw new Error('attack');
      },
      get 'content-md5'() {
        throw new Error('attack');
      },
      get 'x-amz-content-sha256'() {
        throw new Error('attack');
      }
    })
  };

  const putNestedRes = dispatchS3PutObject(attackNestedHeaders);
  assert.equal(putNestedRes.http_status, 400);
  assert.equal(putNestedRes.error_code, 'InvalidDigest');
  assert.ok(
    putNestedRes.reason === 'MALFORMED_HEADER_SYNTAX' || putNestedRes.reason === 'MALFORMED_PAYLOAD_TYPE'
  );

  const errNestedRes = dispatchS3Error(attackNestedHeaders);
  assert.equal(errNestedRes.http_status, 400);
  assert.equal(errNestedRes.error_code, 'InvalidDigest');
  assert.ok(
    errNestedRes.reason === 'MALFORMED_HEADER_SYNTAX' || errNestedRes.reason === 'MALFORMED_PAYLOAD_TYPE'
  );

  // 4. Object with prototype containing multiple explosive throwing getters
  const multiAttackProto = {
    get headers() { throw new Error('attack headers'); },
    get payload() { throw new Error('attack payload'); },
    get payloadBytes() { throw new Error('attack payloadBytes'); },
    get body() { throw new Error('attack body'); },
    get contentMd5Header() { throw new Error('attack contentMd5Header'); },
    get content_md5_header() { throw new Error('attack content_md5_header'); },
    get 'x-amz-content-sha256'() { throw new Error('attack sha256'); },
    get code() { throw new Error('attack code'); },
    get error_code() { throw new Error('attack error_code'); },
    get status() { throw new Error('attack status'); },
    get http_status() { throw new Error('attack http_status'); }
  };
  const multiAttackObj = Object.create(multiAttackProto);

  const putMultiRes = dispatchS3PutObject(multiAttackObj);
  assert.equal(putMultiRes.http_status, 400);
  assert.equal(putMultiRes.error_code, 'InvalidDigest');
  assert.ok(
    putMultiRes.reason === 'MALFORMED_HEADER_SYNTAX' || putMultiRes.reason === 'MALFORMED_PAYLOAD_TYPE'
  );

  const errMultiRes = dispatchS3Error(multiAttackObj);
  assert.equal(errMultiRes.http_status, 400);
  assert.equal(errMultiRes.error_code, 'InvalidDigest');
  assert.ok(
    errMultiRes.reason === 'MALFORMED_HEADER_SYNTAX' || errMultiRes.reason === 'MALFORMED_PAYLOAD_TYPE'
  );

  // 5. Object with own throwing headers getter returns HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
  const ownThrowingHeaders = {
    get headers() {
      throw new Error('attack own headers');
    }
  };
  const putOwnRes = dispatchS3PutObject(ownThrowingHeaders);
  assert.equal(putOwnRes.http_status, 400);
  assert.equal(putOwnRes.error_code, 'InvalidDigest');
  assert.equal(putOwnRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errOwnRes = dispatchS3Error(ownThrowingHeaders);
  assert.equal(errOwnRes.http_status, 400);
  assert.equal(errOwnRes.error_code, 'InvalidDigest');
  assert.equal(errOwnRes.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('URL presigning parameter validation and error mapping (OPEN-2)', () => {
  // 1. Mandatory operations flag 'presigning: true' in storage conformance profile
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  assert.equal(baseProfile.mandatory_operations.presigning, true, 'presigning must be true in positive fixture');
  assert.ok(ajv.validate(PROFILE_DEF_ID, baseProfile));

  const falsePresigningProfile = {
    ...baseProfile,
    mandatory_operations: {
      ...baseProfile.mandatory_operations,
      presigning: false,
    },
  };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, falsePresigningProfile), 'presigning: false must fail schema validation');
  assert.equal(ajv.errors[0].keyword, 'const');
  assert.equal(ajv.errors[0].instancePath, '/mandatory_operations/presigning');

  const missingPresigningProfile = {
    ...baseProfile,
    mandatory_operations: {
      crud: true,
      multipart_upload: true,
      sig_v4: true,
      path_style_access: true,
      versioning: true,
      error_mappings: true,
    },
  };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, missingPresigningProfile), 'missing presigning flag must fail schema validation');
  assert.equal(ajv.errors[0].keyword, 'required');
  assert.equal(ajv.errors[0].params.missingProperty, 'presigning');

  // 2. Presigned URL SigV4 query parameter specifications and validation
  function validatePresignedUrlParams(queryParams) {
    const isPlain = queryParams !== null && typeof queryParams === 'object' && !Array.isArray(queryParams);
    if (!isPlain) {
      return { http_status: 400, error_code: 'InvalidArgument', reason: 'INVALID_QUERY_PARAMETERS' };
    }

    const algorithm = queryParams['X-Amz-Algorithm'] ?? queryParams['x-amz-algorithm'];
    const credential = queryParams['X-Amz-Credential'] ?? queryParams['x-amz-credential'];
    const date = queryParams['X-Amz-Date'] ?? queryParams['x-amz-date'];
    const expiresStr = queryParams['X-Amz-Expires'] ?? queryParams['x-amz-expires'];
    const signedHeaders = queryParams['X-Amz-SignedHeaders'] ?? queryParams['x-amz-signedheaders'];
    const signature = queryParams['X-Amz-Signature'] ?? queryParams['x-amz-signature'];

    // Missing required parameters -> HTTP 400 InvalidArgument
    if (!algorithm || !credential || !date || expiresStr === undefined || expiresStr === null || !signedHeaders || !signature) {
      return { http_status: 400, error_code: 'InvalidArgument', reason: 'MISSING_REQUIRED_PRESIGNED_PARAMETER' };
    }

    // Algorithm must strictly be AWS4-HMAC-SHA256
    if (algorithm !== 'AWS4-HMAC-SHA256') {
      return { http_status: 400, error_code: 'InvalidArgument', reason: 'UNSUPPORTED_PRESIGNED_ALGORITHM' };
    }

    // Date format: YYYYMMDDTHHMMSSZ
    if (typeof date !== 'string' || !/^[0-9]{8}T[0-9]{6}Z$/.test(date)) {
      return { http_status: 400, error_code: 'InvalidArgument', reason: 'MALFORMED_PRESIGNED_DATE' };
    }

    // Expires bounds: integer 1..604800 (max 7 days)
    const expiresNum = Number(expiresStr);
    if (!Number.isInteger(expiresNum) || expiresNum < 1 || expiresNum > 604800 || String(expiresNum) !== String(expiresStr).trim()) {
      return { http_status: 400, error_code: 'InvalidArgument', reason: 'EXPIRES_OUT_OF_BOUNDS' };
    }

    // Signature format: 64 hex lowercase
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) {
      return { http_status: 400, error_code: 'InvalidArgument', reason: 'MALFORMED_PRESIGNED_SIGNATURE' };
    }

    // SignedHeaders: non-empty semicolon-delimited lowercase tokens
    if (typeof signedHeaders !== 'string' || !/^[a-z0-9-]+(?:;[a-z0-9-]+)*$/.test(signedHeaders)) {
      return { http_status: 400, error_code: 'InvalidArgument', reason: 'MALFORMED_SIGNED_HEADERS' };
    }

    // Check expiration timestamp against request_time
    if (queryParams.request_timestamp && queryParams.current_timestamp) {
      const reqTime = typeof queryParams.request_timestamp === 'number' ? queryParams.request_timestamp : Date.parse(queryParams.request_timestamp);
      const currTime = typeof queryParams.current_timestamp === 'number' ? queryParams.current_timestamp : Date.parse(queryParams.current_timestamp);
      if (currTime > reqTime + (expiresNum * 1000)) {
        return { http_status: 403, error_code: 'AccessDenied', reason: 'REQUEST_EXPIRED' };
      }
    }

    // Check signature match
    if (queryParams.expected_signature && queryParams.expected_signature !== signature) {
      return { http_status: 403, error_code: 'AccessDenied', reason: 'SIGNATURE_DOES_NOT_MATCH' };
    }

    return { http_status: 200, error_code: null, reason: 'VALID' };
  }

  const validPresignedParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': 'EXAMPLE_KEY_ID_001/20260828/us-east-1/s3/aws4_request',
    'X-Amz-Date': '20260828T120000Z',
    'X-Amz-Expires': 86400,
    'X-Amz-SignedHeaders': 'host;x-amz-content-sha256',
    'X-Amz-Signature': 'a'.repeat(64),
    request_timestamp: '2026-08-28T12:00:00Z',
    current_timestamp: '2026-08-28T14:00:00Z',
  };

  const validRes = validatePresignedUrlParams(validPresignedParams);
  assert.equal(validRes.http_status, 200);
  assert.equal(validRes.error_code, null);

  // 3. Presigned URL expired: returns HTTP 403 AccessDenied
  const expiredParams = {
    ...validPresignedParams,
    'X-Amz-Expires': 3600, // 1 hour
    request_timestamp: '2026-08-28T12:00:00Z',
    current_timestamp: '2026-08-28T14:00:00Z', // 2 hours later -> expired
  };
  const expiredRes = validatePresignedUrlParams(expiredParams);
  assert.equal(expiredRes.http_status, 403);
  assert.equal(expiredRes.error_code, 'AccessDenied');
  assert.equal(expiredRes.reason, 'REQUEST_EXPIRED');

  // 4. Presigned URL expires out of bounds (> 604800 or <= 0): returns HTTP 400 InvalidArgument
  const excessiveExpires = { ...validPresignedParams, 'X-Amz-Expires': 604801 };
  const excessiveRes = validatePresignedUrlParams(excessiveExpires);
  assert.equal(excessiveRes.http_status, 400);
  assert.equal(excessiveRes.error_code, 'InvalidArgument');
  assert.equal(excessiveRes.reason, 'EXPIRES_OUT_OF_BOUNDS');

  const zeroExpires = { ...validPresignedParams, 'X-Amz-Expires': 0 };
  const zeroRes = validatePresignedUrlParams(zeroExpires);
  assert.equal(zeroRes.http_status, 400);
  assert.equal(zeroRes.error_code, 'InvalidArgument');
  assert.equal(zeroRes.reason, 'EXPIRES_OUT_OF_BOUNDS');

  const negativeExpires = { ...validPresignedParams, 'X-Amz-Expires': -100 };
  const negativeRes = validatePresignedUrlParams(negativeExpires);
  assert.equal(negativeRes.http_status, 400);
  assert.equal(negativeRes.error_code, 'InvalidArgument');
  assert.equal(negativeRes.reason, 'EXPIRES_OUT_OF_BOUNDS');

  const floatExpires = { ...validPresignedParams, 'X-Amz-Expires': 3600.5 };
  const floatRes = validatePresignedUrlParams(floatExpires);
  assert.equal(floatRes.http_status, 400);
  assert.equal(floatRes.error_code, 'InvalidArgument');
  assert.equal(floatRes.reason, 'EXPIRES_OUT_OF_BOUNDS');

  // 5. Unsupported presigned algorithm: returns HTTP 400 InvalidArgument
  const badAlgoParams = { ...validPresignedParams, 'X-Amz-Algorithm': 'AWS4-HMAC-SHA512' };
  const badAlgoRes = validatePresignedUrlParams(badAlgoParams);
  assert.equal(badAlgoRes.http_status, 400);
  assert.equal(badAlgoRes.error_code, 'InvalidArgument');
  assert.equal(badAlgoRes.reason, 'UNSUPPORTED_PRESIGNED_ALGORITHM');

  // 6. Missing required presigned query parameters: returns HTTP 400 InvalidArgument
  for (const requiredKey of ['X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-Expires', 'X-Amz-SignedHeaders', 'X-Amz-Signature']) {
    const missingParam = { ...validPresignedParams };
    delete missingParam[requiredKey];
    const missingRes = validatePresignedUrlParams(missingParam);
    assert.equal(missingRes.http_status, 400, `Missing ${requiredKey} must return HTTP 400`);
    assert.equal(missingRes.error_code, 'InvalidArgument', `Missing ${requiredKey} must return InvalidArgument`);
  }

  // 7. Signature mismatch: returns HTTP 403 AccessDenied
  const mismatchedSigParams = {
    ...validPresignedParams,
    'X-Amz-Signature': 'b'.repeat(64),
    expected_signature: 'a'.repeat(64),
  };
  const mismatchSigRes = validatePresignedUrlParams(mismatchedSigParams);
  assert.equal(mismatchSigRes.http_status, 403);
  assert.equal(mismatchSigRes.error_code, 'AccessDenied');
  assert.equal(mismatchSigRes.reason, 'SIGNATURE_DOES_NOT_MATCH');

  // 8. Malformed signature syntax: returns HTTP 400 InvalidArgument
  for (const badSig of ['short', 'G'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), 'not-hex!!']) {
    const badSigParams = { ...validPresignedParams, 'X-Amz-Signature': badSig };
    const badSigRes = validatePresignedUrlParams(badSigParams);
    assert.equal(badSigRes.http_status, 400, `Bad signature '${badSig}' must return HTTP 400`);
    assert.equal(badSigRes.error_code, 'InvalidArgument', `Bad signature '${badSig}' must return InvalidArgument`);
  }

  // 9. Presigned path-style URL schema validation and dot-segment rejection
  const validateUrl = ajv.getSchema(PATH_STYLE_URL_DEF_ID);
  assert.ok(validateUrl, `Missing schema for ${PATH_STYLE_URL_DEF_ID}`);

  assert.ok(validateUrl('https://storage.internal.cybrik:9000/cybrik-audit/evidence/bundle.tar.gz'));
  assert.ok(!validateUrl('https://storage.internal.cybrik:9000/cybrik-audit/../evidence/bundle.tar.gz'), 'Dot-segment in presigned URL path must be rejected');
  assert.ok(!validateUrl('https://storage.internal.cybrik:9000/cybrik-audit/./evidence/bundle.tar.gz'), 'Dot-slash in presigned URL path must be rejected');
  assert.ok(!validateUrl('https://storage.internal.cybrik:9000/cybrik-audit//bundle.tar.gz'), 'Double slash in presigned URL path must be rejected');

  // 10. Presigned PutObject digest dispatch error mapping
  const payload = Buffer.from('IMMUTABLE_AUDIT_LOG_2026');
  const validMd5 = computePayloadMd5(payload);
  const invalidMd5 = '1B2M2Y8AsgTpgAmY7PhCfg==';

  // Valid presigned upload: HTTP 200
  const validPut = dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: validMd5, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(validPut.http_status, 200);
  assert.equal(validPut.error_code, null);

  // Mismatched MD5 on presigned upload: HTTP 400 BadDigest (PAYLOAD_DIGEST_MISMATCH)
  const mismatchPut = dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: invalidMd5, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(mismatchPut.http_status, 400);
  assert.equal(mismatchPut.error_code, 'BadDigest');
  assert.equal(mismatchPut.reason, 'PAYLOAD_DIGEST_MISMATCH');

  // Malformed MD5 on presigned upload: HTTP 400 InvalidDigest (MALFORMED_HEADER_SYNTAX)
  const malformedPut = dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: 'malformed!', 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(malformedPut.http_status, 400);
  assert.equal(malformedPut.error_code, 'InvalidDigest');
  assert.equal(malformedPut.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('dispatchS3CompleteMultipartUpload inherited part attributes and accessor branches', () => {
  // parts accessor returning undefined
  const partsUndefinedGetter = {
    get parts() { return undefined; }
  };
  const resUndefinedParts = dispatchS3CompleteMultipartUpload(partsUndefinedGetter);
  assert.equal(resUndefinedParts.http_status, 400);
  assert.equal(resUndefinedParts.error_code, 'InvalidArgument');

  // inherited part_number
  const partInheritedNum = Object.create({ part_number: 1 });
  partInheritedNum.etag = '"00000000000000000000000000000000"';
  partInheritedNum.size_bytes = 5242880;
  const resInhPartNum = dispatchS3CompleteMultipartUpload({ parts: [partInheritedNum], storedParts: { 1: { etag: '"00000000000000000000000000000000"', size_bytes: 5242880 } } });
  assert.equal(resInhPartNum.http_status, 400);
  assert.equal(resInhPartNum.error_code, 'InvalidPart');

  // inherited etag
  const partInheritedEtag = Object.create({ etag: '"00000000000000000000000000000000"' });
  partInheritedEtag.part_number = 1;
  partInheritedEtag.size_bytes = 5242880;
  const resInhPartEtag = dispatchS3CompleteMultipartUpload({ parts: [partInheritedEtag], storedParts: { 1: { etag: '"00000000000000000000000000000000"', size_bytes: 5242880 } } });
  assert.equal(resInhPartEtag.http_status, 400);
  assert.equal(resInhPartEtag.error_code, 'InvalidPart');

  // inherited size_bytes
  const partInheritedSize = Object.create({ size_bytes: 5242880 });
  partInheritedSize.part_number = 1;
  partInheritedSize.etag = '"00000000000000000000000000000000"';
  const resInhPartSize = dispatchS3CompleteMultipartUpload({ parts: [partInheritedSize], storedParts: { 1: { etag: '"00000000000000000000000000000000"', size_bytes: 5242880 } } });
  assert.equal(resInhPartSize.http_status, 400);
  assert.equal(resInhPartSize.error_code, 'InvalidPart');
});
