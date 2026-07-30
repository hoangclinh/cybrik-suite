// Static validator for the PROPOSED lifecycle-delegation binding packet.
//
// This packet restricts the already-accepted W2-F validation view to the
// accepted investigation-lifecycle operations. It creates no schema, endpoint,
// runtime, deployment, acceptance, or release authority.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');

export const expectedPacketPaths = [
  'contracts/compatibility/cybrik-suite-investigation-lifecycle-svc-delegation-proposal.v1.manifest.json',
  'contracts/adapters/cybrik-svc-lifecycle-delegation-mapping-notes.v1.md',
  'contracts/examples/svc-lifecycle/examples-manifest.json',
  'contracts/examples/svc-lifecycle/positive/svc-lifecycle-trust-metadata.json',
  'contracts/examples/svc-lifecycle/positive/svc-lifecycle-create-request.json',
  'contracts/examples/svc-lifecycle/positive/svc-lifecycle-status-request.json',
  'contracts/examples/svc-lifecycle/positive/svc-lifecycle-cancel-request.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.wrong-audience.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.operation-mismatch.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.scope-mismatch.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.tenant-mismatch.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.org-mismatch.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.actor-mismatch.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.marking-escalation.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.replay.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.checkpoint-not-delegatable.json',
  'contracts/examples/svc-lifecycle/negative-semantic/svc-lifecycle-request.bundle-read-not-delegatable.json',
];

const MANIFEST = expectedPacketPaths[0];
const NOTES = expectedPacketPaths[1];
const EXAMPLES_MANIFEST = expectedPacketPaths[2];
const FIXTURE_ROOT = 'contracts/examples/svc-lifecycle/';
const NOW = 1900000000;
const AUDIENCE = 'svc:cyber-ai-lifecycle';
const ALLOWED = new Map([
  ['investigation.create', 'investigation.lifecycle:create'],
  ['investigation.status', 'investigation.lifecycle:read'],
  ['investigation.cancel', 'investigation.lifecycle:cancel'],
]);
const RESERVED = new Set(['investigation.checkpoint', 'investigation.bundle_read']);
const CLASSIFICATION = { public: 0, internal: 1, confidential: 2, restricted: 3 };
const TLP = {
  'TLP:CLEAR': 0,
  'TLP:GREEN': 1,
  'TLP:AMBER': 2,
  'TLP:AMBER+STRICT': 3,
  'TLP:RED': 4,
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stableEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const above = (candidate, ceiling) => (
  CLASSIFICATION[candidate?.classification] > CLASSIFICATION[ceiling?.classification]
  || TLP[candidate?.tlp] > TLP[ceiling?.tlp]
);

const readSource = (root, path, overrides) => {
  if (overrides?.has(path)) return overrides.get(path);
  return readFileSync(join(root, path), 'utf8');
};

const parseJson = (root, path, overrides, errors) => {
  try {
    return JSON.parse(readSource(root, path, overrides));
  } catch (error) {
    errors.push(`${path}: cannot read valid JSON: ${error.message}`);
    return null;
  }
};

const requestClaims = (request) => request?.presented_token?.claims;

const requestStructuralErrors = (request) => {
  const errors = [];
  const claims = requestClaims(request);
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return ['request must be an object'];
  }
  for (const field of [
    'request_id',
    'presented_token',
    'relying_party',
    'tenant_id',
    'operation',
    'data_marking',
  ]) {
    if (!(field in request)) errors.push(`request missing ${field}`);
  }
  if (!claims) errors.push('request missing presented_token.claims');
  for (const field of [
    'iss',
    'sub',
    'aud',
    'iat',
    'nbf',
    'exp',
    'jti',
    'cnf',
    'scope',
    'cybrik.tenant_id',
    'cybrik.actor',
    'cybrik.operation',
    'cybrik.marking',
  ]) {
    if (claims && !(field in claims)) errors.push(`token claims missing ${field}`);
  }
  if (request?.presented_token?.header?.typ !== 'at+jwt') errors.push('token typ must be at+jwt');
  if (!['ES256', 'ES384', 'ES512', 'PS256', 'PS384', 'PS512', 'RS256', 'RS384', 'RS512', 'EdDSA']
    .includes(request?.presented_token?.header?.alg)) errors.push('token alg must be asymmetric');
  if (!request?.presented_token?.header?.kid) errors.push('token kid required');
  if (!/^[A-Za-z0-9_-]{43}$/.test(claims?.cnf?.['x5t#S256'] || '')) {
    errors.push('token cnf thumbprint must be 43-char base64url');
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(request?.relying_party?.peer_cert_thumbprint || '')) {
    errors.push('peer certificate thumbprint must be 43-char base64url');
  }
  if (!Number.isInteger(claims?.iat)
    || !Number.isInteger(claims?.nbf)
    || !Number.isInteger(claims?.exp)) {
    errors.push('token times must be integer NumericDate values');
  }
  if (typeof claims?.jti !== 'string' || claims.jti.length < 16) errors.push('token jti too short');
  return errors;
};

