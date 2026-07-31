// Gate W2-H resource-bounds proposal tests.
//
// Green proves only deterministic Suite-side static conformance for a
// PROPOSED packet. It accepts no ADR, implements no runtime, satisfies no
// T10/T11 measurement, and grants no release or production authority.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
const NEGATIVE_REPLAY_PATHS = [
  'contracts/examples/resource-bounds/negative-semantic/replay.parent-overdraw.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.no-mint-spawn.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.tenant-mismatch.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.org-scope-mismatch.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.idempotency-conflict.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.double-release.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.over-return.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.parent-closed.json',
  'contracts/examples/resource-bounds/negative-semantic/replay.root-cancel-remint.json',
];

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
  assert.equal(report.counts.schemasCompiled, 6);
  assert.equal(report.counts.positiveFixtures, 6);
  assert.equal(report.counts.negativeSchemaFixtures, 7);
  assert.equal(report.counts.negativeSemanticFixtures, 9);
  assert.equal(report.counts.negativeSemanticRejectedExactly, 9);
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
  // Deterministic xorshift32: no wall clock and no platform RNG.
  let state = 0x43594252;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };

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

test('root cancellation closes the subtree and closed capacity is never re-minted', () => {
  const fixture = readJson(
    'contracts/examples/resource-bounds/negative-semantic/replay.root-cancel-remint.json',
  );
  const result = replayResourceCase(fixture);

  assert.deepEqual(result.errors, ['RES_ROOT_CLOSED']);
  assert.equal(result.accepted, false);
  assert.equal(result.trace.at(-1).kind, 'cancel-root');
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
  assert.match(orchestrator, /These 21 validators/);
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
