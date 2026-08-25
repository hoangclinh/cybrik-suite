import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { validateOpenItemEffectMatrix } from '../validate-schemas.mjs';

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


function validatePlatformSemantics(data, schemaId) {
  if (schemaId === 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json') {
    if (data.advertised_capabilities && data.conformance_evidence) {
      const validTests = new Set();
      for (const e of data.conformance_evidence) {
        if (validTests.has(e.test_identifier)) {
          throw new Error(`Semantic error: duplicate test_identifier '${e.test_identifier}'`);
        }
        validTests.add(e.test_identifier);
      }
      for (const cap of data.advertised_capabilities) {
        for (const ref of (cap.evidence_references || [])) {
          if (!validTests.has(ref)) {
            throw new Error(`Semantic error: evidence_reference '${ref}' not found in conformance_evidence`);
          }
        }
      }
    }
    if (data.claim_type === 'FULL_PROFILE_CONFORMANCE_DECLARATION' && data.target_profile_id && data.target_profile_digest) {
      const profilePath = join(EXAMPLES_DIR, `${data.target_profile_id}.profile.json`);
      if (!existsSync(profilePath)) {
        throw new Error(`Semantic error: target profile fixture '${data.target_profile_id}.profile.json' not found`);
      }
      const actualDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');
      if (actualDigest !== data.target_profile_digest) {
        throw new Error(`Semantic error: target_profile_digest '${data.target_profile_digest}' does not match actual digest '${actualDigest}'`);
      }
    }
  } else if (schemaId === 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json') {
    if (data.artifacts) {
      const paths = new Set();
      for (const art of data.artifacts) {
        const norm = posix.normalize(art.path);
        if (paths.has(norm)) {
          throw new Error(`Semantic error: duplicate artifact path '${norm}'`);
        }
        paths.add(norm);
      }
    }
  }
}

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
    else if (file.includes('offline-bundle-manifest')) schemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
    else if (file.includes('platform-contract')) schemaId = 'https://contracts.cybrik.example/cybrik.platform-contract.v1.schema.json';
    else if (file.includes('storage-s3-subset')) schemaId = 'https://contracts.cybrik.example/cybrik.storage-s3-compatibility-subset.v1.schema.json';

    assert.ok(schemaId, `Could not determine schemaId for ${file}`);

    const valid = ajv.validate(schemaId, data);
    assert.ok(valid, `Positive fixture ${file} failed validation: ${ajv.errorsText()}`);
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
  'invalid-s3-missing-crud.json': { keyword: 'minItems', instancePath: '/required_operations', schemaPath: '#/properties/required_operations/minItems', params: { limit: 14 }, message: 'must NOT have fewer than 14 items' },
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
    "provider_namespace": "evil-corp",
    "claim_type": "PARTIAL_CAPABILITY_ADVERTISEMENT",
    "advertised_capabilities": [
      {
        "capability_name": "cap-storage",
        "slot_id": "storage",
        "description": "Storage slot",
        "evidence_references": ["missing-test"]
      }
    ],
    "conformance_evidence": [
      {
        "test_identifier": "test-1",
        "verification_method": "AUTOMATED_TEST",
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
    "operator_trust_root": {
      "signing_key_id": "key-123456",
      "public_key_fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "signature_algorithm": "ed25519"
    },
    "bundle_signature": "aB3/dE9+A/1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_=",
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
      "preflight_steps": ["check-disk-space"],
      "apply_steps": ["extract-images"],
      "rollback_steps": ["restore-backup"]
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
    "operator_trust_root": {
      "signing_key_id": "key-123456",
      "public_key_fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "signature_algorithm": "ed25519"
    },
    "bundle_signature": "aB3/dE9+A/1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_=",
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
      "preflight_steps": ["check-disk-space"],
      "apply_steps": ["extract-images"],
      "rollback_steps": ["restore-backup"]
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
    "operator_trust_root": {
      "signing_key_id": "key-123456",
      "public_key_fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "signature_algorithm": "ed25519"
    },
    "bundle_signature": "aB3/dE9+A/1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_=",
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
      "preflight_steps": ["check-disk-space"],
      "apply_steps": ["extract-images"],
      "rollback_steps": ["restore-backup"]
    },
    "canonicalization_scheme": "RFC_8785_JCS"
  };

  const valid = ajv.validate(schemaId, data);
  assert.ok(!valid, 'Should reject trailing slash path');
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
  assert.equal(parsed['2.1'].length, 27, `Section 2.1 expected 27 rows, got ${parsed['2.1'].length}`);
  assert.equal(parsed['2.2'].length, 13, `Section 2.2 expected 13 rows, got ${parsed['2.2'].length}`);
  assert.equal(parsed['2.3'].length, 72, `Section 2.3 expected 72 rows, got ${parsed['2.3'].length}`);
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

  // Verify machine-readable classification ledger and digest
  const ledgerPath = join(ROOT, 'docs/architecture/PRODUCT-MODULE-CLASSIFICATION-LEDGER.json');
  assert.ok(existsSync(ledgerPath), 'PRODUCT-MODULE-CLASSIFICATION-LEDGER.json must exist');
  const ledgerRaw = readFileSync(ledgerPath, 'utf8');
  const ledgerDigest = createHash('sha256').update(ledgerRaw).digest('hex');
  assert.equal(ledgerDigest, '382b95e130a86215d563d5bc95ce54e1d3a4c343a49dfac94c8b0b76bf1e6213', 'Ledger digest mismatch');

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
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/content/sigma/collection_archive_staging.yml'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/__init__.py'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/context/wire.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/context/models.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/forensics/search.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/copilot/gateway.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/signer.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/models.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/errors.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/soar/connectors/__init__.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/soar/library.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ioc/taxii.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/common.py'].classification, 'PRODUCT_CORE');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/greenbone.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/__init__.py'].classification, 'PRODUCT_IMPLEMENTATION_ADAPTER');
  assert.equal(ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/__init__.py'].classification, 'GOVERNANCE_OR_DOCUMENTATION');
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

  // Negative regression probes for AI and Fabric README exclusions in map selectors
  assert.ok(content.includes('tests/ (excluding README.md), .github/'), 'Map must contain explicit AI test README exclusion');
  assert.ok(content.includes('tests/ (excluding **/README.md), contracts-vendor/fixtures/'), 'Map must contain explicit Fabric test README exclusion');
});
