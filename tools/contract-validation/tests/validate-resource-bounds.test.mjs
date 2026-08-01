// Gate W2-H resource-bounds proposal tests.
//
// Green proves only deterministic Suite-side static conformance for a
// PROPOSED packet. It accepts no ADR, implements no runtime, satisfies no
// T10/T11 measurement, and grants no release or production authority.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import {
  FORBIDDEN_AUTHORITY_PROPERTY_KEYS,
  RESOURCE_KEYS,
  REPLAY_ERROR_CODES,
  declaredDependencyPinsMatch,
  expectedPacketPaths,
  replayResourceCase,
  validateResourceBoundsProposal,
  vectorAdd,
  vectorLessThanOrEqual,
  vectorSubtract,
  zeroVector,
} from '../validate-resource-bounds.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const readJson = (relativePath) =>
  JSON.parse(readFileSync(join(REPO_ROOT, relativePath), 'utf8'));
const readText = (relativePath) =>
  readFileSync(join(REPO_ROOT, relativePath), 'utf8');
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

const EXPECTED_RESOURCE_KEYS = [
  'cpu_millis',
  'egress_bytes',
  'memory_byte_millis',
  'model_tokens',
  'retrieved_bytes',
  'tool_calls',
];

const POSITIVE_REPLAY =
  'contracts/examples/resource-bounds/positive/replay.conserved-tree.json';
// The packet inventory is the one source of truth for which semantic replays
// exist. Restating the list here would let the two drift apart silently; the
// count is pinned where the list is consumed.
const NEGATIVE_REPLAY_PATHS = expectedPacketPaths.filter((path) =>
  path.includes('/examples/resource-bounds/negative-semantic/'));

// Deterministic xorshift32: no wall clock and no platform RNG.
const createXorshift32 = (seed) => {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
};

const APPROVED_REQUIRED_CHECK_NAMES = Object.freeze([
  'contract standards validation',
  'secret-scan',
]);
const assertApprovedRequiredCheckNames = (checkNames) =>
  assert.deepEqual([...checkNames].sort(), APPROVED_REQUIRED_CHECK_NAMES);

test('required check names match the exact approved stable allowlist', () => {
  const workflow = parseYaml(readText('.github/workflows/contracts.yml'));
  const checkNames = Object.values(workflow.jobs)
    .map((job) => job.name);

  assertApprovedRequiredCheckNames(checkNames);
  for (const unapprovedName of [
    'secret-scan v8',
    'secret-scan gitleaks-8',
    'secret-scan gitleaks@8',
    'secret-scan gitleaks:8',
    'secret-scan gitleaks_v8',
    'secret-scan gitleaks=8',
    'secret-scan gitleaks/8',
    'secret-scan gitleaks+8',
    'secret-scan gitleaks#8',
    'secret-scan gitleaks(8)',
    'secret-scan gitleaks[8]',
    'secret-scan gitleaks 8.30.1',
    'secret-scan v8.30.1',
    'secret-scan 2026-07-31',
    'secret-scan build-123',
    'secret-scan run #456',
    'secret-scan sha256:deadbeef',
    'secret-scan deadbeef',
    'secret-scan phase-2',
    'secret-scan wave 3',
    'secret-scan shard:4',
    'secret-scan tier_5',
    'secret-scan line/6',
    'build',
    'test run',
    'version compatibility',
    'digest verification',
  ]) {
    assert.throws(
      () =>
        assertApprovedRequiredCheckNames([
          'contract standards validation',
          unapprovedName,
        ]),
      {
        code: 'ERR_ASSERTION',
        operator: 'deepStrictEqual',
      },
      unapprovedName,
    );
  }
});

test('the W2-H proposal packet is internally coherent but remains unaccepted', () => {
  const report = validateResourceBoundsProposal({ root: REPO_ROOT });

  assert.deepEqual(report.errors, []);
  assert.equal(report.status, 'PROPOSED');
  assert.equal(report.notAccepted, true);
  assert.equal(report.notImplemented, true);
  assert.equal(report.packetVersion, '0.1.0');
  assert.equal(report.gate, 'W2-H');
  assert.equal(report.gateDisposition, 'OPEN FOR BOUNDED PROPOSAL WRITING ONLY');
  // W2-H/R3 §7.3.3 inventory arithmetic: 7 schemas and a 10/10/16 fixture split.
  assert.equal(report.counts.schemasCompiled, 7);
  assert.equal(report.counts.positiveFixtures, 10);
  assert.equal(report.counts.negativeSchemaFixtures, 10);
  assert.equal(report.counts.negativeSemanticFixtures, 16);
  assert.equal(report.counts.negativeSemanticRejectedExactly, 16);
  assert.equal(report.counts.packetMembers, expectedPacketPaths.length);
});

test('the conserved vector contains only additive credit dimensions', () => {
  assert.deepEqual([...RESOURCE_KEYS].sort(), EXPECTED_RESOURCE_KEYS);
  for (const forbidden of [
    'deadline',
    'deadline_seconds',
    'elapsed_ms',
    'memory_bytes',
    'peak_memory_bytes',
    'wall_clock_ms',
  ]) {
    assert.equal(RESOURCE_KEYS.includes(forbidden), false);
  }
});

test('vector arithmetic conserves every dimension and fails closed on overdraw', () => {
  const parent = {
    cpu_millis: 100,
    memory_byte_millis: 10_000,
    model_tokens: 500,
    tool_calls: 8,
    retrieved_bytes: 4096,
    egress_bytes: 1024,
  };
  const child = {
    cpu_millis: 40,
    memory_byte_millis: 2500,
    model_tokens: 125,
    tool_calls: 2,
    retrieved_bytes: 1024,
    egress_bytes: 256,
  };
  const remaining = vectorSubtract(parent, child);

  assert.equal(vectorLessThanOrEqual(child, parent), true);
  assert.deepEqual(vectorAdd(child, remaining), parent);
  assert.throws(
    () => vectorSubtract(child, parent),
    /insufficient|overdraw|negative/i,
  );
});

test('seeded synthetic trees preserve root conservation', () => {
  const next = createXorshift32(0x43594252);

  for (let sample = 0; sample < 512; sample += 1) {
    const root = Object.fromEntries(
      RESOURCE_KEYS.map((key) => [key, 1 + (next() % 100_000)]),
    );
    let remaining = { ...root };
    const admitted = [];

    // Logical fanout is unbounded. This finite proof keeps proposing children
    // until finite root credits force admission to stop.
    for (let logicalChild = 0; logicalChild < 128; logicalChild += 1) {
      const request = Object.fromEntries(
        RESOURCE_KEYS.map((key) => [key, next() % 5000]),
      );
      if (Object.values(request).every((value) => value === 0)) {
        request.tool_calls = 1;
      }
      if (!vectorLessThanOrEqual(request, remaining)) continue;
      remaining = vectorSubtract(remaining, request);
      admitted.push(request);
    }

    const reserved = admitted.reduce(
      (sum, vector) => vectorAdd(sum, vector),
      zeroVector(),
    );
    assert.deepEqual(vectorAdd(reserved, remaining), root);
    assert.ok(admitted.length <= 128);
  }
});

test('the fixed positive replay is deterministic and conserved', () => {
  const fixture = readJson(POSITIVE_REPLAY);
  const first = replayResourceCase(fixture);
  const second = replayResourceCase(fixture);

  assert.deepEqual(first, second);
  assert.equal(first.accepted, true);
  assert.deepEqual(first.errors, []);
  assert.deepEqual(first.finalRootRemaining, fixture.expected.final_root_remaining);
  assert.match(first.traceDigest, /^[0-9a-f]{64}$/);
  assert.equal(
    first.traceDigest,
    createHash('sha256')
      .update(JSON.stringify(first.trace), 'utf8')
      .digest('hex'),
  );
});

test('every semantic replay is structurally valid and rejected by exactly its named rule', () => {
  // W2-H/R3 §7.3.2: the twelve R2 replays plus the four C1-C4 additions.
  assert.equal(NEGATIVE_REPLAY_PATHS.length, 16);
  for (const relativePath of NEGATIVE_REPLAY_PATHS) {
    const fixture = readJson(relativePath);
    const result = replayResourceCase(fixture);

    assert.equal(fixture.expected.accepted, false, relativePath);
    assert.equal(fixture.expected.error_codes.length, 1, relativePath);
    assert.equal(result.accepted, false, relativePath);
    assert.deepEqual(result.errors, fixture.expected.error_codes, relativePath);
    assert.ok(
      REPLAY_ERROR_CODES.includes(result.errors[0]),
      `${relativePath}: unknown replay error ${result.errors[0]}`,
    );
  }
});

test('idempotent replay binds both the original request and its exact result', () => {
  const fixture = readJson(
    'contracts/examples/resource-bounds/negative-semantic/replay.idempotency-conflict.json',
  );
  const firstReserve = fixture.events[1];
  const secondReserve = fixture.events[2];

  secondReserve.payload.request = structuredClone(firstReserve.payload.request);
  secondReserve.payload.result = structuredClone(firstReserve.payload.result);
  // W2-H/R3.1: the clone carries the first event's position and its now-stale
  // expected_version. C2 binds every nested record to its own envelope and C4
  // removes the admitted-key short circuit that let R2 skip both checks, so the
  // clone is rebased onto the second event's position and the parent's current
  // version — restoring the three values the fixture's second event carried
  // before the clone, and leaving the fixture itself byte-identical.
  for (const record of [secondReserve.payload.request, secondReserve.payload.result]) {
    record.sequence = 3;
    record.virtual_time_ms = 1020;
  }
  secondReserve.payload.request.parent.expected_version = 2;
  assert.equal(replayResourceCase(fixture).accepted, true);

  secondReserve.payload.result.parent_version_after += 1;
  assert.deepEqual(
    replayResourceCase(fixture).errors,
    ['RES_RESULT_MISMATCH'],
  );
});