const runtimeViolations = (request, trust, seenJtis = new Set()) => {
  const violations = [];
  const claims = requestClaims(request);
  const op = claims?.['cybrik.operation']?.name;
  const scope = claims?.scope;
  if (claims?.aud !== AUDIENCE
    || request?.relying_party?.audience !== AUDIENCE
    || trust?.self_audience !== AUDIENCE) violations.push('AUDIENCE');
  if (request?.relying_party?.trust_domain !== trust?.trust_domain) violations.push('TRUST_DOMAIN');
  if (!trust?.require_mtls || !trust?.require_cnf
    || claims?.cnf?.['x5t#S256'] !== request?.relying_party?.peer_cert_thumbprint) {
    violations.push('CNF_MTLS');
  }
  if (!trust?.accepted_issuers?.includes(claims?.iss)
    || !trust?.accepted_algs?.includes(request?.presented_token?.header?.alg)) {
    violations.push('PINNED_TRUST');
  }
  if (claims?.nbf > NOW || claims?.exp < NOW
    || claims?.exp - claims?.iat > 120
    || trust?.max_token_ttl_seconds !== 120) violations.push('TIME');
  if (request?.tenant_id !== claims?.['cybrik.tenant_id']) violations.push('TENANT');
  if (request?.org_scope !== claims?.['cybrik.org_scope']) violations.push('ORG');
  if (!stableEqual(request?.actor, claims?.['cybrik.actor'])) violations.push('ACTOR');
  if (request?.operation?.name !== op) violations.push('OPERATION');
  if (RESERVED.has(op) || !ALLOWED.has(op)) violations.push('NOT_DELEGATABLE');
  if (ALLOWED.has(op) && scope !== ALLOWED.get(op)) violations.push('SCOPE');
  if (above(request?.data_marking, claims?.['cybrik.marking'])) violations.push('MARKING');
  if (seenJtis.has(claims?.jti)) violations.push('REPLAY');
  return [...new Set(violations)];
};

