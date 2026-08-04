// Dedicated topology-only rehearsal registry validator.
// Static, deterministic and read-only. Green validates control records only;
// it grants no Docker, runtime, UAT, demo, release or production authority.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');

export const TOPOLOGY_SCHEMA_PATH = 'docs/uat/topology-rehearsal.schema.json';
export const TOPOLOGY_POLICY_PATH = 'docs/uat/topology-rehearsal-policy.json';
export const TOPOLOGY_ROOT = 'docs/uat/topology-rehearsals';
export const TOPOLOGY_TRUST_PATH =
  'docs/uat/topology-rehearsal-authorization-trust.json';
export const TOPOLOGY_ALLOWED_SIGNERS_PATH =
  'docs/uat/topology-rehearsal-allowed-signers';
const MASTER_AUTHORIZATION_TRUST_PATH =
  'integration/compose/soc-ai-fabric-alert-context-mtls/authorization-trust.json';
const AUTHORIZATION_NAMESPACE = 'cybrik-uat-topology-rehearsal-v1';

export const PINNED_TOPOLOGY_RECORDS = Object.freeze([
  Object.freeze({
    record_id: 'postgres-loopback-internal-v1-r1',
    series_id: 'postgres-loopback-internal-v1',
    capability_id: 'cybrik.suite.runtime-topology',
    objective_id: 'postgres-loopback-internal-v1',
    directory: 'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1',
    record_path:
      'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1/topology-rehearsal.json',
    max_records: 1,
    max_attempts: 1,
  }),
]);
export const PINNED_TOPOLOGY_STATE = Object.freeze({
  current_state: Object.freeze({
    record_id: 'postgres-loopback-internal-v1-r1',
    record_sha256: 'f98cbae5dfebe433228574609f8ef7573bb0ef93c2f09e076e851698bab6cd37',
    phase: 'proposed',
    attempt_consumed: false,
    outcome: 'not_run',
    grant_sha256: null,
  }),
  state_history: Object.freeze([]),
});

const EXPECTED_PROBE_ARGV = Object.freeze([
  '-z',
  '-w',
  '5',
  '127.0.0.1',
  '15433',
]);
// Exhaustive per-phase artifact inventories. Review scope is split: diagnosis_review
// attests the diagnosis bytes and is owed from the proposed phase, while record_review
// attests the exact proposed record bytes and is owed only from authorization onward.
const PROPOSED_ARTIFACT_INVENTORY = Object.freeze(['diagnosis', 'diagnosis_review']);
const AUTHORIZED_ARTIFACT_INVENTORY = Object.freeze([
  ...PROPOSED_ARTIFACT_INVENTORY,
  'record_review',
  'grant',
  'authorization_signature',
]);
const CLOSED_ARTIFACT_INVENTORY = Object.freeze([
  ...AUTHORIZED_ARTIFACT_INVENTORY,
  'result',
  'evidence_manifest',
  'result_review',
]);
const CONSUMED_OUTCOMES = new Set([
  'TOPOLOGY_PASS',
  'FAIL_PUBLICATION',
  'FAIL_INTERNAL_INGRESS',
  'STOP_CONTROL',
]);
const RECORD_DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const PRIOR_STATE_PIN_KEYS = Object.freeze([
  'phase',
  'attempt_consumed',
  'outcome',
  'record_sha256',
]);
const RECORD_REVIEW_SELF_ATTESTATION_FINDING =
  'record review cannot attest the record bytes that contain it';
const RECORD_REVIEW_PINNED_PROPOSED_FINDING =
  'record review must attest the pinned proposed record bytes';