test('malformed replay events return fail-closed verdicts instead of throwing', () => {
  const mutations = [
    (fixture) => { fixture.events[0] = null; },
    (fixture) => { delete fixture.events[0].payload; },
    (fixture) => { fixture.events[1].payload = {}; },
    (fixture) => {
      const release = fixture.events.find((event) => event.kind === 'release');
      delete release.payload;
    },
    (fixture) => {
      const release = fixture.events.find((event) => event.kind === 'release');
      release.payload = null;
    },
  ];

  for (const mutate of mutations) {
    const fixture = readJson(POSITIVE_REPLAY);
    mutate(fixture);
    assert.doesNotThrow(() => replayResourceCase(fixture));
    assert.deepEqual(
      replayResourceCase(fixture).errors,
      ['RES_RESULT_MISMATCH'],
    );
  }
});

test('root closure closes the subtree and closed capacity is never re-minted', () => {
  const fixture = readJson(
    'contracts/examples/resource-bounds/negative-semantic/replay.root-cancel-remint.json',
  );
  const result = replayResourceCase(fixture);

  assert.deepEqual(result.errors, ['RES_ROOT_CLOSED']);
  assert.equal(result.accepted, false);
  // B1 renames the terminal event kind; the fixture keeps its path.
  assert.equal(result.trace.at(-1).kind, 'root-closure');
  assert.equal(result.trace.at(-1).rootClosed, true);
  assert.equal(
    result.trace.some(
      (entry) => entry.sequence > 3 && entry.admitted === true,
    ),
    false,
  );
});

test('unused returned capacity is conserved but consumed capacity never returns', () => {
  const fixture = readJson(POSITIVE_REPLAY);
  const result = replayResourceCase(fixture);
  const releaseEntries = result.trace.filter((entry) => entry.kind === 'release');

  assert.ok(releaseEntries.length > 0);
  for (const entry of releaseEntries) {
    assert.deepEqual(
      vectorAdd(entry.consumed, entry.returned),
      entry.availableBefore,
    );
    assert.equal(
      vectorLessThanOrEqual(entry.parentRemainingBefore, entry.parentRemainingAfter),
      true,
    );
    assert.deepEqual(
      vectorSubtract(entry.parentRemainingAfter, entry.parentRemainingBefore),
      entry.returned,
    );
  }
});

test('a reservation handle is accounting state and never an authority object', () => {
  const forbiddenAuthorityKeys = new Set(FORBIDDEN_AUTHORITY_PROPERTY_KEYS);
  const intentionalNegative =
    'contracts/examples/resource-bounds/negative-schema/bounds-grant.authority-token.json';
  for (const relativePath of expectedPacketPaths) {
    if (!relativePath.endsWith('.json')) continue;
    const value = readJson(relativePath);
    const forbidden = collectKeys(value).filter((key) =>
      forbiddenAuthorityKeys.has(key),
    );
    if (relativePath === intentionalNegative) {
      assert.deepEqual(forbidden, ['authority_token']);
      continue;
    }
    assert.deepEqual(forbidden, [], `${relativePath} introduces authority keys`);
  }

  const commonDefinitions = readJson(
    'contracts/json-schema/cybrik.res-common-defs.v1.schema.json',
  );
  assert.equal(commonDefinitions.$defs.confersAuthority.const, false);

  for (const schemaPath of [
    'contracts/json-schema/cybrik.res-bounds-grant.v1.schema.json',
    'contracts/json-schema/cybrik.res-reservation-request.v1.schema.json',
    'contracts/json-schema/cybrik.res-reservation-result.v1.schema.json',
    'contracts/json-schema/cybrik.res-release.v1.schema.json',
  ]) {
    const schema = readJson(schemaPath);
    assert.equal(schema.properties.confers_authority.const, false);
  }
});

test('the accepted investigation budget remains distinct and byte-unmodified', () => {
  const accepted = readJson(
    'contracts/json-schema/cybrik.investigation-create-request.v1.schema.json',
  );
  assert.equal(accepted['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION');
  assert.deepEqual(Object.keys(accepted.properties.budget.properties).sort(), [
    'deadline_seconds',
    'max_model_calls',
    'max_retrieved_bytes',
    'max_tool_calls',
  ]);

  const manifest = readJson(
    'contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json',
  );
  assert.match(manifest.vocabulary_boundaries.investigation_budget, /distinct/i);
  assert.match(manifest.vocabulary_boundaries.investigation_budget, /no mapping/i);
});

test('accepted dependency pins have one source of truth across manifest and validator', () => {
  const manifest = readJson(
    'contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json',
  );
  assert.equal(manifest.dependencies_reused_unmodified.length, 4);
  assert.equal(declaredDependencyPinsMatch(manifest), true);

  const mutated = structuredClone(manifest);
  mutated.dependencies_reused_unmodified[0].sha256 = '0'.repeat(64);
  assert.equal(declaredDependencyPinsMatch(mutated), false);
});

test('status wording never overclaims runtime, UAT, release, or production proof', () => {
  const proposalText = [
    readText('docs/adr/ADR-0012-resource-bounds-contract-profile.md'),
    readText('docs/architecture/resource-bounds/README.md'),
    readText('docs/architecture/resource-bounds/01-contract-semantics.md'),
    readText('docs/architecture/resource-bounds/02-deterministic-replay-and-evidence.md'),
    readText(
      'contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json',
    ),
  ].join('\n');

  assert.match(proposalText, /PROPOSED/);
  assert.match(proposalText, /NOT ACCEPTED/);
  assert.match(proposalText, /NOT IMPLEMENTED/);
  assert.doesNotMatch(proposalText, /\b(?:runtime|UAT|production) (?:verified|proven|ready)\b/i);
  assert.doesNotMatch(proposalText, /\brelease (?:authorized|ready|approved)\b/i);
});

test('canonical orchestration registers proposal drift checks without changing W1 inventory', () => {
  const packageJson = readJson('tools/contract-validation/package.json');
  assert.equal(
    packageJson.scripts['validate:w2h:resource-bounds'],
    'node validate-resource-bounds.mjs',
  );
  assert.equal(
    packageJson.scripts['test:w2h:resource-bounds'],
    'node --test tests/validate-resource-bounds.test.mjs',
  );

  const orchestrator = readText('tools/contract-validation/validate.mjs');
  assert.match(orchestrator, /validate-resource-bounds\.mjs/);
  assert.match(orchestrator, /tests\/validate-resource-bounds\.test\.mjs/);
  const stepsBlock = orchestrator.match(/const steps = \[([\s\S]*?)\];/);
  assert.ok(stepsBlock, 'the orchestrator must declare its validation steps as a literal array');
  const actualStepCount = [...stepsBlock[1].matchAll(/'([^']+\.mjs)'/g)].length;
  assert.match(
    orchestrator,
    new RegExp(`These ${actualStepCount} validators`),
    'the header comment must state the true, current step count rather than a stale pin',
  );
  assert.match(orchestrator, /W2-H PROPOSED \/ NOT ACCEPTED/);
  assert.match(orchestrator, /const W1_CONTRACT_TEST_COUNT = 98;/);
  assert.doesNotMatch(
    orchestrator.slice(
      orchestrator.indexOf('const W1_CONTRACT_TEST_FILES'),
      orchestrator.indexOf('const W1_CONTRACT_TEST_COUNT'),
    ),
    /resource-bounds/,
  );
});

// ---------------------------------------------------------------------------
// W2-H/R2 amendment: bounded B1-B4 hardening (root closure, root binding,
// code-derived retriability, dense-sequence wording and property coverage).
//
// These tests describe the packet bytes authorized by decision section 6 and
// therefore fail against the pre-amendment implementation. A green result
// here after B1-B4 lands is still static L1/L2 conformance only.
// ---------------------------------------------------------------------------

const RES_COMMON_DEFS =
  'contracts/json-schema/cybrik.res-common-defs.v1.schema.json';
const RES_ROOT_CLOSURE =
  'contracts/json-schema/cybrik.res-root-closure.v1.schema.json';
const RES_RESERVATION_REQUEST =
  'contracts/json-schema/cybrik.res-reservation-request.v1.schema.json';
const RES_RESERVATION_RESULT =
  'contracts/json-schema/cybrik.res-reservation-result.v1.schema.json';
const RES_RELEASE = 'contracts/json-schema/cybrik.res-release.v1.schema.json';
const RES_BOUNDS_GRANT =
  'contracts/json-schema/cybrik.res-bounds-grant.v1.schema.json';
const RES_BOUNDS_ERROR =
  'contracts/json-schema/cybrik.res-bounds-error.v1.schema.json';
// Accepted, byte-pinned dependency. The validator registers it alongside the
// packet's own defs, so any test compile must register it too.
const ACCEPTED_COMMON_DEFS =
  'contracts/json-schema/cybrik.common-defs.v1.schema.json';

const defsRef = (defName) =>
  `${RES_COMMON_DEFS.split('/').at(-1)}#/$defs/${defName}`;

const flatVector = (value) =>
  Object.fromEntries(RESOURCE_KEYS.map((key) => [key, value]));

const TENANT_ID = 'tenant-blue';
const ORG_SCOPE_REF = Object.freeze({ org_id: 'org-blue' });
const CREDENTIAL_CONTEXT = Object.freeze({
  tenant_id: TENANT_ID,
  org_scope_ref: { ...ORG_SCOPE_REF },
});
const inlineCase = (caseId, events) => ({
  case_id: caseId,
  credential_context: { ...CREDENTIAL_CONTEXT },
  events,
});

// B2 rootRef: identity of the tree a record belongs to. Two properties only —
// no expected_version, and no authority.
const rootRef = (grantId) => ({ kind: 'grant', id: grantId });

const X_CYBRIK_KEYWORDS = Object.freeze([
  'x-cybrik-contract-version',
  'x-cybrik-format-pins',
  'x-cybrik-is-bundle-tag',
  'x-cybrik-not-accepted',
  'x-cybrik-status',
]);

// Mirrors the validator's own Ajv construction, including all five x-cybrik
// custom keywords. Registering fewer makes a strict compile throw on the
// packet's own annotations, and the test would never reach its assertions.
// createRequire stays inside the call so importing this file needs no
// installed dependency.
const compileSchema = (schemaPath, supportingPaths = []) => {
  const dependencyRoot =
    process.env.CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT
    || resolve(REPO_ROOT, 'tools/contract-validation');
  const require = createRequire(join(dependencyRoot, 'package.json'));
  const Ajv2020Module = require('ajv/dist/2020.js');
  const addFormatsModule = require('ajv-formats');
  const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
  const addFormats = addFormatsModule.default ?? addFormatsModule;

  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    validateFormats: true,
  });
  addFormats(ajv);
  for (const keyword of X_CYBRIK_KEYWORDS) ajv.addKeyword({ keyword });
  for (const supportingPath of supportingPaths) {
    ajv.addSchema(readJson(supportingPath));
  }
  return ajv.compile(readJson(schemaPath));
};

