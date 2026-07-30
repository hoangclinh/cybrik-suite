// validate-svc.mjs — W2-F internal service-delegation + workload-identity packet validator.
//
// Scope: the W2-F service-delegation packet ONLY (its whole-packet lifecycle is
// ACCEPTED FOR IMPLEMENTATION at v0.1.0, per the compatibility manifest as the single source of
// truth). It is ADDITIVE to, and DISJOINT from, the accepted v0.1 cross-product packet (validated
// by validate-schemas.mjs) and the ACCEPTED W2-D inference packet (validate-inference.mjs); this
// file touches neither. Here we:
//   (1) load the accepted base primitives (common-defs, data-marking) UNMODIFIED so the svc
//       schemas' cross-file $refs resolve, then compile every svc schema — a dangling
//       $ref/$defs fragment throws at compile time;
//   (2) drive the positive / negative-schema / negative-semantic fixtures from the svc
//       examples-manifest (positive MUST validate; negative-schema MUST fail; negative-semantic
//       MUST be structurally valid — only a runtime trust invariant, evaluated against the fixed
//       test clock, rejects it);
//   (3) assert the delegation trust invariants (SI-1..SI-9 structural, SR-1..SR-8 runtime) as
//       brittle-on-purpose checks so a regression that relaxes any of them fails here —
//       asymmetric-only signing, explicit typing, replay key, sender-constrained cnf, complete
//       claim set, single strict audience, no static bearer / forwarded user token, hard short-TTL
//       ceiling; time window, short-TTL, audience, cross-tenant, org-scope, operation binding,
//       marking non-escalation, jti replay;
//   (4) assert manifest / examples-manifest lifecycle + integrity consistency: every member
//       agrees with the manifest's single lifecycle state, the accepted base is reused unmodified,
//       the packet declares NO server/endpoint and NO MCP/tool authority, and it is never a bundle
//       tag / GA.
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
// 0. Lifecycle state. The compatibility manifest is the single source of truth. Exactly TWO
//    truthful whole-packet states are permitted at v0.1.0 (PROPOSED | ACCEPTED FOR
//    IMPLEMENTATION); neither is a stable v1/GA and neither is an immutable bundle tag. Every
//    packet member MUST agree with the manifest — a half-flipped packet is a consistency failure.
// ---------------------------------------------------------------------------
const LIFECYCLE = {
  'PROPOSED': { status: 'PROPOSED', notAccepted: true },
  'ACCEPTED FOR IMPLEMENTATION': { status: 'ACCEPTED FOR IMPLEMENTATION', notAccepted: false },
};
const COMPAT_PATH = join(CONTRACTS, 'compatibility', 'cybrik-suite-svc-delegation-packet.v1.manifest.json');
let compat = null;
try { compat = readJson(COMPAT_PATH); } catch (e) { fail(`svc compatibility manifest: cannot read: ${e.message}`); }
let EXPECTED_STATE = null;
if (compat) {
  const s = compat['x-cybrik-status'];
  if (LIFECYCLE[s]) EXPECTED_STATE = s;
  else fail(`svc compatibility manifest: x-cybrik-status must be one of ${Object.keys(LIFECYCLE).map((k) => `'${k}'`).join(' | ')} at v${EXPECTED_VERSION} (got '${s}')`);
}
const LC = EXPECTED_STATE ? LIFECYCLE[EXPECTED_STATE] : null;
const checkLifecycle = (label, obj) => {
  if (!LC || !obj) return;
  if (obj['x-cybrik-status'] !== LC.status) fail(`${label}: x-cybrik-status must be '${LC.status}' to match the manifest lifecycle (got '${obj['x-cybrik-status']}')`);
  if (obj['x-cybrik-not-accepted'] !== LC.notAccepted) fail(`${label}: x-cybrik-not-accepted must be ${LC.notAccepted} to match the manifest lifecycle`);
};

