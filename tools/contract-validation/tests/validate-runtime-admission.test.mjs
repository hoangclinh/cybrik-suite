import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import {
  expectedCandidateFields,
  expectedRepositories,
  isMainModule,
  validateRuntimeAdmission as validateRuntimeAdmissionRaw,
} from '../validate-runtime-admission.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const SCHEMA_PATH = 'docs/uat/runtime-admission.schema.json';
const WITHDRAWAL_SCHEMA_PATH = 'docs/uat/runtime-authorization-withdrawal.schema.json';
const README_PATH = 'docs/uat/candidates/README.md';
const TEMPLATE_PATH = 'docs/uat/templates/runtime-admission.hold.json';
const LINEAGE_POLICY_PATH = 'docs/uat/runtime-admission-lineage-policy.json';

const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const stableWriteJson = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const committedLineagePolicy = () => JSON.parse(read(LINEAGE_POLICY_PATH));
// Every temp repo is seeded with the committed legacy candidates and sealed
// predecessors, so candidate-file counts are relative to that seeded floor.
const seededCandidateCount = () => {
  const policy = committedLineagePolicy();
  return policy.legacy_candidates.length + policy.sealed_predecessors.length;
};
const validateRuntimeAdmission = async (options = {}) => {
  if (options.root && options.root !== ROOT && !Object.hasOwn(
    options,
    'pinnedLineagePolicy',
  )) {
    let policy = { allowed_objectives: [], sealed_predecessors: [] };
    try {
      policy = JSON.parse(readFileSync(resolve(options.root, LINEAGE_POLICY_PATH), 'utf8'));
    } catch {
      // Invalid-policy tests still supply explicit empty pins rather than self-pinning in code.
    }
    return validateRuntimeAdmissionRaw({
      ...options,
      pinnedLineagePolicy: {
        allowed_objectives: policy.allowed_objectives ?? [],
        sealed_predecessors: policy.sealed_predecessors ?? [],
      },
    });
  }
  return validateRuntimeAdmissionRaw(options);
};

const HEX_40 = '0123456789abcdef0123456789abcdef01234567';
const TREE_40 = '89abcdef0123456789abcdef0123456789abcdef';
const SOC_SHA = '1111111111111111111111111111111111111111';
const CYBER_SHA = '2222222222222222222222222222222222222222';
const FABRIC_SHA = '3333333333333333333333333333333333333333';
const TEST_SERIES = 'aaa-test-runtime-admission';
const RECOVERY_SERIES = 'aaa-test-runtime-recovery';

const candidateId = (seriesId, ordinal) => `${seriesId}-r${ordinal}`;
const candidateDir = (seriesId, ordinal) => `docs/uat/candidates/${candidateId(seriesId, ordinal)}`;
const evidenceDir = (seriesId, ordinal) => `${candidateDir(seriesId, ordinal)}/evidence`;
const currentAttemptArtifact = (seriesId, ordinal) => `${evidenceDir(seriesId, ordinal)}/05-attempt-accounting.json`;
const candidateRecordPath = (seriesId, ordinal) => `${candidateDir(seriesId, ordinal)}/runtime-admission.json`;
const withdrawalRecordPath = (seriesId, ordinal) => `${candidateDir(seriesId, ordinal)}/runtime-authorization-withdrawal.json`;
const WITHDRAWAL_TRUST_PATH = 'docs/uat/runtime-authorization-withdrawal-trust.json';
const MASTER_AUTHORIZATION_TRUST_PATH =
  'integration/compose/soc-ai-fabric-alert-context-mtls/authorization-trust.json';
