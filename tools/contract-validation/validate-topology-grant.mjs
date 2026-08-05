// Dedicated C8 topology-rehearsal exact-action grant validator.
//
// Every exported semantic function is a pure projection over caller-supplied values: it
// opens no file, spawns no process and touches no network, so the control is provable
// directly rather than only through committed bytes. That claim is scoped to the imported
// semantic path only. The command-line control surface at the bottom of this file is not
// part of it: the command-line dependency resolver may call the pinned `/usr/bin/git` to
// locate the validation package root, and it reads the committed grant schema. Signature
// verification is an injection-only seam — this module never verifies a signature itself, it
// only refuses to let malformed grant bytes reach an injected verifier and requires an exact
// `true` verdict.
//
// Green validates grant documents only. It grants no Docker effect, listener, container,
// PostgreSQL run, rehearsal execution, runtime, UAT, demo, merge, release or production
// authority.

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');

export const GRANT_SCHEMA_PATH = 'docs/uat/topology-rehearsal-grant.schema.json';
const GRANT_SCHEMA_ID =
  'https://contracts.cybrik.example/docs/uat/topology-rehearsal-grant.schema.json';

// The exact ordered top-level inventory of an exact-action grant. Order is part of the
// canonical bytes, so a reordered document is a different document and fails closed.
export const GRANT_KEYS = Object.freeze([
  'schema',
  'record',
  'runner',
  'topology',
  'selected_image_identity',
  'observed_image_identity',
  'repositories',
  'tools',
  'window',
  'attempt',
  'authorizes',
  'grants_no_authority',
]);

const GRANT_SCHEMA_VERSION = 'CYBRIK-TOPOLOGY-REHEARSAL-GRANT/v1';
const GRANT_MAX_BYTES = 65536;
const PINNED_RECORD_PATH =
  'docs/uat/topology-rehearsals/postgres-loopback-internal-v1-r1/topology-rehearsal.json';
const AUTHORIZED_ACTION = 'topology_rehearsal_single_attempt';
const RUNTIME_LIMIT_SECONDS = 180;
const HOST_IP = '127.0.0.1';
const HOST_PORT = 15433;
const CONTAINER_PORT = 5432;
const PROTOCOL = 'tcp';
const PROBE_PATH = '/usr/bin/nc';
const PROBE_ARGV = Object.freeze(['-z', '-w', '5', '127.0.0.1', '15433']);
const PULL_POLICY = 'never';
const PLATFORM_OS = 'linux';

const RECORD_KEYS = Object.freeze(['path', 'sha256']);
const RUNNER_KEYS = Object.freeze(['aggregate_sha256']);
const TOPOLOGY_KEYS = Object.freeze([
  'host_ip',
  'host_port',
  'container_port',
  'protocol',
  'internal_network',
  'publish_spec',
]);
const PLATFORM_KEYS = Object.freeze(['os', 'architecture', 'variant']);
const SELECTED_IDENTITY_KEYS = Object.freeze([
  'repository',
  'tag',
  'platform',
  'index_digest',
  'manifest_digest',
  'pull_policy',
]);
const OBSERVED_IDENTITY_KEYS = Object.freeze([
  'repository',
  'tag',
  'platform',
  'index_digest',
  'manifest_digest',
  'local_image_id',
  'observed_at',
]);
// The four control repositories, in their exact declared order.
const CONTROL_REPOSITORIES = Object.freeze([
  'cybrik-suite',
  'cybrik-soc-command-center',
  'cybrik-cyber-ai-platform',
  'cybrik-security-tool-fabric',
]);
const REPOSITORY_KEYS = Object.freeze(['commit', 'tree', 'clean']);
const TOOLS_KEYS = Object.freeze(['docker', 'probe']);
const DOCKER_KEYS = Object.freeze(['path', 'sha256', 'version']);
const PROBE_KEYS = Object.freeze(['path', 'sha256', 'argv']);
const WINDOW_KEYS = Object.freeze([
  'not_before',
  'expires_at',
  'runtime_limit_seconds',
  'extension_cycles',
]);
const ATTEMPT_KEYS = Object.freeze(['ordinal', 'max_attempts']);
const NO_AUTHORITY_KEYS = Object.freeze([
  'demo',
  'merge',
  'product_runtime',
  'production',
  'release',
  'uat',
]);

