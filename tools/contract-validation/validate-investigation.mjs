// validate-investigation.mjs — W0-I01 Investigation/Claim/Evidence/Bundle packet validator.
//
// Scope: the W0-I01 investigation packet ONLY (its whole-packet lifecycle is ACCEPTED FOR
// IMPLEMENTATION — not stable v1/GA — at v0.1.0 by explicit Founder Option A and
// G-W0I01-1..5=yes on 2026-07-26, with the compatibility manifest as the single source of truth).
// It is
// ADDITIVE to, and DISJOINT from, the accepted v0.1 cross-product packet and the ACCEPTED FOR
// IMPLEMENTATION W2-D/W2-F/W2-G packets (validated by validate-schemas.mjs / validate-inference.mjs
// / validate-svc.mjs / validate-org.mjs, none of which this file touches). This validator is
// STANDALONE and deliberately NOT wired into the shared orchestrator (validate.mjs) or
// package.json scripts — run it directly: `node tools/contract-validation/validate-investigation.mjs`.
//
// Here we:
//   (1) load the accepted base primitives (common-defs, data-marking) UNMODIFIED so the
//       investigation schemas' cross-file $refs resolve, then compile every investigation
//       schema — a dangling $ref/$defs fragment throws at compile time;
//   (2) drive the positive / negative-schema / negative-semantic fixtures from the investigation
//       examples-manifest (positive MUST validate; negative-schema MUST fail; negative-semantic
//       MUST be structurally valid — only a runtime trust invariant rejects it);
//   (3) assert the investigation trust invariants (TI-1..TI-7 structural, TR-1..TR-4 runtime) as
//       brittle-on-purpose checks so a regression that relaxes any of them fails here — grounded
//       assertion, honest abstention, no silent-empty bundle, no tool/agent/action authority,
//       investigation-scoped correlation, digest-bound references, marking non-downgrade,
//       cross-tenant guard, citation dereference, lifecycle ordering;
//   (4) assert manifest / examples-manifest lifecycle + integrity consistency: every member
//       agrees with the manifest's single lifecycle state (a half-flipped packet — some members
//       ACCEPTED, some PROPOSED — fails here), the accepted base is reused unmodified, and the
//       packet is never a bundle tag / GA;
//   (5) truthfully DECLARE (not assert) the runtime_only_declared_not_fixture_verifiable set, e.g.
//       TR-5 today. TR-1..TR-4 constrain a relationship a fixture can embody, so each has a
//       concrete violating/satisfying fixture pair and an H() assertion. A declared-only entry
//       instead constrains a downstream CONSUMER's future behavior, not this payload's shape — no
//       fixture can exercise it, and inventing one that always passes would be a false static
//       gate. The reported list/count/status are DERIVED from the manifest's own array via
//       deriveDeclaredRuntimeOnly (defined near the top, self-checked against synthetic
//       duplicate/malformed data before ever touching the real manifest) — nothing is hardcoded,
//       so add/remove/rename of a declared entry in the manifest is reflected automatically, and a
//       duplicate id or malformed entry is a manifest `fail()`, not a silent gap. Every declared
//       item stays OUT of invariants_checked/invariants_ok and is named separately in the summary
//       and exit line, so a green run can never be misread as having verified it. See the
//       compatibility manifest's trust_invariants.runtime_only_declared_not_fixture_verifiable for
//       the required future CONSUMER-AUTHZ-GATE that would actually close TR-5.
//
// Zero external side effects. Exit 0 = all checks passed; exit 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
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

// ---------------------------------------------------------------------------
// 0a. deriveDeclaredRuntimeOnly — the SINGLE place that turns
//     compat.trust_invariants.runtime_only_declared_not_fixture_verifiable into what this
//     validator reports/counts. Nothing about TR-5 (or any future declared-only id) is
//     hardcoded elsewhere: the reported list, its count, and each item's status string all flow
//     from the manifest through this one function. That is what lets add/remove/rename of a
//     declared-only entry in the manifest show up here automatically, and what stops a
//     duplicate/malformed entry from silently producing a false green (a `fail()`-worthy
//     manifest problem, not a validator crash, and not something a hardcoded reporter would
//     even look for).
// ---------------------------------------------------------------------------
function deriveDeclaredRuntimeOnly(list) {
  const problems = [];
  const seenIds = new Set();
  const derived = [];
  for (const d of Array.isArray(list) ? list : []) {
    const id = d && d.id;
    if (!id) { problems.push('entry missing id'); continue; }
    if (seenIds.has(id)) { problems.push(`duplicate id '${id}'`); continue; }
    seenIds.add(id);
    if (!d.statement || !d.why_not_fixture_verifiable || !d.closure_gate) {
      problems.push(`${id}: missing statement/why_not_fixture_verifiable/closure_gate`);
      continue;
    }
    if (d.validator_status !== 'declared_runtime_only') {
      problems.push(`${id}: validator_status must be 'declared_runtime_only' (got '${JSON.stringify(d.validator_status)}')`);
      continue;
    }
    derived.push({ id, statement: d.statement });
  }
  return { derived, problems };
}