const dependencyRequire = () => {
  const localRequire = createRequire(join(HERE, 'package.json'));
  try {
    localRequire.resolve('ajv/dist/2020.js');
    return localRequire;
  } catch {
    const commonDir = execFileSync(
      '/usr/bin/git',
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

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isOutside = (base, target) => {
  const delta = relative(base, target);
  return delta === '..' || delta.startsWith(`..${sep}`) || isAbsolute(delta);
};

const containedRegularFile = (root, path) => {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path)) {
    throw new Error('must be a contained regular file');
  }
  const rootReal = realpathSync(root);
  const candidate = resolve(rootReal, path);
  if (isOutside(rootReal, candidate)) throw new Error('must be a contained regular file');
  const linkStats = lstatSync(candidate);
  if (linkStats.isSymbolicLink() || !statSync(candidate).isFile()) {
    throw new Error('must be a contained regular file');
  }
  const targetReal = realpathSync(candidate);
  if (isOutside(rootReal, targetReal)) throw new Error('must be a contained regular file');
  return targetReal;
};

const readJson = (root, path, errors) => {
  try {
    return JSON.parse(readFileSync(containedRegularFile(root, path), 'utf8'));
  } catch (error) {
    errors.push(`${path}: cannot read valid contained JSON: ${error.message}`);
    return null;
  }
};

const compileSchema = (root, errors) => {
  const schema = readJson(root, TOPOLOGY_SCHEMA_PATH, errors);
  if (!schema) return null;
  try {
    const ajv = new Ajv2020({ strict: true, strictTypes: false, allErrors: true });
    addFormats(ajv);
    return ajv.compile(schema);
  } catch (error) {
    errors.push(`${TOPOLOGY_SCHEMA_PATH}: schema compile failed: ${error.message}`);
    return null;
  }
};

const walkRecordFiles = (root, errors, relativeDir = TOPOLOGY_ROOT) => {
  const absoluteDir = resolve(root, relativeDir);
  if (relativeDir === TOPOLOGY_ROOT) {
    try {
      const rootReal = realpathSync(root);
      const registryStats = lstatSync(absoluteDir);
      const registryReal = realpathSync(absoluteDir);
      if (
        registryStats.isSymbolicLink()
        || !registryStats.isDirectory()
        || isOutside(rootReal, registryReal)
      ) throw new Error('invalid registry root');
    } catch {
      errors.push(
        `${TOPOLOGY_ROOT}: topology registry root must be a contained non-symlink directory`,
      );
      return [];
    }
  } else if (!existsSync(absoluteDir)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const path = join(relativeDir, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`${path}: symlink entries are forbidden in the topology registry`);
    } else if (entry.isDirectory()) {
      if (entry.name === 'topology-rehearsal.json') {
        errors.push(`${path}: topology-rehearsal.json must be a regular file, not a directory`);
      } else {
        files.push(...walkRecordFiles(root, errors, path));
      }
    } else if (entry.name === 'topology-rehearsal.json') {
      files.push(path);
    }
  }
  return files.sort();
};

const validateSchema = (validator, path, value, errors) => {
  if (!validator || validator(value)) return;
  for (const issue of validator.errors ?? []) {
    errors.push(`${path}: schema ${issue.instancePath || '/'} ${issue.message}`);
  }
};

const requireArtifactKinds = (path, artifacts, expectedKinds, errors) => {
  const kinds = artifacts.map((entry) => entry.kind);
  const paths = artifacts.map((entry) => entry.path);
  const digests = artifacts.map((entry) => entry.sha256);
  for (const kind of expectedKinds) {
    if (!kinds.includes(kind)) errors.push(`${path}: required ${kind} artifact is missing`);
  }
  if (new Set(kinds).size !== kinds.length) {
    errors.push(`${path}: artifact kind values must be unique`);
  }
  if (new Set(paths).size !== paths.length) {
    errors.push(`${path}: artifact paths must be unique`);
  }
  if (new Set(digests).size !== digests.length) {
    errors.push(`${path}: artifact digests must be unique`);
  }
};

// Exhaustive, not merely sufficient: the listed kinds must equal the reviewed phase
// inventory as a multiset, so a surplus in-enum kind or a duplicate fails closed with
// exactly one finding.
const requireExactArtifactInventory = (path, phase, artifacts, expectedKinds, errors) => {
  const kinds = artifacts.map((entry) => entry.kind);
  if (
    kinds.length !== expectedKinds.length
    || JSON.stringify([...kinds].sort()) !== JSON.stringify([...expectedKinds].sort())
  ) {
    errors.push(
      `${path}: ${phase} topology artifact inventory must exactly equal the reviewed phase inventory`,
    );
  }
};

// The record review binding pins the record_review artifact bytes. Cross-byte checks
// against the pinned prior state remain out of scope for this control.
const validateRecordReviewBinding = (path, phase, record, errors) => {
  const binding = record.evidence.record_review_binding ?? null;
  if (phase === 'proposed') {
    if (binding !== null) {
      errors.push(`${path}: proposed topology record cannot carry a record review binding`);
    }
    return;
  }
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    errors.push(`${path}: ${phase} topology record requires a record review binding`);
    return;
  }
  const review = record.evidence.artifacts.find((entry) => entry?.kind === 'record_review');
  if (
    !review
    || binding.review_path !== review.path
    || binding.review_sha256 !== review.sha256
  ) {
    errors.push(
      `${path}: record review binding must bind the listed record_review artifact path and digest`,
    );
  }
};

