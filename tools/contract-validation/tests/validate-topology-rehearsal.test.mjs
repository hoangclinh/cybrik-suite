import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import {
  formatTopologyRehearsalReport,
  validateTopologyRehearsals,
} from '../validate-topology-rehearsal.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const SCHEMA_PATH = 'docs/uat/topology-rehearsal.schema.json';
const POLICY_PATH = 'docs/uat/topology-rehearsal-policy.json';
const TOPOLOGY_ROOT = 'docs/uat/topology-rehearsals';
const RECORD_ID = 'postgres-loopback-internal-v1-r1';
const SERIES_ID = 'postgres-loopback-internal-v1';
const RECORD_DIR = `${TOPOLOGY_ROOT}/${RECORD_ID}`;
const RECORD_PATH = `${RECORD_DIR}/topology-rehearsal.json`;
const NC_SHA = '427423db6d5d5e9f720c5e110a2c9b3cba39ea089dafed4ab936d04dd218bdac';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stableWriteJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const createRoot = () => {
  const root = mkdtempSync(join(os.tmpdir(), 'cybrik-topology-rehearsal-'));
  for (const path of [SCHEMA_PATH, POLICY_PATH]) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    cpSync(resolve(ROOT, path), resolve(root, path));
  }
  mkdirSync(resolve(root, TOPOLOGY_ROOT), { recursive: true });
  return root;
};

const artifact = (root, directory, kind, content = `${kind}\n`) => {
  const path = `${directory}/${kind}.txt`;
  mkdirSync(resolve(root, directory), { recursive: true });
  writeFileSync(resolve(root, path), content, 'utf8');
  return { kind, path, sha256: sha256(content) };
};

const buildRecord = (root, {
  recordId = RECORD_ID,
  seriesId = SERIES_ID,
  phase = 'proposed',
  executionAuthorized = false,
  attemptConsumed = false,
  outcome = 'not_run',
  teardownVerified = null,
  residualResources = null,
  externalManifestLocallyVerified = null,
} = {}) => {
  const directory = `${TOPOLOGY_ROOT}/${recordId}`;
  const artifacts = [
    artifact(root, directory, 'diagnosis'),
    artifact(root, directory, 'independent_review'),
  ];
  if (phase === 'authorized') artifacts.push(artifact(root, directory, 'grant'));
  if (phase === 'closed') {
    artifacts.push(artifact(root, directory, 'grant'));
    artifacts.push(artifact(root, directory, 'result'));
    artifacts.push(artifact(root, directory, 'evidence_manifest'));
    artifacts.push(artifact(root, directory, 'result_review'));
  }
  return {
    schema_version: '1.0.0',
    record_id: recordId,
    recorded_at: '2026-08-04T12:00:00Z',
    identity: {
      capability_id: 'cybrik.suite.runtime-topology',
      objective_id: 'postgres-loopback-internal-v1',
    },
    attempt: {
      series_id: seriesId,
      attempt_ordinal: 1,
      max_attempts: 1,
      phase,
      execution_authorized: executionAuthorized,
      attempt_consumed: attemptConsumed,
      outcome,
    },
    topology: {
      host_ip: '127.0.0.1',
      host_port: 15433,
      container_port: 5432,
      internal_network: true,
      runtime_limit_seconds: 180,
      extension_cycles: 0,
      probe: {
        executable_path: '/usr/bin/nc',
        executable_sha256: NC_SHA,
        argv: ['-z', '-w', '5', '127.0.0.1', '15433'],
      },
    },
    production_exclusion: {
      no_production_credentials: true,
      no_production_configuration: true,
      no_production_data: true,
      no_production_traffic: true,
    },
    evidence: {
      directory,
      external_bytes_ci_verified: false,
      artifacts,
      result_controls: phase === 'closed'
        ? {
            teardown_verified: teardownVerified,
            residual_resources: residualResources,
            external_manifest_locally_verified: externalManifestLocallyVerified,
          }
        : null,
    },
    disposition: {
      profile: 'HOLD',
      rationale: 'Topology-only preflight; no UAT, demo, release or production authority.',
    },
  };
};

const writeRecord = (root, record) => {
  const path = `${TOPOLOGY_ROOT}/${record.record_id}/topology-rehearsal.json`;
  stableWriteJson(resolve(root, path), record);
  return path;
};

const withRoot = async (fn) => {
  const root = createRoot();
  try {
    await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('committed topology policy permits zero prepared records and grants no authority', () => {
  const report = validateTopologyRehearsals({ root: ROOT });
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.records, 0);
  assert.equal(report.counts.execution_authorized, 0);
  const rendered = formatTopologyRehearsalReport(report);
  assert.equal(rendered.exitCode, 0);
  assert.match(rendered.stdout, /static control only/i);
  assert.match(rendered.stdout, /no runtime, UAT, demo, release or production authority/i);
});

test('one exact proposed singleton record validates while remaining HOLD', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root));
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.records, 1);
    assert.equal(report.counts.execution_authorized, 0);
    assert.equal(report.counts.closed, 0);
  });
});

