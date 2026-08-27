import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

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

const CORE_13_S3_OPERATIONS = [
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
    instancePath: '/required_operations/13',
  },
  'invalid-s3-missing-retention-mode.json': {
    schemaId: RETENTION_DEF_ID,
    keyword: 'required',
    instancePath: '',
    missingProperty: 'retention_mode',
  },
  'invalid-s3-malformed-digest.json': {
    schemaId: MULTIPART_DEF_ID,
    keyword: 'pattern',
    instancePath: '/parts/0/sha256',
  },
};

test('validate negative storage fixtures (single-defect isolation)', () => {
  const negativeFiles = readdirSync(join(EXAMPLES_STORAGE_DIR, 'negative')).filter((f) =>
    f.endsWith('.json')
  );
  assert.equal(
    negativeFiles.length,
    Object.keys(EXPECTED_STORAGE_NEGATIVES).length,
    'Must have exactly 3 negative fixtures in contracts/examples/storage/negative'
  );

  for (const file of negativeFiles) {
    const expected = EXPECTED_STORAGE_NEGATIVES[file];
    assert.ok(expected, `No expected defect mapping for negative fixture ${file}`);

    const filePath = join(EXAMPLES_STORAGE_DIR, 'negative', file);
    assert.ok(existsSync(filePath), `Missing negative fixture: ${filePath}`);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

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

test('cover all 13 core S3 operations in operations catalog', () => {
  const validateOp = ajv.getSchema(S3_OP_DEF_ID);
  assert.ok(validateOp, `Missing schema for ${S3_OP_DEF_ID}`);

  for (const op of CORE_13_S3_OPERATIONS) {
    assert.ok(validateOp(op), `Core operation '${op}' must be valid in s3Operation definition`);
  }

  // Non-S3 operations must fail
  assert.ok(!validateOp('PutObjectAclUnsupported'));
  assert.equal(validateOp.errors.length, 1);
  assert.ok(!validateOp('RestoreObjectTier'));
  assert.equal(validateOp.errors.length, 1);
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

test('object key normalization and path formatting', () => {
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