// Every non-grant builder takes an optional root override so a single record
// in an otherwise well-formed case can name a foreign tree. Nothing else
// varies between the bound and mis-bound forms, which is what makes the B2
// evidence exact. The grant is the root and takes no root property.
const buildGrantEvent = ({ sequence, virtualTimeMs, grantId, bounds }) => ({
  sequence,
  virtual_time_ms: virtualTimeMs,
  kind: 'grant',
  payload: {
    grant_id: grantId,
    tenant_id: TENANT_ID,
    org_scope_ref: { ...ORG_SCOPE_REF },
    bounds,
    state_version: 1,
    sequence,
    virtual_time_ms: virtualTimeMs,
    confers_authority: false,
  },
});

const buildReserveEvent = ({
  sequence,
  virtualTimeMs,
  grantId,
  requestId,
  idempotencyKey,
  reservationId,
  requested,
  parentVersionBefore,
  parentRemainingAfter,
  requestRootId = grantId,
  resultRootId = grantId,
  // C4: a re-issue asserts the parent's CURRENT version while its result still
  // restates the versions the original admission produced, so the request's
  // expected_version is separable from the result's parent_version_before.
  expectedVersion = parentVersionBefore,
}) => ({
  sequence,
  virtual_time_ms: virtualTimeMs,
  kind: 'reserve',
  payload: {
    request: {
      request_id: requestId,
      idempotency_key: idempotencyKey,
      tenant_id: TENANT_ID,
      org_scope_ref: { ...ORG_SCOPE_REF },
      root: rootRef(requestRootId),
      parent: { kind: 'grant', id: grantId, expected_version: expectedVersion },
      requested,
      sequence,
      virtual_time_ms: virtualTimeMs,
      confers_authority: false,
    },
    result: {
      request_id: requestId,
      status: 'admitted',
      root: rootRef(resultRootId),
      reservation: {
        reservation_id: reservationId,
        // No mint on spawn: a child opens holding exactly what it drew down.
        reserved: requested,
        remaining: requested,
        state_version: 1,
        status: 'open',
      },
      parent_version_before: parentVersionBefore,
      parent_version_after: parentVersionBefore + 1,
      parent_remaining_after: parentRemainingAfter,
      sequence,
      virtual_time_ms: virtualTimeMs,
      confers_authority: false,
    },
  },
});

// A denied admission carries an error and no reservation, and moves neither
// the parent's version nor its remainder.
const buildDeniedReserveEvent = ({
  sequence,
  virtualTimeMs,
  grantId,
  requestId,
  idempotencyKey,
  requested,
  parentVersion,
  parentRemaining,
}) => ({
  sequence,
  virtual_time_ms: virtualTimeMs,
  kind: 'reserve',
  payload: {
    request: {
      request_id: requestId,
      idempotency_key: idempotencyKey,
      tenant_id: TENANT_ID,
      org_scope_ref: { ...ORG_SCOPE_REF },
      root: rootRef(grantId),
      parent: { kind: 'grant', id: grantId, expected_version: parentVersion },
      requested,
      sequence,
      virtual_time_ms: virtualTimeMs,
      confers_authority: false,
    },
    result: {
      request_id: requestId,
      status: 'denied',
      root: rootRef(grantId),
      error: {
        code: 'RES_INSUFFICIENT_REMAINDER',
        message: 'insufficient remainder',
        // B3 mapping: peer state can clear this one, so it is retriable.
        retriable: true,
        fail_closed: true,
      },
      parent_version_before: parentVersion,
      parent_version_after: parentVersion,
      parent_remaining_after: parentRemaining,
      sequence,
      virtual_time_ms: virtualTimeMs,
      confers_authority: false,
    },
  },
});

const buildReleaseEvent = ({
  sequence,
  virtualTimeMs,
  grantId,
  releaseId,
  reservationId,
  reservationVersion,
  consumed,
  returned,
  rootId = grantId,
}) => ({
  sequence,
  virtual_time_ms: virtualTimeMs,
  kind: 'release',
  payload: {
    release_id: releaseId,
    tenant_id: TENANT_ID,
    org_scope_ref: { ...ORG_SCOPE_REF },
    root: rootRef(rootId),
    target: {
      kind: 'reservation',
      id: reservationId,
      expected_version: reservationVersion,
    },
    consumed,
    returned,
    sequence,
    virtual_time_ms: virtualTimeMs,
    reason: 'completed',
    confers_authority: false,
  },
});

const buildRootClosureEvent = ({
  sequence,
  virtualTimeMs,
  grantId,
  closureId,
  finalConsumed,
  finalUnused,
  stateVersionBefore,
  stateVersionAfter,
  reason = 'completed',
  rootId = grantId,
}) => ({
  sequence,
  virtual_time_ms: virtualTimeMs,
  kind: 'root-closure',
  payload: {
    closure_id: closureId,
    root: rootRef(rootId),
    tenant_id: TENANT_ID,
    org_scope_ref: { ...ORG_SCOPE_REF },
    reason,
    final_consumed: finalConsumed,
    final_unused: finalUnused,
    closes_descendants: true,
    state_version_before: stateVersionBefore,
    state_version_after: stateVersionAfter,
    sequence,
    virtual_time_ms: virtualTimeMs,
    confers_authority: false,
  },
});

test('B1: cybrik.res-root-closure.v1 declares the exact seventh-schema shape and reuses hoisted defs', () => {
  const commonDefs = readJson(RES_COMMON_DEFS);
  assert.match(commonDefs.$defs.closureId.pattern, /\^rcl_\[a-z0-9\]\{16,64\}\$/);

  const schema = readJson(RES_ROOT_CLOSURE);
  const REQUIRED = [
    'closure_id',
    'root',
    'tenant_id',
    'org_scope_ref',
    'reason',
    'final_consumed',
    'final_unused',
    'closes_descendants',
    'state_version_before',
    'state_version_after',
    'sequence',
    'virtual_time_ms',
    'confers_authority',
  ];
  assert.deepEqual([...schema.required].sort(), [...REQUIRED].sort());
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema['x-cybrik-status'], 'PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED');
  assert.equal(schema['x-cybrik-not-accepted'], true);
  assert.equal(schema['x-cybrik-contract-version'], '0.1.0');
  assert.equal(schema['x-cybrik-is-bundle-tag'], false);
  // The const is the contract; a description alongside it is not drift.
  assert.equal(schema.properties.closes_descendants.const, true);
  assert.equal(schema.properties.confers_authority.const, false);
  assert.equal(schema.properties.closure_id.$ref, defsRef('closureId'));
  assert.equal(schema.properties.root.$ref, defsRef('rootRef'));
  assert.equal(schema.properties.final_consumed.$ref, defsRef('resourceVector'));
  assert.equal(schema.properties.final_unused.$ref, defsRef('resourceVector'));
});

test('B2: rootRef is common-defs-only, parallel to parentRef, and root is required on every non-grant record', () => {
  const commonDefs = readJson(RES_COMMON_DEFS);
  const rootRef = commonDefs.$defs.rootRef;
  assert.equal(rootRef.type, 'object');
  assert.equal(rootRef.additionalProperties, false);
  assert.deepEqual([...rootRef.required].sort(), ['id', 'kind']);
  assert.deepEqual(rootRef.properties.kind, { const: 'grant' });
  assert.equal(rootRef.properties.id.$ref, '#/$defs/grantId');
  assert.equal('expected_version' in rootRef.properties, false);

  for (const path of [
    RES_RESERVATION_REQUEST,
    RES_RESERVATION_RESULT,
    RES_RELEASE,
    RES_ROOT_CLOSURE,
  ]) {
    const schema = readJson(path);
    assert.ok(schema.required.includes('root'), `${path} must require root`);
    assert.equal(schema.properties.root.$ref, defsRef('rootRef'), path);
  }

  const grantSchema = readJson(RES_BOUNDS_GRANT);
  assert.equal(grantSchema.required.includes('root'), false);
  assert.equal('root' in grantSchema.properties, false);
});

test('B1: closureReason is hoisted once into common-defs and shared verbatim by release and root closure', () => {
  const commonDefs = readJson(RES_COMMON_DEFS);
  assert.deepEqual(commonDefs.$defs.closureReason.enum, [
    'completed',
    'cancelled',
    'failed',
    'expired',
  ]);

  // Both records must reach the one hoisted def. A local description beside
  // the $ref is permitted; a local enum, const, or type is not — that would be
  // a second copy of the vocabulary.
  for (const path of [RES_RELEASE, RES_ROOT_CLOSURE]) {
    const reason = readJson(path).properties.reason;
    assert.equal(reason.$ref, defsRef('closureReason'), path);
    assert.deepEqual(
      Object.keys(reason).filter((key) => key !== 'description').sort(),
      ['$ref'],
      path,
    );
  }
});

test('B3: res-bounds-error retriable becomes a code-derived mapping, true only for RES_INSUFFICIENT_REMAINDER and RES_ACTIVE_CHILDREN', () => {
  const schema = readJson(RES_BOUNDS_ERROR);
  assert.notDeepEqual(schema.properties.retriable, { const: false });
  assert.equal(schema.properties.fail_closed.const, true);

  // §6.2 B2: the amendment mints no code. The mapping is exhaustive over these
  // fifteen precisely because the enum and the replay codes stay identical.
  assert.equal(REPLAY_ERROR_CODES.length, 15);
  assert.deepEqual(
    [...schema.properties.code.enum].sort(),
    [...REPLAY_ERROR_CODES].sort(),
  );

  // retriable is a single-record function of code, so JSON Schema is the
  // correct home for it: a closed if/then/else over code needs no state beyond
  // the record being validated.
  const validate = compileSchema(RES_BOUNDS_ERROR);

  const RETRIABLE_CODES = new Set([
    'RES_INSUFFICIENT_REMAINDER',
    'RES_ACTIVE_CHILDREN',
  ]);
  assert.equal(RETRIABLE_CODES.size, 2);
  for (const code of REPLAY_ERROR_CODES) {
    const expectedRetriable = RETRIABLE_CODES.has(code);
    assert.equal(
      validate({ code, message: 'x', fail_closed: true, retriable: expectedRetriable }),
      true,
      `${code} retriable:${expectedRetriable} must validate under the mapping`,
    );
    assert.equal(
      validate({ code, message: 'x', fail_closed: true, retriable: !expectedRetriable }),
      false,
      `${code} retriable:${!expectedRetriable} must be structurally invalid`,
    );
  }
});