// Inline self-check of deriveDeclaredRuntimeOnly itself, against synthetic in-memory data — never
// written to disk, never counted as a packet fixture or a packet trust invariant. This is a
// negative-validation path proving the duplicate-id rejection actually rejects, and a positive
// path proving well-formed distinct entries are accepted, so a regression to the derivation logic
// (not to the packet) is caught here rather than silently degrading into a false green.
{
  const wellFormed = (id) => ({ id, statement: 's', why_not_fixture_verifiable: 'w', closure_gate: 'g', validator_status: 'declared_runtime_only' });
  const okCase = deriveDeclaredRuntimeOnly([wellFormed('X-1'), wellFormed('X-2')]);
  bump('selfcheck_derive_total');
  if (okCase.derived.length === 2 && okCase.problems.length === 0) bump('selfcheck_derive_ok');
  else fail('selfcheck: deriveDeclaredRuntimeOnly must accept two well-formed, distinctly-id\'d entries with zero problems (derivation logic itself is broken)');

  const dupCase = deriveDeclaredRuntimeOnly([wellFormed('X-1'), wellFormed('X-1')]);
  bump('selfcheck_derive_total');
  if (dupCase.derived.length === 1 && dupCase.problems.some((p) => p.includes("duplicate id 'X-1'"))) bump('selfcheck_derive_ok');
  else fail('selfcheck: deriveDeclaredRuntimeOnly must reject a duplicate id (keep only the first, report a duplicate-id problem) — duplicate-id detection itself is broken');

  const malformedCase = deriveDeclaredRuntimeOnly([{ id: 'X-3', validator_status: 'declared_runtime_only' }]);
  bump('selfcheck_derive_total');
  if (malformedCase.derived.length === 0 && malformedCase.problems.some((p) => p.includes('X-3'))) bump('selfcheck_derive_ok');
  else fail('selfcheck: deriveDeclaredRuntimeOnly must reject an entry missing statement/why_not_fixture_verifiable/closure_gate — malformed-entry detection itself is broken');

  const wrongStatusCase = deriveDeclaredRuntimeOnly([{ ...wellFormed('X-4'), validator_status: 'passed' }]);
  bump('selfcheck_derive_total');
  if (wrongStatusCase.derived.length === 0 && wrongStatusCase.problems.some((p) => p.includes('X-4'))) bump('selfcheck_derive_ok');
  else fail("selfcheck: deriveDeclaredRuntimeOnly must reject an entry whose validator_status isn't 'declared_runtime_only' — status-string detection itself is broken");
}

// ---------------------------------------------------------------------------
// 0. Lifecycle state. Exactly TWO truthful whole-packet states are permitted at
//    v0.1.0, and the compatibility manifest is the single source of truth:
//      PROPOSED (not-accepted) | ACCEPTED FOR IMPLEMENTATION (accepted).
//    This packet is now ACCEPTED FOR IMPLEMENTATION by Gate W0-I01. The two-state
//    check remains generic (not hardcoded to the accepted state) so it rejects
//    half-flipped packet members — exactly the pattern
//    validate-inference.mjs / validate-svc.mjs / validate-org.mjs already use.
// ---------------------------------------------------------------------------
const LIFECYCLE = {
  'PROPOSED': { status: 'PROPOSED', notAccepted: true },
  'ACCEPTED FOR IMPLEMENTATION': { status: 'ACCEPTED FOR IMPLEMENTATION', notAccepted: false },
};
const COMPAT_PATH = join(CONTRACTS, 'compatibility', 'cybrik-suite-investigation-packet.v1.manifest.json');
let compat = null;
try { compat = readJson(COMPAT_PATH); } catch (e) { fail(`investigation compatibility manifest: cannot read: ${e.message}`); }
let EXPECTED_STATE = null;
if (compat) {
  const s = compat['x-cybrik-status'];
  if (LIFECYCLE[s]) EXPECTED_STATE = s;
  else fail(`investigation compatibility manifest: x-cybrik-status must be one of ${Object.keys(LIFECYCLE).map((k) => `'${k}'`).join(' | ')} at v${EXPECTED_VERSION} (got '${s}'); no stable/GA or half-flipped status is permitted`);
}
const LC = EXPECTED_STATE ? LIFECYCLE[EXPECTED_STATE] : null;
const checkLifecycle = (label, obj) => {
  if (!LC || !obj) return;
  if (obj['x-cybrik-status'] !== LC.status) fail(`${label}: x-cybrik-status must be '${LC.status}' to match the manifest lifecycle (got '${obj['x-cybrik-status']}')`);
  if (obj['x-cybrik-not-accepted'] !== LC.notAccepted) fail(`${label}: x-cybrik-not-accepted must be ${LC.notAccepted} to match the manifest lifecycle`);
};