const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const DIGEST_REFERENCE_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/u;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const REPOSITORY_NAME_PATTERN = /^[a-z0-9]+(?:[._\-/][a-z0-9]+)*$/u;
const IMAGE_TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/u;
const ARCHITECTURE_PATTERN = /^[a-z0-9_]{2,16}$/u;
const TOOL_VERSION_PATTERN = /^[0-9][0-9A-Za-z._+-]{0,31}$/u;
const ABSOLUTE_PATH_PATTERN = /^\/[\x21-\x7e]{1,200}$/u;

// Exact finding texts. Only the unresolved-selection finding may carry the word
// "unresolved", so an unresolved selection reports exactly one primary cause.
const KEY_INVENTORY_FINDING =
  'grant must carry the exact ordered top-level grant key inventory';
const BOUNDED_BYTES_FINDING =
  'grant bytes must stay within the bounded 65536-byte grant limit';
const CANONICAL_BYTES_FINDING =
  'grant bytes must be exact canonical JSON: JSON.stringify(value, null, 2) plus one LF, UTF-8, no BOM and no trailing bytes';
const SCHEMA_FINDING = `grant schema must be ${GRANT_SCHEMA_VERSION}`;
const RECORD_FINDING =
  'grant record binding must name the pinned topology record path and its 64-hex digest';
const RECORD_BINDING_FINDING =
  'grant record binding must name the exact pinned proposed prior-state record digest';
const RUNNER_FINDING = 'grant runner binding must be one 64-hex aggregate digest';
const TOPOLOGY_FINDING =
  'grant topology must be the exact loopback, internal-network publish envelope';
const SELECTED_UNRESOLVED_FINDING =
  'grant selected required image identity is unresolved: an exact-action grant requires a resolved platform, index digest and manifest digest';
const SELECTED_IDENTITY_FINDING =
  'grant selected required image identity must be exact and well formed';
const OBSERVED_IDENTITY_FINDING =
  'grant observed host image identity must be exact and well formed';
const IDENTITY_AGREEMENT_FINDING =
  'grant observed host image identity must agree exactly with the selected required image identity';
const LOCAL_IMAGE_ID_FINDING =
  'grant local image ID must be a distinct host identity, never an index digest or manifest digest';
const OBSERVATION_CHRONOLOGY_FINDING =
  'grant host image observation must be made inside the authorized window and no later than now';
const REPOSITORY_INVENTORY_FINDING =
  'grant repository inventory must be exactly the four control repositories';
const REPOSITORY_COMMIT_FINDING =
  'grant repository commit identities must be exact 40-hex and distinct';
const REPOSITORY_TREE_FINDING =
  'grant repository tree identities must be exact 40-hex and distinct';
const REPOSITORY_CLEAN_FINDING = 'grant requires every control repository worktree to be clean';
const TOOLS_FINDING =
  'grant tool identities must pin the exact docker binary and the exact bounded probe';
const WINDOW_CYCLE_FINDING =
  'grant window must be one 180-second cycle with zero extension cycles';
const WINDOW_DURATION_FINDING =
  'grant window duration must be exactly 180 seconds after not_before';
const WINDOW_ADMISSION_FINDING =
  'now must be inside the authorized grant window, closed at not_before and open at expires_at';
const ATTEMPT_FINDING = 'grant attempt must be the single first attempt of one';
const AUTHORIZES_FINDING = `grant must authorize exactly ${AUTHORIZED_ACTION}`;
const NO_AUTHORITY_FINDING =
  'grant must declare every no-authority clause present and true';
// Exported so a caller can tell an actual signature failure apart from a grant-document
// failure and keep its own generic signature message reserved for the former.
export const GRANT_SIGNATURE_FINDING =
  'grant signature verification must return an exact true verdict; a false, non-true or throwing verifier fails closed';

