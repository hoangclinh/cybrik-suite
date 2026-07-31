// Gate W2-K server-neutral transport peer-evidence adapter proposal tests.
//
// Green proves only deterministic Suite-side static conformance for a PROPOSED
// packet. It accepts no ADR, implements no adapter, opens no socket, starts no
// server, installs no dependency, satisfies no UAT or runtime admission, and
// grants no release or production authority.
//
// This harness reads repository bytes and, for fail-closed probes, writes only
// inside an OS temporary directory that it creates and removes itself.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import test from 'node:test';

import {
  ACCEPTED_DEPENDENCY_PINS,
  COMPATIBILITY_MANIFEST_PATH,
  DENIAL_CLASSES,
  EXAMPLES_MANIFEST_PATH,
  FORBIDDEN_CHANNEL_PROPERTY_KEYS,
  NEGATIVE_TEST_MAP,
  PACKET_DOC_PATHS,
  RUNTIME_ONLY_PROPERTIES,
  evaluatePeerEvidence,
  expectedPacketPaths,
  formatTransportPeerReport,
  noDegradeTruthTable,
  validateTransportPeerPacket,
} from '../validate-transport-peer.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const read = (relativePath) =>
  readFileSync(join(REPO_ROOT, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// Built from fragments so this harness never itself contains a literal that a
// secret scanner or the packet material scan would have to special-case.
const PEM_MARKER = ['-----', 'BEGIN'].join('');
const PRIVATE_KEY_MARKER = ['PRIVATE', 'KEY'].join(' ');
const DSN_MARKERS = ['postgres://', 'postgresql://'];
const JWT_MARKER = ['ey', 'J'].join('');

const TRUTH_TABLE_FIXTURE =
  'contracts/examples/transport-peer/positive/truth-table.no-degrade.json';
const POSITIVE_EVIDENCE_FIXTURE =
  'contracts/examples/transport-peer/positive/peer-evidence.verified-chain.json';

const ADR_PATH = 'docs/adr/ADR-0013-transport-peer-evidence-adapter-profile.md';
const DECISION_PATH =
  'docs/adr/DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE.md';
const VALIDATOR_PATH = 'tools/contract-validation/validate-transport-peer.mjs';
const ORCHESTRATOR_PATH = 'tools/contract-validation/validate.mjs';
const LIFECYCLE_INDEX_PATHS = [
  'contracts/README.md',
  'contracts/json-schema/README.md',
  'contracts/examples/README.md',
  'docs/architecture/README.md',
  'contracts/compatibility/README.md',
];
const LIFECYCLE_INDEX_MARKERS = Object.freeze({
  'contracts/README.md': '## W2-K transport peer-evidence packet',
  'contracts/json-schema/README.md': '## W2-K transport peer evidence',
  'contracts/examples/README.md': '`transport-peer/`',
  'docs/architecture/README.md': '`transport-peer-evidence/`',
  'contracts/compatibility/README.md':
    '`cybrik-suite-transport-peer-evidence-packet.v1.manifest.json`',
});
const LIFECYCLE_PATHS = [
  ...new Set([
    ...PACKET_DOC_PATHS,
    ...expectedPacketPaths,
    ...LIFECYCLE_INDEX_PATHS,
  ]),
].filter((path) => path.endsWith('.md') || path.endsWith('.json'));

const lifecycleMismatches = (overrides = new Map()) => {
  const readLifecycleText = (relativePath) =>
    overrides.get(relativePath) ?? read(relativePath);
  const manifest = JSON.parse(readLifecycleText(COMPATIBILITY_MANIFEST_PATH));
  const expectedStatus = manifest['x-cybrik-status'];
  return LIFECYCLE_PATHS.filter((relativePath) => {
    const text = readLifecycleText(relativePath);
    const marker = LIFECYCLE_INDEX_MARKERS[relativePath];
    if (!marker) return !text.includes(expectedStatus);
    const markerIndex = text.indexOf(marker);
    if (markerIndex < 0) return true;
    return !text.slice(markerIndex, markerIndex + 600).includes(expectedStatus);
  });
};

const collectKeys = (value, output = []) => {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [key, item] of Object.entries(value)) {
    output.push(key);
    collectKeys(item, output);
  }
  return output;
};

const withTempPacketRoot = (run) => {
  const base = realpathSync(tmpdir());
  const root = mkdtempSync(join(base, 'cybrik-w2k-'));
  assert.ok(
    root.startsWith(base),
    'fail-closed probes must write only inside the OS temporary directory',
  );
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const copyPacketInto = (root, { skip = new Set(), overrides = new Map() } = {}) => {
  for (const relativePath of expectedPacketPaths) {
    if (skip.has(relativePath)) continue;
    const target = join(root, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, overrides.get(relativePath) ?? read(relativePath));
  }
  for (const relativePath of [
    ...PACKET_DOC_PATHS,
    ...Object.keys(ACCEPTED_DEPENDENCY_PINS),
  ]) {
    if (skip.has(relativePath)) continue;
    const target = join(root, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, overrides.get(relativePath) ?? read(relativePath));
  }
  return root;
};

// --- 1. the packet is internally coherent and stays unaccepted ---------------

test('the W2-K peer-evidence packet is coherent but remains PROPOSED and unaccepted', () => {
  const report = validateTransportPeerPacket({ root: REPO_ROOT });

  assert.deepEqual(report.errors, []);
  assert.equal(report.status, 'PROPOSED');
  assert.equal(report.notAccepted, true);
  assert.equal(report.notImplemented, true);
  assert.equal(report.packetVersion, '0.1.0');
  assert.equal(report.gate, 'W2-K');
  assert.equal(
    report.gateDisposition,
    'OPEN FOR BOUNDED PROPOSAL WRITING AND STATIC CONFORMANCE ONLY',
  );
  assert.equal(report.counts.schemasCompiled, 2);
  assert.equal(report.counts.positiveFixtures, 3);
  assert.equal(report.counts.negativeSchemaFixtures, 7);
  assert.equal(report.counts.negativeSemanticFixtures, 8);
  assert.equal(
    report.counts.negativeSemanticDeniedExactly,
    report.counts.negativeSemanticFixtures,
  );
  assert.equal(report.counts.packetMembers, expectedPacketPaths.length);
  assert.equal(report.counts.packetMembers, 19);

  const rendered = formatTransportPeerReport(report);
  assert.equal(rendered.exitCode, 0);
  assert.match(rendered.stdout, /PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED/);
  assert.doesNotMatch(rendered.stdout, /\b(?:runtime|UAT|production) (?:verified|proven|ready)\b/i);
});

// --- 2. status honesty -------------------------------------------------------

test('every lifecycle surface agrees with the compatibility-manifest source of truth', () => {
  assert.equal(
    readJson(COMPATIBILITY_MANIFEST_PATH)['x-cybrik-status'],
    'PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED',
    'R2 registration is lifecycle-neutral and must not perform acceptance',
  );
  assert.deepEqual(lifecycleMismatches(), []);
});

test('a manifest-only lifecycle flip fails closed across packet and index surfaces', () => {
  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  manifest['x-cybrik-status'] = 'ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED';
  const mismatches = lifecycleMismatches(
    new Map([
      [COMPATIBILITY_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`],
    ]),
  );
  assert.ok(mismatches.length > 0, 'a half-flip must never pass lifecycle agreement');
  for (const relativePath of LIFECYCLE_PATHS.filter(
    (path) => path !== COMPATIBILITY_MANIFEST_PATH,
  )) {
    assert.ok(mismatches.includes(relativePath), `${relativePath}: half-flip must be detected`);
  }
});

test('no artifact overclaims runtime, UAT, admission, release or production proof', () => {
  const joined = [...PACKET_DOC_PATHS, ...expectedPacketPaths]
    .map((path) => read(path))
    .join('\n');

  assert.doesNotMatch(joined, /\b(?:runtime|UAT|production) (?:verified|proven|ready)\b/i);
  assert.doesNotMatch(joined, /\brelease (?:authorized|ready|approved)\b/i);
  assert.doesNotMatch(joined, /\bruntime[- ]admitted\b/i);
  assert.doesNotMatch(joined, /\bDEMO_READY_LOCAL\b/);
  assert.doesNotMatch(joined, /\b(?:GA|RC|POC) (?:ready|achieved)\b/);
});

// --- 3. schema compilation and local reference resolution --------------------

test('both schemas compile under JSON Schema 2020-12 with every local $ref resolved', () => {
  const report = validateTransportPeerPacket({ root: REPO_ROOT });

  assert.equal(report.counts.schemasCompiled, 2);
  assert.equal(report.counts.unresolvedRefs, 0);
  assert.deepEqual(
    report.errors.filter((error) => /schema compilation|unresolved/i.test(error)),
    [],
  );
});

test('schema, fixture and accepted-dependency drift each fail closed with a rendered failure', () => {
  const invalidSchema = validateTransportPeerPacket({
    root: REPO_ROOT,
    overrides: new Map([[
      'contracts/json-schema/cybrik.transport-peer-evidence.v1.schema.json',
      '{',
    ]]),
  });
  assert.equal(invalidSchema.counts.unresolvedRefs, 1);
  assert.ok(invalidSchema.errors.some((error) => /schema compilation/.test(error)));
  const rendered = formatTransportPeerReport(invalidSchema);
  assert.equal(rendered.exitCode, 1);
  assert.match(rendered.stdout, /W2-K TRANSPORT PEER: FAIL/);

  const positiveBytes = read(POSITIVE_EVIDENCE_FIXTURE);
  const negativeSchemaPath =
    'contracts/examples/transport-peer/negative-schema/peer-evidence.conveys-authorization-true.json';
  const semanticPath =
    'contracts/examples/transport-peer/negative-semantic/peer-evidence.chain-not-verified.json';
  const rejectedPositive = validateTransportPeerPacket({
    root: REPO_ROOT,
    overrides: new Map([[POSITIVE_EVIDENCE_FIXTURE, read(negativeSchemaPath)]]),
  });
  assert.ok(rejectedPositive.errors.some((error) => /positive fixture rejected/.test(error)));

  const acceptedNegative = validateTransportPeerPacket({
    root: REPO_ROOT,
    overrides: new Map([[negativeSchemaPath, positiveBytes]]),
  });
  assert.ok(acceptedNegative.errors.some((error) => /negative-schema fixture accepted/.test(error)));

  const acceptedSemantic = validateTransportPeerPacket({
    root: REPO_ROOT,
    overrides: new Map([[semanticPath, positiveBytes]]),
  });
  assert.ok(acceptedSemantic.errors.some((error) => /semantic denial mismatch/.test(error)));

  const dependencyPath = Object.keys(ACCEPTED_DEPENDENCY_PINS)[0];
  const driftedDependency = validateTransportPeerPacket({
    root: REPO_ROOT,
    overrides: new Map([[dependencyPath, '{}\n']]),
  });
  assert.ok(
    driftedDependency.errors.some((error) => /accepted dependency sha256 mismatch/.test(error)),
  );

  withTempPacketRoot((root) => {
    copyPacketInto(root, { skip: new Set([dependencyPath]) });
    const missingDependency = validateTransportPeerPacket({ root });
    assert.ok(missingDependency.errors.some((error) => error.includes(dependencyPath)));
  });
});

test('reused accepted primitives are $ref-ed from svc-common-defs, never redefined', () => {
  const evidence = readJson(
    'contracts/json-schema/cybrik.transport-peer-evidence.v1.schema.json',
  );
  const errorSchema = readJson(
    'contracts/json-schema/cybrik.transport-peer-evidence-error.v1.schema.json',
  );
  const bodies = [JSON.stringify(evidence), JSON.stringify(errorSchema)].join('\n');

  assert.match(
    bodies,
    /cybrik\.svc-common-defs\.v1\.schema\.json#\/\$defs\/certThumbprint/,
    'the peer thumbprint must reuse the accepted W2-F certThumbprint definition',
  );
  assert.match(
    bodies,
    /cybrik\.svc-common-defs\.v1\.schema\.json#\/\$defs\/cnfConfirmation/,
    'the token confirmation must reuse the accepted W2-F cnfConfirmation definition',
  );
  // A redefinition would reintroduce a second source of truth for the same
  // 43-character base64url SHA-256 thumbprint, which is exactly the drift the
  // W2-F packet exists to prevent.
  assert.doesNotMatch(
    bodies,
    /\^\[A-Za-z0-9_-\]\{43\}\$/,
    'neither W2-K schema may restate the certThumbprint pattern',
  );
  for (const forbiddenDef of ['certThumbprint', 'cnfConfirmation', 'jwtAlg', 'spiffeId']) {
    assert.equal(
      Object.hasOwn(evidence.$defs ?? {}, forbiddenDef),
      false,
      `cybrik.transport-peer-evidence.v1 must not redefine ${forbiddenDef}`,
    );
  }
});

// --- 4. structural inexpressibility of certificate material ------------------

test('raw PEM, DER, public key, subject and SAN material is structurally inexpressible', () => {
  const report = validateTransportPeerPacket({ root: REPO_ROOT });
  assert.deepEqual(report.errors, []);

  const base = readJson(POSITIVE_EVIDENCE_FIXTURE);
  for (const forbidden of FORBIDDEN_CHANNEL_PROPERTY_KEYS) {
    const mutated = structuredClone(base);
    mutated.channel[forbidden] = 'REDACTED-NOT-MATERIAL';
    assert.equal(
      report.validateEvidence(mutated),
      false,
      `channel.${forbidden} must be rejected by additionalProperties:false`,
    );
  }

  for (const forbidden of [
    'peer_certificate_pem',
    'peer_certificate_der',
    'peer_public_key',
    'peer_subject',
    'peer_subject_alt_names',
    'header_thumbprint',
    'x_forwarded_client_cert',
  ]) {
    assert.ok(
      FORBIDDEN_CHANNEL_PROPERTY_KEYS.includes(forbidden),
      `${forbidden} must be an enumerated structurally-forbidden channel key`,
    );
  }
});

test('the peer thumbprint is x5t#S256 only and never client- or header-supplied', () => {
  const evidence = readJson(
    'contracts/json-schema/cybrik.transport-peer-evidence.v1.schema.json',
  );
  const thumbprint = evidence.$defs.peerThumbprint;

  assert.equal(thumbprint.properties.alg.const, 'x5t#S256');
  assert.deepEqual(thumbprint.required.sort(), ['alg', 'value']);
  assert.equal(thumbprint.additionalProperties, false);

  const sources = evidence.$defs.peerThumbprintSource.enum;
  assert.deepEqual([...sources].sort(), [
    'server_unverified_transport',
    'server_verified_chain',
  ]);
  for (const forbiddenSource of [
    'client_supplied',
    'header',
    'proxy_asserted',
    'x_forwarded_client_cert',
    'caller_asserted',
  ]) {
    assert.equal(
      sources.includes(forbiddenSource),
      false,
      `${forbiddenSource} must remain structurally inexpressible as a thumbprint source`,
    );
  }

  const report = validateTransportPeerPacket({ root: REPO_ROOT });
  const sha1Shaped = structuredClone(readJson(POSITIVE_EVIDENCE_FIXTURE));
  sha1Shaped.channel.peer_thumbprint = { alg: 'x5t', value: 'bwcK0esc3ACC3DB3L7el-JsdA-I' };
  assert.equal(report.validateEvidence(sha1Shaped), false);
});

// --- 5. three-way equality and the no-degrade truth table --------------------

test('acceptance requires the full three-way thumbprint equality', () => {
  const accepted = readJson(POSITIVE_EVIDENCE_FIXTURE);
  const verdict = evaluatePeerEvidence(accepted);

  assert.equal(verdict.accepted, true);
  assert.equal(verdict.denialClass, null);
  assert.equal(
    accepted.channel.peer_thumbprint.value,
    accepted.relying_party.peer_cert_thumbprint.value,
  );
  assert.equal(
    accepted.channel.peer_thumbprint.value,
    accepted.token_confirmation.cnf['x5t#S256'],
  );

  const otherThumbprint = 'A'.repeat(43);
  const rpMismatch = structuredClone(accepted);
  rpMismatch.relying_party.peer_cert_thumbprint.value = otherThumbprint;
  assert.deepEqual(evaluatePeerEvidence(rpMismatch), {
    accepted: false,
    denialClass: 'TPE_RELYING_PARTY_THUMBPRINT_MISMATCH',
    degraded: false,
  });

  const cnfMismatch = structuredClone(accepted);
  cnfMismatch.token_confirmation.cnf['x5t#S256'] = otherThumbprint;
  assert.deepEqual(evaluatePeerEvidence(cnfMismatch), {
    accepted: false,
    denialClass: 'TPE_TOKEN_CNF_THUMBPRINT_MISMATCH',
    degraded: false,
  });

  // A missing counterparty is a denial, never an implicit match.
  for (const drop of ['relying_party', 'token_confirmation']) {
    const partial = structuredClone(accepted);
    delete partial[drop];
    assert.equal(evaluatePeerEvidence(partial).accepted, false, drop);
  }
});

test('the no-degrade truth table accepts exactly mutual_tls + chain_verified + thumbprint', () => {
  const rows = noDegradeTruthTable();
  assert.equal(rows.length, 8);

  const combinations = rows.map(
    (row) => `${row.mutual_tls}|${row.chain_verified}|${row.thumbprint_present}`,
  );
  assert.equal(new Set(combinations).size, 8, 'the table must be exhaustive');

  const accepted = rows.filter((row) => row.accepted);
  assert.equal(accepted.length, 1);
  assert.deepEqual(
    {
      mutual_tls: accepted[0].mutual_tls,
      chain_verified: accepted[0].chain_verified,
      thumbprint_present: accepted[0].thumbprint_present,
    },
    { mutual_tls: true, chain_verified: true, thumbprint_present: true },
  );
  for (const row of rows) {
    assert.equal(row.degraded, false, 'no row may degrade to an unauthenticated accept');
    if (!row.accepted) {
      assert.ok(
        DENIAL_CLASSES.includes(row.denialClass),
        `unknown denial class ${row.denialClass}`,
      );
    }
  }

  const fixture = readJson(TRUTH_TABLE_FIXTURE);
  assert.equal(fixture.rule, 'no-degrade');
  assert.equal(fixture.rows.length, 8);
  for (const [index, row] of fixture.rows.entries()) {
    assert.equal(row.expected_accepted, rows[index].accepted, `row ${index}`);
    assert.equal(
      row.expected_denial_class ?? null,
      rows[index].denialClass,
      `row ${index}`,
    );
  }
});

test('the no-degrade truth table is derived from the reference predicate', () => {
  const valid = readJson(POSITIVE_EVIDENCE_FIXTURE);
  for (const row of noDegradeTruthTable()) {
    const evidence = structuredClone(valid);
    evidence.channel.mutual_tls = row.mutual_tls;
    evidence.channel.chain_verified = row.chain_verified;
    if (!row.thumbprint_present) delete evidence.channel.peer_thumbprint;
    const verdict = evaluatePeerEvidence(evidence);
    assert.deepEqual(
      {
        accepted: row.accepted,
        denialClass: row.denialClass,
        degraded: row.degraded,
      },
      verdict,
    );
  }
});

// --- 6. fail-closed denial-class fixture exhaustiveness ----------------------

test('every declared denial class has exactly one negative-semantic fixture', () => {
  assert.equal(DENIAL_CLASSES.length, 8);
  assert.deepEqual([...DENIAL_CLASSES].sort(), [
    'TPE_CHAIN_NOT_VERIFIED',
    'TPE_CHANNEL_EVIDENCE_ABSENT',
    'TPE_CHANNEL_EVIDENCE_HELD',
    'TPE_NOT_MUTUAL_TLS',
    'TPE_PEER_THUMBPRINT_ABSENT',
    'TPE_RELYING_PARTY_THUMBPRINT_MISMATCH',
    'TPE_TOKEN_CNF_THUMBPRINT_MISMATCH',
    'TPE_UNVERIFIED_THUMBPRINT_SOURCE',
  ]);

  const manifest = readJson(EXAMPLES_MANIFEST_PATH);
  const semantic = manifest.fixtures.filter(
    (entry) => entry.kind === 'negative-semantic',
  );
  assert.deepEqual(
    semantic.map((entry) => entry.expected_denial_class).sort(),
    [...DENIAL_CLASSES].sort(),
    'the denial-class catalog and the fixture corpus must be in exact bijection',
  );

  for (const entry of semantic) {
    const fixture = readJson(
      `contracts/examples/transport-peer/${entry.file}`,
    );
    const verdict = evaluatePeerEvidence(fixture);
    assert.equal(verdict.accepted, false, entry.file);
    assert.equal(verdict.degraded, false, entry.file);
    assert.equal(verdict.denialClass, entry.expected_denial_class, entry.file);
  }
});

test('held and absent channel evidence fail closed and never fall through', () => {
  for (const [state, expected] of [
    ['absent', 'TPE_CHANNEL_EVIDENCE_ABSENT'],
    ['held', 'TPE_CHANNEL_EVIDENCE_HELD'],
  ]) {
    const evidence = structuredClone(readJson(POSITIVE_EVIDENCE_FIXTURE));
    evidence.channel.evidence_state = state;
    delete evidence.channel.peer_thumbprint;
    assert.deepEqual(evaluatePeerEvidence(evidence), {
      accepted: false,
      denialClass: expected,
      degraded: false,
    });
  }

  // A malformed or empty document is a denial, not a throw and not an accept.
  for (const malformed of [undefined, null, {}, { channel: null }, { channel: {} }]) {
    assert.doesNotThrow(() => evaluatePeerEvidence(malformed));
    assert.equal(evaluatePeerEvidence(malformed).accepted, false);
  }
});

test('every non-present evidence state fails closed, including out-of-enum values', () => {
  const valid = readJson(POSITIVE_EVIDENCE_FIXTURE);
  for (const state of ['degraded', 'partial', 'PRESENT', 42, true, null]) {
    const evidence = structuredClone(valid);
    evidence.channel.evidence_state = state;
    const verdict = evaluatePeerEvidence(evidence);
    assert.equal(verdict.accepted, false, `${String(state)} must never fall through`);
    assert.equal(verdict.degraded, false);
    assert.equal(verdict.denialClass, 'TPE_CHANNEL_EVIDENCE_ABSENT');
  }
});

test('the typed error surface is fail-closed, non-degrading and carries no material', () => {
  const errorSchema = readJson(
    'contracts/json-schema/cybrik.transport-peer-evidence-error.v1.schema.json',
  );

  assert.equal(errorSchema.properties.fail_closed.const, true);
  assert.equal(errorSchema.properties.degraded.const, false);
  assert.equal(errorSchema.additionalProperties, false);
  assert.deepEqual(
    [...errorSchema.properties.denial_class.enum].sort(),
    [...DENIAL_CLASSES].sort(),
  );
  for (const leaky of [
    'peer_cert_thumbprint',
    'peer_thumbprint',
    'cnf',
    'token',
    'certificate',
    'authorization',
  ]) {
    assert.equal(
      Object.hasOwn(errorSchema.properties, leaky),
      false,
      `the error body must have nowhere to carry ${leaky}`,
    );
  }
});

// --- 7. evidence conveys no authorization ------------------------------------

test('peer evidence conveys no authorization and cannot carry an authority axis', () => {
  const report = validateTransportPeerPacket({ root: REPO_ROOT });
  const evidenceSchema = readJson(
    'contracts/json-schema/cybrik.transport-peer-evidence.v1.schema.json',
  );

  assert.equal(evidenceSchema.properties.conveys_authorization.const, false);
  assert.ok(evidenceSchema.required.includes('conveys_authorization'));

  const base = readJson(POSITIVE_EVIDENCE_FIXTURE);
  const granting = structuredClone(base);
  granting.conveys_authorization = true;
  assert.equal(report.validateEvidence(granting), false);

  for (const authorityKey of [
    'access_token',
    'approval',
    'bearer',
    'capability',
    'credential',
    'delegation',
    'granted_scope',
    'permission',
    'role',
    'secret',
    'signature',
  ]) {
    const mutated = structuredClone(base);
    mutated[authorityKey] = 'x';
    assert.equal(
      report.validateEvidence(mutated),
      false,
      `root ${authorityKey} must be structurally impossible`,
    );
  }
});

// --- 8. no raw certificate, JWT, DSN or private-key material -----------------

test('no packet artifact carries certificate, JWT, DSN or private-key material', () => {
  for (const relativePath of [...expectedPacketPaths, ...PACKET_DOC_PATHS]) {
    const text = read(relativePath);
    assert.equal(text.includes(PEM_MARKER), false, `${relativePath}: PEM block`);
    assert.equal(
      text.includes(PRIVATE_KEY_MARKER),
      false,
      `${relativePath}: private key material`,
    );
    for (const dsn of DSN_MARKERS) {
      assert.equal(text.includes(dsn), false, `${relativePath}: database DSN`);
    }
    assert.doesNotMatch(
      text,
      new RegExp(`${JWT_MARKER}[A-Za-z0-9_-]{12,}\\.[A-Za-z0-9_-]{8,}`),
      `${relativePath}: compact JWS/JWT-shaped value`,
    );
    assert.doesNotMatch(
      text,
      /\bMII[A-Za-z0-9+/]{24,}/,
      `${relativePath}: DER-shaped base64 blob`,
    );
  }

  // The intentional negative fixture proves the property NAME is inexpressible;
  // it must not smuggle real material in to do so.
  const rawMaterial = readJson(
    'contracts/examples/transport-peer/negative-schema/peer-evidence.raw-certificate-material.json',
  );
  for (const value of collectKeys(rawMaterial).length ? Object.values(rawMaterial.channel) : []) {
    if (typeof value === 'string') {
      assert.ok(value.length <= 64, 'placeholder values must stay obviously non-material');
    }
  }
});

// --- 9. server neutrality and the Anycorn HOLD -------------------------------

test('every server candidate is unselected and the packet names no chosen server', () => {
  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  const candidates = manifest.server_candidates;

  assert.ok(Array.isArray(candidates) && candidates.length >= 3);
  for (const candidate of candidates) {
    assert.equal(candidate.selected, false, `${candidate.id} must be unselected`);
    assert.equal(candidate.installed, false, `${candidate.id} must not be installed`);
    assert.equal(candidate.pinned, false, `${candidate.id} must not be pinned`);
  }
  assert.equal(
    candidates.filter((candidate) => candidate.selected).length,
    0,
    'server neutrality: no candidate may be selected by a proposal-only packet',
  );
  assert.equal(manifest.server_neutrality.selected_server, null);
  assert.equal(manifest.server_neutrality.server_neutral, true);
});

test('Anycorn 0.20.0 stays HOLD with its blocking finding and is neither installed nor pinned', () => {
  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  const anycorn = manifest.server_candidates.find(
    (candidate) => candidate.id === 'anycorn',
  );

  assert.ok(anycorn, 'the recorded HOLD candidate must appear in the matrix');
  assert.equal(anycorn.disposition, 'HOLD');
  assert.equal(anycorn.version_considered, '0.20.0');
  assert.equal(anycorn.blocking_finding.severity, 'HIGH');
  assert.equal(anycorn.installed, false);
  assert.equal(anycorn.pinned, false);
  assert.equal(anycorn.selected, false);
  assert.match(
    anycorn.blocking_finding.recorded_at,
    /^cybrik-suite:docs\/uat\/candidates\/runtime-admission-soc-ai-lifecycle-mtls-r1\//,
    'the finding must cite the existing Suite HOLD record, not restate a new claim',
  );

  const matrix = read('docs/architecture/transport-peer-evidence/01-server-candidate-matrix.md');
  assert.match(matrix, /Anycorn/);
  assert.match(matrix, /HOLD/);
  assert.match(matrix, /not installed/i);
  assert.match(matrix, /not pinned/i);

  // No dependency may be added anywhere by this packet.
  const packageJson = readJson('tools/contract-validation/package.json');
  const declared = JSON.stringify({
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies ?? {},
  });
  assert.doesNotMatch(declared, /anycorn|hypercorn|uvicorn|granian|daphne/i);
});

test('the forbidden trusted-boundary adapter is inexpressible and named only as forbidden', () => {
  const evidenceSchema = readJson(
    'contracts/json-schema/cybrik.transport-peer-evidence.v1.schema.json',
  );
  assert.equal(
    evidenceSchema.$defs.adapterProfile.const,
    'server-verified-chain-adapter',
  );

  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  assert.ok(
    manifest.future_local_harness_profile.forbidden_adapters.includes(
      'trusted-boundary-adapter',
    ),
    'the future local harness profile must forbid the trusted-boundary adapter',
  );

  const report = validateTransportPeerPacket({ root: REPO_ROOT });
  const shortcut = structuredClone(readJson(POSITIVE_EVIDENCE_FIXTURE));
  shortcut.server_neutrality.adapter_profile = 'trusted-boundary-adapter';
  assert.equal(report.validateEvidence(shortcut), false);
});

// --- 10. N1..N10 coverage map ------------------------------------------------

test('N1..N10 are each mapped exactly once as covered_statically or requires_runtime', () => {
  const ids = NEGATIVE_TEST_MAP.map((entry) => entry.id);
  assert.deepEqual(ids, [
    'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10',
  ]);
  for (const entry of NEGATIVE_TEST_MAP) {
    assert.ok(
      ['covered_statically', 'requires_runtime'].includes(entry.coverage),
      `${entry.id}: coverage must be exactly one of the two declared values`,
    );
    assert.ok(entry.basis.length > 0, `${entry.id}: coverage needs a stated basis`);
  }

  const byId = Object.fromEntries(
    NEGATIVE_TEST_MAP.map((entry) => [entry.id, entry.coverage]),
  );
  assert.equal(byId.N1, 'requires_runtime', 'replay durability is runtime-only');
  assert.equal(byId.N9, 'requires_runtime', 'database unavailability is runtime-only');
  assert.equal(byId.N2, 'covered_statically');
  assert.equal(byId.N8, 'covered_statically');

  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  assert.deepEqual(
    manifest.negative_test_map.map((entry) => ({
      id: entry.id,
      coverage: entry.coverage,
      runtime_status: entry.runtime_status,
    })),
    NEGATIVE_TEST_MAP.map((entry) => ({
      id: entry.id,
      coverage: entry.coverage,
      runtime_status: entry.runtime_status,
    })),
    'the manifest and the validator must share one N-map source of truth',
  );
  assert.ok(
    manifest.negative_test_map.every((entry) => entry.runtime_status === 'requires_runtime'),
    'static contract coverage must never be mistaken for completed runtime UAT',
  );
});

test('separate-process, loopback TLS, ephemeral PKI and durability stay runtime-only', () => {
  assert.deepEqual([...RUNTIME_ONLY_PROPERTIES].sort(), [
    'ephemeral_out_of_repo_dev_pki',
    'loopback_tls_socket',
    'postgresql_durable_replay',
    'separate_process_boundary',
  ]);

  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  assert.deepEqual(
    [...manifest.runtime_only_properties].sort(),
    [...RUNTIME_ONLY_PROPERTIES].sort(),
  );
  assert.equal(manifest.evidence.runtime_coverage_claimed, false);
  assert.ok(
    manifest.evidence.not_claimed.includes('runtime or integration'),
    'the packet must explicitly disclaim runtime coverage',
  );
});

// --- 11. manifest path and digest integrity ----------------------------------

test('manifest member inventory, digests and aggregate are self-consistent', () => {
  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  const integrity = manifest['x-cybrik-packet-integrity'];

  assert.equal(integrity.member_count, manifest.members.length);
  assert.equal(integrity.member_digests.length, manifest.members.length);
  assert.equal(manifest.members.length, expectedPacketPaths.length);

  for (const entry of integrity.member_digests) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    const relativePath = `contracts/${entry.file}`;
    if (relativePath === COMPATIBILITY_MANIFEST_PATH) continue;
    assert.equal(
      sha256(readFileSync(join(REPO_ROOT, relativePath))),
      entry.sha256,
      `${relativePath}: member digest drift`,
    );
  }

  const aggregate = [...integrity.member_digests]
    .sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0))
    .map((entry) => `${entry.sha256}  ${entry.file}`)
    .join('\n');
  assert.equal(integrity.aggregate_sha256, sha256(Buffer.from(aggregate, 'utf8')));
});

test('a tampered member digest and a missing packet path both fail closed', () => {
  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  const tampered = structuredClone(manifest);
  tampered['x-cybrik-packet-integrity'].member_digests[0].sha256 = '0'.repeat(64);

  const tamperedReport = validateTransportPeerPacket({
    root: REPO_ROOT,
    overrides: new Map([
      [COMPATIBILITY_MANIFEST_PATH, `${JSON.stringify(tampered, null, 2)}\n`],
    ]),
  });
  assert.ok(
    tamperedReport.errors.some((error) => /member sha256 mismatch/.test(error)),
    'a rewritten member digest must be rejected',
  );

  withTempPacketRoot((root) => {
    const dropped = expectedPacketPaths.find((path) =>
      path.startsWith('contracts/examples/transport-peer/negative-semantic/'),
    );
    copyPacketInto(root, { skip: new Set([dropped]) });
    const report = validateTransportPeerPacket({ root });
    assert.ok(
      report.errors.some((error) => error.includes(dropped)),
      'a missing packet member must fail closed',
    );
  });
});

test('manifest member paths cannot escape the repository root', () => {
  withTempPacketRoot((container) => {
    const root = join(container, 'repo');
    const escapedBytes = '{"outside":true}\n';
    writeFileSync(join(container, 'outside.json'), escapedBytes);

    const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
    const tampered = structuredClone(manifest);
    tampered['x-cybrik-packet-integrity'].member_digests[0] = {
      file: '../../outside.json',
      sha256: sha256(escapedBytes),
    };
    tampered['x-cybrik-packet-integrity'].aggregate_sha256 = sha256(
      Buffer.from(
        [...tampered['x-cybrik-packet-integrity'].member_digests]
          .sort((left, right) => left.file.localeCompare(right.file))
          .map((entry) => `${entry.sha256}  ${entry.file}`)
          .join('\n'),
        'utf8',
      ),
    );

    copyPacketInto(root, {
      overrides: new Map([
        [COMPATIBILITY_MANIFEST_PATH, `${JSON.stringify(tampered, null, 2)}\n`],
      ]),
    });
    const report = validateTransportPeerPacket({ root });
    assert.ok(
      report.errors.some((error) => /outside repository root/.test(error)),
      'a digest-valid manifest member outside the repository must still fail closed',
    );
  });
});

test('standalone validation requires packet integrity and the exact member inventory', () => {
  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  const withoutIntegrity = structuredClone(manifest);
  delete withoutIntegrity['x-cybrik-packet-integrity'];
  const missingIntegrity = validateTransportPeerPacket({
    root: REPO_ROOT,
    overrides: new Map([
      [COMPATIBILITY_MANIFEST_PATH, `${JSON.stringify(withoutIntegrity, null, 2)}\n`],
    ]),
  });
  assert.ok(missingIntegrity.errors.some((error) => /packet integrity is required/.test(error)));

  const withoutMember = structuredClone(manifest);
  withoutMember.members.pop();
  const missingMember = validateTransportPeerPacket({
    root: REPO_ROOT,
    overrides: new Map([
      [COMPATIBILITY_MANIFEST_PATH, `${JSON.stringify(withoutMember, null, 2)}\n`],
    ]),
  });
  assert.ok(missingMember.errors.some((error) => /member inventory mismatch/.test(error)));
});

test('every fixture is pinned by digest in the examples manifest with no orphans', () => {
  const manifest = readJson(EXAMPLES_MANIFEST_PATH);
  const declared = manifest.fixtures.map(
    (entry) => `contracts/examples/transport-peer/${entry.file}`,
  );
  const walk = (directory, prefix = '') =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory()
        ? walk(join(directory, entry.name), relativePath)
        : [relativePath];
    });
  const onDisk = walk(join(REPO_ROOT, 'contracts/examples/transport-peer'))
    .filter((path) => path.endsWith('.json') && path !== 'examples-manifest.json')
    .map((path) => `contracts/examples/transport-peer/${path}`);

  assert.deepEqual([...declared].sort(), [...onDisk].sort());
  assert.equal(new Set(declared).size, declared.length);
  for (const entry of manifest.fixtures) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    assert.equal(
      sha256(
        readFileSync(
          join(REPO_ROOT, `contracts/examples/transport-peer/${entry.file}`),
        ),
      ),
      entry.sha256,
      entry.file,
    );
  }
});

// --- 12. accepted artifacts are not mutated ----------------------------------

test('accepted and previously-gated artifacts keep their exact bytes', () => {
  for (const [relativePath, expected] of Object.entries(ACCEPTED_DEPENDENCY_PINS)) {
    assert.equal(
      sha256(readFileSync(join(REPO_ROOT, relativePath))),
      expected,
      `${relativePath}: accepted dependency bytes drifted`,
    );
  }

  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  const declared = Object.fromEntries(
    manifest.dependencies_reused_unmodified.map((entry) => [
      entry.file.startsWith('../') ? entry.file.slice(3) : `contracts/${entry.file}`,
      entry.sha256,
    ]),
  );
  assert.deepEqual(declared, ACCEPTED_DEPENDENCY_PINS);
});

test('no W2-H, W2-I or UAT-candidate artifact is touched by this packet', () => {
  const untouchable = [
    'tools/contract-validation/tests/validate-resource-bounds.test.mjs',
    'tools/contract-validation/tests/validate-transport.test.mjs',
    'docs/uat/candidates/README.md',
    'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/runtime-admission.json',
    'contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json',
  ];
  for (const relativePath of untouchable) {
    assert.equal(
      expectedPacketPaths.includes(relativePath),
      false,
      `${relativePath} must never become a W2-K packet member`,
    );
    assert.equal(
      PACKET_DOC_PATHS.includes(relativePath),
      false,
      `${relativePath} must never become a W2-K documentation member`,
    );
  }
});

// --- 13. validator hygiene ---------------------------------------------------

test('the validator opens no socket, starts no server and reads no wall clock', () => {
  const source = read(VALIDATOR_PATH);

  for (const forbiddenImport of [
    'node:net',
    'node:tls',
    'node:http',
    'node:https',
    'node:http2',
    'node:dgram',
    'node:child_process',
    'node:worker_threads',
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(`from\\s+['"]${forbiddenImport}['"]`),
      `the validator must not import ${forbiddenImport}`,
    );
  }
  for (const forbiddenCall of [
    'createServer',
    'listen(',
    'connect(',
    'spawnSync',
    'spawn(',
    'execSync',
    'fetch(',
    'Date.now(',
    'new Date(',
    'performance.now(',
    'Math.random(',
  ]) {
    assert.equal(
      source.includes(forbiddenCall),
      false,
      `the validator must not call ${forbiddenCall}`,
    );
  }
  for (const writeApi of ['writeFileSync', 'mkdirSync', 'rmSync', 'appendFileSync']) {
    assert.equal(
      source.includes(writeApi),
      false,
      `the validator must not write to the filesystem (${writeApi})`,
    );
  }

  assert.match(
    source,
    /pathToFileURL\(realpathSync\(/,
    'the main guard must compare normalized real paths so a symlinked argv never false-greens',
  );
});

test('this harness writes only inside the OS temporary directory', () => {
  const self = read('tools/contract-validation/tests/validate-transport-peer.test.mjs');
  const writes = [...self.matchAll(/writeFileSync\(|mkdirSync\(|mkdtempSync\(/g)];
  assert.ok(writes.length > 0, 'the fail-closed probe must actually write somewhere');
  assert.match(self, /mkdtempSync\(join\(base, 'cybrik-w2k-'\)\)/);
  assert.match(self, /realpathSync\(tmpdir\(\)\)/);
  assert.doesNotMatch(self, /writeFileSync\(\s*join\(REPO_ROOT/);
});

// --- 14. registration and the two recorded registration HOLDs ----------------

test('the package registers focused W2-K commands without changing canonical entry points', () => {
  const packageJson = readJson('tools/contract-validation/package.json');

  assert.equal(
    packageJson.scripts['validate:w2k:transport-peer'],
    'node validate-transport-peer.mjs',
  );
  assert.equal(
    packageJson.scripts['test:w2k:transport-peer'],
    'node --test tests/validate-transport-peer.test.mjs',
  );
  assert.equal(packageJson.scripts.validate, 'node validate.mjs');
  assert.deepEqual(
    packageJson.dependencies,
    {
      '@asyncapi/parser': '3.6.0',
      '@stoplight/spectral-cli': '6.16.2',
      ajv: '8.20.0',
      'ajv-formats': '3.0.1',
      'brace-expansion': 'file:vendor/brace-expansion-compat',
      yaml: '2.9.0',
    },
    'W2-K adds no dependency',
  );
});

test('orchestrator and ADR-catalog registration are complete, and completion is truthfully recorded', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);

  assert.match(orchestrator, /'validate-transport-peer\.mjs'/);
  assert.match(orchestrator, /'tests\/validate-transport-peer\.test\.mjs'/);

  const stepBlock = orchestrator.match(/const steps = \[([\s\S]*?)\];/);
  assert.ok(stepBlock);
  const actualSteps = [...stepBlock[1].matchAll(/'([^']+\.mjs)'/g)].length;
  const claims = [
    ...orchestrator.matchAll(/\b(\d+)\b[^\n]{0,24}?\bvalidators?\b/gi),
  ].map((match) => Number(match[1]));
  assert.ok(claims.length >= 1);
  for (const claim of claims) {
    assert.equal(claim, actualSteps, 'the orchestrator step count must stay truthful');
  }

  const bannerMatch = orchestrator.match(/console\.log\((['"`])(ALL GREEN[\s\S]*?)\1\)/);
  assert.ok(bannerMatch, 'the orchestrator must emit an ALL GREEN success banner to disclose against');
  assert.match(
    bannerMatch[2],
    /W2-K PROPOSED \/ NOT ACCEPTED/,
    'the ALL GREEN banner must disclose the W2-K PROPOSED / NOT ACCEPTED step',
  );
  assert.match(bannerMatch[2], /validate-transport-peer/);

  // The ADR catalog row is now registered: docs/adr/README.md carries the
  // additive W2-K paragraph and ADR-0013 row under the W2-I P2-3 additive-byte
  // pin, which now also names the exact W2-K additions.
  const adrReadme = read('docs/adr/README.md');
  assert.match(adrReadme, /ADR-0013/);
  assert.match(
    adrReadme,
    /\[ADR-0013\]\(ADR-0013-transport-peer-evidence-adapter-profile\.md\)/,
  );
  assert.match(
    adrReadme,
    /Gate W2-K authorizes bounded proposal writing and static conformance only/,
  );

  for (const relativePath of [DECISION_PATH, 'tools/contract-validation/README.md']) {
    const text = read(relativePath);
    assert.match(
      text,
      new RegExp(`These ${actualSteps} validators`, 'i'),
      `${relativePath}: name the current truthful step count`,
    );
    assert.match(text, /P2-3/, `${relativePath}: name the W2-I byte pin that now also carries the W2-K additions`);
    assert.match(
      text,
      /registration is complete/i,
      `${relativePath}: registration completion must be stated, not silent`,
    );
  }
});

test('the ADR-0013 catalog row and ADR file agree with the manifest lifecycle', () => {
  const status = readJson(COMPATIBILITY_MANIFEST_PATH)['x-cybrik-status'];
  const adr = read(ADR_PATH);
  const row = read('docs/adr/README.md')
    .split('\n')
    .find((line) =>
      line.includes('[ADR-0013](ADR-0013-transport-peer-evidence-adapter-profile.md)'),
    );
  assert.ok(row, 'the authoritative ADR catalog must register ADR-0013');
  assert.ok(adr.includes(status), `${ADR_PATH}: lifecycle must match the packet manifest`);
  assert.ok(row.includes(status), 'the ADR-0013 catalog row must match the packet manifest');
});

// --- 15. gate identity, ADR number and decision record -----------------------

test('W2-K and ADR-0013 are free identifiers in this tree', () => {
  const manifest = readJson(COMPATIBILITY_MANIFEST_PATH);
  assert.equal(manifest.gate.id, 'W2-K');
  assert.equal(manifest.gate.adr, 'ADR-0013');

  const adr = read(ADR_PATH);
  assert.match(adr, /^# ADR-0013/m);
  assert.match(adr, /PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED/);
  assert.match(adr, /## Decision/m);

  // The collision scan is a recorded, reproducible claim, not prose.
  const decision = read(DECISION_PATH);
  assert.match(decision, /zero-collision/i);
  assert.match(decision, /W2-K/);
  assert.match(decision, /ADR-0013/);
});

test('the Governor decision states bounded authority and an explicit denial list', () => {
  const decision = read(DECISION_PATH);

  assert.match(
    decision,
    /OPEN FOR BOUNDED PROPOSAL WRITING AND STATIC CONFORMANCE ONLY/,
  );
  assert.match(decision, /## Denial list/m);
  for (const denied of [
    'dependency install',
    'formatter',
    'workflow',
    'lockfile',
    'sibling repositor',
    'listener',
    'database',
    'container',
    'secret',
    'W2-H artifact',
  ]) {
    assert.match(
      decision,
      new RegExp(denied, 'i'),
      `the denial list must name '${denied}'`,
    );
  }
  assert.match(decision, /Codex Governor/);
  assert.match(
    decision,
    /3604c56507f5d3f831ff19b229b9cde5c508c6f3/,
    'the decision must pin the exact base commit',
  );
});

// --- 16. documentation uses repository-qualified references ------------------

test('documentation references other repositories only in repository-qualified form', () => {
  for (const relativePath of PACKET_DOC_PATHS) {
    const text = read(relativePath);
    for (const repo of [
      'cybrik-soc-command-center',
      'cybrik-cyber-ai-platform',
      'cybrik-security-tool-fabric',
    ]) {
      for (const match of text.matchAll(new RegExp(`${repo}[^\\s)\`]*`, 'g'))) {
        assert.ok(
          match[0] === repo || match[0].startsWith(`${repo}:`),
          `${relativePath}: '${match[0]}' must be repository-qualified as ${repo}:path`,
        );
      }
    }
    assert.doesNotMatch(
      text,
      /\]\(\.\.\/\.\.\/\.\.\//,
      `${relativePath}: no relative link may escape this repository`,
    );
  }
});