// Cross-byte scope: a record review can only attest record bytes that already existed when
// the review was written. A binding naming the current record digest is a cryptographic
// fixed point — writing the digest changes the very bytes it claims to name — so it can
// only be self-attestation. The one attestable target is the proposed record digest pinned
// in the prior-state history. Pure and side-effect free: every input is caller-supplied, so
// the control is provable directly rather than through committed record bytes.
export const validateRecordReviewByteBinding = ({
  path,
  phase,
  reviewedRecordSha256 = null,
  pinnedProposedRecordSha256 = null,
  currentRecordSha256 = null,
} = {}) => {
  if (phase === 'proposed') return [];
  if (
    typeof reviewedRecordSha256 === 'string'
    && reviewedRecordSha256 === currentRecordSha256
  ) {
    // Strictly more precise than the pinned-proposed finding such a binding also fails:
    // report the fixed point alone so the failure names its exact cause.
    return [`${path}: ${RECORD_REVIEW_SELF_ATTESTATION_FINDING}`];
  }
  if (
    typeof pinnedProposedRecordSha256 !== 'string'
    || !RECORD_DIGEST_PATTERN.test(pinnedProposedRecordSha256)
    || reviewedRecordSha256 !== pinnedProposedRecordSha256
  ) {
    return [`${path}: ${RECORD_REVIEW_PINNED_PROPOSED_FINDING}`];
  }
  return [];
};

const validateArtifact = (root, recordPath, recordDirectory, artifact, errors) => {
  if (!artifact || typeof artifact.path !== 'string') return;
  const rootReal = realpathSync(root);
  const directory = resolve(rootReal, recordDirectory);
  const candidate = resolve(rootReal, artifact.path);
  if (isAbsolute(artifact.path) || isOutside(rootReal, candidate) || isOutside(directory, candidate)) {
    errors.push(`${recordPath}: artifacts must stay inside the record directory`);
    return;
  }
  let resolved;
  try {
    resolved = containedRegularFile(root, artifact.path);
  } catch {
    errors.push(`${recordPath}: artifact path must be a contained regular file`);
    return;
  }
  if (isOutside(realpathSync(directory), resolved)) {
    errors.push(`${recordPath}: artifacts must stay inside the record directory`);
    return;
  }
  const actual = sha256(readFileSync(resolved));
  if (actual !== artifact.sha256) {
    errors.push(`${recordPath}: artifact sha256 must match recorded bytes`);
  }
};

const signerFingerprint = (encodedKey) =>
  `SHA256:${createHash('sha256')
    .update(Buffer.from(encodedKey, 'base64'))
    .digest('base64')
    .replace(/=+$/u, '')}`;

const validateFounderTrust = (root, errors) => {
  let valid = true;
  let allowedPath = null;
  let allowedDigest = null;
  try {
    const trust = readJson(root, TOPOLOGY_TRUST_PATH, errors);
    const masterTrust = readJson(root, MASTER_AUTHORIZATION_TRUST_PATH, errors);
    allowedPath = containedRegularFile(root, TOPOLOGY_ALLOWED_SIGNERS_PATH);
    const allowedBytes = readFileSync(allowedPath);
    allowedDigest = sha256(allowedBytes);
    const parts = allowedBytes.toString('utf8').trim().split(/\s+/u);
    const keyFingerprint = parts.length === 4 ? signerFingerprint(parts[3]) : null;
    if (trust?.allowed_signers_sha256 !== allowedDigest) {
      errors.push(
        `${TOPOLOGY_TRUST_PATH}: allowed-signers SHA-256 must match the topology trust descriptor`,
      );
      valid = false;
    }
    if (
      !trust
      || !masterTrust
      || trust.schema !== 'CYBRIK-UAT-TOPOLOGY-AUTHORIZATION-TRUST/v1'
      || trust.signer !== 'FOUNDER'
      || trust.namespace !== AUTHORIZATION_NAMESPACE
      || trust.key_type !== 'ssh-ed25519'
      || trust.allowed_signers_path !== TOPOLOGY_ALLOWED_SIGNERS_PATH
      || trust.key_fingerprint !== keyFingerprint
      || masterTrust.signer !== trust.signer
      || masterTrust.key_type !== trust.key_type
      || masterTrust.key_fingerprint !== trust.key_fingerprint
      || parts[0] !== 'FOUNDER'
      || parts[1] !== `namespaces="${AUTHORIZATION_NAMESPACE}"`
      || parts[2] !== 'ssh-ed25519'
    ) {
      errors.push(
        `${TOPOLOGY_TRUST_PATH}: Founder trust descriptor, allowed signers and master fingerprint must agree`,
      );
      valid = false;
    }
  } catch (error) {
    errors.push(`${TOPOLOGY_TRUST_PATH}: Founder trust validation failed: ${error.message}`);
    valid = false;
  }
  return { valid, allowedPath, allowedDigest };
};

