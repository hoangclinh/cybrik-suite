// validate-inference.mjs — W2-D AI model-inference + alert-summarization packet validator.
//
// Scope: the W2-D inference packet ONLY (its whole-packet lifecycle flips between PROPOSED and
// ACCEPTED FOR IMPLEMENTATION at v0.1.0, per the compatibility manifest as the single source of
// truth). It is ADDITIVE to, and
// DISJOINT from, the accepted v0.1 cross-product packet (validated by validate-schemas.mjs,
// which this file does NOT touch). Here we:
//   (1) load the accepted base primitives (common-defs, data-marking) UNMODIFIED so the
//       inference schemas' cross-file $refs resolve, then compile every inference schema —
//       a dangling $ref/$defs fragment throws at compile time;
//   (2) drive the positive / negative-schema / negative-semantic fixtures from the inference
//       examples-manifest (positive MUST validate; negative-schema MUST fail; negative-semantic
//       MUST be structurally valid — only a runtime trust invariant rejects it);
//   (3) assert the inference trust invariants (TI-1..TI-8 structural, TR-1/TR-2/grounding
//       runtime) as brittle-on-purpose checks so a regression that relaxes any of them fails
//       here — cross-tenant, marking non-downgrade, fail-closed redaction, no tool/vendor pin,
//       refusal-reason, grounded citations, capability limits;
//   (4) assert manifest / examples-manifest / wire-doc lifecycle + integrity consistency:
//       every member agrees with the manifest's single lifecycle state (a half-flipped packet —
//       some members PROPOSED, some ACCEPTED — fails), the accepted base is reused unmodified,
//       and the packet is never a bundle tag / GA.
//
// Zero external side effects. Exit 0 = all checks passed; exit 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, sep } from 'node:path';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..'); // tools/contract-validation -> repo root
const CONTRACTS = join(ROOT, 'contracts');
const JSON_SCHEMA_DIR = join(CONTRACTS, 'json-schema');
const CONTRACTS_ROOT = resolve(CONTRACTS);

const DRAFT_2020 = 'https://json-schema.org/draft/2020-12/schema';
const ID_PREFIX = 'https://contracts.cybrik.example/';
const EXPECTED_VERSION = '0.1.0';
// Per-file SemVer (ADR-0001 D1). Every member of this packet is new at 0.1.0 EXCEPT the inference
// OpenAPI successor revision absorbed at Gate W2-I, which is a 0.2.0 revision of the 0.1.0 document
// it supersedes. The map is pinned here, not read from the manifest, so a member cannot silently
// re-declare its own expected version — the packet version itself stays 0.1.0 either way.
const SUCCESSOR_OPENAPI = 'openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml';
const SUCCESSOR_VERSION = '0.2.0';
const expectedMemberVersion = (file) => (file === SUCCESSOR_OPENAPI ? SUCCESSOR_VERSION : EXPECTED_VERSION);
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

const errors = [];
const counts = {};
const fail = (m) => errors.push(m);
const bump = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readYaml = (p) => parseYaml(readFileSync(p, 'utf8'));