// Totality helpers: every projection proves the shape it reads before reading it, so a
// malformed document produces a finding instead of a TypeError.
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasExactOrderedKeys = (value, keys) => {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key, index) => actual[index] === key);
};

const isDigest = (value) => typeof value === 'string' && DIGEST_PATTERN.test(value);
const isDigestReference = (value) =>
  typeof value === 'string' && DIGEST_REFERENCE_PATTERN.test(value);
const isGitObject = (value) => typeof value === 'string' && GIT_OBJECT_PATTERN.test(value);
const instantMs = (value) =>
  typeof value === 'string' && INSTANT_PATTERN.test(value) ? Date.parse(value) : Number.NaN;
const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const isPlatformExact = (platform) =>
  hasExactOrderedKeys(platform, PLATFORM_KEYS)
  && platform.os === PLATFORM_OS
  && typeof platform.architecture === 'string'
  && ARCHITECTURE_PATTERN.test(platform.architecture)
  && (platform.variant === null
    || (typeof platform.variant === 'string' && ARCHITECTURE_PATTERN.test(platform.variant)));

const isImageNameExact = (identity) =>
  typeof identity.repository === 'string'
  && REPOSITORY_NAME_PATTERN.test(identity.repository)
  && typeof identity.tag === 'string'
  && IMAGE_TAG_PATTERN.test(identity.tag);

// The record binding names the one exact proposed prior-state record digest the caller pins
// from the policy state history. It can never name the current authorized record's own
// digest: that record embeds `grant_sha256` and the grant embeds the record digest, so a
// current-hash binding is a cryptographic fixed point rather than an attestable binding. The
// pin is caller-supplied and mandatory — an absent, malformed or duplicated proposed pin
// supplies no digest, so the grant fails closed. The shape finding is terminal for the
// binding: a record block that is not the pinned path and a 64-hex digest carries nothing
// comparable, so only its own cause is reported.
const validateRecordBinding = (grant, pinnedProposedRecordSha256, report) => {
  const record = grant.record;
  if (
    !hasExactOrderedKeys(record, RECORD_KEYS)
    || record.path !== PINNED_RECORD_PATH
    || !isDigest(record.sha256)
  ) {
    report(RECORD_FINDING);
  } else if (
    !isDigest(pinnedProposedRecordSha256)
    || record.sha256 !== pinnedProposedRecordSha256
  ) {
    report(RECORD_BINDING_FINDING);
  }
  if (
    !hasExactOrderedKeys(grant.runner, RUNNER_KEYS)
    || !isDigest(grant.runner.aggregate_sha256)
  ) report(RUNNER_FINDING);
};

const validateTopology = (topology, report) => {
  if (
    !hasExactOrderedKeys(topology, TOPOLOGY_KEYS)
    || topology.host_ip !== HOST_IP
    || topology.host_port !== HOST_PORT
    || topology.container_port !== CONTAINER_PORT
    || topology.protocol !== PROTOCOL
    || topology.internal_network !== true
    || topology.publish_spec !== `${HOST_IP}:${HOST_PORT}:${CONTAINER_PORT}/${PROTOCOL}`
  ) report(TOPOLOGY_FINDING);
};