test('B3: the packet\'s own denial fixtures already reflect the flipped code-derived retriable mapping', () => {
  for (const path of [
    'contracts/examples/resource-bounds/positive/reservation-result.denied.json',
    'contracts/examples/resource-bounds/negative-schema/reservation-result.denied-with-reservation.json',
  ]) {
    const fixture = readJson(path);
    assert.equal(fixture.error.code, 'RES_INSUFFICIENT_REMAINDER', path);
    assert.equal(
      fixture.error.retriable,
      true,
      `${path} must flip to retriable:true, or it contradicts the new B3 mapping`,
    );
  }
});

test('B3: res-bounds-error explicitly declares its standalone-failure-document binding', () => {
  const schema = readJson(RES_BOUNDS_ERROR);
  assert.match(schema.description, /standalone failure document/i);
  assert.match(schema.description, /never a ledger record/i);
});

// W2-H/R2 §6.3.2, in the decision's own order. A replay fixture binds no
// single schema — the validator walks its events — so `schema` is absent for
// one positive entry, and only semantic entries carry an expected code.
const NEW_FIXTURE_REGISTRATIONS = Object.freeze([
  {
    file: 'positive/root-closure.completed.json',
    kind: 'positive',
    schema: 'cybrik.res-root-closure.v1.schema.json',
  },
  {
    file: 'positive/bounds-error.standalone.json',
    kind: 'positive',
    schema: 'cybrik.res-bounds-error.v1.schema.json',
  },
  { file: 'positive/replay.denied-admission.json', kind: 'positive' },
  {
    file: 'negative-schema/root-closure.partial-closure.json',
    kind: 'negative-schema',
    schema: 'cybrik.res-root-closure.v1.schema.json',
  },
  {
    file: 'negative-schema/release.missing-root.json',
    kind: 'negative-schema',
    schema: 'cybrik.res-release.v1.schema.json',
  },
  {
    file: 'negative-schema/bounds-error.retriable-mismatch.json',
    kind: 'negative-schema',
    schema: 'cybrik.res-bounds-error.v1.schema.json',
  },
  {
    file: 'negative-semantic/replay.root-binding-mismatch.json',
    kind: 'negative-semantic',
    expected_error: 'RES_PARENT_NOT_FOUND',
  },
  {
    file: 'negative-semantic/replay.root-closure-accounting-mismatch.json',
    kind: 'negative-semantic',
    expected_error: 'RES_RELEASE_ACCOUNTING_MISMATCH',
  },
  {
    file: 'negative-semantic/replay.sequence-gap.json',
    kind: 'negative-semantic',
    expected_error: 'RES_SEQUENCE_VIOLATION',
  },
]);

test('B1-B4: the examples manifest registers exactly the nine authorized new fixtures', () => {
  assert.equal(NEW_FIXTURE_REGISTRATIONS.length, 9);
  const manifest = readJson(
    'contracts/examples/resource-bounds/examples-manifest.json',
  );
  // The registration set is R2's nine and does not move; the corpus it sits in
  // grows to R3's thirty-six.
  assert.equal(manifest.fixtures.length, 36);
  const byFile = new Map(manifest.fixtures.map((entry) => [entry.file, entry]));

  for (const expected of NEW_FIXTURE_REGISTRATIONS) {
    const entry = byFile.get(expected.file);
    assert.ok(entry, `${expected.file} must be registered`);
    assert.equal(entry.kind, expected.kind, expected.file);
    assert.equal(entry.schema, expected.schema, expected.file);
    assert.equal(entry.expected_error, expected.expected_error, expected.file);
    assert.match(entry.sha256 ?? '', /^[0-9a-f]{64}$/, expected.file);
  }
});

test('B4: ledgerSequence wording states the enforced dense, single-serialization-point rule', () => {
  const commonDefs = readJson(RES_COMMON_DEFS);
  const description = commonDefs.$defs.ledgerSequence.description;
  assert.match(description, /dense/i);
  assert.match(description, /exactly 1/);
  assert.match(description, /no gap/i);
  assert.match(description, /no repeat/i);
  assert.match(description, /no reorder/i);
  assert.equal(commonDefs.$defs.ledgerSequence.type, 'integer');
  assert.equal(commonDefs.$defs.ledgerSequence.minimum, 1);

  const architectureDoc = readText(
    'docs/architecture/resource-bounds/01-contract-semantics.md',
  );
  assert.match(architectureDoc, /exactly one serialization point per root tree/i);
  assert.match(architectureDoc, /RES_SEQUENCE_VIOLATION/);
});

test('B4: replay accepts a denied reserve result, leaves the parent unchanged, and continues the tree', () => {
  const grantId = 'rbg_denycontinue000001';
  const bounds = flatVector(5);
  const deniedEvent = () => buildDeniedReserveEvent({
    sequence: 2,
    virtualTimeMs: 1010,
    grantId,
    requestId: 'rsq_denycontinue0000001',
    idempotencyKey: 'idem.denycontinue.0000001',
    requested: flatVector(6),
    parentVersion: 1,
    parentRemaining: bounds,
  });
  const caseWith = (events) => inlineCase(
    'inline.denied-admission-continues',
    [buildGrantEvent({ sequence: 1, virtualTimeMs: 1000, grantId, bounds }), ...events],
  );

  const result = replayResourceCase(caseWith([
    deniedEvent(),
    // The tree continues from the version and remainder the denial left alone.
    buildReserveEvent({
      sequence: 3,
      virtualTimeMs: 1020,
      grantId,
      requestId: 'rsq_denycontinue0000002',
      idempotencyKey: 'idem.denycontinue.0000002',
      reservationId: 'rsr_denycontinue0000002',
      requested: flatVector(2),
      parentVersionBefore: 1,
      parentRemainingAfter: flatVector(3),
    }),
  ]));
  assert.equal(result.accepted, true);
  assert.deepEqual(result.errors, []);
  const denialEntry = result.trace.find((entry) => entry.sequence === 2);
  assert.ok(denialEntry, 'the denial must be recorded in the trace, not dropped');
  assert.equal(denialEntry.admitted, false);
  assert.deepEqual(result.finalRootRemaining, flatVector(3));

  // Accepting denials must not weaken the result check: each malformed denial
  // differs from the accepted one in exactly one field.
  const MALFORMED_DENIALS = [
    ['a denial carrying a reservation', (denial) => {
      denial.reservation = {
        reservation_id: 'rsr_denycontinue0000001',
        reserved: flatVector(6),
        remaining: flatVector(6),
        state_version: 1,
        status: 'open',
      };
    }],
    ['a denial carrying no error', (denial) => { delete denial.error; }],
    ['a denial that moves the parent version', (denial) => {
      denial.parent_version_after += 1;
    }],
    ['a denial that moves the parent remainder', (denial) => {
      denial.parent_remaining_after = flatVector(4);
    }],
  ];

  for (const [label, mutate] of MALFORMED_DENIALS) {
    const event = deniedEvent();
    mutate(event.payload.result);
    const malformed = replayResourceCase(caseWith([event]));
    assert.equal(malformed.accepted, false, label);
    assert.deepEqual(malformed.errors, ['RES_RESULT_MISMATCH'], label);
  }
});

test('B1: replay recognizes the renamed root-closure event kind and reconciles exact accounting', () => {
  // W2-H/R3 §7.3.3: the R2 form of this case declared a 4/6 split over a ledger
  // holding no reservation and no release, which is exactly the free split C1
  // closes. It is rebased onto a ledger that reserves from the root and
  // releases with consumed 4 before the closure, so the declared split is the
  // one the ledger produces. Every assertion below is unchanged.
  const fixture = inlineCase(
    'inline.root-closure.completed',
    buildSettledLedgerEvents(),
  );

  const result = replayResourceCase(fixture);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.finalRootRemaining, zeroVector());
  assert.equal(result.trace.at(-1).kind, 'root-closure');
  assert.equal(result.trace.at(-1).rootClosed, true);
  // The declared split is the replayed one: 4 consumed by the released child,
  // 6 never drawn from the root.
  assert.deepEqual(result.trace.at(-1).finalConsumed, flatVector(4));
  assert.deepEqual(result.trace.at(-1).finalUnused, flatVector(6));
});

test('B1: nested replay payload validation binds root-closure events to the seventh schema', () => {
  // A replay fixture's events are schema-checked by kind. Without this entry a
  // structurally invalid root-closure payload would pass unvalidated inside an
  // otherwise conforming fixture, which no fixture-level check would catch.
  const mapping = readText('tools/contract-validation/validate-resource-bounds.mjs')
    .match(/const mapping = \{([\s\S]*?)\};/);
  assert.ok(mapping, 'nested payload validation must declare a literal kind-to-schema mapping');
  assert.match(
    mapping[1],
    /['"]root-closure['"]:\s*\[\s*\[\s*['"]payload['"],\s*['"]cybrik\.res-root-closure\.v1\.schema\.json['"]\s*\]/,
  );
});

test('B1: a root closure whose final_consumed+final_unused misses the grant bounds fails closed on RES_RELEASE_ACCOUNTING_MISMATCH', () => {
  const grantId = 'rbg_closure0000000002';
  const bounds = flatVector(10);
  const fixture = inlineCase('inline.root-closure.mismatch', [
    buildGrantEvent({ sequence: 1, virtualTimeMs: 1000, grantId, bounds }),
    buildRootClosureEvent({
      sequence: 2,
      virtualTimeMs: 1010,
      grantId,
      closureId: 'rcl_closure0000000002',
      finalConsumed: flatVector(4),
      finalUnused: flatVector(5),
      stateVersionBefore: 1,
      stateVersionAfter: 2,
    }),
  ]);

  // final_consumed + final_unused == the closing grant's bounds is a
  // cross-record property, so it must NOT be delegated to JSON Schema: the
  // record is structurally valid on its own and only replay can refuse it.
  // The compile mirrors the validator's own root closure: the packet's defs
  // plus the accepted common defs the tenant reference resolves through.
  const validateClosure = compileSchema(RES_ROOT_CLOSURE, [
    RES_COMMON_DEFS,
    ACCEPTED_COMMON_DEFS,
  ]);
  assert.equal(
    validateClosure(fixture.events[1].payload),
    true,
    'a closure record that misses the grant bounds is still structurally valid',
  );

  const result = replayResourceCase(fixture);
  assert.equal(result.accepted, false);
  assert.deepEqual(result.errors, ['RES_RELEASE_ACCOUNTING_MISMATCH']);
});

