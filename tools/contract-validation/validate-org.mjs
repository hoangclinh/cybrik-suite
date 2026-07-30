// validate-org.mjs — W2-G organizational-hierarchy + external-authority-boundary packet validator.
//
// Scope: the W2-G org-hierarchy packet ONLY (its whole-packet lifecycle is ACCEPTED FOR
// IMPLEMENTATION at v0.1.0, per the compatibility manifest as the single source of truth). It is
// ADDITIVE to, and DISJOINT from, the accepted v0.1 cross-product packet (validate-schemas.mjs),
// the ACCEPTED W2-D inference packet (validate-inference.mjs) and the ACCEPTED W2-F
// service-delegation packet (validate-svc.mjs); this file touches none of them. Here we:
//   (1) load the accepted base primitives (common-defs, data-marking) UNMODIFIED so the org
//       schemas' cross-file $refs resolve, then compile every org schema with the local schema
//       closure — a dangling $ref/$defs fragment throws at compile time;
//   (2) drive the positive / negative-schema / negative-semantic fixtures from the org
//       examples-manifest (positive MUST validate; negative-schema MUST fail JSON Schema; a
//       negative-semantic fixture MUST be structurally valid — only a relying-party invariant,
//       evaluated against a fixed test clock + a reference topology, rejects it);
//   (3) assert the org trust invariants — INV-1 (hierarchy != raw read) and INV-2 (external
//       authority is never super-admin) plus the D-1..D-8 contract-delta structural properties and
//       the FC-* fail-closed properties — as brittle-on-purpose checks, and PROVE each fixture
//       actually carries the shape it is meant to exercise (no vacuous pass);
//   (4) verify the compatibility manifest: single lifecycle state across every member, per-member
//       SHA-256 integrity + on-disk paths, accepted base reused unmodified, NO server/endpoint and
//       NO MCP/tool authority, backfill/sunset compatibility record present, never a bundle tag /
//       GA; and assert the mapping notes declare NO operational server/endpoint and carry the
//       UAT-trace placeholders.
//
// Zero external side effects. Exit 0 = all checks passed; exit 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

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
const counts = {};
const fail = (m) => errors.push(m);
const bump = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// ---------------------------------------------------------------------------
// 0. Lifecycle state. The compatibility manifest is the single source of truth. Exactly TWO
//    truthful whole-packet states are permitted at v0.1.0 (PROPOSED | ACCEPTED FOR
//    IMPLEMENTATION); neither is a stable v1/GA and neither is an immutable bundle tag. Every
//    packet member MUST agree with the manifest — a half-flipped packet is a consistency failure.
// ---------------------------------------------------------------------------
const LIFECYCLE = {
  'PROPOSED': { status: 'PROPOSED', notAccepted: true },
  'ACCEPTED FOR IMPLEMENTATION': { status: 'ACCEPTED FOR IMPLEMENTATION', notAccepted: false },
};
const COMPAT_PATH = join(CONTRACTS, 'compatibility', 'cybrik-suite-org-hierarchy-packet.v1.manifest.json');
let compat = null;
try { compat = readJson(COMPAT_PATH); } catch (e) { fail(`org compatibility manifest: cannot read: ${e.message}`); }
let EXPECTED_STATE = null;
if (compat) {
  const s = compat['x-cybrik-status'];
  if (LIFECYCLE[s]) EXPECTED_STATE = s;
  else fail(`org compatibility manifest: x-cybrik-status must be one of ${Object.keys(LIFECYCLE).map((k) => `'${k}'`).join(' | ')} at v${EXPECTED_VERSION} (got '${s}')`);
}
const LC = EXPECTED_STATE ? LIFECYCLE[EXPECTED_STATE] : null;
const checkLifecycle = (label, obj) => {
  if (!LC || !obj) return;
  if (obj['x-cybrik-status'] !== LC.status) fail(`${label}: x-cybrik-status must be '${LC.status}' to match the manifest lifecycle (got '${obj['x-cybrik-status']}')`);
  if (obj['x-cybrik-not-accepted'] !== LC.notAccepted) fail(`${label}: x-cybrik-not-accepted must be ${LC.notAccepted} to match the manifest lifecycle`);
};

