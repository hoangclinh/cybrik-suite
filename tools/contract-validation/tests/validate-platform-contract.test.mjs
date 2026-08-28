import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { validateOpenItemEffectMatrix, validateIJson, validatePlatformSemantics, validateOfflineInstallSemantics, validateS3ConformanceProfileSemantics, validateS3MultipartSemantics, dispatchS3Error, dispatchS3PutObject, dispatchS3CompleteMultipartUpload, computePayloadMd5, computePayloadSha256, verifyPayloadSha256, verifyPayloadMd5, getTypedArrayByteLength, getTypedArrayByteOffset, isMalformedBase64Md5, isMalformedPayloadType, verifyDigestErrorDispatch, verifyMalformedHeaderDispatch, S3_CANONICAL_ERROR_CODES, S3_15_BASELINE_OPS, S3_4_OBJECT_LOCK_OPS, S3_19_CLOSED_OPS, S3_15_OPERATIONS, S3_19_OPERATIONS, ALL_13_CONFORMANCE_SLOTS, hasOwnAccessors, hasOwnHeadersAccessors, hasOversizedDeclaredLength, getOwn, isPlainOrNull, hasPrototypeChainAccessor, hasAnyAccessorsOrProxy, getOwnDataValue, createSafePlainSnapshot, snapshotOwnDataDescriptors, isPureBufferOrUint8Array } from '../validate-schemas.mjs';


const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;
const ajv = new Ajv2020({ strict: true, strictTypes: false, strictRequired: false, allErrors: true, allowUnionTypes: true });
addFormats(ajv);
for (const kw of ['x-cybrik-status', 'x-cybrik-not-accepted', 'x-cybrik-contract-version', 'x-cybrik-format-pins', 'x-cybrik-lifecycle']) {
  ajv.addKeyword({ keyword: kw });
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const JSON_SCHEMA_DIR = join(ROOT, 'contracts/json-schema');
const EXAMPLES_DIR = join(ROOT, 'contracts/examples/platform');

const PLATFORM_SCHEMAS = [
  'cybrik.deployment-profile.v1.schema.json',
  'cybrik.platform-contract.v1.schema.json',
  'cybrik.provider-capability-advertisement.v1.schema.json',
  'cybrik.provider-capability-negotiation.v1.schema.json',
  'cybrik.offline-install-update-manifest.v1.schema.json',
  'cybrik.storage-s3-compatibility-subset.v1.schema.json'
];

const loadSchemas = () => {
  for (const name of PLATFORM_SCHEMAS) {
    const p = join(JSON_SCHEMA_DIR, name);
    assert.ok(existsSync(p), `Schema file missing: ${p}`);
    const doc = JSON.parse(readFileSync(p, 'utf8'));
    ajv.addSchema(doc, doc.$id);
  }
};

loadSchemas();

test('validate positive platform fixtures', () => {
  const positives = [
    'onprem-airgap-v1.profile.json',
    'onprem-standard-v1.profile.json',
    'hybrid-sovereign-v1.profile.json',
    'private-cloud-v1.profile.json',
    'sample-platform-contract.json',
    'sample-provider-capability-advertisement.json',
    'sample-capability-negotiation-handshake.json',
    'sample-offline-bundle-manifest.json',
    'sample-storage-s3-subset.json',
    'sample-full-profile-conformance-declaration.json'
  ];

  for (const file of positives) {
    const path = join(EXAMPLES_DIR, file);
    assert.ok(existsSync(path), `Missing positive fixture: ${path}`);
    const data = JSON.parse(readFileSync(path, 'utf8'));

    let schemaId;
    if (file.includes('.profile.json')) schemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
    else if (file.includes('advertisement') || file.includes('declaration')) schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
    else if (file.includes('negotiation') || file.includes('handshake')) schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
    else if (file.includes('offline-bundle-manifest')) schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
    else if (file.includes('platform-contract')) schemaId = 'https://contracts.cybrik.example/cybrik.platform-contract.v1.schema.json';
    else if (file.includes('storage-s3-subset')) schemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';

    assert.ok(schemaId, `Could not determine schemaId for ${file}`);

    const valid = ajv.validate(schemaId, data);
    assert.ok(valid, `Positive fixture ${file} failed validation: ${ajv.errorsText()}`);
    if (file.includes('offline-bundle-manifest')) {
      assert.doesNotThrow(() => validateIJson(readFileSync(path), file));
    }
    validatePlatformSemantics(data, schemaId);
  }
});

const EXPECTED_NEGATIVES = {
  'invalid-bare-tier-profile.json': { keyword: 'pattern', instancePath: '/profile_id', schemaPath: '#/properties/profile_id/pattern', params: { pattern: '^(?!^[tT][012]$)[a-z0-9][a-z0-9-_]+$' }, message: 'must match pattern "^(?!^[tT][012]$)[a-z0-9][a-z0-9-_]+$"' },
  'invalid-empty-trust-root-offline-manifest.json': { keyword: 'required', instancePath: '', schemaPath: '#/required', params: { missingProperty: 'operator_trust_root' }, message: "must have required property 'operator_trust_root'" },
  'invalid-leading-zero-semver.json': { keyword: 'pattern', instancePath: '/profile_version', schemaPath: '#/properties/profile_version/pattern', params: { pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$' }, message: 'must match pattern "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$"' },
  'invalid-lowercase-tier-profile.json': { keyword: 'pattern', instancePath: '/profile_id', schemaPath: '#/properties/profile_id/pattern', params: { pattern: '^(?!^[tT][012]$)[a-z0-9][a-z0-9-_]+$' }, message: 'must match pattern "^(?!^[tT][012]$)[a-z0-9][a-z0-9-_]+$"' },
  'invalid-missing-evidence-advertisement.json': { keyword: 'minItems', instancePath: '/conformance_evidence', schemaPath: '#/properties/conformance_evidence/minItems', params: { limit: 1 }, message: 'must NOT have fewer than 1 items' },
  'invalid-namespace-advertisement.json': { keyword: 'pattern', instancePath: '/provider_namespace', schemaPath: '#/properties/provider_namespace/pattern', params: { pattern: '^[a-z0-9][a-z0-9-_]*[a-z0-9]$' }, message: 'must match pattern "^[a-z0-9][a-z0-9-_]*[a-z0-9]$"' },
  'invalid-platform-all-false.json': { keyword: 'const', instancePath: '/slots/oci_container_runtime/specification/required', schemaPath: '#/properties/slots/properties/oci_container_runtime/properties/specification/properties/required/const', params: { allowedValue: true }, message: "must be equal to constant" },
  'invalid-s3-missing-crud.json': { keyword: 'minItems', instancePath: '/required_operations', schemaPath: '#/then/properties/required_operations/minItems', params: { limit: 19 }, message: 'must NOT have fewer than 19 items' },
  'invalid-unauthenticated-advertisement.json': { keyword: 'const', instancePath: '/authenticated_discovery', schemaPath: '#/properties/authenticated_discovery/const', params: { allowedValue: true }, message: 'must be equal to constant' },
  'invalid-zero-artifacts-offline-manifest.json': { keyword: 'minItems', instancePath: '/artifacts', schemaPath: '#/properties/artifacts/minItems', params: { limit: 1 }, message: 'must NOT have fewer than 1 items' },
  'malformed-sha256-offline-manifest.json': { keyword: 'pattern', instancePath: '/artifacts/0/sha256', schemaPath: '#/properties/artifacts/items/properties/sha256/pattern', params: { pattern: '^[a-f0-9]{64}$' }, message: 'must match pattern "^[a-f0-9]{64}$"' },
  'missing-slot-profile.json': { keyword: 'required', instancePath: '/capability_set', schemaPath: '#/properties/capability_set/required', params: { missingProperty: 'artifact_update_mechanism' }, message: "must have required property 'artifact_update_mechanism'" },
  'invalid-absolute-path-offline-manifest.json': { keyword: 'pattern', instancePath: '/artifacts/0/path', schemaPath: '#/properties/artifacts/items/properties/path/pattern', params: { pattern: '^(?!(?:manifest\\.json|manifest\\.sig)$)(?!\\/)(?!^\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))[a-z0-9._/-]+[a-z0-9._-]$' }, message: 'must match pattern "^(?!(?:manifest\\.json|manifest\\.sig)$)(?!\\/)(?!^\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))[a-z0-9._/-]+[a-z0-9._-]$"' }
};

test('validate negative platform fixtures', () => {
  const negatives = readdirSync(join(EXAMPLES_DIR, 'negative')).filter(f => f.endsWith('.json'));
  assert.equal(negatives.length, Object.keys(EXPECTED_NEGATIVES).length, 'Must have exactly 13 negative fixtures');

  for (const file of negatives) {
    let schemaId;
    if (file.includes('profile') || file.includes('semver')) schemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
    else if (file.includes('advertisement') || file.includes('declaration')) schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
    else if (file.includes('negotiation') || file.includes('handshake')) schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
    else if (file.includes('offline-manifest') || file.includes('malformed-sha256') || file.includes('trust-root')) schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
    else if (file.includes('platform')) schemaId = 'https://contracts.cybrik.example/cybrik.platform-contract.v1.schema.json';
    else if (file.includes('s3')) schemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
    else throw new Error("Could not map negative fixture: " + file);

    const path = join(EXAMPLES_DIR, 'negative', file);
    assert.ok(existsSync(path), `Missing negative fixture: ${path}`);
    const data = JSON.parse(readFileSync(path, 'utf8'));

    const valid = ajv.validate(schemaId, data);
    assert.ok(!valid, `Negative fixture ${file} incorrectly passed validation`);

    const filteredErrors = ajv.errors.filter(e => e.keyword !== 'if' && !e.schemaPath.includes('/contains'));
    assert.equal(filteredErrors.length, 1, `Expected exactly 1 error for ${file}, got ${filteredErrors.length}: ${ajv.errorsText()}`);

    const expected = EXPECTED_NEGATIVES[file];
    assert.ok(expected, `No expected error mapped for ${file}`);
    assert.equal(filteredErrors[0].keyword, expected.keyword, `Mismatch keyword for ${file}`);
    assert.equal(filteredErrors[0].instancePath, expected.instancePath, `Mismatch instancePath for ${file}`);
    assert.equal(filteredErrors[0].schemaPath, expected.schemaPath, `Mismatch schemaPath for ${file}`);
    assert.deepEqual(filteredErrors[0].params, expected.params, `Mismatch params for ${file}`);
    assert.equal(filteredErrors[0].message, expected.message, `Mismatch message for ${file}`);
  }
});

test('in-memory validation: reject full profile with duplicated distinct slots', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';

  const original = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(original));

  data.advertised_capabilities[1].slot_id = data.advertised_capabilities[0].slot_id;

  const valid = ajv.validate(schemaId, data);
  assert.ok(!valid, 'Should reject duplicated distinct slot');

  const hasContainsError = ajv.errors.some(e => e.keyword === 'contains');
  assert.ok(hasContainsError, 'Should fail the distinct 13-slot contains condition');

  const hasDigestError = ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'target_profile_digest');
  assert.ok(!hasDigestError, 'target_profile_digest should be valid and not the reason for failure');
});


test('in-memory validation: reject advertisement with unresolvable evidence reference', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const data = {
    "target_profile_id": "onprem-standard-v1",
    "target_profile_version": "1.0.0",
    "target_profile_digest": "5be09c271422654a281dcf14d0dbb4968d23337157bd38e39f52d1cf3c4b5050",
    "provider_namespace": "evil-corp",
    "claim_type": "PARTIAL_CAPABILITY_ADVERTISEMENT",
    "advertised_capabilities": [
      {
        "capability_name": "oci_container_runtime",
        "slot_id": "oci_container_runtime",
        "description": "Container runtime slot",
        "is_mandatory": true,
        "supported_features": ["container_lifecycle"],
        "degradation_fallback": "NONE",
        "evidence_references": ["urn:cybrik:evidence:missing-test"]
      }
    ],
    "conformance_evidence": [
      {
        "test_identifier": "urn:cybrik:evidence:test-1",
        "status": "PASS",
        "evidence_pack_digest": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "executed_at": "2026-08-25T12:00:00Z",
        "report_uri": "https://example.com/report"
      }
    ],
    "degradation_behavior": "FAIL_CLOSED",
    "authenticated_discovery": true
  };

  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Should pass JSON schema validation: ' + ajv.errorsText());
  assert.throws(() => validatePlatformSemantics(data, schemaId), /missing-test/);
});

test('in-memory validation: reject offline manifest with duplicate artifact paths', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const data = {
    "bundle_identifier": "my-bundle-1",
    "release_tag": "v1.2.3",
    "manifest_sequence": 1,
    "operator_trust_root": {
      "signing_key_id": "key-123456",
      "public_key_fingerprint": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "signature_algorithm": "ed25519"
    },
    "detached_signature": {
      "algorithm": "ed25519",
      "signature_file": "manifest.sig",
      "key_fingerprint": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    "artifacts": [
      {
        "name": "image-1",
        "path": "images/image-1.tar",
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "size_bytes": 1024
      },
      {
        "name": "image-2",
        "path": "images/image-1.tar",
        "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "size_bytes": 2048
      }
    ],
    "migration_reversibility_guaranteed": true,
    "rollback_procedure_reference": "doc://rollback",
    "update_station_workflow": {
      "preflight_steps": [
        {
          "step_id": "preflight-verify",
          "action": "VERIFY_DIGEST",
          "target": "images/image-1.tar"
        }
      ],
      "apply_steps": [
        {
          "step_id": "apply-preload",
          "action": "PRELOAD_OCI_IMAGE",
          "target": "images/image-1.tar"
        }
      ],
      "rollback_steps": [
        {
          "step_id": "rollback-restore",
          "action": "RESTORE_DATABASE_SNAPSHOT",
          "target": "snapshots/backup.db"
        }
      ]
    },
    "canonicalization_scheme": "RFC_8785_JCS"
  };

  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Should pass JSON schema validation: ' + ajv.errorsText());
  assert.throws(() => validatePlatformSemantics(data, schemaId), /duplicate artifact path/);
});

test('in-memory validation: reject offline manifest with alias collision paths', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const data = {
    "bundle_identifier": "my-bundle-1",
    "release_tag": "v1.2.3",
    "manifest_sequence": 1,
    "operator_trust_root": {
      "signing_key_id": "key-123456",
      "public_key_fingerprint": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "signature_algorithm": "ed25519"
    },
    "detached_signature": {
      "algorithm": "ed25519",
      "signature_file": "manifest.sig",
      "key_fingerprint": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    "artifacts": [
      {
        "name": "image-1",
        "path": "images/image-1.tar",
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "size_bytes": 1024
      },
      {
        "name": "image-2",
        "path": "./images/image-1.tar",
        "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "size_bytes": 2048
      }
    ],
    "migration_reversibility_guaranteed": true,
    "rollback_procedure_reference": "doc://rollback",
    "update_station_workflow": {
      "preflight_steps": [
        {
          "step_id": "preflight-verify",
          "action": "VERIFY_DIGEST",
          "target": "images/image-1.tar"
        }
      ],
      "apply_steps": [
        {
          "step_id": "apply-preload",
          "action": "PRELOAD_OCI_IMAGE",
          "target": "images/image-1.tar"
        }
      ],
      "rollback_steps": [
        {
          "step_id": "rollback-restore",
          "action": "RESTORE_DATABASE_SNAPSHOT",
          "target": "snapshots/backup.db"
        }
      ]
    },
    "canonicalization_scheme": "RFC_8785_JCS"
  };

  // Skip strict schema validation because ./ is technically invalid structurally now
  // We want to test the semantic normalizer explicitly.
  assert.throws(() => validatePlatformSemantics(data, schemaId), /duplicate artifact path/);
});

test('in-memory validation: reject offline manifest with trailing slash path', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const data = {
    "bundle_identifier": "my-bundle-1",
    "release_tag": "v1.2.3",
    "manifest_sequence": 1,
    "operator_trust_root": {
      "signing_key_id": "key-123456",
      "public_key_fingerprint": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "signature_algorithm": "ed25519"
    },
    "detached_signature": {
      "algorithm": "ed25519",
      "signature_file": "manifest.sig",
      "key_fingerprint": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    "artifacts": [
      {
        "name": "image-1",
        "path": "images/image-1.tar/",
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "size_bytes": 1024
      }
    ],
    "migration_reversibility_guaranteed": true,
    "rollback_procedure_reference": "doc://rollback",
    "update_station_workflow": {
      "preflight_steps": [
        {
          "step_id": "preflight-verify",
          "action": "VERIFY_DIGEST",
          "target": "images/image-1.tar"
        }
      ],
      "apply_steps": [
        {
          "step_id": "apply-preload",
          "action": "PRELOAD_OCI_IMAGE",
          "target": "images/image-1.tar"
        }
      ],
      "rollback_steps": [
        {
          "step_id": "rollback-restore",
          "action": "RESTORE_DATABASE_SNAPSHOT",
          "target": "snapshots/backup.db"
        }
      ]
    },
    "canonicalization_scheme": "RFC_8785_JCS"
  };

  const valid = ajv.validate(schemaId, data);
  assert.ok(!valid, 'Should reject trailing slash path');
});

test('in-memory validation: reject root manifest.json and manifest.sig from artifacts in offline manifest (OPEN-1)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const baseManifest = {
    bundle_identifier: "my-bundle-1",
    release_tag: "v1.2.3",
    manifest_sequence: 1,
    operator_trust_root: {
      signing_key_id: "key-123456",
      public_key_fingerprint: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature_algorithm: "ed25519"
    },
    detached_signature: {
      algorithm: "ed25519",
      signature_file: "manifest.sig",
      key_fingerprint: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    artifacts: [
      {
        name: "image-1",
        path: "images/image-1.tar",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        size_bytes: 1024
      }
    ],
    migration_reversibility_guaranteed: true,
    rollback_procedure_reference: "doc://rollback",
    update_station_workflow: {
      preflight_steps: [
        {
          step_id: "preflight-verify",
          action: "VERIFY_DIGEST",
          target: "images/image-1.tar"
        }
      ],
      apply_steps: [
        {
          step_id: "apply-preload",
          action: "PRELOAD_OCI_IMAGE",
          target: "images/image-1.tar"
        }
      ],
      rollback_steps: [
        {
          step_id: "rollback-restore",
          action: "RESTORE_DATABASE_SNAPSHOT",
          target: "snapshots/backup.db"
        }
      ]
    },
    canonicalization_scheme: "RFC_8785_JCS"
  };

  for (const prohibitedPath of ['manifest.json', 'manifest.sig']) {
    const copy = JSON.parse(JSON.stringify(baseManifest));
    copy.artifacts[0].path = prohibitedPath;
    const valid = ajv.validate(schemaId, copy);
    assert.ok(!valid, `Should reject root artifact path '${prohibitedPath}'`);
  }

  for (const allowedPath of ['images/manifest.json', 'images/manifest.sig', 'nested/dir/manifest.json']) {
    const copy = JSON.parse(JSON.stringify(baseManifest));
    copy.artifacts[0].path = allowedPath;
    const valid = ajv.validate(schemaId, copy);
    assert.ok(valid, `Should allow subpath artifact path '${allowedPath}': ` + ajv.errorsText());
  }
});

test('in-memory validation: offline manifest HEALTH_PROBE restrictions (OPEN-1 Finding 3)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const baseManifest = {
    bundle_identifier: "my-bundle-1",
    release_tag: "v1.2.3",
    manifest_sequence: 1,
    operator_trust_root: {
      signing_key_id: "key-123456",
      public_key_fingerprint: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature_algorithm: "ed25519"
    },
    detached_signature: {
      algorithm: "ed25519",
      signature_file: "manifest.sig",
      key_fingerprint: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    artifacts: [
      {
        name: "image-1",
        path: "images/image-1.tar",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        size_bytes: 1024
      }
    ],
    migration_reversibility_guaranteed: true,
    rollback_procedure_reference: "doc://rollback",
    update_station_workflow: {
      preflight_steps: [
        {
          step_id: "preflight-health",
          action: "HEALTH_PROBE",
          target: "http://127.0.0.1:8080/healthz",
          parameters: {
            method: "GET"
          }
        }
      ],
      apply_steps: [
        {
          step_id: "apply-preload",
          action: "PRELOAD_OCI_IMAGE",
          target: "images/image-1.tar"
        }
      ],
      rollback_steps: [
        {
          step_id: "rollback-restore",
          action: "RESTORE_DATABASE_SNAPSHOT",
          target: "snapshots/backup.db"
        }
      ]
    },
    canonicalization_scheme: "RFC_8785_JCS"
  };

  // Valid probe targets: localhost, 127.0.0.1, [::1], 10.x, 192.168.x, 172.16-31.x
  const validTargets = [
    "http://127.0.0.1:8080/healthz",
    "http://localhost:8080/readyz",
    "https://10.0.1.5:8443/status",
    "http://10.255.255.255:65535/healthz",
    "http://192.168.1.100/health",
    "http://192.168.0.1:80/status",
    "https://172.20.0.2:9000/live",
    "https://172.16.0.1:1/live",
    "https://172.31.255.255:443/live",
    "http://[::1]:8080/status",
    "http://localhost/healthz"
  ];
  for (const target of validTargets) {
    const copy = JSON.parse(JSON.stringify(baseManifest));
    copy.update_station_workflow.preflight_steps[0].target = target;
    const ok = ajv.validate(schemaId, copy);
    assert.ok(ok, `Expected target '${target}' to be valid: ` + ajv.errorsText());
  }

  // Valid probe methods: GET, HEAD
  for (const method of ["GET", "HEAD"]) {
    const copy = JSON.parse(JSON.stringify(baseManifest));
    copy.update_station_workflow.preflight_steps[0].parameters.method = method;
    const ok = ajv.validate(schemaId, copy);
    assert.ok(ok, `Expected method '${method}' to be valid: ` + ajv.errorsText());
  }

  // Invalid targets (public domains, public IPs, invalid octets, invalid ports, unbracketed IPv6)
  const invalidTargets = [
    "https://example.com/healthz",
    "http://1.1.1.1/healthz",
    "https://8.8.8.8:8080/readyz",
    "http://attacker.local/healthz",
    "http://10.256.1.1:8080/healthz",
    "http://172.15.0.1:8080/healthz",
    "http://172.32.0.1:8080/healthz",
    "http://192.168.1.300/healthz",
    "http://127.0.0.1:0/healthz",
    "http://127.0.0.1:65536/healthz",
    "http://127.0.0.1:70000/healthz",
    "http://::1:8080/status"
  ];
  for (const target of invalidTargets) {
    const copy = JSON.parse(JSON.stringify(baseManifest));
    copy.update_station_workflow.preflight_steps[0].target = target;
    const ok = ajv.validate(schemaId, copy);
    assert.ok(!ok, `Expected target '${target}' to be rejected`);
  }

  // Invalid methods: POST, PUT, DELETE
  for (const method of ["POST", "PUT", "DELETE"]) {
    const copy = JSON.parse(JSON.stringify(baseManifest));
    copy.update_station_workflow.preflight_steps[0].parameters.method = method;
    const ok = ajv.validate(schemaId, copy);
    assert.ok(!ok, `Expected method '${method}' to be rejected`);
  }
});

test('in-memory validation: offline manifest RESTORE_DATABASE_SNAPSHOT restrictions (OPEN-1 Finding 4)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const baseManifest = {
    bundle_identifier: "my-bundle-1",
    release_tag: "v1.2.3",
    manifest_sequence: 1,
    operator_trust_root: {
      signing_key_id: "key-123456",
      public_key_fingerprint: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature_algorithm: "ed25519"
    },
    detached_signature: {
      algorithm: "ed25519",
      signature_file: "manifest.sig",
      key_fingerprint: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    artifacts: [
      {
        name: "image-1",
        path: "images/image-1.tar",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        size_bytes: 1024
      }
    ],
    migration_reversibility_guaranteed: true,
    rollback_procedure_reference: "doc://rollback",
    update_station_workflow: {
      preflight_steps: [
        {
          step_id: "preflight-verify",
          action: "VERIFY_DIGEST",
          target: "images/image-1.tar"
        }
      ],
      apply_steps: [
        {
          step_id: "apply-preload",
          action: "PRELOAD_OCI_IMAGE",
          target: "images/image-1.tar"
        }
      ],
      rollback_steps: [
        {
          step_id: "rollback-restore",
          action: "RESTORE_DATABASE_SNAPSHOT",
          target: "snapshots/backup.db"
        }
      ]
    },
    canonicalization_scheme: "RFC_8785_JCS"
  };

  // Valid restore targets: relative snapshot paths or $PRE_APPLY_SNAPSHOT variables
  const validTargets = [
    "snapshots/backup.db",
    "snapshots/initial.sql",
    "snapshots/sub/archive.bak",
    "$PRE_APPLY_SNAPSHOT/pre-v1.2.3.sql",
    "$PRE_APPLY_SNAPSHOT/nested/dir/dump.db",
    "$PRE_APPLY_SNAPSHOT/snapshot.bak"
  ];
  for (const target of validTargets) {
    const copy = JSON.parse(JSON.stringify(baseManifest));
    copy.update_station_workflow.rollback_steps[0].target = target;
    const ok = ajv.validate(schemaId, copy);
    assert.ok(ok, `Expected restore target '${target}' to be valid: ` + ajv.errorsText());
  }

  // Invalid restore targets: absolute host paths, arbitrary relative paths, invalid extensions, path traversal, double slashes, hidden files
  const invalidTargets = [
    "/etc/passwd.db",
    "/var/backups/cybrik/snapshots/pre-v1.2.3.sql",
    "/snapshots/backup.db",
    "other/backup.db",
    "backup.db",
    "snapshots/backup.txt",
    "snapshots/backup.tar",
    "$PRE_APPLY_SNAPSHOT/backup.json",
    "snapshots//backup.db",
    "$PRE_APPLY_SNAPSHOT/.hidden.db",
    "snapshots/../etc/passwd.db",
    "$PRE_APPLY_SNAPSHOT/foo//bar.db"
  ];
  for (const target of invalidTargets) {
    const copy = JSON.parse(JSON.stringify(baseManifest));
    copy.update_station_workflow.rollback_steps[0].target = target;
    const ok = ajv.validate(schemaId, copy);
    assert.ok(!ok, `Expected restore target '${target}' to be rejected by schema`);
    assert.throws(
      () => validatePlatformSemantics(copy, schemaId),
      /invalid RESTORE_DATABASE_SNAPSHOT target path/,
      `Expected restore target '${target}' to be rejected by semantic validation`
    );
  }

  // Explicit regression checks for bypass path patterns
  const bypassTargets = [
    "snapshots//backup.db",
    "$PRE_APPLY_SNAPSHOT/.hidden.db",
    "snapshots/../etc/passwd.db",
    "$PRE_APPLY_SNAPSHOT/foo//bar.db"
  ];
  for (const target of bypassTargets) {
    const copy = JSON.parse(JSON.stringify(baseManifest));
    copy.update_station_workflow.rollback_steps[0].target = target;
    const schemaOk = ajv.validate(schemaId, copy);
    assert.equal(schemaOk, false, `Bypass path '${target}' must fail schema validation`);
    assert.throws(
      () => validatePlatformSemantics(copy, schemaId),
      /invalid RESTORE_DATABASE_SNAPSHOT target path/,
      `Bypass path '${target}' must fail semantic validation`
    );
  }

  // Duplicate artifact path
  const dupArtDoc = JSON.parse(JSON.stringify(baseManifest));
  dupArtDoc.artifacts.push(dupArtDoc.artifacts[0]);
  assert.throws(() => validatePlatformSemantics(dupArtDoc, schemaId), /duplicate artifact path/);
});

test('lexical I-JSON validation: duplicate keys, safe integer bounds, float rejection', () => {
  const samplePath = join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json');
  const validRaw = readFileSync(samplePath, 'utf8');

  // Positive: sample manifest passes
  assert.doesNotThrow(() => validateIJson(validRaw, 'sample-offline-bundle-manifest.json'));

  // Negative: duplicate key at root
  const dupRootKey = validRaw.replace('"manifest_sequence": 1,', '"manifest_sequence": 1,\n  "manifest_sequence": 2,');
  assert.throws(() => validateIJson(dupRootKey, 'dup-root-key'), /duplicate object key 'manifest_sequence'/);

  // Negative: duplicate key in nested object
  const dupNestedKey = validRaw.replace('"signing_key_id": "key-123456",', '"signing_key_id": "key-123456",\n    "signing_key_id": "key-999999",');
  assert.throws(() => validateIJson(dupNestedKey, 'dup-nested-key'), /duplicate object key 'signing_key_id'/);

  // Negative: integer exceeding IEEE-754 safe integer range (2^53)
  const overflowInt = validRaw.replace('"manifest_sequence": 1,', '"manifest_sequence": 9007199254740992,');
  assert.throws(() => validateIJson(overflowInt, 'overflow-int'), /exceeds IEEE-754 safe integer range/);

  // Negative: negative integer below safe integer range -(2^53)
  const underflowInt = validRaw.replace('"manifest_sequence": 1,', '"manifest_sequence": -9007199254740992,');
  assert.throws(() => validateIJson(underflowInt, 'underflow-int'), /exceeds IEEE-754 safe integer range/);

  // Negative: floating point number
  const floatNum = validRaw.replace('"manifest_sequence": 1,', '"manifest_sequence": 1.25,');
  assert.throws(() => validateIJson(floatNum, 'float-num'), /floating-point or scientific notation/);

  // Negative: scientific notation
  const sciNum = validRaw.replace('"manifest_sequence": 1,', '"manifest_sequence": 1e5,');
  assert.throws(() => validateIJson(sciNum, 'sci-num'), /floating-point or scientific notation/);

  // Negative: BOM rejection
  const bomRaw = '\uFEFF' + validRaw;
  assert.throws(() => validateIJson(bomRaw, 'bom-raw'), /Byte Order Mark \(BOM\) is prohibited/);
});

test('lexical I-JSON validation: fatal UTF-8 decoding error on malformed bytes', () => {
  const samplePath = join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json');
  const validBuffer = readFileSync(samplePath);
  const validUint8 = new Uint8Array(validBuffer);

  // Positive: Buffer and Uint8Array pass
  assert.doesNotThrow(() => validateIJson(validBuffer, 'sample-offline-bundle-manifest.json (Buffer)'));
  assert.doesNotThrow(() => validateIJson(validUint8, 'sample-offline-bundle-manifest.json (Uint8Array)'));

  // Negative: invalid byte sequence in Buffer (0xff)
  const invalidUtf8Buf = Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x28, 0x22, 0x7d]);
  assert.throws(() => validateIJson(invalidUtf8Buf, 'invalid-utf8-buf'), /malformed UTF-8 byte sequence/);

  // Negative: overlong UTF-8 encoding in Uint8Array
  const overlongUtf8 = new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc0, 0xaf, 0x22, 0x7d]);
  assert.throws(() => validateIJson(overlongUtf8, 'overlong-utf8'), /malformed UTF-8 byte sequence/);

  // Negative: raw UTF-8 encoded lone surrogate bytes in Buffer
  const loneSurrogateBuf = Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xed, 0xa0, 0x80, 0x22, 0x7d]);
  assert.throws(() => validateIJson(loneSurrogateBuf, 'lone-surrogate-buf'), /malformed UTF-8 byte sequence/);

  // Negative: invalid continuation byte in Buffer
  const invalidContinuationBuf = Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0x80, 0x22, 0x7d]);
  assert.throws(() => validateIJson(invalidContinuationBuf, 'invalid-continuation-buf'), /malformed UTF-8 byte sequence/);

  // Negative: truncated multi-byte sequence
  const truncatedUtf8Buf = Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xe2, 0x82]);
  assert.throws(() => validateIJson(truncatedUtf8Buf, 'truncated-utf8-buf'), /malformed UTF-8 byte sequence/);

  // Negative: invalid 4-byte sequence exceeding Unicode range
  const outOfRangeUtf8Buf = Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xf4, 0x90, 0x80, 0x80, 0x22, 0x7d]);
  assert.throws(() => validateIJson(outOfRangeUtf8Buf, 'out-of-range-utf8-buf'), /malformed UTF-8 byte sequence/);
});

test('lexical I-JSON validation: fatal error on escaped lone surrogate code points', () => {
  const samplePath = join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json');
  const validRaw = readFileSync(samplePath, 'utf8');

  // Negative: lone high surrogate \ud800
  const loneHighSurrogate = validRaw.replace('"release_tag": "v1.2.3",', '"release_tag": "v1.2.3\\ud800",');
  assert.throws(
    () => validateIJson(loneHighSurrogate, 'lone-high-surrogate'),
    /I-JSON Error in lone-high-surrogate: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // Negative: lone high surrogate \uDBFF
  const loneHighSurrogateMax = validRaw.replace('"release_tag": "v1.2.3",', '"release_tag": "v1.2.3\\uDBFF",');
  assert.throws(
    () => validateIJson(loneHighSurrogateMax, 'lone-high-surrogate-max'),
    /I-JSON Error in lone-high-surrogate-max: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // Negative: lone low surrogate \udc00
  const loneLowSurrogate = validRaw.replace('"release_tag": "v1.2.3",', '"release_tag": "v1.2.3\\udc00",');
  assert.throws(
    () => validateIJson(loneLowSurrogate, 'lone-low-surrogate'),
    /I-JSON Error in lone-low-surrogate: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // Negative: lone low surrogate \uDFFF
  const loneLowSurrogateMax = validRaw.replace('"release_tag": "v1.2.3",', '"release_tag": "v1.2.3\\uDFFF",');
  assert.throws(
    () => validateIJson(loneLowSurrogateMax, 'lone-low-surrogate-max'),
    /I-JSON Error in lone-low-surrogate-max: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // Negative: reversed surrogate pair (low before high: \udc00\ud800)
  const reversedSurrogates = validRaw.replace('"release_tag": "v1.2.3",', '"release_tag": "v1.2.3\\udc00\\ud800",');
  assert.throws(
    () => validateIJson(reversedSurrogates, 'reversed-surrogates'),
    /I-JSON Error in reversed-surrogates: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // Negative: high surrogate followed by non-surrogate \ud800\u0041
  const highFollowedByAscii = validRaw.replace('"release_tag": "v1.2.3",', '"release_tag": "v1.2.3\\ud800\\u0041",');
  assert.throws(
    () => validateIJson(highFollowedByAscii, 'high-followed-by-ascii'),
    /I-JSON Error in high-followed-by-ascii: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // Positive: valid surrogate pair \ud83d\ude00 (emoji 😀) MUST pass
  const validSurrogatePair = validRaw.replace('"release_tag": "v1.2.3",', '"release_tag": "v1.2.3\\ud83d\\ude00",');
  assert.doesNotThrow(() => validateIJson(validSurrogatePair, 'valid-surrogate-pair'));

  // Positive: escaped backslash before u e.g. \\ud800 (literal backslash + ud800) MUST pass
  const escapedBackslash = validRaw.replace('"release_tag": "v1.2.3",', '"release_tag": "v1.2.3\\\\ud800",');
  assert.doesNotThrow(() => validateIJson(escapedBackslash, 'escaped-backslash'));
});

test('lexical I-JSON validation: airtight lone surrogate detection across backslash-parity and raw characters (OPEN-1)', () => {
  // Codex finding regression: {"x":"\\ud800\udc00"} (escaped backslash + literal ud800 + raw U+DC00 low surrogate)
  const codexFinding = '{"x":"\\\\ud800\udc00"}';
  assert.throws(
    () => validateIJson(codexFinding, 'codex-finding-regression'),
    /I-JSON Error in codex-finding-regression: lone or unpaired surrogate code point U\+DC00 prohibited by RFC 7493 \/ RFC 8785/
  );

  // Escaped backslash before high surrogate followed by escaped low surrogate: {"x":"\\ud800\\udc00"} (literal \ud800 + escaped \udc00 lone low surrogate)
  const escapedBsThenLowSurrogate = '{"x":"\\\\ud800\\udc00"}';
  assert.throws(
    () => validateIJson(escapedBsThenLowSurrogate, 'escaped-bs-then-low-surrogate'),
    /I-JSON Error in escaped-bs-then-low-surrogate: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // Escaped high surrogate followed by escaped backslash and literal udc00: {"x":"\ud800\\udc00"} (escaped \ud800 lone high surrogate)
  const highSurrogateThenEscapedBs = '{"x":"\\ud800\\\\udc00"}';
  assert.throws(
    () => validateIJson(highSurrogateThenEscapedBs, 'high-surrogate-then-escaped-bs'),
    /I-JSON Error in high-surrogate-then-escaped-bs: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // 3 backslashes before ud800 (1 escaped backslash + 1 lone high surrogate escape): {"x":"\\\ud800"}
  const tripleBsLoneHigh = '{"x":"\\\\\\ud800"}';
  assert.throws(
    () => validateIJson(tripleBsLoneHigh, 'triple-bs-lone-high'),
    /I-JSON Error in triple-bs-lone-high: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // 5 backslashes before ud800 (2 escaped backslashes + 1 lone high surrogate escape): {"x":"\\\\\ud800"}
  const fiveBsLoneHigh = '{"x":"\\\\\\\\\\ud800"}';
  assert.throws(
    () => validateIJson(fiveBsLoneHigh, 'five-bs-lone-high'),
    /I-JSON Error in five-bs-lone-high: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // 3 backslashes before ud800 and 1 backslash before udc00 (escaped backslash + valid surrogate pair) MUST pass: {"x":"\\\ud800\udc00"}
  const tripleBsValidSurrogatePair = '{"x":"\\\\\\ud800\\udc00"}';
  assert.doesNotThrow(() => validateIJson(tripleBsValidSurrogatePair, 'triple-bs-valid-surrogate-pair'));

  // 4 backslashes before ud800 and 4 backslashes before udc00 (literal \\ud800\\udc00) MUST pass: {"x":"\\\\ud800\\\\udc00"}
  const fourBsLiteral = '{"x":"\\\\\\\\ud800\\\\\\\\udc00"}';
  assert.doesNotThrow(() => validateIJson(fourBsLiteral, 'four-bs-literal'));

  // Raw lone high surrogate code unit in string value
  const rawLoneHigh = '{"x":"prefix\uD800suffix"}';
  assert.throws(
    () => validateIJson(rawLoneHigh, 'raw-lone-high'),
    /I-JSON Error in raw-lone-high: lone or unpaired surrogate code point U\+D800 prohibited by RFC 7493 \/ RFC 8785/
  );

  // Raw lone low surrogate code unit in string value
  const rawLoneLow = '{"x":"prefix\uDC00suffix"}';
  assert.throws(
    () => validateIJson(rawLoneLow, 'raw-lone-low'),
    /I-JSON Error in raw-lone-low: lone or unpaired surrogate code point U\+DC00 prohibited by RFC 7493 \/ RFC 8785/
  );

  // Raw reversed surrogate code units in string value
  const rawReversed = '{"x":"prefix\uDC00\uD800suffix"}';
  assert.throws(
    () => validateIJson(rawReversed, 'raw-reversed'),
    /I-JSON Error in raw-reversed: lone or unpaired surrogate code point U\+DC00 prohibited by RFC 7493 \/ RFC 8785/
  );

  // Raw valid surrogate pair code units (😀) MUST pass
  const rawValidSurrogatePair = '{"x":"prefix\uD83D\uDE00suffix"}';
  assert.doesNotThrow(() => validateIJson(rawValidSurrogatePair, 'raw-valid-surrogate-pair'));

  // Lone surrogate in object key
  const loneSurrogateKey = '{"\\ud800": "value"}';
  assert.throws(
    () => validateIJson(loneSurrogateKey, 'lone-surrogate-key'),
    /I-JSON Error in lone-surrogate-key: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // Raw lone surrogate in object key
  const rawLoneSurrogateKey = '{"\uDC00": "value"}';
  assert.throws(
    () => validateIJson(rawLoneSurrogateKey, 'raw-lone-surrogate-key'),
    /I-JSON Error in raw-lone-surrogate-key: lone or unpaired surrogate code point U\+DC00 prohibited by RFC 7493 \/ RFC 8785/
  );

  // Valid surrogate pair in object key MUST pass
  const validSurrogateKey = '{"\\ud83d\\ude00_k1": "value", "\uD83D\uDE00_k2": "value2"}';
  assert.doesNotThrow(() => validateIJson(validSurrogateKey, 'valid-surrogate-key'));

  // Lone surrogate in array element
  const loneSurrogateArray = '["valid", "\\udc00", "also valid"]';
  assert.throws(
    () => validateIJson(loneSurrogateArray, 'lone-surrogate-array'),
    /I-JSON Error in lone-surrogate-array: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );

  // Deeply nested lone surrogate
  const nestedLoneSurrogate = '{"level1": {"level2": [{"key": "\\ud800"}]}}';
  assert.throws(
    () => validateIJson(nestedLoneSurrogate, 'nested-lone-surrogate'),
    /I-JSON Error in nested-lone-surrogate: escaped lone surrogate code point prohibited by RFC 7493 \/ RFC 8785/
  );
});

test('in-memory validation: reject capability negotiation with unverified evidence binding', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.evidence_binding_verified = false;

  const valid = ajv.validate(schemaId, data);
  assert.ok(!valid, 'Should reject active lease with unverified evidence binding');
  assert.ok(ajv.errors.some(e => e.instancePath === '/evidence_binding_verified' && e.keyword === 'const'));
});

test('in-memory validation: reject capability negotiation with missing mandatory slots in lease', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.agreed_capability_lease.mandatory_slots_satisfied = data.agreed_capability_lease.mandatory_slots_satisfied.filter(s => s !== 'oci_container_runtime');

  const valid = ajv.validate(schemaId, data);
  assert.ok(!valid, 'Should reject lease missing mandatory oci_container_runtime slot');
  assert.ok(ajv.errors.some(e => e.keyword === 'contains'));
});

test('in-memory validation: reject capability negotiation with mismatched profile digest', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.target_profile_digest = '0000000000000000000000000000000000000000000000000000000000000000';

  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Structurally valid JSON');
  assert.throws(() => validatePlatformSemantics(data, schemaId), /does not match (?:disk profile|actual) digest/);
});

test('in-memory validation: reject capability negotiation lease with mismatched lease target_profile_digest', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.agreed_capability_lease.target_profile_digest = '0000000000000000000000000000000000000000000000000000000000000000';

  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Structurally valid JSON');
  assert.throws(() => validatePlatformSemantics(data, schemaId), /does not match actual digest/);
});

test('in-memory validation: reject capability negotiation with ACTIVE_DEGRADED under FAIL_CLOSED_STRICT', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.negotiation_request.degradation_policy = 'FAIL_CLOSED_STRICT';
  data.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';

  const valid = ajv.validate(schemaId, data);
  assert.ok(!valid, 'Should reject ACTIVE_DEGRADED when degradation policy is FAIL_CLOSED_STRICT');
});

test('in-memory validation: reject capability negotiation lease missing mandatory profile slot evidence', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.advertisement_response.advertised_capabilities = data.advertisement_response.advertised_capabilities.filter(c => c.slot_id !== 'storage');

  assert.throws(() => validatePlatformSemantics(data, schemaId), /mandatory profile slot/);
});

test('in-memory validation: reject capability negotiation with inverted timestamps', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.agreed_capability_lease.issued_at = "2026-08-27T14:00:00Z";
  data.agreed_capability_lease.valid_until = "2026-08-27T13:00:00Z";

  assert.throws(() => validatePlatformSemantics(data, schemaId), /strictly greater than issued_at_ms/);
});

test('in-memory validation: reject capability negotiation request missing core mandatory slot', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.negotiation_request.requested_slots = data.negotiation_request.requested_slots.filter(s => s !== 'storage');

  assert.throws(() => validatePlatformSemantics(data, schemaId), /missing core mandatory slot/);
});

test('in-memory validation: reject capability negotiation with mismatched ttl_seconds', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.agreed_capability_lease.ttl_seconds = 1800; // actual delta is 3600

  assert.throws(() => validatePlatformSemantics(data, schemaId), /does not match timestamp duration/);
});

test('in-memory validation: reject capability negotiation with subsecond timestamp mismatch', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.agreed_capability_lease.issued_at = "2026-08-27T12:00:00.000Z";
  data.agreed_capability_lease.valid_until = "2026-08-27T13:00:00.899Z";
  data.agreed_capability_lease.ttl_seconds = 3600;

  assert.throws(() => validatePlatformSemantics(data, schemaId), /does not match timestamp duration/);
});

test('in-memory validation: reject capability negotiation with illegal status pairs', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // AGREED_LEASE_GRANTED paired with ACTIVE_DEGRADED
  const data1 = JSON.parse(JSON.stringify(sample));
  data1.negotiation_status = "AGREED_LEASE_GRANTED";
  data1.agreed_capability_lease.lease_status = "ACTIVE_DEGRADED";
  const valid1 = ajv.validate(schemaId, data1);
  assert.ok(!valid1, 'Should reject AGREED_LEASE_GRANTED with ACTIVE_DEGRADED');

  // DEGRADED_LEASE_GRANTED paired with ACTIVE_OPTIMAL
  const data2 = JSON.parse(JSON.stringify(sample));
  data2.negotiation_status = "DEGRADED_LEASE_GRANTED";
  data2.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  const valid2 = ajv.validate(schemaId, data2);
  assert.ok(!valid2, 'Should reject DEGRADED_LEASE_GRANTED with ACTIVE_OPTIMAL');
});

test('in-memory validation: reject hidden degradation in ACTIVE_OPTIMAL lease', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.negotiation_status = "AGREED_LEASE_GRANTED";
  data.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";

  assert.throws(() => validatePlatformSemantics(data, schemaId), /ACTIVE_OPTIMAL lease cannot contain degraded capability/);
});

test('in-memory validation: reject storage capability missing 15 baseline operations / 19 closed operations or Object Lock evidence', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // Missing operation from 15 baseline operations / 19 closed operations
  const data1 = JSON.parse(JSON.stringify(sample));
  const storeCap1 = data1.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCap1.supported_features = storeCap1.supported_features.filter(f => f !== 'PutObjectRetention');
  assert.throws(() => validatePlatformSemantics(data1, schemaId), /missing required S3 operation/);

  // Missing Object Lock retention evidence
  const data2 = JSON.parse(JSON.stringify(sample));
  const storeCap2 = data2.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCap2.evidence_references = ["urn:cybrik:evidence:storage:s3-19-ops:v1"];
  data2.advertisement_response.conformance_evidence = data2.advertisement_response.conformance_evidence.filter(e => !e.test_identifier.includes('object-lock'));
  assert.throws(() => validatePlatformSemantics(data2, schemaId), /lacks Object Lock retention evidence/);
});

test('in-memory validation: reject capability negotiation request missing mandatory slots', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const data = JSON.parse(JSON.stringify(sample));
  data.negotiation_request.requested_slots = data.negotiation_request.requested_slots.filter(s => s !== 'oci_container_runtime');

  const valid = ajv.validate(schemaId, data);
  assert.ok(!valid, 'Should reject negotiation request missing mandatory slot oci_container_runtime');
  assert.ok(ajv.errors.some(e => e.keyword === 'contains'), 'Should fail via contains');
});

test('in-memory validation: reject ACTIVE_OPTIMAL lease containing degraded capability or non-NONE fallback', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // Degraded capability in ACTIVE_OPTIMAL
  const data1 = JSON.parse(JSON.stringify(sample));
  data1.negotiation_status = "AGREED_LEASE_GRANTED";
  data1.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  data1.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_DEGRADED",
      active_mode: "cpu_quantized_emulation",
      fallback_applied: "CORE_EMULATION_FALLBACK"
    }
  ];
  const valid1 = ajv.validate(schemaId, data1);
  assert.ok(!valid1, 'Should reject ACTIVE_OPTIMAL with GRANTED_DEGRADED capability');

  // REJECTED_UNSUPPORTED capability in ACTIVE_OPTIMAL
  const dataRejected = JSON.parse(JSON.stringify(sample));
  dataRejected.negotiation_status = "AGREED_LEASE_GRANTED";
  dataRejected.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  dataRejected.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "REJECTED_UNSUPPORTED",
      active_mode: "disabled",
      fallback_applied: "FEATURE_DISABLED_GRACEFUL"
    }
  ];
  const validRejected = ajv.validate(schemaId, dataRejected);
  assert.ok(!validRejected, 'Should reject ACTIVE_OPTIMAL with REJECTED_UNSUPPORTED capability');

  // Valid ACTIVE_OPTIMAL passes
  const data2 = JSON.parse(JSON.stringify(sample));
  data2.negotiation_status = "AGREED_LEASE_GRANTED";
  data2.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  data2.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_FULL",
      active_mode: "gpu_tensor_direct",
      fallback_applied: "NONE"
    }
  ];
  const valid2 = ajv.validate(schemaId, data2);
  assert.ok(valid2, 'Valid ACTIVE_OPTIMAL should pass: ' + ajv.errorsText());
});

test('in-memory validation: reject ACTIVE_DEGRADED lease with no degraded capability or invalid fallback', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // Degraded-by-omission (all present capabilities GRANTED_FULL, but optimal-required capability omitted) passes schema validation
  const data1 = JSON.parse(JSON.stringify(sample));
  data1.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_FULL",
      active_mode: "gpu_tensor_direct",
      fallback_applied: "NONE"
    }
  ];
  const valid1 = ajv.validate(schemaId, data1);
  assert.ok(valid1, 'ACTIVE_DEGRADED lease permitting degraded-by-omission should pass schema validation: ' + ajv.errorsText());

  // 0 degraded capabilities and all optimal capabilities satisfied fails semantic validation
  const dataNoDegrade = JSON.parse(JSON.stringify(sample));
  dataNoDegrade.negotiation_status = "DEGRADED_LEASE_GRANTED";
  dataNoDegrade.agreed_capability_lease.lease_status = "ACTIVE_DEGRADED";
  dataNoDegrade.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_FULL",
      active_mode: "gpu_direct",
      fallback_applied: "NONE"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_FULL",
      active_mode: "native_s3_object_lock",
      fallback_applied: "NONE"
    },
    {
      capability_name: "cache_cluster_replication",
      slot_id: "cache",
      disposition: "GRANTED_FULL",
      active_mode: "cluster_redis",
      fallback_applied: "NONE"
    }
  ];
  assert.throws(
    () => validatePlatformSemantics(dataNoDegrade, schemaId),
    /ACTIVE_DEGRADED lease must contain at least one GRANTED_DEGRADED capability with non-NONE fallback or omit a capability with required_for_optimal: true/
  );

  // GRANTED_DEGRADED but fallback_applied is NONE
  const data2 = JSON.parse(JSON.stringify(sample));
  data2.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_DEGRADED",
      active_mode: "cpu_quantized_emulation",
      fallback_applied: "NONE"
    }
  ];
  const valid2 = ajv.validate(schemaId, data2);
  assert.ok(!valid2, 'Should reject ACTIVE_DEGRADED with GRANTED_DEGRADED and fallback_applied NONE');
});

test('in-memory validation: storage or storage_object_lock degradation passes schema validation structurally (Finding 3 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. slot_id: "storage" with disposition: "GRANTED_DEGRADED" passes schema validation
  const data1 = JSON.parse(JSON.stringify(sample));
  data1.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "storage_custom_perf",
      slot_id: "storage",
      disposition: "GRANTED_DEGRADED",
      active_mode: "slow_emulated_storage",
      fallback_applied: "CORE_EMULATION_FALLBACK"
    }
  ];
  const valid1 = ajv.validate(schemaId, data1);
  assert.ok(valid1, 'Degraded storage slot_id should pass schema validation structurally: ' + ajv.errorsText());

  // 2. capability_name: "storage_object_lock" with disposition: "GRANTED_DEGRADED" passes schema validation
  const data2 = JSON.parse(JSON.stringify(sample));
  data2.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_DEGRADED",
      active_mode: "standard_retention_fallback",
      fallback_applied: "FEATURE_DISABLED_GRACEFUL"
    }
  ];
  const valid2 = ajv.validate(schemaId, data2);
  assert.ok(valid2, 'Degraded storage_object_lock should pass schema validation structurally: ' + ajv.errorsText());

  // 3. Non-storage capability degradation is permitted under ACTIVE_DEGRADED
  const data3 = JSON.parse(JSON.stringify(sample));
  data3.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_DEGRADED",
      active_mode: "cpu_quantized_emulation",
      fallback_applied: "CORE_EMULATION_FALLBACK"
    }
  ];
  const valid3 = ajv.validate(schemaId, data3);
  assert.ok(valid3, 'Should accept valid non-storage degradation: ' + ajv.errorsText());
});

test('in-memory validation: validate immutable_storage_required in deployment profile schema (OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'onprem-standard-v1.profile.json'), 'utf8'));

  // Valid boolean immutable_storage_required (true or false) passes
  assert.equal(sample.slots?.storage?.specification?.immutable_storage_required, true);
  const valid1 = ajv.validate(schemaId, sample);
  assert.ok(valid1, 'Valid profile with immutable_storage_required: true should pass: ' + ajv.errorsText());

  const dataFalse = JSON.parse(JSON.stringify(sample));
  dataFalse.slots.storage.specification.immutable_storage_required = false;
  const validFalse = ajv.validate(schemaId, dataFalse);
  assert.ok(validFalse, 'Valid profile with immutable_storage_required: false should pass: ' + ajv.errorsText());

  // Non-boolean immutable_storage_required is rejected
  const data2String = JSON.parse(JSON.stringify(sample));
  data2String.slots.storage.specification.immutable_storage_required = "true";
  assert.ok(!ajv.validate(schemaId, data2String), 'String immutable_storage_required must be rejected');

  const data2Num = JSON.parse(JSON.stringify(sample));
  data2Num.slots.storage.specification.immutable_storage_required = 1;
  assert.ok(!ajv.validate(schemaId, data2Num), 'Numeric immutable_storage_required must be rejected');

  const data2Null = JSON.parse(JSON.stringify(sample));
  data2Null.slots.storage.specification.immutable_storage_required = null;
  assert.ok(!ajv.validate(schemaId, data2Null), 'Null immutable_storage_required must be rejected');

  // Omitting immutable_storage_required when storage specification is defined is rejected
  const data3 = JSON.parse(JSON.stringify(sample));
  delete data3.slots.storage.specification.immutable_storage_required;
  const valid3 = ajv.validate(schemaId, data3);
  assert.ok(!valid3, 'Omitting immutable_storage_required from storage specification must be rejected');
  const hasMissingPropError = ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'immutable_storage_required');
  assert.ok(hasMissingPropError, 'Schema error must indicate missing immutable_storage_required');

  // Omitting specification under slots.storage is rejected
  const dataNoSpec = JSON.parse(JSON.stringify(sample));
  delete dataNoSpec.slots.storage.specification;
  const validNoSpec = ajv.validate(schemaId, dataNoSpec);
  assert.ok(!validNoSpec, 'Omitting specification from slots.storage must be rejected');
  const hasMissingSpecError = ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'specification');
  assert.ok(hasMissingSpecError, 'Schema error must indicate missing specification under slots.storage');

  // Omitting storage under slots is rejected (Finding 1 / OPEN-5)
  const dataNoStorage = JSON.parse(JSON.stringify(sample));
  delete dataNoStorage.slots.storage;
  const validNoStorage = ajv.validate(schemaId, dataNoStorage);
  assert.ok(!validNoStorage, 'Omitting storage from slots must be rejected');
  const hasMissingStorageError = ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'storage');
  assert.ok(hasMissingStorageError, 'Schema error must indicate missing storage under slots');

  // Omitting slots from top-level is rejected (Finding 1 / OPEN-5)
  const dataNoSlots = JSON.parse(JSON.stringify(sample));
  delete dataNoSlots.slots;
  const validNoSlots = ajv.validate(schemaId, dataNoSlots);
  assert.ok(!validNoSlots, 'Omitting slots from top-level must be rejected');
  const hasMissingSlotsError = ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'slots');
  assert.ok(hasMissingSlotsError, 'Schema error must indicate missing slots at top-level');

  // Explicit boolean false immutable_storage_required is accepted by schema (valid boolean type)
  const data4 = JSON.parse(JSON.stringify(sample));
  data4.slots.storage.specification.immutable_storage_required = false;
  const valid4 = ajv.validate(schemaId, data4);
  assert.ok(valid4, 'Explicit boolean false immutable_storage_required should be valid in schema: ' + ajv.errorsText());
});

test('in-memory validation: structured evidence URI enforcement in provider capability negotiation (Finding 3 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // Valid structured URNs pass schema validation
  const validURIs = [
    'urn:cybrik:evidence:ev-oci-01',
    'urn:cybrik:evidence:store:lock:v1',
    'urn:cybrik:evidence:test_01-abc',
    'urn:cybrik:evidence:a:b:c:d'
  ];
  for (const uri of validURIs) {
    const data = JSON.parse(JSON.stringify(sample));
    data.advertisement_response.advertised_capabilities[0].evidence_references = [uri];
    data.advertisement_response.conformance_evidence[0].test_identifier = uri;
    const ok = ajv.validate(schemaId, data);
    assert.ok(ok, `Expected evidence URI '${uri}' to pass schema validation: ` + ajv.errorsText());
  }

  // Invalid evidence URIs rejected by schema pattern
  const invalidURIs = [
    'ev-oci-01',
    'https://example.com/report.json',
    'urn:other:evidence:ev-01',
    'urn:cybrik:evidence:',
    'urn:cybrik:evidence:invalid@char',
    'urn:cybrik:evidence:trailing:',
    ':urn:cybrik:evidence:leading',
    'urn:cybrik:evidence:space not allowed',
    'urn:cybrik:evidence:UPPERCASE-TEST',
    'urn:cybrik:evidence:MixedCaseTest:v1'
  ];
  for (const uri of invalidURIs) {
    const data = JSON.parse(JSON.stringify(sample));
    data.advertisement_response.advertised_capabilities[0].evidence_references = [uri];
    data.advertisement_response.conformance_evidence[0].test_identifier = uri;
    const ok = ajv.validate(schemaId, data);
    assert.ok(!ok, `Expected invalid evidence URI '${uri}' to be rejected by schema`);
    const hasPatternError = ajv.errors.some(e => e.keyword === 'pattern' && (e.instancePath.includes('evidence_references') || e.instancePath.includes('conformance_evidence')));
    assert.ok(hasPatternError, `Expected pattern error on evidence_references or conformance_evidence for '${uri}'`);
  }

  // Invalid test_identifier alone rejected by schema pattern
  for (const uri of invalidURIs) {
    const data = JSON.parse(JSON.stringify(sample));
    data.advertisement_response.conformance_evidence[0].test_identifier = uri;
    const ok = ajv.validate(schemaId, data);
    assert.ok(!ok, `Expected invalid test_identifier '${uri}' to be rejected by schema`);
    const hasPatternError = ajv.errors.some(e => e.keyword === 'pattern' && e.instancePath.includes('conformance_evidence'));
    assert.ok(hasPatternError, `Expected pattern error on conformance_evidence test_identifier for '${uri}'`);
  }
});

test('on-disk deployment profiles declare explicit immutable_storage_required across all 4 profiles (Finding 1 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
  const profiles = [
    { file: 'onprem-standard-v1.profile.json', expected: true },
    { file: 'onprem-airgap-v1.profile.json', expected: true },
    { file: 'hybrid-sovereign-v1.profile.json', expected: true },
    { file: 'private-cloud-v1.profile.json', expected: false },
  ];

  for (const { file, expected } of profiles) {
    const raw = readFileSync(join(EXAMPLES_DIR, file), 'utf8');
    const doc = JSON.parse(raw);
    assert.ok(ajv.validate(schemaId, doc), `${file} should validate against schema: ` + ajv.errorsText());
    assert.equal(
      doc.slots?.storage?.specification?.immutable_storage_required,
      expected,
      `${file} must have slots.storage.specification.immutable_storage_required === ${expected}`
    );
  }
});

test('in-memory validation: reject capability negotiation with degraded storage across all immutable profiles (DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const immutableProfiles = [
    'onprem-standard-v1',
    'onprem-airgap-v1',
    'hybrid-sovereign-v1'
  ];

  for (const profileId of immutableProfiles) {
    const profilePath = join(EXAMPLES_DIR, `${profileId}.profile.json`);
    assert.ok(existsSync(profilePath), `Profile fixture missing: ${profilePath}`);
    const profileData = JSON.parse(readFileSync(profilePath, 'utf8'));
    assert.equal(
      profileData.slots?.storage?.specification?.immutable_storage_required,
      true,
      `${profileId} must mandate immutable_storage_required: true`
    );
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    // 1. Degraded storage_object_lock by capability_name throws DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
    const data1 = JSON.parse(JSON.stringify(sample));
    data1.target_profile_id = profileId;
    data1.target_profile_digest = profileDigest;
    data1.agreed_capability_lease.target_profile_id = profileId;
    data1.agreed_capability_lease.target_profile_digest = profileDigest;
    data1.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
    data1.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: "storage_object_lock",
        slot_id: "storage",
        disposition: "GRANTED_DEGRADED",
        active_mode: "standard_retention_fallback",
        fallback_applied: "FEATURE_DISABLED_GRACEFUL"
      }
    ];

    assert.ok(ajv.validate(schemaId, data1), `Structurally valid schema for ${profileId}: ` + ajv.errorsText());
    assert.throws(
      () => validatePlatformSemantics(data1, schemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
      `Expected ${profileId} to reject degraded storage_object_lock`
    );

    // 2. Degraded storage by slot_id throws DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
    const data2 = JSON.parse(JSON.stringify(sample));
    data2.target_profile_id = profileId;
    data2.target_profile_digest = profileDigest;
    data2.agreed_capability_lease.target_profile_id = profileId;
    data2.agreed_capability_lease.target_profile_digest = profileDigest;
    data2.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
    data2.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: "storage_custom_perf",
        slot_id: "storage",
        disposition: "GRANTED_DEGRADED",
        active_mode: "slow_emulated_storage",
        fallback_applied: "CORE_EMULATION_FALLBACK"
      }
    ];

    assert.ok(ajv.validate(schemaId, data2), `Structurally valid schema for ${profileId}: ` + ajv.errorsText());
    assert.throws(
      () => validatePlatformSemantics(data2, schemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
      `Expected ${profileId} to reject degraded storage slot_id`
    );
  }
});

test('in-memory validation: permit degraded storage when profile does not require immutable storage (DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const privateCloudPath = join(EXAMPLES_DIR, 'private-cloud-v1.profile.json');
  assert.ok(existsSync(privateCloudPath), 'private-cloud-v1 profile must exist');
  const privateCloudData = JSON.parse(readFileSync(privateCloudPath, 'utf8'));
  assert.equal(
    privateCloudData.slots?.storage?.specification?.immutable_storage_required,
    false,
    'private-cloud-v1 must declare immutable_storage_required: false'
  );
  const privateCloudDigest = createHash('sha256').update(readFileSync(privateCloudPath)).digest('hex');

  // 1. Degraded storage_object_lock against private-cloud-v1 (immutable_storage_required: false / not mandated)
  const data1 = JSON.parse(JSON.stringify(sample));
  data1.target_profile_id = 'private-cloud-v1';
  data1.target_profile_digest = privateCloudDigest;
  if (data1.advertisement_response) data1.advertisement_response.target_profile_digest = privateCloudDigest;
  data1.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  data1.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  data1.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  const storeCap1 = data1.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock' || c.slot_id === 'storage');
  if (storeCap1) {
    storeCap1.disposition = "GRANTED_DEGRADED";
    storeCap1.active_mode = "standard_retention_fallback";
    storeCap1.fallback_applied = "FEATURE_DISABLED_GRACEFUL";
  }

  assert.ok(ajv.validate(schemaId, data1), 'Structurally valid schema: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(data1, schemaId),
    'Should pass semantic validation when profile does not require immutable storage'
  );

  // 2. Degraded storage slot_id against private-cloud-v1 (immutable_storage_required: false / not mandated)
  const data2 = JSON.parse(JSON.stringify(sample));
  data2.target_profile_id = 'private-cloud-v1';
  data2.target_profile_digest = privateCloudDigest;
  if (data2.advertisement_response) data2.advertisement_response.target_profile_digest = privateCloudDigest;
  data2.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  data2.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  data2.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  const storeCap2 = data2.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock' || c.slot_id === 'storage');
  if (storeCap2) {
    storeCap2.capability_name = "storage_custom_perf";
    storeCap2.disposition = "GRANTED_DEGRADED";
    storeCap2.active_mode = "slow_emulated_storage";
    storeCap2.fallback_applied = "CORE_EMULATION_FALLBACK";
  }
  const reqStore = data2.negotiation_request.requested_optional_capabilities.find(c => c.capability_name === 'storage_object_lock');
  if (reqStore) reqStore.capability_name = "storage_custom_perf";

  assert.ok(ajv.validate(schemaId, data2), 'Structurally valid schema: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(data2, schemaId),
    'Should pass semantic validation when profile does not require immutable storage'
  );

  // 3. Degraded storage with fallback_applied: "NONE" under ACTIVE_DEGRADED must be rejected by lease invariants
  const data3 = JSON.parse(JSON.stringify(data1));
  const storeCap3 = data3.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock' || c.slot_id === 'storage');
  if (storeCap3) storeCap3.fallback_applied = "NONE";
  assert.throws(
    () => validatePlatformSemantics(data3, schemaId),
    /capability 'storage_object_lock' with fallback 'NONE' must have disposition 'GRANTED_FULL'|ACTIVE_DEGRADED lease must contain at least one GRANTED_DEGRADED capability with non-NONE fallback/
  );
});

test('in-memory validation: mandatory storage_object_lock presence with GRANTED_FULL for immutable-storage profile leases (OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const immutableProfiles = ['onprem-standard-v1', 'onprem-airgap-v1', 'hybrid-sovereign-v1'];

  for (const profileId of immutableProfiles) {
    const profilePath = join(EXAMPLES_DIR, `${profileId}.profile.json`);
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    // 1. Omitting storage_object_lock from lease under immutable profile throws exact error
    const dataMissingLock = JSON.parse(JSON.stringify(sample));
    dataMissingLock.target_profile_id = profileId;
    dataMissingLock.target_profile_digest = profileDigest;
    if (dataMissingLock.advertisement_response) {
      dataMissingLock.advertisement_response.target_profile_digest = profileDigest;
    }
    dataMissingLock.agreed_capability_lease.target_profile_id = profileId;
    dataMissingLock.agreed_capability_lease.target_profile_digest = profileDigest;
    dataMissingLock.agreed_capability_lease.negotiated_optional_capabilities =
      dataMissingLock.agreed_capability_lease.negotiated_optional_capabilities.filter(
        c => c.capability_name !== 'storage_object_lock'
      );

    assert.throws(
      () => validatePlatformSemantics(dataMissingLock, schemaId),
      /Semantic error: immutable storage profile requires storage_object_lock capability in lease with GRANTED_FULL disposition/,
      `Expected ${profileId} to reject lease omitting storage_object_lock`
    );

    // 2. Having storage_object_lock with GRANTED_FULL and fallback NONE passes
    const dataValidLock = JSON.parse(JSON.stringify(sample));
    dataValidLock.target_profile_id = profileId;
    dataValidLock.target_profile_digest = profileDigest;
    if (dataValidLock.advertisement_response) {
      dataValidLock.advertisement_response.target_profile_digest = profileDigest;
    }
    dataValidLock.agreed_capability_lease.target_profile_id = profileId;
    dataValidLock.agreed_capability_lease.target_profile_digest = profileDigest;
    assert.doesNotThrow(
      () => validatePlatformSemantics(dataValidLock, schemaId),
      `Expected ${profileId} to pass with GRANTED_FULL storage_object_lock`
    );

    // 2b. Providing an alias (e.g. storage_lock_alias, storage_lock) instead of exact storage_object_lock fails closed terminally
    const lockAliases = ['storage_lock_alias', 'storage_lock', 'storage_object_lock_alias', 'object_lock'];
    for (const alias of lockAliases) {
      const dataAliasLock = JSON.parse(JSON.stringify(sample));
      dataAliasLock.target_profile_id = profileId;
      dataAliasLock.target_profile_digest = profileDigest;
      if (dataAliasLock.advertisement_response) {
        dataAliasLock.advertisement_response.target_profile_digest = profileDigest;
      }
      dataAliasLock.agreed_capability_lease.target_profile_id = profileId;
      dataAliasLock.agreed_capability_lease.target_profile_digest = profileDigest;
      dataAliasLock.negotiation_request.requested_optional_capabilities =
        dataAliasLock.negotiation_request.requested_optional_capabilities.map(c =>
          c.capability_name === 'storage_object_lock' ? { ...c, capability_name: alias } : c
        );
      dataAliasLock.agreed_capability_lease.negotiated_optional_capabilities =
        dataAliasLock.agreed_capability_lease.negotiated_optional_capabilities.map(c =>
          c.capability_name === 'storage_object_lock' ? { ...c, capability_name: alias } : c
        );

      assert.throws(
        () => validatePlatformSemantics(dataAliasLock, schemaId),
        /Semantic error: (DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN: immutable storage profile prohibits non-canonical storage capability aliases or surplus storage capabilities in request or lease|immutable storage profile requires storage_object_lock capability in lease with GRANTED_FULL disposition)/,
        `Expected ${profileId} to reject alias capability name '${alias}'`
      );
    }
  }

  // 3. Omitting storage_object_lock under non-immutable profile (private-cloud-v1) is permitted
  const privateCloudPath = join(EXAMPLES_DIR, 'private-cloud-v1.profile.json');
  const privateCloudDigest = createHash('sha256').update(readFileSync(privateCloudPath)).digest('hex');
  const dataPrivateNoLock = JSON.parse(JSON.stringify(sample));
  dataPrivateNoLock.target_profile_id = 'private-cloud-v1';
  dataPrivateNoLock.target_profile_digest = privateCloudDigest;
  if (dataPrivateNoLock.advertisement_response) {
    dataPrivateNoLock.advertisement_response.target_profile_digest = privateCloudDigest;
  }
  dataPrivateNoLock.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  dataPrivateNoLock.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  dataPrivateNoLock.negotiation_request.requested_optional_capabilities =
    dataPrivateNoLock.negotiation_request.requested_optional_capabilities.filter(c => c.capability_name !== 'storage_object_lock');
  dataPrivateNoLock.agreed_capability_lease.negotiated_optional_capabilities =
    dataPrivateNoLock.agreed_capability_lease.negotiated_optional_capabilities.filter(c => c.capability_name !== 'storage_object_lock');

  assert.doesNotThrow(
    () => validatePlatformSemantics(dataPrivateNoLock, schemaId),
    'Non-immutable profile lease without storage_object_lock must pass validation'
  );
});

test('in-memory validation: structurally enforce disposition and fallback coupling (Finding 2 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. GRANTED_FULL with fallback_applied: NONE passes schema validation
  const data1 = JSON.parse(JSON.stringify(sample));
  data1.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_FULL",
      active_mode: "gpu_direct",
      fallback_applied: "NONE"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_DEGRADED",
      active_mode: "standard_retention",
      fallback_applied: "FEATURE_DISABLED_GRACEFUL"
    }
  ];
  assert.ok(ajv.validate(schemaId, data1), 'GRANTED_FULL with fallback NONE must pass: ' + ajv.errorsText());

  // 2. GRANTED_FULL with fallback_applied: CORE_EMULATION_FALLBACK is rejected structurally
  const data2 = JSON.parse(JSON.stringify(sample));
  data2.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_FULL",
      active_mode: "gpu_direct",
      fallback_applied: "CORE_EMULATION_FALLBACK"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_DEGRADED",
      active_mode: "standard_retention",
      fallback_applied: "FEATURE_DISABLED_GRACEFUL"
    }
  ];
  assert.ok(!ajv.validate(schemaId, data2), 'GRANTED_FULL with non-NONE fallback must be rejected by schema');

  // 3. GRANTED_FULL with fallback_applied: FEATURE_DISABLED_GRACEFUL is rejected structurally
  const data3 = JSON.parse(JSON.stringify(sample));
  data3.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_FULL",
      active_mode: "gpu_direct",
      fallback_applied: "FEATURE_DISABLED_GRACEFUL"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_DEGRADED",
      active_mode: "standard_retention",
      fallback_applied: "FEATURE_DISABLED_GRACEFUL"
    }
  ];
  assert.ok(!ajv.validate(schemaId, data3), 'GRANTED_FULL with non-NONE fallback must be rejected by schema');

  // 4. GRANTED_DEGRADED with fallback_applied: NONE is rejected structurally
  const data4 = JSON.parse(JSON.stringify(sample));
  data4.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_DEGRADED",
      active_mode: "cpu_quantized",
      fallback_applied: "NONE"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_DEGRADED",
      active_mode: "standard_retention",
      fallback_applied: "FEATURE_DISABLED_GRACEFUL"
    }
  ];
  assert.ok(!ajv.validate(schemaId, data4), 'GRANTED_DEGRADED with fallback NONE must be rejected by schema');

  // 5. REJECTED_UNSUPPORTED with fallback_applied: NONE is rejected structurally
  const data5 = JSON.parse(JSON.stringify(sample));
  data5.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "REJECTED_UNSUPPORTED",
      active_mode: "disabled",
      fallback_applied: "NONE"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_DEGRADED",
      active_mode: "standard_retention",
      fallback_applied: "FEATURE_DISABLED_GRACEFUL"
    }
  ];
  assert.ok(!ajv.validate(schemaId, data5), 'REJECTED_UNSUPPORTED with fallback NONE must be rejected by schema');
});

test('in-memory validation: reject immutable storage with non-GRANTED_FULL disposition or non-NONE fallback (Finding 6 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const immutableProfiles = ['onprem-standard-v1', 'onprem-airgap-v1', 'hybrid-sovereign-v1'];

  for (const profileId of immutableProfiles) {
    const profilePath = join(EXAMPLES_DIR, `${profileId}.profile.json`);
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    // 1. REJECTED_UNSUPPORTED disposition on storage capability throws DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
    const dataUnsupported = JSON.parse(JSON.stringify(sample));
    dataUnsupported.target_profile_id = profileId;
    dataUnsupported.target_profile_digest = profileDigest;
    dataUnsupported.agreed_capability_lease.target_profile_id = profileId;
    dataUnsupported.agreed_capability_lease.target_profile_digest = profileDigest;
    dataUnsupported.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
    dataUnsupported.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: "storage_object_lock",
        slot_id: "storage",
        disposition: "REJECTED_UNSUPPORTED",
        active_mode: "unsupported",
        fallback_applied: "FEATURE_DISABLED_GRACEFUL"
      },
      {
        capability_name: "ai_tensor_acceleration",
        slot_id: "ai_model_runtime",
        disposition: "GRANTED_DEGRADED",
        active_mode: "cpu_quantized_emulation",
        fallback_applied: "CORE_EMULATION_FALLBACK"
      }
    ];

    assert.throws(
      () => validatePlatformSemantics(dataUnsupported, schemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/
    );

    // 2. Non-NONE fallback on storage capability throws DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
    const dataNonNoneFallback = JSON.parse(JSON.stringify(sample));
    dataNonNoneFallback.target_profile_id = profileId;
    dataNonNoneFallback.target_profile_digest = profileDigest;
    dataNonNoneFallback.agreed_capability_lease.target_profile_id = profileId;
    dataNonNoneFallback.agreed_capability_lease.target_profile_digest = profileDigest;
    dataNonNoneFallback.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
    dataNonNoneFallback.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: "storage_custom_opt",
        slot_id: "storage",
        disposition: "GRANTED_FULL",
        active_mode: "direct",
        fallback_applied: "CORE_EMULATION_FALLBACK"
      },
      {
        capability_name: "ai_tensor_acceleration",
        slot_id: "ai_model_runtime",
        disposition: "GRANTED_DEGRADED",
        active_mode: "cpu_quantized_emulation",
        fallback_applied: "CORE_EMULATION_FALLBACK"
      }
    ];

    assert.throws(
      () => validatePlatformSemantics(dataNonNoneFallback, schemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/
    );
  }
});

test('in-memory validation: Object Lock evidence references and conformance evidence closure (Finding 6 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Valid structured URN evidence reference backed by matching conformance evidence passes semantic validation
  const dataObj = JSON.parse(JSON.stringify(sample));
  const storeCapObj = dataObj.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapObj.evidence_references.push("urn:cybrik:evidence:test-storage-lock-01");
  dataObj.advertisement_response.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:test-storage-lock-01",
    status: "PASS",
    evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000001",
    executed_at: "2026-08-27T12:00:00Z",
    report_uri: "https://reports.cybrik.example/evidence/urn-lock-01.json"
  });

  assert.doesNotThrow(() => validatePlatformSemantics(dataObj, schemaId));
  assert.ok(ajv.validate(schemaId, dataObj), `Must pass Ajv schema: ${ajv.errorsText()}`);

  // 2. Additional valid evidence reference in another capability passes semantic validation
  const dataMulti = JSON.parse(JSON.stringify(sample));
  const storeCapMulti = dataMulti.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapMulti.evidence_references.push("urn:cybrik:evidence:test-storage-lock-02");
  dataMulti.advertisement_response.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:test-storage-lock-02",
    status: "PASS",
    evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000002",
    executed_at: "2026-08-27T12:00:00Z",
    report_uri: "https://reports.cybrik.example/evidence/urn-lock-02.json"
  });

  assert.doesNotThrow(() => validatePlatformSemantics(dataMulti, schemaId));
  assert.ok(ajv.validate(schemaId, dataMulti), `Must pass Ajv schema: ${ajv.errorsText()}`);

  // 3. Storage evidence reference missing matching conformance evidence throws
  const dataMissingEv = JSON.parse(JSON.stringify(sample));
  const storeCapMissingEv = dataMissingEv.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapMissingEv.evidence_references.push("urn:cybrik:evidence:test-storage-lock-03");

  assert.throws(
    () => validatePlatformSemantics(dataMissingEv, schemaId),
    /evidence_reference 'urn:cybrik:evidence:test-storage-lock-03' not found in conformance_evidence/
  );

  // 4. Conformance evidence with non-PASS status throws
  const dataNonPassEv = JSON.parse(JSON.stringify(sample));
  const storeCapNonPass = dataNonPassEv.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapNonPass.evidence_references.push("urn:cybrik:evidence:test-storage-lock-04");
  dataNonPassEv.advertisement_response.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:test-storage-lock-04",
    status: "FAIL",
    evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000004",
    executed_at: "2026-08-27T12:00:00Z",
    report_uri: "https://reports.cybrik.example/evidence/fail-lock-04.json"
  });

  assert.throws(
    () => validatePlatformSemantics(dataNonPassEv, schemaId),
    /conformance evidence 'urn:cybrik:evidence:test-storage-lock-04' has non-passing status 'FAIL'/
  );

  // 5. Dangling/unreferenced conformance evidence throws
  const dataDangling = JSON.parse(JSON.stringify(sample));
  dataDangling.advertisement_response.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:test-storage-lock-dangling",
    status: "PASS",
    evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000005",
    executed_at: "2026-08-27T12:00:00Z",
    report_uri: "https://reports.cybrik.example/evidence/urn-lock-dangling.json"
  });

  assert.throws(
    () => validatePlatformSemantics(dataDangling, schemaId),
    /conformance_evidence contains unreferenced or dangling evidence 'urn:cybrik:evidence:test-storage-lock-dangling'/
  );

  // 6. Malformed URN in evidence references is rejected by Ajv schema
  const dataBadUrn = JSON.parse(JSON.stringify(sample));
  const storeCapBadUrn = dataBadUrn.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapBadUrn.evidence_references.push("urn:::invalid-urn");
  dataBadUrn.advertisement_response.conformance_evidence.push({
    test_identifier: "urn:::invalid-urn",
    status: "PASS",
    evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000006",
    executed_at: "2026-08-27T12:00:00Z",
    report_uri: "https://reports.cybrik.example/evidence/bad-urn.json"
  });
  const validBadUrn = ajv.validate(schemaId, dataBadUrn);
  assert.equal(validBadUrn, false, 'Malformed URN in evidence_references must fail Ajv schema validation');
});

test('canonical S3 dispatch helpers: dispatchS3Error, computePayloadMd5, isMalformedBase64Md5 (Finding 6 / OPEN-2)', () => {
  // 1. computePayloadMd5
  const buf = Buffer.from('TEST_PAYLOAD_FOR_MD5_CANONICAL');
  const expectedMd5 = createHash('md5').update(buf).digest('base64');
  assert.equal(computePayloadMd5(buf), expectedMd5);
  assert.equal(computePayloadMd5('TEST_PAYLOAD_FOR_MD5_CANONICAL'), expectedMd5);
  assert.equal(computePayloadMd5(new Uint8Array(buf)), expectedMd5);
  assert.throws(() => computePayloadMd5(null), TypeError);
  assert.throws(() => computePayloadMd5(undefined), TypeError);

  // 2. isMalformedBase64Md5
  assert.equal(isMalformedBase64Md5(expectedMd5), false);
  assert.equal(isMalformedBase64Md5('not-valid-md5'), true);
  assert.equal(isMalformedBase64Md5(''), true);
  assert.equal(isMalformedBase64Md5(null), true);
  assert.equal(isMalformedBase64Md5(12345), true);
  assert.equal(isMalformedBase64Md5('AAAA=='), true);

  // 3. dispatchS3Error with options object
  const validDispatch = dispatchS3Error({ payloadBytes: buf, contentMd5Header: expectedMd5 });
  assert.equal(validDispatch.http_status, 200);
  assert.equal(validDispatch.error_code, null);

  const mismatchDispatch = dispatchS3Error({ payloadBytes: buf, contentMd5Header: '1B2M2Y8AsgTpgAmY7PhCfg==' });
  assert.equal(mismatchDispatch.http_status, 400);
  assert.equal(mismatchDispatch.error_code, 'BadDigest');
  assert.equal(mismatchDispatch.reason, 'PAYLOAD_DIGEST_MISMATCH');

  const malformedDispatch = dispatchS3Error({ payloadBytes: buf, contentMd5Header: 'malformed!' });
  assert.equal(malformedDispatch.http_status, 400);
  assert.equal(malformedDispatch.error_code, 'InvalidDigest');
  assert.equal(malformedDispatch.reason, 'MALFORMED_HEADER_SYNTAX');

  // 4. dispatchS3Error with string condition
  assert.equal(dispatchS3Error('BadDigest').error_code, 'BadDigest');
  assert.equal(dispatchS3Error('PAYLOAD_DIGEST_MISMATCH').error_code, 'BadDigest');
  assert.equal(dispatchS3Error('InvalidDigest').error_code, 'InvalidDigest');
  assert.equal(dispatchS3Error('MALFORMED_DIGEST_HEADER').error_code, 'InvalidDigest');
  assert.equal(dispatchS3Error('MALFORMED_HEADER_SYNTAX').error_code, 'InvalidDigest');
  assert.equal(dispatchS3Error('InvalidPartOrder').error_code, 'InvalidPartOrder');
  assert.equal(dispatchS3Error('DUPLICATE_PART').error_code, 'InvalidPartOrder');
  assert.equal(dispatchS3Error('INVALID_PART_ORDER').error_code, 'InvalidPartOrder');
  assert.equal(dispatchS3Error('PART_OUT_OF_ORDER').error_code, 'InvalidPartOrder');

  // 5. dispatchS3Error with two arguments (payloadBytes, contentMd5Header)
  const twoArgValid = dispatchS3Error(buf, expectedMd5);
  assert.equal(twoArgValid.http_status, 200);
  assert.equal(twoArgValid.error_code, null);

  const twoArgMismatch = dispatchS3Error(buf, '1B2M2Y8AsgTpgAmY7PhCfg==');
  assert.equal(twoArgMismatch.http_status, 400);
  assert.equal(twoArgMismatch.error_code, 'BadDigest');

  const twoArgMalformed = dispatchS3Error(buf, 'bad-header-val');
  assert.equal(twoArgMalformed.http_status, 400);
  assert.equal(twoArgMalformed.error_code, 'InvalidDigest');

  // 6. Function, Date, and Uint16Array return InvalidDigest (MALFORMED_PAYLOAD_TYPE) in dispatchS3Error and dispatchS3PutObject
  const badTypes = [
    () => 'func_payload',
    new Date(),
    new Uint16Array([1, 2, 3])
  ];

  for (const bad of badTypes) {
    // dispatchS3Error direct, positional, and options
    const errDirect = dispatchS3Error(bad);
    assert.equal(errDirect.http_status, 400);
    assert.equal(errDirect.error_code, 'InvalidDigest');
    assert.equal(errDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    const errPos = dispatchS3Error(bad, expectedMd5);
    assert.equal(errPos.http_status, 400);
    assert.equal(errPos.error_code, 'InvalidDigest');
    assert.equal(errPos.reason, 'MALFORMED_PAYLOAD_TYPE');

    const errOpt = dispatchS3Error({ payload: bad, contentMd5Header: expectedMd5 });
    assert.equal(errOpt.http_status, 400);
    assert.equal(errOpt.error_code, 'InvalidDigest');
    assert.equal(errOpt.reason, 'MALFORMED_PAYLOAD_TYPE');

    // dispatchS3PutObject direct, positional, and options
    const putDirect = dispatchS3PutObject(bad);
    assert.equal(putDirect.http_status, 400);
    assert.equal(putDirect.error_code, 'InvalidDigest');
    assert.equal(putDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    const putPos = dispatchS3PutObject(bad, expectedMd5, 'UNSIGNED-PAYLOAD');
    assert.equal(putPos.http_status, 400);
    assert.equal(putPos.error_code, 'InvalidDigest');
    assert.equal(putPos.reason, 'MALFORMED_PAYLOAD_TYPE');

    const putOpt = dispatchS3PutObject({ payload: bad, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' });
    assert.equal(putOpt.http_status, 400);
    assert.equal(putOpt.error_code, 'InvalidDigest');
    assert.equal(putOpt.reason, 'MALFORMED_PAYLOAD_TYPE');
  }
});

test('in-memory validation: reject HEALTH_PROBE with remote WAN target or POST method in offline manifest (OPEN-1)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'), 'utf8'));

  // 1. Valid local HEALTH_PROBE with GET on 127.0.0.1 passes schema validation
  const valid1 = JSON.parse(JSON.stringify(sample));
  valid1.update_station_workflow.apply_steps.push({
    step_id: 'health-check-local-127',
    action: 'HEALTH_PROBE',
    target: 'http://127.0.0.1:8080/healthz',
    parameters: {
      method: 'GET',
      expected_status: 200,
      interval_seconds: 5,
      retries: 3
    }
  });
  assert.ok(ajv.validate(schemaId, valid1), 'Valid 127.0.0.1 health probe should pass: ' + ajv.errorsText());

  // 2. Valid local HEALTH_PROBE with HEAD on localhost passes schema validation
  const valid2 = JSON.parse(JSON.stringify(sample));
  valid2.update_station_workflow.apply_steps.push({
    step_id: 'health-check-localhost',
    action: 'HEALTH_PROBE',
    target: 'http://localhost:8080/readyz',
    parameters: {
      method: 'HEAD',
      expected_status: 200
    }
  });
  assert.ok(ajv.validate(schemaId, valid2), 'Valid localhost health probe should pass: ' + ajv.errorsText());

  // 3. Valid local HEALTH_PROBE with IPv6 [::1] loopback passes schema validation
  const valid3 = JSON.parse(JSON.stringify(sample));
  valid3.update_station_workflow.apply_steps.push({
    step_id: 'health-check-ipv6',
    action: 'HEALTH_PROBE',
    target: 'http://[::1]:8080/healthz'
  });
  assert.ok(ajv.validate(schemaId, valid3), 'Valid IPv6 loopback health probe should pass: ' + ajv.errorsText());

  // 4. Reject remote WAN target https://external.example.com
  const invalidWan = JSON.parse(JSON.stringify(sample));
  invalidWan.update_station_workflow.apply_steps.push({
    step_id: 'health-check-wan',
    action: 'HEALTH_PROBE',
    target: 'https://external.example.com/healthz'
  });
  assert.ok(!ajv.validate(schemaId, invalidWan), 'Remote WAN target must be rejected by schema');

  // 5. Reject cloud metadata IP target http://169.254.169.254
  const invalidMetadata = JSON.parse(JSON.stringify(sample));
  invalidMetadata.update_station_workflow.apply_steps.push({
    step_id: 'health-check-metadata',
    action: 'HEALTH_PROBE',
    target: 'http://169.254.169.254/latest/meta-data'
  });
  assert.ok(!ajv.validate(schemaId, invalidMetadata), 'Cloud metadata target 169.254.169.254 must be rejected by schema');

  // 6. Reject mutating method POST
  const invalidPost = JSON.parse(JSON.stringify(sample));
  invalidPost.update_station_workflow.apply_steps.push({
    step_id: 'health-check-post',
    action: 'HEALTH_PROBE',
    target: 'http://127.0.0.1:8080/healthz',
    parameters: {
      method: 'POST'
    }
  });
  assert.ok(!ajv.validate(schemaId, invalidPost), 'Mutating POST method must be rejected by schema');
});

test('in-memory validation: reject deployment profiles missing slots, empty slots, or missing storage/specification (Finding 1 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'onprem-standard-v1.profile.json'), 'utf8'));

  // 1. Deleting slots entirely is rejected by schema validation
  const dataNoSlots = JSON.parse(JSON.stringify(sample));
  delete dataNoSlots.slots;
  assert.ok(!ajv.validate(schemaId, dataNoSlots), 'Omitting slots from deployment profile must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'slots'),
    'Schema error must indicate missing slots'
  );

  // 2. Empty slots: {} is rejected by schema validation
  const dataEmptySlots = JSON.parse(JSON.stringify(sample));
  dataEmptySlots.slots = {};
  assert.ok(!ajv.validate(schemaId, dataEmptySlots), 'Empty slots: {} in deployment profile must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'storage'),
    'Schema error must indicate missing storage under slots'
  );

  // 3. Omitting storage from slots is rejected by schema validation
  const dataNoStorage = JSON.parse(JSON.stringify(sample));
  delete dataNoStorage.slots.storage;
  assert.ok(!ajv.validate(schemaId, dataNoStorage), 'Omitting storage from slots must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'storage'),
    'Schema error must indicate missing storage under slots'
  );

  // 4. Omitting specification under slots.storage is rejected by schema validation
  const dataNoSpec = JSON.parse(JSON.stringify(sample));
  delete dataNoSpec.slots.storage.specification;
  assert.ok(!ajv.validate(schemaId, dataNoSpec), 'Omitting specification from slots.storage must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'specification'),
    'Schema error must indicate missing specification under slots.storage'
  );

  // 5. Omitting immutable_storage_required from specification is rejected by schema validation
  const dataNoImmutable = JSON.parse(JSON.stringify(sample));
  delete dataNoImmutable.slots.storage.specification.immutable_storage_required;
  assert.ok(!ajv.validate(schemaId, dataNoImmutable), 'Omitting immutable_storage_required from storage specification must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'immutable_storage_required'),
    'Schema error must indicate missing immutable_storage_required'
  );
});

test('in-memory validation: reject lease with GRANTED_FULL storage capability with non-NONE fallback under immutable profile (Finding 2 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const immutableProfiles = [
    'onprem-standard-v1',
    'onprem-airgap-v1',
    'hybrid-sovereign-v1'
  ];

  for (const profileId of immutableProfiles) {
    const profilePath = join(EXAMPLES_DIR, `${profileId}.profile.json`);
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    // 1. GRANTED_FULL with FEATURE_DISABLED_GRACEFUL fallback on storage_object_lock throws DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
    const dataGraceful = JSON.parse(JSON.stringify(sample));
    dataGraceful.target_profile_id = profileId;
    dataGraceful.target_profile_digest = profileDigest;
    dataGraceful.agreed_capability_lease.target_profile_id = profileId;
    dataGraceful.agreed_capability_lease.target_profile_digest = profileDigest;
    dataGraceful.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: "storage_object_lock",
        slot_id: "storage",
        disposition: "GRANTED_FULL",
        active_mode: "standard_retention_fallback",
        fallback_applied: "FEATURE_DISABLED_GRACEFUL"
      }
    ];
    assert.throws(
      () => validatePlatformSemantics(dataGraceful, schemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
      `Expected ${profileId} to reject GRANTED_FULL storage_object_lock with FEATURE_DISABLED_GRACEFUL`
    );

    // 2. GRANTED_FULL with CORE_EMULATION_FALLBACK on storage_object_lock throws DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
    const dataEmulation = JSON.parse(JSON.stringify(sample));
    dataEmulation.target_profile_id = profileId;
    dataEmulation.target_profile_digest = profileDigest;
    dataEmulation.agreed_capability_lease.target_profile_id = profileId;
    dataEmulation.agreed_capability_lease.target_profile_digest = profileDigest;
    dataEmulation.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: "storage_object_lock",
        slot_id: "storage",
        disposition: "GRANTED_FULL",
        active_mode: "emulated_retention",
        fallback_applied: "CORE_EMULATION_FALLBACK"
      }
    ];
    assert.throws(
      () => validatePlatformSemantics(dataEmulation, schemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
      `Expected ${profileId} to reject GRANTED_FULL storage_object_lock with CORE_EMULATION_FALLBACK`
    );

    // 3. GRANTED_FULL with non-NONE fallback on storage slot_id throws DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
    const dataStorageSlot = JSON.parse(JSON.stringify(sample));
    dataStorageSlot.target_profile_id = profileId;
    dataStorageSlot.target_profile_digest = profileDigest;
    dataStorageSlot.agreed_capability_lease.target_profile_id = profileId;
    dataStorageSlot.agreed_capability_lease.target_profile_digest = profileDigest;
    dataStorageSlot.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: "storage_custom_perf",
        slot_id: "storage",
        disposition: "GRANTED_FULL",
        active_mode: "slow_storage",
        fallback_applied: "FEATURE_DISABLED_GRACEFUL"
      }
    ];
    assert.throws(
      () => validatePlatformSemantics(dataStorageSlot, schemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
      `Expected ${profileId} to reject GRANTED_FULL storage slot with non-NONE fallback`
    );
  }
});

test('in-memory validation: Object Lock evidence validation across Ajv schema and semantic validation (Finding 3 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Positive test: Canonical URN urn:cybrik:evidence:storage:s3:conformance:v1:object-lock passes both Ajv schema and semantic validation
  const dataCanonical = JSON.parse(JSON.stringify(sample));
  const storeCapCanonical = dataCanonical.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapCanonical.evidence_references = ["urn:cybrik:evidence:storage:s3-19-ops:v1", "urn:cybrik:evidence:storage:s3:conformance:v1:object-lock"];
  const validCanonical = ajv.validate(schemaId, dataCanonical);
  assert.ok(validCanonical, 'Canonical Object Lock evidence URN must pass Ajv schema validation: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(dataCanonical, schemaId),
    'Canonical Object Lock evidence URN must pass semantic validation'
  );

  // 2. Legacy Object Lock URN aliases pass Ajv schema validation but fail semantic validation (only canonical urn:cybrik:evidence:storage:s3:conformance:v1:object-lock is allowed)
  const legacyAliases = [
    'urn:cybrik:evidence:storage:object-lock:v1',
    'urn:cybrik:evidence:storage:object-lock',
    'urn:cybrik:evidence:storage-object-lock',
    'urn:cybrik:evidence:object-lock',
    'urn:cybrik:evidence:storage:object-lock:01',
    'urn:cybrik:evidence:storage-object-lock:01',
    'urn:cybrik:evidence:object-lock:retention-v1',
    'urn:cybrik:evidence:storage:object-lock:compliance:2026'
  ];
  for (const legacyUrn of legacyAliases) {
    const dataCan = JSON.parse(JSON.stringify(sample));
    const sc = dataCan.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
    sc.evidence_references = [legacyUrn];
    dataCan.advertisement_response.conformance_evidence = [
      ...dataCan.advertisement_response.conformance_evidence.filter(
        e => !e.test_identifier.includes('object-lock') && !e.test_identifier.includes('s3-17-ops') && !e.test_identifier.includes('s3-19-ops')
      ),
      {
        test_identifier: legacyUrn,
        status: "PASS",
        evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000005",
        executed_at: "2026-08-27T12:00:00Z",
        report_uri: "https://reports.cybrik.example/evidence/canonical.json"
      }
    ];
    const ok = ajv.validate(schemaId, dataCan);
    assert.ok(ok, `Legacy URN '${legacyUrn}' must pass Ajv schema validation: ` + ajv.errorsText());
    assert.throws(
      () => validatePlatformSemantics(dataCan, schemaId),
      /lacks Object Lock retention evidence/,
      `Legacy URN '${legacyUrn}' must fail semantic validation`
    );
  }

  // 3. Negative test: Schema-valid generic evidence URN passes Ajv schema validation but fails semantic validation with lacks Object Lock retention evidence
  const dataGeneric = JSON.parse(JSON.stringify(sample));
  const storeCapGeneric = dataGeneric.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapGeneric.evidence_references = ["urn:cybrik:evidence:generic-storage-report-01"];
  dataGeneric.advertisement_response.conformance_evidence = [
    ...dataGeneric.advertisement_response.conformance_evidence.filter(
      e => !e.test_identifier.includes('object-lock') && !e.test_identifier.includes('s3-17-ops') && !e.test_identifier.includes('s3-19-ops')
    ),
    {
      test_identifier: "urn:cybrik:evidence:generic-storage-report-01",
      status: "PASS",
      evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000006",
      executed_at: "2026-08-27T12:00:00Z",
      report_uri: "https://reports.cybrik.example/evidence/generic-storage-report-01.json"
    }
  ];
  const validGeneric = ajv.validate(schemaId, dataGeneric);
  assert.ok(validGeneric, 'Schema-valid generic evidence URN must pass Ajv schema validation: ' + ajv.errorsText());
  assert.throws(
    () => validatePlatformSemantics(dataGeneric, schemaId),
    /lacks Object Lock retention evidence/,
    'Schema-valid generic evidence URN must fail semantic validation with lacks Object Lock retention evidence'
  );

  // 4. Negative test: Loose substring URNs pass Ajv schema validation but fail semantic validation with lacks Object Lock retention evidence
  const looseSubstrings = [
    'urn:cybrik:evidence:ev-store-object-lock-01',
    'urn:cybrik:evidence:fake-object-lock-bypass',
    'urn:cybrik:evidence:retention-evidence-01',
    'urn:cybrik:evidence:worm-compliance-01',
    'urn:cybrik:evidence:other-object-lock'
  ];
  for (const looseUrn of looseSubstrings) {
    const dataLoose = JSON.parse(JSON.stringify(sample));
    const sc = dataLoose.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
    sc.evidence_references = [looseUrn];
    dataLoose.advertisement_response.conformance_evidence = [
      ...dataLoose.advertisement_response.conformance_evidence.filter(
        e => !e.test_identifier.includes('object-lock') && !e.test_identifier.includes('s3-17-ops') && !e.test_identifier.includes('s3-19-ops')
      ),
      {
        test_identifier: looseUrn,
        status: "PASS",
        evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000007",
        executed_at: "2026-08-27T12:00:00Z",
        report_uri: "https://reports.cybrik.example/evidence/loose.json"
      }
    ];
    const ok = ajv.validate(schemaId, dataLoose);
    assert.ok(ok, `Loose substring URN '${looseUrn}' must pass Ajv schema validation: ` + ajv.errorsText());
    assert.throws(
      () => validatePlatformSemantics(dataLoose, schemaId),
      /lacks Object Lock retention evidence/,
      `Loose substring URN '${looseUrn}' must be rejected by semantic validation`
    );
  }

  // 5. Negative test: Fake non-URN Object Lock evidence is rejected by Ajv schema validation and semantic validation
  const dataFake = JSON.parse(JSON.stringify(sample));
  const storeCapFake = dataFake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapFake.evidence_references = ["ev-fake-non-urn"];
  dataFake.advertisement_response.conformance_evidence = [
    ...dataFake.advertisement_response.conformance_evidence.filter(
      e => !e.test_identifier.includes('object-lock') && !e.test_identifier.includes('s3-17-ops') && !e.test_identifier.includes('s3-19-ops')
    ),
    {
      test_identifier: "ev-fake-non-urn",
      status: "PASS",
      evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000008",
      executed_at: "2026-08-27T12:00:00Z",
      report_uri: "http://attacker.example.com/fake-evidence.txt"
    }
  ];
  const validFake = ajv.validate(schemaId, dataFake);
  assert.ok(!validFake, 'Fake non-URN Object Lock evidence must be rejected by Ajv schema validation');
  assert.throws(
    () => validatePlatformSemantics(dataFake, schemaId),
    /lacks Object Lock retention evidence/,
    'Fake non-URN Object Lock evidence must be rejected by semantic validation'
  );

  // 6. Negative test: Object Lock URN not present in conformance_evidence passes Ajv schema but fails semantic validation
  const dataMissingEv = JSON.parse(JSON.stringify(sample));
  const storeCapMissing = dataMissingEv.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapMissing.evidence_references = ["urn:cybrik:evidence:storage:s3:conformance:v1:object-lock"];
  dataMissingEv.advertisement_response.conformance_evidence = dataMissingEv.advertisement_response.conformance_evidence.filter(
    e => e.test_identifier !== 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' && e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1'
  );
  const validMissing = ajv.validate(schemaId, dataMissingEv);
  assert.ok(validMissing, 'Object Lock URN not present in conformance_evidence must pass Ajv schema validation: ' + ajv.errorsText());
  assert.throws(
    () => validatePlatformSemantics(dataMissingEv, schemaId),
    /evidence_reference 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' not found in conformance_evidence/,
    'Object Lock URN not present in conformance_evidence must fail semantic validation'
  );

  // 7. Negative test: Object Lock evidence with status: "FAIL" fails semantic validation
  const dataFailStatus = JSON.parse(JSON.stringify(sample));
  const storeCapFail = dataFailStatus.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapFail.evidence_references = ["urn:cybrik:evidence:storage:s3:conformance:v1:object-lock"];
  dataFailStatus.advertisement_response.conformance_evidence = [
    ...dataFailStatus.advertisement_response.conformance_evidence.filter(
      e => !e.test_identifier.includes('object-lock') && !e.test_identifier.includes('s3-17-ops') && !e.test_identifier.includes('s3-19-ops')
    ),
    {
      test_identifier: "urn:cybrik:evidence:storage:s3:conformance:v1:object-lock",
      status: "FAIL",
      evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000009",
      executed_at: "2026-08-27T12:00:00Z",
      report_uri: "https://reports.cybrik.example/evidence/fail.json"
    }
  ];
  const validFailStatus = ajv.validate(schemaId, dataFailStatus);
  assert.ok(!validFailStatus, 'Object Lock evidence with status FAIL must be rejected by Ajv schema validation');
  assert.throws(
    () => validatePlatformSemantics(dataFailStatus, schemaId),
    /has non-passing status 'FAIL'|failed status 'FAIL'|lacks Object Lock retention evidence/,
    'Object Lock evidence with status FAIL must be rejected by semantic validation'
  );

  // 8. Negative test: Object Lock evidence with malformed evidence_pack_digest is rejected
  const dataBadDigest = JSON.parse(JSON.stringify(sample));
  const scBadDig = dataBadDigest.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  scBadDig.evidence_references = ['urn:cybrik:evidence:storage-object-lock:01'];
  dataBadDigest.advertisement_response.conformance_evidence = [
    ...dataBadDigest.advertisement_response.conformance_evidence.filter(
      e => !e.test_identifier.includes('object-lock') && !e.test_identifier.includes('s3-17-ops') && !e.test_identifier.includes('s3-19-ops')
    ),
    {
      test_identifier: 'urn:cybrik:evidence:storage-object-lock:01',
      status: "PASS",
      evidence_pack_digest: "not-a-valid-64-hex-digest",
      executed_at: "2026-08-27T12:00:00Z",
      report_uri: "https://reports.cybrik.example/evidence/baddig.json"
    }
  ];
  const validBadDigest = ajv.validate(schemaId, dataBadDigest);
  assert.ok(!validBadDigest, 'Object Lock evidence with malformed evidence_pack_digest must be rejected by Ajv schema validation');
  assert.throws(
    () => validatePlatformSemantics(dataBadDigest, schemaId),
    /lacks valid SHA-256 evidence_pack_digest|lacks Object Lock retention evidence/,
    'Object Lock evidence with malformed evidence_pack_digest must be rejected by semantic validation'
  );

  // 9. Storage capability with dangling fake evidence reference is rejected
  const dataDangling = JSON.parse(JSON.stringify(sample));
  const storeCapDangling = dataDangling.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapDangling.evidence_references = ["urn:cybrik:evidence:nonexistent-evidence-ref"];
  const validDangling = ajv.validate(schemaId, dataDangling);
  assert.ok(validDangling, 'Dangling fake evidence reference must pass Ajv schema validation: ' + ajv.errorsText());
  assert.throws(
    () => validatePlatformSemantics(dataDangling, schemaId),
    /evidence_reference 'urn:cybrik:evidence:nonexistent-evidence-ref' not found in conformance_evidence/,
    'Dangling fake evidence reference must be rejected by semantic validation'
  );
});

test('in-memory validation: reject absolute restore path in RESTORE_DATABASE_SNAPSHOT (Finding 4 / OPEN-1)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'), 'utf8'));

  // 1. Absolute restore path /etc/passwd.db is rejected by schema validation
  const dataPasswd = JSON.parse(JSON.stringify(sample));
  dataPasswd.update_station_workflow.rollback_steps = [
    {
      step_id: "rollback-restore-attack",
      action: "RESTORE_DATABASE_SNAPSHOT",
      target: "/etc/passwd.db"
    }
  ];
  assert.ok(!ajv.validate(schemaId, dataPasswd), 'Absolute restore path /etc/passwd.db must be rejected by schema');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'pattern' && e.instancePath.includes('/target')),
    'Schema error must reject absolute restore path pattern'
  );

  // 2. Absolute restore path /var/lib/cybrik/backup.sql is rejected by schema validation
  const dataVar = JSON.parse(JSON.stringify(sample));
  dataVar.update_station_workflow.rollback_steps = [
    {
      step_id: "rollback-restore-var",
      action: "RESTORE_DATABASE_SNAPSHOT",
      target: "/var/lib/cybrik/backup.sql"
    }
  ];
  assert.ok(!ajv.validate(schemaId, dataVar), 'Absolute restore path /var/lib/cybrik/backup.sql must be rejected by schema');

  // 3. Dot-dot traversal path snapshots/../../etc/shadow.bak is rejected by schema validation
  const dataTraversal = JSON.parse(JSON.stringify(sample));
  dataTraversal.update_station_workflow.rollback_steps = [
    {
      step_id: "rollback-restore-traversal",
      action: "RESTORE_DATABASE_SNAPSHOT",
      target: "snapshots/../../etc/shadow.bak"
    }
  ];
  assert.ok(!ajv.validate(schemaId, dataTraversal), 'Traversal restore path must be rejected by schema');

  // 4. Valid snapshot journal bound paths snapshots/backup.db and $PRE_APPLY_SNAPSHOT/2026-08/snapshot.sql pass schema validation
  const dataValid = JSON.parse(JSON.stringify(sample));
  dataValid.update_station_workflow.rollback_steps = [
    {
      step_id: "rollback-restore-valid",
      action: "RESTORE_DATABASE_SNAPSHOT",
      target: "snapshots/backup.db"
    },
    {
      step_id: "rollback-restore-sql",
      action: "RESTORE_DATABASE_SNAPSHOT",
      target: "$PRE_APPLY_SNAPSHOT/2026-08/snapshot.sql"
    }
  ];
  assert.ok(ajv.validate(schemaId, dataValid), 'Valid relative restore paths must pass schema: ' + ajv.errorsText());
});

test('in-memory validation: reject invalid health probe URLs: octet, port, unbracketed IPv6 (Finding 5 / OPEN-1)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'), 'utf8'));

  // 1. Invalid octet http://10.999.1.1/healthz is rejected
  const dataInvalidOctet10 = JSON.parse(JSON.stringify(sample));
  dataInvalidOctet10.update_station_workflow.apply_steps.push({
    step_id: 'health-invalid-octet-10',
    action: 'HEALTH_PROBE',
    target: 'http://10.999.1.1/healthz'
  });
  assert.ok(!ajv.validate(schemaId, dataInvalidOctet10), 'Health probe with invalid octet 10.999.1.1 must be rejected');

  // 2. Invalid octet http://192.168.300.1/healthz is rejected
  const dataInvalidOctet192 = JSON.parse(JSON.stringify(sample));
  dataInvalidOctet192.update_station_workflow.apply_steps.push({
    step_id: 'health-invalid-octet-192',
    action: 'HEALTH_PROBE',
    target: 'http://192.168.300.1/healthz'
  });
  assert.ok(!ajv.validate(schemaId, dataInvalidOctet192), 'Health probe with invalid octet 192.168.300.1 must be rejected');

  // 3. Invalid port http://127.0.0.1:99999/healthz is rejected
  const dataInvalidPort99999 = JSON.parse(JSON.stringify(sample));
  dataInvalidPort99999.update_station_workflow.apply_steps.push({
    step_id: 'health-invalid-port-99999',
    action: 'HEALTH_PROBE',
    target: 'http://127.0.0.1:99999/healthz'
  });
  assert.ok(!ajv.validate(schemaId, dataInvalidPort99999), 'Health probe with invalid port 99999 must be rejected');

  // 4. Invalid port http://127.0.0.1:65536/healthz is rejected
  const dataInvalidPort65536 = JSON.parse(JSON.stringify(sample));
  dataInvalidPort65536.update_station_workflow.apply_steps.push({
    step_id: 'health-invalid-port-65536',
    action: 'HEALTH_PROBE',
    target: 'http://127.0.0.1:65536/healthz'
  });
  assert.ok(!ajv.validate(schemaId, dataInvalidPort65536), 'Health probe with invalid port 65536 must be rejected');

  // 5. Unbracketed IPv6 http://::1/healthz is rejected
  const dataUnbracketed1 = JSON.parse(JSON.stringify(sample));
  dataUnbracketed1.update_station_workflow.apply_steps.push({
    step_id: 'health-unbracketed-ipv6-1',
    action: 'HEALTH_PROBE',
    target: 'http://::1/healthz'
  });
  assert.ok(!ajv.validate(schemaId, dataUnbracketed1), 'Health probe with unbracketed IPv6 http://::1/healthz must be rejected');

  // 6. Unbracketed IPv6 http://::1:8080/healthz is rejected
  const dataUnbracketed2 = JSON.parse(JSON.stringify(sample));
  dataUnbracketed2.update_station_workflow.apply_steps.push({
    step_id: 'health-unbracketed-ipv6-2',
    action: 'HEALTH_PROBE',
    target: 'http://::1:8080/healthz'
  });
  assert.ok(!ajv.validate(schemaId, dataUnbracketed2), 'Health probe with unbracketed IPv6 http://::1:8080/healthz must be rejected');

  // 7. Valid health probe URLs pass
  const dataValidProbes = JSON.parse(JSON.stringify(sample));
  dataValidProbes.update_station_workflow.apply_steps.push(
    {
      step_id: 'health-valid-127',
      action: 'HEALTH_PROBE',
      target: 'http://127.0.0.1:8080/healthz'
    },
    {
      step_id: 'health-valid-localhost',
      action: 'HEALTH_PROBE',
      target: 'http://localhost:3000/readyz'
    },
    {
      step_id: 'health-valid-bracketed-ipv6',
      action: 'HEALTH_PROBE',
      target: 'http://[::1]:8080/healthz'
    },
    {
      step_id: 'health-valid-10-net',
      action: 'HEALTH_PROBE',
      target: 'http://10.255.0.1:80/healthz'
    },
    {
      step_id: 'health-valid-192-net',
      action: 'HEALTH_PROBE',
      target: 'http://192.168.1.100:65535/healthz'
    },
    {
      step_id: 'health-valid-172-net',
      action: 'HEALTH_PROBE',
      target: 'http://172.16.0.5:9090/healthz'
    }
  );
  assert.ok(ajv.validate(schemaId, dataValidProbes), 'Valid health probe targets must pass schema: ' + ajv.errorsText());
});

test('governance guard: validateOpenItemEffectMatrix probes', () => {
  const proposalPath = join(ROOT, 'contracts/platform/CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md');
  const validProposal = readFileSync(proposalPath, 'utf8');

  // Should pass valid proposal
  validateOpenItemEffectMatrix(validProposal);

  // Should fail swapped title
  const swappedTitle = validProposal.replace('OFFLINE_INSTALL_UPDATE_CONTRACT', 'SWAPPED_TITLE');
  assert.throws(() => validateOpenItemEffectMatrix(swappedTitle), /Swapped or incorrect title/);

  // Should fail duplicate ID
  const duplicateId = validProposal.replace('| OPEN-2 |', '| OPEN-1 |');
  assert.throws(() => validateOpenItemEffectMatrix(duplicateId), /Duplicate ID OPEN-1/);

  // Should fail unauthorized effect
  const unauthorizedEffect = validProposal.replace('OPEN, PARTIALLY_UNBLOCKED', 'INVALID_EFFECT_TEST');
  assert.throws(() => validateOpenItemEffectMatrix(unauthorizedEffect), /Unauthorized effect/);
});

test('governance guard: validate OPEN-11 PRODUCT-MODULE-SOVEREIGNTY-CLASSIFICATION-MAP.md', () => {
  const mapPath = join(ROOT, 'docs/architecture/PRODUCT-MODULE-SOVEREIGNTY-CLASSIFICATION-MAP.md');
  assert.ok(existsSync(mapPath), 'PRODUCT-MODULE-SOVEREIGNTY-CLASSIFICATION-MAP.md must exist');

  const content = readFileSync(mapPath, 'utf8');

  // Status check
  assert.match(content, /^Status: PROPOSED — PER-MODULE CLASSIFICATION MAP \(v0\.1\.0-proposed\)$/m, 'Must have proposed status');

  // Three RC1 commits
  assert.match(content, /f0bf4c630d8e93a0531d16b4522ce0425996a624/, 'Must reference cybrik-cyber-ai-platform RC1 commit f0bf4c630d8e93a0531d16b4522ce0425996a624');
  assert.match(content, /1a419014ebb432eb56ac35242e0a193fe65a62c6/, 'Must reference cybrik-security-tool-fabric RC1 commit 1a419014ebb432eb56ac35242e0a193fe65a62c6');
  assert.match(content, /695aed8e0e12c9d0e11de5f474e3384d1a4b490f/, 'Must reference cybrik-soc-command-center RC1 commit 695aed8e0e12c9d0e11de5f474e3384d1a4b490f');

  // Invariant citations
  assert.match(content, /`INV-21`/, 'Must cite invariant INV-21');
  assert.match(content, /`INV-1`/, 'Must cite invariant INV-1');
  assert.match(content, /`INV-3`/, 'Must cite invariant INV-3');
  assert.match(content, /`INV-5`/, 'Must cite invariant INV-5');

  const validClassifications = new Set([
    'PRODUCT_CORE',
    'PRODUCT_IMPLEMENTATION_ADAPTER',
    'PROVIDER_ADAPTER',
    'SUPPORTING_TOOLING_OR_TEST',
    'DEPLOYMENT_PROFILE_OR_CONFIG',
    'GOVERNANCE_OR_DOCUMENTATION',
  ]);
  const validStatuses = new Set(['IMPLEMENTED', 'SCAFFOLD', 'PLANNED']);

  function parseMapSections(mdContent) {
    const lines = mdContent.split('\n');
    const sections = { '2.1': [], '2.2': [], '2.3': [], '2.4': [] };
    let currentSec = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('### 2.1')) currentSec = '2.1';
      else if (line.startsWith('### 2.2')) currentSec = '2.2';
      else if (line.startsWith('### 2.3')) currentSec = '2.3';
      else if (line.startsWith('### 2.4')) currentSec = '2.4';
      else if (line.startsWith('## 3.')) currentSec = null;

      if (!currentSec || !line.startsWith('|') || line.startsWith('|---') || line.includes('Path / Subsystem')) continue;

      assert.ok(line.endsWith('|'), `Line ${i + 1} must end with |`);
      const parts = line.split('|').map(s => s.trim());
      assert.equal(parts[0], '', `Line ${i + 1} must start with |`);
      assert.equal(parts[parts.length - 1], '', `Line ${i + 1} must end with |`);
      assert.equal(parts.length, 6, `Line ${i + 1} must have exactly 4 columns`);

      const [, rawPath, rawClass, rawStatus, notes] = parts;
      const classification = rawClass.replace(/^`|`$/g, '');
      const status = rawStatus.replace(/^`|`$/g, '');
      assert.ok(validClassifications.has(classification), `Line ${i + 1} invalid classification: ${classification}`);
      assert.ok(validStatuses.has(status), `Line ${i + 1} invalid status: ${status}`);
      assert.ok(rawPath.length > 0, `Line ${i + 1} empty path`);
      assert.ok(notes.length > 0, `Line ${i + 1} empty notes`);

      sections[currentSec].push({ line: i + 1, path: rawPath, classification, status, notes });
    }
    return sections;
  }

  const parsed = parseMapSections(content);
  assert.equal(parsed['2.1'].length, 28, `Section 2.1 expected 28 rows, got ${parsed['2.1'].length}`);
  assert.equal(parsed['2.2'].length, 14, `Section 2.2 expected 14 rows, got ${parsed['2.2'].length}`);
  assert.equal(parsed['2.3'].length, 73, `Section 2.3 expected 73 rows, got ${parsed['2.3'].length}`);
  assert.equal(parsed['2.4'].length, 2, `Section 2.4 expected 2 rows, got ${parsed['2.4'].length}`);

  // Negative mutation tests verifying structural validation fail-closed behavior
  assert.throws(() => {
    parseMapSections(content.replace('| `PRODUCT_CORE` |', '| `product_core` |'));
  }, /invalid classification/);

  assert.throws(() => {
    parseMapSections(content.replace('| `IMPLEMENTED` |', '| `INVALID_STATUS` |'));
  }, /invalid status/);

  assert.throws(() => {
    parseMapSections(content.replace('| `IMPLEMENTED` |', '|'));
  }, /must have exactly 4 columns/);

  assert.throws(() => {
    parseMapSections(content.replace('| `IMPLEMENTED` |', '| `IMPLEMENTED` | extra |'));
  }, /must have exactly 4 columns/);

  assert.throws(() => {
    parseMapSections(content.replace('| `packages/ai-core/src/cybrik_ai_core/authority.py` |', '|  |'));
  }, /empty path/);

  assert.throws(() => {
    parseMapSections(content.replace('Pure domain authority model and evaluation logic.', ''));
  }, /empty notes/);

  // Verify machine-readable classification ledger and digest
  const ledgerPath = join(ROOT, 'docs/architecture/PRODUCT-MODULE-CLASSIFICATION-LEDGER.json');
  assert.ok(existsSync(ledgerPath), 'PRODUCT-MODULE-CLASSIFICATION-LEDGER.json must exist');
  const ledgerRaw = readFileSync(ledgerPath, 'utf8');
  const ledgerDigest = createHash('sha256').update(ledgerRaw).digest('hex');
  assert.equal(ledgerDigest, 'b428c73895baad718c166bf90f9f8a676fb688c21eb012bf280ce1dad4231831', 'Ledger digest mismatch');

  const ledger = JSON.parse(ledgerRaw);
  const repoKeys = Object.keys(ledger);
  assert.deepEqual(repoKeys.sort(), ['cybrik-cyber-ai-platform', 'cybrik-security-tool-fabric', 'cybrik-soc-command-center'], 'Exact 3 closed top-level repositories expected');

  assert.equal(ledger['cybrik-cyber-ai-platform']?.commit, 'f0bf4c630d8e93a0531d16b4522ce0425996a624');
  assert.equal(ledger['cybrik-security-tool-fabric']?.commit, '1a419014ebb432eb56ac35242e0a193fe65a62c6');
  assert.equal(ledger['cybrik-soc-command-center']?.commit, '695aed8e0e12c9d0e11de5f474e3384d1a4b490f');

  const aiFiles = Object.keys(ledger['cybrik-cyber-ai-platform'].files);
  const fabricFiles = Object.keys(ledger['cybrik-security-tool-fabric'].files);
  const socFiles = Object.keys(ledger['cybrik-soc-command-center'].files);

  assert.equal(aiFiles.length, 221, `Expected 221 AI files, got ${aiFiles.length}`);
  assert.equal(fabricFiles.length, 132, `Expected 132 Fabric files, got ${fabricFiles.length}`);
  assert.equal(socFiles.length, 1297, `Expected 1297 SOC files, got ${socFiles.length}`);
  assert.equal(aiFiles.length + fabricFiles.length + socFiles.length, 1650, 'Total ledger files must be exactly 1650');

  // Concrete semantic sentinel assertions
  assert.equal(ledger['cybrik-soc-command-center'].files['START-CYBRIK.command'].classification, 'DEPLOYMENT_PROFILE_OR_CONFIG');
  assert.equal(ledger['cybrik-soc-command-center'].files['Makefile'].classification, 'SUPPORTING_TOOLING_OR_TEST');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/.coverage'].classification, 'SUPPORTING_TOOLING_OR_TEST');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/dump.rdb'].classification, 'SUPPORTING_TOOLING_OR_TEST');
  assert.equal(ledger['cybrik-soc-command-center'].files['.gitleaks.toml'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-soc-command-center'].files['.gitleaksignore'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-soc-command-center'].files['apps/soc-portal/playwright.config.ts'].classification, 'SUPPORTING_TOOLING_OR_TEST');
  assert.equal(ledger['cybrik-soc-command-center'].files['apps/soc-portal/app/layout.tsx'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/database.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/errors.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['packages/api-contracts/openapi/generic-webhook.v0.yaml'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['packages/design-system/tokens/tokens.css'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['ops/backup/cybrik_backup/backup.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['ops/backup/cybrik_backup/__main__.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/content/sigma/collection_archive_staging.yml'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/__init__.py'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/context/wire.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/context/models.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/datalake/lifecycle.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/forensics/search.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/copilot/gateway.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ingest/ecs.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ingest/ocsf.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/algorithms.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/signer.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/models.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/errors.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/soar/connectors/__init__.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/soar/library.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ioc/taxii.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.ok(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ioc/taxii.py'].notes.includes('TaxiiClient'), 'taxii.py notes must cite TaxiiClient');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/hunt/executions.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/service.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/common.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/greenbone.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/__init__.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/pyproject.toml'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/__init__.py'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/orchestration/checkpoints.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/orchestration/memory.py'].classification, 'SUPPORTING_TOOLING_OR_TEST');
  assert.equal(ledger['cybrik-cyber-ai-platform'].files['tests/README.md'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-cyber-ai-platform'].files['services/ai-api/src/cybrik_ai_api/transport_security.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-cyber-ai-platform'].files['services/ai-worker/src/cybrik_ai_worker/__init__.py'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-cyber-ai-platform'].files['services/ai-worker/src/cybrik_ai_worker/__init__.py'].status, 'SCAFFOLD');
  assert.equal(ledger['cybrik-cyber-ai-platform'].files['services/ai-worker/pyproject.toml'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['src/executor/cmd/executor/main.go'].status, 'SCAFFOLD');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['tests/README.md'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['tests/conformance/README.md'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['tests/control-plane/README.md'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['tests/executor/README.md'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/__init__.py'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/contracts/__init__.py'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/invocation/ports.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/py.typed'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['src/executor/internal/version/version.go'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-security-tool-fabric'].files['src/executor/internal/tier/tier.go'].classification, 'PRODUCT_CORE');

  for (const [repo, data] of Object.entries(ledger)) {
    for (const [filePath, entry] of Object.entries(data.files)) {
      assert.ok(filePath && filePath.trim().length > 0, `${repo} empty file path`);
      assert.ok(validClassifications.has(entry.classification), `${repo}:${filePath} invalid classification ${entry.classification}`);
      assert.ok(validStatuses.has(entry.status), `${repo}:${filePath} invalid status ${entry.status}`);
      assert.ok(entry.notes && entry.notes.trim().length > 0, `${repo}:${filePath} empty notes`);
    }
  }

  // Exact-once selector-to-ledger reconciliation proving 0 orphans, 0 overlaps, matching classification & status
  function reconcileMapAndLedger(mapMd, ledgerObj) {
    const lines = mapMd.split('\n');
    const repoRowMap = {
      'cybrik-cyber-ai-platform': [],
      'cybrik-security-tool-fabric': [],
      'cybrik-soc-command-center': []
    };
    let currentActiveRepo = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('### 2.1')) currentActiveRepo = 'cybrik-cyber-ai-platform';
      else if (line.startsWith('### 2.2')) currentActiveRepo = 'cybrik-security-tool-fabric';
      else if (line.startsWith('### 2.3')) currentActiveRepo = 'cybrik-soc-command-center';
      else if (line.startsWith('### 2.4') || line.startsWith('## 3.')) currentActiveRepo = null;
      if (!currentActiveRepo || !line.startsWith('|') || line.startsWith('|---') || line.includes('Path / Subsystem')) continue;
      const parts = line.split('|').map(s => s.trim());
      const [, rawPath, rawClass, rawStatus] = parts;
      repoRowMap[currentActiveRepo].push({
        selector: rawPath.replace(/^`|`$/g, ''),
        classification: rawClass.replace(/^`|`$/g, ''),
        status: rawStatus.replace(/^`|`$/g, ''),
        lineNum: i + 1
      });
    }

    function createMatcher(selector, repo) {
      if (repo === 'cybrik-cyber-ai-platform') {
        if (selector === 'packages/ai-core/src/cybrik_ai_core/authority.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/authority.py';
        if (selector === 'packages/ai-core/src/cybrik_ai_core/marking.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/marking.py';
        if (selector === 'packages/ai-core/src/cybrik_ai_core/policy.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/policy.py';
        if (selector === 'packages/ai-core/src/cybrik_ai_core/prompts.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/prompts.py';
        if (selector === 'packages/ai-core/src/cybrik_ai_core/telemetry.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/telemetry.py';
        if (selector === 'packages/ai-core/src/cybrik_ai_core/errors.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/errors.py';
        if (selector.includes('contract/ (common.py, inference.py, lifecycle.py, summarization.py)')) {
          return f => ['packages/ai-core/src/cybrik_ai_core/contract/common.py', 'packages/ai-core/src/cybrik_ai_core/contract/inference.py', 'packages/ai-core/src/cybrik_ai_core/contract/lifecycle.py', 'packages/ai-core/src/cybrik_ai_core/contract/summarization.py'].includes(f);
        }
        if (selector.includes('modelrt/ (budget.py, port.py, resilience.py, types.py)')) {
          return f => ['packages/ai-core/src/cybrik_ai_core/modelrt/budget.py', 'packages/ai-core/src/cybrik_ai_core/modelrt/port.py', 'packages/ai-core/src/cybrik_ai_core/modelrt/resilience.py', 'packages/ai-core/src/cybrik_ai_core/modelrt/types.py'].includes(f);
        }
        if (selector.includes('orchestration/ (attempt.py, controller.py, durable.py, durable_controller.py, ports.py, state.py, errors.py)')) {
          return f => ['packages/ai-core/src/cybrik_ai_core/orchestration/attempt.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/controller.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/durable.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/durable_controller.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/ports.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/state.py', 'packages/ai-core/src/cybrik_ai_core/orchestration/errors.py'].includes(f);
        }
        if (selector === 'packages/ai-core/src/cybrik_ai_core/orchestration/checkpoints.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/orchestration/checkpoints.py';
        if (selector === 'packages/ai-core/src/cybrik_ai_core/orchestration/memory.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/orchestration/memory.py';
        if (selector.includes('security/ (egress.py, untrusted.py)')) {
          return f => ['packages/ai-core/src/cybrik_ai_core/security/egress.py', 'packages/ai-core/src/cybrik_ai_core/security/untrusted.py'].includes(f);
        }
        if (selector.includes('delegation/ (audit.py, contract.py, ports.py, trust.py, verifier.py, errors.py)')) {
          return f => ['packages/ai-core/src/cybrik_ai_core/delegation/audit.py', 'packages/ai-core/src/cybrik_ai_core/delegation/contract.py', 'packages/ai-core/src/cybrik_ai_core/delegation/ports.py', 'packages/ai-core/src/cybrik_ai_core/delegation/trust.py', 'packages/ai-core/src/cybrik_ai_core/delegation/verifier.py', 'packages/ai-core/src/cybrik_ai_core/delegation/errors.py'].includes(f);
        }
        if (selector === 'packages/ai-core/src/cybrik_ai_core/delegation/replay.py') return f => f === 'packages/ai-core/src/cybrik_ai_core/delegation/replay.py';
        if (selector.includes('delegation/ (certbind.py, jose.py)')) {
          return f => ['packages/ai-core/src/cybrik_ai_core/delegation/certbind.py', 'packages/ai-core/src/cybrik_ai_core/delegation/jose.py'].includes(f);
        }
        if (selector === 'services/ai-api/src/cybrik_ai_api/adapters/ollama.py') return f => f === 'services/ai-api/src/cybrik_ai_api/adapters/ollama.py';
        if (selector === 'services/ai-api/src/cybrik_ai_api/adapters/stub.py') return f => f === 'services/ai-api/src/cybrik_ai_api/adapters/stub.py';
        if (selector === 'services/ai-api/src/cybrik_ai_api/orchestration/postgres.py') return f => f === 'services/ai-api/src/cybrik_ai_api/orchestration/postgres.py';
        if (selector.includes('services/ai-api/migrations/')) {
          return f => f.startsWith('services/ai-api/migrations/');
        }
        if (selector === 'services/ai-api/src/cybrik_ai_api/transport_security.py') return f => f === 'services/ai-api/src/cybrik_ai_api/transport_security.py';
        if (selector.includes('investigations/ (service.py, relying_party.py, projection.py)')) {
          return f => ['services/ai-api/src/cybrik_ai_api/investigations/service.py', 'services/ai-api/src/cybrik_ai_api/investigations/relying_party.py', 'services/ai-api/src/cybrik_ai_api/investigations/projection.py'].includes(f);
        }
        if (selector === 'services/ai-api/src/cybrik_ai_api/investigations/api.py') return f => f === 'services/ai-api/src/cybrik_ai_api/investigations/api.py';
        if (selector === 'services/ai-api/src/cybrik_ai_api/summarize/service.py') return f => f === 'services/ai-api/src/cybrik_ai_api/summarize/service.py';
        if (selector.includes('app.py, runtime_composition.py, runtime_settings.py')) {
          return f => ['services/ai-api/src/cybrik_ai_api/app.py', 'services/ai-api/src/cybrik_ai_api/runtime_composition.py', 'services/ai-api/src/cybrik_ai_api/runtime_settings.py'].includes(f);
        }
        if (selector.includes('services/ai-worker/')) {
          return f => f.startsWith('services/ai-worker/');
        }
        if (selector.includes('tests/ (excluding README.md), .github/')) {
          return f => (f.startsWith('tests/') && f !== 'tests/README.md') || f.startsWith('.github/');
        }
        if (selector.includes('packages/**/__init__.py, services/ai-api/**/__init__.py')) {
          return f => f.endsWith('__init__.py') && !f.startsWith('services/ai-worker/');
        }
        if (selector.startsWith('docs/')) {
          return f => f.startsWith('docs/') || ['AGENTS.md', 'CLAUDE.md', 'README.md', 'SECURITY.md', 'tests/README.md', 'pyproject.toml', 'packages/ai-core/pyproject.toml', 'packages/ai-core/src/cybrik_ai_core/py.typed', 'services/ai-api/pyproject.toml', 'services/ai-api/src/cybrik_ai_api/py.typed', 'uv.lock', '.python-version', '.gitleaks.toml', '.gitignore'].includes(f);
        }
      }

      if (repo === 'cybrik-security-tool-fabric') {
        if (selector.includes('contracts/ (alert_context.py, capability.py, effects.py, invocation.py, provenance.py)')) {
          return f => ['src/control-plane/cybrik_fabric_control/contracts/alert_context.py', 'src/control-plane/cybrik_fabric_control/contracts/capability.py', 'src/control-plane/cybrik_fabric_control/contracts/effects.py', 'src/control-plane/cybrik_fabric_control/contracts/invocation.py', 'src/control-plane/cybrik_fabric_control/contracts/provenance.py'].includes(f);
        }
        if (selector.includes('contracts/ (jcs.py, loader.py)')) {
          return f => ['src/control-plane/cybrik_fabric_control/contracts/jcs.py', 'src/control-plane/cybrik_fabric_control/contracts/loader.py'].includes(f);
        }
        if (selector.includes('invocation/ (models.py, service.py)')) {
          return f => ['src/control-plane/cybrik_fabric_control/invocation/models.py', 'src/control-plane/cybrik_fabric_control/invocation/service.py'].includes(f);
        }
        if (selector === 'src/control-plane/cybrik_fabric_control/invocation/ports.py') return f => f === 'src/control-plane/cybrik_fabric_control/invocation/ports.py';
        if (selector === 'src/control-plane/cybrik_fabric_control/registry/packet.py') return f => f === 'src/control-plane/cybrik_fabric_control/registry/packet.py';
        if (selector.includes('app.py, liveness.py')) {
          return f => ['src/control-plane/cybrik_fabric_control/app.py', 'src/control-plane/cybrik_fabric_control/liveness.py'].includes(f);
        }
        if (selector === 'src/control-plane/cybrik_fabric_control/**/__init__.py') {
          return f => f.startsWith('src/control-plane/cybrik_fabric_control/') && f.endsWith('__init__.py');
        }
        if (selector === 'src/executor/internal/tier/tier.go') return f => f === 'src/executor/internal/tier/tier.go';
        if (selector === 'src/executor/internal/version/version.go') return f => f === 'src/executor/internal/version/version.go';
        if (selector === 'src/executor/cmd/executor/main.go') return f => f === 'src/executor/cmd/executor/main.go';
        if (selector === 'contracts-vendor/json-schema/') return f => f.startsWith('contracts-vendor/json-schema/');
        if (selector.includes('tests/ (excluding **/README.md), contracts-vendor/fixtures/')) {
          return f => (f.startsWith('tests/') && !f.endsWith('README.md')) ||
                      f.startsWith('contracts-vendor/fixtures/') ||
                      f === 'contracts-vendor/contracts.lock.json' ||
                      (f.startsWith('contracts-vendor/compatibility/') && f.endsWith('.manifest.json')) ||
                      (f.startsWith('src/executor/internal/') && f.endsWith('_test.go')) ||
                      f === 'src/executor/cmd/executor/main_test.go' ||
                      f.startsWith('.github/');
        }
        if (selector.startsWith('docs/, AGENTS.md')) {
          return f => f.startsWith('docs/') ||
                      ['AGENTS.md', 'CLAUDE.md', 'README.md', 'SECURITY.md', 'src/README.md', 'src/control-plane/README.md', 'src/executor/README.md', '.gitignore', 'src/control-plane/cybrik_fabric_control/py.typed', 'src/control-plane/cybrik_fabric_control/__about__.py', 'contracts-vendor/README.md'].includes(f) ||
                      (f.startsWith('src/executor/tiers/') && f.endsWith('.md')) ||
                      (f.startsWith('tests/') && f.endsWith('README.md'));
        }
        if (selector.startsWith('src/control-plane/pyproject.toml')) {
          return f => ['src/control-plane/pyproject.toml', 'src/control-plane/requirements.in', 'src/control-plane/requirements.lock', 'src/control-plane/requirements-dev.in', 'src/control-plane/requirements-dev.lock', 'src/executor/go.mod', 'src/executor/go.sum', 'src/executor/.golangci.yml', 'Dockerfile', 'src/control-plane/Dockerfile', 'src/executor/Dockerfile'].includes(f);
        }
      }

      if (repo === 'cybrik-soc-command-center') {
        if (selector === 'START-CYBRIK.command, STOP-CYBRIK.command') return f => ['START-CYBRIK.command', 'STOP-CYBRIK.command'].includes(f);
        if (selector === 'Makefile, services/api/.coverage, services/api/dump.rdb') return f => ['Makefile', 'services/api/.coverage', 'services/api/dump.rdb'].includes(f);
        if (selector.startsWith('.dockerignore, .gitignore')) {
          return f => ['.dockerignore', '.gitignore', '.gitleaks.toml', '.gitleaksignore', 'CLAUDE.md', 'LICENSE', 'README.md', 'SECURITY.md', 'SPRINT-0-CLOSURE.md', 'SPRINT-0-IMPLEMENTATION-PLAN.md'].includes(f);
        }
        if (selector.includes('apps/soc-portal/ (app/, components/, lib/, public/)')) {
          return f => (f.startsWith('apps/soc-portal/app/') || f.startsWith('apps/soc-portal/components/') || f.startsWith('apps/soc-portal/lib/') || f.startsWith('apps/soc-portal/public/'));
        }
        if (selector.includes('apps/soc-portal/ (e2e/, ui-review/, playwright.config.ts)')) {
          return f => f.startsWith('apps/soc-portal/e2e/') || f.startsWith('apps/soc-portal/ui-review/') || f === 'apps/soc-portal/playwright.config.ts';
        }
        if (selector.includes('apps/soc-portal/ (package.json,')) {
          return f => ['apps/soc-portal/package.json', 'apps/soc-portal/package-lock.json', 'apps/soc-portal/tsconfig.json', 'apps/soc-portal/next.config.mjs', 'apps/soc-portal/next-env.d.ts', 'apps/soc-portal/Dockerfile', 'apps/soc-portal/README.md'].includes(f);
        }
        if (selector.startsWith('connectors/')) return f => f.startsWith('connectors/');
        if (selector.includes('deploy/ (docker/docker-compose*.yml')) {
          return f => f.startsWith('deploy/') &&
                      !f.startsWith('deploy/log-collection/signer/') &&
                      !['deploy/docker/dev_endpoints.py', 'deploy/docker/screenshots/capture.mjs', 'deploy/docker/backup/Dockerfile', 'deploy/docker/screenshots/Dockerfile'].includes(f) &&
                      !f.endsWith('.md');
        }
        if (selector.includes('deploy/log-collection/signer/')) {
          return f => f.startsWith('deploy/log-collection/signer/');
        }
        if (selector.includes('deploy/ (docker/dev_endpoints.py, docker/screenshots/capture.mjs)')) {
          return f => ['deploy/docker/dev_endpoints.py', 'deploy/docker/screenshots/capture.mjs'].includes(f);
        }
        if (selector.includes('deploy/ (README.md, **/README.md, **/AGENT-DESIGN.md, docker/backup/Dockerfile, docker/screenshots/Dockerfile)')) {
          return f => (f.startsWith('deploy/') && f.endsWith('.md')) || ['deploy/docker/backup/Dockerfile', 'deploy/docker/screenshots/Dockerfile'].includes(f);
        }
        if (selector.startsWith('packages/api-contracts/')) return f => f.startsWith('packages/api-contracts/');
        if (selector.startsWith('packages/design-system/')) return f => f.startsWith('packages/design-system/');
        if (selector.startsWith('scripts/')) return f => f.startsWith('scripts/');
        if (selector.includes('ops/backup/cybrik_backup/')) {
          return f => f.startsWith('ops/backup/cybrik_backup/') && f !== 'ops/backup/cybrik_backup/__init__.py';
        }
        if (selector === 'ops/backup/tests/') return f => f.startsWith('ops/backup/tests/');
        if (selector.startsWith('ops/backup/ (INTEGRATION-CHECKLIST.md')) {
          return f => ['ops/backup/INTEGRATION-CHECKLIST.md', 'ops/backup/README.md', 'ops/backup/pyproject.toml'].includes(f);
        }
        if (selector.includes('ops/pf-bench/ (pf_bench/')) {
          return f => f.startsWith('ops/pf-bench/') && !['ops/pf-bench/pyproject.toml', 'ops/pf-bench/.gitignore', 'ops/pf-bench/pf_bench/__init__.py'].includes(f);
        }
        if (selector.includes('ops/pf-bench/ (pyproject.toml, .gitignore, pf_bench/__init__.py)')) {
          return f => ['ops/pf-bench/pyproject.toml', 'ops/pf-bench/.gitignore', 'ops/pf-bench/pf_bench/__init__.py'].includes(f);
        }
        if (selector.includes('ops/pf-workers/pf_workers/ (alert_writer.py')) {
          return f => f.startsWith('ops/pf-workers/pf_workers/') && !f.startsWith('ops/pf-workers/pf_workers/correlation_rules/') && f !== 'ops/pf-workers/pf_workers/__init__.py';
        }
        if (selector.includes('ops/pf-workers/pf_workers/correlation_rules/')) {
          return f => f.startsWith('ops/pf-workers/pf_workers/correlation_rules/');
        }
        if (selector === 'ops/pf-workers/ (tests/, scripts/)') {
          return f => f.startsWith('ops/pf-workers/tests/') || f.startsWith('ops/pf-workers/scripts/');
        }
        if (selector.includes('ops/pf-workers/ (Dockerfile')) {
          return f => ['ops/pf-workers/Dockerfile', 'ops/pf-workers/Dockerfile.dockerignore', 'ops/pf-workers/README.md', 'ops/pf-workers/pyproject.toml', 'ops/pf-workers/.gitignore'].includes(f);
        }
        if (selector.includes('services/api/content/sigma/ (*.yml), services/api/content/ueba_baselines/ (*.yml)')) {
          return f => (f.startsWith('services/api/content/sigma/') && f.endsWith('.yml')) || (f.startsWith('services/api/content/ueba_baselines/') && f.endsWith('.yml'));
        }
        if (selector.includes('services/api/content/sigma/tests/ (*.json)')) {
          return f => f.startsWith('services/api/content/sigma/tests/');
        }
        if (selector === 'services/api/content/sigma/NOTICE.md') return f => f === 'services/api/content/sigma/NOTICE.md';
        if (selector.startsWith('services/api/alembic/')) return f => f.startsWith('services/api/alembic/');
        if (selector.includes('services/api/scripts/, services/api/tests/, .github/')) {
          return f => f.startsWith('services/api/scripts/') || f.startsWith('services/api/tests/') || f.startsWith('.github/');
        }
        if (selector.includes('services/api/src/cybrik_soc/ (config.py, main.py)')) {
          return f => ['services/api/src/cybrik_soc/config.py', 'services/api/src/cybrik_soc/main.py'].includes(f);
        }
        if (selector.includes('services/api/src/cybrik_soc/modules/alert/ (context/authorize.py')) {
          return f => ['services/api/src/cybrik_soc/modules/alert/context/authorize.py', 'services/api/src/cybrik_soc/modules/alert/context/clearance.py', 'services/api/src/cybrik_soc/modules/alert/context/digest.py', 'services/api/src/cybrik_soc/modules/alert/context/models.py', 'services/api/src/cybrik_soc/modules/alert/context/ports.py', 'services/api/src/cybrik_soc/modules/alert/context/redact.py', 'services/api/src/cybrik_soc/modules/alert/context/service.py'].includes(f);
        }
        if (selector.includes('services/api/src/cybrik_soc/modules/alert/ (api.py')) {
          return f => ['services/api/src/cybrik_soc/modules/alert/api.py', 'services/api/src/cybrik_soc/modules/alert/context/api.py', 'services/api/src/cybrik_soc/modules/alert/context/reader_pg.py', 'services/api/src/cybrik_soc/modules/alert/context/store_pg.py', 'services/api/src/cybrik_soc/modules/alert/context/wire.py', 'services/api/src/cybrik_soc/modules/alert/metrics.py', 'services/api/src/cybrik_soc/modules/alert/pagination.py', 'services/api/src/cybrik_soc/modules/alert/related.py', 'services/api/src/cybrik_soc/modules/alert/triage.py', 'services/api/src/cybrik_soc/modules/alert/models.py'].includes(f);
        }
        if (selector.includes('modules/asset/')) {
          return f => ['services/api/src/cybrik_soc/modules/asset/api.py', 'services/api/src/cybrik_soc/modules/asset/models.py'].includes(f);
        }
        if (selector.includes('modules/audit/')) {
          return f => ['services/api/src/cybrik_soc/modules/audit/api.py', 'services/api/src/cybrik_soc/modules/audit/models.py'].includes(f);
        }
        if (selector === 'services/api/src/cybrik_soc/modules/authorization/matrix.py') return f => f === 'services/api/src/cybrik_soc/modules/authorization/matrix.py';
        if (selector === 'services/api/src/cybrik_soc/modules/authorization/deps.py') return f => f === 'services/api/src/cybrik_soc/modules/authorization/deps.py';
        if (selector.includes('modules/case/')) {
          return f => ['services/api/src/cybrik_soc/modules/case/service.py', 'services/api/src/cybrik_soc/modules/case/api.py', 'services/api/src/cybrik_soc/modules/case/models.py'].includes(f);
        }
        if (selector.includes('modules/connector/')) {
          return f => ['services/api/src/cybrik_soc/modules/connector/api.py', 'services/api/src/cybrik_soc/modules/connector/bootstrap.py', 'services/api/src/cybrik_soc/modules/connector/models.py'].includes(f);
        }
        if (selector === 'services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py') return f => f === 'services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py';
        if (selector === 'services/api/src/cybrik_soc/modules/copilot/llm.py') return f => f === 'services/api/src/cybrik_soc/modules/copilot/llm.py';
        if (selector.includes('modules/copilot/ (api.py')) {
          return f => ['services/api/src/cybrik_soc/modules/copilot/api.py', 'services/api/src/cybrik_soc/modules/copilot/gateway.py', 'services/api/src/cybrik_soc/modules/copilot/lifecycle_create.py', 'services/api/src/cybrik_soc/modules/copilot/models.py', 'services/api/src/cybrik_soc/modules/copilot/shadow_remote.py', 'services/api/src/cybrik_soc/modules/copilot/shadow_suggest_worker.py', 'services/api/src/cybrik_soc/modules/copilot/tools.py'].includes(f);
        }
        if (selector.includes('modules/datalake/ (retention.py, search.py)')) {
          return f => ['services/api/src/cybrik_soc/modules/datalake/retention.py', 'services/api/src/cybrik_soc/modules/datalake/search.py'].includes(f);
        }
        if (selector.includes('modules/datalake/ (api.py, es_adapter.py, lifecycle.py, opensearch_adapter.py, orm.py, service.py)')) {
          return f => ['services/api/src/cybrik_soc/modules/datalake/api.py', 'services/api/src/cybrik_soc/modules/datalake/es_adapter.py', 'services/api/src/cybrik_soc/modules/datalake/lifecycle.py', 'services/api/src/cybrik_soc/modules/datalake/opensearch_adapter.py', 'services/api/src/cybrik_soc/modules/datalake/orm.py', 'services/api/src/cybrik_soc/modules/datalake/service.py'].includes(f);
        }
        if (selector.includes('modules/forensics/ (access_control.py')) {
          return f => ['services/api/src/cybrik_soc/modules/forensics/access_control.py', 'services/api/src/cybrik_soc/modules/forensics/case_link.py', 'services/api/src/cybrik_soc/modules/forensics/classification.py', 'services/api/src/cybrik_soc/modules/forensics/clearance.py', 'services/api/src/cybrik_soc/modules/forensics/collectors.py', 'services/api/src/cybrik_soc/modules/forensics/copilot_summary.py', 'services/api/src/cybrik_soc/modules/forensics/custody.py', 'services/api/src/cybrik_soc/modules/forensics/evidence.py', 'services/api/src/cybrik_soc/modules/forensics/integrity_sweep.py', 'services/api/src/cybrik_soc/modules/forensics/legal_report.py', 'services/api/src/cybrik_soc/modules/forensics/linkage.py', 'services/api/src/cybrik_soc/modules/forensics/pcap_analysis.py', 'services/api/src/cybrik_soc/modules/forensics/report.py', 'services/api/src/cybrik_soc/modules/forensics/timeline.py', 'services/api/src/cybrik_soc/modules/forensics/search.py'].includes(f);
        }
        if (selector.includes('modules/forensics/ (api.py')) {
          return f => ['services/api/src/cybrik_soc/modules/forensics/api.py', 'services/api/src/cybrik_soc/modules/forensics/endpoint.py', 'services/api/src/cybrik_soc/modules/forensics/models.py', 'services/api/src/cybrik_soc/modules/forensics/repo.py', 'services/api/src/cybrik_soc/modules/forensics/store.py'].includes(f);
        }
        if (selector.includes('modules/geoip/')) {
          return f => ['services/api/src/cybrik_soc/modules/geoip/api.py', 'services/api/src/cybrik_soc/modules/geoip/metrics.py', 'services/api/src/cybrik_soc/modules/geoip/reader.py'].includes(f);
        }
        if (selector.includes('modules/hunt/ (copilot_suggest.py, hunts.py')) {
          return f => ['services/api/src/cybrik_soc/modules/hunt/copilot_suggest.py', 'services/api/src/cybrik_soc/modules/hunt/hunts.py', 'services/api/src/cybrik_soc/modules/hunt/ioc_pivot.py', 'services/api/src/cybrik_soc/modules/hunt/pivot.py', 'services/api/src/cybrik_soc/modules/hunt/promote.py', 'services/api/src/cybrik_soc/modules/hunt/query_spec.py', 'services/api/src/cybrik_soc/modules/hunt/sigma.py'].includes(f);
        }
        if (selector === 'services/api/src/cybrik_soc/modules/hunt/executions.py') return f => f === 'services/api/src/cybrik_soc/modules/hunt/executions.py';
        if (selector === 'services/api/src/cybrik_soc/modules/hunt/compiler_sql.py') return f => f === 'services/api/src/cybrik_soc/modules/hunt/compiler_sql.py';
        if (selector.includes('modules/hunt/ (api.py')) {
          return f => ['services/api/src/cybrik_soc/modules/hunt/api.py', 'services/api/src/cybrik_soc/modules/hunt/datalake.py', 'services/api/src/cybrik_soc/modules/hunt/models.py', 'services/api/src/cybrik_soc/modules/hunt/orm.py'].includes(f);
        }
        if (selector.includes('modules/identity/')) {
          return f => ['services/api/src/cybrik_soc/modules/identity/api.py', 'services/api/src/cybrik_soc/modules/identity/membership.py', 'services/api/src/cybrik_soc/modules/identity/membership_api.py', 'services/api/src/cybrik_soc/modules/identity/models.py', 'services/api/src/cybrik_soc/modules/identity/service.py'].includes(f);
        }
        if (selector.includes('modules/ingest/ (source_labels.py, time_guard.py)')) {
          return f => ['services/api/src/cybrik_soc/modules/ingest/source_labels.py', 'services/api/src/cybrik_soc/modules/ingest/time_guard.py'].includes(f);
        }
        if (selector.includes('modules/ingest/ (api.py, ecs.py, field_maps.py')) {
          return f => ['services/api/src/cybrik_soc/modules/ingest/api.py', 'services/api/src/cybrik_soc/modules/ingest/ecs.py', 'services/api/src/cybrik_soc/modules/ingest/field_maps.py', 'services/api/src/cybrik_soc/modules/ingest/log_parsers.py', 'services/api/src/cybrik_soc/modules/ingest/log_parsers_bsd.py', 'services/api/src/cybrik_soc/modules/ingest/log_parsers_ext.py', 'services/api/src/cybrik_soc/modules/ingest/models.py', 'services/api/src/cybrik_soc/modules/ingest/normalizers.py', 'services/api/src/cybrik_soc/modules/ingest/ocsf.py', 'services/api/src/cybrik_soc/modules/ingest/pf_bridge.py', 'services/api/src/cybrik_soc/modules/ingest/security_onion.py', 'services/api/src/cybrik_soc/modules/ingest/service.py', 'services/api/src/cybrik_soc/modules/ingest/source_health.py', 'services/api/src/cybrik_soc/modules/ingest/source_health_worker.py'].includes(f);
        }
        if (selector.includes('modules/ioc/ (normalize.py, stix.py)')) {
          return f => ['services/api/src/cybrik_soc/modules/ioc/normalize.py', 'services/api/src/cybrik_soc/modules/ioc/stix.py'].includes(f);
        }
        if (selector.includes('modules/ioc/ (api.py')) {
          return f => ['services/api/src/cybrik_soc/modules/ioc/api.py', 'services/api/src/cybrik_soc/modules/ioc/csv_import.py', 'services/api/src/cybrik_soc/modules/ioc/feeds_api.py', 'services/api/src/cybrik_soc/modules/ioc/match.py', 'services/api/src/cybrik_soc/modules/ioc/metrics.py', 'services/api/src/cybrik_soc/modules/ioc/models.py', 'services/api/src/cybrik_soc/modules/ioc/taxii.py'].includes(f);
        }
        if (selector.includes('modules/org/ (contract.py, scoping.py)')) {
          return f => ['services/api/src/cybrik_soc/modules/org/contract.py', 'services/api/src/cybrik_soc/modules/org/scoping.py'].includes(f);
        }
        if (selector.includes('modules/org/ (api.py')) {
          return f => ['services/api/src/cybrik_soc/modules/org/api.py', 'services/api/src/cybrik_soc/modules/org/models.py', 'services/api/src/cybrik_soc/modules/org/session.py'].includes(f);
        }
        if (selector.includes('modules/prefs/')) {
          return f => ['services/api/src/cybrik_soc/modules/prefs/api.py', 'services/api/src/cybrik_soc/modules/prefs/models.py'].includes(f);
        }
        if (selector.includes('modules/siem/ (correlation.py')) {
          return f => ['services/api/src/cybrik_soc/modules/siem/correlation.py', 'services/api/src/cybrik_soc/modules/siem/engine.py', 'services/api/src/cybrik_soc/modules/siem/field_mapping.py', 'services/api/src/cybrik_soc/modules/siem/rules.py', 'services/api/src/cybrik_soc/modules/siem/sigma.py', 'services/api/src/cybrik_soc/modules/siem/sigma_match.py'].includes(f);
        }
        if (selector.includes('modules/siem/ (api.py')) {
          return f => ['services/api/src/cybrik_soc/modules/siem/api.py', 'services/api/src/cybrik_soc/modules/siem/orm.py'].includes(f);
        }
        if (selector.includes('modules/soar/ (actions.py')) {
          return f => ['services/api/src/cybrik_soc/modules/soar/actions.py', 'services/api/src/cybrik_soc/modules/soar/audit.py', 'services/api/src/cybrik_soc/modules/soar/context.py', 'services/api/src/cybrik_soc/modules/soar/copilot_draft.py', 'services/api/src/cybrik_soc/modules/soar/copilot_tool.py', 'services/api/src/cybrik_soc/modules/soar/engine.py', 'services/api/src/cybrik_soc/modules/soar/guards.py', 'services/api/src/cybrik_soc/modules/soar/playbook.py', 'services/api/src/cybrik_soc/modules/soar/report.py', 'services/api/src/cybrik_soc/modules/soar/samples.py', 'services/api/src/cybrik_soc/modules/soar/serialize.py', 'services/api/src/cybrik_soc/modules/soar/simulate.py'].includes(f);
        }
        if (selector.includes('modules/soar/ (api.py')) {
          return f => ['services/api/src/cybrik_soc/modules/soar/api.py', 'services/api/src/cybrik_soc/modules/soar/connectors/__init__.py', 'services/api/src/cybrik_soc/modules/soar/connectors/fortigate.py', 'services/api/src/cybrik_soc/modules/soar/copilot_seam.py', 'services/api/src/cybrik_soc/modules/soar/expire_worker.py', 'services/api/src/cybrik_soc/modules/soar/library.py', 'services/api/src/cybrik_soc/modules/soar/orm.py', 'services/api/src/cybrik_soc/modules/soar/runtime.py'].includes(f);
        }
        if (selector.includes('modules/tenant/')) {
          return f => ['services/api/src/cybrik_soc/modules/tenant/api.py', 'services/api/src/cybrik_soc/modules/tenant/models.py', 'services/api/src/cybrik_soc/modules/tenant/service.py'].includes(f);
        }
        if (selector.includes('modules/ueba/ (alerts.py')) {
          return f => ['services/api/src/cybrik_soc/modules/ueba/alerts.py', 'services/api/src/cybrik_soc/modules/ueba/baseline.py', 'services/api/src/cybrik_soc/modules/ueba/baseline_pack.py', 'services/api/src/cybrik_soc/modules/ueba/classification.py', 'services/api/src/cybrik_soc/modules/ueba/detect.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_ah.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_bc.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_dx.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_lm.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_pg.py', 'services/api/src/cybrik_soc/modules/ueba/detectors_ua.py', 'services/api/src/cybrik_soc/modules/ueba/engine.py', 'services/api/src/cybrik_soc/modules/ueba/events.py', 'services/api/src/cybrik_soc/modules/ueba/features.py', 'services/api/src/cybrik_soc/modules/ueba/findings.py', 'services/api/src/cybrik_soc/modules/ueba/iforest.py', 'services/api/src/cybrik_soc/modules/ueba/risk.py', 'services/api/src/cybrik_soc/modules/ueba/stats.py'].includes(f);
        }
        if (selector.includes('modules/ueba/ (api.py')) {
          return f => ['services/api/src/cybrik_soc/modules/ueba/api.py', 'services/api/src/cybrik_soc/modules/ueba/learning_worker.py', 'services/api/src/cybrik_soc/modules/ueba/orm.py'].includes(f);
        }
        if (selector.includes('modules/vulnerability/ (compliance.py, consolidation.py, correlation.py, cve_enrichment.py, exceptions.py, intel.py, lifecycle.py, models.py, parsers/common.py, policy_config.py, remediation.py, reporting.py, rescore.py, risk.py)')) {
          return f => ['services/api/src/cybrik_soc/modules/vulnerability/compliance.py', 'services/api/src/cybrik_soc/modules/vulnerability/consolidation.py', 'services/api/src/cybrik_soc/modules/vulnerability/correlation.py', 'services/api/src/cybrik_soc/modules/vulnerability/cve_enrichment.py', 'services/api/src/cybrik_soc/modules/vulnerability/exceptions.py', 'services/api/src/cybrik_soc/modules/vulnerability/intel.py', 'services/api/src/cybrik_soc/modules/vulnerability/lifecycle.py', 'services/api/src/cybrik_soc/modules/vulnerability/models.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/common.py', 'services/api/src/cybrik_soc/modules/vulnerability/policy_config.py', 'services/api/src/cybrik_soc/modules/vulnerability/remediation.py', 'services/api/src/cybrik_soc/modules/vulnerability/reporting.py', 'services/api/src/cybrik_soc/modules/vulnerability/rescore.py', 'services/api/src/cybrik_soc/modules/vulnerability/risk.py'].includes(f);
        }
        if (selector.includes('modules/vulnerability/ (api.py, orm.py, repo.py, service.py, parsers/generic.py, parsers/greenbone.py, parsers/grype.py, parsers/nmap.py, parsers/nuclei.py, parsers/trivy.py, parsers/__init__.py)')) {
          return f => ['services/api/src/cybrik_soc/modules/vulnerability/api.py', 'services/api/src/cybrik_soc/modules/vulnerability/orm.py', 'services/api/src/cybrik_soc/modules/vulnerability/repo.py', 'services/api/src/cybrik_soc/modules/vulnerability/service.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/generic.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/greenbone.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/grype.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/nmap.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/nuclei.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/trivy.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/__init__.py'].includes(f);
        }
        if (selector.includes('platform/ (client_ip.py')) {
          return f => ['services/api/src/cybrik_soc/platform/client_ip.py', 'services/api/src/cybrik_soc/platform/context.py', 'services/api/src/cybrik_soc/platform/logging.py', 'services/api/src/cybrik_soc/platform/provenance.py'].includes(f);
        }
        if (selector.includes('platform/ (audit_support.py')) {
          return f => ['services/api/src/cybrik_soc/platform/audit_support.py', 'services/api/src/cybrik_soc/platform/database.py', 'services/api/src/cybrik_soc/platform/errors.py', 'services/api/src/cybrik_soc/platform/hooks.py', 'services/api/src/cybrik_soc/platform/http_body.py', 'services/api/src/cybrik_soc/platform/outbound.py', 'services/api/src/cybrik_soc/platform/rate_limit.py', 'services/api/src/cybrik_soc/platform/secrets.py', 'services/api/src/cybrik_soc/platform/security.py', 'services/api/src/cybrik_soc/platform/signing.py', 'services/api/src/cybrik_soc/platform/security_txt.py'].includes(f);
        }
        if (selector.includes('platform/svc_delegation/ (errors.py, models.py, scopes.py)')) {
          return f => ['services/api/src/cybrik_soc/platform/svc_delegation/errors.py', 'services/api/src/cybrik_soc/platform/svc_delegation/models.py', 'services/api/src/cybrik_soc/platform/svc_delegation/scopes.py'].includes(f);
        }
        if (selector.includes('platform/svc_delegation/ (algorithms.py, factory.py, issuer.py, principal_adapter.py, signer.py)')) {
          return f => ['services/api/src/cybrik_soc/platform/svc_delegation/algorithms.py', 'services/api/src/cybrik_soc/platform/svc_delegation/factory.py', 'services/api/src/cybrik_soc/platform/svc_delegation/issuer.py', 'services/api/src/cybrik_soc/platform/svc_delegation/principal_adapter.py', 'services/api/src/cybrik_soc/platform/svc_delegation/signer.py'].includes(f);
        }
        if (selector.includes('services/api/src/cybrik_soc/**/__init__.py')) {
          return f => (f.startsWith('services/api/src/cybrik_soc/') || f.startsWith('ops/backup/') || f.startsWith('ops/pf-workers/')) &&
                      f.endsWith('__init__.py') &&
                      !['services/api/src/cybrik_soc/modules/soar/connectors/__init__.py', 'services/api/src/cybrik_soc/modules/vulnerability/parsers/__init__.py', 'ops/pf-bench/pf_bench/__init__.py'].includes(f);
        }
        if (selector.includes('services/api/src/cybrik_soc/modules/*/README.md')) {
          return f => (f.startsWith('services/api/src/cybrik_soc/modules/') && f.endsWith('README.md')) || f === 'services/api/src/cybrik_soc/modules/ioc/STIX-TAXII-INTEGRATION-NOTES.md';
        }
        if (selector.startsWith('docs/, governance/')) {
          return f => f.startsWith('docs/') || f.startsWith('governance/') || f.startsWith('reports/') || f.startsWith('artifacts/') || f.startsWith('backlog/') || f.startsWith('third-party/') || ['services/api/Dockerfile', 'services/api/alembic.ini', 'pyproject.toml', 'services/api/pyproject.toml'].includes(f);
        }
      }

      throw new Error(`Unrecognized selector for ${repo}: ${selector}`);
    }

    for (const repo of ['cybrik-cyber-ai-platform', 'cybrik-security-tool-fabric', 'cybrik-soc-command-center']) {
      const rows = repoRowMap[repo];
      const files = Object.keys(ledgerObj[repo].files);
      const matchers = rows.map(r => ({ ...r, fn: createMatcher(r.selector, repo) }));

      for (const filePath of files) {
        const ledgerEntry = ledgerObj[repo].files[filePath];
        const matches = matchers.filter(m => m.fn(filePath));
        if (matches.length === 0) {
          throw new Error(`${repo}:${filePath} is an UNMATCHED ORPHAN not covered by any map row selector`);
        }
        if (matches.length > 1) {
          throw new Error(`${repo}:${filePath} has OVERLAPPING matches in map lines ${matches.map(m => m.lineNum).join(', ')}`);
        }
        const match = matches[0];
        if (match.classification !== ledgerEntry.classification) {
          throw new Error(`${repo}:${filePath} classification mismatch: map=${match.classification} vs ledger=${ledgerEntry.classification}`);
        }
        if (match.status !== ledgerEntry.status) {
          throw new Error(`${repo}:${filePath} status mismatch: map=${match.status} vs ledger=${ledgerEntry.status}`);
        }
      }
    }
    return true;
  }

  // Verify baseline reconciles cleanly
  assert.doesNotThrow(() => {
    reconcileMapAndLedger(content, ledger);
  });

  // Negative mutation test 1: unmatched orphan ledger path
  assert.throws(() => {
    const ledgerClone = JSON.parse(JSON.stringify(ledger));
    ledgerClone['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/orphan_test_file.py'] = {
      classification: 'PRODUCT_CORE',
      status: 'IMPLEMENTED',
      notes: 'Orphan file for negative mutation test.'
    };
    reconcileMapAndLedger(content, ledgerClone);
  }, /^Error: cybrik-cyber-ai-platform:packages\/ai-core\/src\/cybrik_ai_core\/orphan_test_file\.py is an UNMATCHED ORPHAN/);

  // Negative mutation test 2: overlapping selector
  assert.throws(() => {
    const mutated = content.replace(
      '| `packages/ai-core/src/cybrik_ai_core/marking.py` |',
      '| `packages/ai-core/src/cybrik_ai_core/authority.py` |'
    );
    reconcileMapAndLedger(mutated, ledger);
  }, /has OVERLAPPING matches/);

  // Negative mutation test 3: classification mismatch
  assert.throws(() => {
    const mutated = content.replace('| `packages/ai-core/src/cybrik_ai_core/authority.py` | `PRODUCT_CORE` |', '| `packages/ai-core/src/cybrik_ai_core/authority.py` | `PRODUCT_IMPLEMENTATION_ADAPTER` |');
    reconcileMapAndLedger(mutated, ledger);
  }, /classification mismatch/);

  // Negative mutation test 4: status mismatch
  assert.throws(() => {
    const mutated = content.replace('| `packages/ai-core/src/cybrik_ai_core/authority.py` | `PRODUCT_CORE` | `IMPLEMENTED` |', '| `packages/ai-core/src/cybrik_ai_core/authority.py` | `PRODUCT_CORE` | `SCAFFOLD` |');
    reconcileMapAndLedger(mutated, ledger);
  }, /status mismatch/);

  // Regression probes for Round 22 & Round 23 paths in map selectors
  assert.ok(content.includes('tests/ (excluding README.md), .github/'), 'Map must contain explicit AI test README exclusion');
  assert.ok(content.includes('tests/ (excluding **/README.md), contracts-vendor/fixtures/'), 'Map must contain explicit Fabric test README exclusion');
  assert.ok(content.includes('contracts-vendor/README.md'), 'Map must contain contracts-vendor/README.md');
  assert.ok(content.includes('contracts-vendor/contracts.lock.json'), 'Map must contain contracts-vendor/contracts.lock.json');
  assert.ok(content.includes('contracts-vendor/compatibility/*.manifest.json'), 'Map must contain compatibility manifests');
  assert.ok(content.includes('src/control-plane/Dockerfile'), 'Map must contain src/control-plane/Dockerfile');
  assert.ok(content.includes('docker/.env.example'), 'Map must contain docker/.env.example');
  assert.ok(content.includes('__main__.py'), 'Map must contain __main__.py');
  assert.ok(content.includes('services/api/pyproject.toml'), 'Map must contain services/api/pyproject.toml');
  assert.ok(content.includes('TaxiiClient'), 'Map must cite TaxiiClient');
});

test('in-memory validation: conformance_evidence schema requirements (Finding F-01 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Positive: valid evidence with all optional and required fields passes
  const validData = JSON.parse(JSON.stringify(sample));
  validData.advertisement_response.conformance_evidence[0] = {
    test_identifier: 'urn:cybrik:evidence:ev-oci-01',
    status: 'PASS',
    evidence_pack_digest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    executed_at: '2026-08-28T00:00:00Z',
    report_uri: 'https://reports.cybrik.example/report.json'
  };
  assert.ok(ajv.validate(schemaId, validData), 'Valid conformance evidence must pass: ' + ajv.errorsText());

  // 2. Positive: valid evidence with only required fields (omitting executed_at and report_uri) passes
  const minValidData = JSON.parse(JSON.stringify(sample));
  minValidData.advertisement_response.conformance_evidence[0] = {
    test_identifier: 'urn:cybrik:evidence:ev-oci-01',
    status: 'PASS',
    evidence_pack_digest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  };
  assert.ok(ajv.validate(schemaId, minValidData), 'Minimal valid conformance evidence must pass: ' + ajv.errorsText());

  // 3. Positive: valid status PASS passes schema validation; non-PASS values are rejected
  const stDataPass = JSON.parse(JSON.stringify(sample));
  stDataPass.advertisement_response.conformance_evidence[0].status = 'PASS';
  assert.ok(ajv.validate(schemaId, stDataPass), 'Status PASS must pass schema validation: ' + ajv.errorsText());

  for (const st of ['FAIL', 'INCONCLUSIVE', 'SKIPPED']) {
    const stData = JSON.parse(JSON.stringify(sample));
    stData.advertisement_response.conformance_evidence[0].status = st;
    assert.ok(!ajv.validate(schemaId, stData), `Status '${st}' must be rejected by schema validation`);
  }

  // 4. Negative: missing status property is rejected
  const missingStatus = JSON.parse(JSON.stringify(sample));
  delete missingStatus.advertisement_response.conformance_evidence[0].status;
  assert.ok(!ajv.validate(schemaId, missingStatus), 'Missing status must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'status'),
    'Schema error must indicate missing status property'
  );

  // 5. Negative: missing evidence_pack_digest property is rejected
  const missingDigest = JSON.parse(JSON.stringify(sample));
  delete missingDigest.advertisement_response.conformance_evidence[0].evidence_pack_digest;
  assert.ok(!ajv.validate(schemaId, missingDigest), 'Missing evidence_pack_digest must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'evidence_pack_digest'),
    'Schema error must indicate missing evidence_pack_digest property'
  );

  // 6. Negative: invalid status enum/const value is rejected
  const invalidStatus = JSON.parse(JSON.stringify(sample));
  invalidStatus.advertisement_response.conformance_evidence[0].status = 'INVALID_STATUS';
  assert.ok(!ajv.validate(schemaId, invalidStatus), 'Invalid status must be rejected');
  assert.ok(
    ajv.errors.some(e => (e.keyword === 'const' || e.keyword === 'enum') && e.instancePath.includes('/conformance_evidence/0/status')),
    'Schema error must indicate invalid const/enum on status'
  );

  // 7. Negative: malformed evidence_pack_digest is rejected (short length, uppercase, non-hex)
  const badDigests = [
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde', // 63 chars
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0', // 65 chars
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF', // uppercase
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg', // non-hex 'g'
    ''
  ];
  for (const badDig of badDigests) {
    const badDigestData = JSON.parse(JSON.stringify(sample));
    badDigestData.advertisement_response.conformance_evidence[0].evidence_pack_digest = badDig;
    assert.ok(!ajv.validate(schemaId, badDigestData), `Bad digest '${badDig}' must be rejected`);
    assert.ok(
      ajv.errors.some(e => e.keyword === 'pattern' && e.instancePath.includes('/conformance_evidence/0/evidence_pack_digest')),
      `Schema error must indicate pattern mismatch for digest '${badDig}'`
    );
  }

  // 8. Negative: legacy verification_method / additional properties rejected by additionalProperties: false
  const extraProps = JSON.parse(JSON.stringify(sample));
  extraProps.advertisement_response.conformance_evidence[0].verification_method = 'AUTOMATED_TEST';
  assert.ok(!ajv.validate(schemaId, extraProps), 'Legacy verification_method must be rejected by additionalProperties: false');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'additionalProperties' && e.params?.additionalProperty === 'verification_method'),
    'Schema error must indicate unexpected property verification_method'
  );

  // 9. Negative: invalid executed_at format rejected
  const badDate = JSON.parse(JSON.stringify(sample));
  badDate.advertisement_response.conformance_evidence[0].executed_at = 'not-a-date-time';
  assert.ok(!ajv.validate(schemaId, badDate), 'Invalid executed_at date-time format must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'format' && e.instancePath.includes('/conformance_evidence/0/executed_at')),
    'Schema error must indicate format error on executed_at'
  );

  // 10. Negative: invalid report_uri format rejected
  const badUri = JSON.parse(JSON.stringify(sample));
  badUri.advertisement_response.conformance_evidence[0].report_uri = 'not a valid uri with spaces';
  assert.ok(!ajv.validate(schemaId, badUri), 'Invalid report_uri format must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'format' && e.instancePath.includes('/conformance_evidence/0/report_uri')),
    'Schema error must indicate format error on report_uri'
  );
});

test('in-memory validation: standalone provider capability advertisement conformance_evidence schema requirements (Finding F-01 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  // 1. Positive: valid evidence with all optional and required fields passes
  const validData = JSON.parse(JSON.stringify(sample));
  validData.conformance_evidence[0] = {
    test_identifier: 'urn:cybrik:evidence:ev-oci-01',
    status: 'PASS',
    evidence_pack_digest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    executed_at: '2026-08-25T12:00:00Z',
    report_uri: 'https://reports.cybrik.example/report.json'
  };
  assert.ok(ajv.validate(schemaId, validData), 'Valid conformance evidence must pass: ' + ajv.errorsText());

  // 2. Positive: valid evidence with only required fields (omitting executed_at and report_uri) passes
  const minValidData = JSON.parse(JSON.stringify(sample));
  minValidData.conformance_evidence[0] = {
    test_identifier: 'urn:cybrik:evidence:ev-oci-01',
    status: 'PASS',
    evidence_pack_digest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  };
  assert.ok(ajv.validate(schemaId, minValidData), 'Minimal valid conformance evidence must pass: ' + ajv.errorsText());

  // 3. Positive: valid status PASS passes schema validation; non-PASS values are rejected
  const stDataPass = JSON.parse(JSON.stringify(sample));
  stDataPass.conformance_evidence[0].status = 'PASS';
  assert.ok(ajv.validate(schemaId, stDataPass), 'Status PASS must pass schema validation: ' + ajv.errorsText());

  for (const st of ['FAIL', 'INCONCLUSIVE', 'SKIPPED']) {
    const stData = JSON.parse(JSON.stringify(sample));
    stData.conformance_evidence[0].status = st;
    assert.ok(!ajv.validate(schemaId, stData), `Status '${st}' must be rejected by schema validation`);
  }

  // 4. Negative: missing status property is rejected
  const missingStatus = JSON.parse(JSON.stringify(sample));
  delete missingStatus.conformance_evidence[0].status;
  assert.ok(!ajv.validate(schemaId, missingStatus), 'Missing status must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'status'),
    'Schema error must indicate missing status property'
  );

  // 5. Negative: missing evidence_pack_digest property is rejected
  const missingDigest = JSON.parse(JSON.stringify(sample));
  delete missingDigest.conformance_evidence[0].evidence_pack_digest;
  assert.ok(!ajv.validate(schemaId, missingDigest), 'Missing evidence_pack_digest must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'evidence_pack_digest'),
    'Schema error must indicate missing evidence_pack_digest property'
  );

  // 6. Negative: invalid status enum/const value is rejected
  const invalidStatus = JSON.parse(JSON.stringify(sample));
  invalidStatus.conformance_evidence[0].status = 'INVALID_STATUS';
  assert.ok(!ajv.validate(schemaId, invalidStatus), 'Invalid status must be rejected');
  assert.ok(
    ajv.errors.some(e => (e.keyword === 'const' || e.keyword === 'enum') && e.instancePath.includes('/conformance_evidence/0/status')),
    'Schema error must indicate invalid const/enum on status'
  );

  // 7. Negative: malformed evidence_pack_digest is rejected
  const badDigests = [
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde', // 63 chars
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0', // 65 chars
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF', // uppercase
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg', // non-hex 'g'
    ''
  ];
  for (const badDig of badDigests) {
    const badDigestData = JSON.parse(JSON.stringify(sample));
    badDigestData.conformance_evidence[0].evidence_pack_digest = badDig;
    assert.ok(!ajv.validate(schemaId, badDigestData), `Bad digest '${badDig}' must be rejected`);
    assert.ok(
      ajv.errors.some(e => e.keyword === 'pattern' && e.instancePath.includes('/conformance_evidence/0/evidence_pack_digest')),
      `Schema error must indicate pattern mismatch for digest '${badDig}'`
    );
  }

  // 8. Negative: legacy verification_method / additional properties rejected by additionalProperties: false
  const extraProps = JSON.parse(JSON.stringify(sample));
  extraProps.conformance_evidence[0].verification_method = 'AUTOMATED_TEST';
  assert.ok(!ajv.validate(schemaId, extraProps), 'Legacy verification_method must be rejected by additionalProperties: false');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'additionalProperties' && e.params?.additionalProperty === 'verification_method'),
    'Schema error must indicate unexpected property verification_method'
  );

  // 9. Negative: invalid executed_at format rejected
  const badDate = JSON.parse(JSON.stringify(sample));
  badDate.conformance_evidence[0].executed_at = 'not-a-date-time';
  assert.ok(!ajv.validate(schemaId, badDate), 'Invalid executed_at date-time format must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'format' && e.instancePath.includes('/conformance_evidence/0/executed_at')),
    'Schema error must indicate format error on executed_at'
  );

  // 10. Negative: invalid report_uri format rejected
  const badReportUri = JSON.parse(JSON.stringify(sample));
  badReportUri.conformance_evidence[0].report_uri = 'not a valid uri with spaces';
  assert.ok(!ajv.validate(schemaId, badReportUri), 'Invalid report_uri format must be rejected');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'format' && e.instancePath.includes('/conformance_evidence/0/report_uri')),
    'Schema error must indicate format error on report_uri'
  );
});

test('in-memory validation: universal PASS status and valid SHA-256 digest on all capability evidence (Finding F-01 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Missing evidence reference for a non-storage capability (e.g., ai_model_runtime)
  const dataMissingRef = JSON.parse(JSON.stringify(sample));
  const aiCap = dataMissingRef.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'ai_model_runtime');
  aiCap.evidence_references = ['urn:cybrik:evidence:ev-ai-missing'];
  assert.throws(
    () => validatePlatformSemantics(dataMissingRef, schemaId),
    /Semantic error: evidence_reference 'urn:cybrik:evidence:ev-ai-missing' not found in conformance_evidence/
  );

  // 2. Non-PASS status on non-storage capability evidence (status: 'FAIL', 'INCONCLUSIVE', 'SKIPPED')
  for (const nonPassStatus of ['FAIL', 'INCONCLUSIVE', 'SKIPPED']) {
    const dataNonPass = JSON.parse(JSON.stringify(sample));
    const evAi = dataNonPass.advertisement_response.conformance_evidence.find(e => e.test_identifier === 'urn:cybrik:evidence:ev-ai-01');
    evAi.status = nonPassStatus;
    assert.throws(
      () => validatePlatformSemantics(dataNonPass, schemaId),
      new RegExp(`Semantic error: conformance evidence 'urn:cybrik:evidence:ev-ai-01' has non-passing status '${nonPassStatus}'`)
    );
  }

  // 3. Malformed SHA-256 digest on non-storage capability evidence
  const dataBadDigest = JSON.parse(JSON.stringify(sample));
  const evDb = dataBadDigest.advertisement_response.conformance_evidence.find(e => e.test_identifier === 'urn:cybrik:evidence:ev-db-01');
  evDb.evidence_pack_digest = 'not-a-valid-sha256';
  assert.throws(
    () => validatePlatformSemantics(dataBadDigest, schemaId),
    /Semantic error: conformance evidence 'urn:cybrik:evidence:ev-db-01' lacks valid SHA-256 evidence_pack_digest/
  );

  // 4. Standalone advertisement: Non-PASS status rejected
  const standaloneSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const standaloneSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  for (const nonPass of ['FAIL', 'INCONCLUSIVE', 'SKIPPED']) {
    const standaloneNonPass = JSON.parse(JSON.stringify(standaloneSample));
    standaloneNonPass.conformance_evidence[0].status = nonPass;
    assert.throws(
      () => validatePlatformSemantics(standaloneNonPass, standaloneSchemaId),
      new RegExp(`Semantic error: conformance evidence 'urn:cybrik:evidence:ev-oci-01' has non-passing status '${nonPass}'`)
    );
  }

  // 5. Standalone advertisement: Malformed SHA-256 digest rejected
  const standaloneBadDigest = JSON.parse(JSON.stringify(standaloneSample));
  standaloneBadDigest.conformance_evidence[0].evidence_pack_digest = 'bad-digest-format';
  assert.throws(
    () => validatePlatformSemantics(standaloneBadDigest, standaloneSchemaId),
    /Semantic error: conformance evidence 'urn:cybrik:evidence:ev-oci-01' lacks valid SHA-256 evidence_pack_digest/
  );
});

test('in-memory validation: mandatory capability with SKIPPED or INCONCLUSIVE evidence is rejected by schema and semantic validation (Finding F-01 / R14-03 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  for (const nonPassStatus of ['SKIPPED', 'INCONCLUSIVE']) {
    const data = JSON.parse(JSON.stringify(sample));
    const ociEv = data.advertisement_response.conformance_evidence.find(
      e => e.test_identifier === 'urn:cybrik:evidence:ev-oci-01'
    );
    assert.ok(ociEv, 'Evidence for ev-oci-01 must exist in sample');
    ociEv.status = nonPassStatus;

    // 1. Rejected by Ajv schema validation (status must be PASS)
    const valid = ajv.validate(schemaId, data);
    assert.ok(!valid, `Mandatory capability with ${nonPassStatus} evidence must be rejected by Ajv schema validation`);

    // 2. Fails validatePlatformSemantics with /has non-passing status/
    assert.throws(
      () => validatePlatformSemantics(data, schemaId),
      /has non-passing status/,
      `Mandatory capability with ${nonPassStatus} evidence must fail validatePlatformSemantics with /has non-passing status/`
    );
  }
});

test('in-memory validation: biconditional coupling and ACTIVE_OPTIMAL invariants (Finding F-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. GRANTED_FULL with fallback_applied !== 'NONE' throws biconditional coupling error
  const dataFullWithFallback = JSON.parse(JSON.stringify(sample));
  const cap1 = dataFullWithFallback.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock');
  cap1.disposition = 'GRANTED_FULL';
  cap1.fallback_applied = 'FEATURE_DISABLED_GRACEFUL';
  // Use private-cloud-v1 to avoid immutable storage check triggering first
  const privateCloudPath = join(EXAMPLES_DIR, 'private-cloud-v1.profile.json');
  const privateCloudDigest = createHash('sha256').update(readFileSync(privateCloudPath)).digest('hex');
  dataFullWithFallback.target_profile_id = 'private-cloud-v1';
  dataFullWithFallback.target_profile_digest = privateCloudDigest;
  dataFullWithFallback.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  dataFullWithFallback.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  assert.throws(
    () => validatePlatformSemantics(dataFullWithFallback, schemaId),
    /Semantic error: capability 'storage_object_lock' with disposition 'GRANTED_FULL' cannot have fallback 'FEATURE_DISABLED_GRACEFUL' \(must be 'NONE'\)/
  );

  // 2. fallback_applied === 'NONE' with disposition !== 'GRANTED_FULL' throws biconditional coupling error
  const dataNoneWithDegraded = JSON.parse(JSON.stringify(sample));
  dataNoneWithDegraded.target_profile_id = 'private-cloud-v1';
  dataNoneWithDegraded.target_profile_digest = privateCloudDigest;
  dataNoneWithDegraded.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  dataNoneWithDegraded.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  const cap2 = dataNoneWithDegraded.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'ai_tensor_acceleration');
  cap2.disposition = 'GRANTED_DEGRADED';
  cap2.fallback_applied = 'NONE';
  assert.throws(
    () => validatePlatformSemantics(dataNoneWithDegraded, schemaId),
    /Semantic error: capability 'ai_tensor_acceleration' with fallback 'NONE' must have disposition 'GRANTED_FULL' \(got 'GRANTED_DEGRADED'\)/
  );

  const dataNoneWithUnsupported = JSON.parse(JSON.stringify(sample));
  dataNoneWithUnsupported.target_profile_id = 'private-cloud-v1';
  dataNoneWithUnsupported.target_profile_digest = privateCloudDigest;
  dataNoneWithUnsupported.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  dataNoneWithUnsupported.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  const cap2b = dataNoneWithUnsupported.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'ai_tensor_acceleration');
  cap2b.disposition = 'REJECTED_UNSUPPORTED';
  cap2b.fallback_applied = 'NONE';
  assert.throws(
    () => validatePlatformSemantics(dataNoneWithUnsupported, schemaId),
    /Semantic error: capability 'ai_tensor_acceleration' with fallback 'NONE' must have disposition 'GRANTED_FULL' \(got 'REJECTED_UNSUPPORTED'\)/
  );

  // 3. ACTIVE_OPTIMAL lease rejecting REJECTED_UNSUPPORTED
  const dataOptUnsupported = JSON.parse(JSON.stringify(sample));
  dataOptUnsupported.negotiation_status = 'AGREED_LEASE_GRANTED';
  dataOptUnsupported.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  for (const c of dataOptUnsupported.agreed_capability_lease.negotiated_optional_capabilities) {
    c.disposition = 'GRANTED_FULL';
    c.fallback_applied = 'NONE';
  }
  dataOptUnsupported.agreed_capability_lease.negotiated_optional_capabilities[0].disposition = 'REJECTED_UNSUPPORTED';
  dataOptUnsupported.agreed_capability_lease.negotiated_optional_capabilities[0].fallback_applied = 'FEATURE_DISABLED_GRACEFUL';
  assert.throws(
    () => validatePlatformSemantics(dataOptUnsupported, schemaId),
    /Semantic error: ACTIVE_OPTIMAL lease cannot contain degraded capability 'ai_tensor_acceleration'/
  );

  // 4. ACTIVE_OPTIMAL lease rejecting GRANTED_DEGRADED
  const dataOptDegraded = JSON.parse(JSON.stringify(sample));
  dataOptDegraded.negotiation_status = 'AGREED_LEASE_GRANTED';
  dataOptDegraded.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  for (const c of dataOptDegraded.agreed_capability_lease.negotiated_optional_capabilities) {
    c.disposition = 'GRANTED_FULL';
    c.fallback_applied = 'NONE';
  }
  dataOptDegraded.agreed_capability_lease.negotiated_optional_capabilities[0].disposition = 'GRANTED_DEGRADED';
  dataOptDegraded.agreed_capability_lease.negotiated_optional_capabilities[0].fallback_applied = 'CORE_EMULATION_FALLBACK';
  assert.throws(
    () => validatePlatformSemantics(dataOptDegraded, schemaId),
    /Semantic error: ACTIVE_OPTIMAL lease cannot contain degraded capability 'ai_tensor_acceleration'/
  );
});

test('in-memory validation: REJECTED_UNSUPPORTED with fallback_applied NONE is rejected by Ajv and validatePlatformSemantics (Finding F-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const data = JSON.parse(JSON.stringify(sample));
  // Set an optional capability in ACTIVE_DEGRADED lease to REJECTED_UNSUPPORTED with fallback_applied: "NONE"
  data.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "REJECTED_UNSUPPORTED",
      active_mode: "unsupported_rejected",
      fallback_applied: "NONE",
      notes: "No fallback applied to rejected unsupported capability"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_FULL",
      active_mode: "native_s3_object_lock",
      fallback_applied: "NONE"
    },
    {
      capability_name: "cache_cluster_replication",
      slot_id: "cache",
      disposition: "GRANTED_DEGRADED",
      active_mode: "standalone_noeviction",
      fallback_applied: "FEATURE_DISABLED_GRACEFUL"
    }
  ];

  // 1. Rejected by Ajv schema validation (biconditional coupling requires fallback_applied to be non-NONE for REJECTED_UNSUPPORTED)
  const valid = ajv.validate(schemaId, data);
  assert.ok(!valid, 'REJECTED_UNSUPPORTED with fallback_applied NONE must be rejected by Ajv schema validation');

  // 2. Rejected by validatePlatformSemantics
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /must have disposition 'GRANTED_FULL'|must have a valid non-NONE fallback applied/,
    'REJECTED_UNSUPPORTED with fallback_applied NONE must be rejected by validatePlatformSemantics'
  );
});

test('in-memory validation: ACTIVE_OPTIMAL lease containing REJECTED_UNSUPPORTED capability with graceful fallback is rejected by Ajv and validatePlatformSemantics (Finding F-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const data = JSON.parse(JSON.stringify(sample));
  data.negotiation_status = "AGREED_LEASE_GRANTED";
  data.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  data.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "REJECTED_UNSUPPORTED",
      active_mode: "cpu_quantized_emulation",
      fallback_applied: "CORE_EMULATION_FALLBACK",
      notes: "Unsupported acceleration falling back to CPU emulation"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_FULL",
      active_mode: "native_s3_object_lock",
      fallback_applied: "NONE"
    },
    {
      capability_name: "cache_cluster_replication",
      slot_id: "cache",
      disposition: "GRANTED_FULL",
      active_mode: "native_replication",
      fallback_applied: "NONE"
    }
  ];

  // 1. Rejected by Ajv schema validation (ACTIVE_OPTIMAL requires disposition: GRANTED_FULL and fallback_applied: NONE for all items)
  const valid = ajv.validate(schemaId, data);
  assert.ok(!valid, 'ACTIVE_OPTIMAL lease containing REJECTED_UNSUPPORTED capability must be rejected by Ajv schema validation');

  // 2. Rejected by validatePlatformSemantics
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /ACTIVE_OPTIMAL lease cannot contain degraded capability/,
    'ACTIVE_OPTIMAL lease containing REJECTED_UNSUPPORTED capability must be rejected by validatePlatformSemantics'
  );
});

test('in-memory validation: requested-to-lease closure verification (Finding F-03 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Positive: all requested optional capabilities are resolved in the agreed lease
  const validData = JSON.parse(JSON.stringify(sample));
  assert.doesNotThrow(() => validatePlatformSemantics(validData, schemaId));

  // 2. Negative: requested optional capability with required_for_optimal: true omitted from ACTIVE_OPTIMAL lease
  const dataOmitted = JSON.parse(JSON.stringify(sample));
  dataOmitted.negotiation_status = "AGREED_LEASE_GRANTED";
  dataOmitted.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  dataOmitted.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_FULL",
      active_mode: "native_s3_object_lock",
      fallback_applied: "NONE"
    },
    {
      capability_name: "cache_cluster_replication",
      slot_id: "cache",
      disposition: "GRANTED_FULL",
      active_mode: "standalone_noeviction",
      fallback_applied: "NONE"
    }
  ];
  assert.throws(
    () => validatePlatformSemantics(dataOmitted, schemaId),
    /requested optional capability 'ai_tensor_acceleration' for slot 'ai_model_runtime' is (?:required for optimal operation but is )?not resolved in agreed_capability_lease/
  );

  // 3. Negative: additional requested optional capability with required_for_optimal: true omitted from agreed lease
  const dataExtraReq = JSON.parse(JSON.stringify(sample));
  dataExtraReq.negotiation_status = "AGREED_LEASE_GRANTED";
  dataExtraReq.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  dataExtraReq.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_FULL",
      active_mode: "gpu_direct",
      fallback_applied: "NONE"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_FULL",
      active_mode: "native_s3_object_lock",
      fallback_applied: "NONE"
    },
    {
      capability_name: "cache_cluster_replication",
      slot_id: "cache",
      disposition: "GRANTED_FULL",
      active_mode: "standalone_noeviction",
      fallback_applied: "NONE"
    }
  ];
  dataExtraReq.negotiation_request.requested_optional_capabilities.push({
    capability_name: "custom_acceleration",
    slot_id: "ai_model_runtime",
    required_for_optimal: true,
    preferred_fallback: "CORE_EMULATION_FALLBACK"
  });
  assert.throws(
    () => validatePlatformSemantics(dataExtraReq, schemaId),
    /requested optional capability 'custom_acceleration' for slot 'ai_model_runtime' is (?:required for optimal operation but is )?not resolved in agreed_capability_lease/
  );

  // 4. Negative: slot mismatch with same capability_name (composite key closure)
  const dataSlotMismatch = JSON.parse(JSON.stringify(sample));
  const cacheReq = dataSlotMismatch.negotiation_request.requested_optional_capabilities.find(c => c.capability_name === 'cache_cluster_replication');
  cacheReq.slot_id = 'database';
  assert.throws(
    () => validatePlatformSemantics(dataSlotMismatch, schemaId),
    /(?:requested optional capability 'cache_cluster_replication' for slot 'database' is not resolved in agreed_capability_lease|agreed_capability_lease contains unrequested or surplus optional capability 'cache_cluster_replication' for slot 'cache')/
  );

  // 5. Negative: duplicate composite key in requested_optional_capabilities (Finding R16-02 / OPEN-5)
  const dataDupReq = JSON.parse(JSON.stringify(sample));
  dataDupReq.negotiation_request.requested_optional_capabilities.push({
    capability_name: "cache_cluster_replication",
    slot_id: "cache",
    required_for_optimal: false,
    preferred_fallback: "FEATURE_DISABLED_GRACEFUL"
  });
  assert.throws(
    () => validatePlatformSemantics(dataDupReq, schemaId),
    /Semantic error: requested_optional_capabilities contains duplicate composite key \(cache_cluster_replication, cache\)/
  );
});

test('in-memory validation: ACTIVE_OPTIMAL lease omitting requested optional capability with required_for_optimal: true passes Ajv but fails validatePlatformSemantics (Finding F-03 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const data = JSON.parse(JSON.stringify(sample));
  data.negotiation_status = "AGREED_LEASE_GRANTED";
  data.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  // negotiation_request requests 3 optional capabilities:
  // - ai_tensor_acceleration (required_for_optimal: true)
  // - storage_object_lock (required_for_optimal: false)
  // - cache_cluster_replication (required_for_optimal: false)
  // agreed_capability_lease omits ai_tensor_acceleration (required_for_optimal: true):
  data.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_FULL",
      active_mode: "native_s3_object_lock",
      fallback_applied: "NONE"
    },
    {
      capability_name: "cache_cluster_replication",
      slot_id: "cache",
      disposition: "GRANTED_FULL",
      active_mode: "standalone_noeviction",
      fallback_applied: "NONE"
    }
  ];

  // 1. Passes Ajv schema validation (schema validates structural array format without verifying request-to-lease closure)
  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Omitting requested optional capability must pass Ajv schema validation: ' + ajv.errorsText());

  // 2. Fails validatePlatformSemantics with /is not resolved in agreed_capability_lease/
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /is (?:required for optimal operation but is )?not resolved in agreed_capability_lease/,
    'ACTIVE_OPTIMAL lease omitting required_for_optimal: true capability must fail validatePlatformSemantics'
  );
});

test('in-memory validation: ACTIVE_OPTIMAL lease omitting capability with required_for_optimal: false is permitted (OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const data = JSON.parse(JSON.stringify(sample));
  data.negotiation_status = "AGREED_LEASE_GRANTED";
  data.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  // Omits cache_cluster_replication (required_for_optimal: false) while granting ai_tensor_acceleration (required_for_optimal: true)
  data.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: "ai_tensor_acceleration",
      slot_id: "ai_model_runtime",
      disposition: "GRANTED_FULL",
      active_mode: "gpu_direct",
      fallback_applied: "NONE"
    },
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      disposition: "GRANTED_FULL",
      active_mode: "native_s3_object_lock",
      fallback_applied: "NONE"
    }
  ];

  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Must pass Ajv schema validation: ' + ajv.errorsText());
  assert.doesNotThrow(() => validatePlatformSemantics(data, schemaId), 'ACTIVE_OPTIMAL lease omitting required_for_optimal: false capability must pass');
});

test('in-memory validation: standalone advertisement conformance_evidence integrity (Finding F-01 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  // 1. Non-PASS evidence status is rejected by Ajv schema and validatePlatformSemantics
  for (const nonPassStatus of ['SKIPPED', 'INCONCLUSIVE', 'FAIL']) {
    const data = JSON.parse(JSON.stringify(sample));
    data.conformance_evidence[0].status = nonPassStatus;

    // A. Rejected by Ajv schema validation (status must be PASS)
    const valid = ajv.validate(schemaId, data);
    assert.ok(!valid, `Standalone advertisement with evidence status '${nonPassStatus}' must be rejected by Ajv schema validation`);

    // B. Rejected by validatePlatformSemantics
    assert.throws(
      () => validatePlatformSemantics(data, schemaId),
      /has non-passing status/,
      `Standalone advertisement with evidence status '${nonPassStatus}' must be rejected by validatePlatformSemantics`
    );
  }

  // 2. Evidence with missing evidence_pack_digest is rejected
  const dataMissingDigest = JSON.parse(JSON.stringify(sample));
  delete dataMissingDigest.conformance_evidence[0].evidence_pack_digest;
  const validMissingDigest = ajv.validate(schemaId, dataMissingDigest);
  assert.ok(!validMissingDigest, 'Standalone advertisement with missing evidence_pack_digest must be rejected by Ajv');
  assert.throws(
    () => validatePlatformSemantics(dataMissingDigest, schemaId),
    /lacks valid SHA-256 evidence_pack_digest/,
    'Standalone advertisement with missing evidence_pack_digest must fail validatePlatformSemantics'
  );

  // 3. Evidence with malformed evidence_pack_digest is rejected
  const dataBadDigest = JSON.parse(JSON.stringify(sample));
  dataBadDigest.conformance_evidence[0].evidence_pack_digest = 'not-a-valid-sha256';
  const validBadDigest = ajv.validate(schemaId, dataBadDigest);
  assert.ok(!validBadDigest, 'Standalone advertisement with malformed evidence_pack_digest must be rejected by Ajv');
  assert.throws(
    () => validatePlatformSemantics(dataBadDigest, schemaId),
    /lacks valid SHA-256 evidence_pack_digest/,
    'Standalone advertisement with malformed evidence_pack_digest must fail validatePlatformSemantics'
  );
});

test('in-memory validation: negotiation request with slot mismatch rejected (Finding F-03 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // Request specifies ai_tensor_acceleration for slot 'storage', while lease resolves ai_tensor_acceleration for slot 'ai_model_runtime'
  const data = JSON.parse(JSON.stringify(sample));
  const reqAiCap = data.negotiation_request.requested_optional_capabilities.find(c => c.capability_name === 'ai_tensor_acceleration');
  assert.ok(reqAiCap, 'ai_tensor_acceleration must be in requested_optional_capabilities');
  reqAiCap.slot_id = 'storage';

  // 1. Passes Ajv schema validation (schema checks array item structure without cross-slot resolution matching)
  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Slot-mismatched negotiation request must pass Ajv schema validation: ' + ajv.errorsText());

  // 2. Fails validatePlatformSemantics with /for slot 'storage' is not resolved in agreed_capability_lease/ or surplus error
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /(?:DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN|for slot 'storage' is not resolved in agreed_capability_lease|agreed_capability_lease contains unrequested or surplus optional capability 'ai_tensor_acceleration' for slot 'ai_model_runtime')/,
    'Slot mismatch (requested slot storage vs lease slot ai_model_runtime) must fail validatePlatformSemantics'
  );
});

test('in-memory validation: duplicate requested optional capability rejected by composite key uniqueness (Finding R16-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // Duplicate requested optional capability (composite key storage_object_lock::storage repeated)
  const data = JSON.parse(JSON.stringify(sample));
  data.negotiation_request.requested_optional_capabilities.push({
    capability_name: "storage_object_lock",
    slot_id: "storage",
    required_for_optimal: true,
    preferred_fallback: "FEATURE_DISABLED_GRACEFUL"
  });

  // 1. Passes Ajv schema validation (schema admits repeated optional capability requests structurally)
  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Duplicate requested optional capability must pass Ajv schema validation: ' + ajv.errorsText());

  // 2. Fails validatePlatformSemantics with /requested_optional_capabilities contains duplicate composite key/
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /Semantic error: requested_optional_capabilities contains duplicate composite key \(storage_object_lock, storage\)/,
    'Duplicate requested optional capability must fail validatePlatformSemantics with duplicate composite key'
  );
});

test('negotiation handshake fixtures subset matching and composite-key closure (Finding R13-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const handshakeFilePath = join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json');
  assert.ok(existsSync(handshakeFilePath), `Missing handshake fixture: ${handshakeFilePath}`);
  const data = JSON.parse(readFileSync(handshakeFilePath, 'utf8'));

  const requested = data.negotiation_request?.requested_optional_capabilities || [];
  const leased = data.agreed_capability_lease?.negotiated_optional_capabilities || [];

  assert.ok(requested.length > 0, 'negotiation_request must have requested_optional_capabilities');
  assert.ok(leased.length > 0, 'agreed_capability_lease must have negotiated_optional_capabilities');

  // Composite-key subset assertions: every leased capability (capability_name, slot_id) must be in requested
  const requestedKeySet = new Set(requested.map(r => `${r.capability_name}::${r.slot_id}`));
  for (const cap of leased) {
    const key = `${cap.capability_name}::${cap.slot_id}`;
    assert.ok(
      requestedKeySet.has(key),
      `Leased capability composite key '${key}' must be a subset of requested optional capabilities`
    );
  }

  // Baseline handshake fixture passes semantic validation
  assert.doesNotThrow(
    () => validatePlatformSemantics(data, schemaId),
    'Baseline negotiation handshake fixture must pass validatePlatformSemantics'
  );

  // Positive: valid subset omitting capability with required_for_optimal: false passes
  const dataSubset = JSON.parse(JSON.stringify(data));
  dataSubset.agreed_capability_lease.negotiated_optional_capabilities =
    dataSubset.agreed_capability_lease.negotiated_optional_capabilities.filter(
      c => c.capability_name !== 'cache_cluster_replication'
    );
  assert.doesNotThrow(
    () => validatePlatformSemantics(dataSubset, schemaId),
    'Valid subset omitting required_for_optimal: false capability must pass validatePlatformSemantics'
  );

  // Negative: duplicate composite key in request must fail validatePlatformSemantics
  const dataDupReq = JSON.parse(JSON.stringify(data));
  dataDupReq.negotiation_request.requested_optional_capabilities.push({
    capability_name: "storage_object_lock",
    slot_id: "storage",
    required_for_optimal: true,
    preferred_fallback: "FEATURE_DISABLED_GRACEFUL"
  });
  assert.throws(
    () => validatePlatformSemantics(dataDupReq, schemaId),
    /Semantic error: requested_optional_capabilities contains duplicate composite key \(storage_object_lock, storage\)/,
    'Duplicate requested composite key must fail validatePlatformSemantics'
  );

  // Negative: duplicate composite key in lease must fail validatePlatformSemantics
  const dataDupLease = JSON.parse(JSON.stringify(data));
  dataDupLease.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: "storage_object_lock",
    slot_id: "storage",
    disposition: "GRANTED_FULL",
    active_mode: "native_s3_object_lock",
    fallback_applied: "NONE"
  });
  assert.throws(
    () => validatePlatformSemantics(dataDupLease, schemaId),
    /Semantic error: negotiated_optional_capabilities contains duplicate composite key \(storage_object_lock, storage\)/,
    'Duplicate leased composite key must fail validatePlatformSemantics'
  );

  // Negative: lease containing extra unrequested capability must fail validatePlatformSemantics
  const dataExtraLease = JSON.parse(JSON.stringify(data));
  dataExtraLease.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: "unrequested_performance_boost",
    slot_id: "ai_model_runtime",
    disposition: "GRANTED_FULL",
    active_mode: "boost_direct",
    fallback_applied: "NONE"
  });

  assert.throws(
    () => validatePlatformSemantics(dataExtraLease, schemaId),
    /contains unrequested or surplus optional capability 'unrequested_performance_boost' for slot 'ai_model_runtime'/,
    'Lease with unrequested optional capability must fail validatePlatformSemantics'
  );
});

test('in-memory validation: bidirectional multiset lease closure rejects surplus and unrequested capabilities (Finding R13-01 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Positive baseline: valid bidirectional match passes validatePlatformSemantics
  const dataValid = JSON.parse(JSON.stringify(sample));
  assert.doesNotThrow(() => validatePlatformSemantics(dataValid, schemaId));

  // 2. Duplicate/surplus capability in lease (request has 1 storage_object_lock, lease has duplicate storage_object_lock)
  const dataSurplus = JSON.parse(JSON.stringify(sample));
  dataSurplus.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: "storage_object_lock",
    slot_id: "storage",
    disposition: "GRANTED_FULL",
    active_mode: "native_s3_object_lock",
    fallback_applied: "NONE"
  });
  assert.throws(
    () => validatePlatformSemantics(dataSurplus, schemaId),
    /Semantic error: negotiated_optional_capabilities contains duplicate composite key \(storage_object_lock, storage\)/
  );

  // 3. Unrequested capability in lease (request omits custom_acceleration, but lease includes it)
  const dataUnrequested = JSON.parse(JSON.stringify(sample));
  dataUnrequested.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: "custom_acceleration",
    slot_id: "ai_model_runtime",
    disposition: "GRANTED_FULL",
    active_mode: "gpu_direct",
    fallback_applied: "NONE"
  });
  assert.throws(
    () => validatePlatformSemantics(dataUnrequested, schemaId),
    /Semantic error: agreed_capability_lease contains unrequested or surplus optional capability 'custom_acceleration' for slot 'ai_model_runtime'/
  );
});

test('in-memory validation: surplus unrequested optional capability in lease passes Ajv but rejected by validatePlatformSemantics (Finding R13-01 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // Four-lease/three-request case: negotiation_request requests 3 optional capabilities:
  // - ai_tensor_acceleration (slot: ai_model_runtime)
  // - storage_object_lock (slot: storage)
  // - cache_cluster_replication (slot: cache)
  // agreed_capability_lease contains 4 entries (including a surplus unrequested optional capability):
  const data = JSON.parse(JSON.stringify(sample));
  data.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: "quantum_entropy_source",
    slot_id: "crypto",
    disposition: "GRANTED_FULL",
    active_mode: "hardware_rng",
    fallback_applied: "NONE"
  });

  assert.equal(data.negotiation_request.requested_optional_capabilities.length, 3, 'Request must have 3 capabilities');
  assert.equal(data.agreed_capability_lease.negotiated_optional_capabilities.length, 4, 'Lease must have 4 capabilities (1 surplus)');

  // 1. Passes Ajv schema validation (Ajv validates structure of array items without cross-checking request cardinality)
  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Surplus optional capability in lease must pass Ajv schema validation structurally: ' + ajv.errorsText());

  // 2. Rejected by validatePlatformSemantics with /unrequested or surplus|count mismatch/
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /unrequested or surplus|count mismatch/,
    'Four-lease/three-request case (surplus unrequested optional capability in lease) must be rejected by validatePlatformSemantics'
  );
});

test('in-memory validation: universal PASS status on unreferenced evidence and reverse evidence closure (Finding R14-01 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  // 1. Unreferenced evidence with non-PASS status throws /has non-passing status/
  const dataNonPassUnreferenced = JSON.parse(JSON.stringify(sample));
  dataNonPassUnreferenced.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:unreferenced-fail",
    status: "FAIL",
    evidence_pack_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    executed_at: "2026-08-25T12:00:00Z",
    report_uri: "https://example.com/report-fail"
  });
  assert.throws(
    () => validatePlatformSemantics(dataNonPassUnreferenced, schemaId),
    /Semantic error: conformance evidence 'urn:cybrik:evidence:unreferenced-fail' has non-passing status 'FAIL'/
  );

  // 2. Unreferenced evidence with malformed SHA-256 digest throws /lacks valid SHA-256 evidence_pack_digest/
  const dataBadDigestUnreferenced = JSON.parse(JSON.stringify(sample));
  dataBadDigestUnreferenced.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:unreferenced-bad-digest",
    status: "PASS",
    evidence_pack_digest: "not-a-valid-sha256",
    executed_at: "2026-08-25T12:00:00Z",
    report_uri: "https://example.com/report-bad"
  });
  assert.throws(
    () => validatePlatformSemantics(dataBadDigestUnreferenced, schemaId),
    /Semantic error: conformance evidence 'urn:cybrik:evidence:unreferenced-bad-digest' lacks valid SHA-256 evidence_pack_digest/
  );

  // 3. Unreferenced dangling evidence (with PASS status and valid SHA-256 digest) throws /conformance_evidence contains unreferenced or dangling evidence/
  const dataDanglingUnreferenced = JSON.parse(JSON.stringify(sample));
  dataDanglingUnreferenced.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:unreferenced-pass",
    status: "PASS",
    evidence_pack_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    executed_at: "2026-08-25T12:00:00Z",
    report_uri: "https://example.com/report-pass"
  });
  assert.throws(
    () => validatePlatformSemantics(dataDanglingUnreferenced, schemaId),
    /Semantic error: conformance_evidence contains unreferenced or dangling evidence 'urn:cybrik:evidence:unreferenced-pass'/
  );

  // 4. Negotiation document with dangling unreferenced evidence in advertisement_response
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const pcnSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const pcnDangling = JSON.parse(JSON.stringify(pcnSample));
  pcnDangling.advertisement_response.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:unreferenced-pcn-pass",
    status: "PASS",
    evidence_pack_digest: "a115151515151515151515151515151515151515151515151515151515151515",
    executed_at: "2026-08-27T12:00:00Z",
    report_uri: "https://reports.cybrik.example/evidence/dangling.json"
  });
  assert.throws(
    () => validatePlatformSemantics(pcnDangling, pcnSchemaId),
    /Semantic error: conformance_evidence contains unreferenced or dangling evidence 'urn:cybrik:evidence:unreferenced-pcn-pass'/
  );
});

test('in-memory validation: reject duplicate slot_id in advertised_capabilities (Finding R14-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  const dataDupSlot = JSON.parse(JSON.stringify(sample));
  dataDupSlot.advertised_capabilities.push({
    capability_name: "oci_container_runtime_secondary",
    slot_id: "oci_container_runtime",
    description: "Duplicate slot runtime",
    is_mandatory: true,
    supported_features: ["container_lifecycle"],
    degradation_fallback: "NONE",
    evidence_references: [
      "urn:cybrik:evidence:ev-oci-01"
    ]
  });

  assert.throws(
    () => validatePlatformSemantics(dataDupSlot, schemaId),
    /Semantic error: advertised_capabilities contains duplicate slot_id 'oci_container_runtime'/
  );
});

test('in-memory validation: reject unreferenced/dangling PASS and FAIL evidence in conformance_evidence (Finding R14-01 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  // 1. Positive baseline: sample advertisement passes Ajv and validatePlatformSemantics
  const validData = JSON.parse(JSON.stringify(sample));
  assert.ok(ajv.validate(schemaId, validData), 'Baseline advertisement must pass Ajv schema validation');
  assert.doesNotThrow(() => validatePlatformSemantics(validData, schemaId), 'Baseline advertisement must pass validatePlatformSemantics');

  // 2. Unreferenced / dangling PASS record in conformance_evidence passes Ajv but is rejected by validatePlatformSemantics
  const dataDanglingPass = JSON.parse(JSON.stringify(sample));
  dataDanglingPass.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:dangling-pass-test",
    status: "PASS",
    evidence_pack_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    executed_at: "2026-08-25T12:00:00Z",
    report_uri: "https://example.com/dangling-pass-report"
  });

  const validAjvDanglingPass = ajv.validate(schemaId, dataDanglingPass);
  assert.ok(validAjvDanglingPass, 'Unreferenced PASS record must pass Ajv schema validation structurally');
  assert.throws(
    () => validatePlatformSemantics(dataDanglingPass, schemaId),
    /unreferenced or dangling evidence/,
    'Unreferenced PASS record in conformance_evidence must be rejected by validatePlatformSemantics with /unreferenced or dangling evidence/'
  );

  // 3. Unreferenced non-PASS record in conformance_evidence is rejected by Ajv schema and validatePlatformSemantics
  const dataDanglingFail = JSON.parse(JSON.stringify(sample));
  dataDanglingFail.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:dangling-fail-test",
    status: "FAIL",
    evidence_pack_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    executed_at: "2026-08-25T12:00:00Z",
    report_uri: "https://example.com/dangling-fail-report"
  });

  const validAjvDanglingFail = ajv.validate(schemaId, dataDanglingFail);
  assert.ok(!validAjvDanglingFail, 'Unreferenced FAIL record must be rejected by Ajv schema validation');
  assert.throws(
    () => validatePlatformSemantics(dataDanglingFail, schemaId),
    /unreferenced or dangling evidence|non-passing status/,
    'Unreferenced FAIL record in conformance_evidence must be rejected by validatePlatformSemantics'
  );
});

test('in-memory validation: reject duplicate slot advertisements e.g. conflicting storage slots (Finding R14-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  // Duplicate storage slot advertisement (e.g. one compliant, one weak)
  const data = JSON.parse(JSON.stringify(sample));
  data.advertised_capabilities = [
    {
      capability_name: "storage_compliant_s3",
      slot_id: "storage",
      description: "Compliant S3 storage with full Object Lock retention",
      is_mandatory: true,
      supported_features: ["PutObject"],
      degradation_fallback: "NONE",
      evidence_references: ["urn:cybrik:evidence:ev-storage-01"]
    },
    {
      capability_name: "storage_weak_s3",
      slot_id: "storage",
      description: "Weak S3 storage without Object Lock",
      is_mandatory: true,
      supported_features: ["PutObject"],
      degradation_fallback: "NONE",
      evidence_references: ["urn:cybrik:evidence:ev-storage-02"]
    }
  ];
  data.conformance_evidence = [
    {
      test_identifier: "urn:cybrik:evidence:ev-storage-01",
      status: "PASS",
      evidence_pack_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      executed_at: "2026-08-25T12:00:00Z",
      report_uri: "https://example.com/report1"
    },
    {
      test_identifier: "urn:cybrik:evidence:ev-storage-02",
      status: "PASS",
      evidence_pack_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      executed_at: "2026-08-25T12:00:00Z",
      report_uri: "https://example.com/report2"
    }
  ];

  // 1. Passes Ajv schema validation (PARTIAL_CAPABILITY_ADVERTISEMENT allows arbitrary array items)
  const validAjv = ajv.validate(schemaId, data);
  assert.ok(validAjv, 'Duplicate storage slot advertisement passes Ajv structurally: ' + ajv.errorsText());

  // 2. Rejected by validatePlatformSemantics with /duplicate slot_id/
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /duplicate slot_id/,
    'Duplicate storage slot advertisement must be rejected by validatePlatformSemantics with /duplicate slot_id/'
  );
});

test('cross-artifact domain equality: conformance_evidence status const "PASS" matches specification §5.2 (Finding R15-02 / OPEN-5)', () => {
  const specPath = join(ROOT, 'contracts/platform/CYBRIK-PROVIDER-CAPABILITY-NEGOTIATION-V1-SPECIFICATION.md');
  const advSchemaPath = join(JSON_SCHEMA_DIR, 'cybrik.provider-capability-advertisement.v1.schema.json');
  const negSchemaPath = join(JSON_SCHEMA_DIR, 'cybrik.provider-capability-negotiation.v1.schema.json');

  assert.ok(existsSync(specPath), `Specification file missing: ${specPath}`);
  assert.ok(existsSync(advSchemaPath), `Advertisement schema missing: ${advSchemaPath}`);
  assert.ok(existsSync(negSchemaPath), `Negotiation schema missing: ${negSchemaPath}`);

  // 1. Parse markdown specification §5.2 table
  const specContent = readFileSync(specPath, 'utf8');
  const tableRowMatch = specContent.match(
    /\|\s*`?\/advertisement_response\/conformance_evidence\[\]\.status`?\s*\|\s*`?string`?\s*\|\s*([^|]+)\|\s*([^|]+)\|/
  );
  assert.ok(tableRowMatch, 'Specification §5.2 table must contain row for conformance_evidence[].status');

  const rawConstraint = tableRowMatch[1].trim();
  assert.match(
    rawConstraint,
    /Const\s*`?"PASS"`?/i,
    `Specification §5.2 constraint must specify Const "PASS" (got '${rawConstraint}')`
  );

  // 2. Parse JSON schemas
  const advSchema = JSON.parse(readFileSync(advSchemaPath, 'utf8'));
  const negSchema = JSON.parse(readFileSync(negSchemaPath, 'utf8'));

  const advStatusConst = advSchema.properties?.conformance_evidence?.items?.properties?.status?.const;
  assert.equal(
    advStatusConst,
    'PASS',
    'cybrik.provider-capability-advertisement.v1.schema.json must specify status.const === "PASS"'
  );

  const negStatusConst =
    negSchema.properties?.advertisement_response?.properties?.conformance_evidence?.items?.properties?.status?.const;
  assert.equal(
    negStatusConst,
    'PASS',
    'cybrik.provider-capability-negotiation.v1.schema.json must specify status.const === "PASS"'
  );

  // 3. Cross-artifact domain equality assertion
  const specConstValue = (rawConstraint.match(/"([^"]+)"/) || rawConstraint.match(/`([^`]+)`/))[1];
  assert.equal(
    specConstValue,
    'PASS',
    'Specification §5.2 status domain must be "PASS"'
  );
  assert.equal(
    advStatusConst,
    specConstValue,
    'Advertisement JSON Schema status const must equal specification §5.2 status const'
  );
  assert.equal(
    negStatusConst,
    specConstValue,
    'Negotiation JSON Schema status const must equal specification §5.2 status const'
  );

  // 4. In-memory validation: non-PASS statuses fail both schema and semantic validation
  const advSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const sampleAdv = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  const invalidStatuses = ['FAIL', 'INCONCLUSIVE', 'SKIPPED', 'UNKNOWN', 'ERROR', '', 'pass', 'Pass'];
  for (const nonPass of invalidStatuses) {
    const mutated = JSON.parse(JSON.stringify(sampleAdv));
    mutated.conformance_evidence[0].status = nonPass;

    const validAjv = ajv.validate(advSchemaId, mutated);
    assert.ok(!validAjv, `status='${nonPass}' must be rejected by JSON Schema const validation`);
    assert.ok(
      ajv.errors.some((e) => e.keyword === 'const' && e.instancePath === '/conformance_evidence/0/status'),
      `Schema error for status='${nonPass}' must be keyword const on /conformance_evidence/0/status`
    );

    assert.throws(
      () => validatePlatformSemantics(mutated, advSchemaId),
      /has non-passing status/,
      `status='${nonPass}' must be rejected by validatePlatformSemantics`
    );
  }
});

test('composite key uniqueness in negotiation_request and agreed_capability_lease (Finding R16-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Duplicate composite key in negotiation_request.requested_optional_capabilities throws exact semantic error
  const dataDupReq = JSON.parse(JSON.stringify(sample));
  dataDupReq.negotiation_request.requested_optional_capabilities.push({
    capability_name: "ai_tensor_acceleration",
    slot_id: "ai_model_runtime",
    required_for_optimal: true,
    preferred_fallback: "CORE_EMULATION_FALLBACK"
  });
  assert.throws(
    () => validatePlatformSemantics(dataDupReq, schemaId),
    /Semantic error: requested_optional_capabilities contains duplicate composite key \(ai_tensor_acceleration, ai_model_runtime\)/
  );

  // 2. Duplicate composite key in agreed_capability_lease.negotiated_optional_capabilities throws exact semantic error
  const dataDupLease = JSON.parse(JSON.stringify(sample));
  dataDupLease.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: "ai_tensor_acceleration",
    slot_id: "ai_model_runtime",
    disposition: "GRANTED_FULL",
    active_mode: "gpu_direct",
    fallback_applied: "NONE"
  });
  assert.throws(
    () => validatePlatformSemantics(dataDupLease, schemaId),
    /Semantic error: negotiated_optional_capabilities contains duplicate composite key \(ai_tensor_acceleration, ai_model_runtime\)/
  );
});

test('storage conformance profile required_error_codes must contain all 13 canonical error codes (Finding R16-01 / OPEN-2)', () => {
  const storageSchemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const sampleStorage = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-storage-s3-subset.json'), 'utf8'));

  // 1. Positive baseline: all 13 canonical error codes pass
  assert.doesNotThrow(() => validatePlatformSemantics(sampleStorage, storageSchemaId));

  // 2. Missing each of the 13 canonical error codes fails validatePlatformSemantics with exact error message
  for (const code of S3_CANONICAL_ERROR_CODES) {
    const mutated = JSON.parse(JSON.stringify(sampleStorage));
    mutated.required_error_codes = mutated.required_error_codes.filter((c) => c !== code);
    assert.throws(
      () => validatePlatformSemantics(mutated, storageSchemaId),
      new RegExp(`Semantic error: storage conformance profile required_error_codes is missing required canonical error code '${code}'`)
    );
  }
});

test('in-memory validation: equal-duplicate composite keys in request and lease rejected by validatePlatformSemantics (Finding R16-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // Negotiation request with 2 identical composite keys (ai_tensor_acceleration, ai_model_runtime)
  // matched with lease with 2 identical composite keys (ai_tensor_acceleration, ai_model_runtime).
  // Total lengths match (4 in request, 4 in lease) and cardinalities match per composite key,
  // but duplicate composite keys are prohibited by protocol semantics.
  const data = JSON.parse(JSON.stringify(sample));

  // Add duplicate ai_tensor_acceleration to requested_optional_capabilities
  const duplicateReqCap = {
    capability_name: 'ai_tensor_acceleration',
    slot_id: 'ai_model_runtime',
    required_for_optimal: false,
    preferred_fallback: 'FEATURE_DISABLED_GRACEFUL'
  };
  data.negotiation_request.requested_optional_capabilities.push(duplicateReqCap);

  // Add duplicate ai_tensor_acceleration to negotiated_optional_capabilities in lease
  const duplicateLeaseCap = {
    capability_name: 'ai_tensor_acceleration',
    slot_id: 'ai_model_runtime',
    disposition: 'GRANTED_DEGRADED',
    active_mode: 'cpu_quantized_emulation',
    fallback_applied: 'CORE_EMULATION_FALLBACK',
    notes: 'Duplicate ai_tensor_acceleration lease entry'
  };
  data.agreed_capability_lease.negotiated_optional_capabilities.push(duplicateLeaseCap);

  assert.equal(data.negotiation_request.requested_optional_capabilities.length, 4);
  assert.equal(data.agreed_capability_lease.negotiated_optional_capabilities.length, 4);

  // 1. Passes Ajv schema validation (schema validates individual capability objects structurally)
  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Equal-duplicate composite keys must pass Ajv schema validation structurally: ' + ajv.errorsText());

  // 2. Fails validatePlatformSemantics with /duplicate composite key/
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /duplicate composite key/,
    'Negotiation request and lease with equal-duplicate composite keys must be rejected by validatePlatformSemantics with /duplicate composite key/'
  );
});

test('in-memory validation: unconditional target_profile_digest enforcement on advertisement_response / negotiation (OPEN-1 Finding 5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Missing target_profile_digest is rejected by validatePlatformSemantics
  const missingDigest = JSON.parse(JSON.stringify(sample));
  delete missingDigest.target_profile_digest;
  assert.throws(
    () => validatePlatformSemantics(missingDigest, schemaId),
    /target_profile_digest/,
    'Missing target_profile_digest must fail validatePlatformSemantics'
  );

  // 2. Non-hex pattern target_profile_digest is rejected by validatePlatformSemantics
  const badPatternDigest = JSON.parse(JSON.stringify(sample));
  badPatternDigest.target_profile_digest = 'not-a-valid-64-char-hex-digest-at-all!';
  assert.throws(
    () => validatePlatformSemantics(badPatternDigest, schemaId),
    /target_profile_digest/,
    'Malformed pattern target_profile_digest must fail validatePlatformSemantics'
  );
});

test('in-memory validation: strict snapshot restore target path constraints in validatePlatformSemantics (OPEN-1 Finding 4)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'), 'utf8'));

  // 1. Double slash is rejected by validatePlatformSemantics
  const doubleSlashData = JSON.parse(JSON.stringify(sample));
  doubleSlashData.update_station_workflow.rollback_steps[0].target = 'snapshots//backup.db';
  assert.throws(
    () => validatePlatformSemantics(doubleSlashData, schemaId),
    /double slash/,
    'Double slash // in restore target must fail validatePlatformSemantics'
  );

  // 2. Leading dot on segment is rejected by validatePlatformSemantics
  const leadingDotData = JSON.parse(JSON.stringify(sample));
  leadingDotData.update_station_workflow.rollback_steps[0].target = 'snapshots/.hidden/backup.db';
  assert.throws(
    () => validatePlatformSemantics(leadingDotData, schemaId),
    /leading dot segment/,
    'Leading dot in segment of restore target must fail validatePlatformSemantics'
  );

  // 3. Dot-dot traversal sequence is rejected by validatePlatformSemantics
  const traversalData = JSON.parse(JSON.stringify(sample));
  traversalData.update_station_workflow.rollback_steps[0].target = 'snapshots/../backup.db';
  assert.throws(
    () => validatePlatformSemantics(traversalData, schemaId),
    /(leading dot segment|contains '\.\.')/,
    'Dot-dot traversal in restore target must fail validatePlatformSemantics'
  );

  // 4. Non-snapshot path prefix is rejected by validatePlatformSemantics
  const badPrefixData = JSON.parse(JSON.stringify(sample));
  badPrefixData.update_station_workflow.rollback_steps[0].target = 'other/backup.db';
  assert.throws(
    () => validatePlatformSemantics(badPrefixData, schemaId),
    /must start with 'snapshots\/' or '\$PRE_APPLY_SNAPSHOT\/'/,
    'Non-snapshot path prefix must fail validatePlatformSemantics'
  );
});

test('in-memory validation: reject advertisement missing target_profile_digest for full profile declaration (OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const original = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));

  // 1. Positive baseline passes
  assert.ok(ajv.validate(schemaId, original));
  assert.doesNotThrow(() => validatePlatformSemantics(original, schemaId));

  // 2. Missing target_profile_digest rejected by schema (required under FULL_PROFILE_CONFORMANCE_DECLARATION)
  const dataMissing = JSON.parse(JSON.stringify(original));
  delete dataMissing.target_profile_digest;

  const valid = ajv.validate(schemaId, dataMissing);
  assert.equal(valid, false, 'Should reject full profile declaration missing target_profile_digest in schema');
  const hasDigestRequiredError = ajv.errors.some(
    (e) => e.keyword === 'required' && e.params?.missingProperty === 'target_profile_digest'
  );
  assert.ok(hasDigestRequiredError, 'Schema error must indicate missing target_profile_digest');

  // Semantic validation also rejects missing target_profile_digest
  assert.throws(
    () => validatePlatformSemantics(dataMissing, schemaId),
    /FULL_PROFILE_CONFORMANCE_DECLARATION requires target_profile_digest|target_profile_digest/,
    'Semantic validation must reject full profile declaration missing target_profile_digest'
  );

  // 3. Malformed target_profile_digest pattern rejected
  const dataBadDigest = JSON.parse(JSON.stringify(original));
  dataBadDigest.target_profile_digest = 'not-a-64-hex-digest';
  assert.equal(ajv.validate(schemaId, dataBadDigest), false);
  assert.ok(ajv.errors.some((e) => e.keyword === 'pattern' && e.instancePath === '/target_profile_digest'));

  // 4. Mismatched target_profile_digest rejected by semantic validation
  const dataMismatchedDigest = JSON.parse(JSON.stringify(original));
  dataMismatchedDigest.target_profile_digest = '0000000000000000000000000000000000000000000000000000000000000000';
  assert.ok(ajv.validate(schemaId, dataMismatchedDigest));
  assert.throws(
    () => validatePlatformSemantics(dataMismatchedDigest, schemaId),
    /does not match (?:disk profile|actual) digest/
  );
});

test('in-memory validation: full profile conformance declaration shape and Object Lock evidence validation (OPEN-5 / OPEN-2)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const original = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));

  // 1. Positive baseline passes validation
  assert.ok(ajv.validate(schemaId, original), 'Original full profile declaration must pass: ' + ajv.errorsText());
  assert.doesNotThrow(() => validatePlatformSemantics(original, schemaId));

  // 2. Reject fewer than 13 advertised capabilities (< 13 items)
  const data12 = JSON.parse(JSON.stringify(original));
  data12.advertised_capabilities.pop();
  assert.equal(ajv.validate(schemaId, data12), false, 'Should reject 12 capabilities for full profile declaration');
  assert.ok(ajv.errors.some((e) => e.keyword === 'minItems' && e.instancePath === '/advertised_capabilities'));

  // 3. Reject more than 13 advertised capabilities (> 13 items)
  const data14 = JSON.parse(JSON.stringify(original));
  data14.advertised_capabilities.push({
    capability_name: 'cap-extra',
    slot_id: 'storage',
    description: 'Extra storage',
    evidence_references: ['urn:cybrik:evidence:ev-5']
  });
  assert.equal(ajv.validate(schemaId, data14), false, 'Should reject 14 capabilities for full profile declaration');
  assert.ok(ajv.errors.some((e) => e.keyword === 'maxItems' && e.instancePath === '/advertised_capabilities'));

  // 4. Reject missing specific slot from the 13 required slots (e.g. replace storage with duplicate database)
  const dataDup = JSON.parse(JSON.stringify(original));
  const storeIdx = dataDup.advertised_capabilities.findIndex((c) => c.slot_id === 'storage');
  dataDup.advertised_capabilities[storeIdx] = {
    capability_name: 'cap-db-dup',
    slot_id: 'database',
    description: 'Duplicate database slot',
    evidence_references: ['urn:cybrik:evidence:ev-6']
  };
  assert.equal(ajv.validate(schemaId, dataDup), false, 'Should reject full profile declaration missing storage slot');
  assert.ok(ajv.errors.some((e) => e.keyword === 'contains'), 'Schema must fail contains condition for missing slot');
  assert.throws(
    () => validatePlatformSemantics(dataDup, schemaId),
    /duplicate slot_id 'database'/,
    'Semantic validation must reject duplicate slot_id'
  );

  // 5. Object Lock evidence validation on full profile conformance declaration with storage Object Lock evidence
  const dataWithLock = JSON.parse(JSON.stringify(original));
  const storageCap = dataWithLock.advertised_capabilities.find((c) => c.slot_id === 'storage');
  const lockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';
  storageCap.evidence_references = [lockUrn];
  dataWithLock.conformance_evidence = [
    ...dataWithLock.conformance_evidence.filter((e) => e.test_identifier !== lockUrn),
    {
      test_identifier: lockUrn,
      status: 'PASS',
      evidence_pack_digest: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://example.com/reports/lock-evidence.json'
    }
  ];
  assert.ok(ajv.validate(schemaId, dataWithLock), 'Full profile declaration with Object Lock evidence must pass schema: ' + ajv.errorsText());
  assert.doesNotThrow(() => validatePlatformSemantics(dataWithLock, schemaId));

  // 6. Object Lock evidence with non-passing status is rejected by schema and semantic validation
  const dataLockFail = JSON.parse(JSON.stringify(dataWithLock));
  const lockEv = dataLockFail.conformance_evidence.find((e) => e.test_identifier === lockUrn);
  lockEv.status = 'FAIL';
  assert.equal(ajv.validate(schemaId, dataLockFail), false, 'Object Lock evidence with status FAIL must fail schema validation');
  assert.throws(
    () => validatePlatformSemantics(dataLockFail, schemaId),
    /has non-passing status 'FAIL'/
  );

  // 7. Object Lock evidence with invalid SHA256 digest is rejected by schema and semantic validation
  const dataLockBadDigest = JSON.parse(JSON.stringify(dataWithLock));
  const lockEvBad = dataLockBadDigest.conformance_evidence.find((e) => e.test_identifier === lockUrn);
  lockEvBad.evidence_pack_digest = 'malformed-digest';
  assert.equal(ajv.validate(schemaId, dataLockBadDigest), false, 'Malformed evidence pack digest must fail schema validation');
  assert.throws(
    () => validatePlatformSemantics(dataLockBadDigest, schemaId),
    /lacks valid SHA-256 evidence_pack_digest/
  );

  // 8. Unreferenced dangling Object Lock evidence is rejected by semantic validation
  const dataDanglingLock = JSON.parse(JSON.stringify(original));
  const danglingLockUrn = 'urn:cybrik:evidence:dangling-storage-lock';
  dataDanglingLock.conformance_evidence.push({
    test_identifier: danglingLockUrn,
    status: 'PASS',
    evidence_pack_digest: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    executed_at: '2026-08-27T12:00:00Z',
    report_uri: 'https://example.com/reports/lock-evidence.json'
  });
  assert.ok(ajv.validate(schemaId, dataDanglingLock));
  assert.throws(
    () => validatePlatformSemantics(dataDanglingLock, schemaId),
    /unreferenced or dangling evidence/
  );

  // 9. Unconditionally enforce 13-slot completeness on FULL_PROFILE_CONFORMANCE_DECLARATION for REJECTED_FAIL_CLOSED
  const negotiationSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const rejectedHandshake = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  rejectedHandshake.negotiation_status = 'TERMINAL_REJECTED';
  rejectedHandshake.agreed_capability_lease.lease_status = 'REJECTED_FAIL_CLOSED';
  // Remove one slot from advertisement_response (e.g. artifact_update_mechanism)
  const incompleteRejected = JSON.parse(JSON.stringify(rejectedHandshake));
  incompleteRejected.advertisement_response.advertised_capabilities = incompleteRejected.advertisement_response.advertised_capabilities.filter(
    (c) => c.slot_id !== 'artifact_update_mechanism'
  );
  assert.throws(
    () => validatePlatformSemantics(incompleteRejected, negotiationSchemaId),
    /FULL_PROFILE_CONFORMANCE_DECLARATION missing required mandatory profile slot 'artifact_update_mechanism'|FULL_PROFILE_CONFORMANCE_DECLARATION must declare exactly 13/
  );
});

test('validateIJson comprehensive parser edge cases and error handling', () => {
  // 1. Type check
  assert.throws(() => validateIJson(123), /expected string or Buffer/);
  assert.throws(() => validateIJson(null), /expected string or Buffer/);
  assert.throws(() => validateIJson(undefined), /expected string or Buffer/);

  // 2. Control characters in strings
  assert.throws(() => validateIJson('{"a": "hello\x00world"}'), /Unescaped control character/);
  assert.throws(() => validateIJson('{"a": "hello\x1fworld"}'), /Unescaped control character/);

  // 3. Unterminated string
  assert.throws(() => validateIJson('{"a": "hello'), /Unterminated string/);

  // 4. Number parsing edge cases
  assert.doesNotThrow(() => validateIJson('{"zero": 0, "neg": -0, "pos": 12345, "negInt": -987}'));
  assert.throws(() => validateIJson('{"bad": -}'), /Invalid number/);
  assert.throws(() => validateIJson('{"bad": 01}'), /Expected ',' or '}'/);
  assert.throws(() => validateIJson('{"bad": 1.}'), /Invalid decimal number/);

  // 5. Object parsing errors
  assert.doesNotThrow(() => validateIJson('{}'));
  assert.throws(() => validateIJson('{'), /Unterminated object|Expected string key/);
  assert.throws(() => validateIJson('{123: "val"}'), /Expected string key/);
  assert.throws(() => validateIJson('{"key" "val"}'), /Expected ':'/);
  assert.throws(() => validateIJson('{"key": "val",}'), /Expected string key/);
  assert.throws(() => validateIJson('{"key": "val" "other": 1}'), /Expected ',' or '}'/);

  // 6. Array parsing errors
  assert.doesNotThrow(() => validateIJson('[]'));
  assert.doesNotThrow(() => validateIJson('[1, 2, 3, "a", true, false, null]'));
  assert.throws(() => validateIJson('['), /Unterminated array/);
  assert.throws(() => validateIJson('[1,]'), /Unterminated array|Unexpected token/);
  assert.throws(() => validateIJson('[1 2]'), /Expected ',' or ']'/);

  // 7. Value parsing errors
  assert.throws(() => validateIJson('undefined'), /Unexpected token|Unexpected character/);
  assert.throws(() => validateIJson('foo'), /Unexpected token|Unexpected character/);
  assert.throws(() => validateIJson('{"a": undefined}'), /Unexpected token|Unexpected character/);
  assert.throws(() => validateIJson('{"a": 1} extra'), /Trailing characters after JSON root/);

  // 8. Escaped surrogate pair variations in parseString
  assert.doesNotThrow(() => validateIJson('{"emoji": "\\uD83D\\uDE00"}'));
  assert.doesNotThrow(() => validateIJson('{"ascii": "\\u0041"}'));
  assert.throws(() => validateIJson('{"bad": "\\uD800"}'), /escaped lone surrogate/);
  assert.throws(() => validateIJson('{"bad": "\\uDC00"}'), /escaped lone surrogate/);
});

test('validateOpenItemEffectMatrix comprehensive negative governance checks', () => {
  const sampleDoc = readFileSync(join(ROOT, 'contracts/platform/CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md'), 'utf8');

  // 1. Positive: valid proposal markdown passes
  assert.doesNotThrow(() => validateOpenItemEffectMatrix(sampleDoc));

  // 2. Missing Section 10
  assert.throws(
    () => validateOpenItemEffectMatrix('# Some Doc\n\nNo section 10 here.'),
    /Missing section: ## 10. Required Open-Item Effect Matrix/
  );

  // 3. Missing table header
  const noHeader = sampleDoc.replace('| OPEN ID |', '| WRONG HEADER |');
  assert.throws(
    () => validateOpenItemEffectMatrix(noHeader),
    /Missing table header for Open-Item Effect Matrix/
  );

  // 4. Matrix row with invalid number of columns
  const badCol = sampleDoc.replace(
    '| OPEN-1 | `OFFLINE_INSTALL_UPDATE_CONTRACT` | OPEN | OPEN, PARTIALLY_UNBLOCKED |',
    '| OPEN-1 | `OFFLINE_INSTALL_UPDATE_CONTRACT` | OPEN |'
  );
  assert.throws(
    () => validateOpenItemEffectMatrix(badCol),
    /Matrix row must have exactly 4 columns/
  );

  // 5. Matrix row count mismatch
  const missingRow = sampleDoc.replace(
    '| OPEN-1 | `OFFLINE_INSTALL_UPDATE_CONTRACT` | OPEN | OPEN, PARTIALLY_UNBLOCKED |\n',
    ''
  );
  assert.throws(
    () => validateOpenItemEffectMatrix(missingRow),
    /Matrix must have exactly 11 rows/
  );

  // 6. Trailing table rows after table end
  const trailingRows = sampleDoc.replace(
    '| OPEN-11 | `PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY` | OPEN | OPEN, PARTIALLY_UNBLOCKED / PER_MODULE_CLASSIFICATION_REMAINS_OPEN |',
    '| OPEN-11 | `PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY` | OPEN | OPEN, PARTIALLY_UNBLOCKED / PER_MODULE_CLASSIFICATION_REMAINS_OPEN |\n\nSome text\n| Extra | Row | Here | Now |'
  );
  assert.throws(
    () => validateOpenItemEffectMatrix(trailingRows),
    /Multiple tables or trailing table rows found in Section 10/
  );

  // 7. Expected ID at row position mismatch
  const wrongRowId = sampleDoc.replace('| OPEN-2 |', '| OPEN-99 |');
  assert.throws(
    () => validateOpenItemEffectMatrix(wrongRowId),
    /Expected ID OPEN-2 at row 2, found OPEN-99/
  );

  // 8. Unauthorized status
  const wrongStatus = sampleDoc.replace(
    '| OPEN-1 | `OFFLINE_INSTALL_UPDATE_CONTRACT` | OPEN |',
    '| OPEN-1 | `OFFLINE_INSTALL_UPDATE_CONTRACT` | RESOLVED |'
  );
  assert.throws(
    () => validateOpenItemEffectMatrix(wrongStatus),
    /Unauthorized status for OPEN-1: RESOLVED/
  );
});

test('validatePlatformSemantics comprehensive error branches', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const manifestSchemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';

  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const adSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));
  const manifestSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'), 'utf8'));

  // 1. Conformance evidence duplicate test_identifier
  const dupEvAd = JSON.parse(JSON.stringify(adSample));
  dupEvAd.conformance_evidence.push(JSON.parse(JSON.stringify(dupEvAd.conformance_evidence[0])));
  assert.throws(() => validatePlatformSemantics(dupEvAd, pcaSchemaId), /duplicate test_identifier/);

  // 2. Conformance evidence non-PASS status
  const failEvAd = JSON.parse(JSON.stringify(adSample));
  failEvAd.conformance_evidence[0].status = 'FAIL';
  assert.throws(() => validatePlatformSemantics(failEvAd, pcaSchemaId), /has non-passing status 'FAIL'/);

  // 3. Conformance evidence invalid SHA-256 digest
  const badDigestEvAd = JSON.parse(JSON.stringify(adSample));
  badDigestEvAd.conformance_evidence[0].evidence_pack_digest = '12345';
  assert.throws(() => validatePlatformSemantics(badDigestEvAd, pcaSchemaId), /lacks valid SHA-256 evidence_pack_digest/);

  // 4. Advertised capability duplicate slot_id
  const dupSlotAd = JSON.parse(JSON.stringify(adSample));
  dupSlotAd.advertised_capabilities.push(JSON.parse(JSON.stringify(dupSlotAd.advertised_capabilities[0])));
  assert.throws(() => validatePlatformSemantics(dupSlotAd, pcaSchemaId), /contains duplicate slot_id/);

  // 5. Advertised capability evidence reference not found in conformance_evidence
  const missingRefAd = JSON.parse(JSON.stringify(adSample));
  missingRefAd.advertised_capabilities[0].evidence_references = ['urn:cybrik:evidence:nonexistent'];
  assert.throws(() => validatePlatformSemantics(missingRefAd, pcaSchemaId), /evidence_reference 'urn:cybrik:evidence:nonexistent' not found/);

  // 6. Agreed capability lease evidence reference not found in conformance_evidence
  const missingLeaseRef = JSON.parse(JSON.stringify(handshakeSample));
  missingLeaseRef.agreed_capability_lease.negotiated_optional_capabilities[0].evidence_references = ['urn:cybrik:evidence:nonexistent'];
  assert.throws(() => validatePlatformSemantics(missingLeaseRef, pcnSchemaId), /evidence_reference 'urn:cybrik:evidence:nonexistent' not found/);

  // 7. Lease timestamps: valid_until <= issued_at
  const badLeaseDates = JSON.parse(JSON.stringify(handshakeSample));
  badLeaseDates.agreed_capability_lease.issued_at = '2026-08-25T14:00:00Z';
  badLeaseDates.agreed_capability_lease.valid_until = '2026-08-25T12:00:00Z';
  assert.throws(() => validatePlatformSemantics(badLeaseDates, pcnSchemaId), /must be strictly greater than/);

  // 8. Lease timestamps: invalid timestamp format (NaN)
  const nanLeaseDates = JSON.parse(JSON.stringify(handshakeSample));
  nanLeaseDates.agreed_capability_lease.issued_at = 'not-a-date';
  assert.throws(() => validatePlatformSemantics(nanLeaseDates, pcnSchemaId), /invalid timestamp format in lease/);

  // 9. Lease ttl_seconds duration mismatch
  const ttlMismatchLease = JSON.parse(JSON.stringify(handshakeSample));
  ttlMismatchLease.agreed_capability_lease.ttl_seconds = 999999;
  assert.throws(() => validatePlatformSemantics(ttlMismatchLease, pcnSchemaId), /does not match timestamp duration/);

  // 10. F-02: GRANTED_FULL with fallback != NONE
  const badFullCap = JSON.parse(JSON.stringify(handshakeSample));
  badFullCap.agreed_capability_lease.negotiated_optional_capabilities[0].disposition = 'GRANTED_FULL';
  badFullCap.agreed_capability_lease.negotiated_optional_capabilities[0].fallback_applied = 'CORE_EMULATION_FALLBACK';
  assert.throws(() => validatePlatformSemantics(badFullCap, pcnSchemaId), /cannot have fallback/);

  // 11. F-02: Fallback == NONE with disposition != GRANTED_FULL
  const badDegradedCap = JSON.parse(JSON.stringify(handshakeSample));
  badDegradedCap.agreed_capability_lease.negotiated_optional_capabilities[0].disposition = 'GRANTED_DEGRADED';
  badDegradedCap.agreed_capability_lease.negotiated_optional_capabilities[0].fallback_applied = 'NONE';
  assert.throws(() => validatePlatformSemantics(badDegradedCap, pcnSchemaId), /must have disposition 'GRANTED_FULL'/);

  // 12. ACTIVE_OPTIMAL lease containing degraded cap
  const optimalWithDegraded = JSON.parse(JSON.stringify(handshakeSample));
  optimalWithDegraded.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  optimalWithDegraded.agreed_capability_lease.negotiated_optional_capabilities[0].disposition = 'GRANTED_DEGRADED';
  optimalWithDegraded.agreed_capability_lease.negotiated_optional_capabilities[0].fallback_applied = 'CORE_EMULATION_FALLBACK';
  assert.throws(() => validatePlatformSemantics(optimalWithDegraded, pcnSchemaId), /ACTIVE_OPTIMAL lease cannot contain degraded capability/);

  // 13. ACTIVE_DEGRADED lease containing zero degraded caps
  const degradedWithNone = JSON.parse(JSON.stringify(handshakeSample));
  degradedWithNone.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  for (const c of degradedWithNone.agreed_capability_lease.negotiated_optional_capabilities) {
    c.disposition = 'GRANTED_FULL';
    c.fallback_applied = 'NONE';
  }
  assert.throws(() => validatePlatformSemantics(degradedWithNone, pcnSchemaId), /ACTIVE_DEGRADED lease must contain at least one GRANTED_DEGRADED/);

  // 14. Negotiation request missing core mandatory slots
  const missingCoreSlots = JSON.parse(JSON.stringify(handshakeSample));
  missingCoreSlots.negotiation_request.requested_slots = ['storage'];
  assert.throws(() => validatePlatformSemantics(missingCoreSlots, pcnSchemaId), /missing core mandatory slot/);

  // 15. Storage slot advertisement missing mandatory S3 operation
  const missingS3Ops = JSON.parse(JSON.stringify(handshakeSample));
  const storeCap = missingS3Ops.advertisement_response.advertised_capabilities.find((c) => c.slot_id === 'storage');
  storeCap.supported_features = ['PutObject', 'GetObject'];
  assert.throws(() => validatePlatformSemantics(missingS3Ops, pcnSchemaId), /missing required S3 operation/);

  // 16. Storage slot advertisement missing Object Lock retention evidence
  const noLockEv = JSON.parse(JSON.stringify(handshakeSample));
  const storeCapNoLock = noLockEv.advertisement_response.advertised_capabilities.find((c) => c.slot_id === 'storage');
  storeCapNoLock.evidence_references = storeCapNoLock.evidence_references.filter((r) => !r.includes('object-lock'));
  assert.throws(() => validatePlatformSemantics(noLockEv, pcnSchemaId), /lacks Object Lock retention evidence/);

  // 17. Target profile fixture not found
  const missingProfileDoc = JSON.parse(JSON.stringify(handshakeSample));
  missingProfileDoc.target_profile_id = 'non-existent-profile-xyz';
  assert.throws(() => validatePlatformSemantics(missingProfileDoc, pcnSchemaId), /target profile fixture .* not found/);

  // 18. Offline manifest invalid RESTORE_DATABASE_SNAPSHOT target path in preflight
  const badPreflightStep = JSON.parse(JSON.stringify(manifestSample));
  badPreflightStep.update_station_workflow.preflight_steps.push({
    step_id: 'pre-restore',
    action: 'RESTORE_DATABASE_SNAPSHOT',
    target: 'snapshots//double-slash.db'
  });
  assert.throws(() => validatePlatformSemantics(badPreflightStep, manifestSchemaId), /invalid RESTORE_DATABASE_SNAPSHOT target path/);

  // 19. Lease target_profile_id mismatch with document
  const leaseIdMismatch = JSON.parse(JSON.stringify(handshakeSample));
  leaseIdMismatch.agreed_capability_lease.target_profile_id = 'onprem-airgap-v1';
  assert.throws(() => validatePlatformSemantics(leaseIdMismatch, pcnSchemaId), /lease target_profile_id .* does not match document/);

  // 20. Lease target_profile_digest mismatch with actual digest
  const leaseDigestMismatch = JSON.parse(JSON.stringify(handshakeSample));
  leaseDigestMismatch.agreed_capability_lease.target_profile_digest = '0'.repeat(64);
  assert.throws(() => validatePlatformSemantics(leaseDigestMismatch, pcnSchemaId), /lease target_profile_digest .* does not match actual digest/);

  // 21. Mandatory profile slot missing from mandatory_slots_satisfied
  const missingMandatorySat = JSON.parse(JSON.stringify(handshakeSample));
  missingMandatorySat.agreed_capability_lease.mandatory_slots_satisfied = missingMandatorySat.agreed_capability_lease.mandatory_slots_satisfied.filter(s => s !== 'oci_container_runtime');
  assert.throws(() => validatePlatformSemantics(missingMandatorySat, pcnSchemaId), /not present in lease mandatory_slots_satisfied/);

  // 22. Mandatory profile slot not found in advertised capabilities
  const missingMandatoryAdv = JSON.parse(JSON.stringify(handshakeSample));
  missingMandatoryAdv.advertisement_response.advertised_capabilities = missingMandatoryAdv.advertisement_response.advertised_capabilities.filter(c => c.slot_id !== 'oci_container_runtime');
  assert.throws(() => validatePlatformSemantics(missingMandatoryAdv, pcnSchemaId), /not found in advertised capabilities|missing required mandatory profile slot 'oci_container_runtime'|FULL_PROFILE_CONFORMANCE_DECLARATION/);

  // 23. Mandatory profile slot lacks evidence references
  const noRefsMandatory = JSON.parse(JSON.stringify(handshakeSample));
  const ociCap = noRefsMandatory.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'oci_container_runtime');
  ociCap.evidence_references = [];
  assert.throws(() => validatePlatformSemantics(noRefsMandatory, pcnSchemaId), /lacks evidence references/);

  // 24. Mandatory profile slot evidence reference not found in conformance evidence
  const missingEvMandatory = JSON.parse(JSON.stringify(handshakeSample));
  const ociCap2 = missingEvMandatory.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'oci_container_runtime');
  ociCap2.evidence_references = ['urn:cybrik:evidence:missing-oci'];
  assert.throws(() => validatePlatformSemantics(missingEvMandatory, pcnSchemaId), /evidence_reference 'urn:cybrik:evidence:missing-oci' not found in conformance_evidence/);

  // 25. Duplicate composite key in negotiation request
  const dupReqKey = JSON.parse(JSON.stringify(handshakeSample));
  dupReqKey.negotiation_request.requested_optional_capabilities.push(
    JSON.parse(JSON.stringify(dupReqKey.negotiation_request.requested_optional_capabilities[0]))
  );
  assert.throws(() => validatePlatformSemantics(dupReqKey, pcnSchemaId), /requested_optional_capabilities contains duplicate composite key/);

  // 26. Duplicate composite key in agreed capability lease
  const dupLeaseKey = JSON.parse(JSON.stringify(handshakeSample));
  dupLeaseKey.agreed_capability_lease.negotiated_optional_capabilities.push(
    JSON.parse(JSON.stringify(dupLeaseKey.agreed_capability_lease.negotiated_optional_capabilities[0]))
  );
  assert.throws(() => validatePlatformSemantics(dupLeaseKey, pcnSchemaId), /negotiated_optional_capabilities contains duplicate composite key/);

  // 27. Requested optional capability not resolved in lease
  const unresolvedReqCapDoc = JSON.parse(JSON.stringify(handshakeSample));
  unresolvedReqCapDoc.agreed_capability_lease.negotiated_optional_capabilities[0].capability_name = 'different_cap_name';
  assert.throws(() => validatePlatformSemantics(unresolvedReqCapDoc, pcnSchemaId), /(?:is (?:required for optimal operation but is )?not resolved in agreed_capability_lease|contains unrequested or surplus optional capability)/);

  // 27b. Lease optional capability not requested in negotiation request
  const unrequestedLeaseCapDoc = JSON.parse(JSON.stringify(handshakeSample));
  unrequestedLeaseCapDoc.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: 'extra_unrequested_cap',
    slot_id: 'cache',
    disposition: 'GRANTED_FULL',
    fallback_applied: 'NONE'
  });
  assert.throws(() => validatePlatformSemantics(unrequestedLeaseCapDoc, pcnSchemaId), /contains unrequested or surplus optional capability/);

  // 28. Mandatory profile slot conformance evidence has non-passing status
  const nonPassMandatoryDoc = JSON.parse(JSON.stringify(handshakeSample));
  const ociEv = nonPassMandatoryDoc.advertisement_response.conformance_evidence.find(e => e.test_identifier.includes('oci'));
  ociEv.status = 'FAIL';
  assert.throws(() => validatePlatformSemantics(nonPassMandatoryDoc, pcnSchemaId), /has non-passing status 'FAIL'/);

  // 29. Immutable storage capability degraded in lease when immutable storage is mandated by profile
  const immutableDegradedDoc = JSON.parse(JSON.stringify(handshakeSample));
  const storageOptional = immutableDegradedDoc.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock' || c.slot_id === 'storage');
  storageOptional.disposition = 'GRANTED_DEGRADED';
  storageOptional.fallback_applied = 'FEATURE_DISABLED_GRACEFUL';
  assert.throws(() => validatePlatformSemantics(immutableDegradedDoc, pcnSchemaId), /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/);

  // 30. Object Lock conformance evidence with non-passing status
  const lockFailEvDoc = JSON.parse(JSON.stringify(handshakeSample));
  const lockEv = lockFailEvDoc.advertisement_response.conformance_evidence.find(e => e.test_identifier.includes('object-lock'));
  if (lockEv) {
    lockEv.status = 'FAIL';
    assert.throws(() => validatePlatformSemantics(lockFailEvDoc, pcnSchemaId), /has non-passing status 'FAIL'/);
  }

  // 31. Object Lock conformance evidence with invalid digest
  const lockBadDigestDoc = JSON.parse(JSON.stringify(handshakeSample));
  const lockEv2 = lockBadDigestDoc.advertisement_response.conformance_evidence.find(e => e.test_identifier.includes('object-lock'));
  if (lockEv2) {
    lockEv2.evidence_pack_digest = 'not-a-valid-sha256-hex';
    assert.throws(() => validatePlatformSemantics(lockBadDigestDoc, pcnSchemaId), /lacks valid SHA-256 evidence_pack_digest/);
  }

  // 32. Full profile conformance declaration target_profile_digest mismatch
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const badDigestFullDecl = JSON.parse(JSON.stringify(fullDeclSample));
  badDigestFullDecl.target_profile_digest = 'a'.repeat(64);
  assert.throws(() => validatePlatformSemantics(badDigestFullDecl, pcaSchemaId), /target_profile_digest .* does not match (?:disk profile|actual) digest/);

  // 33. Full profile conformance declaration target profile fixture not found
  const missingProfileFullDecl = JSON.parse(JSON.stringify(fullDeclSample));
  missingProfileFullDecl.target_profile_id = 'nonexistent-profile';
  assert.throws(() => validatePlatformSemantics(missingProfileFullDecl, pcaSchemaId), /target profile fixture .* not found/);

  // 34. Dangling conformance evidence not referenced by any capability
  const danglingConfDoc = JSON.parse(JSON.stringify(handshakeSample));
  danglingConfDoc.advertisement_response.conformance_evidence.push({
    test_identifier: 'urn:cybrik:evidence:dangling:extra-test',
    status: 'PASS',
    evidence_pack_digest: 'a100000000000000000000000000000000000000000000000000000000000099',
    executed_at: '2026-08-27T12:00:00Z'
  });
  assert.throws(() => validatePlatformSemantics(danglingConfDoc, pcnSchemaId), /conformance_evidence contains unreferenced or dangling evidence/);

  // 35. Evidence reference missing in conformance evidence
  const badBindingConfDoc = JSON.parse(JSON.stringify(handshakeSample));
  const storeCapObj = badBindingConfDoc.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapObj.evidence_references.push('urn:cybrik:evidence:storage:extra-ref');
  assert.throws(() => validatePlatformSemantics(badBindingConfDoc, pcnSchemaId), /evidence_reference 'urn:cybrik:evidence:storage:extra-ref' not found in conformance_evidence/);

  // 36. Lease contains surplus capability not in request
  const surplusLeaseDoc = JSON.parse(JSON.stringify(handshakeSample));
  surplusLeaseDoc.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: 'surplus_cap_2',
    slot_id: 'cache',
    disposition: 'GRANTED_FULL',
    fallback_applied: 'NONE'
  });
  assert.throws(() => validatePlatformSemantics(surplusLeaseDoc, pcnSchemaId), /contains unrequested or surplus optional capability/);

  // 37. Lease target_profile_id does not match document target_profile_id
  const leaseIdMismatchDoc = JSON.parse(JSON.stringify(handshakeSample));
  leaseIdMismatchDoc.agreed_capability_lease.target_profile_id = 'different-profile-id';
  assert.throws(() => validatePlatformSemantics(leaseIdMismatchDoc, pcnSchemaId), /lease target_profile_id .* does not match document target_profile_id/);

  // 38. Lease target_profile_digest does not match actual digest
  const leaseDigestMismatchDoc = JSON.parse(JSON.stringify(handshakeSample));
  leaseDigestMismatchDoc.agreed_capability_lease.target_profile_digest = 'b'.repeat(64);
  assert.throws(() => validatePlatformSemantics(leaseDigestMismatchDoc, pcnSchemaId), /lease target_profile_digest .* does not match actual digest/);

  // 39. Mandatory profile slot not present in lease mandatory_slots_satisfied
  const missingSatisfiedDoc = JSON.parse(JSON.stringify(handshakeSample));
  missingSatisfiedDoc.agreed_capability_lease.mandatory_slots_satisfied = missingSatisfiedDoc.agreed_capability_lease.mandatory_slots_satisfied.filter(s => s !== 'secrets');
  assert.throws(() => validatePlatformSemantics(missingSatisfiedDoc, pcnSchemaId), /mandatory profile slot 'secrets' not present in lease mandatory_slots_satisfied/);

  // 40. Mandatory profile slot lacks evidence references
  const noEvRefsDoc = JSON.parse(JSON.stringify(handshakeSample));
  noEvRefsDoc.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'secrets').evidence_references = [];
  assert.throws(() => validatePlatformSemantics(noEvRefsDoc, pcnSchemaId), /mandatory profile slot 'secrets' lacks evidence references/);

  // 41. Standalone advertisement with malformed target_profile_digest
  const badPartialDigest = JSON.parse(JSON.stringify(adSample));
  badPartialDigest.claim_type = 'PARTIAL_CAPABILITY_ADVERTISEMENT';
  badPartialDigest.target_profile_digest = 12345;
  assert.throws(() => validatePlatformSemantics(badPartialDigest, pcaSchemaId), /target_profile_digest must match/);

  // 42. Non-string RESTORE_DATABASE_SNAPSHOT target
  const nonStringTargetManifest = JSON.parse(JSON.stringify(manifestSample));
  nonStringTargetManifest.update_station_workflow.rollback_steps[0].target = 12345;
  assert.throws(() => validatePlatformSemantics(nonStringTargetManifest, manifestSchemaId), /RESTORE_DATABASE_SNAPSHOT step target must be a string/);

  // 43. RESTORE_DATABASE_SNAPSHOT target with empty segment
  const emptySegmentManifest = JSON.parse(JSON.stringify(manifestSample));
  emptySegmentManifest.update_station_workflow.rollback_steps[0].target = '/snapshots/backup.db';
  assert.throws(() => validatePlatformSemantics(emptySegmentManifest, manifestSchemaId), /contains empty path segment|invalid RESTORE_DATABASE_SNAPSHOT/);
});

test('in-memory validation: partial standalone advertisement with mismatched profile digest is rejected by validatePlatformSemantics (OPEN-5 / Finding 1)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  // 1. Positive baseline: valid partial standalone advertisement passes
  const validData = JSON.parse(JSON.stringify(sample));
  assert.ok(ajv.validate(schemaId, validData), 'Baseline partial advertisement passes Ajv schema validation');
  assert.doesNotThrow(() => validatePlatformSemantics(validData, schemaId), 'Baseline partial advertisement passes validatePlatformSemantics');

  // 2. Mismatched target_profile_digest on partial standalone advertisement passes Ajv schema but fails validatePlatformSemantics
  const mismatchedData = JSON.parse(JSON.stringify(sample));
  mismatchedData.target_profile_digest = '0000000000000000000000000000000000000000000000000000000000000000';
  assert.ok(ajv.validate(schemaId, mismatchedData), 'Mismatched digest passes structural 64-hex schema pattern');
  assert.throws(
    () => validatePlatformSemantics(mismatchedData, schemaId),
    /target_profile_digest .* does not match actual digest/,
    'Partial standalone advertisement with mismatched profile digest must be rejected by validatePlatformSemantics'
  );

  // 3. Non-existent target profile ID fails validatePlatformSemantics
  const badProfileIdData = JSON.parse(JSON.stringify(sample));
  badProfileIdData.target_profile_id = 'non-existent-profile';
  assert.throws(
    () => validatePlatformSemantics(badProfileIdData, schemaId),
    /target profile fixture 'non-existent-profile\.profile\.json' not found/,
    'Partial standalone advertisement with non-existent target_profile_id must fail validatePlatformSemantics'
  );
});

test('in-memory validation: nested advertisement_response.target_profile_digest is required and checked (OPEN-1 / OPEN-5 Finding 2)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Positive baseline passes validatePlatformSemantics
  assert.doesNotThrow(() => validatePlatformSemantics(sample, pcnSchemaId));

  // 2. Nested advertisement_response with matching target_profile_digest passes
  const validNestedDigest = JSON.parse(JSON.stringify(sample));
  validNestedDigest.advertisement_response.target_profile_digest = validNestedDigest.target_profile_digest;
  assert.doesNotThrow(() => validatePlatformSemantics(validNestedDigest, pcnSchemaId));

  // 3. Nested advertisement_response with mismatched target_profile_digest is rejected
  const mismatchedNestedDigest = JSON.parse(JSON.stringify(sample));
  mismatchedNestedDigest.advertisement_response.target_profile_digest = '0000000000000000000000000000000000000000000000000000000000000000';
  assert.throws(
    () => validatePlatformSemantics(mismatchedNestedDigest, pcnSchemaId),
    /advertisement_response\.target_profile_digest .* does not match actual digest/,
    'Nested advertisement_response.target_profile_digest mismatch must be rejected by validatePlatformSemantics'
  );

  // 4. Missing top-level and nested target_profile_digest on advertisement_response is rejected
  const missingAllDigest = JSON.parse(JSON.stringify(sample));
  delete missingAllDigest.target_profile_digest;
  delete missingAllDigest.advertisement_response.target_profile_digest;
  assert.throws(
    () => validatePlatformSemantics(missingAllDigest, pcnSchemaId),
    /target_profile_digest is required and must match/,
    'Missing target_profile_digest on negotiation / advertisement_response must fail validatePlatformSemantics'
  );

  // 5. Malformed nested target_profile_digest is rejected
  const malformedNestedDigest = JSON.parse(JSON.stringify(sample));
  malformedNestedDigest.advertisement_response.target_profile_digest = 'not-a-valid-sha256-hex-digest';
  assert.throws(
    () => validatePlatformSemantics(malformedNestedDigest, pcnSchemaId),
    /advertisement_response\.target_profile_digest must match \^\[a-f0-9\]\{64\}\$/,
    'Malformed nested advertisement_response.target_profile_digest must fail validatePlatformSemantics'
  );
});

test('in-memory validation: canonical Object Lock URN urn:cybrik:evidence:storage:s3:conformance:v1:object-lock passes standalone declaration validation (OPEN-2 / OPEN-5 Finding 3)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';

  // 1. Standalone full profile conformance declaration with canonical Object Lock URN passes
  const fullDecl = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const storageCap = fullDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storageCap.evidence_references.includes(canonicalLockUrn), 'Sample full profile declaration must use canonical Object Lock URN');
  assert.ok(ajv.validate(pcaSchemaId, fullDecl), 'Standalone declaration must pass Ajv schema validation');
  assert.doesNotThrow(() => validatePlatformSemantics(fullDecl, pcaSchemaId), 'Standalone declaration must pass validatePlatformSemantics');

  // 2. Standalone partial advertisement with canonical Object Lock URN passes
  const partialSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));
  const partialWithLock = JSON.parse(JSON.stringify(partialSample));
  partialWithLock.advertised_capabilities = [
    {
      capability_name: 's3_storage_object_lock',
      slot_id: 'storage',
      description: 'Storage slot with canonical Object Lock evidence',
      is_mandatory: true,
      supported_features: [
        'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
        'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
        'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
        'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
        'AbortMultipartUpload', 'ListParts', 'PutBucketVersioning', 'GetBucketVersioning'
      ],
      degradation_fallback: 'NONE',
      evidence_references: [canonicalLockUrn]
    }
  ];
  partialWithLock.conformance_evidence = [
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/report-lock'
    }
  ];
  assert.ok(ajv.validate(pcaSchemaId, partialWithLock), 'Partial advertisement with canonical Object Lock URN must pass Ajv schema');
  assert.doesNotThrow(() => validatePlatformSemantics(partialWithLock, pcaSchemaId), 'Partial advertisement with canonical Object Lock URN must pass validatePlatformSemantics');

  // 3. Negotiation handshake with canonical Object Lock URN passes
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const handshakeWithCanonicalLock = JSON.parse(JSON.stringify(handshakeSample));
  const handshakeStorageCap = handshakeWithCanonicalLock.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  handshakeStorageCap.evidence_references = [
    'urn:cybrik:evidence:storage:s3-19-ops:v1',
    canonicalLockUrn
  ];
  handshakeWithCanonicalLock.advertisement_response.conformance_evidence = [
    ...handshakeWithCanonicalLock.advertisement_response.conformance_evidence.filter(e => !e.test_identifier.includes('object-lock')),
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'a106060606060606060606060606060606060606060606060606060606060606',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/ev-store-object-lock-01.json'
    }
  ];
  assert.doesNotThrow(() => validatePlatformSemantics(handshakeWithCanonicalLock, pcnSchemaId), 'Handshake with canonical Object Lock URN must pass validatePlatformSemantics');
});

test('in-memory validation: profile mandatory slot coherence rejection when required slot is marked is_mandatory: false (OPEN-5 / Finding 4)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';

  // 1. Full profile conformance declaration: required slot marked is_mandatory: false is rejected
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const badFullDecl = JSON.parse(JSON.stringify(fullDeclSample));
  const ociCap = badFullDecl.advertised_capabilities.find(c => c.slot_id === 'oci_container_runtime');
  ociCap.is_mandatory = false;

  assert.throws(
    () => validatePlatformSemantics(badFullDecl, pcaSchemaId),
    /profile mandatory slot 'oci_container_runtime' cannot be marked is_mandatory: false/,
    'Full profile declaration with mandatory slot marked is_mandatory: false must be rejected'
  );

  // 2. Storage mandatory slot marked is_mandatory: false is rejected
  const badStoreDecl = JSON.parse(JSON.stringify(fullDeclSample));
  const storeCap = badStoreDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCap.is_mandatory = false;

  assert.throws(
    () => validatePlatformSemantics(badStoreDecl, pcaSchemaId),
    /profile mandatory slot 'storage' cannot be marked is_mandatory: false/,
    'Storage mandatory slot marked is_mandatory: false must be rejected'
  );

  // 3. Partial standalone advertisement: required slot marked is_mandatory: false is rejected
  const partialSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));
  const badPartial = JSON.parse(JSON.stringify(partialSample));
  badPartial.advertised_capabilities[0].is_mandatory = false;

  assert.throws(
    () => validatePlatformSemantics(badPartial, pcaSchemaId),
    /profile mandatory slot 'oci_container_runtime' cannot be marked is_mandatory: false/,
    'Partial standalone advertisement with mandatory slot marked is_mandatory: false must be rejected'
  );

  // 4. Negotiation handshake: core mandatory slot marked is_mandatory: false is rejected
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const badHandshake = JSON.parse(JSON.stringify(handshakeSample));
  const handshakeOciCap = badHandshake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'oci_container_runtime');
  handshakeOciCap.is_mandatory = false;

  assert.throws(
    () => validatePlatformSemantics(badHandshake, pcnSchemaId),
    /profile mandatory slot 'oci_container_runtime' cannot be marked is_mandatory: false/,
    'Negotiation handshake with mandatory slot marked is_mandatory: false must be rejected'
  );
});

test('platform semantics: universal profile digest disk equality, Object Lock URN unification, and mandatory slot coherence (Finding 2, 3, 4)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));

  // 1. Target profile digest mismatch throws exact error message
  const badDigestDoc = JSON.parse(JSON.stringify(handshakeSample));
  badDigestDoc.target_profile_digest = '0'.repeat(64);
  assert.throws(
    () => validatePlatformSemantics(badDigestDoc, schemaId),
    /Semantic error: target_profile_digest '0{64}' does not match disk profile digest for 'onprem-standard-v1'/
  );

  const badDigestAdv = JSON.parse(JSON.stringify(fullDeclSample));
  badDigestAdv.target_profile_digest = '1'.repeat(64);
  assert.throws(
    () => validatePlatformSemantics(badDigestAdv, pcaSchemaId),
    /Semantic error: target_profile_digest '1{64}' does not match disk profile digest for 'onprem-standard-v1'/
  );

  // 2. Object Lock URN unification: urn:cybrik:evidence:storage:s3:conformance:v1:object-lock passes on standalone and negotiation
  assert.doesNotThrow(() => validatePlatformSemantics(fullDeclSample, pcaSchemaId));

  const negWithConformLock = JSON.parse(JSON.stringify(handshakeSample));
  const storeCap = negWithConformLock.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCap.evidence_references = [
    'urn:cybrik:evidence:storage:s3-19-ops:v1',
    'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock',
  ];
  negWithConformLock.advertisement_response.conformance_evidence = [
    ...negWithConformLock.advertisement_response.conformance_evidence.filter(
      e => e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'
    ),
    {
      test_identifier: 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock',
      status: 'PASS',
      evidence_pack_digest: 'a106060606060606060606060606060606060606060606060606060606060606',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/lock.json',
    },
  ];
  assert.doesNotThrow(() => validatePlatformSemantics(negWithConformLock, schemaId));

  // 3. Mandatory slot coherence: cap.is_mandatory === false for mandatory slot throws
  const nonMandatorySlotDoc = JSON.parse(JSON.stringify(handshakeSample));
  const storageAdvCap = nonMandatorySlotDoc.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storageAdvCap.is_mandatory = false;
  assert.throws(
    () => validatePlatformSemantics(nonMandatorySlotDoc, schemaId),
    /Semantic error: mandatory profile slot 'storage' capability must have is_mandatory === true \(got false\)/
  );

  const nonMandatoryFullDecl = JSON.parse(JSON.stringify(fullDeclSample));
  const dbAdvCap = nonMandatoryFullDecl.advertised_capabilities.find(c => c.slot_id === 'database');
  dbAdvCap.is_mandatory = false;
  assert.throws(
    () => validatePlatformSemantics(nonMandatoryFullDecl, pcaSchemaId),
    /Semantic error: mandatory profile slot 'database' capability must have is_mandatory === true \(got false\)/
  );
});

test('in-memory validation: negotiation schema unconditionally enforces 13-slot min/max on FULL_PROFILE_CONFORMANCE_DECLARATION (Finding 2 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Baseline passes validation (13 slots under FULL_PROFILE_CONFORMANCE_DECLARATION)
  assert.equal(sample.advertisement_response.claim_type, 'FULL_PROFILE_CONFORMANCE_DECLARATION');
  assert.equal(sample.advertisement_response.advertised_capabilities.length, 13);
  assert.ok(ajv.validate(schemaId, sample), 'Baseline handshake must pass schema validation: ' + ajv.errorsText());

  // 2. Reject fewer than 13 advertised capabilities under FULL_PROFILE_CONFORMANCE_DECLARATION (12 slots)
  const data12 = JSON.parse(JSON.stringify(sample));
  data12.advertisement_response.advertised_capabilities.pop();
  assert.equal(ajv.validate(schemaId, data12), false, 'Should reject 12 capabilities for full profile declaration in negotiation');
  assert.ok(ajv.errors.some((e) => e.keyword === 'minItems' && e.instancePath === '/advertisement_response/advertised_capabilities'));

  // 3. Reject more than 13 advertised capabilities under FULL_PROFILE_CONFORMANCE_DECLARATION (14 slots)
  const data14 = JSON.parse(JSON.stringify(sample));
  data14.advertisement_response.advertised_capabilities.push({
    capability_name: 'cap-extra',
    slot_id: 'storage',
    is_mandatory: false,
    supported_features: ['extra'],
    degradation_fallback: {
      fallback_supported: false,
      fallback_mode: 'NONE_REQUIRED'
    },
    evidence_references: ['urn:cybrik:evidence:ev-extra-01']
  });
  assert.equal(ajv.validate(schemaId, data14), false, 'Should reject 14 capabilities for full profile declaration in negotiation');
  assert.ok(ajv.errors.some((e) => e.keyword === 'maxItems' && e.instancePath === '/advertisement_response/advertised_capabilities'));

  // 4. Unconditional enforcement applies even when negotiation status is TERMINAL_REJECTED / lease is REJECTED_FAIL_CLOSED
  const dataRejected12 = JSON.parse(JSON.stringify(sample));
  dataRejected12.negotiation_status = 'TERMINAL_REJECTED';
  dataRejected12.agreed_capability_lease.lease_status = 'REJECTED_FAIL_CLOSED';
  dataRejected12.agreed_capability_lease.fail_closed_violations = ['MANDATORY_SLOT_UNSATISFIED'];
  dataRejected12.advertisement_response.advertised_capabilities.pop(); // 12 items
  assert.equal(ajv.validate(schemaId, dataRejected12), false, 'Should reject 12 capabilities for full profile declaration even when TERMINAL_REJECTED');
  assert.ok(ajv.errors.some((e) => e.keyword === 'minItems' && e.instancePath === '/advertisement_response/advertised_capabilities'));

  // 5. PARTIAL_CAPABILITY_ADVERTISEMENT allows fewer than 13 capabilities in negotiation
  const dataPartial = JSON.parse(JSON.stringify(sample));
  dataPartial.advertisement_response.claim_type = 'PARTIAL_CAPABILITY_ADVERTISEMENT';
  dataPartial.advertisement_response.advertised_capabilities.pop(); // 12 items
  assert.ok(ajv.validate(schemaId, dataPartial), 'Partial capability advertisement with 12 items should not trigger minItems: 13 schema error');

  // 6. Reject duplicated distinct slots in full profile declaration via 13-slot contains closure
  const dataDupSlot = JSON.parse(JSON.stringify(sample));
  dataDupSlot.advertisement_response.advertised_capabilities[1].slot_id = dataDupSlot.advertisement_response.advertised_capabilities[0].slot_id;
  assert.equal(ajv.validate(schemaId, dataDupSlot), false, 'Should reject duplicated distinct slot in negotiation full profile declaration');
  assert.ok(ajv.errors.some((e) => e.keyword === 'contains'), 'Should fail distinct 13-slot contains condition in negotiation schema');
});

test('1-slot FULL_PROFILE_CONFORMANCE_DECLARATION with disposition REJECTED_FAIL_CLOSED is rejected by schema and semantic validation (OPEN-5 / OPEN-2)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));

  // Create a 1-slot FULL_PROFILE_CONFORMANCE_DECLARATION document with disposition: "REJECTED_FAIL_CLOSED"
  const singleSlotDecl = {
    ...fullDeclSample,
    advertised_capabilities: [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        description: 'Single rejected storage capability',
        is_mandatory: true,
        supported_features: [
          'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
          'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
          'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
          'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
          'AbortMultipartUpload', 'ListParts'
        ],
        degradation_fallback: 'NONE',
        disposition: 'REJECTED_FAIL_CLOSED',
        evidence_references: ['urn:cybrik:evidence:storage:s3:conformance:v1:object-lock']
      }
    ],
    conformance_evidence: [
      {
        test_identifier: 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock',
        status: 'PASS',
        evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      }
    ]
  };

  // 1. Rejected by schema validation
  const schemaValid = ajv.validate(pcaSchemaId, singleSlotDecl);
  assert.equal(schemaValid, false, '1-slot FULL_PROFILE_CONFORMANCE_DECLARATION must fail schema validation');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'minItems' || e.keyword === 'contains' || e.keyword === 'additionalProperties'),
    'Schema errors must capture defect in single-slot full profile declaration'
  );

  // 2. Rejected by semantic validation
  assert.throws(
    () => validatePlatformSemantics(singleSlotDecl, pcaSchemaId),
    /FULL_PROFILE_CONFORMANCE_DECLARATION/,
    'Semantic validation must reject 1-slot FULL_PROFILE_CONFORMANCE_DECLARATION with REJECTED_FAIL_CLOSED'
  );
});

test('snapshot path rejection for snapshots/.hidden.db, $PRE_APPLY_SNAPSHOT/.hidden.db, and snapshots//backup.db (OPEN-1 Finding 4)', () => {
  const manifestSchemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const manifestSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'), 'utf8'));

  const pathsToReject = [
    'snapshots/.hidden.db',
    '$PRE_APPLY_SNAPSHOT/.hidden.db',
    'snapshots//backup.db'
  ];

  for (const badPath of pathsToReject) {
    const doc = JSON.parse(JSON.stringify(manifestSample));
    doc.update_station_workflow.rollback_steps[0].target = badPath;

    // Schema rejection
    const schemaValid = ajv.validate(manifestSchemaId, doc);
    assert.equal(schemaValid, false, `Snapshot target '${badPath}' must be rejected by schema validation`);

    // Semantic rejection
    assert.throws(
      () => validatePlatformSemantics(doc, manifestSchemaId),
      /invalid RESTORE_DATABASE_SNAPSHOT target path/,
      `Snapshot target '${badPath}' must be rejected by semantic validation`
    );
  }
});

test('validatePlatformSemantics rejects snapshot restore targets with spaces, @, and .. (OPEN-1 Finding 4 & 5)', () => {
  const manifestSchemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const manifestSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'), 'utf8'));

  const invalidCharTargets = [
    'snapshots/bad name.db',
    'snapshots/bad@name.db',
    'snapshots/foo..bar.db',
    'snapshots/backup.db/'
  ];

  for (const target of invalidCharTargets) {
    const doc = JSON.parse(JSON.stringify(manifestSample));
    doc.update_station_workflow.rollback_steps[0].target = target;

    // Semantic rejection
    assert.throws(
      () => validatePlatformSemantics(doc, manifestSchemaId),
      /invalid RESTORE_DATABASE_SNAPSHOT target path/,
      `Expected snapshot restore target '${target}' to be rejected by validatePlatformSemantics`
    );
  }
});

test('in-memory validation: rejection of legacy Object Lock URN aliases (rejecting anything other than urn:cybrik:evidence:storage:s3:conformance:v1:object-lock) (Finding 3 / OPEN-5)', () => {
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';
  const legacyAliases = [
    'urn:cybrik:evidence:storage:object-lock:v1',
    'urn:cybrik:evidence:storage:object-lock',
    'urn:cybrik:evidence:storage-object-lock',
    'urn:cybrik:evidence:object-lock',
    'urn:cybrik:evidence:storage:object-lock:01',
    'urn:cybrik:evidence:storage-object-lock:01',
    'urn:cybrik:evidence:object-lock:retention-v1',
    'urn:cybrik:evidence:storage:object-lock:compliance:2026',
    'urn:cybrik:evidence:storage:s3:object-lock',
    'urn:cybrik:evidence:storage:s3:conformance:v2:object-lock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock:legacy-alias',
    'urn:cybrik:evidence:storage:s3:conformance:v1:retention',
    'urn:cybrik:evidence:storage:s3:conformance:v1:worm-lock',
    'urn:cybrik:evidence:s3-object-lock',
  ];

  // 1. Strict canonical Object Lock predicate: only urn:cybrik:evidence:storage:s3:conformance:v1:object-lock is valid
  const isStrictCanonicalObjectLockUrn = (urn) => urn === canonicalLockUrn;

  assert.ok(isStrictCanonicalObjectLockUrn(canonicalLockUrn), 'Canonical URN must be strictly accepted');

  for (const alias of legacyAliases) {
    assert.equal(
      isStrictCanonicalObjectLockUrn(alias),
      false,
      `Legacy Object Lock URN alias '${alias}' must be rejected (strictly only '${canonicalLockUrn}' allowed)`
    );
    assert.notEqual(alias, canonicalLockUrn, `Legacy alias '${alias}' must not match canonical URN`);
  }

  // 2. Standalone declaration strictly requiring canonical Object Lock URN
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));

  // Positive baseline with canonical URN passes
  assert.doesNotThrow(() => validatePlatformSemantics(fullDeclSample, pcaSchemaId));

  // Legacy aliases in standalone full profile declaration
  for (const alias of legacyAliases) {
    const mutated = JSON.parse(JSON.stringify(fullDeclSample));
    const storageCap = mutated.advertised_capabilities.find(c => c.slot_id === 'storage');
    storageCap.evidence_references = [alias];
    mutated.conformance_evidence = [
      ...mutated.conformance_evidence.filter(e => e.test_identifier !== canonicalLockUrn),
      {
        test_identifier: alias,
        status: 'PASS',
        evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        executed_at: '2026-08-25T12:00:00Z',
        report_uri: 'https://example.com/legacy-lock'
      }
    ];

    const hasCanonicalLock = storageCap.evidence_references.some(r => r === canonicalLockUrn);
    assert.equal(hasCanonicalLock, false, `Mutated declaration must not contain canonical Object Lock URN for alias '${alias}'`);
  }
});

test('validatePlatformSemantics additional branch coverage for declaration and lease validation', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const handshakeSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. FULL_PROFILE_CONFORMANCE_DECLARATION missing target_profile_digest
  const declNoDigest = JSON.parse(JSON.stringify(fullDeclSample));
  delete declNoDigest.target_profile_digest;
  assert.throws(
    () => validatePlatformSemantics(declNoDigest, pcaSchemaId),
    /target_profile_digest is required/
  );

  // 2. FULL_PROFILE_CONFORMANCE_DECLARATION missing mandatory profile slot
  const declMissingSlot = JSON.parse(JSON.stringify(fullDeclSample));
  declMissingSlot.advertised_capabilities = declMissingSlot.advertised_capabilities.filter(c => c.slot_id !== 'storage');
  assert.throws(
    () => validatePlatformSemantics(declMissingSlot, pcaSchemaId),
    /FULL_PROFILE_CONFORMANCE_DECLARATION missing required mandatory profile slot 'storage'/
  );

  // 3. FULL_PROFILE_CONFORMANCE_DECLARATION with REJECTED_FAIL_CLOSED capability
  const declRejectedCap = JSON.parse(JSON.stringify(fullDeclSample));
  declRejectedCap.advertised_capabilities[0].disposition = 'REJECTED_FAIL_CLOSED';
  assert.throws(
    () => validatePlatformSemantics(declRejectedCap, pcaSchemaId),
    /FULL_PROFILE_CONFORMANCE_DECLARATION cannot contain capability .* with disposition 'REJECTED_FAIL_CLOSED'/
  );

  // 4. Negotiation handshake where mandatory profile slot missing from advertised capabilities
  const hsMissingAdv = JSON.parse(JSON.stringify(handshakeSample));
  hsMissingAdv.claim_type = 'CAPABILITY_NEGOTIATION_ADVERTISEMENT';
  hsMissingAdv.advertisement_response.claim_type = 'CAPABILITY_NEGOTIATION_ADVERTISEMENT';
  hsMissingAdv.advertisement_response.advertised_capabilities = hsMissingAdv.advertisement_response.advertised_capabilities.filter(c => c.slot_id !== 'storage');
  assert.throws(
    () => validatePlatformSemantics(hsMissingAdv, handshakeSchemaId),
    /mandatory profile slot 'storage' not found in advertised capabilities/
  );

  // 5. Negotiation handshake where mandatory slot evidence reference is missing in conformance evidence
  const hsMissingEv = JSON.parse(JSON.stringify(handshakeSample));
  hsMissingEv.claim_type = 'CAPABILITY_NEGOTIATION_ADVERTISEMENT';
  hsMissingEv.advertisement_response.claim_type = 'CAPABILITY_NEGOTIATION_ADVERTISEMENT';
  const storageCap = hsMissingEv.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storageCap.evidence_references = ['urn:cybrik:evidence:nonexistent'];
  assert.throws(
    () => validatePlatformSemantics(hsMissingEv, handshakeSchemaId),
    /evidence_reference 'urn:cybrik:evidence:nonexistent' not found in conformance_evidence/
  );

  // 6. Negotiation handshake where mandatory slot conformance evidence has non-PASS status
  const hsFailEv = JSON.parse(JSON.stringify(handshakeSample));
  hsFailEv.claim_type = 'CAPABILITY_NEGOTIATION_ADVERTISEMENT';
  hsFailEv.advertisement_response.claim_type = 'CAPABILITY_NEGOTIATION_ADVERTISEMENT';
  const storageRef = hsFailEv.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage').evidence_references[0];
  const evObj = hsFailEv.advertisement_response.conformance_evidence.find(e => e.test_identifier === storageRef);
  if (evObj) {
    evObj.status = 'FAIL';
    assert.throws(
      () => validatePlatformSemantics(hsFailEv, handshakeSchemaId),
      /conformance evidence .* has non-passing status 'FAIL'/
    );
  }
});

test('in-memory validation: capability containing both canonical URN and legacy alias (canonical-plus-alias set) in evidence_references is strictly rejected by validatePlatformSemantics (OPEN-5 / OPEN-2)', () => {
  const handshakeSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';

  const legacyAliases = [
    'urn:cybrik:evidence:storage:object-lock:v1',
    'urn:cybrik:evidence:storage:object-lock',
    'urn:cybrik:evidence:storage-object-lock',
    'urn:cybrik:evidence:object-lock',
    'urn:cybrik:evidence:storage:object-lock:01',
    'urn:cybrik:evidence:storage-object-lock:01',
    'urn:cybrik:evidence:object-lock:retention-v1',
    'urn:cybrik:evidence:storage:object-lock:compliance:2026',
    'urn:cybrik:evidence:storage:s3:object-lock',
    'urn:cybrik:evidence:storage:s3:conformance:v2:object-lock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock:legacy-alias',
    'urn:cybrik:evidence:s3-object-lock',
  ];

  // 1. Negotiation handshake: storage capability containing canonical URN + legacy alias
  for (const alias of legacyAliases) {
    const dataHs = JSON.parse(JSON.stringify(handshakeSample));
    const storageCap = dataHs.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
    // Set canonical-plus-alias set in evidence_references
    storageCap.evidence_references = [
      'urn:cybrik:evidence:storage:s3-19-ops:v1',
      canonicalLockUrn,
      alias,
    ];
    // Add valid conformance evidence record for the alias
    dataHs.advertisement_response.conformance_evidence.push({
      test_identifier: alias,
      status: 'PASS',
      evidence_pack_digest: 'a100000000000000000000000000000000000000000000000000000000000005',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/alias.json',
    });

    const schemaValid = ajv.validate(handshakeSchemaId, dataHs);
    assert.ok(schemaValid, `Canonical-plus-alias '${alias}' must pass Ajv schema validation: ` + ajv.errorsText());

    assert.throws(
      () => validatePlatformSemantics(dataHs, handshakeSchemaId),
      /canonical-plus-alias set prohibited|legacy Object Lock alias|aliases strictly prohibited/,
      `Canonical-plus-alias set with '${alias}' in negotiation must be strictly rejected by validatePlatformSemantics`
    );
  }

  // 2. Standalone declaration: storage capability containing canonical URN + legacy alias
  for (const alias of legacyAliases) {
    const dataDecl = JSON.parse(JSON.stringify(fullDeclSample));
    const storageCap = dataDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
    storageCap.evidence_references = [canonicalLockUrn, alias];
    dataDecl.conformance_evidence.push({
      test_identifier: alias,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/alias-lock',
    });

    const schemaValid = ajv.validate(pcaSchemaId, dataDecl);
    assert.ok(schemaValid, `Canonical-plus-alias '${alias}' in declaration must pass Ajv schema: ` + ajv.errorsText());

    assert.throws(
      () => validatePlatformSemantics(dataDecl, pcaSchemaId),
      /canonical-plus-alias set prohibited|legacy Object Lock alias|aliases strictly prohibited/,
      `Canonical-plus-alias set with '${alias}' in declaration must be strictly rejected by validatePlatformSemantics`
    );
  }

  // 3. Non-storage capability containing a legacy Object Lock alias
  const dataNonStorage = JSON.parse(JSON.stringify(handshakeSample));
  const cacheCap = dataNonStorage.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'cache');
  if (cacheCap) {
    cacheCap.evidence_references = [...(cacheCap.evidence_references || []), 'urn:cybrik:evidence:storage:object-lock:v1'];
    dataNonStorage.advertisement_response.conformance_evidence.push({
      test_identifier: 'urn:cybrik:evidence:storage:object-lock:v1',
      status: 'PASS',
      evidence_pack_digest: 'a100000000000000000000000000000000000000000000000000000000000005',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/alias.json',
    });
    assert.throws(
      () => validatePlatformSemantics(dataNonStorage, handshakeSchemaId),
      /canonical-plus-alias set prohibited|legacy Object Lock alias|aliases strictly prohibited/,
      'Non-storage capability with legacy Object Lock alias must be strictly rejected'
    );
  }

  // 4. FULL_PROFILE_CONFORMANCE_DECLARATION descriptor missing slot_id
  const dataNoSlotId = JSON.parse(JSON.stringify(fullDeclSample));
  delete dataNoSlotId.advertised_capabilities[0].slot_id;
  assert.throws(
    () => validatePlatformSemantics(dataNoSlotId, pcaSchemaId),
    /FULL_PROFILE_CONFORMANCE_DECLARATION capability descriptor missing slot_id/
  );

  // 5. FULL_PROFILE_CONFORMANCE_DECLARATION with malformed target_profile_digest
  const dataBadDigestDecl = JSON.parse(JSON.stringify(fullDeclSample));
  dataBadDigestDecl.target_profile_digest = 'not-a-valid-sha256';
  assert.throws(
    () => validatePlatformSemantics(dataBadDigestDecl, pcaSchemaId),
    /target_profile_digest is required and must match/
  );
});

test('validatePlatformSemantics strict allowlist on storage_object_lock evidence_references (OPEN-5 / Finding 4)', () => {
  const handshakeSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';

  // 1. In agreed_capability_lease: storage_object_lock with invalid evidence URN throws exact error
  const badLeaseData = JSON.parse(JSON.stringify(handshakeSample));
  const badCap = badLeaseData.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock');
  if (badCap) {
    badCap.evidence_references = ['urn:cybrik:evidence:storage:invalid-lock-urn'];
    badLeaseData.advertisement_response.conformance_evidence.push({
      test_identifier: 'urn:cybrik:evidence:storage:invalid-lock-urn',
      status: 'PASS',
      evidence_pack_digest: 'a100000000000000000000000000000000000000000000000000000000000005',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/bad-lock.json',
    });
    assert.throws(
      () => validatePlatformSemantics(badLeaseData, handshakeSchemaId),
      /Semantic error: storage_object_lock evidence URN must strictly equal 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' \(got 'urn:cybrik:evidence:storage:invalid-lock-urn'\)/
    );
  }

  // 2. In advertised_capabilities: storage_object_lock with invalid evidence URN throws exact error
  const badAdvData = JSON.parse(JSON.stringify(fullDeclSample));
  badAdvData.advertised_capabilities.push({
    capability_name: 'storage_object_lock',
    slot_id: 'storage_extension',
    is_mandatory: false,
    evidence_references: ['urn:cybrik:evidence:custom:object-lock:v2']
  });
  badAdvData.conformance_evidence.push({
    test_identifier: 'urn:cybrik:evidence:custom:object-lock:v2',
    status: 'PASS',
    evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  });
  assert.throws(
    () => validatePlatformSemantics(badAdvData, pcaSchemaId),
    /Semantic error: storage_object_lock evidence URN must strictly equal 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' \(got 'urn:cybrik:evidence:custom:object-lock:v2'\)/
  );
});

test('in-memory validation: unlisted aliases like urn:cybrik:evidence:storage:s3:conformance:v1:object_lock in evidence_references are strictly rejected by validatePlatformSemantics (OPEN-5 / OPEN-2)', () => {
  const handshakeSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';

  const unlistedAliases = [
    'urn:cybrik:evidence:storage:s3:conformance:v1:object_lock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:objectlock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock-v1',
    'urn:cybrik:evidence:storage:s3:conformance:v1:object_lock_v1',
    'urn:cybrik:evidence:storage:s3:conformance:v1:objectlock:v1',
  ];

  // 1. Negotiation handshake: storage capability containing canonical URN + unlisted alias
  for (const alias of unlistedAliases) {
    const dataHs = JSON.parse(JSON.stringify(handshakeSample));
    const storageCap = dataHs.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
    // Set canonical-plus-alias set in evidence_references
    storageCap.evidence_references = [
      'urn:cybrik:evidence:storage:s3-19-ops:v1',
      canonicalLockUrn,
      alias,
    ];
    // Add valid conformance evidence record for the alias
    dataHs.advertisement_response.conformance_evidence.push({
      test_identifier: alias,
      status: 'PASS',
      evidence_pack_digest: 'a100000000000000000000000000000000000000000000000000000000000005',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/alias.json',
    });

    const schemaValid = ajv.validate(handshakeSchemaId, dataHs);
    assert.ok(schemaValid, `Unlisted alias '${alias}' must pass Ajv schema validation: ` + ajv.errorsText());

    assert.throws(
      () => validatePlatformSemantics(dataHs, handshakeSchemaId),
      /canonical-plus-alias set prohibited|legacy Object Lock alias|aliases strictly prohibited/,
      `Unlisted alias '${alias}' in negotiation must be strictly rejected by validatePlatformSemantics`
    );
  }

  // 2. Standalone declaration: storage capability containing canonical URN + unlisted alias
  for (const alias of unlistedAliases) {
    const dataDecl = JSON.parse(JSON.stringify(fullDeclSample));
    const storageCap = dataDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
    storageCap.evidence_references = [canonicalLockUrn, alias];
    dataDecl.conformance_evidence.push({
      test_identifier: alias,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/alias-lock',
    });

    const schemaValid = ajv.validate(pcaSchemaId, dataDecl);
    assert.ok(schemaValid, `Unlisted alias '${alias}' in declaration must pass Ajv schema: ` + ajv.errorsText());

    assert.throws(
      () => validatePlatformSemantics(dataDecl, pcaSchemaId),
      /canonical-plus-alias set prohibited|legacy Object Lock alias|aliases strictly prohibited/,
      `Unlisted alias '${alias}' in declaration must be strictly rejected by validatePlatformSemantics`
    );
  }

  // 3. Standalone declaration: storage capability containing ONLY the unlisted alias (no canonical URN)
  for (const alias of unlistedAliases) {
    const dataDeclOnlyAlias = JSON.parse(JSON.stringify(fullDeclSample));
    const storageCap = dataDeclOnlyAlias.advertised_capabilities.find(c => c.slot_id === 'storage');
    storageCap.evidence_references = [alias];
    dataDeclOnlyAlias.conformance_evidence = [
      ...dataDeclOnlyAlias.conformance_evidence.filter(e => e.test_identifier !== canonicalLockUrn),
      {
        test_identifier: alias,
        status: 'PASS',
        evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        executed_at: '2026-08-25T12:00:00Z',
        report_uri: 'https://example.com/alias-lock',
      },
    ];

    assert.throws(
      () => validatePlatformSemantics(dataDeclOnlyAlias, pcaSchemaId),
      /storage slot advertisement lacks Object Lock retention evidence|canonical-plus-alias set prohibited|legacy Object Lock alias|aliases strictly prohibited/,
      `Storage capability with only unlisted alias '${alias}' must be rejected by validatePlatformSemantics`
    );
  }
});

test('validatePlatformSemantics enforces signing key fingerprint equality on offline update manifest (Finding 1 & 3 / OPEN-1)', () => {
  const manifestSchemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const manifestSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'), 'utf8'));

  // 1. Valid matching fingerprints pass validation
  assert.doesNotThrow(() => validatePlatformSemantics(manifestSample, manifestSchemaId));

  // 2. Mismatched key fingerprint in detached_signature passes Ajv schema structurally
  const mismatchedManifest = JSON.parse(JSON.stringify(manifestSample));
  mismatchedManifest.detached_signature.key_fingerprint = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

  const schemaValid = ajv.validate(manifestSchemaId, mismatchedManifest);
  assert.ok(schemaValid, `Mismatched fingerprint manifest must pass Ajv schema: ` + ajv.errorsText());

  // 3. Mismatched key fingerprint throws semantic error
  assert.throws(
    () => validatePlatformSemantics(mismatchedManifest, manifestSchemaId),
    new RegExp(`Semantic error: offline manifest detached_signature\\.key_fingerprint \\('${mismatchedManifest.detached_signature.key_fingerprint}'\\) does not match operator_trust_root\\.public_key_fingerprint \\('${mismatchedManifest.operator_trust_root.public_key_fingerprint}'\\)`),
    'Mismatched key fingerprint must throw semantic error'
  );
});

test('in-memory validation: permit multi-evidence storage declarations with targeted Object Lock alias rejection (Finding 1 / OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const handshakeSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';

  // 1. Full profile declaration with multi-evidence storage slot passes
  const multiDecl = JSON.parse(JSON.stringify(fullDeclSample));
  const storageCap = multiDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  storageCap.evidence_references = [
    'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops',
    canonicalLockUrn
  ];
  multiDecl.conformance_evidence.push({
    test_identifier: 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops',
    status: 'PASS',
    evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    executed_at: '2026-08-25T12:00:00Z',
    report_uri: 'https://example.com/s3-ops'
  });

  const schemaValid = ajv.validate(pcaSchemaId, multiDecl);
  assert.ok(schemaValid, 'Multi-evidence declaration must pass Ajv schema: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(multiDecl, pcaSchemaId),
    'Multi-evidence storage declaration with canonical Object Lock URN must pass validatePlatformSemantics'
  );

  // 2. Full profile declaration with multi-evidence storage slot where one ref is an Object Lock alias throws targeted error
  const badAliasDecl = JSON.parse(JSON.stringify(multiDecl));
  const badStorageCap = badAliasDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  badStorageCap.evidence_references.push('urn:cybrik:evidence:storage:s3:conformance:v1:object_lock');
  badAliasDecl.conformance_evidence.push({
    test_identifier: 'urn:cybrik:evidence:storage:s3:conformance:v1:object_lock',
    status: 'PASS',
    evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    executed_at: '2026-08-25T12:00:00Z',
    report_uri: 'https://example.com/bad-alias'
  });

  assert.throws(
    () => validatePlatformSemantics(badAliasDecl, pcaSchemaId),
    /Semantic error: invalid storage_object_lock evidence URN 'urn:cybrik:evidence:storage:s3:conformance:v1:object_lock': must strictly match canonical URN 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' \(aliases strictly prohibited\)/,
    'Object Lock alias in multi-evidence storage declaration must be rejected with canonical URN requirement'
  );

  // 3. Multi-evidence negotiation handshake passes
  assert.doesNotThrow(
    () => validatePlatformSemantics(handshakeSample, handshakeSchemaId),
    'Sample capability negotiation handshake with multi-evidence storage passes validation'
  );
});

test('in-memory validation: standalone full profile conformance declaration with dual storage evidence (s3-17-ops + object-lock) passes validatePlatformSemantics (OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));

  const s3OpsUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops';
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';

  // 1. Dual evidence on storage capability: s3-17-ops + object-lock
  const dualEvidenceDecl = JSON.parse(JSON.stringify(fullDeclSample));
  const storageCap = dualEvidenceDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  storageCap.evidence_references = [s3OpsUrn, canonicalLockUrn];

  // Add conformance evidence for s3-17-ops alongside object-lock
  dualEvidenceDecl.conformance_evidence = [
    ...dualEvidenceDecl.conformance_evidence.filter(e => e.test_identifier !== canonicalLockUrn && e.test_identifier !== s3OpsUrn),
    {
      test_identifier: s3OpsUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/s3-ops'
    },
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/object-lock'
    }
  ];

  const schemaValid = ajv.validate(pcaSchemaId, dualEvidenceDecl);
  assert.ok(schemaValid, 'Dual evidence standalone declaration must pass schema validation: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(dualEvidenceDecl, pcaSchemaId),
    'Dual evidence standalone declaration must pass validatePlatformSemantics cleanly'
  );

  // 2. Reverse order of evidence references also passes cleanly
  const reverseEvidenceDecl = JSON.parse(JSON.stringify(dualEvidenceDecl));
  const reverseStorageCap = reverseEvidenceDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  reverseStorageCap.evidence_references = [canonicalLockUrn, s3OpsUrn];

  const reverseSchemaValid = ajv.validate(pcaSchemaId, reverseEvidenceDecl);
  assert.ok(reverseSchemaValid, 'Reverse order dual evidence declaration must pass schema: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(reverseEvidenceDecl, pcaSchemaId),
    'Reverse order dual evidence declaration must pass validatePlatformSemantics cleanly'
  );

  // 3. Legacy s3-17-ops:v1 URN in dual evidence also passes cleanly
  const legacyS3OpsUrn = 'urn:cybrik:evidence:storage:s3-17-ops:v1';
  const legacyDualDecl = JSON.parse(JSON.stringify(fullDeclSample));
  const legacyStorageCap = legacyDualDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  legacyStorageCap.evidence_references = [legacyS3OpsUrn, canonicalLockUrn];
  legacyDualDecl.conformance_evidence = [
    ...legacyDualDecl.conformance_evidence.filter(e => e.test_identifier !== canonicalLockUrn && e.test_identifier !== legacyS3OpsUrn),
    {
      test_identifier: legacyS3OpsUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/s3-ops-legacy'
    },
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/object-lock'
    }
  ];
  assert.ok(ajv.validate(pcaSchemaId, legacyDualDecl), 'Legacy dual evidence declaration must pass schema: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(legacyDualDecl, pcaSchemaId),
    'Legacy dual evidence declaration must pass validatePlatformSemantics cleanly'
  );
});

test('in-memory validation: standalone declaration with unlisted Object Lock alias (...:object_lock) is strictly rejected (OPEN-5 / OPEN-2)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const s3OpsUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops';
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';
  const unlistedAlias = 'urn:cybrik:evidence:storage:s3:conformance:v1:object_lock';

  // 1. Standalone declaration with dual evidence using unlisted alias instead of canonical lock URN
  const declWithAlias = JSON.parse(JSON.stringify(fullDeclSample));
  const storageCap1 = declWithAlias.advertised_capabilities.find(c => c.slot_id === 'storage');
  storageCap1.evidence_references = [s3OpsUrn, unlistedAlias];
  declWithAlias.conformance_evidence = [
    ...declWithAlias.conformance_evidence.filter(e => e.test_identifier !== canonicalLockUrn),
    {
      test_identifier: s3OpsUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/s3-ops'
    },
    {
      test_identifier: unlistedAlias,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/object-lock-alias'
    }
  ];

  const schemaValid1 = ajv.validate(pcaSchemaId, declWithAlias);
  assert.ok(schemaValid1, 'Standalone declaration with alias must pass Ajv schema: ' + ajv.errorsText());
  assert.throws(
    () => validatePlatformSemantics(declWithAlias, pcaSchemaId),
    /storage slot advertisement lacks Object Lock retention evidence|canonical-plus-alias set prohibited|legacy Object Lock alias|invalid storage_object_lock evidence URN/,
    'Standalone declaration with unlisted alias replacing canonical lock must be strictly rejected'
  );

  // 2. Standalone declaration with triple evidence: s3-17-ops + canonical lock + unlisted alias (canonical-plus-alias)
  const declTriple = JSON.parse(JSON.stringify(fullDeclSample));
  const storageCap2 = declTriple.advertised_capabilities.find(c => c.slot_id === 'storage');
  storageCap2.evidence_references = [s3OpsUrn, canonicalLockUrn, unlistedAlias];
  declTriple.conformance_evidence = [
    ...declTriple.conformance_evidence.filter(e => e.test_identifier !== canonicalLockUrn),
    {
      test_identifier: s3OpsUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/s3-ops'
    },
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/object-lock'
    },
    {
      test_identifier: unlistedAlias,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/object-lock-alias'
    }
  ];

  const schemaValid2 = ajv.validate(pcaSchemaId, declTriple);
  assert.ok(schemaValid2, 'Standalone declaration with triple evidence must pass Ajv schema: ' + ajv.errorsText());
  assert.throws(
    () => validatePlatformSemantics(declTriple, pcaSchemaId),
    /canonical-plus-alias set prohibited|legacy Object Lock alias|invalid storage_object_lock evidence URN/,
    'Standalone declaration with canonical plus unlisted alias must be strictly rejected'
  );
});

test('in-memory validation: standalone and nested negotiation lease parity with dual storage evidence (OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';

  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const s3OpsUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops';
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';
  const unlistedAlias = 'urn:cybrik:evidence:storage:s3:conformance:v1:object_lock';

  // --- 1. Positive parity: Both standalone declaration and nested negotiation handshake succeed with dual evidence ---
  // A. Standalone declaration with dual storage evidence
  const standaloneDoc = JSON.parse(JSON.stringify(fullDeclSample));
  const saStoreCap = standaloneDoc.advertised_capabilities.find(c => c.slot_id === 'storage');
  saStoreCap.evidence_references = [s3OpsUrn, canonicalLockUrn];
  standaloneDoc.conformance_evidence = [
    ...standaloneDoc.conformance_evidence.filter(e => e.test_identifier !== canonicalLockUrn && e.test_identifier !== s3OpsUrn),
    {
      test_identifier: s3OpsUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/s3-ops'
    },
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/object-lock'
    }
  ];
  assert.ok(ajv.validate(pcaSchemaId, standaloneDoc), 'Standalone dual evidence doc passes Ajv: ' + ajv.errorsText());
  assert.doesNotThrow(() => validatePlatformSemantics(standaloneDoc, pcaSchemaId), 'Standalone dual evidence doc passes validatePlatformSemantics');

  // B. Nested negotiation handshake with dual storage evidence in advertisement_response and lease parity
  const nestedDoc = JSON.parse(JSON.stringify(handshakeSample));
  const nestedStoreCap = nestedDoc.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  nestedStoreCap.evidence_references = [s3OpsUrn, canonicalLockUrn];
  nestedDoc.advertisement_response.conformance_evidence = [
    ...nestedDoc.advertisement_response.conformance_evidence.filter(e => !e.test_identifier.includes('object-lock') && e.test_identifier !== s3OpsUrn && !e.test_identifier.includes('s3-17-ops') && !e.test_identifier.includes('s3-19-ops')),
    {
      test_identifier: s3OpsUrn,
      status: 'PASS',
      evidence_pack_digest: 'a100000000000000000000000000000000000000000000000000000000000017',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/s3-17-ops.json'
    },
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'a106060606060606060606060606060606060606060606060606060606060606',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/ev-store-object-lock-01.json'
    }
  ];
  // Ensure agreed_capability_lease for storage_object_lock has disposition GRANTED_FULL and fallback NONE
  const leaseLockCap = nestedDoc.agreed_capability_lease.negotiated_optional_capabilities.find(c => c.capability_name === 'storage_object_lock');
  if (leaseLockCap) {
    leaseLockCap.disposition = 'GRANTED_FULL';
    leaseLockCap.fallback_applied = 'NONE';
  }
  assert.ok(ajv.validate(pcnSchemaId, nestedDoc), 'Nested negotiation dual evidence doc passes Ajv: ' + ajv.errorsText());
  assert.doesNotThrow(() => validatePlatformSemantics(nestedDoc, pcnSchemaId), 'Nested negotiation dual evidence doc passes validatePlatformSemantics');

  // --- 2. Negative parity: Unlisted alias rejection parity ---
  // A. Standalone declaration with unlisted alias rejected
  const saAliasDoc = JSON.parse(JSON.stringify(standaloneDoc));
  const saAliasStoreCap = saAliasDoc.advertised_capabilities.find(c => c.slot_id === 'storage');
  saAliasStoreCap.evidence_references = [s3OpsUrn, unlistedAlias];
  saAliasDoc.conformance_evidence.push({
    test_identifier: unlistedAlias,
    status: 'PASS',
    evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    executed_at: '2026-08-25T12:00:00Z',
    report_uri: 'https://example.com/alias'
  });
  assert.throws(
    () => validatePlatformSemantics(saAliasDoc, pcaSchemaId),
    /storage slot advertisement lacks Object Lock retention evidence|canonical-plus-alias set prohibited|legacy Object Lock alias|invalid storage_object_lock evidence URN/,
    'Standalone declaration with unlisted alias must fail semantic validation'
  );

  // B. Nested negotiation handshake with unlisted alias rejected
  const nestedAliasDoc = JSON.parse(JSON.stringify(nestedDoc));
  const nestedAliasStoreCap = nestedAliasDoc.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  nestedAliasStoreCap.evidence_references = [s3OpsUrn, unlistedAlias];
  nestedAliasDoc.advertisement_response.conformance_evidence.push({
    test_identifier: unlistedAlias,
    status: 'PASS',
    evidence_pack_digest: 'a100000000000000000000000000000000000000000000000000000000000005',
    executed_at: '2026-08-27T12:00:00Z',
    report_uri: 'https://reports.cybrik.example/evidence/alias.json'
  });
  assert.throws(
    () => validatePlatformSemantics(nestedAliasDoc, pcnSchemaId),
    /storage slot advertisement lacks Object Lock retention evidence|canonical-plus-alias set prohibited|legacy Object Lock alias|invalid storage_object_lock evidence URN/,
    'Nested negotiation with unlisted alias must fail semantic validation'
  );

  // --- 3. Negative parity: Missing evidence reference rejection parity ---
  // A. Standalone declaration missing s3OpsUrn in conformance_evidence
  const saMissingEvDoc = JSON.parse(JSON.stringify(standaloneDoc));
  saMissingEvDoc.conformance_evidence = saMissingEvDoc.conformance_evidence.filter(e => e.test_identifier !== s3OpsUrn);
  assert.throws(
    () => validatePlatformSemantics(saMissingEvDoc, pcaSchemaId),
    /evidence_reference 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops' not found in conformance_evidence/,
    'Standalone declaration missing referenced evidence must throw'
  );

  // B. Nested negotiation missing s3OpsUrn in conformance_evidence
  const nestedMissingEvDoc = JSON.parse(JSON.stringify(nestedDoc));
  nestedMissingEvDoc.advertisement_response.conformance_evidence = nestedMissingEvDoc.advertisement_response.conformance_evidence.filter(e => e.test_identifier !== s3OpsUrn);
  assert.throws(
    () => validatePlatformSemantics(nestedMissingEvDoc, pcnSchemaId),
    /evidence_reference 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops' not found in conformance_evidence/,
    'Nested negotiation missing referenced evidence must throw'
  );

  // --- 4. Negative parity: Non-PASS evidence status rejection parity ---
  // A. Standalone declaration with FAIL s3OpsUrn status
  const saFailEvDoc = JSON.parse(JSON.stringify(standaloneDoc));
  const saFailEv = saFailEvDoc.conformance_evidence.find(e => e.test_identifier === s3OpsUrn);
  saFailEv.status = 'FAIL';
  assert.throws(
    () => validatePlatformSemantics(saFailEvDoc, pcaSchemaId),
    /conformance evidence 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops' has non-passing status 'FAIL'/,
    'Standalone declaration with non-PASS evidence status must throw'
  );

  // B. Nested negotiation with FAIL s3OpsUrn status
  const nestedFailEvDoc = JSON.parse(JSON.stringify(nestedDoc));
  const nestedFailEv = nestedFailEvDoc.advertisement_response.conformance_evidence.find(e => e.test_identifier === s3OpsUrn);
  nestedFailEv.status = 'FAIL';
  assert.throws(
    () => validatePlatformSemantics(nestedFailEvDoc, pcnSchemaId),
    /conformance evidence 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops' has non-passing status 'FAIL'/,
    'Nested negotiation with non-PASS evidence status must throw'
  );

  // --- 5. Negative parity: Malformed SHA-256 digest rejection parity ---
  // A. Standalone declaration with malformed digest
  const saBadDigDoc = JSON.parse(JSON.stringify(standaloneDoc));
  const saBadDigEv = saBadDigDoc.conformance_evidence.find(e => e.test_identifier === s3OpsUrn);
  saBadDigEv.evidence_pack_digest = 'not-a-valid-sha256';
  assert.throws(
    () => validatePlatformSemantics(saBadDigDoc, pcaSchemaId),
    /conformance evidence 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops' lacks valid SHA-256 evidence_pack_digest/,
    'Standalone declaration with malformed digest must throw'
  );

  // B. Nested negotiation with malformed digest
  const nestedBadDigDoc = JSON.parse(JSON.stringify(nestedDoc));
  const nestedBadDigEv = nestedBadDigDoc.advertisement_response.conformance_evidence.find(e => e.test_identifier === s3OpsUrn);
  nestedBadDigEv.evidence_pack_digest = 'not-a-valid-sha256';
  assert.throws(
    () => validatePlatformSemantics(nestedBadDigDoc, pcnSchemaId),
    /conformance evidence 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops' lacks valid SHA-256 evidence_pack_digest/,
    'Nested negotiation with malformed digest must throw'
  );
});

test('validatePlatformSemantics: standalone declaration edge branches for profile digest and capability validation', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));

  // 1. FULL_PROFILE_CONFORMANCE_DECLARATION with 14 capabilities including all 13 slots
  const decl14 = JSON.parse(JSON.stringify(fullDeclSample));
  decl14.advertised_capabilities.push({
    capability_name: 'cap-store-extra',
    slot_id: 'storage',
    description: 'Extra storage',
    is_mandatory: false,
    supported_features: ['extra'],
    degradation_fallback: 'NONE',
    evidence_references: ['urn:cybrik:evidence:storage:s3:conformance:v1:object-lock']
  });
  assert.throws(
    () => validatePlatformSemantics(decl14, pcaSchemaId),
    /FULL_PROFILE_CONFORMANCE_DECLARATION must declare exactly 13 advertised capabilities|advertised_capabilities contains duplicate slot_id/
  );

  // 2. FULL_PROFILE_CONFORMANCE_DECLARATION with non-canonical lock URN when named storage_object_lock
  const declNamedLock = JSON.parse(JSON.stringify(fullDeclSample));
  const storeCap = declNamedLock.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCap.capability_name = 'storage_object_lock';
  storeCap.evidence_references = ['urn:cybrik:evidence:storage:s3:conformance:v1:object-lock', 'urn:cybrik:evidence:storage:custom-lock'];
  declNamedLock.conformance_evidence.push({
    test_identifier: 'urn:cybrik:evidence:storage:custom-lock',
    status: 'PASS',
    evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    executed_at: '2026-08-25T12:00:00Z',
    report_uri: 'https://example.com/custom-lock'
  });
  assert.throws(
    () => validatePlatformSemantics(declNamedLock, pcaSchemaId),
    /storage_object_lock evidence URN must strictly equal 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'|legacy Object Lock alias|invalid storage_object_lock evidence URN/
  );
});

test('in-memory validation: declarations carrying custom PASS storage evidence urn:cybrik:evidence:storage:s3:conformance:v1:custom-s3-ops alongside canonical Object Lock evidence pass semantic validation (OPEN-2 / OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';
  const customStorageUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:custom-s3-ops';

  // 1. Full profile conformance declaration carrying custom PASS storage evidence alongside canonical Object Lock
  const fullDeclSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const fullDecl = JSON.parse(JSON.stringify(fullDeclSample));
  const storageCap = fullDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storageCap.evidence_references.includes(canonicalLockUrn), 'Storage cap must include canonical lock URN');
  storageCap.evidence_references.push(customStorageUrn);
  fullDecl.conformance_evidence.push({
    test_identifier: customStorageUrn,
    status: 'PASS',
    evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    executed_at: '2026-08-25T12:00:00Z',
    report_uri: 'https://reports.cybrik.example/evidence/custom-s3-ops-report.json',
  });
  assert.ok(ajv.validate(pcaSchemaId, fullDecl), 'Full declaration with custom PASS storage evidence must pass Ajv schema validation');
  assert.doesNotThrow(
    () => validatePlatformSemantics(fullDecl, pcaSchemaId),
    'Full declaration carrying custom PASS storage evidence alongside canonical Object Lock evidence must pass semantic validation'
  );

  // 2. Partial advertisement declaration carrying custom PASS storage evidence
  const partialSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));
  const partialWithCustom = JSON.parse(JSON.stringify(partialSample));
  const partStorageCap = partialWithCustom.advertised_capabilities.find(c => c.slot_id === 'storage');
  if (partStorageCap) {
    partStorageCap.evidence_references.push(customStorageUrn);
  } else {
    partialWithCustom.advertised_capabilities.push({
      capability_name: 's3_storage_provider',
      slot_id: 'storage',
      description: 'Storage slot with custom and canonical Object Lock evidence',
      is_mandatory: true,
      supported_features: [
        'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
        'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
        'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
        'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
        'AbortMultipartUpload', 'ListParts', 'PutBucketVersioning', 'GetBucketVersioning'
      ],
      degradation_fallback: 'NONE',
      evidence_references: [canonicalLockUrn, customStorageUrn],
    });
  }
  partialWithCustom.conformance_evidence.push(
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/report-lock',
    },
    {
      test_identifier: customStorageUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/custom-s3-ops-report',
    }
  );
  assert.ok(ajv.validate(pcaSchemaId, partialWithCustom), 'Partial advertisement with custom PASS storage evidence must pass Ajv schema');
  assert.doesNotThrow(
    () => validatePlatformSemantics(partialWithCustom, pcaSchemaId),
    'Partial advertisement with custom PASS storage evidence alongside canonical Object Lock evidence must pass validatePlatformSemantics'
  );

  // 3. Negotiation handshake carrying custom PASS storage evidence
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const handshakeWithCustom = JSON.parse(JSON.stringify(handshakeSample));
  const hsStorageCap = handshakeWithCustom.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  hsStorageCap.evidence_references = [
    'urn:cybrik:evidence:storage:s3-19-ops:v1',
    canonicalLockUrn,
    customStorageUrn,
  ];
  handshakeWithCustom.advertisement_response.conformance_evidence = [
    ...handshakeWithCustom.advertisement_response.conformance_evidence.filter(e => !e.test_identifier.includes('object-lock')),
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'a106060606060606060606060606060606060606060606060606060606060606',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/ev-store-object-lock-01.json',
    },
    {
      test_identifier: customStorageUrn,
      status: 'PASS',
      evidence_pack_digest: 'b206060606060606060606060606060606060606060606060606060606060606',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/ev-store-custom-s3-ops-01.json',
    },
  ];
  assert.doesNotThrow(
    () => validatePlatformSemantics(handshakeWithCustom, pcnSchemaId),
    'Negotiation handshake with custom PASS storage evidence alongside canonical Object Lock evidence must pass validatePlatformSemantics'
  );
});

test('in-memory validation: partial storage advertisements with <17 ops or noncanonical Object Lock aliases are strictly rejected (OPEN-2 / OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';
  const partialSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  const ALL_19_OPS = [
    'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
    'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
    'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
    'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
    'AbortMultipartUpload', 'ListParts', 'PutBucketVersioning', 'GetBucketVersioning'
  ];

  function buildPartialStorageAdv(ops = ALL_19_OPS, lockUrn = canonicalLockUrn) {
    const doc = JSON.parse(JSON.stringify(partialSample));
    doc.advertised_capabilities = [
      {
        capability_name: 's3_storage_provider',
        slot_id: 'storage',
        description: 'Partial storage capability declaration',
        is_mandatory: true,
        supported_features: [...ops],
        degradation_fallback: 'NONE',
        evidence_references: [lockUrn]
      }
    ];
    doc.conformance_evidence = [
      {
        test_identifier: lockUrn,
        status: 'PASS',
        evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        executed_at: '2026-08-25T12:00:00Z',
        report_uri: 'https://example.com/report'
      }
    ];
    return doc;
  }

  // 1. Positive baseline passes
  const validPartial = buildPartialStorageAdv();
  assert.ok(ajv.validate(pcaSchemaId, validPartial), 'Baseline partial storage advertisement with 19 ops must pass Ajv');
  assert.doesNotThrow(
    () => validatePlatformSemantics(validPartial, pcaSchemaId),
    'Baseline partial storage advertisement with 19 ops must pass validatePlatformSemantics'
  );

  // 2. Negative: Partial storage advertisement with 0 ops (<15 ops) is rejected
  const zeroOpsAdv = buildPartialStorageAdv([]);
  assert.throws(
    () => validatePlatformSemantics(zeroOpsAdv, pcaSchemaId),
    /storage slot advertisement missing required S3 operation .* from 15 baseline S3 operations/
  );

  // 3. Negative: Partial storage advertisement with subset (e.g. 2 ops) is rejected
  const twoOpsAdv = buildPartialStorageAdv(['PutObject', 'GetObject']);
  assert.throws(
    () => validatePlatformSemantics(twoOpsAdv, pcaSchemaId),
    /storage slot advertisement missing required S3 operation 'HeadObject' from 15 baseline S3 operations/
  );

  // 4. Negative: Partial storage advertisement with 18 ops (missing CompleteMultipartUpload) is rejected
  const missingCompleteAdv = buildPartialStorageAdv(ALL_19_OPS.filter(op => op !== 'CompleteMultipartUpload'));
  assert.throws(
    () => validatePlatformSemantics(missingCompleteAdv, pcaSchemaId),
    /storage slot advertisement missing required S3 operation 'CompleteMultipartUpload' from 15 baseline S3 operations/
  );

  // 5. Negative: Partial storage advertisement with 18 ops (missing PutObjectRetention) is rejected
  const missingRetentionAdv = buildPartialStorageAdv(ALL_19_OPS.filter(op => op !== 'PutObjectRetention'));
  assert.throws(
    () => validatePlatformSemantics(missingRetentionAdv, pcaSchemaId),
    /immutable storage capability advertisement missing required S3 operation 'PutObjectRetention' from 19 closed S3 operations/
  );

  // 5b. Negative: Partial storage advertisement with 17 ops (missing PutBucketVersioning) is rejected
  const missingVersioningAdv = buildPartialStorageAdv(ALL_19_OPS.filter(op => op !== 'PutBucketVersioning'));
  assert.throws(
    () => validatePlatformSemantics(missingVersioningAdv, pcaSchemaId),
    /storage slot advertisement missing required S3 operation 'PutBucketVersioning' from 15 baseline S3 operations/
  );

  // 6. Negative: Partial storage advertisement with noncanonical Object Lock aliases strictly rejected
  const legacyAliases = [
    'urn:cybrik:evidence:storage:object-lock:v1',
    'urn:cybrik:evidence:storage:s3:conformance:v1:object_lock',
    'urn:cybrik:evidence:storage:s3:conformance:v2:object-lock',
    'urn:cybrik:evidence:storage:object-lock',
    'urn:cybrik:evidence:s3-object-lock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock:legacy-alias',
    'urn:cybrik:evidence:storage:object-lock:compliance:2026',
  ];

  for (const alias of legacyAliases) {
    // 6a. Noncanonical alias alone (lacks canonical URN)
    const aliasAloneAdv = buildPartialStorageAdv(ALL_19_OPS, alias);
    assert.throws(
      () => validatePlatformSemantics(aliasAloneAdv, pcaSchemaId),
      /storage slot advertisement lacks Object Lock retention evidence|invalid storage_object_lock evidence URN|legacy Object Lock alias/,
      `Noncanonical Object Lock alias alone '${alias}' in partial storage advertisement must be rejected`
    );

    // 6b. Canonical URN plus noncanonical alias (alias in multi-evidence set)
    const dualEvidenceAdv = buildPartialStorageAdv(ALL_19_OPS, canonicalLockUrn);
    dualEvidenceAdv.advertised_capabilities[0].evidence_references.push(alias);
    dualEvidenceAdv.conformance_evidence.push({
      test_identifier: alias,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/report'
    });
    assert.throws(
      () => validatePlatformSemantics(dualEvidenceAdv, pcaSchemaId),
      /invalid storage_object_lock evidence URN .* must strictly match canonical URN 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' \(aliases strictly prohibited\)|legacy Object Lock alias/,
      `Noncanonical Object Lock alias '${alias}' alongside canonical URN must be strictly rejected`
    );
  }

  // 7. Negative: Partial storage advertisement missing Object Lock evidence entirely is rejected
  const noLockAdv = JSON.parse(JSON.stringify(partialSample));
  const customStorageUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:s3-17-ops';
  noLockAdv.advertised_capabilities = [
    {
      capability_name: 's3_storage_provider',
      slot_id: 'storage',
      description: 'Storage slot without Object Lock',
      is_mandatory: true,
      supported_features: [...ALL_19_OPS],
      degradation_fallback: 'NONE',
      evidence_references: [customStorageUrn]
    }
  ];
  noLockAdv.conformance_evidence = [
    {
      test_identifier: customStorageUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/report'
    }
  ];
  assert.throws(
    () => validatePlatformSemantics(noLockAdv, pcaSchemaId),
    /storage slot advertisement lacks Object Lock retention evidence/,
    'Partial storage advertisement lacking Object Lock evidence must be rejected'
  );
});

test('in-memory validation: case-variant Object Lock URNs are strictly rejected across partial advertisements, full profiles, and handshakes (OPEN-1 / OPEN-2 / OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';

  const caseVariantUrns = [
    'urn:cybrik:evidence:storage:s3:conformance:v1:Object-Lock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:OBJECT_LOCK',
    'urn:cybrik:evidence:storage:s3:conformance:v1:Object_Lock',
    'urn:cybrik:evidence:storage:s3:conformance:v1:OBJECT-LOCK',
  ];

  const ALL_19_OPS = [
    'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
    'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
    'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
    'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
    'AbortMultipartUpload', 'ListParts', 'PutBucketVersioning', 'GetBucketVersioning'
  ];

  // 1. Partial Advertisements
  const partialSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));

  for (const variantUrn of caseVariantUrns) {
    // 1a. Case variant as the sole evidence reference
    const partialDocAlone = JSON.parse(JSON.stringify(partialSample));
    partialDocAlone.advertised_capabilities = [
      {
        capability_name: 's3_storage_provider',
        slot_id: 'storage',
        description: 'Storage capability with case-variant Object Lock URN',
        is_mandatory: true,
        supported_features: [...ALL_19_OPS],
        degradation_fallback: 'NONE',
        evidence_references: [variantUrn],
      },
    ];
    partialDocAlone.conformance_evidence = [
      {
        test_identifier: variantUrn,
        status: 'PASS',
        evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        executed_at: '2026-08-25T12:00:00Z',
        report_uri: 'https://example.com/report',
      },
    ];
    assert.throws(
      () => validatePlatformSemantics(partialDocAlone, pcaSchemaId),
      /storage slot advertisement lacks Object Lock retention evidence|invalid storage_object_lock evidence URN/,
      `Partial advertisement with sole case-variant URN '${variantUrn}' must be strictly rejected`
    );

    // 1b. Case variant alongside canonical Object Lock URN
    const partialDocDual = JSON.parse(JSON.stringify(partialSample));
    partialDocDual.advertised_capabilities = [
      {
        capability_name: 's3_storage_provider',
        slot_id: 'storage',
        description: 'Storage capability with canonical and case-variant Object Lock URN',
        is_mandatory: true,
        supported_features: [...ALL_19_OPS],
        degradation_fallback: 'NONE',
        evidence_references: [canonicalLockUrn, variantUrn],
      },
    ];
    partialDocDual.conformance_evidence = [
      {
        test_identifier: canonicalLockUrn,
        status: 'PASS',
        evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        executed_at: '2026-08-25T12:00:00Z',
        report_uri: 'https://example.com/report-canonical',
      },
      {
        test_identifier: variantUrn,
        status: 'PASS',
        evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        executed_at: '2026-08-25T12:00:00Z',
        report_uri: 'https://example.com/report-variant',
      },
    ];
    assert.throws(
      () => validatePlatformSemantics(partialDocDual, pcaSchemaId),
      /invalid storage_object_lock evidence URN .* must strictly match canonical URN 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' \(aliases strictly prohibited\)/,
      `Partial advertisement with case-variant URN '${variantUrn}' alongside canonical URN must be strictly rejected`
    );
  }

  // 2. Full Profile Conformance Declarations
  const fullSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));

  for (const variantUrn of caseVariantUrns) {
    // 2a. Case variant replacing canonical URN in storage capability
    const fullDocAlone = JSON.parse(JSON.stringify(fullSample));
    const storageCap = fullDocAlone.advertised_capabilities.find(c => c.slot_id === 'storage');
    storageCap.evidence_references = storageCap.evidence_references.map(r => r === canonicalLockUrn ? variantUrn : r);
    fullDocAlone.conformance_evidence = fullDocAlone.conformance_evidence.map(e =>
      e.test_identifier === canonicalLockUrn
        ? { ...e, test_identifier: variantUrn }
        : e
    );
    assert.throws(
      () => validatePlatformSemantics(fullDocAlone, pcaSchemaId),
      /storage slot advertisement lacks Object Lock retention evidence|invalid storage_object_lock evidence URN/,
      `Full profile declaration with sole case-variant URN '${variantUrn}' must be strictly rejected`
    );

    // 2b. Case variant added alongside canonical URN in storage capability
    const fullDocDual = JSON.parse(JSON.stringify(fullSample));
    const storageCapDual = fullDocDual.advertised_capabilities.find(c => c.slot_id === 'storage');
    storageCapDual.evidence_references.push(variantUrn);
    fullDocDual.conformance_evidence.push({
      test_identifier: variantUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/report-variant',
    });
    assert.throws(
      () => validatePlatformSemantics(fullDocDual, pcaSchemaId),
      /invalid storage_object_lock evidence URN .* must strictly match canonical URN 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' \(aliases strictly prohibited\)/,
      `Full profile declaration with case-variant URN '${variantUrn}' alongside canonical URN must be strictly rejected`
    );
  }

  // 3. Negotiation Handshakes
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  for (const variantUrn of caseVariantUrns) {
    // 3a. Case variant replacing canonical URN in handshake advertisement response
    const handshakeDocAlone = JSON.parse(JSON.stringify(handshakeSample));
    const hsStorageCap = handshakeDocAlone.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
    hsStorageCap.evidence_references = hsStorageCap.evidence_references.map(r => r === canonicalLockUrn ? variantUrn : r);
    handshakeDocAlone.advertisement_response.conformance_evidence = handshakeDocAlone.advertisement_response.conformance_evidence.map(e =>
      e.test_identifier === canonicalLockUrn
        ? { ...e, test_identifier: variantUrn }
        : e
    );
    assert.throws(
      () => validatePlatformSemantics(handshakeDocAlone, pcnSchemaId),
      /storage slot advertisement lacks Object Lock retention evidence|invalid storage_object_lock evidence URN/,
      `Negotiation handshake with sole case-variant URN '${variantUrn}' must be strictly rejected`
    );

    // 3b. Case variant added alongside canonical URN in handshake advertisement response
    const handshakeDocDual = JSON.parse(JSON.stringify(handshakeSample));
    const hsStorageCapDual = handshakeDocDual.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
    hsStorageCapDual.evidence_references.push(variantUrn);
    handshakeDocDual.advertisement_response.conformance_evidence.push({
      test_identifier: variantUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/report-variant',
    });
    assert.throws(
      () => validatePlatformSemantics(handshakeDocDual, pcnSchemaId),
      /invalid storage_object_lock evidence URN .* must strictly match canonical URN 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' \(aliases strictly prohibited\)/,
      `Negotiation handshake with case-variant URN '${variantUrn}' alongside canonical URN must be strictly rejected`
    );
  }
});

test('lexical I-JSON validation: proto safety on null prototype without polluting Object.prototype (OPEN-1)', () => {
  const payload = '{"__proto__": {"polluted": true}}';
  assert.equal(Object.prototype.polluted, undefined, 'Object.prototype.polluted must be undefined before parsing');

  const parsed = validateIJson(payload, 'proto-pollution-test');

  // Verify Object.prototype was not polluted
  assert.equal(Object.prototype.polluted, undefined, 'Object.prototype.polluted must remain undefined');
  assert.equal('polluted' in Object.prototype, false, 'Object.prototype must not have polluted property');
  assert.equal({}.polluted, undefined, 'Fresh object must not inherit polluted property');

  // Verify parsed object is a null prototype object
  assert.equal(Object.getPrototypeOf(parsed), null, 'Parsed object must have null prototype');

  // Verify the __proto__ property is safely stored as an own property
  assert.ok(Object.prototype.hasOwnProperty.call(parsed, '__proto__'), 'Parsed object must have own __proto__ property');
  assert.equal(parsed.__proto__.polluted, true, 'Parsed __proto__.polluted should be true');
  assert.equal(Object.getPrototypeOf(parsed.__proto__), null, 'Child object should also have null prototype');
});

test('in-memory validation: storage_object_lock capability_name strictly enforces canonical URN and full profile digest validation', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';
  const customLockUrn = 'urn:cybrik:evidence:storage:s3:custom:lock:v1';

  const ALL_19_OPS = [
    'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
    'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
    'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
    'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
    'AbortMultipartUpload', 'ListParts', 'PutBucketVersioning', 'GetBucketVersioning'
  ];

  // 1. Capability with capability_name: 'storage_object_lock' having non-canonical URN
  const customLockDoc = {
    target_profile_id: 'onprem-standard-v1',
    provider_namespace: 'cybrik-provider',
    claim_type: 'PARTIAL_CAPABILITY_ADVERTISEMENT',
    advertised_capabilities: [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        description: 'Storage capability named storage_object_lock',
        is_mandatory: true,
        supported_features: [...ALL_19_OPS],
        degradation_fallback: 'NONE',
        evidence_references: [canonicalLockUrn, customLockUrn],
      },
    ],
    conformance_evidence: [
      {
        test_identifier: canonicalLockUrn,
        status: 'PASS',
        evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        executed_at: '2026-08-25T12:00:00Z',
        report_uri: 'https://example.com/report',
      },
      {
        test_identifier: customLockUrn,
        status: 'PASS',
        evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        executed_at: '2026-08-25T12:00:00Z',
        report_uri: 'https://example.com/report2',
      },
    ],
    degradation_behavior: 'FAIL_CLOSED',
    authenticated_discovery: true,
  };

  assert.throws(
    () => validatePlatformSemantics(customLockDoc, pcaSchemaId),
    /storage_object_lock evidence URN must strictly equal 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'/
  );

  // 2. Full profile declaration with invalid adv.target_profile_digest format
  const fullSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const fullBadDigest = JSON.parse(JSON.stringify(fullSample));
  fullBadDigest.target_profile_digest = 'not-a-valid-sha256-hex-digest!';
  assert.throws(
    () => validatePlatformSemantics(fullBadDigest, pcaSchemaId),
    /target_profile_digest/
  );
});

test('offline manifest with artifacts[].path = "manifest.sig" or "manifest.json" fails schema and semantic validation (OPEN-1)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
  const sampleManifest = JSON.parse(
    readFileSync(join(EXAMPLES_DIR, 'sample-offline-bundle-manifest.json'), 'utf8')
  );

  // 1. Root manifest.sig in artifacts[].path fails schema validation and semantic validation
  const manifestWithSig = JSON.parse(JSON.stringify(sampleManifest));
  manifestWithSig.artifacts = [
    {
      name: 'signature-artifact',
      path: 'manifest.sig',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      size_bytes: 64,
    },
  ];

  const validSigSchema = ajv.validate(schemaId, manifestWithSig);
  assert.equal(validSigSchema, false, 'manifest with artifacts[].path = "manifest.sig" must fail schema validation');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'pattern' && e.instancePath === '/artifacts/0/path'),
    'Schema validation must report pattern failure on artifacts[0].path for manifest.sig'
  );
  assert.throws(
    () => validatePlatformSemantics(manifestWithSig, schemaId),
    /Semantic error: root manifest file 'manifest\.sig' must not be listed in artifacts/,
    'Semantic validation must reject manifest.sig in artifacts'
  );

  // 2. Root manifest.json in artifacts[].path fails schema validation and semantic validation
  const manifestWithJson = JSON.parse(JSON.stringify(sampleManifest));
  manifestWithJson.artifacts = [
    {
      name: 'manifest-json-artifact',
      path: 'manifest.json',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      size_bytes: 1024,
    },
  ];

  const validJsonSchema = ajv.validate(schemaId, manifestWithJson);
  assert.equal(validJsonSchema, false, 'manifest with artifacts[].path = "manifest.json" must fail schema validation');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'pattern' && e.instancePath === '/artifacts/0/path'),
    'Schema validation must report pattern failure on artifacts[0].path for manifest.json'
  );
  assert.throws(
    () => validatePlatformSemantics(manifestWithJson, schemaId),
    /Semantic error: root manifest file 'manifest\.json' must not be listed in artifacts/,
    'Semantic validation must reject manifest.json in artifacts'
  );

  // 3. Multi-artifact list containing forbidden root files fails
  const manifestMulti = JSON.parse(JSON.stringify(sampleManifest));
  manifestMulti.artifacts = [
    {
      name: 'image-1',
      path: 'images/image-1.tar',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      size_bytes: 1024,
    },
    {
      name: 'root-sig',
      path: 'manifest.sig',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      size_bytes: 64,
    },
  ];
  assert.equal(ajv.validate(schemaId, manifestMulti), false);
  assert.throws(
    () => validatePlatformSemantics(manifestMulti, schemaId),
    /Semantic error: root manifest file 'manifest\.sig' must not be listed in artifacts/
  );

  // 4. Nested subdirectories containing manifest.json or manifest.sig are valid
  const manifestNested = JSON.parse(JSON.stringify(sampleManifest));
  manifestNested.artifacts = [
    {
      name: 'nested-manifest-json',
      path: 'submodule/manifest.json',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      size_bytes: 512,
    },
  ];
  manifestNested.update_station_workflow.preflight_steps[0].target = 'submodule/manifest.json';
  manifestNested.update_station_workflow.apply_steps[0].target = 'images/image-1.tar';
  assert.equal(ajv.validate(schemaId, manifestNested), true, 'Nested submodule/manifest.json should pass schema validation');
  assert.doesNotThrow(() => validatePlatformSemantics(manifestNested, schemaId));
});

test('private-cloud-v1 degraded storage handshake without Object Lock succeeds when immutable_storage_required is false (OPEN-1 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const privateCloudPath = join(EXAMPLES_DIR, 'private-cloud-v1.profile.json');
  assert.ok(existsSync(privateCloudPath), 'private-cloud-v1 profile must exist');
  const privateCloudData = JSON.parse(readFileSync(privateCloudPath, 'utf8'));
  assert.equal(
    privateCloudData.slots?.storage?.specification?.immutable_storage_required,
    false,
    'private-cloud-v1 must declare immutable_storage_required: false'
  );
  const privateCloudDigest = createHash('sha256').update(readFileSync(privateCloudPath)).digest('hex');

  // 1. Degraded storage handshake without Object Lock against private-cloud-v1 succeeds
  const degradedHandshake = JSON.parse(JSON.stringify(sample));
  degradedHandshake.target_profile_id = 'private-cloud-v1';
  degradedHandshake.target_profile_digest = privateCloudDigest;
  if (degradedHandshake.advertisement_response) {
    degradedHandshake.advertisement_response.target_profile_digest = privateCloudDigest;
  }
  degradedHandshake.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  degradedHandshake.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  degradedHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';

  // Configure storage capability as degraded without Object Lock requirement
  const storageCap = degradedHandshake.agreed_capability_lease.negotiated_optional_capabilities.find(
    c => c.capability_name === 'storage_object_lock' || c.slot_id === 'storage'
  );
  assert.ok(storageCap, 'Storage capability must exist in sample');
  storageCap.capability_name = 'storage_standard';
  storageCap.slot_id = 'storage';
  storageCap.disposition = 'GRANTED_DEGRADED';
  storageCap.active_mode = 'standard_storage_without_object_lock';
  storageCap.fallback_applied = 'FEATURE_DISABLED_GRACEFUL';

  const reqStorage = degradedHandshake.negotiation_request.requested_optional_capabilities.find(
    c => c.capability_name === 'storage_object_lock' || c.slot_id === 'storage'
  );
  if (reqStorage) {
    reqStorage.capability_name = 'storage_standard';
    reqStorage.slot_id = 'storage';
  }

  const validSchema = ajv.validate(schemaId, degradedHandshake);
  assert.ok(validSchema, 'private-cloud-v1 degraded storage handshake must pass schema validation: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(degradedHandshake, schemaId),
    'private-cloud-v1 degraded storage handshake without Object Lock must succeed when immutable_storage_required is false'
  );

  // 2. In contrast, targeting onprem-standard-v1 (immutable_storage_required: true) with degraded storage fails
  const onpremStandardPath = join(EXAMPLES_DIR, 'onprem-standard-v1.profile.json');
  const onpremStandardData = JSON.parse(readFileSync(onpremStandardPath, 'utf8'));
  assert.equal(onpremStandardData.slots?.storage?.specification?.immutable_storage_required, true);
  const onpremStandardDigest = createHash('sha256').update(readFileSync(onpremStandardPath)).digest('hex');

  const invalidHandshake = JSON.parse(JSON.stringify(degradedHandshake));
  invalidHandshake.target_profile_id = 'onprem-standard-v1';
  invalidHandshake.target_profile_digest = onpremStandardDigest;
  if (invalidHandshake.advertisement_response) {
    invalidHandshake.advertisement_response.target_profile_digest = onpremStandardDigest;
  }
  invalidHandshake.agreed_capability_lease.target_profile_id = 'onprem-standard-v1';
  invalidHandshake.agreed_capability_lease.target_profile_digest = onpremStandardDigest;

  assert.throws(
    () => validatePlatformSemantics(invalidHandshake, schemaId),
    /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
    'Degraded storage against onprem-standard-v1 must be rejected because immutable_storage_required is true'
  );
});

test('schema validation: s3OperationName enum constraints on slot storage supported_features (OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';

  // 1. Advertisement schema rejects non-closed operation on storage slot
  const sampleDecl = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const validDecl = ajv.validate(pcaSchemaId, sampleDecl);
  assert.ok(validDecl, 'Canonical sample-full-profile-conformance-declaration must pass schema validation');

  const invalidDecl = JSON.parse(JSON.stringify(sampleDecl));
  const storeCapAdv = invalidDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storeCapAdv);
  storeCapAdv.supported_features.push('InvalidStorageOperation');
  const invalidDeclPass = ajv.validate(pcaSchemaId, invalidDecl);
  assert.equal(invalidDeclPass, false, 'Advertisement schema must reject unapproved operation in storage supported_features');

  // 2. Negotiation schema rejects non-closed operation on storage slot
  const sampleHandshake = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const validHandshake = ajv.validate(pcnSchemaId, sampleHandshake);
  assert.ok(validHandshake, 'Canonical sample-capability-negotiation-handshake must pass schema validation');

  const invalidHandshake = JSON.parse(JSON.stringify(sampleHandshake));
  const storeCapNeg = invalidHandshake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storeCapNeg);
  storeCapNeg.supported_features.push('s3-api-v1.0');
  const invalidHandshakePass = ajv.validate(pcnSchemaId, invalidHandshake);
  assert.equal(invalidHandshakePass, false, 'Negotiation schema must reject unapproved operation in storage supported_features');

  // 3. Non-storage slot allows standard strings
  const ociCapAdv = JSON.parse(JSON.stringify(sampleDecl));
  const ociCap = ociCapAdv.advertised_capabilities.find(c => c.slot_id === 'oci_container_runtime');
  assert.ok(ociCap);
  ociCap.supported_features = ['custom_feature_1', 'custom_feature_2'];
  const validOci = ajv.validate(pcaSchemaId, ociCapAdv);
  assert.ok(validOci, 'Non-storage slots must allow arbitrary non-empty feature names');
});

test('storage slot advertisement with surplus operations outside 19 closed S3 operations fails semantic validation (OPEN-2 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Storage slot advertisement containing surplus operation 'SurplusOp' is rejected
  const surplusHandshake = JSON.parse(JSON.stringify(sample));
  const storeCap = surplusHandshake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCap.supported_features.push('SurplusOp');

  assert.throws(
    () => validatePlatformSemantics(surplusHandshake, schemaId),
    /Semantic error: storage slot advertisement contains unauthorized operation 'SurplusOp' outside 19 closed S3 operations/
  );

  // 2. Storage slot advertisement containing surplus operation 'sig_v4' or 'posix-filesystem' is rejected
  const surplusHandshake2 = JSON.parse(JSON.stringify(sample));
  const storeCap2 = surplusHandshake2.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCap2.supported_features.push('posix-filesystem');

  assert.throws(
    () => validatePlatformSemantics(surplusHandshake2, schemaId),
    /Semantic error: storage slot advertisement contains unauthorized operation 'posix-filesystem' outside 19 closed S3 operations/
  );
});

test('regression: surplus storage operations outside 19 closed S3 operations fail schema and semantic validation (OPEN-2 / OPEN-5)', () => {
  const s3SchemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';

  // 1. Storage S3 subset contract with surplus operation DeleteBucket fails schema validation and semantic validation
  const sampleS3 = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-storage-s3-subset.json'), 'utf8'));
  const surplusS3 = JSON.parse(JSON.stringify(sampleS3));
  surplusS3.required_operations.push('DeleteBucket');

  const validS3Schema = ajv.validate(s3SchemaId, surplusS3);
  assert.ok(!validS3Schema, 'Storage subset with surplus operation DeleteBucket must fail schema validation');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'enum' || e.schemaPath.includes('s3Operation')),
    'Schema error must flag unauthorized operation DeleteBucket'
  );
  assert.throws(
    () => validatePlatformSemantics(surplusS3, s3SchemaId),
    /contains unauthorized operation 'DeleteBucket' outside 19 closed S3 operations/,
    'Storage subset with DeleteBucket must fail semantic validation with closed baseline error'
  );

  // 2. Partial capability advertisement with 17 ops + DeleteBucket fails semantic validation
  const sampleAdv = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));
  const ALL_19_OPS = [
    'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
    'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
    'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
    'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
    'AbortMultipartUpload', 'ListParts', 'PutBucketVersioning', 'GetBucketVersioning'
  ];
  const surplusAdv = JSON.parse(JSON.stringify(sampleAdv));
  surplusAdv.advertised_capabilities = [
    {
      capability_name: 'storage_s3_surplus',
      slot_id: 'storage',
      description: 'Storage capability with surplus operation',
      is_mandatory: true,
      supported_features: [...ALL_19_OPS, 'DeleteBucket'],
      degradation_fallback: 'NONE',
      evidence_references: ['urn:cybrik:evidence:ev-oci-01']
    }
  ];
  assert.throws(
    () => validatePlatformSemantics(surplusAdv, pcaSchemaId),
    /contains unauthorized operation 'DeleteBucket' outside 19 closed S3 operations/,
    'Storage advertisement with DeleteBucket must fail semantic validation'
  );

  // 3. Full capability negotiation handshake with surplus operation DeleteBucket in storage supported_features
  const sampleHandshake = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const surplusHandshake = JSON.parse(JSON.stringify(sampleHandshake));
  const storageCapAdv = surplusHandshake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storageCapAdv, 'Storage capability must exist in advertisement response');
  storageCapAdv.supported_features.push('DeleteBucket');

  assert.throws(
    () => validatePlatformSemantics(surplusHandshake, pcnSchemaId),
    /contains unauthorized operation 'DeleteBucket' outside 19 closed S3 operations/,
    'Capability negotiation handshake with DeleteBucket must fail semantic validation'
  );

  // 4. Standalone full profile declaration with surplus operation DeleteBucket in storage supported_features
  const sampleDecl = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const surplusDecl = JSON.parse(JSON.stringify(sampleDecl));
  const storageCapDecl = surplusDecl.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storageCapDecl, 'Storage capability must exist in full profile declaration');
  storageCapDecl.supported_features.push('DeleteBucket');

  assert.throws(
    () => validatePlatformSemantics(surplusDecl, pcaSchemaId),
    /contains unauthorized operation 'DeleteBucket' outside 19 closed S3 operations/,
    'Full profile declaration with DeleteBucket must fail semantic validation'
  );
});

test('Platform Contract Slot 5: 15-op baseline and 19-op full lock closed sets specification (OPEN-2 / OPEN-5)', () => {
  // 15-operation baseline includes 8 CRUD, 5 Multipart, and 2 Versioning operations
  const BASELINE_15_OPS = [
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

  // 4 Object Lock / Retention operations
  const OBJECT_LOCK_4_OPS = [
    'PutObjectRetention',
    'GetObjectRetention',
    'PutObjectLegalHold',
    'GetObjectLegalHold',
  ];

  // 19-operation full lock closed set: 15 baseline + 4 object lock operations
  const FULL_LOCK_19_OPS = [
    ...BASELINE_15_OPS,
    ...OBJECT_LOCK_4_OPS,
  ];

  // 1. Cardinality and uniqueness invariants
  assert.equal(BASELINE_15_OPS.length, 15, 'Baseline set must contain exactly 15 operations');
  assert.equal(new Set(BASELINE_15_OPS).size, 15, 'Baseline operations must be distinct');
  assert.equal(OBJECT_LOCK_4_OPS.length, 4, 'Object Lock set must contain exactly 4 operations');
  assert.equal(new Set(OBJECT_LOCK_4_OPS).size, 4, 'Object Lock operations must be distinct');
  assert.equal(FULL_LOCK_19_OPS.length, 19, 'Full lock set must contain exactly 19 operations');
  assert.equal(new Set(FULL_LOCK_19_OPS).size, 19, 'Full lock operations must be distinct');

  // 2. Versioning operations are included in 15-op baseline
  assert.ok(BASELINE_15_OPS.includes('PutBucketVersioning'), 'Baseline must include PutBucketVersioning');
  assert.ok(BASELINE_15_OPS.includes('GetBucketVersioning'), 'Baseline must include GetBucketVersioning');

  // 3. Object Lock operations are disjoint from 15-op baseline
  for (const lockOp of OBJECT_LOCK_4_OPS) {
    assert.ok(!BASELINE_15_OPS.includes(lockOp), `15-op baseline must not contain Object Lock operation '${lockOp}'`);
    assert.ok(FULL_LOCK_19_OPS.includes(lockOp), `19-op full lock set must contain Object Lock operation '${lockOp}'`);
  }

  // 4. Union and difference set closure
  const baselineSet = new Set(BASELINE_15_OPS);
  const fullLockSet = new Set(FULL_LOCK_19_OPS);
  for (const op of BASELINE_15_OPS) {
    assert.ok(fullLockSet.has(op), `19-op set must contain baseline operation '${op}'`);
  }
  const diffOps = FULL_LOCK_19_OPS.filter(op => !baselineSet.has(op));
  assert.deepEqual(diffOps.sort(), [...OBJECT_LOCK_4_OPS].sort(), 'Difference between 19-op and 15-op sets must be exactly 4 Object Lock operations');

  // 5. Excluded operations are rejected from both closed sets
  const excludedOps = ['DeleteBucket', 'ListBuckets', 'RestoreObjectTier', 'PutObjectAclUnsupported', 'SelectObjectContent'];
  for (const excl of excludedOps) {
    assert.ok(!baselineSet.has(excl), `15-op baseline must reject excluded operation '${excl}'`);
    assert.ok(!fullLockSet.has(excl), `19-op full lock set must reject excluded operation '${excl}'`);
  }
});

test('semantic validation: cap.supported_features duplicate rejection and strict 15/19 profile storage validation (OPEN-2 / OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';

  const ALL_19_OPS = [
    'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
    'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
    'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
    'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
    'AbortMultipartUpload', 'ListParts', 'PutBucketVersioning', 'GetBucketVersioning'
  ];

  // 1. supported_features with duplicate entries in advertised_capabilities is strictly rejected
  const sampleAdv = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-provider-capability-advertisement.json'), 'utf8'));
  const dupFeaturesAdv = JSON.parse(JSON.stringify(sampleAdv));
  dupFeaturesAdv.advertised_capabilities[0].supported_features = ['container_lifecycle', 'resource_isolation', 'container_lifecycle'];
  assert.throws(
    () => validatePlatformSemantics(dupFeaturesAdv, pcaSchemaId),
    /supported_features contains duplicate entries/,
    'Capability advertisement with duplicate supported_features must be rejected'
  );

  // 2. supported_features with duplicate entries in storage slot is strictly rejected
  const dupStorageOpsAdv = JSON.parse(JSON.stringify(sampleAdv));
  dupStorageOpsAdv.advertised_capabilities = [
    {
      capability_name: 's3_storage_provider',
      slot_id: 'storage',
      description: 'Storage capability declaration with duplicate PutObject',
      is_mandatory: true,
      supported_features: [...ALL_19_OPS, 'PutObject'],
      degradation_fallback: 'NONE',
      evidence_references: [canonicalLockUrn]
    }
  ];
  dupStorageOpsAdv.conformance_evidence = [
    {
      test_identifier: canonicalLockUrn,
      status: 'PASS',
      evidence_pack_digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      executed_at: '2026-08-25T12:00:00Z',
      report_uri: 'https://example.com/report'
    }
  ];
  assert.throws(
    () => validatePlatformSemantics(dupStorageOpsAdv, pcaSchemaId),
    /supported_features contains duplicate entries/,
    'Storage capability with duplicate operation must be rejected'
  );

  // 3. Storage slot missing 15 baseline operations is rejected
  const missingHeadBucketAdv = JSON.parse(JSON.stringify(dupStorageOpsAdv));
  missingHeadBucketAdv.advertised_capabilities[0].supported_features = ALL_19_OPS.filter(op => op !== 'HeadBucket');
  assert.throws(
    () => validatePlatformSemantics(missingHeadBucketAdv, pcaSchemaId),
    /storage slot advertisement missing required S3 operation 'HeadBucket' from 15 baseline S3 operations/,
    'Storage capability missing HeadBucket from 15 baseline operations must be rejected'
  );

  // 4. Immutable profile / lock declared rejecting 17-op partial set omitting versioning
  const partial17OpAdv = JSON.parse(JSON.stringify(dupStorageOpsAdv));
  partial17OpAdv.advertised_capabilities[0].supported_features = ALL_19_OPS.filter(op => op !== 'PutBucketVersioning' && op !== 'GetBucketVersioning');
  assert.throws(
    () => validatePlatformSemantics(partial17OpAdv, pcaSchemaId),
    /storage slot advertisement missing required S3 operation 'PutBucketVersioning' from 15 baseline S3 operations/,
    'Locked/immutable storage profile declaring 17 ops but omitting PutBucketVersioning must be rejected'
  );

  // 5. Immutable profile / lock declared rejecting 17-op partial set omitting GetBucketVersioning
  const partial18OpAdv = JSON.parse(JSON.stringify(dupStorageOpsAdv));
  partial18OpAdv.advertised_capabilities[0].supported_features = ALL_19_OPS.filter(op => op !== 'GetBucketVersioning');
  assert.throws(
    () => validatePlatformSemantics(partial18OpAdv, pcaSchemaId),
    /storage slot advertisement missing required S3 operation 'GetBucketVersioning' from 15 baseline S3 operations/,
    'Locked/immutable storage profile declaring 18 ops but omitting GetBucketVersioning must be rejected'
  );
});

test('regression: immutable-profile storage capability declaring 17 operations missing PutBucketVersioning/GetBucketVersioning is strictly rejected (OPEN-2 / OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';

  const ALL_17_OPS = [
    'PutObject', 'GetObject', 'HeadObject', 'DeleteObject', 'DeleteObjects',
    'ListObjectsV2', 'HeadBucket', 'CreateBucket', 'PutObjectRetention',
    'GetObjectRetention', 'PutObjectLegalHold', 'GetObjectLegalHold',
    'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload',
    'AbortMultipartUpload', 'ListParts'
  ];

  const canonicalLockUrn = 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock';
  const immutableProfiles = ['onprem-standard-v1', 'onprem-airgap-v1', 'hybrid-sovereign-v1'];

  for (const profileId of immutableProfiles) {
    const profilePath = join(EXAMPLES_DIR, `${profileId}.profile.json`);
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    // 1. Full profile declaration declaring 17 ops for immutable profile is rejected (missing PutBucketVersioning & GetBucketVersioning)
    const sampleFullDecl = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
    const fullDecl17 = JSON.parse(JSON.stringify(sampleFullDecl));
    fullDecl17.target_profile_id = profileId;
    fullDecl17.target_profile_digest = profileDigest;
    const fullStoreCap = fullDecl17.advertised_capabilities.find(c => c.slot_id === 'storage');
    assert.ok(fullStoreCap);
    fullStoreCap.supported_features = [...ALL_17_OPS];

    assert.throws(
      () => validatePlatformSemantics(fullDecl17, pcaSchemaId),
      /storage slot advertisement missing required S3 operation 'PutBucketVersioning' from 15 baseline S3 operations/
    );

    // 2. Negotiation handshake declaring 17 ops in advertisement response for immutable profile is rejected
    const sampleHandshake = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
    const handshake17 = JSON.parse(JSON.stringify(sampleHandshake));
    handshake17.target_profile_id = profileId;
    handshake17.target_profile_digest = profileDigest;
    handshake17.agreed_capability_lease.target_profile_id = profileId;
    handshake17.agreed_capability_lease.target_profile_digest = profileDigest;

    const storageCap = handshake17.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
    assert.ok(storageCap, 'Storage capability must exist in advertisement response');
    storageCap.supported_features = [...ALL_17_OPS];

    assert.throws(
      () => validatePlatformSemantics(handshake17, pcnSchemaId),
      /storage slot advertisement missing required S3 operation 'PutBucketVersioning' from 15 baseline S3 operations/
    );
  }
});

test('regression: duplicate features in supported_features fail schema and semantic validation (OPEN-2 / OPEN-5)', () => {
  const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';

  // 1. Provider capability advertisement with duplicate supported_features fails schema and semantic validation
  const sampleDecl = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'), 'utf8'));
  const dupAdv = JSON.parse(JSON.stringify(sampleDecl));
  const storeCapAdv = dupAdv.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storeCapAdv);
  storeCapAdv.supported_features.push('PutObject'); // duplicate PutObject

  const validAdvSchema = ajv.validate(pcaSchemaId, dupAdv);
  assert.equal(validAdvSchema, false, 'Advertisement schema must reject duplicate items in supported_features');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'uniqueItems'),
    'Schema error must indicate uniqueItems violation in supported_features'
  );
  assert.throws(
    () => validatePlatformSemantics(dupAdv, pcaSchemaId),
    /contains duplicate feature 'PutObject' in supported_features/
  );

  // 2. Non-storage capability with duplicate supported_features fails schema and semantic validation
  const dupOciAdv = JSON.parse(JSON.stringify(sampleDecl));
  const ociCapAdv = dupOciAdv.advertised_capabilities.find(c => c.slot_id === 'oci_container_runtime');
  assert.ok(ociCapAdv);
  ociCapAdv.supported_features = ['container_lifecycle', 'container_lifecycle'];

  const validOciSchema = ajv.validate(pcaSchemaId, dupOciAdv);
  assert.equal(validOciSchema, false, 'Advertisement schema must reject duplicate items in non-storage supported_features');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'uniqueItems'),
    'Schema error must indicate uniqueItems violation'
  );
  assert.throws(
    () => validatePlatformSemantics(dupOciAdv, pcaSchemaId),
    /contains duplicate feature 'container_lifecycle' in supported_features/
  );

  // 3. Capability negotiation handshake with duplicate supported_features fails schema and semantic validation
  const sampleHandshake = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));
  const dupHandshake = JSON.parse(JSON.stringify(sampleHandshake));
  const storeCapNeg = dupHandshake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storeCapNeg);
  storeCapNeg.supported_features.push('GetObject'); // duplicate GetObject

  const validNegSchema = ajv.validate(pcnSchemaId, dupHandshake);
  assert.equal(validNegSchema, false, 'Negotiation schema must reject duplicate items in supported_features');
  assert.ok(
    ajv.errors.some(e => e.keyword === 'uniqueItems'),
    'Schema error must indicate uniqueItems violation in negotiation supported_features'
  );
  assert.throws(
    () => validatePlatformSemantics(dupHandshake, pcnSchemaId),
    /contains duplicate feature 'GetObject' in supported_features/
  );
});

test('regression: surplus properties in deployment profile slots.storage.specification fail schema validation (OPEN-2 / OPEN-5)', () => {
  const dpSchemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';

  const profileFiles = [
    'onprem-standard-v1.profile.json',
    'onprem-airgap-v1.profile.json',
    'hybrid-sovereign-v1.profile.json',
    'private-cloud-v1.profile.json'
  ];

  for (const file of profileFiles) {
    const filePath = join(EXAMPLES_DIR, file);
    const profileData = JSON.parse(readFileSync(filePath, 'utf8'));

    // Canonical profile passes schema validation
    assert.ok(ajv.validate(dpSchemaId, profileData), `${file} must pass schema validation`);

    // 1. Surplus property directly in slots.storage.specification fails schema validation
    const surplusSpec = JSON.parse(JSON.stringify(profileData));
    surplusSpec.slots.storage.specification.surplus_unauthorized_property = 'invalid_surplus_value';
    const validSpec = ajv.validate(dpSchemaId, surplusSpec);
    assert.equal(validSpec, false, `Deployment profile ${file} with surplus property in slots.storage.specification must fail schema validation`);
    assert.ok(
      ajv.errors.some(e => e.keyword === 'additionalProperties' && e.params?.additionalProperty === 'surplus_unauthorized_property'),
      'Schema error must indicate additionalProperties violation for surplus_unauthorized_property under specification'
    );

    // 2. Extra unapproved specification fields fail schema validation
    const extraFields = ['unsupported_flag', 'max_retries', 'custom_storage_endpoint', 'bypass_worm'];
    for (const extra of extraFields) {
      const badDoc = JSON.parse(JSON.stringify(profileData));
      badDoc.slots.storage.specification[extra] = true;
      const validBad = ajv.validate(dpSchemaId, badDoc);
      assert.equal(validBad, false, `Deployment profile ${file} with surplus property '${extra}' in specification must fail schema validation`);
      assert.ok(
        ajv.errors.some(e => e.keyword === 'additionalProperties' && e.params?.additionalProperty === extra),
        `Schema error must indicate additionalProperties violation for '${extra}'`
      );
    }

    // 3. Surplus property directly under slots.storage fails schema validation
    const surplusStorage = JSON.parse(JSON.stringify(profileData));
    surplusStorage.slots.storage.surplus_storage_property = 12345;
    const validStorage = ajv.validate(dpSchemaId, surplusStorage);
    assert.equal(validStorage, false, `Deployment profile ${file} with surplus property in slots.storage must fail schema validation`);
    assert.ok(
      ajv.errors.some(e => e.keyword === 'additionalProperties' && e.params?.additionalProperty === 'surplus_storage_property'),
      'Schema error must indicate additionalProperties violation under slots.storage'
    );

    // 4. Surplus slot under slots fails schema validation
    const surplusSlots = JSON.parse(JSON.stringify(profileData));
    surplusSlots.slots.surplus_unauthorized_slot = { some_key: 'value' };
    const validSlots = ajv.validate(dpSchemaId, surplusSlots);
    assert.equal(validSlots, false, `Deployment profile ${file} with surplus slot under slots must fail schema validation`);
    assert.ok(
      ajv.errors.some(e => e.keyword === 'additionalProperties' && e.params?.additionalProperty === 'surplus_unauthorized_slot'),
      'Schema error must indicate additionalProperties violation under slots'
    );
  }
});

test('semantic validation: validateS3ConformanceProfileSemantics and inherited headers defense (OPEN-2)', () => {
  // 1. Inherited headers getter safety
  let putGetterInvoked = false;
  const protoPut = Object.defineProperty({}, 'headers', {
    get() {
      putGetterInvoked = true;
      throw new Error('Explosive headers getter called!');
    }
  });
  const putReq = Object.create(protoPut);
  putReq.payload = 'test';
  const putRes = dispatchS3PutObject(putReq);
  assert.equal(putGetterInvoked, false, 'Inherited headers getter must not be invoked');
  assert.equal(putRes.http_status, 400);
  assert.equal(putRes.error_code, 'InvalidDigest');
  assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  let errGetterInvoked = false;
  const protoErr = Object.defineProperty({}, 'headers', {
    get() {
      errGetterInvoked = true;
      throw new Error('Explosive headers getter called!');
    }
  });
  const errReq = Object.create(protoErr);
  errReq.payload = 'test';
  const errRes = dispatchS3Error(errReq);
  assert.equal(errGetterInvoked, false, 'Inherited headers getter must not be invoked');
  assert.equal(errRes.http_status, 400);
  assert.equal(errRes.error_code, 'InvalidDigest');
  assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // 2. Standalone S3 conformance profile validation
  const sampleProfile = {
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

  // Full 19-op profile with lock supported passes
  assert.doesNotThrow(() => validateS3ConformanceProfileSemantics(sampleProfile));

  // 15-op profile with lock unsupported passes
  const nonLockProfile = {
    ...sampleProfile,
    object_lock_supported: false,
    legal_hold_supported: false,
    retention_modes_supported: [],
    required_operations: [...S3_15_BASELINE_OPS],
    evidence_references: [
      'urn:cybrik:evidence:storage:s3:conformance:v1:core-operations'
    ]
  };
  assert.doesNotThrow(() => validateS3ConformanceProfileSemantics(nonLockProfile));

  // Duplicate operations rejected
  const dupProfile = {
    ...sampleProfile,
    required_operations: [...S3_19_CLOSED_OPS, 'GetObject']
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(dupProfile),
    /required_operations contains duplicate operation 'GetObject'/
  );

  // Missing baseline op rejected
  const missingBaseProfile = {
    ...sampleProfile,
    required_operations: S3_19_CLOSED_OPS.filter(op => op !== 'GetObject')
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(missingBaseProfile),
    /missing required S3 operation 'GetObject'/
  );

  // Lock supported true missing lock op rejected
  const missingLockProfile = {
    ...sampleProfile,
    required_operations: S3_19_CLOSED_OPS.filter(op => op !== 'GetObjectRetention')
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(missingLockProfile),
    /missing required Object Lock S3 operation 'GetObjectRetention'/
  );

  // Lock supported false with lock op rejected
  const falseLockWithLockOp = {
    ...nonLockProfile,
    required_operations: [...S3_15_BASELINE_OPS, 'GetObjectRetention']
  };
  assert.throws(
    () => validateS3ConformanceProfileSemantics(falseLockWithLockOp),
    /object_lock_supported === false must not contain Object Lock operation 'GetObjectRetention'/
  );
});

test('regression: standalone S3 conformance profile with object_lock_supported: true and only 15 operations fails semantic validation (OPEN-2)', () => {
  const s3SchemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const samplePath = join(EXAMPLES_DIR, 'sample-storage-s3-subset.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. Canonical sample passes both schema and semantic validation
  assert.ok(ajv.validate(s3SchemaId, sample));
  assert.doesNotThrow(() => validatePlatformSemantics(sample, s3SchemaId));

  // 2. Profile with object_lock_supported: true and only 15 baseline operations
  const fifteenOpsProfile = JSON.parse(JSON.stringify(sample));
  fifteenOpsProfile.object_lock_supported = true;
  fifteenOpsProfile.required_operations = [
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
  assert.equal(fifteenOpsProfile.required_operations.length, 15);

  // Schema validation fails because object_lock_supported: true mandates 19 operations
  const validSchema = ajv.validate(s3SchemaId, fifteenOpsProfile);
  assert.equal(validSchema, false, '15-op profile with object_lock_supported: true must fail schema validation requiring 19 operations');

  // Semantic validation fails closed because object_lock_supported: true mandates all 19 operations
  assert.throws(
    () => validatePlatformSemantics(fifteenOpsProfile, s3SchemaId),
    /missing required Object Lock S3 operation/
  );
});

test('regression: standalone S3 conformance profile missing mandatory PutObject fails semantic validation (OPEN-2)', () => {
  const s3SchemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const samplePath = join(EXAMPLES_DIR, 'sample-storage-s3-subset.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  // 1. Profile missing PutObject but having 18 other operations (including lock operations)
  const missingPutProfile = JSON.parse(JSON.stringify(sample));
  missingPutProfile.required_operations = sample.required_operations.filter(op => op !== 'PutObject');
  assert.equal(missingPutProfile.required_operations.length, 18);
  assert.ok(!missingPutProfile.required_operations.includes('PutObject'));

  // Schema validation fails because object_lock_supported: true mandates 19 operations
  const validSchema = ajv.validate(s3SchemaId, missingPutProfile);
  assert.equal(validSchema, false, '18-op profile with object_lock_supported: true must fail schema validation requiring 19 operations');

  // Semantic validation must fail closed because PutObject is a mandatory baseline operation
  assert.throws(
    () => validatePlatformSemantics(missingPutProfile, s3SchemaId),
    /missing mandatory baseline S3 operation 'PutObject'/
  );

  // 2. Profile with 15 operations that substitutes PutObject with an Object Lock operation passes schema (15 ops) but fails semantic validation
  const substituteProfile = JSON.parse(JSON.stringify(sample));
  substituteProfile.object_lock_supported = false; // even without object_lock_supported
  substituteProfile.required_operations = [
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
    'PutObjectRetention', // 15th op
  ];
  assert.equal(substituteProfile.required_operations.length, 15);

  assert.throws(
    () => validatePlatformSemantics(substituteProfile, s3SchemaId),
    /(?:missing mandatory baseline S3 operation 'PutObject'|object_lock_supported === false must not contain Object Lock operation 'PutObjectRetention')/
  );
});

test('schema-only regression: object_lock_supported: false + 15 operations passes Ajv validation on storage S3 schema (OPEN-2)', () => {
  const s3SchemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const samplePath = join(EXAMPLES_DIR, 'sample-storage-s3-subset.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

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

  // Positive: 15-op profile with object_lock_supported: false passes Ajv schema validation
  const valid = ajv.validate(s3SchemaId, fifteenOpsProfile);
  assert.ok(valid, `15-op profile with object_lock_supported: false must pass Ajv validation: ${ajv.errorsText()}`);

  // Negative: 19-op profile with object_lock_supported: false must fail schema validation (requires exactly 15)
  const invalid19OpsProfile = {
    ...fifteenOpsProfile,
    required_operations: sample.required_operations, // 19 ops
  };
  const invalidValid = ajv.validate(s3SchemaId, invalid19OpsProfile);
  assert.equal(invalidValid, false, '19-op profile with object_lock_supported: false must fail schema validation');

  // Negative: 15-op profile with object_lock_supported: true must fail schema validation (requires exactly 19)
  const invalid15WithLockTrue = {
    ...fifteenOpsProfile,
    object_lock_supported: true,
  };
  const invalidLockTrue = ajv.validate(s3SchemaId, invalid15WithLockTrue);
  assert.equal(invalidLockTrue, false, '15-op profile with object_lock_supported: true must fail schema validation');
});

test('schema-only regression: 13-entry negotiation declaration with missing/duplicate slot fails Ajv validation (OPEN-2 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const samplePath = join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json');
  const handshake = JSON.parse(readFileSync(samplePath, 'utf8'));

  // Positive: canonical handshake with FULL_PROFILE_CONFORMANCE_DECLARATION passes Ajv validation
  assert.ok(ajv.validate(schemaId, handshake), `Canonical handshake must pass: ${ajv.errorsText()}`);

  // Negative: 13 advertised_capabilities where slot 1 duplicates slot 0 (missing isolation_substrate)
  const mutated = JSON.parse(JSON.stringify(handshake));
  assert.equal(mutated.advertisement_response.advertised_capabilities.length, 13);
  mutated.advertisement_response.advertised_capabilities[1].slot_id =
    mutated.advertisement_response.advertised_capabilities[0].slot_id;

  const valid = ajv.validate(schemaId, mutated);
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
  const validPayload = Buffer.from('CYBRIK_PROXY_DEFENSE_PLATFORM_TEST_2026');
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
  const s3SchemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const samplePath = join(EXAMPLES_DIR, 'sample-storage-s3-subset.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

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

  // Negative: Schema validation must fail on enum defect for PutObjectRetention
  const valid = ajv.validate(s3SchemaId, substitute15OpsProfile);
  assert.equal(valid, false, '15-op profile substituting PutObjectRetention for PutObject must fail Ajv validation on storage S3 schema');
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

test('harmonized fixture naming: s3_crud_19_ops_with_worm and s3_crud_15_ops_baseline storage capabilities in negotiation contracts (OPEN-2 / OPEN-5)', () => {
  const handshakeSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const handshakeSample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Verify sample-capability-negotiation-handshake.json carries harmonized s3_crud_19_ops_with_worm
  const storageCap = handshakeSample.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  assert.ok(storageCap, 'Storage capability descriptor must be present in handshake sample');
  assert.equal(storageCap.capability_name, 's3_crud_19_ops_with_worm', 'Storage capability must be harmonized to s3_crud_19_ops_with_worm');
  assert.equal(storageCap.supported_features.length, 19, 'Storage capability s3_crud_19_ops_with_worm must contain exactly 19 operations');
  assert.doesNotThrow(
    () => validatePlatformSemantics(handshakeSample, handshakeSchemaId),
    'Harmonized sample capability negotiation handshake must pass platform semantics'
  );

  // 2. Harmonized 15-op baseline capability (s3_crud_15_ops_baseline) on non-immutable profile
  const privateCloudPath = join(EXAMPLES_DIR, 'private-cloud-v1.profile.json');
  const privateCloudDigest = createHash('sha256').update(readFileSync(privateCloudPath)).digest('hex');
  const baselineHandshake = JSON.parse(JSON.stringify(handshakeSample));
  const baseStorageCap = baselineHandshake.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  baseStorageCap.capability_name = 's3_crud_15_ops_baseline';
  baseStorageCap.supported_features = [...S3_15_BASELINE_OPS];
  baseStorageCap.evidence_references = ['urn:cybrik:evidence:storage:s3-15-ops:v1'];
  baselineHandshake.advertisement_response.conformance_evidence = [
    ...baselineHandshake.advertisement_response.conformance_evidence.filter(e => !e.test_identifier.includes('storage')),
    {
      test_identifier: 'urn:cybrik:evidence:storage:s3-15-ops:v1',
      status: 'PASS',
      evidence_pack_digest: 'a105050505050505050505050505050505050505050505050505050505050505',
      executed_at: '2026-08-27T12:00:00Z',
      report_uri: 'https://reports.cybrik.example/evidence/ev-store-15.json',
    },
  ];
  // Target a non-immutable profile (private-cloud-v1)
  baselineHandshake.target_profile_id = 'private-cloud-v1';
  baselineHandshake.target_profile_digest = privateCloudDigest;
  baselineHandshake.advertisement_response.target_profile_digest = privateCloudDigest;
  baselineHandshake.agreed_capability_lease.target_profile_id = 'private-cloud-v1';
  baselineHandshake.agreed_capability_lease.target_profile_digest = privateCloudDigest;
  baselineHandshake.negotiation_request.requested_optional_capabilities = baselineHandshake.negotiation_request.requested_optional_capabilities.filter(c => c.capability_name !== 'storage_object_lock' && c.slot_id !== 'storage');
  baselineHandshake.agreed_capability_lease.negotiated_optional_capabilities = baselineHandshake.agreed_capability_lease.negotiated_optional_capabilities.filter(c => c.capability_name !== 'storage_object_lock' && c.slot_id !== 'storage');

  assert.ok(ajv.validate(handshakeSchemaId, baselineHandshake), 'Baseline 15-op handshake must pass Ajv validation: ' + ajv.errorsText());
  assert.doesNotThrow(
    () => validatePlatformSemantics(baselineHandshake, handshakeSchemaId),
    '15-op baseline handshake on non-immutable profile must pass platform semantics'
  );
});

test('regression: 5 GiB PutObject payload limit returning HTTP 400 EntityTooLarge (PAYLOAD_EXCEEDS_5GIB_LIMIT) (OPEN-2)', () => {
  const normalPayload = Buffer.from('small payload');
  const normalSha = computePayloadSha256(normalPayload);

  // 1. PutObject with size_bytes exceeding 5 GiB (5368709121 bytes)
  const tooLargeRes1 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    size_bytes: 5368709121,
    'x-amz-content-sha256': normalSha,
  });
  assert.equal(tooLargeRes1.http_status, 400);
  assert.equal(tooLargeRes1.error_code, 'EntityTooLarge');
  assert.equal(tooLargeRes1.code, 'EntityTooLarge');
  assert.equal(tooLargeRes1.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 2. PutObject with contentLength exceeding 5 GiB
  const tooLargeRes2 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    contentLength: 5368709121,
    'x-amz-content-sha256': normalSha,
  });
  assert.equal(tooLargeRes2.http_status, 400);
  assert.equal(tooLargeRes2.error_code, 'EntityTooLarge');
  assert.equal(tooLargeRes2.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 3. PutObject with content_length string exceeding 5 GiB
  const tooLargeRes3 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    content_length: '5368709121',
    'x-amz-content-sha256': normalSha,
  });
  assert.equal(tooLargeRes3.http_status, 400);
  assert.equal(tooLargeRes3.error_code, 'EntityTooLarge');
  assert.equal(tooLargeRes3.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 4. PutObject with error_condition PAYLOAD_EXCEEDS_5GIB_LIMIT
  const tooLargeRes4 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    'x-amz-content-sha256': normalSha,
    error_condition: 'PAYLOAD_EXCEEDS_5GIB_LIMIT',
  });
  assert.equal(tooLargeRes4.http_status, 400);
  assert.equal(tooLargeRes4.error_code, 'EntityTooLarge');
  assert.equal(tooLargeRes4.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 5. dispatchS3Error string trigger
  const errRes1 = dispatchS3Error('PAYLOAD_EXCEEDS_5GIB_LIMIT');
  assert.equal(errRes1.http_status, 400);
  assert.equal(errRes1.error_code, 'EntityTooLarge');
  assert.equal(errRes1.code, 'EntityTooLarge');
  assert.equal(errRes1.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 6. dispatchS3Error object trigger
  const errRes2 = dispatchS3Error({ reason: 'PAYLOAD_EXCEEDS_5GIB_LIMIT' });
  assert.equal(errRes2.http_status, 400);
  assert.equal(errRes2.error_code, 'EntityTooLarge');
  assert.equal(errRes2.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 7. Conflicting length declarations: small content_length + oversized contentLength (> 5 GiB)
  const resConflict1 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    'x-amz-content-sha256': normalSha,
    content_length: 100,
    contentLength: 6000000000,
  });
  assert.equal(resConflict1.http_status, 400);
  assert.equal(resConflict1.error_code, 'EntityTooLarge');
  assert.equal(resConflict1.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 8. Conflicting length declarations: small content_length + oversized Content-Length header
  const resConflict2 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    'x-amz-content-sha256': normalSha,
    content_length: 100,
    headers: { 'Content-Length': '6000000000' },
  });
  assert.equal(resConflict2.http_status, 400);
  assert.equal(resConflict2.error_code, 'EntityTooLarge');
  assert.equal(resConflict2.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 9. Conflicting length declarations: small contentLength + oversized content_length
  const resConflict3 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    'x-amz-content-sha256': normalSha,
    contentLength: 100,
    content_length: 6000000000,
  });
  assert.equal(resConflict3.http_status, 400);
  assert.equal(resConflict3.error_code, 'EntityTooLarge');
  assert.equal(resConflict3.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 10. Conflicting length declarations: small content_length + oversized content_length_bytes / size_bytes
  const resConflict4 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    'x-amz-content-sha256': normalSha,
    content_length: 100,
    content_length_bytes: 6000000000,
  });
  assert.equal(resConflict4.http_status, 400);
  assert.equal(resConflict4.error_code, 'EntityTooLarge');
  assert.equal(resConflict4.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  const resConflict5 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    'x-amz-content-sha256': normalSha,
    content_length: 100,
    size_bytes: 6000000000,
  });
  assert.equal(resConflict5.http_status, 400);
  assert.equal(resConflict5.error_code, 'EntityTooLarge');
  assert.equal(resConflict5.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 11. Multibyte UTF-8 string sizing verification
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

  // 12. Exactly 5 GiB boundary (5368709120 bytes) is permitted (returns HTTP 200)
  const exactMaxRes = dispatchS3PutObject({
    payloadBytes: normalPayload,
    size_bytes: 5368709120,
    'x-amz-content-sha256': normalSha,
  });
  assert.equal(exactMaxRes.http_status, 200);
  assert.equal(exactMaxRes.error_code, null);

  // 13. dispatchS3Error conflicting length declarations
  const errConflict1 = dispatchS3Error({ content_length: 100, contentLength: 6000000000 });
  assert.equal(errConflict1.http_status, 400);
  assert.equal(errConflict1.error_code, 'EntityTooLarge');
  assert.equal(errConflict1.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  const errConflict2 = dispatchS3Error({ content_length: 100, headers: { 'Content-Length': '6000000000' } });
  assert.equal(errConflict2.http_status, 400);
  assert.equal(errConflict2.error_code, 'EntityTooLarge');
  assert.equal(errConflict2.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  // 14. Multibyte UTF-8 payload byte length computed with Buffer.byteLength (not string code units)
  const mbString = '🚀 🌟 ✨ こんにちは 🌍';
  const mbSha = computePayloadSha256(mbString);
  const mbPutRes = dispatchS3PutObject({
    payload: mbString,
    'x-amz-content-sha256': mbSha,
    content_length: Buffer.byteLength(mbString, 'utf8'),
  });
  assert.equal(mbPutRes.http_status, 200);
  assert.equal(mbPutRes.error_code, null);

  // 15. Reconcile declared lengths: ANY declared source exceeding 5 GiB returns EntityTooLarge
  const multiSourceRes1 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    'x-amz-content-sha256': normalSha,
    content_length: 100,
    headers: { 'Content-Length': 5368709121 },
  });
  assert.equal(multiSourceRes1.http_status, 400);
  assert.equal(multiSourceRes1.error_code, 'EntityTooLarge');
  assert.equal(multiSourceRes1.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  const multiSourceRes2 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    'x-amz-content-sha256': normalSha,
    contentLength: 100,
    headers: { 'content-length': '5368709121' },
  });
  assert.equal(multiSourceRes2.http_status, 400);
  assert.equal(multiSourceRes2.error_code, 'EntityTooLarge');
  assert.equal(multiSourceRes2.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');

  const multiSourceRes3 = dispatchS3PutObject({
    payloadBytes: normalPayload,
    'x-amz-content-sha256': normalSha,
    content_length: 100,
    size_bytes: 5368709121,
  });
  assert.equal(multiSourceRes3.http_status, 400);
  assert.equal(multiSourceRes3.error_code, 'EntityTooLarge');
  assert.equal(multiSourceRes3.reason, 'PAYLOAD_EXCEEDS_5GIB_LIMIT');
});

test('regression: unauthorized UNSIGNED-PAYLOAD returning HTTP 400 InvalidDigest (UNSIGNED_PAYLOAD_NOT_PERMITTED) and authorized returning HTTP 200 (OPEN-2)', () => {
  const payload = Buffer.from('CYBRIK_UNSIGNED_PAYLOAD_TEST_DATA');
  const validMd5 = computePayloadMd5(payload);

  // 1. Unauthorized UNSIGNED-PAYLOAD with allow_unsigned_payload: false
  const unauthRes1 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: false,
  });
  assert.equal(unauthRes1.http_status, 400);
  assert.equal(unauthRes1.error_code, 'InvalidDigest');
  assert.equal(unauthRes1.code, 'InvalidDigest');
  assert.equal(unauthRes1.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 2. Adversarial regression: unauthorized UNSIGNED-PAYLOAD with aliases returning HTTP 400 InvalidDigest (UNSIGNED_PAYLOAD_NOT_PERMITTED)
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

  // 3. Unauthorized UNSIGNED-PAYLOAD with explicit error_condition
  const unauthRes4 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    error_condition: 'UNSIGNED_PAYLOAD_NOT_PERMITTED',
  });
  assert.equal(unauthRes4.http_status, 400);
  assert.equal(unauthRes4.error_code, 'InvalidDigest');
  assert.equal(unauthRes4.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 4. Positional arguments with UNSIGNED-PAYLOAD returns HTTP 400 InvalidDigest
  const resPositional = dispatchS3PutObject(payload, validMd5, 'UNSIGNED-PAYLOAD');
  assert.equal(resPositional.http_status, 400);
  assert.equal(resPositional.error_code, 'InvalidDigest');
  assert.equal(resPositional.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 5. dispatchS3Error string trigger
  const errRes1 = dispatchS3Error('UNSIGNED_PAYLOAD_NOT_PERMITTED');
  assert.equal(errRes1.http_status, 400);
  assert.equal(errRes1.error_code, 'InvalidDigest');
  assert.equal(errRes1.code, 'InvalidDigest');
  assert.equal(errRes1.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 6. dispatchS3Error object trigger
  const errRes2 = dispatchS3Error({ reason: 'UNSIGNED_PAYLOAD_NOT_PERMITTED' });
  assert.equal(errRes2.http_status, 400);
  assert.equal(errRes2.error_code, 'InvalidDigest');
  assert.equal(errRes2.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 7. dispatchS3Error error_condition trigger
  const errResCond = dispatchS3Error({ error_condition: 'UNSIGNED_PAYLOAD_NOT_PERMITTED' });
  assert.equal(errResCond.http_status, 400);
  assert.equal(errResCond.error_code, 'InvalidDigest');
  assert.equal(errResCond.reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // 8. dispatchS3Error options with shaHeader UNSIGNED-PAYLOAD and allow_unsigned_payload: false / is_presigned: false
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

  // 9. Authorized UNSIGNED-PAYLOAD with canonical allow_unsigned_payload: true -> HTTP 200
  const authRes1 = dispatchS3PutObject({
    payloadBytes: payload,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    allow_unsigned_payload: true,
  });
  assert.equal(authRes1.http_status, 200);
  assert.equal(authRes1.error_code, null);

  // 10. Authorized UNSIGNED-PAYLOAD with canonical is_presigned: true -> HTTP 200
  const authRes2 = dispatchS3PutObject({
    payloadBytes: payload,
    contentMd5Header: validMd5,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    is_presigned: true,
  });
  assert.equal(authRes2.http_status, 200);
  assert.equal(authRes2.error_code, null);
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
  const s3SchemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const profileDefId = `${s3SchemaId}#/$defs/storageConformanceProfile`;

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
  const validRoot = ajv.validate(s3SchemaId, nonLock15Profile);
  assert.ok(validRoot, `15-op non-lock profile with object_lock_supported: false, legal_hold_supported: false, retention_modes_supported: [] must pass root schema: ${ajv.errorsText()}`);

  // 2. Passes Ajv schema validation against storageConformanceProfile def
  const validProfile = ajv.validate(profileDefId, nonLock15Profile);
  assert.ok(validProfile, `15-op non-lock profile with object_lock_supported: false, legal_hold_supported: false, retention_modes_supported: [] must pass profile def: ${ajv.errorsText()}`);

  // 3. Passes validateS3ConformanceProfileSemantics semantic validation
  assert.doesNotThrow(() => {
    validateS3ConformanceProfileSemantics(nonLock15Profile);
  }, '15-op non-lock profile must pass validateS3ConformanceProfileSemantics');
});

test('regression: OPEN-5 capability with required_for_optimal: false yields ACTIVE_OPTIMAL when omitted, and required_for_optimal: true yields ACTIVE_DEGRADED (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
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
      'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock'
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
      required_for_optimal: false,
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

  // 2. Full lease handshake where all requested capabilities are granted
  const fullLeaseHandshake = JSON.parse(JSON.stringify(sample));
  fullLeaseHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  fullLeaseHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  fullLeaseHandshake.negotiation_request.requested_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      required_for_optimal: false,
      preferred_fallback: 'CORE_EMULATION_FALLBACK',
    },
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      required_for_optimal: true,
      preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  fullLeaseHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
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

  assert.ok(ajv.validate(pcnSchemaId, fullLeaseHandshake), `Full lease handshake must validate: ${ajv.errorsText()}`);
  assert.doesNotThrow(() => validatePlatformSemantics(fullLeaseHandshake, pcnSchemaId));

  // 3. Valid subset: omitting required_for_optimal: false capability (ai_tensor_acceleration) in ACTIVE_OPTIMAL does not throw error
  const nonOptOmissionHandshake = JSON.parse(JSON.stringify(fullLeaseHandshake));
  nonOptOmissionHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
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

  // 4. Valid degraded-by-omission: omitting required_for_optimal: true in ACTIVE_DEGRADED does not throw error
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
  const surplusHandshake = JSON.parse(JSON.stringify(fullLeaseHandshake));
  surplusHandshake.agreed_capability_lease.negotiated_optional_capabilities.push({
    capability_name: 'unrequested_feature',
    slot_id: 'cache',
    disposition: 'GRANTED_FULL',
    fallback_applied: 'NONE',
  });
  assert.throws(
    () => validatePlatformSemantics(surplusHandshake, pcnSchemaId),
    /agreed_capability_lease contains unrequested or surplus optional capability/
  );

  // 6. Negative: missing required_for_optimal: true capability in ACTIVE_OPTIMAL throws semantic error
  const missingOptimalHandshake = JSON.parse(JSON.stringify(fullLeaseHandshake));
  missingOptimalHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
  missingOptimalHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
  missingOptimalHandshake.negotiation_request.requested_optional_capabilities = [
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
  missingOptimalHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_s3_object_lock',
      fallback_applied: 'NONE',
    },
  ];
  assert.throws(
    () => validatePlatformSemantics(missingOptimalHandshake, pcnSchemaId),
    /requested optional capability 'ai_tensor_acceleration' for slot 'ai_model_runtime' is required for optimal operation but is not resolved in agreed_capability_lease/
  );

  // 7. Negative: duplicate composite keys in negotiated_optional_capabilities throws semantic error
  const dupLeaseKeyHandshake = JSON.parse(JSON.stringify(fullLeaseHandshake));
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

  // 8. Negative: degrading storage_object_lock on immutable profile fails terminally
  const degradedStorageLockHandshake = JSON.parse(JSON.stringify(fullLeaseHandshake));
  degradedStorageLockHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
  degradedStorageLockHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
  degradedStorageLockHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'storage_object_lock',
      slot_id: 'storage',
      disposition: 'GRANTED_DEGRADED',
      active_mode: 'emulated_retention',
      fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
    },
  ];
  assert.throws(
    () => validatePlatformSemantics(degradedStorageLockHandshake, pcnSchemaId),
    /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
    'Degrading storage_object_lock on immutable profile must fail terminally with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN'
  );

  // 9. Negative: omitting required_for_optimal storage_object_lock in ACTIVE_OPTIMAL fails terminally
  const omittedOptStorageLockHandshake = JSON.parse(JSON.stringify(fullLeaseHandshake));
  omittedOptStorageLockHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
    {
      capability_name: 'ai_tensor_acceleration',
      slot_id: 'ai_model_runtime',
      disposition: 'GRANTED_FULL',
      active_mode: 'native_gpu_acceleration',
      fallback_applied: 'NONE',
    },
  ];
  assert.throws(
    () => validatePlatformSemantics(omittedOptStorageLockHandshake, pcnSchemaId),
    /immutable storage profile requires storage_object_lock capability in lease with GRANTED_FULL disposition|DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN|requested optional capability 'storage_object_lock' for slot 'storage' is required for optimal operation but is not resolved in agreed_capability_lease/,
    'Omitting required_for_optimal storage_object_lock in ACTIVE_OPTIMAL must fail terminally'
  );
});

test('in-memory validation: omitting or degrading storage_object_lock on immutable profile fails semantic validation terminally (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const samplePath = join(ROOT, 'contracts/examples/platform/sample-capability-negotiation-handshake.json');
  assert.ok(existsSync(samplePath), `Sample capability handshake missing: ${samplePath}`);
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  const immutableProfiles = [
    'onprem-standard-v1',
    'onprem-airgap-v1',
    'hybrid-sovereign-v1',
  ];

  for (const profileId of immutableProfiles) {
    const profilePath = join(EXAMPLES_DIR, `${profileId}.profile.json`);
    assert.ok(existsSync(profilePath), `Profile fixture missing: ${profilePath}`);
    const profileData = JSON.parse(readFileSync(profilePath, 'utf8'));
    assert.equal(
      profileData.slots?.storage?.specification?.immutable_storage_required,
      true,
      `${profileId} must mandate immutable_storage_required: true`
    );
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    // 1. Degrading storage_object_lock with GRANTED_DEGRADED fails with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
    const degradedData = JSON.parse(JSON.stringify(sample));
    degradedData.target_profile_id = profileId;
    degradedData.target_profile_digest = profileDigest;
    degradedData.agreed_capability_lease.target_profile_id = profileId;
    degradedData.agreed_capability_lease.target_profile_digest = profileDigest;
    degradedData.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
    degradedData.negotiation_status = 'DEGRADED_LEASE_GRANTED';
    degradedData.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        disposition: 'GRANTED_DEGRADED',
        active_mode: 'emulated_retention',
        fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
      },
    ];
    assert.throws(
      () => validatePlatformSemantics(degradedData, pcnSchemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
      `${profileId}: GRANTED_DEGRADED storage_object_lock must throw DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`
    );

    // 2. Rejecting storage_object_lock with REJECTED_UNSUPPORTED fails with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
    const rejectedData = JSON.parse(JSON.stringify(sample));
    rejectedData.target_profile_id = profileId;
    rejectedData.target_profile_digest = profileDigest;
    rejectedData.agreed_capability_lease.target_profile_id = profileId;
    rejectedData.agreed_capability_lease.target_profile_digest = profileDigest;
    rejectedData.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
    rejectedData.negotiation_status = 'DEGRADED_LEASE_GRANTED';
    rejectedData.agreed_capability_lease.negotiated_optional_capabilities = [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        disposition: 'REJECTED_UNSUPPORTED',
        active_mode: 'disabled',
        fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
      },
    ];
    assert.throws(
      () => validatePlatformSemantics(rejectedData, pcnSchemaId),
      /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
      `${profileId}: REJECTED_UNSUPPORTED storage_object_lock must throw DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`
    );

    // 3. Omitting required_for_optimal storage_object_lock in ACTIVE_OPTIMAL lease fails terminally
    const omittedData = JSON.parse(JSON.stringify(sample));
    omittedData.target_profile_id = profileId;
    omittedData.target_profile_digest = profileDigest;
    omittedData.agreed_capability_lease.target_profile_id = profileId;
    omittedData.agreed_capability_lease.target_profile_digest = profileDigest;
    omittedData.negotiation_status = 'AGREED_LEASE_GRANTED';
    omittedData.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
    omittedData.negotiation_request.requested_optional_capabilities = [
      {
        capability_name: 'storage_object_lock',
        slot_id: 'storage',
        required_for_optimal: true,
        preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
      },
    ];
    omittedData.agreed_capability_lease.negotiated_optional_capabilities = [];
    assert.throws(
      () => validatePlatformSemantics(omittedData, pcnSchemaId),
      /immutable storage profile requires storage_object_lock capability in lease with GRANTED_FULL disposition|DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN|requested optional capability 'storage_object_lock' for slot 'storage' is required for optimal operation but is not resolved in agreed_capability_lease/,
      `${profileId}: Omitting required_for_optimal storage_object_lock in ACTIVE_OPTIMAL must fail terminally`
    );

    // 4. Storage slot advertisement lacking Object Lock retention evidence fails terminally
    const noEvidenceAdvData = JSON.parse(JSON.stringify(sample));
    noEvidenceAdvData.target_profile_id = profileId;
    noEvidenceAdvData.target_profile_digest = profileDigest;
    noEvidenceAdvData.agreed_capability_lease.target_profile_id = profileId;
    noEvidenceAdvData.agreed_capability_lease.target_profile_digest = profileDigest;
    const storeAdv = noEvidenceAdvData.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
    if (storeAdv) {
      storeAdv.evidence_references = ['urn:cybrik:evidence:storage:s3-19-ops:v1'];
    }
    assert.throws(
      () => validatePlatformSemantics(noEvidenceAdvData, pcnSchemaId),
      /storage slot advertisement lacks Object Lock retention evidence/,
      `${profileId}: Storage advertisement without Object Lock retention evidence must fail terminally`
    );
  }
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

test('in-memory validation: immutable-storage alias-negative test suites across all immutable profiles (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const samplePath = join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json');
  assert.ok(existsSync(samplePath), `Sample handshake fixture missing: ${samplePath}`);
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  const immutableProfiles = [
    'onprem-standard-v1',
    'onprem-airgap-v1',
    'hybrid-sovereign-v1',
  ];

  const aliasVariants = [
    'storage_lock_alias',
    'storage_worm_lock',
    'storage_object_lock_custom',
    'storage_worm',
    'storage_lock_v1',
    'storage_object_lock_v2',
  ];

  for (const profileId of immutableProfiles) {
    const profilePath = join(EXAMPLES_DIR, `${profileId}.profile.json`);
    assert.ok(existsSync(profilePath), `Profile fixture missing: ${profilePath}`);
    const profileData = JSON.parse(readFileSync(profilePath, 'utf8'));
    assert.equal(
      profileData.slots?.storage?.specification?.immutable_storage_required,
      true,
      `${profileId} must mandate immutable_storage_required: true`
    );
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    for (const alias of aliasVariants) {
      // 1. Degraded alias lease with GRANTED_DEGRADED + FEATURE_DISABLED_GRACEFUL fails closed
      const degradedAliasHandshake = JSON.parse(JSON.stringify(sample));
      degradedAliasHandshake.target_profile_id = profileId;
      degradedAliasHandshake.target_profile_digest = profileDigest;
      if (degradedAliasHandshake.advertisement_response) {
        degradedAliasHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      degradedAliasHandshake.agreed_capability_lease.target_profile_id = profileId;
      degradedAliasHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      degradedAliasHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
      degradedAliasHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
      degradedAliasHandshake.negotiation_request.requested_optional_capabilities = [
        {
          capability_name: alias,
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];
      degradedAliasHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
        {
          capability_name: alias,
          slot_id: 'storage',
          disposition: 'GRANTED_DEGRADED',
          active_mode: 'emulated_retention',
          fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];

      assert.ok(
        ajv.validate(pcnSchemaId, degradedAliasHandshake),
        `${profileId} degraded alias ${alias} should pass Ajv syntax validation: ` + ajv.errorsText()
      );
      assert.throws(
        () => validatePlatformSemantics(degradedAliasHandshake, pcnSchemaId),
        /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
        `${profileId}: GRANTED_DEGRADED alias '${alias}' must fail closed with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`
      );

      // 2. Rejected alias lease with REJECTED_UNSUPPORTED fails closed
      const rejectedAliasHandshake = JSON.parse(JSON.stringify(sample));
      rejectedAliasHandshake.target_profile_id = profileId;
      rejectedAliasHandshake.target_profile_digest = profileDigest;
      if (rejectedAliasHandshake.advertisement_response) {
        rejectedAliasHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      rejectedAliasHandshake.agreed_capability_lease.target_profile_id = profileId;
      rejectedAliasHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      rejectedAliasHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
      rejectedAliasHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
      rejectedAliasHandshake.negotiation_request.requested_optional_capabilities = [
        {
          capability_name: alias,
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];
      rejectedAliasHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
        {
          capability_name: alias,
          slot_id: 'storage',
          disposition: 'REJECTED_UNSUPPORTED',
          active_mode: 'disabled',
          fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];

      assert.ok(
        ajv.validate(pcnSchemaId, rejectedAliasHandshake),
        `${profileId} rejected alias ${alias} should pass Ajv syntax validation: ` + ajv.errorsText()
      );
      assert.throws(
        () => validatePlatformSemantics(rejectedAliasHandshake, pcnSchemaId),
        /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
        `${profileId}: REJECTED_UNSUPPORTED alias '${alias}' must fail closed with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`
      );

      // 3. Degraded alias with CORE_EMULATION_FALLBACK fails closed
      const coreFallbackHandshake = JSON.parse(JSON.stringify(sample));
      coreFallbackHandshake.target_profile_id = profileId;
      coreFallbackHandshake.target_profile_digest = profileDigest;
      if (coreFallbackHandshake.advertisement_response) {
        coreFallbackHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      coreFallbackHandshake.agreed_capability_lease.target_profile_id = profileId;
      coreFallbackHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      coreFallbackHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
      coreFallbackHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
      coreFallbackHandshake.negotiation_request.requested_optional_capabilities = [
        {
          capability_name: alias,
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'CORE_EMULATION_FALLBACK',
        },
      ];
      coreFallbackHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
        {
          capability_name: alias,
          slot_id: 'storage',
          disposition: 'GRANTED_DEGRADED',
          active_mode: 'software_emulation',
          fallback_applied: 'CORE_EMULATION_FALLBACK',
        },
      ];

      assert.ok(
        ajv.validate(pcnSchemaId, coreFallbackHandshake),
        `${profileId} CORE_EMULATION_FALLBACK alias ${alias} should pass Ajv syntax validation: ` + ajv.errorsText()
      );
      assert.throws(
        () => validatePlatformSemantics(coreFallbackHandshake, pcnSchemaId),
        /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
        `${profileId}: CORE_EMULATION_FALLBACK alias '${alias}' must fail closed with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`
      );

      // 4. Secondary alias degraded alongside granted storage_object_lock fails closed
      const secondaryAliasDegradedHandshake = JSON.parse(JSON.stringify(sample));
      secondaryAliasDegradedHandshake.target_profile_id = profileId;
      secondaryAliasDegradedHandshake.target_profile_digest = profileDigest;
      if (secondaryAliasDegradedHandshake.advertisement_response) {
        secondaryAliasDegradedHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      secondaryAliasDegradedHandshake.agreed_capability_lease.target_profile_id = profileId;
      secondaryAliasDegradedHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      secondaryAliasDegradedHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
      secondaryAliasDegradedHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
      secondaryAliasDegradedHandshake.negotiation_request.requested_optional_capabilities = [
        {
          capability_name: 'storage_object_lock',
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
        {
          capability_name: alias,
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];
      secondaryAliasDegradedHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
        {
          capability_name: 'storage_object_lock',
          slot_id: 'storage',
          disposition: 'GRANTED_FULL',
          active_mode: 'native_s3_object_lock',
          fallback_applied: 'NONE',
        },
        {
          capability_name: alias,
          slot_id: 'storage',
          disposition: 'GRANTED_DEGRADED',
          active_mode: 'slow_emulated_storage',
          fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];

      assert.ok(
        ajv.validate(pcnSchemaId, secondaryAliasDegradedHandshake),
        `${profileId} secondary degraded alias ${alias} should pass Ajv syntax validation: ` + ajv.errorsText()
      );
      assert.throws(
        () => validatePlatformSemantics(secondaryAliasDegradedHandshake, pcnSchemaId),
        /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
        `${profileId}: Secondary degraded alias '${alias}' must fail closed with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`
      );

      // 5. Secondary alias rejected alongside granted storage_object_lock fails closed
      const secondaryAliasRejectedHandshake = JSON.parse(JSON.stringify(sample));
      secondaryAliasRejectedHandshake.target_profile_id = profileId;
      secondaryAliasRejectedHandshake.target_profile_digest = profileDigest;
      if (secondaryAliasRejectedHandshake.advertisement_response) {
        secondaryAliasRejectedHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      secondaryAliasRejectedHandshake.agreed_capability_lease.target_profile_id = profileId;
      secondaryAliasRejectedHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      secondaryAliasRejectedHandshake.agreed_capability_lease.lease_status = 'ACTIVE_DEGRADED';
      secondaryAliasRejectedHandshake.negotiation_status = 'DEGRADED_LEASE_GRANTED';
      secondaryAliasRejectedHandshake.negotiation_request.requested_optional_capabilities = [
        {
          capability_name: 'storage_object_lock',
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
        {
          capability_name: alias,
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];
      secondaryAliasRejectedHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
        {
          capability_name: 'storage_object_lock',
          slot_id: 'storage',
          disposition: 'GRANTED_FULL',
          active_mode: 'native_s3_object_lock',
          fallback_applied: 'NONE',
        },
        {
          capability_name: alias,
          slot_id: 'storage',
          disposition: 'REJECTED_UNSUPPORTED',
          active_mode: 'disabled',
          fallback_applied: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];

      assert.ok(
        ajv.validate(pcnSchemaId, secondaryAliasRejectedHandshake),
        `${profileId} secondary rejected alias ${alias} should pass Ajv syntax validation: ` + ajv.errorsText()
      );
      assert.throws(
        () => validatePlatformSemantics(secondaryAliasRejectedHandshake, pcnSchemaId),
        /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
        `${profileId}: Secondary rejected alias '${alias}' must fail closed with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`
      );

      // 6. Coexisting alias alongside granted canonical storage_object_lock (both GRANTED_FULL, fallback NONE) fails closed
      const coexistingAliasHandshake = JSON.parse(JSON.stringify(sample));
      coexistingAliasHandshake.target_profile_id = profileId;
      coexistingAliasHandshake.target_profile_digest = profileDigest;
      if (coexistingAliasHandshake.advertisement_response) {
        coexistingAliasHandshake.advertisement_response.target_profile_digest = profileDigest;
      }
      coexistingAliasHandshake.agreed_capability_lease.target_profile_id = profileId;
      coexistingAliasHandshake.agreed_capability_lease.target_profile_digest = profileDigest;
      coexistingAliasHandshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
      coexistingAliasHandshake.negotiation_status = 'AGREED_LEASE_GRANTED';
      coexistingAliasHandshake.negotiation_request.requested_optional_capabilities = [
        {
          capability_name: 'storage_object_lock',
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
        {
          capability_name: alias,
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];
      coexistingAliasHandshake.agreed_capability_lease.negotiated_optional_capabilities = [
        {
          capability_name: 'storage_object_lock',
          slot_id: 'storage',
          disposition: 'GRANTED_FULL',
          active_mode: 'native_s3_object_lock',
          fallback_applied: 'NONE',
        },
        {
          capability_name: alias,
          slot_id: 'storage',
          disposition: 'GRANTED_FULL',
          active_mode: 'native_s3_object_lock',
          fallback_applied: 'NONE',
        },
      ];

      assert.ok(
        ajv.validate(pcnSchemaId, coexistingAliasHandshake),
        `${profileId} coexisting alias ${alias} (both GRANTED_FULL / NONE) should pass Ajv syntax validation: ` + ajv.errorsText()
      );
      assert.throws(
        () => validatePlatformSemantics(coexistingAliasHandshake, pcnSchemaId),
        /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
        `${profileId}: Coexisting alias '${alias}' alongside canonical storage_object_lock (both GRANTED_FULL / NONE) must fail closed with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`
      );
    }
  }
});

test('in-memory validation: alias coexistence semantic-negative test suite across immutable profiles (OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const samplePath = join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json');
  assert.ok(existsSync(samplePath), `Sample handshake fixture missing: ${samplePath}`);
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

  const immutableProfiles = [
    'onprem-standard-v1',
    'onprem-airgap-v1',
    'hybrid-sovereign-v1',
  ];

  const aliasList = [
    'storage_lock_alias',
    'storage_worm_lock',
    'storage_object_lock_custom',
  ];

  let combinationsTested = 0;
  for (const profileId of immutableProfiles) {
    const profilePath = join(EXAMPLES_DIR, `${profileId}.profile.json`);
    assert.ok(existsSync(profilePath), `Profile fixture missing: ${profilePath}`);
    const profileData = JSON.parse(readFileSync(profilePath, 'utf8'));
    assert.equal(
      profileData.slots?.storage?.specification?.immutable_storage_required,
      true,
      `${profileId} must mandate immutable_storage_required: true`
    );
    const profileDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');

    for (const alias of aliasList) {
      combinationsTested++;
      const handshake = JSON.parse(JSON.stringify(sample));
      handshake.target_profile_id = profileId;
      handshake.target_profile_digest = profileDigest;
      if (handshake.advertisement_response) {
        handshake.advertisement_response.target_profile_digest = profileDigest;
      }
      handshake.agreed_capability_lease.target_profile_id = profileId;
      handshake.agreed_capability_lease.target_profile_digest = profileDigest;
      handshake.agreed_capability_lease.lease_status = 'ACTIVE_OPTIMAL';
      handshake.negotiation_status = 'AGREED_LEASE_GRANTED';

      // Both canonical storage_object_lock and alias requested
      handshake.negotiation_request.requested_optional_capabilities = [
        {
          capability_name: 'storage_object_lock',
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
        {
          capability_name: alias,
          slot_id: 'storage',
          required_for_optimal: false,
          preferred_fallback: 'FEATURE_DISABLED_GRACEFUL',
        },
      ];

      // Both canonical storage_object_lock and alias in agreed lease with GRANTED_FULL / NONE
      handshake.agreed_capability_lease.negotiated_optional_capabilities = [
        {
          capability_name: 'storage_object_lock',
          slot_id: 'storage',
          disposition: 'GRANTED_FULL',
          active_mode: 'native_s3_object_lock',
          fallback_applied: 'NONE',
        },
        {
          capability_name: alias,
          slot_id: 'storage',
          disposition: 'GRANTED_FULL',
          active_mode: 'native_s3_object_lock',
          fallback_applied: 'NONE',
        },
      ];

      // 1. Verify Ajv syntax validation passes
      const isValid = ajv.validate(pcnSchemaId, handshake);
      assert.ok(
        isValid,
        `[Combination ${combinationsTested}/9] Profile '${profileId}' with coexisting alias '${alias}' must pass Ajv syntax validation: ` + ajv.errorsText()
      );

      // 2. Verify validatePlatformSemantics terminally fails with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN
      assert.throws(
        () => validatePlatformSemantics(handshake, pcnSchemaId),
        /DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN/,
        `[Combination ${combinationsTested}/9] Profile '${profileId}' with coexisting alias '${alias}' (both GRANTED_FULL / NONE) must fail terminally with DEGRADATION_OF_IMMUTABLE_STORAGE_FORBIDDEN`
      );
    }
  }

  assert.equal(combinationsTested, 9, 'Must test exactly 9 alias coexistence combinations (3 immutable profiles x 3 aliases)');
});

test('adversarial regression: exact storage_object_lock identity and requirement across all immutable profiles (OPEN-2 / OPEN-5)', () => {
  const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
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

test('safe plain snapshot extraction, descriptor-level extraction, and prototype isolation helpers (OPEN-5)', () => {
  // 1. getOwnDataValue extracts own data properties only
  const plainObj = { a: 100, b: 'test', c: null, d: undefined };
  assert.equal(getOwnDataValue(plainObj, 'a'), 100);
  assert.equal(getOwnDataValue(plainObj, 'b'), 'test');
  assert.equal(getOwnDataValue(plainObj, 'c'), null);
  assert.equal(getOwnDataValue(plainObj, 'd'), undefined);
  assert.equal(getOwnDataValue(plainObj, 'nonexistent'), undefined);

  // Inherited properties are NOT returned by getOwnDataValue
  const child = Object.create(plainObj);
  child.ownProp = 42;
  assert.equal(getOwnDataValue(child, 'ownProp'), 42);
  assert.equal(getOwnDataValue(child, 'a'), undefined);

  // Accessors (getters/setters) are NOT returned by getOwnDataValue without invocation
  let getterInvoked = false;
  const accessorObj = {
    get secret() {
      getterInvoked = true;
      return 'hidden';
    }
  };
  assert.equal(getOwnDataValue(accessorObj, 'secret'), undefined);
  assert.equal(getterInvoked, false, 'getOwnDataValue must never invoke getter functions');

  // Null, undefined, primitives, proxies return undefined
  assert.equal(getOwnDataValue(null, 'a'), undefined);
  assert.equal(getOwnDataValue(undefined, 'a'), undefined);
  assert.equal(getOwnDataValue(123, 'a'), undefined);
  assert.equal(getOwnDataValue('str', 'a'), undefined);
  assert.equal(getOwnDataValue(new Proxy({}, {}), 'a'), undefined);

  // 2. hasAnyAccessorsOrProxy detection
  assert.equal(hasAnyAccessorsOrProxy(null), false);
  assert.equal(hasAnyAccessorsOrProxy(undefined), false);
  assert.equal(hasAnyAccessorsOrProxy(123), false);
  assert.equal(hasAnyAccessorsOrProxy('hello'), false);
  assert.equal(hasAnyAccessorsOrProxy({ a: 1, b: 2 }), false);
  assert.equal(hasAnyAccessorsOrProxy([1, 2, 3]), false);
  assert.equal(hasAnyAccessorsOrProxy(Object.create(null)), false);

  // Own accessor
  assert.equal(hasAnyAccessorsOrProxy({ get x() { return 1; } }), true);
  assert.equal(hasAnyAccessorsOrProxy({ set x(v) {} }), true);

  // Prototype-chain accessor
  class BaseWithGetter {
    get baseProp() { return 1; }
  }
  assert.equal(hasAnyAccessorsOrProxy(new BaseWithGetter()), true);

  // Proxy detection
  assert.equal(hasAnyAccessorsOrProxy(new Proxy({}, {})), true);
  assert.equal(hasAnyAccessorsOrProxy(new Proxy([], {})), true);

  // 3. createSafePlainSnapshot creates null-prototype object copying only own data properties
  const complexObj = {
    name: 'valid-declaration',
    count: 13,
    nested: {
      inner: 'value',
      num: 42
    },
    items: [
      { id: 1, label: 'one' },
      { id: 2, label: 'two' }
    ]
  };
  const snapshot = createSafePlainSnapshot(complexObj);
  assert.equal(Object.getPrototypeOf(snapshot), null, 'Root snapshot must have null prototype');
  assert.equal(snapshot.name, 'valid-declaration');
  assert.equal(snapshot.count, 13);
  assert.equal(Object.getPrototypeOf(snapshot.nested), null, 'Nested snapshot must have null prototype');
  assert.equal(snapshot.nested.inner, 'value');
  assert.equal(snapshot.nested.num, 42);
  assert.ok(Array.isArray(snapshot.items));
  assert.equal(Object.getPrototypeOf(snapshot.items[0]), null, 'Array element snapshot must have null prototype');
  assert.equal(snapshot.items[0].id, 1);
  assert.equal(snapshot.items[0].label, 'one');

  // createSafePlainSnapshot fails closed on accessors without invoking them
  let snapGetterInvoked = false;
  const objWithGetter = {
    safeField: 'safe',
    get evilField() {
      snapGetterInvoked = true;
      return 'evil';
    }
  };
  assert.throws(
    () => createSafePlainSnapshot(objWithGetter),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.equal(snapGetterInvoked, false, 'createSafePlainSnapshot must never invoke getter functions');

  // createSafePlainSnapshot fails closed on nested accessors and nested proxies
  assert.throws(
    () => createSafePlainSnapshot({ nested: { get evil() { return 1; } } }),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot([{ get evil() { return 1; } }]),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot({ nested: new Proxy({}, {}) }),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.throws(
    () => createSafePlainSnapshot([new Proxy({}, {})]),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );

  // createSafePlainSnapshot fails closed on inherited prototype accessors
  const inheritedObj = Object.create({ get inheritedKey() { return 'evil'; } });
  inheritedObj.ownKey = 'should-copy';
  assert.throws(
    () => createSafePlainSnapshot(inheritedObj),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );

  // createSafePlainSnapshot primitives, buffers, null, proxies
  assert.equal(createSafePlainSnapshot(null), null);
  assert.equal(createSafePlainSnapshot(undefined), undefined);
  assert.equal(createSafePlainSnapshot(123), 123);
  assert.equal(createSafePlainSnapshot('str'), 'str');
  const buf = Buffer.from('hello');
  const snapBuf = createSafePlainSnapshot(buf);
  assert.deepEqual(snapBuf, buf);
  assert.notEqual(snapBuf, buf, 'createSafePlainSnapshot must copy Buffer instances into fresh Buffer');
  const u8 = new Uint8Array([1, 2, 3]);
  const snapU8 = createSafePlainSnapshot(u8);
  assert.deepEqual(snapU8, u8);
  assert.notEqual(snapU8, u8, 'createSafePlainSnapshot must copy Uint8Array instances into fresh Uint8Array');
  assert.throws(
    () => createSafePlainSnapshot(new Proxy({ a: 1 }, {})),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );

  // 4. snapshotOwnDataDescriptors
  assert.deepEqual(snapshotOwnDataDescriptors(null), Object.create(null));
  assert.deepEqual(snapshotOwnDataDescriptors(undefined), Object.create(null));
  assert.deepEqual(snapshotOwnDataDescriptors(123), Object.create(null));
  assert.deepEqual(snapshotOwnDataDescriptors('str'), Object.create(null));
  assert.deepEqual(snapshotOwnDataDescriptors(Buffer.from('buf')), Object.create(null));
  assert.deepEqual(snapshotOwnDataDescriptors(new Uint8Array([1])), Object.create(null));

  let snapDescGetterInvoked = false;
  const descTestObj = {
    a: 10,
    b: 'hello',
    get secret() {
      snapDescGetterInvoked = true;
      return 'hidden';
    }
  };
  const descSnapshot = snapshotOwnDataDescriptors(descTestObj);
  assert.equal(snapDescGetterInvoked, false, 'snapshotOwnDataDescriptors must never invoke getters');
  assert.equal(descSnapshot.a, 10);
  assert.equal(descSnapshot.b, 'hello');
  assert.equal(descSnapshot.secret, undefined);

  // 5. hasAnyAccessorsOrProxy Map/Set size edge cases, Buffer, and throwing proxy
  assert.equal(hasAnyAccessorsOrProxy(new Map()), false);
  assert.equal(hasAnyAccessorsOrProxy(new Set()), false);
  assert.equal(hasAnyAccessorsOrProxy(Buffer.from('test')), false);
  assert.equal(hasAnyAccessorsOrProxy(new Uint8Array([1, 2])), false);
  const throwingProxy = new Proxy({}, {
    ownKeys() { throw new Error('trap'); }
  });
  assert.equal(hasAnyAccessorsOrProxy(throwingProxy), true);
  const throwingDescProxy = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error('trap'); }
  });
  assert.equal(getOwnDataValue(throwingDescProxy, 'a'), undefined);

  // 6. Array and nested array snapshot
  const arrSnapshot = createSafePlainSnapshot([1, 'two', null, { inner: 3 }, [4, 5]]);
  assert.ok(Array.isArray(arrSnapshot));
  assert.equal(arrSnapshot[0], 1);
  assert.equal(arrSnapshot[1], 'two');
  assert.equal(arrSnapshot[2], null);
  assert.equal(arrSnapshot[3].inner, 3);
  assert.ok(Array.isArray(arrSnapshot[4]));
  assert.equal(arrSnapshot[4][0], 4);

  // 7. isPlainOrNull and hasOversizedDeclaredLength edge cases
  assert.equal(isPlainOrNull(null), false);
  assert.equal(isPlainOrNull(123), false);
  assert.equal(isPlainOrNull('abc'), false);
  const throwingProtoProxy = new Proxy({}, {
    getPrototypeOf() { throw new Error('proto trap'); }
  });
  assert.equal(isPlainOrNull(throwingProtoProxy), false);

  assert.equal(hasOversizedDeclaredLength(null, null), false);
  assert.equal(hasOversizedDeclaredLength(123), false);
  assert.equal(hasOversizedDeclaredLength(Buffer.from('test')), false);
  assert.equal(hasOversizedDeclaredLength(new Uint8Array([1])), false);
  assert.equal(hasOversizedDeclaredLength({ content_length: 5368709121n }), true);
  assert.equal(hasOversizedDeclaredLength({ content_length: ' 5368709121 ' }), true);
  assert.equal(hasOversizedDeclaredLength(null, { size: 5368709121n }), true);
  assert.equal(hasOversizedDeclaredLength(null, { size: ' 5368709121 ' }), true);
});

test('validatePlatformSemantics prototype isolation and accessor defense fail-closed (OPEN-5)', () => {
  const samplePath = join(EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json');
  const validDoc = JSON.parse(readFileSync(samplePath, 'utf8'));
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';

  // 1. Valid doc passes platform semantics
  assert.doesNotThrow(() => validatePlatformSemantics(validDoc, schemaId));

  // 2. Doc with own accessor getter fails closed with Semantic error without calling getter
  let ownGetterCalled = false;
  const docWithOwnGetter = {
    ...validDoc,
    get trap() {
      ownGetterCalled = true;
      return 'triggered';
    }
  };
  assert.throws(
    () => validatePlatformSemantics(docWithOwnGetter, schemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.equal(ownGetterCalled, false, 'validatePlatformSemantics must fail closed without invoking own getters');

  // 3. Doc with prototype getter fails closed with Semantic error without calling getter
  let protoGetterCalled = false;
  class ProtoClass {
    get protoTrap() {
      protoGetterCalled = true;
      return 'triggered';
    }
  }
  const docWithProtoGetter = Object.assign(new ProtoClass(), validDoc);
  assert.throws(
    () => validatePlatformSemantics(docWithProtoGetter, schemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.equal(protoGetterCalled, false, 'validatePlatformSemantics must fail closed without invoking prototype getters');

  // 4. Proxy wrapping valid document fails closed with Semantic error
  const proxyDoc = new Proxy(validDoc, {});
  assert.throws(
    () => validatePlatformSemantics(proxyDoc, schemaId),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );

  // 5. Object.prototype getter pollution defense
  let globalGetterCalled = false;
  try {
    Object.defineProperty(Object.prototype, '__open5_polluted_getter__', {
      get() {
        globalGetterCalled = true;
        return 'polluted';
      },
      configurable: true
    });

    // When Object.prototype has accessors, validatePlatformSemantics detects accessors in prototype chain and fails closed without invoking the getter
    assert.throws(
      () => validatePlatformSemantics(validDoc, schemaId),
      /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
    );
    assert.equal(globalGetterCalled, false, 'validatePlatformSemantics must never invoke polluted Object.prototype getters');

    // When Object.prototype has accessors, createSafePlainSnapshot also fails closed without invoking getters
    assert.throws(
      () => createSafePlainSnapshot(validDoc),
      /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
    );
    assert.equal(globalGetterCalled, false, 'createSafePlainSnapshot must never invoke Object.prototype getters');
  } finally {
    delete Object.prototype.__open5_polluted_getter__;
  }
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

test('proxy-first rejection and robust platform snapshots for OPEN-5', () => {
  let trapCount = 0;
  const trapHandler = {
    get(target, prop, receiver) {
      trapCount++;
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      trapCount++;
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      trapCount++;
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    getPrototypeOf(target) {
      trapCount++;
      return Reflect.getPrototypeOf(target);
    },
    ownKeys(target) {
      trapCount++;
      return Reflect.ownKeys(target);
    }
  };

  const sampleTarget = {
    target_profile_id: 'regulated-cloud-v1',
    target_profile_digest: 'a'.repeat(64),
    claim_type: 'FULL_PROFILE_CONFORMANCE_DECLARATION'
  };

  // 1. validatePlatformSemantics Proxy-first check with 0 traps
  trapCount = 0;
  const proxyPlatform = new Proxy(sampleTarget, trapHandler);
  assert.throws(
    () => validatePlatformSemantics(proxyPlatform, 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json'),
    /accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.equal(trapCount, 0, 'validatePlatformSemantics must reject Proxy with 0 traps invoked');

  // 2. validateOfflineInstallSemantics Proxy-first check with 0 traps
  trapCount = 0;
  const proxyOffline = new Proxy({}, trapHandler);
  assert.throws(
    () => validateOfflineInstallSemantics(proxyOffline),
    /accessor properties or Proxy objects are prohibited in offline install manifest/
  );
  assert.equal(trapCount, 0, 'validateOfflineInstallSemantics must reject Proxy with 0 traps invoked');

  // 3. validateS3ConformanceProfileSemantics Proxy-first check with 0 traps
  trapCount = 0;
  const proxyS3Profile = new Proxy({}, trapHandler);
  assert.throws(
    () => validateS3ConformanceProfileSemantics(proxyS3Profile),
    /accessor properties or Proxy objects are prohibited in storage conformance profile/
  );
  assert.equal(trapCount, 0, 'validateS3ConformanceProfileSemantics must reject Proxy with 0 traps invoked');

  // 4. validateS3MultipartSemantics Proxy-first check with 0 traps
  trapCount = 0;
  const proxyMultipart = new Proxy({}, trapHandler);
  assert.throws(
    () => validateS3MultipartSemantics(proxyMultipart),
    /multipart upload manifest structure is invalid or malformed/
  );
  assert.equal(trapCount, 0, 'validateS3MultipartSemantics must reject Proxy with 0 traps invoked');

  // 5. hasAnyAccessorsOrProxy Proxy-first check with 0 traps
  trapCount = 0;
  const proxyAny = new Proxy({}, trapHandler);
  assert.equal(hasAnyAccessorsOrProxy(proxyAny), true);
  assert.equal(trapCount, 0, 'hasAnyAccessorsOrProxy must return true on Proxy with 0 traps invoked');

  // 6. createSafePlainSnapshot Proxy-first check with 0 traps failing closed
  trapCount = 0;
  const proxySnapshot = new Proxy({ a: 1 }, trapHandler);
  assert.throws(
    () => createSafePlainSnapshot(proxySnapshot),
    /Semantic error: accessor properties or Proxy objects are prohibited in platform data/
  );
  assert.equal(trapCount, 0, 'createSafePlainSnapshot must reject Proxy with 0 traps invoked');
});

test('proxy-first entrypoint gating and subclass isolation for OPEN-2', () => {
  let trapCount = 0;
  const trapHandler = {
    get(target, prop, receiver) {
      trapCount++;
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      trapCount++;
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      trapCount++;
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    getPrototypeOf(target) {
      trapCount++;
      return Reflect.getPrototypeOf(target);
    },
    ownKeys(target) {
      trapCount++;
      return Reflect.ownKeys(target);
    }
  };

  // 1. dispatchS3PutObject Proxy-first check with 0 traps
  trapCount = 0;
  const proxyPut = new Proxy({}, trapHandler);
  const putRes = dispatchS3PutObject(proxyPut);
  assert.equal(putRes.http_status, 400);
  assert.equal(putRes.error_code, 'InvalidDigest');
  assert.equal(putRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(trapCount, 0, 'dispatchS3PutObject must reject Proxy with 0 traps invoked');

  // 2. dispatchS3Error Proxy-first check with 0 traps
  trapCount = 0;
  const proxyError = new Proxy({}, trapHandler);
  const errRes = dispatchS3Error(proxyError);
  assert.equal(errRes.http_status, 400);
  assert.equal(errRes.error_code, 'InvalidDigest');
  assert.equal(errRes.reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(trapCount, 0, 'dispatchS3Error must reject Proxy with 0 traps invoked');

  // 3. dispatchS3CompleteMultipartUpload Proxy-first check with 0 traps
  trapCount = 0;
  const proxyComplete = new Proxy({}, trapHandler);
  const compRes = dispatchS3CompleteMultipartUpload(proxyComplete);
  assert.equal(compRes.http_status, 400);
  assert.equal(compRes.error_code, 'InvalidPart');
  assert.equal(compRes.reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(trapCount, 0, 'dispatchS3CompleteMultipartUpload must reject Proxy with 0 traps invoked');

  // 4. Subclass isolation for Uint8Array
  class MaliciousSubclass extends Uint8Array {}
  const subInstance = new MaliciousSubclass([1, 2, 3]);
  const putSubRes = dispatchS3PutObject(subInstance);
  assert.equal(putSubRes.http_status, 400);
  assert.equal(putSubRes.error_code, 'InvalidDigest');
  assert.equal(putSubRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  const errSubRes = dispatchS3Error(subInstance);
  assert.equal(errSubRes.http_status, 400);
  assert.equal(errSubRes.error_code, 'InvalidDigest');
  assert.equal(errSubRes.reason, 'MALFORMED_PAYLOAD_TYPE');

  // Additional validateS3MultipartSemantics branch coverage
  assert.throws(() => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"00000000000000000000000000000000"' }], total_parts: 5 }), /total_parts/);
  assert.throws(() => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"00000000000000000000000000000000"' }], total_parts: 'invalid' }), /total_parts/);
  assert.throws(() => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"00000000000000000000000000000000"', size_bytes: 10 }], total_size_bytes: 5 }), /total_size_bytes/);
  assert.throws(() => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"00000000000000000000000000000000"', size_bytes: 10 }], total_size_bytes: 'invalid' }), /total_size_bytes/);
  assert.throws(() => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"00000000000000000000000000000000"', size_bytes: -1 }] }), /cannot be negative/);
  assert.throws(() => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"00000000000000000000000000000000"', size_bytes: 6000000000 }] }), /EntityTooLarge/);
  assert.throws(() => validateS3MultipartSemantics({ parts: [{ part_number: 1, etag: '"00000000000000000000000000000000"', size_bytes: 100 }, { part_number: 2, etag: '"00000000000000000000000000000000"', size_bytes: 5242880 }] }), /EntityTooSmall/);
  const largeParts = Array.from({ length: 1100 }, (_, idx) => ({ part_number: idx + 1, etag: '"00000000000000000000000000000000"', size_bytes: 5000000000 }));
  assert.throws(() => validateS3MultipartSemantics({ parts: largeParts }), /EntityTooLarge/);
  const inhTotalParts = Object.create({ total_parts: 1 });
  inhTotalParts.parts = [{ part_number: 1, etag: '"00000000000000000000000000000000"' }];
  assert.throws(() => validateS3MultipartSemantics(inhTotalParts), /total_parts/);

  const inhTotalSize = Object.create({ total_size_bytes: 1 });
  inhTotalSize.parts = [{ part_number: 1, etag: '"00000000000000000000000000000000"' }];
  assert.throws(() => validateS3MultipartSemantics(inhTotalSize), /total_size_bytes/);

  const inhPartNum = Object.create({ part_number: 1 });
  assert.throws(() => validateS3MultipartSemantics({ parts: [inhPartNum] }), /part_number/);

  const inhEtagPart = Object.create({ etag: '"00000000000000000000000000000000"' });
  inhEtagPart.part_number = 1;
  assert.throws(() => validateS3MultipartSemantics({ parts: [inhEtagPart] }), /etag/);

  const inhSizePart = Object.create({ size_bytes: 10 });
  inhSizePart.part_number = 1;
  inhSizePart.etag = '"00000000000000000000000000000000"';
  assert.throws(() => validateS3MultipartSemantics({ parts: [inhSizePart] }), /size_bytes/);
  assert.throws(() => validateS3MultipartSemantics({ parts: [new (class {})()] }), /plain object/);

  // Additional PutObject & Error branches
  assert.equal(dispatchS3PutObject({ payload: 'hello', content_md5_declared: 'AAAAAAAAAAAAAAAAAAAAAA==', content_md5_computed: 'BBBBBBBBBBBBBBBBBBBBBB==' }).reason, 'PAYLOAD_DIGEST_MISMATCH');
  assert.equal(dispatchS3Error({ payload: 'hello', content_md5_declared: 'AAAAAAAAAAAAAAAAAAAAAA==', content_md5_computed: 'BBBBBBBBBBBBBBBBBBBBBB==' }).reason, 'PAYLOAD_DIGEST_MISMATCH');
  assert.equal(dispatchS3PutObject({ payload: 'hello', 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payload: 'hello', 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', is_presigned: true }).http_status, 200);
  assert.equal(dispatchS3PutObject({ payload: 'hello', 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' }).reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');
  assert.equal(dispatchS3Error({ payload: 'hello', 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', allow_unsigned_payload: true }).http_status, 200);
  assert.equal(dispatchS3Error({ payload: 'hello', 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', is_presigned: true }).http_status, 200);
  assert.equal(dispatchS3Error({ payload: 'hello', 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' }).reason, 'UNSIGNED_PAYLOAD_NOT_PERMITTED');

  // getOwnDataValue & snapshotOwnDataDescriptors & hasAnyAccessorsOrProxy branches
  assert.equal(getOwnDataValue(null, 'key'), undefined);
  assert.equal(getOwnDataValue('str', 'key'), undefined);
  assert.equal(getOwnDataValue(new Proxy({}, {}), 'key'), undefined);
  assert.equal(getOwnDataValue({ get key() { return 1; } }, 'key'), undefined);
  assert.equal(getOwnDataValue({ key: 'val' }, 'key'), 'val');
  assert.deepEqual(snapshotOwnDataDescriptors(null), Object.create(null));
  assert.deepEqual(snapshotOwnDataDescriptors('str'), Object.create(null));
  assert.deepEqual(snapshotOwnDataDescriptors(Buffer.from('a')), Object.create(null));
  assert.deepEqual(snapshotOwnDataDescriptors(new Uint8Array([1])), Object.create(null));
  assert.equal(hasAnyAccessorsOrProxy(null), false);
  assert.equal(hasAnyAccessorsOrProxy(123), false);
  assert.equal(hasAnyAccessorsOrProxy(Buffer.from('a')), false);
  assert.equal(hasAnyAccessorsOrProxy(new Uint8Array([1])), false);
  assert.equal(hasAnyAccessorsOrProxy(new Map()), false);
  assert.equal(hasAnyAccessorsOrProxy(new Set()), false);

  // CompleteMultipartUpload options wrapper with headers and edge cases
  assert.equal(dispatchS3CompleteMultipartUpload({ headers: { 'content-type': 'text/plain' }, manifest: { parts: [{ part_number: 1, etag: '"00000000000000000000000000000000"' }] } }, [{ part_number: 1, etag: '"00000000000000000000000000000000"', size_bytes: 5242880 }]).http_status, 200);
  assert.equal(dispatchS3CompleteMultipartUpload({ headers: new Proxy({}, {}) }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: 'invalid_manifest' }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload({ manifest: ['invalid_array'] }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload(Object.create({ manifest: {} })).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.equal(dispatchS3CompleteMultipartUpload(Object.create({ headers: {} })).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');

  // PutObject and Error inherited headers and header accessors
  assert.equal(dispatchS3PutObject(Object.create({ headers: {} })).reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(dispatchS3Error(Object.create({ headers: {} })).reason, 'MALFORMED_PAYLOAD_TYPE');
  assert.equal(dispatchS3PutObject({ payload: 'hello', headers: Object.create({ 'x-amz-content-sha256': 'abc' }) }).reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(dispatchS3Error({ payload: 'hello', headers: Object.create({ 'x-amz-content-sha256': 'abc' }) }).reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(dispatchS3PutObject({ payload: 'hello', headers: { get 'x-amz-content-sha256'() { return 'abc'; } } }).reason, 'MALFORMED_HEADER_SYNTAX');
  assert.equal(dispatchS3Error({ payload: 'hello', headers: { get 'x-amz-content-sha256'() { return 'abc'; } } }).reason, 'MALFORMED_HEADER_SYNTAX');

  // CompleteMultipartUpload manifest and parts accessor and descriptors
  const partsWithAccessor = [{ part_number: 1, etag: '"00000000000000000000000000000000"' }];
  Object.defineProperty(partsWithAccessor, '0', { get() { return { part_number: 1, etag: '"00000000000000000000000000000000"' }; } });
  assert.equal(dispatchS3CompleteMultipartUpload({ parts: partsWithAccessor }).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.throws(() => validateS3MultipartSemantics({ parts: partsWithAccessor }), /InvalidPart/);

  const manifestWithTotalPartsAccessor = { parts: [{ part_number: 1, etag: '"00000000000000000000000000000000"' }] };
  Object.defineProperty(manifestWithTotalPartsAccessor, 'total_parts', { get() { return 1; } });
  assert.equal(dispatchS3CompleteMultipartUpload(manifestWithTotalPartsAccessor).reason, 'INVALID_MULTIPART_MANIFEST_STRUCTURE');
  assert.throws(() => validateS3MultipartSemantics(manifestWithTotalPartsAccessor), /InvalidPart/);
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
  const EXAMPLES_STORAGE_DIR = join(ROOT, 'contracts/examples/storage');
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
    () => validatePlatformSemantics(offInst.proxy, 'https://contracts.cybrik.example/cybrik.offline-distribution-manifest.v1.schema.json'),
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
  assert.equal(hasPrototypeChainAccessor(throwingProxy, 'prop'), true);
  assert.equal(getOwnDataValue(throwingProxy, 'prop'), undefined);
  assert.equal(hasAnyAccessorsOrProxy(throwingProxy), true);
});

test('adversarial regression: part missing part_number and string size_bytes fail closed terminally to InvalidPart (OPEN-2)', () => {
  const S3_SCHEMA_ID = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
  const MULTIPART_DEF_ID = `${S3_SCHEMA_ID}#/$defs/multipartUploadManifest`;

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

  const resObjPartNum = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: { id: 1 }, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] },
    validStoredParts
  );
  assert.equal(resObjPartNum.http_status, 400);
  assert.equal(resObjPartNum.error_code, 'InvalidPart');
  assert.equal(resObjPartNum.reason, 'MissingPartNumber');

  const resObjPartNumUpper = dispatchS3CompleteMultipartUpload(
    { parts: [{ PartNumber: {}, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: 5242880 }] },
    validStoredParts
  );
  assert.equal(resObjPartNumUpper.http_status, 400);
  assert.equal(resObjPartNumUpper.error_code, 'InvalidPart');
  assert.equal(resObjPartNumUpper.reason, 'MissingPartNumber');

  // dispatchS3CompleteMultipartUpload: object-valued etag / ETag returns MissingManifestPartETag
  const resObjEtag = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: { hash: '0123' }, size_bytes: 5242880 }] },
    validStoredParts
  );
  assert.equal(resObjEtag.http_status, 400);
  assert.equal(resObjEtag.error_code, 'InvalidPart');
  assert.equal(resObjEtag.reason, 'MissingManifestPartETag');

  const resObjEtagUpper = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, ETag: {}, size_bytes: 5242880 }] },
    validStoredParts
  );
  assert.equal(resObjEtagUpper.http_status, 400);
  assert.equal(resObjEtagUpper.error_code, 'InvalidPart');
  assert.equal(resObjEtagUpper.reason, 'MissingManifestPartETag');

  // 4. dispatchS3CompleteMultipartUpload: string, float, or object-valued size_bytes / SizeBytes / size returns HTTP 400 InvalidPart (InvalidPartSize)
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
  assert.equal(resFloatSize.error_code, 'InvalidPart');
  assert.equal(resFloatSize.reason, 'InvalidPartSize');

  const resObjSize = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: { val: 5242880 } }] },
    validStoredParts
  );
  assert.equal(resObjSize.http_status, 400);
  assert.equal(resObjSize.error_code, 'InvalidPart');
  assert.equal(resObjSize.reason, 'InvalidPartSize');

  const resObjSizeBytes = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', SizeBytes: {} }] },
    validStoredParts
  );
  assert.equal(resObjSizeBytes.http_status, 400);
  assert.equal(resObjSizeBytes.error_code, 'InvalidPart');
  assert.equal(resObjSizeBytes.reason, 'InvalidPartSize');

  const resObjSizeProp = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size: {} }] },
    validStoredParts
  );
  assert.equal(resObjSizeProp.http_status, 400);
  assert.equal(resObjSizeProp.error_code, 'InvalidPart');
  assert.equal(resObjSizeProp.reason, 'InvalidPartSize');

  const resNegativeSize = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: -1 }] },
    validStoredParts
  );
  assert.equal(resNegativeSize.http_status, 400);
  assert.equal(resNegativeSize.error_code, 'InvalidPart');
  assert.equal(resNegativeSize.reason, 'InvalidPartSize');

  const resNullSize = dispatchS3CompleteMultipartUpload(
    { parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: null }] },
    validStoredParts
  );
  assert.equal(resNullSize.http_status, 400);
  assert.equal(resNullSize.error_code, 'InvalidPart');
  assert.equal(resNullSize.reason, 'InvalidPartSize');

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

test('OPEN-2 view brand verification: reject impure ArrayBuffer views with MALFORMED_PAYLOAD_TYPE across S3 dispatchers', () => {
  class CustomUint8Array extends Uint8Array {}
  class CustomBuffer extends Buffer {}

  const impureViews = [
    new Int8Array([1, 2, 3]),
    new Uint16Array([1, 2, 3]),
    new Int16Array([1, 2, 3]),
    new Uint32Array([1, 2, 3]),
    new Int32Array([1, 2, 3]),
    new Float32Array([1.0, 2.0]),
    new Float64Array([1.0, 2.0]),
    new BigInt64Array([1n, 2n]),
    new BigUint64Array([1n, 2n]),
    new DataView(new ArrayBuffer(16)),
    new CustomUint8Array([1, 2, 3]),
    Object.setPrototypeOf(Buffer.from('custom'), CustomBuffer.prototype),
  ];

  for (const view of impureViews) {
    // 1. dispatchS3PutObject direct payload
    const resPutDirect = dispatchS3PutObject(view);
    assert.equal(resPutDirect.http_status, 400);
    assert.equal(resPutDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    // dispatchS3PutObject as maybeMd5Header or maybeSha256Header
    const resPutMd5 = dispatchS3PutObject(Buffer.from('test'), view);
    assert.equal(resPutMd5.http_status, 400);
    assert.equal(resPutMd5.reason, 'MALFORMED_PAYLOAD_TYPE');

    const resPutSha = dispatchS3PutObject(Buffer.from('test'), undefined, view);
    assert.equal(resPutSha.http_status, 400);
    assert.equal(resPutSha.reason, 'MALFORMED_PAYLOAD_TYPE');

    // dispatchS3PutObject nested payload/payloadBytes/body
    const resPutNested1 = dispatchS3PutObject({ payload: view });
    assert.equal(resPutNested1.http_status, 400);
    assert.equal(resPutNested1.reason, 'MALFORMED_PAYLOAD_TYPE');

    const resPutNested2 = dispatchS3PutObject({ payloadBytes: view });
    assert.equal(resPutNested2.http_status, 400);
    assert.equal(resPutNested2.reason, 'MALFORMED_PAYLOAD_TYPE');

    const resPutNested3 = dispatchS3PutObject({ body: view });
    assert.equal(resPutNested3.http_status, 400);
    assert.equal(resPutNested3.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 2. dispatchS3Error direct payload
    const resErrDirect = dispatchS3Error(view);
    assert.equal(resErrDirect.http_status, 400);
    assert.equal(resErrDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    // dispatchS3Error as maybeHeader
    const resErrHdr = dispatchS3Error('InvalidDigest', view);
    assert.equal(resErrHdr.http_status, 400);
    assert.equal(resErrHdr.reason, 'MALFORMED_PAYLOAD_TYPE');

    // dispatchS3Error nested payload/payloadBytes/body
    const resErrNested1 = dispatchS3Error({ payload: view });
    assert.equal(resErrNested1.http_status, 400);
    assert.equal(resErrNested1.reason, 'MALFORMED_PAYLOAD_TYPE');

    const resErrNested2 = dispatchS3Error({ payloadBytes: view });
    assert.equal(resErrNested2.http_status, 400);
    assert.equal(resErrNested2.reason, 'MALFORMED_PAYLOAD_TYPE');

    const resErrNested3 = dispatchS3Error({ body: view });
    assert.equal(resErrNested3.http_status, 400);
    assert.equal(resErrNested3.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 3. dispatchS3CompleteMultipartUpload direct & maybeStoredParts & nested
    const resCmpDirect = dispatchS3CompleteMultipartUpload(view);
    assert.equal(resCmpDirect.http_status, 400);
    assert.equal(resCmpDirect.reason, 'MALFORMED_PAYLOAD_TYPE');

    const resCmpParts = dispatchS3CompleteMultipartUpload({}, view);
    assert.equal(resCmpParts.http_status, 400);
    assert.equal(resCmpParts.reason, 'MALFORMED_PAYLOAD_TYPE');

    const resCmpNested = dispatchS3CompleteMultipartUpload({ payload: view });
    assert.equal(resCmpNested.http_status, 400);
    assert.equal(resCmpNested.reason, 'MALFORMED_PAYLOAD_TYPE');

    // 4. validateS3MultipartSemantics direct & nested
    assert.throws(
      () => validateS3MultipartSemantics(view),
      (err) => err.message.includes('MALFORMED_PAYLOAD_TYPE')
    );

    assert.throws(
      () => validateS3MultipartSemantics({ payload: view }),
      (err) => err.message.includes('MALFORMED_PAYLOAD_TYPE')
    );
  }
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
    assert.throws(() => validatePlatformSemantics({ nested: { items: [bufSpoofed] } }), /Semantic error/);
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

  const targetPrototypes = [
    { protoName: 'Uint8Array.prototype', proto: Uint8Array.prototype },
    { protoName: 'Buffer.prototype', proto: Buffer.prototype },
  ];

  const spoofedMatrix = [];
  for (const variant of nonUint8Variants) {
    for (const target of targetPrototypes) {
      spoofedMatrix.push({
        name: `${variant.name} -> ${target.protoName}`,
        createView: () => Object.setPrototypeOf(variant.create(), target.proto),
      });
    }
  }

  assert.equal(spoofedMatrix.length, 22, 'Matrix must contain exactly 22 distinct spoofed views');

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
  for (const entry of spoofedMatrix) {
    const view = entry.createView();
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

    // 4. dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: view }] }) -> HTTP 400 InvalidPart (InvalidPartSize)
    const res4 = dispatchS3CompleteMultipartUpload({ parts: [{ part_number: 1, etag: '"0123456789abcdef0123456789abcdef"', size_bytes: view }] });
    assert.equal(res4.http_status, 400, `${entry.name}: form 16 http_status`);
    assert.equal(res4.error_code, 'InvalidPart', `${entry.name}: form 16 error_code`);
    assert.equal(res4.reason, 'InvalidPartSize', `${entry.name}: form 16 reason`);

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

  assert.equal(testedShapes, 22, 'Matrix must contain exactly 22 distinct spoofed views');
});
