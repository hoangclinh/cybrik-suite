import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');
const SCHEMA_PATH = 'docs/uat/runtime-admission.schema.json';
const README_PATH = 'docs/uat/candidates/README.md';
const TEMPLATE_PATH = 'docs/uat/templates/runtime-admission.hold.json';
const LINEAGE_POLICY_PATH = 'docs/uat/runtime-admission-lineage-policy.json';
const CANDIDATE_ROOT = 'docs/uat/candidates';
const FORBIDDEN_PROFILES = new Set([
  'DEMO_READY_LOCAL',
  'CUSTOMER_POC_READY',
  'RC_READY',
  'FULL_RELEASE_READY',
]);
const sha1Pattern = /^[0-9a-f]{40}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const allowedCheckStatuses = new Set(['success', 'failure', 'pending', 'cancelled']);
const allowedSmokeStatuses = new Set(['pass', 'fail', 'hold']);
const allowedProfiles = new Set([
  'HOLD',
  'NO-GO',
  'RUNTIME_AUTHORIZED',
  'DEMO_READY_LOCAL',
  'CUSTOMER_POC_READY',
  'RC_READY',
  'FULL_RELEASE_READY',
]);
const allowedTestDataClasses = new Set(['synthetic', 'sanitized', 'approved_nonprod']);
const SEALED_LEGACY_CANDIDATES = [
  {
    candidate_id: 'runtime-admission-ai-pg-r1',
    series_id: 'runtime-admission-ai-pg',
    capability_id: 'cybrik.ai.durable-postgres',
    objective_id: 'bounded-postgres-runtime-v1',
    record_path: 'docs/uat/candidates/runtime-admission-ai-pg-r1/runtime-admission.json',
    record_sha256: '4838293a1eefda49f1bfbf27ee7cdc3f6b314576747002afcc3d7df9ad1c19cc',
    recorded_disposition: 'NO-GO',
  },
  {
    candidate_id: 'runtime-admission-ai-pg-r2',
    series_id: 'runtime-admission-ai-pg',
    capability_id: 'cybrik.ai.durable-postgres',
    objective_id: 'bounded-postgres-runtime-v1',
    record_path: 'docs/uat/candidates/runtime-admission-ai-pg-r2/runtime-admission.json',
    record_sha256: '54d94d318e211502d66423c349c1d9b4e6461659baae2927d59f7f517a5bc48e',
    recorded_disposition: 'NO-GO',
  },
  {
    candidate_id: 'runtime-admission-ai-pg-r3',
    series_id: 'runtime-admission-ai-pg',
    capability_id: 'cybrik.ai.durable-postgres',
    objective_id: 'bounded-postgres-runtime-v1',
    record_path: 'docs/uat/candidates/runtime-admission-ai-pg-r3/runtime-admission.json',
    record_sha256: '72ec88e98023c5992d5e42c710d0632680158d13ecc0a1065795a0a9db4263e3',
    recorded_disposition: 'NO-GO',
  },
];

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

export const expectedRepositories = ['suite', 'soc', 'cyber_ai', 'tool_fabric'];
export const expectedCandidateFields = [
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
];

const readText = (root, path, overrides) => {
  if (overrides?.has(path)) return overrides.get(path);
  return readFileSync(join(root, path), 'utf8');
};

const parseJson = (root, path, overrides, errors) => {
  try {
    return JSON.parse(readText(root, path, overrides));
  } catch (error) {
    errors.push(`${path}: cannot read valid JSON: ${error.message}`);
    return null;
  }
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, expected) =>
  isPlainObject(value)
  && Object.keys(value).length === expected.length
  && expected.every((key) => Object.hasOwn(value, key));

const compileSchema = (root, overrides, errors) => {
  const schema = parseJson(root, SCHEMA_PATH, overrides, errors);
  if (!schema) return null;
  try {
    const ajv = new Ajv2020({
      strict: true,
      strictTypes: false,
      allErrors: true,
    });
    addFormats(ajv);
    return ajv.compile(schema);
  } catch (error) {
    errors.push(`${SCHEMA_PATH}: schema compile failed: ${error.message}`);
    return null;
  }
};

const validateAgainstSchema = (validator, path, value, errors) => {
  if (validator(value)) return true;
  for (const issue of validator.errors ?? []) {
    errors.push(`${path}: schema ${issue.instancePath || '/'} ${issue.message}`);
  }
  return false;
};

const discoverRuntimeAdmissionFiles = (root, relativeDir = CANDIDATE_ROOT) => {
  const absoluteDir = join(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  const files = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverRuntimeAdmissionFiles(root, relativePath));
    } else if (entry.isFile() && entry.name === 'runtime-admission.json') {
      files.push(relativePath);
    }
  }
  return files.sort();
};

const discoverCandidateFiles = (root) => {
  return discoverRuntimeAdmissionFiles(root)
    .filter((path) => path.split('/').length === 5)
    .sort();
};