const verifyFounderAuthorization = (root, recordPath, record, trustContext, errors) => {
  const authorization = record.authorization;
  let verified = true;
  const invalidate = () => {
    verified = false;
  };
  if (!authorization || typeof authorization !== 'object') {
    invalidate();
  } else {
    const grant = record.evidence.artifacts.find((entry) => entry.kind === 'grant');
    const signature = record.evidence.artifacts.find(
      (entry) => entry.kind === 'authorization_signature',
    );
    if (
      authorization.signer !== 'FOUNDER'
      || authorization.namespace !== AUTHORIZATION_NAMESPACE
      || authorization.allowed_signers_path !== TOPOLOGY_ALLOWED_SIGNERS_PATH
      || authorization.trust_path !== TOPOLOGY_TRUST_PATH
      || !grant
      || !signature
      || authorization.grant_path !== grant.path
      || authorization.grant_sha256 !== grant.sha256
      || authorization.signature_path !== signature.path
      || authorization.signature_sha256 !== signature.sha256
    ) invalidate();

    try {
      const { valid, allowedPath, allowedDigest } = trustContext;
      if (!valid || authorization?.allowed_signers_sha256 !== allowedDigest) invalidate();

      const grantPath = containedRegularFile(root, authorization?.grant_path);
      const signaturePath = containedRegularFile(root, authorization?.signature_path);
      const grantBytes = readFileSync(grantPath);
      if (
        sha256(grantBytes) !== authorization?.grant_sha256
        || sha256(readFileSync(signaturePath)) !== authorization?.signature_sha256
      ) invalidate();
      const verification = spawnSync(
        '/usr/bin/ssh-keygen',
        [
          '-Y', 'verify',
          '-f', allowedPath,
          '-I', 'FOUNDER',
          '-n', AUTHORIZATION_NAMESPACE,
          '-s', signaturePath,
        ],
        { input: grantBytes, encoding: 'utf8' },
      );
      if (verification.error || verification.status !== 0) invalidate();
    } catch {
      invalidate();
    }
  }
  if (!verified) {
    errors.push(
      `${recordPath}: authorized or closed topology record requires a verified Founder SSHSIG`,
    );
  }
};

const validateFixedTopology = (path, topology, errors) => {
  if (topology.host_ip !== '127.0.0.1') errors.push(`${path}: host_ip must be exact loopback`);
  if (topology.host_port !== 15433) {
    errors.push(`${path}: host_port must be the reviewed fixed port`);
  }
  if (topology.container_port !== 5432) {
    errors.push(`${path}: container_port must remain PostgreSQL 5432`);
  }
  if (topology.internal_network !== true) errors.push(`${path}: network must remain internal`);
  if (topology.runtime_limit_seconds !== 180) {
    errors.push(`${path}: runtime limit must remain one 180-second cycle`);
  }
  if (topology.extension_cycles !== 0) {
    errors.push(`${path}: extension cycles must remain zero`);
  }
  if (topology.probe?.executable_path !== '/usr/bin/nc') {
    errors.push(`${path}: probe executable must remain /usr/bin/nc`);
  }
  if (JSON.stringify(topology.probe?.argv) !== JSON.stringify(EXPECTED_PROBE_ARGV)) {
    errors.push(`${path}: probe argv must exactly match the reviewed bounded TCP probe`);
  }
};

