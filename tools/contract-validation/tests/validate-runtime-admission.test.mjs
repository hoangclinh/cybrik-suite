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

const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const stableWriteJson = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const HEX_40 = '0123456789abcdef0123456789abcdef01234567';
const TREE_40 = '89abcdef0123456789abcdef0123456789abcdef';
const SOC_SHA = '1111111111111111111111111111111111111111';
const CYBER_SHA = '2222222222222222222222222222222222222222';
const FABRIC_SHA = '3333333333333333333333333333333333333333';

const candidateId = (seriesId, ordinal) => `${seriesId}-r${ordinal}`;
const candidateDir = (seriesId, ordinal) => `docs/uat/candidates/${candidateId(seriesId, ordinal)}`;
const evidenceDir = (seriesId, ordinal) => `${candidateDir(seriesId, ordinal)}/evidence`;
const currentAttemptArtifact = (seriesId, ordinal) => `${evidenceDir(seriesId, ordinal)}/05-attempt-accounting.json`;

const templateRecord = () => ({
  candidate_id: 'template-hold',
  recorded_at: '2026-07-31T00:00:00Z',
  attempt_accounting: {
    series_id: 'template-hold',
    attempt_ordinal: 1,
    max_attempts: 1,
    current_attempt: {
      status: 'not_run',
      execution_authorized: false,
      executed_checks: 0,
      passed_checks: 0,
      failed_checks: 0,
      evidence_path: 'docs/uat/templates/runtime-admission.template.txt',
      evidence_sha256: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    failure_history: [],
  },
  commit_tree: {
    suite: { commit: '0000000000000000000000000000000000000000', tree: '0000000000000000000000000000000000000000' },
    soc: { commit: '0000000000000000000000000000000000000000', tree: '0000000000000000000000000000000000000000' },
    cyber_ai: { commit: '0000000000000000000000000000000000000000', tree: '0000000000000000000000000000000000000000' },
    tool_fabric: { commit: '0000000000000000000000000000000000000000', tree: '0000000000000000000000000000000000000000' },
  },
  hosted_ci: {
    required_checks: [],
    skipped_jobs: [],
    suppressed_jobs: [],
  },
  contracts: {
    reviewed_contracts: [],
    feature_flags: [],
    capability_lifecycle: [],
  },
  test_data: {
    classification: 'synthetic',
    approved: false,
    notes: 'Template placeholder only.',
  },
  production_exclusion: {
    no_production_credentials: true,
    no_production_configuration: true,
    no_production_data: true,
    no_production_traffic: true,
  },
  lifecycle_procedures: {
    start: [],
    stop: [],
    reset: [],
    seed: [],
    rollback: [],
  },
  negative_smoke: {
    tenant_isolation: [{ name: 'Template only.', status: 'hold' }],
    authorization: [{ name: 'Template only.', status: 'hold' }],
    secret_boundary: [{ name: 'Template only.', status: 'hold' }],
  },
  open_findings: {
    critical: 0,
    high: 0,
    notes: ['Template only.'],
  },
  evidence: {
    directory: 'docs/uat/candidates/<candidate-id>',
    artifacts: [],
    limitations: ['Template only. No execution evidence is recorded here.'],
    final_profile_verdict: 'HOLD',
  },
  network_exposure: {
    mode: 'local_only',
    surfaces: [],
    notes: 'Template only.',
  },
  disposition: {
    profile: 'HOLD',
    rationale: 'Template only.',
  },
});

const baseCandidate = ({
  seriesId = 'runtime-admission-ai-pg',
  ordinal = 1,
  maxAttempts = 2,
  currentStatus = 'not_run',
  executionAuthorized = true,
  passedChecks = 0,
  failedChecks = 0,
  history = [],
  highFindings = 0,
  criticalFindings = 0,
  authorizationSmoke = 'pass',
  disposition = 'RUNTIME_AUTHORIZED',
  evidenceContent = `attempt ${ordinal}\n`,
} = {}) => {
  const executedChecks = passedChecks + failedChecks;
  const dir = evidenceDir(seriesId, ordinal);
  const attemptPath = currentAttemptArtifact(seriesId, ordinal);
  const attemptSha = sha256(evidenceContent);
  return {
    candidate_id: candidateId(seriesId, ordinal),
    recorded_at: '2026-07-31T00:00:00Z',
    attempt_accounting: {
      series_id: seriesId,
      attempt_ordinal: ordinal,
      max_attempts: maxAttempts,
      current_attempt: {
        status: currentStatus,
        execution_authorized: executionAuthorized,
        executed_checks: executedChecks,
        passed_checks: passedChecks,
        failed_checks: failedChecks,
        evidence_path: attemptPath,
        evidence_sha256: attemptSha,
      },
      failure_history: history,
    },
    commit_tree: {
      suite: { commit: HEX_40, tree: TREE_40 },
      soc: { commit: SOC_SHA, tree: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      cyber_ai: { commit: CYBER_SHA, tree: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      tool_fabric: { commit: FABRIC_SHA, tree: 'cccccccccccccccccccccccccccccccccccccccc' },
    },
    hosted_ci: {
      required_checks: [
        { repo: 'suite', sha: HEX_40, name: 'contracts', status: 'success' },
        { repo: 'soc', sha: SOC_SHA, name: 'soc-ci', status: 'success' },
        { repo: 'cyber_ai', sha: CYBER_SHA, name: 'cyber-ai-ci', status: 'success' },
        { repo: 'tool_fabric', sha: FABRIC_SHA, name: 'fabric-ci', status: 'success' },
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
      rollback: ['docker compose down --remove-orphans'],
    },
    negative_smoke: {
      tenant_isolation: [{ name: 'cross-tenant case read', status: 'pass' }],
      authorization: [{ name: 'ungranted descendant raw data read', status: authorizationSmoke }],
      secret_boundary: [{ name: 'production secret mount blocked', status: 'pass' }],
    },
    open_findings: {
      critical: criticalFindings,
      high: highFindings,
      notes: [],
    },
    evidence: {
      directory: dir,
      artifacts: [
        {
          path: attemptPath,
          sha256: attemptSha,
        },
      ],
      limitations: ['Local-only bounded execution.'],
      final_profile_verdict: disposition,
    },
    network_exposure: {
      mode: 'local_only',
      surfaces: [
        { bind: '127.0.0.1:3000', purpose: 'analyst UI' },
      ],
      notes: 'Loopback-only exposure.',
    },
    disposition: {
      profile: disposition,
      rationale: 'Candidate rationale.',
    },
  };
};

const recoverySeries = ({
  reviewStatus = 'pending',
  executionAuthorized = false,
  disposition = executionAuthorized ? 'RUNTIME_AUTHORIZED' : 'HOLD',
  correctionContent = 'reviewed command correction\n',
} = {}) => {
  const seriesId = 'runtime-admission-ai-pg';
  const r1Content = 'attempt 1\n';
  const r2Content = 'attempt 2\n';
  const r1Path = currentAttemptArtifact(seriesId, 1);
  const r2Path = currentAttemptArtifact(seriesId, 2);
  const correctionPath = `${evidenceDir(seriesId, 3)}/01-command-correction.md`;
  const reviewContent = 'independent review verdict GO\n';
  const reviewPath = `${evidenceDir(seriesId, 3)}/02-independent-review.md`;

  const r1 = baseCandidate({
    seriesId,
    ordinal: 1,
    currentStatus: 'failed',
    executionAuthorized: false,
    passedChecks: 18,
    failedChecks: 1,
    authorizationSmoke: 'fail',
    highFindings: 1,
    disposition: 'NO-GO',
  });
  const r2 = baseCandidate({
    seriesId,
    ordinal: 2,
    currentStatus: 'failed',
    executionAuthorized: false,
    passedChecks: 3,
    failedChecks: 1,
    authorizationSmoke: 'fail',
    highFindings: 1,
    history: [
      {
        candidate_id: candidateId(seriesId, 1),
        attempt_ordinal: 1,
        executed_checks: 19,
        passed_checks: 18,
        failed_checks: 1,
        disposition: 'NO-GO',
        evidence_path: r1Path,
        evidence_sha256: sha256(r1Content),
      },
    ],
    disposition: 'NO-GO',
  });
  const r3 = baseCandidate({
    seriesId,
    ordinal: 3,
    maxAttempts: 2,
    currentStatus: 'not_run',
    executionAuthorized,
    history: [
      {
        candidate_id: candidateId(seriesId, 1),
        attempt_ordinal: 1,
        executed_checks: 19,
        passed_checks: 18,
        failed_checks: 1,
        disposition: 'NO-GO',
        evidence_path: r1Path,
        evidence_sha256: sha256(r1Content),
      },
      {
        candidate_id: candidateId(seriesId, 2),
        attempt_ordinal: 2,
        executed_checks: 4,
        passed_checks: 3,
        failed_checks: 1,
        disposition: 'NO-GO',
        evidence_path: r2Path,
        evidence_sha256: sha256(r2Content),
      },
    ],
    disposition,
  });
  r3.attempt_accounting.recovery_override = {
    kind: 'admitted_command_defect',
    additional_attempts: 1,
    terminal_candidate_id: candidateId(seriesId, 2),
    terminal_attempt_ordinal: 2,
    terminal_evidence_path: r2Path,
    terminal_evidence_sha256: sha256(r2Content),
    correction_evidence_path: correctionPath,
    correction_evidence_sha256: sha256(correctionContent),
    review_status: reviewStatus,
  };
  r3.evidence.artifacts.push({
    path: correctionPath,
    sha256: sha256(correctionContent),
  });
  const extraWrites = [
    {
      kind: 'text',
      dir: evidenceDir(seriesId, 3),
      path: correctionPath,
      value: correctionContent,
    },
  ];
  if (reviewStatus === 'independently_reviewed_go') {
    r3.attempt_accounting.recovery_override.review_evidence_path = reviewPath;
    r3.attempt_accounting.recovery_override.review_evidence_sha256 =
      sha256(reviewContent);
    r3.evidence.artifacts.push({
      path: reviewPath,
      sha256: sha256(reviewContent),
    });
    extraWrites.push({
      kind: 'text',
      dir: evidenceDir(seriesId, 3),
      path: reviewPath,
      value: reviewContent,
    });
  }

  return {
    seriesId,
    r1,
    r2,
    r3,
    correctionContent,
    correctionPath,
    reviewContent,
    reviewPath,
    extraWrites,
  };
};

const withTempRepo = async ({
  candidates = [],
  extraWrites = [],
} = {}, fn) => {
  const tempRoot = mkdtempSync(join(os.tmpdir(), 'runtime-admission-'));
  try {
    mkdirSync(join(tempRoot, 'docs/uat/candidates'), { recursive: true });
    mkdirSync(join(tempRoot, 'docs/uat/templates'), { recursive: true });
    writeFileSync(join(tempRoot, SCHEMA_PATH), read(SCHEMA_PATH), 'utf8');
    writeFileSync(join(tempRoot, README_PATH), read(README_PATH), 'utf8');
    stableWriteJson(join(tempRoot, TEMPLATE_PATH), templateRecord());
    for (const candidate of candidates) {
      const dir = join(tempRoot, candidateDir(candidate.attempt_accounting.series_id, candidate.attempt_accounting.attempt_ordinal));
      const evDir = join(tempRoot, evidenceDir(candidate.attempt_accounting.series_id, candidate.attempt_accounting.attempt_ordinal));
      mkdirSync(dir, { recursive: true });
      mkdirSync(evDir, { recursive: true });
      writeFileSync(
        join(tempRoot, candidate.attempt_accounting.current_attempt.evidence_path),
        `attempt ${candidate.attempt_accounting.attempt_ordinal}\n`,
        'utf8',
      );
      stableWriteJson(join(tempRoot, `${candidateDir(candidate.attempt_accounting.series_id, candidate.attempt_accounting.attempt_ordinal)}/runtime-admission.json`), candidate);
    }
    for (const write of extraWrites) {
      mkdirSync(join(tempRoot, write.dir), { recursive: true });
      if (write.kind === 'json') {
        stableWriteJson(join(tempRoot, write.path), write.value);
      } else {
        writeFileSync(join(tempRoot, write.path), write.value, 'utf8');
      }
    }
    await fn(tempRoot);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
};

test('exports include attempt_accounting in the candidate field contract', () => {
  assert.deepEqual(expectedRepositories, ['suite', 'soc', 'cyber_ai', 'tool_fabric']);
  assert.deepEqual(expectedCandidateFields, [
    'candidate_id',
    'recorded_at',
    'attempt_accounting',
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
});

test('candidate discovery still validates only docs/uat/candidates/*/runtime-admission.json', async () => {
  const candidate = baseCandidate();
  await withTempRepo({
    candidates: [candidate],
    extraWrites: [
      {
        kind: 'json',
        dir: 'docs/uat/candidates/not-a-candidate',
        path: 'docs/uat/candidates/not-a-candidate/ignored.json',
        value: candidate,
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.candidateFiles, 1);
    assert.equal(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('valid retired R1 NO-GO and authorized R2 patterns validate together', async () => {
  const seriesId = 'runtime-admission-ai-pg';
  const r1AttemptContent = '{"attempt":1,"result":"failed"}\n';
  const r1AttemptPath = currentAttemptArtifact(seriesId, 1);
  const r1 = baseCandidate({
    seriesId,
    ordinal: 1,
    currentStatus: 'failed',
    executionAuthorized: false,
    passedChecks: 18,
    failedChecks: 1,
    authorizationSmoke: 'fail',
    disposition: 'NO-GO',
    evidenceContent: r1AttemptContent,
  });
  r1.attempt_accounting.current_attempt.evidence_sha256 = sha256(r1AttemptContent);

  const r2 = baseCandidate({
    seriesId,
    ordinal: 2,
    maxAttempts: 2,
    currentStatus: 'not_run',
    executionAuthorized: true,
    passedChecks: 0,
    failedChecks: 0,
    history: [
      {
        candidate_id: candidateId(seriesId, 1),
        attempt_ordinal: 1,
        executed_checks: 19,
        passed_checks: 18,
        failed_checks: 1,
        disposition: 'NO-GO',
        evidence_path: r1AttemptPath,
        evidence_sha256: sha256(r1AttemptContent),
      },
    ],
    disposition: 'RUNTIME_AUTHORIZED',
  });

  await withTempRepo({ candidates: [r1, r2] }, async (tempRoot) => {
    writeFileSync(join(tempRoot, r1AttemptPath), r1AttemptContent, 'utf8');
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.candidateFiles, 2);
    const byId = new Map(report.candidates.map((candidateReport) => [candidateReport.candidateId, candidateReport]));
    assert.equal(byId.get(candidateId(seriesId, 1)).declaredDisposition, 'NO-GO');
    assert.equal(byId.get(candidateId(seriesId, 1)).derivedDisposition, 'NO-GO');
    assert.equal(byId.get(candidateId(seriesId, 2)).declaredDisposition, 'RUNTIME_AUTHORIZED');
    assert.equal(byId.get(candidateId(seriesId, 2)).derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('one command-defect recovery override preserves the exhausted series and stays HOLD', async () => {
  const {
    seriesId,
    r1,
    r2,
    r3,
    extraWrites,
  } = recoverySeries();

  await withTempRepo({
    candidates: [r1, r2, r3],
    extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    const r3Report = report.candidates.find(
      (candidateReport) => candidateReport.candidateId === candidateId(seriesId, 3),
    );
    assert.equal(r3Report.derivedDisposition, 'HOLD');
  });
});

test('pending recovery review cannot authorize execution', async () => {
  const {
    r1,
    r2,
    r3,
    extraWrites,
  } = recoverySeries({ executionAuthorized: true });

  await withTempRepo({
    candidates: [r1, r2, r3],
    extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'recovery execution requires independently_reviewed_go',
    )));
    assert.equal(report.candidates.at(-1).derivedDisposition, 'HOLD');
  });
});

test('independently reviewed recovery with pinned review evidence may authorize one execution', async () => {
  const {
    seriesId,
    r1,
    r2,
    r3,
    extraWrites,
  } = recoverySeries({
    reviewStatus: 'independently_reviewed_go',
    executionAuthorized: true,
  });

  await withTempRepo({
    candidates: [r1, r2, r3],
    extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    const r3Report = report.candidates.find(
      (candidateReport) => candidateReport.candidateId === candidateId(seriesId, 3),
    );
    assert.equal(r3Report.derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('independent review status requires distinct, digest-pinned review evidence', async () => {
  const missingReview = recoverySeries({
    reviewStatus: 'independently_reviewed_go',
    executionAuthorized: true,
  });
  delete missingReview.r3.attempt_accounting.recovery_override.review_evidence_path;
  delete missingReview.r3.attempt_accounting.recovery_override.review_evidence_sha256;
  missingReview.r3.evidence.artifacts = missingReview.r3.evidence.artifacts.filter(
    (artifact) => artifact.path !== missingReview.reviewPath,
  );
  missingReview.extraWrites = missingReview.extraWrites.filter(
    (write) => write.path !== missingReview.reviewPath,
  );
  await withTempRepo({
    candidates: [missingReview.r1, missingReview.r2, missingReview.r3],
    extraWrites: missingReview.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'schema /attempt_accounting/recovery_override must have required property',
    )));
  });

  const reusedCorrection = recoverySeries({
    reviewStatus: 'independently_reviewed_go',
    executionAuthorized: true,
  });
  reusedCorrection.r3.attempt_accounting.recovery_override.review_evidence_path =
    reusedCorrection.correctionPath;
  reusedCorrection.r3.attempt_accounting.recovery_override.review_evidence_sha256 =
    reusedCorrection.r3.attempt_accounting.recovery_override.correction_evidence_sha256;
  await withTempRepo({
    candidates: [reusedCorrection.r1, reusedCorrection.r2, reusedCorrection.r3],
    extraWrites: reusedCorrection.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'recovery review evidence must be distinct from correction evidence',
    )));
  });

  const reviewDigestDrift = recoverySeries({
    reviewStatus: 'independently_reviewed_go',
    executionAuthorized: true,
  });
  reviewDigestDrift.extraWrites.find(
    (write) => write.path === reviewDigestDrift.reviewPath,
  ).value = 'tampered independent review\n';
  await withTempRepo({
    candidates: [
      reviewDigestDrift.r1,
      reviewDigestDrift.r2,
      reviewDigestDrift.r3,
    ],
    extraWrites: reviewDigestDrift.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'evidence artifact sha256 must match the recorded bytes',
    )));
  });

  const pendingWithReviewBytes = recoverySeries();
  pendingWithReviewBytes.r3.attempt_accounting.recovery_override.review_evidence_path =
    pendingWithReviewBytes.reviewPath;
  pendingWithReviewBytes.r3.attempt_accounting.recovery_override.review_evidence_sha256 =
    sha256(pendingWithReviewBytes.reviewContent);
  await withTempRepo({
    candidates: [
      pendingWithReviewBytes.r1,
      pendingWithReviewBytes.r2,
      pendingWithReviewBytes.r3,
    ],
    extraWrites: pendingWithReviewBytes.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'pending recovery review must not carry review evidence',
    )));
  });
});

test('recovery override cannot rebind or mutate terminal failure evidence', async () => {
  const {
    r1,
    r2,
    r3,
    extraWrites,
  } = recoverySeries();
  r3.attempt_accounting.recovery_override.terminal_evidence_sha256 =
    '0000000000000000000000000000000000000000000000000000000000000000';

  await withTempRepo({
    candidates: [r1, r2, r3],
    extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'recovery_override terminal evidence must match the terminal candidate exactly',
    )));
  });
});

test('recovery correction evidence must exist, match its digest, and be registered', async () => {
  const missingArtifact = recoverySeries();
  missingArtifact.r3.evidence.artifacts =
    missingArtifact.r3.evidence.artifacts.filter(
      (artifact) => artifact.path !== missingArtifact.correctionPath,
    );
  await withTempRepo({
    candidates: [missingArtifact.r1, missingArtifact.r2, missingArtifact.r3],
    extraWrites: missingArtifact.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'recovery correction evidence must be listed in evidence.artifacts',
    )));
  });

  const digestDrift = recoverySeries();
  digestDrift.extraWrites[0].value = 'tampered command correction\n';
  await withTempRepo({
    candidates: [digestDrift.r1, digestDrift.r2, digestDrift.r3],
    extraWrites: digestDrift.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'evidence artifact sha256 must match the recorded bytes',
    )));
  });
});

