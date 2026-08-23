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
    'sample-offline-bundle-manifest.json',
    'sample-storage-s3-subset.json'
  ];
  
  for (const file of positives) {
    const path = join(EXAMPLES_DIR, file);
    assert.ok(existsSync(path), `Missing positive fixture: ${path}`);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    
    let schemaId;
    if (file.includes('profile')) schemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
    else if (file.includes('advertisement')) schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
    else if (file.includes('offline-bundle-manifest')) schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
    else if (file.includes('platform-contract')) schemaId = 'https://contracts.cybrik.example/cybrik.platform-contract.v1.schema.json';
    else if (file.includes('storage-s3-subset')) schemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
    
    assert.ok(schemaId, `Could not determine schemaId for ${file}`);
    
    const valid = ajv.validate(schemaId, data);
    assert.ok(valid, `Positive fixture ${file} failed validation: ${ajv.errorsText()}`);
  }
});

const EXPECTED_NEGATIVES = {
  'invalid-bare-tier-profile.json': { keyword: 'pattern', instancePath: '/profile_id' },
  'invalid-empty-trust-root-offline-manifest.json': { keyword: 'required', instancePath: '/operator_trust_root' },
  'invalid-leading-zero-semver.json': { keyword: 'pattern', instancePath: '/profile_version' },
  'invalid-lowercase-tier-profile.json': { keyword: 'pattern', instancePath: '/profile_id' },
  'invalid-missing-evidence-advertisement.json': { keyword: 'enum', instancePath: '/advertised_capabilities/0/slot_id' },
  'invalid-namespace-advertisement.json': { keyword: 'required', instancePath: '' },
  'invalid-platform-all-false.json': { keyword: 'type', instancePath: '/slots/oci_container_runtime' },
  'invalid-s3-missing-crud.json': { keyword: 'required', instancePath: '/mandatory_operations' },
  'invalid-unauthenticated-advertisement.json': { keyword: 'enum', instancePath: '/advertised_capabilities/0/slot_id' },
  'invalid-zero-artifacts-offline-manifest.json': { keyword: 'minItems', instancePath: '/artifacts' },
  'malformed-sha256-offline-manifest.json': { keyword: 'required', instancePath: '' },
  'missing-slot-profile.json': { keyword: 'required', instancePath: '/capability_set' }
};

test('validate negative platform fixtures', () => {
  const negatives = readdirSync(join(EXAMPLES_DIR, 'negative')).filter(f => f.endsWith('.json'));
  
  for (const file of negatives) {
    let schemaId;
    if (file.includes('profile') || file.includes('semver')) schemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
    else if (file.includes('advertisement')) schemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';
    else if (file.includes('offline-manifest') || file.includes('malformed-sha256') || file.includes('trust-root')) schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
    else if (file.includes('platform')) schemaId = 'https://contracts.cybrik.example/cybrik.platform-contract.v1.schema.json';
    else if (file.includes('s3')) schemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';
    else throw new Error("Could not map negative fixture: " + file);

    const path = join(EXAMPLES_DIR, 'negative', file);
    assert.ok(existsSync(path), `Missing negative fixture: ${path}`);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    
    const valid = ajv.validate(schemaId, data);
    assert.ok(!valid, `Negative fixture ${file} incorrectly passed validation`);

    const expected = EXPECTED_NEGATIVES[file];
    assert.ok(expected, `No expected error mapped for ${file}`);
    assert.equal(ajv.errors[0].keyword, expected.keyword, `Mismatch keyword for ${file}`);
    assert.equal(ajv.errors[0].instancePath, expected.instancePath, `Mismatch instancePath for ${file}`);
  }
});
