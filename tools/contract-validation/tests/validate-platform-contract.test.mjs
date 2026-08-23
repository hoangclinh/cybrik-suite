import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

test('validate deployment profiles against schema (positive)', () => {
  const ajv = createAjv();
  const schemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.deployment-profile.v1.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const validate = ajv.compile(schema);
  
  const examples = [
    'onprem-standard-v1.profile.json',
    'onprem-airgap-v1.profile.json',
    'private-cloud-v1.profile.json',
    'hybrid-sovereign-v1.profile.json'
  ];

  for (const example of examples) {
    const dataPath = path.resolve(projectRoot, 'contracts/examples/platform', example);
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    assert.ok(validate(data), `${example} failed validation: ${JSON.stringify(validate.errors)}`);
  }
});

test('validate provider capability advertisement against schema (positive)', () => {
  const ajv = createAjv();
  const schemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.provider-capability-advertisement.v1.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const validate = ajv.compile(schema);
  
  const dataPath = path.resolve(projectRoot, 'contracts/examples/platform/sample-provider-capability-advertisement.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.ok(validate(data), 'sample-provider-capability-advertisement.json failed validation');
});

test('validate offline bundle manifest against schema (positive)', () => {
  const ajv = createAjv();
  const schemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.offline-install-update-manifest.v1.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const validate = ajv.compile(schema);

  const dataPath = path.resolve(projectRoot, 'contracts/examples/platform/sample-offline-bundle-manifest.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.ok(validate(data), 'sample-offline-bundle-manifest.json failed validation');
});

test('validate platform contract schema (positive)', () => {
  const ajv = createAjv();
  const schemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.platform-contract.v1.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const validate = ajv.compile(schema);
  const data = {
    version: "1.0",
    slots: {
      "oci_container_runtime": true,
      "isolation_substrate": true,
      "orchestration_capability": true,
      "network_segmentation": true,
      "storage": true,
      "database": true,
      "cache": true,
      "secrets": true,
      "crypto": true,
      "identity_workload_identity": true,
      "observability": true,
      "ai_model_runtime": true,
      "artifact_update_mechanism": true
    }
  };
  assert.ok(validate(data), 'platform contract schema validation failed');
});

test('validate negative fixtures', () => {
  const ajv = createAjv();

  // Profile Negative
  const profileSchemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.deployment-profile.v1.schema.json');
  const validateProfile = ajv.compile(JSON.parse(fs.readFileSync(profileSchemaPath, 'utf8')));

  const invalidBare = JSON.parse(fs.readFileSync(path.resolve(projectRoot, 'contracts/examples/platform/negative/invalid-bare-tier-profile.json'), 'utf8'));
  assert.strictEqual(validateProfile(invalidBare), false, 'invalid-bare-tier-profile.json should fail');

  const missingSlot = JSON.parse(fs.readFileSync(path.resolve(projectRoot, 'contracts/examples/platform/negative/missing-slot-profile.json'), 'utf8'));
  assert.strictEqual(validateProfile(missingSlot), false, 'missing-slot-profile.json should fail');

  // Manifest Negative
  const manifestSchemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.offline-install-update-manifest.v1.schema.json');
  const validateManifest = ajv.compile(JSON.parse(fs.readFileSync(manifestSchemaPath, 'utf8')));

  const malformedSha256 = JSON.parse(fs.readFileSync(path.resolve(projectRoot, 'contracts/examples/platform/negative/malformed-sha256-offline-manifest.json'), 'utf8'));
  assert.strictEqual(validateManifest(malformedSha256), false, 'malformed-sha256-offline-manifest.json should fail');

  // Advertisement Negative
  const advSchemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.provider-capability-advertisement.v1.schema.json');
  const validateAdv = ajv.compile(JSON.parse(fs.readFileSync(advSchemaPath, 'utf8')));

  const invalidNs = JSON.parse(fs.readFileSync(path.resolve(projectRoot, 'contracts/examples/platform/negative/invalid-namespace-advertisement.json'), 'utf8'));
  assert.strictEqual(validateAdv(invalidNs), false, 'invalid-namespace-advertisement.json should fail');
});
