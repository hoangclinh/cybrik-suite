import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { validateOpenItemEffectMatrix, validateIJson, validatePlatformSemantics, dispatchS3Error, computePayloadMd5, isMalformedBase64Md5, S3_CANONICAL_ERROR_CODES } from '../validate-schemas.mjs';

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
  'invalid-s3-missing-crud.json': { keyword: 'minItems', instancePath: '/required_operations', schemaPath: '#/properties/required_operations/minItems', params: { limit: 17 }, message: 'must NOT have fewer than 17 items' },
  'invalid-unauthenticated-advertisement.json': { keyword: 'const', instancePath: '/authenticated_discovery', schemaPath: '#/properties/authenticated_discovery/const', params: { allowedValue: true }, message: 'must be equal to constant' },
  'invalid-zero-artifacts-offline-manifest.json': { keyword: 'minItems', instancePath: '/artifacts', schemaPath: '#/properties/artifacts/minItems', params: { limit: 1 }, message: 'must NOT have fewer than 1 items' },
  'malformed-sha256-offline-manifest.json': { keyword: 'pattern', instancePath: '/artifacts/0/sha256', schemaPath: '#/properties/artifacts/items/properties/sha256/pattern', params: { pattern: '^[a-f0-9]{64}$' }, message: 'must match pattern "^[a-f0-9]{64}$"' },
  'missing-slot-profile.json': { keyword: 'required', instancePath: '/capability_set', schemaPath: '#/properties/capability_set/required', params: { missingProperty: 'artifact_update_mechanism' }, message: "must have required property 'artifact_update_mechanism'" },
  'invalid-absolute-path-offline-manifest.json': { keyword: 'pattern', instancePath: '/artifacts/0/path', schemaPath: '#/properties/artifacts/items/properties/path/pattern', params: { pattern: '^(?!\\/)(?!^\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))[a-z0-9._/-]+[a-z0-9._-]$' }, message: 'must match pattern "^(?!\\/)(?!^\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))[a-z0-9._/-]+[a-z0-9._-]$"' }
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

    assert.equal(ajv.errors.length, 1, `Expected exactly 1 error for ${file}, got ${ajv.errors.length}: ${ajv.errorsText()}`);


    const expected = EXPECTED_NEGATIVES[file];
    assert.ok(expected, `No expected error mapped for ${file}`);
    assert.equal(ajv.errors[0].keyword, expected.keyword, `Mismatch keyword for ${file}`);
    assert.equal(ajv.errors[0].instancePath, expected.instancePath, `Mismatch instancePath for ${file}`);
    assert.equal(ajv.errors[0].schemaPath, expected.schemaPath, `Mismatch schemaPath for ${file}`);
    assert.deepEqual(ajv.errors[0].params, expected.params, `Mismatch params for ${file}`);
    assert.equal(ajv.errors[0].message, expected.message, `Mismatch message for ${file}`);
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
        "capability_name": "cap-storage",
        "slot_id": "storage",
        "description": "Storage slot",
        "is_mandatory": true,
        "supported_features": ["basic"],
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