test('recovery override permits exactly one additional attempt and one override per series', async () => {
  const tooManyAttempts = recoverySeries();
  tooManyAttempts.r3.attempt_accounting.recovery_override.additional_attempts = 2;
  await withTempRepo({
    candidates: [tooManyAttempts.r1, tooManyAttempts.r2, tooManyAttempts.r3],
    extraWrites: tooManyAttempts.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'schema /attempt_accounting/recovery_override/additional_attempts',
    )));
  });

  const duplicateOverride = recoverySeries();
  const r2CorrectionPath =
    `${evidenceDir(duplicateOverride.seriesId, 2)}/03-command-correction.md`;
  const r2CorrectionContent = 'invalid earlier override\n';
  duplicateOverride.r2.attempt_accounting.recovery_override = {
    ...duplicateOverride.r3.attempt_accounting.recovery_override,
    correction_evidence_path: r2CorrectionPath,
    correction_evidence_sha256: sha256(r2CorrectionContent),
  };
  duplicateOverride.r2.evidence.artifacts.push({
    path: r2CorrectionPath,
    sha256: sha256(r2CorrectionContent),
  });
  duplicateOverride.extraWrites.push({
    kind: 'text',
    dir: evidenceDir(duplicateOverride.seriesId, 2),
    path: r2CorrectionPath,
    value: r2CorrectionContent,
  });
  await withTempRepo({
    candidates: [duplicateOverride.r1, duplicateOverride.r2, duplicateOverride.r3],
    extraWrites: duplicateOverride.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'a series may contain at most one recovery_override',
    )));
  });
});