export async function validateSvcLifecycleBinding({
  root = DEFAULT_ROOT,
  overrides = new Map(),
} = {}) {
  const errors = [];
  const counts = {
    packetFiles: 0,
    positiveFixtures: 0,
    negativeSemanticFixtures: 0,
  };

  for (const path of expectedPacketPaths) {
    if (!overrides.has(path) && !existsSync(join(root, path))) {
      errors.push(`missing required lifecycle-delegation packet file: ${path}`);
    } else {
      counts.packetFiles += 1;
    }
  }
  if (errors.some((error) => error.startsWith('missing required'))) {
    return { status: 'PROPOSED', notAccepted: true, counts, errors };
  }

  const manifest = parseJson(root, MANIFEST, overrides, errors);
  const examples = parseJson(root, EXAMPLES_MANIFEST, overrides, errors);
  let notes = '';
  try { notes = readSource(root, NOTES, overrides); } catch (error) {
    errors.push(`${NOTES}: cannot read: ${error.message}`);
  }

  if (manifest?.['x-cybrik-status'] !== 'PROPOSED'
    || manifest?.['x-cybrik-not-accepted'] !== true
    || manifest?.['x-cybrik-implemented'] !== false) {
    errors.push('compatibility manifest must remain PROPOSED / NOT ACCEPTED / NOT IMPLEMENTED');
  }
  if (manifest?.['x-cybrik-packet-version'] !== '0.1.0'
    || manifest?.['x-cybrik-is-bundle-tag'] !== false) {
    errors.push('compatibility manifest must remain v0.1.0 and not a bundle tag');
  }
  if (manifest?.audience !== AUDIENCE) errors.push(`manifest audience must equal ${AUDIENCE}`);
  if (!stableEqual(manifest?.delegatable_operations, Object.fromEntries(ALLOWED))) {
    errors.push('manifest delegatable operation-to-scope map must remain exact');
  }
  if (!stableEqual(manifest?.reserved_non_delegatable_operations, [...RESERVED])) {
    errors.push('manifest reserved non-delegatable operation inventory must remain exact');
  }
  if (manifest?.rest_operation_binding?.listInvestigationCheckpoints
    !== 'investigation.status') {
    errors.push('listInvestigationCheckpoints must bind to investigation.status/read');
  }
  if (manifest?.rest_operation_binding?.readInvestigationBundle !== null) {
    errors.push('readInvestigationBundle must not mint or consume a delegation token');
  }
  for (const phrase of [
    'PROPOSED',
    'NOT ACCEPTED',
    'NOT IMPLEMENTED',
    'investigation.checkpoint',
    'investigation.bundle_read',
    'listInvestigationCheckpoints',
    'investigation.status',
  ]) {
    if (!notes.includes(phrase)) errors.push(`mapping notes must state '${phrase}'`);
  }

  const memberByPath = new Map((manifest?.members || []).map((member) => [member.file, member]));
  for (const path of expectedPacketPaths.slice(1)) {
    const relative = path.replace(/^contracts\//, '');
    if ([EXAMPLES_MANIFEST].includes(path)) continue;
    const member = memberByPath.get(relative);
    if (!member) {
      errors.push(`manifest member inventory missing ${relative}`);
      continue;
    }
    const digest = sha256(Buffer.from(readSource(root, path, overrides), 'utf8'));
    if (member.sha256 !== digest) errors.push(`manifest member sha256 mismatch for ${relative}`);
  }

  if (examples?.['x-cybrik-status'] !== 'PROPOSED'
    || examples?.['x-cybrik-not-accepted'] !== true
    || examples?.test_reference_clock_epoch_seconds !== NOW) {
    errors.push('examples manifest lifecycle or reference clock is invalid');
  }
  const rows = examples?.examples || [];
  const fixturePaths = expectedPacketPaths
    .filter((path) => path.startsWith(FIXTURE_ROOT) && path !== EXAMPLES_MANIFEST);
  if (rows.length !== fixturePaths.length) errors.push('examples manifest fixture count mismatch');
  const rowByPath = new Map(rows.map((row) => [`${FIXTURE_ROOT}${row.file}`, row]));
  const fixtures = new Map();
  for (const path of fixturePaths) {
    const row = rowByPath.get(path);
    if (!row) {
      errors.push(`examples manifest missing fixture ${path.slice(FIXTURE_ROOT.length)}`);
      continue;
    }
    const fixture = parseJson(root, path, overrides, errors);
    fixtures.set(path, fixture);
    if (path.includes('/positive/')) counts.positiveFixtures += 1;
    else counts.negativeSemanticFixtures += 1;
    if (path.endsWith('svc-lifecycle-trust-metadata.json')) continue;
    for (const structuralError of requestStructuralErrors(fixture)) {
      errors.push(`${path}: must remain structurally valid against accepted W2-F shape: ${structuralError}`);
    }
  }

  const trust = fixtures.get(
    `${FIXTURE_ROOT}positive/svc-lifecycle-trust-metadata.json`,
  );
  if (trust?.self_audience !== AUDIENCE
    || trust?.max_token_ttl_seconds !== 120
    || trust?.require_cnf !== true
    || trust?.require_mtls !== true) {
    errors.push('positive trust metadata must pin lifecycle audience, cnf, mTLS and 120s TTL');
  }

  const positivePaths = [
    `${FIXTURE_ROOT}positive/svc-lifecycle-create-request.json`,
    `${FIXTURE_ROOT}positive/svc-lifecycle-status-request.json`,
    `${FIXTURE_ROOT}positive/svc-lifecycle-cancel-request.json`,
  ];
  const seenJtis = new Set();
  for (const path of positivePaths) {
    const fixture = fixtures.get(path);
    const violations = runtimeViolations(fixture, trust, seenJtis);
    if (violations.length) errors.push(`${path}: positive fixture violations: ${violations.join(',')}`);
    seenJtis.add(requestClaims(fixture)?.jti);
  }

  const expectedNegative = new Map([
    ['svc-lifecycle-request.wrong-audience.json', 'AUDIENCE'],
    ['svc-lifecycle-request.operation-mismatch.json', 'OPERATION'],
    ['svc-lifecycle-request.scope-mismatch.json', 'SCOPE'],
    ['svc-lifecycle-request.tenant-mismatch.json', 'TENANT'],
    ['svc-lifecycle-request.org-mismatch.json', 'ORG'],
    ['svc-lifecycle-request.actor-mismatch.json', 'ACTOR'],
    ['svc-lifecycle-request.marking-escalation.json', 'MARKING'],
    ['svc-lifecycle-request.replay.json', 'REPLAY'],
    ['svc-lifecycle-request.checkpoint-not-delegatable.json', 'NOT_DELEGATABLE'],
    ['svc-lifecycle-request.bundle-read-not-delegatable.json', 'NOT_DELEGATABLE'],
  ]);
  for (const [file, expected] of expectedNegative) {
    const path = `${FIXTURE_ROOT}negative-semantic/${file}`;
    const violations = runtimeViolations(fixtures.get(path), trust, seenJtis);
    if (!violations.includes(expected)) {
      errors.push(`${path}: fixture must exercise ${expected}; got ${violations.join(',') || 'none'}`);
    }
  }

  return {
    status: manifest?.['x-cybrik-status'] || 'UNKNOWN',
    notAccepted: manifest?.['x-cybrik-not-accepted'],
    counts,
    errors,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await validateSvcLifecycleBinding();
  console.log('=== PROPOSED lifecycle-delegation binding — static validation ===');
  console.log('counts:', JSON.stringify(report.counts));
  if (report.errors.length) {
    console.error(`FAIL — ${report.errors.length} error(s):`);
    for (const error of report.errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(
    'OK — proposal fixtures and bindings are internally consistent. '
      + 'This is not acceptance, runtime, deployment, or release proof.',
  );
}