// ---------------------------------------------------------------------------
// 0. Lifecycle state. Exactly TWO truthful whole-packet states are permitted at
//    v0.1.0, and the compatibility manifest is the single source of truth:
//      PROPOSED (not-accepted) | ACCEPTED FOR IMPLEMENTATION (accepted).
//    Neither state is a stable v1/GA and neither may be an immutable bundle tag
//    (packet stays v0.1.0, is-bundle-tag=false). Every packet member MUST agree
//    with the manifest: a half-flipped packet (some files ACCEPTED, some PROPOSED,
//    or a member whose status/not-accepted pair is internally inconsistent) is a
//    consistency failure — which is exactly what checkLifecycle exists to catch.
//    Acceptance is a Founder gate (W2-D) recorded in the manifest with evidence; a
//    green run here is a conformance signal only, NEVER acceptance by itself.
// ---------------------------------------------------------------------------
const LIFECYCLE = {
  'PROPOSED': { status: 'PROPOSED', notAccepted: true },
  'ACCEPTED FOR IMPLEMENTATION': { status: 'ACCEPTED FOR IMPLEMENTATION', notAccepted: false },
};
const COMPAT_PATH = join(CONTRACTS, 'compatibility', 'cybrik-suite-inference-packet.v1.manifest.json');
let compat = null;
try { compat = readJson(COMPAT_PATH); } catch (e) { fail(`inference compatibility manifest: cannot read: ${e.message}`); }
let EXPECTED_STATE = null;
if (compat) {
  const s = compat['x-cybrik-status'];
  if (LIFECYCLE[s]) EXPECTED_STATE = s;
  else fail(`inference compatibility manifest: x-cybrik-status must be one of ${Object.keys(LIFECYCLE).map((k) => `'${k}'`).join(' | ')} at v${EXPECTED_VERSION} (got '${s}'); no stable/GA or half-flipped status is permitted`);
}
const LC = EXPECTED_STATE ? LIFECYCLE[EXPECTED_STATE] : null;
const checkLifecycle = (label, obj) => {
  if (!LC || !obj) return;
  if (obj['x-cybrik-status'] !== LC.status) fail(`${label}: x-cybrik-status must be '${LC.status}' to match the manifest lifecycle (got '${obj['x-cybrik-status']}')`);
  if (obj['x-cybrik-not-accepted'] !== LC.notAccepted) fail(`${label}: x-cybrik-not-accepted must be ${LC.notAccepted} to match the manifest lifecycle`);
};

// ---------------------------------------------------------------------------
// 1. Load schemas. Accepted base primitives are added UNMODIFIED (no lifecycle
//    flip, no re-version) purely so cross-file $refs resolve; the inference
//    schemas are the ones this packet owns and this validator gates.
// ---------------------------------------------------------------------------
const BASE_PRIMITIVES = [
  'cybrik.common-defs.v1.schema.json',
  'cybrik.data-marking.v1.schema.json',
];
// Every inference schema this packet introduces. model-common-defs is shared primitives
// (no direct fixture); the other seven are fixture-bearing payload schemas.
const INFERENCE_SCHEMAS = [
  'cybrik.model-common-defs.v1.schema.json',
  'cybrik.model-inference-request.v1.schema.json',
  'cybrik.model-inference-result.v1.schema.json',
  'cybrik.model-inference-error.v1.schema.json',
  'cybrik.model-capability.v1.schema.json',
  'cybrik.model-health.v1.schema.json',
  'cybrik.alert-summarization-request.v1.schema.json',
  'cybrik.alert-summarization-result.v1.schema.json',
];

const ajv = new Ajv2020({ strict: true, strictTypes: false, strictRequired: false, allErrors: true, allowUnionTypes: true });
addFormats(ajv);
for (const kw of ['x-cybrik-status', 'x-cybrik-not-accepted', 'x-cybrik-contract-version', 'x-cybrik-format-pins']) {
  ajv.addKeyword({ keyword: kw });
}