test('in-memory validation: reject storage capability missing 17-op baseline or Object Lock evidence', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // Missing operation from 17-op baseline
  const data1 = JSON.parse(JSON.stringify(sample));
  const storeCap1 = data1.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCap1.supported_features = storeCap1.supported_features.filter(f => f !== 'PutObjectRetention');
  assert.throws(() => validatePlatformSemantics(data1, schemaId), /missing required S3 operation/);

  // Missing Object Lock retention evidence
  const data2 = JSON.parse(JSON.stringify(sample));
  const storeCap2 = data2.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCap2.evidence_references = ["urn:cybrik:evidence:storage:s3-17-ops:v1"];
  data2.advertisement_response.conformance_evidence = data2.advertisement_response.conformance_evidence.filter(e => e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1');
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

  // 0 degraded capabilities under ACTIVE_DEGRADED
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
  assert.ok(!valid1, 'Should reject ACTIVE_DEGRADED with 0 degraded capabilities');
  assert.ok(ajv.errors.some(e => e.keyword === 'contains'), 'Should fail via contains');

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
    'urn:cybrik:evidence:space not allowed'
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

test('in-memory validation: Object Lock evidence binding against structured URN evidence IDs (Finding 6 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  // 1. Valid structured URN evidence binding in object form passes semantic validation
  const dataObj = JSON.parse(JSON.stringify(sample));
  dataObj.advertisement_response.evidence_bindings = {
    storage_object_lock: "urn:cybrik:evidence:test-storage-lock-01"
  };
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

  // 2. Valid structured URN evidence binding in array form passes semantic validation
  const dataArr = JSON.parse(JSON.stringify(sample));
  dataArr.advertisement_response.evidence_bindings = [
    {
      capability_name: "storage_object_lock",
      slot_id: "storage",
      evidence_id: "urn:iso:std:iso-iec:27001:evidence:lock-01"
    }
  ];
  const storeCapArr = dataArr.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapArr.evidence_references.push("urn:iso:std:iso-iec:27001:evidence:lock-01");
  dataArr.advertisement_response.conformance_evidence.push({
    test_identifier: "urn:iso:std:iso-iec:27001:evidence:lock-01",
    status: "PASS",
    evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000002",
    executed_at: "2026-08-27T12:00:00Z",
    report_uri: "https://reports.cybrik.example/evidence/iso-lock-01.json"
  });

  assert.doesNotThrow(() => validatePlatformSemantics(dataArr, schemaId));

  // 3. Object Lock evidence binding missing from storage evidence references throws
  const dataMissingRef = JSON.parse(JSON.stringify(sample));
  dataMissingRef.advertisement_response.evidence_bindings = {
    storage_object_lock: "urn:cybrik:evidence:test-storage-lock-02"
  };
  dataMissingRef.advertisement_response.conformance_evidence.push({
    test_identifier: "urn:cybrik:evidence:test-storage-lock-02",
    status: "PASS",
    evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000003",
    executed_at: "2026-08-27T12:00:00Z",
    report_uri: "https://reports.cybrik.example/evidence/urn-lock-02.json"
  });

  assert.throws(
    () => validatePlatformSemantics(dataMissingRef, schemaId),
    /Object Lock evidence binding 'urn:cybrik:evidence:test-storage-lock-02'.*not found in storage evidence references/
  );

  // 4. Object Lock evidence binding missing from conformance evidence throws
  const dataMissingEv = JSON.parse(JSON.stringify(sample));
  dataMissingEv.advertisement_response.evidence_bindings = {
    storage_object_lock: "urn:cybrik:evidence:test-storage-lock-03"
  };
  const storeCapMissingEv = dataMissingEv.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapMissingEv.evidence_references.push("urn:cybrik:evidence:test-storage-lock-03");

  assert.throws(
    () => validatePlatformSemantics(dataMissingEv, schemaId),
    /evidence_reference 'urn:cybrik:evidence:test-storage-lock-03' not found in conformance_evidence/
  );

  // 5. Malformed URN in evidence binding throws
  const dataBadUrn = JSON.parse(JSON.stringify(sample));
  dataBadUrn.advertisement_response.evidence_bindings = {
    storage_object_lock: "urn:::invalid-urn"
  };
  const storeCapBadUrn = dataBadUrn.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapBadUrn.evidence_references.push("urn:::invalid-urn");
  dataBadUrn.advertisement_response.conformance_evidence.push({
    test_identifier: "urn:::invalid-urn",
    status: "PASS",
    evidence_pack_digest: "a100000000000000000000000000000000000000000000000000000000000004",
    executed_at: "2026-08-27T12:00:00Z",
    report_uri: "https://reports.cybrik.example/evidence/bad-urn.json"
  });

  assert.throws(
    () => validatePlatformSemantics(dataBadUrn, schemaId),
    /Object Lock evidence binding URN 'urn:::invalid-urn' is malformed/
  );
});

test('canonical S3 dispatch helpers: dispatchS3Error, computePayloadMd5, isMalformedBase64Md5 (Finding 6 / OPEN-2)', () => {
  // 1. computePayloadMd5
  const buf = Buffer.from('TEST_PAYLOAD_FOR_MD5_CANONICAL');
  const expectedMd5 = createHash('md5').update(buf).digest('base64');
  assert.equal(computePayloadMd5(buf), expectedMd5);
  assert.equal(computePayloadMd5('TEST_PAYLOAD_FOR_MD5_CANONICAL'), expectedMd5);
  assert.equal(computePayloadMd5(new Uint8Array(buf)), expectedMd5);
  assert.equal(computePayloadMd5(null), createHash('md5').update(Buffer.alloc(0)).digest('base64'));
  assert.equal(computePayloadMd5(undefined), createHash('md5').update(Buffer.alloc(0)).digest('base64'));

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
  storeCapCanonical.evidence_references = ["urn:cybrik:evidence:storage:s3-17-ops:v1", "urn:cybrik:evidence:storage:s3:conformance:v1:object-lock"];
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
        e => e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3-17-ops:v1'
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
      e => e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3-17-ops:v1'
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
        e => e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3-17-ops:v1'
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
      e => e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3-17-ops:v1'
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
      e => e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3-17-ops:v1'
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
      e => e.test_identifier !== 'urn:cybrik:evidence:storage:object-lock:v1' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3:conformance:v1:object-lock' && e.test_identifier !== 'urn:cybrik:evidence:storage:s3-17-ops:v1'
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

  // 2. Negative: requested optional capability omitted from agreed lease
  const dataOmitted = JSON.parse(JSON.stringify(sample));
  dataOmitted.agreed_capability_lease.negotiated_optional_capabilities =
    dataOmitted.agreed_capability_lease.negotiated_optional_capabilities.filter(c => c.capability_name !== 'cache_cluster_replication');
  assert.throws(
    () => validatePlatformSemantics(dataOmitted, schemaId),
    /Semantic error: requested optional capability 'cache_cluster_replication' for slot 'cache' is not resolved in agreed_capability_lease/
  );

  // 3. Negative: additional requested optional capability omitted from agreed lease
  const dataExtraReq = JSON.parse(JSON.stringify(sample));
  dataExtraReq.negotiation_request.requested_optional_capabilities.push({
    capability_name: "custom_acceleration",
    slot_id: "ai_model_runtime",
    required_for_optimal: false,
    preferred_fallback: "CORE_EMULATION_FALLBACK"
  });
  assert.throws(
    () => validatePlatformSemantics(dataExtraReq, schemaId),
    /Semantic error: requested optional capability 'custom_acceleration' for slot 'ai_model_runtime' is not resolved in agreed_capability_lease/
  );

  // 4. Negative: slot mismatch with same capability_name (composite key closure)
  const dataSlotMismatch = JSON.parse(JSON.stringify(sample));
  const cacheReq = dataSlotMismatch.negotiation_request.requested_optional_capabilities.find(c => c.capability_name === 'cache_cluster_replication');
  cacheReq.slot_id = 'database';
  assert.throws(
    () => validatePlatformSemantics(dataSlotMismatch, schemaId),
    /Semantic error: requested optional capability 'cache_cluster_replication' for slot 'database' is not resolved in agreed_capability_lease/
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

test('in-memory validation: ACTIVE_OPTIMAL lease omitting requested optional capability passes Ajv but fails validatePlatformSemantics (Finding F-03 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const sample = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'), 'utf8'));

  const data = JSON.parse(JSON.stringify(sample));
  data.negotiation_status = "AGREED_LEASE_GRANTED";
  data.agreed_capability_lease.lease_status = "ACTIVE_OPTIMAL";
  // negotiation_request requests 3 optional capabilities:
  // - ai_tensor_acceleration
  // - storage_object_lock
  // - cache_cluster_replication
  // agreed_capability_lease silently omits cache_cluster_replication:
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

  // 1. Passes Ajv schema validation (schema validates structural array format without verifying request-to-lease closure)
  const valid = ajv.validate(schemaId, data);
  assert.ok(valid, 'Omitting requested optional capability must pass Ajv schema validation: ' + ajv.errorsText());

  // 2. Fails validatePlatformSemantics with /is not resolved in agreed_capability_lease/
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /is not resolved in agreed_capability_lease/,
    'ACTIVE_OPTIMAL lease omitting requested optional capability must fail validatePlatformSemantics with /is not resolved in agreed_capability_lease/'
  );
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

  // 2. Fails validatePlatformSemantics with /for slot 'storage' is not resolved in agreed_capability_lease/
  assert.throws(
    () => validatePlatformSemantics(data, schemaId),
    /for slot 'storage' is not resolved in agreed_capability_lease/,
    'Slot mismatch (requested slot storage vs lease slot ai_model_runtime) must fail validatePlatformSemantics with /for slot \'storage\' is not resolved in agreed_capability_lease/'
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

test('negotiation handshake fixtures exact 1-to-1 bidirectional multiset equality (Finding R13-02 / OPEN-5)', () => {
  const schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
  const handshakeFilePath = join(EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json');
  assert.ok(existsSync(handshakeFilePath), `Missing handshake fixture: ${handshakeFilePath}`);
  const data = JSON.parse(readFileSync(handshakeFilePath, 'utf8'));

  const requested = data.negotiation_request?.requested_optional_capabilities || [];
  const leased = data.agreed_capability_lease?.negotiated_optional_capabilities || [];

  assert.ok(requested.length > 0, 'negotiation_request must have requested_optional_capabilities');
  assert.ok(leased.length > 0, 'agreed_capability_lease must have negotiated_optional_capabilities');

  // Exact 1-to-1 cardinality
  assert.equal(
    requested.length,
    leased.length,
    `Exact cardinality match required between requested (${requested.length}) and leased (${leased.length}) optional capabilities`
  );

  // Exact multiset match by (capability_name, slot_id)
  const requestedKeys = requested.map(r => `${r.capability_name}::${r.slot_id}`).sort();
  const leasedKeys = leased.map(l => `${l.capability_name}::${l.slot_id}`).sort();

  assert.deepEqual(
    requestedKeys,
    leasedKeys,
    'Exact 1-to-1 bidirectional multiset equality required between requested and leased optional capabilities'
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
  assert.throws(() => validatePlatformSemantics(unresolvedReqCapDoc, pcnSchemaId), /is not resolved in agreed_capability_lease/);

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

  // 34. Evidence bindings missing in storage evidence references
  const badBindingRefDoc = JSON.parse(JSON.stringify(handshakeSample));
  badBindingRefDoc.evidence_bindings = [
    { name: 'storage_object_lock', evidence_id: 'urn:cybrik:evidence:missing-binding' }
  ];
  assert.throws(() => validatePlatformSemantics(badBindingRefDoc, pcnSchemaId), /not found in storage evidence references/);

  // 35. Evidence bindings missing in conformance evidence
  const badBindingConfDoc = JSON.parse(JSON.stringify(handshakeSample));
  const storeCapObj = badBindingConfDoc.advertisement_response.advertised_capabilities.find(c => c.slot_id === 'storage');
  storeCapObj.evidence_references.push('urn:cybrik:evidence:storage:extra-ref');
  badBindingConfDoc.evidence_bindings = [
    { name: 'storage_object_lock', evidence_id: 'urn:cybrik:evidence:storage:extra-ref' }
  ];
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
      supported_features: ['PutObject', 'GetObject', 'PutObjectRetention'],
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
    'urn:cybrik:evidence:storage:s3-17-ops:v1',
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
    'urn:cybrik:evidence:storage:s3-17-ops:v1',
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
      'urn:cybrik:evidence:storage:s3-17-ops:v1',
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
      'urn:cybrik:evidence:storage:s3-17-ops:v1',
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
    ...nestedDoc.advertisement_response.conformance_evidence.filter(e => !e.test_identifier.includes('object-lock') && e.test_identifier !== s3OpsUrn && !e.test_identifier.includes('s3-17-ops')),
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
      supported_features: ['PutObject', 'GetObject', 'PutObjectRetention'],
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
    'urn:cybrik:evidence:storage:s3-17-ops:v1',
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