const validateRecordShape = (path, value) => {
  const errors = [];
  if (!hasExactKeys(value, expectedCandidateFields)) {
    errors.push(`${path}: top-level record must contain exactly ${expectedCandidateFields.join(', ')}`);
    return errors;
  }
  if (typeof value.candidate_id !== 'string' || value.candidate_id.length === 0) {
    errors.push(`${path}: candidate_id must be a non-empty string`);
  }
  if (typeof value.recorded_at !== 'string' || Number.isNaN(Date.parse(value.recorded_at))) {
    errors.push(`${path}: recorded_at must be an ISO-8601 date-time`);
  }
  const attemptAccountingFields = [
    'series_id',
    'attempt_ordinal',
    'max_attempts',
    'current_attempt',
    'failure_history',
  ];
  if (Object.hasOwn(value.attempt_accounting, 'recovery_override')) {
    attemptAccountingFields.push('recovery_override');
  }
  if (Object.hasOwn(value.attempt_accounting, 'objective_lineage')) {
    attemptAccountingFields.push('objective_lineage');
  }
  if (!hasExactKeys(value.attempt_accounting, attemptAccountingFields)) {
    errors.push(`${path}: attempt_accounting must contain series_id, attempt_ordinal, max_attempts, current_attempt and failure_history, plus only optional recovery_override and objective_lineage`);
  }
  if (!hasExactKeys(value.commit_tree, expectedRepositories)) {
    errors.push(`${path}: commit_tree must contain exactly four repositories`);
  } else {
    for (const repo of expectedRepositories) {
      const tuple = value.commit_tree[repo];
      if (!hasExactKeys(tuple, ['commit', 'tree'])) {
        errors.push(`${path}: commit_tree.${repo} must contain commit and tree`);
        continue;
      }
      if (!sha1Pattern.test(tuple.commit) || !sha1Pattern.test(tuple.tree)) {
        errors.push(`${path}: commit_tree.${repo} commit/tree must be 40-hex`);
      }
    }
  }
  if (!hasExactKeys(value.hosted_ci, ['required_checks', 'skipped_jobs', 'suppressed_jobs'])) {
    errors.push(`${path}: hosted_ci must contain required_checks, skipped_jobs and suppressed_jobs`);
  } else {
    if (!Array.isArray(value.hosted_ci.required_checks)) {
      errors.push(`${path}: hosted_ci.required_checks must be an array`);
    } else {
      for (const item of value.hosted_ci.required_checks) {
        if (!hasExactKeys(item, ['repo', 'sha', 'name', 'status'])) {
          errors.push(`${path}: required hosted checks must enumerate repo, sha, name and status`);
          continue;
        }
        if (
          !expectedRepositories.includes(item.repo)
          || !sha1Pattern.test(item.sha)
          || typeof item.name !== 'string'
          || item.name.length === 0
          || !allowedCheckStatuses.has(item.status)
        ) {
          errors.push(`${path}: required hosted checks must enumerate valid repo, sha, name and status`);
        }
      }
    }
    for (const [key, expectedStatus] of [
      ['skipped_jobs', 'skipped'],
      ['suppressed_jobs', 'suppressed'],
    ]) {
      if (!Array.isArray(value.hosted_ci[key])) {
        errors.push(`${path}: hosted_ci.${key} must be an array`);
        continue;
      }
      for (const item of value.hosted_ci[key]) {
        if (!hasExactKeys(item, ['repo', 'name', 'status', 'reason'])) {
          errors.push(`${path}: ${key} entries must enumerate repo, name, status and reason`);
          continue;
        }
        if (
          !expectedRepositories.includes(item.repo)
          || typeof item.name !== 'string'
          || item.name.length === 0
          || item.status !== expectedStatus
          || typeof item.reason !== 'string'
          || item.reason.length === 0
        ) {
          errors.push(`${path}: ${key} entries must use valid repo, name, ${expectedStatus} status and reason`);
        }
      }
    }
  }
  if (!hasExactKeys(value.contracts, ['reviewed_contracts', 'feature_flags', 'capability_lifecycle'])) {
    errors.push(`${path}: contracts must contain reviewed_contracts, feature_flags and capability_lifecycle`);
  }
  if (!hasExactKeys(value.test_data, ['classification', 'approved', 'notes'])) {
    errors.push(`${path}: test_data must contain classification, approved and notes`);
  } else if (!allowedTestDataClasses.has(value.test_data.classification)) {
    errors.push(`${path}: test_data.classification must be synthetic, sanitized or approved_nonprod`);
  }
  if (!hasExactKeys(value.production_exclusion, [
    'no_production_credentials',
    'no_production_configuration',
    'no_production_data',
    'no_production_traffic',
  ])) {
    errors.push(`${path}: production_exclusion must contain the exact four production-boundary booleans`);
  }
  if (!hasExactKeys(value.lifecycle_procedures, ['start', 'stop', 'reset', 'seed', 'rollback'])) {
    errors.push(`${path}: lifecycle_procedures must contain start, stop, reset, seed and rollback`);
  } else {
    for (const key of ['start', 'stop', 'reset', 'seed', 'rollback']) {
      if (!Array.isArray(value.lifecycle_procedures[key]) || value.lifecycle_procedures[key].some((item) => typeof item !== 'string' || item.length === 0)) {
        errors.push(`${path}: lifecycle_procedures.${key} must be an array of non-empty commands`);
      }
    }
  }
  if (!hasExactKeys(value.negative_smoke, ['tenant_isolation', 'authorization', 'secret_boundary'])) {
    errors.push(`${path}: negative_smoke must contain tenant_isolation, authorization and secret_boundary`);
  } else {
    for (const key of ['tenant_isolation', 'authorization', 'secret_boundary']) {
      if (!Array.isArray(value.negative_smoke[key])) {
        errors.push(`${path}: negative_smoke.${key} must be an array`);
        continue;
      }
      for (const item of value.negative_smoke[key]) {
        if (
          !hasExactKeys(item, ['name', 'status'])
          || typeof item.name !== 'string'
          || item.name.length === 0
          || !allowedSmokeStatuses.has(item.status)
        ) {
          errors.push(`${path}: negative_smoke.${key} entries must contain name and pass/fail/hold status`);
        }
      }
    }
  }
  if (!hasExactKeys(value.open_findings, ['critical', 'high', 'notes'])) {
    errors.push(`${path}: open_findings must contain critical, high and notes`);
  }
  if (!hasExactKeys(value.evidence, ['directory', 'artifacts', 'limitations', 'final_profile_verdict'])) {
    errors.push(`${path}: evidence must contain directory, artifacts, limitations and final_profile_verdict`);
  } else {
    if (!Array.isArray(value.evidence.artifacts)) {
      errors.push(`${path}: evidence.artifacts must be an array`);
    } else {
      for (const artifact of value.evidence.artifacts) {
        if (
          !hasExactKeys(artifact, ['path', 'sha256'])
          || typeof artifact.path !== 'string'
          || artifact.path.length === 0
          || !sha256Pattern.test(artifact.sha256)
        ) {
          errors.push(`${path}: evidence must record artifact digests`);
        }
      }
    }
    if (!allowedProfiles.has(value.evidence.final_profile_verdict)) {
      errors.push(`${path}: evidence.final_profile_verdict must use a known profile label`);
    }
  }
  if (!hasExactKeys(value.network_exposure, ['mode', 'surfaces', 'notes'])) {
    errors.push(`${path}: network_exposure must contain mode, surfaces and notes`);
  } else {
    if (!['local_only', 'bounded_nonprod'].includes(value.network_exposure.mode)) {
      errors.push(`${path}: network exposure must stay local-only or explicitly bounded`);
    }
    if (!Array.isArray(value.network_exposure.surfaces)) {
      errors.push(`${path}: network_exposure.surfaces must be an array`);
    } else {
      for (const surface of value.network_exposure.surfaces) {
        if (
          !hasExactKeys(surface, ['bind', 'purpose'])
          || typeof surface.bind !== 'string'
          || surface.bind.length === 0
          || typeof surface.purpose !== 'string'
          || surface.purpose.length === 0
        ) {
          errors.push(`${path}: network_exposure.surfaces entries must contain bind and purpose`);
        }
      }
    }
  }
  if (!hasExactKeys(value.disposition, ['profile', 'rationale'])) {
    errors.push(`${path}: disposition must contain profile and rationale`);
  } else if (!allowedProfiles.has(value.disposition.profile)) {
    errors.push(`${path}: disposition.profile must use a known profile label`);
  }
  return errors;
};

const evaluateSmokeChecks = (checks, label, path, errors) => {
  if (!Array.isArray(checks) || checks.length === 0) {
    errors.push(`${path}: ${label} must contain at least one recorded check`);
    return 'hold';
  }
  const hasFailure = checks.some((check) => check.status === 'fail');
  const hasHold = checks.some((check) => check.status === 'hold');
  if (hasHold) {
    errors.push(`${path}: ${label} must be pass before runtime admission`);
  }
  if (hasFailure) {
    return 'fail';
  }
  if (hasHold) {
    return 'hold';
  }
  return 'pass';
};

