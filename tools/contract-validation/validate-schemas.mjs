// validate-schemas.mjs — JSON Schema 2020-12 conformance + packet integrity + security invariants.
//
// Covers (see README "Coverage"): standards metastructure, cross-file/local $ref + fragment
// resolution, positive examples, intended negative-schema fixtures, negative-semantic fixtures,
// the compatibility manifest + examples manifest (member/status/version honesty), and the 10
// hardening security invariants encoded as explicit assertions so they cannot be silently relaxed.
//
// Wire specs (OpenAPI 3.1.x, AsyncAPI 3.0.0) are validated by validate-openapi.mjs /
// validate-asyncapi.mjs; here we parse those two YAML files ONLY to (a) resolve their external
// $refs into the json-schema packet and (b) assert two hardenings that live in them.
//
// Zero external side effects. Exit 0 = all checks passed; exit 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, sep, posix } from 'node:path';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..'); // tools/contract-validation -> repo root
const CONTRACTS = join(ROOT, 'contracts');
const JSON_SCHEMA_DIR = join(CONTRACTS, 'json-schema');

const DRAFT_2020 = 'https://json-schema.org/draft/2020-12/schema';
const ID_PREFIX = 'https://contracts.cybrik.example/';
const EXPECTED_VERSION = '0.1.0';
const EXPECTED_PACKET_VERSION = '0.1.1';
const CAPABILITY_VERSION = '0.1.1';
const CAPABILITY_FILE = 'json-schema/cybrik.capability.v1.schema.json';

const errors = [];
const notes = [];
const counts = {};
const fail = (m) => errors.push(m);
const bump = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readYaml = (p) => parseYaml(readFileSync(p, 'utf8'));