const WITHDRAWAL_NAMESPACE = 'cybrik-uat-runtime-withdrawal-v1';
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

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
  seriesId = TEST_SERIES,
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
  evidenceContent,
} = {}) => {
  const resolvedEvidenceContent =
    evidenceContent ?? `attempt ${seriesId} ${ordinal}\n`;
  const executedChecks = passedChecks + failedChecks;
  const dir = evidenceDir(seriesId, ordinal);
  const attemptPath = currentAttemptArtifact(seriesId, ordinal);
  const attemptSha = sha256(resolvedEvidenceContent);
  const candidate = {
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
      objective_lineage: {
        capability_id: 'cybrik.test.runtime-admission',
        objective_id: seriesId,
        historical_prerequisites: [],
      },
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
  Object.defineProperty(candidate, '__testEvidenceContent', {
    value: resolvedEvidenceContent,
    enumerable: false,
    writable: true,
  });
  return candidate;
};

const recoverySeries = ({
  reviewStatus = 'pending',
  executionAuthorized = false,
  disposition = executionAuthorized ? 'RUNTIME_AUTHORIZED' : 'HOLD',
  correctionContent = 'reviewed command correction\n',
} = {}) => {
  const seriesId = RECOVERY_SERIES;
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
    evidenceContent: r1Content,
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
    evidenceContent: r2Content,
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
  lineagePolicy = null,
} = {}, fn) => {
  const tempRoot = mkdtempSync(join(os.tmpdir(), 'runtime-admission-'));
  try {
    mkdirSync(join(tempRoot, 'docs/uat/candidates'), { recursive: true });
    mkdirSync(join(tempRoot, 'docs/uat/templates'), { recursive: true });
    for (const entry of [
      ...committedLineagePolicy().legacy_candidates,
      ...committedLineagePolicy().sealed_predecessors,
    ]) {
      const sourceDir = resolve(ROOT, dirname(entry.record_path));
      cpSync(sourceDir, join(tempRoot, dirname(entry.record_path)), {
        recursive: true,
      });
    }
    const records = [
      ...committedLineagePolicy().legacy_candidates.map((entry) =>
        JSON.parse(read(entry.record_path)),
      ),
      ...committedLineagePolicy().sealed_predecessors.map((entry) =>
        JSON.parse(read(entry.record_path)),
      ),
      ...candidates,
    ];
    for (const record of records) {
      for (const reference of record.contracts.reviewed_contracts) {
        if (!reference.startsWith('cybrik-suite:')) continue;
        const relativePath = reference.slice('cybrik-suite:'.length);
        const sourcePath = resolve(ROOT, relativePath);
        if (!sourcePath.startsWith(`${ROOT}/`)) continue;
        try {
          const stats = lstatSync(sourcePath);
          if (!stats.isFile()) continue;
        } catch {
          continue;
        }
        const targetPath = join(tempRoot, relativePath);
        mkdirSync(dirname(targetPath), { recursive: true });
        cpSync(sourcePath, targetPath);
      }
    }
    writeFileSync(join(tempRoot, SCHEMA_PATH), read(SCHEMA_PATH), 'utf8');
    writeFileSync(
      join(tempRoot, WITHDRAWAL_SCHEMA_PATH),
      read(WITHDRAWAL_SCHEMA_PATH),
      'utf8',
    );
    writeFileSync(join(tempRoot, README_PATH), read(README_PATH), 'utf8');
    stableWriteJson(join(tempRoot, TEMPLATE_PATH), templateRecord());
    stableWriteJson(
      join(tempRoot, LINEAGE_POLICY_PATH),
      lineagePolicy ?? lineagePolicyForCurrentCandidates(candidates),
    );
    const sealedCandidateIds = new Set(
      committedLineagePolicy().legacy_candidates.map((entry) => entry.candidate_id),
    );
    for (const candidate of candidates) {
      if (sealedCandidateIds.has(candidate.candidate_id)) continue;
      const dir = join(tempRoot, candidateDir(candidate.attempt_accounting.series_id, candidate.attempt_accounting.attempt_ordinal));
      const evDir = join(tempRoot, evidenceDir(candidate.attempt_accounting.series_id, candidate.attempt_accounting.attempt_ordinal));
      mkdirSync(dir, { recursive: true });
      mkdirSync(evDir, { recursive: true });
      writeFileSync(
        join(tempRoot, candidate.attempt_accounting.current_attempt.evidence_path),
        candidate.__testEvidenceContent,
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

const terminalRecoverySeries = () => {
  const candidates = committedLineagePolicy().legacy_candidates.map(
    (entry) => JSON.parse(read(entry.record_path)),
  );
  return {
    seriesId: candidates[0].attempt_accounting.series_id,
    r1: candidates[0],
    r2: candidates[1],
    r3: candidates[2],
    extraWrites: [],
  };
};

const lineagePolicyFor = (candidates, {
  capabilityId = 'cybrik.ai.durable-postgres',
  objectiveId = 'bounded-postgres-runtime-v1',
} = {}) => {
  const policy = committedLineagePolicy();
  const allowedByKey = new Map(policy.allowed_objectives.map((entry) => [
    `${entry.capability_id}\u0000${entry.objective_id}`,
    {
      ...entry,
      allowed_series_ids: new Set(entry.allowed_series_ids),
    },
  ]));
  const ensureObjective = (capability, objective) => {
    const key = `${capability}\u0000${objective}`;
    if (!allowedByKey.has(key)) {
      allowedByKey.set(key, {
        capability_id: capability,
        objective_id: objective,
        allowed_series_ids: new Set(),
      });
    }
    return allowedByKey.get(key);
  };
  ensureObjective(capabilityId, objectiveId);
  for (const candidate of candidates) {
    const lineage = candidate.attempt_accounting.objective_lineage;
    if (!lineage) continue;
    ensureObjective(lineage.capability_id, lineage.objective_id)
      .allowed_series_ids.add(candidate.attempt_accounting.series_id);
  }
  policy.allowed_objectives = [...allowedByKey.values()].map((entry) => ({
    capability_id: entry.capability_id,
    objective_id: entry.objective_id,
    allowed_series_ids: [...entry.allowed_series_ids].sort(),
  }));
  return policy;
};

const lineagePolicyForCurrentCandidates = (candidates) => lineagePolicyFor(candidates);

const historicalPrerequisite = (candidate) => ({
  candidate_id: candidate.candidate_id,
  record_path: candidateRecordPath(
    candidate.attempt_accounting.series_id,
    candidate.attempt_accounting.attempt_ordinal,
  ),
  record_sha256: sha256(stableJson(candidate)),
  evidence_path: candidate.attempt_accounting.current_attempt.evidence_path,
  evidence_sha256: candidate.attempt_accounting.current_attempt.evidence_sha256,
  evidence_use: 'historical_prerequisite',
});

const sealedBrowserPredecessor = () => ({
  candidate_id: 'browser-integrated-uat-bridge-r1',
  record_path:
    'docs/uat/candidates/browser-integrated-uat-bridge-r1/runtime-admission.json',
  record_sha256: 'b463b6032a69b68958cd6a470a5a1ac8976ae6778bdb26192a13c5009128e578',
  evidence_path:
    'docs/uat/candidates/browser-integrated-uat-bridge-r1/G-U2B-POSTGRES-RED-RUNTIME-RESULT-R1.md',
  evidence_sha256: '24d65a67b3e916988114542342bd5411ef87081b28d972d41b25e6d0a94388fe',
  evidence_use: 'sealed_predecessor',
});

// The one topology rehearsal the sealed topology policy admits. Any other
// record_id is an unsealed rehearsal and must never satisfy the prerequisite.
const SEALED_TOPOLOGY_RECORD_ID = 'postgres-loopback-internal-v1-r1';
const topologyRehearsalDir = (recordId) => `docs/uat/topology-rehearsals/${recordId}`;
const topologyRehearsalRecordPath = (recordId) =>
  `${topologyRehearsalDir(recordId)}/topology-rehearsal.json`;

const topologyPrerequisite = ({
  recordId = SEALED_TOPOLOGY_RECORD_ID,
  resultSha256 = '1'.repeat(64),
  manifestSha256 = '2'.repeat(64),
  evidenceUse = 'non_authorizing_preflight',
} = {}) => ({
  record_id: recordId,
  capability_id: 'cybrik.suite.runtime-topology',
  objective_id: 'postgres-loopback-internal-v1',
  result_path: `${topologyRehearsalDir(recordId)}/result.md`,
  result_sha256: resultSha256,
  evidence_manifest_path: `${topologyRehearsalDir(recordId)}/evidence-manifest.json`,
  evidence_manifest_sha256: manifestSha256,
  evidence_use: evidenceUse,
});

// Builds the single closed TOPOLOGY_PASS rehearsal record the dedicated policy
// permits, in the exact shape docs/uat/topology-rehearsal.schema.json requires,
// plus the artifact bytes its digests are taken over.
const closedTopologyRehearsal = ({
  recordId = SEALED_TOPOLOGY_RECORD_ID,
} = {}) => {
  const directory = topologyRehearsalDir(recordId);
  const recordPath = topologyRehearsalRecordPath(recordId);
  const diagnosisContent = '# bounded loopback topology diagnosis\n';
  const reviewContent = '# independent review of the bounded topology plan\n';
  const grantContent = '# founder grant for one bounded topology rehearsal\n';
  const signatureContent =
    '-----BEGIN SSH SIGNATURE-----\nsynthetic-detached-sshsig\n-----END SSH SIGNATURE-----\n';
  const resultContent =
    '# TOPOLOGY_PASS: 127.0.0.1:15433 reachable, internal-only, torn down\n';
  const resultReviewContent = '# local review of the closed topology result\n';
  const manifestValue = {
    schema_version: '1.0.0',
    record_id: recordId,
    external_bytes_ci_verified: false,
    locally_verified: true,
    result_sha256: sha256(resultContent),
  };
  const manifestContent = stableJson(manifestValue);

  const citedArtifacts = topologyPrerequisite({
    recordId,
    resultSha256: sha256(resultContent),
    manifestSha256: sha256(manifestContent),
  });
  const artifactFiles = [
    { kind: 'diagnosis', path: `${directory}/01-diagnosis.md`, content: diagnosisContent },
    {
      kind: 'independent_review',
      path: `${directory}/02-independent-review.md`,
      content: reviewContent,
    },
    { kind: 'grant', path: `${directory}/03-grant.md`, content: grantContent },
    {
      kind: 'authorization_signature',
      path: `${directory}/03-grant.md.sig`,
      content: signatureContent,
    },
    { kind: 'result', path: citedArtifacts.result_path, content: resultContent },
    {
      kind: 'evidence_manifest',
      path: citedArtifacts.evidence_manifest_path,
      content: manifestContent,
    },
    {
      kind: 'result_review',
      path: `${directory}/04-result-review.md`,
      content: resultReviewContent,
    },
  ];
  const artifacts = artifactFiles.map((artifact) => ({
    kind: artifact.kind,
    path: artifact.path,
    sha256: sha256(artifact.content),
  }));
  const grantArtifact = artifacts.find((artifact) => artifact.kind === 'grant');
  const signatureArtifact = artifacts.find(
    (artifact) => artifact.kind === 'authorization_signature',
  );

  const record = {
    schema_version: '1.0.0',
    record_id: citedArtifacts.record_id,
    recorded_at: '2026-08-03T00:00:00Z',
    identity: {
      capability_id: citedArtifacts.capability_id,
      objective_id: citedArtifacts.objective_id,
    },
    attempt: {
      series_id: 'postgres-loopback-internal-v1',
      attempt_ordinal: 1,
      max_attempts: 1,
      phase: 'closed',
      execution_authorized: false,
      attempt_consumed: true,
      outcome: 'TOPOLOGY_PASS',
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
        executable_sha256: '4'.repeat(64),
        argv: ['-z', '-w', '5', '127.0.0.1', '15433'],
      },
    },
    production_exclusion: {
      no_production_credentials: true,
      no_production_configuration: true,
      no_production_data: true,
      no_production_traffic: true,
    },
    authorization: {
      signer: 'FOUNDER',
      namespace: 'cybrik-uat-topology-rehearsal-v1',
      grant_path: grantArtifact.path,
      grant_sha256: grantArtifact.sha256,
      signature_path: signatureArtifact.path,
      signature_sha256: signatureArtifact.sha256,
      allowed_signers_path: 'docs/uat/topology-rehearsal-allowed-signers',
      allowed_signers_sha256: sha256(read('docs/uat/topology-rehearsal-allowed-signers')),
      trust_path: 'docs/uat/topology-rehearsal-authorization-trust.json',
    },
    evidence: {
      directory,
      external_bytes_ci_verified: false,
      artifacts,
      result_controls: {
        teardown_verified: true,
        residual_resources: 0,
        external_manifest_locally_verified: true,
      },
    },
    disposition: {
      profile: 'HOLD',
      rationale:
        'Bounded topology-only rehearsal closed with its single attempt consumed; it authorizes no runtime execution.',
    },
  };

  // Future schema/validator surface: a successor must pin the exact rehearsal
  // record bytes, not only the result and manifest bytes it cites. Until that
  // lands these two fields are unknown to the schema, so every test that builds
  // a valid topology prerequisite stays RED by design.
  const prerequisite = {
    ...citedArtifacts,
    record_path: recordPath,
    record_sha256: sha256(stableJson(record)),
  };

  return {
    prerequisite,
    // The same prerequisite in the shape today's schema accepts: result and
    // manifest pins only. Tests that target a control unrelated to the record
    // binding cite this one, so an unimplemented pin cannot mask them.
    citedPrerequisite: citedArtifacts,
    record,
    recordPath,
    directory,
    extraWrites: [
      ...artifactFiles.map((artifact) => ({
        kind: 'text',
        dir: directory,
        path: artifact.path,
        value: artifact.content,
      })),
      {
        kind: 'json',
        dir: directory,
        path: recordPath,
        value: record,
      },
    ],
  };
};

const runtimeAuthorizationWithdrawal = (
  candidate,
  {
    recordedAt = '2026-08-04T00:00:00Z',
    rationale = 'Authorization withdrawn after closure proof.',
    targetRecordSha256 = sha256(stableJson(candidate)),
  } = {},
) => {
  const seriesId = candidate.attempt_accounting.series_id;
  const ordinal = candidate.attempt_accounting.attempt_ordinal;
  const recordPath = withdrawalRecordPath(seriesId, ordinal);
  const allowedSignersPath = `${candidate.evidence.directory}/withdrawal-allowed-signers`;
  const signaturePath = `${recordPath}.sig`;
  return {
    allowedSignersPath,
    recordPath,
    signaturePath,
    trustPath: WITHDRAWAL_TRUST_PATH,
    install(tempRoot) {
      const keyPath = join(tempRoot, '.withdrawal-test-key');
      execFileSync('/usr/bin/ssh-keygen', [
        '-q', '-t', 'ed25519', '-N', '', '-f', keyPath,
      ]);
      const [keyType, encodedKey] = readFileSync(`${keyPath}.pub`, 'utf8')
        .trim()
        .split(/\s+/u);
      const allowedSigners = `FOUNDER namespaces="${WITHDRAWAL_NAMESPACE}" ${keyType} ${encodedKey}\n`;
      const allowedSignersSha256 = sha256(allowedSigners);
      const keyFingerprint = `SHA256:${createHash('sha256')
        .update(Buffer.from(encodedKey, 'base64'))
        .digest('base64')
        .replace(/=+$/u, '')}`;
      const record = {
        schema_version: '1.0.0',
        withdrawal_id: `${candidate.candidate_id}-withdrawal-r1`,
        recorded_at: recordedAt,
        target: {
          candidate_id: candidate.candidate_id,
          record_path: candidateRecordPath(seriesId, ordinal),
          record_sha256: targetRecordSha256,
          series_id: seriesId,
          attempt_ordinal: ordinal,
          authorization_evidence_path:
            candidate.attempt_accounting.current_attempt.evidence_path,
          authorization_evidence_sha256:
            candidate.attempt_accounting.current_attempt.evidence_sha256,
        },
        observed_attempt: structuredClone(
          candidate.attempt_accounting.current_attempt,
        ),
        decision: {
          kind: 'WITHDRAW_UNUSED_AUTHORIZATION',
          actor: 'CODEX_GOVERNOR',
          scope: 'bounded_nonproduction_runtime_only',
        },
        external_packet_closure: {
          mode: 'no_signed_packet_issued_attested',
          assertion: 'no_signed_packet_issued_for_exact_target',
          signer: 'FOUNDER',
          namespace: WITHDRAWAL_NAMESPACE,
          allowed_signers_path: allowedSignersPath,
          allowed_signers_sha256: allowedSignersSha256,
          signature_path: signaturePath,
        },
        effect: {
          authorization_state: 'withdrawn',
          effective_profile: 'HOLD',
          series_state: 'closed',
          objective_terminal: false,
          runtime_credit: 'none',
          authorization_reusable: false,
          production_authority: 'none_founder_only',
        },
        rationale,
        limitations: [
          'No runtime, UAT, release, deployment or production credit.',
        ],
      };
      mkdirSync(join(tempRoot, dirname(allowedSignersPath)), { recursive: true });
      writeFileSync(join(tempRoot, allowedSignersPath), allowedSigners, 'utf8');
      stableWriteJson(join(tempRoot, WITHDRAWAL_TRUST_PATH), {
        schema: 'CYBRIK-UAT-RUNTIME-WITHDRAWAL-TRUST/v1',
        signer: 'FOUNDER',
        namespace: WITHDRAWAL_NAMESPACE,
        key_type: keyType,
        key_fingerprint: keyFingerprint,
        allowed_signers_sha256: allowedSignersSha256,
      });
      mkdirSync(join(tempRoot, dirname(MASTER_AUTHORIZATION_TRUST_PATH)), {
        recursive: true,
      });
      stableWriteJson(join(tempRoot, MASTER_AUTHORIZATION_TRUST_PATH), {
        allowed_signers_sha256: '0'.repeat(64),
        key_fingerprint: keyFingerprint,
        key_type: keyType,
        namespace: 'cybrik-uat-soc-ai-fabric-v1',
        python_sha256: '0'.repeat(64),
        schema: 'CYBRIK-UAT-SSH-AUTHORIZATION-TRUST/v1',
        signer: 'FOUNDER',
      });
      stableWriteJson(join(tempRoot, recordPath), record);
      execFileSync('/usr/bin/ssh-keygen', [
        '-Y', 'sign', '-f', keyPath, '-n', WITHDRAWAL_NAMESPACE,
        join(tempRoot, recordPath),
      ], { stdio: 'ignore' });
    },
  };
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

test('committed lineage policy seals exactly the terminal PostgreSQL R1/R2/R3 records', () => {
  const policy = JSON.parse(read(LINEAGE_POLICY_PATH));
  assert.equal(policy.schema_version, '1.1.0');
  assert.deepEqual(policy.allowed_objectives, [
    {
      capability_id: 'cybrik.ai.durable-postgres',
      objective_id: 'bounded-postgres-runtime-v1',
      allowed_series_ids: ['runtime-admission-ai-pg'],
    },
    {
      capability_id: 'cybrik.suite.golden-workflow',
      objective_id: 'golden-uat-v1',
      allowed_series_ids: [
        'browser-integrated-uat-bridge',
        'runtime-admission-soc-ai-lifecycle-mtls',
      ],
    },
  ]);
  assert.deepEqual(
    policy.legacy_candidates.map((entry) => entry.candidate_id),
    [
      'runtime-admission-ai-pg-r1',
      'runtime-admission-ai-pg-r2',
      'runtime-admission-ai-pg-r3',
    ],
  );
  for (const entry of policy.legacy_candidates) {
    assert.equal(entry.series_id, 'runtime-admission-ai-pg');
    assert.equal(entry.capability_id, 'cybrik.ai.durable-postgres');
    assert.equal(entry.objective_id, 'bounded-postgres-runtime-v1');
    assert.equal(entry.recorded_disposition, 'NO-GO');
    assert.equal(sha256(read(entry.record_path)), entry.record_sha256);
  }
  assert.deepEqual(policy.sealed_predecessors, [{
    candidate_id: 'browser-integrated-uat-bridge-r1',
    series_id: 'browser-integrated-uat-bridge',
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    record_path:
      'docs/uat/candidates/browser-integrated-uat-bridge-r1/runtime-admission.json',
    record_sha256: 'b463b6032a69b68958cd6a470a5a1ac8976ae6778bdb26192a13c5009128e578',
    recorded_disposition: 'HOLD',
    recorded_current_attempt_status: 'not_run',
  }]);
});

test('an allowed objective still rejects every unlisted runtime-admission series', async () => {
  const candidate = baseCandidate({
    seriesId: 'unlisted-golden-successor',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };
  await withTempRepo({
    candidates: [candidate],
    lineagePolicy: committedLineagePolicy(),
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'objective_lineage series_id must be explicitly allowlisted for its capability/objective',
    )));
  });
});

test('sealed predecessor references must match the immutable HOLD not-run policy pin', async () => {
  const candidate = baseCandidate({
    seriesId: 'unlisted-sealed-successor',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: {
      ...sealedBrowserPredecessor(),
      record_sha256: '0'.repeat(64),
    },
  };
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'sealed_predecessor record path and digest must match the immutable lineage policy',
    )));
  });
});

test('topology prerequisite identity, result and manifest digests fail closed on drift', async () => {
  const resultContent = 'topology pass result\n';
  const manifestContent = '{"external_evidence":"locally-reviewed"}\n';
  const candidate = baseCandidate({
    seriesId: 'unlisted-topology-successor',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: sealedBrowserPredecessor(),
    topology_prerequisite: topologyPrerequisite({
      resultSha256: '0'.repeat(64),
      manifestSha256: sha256(manifestContent),
    }),
  };
  await withTempRepo({
    candidates: [candidate],
    extraWrites: [
      {
        kind: 'text',
        dir: 'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1',
        path: candidate.attempt_accounting.objective_lineage.topology_prerequisite.result_path,
        value: resultContent,
      },
      {
        kind: 'text',
        dir: 'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1',
        path: candidate.attempt_accounting.objective_lineage.topology_prerequisite.evidence_manifest_path,
        value: manifestContent,
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'topology_prerequisite result SHA-256 must match committed result bytes',
    )));
  });
});

test('topology prerequisite bytes cannot be promoted into runtime execution evidence', async () => {
  const resultContent = 'topology pass result reused as execution evidence\n';
  const resultSha256 = sha256(resultContent);
  const manifestContent = '{"external_evidence":"locally-reviewed"}\n';
  const candidate = baseCandidate({
    seriesId: 'unlisted-topology-reuse',
    executionAuthorized: false,
    disposition: 'HOLD',
    evidenceContent: resultContent,
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: sealedBrowserPredecessor(),
    topology_prerequisite: topologyPrerequisite({
      resultSha256,
      manifestSha256: sha256(manifestContent),
    }),
  };
  await withTempRepo({
    candidates: [candidate],
    extraWrites: [
      {
        kind: 'text',
        dir: 'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1',
        path: candidate.attempt_accounting.objective_lineage.topology_prerequisite.result_path,
        value: resultContent,
      },
      {
        kind: 'text',
        dir: 'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1',
        path: candidate.attempt_accounting.objective_lineage.topology_prerequisite.evidence_manifest_path,
        value: manifestContent,
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'topology_prerequisite bytes must never be reused as runtime execution evidence',
    )));
  });
});

