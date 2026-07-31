// Static validator for the ACCEPTED-FOR-IMPLEMENTATION lifecycle-delegation
// binding packet.
//
// This packet restricts the already-accepted W2-F validation view to the
// accepted investigation-lifecycle operations. It creates no schema, endpoint,
// runtime, deployment, stable-version, or release authority.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');

const dependencyRequire = () => {
  const localRequire = createRequire(join(HERE, 'package.json'));
  try {
    localRequire.resolve('ajv/dist/2020.js');
    return localRequire;
  } catch {
    const commonDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: DEFAULT_ROOT, encoding: 'utf8' },
    ).trim();
    return createRequire(join(dirname(commonDir), 'tools/contract-validation/package.json'));
  }
};

const requireFromValidationRoot = dependencyRequire();
const AjvModule = requireFromValidationRoot('ajv/dist/2020.js');
const addFormatsModule = requireFromValidationRoot('ajv-formats');
const Ajv2020 = AjvModule.default || AjvModule;
const addFormats = addFormatsModule.default || addFormatsModule;

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
const ACCEPTED_LIFECYCLE_MANIFEST =
  'contracts/compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json';
const ACCEPTED_LIFECYCLE_OPENAPI =
  'contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml';
const DECISION_RECORD =
  'docs/releases/GATE-W2-F-LIFECYCLE-DELEGATION-ACCEPTANCE-2026-07-31.md';
const FIXTURE_ROOT = 'contracts/examples/svc-lifecycle/';
const NOW = 1900000000;
const AUDIENCE = 'svc:cyber-ai-lifecycle';
const ALLOWED = new Map([
  ['investigation.create', 'investigation.lifecycle:create'],
  ['investigation.status', 'investigation.lifecycle:read'],
  ['investigation.cancel', 'investigation.lifecycle:cancel'],
]);
const NON_DELEGATABLE = new Set([
  'investigation.checkpoint',
  'investigation.bundle_read',
]);
const ACCEPTED_LIFECYCLE_OPERATIONS = [
  'createInvestigation',
  'getInvestigationStatus',
  'listInvestigationCheckpoints',
  'cancelInvestigation',
  'readInvestigationBundle',
];
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