// Identity separation is the point of this control: the selected required image identity is
// the registry-side selection (index digest, manifest digest, platform, pull policy) and the
// observed host image identity is what a host reported (adding a local image ID and an
// observation instant). A local image ID is a host-local identifier and can never stand in
// for either registry digest.
const validateImageIdentities = (grant, window, now, report) => {
  const selected = grant.selected_image_identity;
  const observed = grant.observed_image_identity;

  const selectedShaped = hasExactOrderedKeys(selected, SELECTED_IDENTITY_KEYS);
  const unresolved = selectedShaped
    && selected.platform === null
    && selected.index_digest === null
    && selected.manifest_digest === null;
  if (unresolved) {
    report(SELECTED_UNRESOLVED_FINDING);
  } else if (
    !selectedShaped
    || !isImageNameExact(selected)
    || !isPlatformExact(selected.platform)
    || !isDigestReference(selected.index_digest)
    || !isDigestReference(selected.manifest_digest)
    || selected.index_digest === selected.manifest_digest
    || selected.pull_policy !== PULL_POLICY
  ) report(SELECTED_IDENTITY_FINDING);

  const observedShaped = hasExactOrderedKeys(observed, OBSERVED_IDENTITY_KEYS);
  if (
    !observedShaped
    || !isImageNameExact(observed)
    || !isPlatformExact(observed.platform)
    || !isDigestReference(observed.index_digest)
    || !isDigestReference(observed.manifest_digest)
    || observed.index_digest === observed.manifest_digest
    || !isDigestReference(observed.local_image_id)
    || Number.isNaN(instantMs(observed.observed_at))
  ) report(OBSERVED_IDENTITY_FINDING);

  if (observedShaped) {
    const collides = [
      observed.index_digest,
      observed.manifest_digest,
      selectedShaped ? selected.index_digest : null,
      selectedShaped ? selected.manifest_digest : null,
    ].some((digest) => digest !== null && digest === observed.local_image_id);
    if (collides) report(LOCAL_IMAGE_ID_FINDING);
  }

  // Agreement is derivative of a resolved selection: an unresolved selection has nothing
  // exact to agree with, so it reports its own single cause instead.
  if (selectedShaped && observedShaped && !unresolved) {
    const agrees = ['repository', 'tag', 'platform', 'index_digest', 'manifest_digest']
      .every((key) => sameValue(selected[key], observed[key]));
    if (!agrees) report(IDENTITY_AGREEMENT_FINDING);
  }

  if (observedShaped && window !== null && !Number.isNaN(now)) {
    const observedAt = instantMs(observed.observed_at);
    if (
      Number.isNaN(observedAt)
      || observedAt < window.notBefore
      || observedAt > now
      || observedAt >= window.expiresAt
    ) report(OBSERVATION_CHRONOLOGY_FINDING);
  }
};

const validateRepositories = (repositories, report) => {
  if (!hasExactOrderedKeys(repositories, CONTROL_REPOSITORIES)) {
    report(REPOSITORY_INVENTORY_FINDING);
    return;
  }
  const entries = CONTROL_REPOSITORIES.map((name) => repositories[name]);
  if (!entries.every((entry) => hasExactOrderedKeys(entry, REPOSITORY_KEYS))) {
    report(REPOSITORY_INVENTORY_FINDING);
    return;
  }
  const commits = entries.map((entry) => entry.commit);
  const trees = entries.map((entry) => entry.tree);
  if (!commits.every(isGitObject) || new Set(commits).size !== commits.length) {
    report(REPOSITORY_COMMIT_FINDING);
  }
  if (!trees.every(isGitObject) || new Set(trees).size !== trees.length) {
    report(REPOSITORY_TREE_FINDING);
  }
  if (!entries.every((entry) => entry.clean === true)) report(REPOSITORY_CLEAN_FINDING);
};

const validateTools = (tools, report) => {
  const docker = isPlainObject(tools) ? tools.docker : null;
  const probe = isPlainObject(tools) ? tools.probe : null;
  if (
    !hasExactOrderedKeys(tools, TOOLS_KEYS)
    || !hasExactOrderedKeys(docker, DOCKER_KEYS)
    || typeof docker.path !== 'string'
    || !ABSOLUTE_PATH_PATTERN.test(docker.path)
    || !isDigest(docker.sha256)
    || typeof docker.version !== 'string'
    || !TOOL_VERSION_PATTERN.test(docker.version)
    || !hasExactOrderedKeys(probe, PROBE_KEYS)
    || probe.path !== PROBE_PATH
    || !isDigest(probe.sha256)
    || !sameValue(probe.argv, PROBE_ARGV)
  ) report(TOOLS_FINDING);
};