test('a future successor citing the sealed predecessor and a closed topology rehearsal validates clean', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-successor';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: sealedBrowserPredecessor(),
    topology_prerequisite: topology.prerequisite,
  };

  await withTempRepo({
    candidates: [candidate],
    extraWrites: topology.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.candidateFiles, seededCandidateCount() + 1);
    const successor = report.candidates.find(
      (candidateReport) => candidateReport.candidateId === candidateId(seriesId, 1),
    );
    assert.equal(successor.declaredDisposition, 'HOLD');
    assert.equal(successor.derivedDisposition, 'HOLD');
  });
});

// Every negative test below states the one message it is about, and fails with
// the observed error list when that message is absent, so no assertion can be
// satisfied — or hidden — by an unrelated schema or lineage error.
const assertFinding = (report, expected) => {
  assert.ok(
    report.errors.some((error) => error.includes(expected)),
    `expected finding ${JSON.stringify(expected)}; observed errors:\n${report.errors.join('\n') || '(none)'}`,
  );
};

const assertNoFinding = (report, unexpected) => {
  assert.ok(
    !report.errors.some((error) => error.includes(unexpected)),
    `unexpected finding ${JSON.stringify(unexpected)}; observed errors:\n${report.errors.join('\n')}`,
  );
};

// Same otherwise-valid successor as the clean path above, mutated at exactly one
// point: the cited predecessor evidence digest. The sealed record itself is
// untouched, so only the successor's claim about the sealed HOLD/not_run
// evidence drifts, and that alone must fail closed. This control is about the
// predecessor, not the topology record binding, so it cites the prerequisite in
// the shape today's schema accepts.
test('a successor citing drifted sealed predecessor evidence fails closed', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-drifted-predecessor';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: {
      ...sealedBrowserPredecessor(),
      evidence_sha256: '0'.repeat(64),
    },
    topology_prerequisite: topology.citedPrerequisite,
  };

  await withTempRepo({
    candidates: [candidate],
    extraWrites: topology.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: sealed_predecessor must preserve the exact HOLD/not_run predecessor evidence`,
    );
  });
});

// ---------------------------------------------------------------------------
// RED checkpoint: independent-review findings.
//
// The findings below are not implemented yet. Each intended control has exactly
// one message string, declared once here and asserted verbatim by exactly one
// negative test, so no test can pass on an unrelated schema or lineage error.
// ---------------------------------------------------------------------------

// Finding 1: execution authority must be earned by both prerequisites, and the
// one already-committed authorized record may survive only as an exact-byte
// exemption keyed to its immutable candidate bytes.
const AUTHORIZED_PREREQUISITES_FINDING =
  'runtime execution authorization requires both sealed_predecessor and topology_prerequisite';
const GRANDFATHERED_BYTES_FINDING =
  'grandfathered runtime authorization applies only to the exact immutable candidate bytes';
// Finding 2: the topology prerequisite must bind the sealed rehearsal record
// itself, not merely the result and manifest bytes it cites.
const TOPOLOGY_RECORD_ID_FINDING =
  `topology_prerequisite record_id must equal the sealed ${SEALED_TOPOLOGY_RECORD_ID} rehearsal`;
const TOPOLOGY_RECORD_PATH_FINDING =
  'topology_prerequisite record_path must equal the committed topology rehearsal record path';
const TOPOLOGY_RECORD_BYTES_FINDING =
  'topology_prerequisite record_sha256 must match committed topology record bytes';
// Finding 3: caller-supplied pins must never be able to relax the validator's
// own immutable lineage seal, in either direction.
const SEALED_PIN_FINDING =
  'sealed_predecessors must exactly match the validator-immutable sealed set regardless of supplied pins';
const OBJECTIVE_PIN_FINDING =
  'lineage policy pins must preserve every validator-immutable allowed objective series';

const GRANDFATHERED_MTLS_SERIES = 'runtime-admission-soc-ai-lifecycle-mtls';
const GRANDFATHERED_MTLS_RECORD_PATH = candidateRecordPath(GRANDFATHERED_MTLS_SERIES, 1);
const GRANDFATHERED_MTLS_RECORD_SHA256 =
  'a59acf23125b4ffd912f59459faa4498c7441d00ca8f21b2c148b5d0b7780ba4';

// Builds an otherwise-clean unauthorized successor that cites the sealed
// predecessor and the single closed topology rehearsal.
const topologySuccessor = (seriesId, lineageOverrides = {}) => {
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: sealedBrowserPredecessor(),
    ...lineageOverrides,
  };
  return candidate;
};

test('the committed grandfathered mTLS R1 record is pinned by exact bytes and stays valid at the default root', async () => {
  assert.equal(
    sha256(read(GRANDFATHERED_MTLS_RECORD_PATH)),
    GRANDFATHERED_MTLS_RECORD_SHA256,
  );
  const committed = JSON.parse(read(GRANDFATHERED_MTLS_RECORD_PATH));
  // The exemption exists only because this record is authorized while carrying
  // neither future prerequisite; nothing else in the registry may do that.
  assert.equal(committed.attempt_accounting.current_attempt.execution_authorized, true);
  assert.equal(committed.attempt_accounting.objective_lineage.sealed_predecessor, undefined);
  assert.equal(committed.attempt_accounting.objective_lineage.topology_prerequisite, undefined);

  const report = await validateRuntimeAdmissionRaw({ root: ROOT });
  assert.deepEqual(report.errors, []);
  const committedReport = report.candidates.find(
    (candidateReport) => candidateReport.path === GRANDFATHERED_MTLS_RECORD_PATH,
  );
  assert.equal(committedReport.declaredDisposition, 'RUNTIME_AUTHORIZED');
});

test('an execution-authorized candidate without both runtime prerequisites fails closed', async () => {
  const seriesId = 'aaa-test-authorized-without-prerequisites';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: true,
    disposition: 'RUNTIME_AUTHORIZED',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };

  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: ${AUTHORIZED_PREREQUISITES_FINDING}`,
    );
  });
});

test('an execution-authorized candidate carrying only the sealed predecessor still fails closed', async () => {
  const seriesId = 'aaa-test-authorized-sealed-only';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: true,
    disposition: 'RUNTIME_AUTHORIZED',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: sealedBrowserPredecessor(),
  };

  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: ${AUTHORIZED_PREREQUISITES_FINDING}`,
    );
  });
});

// The door the two fail-closed controls above guard must actually open: a
// successor that earns runtime authority by carrying both prerequisites, with
// nothing else about it changed, must validate clean and keep its declared
// RUNTIME_AUTHORIZED disposition. Without this test the prerequisite rule could
// be satisfied by a validator that rejects every authorized candidate.
test('an execution-authorized successor carrying both runtime prerequisites validates clean', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-authorized-with-prerequisites';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: true,
    disposition: 'RUNTIME_AUTHORIZED',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: sealedBrowserPredecessor(),
    topology_prerequisite: topology.prerequisite,
  };

  await withTempRepo({
    candidates: [candidate],
    extraWrites: topology.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.candidateFiles, seededCandidateCount() + 1);
    const successor = report.candidates.find(
      (candidateReport) => candidateReport.candidateId === candidateId(seriesId, 1),
    );
    assert.equal(successor.declaredDisposition, 'RUNTIME_AUTHORIZED');
    assert.equal(successor.derivedDisposition, 'RUNTIME_AUTHORIZED');
    assert.equal(successor.effectiveDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('the grandfathered exemption never extends to another candidate of the same mTLS series', async () => {
  const seriesId = GRANDFATHERED_MTLS_SERIES;
  const r1Content = '{"attempt":1,"result":"failed"}\n';
  const r1 = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 2,
    currentStatus: 'failed',
    executionAuthorized: false,
    passedChecks: 18,
    failedChecks: 1,
    authorizationSmoke: 'fail',
    disposition: 'NO-GO',
    evidenceContent: r1Content,
  });
  r1.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };
  const r2 = baseCandidate({
    seriesId,
    ordinal: 2,
    maxAttempts: 2,
    currentStatus: 'not_run',
    executionAuthorized: true,
    history: [
      {
        candidate_id: candidateId(seriesId, 1),
        attempt_ordinal: 1,
        executed_checks: 19,
        passed_checks: 18,
        failed_checks: 1,
        disposition: 'NO-GO',
        evidence_path: currentAttemptArtifact(seriesId, 1),
        evidence_sha256: sha256(r1Content),
      },
    ],
    disposition: 'RUNTIME_AUTHORIZED',
  });
  r2.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };

  await withTempRepo({ candidates: [r1, r2] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    // The exemption is keyed to one exact record, so the successor attempt in
    // the very same sealed series inherits no authority from it.
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 2)}: ${AUTHORIZED_PREREQUISITES_FINDING}`,
    );
  });
});

test('the grandfathered mTLS R1 exemption is void once its immutable bytes drift', async () => {
  const seriesId = GRANDFATHERED_MTLS_SERIES;
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 2,
    currentStatus: 'not_run',
    executionAuthorized: true,
    disposition: 'RUNTIME_AUTHORIZED',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };
  // Same candidate_id and same record path as the exempt record, different
  // bytes: an exemption granted by series or by identifier would admit this.
  assert.equal(candidate.candidate_id, `${GRANDFATHERED_MTLS_SERIES}-r1`);
  assert.notEqual(sha256(stableJson(candidate)), GRANDFATHERED_MTLS_RECORD_SHA256);

  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(
      report,
      `${GRANDFATHERED_MTLS_RECORD_PATH}: ${GRANDFATHERED_BYTES_FINDING}`,
    );
  });
});

test('topology_prerequisite must cite the sealed rehearsal record_id and no other', async () => {
  const topology = closedTopologyRehearsal({
    recordId: 'postgres-loopback-internal-v1-r2',
  });
  const seriesId = 'aaa-test-golden-unsealed-topology-record';
  const candidate = topologySuccessor(seriesId, {
    topology_prerequisite: topology.prerequisite,
  });

  await withTempRepo({
    candidates: [candidate],
    extraWrites: topology.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    // Everything about this rehearsal is internally consistent and closed; only
    // its identity is unsealed, and that alone must fail closed.
    assertFinding(report, `${candidateRecordPath(seriesId, 1)}: ${TOPOLOGY_RECORD_ID_FINDING}`);
  });
});

test('topology_prerequisite must pin the committed topology rehearsal record path', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-record-path';
  const candidate = topologySuccessor(seriesId, {
    topology_prerequisite: {
      ...topology.prerequisite,
      record_path: topology.prerequisite.result_path,
    },
  });

  await withTempRepo({
    candidates: [candidate],
    extraWrites: topology.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(report, `${candidateRecordPath(seriesId, 1)}: ${TOPOLOGY_RECORD_PATH_FINDING}`);
  });
});

test('topology_prerequisite fails closed on topology record drift even when result and manifest bytes hold', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-record-drift';
  const candidate = topologySuccessor(seriesId, {
    topology_prerequisite: topology.prerequisite,
  });
  // Only the rehearsal record bytes move; every artifact it cites, and every
  // digest recorded inside it, stays byte-identical.
  const driftedRecord = { ...topology.record, recorded_at: '2026-08-03T00:00:01Z' };
  assert.notEqual(sha256(stableJson(driftedRecord)), topology.prerequisite.record_sha256);
  const extraWrites = topology.extraWrites.map((write) =>
    (write.path === topology.recordPath ? { ...write, value: driftedRecord } : write));

  await withTempRepo({
    candidates: [candidate],
    extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(report, `${candidateRecordPath(seriesId, 1)}: ${TOPOLOGY_RECORD_BYTES_FINDING}`);
    assertNoFinding(report, 'topology_prerequisite result SHA-256 must match');
    assertNoFinding(report, 'topology_prerequisite evidence manifest SHA-256 must match');
  });
});

test('topology_prerequisite without the record pins is rejected by the runtime-admission schema', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-unpinned-record';
  const candidate = topologySuccessor(seriesId, {
    topology_prerequisite: Object.fromEntries(
      Object.entries(topology.prerequisite).filter(
        ([key]) => key !== 'record_path' && key !== 'record_sha256',
      ),
    ),
  });

  await withTempRepo({
    candidates: [candidate],
    extraWrites: topology.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    const schemaPointer =
      `${candidateRecordPath(seriesId, 1)}: schema /attempt_accounting/objective_lineage/topology_prerequisite`;
    assertFinding(report, `${schemaPointer} must have required property 'record_path'`);
    assertFinding(report, `${schemaPointer} must have required property 'record_sha256'`);
  });
});