test('an ordinal beyond max_attempts remains rejected without a recovery override', async () => {
  const candidate = baseCandidate({
    ordinal: 3,
    maxAttempts: 2,
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.failure_history = [
    {
      candidate_id: 'runtime-admission-ai-pg-r1',
      attempt_ordinal: 1,
      executed_checks: 1,
      passed_checks: 0,
      failed_checks: 1,
      disposition: 'NO-GO',
      evidence_path: 'docs/uat/candidates/runtime-admission-ai-pg-r1/evidence/05-attempt-accounting.json',
      evidence_sha256: sha256('prior 1\n'),
    },
    {
      candidate_id: 'runtime-admission-ai-pg-r2',
      attempt_ordinal: 2,
      executed_checks: 1,
      passed_checks: 0,
      failed_checks: 1,
      disposition: 'NO-GO',
      evidence_path: 'docs/uat/candidates/runtime-admission-ai-pg-r2/evidence/05-attempt-accounting.json',
      evidence_sha256: sha256('prior 2\n'),
    },
  ];
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'attempt_ordinal must be <= max_attempts',
    )));
  });
});

test('candidate id suffix must match attempt_accounting series and ordinal', async () => {
  const candidate = baseCandidate();
  candidate.candidate_id = 'wrong-id';
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('candidate_id must equal attempt_accounting series_id plus -r<attempt_ordinal>')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('attempt ordinal must not exceed max and failure history length must equal ordinal minus one', async () => {
  const candidate = baseCandidate({
    ordinal: 2,
    maxAttempts: 1,
    history: [],
  });
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('attempt_ordinal must be <= max_attempts')));
    assert.ok(report.errors.some((error) => error.includes('failure_history must contain exactly attempt_ordinal - 1 rows')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('failure history ordinals must be unique contiguous and match exact prior candidate ids', async () => {
  const seriesId = 'runtime-admission-ai-pg';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 3,
    history: [
      {
        candidate_id: candidateId(seriesId, 1),
        attempt_ordinal: 1,
        executed_checks: 19,
        passed_checks: 18,
        failed_checks: 1,
        disposition: 'NO-GO',
        evidence_path: currentAttemptArtifact(seriesId, 1),
        evidence_sha256: sha256('attempt 1\n'),
      },
      {
        candidate_id: 'wrong-prior-id',
        attempt_ordinal: 1,
        executed_checks: 19,
        passed_checks: 17,
        failed_checks: 2,
        disposition: 'NO-GO',
        evidence_path: currentAttemptArtifact(seriesId, 1),
        evidence_sha256: sha256('attempt 1\n'),
      },
    ],
  });
  await withTempRepo({
    candidates: [candidate],
    extraWrites: [
      {
        kind: 'text',
        dir: evidenceDir(seriesId, 1),
        path: currentAttemptArtifact(seriesId, 1),
        value: 'attempt 1\n',
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('failure_history attempt_ordinal values must be unique')));
    assert.ok(report.errors.some((error) => error.includes('failure_history must enumerate every prior ordinal exactly once')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('attempt count totals and status semantics are enforced', async () => {
  const candidate = baseCandidate();
  candidate.attempt_accounting.current_attempt.executed_checks = 2;
  candidate.attempt_accounting.current_attempt.passed_checks = 1;
  candidate.attempt_accounting.current_attempt.failed_checks = 0;
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('status not_run requires all counts to be zero')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('execution_authorized true is valid only for not_run and false for passed or failed', async () => {
  const passedCandidate = baseCandidate({
    currentStatus: 'passed',
    executionAuthorized: true,
    passedChecks: 19,
    failedChecks: 0,
    disposition: 'HOLD',
  });
  await withTempRepo({ candidates: [passedCandidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('execution_authorized must be false for status passed')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('not_run plus execution_authorized false truthfully derives HOLD', async () => {
  const candidate = baseCandidate({
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('passed attempts truthfully derive HOLD', async () => {
  const candidate = baseCandidate({
    currentStatus: 'passed',
    executionAuthorized: false,
    passedChecks: 19,
    failedChecks: 0,
    disposition: 'HOLD',
  });
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('failed current attempts truthfully derive NO-GO without structural validator errors', async () => {
  const candidate = baseCandidate({
    currentStatus: 'failed',
    executionAuthorized: false,
    passedChecks: 18,
    failedChecks: 1,
    authorizationSmoke: 'fail',
    highFindings: 1,
    disposition: 'NO-GO',
  });
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'NO-GO');
  });
});

test('current attempt evidence must stay inside the current evidence directory', async () => {
  const candidate = baseCandidate();
  candidate.attempt_accounting.current_attempt.evidence_path = `${candidateDir('runtime-admission-ai-pg', 1)}/runtime-admission.json`;
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('evidence artifacts must stay inside candidate.evidence.directory')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('failure history evidence may point to prior candidate evidence but must resolve and match SHA-256', async () => {
  const seriesId = 'runtime-admission-ai-pg';
  const priorPath = currentAttemptArtifact(seriesId, 1);
  const priorContent = 'retired prior attempt\n';
  const r2 = baseCandidate({
    seriesId,
    ordinal: 2,
    history: [
      {
        candidate_id: candidateId(seriesId, 1),
        attempt_ordinal: 1,
        executed_checks: 19,
        passed_checks: 18,
        failed_checks: 1,
        disposition: 'NO-GO',
        evidence_path: priorPath,
        evidence_sha256: sha256('wrong bytes\n'),
      },
    ],
  });

  await withTempRepo({
    candidates: [r2],
    extraWrites: [
      {
        kind: 'text',
        dir: evidenceDir(seriesId, 1),
        path: priorPath,
        value: priorContent,
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('evidence artifact sha256 must match the recorded bytes')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('committed runtime-admission assets validate with retired R1 and failed R2', async () => {
  const report = await validateRuntimeAdmission({ root: ROOT });
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.templatesValidated, 1);
  assert.equal(report.counts.candidateFiles, 2);
  const byId = new Map(
    report.candidates.map((candidateReport) => [
      candidateReport.candidateId,
      candidateReport.derivedDisposition,
    ]),
  );
  assert.equal(byId.get('runtime-admission-ai-pg-r1'), 'NO-GO');
  assert.equal(byId.get('runtime-admission-ai-pg-r2'), 'NO-GO');

  const r2 = JSON.parse(read(
    'docs/uat/candidates/runtime-admission-ai-pg-r2/runtime-admission.json',
  ));
  assert.deepEqual(r2.attempt_accounting.current_attempt, {
    status: 'failed',
    execution_authorized: false,
    executed_checks: 4,
    passed_checks: 3,
    failed_checks: 1,
    evidence_path:
      'docs/uat/candidates/runtime-admission-ai-pg-r2/evidence/02-r2-runtime-result.md',
    evidence_sha256:
      'c8f4f4bcdf7e31329e46f73de1db1463034de4416c60b46125b18cd2479f2ef7',
  });
  assert.equal(r2.attempt_accounting.attempt_ordinal, 2);
  assert.equal(r2.attempt_accounting.max_attempts, 2);
  assert.equal(r2.evidence.final_profile_verdict, 'NO-GO');
  assert.equal(r2.disposition.profile, 'NO-GO');
  assert.match(read(README_PATH), /consumed both admitted ordinals/);
});

test('mislocated runtime-admission records fail closed while unrelated candidate files stay ignored', async () => {
  const candidate = baseCandidate();
  await withTempRepo({
    candidates: [candidate],
    extraWrites: [
      {
        kind: 'json',
        dir: 'docs/uat/candidates',
        path: 'docs/uat/candidates/runtime-admission.json',
        value: candidate,
      },
      {
        kind: 'json',
        dir: 'docs/uat/candidates/not-a-candidate',
        path: 'docs/uat/candidates/not-a-candidate/ignored.json',
        value: candidate,
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('mislocated runtime-admission.json')));
    assert.equal(report.counts.candidateFiles, 1);
  });
});

test('commit tuples and rendered required checks remain complete, exact, and unique', async () => {
  const missingRepo = baseCandidate();
  delete missingRepo.commit_tree.tool_fabric;
  await withTempRepo({ candidates: [missingRepo] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('schema /commit_tree')));
  });

  const missingRequiredRepo = baseCandidate();
  missingRequiredRepo.hosted_ci.required_checks =
    missingRequiredRepo.hosted_ci.required_checks.filter(
      (check) => check.repo !== 'tool_fabric',
    );
  await withTempRepo({ candidates: [missingRequiredRepo] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('required hosted CI must cover every repository at least once'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const duplicateRequiredCheck = baseCandidate();
  duplicateRequiredCheck.hosted_ci.required_checks.push({
    repo: 'suite',
    sha: HEX_40,
    name: 'contracts',
    status: 'success',
  });
  await withTempRepo({ candidates: [duplicateRequiredCheck] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('required hosted checks must not duplicate repo and name pairs'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const multipleUniqueChecks = baseCandidate();
  multipleUniqueChecks.hosted_ci.required_checks.push({
    repo: 'suite',
    sha: HEX_40,
    name: 'secret-scan',
    status: 'success',
  });
  await withTempRepo({ candidates: [multipleUniqueChecks] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('hosted non-required job classes and lifecycle prerequisites remain explicit', async () => {
  const malformedHosted = baseCandidate();
  delete malformedHosted.hosted_ci.skipped_jobs;
  malformedHosted.hosted_ci.required_checks[0].status = 'pending';
  await withTempRepo({ candidates: [malformedHosted] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('skipped_jobs')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const missingPrerequisites = baseCandidate();
  missingPrerequisites.contracts.feature_flags = [];
  missingPrerequisites.contracts.capability_lifecycle = [];
  missingPrerequisites.lifecycle_procedures.rollback = [];
  await withTempRepo({ candidates: [missingPrerequisites] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('feature flags')));
    assert.ok(report.errors.some((error) => error.includes('capability lifecycle')));
    assert.ok(report.errors.some((error) => error.includes('rollback')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('test-data, network, and production boundaries fail closed', async () => {
  const invalidTestData = baseCandidate();
  invalidTestData.test_data.classification = 'production';
  await withTempRepo({ candidates: [invalidTestData] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('schema /test_data/classification'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const invalidNetwork = baseCandidate();
  invalidNetwork.network_exposure.mode = 'public';
  await withTempRepo({ candidates: [invalidNetwork] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('schema /network_exposure/mode'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const productionBoundaryFailure = baseCandidate();
  productionBoundaryFailure.production_exclusion.no_production_credentials = false;
  await withTempRepo({ candidates: [productionBoundaryFailure] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) => error.includes('no production credentials')),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'NO-GO');
  });
});

test('smoke failures and open Critical or High findings truthfully derive NO-GO', async () => {
  const smokeFailure = baseCandidate({
    authorizationSmoke: 'fail',
    disposition: 'NO-GO',
  });
  await withTempRepo({ candidates: [smokeFailure] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'NO-GO');
  });

  const highFinding = baseCandidate({
    highFindings: 1,
    disposition: 'NO-GO',
  });
  await withTempRepo({ candidates: [highFinding] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'NO-GO');
  });
});

test('candidate evidence must exist, remain regular and contained, and match its digest', async () => {
  const missingArtifact = baseCandidate();
  await withTempRepo({ candidates: [missingArtifact] }, async (tempRoot) => {
    unlinkSync(
      join(
        tempRoot,
        missingArtifact.attempt_accounting.current_attempt.evidence_path,
      ),
    );
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('evidence artifact path must resolve to a readable regular file'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const mismatchedArtifact = baseCandidate();
  await withTempRepo({ candidates: [mismatchedArtifact] }, async (tempRoot) => {
    writeFileSync(
      join(
        tempRoot,
        mismatchedArtifact.attempt_accounting.current_attempt.evidence_path,
      ),
      'tampered\n',
      'utf8',
    );
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('evidence artifact sha256 must match the recorded bytes'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const absoluteArtifact = baseCandidate();
  absoluteArtifact.evidence.artifacts[0].path = '/tmp/evil.log';
  await withTempRepo({ candidates: [absoluteArtifact] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('evidence artifact paths must be relative to the repository root'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const traversalArtifact = baseCandidate();
  traversalArtifact.evidence.artifacts[0].path =
    `${traversalArtifact.evidence.directory}/../escape.log`;
  await withTempRepo({ candidates: [traversalArtifact] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('evidence artifact paths must not traverse outside the declared evidence directory'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const outsideArtifact = baseCandidate();
  outsideArtifact.evidence.artifacts[0].path =
    `${candidateDir('runtime-admission-ai-pg', 1)}/runtime-admission.json`;
  await withTempRepo({ candidates: [outsideArtifact] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('evidence artifacts must stay inside candidate.evidence.directory'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const symlinkArtifact = baseCandidate();
  await withTempRepo({ candidates: [symlinkArtifact] }, async (tempRoot) => {
    const artifactPath = join(
      tempRoot,
      symlinkArtifact.attempt_accounting.current_attempt.evidence_path,
    );
    unlinkSync(artifactPath);
    symlinkSync(
      join(
        tempRoot,
        candidateDir('runtime-admission-ai-pg', 1),
        'runtime-admission.json',
      ),
      artifactPath,
    );
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('evidence artifact path must resolve to a readable regular file'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const absoluteEvidenceDirectory = baseCandidate();
  absoluteEvidenceDirectory.evidence.directory = join(
    os.tmpdir(),
    'runtime-admission-absolute-evidence-dir',
  );
  await withTempRepo({ candidates: [absoluteEvidenceDirectory] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('candidate.evidence.directory must stay inside the repository root'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('readiness overclaims and schema-invalid truthy values are rejected before authorization', async () => {
  const overclaim = baseCandidate();
  overclaim.disposition.profile = 'DEMO_READY_LOCAL';
  overclaim.evidence.final_profile_verdict = 'DEMO_READY_LOCAL';
  await withTempRepo({ candidates: [overclaim] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('must never imply DEMO_READY_LOCAL'),
      ),
    );
    assert.notEqual(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
  });

  const invalidShape = baseCandidate();
  invalidShape.test_data.approved = 'yes';
  invalidShape.contracts.reviewed_contracts =
    'contracts/compatibility/cybrik-suite-alert-context-packet.v1.manifest.json';
  invalidShape.open_findings.critical = -1;
  invalidShape.disposition.rationale = '';
  await withTempRepo({ candidates: [invalidShape] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('schema')));
    assert.ok(
      report.errors.some((error) => error.includes('test_data/approved')),
    );
    assert.ok(
      report.errors.some((error) =>
        error.includes('contracts/reviewed_contracts'),
      ),
    );
    assert.ok(
      report.errors.some((error) => error.includes('open_findings/critical')),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('candidate directory identity and series identity cannot reopen a prior NO-GO ordinal', async () => {
  const candidate = baseCandidate();
  await withTempRepo({
    candidates: [candidate],
    extraWrites: [
      {
        kind: 'json',
        dir: 'docs/uat/candidates/reopened-r1',
        path: 'docs/uat/candidates/reopened-r1/runtime-admission.json',
        value: candidate,
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('parent directory must equal candidate_id'),
      ),
    );
    assert.ok(
      report.errors.some((error) =>
        error.includes('candidate_id must be unique across the registry'),
      ),
    );
    assert.ok(
      report.errors.some((error) =>
        error.includes('series_id and attempt_ordinal must be unique'),
      ),
    );
  });
});

test('failure history must match the exact prior candidate and preserve the original series budget', async () => {
  const seriesId = 'runtime-admission-ai-pg';
  const priorPath = currentAttemptArtifact(seriesId, 1);
  const r1 = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 2,
    currentStatus: 'failed',
    executionAuthorized: false,
    passedChecks: 18,
    failedChecks: 1,
    disposition: 'NO-GO',
  });
  const r2 = baseCandidate({
    seriesId,
    ordinal: 2,
    maxAttempts: 3,
    history: [
      {
        candidate_id: candidateId(seriesId, 1),
        attempt_ordinal: 1,
        executed_checks: 19,
        passed_checks: 17,
        failed_checks: 2,
        disposition: 'NO-GO',
        evidence_path: priorPath,
        evidence_sha256: sha256('attempt 1\n'),
      },
    ],
  });

  await withTempRepo({ candidates: [r1, r2] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('max_attempts must match the first candidate in the series'),
      ),
    );
    assert.ok(
      report.errors.some((error) =>
        error.includes('failure_history counts must match the referenced prior candidate'),
      ),
    );
  });
});

test('failure history cannot cite evidence without the referenced prior candidate record', async () => {
  const seriesId = 'runtime-admission-ai-pg';
  const priorPath = currentAttemptArtifact(seriesId, 1);
  const r2 = baseCandidate({
    seriesId,
    ordinal: 2,
    history: [
      {
        candidate_id: candidateId(seriesId, 1),
        attempt_ordinal: 1,
        executed_checks: 19,
        passed_checks: 18,
        failed_checks: 1,
        disposition: 'NO-GO',
        evidence_path: priorPath,
        evidence_sha256: sha256('attempt 1\n'),
      },
    ],
  });

  await withTempRepo({
    candidates: [r2],
    extraWrites: [
      {
        kind: 'text',
        dir: evidenceDir(seriesId, 1),
        path: priorPath,
        value: 'attempt 1\n',
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('must resolve to a registry record'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('the registry cannot hold two independently authorized runtime candidates', async () => {
  const first = baseCandidate({
    seriesId: 'runtime-admission-ai-pg',
    ordinal: 1,
  });
  const second = baseCandidate({
    seriesId: 'runtime-admission-ai-pg-b',
    ordinal: 1,
  });

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate'),
      ),
    );
    assert.equal(
      report.candidates.filter(
        (candidateReport) =>
          candidateReport.derivedDisposition === 'RUNTIME_AUTHORIZED',
      ).length,
      0,
    );
  });
});

test('a failed smoke cannot hide an unrecorded or held prerequisite smoke', async () => {
  const candidate = baseCandidate({
    authorizationSmoke: 'fail',
    disposition: 'NO-GO',
  });
  candidate.negative_smoke.tenant_isolation = [];
  candidate.negative_smoke.secret_boundary[0].status = 'hold';

  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('tenant-isolation smoke must contain at least one recorded check'),
      ),
    );
    assert.ok(
      report.errors.some((error) =>
        error.includes('secret-boundary smoke must be pass before runtime admission'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'NO-GO');
  });
});