test('B1: root closure closes and zeroes exactly the still-open descendants, and the ledger stays shut afterwards', () => {
  const grantId = 'rbg_closedesc00000001';
  // Two children, and one of them is released before the closure. A closure
  // that reported "every descendant" would name the released child too, so the
  // evidence distinguishes closing open state from restating the roster.
  const releasedChild = 'rsr_closedesc0000001';
  const openChild = 'rsr_closedesc0000002';
  const fixture = inlineCase('inline.root-closure.descendants', [
    buildGrantEvent({
      sequence: 1,
      virtualTimeMs: 1000,
      grantId,
      bounds: flatVector(10),
    }),
    buildReserveEvent({
      sequence: 2,
      virtualTimeMs: 1010,
      grantId,
      requestId: 'rsq_closedesc0000001',
      idempotencyKey: 'idem.closedesc.0000001',
      reservationId: releasedChild,
      requested: flatVector(4),
      parentVersionBefore: 1,
      parentRemainingAfter: flatVector(6),
    }),
    buildReserveEvent({
      sequence: 3,
      virtualTimeMs: 1020,
      grantId,
      requestId: 'rsq_closedesc0000002',
      idempotencyKey: 'idem.closedesc.0000002',
      reservationId: openChild,
      requested: flatVector(3),
      parentVersionBefore: 2,
      parentRemainingAfter: flatVector(3),
    }),
    // The first child consumes 1 and returns 3, closing itself and lifting the
    // root back to 6 before the closure runs.
    buildReleaseEvent({
      sequence: 4,
      virtualTimeMs: 1030,
      grantId,
      releaseId: 'rsl_closedesc0000001',
      reservationId: releasedChild,
      reservationVersion: 1,
      consumed: flatVector(1),
      returned: flatVector(3),
    }),
    // 1 consumed by the closed child, 9 unused: 6 held by the root plus the 3
    // the still-open child never spent.
    buildRootClosureEvent({
      sequence: 5,
      virtualTimeMs: 1040,
      grantId,
      closureId: 'rcl_closedesc00000001',
      finalConsumed: flatVector(1),
      finalUnused: flatVector(9),
      stateVersionBefore: 4,
      stateVersionAfter: 5,
    }),
    buildReleaseEvent({
      sequence: 6,
      virtualTimeMs: 1050,
      grantId,
      releaseId: 'rsl_closedesc0000002',
      reservationId: openChild,
      reservationVersion: 1,
      consumed: flatVector(0),
      returned: flatVector(3),
    }),
  ]);

  const result = replayResourceCase(fixture);
  assert.equal(
    result.accepted,
    false,
    'releasing a descendant closed by root closure must fail closed',
  );
  // The existing root-closed guard precedes every per-target guard, so a
  // post-closure event is refused as RES_ROOT_CLOSED. Demanding
  // RES_ALREADY_RELEASED here would require reordering that guard, which §6.2
  // does not authorize.
  assert.deepEqual(result.errors, ['RES_ROOT_CLOSED']);

  // With the ledger shut, descendant state is unreachable through replay
  // input, so the closure trace entry carries the evidence §6.2 requires:
  // every descendant still open at closure, each left with zero remaining.
  const closureEntry = result.trace.at(-1);
  assert.equal(closureEntry.kind, 'root-closure');
  assert.equal(closureEntry.rootClosed, true);
  assert.deepEqual(closureEntry.closedDescendants, [
    { reservationId: openChild, remainingAfter: zeroVector() },
  ]);
});

test('B2: a record bound to a foreign root fails closed on RES_PARENT_NOT_FOUND wherever it appears', () => {
  const grantId = 'rbg_rootbind000000001';
  const wrongRootId = 'rbg_wrongroot00000001';
  const reservationId = 'rsr_rootbind0000000001';
  // In each case exactly one record names a foreign tree while its parent, its
  // versions, and its accounting stay correct, so nothing but the root binding
  // can produce the failure.
  const reserve = (overrides) => buildReserveEvent({
    sequence: 2,
    virtualTimeMs: 1010,
    grantId,
    requestId: 'rsq_rootbind0000000001',
    idempotencyKey: 'idem.rootbind.0000000001',
    reservationId,
    requested: flatVector(4),
    parentVersionBefore: 1,
    parentRemainingAfter: flatVector(6),
    ...overrides,
  });
  const release = (overrides) => buildReleaseEvent({
    sequence: 3,
    virtualTimeMs: 1020,
    grantId,
    releaseId: 'rsl_rootbind0000000001',
    reservationId,
    reservationVersion: 1,
    consumed: flatVector(1),
    returned: flatVector(3),
    ...overrides,
  });

  const MISBOUND_CASES = [
    ['reservation request', [reserve({ requestRootId: wrongRootId })]],
    ['reservation result', [reserve({ resultRootId: wrongRootId })]],
    ['release', [reserve({}), release({ rootId: wrongRootId })]],
    ['root closure', [buildRootClosureEvent({
      sequence: 2,
      virtualTimeMs: 1010,
      grantId,
      closureId: 'rcl_rootbind000000001',
      finalConsumed: flatVector(0),
      finalUnused: flatVector(10),
      stateVersionBefore: 1,
      stateVersionAfter: 2,
      rootId: wrongRootId,
    })]],
  ];

  for (const [label, events] of MISBOUND_CASES) {
    const result = replayResourceCase(inlineCase(
      `inline.root-binding-mismatch.${label}`,
      [
        buildGrantEvent({
          sequence: 1,
          virtualTimeMs: 1000,
          grantId,
          bounds: flatVector(10),
        }),
        ...events,
      ],
    ));
    assert.equal(result.accepted, false, label);
    assert.deepEqual(result.errors, ['RES_PARENT_NOT_FOUND'], label);
  }
});

test('B4: seeded synthetic trees replay admission, release, and terminal root closure with conserved accounting', () => {
  const next = createXorshift32(0x43594252);

  for (let sample = 0; sample < 64; sample += 1) {
    const sampleId = String(sample).padStart(6, '0');
    const grantId = `rbg_seed${sampleId}000000`;
    const label = `sample ${sample}`;
    // Every dimension opens above the per-request ceiling, so at least one
    // child is always admitted and the release leg is never vacuous.
    const bounds = Object.fromEntries(
      RESOURCE_KEYS.map((key) => [key, 500 + (next() % 10_000)]),
    );

    const events = [
      buildGrantEvent({ sequence: 1, virtualTimeMs: 1000, grantId, bounds }),
    ];
    let sequence = 2;
    let virtualTimeMs = 1000;
    let rootRemaining = { ...bounds };
    let rootVersion = 1;
    const admitted = [];

    for (let child = 0; child < 8; child += 1) {
      const requested = Object.fromEntries(
        RESOURCE_KEYS.map((key) => [key, next() % 500]),
      );
      if (Object.values(requested).every((value) => value === 0)) {
        requested.tool_calls = 1;
      }
      if (!vectorLessThanOrEqual(requested, rootRemaining)) continue;

      const childId = String(child).padStart(6, '0');
      const reservationId = `rsr_seed${sampleId}${childId}`;
      rootRemaining = vectorSubtract(rootRemaining, requested);
      virtualTimeMs += 10;
      events.push(buildReserveEvent({
        sequence,
        virtualTimeMs,
        grantId,
        requestId: `rsq_seed${sampleId}${childId}`,
        idempotencyKey: `idem.seed.${sampleId}.${childId}`,
        reservationId,
        requested,
        parentVersionBefore: rootVersion,
        parentRemainingAfter: rootRemaining,
      }));
      sequence += 1;
      rootVersion += 1;
      admitted.push({ reservationId, reserved: requested, childId });
    }

    let declaredConsumed = zeroVector();
    for (const { reservationId, reserved, childId } of admitted) {
      const consumed = Object.fromEntries(
        RESOURCE_KEYS.map((key) => [key, next() % (reserved[key] + 1)]),
      );
      const returned = vectorSubtract(reserved, consumed);
      virtualTimeMs += 10;
      events.push(buildReleaseEvent({
        sequence,
        virtualTimeMs,
        grantId,
        releaseId: `rsl_seed${sampleId}${childId}`,
        reservationId,
        reservationVersion: 1,
        consumed,
        returned,
      }));
      sequence += 1;
      rootRemaining = vectorAdd(rootRemaining, returned);
      rootVersion += 1;
      declaredConsumed = vectorAdd(declaredConsumed, consumed);
    }

    events.push(buildRootClosureEvent({
      sequence,
      virtualTimeMs: virtualTimeMs + 10,
      grantId,
      closureId: `rcl_seed${sampleId}000000`,
      finalConsumed: declaredConsumed,
      finalUnused: rootRemaining,
      stateVersionBefore: rootVersion,
      stateVersionAfter: rootVersion + 1,
    }));

    const result = replayResourceCase(
      inlineCase(`inline.seeded-tree.${sample}`, events),
    );

    assert.deepEqual(result.errors, [], label);
    assert.equal(result.accepted, true, label);

    const reserveEntries = result.trace.filter((entry) => entry.kind === 'reserve');
    const releaseEntries = result.trace.filter((entry) => entry.kind === 'release');
    assert.ok(reserveEntries.length > 0, `${label} admitted no child`);
    assert.equal(reserveEntries.length, admitted.length, label);
    assert.equal(releaseEntries.length, admitted.length, label);

    // Drawdown is exact and monotone: a child takes what it asked for.
    for (const entry of reserveEntries) {
      assert.deepEqual(
        vectorSubtract(entry.parentRemainingBefore, entry.parentRemainingAfter),
        entry.requested,
        label,
      );
    }
    // Release returns the unconsumed remainder, and nothing more.
    for (const entry of releaseEntries) {
      assert.deepEqual(
        vectorAdd(entry.consumed, entry.returned),
        entry.availableBefore,
        label,
      );
      assert.deepEqual(
        vectorSubtract(entry.parentRemainingAfter, entry.parentRemainingBefore),
        entry.returned,
        label,
      );
    }

    // Conservation read off replayed state rather than off the generator's own
    // arithmetic: what the tree consumed, plus what the root still held when it
    // closed, is the original grant.
    const replayedConsumed = releaseEntries.reduce(
      (sum, entry) => vectorAdd(sum, entry.consumed),
      zeroVector(),
    );
    assert.deepEqual(
      vectorAdd(replayedConsumed, releaseEntries.at(-1).parentRemainingAfter),
      bounds,
      label,
    );
    assert.deepEqual(
      replayedConsumed,
      declaredConsumed,
      `${label}: the closure record's final_consumed must be the replayed total`,
    );

    // The terminal closure extinguishes the remainder — returned to nobody.
    const closureEntry = result.trace.at(-1);
    assert.equal(closureEntry.kind, 'root-closure', label);
    assert.equal(closureEntry.rootClosed, true, label);
    assert.deepEqual(result.finalRootRemaining, zeroVector(), label);
  }
});

