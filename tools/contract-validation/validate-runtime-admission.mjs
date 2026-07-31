import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');
const SCHEMA_PATH = 'docs/uat/runtime-admission.schema.json';
const README_PATH = 'docs/uat/candidates/README.md';
const TEMPLATE_PATH = 'docs/uat/templates/runtime-admission.hold.json';
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
  if (!hasExactKeys(value.attempt_accounting, [
    'series_id',
    'attempt_ordinal',
    'max_attempts',
    'current_attempt',
    'failure_history',
  ])) {
    errors.push(`${path}: attempt_accounting must contain series_id, attempt_ordinal, max_attempts, current_attempt and failure_history`);
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
  const expectedCandidateId = `${accounting.series_id}-r${accounting.attempt_ordinal}`;
  if (candidate.candidate_id !== expectedCandidateId) {
    errors.push(`${path}: candidate_id must equal attempt_accounting series_id plus -r<attempt_ordinal>`);
  }
  if (accounting.attempt_ordinal > accounting.max_attempts) {
    errors.push(`${path}: attempt_accounting.attempt_ordinal must be <= max_attempts`);
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

  for (const finding of validateCandidateRegistry(registryRecords)) {
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await validateRuntimeAdmission();
  process.exit(formatSummary(report));
}
