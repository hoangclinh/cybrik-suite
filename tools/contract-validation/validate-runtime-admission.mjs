import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');
const SCHEMA_PATH = 'docs/uat/runtime-admission.schema.json';
const README_PATH = 'docs/uat/candidates/README.md';
const TEMPLATE_PATH = 'docs/uat/templates/runtime-admission.hold.json';
const LINEAGE_POLICY_PATH = 'docs/uat/runtime-admission-lineage-policy.json';
const WITHDRAWAL_SCHEMA_PATH = 'docs/uat/runtime-authorization-withdrawal.schema.json';
const WITHDRAWAL_TRUST_PATH = 'docs/uat/runtime-authorization-withdrawal-trust.json';
const MASTER_AUTHORIZATION_TRUST_PATH =
  'integration/compose/soc-ai-fabric-alert-context-mtls/authorization-trust.json';
const WITHDRAWAL_FILENAME = 'runtime-authorization-withdrawal.json';
const WITHDRAWAL_NAMESPACE = 'cybrik-uat-runtime-withdrawal-v1';
const CANDIDATE_ROOT = 'docs/uat/candidates';
const SUITE_REFERENCE_PREFIX = 'cybrik-suite:';
const FORBIDDEN_PROFILES = new Set([
  'DEMO_READY_LOCAL',
  'CUSTOMER_POC_READY',
  'RC_READY',
  'FULL_RELEASE_READY',
]);
const sha256Pattern = /^[0-9a-f]{64}$/;
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
const ALLOWED_LINEAGE_OBJECTIVES = [
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
];
const SEALED_PREDECESSORS = [
  {
    candidate_id: 'browser-integrated-uat-bridge-r1',
    series_id: 'browser-integrated-uat-bridge',
    capability_id: 'cybrik.suite.golden-workflow',
    objective_id: 'golden-uat-v1',
    record_path:
      'docs/uat/candidates/browser-integrated-uat-bridge-r1/runtime-admission.json',
    record_sha256: 'b463b6032a69b68958cd6a470a5a1ac8976ae6778bdb26192a13c5009128e578',
    recorded_disposition: 'HOLD',
    recorded_current_attempt_status: 'not_run',
  },
];
// The one topology rehearsal a runtime successor may cite. Both the identity and
// the exact record bytes are sealed here so no rehearsal can be substituted.
const SEALED_TOPOLOGY_RECORD_ID = 'postgres-loopback-internal-v1-r1';
const SEALED_TOPOLOGY_RECORD_PATH =
  `docs/uat/topology-rehearsals/${SEALED_TOPOLOGY_RECORD_ID}/topology-rehearsal.json`;
// The single already-committed execution-authorized record, which predates the
// sealed_predecessor/topology_prerequisite pair. It is exempt only as these
// exact immutable bytes at this exact path; nothing else in its series inherits
// that exemption.
const GRANDFATHERED_AUTHORIZED_CANDIDATE = {
  candidate_id: 'runtime-admission-soc-ai-lifecycle-mtls-r1',
  record_path:
    'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/runtime-admission.json',
  record_sha256: 'a59acf23125b4ffd912f59459faa4498c7441d00ca8f21b2c148b5d0b7780ba4',
};

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
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};
const isImmutableLineageObjective = (lineage) =>
  ALLOWED_LINEAGE_OBJECTIVES.some(
    (entry) => entry.capability_id === lineage?.capability_id
      && entry.objective_id === lineage?.objective_id,
  );
// Caller-supplied pins exist so a non-default root can be validated without the
// validator trusting that root's own policy file. They may widen the objective
// allowlist with test series, but they can never shrink the immutable seal in
// either direction, and they can never enroll a sealed predecessor.
const validateLineagePolicyPins = (pins) => {
  const errors = [];
  if (canonicalJson(pins?.sealed_predecessors) !== canonicalJson(SEALED_PREDECESSORS)) {
    errors.push(
      `${LINEAGE_POLICY_PATH}: sealed_predecessors must exactly match the validator-immutable sealed set regardless of supplied pins`,
    );
  }
  const suppliedSeriesByObjective = new Map(
    (Array.isArray(pins?.allowed_objectives) ? pins.allowed_objectives : [])
      .filter((entry) => isPlainObject(entry))
      .map((entry) => [
        `${entry.capability_id}\u0000${entry.objective_id}`,
        new Set(Array.isArray(entry.allowed_series_ids) ? entry.allowed_series_ids : []),
      ]),
  );
  const preservesImmutableObjectives = ALLOWED_LINEAGE_OBJECTIVES.every((immutable) => {
    const supplied = suppliedSeriesByObjective.get(
      `${immutable.capability_id}\u0000${immutable.objective_id}`,
    );
    return Boolean(supplied)
      && immutable.allowed_series_ids.every((seriesId) => supplied.has(seriesId));
  });
  if (!preservesImmutableObjectives) {
    errors.push(
      `${LINEAGE_POLICY_PATH}: lineage policy pins must preserve every validator-immutable allowed objective series`,
    );
  }
  return errors;
};
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