test('the only authorized shape is one unconsumed not-run record with a grant', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
    });
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.execution_authorized, 1);

    record.attempt.attempt_consumed = true;
    writeRecord(root, record);
    const invalid = validateTopologyRehearsals({ root });
    assert.ok(invalid.errors.some((error) =>
      error.includes('authorized topology record must be not_run and unconsumed')));
  });
});

test('every terminal outcome has exact consumption and teardown semantics', async () => {
  const cases = [
    ['PRECHECK_ABORT', false],
    ['TOPOLOGY_PASS', true],
    ['FAIL_PUBLICATION', true],
    ['FAIL_INTERNAL_INGRESS', true],
    ['STOP_CONTROL', true],
  ];
  for (const [outcome, consumed] of cases) {
    await withRoot((root) => {
      const record = buildRecord(root, {
        phase: 'closed',
        outcome,
        attemptConsumed: consumed,
        teardownVerified: true,
        residualResources: 0,
        externalManifestLocallyVerified: true,
      });
      writeRecord(root, record);
      const report = validateTopologyRehearsals({ root });
      assert.deepEqual(report.errors, [], outcome);
      assert.equal(report.counts.closed, 1);
      assert.equal(report.counts.execution_authorized, 0);
    });
  }
});

test('closed records fail on wrong consumption, residual resources, or missing local manifest review', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'closed',
      outcome: 'TOPOLOGY_PASS',
      attemptConsumed: false,
      teardownVerified: false,
      residualResources: 1,
      externalManifestLocallyVerified: false,
    });
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('consumed outcome must consume')));
    assert.ok(report.errors.some((error) => error.includes('closed topology record requires verified teardown')));
    assert.ok(report.errors.some((error) => error.includes('closed topology record requires zero residual resources')));
    assert.ok(report.errors.some((error) => error.includes('external evidence manifest requires independent local verification')));
  });
});

test('a second record, alias, ordinal, or policy drift fails closed', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root));
    writeRecord(root, buildRecord(root, {
      recordId: 'postgres-loopback-internal-v1-r2',
      seriesId: 'postgres-loopback-internal-v1-alias',
    }));
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('topology policy permits only the exact singleton record')));

    const policy = JSON.parse(readFileSync(resolve(root, POLICY_PATH), 'utf8'));
    policy.allowed_records.push({ ...policy.allowed_records[0], record_id: 'evil-r2' });
    stableWriteJson(resolve(root, POLICY_PATH), policy);
    const drifted = validateTopologyRehearsals({ root });
    assert.ok(drifted.errors.some((error) => error.includes('policy must exactly match the validator-pinned singleton')));
  });
});

test('mislocated and symlinked machine records are rejected', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    const nested = `${RECORD_DIR}/nested/topology-rehearsal.json`;
    stableWriteJson(resolve(root, nested), record);
    let report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('mislocated topology-rehearsal.json')));

    rmSync(resolve(root, RECORD_DIR), { recursive: true, force: true });
    mkdirSync(resolve(root, RECORD_DIR), { recursive: true });
    const outside = resolve(root, 'outside-topology-rehearsal.json');
    stableWriteJson(outside, record);
    symlinkSync(outside, resolve(root, RECORD_PATH));
    report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('must be a contained regular file')));
  });
});

test('artifact containment, digest integrity, and external-evidence honesty fail closed', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.evidence.external_bytes_ci_verified = true;
    record.evidence.artifacts[0].sha256 = '0'.repeat(64);
    record.evidence.artifacts[1].path = '../outside-review.txt';
    writeFileSync(resolve(root, 'docs/uat/outside-review.txt'), 'outside\n', 'utf8');
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('external bytes cannot be claimed as CI verified')));
    assert.ok(report.errors.some((error) => error.includes('artifact sha256 must match')));
    assert.ok(report.errors.some((error) => error.includes('artifacts must stay inside the record directory')));
  });
});

test('fixed loopback, internal network, bounded cycle, and exact probe argv are immutable', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.topology.host_ip = '0.0.0.0';
    record.topology.host_port = 55433;
    record.topology.internal_network = false;
    record.topology.runtime_limit_seconds = 600;
    record.topology.extension_cycles = 1;
    record.topology.probe.argv = ['127.0.0.1', '15433'];
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    for (const expected of [
      'host_ip must be exact loopback',
      'host_port must be the reviewed fixed port',
      'network must remain internal',
      'runtime limit must remain one 180-second cycle',
      'extension cycles must remain zero',
      'probe argv must exactly match the reviewed bounded TCP probe',
    ]) assert.ok(report.errors.some((error) => error.includes(expected)), expected);
  });
});

test('unknown authority and production fields are rejected by the schema', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.production_authorized = true;
    record.disposition.profile = 'DEMO_READY_LOCAL';
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('schema / must NOT have additional properties')));
    assert.ok(report.errors.some((error) => error.includes('schema /disposition/profile must be equal to constant')));
  });
});
