import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;
const ajv = new Ajv2020({ strict: true, strictTypes: false, strictRequired: false, allErrors: true, allowUnionTypes: true });
addFormats(ajv);
for (const kw of ['x-cybrik-status', 'x-cybrik-not-accepted', 'x-cybrik-contract-version', 'x-cybrik-format-pins']) {
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
  'cybrik.offline-install-update-manifest.v1.schema.json',
];

const loadSchemas = () => {
  for (const name of PLATFORM_SCHEMAS) {
    const doc = JSON.parse(readFileSync(join(JSON_SCHEMA_DIR, name), 'utf8'));
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
    'sample-provider-capability-advertisement.json',
    'sample-offline-bundle-manifest.json'
  ];
  
  for (const file of positives) {
    const path = join(EXAMPLES_DIR, file);
    if (!existsSync(path)) continue;
    const data = JSON.parse(readFileSync(path, 'utf8'));
    
    // Determine schema id
    let schemaId;
    if (file.includes('profile')) schemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
    else if (file.includes('advertisement')) schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
    else if (file.includes('manifest')) schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
    else if (file.includes('contract')) schemaId = 'https://contracts.cybrik.example/cybrik.platform-contract.v1.schema.json';
    
    if (!schemaId) continue;
    
    const valid = ajv.validate(schemaId, data);
    assert.ok(valid, `Positive fixture ${file} failed validation: ${ajv.errorsText()}`);
  }
});

test('validate negative platform fixtures', () => {
  const negatives = [
    { file: 'invalid-lowercase-tier-profile.json', schemaId: 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json' },
    { file: 'invalid-leading-zero-semver.json', schemaId: 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json' },
    { file: 'invalid-platform-all-false.json', schemaId: 'https://contracts.cybrik.example/cybrik.platform-contract.v1.schema.json' },
    { file: 'invalid-unauthenticated-advertisement.json', schemaId: 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json' },
    { file: 'invalid-missing-evidence-advertisement.json', schemaId: 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json' },
    { file: 'invalid-empty-trust-root-offline-manifest.json', schemaId: 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json' },
    { file: 'invalid-zero-artifacts-offline-manifest.json', schemaId: 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json' }
  ];
  
  for (const { file, schemaId } of negatives) {
    const path = join(EXAMPLES_DIR, 'negative', file);
    if (!existsSync(path)) continue;
    const data = JSON.parse(readFileSync(path, 'utf8'));
    
    const valid = ajv.validate(schemaId, data);
    assert.ok(!valid, `Negative fixture ${file} incorrectly passed validation`);
  }
});
