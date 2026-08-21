// validate-transport.mjs — W2-I inference-plane transport-binding candidate validator.
//
// Scope: the W2-I transport-binding candidate ONLY. Under the recorded Founder decision (Option A,
// 2026-07-26) the candidate is NOT a packet of its own: it is a PROPOSED, UNAPPLIED DELTA against
// the ACCEPTED W2-D inference packet manifest, recorded in
// compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json. That delta is the single
// source of truth for the candidate lifecycle (PROPOSED — NOT ACCEPTED; Gate W2-I not decided). It
// is explicitly NOT a compatibility manifest (x-cybrik-is-manifest false) and this validator never
// treats it as one: it synthesizes no packet version, no bundle tag and no manifest lifecycle, and
// asserts those manifest-shaped fields ABSENT rather than faking them (section 3a). It is
// ADDITIVE to, and DISJOINT from, the accepted v0.1 cross-product packet (validate-schemas.mjs),
// the ACCEPTED W2-D inference packet (validate-inference.mjs), the ACCEPTED W2-F
// service-delegation packet (validate-svc.mjs) and the ACCEPTED W2-G org-hierarchy packet
// (validate-org.mjs); this file modifies none of them. It BINDS the W2-D provider-neutral
// inference REST plane to the W2-F two-layer mTLS + certificate-bound delegation seam (ADR-0008).
// Here we:
//   (1) load the accepted base primitives (common-defs, data-marking, svc-common-defs, and the
//       W2-F svc-delegation-token) UNMODIFIED so the transport schemas' cross-file $refs resolve,
//       then compile every transport schema — a dangling $ref/$defs fragment throws at compile
//       time;
//   (2) drive the positive / negative-schema / negative-semantic fixtures from the transport
//       examples-manifest (positive MUST validate; negative-schema MUST fail JSON Schema; a
//       negative-semantic fixture MUST be structurally valid — only a relying-party invariant,
//       evaluated against a fixed test clock + the canonical positive presentation, rejects it),
//       with the manifest treated as the CLOSED, DIGEST-PINNED inventory of the support fixtures:
//       every entry pins a SHA-256 of its fixture bytes, no entry is duplicated, and no fixture
//       sits on disk unindexed (unpinned bytes inside the candidate packet are rejected);
//   (3) assert the transport trust invariants — the STRUCTURAL TT-1..TT-9 (enforced by the JSON
//       Schemas, each PROVEN by a negative-schema fixture that actually carries the offending
//       shape, plus the TT-4 cases no on-disk fixture can express — an absent root idempotency_key
//       and an inconsistent method/policy pair — derived in memory and run through the compiled
//       schema) and the RUNTIME TX-1..TX-8 (the relying party MUST enforce; each PROVEN by the one
//       negative-semantic fixture that DECLARES it, which must reject on EXACTLY that rule and not
//       merely on something — every such fixture reuses the canonical jti + idempotency_key, so
//       truthiness alone would let TX-7 shadow TX-8 — with the positive presentations accepted so
//       no rule is vacuous);
//   (4) verify the PROPOSED delta: its artifact identity and self-denial (proposed-delta, not a
//       manifest, unapplied, granting no acceptance authority, and carrying none of the
//       manifest-shaped fields it declines to be), a single lifecycle state across every candidate
//       member, per-member SHA-256 integrity + on-disk paths + the digest-pinned examples manifest,
//       the upstream ACCEPTED W2-D pins (the byte-frozen predecessor manifest + OpenAPI must show
//       zero diff against the reviewed bytes), the single-owner ownership record (one CURRENT owner,
//       one PROPOSED successor, digests agreeing across both pin sites), the CLOSED operation
//       registry against the positive fixtures, the ADR basis (accepted ADR-0008 seam; candidate
//       ADR-0011 unaccepted), accepted base reused unmodified, NO server/secret/vendor and MCP OUT
//       OF SCOPE, disjoint from ADR-0004 tool authority, and the ABSENCE of the withdrawn
//       second-plane artifacts (a resurrected second plane would re-create a second owner of the
//       same paths, which is exactly what Option A refused), plus the ADR-0001 D6 guard that the
//       ACCEPTED W2-D manifest's OWN BYTES reference no candidate material — parsed independently of,
//       and never behind, the upstream digest pin, so a stale pin cannot mask an unrecorded flip
//       (section 3f);
//   (5) verify the candidate successor OpenAPI mapping notes (v0.2.0, the W2-D-owned compatible
//       successor revision): NO servers block, and BOTH security schemes present and AND-required
//       together — mutual-TLS transport AND the certificate-bound at+jwt delegation token — plus the
//       closed typed 4xx/5xx transport-error response set, internal versioned /api/v1 paths only,
//       and agreement with the closed operation registry on every path/method/operationId/token;
//   (5b) verify RESPONSE-BINDING PRESERVATION against the byte-frozen ACCEPTED predecessor: the
//       accepted floor (pairs, statuses, bindings, and which statuses carry the W2-D
//       ModelInferenceError shape) is READ OFF THE PREDECESSOR BYTES; every accepted pair and status
//       survives, every non-error-surface binding survives verbatim, and each accepted-error status —
//       422/503 on the two creates, plus wherever the successor ADDS them to the safe reads — binds a
//       oneOf whose branch set is EXACTLY {accepted ModelInferenceError, proposed
//       TransportAuthorizationError}, so a missing, extra, duplicated, swapped, collapsed
//       (anyOf/allOf/single-shape) or unresolvable branch set is rejected (section 6b);
//   (6) sweep EVERY contracts/openapi/*.openapi.yaml document — not just the delta-pinned one —
//       classify each by its own declared lifecycle and count owners per normalized (METHOD, path)
//       pair, so the four inference pairs keep exactly one CURRENT owner (the pinned accepted
//       predecessor) and at most one PROPOSED successor (the pinned delta-linked one). A rogue
//       document under any other filename or version is caught by what it DECLARES, not by its name;
//       an unparseable candidate document is a rejection, never a skip (section 7).
//
// Zero external side effects. Exit 0 = all checks passed; exit 1 = at least one failure.
//
// Shape: the validation core is the exported runValidation({ root }) function — it allocates fresh
// errors/counts/schema state per call, derives every path from the supplied repo root, prints
// nothing and never exits, so a harness can run it repeatedly against disposable packet copies.
// The banner/counts/exit code are RENDERED by the exported, pure formatValidationReport(result) —
// stdout lines, stderr lines and an exit code, no console and no process — and the CLI wrapper at the
// bottom does nothing but call the core, print what the formatter returned and set that exit code,
// behind a realpath-aware main guard. Nothing below is weakened by that split: the rules, counts,
// fallbacks and messages are unchanged.

import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import YAML from 'yaml';

const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..'); // tools/contract-validation -> repo root