// ---------------------------------------------------------------------------
// 1. Load schemas. Accepted base primitives are added UNMODIFIED (no lifecycle flip, no
//    re-version) purely so cross-file $refs resolve; the svc schemas are the ones this packet
//    owns and this validator gates.
// ---------------------------------------------------------------------------
const BASE_PRIMITIVES = [
  'cybrik.common-defs.v1.schema.json',
  'cybrik.data-marking.v1.schema.json',
];
// svc-common-defs is shared primitives (no direct fixture); the other three are fixture-bearing.
const SVC_SCHEMAS = [
  'cybrik.svc-common-defs.v1.schema.json',
  'cybrik.svc-delegation-token.v1.schema.json',
  'cybrik.svc-delegation-request.v1.schema.json',
  'cybrik.svc-trust-metadata.v1.schema.json',
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
    // packet (backward-compat guard — the svc packet may never flip a base member).
    if (doc['x-cybrik-status'] !== 'ACCEPTED FOR IMPLEMENTATION') fail(`base primitive json-schema/${name}: must stay ACCEPTED FOR IMPLEMENTATION (svc packet must not modify it)`);
    if (doc['x-cybrik-not-accepted'] !== false) fail(`base primitive json-schema/${name}: x-cybrik-not-accepted must stay false`);
  } else {
    checkLifecycle(`json-schema/${name}`, doc);
    if (doc['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`json-schema/${name}: contract-version must be ${EXPECTED_VERSION}`);
    bump('svc_schemas_loaded');
  }
};
for (const n of BASE_PRIMITIVES) loadSchema(n, { base: true });
for (const n of SVC_SCHEMAS) loadSchema(n, { base: false });

// Register all before compiling so cross-file $refs resolve against $id.
for (const [name, { doc }] of Object.entries(schemas)) {
  try { ajv.addSchema(doc); } catch (e) { fail(`json-schema/${name}: addSchema failed: ${e.message}`); }
}

// Compile each svc schema — this resolves every local + cross-file $ref/$defs fragment (including
// refs into the accepted base primitives). A dangling ref throws here.
const validators = {}; // basename -> validate fn
for (const name of SVC_SCHEMAS) {
  const d = schemas[name]?.doc;
  if (!d?.$id) continue;
  try {
    validators[name] = ajv.getSchema(d.$id) || ajv.compile(d);
    bump('svc_schemas_compiled');
  } catch (e) {
    fail(`json-schema/${name}: compile/ref-resolution failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Example fixtures, driven by examples/svc/examples-manifest.json.
//    positive -> MUST validate; negative-schema -> MUST fail; negative-semantic -> MUST validate.
//    A fixed test reference clock makes the time/replay/mismatch invariants deterministic.
// ---------------------------------------------------------------------------
const EXAMPLES_DIR = join(CONTRACTS, 'examples', 'svc');
const exManifestPath = join(EXAMPLES_DIR, 'examples-manifest.json');
let exManifest;
try { exManifest = readJson(exManifestPath); } catch (e) { fail(`svc examples-manifest.json: parse error: ${e.message}`); }

let NOW = null;
const fixtures = {}; // file -> parsed data (for cross-fixture semantic assertions)
if (exManifest) {
  checkLifecycle('svc examples-manifest', exManifest);
  if (exManifest['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`svc examples-manifest: x-cybrik-contract-version must be ${EXPECTED_VERSION}`);
  NOW = exManifest.test_reference_clock_epoch_seconds;
  if (!Number.isInteger(NOW)) fail('svc examples-manifest: test_reference_clock_epoch_seconds must be an integer (drives the deterministic runtime-invariant checks)');
  for (const ex of exManifest.examples || []) {
    const exPath = join(EXAMPLES_DIR, ex.file);
    if (!existsSync(exPath)) { fail(`example missing on disk: examples/svc/${ex.file}`); continue; }
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
// 3. Compatibility / version / status manifest for the svc packet.
// ---------------------------------------------------------------------------
if (compat) {
  checkLifecycle('svc compatibility manifest', compat);
  if (compat['x-cybrik-packet-version'] !== EXPECTED_VERSION) fail(`svc manifest: packet-version must be ${EXPECTED_VERSION}`);
  if (compat['x-cybrik-is-bundle-tag'] !== false) fail('svc manifest: is-bundle-tag must be false (v0.1.0 is never an immutable bundle tag / GA)');
  const pins = compat.format_pins || {};
  if (pins.jsonSchema !== '2020-12') fail('svc manifest: jsonSchema pin must be 2020-12');
  if (pins.openApi !== '3.1.x') fail('svc manifest: openApi pin must be 3.1.x');
  if (pins.asyncApi !== '3.0.0') fail('svc manifest: asyncApi pin must be 3.0.0');
  // NO SERVER / NO MCP: this packet declares no wire endpoint and grants no tool authority.
  if (!/NO SERVER|NO ENDPOINT/i.test(compat.wire_scope || '')) fail('svc manifest: wire_scope must declare NO SERVER / NO ENDPOINT (this packet declares no operational endpoint)');
  if (!/OUT OF SCOPE/i.test(compat.mcp_scope || '')) fail('svc manifest: mcp_scope must declare MCP OUT OF SCOPE (no tool/agent authority)');
  const acc = compat.acceptance?.status || '';
  const gateStatus = compat.gate?.status || '';
  if (compat.gate?.id !== 'W2-F') fail("svc manifest: gate.id must be 'W2-F'");
  if (EXPECTED_STATE === 'PROPOSED') {
    if (!/NOT ACCEPTED/.test(acc)) fail('svc manifest: acceptance.status must state NOT ACCEPTED while PROPOSED');
    if (!/NOT OPENED|awaiting/i.test(gateStatus)) fail('svc manifest: gate.status must record that Gate W2-F is not yet decided while PROPOSED');
  } else {
    if (!/ACCEPTED FOR IMPLEMENTATION/.test(acc)) fail('svc manifest: acceptance.status must state ACCEPTED FOR IMPLEMENTATION');
    if (/\bNOT ACCEPTED\b/.test(acc)) fail('svc manifest: acceptance.status must not still say NOT ACCEPTED once accepted');
    const a = compat.acceptance || {};
    if (!a.gate) fail('svc manifest: accepted packet must record acceptance.gate');
    if (!a.decided_by) fail('svc manifest: accepted packet must record acceptance.decided_by (Founder-delegated; not agent-inferred)');
    if (!a.decided_on) fail('svc manifest: accepted packet must record acceptance.decided_on');
    if (!Array.isArray(a.evidence) || a.evidence.length === 0) fail('svc manifest: accepted packet must record acceptance.evidence[]');
    if (/NOT OPENED|awaiting/i.test(gateStatus)) fail('svc manifest: gate.status must record the Gate W2-F decision once accepted');
  }
  // Disjointness from the accepted tool-execution packet (ADR-0004) and from the unapplied
  // org-hierarchy delta (ADR-0007) is a load-bearing security stance.
  const oos = (compat.adr_out_of_scope || []).map((x) => x.id);
  if (!oos.includes('ADR-0004')) fail('svc manifest: ADR-0004 (tool execution authority) MUST be declared out of scope (application-delegation ≠ tool-grant chain)');
  if (!oos.includes('ADR-0007')) fail('svc manifest: ADR-0007 (org-hierarchy delta / A05 external boundary) MUST be declared out of scope (org_scope advisory-only; external boundary kept distinct)');
  if (compat.backward_compatibility?.modifies_accepted_v0_1 !== false) fail('svc manifest: backward_compatibility.modifies_accepted_v0_1 must be false');
  // Every reused accepted primitive must exist on disk and NOT be a member of this packet.
  const memberFiles = new Set((compat.members || []).map((m) => m.file));
  for (const rf of compat.reuses_accepted_unmodified?.members || []) {
    if (!existsSync(join(CONTRACTS, rf))) fail(`svc manifest: reused accepted member missing on disk: ${rf}`);
    if (memberFiles.has(rf)) fail(`svc manifest: reused accepted member ${rf} must NOT also be declared a packet member`);
    bump('reused_accepted_members');
  }
  // Every declared member exists on disk at contract_version 0.1.0.
  for (const m of compat.members || []) {
    const mp = join(CONTRACTS, m.file);
    if (!existsSync(mp)) fail(`svc manifest: member file missing: ${m.file}`);
    if (m.contract_version !== EXPECTED_VERSION) fail(`svc manifest: member ${m.file} contract_version must be ${EXPECTED_VERSION}`);
    bump('manifest_members');
  }
  // Trust-invariant catalog must be present (structural + runtime) so the stance is documented.
  if (!Array.isArray(compat.trust_invariants?.structural) || compat.trust_invariants.structural.length === 0) fail('svc manifest: trust_invariants.structural missing/empty');
  if (!Array.isArray(compat.trust_invariants?.runtime_only) || compat.trust_invariants.runtime_only.length === 0) fail('svc manifest: trust_invariants.runtime_only missing/empty');
}

// ---------------------------------------------------------------------------
// 4. Trust invariants as brittle-on-purpose assertions. A regression that relaxes any of these
//    fails CI here. Structural ones (SI-*) are also EXERCISED by fixtures; runtime ones (SR-*)
//    are proven against the negative-semantic fixtures + the fixed test clock.
// ---------------------------------------------------------------------------
const doc = (n) => schemas[n]?.doc;
const req = (o) => (o && Array.isArray(o.required)) ? o.required : [];
const props = (o) => (o && o.properties) ? o.properties : {};
const H = (id, cond, msg) => { bump('invariants_checked'); if (cond) bump('invariants_ok'); else fail(`INVARIANT#${id}: ${msg}`); };

const svcCommon = doc('cybrik.svc-common-defs.v1.schema.json');
const tokenSchema = doc('cybrik.svc-delegation-token.v1.schema.json');
const reqSchema = doc('cybrik.svc-delegation-request.v1.schema.json');
const trustSchema = doc('cybrik.svc-trust-metadata.v1.schema.json');

const defs = svcCommon?.$defs || {};
const headerProps = props(tokenSchema?.properties?.header);
const claimsSchema = tokenSchema?.properties?.claims;
const claimsProps = props(claimsSchema);

// SI-1 ASYMMETRIC-ONLY signing. jwtAlg enum excludes every HS* symmetric alg and 'none'.
const algEnum = defs.jwtAlg?.enum || [];
H('SI-1a', algEnum.length > 0 && !algEnum.some((a) => /^HS/i.test(a)) && !algEnum.includes('none'),
  'jwtAlg enum must be asymmetric-only (no HS* symmetric, no unsecured none)');
H('SI-1b', /jwtAlg$/.test(headerProps.alg?.$ref || ''), 'token header.alg must $ref the asymmetric-only jwtAlg def');
H('SI-1c', /jwtAlg$/.test(trustSchema?.properties?.accepted_algs?.items?.$ref || ''), 'trust-metadata accepted_algs items must $ref jwtAlg (asymmetric-only allow-list)');

// SI-2 EXPLICIT TYPING. header.typ is const 'at+jwt' (RFC 9068 §2.1).
H('SI-2', headerProps.typ?.const === 'at+jwt', "token header.typ must be const 'at+jwt'");

// SI-3 REPLAY KEY REQUIRED. claims.jti required; jti minLength 16.
H('SI-3a', req(claimsSchema).includes('jti'), 'token claims.jti must be required');
H('SI-3b', defs.jti?.minLength === 16, 'jti minLength must be 16 (unguessable anti-replay id)');

// SI-4 SENDER-CONSTRAINED. claims.cnf required; certThumbprint is a 43-char base64url SHA-256.
H('SI-4a', req(claimsSchema).includes('cnf'), 'token claims.cnf must be required (certificate-bound; no bearer)');
H('SI-4b', defs.certThumbprint?.pattern === '^[A-Za-z0-9_-]{43}$', 'certThumbprint must be a 43-char base64url SHA-256 thumbprint');
H('SI-4c', (defs.cnfConfirmation?.required || []).includes('x5t#S256'), "cnfConfirmation must require 'x5t#S256'");

// SI-5 COMPLETE AUTHORIZATION CLAIM SET.
const NEED_CLAIMS = ['iss', 'sub', 'aud', 'iat', 'nbf', 'exp', 'jti', 'cnf', 'scope',
  'cybrik.tenant_id', 'cybrik.actor', 'cybrik.operation', 'cybrik.marking'];
H('SI-5', NEED_CLAIMS.every((c) => req(claimsSchema).includes(c)),
  `token claims must require the complete set: ${NEED_CLAIMS.join(', ')}`);

// SI-6 SINGLE STRICT AUDIENCE. audienceId is a single string (not an array).
H('SI-6', defs.audienceId?.type === 'string' && /audienceId$/.test(claimsProps.aud?.$ref || ''),
  'aud must be a single audienceId string (not an array) for strict confused-deputy defense');

// SI-7 / SI-8 NO STATIC BEARER / NO FORWARDED USER TOKEN. request + claims are
// additionalProperties:false, so a static bearer or forwarded end-user token has nowhere to live.
H('SI-7', reqSchema?.additionalProperties === false, 'svc-delegation-request must be additionalProperties:false (no inline static bearer)');
H('SI-8', claimsSchema?.additionalProperties === false, 'token claims must be additionalProperties:false (no smuggled forwarded-user/injected authority claim)');

// SI-9 HARD SHORT-TTL CEILING + fail-closed defaults are const, not configurable open.
H('SI-9a', trustSchema?.properties?.max_token_ttl_seconds?.const === 120, 'trust-metadata max_token_ttl_seconds must be const 120');
H('SI-9b', trustSchema?.properties?.require_cnf?.const === true, 'trust-metadata require_cnf must be const true');
H('SI-9c', trustSchema?.properties?.require_mtls?.const === true, 'trust-metadata require_mtls must be const true');
H('SI-9d', trustSchema?.properties?.accepted_issuers?.minItems === 1, 'trust-metadata accepted_issuers must be minItems 1 (an empty issuer set trusts nothing)');

// ---- Prove each negative-schema fixture actually carries the offending shape, so the schema
//      rejection is genuinely exercised (not a vacuous pass). ----
const nsFix = (f) => fixtures[`negative/${f}`];
const claimsOf = (fx) => fx?.claims || fx?.presented_token?.claims;
const headerOf = (fx) => fx?.header || fx?.presented_token?.header;

H('SI-3x', !!nsFix('svc-delegation-token.missing-jti.json') && !('jti' in (claimsOf(nsFix('svc-delegation-token.missing-jti.json')) || {})),
  'missing-jti fixture must omit claims.jti so the required-jti rejection is exercised');
H('SI-4x', !!nsFix('svc-delegation-token.missing-cnf.json') && !('cnf' in (claimsOf(nsFix('svc-delegation-token.missing-cnf.json')) || {})),
  'missing-cnf fixture must omit claims.cnf so the required-cnf rejection is exercised');
H('SI-4y', (claimsOf(nsFix('svc-delegation-token.wrong-cnf.json'))?.cnf?.['x5t#S256'] || '').length !== 43,
  'wrong-cnf fixture must carry a non-43-char thumbprint so the pattern rejection is exercised');
H('SI-1x', headerOf(nsFix('svc-delegation-token.symmetric-alg.json'))?.alg === 'HS256',
  "symmetric-alg fixture must set header.alg='HS256' so the asymmetric-only enum rejection is exercised");
H('SI-1y', headerOf(nsFix('svc-delegation-token.alg-none.json'))?.alg === 'none',
  "alg-none fixture must set header.alg='none' so the unsecured-token rejection is exercised");
H('SI-7x', !!nsFix('svc-delegation-request.static-bearer.json') && 'authorization' in nsFix('svc-delegation-request.static-bearer.json'),
  "static-bearer fixture must carry an 'authorization' field so the additionalProperties:false rejection is exercised");
H('SI-8x', !!nsFix('svc-delegation-request.forwarded-user-token.json') && 'on_behalf_of_user_token' in nsFix('svc-delegation-request.forwarded-user-token.json'),
  "forwarded-user-token fixture must carry an 'on_behalf_of_user_token' field so the additionalProperties:false rejection is exercised");

// ---- Runtime invariants (SR-*): negative-semantic fixtures are structurally valid but MUST be
//      rejected by a relying-party invariant a schema alone cannot express. Prove each fixture
//      actually VIOLATES its invariant against the fixed clock, and that the positive fixtures
//      SATISFY it (so the rules are not vacuous). ----
const CLASS_RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };
const TLP_RANK = { 'TLP:CLEAR': 0, 'TLP:GREEN': 1, 'TLP:AMBER': 2, 'TLP:AMBER+STRICT': 3, 'TLP:RED': 4 };
const markRank = (m) => (m ? { c: CLASS_RANK[m.classification], t: TLP_RANK[m.tlp] } : null);
const isAbove = (a, b) => { // a exceeds b on at least one lattice axis (marking escalation)
  const x = markRank(a), y = markRank(b);
  if (!x || !y || [x.c, x.t, y.c, y.t].some((v) => v === undefined)) return false;
  return x.c > y.c || x.t > y.t;
};
const semFix = (f) => fixtures[`negative/${f}`];
const posToken = fixtures['positive/svc-delegation-token.json'];
const posReq = fixtures['positive/svc-delegation-request.json'];
const posTrust = fixtures['positive/svc-trust-metadata.json'];

if (Number.isInteger(NOW)) {
  // SR-1 TIME WINDOW: expired token exp < NOW; future token nbf > NOW.
  const expFix = semFix('svc-delegation-token.expired.json');
  H('SR-1a', !!expFix && expFix.claims.exp < NOW, 'expired fixture must have claims.exp < test clock NOW (the expired token the relying party MUST reject)');
  const futFix = semFix('svc-delegation-token.future.json');
  H('SR-1b', !!futFix && futFix.claims.nbf > NOW, 'future fixture must have claims.nbf > test clock NOW (the not-yet-valid token the relying party MUST reject)');
  H('SR-1c', !!posToken && posToken.claims.nbf <= NOW && NOW <= posToken.claims.exp, 'positive token must be within its nbf..exp window at NOW (rule is not vacuous)');

  // SR-2 SHORT TTL: over-ttl token exp - iat > 120; positive token <= 120.
  const ttlFix = semFix('svc-delegation-token.over-ttl.json');
  H('SR-2a', !!ttlFix && (ttlFix.claims.exp - ttlFix.claims.iat) > 120, 'over-ttl fixture must have exp - iat > 120s (exceeds the hard ceiling the relying party MUST reject)');
  H('SR-2b', !!posToken && (posToken.claims.exp - posToken.claims.iat) <= 120, 'positive token exp - iat must be <= 120s (rule is not vacuous)');
}

// SR-3 AUDIENCE: token.aud != relying_party.audience.
const waFix = semFix('svc-delegation-request.wrong-audience.json');
H('SR-3a', !!waFix && waFix.presented_token.claims.aud !== waFix.relying_party.audience,
  'wrong-audience fixture must have token.aud != relying_party.audience (confused-deputy the relying party MUST reject)');
H('SR-3b', !!posReq && posReq.presented_token.claims.aud === posReq.relying_party.audience,
  'positive request token.aud must equal relying_party.audience (rule is not vacuous)');
H('SR-3c', !!posReq && !!posTrust && posReq.presented_token.claims.aud === posTrust.self_audience,
  'positive request token.aud must equal trust-metadata.self_audience (audience restriction binding)');

// SR-4 CROSS-TENANT: body tenant_id != token cybrik.tenant_id.
const tmFix = semFix('svc-delegation-request.tenant-mismatch.json');
H('SR-4a', !!tmFix && tmFix.tenant_id !== tmFix.presented_token.claims['cybrik.tenant_id'],
  'tenant-mismatch fixture must have body tenant_id != token cybrik.tenant_id (the cross-tenant elevation the relying party MUST reject)');
H('SR-4b', !!posReq && posReq.tenant_id === posReq.presented_token.claims['cybrik.tenant_id'],
  'positive request body tenant_id must equal token cybrik.tenant_id (rule is not vacuous)');

// SR-5 ORG SCOPE: advisory body org_scope present but != token cybrik.org_scope.
const omFix = semFix('svc-delegation-request.org-mismatch.json');
H('SR-5a', !!omFix && omFix.org_scope !== undefined && omFix.org_scope !== omFix.presented_token.claims['cybrik.org_scope'],
  'org-mismatch fixture must have body org_scope != token cybrik.org_scope (advisory hint the relying party MUST reject on mismatch)');
H('SR-5b', !!posReq && posReq.org_scope === posReq.presented_token.claims['cybrik.org_scope'],
  'positive request body org_scope must equal token cybrik.org_scope (rule is not vacuous)');

// SR-6 OPERATION BINDING: body operation.name != token cybrik.operation.name.
const opFix = semFix('svc-delegation-request.operation-mismatch.json');
H('SR-6a', !!opFix && opFix.operation?.name !== opFix.presented_token.claims['cybrik.operation']?.name,
  'operation-mismatch fixture must have body operation.name != token cybrik.operation.name (confused-deputy the relying party MUST reject)');
H('SR-6b', !!posReq && posReq.operation?.name === posReq.presented_token.claims['cybrik.operation']?.name,
  'positive request body operation.name must equal token cybrik.operation.name (rule is not vacuous)');

// SR-7 MARKING NON-ESCALATION: body data_marking above token cybrik.marking on the lattice.
const meFix = semFix('svc-delegation-request.marking-escalation.json');
H('SR-7a', !!meFix && isAbove(meFix.data_marking, meFix.presented_token.claims['cybrik.marking']),
  'marking-escalation fixture must have body data_marking above token cybrik.marking (the escalation the relying party MUST reject)');
H('SR-7b', !!posReq && !isAbove(posReq.data_marking, posReq.presented_token.claims['cybrik.marking']),
  'positive request body data_marking must NOT be above token cybrik.marking (rule is not vacuous)');

// SR-8 REPLAY: the replay fixture reuses the positive request's jti (a second presentation the
// relying party's replay cache MUST reject; schema cannot track cross-request state).
const rpFix = semFix('svc-delegation-request.replay.json');
H('SR-8a', !!rpFix && !!posReq && rpFix.presented_token.claims.jti === posReq.presented_token.claims.jti,
  'replay fixture must reuse the positive request token jti (the second presentation the relying party MUST reject)');

// SR-9 PROOF-OF-POSSESSION (positive binding the relying party MUST preserve): mTLS peer
// thumbprint == token.cnf['x5t#S256'].
H('SR-9', !!posReq && posReq.relying_party.peer_cert_thumbprint === posReq.presented_token.claims.cnf['x5t#S256'],
  'positive request mTLS peer_cert_thumbprint must equal token.cnf x5t#S256 (proof-of-possession binding)');

// SR-10 ISSUER/KEY PINNING (positive binding): token.iss ∈ trust-metadata.accepted_issuers;
// token header.alg ∈ trust-metadata.accepted_algs.
H('SR-10a', !!posToken && !!posTrust && (posTrust.accepted_issuers || []).includes(posToken.claims.iss),
  'positive token iss must be in trust-metadata.accepted_issuers (issuer pinning binding)');
H('SR-10b', !!posToken && !!posTrust && (posTrust.accepted_algs || []).includes(posToken.header.alg),
  'positive token header.alg must be in trust-metadata.accepted_algs (algorithm allow-list binding)');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('=== W2-F service-delegation packet — JSON Schema / fixtures / trust-invariant validation ===');
console.log('counts:', JSON.stringify(counts));
if (errors.length) {
  console.error(`\nFAIL — ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`\nOK — svc-delegation packet passes JSON Schema 2020-12 compile/ref-resolution, all fixtures, and every trust invariant (lifecycle: ${EXPECTED_STATE || 'UNKNOWN'} at v${EXPECTED_VERSION}).`);
