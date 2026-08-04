import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
  isMainModule,
  validateTopologyRehearsals,
} from '../validate-topology-rehearsal.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const SCHEMA_PATH = 'docs/uat/topology-rehearsal.schema.json';
const POLICY_PATH = 'docs/uat/topology-rehearsal-policy.json';
const TRUST_PATH = 'docs/uat/topology-rehearsal-authorization-trust.json';
const ALLOWED_SIGNERS_PATH = 'docs/uat/topology-rehearsal-allowed-signers';
const MASTER_TRUST_PATH =
  'integration/compose/soc-ai-fabric-alert-context-mtls/authorization-trust.json';
const AUTHORIZATION_NAMESPACE = 'cybrik-uat-topology-rehearsal-v1';
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
  for (const path of [
    SCHEMA_PATH,
    POLICY_PATH,
    TRUST_PATH,
    ALLOWED_SIGNERS_PATH,
    MASTER_TRUST_PATH,
  ]) {
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

const installSignedAuthorization = (root, directory, artifacts) => {
  const keyRoot = mkdtempSync(join(root, '.topology-authorization-key-'));
  const keyPath = join(keyRoot, 'key');
  execFileSync('/usr/bin/ssh-keygen', [
    '-q', '-t', 'ed25519', '-N', '', '-f', keyPath,
  ]);
  const [keyType, encodedKey] = readFileSync(`${keyPath}.pub`, 'utf8')
    .trim()
    .split(/\s+/u);
  const allowedSigners =
    `FOUNDER namespaces="${AUTHORIZATION_NAMESPACE}" ${keyType} ${encodedKey}\n`;
  const allowedSignersSha256 = sha256(allowedSigners);
  const keyFingerprint = `SHA256:${createHash('sha256')
    .update(Buffer.from(encodedKey, 'base64'))
    .digest('base64')
    .replace(/=+$/u, '')}`;
  writeFileSync(resolve(root, ALLOWED_SIGNERS_PATH), allowedSigners, 'utf8');
  stableWriteJson(resolve(root, TRUST_PATH), {
    schema: 'CYBRIK-UAT-TOPOLOGY-AUTHORIZATION-TRUST/v1',
    signer: 'FOUNDER',
    namespace: AUTHORIZATION_NAMESPACE,
    key_type: keyType,
    key_fingerprint: keyFingerprint,
    allowed_signers_path: ALLOWED_SIGNERS_PATH,
    allowed_signers_sha256: allowedSignersSha256,
  });
  stableWriteJson(resolve(root, MASTER_TRUST_PATH), {
    allowed_signers_sha256: '0'.repeat(64),
    key_fingerprint: keyFingerprint,
    key_type: keyType,
    namespace: 'cybrik-uat-soc-ai-fabric-v1',
    python_sha256: '0'.repeat(64),
    schema: 'CYBRIK-UAT-SSH-AUTHORIZATION-TRUST/v1',
    signer: 'FOUNDER',
  });

  const grant = artifacts.find((entry) => entry.kind === 'grant');
  const grantAbsolute = resolve(root, grant.path);
  execFileSync('/usr/bin/ssh-keygen', [
    '-Y', 'sign', '-f', keyPath, '-n', AUTHORIZATION_NAMESPACE, grantAbsolute,
  ], { stdio: 'ignore' });
  const signaturePath = `${grant.path}.sig`;
  const signatureBytes = readFileSync(resolve(root, signaturePath));
  const signature = {
    kind: 'authorization_signature',
    path: signaturePath,
    sha256: sha256(signatureBytes),
  };
  artifacts.push(signature);
  return {
    signer: 'FOUNDER',
    namespace: AUTHORIZATION_NAMESPACE,
    grant_path: grant.path,
    grant_sha256: grant.sha256,
    signature_path: signature.path,
    signature_sha256: signature.sha256,
    allowed_signers_path: ALLOWED_SIGNERS_PATH,
    allowed_signers_sha256: allowedSignersSha256,
    trust_path: TRUST_PATH,
  };
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
  const record = {
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
    authorization: null,
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
  if (phase !== 'proposed') {
    record.authorization = installSignedAuthorization(root, directory, artifacts);
  }
  return record;
};

const stateHistoryFor = (record) => {
  if (!record.attempt) return [];
  const proposed = {
    phase: 'proposed',
    attempt_consumed: false,
    outcome: 'not_run',
    record_sha256: sha256(`${record.record_id}:proposed\n`),
  };
  if (record.attempt.phase === 'proposed') return [];
  if (record.attempt.phase === 'authorized' || record.attempt.outcome === 'PRECHECK_ABORT') {
    return [proposed];
  }
  return [
    proposed,
    {
      phase: 'authorized',
      attempt_consumed: false,
      outcome: 'not_run',
      record_sha256: sha256(`${record.record_id}:authorized\n`),
    },
  ];
};

const writeRecord = (root, record) => {
  const path = `${TOPOLOGY_ROOT}/${record.record_id}/topology-rehearsal.json`;
  stableWriteJson(resolve(root, path), record);
  const policy = JSON.parse(readFileSync(resolve(root, POLICY_PATH), 'utf8'));
  if (Object.hasOwn(policy, 'current_state')) {
    policy.current_state = {
      record_id: record.record_id,
      record_sha256: sha256(readFileSync(resolve(root, path))),
      phase: record.attempt?.phase,
      attempt_consumed: record.attempt?.attempt_consumed,
      outcome: record.attempt?.outcome,
      grant_sha256: record.authorization?.grant_sha256 ?? null,
    };
    policy.state_history = stateHistoryFor(record);
    stableWriteJson(resolve(root, POLICY_PATH), policy);
  }
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
    assert.ok(report.errors.some((error) => error.includes('symlink entries are forbidden')));
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

test('schema-invalid records return fail-closed findings instead of crashing', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    delete record.attempt;
    delete record.evidence;
    writeRecord(root, record);
    let report;
    assert.doesNotThrow(() => {
      report = validateTopologyRehearsals({ root });
    });
    assert.ok(report.errors.some((error) => error.includes("schema / must have required property 'attempt'")));
    assert.ok(report.errors.some((error) => error.includes("schema / must have required property 'evidence'")));
  });
});