const DRAFT_2020 = 'https://json-schema.org/draft/2020-12/schema';
const ID_PREFIX = 'https://contracts.cybrik.example/';
// Per-file SemVer (ADR-0001 D1): the transport schemas and the fixture inventory are new at 0.1.0;
// the ONE OpenAPI member is a compatible successor REVISION of an existing W2-D-owned 0.1.0
// document and is therefore 0.2.0. The map is pinned HERE, not read from the delta, so a member
// cannot silently re-declare its own expected version.
const EXPECTED_VERSION = '0.1.0';
const SUCCESSOR_VERSION = '0.2.0';
const SUCCESSOR_OPENAPI = 'openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml';
const PREDECESSOR_OPENAPI = 'openapi/cybrik-ai-inference-plane.v1.openapi.yaml';
const ACCEPTED_W2D_MANIFEST = 'compatibility/cybrik-suite-inference-packet.v1.manifest.json';
const expectedMemberVersion = (file) => (file === SUCCESSOR_OPENAPI ? SUCCESSOR_VERSION : EXPECTED_VERSION);
// Withdrawn under Founder Option A: a standalone W2-I packet manifest and a SECOND inference plane
// owning the same /api/v1 paths. Neither may come back — see section 3d.
const WITHDRAWN_ARTIFACTS = [
  'compatibility/cybrik-suite-inference-transport-packet.v1.manifest.json',
  'openapi/cybrik-ai-inference-transport-plane.v1.openapi.yaml',
];

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// ---------------------------------------------------------------------------
// The validation core. Every path derives from `root` (default: this checkout), and every piece of
// mutable state — errors, counts, the Ajv instance, the loaded schemas and fixtures — is allocated
// per call, so repeated calls against different roots cannot leak into one another.
// ---------------------------------------------------------------------------
export function runValidation({ root } = {}) {
  const ROOT = root ? resolve(root) : DEFAULT_ROOT;
  const CONTRACTS = join(ROOT, 'contracts');
  const JSON_SCHEMA_DIR = join(CONTRACTS, 'json-schema');

  const errors = [];
  const counts = {};
  const fail = (m) => errors.push(m);
  const bump = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };

  // ---------------------------------------------------------------------------
  // 0. Lifecycle state. The W2-I PROPOSED DELTA is the single source of truth. Exactly TWO truthful
  //    candidate-wide states are expressible (PROPOSED | ACCEPTED FOR IMPLEMENTATION); neither is a
  //    stable v1/GA. Section 3a additionally pins a delta to PROPOSED — a delta records a proposal and
  //    can never itself be the acceptance record; acceptance happens at the W2-D manifest, at a
  //    recorded gate flip. Every candidate member MUST agree — a half-flipped candidate is a
  //    consistency failure.
  //
  //    ADAPTER (deliberately minimal): the delta is NOT a manifest and is never renamed into one, so
  //    the field names differ from the packet-manifest shape the sections below were written against.
  //    `deltaView` exposes ONLY the aliases those sections read — candidate_members -> members, and
  //    compatibility_disclosure.modifies_accepted_v0_1 -> backward_compatibility — over a COPY, so
  //    every downstream rule keeps its exact shape and strength while reading the delta's own fields.
  //    Nothing is invented: no packet version, no bundle-tag flag, no manifest lifecycle. Those are
  //    asserted ABSENT in section 3a.
  // ---------------------------------------------------------------------------
  const LIFECYCLE = {
    'PROPOSED': { status: 'PROPOSED', notAccepted: true },
    'ACCEPTED FOR IMPLEMENTATION': { status: 'ACCEPTED FOR IMPLEMENTATION', notAccepted: false },
  };
  const DELTA_PATH = join(CONTRACTS, 'compatibility', 'cybrik-suite-inference-packet.v1.w2i-proposed-delta.json');
  const deltaView = (d) => ({
    ...d,
    members: d.candidate_members,
    backward_compatibility: { modifies_accepted_v0_1: d.compatibility_disclosure?.modifies_accepted_v0_1 },
  });
  let delta = null;
  let compat = null;
  try { delta = readJson(DELTA_PATH); compat = deltaView(delta); } catch (e) { fail(`W2-I proposed delta: cannot read: ${e.message}`); }
  let EXPECTED_STATE = null;
  if (compat) {
    const s = compat['x-cybrik-status'];
    if (LIFECYCLE[s]) EXPECTED_STATE = s;
    else fail(`W2-I proposed delta: x-cybrik-status must be one of ${Object.keys(LIFECYCLE).map((k) => `'${k}'`).join(' | ')} (got '${s}')`);
  }
  const LC = EXPECTED_STATE ? LIFECYCLE[EXPECTED_STATE] : null;
  // APPLIED is the post-flip half of the two-state machine. It is derived from the SAME field the
  // lifecycle is derived from, never from a second independent flag, so a half-flip cannot express
  // itself as "accepted but not applied" (or the reverse) and slip past the sections below.
  const APPLIED = EXPECTED_STATE === 'ACCEPTED FOR IMPLEMENTATION';
  const checkLifecycle = (label, obj) => {
    if (!LC || !obj) return;
    if (obj['x-cybrik-status'] !== LC.status) fail(`${label}: x-cybrik-status must be '${LC.status}' to match the manifest lifecycle (got '${obj['x-cybrik-status']}')`);
    if (obj['x-cybrik-not-accepted'] !== LC.notAccepted) fail(`${label}: x-cybrik-not-accepted must be ${LC.notAccepted} to match the manifest lifecycle`);
  };

  // ---------------------------------------------------------------------------
  // 1. Load schemas. Accepted base primitives (and the reused W2-F delegation token) are added
  //    UNMODIFIED (no lifecycle flip, no re-version) purely so cross-file $refs resolve; the
  //    transport schemas are the ones this packet owns and this validator gates. transport-common-defs
  //    is shared primitives (no direct fixture); the other two are fixture-bearing.
  // ---------------------------------------------------------------------------
  const BASE_PRIMITIVES = [
    'cybrik.common-defs.v1.schema.json',
    'cybrik.data-marking.v1.schema.json',
    'cybrik.svc-common-defs.v1.schema.json',
    'cybrik.svc-delegation-token.v1.schema.json',
  ];
  const TRANSPORT_COMMON = 'cybrik.transport-common-defs.v1.schema.json';
  const TRANSPORT_PAYLOAD_SCHEMAS = [
    'cybrik.inference-transport-binding.v1.schema.json',
    'cybrik.transport-authorization-error.v1.schema.json',
  ];
  const TRANSPORT_SCHEMAS = [TRANSPORT_COMMON, ...TRANSPORT_PAYLOAD_SCHEMAS];

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
      // Accepted base primitive / reused W2-F token: MUST remain ACCEPTED FOR IMPLEMENTATION and be
      // unmodified by this packet (backward-compat guard — the transport packet may never flip a
      // base member's lifecycle).
      if (doc['x-cybrik-status'] !== 'ACCEPTED FOR IMPLEMENTATION') fail(`base primitive json-schema/${name}: must stay ACCEPTED FOR IMPLEMENTATION (transport packet must not modify it)`);
      if (doc['x-cybrik-not-accepted'] !== false) fail(`base primitive json-schema/${name}: x-cybrik-not-accepted must stay false`);
    } else {
      checkLifecycle(`json-schema/${name}`, doc);
      if (doc['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`json-schema/${name}: contract-version must be ${EXPECTED_VERSION}`);
      bump('transport_schemas_loaded');
    }
  };
  for (const n of BASE_PRIMITIVES) loadSchema(n, { base: true });
  for (const n of TRANSPORT_SCHEMAS) loadSchema(n, { base: false });

  // Register all before compiling so cross-file $refs resolve against $id (local closure only).
  for (const [name, { doc }] of Object.entries(schemas)) {
    try { ajv.addSchema(doc); } catch (e) { fail(`json-schema/${name}: addSchema failed: ${e.message}`); }
  }

  // Compile each transport schema — this resolves every local + cross-file $ref/$defs fragment
  // (including refs into transport-common-defs, svc-common-defs, the svc-delegation-token and the
  // accepted base primitives). A dangling ref throws here.
  const validators = {}; // basename -> validate fn
  for (const name of TRANSPORT_SCHEMAS) {
    const d = schemas[name]?.doc;
    if (!d?.$id) continue;
    try {
      validators[name] = ajv.getSchema(d.$id) || ajv.compile(d);
      bump('transport_schemas_compiled');
    } catch (e) {
      fail(`json-schema/${name}: compile/ref-resolution failed: ${e.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Example fixtures, driven by examples/transport/examples-manifest.json.
  //    positive -> MUST validate; negative-schema -> MUST fail; negative-semantic -> MUST validate.
  //    A fixed test reference clock makes the token time window deterministic.
  // ---------------------------------------------------------------------------
  const EXAMPLES_DIR = join(CONTRACTS, 'examples', 'transport');
  const exManifestPath = join(EXAMPLES_DIR, 'examples-manifest.json');
  let exManifest;
  try { exManifest = readJson(exManifestPath); } catch (e) { fail(`transport examples-manifest.json: parse error: ${e.message}`); }

  let NOW = null;
  const fixtures = {}; // file -> parsed data (for cross-fixture semantic assertions)
  // The TT-*/TX-* id a manifest entry DECLARES as the primary rule its fixture must fire. Parsed from
  // the leading token of the invariant prose so the manifest, not the validator, is the declaration
  // site — the validator then proves the fixture rejects on exactly that rule (see sections 4 and 5).
  const declaredId = (ex) => (typeof ex.invariant === 'string' ? (ex.invariant.match(/^(T[TX]-\d+)\b/)?.[1] || null) : null);
  if (exManifest) {
    checkLifecycle('transport examples-manifest', exManifest);
    if (exManifest['x-cybrik-contract-version'] !== EXPECTED_VERSION) fail(`transport examples-manifest: x-cybrik-contract-version must be ${EXPECTED_VERSION}`);
    NOW = exManifest.test_reference_clock_epoch_seconds;
    if (!Number.isInteger(NOW)) fail('transport examples-manifest: test_reference_clock_epoch_seconds must be an integer (drives the deterministic runtime-invariant checks)');

    // --- Support-fixture inventory integrity ---------------------------------------------------
    // The examples manifest is the authoritative inventory of the support fixtures. Every entry is
    // digest-pinned to its bytes; every fixture on disk is indexed exactly once. A fixture that is
    // edited without a re-pin, listed twice, or present on disk but unindexed, is unpinned candidate
    // material — rejected fail-closed, because the gate evaluates bytes, not filenames.
    const seenFiles = new Set();
    for (const ex of exManifest.examples || []) {
      if (typeof ex.file !== 'string' || !ex.file) { fail('transport examples-manifest: every entry must carry a fixture file path'); continue; }
      if (seenFiles.has(ex.file)) fail(`transport examples-manifest: duplicate entry for ${ex.file} (each support fixture is indexed exactly once; a duplicate makes the inventory count a lie)`);
      seenFiles.add(ex.file);
    }
    const onDiskFixtures = new Set();
    for (const sub of ['positive', 'negative']) {
      const subDir = join(EXAMPLES_DIR, sub);
      if (!existsSync(subDir)) { fail(`transport examples-manifest: fixture directory missing on disk: examples/transport/${sub}/`); continue; }
      for (const f of readdirSync(subDir)) {
        if (f.endsWith('.json')) onDiskFixtures.add(`${sub}/${f}`);
      }
    }
    for (const f of onDiskFixtures) {
      if (!seenFiles.has(f)) fail(`transport examples-manifest: orphan fixture on disk with no manifest entry: examples/transport/${f} (an unindexed fixture is unpinned bytes inside the candidate packet)`);
    }
    bump('example_inventory_indexed', seenFiles.size);
    bump('example_inventory_on_disk', onDiskFixtures.size);

    for (const ex of exManifest.examples || []) {
      const exPath = join(EXAMPLES_DIR, ex.file);
      if (!existsSync(exPath)) { fail(`example missing on disk: examples/transport/${ex.file}`); continue; }
      // Digest-bind the fixture bytes. A self-consistent edit (a reformat, a renamed id) changes
      // nothing any schema or invariant check can observe; only this catches it.
      if (typeof ex.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(ex.sha256)) {
        fail(`transport examples-manifest: entry ${ex.file} sha256 missing/not a 64-lowercase-hex digest (every support fixture's bytes are integrity-pinned)`);
      } else {
        const exActual = sha256(exPath);
        if (exActual !== ex.sha256) fail(`transport examples-manifest: entry ${ex.file} SHA-256 mismatch — manifest ${ex.sha256}, on disk ${exActual} (re-pin after any fixture edit)`);
        else bump('example_sha_verified');
      }
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
        if (!/^TT-\d+$/.test(declaredId(ex) || '')) fail(`negative-schema example ${ex.file}: its invariant must DECLARE the structural rule it proves, as a leading 'TT-n' token (got '${ex.invariant}')`);
        if (!ok) bump('negative_schema_reject');
        else fail(`negative-schema example ${ex.file} unexpectedly VALIDATED against ${ex.schema} (must be rejected)`);
      } else if (ex.kind === 'negative-semantic') {
        bump('negative_semantic_total');
        if (!/^TX-\d+$/.test(declaredId(ex) || '')) fail(`negative-semantic example ${ex.file}: its invariant must DECLARE the runtime rule it proves, as a leading 'TX-n' token, so section 5 can require that exact rule to fire (got '${ex.invariant}')`);
        if (ok) bump('negative_semantic_structurally_valid');
        else fail(`negative-semantic example ${ex.file} failed STRUCTURAL validation (must be structurally valid; only a runtime invariant rejects it): ${ajv.errorsText(validate.errors)}`);
      } else {
        fail(`example ${ex.file}: unknown kind '${ex.kind}'`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. The W2-I PROPOSED DELTA: artifact identity, lifecycle, upstream pins, ownership, integrity.
  // ---------------------------------------------------------------------------
  if (compat) {
    checkLifecycle('W2-I proposed delta', compat);

    // --- 3a. ARTIFACT IDENTITY AND SELF-DENIAL --------------------------------------------------
    // A delta records a PROPOSAL against an accepted packet. It is not a packet, has no packet
    // identity, and cannot be the record of its own acceptance. These checks are what keeps the
    // status-honesty stance load-bearing rather than prose: the artifact must keep declining to be a
    // manifest, must stay unapplied, and must not grow the manifest-shaped fields it declines.
    if (delta['x-cybrik-artifact-kind'] !== 'proposed-delta') fail(`W2-I delta: x-cybrik-artifact-kind must be 'proposed-delta' (got '${delta['x-cybrik-artifact-kind']}')`);
    if (delta['x-cybrik-is-manifest'] !== false) fail('W2-I delta: x-cybrik-is-manifest must be false — this artifact is NOT a compatibility manifest and must never be read, indexed, released or renamed as one');
    // x-cybrik-applied is the delta's own account of whether its content has been carried into the
    // accepted manifest. It must agree with the lifecycle: PROPOSED means unapplied, ACCEPTED means
    // applied. The two disagreeing IS the half-flip this section exists to catch.
    if (delta['x-cybrik-applied'] !== APPLIED) {
      fail(APPLIED
        ? 'W2-I delta: x-cybrik-applied must be true once the delta records the ACCEPTED lifecycle (an accepted candidate whose delta still claims to be unapplied is a half-flip: the members moved and the manifest did not, or the record is lying about which)'
        : 'W2-I delta: x-cybrik-applied must be false while PROPOSED (the delta is UNAPPLIED until a recorded Gate W2-I status flip applies it)');
    }
    if (APPLIED) {
      // An APPLIED delta is a consumed review record. It never becomes the acceptance itself — the
      // acceptance is the recorded gate decision, applied INTO the W2-D manifest (checked in 3f).
      if (typeof delta['x-cybrik-applied-on'] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(delta['x-cybrik-applied-on'])) fail('W2-I delta: an applied delta must record x-cybrik-applied-on as an ISO date (when the flip touched the bytes, which is not necessarily when the gate decided)');
      if (!/APPLIED/.test(delta['x-cybrik-applies-at'] || '')) fail('W2-I delta: x-cybrik-applies-at must record that the flip has been APPLIED, not that it is still awaited');
    }
    if (!/NOT a compatibility manifest/i.test(delta['x-cybrik-manifest-self-denial'] || '')) fail('W2-I delta: x-cybrik-manifest-self-denial must state that this artifact is NOT a compatibility manifest');
    if (!/renamed/i.test(delta['x-cybrik-manifest-self-denial'] || '')) fail('W2-I delta: x-cybrik-manifest-self-denial must forbid renaming the delta into a manifest (renaming is how a proposal silently becomes a packet)');
    if (!/NO ACCEPTANCE AUTHORITY/i.test(delta['x-cybrik-grants'] || '')) fail('W2-I delta: x-cybrik-grants must declare NO ACCEPTANCE AUTHORITY (a delta accepts nothing and authorizes no implementation)');
    if (typeof delta['x-cybrik-applies-at'] !== 'string' || !/Gate W2-I/.test(delta['x-cybrik-applies-at'])) fail('W2-I delta: x-cybrik-applies-at must name the explicitly-recorded Gate W2-I status flip as the ONLY point at which this delta applies');
    // The self-denial must stay TRUE OF THE BYTES, not merely asserted. A delta that grows a manifest
    // identity is a manifest wearing a delta's name, which is precisely the failure Option A refused.
    for (const forbidden of ['members', 'x-cybrik-packet-version', 'x-cybrik-is-bundle-tag', 'x-cybrik-packet-id']) {
      if (forbidden in delta) fail(`W2-I delta: manifest-shaped field '${forbidden}' must NOT exist on a proposed-delta (it declares itself NOT a manifest; a delta has no packet identity and no bundle tag to deny — candidate members live under 'candidate_members')`);
    }
    // Not-yet-applied, stated as structure: the delta may propose manifest edits but must perform none.
    const pmc = delta.proposed_manifest_changes || {};
    if (pmc.target_manifest?.file !== ACCEPTED_W2D_MANIFEST) fail(`W2-I delta: proposed_manifest_changes.target_manifest.file must be the ACCEPTED W2-D packet manifest ${ACCEPTED_W2D_MANIFEST}`);
    if (pmc.target_manifest?.modified_now !== APPLIED) {
      fail(APPLIED
        ? 'W2-I delta: proposed_manifest_changes.target_manifest.modified_now must be true once the flip is applied (the accepted W2-D manifest absorbed these changes; claiming otherwise contradicts x-cybrik-applied)'
        : 'W2-I delta: proposed_manifest_changes.target_manifest.modified_now must be false (the accepted W2-D manifest is untouched until a recorded flip)');
    }
    if (APPLIED) {
      // The flip rewrote the target manifest by design, so the delta must pin BOTH the pre-flip byte
      // it was reviewed against and the post-flip byte on disk. One pin alone cannot distinguish
      // "reviewed and then applied" from "re-pinned to whatever is there now".
      const after = pmc.target_manifest?.sha256_after_flip;
      if (typeof after !== 'string' || !/^[0-9a-f]{64}$/.test(after)) fail('W2-I delta: an applied delta must pin proposed_manifest_changes.target_manifest.sha256_after_flip (the accepted manifest bytes AFTER the flip) alongside the pre-flip sha256 it was reviewed against');
      else {
        const onDisk = existsSync(join(CONTRACTS, ACCEPTED_W2D_MANIFEST)) ? sha256(join(CONTRACTS, ACCEPTED_W2D_MANIFEST)) : null;
        if (onDisk && onDisk !== after) fail(`W2-I delta: proposed_manifest_changes.target_manifest.sha256_after_flip ${after} does not match the accepted W2-D manifest on disk (${onDisk}) — re-pin after any edit to the accepted manifest`);
      }
      if (pmc.target_manifest?.sha256 === after) fail('W2-I delta: the pre-flip sha256 and sha256_after_flip of the target manifest are identical — the flip is recorded as applied but the accepted manifest never changed, so no member was actually absorbed');
      for (const a of pmc.adds_members || []) {
        if (a.applied !== true) fail(`W2-I delta: proposed_manifest_changes.adds_members entry ${a.file} must record applied:true once the flip is applied (a whole-packet flip leaves no member behind)`);
      }
    }
    if (!Array.isArray(pmc.removes_members) || pmc.removes_members.length !== 0) fail('W2-I delta: proposed_manifest_changes.removes_members must be empty (a compatible successor revision removes no accepted member)');
    if (!Array.isArray(pmc.modifies_accepted_members) || pmc.modifies_accepted_members.length !== 0) fail('W2-I delta: proposed_manifest_changes.modifies_accepted_members must be empty (no accepted member is modified)');
    bump('delta_identity_checked');

    const pins = compat.format_pins || {};
    if (pins.jsonSchema !== '2020-12') fail('transport manifest: jsonSchema pin must be 2020-12');
    if (pins.openApi !== '3.1.x') fail('transport manifest: openApi pin must be 3.1.x');
    if (pins.asyncApi !== '3.0.0') fail('transport manifest: asyncApi pin must be 3.0.0');
    // NO SERVER / NO MCP: this packet declares no operational endpoint and grants no tool authority.
    if (!/NO SERVER|NO ENDPOINT/i.test(compat.wire_scope || '')) fail('transport manifest: wire_scope must declare NO SERVER / NO ENDPOINT (the OpenAPI is mapping notes only, no operational server/URL/secret)');
    if (!/OUT OF SCOPE/i.test(compat.mcp_scope || '')) fail('transport manifest: mcp_scope must declare MCP OUT OF SCOPE (MCP is a Tool/Agent gateway adapter, NOT this trust boundary)');
    const acc = compat.acceptance?.status || '';
    const gateStatus = compat.gate?.status || '';
    if (compat.gate?.id !== 'W2-I') fail("transport manifest: gate.id must be 'W2-I'");
    if (EXPECTED_STATE === 'PROPOSED') {
      if (!/NOT ACCEPTED/.test(acc)) fail('transport manifest: acceptance.status must state NOT ACCEPTED while PROPOSED');
      if (!/NOT OPENED|awaiting/i.test(gateStatus)) fail('transport manifest: gate.status must record that Gate W2-I is not yet decided while PROPOSED');
    } else {
      if (!/ACCEPTED FOR IMPLEMENTATION/.test(acc)) fail('transport manifest: acceptance.status must state ACCEPTED FOR IMPLEMENTATION');
      if (/\bNOT ACCEPTED\b/.test(acc)) fail('transport manifest: acceptance.status must not still say NOT ACCEPTED once accepted');
      const a = compat.acceptance || {};
      if (!a.gate) fail('transport manifest: accepted packet must record acceptance.gate');
      if (!a.decided_by) fail('transport manifest: accepted packet must record acceptance.decided_by (Founder-delegated; not agent-inferred)');
      if (!a.decided_on) fail('transport manifest: accepted packet must record acceptance.decided_on');
      if (!Array.isArray(a.evidence) || a.evidence.length === 0) fail('transport manifest: accepted packet must record acceptance.evidence[]');
      if (/NOT OPENED|awaiting/i.test(gateStatus)) fail('transport manifest: gate.status must record the Gate W2-I decision once accepted');
    }
    // ADR basis: the accepted W2-F seam profile is ADR-0008; the candidate transport-binding ADR is
    // ADR-0011 and stays PROPOSED — NOT ACCEPTED — NOT APPLIED (not yet authored; the number before
    // it is reserved for the W0-I07B capability-name canonicalization record and is never cited here).
    const basisIds = (compat.adr_basis || []).map((x) => x.id);
    if (!basisIds.includes('ADR-0008')) fail('transport manifest: adr_basis must include the accepted ADR-0008 service-delegation/workload-identity seam profile');
    const candidateAdr = (compat.adr_basis || []).find((x) => x.id === 'ADR-0011');
    if (!candidateAdr) fail('transport manifest: adr_basis must identify the candidate transport-binding ADR as ADR-0011');
    else {
      // All three facts, not two: the record must stay PROPOSED, undecided (either wording — a delta
      // says NOT DECIDED, a manifest said NOT ACCEPTED; both mean unaccepted), and unapplied.
      const adrStatus = candidateAdr.status || '';
      if (APPLIED) {
        // Once the gate has decided, the ADR is the decision record and must say so — and must stop
        // carrying any of the three not-yet qualifiers, which would now be false.
        if (!/\bACCEPTED\b/.test(adrStatus)) fail(`transport manifest: ADR-0011 must record ACCEPTED once Gate W2-I is decided; got '${adrStatus}'`);
        if (/NOT (ACCEPTED|DECIDED|APPLIED)/.test(adrStatus)) fail(`transport manifest: ADR-0011 must not still carry a NOT ACCEPTED/NOT DECIDED/NOT APPLIED qualifier once accepted; got '${adrStatus}'`);
      } else {
        // All three facts, not two: the record must stay PROPOSED, undecided (either wording — a delta
        // says NOT DECIDED, a manifest said NOT ACCEPTED; both mean unaccepted), and unapplied.
        if (!/\bPROPOSED\b/.test(adrStatus) || !/NOT (ACCEPTED|DECIDED)/.test(adrStatus) || !/NOT APPLIED/.test(adrStatus)) fail(`transport manifest: the candidate ADR-0011 must remain PROPOSED — NOT ACCEPTED/NOT DECIDED — NOT APPLIED (Gate W2-I decides it, never this validator); got '${adrStatus}'`);
      }
    }
    // Disjointness from the accepted tool-execution packet (ADR-0004) and the unapplied org-hierarchy
    // delta (ADR-0007) is a load-bearing security stance: the transport binding grants no tool/agent
    // authority, and org_scope stays opaque/advisory.
    const oos = (compat.adr_out_of_scope || []).map((x) => x.id);
    if (!oos.includes('ADR-0004')) fail('transport manifest: ADR-0004 (tool execution authority) MUST be declared out of scope (the transport binding grants no tool/agent authority; MCP is an adapter, not this trust boundary)');
    if (!oos.includes('ADR-0007')) fail('transport manifest: ADR-0007 (org-hierarchy delta) MUST be declared out of scope (org_scope is opaque/advisory here; the delta is not applied)');
    if (compat.backward_compatibility?.modifies_accepted_v0_1 !== false) fail('transport manifest: backward_compatibility.modifies_accepted_v0_1 must be false');
    // Every reused accepted primitive must exist on disk and NOT be a member of this packet.
    const memberFiles = new Set((compat.members || []).map((m) => m.file));
    for (const rf of compat.reuses_accepted_unmodified?.members || []) {
      if (!existsSync(join(CONTRACTS, rf))) fail(`transport manifest: reused accepted member missing on disk: ${rf}`);
      if (memberFiles.has(rf)) fail(`transport manifest: reused accepted member ${rf} must NOT also be declared a packet member`);
      bump('reused_accepted_members');
    }
    // Every declared candidate member exists on disk at its expected per-file version, agrees with the
    // candidate lifecycle, and matches its recorded SHA-256 (integrity: the delta-pinned bytes are the
    // candidate bytes evaluated by the gate).
    for (const m of compat.members || []) {
      const mp = join(CONTRACTS, m.file);
      if (!existsSync(mp)) { fail(`transport manifest: member file missing: ${m.file}`); continue; }
      bump('manifest_members');
      const wantVersion = expectedMemberVersion(m.file);
      if (m.contract_version !== wantVersion) fail(`transport manifest: candidate member ${m.file} contract_version must be ${wantVersion} (per-file SemVer, ADR-0001 D1: the successor OpenAPI is a ${SUCCESSOR_VERSION} revision of an accepted ${EXPECTED_VERSION} document; every other member is new at ${EXPECTED_VERSION}) — got '${m.contract_version}'`);
      if (m.status !== LC?.status) fail(`transport manifest: member ${m.file} status must be '${LC?.status}' to match the packet lifecycle (got '${m.status}')`);
      if (typeof m.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(m.sha256)) {
        fail(`transport manifest: member ${m.file} sha256 missing/not a 64-hex digest`);
      } else {
        const actual = sha256(mp);
        if (actual !== m.sha256) fail(`transport manifest: member ${m.file} SHA-256 mismatch — manifest ${m.sha256}, on disk ${actual} (recompute after any edit)`);
        else bump('member_sha_verified');
      }
    }
    // The examples manifest must be declared, present on disk, and digest-pinned: the pinned
    // fixture catalog is part of the candidate bytes, so any examples-manifest change forces a
    // re-pin here just like a member edit does.
    const emRel = compat.examples_manifest;
    if (!emRel) fail('transport manifest: examples_manifest reference missing');
    else if (!existsSync(join(CONTRACTS, emRel))) fail(`transport manifest: examples_manifest missing on disk: ${emRel}`);
    const emSha = compat.examples_manifest_sha256;
    if (typeof emSha !== 'string' || !/^[0-9a-f]{64}$/.test(emSha)) {
      fail('transport manifest: examples_manifest_sha256 missing/not a 64-hex digest (the examples manifest is an integrity-pinned packet artifact)');
    } else if (emRel && existsSync(join(CONTRACTS, emRel))) {
      const emActual = sha256(join(CONTRACTS, emRel));
      if (emActual !== emSha) fail(`transport manifest: examples_manifest SHA-256 mismatch — manifest ${emSha}, on disk ${emActual} (re-pin after any examples-manifest change)`);
      else bump('examples_manifest_sha_verified');
    }
    // Trust-invariant catalog present (structural + runtime) so the fail-closed stance is documented.
    if (!Array.isArray(compat.trust_invariants?.structural) || compat.trust_invariants.structural.length === 0) fail('transport manifest: trust_invariants.structural missing/empty');
    if (!Array.isArray(compat.trust_invariants?.runtime_only) || compat.trust_invariants.runtime_only.length === 0) fail('transport manifest: trust_invariants.runtime_only missing/empty');
    const invText = JSON.stringify(compat.trust_invariants || {});
    if (!/TT-1\b/.test(invText)) fail('transport manifest: trust_invariants must reference TT-1 (mTLS-bound)');
    if (!/TX-1\b/.test(invText)) fail('transport manifest: trust_invariants must reference TX-1 (proof-of-possession)');
    // A presentation can violate several runtime rules at once, so WHICH rule is returned is a
    // documented decision, not an accident. The manifest must state the evaluation order (TX-8 before
    // TX-7) and the declared-primary-rule contract the validator enforces in section 5.
    const evalOrder = compat.trust_invariants?.runtime_evaluation_order;
    if (typeof evalOrder !== 'string' || !evalOrder.trim()) {
      fail('transport manifest: trust_invariants.runtime_evaluation_order missing — the runtime TX evaluation order must be documented, because a fixture may match several rules and the validator requires each to reject on its declared primary rule');
    } else {
      const i8 = evalOrder.indexOf('TX-8');
      const i7 = evalOrder.indexOf('TX-7');
      if (i8 < 0 || i7 < 0 || i8 > i7) fail('transport manifest: trust_invariants.runtime_evaluation_order must record that TX-8 (feature flag) is evaluated BEFORE TX-7 (replay) — a disabled operation is refused before the replay cache is consulted');
      if (!/disabled/i.test(evalOrder)) fail('transport manifest: runtime_evaluation_order must explain WHY the feature-flag rule precedes the replay rule (a disabled operation is never admitted to the replay cache)');
      if (!/primary/i.test(evalOrder)) fail('transport manifest: runtime_evaluation_order must record the declared-primary-rule contract (a fixture matching several rules rejects on its declared primary rule)');
      bump('runtime_order_documented');
    }
    // MCP is a Tool/Agent adapter, NOT the inference trust boundary — recorded explicitly.
    if (!/adapter/i.test(compat.mcp_scope || '') || !/NOT.*(trust boundary|inference)/i.test(compat.mcp_scope || '')) fail('transport manifest: mcp_scope must record that MCP is a Tool/Agent adapter and NOT the inference trust boundary');

    // --- 3b. UPSTREAM ACCEPTED PINS -------------------------------------------------------------
    // The delta was authored and reviewed against exact ACCEPTED W2-D bytes. Those bytes are
    // byte-frozen and MUST show zero diff. This is the check that makes "does not modify accepted"
    // evaluable instead of asserted: if the accepted manifest or the predecessor OpenAPI moved under
    // the candidate, the review it claims was never performed against what is on disk.
    const upstream = delta.upstream_pins?.accepted;
    if (!Array.isArray(upstream) || upstream.length === 0) fail('W2-I delta: upstream_pins.accepted must pin the ACCEPTED W2-D bytes this delta was authored against');
    else {
      const pinnedFiles = new Set(upstream.map((u) => u.file));
      for (const need of [ACCEPTED_W2D_MANIFEST, PREDECESSOR_OPENAPI]) {
        if (!pinnedFiles.has(need)) fail(`W2-I delta: upstream_pins.accepted must pin the byte-frozen accepted ${need}`);
      }
      for (const u of upstream) {
        const up = join(CONTRACTS, u.file);
        if (!existsSync(up)) { fail(`W2-I delta: upstream accepted pin missing on disk: ${u.file}`); continue; }
        if (u.status !== 'ACCEPTED FOR IMPLEMENTATION') fail(`W2-I delta: upstream pin ${u.file} must stay ACCEPTED FOR IMPLEMENTATION (the candidate never re-labels accepted bytes) — got '${u.status}'`);
        if (memberFiles.has(u.file)) fail(`W2-I delta: upstream accepted pin ${u.file} must NOT also be a candidate member (an accepted document cannot be candidate material)`);
        if (typeof u.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(u.sha256)) { fail(`W2-I delta: upstream pin ${u.file} sha256 missing/not a 64-hex digest`); continue; }
        const upActual = sha256(up);
        // The accepted W2-D manifest is the TARGET of the flip, so post-flip its bytes are expected to
        // differ from the reviewed pin. That one file switches to a two-pin rule; every other upstream
        // pin — the predecessor OpenAPI above all — stays strictly byte-frozen in both states, because
        // supersession relabels a member row and never rewrites the superseded document.
        const isFlipTarget = APPLIED && u.file === ACCEPTED_W2D_MANIFEST;
        if (isFlipTarget) {
          if (u.byte_frozen_through_flip !== false) fail(`W2-I delta: upstream pin ${u.file} must record byte_frozen_through_flip:false — it is the deliberate target of the applied flip`);
          const after = u.sha256_after_flip;
          if (typeof after !== 'string' || !/^[0-9a-f]{64}$/.test(after)) fail(`W2-I delta: upstream pin ${u.file} must carry sha256_after_flip once the flip is applied (the pre-flip sha256 records what was reviewed; it can no longer describe what is on disk)`);
          else if (upActual !== after) fail(`W2-I delta: upstream pin ${u.file} sha256_after_flip mismatch — delta ${after}, on disk ${upActual} (re-pin both sites after any edit to the accepted manifest)`);
          else if (after === u.sha256) fail(`W2-I delta: upstream pin ${u.file} records identical pre- and post-flip digests, so the flip is claimed but the accepted manifest never moved`);
          else bump('upstream_pin_verified');
        } else {
          if (APPLIED && u.byte_frozen_through_flip !== true) fail(`W2-I delta: upstream pin ${u.file} must record byte_frozen_through_flip:true — only the accepted manifest may move at the flip, and this file is not it`);
          if (upActual !== u.sha256) fail(`W2-I delta: upstream ACCEPTED pin ${u.file} SHA-256 mismatch — delta ${u.sha256}, on disk ${upActual}. The accepted bytes are byte-frozen and must show ZERO diff; a mismatch means the candidate was reviewed against bytes that are not the accepted ones.`);
          else bump('upstream_pin_verified');
        }
      }
    }

    // --- 3c. SINGLE-OWNER OWNERSHIP RECORD ------------------------------------------------------
    // Founder Option A: exactly ONE current owner of the four inference operations, and at most ONE
    // proposed successor. Both digests are declared twice (ownership + the authoritative pin table),
    // so the two sites must agree — a one-sided re-pin is how a stale candidate would otherwise pass.
    const own = delta.ownership || {};
    const cur = own.current_owner || {};
    const succ = own.proposed_successor || {};
    const upstreamPredecessor = (upstream || []).find((u) => u.file === PREDECESSOR_OPENAPI);
    const successorMember = (compat.members || []).find((m) => m.file === SUCCESSOR_OPENAPI);
    if (cur.file !== PREDECESSOR_OPENAPI) fail(`W2-I delta: ownership.current_owner.file must be the accepted W2-D-owned ${PREDECESSOR_OPENAPI} (it remains the sole CURRENT owner until a recorded flip) — got '${cur.file}'`);
    if (cur.byte_frozen !== true) fail('W2-I delta: ownership.current_owner.byte_frozen must be true (supersession relabels a member; it never edits the superseded bytes)');
    // The predecessor slot: CURRENT while the candidate is PROPOSED, SUPERSEDED-SUPPORTED once the
    // flip applies. It is byte-frozen in BOTH states — that is the invariant the flip may not break.
    if (APPLIED) {
      // Anchored on the LEADING label: lifecycle_now states the state first and may then explain it,
      // so matching anywhere would let explanatory prose ("no longer the CURRENT owner") read as a
      // currency claim, while matching the leading label cannot.
      if (!/^SUPERSEDED-SUPPORTED\b/.test(cur.lifecycle_now || '')) fail(`W2-I delta: once applied, ownership.current_owner.lifecycle_now must OPEN with SUPERSEDED-SUPPORTED (it is no longer the CURRENT owner; two CURRENT owners of the same four pairs is exactly the condition Option A refused) — got '${cur.lifecycle_now}'`);
      if (/\b(?:remains|is|stays) (?:still )?CURRENT\b/i.test(cur.lifecycle_now || '')) fail('W2-I delta: ownership.current_owner.lifecycle_now must not still assert that the predecessor IS current after the flip');
    } else {
      if (!/CURRENT/.test(cur.lifecycle_now || '') || !/ACCEPTED FOR IMPLEMENTATION/.test(cur.lifecycle_now || '')) fail('W2-I delta: ownership.current_owner.lifecycle_now must record it as CURRENT — ACCEPTED FOR IMPLEMENTATION');
    }
    if (upstreamPredecessor && cur.sha256 !== upstreamPredecessor.sha256) fail(`W2-I delta: ownership.current_owner.sha256 (${cur.sha256}) disagrees with upstream_pins.accepted (${upstreamPredecessor.sha256}) for the same file — both pin sites must be re-pinned together`);
    if (succ.file !== SUCCESSOR_OPENAPI) fail(`W2-I delta: ownership.proposed_successor.file must be ${SUCCESSOR_OPENAPI} — got '${succ.file}'`);
    if (succ.contract_version !== SUCCESSOR_VERSION) fail(`W2-I delta: ownership.proposed_successor.contract_version must be ${SUCCESSOR_VERSION}`);
    if (APPLIED) {
      if (!/^CURRENT\b/.test(succ.lifecycle_now || '') || !/ACCEPTED FOR IMPLEMENTATION/.test(succ.lifecycle_now || '')) fail(`W2-I delta: once applied, ownership.proposed_successor.lifecycle_now must OPEN with CURRENT and record ACCEPTED FOR IMPLEMENTATION (it is now the sole owner of the four pairs) — got '${succ.lifecycle_now}'`);
      if (/NOT ACCEPTED/.test(succ.lifecycle_now || '')) fail('W2-I delta: ownership.proposed_successor.lifecycle_now must not still say NOT ACCEPTED after the flip');
    } else {
      if (!/PROPOSED/.test(succ.lifecycle_now || '') || !/NOT ACCEPTED/.test(succ.lifecycle_now || '')) fail('W2-I delta: ownership.proposed_successor.lifecycle_now must record PROPOSED-SUCCESSOR — NOT ACCEPTED');
    }
    if (successorMember && succ.sha256 !== successorMember.sha256) fail(`W2-I delta: ownership.proposed_successor.sha256 (${succ.sha256}) disagrees with candidate_members (${successorMember.sha256}) for the same file — both pin sites must be re-pinned together`);
    // The predecessor's PROPOSED disposition must stay a proposal, byte-frozen and non-binding.
    const disp = delta.proposed_disposition || {};
    if (disp.predecessor !== PREDECESSOR_OPENAPI) fail(`W2-I delta: proposed_disposition.predecessor must be ${PREDECESSOR_OPENAPI}`);
    if (disp.predecessor_byte_frozen !== true) fail('W2-I delta: proposed_disposition.predecessor_byte_frozen must be true');
    if (APPLIED) {
      // A decided disposition, with the effective date binding and the retirement date still absent:
      // ADR-0001 D3's floor is max(180 days, two subsequent minor releases), and the release-count
      // bound cannot be satisfied at the flip, so a fixed retirement date here would be fabricated.
      if (!/^SUPERSEDED-SUPPORTED\b/.test(disp.predecessor_disposition_now || '')) fail(`W2-I delta: once applied, proposed_disposition.predecessor_disposition_now must OPEN with SUPERSEDED-SUPPORTED — got '${disp.predecessor_disposition_now}'`);
      if (disp.predecessor_disposition_decided !== 'SUPERSEDED-SUPPORTED') fail('W2-I delta: proposed_disposition.predecessor_disposition_decided must record the DECIDED disposition SUPERSEDED-SUPPORTED (ADR-0001 D3 / the recorded gate decision)');
      if (typeof disp.effective_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(disp.effective_on)) fail('W2-I delta: an applied disposition must record effective_on as an ISO date');
      if (disp.dates_binding !== true) fail('W2-I delta: proposed_disposition.dates_binding must be true once the disposition is decided (the effective date binds)');
      if (disp.retirement_date_fixed !== false) fail('W2-I delta: proposed_disposition.retirement_date_fixed must be false — the ADR-0001 D3 floor needs two subsequent minor releases as well as 180 days, so no retirement date is derivable at the flip');
      if (disp.release_dates_consumed !== false) fail('W2-I delta: proposed_disposition.release_dates_consumed must be false (a contract supersession consumes no W0-W6 release date)');
      if (!/DECIDED/.test(disp.final_disposition_status || '')) fail('W2-I delta: proposed_disposition.final_disposition_status must record the disposition as DECIDED once applied');
    } else {
      if (!/CURRENT/.test(disp.predecessor_disposition_now || '')) fail('W2-I delta: proposed_disposition.predecessor_disposition_now must record that the predecessor is still CURRENT (not yet deprecated or superseded)');
      if (disp.dates_binding !== false) fail('W2-I delta: proposed_disposition.dates_binding must be false (every date in a proposal is a planning value and consumes no W0-W6 release date)');
    }
    bump('ownership_checked');

    // --- 3d. WITHDRAWN SECOND-PLANE ARTIFACTS STAY ABSENT ---------------------------------------
    // Option A refused a standalone W2-I packet manifest and a SECOND OpenAPI plane owning the same
    // /api/v1 paths. Their reappearance on disk would re-create the two-owner condition the decision
    // resolved, so absence is enforced, not assumed.
    for (const w of WITHDRAWN_ARTIFACTS) {
      if (existsSync(join(CONTRACTS, w))) fail(`W2-I delta: withdrawn artifact must NOT exist on disk: ${w} (Founder Option A resolved single ownership; a standalone W2-I packet manifest or a second inference plane re-creates two owners of the same /api/v1 paths)`);
      else bump('withdrawn_artifact_absent');
    }

    // --- 3e. CLOSED OPERATION REGISTRY vs. THE POSITIVE FIXTURES --------------------------------
    // CLOSED means exactly these tokens exist on this seam. The registry is checked against the
    // fixtures here and against the successor OpenAPI in section 6, so a token cannot drift at one
    // site — which is exactly the reconciliation defect this delta records having repaired.
    const registry = delta.operation_registry || {};
    const ops = Array.isArray(registry.operations) ? registry.operations : [];
    if (registry.closed !== true) fail('W2-I delta: operation_registry.closed must be true (a token outside the registry is unaccepted vocabulary, not an operation)');
    if (ops.length === 0) fail('W2-I delta: operation_registry.operations must not be empty');
    const registryTokens = new Set();
    for (const op of ops) {
      if (registryTokens.has(op.token)) fail(`W2-I delta: operation_registry declares '${op.token}' twice (a closed registry counts each token once)`);
      registryTokens.add(op.token);
      const fx = fixtures[op.positive_fixture];
      if (!fx) { fail(`W2-I delta: operation_registry '${op.token}' names positive_fixture ${op.positive_fixture}, which is not an indexed, loaded fixture (an operation with no witness is an unproven claim)`); continue; }
      const rb = fx.rest_binding || {};
      if (rb.method !== op.method) fail(`W2-I delta: operation_registry '${op.token}' declares method ${op.method}, but its witness ${op.positive_fixture} presents ${rb.method}`);
      if (rb.path_template !== op.path) fail(`W2-I delta: operation_registry '${op.token}' declares path ${op.path}, but its witness ${op.positive_fixture} presents ${rb.path_template}`);
      // The token must be spelled identically at all THREE presentation sites; TX-4 rejects a
      // mismatch at runtime, but a fixture that spells it consistently-wrong would still pass TX-4.
      const sites = [rb.operation?.name, fx.presented_token?.claims?.['cybrik.operation']?.name, fx.body_advisory?.operation?.name];
      if (!sites.every((s) => s === op.token)) fail(`W2-I delta: operation_registry '${op.token}' must be spelled identically at all three presentation sites of ${op.positive_fixture} (rest_binding / token / body_advisory) — got ${JSON.stringify(sites)}`);
      else bump('registry_operation_witnessed');
    }
    // Closure in the other direction: no fixture may present a token the registry does not declare.
    for (const [file, fx] of Object.entries(fixtures)) {
      const tok = fx?.rest_binding?.operation?.name;
      if (tok !== undefined && !registryTokens.has(tok)) fail(`W2-I delta: fixture ${file} presents operation token '${tok}', which the CLOSED operation_registry does not declare (unregistered vocabulary on this seam)`);
    }
  }

  // ---------------------------------------------------------------------------
  // 3f. ADR-0001 D6 — THE ACCEPTED W2-D MANIFEST AND THE CANDIDATE, IN BOTH LIFECYCLE STATES.
  //
  //     D6 forbids an ACCEPTED packet from referencing an UNACCEPTED one. The rule therefore has two
  //     faces, and which one applies is decided by the SAME lifecycle field as everything else:
  //
  //     WHILE PROPOSED — the accepted W2-D manifest must name none of: the proposed successor
  //     OpenAPI, this delta, the proposed transport schemas, the proposed examples manifest, the
  //     candidate ADR-0011, or any candidate_members path. A manifest that already lists candidate
  //     material HAS performed the flip, silently — which is exactly what x-cybrik-applied:false and
  //     proposed_manifest_changes.target_manifest.modified_now:false claim has not happened.
  //
  //     ONCE APPLIED — the inverse is the invariant. The members became accepted AND the manifest
  //     adopted them in one act, so the references are accepted -> accepted and D6 is not engaged.
  //     What must now be proven is that the flip was WHOLE: every candidate member is declared by the
  //     accepted manifest at its post-flip digest, the predecessor member row is relabelled
  //     SUPERSEDED-SUPPORTED rather than deleted or rewritten, and the acceptance is recorded with a
  //     gate, a decider and a date. A member that flipped while the manifest ignored it — or a
  //     manifest that adopted a member still carrying PROPOSED bytes — is a half-flip, and a
  //     half-flip is the failure mode this whole section exists to make unrepresentable.
  //
  //     This block is deliberately OUTSIDE `if (compat)` and reads the accepted manifest's own bytes
  //     rather than trusting the section-3b digest pin. A stale, forged or malformed upstream pin must
  //     not be able to HIDE a D6 violation behind a digest error: a mutation that edits the accepted
  //     manifest AND slackens its pin has to produce BOTH failures, never one that masks the other.
  //
  //     The needles are concrete candidate names (never a bare 'transport' or 'examples-manifest'), so
  //     an unrelated accepted member can never trip the rule.
  // ---------------------------------------------------------------------------
  const D6_MSG = (m) => `ADR-0001 D6: the accepted W2-D manifest (${ACCEPTED_W2D_MANIFEST}) ${m}`;
  let w2dManifest = null;
  try {
    w2dManifest = readJson(join(CONTRACTS, ACCEPTED_W2D_MANIFEST));
  } catch (e) {
    fail(D6_MSG(`cannot be read/parsed, so its freedom from candidate material is UNVERIFIABLE (fail closed, never skipped): ${e.message}`));
  }
  if (w2dManifest) {
    const candidateMemberFiles = (delta?.candidate_members || []).map((m) => m.file).filter((f) => typeof f === 'string');
    const D6_NEEDLES = [...new Set([
      SUCCESSOR_OPENAPI,
      SUCCESSOR_OPENAPI.split('/').pop(),
      'contract-0.2.0',
      DELTA_PATH.split('/').pop(),
      'w2i-proposed-delta',
      ...TRANSPORT_SCHEMAS,
      'examples/transport/',
      ...(typeof delta?.examples_manifest === 'string' ? [delta.examples_manifest] : []),
      'ADR-0011',
      ...candidateMemberFiles,
      ...candidateMemberFiles.map((f) => f.split('/').pop()),
    ].filter(Boolean))];
    let d6Clean = true;
    if (!APPLIED) {
      // (a) Member-level: an accepted member row naming candidate material IS the unrecorded flip.
      for (const m of w2dManifest.members || []) {
        const f = typeof m?.file === 'string' ? m.file : '';
        const hit = D6_NEEDLES.find((n) => f.includes(n));
        if (hit) {
          d6Clean = false;
          fail(D6_MSG(`declares candidate member '${f}' (matches candidate name '${hit}') — the ACCEPTED packet may not adopt candidate material before a recorded Gate W2-I flip applies the delta`));
        }
      }
      // (b) Document-level: any other reference — a path, a $ref, a cross-ref row, prose, an ADR
      //     citation — counts too. A forward reference from accepted bytes into unaccepted ones is the
      //     violation; where in the document it sits is not a defence. Reported as ONE error listing
      //     every name that matched: several needles (full path, basename, version token) can name the
      //     same reference, and repeating one violation N times would misreport its size.
      const w2dText = JSON.stringify(w2dManifest);
      const referenced = D6_NEEDLES.filter((n) => w2dText.includes(n));
      if (referenced.length) {
        d6Clean = false;
        fail(D6_MSG(`references ${referenced.length} candidate name(s) [${referenced.join(', ')}] — an ACCEPTED packet must carry NO reference to this UNACCEPTED candidate while the delta is unapplied`));
      }
      if (d6Clean) bump('d6_accepted_manifest_clean');
    } else {
      // --- APPLIED: prove the flip was whole, in the accepted manifest's own bytes. ---------------
      const rows = new Map();
      for (const m of w2dManifest.members || []) if (typeof m?.file === 'string') rows.set(m.file, m);

      // (a) Every candidate member is declared, accepted, and pinned to its POST-flip bytes. Reading
      //     the digest from the accepted manifest (not the delta) is what makes the two records have
      //     to agree; a one-sided re-pin fails here.
      for (const m of delta?.candidate_members || []) {
        const row = rows.get(m.file);
        if (!row) {
          d6Clean = false;
          fail(D6_MSG(`does NOT declare applied candidate member '${m.file}' — the flip is recorded as applied but the accepted manifest never adopted this member (a half-flipped packet)`));
          continue;
        }
        if (row.lifecycle && !/CURRENT|ACCEPTED/i.test(row.lifecycle)) fail(D6_MSG(`declares applied member '${m.file}' with lifecycle '${row.lifecycle}' — an absorbed member is CURRENT/ACCEPTED, never anything else`));
        if (typeof row.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.sha256)) {
          d6Clean = false;
          fail(D6_MSG(`declares applied member '${m.file}' without a 64-hex sha256 — members absorbed at W2-I are digest-bound (the pre-W2-I rows are a separate, recorded gate)`));
        } else if (row.sha256 !== m.sha256) {
          d6Clean = false;
          fail(D6_MSG(`pins applied member '${m.file}' at ${row.sha256}, but the delta pins ${m.sha256} for the same file — both pin sites must be re-pinned together`));
        } else {
          bump('applied_member_pin_agreed');
        }
      }

      // (b) The predecessor is relabelled, not deleted and not rewritten. Supersession that removes
      //     the superseded row loses the deprecation window; supersession that edits the superseded
      //     document breaks G-W2I-4. Both are checked, one here and one by the byte-frozen pin in 3b.
      const predRow = rows.get(PREDECESSOR_OPENAPI);
      if (!predRow) {
        d6Clean = false;
        fail(D6_MSG(`no longer declares the superseded predecessor '${PREDECESSOR_OPENAPI}' — supersession relabels a member row and never deletes it, because a deleted row cannot carry a deprecation window`));
      } else {
        if (predRow.lifecycle !== 'SUPERSEDED-SUPPORTED') {
          d6Clean = false;
          fail(D6_MSG(`declares the predecessor '${PREDECESSOR_OPENAPI}' with lifecycle '${predRow.lifecycle}' — once the flip is applied it must be SUPERSEDED-SUPPORTED, or the packet claims two CURRENT owners of the same four pairs`));
        }
        if (predRow.superseded_by !== SUCCESSOR_OPENAPI) fail(D6_MSG(`declares the predecessor without superseded_by:'${SUCCESSOR_OPENAPI}' — a superseded member must name what superseded it`));
        if (predRow.byte_frozen !== true) fail(D6_MSG(`must record byte_frozen:true on the superseded predecessor row (G-W2I-4: the superseded document's bytes never move)`));
      }

      // (c) The acceptance itself is recorded in the accepted manifest, with a gate, a decider and a
      //     date. Absorbed members with no recorded decision behind them are an unrecorded flip.
      const acc = w2dManifest.w2i_transport_binding_acceptance;
      if (!acc || typeof acc !== 'object') {
        d6Clean = false;
        fail(D6_MSG('does not record w2i_transport_binding_acceptance — an accepted manifest that absorbed W2-I members must carry the decision that authorized them (ADR-0001 D5: acceptance is a recorded decision, never an inference from the bytes being present)'));
      } else {
        if (acc.gate !== 'W2-I') fail(D6_MSG("w2i_transport_binding_acceptance.gate must be 'W2-I'"));
        if (!acc.decided_by) fail(D6_MSG('w2i_transport_binding_acceptance must record decided_by'));
        if (!acc.decided_on) fail(D6_MSG('w2i_transport_binding_acceptance must record decided_on'));
        if (!/ACCEPTED FOR IMPLEMENTATION/.test(acc.status || '')) fail(D6_MSG('w2i_transport_binding_acceptance.status must record ACCEPTED FOR IMPLEMENTATION'));
        if (!Array.isArray(acc.carried_forward_obligations) || acc.carried_forward_obligations.length === 0) fail(D6_MSG('w2i_transport_binding_acceptance must list carried_forward_obligations — the open items acceptance did NOT discharge (notably the accepted W2-F operation-token table, which this flip did not amend) are recorded, never dropped'));
        if (acc.predecessor_disposition?.decided_disposition !== 'SUPERSEDED-SUPPORTED') fail(D6_MSG('w2i_transport_binding_acceptance.predecessor_disposition.decided_disposition must record SUPERSEDED-SUPPORTED'));
      }

      // (d) One manifest, before and after (G-W2I-2). The absorbed members must live in THIS manifest
      //     and the consumed delta must still deny being one.
      if (w2dManifest['x-cybrik-is-bundle-tag'] !== false) fail(D6_MSG('x-cybrik-is-bundle-tag must stay false — a status flip is not a bundle-tag promotion (ADR-0001 D6)'));
      if (w2dManifest['x-cybrik-packet-version'] !== '0.1.0') fail(D6_MSG(`x-cybrik-packet-version must stay 0.1.0 across the flip — absorbing members is not a packet re-version (got '${w2dManifest['x-cybrik-packet-version']}')`));

      if (d6Clean) bump('d6_applied_manifest_whole');
    }
  }

  // ---------------------------------------------------------------------------
  // 4. STRUCTURAL trust invariants (TT-1..TT-9) as brittle-on-purpose assertions on the schema
  //    shapes. A regression that relaxes any of these fails CI here. Each is ALSO exercised by a
  //    negative-schema fixture that is proven to carry the offending shape (no vacuous pass).
  // ---------------------------------------------------------------------------
  const doc = (n) => schemas[n]?.doc;
  const req = (o) => (o && Array.isArray(o.required)) ? o.required : [];
  const props = (o) => (o && o.properties) ? o.properties : {};
  const H = (id, cond, msg) => { bump('invariants_checked'); if (cond) bump('invariants_ok'); else fail(`INVARIANT#${id}: ${msg}`); };

  const tcommon = doc(TRANSPORT_COMMON);
  const binding = doc('cybrik.inference-transport-binding.v1.schema.json');
  const errSchema = doc('cybrik.transport-authorization-error.v1.schema.json');
  const tdefs = tcommon?.$defs || {};
  const bindProps = props(binding);
  const transportProps = props(bindProps.transport);
  const bodyProps = props(bindProps.body_advisory);

  // TT-1 mTLS-BOUND: transport.mutual_tls const true; protocol const 'rest/json'. A bearer-only,
  // non-mTLS inference channel is structurally inexpressible (ADR-0008 D1).
  H('TT-1a', transportProps.mutual_tls?.const === true, 'inference-transport-binding transport.mutual_tls must be const true (no non-mTLS channel)');
  H('TT-1b', tdefs.transportProtocol?.const === 'rest/json', "transport-common-defs transportProtocol must be const 'rest/json' (versioned REST/JSON is the compatibility authority; MCP is not this trust boundary)");
  H('TT-1c', /transportProtocol$/.test(transportProps.protocol?.$ref || ''), 'transport.protocol must $ref the const rest/json transportProtocol');

  // TT-2 NO FORWARDED USER TOKEN + TT-3 NO MODEL/VENDOR/TOOL AUTHORITY: body_advisory is
  // additionalProperties:false so a forwarded end-user token, static bearer, or model/vendor/tool
  // authority field has nowhere to live.
  H('TT-2', bindProps.body_advisory?.additionalProperties === false, 'inference-transport-binding body_advisory must be additionalProperties:false (no forwarded end-user token / static bearer)');
  H('TT-3', bindProps.body_advisory?.additionalProperties === false && !('model' in bodyProps) && !('tools' in bodyProps), 'inference-transport-binding body_advisory must forbid model/vendor/tool authority fields (additionalProperties:false; no model/tools property)');
  // The whole binding is additionalProperties:false too — no smuggled top-level authority field.
  H('TT-3b', binding?.additionalProperties === false, 'inference-transport-binding root must be additionalProperties:false');

  // TT-4 REPLAY CONTROL. Three encoded parts, asserted against the exact encoded rule:
  //   (a) idempotency_key minLength 16 (mirrors the mandatory Idempotency-Key header);
  //   (b) a ROOT cross-object conditional — rest_binding.method POST AND
  //       rest_binding.requires_idempotency_key true  =>  root idempotency_key REQUIRED. minLength
  //       never fires on an absent property, so (a) without (b) lets a create omit the key entirely;
  //   (c) restBinding method/policy agreement — POST => requires true, else (GET) => requires false,
  //       so a create cannot declare itself exempt from (b) and a safe read is never forced.
  H('TT-4a', bindProps.idempotency_key?.minLength === 16, 'inference-transport-binding idempotency_key minLength must be 16 (a create retry cannot be forged short)');
  const tt4 = Array.isArray(binding?.allOf)
    ? binding.allOf.find((s) => s?.if?.properties?.rest_binding?.properties?.method?.const === 'POST')
    : null;
  const tt4If = tt4?.if?.properties?.rest_binding;
  H('TT-4b', !!tt4
    && tt4If?.properties?.requires_idempotency_key?.const === true
    && (tt4If?.required || []).includes('method')
    && (tt4If?.required || []).includes('requires_idempotency_key')
    && (tt4?.if?.required || []).includes('rest_binding')
    && (tt4?.then?.required || []).includes('idempotency_key'),
    'inference-transport-binding must encode the TT-4 conditional at the root: if rest_binding.method is const POST AND rest_binding.requires_idempotency_key is const true (both required in the condition), then idempotency_key is REQUIRED');
  const restBind = tdefs.restBinding;
  const tt4c = Array.isArray(restBind?.allOf) ? restBind.allOf.find((s) => s?.if?.properties?.method?.const === 'POST') : null;
  H('TT-4c', !!tt4c
    && tt4c.then?.properties?.requires_idempotency_key?.const === true
    && tt4c.else?.properties?.requires_idempotency_key?.const === false,
    'transport-common-defs restBinding must force method/policy agreement: POST => requires_idempotency_key const true, else (GET) => const false (a create cannot declare itself exempt from the mandatory Idempotency-Key)');

  // TT-5 SAFE/IDEMPOTENT RETRY ONLY: the retryDisposition if/then makes retriable=true impossible
  // unless is_safe OR idempotency_guarded.
  const retry = tdefs.retryDisposition;
  const retryThen = Array.isArray(retry?.allOf) ? retry.allOf.find((s) => s?.if?.properties?.retriable?.const === true) : null;
  H('TT-5', !!retryThen && Array.isArray(retryThen.then?.anyOf)
    && retryThen.then.anyOf.some((s) => s?.properties?.is_safe?.const === true)
    && retryThen.then.anyOf.some((s) => s?.properties?.idempotency_guarded?.const === true),
    'retryDisposition must force retriable=true => (is_safe OR idempotency_guarded) via if/then (no blind retry of a non-safe, non-idempotent op)');

  // TT-6 ASYMMETRIC-ONLY TOKEN: the composed presented token is the W2-F svc-delegation-token, whose
  // header.alg $refs the asymmetric-only jwtAlg (no HS*/none). Bound here by $ref.
  const tokenDoc = doc('cybrik.svc-delegation-token.v1.schema.json');
  const algEnum = doc('cybrik.svc-common-defs.v1.schema.json')?.$defs?.jwtAlg?.enum || [];
  H('TT-6a', /svc-delegation-token\.v1\.schema\.json$/.test(bindProps.presented_token?.$ref || ''), 'inference-transport-binding presented_token must $ref the accepted W2-F svc-delegation-token (composed, not re-stated)');
  H('TT-6b', algEnum.length > 0 && !algEnum.some((a) => /^HS/i.test(a)) && !algEnum.includes('none'), 'the composed token jwtAlg enum must be asymmetric-only (no HS* symmetric, no unsecured none)');
  H('TT-6c', /jwtAlg$/.test(props(tokenDoc?.properties?.header).alg?.$ref || ''), 'the composed token header.alg must $ref the asymmetric-only jwtAlg');

  // TT-7 FAIL-CLOSED ERROR: transport-authorization-error.fail_closed const true.
  H('TT-7', props(errSchema).fail_closed?.const === true, 'transport-authorization-error fail_closed must be const true (no soft/partial authorization)');

  // TT-8 CLOSED STATUS SET: httpErrorStatus is the closed enum {400,401,403,409,422,429,503}; no
  // other 5xx is exposed (fail-closed uniformity). error_class enum is the typed set.
  const STATUS_SET = [400, 401, 403, 409, 422, 429, 503];
  const statusEnum = tdefs.httpErrorStatus?.enum || [];
  H('TT-8a', Array.isArray(statusEnum) && statusEnum.length === STATUS_SET.length && STATUS_SET.every((s) => statusEnum.includes(s)) && !statusEnum.includes(500),
    `httpErrorStatus enum must be exactly {${STATUS_SET.join(',')}} (no 500 or other 5xx leaked)`);
  H('TT-8b', /httpErrorStatus$/.test(props(errSchema).status?.$ref || ''), 'transport-authorization-error.status must $ref the closed httpErrorStatus enum');
  const NEED_CLASSES = ['unauthenticated', 'invalid_token', 'token_expired', 'audience_mismatch', 'proof_of_possession_failed', 'issuer_untrusted', 'cross_tenant', 'operation_mismatch', 'marking_escalation', 'org_scope_mismatch', 'replay_detected', 'idempotency_conflict', 'rate_limited', 'deadline_exceeded', 'feature_disabled', 'malformed_request', 'upstream_unavailable', 'internal'];
  H('TT-8c', NEED_CLASSES.every((c) => (tdefs.transportErrorClass?.enum || []).includes(c)), 'transportErrorClass enum must carry the complete typed 400/401/403/409/422/429/503 class set (incl. the fail-closed internal class)');

  // TT-9 NO SECRET LEAK: the typed error is additionalProperties:false so a credential/key/token
  // value can never be a field; decision_id is echoed for audit correlation.
  H('TT-9a', errSchema?.additionalProperties === false, 'transport-authorization-error must be additionalProperties:false (no access_token/credential/key field can ride along)');
  H('TT-9b', /decisionId$/.test(props(errSchema).decision_id?.$ref || '') && req(errSchema).includes('decision_id'), 'transport-authorization-error must REQUIRE the audited decision_id (every deny is audited under a decision id)');

  // Additional structural stance: internal versioned path template + no PUT/PATCH/DELETE authority +
  // audited decision + feature flag default OFF.
  H('TT-path', tdefs.pathTemplate?.pattern === '^/api/v1/[A-Za-z0-9._~/{}-]*$', 'pathTemplate must be an internal versioned /api/v1/... token (no host/scheme/query)');
  H('TT-method', Array.isArray(tdefs.httpMethod?.enum) && tdefs.httpMethod.enum.every((m) => ['GET', 'POST'].includes(m)) && !tdefs.httpMethod.enum.includes('DELETE'), 'httpMethod enum must be GET|POST only (no PUT/PATCH/DELETE authority over inference resources)');
  H('TT-decision', req(bindProps.decision).includes('decision_id') && req(bindProps.decision).includes('disposition'), 'the audited decision block must REQUIRE decision_id + disposition');
  H('TT-flag-off', tdefs.featureFlagState?.properties?.enabled?.default === false && (tdefs.featureFlagState?.required || []).includes('disabled_behavior'), 'featureFlagState.enabled must DEFAULT false (feature flag default OFF) and require a fail-closed disabled_behavior');

  // ---- Prove each negative-schema fixture actually carries the offending shape (no vacuous pass). --
  const nf = (f) => fixtures[`negative/${f}`];
  H('TT-1x', nf('inference-transport-binding.non-mtls.json')?.transport?.mutual_tls === false, 'non-mtls fixture must set transport.mutual_tls=false so the const-true rejection is exercised');
  H('TT-2x', 'on_behalf_of_user_token' in (nf('inference-transport-binding.forwarded-user-token.json')?.body_advisory || {}), "forwarded-user-token fixture must carry body_advisory.on_behalf_of_user_token so the additionalProperties:false rejection is exercised");
  H('TT-3x', 'model' in (nf('inference-transport-binding.model-authority.json')?.body_advisory || {}) || 'tools' in (nf('inference-transport-binding.model-authority.json')?.body_advisory || {}), "model-authority fixture must carry a body_advisory.model/tools field so the additionalProperties:false rejection is exercised");
  H('TT-4x', (nf('inference-transport-binding.short-idempotency-key.json')?.idempotency_key || '').length < 16, 'short-idempotency-key fixture must carry a <16-char idempotency_key so the minLength rejection is exercised');
  H('TT-5x', nf('inference-transport-binding.unsafe-retry.json')?.rest_binding?.retry?.retriable === true && nf('inference-transport-binding.unsafe-retry.json')?.rest_binding?.retry?.is_safe === false && nf('inference-transport-binding.unsafe-retry.json')?.rest_binding?.retry?.idempotency_guarded === false, 'unsafe-retry fixture must set retriable=true with is_safe=false AND idempotency_guarded=false so the if/then rejection is exercised');
  H('TT-6x', nf('inference-transport-binding.symmetric-token.json')?.presented_token?.header?.alg === 'HS256', "symmetric-token fixture must set the composed token header.alg='HS256' so the asymmetric-only rejection is exercised");
  H('TT-7x', nf('transport-authorization-error.fail-closed-false.json')?.fail_closed === false, 'fail-closed-false fixture must set fail_closed=false so the const-true rejection is exercised');
  H('TT-8x', nf('transport-authorization-error.bad-status.json')?.status === 500, 'bad-status fixture must set status=500 so the closed-enum rejection is exercised');
  H('TT-9x', 'access_token' in (nf('transport-authorization-error.leaked-token.json') || {}), "leaked-token fixture must carry an access_token field so the additionalProperties:false rejection is exercised");

  // ---- TT-4 non-vacuity, proven by EXECUTING the compiled schema. ---------------------------------
  // The on-disk fixture set cannot witness an ABSENT idempotency_key or an inconsistent method/flag
  // pair without adding fixture files, so these cases are derived IN MEMORY from the canonical
  // presentations and run through the real compiled validator. A structural assertion on the schema
  // shape (TT-4b/TT-4c above) proves the rule is written; these prove it actually rejects.
  const tt4Validate = validators['cybrik.inference-transport-binding.v1.schema.json'];
  const canonPost = fixtures['positive/inference-transport-binding.json'];
  const canonGet = fixtures['positive/model-classes-transport-binding.json'];
  const derived = (base, mutate) => { const c = structuredClone(base); mutate(c); return c; };
  if (tt4Validate && canonPost && canonGet) {
    H('TT-4y', tt4Validate(derived(canonPost, (c) => { delete c.idempotency_key; })) === false,
      'a POST create declaring requires_idempotency_key=true MUST be rejected when the ROOT idempotency_key is ABSENT (minLength alone never fires on a missing property — the TT-4 conditional would be vacuous)');
    H('TT-4z', tt4Validate(derived(canonPost, (c) => { c.rest_binding.requires_idempotency_key = false; })) === false,
      'a POST create declaring requires_idempotency_key=false MUST be rejected (a create cannot declare itself exempt from mandatory replay control)');
    H('TT-4w', tt4Validate(derived(canonGet, (c) => { c.rest_binding.requires_idempotency_key = true; })) === false,
      'a GET read declaring requires_idempotency_key=true MUST be rejected (inconsistent method/policy pair)');
    // The conditional is a conjunction on purpose: a safe read whose policy declares NO key must NOT
    // be forced to carry one. This guards against over-tightening TT-4 into a false rejection.
    H('TT-4g', canonGet.rest_binding?.method === 'GET' && canonGet.rest_binding?.requires_idempotency_key === false
      && canonGet.idempotency_key === undefined && tt4Validate(canonGet) === true,
      'a safe GET read declaring requires_idempotency_key=false and carrying NO idempotency_key MUST stay valid (TT-4 must not force a key on a read whose policy says none)');
  } else {
    fail('TT-4 non-vacuity: the compiled binding validator or a canonical positive presentation is unavailable, so the TT-4 conditional could not be exercised (fail closed rather than skip)');
  }

  // ---------------------------------------------------------------------------
  // 5. RUNTIME (negative-semantic) invariants TX-1..TX-8: relying-party checks a schema cannot
  //    express (compare token vs. transport vs. body, evaluate a replay cache, honor the feature
  //    flag). Each negative-semantic fixture is structurally valid but MUST be REJECTED; each
  //    positive presentation MUST be ACCEPTED (so no rule is vacuous). The replay rule is evaluated
  //    against the CANONICAL positive inference presentation (its jti + idempotency_key pair).
  // ---------------------------------------------------------------------------
  const CLASS_RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };
  const TLP_RANK = { 'TLP:CLEAR': 0, 'TLP:GREEN': 1, 'TLP:AMBER': 2, 'TLP:AMBER+STRICT': 3, 'TLP:RED': 4 };
  const markRank = (m) => (m ? { c: CLASS_RANK[m.classification], t: TLP_RANK[m.tlp] } : null);
  const isAbove = (a, b) => { // a exceeds b on at least one lattice axis (marking escalation)
    const x = markRank(a), y = markRank(b);
    if (!x || !y || [x.c, x.t, y.c, y.t].some((v) => v === undefined)) return false;
    return x.c > y.c || x.t > y.t;
  };

  // Canonical positive inference presentation — the "already seen" entry the replay fixture reuses.
  const canon = fixtures['positive/inference-transport-binding.json'];
  const CANON = canon ? {
    binding_id: canon.binding_id,
    jti: canon.presented_token?.claims?.jti,
    idem: canon.idempotency_key,
  } : null;

  // The relying party's terminal verdict for an inference-transport-binding presentation.
  // Returns { reject, tx, reason }. reject:true means a fail-closed invariant a schema alone cannot
  // enforce denies this structurally-valid call.
  const relyingPartyVerdict = (d) => {
    const t = d.presented_token?.claims || {};
    const tr = d.transport || {};
    const rp = d.relying_party || {};
    const body = d.body_advisory || {};
    // TX-1 PROOF-OF-POSSESSION: mTLS peer thumbprint (transport & observed) MUST equal token cnf.
    const cnf = t.cnf?.['x5t#S256'];
    if (tr.peer_cert_thumbprint !== cnf || rp.peer_cert_thumbprint !== cnf) return { reject: true, tx: 'TX-1', reason: `proof-of-possession failed (peer thumbprint != token cnf x5t#S256)` };
    // TX-2 AUDIENCE: token.aud MUST equal the relying party's own audience (confused-deputy defense).
    if (t.aud !== rp.audience) return { reject: true, tx: 'TX-2', reason: `audience mismatch (token.aud '${t.aud}' != relying_party.audience '${rp.audience}')` };
    // Issuer pinning: token.iss MUST be in the pinned accepted_issuers set (accept-side binding).
    if (Array.isArray(rp.accepted_issuers) && !rp.accepted_issuers.includes(t.iss)) return { reject: true, tx: 'TX-issuer', reason: `issuer '${t.iss}' not in pinned accepted_issuers` };
    // TX-3 CROSS-TENANT: authoritative tenant is the token; the advisory body never elevates.
    if (body.tenant_id !== t['cybrik.tenant_id']) return { reject: true, tx: 'TX-3', reason: `cross-tenant (body tenant_id '${body.tenant_id}' != token cybrik.tenant_id '${t['cybrik.tenant_id']}')` };
    // TX-4 OPERATION BINDING: body operation.name MUST equal token cybrik.operation.name AND
    // rest_binding.operation.name (confused-deputy defense).
    const bodyOp = body.operation?.name;
    const tokOp = t['cybrik.operation']?.name;
    const restOp = d.rest_binding?.operation?.name;
    if (bodyOp !== tokOp || bodyOp !== restOp) return { reject: true, tx: 'TX-4', reason: `operation mismatch (body '${bodyOp}' vs token '${tokOp}' vs rest_binding '${restOp}')` };
    // TX-5 MARKING NON-ESCALATION: body data_marking MUST be at or below token cybrik.marking.
    if (isAbove(body.data_marking, t['cybrik.marking'])) return { reject: true, tx: 'TX-5', reason: `marking escalation (body marking above token cybrik.marking on the lattice)` };
    // TX-6 ORG SCOPE: an advisory body org_scope, when present, MUST equal token cybrik.org_scope.
    if (body.org_scope !== undefined && body.org_scope !== t['cybrik.org_scope']) return { reject: true, tx: 'TX-6', reason: `org-scope mismatch (body '${body.org_scope}' != token '${t['cybrik.org_scope']}')` };
    // TX-8 FEATURE FLAG DEFAULT-OFF: a disabled operation MUST NOT be permitted as if enabled.
    // ORDERING: TX-8 is evaluated BEFORE TX-7. A disabled operation must be refused before the
    // replay/idempotency cache is consulted at all — a disabled operation is never admitted to that
    // cache, so a replay verdict on it would be a fiction. Both are fail-closed rejections, so the
    // order changes which typed rule is returned, never whether the call is denied. It is load-bearing
    // for proof: every negative-semantic fixture reuses the canonical (jti, idempotency_key) pair, so
    // a replay-first order would return TX-7 for the declared TX-8 witness and leave TX-8 vacuous.
    /* TX-8:BEGIN */
    if (d.feature_flag?.enabled === false && d.decision?.disposition === 'permit') {
      return { reject: true, tx: 'TX-8', reason: `feature flag off yet decision permits (must apply disabled_behavior, never silently serve)` };
    }
    /* TX-8:END */
    // TX-7 REPLAY: a second presentation reusing the canonical positive (jti, idempotency_key) pair —
    // i.e. same pair but a different binding — MUST be rejected by the replay/idempotency cache.
    /* TX-7:BEGIN */
    if (CANON && d.binding_id !== CANON.binding_id && t.jti === CANON.jti && d.idempotency_key !== undefined && d.idempotency_key === CANON.idem) {
      return { reject: true, tx: 'TX-7', reason: `replay of canonical presentation (jti '${t.jti}' + idempotency_key '${d.idempotency_key}' already seen)` };
    }
    /* TX-7:END */
    return { reject: false };
  };

  // Drive the runtime pass off the manifest: every positive inference-transport-binding MUST be
  // accepted; every negative-semantic MUST be rejected (negative-schema fixtures were already
  // rejected structurally; the error-schema positive has no runtime rule).
  const BINDING_SCHEMA = 'cybrik.inference-transport-binding.v1.schema.json';
  if (exManifest) {
    for (const ex of exManifest.examples || []) {
      const d = fixtures[ex.file];
      if (!d || ex.schema !== BINDING_SCHEMA) continue;
      if (ex.kind === 'positive') {
        const v = relyingPartyVerdict(d);
        bump('runtime_positive_total');
        if (v.reject) fail(`positive example ${ex.file} was REJECTED by a runtime invariant (must be accepted): [${v.tx}] ${v.reason}`);
        else bump('runtime_positive_accept');
      } else if (ex.kind === 'negative-semantic') {
        const v = relyingPartyVerdict(d);
        const want = declaredId(ex);
        bump('runtime_negative_total');
        if (!v.reject) {
          fail(`negative-semantic example ${ex.file} was NOT rejected by any runtime invariant (its declared ${want} invariant is not enforced/exercised)`);
          continue;
        }
        bump('runtime_negative_reject');
        // EXACTNESS, not truthiness. Every negative-semantic fixture violates several rules at once
        // (they all reuse the canonical jti + idempotency_key), so "something rejected it" proves
        // nothing about the rule it was written to witness. The returned rule MUST be the declared
        // primary rule, which is what makes each TX-* non-vacuous.
        if (v.tx !== want) {
          fail(`negative-semantic example ${ex.file}: declared primary invariant ${want}, but the relying party rejected on ${v.tx} — ${v.reason}. The declared witness does not exercise ${want} (rule removed, bypassed, or evaluated in the wrong order).`);
          continue;
        }
        bump('runtime_negative_declared_match');
        bump(`tx_witness_${want}`);
      }
    }
    // Every runtime rule this packet claims MUST have exactly one declared, passing witness. A rule
    // with no witness is an unproven claim; a rule with two is an ambiguous one.
    const RUNTIME_RULES = ['TX-1', 'TX-2', 'TX-3', 'TX-4', 'TX-5', 'TX-6', 'TX-7', 'TX-8'];
    for (const id of RUNTIME_RULES) {
      const n = counts[`tx_witness_${id}`] || 0;
      if (n !== 1) fail(`runtime invariant ${id} is proven by ${n} declared negative-semantic witness(es), expected exactly 1 — ${id} is ${n === 0 ? 'VACUOUS (no fixture rejects on it)' : 'ambiguously witnessed'}`);
    }
    // The same non-vacuity contract for the structural rules: TT-1..TT-9 each declared exactly once.
    const STRUCTURAL_RULES = ['TT-1', 'TT-2', 'TT-3', 'TT-4', 'TT-5', 'TT-6', 'TT-7', 'TT-8', 'TT-9'];
    const ttDeclared = (exManifest.examples || []).filter((ex) => ex.kind === 'negative-schema').map(declaredId);
    for (const id of STRUCTURAL_RULES) {
      const n = ttDeclared.filter((x) => x === id).length;
      if (n < 1) fail(`structural invariant ${id} has no declared negative-schema witness — it is VACUOUS`);
      bump(`tt_witness_${id}`, n);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. The candidate SUCCESSOR OpenAPI mapping notes (v0.2.0 — a compatible revision of the
  //    W2-D-owned inference plane, NOT a second plane): NO servers block; BOTH security schemes
  //    present and AND-required together (mutual-TLS transport AND the certificate-bound at+jwt
  //    delegation token); the closed typed transport-error response set; internal versioned /api/v1
  //    paths only; and agreement with the CLOSED operation registry.
  // ---------------------------------------------------------------------------
  const OPENAPI_PATH = join(CONTRACTS, SUCCESSOR_OPENAPI);
  let oapiText = '';
  let oapi = null;
  try { oapiText = readFileSync(OPENAPI_PATH, 'utf8'); oapi = YAML.parse(oapiText); } catch (e) { fail(`transport OpenAPI mapping notes: cannot read/parse: ${e.message}`); }
  if (oapi) {
    bump('openapi_checked');
    // NO operational server/endpoint.
    if ('servers' in oapi) fail('transport OpenAPI: MUST NOT declare a `servers` block (mapping notes only — no operational endpoint/URL/secret)');
    if (oapi.info?.['x-cybrik-status'] !== (LC?.status || 'PROPOSED')) fail(`transport OpenAPI: info.x-cybrik-status must be '${LC?.status}'`);
    if (oapi.info?.['x-cybrik-not-accepted'] !== (LC ? LC.notAccepted : true)) fail('transport OpenAPI: info.x-cybrik-not-accepted must match the packet lifecycle');
    // Successor identity: the document must declare the same revision the delta pins for it, and must
    // name the predecessor it supersedes — a successor that does not say what it succeeds is a second
    // plane by another name.
    if (oapi.info?.version !== SUCCESSOR_VERSION) fail(`transport OpenAPI: info.version must be ${SUCCESSOR_VERSION} to match the contract_version the delta pins for this member (got '${oapi.info?.version}')`);
    // The successor's own role must track the flip: a PROPOSED-SUCCESSOR before it, the CURRENT owner
    // after. A document whose status says ACCEPTED while its role still says PROPOSED-SUCCESSOR is the
    // half-flip the ownership sweep below is written to catch, so it is refused here at the source.
    const succRole = oapi.info?.['x-cybrik-lifecycle-role'] || '';
    if (APPLIED) {
      if (!/^CURRENT$/i.test(succRole)) fail(`transport OpenAPI: once applied, info.x-cybrik-lifecycle-role must be CURRENT (the successor is now the sole owner of the four pairs) — got '${succRole}'`);
    } else if (!/PROPOSED/.test(succRole)) {
      fail("transport OpenAPI: info.x-cybrik-lifecycle-role must record it as a PROPOSED-SUCCESSOR");
    }
    const supersedes = oapi.info?.['x-cybrik-supersedes'];
    if (supersedes !== PREDECESSOR_OPENAPI.split('/').pop()) fail(`transport OpenAPI: info.x-cybrik-supersedes must name the accepted predecessor '${PREDECESSOR_OPENAPI.split('/').pop()}' (a compatible successor revision of the W2-D-owned plane, not a second plane) — got '${supersedes}'`);
    // BOTH security schemes: a mutual-TLS transport scheme AND a bearer at+jwt (certificate-bound)
    // delegation-token scheme.
    const ss = oapi.components?.securitySchemes || {};
    const mtlsName = Object.keys(ss).find((k) => ss[k]?.type === 'mutualTLS');
    const jwtName = Object.keys(ss).find((k) => ss[k]?.type === 'http' && String(ss[k]?.scheme).toLowerCase() === 'bearer' && /at\+jwt/i.test(ss[k]?.bearerFormat || ''));
    H('OA-mtls', !!mtlsName, 'transport OpenAPI: a securityScheme of type mutualTLS must be declared (E2 mutually-authenticated channel)');
    H('OA-jwt', !!jwtName, 'transport OpenAPI: a securityScheme of type http/bearer with bearerFormat at+jwt must be declared (W2-F certificate-bound delegation token)');
    // The certificate-bound (RFC 8705 cnf / x5t#S256) proof-of-possession must be documented on the
    // token scheme so the two-layer bind is explicit, not just co-present.
    if (jwtName && !/8705|cnf|x5t#S256|certificate-bound|proof-of-possession/i.test(ss[jwtName]?.description || '')) fail('transport OpenAPI: the at+jwt delegation-token scheme description must document the RFC 8705 certificate-bound (cnf/x5t#S256) proof-of-possession');
    // Top-level security MUST require BOTH schemes TOGETHER (a single AND requirement object holding
    // both keys), so a call is authorized only under mTLS AND a valid delegation token.
    const sec = Array.isArray(oapi.security) ? oapi.security : [];
    const bothTogether = mtlsName && jwtName && sec.some((r) => r && typeof r === 'object' && mtlsName in r && jwtName in r);
    H('OA-both', !!bothTogether, 'transport OpenAPI: top-level security must AND-require BOTH the mutualTLS and the at+jwt delegation-token schemes together (bind mTLS + certificate-bound token)');
    // Closed typed transport-error response set surfaced by the paths.
    const responsesText = JSON.stringify(oapi.components?.responses || {}) + JSON.stringify(oapi.paths || {});
    for (const code of ['400', '401', '403', '409', '422', '429', '503']) {
      if (!new RegExp(`"${code}"`).test(responsesText)) fail(`transport OpenAPI: the typed ${code} transport/authorization response must be present`);
    }
    if (/"500"/.test(responsesText)) fail('transport OpenAPI: no 500 (or other non-503 5xx) response may be exposed (fail-closed uniformity)');
    // The typed errors must reference the transport-authorization-error schema.
    if (!/transport-authorization-error\.v1\.schema\.json/.test(oapiText)) fail('transport OpenAPI: typed error responses must reference cybrik.transport-authorization-error.v1.schema.json');
    // Internal versioned /api/v1 paths only (no host/scheme).
    for (const p of Object.keys(oapi.paths || {})) {
      if (!/^\/api\/v1\//.test(p)) fail(`transport OpenAPI: path '${p}' must be an internal versioned /api/v1/... path`);
    }
    // Alert-summarization compatibility surface is present (create path + feature-flag compatibility).
    if (!/\/api\/v1\/summarizations/.test(oapiText)) fail('transport OpenAPI: the alert-summarization create path (/api/v1/summarizations) must be bound (compatibility with the accepted W2-D operation)');
    if (!/compatibility/i.test(oapiText) || !/feature/i.test(oapiText)) fail('transport OpenAPI: must document the feature-flag / alert-summarization compatibility stance');
    // A mandatory Idempotency-Key parameter for the create operations (replay control on the wire).
    if (!/Idempotency-Key/i.test(oapiText)) fail('transport OpenAPI: a mandatory Idempotency-Key header parameter must be declared for the create operations');
    // The CLOSED operation registry must describe THIS document exactly: every registered operation
    // is bound here at the declared path+method with the declared operationId and token, and the
    // document binds no operation the registry omits. This is the second half of the registry check
    // begun in section 3e — a token that drifts between the delta, the fixtures and these bytes is the
    // reconciliation defect the delta records having repaired, and it must not recur silently.
    const oapiOps = new Map(); // `METHOD path` -> { operationId, token }
    for (const [p, item] of Object.entries(oapi.paths || {})) {
      for (const [method, op] of Object.entries(item || {})) {
        if (!op || typeof op !== 'object' || !op.operationId) continue;
        oapiOps.set(`${method.toUpperCase()} ${p}`, { operationId: op.operationId, token: op['x-cybrik-operation-token'] });
      }
    }
    const registryOps = Array.isArray(delta?.operation_registry?.operations) ? delta.operation_registry.operations : [];
    for (const rop of registryOps) {
      const key = `${rop.method} ${rop.path}`;
      const bound = oapiOps.get(key);
      if (!bound) { fail(`transport OpenAPI: the registered operation '${rop.token}' (${key}) is not bound by the successor mapping notes`); continue; }
      if (bound.operationId !== rop.operationId) fail(`transport OpenAPI: ${key} declares operationId '${bound.operationId}', but the operation registry pins '${rop.operationId}'`);
      if (bound.token !== rop.token) fail(`transport OpenAPI: ${key} declares x-cybrik-operation-token '${bound.token}', but the CLOSED operation registry (and its positive fixture) pins '${rop.token}' — the token must be spelled identically in the delta, the fixtures and these bytes`);
      else bump('openapi_operation_bound');
    }
    for (const key of oapiOps.keys()) {
      if (!registryOps.some((rop) => `${rop.method} ${rop.path}` === key)) fail(`transport OpenAPI: ${key} is bound by the successor mapping notes but is absent from the CLOSED operation registry (unregistered operation on this seam)`);
    }
    bump('openapi_ok');
  }

  // ---------------------------------------------------------------------------
  // 6b. RESPONSE-BINDING PRESERVATION against the BYTE-FROZEN ACCEPTED PREDECESSOR.
  //
  //     Section 6 proves the successor binds the right OPERATIONS. It says nothing about what those
  //     operations RETURN, so a successor could keep every path, method, operationId and token and
  //     still delete the ACCEPTED W2-D ModelInferenceError branch from an error surface — narrowing an
  //     accepted response contract while every other rule stays green. A client generated against the
  //     accepted predecessor would then receive a shape its successor no longer admits.
  //
  //     The accepted floor is READ OFF THE PREDECESSOR'S BYTES, never restated here: its (METHOD,
  //     path) pairs, its statuses, its bindings, and which statuses it binds to the ModelInferenceError
  //     file. The rules are then:
  //       - every predecessor pair is still bound by the successor;
  //       - every predecessor status is still bound, and every NON-error-surface status (the 200s) is
  //         preserved verbatim — compared after local $ref resolution, so an aliasing difference in
  //         component names is not mistaken for a contract change;
  //       - on every status the predecessor binds to ModelInferenceError (422/503 on the two creates),
  //         AND on those same statuses wherever the successor ADDS them to the safe reads, the bound
  //         schema must be a oneOf whose branch set is EXACTLY {accepted ModelInferenceError, proposed
  //         TransportAuthorizationError} — rejecting a missing, extra, duplicated, swapped, collapsed
  //         (anyOf/allOf/single-shape) or unresolvable branch set alike.
  //
  //     An unreadable predecessor is a REJECTION, never a skip: with no accepted floor, preservation is
  //     unevaluable, and unevaluable is not preserved.
  // ---------------------------------------------------------------------------
  const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
  // The identity of a bound shape is the SCHEMA FILE it ultimately names. Local component names
  // ('#/components/schemas/ModelInferenceError') are an aliasing detail the two documents spell
  // differently for the same file, which is why every comparison below resolves through them.
  const ACCEPTED_ERROR_SCHEMA = 'cybrik.model-inference-error.v1.schema.json';
  const TRANSPORT_ERROR_SCHEMA = 'cybrik.transport-authorization-error.v1.schema.json';
  const DUAL_BRANCH_SET = [ACCEPTED_ERROR_SCHEMA, TRANSPORT_ERROR_SCHEMA].sort();
  const RB = 'response-binding preservation';

  const jsonPointer = (docRoot, ref) => ref.slice(2).split('/')
    .map((seg) => decodeURIComponent(seg).replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((o, seg) => (o && typeof o === 'object' ? o[seg] : undefined), docRoot);
  // Follow a chain of LOCAL ('#/...') $refs to the node it names. A dangling or cyclic chain returns
  // null — an unresolvable binding is unevaluable, and unevaluable is a rejection.
  const followLocal = (docRoot, node) => {
    let cur = node;
    const seen = new Set();
    while (cur && typeof cur === 'object' && typeof cur.$ref === 'string' && cur.$ref.startsWith('#/')) {
      if (seen.has(cur.$ref)) return null;
      seen.add(cur.$ref);
      cur = jsonPointer(docRoot, cur.$ref);
    }
    return (cur && typeof cur === 'object') ? cur : null;
  };
  // Deep copy with every LOCAL $ref replaced by what it names and keys sorted, so two documents that
  // spell the same binding through different component names compare equal. EXTERNAL
  // ('../json-schema/…') refs are the terminals and are kept verbatim — they ARE the bound shape.
  const resolveDeep = (docRoot, node, depth = 0) => {
    if (depth > 16) return '__CYBRIK_REF_DEPTH_EXCEEDED__';
    if (Array.isArray(node)) return node.map((v) => resolveDeep(docRoot, v, depth + 1));
    if (!node || typeof node !== 'object') return node;
    if (typeof node.$ref === 'string' && node.$ref.startsWith('#/')) {
      const t = jsonPointer(docRoot, node.$ref);
      return t === undefined ? `__CYBRIK_DANGLING_REF__${node.$ref}` : resolveDeep(docRoot, t, depth + 1);
    }
    const out = {};
    for (const k of Object.keys(node).sort()) out[k] = resolveDeep(docRoot, node[k], depth + 1);
    return out;
  };
  const canonicalBinding = (docRoot, node) => JSON.stringify(resolveDeep(docRoot, node));
  // The application/json schema a response object binds, with local indirection resolved.
  const jsonSchemaOf = (docRoot, responseNode) => {
    const r = followLocal(docRoot, responseNode);
    return r ? followLocal(docRoot, r.content?.['application/json']?.schema) : null;
  };
  // The external schema FILE (basename) a node ultimately names, or null if it names none.
  const externalTarget = (docRoot, node) => {
    const n = followLocal(docRoot, node);
    const ref = (n && typeof n.$ref === 'string') ? n.$ref : '';
    return ref && !ref.startsWith('#') ? ref.split('/').pop() : null;
  };
  const operationsOf = (d) => {
    const out = new Map();
    for (const [p, item] of Object.entries(d?.paths || {})) {
      for (const [method, op] of Object.entries(item || {})) {
        if (HTTP_METHODS.has(method.toLowerCase()) && op && typeof op === 'object') out.set(`${method.toUpperCase()} ${p}`, op);
      }
    }
    return out;
  };

  let predOapi = null;
  try {
    predOapi = YAML.parse(readFileSync(join(CONTRACTS, PREDECESSOR_OPENAPI), 'utf8'));
  } catch (e) {
    fail(`${RB}: the ACCEPTED predecessor ${PREDECESSOR_OPENAPI} cannot be read/parsed, so the accepted response floor (its statuses and its ModelInferenceError bindings) is UNKNOWN and preservation is unevaluable (fail closed, never skipped): ${e.message}`);
  }
  if (oapi && predOapi) {
    const predOps = operationsOf(predOapi);
    const succOps = operationsOf(oapi);
    if (predOps.size === 0) fail(`${RB}: the ACCEPTED predecessor ${PREDECESSOR_OPENAPI} declares no operation on disk, so there is no accepted response floor to preserve (fail closed)`);
    // WHICH statuses carry the accepted error shape is derived from the predecessor bytes, not
    // assumed to be 422/503 — if the accepted plane moves that binding, this rule moves with it.
    const acceptedErrorStatuses = new Set();
    for (const [, pop] of predOps) {
      for (const [code, pr] of Object.entries(pop.responses || {})) {
        if (externalTarget(predOapi, jsonSchemaOf(predOapi, pr)) === ACCEPTED_ERROR_SCHEMA) acceptedErrorStatuses.add(code);
      }
    }
    if (predOps.size > 0 && acceptedErrorStatuses.size === 0) {
      fail(`${RB}: no status of the ACCEPTED predecessor ${PREDECESSOR_OPENAPI} resolves to ${ACCEPTED_ERROR_SCHEMA}, so the accepted error surface could not be derived from its bytes — the 422/503 oneOf preservation rule would be vacuous (fail closed rather than assume the statuses)`);
    }
    bump('response_accepted_error_statuses', acceptedErrorStatuses.size);

    for (const [key, pop] of predOps) {
      const sop = succOps.get(key);
      if (!sop) {
        fail(`${RB}: ${key} is declared by the ACCEPTED predecessor but bound by no successor operation, so its accepted response surface (including its ${[...acceptedErrorStatuses].sort().join('/') || 'error'} bindings) is dropped outright`);
        continue;
      }
      bump('response_operations_checked');
      const sResponses = sop.responses || {};
      // (i) Every accepted status survives; every accepted NON-error-surface binding survives verbatim.
      for (const [code, pr] of Object.entries(pop.responses || {})) {
        if (!(code in sResponses)) {
          fail(`${RB}: ${key} drops the accepted predecessor response status ${code} — a compatible successor revision may ADD statuses, never remove one the ACCEPTED plane binds`);
          continue;
        }
        if (acceptedErrorStatuses.has(code)) continue; // judged as a two-branch surface in (ii)
        const want = canonicalBinding(predOapi, pr);
        const got = canonicalBinding(oapi, sResponses[code]);
        if (want !== got) fail(`${RB}: ${key} response ${code} is not preserved verbatim against the byte-frozen accepted predecessor — accepted ${want}, successor ${got}`);
        else bump('response_status_preserved');
      }
      // (ii) Every status the predecessor binds to the accepted error shape — and every such status the
      //      successor ADDS to an operation that lacked it — must be the EXACT two-branch oneOf.
      for (const code of [...acceptedErrorStatuses].sort()) {
        const sr = sResponses[code];
        if (sr === undefined) continue; // an accepted status the successor drops is already reported in (i)
        bump('dual_branch_response_total');
        const schema = jsonSchemaOf(oapi, sr);
        if (!schema) {
          fail(`${RB}: ${key} response ${code} binds no resolvable application/json schema, so it cannot be shown to retain the accepted ModelInferenceError (${ACCEPTED_ERROR_SCHEMA}) branch of its oneOf`);
          continue;
        }
        if (!Array.isArray(schema.oneOf)) {
          const shape = Array.isArray(schema.anyOf) ? 'anyOf' : (Array.isArray(schema.allOf) ? 'allOf' : 'a single non-composed shape');
          fail(`${RB}: ${key} response ${code} must bind a oneOf of the two typed error branches, but binds ${shape} — collapsing or re-composing the oneOf changes which shapes the accepted ModelInferenceError surface admits`);
          continue;
        }
        const targets = schema.oneOf.map((b) => externalTarget(oapi, b));
        const unique = [...new Set(targets)].sort();
        const missing = DUAL_BRANCH_SET.filter((w) => !unique.includes(w));
        const unexpected = unique.filter((u) => !DUAL_BRANCH_SET.includes(u));
        const duplicated = targets.length !== unique.length;
        if (schema.oneOf.length !== 2 || missing.length > 0 || unexpected.length > 0 || duplicated) {
          fail(`${RB}: ${key} response ${code} must bind a oneOf whose branch set is EXACTLY the accepted ModelInferenceError (${ACCEPTED_ERROR_SCHEMA}) plus the proposed TransportAuthorizationError (${TRANSPORT_ERROR_SCHEMA}) — got ${schema.oneOf.length} branch(es) [${targets.map((t) => t || 'UNRESOLVABLE').join(', ')}]${missing.length ? `; MISSING ${missing.join(', ')}` : ''}${unexpected.length ? `; UNEXPECTED ${unexpected.join(', ')}` : ''}${duplicated ? '; DUPLICATED branch' : ''}. Dropping, duplicating, swapping or padding a branch narrows or widens an ACCEPTED W2-D response contract, which this compatible successor revision may not do.`);
          continue;
        }
        bump('dual_branch_response_ok');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7. LIFECYCLE-AWARE PATH-OWNERSHIP SWEEP over EVERY OpenAPI document on disk.
  //
  //    Founder Option A resolved single ownership of the four inference operations. Section 3d only
  //    proves the two WITHDRAWN FILENAMES are absent, and section 6 only reads the one delta-pinned
  //    successor — a rogue document under any OTHER name walks straight past both. This sweep is
  //    name-blind: it enumerates every contracts/openapi/*.openapi.yaml, classifies each document's
  //    lifecycle from its own info block, normalizes its (METHOD, path) pairs and counts owners.
  //
  //    A document is a CURRENT/ACCEPTED owner if its x-cybrik-lifecycle-role says CURRENT **or** its
  //    x-cybrik-status is ACCEPTED FOR IMPLEMENTATION; anything else is a proposed successor. The
  //    disjunction is deliberate — a half-flip (role still PROPOSED-SUCCESSOR, status already
  //    ACCEPTED) claims accepted authority over pairs it does not own, and must count as an owner.
  //
  //    SUPERSESSION IS A THIRD STATE, AND IT IS NOT READABLE FROM THE DOCUMENT. A superseded document
  //    keeps its own x-cybrik-status: ACCEPTED FOR IMPLEMENTATION forever, because supersession
  //    relabels the member row in the accepted manifest and never rewrites the superseded bytes
  //    (G-W2I-4). So after the flip the predecessor would still classify as an owner by its own info
  //    block, and the four pairs would show two CURRENT owners — a false positive that would make the
  //    correct post-flip state unrepresentable. The classifier therefore consults the ACCEPTED
  //    MANIFEST's member rows, which are the authority on supersession, and demotes any document the
  //    manifest labels SUPERSEDED-SUPPORTED out of ownership entirely.
  //
  //    For the four inference pairs — defined as whatever the BYTE-FROZEN predecessor declares, so
  //    the authority is the accepted document itself rather than a list restated here:
  //      - WHILE PROPOSED: exactly ONE CURRENT owner (the predecessor the delta pins), and at most
  //        ONE PROPOSED successor (the successor the delta pins).
  //      - ONCE APPLIED: exactly ONE CURRENT owner and it must be the SUCCESSOR; the predecessor must
  //        be SUPERSEDED (not an owner); and there must be NO remaining proposed successor, because a
  //        successor that stayed PROPOSED through its own flip is a half-flip.
  //    Documents whose pairs are disjoint from those four (the accepted fabric control plane, say)
  //    are untouched by the rule. A parse failure is a REJECTION, never a skip: an unparseable
  //    document may be declaring the very same owned pairs and we would never know.
  // ---------------------------------------------------------------------------
  const OPENAPI_DIR = join(CONTRACTS, 'openapi');
  const CURRENT_ROLE = 'CURRENT';
  const SUCCESSOR_ROLE = 'PROPOSED-SUCCESSOR';
  const SUPERSEDED_ROLE = 'SUPERSEDED';
  // Supersession authority: the accepted manifest's member rows, never the superseded document.
  const supersededFiles = new Set(
    (w2dManifest?.members || [])
      .filter((m) => m && typeof m.file === 'string' && m.lifecycle === 'SUPERSEDED-SUPPORTED')
      .map((m) => m.file),
  );
  const pairOwners = new Map();   // 'METHOD /path' -> { CURRENT: [file], 'PROPOSED-SUCCESSOR': [file], SUPERSEDED: [file] }
  const declaredPairs = new Map(); // 'openapi/<file>' -> Set of 'METHOD /path'
  if (!existsSync(OPENAPI_DIR)) {
    fail('OpenAPI ownership sweep: contracts/openapi is missing, so single ownership of the four inference operations cannot be evaluated (fail closed)');
  } else {
    for (const f of readdirSync(OPENAPI_DIR).sort()) {
      if (!/\.openapi\.ya?ml$/.test(f)) continue;
      const rel = `openapi/${f}`;
      let d;
      try {
        d = YAML.parse(readFileSync(join(OPENAPI_DIR, f), 'utf8'));
      } catch (e) {
        fail(`OpenAPI ownership sweep: ${rel} could not be parsed, so its path declarations are UNKNOWN and its ownership claim unevaluable (fail closed, never silently ignored): ${e.message}`);
        continue;
      }
      if (!d || typeof d !== 'object') {
        fail(`OpenAPI ownership sweep: ${rel} did not parse to an OpenAPI document object, so its path declarations are UNKNOWN (fail closed)`);
        continue;
      }
      bump('openapi_documents_swept');
      const role = d.info?.['x-cybrik-lifecycle-role'];
      const isCurrent = /^CURRENT$/i.test(String(role || '')) || d.info?.['x-cybrik-status'] === 'ACCEPTED FOR IMPLEMENTATION';
      // Supersession wins over the document's self-description, and only over an otherwise-CURRENT
      // one: a PROPOSED document the manifest never adopted cannot be "superseded" by anything.
      const owns = supersededFiles.has(rel) && isCurrent ? SUPERSEDED_ROLE : (isCurrent ? CURRENT_ROLE : SUCCESSOR_ROLE);
      const mine = new Set();
      for (const [p, item] of Object.entries(d.paths || {})) {
        for (const method of Object.keys(item || {})) {
          if (!HTTP_METHODS.has(method.toLowerCase())) continue;
          const key = `${method.toUpperCase()} ${p}`;
          mine.add(key);
          if (!pairOwners.has(key)) pairOwners.set(key, { [CURRENT_ROLE]: [], [SUCCESSOR_ROLE]: [], [SUPERSEDED_ROLE]: [] });
          pairOwners.get(key)[owns].push(rel);
        }
      }
      declaredPairs.set(rel, mine);
      bump('openapi_pairs_swept', mine.size);
    }
  }
  const ownedPairs = declaredPairs.get(PREDECESSOR_OPENAPI) || new Set();
  if (ownedPairs.size === 0) {
    fail(`OpenAPI ownership sweep: the accepted predecessor ${PREDECESSOR_OPENAPI} declares no (method, path) pair on disk, so the owned inference surface is unknown and single ownership cannot be proven (fail closed)`);
  }
  const pinnedCurrent = delta?.ownership?.current_owner?.file;
  const pinnedSuccessor = delta?.ownership?.proposed_successor?.file;
  // Whichever document must be the sole CURRENT owner of the four pairs, in this lifecycle state.
  const expectedOwner = APPLIED ? SUCCESSOR_OPENAPI : PREDECESSOR_OPENAPI;
  for (const key of [...ownedPairs].sort()) {
    const o = pairOwners.get(key) || { [CURRENT_ROLE]: [], [SUCCESSOR_ROLE]: [], [SUPERSEDED_ROLE]: [] };
    const cur = o[CURRENT_ROLE];
    const succ = o[SUCCESSOR_ROLE];
    const sup = o[SUPERSEDED_ROLE] || [];
    if (cur.length !== 1) {
      fail(`OpenAPI ownership sweep: ${key} must have exactly ONE CURRENT owner, found ${cur.length} [${cur.join(', ') || 'none'}] — Founder Option A permits a single CURRENT owner of the four inference operations, so a second accepted/CURRENT document declaring the same pair is rejected whatever its filename or version`);
    } else if (cur[0] !== expectedOwner) {
      fail(APPLIED
        ? `OpenAPI ownership sweep: ${key} names '${cur[0]}' as its CURRENT owner, but once the Gate W2-I flip is applied the successor ${SUCCESSOR_OPENAPI} is the sole CURRENT owner and the predecessor is SUPERSEDED-SUPPORTED`
        : `OpenAPI ownership sweep: ${key} names '${cur[0]}' as its CURRENT owner, but the accepted predecessor ${PREDECESSOR_OPENAPI} is the sole CURRENT owner until a recorded Gate W2-I flip`);
    } else if (!APPLIED && pinnedCurrent && cur[0] !== pinnedCurrent) {
      fail(`OpenAPI ownership sweep: ${key} CURRENT owner '${cur[0]}' is not the CURRENT owner the delta pins ('${pinnedCurrent}')`);
    } else if (APPLIED && pinnedSuccessor && cur[0] !== pinnedSuccessor) {
      fail(`OpenAPI ownership sweep: ${key} CURRENT owner '${cur[0]}' is not the successor the delta pins ('${pinnedSuccessor}') — the applied flip must promote exactly the reviewed successor, not some other document`);
    } else {
      bump('owned_pair_current_ok');
    }
    if (APPLIED) {
      // Post-flip there is no proposal left to hold: a document still classifying as a proposed
      // successor of an already-flipped pair never completed its own flip.
      if (succ.length !== 0) {
        fail(`OpenAPI ownership sweep: ${key} still carries ${succ.length} PROPOSED successor document(s) [${succ.join(', ')}] after the Gate W2-I flip — the flip promotes the successor to CURRENT and leaves no proposal behind; a residual proposed successor is a half-flip`);
      } else {
        bump('owned_pair_successor_ok');
      }
      // The predecessor must actually be present and demoted, not deleted. Deleting it would also
      // satisfy "one CURRENT owner" while silently destroying the deprecation window.
      if (!sup.includes(PREDECESSOR_OPENAPI)) {
        fail(`OpenAPI ownership sweep: ${key} does not carry ${PREDECESSOR_OPENAPI} as a SUPERSEDED document — after the flip the predecessor must remain on disk, byte-frozen, and be labelled SUPERSEDED-SUPPORTED by the accepted manifest`);
      } else {
        bump('owned_pair_superseded_ok');
      }
    } else if (succ.length > 1) {
      fail(`OpenAPI ownership sweep: ${key} carries ${succ.length} PROPOSED successor documents [${succ.join(', ')}] — at most ONE delta-linked proposed successor may duplicate the accepted path declarations; a second successor re-creates the two-owner condition Option A refused, under a different filename/version`);
    } else if (succ.length === 1 && pinnedSuccessor && succ[0] !== pinnedSuccessor) {
      fail(`OpenAPI ownership sweep: ${key} PROPOSED successor '${succ[0]}' is not the delta-linked successor '${pinnedSuccessor}' — an unlinked successor owns accepted paths with no delta recording the proposal`);
    } else {
      bump('owned_pair_successor_ok');
    }
  }
  bump('ownership_sweep_pairs', ownedPairs.size);

  return { errors, counts, lifecycle: EXPECTED_STATE };
}

// ---------------------------------------------------------------------------
// CLI wrapper. Runs ONLY on direct invocation; an import of this module is inert.
//
// The guard realpaths BOTH sides. Node resolves an ESM entry point through symlinks before it
// reaches import.meta.url, while process.argv[1] keeps the path as it was typed, so the naive
// argv[1] === fileURLToPath(import.meta.url) comparison silently exits 0 having run NOTHING under a
// symlinked invocation path (on macOS /tmp and /var are themselves symlinks, so this is the normal
// case, not a corner one). Fail-closed: a missing argv or an unresolvable path returns false rather
// than guessing.
// ---------------------------------------------------------------------------
export function isMainModule(metaUrl, argv1 = process.argv[1]) {
  if (!metaUrl || !argv1) return false;
  let self;
  try { self = fileURLToPath(metaUrl); } catch { return false; }
  try { return realpathSync(self) === realpathSync(resolve(argv1)); } catch { return false; }
}

// ---------------------------------------------------------------------------
// Presentation. `formatValidationReport` turns a runValidation() result into the EXACT stdout lines,
// stderr lines and exit code the command line emits. It is pure — no console, no process, no I/O —
// so the same rendering serves the CLI below and any harness that runs the core against a disposable
// packet copy and needs the operator-visible report rather than the raw arrays. Splitting it out
// also puts the fallbacks where they can be executed and instrumented: an `if (isMainModule(...))`
// block is unreachable to every in-process caller, so the banner's own arithmetic would otherwise be
// the one part of this file no test could drive.
//
// The fallbacks are load-bearing, not decoration. A run that failed early never bumps some counters,
// and a candidate whose lifecycle could not be read returns null; the banner must then render a
// literal 0 / UNKNOWN rather than `undefined`, and must never silently drop a clause. Nothing here
// decides anything: the verdict is `errors.length`, and it is computed by runValidation.
// ---------------------------------------------------------------------------
export const REPORT_HEADER =
  '=== W2-I inference-plane transport binding vs. the ACCEPTED W2-D packet — JSON Schema / fixtures / invariant / integrity / ownership / OpenAPI validation ===';

export function formatValidationReport(result) {
  const { errors, counts, lifecycle } = result || {};
  // The banner reports the state it actually validated. A report that says "unapplied" after an
  // applied run would be the same class of defect the validator exists to catch, one level up.
  const applied = lifecycle === 'ACCEPTED FOR IMPLEMENTATION';
  const errs = errors || [];
  const c = counts || {};
  const stdout = [REPORT_HEADER, `counts: ${JSON.stringify(c)}`];
  const stderr = [];

  if (errs.length) {
    stderr.push(`\nFAIL — ${errs.length} error(s):`);
    for (const e of errs) stderr.push('  - ' + e);
    return { stdout, stderr, exitCode: 1 };
  }

  stdout.push(
    `\nOK — transport-binding candidate passes JSON Schema 2020-12 compile/ref-resolution; ` +
    `all fixtures (${c.positive_pass || 0} positive + ${c.negative_schema_reject || 0} negative-schema + ${c.runtime_negative_reject || 0} negative-semantic); ` +
    `integrity (${c.member_sha_verified || 0} candidate-member + ${c.upstream_pin_verified || 0} upstream-accepted + ${c.examples_manifest_sha_verified || 0} examples-manifest + ${c.example_sha_verified || 0}/${c.example_inventory_on_disk || 0} support-fixture SHA-256 digests, inventory closed with no duplicate or orphan); ` +
    `${c.invariants_checked || 0} structural assertions (${c.invariants_ok || 0} ok) covering TT-1..TT-9; ` +
    `${c.runtime_negative_declared_match || 0}/${c.runtime_negative_total || 0} negative-semantic fixtures rejected on EXACTLY their declared TX rule, witnessing each of TX-1..TX-8 once; ` +
    `delta self-denial (${applied ? 'consumed applied record, still NOT a manifest' : 'proposed-delta, NOT a manifest, unapplied'}) + single-owner ownership + ${c.withdrawn_artifact_absent || 0} withdrawn second-plane artifacts absent + ` +
    (applied
      ? `ADR-0001 D5/D6 (the accepted W2-D manifest declares all ${c.applied_member_pin_agreed || 0} absorbed members at digests agreeing with the delta, relabels the predecessor SUPERSEDED-SUPPORTED byte-frozen, and records the gate decision) + `
      : `ADR-0001 D6 (the accepted W2-D manifest's own bytes reference no candidate material) + `) +
    `a lifecycle-aware sweep of ${c.openapi_documents_swept || 0} OpenAPI document(s)/${c.openapi_pairs_swept || 0} declared pairs proving ${c.owned_pair_current_ok || 0}/${c.ownership_sweep_pairs || 0} owned pairs keep exactly one CURRENT owner and ` +
    (applied
      ? `${c.owned_pair_successor_ok || 0}/${c.ownership_sweep_pairs || 0} carry no residual proposed successor and ${c.owned_pair_superseded_ok || 0}/${c.ownership_sweep_pairs || 0} keep the superseded predecessor on disk + `
      : `${c.owned_pair_successor_ok || 0}/${c.ownership_sweep_pairs || 0} at most one delta-linked PROPOSED successor + `) +
    `${c.registry_operation_witnessed || 0}/${c.openapi_operation_bound || 0} closed-registry operations agreeing across delta, fixtures and the successor bytes; ` +
    `response-binding preservation over ${c.response_operations_checked || 0} accepted operation(s) — ${c.response_status_preserved || 0} accepted non-error binding(s) preserved verbatim and ` +
    `${c.dual_branch_response_ok || 0}/${c.dual_branch_response_total || 0} error surfaces on the ${c.response_accepted_error_statuses || 0} accepted error status(es) carrying EXACTLY the accepted ModelInferenceError + TransportAuthorizationError oneOf branch set; ` +
    `the OpenAPI mTLS+at+jwt security bind. ` +
    `Lifecycle: ${lifecycle || 'UNKNOWN'} — schemas/fixtures v${EXPECTED_VERSION}, successor OpenAPI v${SUCCESSOR_VERSION}. ` +
    (applied
      ? `Conformance evidence only. This run is NOT the acceptance: Gate W2-I was decided by the recorded gate decision, and this delta was APPLIED into the ACCEPTED W2-D packet. It proves no runtime, endpoint, deployment or release readiness, and it does not discharge the open items the acceptance carried forward — notably the accepted W2-F operation-token table, which this flip did not amend.`
      : `Conformance evidence only; this is NOT acceptance and NOT implementation authorization, and the delta remains UNAPPLIED against the ACCEPTED W2-D packet.`),
  );
  return { stdout, stderr, exitCode: 0 };
}

if (isMainModule(import.meta.url)) {
  const report = formatValidationReport(runValidation());
  for (const line of report.stdout) console.log(line);
  for (const line of report.stderr) console.error(line);
  process.exitCode = report.exitCode;
}