const compileWithdrawalSchema = (root, overrides, errors) => {
  const schema = parseJson(root, WITHDRAWAL_SCHEMA_PATH, overrides, errors);
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
    errors.push(`${WITHDRAWAL_SCHEMA_PATH}: schema compile failed: ${error.message}`);
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

const discoverWithdrawalFiles = (root, relativeDir = CANDIDATE_ROOT) => {
  const absoluteDir = join(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  const files = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverWithdrawalFiles(root, relativePath));
    } else if (entry.name === WITHDRAWAL_FILENAME) {
      files.push(relativePath);
    }
  }
  return files.sort();
};

const evaluateSmokeChecks = (checks, label, path, errors) => {
  if (!Array.isArray(checks) || checks.length === 0) {
    errors.push(`${path}: ${label} must contain at least one recorded check`);
    return 'hold';
  }
  const hasFailure = checks.some((check) => check.status === 'fail');
  const hasHold = checks.some((check) => check.status === 'hold');
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

const validateSuiteLocalReviewedContracts = (root, references, path, errors) => {
  let valid = true;
  for (const reference of references) {
    if (!reference.startsWith(SUITE_REFERENCE_PREFIX)) continue;
    const relativePath = reference.slice(SUITE_REFERENCE_PREFIX.length);
    const resolvedPath = resolve(root, relativePath);
    if (!relativePath || isAbsolute(relativePath) || isPathOutside(root, resolvedPath)) {
      errors.push(`${path}: Suite-local reviewed contract must remain inside the repository root`);
      valid = false;
      continue;
    }
    try {
      const linkStats = lstatSync(resolvedPath);
      if (linkStats.isSymbolicLink() || !linkStats.isFile()) {
        errors.push(`${path}: Suite-local reviewed contract must resolve to a regular file`);
        valid = false;
        continue;
      }
      const canonicalRoot = realpathSync(root);
      const canonicalPath = realpathSync(resolvedPath);
      if (isPathOutside(canonicalRoot, canonicalPath)) {
        errors.push(`${path}: Suite-local reviewed contract must not escape through symlinks`);
        valid = false;
      }
    } catch {
      errors.push(`${path}: Suite-local reviewed contract must resolve to a regular file`);
      valid = false;
    }
  }
  return valid;
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
  // Malformed candidates are already reported by the schema pass; returning
  // here keeps that finding authoritative instead of crashing node:path.
  if (typeof artifactPath !== 'string' || artifactPath === '') {
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

const readContainedRegularFile = (root, path, label, errors) => {
  if (!path || isAbsolute(path)) {
    errors.push(`${label} must be a repository-relative regular file`);
    return null;
  }
  const resolvedPath = resolve(root, path);
  if (isPathOutside(root, resolvedPath)) {
    errors.push(`${label} must stay inside the repository root`);
    return null;
  }
  try {
    const linkStats = lstatSync(resolvedPath);
    const canonicalRoot = realpathSync(root);
    const canonicalPath = realpathSync(resolvedPath);
    if (
      linkStats.isSymbolicLink()
      || !linkStats.isFile()
      || isPathOutside(canonicalRoot, canonicalPath)
    ) {
      errors.push(`${label} must resolve to a contained non-symlink regular file`);
      return null;
    }
    return readFileSync(resolvedPath);
  } catch {
    errors.push(`${label} must resolve to a contained non-symlink regular file`);
    return null;
  }
};

const readContainedJson = (root, path, label, errors) => {
  const bytes = readContainedRegularFile(root, path, label, errors);
  if (!bytes) return null;
  try {
    return {
      bytes,
      value: JSON.parse(bytes.toString('utf8')),
    };
  } catch (error) {
    errors.push(`${label} must contain valid JSON: ${error.message}`);
    return null;
  }
};

const parseContainedJson = (root, path, label, errors) =>
  readContainedJson(root, path, label, errors)?.value ?? null;

// Binds a cited topology_prerequisite to the one sealed rehearsal record by
// identity, committed path and exact bytes. Nothing parsed out of that record
// may be trusted until this binding holds, so the caller must gate every
// parsed-field check on `ok`.
const evaluateTopologyBinding = (root, prerequisite) => {
  const messages = [];
  if (prerequisite.record_id !== SEALED_TOPOLOGY_RECORD_ID) {
    messages.push(
      `topology_prerequisite record_id must equal the sealed ${SEALED_TOPOLOGY_RECORD_ID} rehearsal`,
    );
  }
  if (prerequisite.record_path !== SEALED_TOPOLOGY_RECORD_PATH) {
    messages.push(
      'topology_prerequisite record_path must equal the committed topology rehearsal record path',
    );
  }
  if (messages.length > 0) return { ok: false, messages, record: null };
  const readErrors = [];
  const document = readContainedJson(
    root,
    SEALED_TOPOLOGY_RECORD_PATH,
    'topology_prerequisite record',
    readErrors,
  );
  if (!document) return { ok: false, messages: readErrors, record: null };
  if (
    createHash('sha256').update(document.bytes).digest('hex') !== prerequisite.record_sha256
  ) {
    return {
      ok: false,
      messages: [
        'topology_prerequisite record_sha256 must match committed topology record bytes',
      ],
      record: null,
    };
  }
  return { ok: true, messages: [], record: document.value };
};

const allowedSignerIdentity = (bytes, errors, path) => {
  let line;
  try {
    line = bytes.toString('ascii');
  } catch {
    errors.push(`${path}: withdrawal allowed-signers bytes must be ASCII`);
    return null;
  }
  const parts = line.endsWith('\n') ? line.slice(0, -1).split(' ') : [];
  if (
    parts.length !== 4
    || parts[0] !== 'FOUNDER'
    || parts[1] !== `namespaces="${WITHDRAWAL_NAMESPACE}"`
    || parts[2] !== 'ssh-ed25519'
    || line.slice(0, -1).includes('\n')
  ) {
    errors.push(`${path}: withdrawal allowed-signers identity must bind FOUNDER to the dedicated namespace`);
    return null;
  }
  let keyBlob;
  try {
    keyBlob = Buffer.from(parts[3], 'base64');
  } catch {
    errors.push(`${path}: withdrawal allowed-signers key must be valid base64`);
    return null;
  }
  if (keyBlob.length === 0 || keyBlob.toString('base64').replace(/=+$/u, '') !== parts[3].replace(/=+$/u, '')) {
    errors.push(`${path}: withdrawal allowed-signers key must be canonical base64`);
    return null;
  }
  return {
    signer: parts[0],
    keyType: parts[2],
    fingerprint: `SHA256:${createHash('sha256').update(keyBlob).digest('base64').replace(/=+$/u, '')}`,
  };
};

const validateWithdrawalSignature = ({
  root,
  path,
  withdrawal,
  recordBytes,
  errors,
}) => {
  const closure = withdrawal.external_packet_closure;
  const allowedBytes = readContainedRegularFile(
    root,
    closure.allowed_signers_path,
    `${path}: withdrawal allowed-signers`,
    errors,
  );
  const signatureBytes = readContainedRegularFile(
    root,
    closure.signature_path,
    `${path}: withdrawal signature`,
    errors,
  );
  const trust = parseContainedJson(
    root,
    WITHDRAWAL_TRUST_PATH,
    `${path}: withdrawal trust descriptor`,
    errors,
  );
  const masterTrust = parseContainedJson(
    root,
    MASTER_AUTHORIZATION_TRUST_PATH,
    `${path}: tracked master UAT trust descriptor`,
    errors,
  );
  if (!allowedBytes || !signatureBytes || !recordBytes || !trust || !masterTrust) {
    errors.push(`${path}: withdrawal SSHSIG must verify against the pinned withdrawal trust`);
    return;
  }

  const allowedDigest = createHash('sha256').update(allowedBytes).digest('hex');
  const identity = allowedSignerIdentity(allowedBytes, errors, path);
  if (!identity) return;
  if (!hasExactKeys(trust, [
    'schema',
    'signer',
    'namespace',
    'key_type',
    'key_fingerprint',
    'allowed_signers_sha256',
  ])) {
    errors.push(`${WITHDRAWAL_TRUST_PATH}: withdrawal trust descriptor must have the exact field set`);
    return;
  }
  if (
    trust.schema !== 'CYBRIK-UAT-RUNTIME-WITHDRAWAL-TRUST/v1'
    || trust.signer !== 'FOUNDER'
    || trust.namespace !== WITHDRAWAL_NAMESPACE
    || trust.key_type !== 'ssh-ed25519'
    || trust.key_fingerprint !== identity.fingerprint
    || trust.allowed_signers_sha256 !== allowedDigest
    || closure.signer !== trust.signer
    || closure.namespace !== trust.namespace
    || closure.allowed_signers_sha256 !== allowedDigest
  ) {
    errors.push(`${path}: withdrawal trust descriptor, signer and allowed-signers identity must match exactly`);
    return;
  }
  if (
    masterTrust.schema !== 'CYBRIK-UAT-SSH-AUTHORIZATION-TRUST/v1'
    || masterTrust.signer !== trust.signer
    || masterTrust.key_type !== trust.key_type
    || masterTrust.key_fingerprint !== trust.key_fingerprint
  ) {
    errors.push(`${path}: withdrawal trust must retain the tracked master UAT signer identity`);
    return;
  }
  if (closure.signature_path !== `${path}.sig`) {
    errors.push(`${path}: withdrawal signature_path must be the adjacent detached SSHSIG`);
    return;
  }
  const verifyRoot = mkdtempSync(join(tmpdir(), 'cybrik-withdrawal-verify-'));
  try {
    const allowedPath = join(verifyRoot, 'allowed_signers');
    const signaturePath = join(verifyRoot, 'withdrawal.sig');
    writeFileSync(allowedPath, allowedBytes, { mode: 0o600 });
    writeFileSync(signaturePath, signatureBytes, { mode: 0o600 });
    const verification = spawnSync(
      '/usr/bin/ssh-keygen',
      [
        '-Y', 'verify',
        '-f', allowedPath,
        '-I', closure.signer,
        '-n', closure.namespace,
        '-s', signaturePath,
      ],
      {
        input: recordBytes,
        encoding: 'utf8',
        env: { LC_ALL: 'C', PATH: '/usr/bin:/bin' },
      },
    );
    if (verification.status !== 0) {
      errors.push(`${path}: withdrawal SSHSIG must verify against the pinned withdrawal trust`);
    }
  } finally {
    rmSync(verifyRoot, { recursive: true, force: true });
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
  } else if (!validateSuiteLocalReviewedContracts(
    root,
    candidate.contracts.reviewed_contracts,
    path,
    errors,
  )) {
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
  allRecords,
  pinnedPolicy,
}) => {
  const findings = [];
  const addFinding = (path, message) => {
    findings.push({ path, message: `${path}: ${message}` });
  };
  if (!hasExactKeys(policy, [
    'schema_version',
    'allowed_objectives',
    'legacy_candidates',
    'sealed_predecessors',
  ])) {
    addFinding(
      LINEAGE_POLICY_PATH,
      'must contain exactly schema_version, allowed_objectives, legacy_candidates and sealed_predecessors',
    );
    return findings;
  }
  if (policy.schema_version !== '1.1.0') {
    addFinding(LINEAGE_POLICY_PATH, 'schema_version must equal 1.1.0');
  }
  if (!Array.isArray(policy.allowed_objectives)) {
    addFinding(LINEAGE_POLICY_PATH, 'allowed_objectives must be an array');
    return findings;
  }
  if (
    JSON.stringify(policy.allowed_objectives)
      !== JSON.stringify(pinnedPolicy.allowed_objectives)
  ) {
    addFinding(
      LINEAGE_POLICY_PATH,
      'allowed_objectives and allowed_series_ids must exactly match the validator-pinned policy',
    );
  }
  const allowedObjectiveKeys = new Set();
  const allowedSeriesByObjective = new Map();
  for (const allowedObjective of policy.allowed_objectives) {
    if (
      !hasExactKeys(allowedObjective, [
        'capability_id',
        'objective_id',
        'allowed_series_ids',
      ])
      || typeof allowedObjective.capability_id !== 'string'
      || allowedObjective.capability_id.length === 0
      || typeof allowedObjective.objective_id !== 'string'
      || allowedObjective.objective_id.length === 0
      || !Array.isArray(allowedObjective.allowed_series_ids)
      || allowedObjective.allowed_series_ids.length === 0
      || allowedObjective.allowed_series_ids.some(
        (seriesId) => typeof seriesId !== 'string' || seriesId.length === 0,
      )
      || new Set(allowedObjective.allowed_series_ids).size
        !== allowedObjective.allowed_series_ids.length
      || JSON.stringify([...allowedObjective.allowed_series_ids].sort())
        !== JSON.stringify(allowedObjective.allowed_series_ids)
    ) {
      addFinding(
        LINEAGE_POLICY_PATH,
        'allowed_objectives entries must contain non-empty identifiers and sorted unique allowed_series_ids',
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
    allowedSeriesByObjective.set(
      objectiveKey,
      new Set(allowedObjective.allowed_series_ids),
    );
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

  const sealedById = new Map();
  if (!Array.isArray(policy.sealed_predecessors)) {
    addFinding(LINEAGE_POLICY_PATH, 'sealed_predecessors must be an array');
    return findings;
  }
  if (
    JSON.stringify(policy.sealed_predecessors)
      !== JSON.stringify(pinnedPolicy.sealed_predecessors)
  ) {
    addFinding(
      LINEAGE_POLICY_PATH,
      'sealed_predecessors must exactly match the validator-pinned policy',
    );
  }
  const sealedFields = [
    'candidate_id',
    'series_id',
    'capability_id',
    'objective_id',
    'record_path',
    'record_sha256',
    'recorded_disposition',
    'recorded_current_attempt_status',
  ];
  for (const entry of policy.sealed_predecessors) {
    if (
      !hasExactKeys(entry, sealedFields)
      || typeof entry.candidate_id !== 'string'
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
      || entry.recorded_disposition !== 'HOLD'
      || entry.recorded_current_attempt_status !== 'not_run'
    ) {
      addFinding(
        LINEAGE_POLICY_PATH,
        'sealed predecessor entries must use exact HOLD/not_run identity, path and SHA-256 fields',
      );
      continue;
    }
    const objectiveKey = `${entry.capability_id}\u0000${entry.objective_id}`;
    if (!allowedSeriesByObjective.get(objectiveKey)?.has(entry.series_id)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `sealed predecessor ${entry.candidate_id} must use an allowlisted objective series`,
      );
    }
    if (sealedById.has(entry.candidate_id)) {
      addFinding(LINEAGE_POLICY_PATH, 'sealed predecessor candidate_id values must be unique');
      continue;
    }
    if (isAbsolute(entry.record_path)) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `sealed predecessor ${entry.candidate_id} record_path must be relative to the repository root`,
      );
      continue;
    }
    const resolvedRecordPath = resolve(root, entry.record_path);
    let canonicalRoot;
    let canonicalRecordPath;
    let recordLinkStats;
    try {
      canonicalRoot = realpathSync(root);
      recordLinkStats = lstatSync(resolvedRecordPath);
      canonicalRecordPath = realpathSync(resolvedRecordPath);
    } catch {
      addFinding(
        LINEAGE_POLICY_PATH,
        `sealed predecessor ${entry.candidate_id} record_path must resolve to a readable regular file`,
      );
      continue;
    }
    if (
      isPathOutside(root, resolvedRecordPath)
      || recordLinkStats.isSymbolicLink()
      || !recordLinkStats.isFile()
      || isPathOutside(canonicalRoot, canonicalRecordPath)
    ) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `sealed predecessor ${entry.candidate_id} record_path must be a contained non-symlink regular file`,
      );
      continue;
    }
    const record = recordsById.get(entry.candidate_id);
    if (
      !record
      || record.path !== entry.record_path
      || record.candidate.attempt_accounting.series_id !== entry.series_id
      || record.candidate.disposition.profile !== entry.recorded_disposition
      || record.candidate.attempt_accounting.current_attempt.status
        !== entry.recorded_current_attempt_status
      || record.candidate.attempt_accounting.current_attempt.execution_authorized !== false
    ) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `sealed predecessor ${entry.candidate_id} must resolve to the exact HOLD/not_run unauthorized registry record`,
      );
      continue;
    }
    let recordBytes;
    try {
      recordBytes = readText(root, entry.record_path, overrides);
    } catch (error) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `sealed predecessor ${entry.candidate_id} bytes are unreadable: ${error.message}`,
      );
      continue;
    }
    if (createHash('sha256').update(recordBytes).digest('hex') !== entry.record_sha256) {
      addFinding(
        LINEAGE_POLICY_PATH,
        `sealed predecessor ${entry.candidate_id} record_sha256 must match immutable record bytes`,
      );
    }
    sealedById.set(entry.candidate_id, entry);
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
    if (!allowedSeriesByObjective.get(objectiveKey)?.has(
      candidate.attempt_accounting.series_id,
    )) {
      addFinding(
        record.path,
        'objective_lineage series_id must be explicitly allowlisted for its capability/objective',
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

  // Runtime lineage gates. These run over every parsed record, including records
  // the schema rejected, so a candidate cannot dodge a gate by also being
  // malformed in some unrelated way.
  for (const record of allRecords) {
    const candidate = record.candidate;
    const accounting = isPlainObject(candidate?.attempt_accounting)
      ? candidate.attempt_accounting
      : null;
    const lineage = isPlainObject(accounting?.objective_lineage)
      ? accounting.objective_lineage
      : null;
    const currentAttempt = isPlainObject(accounting?.current_attempt)
      ? accounting.current_attempt
      : {};
    const evidenceDirectory = candidate?.evidence?.directory;
    const evidenceArtifacts = Array.isArray(candidate?.evidence?.artifacts)
      ? candidate.evidence.artifacts
      : [];
    const failureHistory = Array.isArray(accounting?.failure_history)
      ? accounting.failure_history
      : [];
    const sealedPredecessor = isPlainObject(lineage?.sealed_predecessor)
      ? lineage.sealed_predecessor
      : null;
    const topologyPrerequisite = isPlainObject(lineage?.topology_prerequisite)
      ? lineage.topology_prerequisite
      : null;

    if (currentAttempt.execution_authorized === true) {
      if (
        record.path === GRANDFATHERED_AUTHORIZED_CANDIDATE.record_path
        && candidate?.candidate_id === GRANDFATHERED_AUTHORIZED_CANDIDATE.candidate_id
      ) {
        let recordBytes = null;
        try {
          recordBytes = readText(root, record.path, overrides);
        } catch {
          recordBytes = null;
        }
        if (
          recordBytes === null
          || createHash('sha256').update(recordBytes).digest('hex')
            !== GRANDFATHERED_AUTHORIZED_CANDIDATE.record_sha256
        ) {
          addFinding(
            record.path,
            'grandfathered runtime authorization applies only to the exact immutable candidate bytes',
          );
        }
      } else if (
        isImmutableLineageObjective(lineage)
        && !(sealedPredecessor && topologyPrerequisite)
      ) {
        addFinding(
          record.path,
          'runtime execution authorization requires both sealed_predecessor and topology_prerequisite',
        );
      }
    }

    if (!lineage) continue;
    if (
      (lineage.sealed_predecessor === undefined)
      !== (lineage.topology_prerequisite === undefined)
    ) {
      addFinding(
        record.path,
        'sealed_predecessor and topology_prerequisite must be carried together',
      );
    }
    if (sealedPredecessor) {
      const sealed = sealedById.get(sealedPredecessor.candidate_id);
      const priorRecord = recordsById.get(sealedPredecessor.candidate_id);
      if (!sealed || !priorRecord) {
        addFinding(
          record.path,
          'sealed_predecessor must resolve to an immutable sealed predecessor',
        );
      } else {
        if (
          sealedPredecessor.record_path !== sealed.record_path
          || sealedPredecessor.record_sha256 !== sealed.record_sha256
        ) {
          addFinding(
            record.path,
            'sealed_predecessor record path and digest must match the immutable lineage policy',
          );
        }
        const priorAttempt = priorRecord.candidate.attempt_accounting.current_attempt;
        if (
          priorRecord.candidate.disposition.profile !== 'HOLD'
          || priorAttempt.status !== 'not_run'
          || priorAttempt.execution_authorized !== false
          || sealedPredecessor.evidence_path !== priorAttempt.evidence_path
          || sealedPredecessor.evidence_sha256 !== priorAttempt.evidence_sha256
        ) {
          addFinding(
            record.path,
            'sealed_predecessor must preserve the exact HOLD/not_run predecessor evidence',
          );
        }
        if (accounting.series_id === sealed.series_id) {
          addFinding(record.path, 'sealed_predecessor cannot reopen its sealed series_id');
        }
        const artifactErrors = [];
        validateRecordedArtifact({
          root,
          recordPath: `${record.path}: attempt_accounting.objective_lineage.sealed_predecessor`,
          evidenceDir: evidenceDirectory,
          artifactPath: sealedPredecessor.evidence_path,
          artifactSha256: sealedPredecessor.evidence_sha256,
          errors: artifactErrors,
          requireInsideEvidenceDir: false,
        });
        for (const message of artifactErrors) findings.push({ path: record.path, message });
      }
      const sealedDigest = sealedPredecessor.evidence_sha256;
      if (
        currentAttempt.evidence_sha256 === sealedDigest
        || evidenceArtifacts.some((artifact) => artifact.sha256 === sealedDigest)
        || failureHistory.some((historyRow) => historyRow.evidence_sha256 === sealedDigest)
      ) {
        addFinding(
          record.path,
          'sealed_predecessor bytes must never be reused as runtime execution evidence',
        );
      }
    }

    if (topologyPrerequisite) {
      // Bind the sealed rehearsal record first; only then may fields parsed out
      // of that record be used to check the cited artifacts.
      const binding = evaluateTopologyBinding(root, topologyPrerequisite);
      for (const message of binding.messages) addFinding(record.path, message);
      if (binding.ok) {
        const topologyRecord = binding.record;
        if (
          topologyRecord.identity?.capability_id !== topologyPrerequisite.capability_id
          || topologyRecord.identity?.objective_id !== topologyPrerequisite.objective_id
          || topologyRecord.attempt?.phase !== 'closed'
          || topologyRecord.attempt?.outcome !== 'TOPOLOGY_PASS'
          || topologyRecord.attempt?.execution_authorized !== false
          || topologyRecord.evidence?.external_bytes_ci_verified !== false
          || topologyRecord.evidence?.result_controls?.external_manifest_locally_verified !== true
        ) {
          addFinding(
            record.path,
            'topology_prerequisite must resolve to a closed non-authorizing TOPOLOGY_PASS record',
          );
        }
        const resultArtifact = topologyRecord.evidence?.artifacts?.find(
          (artifact) => artifact.kind === 'result',
        );
        const manifestArtifact = topologyRecord.evidence?.artifacts?.find(
          (artifact) => artifact.kind === 'evidence_manifest',
        );
        if (
          resultArtifact?.path !== topologyPrerequisite.result_path
          || resultArtifact?.sha256 !== topologyPrerequisite.result_sha256
        ) {
          addFinding(
            record.path,
            'topology_prerequisite result path and digest must match the committed topology record',
          );
        }
        if (
          manifestArtifact?.path !== topologyPrerequisite.evidence_manifest_path
          || manifestArtifact?.sha256 !== topologyPrerequisite.evidence_manifest_sha256
        ) {
          addFinding(
            record.path,
            'topology_prerequisite evidence manifest must match the committed topology record',
          );
        }
      }
      for (const [artifactPath, artifactSha256, label] of [
        [
          topologyPrerequisite.result_path,
          topologyPrerequisite.result_sha256,
          'result',
        ],
        [
          topologyPrerequisite.evidence_manifest_path,
          topologyPrerequisite.evidence_manifest_sha256,
          'evidence manifest',
        ],
      ]) {
        const artifactErrors = [];
        validateRecordedArtifact({
          root,
          recordPath: `${record.path}: topology_prerequisite ${label}`,
          evidenceDir: evidenceDirectory,
          artifactPath,
          artifactSha256,
          errors: artifactErrors,
          requireInsideEvidenceDir: false,
        });
        if (artifactErrors.some((message) => message.includes('sha256 must match'))) {
          addFinding(
            record.path,
            `topology_prerequisite ${label} SHA-256 must match committed ${label} bytes`,
          );
        }
        for (const message of artifactErrors) findings.push({ path: record.path, message });
      }
      const topologyDigests = new Set([
        topologyPrerequisite.result_sha256,
        topologyPrerequisite.evidence_manifest_sha256,
      ]);
      if (
        topologyDigests.has(currentAttempt.evidence_sha256)
        || evidenceArtifacts.some((artifact) => topologyDigests.has(artifact.sha256))
        || failureHistory.some(
          (historyRow) => topologyDigests.has(historyRow.evidence_sha256),
        )
      ) {
        addFinding(
          record.path,
          'topology_prerequisite bytes must never be reused as runtime execution evidence',
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

const validateWithdrawalRecord = ({
  root,
  path,
  withdrawal,
  recordBytes,
  withdrawalValidator,
  targetRecord,
  targetReport,
  seriesRecords,
}) => {
  const errors = [];
  if (!withdrawalValidator || !validateAgainstSchema(
    withdrawalValidator,
    path,
    withdrawal,
    errors,
  )) {
    return errors;
  }
  const expectedTargetPath = join(dirname(path), 'runtime-admission.json');
  if (!targetRecord || !targetReport || withdrawal.target.record_path !== expectedTargetPath) {
    errors.push(`${path}: withdrawal target must resolve to the adjacent runtime-admission record`);
    return errors;
  }
  const candidate = targetRecord.candidate;
  const attempt = candidate.attempt_accounting.current_attempt;
  if (
    withdrawal.withdrawal_id !== `${candidate.candidate_id}-withdrawal-r1`
    || withdrawal.target.candidate_id !== candidate.candidate_id
    || withdrawal.target.series_id !== candidate.attempt_accounting.series_id
    || withdrawal.target.attempt_ordinal !== candidate.attempt_accounting.attempt_ordinal
  ) {
    errors.push(`${path}: withdrawal identity must bind the exact target candidate and attempt`);
  }

  const targetBytes = readContainedRegularFile(
    root,
    withdrawal.target.record_path,
    `${path}: withdrawal target record`,
    errors,
  );
  if (
    targetBytes
    && createHash('sha256').update(targetBytes).digest('hex')
      !== withdrawal.target.record_sha256
  ) {
    errors.push(`${path}: target_record_sha256 must match the recorded runtime-admission bytes`);
  }
  if (
    withdrawal.target.authorization_evidence_path !== attempt.evidence_path
    || withdrawal.target.authorization_evidence_sha256 !== attempt.evidence_sha256
  ) {
    errors.push(`${path}: withdrawal authorization evidence must match the target attempt exactly`);
  }
  if (JSON.stringify(withdrawal.observed_attempt) !== JSON.stringify(attempt)) {
    errors.push(`${path}: observed_attempt must preserve the target attempt exactly`);
  }
  if (
    targetReport.declaredDisposition !== 'RUNTIME_AUTHORIZED'
    || targetReport.derivedDisposition !== 'RUNTIME_AUTHORIZED'
    || attempt.status !== 'not_run'
    || attempt.execution_authorized !== true
    || attempt.executed_checks !== 0
    || attempt.passed_checks !== 0
    || attempt.failed_checks !== 0
  ) {
    errors.push(`${path}: only an unused, historically RUNTIME_AUTHORIZED attempt may be withdrawn`);
  }
  if (seriesRecords.some((record) => record.path !== targetRecord.path)) {
    errors.push(`${path}: withdrawn runtime-authorization series cannot reopen under the same series_id`);
  }

  validateWithdrawalSignature({
    root,
    path,
    withdrawal,
    recordBytes,
    errors,
  });
  return errors;
};

export async function validateRuntimeAdmission({
  root = DEFAULT_ROOT,
  overrides = new Map(),
  pinnedLineagePolicy,
} = {}) {
  const errors = [];
  let effectiveLineagePolicyPins = {
    allowed_objectives: ALLOWED_LINEAGE_OBJECTIVES,
    sealed_predecessors: SEALED_PREDECESSORS,
  };
  try {
    const isDefaultRoot = realpathSync(root) === realpathSync(DEFAULT_ROOT);
    if (!isDefaultRoot) {
      if (pinnedLineagePolicy) {
        effectiveLineagePolicyPins = pinnedLineagePolicy;
      } else {
        errors.push(
          `${LINEAGE_POLICY_PATH}: non-default root requires independently supplied lineage policy pins`,
        );
      }
    }
  } catch {
    errors.push(`${LINEAGE_POLICY_PATH}: repository root must resolve before lineage validation`);
  }
  errors.push(...validateLineagePolicyPins(effectiveLineagePolicyPins));
  if (!existsSync(join(root, README_PATH))) {
    errors.push(`${README_PATH}: missing`);
  }
  const validator = compileSchema(root, overrides, errors);
  const withdrawalValidator = compileWithdrawalSchema(root, overrides, errors);
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
  const withdrawalFiles = discoverWithdrawalFiles(root);
  for (const path of discoveredFiles) {
    if (!candidateFiles.includes(path)) {
      errors.push(`${path}: mislocated runtime-admission.json; expected docs/uat/candidates/<candidate-id>/runtime-admission.json`);
    }
  }
  const candidates = [];
  const parsedRecords = [];
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
    if (candidate) {
      parsedRecords.push({ path, candidate });
    }
    errors.push(...candidateErrors);
    const candidateReport = {
      path,
      candidateId: candidate?.candidate_id ?? null,
      declaredDisposition,
      derivedDisposition,
      effectiveDisposition: derivedDisposition,
      authorizationState: 'active',
      effectiveAuthorizationState: 'active',
      withdrawalId: null,
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
      allRecords: parsedRecords,
      pinnedPolicy: effectiveLineagePolicyPins,
    }));
  }
  for (const finding of registryFindings) {
    errors.push(finding.message);
    const candidateReport = reportsByPath.get(finding.path);
    if (candidateReport) {
      candidateReport.errors.push(finding.message);
      if (candidateReport.derivedDisposition !== 'NO-GO') {
        candidateReport.derivedDisposition = 'HOLD';
        candidateReport.effectiveDisposition = 'HOLD';
      }
    }
  }

  const baseAuthorizedPaths = new Set(
    candidates
      .filter((candidateReport) =>
        candidateReport.errors.length === 0
        && candidateReport.derivedDisposition === 'RUNTIME_AUTHORIZED')
      .map((candidateReport) => candidateReport.path),
  );
  const recordsByPath = new Map(registryRecords.map((record) => [record.path, record]));
  const recordsBySeries = new Map();
  for (const record of parsedRecords) {
    const seriesId = record.candidate?.attempt_accounting?.series_id;
    if (typeof seriesId !== 'string' || seriesId.length === 0) continue;
    const series = recordsBySeries.get(seriesId) ?? [];
    series.push(record);
    recordsBySeries.set(seriesId, series);
  }
  for (const path of withdrawalFiles) {
    const targetPath = join(dirname(path), 'runtime-admission.json');
    const targetRecord = recordsByPath.get(targetPath) ?? null;
    const targetReport = reportsByPath.get(targetPath) ?? null;
    const withdrawalErrors = [];
    if (path.split('/').length !== 5) {
      withdrawalErrors.push(`${path}: mislocated ${WITHDRAWAL_FILENAME}; expected docs/uat/candidates/<candidate-id>/${WITHDRAWAL_FILENAME}`);
    }
    const withdrawalDocument = readContainedJson(
      root,
      path,
      `${path}: withdrawal record`,
      withdrawalErrors,
    );
    const withdrawal = withdrawalDocument?.value ?? null;
    if (withdrawal) {
      withdrawalErrors.push(...validateWithdrawalRecord({
        root,
        path,
        withdrawal,
        recordBytes: withdrawalDocument.bytes,
        withdrawalValidator,
        targetRecord,
        targetReport,
        seriesRecords: targetRecord
          ? recordsBySeries.get(targetRecord.candidate.attempt_accounting.series_id) ?? []
          : [],
      }));
    }
    errors.push(...withdrawalErrors);
    if (targetReport) {
      targetReport.withdrawalId = withdrawal?.withdrawal_id ?? null;
      targetReport.errors.push(...withdrawalErrors);
      if (withdrawalErrors.length === 0) {
        targetReport.authorizationState = 'withdrawn';
        targetReport.effectiveAuthorizationState = 'withdrawn';
        targetReport.effectiveDisposition = 'HOLD';
      }
    }
  }

  const authorizedCandidates = candidates.filter(
    (candidateReport) =>
      baseAuthorizedPaths.has(candidateReport.path)
      && candidateReport.authorizationState === 'active',
  );
  if (authorizedCandidates.length > 1) {
    for (const candidateReport of authorizedCandidates) {
      const message =
        `${candidateReport.path}: registry may contain at most one RUNTIME_AUTHORIZED candidate`;
      errors.push(message);
      candidateReport.errors.push(message);
      candidateReport.derivedDisposition = 'HOLD';
      candidateReport.effectiveDisposition = 'HOLD';
    }
  }

  return {
    errors,
    counts: {
      candidateFiles: candidateFiles.length,
      withdrawalFiles: withdrawalFiles.length,
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