const schemas = {}; // basename -> { doc, path, base }
const loadSchema = (name, { base }) => {
  const p = join(JSON_SCHEMA_DIR, name);
  if (!existsSync(p)) { fail(`missing schema file: json-schema/${name}`); return; }
  let doc;
  try { doc = readJson(p); } catch (e) { fail(`json-schema/${name}: JSON parse error: ${e.message}`); return; }
  schemas[name] = { doc, path: p, base };
  if (doc.$schema !== DRAFT_2020) fail(`json-schema/${name}: $schema is not 2020-12 (${doc.$schema})`);
  if (typeof doc.$id !== 'string' || !doc.$id.startsWith(ID_PREFIX)) fail(`json-schema/${name}: $id missing/wrong prefix (${doc.$id})`);
  if (base) {
    // Accepted base primitive: MUST remain ACCEPTED FOR IMPLEMENTATION and unmodified by this
    // packet (backward-compat guard — the inference packet may never flip a base member).
    if (doc['x-cybrik-status'] !== 'ACCEPTED FOR IMPLEMENTATION') fail(`base primitive json-schema/${name}: must stay ACCEPTED FOR IMPLEMENTATION (inference packet must not modify it)`);
    if (doc['x-cybrik-not-accepted'] !== false) fail(`base primitive json-schema/${name}: x-cybrik-not-accepted must stay false`);
  } else {
    checkLifecycle(`json-schema/${name}`, doc);
    if (doc['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`json-schema/${name}: contract-version must be ${EXPECTED_VERSION}`);
    bump('inference_schemas_loaded');
  }
};
for (const n of BASE_PRIMITIVES) loadSchema(n, { base: true });
for (const n of INFERENCE_SCHEMAS) loadSchema(n, { base: false });

// Register all before compiling so cross-file $refs resolve against $id.
for (const [name, { doc }] of Object.entries(schemas)) {
  try { ajv.addSchema(doc); } catch (e) { fail(`json-schema/${name}: addSchema failed: ${e.message}`); }
}

// Compile each inference schema — this resolves every local + cross-file $ref/$defs fragment
// (including refs into the accepted base primitives). A dangling ref throws here.
const validators = {}; // basename -> validate fn
for (const name of INFERENCE_SCHEMAS) {
  const doc = schemas[name]?.doc;
  if (!doc?.$id) continue;
  try {
    validators[name] = ajv.getSchema(doc.$id) || ajv.compile(doc);
    bump('inference_schemas_compiled');
  } catch (e) {
    fail(`json-schema/${name}: compile/ref-resolution failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Example fixtures, driven by examples/inference/examples-manifest.json.
//    positive -> MUST validate; negative-schema -> MUST fail; negative-semantic -> MUST validate.
// ---------------------------------------------------------------------------
const EXAMPLES_DIR = join(CONTRACTS, 'examples', 'inference');
const exManifestPath = join(EXAMPLES_DIR, 'examples-manifest.json');
let exManifest;
try { exManifest = readJson(exManifestPath); } catch (e) { fail(`inference examples-manifest.json: parse error: ${e.message}`); }

const fixtures = {}; // file -> parsed data (for cross-fixture semantic assertions)
if (exManifest) {
  checkLifecycle('inference examples-manifest', exManifest);
  if (exManifest['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`inference examples-manifest: x-cybrik-contract-version must be ${EXPECTED_VERSION}`);
  for (const ex of exManifest.examples || []) {
    const exPath = join(EXAMPLES_DIR, ex.file);
    if (!existsSync(exPath)) { fail(`example missing on disk: examples/inference/${ex.file}`); continue; }
    const validate = validators[ex.schema];
    if (!validate) { fail(`example ${ex.file}: no compiled validator for schema ${ex.schema}`); continue; }
    let data;
    try { data = readJson(exPath); } catch (e) { fail(`example ${ex.file}: JSON parse error: ${e.message}`); continue; }
    fixtures[ex.file] = data;
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
// 3. Compatibility / version / status manifest for the inference packet.
// ---------------------------------------------------------------------------
if (compat) {
  checkLifecycle('inference compatibility manifest', compat);
  if (compat['x-cybrik-packet-version'] !== EXPECTED_VERSION) fail(`inference manifest: packet-version must be ${EXPECTED_VERSION}`);
  if (compat['x-cybrik-is-bundle-tag'] !== false) fail('inference manifest: is-bundle-tag must be false (v0.1.0 is never an immutable bundle tag / GA)');
  const pins = compat.format_pins || {};
  if (pins.jsonSchema !== '2020-12') fail('inference manifest: jsonSchema pin must be 2020-12');
  if (pins.openApi !== '3.1.x') fail('inference manifest: openApi pin must be 3.1.x');
  if (pins.asyncApi !== '3.0.0') fail('inference manifest: asyncApi pin must be 3.0.0');
  const acc = compat.acceptance?.status || '';
  const gateStatus = compat.gate?.status || '';
  if (compat.gate?.id !== 'W2-D') fail("inference manifest: gate.id must be 'W2-D'");
  if (EXPECTED_STATE === 'PROPOSED') {
    if (!/NOT ACCEPTED/.test(acc)) fail('inference manifest: acceptance.status must state NOT ACCEPTED while PROPOSED');
    // Gate W2-D must not be silently marked accepted/opened-into-acceptance.
    if (!/NOT OPENED|awaiting/i.test(gateStatus)) fail('inference manifest: gate.status must record that Gate W2-D is not yet decided (NOT OPENED — awaiting Founder decision)');
  } else {
    // ACCEPTED FOR IMPLEMENTATION: acceptance + gate must be affirmative, Founder-gated, and evidenced.
    if (!/ACCEPTED FOR IMPLEMENTATION/.test(acc)) fail('inference manifest: acceptance.status must state ACCEPTED FOR IMPLEMENTATION');
    if (/\bNOT ACCEPTED\b/.test(acc)) fail('inference manifest: acceptance.status must not still say NOT ACCEPTED once accepted');
    const a = compat.acceptance || {};
    if (!a.gate) fail('inference manifest: accepted packet must record acceptance.gate');
    if (!a.decided_by) fail('inference manifest: accepted packet must record acceptance.decided_by (Founder-delegated; not agent-inferred)');
    if (!a.decided_on) fail('inference manifest: accepted packet must record acceptance.decided_on');
    if (!Array.isArray(a.evidence) || a.evidence.length === 0) fail('inference manifest: accepted packet must record acceptance.evidence[]');
    if (/NOT OPENED|awaiting/i.test(gateStatus)) fail('inference manifest: gate.status must record the Gate W2-D decision once accepted (must not still say NOT OPENED / awaiting)');
  }
  // Disjointness from the accepted tool-execution packet is a load-bearing security stance.
  const oos = (compat.adr_out_of_scope || []).map((x) => x.id);
  if (!oos.includes('ADR-0004')) fail('inference manifest: ADR-0004 (tool execution authority) MUST be declared out of scope (inference/tool seams are disjoint)');
  if (compat.backward_compatibility?.modifies_accepted_v0_1 !== false) fail('inference manifest: backward_compatibility.modifies_accepted_v0_1 must be false');
  // Every reused accepted primitive must exist on disk and NOT be a member of this packet.
  const memberFiles = new Set((compat.members || []).map((m) => m.file));
  for (const rf of compat.reuses_accepted_unmodified?.members || []) {
    if (!existsSync(join(CONTRACTS, rf))) fail(`inference manifest: reused accepted member missing on disk: ${rf}`);
    if (memberFiles.has(rf)) fail(`inference manifest: reused accepted member ${rf} must NOT also be declared a packet member (it is reused unmodified, not owned)`);
    bump('reused_accepted_members');
  }
  // Every declared member exists on disk at its expected per-file version, and any member that
  // declares a digest must match its bytes. Only the members absorbed at Gate W2-I carry digests
  // today; repairing the older rows is a separate recorded gate, so an absent digest is not an error
  // here — a WRONG one is.
  for (const m of compat.members || []) {
    const mp = join(CONTRACTS, m.file);
    if (!existsSync(mp)) { fail(`inference manifest: member file missing: ${m.file}`); continue; }
    const wantVersion = expectedMemberVersion(m.file);
    if (m.contract_version !== wantVersion) fail(`inference manifest: member ${m.file} contract_version must be ${wantVersion} (per-file SemVer, ADR-0001 D1)`);
    if (m.sha256 !== undefined) {
      if (typeof m.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(m.sha256)) {
        fail(`inference manifest: member ${m.file} declares a sha256 that is not a 64-hex digest`);
      } else if (sha256File(mp) !== m.sha256) {
        fail(`inference manifest: member ${m.file} SHA-256 mismatch — manifest ${m.sha256}, on disk ${sha256File(mp)} (recompute after any edit)`);
      } else {
        bump('member_sha_verified');
      }
    }
    // A superseded member is relabelled, never rewritten: it must still be on disk (checked above)
    // and must name what superseded it, so the deprecation window has a documented other end.
    if (m.lifecycle === 'SUPERSEDED-SUPPORTED') {
      if (!m.superseded_by) fail(`inference manifest: superseded member ${m.file} must record superseded_by`);
      else if (!(compat.members || []).some((x) => x.file === m.superseded_by)) fail(`inference manifest: superseded member ${m.file} names superseded_by '${m.superseded_by}', which is not a member of this packet`);
      if (m.byte_frozen !== true) fail(`inference manifest: superseded member ${m.file} must record byte_frozen:true (supersession relabels a row; it never rewrites the superseded document)`);
      bump('superseded_members');
    }
    bump('manifest_members');
  }
  // Trust-invariant catalog must be present (structural + runtime) so the stance is documented.
  if (!Array.isArray(compat.trust_invariants?.structural) || compat.trust_invariants.structural.length === 0) fail('inference manifest: trust_invariants.structural missing/empty');
  if (!Array.isArray(compat.trust_invariants?.runtime_only) || compat.trust_invariants.runtime_only.length === 0) fail('inference manifest: trust_invariants.runtime_only missing/empty');
}

// ---------------------------------------------------------------------------
// 4. Wire-spec external $ref integrity + lifecycle for the inference deltas.
//    (OpenAPI 3.1.x and AsyncAPI 3.0.0 standards conformance is asserted by
//    validate-openapi.mjs / validate-asyncapi.mjs; here we resolve their external
//    $refs into the packet and check the lifecycle markers.)
// ---------------------------------------------------------------------------
const openapiPath = join(CONTRACTS, 'openapi', 'cybrik-ai-inference-plane.v1.openapi.yaml');
const asyncapiPath = join(CONTRACTS, 'asyncapi', 'cybrik-ai-inference-events.v1.asyncapi.yaml');
let openapi, asyncapi;
try { openapi = readYaml(openapiPath); } catch (e) { fail(`inference openapi YAML parse error: ${e.message}`); }
try { asyncapi = readYaml(asyncapiPath); } catch (e) { fail(`inference asyncapi YAML parse error: ${e.message}`); }
if (openapi?.info) checkLifecycle('inference openapi info', openapi.info);
if (asyncapi?.info) checkLifecycle('inference asyncapi info', asyncapi.info);

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
  for (const ref of collectRefs(docObj, [])) {
    bump('wire_refs_total');
    if (ref.startsWith('#')) continue; // internal, resolved by the spec validators
    const [filePart, frag] = ref.split('#');
    const target = resolve(docDir, filePart);
    // Containment: a $ref must stay inside contracts/. A contributor-editable YAML must never
    // cause a read outside the packet (an escaping $ref is a validation failure, not a read).
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
if (openapi) checkFileRefs('inference openapi', openapi, join(CONTRACTS, 'openapi'));
if (asyncapi) checkFileRefs('inference asyncapi', asyncapi, join(CONTRACTS, 'asyncapi'));

// AsyncAPI: every inference message payload MUST bind a typed `data` on top of the accepted
// envelope (fail-closed: an event without a typed data payload is rejected). Mirrors the base
// packet's hardening #9 for the disjoint inference event namespace.
const aMsgs = asyncapi?.components?.messages || {};
const dataBound = (m) => Array.isArray(m?.payload?.allOf) && m.payload.allOf.some((e) => Array.isArray(e.required) && e.required.includes('data'));
for (const key of ['inferenceRequested', 'inferenceCompleted', 'inferenceFailed', 'summarizationRequested', 'summarizationCompleted']) {
  bump('asyncapi_messages_checked');
  if (dataBound(aMsgs[key])) bump('asyncapi_messages_data_bound');
  else fail(`inference asyncapi message ${key} must bind a typed data payload (allOf requiring data)`);
}

// ---------------------------------------------------------------------------
// 5. Trust invariants as brittle-on-purpose assertions. A regression that relaxes
//    any of these fails CI here. Structural ones are also EXERCISED by fixtures.
// ---------------------------------------------------------------------------
const doc = (n) => schemas[n]?.doc;
const req = (o) => (o && Array.isArray(o.required)) ? o.required : [];
const props = (o) => (o && o.properties) ? o.properties : {};
const hasTenantIdAllOf = (node) =>
  node && Array.isArray(node.allOf) && node.allOf.some((m) => Array.isArray(m.required) && m.required.includes('tenant_id'));
const H = (id, cond, msg) => { bump('invariants_checked'); if (cond) bump('invariants_ok'); else fail(`INVARIANT#${id}: ${msg}`); };

const mcd = doc('cybrik.model-common-defs.v1.schema.json');
const reqSchema = doc('cybrik.model-inference-request.v1.schema.json');
const resSchema = doc('cybrik.model-inference-result.v1.schema.json');
const errSchema = doc('cybrik.model-inference-error.v1.schema.json');
const capSchema = doc('cybrik.model-capability.v1.schema.json');
const sumReqSchema = doc('cybrik.alert-summarization-request.v1.schema.json');
const sumResSchema = doc('cybrik.alert-summarization-result.v1.schema.json');

// TI-1 NO WIRE LOCK-IN / NO VENDOR PINNING. No vendor/provider/endpoint/model/api_key field
// exists on any request; additionalProperties:false makes pinning structurally impossible;
// the model is named only by the policy-selected model_class token.
const VENDOR_PIN_FIELDS = ['model', 'provider', 'endpoint', 'api_key', 'base_url', 'vendor'];
const noVendorPin = (schema) => schema?.additionalProperties === false && !VENDOR_PIN_FIELDS.some((f) => f in props(schema));
H('TI-1a', noVendorPin(reqSchema), 'model-inference-request must be additionalProperties:false with no vendor/provider/endpoint/model field');
H('TI-1b', noVendorPin(sumReqSchema), 'alert-summarization-request must be additionalProperties:false with no vendor/provider/endpoint/model field');
H('TI-1c', mcd?.$defs?.modelClass?.pattern && !('provider' in (mcd?.$defs || {})), 'model-common-defs must define modelClass as a neutral token (no vendor def)');
// The vendor-pinned negative fixture must actually carry the forbidden fields it is meant to prove-reject.
const vpFix = fixtures['negative/model-inference-request.vendor-pinned.json'];
H('TI-1d', !!vpFix && VENDOR_PIN_FIELDS.some((f) => f in vpFix), 'vendor-pinned fixture must carry a vendor/provider/endpoint/model field so the additionalProperties:false rejection is exercised');

// TI-2 NO TOOL/AGENT/ACTION AUTHORITY. No capability/delegation/approval/tool/mcp field exists
// on any request; capability.tool_calling is const 'disabled'.
const AUTHORITY_FIELDS = ['tools', 'tool', 'capability', 'capabilities', 'delegation_ref', 'delegation_chain', 'approval_id', 'mcp', 'mcp_server'];
const noAuthority = (schema) => schema?.additionalProperties === false && !AUTHORITY_FIELDS.some((f) => f in props(schema));
H('TI-2a', noAuthority(reqSchema), 'model-inference-request must carry NO tool/capability/delegation/approval/mcp field');
H('TI-2b', noAuthority(sumReqSchema), 'alert-summarization-request must carry NO tool/capability/delegation/approval/mcp field');
H('TI-2c', capSchema?.properties?.tool_calling?.const === 'disabled' && req(capSchema).includes('tool_calling'), "model-capability.tool_calling must be required const 'disabled'");
const taFix = fixtures['negative/model-inference-request.tool-authority.json'];
H('TI-2d', !!taFix && AUTHORITY_FIELDS.some((f) => f in taFix), 'tool-authority fixture must carry a tool/capability/delegation/approval field so the rejection is exercised');
const tcFix = fixtures['negative/model-capability.tool-calling-enabled.json'];
H('TI-2e', tcFix?.tool_calling === 'enabled', "tool-calling-enabled fixture must set tool_calling='enabled' so the const 'disabled' rejection is exercised");

// TI-3 FAIL-CLOSED REDACTION. redaction_policy required; on_unresolved const 'deny'.
H('TI-3a', mcd?.$defs?.redactionPolicy?.properties?.on_unresolved?.const === 'deny', "redactionPolicy.on_unresolved must be const 'deny'");
H('TI-3b', req(reqSchema).includes('redaction_policy') && req(sumReqSchema).includes('redaction_policy'), 'redaction_policy must be required on every request');
const rpFix = fixtures['negative/model-inference-request.redaction-proceed.json'];
H('TI-3c', rpFix?.redaction_policy?.on_unresolved === 'proceed', "redaction-proceed fixture must request on_unresolved='proceed' so the const 'deny' rejection is exercised");

// TI-4 MANDATORY BOUNDS. tokenLimits requires all three ceilings; request requires limits +
// deadline; capability requires limits. A class with no limits is not registrable.
const tl = mcd?.$defs?.tokenLimits;
H('TI-4a', ['max_input_tokens', 'max_output_tokens', 'max_context_tokens'].every((k) => req(tl).includes(k)), 'tokenLimits must require max_input/output/context_tokens');
H('TI-4b', req(reqSchema).includes('limits') && req(reqSchema).includes('deadline_seconds'), 'model-inference-request must require limits and deadline_seconds');
H('TI-4c', req(capSchema).includes('limits'), 'model-capability must require limits');
const mlFix = fixtures['negative/model-capability.missing-limits.json'];
H('TI-4d', !!mlFix && !('limits' in mlFix), 'missing-limits fixture must omit limits so the required-limits rejection is exercised');

// TI-5 REPLAY CONTROL. idempotency_key minLength 16 on both request schemas + OpenAPI param.
H('TI-5a', reqSchema?.properties?.idempotency_key?.minLength === 16, 'model-inference-request idempotency_key.minLength must be 16');
H('TI-5b', sumReqSchema?.properties?.idempotency_key?.minLength === 16, 'alert-summarization-request idempotency_key.minLength must be 16');
H('TI-5c', openapi?.components?.parameters?.IdempotencyKey?.schema?.minLength === 16, 'OpenAPI IdempotencyKey param minLength must be 16');
const siFix = fixtures['negative/model-inference-request.short-idempotency-key.json'];
H('TI-5d', !!siFix && typeof siFix.idempotency_key === 'string' && siFix.idempotency_key.length < 16, 'short-idempotency-key fixture must carry a <16-char key so the minLength rejection is exercised');

// TI-6 CROSS-TENANT GUARD. actor.tenant_id required at the authorization site on both requests.
H('TI-6a', hasTenantIdAllOf(reqSchema?.properties?.actor), 'model-inference-request.actor must require tenant_id');
H('TI-6b', hasTenantIdAllOf(sumReqSchema?.properties?.actor), 'alert-summarization-request.actor must require tenant_id');

// TI-7 REFUSAL/FILTER SURFACED. result requires refusal_reason when refused, filter_reason when
// filtered (if/then allOf). A refusal can never be surfaced without its reason.
const thenRequires = (schema, outcomeConst, requiredKey) => Array.isArray(schema?.allOf) && schema.allOf.some((b) =>
  b?.if?.properties?.outcome?.const === outcomeConst && Array.isArray(b?.then?.required) && b.then.required.includes(requiredKey));
H('TI-7a', thenRequires(resSchema, 'refused', 'refusal_reason'), "model-inference-result must require refusal_reason when outcome='refused'");
H('TI-7b', thenRequires(resSchema, 'filtered', 'filter_reason'), "model-inference-result must require filter_reason when outcome='filtered'");
H('TI-7c', thenRequires(sumResSchema, 'refused', 'refusal_reason'), "alert-summarization-result must require refusal_reason when outcome='refused'");
const rmrFix = fixtures['negative/model-inference-result.refused-missing-reason.json'];
H('TI-7d', rmrFix?.outcome === 'refused' && !('refusal_reason' in (rmrFix || {})), "refused-missing-reason fixture must set outcome='refused' with no refusal_reason so the if/then rejection is exercised");

// TI-8 GROUNDED CONTEXT. alert_refs minItems 1 (an empty alert set is unsummarizable) and each
// ref is a digest-bound objectRef (dereferenced, never inlined).
H('TI-8a', sumReqSchema?.properties?.alert_refs?.minItems === 1, 'alert-summarization-request.alert_refs must have minItems 1');
const earFix = fixtures['negative/alert-summarization-request.empty-alert-refs.json'];
H('TI-8b', Array.isArray(earFix?.alert_refs) && earFix.alert_refs.length === 0, 'empty-alert-refs fixture must carry an empty alert_refs array so the minItems rejection is exercised');

// ---- Runtime invariants: negative-semantic fixtures are structurally valid but MUST be rejected
//      by a control-plane invariant a schema alone cannot express. Prove each fixture actually
//      VIOLATES its invariant (so the runtime rule is genuinely exercised), and that the
//      correlated positive fixture SATISFIES it (so the rule is not vacuous). ----

// TR-5 CROSS-TENANT: body tenant_id differs from the authoritative actor tenant.
const ctFix = fixtures['negative/model-inference-request.cross-tenant.json'];
H('TR-5a', !!ctFix && ctFix.tenant_id !== ctFix.actor?.tenant_id, 'cross-tenant fixture must set body tenant_id != actor.tenant_id (the mismatch the platform MUST reject)');
const posReq = fixtures['positive/model-inference-request.json'];
H('TR-5b', !!posReq && posReq.tenant_id === posReq.actor?.tenant_id, 'positive request fixture must have body tenant_id == actor.tenant_id (rule is not vacuous)');

// TR-1 MARKING NON-DOWNGRADE: the result marks the output strictly below the correlated request
//      marking on the classification/TLP lattice.
const CLASS_RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };
const TLP_RANK = { 'TLP:CLEAR': 0, 'TLP:GREEN': 1, 'TLP:AMBER': 2, 'TLP:AMBER+STRICT': 3, 'TLP:RED': 4 };
const markRank = (m) => (m ? { c: CLASS_RANK[m.classification], t: TLP_RANK[m.tlp] } : null);
const isDowngrade = (from, to) => { // to is BELOW from on at least one axis and never above on either
  const a = markRank(from), b = markRank(to);
  if (!a || !b || [a.c, a.t, b.c, b.t].some((x) => x === undefined)) return false;
  return (b.c < a.c || b.t < a.t) && b.c <= a.c && b.t <= a.t;
};
const mdFix = fixtures['negative/model-inference-result.marking-downgrade.json'];
// The downgrade result correlates (by request_id) to the positive request; its input marking is
// that request's data_marking.
H('TR-1a', !!mdFix && !!posReq && mdFix.request_id === posReq.request_id && isDowngrade(posReq.data_marking, mdFix.data_marking),
  'marking-downgrade fixture must mark its output strictly below the correlated request marking (the downgrade the platform MUST reject)');
const posRes = fixtures['positive/model-inference-result.completed.json'];
H('TR-1b', !!posRes && !!posReq && !isDowngrade(posReq.data_marking, posRes.data_marking),
  'positive completed result must NOT downgrade the request marking (rule is not vacuous)');
// Summarization non-downgrade: positive result marking must not be below its request marking.
const posSumReq = fixtures['positive/alert-summarization-request.json'];
const posSumRes = fixtures['positive/alert-summarization-result.json'];
H('TR-1c', !!posSumRes && !!posSumReq && !isDowngrade(posSumReq.data_marking, posSumRes.data_marking),
  'positive summarization result must NOT downgrade the summarized alerts marking');

// TR-2 FEATURE NEGOTIATION FAIL-CLOSED: a requested feature not advertised by any capability
//      descriptor MUST be denied. The fixture requests 'seeded', absent from the advertised set.
const ufFix = fixtures['negative/model-inference-request.unsupported-feature.json'];
const posCap = fixtures['positive/model-capability.json'];
const advertised = new Set(posCap?.supported_features || []);
H('TR-2a', !!ufFix && (ufFix.requested_features || []).some((f) => !advertised.has(f)),
  "unsupported-feature fixture must request a feature not in the advertised capability.supported_features (the denial the platform MUST issue)");
H('TR-2b', !!ufFix && (ufFix.requested_features || []).includes('seeded') && !advertised.has('seeded'),
  "unsupported-feature fixture must request 'seeded' while no capability advertises it (rule is exercised)");

// GROUNDING PROVENANCE: every citation digest MUST match a request alert_ref digest. The
//      ungrounded fixture cites a digest present in no request alert_ref; the positive result's
//      citations are all grounded.
const reqDigests = new Set((posSumReq?.alert_refs || []).map((r) => r.digest));
const ugFix = fixtures['negative/alert-summarization-result.ungrounded-citation.json'];
H('GRD-a', !!ugFix && (ugFix.citations || []).length > 0 && (ugFix.citations || []).every((c) => !reqDigests.has(c.digest)),
  'ungrounded-citation fixture must cite a digest matching no request alert_ref (the ungrounded claim the platform MUST reject)');
H('GRD-b', !!posSumRes && (posSumRes.citations || []).length > 0 && (posSumRes.citations || []).every((c) => reqDigests.has(c.digest)),
  'positive summarization result citations must all be grounded in a request alert_ref digest (rule is not vacuous)');

// CROSS-REF INTEGRITY (positive lifecycle correlation the platform MUST preserve).
H('XR-a', !!posRes && !!posReq && posRes.request_id === posReq.request_id, 'positive request/result must share request_id');
H('XR-b', !!posRes && !!posReq && posRes.correlation?.correlation_id === posReq.correlation?.correlation_id, 'positive request/result must share correlation_id');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('=== W2-D inference packet — JSON Schema / fixtures / trust-invariant validation ===');
console.log('counts:', JSON.stringify(counts));
if (errors.length) {
  console.error(`\nFAIL — ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`\nOK — inference packet passes JSON Schema 2020-12 compile/ref-resolution, all fixtures, and every trust invariant (lifecycle: ${EXPECTED_STATE || 'UNKNOWN'} at v${EXPECTED_VERSION}).`);