test('the authorized R3 packet totals exactly 45 members with a 10/10/16 fixture split and 7 schemas', () => {
  assert.equal(expectedPacketPaths.length, 45);

  const positiveCount = expectedPacketPaths.filter((path) =>
    path.includes('/examples/resource-bounds/positive/')).length;
  const negativeSchemaCount = expectedPacketPaths.filter((path) =>
    path.includes('/examples/resource-bounds/negative-schema/')).length;
  const negativeSemanticCount = expectedPacketPaths.filter((path) =>
    path.includes('/examples/resource-bounds/negative-semantic/')).length;
  const schemaCount = expectedPacketPaths.filter((path) =>
    path.startsWith('contracts/json-schema/cybrik.res-')).length;

  assert.equal(positiveCount, 10);
  // R3 adds no negative-schema fixture and no schema.
  assert.equal(negativeSchemaCount, 10);
  assert.equal(negativeSemanticCount, 16);
  assert.equal(schemaCount, 7);
});

test('the compatibility manifest recomputes to member_count 45 while the accepted dependency pins stay untouched', () => {
  const manifest = readJson(
    'contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json',
  );
  assert.equal(manifest['x-cybrik-packet-integrity'].member_count, 45);
  assert.equal(manifest['x-cybrik-packet-integrity'].member_digests.length, 45);
  assert.equal(manifest.members.length, 45);

  assert.equal(manifest.dependencies_reused_unmodified.length, 4);
  assert.equal(declaredDependencyPinsMatch(manifest), true);
});

// ---------------------------------------------------------------------------
// W2-H/R3 amendment: bounded C1-C4 replay-truth hardening (ledger-derived
// closure settlement, envelope/nested ordering agreement, denial truth, and
// the canonical idempotent request identity).
//
// These tests describe the replay rules authorized by decision section 7 and
// therefore fail against the R2 implementation. A green result here after
// C1-C4 land is still static L1/L2 conformance only: it accepts no ADR, closes
// no RES_ACTIVE_CHILDREN retriability gap, and measures nothing running.
// ---------------------------------------------------------------------------

const RES_BOUNDS_ERROR_RETRIABLE_MISMATCH =
  'contracts/examples/resource-bounds/negative-schema/bounds-error.retriable-mismatch.json';
const COMPATIBILITY_MANIFEST =
  'contracts/compatibility/cybrik-suite-resource-bounds-packet.v1.manifest.json';

// W2-H/R3 §7.3.2, in the decision's own order. Every entry is a replay ledger,
// so none binds a single schema and only the four negatives carry a code.
const R3_FIXTURE_REGISTRATIONS = Object.freeze([
  { file: 'positive/replay.denied-then-admitted.json', kind: 'positive' },
  {
    file: 'negative-semantic/replay.closure-settlement-split-mismatch.json',
    kind: 'negative-semantic', expected_error: 'RES_RELEASE_ACCOUNTING_MISMATCH',
  },
  {
    file: 'negative-semantic/replay.record-sequence-mismatch.json',
    kind: 'negative-semantic', expected_error: 'RES_SEQUENCE_VIOLATION',
  },
  {
    file: 'negative-semantic/replay.denial-unjustified.json',
    kind: 'negative-semantic', expected_error: 'RES_RESULT_MISMATCH',
  },
  {
    file: 'negative-semantic/replay.denial-idempotency-conflict.json',
    kind: 'negative-semantic', expected_error: 'RES_IDEMPOTENCY_CONFLICT',
  },
]);

// One settled ledger, shared by the rebased B1 case, the C1 split table, and
// the C2 table. Bounds 10: a first child draws 6 and releases consuming 4
// (root 6, accumulated consumed 4), a second draws 3 and stays open (root 3),
// and the closure declares consumed 4 and unused 3 + 3. It carries no re-issue
// at all, so a C1 or C2 failure here is that rule and nothing the idempotency
// rules do; every nested record already carries its envelope's position.
const SETTLED_GRANT_ID = 'rbg_settled000000001';
const SETTLED_OPEN_CHILD_ID = 'rsr_settled000000002';
const buildSettledLedgerEvents = (
  finalConsumed = flatVector(4),
  finalUnused = flatVector(6),
) => [
  buildGrantEvent({
    sequence: 1, virtualTimeMs: 1000,
    grantId: SETTLED_GRANT_ID, bounds: flatVector(10),
  }),
  buildReserveEvent({
    sequence: 2, virtualTimeMs: 1010, grantId: SETTLED_GRANT_ID,
    requestId: 'rsq_settled000000001', idempotencyKey: 'idem.settled.000000001',
    reservationId: 'rsr_settled000000001', requested: flatVector(6),
    parentVersionBefore: 1, parentRemainingAfter: flatVector(4),
  }),
  buildReleaseEvent({
    sequence: 3, virtualTimeMs: 1020, grantId: SETTLED_GRANT_ID,
    releaseId: 'rsl_settled000000001', reservationId: 'rsr_settled000000001',
    reservationVersion: 1, consumed: flatVector(4), returned: flatVector(2),
  }),
  buildReserveEvent({
    sequence: 4, virtualTimeMs: 1030, grantId: SETTLED_GRANT_ID,
    requestId: 'rsq_settled000000002', idempotencyKey: 'idem.settled.000000002',
    reservationId: SETTLED_OPEN_CHILD_ID, requested: flatVector(3),
    parentVersionBefore: 3, parentRemainingAfter: flatVector(3),
  }),
  buildRootClosureEvent({
    sequence: 5, virtualTimeMs: 1040, grantId: SETTLED_GRANT_ID,
    closureId: 'rcl_settled000000001', finalConsumed, finalUnused,
    stateVersionBefore: 4, stateVersionAfter: 5,
  }),
];

const DTA_GRANT_ID = 'rbg_deniedadmit00001';
const DTA_SIBLING_ID = 'rsr_deniedadmit00000';
const DTA_REQUEST_ID = 'rsq_deniedadmit00001';
const DTA_IDEMPOTENCY_KEY = 'idem.deniedadmit.00001';
const DTA_RESERVATION_ID = 'rsr_deniedadmit00001';
const DTA_REQUESTED = flatVector(5);

// The in-memory twin of positive/replay.denied-then-admitted.json: one causal
// chain in one root tree carrying the whole positive path of C1-C4. Bounds 10.
//   1 grant                     root 10, v1
//   2 sibling draws 6           root 4,  v2
//   3 denial: 5 exceeds 4       root 4,  v2  (C3 justified, C4 binds the key)
//   4 sibling releases 3/3      root 7,  v3  (C1 accumulates consumed 3)
//   5 same request, now admitted at the CURRENT version   root 2, v4
//   6 identity-matching replay, re-draws nothing
//   7 closure: consumed 3, unused 2 (root) + 5 (open child) = 7
const buildDeniedThenAdmittedEvents = () => [
  buildGrantEvent({
    sequence: 1, virtualTimeMs: 1000,
    grantId: DTA_GRANT_ID, bounds: flatVector(10),
  }),
  buildReserveEvent({
    sequence: 2, virtualTimeMs: 1010, grantId: DTA_GRANT_ID,
    requestId: 'rsq_deniedadmit00000', idempotencyKey: 'idem.deniedadmit.00000',
    reservationId: DTA_SIBLING_ID, requested: flatVector(6),
    parentVersionBefore: 1, parentRemainingAfter: flatVector(4),
  }),
  buildDeniedReserveEvent({
    sequence: 3, virtualTimeMs: 1020, grantId: DTA_GRANT_ID,
    requestId: DTA_REQUEST_ID, idempotencyKey: DTA_IDEMPOTENCY_KEY,
    requested: DTA_REQUESTED, parentVersion: 2, parentRemaining: flatVector(4),
  }),
  buildReleaseEvent({
    sequence: 4, virtualTimeMs: 1030, grantId: DTA_GRANT_ID,
    releaseId: 'rsl_deniedadmit00000', reservationId: DTA_SIBLING_ID,
    reservationVersion: 1, consumed: flatVector(3), returned: flatVector(3),
  }),
  buildReserveEvent({
    sequence: 5, virtualTimeMs: 1040, grantId: DTA_GRANT_ID,
    requestId: DTA_REQUEST_ID, idempotencyKey: DTA_IDEMPOTENCY_KEY,
    reservationId: DTA_RESERVATION_ID, requested: DTA_REQUESTED,
    parentVersionBefore: 3, parentRemainingAfter: flatVector(2),
  }),
  // The replay's result restates what the first admission produced; only its
  // request's expected_version tracks the parent's current version.
  buildReserveEvent({
    sequence: 6, virtualTimeMs: 1050, grantId: DTA_GRANT_ID,
    requestId: DTA_REQUEST_ID, idempotencyKey: DTA_IDEMPOTENCY_KEY,
    reservationId: DTA_RESERVATION_ID, requested: DTA_REQUESTED,
    parentVersionBefore: 3, parentRemainingAfter: flatVector(2),
    expectedVersion: 4,
  }),
  buildRootClosureEvent({
    sequence: 7, virtualTimeMs: 1060, grantId: DTA_GRANT_ID,
    closureId: 'rcl_deniedadmit00001',
    finalConsumed: flatVector(3), finalUnused: flatVector(7),
    stateVersionBefore: 4, stateVersionAfter: 5,
  }),
];

