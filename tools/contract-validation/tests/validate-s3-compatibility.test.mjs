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
  verifyPayloadSha256,
  verifyPayloadMd5,
  getTypedArrayByteLength,
  getTypedArrayByteOffset,
  getOwnDataValue,
  hasAnyAccessorsOrProxy,
  isMalformedBase64Md5,
  isMalformedSha256,
  isMalformedPayloadType,
  getOwn,
  hasOwnAccessors,
  hasOwnHeadersAccessors,
  verifyDigestErrorDispatch,
  verifyMalformedHeaderDispatch,
  validateS3MultipartSemantics,
  validatePlatformSemantics,
  validateOfflineInstallSemantics,
  validateS3ConformanceProfileSemantics,
  S3_CANONICAL_ERROR_CODES,
  S3_15_BASELINE_OPS,
  S3_4_OBJECT_LOCK_OPS,
  S3_19_CLOSED_OPS,
  S3_15_OPERATIONS,
  S3_19_OPERATIONS,
  isPlainOrNull,
  hasPrototypeChainAccessor,
  hasOversizedDeclaredLength,
  S3_DECLARED_LENGTH_KEYS,
  validateIJson,
  ALL_13_CONFORMANCE_SLOTS,
  createSafePlainSnapshot,
  snapshotOwnDataDescriptors,
  isPureBufferOrUint8Array,
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

    const filteredErrors = ajv.errors.filter(
      (e) => e.keyword !== 'if' && !e.schemaPath.includes('/contains')
    );
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

test('mandate root and profile conditional WORM / Object Lock support (object_lock, retention_modes, legal_hold)', () => {
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  // Root and Profile: 19-operation profile with object_lock_supported: true passes
  assert.ok(ajv.validate(PROFILE_DEF_ID, baseProfile));
  assert.ok(ajv.validate(S3_SCHEMA_ID, baseProfile));

  // Root and Profile: 15-operation profile with object_lock_supported: false passes (OPEN-2)
  const valid15Profile = {
    ...baseProfile,
    object_lock_supported: false,
    legal_hold_supported: false,
    retention_modes_supported: [],
    required_operations: baseProfile.required_operations.slice(0, 15)
  };
  assert.ok(ajv.validate(PROFILE_DEF_ID, valid15Profile));
  assert.ok(ajv.validate(S3_SCHEMA_ID, valid15Profile));

  // 15 operations with object_lock_supported: true fails (mandates 19 operations)
  const bad15LockTrue = { ...baseProfile, object_lock_supported: true, required_operations: baseProfile.required_operations.slice(0, 15) };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, bad15LockTrue));
  assert.ok(ajv.errors.some(e => e.keyword === 'minItems' && e.instancePath === '/required_operations'));

  // 19 operations with object_lock_supported: false fails (mandates 15 operations)
  const bad19LockFalse = { ...valid15Profile, object_lock_supported: false, required_operations: baseProfile.required_operations };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, bad19LockFalse));
  assert.ok(ajv.errors.some(e => e.keyword === 'maxItems' && e.instancePath === '/required_operations'));

  // Missing object_lock_supported fails required
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

  // legal_hold_supported must be const true when object_lock_supported: true
  const badLegalHold = { ...baseProfile, legal_hold_supported: false };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, badLegalHold));
  assert.equal(ajv.errors[0].keyword, 'const');

  // When object_lock_supported: false:
  // legal_hold_supported must be const false
  const badFalseLockHoldTrue = { ...valid15Profile, legal_hold_supported: true };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, badFalseLockHoldTrue));
  assert.equal(ajv.errors[0].keyword, 'const');

  // retention_modes_supported must be empty array [] (maxItems: 0)
  const badFalseLockModesNonEmpty = { ...valid15Profile, retention_modes_supported: ['COMPLIANCE', 'GOVERNANCE'] };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, badFalseLockModesNonEmpty));
  assert.equal(ajv.errors[0].keyword, 'maxItems');

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
  const matchA = dispatchS3PutObject({ payloadBytes: payloadA, contentMd5Header: digestA, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
  assert.equal(matchA.http_status, 200);
  assert.equal(matchA.error_code, null);

  const matchAErr = dispatchS3Error({ payloadBytes: payloadA, contentMd5Header: digestA, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
  assert.equal(matchAErr.http_status, 200);
  assert.equal(matchAErr.error_code, null);

  const matchB = dispatchS3PutObject({ payloadBytes: payloadB, contentMd5Header: digestB, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
  assert.equal(matchB.http_status, 200);
  assert.equal(matchB.error_code, null);

  const matchEmpty = dispatchS3PutObject({ payloadBytes: emptyPayload, contentMd5Header: digestEmpty, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
  assert.equal(matchEmpty.http_status, 200);
  assert.equal(matchEmpty.error_code, null);

  const matchBinary = dispatchS3PutObject({ payloadBytes: binaryPayload, contentMd5Header: digestBinary, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
  assert.equal(matchBinary.http_status, 200);
  assert.equal(matchBinary.error_code, null);

  // 2. Real byte mismatch: ALWAYS returns BadDigest (HTTP 400), strictly never InvalidArgument or AccessDenied
  const mismatch1 = dispatchS3PutObject({ payloadBytes: payloadA, contentMd5Header: digestB, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
  assert.equal(mismatch1.http_status, 400);
  assert.equal(mismatch1.error_code, 'BadDigest');
  assert.equal(mismatch1.reason, 'PAYLOAD_DIGEST_MISMATCH');
  assert.notEqual(mismatch1.error_code, 'InvalidArgument');
  assert.notEqual(mismatch1.error_code, 'AccessDenied');

  const mismatch1Err = dispatchS3Error({ payloadBytes: payloadA, contentMd5Header: digestB, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
  assert.equal(mismatch1Err.http_status, 400);
  assert.equal(mismatch1Err.error_code, 'BadDigest');
  assert.equal(mismatch1Err.reason, 'PAYLOAD_DIGEST_MISMATCH');

  const mismatch2 = dispatchS3PutObject({ payloadBytes: payloadB, contentMd5Header: digestA, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
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
    const malformedRes = dispatchS3PutObject({ payloadBytes: payloadA, contentMd5Header: badHdr, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
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

  // 2. UNSIGNED-PAYLOAD without authorization returns HTTP 400 InvalidDigest / UNSIGNED_PAYLOAD_NOT_PERMITTED
  const unsignedRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  assert.equal(unsignedRes.http_status, 400);
  assert.equal(unsignedRes.error_code, 'InvalidDigest');
  assert.equal(unsignedRes.code, 'InvalidDigest');
  assert.equal(unsignedRes.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 2b. UNSIGNED-PAYLOAD with allow_unsigned_payload: true returns 200
  const unsignedAllowedRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true });
  assert.equal(unsignedAllowedRes.http_status, 200);
  assert.equal(unsignedAllowedRes.error_code, null);

  // 2c. UNSIGNED-PAYLOAD with is_presigned: true returns 200
  const unsignedPresignedRes = dispatchS3PutObject({ payloadBytes: payload, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', is_presigned: true });
  assert.equal(unsignedPresignedRes.http_status, 200);
  assert.equal(unsignedPresignedRes.error_code, null);

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
  assert.throws(() => validateS3MultipartSemantics(nonArrayParts), /multipart upload manifest structure is invalid or malformed \(InvalidPart\)/);

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
    etag: '"0123456789abcdef0123456789abcdef"',
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

  // 2. Direct empty array as argument returns HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE)
  const directEmptyRes = dispatchS3CompleteMultipartUpload([], storedParts);
  assert.equal(directEmptyRes.http_status, 400);
  assert.equal(directEmptyRes.error_code, 'InvalidPart');
  assert.equal(directEmptyRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
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
    allow_unsigned_payload: true,
  });
  assert.equal(validRes.http_status, 200);
  assert.equal(validRes.error_code, null);

  // Also verify lowercase header key 'content-md5' in nested headers
  const validLowerRes = dispatchS3PutObject({
    payloadBytes: payload,
    headers: { 'content-md5': validMd5 },
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: true,
  });
  assert.equal(validLowerRes.http_status, 200);
  assert.equal(validLowerRes.error_code, null);

  // 2. Mismatched MD5 in nested headers returns HTTP 400 BadDigest (PAYLOAD_DIGEST_MISMATCH)
  const mismatchRes = dispatchS3PutObject({
    payloadBytes: payload,
    headers: { 'Content-MD5': invalidMd5 },
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: true,
  });
  assert.equal(mismatchRes.http_status, 400);
  assert.equal(mismatchRes.error_code, 'BadDigest');
  assert.equal(mismatchRes.reason, 'PAYLOAD_DIGEST_MISMATCH');

  // 3. Malformed base64 MD5 in nested headers returns HTTP 400 InvalidDigest (MALFORMED_HEADER_SYNTAX)
  const malformedRes = dispatchS3PutObject({
    payloadBytes: payload,
    headers: { 'Content-MD5': malformedMd5 },
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: true,
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
    assert.equal(resInheritedObj.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
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
    allow_unsigned_payload: true,
  });
  assert.equal(putRawMd5Res.http_status, 200);
  assert.equal(putRawMd5Res.error_code, null);

  // 5. dispatchS3PutObject with decoded MD5 returns HTTP 400 BadDigest (PAYLOAD_DIGEST_MISMATCH)
  const putDecodedMd5Res = dispatchS3PutObject({
    payloadBytes: literalPayload,
    contentMd5Header: decodedMd5,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: true,
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
    assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');

    const errRes = dispatchS3Error(protoObj);
    assert.equal(errRes.http_status, 400, `dispatchS3Error must fail closed on inherited headers: ${invalidHeaders}`);
    assert.equal(errRes.error_code, 'InvalidDigest');
    assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');
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
  assert.equal(resPutInherited.reason, 'MALFORMED_PAYLOAD_TYPE');

  const resErrInherited = dispatchS3Error(inheritedHeadersOnly);
  assert.equal(resErrInherited.http_status, 400);
  assert.equal(resErrInherited.error_code, 'InvalidDigest');
  assert.equal(resErrInherited.code, 'InvalidDigest');
  assert.equal(resErrInherited.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Inherited headers with payloadBytes attached
  const inheritedWithPayload = Object.create({
    headers: { 'x-amz-content-sha256': validSha },
  });
  inheritedWithPayload.payloadBytes = payloadBytes;

  const resPutPayload = dispatchS3PutObject(inheritedWithPayload);
  assert.equal(resPutPayload.http_status, 400);
  assert.equal(resPutPayload.error_code, 'InvalidDigest');
  assert.equal(resPutPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const resErrPayload = dispatchS3Error(inheritedWithPayload);
  assert.equal(resErrPayload.http_status, 400);
  assert.equal(resErrPayload.error_code, 'InvalidDigest');
  assert.equal(resErrPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

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
  assert.equal(resPutProtoHeaders.reason, 'MALFORMED_PAYLOAD_TYPE');

  const resErrProtoHeaders = dispatchS3Error(protoHeaders);
  assert.equal(resErrProtoHeaders.http_status, 400, 'Inherited headers in dispatchS3Error must fail closed with 400');
  assert.equal(resErrProtoHeaders.error_code, 'InvalidDigest');
  assert.equal(resErrProtoHeaders.reason, 'MALFORMED_PAYLOAD_TYPE');

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
  assert.equal(resProtoParts.error_code, 'InvalidPart');
  assert.equal(resProtoParts.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 6. dispatchS3CompleteMultipartUpload with prototype-inherited manifest wrapper
  const protoManifestWrap = Object.create({
    manifest: { parts: validPartsList },
    storedParts: validStoredMap,
  });
  const resProtoWrap = dispatchS3CompleteMultipartUpload(protoManifestWrap);
  assert.equal(resProtoWrap.http_status, 400, 'Inherited manifest wrapper in dispatchS3CompleteMultipartUpload must fail closed with 400');
  assert.equal(resProtoWrap.error_code, 'InvalidPart');
  assert.equal(resProtoWrap.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

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
  assert.equal(resPutDirectSha.reason, 'MALFORMED_PAYLOAD_TYPE');

  const resErrDirectSha = dispatchS3Error(optDirectSha);
  assert.equal(resErrDirectSha.http_status, 400);
  assert.equal(resErrDirectSha.error_code, 'InvalidDigest');
  assert.equal(resErrDirectSha.code, 'InvalidDigest');
  assert.equal(resErrDirectSha.reason, 'MALFORMED_PAYLOAD_TYPE');

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
  assert.equal(resPutDirectMd5.reason, 'MALFORMED_PAYLOAD_TYPE');

  const resErrDirectMd5 = dispatchS3Error(optDirectMd5);
  assert.equal(resErrDirectMd5.http_status, 400);
  assert.equal(resErrDirectMd5.error_code, 'InvalidDigest');
  assert.equal(resErrDirectMd5.reason, 'MALFORMED_PAYLOAD_TYPE');

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

  // 1. Non-plain prototype wrapper -> INVALID_MULTIPART_MANIFEST_STRUCTURE
  const protoWrapper = Object.create({ manifest: { parts: [validPart] }, storedParts: validStoredMap });
  const resWrap = dispatchS3CompleteMultipartUpload(protoWrapper);
  assert.equal(resWrap.http_status, 400);
  assert.equal(resWrap.error_code, 'InvalidPart');
  assert.equal(resWrap.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 2. Non-plain prototype manifest in wrapper -> INVALID_MULTIPART_MANIFEST_STRUCTURE
  const protoManifest = Object.create({ parts: [validPart] });
  const resManifest = dispatchS3CompleteMultipartUpload({ manifest: protoManifest, storedParts: validStoredMap });
  assert.equal(resManifest.http_status, 400);
  assert.equal(resManifest.error_code, 'InvalidPart');
  assert.equal(resManifest.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 3. Non-plain prototype part in manifest.parts -> INVALID_MULTIPART_MANIFEST_STRUCTURE
  const protoPart = Object.create(validPart);
  const resPart = dispatchS3CompleteMultipartUpload({ parts: [protoPart], storedParts: validStoredMap });
  assert.equal(resPart.http_status, 400);
  assert.equal(resPart.error_code, 'InvalidPart');
  assert.equal(resPart.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 4. Non-plain prototype stored part in Map -> INVALID_MULTIPART_MANIFEST_STRUCTURE
  const protoStoredMap = new Map([[1, Object.create(validPart)]]);
  const resStoredMap = dispatchS3CompleteMultipartUpload({ parts: [validPart], storedParts: protoStoredMap });
  assert.equal(resStoredMap.http_status, 400);
  assert.equal(resStoredMap.error_code, 'InvalidPart');
  assert.equal(resStoredMap.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 5. Non-plain prototype stored part in Object -> INVALID_MULTIPART_MANIFEST_STRUCTURE
  const protoStoredObj = { 1: Object.create(validPart) };
  const resStoredObj = dispatchS3CompleteMultipartUpload({ parts: [validPart], storedParts: protoStoredObj });
  assert.equal(resStoredObj.http_status, 400);
  assert.equal(resStoredObj.error_code, 'InvalidPart');
  assert.equal(resStoredObj.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

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

test('class-instance wrapper fails closed with HTTP 400 InvalidPart in dispatchS3CompleteMultipartUpload (OPEN-2 / Personal-B)', () => {
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
  assert.equal(resManifestGetter.error_code, 'InvalidPart');
  assert.equal(resManifestGetter.status, 400);
  assert.equal(resManifestGetter.code, 'InvalidPart');
  assert.equal(resManifestGetter.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 2. Class instance wrapper with getter for parts
  class PartsGetterWrapper {
    get parts() {
      return [{ part_number: 1, etag: validEtag, size_bytes: 5242880 }];
    }
  }
  const resPartsGetter = dispatchS3CompleteMultipartUpload(new PartsGetterWrapper(), validStoredMap);
  assert.equal(resPartsGetter.http_status, 400);
  assert.equal(resPartsGetter.error_code, 'InvalidPart');
  assert.equal(resPartsGetter.status, 400);
  assert.equal(resPartsGetter.code, 'InvalidPart');
  assert.equal(resPartsGetter.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

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
  assert.equal(resMethodWrapper.error_code, 'InvalidPart');
  assert.equal(resMethodWrapper.status, 400);
  assert.equal(resMethodWrapper.code, 'InvalidPart');
  assert.equal(resMethodWrapper.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 4. Empty class instance
  class EmptyWrapper {}
  const resEmptyWrapper = dispatchS3CompleteMultipartUpload(new EmptyWrapper(), validStoredMap);
  assert.equal(resEmptyWrapper.http_status, 400);
  assert.equal(resEmptyWrapper.error_code, 'InvalidPart');
  assert.equal(resEmptyWrapper.status, 400);
  assert.equal(resEmptyWrapper.code, 'InvalidPart');
  assert.equal(resEmptyWrapper.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
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

test('dispatchS3CompleteMultipartUpload rejects direct Array manifests with HTTP 400 InvalidPart (OPEN-2 / OPEN-5)', () => {
  const validEtag = '"d41d8cd98f00b204e9800998ecf8427e"';
  const validPart = { part_number: 1, etag: validEtag, size_bytes: 5242880 };
  const validStoredMap = new Map([[1, { part_number: 1, etag: validEtag, size_bytes: 5242880 }]]);

  // 1. Direct non-empty Array passed as manifestOrOptions
  const directArray = [validPart];
  const resDirectArray = dispatchS3CompleteMultipartUpload(directArray, validStoredMap);
  assert.equal(resDirectArray.http_status, 400);
  assert.equal(resDirectArray.error_code, 'InvalidPart');
  assert.equal(resDirectArray.status, 400);
  assert.equal(resDirectArray.code, 'InvalidPart');
  assert.equal(resDirectArray.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 2. Direct empty Array passed as manifestOrOptions
  const resDirectEmpty = dispatchS3CompleteMultipartUpload([], validStoredMap);
  assert.equal(resDirectEmpty.http_status, 400);
  assert.equal(resDirectEmpty.error_code, 'InvalidPart');
  assert.equal(resDirectEmpty.status, 400);
  assert.equal(resDirectEmpty.code, 'InvalidPart');
  assert.equal(resDirectEmpty.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 3. Direct multi-element Array passed without storedParts
  const multiPartArray = [
    { part_number: 1, etag: validEtag, size_bytes: 5242880 },
    { part_number: 2, etag: validEtag, size_bytes: 5242880 },
  ];
  const resMultiArray = dispatchS3CompleteMultipartUpload(multiPartArray);
  assert.equal(resMultiArray.http_status, 400);
  assert.equal(resMultiArray.error_code, 'InvalidPart');
  assert.equal(resMultiArray.status, 400);
  assert.equal(resMultiArray.code, 'InvalidPart');
  assert.equal(resMultiArray.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
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

  // 10. dispatchS3Error with non-plain prototype options returns MALFORMED_PAYLOAD_TYPE
  const nonPlainCondition = Object.create({ reason: 'MALFORMED_PAYLOAD_TYPE' });
  const resNonPlain = dispatchS3Error(nonPlainCondition);
  assert.equal(resNonPlain.http_status, 400);
  assert.equal(resNonPlain.error_code, 'InvalidDigest');
  assert.equal(resNonPlain.reason, 'MALFORMED_PAYLOAD_TYPE');
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

  assert.equal(hasOwnHeadersAccessors(plainObj), false);
  assert.equal(hasOwnHeadersAccessors(getterObj), false);
  assert.equal(hasOwnHeadersAccessors({ get headers() { return {}; } }), true);
  assert.equal(hasOwnHeadersAccessors({ set headers(v) {} }), true);
  assert.equal(hasOwnHeadersAccessors({ headers: { get foo() { return 1; } } }), true);
  assert.equal(hasOwnHeadersAccessors(null), false);
  assert.equal(hasOwnHeadersAccessors(undefined), false);

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
  assert.equal(resPutGetterHeaders.reason, 'MALFORMED_HEADER_SYNTAX');

  const putGetterInsideHeaders = {
    payload: Buffer.from('test'),
    headers: {
      get 'x-amz-content-sha256'() { return validSha; }
    }
  };
  const resPutGetterInsideHeaders = dispatchS3PutObject(putGetterInsideHeaders);
  assert.equal(resPutGetterInsideHeaders.http_status, 400);
  assert.equal(resPutGetterInsideHeaders.error_code, 'InvalidDigest');
  assert.equal(resPutGetterInsideHeaders.reason, 'MALFORMED_HEADER_SYNTAX');

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
  assert.equal(resErrGetterHeaders.reason, 'MALFORMED_HEADER_SYNTAX');

  const errGetterInsideHeaders = {
    payload: Buffer.from('test'),
    headers: {
      get 'Content-MD5'() { return validMd5; }
    }
  };
  const resErrGetterInsideHeaders = dispatchS3Error(errGetterInsideHeaders);
  assert.equal(resErrGetterInsideHeaders.http_status, 400);
  assert.equal(resErrGetterInsideHeaders.error_code, 'InvalidDigest');
  assert.equal(resErrGetterInsideHeaders.reason, 'MALFORMED_HEADER_SYNTAX');
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

test('regression: prototype-inherited option keys return HTTP 400 InvalidDigest in dispatchS3PutObject and dispatchS3Error', () => {
  const inheritedPayload = Object.create({ payload: 'hello' });
  const resInhPayload = dispatchS3PutObject(inheritedPayload);
  assert.equal(resInhPayload.http_status, 400);
  assert.equal(resInhPayload.error_code, 'InvalidDigest');
  assert.equal(resInhPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const inheritedBytes = Object.create({ payloadBytes: 'hello' });
  const resInhBytes = dispatchS3PutObject(inheritedBytes);
  assert.equal(resInhBytes.http_status, 400);
  assert.equal(resInhBytes.error_code, 'InvalidDigest');
  assert.equal(resInhBytes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const inheritedBody = Object.create({ body: 'hello' });
  const resInhBody = dispatchS3PutObject(inheritedBody);
  assert.equal(resInhBody.http_status, 400);
  assert.equal(resInhBody.error_code, 'InvalidDigest');
  assert.equal(resInhBody.reason, 'MALFORMED_PAYLOAD_TYPE');

  const inheritedHeaders = Object.create({ headers: {} });
  const resInhHeaders = dispatchS3PutObject(inheritedHeaders);
  assert.equal(resInhHeaders.http_status, 400);
  assert.equal(resInhHeaders.error_code, 'InvalidDigest');
  assert.equal(resInhHeaders.reason, 'MALFORMED_PAYLOAD_TYPE');

  const inheritedSha = Object.create({ 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
  const resInhSha = dispatchS3PutObject(inheritedSha);
  assert.equal(resInhSha.http_status, 400);
  assert.equal(resInhSha.error_code, 'InvalidDigest');
  assert.equal(resInhSha.reason, 'MALFORMED_PAYLOAD_TYPE');

  const inheritedErrPayload = Object.create({ payload: 'hello' });
  const resInhErrPayload = dispatchS3Error(inheritedErrPayload);
  assert.equal(resInhErrPayload.http_status, 400);
  assert.equal(resInhErrPayload.error_code, 'InvalidDigest');
  assert.equal(resInhErrPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

  const inheritedErrBytes = Object.create({ payloadBytes: 'hello' });
  const resInhErrBytes = dispatchS3Error(inheritedErrBytes);
  assert.equal(resInhErrBytes.http_status, 400);
  assert.equal(resInhErrBytes.error_code, 'InvalidDigest');
  assert.equal(resInhErrBytes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const inheritedErrBody = Object.create({ body: 'hello' });
  const resInhErrBody = dispatchS3Error(inheritedErrBody);
  assert.equal(resInhErrBody.http_status, 400);
  assert.equal(resInhErrBody.error_code, 'InvalidDigest');
  assert.equal(resInhErrBody.reason, 'MALFORMED_PAYLOAD_TYPE');

  const inheritedErrHeaders = Object.create({ headers: {} });
  const resInhErrHeaders = dispatchS3Error(inheritedErrHeaders);
  assert.equal(resInhErrHeaders.http_status, 400);
  assert.equal(resInhErrHeaders.error_code, 'InvalidDigest');
  assert.equal(resInhErrHeaders.reason, 'MALFORMED_PAYLOAD_TYPE');
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
  assert.equal(resPut.reason, 'MALFORMED_PAYLOAD_TYPE');

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
  assert.equal(resErr.reason, 'MALFORMED_PAYLOAD_TYPE');

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
    evidence_references: [
      'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations',
      'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'
    ],
    required_error_codes: [...S3_CANONICAL_ERROR_CODES]
  };

  // 1. Positive 19-operation full lock profile passes
  assert.doesNotThrow(() => validateS3ConformanceProfileSemantics(baseProfile));

  // 2. Positive 15-operation profile (object_lock_supported: false) passes
  const nonLockProfile = {
    ...baseProfile,
    object_lock_supported: false,
    legal_hold_supported: false,
    retention_modes_supported: [],
    required_operations: [...S3_15_BASELINE_OPS],
    evidence_references: [
      'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations'
    ]
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

  // 8b. Missing core-operations evidence when object_lock_supported: true is rejected
  const missingCoreEvProfile = {
    ...baseProfile,
    evidence_references: ['urn:cybrik:evidence:storage:s3:conformance:v1:object-lock']
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(missingCoreEvProfile),
    /requires general storage conformance evidence 'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations'/
  );

  // 8c. Missing object-lock evidence when object_lock_supported: true is rejected
  const missingLockEvProfile = {
    ...baseProfile,
    evidence_references: ['urn:cybrik:evidence:storage:s3:conformance:v1:core-operations']
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(missingLockEvProfile),
    /requires Object Lock evidence 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'/
  );

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

  // 5. Object with own throwing headers getter returns HTTP 400 InvalidDigest (MALFORMED_HEADER_SYNTAX)
  const ownThrowingHeaders = {
    get headers() {
      throw new Error('attack own headers');
    }
  };
  const putOwnRes = dispatchS3PutObject(ownThrowingHeaders);
  assert.equal(putOwnRes.http_status, 400);
  assert.equal(putOwnRes.error_code, 'InvalidDigest');
  assert.equal(putOwnRes.reason, 'MALFORMED_HEADER_SYNTAX');

  const errOwnRes = dispatchS3Error(ownThrowingHeaders);
  assert.equal(errOwnRes.http_status, 400);
  assert.equal(errOwnRes.error_code, 'InvalidDigest');
  assert.equal(errOwnRes.reason, 'MALFORMED_HEADER_SYNTAX');
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
  const validPut = dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: validMd5, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', is_presigned: true });
  assert.equal(validPut.http_status, 200);
  assert.equal(validPut.error_code, null);

  // Mismatched MD5 on presigned upload: HTTP 400 BadDigest (PAYLOAD_DIGEST_MISMATCH)
  const mismatchPut = dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: invalidMd5, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', is_presigned: true });
  assert.equal(mismatchPut.http_status, 400);
  assert.equal(mismatchPut.error_code, 'BadDigest');
  assert.equal(mismatchPut.reason, 'PAYLOAD_DIGEST_MISMATCH');

  // Malformed MD5 on presigned upload: HTTP 400 InvalidDigest (MALFORMED_HEADER_SYNTAX)
  const malformedPut = dispatchS3PutObject({ payloadBytes: payload, contentMd5Header: 'malformed!', 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', is_presigned: true });
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
  assert.equal(resUndefinedParts.error_code, 'InvalidPart');
  assert.equal(resUndefinedParts.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

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

test('schema-only regression: object_lock_supported: false + 15 operations passes Ajv validation on storage S3 schema (OPEN-2)', () => {
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const sample = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  const fifteenOpsProfile = {
    ...sample,
    object_lock_supported: false,
    legal_hold_supported: false,
    retention_modes_supported: [],
    required_operations: [
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
    ],
  };

  // Positive: 15-op profile with object_lock_supported: false passes Ajv schema validation on root and profile def
  const validRoot = ajv.validate(S3_SCHEMA_ID, fifteenOpsProfile);
  assert.ok(validRoot, `15-op profile with object_lock_supported: false must pass S3_SCHEMA_ID: ${ajv.errorsText()}`);

  const validProfile = ajv.validate(PROFILE_DEF_ID, fifteenOpsProfile);
  assert.ok(validProfile, `15-op profile with object_lock_supported: false must pass PROFILE_DEF_ID: ${ajv.errorsText()}`);

  // Negative: 19-op profile with object_lock_supported: false must fail schema validation (requires exactly 15)
  const invalid19OpsProfile = {
    ...fifteenOpsProfile,
    required_operations: sample.required_operations, // 19 ops
  };
  const invalidRoot = ajv.validate(S3_SCHEMA_ID, invalid19OpsProfile);
  assert.equal(invalidRoot, false, '19-op profile with object_lock_supported: false must fail schema validation');

  const invalidProfile = ajv.validate(PROFILE_DEF_ID, invalid19OpsProfile);
  assert.equal(invalidProfile, false, '19-op profile with object_lock_supported: false must fail schema validation');

  // Negative: 15-op profile with object_lock_supported: true must fail schema validation (requires exactly 19)
  const invalid15WithLockTrue = {
    ...fifteenOpsProfile,
    object_lock_supported: true,
  };
  assert.equal(ajv.validate(S3_SCHEMA_ID, invalid15WithLockTrue), false, '15-op profile with object_lock_supported: true must fail schema validation');
  assert.equal(ajv.validate(PROFILE_DEF_ID, invalid15WithLockTrue), false, '15-op profile with object_lock_supported: true must fail schema validation');
});

test('schema-only regression: 13-entry negotiation declaration with missing/duplicate slot fails Ajv validation (OPEN-2 / OPEN-5)', () => {
  const NEGOTIATION_SCHEMA_FILE = 'cybrik.provider-capability-negotiation.v1.schema.json';
  const NEGOTIATION_SCHEMA_PATH = join(JSON_SCHEMA_DIR, NEGOTIATION_SCHEMA_FILE);
  const negSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  if (!ajv.getSchema(negSchemaId)) {
    const negDoc = JSON.parse(readFileSync(NEGOTIATION_SCHEMA_PATH, 'utf8'));
    ajv.addSchema(negDoc, negDoc.$id);
  }

  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  const handshake = JSON.parse(readFileSync(samplePath, 'utf8'));

  // Positive: canonical handshake with FULL_PROFILE_CONFORMANCE_DECLARATION passes Ajv validation
  assert.ok(ajv.validate(negSchemaId, handshake), `Canonical handshake must pass: ${ajv.errorsText()}`);

  // Negative: 13 advertised_capabilities where slot 1 duplicates slot 0 (missing isolation_substrate)
  const mutated = JSON.parse(JSON.stringify(handshake));
  assert.equal(mutated.advertisement_response.advertised_capabilities.length, 13);
  mutated.advertisement_response.advertised_capabilities[1].slot_id =
    mutated.advertisement_response.advertised_capabilities[0].slot_id;

  const valid = ajv.validate(negSchemaId, mutated);
  assert.equal(valid, false, '13-entry negotiation declaration with duplicate slot must fail Ajv validation');
  const hasContainsError = ajv.errors.some(e => e.keyword === 'contains');
  assert.ok(hasContainsError, 'Should fail the distinct 13-slot contains condition');
});

test('unit regression: own headers accessor returns HTTP 400 InvalidDigest MALFORMED_HEADER_SYNTAX (OPEN-2 / OPEN-5)', () => {
  const validPayload = Buffer.from('CYBRIK_TEST_DATA');
  const validSha = createHash('sha256').update(validPayload).digest('hex');
  const validMd5 = createHash('md5').update(validPayload).digest('base64');

  // 1. dispatchS3PutObject with own headers accessor
  const putWithOwnHeadersGetter = {
    payload: validPayload,
    get headers() {
      return { 'x-amz-content-sha256': validSha };
    },
  };
  const putRes = dispatchS3PutObject(putWithOwnHeadersGetter);
  assert.equal(putRes.http_status, 400);
  assert.equal(putRes.error_code, 'InvalidDigest');
  assert.equal(putRes.status, 400);
  assert.equal(putRes.code, 'InvalidDigest');
  assert.equal(putRes.reason, 'MALFORMED_HEADER_SYNTAX');

  // 2. dispatchS3PutObject with own throwing headers accessor
  const putWithThrowingHeadersGetter = {
    payload: validPayload,
    get headers() {
      throw new Error('attack own headers');
    },
  };
  const putThrowingRes = dispatchS3PutObject(putWithThrowingHeadersGetter);
  assert.equal(putThrowingRes.http_status, 400);
  assert.equal(putThrowingRes.error_code, 'InvalidDigest');
  assert.equal(putThrowingRes.reason, 'MALFORMED_HEADER_SYNTAX');

  // 3. dispatchS3Error with own headers accessor
  const errWithOwnHeadersGetter = {
    payload: validPayload,
    get headers() {
      return { 'content-md5': validMd5 };
    },
  };
  const errRes = dispatchS3Error(errWithOwnHeadersGetter);
  assert.equal(errRes.http_status, 400);
  assert.equal(errRes.error_code, 'InvalidDigest');
  assert.equal(errRes.status, 400);
  assert.equal(errRes.code, 'InvalidDigest');
  assert.equal(errRes.reason, 'MALFORMED_HEADER_SYNTAX');

  // 4. dispatchS3Error with own throwing headers accessor
  const errWithThrowingHeadersGetter = {
    payload: validPayload,
    get headers() {
      throw new Error('attack own headers');
    },
  };
  const errThrowingRes = dispatchS3Error(errWithThrowingHeadersGetter);
  assert.equal(errThrowingRes.http_status, 400);
  assert.equal(errThrowingRes.error_code, 'InvalidDigest');
  assert.equal(errThrowingRes.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('adversarial Proxy descriptor safety and prototype accessor taxonomy (OPEN-2 / OPEN-5)', () => {
  const validPayload = Buffer.from('CYBRIK_PROXY_DEFENSE_TEST_2026');
  const validSha = createHash('sha256').update(validPayload).digest('hex');
  const validMd5 = createHash('md5').update(validPayload).digest('base64');

  // 1. Adversarial Proxy throwing on getOwnPropertyDescriptor
  const descThrowingProxy = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error('adversarial descriptor trap throw');
    },
    ownKeys() {
      return ['headers', 'payload'];
    }
  });
  assert.equal(hasOwnAccessors(descThrowingProxy), true, 'hasOwnAccessors must fail closed on throwing getOwnPropertyDescriptor');
  assert.equal(hasOwnHeadersAccessors(descThrowingProxy), true, 'hasOwnHeadersAccessors must fail closed on throwing getOwnPropertyDescriptor');

  const putDescProxyRes = dispatchS3PutObject(descThrowingProxy);
  assert.equal(putDescProxyRes.http_status, 400);
  assert.equal(putDescProxyRes.error_code, 'InvalidDigest');
  assert.equal(putDescProxyRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errDescProxyRes = dispatchS3Error(descThrowingProxy);
  assert.equal(errDescProxyRes.http_status, 400);
  assert.equal(errDescProxyRes.error_code, 'InvalidDigest');
  assert.equal(errDescProxyRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Adversarial Proxy throwing on ownKeys
  const ownKeysThrowingProxy = new Proxy({}, {
    ownKeys() {
      throw new Error('adversarial ownKeys trap throw');
    }
  });
  assert.equal(hasOwnAccessors(ownKeysThrowingProxy), true, 'hasOwnAccessors must fail closed on throwing ownKeys');
  assert.equal(hasOwnHeadersAccessors(ownKeysThrowingProxy), false, 'hasOwnHeadersAccessors returns false if headers descriptor does not throw');

  const putOwnKeysProxyRes = dispatchS3PutObject(ownKeysThrowingProxy);
  assert.equal(putOwnKeysProxyRes.http_status, 400);
  assert.equal(putOwnKeysProxyRes.error_code, 'InvalidDigest');
  assert.equal(putOwnKeysProxyRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errOwnKeysProxyRes = dispatchS3Error(ownKeysThrowingProxy);
  assert.equal(errOwnKeysProxyRes.http_status, 400);
  assert.equal(errOwnKeysProxyRes.error_code, 'InvalidDigest');
  assert.equal(errOwnKeysProxyRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3. Plain options with adversarial Proxy headers
  const proxyHeadersObj = {
    payload: validPayload,
    headers: new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error('adversarial headers descriptor trap throw');
      },
      ownKeys() {
        throw new Error('adversarial headers ownKeys trap throw');
      }
    })
  };
  assert.equal(hasOwnHeadersAccessors(proxyHeadersObj), true, 'hasOwnHeadersAccessors must detect throwing proxy headers');

  const putProxyHdrRes = dispatchS3PutObject(proxyHeadersObj);
  assert.equal(putProxyHdrRes.http_status, 400);
  assert.equal(putProxyHdrRes.error_code, 'InvalidDigest');
  assert.equal(putProxyHdrRes.reason, 'MALFORMED_HEADER_SYNTAX');

  const errProxyHdrRes = dispatchS3Error(proxyHeadersObj);
  assert.equal(errProxyHdrRes.http_status, 400);
  assert.equal(errProxyHdrRes.error_code, 'InvalidDigest');
  assert.equal(errProxyHdrRes.reason, 'MALFORMED_HEADER_SYNTAX');

  // 4. Non-plain prototype options without headers accessor returns MALFORMED_PAYLOAD_TYPE
  class CustomRequestOptions {
    constructor() {
      this.payload = validPayload;
      this['x-amz-content-sha256'] = validSha;
    }
  }
  const customOpt = new CustomRequestOptions();
  assert.equal(hasOwnHeadersAccessors(customOpt), false);
  const putCustomRes = dispatchS3PutObject(customOpt);
  assert.equal(putCustomRes.http_status, 400);
  assert.equal(putCustomRes.error_code, 'InvalidDigest');
  assert.equal(putCustomRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errCustomRes = dispatchS3Error(customOpt);
  assert.equal(errCustomRes.http_status, 400);
  assert.equal(errCustomRes.error_code, 'InvalidDigest');
  assert.equal(errCustomRes.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('schema-only regression: non-lock 15-operation profile omitting PutObject and substituting PutObjectRetention fails Ajv schema validation on storage S3 schema (OPEN-2)', () => {
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const sample = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  const substitute15OpsProfile = {
    ...sample,
    object_lock_supported: false,
    legal_hold_supported: false,
    retention_modes_supported: [],
    required_operations: [
      'GetObject', // PutObject omitted
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
      'PutObjectRetention', // substituted 15th op
    ],
  };

  assert.equal(substitute15OpsProfile.required_operations.length, 15);
  assert.ok(!substitute15OpsProfile.required_operations.includes('PutObject'));
  assert.ok(substitute15OpsProfile.required_operations.includes('PutObjectRetention'));

  // Negative: Root schema validation must fail on enum defect for PutObjectRetention
  const validRoot = ajv.validate(S3_SCHEMA_ID, substitute15OpsProfile);
  assert.equal(validRoot, false, '15-op profile substituting PutObjectRetention for PutObject must fail Ajv validation on root schema');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'enum' && (e.schemaPath.includes('s3BaselineOperationName') || e.instancePath.startsWith('/required_operations'))),
    `Expected enum error on required_operations, got: ${JSON.stringify(ajv.errors)}`
  );

  // Negative: Profile def schema validation must fail on enum defect for PutObjectRetention
  const validProfile = ajv.validate(PROFILE_DEF_ID, substitute15OpsProfile);
  assert.equal(validProfile, false, '15-op profile substituting PutObjectRetention for PutObject must fail Ajv validation on profile def');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'enum' && (e.schemaPath.includes('s3BaselineOperationName') || e.instancePath.startsWith('/required_operations'))),
    `Expected enum error on required_operations, got: ${JSON.stringify(ajv.errors)}`
  );
});

test('unit regression: throwing Proxy passed to dispatchS3Error and dispatchS3PutObject fails closed with HTTP 400 InvalidDigest (never returns HTTP 200) (OPEN-2)', () => {
  // 1. Fully throwing Proxy (throws on every trap)
  const throwingProxyAllTraps = new Proxy({}, {
    get() { throw new Error('attack get'); },
    has() { throw new Error('attack has'); },
    ownKeys() { throw new Error('attack ownKeys'); },
    getOwnPropertyDescriptor() { throw new Error('attack getOwnPropertyDescriptor'); },
    getPrototypeOf() { throw new Error('attack getPrototypeOf'); },
  });

  const putRes1 = dispatchS3PutObject(throwingProxyAllTraps);
  assert.equal(putRes1.http_status, 400);
  assert.equal(putRes1.error_code, 'InvalidDigest');
  assert.notEqual(putRes1.http_status, 200);

  const errRes1 = dispatchS3Error(throwingProxyAllTraps);
  assert.equal(errRes1.http_status, 400);
  assert.equal(errRes1.error_code, 'InvalidDigest');
  assert.notEqual(errRes1.http_status, 200);

  // 2. Proxy with valid payload that throws on get
  const payloadBytes = Buffer.from('CYBRIK_IMMUTABLE_EVIDENCE_2026');
  const validSha = computePayloadSha256(payloadBytes);
  const throwingGetProxy = new Proxy({
    payload: payloadBytes,
    'x-amz-content-sha256': validSha,
  }, {
    get(target, prop) {
      throw new Error(`attack get ${String(prop)}`);
    },
  });

  const putRes2 = dispatchS3PutObject(throwingGetProxy);
  assert.equal(putRes2.http_status, 400);
  assert.equal(putRes2.error_code, 'InvalidDigest');
  assert.notEqual(putRes2.http_status, 200);

  const errRes2 = dispatchS3Error(throwingGetProxy);
  assert.equal(errRes2.http_status, 400);
  assert.equal(errRes2.error_code, 'InvalidDigest');
  assert.notEqual(errRes2.http_status, 200);

  // 3. Proxy that throws on getOwnPropertyDescriptor
  const throwingDescProxy = new Proxy({
    payload: payloadBytes,
    'x-amz-content-sha256': validSha,
  }, {
    getOwnPropertyDescriptor(target, prop) {
      throw new Error(`attack getOwnPropertyDescriptor ${String(prop)}`);
    },
  });

  const putRes3 = dispatchS3PutObject(throwingDescProxy);
  assert.equal(putRes3.http_status, 400);
  assert.equal(putRes3.error_code, 'InvalidDigest');
  assert.notEqual(putRes3.http_status, 200);

  const errRes3 = dispatchS3Error(throwingDescProxy);
  assert.equal(errRes3.http_status, 400);
  assert.equal(errRes3.error_code, 'InvalidDigest');
  assert.notEqual(errRes3.http_status, 200);

  // 4. Proxy that throws on ownKeys
  const throwingKeysProxy = new Proxy({
    payload: payloadBytes,
    'x-amz-content-sha256': validSha,
  }, {
    ownKeys() {
      throw new Error('attack ownKeys');
    },
  });

  const putRes4 = dispatchS3PutObject(throwingKeysProxy);
  assert.equal(putRes4.http_status, 400);
  assert.equal(putRes4.error_code, 'InvalidDigest');
  assert.notEqual(putRes4.http_status, 200);

  const errRes4 = dispatchS3Error(throwingKeysProxy);
  assert.equal(errRes4.http_status, 400);
  assert.equal(errRes4.error_code, 'InvalidDigest');
  assert.notEqual(errRes4.http_status, 200);

  // 5. Proxy that throws on getPrototypeOf
  const throwingProtoProxy = new Proxy({
    payload: payloadBytes,
    'x-amz-content-sha256': validSha,
  }, {
    getPrototypeOf() {
      throw new Error('attack getPrototypeOf');
    },
  });

  const putRes5 = dispatchS3PutObject(throwingProtoProxy);
  assert.equal(putRes5.http_status, 400);
  assert.equal(putRes5.error_code, 'InvalidDigest');
  assert.notEqual(putRes5.http_status, 200);

  const errRes5 = dispatchS3Error(throwingProtoProxy);
  assert.equal(errRes5.http_status, 400);
  assert.equal(errRes5.error_code, 'InvalidDigest');
  assert.notEqual(errRes5.http_status, 200);
});

test('unit regression: throwing Proxy passed to dispatchS3CompleteMultipartUpload and validateS3MultipartSemantics fails closed (OPEN-2)', () => {
  // 1. Fully throwing Proxy (throws on every trap)
  const throwingProxyAllTraps = new Proxy({}, {
    get() { throw new Error('attack get'); },
    has() { throw new Error('attack has'); },
    ownKeys() { throw new Error('attack ownKeys'); },
    getOwnPropertyDescriptor() { throw new Error('attack getOwnPropertyDescriptor'); },
    getPrototypeOf() { throw new Error('attack getPrototypeOf'); },
  });

  const completeRes1 = dispatchS3CompleteMultipartUpload(throwingProxyAllTraps);
  assert.equal(completeRes1.http_status, 400);
  assert.equal(completeRes1.error_code, 'InvalidPart');
  assert.equal(completeRes1.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(completeRes1.http_status, 200);

  assert.throws(
    () => validateS3MultipartSemantics(throwingProxyAllTraps),
    /Semantic error: multipart/
  );

  // 2. Proxy parts array throwing on traps
  const throwingPartsProxy = {
    parts: new Proxy([], {
      get(target, prop) {
        if (prop === 'length') return 1;
        throw new Error('attack parts get');
      },
      has() { throw new Error('attack parts has'); },
      getOwnPropertyDescriptor() { throw new Error('attack parts getOwnPropertyDescriptor'); },
    }),
  };

  const completeRes2 = dispatchS3CompleteMultipartUpload(throwingPartsProxy);
  assert.equal(completeRes2.http_status, 400);
  assert.equal(completeRes2.error_code, 'InvalidPart');
  assert.equal(completeRes2.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(completeRes2.http_status, 200);

  assert.throws(
    () => validateS3MultipartSemantics(throwingPartsProxy),
    /Semantic error:/
  );

  // 3. Proxy storedParts throwing on traps
  const throwingStoredProxy = {
    parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }],
    storedParts: new Proxy({}, {
      get() { throw new Error('attack stored get'); },
      has() { throw new Error('attack stored has'); },
      ownKeys() { throw new Error('attack stored ownKeys'); },
      getOwnPropertyDescriptor() { throw new Error('attack stored getOwnPropertyDescriptor'); },
      getPrototypeOf() { throw new Error('attack stored getPrototypeOf'); },
    }),
  };

  const completeRes3 = dispatchS3CompleteMultipartUpload(throwingStoredProxy);
  assert.equal(completeRes3.http_status, 400);
  assert.equal(completeRes3.error_code, 'InvalidPart');
  assert.equal(completeRes3.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(completeRes3.http_status, 200);
});

test('unit regression: prototype-chain payload and code accessors return HTTP 400 InvalidDigest MALFORMED_PAYLOAD_TYPE (OPEN-2)', () => {
  const validPayload = Buffer.from('CYBRIK_PROTO_ACCESSOR_TEST');
  const validSha = computePayloadSha256(validPayload);

  // 1. Prototype-chain getter for payload
  const protoWithPayloadGetter = Object.create({
    get payload() {
      return validPayload;
    },
  });
  protoWithPayloadGetter['x-amz-content-sha256'] = validSha;

  const putRes1 = dispatchS3PutObject(protoWithPayloadGetter);
  assert.equal(putRes1.http_status, 400);
  assert.equal(putRes1.error_code, 'InvalidDigest');
  assert.equal(putRes1.status, 400);
  assert.equal(putRes1.code, 'InvalidDigest');
  assert.equal(putRes1.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errRes1 = dispatchS3Error(protoWithPayloadGetter);
  assert.equal(errRes1.http_status, 400);
  assert.equal(errRes1.error_code, 'InvalidDigest');
  assert.equal(errRes1.status, 400);
  assert.equal(errRes1.code, 'InvalidDigest');
  assert.equal(errRes1.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Prototype-chain throwing getter for payload
  const protoWithThrowingPayloadGetter = Object.create({
    get payload() {
      throw new Error('attack prototype payload');
    },
  });
  const putRes2 = dispatchS3PutObject(protoWithThrowingPayloadGetter);
  assert.equal(putRes2.http_status, 400);
  assert.equal(putRes2.error_code, 'InvalidDigest');
  assert.equal(putRes2.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errRes2 = dispatchS3Error(protoWithThrowingPayloadGetter);
  assert.equal(errRes2.http_status, 400);
  assert.equal(errRes2.error_code, 'InvalidDigest');
  assert.equal(errRes2.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3. Prototype-chain getter for payloadBytes
  const protoWithPayloadBytesGetter = Object.create({
    get payloadBytes() {
      return validPayload;
    },
  });
  const putRes3 = dispatchS3PutObject(protoWithPayloadBytesGetter);
  assert.equal(putRes3.http_status, 400);
  assert.equal(putRes3.error_code, 'InvalidDigest');
  assert.equal(putRes3.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errRes3 = dispatchS3Error(protoWithPayloadBytesGetter);
  assert.equal(errRes3.http_status, 400);
  assert.equal(errRes3.error_code, 'InvalidDigest');
  assert.equal(errRes3.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 4. Prototype-chain getter for body
  const protoWithBodyGetter = Object.create({
    get body() {
      return validPayload;
    },
  });
  const putRes4 = dispatchS3PutObject(protoWithBodyGetter);
  assert.equal(putRes4.http_status, 400);
  assert.equal(putRes4.error_code, 'InvalidDigest');
  assert.equal(putRes4.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errRes4 = dispatchS3Error(protoWithBodyGetter);
  assert.equal(errRes4.http_status, 400);
  assert.equal(errRes4.error_code, 'InvalidDigest');
  assert.equal(errRes4.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 5. Prototype-chain getter for code
  const protoWithCodeGetter = Object.create({
    get code() {
      return 'BadDigest';
    },
  });
  const putRes5 = dispatchS3PutObject(protoWithCodeGetter);
  assert.equal(putRes5.http_status, 400);
  assert.equal(putRes5.error_code, 'InvalidDigest');
  assert.equal(putRes5.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errRes5 = dispatchS3Error(protoWithCodeGetter);
  assert.equal(errRes5.http_status, 400);
  assert.equal(errRes5.error_code, 'InvalidDigest');
  assert.equal(errRes5.status, 400);
  assert.equal(errRes5.code, 'InvalidDigest');
  assert.equal(errRes5.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 6. Prototype-chain throwing getter for code
  const protoWithThrowingCodeGetter = Object.create({
    get code() {
      throw new Error('attack prototype code');
    },
  });
  const putRes6 = dispatchS3PutObject(protoWithThrowingCodeGetter);
  assert.equal(putRes6.http_status, 400);
  assert.equal(putRes6.error_code, 'InvalidDigest');
  assert.equal(putRes6.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errRes6 = dispatchS3Error(protoWithThrowingCodeGetter);
  assert.equal(errRes6.http_status, 400);
  assert.equal(errRes6.error_code, 'InvalidDigest');
  assert.equal(errRes6.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 7. Class instance with prototype getters
  class PrototypePayloadHolder {
    get payload() {
      return validPayload;
    }
  }
  const classInstance = new PrototypePayloadHolder();
  const putClassRes = dispatchS3PutObject(classInstance);
  assert.equal(putClassRes.http_status, 400);
  assert.equal(putClassRes.error_code, 'InvalidDigest');
  assert.equal(putClassRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errClassRes = dispatchS3Error(classInstance);
  assert.equal(errClassRes.http_status, 400);
  assert.equal(errClassRes.error_code, 'InvalidDigest');
  assert.equal(errClassRes.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('unit regression: throwing Proxy passed to dispatchS3CompleteMultipartUpload fails closed with HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE) (OPEN-2 / OPEN-5)', () => {
  const validManifest = {
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  // 1. Fully throwing Proxy (throws on all traps) as manifestOrOptions
  const throwingProxyAllTraps = new Proxy({}, {
    get() { throw new Error('attack get'); },
    has() { throw new Error('attack has'); },
    ownKeys() { throw new Error('attack ownKeys'); },
    getOwnPropertyDescriptor() { throw new Error('attack getOwnPropertyDescriptor'); },
    getPrototypeOf() { throw new Error('attack getPrototypeOf'); },
  });

  const res1 = dispatchS3CompleteMultipartUpload(throwingProxyAllTraps);
  assert.equal(res1.http_status, 400);
  assert.equal(res1.error_code, 'InvalidPart');
  assert.equal(res1.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res1.http_status, 200);

  // 2. Options wrapper containing throwing Proxy as manifest
  const res2 = dispatchS3CompleteMultipartUpload({
    manifest: throwingProxyAllTraps,
    storedParts: validStoredParts,
  });
  assert.equal(res2.http_status, 400);
  assert.equal(res2.error_code, 'InvalidPart');
  assert.equal(res2.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res2.http_status, 200);

  // 3. Options wrapper containing throwing Proxy as parts array
  const throwingPartsArrayProxy = new Proxy([], {
    get(target, prop) {
      if (prop === 'length') throw new Error('attack parts length');
      throw new Error(`attack parts get ${String(prop)}`);
    },
    ownKeys() { throw new Error('attack parts ownKeys'); },
    getOwnPropertyDescriptor() { throw new Error('attack parts getOwnPropertyDescriptor'); },
    getPrototypeOf() { throw new Error('attack parts getPrototypeOf'); },
  });
  const res3 = dispatchS3CompleteMultipartUpload({
    manifest: { parts: throwingPartsArrayProxy },
    storedParts: validStoredParts,
  });
  assert.equal(res3.http_status, 400);
  assert.equal(res3.error_code, 'InvalidPart');
  assert.equal(res3.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res3.http_status, 200);

  // 4. Manifest with parts array containing a throwing Proxy element
  const throwingPartElementProxy = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
  }, {
    get(target, prop) { throw new Error(`attack part element get ${String(prop)}`); },
    getPrototypeOf() { throw new Error('attack part element getPrototypeOf'); },
    getOwnPropertyDescriptor() { throw new Error('attack part element getOwnPropertyDescriptor'); },
  });
  const res4 = dispatchS3CompleteMultipartUpload({
    manifest: {
      parts: [throwingPartElementProxy],
      total_parts: 1,
    },
    storedParts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }],
  });
  assert.equal(res4.http_status, 400);
  assert.equal(res4.error_code, 'InvalidPart');
  assert.equal(res4.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res4.http_status, 200);

  // 5. Throwing Proxy passed as storedParts (2nd argument and inside options)
  const res5a = dispatchS3CompleteMultipartUpload(validManifest, throwingProxyAllTraps);
  assert.equal(res5a.http_status, 400);
  assert.equal(res5a.error_code, 'InvalidPart');
  assert.equal(res5a.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res5a.http_status, 200);

  const res5b = dispatchS3CompleteMultipartUpload({
    manifest: validManifest,
    storedParts: throwingProxyAllTraps,
  });
  assert.equal(res5b.http_status, 400);
  assert.equal(res5b.error_code, 'InvalidPart');
  assert.equal(res5b.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res5b.http_status, 200);

  // 6. StoredParts containing a throwing Proxy element (in Array and in Map)
  const throwingStoredPartElementProxy = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880,
  }, {
    get(target, prop) { throw new Error(`attack storedPart get ${String(prop)}`); },
    getPrototypeOf() { throw new Error('attack storedPart getPrototypeOf'); },
    getOwnPropertyDescriptor() { throw new Error('attack storedPart getOwnPropertyDescriptor'); },
  });

  const res6a = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] },
    [throwingStoredPartElementProxy]
  );
  assert.equal(res6a.http_status, 400);
  assert.equal(res6a.error_code, 'InvalidPart');
  assert.equal(res6a.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res6a.http_status, 200);

  const res6b = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] },
    new Map([[1, throwingStoredPartElementProxy]])
  );
  assert.equal(res6b.http_status, 400);
  assert.equal(res6b.error_code, 'InvalidPart');
  assert.equal(res6b.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res6b.http_status, 200);

  // 7. Proxy throwing on getPrototypeOf
  const throwingProtoProxy = new Proxy({
    parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }],
  }, {
    getPrototypeOf() { throw new Error('attack getPrototypeOf'); },
  });
  const res7 = dispatchS3CompleteMultipartUpload(throwingProtoProxy, validStoredParts);
  assert.equal(res7.http_status, 400);
  assert.equal(res7.error_code, 'InvalidPart');
  assert.equal(res7.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res7.http_status, 200);

  // 8. Options object with throwing property getter
  const throwingOptionsGetter = {};
  Object.defineProperty(throwingOptionsGetter, 'manifest', {
    get() { throw new Error('attack throwing manifest getter'); },
    enumerable: true,
    configurable: true,
  });
  const res8 = dispatchS3CompleteMultipartUpload(throwingOptionsGetter);
  assert.equal(res8.http_status, 400);
  assert.equal(res8.error_code, 'InvalidPart');
  assert.equal(res8.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res8.http_status, 200);

  // 9. Pure throwing get-trap Proxy as manifest (all other traps omitted/default)
  const throwingOnlyGetManifestProxy = new Proxy({
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  }, {
    get(target, prop) {
      throw new Error(`attack pure get trap on ${String(prop)}`);
    },
  });

  const res9 = dispatchS3CompleteMultipartUpload(throwingOnlyGetManifestProxy, validStoredParts);
  assert.equal(res9.http_status, 400);
  assert.equal(res9.error_code, 'InvalidPart');
  assert.equal(res9.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res9.http_status, 200);

  assert.throws(
    () => validateS3MultipartSemantics(throwingOnlyGetManifestProxy),
    /Semantic error: multipart upload manifest structure is invalid or malformed \(InvalidPart\)/
  );

  // 10. Options wrapper containing pure throwing get-trap Proxy as manifest
  const res10 = dispatchS3CompleteMultipartUpload({
    manifest: throwingOnlyGetManifestProxy,
    storedParts: validStoredParts,
  });
  assert.equal(res10.http_status, 400);
  assert.equal(res10.error_code, 'InvalidPart');
  assert.equal(res10.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res10.http_status, 200);

  // 11. Manifest with parts array having pure throwing get-trap Proxy
  const throwingOnlyGetPartsArrayProxy = new Proxy([
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
  ], {
    get(target, prop) {
      throw new Error(`attack pure get trap on parts array ${String(prop)}`);
    },
  });
  const res11 = dispatchS3CompleteMultipartUpload({
    manifest: { parts: throwingOnlyGetPartsArrayProxy },
    storedParts: validStoredParts,
  });
  assert.equal(res11.http_status, 400);
  assert.equal(res11.error_code, 'InvalidPart');
  assert.equal(res11.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res11.http_status, 200);

  assert.throws(
    () => validateS3MultipartSemantics({ parts: throwingOnlyGetPartsArrayProxy }),
    /Semantic error: multipart upload manifest structure is invalid or malformed \(InvalidPart\)/
  );

  // 12. Manifest with part element having pure throwing get-trap Proxy
  const throwingOnlyGetPartElementProxy = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880,
  }, {
    get(target, prop) {
      throw new Error(`attack pure get trap on part element ${String(prop)}`);
    },
  });
  const res12 = dispatchS3CompleteMultipartUpload({
    manifest: {
      parts: [throwingOnlyGetPartElementProxy],
      total_parts: 1,
    },
    storedParts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }],
  });
  assert.equal(res12.http_status, 400);
  assert.equal(res12.error_code, 'InvalidPart');
  assert.equal(res12.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res12.http_status, 200);

  assert.throws(
    () => validateS3MultipartSemantics({ parts: [throwingOnlyGetPartElementProxy] }),
    /Semantic error: multipart upload manifest structure is invalid or malformed \(InvalidPart\)/
  );

  // 13. StoredParts containing pure throwing get-trap Proxy element (Array & Map)
  const throwingOnlyGetStoredPartProxy = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880,
  }, {
    get(target, prop) {
      throw new Error(`attack pure get trap on stored part ${String(prop)}`);
    },
  });
  const res13a = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] },
    [throwingOnlyGetStoredPartProxy]
  );
  assert.equal(res13a.http_status, 400);
  assert.equal(res13a.error_code, 'InvalidPart');
  assert.equal(res13a.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res13a.http_status, 200);

  const res13b = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] },
    new Map([[1, throwingOnlyGetStoredPartProxy]])
  );
  assert.equal(res13b.http_status, 400);
  assert.equal(res13b.error_code, 'InvalidPart');
  assert.equal(res13b.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res13b.http_status, 200);

  // 14. Manifest throwing on total_parts / total_size_bytes get trap
  const throwingOnlyGetTotalsProxy = new Proxy({
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
    ],
    total_parts: 1,
    total_size_bytes: 5242880,
  }, {
    get(target, prop) {
      if (prop === 'total_parts' || prop === 'total_size_bytes') {
        throw new Error(`attack total get trap on ${String(prop)}`);
      }
      return target[prop];
    },
  });
  const res14 = dispatchS3CompleteMultipartUpload(throwingOnlyGetTotalsProxy, [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }]);
  assert.equal(res14.http_status, 400);
  assert.equal(res14.error_code, 'InvalidPart');
  assert.equal(res14.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res14.http_status, 200);

  assert.throws(
    () => validateS3MultipartSemantics(throwingOnlyGetTotalsProxy),
    /Semantic error: multipart upload manifest structure is invalid or malformed \(InvalidPart\)/
  );
});

test('harmonized fixture naming: s3_crud_19_ops_with_worm and s3_crud_15_ops_baseline semantic and profile conformance (OPEN-2 / OPEN-5)', () => {
  // 1. Validate 19-operation profile with Object Lock compliance
  const wormProfileDoc = {
    provider_identifier: 'minio-sovereign-worm',
    mandatory_operations: {
      crud: true,
      multipart_upload: true,
      presigning: true,
      sig_v4: true,
      path_style_access: true,
      versioning: true,
      error_mappings: true,
    },
    object_lock_supported: true,
    retention_modes_supported: ['COMPLIANCE', 'GOVERNANCE'],
    legal_hold_supported: true,
    required_operations: [
      ...BASELINE_15_S3_OPERATIONS,
      ...OBJECT_LOCK_4_S3_OPERATIONS,
    ],
    addressing_style: 'path_style',
    auth_mechanism: 'AWS4-HMAC-SHA256',
    evidence_references: [
      'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations',
      'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock',
    ],
    required_error_codes: [...CLOSED_13_S3_ERROR_CODES],
  };

  assert.equal(wormProfileDoc.required_operations.length, 19);
  assert.ok(ajv.validate(S3_SCHEMA_ID, wormProfileDoc), '19-op WORM profile must validate against root schema');
  assert.ok(ajv.validate(PROFILE_DEF_ID, wormProfileDoc), '19-op WORM profile must validate against storageConformanceProfile');
  assert.doesNotThrow(
    () => validateS3ConformanceProfileSemantics(wormProfileDoc),
    '19-op WORM profile must pass validateS3ConformanceProfileSemantics'
  );

  // 2. Validate 15-operation baseline profile without Object Lock
  const baselineProfileDoc = {
    provider_identifier: 's3-standard-baseline',
    mandatory_operations: {
      crud: true,
      multipart_upload: true,
      presigning: true,
      sig_v4: true,
      path_style_access: true,
      versioning: true,
      error_mappings: true,
    },
    object_lock_supported: false,
    retention_modes_supported: [],
    legal_hold_supported: false,
    required_operations: [...BASELINE_15_S3_OPERATIONS],
    addressing_style: 'path_style',
    auth_mechanism: 'AWS4-HMAC-SHA256',
    required_error_codes: [...CLOSED_13_S3_ERROR_CODES],
  };

  assert.equal(baselineProfileDoc.required_operations.length, 15);
  assert.ok(ajv.validate(S3_SCHEMA_ID, baselineProfileDoc), '15-op baseline profile must validate against root schema');
  assert.ok(ajv.validate(PROFILE_DEF_ID, baselineProfileDoc), '15-op baseline profile must validate against storageConformanceProfile');
  assert.doesNotThrow(
    () => validateS3ConformanceProfileSemantics(baselineProfileDoc),
    '15-op baseline profile must pass validateS3ConformanceProfileSemantics'
  );

  // 3. Reject 15-operation baseline declaring Object Lock operations without object_lock_supported
  const invalid15WithLockOp = {
    ...baselineProfileDoc,
    required_operations: [...BASELINE_15_S3_OPERATIONS.slice(0, 14), 'PutObjectRetention'],
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(invalid15WithLockOp),
    /must not contain Object Lock operation|storage profile non-lock operations mismatch|required_operations missing/,
    '15-op profile omitting baseline op in favor of lock op must be rejected'
  );
});

test('unit regression: comprehensive multipart inherited attribute and accessor branch coverage (OPEN-2)', () => {
  const validManifest = {
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  // 1. Inherited part_number, etag, size_bytes in parts array
  const partWithInheritedNum = Object.create({ part_number: 1 });
  partWithInheritedNum.etag = '"0123456789abcdef0123456789abcdef"';
  const resPartNum = dispatchS3CompleteMultipartUpload({ parts: [partWithInheritedNum] }, validStoredParts);
  assert.equal(resPartNum.http_status, 400);

  const partWithInheritedEtag = Object.create({ etag: '"0123456789abcdef0123456789abcdef"' });
  partWithInheritedEtag.part_number = 1;
  const resPartEtag = dispatchS3CompleteMultipartUpload({ parts: [partWithInheritedEtag] }, validStoredParts);
  assert.equal(resPartEtag.http_status, 400);

  const partWithInheritedSize = Object.create({ size_bytes: 5242880 });
  partWithInheritedSize.part_number = 1;
  partWithInheritedSize.etag = '"0123456789abcdef0123456789abcdef"';
  const resPartSize = dispatchS3CompleteMultipartUpload({ parts: [partWithInheritedSize] }, validStoredParts);
  assert.equal(resPartSize.http_status, 400);

  // 2. Inherited part attributes in storedParts array
  const storedWithInheritedNum = Object.create({ part_number: 1 });
  storedWithInheritedNum.etag = '"0123456789abcdef0123456789abcdef"';
  storedWithInheritedNum.size_bytes = 5242880;
  const resStoredArrNum = dispatchS3CompleteMultipartUpload(validManifest, [storedWithInheritedNum]);
  assert.equal(resStoredArrNum.http_status, 400);

  const storedWithInheritedEtag = Object.create({ etag: '"0123456789abcdef0123456789abcdef"' });
  storedWithInheritedEtag.part_number = 1;
  storedWithInheritedEtag.size_bytes = 5242880;
  const resStoredArrEtag = dispatchS3CompleteMultipartUpload(validManifest, [storedWithInheritedEtag]);
  assert.equal(resStoredArrEtag.http_status, 400);

  const storedWithInheritedSize = Object.create({ size_bytes: 5242880 });
  storedWithInheritedSize.part_number = 1;
  storedWithInheritedSize.etag = '"0123456789abcdef0123456789abcdef"';
  const resStoredArrSize = dispatchS3CompleteMultipartUpload(validManifest, [storedWithInheritedSize]);
  assert.equal(resStoredArrSize.http_status, 400);

  // 3. Inherited part attributes in storedParts Map
  const resStoredMapNum = dispatchS3CompleteMultipartUpload(validManifest, new Map([[1, storedWithInheritedNum]]));
  assert.equal(resStoredMapNum.http_status, 400);
  const resStoredMapEtag = dispatchS3CompleteMultipartUpload(validManifest, new Map([[1, storedWithInheritedEtag]]));
  assert.equal(resStoredMapEtag.http_status, 400);
  const resStoredMapSize = dispatchS3CompleteMultipartUpload(validManifest, new Map([[1, storedWithInheritedSize]]));
  assert.equal(resStoredMapSize.http_status, 400);

  // 4. Inherited part attributes in storedParts plain Object
  const resStoredObjNum = dispatchS3CompleteMultipartUpload(validManifest, { 1: storedWithInheritedNum });
  assert.equal(resStoredObjNum.http_status, 400);
  const resStoredObjEtag = dispatchS3CompleteMultipartUpload(validManifest, { 1: storedWithInheritedEtag });
  assert.equal(resStoredObjEtag.http_status, 400);
  const resStoredObjSize = dispatchS3CompleteMultipartUpload(validManifest, { 1: storedWithInheritedSize });
  assert.equal(resStoredObjSize.http_status, 400);

  // 5. Inherited headers, manifest, parts on manifestOrOptions
  const optsWithInheritedHdrs = Object.create({ headers: {} });
  optsWithInheritedHdrs.parts = validManifest.parts;
  const resInheritedHdrs = dispatchS3CompleteMultipartUpload(optsWithInheritedHdrs, validStoredParts);
  assert.equal(resInheritedHdrs.http_status, 400);

  const optsWithInheritedManifest = Object.create({ manifest: validManifest });
  const resInheritedManifest = dispatchS3CompleteMultipartUpload(optsWithInheritedManifest, validStoredParts);
  assert.equal(resInheritedManifest.http_status, 400);

  const optsWithInheritedParts = Object.create({ parts: validManifest.parts });
  const resInheritedParts = dispatchS3CompleteMultipartUpload(optsWithInheritedParts, validStoredParts);
  assert.equal(resInheritedParts.http_status, 400);

  class CustomHeaders { constructor() { this['content-type'] = 'text/plain'; } }
  const optsWithClassHdrs = { headers: new CustomHeaders(), parts: validManifest.parts };
  const resClassHdrs = dispatchS3CompleteMultipartUpload(optsWithClassHdrs, validStoredParts);
  assert.equal(resClassHdrs.http_status, 400);

  // 6. Inherited payload, payloadBytes, body, and digest keys in dispatchS3Error
  const errInheritedPayload = Object.create({ payload: 'test' });
  const resErrPayload = dispatchS3Error(errInheritedPayload);
  assert.equal(resErrPayload.http_status, 400);

  const errInheritedPayloadBytes = Object.create({ payloadBytes: Buffer.from('test') });
  const resErrPayloadBytes = dispatchS3Error(errInheritedPayloadBytes);
  assert.equal(resErrPayloadBytes.http_status, 400);

  const errInheritedBody = Object.create({ body: 'test' });
  const resErrBody = dispatchS3Error(errInheritedBody);
  assert.equal(resErrBody.http_status, 400);

  const errInheritedShaHeader = Object.create({ 'x-amz-content-sha256': 'abc' });
  const resErrShaHeader = dispatchS3Error(errInheritedShaHeader);
  assert.equal(resErrShaHeader.http_status, 400);

  // 7. Inherited payload, payloadBytes, body, headers, and digest keys in dispatchS3PutObject
  const putInheritedPayload = Object.create({ payload: 'test' });
  const resPutPayload = dispatchS3PutObject(putInheritedPayload);
  assert.equal(resPutPayload.http_status, 400);

  const putInheritedPayloadBytes = Object.create({ payloadBytes: Buffer.from('test') });
  const resPutPayloadBytes = dispatchS3PutObject(putInheritedPayloadBytes);
  assert.equal(resPutPayloadBytes.http_status, 400);

  const putInheritedBody = Object.create({ body: 'test' });
  const resPutBody = dispatchS3PutObject(putInheritedBody);
  assert.equal(resPutBody.http_status, 400);

  const putInheritedHeaders = Object.create({ headers: {} });
  const resPutHeaders = dispatchS3PutObject(putInheritedHeaders);
  assert.equal(resPutHeaders.http_status, 400);

  const putInheritedDigestKey = Object.create({ 'Content-MD5': 'abc' });
  const resPutDigestKey = dispatchS3PutObject(putInheritedDigestKey);
  assert.equal(resPutDigestKey.http_status, 400);

  const hdrsWithInheritedKey = Object.create({ 'Content-MD5': 'abc' });
  const resHdrsInheritedKey = dispatchS3PutObject({ payload: 'abc', headers: hdrsWithInheritedKey });
  assert.equal(resHdrsInheritedKey.http_status, 400);

  const hdrsWithInheritedKey2 = Object.create({ 'custom-header': 'abc' });
  const resHdrsInheritedKey2 = dispatchS3PutObject({ payload: 'abc', headers: hdrsWithInheritedKey2 });
  assert.equal(resHdrsInheritedKey2.http_status, 400);

  // 8. Object.prototype pollution defense across dispatchers and validators
  try {
    Object.prototype.payload = 'polluted-payload';
    assert.equal(dispatchS3PutObject({}).http_status, 400);
    assert.equal(dispatchS3Error({}).http_status, 400);
  } finally {
    delete Object.prototype.payload;
  }

  try {
    Object.prototype.payloadBytes = Buffer.from('polluted');
    assert.equal(dispatchS3PutObject({}).http_status, 400);
    assert.equal(dispatchS3Error({}).http_status, 400);
  } finally {
    delete Object.prototype.payloadBytes;
  }

  try {
    Object.prototype.body = 'polluted-body';
    assert.equal(dispatchS3PutObject({}).http_status, 400);
    assert.equal(dispatchS3Error({}).http_status, 400);
  } finally {
    delete Object.prototype.body;
  }

  try {
    Object.prototype.headers = { 'x-amz-content-sha256': 'polluted' };
    assert.equal(dispatchS3PutObject({ payload: 'valid' }).http_status, 400);
  } finally {
    delete Object.prototype.headers;
  }

  try {
    Object.prototype['Content-MD5'] = 'polluted-md5';
    assert.equal(dispatchS3PutObject({ payload: 'valid', headers: {} }).http_status, 400);
    assert.equal(dispatchS3Error({}).http_status, 400);
  } finally {
    delete Object.prototype['Content-MD5'];
  }

  try {
    Object.prototype['x-amz-content-sha256'] = 'polluted-sha';
    assert.equal(dispatchS3PutObject({ payload: 'valid', headers: {} }).http_status, 400);
    assert.equal(dispatchS3Error({}).http_status, 400);
  } finally {
    delete Object.prototype['x-amz-content-sha256'];
  }

  try {
    Object.prototype.manifest = { parts: [] };
    assert.equal(dispatchS3CompleteMultipartUpload({}).http_status, 400);
  } finally {
    delete Object.prototype.manifest;
  }

  try {
    Object.prototype.parts = [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }];
    assert.equal(dispatchS3CompleteMultipartUpload({}).http_status, 400);
  } finally {
    delete Object.prototype.parts;
  }

  try {
    Object.prototype.part_number = 1;
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{}] }, validStoredParts).http_status, 400);
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, [{}]).http_status, 400);
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, new Map([[1, {}]])).http_status, 400);
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, { 1: {} }).http_status, 400);
  } finally {
    delete Object.prototype.part_number;
  }

  try {
    Object.prototype.etag = '"0123456789abcdef0123456789abcdef"';
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1 }] }, validStoredParts).http_status, 400);
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, [{ part_number: 1, size_bytes: 5242880 }]).http_status, 400);
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, new Map([[1, { part_number: 1, size_bytes: 5242880 }]])).http_status, 400);
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, { 1: { part_number: 1, size_bytes: 5242880 } }).http_status, 400);
  } finally {
    delete Object.prototype.etag;
  }

  try {
    Object.prototype.size_bytes = 5242880;
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] }, validStoredParts).http_status, 400);
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }]).http_status, 400);
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, new Map([[1, { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }]])).http_status, 400);
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, { 1: { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' } }).http_status, 400);
  } finally {
    delete Object.prototype.size_bytes;
  }

  try {
    Object.prototype.total_parts = 1;
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, validStoredParts).http_status, 400);
  } finally {
    delete Object.prototype.total_parts;
  }

  try {
    Object.prototype.total_size_bytes = 5242880;
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, validStoredParts).http_status, 400);
  } finally {
    delete Object.prototype.total_size_bytes;
  }
});

test('regression: 5 GiB PutObject payload limit returning HTTP 400 EntityTooLarge (PAYLOAD_EXCEEDS_5GIB_LIMIT) (OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_5GIB_LIMIT_TEST_PAYLOAD');
  const validSha = computePayloadSha256(payload);
  const FIVE_GIB = 5 * 1024 * 1024 * 1024; // 5368709120 bytes

  // 1. content_length exceeding 5 GiB returns HTTP 400 EntityTooLarge (PAYLOAD_EXCEEDS_5GIB_LIMIT)
  const resExceededNum = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: FIVE_GIB + 1,
  });
  assert.equal(resExceededNum.http_status, 400);
  assert.equal(resExceededNum.error_code, 'EntityTooLarge');
  assert.equal(resExceededNum.code, 'EntityTooLarge');
  assert.equal(resExceededNum.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 2. content_length as string exceeding 5 GiB
  const resExceededStr = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: String(FIVE_GIB + 100),
  });
  assert.equal(resExceededStr.http_status, 400);
  assert.equal(resExceededStr.error_code, 'EntityTooLarge');
  assert.equal(resExceededStr.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 3. contentLength alias exceeding 5 GiB
  const resExceededCamel = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    contentLength: FIVE_GIB + 1,
  });
  assert.equal(resExceededCamel.http_status, 400);
  assert.equal(resExceededCamel.error_code, 'EntityTooLarge');
  assert.equal(resExceededCamel.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 4. content_length_bytes alias exceeding 5 GiB
  const resExceededBytes = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length_bytes: FIVE_GIB + 1,
  });
  assert.equal(resExceededBytes.http_status, 400);
  assert.equal(resExceededBytes.error_code, 'EntityTooLarge');
  assert.equal(resExceededBytes.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 5. size_bytes alias exceeding 5 GiB
  const resExceededSizeBytes = dispatchS3PutObject({
    payloadBytes: payload,
    size_bytes: FIVE_GIB + 1,
    'x-amz-content-sha256': validSha,
  });
  assert.equal(resExceededSizeBytes.http_status, 400);
  assert.equal(resExceededSizeBytes.error_code, 'EntityTooLarge');
  assert.equal(resExceededSizeBytes.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 6. Content-Length in headers exceeding 5 GiB
  const resExceededHdr = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    headers: { 'Content-Length': FIVE_GIB + 1 },
  });
  assert.equal(resExceededHdr.http_status, 400);
  assert.equal(resExceededHdr.error_code, 'EntityTooLarge');
  assert.equal(resExceededHdr.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 7. PutObject with error_condition PAYLOAD_EXCEEDS_5GIB_LIMIT
  const tooLargeRes4 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    error_condition: 'PAYLOAD_EXCEEDS_5GIB_LIMIT',
  });
  assert.equal(tooLargeRes4.http_status, 400);
  assert.equal(tooLargeRes4.error_code, 'EntityTooLarge');
  assert.equal(tooLargeRes4.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 8. Conflicting length declarations: small content_length + oversized contentLength (> 5 GiB)
  const resConflict1 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 100,
    contentLength: 6000000000,
  });
  assert.equal(resConflict1.http_status, 400);
  assert.equal(resConflict1.error_code, 'EntityTooLarge');
  assert.equal(resConflict1.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 9. Conflicting length declarations: small content_length + oversized Content-Length header
  const resConflict2 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 100,
    headers: { 'Content-Length': '6000000000' },
  });
  assert.equal(resConflict2.http_status, 400);
  assert.equal(resConflict2.error_code, 'EntityTooLarge');
  assert.equal(resConflict2.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 10. Conflicting length declarations: small contentLength + oversized content_length
  const resConflict3 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    contentLength: 100,
    content_length: 6000000000,
  });
  assert.equal(resConflict3.http_status, 400);
  assert.equal(resConflict3.error_code, 'EntityTooLarge');
  assert.equal(resConflict3.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 11. Conflicting length declarations: small content_length + oversized content_length_bytes / size_bytes
  const resConflict4 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 100,
    content_length_bytes: 6000000000,
  });
  assert.equal(resConflict4.http_status, 400);
  assert.equal(resConflict4.error_code, 'EntityTooLarge');
  assert.equal(resConflict4.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  const resConflict5 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 100,
    size_bytes: 6000000000,
  });
  assert.equal(resConflict5.http_status, 400);
  assert.equal(resConflict5.error_code, 'EntityTooLarge');
  assert.equal(resConflict5.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 12. Multibyte UTF-8 string sizing verification
  const multibyteStr = '⚡CYBRIK🚀SOVEREIGN💎'.repeat(5);
  const multibyteByteLen = Buffer.byteLength(multibyteStr, 'utf8');
  assert.ok(multibyteByteLen > multibyteStr.length, 'Multibyte UTF-8 byte length must strictly exceed UTF-16 character length');
  const multibyteSha = computePayloadSha256(multibyteStr);
  const multibyteMd5 = computePayloadMd5(multibyteStr);
  const multibyteSuccessRes = dispatchS3PutObject({
    payloadBytes: multibyteStr,
    'x-amz-content-sha256': multibyteSha,
    contentMd5Header: multibyteMd5,
  });
  assert.equal(multibyteSuccessRes.http_status, 200);
  assert.equal(multibyteSuccessRes.error_code, null);

  const multibyteTooLargeRes = dispatchS3PutObject({
    payloadBytes: multibyteStr,
    'x-amz-content-sha256': multibyteSha,
    error_condition: 'PAYLOAD_EXCEEDS_5GIB_LIMIT',
  });
  assert.equal(multibyteTooLargeRes.http_status, 400);
  assert.equal(multibyteTooLargeRes.error_code, 'EntityTooLarge');
  assert.equal(multibyteTooLargeRes.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 13. Exactly 5 GiB boundary (5368709120 bytes) is permitted (returns HTTP 200)
  const resExactLimit = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: FIVE_GIB,
  });
  assert.equal(resExactLimit.http_status, 200);
  assert.equal(resExactLimit.error_code, null);

  // 14. dispatchS3Error string trigger
  const errResStr = dispatchS3Error('PAYLOAD_EXCEEDS_5GIB_LIMIT');
  assert.equal(errResStr.http_status, 400);
  assert.equal(errResStr.error_code, 'EntityTooLarge');
  assert.equal(errResStr.code, 'EntityTooLarge');
  assert.equal(errResStr.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 15. dispatchS3Error object trigger
  const errResObj = dispatchS3Error({ reason: 'PAYLOAD_EXCEEDS_5GIB_LIMIT' });
  assert.equal(errResObj.http_status, 400);
  assert.equal(errResObj.error_code, 'EntityTooLarge');
  assert.equal(errResObj.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 16. dispatchS3Error error_condition trigger
  const errResCond = dispatchS3Error({ error_condition: 'PAYLOAD_EXCEEDS_5GIB_LIMIT' });
  assert.equal(errResCond.http_status, 400);
  assert.equal(errResCond.error_code, 'EntityTooLarge');
  assert.equal(errResCond.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 17. dispatchS3Error conflicting length declarations
  const errConflict1 = dispatchS3Error({ content_length: 100, contentLength: 6000000000 });
  assert.equal(errConflict1.http_status, 400);
  assert.equal(errConflict1.error_code, 'EntityTooLarge');
  assert.equal(errConflict1.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  const errConflict2 = dispatchS3Error({ content_length: 100, headers: { 'Content-Length': '6000000000' } });
  assert.equal(errConflict2.http_status, 400);
  assert.equal(errConflict2.error_code, 'EntityTooLarge');
  assert.equal(errConflict2.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 18. Multibyte UTF-8 payload byte length computed with Buffer.byteLength (not string code units)
  const mbString = '🚀 🌟 ✨ こんにちは 🌍';
  const mbSha = computePayloadSha256(mbString);
  const mbPutRes = dispatchS3PutObject({
    payload: mbString,
    'x-amz-content-sha256': mbSha,
    content_length: Buffer.byteLength(mbString, 'utf8'),
  });
  assert.equal(mbPutRes.http_status, 200);
  assert.equal(mbPutRes.error_code, null);

  // 19. Reconcile declared lengths: ANY declared source exceeding 5 GiB returns EntityTooLarge
  const multiSourceRes1 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 100,
    headers: { 'Content-Length': 5368709121 },
  });
  assert.equal(multiSourceRes1.http_status, 400);
  assert.equal(multiSourceRes1.error_code, 'EntityTooLarge');
  assert.equal(multiSourceRes1.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  const multiSourceRes2 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    contentLength: 100,
    headers: { 'content-length': '5368709121' },
  });
  assert.equal(multiSourceRes2.http_status, 400);
  assert.equal(multiSourceRes2.error_code, 'EntityTooLarge');
  assert.equal(multiSourceRes2.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  const multiSourceRes3 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 100,
    size_bytes: 5368709121,
  });
  assert.equal(multiSourceRes3.http_status, 400);
  assert.equal(multiSourceRes3.error_code, 'EntityTooLarge');
  assert.equal(multiSourceRes3.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
});

test('regression: unauthorized UNSIGNED-PAYLOAD returning HTTP 400 InvalidDigest (UNSIGNED_PAYLOAD_NOT_PERMITTED) and authorized returning HTTP 200 (OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_UNSIGNED_PAYLOAD_GATING_TEST');
  const validMd5 = computePayloadMd5(payload);

  // 1. UNSIGNED-PAYLOAD without authorization returns HTTP 400 InvalidDigest / UNSIGNED_PAYLOAD_NOT_PERMITTED
  const resNoAuth = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  });
  assert.equal(resNoAuth.http_status, 400);
  assert.equal(resNoAuth.error_code, 'InvalidDigest');
  assert.equal(resNoAuth.code, 'InvalidDigest');
  assert.equal(resNoAuth.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 2. UNSIGNED-PAYLOAD with allow_unsigned_payload: false returns HTTP 400 InvalidDigest
  const resFalseAuth = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: false,
  });
  assert.equal(resFalseAuth.http_status, 400);
  assert.equal(resFalseAuth.error_code, 'InvalidDigest');
  assert.equal(resFalseAuth.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 3. Adversarial regression: unauthorized UNSIGNED-PAYLOAD with aliases returning HTTP 400 InvalidDigest (UNSIGNED_PAYLOAD_NOT_PERMITTED)
  const resAliasPermitted = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    unsigned_payload_permitted: true,
  });
  assert.equal(resAliasPermitted.http_status, 400);
  assert.equal(resAliasPermitted.error_code, 'InvalidDigest');
  assert.equal(resAliasPermitted.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  const resAliasCamelAllow = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allowUnsignedPayload: true,
  });
  assert.equal(resAliasCamelAllow.http_status, 400);
  assert.equal(resAliasCamelAllow.error_code, 'InvalidDigest');
  assert.equal(resAliasCamelAllow.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  const resAliasCamelPresigned = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    isPresigned: true,
  });
  assert.equal(resAliasCamelPresigned.http_status, 400);
  assert.equal(resAliasCamelPresigned.error_code, 'InvalidDigest');
  assert.equal(resAliasCamelPresigned.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  const resAliasAllowUnsigned = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned: true,
  });
  assert.equal(resAliasAllowUnsigned.http_status, 400);
  assert.equal(resAliasAllowUnsigned.error_code, 'InvalidDigest');
  assert.equal(resAliasAllowUnsigned.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  const resAliasUnsignedAllowed = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    unsigned_payload_allowed: true,
  });
  assert.equal(resAliasUnsignedAllowed.http_status, 400);
  assert.equal(resAliasUnsignedAllowed.error_code, 'InvalidDigest');
  assert.equal(resAliasUnsignedAllowed.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 4. Unauthorized UNSIGNED-PAYLOAD with explicit error_condition
  const unauthRes4 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    error_condition: 'UNSIGNED_PAYLOAD_NOT_PERMITTED',
  });
  assert.equal(unauthRes4.http_status, 400);
  assert.equal(unauthRes4.error_code, 'InvalidDigest');
  assert.equal(unauthRes4.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 5. Positional arguments with UNSIGNED-PAYLOAD returns HTTP 400 InvalidDigest
  const resPositional = dispatchS3PutObject(payload, validMd5, 'UNSIGNED-PAYLOAD');
  assert.equal(resPositional.http_status, 400);
  assert.equal(resPositional.error_code, 'InvalidDigest');
  assert.equal(resPositional.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 6. dispatchS3Error string trigger
  const errResStr = dispatchS3Error('UNSIGNED_PAYLOAD_NOT_PERMITTED');
  assert.equal(errResStr.http_status, 400);
  assert.equal(errResStr.error_code, 'InvalidDigest');
  assert.equal(errResStr.code, 'InvalidDigest');
  assert.equal(errResStr.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 7. dispatchS3Error object trigger
  const errResObj = dispatchS3Error({ reason: 'UNSIGNED_PAYLOAD_NOT_PERMITTED' });
  assert.equal(errResObj.http_status, 400);
  assert.equal(errResObj.error_code, 'InvalidDigest');
  assert.equal(errResObj.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 8. dispatchS3Error error_condition trigger
  const errResCond = dispatchS3Error({ error_condition: 'UNSIGNED_PAYLOAD_NOT_PERMITTED' });
  assert.equal(errResCond.http_status, 400);
  assert.equal(errResCond.error_code, 'InvalidDigest');
  assert.equal(errResCond.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 9. dispatchS3Error options with shaHeader UNSIGNED-PAYLOAD and allow_unsigned_payload: false / is_presigned: false
  const errResFalseAllow = dispatchS3Error({
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: false,
  });
  assert.equal(errResFalseAllow.http_status, 400);
  assert.equal(errResFalseAllow.error_code, 'InvalidDigest');
  assert.equal(errResFalseAllow.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  const errResFalsePresigned = dispatchS3Error({
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    is_presigned: false,
  });
  assert.equal(errResFalsePresigned.http_status, 400);
  assert.equal(errResFalsePresigned.error_code, 'InvalidDigest');
  assert.equal(errResFalsePresigned.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 10. Authorized UNSIGNED-PAYLOAD with canonical allow_unsigned_payload: true -> HTTP 200
  const resAllowed = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: true,
  });
  assert.equal(resAllowed.http_status, 200);
  assert.equal(resAllowed.error_code, null);

  // 11. Authorized UNSIGNED-PAYLOAD with canonical is_presigned: true -> HTTP 200
  const resPresigned = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    is_presigned: true,
  });
  assert.equal(resPresigned.http_status, 200);
  assert.equal(resPresigned.error_code, null);
});

test('unit regression: isolated Proxy get traps in multipart manifests fail closed with HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE) (OPEN-2)', () => {
  const validManifest = {
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  // 1. Isolated get trap on manifest wrapper object
  const isolatedGetManifestWrapper = new Proxy({
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  }, {
    get(target, prop) {
      throw new Error(`attack isolated get on manifest wrapper: ${String(prop)}`);
    },
  });
  const res1 = dispatchS3CompleteMultipartUpload(isolatedGetManifestWrapper, validStoredParts);
  assert.equal(res1.http_status, 400);
  assert.equal(res1.error_code, 'InvalidPart');
  assert.equal(res1.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res1.http_status, 200);

  // 2. Options wrapper containing isolated get trap Proxy as manifest
  const res2 = dispatchS3CompleteMultipartUpload({
    manifest: isolatedGetManifestWrapper,
    storedParts: validStoredParts,
  });
  assert.equal(res2.http_status, 400);
  assert.equal(res2.error_code, 'InvalidPart');
  assert.equal(res2.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res2.http_status, 200);

  // 3. Isolated get trap on parts array inside manifest
  const isolatedGetPartsArray = new Proxy([
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
  ], {
    get(target, prop) {
      throw new Error(`attack isolated get on parts array: ${String(prop)}`);
    },
  });
  const res3 = dispatchS3CompleteMultipartUpload({
    manifest: { parts: isolatedGetPartsArray, total_parts: 2 },
    storedParts: validStoredParts,
  });
  assert.equal(res3.http_status, 400);
  assert.equal(res3.error_code, 'InvalidPart');
  assert.equal(res3.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res3.http_status, 200);

  // 4. Manifest parts array containing an isolated get trap Proxy part element
  const isolatedGetPartElement = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
  }, {
    get(target, prop) {
      throw new Error(`attack isolated get on part element: ${String(prop)}`);
    },
  });
  const res4 = dispatchS3CompleteMultipartUpload({
    manifest: {
      parts: [isolatedGetPartElement],
      total_parts: 1,
    },
    storedParts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }],
  });
  assert.equal(res4.http_status, 400);
  assert.equal(res4.error_code, 'InvalidPart');
  assert.equal(res4.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res4.http_status, 200);

  // 5. Isolated get trap on storedParts array
  const isolatedGetStoredPartsArray = new Proxy(validStoredParts, {
    get(target, prop) {
      throw new Error(`attack isolated get on storedParts array: ${String(prop)}`);
    },
  });
  const res5a = dispatchS3CompleteMultipartUpload(validManifest, isolatedGetStoredPartsArray);
  assert.equal(res5a.http_status, 400);
  assert.equal(res5a.error_code, 'InvalidPart');
  assert.equal(res5a.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res5a.http_status, 200);

  // 6. Isolated get trap on storedParts plain object
  const isolatedGetStoredPartsObj = new Proxy({
    1: { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
  }, {
    get(target, prop) {
      throw new Error(`attack isolated get on storedParts object: ${String(prop)}`);
    },
  });
  const res6a = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] },
    isolatedGetStoredPartsObj
  );
  assert.equal(res6a.http_status, 400);
  assert.equal(res6a.error_code, 'InvalidPart');
  assert.equal(res6a.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res6a.http_status, 200);

  // 7. Stored parts containing an isolated get trap Proxy stored part element
  const isolatedGetStoredPartElement = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880,
  }, {
    get(target, prop) {
      throw new Error(`attack isolated get on stored part element: ${String(prop)}`);
    },
  });
  const res7 = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] },
    [isolatedGetStoredPartElement]
  );
  assert.equal(res7.http_status, 400);
  assert.equal(res7.error_code, 'InvalidPart');
  assert.equal(res7.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res7.http_status, 200);

  // 8. validateS3MultipartSemantics fails closed on isolated get trap
  assert.throws(() => {
    validateS3MultipartSemantics(isolatedGetManifestWrapper);
  }, /InvalidPart/);

  assert.throws(() => {
    validateS3MultipartSemantics({
      parts: [isolatedGetPartElement],
    });
  }, /InvalidPart/);
});

test('unit regression: dispatchS3Error strict unsigned gating and hidden Proxy fail-closed handling (OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_UNSIGNED_GATING_TEST_PAYLOAD');
  const validMd5 = computePayloadMd5(payload);

  // 1. Missing allow_unsigned_payload / is_presigned strictly returns HTTP 400 InvalidDigest
  const resMissing = dispatchS3Error({
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  });
  assert.equal(resMissing.http_status, 400);
  assert.equal(resMissing.error_code, 'InvalidDigest');
  assert.equal(resMissing.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 2. Loose aliases strictly return HTTP 400 InvalidDigest
  const looseAliases = [
    { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allowUnsignedPayload: true },
    { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', isPresigned: true },
    { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned: true },
    { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: 'true' },
    { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: 1 },
    { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: {} },
    { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: null },
    { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: false },
    { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', is_presigned: false },
  ];

  for (const opts of looseAliases) {
    const resLoose = dispatchS3Error(opts);
    assert.equal(resLoose.http_status, 400, `Loose alias option ${JSON.stringify(opts)} must return HTTP 400`);
    assert.equal(resLoose.error_code, 'InvalidDigest');
    assert.equal(resLoose.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');
  }

  // 3. String norm 'UNSIGNED-PAYLOAD' returns HTTP 400 InvalidDigest
  const resStrNorm = dispatchS3Error('UNSIGNED-PAYLOAD');
  assert.equal(resStrNorm.http_status, 400);
  assert.equal(resStrNorm.error_code, 'InvalidDigest');
  assert.equal(resStrNorm.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 4. Canonical authorized cases return HTTP 200
  const resAuthAllow = dispatchS3Error({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: true,
  });
  assert.equal(resAuthAllow.http_status, 200);
  assert.equal(resAuthAllow.error_code, null);

  const resAuthPresigned = dispatchS3Error({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    is_presigned: true,
  });
  assert.equal(resAuthPresigned.http_status, 200);
  assert.equal(resAuthPresigned.error_code, null);

  // 5. Hidden Proxy property defense: Proxy hiding properties from ownKeys and throwing on property access
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
  ];

  // 5a. Hidden Proxy manifest wrapper
  const hiddenManifestProxy = new Proxy({
    parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }],
    total_parts: 1,
    total_size_bytes: 5242880,
  }, {
    ownKeys() {
      return []; // hides properties from ownKeys
    },
    get(target, prop) {
      if (prop === 'parts' || prop === 'manifest') {
        throw new Error(`Trapped hidden property get: ${String(prop)}`);
      }
      return Reflect.get(target, prop);
    },
  });

  const resHiddenMp = dispatchS3CompleteMultipartUpload(hiddenManifestProxy, validStoredParts);
  assert.equal(resHiddenMp.http_status, 400);
  assert.equal(resHiddenMp.error_code, 'InvalidPart');
  assert.equal(resHiddenMp.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(resHiddenMp.reason, 'EmptyPartsList');

  assert.throws(() => {
    validateS3MultipartSemantics(hiddenManifestProxy);
  }, /Semantic error: multipart upload manifest structure is invalid or malformed \(InvalidPart\)/);

  // 5b. Hidden Proxy options wrapper with manifest
  const resHiddenMpOpts = dispatchS3CompleteMultipartUpload({
    manifest: hiddenManifestProxy,
    storedParts: validStoredParts,
  });
  assert.equal(resHiddenMpOpts.http_status, 400);
  assert.equal(resHiddenMpOpts.error_code, 'InvalidPart');
  assert.equal(resHiddenMpOpts.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 5c. Hidden Proxy part element inside manifest parts array
  const hiddenPartProxy = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
  }, {
    ownKeys() {
      return [];
    },
    get(target, prop) {
      if (prop === 'part_number' || prop === 'etag') {
        throw new Error(`Trapped hidden part element property: ${String(prop)}`);
      }
      return Reflect.get(target, prop);
    },
  });

  const resHiddenPart = dispatchS3CompleteMultipartUpload({
    parts: [hiddenPartProxy],
    total_parts: 1,
  }, validStoredParts);
  assert.equal(resHiddenPart.http_status, 400);
  assert.equal(resHiddenPart.error_code, 'InvalidPart');
  assert.equal(resHiddenPart.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(resHiddenPart.reason, 'InvalidPartNumber');

  assert.throws(() => {
    validateS3MultipartSemantics({
      parts: [hiddenPartProxy],
    });
  }, /Semantic error: multipart upload manifest structure is invalid or malformed \(InvalidPart\)/);

  // 5d. Hidden Proxy stored part element
  const hiddenStoredPartProxy = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880,
  }, {
    ownKeys() {
      return [];
    },
    get(target, prop) {
      if (prop === 'part_number' || prop === 'etag' || prop === 'size_bytes') {
        throw new Error(`Trapped hidden stored part property: ${String(prop)}`);
      }
      return Reflect.get(target, prop);
    },
  });

  const resHiddenStored = dispatchS3CompleteMultipartUpload({
    parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }],
  }, [hiddenStoredPartProxy]);
  assert.equal(resHiddenStored.http_status, 400);
  assert.equal(resHiddenStored.error_code, 'InvalidPart');
  assert.equal(resHiddenStored.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(resHiddenStored.reason, 'MissingStoredPartState');

  // 5e. Hidden Proxy PutObject with throwing content_length / size / options access
  const hiddenPutProxy = new Proxy({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: true,
  }, {
    ownKeys() {
      return [];
    },
    get(target, prop) {
      if (prop === 'content_length' || prop === 'size' || prop === 'payload') {
        throw new Error(`Trapped hidden PutObject property: ${String(prop)}`);
      }
      return Reflect.get(target, prop);
    },
  });

  const resHiddenPut = dispatchS3PutObject(hiddenPutProxy);
  assert.equal(resHiddenPut.http_status, 400);
  assert.equal(resHiddenPut.error_code, 'InvalidDigest');
  assert.equal(resHiddenPut.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 5f. Hidden Proxy dispatchS3Error with throwing property access
  const resHiddenErr = dispatchS3Error(hiddenPutProxy);
  assert.equal(resHiddenErr.http_status, 400);
  assert.equal(resHiddenErr.error_code, 'InvalidDigest');
  assert.equal(resHiddenErr.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('regression: dispatchS3Error with UNSIGNED-PAYLOAD and missing / alias flags returns HTTP 400 InvalidDigest (UNSIGNED_PAYLOAD_NOT_PERMITTED) (OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_UNSIGNED_PAYLOAD_ERROR_TEST');
  const validMd5 = computePayloadMd5(payload);

  // 1. Missing authorization flags -> HTTP 400 InvalidDigest (UNSIGNED_PAYLOAD_NOT_PERMITTED)
  const resMissing = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    contentMd5Header: validMd5,
  });
  assert.equal(resMissing.http_status, 400);
  assert.equal(resMissing.error_code, 'InvalidDigest');
  assert.equal(resMissing.code, 'InvalidDigest');
  assert.equal(resMissing.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 2. Explicit allow_unsigned_payload: false -> HTTP 400 InvalidDigest
  const resExplicitFalse = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: false,
  });
  assert.equal(resExplicitFalse.http_status, 400);
  assert.equal(resExplicitFalse.error_code, 'InvalidDigest');
  assert.equal(resExplicitFalse.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 3. Explicit is_presigned: false -> HTTP 400 InvalidDigest
  const resPresignedFalse = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    is_presigned: false,
  });
  assert.equal(resPresignedFalse.http_status, 400);
  assert.equal(resPresignedFalse.error_code, 'InvalidDigest');
  assert.equal(resPresignedFalse.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 4. Alias flag: unsigned_payload_permitted: true -> HTTP 400 InvalidDigest
  const resAliasPermitted = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    unsigned_payload_permitted: true,
  });
  assert.equal(resAliasPermitted.http_status, 400);
  assert.equal(resAliasPermitted.error_code, 'InvalidDigest');
  assert.equal(resAliasPermitted.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 5. Alias flag: allowUnsignedPayload: true -> HTTP 400 InvalidDigest
  const resAliasCamelAllow = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allowUnsignedPayload: true,
  });
  assert.equal(resAliasCamelAllow.http_status, 400);
  assert.equal(resAliasCamelAllow.error_code, 'InvalidDigest');
  assert.equal(resAliasCamelAllow.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 6. Alias flag: isPresigned: true -> HTTP 400 InvalidDigest
  const resAliasCamelPresigned = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    isPresigned: true,
  });
  assert.equal(resAliasCamelPresigned.http_status, 400);
  assert.equal(resAliasCamelPresigned.error_code, 'InvalidDigest');
  assert.equal(resAliasCamelPresigned.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 7. Alias flag: allow_unsigned: true -> HTTP 400 InvalidDigest
  const resAliasAllowUnsigned = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned: true,
  });
  assert.equal(resAliasAllowUnsigned.http_status, 400);
  assert.equal(resAliasAllowUnsigned.error_code, 'InvalidDigest');
  assert.equal(resAliasAllowUnsigned.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 8. Alias flag: unsigned_payload_allowed: true -> HTTP 400 InvalidDigest
  const resAliasUnsignedAllowed = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    unsigned_payload_allowed: true,
  });
  assert.equal(resAliasUnsignedAllowed.http_status, 400);
  assert.equal(resAliasUnsignedAllowed.error_code, 'InvalidDigest');
  assert.equal(resAliasUnsignedAllowed.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 9. Canonical allow_unsigned_payload: true -> HTTP 200
  const resAuthorized = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    contentMd5Header: validMd5,
    allow_unsigned_payload: true,
  });
  assert.equal(resAuthorized.http_status, 200);
  assert.equal(resAuthorized.error_code, null);

  // 10. Canonical is_presigned: true -> HTTP 200
  const resAuthorizedPresigned = dispatchS3Error({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    contentMd5Header: validMd5,
    is_presigned: true,
  });
  assert.equal(resAuthorizedPresigned.http_status, 200);
  assert.equal(resAuthorizedPresigned.error_code, null);
});

test('unit regression: Proxy with hidden content_length: 5368709121 that throws on isolated get returns HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE) under proxy fail-closed gating (OPEN-2)', () => {
  const payload = Buffer.from('TEST_PAYLOAD');
  const validSha = computePayloadSha256(payload);

  // 1. Proxy with target content_length: 5368709121 and throwing isolated get trap passed to dispatchS3PutObject
  const hiddenOversizedPutProxy = new Proxy({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 5368709121,
  }, {
    get(target, prop) {
      throw new Error(`attack isolated get on PutObject option: ${String(prop)}`);
    },
  });

  assert.equal(hasOversizedDeclaredLength(hiddenOversizedPutProxy), true);
  const putRes = dispatchS3PutObject(hiddenOversizedPutProxy);
  assert.equal(putRes.http_status, 400);
  assert.equal(putRes.error_code, 'InvalidDigest');
  assert.equal(putRes.code, 'InvalidDigest');
  assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.notEqual(putRes.http_status, 200);

  // 2. Proxy with target content_length: 5368709121 and throwing isolated get trap passed to dispatchS3Error
  const hiddenOversizedErrProxy = new Proxy({
    payloadBytes: payload,
    content_length: 5368709121,
  }, {
    get(target, prop) {
      throw new Error(`attack isolated get on error option: ${String(prop)}`);
    },
  });

  assert.equal(hasOversizedDeclaredLength(hiddenOversizedErrProxy), true);
  const errRes = dispatchS3Error(hiddenOversizedErrProxy);
  assert.equal(errRes.http_status, 400);
  assert.equal(errRes.error_code, 'InvalidDigest');
  assert.equal(errRes.code, 'InvalidDigest');
  assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.notEqual(errRes.http_status, 200);

  // 3. Proxy with ownKeys & getOwnPropertyDescriptor revealing content_length: 5368709121
  const hiddenDescriptorProxy = new Proxy({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
  }, {
    ownKeys(target) {
      return ['payloadBytes', 'x-amz-content-sha256', 'content_length'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'content_length') {
        return { value: 5368709121, configurable: true, enumerable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      throw new Error(`attack isolated get: ${String(prop)}`);
    },
  });

  assert.equal(hasOversizedDeclaredLength(hiddenDescriptorProxy), true);
  const descPutRes = dispatchS3PutObject(hiddenDescriptorProxy);
  assert.equal(descPutRes.http_status, 400);
  assert.equal(descPutRes.error_code, 'InvalidDigest');
  assert.equal(descPutRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const descErrRes = dispatchS3Error(hiddenDescriptorProxy);
  assert.equal(descErrRes.http_status, 400);
  assert.equal(descErrRes.error_code, 'InvalidDigest');
  assert.equal(descErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 4. Proxy with oversized contentLength / size_bytes variations
  const sizeBytesProxy = new Proxy({
    size_bytes: 5368709121,
  }, {
    get(target, prop) {
      throw new Error(`attack isolated get: ${String(prop)}`);
    },
  });
  assert.equal(hasOversizedDeclaredLength(sizeBytesProxy), true);
  const sizeBytesRes = dispatchS3PutObject(sizeBytesProxy);
  assert.equal(sizeBytesRes.http_status, 400);
  assert.equal(sizeBytesRes.error_code, 'InvalidDigest');
  assert.equal(sizeBytesRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 5. Plain object with oversized contentLength returns EntityTooLarge
  const plainOversizedObj = {
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 5368709121,
  };
  const plainPutRes = dispatchS3PutObject(plainOversizedObj);
  assert.equal(plainPutRes.http_status, 400);
  assert.equal(plainPutRes.error_code, 'EntityTooLarge');
  assert.equal(plainPutRes.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
});

test('unit regression: Proxy with hidden configurable properties from ownKeys that throws on property access in multipart returns HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE) (OPEN-2)', () => {
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  // 1. Manifest wrapper Proxy with hidden configurable property from ownKeys that throws on access
  const hiddenPropManifestWrapper = new Proxy({
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  }, {
    ownKeys(target) {
      return [...Reflect.ownKeys(target), 'hidden_trap_prop'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'hidden_trap_prop') {
        return { value: 'malicious', configurable: true, enumerable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      if (prop === 'hidden_trap_prop') {
        throw new Error('attack on hidden property access');
      }
      return Reflect.get(target, prop);
    },
  });

  const res1 = dispatchS3CompleteMultipartUpload(hiddenPropManifestWrapper, validStoredParts);
  assert.equal(res1.http_status, 400);
  assert.equal(res1.error_code, 'InvalidPart');
  assert.equal(res1.code, 'InvalidPart');
  assert.equal(res1.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res1.http_status, 200);

  // 2. Options wrapper containing hidden configurable property Proxy as manifest
  const res2 = dispatchS3CompleteMultipartUpload({
    manifest: hiddenPropManifestWrapper,
    storedParts: validStoredParts,
  });
  assert.equal(res2.http_status, 400);
  assert.equal(res2.error_code, 'InvalidPart');
  assert.equal(res2.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res2.http_status, 200);

  // 3. Manifest parts array Proxy with hidden configurable property from ownKeys that throws on access
  const rawParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
  ];
  const hiddenPropPartsArray = new Proxy(rawParts, {
    ownKeys(target) {
      return [...Reflect.ownKeys(target), 'hidden_array_trap'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'hidden_array_trap') {
        return { value: 'malicious', configurable: true, enumerable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      if (prop === 'hidden_array_trap') {
        throw new Error('attack on hidden array property access');
      }
      return Reflect.get(target, prop);
    },
  });

  const res3 = dispatchS3CompleteMultipartUpload({
    manifest: { parts: hiddenPropPartsArray, total_parts: 2 },
    storedParts: validStoredParts,
  });
  assert.equal(res3.http_status, 400);
  assert.equal(res3.error_code, 'InvalidPart');
  assert.equal(res3.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res3.http_status, 200);

  // 4. Manifest part element Proxy with hidden configurable property from ownKeys that throws on access
  const hiddenPropPartElement = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
  }, {
    ownKeys(target) {
      return [...Reflect.ownKeys(target), 'hidden_element_trap'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'hidden_element_trap') {
        return { value: 'malicious', configurable: true, enumerable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      if (prop === 'hidden_element_trap') {
        throw new Error('attack on hidden element property access');
      }
      return Reflect.get(target, prop);
    },
  });

  const res4 = dispatchS3CompleteMultipartUpload({
    manifest: {
      parts: [hiddenPropPartElement],
      total_parts: 1,
    },
    storedParts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }],
  });
  assert.equal(res4.http_status, 400);
  assert.equal(res4.error_code, 'InvalidPart');
  assert.equal(res4.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res4.http_status, 200);

  // 5. Stored parts containing a hidden configurable property Proxy stored part element
  const hiddenPropStoredPartElement = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880,
  }, {
    ownKeys(target) {
      return [...Reflect.ownKeys(target), 'hidden_stored_trap'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'hidden_stored_trap') {
        return { value: 'malicious', configurable: true, enumerable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      if (prop === 'hidden_stored_trap') {
        throw new Error('attack on hidden stored part property access');
      }
      return Reflect.get(target, prop);
    },
  });

  const res5 = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] },
    [hiddenPropStoredPartElement]
  );
  assert.equal(res5.http_status, 400);
  assert.equal(res5.error_code, 'InvalidPart');
  assert.equal(res5.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.notEqual(res5.http_status, 200);

  // 6. validateS3MultipartSemantics fails closed with InvalidPart on hidden configurable property Proxy
  assert.throws(() => {
    validateS3MultipartSemantics(hiddenPropManifestWrapper);
  }, /InvalidPart/);

  assert.throws(() => {
    validateS3MultipartSemantics({
      parts: [hiddenPropPartElement],
    });
  }, /InvalidPart/);
});

test('schema regression: 15-op non-lock profile with object_lock_supported: false, legal_hold_supported: false, supported_retention_modes: [] passes Ajv schema validation truthfully (OPEN-2)', () => {
  const nonLock15Profile = {
    provider_identifier: 'minio-embedded-nonlock',
    mandatory_operations: {
      crud: true,
      multipart_upload: true,
      presigning: true,
      sig_v4: true,
      path_style_access: true,
      versioning: true,
      error_mappings: true,
    },
    object_lock_supported: false,
    legal_hold_supported: false,
    retention_modes_supported: [],
    required_operations: [
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
    ],
    addressing_style: 'path_style',
    auth_mechanism: 'AWS4-HMAC-SHA256',
    required_error_codes: [
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
    ],
  };

  // 1. Passes Ajv schema validation against root S3 schema
  const validRoot = ajv.validate(S3_SCHEMA_ID, nonLock15Profile);
  assert.ok(validRoot, `15-op non-lock profile with object_lock_supported: false, legal_hold_supported: false, retention_modes_supported: [] must pass root schema: ${ajv.errorsText()}`);

  // 2. Passes Ajv schema validation against storageConformanceProfile def
  const validProfile = ajv.validate(PROFILE_DEF_ID, nonLock15Profile);
  assert.ok(validProfile, `15-op non-lock profile with object_lock_supported: false, legal_hold_supported: false, retention_modes_supported: [] must pass profile def: ${ajv.errorsText()}`);

  // 3. Passes validateS3ConformanceProfileSemantics semantic validation
  assert.doesNotThrow(() => {
    validateS3ConformanceProfileSemantics(nonLock15Profile);
  }, '15-op non-lock profile must pass validateS3ConformanceProfileSemantics');
});

test('regression: OPEN-5 capability with required_for_optimal: false yields ACTIVE_OPTIMAL when omitted, and required_for_optimal: true yields ACTIVE_DEGRADED (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  if (!ajv.getSchema(pcnSchemaId)) {
    const pcnPath = join(JSON_SCHEMA_DIR, 'cybrik.provider-capability-negotiation.v1.schema.json');
    const pcnDoc = JSON.parse(readFileSync(pcnPath, 'utf8'));
    ajv.addSchema(pcnDoc, pcnDoc.$id);
  }

  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  assert.ok(existsSync(samplePath), `Sample capability handshake missing: ${samplePath}`);
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. Positive baseline: capability with required_for_optimal: false omitted from request yields ACTIVE_OPTIMAL lease
  const optimalHandshake = JSON.parse(JSON.stringify(sample));
  optimalHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  optimalHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';

  // Keep only ai_tensor_acceleration (granted full) and storage_object_lock (granted full); omit cache_cluster_replication (which has required_for_optimal: false)
  optimalHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: true,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  optimalHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      disposition: 'GRANTED_FULL',
      active_mode: 'gpu_direct',
      fallback_applied: 'NONE',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];

  // Passes Ajv schema validation
  const validOptimalSchema = ajv.validate(pcnSchemaId, optimalHandshake);
  assert.ok(validOptimalSchema, `ACTIVE_OPTIMAL handshake with omitted non-optimal capability must pass schema validation: ${ajv.errorsText()}`);

  // Passes validatePlatformSemantics semantic validation
  assert.doesNotThrow(() => {
    validatePlatformSemantics(optimalHandshake, pcnSchemaId);
  }, 'ACTIVE_OPTIMAL lease with non-optimal capability omitted must pass platform semantics');

  // 2. Capability with required_for_optimal: true degraded/with fallback yields ACTIVE_DEGRADED lease
  const degradedHandshake = JSON.parse(JSON.stringify(sample));
  degradedHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  degradedHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  degradedHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: true,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: true,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  degradedHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      disposition: 'GRANTED_DEGRADED',
      active_mode: 'cpu_quantized_emulation',
      fallback_applied: 'CORE_EMULATION_FALLBACK',
      notes: 'Inference latency scaled due to fallback',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];

  // Passes Ajv schema validation
  const validDegradedSchema = ajv.validate(pcnSchemaId, degradedHandshake);
  assert.ok(validDegradedSchema, `ACTIVE_DEGRADED handshake must pass schema validation: ${ajv.errorsText()}`);

  // Passes validatePlatformSemantics semantic validation
  assert.doesNotThrow(() => {
    validatePlatformSemantics(degradedHandshake, pcnSchemaId);
  }, 'ACTIVE_DEGRADED lease with degraded required_for_optimal capability must pass platform semantics');

  // 3. Inverting: attempting ACTIVE_OPTIMAL when required_for_optimal: true capability is degraded throws semantic error
  const invalidOptimalHandshake = JSON.parse(JSON.stringify(degradedHandshake));
  invalidOptimalHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  invalidOptimalHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';

  assert.throws(() => {
    validatePlatformSemantics(invalidOptimalHandshake, pcnSchemaId);
  }, /Semantic error: ACTIVE_OPTIMAL lease cannot contain degraded capability/);
});

test('schema synchronization: root and $defs.storageConformanceProfile harmonize path_formatting, required, and conditionals for OPEN-2', () => {
  const profileDef = s3SchemaDoc.$defs.storageConformanceProfile;

  // 1. Synchronized properties (including path_formatting)
  assert.deepEqual(
    Object.keys(s3SchemaDoc.properties).sort(),
    Object.keys(profileDef.properties).sort(),
    'Root and $defs.storageConformanceProfile properties must be identical'
  );
  assert.deepEqual(
    s3SchemaDoc.properties.path_formatting,
    profileDef.properties.path_formatting,
    'path_formatting property definition must be identical between root and profile def'
  );
  for (const prop of Object.keys(s3SchemaDoc.properties)) {
    assert.deepEqual(
      s3SchemaDoc.properties[prop],
      profileDef.properties[prop],
      `Property '${prop}' definition must match between root and storageConformanceProfile`
    );
  }

  // 2. Synchronized required, additionalProperties, and conditional if/then/else blocks
  assert.deepEqual(s3SchemaDoc.required, profileDef.required, 'required fields must be identical');
  assert.equal(s3SchemaDoc.additionalProperties, profileDef.additionalProperties, 'additionalProperties must be identical');
  assert.deepEqual(s3SchemaDoc.if, profileDef.if, 'if conditional block must be identical');
  assert.deepEqual(s3SchemaDoc.then, profileDef.then, 'then conditional block must be identical');
  assert.deepEqual(s3SchemaDoc.else, profileDef.else, 'else conditional block must be identical');

  // 3. Storage profile fixture with path_formatting validates on both root and profile def
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  const profileWithPathFormatting = {
    ...baseProfile,
    path_formatting: {
      addressing_style: 'path_style',
      bucket_pattern: '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$',
      key_pattern: '^(?!\\/)(?!\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))(?:[a-zA-Z0-9._/~-]|%[0-9A-F]{2})+$',
      sample_bucket: 'cybrik-audit-vault',
      sample_key: 'forensics/2026/08/incident-1042-evidence.bundle',
      sample_path_style_url: 'https://storage.internal.cybrik:9000/cybrik-audit-vault/forensics/2026/08/incident-1042-evidence.bundle',
    },
  };

  assert.ok(
    ajv.validate(S3_SCHEMA_ID, profileWithPathFormatting),
    `Profile with path_formatting must pass root schema: ${ajv.errorsText()}`
  );
  assert.ok(
    ajv.validate(PROFILE_DEF_ID, profileWithPathFormatting),
    `Profile with path_formatting must pass profile def: ${ajv.errorsText()}`
  );

  // 4. Invalid path_formatting fails identically on both root and profile def
  const profileWithInvalidPathFormatting = {
    ...baseProfile,
    path_formatting: {
      addressing_style: 'virtual_hosted', // invalid: must be 'path_style'
      bucket_pattern: '^[a-z0-9.-]+$',
      key_pattern: '^.+$',
    },
  };

  assert.ok(
    !ajv.validate(S3_SCHEMA_ID, profileWithInvalidPathFormatting),
    'Invalid path_formatting must fail root schema'
  );
  assert.ok(
    !ajv.validate(PROFILE_DEF_ID, profileWithInvalidPathFormatting),
    'Invalid path_formatting must fail profile def'
  );
});

test('regression: Proxy hiding content_length: 5368709121 from ownKeys, has, and descriptors returns HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE) under proxy fail-closed gating (OPEN-2)', () => {
  const payload = Buffer.from('TEST_PAYLOAD_HIDDEN_LENGTH');
  const validSha = computePayloadSha256(payload);

  // 1. Proxy hiding content_length: 5368709121 from ownKeys, has, and getOwnPropertyDescriptor passed to dispatchS3PutObject
  const hiddenLengthPutProxy = new Proxy({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 5368709121,
  }, {
    ownKeys() {
      return ['payloadBytes', 'x-amz-content-sha256'];
    },
    has(target, prop) {
      if (prop === 'content_length' || prop === 'contentLength' || prop === 'size_bytes' || prop === 'size') {
        return false;
      }
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'content_length' || prop === 'contentLength' || prop === 'size_bytes' || prop === 'size') {
        return undefined;
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      return Reflect.get(target, prop);
    },
  });

  assert.equal(hasOversizedDeclaredLength(hiddenLengthPutProxy), true);
  const putRes = dispatchS3PutObject(hiddenLengthPutProxy);
  assert.equal(putRes.http_status, 400);
  assert.equal(putRes.error_code, 'InvalidDigest');
  assert.equal(putRes.code, 'InvalidDigest');
  assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Proxy hiding content_length: 5368709121 from ownKeys, has, and getOwnPropertyDescriptor passed to dispatchS3Error
  const hiddenLengthErrProxy = new Proxy({
    payloadBytes: payload,
    content_length: 5368709121,
  }, {
    ownKeys() {
      return ['payloadBytes'];
    },
    has(target, prop) {
      if (prop === 'content_length' || prop === 'contentLength' || prop === 'size_bytes' || prop === 'size') {
        return false;
      }
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'content_length' || prop === 'contentLength' || prop === 'size_bytes' || prop === 'size') {
        return undefined;
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      return Reflect.get(target, prop);
    },
  });

  assert.equal(hasOversizedDeclaredLength(hiddenLengthErrProxy), true);
  const errRes = dispatchS3Error(hiddenLengthErrProxy);
  assert.equal(errRes.http_status, 400);
  assert.equal(errRes.error_code, 'InvalidDigest');
  assert.equal(errRes.code, 'InvalidDigest');
  assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3. Proxy with headers hiding content-length: 5368709121 from ownKeys, has, and descriptors
  const hiddenHeaderProxy = new Proxy({
    payloadBytes: payload,
    headers: new Proxy({
      'x-amz-content-sha256': validSha,
      'content-length': '5368709121',
    }, {
      ownKeys() {
        return ['x-amz-content-sha256'];
      },
      has(target, prop) {
        if (prop === 'content-length' || prop === 'Content-Length') return false;
        return Reflect.has(target, prop);
      },
      getOwnPropertyDescriptor(target, prop) {
        if (prop === 'content-length' || prop === 'Content-Length') return undefined;
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
      get(target, prop) {
        return Reflect.get(target, prop);
      },
    }),
  }, {
    ownKeys() {
      return ['payloadBytes', 'headers'];
    },
    has(target, prop) {
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      return Reflect.get(target, prop);
    },
  });

  assert.equal(hasOversizedDeclaredLength(hiddenHeaderProxy), true);
  const putHeaderRes = dispatchS3PutObject(hiddenHeaderProxy);
  assert.equal(putHeaderRes.http_status, 400);
  assert.equal(putHeaderRes.error_code, 'InvalidDigest');
  assert.equal(putHeaderRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errHeaderRes = dispatchS3Error(hiddenHeaderProxy);
  assert.equal(errHeaderRes.http_status, 400);
  assert.equal(errHeaderRes.error_code, 'InvalidDigest');
  assert.equal(errHeaderRes.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('regression: Proxy hiding parts from ownKeys returns HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE) in dispatchS3CompleteMultipartUpload and validateS3MultipartSemantics (OPEN-2)', () => {
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  // 1. Manifest Proxy where parts is hidden from ownKeys
  const hiddenPartsManifest = new Proxy({
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  }, {
    ownKeys() {
      // Omit 'parts' from ownKeys
      return ['total_parts', 'total_size_bytes'];
    },
    has(target, prop) {
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      return Reflect.get(target, prop);
    },
  });

  // dispatchS3CompleteMultipartUpload returns HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE)
  const completeRes = dispatchS3CompleteMultipartUpload(hiddenPartsManifest, validStoredParts);
  assert.equal(completeRes.http_status, 400);
  assert.equal(completeRes.error_code, 'InvalidPart');
  assert.equal(completeRes.code, 'InvalidPart');
  assert.equal(completeRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // validateS3MultipartSemantics throws InvalidPart error
  assert.throws(
    () => validateS3MultipartSemantics(hiddenPartsManifest),
    /InvalidPart/i
  );

  // 2. Options wrapper containing hidden-parts Proxy as manifest
  const hiddenWrapperOptions = {
    manifest: hiddenPartsManifest,
    storedParts: validStoredParts,
  };
  const wrapperRes = dispatchS3CompleteMultipartUpload(hiddenWrapperOptions);
  assert.equal(wrapperRes.http_status, 400);
  assert.equal(wrapperRes.error_code, 'InvalidPart');
  assert.equal(wrapperRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
});

test('regression: path_formatting validation on $defs.storageConformanceProfile (OPEN-2)', () => {
  const s3SchemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const profileDefId = `${s3SchemaId}#/$defs/storageConformanceProfile`;

  const baseProfile = {
    provider_identifier: 'minio-enterprise-s3',
    mandatory_operations: {
      crud: true,
      multipart_upload: true,
      presigning: true,
      sig_v4: true,
      path_style_access: true,
      versioning: true,
      error_mappings: true,
    },
    object_lock_supported: true,
    retention_modes_supported: ['COMPLIANCE', 'GOVERNANCE'],
    legal_hold_supported: true,
    required_operations: [
      'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
      'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'CreateMultipartUpload',
      'UploadPart', 'CompleteMultipartUpload', 'AbortMultipartUpload',
      'ListParts', 'PutBucketVersioning', 'GetBucketVersioning',
      'PutObjectRetention', 'GetObjectRetention', 'PutObjectLegalHold',
      'GetObjectLegalHold',
    ],
    addressing_style: 'path_style',
    auth_mechanism: 'AWS4-HMAC-SHA256',
    evidence_references: [
      'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations',
      'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock',
    ],
    required_error_codes: [
      'BadDigest', 'InvalidDigest', 'NoSuchBucket', 'NoSuchKey', 'NoSuchUpload',
      'ObjectLockConfigurationNotFoundError', 'PreconditionFailed', 'AccessDenied',
      'EntityTooLarge', 'EntityTooSmall', 'InvalidArgument', 'InvalidPart',
      'InvalidPartOrder',
    ],
  };

  // 1. Profile with valid path_formatting passes $defs.storageConformanceProfile validation
  const validProfileWithPathFormatting = {
    ...JSON.parse(JSON.stringify(baseProfile)),
    path_formatting: {
      addressing_style: 'path_style',
      bucket_pattern: '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$',
      key_pattern: '^(?!\\/)(?!\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))(?:[a-zA-Z0-9._/~-]|%[0-9A-F]{2})+$',
      sample_bucket: 'cybrik-audit-bucket-01',
      sample_key: 'logs/2026/08/audit-trail.json',
      sample_path_style_url: 'https://s3.local.invalid/cybrik-audit-bucket-01/logs/2026/08/audit-trail.json',
    },
  };
  const validSchema = ajv.validate(profileDefId, validProfileWithPathFormatting);
  assert.ok(validSchema, `Profile with valid path_formatting must pass $defs.storageConformanceProfile: ${ajv.errorsText()}`);
  assert.doesNotThrow(() => validateS3ConformanceProfileSemantics(validProfileWithPathFormatting));

  // 2. Profile with invalid addressing_style in path_formatting fails $defs.storageConformanceProfile validation
  const invalidAddressingProfile = JSON.parse(JSON.stringify(validProfileWithPathFormatting));
  invalidAddressingProfile.path_formatting.addressing_style = 'virtual_hosted';
  const invalidAddressingSchema = ajv.validate(profileDefId, invalidAddressingProfile);
  assert.equal(invalidAddressingSchema, false, 'Invalid addressing_style in path_formatting must fail $defs.storageConformanceProfile');

  // 3. Profile with dot-segment in sample_key fails $defs.storageConformanceProfile validation
  const dotSegmentKeyProfile = JSON.parse(JSON.stringify(validProfileWithPathFormatting));
  dotSegmentKeyProfile.path_formatting.sample_key = 'logs/../secret.json';
  const dotKeySchema = ajv.validate(profileDefId, dotSegmentKeyProfile);
  assert.equal(dotKeySchema, false, 'Dot-segment in sample_key must fail $defs.storageConformanceProfile');

  // 4. Profile with invalid sample_bucket (uppercase) fails $defs.storageConformanceProfile validation
  const badBucketProfile = JSON.parse(JSON.stringify(validProfileWithPathFormatting));
  badBucketProfile.path_formatting.sample_bucket = 'INVALID_UPPERCASE_BUCKET';
  const badBucketSchema = ajv.validate(profileDefId, badBucketProfile);
  assert.equal(badBucketSchema, false, 'Uppercase sample_bucket must fail $defs.storageConformanceProfile');

  // 5. Profile with invalid sample_path_style_url fails $defs.storageConformanceProfile validation
  const badUrlProfile = JSON.parse(JSON.stringify(validProfileWithPathFormatting));
  badUrlProfile.path_formatting.sample_path_style_url = 'not-a-valid-url';
  const badUrlSchema = ajv.validate(profileDefId, badUrlProfile);
  assert.equal(badUrlSchema, false, 'Malformed sample_path_style_url must fail $defs.storageConformanceProfile');

  // 6. Profile without path_formatting passes $defs.storageConformanceProfile (optional property)
  const noPathFormattingProfile = JSON.parse(JSON.stringify(baseProfile));
  const validNoPathSchema = ajv.validate(profileDefId, noPathFormattingProfile);
  assert.ok(validNoPathSchema, `Profile without path_formatting must pass $defs.storageConformanceProfile: ${ajv.errorsText()}`);
});

test('regression: required_for_optimal omission and degraded-by-omission lease validation (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  assert.ok(existsSync(samplePath), `Sample capability handshake missing: ${samplePath}`);
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. Degraded-by-omission in semantic validator:
  // capability with required_for_optimal: true is omitted from negotiated_optional_capabilities
  // in an ACTIVE_DEGRADED lease where remaining capability is GRANTED_FULL with fallback NONE
  const degradedByOmissionHandshake = JSON.parse(JSON.stringify(sample));
  degradedByOmissionHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  degradedByOmissionHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  degradedByOmissionHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: true,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  // Omit ai_tensor_acceleration (required_for_optimal: true), grant storage_object_lock in full
  degradedByOmissionHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];

  // Must pass validatePlatformSemantics (valid degraded-by-omission lease)
  assert.doesNotThrow(() => {
    validatePlatformSemantics(degradedByOmissionHandshake, pcnSchemaId);
  }, 'Degraded-by-omission lease must pass validatePlatformSemantics');

  // 2. Degraded-by-fallback: capability with required_for_optimal: true is degraded with fallback applied
  const degradedByFallbackHandshake = JSON.parse(JSON.stringify(sample));
  degradedByFallbackHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  degradedByFallbackHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  degradedByFallbackHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: true,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: true,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  degradedByFallbackHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      disposition: 'GRANTED_DEGRADED',
      active_mode: 'cpu_quantized_emulation',
      fallback_applied: 'CORE_EMULATION_FALLBACK',
      notes: 'Inference latency scaled due to fallback',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];
  const validDegradedSchema = ajv.validate(pcnSchemaId, degradedByFallbackHandshake);
  assert.ok(validDegradedSchema, `ACTIVE_DEGRADED handshake with degraded capability must pass schema: ${ajv.errorsText()}`);
  assert.doesNotThrow(() => {
    validatePlatformSemantics(degradedByFallbackHandshake, pcnSchemaId);
  });

  // 3. Negative: ACTIVE_OPTIMAL lease omitting a capability with required_for_optimal: true fails semantic validation
  const invalidOptimalOmissionHandshake = JSON.parse(JSON.stringify(degradedByOmissionHandshake));
  invalidOptimalOmissionHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  invalidOptimalOmissionHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';

  assert.throws(() => {
    validatePlatformSemantics(invalidOptimalOmissionHandshake, pcnSchemaId);
  }, /Semantic error: requested optional capability 'ai_tensor_acceleration' .* is required for optimal operation but is not resolved in agreed_capability_lease/);

  // 4. Negative: ACTIVE_DEGRADED lease with all requested capabilities granted full and NONE omitted fails semantic validation
  const invalidDegradedFullHandshake = JSON.parse(JSON.stringify(sample));
  invalidDegradedFullHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  invalidDegradedFullHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  invalidDegradedFullHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: true,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  invalidDegradedFullHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];

  assert.throws(() => {
    validatePlatformSemantics(invalidDegradedFullHandshake, pcnSchemaId);
  }, /Semantic error: ACTIVE_DEGRADED lease must contain at least one GRANTED_DEGRADED capability with non-NONE fallback or omit a capability with required_for_optimal: true/);

  // 5. Positive: ACTIVE_OPTIMAL lease omitting a capability with required_for_optimal: false passes
  const validOptimalOmissionNonOptHandshake = JSON.parse(JSON.stringify(sample));
  validOptimalOmissionNonOptHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  validOptimalOmissionNonOptHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  validOptimalOmissionNonOptHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: true,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
    {
      capability_name: 'cache_cluster_replication',
      slot_id: 'cache',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  validOptimalOmissionNonOptHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];

  const validOptNonOptSchema = ajv.validate(pcnSchemaId, validOptimalOmissionNonOptHandshake);
  assert.ok(validOptNonOptSchema, `ACTIVE_OPTIMAL lease omitting required_for_optimal: false capability must pass schema: ${ajv.errorsText()}`);
  assert.doesNotThrow(() => {
    validatePlatformSemantics(validOptimalOmissionNonOptHandshake, pcnSchemaId);
  }, 'ACTIVE_OPTIMAL lease omitting required_for_optimal: false capability must pass platform semantics');
});

test('unit regression: adversarial Proxy variations and branch coverage for hasOversizedDeclaredLength and hasOwnAccessors (OPEN-2)', () => {
  const payload = Buffer.from('TEST_BRANCH_COVERAGE');
  const validSha = computePayloadSha256(payload);

  // 1. Root proxy with hidden BigInt content_length: 5368709121n
  const hiddenBigIntProxy = new Proxy({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 5368709121n,
  }, {
    ownKeys() { return ['payloadBytes', 'x-amz-content-sha256']; },
    getOwnPropertyDescriptor() { return undefined; },
    get(target, prop) { return target[prop]; },
  });
  assert.equal(dispatchS3PutObject(hiddenBigIntProxy).http_status, 400);
  assert.equal(dispatchS3Error(hiddenBigIntProxy).http_status, 400);

  // 2. Root proxy with hidden string content_length: '5368709121'
  const hiddenStrProxy = new Proxy({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: '5368709121',
  }, {
    ownKeys() { return ['payloadBytes', 'x-amz-content-sha256']; },
    getOwnPropertyDescriptor() { return undefined; },
    get(target, prop) { return target[prop]; },
  });
  assert.equal(dispatchS3PutObject(hiddenStrProxy).http_status, 400);
  assert.equal(dispatchS3Error(hiddenStrProxy).http_status, 400);

  // 3. Headers proxy with hidden BigInt content-length: 5368709121n
  const hiddenHeaderBigIntProxy = {
    payloadBytes: payload,
    headers: new Proxy({
      'content-length': 5368709121n,
    }, {
      ownKeys() { return []; },
      getOwnPropertyDescriptor() { return undefined; },
      get(target, prop) { return target[prop]; },
    }),
  };
  assert.equal(dispatchS3PutObject(hiddenHeaderBigIntProxy).http_status, 400);
  assert.equal(dispatchS3Error(hiddenHeaderBigIntProxy).http_status, 400);

  // 4. Headers proxy with hidden string content-length: '5368709121'
  const hiddenHeaderStrProxy = {
    payloadBytes: payload,
    headers: new Proxy({
      'content-length': '5368709121',
    }, {
      ownKeys() { return []; },
      getOwnPropertyDescriptor() { return undefined; },
      get(target, prop) { return target[prop]; },
    }),
  };
  assert.equal(dispatchS3PutObject(hiddenHeaderStrProxy).http_status, 400);
  assert.equal(dispatchS3Error(hiddenHeaderStrProxy).http_status, 400);

  // 5. Proxy where getOwnPropertyDescriptor throws on probe keys in hasOwnAccessors
  const throwingDescProxy = new Proxy({}, {
    ownKeys() { return []; },
    getOwnPropertyDescriptor(t, prop) {
      if (prop === 'payload' || prop === 'payloadBytes') {
        throw new Error('descriptor error');
      }
      return undefined;
    },
  });
  assert.equal(hasOwnAccessors(throwingDescProxy), true);

  // 6. Object where property read throws in getOwn
  const throwingPropObj = {};
  Object.defineProperty(throwingPropObj, 'testProp', {
    configurable: true,
    enumerable: true,
    get() { throw new Error('getter throw'); },
  });
  assert.equal(getOwn(throwingPropObj, 'testProp'), undefined);

  // 7. Object where hasOwnAccessors receives primitive or buffer
  assert.equal(hasOwnAccessors(null), false);
  assert.equal(hasOwnAccessors(123), false);
  assert.equal(hasOwnAccessors(Buffer.from('test')), false);
  assert.equal(hasOwnAccessors(new Uint8Array([1, 2, 3])), false);

  // 8. Proxy where getPrototypeOf throws
  const throwingProtoProxy = new Proxy({}, {
    getPrototypeOf() { throw new Error('proto trap throw'); },
  });
  assert.equal(isPlainOrNull(throwingProtoProxy), false);
  assert.equal(hasPrototypeChainAccessor(throwingProtoProxy, 'payload'), true);

  // 9. Proxy where getOwnPropertyDescriptor throws on probe key in hasOwnAccessors
  const throwingHasOwnProxy = new Proxy({}, {
    ownKeys() { return []; },
    getOwnPropertyDescriptor(target, prop) {
      throw new Error('descriptor throw on probe');
    },
  });
  assert.equal(hasOwnAccessors(throwingHasOwnProxy), true);

  // 10. Object with accessor on S3 probe key
  const probeAccessorObj = {};
  Object.defineProperty(probeAccessorObj, 'payload', {
    configurable: true,
    enumerable: false,
    get() { return Buffer.from('x'); },
  });
  assert.equal(hasOwnAccessors(probeAccessorObj), true);

  // 11. Proxy with value descriptor returns undefined under proxy fail-closed in getOwn
  const throwingGetTrapProxy = new Proxy({ val: 123 }, {
    getOwnPropertyDescriptor(target, prop) {
      return { value: 123, writable: true, enumerable: true, configurable: true };
    },
    get(target, prop) {
      throw new Error('get trap throw in getOwn');
    },
  });
  assert.equal(getOwn(throwingGetTrapProxy, 'val'), undefined);

  // 12. validateIJson on malformed JSON string token
  assert.throws(() => validateIJson('{ invalid }', 'test'), /Expected/);
});

test('comprehensive branch coverage for S3 multipart manifest and accessor safety', () => {
  // 1. throwing descriptor in obj length keys and headers
  assert.equal(hasOversizedDeclaredLength(new Proxy({}, {
    getOwnPropertyDescriptor(t, p) {
      if (p === 'content_length') throw new Error('trap');
      return undefined;
    }
  })), false);

  assert.equal(hasOversizedDeclaredLength({
    headers: new Proxy({}, {
      getOwnPropertyDescriptor(t, p) {
        if (p === 'Content-Length') throw new Error('hdr trap');
        return undefined;
      }
    })
  }), false);

  // 2. hasOwnAccessors with accessor on probe keys
  const probeAcc = {};
  Object.defineProperty(probeAcc, 'Content-Length', { get() { return 100; }, configurable: true, enumerable: false });
  assert.equal(hasOwnAccessors(probeAcc), true);

  // 3. dispatchS3CompleteMultipartUpload options object with manifest accessor
  const optWithManifestGetter = {};
  Object.defineProperty(optWithManifestGetter, 'manifest', { get() { return {}; }, configurable: true, enumerable: true });
  assert.equal(dispatchS3CompleteMultipartUpload(optWithManifestGetter).error_code, 'InvalidPart');

  // 4. dispatchS3CompleteMultipartUpload options object with storedParts accessor
  const optWithStoredPartsGetter = { manifest: { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] } };
  Object.defineProperty(optWithStoredPartsGetter, 'storedParts', { get() { return []; }, configurable: true, enumerable: true });
  assert.equal(dispatchS3CompleteMultipartUpload(optWithStoredPartsGetter).error_code, 'InvalidPart');

  // 5. dispatchS3CompleteMultipartUpload options object with inherited storedParts
  const optWithInheritedStoredParts = Object.create({ storedParts: [] });
  optWithInheritedStoredParts.manifest = { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] };
  assert.equal(dispatchS3CompleteMultipartUpload(optWithInheritedStoredParts).error_code, 'InvalidPart');

  // 6. dispatchS3CompleteMultipartUpload manifest with total_parts accessor or non-integer
  const mfWithTpGetter = { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] };
  Object.defineProperty(mfWithTpGetter, 'total_parts', { get() { return 1; }, configurable: true, enumerable: true });
  assert.equal(dispatchS3CompleteMultipartUpload(mfWithTpGetter).error_code, 'InvalidPart');

  const mfWithTpNonInt = { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }], total_parts: 1.5 };
  assert.equal(dispatchS3CompleteMultipartUpload(mfWithTpNonInt).error_code, 'InvalidPart');

  // 7. dispatchS3CompleteMultipartUpload throwing manifest.parts getter
  const mfThrowingParts = {};
  Object.defineProperty(mfThrowingParts, 'parts', { get() { throw new Error('parts trap'); }, configurable: true, enumerable: true });
  assert.equal(dispatchS3CompleteMultipartUpload(mfThrowingParts).error_code, 'InvalidPart');

  // 8. dispatchS3CompleteMultipartUpload non-object / primitive manifest in options wrapper
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: 'string-not-object' }).error_code, 'InvalidPart');
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: [1, 2, 3] }).error_code, 'InvalidPart');

  // 9. dispatchS3CompleteMultipartUpload where part has throwing prototype
  const partThrowingProto = new Proxy({ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }, {
    getPrototypeOf() { throw new Error('proto trap'); }
  });
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [partThrowingProto] }, [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 100 }]).error_code, 'InvalidPart');

  // 10. dispatchS3CompleteMultipartUpload where part has part_number or etag inherited from prototype
  const protoPart = { part_number: 1 };
  const childPart = Object.create(protoPart);
  childPart.etag = '"0123456789abcdef0123456789abcdef"';
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [childPart] }).error_code, 'InvalidPart');

  const protoPart2 = { etag: '"0123456789abcdef0123456789abcdef"' };
  const childPart2 = Object.create(protoPart2);
  childPart2.part_number = 1;
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [childPart2] }).error_code, 'InvalidPart');

  // 11. validateS3MultipartSemantics throwing parts getter
  const semThrowingParts = {};
  Object.defineProperty(semThrowingParts, 'parts', { get() { throw new Error('trap'); }, configurable: true, enumerable: true });
  assert.throws(() => validateS3MultipartSemantics(semThrowingParts), /InvalidPart/);

  // 12. validateS3MultipartSemantics part with throwing prototype
  assert.throws(() => validateS3MultipartSemantics({ parts: [partThrowingProto] }), /InvalidPart/);

  // 13. dispatchS3PutObject with structured non-byte types: symbol, RegExp, Map, Set, ArrayBuffer
  assert.equal(dispatchS3PutObject(Symbol('test')).error_code, 'InvalidDigest');
  assert.equal(dispatchS3PutObject(/regex/).error_code, 'InvalidDigest');
  assert.equal(dispatchS3PutObject(new Map()).error_code, 'InvalidDigest');
  assert.equal(dispatchS3PutObject(new Set()).error_code, 'InvalidDigest');
  assert.equal(dispatchS3PutObject(new ArrayBuffer(16)).error_code, 'InvalidDigest');

  // 14. dispatchS3CompleteMultipartUpload direct primitive or array manifest
  assert.equal(dispatchS3CompleteMultipartUpload(null).error_code, 'InvalidPart');
  assert.equal(dispatchS3CompleteMultipartUpload('str').error_code, 'InvalidPart');
  assert.equal(dispatchS3CompleteMultipartUpload(123).error_code, 'InvalidPart');
  assert.equal(dispatchS3CompleteMultipartUpload(true).error_code, 'InvalidPart');
  assert.equal(dispatchS3CompleteMultipartUpload(Symbol('m')).error_code, 'InvalidPart');
  assert.equal(dispatchS3CompleteMultipartUpload(100n).error_code, 'InvalidPart');
  assert.equal(dispatchS3CompleteMultipartUpload(() => {}).error_code, 'InvalidPart');
  assert.equal(dispatchS3CompleteMultipartUpload([]).error_code, 'InvalidPart');

  const throwingWrapper = new Proxy({}, { getPrototypeOf() { throw new Error('wrap trap'); } });
  assert.equal(dispatchS3CompleteMultipartUpload(throwingWrapper).error_code, 'InvalidPart');

  // 15. dispatchS3CompleteMultipartUpload parts with manifestPartsDesc having accessor
  const mfWithPartsDescGetter = {};
  Object.defineProperty(mfWithPartsDescGetter, 'parts', { get() { return []; }, configurable: true, enumerable: true });
  assert.equal(dispatchS3CompleteMultipartUpload(mfWithPartsDescGetter).error_code, 'InvalidPart');

  // 16. dispatchS3CompleteMultipartUpload missing storedParts
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] }, null).error_code, 'InvalidPart');

  // 17. Time-varying Proxy / getter returning array on first read, mutating / undefined on second read
  let readCount = 0;
  const timeVaryingManifest = {
    get parts() {
      readCount++;
      return readCount === 1 ? [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] : undefined;
    }
  };
  assert.equal(dispatchS3CompleteMultipartUpload(timeVaryingManifest).error_code, 'InvalidPart');
  assert.throws(() => validateS3MultipartSemantics(timeVaryingManifest), /InvalidPart/);

  // 18. Time-varying Proxy that returns different array reference on each get
  const mutatingProxyManifest = new Proxy({}, {
    get(target, prop) {
      if (prop === 'parts') {
        return [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }];
      }
      return target[prop];
    },
    has(target, prop) {
      return prop === 'parts' || prop in target;
    },
    ownKeys() {
      return ['parts'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'parts') {
        return { configurable: true, enumerable: true, value: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] };
      }
      return Object.getOwnPropertyDescriptor(target, prop);
    }
  });
  assert.equal(dispatchS3CompleteMultipartUpload(mutatingProxyManifest).error_code, 'InvalidPart');
  assert.throws(() => validateS3MultipartSemantics(mutatingProxyManifest), /InvalidPart/);

  // 19. Sparse array for manifest.parts (array hole)
  const sparseParts = new Array(2);
  sparseParts[1] = { part_number: 2, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 };
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: sparseParts }).error_code, 'InvalidPart');
  assert.throws(() => validateS3MultipartSemantics({ parts: sparseParts }), /InvalidPart/);

  // 20. Parts array with custom prototype
  const customProtoParts = Object.create({});
  Object.assign(customProtoParts, [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }]);
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: customProtoParts }).error_code, 'InvalidPart');
  assert.throws(() => validateS3MultipartSemantics({ parts: customProtoParts }), /InvalidPart/);

  // 21. Part throwing on index access in Proxy parts array
  const throwingIndexParts = new Proxy([{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }], {
    get(target, prop) {
      if (prop === '0') throw new Error('index 0 trap');
      return target[prop];
    }
  });
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: throwingIndexParts }).error_code, 'InvalidPart');
  assert.throws(() => validateS3MultipartSemantics({ parts: throwingIndexParts }), /InvalidPart/);

  // 22. Part with headers getter
  const partWithHeadersGetter = {
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880,
    get headers() { return {}; }
  };
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [partWithHeadersGetter] }).error_code, 'InvalidPart');
  assert.throws(() => validateS3MultipartSemantics({ parts: [partWithHeadersGetter] }), /InvalidPart/);

  // 23. Stored part with headers getter
  const storedWithHeadersGetter = new Map([[1, partWithHeadersGetter]]);
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, storedWithHeadersGetter).error_code, 'InvalidPart');

  // 24. Stored parts object with headers getter
  const storedObjWithHeadersGetter = {
    get headers() { return {}; },
    1: { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }
  };
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, storedObjWithHeadersGetter).error_code, 'InvalidPart');
});

test('unit regression: direct length reads are authoritative and fail closed on descriptor/value divergence (OPEN-2)', () => {
  const payload = Buffer.from('AUTHORITATIVE_DIRECT_LENGTH_TEST');
  const validSha = computePayloadSha256(payload);

  const lengthKeys = [
    'content_length',
    'contentLength',
    'content_length_bytes',
    'size_bytes',
    'size',
    'Content-Length',
    'content-length',
  ];

  // 1. All 7 candidate length keys on root object return EntityTooLarge when > 5 GiB
  for (const key of lengthKeys) {
    // Direct value Number
    const numObj = { payloadBytes: payload, 'x-amz-content-sha256': validSha, [key]: 5368709121 };
    assert.equal(hasOversizedDeclaredLength(numObj), true);
    assert.equal(dispatchS3PutObject(numObj).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
    assert.equal(dispatchS3Error(numObj).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

    // Direct value BigInt
    const bigIntObj = { payloadBytes: payload, 'x-amz-content-sha256': validSha, [key]: 5368709121n };
    assert.equal(hasOversizedDeclaredLength(bigIntObj), true);
    assert.equal(dispatchS3PutObject(bigIntObj).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
    assert.equal(dispatchS3Error(bigIntObj).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

    // Direct value String
    const strObj = { payloadBytes: payload, 'x-amz-content-sha256': validSha, [key]: '5368709121' };
    assert.equal(hasOversizedDeclaredLength(strObj), true);
    assert.equal(dispatchS3PutObject(strObj).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
    assert.equal(dispatchS3Error(strObj).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

    // Exact boundary (5368709120) is NOT oversized
    const exactObj = { payloadBytes: payload, 'x-amz-content-sha256': validSha, [key]: 5368709120 };
    assert.equal(hasOversizedDeclaredLength(exactObj), false);
    assert.equal(dispatchS3PutObject(exactObj).http_status, 200);

    // Direct value on nested headers
    const hdrObj = { payloadBytes: payload, 'x-amz-content-sha256': validSha, headers: { [key]: 5368709121 } };
    assert.equal(hasOversizedDeclaredLength(hdrObj), true);
    assert.equal(dispatchS3PutObject(hdrObj).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
    assert.equal(dispatchS3Error(hdrObj).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

    // Direct value via headersObj argument
    const directHdrObj = { [key]: 5368709121 };
    assert.equal(hasOversizedDeclaredLength(payload, directHdrObj), true);
  }

  // 2. Adversarial Proxy: Descriptor says 0 (or small), but direct-read returns > 5 GiB
  for (const key of lengthKeys) {
    const spoofSmallDescProxy = new Proxy({
      payloadBytes: payload,
      'x-amz-content-sha256': validSha,
      [key]: 6000000000,
    }, {
      getOwnPropertyDescriptor(t, p) {
        if (p === key) {
          return { value: 0, writable: true, enumerable: true, configurable: true };
        }
        return Reflect.getOwnPropertyDescriptor(t, p);
      },
      get(t, p) {
        if (p === key) return 6000000000;
        return Reflect.get(t, p);
      },
    });
    assert.equal(hasOversizedDeclaredLength(spoofSmallDescProxy), true, `Direct-read must be authoritative for ${key} over small descriptor`);
    assert.equal(dispatchS3PutObject(spoofSmallDescProxy).reason, 'MALFORMED_PAYLOAD_TYPE');
    assert.equal(dispatchS3Error(spoofSmallDescProxy).reason, 'MALFORMED_PAYLOAD_TYPE');
  }

  // 3. Adversarial Proxy: Descriptor says > 5 GiB, but direct-read returns 0
  for (const key of lengthKeys) {
    const spoofLargeDescProxy = new Proxy({
      payloadBytes: payload,
      'x-amz-content-sha256': validSha,
      [key]: 0,
    }, {
      getOwnPropertyDescriptor(t, p) {
        if (p === key) {
          return { value: 6000000000, writable: true, enumerable: true, configurable: true };
        }
        return Reflect.getOwnPropertyDescriptor(t, p);
      },
      get(t, p) {
        if (p === key) return 0;
        return Reflect.get(t, p);
      },
    });
    assert.equal(hasOversizedDeclaredLength(spoofLargeDescProxy), true, `Descriptor with > 5 GiB must fail closed for ${key}`);
    assert.equal(dispatchS3PutObject(spoofLargeDescProxy).reason, 'MALFORMED_PAYLOAD_TYPE');
    assert.equal(dispatchS3Error(spoofLargeDescProxy).reason, 'MALFORMED_PAYLOAD_TYPE');
  }

  // 4. Nested headers adversarial Proxy: Descriptor says 0, but direct-read returns > 5 GiB
  for (const key of lengthKeys) {
    const nestedHdrProxy = {
      payloadBytes: payload,
      'x-amz-content-sha256': validSha,
      headers: new Proxy({
        [key]: 6000000000,
      }, {
        getOwnPropertyDescriptor(t, p) {
          if (p === key) {
            return { value: 0, writable: true, enumerable: true, configurable: true };
          }
          return Reflect.getOwnPropertyDescriptor(t, p);
        },
        get(t, p) {
          if (p === key) return 6000000000;
          return Reflect.get(t, p);
        },
      }),
    };
    assert.equal(hasOversizedDeclaredLength(nestedHdrProxy), true, `Direct read on nested headers must be authoritative for ${key}`);
    assert.equal(dispatchS3PutObject(nestedHdrProxy).reason, 'MALFORMED_HEADER_SYNTAX');
    assert.equal(dispatchS3Error(nestedHdrProxy).reason, 'MALFORMED_HEADER_SYNTAX');
  }

  // 5. Accessor-backed length returning > 5 GiB does NOT trigger hasOversizedDeclaredLength and fails closed to MALFORMED_PAYLOAD_TYPE
  for (const key of lengthKeys) {
    let getterInvoked = false;
    const getterObj = {
      payloadBytes: payload,
      'x-amz-content-sha256': validSha,
    };
    Object.defineProperty(getterObj, key, {
      get() {
        getterInvoked = true;
        return 6000000000;
      },
      enumerable: true,
      configurable: true,
    });
    assert.equal(hasOversizedDeclaredLength(getterObj), false, `Accessor on ${key} must not be treated as declared length`);
    assert.equal(getterInvoked, false, `hasOversizedDeclaredLength must not invoke getter for ${key}`);

    const putRes = dispatchS3PutObject(getterObj);
    assert.equal(putRes.http_status, 400);
    assert.equal(putRes.error_code, 'InvalidDigest');
    assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');
    assert.equal(getterInvoked, false, `dispatchS3PutObject must not invoke getter for ${key}`);

    const errRes = dispatchS3Error(getterObj);
    assert.equal(errRes.http_status, 400);
    assert.equal(errRes.error_code, 'InvalidDigest');
    assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');
    assert.equal(getterInvoked, false, `dispatchS3Error must not invoke getter for ${key}`);

  }
});

test('adversarial regression: Proxy with direct content_length: 5368709121 and conflicting small descriptor returns HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE) under proxy fail-closed gating (OPEN-2)', () => {
  const payload = Buffer.from('TEST_CONFLICTING_DESCRIPTOR_PAYLOAD');
  const validSha = computePayloadSha256(payload);

  // 1. Root option Proxy where getOwnPropertyDescriptor returns small value (100) but get / direct property returns 5368709121
  const conflictingLengthPutProxy = new Proxy({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 5368709121,
  }, {
    ownKeys() {
      return ['payloadBytes', 'x-amz-content-sha256', 'content_length'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'content_length') {
        return { value: 100, configurable: true, enumerable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      if (prop === 'content_length') {
        return 5368709121;
      }
      return Reflect.get(target, prop);
    },
  });

  assert.equal(hasOversizedDeclaredLength(conflictingLengthPutProxy), true);
  const putRes = dispatchS3PutObject(conflictingLengthPutProxy);
  assert.equal(putRes.http_status, 400);
  assert.equal(putRes.error_code, 'InvalidDigest');
  assert.equal(putRes.code, 'InvalidDigest');
  assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Error option Proxy where getOwnPropertyDescriptor returns small value but direct property returns 5368709121
  const conflictingLengthErrProxy = new Proxy({
    payloadBytes: payload,
    content_length: 5368709121,
  }, {
    ownKeys() {
      return ['payloadBytes', 'content_length'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'content_length') {
        return { value: 100, configurable: true, enumerable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      if (prop === 'content_length') {
        return 5368709121;
      }
      return Reflect.get(target, prop);
    },
  });

  assert.equal(hasOversizedDeclaredLength(conflictingLengthErrProxy), true);
  const errRes = dispatchS3Error(conflictingLengthErrProxy);
  assert.equal(errRes.http_status, 400);
  assert.equal(errRes.error_code, 'InvalidDigest');
  assert.equal(errRes.code, 'InvalidDigest');
  assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3. Headers Proxy where getOwnPropertyDescriptor returns small value ('100') but get returns '5368709121'
  const conflictingHeaderProxy = {
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    headers: new Proxy({
      'content-length': '5368709121',
    }, {
      ownKeys() {
        return ['content-length'];
      },
      getOwnPropertyDescriptor(target, prop) {
        if (prop === 'content-length' || prop === 'Content-Length') {
          return { value: '100', configurable: true, enumerable: true, writable: true };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
      get(target, prop) {
        if (prop === 'content-length' || prop === 'Content-Length') {
          return '5368709121';
        }
        return Reflect.get(target, prop);
      },
    }),
  };

  assert.equal(hasOversizedDeclaredLength(conflictingHeaderProxy), true);
  const putHeaderRes = dispatchS3PutObject(conflictingHeaderProxy);
  assert.equal(putHeaderRes.http_status, 400);
  assert.equal(putHeaderRes.error_code, 'InvalidDigest');
  assert.equal(putHeaderRes.reason, 'MALFORMED_HEADER_SYNTAX');

  const errHeaderRes = dispatchS3Error(conflictingHeaderProxy);
  assert.equal(errHeaderRes.http_status, 400);
  assert.equal(errHeaderRes.error_code, 'InvalidDigest');
  assert.equal(errHeaderRes.reason, 'MALFORMED_HEADER_SYNTAX');

  // 4. BigInt and string variations
  const conflictingBigIntProxy = new Proxy({
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: 5368709121n,
  }, {
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'content_length') {
        return { value: 100n, configurable: true, enumerable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      if (prop === 'content_length') {
        return 5368709121n;
      }
      return Reflect.get(target, prop);
    },
  });
  assert.equal(hasOversizedDeclaredLength(conflictingBigIntProxy), true);
  assert.equal(dispatchS3PutObject(conflictingBigIntProxy).http_status, 400);
  assert.equal(dispatchS3PutObject(conflictingBigIntProxy).reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(dispatchS3Error(conflictingBigIntProxy).http_status, 400);
  assert.equal(dispatchS3Error(conflictingBigIntProxy).reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('adversarial regression: time-varying Proxy for parts returning valid array initially then undefined or hiding from ownKeys returns HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE) (OPEN-2)', () => {
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  // 1. Time-varying parts property on manifest wrapper: returns valid array on first read, then undefined
  let readCount1 = 0;
  const timeVaryingPartsManifest = new Proxy({
    total_parts: 2,
    total_size_bytes: 10485760,
  }, {
    ownKeys() {
      return ['parts', 'total_parts', 'total_size_bytes'];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'parts') {
        return {
          value: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }, { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' }],
          configurable: true,
          enumerable: true,
          writable: true,
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      if (prop === 'parts') {
        readCount1++;
        if (readCount1 === 1) {
          return [
            { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
            { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
          ];
        }
        return undefined; // subsequent read returns undefined
      }
      return Reflect.get(target, prop);
    },
  });

  const res1 = dispatchS3CompleteMultipartUpload(timeVaryingPartsManifest, validStoredParts);
  assert.equal(res1.http_status, 400);
  assert.equal(res1.error_code, 'InvalidPart');
  assert.equal(res1.code, 'InvalidPart');
  assert.equal(res1.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // Also verify validateS3MultipartSemantics fails closed on time-varying parts
  let readCount1b = 0;
  const timeVaryingSemManifest = new Proxy({
    total_parts: 2,
    total_size_bytes: 10485760,
  }, {
    ownKeys() { return ['parts', 'total_parts', 'total_size_bytes']; },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'parts') {
        return {
          value: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }],
          configurable: true, enumerable: true, writable: true
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      if (prop === 'parts') {
        readCount1b++;
        if (readCount1b === 1) return [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880, sha256: 'a'.repeat(64) }];
        return undefined;
      }
      return Reflect.get(target, prop);
    }
  });
  assert.throws(() => validateS3MultipartSemantics(timeVaryingSemManifest), /InvalidPart/);

  // 2. Time-varying ownKeys: returns ['parts'] on initial call then hides 'parts' from ownKeys
  let ownKeysCallCount = 0;
  const timeVaryingOwnKeysManifest = new Proxy({
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"' },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  }, {
    ownKeys(target) {
      ownKeysCallCount++;
      if (ownKeysCallCount === 1) {
        return ['parts', 'total_parts', 'total_size_bytes'];
      }
      return ['total_parts', 'total_size_bytes'];
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    get(target, prop) {
      return Reflect.get(target, prop);
    },
  });

  const res2 = dispatchS3CompleteMultipartUpload(timeVaryingOwnKeysManifest, validStoredParts);
  assert.equal(res2.http_status, 400);
  assert.equal(res2.error_code, 'InvalidPart');
  assert.equal(res2.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 3. Options wrapper containing time-varying parts Proxy
  let readCount3 = 0;
  const timeVaryingOptions = {
    manifest: new Proxy({
      total_parts: 2,
    }, {
      ownKeys() { return ['parts', 'total_parts']; },
      getOwnPropertyDescriptor(target, prop) {
        if (prop === 'parts') {
          return { value: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }], configurable: true, enumerable: true, writable: true };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
      get(target, prop) {
        if (prop === 'parts') {
          readCount3++;
          if (readCount3 === 1) return [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }];
          return undefined;
        }
        return Reflect.get(target, prop);
      }
    }),
    storedParts: validStoredParts,
  };

  const res3 = dispatchS3CompleteMultipartUpload(timeVaryingOptions);
  assert.equal(res3.http_status, 400);
  assert.equal(res3.error_code, 'InvalidPart');
  assert.equal(res3.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
});

test('adversarial regression: malformed direct-array wrapper returning HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE) and parts: [] returning InvalidArgument (EmptyPartsList) (OPEN-2)', () => {
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
  ];

  // 1. Explicit, structurally valid plain object with parts: [] returns InvalidArgument (EmptyPartsList)
  const emptyPartsManifest = { parts: [] };
  const emptyRes1 = dispatchS3CompleteMultipartUpload(emptyPartsManifest, validStoredParts);
  assert.equal(emptyRes1.http_status, 400);
  assert.equal(emptyRes1.error_code, 'InvalidArgument');
  assert.equal(emptyRes1.code, 'InvalidArgument');
  assert.equal(emptyRes1.reason, 'EmptyPartsList');

  // Also in options wrapper
  const emptyOptions = {
    manifest: { parts: [] },
    storedParts: validStoredParts,
  };
  const emptyRes2 = dispatchS3CompleteMultipartUpload(emptyOptions);
  assert.equal(emptyRes2.http_status, 400);
  assert.equal(emptyRes2.error_code, 'InvalidArgument');
  assert.equal(emptyRes2.code, 'InvalidArgument');
  assert.equal(emptyRes2.reason, 'EmptyPartsList');

  // validateS3MultipartSemantics on empty parts array throws parts array must be non-empty
  assert.throws(
    () => validateS3MultipartSemantics(emptyPartsManifest),
    /parts array must be non-empty/
  );

  // 2. Direct array wrapper [] returns InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE)
  const directArrayRes = dispatchS3CompleteMultipartUpload([], validStoredParts);
  assert.equal(directArrayRes.http_status, 400);
  assert.equal(directArrayRes.error_code, 'InvalidPart');
  assert.equal(directArrayRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 3. Malformed direct-array wrapper with throwing prototype or traps returns InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE)
  const malformedArrayProxy = new Proxy([1, 2, 3], {
    getPrototypeOf() {
      throw new Error('array prototype trap throw');
    },
  });
  const malformedArrRes1 = dispatchS3CompleteMultipartUpload(malformedArrayProxy, validStoredParts);
  assert.equal(malformedArrRes1.http_status, 400);
  assert.equal(malformedArrRes1.error_code, 'InvalidPart');
  assert.equal(malformedArrRes1.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // Malformed array in options wrapper
  const malformedArrOptions = {
    manifest: malformedArrayProxy,
    storedParts: validStoredParts,
  };
  const malformedArrRes2 = dispatchS3CompleteMultipartUpload(malformedArrOptions);
  assert.equal(malformedArrRes2.http_status, 400);
  assert.equal(malformedArrRes2.error_code, 'InvalidPart');
  assert.equal(malformedArrRes2.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 4. Manifest object with malformed / non-array parts returns InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE)
  const nonArrayPartsManifests = [
    { parts: 'not-an-array' },
    { parts: 12345 },
    { parts: true },
    { parts: { 0: { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' } } },
  ];
  for (const badMf of nonArrayPartsManifests) {
    const badRes = dispatchS3CompleteMultipartUpload(badMf, validStoredParts);
    assert.equal(badRes.http_status, 400);
    assert.equal(badRes.error_code, 'InvalidPart');
    assert.equal(badRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  }
});

test('regression: verify OPEN-5 specification prose and schema consistency without bijection errors (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  assert.ok(existsSync(samplePath), `Sample capability handshake missing: ${samplePath}`);
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. Specification prose verification:
  const specPath = join(ROOT, 'contracts/platform/CYBRIK-PROVIDER-CAPABILITY-NEGOTIATION-V1-SPECIFICATION.md');
  assert.ok(existsSync(specPath), `Spec markdown missing: ${specPath}`);
  const specText = readFileSync(specPath, 'utf8');

  assert.ok(specText.includes('Strict Status-Pair Coupling'), 'Spec must define strict status-pair coupling');
  assert.ok(specText.includes('required_for_optimal'), 'Spec must define required_for_optimal semantics');
  assert.ok(specText.includes('composite identity `(capability_name, slot_id)`'), 'Spec must define composite key uniqueness');
  assert.ok(specText.includes('Strict Biconditional Disposition/Fallback Coupling'), 'Spec must define biconditional coupling');

  // 2. Exact 1-to-1 bijection when all requested capabilities are resolved in lease
  const bijectionHandshake = JSON.parse(JSON.stringify(sample));
  bijectionHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  bijectionHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  bijectionHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: true,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: true,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
    {
      capability_name: 'cache_cluster_replication',
      slot_id: 'cache',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  bijectionHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_gpu_acceleration',
      fallback_applied: 'NONE',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
    {
      capability_name: 'cache_cluster_replication',
      slot_id: 'cache',
      disposition: 'GRANTED_FULL',
      active_mode: 'cluster_redis',
      fallback_applied: 'NONE',
    },
  ];

  assert.ok(ajv.validate(pcnSchemaId, bijectionHandshake), `Exact bijection handshake must validate: ${ajv.errorsText()}`);
  assert.doesNotThrow(() => validatePlatformSemantics(bijectionHandshake, pcnSchemaId));

  // 3. Valid subset: omitting required_for_optimal: false capability in ACTIVE_OPTIMAL does not throw bijection error
  const nonOptOmissionHandshake = JSON.parse(JSON.stringify(bijectionHandshake));
  nonOptOmissionHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_gpu_acceleration',
      fallback_applied: 'NONE',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];
  assert.ok(ajv.validate(pcnSchemaId, nonOptOmissionHandshake));
  assert.doesNotThrow(() => validatePlatformSemantics(nonOptOmissionHandshake, pcnSchemaId));

  // 4. Valid degraded-by-omission: omitting required_for_optimal: true in ACTIVE_DEGRADED does not throw bijection error
  const degradedOmissionHandshake = JSON.parse(JSON.stringify(sample));
  degradedOmissionHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  degradedOmissionHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  degradedOmissionHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: true,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: true,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  degradedOmissionHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];
  assert.ok(ajv.validate(pcnSchemaId, degradedOmissionHandshake));
  assert.doesNotThrow(() => validatePlatformSemantics(degradedOmissionHandshake, pcnSchemaId));

  // 5. Negative: surplus / unrequested capability in lease throws semantic error
  const surplusHandshake = JSON.parse(JSON.stringify(bijectionHandshake));
  surplusHandshake.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: 'unrequested_feature',
    slot_id: 'cache',
    disposition: 'GRANTED_FULL',
    active_mode: 'native_cache',
    fallback_applied: 'NONE',
  });
  assert.throws(
    () => validatePlatformSemantics(surplusHandshake, pcnSchemaId),
    /unrequested or surplus optional capability 'unrequested_feature'/
  );

  // 6. Negative: duplicate composite keys in requested_optional_capabilities throws semantic error
  const dupReqKeyHandshake = JSON.parse(JSON.stringify(bijectionHandshake));
  dupReqKeyHandshake.negotiation_request.requested_optional_capabilities.push({
    capability_name: 'ai_tensor_acceleration',
    slot_id: 'ai_model_runtime',
    required_for_optimal: true,
    preferred_fallback: 'CORE_EMULATION_FALLBACK',
  });
  assert.throws(
    () => validatePlatformSemantics(dupReqKeyHandshake, pcnSchemaId),
    /requested_optional_capabilities contains duplicate composite key/
  );

  // 7. Negative: duplicate composite keys in negotiated_optional_capabilities throws semantic error
  const dupLeaseKeyHandshake = JSON.parse(JSON.stringify(bijectionHandshake));
  dupLeaseKeyHandshake.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: 'ai_tensor_acceleration',
    slot_id: 'ai_model_runtime',
    disposition: 'GRANTED_FULL',
    active_mode: 'native_gpu_acceleration',
    fallback_applied: 'NONE',
  });
  assert.throws(
    () => validatePlatformSemantics(dupLeaseKeyHandshake, pcnSchemaId),
    /negotiated_optional_capabilities contains duplicate composite key/
  );
});

test('adversarial regressions for immutable-storage object-lock coupling and subset validation (OPEN-2 / OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  const onpremPath = join(ROOT, 'contracts/examples/platform/onprem-standard-v1.profile.json');
  const onpremDigest = createHash('sha256').update(readFileSync(onpremPath)).digest('hex');

  const privateCloudPath = join(ROOT, 'contracts/examples/platform/private-cloud-v1.profile.json');
  const privateCloudDigest = createHash('sha256').update(readFileSync(privateCloudPath)).digest('hex');

  // 1. Adversarial test: onprem-standard-v1 immutable profile lease with omitted storage_object_lock fails validation terminally
  const omittedLockHandshake = JSON.parse(JSON.stringify(sample));
  omittedLockHandshake.target_profile_id = 'onprem-standard-v1';
  omittedLockHandshake.target_profile_digest = onpremDigest;
  omittedLockHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  omittedLockHandshake.agreed_capability_lease.target_profile_id = 'onprem-standard-v1';
  omittedLockHandshake.agreed_capability_lease.target_profile_digest = onpremDigest;
  omittedLockHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  omittedLockHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: false,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
  ];
  omittedLockHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_gpu_acceleration',
      fallback_applied: 'NONE',
    },
  ];
  assert.throws(
    () => validatePlatformSemantics(omittedLockHandshake, pcnSchemaId),
    /immutable storage profile requires storage_object_lock capability in lease with GRANTED_FULL disposition|DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN.*omits or fails to grant 'storage_object_lock'/,
    'onprem-standard-v1 lease omitting storage_object_lock must fail validation terminally'
  );

  // 2. Adversarial test: onprem-standard-v1 immutable profile lease with degraded storage_object_lock fails validation terminally
  const degradedLockHandshake = JSON.parse(JSON.stringify(sample));
  degradedLockHandshake.target_profile_id = 'onprem-standard-v1';
  degradedLockHandshake.target_profile_digest = onpremDigest;
  degradedLockHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  degradedLockHandshake.agreed_capability_lease.target_profile_id = 'onprem-standard-v1';
  degradedLockHandshake.agreed_capability_lease.target_profile_digest = onpremDigest;
  degradedLockHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  degradedLockHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  degradedLockHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_DEGRADED',
      active_mode: 'emulated_retention',
      fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  assert.throws(
    () => validatePlatformSemantics(degradedLockHandshake, pcnSchemaId),
    /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
    'onprem-standard-v1 with degraded storage_object_lock must fail validation terminally'
  );

  // 3. Positive test: private-cloud-v1 (non-immutable) profile with omitted ai_tensor_acceleration (required_for_optimal: false) passes under ACTIVE_OPTIMAL
  const privateCloudOmissionHandshake = JSON.parse(JSON.stringify(sample));
  privateCloudOmissionHandshake.target_profile_id = 'private-cloud-v1';
  privateCloudOmissionHandshake.target_profile_digest = privateCloudDigest;
  if (privateCloudOmissionHandshake.advertisement_response) {
    privateCloudOmissionHandshake.advertisement_response.target_profile_digest = privateCloudDigest;
  }
  privateCloudOmissionHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  privateCloudOmissionHandshake.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  privateCloudOmissionHandshake.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  privateCloudOmissionHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  privateCloudOmissionHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: false,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
    {
      capability_name: 'cache_cluster_replication',
      slot_id: 'cache',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  privateCloudOmissionHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'cache_cluster_replication',
      slot_id: 'cache',
      disposition: 'GRANTED_FULL',
      active_mode: 'standalone_noeviction',
      fallback_applied: 'NONE',
    },
  ];
  assert.ok(ajv.validate(pcnSchemaId, privateCloudOmissionHandshake), 'private-cloud-v1 non-optimal omission must validate against schema: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(privateCloudOmissionHandshake, pcnSchemaId),
    'private-cloud-v1 (non-immutable) with omitted ai_tensor_acceleration (required_for_optimal: false) must pass under ACTIVE_OPTIMAL'
  );

  // 4. Positive test: onprem-standard-v1 with omitted ai_tensor_acceleration (required_for_optimal: false) but granted storage_object_lock passes under ACTIVE_OPTIMAL
  const onpremNonOptOmissionHandshake = JSON.parse(JSON.stringify(sample));
  onpremNonOptOmissionHandshake.target_profile_id = 'onprem-standard-v1';
  onpremNonOptOmissionHandshake.target_profile_digest = onpremDigest;
  if (onpremNonOptOmissionHandshake.advertisement_response) {
    onpremNonOptOmissionHandshake.advertisement_response.target_profile_digest = onpremDigest;
  }
  onpremNonOptOmissionHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  onpremNonOptOmissionHandshake.agreed_capability_lease.target_profile_id = 'onprem-standard-v1';
  onpremNonOptOmissionHandshake.agreed_capability_lease.target_profile_digest = onpremDigest;
  onpremNonOptOmissionHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  onpremNonOptOmissionHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: false,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  onpremNonOptOmissionHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];
  assert.ok(ajv.validate(pcnSchemaId, onpremNonOptOmissionHandshake), 'onprem-standard-v1 non-optimal omission must validate against schema: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(onpremNonOptOmissionHandshake, pcnSchemaId),
    'onprem-standard-v1 with omitted ai_tensor_acceleration (required_for_optimal: false) but granted storage_object_lock must pass under ACTIVE_OPTIMAL'
  );

  // 5. Adversarial test: onprem-standard-v1 with granted storage_object_lock but degraded secondary storage capability fails terminally
  const secondaryStorageDegradedHandshake = JSON.parse(JSON.stringify(sample));
  secondaryStorageDegradedHandshake.target_profile_id = 'onprem-standard-v1';
  secondaryStorageDegradedHandshake.target_profile_digest = onpremDigest;
  secondaryStorageDegradedHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  secondaryStorageDegradedHandshake.agreed_capability_lease.target_profile_id = 'onprem-standard-v1';
  secondaryStorageDegradedHandshake.agreed_capability_lease.target_profile_digest = onpremDigest;
  secondaryStorageDegradedHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  secondaryStorageDegradedHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
    {
      capability_name: 'storage_custom_perf',
      slot_id: 'storage',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  secondaryStorageDegradedHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
    {
      capability_name: 'storage_custom_perf',
      slot_id: 'storage',
      disposition: 'GRANTED_DEGRADED',
      active_mode: 'slow_emulated_storage',
      fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  assert.throws(
    () => validatePlatformSemantics(secondaryStorageDegradedHandshake, pcnSchemaId),
    /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
    'onprem-standard-v1 with degraded secondary storage capability must fail validation terminally'
  );

  // 6. Branch coverage: unslotted surplus optional capability in agreed_capability_lease
  const unslottedSurplusHandshake = JSON.parse(JSON.stringify(onpremNonOptOmissionHandshake));
  unslottedSurplusHandshake.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: 'unslotted_surplus_cap',
    disposition: 'GRANTED_FULL',
    fallback_applied: 'NONE',
  });
  assert.throws(
    () => validatePlatformSemantics(unslottedSurplusHandshake, pcnSchemaId),
    /agreed_capability_lease contains unrequested or surplus optional capability 'unslotted_surplus_cap'/
  );

  // 7. Branch coverage: unslotted missing required_for_optimal capability in ACTIVE_OPTIMAL lease
  const unslottedOptimalHandshake = JSON.parse(JSON.stringify(sample));
  unslottedOptimalHandshake.target_profile_id = 'private-cloud-v1';
  unslottedOptimalHandshake.target_profile_digest = privateCloudDigest;
  unslottedOptimalHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  unslottedOptimalHandshake.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  unslottedOptimalHandshake.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  unslottedOptimalHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  unslottedOptimalHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'unslotted_optimal_cap',
      required_for_optimal: true,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
  ];
  unslottedOptimalHandshake.agreed_capability_lease.negotiated_optional_capabilities = [];
  assert.throws(
    () => validatePlatformSemantics(unslottedOptimalHandshake, pcnSchemaId),
    /requested optional capability 'unslotted_optimal_cap' is required for optimal operation but is not resolved in agreed_capability_lease/
  );
});

test('adversarial regression: exact storage_object_lock identity and requirement across all immutable profiles (OPEN-2 / OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  if (!ajv.getSchema(pcnSchemaId)) {
    const pcnPath = join(JSON_SCHEMA_DIR, 'cybrik.provider-capability-negotiation.v1.schema.json');
    const pcnDoc = JSON.parse(readFileSync(pcnPath, 'utf8'));
    ajv.addSchema(pcnDoc, pcnDoc.$id);
  }
  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  const immutableProfileIds = [
    'onprem-standard-v1',
    'onprem-airgap-v1',
    'hybrid-sovereign-v1'
  ];

  for (const profileId of immutableProfileIds) {
    const profilePath = join(ROOT, 'contracts/examples/platform', `${profileId}.profile.json`);
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    // 1. Adversarial: Omission of storage_object_lock from lease fails validation terminally
    const omittedLockHandshake = JSON.parse(JSON.stringify(sample));
    omittedLockHandshake.target_profile_id = profileId;
    omittedLockHandshake.target_profile_digest = profileDigest;
    omittedLockHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
    omittedLockHandshake.agreed_capability_lease.target_profile_id = profileId;
    omittedLockHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
    omittedLockHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
    omittedLockHandshake.negotiation_request.requested_optional_capabilities = [
      {
        capability_name: 'ai_tensor_acceleration',
        slot_id: 'ai_model_runtime',
        required_for_optimal: false,
        preferred_fallback: 'CORE_EMULATION_FALLBACK',
      },
    ];
    omittedLockHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: 'ai_tensor_acceleration',
        slot_id: 'ai_model_runtime',
        disposition: 'GRANTED_FULL',
        active_mode: 'native_gpu_acceleration',
        fallback_applied: 'NONE',
      },
    ];
    assert.throws(
      () => validatePlatformSemantics(omittedLockHandshake, pcnSchemaId),
      /immutable storage profile requires storage_object_lock capability in lease with GRANTED_FULL disposition/,
      `Expected ${profileId} lease omitting storage_object_lock to fail validation terminally`
    );

    // 2. Adversarial: Degraded storage_object_lock (GRANTED_DEGRADED) fails validation terminally
    const degradedLockHandshake = JSON.parse(JSON.stringify(sample));
    degradedLockHandshake.target_profile_id = profileId;
    degradedLockHandshake.target_profile_digest = profileDigest;
    degradedLockHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
    degradedLockHandshake.agreed_capability_lease.target_profile_id = profileId;
    degradedLockHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
    degradedLockHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
    degradedLockHandshake.negotiation_request.requested_optional_capabilities = [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        required_for_optimal: false,
        preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
      },
    ];
    degradedLockHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        disposition: 'GRANTED_DEGRADED',
        active_mode: 'emulated_retention',
        fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
      },
    ];
    assert.throws(
      () => validatePlatformSemantics(degradedLockHandshake, pcnSchemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
      `Expected ${profileId} lease with degraded storage_object_lock to fail validation terminally`
    );

    // 3. Adversarial: GRANTED_FULL with non-NONE fallback on storage_object_lock fails
    const invalidFallbackLockHandshake = JSON.parse(JSON.stringify(sample));
    invalidFallbackLockHandshake.target_profile_id = profileId;
    invalidFallbackLockHandshake.target_profile_digest = profileDigest;
    invalidFallbackLockHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
    invalidFallbackLockHandshake.agreed_capability_lease.target_profile_id = profileId;
    invalidFallbackLockHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
    invalidFallbackLockHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
    invalidFallbackLockHandshake.negotiation_request.requested_optional_capabilities = [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        required_for_optimal: false,
        preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
      },
    ];
    invalidFallbackLockHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        disposition: 'GRANTED_FULL',
        active_mode: 'native_s3_object_lock',
        fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
      },
    ];
    assert.throws(
      () => validatePlatformSemantics(invalidFallbackLockHandshake, pcnSchemaId),
      /cannot have fallback 'FEATURE_DISABLED_GRACEFUL' \(must be 'NONE'\)|DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
      `Expected ${profileId} lease with GRANTED_FULL but non-NONE fallback on storage_object_lock to fail`
    );

    // 4. Adversarial: Renamed / pseudo-lock capability name substitution fails exact storage_object_lock requirement
    const pseudoLockNames = [
      'storage_custom_worm',
      's3_object_lock',
      'object_lock',
      'storage_retention_lock',
      'storage_object_retention'
    ];
    for (const pseudoName of pseudoLockNames) {
      const pseudoLockHandshake = JSON.parse(JSON.stringify(sample));
      pseudoLockHandshake.target_profile_id = profileId;
      pseudoLockHandshake.target_profile_digest = profileDigest;
      pseudoLockHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
      pseudoLockHandshake.agreed_capability_lease.target_profile_id = profileId;
      pseudoLockHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      pseudoLockHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
      pseudoLockHandshake.negotiation_request.requested_optional_capabilities = [
        {
          capability_name: pseudoName,
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'CORE_EMULATION_FALLBACK',
        },
      ];
      pseudoLockHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
        {
          capability_name: pseudoName,
          slot_id: 'storage',
          disposition: 'GRANTED_FULL',
          active_mode: 'native_retention',
          fallback_applied: 'NONE',
        },
      ];
      assert.throws(
        () => validatePlatformSemantics(pseudoLockHandshake, pcnSchemaId),
        /(?:DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN: immutable storage profile prohibits non-canonical storage capability aliases or surplus storage capabilities in request or lease|immutable storage profile requires storage_object_lock capability in lease with GRANTED_FULL disposition)/,
        `Expected ${profileId} with pseudo-lock '${pseudoName}' to fail exact storage_object_lock requirement`
      );
    }

    // 5. Positive: Exact storage_object_lock with GRANTED_FULL and NONE fallback passes
    const validLockHandshake = JSON.parse(JSON.stringify(sample));
    validLockHandshake.target_profile_id = profileId;
    validLockHandshake.target_profile_digest = profileDigest;
    if (validLockHandshake.advertisement_response) {
      validLockHandshake.advertisement_response.target_profile_digest = profileDigest;
    }
    validLockHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
    validLockHandshake.agreed_capability_lease.target_profile_id = profileId;
    validLockHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
    validLockHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
    validLockHandshake.negotiation_request.requested_optional_capabilities = [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        required_for_optimal: false,
        preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
      },
    ];
    validLockHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        disposition: 'GRANTED_FULL',
        active_mode: 'native_s3_object_lock',
        fallback_applied: 'NONE',
      },
    ];
    assert.ok(ajv.validate(pcnSchemaId, validLockHandshake), `${profileId} valid lock handshake must pass schema validation`);
    assert.doesNotThrow(
      () => validatePlatformSemantics(validLockHandshake, pcnSchemaId),
      `${profileId} valid lock handshake must pass validatePlatformSemantics`
    );
  }
});

test('adversarial regression: strict alias rejection across all immutable profiles (OPEN-2 / OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  if (!ajv.getSchema(pcnSchemaId)) {
    const pcnPath = join(JSON_SCHEMA_DIR, 'cybrik.provider-capability-negotiation.v1.schema.json');
    const pcnDoc = JSON.parse(readFileSync(pcnPath, 'utf8'));
    ajv.addSchema(pcnDoc, pcnDoc.$id);
  }
  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  const immutableProfileIds = [
    'onprem-standard-v1',
    'onprem-airgap-v1',
    'hybrid-sovereign-v1'
  ];

  const aliasUrns = [
    'urn:cybrik:evidence:storage:s3:conformance:v1:object_lock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:objectlock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:OBJECT-LOCK',
    'urn:aws:evidence:storage:s3:object-lock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock-v1',
    'urn:cybrik:evidence:storage:s3:conformance:v1:s3-object-lock'
  ];

  for (const profileId of immutableProfileIds) {
    const profilePath = join(ROOT, 'contracts/examples/platform', `${profileId}.profile.json`);
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    for (const aliasUrn of aliasUrns) {
      // 1. Alias URN in advertised_capabilities for storage slot
      const aliasStorageHandshake = JSON.parse(JSON.stringify(sample));
      aliasStorageHandshake.target_profile_id = profileId;
      aliasStorageHandshake.target_profile_digest = profileDigest;
      if (aliasStorageHandshake.advertisement_response) {
        aliasStorageHandshake.advertisement_response.target_profile_digest = profileDigest;
        const storeCap = aliasStorageHandshake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
        if (storeCap) {
          storeCap.evidence_references = [
            'urn:cybrik:evidence:storage:s3-19-ops:v1',
            aliasUrn
          ];
        }
        aliasStorageHandshake.advertisement_response.conformance_evidence.push({
          test_identifier: aliasUrn,
          status: 'PASS',
          evidence_pack_digest: 'a106060606060606060606060606060606060606060606060606060606060606',
          executed_at: '2026-08-27T12:00:00Z',
          report_uri: 'https://reports.cybrik.example/evidence/alias.json'
        });
      }
      assert.throws(
        () => validatePlatformSemantics(aliasStorageHandshake, pcnSchemaId),
        /Semantic error: (invalid storage_object_lock evidence URN .* must strictly match canonical URN 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' \(aliases strictly prohibited\)|storage slot advertisement lacks Object Lock retention evidence|storage_object_lock evidence URN must strictly equal 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock')/,
        `Expected ${profileId} to reject storage slot alias URN '${aliasUrn}'`
      );

      // 2. Alias URN in advertised_capabilities for storage_object_lock capability
      const aliasCapHandshake = JSON.parse(JSON.stringify(sample));
      aliasCapHandshake.target_profile_id = profileId;
      aliasCapHandshake.target_profile_digest = profileDigest;
      if (aliasCapHandshake.advertisement_response) {
        aliasCapHandshake.advertisement_response.target_profile_digest = profileDigest;
        const storeCap = aliasCapHandshake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
        if (storeCap) {
          storeCap.capability_name = 'storage_object_lock';
          storeCap.evidence_references = [aliasUrn];
        }
        aliasCapHandshake.advertisement_response.conformance_evidence.push({
          test_identifier: aliasUrn,
          status: 'PASS',
          evidence_pack_digest: 'a106060606060606060606060606060606060606060606060606060606060606',
          executed_at: '2026-08-27T12:00:00Z',
          report_uri: 'https://reports.cybrik.example/evidence/alias.json'
        });
      }
      assert.throws(
        () => validatePlatformSemantics(aliasCapHandshake, pcnSchemaId),
        /Semantic error: (storage_object_lock evidence URN must strictly equal 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'|invalid storage_object_lock evidence URN .* must strictly match canonical URN|storage slot advertisement lacks Object Lock retention evidence)/,
        `Expected ${profileId} to reject storage_object_lock advertised alias URN '${aliasUrn}'`
      );

      // 3. Alias URN in agreed_capability_lease for storage_object_lock capability
      const aliasLeaseHandshake = JSON.parse(JSON.stringify(sample));
      aliasLeaseHandshake.target_profile_id = profileId;
      aliasLeaseHandshake.target_profile_digest = profileDigest;
      if (aliasLeaseHandshake.advertisement_response) {
        aliasLeaseHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      aliasLeaseHandshake.agreed_capability_lease.target_profile_id = profileId;
      aliasLeaseHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      const leaseLock = aliasLeaseHandshake.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock');
      if (leaseLock) {
        leaseLock.evidence_references = [aliasUrn];
      }
      aliasLeaseHandshake.advertisement_response.conformance_evidence.push({
        test_identifier: aliasUrn,
        status: 'PASS',
        evidence_pack_digest: 'a106060606060606060606060606060606060606060606060606060606060606',
        executed_at: '2026-08-27T12:00:00Z',
        report_uri: 'https://reports.cybrik.example/evidence/alias.json'
      });
      assert.throws(
        () => validatePlatformSemantics(aliasLeaseHandshake, pcnSchemaId),
        /Semantic error: (storage_object_lock evidence URN must strictly equal 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'|invalid storage_object_lock evidence URN .* must strictly match canonical URN)/,
        `Expected ${profileId} to reject storage_object_lock lease alias URN '${aliasUrn}'`
      );
    }
  }
});

test('adversarial regression: capability lease subset matching and closure validation (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  if (!ajv.getSchema(pcnSchemaId)) {
    const pcnPath = join(JSON_SCHEMA_DIR, 'cybrik.provider-capability-negotiation.v1.schema.json');
    const pcnDoc = JSON.parse(readFileSync(pcnPath, 'utf8'));
    ajv.addSchema(pcnDoc, pcnDoc.$id);
  }
  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  const privateCloudPath = join(ROOT, 'contracts/examples/platform/private-cloud-v1.profile.json');
  const privateCloudDigest = createHash('sha256').update(readFileSync(privateCloudPath)).digest('hex');

  const onpremPath = join(ROOT, 'contracts/examples/platform/onprem-standard-v1.profile.json');
  const onpremDigest = createHash('sha256').update(readFileSync(onpremPath)).digest('hex');

  // 1. Positive: exact 1-to-1 cardinality match (lines 3825-3852 reference) passes
  const handshakeData = JSON.parse(readFileSync(samplePath, 'utf8'));
  const requested = handshakeData.negotiation_request?.requested_optional_capabilities || [];
  const leased = handshakeData.agreed_capability_lease?.negotiated_optional_capabilities || [];
  assert.equal(requested.length, leased.length, 'Exact cardinality match between requested and leased');
  const reqKeys = requested.map(r => `${r.capability_name}::${r.slot_id}`).sort();
  const leaseKeys = leased.map(l => `${l.capability_name}::${l.slot_id}`).sort();
  assert.deepEqual(reqKeys, leaseKeys, 'Exact 1-to-1 multiset equality on baseline handshake fixture');
  assert.doesNotThrow(() => validatePlatformSemantics(handshakeData, pcnSchemaId));

  // 2. Positive: valid strict subset lease omitting non-optimal capabilities under ACTIVE_OPTIMAL
  const subsetOptimalHandshake = JSON.parse(JSON.stringify(sample));
  subsetOptimalHandshake.target_profile_id = 'private-cloud-v1';
  subsetOptimalHandshake.target_profile_digest = privateCloudDigest;
  if (subsetOptimalHandshake.advertisement_response) {
    subsetOptimalHandshake.advertisement_response.target_profile_digest = privateCloudDigest;
  }
  subsetOptimalHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  subsetOptimalHandshake.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  subsetOptimalHandshake.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  subsetOptimalHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  // Request contains 3 optional capabilities:
  subsetOptimalHandshake.negotiation_request.requested_optional_capabilities = [
    { capability_name: 'ai_tensor_acceleration', slot_id: 'ai_model_runtime', required_for_optimal: false, preferred_fallback: 'CORE_EMULATION_FALLBACK' },
    { capability_name: 'storage_object_lock', slot_id: 'storage', required_for_optimal: false, preferred_fallback: 'FEATURE_DISABLED_GRACEFUL' },
    { capability_name: 'cache_cluster_replication', slot_id: 'cache', required_for_optimal: false, preferred_fallback: 'FEATURE_DISABLED_GRACEFUL' },
  ];
  // Lease is a proper subset with only 1 capability (omitted 2 non-optimal capabilities):
  subsetOptimalHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    { capability_name: 'storage_object_lock', slot_id: 'storage', disposition: 'GRANTED_FULL', active_mode: 'native_s3_object_lock', fallback_applied: 'NONE' },
  ];
  assert.ok(ajv.validate(pcnSchemaId, subsetOptimalHandshake), 'Subset optimal handshake must pass schema validation');
  assert.doesNotThrow(
    () => validatePlatformSemantics(subsetOptimalHandshake, pcnSchemaId),
    'Strict subset lease omitting required_for_optimal: false capabilities must pass under ACTIVE_OPTIMAL'
  );

  // 3. Positive: valid strict subset lease omitting required_for_optimal: true capability under ACTIVE_DEGRADED
  const subsetDegradedHandshake = JSON.parse(JSON.stringify(sample));
  subsetDegradedHandshake.target_profile_id = 'onprem-standard-v1';
  subsetDegradedHandshake.target_profile_digest = onpremDigest;
  if (subsetDegradedHandshake.advertisement_response) {
    subsetDegradedHandshake.advertisement_response.target_profile_digest = onpremDigest;
  }
  subsetDegradedHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  subsetDegradedHandshake.agreed_capability_lease.target_profile_id = 'onprem-standard-v1';
  subsetDegradedHandshake.agreed_capability_lease.target_profile_digest = onpremDigest;
  subsetDegradedHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  subsetDegradedHandshake.negotiation_request.requested_optional_capabilities = [
    { capability_name: 'ai_tensor_acceleration', slot_id: 'ai_model_runtime', required_for_optimal: true, preferred_fallback: 'CORE_EMULATION_FALLBACK' },
    { capability_name: 'storage_object_lock', slot_id: 'storage', required_for_optimal: false, preferred_fallback: 'FEATURE_DISABLED_GRACEFUL' },
  ];
  // Lease grants storage_object_lock in full, omits ai_tensor_acceleration under ACTIVE_DEGRADED
  subsetDegradedHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    { capability_name: 'storage_object_lock', slot_id: 'storage', disposition: 'GRANTED_FULL', active_mode: 'native_s3_object_lock', fallback_applied: 'NONE' },
  ];
  assert.ok(ajv.validate(pcnSchemaId, subsetDegradedHandshake), 'Subset degraded handshake must pass schema validation');
  assert.doesNotThrow(
    () => validatePlatformSemantics(subsetDegradedHandshake, pcnSchemaId),
    'Strict subset lease omitting required_for_optimal: true capability must pass under ACTIVE_DEGRADED'
  );

  // 4. Negative: omitting required_for_optimal: true capability under ACTIVE_OPTIMAL is rejected
  const invalidOmissionHandshake = JSON.parse(JSON.stringify(subsetOptimalHandshake));
  invalidOmissionHandshake.negotiation_request.requested_optional_capabilities = [
    { capability_name: 'ai_tensor_acceleration', slot_id: 'ai_model_runtime', required_for_optimal: true, preferred_fallback: 'CORE_EMULATION_FALLBACK' },
    { capability_name: 'storage_object_lock', slot_id: 'storage', required_for_optimal: false, preferred_fallback: 'FEATURE_DISABLED_GRACEFUL' },
  ];
  invalidOmissionHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    { capability_name: 'storage_object_lock', slot_id: 'storage', disposition: 'GRANTED_FULL', active_mode: 'native_s3_object_lock', fallback_applied: 'NONE' },
  ];
  assert.throws(
    () => validatePlatformSemantics(invalidOmissionHandshake, pcnSchemaId),
    /Semantic error: requested optional capability 'ai_tensor_acceleration' for slot 'ai_model_runtime' is required for optimal operation but is not resolved in agreed_capability_lease/,
    'Omitting required_for_optimal: true capability under ACTIVE_OPTIMAL must fail'
  );

  // 5. Negative: surplus / superset capability in lease not requested
  const surplusHandshake = JSON.parse(JSON.stringify(subsetOptimalHandshake));
  surplusHandshake.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: 'unrequested_secret_boost',
    slot_id: 'secrets',
    disposition: 'GRANTED_FULL',
    active_mode: 'fast_path',
    fallback_applied: 'NONE',
  });
  assert.throws(
    () => validatePlatformSemantics(surplusHandshake, pcnSchemaId),
    /Semantic error: agreed_capability_lease contains unrequested or surplus optional capability 'unrequested_secret_boost' for slot 'secrets'/,
    'Lease containing surplus unrequested capability must fail'
  );

  // 6. Negative: duplicate capability key in lease
  const duplicateKeyHandshake = JSON.parse(JSON.stringify(subsetOptimalHandshake));
  duplicateKeyHandshake.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: 'storage_object_lock',
    slot_id: 'storage',
    disposition: 'GRANTED_FULL',
    active_mode: 'native_s3_object_lock',
    fallback_applied: 'NONE',
  });
  assert.throws(
    () => validatePlatformSemantics(duplicateKeyHandshake, pcnSchemaId),
    /Semantic error: negotiated_optional_capabilities contains duplicate composite key \(storage_object_lock, storage\)/,
    'Lease containing duplicate composite key must fail'
  );
});

test('adversarial regression: prohibit non-canonical storage capability coexistence on immutable profiles (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  const immutableProfiles = [
    'onprem-standard-v1',
    'onprem-airgap-v1',
    'hybrid-sovereign-v1'
  ];

  const nonCanonicalStorageCaps = [
    'storage_lock_alias',
    'storage_worm_lock',
    'storage_object_lock_custom',
    'storage_custom_perf',
    'storage_worm',
    'storage_tiering'
  ];

  for (const profileId of immutableProfiles) {
    const profilePath = join(ROOT, 'contracts/examples/platform', `${profileId}.profile.json`);
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    for (const nonCanonCap of nonCanonicalStorageCaps) {
      // 1. Coexisting non-canonical storage capability in request and lease alongside granted storage_object_lock
      const coexistingHandshake = JSON.parse(JSON.stringify(sample));
      coexistingHandshake.target_profile_id = profileId;
      coexistingHandshake.target_profile_digest = profileDigest;
      if (coexistingHandshake.advertisement_response) {
        coexistingHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      coexistingHandshake.agreed_capability_lease.target_profile_id = profileId;
      coexistingHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      coexistingHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
      coexistingHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';

      coexistingHandshake.negotiation_request.requested_optional_capabilities.push({
        capability_name: nonCanonCap,
        slot_id: 'storage',
        required_for_optimal: false,
        preferred_fallback: 'FEATURE_DISABLED_GRACEFUL'
      });
      coexistingHandshake.agreed_capability_lease.negotiated_optional_capabilities.push({
        capability_name: nonCanonCap,
        slot_id: 'storage',
        disposition: 'GRANTED_FULL',
        active_mode: 'active_default',
        fallback_applied: 'NONE'
      });

      assert.throws(
        () => validatePlatformSemantics(coexistingHandshake, pcnSchemaId),
        /Semantic error: DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN: immutable storage profile prohibits non-canonical storage capability aliases or surplus storage capabilities in request or lease/,
        `Expected ${profileId} to reject coexisting non-canonical storage capability '${nonCanonCap}'`
      );

      // 2. Non-canonical storage capability in request only
      const reqOnlyHandshake = JSON.parse(JSON.stringify(sample));
      reqOnlyHandshake.target_profile_id = profileId;
      reqOnlyHandshake.target_profile_digest = profileDigest;
      if (reqOnlyHandshake.advertisement_response) {
        reqOnlyHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      reqOnlyHandshake.agreed_capability_lease.target_profile_id = profileId;
      reqOnlyHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      reqOnlyHandshake.negotiation_request.requested_optional_capabilities.push({
        capability_name: nonCanonCap,
        slot_id: 'storage',
        required_for_optimal: false,
        preferred_fallback: 'FEATURE_DISABLED_GRACEFUL'
      });
      assert.throws(
        () => validatePlatformSemantics(reqOnlyHandshake, pcnSchemaId),
        /Semantic error: DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN: immutable storage profile prohibits non-canonical storage capability aliases or surplus storage capabilities in request or lease/,
        `Expected ${profileId} to reject requested non-canonical storage capability '${nonCanonCap}'`
      );

      // 3. Non-canonical storage capability in lease only
      const leaseOnlyHandshake = JSON.parse(JSON.stringify(sample));
      leaseOnlyHandshake.target_profile_id = profileId;
      leaseOnlyHandshake.target_profile_digest = profileDigest;
      if (leaseOnlyHandshake.advertisement_response) {
        leaseOnlyHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      leaseOnlyHandshake.agreed_capability_lease.target_profile_id = profileId;
      leaseOnlyHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      leaseOnlyHandshake.agreed_capability_lease.negotiated_optional_capabilities.push({
        capability_name: nonCanonCap,
        slot_id: 'storage',
        disposition: 'GRANTED_FULL',
        active_mode: 'active_default',
        fallback_applied: 'NONE'
      });
      assert.throws(
        () => validatePlatformSemantics(leaseOnlyHandshake, pcnSchemaId),
        /Semantic error: DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN: immutable storage profile prohibits non-canonical storage capability aliases or surplus storage capabilities in request or lease/,
        `Expected ${profileId} to reject leased non-canonical storage capability '${nonCanonCap}'`
      );
    }
  }

  // 4. Permitted on non-immutable profile (private-cloud-v1)
  const privateCloudPath = join(ROOT, 'contracts/examples/platform/private-cloud-v1.profile.json');
  const privateCloudDigest = createHash('sha256').update(readFileSync(privateCloudPath)).digest('hex');
  const privateCustomStorageHandshake = JSON.parse(JSON.stringify(sample));
  privateCustomStorageHandshake.target_profile_id = 'private-cloud-v1';
  privateCustomStorageHandshake.target_profile_digest = privateCloudDigest;
  if (privateCustomStorageHandshake.advertisement_response) {
    privateCustomStorageHandshake.advertisement_response.target_profile_digest = privateCloudDigest;
  }
  privateCustomStorageHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  privateCustomStorageHandshake.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  privateCustomStorageHandshake.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  privateCustomStorageHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  privateCustomStorageHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'storage_custom_perf',
      slot_id: 'storage',
      required_for_optimal: false,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL'
    }
  ];
  privateCustomStorageHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_custom_perf',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'high_speed',
      fallback_applied: 'NONE'
    }
  ];
  assert.doesNotThrow(
    () => validatePlatformSemantics(privateCustomStorageHandshake, pcnSchemaId),
    'Non-immutable profile must permit non-canonical storage capabilities'
  );
});

test('early accessor and transparent proxy fail-closed gating for OPEN-2', () => {
  const validPayload = Buffer.from('CYBRIK_FAIL_CLOSED_GATE_2026');
  const validSha = computePayloadSha256(validPayload);
  const validMd5 = computePayloadMd5(validPayload);

  // 1. Transparent get-trapping Proxy on request options passed to dispatchS3PutObject
  let getTrapCount = 0;
  const transparentProxy = new Proxy({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
  }, {
    get(target, prop) {
      getTrapCount++;
      return target[prop];
    },
  });
  const putProxyRes = dispatchS3PutObject(transparentProxy);
  assert.equal(putProxyRes.http_status, 400);
  assert.equal(putProxyRes.error_code, 'InvalidDigest');
  assert.equal(putProxyRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Transparent get-trapping Proxy passed to dispatchS3Error
  const errProxyRes = dispatchS3Error(transparentProxy);
  assert.equal(errProxyRes.http_status, 400);
  assert.equal(errProxyRes.error_code, 'InvalidDigest');
  assert.equal(errProxyRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3. hasOwnAccessors detects uninvoked getters via getOwnPropertyDescriptors directly
  let getterInvoked = false;
  const objWithExplosiveGetter = {
    get payload() {
      getterInvoked = true;
      throw new Error('EXPLOSIVE_GETTER_ACCESSED');
    },
    'x-amz-content-sha256': validSha,
  };
  assert.equal(hasOwnAccessors(objWithExplosiveGetter), true);
  assert.equal(getterInvoked, false, 'hasOwnAccessors must inspect descriptors directly without invoking getters');

  const putExplosiveRes = dispatchS3PutObject(objWithExplosiveGetter);
  assert.equal(putExplosiveRes.http_status, 400);
  assert.equal(putExplosiveRes.error_code, 'InvalidDigest');
  assert.equal(putExplosiveRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(getterInvoked, false, 'dispatchS3PutObject must fail closed on accessors without invoking getters');

  // 4. Early accessor gating runs before hasOversizedDeclaredLength
  let lengthGetterInvoked = false;
  const objWithLengthGetter = {
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    get content_length() {
      lengthGetterInvoked = true;
      return 10000000000; // > 5 GiB
    },
  };
  const putLengthGetterRes = dispatchS3PutObject(objWithLengthGetter);
  assert.equal(putLengthGetterRes.http_status, 400);
  assert.equal(putLengthGetterRes.error_code, 'InvalidDigest', 'Must fail closed with InvalidDigest MALFORMED_PAYLOAD_TYPE, not EntityTooLarge');
  assert.equal(putLengthGetterRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(lengthGetterInvoked, false, 'content_length getter must not be evaluated when accessor gate triggers');

  const errLengthGetterRes = dispatchS3Error(objWithLengthGetter);
  assert.equal(errLengthGetterRes.http_status, 400);
  assert.equal(errLengthGetterRes.error_code, 'InvalidDigest');
  assert.equal(errLengthGetterRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(lengthGetterInvoked, false, 'content_length getter must not be evaluated in dispatchS3Error');

  // 5. Transparent Proxy wrapping multipart manifest in dispatchS3CompleteMultipartUpload and validateS3MultipartSemantics
  const transparentManifestProxy = new Proxy({
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
    ],
  }, {
    get(target, prop) {
      return target[prop];
    },
  });
  const multipartProxyRes = dispatchS3CompleteMultipartUpload(transparentManifestProxy, [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }]);
  assert.equal(multipartProxyRes.http_status, 400);
  assert.equal(multipartProxyRes.error_code, 'InvalidPart');
  assert.equal(multipartProxyRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  assert.throws(
    () => validateS3MultipartSemantics(transparentManifestProxy),
    /Semantic error: multipart upload manifest structure is invalid or malformed \(InvalidPart\)/
  );

  // 6. Transparent Proxy wrapping parts array in dispatchS3CompleteMultipartUpload and validateS3MultipartSemantics
  const transparentPartsArrayProxy = new Proxy([
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' },
  ], {
    get(target, prop) {
      return target[prop];
    },
  });
  const multipartPartsProxyRes = dispatchS3CompleteMultipartUpload({ parts: transparentPartsArrayProxy }, [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }]);
  assert.equal(multipartPartsProxyRes.http_status, 400);
  assert.equal(multipartPartsProxyRes.error_code, 'InvalidPart');
  assert.equal(multipartPartsProxyRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  assert.throws(
    () => validateS3MultipartSemantics({ parts: transparentPartsArrayProxy }),
    /Semantic error: multipart upload manifest structure is invalid or malformed \(InvalidPart\)/
  );

  // 7. Multipart manifest with uninvoked explosive parts getter
  let partsGetterInvoked = false;
  const explosivePartsManifest = {
    get parts() {
      partsGetterInvoked = true;
      throw new Error('EXPLOSIVE_PARTS_GETTER');
    },
  };
  const expPartsRes = dispatchS3CompleteMultipartUpload(explosivePartsManifest);
  assert.equal(expPartsRes.http_status, 400);
  assert.equal(expPartsRes.error_code, 'InvalidPart');
  assert.equal(expPartsRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(partsGetterInvoked, false, 'parts getter must not be invoked');

  assert.throws(
    () => validateS3MultipartSemantics(explosivePartsManifest),
    /Semantic error: multipart upload manifest structure is invalid or malformed \(InvalidPart\)/
  );
  assert.equal(partsGetterInvoked, false, 'parts getter must not be invoked in validateS3MultipartSemantics');
});

test('adversarial regression: zero getter invocation when PutObject options or Error conditions contain accessors (OPEN-2)', () => {
  const payload = Buffer.from('TEST_ZERO_GETTER_PAYLOAD');
  const validSha = computePayloadSha256(payload);

  const probeKeys = [
    'payload',
    'payloadBytes',
    'body',
    'headers',
    'content_length',
    'contentLength',
    'content_length_bytes',
    'size_bytes',
    'size',
    'Content-Length',
    'content-length',
    'contentMd5Header',
    'content_md5_header',
    'contentMd5',
    'Content-MD5',
    'content_md5',
    'content_md5_declared',
    'x-amz-content-sha256',
    'X-Amz-Content-Sha256',
    'contentSha256Header',
    'content_sha256_header',
    'contentSha256',
    'xAmzContentSha256',
    'x_amz_content_sha256',
    'sha256Header',
    'allow_unsigned_payload',
    'is_presigned',
    'error_condition',
    'expected_error',
    'code',
    'reason',
  ];

  for (const key of probeKeys) {
    let getterInvoked = false;
    const optsWithGetter = {
      payloadBytes: payload,
      'x-amz-content-sha256': validSha,
    };
    Object.defineProperty(optsWithGetter, key, {
      get() {
        getterInvoked = true;
        throw new Error(`CRITICAL: Getter on '${key}' must NEVER be invoked!`);
      },
      enumerable: true,
      configurable: true,
    });

    // 1. hasOwnAccessors must return true and catch at descriptor level without calling getter
    assert.equal(hasOwnAccessors(optsWithGetter), true, `hasOwnAccessors must detect accessor on '${key}' at descriptor level`);
    assert.equal(getterInvoked, false, `hasOwnAccessors must NOT invoke getter on '${key}'`);

    // 2. dispatchS3PutObject must fail closed to HTTP 400 InvalidDigest without calling getter
    const putRes = dispatchS3PutObject(optsWithGetter);
    assert.equal(putRes.http_status, 400, `dispatchS3PutObject must return HTTP 400 for accessor on '${key}'`);
    assert.equal(putRes.error_code, 'InvalidDigest', `dispatchS3PutObject must return InvalidDigest for accessor on '${key}'`);
    assert.equal(getterInvoked, false, `dispatchS3PutObject must NOT invoke getter on '${key}'`);

    // 3. dispatchS3Error must fail closed to HTTP 400 InvalidDigest without calling getter
    const errRes = dispatchS3Error(optsWithGetter);
    assert.equal(errRes.http_status, 400, `dispatchS3Error must return HTTP 400 for accessor on '${key}'`);
    assert.equal(errRes.error_code, 'InvalidDigest', `dispatchS3Error must return InvalidDigest for accessor on '${key}'`);
    assert.equal(getterInvoked, false, `dispatchS3Error must NOT invoke getter on '${key}'`);
  }

  // Nested headers accessor zero getter invocation
  const headerKeys = ['Content-MD5', 'content-md5', 'x-amz-content-sha256', 'X-Amz-Content-Sha256', 'Content-Length', 'content-length'];
  for (const hKey of headerKeys) {
    let hdrGetterInvoked = false;
    const hdrsObj = {};
    Object.defineProperty(hdrsObj, hKey, {
      get() {
        hdrGetterInvoked = true;
        throw new Error(`CRITICAL: Header getter on '${hKey}' must NEVER be invoked!`);
      },
      enumerable: true,
      configurable: true,
    });
    const optsWithHdrGetter = {
      payloadBytes: payload,
      'x-amz-content-sha256': validSha,
      headers: hdrsObj,
    };

    assert.equal(hasOwnAccessors(hdrsObj), true);
    assert.equal(hdrGetterInvoked, false, `hasOwnAccessors must NOT invoke header getter on '${hKey}'`);

    const putHdrRes = dispatchS3PutObject(optsWithHdrGetter);
    assert.equal(putHdrRes.http_status, 400);
    assert.equal(putHdrRes.error_code, 'InvalidDigest');
    assert.equal(hdrGetterInvoked, false, `dispatchS3PutObject must NOT invoke header getter on '${hKey}'`);

    const errHdrRes = dispatchS3Error(optsWithHdrGetter);
    assert.equal(errHdrRes.http_status, 400);
    assert.equal(errHdrRes.error_code, 'InvalidDigest');
    assert.equal(hdrGetterInvoked, false, `dispatchS3Error must NOT invoke header getter on '${hKey}'`);
  }
});

test('adversarial regression: accessor-backed oversized length returns HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE), NOT EntityTooLarge (OPEN-2)', () => {
  const payload = Buffer.from('TEST_ACCESSOR_OVERSIZED_PAYLOAD');
  const validSha = computePayloadSha256(payload);

  const lengthKeys = [
    'content_length',
    'contentLength',
    'content_length_bytes',
    'size_bytes',
    'size',
    'Content-Length',
    'content-length',
  ];

  for (const key of lengthKeys) {
    let getterInvoked = false;
    const accessorOversizedOpts = {
      payloadBytes: payload,
      'x-amz-content-sha256': validSha,
    };
    Object.defineProperty(accessorOversizedOpts, key, {
      get() {
        getterInvoked = true;
        return 6000000000; // 6 GiB (> 5 GiB limit)
      },
      enumerable: true,
      configurable: true,
    });

    // 1. hasOversizedDeclaredLength must return false because accessor is not a valid data property
    assert.equal(hasOversizedDeclaredLength(accessorOversizedOpts), false, `hasOversizedDeclaredLength must return false for accessor on '${key}'`);
    assert.equal(getterInvoked, false, `hasOversizedDeclaredLength must not invoke getter for '${key}'`);

    // 2. dispatchS3PutObject returns HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE), NOT EntityTooLarge
    const putRes = dispatchS3PutObject(accessorOversizedOpts);
    assert.equal(putRes.http_status, 400);
    assert.equal(putRes.error_code, 'InvalidDigest', `Expected InvalidDigest for accessor-backed ${key}, got ${putRes.error_code}`);
    assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');
    assert.notEqual(putRes.error_code, 'EntityTooLarge', `Accessor-backed length must NOT return EntityTooLarge for ${key}`);
    assert.equal(getterInvoked, false, `dispatchS3PutObject must not invoke getter for '${key}'`);

    // 3. dispatchS3Error returns HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE), NOT EntityTooLarge
    const errRes = dispatchS3Error(accessorOversizedOpts);
    assert.equal(errRes.http_status, 400);
    assert.equal(errRes.error_code, 'InvalidDigest', `Expected InvalidDigest for accessor-backed ${key}, got ${errRes.error_code}`);
    assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');
    assert.notEqual(errRes.error_code, 'EntityTooLarge', `Accessor-backed length must NOT return EntityTooLarge for ${key}`);
    assert.equal(getterInvoked, false, `dispatchS3Error must not invoke getter for '${key}'`);
  }

  // Nested headers accessor-backed oversized length
  for (const hKey of ['Content-Length', 'content-length']) {
    let hdrGetterInvoked = false;
    const hdrsObj = {};
    Object.defineProperty(hdrsObj, hKey, {
      get() {
        hdrGetterInvoked = true;
        return '6000000000';
      },
      enumerable: true,
      configurable: true,
    });
    const nestedHdrOpts = {
      payloadBytes: payload,
      'x-amz-content-sha256': validSha,
      headers: hdrsObj,
    };

    assert.equal(hasOversizedDeclaredLength(nestedHdrOpts), false);
    assert.equal(hdrGetterInvoked, false);

    const putHdrRes = dispatchS3PutObject(nestedHdrOpts);
    assert.equal(putHdrRes.http_status, 400);
    assert.equal(putHdrRes.error_code, 'InvalidDigest');
    assert.equal(putHdrRes.reason, 'MALFORMED_HEADER_SYNTAX');
    assert.notEqual(putHdrRes.error_code, 'EntityTooLarge');
    assert.equal(hdrGetterInvoked, false);

    const errHdrRes = dispatchS3Error(nestedHdrOpts);
    assert.equal(errHdrRes.http_status, 400);
    assert.equal(errHdrRes.error_code, 'InvalidDigest');
    assert.equal(errHdrRes.reason, 'MALFORMED_HEADER_SYNTAX');
    assert.notEqual(errHdrRes.error_code, 'EntityTooLarge');
    assert.equal(hdrGetterInvoked, false);
  }
});

test('adversarial regression: transparent get-trapping Proxies around valid PutObject options fail closed to HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE) (OPEN-2)', () => {
  const payload = Buffer.from('VALID_PUT_OBJECT_PAYLOAD_DATA');
  const validSha = computePayloadSha256(payload);

  const validPutOptions = {
    payloadBytes: payload,
    'x-amz-content-sha256': validSha,
    content_length: payload.length,
  };

  // 1. Transparent get-trapping Proxy wrapping valid PutObject options
  let getTrapCount = 0;
  const transparentPutProxy = new Proxy(validPutOptions, {
    get(target, prop, receiver) {
      getTrapCount++;
      return Reflect.get(target, prop, receiver);
    },
  });

  const putRes = dispatchS3PutObject(transparentPutProxy);
  assert.equal(putRes.http_status, 400, 'dispatchS3PutObject must return HTTP 400 for transparent get-trapping Proxy');
  assert.equal(putRes.error_code, 'InvalidDigest', 'dispatchS3PutObject must return InvalidDigest for transparent get-trapping Proxy');
  assert.equal(putRes.code, 'InvalidDigest');
  assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Transparent get-trapping Proxy passed to dispatchS3Error
  const errRes = dispatchS3Error(transparentPutProxy);
  assert.equal(errRes.http_status, 400, 'dispatchS3Error must return HTTP 400 for transparent get-trapping Proxy');
  assert.equal(errRes.error_code, 'InvalidDigest', 'dispatchS3Error must return InvalidDigest for transparent get-trapping Proxy');
  assert.equal(errRes.code, 'InvalidDigest');
  assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3. Transparent get-trapping Proxy on headers property
  const validHeaders = {
    'x-amz-content-sha256': validSha,
    'content-length': String(payload.length),
  };
  const transparentHeadersProxy = new Proxy(validHeaders, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
  });
  const putWithProxyHeaders = {
    payloadBytes: payload,
    headers: transparentHeadersProxy,
  };

  const putHdrRes = dispatchS3PutObject(putWithProxyHeaders);
  assert.equal(putHdrRes.http_status, 400);
  assert.equal(putHdrRes.error_code, 'InvalidDigest');
  assert.equal(putHdrRes.reason, 'MALFORMED_HEADER_SYNTAX');

  const errHdrRes = dispatchS3Error(putWithProxyHeaders);
  assert.equal(errHdrRes.http_status, 400);
  assert.equal(errHdrRes.error_code, 'InvalidDigest');
  assert.equal(errHdrRes.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('adversarial regression: transparent get-trapping Proxies around valid multipart manifests fail closed to HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE) (OPEN-2)', () => {
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  const validManifest = {
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880, sha256: 'a'.repeat(64) },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880, sha256: 'b'.repeat(64) },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  // 1. Transparent get-trapping Proxy wrapping root multipart manifest
  const transparentManifestProxy = new Proxy(validManifest, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
  });

  const res1 = dispatchS3CompleteMultipartUpload(transparentManifestProxy, validStoredParts);
  assert.equal(res1.http_status, 400, 'dispatchS3CompleteMultipartUpload must return HTTP 400 for transparent manifest Proxy');
  assert.equal(res1.error_code, 'InvalidPart', 'dispatchS3CompleteMultipartUpload must return InvalidPart for transparent manifest Proxy');
  assert.equal(res1.code, 'InvalidPart');
  assert.equal(res1.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // Also in options wrapper
  const optionsWithProxyManifest = {
    manifest: transparentManifestProxy,
    storedParts: validStoredParts,
  };
  const res1b = dispatchS3CompleteMultipartUpload(optionsWithProxyManifest);
  assert.equal(res1b.http_status, 400);
  assert.equal(res1b.error_code, 'InvalidPart');
  assert.equal(res1b.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // validateS3MultipartSemantics must fail closed
  assert.throws(
    () => validateS3MultipartSemantics(transparentManifestProxy),
    /InvalidPart/,
    'validateS3MultipartSemantics must throw InvalidPart for transparent manifest Proxy'
  );

  // 2. Transparent get-trapping Proxy wrapping parts array inside valid manifest
  const transparentPartsArrayProxy = new Proxy(validManifest.parts, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
  });
  const manifestWithProxyParts = {
    parts: transparentPartsArrayProxy,
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  const res2 = dispatchS3CompleteMultipartUpload(manifestWithProxyParts, validStoredParts);
  assert.equal(res2.http_status, 400);
  assert.equal(res2.error_code, 'InvalidPart');
  assert.equal(res2.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  assert.throws(
    () => validateS3MultipartSemantics(manifestWithProxyParts),
    /InvalidPart/,
    'validateS3MultipartSemantics must throw InvalidPart for transparent parts array Proxy'
  );

  // 3. Transparent get-trapping Proxy wrapping individual part element
  const transparentPartElementProxy = new Proxy(validManifest.parts[0], {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
  });
  const manifestWithProxyElement = {
    parts: [transparentPartElementProxy, validManifest.parts[1]],
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  const res3 = dispatchS3CompleteMultipartUpload(manifestWithProxyElement, validStoredParts);
  assert.equal(res3.http_status, 400);
  assert.equal(res3.error_code, 'InvalidPart');
  assert.equal(res3.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  assert.throws(
    () => validateS3MultipartSemantics(manifestWithProxyElement),
    /InvalidPart/,
    'validateS3MultipartSemantics must throw InvalidPart for transparent part element Proxy'
  );

  // 4. Transparent get-trapping Proxy wrapping storedParts array
  const transparentStoredPartsProxy = new Proxy(validStoredParts, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
  });
  const res4 = dispatchS3CompleteMultipartUpload(validManifest, transparentStoredPartsProxy);
  assert.equal(res4.http_status, 400);
  assert.equal(res4.error_code, 'InvalidPart');
  assert.equal(res4.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 5. Transparent get-trapping Proxy wrapping individual storedPart element
  const transparentStoredPartElemProxy = new Proxy(validStoredParts[0], {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
  });
  const res5 = dispatchS3CompleteMultipartUpload(validManifest, [transparentStoredPartElemProxy, validStoredParts[1]]);
  assert.equal(res5.http_status, 400);
  assert.equal(res5.error_code, 'InvalidPart');
  assert.equal(res5.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
});

test('comprehensive branch coverage for proxy, accessor, and multipart gating (OPEN-2)', () => {
  // 1. hasOwnAccessors with throwing Proxy ownKeys
  const throwingOwnKeysProxy = new Proxy({}, {
    ownKeys() { throw new Error('trap ownKeys'); }
  });
  assert.equal(hasOwnAccessors(throwingOwnKeysProxy), true);

  // 2. hasOwnAccessors with throwing getOwnPropertyDescriptor for probe key
  const throwingGetDescProxy = new Proxy({}, {
    getOwnPropertyDescriptor(t, p) {
      if (p === 'payload') throw new Error('trap getOwnPropertyDescriptor');
      return undefined;
    }
  });
  assert.equal(hasOwnAccessors(throwingGetDescProxy), true);

  // 3. hasOwnAccessors with setter-only property
  const setterOnlyObj = { set payload(v) {} };
  assert.equal(hasOwnAccessors(setterOnlyObj), true);

  // 4. hasOversizedDeclaredLength with string values
  assert.equal(hasOversizedDeclaredLength({ content_length: '6000000000' }), true);
  assert.equal(hasOversizedDeclaredLength({ content_length: 'invalid_number' }), false);
  assert.equal(hasOversizedDeclaredLength({ content_length: '500' }), false);

  // 5. hasOversizedDeclaredLength with diverging headers
  const diffHeadersObj = new Proxy({
    headers: { content_length: 6000000000 }
  }, {
    getOwnPropertyDescriptor(t, p) {
      if (p === 'headers') return { value: { content_length: 100 }, configurable: true, enumerable: true, writable: true };
      return Reflect.getOwnPropertyDescriptor(t, p);
    }
  });
  assert.equal(hasOversizedDeclaredLength(diffHeadersObj), true);

  // 6. dispatchS3CompleteMultipartUpload branches
  const inhStored = Object.create({ storedParts: [] });
  inhStored.manifest = { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] };
  assert.equal(dispatchS3CompleteMultipartUpload(inhStored).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const spGetterObj = {
    manifest: { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] },
    get storedParts() { return []; }
  };
  assert.equal(dispatchS3CompleteMultipartUpload(spGetterObj).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const manGetterObj = {
    get manifest() { return { parts: [] }; }
  };
  assert.equal(dispatchS3CompleteMultipartUpload(manGetterObj).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const badPartsProto = [];
  Object.setPrototypeOf(badPartsProto, {});
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: badPartsProto }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  assert.equal(dispatchS3CompleteMultipartUpload({ parts: 123 }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 7. validateS3MultipartSemantics branches
  const inhTotal = Object.create({ total_parts: 1 });
  inhTotal.parts = [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }];
  assert.throws(() => validateS3MultipartSemantics(inhTotal));

  const inhSize = Object.create({ total_size_bytes: 5242880 });
  inhSize.parts = [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }];
  assert.throws(() => validateS3MultipartSemantics(inhSize));

  const inhPartPnum = Object.create({ part_number: 1 });
  inhPartPnum.etag = '"0123456789abcdef0123456789abcdef"';
  inhPartPnum.size_bytes = 5242880;
  assert.throws(() => validateS3MultipartSemantics({ parts: [inhPartPnum] }));

  const inhPartEtag = Object.create({ etag: '"0123456789abcdef0123456789abcdef"' });
  inhPartEtag.part_number = 1;
  inhPartEtag.size_bytes = 5242880;
  assert.throws(() => validateS3MultipartSemantics({ parts: [inhPartEtag] }));

  const inhPartSize = Object.create({ size_bytes: 5242880 });
  inhPartSize.part_number = 1;
  inhPartSize.etag = '"0123456789abcdef0123456789abcdef"';
  assert.throws(() => validateS3MultipartSemantics({ parts: [inhPartSize] }));

  const throwProtoPart = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880
  }, {
    getPrototypeOf() { throw new Error('trap getPrototypeOf'); }
  });
  assert.throws(() => validateS3MultipartSemantics({ parts: [throwProtoPart] }));

  const throwPropPart = new Proxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880
  }, {
    get(t, p) {
      if (p === 'etag') throw new Error('trap etag');
      return t[p];
    }
  });
  assert.throws(() => validateS3MultipartSemantics({ parts: [throwPropPart] }));

  // 8. dispatchS3PutObject inherited keys & declared length types
  const sampleBuf = Buffer.from('TEST_DATA');
  const sampleSha = computePayloadSha256(sampleBuf);

  const hdrsInh = Object.create({ 'x-amz-content-sha256': sampleSha });
  const reqHdrsInh = { payloadBytes: sampleBuf, headers: hdrsInh };
  assert.equal(dispatchS3PutObject(reqHdrsInh).reason, 'MALFORMED_HEADER_SYNTAX');

  const reqInhDigest = Object.create({ 'x-amz-content-sha256': sampleSha });
  reqInhDigest.payloadBytes = sampleBuf;
  assert.equal(dispatchS3PutObject(reqInhDigest).reason, 'MALFORMED_PAYLOAD_TYPE');

  const reqInhPayload = Object.create({ size_bytes: 100 });
  reqInhPayload.payloadBytes = sampleBuf;
  reqInhPayload['x-amz-content-sha256'] = sampleSha;
  assert.equal(dispatchS3PutObject(reqInhPayload).reason, 'MALFORMED_PAYLOAD_TYPE');

  assert.equal(dispatchS3PutObject({ payloadBytes: sampleBuf, 'x-amz-content-sha256': sampleSha, content_length: 6000000000n }).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
  assert.equal(dispatchS3PutObject({ payloadBytes: sampleBuf, 'x-amz-content-sha256': sampleSha, content_length: '6000000000' }).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
  assert.equal(dispatchS3PutObject({ payloadBytes: sampleBuf, 'x-amz-content-sha256': sampleSha, headers: { 'content-length': 6000000000 } }).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 9. Extra branch coverage for S3 conformance semantics with duplicates
  const dupOpsProfile = {
    profile_id: 'test-dup-ops',
    profile_version: 'v1',
    object_lock_supported: true,
    required_operations: [...S3_19_CLOSED_OPS, S3_19_CLOSED_OPS[0]],
    required_error_codes: S3_CANONICAL_ERROR_CODES,
  };
  assert.throws(() => validateS3ConformanceProfileSemantics(dupOpsProfile), /duplicate operation/);

  // 10. Platform semantics advertised capabilities count and lease object lock fallback
  const pcaSchemaId = 'cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'cybrik.provider-capability-negotiation.v1.schema.json';
  const badAdvCaps = {
    claim_type: 'FULL_PROFILE_CONFORMANCE_DECLARATION',
    target_profile_id: 'cloud-aws-v1',
    advertised_capabilities: [{ capability_name: 'storage_s3_baseline', slot_id: 'storage', supported_modes: ['native'] }],
  };
  assert.throws(() => validatePlatformSemantics(badAdvCaps, pcaSchemaId), /missing required mandatory profile slot/);

  const slots14 = [...ALL_13_CONFORMANCE_SLOTS, 'extra_slot'].map(s => ({ capability_name: `cap_${s}`, slot_id: s, supported_modes: ['native'] }));
  const badAdvCaps14 = {
    claim_type: 'FULL_PROFILE_CONFORMANCE_DECLARATION',
    target_profile_id: 'cloud-aws-v1',
    advertised_capabilities: slots14,
  };
  assert.throws(() => validatePlatformSemantics(badAdvCaps14, pcaSchemaId), /must declare exactly 13 advertised capabilities/);

  // 11. Immutable lease storage_object_lock with fallback != NONE
  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  const badLockFbHandshake = JSON.parse(readFileSync(samplePath, 'utf8'));
  badLockFbHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  badLockFbHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  badLockFbHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    { capability_name: 'storage_object_lock', slot_id: 'storage', disposition: 'GRANTED_DEGRADED', active_mode: 'native_s3_object_lock', fallback_applied: 'CORE_EMULATION_FALLBACK' }
  ];
  assert.throws(() => validatePlatformSemantics(badLockFbHandshake, pcnSchemaId), /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/);

  // 12. dispatchS3CompleteMultipartUpload wrapper branches
  const inhManWrapper = Object.create({ manifest: { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] } });
  assert.equal(dispatchS3CompleteMultipartUpload(inhManWrapper).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const proxyHdrsWrapper = {
    manifest: { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"' }] },
    headers: new Proxy({}, {})
  };
  assert.equal(dispatchS3CompleteMultipartUpload(proxyHdrsWrapper).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 13. Additional targeted branch coverage for isPlainOrNull, proto accessors, and error dispatch
  const throwingProtoObj = new Proxy({}, { getPrototypeOf() { throw new Error('trap getPrototypeOf'); } });
  assert.equal(isPlainOrNull(throwingProtoObj), false);

  const protoAccessorObj = Object.create({ get content_length() { return 6000000000; } });
  assert.equal(hasOversizedDeclaredLength(protoAccessorObj), false);

  const hdrsAccessorObj = { get headers() { return { content_length: 6000000000 }; } };
  assert.equal(hasOversizedDeclaredLength(hdrsAccessorObj), false);

  const putProtoPayload = Object.create({ get payload() { return Buffer.from('x'); } });
  assert.equal(dispatchS3PutObject(putProtoPayload).reason, 'MALFORMED_PAYLOAD_TYPE');
  const putProtoBytes = Object.create({ get payloadBytes() { return Buffer.from('x'); } });
  assert.equal(dispatchS3PutObject(putProtoBytes).reason, 'MALFORMED_PAYLOAD_TYPE');

  const errProtoPayload = Object.create({ get payload() { return Buffer.from('x'); } });
  assert.equal(dispatchS3Error(errProtoPayload).reason, 'MALFORMED_PAYLOAD_TYPE');
  const errProtoBytes = Object.create({ get payloadBytes() { return Buffer.from('x'); } });
  assert.equal(dispatchS3Error(errProtoBytes).reason, 'MALFORMED_PAYLOAD_TYPE');
  const errProtoCode = Object.create({ get code() { return 'InvalidDigest'; } });
  assert.equal(dispatchS3Error(errProtoCode).reason, 'MALFORMED_PAYLOAD_TYPE');
  const errProtoReason = Object.create({ get reason() { return 'INVALID'; } });
  assert.equal(dispatchS3Error(errProtoReason).reason, 'MALFORMED_PAYLOAD_TYPE');

  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: new Proxy({}, {}) }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: Object.create({ parts: [] }) }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: { get parts() { return []; } } }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: { parts: new Proxy([], {}) } }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  assert.throws(() => validateS3MultipartSemantics(new Proxy({}, {})));
  assert.throws(() => validateS3MultipartSemantics(Object.create({ parts: [] })));
  assert.throws(() => validateS3MultipartSemantics({ get parts() { return []; } }));
  assert.throws(() => validateS3MultipartSemantics({ parts: new Proxy([], {}) }));
  assert.throws(() => validateS3MultipartSemantics({ parts: [new Proxy({}, {})] }));
  assert.throws(() => validateS3MultipartSemantics({ parts: [{ get part_number() { return 1; } }] }));
});

test('adversarial Object.prototype getter pollution: simultaneous 17-property explosive pollution fails closed with zero getter invocation across all S3 dispatchers (OPEN-2 / OPEN-5)', () => {
  const POLLUTED_PROPERTIES = [
    'headers',
    'payload',
    'payloadBytes',
    'Content-MD5',
    'x-amz-content-sha256',
    'error_condition',
    'expected_error',
    'code',
    'reason',
    'parts',
    'PartNumber',
    'part_number',
    'ETag',
    'etag',
    'Size',
    'size',
    'size_bytes',
  ];

  const invoked = {};
  for (const prop of POLLUTED_PROPERTIES) {
    invoked[prop] = false;
    Object.defineProperty(Object.prototype, prop, {
      get() {
        invoked[prop] = true;
        throw new Error(`EXPLOSIVE_OBJECT_PROTOTYPE_GETTER_${prop}`);
      },
      configurable: true,
      enumerable: false,
    });
  }

  const validEtag = '"0123456789abcdef0123456789abcdef"';

  try {
    // 1. Plain objects passed to dispatchS3PutObject
    const putRes = dispatchS3PutObject({ payload: Buffer.from('TEST_PAYLOAD') });
    assert.equal(putRes.http_status, 400);
    assert.equal(putRes.error_code, 'InvalidDigest');
    assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 2. Plain objects passed to dispatchS3Error
    const errRes = dispatchS3Error({ error_condition: 'AccessDenied' });
    assert.equal(errRes.http_status, 400);
    assert.equal(errRes.error_code, 'InvalidDigest');
    assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 3. Plain objects passed to dispatchS3CompleteMultipartUpload
    const multipartRes = dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: validEtag }] });
    assert.equal(multipartRes.http_status, 400);
    assert.equal(multipartRes.error_code, 'InvalidPart');
    assert.equal(multipartRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

    // 4. validateS3MultipartSemantics on plain manifest
    assert.throws(
      () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: validEtag }] }),
      /Semantic error: multipart upload manifest/
    );

    // 5. Non-plain prototype objects passed to all dispatchers
    const nonPlainPut = Object.create({ custom: 'proto' }, { payload: { value: Buffer.from('NON_PLAIN_PAYLOAD'), enumerable: true } });
    const nonPlainPutRes = dispatchS3PutObject(nonPlainPut);
    assert.equal(nonPlainPutRes.http_status, 400);
    assert.equal(nonPlainPutRes.error_code, 'InvalidDigest');
    assert.equal(nonPlainPutRes.reason, 'MALFORMED_PAYLOAD_TYPE');

    const nonPlainErr = Object.create({ custom: 'proto' }, { code: { value: 'AccessDenied', enumerable: true } });
    const nonPlainErrRes = dispatchS3Error(nonPlainErr);
    assert.equal(nonPlainErrRes.http_status, 400);
    assert.equal(nonPlainErrRes.error_code, 'InvalidDigest');
    assert.equal(nonPlainErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');

    const nonPlainMultipart = Object.create({ custom: 'proto' }, { parts: { value: [{ part_number: 1, etag: validEtag }], enumerable: true } });
    const nonPlainMultipartRes = dispatchS3CompleteMultipartUpload(nonPlainMultipart);
    assert.equal(nonPlainMultipartRes.http_status, 400);
    assert.equal(nonPlainMultipartRes.error_code, 'InvalidPart');
    assert.equal(nonPlainMultipartRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

    assert.throws(
      () => validateS3MultipartSemantics(nonPlainMultipart),
      /Semantic error: multipart upload manifest/
    );

    // 6. Custom class instances passed to all dispatchers
    class CustomPutRequest {
      constructor() {
        Object.defineProperty(this, 'payload', { value: Buffer.from('CLASS_PAYLOAD'), enumerable: true });
      }
    }
    const classPutRes = dispatchS3PutObject(new CustomPutRequest());
    assert.equal(classPutRes.http_status, 400);
    assert.equal(classPutRes.error_code, 'InvalidDigest');
    assert.equal(classPutRes.reason, 'MALFORMED_PAYLOAD_TYPE');

    class CustomErrorRequest {
      constructor() {
        Object.defineProperty(this, 'code', { value: 'AccessDenied', enumerable: true });
      }
    }
    const classErrRes = dispatchS3Error(new CustomErrorRequest());
    assert.equal(classErrRes.http_status, 400);
    assert.equal(classErrRes.error_code, 'InvalidDigest');
    assert.equal(classErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');

    class CustomMultipartRequest {
      constructor() {
        Object.defineProperty(this, 'parts', { value: [{ part_number: 1, etag: validEtag }], enumerable: true });
      }
    }
    const classMultipartRes = dispatchS3CompleteMultipartUpload(new CustomMultipartRequest());
    assert.equal(classMultipartRes.http_status, 400);
    assert.equal(classMultipartRes.error_code, 'InvalidPart');
    assert.equal(classMultipartRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

    assert.throws(
      () => validateS3MultipartSemantics(new CustomMultipartRequest()),
      /Semantic error: multipart upload manifest/
    );

    // 7. Transparent Proxy objects passed to all dispatchers
    const proxyPutRes = dispatchS3PutObject(new Proxy({ payload: Buffer.from('PROXY_PAYLOAD') }, {}));
    assert.equal(proxyPutRes.http_status, 400);
    assert.equal(proxyPutRes.error_code, 'InvalidDigest');
    assert.equal(proxyPutRes.reason, 'MALFORMED_PAYLOAD_TYPE');

    const proxyErrRes = dispatchS3Error(new Proxy({ code: 'AccessDenied' }, {}));
    assert.equal(proxyErrRes.http_status, 400);
    assert.equal(proxyErrRes.error_code, 'InvalidDigest');
    assert.equal(proxyErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');

    const proxyMultipartRes = dispatchS3CompleteMultipartUpload(new Proxy({ parts: [{ part_number: 1, etag: validEtag }] }, {}));
    assert.equal(proxyMultipartRes.http_status, 400);
    assert.equal(proxyMultipartRes.error_code, 'InvalidPart');
    assert.equal(proxyMultipartRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

    assert.throws(
      () => validateS3MultipartSemantics(new Proxy({ parts: [{ part_number: 1, etag: validEtag }] }, {})),
      /Semantic error: multipart upload manifest/
    );

    // 8. Assert ZERO getters were invoked across ALL 17 polluted properties
    for (const prop of POLLUTED_PROPERTIES) {
      assert.equal(invoked[prop], false, `Object.prototype.${prop} getter must NOT be invoked`);
    }
  } finally {
    for (const prop of POLLUTED_PROPERTIES) {
      delete Object.prototype[prop];
    }
  }
});

test('adversarial Object.prototype getter pollution: individual 17-property isolated explosive pollution suites (OPEN-2 / OPEN-5)', () => {
  const POLLUTED_PROPERTIES = [
    'headers',
    'payload',
    'payloadBytes',
    'Content-MD5',
    'x-amz-content-sha256',
    'error_condition',
    'expected_error',
    'code',
    'reason',
    'parts',
    'PartNumber',
    'part_number',
    'ETag',
    'etag',
    'Size',
    'size',
    'size_bytes',
  ];

  const validEtag = '"0123456789abcdef0123456789abcdef"';

  for (const prop of POLLUTED_PROPERTIES) {
    let getterInvoked = false;
    Object.defineProperty(Object.prototype, prop, {
      get() {
        getterInvoked = true;
        throw new Error(`EXPLOSIVE_GETTER_${prop}`);
      },
      configurable: true,
      enumerable: false,
    });

    try {
      // 1. Plain objects
      const putRes = dispatchS3PutObject({ payload: Buffer.from('INDIVIDUAL_TEST') });
      assert.equal(putRes.http_status, 400);
      assert.equal(putRes.error_code, 'InvalidDigest');
      assert.equal(getterInvoked, false, `dispatchS3PutObject must not invoke Object.prototype.${prop}`);

      const errRes = dispatchS3Error({ error_condition: 'AccessDenied' });
      assert.equal(errRes.http_status, 400);
      assert.equal(errRes.error_code, 'InvalidDigest');
      assert.equal(getterInvoked, false, `dispatchS3Error must not invoke Object.prototype.${prop}`);

      const multipartRes = dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: validEtag }] });
      assert.equal(multipartRes.http_status, 400);
      assert.equal(multipartRes.error_code, 'InvalidPart');
      assert.equal(getterInvoked, false, `dispatchS3CompleteMultipartUpload must not invoke Object.prototype.${prop}`);

      assert.throws(
        () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: validEtag }] }),
        /Semantic error: multipart upload manifest/
      );
      assert.equal(getterInvoked, false, `validateS3MultipartSemantics must not invoke Object.prototype.${prop}`);

      // 2. Non-plain objects
      const nonPlain = Object.create({ protoKey: 'val' });
      const nonPlainPut = dispatchS3PutObject(nonPlain);
      assert.equal(nonPlainPut.http_status, 400);
      assert.equal(getterInvoked, false, `non-plain dispatchS3PutObject must not invoke Object.prototype.${prop}`);

      const nonPlainErr = dispatchS3Error(nonPlain);
      assert.equal(nonPlainErr.http_status, 400);
      assert.equal(getterInvoked, false, `non-plain dispatchS3Error must not invoke Object.prototype.${prop}`);

      const nonPlainMp = dispatchS3CompleteMultipartUpload(nonPlain);
      assert.equal(nonPlainMp.http_status, 400);
      assert.equal(getterInvoked, false, `non-plain dispatchS3CompleteMultipartUpload must not invoke Object.prototype.${prop}`);

      assert.throws(
        () => validateS3MultipartSemantics(nonPlain),
        /Semantic error: multipart upload manifest/
      );
      assert.equal(getterInvoked, false, `non-plain validateS3MultipartSemantics must not invoke Object.prototype.${prop}`);

      // 3. Proxy objects
      const proxyObj = new Proxy({ payload: Buffer.from('x'), parts: [] }, {});
      const proxyPut = dispatchS3PutObject(proxyObj);
      assert.equal(proxyPut.http_status, 400);
      assert.equal(getterInvoked, false, `proxy dispatchS3PutObject must not invoke Object.prototype.${prop}`);

      const proxyErr = dispatchS3Error(proxyObj);
      assert.equal(proxyErr.http_status, 400);
      assert.equal(getterInvoked, false, `proxy dispatchS3Error must not invoke Object.prototype.${prop}`);

      const proxyMp = dispatchS3CompleteMultipartUpload(proxyObj);
      assert.equal(proxyMp.http_status, 400);
      assert.equal(getterInvoked, false, `proxy dispatchS3CompleteMultipartUpload must not invoke Object.prototype.${prop}`);

      assert.throws(
        () => validateS3MultipartSemantics(proxyObj),
        /Semantic error: multipart upload manifest/
      );
      assert.equal(getterInvoked, false, `proxy validateS3MultipartSemantics must not invoke Object.prototype.${prop}`);
    } finally {
      delete Object.prototype[prop];
    }
  }
});

test('adversarial regression: Object.prototype getter on PartNumber causes validateS3MultipartSemantics and dispatchS3CompleteMultipartUpload to fail closed to InvalidPart without executing getter (OPEN-2 / OPEN-5)', () => {
  let getterInvoked = false;
  Object.defineProperty(Object.prototype, 'PartNumber', {
    get() {
      getterInvoked = true;
      throw new Error('CRITICAL: Object.prototype.PartNumber getter must NEVER be invoked!');
    },
    configurable: true,
  });

  try {
    const validStoredParts = [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
    ];

    const validManifest = {
      parts: [
        { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880, sha256: 'a'.repeat(64) },
        { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880, sha256: 'b'.repeat(64) },
      ],
      total_parts: 2,
      total_size_bytes: 10485760,
    };

    // 1. validateS3MultipartSemantics must fail closed to InvalidPart without invoking getter
    assert.throws(
      () => validateS3MultipartSemantics(validManifest),
      /InvalidPart/,
      'validateS3MultipartSemantics must fail closed to InvalidPart when Object.prototype has PartNumber getter'
    );
    assert.equal(getterInvoked, false, 'Object.prototype.PartNumber getter must NOT be invoked by validateS3MultipartSemantics');

    // 2. dispatchS3CompleteMultipartUpload direct manifest must fail closed to InvalidPart without invoking getter
    const resDirect = dispatchS3CompleteMultipartUpload(validManifest, validStoredParts);
    assert.equal(resDirect.http_status, 400, 'dispatchS3CompleteMultipartUpload must return HTTP 400');
    assert.equal(resDirect.error_code, 'InvalidPart', 'dispatchS3CompleteMultipartUpload must return InvalidPart');
    assert.equal(resDirect.code, 'InvalidPart');
    assert.equal(getterInvoked, false, 'Object.prototype.PartNumber getter must NOT be invoked by dispatchS3CompleteMultipartUpload');

    // 3. dispatchS3CompleteMultipartUpload wrapped options must fail closed to InvalidPart without invoking getter
    const resWrapped = dispatchS3CompleteMultipartUpload({
      manifest: validManifest,
      storedParts: validStoredParts,
    });
    assert.equal(resWrapped.http_status, 400, 'dispatchS3CompleteMultipartUpload must return HTTP 400 for wrapped options');
    assert.equal(resWrapped.error_code, 'InvalidPart', 'dispatchS3CompleteMultipartUpload must return InvalidPart for wrapped options');
    assert.equal(resWrapped.code, 'InvalidPart');
    assert.equal(getterInvoked, false, 'Object.prototype.PartNumber getter must NOT be invoked by dispatchS3CompleteMultipartUpload (wrapped options)');

    // 4. Stored parts with Object.prototype.PartNumber
    const resStoredMap = dispatchS3CompleteMultipartUpload(validManifest, new Map([[1, validStoredParts[0]], [2, validStoredParts[1]]]));
    assert.equal(resStoredMap.http_status, 400);
    assert.equal(resStoredMap.error_code, 'InvalidPart');
    assert.equal(getterInvoked, false, 'Object.prototype.PartNumber getter must NOT be invoked with Map storedParts');
  } finally {
    delete Object.prototype.PartNumber;
  }
});

test('adversarial regression: Object.prototype getter on headers causes dispatchS3PutObject and dispatchS3Error to fail closed to InvalidDigest without executing getter (OPEN-2 / OPEN-5)', () => {
  let getterInvoked = false;
  Object.defineProperty(Object.prototype, 'headers', {
    get() {
      getterInvoked = true;
      throw new Error('CRITICAL: Object.prototype.headers getter must NEVER be invoked!');
    },
    configurable: true,
  });

  try {
    const payload = Buffer.from('TEST_PAYLOAD_FOR_PROTOTYPE_HEADERS_REGRESSION');
    const validSha = computePayloadSha256(payload);

    const validPutOptions = {
      payloadBytes: payload,
      'x-amz-content-sha256': validSha,
      content_length: payload.length,
    };

    // 1. dispatchS3PutObject must fail closed to InvalidDigest without invoking getter
    const putRes = dispatchS3PutObject(validPutOptions);
    assert.equal(putRes.http_status, 400, 'dispatchS3PutObject must return HTTP 400 when Object.prototype has headers getter');
    assert.equal(putRes.error_code, 'InvalidDigest', 'dispatchS3PutObject must return InvalidDigest when Object.prototype has headers getter');
    assert.equal(putRes.code, 'InvalidDigest');
    assert.equal(getterInvoked, false, 'Object.prototype.headers getter must NOT be invoked by dispatchS3PutObject');

    // 2. dispatchS3PutObject with empty object
    const putEmptyRes = dispatchS3PutObject({});
    assert.equal(putEmptyRes.http_status, 400);
    assert.equal(putEmptyRes.error_code, 'InvalidDigest');
    assert.equal(getterInvoked, false, 'Object.prototype.headers getter must NOT be invoked by dispatchS3PutObject ({})');

    // 3. dispatchS3Error must fail closed to InvalidDigest without invoking getter
    const errRes = dispatchS3Error(validPutOptions);
    assert.equal(errRes.http_status, 400, 'dispatchS3Error must return HTTP 400 when Object.prototype has headers getter');
    assert.equal(errRes.error_code, 'InvalidDigest', 'dispatchS3Error must return InvalidDigest when Object.prototype has headers getter');
    assert.equal(errRes.code, 'InvalidDigest');
    assert.equal(getterInvoked, false, 'Object.prototype.headers getter must NOT be invoked by dispatchS3Error');

    // 4. dispatchS3Error with empty object
    const errEmptyRes = dispatchS3Error({});
    assert.equal(errEmptyRes.http_status, 400);
    assert.equal(errEmptyRes.error_code, 'InvalidDigest');
    assert.equal(getterInvoked, false, 'Object.prototype.headers getter must NOT be invoked by dispatchS3Error ({})');
  } finally {
    delete Object.prototype.headers;
  }
});

test('branch coverage: comprehensive S3 multipart, put object, and error dispatcher edge cases (OPEN-2 / OPEN-5)', () => {
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  const validManifest = {
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880, sha256: 'a'.repeat(64) },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880, sha256: 'b'.repeat(64) },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  // 1. Manifest part with invalid or empty ETag
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '' }] }, validStoredParts).reason, 'MissingManifestPartETag');
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: 'invalid-non-s3-etag' }] }, validStoredParts).reason, 'InvalidETagFormat');
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: 12345 }] }, validStoredParts).reason, 'MissingManifestPartETag');

  // 2. Stored part with invalid or empty ETag
  assert.equal(dispatchS3CompleteMultipartUpload(validManifest, [{ part_number: 1, etag: '' }]).reason, 'MissingStoredPartETag');
  assert.equal(dispatchS3CompleteMultipartUpload(validManifest, [{ part_number: 1, etag: 'invalid-non-s3-etag', size_bytes: 5242880 }]).reason, 'InvalidETagFormat');

  // 3. Stored parts with accessor on storedParts object
  const storedPartsWithAccessor = { get 1() { return { etag: '"abc"', size_bytes: 5242880 }; } };
  assert.equal(dispatchS3CompleteMultipartUpload(validManifest, storedPartsWithAccessor).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 4. Stored parts with non-plain prototype entry
  const protoStoredPart = Object.create({ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 });
  assert.equal(dispatchS3CompleteMultipartUpload(validManifest, [protoStoredPart]).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload(validManifest, new Map([[1, protoStoredPart]])).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload(validManifest, { 1: protoStoredPart }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // 5. headers with prototype inheritance on headers object
  const inhHdrs = Object.create({ 'x-amz-content-sha256': 'abc' });
  assert.equal(dispatchS3PutObject({ payload: 'abc', headers: inhHdrs }).reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(dispatchS3Error({ payload: 'abc', headers: inhHdrs }).reason, 'MALFORMED_HEADER_SYNTAX');

  // 6. dispatchS3PutObject with header digest keys inherited
  for (const k of ['contentMd5Header', 'content_md5_header', 'contentMd5', 'Content-MD5', 'content_md5', 'content_md5_declared', 'x-amz-content-sha256', 'X-Amz-Content-Sha256', 'contentSha256Header', 'content_sha256_header', 'contentSha256', 'xAmzContentSha256', 'x_amz_content_sha256', 'sha256Header', 'content-length', 'Content-Length']) {
    const hdrsObj = Object.create({ [k]: 'val' });
    assert.equal(dispatchS3PutObject({ payload: 'abc', headers: hdrsObj }).reason, 'MALFORMED_HEADER_SYNTAX');
  }

  // 7. validateS3MultipartSemantics with ETag, SizeBytes, size inherited on part
  const partWithInheritedETag = Object.create({ ETag: '"0123456789abcdef0123456789abcdef"' });
  partWithInheritedETag.part_number = 1;
  partWithInheritedETag.size_bytes = 5242880;
  assert.throws(() => validateS3MultipartSemantics({ parts: [partWithInheritedETag] }));

  const partWithInheritedSizeBytes = Object.create({ SizeBytes: 5242880 });
  partWithInheritedSizeBytes.part_number = 1;
  partWithInheritedSizeBytes.etag = '"0123456789abcdef0123456789abcdef"';
  assert.throws(() => validateS3MultipartSemantics({ parts: [partWithInheritedSizeBytes] }));

  // 8. dispatchS3Error and dispatchS3PutObject with valid and invalid header shapes
  const sampleBuf = Buffer.from('TEST_ERROR_PAYLOAD');
  const sampleSha = computePayloadSha256(sampleBuf);
  assert.equal(dispatchS3Error({ payloadBytes: sampleBuf, headers: { 'x-amz-content-sha256': sampleSha } }).http_status, 200);
  assert.equal(dispatchS3Error({ payloadBytes: sampleBuf, headers: { 'x-amz-content-sha256': '0'.repeat(64) } }).http_status, 400);
  assert.equal(dispatchS3Error({ payloadBytes: sampleBuf, headers: { 'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD' } }).reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');
  assert.equal(dispatchS3PutObject({ payloadBytes: sampleBuf, headers: { 'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD' } }).reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');
  assert.equal(dispatchS3PutObject({ payloadBytes: sampleBuf, headers: 'invalid_string_hdrs' }).reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(dispatchS3PutObject({ payloadBytes: sampleBuf, headers: new Date() }).reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(dispatchS3PutObject({ payloadBytes: sampleBuf, headers: ['arr'] }).reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(dispatchS3Error({ payloadBytes: sampleBuf, headers: { 'content-length': 6000000000 } }).reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
  assert.equal(dispatchS3Error({ payloadBytes: sampleBuf, headers: 'invalid_string_hdrs' }).reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(dispatchS3Error({ payloadBytes: sampleBuf, headers: new Date() }).reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(dispatchS3Error({ payloadBytes: sampleBuf, headers: ['arr'] }).reason, 'MALFORMED_HEADER_SYNTAX');
  // 9. dispatchS3CompleteMultipartUpload options wrapper branches
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: Object.create({ parts: [] }) }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ get manifest() { return {}; } }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: validManifest, storedParts: Object.create({ '1': validStoredParts[0] }) }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: validManifest, get storedParts() { return validStoredParts; } }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload('invalid_string_manifest').reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload(['invalid_array_manifest']).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload(Object.create(null)).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ get parts() { return []; } }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: validManifest.parts, get total_parts() { return 2; } }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: validManifest.parts, total_size_bytes: 'invalid_type' }, validStoredParts).reason, 'TotalSizeMismatch');
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: validManifest.parts, get total_size_bytes() { return 100; } }, validStoredParts).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  // 10. payloadOptionKeys branch coverage for dispatchS3PutObject and dispatchS3Error
  for (const k of ['payload', 'payloadBytes', 'body', 'allow_unsigned_payload', 'is_presigned', 'content_length', 'contentLength', 'content_length_bytes', 'size_bytes', 'size', 'content-length', 'Content-Length']) {
    const inheritedObj = Object.create({ [k]: 'val' });
    assert.equal(dispatchS3PutObject(inheritedObj).reason, 'MALFORMED_PAYLOAD_TYPE');
    assert.equal(dispatchS3Error(inheritedObj).reason, 'MALFORMED_PAYLOAD_TYPE');
  }

  // 11. Stored part and manifest part with inherited properties in dispatchS3CompleteMultipartUpload
  for (const k of ['part_number', 'PartNumber', 'etag', 'ETag', 'size_bytes', 'SizeBytes', 'size']) {
    const inhPart = Object.create({ [k]: 1 });
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [validManifest.parts[0]] }, [inhPart]).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [validManifest.parts[0]] }, new Map([[1, inhPart]])).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [validManifest.parts[0]] }, { '1': inhPart }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [inhPart] }, validStoredParts).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  }

  // 12. digestKeys prototype pollution coverage for dispatchS3PutObject and dispatchS3Error
  for (const k of ['contentMd5Header', 'content_md5_header', 'contentMd5', 'Content-MD5', 'content_md5', 'content_md5_declared', 'x-amz-content-sha256', 'X-Amz-Content-Sha256', 'contentSha256Header', 'content_sha256_header', 'contentSha256', 'xAmzContentSha256', 'x_amz_content_sha256', 'sha256Header']) {
    try {
      Object.prototype[k] = 'polluted-digest';
      assert.equal(dispatchS3PutObject({ payload: 'valid' }).http_status, 400);
      assert.equal(dispatchS3Error({ payload: 'valid' }).http_status, 400);
    } finally {
      delete Object.prototype[k];
    }
  }
});

test('zero-trap proxy instrumentation regression: root and nested proxy arguments trigger exactly 0 proxy traps across all S3 and platform dispatchers and semantic validators (OPEN-2 / OPEN-5)', () => {
  function createZeroTrapInstrumentedProxy(target) {
    const counts = {
      get: 0,
      has: 0,
      set: 0,
      deleteProperty: 0,
      getOwnPropertyDescriptor: 0,
      defineProperty: 0,
      getPrototypeOf: 0,
      setPrototypeOf: 0,
      isExtensible: 0,
      preventExtensions: 0,
      ownKeys: 0,
      apply: 0,
      construct: 0,
    };

    const proxy = new Proxy(target, {
      get(t, p, r) {
        counts.get++;
        return Reflect.get(t, p, r);
      },
      has(t, p) {
        counts.has++;
        return Reflect.has(t, p);
      },
      set(t, p, v, r) {
        counts.set++;
        return Reflect.set(t, p, v, r);
      },
      deleteProperty(t, p) {
        counts.deleteProperty++;
        return Reflect.deleteProperty(t, p);
      },
      getOwnPropertyDescriptor(t, p) {
        counts.getOwnPropertyDescriptor++;
        return Reflect.getOwnPropertyDescriptor(t, p);
      },
      defineProperty(t, p, a) {
        counts.defineProperty++;
        return Reflect.defineProperty(t, p, a);
      },
      getPrototypeOf(t) {
        counts.getPrototypeOf++;
        return Reflect.getPrototypeOf(t);
      },
      setPrototypeOf(t, proto) {
        counts.setPrototypeOf++;
        return Reflect.setPrototypeOf(t, proto);
      },
      isExtensible(t) {
        counts.isExtensible++;
        return Reflect.isExtensible(t);
      },
      preventExtensions(t) {
        counts.preventExtensions++;
        return Reflect.preventExtensions(t);
      },
      ownKeys(t) {
        counts.ownKeys++;
        return Reflect.ownKeys(t);
      },
      apply(t, thisArg, argList) {
        counts.apply++;
        return Reflect.apply(t, thisArg, argList);
      },
      construct(t, argList, newTarget) {
        counts.construct++;
        return Reflect.construct(t, argList, newTarget);
      },
    });

    return {
      proxy,
      counts,
      get totalTrapCount() {
        return Object.values(counts).reduce((sum, n) => sum + n, 0);
      },
      assertZeroTraps(contextLabel = '') {
        for (const [trapName, count] of Object.entries(counts)) {
          assert.equal(
            count,
            0,
            `Proxy trap '${trapName}' was invoked ${count} time(s) on ${contextLabel}; expected exactly 0 invocations under Proxy-first defense`
          );
        }
      },
    };
  }

  const validPayload = Buffer.from('ZERO_TRAP_INSTRUMENTATION_PAYLOAD_2026');
  const validSha = computePayloadSha256(validPayload);
  const validMd5 = computePayloadMd5(validPayload);

  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  const validManifest = {
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880, sha256: 'a'.repeat(64) },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880, sha256: 'b'.repeat(64) },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  // =========================================================================
  // 1. dispatchS3PutObject and Payload zero-trap instrumentation test suite
  // =========================================================================

  // 1.1 Root Proxy passed directly as optionsOrPayload
  const putRootInst = createZeroTrapInstrumentedProxy({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
  });
  const putRootRes = dispatchS3PutObject(putRootInst.proxy);
  assert.equal(putRootRes.http_status, 400);
  assert.equal(putRootRes.error_code, 'InvalidDigest');
  assert.equal(putRootInst.totalTrapCount, 0);
  putRootInst.assertZeroTraps('dispatchS3PutObject root proxy');

  // 1.2 Proxy passed as second argument maybeMd5Header
  const putMd5ArgInst = createZeroTrapInstrumentedProxy(new String(validMd5));
  const putMd5ArgRes = dispatchS3PutObject(validPayload, putMd5ArgInst.proxy, validSha);
  assert.equal(putMd5ArgRes.http_status, 400);
  assert.equal(putMd5ArgRes.error_code, 'InvalidDigest');
  assert.equal(putMd5ArgInst.totalTrapCount, 0);
  putMd5ArgInst.assertZeroTraps('dispatchS3PutObject md5 arg proxy');

  // 1.3 Proxy passed as third argument maybeSha256Header
  const putShaArgInst = createZeroTrapInstrumentedProxy(new String(validSha));
  const putShaArgRes = dispatchS3PutObject(validPayload, validMd5, putShaArgInst.proxy);
  assert.equal(putShaArgRes.http_status, 400);
  assert.equal(putShaArgRes.error_code, 'InvalidDigest');
  assert.equal(putShaArgInst.totalTrapCount, 0);
  putShaArgInst.assertZeroTraps('dispatchS3PutObject sha256 arg proxy');

  // 1.4 Headers object Proxy inside options
  const putHeadersInst = createZeroTrapInstrumentedProxy({
    'x-amz-content-sha256': validSha,
  });
  const putHeadersRes = dispatchS3PutObject({
    payloadBytes: validPayload,
    headers: putHeadersInst.proxy,
  });
  assert.equal(putHeadersRes.http_status, 400);
  assert.equal(putHeadersRes.error_code, 'InvalidDigest');
  assert.equal(putHeadersInst.totalTrapCount, 0);
  putHeadersInst.assertZeroTraps('dispatchS3PutObject headers proxy');

  // 1.5 Nested options.payload Proxy
  const putNestedPayloadInst = createZeroTrapInstrumentedProxy(Buffer.from('nested-payload-1'));
  const putNestedPayloadRes = dispatchS3PutObject({
    payload: putNestedPayloadInst.proxy,
    'x-amz-content-sha256': validSha,
  });
  assert.equal(putNestedPayloadRes.http_status, 400);
  assert.equal(putNestedPayloadRes.error_code, 'InvalidDigest');
  assert.equal(putNestedPayloadRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  putNestedPayloadInst.assertZeroTraps('dispatchS3PutObject nested options.payload proxy');

  // 1.6 Nested options.payloadBytes Proxy
  const putNestedPayloadBytesInst = createZeroTrapInstrumentedProxy(Buffer.from('nested-payload-2'));
  const putNestedPayloadBytesRes = dispatchS3PutObject({
    payloadBytes: putNestedPayloadBytesInst.proxy,
    'x-amz-content-sha256': validSha,
  });
  assert.equal(putNestedPayloadBytesRes.http_status, 400);
  assert.equal(putNestedPayloadBytesRes.error_code, 'InvalidDigest');
  assert.equal(putNestedPayloadBytesRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  putNestedPayloadBytesInst.assertZeroTraps('dispatchS3PutObject nested options.payloadBytes proxy');

  // 1.7 Nested options.body Proxy
  const putNestedBodyInst = createZeroTrapInstrumentedProxy(Buffer.from('nested-payload-3'));
  const putNestedBodyRes = dispatchS3PutObject({
    body: putNestedBodyInst.proxy,
    'x-amz-content-sha256': validSha,
  });
  assert.equal(putNestedBodyRes.http_status, 400);
  assert.equal(putNestedBodyRes.error_code, 'InvalidDigest');
  assert.equal(putNestedBodyRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  putNestedBodyInst.assertZeroTraps('dispatchS3PutObject nested options.body proxy');

  // 1.8 Nested options.expected_error Proxy
  const putNestedExpErrInst = createZeroTrapInstrumentedProxy({ error_code: 'BadDigest', error_condition: 'PAYLOAD_DIGEST_MISMATCH' });
  const putNestedExpErrRes = dispatchS3PutObject({
    payloadBytes: validPayload,
    expected_error: putNestedExpErrInst.proxy,
    'x-amz-content-sha256': validSha,
  });
  assert.equal(putNestedExpErrRes.http_status, 400);
  assert.equal(putNestedExpErrRes.error_code, 'InvalidDigest');
  assert.equal(putNestedExpErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  putNestedExpErrInst.assertZeroTraps('dispatchS3PutObject nested expected_error proxy');

  // 1.9 verifyPayloadSha256 / verifyPayloadMd5 with proxy payloads
  const verifyShaInst = createZeroTrapInstrumentedProxy(Buffer.from('sha-test-payload'));
  assert.throws(() => verifyPayloadSha256(verifyShaInst.proxy, validSha), /MALFORMED_PAYLOAD_TYPE/);
  verifyShaInst.assertZeroTraps('verifyPayloadSha256 direct proxy');

  const verifyShaNestedInst = createZeroTrapInstrumentedProxy(Buffer.from('sha-nested-payload'));
  assert.throws(() => verifyPayloadSha256({ payload: verifyShaNestedInst.proxy, 'x-amz-content-sha256': validSha }), /MALFORMED_PAYLOAD_TYPE/);
  verifyShaNestedInst.assertZeroTraps('verifyPayloadSha256 nested payload proxy');

  const verifyMd5Inst = createZeroTrapInstrumentedProxy(Buffer.from('md5-test-payload'));
  assert.throws(() => verifyPayloadMd5(verifyMd5Inst.proxy, validMd5), /MALFORMED_PAYLOAD_TYPE/);
  verifyMd5Inst.assertZeroTraps('verifyPayloadMd5 direct proxy');

  const verifyMd5NestedInst = createZeroTrapInstrumentedProxy(Buffer.from('md5-nested-payload'));
  assert.throws(() => verifyPayloadMd5({ payloadBytes: verifyMd5NestedInst.proxy, contentMd5Header: validMd5 }), /MALFORMED_PAYLOAD_TYPE/);
  verifyMd5NestedInst.assertZeroTraps('verifyPayloadMd5 nested payloadBytes proxy');

  // 1.10 computePayloadSha256 / computePayloadMd5 with proxy payload
  const compShaInst = createZeroTrapInstrumentedProxy(Buffer.from('compute-sha-payload'));
  assert.throws(() => computePayloadSha256(compShaInst.proxy), /TypeError|Invalid payload type/);
  compShaInst.assertZeroTraps('computePayloadSha256 proxy payload');

  const compMd5Inst = createZeroTrapInstrumentedProxy(Buffer.from('compute-md5-payload'));
  assert.throws(() => computePayloadMd5(compMd5Inst.proxy), /TypeError|Invalid payload type/);
  compMd5Inst.assertZeroTraps('computePayloadMd5 proxy payload');

  // =========================================================================
  // 2. dispatchS3Error and Digest Error zero-trap instrumentation test suite
  // =========================================================================

  // 2.1 Root Proxy passed directly as conditionOrOptions
  const errRootInst = createZeroTrapInstrumentedProxy({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
  });
  const errRootRes = dispatchS3Error(errRootInst.proxy);
  assert.equal(errRootRes.http_status, 400);
  assert.equal(errRootRes.error_code, 'InvalidDigest');
  assert.equal(errRootInst.totalTrapCount, 0);
  errRootInst.assertZeroTraps('dispatchS3Error root proxy');

  // 2.2 Proxy passed as second argument maybeHeader
  const errHdrArgInst = createZeroTrapInstrumentedProxy(new String(validMd5));
  const errHdrArgRes = dispatchS3Error(validPayload, errHdrArgInst.proxy);
  assert.equal(errHdrArgRes.http_status, 400);
  assert.equal(errHdrArgRes.error_code, 'InvalidDigest');
  assert.equal(errHdrArgInst.totalTrapCount, 0);
  errHdrArgInst.assertZeroTraps('dispatchS3Error header arg proxy');

  // 2.3 Headers object Proxy inside options
  const errHeadersInst = createZeroTrapInstrumentedProxy({
    'x-amz-content-sha256': validSha,
  });
  const errHeadersRes = dispatchS3Error({
    payloadBytes: validPayload,
    headers: errHeadersInst.proxy,
  });
  assert.equal(errHeadersRes.http_status, 400);
  assert.equal(errHeadersRes.error_code, 'InvalidDigest');
  assert.equal(errHeadersInst.totalTrapCount, 0);
  errHeadersInst.assertZeroTraps('dispatchS3Error headers proxy');

  // 2.4 Nested options.payload Proxy in dispatchS3Error
  const errNestedPayloadInst = createZeroTrapInstrumentedProxy(Buffer.from('nested-err-payload-1'));
  const errNestedPayloadRes = dispatchS3Error({ payload: errNestedPayloadInst.proxy });
  assert.equal(errNestedPayloadRes.http_status, 400);
  assert.equal(errNestedPayloadRes.error_code, 'InvalidDigest');
  assert.equal(errNestedPayloadRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  errNestedPayloadInst.assertZeroTraps('dispatchS3Error nested options.payload proxy');

  // 2.5 Nested options.payloadBytes Proxy in dispatchS3Error
  const errNestedPayloadBytesInst = createZeroTrapInstrumentedProxy(Buffer.from('nested-err-payload-2'));
  const errNestedPayloadBytesRes = dispatchS3Error({ payloadBytes: errNestedPayloadBytesInst.proxy });
  assert.equal(errNestedPayloadBytesRes.http_status, 400);
  assert.equal(errNestedPayloadBytesRes.error_code, 'InvalidDigest');
  assert.equal(errNestedPayloadBytesRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  errNestedPayloadBytesInst.assertZeroTraps('dispatchS3Error nested options.payloadBytes proxy');

  // 2.6 Nested options.body Proxy in dispatchS3Error
  const errNestedBodyInst = createZeroTrapInstrumentedProxy(Buffer.from('nested-err-payload-3'));
  const errNestedBodyRes = dispatchS3Error({ body: errNestedBodyInst.proxy });
  assert.equal(errNestedBodyRes.http_status, 400);
  assert.equal(errNestedBodyRes.error_code, 'InvalidDigest');
  assert.equal(errNestedBodyRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  errNestedBodyInst.assertZeroTraps('dispatchS3Error nested options.body proxy');

  // 2.7 Nested options.expected_error Proxy in dispatchS3Error
  const errNestedExpErrInst = createZeroTrapInstrumentedProxy({ error_code: 'BadDigest', error_condition: 'PAYLOAD_DIGEST_MISMATCH' });
  const errNestedExpErrRes = dispatchS3Error({
    payloadBytes: validPayload,
    expected_error: errNestedExpErrInst.proxy,
  });
  assert.equal(errNestedExpErrRes.http_status, 400);
  assert.equal(errNestedExpErrRes.error_code, 'InvalidDigest');
  assert.equal(errNestedExpErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  errNestedExpErrInst.assertZeroTraps('dispatchS3Error nested expected_error proxy');

  // 2.8 verifyDigestErrorDispatch with root and nested expected_error Proxies
  const expErrRootInst = createZeroTrapInstrumentedProxy({
    http_status: 400,
    error_code: 'BadDigest',
    error_condition: 'PAYLOAD_DIGEST_MISMATCH',
    expected_error: { error_code: 'BadDigest' },
  });
  assert.throws(() => verifyDigestErrorDispatch(expErrRootInst.proxy));
  expErrRootInst.assertZeroTraps('verifyDigestErrorDispatch root proxy');

  const expErrNestedInst = createZeroTrapInstrumentedProxy({ error_code: 'BadDigest', error_condition: 'PAYLOAD_DIGEST_MISMATCH' });
  assert.throws(() => verifyDigestErrorDispatch({ http_status: 400, error_code: 'BadDigest', expected_error: expErrNestedInst.proxy }));
  expErrNestedInst.assertZeroTraps('verifyDigestErrorDispatch nested expected_error proxy');

  // 2.9 verifyMalformedHeaderDispatch with Proxy header and headers object Proxy
  const malformedHdrInst = createZeroTrapInstrumentedProxy(new String('invalid-md5-hdr'));
  assert.throws(() => verifyMalformedHeaderDispatch(malformedHdrInst.proxy));
  malformedHdrInst.assertZeroTraps('verifyMalformedHeaderDispatch direct proxy header');

  const malformedHdrsObjInst = createZeroTrapInstrumentedProxy({ 'Content-MD5': 'invalid-md5-hdr' });
  assert.throws(() => verifyMalformedHeaderDispatch({ headers: malformedHdrsObjInst.proxy }));
  malformedHdrsObjInst.assertZeroTraps('verifyMalformedHeaderDispatch headers object proxy');

  // =========================================================================
  // 3. dispatchS3CompleteMultipartUpload zero-trap instrumentation test suite
  // =========================================================================

  // 3.1 Root Proxy passed to dispatchS3CompleteMultipartUpload
  const compRootInst = createZeroTrapInstrumentedProxy({
    manifest: validManifest,
    storedParts: validStoredParts,
  });
  const compRootRes = dispatchS3CompleteMultipartUpload(compRootInst.proxy);
  assert.equal(compRootRes.http_status, 400);
  assert.equal(compRootRes.error_code, 'InvalidPart');
  assert.equal(compRootInst.totalTrapCount, 0);
  compRootInst.assertZeroTraps('dispatchS3CompleteMultipartUpload root proxy');

  // 3.2 Manifest Proxy passed in options wrapper
  const compManifestInst = createZeroTrapInstrumentedProxy({
    parts: validManifest.parts,
    total_parts: 2,
    total_size_bytes: 10485760,
  });
  const compManifestRes = dispatchS3CompleteMultipartUpload({
    manifest: compManifestInst.proxy,
    storedParts: validStoredParts,
  });
  assert.equal(compManifestRes.http_status, 400);
  assert.equal(compManifestRes.error_code, 'InvalidPart');
  assert.equal(compManifestInst.totalTrapCount, 0);
  compManifestInst.assertZeroTraps('dispatchS3CompleteMultipartUpload manifest proxy');

  // 3.3 Parts Array Proxy passed in manifest
  const compPartsArrInst = createZeroTrapInstrumentedProxy(validManifest.parts.slice());
  const compPartsArrRes = dispatchS3CompleteMultipartUpload(
    { parts: compPartsArrInst.proxy, total_parts: 2, total_size_bytes: 10485760 },
    validStoredParts
  );
  assert.equal(compPartsArrRes.http_status, 400);
  assert.equal(compPartsArrRes.error_code, 'InvalidPart');
  assert.equal(compPartsArrInst.totalTrapCount, 0);
  compPartsArrInst.assertZeroTraps('dispatchS3CompleteMultipartUpload parts array proxy');

  // 3.4 Part Element Proxy inside parts array
  const compPartElemInst = createZeroTrapInstrumentedProxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880,
  });
  const compPartElemRes = dispatchS3CompleteMultipartUpload(
    {
      parts: [compPartElemInst.proxy, validManifest.parts[1]],
      total_parts: 2,
      total_size_bytes: 10485760,
    },
    validStoredParts
  );
  assert.equal(compPartElemRes.http_status, 400);
  assert.equal(compPartElemRes.error_code, 'InvalidPart');
  assert.equal(compPartElemInst.totalTrapCount, 0);
  compPartElemInst.assertZeroTraps('dispatchS3CompleteMultipartUpload part element proxy');

  // 3.5 Nested properties inside part element as Proxy (part_number, etag, size_bytes)
  const nestedPNumInst = createZeroTrapInstrumentedProxy(new Number(1));
  const resNestedPNum = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: nestedPNumInst.proxy, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] },
    validStoredParts
  );
  assert.equal(resNestedPNum.http_status, 400);
  assert.equal(resNestedPNum.error_code, 'InvalidPart');
  nestedPNumInst.assertZeroTraps('dispatchS3CompleteMultipartUpload nested part_number proxy');

  const nestedEtagInst = createZeroTrapInstrumentedProxy(new String('"0123456789abcdef0123456789abcdef"'));
  const resNestedEtag = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: nestedEtagInst.proxy, size_bytes: 5242880 }] },
    validStoredParts
  );
  assert.equal(resNestedEtag.http_status, 400);
  assert.equal(resNestedEtag.error_code, 'InvalidPart');
  nestedEtagInst.assertZeroTraps('dispatchS3CompleteMultipartUpload nested etag proxy');

  const nestedSizeInst = createZeroTrapInstrumentedProxy(new Number(5242880));
  const resNestedSize = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: nestedSizeInst.proxy }] },
    validStoredParts
  );
  assert.equal(resNestedSize.http_status, 400);
  assert.equal(resNestedSize.error_code, 'InvalidPart');
  nestedSizeInst.assertZeroTraps('dispatchS3CompleteMultipartUpload nested size_bytes proxy');

  // 3.6 StoredParts Proxy passed as second argument
  const compStoredPartsInst = createZeroTrapInstrumentedProxy(validStoredParts.slice());
  const compStoredPartsRes = dispatchS3CompleteMultipartUpload(validManifest, compStoredPartsInst.proxy);
  assert.equal(compStoredPartsRes.http_status, 400);
  assert.equal(compStoredPartsRes.error_code, 'InvalidPart');
  assert.equal(compStoredPartsInst.totalTrapCount, 0);
  compStoredPartsInst.assertZeroTraps('dispatchS3CompleteMultipartUpload storedParts arg proxy');

  // 3.7 StoredParts Proxy passed in options wrapper object
  const compStoredWrapInst = createZeroTrapInstrumentedProxy(validStoredParts.slice());
  const compStoredWrapRes = dispatchS3CompleteMultipartUpload({
    manifest: validManifest,
    storedParts: compStoredWrapInst.proxy,
  });
  assert.equal(compStoredWrapRes.http_status, 400);
  assert.equal(compStoredWrapRes.error_code, 'InvalidPart');
  assert.equal(compStoredWrapInst.totalTrapCount, 0);
  compStoredWrapInst.assertZeroTraps('dispatchS3CompleteMultipartUpload storedParts wrapper proxy');

  // 3.8 StoredParts Map Proxy passed as argument
  const compStoredMapInst = createZeroTrapInstrumentedProxy(new Map([[1, validStoredParts[0]]]));
  const compStoredMapRes = dispatchS3CompleteMultipartUpload(validManifest, compStoredMapInst.proxy);
  assert.equal(compStoredMapRes.http_status, 400);
  assert.equal(compStoredMapRes.error_code, 'InvalidPart');
  assert.equal(compStoredMapInst.totalTrapCount, 0);
  compStoredMapInst.assertZeroTraps('dispatchS3CompleteMultipartUpload storedParts Map proxy');

  // =========================================================================
  // 4. validateS3MultipartSemantics zero-trap instrumentation test suite
  // =========================================================================

  // 4.1 Root Proxy passed to validateS3MultipartSemantics
  const multiRootInst = createZeroTrapInstrumentedProxy(validManifest);
  assert.throws(
    () => validateS3MultipartSemantics(multiRootInst.proxy),
    /multipart upload manifest structure is invalid or malformed/
  );
  assert.equal(multiRootInst.totalTrapCount, 0);
  multiRootInst.assertZeroTraps('validateS3MultipartSemantics root proxy');

  // 4.2 Parts Array Proxy passed in manifest
  const multiPartsArrInst = createZeroTrapInstrumentedProxy(validManifest.parts.slice());
  assert.throws(
    () => validateS3MultipartSemantics({ parts: multiPartsArrInst.proxy, total_parts: 2, total_size_bytes: 10485760 }),
    /multipart upload manifest structure is invalid or malformed/
  );
  assert.equal(multiPartsArrInst.totalTrapCount, 0);
  multiPartsArrInst.assertZeroTraps('validateS3MultipartSemantics parts array proxy');

  // 4.3 Part Element Proxy inside parts array
  const multiPartElemInst = createZeroTrapInstrumentedProxy({
    part_number: 1,
    etag: '"0123456789abcdef0123456789abcdef"',
    size_bytes: 5242880,
  });
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [multiPartElemInst.proxy, validManifest.parts[1]] }),
    /multipart upload manifest structure is invalid or malformed/
  );
  assert.equal(multiPartElemInst.totalTrapCount, 0);
  multiPartElemInst.assertZeroTraps('validateS3MultipartSemantics part element proxy');

  // 4.4 Nested part properties as Proxies in validateS3MultipartSemantics
  const multiNestedPNumInst = createZeroTrapInstrumentedProxy(new Number(1));
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: multiNestedPNumInst.proxy, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }),
    /multipart upload manifest structure is invalid or malformed/
  );
  multiNestedPNumInst.assertZeroTraps('validateS3MultipartSemantics nested part_number proxy');

  // =========================================================================
  // 5. validatePlatformSemantics zero-trap instrumentation test suite
  // =========================================================================

  // 5.1 Root Proxy with conformance profile data
  const S3_SCHEMA_ID = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const PROFILE_DEF_ID = `${S3_SCHEMA_ID}#/$defs/storageConformanceProfile`;
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));
  const profileInst = createZeroTrapInstrumentedProxy(baseProfile);
  assert.throws(
    () => validatePlatformSemantics(profileInst.proxy, PROFILE_DEF_ID),
    /accessor properties or Proxy objects are prohibited/
  );
  assert.equal(profileInst.totalTrapCount, 0);
  profileInst.assertZeroTraps('validatePlatformSemantics profile root proxy');

  // 5.2 Root Proxy with capability negotiation lease data
  const leaseData = {
    contract_version: '0.1.0',
    negotiation_session_id: 'sess-001',
    provider_identifier: 'prov-001',
    consumer_identifier: 'cons-001',
    requested_slots: ['storage'],
    agreed_capability_lease: {
      lease_id: 'lease-001',
      target_profile_digest: 'a'.repeat(64),
      issued_at: '2026-08-27T00:00:00.000Z',
      valid_until: '2026-08-27T01:00:00.000Z',
      ttl_seconds: 3600,
      overall_status: 'ACTIVE_OPTIMAL',
      granted_capabilities: [{ capability_name: 's3_crud_19_ops_with_worm', status: 'GRANTED_OPTIMAL' }],
      conformance_evidence: [{ test_identifier: 'test-1', status: 'PASS', evidence_pack_digest: 'a'.repeat(64) }],
    },
  };
  const leaseInst = createZeroTrapInstrumentedProxy(leaseData);
  assert.throws(
    () => validatePlatformSemantics(leaseInst.proxy, 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json'),
    /accessor properties or Proxy objects are prohibited/
  );
  assert.equal(leaseInst.totalTrapCount, 0);
  leaseInst.assertZeroTraps('validatePlatformSemantics lease root proxy');

  // 5.3 Root Proxy with offline distribution manifest data
  const manifestData = {
    manifest_version: '0.1.0',
    target_package_id: 'pkg-001',
    signing_key_fingerprint: 'fp-001',
    manifest_signature: 'sig-001',
    signed_entries: [],
  };
  const offInst = createZeroTrapInstrumentedProxy(manifestData);
  assert.throws(
    () => validatePlatformSemantics(offInst.proxy, 'https://contracts.cybrik.offline-distribution-manifest.v1.schema.json'),
    /accessor properties or Proxy objects are prohibited/
  );
  assert.equal(offInst.totalTrapCount, 0);
  offInst.assertZeroTraps('validatePlatformSemantics offline manifest root proxy');

  // =========================================================================
  // 6. validateOfflineInstallSemantics zero-trap instrumentation test suite
  // =========================================================================
  const baseOfflineManifest = {
    manifest_version: '0.1.0',
    target_package_id: 'pkg-offline-conformance-001',
    signing_key_fingerprint: 'fp-offline-2026',
    manifest_signature: 'sig-offline-2026',
    operator_trust_root: {
      public_key_fingerprint: 'fp-trust-2026',
    },
    detached_signature: {
      key_fingerprint: 'fp-trust-2026',
    },
    artifacts: [
      { path: 'payloads/core-package.tar.gz', digest: 'a'.repeat(64) }
    ],
    update_station_workflow: {
      preflight_steps: [],
      apply_steps: [{ action: 'RESTORE_DATABASE_SNAPSHOT', target: 'snapshots/db_v1.sql' }],
      rollback_steps: [],
    },
  };

  // 6.1 Root proxy passed to validateOfflineInstallSemantics
  const offRootInst = createZeroTrapInstrumentedProxy(baseOfflineManifest);
  assert.throws(
    () => validateOfflineInstallSemantics(offRootInst.proxy),
    /accessor properties or Proxy objects are prohibited in offline install manifest/
  );
  assert.equal(offRootInst.totalTrapCount, 0);
  offRootInst.assertZeroTraps('validateOfflineInstallSemantics root proxy');

  // 6.2 Nested proxy in operator_trust_root
  const offTrustRootInst = createZeroTrapInstrumentedProxy({ public_key_fingerprint: 'fp-trust-2026' });
  assert.throws(
    () => validateOfflineInstallSemantics({ ...baseOfflineManifest, operator_trust_root: offTrustRootInst.proxy }),
    /accessor properties or Proxy objects are prohibited in offline install manifest/
  );
  assert.equal(offTrustRootInst.totalTrapCount, 0);
  offTrustRootInst.assertZeroTraps('validateOfflineInstallSemantics nested operator_trust_root proxy');

  // 6.3 Nested proxy in detached_signature
  const offDetachedSigInst = createZeroTrapInstrumentedProxy({ key_fingerprint: 'fp-trust-2026' });
  assert.throws(
    () => validateOfflineInstallSemantics({ ...baseOfflineManifest, detached_signature: offDetachedSigInst.proxy }),
    /accessor properties or Proxy objects are prohibited in offline install manifest/
  );
  assert.equal(offDetachedSigInst.totalTrapCount, 0);
  offDetachedSigInst.assertZeroTraps('validateOfflineInstallSemantics nested detached_signature proxy');

  // 6.4 Nested proxy in artifacts array
  const offArtifactsArrInst = createZeroTrapInstrumentedProxy(baseOfflineManifest.artifacts.slice());
  assert.throws(
    () => validateOfflineInstallSemantics({ ...baseOfflineManifest, artifacts: offArtifactsArrInst.proxy }),
    /accessor properties or Proxy objects are prohibited in offline install manifest/
  );
  assert.equal(offArtifactsArrInst.totalTrapCount, 0);
  offArtifactsArrInst.assertZeroTraps('validateOfflineInstallSemantics nested artifacts array proxy');

  // 6.5 Nested proxy artifact element in artifacts array
  const offArtifactElemInst = createZeroTrapInstrumentedProxy({ path: 'payloads/core-package.tar.gz', digest: 'a'.repeat(64) });
  assert.throws(
    () => validateOfflineInstallSemantics({ ...baseOfflineManifest, artifacts: [offArtifactElemInst.proxy] }),
    /accessor properties or Proxy objects are prohibited in offline install manifest/
  );
  assert.equal(offArtifactElemInst.totalTrapCount, 0);
  offArtifactElemInst.assertZeroTraps('validateOfflineInstallSemantics nested artifact element proxy');

  // 6.6 Nested proxy in update_station_workflow
  const offWorkflowInst = createZeroTrapInstrumentedProxy(baseOfflineManifest.update_station_workflow);
  assert.throws(
    () => validateOfflineInstallSemantics({ ...baseOfflineManifest, update_station_workflow: offWorkflowInst.proxy }),
    /accessor properties or Proxy objects are prohibited in offline install manifest/
  );
  assert.equal(offWorkflowInst.totalTrapCount, 0);
  offWorkflowInst.assertZeroTraps('validateOfflineInstallSemantics nested workflow proxy');

  // 6.7 Nested proxy step in apply_steps
  const offStepInst = createZeroTrapInstrumentedProxy({ action: 'RESTORE_DATABASE_SNAPSHOT', target: 'snapshots/db_v1.sql' });
  assert.throws(
    () => validateOfflineInstallSemantics({
      ...baseOfflineManifest,
      update_station_workflow: {
        preflight_steps: [],
        apply_steps: [offStepInst.proxy],
        rollback_steps: [],
      }
    }),
    /accessor properties or Proxy objects are prohibited in offline install manifest/
  );
  assert.equal(offStepInst.totalTrapCount, 0);
  offStepInst.assertZeroTraps('validateOfflineInstallSemantics nested workflow step proxy');
});

test('adversarial getter-bearing subclass isolation: zero getter invocations and clean fail-closed on Uint8Array, Buffer, and Map subclasses (OPEN-2 / OPEN-5)', () => {
  const rawBytes = Buffer.from('CYBRIK_GETTER_BEARING_SUBCLASS_ISOLATION_2026');
  const validSha = computePayloadSha256(rawBytes);
  const validMd5 = computePayloadMd5(rawBytes);
  const validManifest = {
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880, sha256: 'a'.repeat(64) },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880, sha256: 'b'.repeat(64) },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  function createGetterTracker() {
    const invocations = {
      constructor: 0,
      byteLength: 0,
      byteOffset: 0,
      entries: 0,
      size: 0,
      length: 0,
      symbolIterator: 0,
      buffer: 0,
      values: 0,
      keys: 0,
    };
    return {
      invocations,
      assertZeroInvocations(label = '') {
        for (const [name, count] of Object.entries(invocations)) {
          assert.equal(
            count,
            0,
            `Getter '${name}' was invoked ${count} time(s) on ${label}; expected exactly 0 getter invocations under clean fail-closed isolation`
          );
        }
      }
    };
  }

  // -------------------------------------------------------------------------
  // 1. Getter-bearing Uint8Array subclass
  // -------------------------------------------------------------------------
  const u8Tracker = createGetterTracker();
  class GetterUint8Array extends Uint8Array {
    get byteLength() {
      u8Tracker.invocations.byteLength++;
      return 10;
    }
    get byteOffset() {
      u8Tracker.invocations.byteOffset++;
      return 0;
    }
    get entries() {
      u8Tracker.invocations.entries++;
      return super.entries;
    }
    get length() {
      u8Tracker.invocations.length++;
      return 10;
    }
    get [Symbol.iterator]() {
      u8Tracker.invocations.symbolIterator++;
      return super[Symbol.iterator];
    }
    get buffer() {
      u8Tracker.invocations.buffer++;
      return super.buffer;
    }
    get values() {
      u8Tracker.invocations.values++;
      return super.values;
    }
    get keys() {
      u8Tracker.invocations.keys++;
      return super.keys;
    }
  }
  Object.defineProperty(GetterUint8Array.prototype, 'constructor', {
    get() {
      u8Tracker.invocations.constructor++;
      return GetterUint8Array;
    },
    configurable: true,
  });

  const u8Instance = new GetterUint8Array(rawBytes);

  // 1.1 isMalformedPayloadType returns true with 0 getters
  assert.equal(isMalformedPayloadType(u8Instance), true);
  u8Tracker.assertZeroInvocations('isMalformedPayloadType(GetterUint8Array)');

  // 1.2 dispatchS3PutObject direct argument fails closed to InvalidDigest MALFORMED_PAYLOAD_TYPE
  const putU8Res = dispatchS3PutObject(u8Instance, validMd5, validSha);
  assert.equal(putU8Res.http_status, 400);
  assert.equal(putU8Res.error_code, 'InvalidDigest');
  assert.equal(putU8Res.reason, 'MALFORMED_PAYLOAD_TYPE');
  u8Tracker.assertZeroInvocations('dispatchS3PutObject direct GetterUint8Array');

  // 1.3 dispatchS3PutObject nested payload in options fails closed to InvalidDigest
  const putNestedU8Res = dispatchS3PutObject({ payload: u8Instance, 'x-amz-content-sha256': validSha });
  assert.equal(putNestedU8Res.http_status, 400);
  assert.equal(putNestedU8Res.error_code, 'InvalidDigest');
  assert.equal(putNestedU8Res.reason, 'MALFORMED_PAYLOAD_TYPE');
  u8Tracker.assertZeroInvocations('dispatchS3PutObject options.payload GetterUint8Array');

  // 1.4 dispatchS3Error direct argument fails closed
  const errU8Res = dispatchS3Error(u8Instance, validMd5);
  assert.equal(errU8Res.http_status, 400);
  assert.equal(errU8Res.error_code, 'InvalidDigest');
  assert.equal(errU8Res.reason, 'MALFORMED_PAYLOAD_TYPE');
  u8Tracker.assertZeroInvocations('dispatchS3Error direct GetterUint8Array');

  // 1.5 dispatchS3Error nested payload in options fails closed
  const errNestedU8Res = dispatchS3Error({ payloadBytes: u8Instance });
  assert.equal(errNestedU8Res.http_status, 400);
  assert.equal(errNestedU8Res.error_code, 'InvalidDigest');
  assert.equal(errNestedU8Res.reason, 'MALFORMED_PAYLOAD_TYPE');
  u8Tracker.assertZeroInvocations('dispatchS3Error options.payloadBytes GetterUint8Array');

  // 1.6 computePayloadSha256 / computePayloadMd5 throw TypeError with 0 getters
  assert.throws(() => computePayloadSha256(u8Instance), /TypeError|Invalid payload type/);
  assert.throws(() => computePayloadMd5(u8Instance), /TypeError|Invalid payload type/);
  u8Tracker.assertZeroInvocations('computePayloadSha256/Md5 GetterUint8Array');

  // 1.7 verifyPayloadSha256 / verifyPayloadMd5 fail closed
  assert.throws(() => verifyPayloadSha256(u8Instance, validSha), /MALFORMED_PAYLOAD_TYPE/);
  assert.throws(() => verifyPayloadMd5(u8Instance, validMd5), /MALFORMED_PAYLOAD_TYPE/);
  u8Tracker.assertZeroInvocations('verifyPayloadSha256/Md5 GetterUint8Array');

  // 1.8 hasAnyAccessorsOrProxy on GetterUint8Array returns true cleanly without calling getters
  assert.equal(hasAnyAccessorsOrProxy(u8Instance), true);
  u8Tracker.assertZeroInvocations('hasAnyAccessorsOrProxy GetterUint8Array');

  // -------------------------------------------------------------------------
  // 2. Getter-bearing Buffer subclass
  // -------------------------------------------------------------------------
  const bufTracker = createGetterTracker();
  class GetterBuffer extends Uint8Array {
    get byteLength() {
      bufTracker.invocations.byteLength++;
      return 10;
    }
    get byteOffset() {
      bufTracker.invocations.byteOffset++;
      return 0;
    }
    get entries() {
      bufTracker.invocations.entries++;
      return super.entries;
    }
    get length() {
      bufTracker.invocations.length++;
      return 10;
    }
    get [Symbol.iterator]() {
      bufTracker.invocations.symbolIterator++;
      return super[Symbol.iterator];
    }
    get buffer() {
      bufTracker.invocations.buffer++;
      return super.buffer;
    }
  }
  Object.defineProperty(GetterBuffer.prototype, 'constructor', {
    get() {
      bufTracker.invocations.constructor++;
      return GetterBuffer;
    },
    configurable: true,
  });

  const bufInstance = Object.setPrototypeOf(Buffer.from(rawBytes), GetterBuffer.prototype);

  // 2.1 isMalformedPayloadType returns true with 0 getters
  assert.equal(isMalformedPayloadType(bufInstance), true);
  bufTracker.assertZeroInvocations('isMalformedPayloadType(GetterBuffer)');

  // 2.2 dispatchS3PutObject direct argument fails closed
  const putBufRes = dispatchS3PutObject(bufInstance, validMd5, validSha);
  assert.equal(putBufRes.http_status, 400);
  assert.equal(putBufRes.error_code, 'InvalidDigest');
  assert.equal(putBufRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  bufTracker.assertZeroInvocations('dispatchS3PutObject direct GetterBuffer');

  // 2.3 dispatchS3PutObject nested payload in options fails closed
  const putNestedBufRes = dispatchS3PutObject({ payload: bufInstance, 'x-amz-content-sha256': validSha });
  assert.equal(putNestedBufRes.http_status, 400);
  assert.equal(putNestedBufRes.error_code, 'InvalidDigest');
  assert.equal(putNestedBufRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  bufTracker.assertZeroInvocations('dispatchS3PutObject options.payload GetterBuffer');

  // 2.4 dispatchS3Error direct argument fails closed
  const errBufRes = dispatchS3Error(bufInstance, validMd5);
  assert.equal(errBufRes.http_status, 400);
  assert.equal(errBufRes.error_code, 'InvalidDigest');
  assert.equal(errBufRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  bufTracker.assertZeroInvocations('dispatchS3Error direct GetterBuffer');

  // 2.5 computePayloadSha256 / computePayloadMd5 throw TypeError with 0 getters
  assert.throws(() => computePayloadSha256(bufInstance), /TypeError|Invalid payload type/);
  assert.throws(() => computePayloadMd5(bufInstance), /TypeError|Invalid payload type/);
  bufTracker.assertZeroInvocations('computePayloadSha256/Md5 GetterBuffer');

  // 2.6 verifyPayloadSha256 / verifyPayloadMd5 fail closed
  assert.throws(() => verifyPayloadSha256(bufInstance, validSha), /MALFORMED_PAYLOAD_TYPE/);
  assert.throws(() => verifyPayloadMd5(bufInstance, validMd5), /MALFORMED_PAYLOAD_TYPE/);
  bufTracker.assertZeroInvocations('verifyPayloadSha256/Md5 GetterBuffer');

  // 2.7 hasAnyAccessorsOrProxy on GetterBuffer returns true cleanly without calling getters
  assert.equal(hasAnyAccessorsOrProxy(bufInstance), true);
  bufTracker.assertZeroInvocations('hasAnyAccessorsOrProxy GetterBuffer');

  // -------------------------------------------------------------------------
  // 3. Getter-bearing Map subclass
  // -------------------------------------------------------------------------
  const mapTracker = createGetterTracker();
  class GetterMap extends Map {
    get size() {
      mapTracker.invocations.size++;
      return 2;
    }
    get entries() {
      mapTracker.invocations.entries++;
      return super.entries;
    }
    get [Symbol.iterator]() {
      mapTracker.invocations.symbolIterator++;
      return super[Symbol.iterator];
    }
    get values() {
      mapTracker.invocations.values++;
      return super.values;
    }
    get keys() {
      mapTracker.invocations.keys++;
      return super.keys;
    }
  }
  Object.defineProperty(GetterMap.prototype, 'constructor', {
    get() {
      mapTracker.invocations.constructor++;
      return GetterMap;
    },
    configurable: true,
  });

  const mapInstance = new GetterMap([
    [1, { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }],
    [2, { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 }],
  ]);

  // 3.1 dispatchS3CompleteMultipartUpload storedParts fails closed to InvalidPart
  const resCompMap = dispatchS3CompleteMultipartUpload(validManifest, mapInstance);
  assert.equal(resCompMap.http_status, 400);
  assert.equal(resCompMap.error_code, 'InvalidPart');
  assert.equal(resCompMap.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  mapTracker.assertZeroInvocations('dispatchS3CompleteMultipartUpload GetterMap');

  // 3.2 dispatchS3PutObject with GetterMap fails closed to InvalidDigest
  const resPutMap = dispatchS3PutObject(mapInstance);
  assert.equal(resPutMap.http_status, 400);
  assert.equal(resPutMap.error_code, 'InvalidDigest');
  assert.equal(resPutMap.reason, 'MALFORMED_PAYLOAD_TYPE');
  mapTracker.assertZeroInvocations('dispatchS3PutObject GetterMap');

  // 3.3 dispatchS3Error with GetterMap fails closed to InvalidDigest
  const resErrMap = dispatchS3Error(mapInstance);
  assert.equal(resErrMap.http_status, 400);
  assert.equal(resErrMap.error_code, 'InvalidDigest');
  assert.equal(resErrMap.reason, 'MALFORMED_PAYLOAD_TYPE');
  mapTracker.assertZeroInvocations('dispatchS3Error GetterMap');

  // 3.4 validateS3MultipartSemantics with GetterMap in parts fails closed
  assert.throws(() => validateS3MultipartSemantics({ parts: mapInstance }), /multipart upload manifest structure is invalid/);
  mapTracker.assertZeroInvocations('validateS3MultipartSemantics parts GetterMap');
});

test('adversarial regression: typed array subclass isolation and Object.prototype length pollution resistance (OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_SUBCLASS_ISOLATION_AND_POLLUTION_TEST_2026');
  const validSha = computePayloadSha256(payload);

  // 1. Direct TypedArray subclasses (Float64Array, BigInt64Array, Subclassed Uint8Array) must fail closed as MALFORMED_PAYLOAD_TYPE
  class CustomBufferSubclass extends Uint8Array {}
  const customSubclassPayload = new CustomBufferSubclass(payload);

  const putCustomRes = dispatchS3PutObject(customSubclassPayload, undefined, validSha);
  assert.equal(putCustomRes.http_status, 400);
  assert.equal(putCustomRes.error_code, 'InvalidDigest');
  assert.equal(putCustomRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errCustomRes = dispatchS3Error(customSubclassPayload, undefined);
  assert.equal(errCustomRes.http_status, 400);
  assert.equal(errCustomRes.error_code, 'InvalidDigest');
  assert.equal(errCustomRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Object.prototype pollution with content_length, size, size_bytes must NOT trigger EntityTooLarge on valid PutObject
  for (const lengthKey of ['content_length', 'contentLength', 'content_length_bytes', 'size_bytes', 'size', 'content-length', 'Content-Length']) {
    try {
      Object.prototype[lengthKey] = 5368709121; // > 5 GiB

      const validPutOptions = {
        payloadBytes: payload,
        'x-amz-content-sha256': validSha,
      };

      const putRes = dispatchS3PutObject(validPutOptions);
      assert.equal(putRes.http_status, 200, `dispatchS3PutObject must succeed (HTTP 200) despite Object.prototype.${lengthKey} pollution`);
      assert.equal(putRes.error_code, null);
      assert.equal(putRes.reason, undefined);

      const errRes = dispatchS3Error(validPutOptions);
      assert.equal(errRes.http_status, 200, `dispatchS3Error must succeed (HTTP 200) despite Object.prototype.${lengthKey} pollution`);
      assert.equal(errRes.error_code, null);

      // Direct payload string / Buffer / Uint8Array must also have zero influence from Object.prototype length pollution
      assert.equal(hasOversizedDeclaredLength(payload), false, `hasOversizedDeclaredLength must be false for Buffer under Object.prototype.${lengthKey} pollution`);
      assert.equal(hasOversizedDeclaredLength(validPutOptions), false, `hasOversizedDeclaredLength must be false for plain options without own length under Object.prototype.${lengthKey} pollution`);
    } finally {
      delete Object.prototype[lengthKey];
    }
  }

  // 3. headers object with prototype carrying oversized content_length fails closed to MALFORMED_HEADER_SYNTAX, NOT EntityTooLarge
  const headersProto = { 'content-length': 5368709121, 'Content-Length': 5368709121 };
  const headersWithProto = Object.create(headersProto);
  headersWithProto['x-amz-content-sha256'] = validSha;

  const putHdrsRes = dispatchS3PutObject({ payloadBytes: payload, headers: headersWithProto });
  assert.equal(putHdrsRes.http_status, 400);
  assert.equal(putHdrsRes.error_code, 'InvalidDigest');
  assert.equal(putHdrsRes.reason, 'MALFORMED_HEADER_SYNTAX', 'Inherited headers properties must fail as MALFORMED_HEADER_SYNTAX, NOT EntityTooLarge');

  const errHdrsRes = dispatchS3Error({ payloadBytes: payload, headers: headersWithProto });
  assert.equal(errHdrsRes.http_status, 400);
  assert.equal(errHdrsRes.error_code, 'InvalidDigest');
  assert.equal(errHdrsRes.reason, 'MALFORMED_HEADER_SYNTAX');
});

test('adversarial regression: inherited part_number, etag, and size_bytes on multipart parts fail closed terminally to InvalidPart (OPEN-2)', () => {
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  const validManifest = {
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880, sha256: 'a'.repeat(64) },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880, sha256: 'b'.repeat(64) },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  // 1. validateS3MultipartSemantics fails terminally with InvalidPart for parts with inherited part_number, etag, size_bytes, or aliases
  const partInhPartNum = Object.create({ part_number: 1 });
  partInhPartNum.etag = '"0123456789abcdef0123456789abcdef"';
  partInhPartNum.size_bytes = 5242880;
  assert.throws(() => validateS3MultipartSemantics({ parts: [partInhPartNum] }), /InvalidPart|inherited part_number prohibited/);

  const partInhPartNumAlias = Object.create({ PartNumber: 1 });
  partInhPartNumAlias.etag = '"0123456789abcdef0123456789abcdef"';
  partInhPartNumAlias.size_bytes = 5242880;
  assert.throws(() => validateS3MultipartSemantics({ parts: [partInhPartNumAlias] }), /InvalidPart|manifest structure is invalid/);

  const partInhEtag = Object.create({ etag: '"0123456789abcdef0123456789abcdef"' });
  partInhEtag.part_number = 1;
  partInhEtag.size_bytes = 5242880;
  assert.throws(() => validateS3MultipartSemantics({ parts: [partInhEtag] }), /InvalidPart|inherited etag prohibited/);

  const partInhEtagAlias = Object.create({ ETag: '"0123456789abcdef0123456789abcdef"' });
  partInhEtagAlias.part_number = 1;
  partInhEtagAlias.size_bytes = 5242880;
  assert.throws(() => validateS3MultipartSemantics({ parts: [partInhEtagAlias] }), /InvalidPart|manifest structure is invalid/);

  const partInhSizeBytes = Object.create({ size_bytes: 5242880 });
  partInhSizeBytes.part_number = 1;
  partInhSizeBytes.etag = '"0123456789abcdef0123456789abcdef"';
  assert.throws(() => validateS3MultipartSemantics({ parts: [partInhSizeBytes] }), /InvalidPart|inherited size_bytes prohibited/);

  const partInhSizeBytesAlias = Object.create({ SizeBytes: 5242880 });
  partInhSizeBytesAlias.part_number = 1;
  partInhSizeBytesAlias.etag = '"0123456789abcdef0123456789abcdef"';
  assert.throws(() => validateS3MultipartSemantics({ parts: [partInhSizeBytesAlias] }), /InvalidPart|manifest structure is invalid/);

  const partInhSizeAlias = Object.create({ size: 5242880 });
  partInhSizeAlias.part_number = 1;
  partInhSizeAlias.etag = '"0123456789abcdef0123456789abcdef"';
  assert.throws(() => validateS3MultipartSemantics({ parts: [partInhSizeAlias] }), /InvalidPart|manifest structure is invalid/);

  // 2. dispatchS3CompleteMultipartUpload with inherited parts in manifest fails closed terminally to InvalidPart
  for (const badPart of [partInhPartNum, partInhPartNumAlias, partInhEtag, partInhEtagAlias, partInhSizeBytes, partInhSizeBytesAlias, partInhSizeAlias]) {
    const res = dispatchS3CompleteMultipartUpload({ parts: [badPart] }, validStoredParts);
    assert.equal(res.http_status, 400, 'dispatchS3CompleteMultipartUpload with inherited manifest part must return HTTP 400');
    assert.equal(res.error_code, 'InvalidPart', 'dispatchS3CompleteMultipartUpload with inherited manifest part must fail closed to InvalidPart');
    assert.equal(res.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  }

  // 3. dispatchS3CompleteMultipartUpload with inherited stored parts (Array, Map, Object) fails closed terminally to InvalidPart
  for (const badPart of [partInhPartNum, partInhPartNumAlias, partInhEtag, partInhEtagAlias, partInhSizeBytes, partInhSizeBytesAlias, partInhSizeAlias]) {
    // Array stored parts
    const resArr = dispatchS3CompleteMultipartUpload(validManifest, [badPart]);
    assert.equal(resArr.http_status, 400);
    assert.equal(resArr.error_code, 'InvalidPart');
    assert.equal(resArr.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

    // Map stored parts
    const resMap = dispatchS3CompleteMultipartUpload(validManifest, new Map([[1, badPart]]));
    assert.equal(resMap.http_status, 400);
    assert.equal(resMap.error_code, 'InvalidPart');
    assert.equal(resMap.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

    // Object stored parts
    const resObj = dispatchS3CompleteMultipartUpload(validManifest, { 1: badPart });
    assert.equal(resObj.http_status, 400);
    assert.equal(resObj.error_code, 'InvalidPart');
    assert.equal(resObj.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  }

  // 4. Object.prototype pollution with part_number, etag, and size_bytes: empty part {} fails closed to InvalidPart
  for (const k of ['part_number', 'PartNumber', 'etag', 'ETag', 'size_bytes', 'SizeBytes', 'size']) {
    try {
      Object.prototype[k] = (k === 'etag' || k === 'ETag') ? '"0123456789abcdef0123456789abcdef"' : 1;

      // An empty part object relying on Object.prototype must fail closed to InvalidPart
      const emptyPart = {};
      assert.throws(() => validateS3MultipartSemantics({ parts: [emptyPart] }));

      const resComplete = dispatchS3CompleteMultipartUpload({ parts: [emptyPart] }, validStoredParts);
      assert.equal(resComplete.http_status, 400);
      assert.equal(resComplete.error_code, 'InvalidPart');

      const resStoredArr = dispatchS3CompleteMultipartUpload(validManifest, [emptyPart]);
      assert.equal(resStoredArr.http_status, 400);
      assert.equal(resStoredArr.error_code, 'InvalidPart');

      const resStoredMap = dispatchS3CompleteMultipartUpload(validManifest, new Map([[1, emptyPart]]));
      assert.equal(resStoredMap.http_status, 400);
      assert.equal(resStoredMap.error_code, 'InvalidPart');
    } finally {
      delete Object.prototype[k];
    }
  }
});

test('branch coverage: verifyPayloadSha256, verifyPayloadMd5, typed array helpers, and snapshot edge cases (OPEN-2 / OPEN-5)', () => {
  const buf = Buffer.from('TEST_PAYLOAD_BRANCH_COVERAGE_2026');
  const validSha = computePayloadSha256(buf);
  const validMd5 = computePayloadMd5(buf);

  // 1. verifyPayloadSha256 branches
  assert.equal(verifyPayloadSha256(buf, validSha), true);
  assert.equal(verifyPayloadSha256('string-payload', computePayloadSha256('string-payload')), true);
  assert.equal(verifyPayloadSha256(new Uint8Array(buf), validSha), true);
  assert.equal(verifyPayloadSha256({ payload: buf, 'x-amz-content-sha256': validSha }), true);
  assert.equal(verifyPayloadSha256({ body: buf, contentSha256Header: validSha }), true);
  assert.equal(verifyPayloadSha256({ payloadBytes: buf, sha256Header: validSha }), true);
  assert.throws(() => verifyPayloadSha256(new Proxy({}, {})), /MALFORMED_PAYLOAD_TYPE/);
  assert.throws(() => verifyPayloadSha256(12345, validSha), /MALFORMED_PAYLOAD_TYPE/);
  assert.throws(() => verifyPayloadSha256(buf, 'invalid-sha'), /MALFORMED_HEADER_SYNTAX/);
  assert.throws(() => verifyPayloadSha256(buf, '0'.repeat(64)), /PAYLOAD_SHA256_MISMATCH/);

  // 2. verifyPayloadMd5 branches
  assert.equal(verifyPayloadMd5(buf, validMd5), true);
  assert.equal(verifyPayloadMd5('string-payload', computePayloadMd5('string-payload')), true);
  assert.equal(verifyPayloadMd5(new Uint8Array(buf), validMd5), true);
  assert.equal(verifyPayloadMd5({ payload: buf, contentMd5Header: validMd5 }), true);
  assert.equal(verifyPayloadMd5({ body: buf, content_md5_header: validMd5 }), true);
  assert.equal(verifyPayloadMd5({ payloadBytes: buf, content_md5_declared: validMd5 }), true);
  assert.throws(() => verifyPayloadMd5(new Proxy({}, {})), /MALFORMED_PAYLOAD_TYPE/);
  assert.throws(() => verifyPayloadMd5(12345, validMd5), /MALFORMED_PAYLOAD_TYPE/);
  assert.throws(() => verifyPayloadMd5(buf, 'invalid-md5'), /MALFORMED_HEADER_SYNTAX/);
  assert.throws(() => verifyPayloadMd5(buf, Buffer.from('0123456789abcdef').toString('base64')), /PAYLOAD_DIGEST_MISMATCH/);

  // 3. TypedArray helper functions
  const u8 = new Uint8Array([1, 2, 3, 4]);
  assert.equal(getTypedArrayByteLength(u8), 4);
  assert.equal(getTypedArrayByteOffset(u8), 0);
  assert.equal(getTypedArrayByteLength({ byteLength: 10 }), 10);
  assert.equal(getTypedArrayByteOffset({ byteOffset: 2 }), 2);

  // 4. Exception catch branches in accessors / helpers with throwing proxy
  const throwingProxy = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error('trap error'); },
    getPrototypeOf() { throw new Error('trap error'); },
    ownKeys() { throw new Error('trap error'); }
  });
  assert.equal(hasOwnHeadersAccessors(throwingProxy), true);
  assert.equal(hasAnyAccessorsOrProxy(throwingProxy), true);
});

test('OPEN-2 regression: unobservable constructor reads, proxy fail-closed, and normalized multipart taxonomy', () => {
  // 1. isMalformedPayloadType eliminates payload.constructor reads
  const u8WithTrap = new Uint8Array([1, 2, 3, 4]);
  Object.defineProperty(u8WithTrap, 'constructor', {
    get() { throw new Error('CRITICAL: payload.constructor getter must NOT be called'); }
  });
  assert.equal(isMalformedPayloadType(u8WithTrap), false);

  const bufWithTrap = Buffer.from('CYBRIK_UNOBSERVABLE_CONSTRUCTOR_TEST');
  Object.defineProperty(bufWithTrap, 'constructor', {
    get() { throw new Error('CRITICAL: Buffer constructor getter must NOT be called'); }
  });
  assert.equal(isMalformedPayloadType(bufWithTrap), false);

  class SubclassUint8Array extends Uint8Array {}
  assert.equal(isMalformedPayloadType(new SubclassUint8Array(8)), true);
  assert.equal(isMalformedPayloadType(new Uint16Array(8)), true);
  assert.equal(isMalformedPayloadType(new Uint8ClampedArray(8)), true);
  assert.equal(isMalformedPayloadType(new Int8Array(8)), true);
  assert.equal(isMalformedPayloadType(Object.create(Uint8Array.prototype)), true);
  assert.equal(isMalformedPayloadType(new Proxy(new Uint8Array(8), {})), true);

  // 2. getOwn(obj, key) has proxy check as absolute first line with zero trap invocation
  let trapInvoked = false;
  const proxyTrapGuarded = new Proxy({ prop: 42 }, {
    get() { trapInvoked = true; throw new Error('trap get'); },
    getOwnPropertyDescriptor() { trapInvoked = true; throw new Error('trap desc'); },
    has() { trapInvoked = true; throw new Error('trap has'); },
    ownKeys() { trapInvoked = true; throw new Error('trap ownKeys'); }
  });
  assert.equal(getOwn(proxyTrapGuarded, 'prop'), undefined);
  assert.equal(trapInvoked, false, 'No proxy trap should be invoked by getOwn');

  // 3. dispatchS3PutObject and dispatchS3Error fail closed on proxy expected_error / error_condition
  const validPayload = Buffer.from('CYBRIK_PAYLOAD_TEST');
  const validSha = computePayloadSha256(validPayload);

  const putProxyExpErr = dispatchS3PutObject({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    expected_error: new Proxy({}, {})
  });
  assert.equal(putProxyExpErr.http_status, 400);
  assert.equal(putProxyExpErr.error_code, 'InvalidDigest');
  assert.equal(putProxyExpErr.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putProxyErrCond = dispatchS3PutObject({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    error_condition: new Proxy({}, {})
  });
  assert.equal(putProxyErrCond.http_status, 400);
  assert.equal(putProxyErrCond.error_code, 'InvalidDigest');
  assert.equal(putProxyErrCond.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errProxyExpErr = dispatchS3Error({
    expected_error: new Proxy({}, {})
  });
  assert.equal(errProxyExpErr.http_status, 400);
  assert.equal(errProxyExpErr.error_code, 'InvalidDigest');
  assert.equal(errProxyExpErr.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errProxyErrCond = dispatchS3Error({
    error_condition: new Proxy({}, {})
  });
  assert.equal(errProxyErrCond.http_status, 400);
  assert.equal(errProxyErrCond.error_code, 'InvalidDigest');
  assert.equal(errProxyErrCond.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 3.1 Zero-getter isolation and subclass checks on nested expected_error / error_condition
  let putNestedGetterInvoked = 0;
  const putNestedGetterObj = {
    get error_condition() {
      putNestedGetterInvoked++;
      return 'PAYLOAD_DIGEST_MISMATCH';
    },
    error_code: 'BadDigest',
  };
  const putGetterExpErrRes = dispatchS3PutObject({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    expected_error: putNestedGetterObj,
  });
  assert.equal(putGetterExpErrRes.http_status, 400);
  assert.equal(putGetterExpErrRes.error_code, 'InvalidDigest');
  assert.equal(putGetterExpErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(putNestedGetterInvoked, 0, 'Zero getter invocations on nested expected_error.error_condition in dispatchS3PutObject');

  let putDirectGetterInvoked = 0;
  const putDirectGetterReq = {
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    get error_condition() {
      putDirectGetterInvoked++;
      return 'PAYLOAD_DIGEST_MISMATCH';
    },
  };
  const putDirectGetterRes = dispatchS3PutObject(putDirectGetterReq);
  assert.equal(putDirectGetterRes.http_status, 400);
  assert.equal(putDirectGetterRes.error_code, 'InvalidDigest');
  assert.equal(putDirectGetterRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(putDirectGetterInvoked, 0, 'Zero getter invocations on direct req.error_condition in dispatchS3PutObject');

  let errNestedGetterInvoked = 0;
  const errNestedGetterObj = {
    get error_condition() {
      errNestedGetterInvoked++;
      return 'PAYLOAD_DIGEST_MISMATCH';
    },
    error_code: 'BadDigest',
  };
  const errGetterExpErrRes = dispatchS3Error({
    payloadBytes: validPayload,
    expected_error: errNestedGetterObj,
  });
  assert.equal(errGetterExpErrRes.http_status, 400);
  assert.equal(errGetterExpErrRes.error_code, 'InvalidDigest');
  assert.equal(errGetterExpErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(errNestedGetterInvoked, 0, 'Zero getter invocations on nested expected_error.error_condition in dispatchS3Error');

  let errDirectGetterInvoked = 0;
  const errDirectGetterReq = {
    get error_condition() {
      errDirectGetterInvoked++;
      return 'PAYLOAD_DIGEST_MISMATCH';
    },
  };
  const errDirectGetterRes = dispatchS3Error(errDirectGetterReq);
  assert.equal(errDirectGetterRes.http_status, 400);
  assert.equal(errDirectGetterRes.error_code, 'InvalidDigest');
  assert.equal(errDirectGetterRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(errDirectGetterInvoked, 0, 'Zero getter invocations on direct req.error_condition in dispatchS3Error');

  // Subclass checks
  class CustomErrorCondition extends String {}
  class CustomExpectedError {
    constructor() {
      this.error_code = 'BadDigest';
      this.error_condition = 'PAYLOAD_DIGEST_MISMATCH';
    }
  }

  const putSubclassExpErrRes = dispatchS3PutObject({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    expected_error: new CustomExpectedError(),
  });
  assert.equal(putSubclassExpErrRes.http_status, 400);
  assert.equal(putSubclassExpErrRes.error_code, 'InvalidDigest');
  assert.equal(putSubclassExpErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putSubclassErrCondRes = dispatchS3PutObject({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    error_condition: new CustomErrorCondition('PAYLOAD_DIGEST_MISMATCH'),
  });
  assert.equal(putSubclassErrCondRes.http_status, 400);
  assert.equal(putSubclassErrCondRes.error_code, 'InvalidDigest');
  assert.equal(putSubclassErrCondRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errSubclassExpErrRes = dispatchS3Error({
    payloadBytes: validPayload,
    expected_error: new CustomExpectedError(),
  });
  assert.equal(errSubclassExpErrRes.http_status, 400);
  assert.equal(errSubclassExpErrRes.error_code, 'InvalidDigest');
  assert.equal(errSubclassExpErrRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errSubclassErrCondRes = dispatchS3Error({
    error_condition: new CustomErrorCondition('PAYLOAD_DIGEST_MISMATCH'),
  });
  assert.equal(errSubclassErrCondRes.http_status, 400);
  assert.equal(errSubclassErrCondRes.error_code, 'InvalidDigest');
  assert.equal(errSubclassErrCondRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // Nested error_condition Proxy inside expected_error
  const nestedErrCondProxy = new Proxy({ toString() { return 'PAYLOAD_DIGEST_MISMATCH'; } }, {
    get() { throw new Error('trap on nested error_condition proxy'); }
  });
  const putNestedProxyCondRes = dispatchS3PutObject({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    expected_error: { error_code: 'BadDigest', error_condition: nestedErrCondProxy },
  });
  assert.equal(putNestedProxyCondRes.http_status, 400);
  assert.equal(putNestedProxyCondRes.error_code, 'InvalidDigest');
  assert.equal(putNestedProxyCondRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errNestedProxyCondRes = dispatchS3Error({
    expected_error: { error_code: 'BadDigest', error_condition: nestedErrCondProxy },
  });
  assert.equal(errNestedProxyCondRes.http_status, 400);
  assert.equal(errNestedProxyCondRes.error_code, 'InvalidDigest');
  assert.equal(errNestedProxyCondRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // Object reason / nested reason branches
  const putObjReasonRes = dispatchS3PutObject({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    reason: { not: 'string' },
  });
  assert.equal(putObjReasonRes.http_status, 400);
  assert.equal(putObjReasonRes.error_code, 'InvalidDigest');
  assert.equal(putObjReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errObjReasonRes = dispatchS3Error({
    reason: { not: 'string' },
  });
  assert.equal(errObjReasonRes.http_status, 400);
  assert.equal(errObjReasonRes.error_code, 'InvalidDigest');
  assert.equal(errObjReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putNestedObjReasonRes = dispatchS3PutObject({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    expected_error: { error_code: 'BadDigest', reason: { not: 'string' } },
  });
  assert.equal(putNestedObjReasonRes.http_status, 400);
  assert.equal(putNestedObjReasonRes.error_code, 'InvalidDigest');
  assert.equal(putNestedObjReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errNestedObjReasonRes = dispatchS3Error({
    expected_error: { error_code: 'BadDigest', reason: { not: 'string' } },
  });
  assert.equal(errNestedObjReasonRes.http_status, 400);
  assert.equal(errNestedObjReasonRes.error_code, 'InvalidDigest');
  assert.equal(errNestedObjReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putNestedGetterReasonRes = dispatchS3PutObject({
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    expected_error: { error_code: 'BadDigest', get reason() { throw new Error('trap'); } },
  });
  assert.equal(putNestedGetterReasonRes.http_status, 400);
  assert.equal(putNestedGetterReasonRes.error_code, 'InvalidDigest');
  assert.equal(putNestedGetterReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errNestedGetterReasonRes = dispatchS3Error({
    expected_error: { error_code: 'BadDigest', get reason() { throw new Error('trap'); } },
  });
  assert.equal(errNestedGetterReasonRes.http_status, 400);
  assert.equal(errNestedGetterReasonRes.error_code, 'InvalidDigest');
  assert.equal(errNestedGetterReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 4. validateS3MultipartSemantics normalized taxonomy and (InvalidPart) error enforcement
  const validEtag = '"0123456789abcdef0123456789abcdef"';

  // Missing part_number throws with (InvalidPart)
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ etag: validEtag, size_bytes: 5242880 }] }),
    /InvalidPart/
  );

  // Non-integer part_number throws with (InvalidPart)
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: '1', etag: validEtag, size_bytes: 5242880 }] }),
    /InvalidPart/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1.5, etag: validEtag, size_bytes: 5242880 }] }),
    /InvalidPart/
  );

  // Missing etag throws with (InvalidPart)
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, size_bytes: 5242880 }] }),
    /InvalidPart/
  );

  // Malformed etag (not 32-hex double-quoted) throws with (InvalidPart)
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '0123456789abcdef0123456789abcdef', size_bytes: 5242880 }] }),
    /InvalidPart/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '""', size_bytes: 5242880 }] }),
    /InvalidPart/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"nothex"', size_bytes: 5242880 }] }),
    /InvalidPart/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"0123456789abcdef"', size_bytes: 5242880 }] }),
    /InvalidPart/
  );

  // Malformed size_bytes (string, float, negative) throws with (InvalidPart)
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: validEtag, size_bytes: '5242880' }] }),
    /InvalidPart/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: validEtag, size_bytes: 5242880.5 }] }),
    /InvalidPart/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: validEtag, size_bytes: -1 }] }),
    /InvalidPart/
  );
});

test('adversarial regression: part missing part_number and string size_bytes fail closed terminally to InvalidPart (OPEN-2)', () => {
  const validStoredParts = [
    { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 },
    { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880 },
  ];

  const validManifest = {
    parts: [
      { part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880, sha256: 'a'.repeat(64) },
      { part_number: 2, etag: '"abcdef0123456789abcdef0123456789"', size_bytes: 5242880, sha256: 'b'.repeat(64) },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  // 1. validateS3MultipartSemantics: part missing part_number throws terminal InvalidPart
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }),
    /InvalidPart|missing valid part_number/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: undefined, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }),
    /InvalidPart|missing valid part_number/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: null, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }),
    /InvalidPart|missing valid part_number/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: '1', etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }),
    /InvalidPart|missing valid part_number/
  );

  // 2. validateS3MultipartSemantics: string or non-integer size_bytes throws terminal InvalidPart
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: '5242880' }] }),
    /InvalidPart|size .* must be a valid non-negative integer/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 'invalid_number' }] }),
    /InvalidPart|size .* must be a valid non-negative integer/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880.5 }] }),
    /InvalidPart|size .* must be a valid non-negative integer/
  );
  assert.throws(
    () => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }], total_size_bytes: '5242880' }),
    /InvalidPart|total_size_bytes/
  );

  // 3. dispatchS3CompleteMultipartUpload: part missing part_number returns HTTP 400 InvalidPart
  const resNoPartNum = dispatchS3CompleteMultipartUpload(
    { parts: [{ etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] },
    validStoredParts
  );
  assert.equal(resNoPartNum.http_status, 400);
  assert.equal(resNoPartNum.error_code, 'InvalidPart');
  assert.equal(resNoPartNum.reason, 'MissingPartNumber');

  const resNullPartNum = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: null, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] },
    validStoredParts
  );
  assert.equal(resNullPartNum.http_status, 400);
  assert.equal(resNullPartNum.error_code, 'InvalidPart');
  assert.equal(resNullPartNum.reason, 'MissingPartNumber');

  // 4. dispatchS3CompleteMultipartUpload: string or float size_bytes returns HTTP 400 InvalidPart
  const resStrSize = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: '5242880' }] },
    validStoredParts
  );
  assert.equal(resStrSize.http_status, 400);
  assert.equal(resStrSize.error_code, 'InvalidPart');
  assert.equal(resStrSize.reason, 'InvalidPartSize');

  const resFloatSize = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880.5 }] },
    validStoredParts
  );
  assert.equal(resFloatSize.http_status, 400);
  assert.equal(resFloatSize.error_code, 'InvalidPart');
  assert.equal(resFloatSize.reason, 'InvalidPartSize');

  // Stored parts with string or float size_bytes returns HTTP 400 InvalidPart
  const resStoredStrSize = dispatchS3CompleteMultipartUpload(
    validManifest,
    [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: '5242880' }]
  );
  assert.equal(resStoredStrSize.http_status, 400);
  assert.equal(resStoredStrSize.error_code, 'InvalidPart');
  assert.equal(resStoredStrSize.reason, 'InvalidPartSize');

  const resStoredFloatSize = dispatchS3CompleteMultipartUpload(
    validManifest,
    [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880.5 }]
  );
  assert.equal(resStoredFloatSize.http_status, 400);
  assert.equal(resStoredFloatSize.error_code, 'InvalidPart');
  assert.equal(resStoredFloatSize.reason, 'InvalidPartSize');

  // 5. Ajv JSON schema validation: multipartPart requires integer part_number and integer size_bytes
  const badPartNoNum = {
    ...validManifest,
    parts: [{ etag: '"0123456789abcdef0123456789abcdef"', sha256: 'a'.repeat(64), size_bytes: 5242880 }],
  };
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badPartNoNum));
  assert.ok(ajv.errors.some(e => e.keyword === 'required' && e.params.missingProperty === 'part_number'));

  const badPartStrSize = {
    ...validManifest,
    parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', sha256: 'a'.repeat(64), size_bytes: '5242880' }],
  };
  assert.ok(!ajv.validate(MULTIPART_DEF_ID, badPartStrSize));
  assert.ok(ajv.errors.some(e => e.keyword === 'type' && e.instancePath === '/parts/0/size_bytes'));
});

test('adversarial regression: nested proxy in platform digest, offline fingerprint, and 19-op profile storage evidence fail closed (OPEN-2)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const handshakeSamplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  const handshakeSample = JSON.parse(readFileSync(handshakeSamplePath, 'utf8'));

  const offlineManifestPath = join(ROOT, 'contracts/examples/platform/sample-offline-bundle-manifest.json');
  const offlineManifestSample = JSON.parse(readFileSync(offlineManifestPath, 'utf8'));

  // 1. Nested proxy in platform digest fails closed terminally in validatePlatformSemantics
  const nestedDigestHandshake = JSON.parse(JSON.stringify(handshakeSample));
  nestedDigestHandshake.target_profile_digest = new Proxy(new String(nestedDigestHandshake.target_profile_digest), {});
  assert.throws(
    () => validatePlatformSemantics(nestedDigestHandshake, pcnSchemaId),
    /Semantic error/
  );

  const nestedAdvDigestHandshake = JSON.parse(JSON.stringify(handshakeSample));
  nestedAdvDigestHandshake.advertisement_response.target_profile_digest = new Proxy(
    new String(nestedAdvDigestHandshake.advertisement_response.target_profile_digest),
    {}
  );
  assert.throws(
    () => validatePlatformSemantics(nestedAdvDigestHandshake, pcnSchemaId),
    /Semantic error/
  );

  const nestedAdvProxyHandshake = JSON.parse(JSON.stringify(handshakeSample));
  nestedAdvProxyHandshake.advertisement_response = new Proxy(nestedAdvProxyHandshake.advertisement_response, {});
  assert.throws(
    () => validatePlatformSemantics(nestedAdvProxyHandshake, pcnSchemaId),
    /Semantic error/
  );

  // 2. Nested proxy in offline fingerprint fails closed terminally in validateOfflineInstallSemantics
  const nestedRootFpManifest = JSON.parse(JSON.stringify(offlineManifestSample));
  nestedRootFpManifest.operator_trust_root.public_key_fingerprint = new Proxy(
    new String(nestedRootFpManifest.operator_trust_root.public_key_fingerprint),
    {}
  );
  assert.throws(
    () => validateOfflineInstallSemantics(nestedRootFpManifest),
    /Semantic error/
  );

  const nestedSigFpManifest = JSON.parse(JSON.stringify(offlineManifestSample));
  nestedSigFpManifest.detached_signature.key_fingerprint = new Proxy(
    new String(nestedSigFpManifest.detached_signature.key_fingerprint),
    {}
  );
  assert.throws(
    () => validateOfflineInstallSemantics(nestedSigFpManifest),
    /Semantic error/
  );

  const nestedTrustRootManifest = JSON.parse(JSON.stringify(offlineManifestSample));
  nestedTrustRootManifest.operator_trust_root = new Proxy(nestedTrustRootManifest.operator_trust_root, {});
  assert.throws(
    () => validateOfflineInstallSemantics(nestedTrustRootManifest),
    /Semantic error/
  );

  const nestedDetachedSigManifest = JSON.parse(JSON.stringify(offlineManifestSample));
  nestedDetachedSigManifest.detached_signature = new Proxy(nestedDetachedSigManifest.detached_signature, {});
  assert.throws(
    () => validateOfflineInstallSemantics(nestedDetachedSigManifest),
    /Semantic error/
  );

  // 3. 19-op profile without general storage evidence fails closed in validatePlatformSemantics
  const noGenStorageHandshake = JSON.parse(JSON.stringify(handshakeSample));
  const storageCap = noGenStorageHandshake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storageCap, 'storage capability must exist in sample');
  // Strip general storage evidence, keeping only canonical Object Lock evidence
  storageCap.evidence_references = ['urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'];
  assert.throws(
    () => validatePlatformSemantics(noGenStorageHandshake, pcnSchemaId),
    /19-op storage profile advertisement lacks general storage conformance evidence/
  );

  // Referenced general storage evidence missing from conformance_evidence array fails closed
  const missingGenEvidenceHandshake = JSON.parse(JSON.stringify(handshakeSample));
  missingGenEvidenceHandshake.advertisement_response.conformance_evidence = missingGenEvidenceHandshake.advertisement_response.conformance_evidence.filter(
    e => e.test_identifier !== 'urn:cybrik:evidence:storage:s3-19-ops:v1'
  );
  assert.throws(
    () => validatePlatformSemantics(missingGenEvidenceHandshake, pcnSchemaId),
    /evidence_reference 'urn:cybrik:evidence:storage:s3-19-ops:v1' not found in conformance_evidence/
  );

  // Referenced general storage evidence with non-passing status fails closed
  const failGenEvidenceHandshake = JSON.parse(JSON.stringify(handshakeSample));
  const genEv = failGenEvidenceHandshake.advertisement_response.conformance_evidence.find(
    e => e.test_identifier === 'urn:cybrik:evidence:storage:s3-19-ops:v1'
  );
  if (genEv) {
    genEv.status = 'FAIL';
  }
  assert.throws(
    () => validatePlatformSemantics(failGenEvidenceHandshake, pcnSchemaId),
    /has non-passing status 'FAIL'/
  );
});

test('adversarial regression: enforce native typed-array prototypes and harden plain snapshotting (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';

  // 1. hasAnyAccessorsOrProxy exact prototype and proxy checks
  assert.equal(hasAnyAccessorsOrProxy(Buffer.from('hello')), false);
  assert.equal(hasAnyAccessorsOrProxy(new Uint8Array([1, 2, 3])), false);
  assert.equal(hasAnyAccessorsOrProxy(new Proxy(Buffer.from('hello'), {})), true);
  assert.equal(hasAnyAccessorsOrProxy(new Proxy(new Uint8Array([1, 2, 3]), {})), true);

  class CustomUint8ArraySubclass extends Uint8Array {}
  assert.equal(hasAnyAccessorsOrProxy(new CustomUint8ArraySubclass(4)), true);

  class CustomBufferSubclass extends Uint8Array {}
  const fakeBuf = Object.setPrototypeOf(Buffer.from('test'), CustomBufferSubclass.prototype);
  assert.equal(hasAnyAccessorsOrProxy(fakeBuf), true);

  assert.equal(hasAnyAccessorsOrProxy(new Int8Array(4)), true);
  assert.equal(hasAnyAccessorsOrProxy(new Uint16Array(4)), true);
  assert.equal(hasAnyAccessorsOrProxy(new Int32Array(4)), true);
  assert.equal(hasAnyAccessorsOrProxy(new Float32Array(4)), true);
  assert.equal(hasAnyAccessorsOrProxy(new Float64Array(4)), true);
  assert.equal(hasAnyAccessorsOrProxy(new DataView(new ArrayBuffer(8))), true);

  // Own accessor descriptors on Uint8Array / Buffer
  const u8WithPropGetter = new Uint8Array([1, 2]);
  Object.defineProperty(u8WithPropGetter, 'customProp', { get() { return 'evil'; } });
  assert.equal(hasAnyAccessorsOrProxy(u8WithPropGetter), true);

  const u8WithPropSetter = new Uint8Array([1, 2]);
  Object.defineProperty(u8WithPropSetter, 'customProp', { set(v) {} });
  assert.equal(hasAnyAccessorsOrProxy(u8WithPropSetter), true);

  const u8WithSymbolGetter = new Uint8Array([1, 2]);
  Object.defineProperty(u8WithSymbolGetter, Symbol('sym'), { get() { return 'evil'; } });
  assert.equal(hasAnyAccessorsOrProxy(u8WithSymbolGetter), true);

  // 2. createSafePlainSnapshot copy semantics & fail-closed enforcement
  const cleanBuf = Buffer.from('payload');
  const snapCleanBuf = createSafePlainSnapshot(cleanBuf);
  assert.deepEqual(snapCleanBuf, cleanBuf);
  assert.notEqual(snapCleanBuf, cleanBuf);

  const cleanU8 = new Uint8Array([4, 5, 6]);
  const snapCleanU8 = createSafePlainSnapshot(cleanU8);
  assert.deepEqual(snapCleanU8, cleanU8);
  assert.notEqual(snapCleanU8, cleanU8);

  const complexDoc = {
    bufferField: Buffer.from('data'),
    u8Field: new Uint8Array([1, 2, 3]),
    nested: {
      buf: Buffer.from('nested'),
      arr: [new Uint8Array([7, 8])]
    }
  };
  const snapComplex = createSafePlainSnapshot(complexDoc);
  assert.deepEqual(snapComplex.bufferField, complexDoc.bufferField);
  assert.notEqual(snapComplex.bufferField, complexDoc.bufferField);
  assert.deepEqual(snapComplex.u8Field, complexDoc.u8Field);
  assert.notEqual(snapComplex.u8Field, complexDoc.u8Field);
  assert.deepEqual(snapComplex.nested.buf, complexDoc.nested.buf);
  assert.notEqual(snapComplex.nested.buf, complexDoc.nested.buf);
  assert.deepEqual(snapComplex.nested.arr[0], complexDoc.nested.arr[0]);
  assert.notEqual(snapComplex.nested.arr[0], complexDoc.nested.arr[0]);

  assert.throws(
    () => createSafePlainSnapshot(new CustomUint8ArraySubclass(4)),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot(new Proxy(new Uint8Array([1]), {})),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot(u8WithPropGetter),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot({ nested: new CustomUint8ArraySubclass(4) }),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot([new Proxy(Buffer.from('a'), {})]),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );

  // 3. validatePlatformSemantics & validateOfflineInstallSemantics fail-closed on typed-array subclass / proxy
  assert.throws(
    () => validatePlatformSemantics(new CustomUint8ArraySubclass(4), pcnSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => validatePlatformSemantics(new Proxy(Buffer.from('x'), {}), pcnSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => validateOfflineInstallSemantics(new CustomUint8ArraySubclass(4)),
    /Semantic error: accessor properties or Proxy objects are prohibited in offline install manifest/
  );
  assert.throws(
    () => validateOfflineInstallSemantics(new Proxy(Buffer.from('x'), {})),
    /Semantic error: accessor properties or Proxy objects are prohibited in offline install manifest/
  );

  // Nested typed array subclass / proxy in validatePlatformSemantics and validateOfflineInstallSemantics
  const sampleDoc = {
    advertisement_response: {
      advertised_capabilities: [],
      conformance_evidence: [],
      payload: new CustomUint8ArraySubclass(4)
    }
  };
  assert.throws(
    () => validatePlatformSemantics(sampleDoc, pcnSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );

  const sampleOffline = {
    schema_version: '0.1.0',
    package_id: 'pkg-1',
    package_version: '1.0.0',
    artifacts: [{ path: 'app.bin', digest: 'a'.repeat(64), payload: new Proxy(new Uint8Array(4), {}) }]
  };
  assert.throws(
    () => validateOfflineInstallSemantics(sampleOffline),
    /Semantic error: accessor properties or Proxy objects are prohibited in offline install manifest/
  );
});

test('adversarial regression: nested expected_error / error_condition getters are never invoked in dispatchS3PutObject and dispatchS3Error (OPEN-2)', () => {
  const validPayload = Buffer.from('CYBRIK_NESTED_ERROR_GETTER_TEST_PAYLOAD_2026');
  const validSha = computePayloadSha256(validPayload);
  const validMd5 = computePayloadMd5(validPayload);

  // 1. Throwing getter on expected_error.error_condition
  let expCondGetterInvoked = false;
  const expCondThrowingObj = {
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    contentMd5Header: validMd5,
    expected_error: {
      get error_condition() {
        expCondGetterInvoked = true;
        throw new Error('Explosive expected_error.error_condition getter invoked!');
      },
    },
  };

  // dispatchS3PutObject with throwing expected_error.error_condition
  const putExpCondRes = dispatchS3PutObject(expCondThrowingObj);
  assert.equal(putExpCondRes.http_status, 400);
  assert.equal(putExpCondRes.error_code, 'InvalidDigest');
  assert.equal(putExpCondRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(expCondGetterInvoked, false, 'expected_error.error_condition getter must NOT be invoked by dispatchS3PutObject');

  // dispatchS3Error with throwing expected_error.error_condition
  const errExpCondRes = dispatchS3Error(expCondThrowingObj);
  assert.equal(errExpCondRes.http_status, 400);
  assert.equal(errExpCondRes.error_code, 'InvalidDigest');
  assert.equal(errExpCondRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(expCondGetterInvoked, false, 'expected_error.error_condition getter must NOT be invoked by dispatchS3Error');

  // 2. Throwing getter on expected_error.reason
  let expReasonGetterInvoked = false;
  const expReasonThrowingObj = {
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    contentMd5Header: validMd5,
    expected_error: {
      get reason() {
        expReasonGetterInvoked = true;
        throw new Error('Explosive expected_error.reason getter invoked!');
      },
    },
  };

  const putExpReasonRes = dispatchS3PutObject(expReasonThrowingObj);
  assert.equal(putExpReasonRes.http_status, 400);
  assert.equal(putExpReasonRes.error_code, 'InvalidDigest');
  assert.equal(putExpReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(expReasonGetterInvoked, false, 'expected_error.reason getter must NOT be invoked by dispatchS3PutObject');

  const errExpReasonRes = dispatchS3Error(expReasonThrowingObj);
  assert.equal(errExpReasonRes.http_status, 400);
  assert.equal(errExpReasonRes.error_code, 'InvalidDigest');
  assert.equal(errExpReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(expReasonGetterInvoked, false, 'expected_error.reason getter must NOT be invoked by dispatchS3Error');

  // 3. Throwing getter on expected_error.code
  let expCodeGetterInvoked = false;
  const expCodeThrowingObj = {
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    contentMd5Header: validMd5,
    expected_error: {
      get code() {
        expCodeGetterInvoked = true;
        throw new Error('Explosive expected_error.code getter invoked!');
      },
    },
  };

  const putExpCodeRes = dispatchS3PutObject(expCodeThrowingObj);
  assert.equal(putExpCodeRes.http_status, 400);
  assert.equal(putExpCodeRes.error_code, 'InvalidDigest');
  assert.equal(putExpCodeRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(expCodeGetterInvoked, false, 'expected_error.code getter must NOT be invoked by dispatchS3PutObject');

  const errExpCodeRes = dispatchS3Error(expCodeThrowingObj);
  assert.equal(errExpCodeRes.http_status, 400);
  assert.equal(errExpCodeRes.error_code, 'InvalidDigest');
  assert.equal(errExpCodeRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(expCodeGetterInvoked, false, 'expected_error.code getter must NOT be invoked by dispatchS3Error');

  // 4. Throwing getter on direct error_condition
  let directCondGetterInvoked = false;
  const directCondThrowingObj = {
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    contentMd5Header: validMd5,
    get error_condition() {
      directCondGetterInvoked = true;
      throw new Error('Explosive direct error_condition getter invoked!');
    },
  };

  const putDirectCondRes = dispatchS3PutObject(directCondThrowingObj);
  assert.equal(putDirectCondRes.http_status, 400);
  assert.equal(putDirectCondRes.error_code, 'InvalidDigest');
  assert.equal(putDirectCondRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(directCondGetterInvoked, false, 'direct error_condition getter must NOT be invoked by dispatchS3PutObject');

  const errDirectCondRes = dispatchS3Error(directCondThrowingObj);
  assert.equal(errDirectCondRes.http_status, 400);
  assert.equal(errDirectCondRes.error_code, 'InvalidDigest');
  assert.equal(errDirectCondRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(directCondGetterInvoked, false, 'direct error_condition getter must NOT be invoked by dispatchS3Error');

  // 5. Throwing getter on direct reason
  let directReasonGetterInvoked = false;
  const directReasonThrowingObj = {
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    contentMd5Header: validMd5,
    get reason() {
      directReasonGetterInvoked = true;
      throw new Error('Explosive direct reason getter invoked!');
    },
  };

  const putDirectReasonRes = dispatchS3PutObject(directReasonThrowingObj);
  assert.equal(putDirectReasonRes.http_status, 400);
  assert.equal(putDirectReasonRes.error_code, 'InvalidDigest');
  assert.equal(putDirectReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(directReasonGetterInvoked, false, 'direct reason getter must NOT be invoked by dispatchS3PutObject');

  const errDirectReasonRes = dispatchS3Error(directReasonThrowingObj);
  assert.equal(errDirectReasonRes.http_status, 400);
  assert.equal(errDirectReasonRes.error_code, 'InvalidDigest');
  assert.equal(errDirectReasonRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(directReasonGetterInvoked, false, 'direct reason getter must NOT be invoked by dispatchS3Error');

  // 6. Deep nested error condition with nested getters
  let deepCodeGetterInvoked = false;
  let deepReasonGetterInvoked = false;
  const deepThrowingObj = {
    payloadBytes: validPayload,
    'x-amz-content-sha256': validSha,
    contentMd5Header: validMd5,
    expected_error: {
      error_condition: {
        get code() {
          deepCodeGetterInvoked = true;
          throw new Error('Explosive deep code getter invoked!');
        },
        get reason() {
          deepReasonGetterInvoked = true;
          throw new Error('Explosive deep reason getter invoked!');
        },
      },
    },
  };

  const putDeepRes = dispatchS3PutObject(deepThrowingObj);
  assert.equal(putDeepRes.http_status, 400);
  assert.equal(putDeepRes.error_code, 'InvalidDigest');
  assert.equal(putDeepRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(deepCodeGetterInvoked, false, 'deep code getter must NOT be invoked by dispatchS3PutObject');
  assert.equal(deepReasonGetterInvoked, false, 'deep reason getter must NOT be invoked by dispatchS3PutObject');

  const errDeepRes = dispatchS3Error(deepThrowingObj);
  assert.equal(errDeepRes.http_status, 400);
  assert.equal(errDeepRes.error_code, 'InvalidDigest');
  assert.equal(errDeepRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(deepCodeGetterInvoked, false, 'deep code getter must NOT be invoked by dispatchS3Error');
  assert.equal(deepReasonGetterInvoked, false, 'deep reason getter must NOT be invoked by dispatchS3Error');
});

test('adversarial regression: TypedArray and Buffer subclasses fail closed terminally across createSafePlainSnapshot, validatePlatformSemantics, and validateOfflineInstallSemantics (OPEN-2 / OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';

  // Define TypedArray and Buffer subclasses
  class CustomUint8ArraySubclass extends Uint8Array {}
  class CustomBufferSubclass extends Uint8Array {}
  Object.setPrototypeOf(CustomBufferSubclass.prototype, Buffer.prototype);
  class CustomFloat64ArraySubclass extends Float64Array {}
  class CustomInt32ArraySubclass extends Int32Array {}

  const u8SubInstance = new CustomUint8ArraySubclass(Buffer.from('CYBRIK_SUBCLASS_PAYLOAD_2026'));
  const bufSubInstance = Object.setPrototypeOf(Buffer.from('CYBRIK_BUFFER_SUBCLASS_PAYLOAD_2026'), CustomBufferSubclass.prototype);
  const f64SubInstance = new CustomFloat64ArraySubclass(8);
  const i32SubInstance = new CustomInt32ArraySubclass(8);

  const testSubclasses = [
    { name: 'CustomUint8ArraySubclass', instance: u8SubInstance },
    { name: 'CustomBufferSubclass', instance: bufSubInstance },
    { name: 'CustomFloat64ArraySubclass', instance: f64SubInstance },
    { name: 'CustomInt32ArraySubclass', instance: i32SubInstance },
  ];

  for (const { name, instance } of testSubclasses) {
    // 1. Direct subclass passed to createSafePlainSnapshot throws Semantic error
    assert.throws(
      () => createSafePlainSnapshot(instance),
      /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
      `createSafePlainSnapshot must throw on direct ${name}`
    );

    // 2. Nested subclass inside plain object passed to createSafePlainSnapshot throws
    assert.throws(
      () => createSafePlainSnapshot({ nested_payload: instance }),
      /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
      `createSafePlainSnapshot must throw on nested ${name}`
    );

    // 3. Nested subclass inside array passed to createSafePlainSnapshot throws
    assert.throws(
      () => createSafePlainSnapshot([1, 2, instance]),
      /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
      `createSafePlainSnapshot must throw on array item ${name}`
    );

    // 4. Direct subclass passed to validatePlatformSemantics throws
    assert.throws(
      () => validatePlatformSemantics(instance, pcnSchemaId),
      /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
      `validatePlatformSemantics must throw on direct ${name}`
    );

    // 5. Direct subclass passed to validateOfflineInstallSemantics throws
    assert.throws(
      () => validateOfflineInstallSemantics(instance),
      /Semantic error: accessor properties or Proxy objects are prohibited in offline install manifest/,
      `validateOfflineInstallSemantics must throw on direct ${name}`
    );
  }

  // 6. Platform contract handshake with nested TypedArray / Buffer subclass in payload fails closed
  const validHandshake = {
    advertisement_response: {
      protocol_version: '0.1.0',
      advertised_capabilities: [
        {
          slot_id: 'storage',
          capability_name: 'storage_object_lock',
          conformance_profile: 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json#/$defs/storageConformanceProfile',
          target_profile_digest: 'a'.repeat(64),
          evidence_references: [
            'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations',
            'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock',
          ],
        },
      ],
      conformance_evidence: [
        {
          test_identifier: 'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations',
          status: 'PASS',
          evidence_hash: 'a'.repeat(64),
          version_id: 'v1.0.0',
        },
        {
          test_identifier: 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock',
          status: 'PASS',
          evidence_hash: 'b'.repeat(64),
          version_id: 'v1.0.0',
        },
      ],
    },
  };

  const handshakeWithSubclass = JSON.parse(JSON.stringify(validHandshake));
  handshakeWithSubclass.advertisement_response.raw_bytes = u8SubInstance;

  assert.throws(
    () => validatePlatformSemantics(handshakeWithSubclass, pcnSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'validatePlatformSemantics must reject handshake with nested Uint8Array subclass'
  );

  const handshakeWithBufSubclass = JSON.parse(JSON.stringify(validHandshake));
  handshakeWithBufSubclass.advertisement_response.raw_bytes = bufSubInstance;

  assert.throws(
    () => validatePlatformSemantics(handshakeWithBufSubclass, pcnSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'validatePlatformSemantics must reject handshake with nested Buffer subclass'
  );

  // 7. Offline install manifest with nested TypedArray / Buffer subclass in payload fails closed
  const validOfflineManifest = {
    manifest_version: '0.1.0',
    package_name: 'cybrik-core-platform',
    package_version: '1.0.0',
    artifacts: [
      {
        path: 'bin/cybrik-engine',
        sha256: 'a'.repeat(64),
        size_bytes: 1048576,
      },
    ],
    operator_trust_root: {
      key_id: 'op-key-001',
      public_key_fingerprint: 'fp-sha256-abcdef0123456789',
    },
    detached_signature: {
      signature_algorithm: 'ed25519',
      key_fingerprint: 'fp-sha256-abcdef0123456789',
      signature_bytes_base64: Buffer.from('sig').toString('base64'),
    },
  };

  const offlineWithSubclass = JSON.parse(JSON.stringify(validOfflineManifest));
  offlineWithSubclass.custom_data = u8SubInstance;

  assert.throws(
    () => validateOfflineInstallSemantics(offlineWithSubclass),
    /Semantic error: accessor properties or Proxy objects are prohibited in offline install manifest/,
    'validateOfflineInstallSemantics must reject offline manifest with nested Uint8Array subclass'
  );

  const offlineWithBufSubclass = JSON.parse(JSON.stringify(validOfflineManifest));
  offlineWithBufSubclass.custom_data = bufSubInstance;

  assert.throws(
    () => validateOfflineInstallSemantics(offlineWithBufSubclass),
    /Semantic error: accessor properties or Proxy objects are prohibited in offline install manifest/,
    'validateOfflineInstallSemantics must reject offline manifest with nested Buffer subclass'
  );
});

test('adversarial regression: pure native Uint8Array / Buffer safely cloned in createSafePlainSnapshot without throwing, while subclasses fail closed (OPEN-2 / OPEN-5)', () => {
  // 1. Pure native Buffer safely cloned and preserved in createSafePlainSnapshot
  const pureBuf = Buffer.from('CYBRIK_PURE_NATIVE_BUFFER_DATA_2026');
  const snapPureBuf = createSafePlainSnapshot(pureBuf);
  assert.deepEqual(snapPureBuf, pureBuf);
  assert.equal(isPureBufferOrUint8Array(pureBuf), true);

  const objWithBuf = {
    bufferField: Buffer.from('payload_bytes'),
    nested: {
      innerBuffer: Buffer.from('inner_bytes'),
    },
    list: [Buffer.from('item_0'), Buffer.from('item_1')],
  };
  const snapObjWithBuf = createSafePlainSnapshot(objWithBuf);
  assert.deepEqual(snapObjWithBuf.bufferField, objWithBuf.bufferField);
  assert.deepEqual(snapObjWithBuf.nested.innerBuffer, objWithBuf.nested.innerBuffer);
  assert.deepEqual(snapObjWithBuf.list[0], objWithBuf.list[0]);
  assert.deepEqual(snapObjWithBuf.list[1], objWithBuf.list[1]);

  // 2. Pure native Uint8Array safely cloned and preserved in createSafePlainSnapshot
  const pureU8 = new Uint8Array([10, 20, 30, 40, 50]);
  const snapPureU8 = createSafePlainSnapshot(pureU8);
  assert.deepEqual(snapPureU8, pureU8);
  assert.equal(isPureBufferOrUint8Array(pureU8), true);

  const objWithU8 = {
    u8Field: new Uint8Array([1, 2, 3]),
    nested: {
      innerU8: new Uint8Array([4, 5, 6]),
    },
    list: [new Uint8Array([7]), new Uint8Array([8, 9])],
  };
  const snapObjWithU8 = createSafePlainSnapshot(objWithU8);
  assert.deepEqual(snapObjWithU8.u8Field, objWithU8.u8Field);
  assert.deepEqual(snapObjWithU8.nested.innerU8, objWithU8.nested.innerU8);
  assert.deepEqual(snapObjWithU8.list[0], objWithU8.list[0]);
  assert.deepEqual(snapObjWithU8.list[1], objWithU8.list[1]);

  // 3. Subclasses of Uint8Array fail closed terminally in createSafePlainSnapshot
  class SubUint8Array extends Uint8Array {}
  const subU8 = new SubUint8Array([1, 2, 3]);
  assert.equal(isPureBufferOrUint8Array(subU8), false);
  assert.throws(
    () => createSafePlainSnapshot(subU8),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot({ payload: subU8 }),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot([subU8]),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot({ nested: { items: [subU8] } }),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );

  // 4. Subclasses of Buffer fail closed terminally in createSafePlainSnapshot
  class SubBuffer extends Buffer {}
  const subBuf = Object.setPrototypeOf(Buffer.from('sub_buffer_payload'), SubBuffer.prototype);
  assert.equal(isPureBufferOrUint8Array(subBuf), false);
  assert.throws(
    () => createSafePlainSnapshot(subBuf),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot({ payload: subBuf }),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot([subBuf]),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );

  // 5. Getter-bearing subclasses fail closed without invoking getters
  let evilU8GetterCalled = false;
  class EvilUint8Array extends Uint8Array {
    get evilProperty() {
      evilU8GetterCalled = true;
      return 42;
    }
  }
  const evilU8 = new EvilUint8Array([100]);
  assert.throws(
    () => createSafePlainSnapshot(evilU8),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.equal(evilU8GetterCalled, false, 'Evil Uint8Array getter must not be invoked');
  assert.throws(
    () => createSafePlainSnapshot({ bad: evilU8 }),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.equal(evilU8GetterCalled, false, 'Evil Uint8Array getter must not be invoked on nested object');

  // 6. Non-Uint8Array TypedArrays, DataViews, and ArrayBuffers fail closed
  const views = [
    new Uint16Array([1, 2]),
    new Int8Array([1, 2]),
    new Int16Array([1, 2]),
    new Int32Array([1, 2]),
    new Uint32Array([1, 2]),
    new Float32Array([1.0]),
    new Float64Array([1.0]),
    new BigInt64Array([1n]),
    new BigUint64Array([1n]),
    new DataView(new ArrayBuffer(8)),
  ];
  for (const view of views) {
    assert.equal(isPureBufferOrUint8Array(view), false);
    assert.throws(
      () => createSafePlainSnapshot(view),
      /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
    );
    assert.throws(
      () => createSafePlainSnapshot({ viewField: view }),
      /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
    );
    assert.throws(
      () => createSafePlainSnapshot([view]),
      /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
    );
  }

  // 7. isPureBufferOrUint8Array comprehensive edge cases
  assert.equal(isPureBufferOrUint8Array(null), false);
  assert.equal(isPureBufferOrUint8Array(undefined), false);
  assert.equal(isPureBufferOrUint8Array(123), false);
  assert.equal(isPureBufferOrUint8Array('string'), false);
  assert.equal(isPureBufferOrUint8Array(true), false);
  assert.equal(isPureBufferOrUint8Array(Symbol('sym')), false);
  assert.equal(isPureBufferOrUint8Array({}), false);
  assert.equal(isPureBufferOrUint8Array([]), false);
  assert.equal(isPureBufferOrUint8Array(new Proxy(Buffer.from('proxy'), {})), false);
  assert.equal(isPureBufferOrUint8Array(new Proxy(new Uint8Array([1]), {})), false);
});

test('adversarial regression: comprehensive edge cases across dispatchS3PutObject, dispatchS3Error, validatePlatformSemantics, validateOfflineInstallSemantics (OPEN-2 / OPEN-5)', () => {
  const payloadStr = 'CYBRIK_COMPREHENSIVE_EDGE_CASES_2026';
  const payloadBuf = Buffer.from(payloadStr);
  const payloadU8 = new Uint8Array(payloadBuf);
  const validSha = computePayloadSha256(payloadBuf);
  const validMd5 = computePayloadMd5(payloadBuf);

  // -------------------------------------------------------------------------
  // 1. dispatchS3PutObject comprehensive edge cases
  // -------------------------------------------------------------------------
  // Throwing getters on probe keys fail closed to InvalidDigest
  const throwingPutKeys = [
    'content_length', 'contentLength', 'content_length_bytes', 'size_bytes', 'size',
    'Content-Length', 'content-length', 'payload', 'payloadBytes', 'body', 'headers',
    'contentMd5Header', 'content_md5_header', 'contentMd5', 'Content-MD5', 'content_md5',
    'content_md5_declared', 'x-amz-content-sha256', 'X-Amz-Content-Sha256', 'contentSha256Header',
    'content_sha256_header', 'contentSha256', 'xAmzContentSha256', 'x_amz_content_sha256',
    'sha256Header', 'allow_unsigned_payload', 'is_presigned'
  ];
  for (const key of throwingPutKeys) {
    const badObj = {};
    Object.defineProperty(badObj, key, {
      get() { throw new Error(`Trapped getter for ${key}`); },
      configurable: true,
      enumerable: true
    });
    const res = dispatchS3PutObject(badObj);
    assert.equal(res.http_status, 400);
    assert.equal(res.error_code, 'InvalidDigest');
    assert.ok(res.reason === 'MALFORMED_PAYLOAD_TYPE' || res.reason === 'MALFORMED_HEADER_SYNTAX');
  }

  // Headers with inherited properties fail closed to MALFORMED_HEADER_SYNTAX
  const protoHeaders = Object.create({ 'x-amz-inherited': 'value' });
  const putProtoHeadersRes = dispatchS3PutObject({
    payload: payloadStr,
    headers: protoHeaders,
    'x-amz-content-sha256': validSha
  });
  assert.equal(putProtoHeadersRes.reason, 'MALFORMED_HEADER_SYNTAX');

  // Headers descriptor with getter or nested object fails closed to MALFORMED_HEADER_SYNTAX
  const descHeaderObj = { headers: {} };
  Object.defineProperty(descHeaderObj.headers, 'custom-header', {
    get() { return 'evil'; },
    configurable: true,
    enumerable: true
  });
  const resDescHdr = dispatchS3PutObject(descHeaderObj);
  assert.equal(resDescHdr.reason, 'MALFORMED_HEADER_SYNTAX');

  const nestedHeaderObj = { headers: { 'custom': { nested: true } }, payload: payloadStr, 'x-amz-content-sha256': validSha };
  const resNestedHdr = dispatchS3PutObject(nestedHeaderObj);
  assert.equal(resNestedHdr.reason, 'MALFORMED_HEADER_SYNTAX');

  // Headers with declared length exceeding 5GiB limit fail closed to EntityTooLarge
  const oversizedHeaderRes = dispatchS3PutObject({
    payload: payloadStr,
    headers: { 'Content-Length': '5368709121' },
    'x-amz-content-sha256': validSha
  });
  assert.equal(oversizedHeaderRes.error_code, 'EntityTooLarge');
  assert.equal(oversizedHeaderRes.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // Request with inherited digest keys fails closed to MALFORMED_HEADER_SYNTAX
  for (const k of ['contentMd5Header', 'contentMd5', 'x-amz-content-sha256', 'sha256Header']) {
    const protoReq = Object.create({ [k]: 'inherited' });
    protoReq.payload = payloadStr;
    const resInherited = dispatchS3PutObject(protoReq);
    assert.equal(resInherited.http_status, 400);
    assert.equal(resInherited.error_code, 'InvalidDigest');
    assert.ok(resInherited.reason === 'MALFORMED_HEADER_SYNTAX' || resInherited.reason === 'MALFORMED_PAYLOAD_TYPE');
  }

  // expected_error containing Proxy or accessors fails closed to MALFORMED_PAYLOAD_TYPE
  const resExpProxy = dispatchS3PutObject({
    payload: payloadStr,
    expected_error: new Proxy({}, {})
  });
  assert.equal(resExpProxy.reason, 'MALFORMED_PAYLOAD_TYPE');

  // content_md5_declared vs content_md5_computed mismatch fails closed to BadDigest
  const otherValidMd5 = computePayloadMd5(Buffer.from('other_payload'));
  const resMd5Mismatch = dispatchS3PutObject({
    payload: payloadStr,
    content_md5_declared: validMd5,
    content_md5_computed: otherValidMd5,
    'x-amz-content-sha256': validSha
  });
  assert.equal(resMd5Mismatch.error_code, 'BadDigest');
  assert.equal(resMd5Mismatch.reason, 'PAYLOAD_DIGEST_MISMATCH');

  // Missing required payload in dispatchS3PutObject fails closed to MISSING_PAYLOAD
  const missingPayloadRes = dispatchS3PutObject({});
  assert.equal(missingPayloadRes.http_status, 400);
  assert.equal(missingPayloadRes.error_code, 'InvalidDigest');
  assert.equal(missingPayloadRes.reason, 'MISSING_PAYLOAD');

  // Missing SHA-256 header in dispatchS3PutObject fails closed to MissingXAmzContentSHA256
  const missingShaRes = dispatchS3PutObject({ payload: payloadStr });
  assert.equal(missingShaRes.http_status, 400);
  assert.equal(missingShaRes.error_code, 'InvalidDigest');
  assert.equal(missingShaRes.reason, 'MissingXAmzContentSHA256');

  // Unsigned payload without allow_unsigned_payload fails closed to UNSIGNED_PAYLOAD_NOT_PERMITTED
  const unsignedRes = dispatchS3PutObject({
    payload: payloadStr,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: false
  });
  assert.equal(unsignedRes.http_status, 400);
  assert.equal(unsignedRes.error_code, 'InvalidDigest');
  assert.equal(unsignedRes.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // Streaming SHA-256 header fails closed to UNSUPPORTED_STREAMING_PAYLOAD_SHA256
  const streamingRes = dispatchS3PutObject({
    payload: payloadStr,
    'x-amz-content-sha256': 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD'
  });
  assert.equal(streamingRes.http_status, 400);
  assert.equal(streamingRes.error_code, 'InvalidDigest');
  assert.equal(streamingRes.reason, 'UNSUPPORTED_STREAMING_PAYLOAD_SHA256');

  // -------------------------------------------------------------------------
  // 2. dispatchS3Error comprehensive edge cases
  // -------------------------------------------------------------------------
  // Throwing getters on probe keys fail closed to InvalidDigest
  const throwingErrKeys = [
    'content_length', 'contentLength', 'size_bytes', 'size',
    'Content-Length', 'content-length', 'payload', 'payloadBytes', 'body', 'headers',
    'contentMd5Header', 'content_md5_header', 'contentMd5', 'Content-MD5', 'content_md5',
    'content_md5_declared', 'x-amz-content-sha256', 'X-Amz-Content-Sha256', 'contentSha256Header',
    'content_sha256_header', 'contentSha256', 'xAmzContentSha256', 'x_amz_content_sha256',
    'sha256Header', 'allow_unsigned_payload', 'expected_error', 'error_condition', 'reason'
  ];
  for (const key of throwingErrKeys) {
    const badObj = {};
    Object.defineProperty(badObj, key, {
      get() { throw new Error(`Trapped getter for ${key}`); },
      configurable: true,
      enumerable: true
    });
    const res = dispatchS3Error(badObj);
    assert.equal(res.http_status, 400);
    assert.equal(res.error_code, 'InvalidDigest');
    assert.ok(res.reason === 'MALFORMED_PAYLOAD_TYPE' || res.reason === 'MALFORMED_HEADER_SYNTAX');
  }

  // Non-matching MD5 in dispatchS3Error 2-arg signature
  assert.equal(dispatchS3Error({ payload: payloadStr, contentMd5: 'invalid!md5' }).reason, 'MALFORMED_HEADER_SYNTAX');

  // Canonical S3 error codes mapping
  for (const code of [
    'AccessDenied', 'NoSuchBucket', 'NoSuchKey', 'NoSuchUpload',
    'ObjectLockConfigurationNotFoundError', 'PreconditionFailed',
    'InvalidArgument', 'InvalidPart', 'InvalidPartOrder',
    'EntityTooLarge', 'EntityTooSmall', 'BadDigest', 'InvalidDigest'
  ]) {
    const res = dispatchS3Error(code);
    assert.equal(res.error_code, code);
    assert.ok(res.http_status >= 400);
  }

  // -------------------------------------------------------------------------
  // 3. validatePlatformSemantics comprehensive edge cases
  // -------------------------------------------------------------------------
  // Safe return on non-objects, primitives
  assert.doesNotThrow(() => validatePlatformSemantics(null, 'test-schema'));
  assert.doesNotThrow(() => validatePlatformSemantics(undefined, 'test-schema'));
  assert.doesNotThrow(() => validatePlatformSemantics(123, 'test-schema'));
  assert.doesNotThrow(() => validatePlatformSemantics('string', 'test-schema'));
  assert.doesNotThrow(() => validatePlatformSemantics(true, 'test-schema'));
  assert.throws(() => validatePlatformSemantics(() => {}, 'test-schema'), /Semantic error/);

  // Proxy as root or nested object / array fails closed
  assert.throws(() => validatePlatformSemantics(new Proxy({}, {}), 'test-schema'), /Semantic error/);
  assert.throws(() => validatePlatformSemantics({ get bad() { return 1; } }, 'test-schema'), /Semantic error/);
  assert.throws(() => validatePlatformSemantics({ nested: { get bad() { return 1; } } }, 'test-schema'), /Semantic error/);
  assert.throws(() => validatePlatformSemantics([{ get bad() { return 1; } }], 'test-schema'), /Semantic error/);
  assert.throws(() => validatePlatformSemantics({ nested: new Proxy({}, {}) }, 'test-schema'), /Semantic error/);
  assert.throws(() => validatePlatformSemantics([new Proxy({}, {})], 'test-schema'), /Semantic error/);

  // Conformance evidence validation edge cases
  const badDigestAdv = {
    advertised_capabilities: [{ slot_id: 'inference', capability_id: 'cap-1', evidence_references: ['ev-1'] }],
    conformance_evidence: [{ test_identifier: 'ev-1', status: 'PASS', evidence_pack_digest: 'not-64-hex' }]
  };
  assert.throws(() => validatePlatformSemantics(badDigestAdv, 'provider-capability-advertisement'), /evidence_pack_digest/);

  const badDigestTypeAdv = {
    advertised_capabilities: [{ slot_id: 'inference', capability_id: 'cap-1', evidence_references: ['ev-1'] }],
    conformance_evidence: [{ test_identifier: 'ev-1', status: 'PASS', evidence_pack_digest: 12345 }]
  };
  assert.throws(() => validatePlatformSemantics(badDigestTypeAdv, 'provider-capability-advertisement'), /evidence_pack_digest/);

  const dupEvAdv = {
    advertised_capabilities: [{ slot_id: 'inference', capability_id: 'cap-1', evidence_references: ['ev-1'] }],
    conformance_evidence: [
      { test_identifier: 'ev-1', status: 'PASS', evidence_pack_digest: 'a'.repeat(64) },
      { test_identifier: 'ev-1', status: 'PASS', evidence_pack_digest: 'b'.repeat(64) }
    ]
  };
  assert.throws(() => validatePlatformSemantics(dupEvAdv, 'provider-capability-advertisement'), /duplicate test_identifier/);

  const skipEvAdv = {
    advertised_capabilities: [{ slot_id: 'inference', capability_id: 'cap-1', evidence_references: ['ev-1'] }],
    conformance_evidence: [{ test_identifier: 'ev-1', status: 'SKIP', evidence_pack_digest: 'a'.repeat(64) }]
  };
  assert.throws(() => validatePlatformSemantics(skipEvAdv, 'provider-capability-advertisement'), /non-passing status/);

  // -------------------------------------------------------------------------
  // 4. validateOfflineInstallSemantics comprehensive edge cases
  // -------------------------------------------------------------------------
  // Safe return on non-objects, primitives
  assert.doesNotThrow(() => validateOfflineInstallSemantics(null));
  assert.doesNotThrow(() => validateOfflineInstallSemantics(undefined));
  assert.doesNotThrow(() => validateOfflineInstallSemantics(123));
  assert.doesNotThrow(() => validateOfflineInstallSemantics('str'));
  assert.doesNotThrow(() => validateOfflineInstallSemantics(false));

  // Proxy as root or nested object / array fails closed
  assert.throws(() => validateOfflineInstallSemantics(new Proxy({}, {})), /Semantic error/);
  assert.throws(() => validateOfflineInstallSemantics({ get bad() { return 1; } }), /Semantic error/);
  assert.throws(() => validateOfflineInstallSemantics({ nested: { get bad() { return 1; } } }), /Semantic error/);
  assert.throws(() => validateOfflineInstallSemantics([{ get bad() { return 1; } }]), /Semantic error/);
  assert.throws(() => validateOfflineInstallSemantics({ nested: new Proxy({}, {}) }), /Semantic error/);
  assert.throws(() => validateOfflineInstallSemantics([new Proxy({}, {})], 'test-schema'), /Semantic error/);

  // Missing or invalid fingerprints
  assert.throws(
    () => validateOfflineInstallSemantics({ operator_trust_root: { public_key_fingerprint: '' }, detached_signature: { key_fingerprint: 'a'.repeat(64) } }),
    /missing valid signing key fingerprint/
  );
  assert.throws(
    () => validateOfflineInstallSemantics({ operator_trust_root: { public_key_fingerprint: 'a'.repeat(64) }, detached_signature: { key_fingerprint: '' } }),
    /missing valid signing key fingerprint/
  );
  assert.throws(
    () => validateOfflineInstallSemantics({ operator_trust_root: { public_key_fingerprint: 123 }, detached_signature: { key_fingerprint: 'a'.repeat(64) } }),
    /missing valid signing key fingerprint/
  );

  // Fingerprint mismatch
  assert.throws(
    () => validateOfflineInstallSemantics({ operator_trust_root: { public_key_fingerprint: 'a'.repeat(64) }, detached_signature: { key_fingerprint: 'b'.repeat(64) } }),
    /does not match/
  );

  // Root manifest files in artifacts array fail closed
  assert.throws(() => validateOfflineInstallSemantics({ artifacts: [{ path: 'manifest.json' }] }), /root manifest file/);
  assert.throws(() => validateOfflineInstallSemantics({ artifacts: [{ path: 'manifest.sig' }] }), /root manifest file/);
  assert.throws(() => validateOfflineInstallSemantics({ artifacts: [{ path: './manifest.json' }] }), /root manifest file/);
  assert.throws(() => validateOfflineInstallSemantics({ artifacts: [{ path: './manifest.sig' }] }), /root manifest file/);

  // -------------------------------------------------------------------------
  // 5. dispatchS3CompleteMultipartUpload edge cases
  // -------------------------------------------------------------------------
  assert.equal(dispatchS3CompleteMultipartUpload({}, new Proxy({}, {})).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: { parts: [{ part_number: 1, etag: '"a"', size_bytes: 5 }] }, storedParts: new Proxy({}, {}) }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const badPartsDescManifest = {};
  Object.defineProperty(badPartsDescManifest, 'parts', { get() { return []; }, configurable: true, enumerable: true });
  assert.equal(dispatchS3CompleteMultipartUpload(badPartsDescManifest).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const badTpDescManifest = { parts: [{ part_number: 1, etag: '"a"', size_bytes: 5 }] };
  Object.defineProperty(badTpDescManifest, 'total_parts', { get() { return 1; }, configurable: true, enumerable: true });
  assert.equal(dispatchS3CompleteMultipartUpload(badTpDescManifest).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const protoPart = Object.create({ part_number: 1 });
  protoPart.etag = '"0123456789abcdef0123456789abcdef"';
  protoPart.size_bytes = 5242880;
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [protoPart] }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"a"', size_bytes: 5 }] }, 'not-valid-stored-parts').reason, 'MissingStoredPartState');
});

test('OPEN-2/OPEN-5 adversarial regression: prototype-spoofed views across platform semantics and S3 dispatchers', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.platform-capability-negotiation.v1.schema.json';
  const offlineDistSchemaId = 'https://contracts.cybrik.example/cybrik.core-offline-distribution.v1.schema.json';

  // 1. ArrayBuffer view with prototype re-assigned to Uint8Array.prototype
  const float32Buf = new Float32Array([1.5, 2.5]).buffer;
  const spoofedFloat32 = Object.setPrototypeOf(new Float32Array(float32Buf), Uint8Array.prototype);
  assert.equal(isPureBufferOrUint8Array(spoofedFloat32), false, 'Float32Array spoofed as Uint8Array.prototype must not be pure');
  assert.equal(isMalformedPayloadType(spoofedFloat32), true, 'Float32Array spoofed as Uint8Array.prototype must be malformed payload');
  assert.equal(hasAnyAccessorsOrProxy(spoofedFloat32), true, 'Float32Array spoofed as Uint8Array.prototype must trigger accessor/proxy violation');
  assert.throws(
    () => createSafePlainSnapshot(spoofedFloat32),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'createSafePlainSnapshot must reject prototype-spoofed Float32Array'
  );

  // 2. DataView with prototype re-assigned to Uint8Array.prototype
  const dataViewBuf = new ArrayBuffer(16);
  const spoofedDataView = Object.setPrototypeOf(new DataView(dataViewBuf), Uint8Array.prototype);
  assert.equal(isPureBufferOrUint8Array(spoofedDataView), false, 'DataView spoofed as Uint8Array.prototype must not be pure');
  assert.equal(isMalformedPayloadType(spoofedDataView), true, 'DataView spoofed as Uint8Array.prototype must be malformed payload');
  assert.equal(hasAnyAccessorsOrProxy(spoofedDataView), true, 'DataView spoofed as Uint8Array.prototype must trigger accessor/proxy violation');
  assert.throws(
    () => createSafePlainSnapshot(spoofedDataView),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'createSafePlainSnapshot must reject prototype-spoofed DataView'
  );

  // 3. Subclassed Uint8Array with overridden Symbol.toStringTag and Uint8Array prototype
  class SubclassedUint8Array extends Uint8Array {
    get [Symbol.toStringTag]() {
      return 'Uint8Array';
    }
  }
  const subclassedU8 = new SubclassedUint8Array(10);
  assert.equal(isPureBufferOrUint8Array(subclassedU8), false, 'Subclassed Uint8Array must not be pure');
  assert.equal(isMalformedPayloadType(subclassedU8), true, 'Subclassed Uint8Array must be malformed payload');
  assert.equal(hasAnyAccessorsOrProxy(subclassedU8), true, 'Subclassed Uint8Array must trigger accessor/proxy violation');
  assert.throws(
    () => createSafePlainSnapshot(subclassedU8),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'createSafePlainSnapshot must reject subclassed Uint8Array'
  );

  // 4. Object.create with Uint8Array.prototype but without Uint8Array internal slot
  const fakeUint8Object = Object.create(Uint8Array.prototype);
  assert.equal(isPureBufferOrUint8Array(fakeUint8Object), false, 'Object.create(Uint8Array.prototype) must not be pure');
  assert.equal(isMalformedPayloadType(fakeUint8Object), true, 'Object.create(Uint8Array.prototype) must be malformed payload');
  assert.equal(hasAnyAccessorsOrProxy(fakeUint8Object), true, 'Object.create(Uint8Array.prototype) must trigger accessor/proxy violation');
  assert.throws(
    () => createSafePlainSnapshot(fakeUint8Object),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'createSafePlainSnapshot must reject fake Uint8Array object'
  );

  // 5. dispatchS3PutObject with prototype-spoofed views
  const putSpoofedF32 = dispatchS3PutObject(spoofedFloat32);
  assert.equal(putSpoofedF32.http_status, 400);
  assert.equal(putSpoofedF32.error_code, 'InvalidDigest');
  assert.equal(putSpoofedF32.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putSpoofedDv = dispatchS3PutObject(spoofedDataView);
  assert.equal(putSpoofedDv.http_status, 400);
  assert.equal(putSpoofedDv.error_code, 'InvalidDigest');
  assert.equal(putSpoofedDv.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putSubclassed = dispatchS3PutObject(subclassedU8);
  assert.equal(putSubclassed.http_status, 400);
  assert.equal(putSubclassed.error_code, 'InvalidDigest');
  assert.equal(putSubclassed.reason, 'MALFORMED_PAYLOAD_TYPE');

  const putFakeObj = dispatchS3PutObject(fakeUint8Object);
  assert.equal(putFakeObj.http_status, 400);
  assert.equal(putFakeObj.error_code, 'InvalidDigest');
  assert.equal(putFakeObj.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 6. dispatchS3Error with prototype-spoofed views
  const errSpoofedF32 = dispatchS3Error(spoofedFloat32);
  assert.equal(errSpoofedF32.http_status, 400);
  assert.equal(errSpoofedF32.error_code, 'InvalidDigest');
  assert.equal(errSpoofedF32.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errSpoofedDv = dispatchS3Error(spoofedDataView);
  assert.equal(errSpoofedDv.http_status, 400);
  assert.equal(errSpoofedDv.error_code, 'InvalidDigest');
  assert.equal(errSpoofedDv.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errSubclassed = dispatchS3Error(subclassedU8);
  assert.equal(errSubclassed.http_status, 400);
  assert.equal(errSubclassed.error_code, 'InvalidDigest');
  assert.equal(errSubclassed.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errFakeObj = dispatchS3Error(fakeUint8Object);
  assert.equal(errFakeObj.http_status, 400);
  assert.equal(errFakeObj.error_code, 'InvalidDigest');
  assert.equal(errFakeObj.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 7. verifyPayloadSha256 and verifyPayloadMd5 with prototype-spoofed views
  assert.throws(
    () => verifyPayloadSha256(spoofedFloat32, 'a'.repeat(64)),
    /MALFORMED_PAYLOAD_TYPE/,
    'verifyPayloadSha256 must reject prototype-spoofed Float32Array'
  );
  assert.throws(
    () => verifyPayloadSha256(spoofedDataView, 'a'.repeat(64)),
    /MALFORMED_PAYLOAD_TYPE/,
    'verifyPayloadSha256 must reject prototype-spoofed DataView'
  );
  assert.throws(
    () => verifyPayloadMd5(spoofedFloat32, '1B2M2Y8AsgTpgAmY7PhCfg=='),
    /MALFORMED_PAYLOAD_TYPE/,
    'verifyPayloadMd5 must reject prototype-spoofed Float32Array'
  );
  assert.throws(
    () => verifyPayloadMd5(spoofedDataView, '1B2M2Y8AsgTpgAmY7PhCfg=='),
    /MALFORMED_PAYLOAD_TYPE/,
    'verifyPayloadMd5 must reject prototype-spoofed DataView'
  );

  // 8. Nested prototype-spoofed views inside negotiation requests fail closed terminally
  const baseNegotiationRequest = {
    negotiation_protocol_version: '1.0.0',
    platform_contract_id: 'cybrik-platform-contract-001',
    request_id: 'req-negotiate-spoofed-001',
    requested_slots: [
      {
        slot_id: 'inference',
        required_for_optimal: true,
        candidate_capabilities: ['cap-infer-v1']
      }
    ],
    client_context: {
      tenant_id: 'tenant-001'
    }
  };

  const reqWithSpoofedF32 = JSON.parse(JSON.stringify(baseNegotiationRequest));
  reqWithSpoofedF32.client_context.spoofed_view = spoofedFloat32;
  assert.throws(
    () => validatePlatformSemantics(reqWithSpoofedF32, pcnSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'validatePlatformSemantics must reject negotiation request with nested Float32Array prototype spoof'
  );

  const reqWithSpoofedDv = JSON.parse(JSON.stringify(baseNegotiationRequest));
  reqWithSpoofedDv.requested_slots[0].spoofed_view = spoofedDataView;
  assert.throws(
    () => validatePlatformSemantics(reqWithSpoofedDv, pcnSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'validatePlatformSemantics must reject negotiation request with nested DataView prototype spoof'
  );

  // 9. Nested prototype-spoofed views inside capability leases fail closed terminally
  const baseLease = {
    negotiation_protocol_version: '1.0.0',
    platform_contract_id: 'cybrik-platform-contract-001',
    session_id: 'sess-lease-spoofed-001',
    lease_grant: {
      lease_id: 'lease-grant-001',
      lease_status: 'ACTIVE_OPTIMAL',
      issued_at: '2026-08-29T00:00:00.000Z',
      valid_until: '2026-08-29T01:00:00.000Z',
      ttl_seconds: 3600
    },
    capability_leases: [
      {
        slot_id: 'storage',
        capability_name: 'storage_object_lock',
        conformance_profile: 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json#/$defs/storageConformanceProfile',
        target_profile_digest: 'a'.repeat(64),
        evidence_references: [
          'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations',
          'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'
        ]
      }
    ],
    conformance_evidence: [
      {
        test_identifier: 'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations',
        status: 'PASS',
        evidence_hash: 'a'.repeat(64),
        version_id: 'v1.0.0'
      },
      {
        test_identifier: 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock',
        status: 'PASS',
        evidence_hash: 'b'.repeat(64),
        version_id: 'v1.0.0'
      }
    ]
  };

  const leaseWithSpoofedF32 = JSON.parse(JSON.stringify(baseLease));
  leaseWithSpoofedF32.capability_leases[0].spoofed_view = spoofedFloat32;
  assert.throws(
    () => validatePlatformSemantics(leaseWithSpoofedF32, pcnSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'validatePlatformSemantics must reject lease with nested Float32Array prototype spoof'
  );

  const leaseWithSpoofedDv = JSON.parse(JSON.stringify(baseLease));
  leaseWithSpoofedDv.conformance_evidence[0].spoofed_view = spoofedDataView;
  assert.throws(
    () => validatePlatformSemantics(leaseWithSpoofedDv, pcnSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'validatePlatformSemantics must reject lease with nested DataView prototype spoof'
  );

  // 10. Nested prototype-spoofed views inside offline install artifacts fail closed terminally
  const baseOfflineManifest = {
    manifest_version: '0.1.0',
    package_name: 'cybrik-core-platform',
    package_version: '1.0.0',
    artifacts: [
      {
        path: 'bin/cybrik-engine',
        sha256: 'a'.repeat(64),
        size_bytes: 1048576
      }
    ],
    operator_trust_root: {
      key_id: 'op-key-001',
      public_key_fingerprint: 'fp-sha256-abcdef0123456789'
    },
    detached_signature: {
      signature_algorithm: 'ed25519',
      key_fingerprint: 'fp-sha256-abcdef0123456789',
      signature_bytes_base64: Buffer.from('sig').toString('base64')
    },
    update_station_workflow: {
      preflight_steps: [],
      apply_steps: [{ action: 'RESTORE_DATABASE_SNAPSHOT', target: 'snapshots/db_v1.sql' }],
      rollback_steps: []
    }
  };

  const offlineWithSpoofedF32 = JSON.parse(JSON.stringify(baseOfflineManifest));
  offlineWithSpoofedF32.artifacts[0].digest_payload = spoofedFloat32;
  assert.throws(
    () => validateOfflineInstallSemantics(offlineWithSpoofedF32),
    /Semantic error: accessor properties or Proxy objects are prohibited in offline install manifest/,
    'validateOfflineInstallSemantics must reject offline manifest with nested Float32Array prototype spoof in artifact'
  );
  assert.throws(
    () => validatePlatformSemantics(offlineWithSpoofedF32, offlineDistSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'validatePlatformSemantics must reject offline manifest with nested Float32Array prototype spoof'
  );

  const offlineWithSpoofedDv = JSON.parse(JSON.stringify(baseOfflineManifest));
  offlineWithSpoofedDv.update_station_workflow.spoofed_view = spoofedDataView;
  assert.throws(
    () => validateOfflineInstallSemantics(offlineWithSpoofedDv),
    /Semantic error: accessor properties or Proxy objects are prohibited in offline install manifest/,
    'validateOfflineInstallSemantics must reject offline manifest with nested DataView prototype spoof in workflow'
  );
  assert.throws(
    () => validatePlatformSemantics(offlineWithSpoofedDv, offlineDistSchemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/,
    'validatePlatformSemantics must reject offline manifest with nested DataView prototype spoof'
  );

  // 11. Nested prototype-spoofed views inside multipart manifests fail closed terminally
  const multipartWithSpoofedF32 = {
    parts: [
      {
        part_number: 1,
        etag: '"0123456789abcdef0123456789abcdef"',
        size_bytes: 5242880,
        extra_view: spoofedFloat32
      }
    ]
  };
  assert.throws(
    () => validateS3MultipartSemantics(multipartWithSpoofedF32),
    /Semantic error: multipart upload manifest structure is invalid or malformed/
  );
  const mpResF32 = dispatchS3CompleteMultipartUpload(multipartWithSpoofedF32);
  assert.equal(mpResF32.http_status, 400);
  assert.equal(mpResF32.error_code, 'InvalidPart');
  assert.equal(mpResF32.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const multipartWithSpoofedDv = {
    parts: [
      {
        part_number: 1,
        etag: '"0123456789abcdef0123456789abcdef"',
        size_bytes: 5242880,
        extra_view: spoofedDataView
      }
    ]
  };
  assert.throws(
    () => validateS3MultipartSemantics(multipartWithSpoofedDv),
    /Semantic error: multipart upload manifest structure is invalid or malformed/
  );
  const mpResDv = dispatchS3CompleteMultipartUpload(multipartWithSpoofedDv);
  assert.equal(mpResDv.http_status, 400);
  assert.equal(mpResDv.error_code, 'InvalidPart');
  assert.equal(mpResDv.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const mpOptResF32 = dispatchS3CompleteMultipartUpload({ manifest: multipartWithSpoofedF32 });
  assert.equal(mpOptResF32.http_status, 400);
  assert.equal(mpOptResF32.error_code, 'InvalidPart');
  assert.equal(mpOptResF32.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  const mpStoredResF32 = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] },
    spoofedFloat32
  );
  assert.equal(mpStoredResF32.http_status, 400);
  assert.equal(mpStoredResF32.error_code, 'InvalidPart');
  assert.equal(mpStoredResF32.reason, 'MALFORMED_PAYLOAD_TYPE');
});

test('OPEN-2/OPEN-5 comprehensive prototype-spoofing coverage and branch guard', () => {
  const nonUint8Variants = [
    { name: 'Int8Array', create: () => new Int8Array([1, 2, 3]) },
    { name: 'Uint8ClampedArray', create: () => new Uint8ClampedArray([1, 2, 3]) },
    { name: 'Int16Array', create: () => new Int16Array([1, 2, 3]) },
    { name: 'Uint16Array', create: () => new Uint16Array([1, 2, 3]) },
    { name: 'Int32Array', create: () => new Int32Array([1, 2, 3]) },
    { name: 'Uint32Array', create: () => new Uint32Array([1, 2, 3]) },
    { name: 'Float32Array', create: () => new Float32Array([1.0, 2.0]) },
    { name: 'Float64Array', create: () => new Float64Array([1.0, 2.0]) },
    { name: 'BigInt64Array', create: () => new BigInt64Array([1n, 2n]) },
    { name: 'BigUint64Array', create: () => new BigUint64Array([1n, 2n]) },
    { name: 'DataView', create: () => new DataView(new ArrayBuffer(8)) },
  ];

  for (const variant of nonUint8Variants) {
    // 1. Re-prototyped to Uint8Array.prototype
    const u8Spoofed = Object.setPrototypeOf(variant.create(), Uint8Array.prototype);
    assert.equal(isPureBufferOrUint8Array(u8Spoofed), false, `${variant.name} re-prototyped to Uint8Array.prototype must not be pure`);
    assert.equal(isMalformedPayloadType(u8Spoofed), true, `${variant.name} re-prototyped to Uint8Array.prototype must be malformed payload`);
    assert.throws(() => computePayloadMd5(u8Spoofed), /Invalid payload type/);
    assert.throws(() => computePayloadSha256(u8Spoofed), /Invalid payload type/);
    assert.throws(() => verifyPayloadSha256(u8Spoofed), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => verifyPayloadSha256({ payloadBytes: u8Spoofed }), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => verifyPayloadMd5(u8Spoofed), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => verifyPayloadMd5({ payloadBytes: u8Spoofed }), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => createSafePlainSnapshot(u8Spoofed), /Semantic error: accessor properties or Proxy objects are prohibited in platform data/);
    assert.throws(() => createSafePlainSnapshot({ payload: u8Spoofed }), /Semantic error: accessor properties or Proxy objects are prohibited in platform data/);
    assert.throws(() => createSafePlainSnapshot([u8Spoofed]), /Semantic error: accessor properties or Proxy objects are prohibited in platform data/);
    assert.throws(() => createSafePlainSnapshot({ nested: { items: [u8Spoofed] } }), /Semantic error: accessor properties or Proxy objects are prohibited in platform data/);
    assert.throws(() => validatePlatformSemantics(u8Spoofed, 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validatePlatformSemantics({ payload: u8Spoofed }, 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validatePlatformSemantics([u8Spoofed], 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validatePlatformSemantics({ nested: { items: [u8Spoofed] } }, 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validateOfflineInstallSemantics(u8Spoofed), /Semantic error/);
    assert.throws(() => validateOfflineInstallSemantics({ payload: u8Spoofed }), /Semantic error/);
    assert.throws(() => validateOfflineInstallSemantics([{ payload: u8Spoofed }]), /Semantic error/);
    assert.throws(() => validateS3MultipartSemantics(u8Spoofed), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => validateS3MultipartSemantics({ payload: u8Spoofed }), /MALFORMED_PAYLOAD_TYPE/);

    // Test all S3 PutObject and Error dispatch forms for Uint8Array spoofed view
    const u8PutDirect = dispatchS3PutObject(u8Spoofed);
    assert.equal(u8PutDirect.http_status, 400);
    assert.equal(u8PutDirect.error_code, 'InvalidDigest');
    assert.equal(u8PutDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    const u8PutPayloadBytes = dispatchS3PutObject({ payloadBytes: u8Spoofed });
    assert.equal(u8PutPayloadBytes.http_status, 400);
    assert.equal(u8PutPayloadBytes.error_code, 'InvalidDigest');
    assert.equal(u8PutPayloadBytes.reason, 'MALFORMED_PAYLOAD_TYPE');

    const u8PutPayload = dispatchS3PutObject({ payload: u8Spoofed });
    assert.equal(u8PutPayload.http_status, 400);
    assert.equal(u8PutPayload.error_code, 'InvalidDigest');
    assert.equal(u8PutPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

    const u8PutBody = dispatchS3PutObject({ body: u8Spoofed });
    assert.equal(u8PutBody.http_status, 400);
    assert.equal(u8PutBody.error_code, 'InvalidDigest');
    assert.equal(u8PutBody.reason, 'MALFORMED_PAYLOAD_TYPE');

    const u8PutHeaders = dispatchS3PutObject({ headers: u8Spoofed });
    assert.equal(u8PutHeaders.http_status, 400);
    assert.equal(u8PutHeaders.error_code, 'InvalidDigest');
    assert.ok(u8PutHeaders.reason === 'MALFORMED_PAYLOAD_TYPE' || u8PutHeaders.reason === 'MALFORMED_HEADER_SYNTAX');

    const u8PutMd5 = dispatchS3PutObject(Buffer.from('valid payload'), u8Spoofed);
    assert.equal(u8PutMd5.http_status, 400);
    assert.equal(u8PutMd5.error_code, 'InvalidDigest');
    assert.equal(u8PutMd5.reason, 'MALFORMED_PAYLOAD_TYPE');

    const u8PutSha256 = dispatchS3PutObject(Buffer.from('valid payload'), undefined, u8Spoofed);
    assert.equal(u8PutSha256.http_status, 400);
    assert.equal(u8PutSha256.error_code, 'InvalidDigest');
    assert.equal(u8PutSha256.reason, 'MALFORMED_PAYLOAD_TYPE');

    assert.equal(dispatchS3PutObject({ payload: u8Spoofed, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true }).error_code, 'InvalidDigest');

    const u8ErrDirect = dispatchS3Error(u8Spoofed);
    assert.equal(u8ErrDirect.http_status, 400);
    assert.equal(u8ErrDirect.error_code, 'InvalidDigest');
    assert.equal(u8ErrDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    const u8ErrErrCond = dispatchS3Error({ error_condition: u8Spoofed });
    assert.equal(u8ErrErrCond.http_status, 400);
    assert.equal(u8ErrErrCond.error_code, 'InvalidDigest');
    assert.equal(u8ErrErrCond.reason, 'MALFORMED_PAYLOAD_TYPE');

    const u8ErrReason = dispatchS3Error({ reason: u8Spoofed });
    assert.equal(u8ErrReason.http_status, 400);
    assert.equal(u8ErrReason.error_code, 'InvalidDigest');
    assert.equal(u8ErrReason.reason, 'MALFORMED_PAYLOAD_TYPE');

    const u8ErrHeaders = dispatchS3Error({ headers: u8Spoofed });
    assert.equal(u8ErrHeaders.http_status, 400);
    assert.equal(u8ErrHeaders.error_code, 'InvalidDigest');
    assert.ok(u8ErrHeaders.reason === 'MALFORMED_PAYLOAD_TYPE' || u8ErrHeaders.reason === 'MALFORMED_HEADER_SYNTAX');

    const u8ErrHdr = dispatchS3Error('NoSuchKey', u8Spoofed);
    assert.equal(u8ErrHdr.http_status, 400);
    assert.equal(u8ErrHdr.error_code, 'InvalidDigest');
    assert.equal(u8ErrHdr.reason, 'MALFORMED_PAYLOAD_TYPE');

    assert.equal(dispatchS3Error({ payload: u8Spoofed }).error_code, 'InvalidDigest');
    assert.equal(dispatchS3CompleteMultipartUpload(u8Spoofed).error_code, 'InvalidPart');
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, u8Spoofed).error_code, 'InvalidPart');

    // 2. Re-prototyped to Buffer.prototype
    const bufSpoofed = Object.setPrototypeOf(variant.create(), Buffer.prototype);
    assert.equal(isPureBufferOrUint8Array(bufSpoofed), false, `${variant.name} re-prototyped to Buffer.prototype must not be pure`);
    assert.equal(isMalformedPayloadType(bufSpoofed), true, `${variant.name} re-prototyped to Buffer.prototype must be malformed payload`);
    assert.throws(() => computePayloadMd5(bufSpoofed), /Invalid payload type/);
    assert.throws(() => computePayloadSha256(bufSpoofed), /Invalid payload type/);
    assert.throws(() => verifyPayloadSha256(bufSpoofed), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => verifyPayloadSha256({ payloadBytes: bufSpoofed }), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => verifyPayloadMd5(bufSpoofed), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => verifyPayloadMd5({ payloadBytes: bufSpoofed }), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => createSafePlainSnapshot(bufSpoofed), /Semantic error: accessor properties or Proxy objects are prohibited in platform data/);
    assert.throws(() => createSafePlainSnapshot({ payload: bufSpoofed }), /Semantic error: accessor properties or Proxy objects are prohibited in platform data/);
    assert.throws(() => createSafePlainSnapshot([bufSpoofed]), /Semantic error: accessor properties or Proxy objects are prohibited in platform data/);
    assert.throws(() => createSafePlainSnapshot({ nested: { items: [bufSpoofed] } }), /Semantic error: accessor properties or Proxy objects are prohibited in platform data/);
    assert.throws(() => validatePlatformSemantics(bufSpoofed, 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validatePlatformSemantics({ payload: bufSpoofed }, 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validatePlatformSemantics([bufSpoofed], 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validatePlatformSemantics({ nested: { items: [bufSpoofed] } }, 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validateOfflineInstallSemantics(bufSpoofed), /Semantic error/);
    assert.throws(() => validateOfflineInstallSemantics({ payload: bufSpoofed }), /Semantic error/);
    assert.throws(() => validateOfflineInstallSemantics([{ payload: bufSpoofed }]), /Semantic error/);
    assert.throws(() => validateS3MultipartSemantics(bufSpoofed), /MALFORMED_PAYLOAD_TYPE/);
    assert.throws(() => validateS3MultipartSemantics({ payload: bufSpoofed }), /MALFORMED_PAYLOAD_TYPE/);

    // Test all S3 PutObject and Error dispatch forms for Buffer spoofed view
    const bufPutDirect = dispatchS3PutObject(bufSpoofed);
    assert.equal(bufPutDirect.http_status, 400);
    assert.equal(bufPutDirect.error_code, 'InvalidDigest');
    assert.equal(bufPutDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    const bufPutPayloadBytes = dispatchS3PutObject({ payloadBytes: bufSpoofed });
    assert.equal(bufPutPayloadBytes.http_status, 400);
    assert.equal(bufPutPayloadBytes.error_code, 'InvalidDigest');
    assert.equal(bufPutPayloadBytes.reason, 'MALFORMED_PAYLOAD_TYPE');

    const bufPutPayload = dispatchS3PutObject({ payload: bufSpoofed });
    assert.equal(bufPutPayload.http_status, 400);
    assert.equal(bufPutPayload.error_code, 'InvalidDigest');
    assert.equal(bufPutPayload.reason, 'MALFORMED_PAYLOAD_TYPE');

    const bufPutBody = dispatchS3PutObject({ body: bufSpoofed });
    assert.equal(bufPutBody.http_status, 400);
    assert.equal(bufPutBody.error_code, 'InvalidDigest');
    assert.equal(bufPutBody.reason, 'MALFORMED_PAYLOAD_TYPE');

    const bufPutHeaders = dispatchS3PutObject({ headers: bufSpoofed });
    assert.equal(bufPutHeaders.http_status, 400);
    assert.equal(bufPutHeaders.error_code, 'InvalidDigest');
    assert.ok(bufPutHeaders.reason === 'MALFORMED_PAYLOAD_TYPE' || bufPutHeaders.reason === 'MALFORMED_HEADER_SYNTAX');

    const bufPutMd5 = dispatchS3PutObject(Buffer.from('valid payload'), bufSpoofed);
    assert.equal(bufPutMd5.http_status, 400);
    assert.equal(bufPutMd5.error_code, 'InvalidDigest');
    assert.equal(bufPutMd5.reason, 'MALFORMED_PAYLOAD_TYPE');

    const bufPutSha256 = dispatchS3PutObject(Buffer.from('valid payload'), undefined, bufSpoofed);
    assert.equal(bufPutSha256.http_status, 400);
    assert.equal(bufPutSha256.error_code, 'InvalidDigest');
    assert.equal(bufPutSha256.reason, 'MALFORMED_PAYLOAD_TYPE');

    assert.equal(dispatchS3PutObject({ payload: bufSpoofed, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true }).error_code, 'InvalidDigest');

    const bufErrDirect = dispatchS3Error(bufSpoofed);
    assert.equal(bufErrDirect.http_status, 400);
    assert.equal(bufErrDirect.error_code, 'InvalidDigest');
    assert.equal(bufErrDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    const bufErrErrCond = dispatchS3Error({ error_condition: bufSpoofed });
    assert.equal(bufErrErrCond.http_status, 400);
    assert.equal(bufErrErrCond.error_code, 'InvalidDigest');
    assert.equal(bufErrErrCond.reason, 'MALFORMED_PAYLOAD_TYPE');

    const bufErrReason = dispatchS3Error({ reason: bufSpoofed });
    assert.equal(bufErrReason.http_status, 400);
    assert.equal(bufErrReason.error_code, 'InvalidDigest');
    assert.equal(bufErrReason.reason, 'MALFORMED_PAYLOAD_TYPE');

    const bufErrHeaders = dispatchS3Error({ headers: bufSpoofed });
    assert.equal(bufErrHeaders.http_status, 400);
    assert.equal(bufErrHeaders.error_code, 'InvalidDigest');
    assert.ok(bufErrHeaders.reason === 'MALFORMED_PAYLOAD_TYPE' || bufErrHeaders.reason === 'MALFORMED_HEADER_SYNTAX');

    const bufErrHdr = dispatchS3Error('NoSuchKey', bufSpoofed);
    assert.equal(bufErrHdr.http_status, 400);
    assert.equal(bufErrHdr.error_code, 'InvalidDigest');
    assert.equal(bufErrHdr.reason, 'MALFORMED_PAYLOAD_TYPE');

    assert.equal(dispatchS3Error({ payload: bufSpoofed }).error_code, 'InvalidDigest');
    assert.equal(dispatchS3CompleteMultipartUpload(bufSpoofed).error_code, 'InvalidPart');
    assert.equal(dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] }, bufSpoofed).error_code, 'InvalidPart');
  }

  // 3. Plain objects spoofed to TypedArray prototypes
  const fakePlainU8 = Object.setPrototypeOf({ 0: 65, 1: 66, length: 2 }, Uint8Array.prototype);
  const fakePlainBuf = Object.setPrototypeOf({ 0: 65, 1: 66, length: 2 }, Buffer.prototype);
  for (const fake of [fakePlainU8, fakePlainBuf]) {
    assert.equal(isPureBufferOrUint8Array(fake), false);
    assert.equal(isMalformedPayloadType(fake), true);
    assert.throws(() => computePayloadMd5(fake), /Invalid payload type/);
    assert.throws(() => computePayloadSha256(fake), /Invalid payload type/);
    assert.throws(() => createSafePlainSnapshot(fake), /Semantic error/);
    assert.throws(() => createSafePlainSnapshot({ nested: fake }), /Semantic error/);
    assert.throws(() => validatePlatformSemantics(fake, 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validateOfflineInstallSemantics(fake), /Semantic error/);
    assert.throws(() => validateS3MultipartSemantics(fake), /Semantic error|MALFORMED_PAYLOAD_TYPE/);
    assert.equal(dispatchS3PutObject(fake).error_code, 'InvalidDigest');
    assert.equal(dispatchS3Error(fake).error_code, 'InvalidDigest');
    assert.equal(dispatchS3CompleteMultipartUpload(fake).error_code, 'InvalidPart');
  }

  // 4. ArrayBuffer instances spoofed to TypedArray prototypes
  const fakeAbU8 = Object.setPrototypeOf(new ArrayBuffer(8), Uint8Array.prototype);
  const fakeAbBuf = Object.setPrototypeOf(new ArrayBuffer(8), Buffer.prototype);
  for (const fake of [fakeAbU8, fakeAbBuf]) {
    assert.equal(isPureBufferOrUint8Array(fake), false);
    assert.equal(isMalformedPayloadType(fake), true);
    assert.throws(() => computePayloadMd5(fake), /Invalid payload type/);
    assert.throws(() => computePayloadSha256(fake), /Invalid payload type/);
    assert.throws(() => createSafePlainSnapshot(fake), /Semantic error/);
    assert.throws(() => createSafePlainSnapshot({ nested: fake }), /Semantic error/);
    assert.throws(() => validatePlatformSemantics(fake, 'provider-capability-advertisement'), /Semantic error/);
    assert.throws(() => validateOfflineInstallSemantics(fake), /Semantic error/);
    assert.throws(() => validateS3MultipartSemantics(fake), /Semantic error|MALFORMED_PAYLOAD_TYPE/);
    assert.equal(dispatchS3PutObject(fake).error_code, 'InvalidDigest');
    assert.equal(dispatchS3Error(fake).error_code, 'InvalidDigest');
    assert.equal(dispatchS3CompleteMultipartUpload(fake).error_code, 'InvalidPart');
  }

  // 5. Zero-getter error isolation on adversarial TypedArray subclasses
  const constructors = [
    Int8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array,
    BigInt64Array, BigUint64Array
  ];
  for (const Ctor of constructors) {
    let getterHit = false;
    class EvilSubclass extends Ctor {
      get evilField() {
        getterHit = true;
        return 'evil_value';
      }
    }
    const isBig = Ctor === BigInt64Array || Ctor === BigUint64Array;
    const evilInstU8 = Object.setPrototypeOf(new EvilSubclass(isBig ? [1n] : [1]), Uint8Array.prototype);
    const evilInstBuf = Object.setPrototypeOf(new EvilSubclass(isBig ? [1n] : [1]), Buffer.prototype);

    for (const evil of [evilInstU8, evilInstBuf]) {
      getterHit = false;
      assert.equal(isPureBufferOrUint8Array(evil), false);
      assert.equal(getterHit, false, 'isPureBufferOrUint8Array must not trigger getters');

      assert.throws(() => createSafePlainSnapshot(evil), /Semantic error/);
      assert.equal(getterHit, false, 'createSafePlainSnapshot must not trigger getters on root');

      assert.throws(() => createSafePlainSnapshot({ evil }), /Semantic error/);
      assert.equal(getterHit, false, 'createSafePlainSnapshot must not trigger getters on nested object');

      assert.throws(() => validatePlatformSemantics({ evil }, 'provider-capability-advertisement'), /Semantic error/);
      assert.equal(getterHit, false, 'validatePlatformSemantics must not trigger getters');

      assert.throws(() => validateOfflineInstallSemantics({ evil }), /Semantic error/);
      assert.equal(getterHit, false, 'validateOfflineInstallSemantics must not trigger getters');

      assert.throws(() => validateS3MultipartSemantics({ payload: evil }), /MALFORMED_PAYLOAD_TYPE/);
      assert.equal(getterHit, false, 'validateS3MultipartSemantics must not trigger getters');

      assert.equal(dispatchS3PutObject(evil).error_code, 'InvalidDigest');
      assert.equal(getterHit, false, 'dispatchS3PutObject must not trigger getters');

      assert.equal(dispatchS3Error(evil).error_code, 'InvalidDigest');
      assert.equal(getterHit, false, 'dispatchS3Error must not trigger getters');

      assert.equal(dispatchS3CompleteMultipartUpload(evil).error_code, 'InvalidPart');
      assert.equal(getterHit, false, 'dispatchS3CompleteMultipartUpload must not trigger getters');
    }
  }
});

test('OPEN-5 exhaustive 22-shape spoofed view matrix across platform and offline validation', () => {
  const nonUint8TypedArrayConstructors = [
    { name: 'Int8Array', create: () => new Int8Array([1, 2, 3]) },
    { name: 'Uint8ClampedArray', create: () => new Uint8ClampedArray([1, 2, 3]) },
    { name: 'Int16Array', create: () => new Int16Array([1, 2, 3]) },
    { name: 'Uint16Array', create: () => new Uint16Array([1, 2, 3]) },
    { name: 'Int32Array', create: () => new Int32Array([1, 2, 3]) },
    { name: 'Uint32Array', create: () => new Uint32Array([1, 2, 3]) },
    { name: 'Float32Array', create: () => new Float32Array([1.0, 2.0]) },
    { name: 'Float64Array', create: () => new Float64Array([1.0, 2.0]) },
    { name: 'BigInt64Array', create: () => new BigInt64Array([1n, 2n]) },
    { name: 'BigUint64Array', create: () => new BigUint64Array([1n, 2n]) },
  ];

  const allConstructors = [
    ...nonUint8TypedArrayConstructors,
    { name: 'DataView', create: () => new DataView(new ArrayBuffer(8)) },
  ];

  const targetPrototypes = [
    { protoName: 'Uint8Array.prototype', proto: Uint8Array.prototype },
    { protoName: 'Buffer.prototype', proto: Buffer.prototype },
  ];

  const spoofedMatrix = [];
  for (const ctor of allConstructors) {
    for (const target of targetPrototypes) {
      spoofedMatrix.push({
        name: `${ctor.name} -> ${target.protoName}`,
        ctorName: ctor.name,
        targetProtoName: target.protoName,
        createView: () => Object.setPrototypeOf(ctor.create(), target.proto),
      });
    }
  }

  assert.equal(spoofedMatrix.length, 22, 'Matrix must contain exactly 22 distinct spoofed views');

  for (const entry of spoofedMatrix) {
    const view = entry.createView();

    assert.equal(
      hasAnyAccessorsOrProxy(view),
      true,
      `${entry.name}: hasAnyAccessorsOrProxy(view) === true`
    );

    assert.equal(
      isPureBufferOrUint8Array(view),
      false,
      `${entry.name}: isPureBufferOrUint8Array(view) === false`
    );

    assert.equal(
      isMalformedPayloadType(view),
      true,
      `${entry.name}: isMalformedPayloadType(view) === true`
    );

    assert.throws(
      () => createSafePlainSnapshot(view),
      /Semantic error/,
      `${entry.name}: createSafePlainSnapshot(view) throws terminal Semantic error`
    );

    assert.throws(
      () => createSafePlainSnapshot({ nested: view }),
      /Semantic error/,
      `${entry.name}: createSafePlainSnapshot({ nested: view }) throws terminal Semantic error`
    );

    assert.throws(
      () => createSafePlainSnapshot([view]),
      /Semantic error/,
      `${entry.name}: createSafePlainSnapshot([view]) throws terminal Semantic error`
    );

    assert.throws(
      () => validatePlatformSemantics(view),
      /Semantic error/,
      `${entry.name}: validatePlatformSemantics(view) throws terminal Semantic error`
    );

    assert.throws(
      () => validatePlatformSemantics({ client_context: { view } }),
      /Semantic error/,
      `${entry.name}: validatePlatformSemantics({ client_context: { view } }) throws terminal Semantic error`
    );

    assert.throws(
      () => validateOfflineInstallSemantics(view),
      /Semantic error/,
      `${entry.name}: validateOfflineInstallSemantics(view) throws terminal Semantic error`
    );

    assert.throws(
      () => validateOfflineInstallSemantics({ artifacts: [{ path: 'art.bin', digest_payload: view }] }),
      /Semantic error/,
      `${entry.name}: validateOfflineInstallSemantics({ artifacts: [{ path: 'art.bin', digest_payload: view }] }) throws terminal Semantic error`
    );
  }
});

test('OPEN-2 exhaustive 22-shape spoofed view matrix across S3 PutObject and Error dispatch', () => {
  const nonUint8Variants = [
    { name: 'Int8Array', create: () => new Int8Array([1, 2, 3]) },
    { name: 'Uint8ClampedArray', create: () => new Uint8ClampedArray([1, 2, 3]) },
    { name: 'Int16Array', create: () => new Int16Array([1, 2, 3]) },
    { name: 'Uint16Array', create: () => new Uint16Array([1, 2, 3]) },
    { name: 'Int32Array', create: () => new Int32Array([1, 2, 3]) },
    { name: 'Uint32Array', create: () => new Uint32Array([1, 2, 3]) },
    { name: 'Float32Array', create: () => new Float32Array([1.0, 2.0]) },
    { name: 'Float64Array', create: () => new Float64Array([1.0, 2.0]) },
    { name: 'BigInt64Array', create: () => new BigInt64Array([1n, 2n]) },
    { name: 'BigUint64Array', create: () => new BigUint64Array([1n, 2n]) },
    { name: 'DataView', create: () => new DataView(new ArrayBuffer(8)) },
  ];

  const validPayload = Buffer.from('valid payload for spoof test');

  for (const variant of nonUint8Variants) {
    for (const [protoName, proto] of [
      ['Uint8Array.prototype', Uint8Array.prototype],
      ['Buffer.prototype', Buffer.prototype],
    ]) {
      const view = Object.setPrototypeOf(variant.create(), proto);
      const label = `${variant.name} spoofed as ${protoName}`;

      // 1. dispatchS3PutObject(view) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const putDirect = dispatchS3PutObject(view);
      assert.equal(putDirect.http_status, 400, `${label}: dispatchS3PutObject(view) http_status`);
      assert.equal(putDirect.error_code, 'InvalidDigest', `${label}: dispatchS3PutObject(view) error_code`);
      assert.equal(putDirect.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3PutObject(view) reason`);

      // 2. dispatchS3PutObject({ payloadBytes: view }) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const putPayloadBytes = dispatchS3PutObject({ payloadBytes: view });
      assert.equal(putPayloadBytes.http_status, 400, `${label}: dispatchS3PutObject({ payloadBytes: view }) http_status`);
      assert.equal(putPayloadBytes.error_code, 'InvalidDigest', `${label}: dispatchS3PutObject({ payloadBytes: view }) error_code`);
      assert.equal(putPayloadBytes.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3PutObject({ payloadBytes: view }) reason`);

      // 3. dispatchS3PutObject({ payload: view }) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const putPayload = dispatchS3PutObject({ payload: view });
      assert.equal(putPayload.http_status, 400, `${label}: dispatchS3PutObject({ payload: view }) http_status`);
      assert.equal(putPayload.error_code, 'InvalidDigest', `${label}: dispatchS3PutObject({ payload: view }) error_code`);
      assert.equal(putPayload.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3PutObject({ payload: view }) reason`);

      // 4. dispatchS3PutObject({ body: view }) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const putBody = dispatchS3PutObject({ body: view });
      assert.equal(putBody.http_status, 400, `${label}: dispatchS3PutObject({ body: view }) http_status`);
      assert.equal(putBody.error_code, 'InvalidDigest', `${label}: dispatchS3PutObject({ body: view }) error_code`);
      assert.equal(putBody.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3PutObject({ body: view }) reason`);

      // 5. dispatchS3PutObject({ headers: view }) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE or MALFORMED_HEADER_SYNTAX)
      const putHeaders = dispatchS3PutObject({ headers: view });
      assert.equal(putHeaders.http_status, 400, `${label}: dispatchS3PutObject({ headers: view }) http_status`);
      assert.equal(putHeaders.error_code, 'InvalidDigest', `${label}: dispatchS3PutObject({ headers: view }) error_code`);
      assert.ok(
        putHeaders.reason === 'MALFORMED_PAYLOAD_TYPE' || putHeaders.reason === 'MALFORMED_HEADER_SYNTAX',
        `${label}: dispatchS3PutObject({ headers: view }) reason`
      );

      // 6. dispatchS3PutObject(validPayload, view) (maybeMd5Header) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const putMd5Hdr = dispatchS3PutObject(validPayload, view);
      assert.equal(putMd5Hdr.http_status, 400, `${label}: dispatchS3PutObject(validPayload, view) http_status`);
      assert.equal(putMd5Hdr.error_code, 'InvalidDigest', `${label}: dispatchS3PutObject(validPayload, view) error_code`);
      assert.equal(putMd5Hdr.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3PutObject(validPayload, view) reason`);

      // 7. dispatchS3PutObject(validPayload, undefined, view) (maybeSha256Header) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const putSha256Hdr = dispatchS3PutObject(validPayload, undefined, view);
      assert.equal(putSha256Hdr.http_status, 400, `${label}: dispatchS3PutObject(validPayload, undefined, view) http_status`);
      assert.equal(putSha256Hdr.error_code, 'InvalidDigest', `${label}: dispatchS3PutObject(validPayload, undefined, view) error_code`);
      assert.equal(putSha256Hdr.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3PutObject(validPayload, undefined, view) reason`);

      // 8. dispatchS3Error(view) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const errDirect = dispatchS3Error(view);
      assert.equal(errDirect.http_status, 400, `${label}: dispatchS3Error(view) http_status`);
      assert.equal(errDirect.error_code, 'InvalidDigest', `${label}: dispatchS3Error(view) error_code`);
      assert.equal(errDirect.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3Error(view) reason`);

      // 9. dispatchS3Error({ error_condition: view }) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const errErrCond = dispatchS3Error({ error_condition: view });
      assert.equal(errErrCond.http_status, 400, `${label}: dispatchS3Error({ error_condition: view }) http_status`);
      assert.equal(errErrCond.error_code, 'InvalidDigest', `${label}: dispatchS3Error({ error_condition: view }) error_code`);
      assert.equal(errErrCond.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3Error({ error_condition: view }) reason`);

      // 10. dispatchS3Error({ reason: view }) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const errReason = dispatchS3Error({ reason: view });
      assert.equal(errReason.http_status, 400, `${label}: dispatchS3Error({ reason: view }) http_status`);
      assert.equal(errReason.error_code, 'InvalidDigest', `${label}: dispatchS3Error({ reason: view }) error_code`);
      assert.equal(errReason.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3Error({ reason: view }) reason`);

      // 11. dispatchS3Error({ headers: view }) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE or MALFORMED_HEADER_SYNTAX)
      const errHeaders = dispatchS3Error({ headers: view });
      assert.equal(errHeaders.http_status, 400, `${label}: dispatchS3Error({ headers: view }) http_status`);
      assert.equal(errHeaders.error_code, 'InvalidDigest', `${label}: dispatchS3Error({ headers: view }) error_code`);
      assert.ok(
        errHeaders.reason === 'MALFORMED_PAYLOAD_TYPE' || errHeaders.reason === 'MALFORMED_HEADER_SYNTAX',
        `${label}: dispatchS3Error({ headers: view }) reason`
      );

      // 12. dispatchS3Error('NoSuchKey', view) (maybeHeader) -> HTTP 400 InvalidDigest (MALFORMED_PAYLOAD_TYPE)
      const errHdr = dispatchS3Error('NoSuchKey', view);
      assert.equal(errHdr.http_status, 400, `${label}: dispatchS3Error('NoSuchKey', view) http_status`);
      assert.equal(errHdr.error_code, 'InvalidDigest', `${label}: dispatchS3Error('NoSuchKey', view) error_code`);
      assert.equal(errHdr.reason, 'MALFORMED_PAYLOAD_TYPE', `${label}: dispatchS3Error('NoSuchKey', view) reason`);
    }
  }
});

test('OPEN-2 exhaustive 22-shape spoofed view matrix across CompleteMultipartUpload and multipart semantics', () => {
  const nonUint8Variants = [
    { name: 'Int8Array', create: () => new Int8Array([1, 2, 3]) },
    { name: 'Uint8ClampedArray', create: () => new Uint8ClampedArray([1, 2, 3]) },
    { name: 'Int16Array', create: () => new Int16Array([1, 2, 3]) },
    { name: 'Uint16Array', create: () => new Uint16Array([1, 2, 3]) },
    { name: 'Int32Array', create: () => new Int32Array([1, 2, 3]) },
    { name: 'Uint32Array', create: () => new Uint32Array([1, 2, 3]) },
    { name: 'Float32Array', create: () => new Float32Array([1.0, 2.0]) },
    { name: 'Float64Array', create: () => new Float64Array([1.0, 2.0]) },
    { name: 'BigInt64Array', create: () => new BigInt64Array([1n, 2n]) },
    { name: 'BigUint64Array', create: () => new BigUint64Array([1n, 2n]) },
    { name: 'DataView', create: () => new DataView(new ArrayBuffer(8)) },
  ];

  const validManifest = {
    parts: [
      {
        part_number: 1,
        etag: '"0123456789abcdef0123456789abcdef"',
        size_bytes: 5242880,
      },
    ],
  };

  let testedShapes = 0;
  for (const variant of nonUint8Variants) {
    const u8Spoofed = Object.setPrototypeOf(variant.create(), Uint8Array.prototype);
    const bufSpoofed = Object.setPrototypeOf(variant.create(), Buffer.prototype);

    for (const view of [u8Spoofed, bufSpoofed]) {
      testedShapes++;

      // 1. dispatchS3CompleteMultipartUpload(view) -> HTTP 400 InvalidPart (INVALID_MULTIPART_MANIFEST_STRUCTURE or MALFORMED_PAYLOAD_TYPE)
      const res1 = dispatchS3CompleteMultipartUpload(view);
      assert.equal(res1.http_status, 400);
      assert.equal(res1.error_code, 'InvalidPart');
      assert.ok(
        res1.reason === 'INVALID_MULTIPART_MANIFEST_STRUCTURE' || res1.reason === 'MALFORMED_PAYLOAD_TYPE',
        `res1.reason should be INVALID_MULTIPART_MANIFEST_STRUCTURE or MALFORMED_PAYLOAD_TYPE, got ${res1.reason}`
      );

      // 2. dispatchS3CompleteMultipartUpload({ manifest: view }) -> HTTP 400 InvalidPart
      const res2 = dispatchS3CompleteMultipartUpload({ manifest: view });
      assert.equal(res2.http_status, 400);
      assert.equal(res2.error_code, 'InvalidPart');

      // 3. dispatchS3CompleteMultipartUpload({ parts: [view] }) -> HTTP 400 InvalidPart
      const res3 = dispatchS3CompleteMultipartUpload({ parts: [view] });
      assert.equal(res3.http_status, 400);
      assert.equal(res3.error_code, 'InvalidPart');

      // 4. dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: view }] }) -> HTTP 400 InvalidPart
      const res4 = dispatchS3CompleteMultipartUpload({
        parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: view }],
      });
      assert.equal(res4.http_status, 400);
      assert.equal(res4.error_code, 'InvalidPart');

      // 5. dispatchS3CompleteMultipartUpload(validManifest, view) (direct storedParts) -> HTTP 400 InvalidPart
      const res5 = dispatchS3CompleteMultipartUpload(validManifest, view);
      assert.equal(res5.http_status, 400);
      assert.equal(res5.error_code, 'InvalidPart');

      // 6. dispatchS3CompleteMultipartUpload(validManifest, [view]) (storedParts array element) -> HTTP 400 InvalidPart
      const res6 = dispatchS3CompleteMultipartUpload(validManifest, [view]);
      assert.equal(res6.http_status, 400);
      assert.equal(res6.error_code, 'InvalidPart');

      // 7. dispatchS3CompleteMultipartUpload(validManifest, new Map([[1, view]])) (storedParts Map element) -> HTTP 400 InvalidPart
      const res7 = dispatchS3CompleteMultipartUpload(validManifest, new Map([[1, view]]));
      assert.equal(res7.http_status, 400);
      assert.equal(res7.error_code, 'InvalidPart');

      // 8. validateS3MultipartSemantics(view) -> throws InvalidPart or MALFORMED_PAYLOAD_TYPE
      assert.throws(
        () => validateS3MultipartSemantics(view),
        /InvalidPart|MALFORMED_PAYLOAD_TYPE/,
        'validateS3MultipartSemantics must reject spoofed view directly'
      );

      // 9. validateS3MultipartSemantics({ parts: [view] }) -> throws InvalidPart
      assert.throws(
        () => validateS3MultipartSemantics({ parts: [view] }),
        /InvalidPart/,
        'validateS3MultipartSemantics must reject spoofed view in parts array'
      );

      // 10. validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: view }] }) -> throws InvalidPart
      assert.throws(
        () => validateS3MultipartSemantics({
          parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: view }],
        }),
        /InvalidPart/,
        'validateS3MultipartSemantics must reject spoofed view in part size_bytes'
      );

      // 11. validateS3MultipartSemantics({ payload: view }) -> throws InvalidPart or MALFORMED_PAYLOAD_TYPE
      assert.throws(
        () => validateS3MultipartSemantics({ payload: view }),
        /InvalidPart|MALFORMED_PAYLOAD_TYPE/,
        'validateS3MultipartSemantics must reject spoofed view in payload wrapper'
      );
    }
  }

  assert.equal(testedShapes, 22, 'Must have tested exactly 22 spoofed view shapes');
});