// Returns the parsed window bounds when they are exact, otherwise null. A window that is not
// one 180-second cycle admits nothing, so downstream chronology stays unreported.
const validateWindow = (window, now, report) => {
  if (
    !hasExactOrderedKeys(window, WINDOW_KEYS)
    || window.runtime_limit_seconds !== RUNTIME_LIMIT_SECONDS
    || window.extension_cycles !== 0
  ) {
    report(WINDOW_CYCLE_FINDING);
    return null;
  }
  const notBefore = instantMs(window.not_before);
  const expiresAt = instantMs(window.expires_at);
  if (
    Number.isNaN(notBefore)
    || Number.isNaN(expiresAt)
    || expiresAt - notBefore !== RUNTIME_LIMIT_SECONDS * 1000
  ) {
    report(WINDOW_DURATION_FINDING);
    return null;
  }
  if (Number.isNaN(now) || now < notBefore || now >= expiresAt) {
    report(WINDOW_ADMISSION_FINDING);
  }
  return { notBefore, expiresAt };
};

/**
 * Exact semantic validation of one grant document. Pure: no file, process or network effect.
 * Returns every finding it can prove; an empty array means the document is exact.
 *
 * `pinnedProposedRecordSha256` is the caller's one pinned proposed prior-state record digest.
 * It is mandatory: defaulting it away would let an unpinned grant pass, so its absence is a
 * refusal rather than a skipped control.
 */
export const validateGrantDocument = (
  grant,
  { now = null, pinnedProposedRecordSha256 = null } = {},
) => {
  const findings = [];
  const report = (text) => findings.push(text);
  if (!hasExactOrderedKeys(grant, GRANT_KEYS)) return [KEY_INVENTORY_FINDING];

  if (grant.schema !== GRANT_SCHEMA_VERSION) report(SCHEMA_FINDING);
  validateRecordBinding(grant, pinnedProposedRecordSha256, report);
  validateTopology(grant.topology, report);

  const nowMs = instantMs(now);
  const window = validateWindow(grant.window, nowMs, report);
  validateImageIdentities(grant, window, nowMs, report);
  validateRepositories(grant.repositories, report);
  validateTools(grant.tools, report);

  if (
    !hasExactOrderedKeys(grant.attempt, ATTEMPT_KEYS)
    || grant.attempt.ordinal !== 1
    || grant.attempt.max_attempts !== 1
  ) report(ATTEMPT_FINDING);
  if (grant.authorizes !== AUTHORIZED_ACTION) report(AUTHORIZES_FINDING);
  if (
    !hasExactOrderedKeys(grant.grants_no_authority, NO_AUTHORITY_KEYS)
    || !NO_AUTHORITY_KEYS.every((key) => grant.grants_no_authority[key] === true)
  ) report(NO_AUTHORITY_FINDING);

  return findings;
};

/**
 * The canonical byte rendering of a grant: exactly `JSON.stringify(value, null, 2)` plus one
 * LF, encoded UTF-8 with no BOM. Pure.
 */
export const canonicalGrantBytes = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');

const asBuffer = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
};

/**
 * Byte-level validation of grant bytes. The bounded-length and canonical-rendering gates are
 * terminal: nothing downstream of non-canonical bytes can be trusted, so the exact cause is
 * reported alone. Round-tripping the parsed value rejects a BOM, CRLF endings, compact or
 * re-indented serializations, duplicate keys, reordered keys and any trailing byte. Every
 * option, including the mandatory pinned proposed record digest, passes straight through to
 * the document projection. Pure.
 */
export const validateGrantBytes = (bytes, options = {}) => {
  const buffer = asBuffer(bytes);
  if (buffer === null) return [CANONICAL_BYTES_FINDING];
  if (buffer.length > GRANT_MAX_BYTES) return [BOUNDED_BYTES_FINDING];
  let grant;
  try {
    grant = JSON.parse(buffer.toString('utf8'));
  } catch {
    return [CANONICAL_BYTES_FINDING];
  }
  if (!isPlainObject(grant) || !buffer.equals(canonicalGrantBytes(grant))) {
    return [CANONICAL_BYTES_FINDING];
  }
  return validateGrantDocument(grant, options);
};