function validatePlatformSemantics(data, schemaId) {
  if (schemaId.includes('provider-capability-advertisement') || schemaId.includes('provider-capability-negotiation')) {
    const adv = data.advertisement_response || data;
    if (adv.advertised_capabilities && adv.conformance_evidence) {
      const validTests = new Set();
      for (const e of adv.conformance_evidence) {
        if (validTests.has(e.test_identifier)) {
          throw new Error(`Semantic error: duplicate test_identifier '${e.test_identifier}'`);
        }
        validTests.add(e.test_identifier);
      }
      for (const cap of adv.advertised_capabilities) {
        for (const ref of (cap.evidence_references || [])) {
          if (!validTests.has(ref)) {
            throw new Error(`Semantic error: evidence_reference '${ref}' not found in conformance_evidence`);
          }
        }
      }
    }
    const claimType = adv.claim_type || data.claim_type;
    const targetProfileId = data.target_profile_id;
    const targetProfileDigest = data.target_profile_digest;
    if (claimType === 'FULL_PROFILE_CONFORMANCE_DECLARATION' && targetProfileId && targetProfileDigest) {
      const profilePath = join(CONTRACTS, 'examples/platform', `${targetProfileId}.profile.json`);
      if (!existsSync(profilePath)) {
        throw new Error(`Semantic error: target profile fixture '${targetProfileId}.profile.json' not found`);
      }
      const actualDigest = createHash('sha256').update(readFileSync(profilePath)).digest('hex');
      if (actualDigest !== targetProfileDigest) {
        throw new Error(`Semantic error: target_profile_digest '${targetProfileDigest}' does not match actual digest '${actualDigest}'`);
      }
    }
  } else if (schemaId.includes('offline-install-update-manifest')) {
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


// ---------------------------------------------------------------------------
// 0. Lifecycle state. Exactly TWO truthful states are permitted, and the
//    compatibility manifest is the single source of truth. Neither state is a
//    stable v1/GA and neither may be an immutable bundle tag (mutable snapshot
//    v0.1.1, is-bundle-tag=false). Every packet member MUST agree with the
//    manifest: a half-flipped packet (some files ACCEPTED, some PROPOSED) is a
//    consistency failure — which is exactly what checkLifecycle exists to catch.
// ---------------------------------------------------------------------------
const LIFECYCLE = {
  'PROPOSED': { status: 'PROPOSED', notAccepted: true },
  'ACCEPTED FOR IMPLEMENTATION': { status: 'ACCEPTED FOR IMPLEMENTATION', notAccepted: false },
};
const COMPAT_PATH = join(CONTRACTS, 'compatibility', 'cybrik-suite-contract-packet.v1.manifest.json');
let EXPECTED_STATE = null;
try {
  const s = readJson(COMPAT_PATH)['x-cybrik-status'];
  if (LIFECYCLE[s]) EXPECTED_STATE = s;
  else fail(`compatibility manifest: x-cybrik-status must be one of ${Object.keys(LIFECYCLE).map((k) => `'${k}'`).join(' | ')} (got '${s}'); no stable/GA status is permitted at v${EXPECTED_VERSION}`);
} catch (e) { fail(`compatibility manifest: cannot read to determine lifecycle state: ${e.message}`); }
const LC = EXPECTED_STATE ? LIFECYCLE[EXPECTED_STATE] : null;
const checkLifecycle = (label, obj) => {
  if (!LC || !obj) return;
  if (obj['x-cybrik-status'] !== LC.status) fail(`${label}: x-cybrik-status must be '${LC.status}' to match the manifest lifecycle (got '${obj['x-cybrik-status']}')`);
  if (obj['x-cybrik-not-accepted'] !== LC.notAccepted) fail(`${label}: x-cybrik-not-accepted must be ${LC.notAccepted} to match the manifest lifecycle`);
};

// ---------------------------------------------------------------------------
// 1. Load the 10 JSON Schema documents and register them with a single Ajv2020
//    instance keyed by $id. Cross-file relative $refs resolve against $id.
// ---------------------------------------------------------------------------
const SCHEMA_FILES = [
  'cybrik.common-defs.v1.schema.json',
  'cybrik.data-marking.v1.schema.json',
  'cybrik.envelope.v1.schema.json',
  'cybrik.capability.v1.schema.json',
  'cybrik.tool-execution-request.v1.schema.json',
  'cybrik.tool-execution-result.v1.schema.json',
  'cybrik.delegation-chain.v1.schema.json',
  'cybrik.execution-receipt.v1.schema.json',
  'cybrik.approval-request.v1.schema.json',
  'cybrik.approval-decision.v1.schema.json'
];

const PROPOSED_SCHEMA_FILES = [
  'cybrik.deployment-profile.v1.schema.json',
  'cybrik.platform-contract.v1.schema.json',
  'cybrik.provider-capability-advertisement.v1.schema.json',
  'cybrik.provider-capability-negotiation.v1.schema.json',
  'cybrik.offline-install-update-manifest.v1.schema.json',
  'cybrik.storage-s3-compatibility-subset.v1.schema.json'
];


// strict: true keeps genuine 2020-12 rigor (unknown-keyword typos, bad tuples, etc.), but we
// disable two ajv-SPECIFIC lints that flag idiomatic-and-spec-valid 2020-12 constructs:
//   - strictTypes: an allOf branch like {required:["tenant_id"]} needs no local "type":"object"
//     to be valid (required applies to object instances by definition).
//   - strictRequired: an if/then that requires a property defined on the PARENT (e.g. then:
//     {required:["approval_id"]}) is a standard conditional pattern, not a defect.
// These are ajv house-style heuristics beyond the JSON Schema 2020-12 spec; the schemas are
// spec-conformant. allowUnionTypes permits the spec-legal "type": ["object","array",...] unions.
const ajv = new Ajv2020({ strict: true, strictTypes: false, strictRequired: false, allErrors: true, allowUnionTypes: true });
addFormats(ajv);
// Annotation-only vendor keywords (status honesty markers). Declared so strict mode does not
// reject them as unknown, while every other strict check stays active.
for (const kw of ['x-cybrik-status', 'x-cybrik-not-accepted', 'x-cybrik-contract-version', 'x-cybrik-format-pins', 'x-cybrik-lifecycle']) {
  ajv.addKeyword({ keyword: kw });
}

const schemas = {}; // basename -> { doc, path }
const idByBasename = {};
for (const name of [...SCHEMA_FILES, ...PROPOSED_SCHEMA_FILES]) {
  const p = join(JSON_SCHEMA_DIR, name);
  if (!existsSync(p)) { fail(`missing schema file: json-schema/${name}`); continue; }
  let doc;
  try { doc = readJson(p); } catch (e) { fail(`json-schema/${name}: JSON parse error: ${e.message}`); continue; }
  schemas[name] = { doc, path: p };

  // 2. Standards metastructure per schema.
  if (doc.$schema !== DRAFT_2020) fail(`json-schema/${name}: $schema is not 2020-12 (${doc.$schema})`);
  if (typeof doc.$id !== 'string' || !doc.$id.startsWith(ID_PREFIX)) fail(`json-schema/${name}: $id missing/wrong prefix (${doc.$id})`);
  else idByBasename[name] = doc.$id;
  if (SCHEMA_FILES.includes(name)) {
    checkLifecycle(`json-schema/${name}`, doc);
  } else {
    if (doc['x-cybrik-status'] !== 'PROPOSED') fail(`json-schema/${name}: x-cybrik-status must be 'PROPOSED'`);
    if (doc['x-cybrik-not-accepted'] !== true) fail(`json-schema/${name}: x-cybrik-not-accepted must be true`);
  }
  const expectedContractVersion = name === 'cybrik.capability.v1.schema.json'
    ? CAPABILITY_VERSION
    : EXPECTED_VERSION;
  if (doc['x-cybrik-contract-version'] !== expectedContractVersion) {
    fail(`json-schema/${name}: contract-version must be ${expectedContractVersion}`);
  }
  bump('schemas_loaded');
}

// Register all before compiling so cross-file $refs resolve.
for (const [name, { doc }] of Object.entries(schemas)) {
  try { ajv.addSchema(doc); } catch (e) { fail(`json-schema/${name}: addSchema failed: ${e.message}`); }
}

// 3. Compile each — this resolves every local + cross-file $ref/$defs fragment. A dangling
//    ref throws here.
const validators = {}; // basename -> validate fn
for (const [name, { doc }] of Object.entries(schemas)) {
  if (!doc.$id) continue;
  try {
    validators[name] = ajv.getSchema(doc.$id) || ajv.compile(doc);
    bump('schemas_compiled');
  } catch (e) {
    fail(`json-schema/${name}: compile/ref-resolution failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Example fixtures, driven by examples/examples-manifest.json.
//    positive -> MUST validate; negative-schema -> MUST fail; negative-semantic -> MUST validate.
// ---------------------------------------------------------------------------
const EXAMPLES_DIR = join(CONTRACTS, 'examples');
const exManifestPath = join(EXAMPLES_DIR, 'examples-manifest.json');
let exManifest;
try { exManifest = readJson(exManifestPath); } catch (e) { fail(`examples-manifest.json: parse error: ${e.message}`); }

if (exManifest) {
  checkLifecycle('examples-manifest', exManifest);
  if (exManifest['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`examples-manifest: x-cybrik-contract-version must be ${EXPECTED_VERSION}`);
  for (const ex of exManifest.examples || []) {
    const exPath = join(EXAMPLES_DIR, ex.file);
    if (!existsSync(exPath)) { fail(`example missing on disk: examples/${ex.file}`); continue; }
    const validate = validators[ex.schema];
    if (!validate) { fail(`example ${ex.file}: no compiled validator for schema ${ex.schema}`); continue; }
    let data;
    try { data = readJson(exPath); } catch (e) { fail(`example ${ex.file}: JSON parse error: ${e.message}`); continue; }
    const ok = validate(data);
    if (ex.kind === 'positive') {
      bump('positive_total');
      if (ok) { bump('positive_pass'); validatePlatformSemantics(data, ex.schema); }
      else fail(`positive example ${ex.file} FAILED validation against ${ex.schema}: ${ajv.errorsText(validate.errors)}`);
    } else if (ex.kind === 'negative-schema') {
      bump('negative_schema_total');
      if (!ok) bump('negative_schema_reject');
      else fail(`negative-schema example ${ex.file} unexpectedly VALIDATED against ${ex.schema} (must be rejected)`);
    } else if (ex.kind === 'negative-semantic') {
      bump('negative_semantic_total');
      if (ok) bump('negative_semantic_structurally_valid');
      else fail(`negative-semantic example ${ex.file} failed STRUCTURAL validation (must be structurally valid; only a runtime invariant rejects it): ${ajv.errorsText(validate.errors)}`);
    } else {
      fail(`example ${ex.file}: unknown kind '${ex.kind}'`);
    }
  }
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 4b. Platform Example fixtures.
// ---------------------------------------------------------------------------
const PLATFORM_EXAMPLES_DIR = join(CONTRACTS, 'examples/platform');
const platformPositives = [
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

for (const file of platformPositives) {
  const exPath = join(PLATFORM_EXAMPLES_DIR, file);
  if (!existsSync(exPath)) { fail(`platform positive example missing on disk: ${file}`); continue; }

  let schemaName;
  if (file.includes('.profile.json')) schemaName = 'cybrik.deployment-profile.v1.schema.json';
  else if (file.includes('advertisement') || file.includes('declaration')) schemaName = 'cybrik.provider-capability-advertisement.v1.schema.json';
  else if (file.includes('negotiation') || file.includes('handshake')) schemaName = 'cybrik.provider-capability-negotiation.v1.schema.json';
  else if (file.includes('offline-bundle-manifest')) schemaName = 'cybrik.offline-install-update-manifest.v1.schema.json';
  else if (file.includes('platform-contract')) schemaName = 'cybrik.platform-contract.v1.schema.json';
  else if (file.includes('storage-s3-subset')) schemaName = 'cybrik.storage-s3-compatibility-subset.v1.schema.json';

  const validate = validators[schemaName];
  if (!validate) { fail(`platform example ${file}: no compiled validator for schema ${schemaName}`); continue; }
  let data;
  try { data = readJson(exPath); } catch (e) { fail(`platform example ${file}: JSON parse error: ${e.message}`); continue; }
  const ok = validate(data);
  bump('positive_total');
  if (ok) { bump('positive_pass'); validatePlatformSemantics(data, schemaName); }
  else fail(`platform positive example ${file} FAILED validation against ${schemaName}: ${ajv.errorsText(validate.errors)}`);
}

const EXPECTED_PLATFORM_NEGATIVES = {
  'invalid-absolute-path-offline-manifest.json': { keyword: 'pattern', instancePath: '/artifacts/0/path', schemaPath: '#/properties/artifacts/items/properties/path/pattern', params: { pattern: '^(?!\\/)(?!^\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))[a-z0-9._/-]+[a-z0-9._-]$' }, message: 'must match pattern "^(?!\\/)(?!^\\.\\/)(?!.*\\.\\.)(?!.*(?:\\/\\.|\\/\\/|\\/$))[a-z0-9._/-]+[a-z0-9._-]$"' },
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
  'missing-slot-profile.json': { keyword: 'required', instancePath: '/capability_set', schemaPath: '#/properties/capability_set/required', params: { missingProperty: 'artifact_update_mechanism' }, message: "must have required property 'artifact_update_mechanism'" }
};

if (existsSync(join(PLATFORM_EXAMPLES_DIR, 'negative'))) {
  const fsNode = (typeof fs !== 'undefined' ? fs : await import('node:fs'));
  const negFiles = fsNode.readdirSync(join(PLATFORM_EXAMPLES_DIR, 'negative')).filter(f => f.endsWith('.json'));
  if (negFiles.length !== Object.keys(EXPECTED_PLATFORM_NEGATIVES).length) {
    fail(`platform negative examples count mismatch: expected ${Object.keys(EXPECTED_PLATFORM_NEGATIVES).length}, got ${negFiles.length}`);
  }
  for (const file of negFiles) {
    const exPath = join(PLATFORM_EXAMPLES_DIR, 'negative', file);

    let schemaName;
    if (file.includes('profile') || file.includes('semver')) schemaName = 'cybrik.deployment-profile.v1.schema.json';
    else if (file.includes('advertisement') || file.includes('declaration')) schemaName = 'cybrik.provider-capability-advertisement.v1.schema.json';
    else if (file.includes('negotiation') || file.includes('handshake')) schemaName = 'cybrik.provider-capability-negotiation.v1.schema.json';
    else if (file.includes('offline-manifest') || file.includes('malformed-sha256') || file.includes('trust-root')) schemaName = 'cybrik.offline-install-update-manifest.v1.schema.json';
    else if (file.includes('platform')) schemaName = 'cybrik.platform-contract.v1.schema.json';
    else if (file.includes('s3')) schemaName = 'cybrik.storage-s3-compatibility-subset.v1.schema.json';

    const validate = validators[schemaName];
    if (!validate) { fail(`platform negative example ${file}: no compiled validator for schema ${schemaName}`); continue; }
    let data;
    try { data = readJson(exPath); } catch (e) { fail(`platform negative example ${file}: JSON parse error: ${e.message}`); continue; }

    const ok = validate(data);
    bump('negative_schema_total');
    if (!ok) {
      bump('negative_schema_reject');
      if (validate.errors.length !== 1) {
        fail(`platform negative example ${file}: expected exactly 1 error, got ${validate.errors.length}`);
      }
      const expected = EXPECTED_PLATFORM_NEGATIVES[file];
      if (!expected) {
        fail(`platform negative example ${file}: no expected invariant/error mapped!`);
      } else {
        const actualErr = validate.errors[0];
        if (actualErr.keyword !== expected.keyword || actualErr.instancePath !== expected.instancePath || actualErr.schemaPath !== expected.schemaPath || JSON.stringify(actualErr.params) !== JSON.stringify(expected.params) || actualErr.message !== expected.message) {
          fail(`platform negative example ${file}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actualErr)}`);
        }
      }
    } else {
      fail(`platform negative example ${file} unexpectedly VALIDATED against ${schemaName} (must be rejected)`);
    }
  }
}

// 5. Compatibility / version / status manifest.
// ---------------------------------------------------------------------------
const compatPath = join(CONTRACTS, 'compatibility', 'cybrik-suite-contract-packet.v1.manifest.json');
let compat;
try { compat = readJson(compatPath); } catch (e) { fail(`compatibility manifest: parse error: ${e.message}`); }
if (compat) {
  checkLifecycle('compatibility manifest', compat);
  if (compat['x-cybrik-packet-version'] !== EXPECTED_PACKET_VERSION) {
    fail(`compatibility manifest: packet-version must be ${EXPECTED_PACKET_VERSION}`);
  }
  // is-bundle-tag stays false in BOTH states: snapshot v0.1.1 is not immutable or stable v1/GA.
  if (compat['x-cybrik-is-bundle-tag'] !== false) {
    fail('compatibility manifest: is-bundle-tag must be false (snapshot v0.1.1 is never an immutable bundle tag / GA)');
  }
  const accStatus = compat.acceptance?.status || '';
  if (EXPECTED_STATE === 'PROPOSED') {
    if (!/NOT ACCEPTED/.test(accStatus)) fail('compatibility manifest: acceptance.status must state NOT ACCEPTED while PROPOSED');
  } else {
    // ACCEPTED FOR IMPLEMENTATION: acceptance must be affirmative, Founder-gated, and evidenced.
    if (!/ACCEPTED FOR IMPLEMENTATION/.test(accStatus)) fail('compatibility manifest: acceptance.status must state ACCEPTED FOR IMPLEMENTATION');
    if (/\bNOT ACCEPTED\b/.test(accStatus)) fail('compatibility manifest: acceptance.status must not still say NOT ACCEPTED once accepted');
    const a = compat.acceptance || {};
    if (!a.gate) fail('compatibility manifest: accepted packet must record acceptance.gate');
    if (!a.decided_by) fail('compatibility manifest: accepted packet must record acceptance.decided_by (Founder-delegated; not agent-inferred)');
    if (!a.decided_on) fail('compatibility manifest: accepted packet must record acceptance.decided_on');
    if (!Array.isArray(a.evidence) || a.evidence.length === 0) fail('compatibility manifest: accepted packet must record acceptance.evidence[]');
  }
  const pins = compat.format_pins || {};
  if (pins.jsonSchema !== '2020-12') fail('compatibility manifest: jsonSchema pin must be 2020-12');
  if (pins.openApi !== '3.1.x') fail('compatibility manifest: openApi pin must be 3.1.x');
  if (pins.asyncApi !== '3.0.0') fail('compatibility manifest: asyncApi pin must be 3.0.0');
  // Checker-gap fix: the mcp pin is asserted here AND against common-defs x-cybrik-format-pins.
  if (pins.mcp !== '2025-11-25') fail('compatibility manifest: mcp pin must be 2025-11-25');
  const cdPins = schemas['cybrik.common-defs.v1.schema.json']?.doc?.['x-cybrik-format-pins'] || {};
  if (cdPins.mcp !== '2025-11-25') fail('common-defs: x-cybrik-format-pins.mcp must be 2025-11-25');
  for (const m of compat.members || []) {
    const mp = join(CONTRACTS, m.file);
    const expectedMemberVersion = m.file === CAPABILITY_FILE ? CAPABILITY_VERSION : EXPECTED_VERSION;
    if (!existsSync(mp)) {
      fail(`compatibility manifest: member file missing: ${m.file}`);
    } else {
      const expectedHash = createHash('sha256').update(readFileSync(mp)).digest('hex');
      if (m.sha256 !== expectedHash) {
        fail(`compatibility manifest: member ${m.file} sha256 must be ${expectedHash}`);
      } else {
        bump('manifest_member_hashes_verified');
      }
    }
    if (m.contract_version !== expectedMemberVersion) {
      fail(`compatibility manifest: member ${m.file} contract_version must be ${expectedMemberVersion}`);
    }
    bump('manifest_members');
  }
  // Hardening #10: monotonicity invariants recorded as runtime obligations.
  if (!Array.isArray(compat.monotonicity_invariants?.rules) || compat.monotonicity_invariants.rules.length === 0) {
    fail('HARDENING#10: manifest.monotonicity_invariants.rules missing/empty');
  }
}

// ---------------------------------------------------------------------------
// 6. Wire-spec external $ref integrity + two YAML-resident hardenings.
// ---------------------------------------------------------------------------
const openapiPath = join(CONTRACTS, 'openapi', 'cybrik-fabric-control-plane.v1.openapi.yaml');
const asyncapiPath = join(CONTRACTS, 'asyncapi', 'cybrik-suite-events.v1.asyncapi.yaml');
let openapi, asyncapi;
try { openapi = readYaml(openapiPath); } catch (e) { fail(`openapi YAML parse error: ${e.message}`); }
try { asyncapi = readYaml(asyncapiPath); } catch (e) { fail(`asyncapi YAML parse error: ${e.message}`); }

// Cross-file lifecycle consistency for the wire specs and the MCP notes, so a
// partially-flipped packet cannot pass. OpenAPI/AsyncAPI carry the marker triple
// in info; the MCP notes are markdown, so assert the header Status line textually.
if (openapi?.info) checkLifecycle('openapi info', openapi.info);
if (asyncapi?.info) checkLifecycle('asyncapi info', asyncapi.info);
if (EXPECTED_STATE) {
  try {
    const mcpText = readFileSync(join(CONTRACTS, 'mcp', 'cybrik-mcp-mapping-notes.v1.md'), 'utf8');
    if (EXPECTED_STATE === 'PROPOSED') {
      if (!/Status:\s*`PROPOSED`\s*—\s*\*\*NOT ACCEPTED\*\*/.test(mcpText)) fail('mcp notes: header Status must read `PROPOSED` — **NOT ACCEPTED** to match the lifecycle');
    } else if (!/Status:\s*\*\*ACCEPTED FOR IMPLEMENTATION\*\*/.test(mcpText)) {
      fail('mcp notes: header Status must read **ACCEPTED FOR IMPLEMENTATION** to match the lifecycle');
    }
  } catch (e) { fail(`mcp notes: cannot read to check lifecycle: ${e.message}`); }
}

// Collect every $ref string recursively.
const collectRefs = (node, acc) => {
  if (Array.isArray(node)) { for (const v of node) collectRefs(v, acc); }
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') acc.push(v);
      else collectRefs(v, acc);
    }
  }
  return acc;
};

const ptrResolve = (docObj, pointer) => {
  if (!pointer) return docObj;
  const parts = pointer.replace(/^#/, '').split('/').filter(Boolean).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = docObj;
  for (const part of parts) { if (cur == null || !(part in cur)) return undefined; cur = cur[part]; }
  return cur;
};

const checkFileRefs = (label, docObj, docDir) => {
  const refs = collectRefs(docObj, []);
  for (const ref of refs) {
    bump('wire_refs_total');
    if (ref.startsWith('#')) continue; // internal, resolved by the spec validators
    const [filePart, frag] = ref.split('#');
    const target = resolve(docDir, filePart);
    // Containment: a $ref must stay inside contracts/. Contract YAML is contributor-editable,
    // so a malicious external $ref (e.g. ../../../../etc/passwd) must never cause a read
    // outside the packet — a parse error on such a file could otherwise echo its contents to
    // public CI logs. Escaping refs are a validation failure, not a filesystem read.
    const CONTRACTS_ROOT = resolve(CONTRACTS);
    if (target !== CONTRACTS_ROOT && !target.startsWith(CONTRACTS_ROOT + sep)) {
      fail(`${label}: external $ref escapes contracts/ (refused): ${ref}`); continue;
    }
    if (!existsSync(target)) { fail(`${label}: dangling external $ref, file not found: ${ref}`); continue; }
    if (frag) {
      let tdoc;
      try { tdoc = target.endsWith('.json') ? readJson(target) : readYaml(target); } catch (e) { fail(`${label}: cannot parse $ref target ${filePart}: ${e.message}`); continue; }
      if (ptrResolve(tdoc, frag) === undefined) fail(`${label}: dangling fragment $ref (pointer not found): ${ref}`);
    }
    bump('wire_refs_external_resolved');
  }
};
if (openapi) checkFileRefs('openapi', openapi, join(CONTRACTS, 'openapi'));
if (asyncapi) checkFileRefs('asyncapi', asyncapi, join(CONTRACTS, 'asyncapi'));

// ---------------------------------------------------------------------------
// 7. The 10 security hardenings as explicit, brittle-on-purpose assertions.
//    A regression that relaxes any hardening fails CI here.
// ---------------------------------------------------------------------------
const doc = (n) => schemas[n]?.doc;
const req = (o) => (o && Array.isArray(o.required)) ? o.required : [];
const hasTenantIdAllOf = (node) =>
  node && Array.isArray(node.allOf) && node.allOf.some((m) => Array.isArray(m.required) && m.required.includes('tenant_id'));
const H = (id, cond, msg) => { bump('hardenings_checked'); if (cond) bump('hardenings_ok'); else fail(`HARDENING#${id}: ${msg}`); };

// #1 idempotency_key minLength 16 (request schema + OpenAPI param).
const ter = doc('cybrik.tool-execution-request.v1.schema.json');
H(1, ter?.properties?.idempotency_key?.minLength === 16, 'tool-execution-request idempotency_key.minLength must be 16');
const idemParam = openapi?.components?.parameters?.IdempotencyKey?.schema?.minLength;
H('1b', idemParam === 16, `OpenAPI IdempotencyKey param minLength must be 16 (got ${idemParam})`);

// #2 actor.tenant_id required at the 5 cross-tenant authz sites.
H('2a', hasTenantIdAllOf(ter?.properties?.actor), 'tool-execution-request.actor must require tenant_id');
const del = doc('cybrik.delegation-chain.v1.schema.json');
H('2b', hasTenantIdAllOf(del?.$defs?.grant?.properties?.issuer), 'delegation grant.issuer must require tenant_id');
H('2c', hasTenantIdAllOf(del?.$defs?.grant?.properties?.subject), 'delegation grant.subject must require tenant_id');
H('2d', hasTenantIdAllOf(doc('cybrik.approval-request.v1.schema.json')?.properties?.requested_by), 'approval-request.requested_by must require tenant_id');
H('2e', hasTenantIdAllOf(doc('cybrik.approval-decision.v1.schema.json')?.properties?.decided_by), 'approval-decision.decided_by must require tenant_id');
// common-defs must define tenantId.
H('2f', !!doc('cybrik.common-defs.v1.schema.json')?.$defs?.tenantId, 'common-defs must define $defs.tenantId');

// #3 tool-execution-result.tenant_id required.
H(3, req(doc('cybrik.tool-execution-result.v1.schema.json')).includes('tenant_id'), 'tool-execution-result must require tenant_id');

// #4 approval-decision.delegation_ref required.
H(4, req(doc('cybrik.approval-decision.v1.schema.json')).includes('delegation_ref'), 'approval-decision must require delegation_ref');

// #5 capability.network_policy required + broker_allowlist => limits.max_egress_bytes.
const cap = doc('cybrik.capability.v1.schema.json');
H('5a', req(cap).includes('network_policy'), 'capability must require network_policy');
const capAllOf = JSON.stringify(cap?.allOf || []);
H('5b', capAllOf.includes('broker_allowlist') && capAllOf.includes('max_egress_bytes'), 'capability must conditionally require limits.max_egress_bytes when network_policy=broker_allowlist');

// #6 delegation scope.max_risk_class required.
H(6, req(del?.$defs?.grant?.properties?.scope).includes('max_risk_class'), 'delegation grant.scope must require max_risk_class');

// #7 execution-receipt performed=true => target_digest required.
const rcptSide = doc('cybrik.execution-receipt.v1.schema.json')?.properties?.side_effect;
const sideAllOf = JSON.stringify(rcptSide?.allOf || []);
H(7, sideAllOf.includes('target_digest') && sideAllOf.includes('performed'), 'execution-receipt side_effect must require target_digest when performed=true');

// #8 tool-execution-request.data_marking required.
H(8, req(ter).includes('data_marking'), 'tool-execution-request must require data_marking');

// #9 AsyncAPI per-message data payloads bound; kill_switch data deferred (fail-closed).
const msgs = asyncapi?.components?.messages || {};
const dataBound = (m) => Array.isArray(m?.payload?.allOf) && m.payload.allOf.some((e) => Array.isArray(e.required) && e.required.includes('data'));
for (const key of ['alertSnapshotCreated', 'invocationRequested', 'invocationCompleted', 'approvalRequired', 'approvalDecided']) {
  H(`9:${key}`, dataBound(msgs[key]), `AsyncAPI message ${key} must bind a typed data payload (allOf requiring data)`);
}
const kill = msgs.killSwitchChanged;
H('9:kill', !!kill?.payload?.$ref && !kill?.payload?.allOf, 'AsyncAPI killSwitchChanged data must remain deferred (envelope-only, no data binding)');

// #H1 (W2B-H1) — approval-decision.decided_by is constrained to a HUMAN. A schema-
// enforceable human-in-the-loop control: decided_by.type MUST be const "user", so an
// agent/service identity can never decide an approval (SoD alone would miss this).
const apprDec = doc('cybrik.approval-decision.v1.schema.json')?.properties?.decided_by;
const decidedByUserConst = Array.isArray(apprDec?.allOf) && apprDec.allOf.some((m) => m?.properties?.type?.const === 'user');
H('H1', decidedByUserConst, 'approval-decision.decided_by MUST constrain type to const "user" (human-in-the-loop; no agent/service approver)');

// #H2 (W2B-H2) — delegation min-ceiling / non-escalation is BOTH defined in the manifest
// and exercised by the fixtures. Risk order R0<R1<R2<R3. chainEscalates() returns true iff
// some grant[i>=1] exceeds the running minimum ceiling of its predecessors (an elevation).
const RISK = { R0: 0, R1: 1, R2: 2, R3: 3 };
const chainEscalates = (chain) => {
  const grants = chain?.grants || [];
  let runningMin = Infinity;
  for (let i = 0; i < grants.length; i++) {
    const cls = RISK[grants[i]?.scope?.max_risk_class];
    if (cls === undefined) return false; // malformed shape is reported by schema validation
    if (i >= 1 && cls > runningMin) return true; // grant[i] raises above min(predecessors) => escalation
    runningMin = Math.min(runningMin, cls);
  }
  return false;
};
const ce = compat?.monotonicity_invariants?.chain_evaluation;
const ceText = JSON.stringify(ce || {});
H('H2a', !!ce && /MIN/i.test(ceText) && /MUST NOT/i.test(ceText) && /(approver_co_grant|co-grant)/i.test(ceText),
  'manifest.monotonicity_invariants.chain_evaluation must define the MIN effective ceiling and that an approver co-grant MUST NOT elevate it');
let posChain, negEscChain;
try { posChain = readJson(join(EXAMPLES_DIR, 'positive/delegation-chain.json')); } catch { /* reported by example loop */ }
try { negEscChain = readJson(join(EXAMPLES_DIR, 'negative/delegation-chain.privilege-escalation.json')); } catch { /* reported by example loop */ }
H('H2b', !!posChain && !chainEscalates(posChain), 'positive delegation-chain fixture must be NON-escalating (no grant exceeds the running minimum ceiling)');
H('H2c', !!negEscChain && chainEscalates(negEscChain), 'negative privilege-escalation fixture MUST actually escalate (a co-grant exceeding the root ceiling), proving the min-ceiling rule is exercised');

// ---------------------------------------------------------------------------
// Summary

// #10 verify FULL_PROFILE_CONFORMANCE_DECLARATION distinct slots
const pcaSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-advertisement.v1.schema.json';

const originalPca = readJson(join(PLATFORM_EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'));
const pcaData = JSON.parse(JSON.stringify(originalPca));
pcaData.advertised_capabilities[1].slot_id = pcaData.advertised_capabilities[0].slot_id;

const pcaValid = ajv.validate(pcaSchemaId, pcaData);
const pcaHasContains = !pcaValid && ajv.errors.some(e => e.keyword === 'contains');
const pcaHasNoDigestErr = !pcaValid && !ajv.errors.some(e => e.keyword === 'required' && e.params?.missingProperty === 'target_profile_digest');

H('10', !pcaValid && pcaHasContains && pcaHasNoDigestErr, 'FULL_PROFILE_CONFORMANCE_DECLARATION with duplicated distinct slot must be rejected via contains keyword');

// 11. in-memory validation: reject advertisement with unresolvable evidence reference (referential integrity)
const pcaUnresolvable = {
  target_profile_id: "onprem-standard-v1",
  target_profile_version: "1.0.0",
  provider_namespace: "evil-corp",
  claim_type: "PARTIAL_CAPABILITY_ADVERTISEMENT",
  advertised_capabilities: [
    {
      capability_name: "cap-storage",
      slot_id: "storage",
      description: "Storage slot",
      evidence_references: ["missing-test"]
    }
  ],
  conformance_evidence: [
    {
      test_identifier: "test-1",
      verification_method: "AUTOMATED_TEST",
      report_uri: "https://example.com/report"
    }
  ],
  degradation_behavior: "FAIL_CLOSED",
  authenticated_discovery: true
};
try {
  validatePlatformSemantics(pcaUnresolvable, pcaSchemaId);
  fail('referential integrity: expected validatePlatformSemantics to throw on missing evidence reference');
} catch (e) {
  H('11', e.message.includes('missing-test'), 'referential integrity check must catch missing evidence references');
}

// 18. in-memory validation: reject FULL_PROFILE_CONFORMANCE_DECLARATION with mismatched digest
const pcaBadDigest = JSON.parse(JSON.stringify(readJson(join(PLATFORM_EXAMPLES_DIR, 'sample-full-profile-conformance-declaration.json'))));
pcaBadDigest.target_profile_digest = "0000000000000000000000000000000000000000000000000000000000000000";
try {
  validatePlatformSemantics(pcaBadDigest, pcaSchemaId);
  fail('digest binding: expected validatePlatformSemantics to throw on mismatched digest');
} catch (e) {
  H('18', e.message.includes('does not match actual digest'), 'digest binding check must catch mismatched target profile digest');
}

// 12. in-memory validation: reject offline manifest with duplicate artifact paths (path uniqueness)
const manifestSchemaId = 'https://contracts.cybrik.example/cybrik.offline-install-update-manifest.v1.schema.json';
const dupManifest = {
  bundle_identifier: "my-bundle-1",
  release_tag: "v1.2.3",
  operator_trust_root: {
    signing_key_id: "key-123456",
    public_key_fingerprint: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    signature_algorithm: "ed25519"
  },
  bundle_signature: "aB3/dE9+A/1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_=",
  artifacts: [
    {
      name: "image-1",
      path: "images/image-1.tar",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      size_bytes: 1024
    },
    {
      name: "image-2",
      path: "images/image-1.tar",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      size_bytes: 2048
    }
  ],
  migration_reversibility_guaranteed: true,
  rollback_procedure_reference: "doc://rollback",
  update_station_workflow: {
    preflight_steps: ["check-disk-space"],
    apply_steps: ["extract-images"],
    rollback_steps: ["restore-backup"]
  },
  canonicalization_scheme: "RFC_8785_JCS"
};
try {
  validatePlatformSemantics(dupManifest, manifestSchemaId);
  fail('path uniqueness: expected validatePlatformSemantics to throw on duplicate paths');
} catch (e) {
  H('12', e.message.includes('duplicate artifact path'), 'path uniqueness check must catch duplicate artifact paths');
}

// 13. in-memory validation: reject offline manifest with alias collision paths (alias collision)
const aliasManifest = {
  ...dupManifest,
  artifacts: [
    {
      name: "image-1",
      path: "images/image-1.tar",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      size_bytes: 1024
    },
    {
      name: "image-2",
      path: "./images/image-1.tar",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      size_bytes: 2048
    }
  ]
};
try {
  validatePlatformSemantics(aliasManifest, manifestSchemaId);
  fail('alias collision: expected validatePlatformSemantics to throw on aliased paths');
} catch (e) {
  H('13', e.message.includes('duplicate artifact path'), 'alias collision check must catch aliased artifact paths');
}

// 14. in-memory validation: reject offline manifest with trailing slash path
const trailingSlashManifest = {
  ...dupManifest,
  artifacts: [
    {
      name: "image-1",
      path: "images/image-1.tar/",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      size_bytes: 1024
    }
  ]
};
const trailingValid = ajv.validate(manifestSchemaId, trailingSlashManifest);
H('14', !trailingValid, 'trailing slash path must be rejected by schema');

// ---------------------------------------------------------------------------

// 15. in-memory validation: reject S1 with mediated egress
const profileSchemaId = 'https://contracts.cybrik.example/cybrik.deployment-profile.v1.schema.json';
const s1Profile = JSON.parse(JSON.stringify(readJson(join(PLATFORM_EXAMPLES_DIR, 'onprem-standard-v1.profile.json'))));
s1Profile.isolation_policy.floor = "S1_DYNAMIC_TENANT_WORKLOAD";
s1Profile.isolation_policy.admitted_risk_classes = ["DYNAMIC_TENANT_WORKLOAD", "DETERMINISTIC_SERVICE_CONTAINER"];
s1Profile.isolation_policy.network_egress_isolation = "MEDIATED_EGRESS_BROKER";
const s1Valid = ajv.validate(profileSchemaId, s1Profile);
H('15', !s1Valid && ajv.errors.some(e => e.instancePath === '/isolation_policy/network_egress_isolation' && e.keyword === 'const'), 'S1 with MEDIATED_EGRESS_BROKER must be rejected (requires FAIL_CLOSED_NO_EGRESS)');

// 16. in-memory validation: reject S3 with no egress
const s3Profile = JSON.parse(JSON.stringify(readJson(join(PLATFORM_EXAMPLES_DIR, 'onprem-standard-v1.profile.json'))));
s3Profile.isolation_policy.floor = "S3_HARDWARE_VIRTUALIZED_HYPERVISOR";
s3Profile.isolation_policy.network_egress_isolation = "FAIL_CLOSED_NO_EGRESS";
const s3Valid = ajv.validate(profileSchemaId, s3Profile);
H('16', !s3Valid && ajv.errors.some(e => e.instancePath === '/isolation_policy/network_egress_isolation' && e.keyword === 'const'), 'S3 with FAIL_CLOSED_NO_EGRESS must be rejected (requires MEDIATED_EGRESS_BROKER)');

// 17. in-memory validation: reject platform slot with bare uppercase/tier conformance_profile
const platformContractSchemaId = 'https://contracts.cybrik.example/cybrik.platform-contract.v1.schema.json';
const platformContract = JSON.parse(JSON.stringify(readJson(join(PLATFORM_EXAMPLES_DIR, 'sample-platform-contract.json'))));
platformContract.slots.oci_container_runtime.conformance_profile = "TIER_0";
const platformValid = ajv.validate(platformContractSchemaId, platformContract);
H('17', !platformValid && ajv.errors.length === 1 && ajv.errors[0].instancePath === '/slots/oci_container_runtime/conformance_profile' && ajv.errors[0].keyword === 'pattern', 'Platform contract with bare "TIER_0" conformance_profile must be rejected');

// 21. in-memory validation: reject capability negotiation with unverified evidence binding when active lease granted
const pcnSchemaId = 'https://contracts.cybrik.example/cybrik.provider-capability-negotiation.v1.schema.json';
const pcnSample = readJson(join(PLATFORM_EXAMPLES_DIR, 'sample-capability-negotiation-handshake.json'));
const pcnUnverified = JSON.parse(JSON.stringify(pcnSample));
pcnUnverified.evidence_binding_verified = false;
const pcnUnverifiedValid = ajv.validate(pcnSchemaId, pcnUnverified);
H('21', !pcnUnverifiedValid && ajv.errors.some(e => e.instancePath === '/evidence_binding_verified' && e.keyword === 'const'), 'Capability negotiation with unverified evidence binding when lease granted must be rejected');

// 22. in-memory validation: reject capability negotiation with missing mandatory slots in lease
const pcnMissingMandatory = JSON.parse(JSON.stringify(pcnSample));
pcnMissingMandatory.agreed_capability_lease.mandatory_slots_satisfied = pcnMissingMandatory.agreed_capability_lease.mandatory_slots_satisfied.filter(s => s !== 'oci_container_runtime');
const pcnMissingValid = ajv.validate(pcnSchemaId, pcnMissingMandatory);
H('22', !pcnMissingValid && ajv.errors.some(e => e.keyword === 'contains'), 'Capability negotiation lease missing mandatory oci_container_runtime slot must be rejected via contains');

export function validateOpenItemEffectMatrix(proposalMarkdown) {
  const lines = proposalMarkdown.split('\n');
  const tableStartIndex = lines.findIndex(l => l.includes('## 10. Required Open-Item Effect Matrix'));
  if (tableStartIndex === -1) throw new Error('Missing section: ## 10. Required Open-Item Effect Matrix');

  const nextSectionIndex = lines.findIndex((l, i) => i > tableStartIndex && l.startsWith('## '));
  const sectionEndIndex = nextSectionIndex !== -1 ? nextSectionIndex : lines.length;

  const headerIndex = lines.findIndex((l, i) => i > tableStartIndex && i < sectionEndIndex && l.trim().startsWith('| OPEN ID |'));
  if (headerIndex === -1) throw new Error('Missing table header for Open-Item Effect Matrix');

  const rows = [];
  let tableEnded = false;

  for (let i = headerIndex + 2; i < sectionEndIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (!line.startsWith('|')) {
      tableEnded = true;
      continue;
    }

    if (tableEnded && line.startsWith('|')) {
      throw new Error('Governance guard failed: Multiple tables or trailing table rows found in Section 10');
    }

    const parts = line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (parts.length !== 4) {
      throw new Error(`Governance guard failed: Matrix row must have exactly 4 columns, found ${parts.length}`);
    }
    rows.push({
      id: parts[0],
      title: parts[1],
      status: parts[2],
      effect: parts[3]
    });
  }

  if (rows.length !== 11) {
    throw new Error(`Governance guard failed: Matrix must have exactly 11 rows, found ${rows.length}`);
  }

  const expectedMatrix = [
    { id: 'OPEN-1', title: '`OFFLINE_INSTALL_UPDATE_CONTRACT`', status: 'OPEN', effect: 'OPEN, PARTIALLY_UNBLOCKED' },
    { id: 'OPEN-2', title: '`S3_COMPATIBILITY_MINIMUM_CONTRACT`', status: 'OPEN', effect: 'OPEN, PARTIALLY_UNBLOCKED' },
    { id: 'OPEN-3', title: '`AI_DNS_TOCTOU_EGRESS_GUARD`', status: 'OPEN', effect: 'OPEN, UNAFFECTED' },
    { id: 'OPEN-4', title: '`CANONICAL_T0_T1_T2_SEMANTICS`', status: 'RESOLVED', effect: 'RESOLVED' },
    { id: 'OPEN-5', title: '`OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION`', status: 'OPEN', effect: 'OPEN, PARTIALLY_UNBLOCKED' },
    { id: 'OPEN-6', title: '`VIRTUALIZATION_SUBSTRATE_SELECTION`', status: 'OPEN', effect: 'OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION' },
    { id: 'OPEN-7', title: '`KUBERNETES_DISTRIBUTION_SELECTION`', status: 'OPEN', effect: 'OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION' },
    { id: 'OPEN-8', title: '`PROVIDER_SELECTION_AUTHORITY_MODEL`', status: 'OPEN', effect: 'OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION' },
    { id: 'OPEN-9', title: 'Legal interpretation of deployment location and cross-domain obligations', status: 'OPEN', effect: 'OPEN, REQUIRES_SEPARATE_LEGAL_TRACK' },
    { id: 'OPEN-10', title: 'Platform Contract slot semantics (all 13 slots, §5.2)', status: 'RESOLVED', effect: 'RESOLVED' },
    { id: 'OPEN-11', title: '`PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY`', status: 'OPEN', effect: 'OPEN, PARTIALLY_UNBLOCKED / PER_MODULE_CLASSIFICATION_REMAINS_OPEN' }
  ];

  const seenIds = new Set();
  for (let i = 0; i < expectedMatrix.length; i++) {
    const row = rows[i];
    const expected = expectedMatrix[i];

    if (!row) throw new Error(`Governance guard failed: Missing row ${i + 1}`);
    if (seenIds.has(row.id)) throw new Error(`Governance guard failed: Duplicate ID ${row.id}`);
    seenIds.add(row.id);

    if (row.id !== expected.id) {
      throw new Error(`Governance guard failed: Expected ID ${expected.id} at row ${i + 1}, found ${row.id}`);
    }
    if (row.title !== expected.title) {
      throw new Error(`Governance guard failed: Swapped or incorrect title for ${row.id}: ${row.title}`);
    }
    if (row.status !== expected.status) {
      throw new Error(`Governance guard failed: Unauthorized status for ${row.id}: ${row.status}`);
    }
    if (row.effect !== expected.effect) {
      throw new Error(`Governance guard failed: Unauthorized effect for ${row.id}: ${row.effect}`);
    }
  }
}

// 19. Governance guard: Platform contract OPEN items tracking
try {
  const validBaseTable = `## 10. Required Open-Item Effect Matrix

| OPEN ID | Verbatim ADR-0015 Title | Current Status / Semantic Meaning | Effect of Platform Contract Proposal |
|---|---|---|---|
| OPEN-1 | \`OFFLINE_INSTALL_UPDATE_CONTRACT\` | OPEN | OPEN, PARTIALLY_UNBLOCKED |
| OPEN-2 | \`S3_COMPATIBILITY_MINIMUM_CONTRACT\` | OPEN | OPEN, PARTIALLY_UNBLOCKED |
| OPEN-3 | \`AI_DNS_TOCTOU_EGRESS_GUARD\` | OPEN | OPEN, UNAFFECTED |
| OPEN-4 | \`CANONICAL_T0_T1_T2_SEMANTICS\` | RESOLVED | RESOLVED |
| OPEN-5 | \`OPTIONAL_PROVIDER_CAPABILITY_NEGOTIATION\` | OPEN | OPEN, PARTIALLY_UNBLOCKED |
| OPEN-6 | \`VIRTUALIZATION_SUBSTRATE_SELECTION\` | OPEN | OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION |
| OPEN-7 | \`KUBERNETES_DISTRIBUTION_SELECTION\` | OPEN | OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION |
| OPEN-8 | \`PROVIDER_SELECTION_AUTHORITY_MODEL\` | OPEN | OPEN, REQUIRES_SEPARATE_FOUNDER_DECISION |
| OPEN-9 | Legal interpretation of deployment location and cross-domain obligations | OPEN | OPEN, REQUIRES_SEPARATE_LEGAL_TRACK |
| OPEN-10 | Platform Contract slot semantics (all 13 slots, §5.2) | RESOLVED | RESOLVED |
| OPEN-11 | \`PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY\` | OPEN | OPEN, PARTIALLY_UNBLOCKED / PER_MODULE_CLASSIFICATION_REMAINS_OPEN |

## 11. Next Action Sequence
`;

  const expectThrow = (md) => {
    try {
      validateOpenItemEffectMatrix(md);
      return false;
    } catch (e) {
      return e.message.includes('Governance guard failed');
    }
  };

  H('19a', expectThrow(validBaseTable.replace('\`VIRTUALIZATION_SUBSTRATE_SELECTION\`', '\`WRONG_TITLE\`')), 'Matrix probe: swapped title must fail');
  H('19b', expectThrow(validBaseTable.replace('| OPEN-2 |', '| OPEN-1 |')), 'Matrix probe: duplicate ID must fail');
  H('19c', expectThrow(validBaseTable.replace('OPEN, UNAFFECTED', 'RESOLVED')), 'Matrix probe: unauthorized effect must fail');
  H('19d', expectThrow(validBaseTable.replace('| OPEN-3 |', '| OPEN-3 | EXTRA |')), 'Matrix probe: extra column must fail');
  H('19e', expectThrow(validBaseTable.replace('| OPEN-11 | \`PRODUCT_CORE_MODULE_VS_IMPLEMENTATION_ADAPTER_BOUNDARY\` | OPEN | OPEN, PARTIALLY_UNBLOCKED / PER_MODULE_CLASSIFICATION_REMAINS_OPEN |\n', '')), 'Matrix probe: row count mismatch must fail');

  const proposalPath = join(CONTRACTS, 'platform/CYBRIK-PLATFORM-CONTRACT-V1-PROPOSAL.md');
  const proposalContent = readFileSync(proposalPath, 'utf8');
  validateOpenItemEffectMatrix(proposalContent);
} catch (e) {
  fail(e.message);
}

// 20. Governance guard: OPEN-11 Product Module Sovereignty Classification Map & Ledger
try {
  const mapPath = join(ROOT, 'docs/architecture/PRODUCT-MODULE-SOVEREIGNTY-CLASSIFICATION-MAP.md');
  const ledgerPath = join(ROOT, 'docs/architecture/PRODUCT-MODULE-CLASSIFICATION-LEDGER.json');
  if (!existsSync(mapPath) || !existsSync(ledgerPath)) {
    throw new Error('OPEN-11 map or ledger artifact missing');
  }

  const mapContent = readFileSync(mapPath, 'utf8');
  const ledgerRaw = readFileSync(ledgerPath, 'utf8');
  const ledgerDigest = createHash('sha256').update(ledgerRaw).digest('hex');
  if (ledgerDigest !== 'b428c73895baad718c166bf90f9f8a676fb688c21eb012bf280ce1dad4231831') {
    throw new Error(`Ledger digest mismatch: ${ledgerDigest}`);
  }

  const ledger = JSON.parse(ledgerRaw);
  const repoKeys = Object.keys(ledger).sort();
  if (repoKeys.length !== 3 || repoKeys[0] !== 'cybrik-cyber-ai-platform' || repoKeys[1] !== 'cybrik-security-tool-fabric' || repoKeys[2] !== 'cybrik-soc-command-center') {
    throw new Error('Exact 3 closed top-level repositories expected');
  }

  const validClassifications = new Set([
    'PRODUCT_CORE',
    'PRODUCT_IMPLEMENTATION_ADAPTER',
    'PROVIDER_ADAPTER',
    'SUPPORTING_TOOLING_OR_TEST',
    'DEPLOYMENT_PROFILE_OR_CONFIG',
    'GOVERNANCE_OR_DOCUMENTATION',
  ]);
  const validStatuses = new Set(['IMPLEMENTED', 'SCAFFOLD', 'PLANNED']);

  const lines = mapContent.split('\n');
  const sections = { '2.1': 0, '2.2': 0, '2.3': 0, '2.4': 0 };
  let currentSec = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('### 2.1')) currentSec = '2.1';
    else if (line.startsWith('### 2.2')) currentSec = '2.2';
    else if (line.startsWith('### 2.3')) currentSec = '2.3';
    else if (line.startsWith('### 2.4')) currentSec = '2.4';
    else if (line.startsWith('## 3.')) currentSec = null;

    if (!currentSec || !line.startsWith('|') || line.startsWith('|---') || line.includes('Path / Subsystem')) continue;

    if (!line.endsWith('|')) throw new Error(`Line ${i + 1} must end with |`);
    const parts = line.split('|').map(s => s.trim());
    if (parts[0] !== '' || parts[parts.length - 1] !== '' || parts.length !== 6) {
      throw new Error(`OPEN-11 map line ${i + 1} must have exactly 4 columns`);
    }
    const [, rawPath, rawClass, rawStatus, notes] = parts;
    const classification = rawClass.replace(/^`|`$/g, '');
    const status = rawStatus.replace(/^`|`$/g, '');
    if (!rawPath || rawPath.trim().length === 0) throw new Error(`OPEN-11 map line ${i + 1} empty path`);
    if (!validClassifications.has(classification)) throw new Error(`Invalid classification: ${classification}`);
    if (!validStatuses.has(status)) throw new Error(`Invalid status: ${status}`);
    if (!notes || notes.trim().length === 0) throw new Error(`OPEN-11 map line ${i + 1} empty notes`);
    sections[currentSec]++;
  }

  if (sections['2.1'] !== 28 || sections['2.2'] !== 14 || sections['2.3'] !== 73 || sections['2.4'] !== 2) {
    throw new Error(`Section row counts mismatch: ${JSON.stringify(sections)}`);
  }

  if (ledger['cybrik-cyber-ai-platform']?.commit !== 'f0bf4c630d8e93a0531d16b4522ce0425996a624' ||
      ledger['cybrik-security-tool-fabric']?.commit !== '1a419014ebb432eb56ac35242e0a193fe65a62c6' ||
      ledger['cybrik-soc-command-center']?.commit !== '695aed8e0e12c9d0e11de5f474e3384d1a4b490f') {
    throw new Error('Ledger commit SHA bindings mismatch pinned RC1 commits');
  }

  const aiFiles = Object.keys(ledger['cybrik-cyber-ai-platform']?.files || {});
  const fabricFiles = Object.keys(ledger['cybrik-security-tool-fabric']?.files || {});
  const socFiles = Object.keys(ledger['cybrik-soc-command-center']?.files || {});

  if (aiFiles.length !== 221 || fabricFiles.length !== 132 || socFiles.length !== 1297) {
    throw new Error(`Ledger counts mismatch: AI=${aiFiles.length}, Fabric=${fabricFiles.length}, SOC=${socFiles.length}`);
  }
  if (aiFiles.length + fabricFiles.length + socFiles.length !== 1650) {
    throw new Error('Total ledger file count mismatch: expected 1650');
  }

  // Semantic sentinel checks
  if (ledger['cybrik-soc-command-center'].files['START-CYBRIK.command']?.classification !== 'DEPLOYMENT_PROFILE_OR_CONFIG' ||
      ledger['cybrik-soc-command-center'].files['Makefile']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-soc-command-center'].files['services/api/.coverage']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-soc-command-center'].files['services/api/dump.rdb']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-soc-command-center'].files['.gitleaks.toml']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-soc-command-center'].files['.gitleaksignore']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-soc-command-center'].files['apps/soc-portal/playwright.config.ts']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-soc-command-center'].files['apps/soc-portal/app/layout.tsx']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/database.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/errors.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['packages/api-contracts/openapi/generic-webhook.v0.yaml']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['packages/design-system/tokens/tokens.css']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['ops/backup/cybrik_backup/backup.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['ops/backup/cybrik_backup/__main__.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/content/sigma/collection_archive_staging.yml']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/context/wire.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/alert/context/models.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/datalake/lifecycle.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/forensics/search.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/copilot/gateway.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ingest/ecs.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ingest/ocsf.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/algorithms.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/signer.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/models.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/platform/svc_delegation/errors.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/soar/connectors/__init__.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/soar/library.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ioc/taxii.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      !ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/ioc/taxii.py']?.notes?.includes('TaxiiClient') ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/hunt/executions.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/service.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/common.py']?.classification !== 'PRODUCT_CORE' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/greenbone.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/src/cybrik_soc/modules/vulnerability/parsers/__init__.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-soc-command-center'].files['services/api/pyproject.toml']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/orchestration/checkpoints.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-cyber-ai-platform'].files['packages/ai-core/src/cybrik_ai_core/orchestration/memory.py']?.classification !== 'SUPPORTING_TOOLING_OR_TEST' ||
      ledger['cybrik-cyber-ai-platform'].files['tests/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-cyber-ai-platform'].files['services/ai-api/src/cybrik_ai_api/transport_security.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-cyber-ai-platform'].files['services/ai-worker/src/cybrik_ai_worker/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-cyber-ai-platform'].files['services/ai-worker/src/cybrik_ai_worker/__init__.py']?.status !== 'SCAFFOLD' ||
      ledger['cybrik-cyber-ai-platform'].files['services/ai-worker/pyproject.toml']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/executor/cmd/executor/main.go']?.status !== 'SCAFFOLD' ||
      ledger['cybrik-security-tool-fabric'].files['tests/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['tests/conformance/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['tests/control-plane/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['tests/executor/README.md']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/contracts/__init__.py']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/invocation/ports.py']?.classification !== 'PRODUCT_IMPLEMENTATION_ADAPTER' ||
      ledger['cybrik-security-tool-fabric'].files['src/control-plane/cybrik_fabric_control/py.typed']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/executor/internal/version/version.go']?.classification !== 'GOVERNANCE_OR_DOCUMENTATION' ||
      ledger['cybrik-security-tool-fabric'].files['src/executor/internal/tier/tier.go']?.classification !== 'PRODUCT_CORE') {
    throw new Error('Ledger semantic sentinel checks failed');
  }

  // Regression probes for Round 22 & Round 23 paths in map selectors
  if (!mapContent.includes('tests/ (excluding README.md), .github/') ||
      !mapContent.includes('tests/ (excluding **/README.md), contracts-vendor/fixtures/') ||
      !mapContent.includes('contracts-vendor/README.md') ||
      !mapContent.includes('contracts-vendor/contracts.lock.json') ||
      !mapContent.includes('contracts-vendor/compatibility/*.manifest.json') ||
      !mapContent.includes('src/control-plane/Dockerfile') ||
      !mapContent.includes('docker/.env.example') ||
      !mapContent.includes('__main__.py') ||
      !mapContent.includes('services/api/pyproject.toml') ||
      !mapContent.includes('TaxiiClient')) {
    throw new Error('Map selector regression probes failed');
  }

  for (const [repo, data] of Object.entries(ledger)) {
    for (const [filePath, entry] of Object.entries(data.files)) {
      if (!filePath || filePath.trim().length === 0) throw new Error(`${repo} empty file path`);
      if (!validClassifications.has(entry.classification)) throw new Error(`${repo}:${filePath} invalid classification ${entry.classification}`);
      if (!validStatuses.has(entry.status)) throw new Error(`${repo}:${filePath} invalid status ${entry.status}`);
      if (!entry.notes || entry.notes.trim().length === 0) throw new Error(`${repo}:${filePath} empty notes`);
    }
  }

  // Exact-once selector-to-ledger reconciliation proving 0 orphans, 0 overlaps, matching classification & status
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
    const files = Object.keys(ledger[repo].files);
    const matchers = rows.map(r => ({ ...r, fn: createMatcher(r.selector, repo) }));

    for (const filePath of files) {
      const ledgerEntry = ledger[repo].files[filePath];
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

  console.log(`PASS: OPEN-11 Product Module Sovereignty Classification Map (${lines.length} lines, 117 rows: 28/14/73/2) and 1,650-file Ledger (SHA-256: ${ledgerDigest}) integrity, exhaustive selector closure, and semantic sentinels verified.`);

  H('20', true, 'OPEN-11 classification map and 1,650-file ledger pass pinned integrity, exhaustive selector closure, and semantic sentinel validation');
} catch (e) {
  fail(e.message);
}

console.log('=== JSON Schema / packet / invariants validation ===');
console.log('counts:', JSON.stringify(counts));
if (notes.length) for (const n of notes) console.log('note:', n);
if (errors.length) {
  console.error(`\nFAIL — ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('\nOK — all schema/packet/invariant checks passed.');