const isPathOutside = (basePath, targetPath) => {
  const delta = relative(basePath, targetPath);
  return delta === '..' || delta.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(delta);
};

const validateRecordedArtifact = ({
  root,
  recordPath,
  evidenceDir,
  artifactPath,
  artifactSha256,
  errors,
  requireInsideEvidenceDir,
}) => {
  if (!artifactPath) {
    return;
  }

  if (isAbsolute(artifactPath)) {
    errors.push(`${recordPath}: evidence artifact paths must be relative to the repository root`);
    return;
  }
  const resolvedArtifactPath = resolve(root, artifactPath);
  if (isPathOutside(root, resolvedArtifactPath)) {
    errors.push(`${recordPath}: evidence artifact paths must not traverse outside the repository root`);
    return;
  }
  if (requireInsideEvidenceDir) {
    if (isAbsolute(evidenceDir)) {
      errors.push(`${recordPath}: candidate.evidence.directory must stay inside the repository root`);
      return;
    }
    const resolvedEvidenceDir = resolve(root, evidenceDir);
    if (isPathOutside(root, resolvedEvidenceDir)) {
      errors.push(`${recordPath}: candidate.evidence.directory must stay inside the repository root`);
      return;
    }
    if (isPathOutside(resolvedEvidenceDir, resolvedArtifactPath)) {
      if (artifactPath.includes('..')) {
        errors.push(`${recordPath}: evidence artifact paths must not traverse outside the declared evidence directory`);
      } else {
        errors.push(`${recordPath}: evidence artifacts must stay inside candidate.evidence.directory`);
      }
      return;
    }
  }

  let artifactLinkStats;
  try {
    artifactLinkStats = lstatSync(resolvedArtifactPath);
  } catch {
    errors.push(`${recordPath}: evidence artifact path must resolve to a readable regular file`);
    return;
  }
  if (artifactLinkStats.isSymbolicLink()) {
    errors.push(`${recordPath}: evidence artifact path must resolve to a readable regular file`);
    return;
  }

  let artifactStats;
  try {
    artifactStats = statSync(resolvedArtifactPath);
  } catch {
    errors.push(`${recordPath}: evidence artifact path must resolve to a readable regular file`);
    return;
  }
  if (!artifactStats.isFile()) {
    errors.push(`${recordPath}: evidence artifact path must resolve to a readable regular file`);
    return;
  }

  let canonicalRoot;
  let canonicalArtifactPath;
  try {
    canonicalRoot = realpathSync(root);
    canonicalArtifactPath = realpathSync(resolvedArtifactPath);
  } catch {
    errors.push(`${recordPath}: evidence artifact path must resolve to a readable regular file`);
    return;
  }
  if (isPathOutside(canonicalRoot, canonicalArtifactPath)) {
    errors.push(`${recordPath}: evidence artifact paths must not resolve outside the repository root`);
    return;
  }
  if (requireInsideEvidenceDir) {
    let canonicalEvidenceDir;
    try {
      canonicalEvidenceDir = realpathSync(resolve(root, evidenceDir));
    } catch {
      errors.push(`${recordPath}: candidate.evidence.directory must resolve inside the repository root`);
      return;
    }
    if (
      isPathOutside(canonicalRoot, canonicalEvidenceDir)
      || isPathOutside(canonicalEvidenceDir, canonicalArtifactPath)
    ) {
      errors.push(`${recordPath}: evidence artifacts must resolve inside candidate.evidence.directory`);
      return;
    }
  }

  let bytes;
  try {
    bytes = readFileSync(resolvedArtifactPath);
  } catch {
    errors.push(`${recordPath}: evidence artifact path must resolve to a readable regular file`);
    return;
  }

  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== artifactSha256) {
    errors.push(`${recordPath}: evidence artifact sha256 must match the recorded bytes`);
  }
};

const validateEvidenceArtifacts = (root, candidate, path, errors) => {
  if (!candidate.evidence.directory) {
    return;
  }

  for (const artifact of candidate.evidence.artifacts) {
    validateRecordedArtifact({
      root,
      recordPath: path,
      evidenceDir: candidate.evidence.directory,
      artifactPath: artifact.path,
      artifactSha256: artifact.sha256,
      errors,
      requireInsideEvidenceDir: true,
    });
  }
};