// ---------------------------------------------------------------------------
// 1. Load schemas. Accepted base primitives are added UNMODIFIED (no lifecycle
//    flip, no re-version) purely so cross-file $refs resolve; the investigation
//    schemas are the ones this packet owns and this validator gates.
// ---------------------------------------------------------------------------
const BASE_PRIMITIVES = [
  'cybrik.common-defs.v1.schema.json',
  'cybrik.data-marking.v1.schema.json',
];
const INVESTIGATION_SCHEMAS = [
  'cybrik.investigation-common-defs.v1.schema.json',
  'cybrik.investigation.v1.schema.json',
  'cybrik.claim.v1.schema.json',
  'cybrik.evidence.v1.schema.json',
  'cybrik.investigation-bundle.v1.schema.json',
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
    // packet (backward-compat guard — the investigation packet may never flip a base member).
    if (doc['x-cybrik-status'] !== 'ACCEPTED FOR IMPLEMENTATION') fail(`base primitive json-schema/${name}: must stay ACCEPTED FOR IMPLEMENTATION (investigation packet must not modify it)`);
    if (doc['x-cybrik-not-accepted'] !== false) fail(`base primitive json-schema/${name}: x-cybrik-not-accepted must stay false`);
  } else {
    checkLifecycle(`json-schema/${name}`, doc);
    if (doc['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`json-schema/${name}: contract-version must be ${EXPECTED_VERSION}`);
    bump('investigation_schemas_loaded');
  }
};
for (const n of BASE_PRIMITIVES) loadSchema(n, { base: true });
for (const n of INVESTIGATION_SCHEMAS) loadSchema(n, { base: false });

// Register all before compiling so cross-file $refs resolve against $id.
for (const [name, { doc }] of Object.entries(schemas)) {
  try { ajv.addSchema(doc); } catch (e) { fail(`json-schema/${name}: addSchema failed: ${e.message}`); }
}

// Compile each investigation payload schema (skip the common-defs $defs-only file — nothing to
// compile/fixture against directly) — this resolves every local + cross-file $ref/$defs fragment
// (including refs into the accepted base primitives). A dangling ref throws here.
const PAYLOAD_SCHEMAS = INVESTIGATION_SCHEMAS.filter((n) => n !== 'cybrik.investigation-common-defs.v1.schema.json');
const validators = {}; // basename -> validate fn
for (const name of PAYLOAD_SCHEMAS) {
  const doc = schemas[name]?.doc;
  if (!doc?.$id) continue;
  try {
    validators[name] = ajv.getSchema(doc.$id) || ajv.compile(doc);
    bump('investigation_schemas_compiled');
  } catch (e) {
    fail(`json-schema/${name}: compile/ref-resolution failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Example fixtures, driven by examples/investigation/examples-manifest.json.
//    positive -> MUST validate; negative-schema -> MUST fail; negative-semantic -> MUST validate.
// ---------------------------------------------------------------------------
const EXAMPLES_DIR = join(CONTRACTS, 'examples', 'investigation');
const exManifestPath = join(EXAMPLES_DIR, 'examples-manifest.json');
let exManifest;
try { exManifest = readJson(exManifestPath); } catch (e) { fail(`investigation examples-manifest.json: parse error: ${e.message}`); }

const fixtures = {}; // file -> parsed data (for cross-fixture semantic assertions)
if (exManifest) {
  checkLifecycle('investigation examples-manifest', exManifest);
  if (exManifest['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`investigation examples-manifest: x-cybrik-contract-version must be ${EXPECTED_VERSION}`);
  for (const ex of exManifest.examples || []) {
    const exPath = join(EXAMPLES_DIR, ex.file);
    if (!existsSync(exPath)) { fail(`example missing on disk: examples/investigation/${ex.file}`); continue; }
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
// 3. Compatibility / version / status manifest for the investigation packet.
// ---------------------------------------------------------------------------
let declaredRuntimeOnlyFromManifest = []; // populated below if compat is present; [] otherwise
if (compat) {
  checkLifecycle('investigation compatibility manifest', compat);
  if (compat['x-cybrik-packet-version'] !== EXPECTED_VERSION) fail(`investigation manifest: packet-version must be ${EXPECTED_VERSION}`);
  if (compat['x-cybrik-is-bundle-tag'] !== false) fail('investigation manifest: is-bundle-tag must be false (v0.1.0 is never an immutable bundle tag / GA)');
  if (compat.format_pins?.jsonSchema !== '2020-12') fail('investigation manifest: format_pins.jsonSchema must be 2020-12');
  const acc = compat.acceptance?.status || '';
  const gateStatus = compat.gate?.status || '';
  if (compat.gate?.id !== 'W0-I01') fail("investigation manifest: gate.id must be 'W0-I01'");
  if (EXPECTED_STATE === 'PROPOSED') {
    if (!/NOT ACCEPTED/.test(acc)) fail('investigation manifest: acceptance.status must state NOT ACCEPTED while PROPOSED');
    if (!/NOT OPENED|awaiting/i.test(gateStatus)) fail('investigation manifest: gate.status must record that Gate W0-I01 is not yet decided (NOT OPENED — awaiting Founder decision)');
  } else {
    // ACCEPTED FOR IMPLEMENTATION: acceptance + gate must be affirmative, Founder-gated, and evidenced.
    if (!/ACCEPTED FOR IMPLEMENTATION/.test(acc)) fail('investigation manifest: acceptance.status must state ACCEPTED FOR IMPLEMENTATION');
    if (/\bNOT ACCEPTED\b/.test(acc)) fail('investigation manifest: acceptance.status must not still say NOT ACCEPTED once accepted');
    const a = compat.acceptance || {};
    if (!a.gate) fail('investigation manifest: accepted packet must record acceptance.gate');
    if (!a.decided_by) fail('investigation manifest: accepted packet must record acceptance.decided_by (Founder-delegated; not agent-inferred)');
    if (!a.decided_on) fail('investigation manifest: accepted packet must record acceptance.decided_on');
    if (!Array.isArray(a.evidence) || a.evidence.length === 0) fail('investigation manifest: accepted packet must record acceptance.evidence[]');
    if (/NOT OPENED|awaiting/i.test(gateStatus)) fail('investigation manifest: gate.status must record the Gate W0-I01 decision once accepted (must not still say NOT OPENED / awaiting)');
  }
  // Disjointness from the accepted tool-execution packet is a load-bearing security stance.
  const oos = (compat.adr_out_of_scope || []).map((x) => x.id);
  if (!oos.includes('ADR-0004')) fail('investigation manifest: ADR-0004 (tool execution authority) MUST be declared out of scope (claim/evidence carry no execution authority)');
  if (compat.backward_compatibility?.modifies_accepted_v0_1 !== false) fail('investigation manifest: backward_compatibility.modifies_accepted_v0_1 must be false');
  // Every reused accepted primitive must exist on disk and NOT be a member of this packet.
  const memberFiles = new Set((compat.members || []).map((m) => m.file));
  for (const rf of compat.reuses_accepted_unmodified?.members || []) {
    if (!existsSync(join(CONTRACTS, rf))) fail(`investigation manifest: reused accepted member missing on disk: ${rf}`);
    if (memberFiles.has(rf)) fail(`investigation manifest: reused accepted member ${rf} must NOT also be declared a packet member (it is reused unmodified, not owned)`);
    bump('reused_accepted_members');
  }
  // Every declared member exists on disk at contract_version 0.1.0.
  for (const m of compat.members || []) {
    const mp = join(CONTRACTS, m.file);
    if (!existsSync(mp)) fail(`investigation manifest: member file missing: ${m.file}`);
    if (m.contract_version !== EXPECTED_VERSION) fail(`investigation manifest: member ${m.file} contract_version must be ${EXPECTED_VERSION}`);
    bump('manifest_members');
  }
  // Trust-invariant catalog must be present (structural + both runtime-only classes) so the
  // evidence-class distinction (fixture-exercised vs. declared-only) is documented, not just
  // asserted in code.
  if (!Array.isArray(compat.trust_invariants?.structural) || compat.trust_invariants.structural.length === 0) fail('investigation manifest: trust_invariants.structural missing/empty');
  if (!Array.isArray(compat.trust_invariants?.runtime_only_fixture_exercised) || compat.trust_invariants.runtime_only_fixture_exercised.length === 0) fail('investigation manifest: trust_invariants.runtime_only_fixture_exercised missing/empty');
  const declaredOnlyRaw = compat.trust_invariants?.runtime_only_declared_not_fixture_verifiable;
  if (!Array.isArray(declaredOnlyRaw) || declaredOnlyRaw.length === 0) fail('investigation manifest: trust_invariants.runtime_only_declared_not_fixture_verifiable missing/empty');
  // Single source of truth: deriveDeclaredRuntimeOnly (self-checked above) both validates every
  // entry (duplicate ids, missing fields, wrong validator_status) and produces the exact list this
  // validator reports/counts below — nothing here is hardcoded to 'TR-5' or any other id.
  const derivedHere = deriveDeclaredRuntimeOnly(declaredOnlyRaw);
  declaredRuntimeOnlyFromManifest = derivedHere.derived;
  for (const p of derivedHere.problems) fail(`investigation manifest: runtime_only_declared_not_fixture_verifiable: ${p}`);
}

// ---------------------------------------------------------------------------
// 4. Trust invariants as brittle-on-purpose assertions. A regression that relaxes
//    any of these fails CI here. Structural ones are also EXERCISED by fixtures.
// ---------------------------------------------------------------------------
const doc = (n) => schemas[n]?.doc;
const req = (o) => (o && Array.isArray(o.required)) ? o.required : [];
const props = (o) => (o && o.properties) ? o.properties : {};
const H = (id, cond, msg) => { bump('invariants_checked'); if (cond) bump('invariants_ok'); else fail(`INVARIANT#${id}: ${msg}`); };

const claimSchema = doc('cybrik.claim.v1.schema.json');
const evidenceSchema = doc('cybrik.evidence.v1.schema.json');
const investigationSchema = doc('cybrik.investigation.v1.schema.json');
const bundleSchema = doc('cybrik.investigation-bundle.v1.schema.json');

const ifThenFor = (schema, constValue) => (Array.isArray(schema?.allOf) ? schema.allOf : [])
  .find((b) => b?.if?.properties?.status?.const === constValue);

// TI-1 GROUNDED ASSERTION: an 'asserted' claim requires confidence + non-empty evidence_refs.
const assertedBlock = ifThenFor(claimSchema, 'asserted');
H('TI-1a', !!assertedBlock && (assertedBlock.then.required || []).includes('confidence') && (assertedBlock.then.required || []).includes('evidence_refs'),
  "claim allOf(if status='asserted') must require confidence and evidence_refs");
H('TI-1b', assertedBlock?.then?.properties?.evidence_refs?.minItems === 1, "claim allOf(if status='asserted') must set evidence_refs.minItems=1");
const eeFix = fixtures['negative-schema/claim.asserted-empty-evidence.json'];
H('TI-1c', eeFix?.status === 'asserted' && Array.isArray(eeFix?.evidence_refs) && eeFix.evidence_refs.length === 0,
  "asserted-empty-evidence fixture must set status='asserted' with an empty evidence_refs so the minItems rejection is exercised");

// TI-2 HONEST ABSTENTION (claim): 'abstained' requires abstention_reason and forbids confidence.
const abstainedBlock = ifThenFor(claimSchema, 'abstained');
H('TI-2a', (abstainedBlock?.then?.required || []).includes('abstention_reason'), "claim allOf(if status='abstained') must require abstention_reason");
H('TI-2b', Array.isArray(abstainedBlock?.then?.not?.required) && abstainedBlock.then.not.required.includes('confidence'),
  "claim allOf(if status='abstained') must forbid confidence via not.required");
const armFix = fixtures['negative-schema/claim.abstained-missing-reason.json'];
H('TI-2c', armFix?.status === 'abstained' && !('abstention_reason' in (armFix || {})),
  "abstained-missing-reason fixture must set status='abstained' with no abstention_reason so the rejection is exercised");
const awcFix = fixtures['negative-schema/claim.abstained-with-confidence.json'];
H('TI-2d', awcFix?.status === 'abstained' && 'confidence' in (awcFix || {}),
  "abstained-with-confidence fixture must set status='abstained' while carrying confidence so the rejection is exercised");

// TI-3 HONEST ABSTENTION (investigation): 'abstained' requires abstention_reason.
const invAbstainedBlock = ifThenFor(investigationSchema, 'abstained');
H('TI-3a', (invAbstainedBlock?.then?.required || []).includes('abstention_reason'), "investigation allOf(if status='abstained') must require abstention_reason");
const iarFix = fixtures['negative-schema/investigation.abstained-missing-reason.json'];
H('TI-3b', iarFix?.status === 'abstained' && !('abstention_reason' in (iarFix || {})),
  "investigation.abstained-missing-reason fixture must set status='abstained' with no abstention_reason so the rejection is exercised");

// TI-4 NO SILENT-EMPTY BUNDLE: claims.minItems=1.
H('TI-4a', bundleSchema?.properties?.claims?.minItems === 1, 'investigation-bundle.claims must have minItems 1');
const ecFix = fixtures['negative-schema/investigation-bundle.empty-claims.json'];
H('TI-4b', Array.isArray(ecFix?.claims) && ecFix.claims.length === 0, 'empty-claims fixture must carry an empty claims array so the minItems rejection is exercised');

// TI-5 NO TOOL/AGENT/ACTION AUTHORITY: additionalProperties=false, no authority fields, on Claim/Evidence.
const AUTHORITY_FIELDS = ['tools', 'tool', 'capability', 'capabilities', 'delegation_ref', 'delegation_chain', 'approval_id', 'mcp', 'mcp_server', 'action'];
const noAuthority = (schema) => schema?.additionalProperties === false && !AUTHORITY_FIELDS.some((f) => f in props(schema));
H('TI-5a', noAuthority(claimSchema), 'cybrik.claim.v1 must carry NO tool/capability/delegation/approval/mcp field');
H('TI-5b', noAuthority(evidenceSchema), 'cybrik.evidence.v1 must carry NO tool/capability/delegation/approval/mcp field');
const eafFix = fixtures['negative-schema/claim.extra-authority-field.json'];
H('TI-5c', !!eafFix && AUTHORITY_FIELDS.some((f) => f in eafFix), 'extra-authority-field fixture must carry an approval_id (or similar) field so the additionalProperties=false rejection is exercised');

// TI-6 INVESTIGATION-SCOPED CORRELATION: investigation_id required on Claim/Evidence/Bundle.
H('TI-6a', req(claimSchema).includes('investigation_id'), 'cybrik.claim.v1 must require investigation_id');
H('TI-6b', req(evidenceSchema).includes('investigation_id'), 'cybrik.evidence.v1 must require investigation_id');
H('TI-6c', req(bundleSchema).includes('investigation_id'), 'cybrik.investigation-bundle.v1 must require investigation_id');
const miFix = fixtures['negative-schema/evidence.missing-investigation-id.json'];
H('TI-6d', !!miFix && !('investigation_id' in miFix), 'missing-investigation-id fixture must omit investigation_id so the required-field rejection is exercised');

// TI-7 DIGEST-BOUND REFERENCES ONLY: source_ref / evidence_refs / claims / evidence are all
// cybrik.common-defs objectRef (which itself requires digest).
const OBJREF = 'cybrik.common-defs.v1.schema.json#/$defs/objectRef';
H('TI-7a', evidenceSchema?.properties?.source_ref?.$ref === OBJREF, 'evidence.source_ref must $ref the common-defs objectRef');
H('TI-7b', claimSchema?.properties?.evidence_refs?.items?.$ref === OBJREF, 'claim.evidence_refs items must $ref the common-defs objectRef');
H('TI-7c', bundleSchema?.properties?.claims?.items?.$ref === OBJREF && bundleSchema?.properties?.evidence?.items?.$ref === OBJREF,
  'investigation-bundle.claims/evidence items must $ref the common-defs objectRef');
const sdFix = fixtures['negative-schema/evidence.source-ref-missing-digest.json'];
H('TI-7d', !!sdFix?.source_ref && !('digest' in sdFix.source_ref), 'source-ref-missing-digest fixture must omit source_ref.digest so the required-field rejection is exercised');

// ---- Runtime invariants: negative-semantic fixtures are structurally valid but MUST be rejected
//      by a control-plane invariant a schema alone cannot express. Prove each fixture actually
//      VIOLATES its invariant, and that the correlated positive fixture SATISFIES it. ----

// TR-1 MARKING NON-DOWNGRADE: a bundle's data_marking must be >= the union of its referenced
// claim/evidence markings, INDEPENDENTLY on each axis. A downgrade on EITHER axis is a downgrade
// — raising the other axis is never a licence to lower this one (e.g. confidential/TLP:AMBER ->
// restricted/TLP:GREEN raises classification but lowers TLP, and MUST still be rejected).
const CLASS_RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };
const TLP_RANK = { 'TLP:CLEAR': 0, 'TLP:GREEN': 1, 'TLP:AMBER': 2, 'TLP:AMBER+STRICT': 3, 'TLP:RED': 4 };
const markRank = (m) => (m ? { c: CLASS_RANK[m.classification], t: TLP_RANK[m.tlp] } : null);
const isDowngrade = (from, to) => {
  const a = markRank(from), b = markRank(to);
  if (!a || !b || [a.c, a.t, b.c, b.t].some((x) => x === undefined)) return false;
  return b.c < a.c || b.t < a.t; // either axis lowered = downgrade, regardless of the other axis
};
const posEvidenceHigh = fixtures['positive/evidence.tool-result.json']; // confidential/TLP:AMBER, the union max
const mdFix = fixtures['negative-semantic/investigation-bundle.marking-downgrade.json'];
H('TR-1a', !!mdFix && !!posEvidenceHigh && isDowngrade(posEvidenceHigh.data_marking, mdFix.data_marking),
  'marking-downgrade fixture must mark itself strictly below the referenced evidence marking (the downgrade the platform MUST reject)');
const posBundle = fixtures['positive/investigation-bundle.json'];
H('TR-1b', !!posBundle && !!posEvidenceHigh && !isDowngrade(posEvidenceHigh.data_marking, posBundle.data_marking),
  'positive bundle must NOT downgrade the referenced evidence marking (rule is not vacuous)');
// Regression: a mixed-axis change (classification UP, TLP DOWN) MUST still be caught. This is the
// exact shape the previous ((b.c<a.c||b.t<a.t)&&b.c<=a.c&&b.t<=a.t) formulation missed, because
// b.c<=a.c was false (classification rose) even though TLP strictly fell.
const mdMixedFix = fixtures['negative-semantic/investigation-bundle.marking-downgrade-mixed-axis.json'];
H('TR-1c', !!mdMixedFix && !!posEvidenceHigh
  && mdMixedFix.data_marking?.classification === 'restricted' && posEvidenceHigh.data_marking?.classification === 'confidential'
  && CLASS_RANK[mdMixedFix.data_marking?.classification] > CLASS_RANK[posEvidenceHigh.data_marking?.classification]
  && isDowngrade(posEvidenceHigh.data_marking, mdMixedFix.data_marking),
  'marking-downgrade-mixed-axis fixture must raise classification while lowering TLP relative to the referenced evidence marking, and MUST still be flagged as a downgrade on the TLP axis alone');

// TR-2 CROSS-TENANT GUARD: a claim's/evidence's tenant_id must equal its investigation's
// authoritative tenant.
const posInvestigation = fixtures['positive/investigation.json'];
const ctFix = fixtures['negative-semantic/claim.cross-tenant.json'];
H('TR-2a', !!ctFix && !!posInvestigation && ctFix.investigation_id === posInvestigation.investigation_id && ctFix.tenant_id !== posInvestigation.tenant_id,
  'claim cross-tenant fixture must reference the positive investigation while carrying a different tenant_id (the mismatch the platform MUST reject)');
const posClaim = fixtures['positive/claim.asserted.json'];
H('TR-2b', !!posClaim && !!posInvestigation && posClaim.tenant_id === posInvestigation.tenant_id, 'positive claim tenant_id must equal its investigation tenant_id (rule is not vacuous)');
const ctEvFix = fixtures['negative-semantic/evidence.cross-tenant.json'];
H('TR-2c', !!ctEvFix && !!posInvestigation && ctEvFix.investigation_id === posInvestigation.investigation_id && ctEvFix.tenant_id !== posInvestigation.tenant_id,
  'evidence cross-tenant fixture must reference the positive investigation while carrying a different tenant_id (the mismatch the platform MUST reject)');
const posEvidenceLog = fixtures['positive/evidence.log-excerpt.json'];
H('TR-2d', !!posEvidenceLog && !!posInvestigation && posEvidenceLog.tenant_id === posInvestigation.tenant_id, 'positive evidence tenant_id must equal its investigation tenant_id (rule is not vacuous)');

// TR-3 CITATION DEREFERENCE: every evidence_refs digest must match a real evidence_digest WITHIN
// THE SAME INVESTIGATION — grounding is partitioned per-investigation, not a global digest pool.
// realEvidenceDigestsByInvestigation groups every evidence fixture's digest under its own
// investigation_id so a reused-but-foreign digest (real somewhere else) is distinguishable from a
// wholly fictional one.
const allEvidenceFixtures = [
  fixtures['positive/evidence.log-excerpt.json'],
  fixtures['positive/evidence.tool-result.json'],
  fixtures['positive/evidence.other-investigation.json'],
].filter(Boolean);
const realEvidenceDigestsByInvestigation = new Map(); // investigation_id -> Set(evidence_digest)
const allRealEvidenceDigests = new Set(); // every real evidence_digest, regardless of investigation
for (const e of allEvidenceFixtures) {
  if (!realEvidenceDigestsByInvestigation.has(e.investigation_id)) realEvidenceDigestsByInvestigation.set(e.investigation_id, new Set());
  realEvidenceDigestsByInvestigation.get(e.investigation_id).add(e.evidence_digest);
  allRealEvidenceDigests.add(e.evidence_digest);
}
const groundedInOwnInvestigation = (claim) => {
  const scoped = realEvidenceDigestsByInvestigation.get(claim?.investigation_id) || new Set();
  return (claim?.evidence_refs || []).every((r) => scoped.has(r.digest));
};
const ucFix = fixtures['negative-semantic/claim.ungrounded-citation.json'];
H('TR-3a', !!ucFix && (ucFix.evidence_refs || []).length > 0 && ucFix.evidence_refs.every((r) => !allRealEvidenceDigests.has(r.digest)),
  'ungrounded-citation fixture must cite a digest matching no real evidence_digest anywhere (a wholly fictional reference) — the ungrounded claim the platform MUST reject');
H('TR-3b', !!posClaim && (posClaim.evidence_refs || []).length > 0 && groundedInOwnInvestigation(posClaim),
  'positive claim evidence_refs must all be grounded in a real evidence_digest within its OWN investigation (rule is not vacuous)');
// Regression: investigation partition. The cross-investigation fixture cites a digest that IS a
// real evidence_digest (positive/evidence.other-investigation.json), just under a DIFFERENT
// investigation_id than the citing claim. This must be caught by the same TR-3 rule as a wholly
// fictional digest — grounding does not leak across investigation boundaries.
const cicFix = fixtures['negative-semantic/claim.cross-investigation-citation.json'];
const otherInvEvidence = fixtures['positive/evidence.other-investigation.json'];
H('TR-3c', !!cicFix && !!otherInvEvidence && cicFix.investigation_id !== otherInvEvidence.investigation_id
  && (cicFix.evidence_refs || []).some((r) => r.digest === otherInvEvidence.evidence_digest)
  && !groundedInOwnInvestigation(cicFix),
  'cross-investigation-citation fixture must cite a digest that is REAL (belongs to positive/evidence.other-investigation.json) but under a DIFFERENT investigation_id than the claim — the platform MUST reject grounding that leaks across investigations, not just wholly fictional digests');
H('TR-3d', !!otherInvEvidence && (allRealEvidenceDigests.has(otherInvEvidence.evidence_digest)) && otherInvEvidence.investigation_id !== posClaim?.investigation_id,
  'the evidence cited by the cross-investigation-citation fixture must itself be a genuine, schema-valid evidence entry (proving TR-3c exercises a real-digest/wrong-partition case, not a degenerate fictional one)');

// TR-3 (bundle-level partition). The SAME grounding-does-not-leak-across-investigations rule
// applies to investigation-bundle.claims[]/evidence[], not just claim.evidence_refs. Build a
// claim_digest -> investigation_id index the same way realEvidenceDigestsByInvestigation indexes
// evidence, then require every member a bundle references to be REAL *and* scoped to the bundle's
// own investigation_id.
const allClaimFixtures = [
  fixtures['positive/claim.asserted.json'],
  fixtures['positive/claim.abstained.json'],
  fixtures['positive/claim.other-investigation.json'],
].filter(Boolean);
const realClaimDigestsByInvestigation = new Map(); // investigation_id -> Set(claim_digest)
const allRealClaimDigests = new Set(); // every real claim_digest, regardless of investigation
for (const c of allClaimFixtures) {
  if (!realClaimDigestsByInvestigation.has(c.investigation_id)) realClaimDigestsByInvestigation.set(c.investigation_id, new Set());
  realClaimDigestsByInvestigation.get(c.investigation_id).add(c.claim_digest);
  allRealClaimDigests.add(c.claim_digest);
}
const bundleGroundedInOwnInvestigation = (bundle) => {
  const scopedClaims = realClaimDigestsByInvestigation.get(bundle?.investigation_id) || new Set();
  const scopedEvidence = realEvidenceDigestsByInvestigation.get(bundle?.investigation_id) || new Set();
  return (bundle?.claims || []).every((r) => scopedClaims.has(r.digest))
    && (bundle?.evidence || []).every((r) => scopedEvidence.has(r.digest));
};
H('TR-3e', !!posBundle && bundleGroundedInOwnInvestigation(posBundle),
  'positive bundle claims[]/evidence[] must all be grounded in real claim/evidence digests within its OWN investigation (rule is not vacuous)');
const cimFix = fixtures['negative-semantic/investigation-bundle.cross-investigation-members.json'];
const otherInvClaim = fixtures['positive/claim.other-investigation.json'];
H('TR-3f', !!cimFix && !!otherInvClaim && cimFix.investigation_id !== otherInvClaim.investigation_id
  && (cimFix.claims || []).some((r) => r.digest === otherInvClaim.claim_digest),
  'cross-investigation-members fixture must include a claims[] entry whose digest is the REAL claim_digest of positive/claim.other-investigation.json, which belongs to a DIFFERENT investigation_id than the bundle');
H('TR-3g', !!cimFix && !!otherInvEvidence && cimFix.investigation_id !== otherInvEvidence.investigation_id
  && (cimFix.evidence || []).some((r) => r.digest === otherInvEvidence.evidence_digest),
  'cross-investigation-members fixture must include an evidence[] entry whose digest is the REAL evidence_digest of positive/evidence.other-investigation.json, which belongs to a DIFFERENT investigation_id than the bundle');
H('TR-3h', !!cimFix && !bundleGroundedInOwnInvestigation(cimFix),
  'cross-investigation-members fixture must fail bundle-level own-investigation grounding — real members reused from a foreign investigation MUST be rejected by the same partition rule as claim.evidence_refs (TR-3c), not accepted just because the digests themselves are genuine');

// TR-4 LIFECYCLE ORDERING: evidence/claims must not be attached to an investigation after it closed.
const posInvestigationClosed = fixtures['positive/investigation.closed.json'];
const acFix = fixtures['negative-semantic/evidence.collected-after-close.json'];
H('TR-4a', !!acFix && !!posInvestigationClosed && acFix.investigation_id === posInvestigationClosed.investigation_id
  && new Date(acFix.collected_at).getTime() > new Date(posInvestigationClosed.closed_at).getTime(),
  'collected-after-close fixture must reference the closed positive investigation with collected_at after its closed_at (the ordering violation the platform MUST reject)');
H('TR-4b', !!posEvidenceLog && !!posInvestigation
  && new Date(posEvidenceLog.collected_at).getTime() >= new Date(posInvestigation.opened_at).getTime(),
  'positive evidence must be collected on/after its investigation opened_at (rule is not vacuous)');
const cacFix = fixtures['negative-semantic/claim.created-after-close.json'];
H('TR-4c', !!cacFix && !!posInvestigationClosed && cacFix.investigation_id === posInvestigationClosed.investigation_id
  && new Date(cacFix.created_at).getTime() > new Date(posInvestigationClosed.closed_at).getTime(),
  'created-after-close fixture must reference the closed positive investigation with created_at after its closed_at (the ordering violation the platform MUST reject)');
H('TR-4d', !!posClaim && !!posInvestigation
  && new Date(posClaim.created_at).getTime() >= new Date(posInvestigation.opened_at).getTime(),
  'positive claim must be created on/after its investigation opened_at (rule is not vacuous)');

// CROSS-REF INTEGRITY (positive lifecycle correlation the platform MUST preserve).
H('XR-a', !!posClaim && !!posInvestigation && posClaim.investigation_id === posInvestigation.investigation_id, 'positive claim/investigation must share investigation_id');
H('XR-b', !!posBundle && !!posInvestigation && posBundle.investigation_id === posInvestigation.investigation_id, 'positive bundle/investigation must share investigation_id');
H('XR-c', !!posBundle && (posBundle.claims || []).some((c) => c.digest === posClaim?.claim_digest), 'positive bundle.claims must reference the positive claim by its claim_digest');
H('XR-d', !!posBundle && (posBundle.evidence || []).some((e) => e.digest === posEvidenceLog?.evidence_digest), 'positive bundle.evidence must reference the positive evidence by its evidence_digest');

// ---------------------------------------------------------------------------
// TR-5 (DECLARED, NOT FIXTURE-VERIFIABLE) — DERIVED from the manifest, not hardcoded. Unlike
// TR-1..TR-4 above — each backed by an H() assertion proving a concrete fixture violates (or
// satisfies) the rule — every entry in trust_invariants.runtime_only_declared_not_fixture_verifiable
// constrains a DOWNSTREAM CONSUMER's behavior, not this payload's shape or the relationship
// between two payloads. No JSON fixture, however constructed, can prove or disprove what a
// not-yet-written piece of consumer code does with a field it reads. Adding an H() call here that
// merely re-asserts the manifest's own English-language claim about itself would be a FALSE
// static gate — it would always pass and would prove nothing.
//
// declaredRuntimeOnlyFromManifest (built in step 3 via deriveDeclaredRuntimeOnly — the single
// source of truth, self-checked above) IS what gets reported/counted below: add, remove, or
// rename an entry in the manifest and this list changes with it. A duplicate id, a missing
// field, or a wrong validator_status is already a `fail()` in step 3 (so it cannot slip through
// as a silent green); what remains here is a REGRESSION check that today's set is still exactly
// {'TR-5'} — plain `fail()`, not H(), so it stays OUT of invariants_checked/invariants_ok exactly
// like every declared item must. If this legitimately changes (a new declared-only invariant is
// added, or TR-5 is renamed/removed), update this assertion — and the accompanying docs —
// deliberately, in the same change.
// ---------------------------------------------------------------------------
if (declaredRuntimeOnlyFromManifest.length !== 1 || declaredRuntimeOnlyFromManifest[0]?.id !== 'TR-5') {
  fail(`investigation manifest: runtime_only_declared_not_fixture_verifiable must currently contain exactly one entry, 'TR-5' (got ${JSON.stringify(declaredRuntimeOnlyFromManifest.map((d) => d.id))}) — update this regression check deliberately if the declared-only set legitimately changed`);
}
const declaredRuntimeOnly = declaredRuntimeOnlyFromManifest;
for (const _d of declaredRuntimeOnly) bump('declared_runtime_only_invariants');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('=== W0-I01 investigation packet — JSON Schema / fixtures / trust-invariant validation ===');
console.log('counts:', JSON.stringify(counts));
if (declaredRuntimeOnly.length) {
  console.log('\nDECLARED runtime-only (NOT fixture-verified by this validator — see compatibility manifest trust_invariants.runtime_only_declared_not_fixture_verifiable):');
  for (const d of declaredRuntimeOnly) console.log(`  - ${d.id}: declared_runtime_only`);
}
if (errors.length) {
  console.error(`\nFAIL — ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`\nOK — investigation packet passes JSON Schema 2020-12 compile/ref-resolution, all fixtures, and every FIXTURE-EXERCISED trust invariant (TI-1..TI-7 structural, TR-1..TR-4 runtime-only; lifecycle: ${EXPECTED_STATE || 'UNKNOWN'} at v${EXPECTED_VERSION}). TR-5 is declared_runtime_only, NOT verified by this validator — see above.`);
