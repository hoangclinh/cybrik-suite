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
  verifyDigestErrorDispatch,
  verifyMalformedHeaderDispatch,
  validateS3MultipartSemantics,
  validatePlatformSemantics,
  S3_CANONICAL_ERROR_CODES,
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
    error_condition: 'MALFORMED_DIGEST_HEADER',
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
      continue;
    }

    const expected = EXPECTED_STORAGE_NEGATIVES[file];
    assert.ok(expected, `No expected defect mapping for negative fixture ${file}`);

    const valid = ajv.validate(expected.schemaId, data);
    assert.ok(!valid, `Negative fixture ${file} unexpectedly passed validation`);

    assert.equal(
      ajv.errors.length,
      1,
      `Expected exactly 1 isolated defect for ${file}, found ${ajv.errors.length}: ${JSON.stringify(ajv.errors)}`
    );

    const error = ajv.errors[0];
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

test('cover all 17 S3 operations in closed operations catalog', () => {
  const validateOp = ajv.getSchema(S3_OP_DEF_ID);
  assert.ok(validateOp, `Missing schema for ${S3_OP_DEF_ID}`);

  for (const op of CLOSED_17_S3_OPERATIONS) {
    assert.ok(validateOp(op), `Operation '${op}' must be valid in s3Operation definition`);
  }

  // Non-S3 operations or excluded operations must fail
  assert.ok(!validateOp('PutObjectAclUnsupported'));
  assert.equal(validateOp.errors.length, 1);
  assert.ok(!validateOp('RestoreObjectTier'));
  assert.equal(validateOp.errors.length, 1);
  assert.ok(!validateOp('PutBucketVersioning'));
  assert.equal(validateOp.errors.length, 1);
  assert.ok(!validateOp('GetBucketVersioning'));
  assert.equal(validateOp.errors.length, 1);
  assert.ok(!validateOp('ListBuckets'));
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

  const badObjectLock = { ...baseProfile, object_lock_supported: false };
  assert.ok(!ajv.validate(PROFILE_DEF_ID, badObjectLock));
  assert.equal(ajv.errors[0].keyword, 'const');

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

  const invalidDigestDispatch = verifyMalformedHeaderDispatch(malformedFixture.content_md5_header);
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
  const matchA = dispatchS3PutObject({ payloadBytes: payloadA, contentMd5Header: digestA });
  assert.equal(matchA.http_status, 200);
  assert.equal(matchA.error_code, null);

  const matchAErr = dispatchS3Error({ payloadBytes: payloadA, contentMd5Header: digestA });
  assert.equal(matchAErr.http_status, 200);
  assert.equal(matchAErr.error_code, null);

  const matchB = dispatchS3PutObject({ payloadBytes: payloadB, contentMd5Header: digestB });
  assert.equal(matchB.http_status, 200);
  assert.equal(matchB.error_code, null);

  const matchEmpty = dispatchS3PutObject({ payloadBytes: emptyPayload, contentMd5Header: digestEmpty });
  assert.equal(matchEmpty.http_status, 200);
  assert.equal(matchEmpty.error_code, null);

  const matchBinary = dispatchS3PutObject({ payloadBytes: binaryPayload, contentMd5Header: digestBinary });
  assert.equal(matchBinary.http_status, 200);
  assert.equal(matchBinary.error_code, null);

  // 2. Real byte mismatch: ALWAYS returns BadDigest (HTTP 400), strictly never InvalidArgument or AccessDenied
  const mismatch1 = dispatchS3PutObject({ payloadBytes: payloadA, contentMd5Header: digestB });
  assert.equal(mismatch1.http_status, 400);
  assert.equal(mismatch1.error_code, 'BadDigest');
  assert.equal(mismatch1.reason, 'PAYLOAD_DIGEST_MISMATCH');
  assert.notEqual(mismatch1.error_code, 'InvalidArgument');
  assert.notEqual(mismatch1.error_code, 'AccessDenied');

  const mismatch1Err = dispatchS3Error({ payloadBytes: payloadA, contentMd5Header: digestB });
  assert.equal(mismatch1Err.http_status, 400);
  assert.equal(mismatch1Err.error_code, 'BadDigest');
  assert.equal(mismatch1Err.reason, 'PAYLOAD_DIGEST_MISMATCH');

  const mismatch2 = dispatchS3PutObject({ payloadBytes: payloadB, contentMd5Header: digestA });
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
    const malformedRes = dispatchS3PutObject({ payloadBytes: payloadA, contentMd5Header: badHdr });
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
  assert.equal(streamingRes.reason, 'MALFORMED_HEADER_SYNTAX');

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
      { part_number: 1, etag: '"etag-part-1"', size_bytes: 5242880 },
      { part_number: 2, etag: '"etag-part-2"', size_bytes: 5242880 },
    ],
    total_parts: 2,
    total_size_bytes: 10485760,
  };

  // 1. Success with Map
  const validMap = new Map([
    [1, { etag: '"etag-part-1"' }],
    [2, { etag: '"etag-part-2"' }],
  ]);
  const okMapRes = dispatchS3CompleteMultipartUpload(manifest, validMap);
  assert.equal(okMapRes.http_status, 200);
  assert.equal(okMapRes.error_code, null);

  // 2. Success with Object
  const validObj = {
    1: { etag: '"etag-part-1"' },
    2: { etag: '"etag-part-2"' },
  };
  const okObjRes = dispatchS3CompleteMultipartUpload(manifest, validObj);
  assert.equal(okObjRes.http_status, 200);
  assert.equal(okObjRes.error_code, null);

  // 3. Missing part with Map -> MissingStoredPartETag
  const missingMap = new Map([
    [1, { etag: '"etag-part-1"' }],
  ]);
  const missingMapRes = dispatchS3CompleteMultipartUpload(manifest, missingMap);
  assert.equal(missingMapRes.http_status, 400);
  assert.equal(missingMapRes.error_code, 'InvalidPart');
  assert.equal(missingMapRes.code, 'InvalidPart');
  assert.ok(missingMapRes.reason === 'MissingStoredPartETag' || missingMapRes.reason === 'MISSING_PART');

  // 4. Missing part with Object -> MissingStoredPartETag
  const missingObj = {
    1: { etag: '"etag-part-1"' },
  };
  const missingObjRes = dispatchS3CompleteMultipartUpload(manifest, missingObj);
  assert.equal(missingObjRes.http_status, 400);
  assert.equal(missingObjRes.error_code, 'InvalidPart');
  assert.ok(missingObjRes.reason === 'MissingStoredPartETag' || missingObjRes.reason === 'MISSING_PART');

  // 5. ETag mismatch with Map -> ETagMismatch
  const mismatchMap = new Map([
    [1, { etag: '"etag-part-1"' }],
    [2, { etag: '"mismatched-etag"' }],
  ]);
  const mismatchMapRes = dispatchS3CompleteMultipartUpload(manifest, mismatchMap);
  assert.equal(mismatchMapRes.http_status, 400);
  assert.equal(mismatchMapRes.error_code, 'InvalidPart');
  assert.equal(mismatchMapRes.code, 'InvalidPart');
  assert.ok(mismatchMapRes.reason === 'ETagMismatch' || mismatchMapRes.reason === 'PART_ETAG_MISMATCH');

  // 6. ETag mismatch with Object -> ETagMismatch
  const mismatchObj = {
    1: { etag: '"etag-part-1"' },
    2: { etag: '"mismatched-etag"' },
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
  assert.equal(computePayloadSha256(null), createHash('sha256').update(Buffer.alloc(0)).digest('hex'));
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
      { part_number: 2, etag: '"mismatched-etag-value-000000000"' },
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
    { part_number: 1, etag: '"a"', size_bytes: 1024 },
    { part_number: 2, etag: '"b"', size_bytes: 5242880 },
  ];
  const smallPartRes = dispatchS3CompleteMultipartUpload({
    parts: [{ part_number: 1, etag: '"a"' }, { part_number: 2, etag: '"b"' }],
    storedParts: smallPartStored,
  });
  assert.equal(smallPartRes.http_status, 400);
  assert.equal(smallPartRes.error_code, 'EntityTooSmall');

  // 8. Negative: part too large returns HTTP 400 EntityTooLarge
  const largePartStored = [
    { part_number: 1, etag: '"a"', size_bytes: 5368709121 },
  ];
  const largePartRes = dispatchS3CompleteMultipartUpload({
    parts: [{ part_number: 1, etag: '"a"' }],
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
    [1, { part_number: 1, etag: '"hash1"', size_bytes: 5242880 }],
    [2, { part_number: 2, etag: '"hash2"', size_bytes: 5242880 }],
  ]);
  const mapRes = dispatchS3CompleteMultipartUpload({
    parts: [{ part_number: 1, etag: '"hash1"' }, { part_number: 2, etag: '"hash2"' }],
    storedParts: storedMap,
  });
  assert.equal(mapRes.http_status, 200);

  const storedObj = {
    1: { part_number: 1, etag: '"hash1"', size_bytes: 5242880 },
    2: { part_number: 2, etag: '"hash2"', size_bytes: 5242880 },
  };
  const objRes = dispatchS3CompleteMultipartUpload({
    manifest: {
      parts: [{ PartNumber: 1, ETag: '"hash1"' }, { PartNumber: 2, ETag: '"hash2"' }],
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
  assert.equal(fallbackObjRes.error_code, 'BadDigest');

  const fallbackPrimRes = dispatchS3Error(12345);
  assert.equal(fallbackPrimRes.http_status, 400);
  assert.equal(fallbackPrimRes.error_code, 'BadDigest');
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
  assert.equal(isMalformedSha256('A'.repeat(64)), false);
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
      { part_number: 1, etag: '"etag-1"', size_bytes: 5242880 },
      { part_number: 2, etag: '"etag-2"', size_bytes: 5242880 },
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
      { part_number: 2, etag: '"etag-2"' },
    ],
  };
  const validStored = new Map([
    [1, { etag: '"etag-1"' }],
    [2, { etag: '"etag-2"' }],
  ]);
  const missingEtagRes = dispatchS3CompleteMultipartUpload(missingEtagManifest, validStored);
  assert.equal(missingEtagRes.http_status, 400);
  assert.equal(missingEtagRes.error_code, 'InvalidPart');
  assert.equal(missingEtagRes.reason, 'MissingManifestPartETag');

  const noEtagFieldManifest = {
    parts: [
      { part_number: 1 },
      { part_number: 2, etag: '"etag-2"' },
    ],
  };
  const noEtagRes = dispatchS3CompleteMultipartUpload(noEtagFieldManifest, validStored);
  assert.equal(noEtagRes.http_status, 400);
  assert.equal(noEtagRes.error_code, 'InvalidPart');
  assert.equal(noEtagRes.reason, 'MissingManifestPartETag');

  // 3. Stored part missing or stored part ETag missing/blank -> MissingStoredPartETag
  const missingPartStored = new Map([
    [1, { etag: '"etag-1"' }],
  ]);
  const missingPartRes = dispatchS3CompleteMultipartUpload(manifest, missingPartStored);
  assert.equal(missingPartRes.http_status, 400);
  assert.equal(missingPartRes.error_code, 'InvalidPart');
  assert.equal(missingPartRes.reason, 'MissingStoredPartETag');

  const blankStoredEtag = new Map([
    [1, { etag: '"etag-1"' }],
    [2, { etag: '  ' }],
  ]);
  const blankStoredRes = dispatchS3CompleteMultipartUpload(manifest, blankStoredEtag);
  assert.equal(blankStoredRes.http_status, 400);
  assert.equal(blankStoredRes.error_code, 'InvalidPart');
  assert.equal(blankStoredRes.reason, 'MissingStoredPartETag');

  // 4. Stored part ETag mismatch -> ETagMismatch
  const mismatchStored = new Map([
    [1, { etag: '"etag-1"' }],
    [2, { etag: '"wrong-etag"' }],
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
  assert.equal(unquotedRes.reason, 'ETagMismatch');

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
  assert.equal(res.reason, 'MALFORMED_HEADER_SYNTAX');
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

  // 2. Direct empty array as argument returns HTTP 400 InvalidArgument (EmptyPartsList)
  const directEmptyRes = dispatchS3CompleteMultipartUpload([], storedParts);
  assert.equal(directEmptyRes.http_status, 400);
  assert.equal(directEmptyRes.error_code, 'InvalidArgument');
  assert.equal(directEmptyRes.reason, 'EmptyPartsList');
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

test('dispatchS3CompleteMultipartUpload fails with MissingStoredPartETag when stored-part entry is null (Finding 4 / OPEN-2)', () => {
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
  assert.equal(res.reason, 'MissingStoredPartETag');
});

test('dispatchS3CompleteMultipartUpload fails with ETagMismatch on quoted vs unquoted ETags (Finding 5 / OPEN-2)', () => {
  const manifest = {
    parts: [
      { part_number: 1, etag: '"abc"', size_bytes: 5242880 },
    ],
  };
  const storedUnquoted = new Map([
    [1, { part_number: 1, etag: 'abc', size_bytes: 5242880 }],
  ]);

  const res = dispatchS3CompleteMultipartUpload(manifest, storedUnquoted);
  assert.equal(res.http_status, 400);
  assert.equal(res.error_code, 'InvalidPart');
  assert.equal(res.reason, 'ETagMismatch');

  // Also test manifest unquoted vs stored quoted
  const manifestUnquoted = {
    parts: [
      { part_number: 1, etag: 'abc', size_bytes: 5242880 },
    ],
  };
  const storedQuoted = new Map([
    [1, { part_number: 1, etag: '"abc"', size_bytes: 5242880 }],
  ]);
  const res2 = dispatchS3CompleteMultipartUpload(manifestUnquoted, storedQuoted);
  assert.equal(res2.http_status, 400);
  assert.equal(res2.error_code, 'InvalidPart');
  assert.equal(res2.reason, 'ETagMismatch');
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
        { part_number: 1, etag: '"etag-1"', size_bytes: 5242880 },
      ],
    },
    storedParts: new Map([[1, { etag: '"etag-1"', size_bytes: 5242880 }]]),
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