// ---------------------------------------------------------------------------
// 1. Load schemas. Accepted base primitives are added UNMODIFIED (no lifecycle flip, no
//    re-version) purely so cross-file $refs resolve; the org schemas are the ones this packet owns
//    and this validator gates. org-common-defs is shared primitives (no direct fixture); the other
//    eight are fixture-bearing.
// ---------------------------------------------------------------------------
const BASE_PRIMITIVES = [
  'cybrik.common-defs.v1.schema.json',
  'cybrik.data-marking.v1.schema.json',
];
const ORG_COMMON = 'cybrik.org-common-defs.v1.schema.json';
const ORG_PAYLOAD_SCHEMAS = [
  'cybrik.org-node.v1.schema.json',
  'cybrik.org-node-lifecycle.v1.schema.json',
  'cybrik.org-membership.v1.schema.json',
  'cybrik.org-scope-grant.v1.schema.json',
  'cybrik.org-edge.v1.schema.json',
  'cybrik.org-external-exchange.v1.schema.json',
  'cybrik.org-aggregate-request.v1.schema.json',
  'cybrik.org-aggregate-result.v1.schema.json',
];
const ORG_SCHEMAS = [ORG_COMMON, ...ORG_PAYLOAD_SCHEMAS];

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
    // packet (backward-compat guard — the org packet may never flip a base member).
    if (doc['x-cybrik-status'] !== 'ACCEPTED FOR IMPLEMENTATION') fail(`base primitive json-schema/${name}: must stay ACCEPTED FOR IMPLEMENTATION (org packet must not modify it)`);
    if (doc['x-cybrik-not-accepted'] !== false) fail(`base primitive json-schema/${name}: x-cybrik-not-accepted must stay false`);
  } else {
    checkLifecycle(`json-schema/${name}`, doc);
    if (doc['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`json-schema/${name}: contract-version must be ${EXPECTED_VERSION}`);
    bump('org_schemas_loaded');
  }
};
for (const n of BASE_PRIMITIVES) loadSchema(n, { base: true });
for (const n of ORG_SCHEMAS) loadSchema(n, { base: false });

// Register all before compiling so cross-file $refs resolve against $id (local closure only).
for (const [name, { doc }] of Object.entries(schemas)) {
  try { ajv.addSchema(doc); } catch (e) { fail(`json-schema/${name}: addSchema failed: ${e.message}`); }
}

// Compile each org schema — this resolves every local + cross-file $ref/$defs fragment (including
// refs into org-common-defs and the accepted base primitives). A dangling ref throws here.
const validators = {}; // basename -> validate fn
for (const name of ORG_SCHEMAS) {
  const d = schemas[name]?.doc;
  if (!d?.$id) continue;
  try {
    validators[name] = ajv.getSchema(d.$id) || ajv.compile(d);
    bump('org_schemas_compiled');
  } catch (e) {
    fail(`json-schema/${name}: compile/ref-resolution failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Example fixtures, driven by examples/org/examples-manifest.json.
//    positive -> MUST validate; negative-schema -> MUST fail; negative-semantic -> MUST validate.
//    A fixed test reference clock makes the time/relationship/downgrade invariants deterministic.
// ---------------------------------------------------------------------------
const EXAMPLES_DIR = join(CONTRACTS, 'examples', 'org');
const exManifestPath = join(EXAMPLES_DIR, 'examples-manifest.json');
let exManifest;
try { exManifest = readJson(exManifestPath); } catch (e) { fail(`org examples-manifest.json: parse error: ${e.message}`); }

let NOW = null;
const fixtures = {}; // file -> parsed data (for cross-fixture semantic assertions)
if (exManifest) {
  checkLifecycle('org examples-manifest', exManifest);
  if (exManifest['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`org examples-manifest: x-cybrik-contract-version must be ${EXPECTED_VERSION}`);
  NOW = exManifest.test_reference_clock_epoch_seconds;
  if (!Number.isInteger(NOW)) fail('org examples-manifest: test_reference_clock_epoch_seconds must be an integer (drives the deterministic runtime-invariant checks)');
  for (const ex of exManifest.examples || []) {
    const exPath = join(EXAMPLES_DIR, ex.file);
    if (!existsSync(exPath)) { fail(`example missing on disk: examples/org/${ex.file}`); continue; }
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
// 3. Compatibility / version / status / integrity manifest for the org packet.
// ---------------------------------------------------------------------------
if (compat) {
  checkLifecycle('org compatibility manifest', compat);
  if (compat['x-cybrik-packet-version'] !== EXPECTED_VERSION) fail(`org manifest: packet-version must be ${EXPECTED_VERSION}`);
  if (compat['x-cybrik-is-bundle-tag'] !== false) fail('org manifest: is-bundle-tag must be false (v0.1.0 is never an immutable bundle tag / GA)');
  const pins = compat.format_pins || {};
  if (pins.jsonSchema !== '2020-12') fail('org manifest: jsonSchema pin must be 2020-12');
  if (pins.openApi !== '3.1.x') fail('org manifest: openApi pin must be 3.1.x');
  if (pins.asyncApi !== '3.0.0') fail('org manifest: asyncApi pin must be 3.0.0');
  // NO SERVER / NO MCP: this packet declares no wire endpoint and grants no tool authority.
  if (!/NO SERVER|NO ENDPOINT/i.test(compat.wire_scope || '')) fail('org manifest: wire_scope must declare NO SERVER / NO ENDPOINT (this packet declares no operational endpoint)');
  if (!/OUT OF SCOPE/i.test(compat.mcp_scope || '')) fail('org manifest: mcp_scope must declare MCP OUT OF SCOPE (no tool/agent authority)');
  const acc = compat.acceptance?.status || '';
  const gateStatus = compat.gate?.status || '';
  if (compat.gate?.id !== 'W2-G') fail("org manifest: gate.id must be 'W2-G'");
  if (EXPECTED_STATE === 'PROPOSED') {
    if (!/NOT ACCEPTED/.test(acc)) fail('org manifest: acceptance.status must state NOT ACCEPTED while PROPOSED');
    if (!/NOT OPENED|awaiting/i.test(gateStatus)) fail('org manifest: gate.status must record that Gate W2-G is not yet decided while PROPOSED');
  } else {
    if (!/ACCEPTED FOR IMPLEMENTATION/.test(acc)) fail('org manifest: acceptance.status must state ACCEPTED FOR IMPLEMENTATION');
    if (/\bNOT ACCEPTED\b/.test(acc)) fail('org manifest: acceptance.status must not still say NOT ACCEPTED once accepted');
    const a = compat.acceptance || {};
    if (!a.gate) fail('org manifest: accepted packet must record acceptance.gate');
    if (!a.decided_by) fail('org manifest: accepted packet must record acceptance.decided_by (Founder-delegated; not agent-inferred)');
    if (!a.decided_on) fail('org manifest: accepted packet must record acceptance.decided_on');
    if (!Array.isArray(a.evidence) || a.evidence.length === 0) fail('org manifest: accepted packet must record acceptance.evidence[]');
    if (/NOT OPENED|awaiting/i.test(gateStatus)) fail('org manifest: gate.status must record the Gate W2-G decision once accepted');
  }
  // Disjointness from the accepted tool-execution packet (ADR-0004) and the internal
  // service-delegation seam (ADR-0008) is a load-bearing security stance: hierarchy grants no tool
  // authority, and org_scope is opaque/advisory on the W2-F seam.
  const oos = (compat.adr_out_of_scope || []).map((x) => x.id);
  if (!oos.includes('ADR-0004')) fail('org manifest: ADR-0004 (tool execution authority) MUST be declared out of scope (hierarchy is authority routing + de-identified visibility, never a tool-grant chain)');
  if (!oos.includes('ADR-0008')) fail('org manifest: ADR-0008 (internal service-delegation seam) MUST be declared out of scope (org_scope is opaque/advisory there; this packet grants no delegation-token/transport authority)');
  if (compat.backward_compatibility?.modifies_accepted_v0_1 !== false) fail('org manifest: backward_compatibility.modifies_accepted_v0_1 must be false');
  // Every reused accepted primitive must exist on disk and NOT be a member of this packet.
  const memberFiles = new Set((compat.members || []).map((m) => m.file));
  for (const rf of compat.reuses_accepted_unmodified?.members || []) {
    if (!existsSync(join(CONTRACTS, rf))) fail(`org manifest: reused accepted member missing on disk: ${rf}`);
    if (memberFiles.has(rf)) fail(`org manifest: reused accepted member ${rf} must NOT also be declared a packet member`);
    bump('reused_accepted_members');
  }
  // Every declared member exists on disk at contract_version 0.1.0, agrees with the packet
  // lifecycle, and matches its recorded SHA-256 (integrity: the accepted bytes are the gated bytes).
  for (const m of compat.members || []) {
    const mp = join(CONTRACTS, m.file);
    if (!existsSync(mp)) { fail(`org manifest: member file missing: ${m.file}`); continue; }
    bump('manifest_members');
    if (m.contract_version !== EXPECTED_VERSION) fail(`org manifest: member ${m.file} contract_version must be ${EXPECTED_VERSION}`);
    if (m.status !== LC?.status) fail(`org manifest: member ${m.file} status must be '${LC?.status}' to match the packet lifecycle (got '${m.status}')`);
    if (typeof m.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(m.sha256)) {
      fail(`org manifest: member ${m.file} sha256 missing/not a 64-hex digest`);
    } else {
      const actual = sha256(mp);
      if (actual !== m.sha256) fail(`org manifest: member ${m.file} SHA-256 mismatch — manifest ${m.sha256}, on disk ${actual} (recompute after any edit)`);
      else bump('member_sha_verified');
    }
  }
  // The examples manifest must be declared and present on disk.
  const emRel = compat.examples_manifest;
  if (!emRel) fail('org manifest: examples_manifest reference missing');
  else if (!existsSync(join(CONTRACTS, emRel))) fail(`org manifest: examples_manifest missing on disk: ${emRel}`);
  // Hard invariants + fail-closed catalog present so the stance is documented.
  if (!Array.isArray(compat.invariants?.hard) || compat.invariants.hard.length < 2) fail('org manifest: invariants.hard must document INV-1 and INV-2');
  if (!Array.isArray(compat.invariants?.structural) || compat.invariants.structural.length === 0) fail('org manifest: invariants.structural missing/empty');
  if (!Array.isArray(compat.invariants?.runtime_only) || compat.invariants.runtime_only.length === 0) fail('org manifest: invariants.runtime_only missing/empty');
  const invText = JSON.stringify(compat.invariants || {});
  if (!/INV-1/.test(invText)) fail('org manifest: invariants must reference INV-1 (hierarchy != raw read)');
  if (!/INV-2/.test(invText)) fail('org manifest: invariants must reference INV-2 (external authority never super-admin)');
  // Compatibility / backfill / sunset record: reorg-churn (AC-11) + no-hard-delete + pre-GA sunset.
  const cb = compat.compatibility_and_backfill || {};
  if (!/same-tenant/i.test(cb.backfill || '')) fail('org manifest: compatibility_and_backfill.backfill must record same-tenant internal backfill (reorg-churn AC-11, never cross-tenant/external)');
  if (!/archived|never hard-delete/i.test(cb.backfill || '')) fail('org manifest: compatibility_and_backfill.backfill must record archive-not-hard-delete (D-1)');
  if (!/sunset|deprecat/i.test(cb.sunset || '')) fail('org manifest: compatibility_and_backfill.sunset must record the pre-GA sunset/deprecation stance');
}

// ---------------------------------------------------------------------------
// 4. Structural trust invariants as brittle-on-purpose assertions (D-1..D-8, INV-1/INV-2, FC-*).
//    A regression that relaxes any of these fails CI here. Each is ALSO exercised by a fixture; the
//    negative-schema fixtures are proven to carry the offending shape so the rejection is genuine.
// ---------------------------------------------------------------------------
const doc = (n) => schemas[n]?.doc;
const req = (o) => (o && Array.isArray(o.required)) ? o.required : [];
const props = (o) => (o && o.properties) ? o.properties : {};
const H = (id, cond, msg) => { bump('invariants_checked'); if (cond) bump('invariants_ok'); else fail(`INVARIANT#${id}: ${msg}`); };

const common = doc(ORG_COMMON);
const nodeSchema = doc('cybrik.org-node.v1.schema.json');
const lifeSchema = doc('cybrik.org-node-lifecycle.v1.schema.json');
const memberSchema = doc('cybrik.org-membership.v1.schema.json');
const grantSchema = doc('cybrik.org-scope-grant.v1.schema.json');
const edgeSchema = doc('cybrik.org-edge.v1.schema.json');
const exchangeSchema = doc('cybrik.org-external-exchange.v1.schema.json');
const aggReqSchema = doc('cybrik.org-aggregate-request.v1.schema.json');
const aggResSchema = doc('cybrik.org-aggregate-result.v1.schema.json');
const defs = common?.$defs || {};

const allOfHas = (schema, pred) => Array.isArray(schema?.allOf) && schema.allOf.some(pred);

// ---- D-1 org_node: tier is DATA (numeric ordinal, no fixed tier-name authority); label is a
//      catalog KEY (no hard-coded administrative display string); tree not DAG; no 'deleted'
//      status; external node has no parent. ----
H('D1-tier-numeric', defs.tierOrdinal?.type === 'integer' && !('enum' in (defs.tierOrdinal || {})),
  'tierOrdinal must be an integer ordinal with NO fixed tier-name enum (tiers are DATA, not hard-coded names)');
H('D1-tier-ref', /tierOrdinal$/.test((props(nodeSchema).tier?.$ref) || ''),
  'org-node.tier must $ref the numeric tierOrdinal (a string tier name is not expressible)');
H('D1-label-key', (defs.labels?.required || []).includes('label_key') && /labelKey$/.test(defs.labels?.properties?.label_key?.$ref || ''),
  'labels must REQUIRE a label_key catalog key (no hard-coded administrative display string is the authority; locale_labels is fallback only)');
H('D1-label-authority', defs.labels?.additionalProperties === false && !('label' in (defs.labels?.properties || {})) && !('name' in (defs.labels?.properties || {})),
  'labels must be additionalProperties:false with no hard-coded label/name string field (the catalog KEY is the authority)');
H('D1-no-deleted', Array.isArray(defs.orgNodeStatus?.enum) && !defs.orgNodeStatus.enum.includes('deleted'),
  "orgNodeStatus enum must have NO 'deleted' value (a referenced node is archived, never hard-deleted)");
H('D1-tree-parent', Array.isArray(props(nodeSchema).parent_id?.oneOf),
  'org-node.parent_id must be a single nullable governance parent (tree, not DAG)');
H('D1-external-no-parent', allOfHas(nodeSchema, (s) => s.if?.properties?.boundary_kind?.const === 'external' && s.then?.properties?.parent_id?.type === 'null'),
  'org-node: an external (A05) boundary node MUST have a null parent_id (INV-2: never a child/ancestor of internal nodes)');

// ---- D-1 lifecycle: no hard-delete of a referenced node (operation enum has no 'delete'); archive
//      is the only terminal state; backfill is archive-only + audited. ----
H('D1-life-enum', Array.isArray(lifeSchema?.properties?.operation?.enum)
  && !lifeSchema.properties.operation.enum.includes('delete')
  && ['suspend', 'reactivate', 'archive', 'restore'].every((o) => lifeSchema.properties.operation.enum.includes(o)),
  "org-node-lifecycle.operation enum must be suspend|reactivate|archive|restore with NO 'delete' (no hard-delete of a referenced node, D-1)");
H('D1-life-audit', req(lifeSchema).includes('audit_ref'),
  'org-node-lifecycle must REQUIRE audit_ref (every governed transition is accountable)');
H('D1-life-backfill-archive', allOfHas(lifeSchema, (s) => s.if?.required?.includes('backfill') && s.then?.properties?.operation?.const === 'archive'),
  'org-node-lifecycle: a backfill is only meaningful on an archive transition (reorg-churn successor inherits references on archive)');

// ---- D-2 membership: internal-only, never confers descendant raw by itself. ----
H('D2-internal-only', memberSchema?.properties?.node_boundary_kind?.const === 'internal',
  "org-membership.node_boundary_kind must be const 'internal' (an external A05 peer is NEVER an org_node member, INV-2)");
H('D2-no-descendant-raw', memberSchema?.properties?.confers_descendant_raw?.const === false,
  'org-membership.confers_descendant_raw must be const false (membership never confers descendant raw by itself, INV-1)');

// ---- D-4 / INV-1 scope grant: ancestor-governance is aggregate-only (raw forbidden); descendant
//      raw requires an explicit-descendant-grant with a NON-EMPTY raw_scope; aggregate carries no
//      raw. ---- (the raw/aggregate split)
H('D4-raw-vs-aggregate', allOfHas(grantSchema, (s) => s.if?.properties?.subject_relationship?.const === 'ancestor-governance'
  && s.then?.properties?.raw_scope === false && s.then?.properties?.scope_kind?.const === 'aggregate'),
  'org-scope-grant: ancestor-governance MUST force scope_kind=aggregate and forbid raw_scope (INV-1: hierarchy != raw read)');
H('D4-aggregate-no-raw', allOfHas(grantSchema, (s) => s.if?.properties?.scope_kind?.const === 'aggregate'
  && s.then?.properties?.raw_scope === false && (s.then?.required || []).includes('aggregate_scope')),
  'org-scope-grant: an aggregate grant MUST forbid raw_scope and require aggregate_scope (de-identified only)');
H('D4-descendant-explicit', allOfHas(grantSchema, (s) => s.if?.properties?.scope_kind?.const === 'descendant'
  && s.then?.properties?.subject_relationship?.const === 'explicit-descendant-grant' && (s.then?.required || []).includes('raw_scope')),
  'org-scope-grant: descendant reach MUST require an explicit-descendant-grant + raw_scope (INV-1: no implicit ancestor/sibling raw)');
H('D4-empty-scope-denies', grantSchema?.properties?.raw_scope?.properties?.patterns?.minItems === 1,
  'org-scope-grant.raw_scope.patterns must be minItems 1 (an empty raw scope DENIES, never fail-opens/grant-all)');

// ---- D-7 break-glass: loud, read-only default, self-revoke ceiling, second approval over 900s. ----
const bg = grantSchema?.properties?.break_glass;
H('D7-bg-loud', bg?.properties?.oversight_notification?.const === true && bg?.properties?.high_severity_audit?.const === true && bg?.properties?.after_action_review?.const === true,
  'break-glass must be loud: oversight_notification / high_severity_audit / after_action_review all const true (OD-6)');
H('D7-bg-ceiling', bg?.properties?.max_duration_seconds?.maximum === 3600,
  'break-glass max_duration_seconds ceiling must be 3600 (60-min hard cap, OD-6)');
H('D7-bg-second-approval', allOfHas(bg, (s) => (s.if?.properties?.max_duration_seconds?.exclusiveMinimum === 900) && (s.then?.required || []).includes('second_approval')),
  'break-glass over the 900s default MUST require a second_approval (OD-6)');
H('D7-bg-required', allOfHas(grantSchema, (s) => s.if?.properties?.mechanism?.const === 'break-glass' && (s.then?.required || []).includes('break_glass')),
  "org-scope-grant: mechanism='break-glass' MUST require the break_glass oversight block");

// ---- D-5 edges: parent/tasking never confer raw read; external can never be a 'parent' ancestor. ----
H('D5-parent-internal', allOfHas(edgeSchema, (s) => s.if?.properties?.edge_type?.const === 'parent'
  && s.then?.properties?.from_node?.properties?.boundary_kind?.const === 'internal' && s.then?.properties?.confers_raw_read?.const === false),
  "org-edge: a 'parent' edge MUST have an internal from_node and confers_raw_read=false (INV-2 external-as-ancestor + INV-1)");
H('D5-tasking-no-raw', allOfHas(edgeSchema, (s) => s.if?.properties?.edge_type?.const === 'tasking' && s.then?.properties?.confers_raw_read?.const === false),
  "org-edge: a 'tasking' edge MUST have confers_raw_read=false (authority-to-direct, not read; INV-1)");

// ---- D-6 external exchange: distinct external auth (no internal token), never auto-executes. ----
const authz = exchangeSchema?.properties?.authorization;
H('D6-ext-boundary', allOfHas(exchangeSchema?.properties?.external_peer, (s) => s.properties?.boundary_kind?.const === 'external')
  || exchangeSchema?.properties?.external_peer?.allOf?.some((s) => s.properties?.boundary_kind?.const === 'external'),
  "org-external-exchange.external_peer.boundary_kind must be const 'external' (the peer is never an internal node/ancestor/member, INV-2)");
H('D6-auth-distinct', authz?.additionalProperties === false && authz?.properties?.auth_context?.const === 'external-distinct',
  "org-external-exchange.authorization must be additionalProperties:false with auth_context const 'external-distinct' (no internal token can live here, OD-3)");
H('D6-auth-floor', authz?.properties?.mtls?.const === true && authz?.properties?.signed_envelope?.const === true && authz?.properties?.replay_protection?.const === true,
  'org-external-exchange.authorization must pin mTLS + signed_envelope + replay_protection const true (transport floor, OD-5)');
H('D6-no-auto-execute', exchangeSchema?.properties?.auto_execute?.const === false,
  'org-external-exchange.auto_execute must be const false (an inbound directive NEVER auto-executes, INV-2)');
H('D6-inbound-review', allOfHas(exchangeSchema, (s) => s.if?.properties?.direction?.const === 'inbound-directive' && (s.then?.required || []).includes('review_queue_ref')),
  'org-external-exchange: an inbound-directive MUST require a review_queue_ref (it lands in review, never auto-executes)');

// ---- D-8 aggregate: k=5 small-cell floor, no raw record/objectRef anywhere. ----
H('D8-floor-const', defs.smallCellFloor?.const === 5,
  'smallCellFloor must be const 5 (the OD-2 k=5 small-cell floor; weaker suppression is not expressible)');
H('D8-req-aggregate-only', aggReqSchema?.properties?.scope_kind?.const === 'aggregate' && aggReqSchema?.additionalProperties === false,
  "org-aggregate-request.scope_kind must be const 'aggregate' and the object additionalProperties:false (no raw reach expressible, D-8)");
const cellSchema = aggResSchema?.properties?.cells?.items;
H('D8-cell-floor', cellSchema?.properties?.count?.minimum === 5 && cellSchema?.additionalProperties === false,
  'org-aggregate-result cell count minimum must be 5 and the cell additionalProperties:false (no unsuppressed sub-5 cell, no raw objectRef drill-down, D-8/FC-4)');
H('D8-res-no-raw', aggResSchema?.additionalProperties === false,
  'org-aggregate-result must be additionalProperties:false (a raw record/objectRef has nowhere to live)');

// ---- Every grant/edge/exchange carries the shared expiry+revocation envelope with an audit_ref
//      field (FC-7 + accountability). ----
H('FC7-temporal', ['issued_at', 'not_before', 'expires_at'].every((k) => (defs.grantTemporal?.required || []).includes(k))
  && 'revoked' in (defs.grantTemporal?.properties || {}) && 'audit_ref' in (defs.grantTemporal?.properties || {}),
  'grantTemporal must require issued_at/not_before/expires_at and carry revoked + audit_ref (FC-7 expiry/revocation + accountability)');

// ---- Prove each negative-schema fixture carries the offending shape, so the schema rejection is
//      genuinely exercised (not a vacuous pass). ----
const nf = (f) => fixtures[`negative/${f}`];
H('D1x-string-tier', typeof nf('org-node.string-tier.json')?.tier === 'string',
  'string-tier fixture must set tier to a STRING so the numeric-tierOrdinal rejection is exercised');
H('D1x-ext-parent', nf('org-node.external-with-parent.json')?.boundary_kind === 'external' && nf('org-node.external-with-parent.json')?.parent_id !== null,
  'external-with-parent fixture must be an external node with a non-null parent_id so the INV-2 rejection is exercised');
H('D2x-ext-member', nf('org-membership.external-node.json')?.node_boundary_kind === 'external',
  "external-node membership fixture must set node_boundary_kind='external' so the const-'internal' rejection is exercised");
H('D5x-ext-ancestor', nf('org-edge.external-ancestor.json')?.edge_type === 'parent' && nf('org-edge.external-ancestor.json')?.from_node?.boundary_kind === 'external',
  "external-ancestor fixture must be a 'parent' edge whose from_node is external so the INV-2 rejection is exercised");
H('D4x-ancestor-raw', nf('org-scope-grant.ancestor-raw.json')?.subject_relationship === 'ancestor-governance' && !!nf('org-scope-grant.ancestor-raw.json')?.raw_scope,
  'ancestor-raw fixture must be ancestor-governance WITH a raw_scope so the INV-1 raw-escalation rejection is exercised');
H('D4x-empty-scope', Array.isArray(nf('org-scope-grant.empty-raw-scope.json')?.raw_scope?.patterns) && nf('org-scope-grant.empty-raw-scope.json').raw_scope.patterns.length === 0,
  'empty-raw-scope fixture must carry an empty raw_scope.patterns so the fail-closed minItems rejection is exercised');
H('D8x-small-cell', (nf('org-aggregate-result.small-cell.json')?.cells || []).some((c) => typeof c.count === 'number' && c.count < 5),
  'small-cell fixture must report an unsuppressed cell with count < 5 so the k=5 floor rejection is exercised');
H('D8x-raw-record', (nf('org-aggregate-result.raw-record.json')?.cells || []).some((c) => 'object_refs' in c),
  'raw-record fixture must carry an object_refs drill-down handle on a cell so the additionalProperties:false rejection is exercised');
H('D6x-internal-token', 'internal_service_token' in (nf('org-external-exchange.internal-token.json')?.authorization || {}),
  'internal-token fixture must carry an internal_service_token in authorization so the additionalProperties:false rejection is exercised');
H('D1x-delete', nf('org-node-lifecycle.delete.json')?.operation === 'delete',
  "delete fixture must set operation='delete' so the no-hard-delete enum rejection is exercised");

// ---------------------------------------------------------------------------
// 5. Runtime (negative-semantic) invariants: relying-party checks a schema cannot express (compare
//    two field values, walk the tree, evaluate wall-clock expiry/revocation, compare a marking to
//    its source). Each negative-semantic fixture is structurally valid but MUST be REJECTED here;
//    the corresponding positive fixture MUST be ACCEPTED (so the rule is not vacuous). Evaluated
//    against the fixed test clock NOW and a fixed reference topology.
// ---------------------------------------------------------------------------

// Reference governance forest (tenant-acme internal tree) the negative-semantic fixtures are
// evaluated against — the tree knowledge the schema lacks. child org_node_id -> parent org_node_id.
const REF_PARENT = {
  'on-root': null,
  'on-region': 'on-root',
  'on-district': 'on-region',
  'on-district-old': 'on-region',
  'on-commune': 'on-district',
  'on-commune-a': 'on-district',
  'on-commune-b': 'on-district',
};
// Subject actor -> their home org_node (the node they act from), for the tree-relationship check.
const REF_ACTOR_HOME = {
  'soc:coordinator:minh': 'on-region',
  'soc:analyst:linh': 'on-commune',
  'soc:analyst:commune-a': 'on-commune-a',
};
const ancestorsOf = (nodeId) => {
  const chain = [];
  let cur = REF_PARENT[nodeId];
  const seen = new Set([nodeId]);
  while (cur != null && !seen.has(cur)) { chain.push(cur); seen.add(cur); cur = REF_PARENT[cur]; }
  return chain;
};
const isStrictDescendant = (targetId, ancestorId) => ancestorsOf(targetId).includes(ancestorId);

// Marking lattice (matches cybrik.common-defs classification + tlpMarking ordering).
const CLASS_RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };
const TLP_RANK = { 'TLP:CLEAR': 0, 'TLP:GREEN': 1, 'TLP:AMBER': 2, 'TLP:AMBER+STRICT': 3, 'TLP:RED': 4 };
// origin_marking is an opaque provenance string; parse a "classification[;TLP:x]" convention.
const parseOrigin = (s) => {
  if (typeof s !== 'string') return null;
  const parts = s.split(';').map((x) => x.trim());
  const c = parts.find((p) => p in CLASS_RANK);
  const t = parts.find((p) => p in TLP_RANK);
  return { c: c !== undefined ? CLASS_RANK[c] : undefined, t: t !== undefined ? TLP_RANK[t] : undefined };
};
// A marking is DOWNGRADED relative to origin if it drops below origin on any populated lattice axis.
const isDowngrade = (marking, originStr) => {
  const o = parseOrigin(originStr);
  if (!o) return false; // no provenance recorded -> nothing to downgrade against
  const mc = CLASS_RANK[marking?.classification];
  const mt = TLP_RANK[marking?.tlp];
  if (o.c !== undefined && mc !== undefined && mc < o.c) return true;
  if (o.t !== undefined && mt !== undefined && mt < o.t) return true;
  return false;
};

const iso = (s) => Math.floor(Date.parse(s) / 1000);

// The relying-party verdict for a fixture, by schema. Returns { reject, reason } — reject:true
// means an invariant a schema alone cannot enforce rejects this structurally-valid object.
const relyingPartyVerdict = (schemaName, d) => {
  if (schemaName === 'cybrik.org-edge.v1.schema.json') {
    // D-1 same-tenant + acyclic forest (FC-2 / OD-1 + acyclicity).
    if (d.from_node?.tenant_binding !== d.to_node?.tenant_binding) return { reject: true, reason: 'cross-tenant edge (from_node.tenant_binding != to_node.tenant_binding)' };
    if (d.from_node?.org_node_id === d.to_node?.org_node_id) return { reject: true, reason: 'self-loop edge (from_node == to_node) — not acyclic' };
    // A 'parent' edge whose child is already an ancestor of the parent would form a cycle.
    if (d.edge_type === 'parent' && ancestorsOf(d.from_node?.org_node_id).includes(d.to_node?.org_node_id)) return { reject: true, reason: 'parent edge closes a cycle (to_node already an ancestor of from_node)' };
    return { reject: false };
  }
  if (schemaName === 'cybrik.org-scope-grant.v1.schema.json') {
    const t = d.temporal || {};
    // FC-7 expiry / revocation.
    if (t.revoked === true) return { reject: true, reason: 'grant is revoked (authorizes nothing even within its window)' };
    if (Number.isInteger(NOW) && Number.isFinite(iso(t.expires_at)) && iso(t.expires_at) < NOW) return { reject: true, reason: `grant expired (expires_at ${t.expires_at} < test clock NOW)` };
    if (Number.isInteger(NOW) && Number.isFinite(iso(t.not_before)) && iso(t.not_before) > NOW) return { reject: true, reason: `grant not yet valid (not_before ${t.not_before} > test clock NOW)` };
    // SoD: under separation_of_duties grantor MUST be distinct from subject.
    if (t.separation_of_duties === true && d.grantor?.id && d.grantor.id === d.subject?.id) return { reject: true, reason: 'separation-of-duties violated (grantor == subject)' };
    // INV-1 tree-relationship: no implicit ancestor/sibling raw. The subject's relationship to the
    // target subtree MUST match subject_relationship (a sibling/unrelated node is not a descendant).
    const home = REF_ACTOR_HOME[d.subject?.id];
    const target = d.target_node?.org_node_id;
    if (home && target) {
      if (d.subject_relationship === 'own-node' && home !== target) return { reject: true, reason: `own-node grant target (${target}) is not the subject's own node (${home})` };
      if ((d.subject_relationship === 'explicit-descendant-grant' || d.subject_relationship === 'ancestor-governance')
        && !isStrictDescendant(target, home)) return { reject: true, reason: `${d.subject_relationship} target (${target}) is not a descendant of the subject's node (${home}) — sibling/unrelated lateral read` };
    }
    return { reject: false };
  }
  if (schemaName === 'cybrik.org-external-exchange.v1.schema.json') {
    // FC-6 marking non-downgrade relative to origin_marking.
    if (isDowngrade(d.marking, d.marking?.origin_marking)) return { reject: true, reason: `marking downgraded below origin_marking ('${d.marking?.origin_marking}')` };
    // OD-4 residency deny-by-default: the peer's residency_zone must be an allowed zone.
    const j = d.jurisdiction;
    if (j && Array.isArray(j.allowed_zones) && j.residency_zone && !j.allowed_zones.includes(j.residency_zone)) return { reject: true, reason: `residency deny-by-default: zone ${j.residency_zone} not in allowed_zones` };
    return { reject: false };
  }
  if (schemaName === 'cybrik.org-node-lifecycle.v1.schema.json') {
    // Backfill successor MUST be a same-tenant internal node, distinct from the archived node.
    const b = d.backfill;
    if (b) {
      if (b.successor_node_id === d.org_node_id) return { reject: true, reason: 'backfill successor equals the archived node' };
      if (REF_PARENT[b.successor_node_id] === undefined && !(b.successor_node_id in REF_PARENT)) { /* unknown successor: leave to runtime */ }
    }
    return { reject: false };
  }
  if (schemaName === 'cybrik.org-aggregate-result.v1.schema.json') {
    // FC-4: every unsuppressed cell count >= k=5 (structural, re-checked here for the runtime pass).
    for (const c of d.cells || []) {
      if (typeof c.count === 'number' && c.count < (d.small_cell_floor ?? 5)) return { reject: true, reason: `unsuppressed cell count ${c.count} below small-cell floor` };
    }
    return { reject: false };
  }
  return { reject: false };
};

// Drive the runtime pass off the examples manifest: every positive MUST be accepted, every
// negative-semantic MUST be rejected. (negative-schema fixtures were already rejected structurally.)
if (exManifest) {
  for (const ex of exManifest.examples || []) {
    const d = fixtures[ex.file];
    if (!d) continue;
    if (ex.kind === 'positive') {
      const v = relyingPartyVerdict(ex.schema, d);
      bump('runtime_positive_total');
      if (v.reject) fail(`positive example ${ex.file} was REJECTED by a runtime invariant (must be accepted): ${v.reason}`);
      else bump('runtime_positive_accept');
    } else if (ex.kind === 'negative-semantic') {
      const v = relyingPartyVerdict(ex.schema, d);
      bump('runtime_negative_total');
      if (v.reject) bump('runtime_negative_reject');
      else fail(`negative-semantic example ${ex.file} was NOT rejected by any runtime invariant (its declared invariant is not enforced/exercised)`);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Mapping notes: NO operational server/endpoint, and the UAT-trace placeholders are present.
// ---------------------------------------------------------------------------
const MAPPING_PATH = join(CONTRACTS, 'adapters', 'cybrik-org-hierarchy-mapping-notes.v1.md');
let mapping = '';
try { mapping = readFileSync(MAPPING_PATH, 'utf8'); } catch (e) { fail(`org mapping notes: cannot read: ${e.message}`); }
if (mapping) {
  bump('mapping_checked');
  if (!/declares?\s+NO operational server/i.test(mapping) && !/NO operational server, endpoint/i.test(mapping)) fail('org mapping notes: must declare NO operational server/endpoint (this repo builds no migration/API/UI)');
  if (!/NOT built here|NOT IMPLEMENTED/i.test(mapping)) fail('org mapping notes: must state the SOC migration/API/UI is NOT built/implemented here');
  if (!/illustrative/i.test(mapping)) fail('org mapping notes: the SOC surface (migration 0022 / endpoints / UI routes) must be labelled illustrative/non-normative');
  if (!/UAT Gate Standard/i.test(mapping) || !/UAT trace/i.test(mapping)) fail('org mapping notes: must carry the UAT-trace placeholders (UAT Gate Standard + W2-G UAT trace)');
  else bump('mapping_uat_trace_ok');
  if (!/feature flag that defaults OFF|feature flag.*OFF/i.test(mapping)) fail('org mapping notes: must record the feature-flag-default-OFF rollback stance');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('=== W2-G organizational-hierarchy packet — JSON Schema / fixtures / invariant / integrity validation ===');
console.log('counts:', JSON.stringify(counts));
if (errors.length) {
  console.error(`\nFAIL — ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`\nOK — org-hierarchy packet passes JSON Schema 2020-12 compile/ref-resolution, all fixtures (${counts.positive_pass || 0} positive + ${counts.negative_schema_reject || 0} negative-schema + ${counts.runtime_negative_reject || 0} negative-semantic), per-member SHA-256 integrity, and every INV-1/INV-2 + D-1..D-8 invariant (lifecycle: ${EXPECTED_STATE || 'UNKNOWN'} at v${EXPECTED_VERSION}).`);