const validateAttemptAccounting = (root, candidate, path, errors) => {
  const accounting = candidate.attempt_accounting;
  const recoveryOverride = accounting.recovery_override ?? null;
  const expectedCandidateId = `${accounting.series_id}-r${accounting.attempt_ordinal}`;
  if (candidate.candidate_id !== expectedCandidateId) {
    errors.push(`${path}: candidate_id must equal attempt_accounting series_id plus -r<attempt_ordinal>`);
  }
  const admittedOrdinalCeiling = accounting.max_attempts
    + (recoveryOverride?.additional_attempts === 1 ? 1 : 0);
  if (accounting.attempt_ordinal > admittedOrdinalCeiling) {
    errors.push(`${path}: attempt_accounting.attempt_ordinal must be <= max_attempts`);
  }
  if (recoveryOverride) {
    if (accounting.attempt_ordinal !== accounting.max_attempts + 1) {
      errors.push(`${path}: recovery_override is valid only at max_attempts + 1`);
    }
    if (
      accounting.current_attempt.execution_authorized === true
      && recoveryOverride.review_status !== 'independently_reviewed_go'
    ) {
      errors.push(`${path}: recovery execution requires independently_reviewed_go`);
    }
    validateRecordedArtifact({
      root,
      recordPath: `${path}: attempt_accounting.recovery_override`,
      evidenceDir: candidate.evidence.directory,
      artifactPath: recoveryOverride.correction_evidence_path,
      artifactSha256: recoveryOverride.correction_evidence_sha256,
      errors,
      requireInsideEvidenceDir: true,
    });
    const correctionArtifactRecorded = candidate.evidence.artifacts.some(
      (artifact) =>
        artifact.path === recoveryOverride.correction_evidence_path
        && artifact.sha256 === recoveryOverride.correction_evidence_sha256,
    );
    if (!correctionArtifactRecorded) {
      errors.push(`${path}: recovery correction evidence must be listed in evidence.artifacts`);
    }
    if (
      recoveryOverride.review_status === 'pending'
      && (
        recoveryOverride.review_evidence_path !== undefined
        || recoveryOverride.review_evidence_sha256 !== undefined
      )
    ) {
      errors.push(`${path}: pending recovery review must not carry review evidence`);
    }
    if (recoveryOverride.review_status === 'independently_reviewed_go') {
      if (
        recoveryOverride.review_evidence_path
        === recoveryOverride.correction_evidence_path
      ) {
        errors.push(`${path}: recovery review evidence must be distinct from correction evidence`);
      }
      validateRecordedArtifact({
        root,
        recordPath: `${path}: attempt_accounting.recovery_override`,
        evidenceDir: candidate.evidence.directory,
        artifactPath: recoveryOverride.review_evidence_path,
        artifactSha256: recoveryOverride.review_evidence_sha256,
        errors,
        requireInsideEvidenceDir: true,
      });
      const reviewArtifactRecorded = candidate.evidence.artifacts.some(
        (artifact) =>
          artifact.path === recoveryOverride.review_evidence_path
          && artifact.sha256 === recoveryOverride.review_evidence_sha256,
      );
      if (!reviewArtifactRecorded) {
        errors.push(`${path}: recovery review evidence must be listed in evidence.artifacts`);
      }
    }
  }
  if (accounting.failure_history.length !== accounting.attempt_ordinal - 1) {
    errors.push(`${path}: attempt_accounting.failure_history must contain exactly attempt_ordinal - 1 rows`);
  }

  const validateCounts = (subjectPath, record, { allowZeroExecution, requireNoGoDisposition = false } = {}) => {
    if (record.executed_checks !== record.passed_checks + record.failed_checks) {
      errors.push(`${subjectPath}: executed_checks must equal passed_checks + failed_checks`);
    }
    if (record.status === 'not_run') {
      if (!(record.executed_checks === 0 && record.passed_checks === 0 && record.failed_checks === 0)) {
        errors.push(`${subjectPath}: status not_run requires all counts to be zero`);
      }
    }
    if (record.status === 'passed') {
      if (!(record.executed_checks > 0 && record.failed_checks === 0)) {
        errors.push(`${subjectPath}: status passed requires executed_checks > 0 and failed_checks = 0`);
      }
      if (record.execution_authorized !== false) {
        errors.push(`${subjectPath}: execution_authorized must be false for status passed`);
      }
    }
    if (record.status === 'failed') {
      if (!(record.executed_checks > 0 && record.failed_checks > 0)) {
        errors.push(`${subjectPath}: status failed requires executed_checks > 0 and failed_checks > 0`);
      }
      if (record.execution_authorized !== false) {
        errors.push(`${subjectPath}: execution_authorized must be false for status failed`);
      }
    }
    if (!allowZeroExecution && record.executed_checks === 0) {
      errors.push(`${subjectPath}: executed_checks must be > 0 for historical failed attempts`);
    }
    if (requireNoGoDisposition && record.disposition !== 'NO-GO') {
      errors.push(`${subjectPath}: failure_history disposition must stay NO-GO`);
    }
  };

  validateCounts(`${path}: attempt_accounting.current_attempt`, accounting.current_attempt, {
    allowZeroExecution: true,
  });
  validateRecordedArtifact({
    root,
    recordPath: `${path}: attempt_accounting.current_attempt`,
    evidenceDir: candidate.evidence.directory,
    artifactPath: accounting.current_attempt.evidence_path,
    artifactSha256: accounting.current_attempt.evidence_sha256,
    errors,
    requireInsideEvidenceDir: true,
  });

  const seenOrdinals = new Set();
  for (const historyRow of accounting.failure_history) {
    const subjectPath = `${path}: attempt_accounting.failure_history`;
    if (seenOrdinals.has(historyRow.attempt_ordinal)) {
      errors.push(`${subjectPath}: failure_history attempt_ordinal values must be unique`);
      continue;
    }
    seenOrdinals.add(historyRow.attempt_ordinal);
    const expectedHistoryCandidateId = `${accounting.series_id}-r${historyRow.attempt_ordinal}`;
    if (historyRow.candidate_id !== expectedHistoryCandidateId) {
      errors.push(`${subjectPath}: failure_history candidate_id must match the exact prior attempt identifier`);
    }
    validateCounts(subjectPath, {
      ...historyRow,
      status: 'failed',
      execution_authorized: false,
    }, {
      allowZeroExecution: false,
      requireNoGoDisposition: true,
    });
    validateRecordedArtifact({
      root,
      recordPath: subjectPath,
      evidenceDir: candidate.evidence.directory,
      artifactPath: historyRow.evidence_path,
      artifactSha256: historyRow.evidence_sha256,
      errors,
      requireInsideEvidenceDir: false,
    });
  }
  for (let ordinal = 1; ordinal < accounting.attempt_ordinal; ordinal += 1) {
    if (!seenOrdinals.has(ordinal)) {
      errors.push(`${path}: attempt_accounting.failure_history must enumerate every prior ordinal exactly once`);
    }
  }

  return {
    currentAttemptStatus: accounting.current_attempt.status,
    executionAuthorized: accounting.current_attempt.execution_authorized,
    recoveryOverride,
  };
};

