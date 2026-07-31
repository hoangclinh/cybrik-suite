import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  expectedCandidateFields,
  expectedRepositories,
  validateRuntimeAdmission,
} from '../validate-runtime-admission.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const SCHEMA_PATH = 'docs/uat/runtime-admission.schema.json';
const README_PATH = 'docs/uat/candidates/README.md';
const TEMPLATE_PATH = 'docs/uat/templates/runtime-admission.hold.json';
const CANDIDATE_RELATIVE_PATH = 'docs/uat/candidates/candidate-001/runtime-admission.json';
const CANDIDATE_EVIDENCE_DIR = 'docs/uat/candidates/candidate-001/evidence';
const HEX_40 = '0123456789abcdef0123456789abcdef01234567';
const TREE_40 = '89abcdef0123456789abcdef0123456789abcdef';
const CANONICAL_ARTIFACTS = {
  '01-session.log': 'session log\n',
  '02-summary.txt': 'summary\n',
};

const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');

const stableWriteJson = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const canonicalCandidate = () => ({
  candidate_id: 'candidate-001',
  recorded_at: '2026-07-31T00:00:00Z',
  commit_tree: {
    suite: { commit: HEX_40, tree: TREE_40 },
    soc: { commit: '1111111111111111111111111111111111111111', tree: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    cyber_ai: { commit: '2222222222222222222222222222222222222222', tree: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    tool_fabric: { commit: '3333333333333333333333333333333333333333', tree: 'cccccccccccccccccccccccccccccccccccccccc' },
  },
  hosted_ci: {
    required_checks: [
      { repo: 'suite', sha: HEX_40, name: 'contracts', status: 'success' },
      { repo: 'soc', sha: '1111111111111111111111111111111111111111', name: 'soc-ci', status: 'success' },
      { repo: 'cyber_ai', sha: '2222222222222222222222222222222222222222', name: 'cyber-ai-ci', status: 'success' },
      { repo: 'tool_fabric', sha: '3333333333333333333333333333333333333333', name: 'fabric-ci', status: 'success' },
    ],
    skipped_jobs: [
      { repo: 'soc', name: 'e2e-org', status: 'skipped', reason: 'out of exercised path' },
    ],
    suppressed_jobs: [
      { repo: 'tool_fabric', name: 'alert-context-route-db', status: 'suppressed', reason: 'feature-off and unwired' },
    ],
  },
  contracts: {
    reviewed_contracts: [
      'contracts/compatibility/cybrik-suite-alert-context-packet.v1.manifest.json',
    ],
    feature_flags: [
      { name: 'CYBRIK_RUNTIME_ADMISSION_EXAMPLE', state: 'off' },
    ],
    capability_lifecycle: [
      { capability: 'soc.get_alert_context', state: 'accepted_for_implementation' },
    ],
  },
  test_data: {
    classification: 'synthetic',
    approved: true,
    notes: 'Synthetic fixtures only.',
  },
  production_exclusion: {
    no_production_credentials: true,
    no_production_configuration: true,
    no_production_data: true,
    no_production_traffic: true,
  },
  lifecycle_procedures: {
    start: ['docker compose up -d'],
    stop: ['docker compose down --remove-orphans'],
    reset: ['docker compose down -v'],
    seed: ['node tools/seed-synthetic.mjs'],
    rollback: ['docker compose down --remove-orphans && git checkout --detach 0123456789abcdef0123456789abcdef01234567'],
  },
  negative_smoke: {
    tenant_isolation: [
      { name: 'cross-tenant case read', status: 'pass' },
    ],
    authorization: [
      { name: 'ungranted descendant raw data read', status: 'pass' },
    ],
    secret_boundary: [
      { name: 'production secret mount blocked', status: 'pass' },
    ],
  },
  open_findings: {
    critical: 0,
    high: 0,
    notes: [],
  },
  evidence: {
    directory: CANDIDATE_EVIDENCE_DIR,
    artifacts: [
      {
        path: `${CANDIDATE_EVIDENCE_DIR}/01-session.log`,
        sha256: sha256(CANONICAL_ARTIFACTS['01-session.log']),
      },
      {
        path: `${CANDIDATE_EVIDENCE_DIR}/02-summary.txt`,
        sha256: sha256(CANONICAL_ARTIFACTS['02-summary.txt']),
      },
    ],
    limitations: ['Local-only bounded execution.'],
    final_profile_verdict: 'RUNTIME_AUTHORIZED',
  },
  network_exposure: {
    mode: 'local_only',
    surfaces: [
      { bind: '127.0.0.1:3000', purpose: 'analyst UI' },
      { bind: '127.0.0.1:8000', purpose: 'API' },
    ],
    notes: 'Loopback-only exposure.',
  },
  disposition: {
    profile: 'RUNTIME_AUTHORIZED',
    rationale: 'All ten runtime-admission items are complete and passing.',
  },
});

const materializeRepo = ({ candidate, writes = [] } = {}) => {
  const tempRoot = mkdtempSync(join(os.tmpdir(), 'runtime-admission-'));
  mkdirSync(join(tempRoot, 'docs/uat/candidates'), { recursive: true });
  mkdirSync(join(tempRoot, 'docs/uat/templates'), { recursive: true });
  writeFileSync(join(tempRoot, SCHEMA_PATH), read(SCHEMA_PATH), 'utf8');
  writeFileSync(join(tempRoot, README_PATH), read(README_PATH), 'utf8');
  writeFileSync(join(tempRoot, TEMPLATE_PATH), read(TEMPLATE_PATH), 'utf8');
  if (candidate) {
    mkdirSync(join(tempRoot, 'docs/uat/candidates/candidate-001'), { recursive: true });
    mkdirSync(join(tempRoot, CANDIDATE_EVIDENCE_DIR), { recursive: true });
    for (const [name, content] of Object.entries(CANONICAL_ARTIFACTS)) {
      writeFileSync(join(tempRoot, CANDIDATE_EVIDENCE_DIR, name), content, 'utf8');
    }
    stableWriteJson(join(tempRoot, CANDIDATE_RELATIVE_PATH), candidate);
  }
  for (const write of writes) {
    mkdirSync(join(tempRoot, write.dir), { recursive: true });
    stableWriteJson(join(tempRoot, write.path), write.value);
  }
  return tempRoot;
};

const withTempRepo = (options, fn) => {
  const tempRoot = materializeRepo(options);
  try {
    return fn(tempRoot);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
};

test('repo runtime-admission assets validate with the committed runtime-admission-ai-pg-r1 candidate', async () => {
  const report = await validateRuntimeAdmission({ root: ROOT });

  assert.deepEqual(report.errors, []);
  assert.deepEqual(expectedRepositories, ['suite', 'soc', 'cyber_ai', 'tool_fabric']);
  assert.deepEqual(expectedCandidateFields, [
    'candidate_id',
    'recorded_at',
    'commit_tree',
    'hosted_ci',
    'contracts',
    'test_data',
    'production_exclusion',
    'lifecycle_procedures',
    'negative_smoke',
    'open_findings',
    'evidence',
    'network_exposure',
    'disposition',
  ]);
  assert.equal(report.counts.candidateFiles, 1);
  assert.equal(report.counts.templatesValidated, 1);
  assert.equal(report.candidates[0].candidateId, 'runtime-admission-ai-pg-r1');
  assert.equal(report.candidates[0].declaredDisposition, 'RUNTIME_AUTHORIZED');
  assert.equal(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
});

test('candidate discovery validates only docs/uat/candidates/*/runtime-admission.json', async () => {
  await withTempRepo({ candidate: canonicalCandidate() }, async (tempRoot) => {
    writeFileSync(
      join(tempRoot, 'docs/uat/candidates/README.md'),
      '# local note\n',
      'utf8',
    );
    mkdirSync(join(tempRoot, 'docs/uat/candidates/not-a-candidate'), { recursive: true });
    stableWriteJson(
      join(tempRoot, 'docs/uat/candidates/not-a-candidate/ignored.json'),
      canonicalCandidate(),
    );

    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.candidateFiles, 1);
    assert.equal(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('mislocated runtime-admission.json files under candidates fail closed while README remains allowed', async () => {
  await withTempRepo({
    candidate: canonicalCandidate(),
    writes: [
      {
        dir: 'docs/uat/candidates',
        path: 'docs/uat/candidates/runtime-admission.json',
        value: canonicalCandidate(),
      },
      {
        dir: 'docs/uat/candidates/nested/wrong-depth',
        path: 'docs/uat/candidates/nested/wrong-depth/runtime-admission.json',
        value: canonicalCandidate(),
      },
      {
        dir: 'docs/uat/candidates/stray',
        path: 'docs/uat/candidates/stray/runtime-admission.txt',
        value: canonicalCandidate(),
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('mislocated runtime-admission.json')));
    assert.equal(report.counts.candidateFiles, 1);
    assert.equal(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('a complete candidate can be RUNTIME_AUTHORIZED and must not imply a stronger profile', async () => {
  await withTempRepo({ candidate: canonicalCandidate() }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].declaredDisposition, 'RUNTIME_AUTHORIZED');
    assert.equal(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('multiple unique success checks per repository can still be RUNTIME_AUTHORIZED', async () => {
  const candidate = canonicalCandidate();
  candidate.hosted_ci.required_checks.push(
    { repo: 'suite', sha: HEX_40, name: 'lint', status: 'success' },
    { repo: 'soc', sha: '1111111111111111111111111111111111111111', name: 'soc-smoke', status: 'success' },
  );

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('missing commit_tree repositories still fail closed at schema validation', async () => {
  const missingRepo = canonicalCandidate();
  delete missingRepo.commit_tree.tool_fabric;
  await withTempRepo({ candidate: missingRepo }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('schema /commit_tree')));
  });
});

test('required hosted checks must cover every repository at least once and reject duplicate repo-name pairs', async () => {
  const missingRequiredRepo = canonicalCandidate();
  missingRequiredRepo.hosted_ci.required_checks = missingRequiredRepo.hosted_ci.required_checks.filter(
    (check) => check.repo !== 'tool_fabric',
  );

  await withTempRepo({ candidate: missingRequiredRepo }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('required hosted CI must cover every repository at least once')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const duplicateRequiredCheck = canonicalCandidate();
  duplicateRequiredCheck.hosted_ci.required_checks.push({
    repo: 'suite',
    sha: HEX_40,
    name: 'contracts',
    status: 'success',
  });

  await withTempRepo({ candidate: duplicateRequiredCheck }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('required hosted checks must not duplicate repo and name pairs')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('required hosted checks must enumerate rendered names and separate skipped and suppressed jobs', async () => {
  const candidate = canonicalCandidate();
  delete candidate.hosted_ci.skipped_jobs;
  candidate.hosted_ci.required_checks[0].status = 'pending';

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('skipped_jobs')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('contracts, flags and lifecycle state must be explicit', async () => {
  const candidate = canonicalCandidate();
  candidate.contracts.feature_flags = [];
  candidate.contracts.capability_lifecycle = [];

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('feature flags')));
    assert.ok(report.errors.some((error) => error.includes('capability lifecycle')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('test data must remain synthetic, sanitized or otherwise explicitly approved', async () => {
  const candidate = canonicalCandidate();
  candidate.test_data.classification = 'production';

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('schema /test_data/classification')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('any production-boundary failure is NO-GO', async () => {
  const candidate = canonicalCandidate();
  candidate.production_exclusion.no_production_credentials = false;

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('no production credentials')));
    assert.equal(report.candidates[0].derivedDisposition, 'NO-GO');
  });
});

test('start stop reset seed and rollback commands are all mandatory', async () => {
  const candidate = canonicalCandidate();
  candidate.lifecycle_procedures.rollback = [];

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('rollback')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('tenant isolation authorization and secret-boundary smoke failures are NO-GO', async () => {
  const candidate = canonicalCandidate();
  candidate.negative_smoke.authorization[0].status = 'fail';

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('authorization-negative smoke')));
    assert.equal(report.candidates[0].derivedDisposition, 'NO-GO');
  });
});

test('open Critical or High findings fail closed', async () => {
  const candidate = canonicalCandidate();
  candidate.open_findings.high = 1;

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('open Critical or High finding')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('evidence location and digests are mandatory', async () => {
  const candidate = canonicalCandidate();
  candidate.evidence.artifacts[0].sha256 = 'not-a-digest';

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('schema /evidence/artifacts/0/sha256')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('evidence artifacts must exist, stay inside the evidence directory, and match their declared SHA-256', async () => {
  const missingArtifact = canonicalCandidate();
  await withTempRepo({ candidate: missingArtifact }, async (tempRoot) => {
    unlinkSync(join(tempRoot, CANDIDATE_EVIDENCE_DIR, '01-session.log'));
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('evidence artifact path must resolve to a readable regular file')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const mismatchedArtifact = canonicalCandidate();
  await withTempRepo({ candidate: mismatchedArtifact }, async (tempRoot) => {
    writeFileSync(join(tempRoot, CANDIDATE_EVIDENCE_DIR, '01-session.log'), 'tampered\n', 'utf8');
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('evidence artifact sha256 must match the recorded bytes')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const absoluteArtifact = canonicalCandidate();
  absoluteArtifact.evidence.artifacts[0].path = '/tmp/evil.log';
  await withTempRepo({ candidate: absoluteArtifact }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('evidence artifact paths must be relative to the repository root')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const traversalArtifact = canonicalCandidate();
  traversalArtifact.evidence.artifacts[0].path = 'docs/uat/candidates/candidate-001/evidence/../escape.log';
  await withTempRepo({ candidate: traversalArtifact }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('evidence artifact paths must not traverse outside the declared evidence directory')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const outsideArtifact = canonicalCandidate();
  outsideArtifact.evidence.artifacts[0].path = 'docs/uat/candidates/candidate-001/runtime-admission.json';
  await withTempRepo({ candidate: outsideArtifact }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('evidence artifacts must stay inside candidate.evidence.directory')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const symlinkArtifact = canonicalCandidate();
  await withTempRepo({ candidate: symlinkArtifact }, async (tempRoot) => {
    unlinkSync(join(tempRoot, CANDIDATE_EVIDENCE_DIR, '01-session.log'));
    symlinkSync(
      join(tempRoot, CANDIDATE_RELATIVE_PATH),
      join(tempRoot, CANDIDATE_EVIDENCE_DIR, '01-session.log'),
    );
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('evidence artifact path must resolve to a readable regular file')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const absoluteEvidenceDirectory = canonicalCandidate();
  absoluteEvidenceDirectory.evidence.directory = join(
    os.tmpdir(),
    'runtime-admission-absolute-evidence-dir',
  );
  await withTempRepo({ candidate: absoluteEvidenceDirectory }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('candidate.evidence.directory must stay inside the repository root')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('network exposure must stay local-only or explicitly bounded', async () => {
  const candidate = canonicalCandidate();
  candidate.network_exposure.mode = 'public';

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('schema /network_exposure/mode')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('readiness overclaim is rejected even when the underlying runtime-admission record is complete', async () => {
  const candidate = canonicalCandidate();
  candidate.disposition.profile = 'DEMO_READY_LOCAL';
  candidate.evidence.final_profile_verdict = 'DEMO_READY_LOCAL';

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('must never imply DEMO_READY_LOCAL')));
  });
});

test('schema-invalid truthy and negative values fail closed before semantic derivation', async () => {
  const candidate = canonicalCandidate();
  candidate.test_data.approved = 'yes';
  candidate.contracts.reviewed_contracts = 'contracts/compatibility/cybrik-suite-alert-context-packet.v1.manifest.json';
  candidate.contracts.feature_flags = 'CYBRIK_RUNTIME_ADMISSION_EXAMPLE=off';
  candidate.contracts.capability_lifecycle = 'soc.get_alert_context';
  candidate.open_findings.critical = -1;
  candidate.open_findings.high = -1;
  candidate.disposition.rationale = '';

  await withTempRepo({ candidate }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('schema')));
    assert.ok(report.errors.some((error) => error.includes('test_data/approved')));
    assert.ok(report.errors.some((error) => error.includes('contracts/reviewed_contracts')));
    assert.ok(report.errors.some((error) => error.includes('open_findings/critical')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
    assert.notEqual(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});
