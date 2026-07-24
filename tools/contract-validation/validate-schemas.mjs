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
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, sep } from 'node:path';
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

const errors = [];
const notes = [];
const counts = {};
const fail = (m) => errors.push(m);
const bump = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readYaml = (p) => parseYaml(readFileSync(p, 'utf8'));

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
  'cybrik.approval-decision.v1.schema.json',
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
for (const kw of ['x-cybrik-status', 'x-cybrik-not-accepted', 'x-cybrik-contract-version', 'x-cybrik-format-pins']) {
  ajv.addKeyword({ keyword: kw });
}

const schemas = {}; // basename -> { doc, path }
const idByBasename = {};
for (const name of SCHEMA_FILES) {
  const p = join(JSON_SCHEMA_DIR, name);
  if (!existsSync(p)) { fail(`missing schema file: json-schema/${name}`); continue; }
  let doc;
  try { doc = readJson(p); } catch (e) { fail(`json-schema/${name}: JSON parse error: ${e.message}`); continue; }
  schemas[name] = { doc, path: p };

  // 2. Standards metastructure per schema.
  if (doc.$schema !== DRAFT_2020) fail(`json-schema/${name}: $schema is not 2020-12 (${doc.$schema})`);
  if (typeof doc.$id !== 'string' || !doc.$id.startsWith(ID_PREFIX)) fail(`json-schema/${name}: $id missing/wrong prefix (${doc.$id})`);
  else idByBasename[name] = doc.$id;
  if (doc['x-cybrik-status'] !== 'PROPOSED') fail(`json-schema/${name}: x-cybrik-status must be PROPOSED (${doc['x-cybrik-status']})`);
  if (doc['x-cybrik-not-accepted'] !== true) fail(`json-schema/${name}: x-cybrik-not-accepted must be true`);
  if (doc['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`json-schema/${name}: contract-version must be ${EXPECTED_VERSION}`);
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
  if (exManifest['x-cybrik-status'] !== 'PROPOSED') fail('examples-manifest: status must be PROPOSED');
  if (exManifest['x-cybrik-not-accepted'] !== true) fail('examples-manifest: not-accepted must be true');
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
      if (ok) bump('positive_pass');
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
// 5. Compatibility / version / status manifest.
// ---------------------------------------------------------------------------
const compatPath = join(CONTRACTS, 'compatibility', 'cybrik-suite-contract-packet.v1.manifest.json');
let compat;
try { compat = readJson(compatPath); } catch (e) { fail(`compatibility manifest: parse error: ${e.message}`); }
if (compat) {
  if (compat['x-cybrik-status'] !== 'PROPOSED') fail('compatibility manifest: status must be PROPOSED');
  if (compat['x-cybrik-not-accepted'] !== true) fail('compatibility manifest: not-accepted must be true');
  if (compat['x-cybrik-packet-version'] !== EXPECTED_VERSION) fail(`compatibility manifest: packet-version must be ${EXPECTED_VERSION}`);
  if (compat['x-cybrik-is-bundle-tag'] !== false) fail('compatibility manifest: is-bundle-tag must be false (PROPOSED, never a bundle tag)');
  if (!/NOT ACCEPTED/.test(compat.acceptance?.status || '')) fail('compatibility manifest: acceptance.status must state NOT ACCEPTED');
  const pins = compat.format_pins || {};
  if (pins.jsonSchema !== '2020-12') fail('compatibility manifest: jsonSchema pin must be 2020-12');
  if (pins.openApi !== '3.1.x') fail('compatibility manifest: openApi pin must be 3.1.x');
  if (pins.asyncApi !== '3.0.0') fail('compatibility manifest: asyncApi pin must be 3.0.0');
  for (const m of compat.members || []) {
    const mp = join(CONTRACTS, m.file);
    if (!existsSync(mp)) fail(`compatibility manifest: member file missing: ${m.file}`);
    if (m.contract_version !== EXPECTED_VERSION) fail(`compatibility manifest: member ${m.file} contract_version must be ${EXPECTED_VERSION}`);
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

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('=== JSON Schema / packet / invariants validation ===');
console.log('counts:', JSON.stringify(counts));
if (notes.length) for (const n of notes) console.log('note:', n);
if (errors.length) {
  console.error(`\nFAIL — ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('\nOK — all schema/packet/invariant checks passed.');