const deriveDisposition = (root, candidate, path) => {
  const errors = [];
  let hold = false;
  let noGo = false;

  const attemptErrors = [];
  const attemptAccounting = validateAttemptAccounting(root, candidate, path, attemptErrors);
  if (attemptErrors.length > 0) {
    errors.push(...attemptErrors);
    hold = true;
  }

  const requiredChecks = candidate.hosted_ci.required_checks;
  const coveredRepos = new Set(requiredChecks.map((check) => check.repo));
  if (!expectedRepositories.every((repo) => coveredRepos.has(repo))) {
    errors.push(`${path}: required hosted CI must cover every repository at least once`);
    hold = true;
  }

  const requiredCheckPairs = new Set();
  for (const check of requiredChecks) {
    const pairKey = `${check.repo}\u0000${check.name}`;
    if (requiredCheckPairs.has(pairKey)) {
      errors.push(`${path}: required hosted checks must not duplicate repo and name pairs`);
      hold = true;
      break;
    }
    requiredCheckPairs.add(pairKey);
  }

  if (requiredChecks.some((check) => check.status !== 'success')) {
    errors.push(`${path}: required hosted checks must all be success`);
    hold = true;
  }
  for (const check of requiredChecks) {
    if (check.sha !== candidate.commit_tree[check.repo].commit) {
      errors.push(`${path}: required check ${check.name} must point at the exact candidate tuple SHA`);
      hold = true;
    }
  }

  if (!candidate.contracts.reviewed_contracts.length) {
    errors.push(`${path}: reviewed contracts must be explicit`);
    hold = true;
  }
  if (!candidate.contracts.feature_flags.length) {
    errors.push(`${path}: feature flags must be explicit`);
    hold = true;
  }
  if (!candidate.contracts.capability_lifecycle.length) {
    errors.push(`${path}: capability lifecycle must be explicit`);
    hold = true;
  }
  if (!candidate.test_data.approved) {
    errors.push(`${path}: test data must be explicitly approved for non-production use`);
    hold = true;
  }
  if (!allowedTestDataClasses.has(candidate.test_data.classification)) {
    errors.push(`${path}: test_data.classification must be synthetic, sanitized or approved_nonprod`);
    hold = true;
  }

  for (const [key, label] of Object.entries({
    no_production_credentials: 'no production credentials',
    no_production_configuration: 'no production configuration',
    no_production_data: 'no production data',
    no_production_traffic: 'no production traffic',
  })) {
    if (candidate.production_exclusion[key] !== true) {
      errors.push(`${path}: ${label} boundary failed`);
      noGo = true;
    }
  }

  for (const [key, label] of Object.entries({
    start: 'start',
    stop: 'stop',
    reset: 'reset',
    seed: 'seed',
    rollback: 'rollback',
  })) {
    if (candidate.lifecycle_procedures[key].length === 0) {
      errors.push(`${path}: lifecycle procedures must include ${label}`);
      hold = true;
    }
  }

  const tenantSmoke = evaluateSmokeChecks(
    candidate.negative_smoke.tenant_isolation,
    'tenant-isolation smoke',
    path,
    errors,
  );
  const authSmoke = evaluateSmokeChecks(
    candidate.negative_smoke.authorization,
    'authorization-negative smoke',
    path,
    errors,
  );
  const secretSmoke = evaluateSmokeChecks(
    candidate.negative_smoke.secret_boundary,
    'secret-boundary smoke',
    path,
    errors,
  );
  if ([tenantSmoke, authSmoke, secretSmoke].includes('fail')) {
    noGo = true;
  }
  if ([tenantSmoke, authSmoke, secretSmoke].includes('hold')) {
    hold = true;
  }

  if ((candidate.open_findings.critical ?? 0) > 0 || (candidate.open_findings.high ?? 0) > 0) {
    noGo = true;
  }
  if (!candidate.evidence.directory) {
    errors.push(`${path}: evidence directory is required`);
    hold = true;
  }
  if (candidate.evidence.artifacts.length === 0) {
    errors.push(`${path}: evidence must record artifact digests`);
    hold = true;
  } else if (candidate.evidence.artifacts.some((artifact) => !sha256Pattern.test(artifact.sha256))) {
    errors.push(`${path}: evidence must record valid artifact digests`);
    hold = true;
  } else {
    const evidenceErrors = [];
    validateEvidenceArtifacts(root, candidate, path, evidenceErrors);
    if (evidenceErrors.length > 0) {
      errors.push(...evidenceErrors);
      hold = true;
    }
  }
  if (candidate.network_exposure.surfaces.length === 0) {
    errors.push(`${path}: network exposure must stay local-only or explicitly bounded`);
    hold = true;
  }
  if (!['local_only', 'bounded_nonprod'].includes(candidate.network_exposure.mode)) {
    errors.push(`${path}: network exposure must stay local-only or explicitly bounded`);
    hold = true;
  }

  const declaredProfile = candidate.disposition.profile;
  const evidenceProfile = candidate.evidence.final_profile_verdict;
  if (FORBIDDEN_PROFILES.has(declaredProfile) || FORBIDDEN_PROFILES.has(evidenceProfile)) {
    errors.push(`${path}: runtime admission must never imply DEMO_READY_LOCAL, CUSTOMER_POC_READY, RC_READY or FULL_RELEASE_READY`);
    hold = true;
  }
  if (declaredProfile !== evidenceProfile) {
    errors.push(`${path}: disposition.profile must match evidence.final_profile_verdict`);
    hold = true;
  }

  if (attemptAccounting.currentAttemptStatus === 'failed') {
    noGo = true;
  } else if (attemptAccounting.currentAttemptStatus === 'passed') {
    hold = true;
  } else if (attemptAccounting.currentAttemptStatus === 'not_run' && attemptAccounting.executionAuthorized !== true) {
    hold = true;
  }

  const derivedDisposition = noGo ? 'NO-GO' : hold ? 'HOLD' : 'RUNTIME_AUTHORIZED';
  if (declaredProfile !== derivedDisposition) {
    errors.push(`${path}: disposition.profile must equal derived runtime admission disposition ${derivedDisposition}`);
  }

  return {
    declaredDisposition: declaredProfile,
    derivedDisposition,
    errors,
  };
};

const validateTemplate = (template, path) => {
  const errors = [];
  if (template.disposition.profile !== 'HOLD' || template.evidence.final_profile_verdict !== 'HOLD') {
    errors.push(`${path}: template must remain a truthful HOLD record`);
  }
  if (template.hosted_ci.required_checks.length !== 0) {
    errors.push(`${path}: template must not claim hosted CI evidence`);
  }
  if (template.evidence.artifacts.length !== 0) {
    errors.push(`${path}: template must not claim artifact evidence`);
  }
  if (template.contracts.reviewed_contracts.length !== 0) {
    errors.push(`${path}: template must not claim reviewed-contract evidence`);
  }
  return errors;
};