const validateAttemptSemantics = (path, record, errors) => {
  const attempt = record.attempt;
  const kinds = record.evidence.artifacts.map((entry) => entry.kind);
  if (attempt.phase === 'proposed') {
    if (
      attempt.execution_authorized !== false
      || attempt.attempt_consumed !== false
      || attempt.outcome !== 'not_run'
    ) errors.push(`${path}: proposed topology record must be not_run and unauthorized`);
    if (record.evidence.result_controls !== null) {
      errors.push(`${path}: proposed topology record cannot carry result controls`);
    }
    if (record.authorization !== null) {
      errors.push(`${path}: proposed topology record cannot carry authorization`);
    }
    requireArtifactKinds(path, record.evidence.artifacts, PROPOSED_ARTIFACT_INVENTORY, errors);
    requireExactArtifactInventory(
      path,
      'proposed',
      record.evidence.artifacts,
      PROPOSED_ARTIFACT_INVENTORY,
      errors,
    );
    validateRecordReviewBinding(path, 'proposed', record, errors);
    if (kinds.some((kind) => [
      'grant',
      'authorization_signature',
      'result',
      'evidence_manifest',
      'result_review',
    ].includes(kind))) {
      errors.push(`${path}: proposed topology record cannot carry grant or result artifacts`);
    }
    return;
  }

  if (attempt.phase === 'authorized') {
    if (
      attempt.execution_authorized !== true
      || attempt.attempt_consumed !== false
      || attempt.outcome !== 'not_run'
    ) errors.push(`${path}: authorized topology record must be not_run and unconsumed`);
    if (record.evidence.result_controls !== null) {
      errors.push(`${path}: authorized topology record cannot carry result controls`);
    }
    requireArtifactKinds(
      path,
      record.evidence.artifacts,
      AUTHORIZED_ARTIFACT_INVENTORY,
      errors,
    );
    requireExactArtifactInventory(
      path,
      'authorized',
      record.evidence.artifacts,
      AUTHORIZED_ARTIFACT_INVENTORY,
      errors,
    );
    validateRecordReviewBinding(path, 'authorized', record, errors);
    if (kinds.some((kind) => ['result', 'evidence_manifest', 'result_review'].includes(kind))) {
      errors.push(`${path}: authorized topology record cannot carry result artifacts`);
    }
    return;
  }

  if (attempt.execution_authorized !== false || attempt.outcome === 'not_run') {
    errors.push(`${path}: closed topology record must be unauthorized with a terminal outcome`);
  }
  if (attempt.outcome === 'PRECHECK_ABORT') {
    if (attempt.attempt_consumed !== false) {
      errors.push(`${path}: PRECHECK_ABORT must remain unconsumed`);
    }
  } else if (CONSUMED_OUTCOMES.has(attempt.outcome)) {
    if (attempt.attempt_consumed !== true) {
      errors.push(`${path}: consumed outcome must consume the single topology attempt`);
    }
  }
  requireArtifactKinds(path, record.evidence.artifacts, CLOSED_ARTIFACT_INVENTORY, errors);
  requireExactArtifactInventory(
    path,
    'closed',
    record.evidence.artifacts,
    CLOSED_ARTIFACT_INVENTORY,
    errors,
  );
  validateRecordReviewBinding(path, 'closed', record, errors);
  const controls = record.evidence.result_controls;
  if (!controls || controls.teardown_verified !== true) {
    errors.push(`${path}: closed topology record requires verified teardown`);
  }
  if (!controls || controls.residual_resources !== 0) {
    errors.push(`${path}: closed topology record requires zero residual resources`);
  }
  if (!controls || controls.external_manifest_locally_verified !== true) {
    errors.push(`${path}: external evidence manifest requires independent local verification`);
  }
};

const hasExactKeys = (value, keys) =>
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));

const isPriorStatePin = (entry, expectedPhase) =>
  hasExactKeys(entry, PRIOR_STATE_PIN_KEYS)
  && entry.phase === expectedPhase
  && entry.attempt_consumed === false
  && entry.outcome === 'not_run'
  && RECORD_DIGEST_PATTERN.test(entry.record_sha256);

// Only one exact, well-formed proposed prior-state pin may supply the digest a record
// review is allowed to attest. A missing or duplicated proposed pin supplies nothing, so
// the record review fails closed instead of attesting an unpinned digest.
const pinnedProposedRecordDigest = (stateHistory) => {
  const pins = (Array.isArray(stateHistory) ? stateHistory : []).filter((entry) =>
    isPriorStatePin(entry, 'proposed'));
  return pins.length === 1 ? pins[0].record_sha256 : null;
};