const withoutKeys = (value, keys) => {
  const copy = structuredClone(value);
  for (const key of keys) {
    const path = key.split('.');
    const leaf = path.pop();
    const owner = path.reduce((node, step) => node?.[step], copy);
    if (owner) delete owner[leaf];
  }
  return copy;
};

test('C1: closure settlement is derived from the ledger — consumed from validated releases, unused from the root plus every still-open reservation', () => {
  const result = replayResourceCase(
    inlineCase('inline.c1.settlement', buildSettledLedgerEvents()),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.finalRootRemaining, zeroVector());

  // Neither term is vacuous: the consumed 4 is one validated release, and the
  // unused 6 is the root's own 3 plus the 3 a still-open reservation never
  // spent. This is declared contract credit, not a measurement of a running
  // system, and the still-open child's share is extinguished at closure.
  const closure = result.trace.at(-1);
  assert.equal(closure.kind, 'root-closure');
  assert.deepEqual(closure.finalConsumed, flatVector(4));
  assert.deepEqual(closure.finalUnused, flatVector(6));
  assert.deepEqual(closure.closedDescendants, [
    { reservationId: SETTLED_OPEN_CHILD_ID, remainingAfter: zeroVector() },
  ]);

  // Sum-correct but split-wrong. Each declares final_consumed + final_unused
  // equal to the grant's bounds — the whole of the R2 rule — and still
  // contradicts the ledger, so a passing sum can no longer carry the case.
  const SPLIT_MISMATCHES = [
    ['consumed overstated by credit no release consumed', flatVector(5), flatVector(5)],
    ['consumed understated', flatVector(3), flatVector(7)],
    ['the open reservation\'s credit booked as consumed', flatVector(7), flatVector(3)],
    ['a settlement that settles nothing', zeroVector(), flatVector(10)],
  ];
  for (const [label, finalConsumed, finalUnused] of SPLIT_MISMATCHES) {
    assert.deepEqual(vectorAdd(finalConsumed, finalUnused), flatVector(10), label);
    const failed = replayResourceCase(inlineCase(
      `inline.c1.${label}`,
      buildSettledLedgerEvents(finalConsumed, finalUnused),
    ));
    assert.equal(failed.accepted, false, label);
    assert.deepEqual(failed.errors, ['RES_RELEASE_ACCOUNTING_MISMATCH'], label);
  }
});

test('C1: the standalone root-closure fixture is byte-identical to the settlement the new positive replay produces', () => {
  const standalone = readJson(
    'contracts/examples/resource-bounds/positive/root-closure.completed.json',
  );
  const ledger = readJson(
    'contracts/examples/resource-bounds/positive/replay.denied-then-admitted.json',
  );
  const terminal = ledger.events.at(-1);
  assert.equal(terminal.kind, 'root-closure');

  // Same value and same key order: the packet holds one settlement, not two
  // that agree on their vectors and disagree on anything else.
  assert.equal(JSON.stringify(standalone), JSON.stringify(terminal.payload));
  assert.equal(standalone.reason, 'completed');

  // And that settlement must be one replay actually produces, or the byte
  // identity would only pin two copies of the same free split.
  const result = replayResourceCase(ledger);
  assert.deepEqual(result.errors, []);
  assert.equal(result.accepted, true);
  assert.equal(result.trace.at(-1).kind, 'root-closure');
  assert.deepEqual(result.trace.at(-1).finalConsumed, standalone.final_consumed);
  assert.deepEqual(result.trace.at(-1).finalUnused, standalone.final_unused);
});

test('C2: every nested public record carries exactly its envelope sequence and virtual time', () => {
  assert.deepEqual(
    replayResourceCase(inlineCase('inline.c2.settled', buildSettledLedgerEvents())).errors,
    [],
  );

  const NESTED_RECORDS = [
    ['grant payload', (events) => events[0].payload],
    ['reservation request', (events) => events[1].payload.request],
    // A reserve event is one atomic admission result group, so a result that
    // disagrees with its own request is a violation exactly as much as one that
    // disagrees with the envelope.
    ['reservation result', (events) => events[1].payload.result],
    ['release payload', (events) => events[2].payload],
    ['root-closure payload', (events) => events[4].payload],
  ];
  // Sequence is a pure ordering field, so both directions are ordering
  // failures. Virtual time splits: earlier than its envelope is time running
  // backwards inside one ledger position; later is a record field failing to
  // equal the replayed state that admitted it.
  const NESTED_DRIFTS = [
    ['sequence', -1, 'RES_SEQUENCE_VIOLATION'],
    ['sequence', 1, 'RES_SEQUENCE_VIOLATION'],
    ['virtual_time_ms', -1, 'RES_VIRTUAL_TIME_ROLLBACK'],
    ['virtual_time_ms', 1, 'RES_RESULT_MISMATCH'],
  ];

  for (const [recordLabel, select] of NESTED_RECORDS) {
    for (const [field, delta, expectedCode] of NESTED_DRIFTS) {
      const label = `${recordLabel} ${field} ${delta > 0 ? 'later' : 'earlier'}`;
      const events = buildSettledLedgerEvents();
      select(events)[field] += delta;
      // The dense envelope order stays intact, so nothing but the nested rule
      // can produce the failure.
      assert.deepEqual(events.map((event) => event.sequence), [1, 2, 3, 4, 5], label);
      const result = replayResourceCase(inlineCase(`inline.c2.${label}`, events));
      assert.equal(result.accepted, false, label);
      assert.deepEqual(result.errors, [expectedCode], label);
    }
  }
});

test('C3: a denial is accepted only when the replayed state makes it inadmissible and its code is the one that state implies', () => {
  const grantId = 'rbg_denialtruth00001';
  const bounds = flatVector(10);
  const caseFor = ({ requested, code }) => {
    const denial = buildDeniedReserveEvent({
      sequence: 2, virtualTimeMs: 1010, grantId,
      requestId: 'rsq_denialtruth00001', idempotencyKey: 'idem.aaaaaaaaaaaaaaaa',
      requested, parentVersion: 1, parentRemaining: bounds,
    });
    if (code) denial.payload.result.error.code = code;
    return inlineCase('inline.c3.denial', [
      buildGrantEvent({ sequence: 1, virtualTimeMs: 1000, grantId, bounds }),
      denial,
    ]);
  };

  // Inadmissible in every dimension, and inadmissible in exactly one: both are
  // denials the state derives, and RES_INSUFFICIENT_REMAINDER is the only code
  // derivable at this point by construction.
  for (const requested of [flatVector(11), { ...flatVector(9), tool_calls: 11 }]) {
    assert.deepEqual(replayResourceCase(caseFor({ requested })).errors, []);
  }

  // A refusal the state does not justify: every dimension fits.
  for (const requested of [flatVector(9), flatVector(10), zeroVector()]) {
    const result = replayResourceCase(caseFor({ requested }));
    assert.equal(result.accepted, false, JSON.stringify(requested));
    assert.deepEqual(result.errors, ['RES_RESULT_MISMATCH'], JSON.stringify(requested));
  }

  // Exhaustive over the fifteen: an inadmissible request denied under any other
  // code is a denial the state does not imply. R3 mints no code and makes none
  // of the fourteen newly derivable here.
  for (const code of REPLAY_ERROR_CODES) {
    if (code === 'RES_INSUFFICIENT_REMAINDER') continue;
    const result = replayResourceCase(caseFor({ requested: flatVector(11), code }));
    assert.equal(result.accepted, false, code);
    assert.deepEqual(result.errors, ['RES_RESULT_MISMATCH'], code);
  }
});

test('C4: the canonical idempotent request identity excludes exactly sequence, virtual_time_ms, and parent.expected_version', () => {
  const events = buildDeniedThenAdmittedEvents();
  const denied = events[2].payload.request;
  const reissued = events[4].payload.request;
  const EXCLUDED = ['sequence', 'virtual_time_ms', 'parent.expected_version'];

  // The re-issue differs from the denied request in exactly those three fields,
  // and each of the three really does differ — otherwise the identity below
  // would be proved by a request that never moved.
  assert.deepEqual(withoutKeys(reissued, EXCLUDED), withoutKeys(denied, EXCLUDED));
  assert.notEqual(reissued.sequence, denied.sequence);
  assert.notEqual(reissued.virtual_time_ms, denied.virtual_time_ms);
  assert.notEqual(reissued.parent.expected_version, denied.parent.expected_version);
  assert.deepEqual(
    replayResourceCase(inlineCase('inline.c4.identity', events)).errors,
    [],
  );

  // Every other field is bound. Mutating one either conflicts on the bound key
  // or is refused earlier by a check that runs before the idempotency lookup —
  // exclusion from the identity is not exemption from validation, and neither
  // is inclusion in it a reordering of the existing guards.
  const CONFLICT = 'RES_IDEMPOTENCY_CONFLICT';
  const IDENTITY_MUTATIONS = [
    ['request_id', (q) => { q.request_id = 'rsq_deniedadmit00009'; }, CONFLICT],
    ['requested', (q) => { q.requested = flatVector(4); }, CONFLICT],
    ['parent.kind and parent.id', (q) => {
      q.parent = { ...q.parent, kind: 'reservation', id: DTA_SIBLING_ID };
    }, CONFLICT],
    ['confers_authority', (q) => { q.confers_authority = true; }, CONFLICT],
    ['tenant_id', (q) => { q.tenant_id = 'tenant-red'; }, 'RES_TENANT_MISMATCH'],
    ['org_scope_ref', (q) => { q.org_scope_ref = { org_id: 'org-red' }; },
      'RES_ORG_SCOPE_MISMATCH'],
    ['root', (q) => { q.root = rootRef('rbg_foreignroot00001'); },
      'RES_PARENT_NOT_FOUND'],
  ];
  for (const [label, mutate, expectedCode] of IDENTITY_MUTATIONS) {
    const mutated = buildDeniedThenAdmittedEvents();
    mutate(mutated[4].payload.request);
    const result = replayResourceCase(inlineCase(`inline.c4.${label}`, mutated));
    assert.equal(result.accepted, false, label);
    assert.deepEqual(result.errors, [expectedCode], label);
    // Refused at its own ledger position: the first four events are traced and
    // the re-issue is not. A failure surfacing later would mean the mutated
    // event was admitted and something downstream caught it instead.
    assert.equal(result.trace.length, 4, label);
  }
});