// Robustness: a malformed candidate must fail closed as a reported schema
// finding, never as a validator crash. Here exactly one field of an otherwise
// valid topology prerequisite is retyped from string to number, every other
// field stays present and correct, so the only admissible outcome is a resolved
// report carrying the precise schema type finding for result_path.
test('a non-string topology_prerequisite result_path is reported, not thrown', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-nonstring-result-path';
  const candidate = topologySuccessor(seriesId, {
    topology_prerequisite: {
      ...topology.prerequisite,
      result_path: 15433,
    },
  });
  assert.equal(
    Object.keys(candidate.attempt_accounting.objective_lineage.topology_prerequisite).length,
    Object.keys(topology.prerequisite).length,
  );

  await withTempRepo({
    candidates: [candidate],
    extraWrites: topology.extraWrites,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: schema /attempt_accounting/objective_lineage/topology_prerequisite/result_path must be string`,
    );
  });
});

// Robustness: the record binding proves only that the cited bytes are the bytes
// the successor pinned. It proves nothing about their shape, so every field read
// out of them afterwards is reading untrusted structure. A malformed sealed
// rehearsal record must therefore fail closed as this reported finding, never as
// a propagated TypeError.
const TOPOLOGY_CLOSED_RECORD_FINDING =
  'topology_prerequisite must resolve to a closed non-authorizing TOPOLOGY_PASS record';

const reportWithoutThrowing = async (tempRoot, context) => {
  try {
    return await validateRuntimeAdmission({ root: tempRoot });
  } catch (error) {
    assert.fail(`${context} must be reported, not thrown: ${error?.stack ?? error}`);
  }
};

test('a sealed topology record whose bytes parse as JSON null is reported, not thrown', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-null-record';
  // Well-formed JSON, no object to read fields from. The successor pins these
  // exact bytes, so the binding holds and parsed-field validation is reached.
  const nullRecordBytes = 'null\n';
  assert.equal(JSON.parse(nullRecordBytes), null);
  const candidate = topologySuccessor(seriesId, {
    topology_prerequisite: {
      ...topology.prerequisite,
      record_sha256: sha256(nullRecordBytes),
    },
  });
  const extraWrites = topology.extraWrites.map((write) =>
    (write.path === topology.recordPath
      ? {
        kind: 'text',
        dir: topology.directory,
        path: topology.recordPath,
        value: nullRecordBytes,
      }
      : write));

  await withTempRepo({
    candidates: [candidate],
    extraWrites,
  }, async (tempRoot) => {
    const report = await reportWithoutThrowing(tempRoot, 'a null topology rehearsal record');
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: ${TOPOLOGY_CLOSED_RECORD_FINDING}`,
    );
    assertNoFinding(report, 'topology_prerequisite record_sha256 must match');
  });
});

test('a sealed topology record with non-array evidence artifacts is reported, not thrown', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-nonarray-artifacts';
  // Exactly one field of the otherwise closed, internally consistent rehearsal
  // record is retyped from array to string; the successor pins the resulting
  // exact bytes, so only the artifact-list shape is malformed.
  const malformedRecord = {
    ...topology.record,
    evidence: {
      ...topology.record.evidence,
      artifacts: 'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1',
    },
  };
  const candidate = topologySuccessor(seriesId, {
    topology_prerequisite: {
      ...topology.prerequisite,
      record_sha256: sha256(stableJson(malformedRecord)),
    },
  });
  const extraWrites = topology.extraWrites.map((write) =>
    (write.path === topology.recordPath ? { ...write, value: malformedRecord } : write));

  await withTempRepo({
    candidates: [candidate],
    extraWrites,
  }, async (tempRoot) => {
    const report = await reportWithoutThrowing(
      tempRoot,
      'a topology rehearsal record with non-array evidence artifacts',
    );
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: ${TOPOLOGY_CLOSED_RECORD_FINDING}`,
    );
    assertNoFinding(report, 'topology_prerequisite record_sha256 must match');
  });
});

// Robustness: the runtime lineage gates deliberately run over every parsed
// record, including records the schema rejected, so the sealed and topology
// byte-reuse checks read candidate arrays whose items were never proven to be
// objects. An array item that is JSON null must therefore fail closed as the
// reported Ajv item finding, never as a TypeError propagated out of an
// unguarded artifact.sha256 or historyRow.evidence_sha256 callback.
test('a null candidate evidence artifact entry is reported, not thrown', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-null-artifact-entry';
  const candidate = topologySuccessor(seriesId, {
    topology_prerequisite: topology.prerequisite,
  });
  // Both lineage prerequisites stay present and correct and the one real
  // artifact stays valid, so nothing short-circuits before the byte-reuse
  // checks and exactly one unproven array item reaches them.
  candidate.evidence.artifacts = [...candidate.evidence.artifacts, null];
  assert.equal(
    candidate.attempt_accounting.objective_lineage.sealed_predecessor.candidate_id,
    sealedBrowserPredecessor().candidate_id,
  );
  assert.deepEqual(
    candidate.attempt_accounting.objective_lineage.topology_prerequisite,
    topology.prerequisite,
  );
  assert.equal(candidate.evidence.artifacts.length, 2);
  assert.equal(candidate.evidence.artifacts[1], null);

  await withTempRepo({
    candidates: [candidate],
    extraWrites: topology.extraWrites,
  }, async (tempRoot) => {
    const report = await reportWithoutThrowing(
      tempRoot,
      'a null candidate evidence artifact entry',
    );
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: schema /evidence/artifacts/1 must be object`,
    );
  });
});

test('a null attempt_accounting failure_history entry is reported, not thrown', async () => {
  const topology = closedTopologyRehearsal();
  const seriesId = 'aaa-test-golden-topology-null-history-entry';
  const candidate = topologySuccessor(seriesId, {
    topology_prerequisite: topology.prerequisite,
  });
  // Same construction as above on the other unguarded array: the sealed and
  // topology prerequisites remain intact, and the current attempt and evidence
  // artifacts stay valid, so the only unproven structure is this history row.
  candidate.attempt_accounting.failure_history = [null];
  assert.equal(
    candidate.attempt_accounting.objective_lineage.sealed_predecessor.candidate_id,
    sealedBrowserPredecessor().candidate_id,
  );
  assert.deepEqual(
    candidate.attempt_accounting.objective_lineage.topology_prerequisite,
    topology.prerequisite,
  );
  assert.equal(candidate.attempt_accounting.failure_history[0], null);

  await withTempRepo({
    candidates: [candidate],
    extraWrites: topology.extraWrites,
  }, async (tempRoot) => {
    const report = await reportWithoutThrowing(
      tempRoot,
      'a null attempt_accounting failure_history entry',
    );
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: schema /attempt_accounting/failure_history/0 must be object`,
    );
  });
});

test('default-root validation ignores caller-supplied lineage policy pins', async () => {
  // Empty pins would void the entire seal if the caller could reach it; at the
  // default root the validator must use only its own compiled-in pins.
  const report = await validateRuntimeAdmissionRaw({
    root: ROOT,
    pinnedLineagePolicy: { allowed_objectives: [], sealed_predecessors: [] },
  });
  assert.deepEqual(report.errors, []);
});

test('a non-default root without independently supplied pins fails closed', async () => {
  await withTempRepo({ candidates: [baseCandidate()] }, async (tempRoot) => {
    const report = await validateRuntimeAdmissionRaw({ root: tempRoot });
    assertFinding(
      report,
      'non-default root requires independently supplied lineage policy pins',
    );
  });
});

test('a drifted policy cannot self-pin an additional sealed predecessor', async () => {
  const seriesId = 'aaa-test-self-pinned-sealed-enrollment';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };
  // A brand-new HOLD/not_run record enrolled as a sealed predecessor. Every
  // per-entry check it faces succeeds, so only the immutable pin can stop it.
  const driftedPolicy = lineagePolicyFor([candidate], {
    capabilityId: 'cybrik.suite.golden-workflow',
    objectiveId: 'golden-uat-v1',
  });
  driftedPolicy.sealed_predecessors = [
    ...driftedPolicy.sealed_predecessors,
    {
      candidate_id: candidate.candidate_id,
      series_id: seriesId,
      capability_id: 'cybrik.suite.golden-workflow',
      objective_id: 'golden-uat-v1',
      record_path: candidateRecordPath(seriesId, 1),
      record_sha256: sha256(stableJson(candidate)),
      recorded_disposition: 'HOLD',
      recorded_current_attempt_status: 'not_run',
    },
  ];

  await withTempRepo({
    candidates: [candidate],
    lineagePolicy: driftedPolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmissionRaw({
      root: tempRoot,
      pinnedLineagePolicy: {
        allowed_objectives: driftedPolicy.allowed_objectives,
        sealed_predecessors: driftedPolicy.sealed_predecessors,
      },
    });
    assertFinding(report, SEALED_PIN_FINDING);
  });
});

test('a drifted policy cannot self-pin away an immutable allowed objective series', async () => {
  const seriesId = 'aaa-test-self-pinned-objective-removal';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };
  const driftedPolicy = lineagePolicyFor([candidate], {
    capabilityId: 'cybrik.suite.golden-workflow',
    objectiveId: 'golden-uat-v1',
  });
  driftedPolicy.allowed_objectives = driftedPolicy.allowed_objectives.map((entry) => ({
    ...entry,
    allowed_series_ids: entry.allowed_series_ids.filter(
      (allowedSeriesId) => allowedSeriesId !== 'browser-integrated-uat-bridge',
    ),
  }));

  await withTempRepo({
    candidates: [candidate],
    lineagePolicy: driftedPolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmissionRaw({
      root: tempRoot,
      pinnedLineagePolicy: {
        allowed_objectives: driftedPolicy.allowed_objectives,
        sealed_predecessors: driftedPolicy.sealed_predecessors,
      },
    });
    assertFinding(report, OBJECTIVE_PIN_FINDING);
  });
});

test('a sealed_predecessor that resolves to no sealed record fails closed', async () => {
  const seriesId = 'aaa-test-unresolvable-sealed-predecessor';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: {
      ...sealedBrowserPredecessor(),
      candidate_id: 'aaa-test-unsealed-predecessor-r1',
    },
  };

  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: sealed_predecessor must resolve to an immutable sealed predecessor`,
    );
    // A lineage carrying only one half of the pair is incomplete regardless.
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: sealed_predecessor and topology_prerequisite must be carried together`,
    );
  });
});

test('a sealed_predecessor cannot be cited to reopen its own sealed series', async () => {
  const seriesId = 'browser-integrated-uat-bridge';
  // Ordinal 2 of the sealed series: the accounting rules of a HOLD/not_run R1
  // make such a successor unbuildable anyway, but the reopen control must fire
  // on the sealed series identity by itself.
  const candidate = baseCandidate({
    seriesId,
    ordinal: 2,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: sealedBrowserPredecessor(),
  };

  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 2)}: sealed_predecessor cannot reopen its sealed series_id`,
    );
  });
});

test('sealed predecessor bytes cannot be replayed as a successor execution evidence', async () => {
  const sealedEvidencePath =
    'docs/uat/candidates/browser-integrated-uat-bridge-r1/G-U2B-POSTGRES-RED-RUNTIME-RESULT-R1.md';
  const sealedEvidenceContent = read(sealedEvidencePath);
  assert.equal(sha256(sealedEvidenceContent), sealedBrowserPredecessor().evidence_sha256);
  const seriesId = 'aaa-test-sealed-predecessor-byte-reuse';
  const candidate = baseCandidate({
    seriesId,
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'not_run',
    executionAuthorized: false,
    disposition: 'HOLD',
    evidenceContent: sealedEvidenceContent,
  });
  candidate.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
    sealed_predecessor: sealedBrowserPredecessor(),
  };

  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assertFinding(
      report,
      `${candidateRecordPath(seriesId, 1)}: sealed_predecessor bytes must never be reused as runtime execution evidence`,
    );
  });
});

test('standalone validator rejects any attempt to grandfather a fourth legacy candidate', async () => {
  const policy = JSON.parse(read(LINEAGE_POLICY_PATH));
  policy.legacy_candidates.push({
    candidate_id: 'evil-series-r1',
    series_id: 'evil-series',
    capability_id: 'cybrik.ai.durable-postgres',
    objective_id: 'bounded-postgres-runtime-v1',
    record_path: 'docs/uat/candidates/evil-series-r1/runtime-admission.json',
    record_sha256: '0'.repeat(64),
    recorded_disposition: 'NO-GO',
  });
  const report = await validateRuntimeAdmission({
    root: ROOT,
    overrides: new Map([
      [LINEAGE_POLICY_PATH, stableJson(policy)],
    ]),
  });
  assert.ok(report.errors.some((error) => error.includes(
    'legacy_candidates must equal the sealed R1/R2/R3 set exactly',
  )));
});

test('copied repository root preserves the exact immutable legacy seal', async () => {
  const tempRoot = mkdtempSync(join(os.tmpdir(), 'runtime-admission-copy-'));
  try {
    cpSync(resolve(ROOT, 'docs/uat'), join(tempRoot, 'docs/uat'), {
      recursive: true,
    });
    const policyPath = join(tempRoot, LINEAGE_POLICY_PATH);
    const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
    policy.legacy_candidates.reverse();
    stableWriteJson(policyPath, policy);

    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'legacy_candidates must equal the sealed R1/R2/R3 set exactly',
    )));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
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
    assert.equal(report.counts.candidateFiles, seededCandidateCount() + 1);
    assert.equal(report.candidates[0].derivedDisposition, 'RUNTIME_AUTHORIZED');
  });
});