const validateStateBinding = ({ records, recordBytes, statePolicy, errors }) => {
  if (records.length === 0) {
    if (statePolicy.current_state !== null || statePolicy.state_history.length !== 0) {
      errors.push(`${TOPOLOGY_POLICY_PATH}: zero records require null current state and empty history`);
    }
    return;
  }
  if (records.length !== 1 || !records[0] || typeof records[0] !== 'object') return;
  const record = records[0];
  const grantSha = record.authorization?.grant_sha256 ?? null;
  const derived = {
    record_id: record.record_id,
    record_sha256: sha256(recordBytes[0]),
    phase: record.attempt?.phase,
    attempt_consumed: record.attempt?.attempt_consumed,
    outcome: record.attempt?.outcome,
    grant_sha256: grantSha,
  };
  if (JSON.stringify(statePolicy.current_state) !== JSON.stringify(derived)) {
    errors.push(`${TOPOLOGY_POLICY_PATH}: current state must bind the exact record bytes and phase`);
  }

  const history = statePolicy.state_history;
  const expectedPhases = record.attempt?.phase === 'proposed'
    ? []
    : record.attempt?.phase === 'authorized'
      ? ['proposed']
      : ['proposed', 'authorized'];
  if (history.length !== expectedPhases.length) {
    errors.push(`${TOPOLOGY_POLICY_PATH}: state history must pin every prior phase exactly once`);
    return;
  }
  const seenDigests = new Set();
  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    if (!isPriorStatePin(entry, expectedPhases[index])) {
      errors.push(`${TOPOLOGY_POLICY_PATH}: state history contains an invalid prior-state pin`);
    }
    if (seenDigests.has(entry.record_sha256)) {
      errors.push(`${TOPOLOGY_POLICY_PATH}: prior-state record digests must be unique`);
    }
    seenDigests.add(entry.record_sha256);
  }
};

const validateRecord = ({
  root,
  path,
  record,
  schemaValidator,
  pinned,
  trustContext,
  recordSha256,
  pinnedProposedRecordSha256,
  errors,
}) => {
  validateSchema(schemaValidator, path, record, errors);
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    errors.push(`${path}: topology record must be an object`);
    return;
  }

  const expectedPath = `${TOPOLOGY_ROOT}/${record.record_id}/topology-rehearsal.json`;
  if (path !== expectedPath || path !== pinned.record_path) {
    errors.push(`${path}: record_id, directory and record path must match the pinned singleton`);
  }
  if (
    record.record_id !== pinned.record_id
    || record.identity?.capability_id !== pinned.capability_id
    || record.identity?.objective_id !== pinned.objective_id
    || record.attempt?.series_id !== pinned.series_id
    || record.attempt?.attempt_ordinal !== 1
    || record.attempt?.max_attempts !== pinned.max_attempts
  ) errors.push(`${path}: topology policy permits only the exact singleton record`);

  if (
    !record.attempt
    || !record.topology
    || !record.evidence
    || !Array.isArray(record.evidence.artifacts)
  ) return;

  if (record.evidence?.directory !== pinned.directory) {
    errors.push(`${path}: evidence directory must equal the pinned singleton directory`);
  }
  if (record.evidence?.external_bytes_ci_verified !== false) {
    errors.push(`${path}: external bytes cannot be claimed as CI verified`);
  }
  for (const artifactEntry of record.evidence?.artifacts ?? []) {
    validateArtifact(root, path, pinned.directory, artifactEntry, errors);
  }

  validateFixedTopology(path, record.topology ?? {}, errors);
  validateAttemptSemantics(path, record, errors);
  if (record.attempt.phase === 'authorized' || record.attempt.phase === 'closed') {
    // Owed from authorization onward and independent of history well-formedness: an absent
    // or duplicated proposed pin leaves nothing attestable, which fails closed here too.
    errors.push(...validateRecordReviewByteBinding({
      path,
      phase: record.attempt.phase,
      reviewedRecordSha256:
        record.evidence.record_review_binding?.reviewed_record_sha256 ?? null,
      pinnedProposedRecordSha256,
      currentRecordSha256: recordSha256,
    }));
    verifyFounderAuthorization(root, path, record, trustContext, errors);
  }
  if (Object.values(record.production_exclusion ?? {}).some((value) => value !== true)) {
    errors.push(`${path}: every production exclusion must remain true`);
  }
  if (record.disposition?.profile !== 'HOLD') {
    errors.push(`${path}: topology rehearsal disposition must remain HOLD`);
  }
};