test('C4: a denied key is bound, clears into an admission when peer state returns credit, and still refuses a stale version', () => {
  const accepted = replayResourceCase(
    inlineCase('inline.c4.transition', buildDeniedThenAdmittedEvents()),
  );
  assert.deepEqual(accepted.errors, []);

  const denialEntry = accepted.trace.find((entry) => entry.sequence === 3);
  assert.equal(denialEntry.admitted, false);
  assert.equal(denialEntry.deniedCode, 'RES_INSUFFICIENT_REMAINDER');
  // The cleared denial draws the parent down exactly as a first admission
  // would; the denial itself granted nothing at the moment it was recorded.
  const admissionEntry = accepted.trace.find((entry) => entry.sequence === 5);
  assert.equal(admissionEntry.admitted, true);
  assert.equal(admissionEntry.idempotentReplay, undefined);
  assert.deepEqual(admissionEntry.parentRemainingBefore, flatVector(7));
  assert.deepEqual(admissionEntry.parentRemainingAfter, flatVector(2));

  // Excluding parent.expected_version recognizes the same request across a
  // version change; it is not permission to re-present a stale assertion. Under
  // R2 the bound key short-circuited and this event never reached the check.
  const stale = buildDeniedThenAdmittedEvents();
  stale[4].payload.request.parent.expected_version = 2;
  const staleResult = replayResourceCase(inlineCase('inline.c4.stale', stale));
  assert.equal(staleResult.accepted, false);
  assert.deepEqual(staleResult.errors, ['RES_VERSION_CONFLICT']);

  // A repeat denial must still be true: the sibling release cleared it, so
  // re-presenting the refusal contradicts the current state.
  const repeated = buildDeniedThenAdmittedEvents();
  repeated[4] = buildDeniedReserveEvent({
    sequence: 5, virtualTimeMs: 1040, grantId: DTA_GRANT_ID,
    requestId: DTA_REQUEST_ID, idempotencyKey: DTA_IDEMPOTENCY_KEY,
    requested: DTA_REQUESTED, parentVersion: 3, parentRemaining: flatVector(7),
  });
  const repeatedResult = replayResourceCase(inlineCase('inline.c4.repeat', repeated));
  assert.equal(repeatedResult.accepted, false);
  assert.deepEqual(repeatedResult.errors, ['RES_RESULT_MISMATCH']);
});

test('C4: once admitted, the result projection excluding only sequence and virtual_time_ms is final', () => {
  const events = buildDeniedThenAdmittedEvents();
  const original = events[4].payload.result;
  const replayed = events[5].payload.result;
  const POSITION_FIELDS = ['sequence', 'virtual_time_ms'];

  // The re-issue occupies a different ledger position, so the two position
  // fields cannot be compared against the recorded original — C2 binds each to
  // its own envelope instead, and nothing else is excused.
  assert.deepEqual(
    withoutKeys(replayed, POSITION_FIELDS),
    withoutKeys(original, POSITION_FIELDS),
  );
  for (const field of POSITION_FIELDS) {
    assert.notEqual(replayed[field], original[field], field);
  }

  const accepted = replayResourceCase(inlineCase('inline.c4.projection', events));
  assert.deepEqual(accepted.errors, []);
  const replayEntry = accepted.trace.find((entry) => entry.sequence === 6);
  assert.equal(replayEntry.idempotentReplay, true);
  // The replay re-draws nothing: the closure still settles against one draw.
  assert.deepEqual(accepted.trace.at(-1).finalUnused, flatVector(7));

  const denialError = () => ({
    code: 'RES_INSUFFICIENT_REMAINDER', message: 'insufficient remainder',
    retriable: true, fail_closed: true,
  });
  const PROJECTION_DRIFTS = [
    ['request_id', (r) => { r.request_id = 'rsq_deniedadmit00009'; }],
    ['status regressing to denied', (r) => {
      r.status = 'denied';
      delete r.reservation;
      r.error = denialError();
    }],
    ['reservation.reservation_id', (r) => {
      r.reservation.reservation_id = 'rsr_deniedadmit00009';
    }],
    ['reservation.reserved', (r) => { r.reservation.reserved = flatVector(4); }],
    ['reservation.remaining', (r) => { r.reservation.remaining = flatVector(4); }],
    ['reservation.state_version', (r) => { r.reservation.state_version += 1; }],
    ['reservation.status', (r) => { r.reservation.status = 'closed'; }],
    ['parent_version_before', (r) => { r.parent_version_before += 1; }],
    ['parent_version_after', (r) => { r.parent_version_after += 1; }],
    ['parent_remaining_after', (r) => { r.parent_remaining_after = flatVector(3); }],
    ['confers_authority', (r) => { r.confers_authority = true; }],
    ['an error on an admitted result', (r) => { r.error = denialError(); }],
  ];
  for (const [label, mutate] of PROJECTION_DRIFTS) {
    const drifted = buildDeniedThenAdmittedEvents();
    mutate(drifted[5].payload.result);
    const result = replayResourceCase(inlineCase(`inline.c4.drift.${label}`, drifted));
    assert.equal(result.accepted, false, label);
    assert.deepEqual(result.errors, ['RES_RESULT_MISMATCH'], label);
  }
});

test('C1-C4: the packet registers exactly the five authorized R3 fixtures and totals 45 members', () => {
  assert.equal(R3_FIXTURE_REGISTRATIONS.length, 5);
  assert.equal(expectedPacketPaths.length, 45);

  const manifest = readJson(
    'contracts/examples/resource-bounds/examples-manifest.json',
  );
  const byFile = new Map(manifest.fixtures.map((entry) => [entry.file, entry]));
  for (const expected of R3_FIXTURE_REGISTRATIONS) {
    const entry = byFile.get(expected.file);
    assert.ok(entry, `${expected.file} must be registered`);
    assert.equal(entry.kind, expected.kind, expected.file);
    // A replay ledger binds no single schema; the validator walks its events.
    assert.equal(entry.schema, undefined, expected.file);
    assert.equal(entry.expected_error, expected.expected_error, expected.file);
    assert.match(entry.sha256 ?? '', /^[0-9a-f]{64}$/, expected.file);
    const member = `contracts/examples/resource-bounds/${expected.file}`;
    assert.ok(expectedPacketPaths.includes(member), `${member} must be a member`);
  }

  // One positive ledger carrying all four findings, and one negative per
  // finding, each failing a distinct invariant under an existing code.
  const kinds = R3_FIXTURE_REGISTRATIONS.map((entry) => entry.kind);
  assert.equal(kinds.filter((kind) => kind === 'positive').length, 1);
  assert.equal(kinds.filter((kind) => kind === 'negative-semantic').length, 4);
  const codes = R3_FIXTURE_REGISTRATIONS.map((e) => e.expected_error).filter(Boolean);
  assert.equal(new Set(codes).size, 4);
  for (const code of codes) assert.ok(REPLAY_ERROR_CODES.includes(code), code);
});

test('C1-C4: the compatibility manifest states the settlement, ordering, and canonical-identity rules the packet enforces', () => {
  const manifest = readJson(COMPATIBILITY_MANIFEST);

  // The three authorized wording sites. Each keeps every R2 statement it
  // already makes and gains exactly the rule C1, C2, or C4 now enforces —
  // underclaiming by silence is the failure §7.2 exists to prevent.
  const WORDING_SITES = [
    ['resource_model.closure', manifest.resource_model.closure, [
      // C1: the sum equality survives as a corollary; both halves become
      // ledger-derived, with the measurement disclaimer.
      /final_consumed plus final_unused equals the closing grant's original bounds/,
      /accumulated consumed of every release the replay has already validated/i,
      /closing root's remainder plus the remainder of every still-open reservation/i,
      /immediately before closure/i,
      /contract-credit accounting/i,
      /not physical runtime measurement/i,
      /every still-open descendant is closed with zero remaining/,
      /extinguished, returned to nobody/,
      /never reopens/,
      /re-mint/,
    ]],
    ['resource_model.sequence', manifest.resource_model.sequence, [
      // C2: the dense rule stays and the envelope/nested agreement joins it,
      // including the intra-position reading of RES_VIRTUAL_TIME_ROLLBACK.
      /no gap, no repeat, and no reordering/,
      /exactly one serialization point per root tree/,
      /deliberate v0.1 contract limit/,
      /no throughput, scaling, or runtime-concurrency claim/,
      /every nested public record carries exactly its envelope's sequence and virtual_time_ms/i,
      /RES_VIRTUAL_TIME_ROLLBACK/,
      /inside one ledger position/i,
    ]],
    ['authority_model.error_retriability', manifest.authority_model.error_retriability, [
      // C4: the third canonical-intent site. The mapping does not move; only
      // what re-issuing "the same request" means.
      /true only for RES_INSUFFICIENT_REMAINDER and RES_ACTIVE_CHILDREN/,
      /canonical/i,
      /sequence/,
      /virtual_time_ms/,
      /parent\.expected_version/,
      /grants no capacity, admission, queue position, priority, or authority/,
      /fail_closed stays true for every code/,
    ]],
  ];
  for (const [site, text, patterns] of WORDING_SITES) {
    for (const pattern of patterns) assert.match(text, pattern, `${site}: ${pattern}`);
  }
  assert.doesNotMatch(
    manifest.authority_model.error_retriability,
    /byte-identical re-issue/i,
  );

  // The one deliberately retained occurrence: it is about RES_VERSION_CONFLICT,
  // where a literal-byte re-issue genuinely can never succeed. Reconciling it
  // would be an unauthorized fixture edit.
  const retained = readJson(RES_BOUNDS_ERROR_RETRIABLE_MISMATCH);
  assert.match(
    retained.message,
    /A byte-identical re-issue asserts the same stale version and can never succeed\./,
  );
  assert.equal(retained.code, 'RES_VERSION_CONFLICT');
});