/**
 * Fail-closed grant authorization ahead of any signature acceptance.
 *
 * Signature verification is injection-only: this module spawns nothing and reads nothing. The
 * caller supplies `verifySignature`, which is reached only after the exact bytes, the exact
 * document semantics and the pinned proposed record binding all hold — an unpinned grant never
 * reaches it — is called exactly once with the same bytes that were validated, and
 * must return an exact `true`. A false verdict, a non-true value, a missing verifier or a
 * thrown exception all fail closed. Pure with respect to this module.
 */
export const validateGrantBeforeSignature = (
  bytes,
  { now = null, pinnedProposedRecordSha256 = null, verifySignature } = {},
) => {
  const findings = validateGrantBytes(bytes, { now, pinnedProposedRecordSha256 });
  if (findings.length > 0) return findings;
  if (typeof verifySignature !== 'function') return [GRANT_SIGNATURE_FINDING];
  let verdict;
  try {
    verdict = verifySignature(asBuffer(bytes));
  } catch {
    return [GRANT_SIGNATURE_FINDING];
  }
  return verdict === true ? [] : [GRANT_SIGNATURE_FINDING];
};

// ---------------------------------------------------------------------------
// Command-line control surface. Everything below runs only as a script: it reads the
// committed grant schema and proves that the schema and this validator pin the same exact
// ordered inventory. No exported semantic function participates in any of it.
// ---------------------------------------------------------------------------

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

const validateGrantSchemaFile = (root) => {
  const errors = [];
  let schema;
  try {
    schema = JSON.parse(readFileSync(resolve(root, GRANT_SCHEMA_PATH), 'utf8'));
  } catch (error) {
    return [`${GRANT_SCHEMA_PATH}: cannot read valid JSON: ${error.message}`];
  }
  if (schema?.$id !== GRANT_SCHEMA_ID) {
    errors.push(`${GRANT_SCHEMA_PATH}: $id must be the pinned grant schema identifier`);
  }
  if (schema?.additionalProperties !== false) {
    errors.push(`${GRANT_SCHEMA_PATH}: grant schema must be closed`);
  }
  if (!sameValue(schema?.required, GRANT_KEYS)) {
    errors.push(`${GRANT_SCHEMA_PATH}: required must be the exact ordered grant key inventory`);
  }
  if (!sameValue(Object.keys(schema?.properties ?? {}), GRANT_KEYS)) {
    errors.push(`${GRANT_SCHEMA_PATH}: properties must be the exact ordered grant key inventory`);
  }
  try {
    const requireFromValidationRoot = dependencyRequire();
    const AjvModule = requireFromValidationRoot('ajv/dist/2020.js');
    const addFormatsModule = requireFromValidationRoot('ajv-formats');
    const Ajv2020 = AjvModule.default || AjvModule;
    const addFormats = addFormatsModule.default || addFormatsModule;
    const ajv = new Ajv2020({ strict: true, strictTypes: false, allErrors: true });
    addFormats(ajv);
    ajv.compile(schema);
  } catch (error) {
    errors.push(`${GRANT_SCHEMA_PATH}: schema compile failed: ${error.message}`);
  }
  return errors;
};

const formatGrantReport = (errors) => {
  if (errors.length > 0) {
    return {
      exitCode: 1,
      stdout: `TOPOLOGY GRANT: FAIL (${errors.length} error(s))\n${errors.join('\n')}\n`,
    };
  }
  return {
    exitCode: 0,
    stdout:
      `TOPOLOGY GRANT: PASS (grant schema pinned, ${GRANT_KEYS.length} exact ordered keys, `
      + 'signature verification injection-only). Static control only; no Docker, listener, '
      + 'runtime, UAT, demo, merge, release or production authority.\n',
  };
};

const isMainModule = (argv1 = process.argv[1]) => {
  if (!argv1) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return false;
  }
};

if (isMainModule()) {
  const rendered = formatGrantReport(validateGrantSchemaFile(DEFAULT_ROOT));
  process.stdout.write(rendered.stdout);
  process.exitCode = rendered.exitCode;
}