test('valid retired R1 NO-GO and authorized R2 patterns validate together', async () => {
  const seriesId = 'aaa-test-two-attempts';
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
    assert.equal(report.counts.candidateFiles, seededCandidateCount() + 2);
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
    const r3Report = report.candidates.find(
      (candidateReport) => candidateReport.candidateId === r3.candidate_id,
    );
    assert.equal(r3Report.derivedDisposition, 'HOLD');
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

test('a recovery override cannot move from max_attempts plus one to a later ordinal', async () => {
  const seriesId = 'aaa-test-history-ordinals';
  const correctionContent = 'invalid late recovery correction\n';
  const correctionPath = `${evidenceDir(seriesId, 4)}/01-command-correction.md`;
  const r4 = baseCandidate({
    seriesId,
    ordinal: 4,
    maxAttempts: 2,
    currentStatus: 'not_run',
    executionAuthorized: false,
    history: [1, 2, 3].map((ordinal) => ({
      candidate_id: candidateId(seriesId, ordinal),
      attempt_ordinal: ordinal,
      executed_checks: 1,
      passed_checks: 0,
      failed_checks: 1,
      disposition: 'NO-GO',
      evidence_path: currentAttemptArtifact(seriesId, ordinal),
      evidence_sha256: sha256(`attempt ${ordinal}\n`),
    })),
    disposition: 'HOLD',
  });
  r4.attempt_accounting.recovery_override = {
    kind: 'admitted_command_defect',
    additional_attempts: 1,
    terminal_candidate_id: candidateId(seriesId, 2),
    terminal_attempt_ordinal: 2,
    terminal_evidence_path: currentAttemptArtifact(seriesId, 2),
    terminal_evidence_sha256: sha256('attempt 2\n'),
    correction_evidence_path: correctionPath,
    correction_evidence_sha256: sha256(correctionContent),
    review_status: 'pending',
  };
  r4.evidence.artifacts.push({
    path: correctionPath,
    sha256: sha256(correctionContent),
  });

  await withTempRepo({
    candidates: [r4],
    extraWrites: [
      ...[1, 2, 3].map((ordinal) => ({
        kind: 'text',
        dir: evidenceDir(seriesId, ordinal),
        path: currentAttemptArtifact(seriesId, ordinal),
        value: `attempt ${ordinal}\n`,
      })),
      {
        kind: 'text',
        dir: evidenceDir(seriesId, 4),
        path: correctionPath,
        value: correctionContent,
      },
    ],
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'recovery_override is valid only at max_attempts + 1',
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
  const seriesId = 'aaa-test-history-ordinals';
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
  candidate.attempt_accounting.current_attempt.evidence_path =
    `${candidateDir(candidate.attempt_accounting.series_id, 1)}/runtime-admission.json`;
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes('evidence artifacts must stay inside candidate.evidence.directory')));
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('failure history evidence may point to prior candidate evidence but must resolve and match SHA-256', async () => {
  const seriesId = 'aaa-test-prior-evidence';
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

test('committed runtime-admission assets preserve history and no consumed authority remains effective', async () => {
  const report = await validateRuntimeAdmission({ root: ROOT });
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.templatesValidated, 1);
  const derivedById = new Map(
    report.candidates.map((candidateReport) => [
      candidateReport.candidateId,
      candidateReport.derivedDisposition,
    ]),
  );
  const expectedDerivedById = new Map([
    ['browser-integrated-uat-bridge-r1', 'HOLD'],
    ['runtime-admission-ai-pg-r1', 'NO-GO'],
    ['runtime-admission-ai-pg-r2', 'NO-GO'],
    ['runtime-admission-ai-pg-r3', 'NO-GO'],
    ['runtime-admission-soc-ai-lifecycle-mtls-r1', 'RUNTIME_AUTHORIZED'],
  ]);
  const effectiveById = new Map(
    report.candidates.map((candidateReport) => [
      candidateReport.candidateId,
      candidateReport.effectiveDisposition,
    ]),
  );
  const expectedEffectiveById = new Map([
    ['browser-integrated-uat-bridge-r1', 'HOLD'],
    ['runtime-admission-ai-pg-r1', 'NO-GO'],
    ['runtime-admission-ai-pg-r2', 'NO-GO'],
    ['runtime-admission-ai-pg-r3', 'NO-GO'],
    ['runtime-admission-soc-ai-lifecycle-mtls-r1', 'HOLD'],
  ]);
  assert.equal(report.counts.candidateFiles, expectedDerivedById.size);
  assert.deepEqual(derivedById, expectedDerivedById);
  assert.deepEqual(effectiveById, expectedEffectiveById);
  assert.equal(
    [...derivedById.values()].filter(
      (disposition) => disposition === 'RUNTIME_AUTHORIZED',
    ).length,
    1,
  );
  assert.equal(
    [...effectiveById.values()].filter(
      (disposition) => disposition === 'RUNTIME_AUTHORIZED',
    ).length,
    0,
  );
  assert.equal(
    report.candidates.find((candidate) =>
      candidate.candidateId === 'runtime-admission-soc-ai-lifecycle-mtls-r1')
      .effectiveAuthorizationState,
    'withdrawn',
  );

  const browser = JSON.parse(read(
    'docs/uat/candidates/browser-integrated-uat-bridge-r1/runtime-admission.json',
  ));
  assert.deepEqual(browser.attempt_accounting.current_attempt, {
    status: 'not_run',
    execution_authorized: false,
    executed_checks: 0,
    passed_checks: 0,
    failed_checks: 0,
    evidence_path:
      'docs/uat/candidates/browser-integrated-uat-bridge-r1/G-U2B-POSTGRES-RED-RUNTIME-RESULT-R1.md',
    evidence_sha256:
      '24d65a67b3e916988114542342bd5411ef87081b28d972d41b25e6d0a94388fe',
  });

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

  const r3 = JSON.parse(read(
    'docs/uat/candidates/runtime-admission-ai-pg-r3/runtime-admission.json',
  ));
  assert.equal(r3.attempt_accounting.attempt_ordinal, 3);
  assert.equal(r3.attempt_accounting.max_attempts, 2);
  assert.equal(r3.attempt_accounting.current_attempt.status, 'failed');
  assert.deepEqual(r3.attempt_accounting.current_attempt, {
    status: 'failed',
    execution_authorized: false,
    executed_checks: 6,
    passed_checks: 5,
    failed_checks: 1,
    evidence_path:
      'docs/uat/candidates/runtime-admission-ai-pg-r3/evidence/05-r3-runtime-result.md',
    evidence_sha256:
      '71041ecf06870cce1fc94911b9c57b90813cb510cb82347a28501d17621d8e23',
  });
  assert.deepEqual(
    r3.attempt_accounting.failure_history.map((attempt) => [
      attempt.candidate_id,
      attempt.evidence_sha256,
    ]),
    [
      [
        'runtime-admission-ai-pg-r1',
        '52742f66e08766810e049a36b8c5dbdbac89dba33a43dc6825a00479fe491b6c',
      ],
      [
        'runtime-admission-ai-pg-r2',
        'c8f4f4bcdf7e31329e46f73de1db1463034de4416c60b46125b18cd2479f2ef7',
      ],
    ],
  );
  assert.deepEqual(r3.attempt_accounting.recovery_override, {
    kind: 'admitted_command_defect',
    additional_attempts: 1,
    terminal_candidate_id: 'runtime-admission-ai-pg-r2',
    terminal_attempt_ordinal: 2,
    terminal_evidence_path:
      'docs/uat/candidates/runtime-admission-ai-pg-r2/evidence/02-r2-runtime-result.md',
    terminal_evidence_sha256:
      'c8f4f4bcdf7e31329e46f73de1db1463034de4416c60b46125b18cd2479f2ef7',
    correction_evidence_path:
      'docs/uat/candidates/runtime-admission-ai-pg-r3/evidence/01-command-correction.md',
    correction_evidence_sha256:
      '054254d1fb9b2e474d3942d273e875d0d92e143fd8a47d391380ce2e007162cb',
    review_status: 'independently_reviewed_go',
    review_evidence_path:
      'docs/uat/candidates/runtime-admission-ai-pg-r3/evidence/03-independent-runtime-review.md',
    review_evidence_sha256:
      'de654a1c7e1ec7fca0bcea9c709bf20ac92d2c05dabd5fdc531315976dc5da04',
  });
  assert.deepEqual(r3.commit_tree.suite, {
    commit: 'c0ef0d3a41d10dbdd885fc38f9f1fc0db967b5bd',
    tree: 'b59af36b2dfea496b6745ed446573732e1b92751',
  });
  assert.deepEqual(
    r3.hosted_ci.required_checks
      .filter(({ repo }) => repo === 'suite')
      .map(({ sha, name, status }) => [sha, name, status]),
    [
      [
        'c0ef0d3a41d10dbdd885fc38f9f1fc0db967b5bd',
        'contract standards validation',
        'success',
      ],
      [
        'c0ef0d3a41d10dbdd885fc38f9f1fc0db967b5bd',
        'secret-scan',
        'success',
      ],
    ],
  );
  assert.equal(r3.evidence.final_profile_verdict, 'NO-GO');
  assert.equal(r3.disposition.profile, 'NO-GO');
  const reviewEvidence = read(
    'docs/uat/candidates/runtime-admission-ai-pg-r3/evidence/03-independent-runtime-review.md',
  );
  assert.match(
    reviewEvidence,
    /\*\*GO — ONE BOUNDED NON-PRODUCTION R3 POSTGRESQL ATTEMPT ONLY\*\*/,
  );
  const authorizationEvidence = read(
    'docs/uat/candidates/runtime-admission-ai-pg-r3/evidence/04-runtime-authorization.md',
  );
  assert.match(
    authorizationEvidence,
    /start` → `reset` → `seed` \(SQL\) → the pytest command → `rollback` → `stop/,
  );
  assert.match(
    authorizationEvidence,
    /A failure spends the only recovery\s+ordinal and requires a new truthful `NO-GO` result artifact/,
  );
  assert.match(
    authorizationEvidence,
    /becomes exercisable only after this exact five-path enabling update is merged to\s+canonical `main` and its rendered required checks are green/,
  );
  assert.match(
    authorizationEvidence,
    /`seed\[0\]` \(the stdin-fed SQL role setup\).*`seed\[2\]` \(the exact pytest command\)/s,
  );
  assert.match(
    authorizationEvidence,
    /pytest result reports `13 passed` and reports no skipped tests/,
  );
  assert.match(
    authorizationEvidence,
    /rejects more than one simultaneous `RUNTIME_AUTHORIZED` candidate even\s+across different series identifiers/,
  );
  const resultEvidence = read(
    'docs/uat/candidates/runtime-admission-ai-pg-r3/evidence/05-r3-runtime-result.md',
  );
  assert.match(resultEvidence, /25 passed in 1\.59s/);
  assert.match(
    resultEvidence,
    /Read-only inspection after containment found `25` test functions in the exact pinned file and `13`\s+`@pytest\.mark\.integration` decorators\./,
  );
  assert.match(resultEvidence, /Candidate R3 is \*\*NO-GO\*\*/);
  assert.match(resultEvidence, /No retry, corrected command, substituted selector/);
  assert.match(read(README_PATH), /R3 records the one bounded/);
  assert.match(read(README_PATH), /is also `NO-GO` after consuming/);
  assert.match(read(README_PATH), /Any recovery must preserve every prior result/);
});

test('R3 correction uses one stdin-fed psql process and cannot retain the failed -c form', () => {
  const r3 = JSON.parse(read(
    'docs/uat/candidates/runtime-admission-ai-pg-r3/runtime-admission.json',
  ));
  const [seedCommand, cdCommand, testCommand] = r3.lifecycle_procedures.seed;
  const correctionEvidence = read(
    'docs/uat/candidates/runtime-admission-ai-pg-r3/evidence/01-command-correction.md',
  );
  const bashBlocks = [...correctionEvidence.matchAll(/```bash\n([^\n]+)\n```/g)];
  assert.equal(bashBlocks.length, 1);
  assert.equal(seedCommand, bashBlocks[0][1]);
  assert.match(seedCommand, /'\\set runtime_password'/);
  assert.match(seedCommand, /printf '%s\\n'/);
  assert.match(seedCommand, /\| docker exec -i /);
  assert.match(seedCommand, /psql --set=ON_ERROR_STOP=1 /);
  assert.doesNotMatch(seedCommand, /--single-transaction/);
  assert.equal([...seedCommand.matchAll(/"BEGIN;"/g)].length, 1);
  assert.equal([...seedCommand.matchAll(/"COMMIT;"/g)].length, 1);
  assert.match(seedCommand, /PASSWORD :'runtime_password'/);
  assert.equal(
    [...seedCommand.matchAll(
      /"ALTER ROLE cybrik_ai_runtime_uat LOGIN PASSWORD :'runtime_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;"/g,
    )].length,
    1,
  );
  assert.doesNotMatch(seedCommand, /\b(?:SUPERUSER|BYPASSRLS)\b/);
  assert.equal([...seedCommand.matchAll(/\bGRANT\b/g)].length, 1);
  assert.match(
    seedCommand,
    /NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS/,
  );
  assert.equal(
    [...seedCommand.matchAll(
      /GRANT cybrik_ai_api_app TO cybrik_ai_runtime_uat;/g,
    )].length,
    1,
  );
  assert.doesNotMatch(
    seedCommand,
    /\bpsql\b.*(?:\s-(?:c|f)(?:$|.)|--(?:command|file)(?:$|[=\s]))/,
  );
  assert.doesNotMatch(seedCommand, /--set=runtime_password/);
  assert.doesNotMatch(seedCommand, /-e PGPASSWORD=/);
  assert.equal([...seedCommand.matchAll(/\|/g)].length, 1);
  assert.equal(
    [...seedCommand.matchAll(/ALTER ROLE cybrik_ai_runtime_uat/g)].length,
    1,
  );
  const lifecycleCommands = Object.values(r3.lifecycle_procedures).flat();
  for (const command of lifecycleCommands) {
    assert.doesNotMatch(
      command,
      /(?:AI_PG_(?:POSTGRES|RUNTIME)_PASSWORD|POSTGRES_PASSWORD|PGPASSWORD|runtime_password)=(?!(?:"|')?\$\{)(?:"[^"]*"|'[^']*'|[^\s;]+)/,
    );
    assert.doesNotMatch(
      command,
      /AI_API_POSTGRES_(?:ADMIN|RUNTIME)_DSN=(?:"|')?postgresql\+asyncpg:\/\/[^:]+:(?!\$\{)/,
    );
  }
  const lifecycleText = JSON.stringify(r3.lifecycle_procedures);
  assert.match(lifecycleText, /AI_PG_POSTGRES_PASSWORD must be exactly 64 lowercase hexadecimal characters/);
  assert.match(lifecycleText, /AI_PG_RUNTIME_PASSWORD must be exactly 64 lowercase hexadecimal characters/);
  assert.match(lifecycleText, /trap 'docker rm -f cybrik-ai-pg-uat-r3/);
  assert.match(lifecycleText, /trap - EXIT INT TERM/);
  const startCommands = r3.lifecycle_procedures.start;
  const preflightIndex = startCommands.findIndex((command) => command.includes('docker container inspect'));
  const trapIndex = startCommands.findIndex((command) => command.startsWith("trap 'docker rm -f"));
  const exportIndex = startCommands.findIndex((command) => command.startsWith('export POSTGRES_PASSWORD='));
  const dockerRunIndex = startCommands.findIndex((command) => command.startsWith('docker run '));
  const readinessIndex = startCommands.findIndex((command) => command.includes('pg_isready'));
  const hostReadinessIndex = startCommands.findIndex((command) => command.includes('socket.create_connection'));
  assert.equal(startCommands[0], 'set -euo pipefail');
  assert.equal(preflightIndex, 2);
  assert.ok(preflightIndex < trapIndex);
  assert.ok(trapIndex < exportIndex);
  assert.ok(exportIndex < dockerRunIndex);
  assert.ok(dockerRunIndex < readinessIndex);
  assert.ok(readinessIndex < hostReadinessIndex);
  assert.match(startCommands[1], /AI_PG_POSTGRES_PASSWORD must be exactly 64/);
  assert.match(startCommands[1], /AI_PG_RUNTIME_PASSWORD must be exactly 64/);
  assert.match(startCommands[preflightIndex], /ZSH_VERSION/);
  assert.match(startCommands[preflightIndex], /whence -w printf/);
  assert.match(startCommands[preflightIndex], /printf: builtin/);
  assert.match(startCommands[preflightIndex], /14d5919e1d80eac6fc22287a69a9476cac2b77a4/);
  assert.match(startCommands[preflightIndex], /b45620e6be501f37341e87a346d4d2ba518bf394/);
  assert.match(startCommands[preflightIndex], /status --porcelain --untracked-files=all/);
  assert.match(startCommands[preflightIndex], /command -v docker .*docker info /);
  assert.match(startCommands[preflightIndex], /command -v python3 /);
  assert.match(
    startCommands[preflightIndex],
    /docker image inspect postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777/,
  );
  assert.match(startCommands[preflightIndex], /command -v lsof /);
  assert.match(startCommands[preflightIndex], /docker container inspect cybrik-ai-pg-uat-r3/);
  assert.match(startCommands[preflightIndex], /lsof -nP -iTCP:55432 -sTCP:LISTEN/);
  assert.match(startCommands[preflightIndex], /exit 72/);
  assert.match(startCommands[preflightIndex], /exit 73/);
  assert.match(startCommands[preflightIndex], /exit 74/);
  assert.match(startCommands[preflightIndex], /exit 75/);
  assert.match(startCommands[preflightIndex], /exit 76/);
  assert.match(
    startCommands[dockerRunIndex],
    /--pull=never .* -p 127\.0\.0\.1:55432:5432 .*postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777/,
  );
  assert.match(startCommands.join('\n'), /127\.0\.0\.1:55432\/postgres/);
  assert.equal(r3.network_exposure.surfaces[0].bind, '127.0.0.1:55432');
  assert.equal(
    r3.lifecycle_procedures.stop[0],
    'docker rm -f cybrik-ai-pg-uat-r3 >/dev/null 2>&1 || true',
  );
  assert.match(
    startCommands.join('\n'),
    /attempt=0; until docker exec .*pg_isready -h 127\.0\.0\.1 -p 5432 .*attempt=\$\(\(attempt \+ 1\)\).*"\$\{attempt\}" -ge 60.*exit 70/,
  );
  assert.match(
    startCommands[hostReadinessIndex],
    /socket\.create_connection\(\('127\.0\.0\.1', 55432\), timeout=1\).*"\$\{attempt\}" -ge 60.*exit 71/,
  );
  assert.deepEqual({
    tenant_isolation: r3.negative_smoke.tenant_isolation.map(({ status }) => status),
    authorization: r3.negative_smoke.authorization.map(({ status }) => status),
    secret_boundary: r3.negative_smoke.secret_boundary.map(({ status }) => status),
  }, {
    tenant_isolation: ['pass'],
    authorization: ['pass'],
    secret_boundary: ['pass'],
  });
  for (const smoke of [
    ...r3.negative_smoke.tenant_isolation,
    ...r3.negative_smoke.authorization,
  ]) {
    assert.match(smoke.name, /^runtime evidence:/);
    assert.match(
      smoke.name,
      /the file's 13 integration-marked tests covering durability, tenant-isolation, RLS and restricted-role authorization/,
    );
  }
  assert.match(
    r3.negative_smoke.secret_boundary[0].name,
    /^hosted required secret scans are green/,
  );
  assert.equal(cdCommand, 'cd "${CYBRIK_AI_REPO:?}"');
  assert.equal(
    testCommand,
    'AI_API_POSTGRES_ADMIN_DSN="${AI_API_POSTGRES_ADMIN_DSN:?}" AI_API_POSTGRES_RUNTIME_DSN="${AI_API_POSTGRES_RUNTIME_DSN:?}" uv run pytest --no-cov tests/ai_api/test_postgres_durable.py -q',
  );
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
    assert.equal(report.counts.candidateFiles, seededCandidateCount() + 1);
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

test('hosted checks, evidence readiness, and disposition drift fail closed together', async () => {
  const candidate = baseCandidate();
  candidate.hosted_ci.required_checks[0].status = 'failure';
  candidate.hosted_ci.required_checks[1].sha = '0'.repeat(40);
  candidate.contracts.reviewed_contracts = [];
  candidate.test_data.approved = false;
  candidate.evidence.artifacts = [];
  candidate.network_exposure.surfaces = [];
  candidate.evidence.final_profile_verdict = 'HOLD';

  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    for (const expected of [
      'required hosted checks must all be success',
      'must point at the exact candidate tuple SHA',
      'reviewed contracts must be explicit',
      'test data must be explicitly approved for non-production use',
      'evidence must record artifact digests',
      'network exposure must stay local-only or explicitly bounded',
      'disposition.profile must match evidence.final_profile_verdict',
      'disposition.profile must equal derived runtime admission disposition HOLD',
    ]) {
      assert.ok(
        report.errors.some((error) => error.includes(expected)),
        `missing fail-closed finding: ${expected}`,
      );
    }
    const candidateReport = report.candidates.find(
      (item) => item.candidateId === candidate.candidate_id,
    );
    assert.equal(candidateReport.derivedDisposition, 'HOLD');
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

test('Suite-local reviewed contract references must be contained regular files', async () => {
  const invalidReferences = [
    'cybrik-suite:docs/uat/does-not-exist.json',
    'cybrik-suite:/tmp/outside-suite-contract.json',
    'cybrik-suite:../outside-suite-contract.json',
    'cybrik-suite:docs/uat',
  ];
  for (const reference of invalidReferences) {
    const candidate = baseCandidate();
    candidate.contracts.reviewed_contracts = [reference];
    await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
      const report = await validateRuntimeAdmission({ root: tempRoot });
      assert.ok(
        report.errors.some((error) =>
          error.includes('Suite-local reviewed contract'),
        ),
        `missing finding for ${reference}`,
      );
      assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
    });
  }

  const directSymlinkCandidate = baseCandidate();
  directSymlinkCandidate.contracts.reviewed_contracts = [
    'cybrik-suite:docs/uat/direct-contract-link.md',
  ];
  await withTempRepo({ candidates: [directSymlinkCandidate] }, async (tempRoot) => {
    symlinkSync(
      join(tempRoot, README_PATH),
      join(tempRoot, 'docs/uat/direct-contract-link.md'),
    );
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('Suite-local reviewed contract'),
      ),
    );
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const externalDir = mkdtempSync(join(os.tmpdir(), 'runtime-admission-contract-'));
  try {
    writeFileSync(join(externalDir, 'contract.md'), 'outside\n', 'utf8');
    const parentSymlinkCandidate = baseCandidate();
    parentSymlinkCandidate.contracts.reviewed_contracts = [
      'cybrik-suite:docs/uat/linked/contract.md',
    ];
    await withTempRepo({ candidates: [parentSymlinkCandidate] }, async (tempRoot) => {
      symlinkSync(externalDir, join(tempRoot, 'docs/uat/linked'), 'dir');
      const report = await validateRuntimeAdmission({ root: tempRoot });
      assert.ok(
        report.errors.some((error) =>
          error.includes('Suite-local reviewed contract'),
        ),
      );
      assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
    });
  } finally {
    rmSync(externalDir, { recursive: true, force: true });
  }
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

test('smoke failures truthfully derive NO-GO', async () => {
  const smokeFailure = baseCandidate({
    authorizationSmoke: 'fail',
    disposition: 'NO-GO',
  });
  await withTempRepo({ candidates: [smokeFailure] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'NO-GO');
  });
});

test('open Critical or High findings before execution truthfully derive HOLD', async () => {
  const highFinding = baseCandidate({
    highFindings: 1,
    disposition: 'HOLD',
  });
  await withTempRepo({ candidates: [highFinding] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const criticalFinding = baseCandidate({
    criticalFindings: 1,
    disposition: 'HOLD',
  });
  await withTempRepo({ candidates: [criticalFinding] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('A0 preserves non-circular sequencing and pins exact Phase A authorization', async () => {
  const holdStatus = read(
    'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/01-hold-status.md',
  );
  const architecture = read(
    'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/02-architecture-and-acceptance.md',
  );
  const phaseAuthorization = read(
    'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/06-integrated-master-phase-a-authorization.md',
  );
  const committed = JSON.parse(read(
    'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/runtime-admission.json',
  ));

  assert.match(holdStatus, /Phase A — preflight admission/);
  assert.match(holdStatus, /Phase B — bounded execution and evidence closure/);
  assert.match(architecture, /A1–A7 are evidence-closure criteria, not preauthorization criteria/);
  assert.ok(committed.contracts.feature_flags.some((entry) =>
    entry.name === 'suite_integrated_master_uat_one_shot'
      && entry.state === 'enabled_only_by_exact_signed_external_authorization'));
  assert.deepEqual(committed.attempt_accounting.current_attempt, {
    status: 'not_run',
    execution_authorized: true,
    executed_checks: 0,
    passed_checks: 0,
    failed_checks: 0,
    evidence_path:
      'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/06-integrated-master-phase-a-authorization.md',
    evidence_sha256:
      '9827ecfb70c8de41b1f59d5bddff65680f4076ecd605ce9648ae805194b17df7',
  });
  assert.equal(committed.open_findings.critical, 0);
  assert.equal(committed.open_findings.high, 0);
  const smokeRows = Object.values(committed.negative_smoke).flat();
  assert.equal(smokeRows.length, 3);
  assert.ok(smokeRows.every((row) => row.status === 'pass'));
  assert.equal(committed.evidence.final_profile_verdict, 'RUNTIME_AUTHORIZED');
  assert.equal(committed.disposition.profile, 'RUNTIME_AUTHORIZED');
  assert.deepEqual(committed.commit_tree, {
    suite: {
      commit: '8e6f05f823b237b8c1b93e630182d570062b239e',
      tree: '1cfc07c2c5c2ddc7789533297f7ac8661ba2aa3a',
    },
    soc: {
      commit: 'abfdfde96afc6daa2868694de993c623daa8862e',
      tree: '241ef24a33246918ff5cf133e7d8d004823fdf06',
    },
    cyber_ai: {
      commit: '51377267c6adbd7860270253cb212681001c7b1e',
      tree: '831a24ffd3033f966f35a9daab9f5d8af81e8b64',
    },
    tool_fabric: {
      commit: '50aff1df146d6e98b33d9f82617781595bcf1512',
      tree: '2b4d516eef0a3b0ae05b44a225515efef749f25b',
    },
  });
  const checkNames = Object.fromEntries(
    ['suite', 'soc', 'cyber_ai', 'tool_fabric'].map((repo) => [
      repo,
      committed.hosted_ci.required_checks
        .filter((check) => check.repo === repo)
        .map((check) => check.name),
    ]),
  );
  assert.deepEqual(checkNames, {
    suite: ['contract standards validation', 'secret-scan'],
    soc: [
      'api',
      'backup-tool',
      'dependency-scan',
      'e2e',
      'sbom',
      'secret-scan',
      'web',
      'pf-workers',
    ],
    cyber_ai: [
      'scaffold-integrity',
      'lockfile-integrity',
      'lint',
      'type',
      'test',
      'build-offline',
      'secret-scan',
      'security-supply-chain',
    ],
    tool_fabric: ['scaffold-integrity', 'secret-scan', 'admission-gate'],
  });
  assert.deepEqual(
    committed.network_exposure.surfaces.map((surface) => surface.bind),
    [
      '127.0.0.1:55432',
      '127.0.0.1:58442',
      '127.0.0.1:58443',
      '127.0.0.1:58444',
    ],
  );
  assert.deepEqual(committed.production_exclusion, {
    no_production_credentials: true,
    no_production_configuration: true,
    no_production_data: true,
    no_production_traffic: true,
  });
  assert.equal(
    committed.attempt_accounting.current_attempt.evidence_sha256,
    '9827ecfb70c8de41b1f59d5bddff65680f4076ecd605ce9648ae805194b17df7',
  );
  assert.deepEqual(
    committed.evidence.artifacts.map(({ path, sha256 }) => [path, sha256]),
    [
      [
        'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/01-hold-status.md',
        '84d8266bb3c6de1cca312ae4b9cca0a12247313b9483ca495450a2bab7724dc6',
      ],
      [
        'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/02-architecture-and-acceptance.md',
        '465dd3955c92f1eec543964c9da7663203c3b1f9f84b8c722bfbe73e245c5be7',
      ],
      [
        'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/06-integrated-master-phase-a-authorization.md',
        '9827ecfb70c8de41b1f59d5bddff65680f4076ecd605ce9648ae805194b17df7',
      ],
      [
        'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/07-independent-phase-a-review.md',
        '67ac930e0672d5313c236be542206e35fa68316c8f93cb6b8989ff0169d3058a',
      ],
    ],
  );
  assert.match(phaseAuthorization, /signed externally by `FOUNDER` with SSHSIG/);
  assert.match(phaseAuthorization, /cybrik-uat-soc-ai-fabric-v1/);
  assert.match(phaseAuthorization, /invoked\s+once/);
  assert.match(phaseAuthorization, /Release dates are\s+unchanged/);
  assert.match(phaseAuthorization, /production remains Founder-controlled/);
  assert.match(phaseAuthorization, /clean detached Suite worktree/);

  const admittedPreflight = baseCandidate({
    executionAuthorized: true,
    highFindings: 1,
    authorizationSmoke: 'hold',
    disposition: 'HOLD',
  });
  await withTempRepo({ candidates: [admittedPreflight] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });

  const completedPass = baseCandidate({
    currentStatus: 'passed',
    executionAuthorized: false,
    passedChecks: 10,
    disposition: 'HOLD',
  });
  await withTempRepo({ candidates: [completedPass] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
  });
});

test('held negative smoke checks truthfully derive HOLD without structural errors', async () => {
  const candidate = baseCandidate({
    authorizationSmoke: 'hold',
    disposition: 'HOLD',
  });
  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    assert.equal(report.candidates[0].derivedDisposition, 'HOLD');
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
    `${candidateDir(outsideArtifact.attempt_accounting.series_id, 1)}/runtime-admission.json`;
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
        candidateDir(symlinkArtifact.attempt_accounting.series_id, 1),
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
  const seriesId = 'aaa-test-missing-prior';
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
  const seriesId = 'aaa-test-missing-prior';
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
    seriesId: 'aaa-test-authorized-a',
    ordinal: 1,
  });
  const second = baseCandidate({
    seriesId: 'aaa-test-authorized-b',
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

test('a valid withdrawal frees the singleton without mutating the target record', async () => {
  const first = baseCandidate({
    seriesId: 'aaa-test-authorized-a',
    ordinal: 1,
  });
  const second = baseCandidate({
    seriesId: 'aaa-test-authorized-b',
    ordinal: 1,
  });
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.equal(report.errors.length, 0);
    const firstReport = report.candidates.find((candidateReport) => candidateReport.candidateId === first.candidate_id);
    const secondReport = report.candidates.find((candidateReport) => candidateReport.candidateId === second.candidate_id);
    assert.equal(firstReport.derivedDisposition, 'RUNTIME_AUTHORIZED');
    assert.equal(firstReport.effectiveDisposition, 'HOLD');
    assert.equal(firstReport.authorizationState, 'withdrawn');
    assert.equal(secondReport.effectiveDisposition, 'RUNTIME_AUTHORIZED');
    assert.equal(secondReport.authorizationState, 'active');
  });
});

test('an invalid withdrawal fails closed and does not free the singleton', async () => {
  const first = baseCandidate({
    seriesId: 'aaa-test-authorized-a',
    ordinal: 1,
  });
  const second = baseCandidate({
    seriesId: 'aaa-test-authorized-b',
    ordinal: 1,
  });
  const withdrawal = runtimeAuthorizationWithdrawal(first, {
    targetRecordSha256: 'f'.repeat(64),
  });

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('target_record_sha256 must match the recorded runtime-admission bytes'),
      ),
    );
    assert.ok(
      report.errors.some((error) =>
        error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate'),
      ),
    );
    assert.equal(
      report.candidates.filter(
        (candidateReport) => candidateReport.effectiveDisposition === 'RUNTIME_AUTHORIZED',
      ).length,
      0,
    );
  });
});

test('a withdrawn runtime-authorization series cannot reopen under the same series id', async () => {
  const first = baseCandidate({
    seriesId: 'aaa-test-authorized-a',
    ordinal: 1,
    maxAttempts: 2,
  });
  const reopened = baseCandidate({
    seriesId: 'aaa-test-authorized-a',
    ordinal: 2,
    maxAttempts: 2,
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  reopened.attempt_accounting.failure_history = [
    {
      candidate_id: first.candidate_id,
      attempt_ordinal: 1,
      executed_checks: 0,
      passed_checks: 0,
      failed_checks: 0,
      evidence_path: first.attempt_accounting.current_attempt.evidence_path,
      evidence_sha256: first.attempt_accounting.current_attempt.evidence_sha256,
    },
  ];
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, reopened] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(
      report.errors.some((error) =>
        error.includes('withdrawn runtime-authorization series cannot reopen under the same series_id'),
      ),
      report.errors.join('\n'),
    );
    assert.equal(report.candidates.find((candidateReport) => candidateReport.candidateId === reopened.candidate_id).derivedDisposition, 'HOLD');
  });
});

test('an unsigned withdrawal cannot free the singleton', async () => {
  const first = baseCandidate({ seriesId: 'aaa-test-authorized-a' });
  const second = baseCandidate({ seriesId: 'aaa-test-authorized-b' });
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    unlinkSync(join(tempRoot, withdrawal.signaturePath));
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes('withdrawal SSHSIG must verify against the pinned withdrawal trust')));
    assert.ok(report.errors.some((error) =>
      error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate')));
  });
});

test('a withdrawal whose signed bytes drift cannot free the singleton', async () => {
  const first = baseCandidate({ seriesId: 'aaa-test-authorized-a' });
  const second = baseCandidate({ seriesId: 'aaa-test-authorized-b' });
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const recordPath = join(tempRoot, withdrawal.recordPath);
    writeFileSync(recordPath, `${readFileSync(recordPath, 'utf8')} `, 'utf8');
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes('withdrawal SSHSIG must verify against the pinned withdrawal trust')));
    assert.ok(report.errors.some((error) =>
      error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate')));
  });
});

test('a symlinked withdrawal record is rejected before external JSON is parsed', async () => {
  const first = baseCandidate({ seriesId: 'aaa-test-authorized-a' });
  const second = baseCandidate({ seriesId: 'aaa-test-authorized-b' });
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const recordPath = join(tempRoot, withdrawal.recordPath);
    const relocatedPath = `${recordPath}.relocated`;
    writeFileSync(relocatedPath, '{not-json', 'utf8');
    unlinkSync(recordPath);
    symlinkSync(relocatedPath, recordPath);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes('withdrawal record must resolve to a contained non-symlink regular file')));
    assert.ok(report.errors.some((error) =>
      error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate')));
  });
});

test('withdrawal signer and trust drift cannot free the singleton', async () => {
  const first = baseCandidate({ seriesId: 'aaa-test-authorized-a' });
  const second = baseCandidate({ seriesId: 'aaa-test-authorized-b' });
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const allowedPath = join(tempRoot, withdrawal.allowedSignersPath);
    writeFileSync(allowedPath, readFileSync(allowedPath, 'utf8').replace('FOUNDER', 'IMPOSTOR'), 'utf8');
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes('withdrawal allowed-signers identity must bind FOUNDER')));
    assert.ok(report.errors.some((error) =>
      error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate')));
  });
});

test('withdrawal trust must retain the tracked master UAT signer identity', async () => {
  const first = baseCandidate({ seriesId: 'aaa-test-authorized-a' });
  const second = baseCandidate({ seriesId: 'aaa-test-authorized-b' });
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const masterTrustPath = join(tempRoot, MASTER_AUTHORIZATION_TRUST_PATH);
    const masterTrust = JSON.parse(readFileSync(masterTrustPath, 'utf8'));
    masterTrust.key_fingerprint = `SHA256:${'A'.repeat(43)}`;
    stableWriteJson(masterTrustPath, masterTrust);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes('withdrawal trust must retain the tracked master UAT signer identity')));
    assert.ok(report.errors.some((error) =>
      error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate')));
  });
});

test('a symlinked withdrawal trust descriptor cannot free the singleton', async () => {
  const first = baseCandidate({ seriesId: 'aaa-test-authorized-a' });
  const second = baseCandidate({ seriesId: 'aaa-test-authorized-b' });
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const trustPath = join(tempRoot, WITHDRAWAL_TRUST_PATH);
    const relocatedPath = `${trustPath}.relocated`;
    writeFileSync(relocatedPath, readFileSync(trustPath));
    unlinkSync(trustPath);
    symlinkSync(relocatedPath, trustPath);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes('withdrawal trust descriptor must resolve to a contained non-symlink regular file')));
    assert.ok(report.errors.some((error) =>
      error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate')));
  });
});

test('withdrawal signature path must remain the adjacent detached SSHSIG', async () => {
  const first = baseCandidate({ seriesId: 'aaa-test-authorized-a' });
  const second = baseCandidate({ seriesId: 'aaa-test-authorized-b' });
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const recordPath = join(tempRoot, withdrawal.recordPath);
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    const relocatedSignaturePath = `${withdrawal.signaturePath}.relocated`;
    writeFileSync(
      join(tempRoot, relocatedSignaturePath),
      readFileSync(join(tempRoot, withdrawal.signaturePath)),
    );
    record.external_packet_closure.signature_path = relocatedSignaturePath;
    stableWriteJson(recordPath, record);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes('withdrawal signature_path must be the adjacent detached SSHSIG')));
    assert.ok(report.errors.some((error) =>
      error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate')));
  });
});