export const validateTopologyRehearsals = ({
  root = DEFAULT_ROOT,
  pinnedState,
} = {}) => {
  const errors = [];
  let schemaValidator = null;
  try {
    schemaValidator = compileSchema(root, errors);
  } catch (error) {
    errors.push(`${TOPOLOGY_SCHEMA_PATH}: schema initialization failed: ${error.message}`);
  }

  const policy = readJson(root, TOPOLOGY_POLICY_PATH, errors);
  if (
    !policy
    || policy.schema_version !== '1.0.0'
    || JSON.stringify(policy.allowed_records) !== JSON.stringify(PINNED_TOPOLOGY_RECORDS)
    || !hasExactKeys(policy, [
      'schema_version',
      'allowed_records',
      'current_state',
      'state_history',
    ])
  ) errors.push(`${TOPOLOGY_POLICY_PATH}: policy must exactly match the validator-pinned singleton`);
  const statePolicy = {
    current_state: policy?.current_state ?? null,
    state_history: Array.isArray(policy?.state_history) ? policy.state_history : [],
  };
  let effectivePinnedState = pinnedState ?? PINNED_TOPOLOGY_STATE;
  try {
    if (!pinnedState && realpathSync(root) !== realpathSync(DEFAULT_ROOT)) {
      errors.push(
        `${TOPOLOGY_POLICY_PATH}: non-default root requires an explicit independently supplied pinned state`,
      );
    }
  } catch {
    effectivePinnedState = PINNED_TOPOLOGY_STATE;
  }
  if (JSON.stringify(statePolicy) !== JSON.stringify(effectivePinnedState)) {
    errors.push(`${TOPOLOGY_POLICY_PATH}: state policy must exactly match the validator-pinned state`);
  }

  const trustContext = validateFounderTrust(root, errors);
  const discovered = walkRecordFiles(root, errors);
  const exactDepth = discovered.filter((path) => path.split('/').length === 5);
  for (const path of discovered.filter((entry) => entry.split('/').length !== 5)) {
    errors.push(`${path}: mislocated topology-rehearsal.json`);
  }
  if (exactDepth.length > 1) {
    errors.push(`${TOPOLOGY_POLICY_PATH}: topology policy permits only the exact singleton record`);
  }

  const records = [];
  const recordBytes = [];
  const pinned = PINNED_TOPOLOGY_RECORDS[0];
  const pinnedProposedRecordSha256 = pinnedProposedRecordDigest(statePolicy.state_history);
  for (const path of exactDepth) {
    let record;
    let recordSha256 = null;
    try {
      const bytes = readFileSync(containedRegularFile(root, path));
      record = JSON.parse(bytes.toString('utf8'));
      recordSha256 = sha256(bytes);
      recordBytes.push(bytes);
    } catch (error) {
      errors.push(`${path}: topology record must be a contained regular file: ${error.message}`);
      continue;
    }
    records.push(record);
    validateRecord({
      root,
      path,
      record,
      schemaValidator,
      pinned,
      trustContext,
      recordSha256,
      pinnedProposedRecordSha256,
      errors,
    });
  }

  validateStateBinding({ records, recordBytes, statePolicy, errors });

  return {
    errors,
    counts: {
      records: records.length,
      execution_authorized: records.filter(
        (record) => record?.attempt?.execution_authorized === true,
      ).length,
      closed: records.filter((record) => record?.attempt?.phase === 'closed').length,
    },
  };
};

export const formatTopologyRehearsalReport = (report) => {
  if (report.errors.length > 0) {
    return {
      exitCode: 1,
      stdout:
        `TOPOLOGY REHEARSAL: FAIL (${report.errors.length} error(s))\n` +
        `${report.errors.join('\n')}\n`,
    };
  }
  return {
    exitCode: 0,
    stdout:
      `TOPOLOGY REHEARSAL: PASS (records ${report.counts.records}, authorized ` +
      `${report.counts.execution_authorized}, closed ${report.counts.closed}). ` +
      'Static control only; no runtime, UAT, demo, release or production authority.\n',
  };
};

export const isMainModule = (argv1 = process.argv[1]) => {
  if (!argv1) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return false;
  }
};

if (isMainModule()) {
  const rendered = formatTopologyRehearsalReport(validateTopologyRehearsals());
  process.stdout.write(rendered.stdout);
  process.exitCode = rendered.exitCode;
}
