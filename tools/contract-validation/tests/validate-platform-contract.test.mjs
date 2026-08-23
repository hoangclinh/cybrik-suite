import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

function validateJson(schemaPath, dataPath) {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    console.error(validate.errors);
  }
  return valid;
}

test('validate deployment profiles against schema', () => {
  const schemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.deployment-profile.v1.schema.json');
  const examples = [
    'onprem-standard-v1.profile.json',
    'onprem-airgap-v1.profile.json',
    'private-cloud-v1.profile.json',
    'hybrid-sovereign-v1.profile.json'
  ];

  for (const example of examples) {
    const dataPath = path.resolve(projectRoot, 'contracts/examples/platform', example);
    assert.ok(validateJson(schemaPath, dataPath), `${example} failed validation`);
  }
});

test('validate provider capability advertisement against schema', () => {
  const schemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.provider-capability-advertisement.v1.schema.json');
  const dataPath = path.resolve(projectRoot, 'contracts/examples/platform/sample-provider-capability-advertisement.json');
  assert.ok(validateJson(schemaPath, dataPath), 'sample-provider-capability-advertisement.json failed validation');
});

test('validate offline bundle manifest against schema', () => {
  const schemaPath = path.resolve(projectRoot, 'contracts/json-schema/cybrik.offline-install-update-manifest.v1.schema.json');
  const dataPath = path.resolve(projectRoot, 'contracts/examples/platform/sample-offline-bundle-manifest.json');
  assert.ok(validateJson(schemaPath, dataPath), 'sample-offline-bundle-manifest.json failed validation');
});