test('a symlinked withdrawal signature cannot free the singleton', async () => {
  const first = baseCandidate({ seriesId: 'aaa-test-authorized-a' });
  const second = baseCandidate({ seriesId: 'aaa-test-authorized-b' });
  const withdrawal = runtimeAuthorizationWithdrawal(first);

  await withTempRepo({ candidates: [first, second] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const signaturePath = join(tempRoot, withdrawal.signaturePath);
    const relocatedPath = `${signaturePath}.relocated`;
    writeFileSync(relocatedPath, readFileSync(signaturePath));
    unlinkSync(signaturePath);
    symlinkSync(relocatedPath, signaturePath);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes('withdrawal signature must resolve to a contained non-symlink regular file')));
    assert.ok(report.errors.some((error) =>
      error.includes('registry may contain at most one RUNTIME_AUTHORIZED candidate')));
  });
});

test('a signed withdrawal cannot target a candidate that was never authorized', async () => {
  const held = baseCandidate({
    seriesId: 'aaa-test-held',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  const authorized = baseCandidate({ seriesId: 'aaa-test-authorized' });
  const withdrawal = runtimeAuthorizationWithdrawal(held);

  await withTempRepo({ candidates: [held, authorized] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes('schema /observed_attempt/execution_authorized must be equal to constant')));
    assert.equal(
      report.candidates.find((candidateReport) =>
        candidateReport.candidateId === authorized.candidate_id).effectiveDisposition,
      'RUNTIME_AUTHORIZED',
    );
  });
});