test('proposed and authorized phase contradictions fail closed', async () => {
  await withRoot((root) => {
    const proposed = buildRecord(root);
    proposed.attempt.execution_authorized = true;
    proposed.evidence.result_controls = {
      teardown_verified: true,
      residual_resources: 0,
      external_manifest_locally_verified: true,
    };
    proposed.evidence.artifacts.push(artifact(root, RECORD_DIR, 'grant'));
    writeRecord(root, proposed);
    let report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('proposed topology record must be not_run and unauthorized')));
    assert.ok(report.errors.some((error) => error.includes('proposed topology record cannot carry result controls')));
    assert.ok(report.errors.some((error) => error.includes('proposed topology record cannot carry grant or result artifacts')));

    const authorized = buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
    });
    authorized.evidence.artifacts = authorized.evidence.artifacts.filter(
      (entry) => entry.kind !== 'grant',
    );
    authorized.evidence.artifacts.push(artifact(root, RECORD_DIR, 'result'));
    authorized.evidence.result_controls = {
      teardown_verified: true,
      residual_resources: 0,
      external_manifest_locally_verified: true,
    };
    writeRecord(root, authorized);
    report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('authorized topology record cannot carry result controls')));
    assert.ok(report.errors.some((error) => error.includes('required grant artifact is missing')));
    assert.ok(report.errors.some((error) => error.includes('authorized topology record cannot carry result artifacts')));
  });
});

test('artifact inventory and remaining fixed controls reject drift', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.evidence.artifacts.pop();
    record.evidence.artifacts.push({ ...record.evidence.artifacts[0] });
    record.evidence.artifacts.push({
      kind: 'independent_review',
      path: `${RECORD_DIR}/missing-review.txt`,
      sha256: '0'.repeat(64),
    });
    record.topology.container_port = 15432;
    record.topology.probe.executable_path = '/tmp/nc';
    record.production_exclusion.no_production_traffic = false;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('artifact kind values must be unique')));
    assert.ok(report.errors.some((error) => error.includes('artifact path must be a contained regular file')));
    assert.ok(report.errors.some((error) => error.includes('container_port must remain PostgreSQL 5432')));
    assert.ok(report.errors.some((error) => error.includes('probe executable must remain /usr/bin/nc')));
    assert.ok(report.errors.some((error) => error.includes('every production exclusion must remain true')));
  });
});

