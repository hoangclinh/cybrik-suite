// Dedicated topology-only rehearsal registry validator.
// Static, deterministic and read-only. Green validates control records only;
// it grants no Docker, runtime, UAT, demo, release or production authority.

import { execFileSync } from 'node:child_process';
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

const EXPECTED_PROBE_ARGV = Object.freeze([
  '-z',
  '-w',
  '5',
  '127.0.0.1',
  '15433',
]);
const REQUIRED_BASE_ARTIFACTS = Object.freeze(['diagnosis', 'independent_review']);
const REQUIRED_CLOSED_ARTIFACTS = Object.freeze([
  ...REQUIRED_BASE_ARTIFACTS,
  'grant',
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

const walkRecordFiles = (root, relativeDir = TOPOLOGY_ROOT) => {
  const absoluteDir = resolve(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  const files = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const path = join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRecordFiles(root, path));
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
  for (const kind of expectedKinds) {
    if (!kinds.includes(kind)) errors.push(`${path}: required ${kind} artifact is missing`);
  }
  if (new Set(kinds).size !== kinds.length) {
    errors.push(`${path}: artifact kind values must be unique`);
  }
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
    requireArtifactKinds(path, record.evidence.artifacts, REQUIRED_BASE_ARTIFACTS, errors);
    if (kinds.some((kind) => ['grant', 'result', 'evidence_manifest', 'result_review'].includes(kind))) {
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
      [...REQUIRED_BASE_ARTIFACTS, 'grant'],
      errors,
    );
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
  requireArtifactKinds(path, record.evidence.artifacts, REQUIRED_CLOSED_ARTIFACTS, errors);
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

const validateRecord = (root, path, record, schemaValidator, pinned, errors) => {
  validateSchema(schemaValidator, path, record, errors);
  if (!record || typeof record !== 'object') return;

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
  if (Object.values(record.production_exclusion ?? {}).some((value) => value !== true)) {
    errors.push(`${path}: every production exclusion must remain true`);
  }
  if (record.disposition?.profile !== 'HOLD') {
    errors.push(`${path}: topology rehearsal disposition must remain HOLD`);
  }
};

export const validateTopologyRehearsals = ({ root = DEFAULT_ROOT } = {}) => {
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
    || Object.keys(policy).length !== 2
  ) errors.push(`${TOPOLOGY_POLICY_PATH}: policy must exactly match the validator-pinned singleton`);

  const discovered = walkRecordFiles(root);
  const exactDepth = discovered.filter((path) => path.split('/').length === 5);
  for (const path of discovered.filter((entry) => entry.split('/').length !== 5)) {
    errors.push(`${path}: mislocated topology-rehearsal.json`);
  }
  if (exactDepth.length > 1) {
    errors.push(`${TOPOLOGY_POLICY_PATH}: topology policy permits only the exact singleton record`);
  }

  const records = [];
  const pinned = PINNED_TOPOLOGY_RECORDS[0];
  for (const path of exactDepth) {
    let record;
    try {
      record = JSON.parse(readFileSync(containedRegularFile(root, path), 'utf8'));
    } catch (error) {
      errors.push(`${path}: topology record must be a contained regular file: ${error.message}`);
      continue;
    }
    records.push(record);
    validateRecord(root, path, record, schemaValidator, pinned, errors);
  }

  return {
    errors,
    counts: {
      records: records.length,
      execution_authorized: records.filter(
        (record) => record.attempt?.execution_authorized === true,
      ).length,
      closed: records.filter((record) => record.attempt?.phase === 'closed').length,
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