test('withdrawal schema forbids production authority and reactivation fields', async () => {
  const candidate = baseCandidate({ seriesId: 'aaa-test-authorized' });
  const withdrawal = runtimeAuthorizationWithdrawal(candidate);

  await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
    withdrawal.install(tempRoot);
    const recordPath = join(tempRoot, withdrawal.recordPath);
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    record.effect.production_authority = 'delegated';
    record.effect.reactivate = true;
    stableWriteJson(recordPath, record);
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.includes("schema /effect must NOT have additional properties")));
    assert.ok(report.errors.some((error) =>
      error.includes('schema /effect/production_authority must be equal to constant')));
  });
});

test('a failed smoke cannot hide an unrecorded prerequisite while a held smoke remains valid evidence', async () => {
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
    assert.equal(report.errors.length, 1);
    assert.equal(report.candidates[0].derivedDisposition, 'NO-GO');
  });
});

test('a new series must declare objective lineage when terminal legacy records exist', async () => {
  const terminal = terminalRecoverySeries();
  const future = baseCandidate({
    seriesId: 'golden-uat-suite',
    ordinal: 1,
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  delete future.attempt_accounting.objective_lineage;
  const lineagePolicy = lineagePolicyFor([terminal.r1, terminal.r2, terminal.r3, future]);

  await withTempRepo({
    candidates: [terminal.r1, terminal.r2, terminal.r3, future],
    extraWrites: terminal.extraWrites,
    lineagePolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'new runtime-admission series must declare objective_lineage',
    )));
  });
});