test('invalid policy and schema render deterministic failures and main-module checks fail closed', async () => {
  await withRoot((root) => {
    writeFileSync(resolve(root, POLICY_PATH), '{', 'utf8');
    stableWriteJson(resolve(root, SCHEMA_PATH), { type: 'not-a-json-schema-type' });
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('cannot read valid contained JSON')));
    assert.ok(report.errors.some((error) => error.includes('schema compile failed')));
    const rendered = formatTopologyRehearsalReport(report);
    assert.equal(rendered.exitCode, 1);
    assert.match(rendered.stdout, /TOPOLOGY REHEARSAL: FAIL/);
  });
  assert.equal(isMainModule(undefined), false);
  assert.equal(isMainModule('/definitely/missing/validator.mjs'), false);
  assert.equal(
    isMainModule(resolve(ROOT, 'tools/contract-validation/validate-topology-rehearsal.mjs')),
    true,
  );
});

test('artifact roles require distinct paths and distinct byte digests', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.evidence.artifacts[1].path = record.evidence.artifacts[0].path;
    record.evidence.artifacts[1].sha256 = record.evidence.artifacts[0].sha256;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('artifact paths must be unique')));
    assert.ok(report.errors.some((error) => error.includes('artifact digests must be unique')));
  });
});

test('a prepared record must match a code-and-policy-pinned current state', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    writeRecord(root, record);
    const recordBytes = readFileSync(resolve(root, RECORD_PATH));
    const currentState = {
      record_id: RECORD_ID,
      record_sha256: sha256(recordBytes),
      phase: 'proposed',
      attempt_consumed: false,
      outcome: 'not_run',
      grant_sha256: null,
    };
    const policy = JSON.parse(readFileSync(resolve(root, POLICY_PATH), 'utf8'));
    policy.current_state = currentState;
    policy.state_history = [];
    stableWriteJson(resolve(root, POLICY_PATH), policy);
    const report = validateTopologyRehearsals({
      root,
      pinnedState: { current_state: currentState, state_history: [] },
    });
    assert.deepEqual(report.errors, []);

    policy.current_state = { ...currentState, attempt_consumed: true };
    stableWriteJson(resolve(root, POLICY_PATH), policy);
    const drifted = validateTopologyRehearsals({
      root,
      pinnedState: { current_state: currentState, state_history: [] },
    });
    assert.ok(drifted.errors.some((error) =>
      error.includes('state policy must exactly match the validator-pinned state')));
  });
});

test('an arbitrary grant cannot self-authorize a topology record', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
    });
    writeFileSync(resolve(root, `${RECORD_DIR}/grant.txt`), 'I authorize myself.\n', 'utf8');
    record.evidence.artifacts.find((entry) => entry.kind === 'grant').sha256 =
      sha256('I authorize myself.\n');
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('authorized or closed topology record requires a verified Founder SSHSIG')));
  });
});

test('null records and symlinked or record-named directories fail with findings, never invisibly pass', async () => {
  await withRoot((root) => {
    mkdirSync(resolve(root, RECORD_DIR), { recursive: true });
    writeFileSync(resolve(root, RECORD_PATH), 'null\n', 'utf8');
    let report;
    assert.doesNotThrow(() => {
      report = validateTopologyRehearsals({ root });
    });
    assert.ok(report.errors.some((error) => error.includes('topology record must be an object')));
  });

  await withRoot((root) => {
    const outside = resolve(root, 'outside-record-directory');
    mkdirSync(outside, { recursive: true });
    stableWriteJson(join(outside, 'topology-rehearsal.json'), buildRecord(root));
    rmSync(resolve(root, RECORD_DIR), { recursive: true, force: true });
    symlinkSync(outside, resolve(root, RECORD_DIR));
    let report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('symlink entries are forbidden')));

    rmSync(resolve(root, RECORD_DIR), { force: true });
    mkdirSync(resolve(root, RECORD_DIR), { recursive: true });
    mkdirSync(resolve(root, RECORD_PATH), { recursive: true });
    report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('topology-rehearsal.json must be a regular file, not a directory')));
  });
});

test('terminal state checks cover unauthorized closure and unconsumed PRECHECK_ABORT', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'closed',
      outcome: 'PRECHECK_ABORT',
      attemptConsumed: true,
      teardownVerified: true,
      residualResources: 0,
      externalManifestLocallyVerified: true,
    });
    record.attempt.execution_authorized = true;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('closed topology record must be unauthorized with a terminal outcome')));
    assert.ok(report.errors.some((error) => error.includes('PRECHECK_ABORT must remain unconsumed')));
  });
});