const validateLineagePolicy = ({
  root,
  overrides,
  policy,
  records,
}) => {
  const findings = [];
  const addFinding = (path, message) => {
    findings.push({ path, message: `${path}: ${message}` });
  };
  if (!hasExactKeys(policy, ['schema_version', 'allowed_objectives', 'legacy_candidates'])) {
    addFinding(
      LINEAGE_POLICY_PATH,
      'must contain exactly schema_version, allowed_objectives and legacy_candidates',
    );
    return findings;
  }
  if (policy.schema_version !== '1.0.0') {
    addFinding(LINEAGE_POLICY_PATH, 'schema_version must equal 1.0.0');
  }
  if (!Array.isArray(policy.allowed_objectives)) {
    addFinding(LINEAGE_POLICY_PATH, 'allowed_objectives must be an array');
    return findings;
  }
  const allowedObjectiveKeys = new Set();
  for (const allowedObjective of policy.allowed_objectives) {
    if (
      !hasExactKeys(allowedObjective, ['capability_id', 'objective_id'])
      || typeof allowedObjective.capability_id !== 'string'
      || allowedObjective.capability_id.length === 0
      || typeof allowedObjective.objective_id !== 'string'
      || allowedObjective.objective_id.length === 0
    ) {
      addFinding(
        LINEAGE_POLICY_PATH,
        'allowed_objectives entries must contain non-empty capability_id and objective_id',
      );
      continue;
    }
    const objectiveKey =
      `${allowedObjective.capability_id}\u0000${allowedObjective.objective_id}`;
    if (allowedObjectiveKeys.has(objectiveKey)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        'allowed_objectives capability_id/objective_id pairs must be unique',
      );
    }
    allowedObjectiveKeys.add(objectiveKey);
  }
  if (allowedObjectiveKeys.size === 0) {
    addFinding(LINEAGE_POLICY_PATH, 'allowed_objectives must not be empty');
  }

  if (!Array.isArray(policy.legacy_candidates)) {
    addFinding(LINEAGE_POLICY_PATH, 'legacy_candidates must be an array');
    return findings;
  }
  if (
    JSON.stringify(policy.legacy_candidates) !== JSON.stringify(SEALED_LEGACY_CANDIDATES)
  ) {
    addFinding(
      LINEAGE_POLICY_PATH,
      'legacy_candidates must equal the sealed R1/R2/R3 set exactly; future candidates cannot be grandfathered',
    );
  }

  const recordsById = new Map(
    records.map((record) => [record.candidate.candidate_id, record]),
  );
  const legacyById = new Map();
  const legacyByPath = new Map();
  const entryFields = [
    'candidate_id',
    'series_id',
    'capability_id',
    'objective_id',
    'record_path',
    'record_sha256',
    'recorded_disposition',
  ];

  for (const entry of policy.legacy_candidates) {
    if (!hasExactKeys(entry, entryFields)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate entries must contain exactly ${entryFields.join(', ')}`,
      );
      continue;
    }
    if (
      typeof entry.candidate_id !== 'string'
      || entry.candidate_id.length === 0
      || typeof entry.series_id !== 'string'
      || entry.series_id.length === 0
      || typeof entry.capability_id !== 'string'
      || entry.capability_id.length === 0
      || typeof entry.objective_id !== 'string'
      || entry.objective_id.length === 0
      || typeof entry.record_path !== 'string'
      || entry.record_path.length === 0
      || !sha256Pattern.test(entry.record_sha256)
      || entry.recorded_disposition !== 'NO-GO'
    ) {
      addFinding(
        LINEAGE_POLICY_PATH,
        'legacy candidate entries must use non-empty identifiers, a relative record path, a 64-hex digest and NO-GO disposition',
      );
      continue;
    }
    const entryObjectiveKey = `${entry.capability_id}\u0000${entry.objective_id}`;
    if (!allowedObjectiveKeys.has(entryObjectiveKey)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} must use an allowed capability/objective pair`,
      );
    }
    if (isAbsolute(entry.record_path)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} record_path must be relative to the repository root`,
      );
      continue;
    }
    const resolvedRecordPath = resolve(root, entry.record_path);
    if (isPathOutside(root, resolvedRecordPath)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} record_path must stay inside the repository root`,
      );
      continue;
    }
    let recordLinkStats;
    try {
      recordLinkStats = lstatSync(resolvedRecordPath);
    } catch {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} record_path must resolve to a readable regular file`,
      );
      continue;
    }
    if (recordLinkStats.isSymbolicLink() || !recordLinkStats.isFile()) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} record_path must resolve to a non-symlink regular file`,
      );
      continue;
    }
    let canonicalRoot;
    let canonicalRecordPath;
    try {
      canonicalRoot = realpathSync(root);
      canonicalRecordPath = realpathSync(resolvedRecordPath);
    } catch {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} record_path must resolve to a readable regular file`,
      );
      continue;
    }
    if (isPathOutside(canonicalRoot, canonicalRecordPath)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} record_path must not resolve outside the repository root`,
      );
      continue;
    }
    if (legacyById.has(entry.candidate_id)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate_id ${entry.candidate_id} must be unique`,
      );
      continue;
    }
    if (legacyByPath.has(entry.record_path)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy record_path ${entry.record_path} must be unique`,
      );
      continue;
    }
    legacyById.set(entry.candidate_id, entry);
    legacyByPath.set(entry.record_path, entry);

    const record = recordsById.get(entry.candidate_id);
    if (!record) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} must resolve to a schema-valid registry record`,
      );
      continue;
    }
    if (
      record.path !== entry.record_path
      || record.candidate.attempt_accounting.series_id !== entry.series_id
      || record.candidate.disposition.profile !== entry.recorded_disposition
    ) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} identity and disposition must match the pinned registry record`,
      );
      continue;
    }
    let recordBytes;
    try {
      recordBytes = readText(root, entry.record_path, overrides);
    } catch (error) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} bytes are unreadable: ${error.message}`,
      );
      continue;
    }
    const actualRecordSha = createHash('sha256').update(recordBytes).digest('hex');
    if (actualRecordSha !== entry.record_sha256) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `legacy candidate ${entry.candidate_id} record_sha256 must match immutable record bytes`,
      );
    }
  }

  const evidenceOwnersBySha = new Map();
  const evidenceDigestsByCandidateId = new Map();
  for (const record of records) {
    const candidate = record.candidate;
    const evidenceDigests = new Set([
      candidate.attempt_accounting.current_attempt.evidence_sha256,
      ...candidate.evidence.artifacts.map((artifact) => artifact.sha256),
      ...candidate.attempt_accounting.failure_history.map(
        (historyRow) => historyRow.evidence_sha256,
      ),
    ]);
    evidenceDigestsByCandidateId.set(candidate.candidate_id, evidenceDigests);
    for (const digest of evidenceDigests) {
      const owners = evidenceOwnersBySha.get(digest) ?? [];
      owners.push({
        candidateId: candidate.candidate_id,
        seriesId: candidate.attempt_accounting.series_id,
      });
      evidenceOwnersBySha.set(digest, owners);
    }
  }
  for (const record of records) {
    const candidate = record.candidate;
    const seriesId = candidate.attempt_accounting.series_id;
    for (const digest of evidenceDigestsByCandidateId.get(candidate.candidate_id) ?? []) {
      const foreignOwner = (evidenceOwnersBySha.get(digest) ?? []).find(
        (owner) => owner.seriesId !== seriesId,
      );
      if (foreignOwner) {
        addFinding(
          record.path,
          `cross-series execution evidence SHA-256 must be unique; digest is already owned by ${foreignOwner.candidateId}`,
        );
      }
    }
  }

  const objectiveMetadataByCandidateId = new Map();
  for (const entry of legacyById.values()) {
    objectiveMetadataByCandidateId.set(entry.candidate_id, {
      capability_id: entry.capability_id,
      objective_id: entry.objective_id,
    });
  }
  for (const record of records) {
    if (legacyById.has(record.candidate.candidate_id)) continue;
    const lineage = record.candidate.attempt_accounting.objective_lineage;
    if (lineage) {
      objectiveMetadataByCandidateId.set(record.candidate.candidate_id, {
        capability_id: lineage.capability_id,
        objective_id: lineage.objective_id,
      });
    }
  }

  const terminalObjectives = new Map();
  for (const record of records) {
    const objectiveMetadata =
      objectiveMetadataByCandidateId.get(record.candidate.candidate_id);
    if (!objectiveMetadata) continue;
    const accounting = record.candidate.attempt_accounting;
    const admittedCeiling = accounting.max_attempts
      + (accounting.recovery_override?.additional_attempts === 1 ? 1 : 0);
    if (
      accounting.attempt_ordinal === admittedCeiling
      && accounting.current_attempt.status === 'failed'
      && record.candidate.disposition.profile === 'NO-GO'
    ) {
      const objectiveKey =
        `${objectiveMetadata.capability_id}\u0000${objectiveMetadata.objective_id}`;
      const terminalSeries = terminalObjectives.get(objectiveKey) ?? new Set();
      terminalSeries.add(accounting.series_id);
      terminalObjectives.set(objectiveKey, terminalSeries);
    }
  }

  for (const record of records) {
    const candidate = record.candidate;
    const lineage = candidate.attempt_accounting.objective_lineage;
    if (!lineage) {
      if (!legacyById.has(candidate.candidate_id)) {
        addFinding(
          record.path,
          'new runtime-admission series must declare objective_lineage',
        );
      }
      continue;
    }

    const objectiveKey = `${lineage.capability_id}\u0000${lineage.objective_id}`;
    if (!allowedObjectiveKeys.has(objectiveKey)) {
      addFinding(
        record.path,
        'objective_lineage capability_id/objective_id must be registered in allowed_objectives',
      );
    }
    const terminalSeries = terminalObjectives.get(objectiveKey) ?? new Set();
    if (
      [...terminalSeries].some(
        (seriesId) => seriesId !== candidate.attempt_accounting.series_id,
      )
    ) {
      addFinding(
        record.path,
        'objective_lineage cannot reopen a terminal capability/objective under a new series_id',
      );
    }

    const seenPrerequisites = new Set();
    for (const prerequisite of lineage.historical_prerequisites) {
      if (prerequisite.evidence_use !== 'historical_prerequisite') {
        addFinding(
          record.path,
          'historical prerequisite evidence must be non-authorizing',
        );
      }
      if (seenPrerequisites.has(prerequisite.candidate_id)) {
        addFinding(
          record.path,
          'objective_lineage historical prerequisite candidate_id values must be unique',
        );
        continue;
      }
      seenPrerequisites.add(prerequisite.candidate_id);

      const legacy = legacyById.get(prerequisite.candidate_id);
      const priorRecord = recordsById.get(prerequisite.candidate_id);
      if (!legacy || !priorRecord) {
        addFinding(
          record.path,
          'objective_lineage historical prerequisites must resolve to an immutable legacy candidate',
        );
        continue;
      }
      if (
        prerequisite.record_path !== legacy.record_path
        || prerequisite.record_sha256 !== legacy.record_sha256
      ) {
        addFinding(
          record.path,
          'objective_lineage historical prerequisite record path and digest must match the immutable lineage policy',
        );
      }
      const priorCandidate = priorRecord.candidate;
      if (
        priorCandidate.disposition.profile !== 'NO-GO'
        || priorCandidate.attempt_accounting.current_attempt.status !== 'failed'
      ) {
        addFinding(
          record.path,
          'objective_lineage historical prerequisites must reference a failed NO-GO legacy candidate',
        );
      }
      const evidenceMatches = [
        {
          path: priorCandidate.attempt_accounting.current_attempt.evidence_path,
          sha256: priorCandidate.attempt_accounting.current_attempt.evidence_sha256,
        },
        ...priorCandidate.evidence.artifacts,
      ].some((artifact) =>
        artifact.path === prerequisite.evidence_path
        && artifact.sha256 === prerequisite.evidence_sha256);
      if (!evidenceMatches) {
        addFinding(
          record.path,
          'objective_lineage historical prerequisite evidence must match evidence recorded by the legacy candidate',
        );
      }
      const artifactErrors = [];
      validateRecordedArtifact({
        root,
        recordPath: `${record.path}: attempt_accounting.objective_lineage`,
        evidenceDir: candidate.evidence.directory,
        artifactPath: prerequisite.evidence_path,
        artifactSha256: prerequisite.evidence_sha256,
        errors: artifactErrors,
        requireInsideEvidenceDir: false,
      });
      for (const message of artifactErrors) {
        findings.push({ path: record.path, message });
      }
      if (
        candidate.attempt_accounting.current_attempt.evidence_path
          === prerequisite.evidence_path
        || candidate.attempt_accounting.current_attempt.evidence_sha256
          === prerequisite.evidence_sha256
      ) {
        addFinding(
          record.path,
          'current attempt evidence must be fresh and must not reuse historical prerequisite evidence',
        );
      }
      if (candidate.evidence.artifacts.some(
        (artifact) => artifact.sha256 === prerequisite.evidence_sha256,
      )) {
        addFinding(
          record.path,
          'candidate evidence artifacts must not copy historical prerequisite bytes',
        );
      }
      if (candidate.attempt_accounting.failure_history.some(
        (historyRow) => historyRow.evidence_sha256 === prerequisite.evidence_sha256,
      )) {
        addFinding(
          record.path,
          'failure history must not reuse cross-series historical prerequisite bytes',
        );
      }
    }
  }

  return findings;
};

const validateCandidateRegistry = (records) => {
  const findings = [];
  const byCandidateId = new Map();
  const bySeriesOrdinal = new Map();
  const bySeries = new Map();
  const addFinding = (record, message) => {
    findings.push({
      path: record.path,
      message: `${record.path}: ${message}`,
    });
  };

  for (const record of records) {
    const { candidate, path } = record;
    const parentDirectory = basename(dirname(path));
    if (parentDirectory !== candidate.candidate_id) {
      addFinding(record, 'parent directory must equal candidate_id');
    }

    const existingCandidate = byCandidateId.get(candidate.candidate_id);
    if (existingCandidate) {
      addFinding(record, 'candidate_id must be unique across the registry');
      addFinding(existingCandidate, 'candidate_id must be unique across the registry');
    } else {
      byCandidateId.set(candidate.candidate_id, record);
    }

    const accounting = candidate.attempt_accounting;
    const seriesOrdinalKey = `${accounting.series_id}\u0000${accounting.attempt_ordinal}`;
    const existingSeriesOrdinal = bySeriesOrdinal.get(seriesOrdinalKey);
    if (existingSeriesOrdinal) {
      addFinding(record, 'series_id and attempt_ordinal must be unique across the registry');
      addFinding(
        existingSeriesOrdinal,
        'series_id and attempt_ordinal must be unique across the registry',
      );
    } else {
      bySeriesOrdinal.set(seriesOrdinalKey, record);
    }

    const seriesRecords = bySeries.get(accounting.series_id) ?? [];
    seriesRecords.push(record);
    bySeries.set(accounting.series_id, seriesRecords);
  }

  for (const seriesRecords of bySeries.values()) {
    seriesRecords.sort(
      (left, right) =>
        left.candidate.attempt_accounting.attempt_ordinal
        - right.candidate.attempt_accounting.attempt_ordinal,
    );
    const firstRecord = seriesRecords[0];
    const seriesMaxAttempts = firstRecord.candidate.attempt_accounting.max_attempts;
    const recoveryRecords = seriesRecords.filter(
      (record) => record.candidate.attempt_accounting.recovery_override,
    );
    if (recoveryRecords.length > 1) {
      for (const record of recoveryRecords) {
        addFinding(record, 'a series may contain at most one recovery_override');
      }
    }
    for (const record of seriesRecords) {
      const accounting = record.candidate.attempt_accounting;
      if (accounting.max_attempts !== seriesMaxAttempts) {
        addFinding(
          record,
          'max_attempts must match the first candidate in the series',
        );
      }

      for (const historyRow of accounting.failure_history) {
        const priorRecord = byCandidateId.get(historyRow.candidate_id);
        if (!priorRecord) {
          addFinding(
            record,
            `failure_history candidate ${historyRow.candidate_id} must resolve to a registry record`,
          );
          continue;
        }
        const priorCandidate = priorRecord.candidate;
        const priorAttempt = priorCandidate.attempt_accounting.current_attempt;
        if (
          priorCandidate.attempt_accounting.series_id !== accounting.series_id
          || priorCandidate.attempt_accounting.attempt_ordinal
            !== historyRow.attempt_ordinal
          || priorCandidate.disposition.profile !== 'NO-GO'
          || priorAttempt.status !== 'failed'
        ) {
          addFinding(
            record,
            'failure_history must reference a failed NO-GO candidate in the same series',
          );
        }
        if (
          priorAttempt.executed_checks !== historyRow.executed_checks
          || priorAttempt.passed_checks !== historyRow.passed_checks
          || priorAttempt.failed_checks !== historyRow.failed_checks
        ) {
          addFinding(
            record,
            'failure_history counts must match the referenced prior candidate',
          );
        }
        if (
          priorAttempt.evidence_path !== historyRow.evidence_path
          || priorAttempt.evidence_sha256 !== historyRow.evidence_sha256
        ) {
          addFinding(
            record,
            'failure_history evidence must match the referenced prior candidate',
          );
        }
      }

      const recoveryOverride = accounting.recovery_override;
      if (recoveryOverride) {
        const terminalRecord = byCandidateId.get(
          recoveryOverride.terminal_candidate_id,
        );
        if (!terminalRecord) {
          addFinding(
            record,
            'recovery_override terminal_candidate_id must resolve to a registry record',
          );
          continue;
        }
        const terminalCandidate = terminalRecord.candidate;
        const terminalAttempt = terminalCandidate.attempt_accounting.current_attempt;
        if (
          terminalCandidate.attempt_accounting.series_id !== accounting.series_id
          || terminalCandidate.attempt_accounting.attempt_ordinal !== seriesMaxAttempts
          || recoveryOverride.terminal_attempt_ordinal !== seriesMaxAttempts
          || terminalCandidate.disposition.profile !== 'NO-GO'
          || terminalAttempt.status !== 'failed'
        ) {
          addFinding(
            record,
            'recovery_override must bind the failed terminal NO-GO at max_attempts in the same series',
          );
        }
        if (
          recoveryOverride.terminal_evidence_path !== terminalAttempt.evidence_path
          || recoveryOverride.terminal_evidence_sha256 !== terminalAttempt.evidence_sha256
        ) {
          addFinding(
            record,
            'recovery_override terminal evidence must match the terminal candidate exactly',
          );
        }
      }
    }
  }

  return findings;
};

export async function validateRuntimeAdmission({
  root = DEFAULT_ROOT,
  overrides = new Map(),
} = {}) {
  const errors = [];
  if (!existsSync(join(root, README_PATH))) {
    errors.push(`${README_PATH}: missing`);
  }
  const validator = compileSchema(root, overrides, errors);
  const template = parseJson(root, TEMPLATE_PATH, overrides, errors);
  const lineagePolicy = parseJson(root, LINEAGE_POLICY_PATH, overrides, errors);
  if (validator && template) {
    validateAgainstSchema(validator, TEMPLATE_PATH, template, errors);
  }
  if (template) {
    errors.push(...validateTemplate(template, TEMPLATE_PATH));
  }

  const discoveredFiles = discoverRuntimeAdmissionFiles(root);
  const candidateFiles = discoverCandidateFiles(root);
  for (const path of discoveredFiles) {
    if (!candidateFiles.includes(path)) {
      errors.push(`${path}: mislocated runtime-admission.json; expected docs/uat/candidates/<candidate-id>/runtime-admission.json`);
    }
  }
  const candidates = [];
  const registryRecords = [];
  const reportsByPath = new Map();
  for (const path of candidateFiles) {
    const candidateErrors = [];
    const candidate = parseJson(root, path, overrides, candidateErrors);
    let declaredDisposition = null;
    let derivedDisposition = 'HOLD';
    let schemaValid = false;
    if (candidate) {
      declaredDisposition = candidate.disposition?.profile ?? null;
      if (validator) {
        schemaValid = validateAgainstSchema(validator, path, candidate, candidateErrors);
      }
      if (candidateErrors.length === 0) {
        try {
          const result = deriveDisposition(root, candidate, path);
          declaredDisposition = result.declaredDisposition;
          derivedDisposition = result.derivedDisposition;
          candidateErrors.push(...result.errors);
        } catch (error) {
          candidateErrors.push(`${path}: disposition derivation failed: ${error.message}`);
        }
      }
    }
    if (candidate && schemaValid) {
      registryRecords.push({ path, candidate });
    }
    errors.push(...candidateErrors);
    const candidateReport = {
      path,
      candidateId: candidate?.candidate_id ?? null,
      declaredDisposition,
      derivedDisposition,
      errors: candidateErrors,
    };
    candidates.push(candidateReport);
    reportsByPath.set(path, candidateReport);
  }

  const registryFindings = validateCandidateRegistry(registryRecords);
  if (lineagePolicy) {
    registryFindings.push(...validateLineagePolicy({
      root,
      overrides,
      policy: lineagePolicy,
      records: registryRecords,
    }));
  }
  for (const finding of registryFindings) {
    errors.push(finding.message);
    const candidateReport = reportsByPath.get(finding.path);
    if (candidateReport) {
      candidateReport.errors.push(finding.message);
      if (candidateReport.derivedDisposition !== 'NO-GO') {
        candidateReport.derivedDisposition = 'HOLD';
      }
    }
  }

  const authorizedCandidates = candidates.filter(
    (candidateReport) =>
      candidateReport.errors.length === 0
      && candidateReport.derivedDisposition === 'RUNTIME_AUTHORIZED',
  );
  if (authorizedCandidates.length > 1) {
    for (const candidateReport of authorizedCandidates) {
      const message =
        `${candidateReport.path}: registry may contain at most one RUNTIME_AUTHORIZED candidate`;
      errors.push(message);
      candidateReport.errors.push(message);
      candidateReport.derivedDisposition = 'HOLD';
    }
  }

  return {
    errors,
    counts: {
      candidateFiles: candidateFiles.length,
      templatesValidated: template ? 1 : 0,
    },
    candidates,
  };
}

const formatSummary = (report) => {
  if (report.errors.length) {
    for (const error of report.errors) {
      console.error(`FAIL — ${error}`);
    }
    console.error(
      `FAIL — runtime-admission validation found ${report.errors.length} error(s) across ${report.counts.candidateFiles} candidate file(s).`,
    );
    return 1;
  }
  console.log(
    `RUNTIME ADMISSION: PASS (templates ${report.counts.templatesValidated}, candidates ${report.counts.candidateFiles}). Static admission records only; this grants no DEMO_READY_LOCAL, UAT, POC, RC or GA claim.`,
  );
  return 0;
};

export const isMainModule = (metaUrl, argvPath) => {
  if (typeof metaUrl !== 'string' || typeof argvPath !== 'string') return false;
  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
};

if (isMainModule(import.meta.url, process.argv[1])) {
  const report = await validateRuntimeAdmission();
  process.exit(formatSummary(report));
}