test('a new series cannot reopen a terminal capability objective under another name', async () => {
  const terminal = terminalRecoverySeries();
  const future = baseCandidate({
    seriesId: 'runtime-admission-ai-pg-retry',
    ordinal: 1,
    executionAuthorized: true,
    disposition: 'RUNTIME_AUTHORIZED',
  });
  future.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.ai.durable-postgres',
    objective_id: 'bounded-postgres-runtime-v1',
    historical_prerequisites: [
      historicalPrerequisite(terminal.r3),
    ],
  };
  const lineagePolicy = lineagePolicyFor([terminal.r1, terminal.r2, terminal.r3, future]);

  await withTempRepo({
    candidates: [terminal.r1, terminal.r2, terminal.r3, future],
    extraWrites: terminal.extraWrites,
    lineagePolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'objective_lineage cannot reopen a terminal capability/objective under a new series_id',
    )));
  });
});

test('historical prerequisite evidence can never be promoted to execution authority', async () => {
  const terminal = terminalRecoverySeries();
  const future = baseCandidate({
    seriesId: 'golden-uat-suite',
    ordinal: 1,
    executionAuthorized: true,
    disposition: 'RUNTIME_AUTHORIZED',
  });
  future.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [
      {
        ...historicalPrerequisite(terminal.r3),
        evidence_use: 'execution_authority',
      },
    ],
  };
  const lineagePolicy = lineagePolicyFor([terminal.r1, terminal.r2, terminal.r3, future]);

  await withTempRepo({
    candidates: [terminal.r1, terminal.r2, terminal.r3, future],
    extraWrites: terminal.extraWrites,
    lineagePolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'schema /attempt_accounting/objective_lineage/historical_prerequisites/0/evidence_use must be equal to constant',
    )));
  });
});

test('a distinct future objective may cite terminal R3 only as historical prerequisite', async () => {
  const terminal = terminalRecoverySeries();
  const future = baseCandidate({
    seriesId: 'golden-uat-suite',
    ordinal: 1,
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  future.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [
      historicalPrerequisite(terminal.r3),
    ],
  };
  const lineagePolicy = lineagePolicyFor([terminal.r1, terminal.r2, terminal.r3, future]);

  await withTempRepo({
    candidates: [terminal.r1, terminal.r2, terminal.r3, future],
    extraWrites: terminal.extraWrites,
    lineagePolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.deepEqual(report.errors, []);
    const futureReport = report.candidates.find(
      (candidateReport) => candidateReport.candidateId === future.candidate_id,
    );
    assert.equal(futureReport.derivedDisposition, 'HOLD');
  });
});

test('a new current attempt cannot reuse bytes accounted by a historical prerequisite', async () => {
  const terminal = terminalRecoverySeries();
  const future = baseCandidate({
    seriesId: 'golden-uat-suite',
    ordinal: 1,
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  const prerequisite = historicalPrerequisite(terminal.r3);
  future.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [prerequisite],
  };
  future.attempt_accounting.current_attempt.evidence_sha256 = prerequisite.evidence_sha256;
  future.evidence.artifacts = [
    {
      path: future.attempt_accounting.current_attempt.evidence_path,
      sha256: prerequisite.evidence_sha256,
    },
  ];
  const lineagePolicy = lineagePolicyFor([terminal.r1, terminal.r2, terminal.r3, future]);

  await withTempRepo({
    candidates: [terminal.r1, terminal.r2, terminal.r3, future],
    extraWrites: [
      ...terminal.extraWrites,
      {
        kind: 'text',
        dir: evidenceDir(terminal.seriesId, 3),
        path: currentAttemptArtifact(terminal.seriesId, 3),
        value: 'attempt 3\n',
      },
      {
        kind: 'text',
        dir: evidenceDir('golden-uat-suite', 1),
        path: currentAttemptArtifact('golden-uat-suite', 1),
        value: 'attempt 3\n',
      },
    ],
    lineagePolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'current attempt evidence must be fresh and must not reuse historical prerequisite evidence',
    )));
  });
});

test('a terminal future objective cannot be reopened by another future series', async () => {
  const legacy = terminalRecoverySeries();
  const terminalFuture = baseCandidate({
    seriesId: 'golden-uat-a',
    ordinal: 1,
    maxAttempts: 1,
    currentStatus: 'failed',
    executionAuthorized: false,
    passedChecks: 5,
    failedChecks: 1,
    disposition: 'NO-GO',
  });
  terminalFuture.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };
  const reopened = baseCandidate({
    seriesId: 'golden-uat-b',
    ordinal: 1,
    maxAttempts: 1,
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  reopened.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };

  await withTempRepo({
    candidates: [legacy.r1, legacy.r2, legacy.r3, terminalFuture, reopened],
    extraWrites: legacy.extraWrites,
    lineagePolicy: lineagePolicyFor([
      legacy.r1,
      legacy.r2,
      legacy.r3,
      terminalFuture,
      reopened,
    ]),
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) =>
      error.startsWith(candidateRecordPath('golden-uat-b', 1))
      && error.includes(
        'objective_lineage cannot reopen a terminal capability/objective under a new series_id',
      )));
  });
});

test('self-declared capability and objective aliases must be registered by policy', async () => {
  const legacy = terminalRecoverySeries();
  const alias = baseCandidate({
    seriesId: 'runtime-admission-ai-pg-alias',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  alias.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.ai.durable-postgres-2',
    objective_id: 'bounded-postgres-runtime-v2',
    historical_prerequisites: [historicalPrerequisite(legacy.r3)],
  };

  await withTempRepo({
    candidates: [legacy.r1, legacy.r2, legacy.r3, alias],
    extraWrites: legacy.extraWrites,
    // The alias is deliberately excluded so its self-declared objective stays
    // unregistered in allowed_objectives.
    lineagePolicy: lineagePolicyFor([legacy.r1, legacy.r2, legacy.r3]),
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'objective_lineage capability_id/objective_id must be registered in allowed_objectives',
    )));
  });
});

test('duplicate and drifted historical prerequisites fail closed', async () => {
  const legacy = terminalRecoverySeries();
  const future = baseCandidate({
    seriesId: 'golden-uat-suite',
    executionAuthorized: false,
    disposition: 'HOLD',
  });
  const prerequisite = historicalPrerequisite(legacy.r3);
  future.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [
      prerequisite,
      {
        ...prerequisite,
        record_sha256: '0'.repeat(64),
      },
    ],
  };

  await withTempRepo({
    candidates: [legacy.r1, legacy.r2, legacy.r3, future],
    extraWrites: legacy.extraWrites,
    lineagePolicy: lineagePolicyFor([legacy.r1, legacy.r2, legacy.r3, future]),
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'historical prerequisite candidate_id values must be unique',
    )));
  });

  future.attempt_accounting.objective_lineage.historical_prerequisites = [
    {
      ...prerequisite,
      record_sha256: '0'.repeat(64),
    },
  ];
  await withTempRepo({
    candidates: [legacy.r1, legacy.r2, legacy.r3, future],
    extraWrites: legacy.extraWrites,
    lineagePolicy: lineagePolicyFor([legacy.r1, legacy.r2, legacy.r3, future]),
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'historical prerequisite record path and digest must match the immutable lineage policy',
    )));
  });
});

test('lineage policy paths cannot escape the repository or resolve through symlinks', async () => {
  const legacy = terminalRecoverySeries();
  const traversalPolicy = lineagePolicyFor([legacy.r1, legacy.r2, legacy.r3]);
  traversalPolicy.legacy_candidates[0].record_path = '../../../../etc/passwd';
  await withTempRepo({
    candidates: [legacy.r1, legacy.r2, legacy.r3],
    extraWrites: legacy.extraWrites,
    lineagePolicy: traversalPolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'record_path must stay inside the repository root',
    )));
    assert.ok(report.errors.every((error) => !error.includes('/etc/passwd')));
  });

  const symlinkPolicy = lineagePolicyFor([legacy.r1, legacy.r2, legacy.r3]);
  await withTempRepo({
    candidates: [legacy.r1, legacy.r2, legacy.r3],
    extraWrites: legacy.extraWrites,
    lineagePolicy: symlinkPolicy,
  }, async (tempRoot) => {
    const recordPath = join(
      tempRoot,
      symlinkPolicy.legacy_candidates[0].record_path,
    );
    unlinkSync(recordPath);
    symlinkSync(
      resolve(tempRoot, symlinkPolicy.legacy_candidates[1].record_path),
      recordPath,
    );
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'record_path must resolve to a non-symlink regular file',
    )));
  });
});

test('malformed policy and non-NO-GO legacy enrollment fail closed', async () => {
  const legacy = terminalRecoverySeries();
  const malformedPolicy = lineagePolicyFor([legacy.r1, legacy.r2, legacy.r3]);
  delete malformedPolicy.allowed_objectives;
  await withTempRepo({
    candidates: [legacy.r1, legacy.r2, legacy.r3],
    extraWrites: legacy.extraWrites,
    lineagePolicy: malformedPolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'must contain exactly schema_version, allowed_objectives, legacy_candidates and sealed_predecessors',
    )));
  });

  const authorizedLegacyPolicy = lineagePolicyFor([legacy.r1, legacy.r2, legacy.r3]);
  authorizedLegacyPolicy.legacy_candidates[0].recorded_disposition =
    'RUNTIME_AUTHORIZED';
  await withTempRepo({
    candidates: [legacy.r1, legacy.r2, legacy.r3],
    extraWrites: legacy.extraWrites,
    lineagePolicy: authorizedLegacyPolicy,
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'a 64-hex digest and NO-GO disposition',
    )));
  });
});

test('undeclared cross-series byte reuse is rejected registry-wide', async () => {
  const legacy = terminalRecoverySeries();
  const future = baseCandidate({
    seriesId: 'golden-uat-suite',
    executionAuthorized: true,
    disposition: 'RUNTIME_AUTHORIZED',
  });
  future.attempt_accounting.objective_lineage = {
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    historical_prerequisites: [],
  };
  const copiedDigest = legacy.r3.attempt_accounting.current_attempt.evidence_sha256;
  future.attempt_accounting.current_attempt.evidence_sha256 = copiedDigest;
  future.evidence.artifacts[0].sha256 = copiedDigest;

  await withTempRepo({
    candidates: [legacy.r1, legacy.r2, legacy.r3, future],
    extraWrites: [
      ...legacy.extraWrites,
      {
        kind: 'text',
        dir: evidenceDir('golden-uat-suite', 1),
        path: currentAttemptArtifact('golden-uat-suite', 1),
        value: 'attempt 3\n',
      },
    ],
    lineagePolicy: lineagePolicyFor([legacy.r1, legacy.r2, legacy.r3, future]),
  }, async (tempRoot) => {
    const report = await validateRuntimeAdmission({ root: tempRoot });
    assert.ok(report.errors.some((error) => error.includes(
      'cross-series execution evidence SHA-256 must be unique',
    )));
    const futureReport = report.candidates.find(
      (candidateReport) => candidateReport.candidateId === future.candidate_id,
    );
    assert.equal(futureReport.derivedDisposition, 'HOLD');
  });
});

test('evidence cannot escape through a symlinked parent directory', async () => {
  const candidate = baseCandidate({
    seriesId: 'symlink-parent-probe',
    executionAuthorized: true,
    disposition: 'RUNTIME_AUTHORIZED',
  });
  const outsideContent = 'outside evidence must never be admitted\n';
  const linkedArtifactPath =
    `${evidenceDir('symlink-parent-probe', 1)}/linked/secret.md`;
  candidate.evidence.artifacts.push({
    path: linkedArtifactPath,
    sha256: sha256(outsideContent),
  });
  const outsideDir = mkdtempSync(join(os.tmpdir(), 'runtime-admission-outside-'));
  try {
    writeFileSync(join(outsideDir, 'secret.md'), outsideContent, 'utf8');
    await withTempRepo({ candidates: [candidate] }, async (tempRoot) => {
      symlinkSync(
        outsideDir,
        join(tempRoot, evidenceDir('symlink-parent-probe', 1), 'linked'),
      );
      const report = await validateRuntimeAdmission({ root: tempRoot });
      assert.ok(report.errors.some((error) =>
        error.includes('evidence artifact paths must not resolve outside the repository root')
        || error.includes('evidence artifacts must resolve inside candidate.evidence.directory')));
      const candidateReport = report.candidates.find(
        (item) => item.candidateId === candidate.candidate_id,
      );
      assert.equal(candidateReport.derivedDisposition, 'HOLD');
    });
  } finally {
    rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('main-module guard resolves symlinked entry paths', () => {
  const tempRoot = mkdtempSync(join(os.tmpdir(), 'runtime-admission-main-'));
  try {
    const validatorPath = resolve(
      ROOT,
      'tools/contract-validation/validate-runtime-admission.mjs',
    );
    const symlinkPath = join(tempRoot, 'runtime-admission-link.mjs');
    symlinkSync(validatorPath, symlinkPath);
    assert.equal(
      isMainModule(
        new URL('../validate-runtime-admission.mjs', import.meta.url).href,
        symlinkPath,
      ),
      true,
    );
    assert.equal(isMainModule('not-a-url', symlinkPath), false);
    assert.equal(isMainModule(import.meta.url, undefined), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
