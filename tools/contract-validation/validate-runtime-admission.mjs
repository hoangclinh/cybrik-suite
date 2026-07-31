import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
  if (checks.some((check) => check.status === 'fail')) {
    errors.push(`${path}: failed ${label} is NO-GO`);
    return 'fail';
  }
  if (checks.some((check) => check.status !== 'pass')) {
    errors.push(`${path}: ${label} must be pass before runtime admission`);
    return 'hold';
  }
  return 'pass';
};

const deriveDisposition = (candidate, path) => {
  const errors = [];
  let hold = false;
  let noGo = false;

  const requiredChecks = candidate.hosted_ci.required_checks;
  if (requiredChecks.length !== expectedRepositories.length) {
    errors.push(`${path}: required hosted CI must cover each repository exactly once`);
    hold = true;
  } else {
    const repos = requiredChecks.map((check) => check.repo);
    if (
      new Set(repos).size !== expectedRepositories.length
      || !expectedRepositories.every((repo) => repos.includes(repo))
    ) {
      errors.push(`${path}: required hosted CI must cover each repository exactly once`);
      hold = true;
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
  } else if ([tenantSmoke, authSmoke, secretSmoke].includes('hold')) {
    hold = true;
  }

  if ((candidate.open_findings.critical ?? 0) > 0 || (candidate.open_findings.high ?? 0) > 0) {
    errors.push(`${path}: open Critical or High finding on the exercised path blocks runtime admission`);
    hold = true;
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
  for (const path of candidateFiles) {
    const candidateErrors = [];
    const candidate = parseJson(root, path, overrides, candidateErrors);
    let declaredDisposition = null;
    let derivedDisposition = 'HOLD';
    if (candidate) {
      declaredDisposition = candidate.disposition?.profile ?? null;
      if (validator) {
        validateAgainstSchema(validator, path, candidate, candidateErrors);
      }
      if (candidateErrors.length === 0) {
        try {
          const result = deriveDisposition(candidate, path);
          declaredDisposition = result.declaredDisposition;
          derivedDisposition = result.derivedDisposition;
          candidateErrors.push(...result.errors);
        } catch (error) {
          candidateErrors.push(`${path}: disposition derivation failed: ${error.message}`);
        }
      }
    }
    errors.push(...candidateErrors);
    candidates.push({
      path,
      candidateId: candidate?.candidate_id ?? null,
      declaredDisposition,
      derivedDisposition,
      errors: candidateErrors,
    });
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