const compileAcceptedW2f = (root, errors) => {
  const names = [
    'cybrik.common-defs.v1.schema.json',
    'cybrik.data-marking.v1.schema.json',
    'cybrik.svc-common-defs.v1.schema.json',
    'cybrik.svc-delegation-token.v1.schema.json',
    'cybrik.svc-delegation-request.v1.schema.json',
    'cybrik.svc-trust-metadata.v1.schema.json',
  ];
  const documents = [];
  for (const name of names) {
    try {
      documents.push(JSON.parse(readFileSync(
        join(root, 'contracts/json-schema', name),
        'utf8',
      )));
    } catch (error) {
      errors.push(`accepted W2-F schema ${name} cannot be loaded: ${error.message}`);
    }
  }
  if (documents.length !== names.length) return null;
  try {
    const ajv = new Ajv2020({
      strict: true,
      strictTypes: false,
      strictRequired: false,
      allErrors: true,
      allowUnionTypes: true,
    });
    addFormats(ajv);
    for (const keyword of [
      'x-cybrik-status',
      'x-cybrik-not-accepted',
      'x-cybrik-contract-version',
      'x-cybrik-format-pins',
    ]) {
      ajv.addKeyword({ keyword });
    }
    for (const document of documents) ajv.addSchema(document);
    const byTitle = new Map(documents.map((document) => [document.title, document]));
    const requestDoc = byTitle.get(
      'CYBRIK internal service-delegation request (validation view) v1',
    );
    const trustDoc = byTitle.get(
      'CYBRIK internal service-delegation trust metadata v1',
    );
    return {
      ajv,
      request: ajv.getSchema(requestDoc.$id),
      trust: ajv.getSchema(trustDoc.$id),
    };
  } catch (error) {
    errors.push(`accepted W2-F schema compile/ref-resolution failed: ${error.message}`);
    return null;
  }
};

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
  if (NON_DELEGATABLE.has(op) || !ALLOWED.has(op)) violations.push('NOT_DELEGATABLE');
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
    acceptedLifecycleOperations: 0,
    acceptedBundleRead200Responses: 0,
  };

  for (const path of expectedPacketPaths) {
    if (!overrides.has(path) && !existsSync(join(root, path))) {
      errors.push(`missing required lifecycle-delegation packet file: ${path}`);
    } else {
      counts.packetFiles += 1;
    }
  }
  if (errors.some((error) => error.startsWith('missing required'))) {
    return { status: 'UNKNOWN', notAccepted: undefined, counts, errors };
  }

  const manifest = parseJson(root, MANIFEST, overrides, errors);
  const examples = parseJson(root, EXAMPLES_MANIFEST, overrides, errors);
  const acceptedLifecycle = parseJson(
    root,
    ACCEPTED_LIFECYCLE_MANIFEST,
    overrides,
    errors,
  );
  const acceptedW2f = compileAcceptedW2f(root, errors);
  let notes = '';
  try { notes = readSource(root, NOTES, overrides); } catch (error) {
    errors.push(`${NOTES}: cannot read: ${error.message}`);
  }
  let acceptedOpenApi = '';
  try {
    acceptedOpenApi = readSource(root, ACCEPTED_LIFECYCLE_OPENAPI, overrides);
  } catch (error) {
    errors.push(`${ACCEPTED_LIFECYCLE_OPENAPI}: cannot read: ${error.message}`);
  }

  const acceptedOperations = acceptedLifecycle?.operation_contract?.operations || [];
  counts.acceptedLifecycleOperations = acceptedOperations.length;
  if (acceptedLifecycle?.['x-cybrik-status'] !== 'ACCEPTED FOR IMPLEMENTATION'
    || acceptedLifecycle?.['x-cybrik-not-accepted'] !== false) {
    errors.push(
      'accepted lifecycle source must remain ACCEPTED FOR IMPLEMENTATION '
        + 'before this proposal can restrict its delegation surface',
    );
  }
  if (!stableEqual(acceptedOperations, ACCEPTED_LIFECYCLE_OPERATIONS)) {
    errors.push(
      'accepted lifecycle operation set must include readInvestigationBundle '
        + 'and retain the exact five accepted operationIds',
    );
  }
  const bundleOperationStart = acceptedOpenApi.search(
    /^\s{6}operationId:\s*readInvestigationBundle\s*$/m,
  );
  let bundleOperationBlock = '';
  if (bundleOperationStart >= 0) {
    const remainder = acceptedOpenApi.slice(bundleOperationStart);
    const nextPath = remainder.search(/\n  (?:\/|components:)/);
    bundleOperationBlock = nextPath >= 0 ? remainder.slice(0, nextPath) : remainder;
  }
  const response200Matches = bundleOperationBlock.match(/^\s{8}'200':\s*$/gm) || [];
  counts.acceptedBundleRead200Responses = response200Matches.length;
  if (response200Matches.length !== 1
    || !bundleOperationBlock.includes(
      "$ref: '#/components/schemas/InvestigationBundleReadResult'",
    )) {
    errors.push(
      'accepted readInvestigationBundle must retain its declared 200 response '
        + 'bound to InvestigationBundleReadResult',
    );
  }
  if (acceptedLifecycle?.supersession_mapping?.accepted_successor?.contract_version
    !== '0.1.1') {
    errors.push(
      'accepted lifecycle source must retain v0.1.1 as the bundle-read response profile',
    );
  }

  if (manifest?.['x-cybrik-status'] !== 'ACCEPTED FOR IMPLEMENTATION'
    || manifest?.['x-cybrik-not-accepted'] !== false
    || manifest?.['x-cybrik-implemented'] !== false) {
    errors.push(
      'compatibility manifest must remain ACCEPTED FOR IMPLEMENTATION / NOT IMPLEMENTED',
    );
  }
  if (manifest?.['x-cybrik-packet-version'] !== '0.1.0'
    || manifest?.['x-cybrik-is-bundle-tag'] !== false) {
    errors.push('compatibility manifest must remain v0.1.0 and not a bundle tag');
  }
  if (manifest?.audience !== AUDIENCE) errors.push(`manifest audience must equal ${AUDIENCE}`);
  if (!stableEqual(manifest?.delegatable_operations, Object.fromEntries(ALLOWED))) {
    errors.push('manifest delegatable operation-to-scope map must remain exact');
  }
  if (!stableEqual(
    manifest?.non_delegatable_operations,
    [...NON_DELEGATABLE],
  )) {
    errors.push('manifest non-delegatable operation inventory must remain exact');
  }
  const expectedAcceptedSourceCrossCheck = {
    manifest:
      'compatibility/cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json',
    openapi: 'openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml',
    operation_id: 'readInvestigationBundle',
    operation_contract_state: 'ACCEPTED FOR IMPLEMENTATION',
    response_status: '200',
    response_schema: 'InvestigationBundleReadResult',
    response_profile: 'cybrik.investigation-bundle.strict-compatible.v1@0.1.1',
    proposal_effect:
      'DECLINES W2-F DELEGATION AUTHORITY ONLY; '
        + 'DOES NOT CHANGE THE ACCEPTED BUSINESS LIFECYCLE CONTRACT',
  };
  if (!stableEqual(
    manifest?.accepted_source_cross_check,
    expectedAcceptedSourceCrossCheck,
  )) {
    errors.push(
      'proposal accepted-source cross-check must distinguish accepted bundle-read '
        + 'business contract from declined delegation authority',
    );
  }
  const expectedBusinessBinding = {
    createInvestigation: 'investigation.create',
    getInvestigationStatus: 'investigation.status',
    listInvestigationCheckpoints: 'investigation.status',
    cancelInvestigation: 'investigation.cancel',
    readInvestigationBundle: 'investigation.bundle_read',
  };
  if (!stableEqual(manifest?.business_operation_binding, expectedBusinessBinding)) {
    errors.push(
      'accepted business operation binding must remain exact; '
        + 'listInvestigationCheckpoints must bind to investigation.status/read',
    );
  }
  const bundleDelegation = manifest?.delegation_disposition?.readInvestigationBundle;
  if (bundleDelegation?.delegated !== false
    || bundleDelegation?.mint_token !== false
    || bundleDelegation?.consume_token !== false) {
    errors.push('readInvestigationBundle must not mint or consume a delegation token');
  }
  if (bundleDelegation?.reason
      !== 'ACCEPTED_BINDING_GRANTS_NO_BUNDLE_READ_DELEGATION_AUTHORITY'
    || bundleDelegation?.future_binding_gate
      !== 'SEPARATELY_ACCEPTED_IMPLEMENTATION_AND_CONTRACT_GATE_REQUIRED') {
    errors.push(
      'future bundle-read binding requires a separately accepted implementation '
        + 'and contract gate',
    );
  }
  const acceptance = manifest?.acceptance;
  const expectedNonClaims = [
    'Acceptance proves no product runtime, route, socket, mTLS deployment or token mint/verifier wiring.',
    'No checkpoint write or bundle-read delegation is authorized.',
    'No release, stable v1/GA or production action is authorized.',
  ];
  if (manifest?.gate?.status !== 'ACCEPTED FOR IMPLEMENTATION'
    || acceptance?.status !== 'ACCEPTED FOR IMPLEMENTATION'
    || acceptance?.implementation !== 'NOT IMPLEMENTED'
    || acceptance?.decided_on !== '2026-07-31'
    || !/Founder-delegated technical authority/.test(acceptance?.decided_by || '')
    || acceptance?.decision_record
      !== DECISION_RECORD
    || !stableEqual(acceptance?.non_claims, expectedNonClaims)) {
    errors.push('accepted lifecycle-delegation metadata must remain complete and exact');
  }
  for (const phrase of [
    'ACCEPTED FOR IMPLEMENTATION',
    'NOT IMPLEMENTED',
    'investigation.checkpoint',
    'investigation.bundle_read',
    'listInvestigationCheckpoints',
    'investigation.status',
    'accepted business lifecycle operation',
    'no caller may mint',
    'no relying party may consume',
    'separately accepted implementation and contract gate',
  ]) {
    if (!notes.includes(phrase)) errors.push(`mapping notes must state '${phrase}'`);
  }

  let contractsReadme = '';
  let compatibilityReadme = '';
  let decisionRecord = '';
  try {
    contractsReadme = readSource(root, 'contracts/README.md', overrides);
    compatibilityReadme = readSource(
      root,
      'contracts/compatibility/README.md',
      overrides,
    );
    decisionRecord = readSource(root, DECISION_RECORD, overrides);
  } catch (error) {
    errors.push(`accepted lifecycle-delegation record cannot be read: ${error.message}`);
  }
  for (const [path, prose] of [
    ['contracts/README.md', contractsReadme],
    ['contracts/compatibility/README.md', compatibilityReadme],
  ]) {
    if (!prose.includes('ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED')
      || !prose.includes('W2-F-LIFECYCLE-BINDING, 2026-07-31')) {
      errors.push(`${path}: accepted lifecycle-delegation status and gate must remain explicit`);
    }
  }
  for (const phrase of [
    'ACCEPTED FOR IMPLEMENTATION',
    'Founder-delegated technical authority',
    '`investigation.checkpoint` remains',
    '`investigation.bundle_read` receives no delegation authority',
    'proves no local stack, UAT',
  ]) {
    if (!decisionRecord.includes(phrase)) {
      errors.push(`decision record must state '${phrase}'`);
    }
  }
  const proposalOwnedProse = [
    notes,
    contractsReadme,
    compatibilityReadme,
    JSON.stringify(manifest),
    JSON.stringify(examples),
  ].join('\n');
  const runtimeOverclaimPatterns = [
    /\bcurrent Cyber AI implementation\b.{0,80}\b(?:remains?|returns?|is)\b.{0,40}\b(?:unconditional )?refus(?:al|es|ing)\b/is,
    /\bCyber AI currently\b.{0,60}\b(?:refus(?:es|al|ing)|returns?)\b.{0,60}\b(?:bundle[- ]read|readInvestigationBundle|investigation\.bundle_read)\b/is,
    /\bcross[- ]repo(?:sitory)? runtime state\b/is,
  ];
  if (runtimeOverclaimPatterns.some((pattern) => pattern.test(proposalOwnedProse))) {
    errors.push(
      'proposal must not assert cross-repository runtime state; '
        + 'Suite owns only the proposed nondelegation contract rule',
    );
  }

  const memberByPath = new Map((manifest?.members || []).map((member) => [member.file, member]));
  if (memberByPath.size !== expectedPacketPaths.length - 1
    || memberByPath.size !== (manifest?.members || []).length) {
    errors.push('manifest member inventory must contain each non-manifest packet file exactly once');
  }
  for (const path of expectedPacketPaths.slice(1)) {
    const relative = path.replace(/^contracts\//, '');
    const member = memberByPath.get(relative);
    if (!member) {
      errors.push(`manifest member inventory missing ${relative}`);
      continue;
    }
    const digest = sha256(Buffer.from(readSource(root, path, overrides), 'utf8'));
    if (member.sha256 !== digest) errors.push(`manifest member sha256 mismatch for ${relative}`);
  }
  for (const reused of manifest?.reuses_accepted_unmodified || []) {
    if (!existsSync(join(root, 'contracts', reused))) {
      errors.push(`reused accepted member is missing: ${reused}`);
    }
    if (memberByPath.has(reused)) {
      errors.push(`reused accepted member must not also be owned by proposal: ${reused}`);
    }
  }

  if (examples?.['x-cybrik-status'] !== 'ACCEPTED FOR IMPLEMENTATION'
    || examples?.['x-cybrik-not-accepted'] !== false
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
    if (path.endsWith('svc-lifecycle-trust-metadata.json')) {
      if (acceptedW2f?.trust && !acceptedW2f.trust(fixture)) {
        errors.push(
          `${path}: must validate against accepted cybrik.svc-trust-metadata.v1: `
            + acceptedW2f.ajv.errorsText(acceptedW2f.trust.errors),
        );
      }
      continue;
    }
    if (acceptedW2f?.request && !acceptedW2f.request(fixture)) {
      errors.push(
        `${path}: must validate against accepted cybrik.svc-delegation-request.v1: `
          + acceptedW2f.ajv.errorsText(acceptedW2f.request.errors),
      );
    }
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
  console.log('=== ACCEPTED lifecycle-delegation binding — static validation ===');
  console.log('counts:', JSON.stringify(report.counts));
  if (report.errors.length) {
    console.error(`FAIL — ${report.errors.length} error(s):`);
    for (const error of report.errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(
    'OK — accepted-for-implementation fixtures and bindings are internally consistent. '
      + 'This is not runtime, deployment, stable-version, or release proof.',
  );
}
