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

const CLOSED_12_S3_ERROR_CODES = [
  'BadDigest',
  'InvalidDigest',
  'NoSuchBucket',
  'NoSuchKey',
  'NoSuchUpload',
  'ObjectLockConfigurationNotFoundError',
  'PreconditionFailed',
  'AccessDenied',
  'EntityTooLarge',
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

test('cover all 12 S3 error codes in conformance profile error code enum', () => {
  const sampleProfilePath = join(EXAMPLES_STORAGE_DIR, 'positive/s3-storage-conformance-profile.json');
  const baseProfile = JSON.parse(readFileSync(sampleProfilePath, 'utf8'));

  for (const errCode of CLOSED_12_S3_ERROR_CODES) {
    const mutated = {
      ...baseProfile,
      required_error_codes: [errCode, ...CLOSED_12_S3_ERROR_CODES.filter((c) => c !== errCode)],
    };
    assert.ok(ajv.validate(PROFILE_DEF_ID, mutated), `Error code '${errCode}' must be valid`);
  }

  const badErrorCodeProfile = {
    ...baseProfile,
    required_error_codes: ['NonExistentErrorCode', ...CLOSED_12_S3_ERROR_CODES.slice(1)],
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
