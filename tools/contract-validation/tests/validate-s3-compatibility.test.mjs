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
  computePayloadMd5,
  isMalformedBase64Md5,
  verifyDigestErrorDispatch,
  verifyMalformedHeaderDispatch,
  validateS3MultipartSemantics,
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

  // 2. Negative: duplicate part numbers (same ETag) throws /duplicate part_number/
  const dupPartSameEtag = JSON.parse(JSON.stringify(validManifest));
  dupPartSameEtag.parts.push({
    part_number: 2,
    etag: "\"c8f9e2b1d0a3c4e5f6a7b8c9d0e1f2a3\"",
    sha256: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    size_bytes: 5242880,
  });
  dupPartSameEtag.total_parts = 4;
  dupPartSameEtag.total_size_bytes = 20971520;
  assert.throws(
    () => validateS3MultipartSemantics(dupPartSameEtag),
    /duplicate part_number/,
    'Duplicate part_number with same ETag must throw /duplicate part_number/'
  );

  // 2b. Negative: duplicate part numbers (different ETags) throws /duplicate part_number/
  const dupPartDiffEtag = JSON.parse(JSON.stringify(validManifest));
  dupPartDiffEtag.parts.push({
    part_number: 1,
    etag: "\"ffffffffffffffffffffffffffffffff\"",
    sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    size_bytes: 5242880,
  });
  dupPartDiffEtag.total_parts = 4;
  dupPartDiffEtag.total_size_bytes = 20971520;
  assert.throws(
    () => validateS3MultipartSemantics(dupPartDiffEtag),
    /duplicate part_number/,
    'Duplicate part_number with different ETag must throw /duplicate part_number/'
  );

  // 3. Negative: descending part numbers throws /strictly ascending order \(InvalidPartOrder\)/
  const descendingParts = JSON.parse(JSON.stringify(validManifest));
  descendingParts.parts = [
    validManifest.parts[2], // part 3
    validManifest.parts[1], // part 2
    validManifest.parts[0], // part 1
  ];
  assert.throws(
    () => validateS3MultipartSemantics(descendingParts),
    /strictly ascending order \(InvalidPartOrder\)/,
    'Descending part numbers must throw /strictly ascending order (InvalidPartOrder)/'
  );

  // 3b. Negative: unordered / out-of-order part numbers throws /strictly ascending order \(InvalidPartOrder\)/
  const unorderedParts = JSON.parse(JSON.stringify(validManifest));
  unorderedParts.parts = [
    validManifest.parts[0], // part 1
    validManifest.parts[2], // part 3
    validManifest.parts[1], // part 2
  ];
  assert.throws(
    () => validateS3MultipartSemantics(unorderedParts),
    /strictly ascending order \(InvalidPartOrder\)/,
    'Unordered part numbers must throw /strictly ascending order (InvalidPartOrder)/'
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
