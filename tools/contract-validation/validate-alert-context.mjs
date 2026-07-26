// Standalone static validator for the W1 R0 `soc.get_alert_context`
// capability-specific contract packet, ACCEPTED FOR IMPLEMENTATION on
// 2026-07-26 and NOT IMPLEMENTED.
//
// Exit 0 proves packet/schema/fixture/binding integrity and lifecycle coherence
// only. Acceptance is a recorded contract decision, not evidence: exit 0
// implements no endpoint, authorizes no tool invocation, wires no CI, and proves
// no runtime authorization or no-existence-leak behavior. TR-7/TR-8/TR-9 stay
// open runtime obligations and the validator fails closed if the packet tries to
// close them, half-flip the lifecycle, or keep a superseded binding.
//
// Declared standalone commands, run from the repository root against an existing
// dependency install (nothing is installed and no network is used):
//
//   node tools/contract-validation/validate-alert-context.mjs
//   node --test tools/contract-validation/tests/validate-alert-context.test.mjs
//   node --test --experimental-test-coverage \
//     tools/contract-validation/tests/validate-alert-context.test.mjs
//
// Set CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT to a directory whose node_modules
// already provides ajv 8.20.0 and ajv-formats 3.0.1 when this worktree has no
// local install. The compatibility manifest declares these same commands and the
// validator fails closed if the declaration drifts. Canonical CI wiring is
// deliberately out of scope here and belongs to a later integration gate.

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');
const SCHEMA_FILE = 'json-schema/cybrik.soc-get-alert-context.v1.schema.json';
const EXAMPLES_MANIFEST_FILE = 'examples/alert-context/examples-manifest.json';
const COMPATIBILITY_FILE = 'compatibility/cybrik-suite-alert-context-packet.v1.manifest.json';
const EXPECTED_STATUS = 'ACCEPTED FOR IMPLEMENTATION';
const EXPECTED_NOT_ACCEPTED = false;
const EXPECTED_ACCEPTED_ON = '2026-07-26';
const EXPECTED_VERSION = '0.1.0';
// Any surviving uppercase PROPOSED token inside a lifecycle document means the
// acceptance flip was only partially applied.
const SUPERSEDED_LIFECYCLE_TEXT = /\bPROPOSED\b/;
// Acceptance must not close these. They stay declared-only runtime obligations.
const EXPECTED_OPEN_RUNTIME_OBLIGATIONS = Object.freeze(['TR-7', 'TR-8', 'TR-9']);
const EXPECTED_FIXTURE_EXERCISED_INVARIANTS = Object.freeze([
  'TR-1',
  'TR-2',
  'TR-3',
  'TR-4',
  'TR-5',
  'TR-6',
]);
const REQUEST_INPUT_SCHEMA = 'cybrik.soc-get-alert-context.request-input@0.1.0';
const AUTHORIZATION_BINDING_SCHEMA =
  'cybrik.soc-get-alert-context.authorization-binding@0.1.0';
const AVAILABLE_RESULT_SCHEMA =
  'cybrik.soc-get-alert-context.available-result@0.1.0';

const EXPECTED_EXAMPLES = Object.freeze([
  ['positive/request.json', 'positive'],
  ['positive/result.available.json', 'positive'],
  ['positive/result.unavailable.json', 'positive'],
  ['negative-schema/request.execution-grant-in-body.json', 'negative-schema'],
  ['negative-schema/request.w2f-delegation-as-tool-grant.json', 'negative-schema'],
  ['negative-schema/request.alert-ref-missing-digest.json', 'negative-schema'],
  ['negative-schema/result.existence-leak.json', 'negative-schema'],
  ['negative-semantic/request.cross-tenant-actor.json', 'negative-semantic'],
  ['negative-semantic/result.cross-org.json', 'negative-semantic'],
  ['negative-semantic/result.clearance-exceeded.json', 'negative-semantic'],
  ['negative-semantic/result.digest-mismatch.json', 'negative-semantic'],
]);

// Independent expectation of which canonical structural trust invariant each
// negative-schema fixture witnesses. The compatibility manifest owns the label
// text; the examples manifest may only cite a label declared there, so the two
// documents cannot drift into an untraceable mislabel.
const EXPECTED_TRUST_INVARIANTS = Object.freeze({
  'negative-schema/request.execution-grant-in-body.json': 'TI-3',
  'negative-schema/request.w2f-delegation-as-tool-grant.json': 'TI-3',
  'negative-schema/request.alert-ref-missing-digest.json': 'TI-5',
  'negative-schema/result.existence-leak.json': 'TI-4',
});

const EXPECTED_EXAMPLE_FILES = Object.freeze([
  EXAMPLES_MANIFEST_FILE,
  ...EXPECTED_EXAMPLES.map(([file]) => `examples/alert-context/${file}`),
]);
const EXPECTED_MEMBER_FILES = Object.freeze([
  SCHEMA_FILE,
  ...EXPECTED_EXAMPLE_FILES,
]);

const MEMBER_KIND = Object.freeze({
  [SCHEMA_FILE]: 'json-schema',
  [EXAMPLES_MANIFEST_FILE]: 'example-manifest',
  ...Object.fromEntries(
    EXPECTED_EXAMPLES.map(([file, kind]) => [`examples/alert-context/${file}`, kind]),
  ),
});

const SCHEMA_TOP_LEVEL_KEYS = Object.freeze([
  '$schema',
  '$id',
  'title',
  'description',
  'x-cybrik-status',
  'x-cybrik-not-accepted',
  'x-cybrik-contract-version',
  'oneOf',
  '$defs',
]);
const SCHEMA_DEFS = Object.freeze([
  'capabilityPin',
  'orgScope',
  'safeInternalObjectRef',
  'alertRef',
  'alertContext',
  'unavailableFailure',
  'idempotencyConflictFailure',
  'authorizationBinding',
  'request',
  'result',
]);
const REQUEST_PROPERTIES = Object.freeze([
  'message_type',
  'request_id',
  'idempotency_key',
  'capability',
  'tenant_id',
  'org_scope',
  'actor',
  'purpose',
  'clearance',
  'data_marking',
  'alert_ref',
  'policy_digest',
  'authorization_binding',
  'requested_at',
  'traceparent',
]);
const RESULT_PROPERTIES = Object.freeze([
  'message_type',
  'request_id',
  'idempotency_key',
  'capability',
  'tenant_id',
  'org_scope',
  'authorized_actor',
  'clearance',
  'authorization_binding',
  'idempotency_disposition',
  'outcome',
  'alert_ref',
  'context',
  'context_digest',
  'failure',
  'data_marking',
  'policy_digest',
  'completed_at',
  'traceparent',
]);
const REQUEST_REQUIRED = Object.freeze(REQUEST_PROPERTIES.filter((key) => key !== 'traceparent'));
const RESULT_REQUIRED = Object.freeze(
  RESULT_PROPERTIES.filter((key) => ![
    'alert_ref',
    'context',
    'context_digest',
    'failure',
    'traceparent',
  ].includes(key)),
);
const CAPABILITY_PROPERTIES = Object.freeze([
  'name',
  'version',
  'digest',
  'risk_class',
  'side_effects',
]);
const ORG_SCOPE_PROPERTIES = Object.freeze(['org_id', 'include_descendants']);
const SAFE_INTERNAL_REF_PROPERTIES = Object.freeze(['type', 'id', 'version', 'digest']);
const SAFE_INTERNAL_REF_REQUIRED = Object.freeze(['type', 'id', 'digest']);
const ALERT_CONTEXT_PROPERTIES = Object.freeze([
  'alert_id',
  'alert_digest',
  'title',
  'severity',
  'status',
  'observed_at',
  'event_refs',
  'entity_refs',
  'case_refs',
]);
const AUTHORIZATION_BINDING_PROPERTIES = Object.freeze([
  'tenant_id',
  'org_scope',
  'actor',
  'capability',
  'schema_digest',
  'input_digest',
  'policy_digest',
  'binding_digest',
]);
const COMPATIBILITY_KEYS = Object.freeze([
  '$schema',
  '$id',
  'title',
  'description',
  'x-cybrik-status',
  'x-cybrik-not-accepted',
  'x-cybrik-contract-version',
  'x-cybrik-packet-version',
  'x-cybrik-is-bundle-tag',
  'format_pins',
  'capability_scope',
  'wire_scope',
  'authority_boundaries',
  'data_and_privacy_boundary',
  'canonicalization',
  'idempotency_semantics',
  'compatibility',
  'trust_invariants',
  'members',
  'member_set_integrity',
  'verification',
  'provenance',
  'proof_limits',
  'acceptance',
  'residual_questions',
]);
const REQUEST_INPUT_PROJECTION_TEXT = Object.freeze([
  'schema = cybrik.soc-get-alert-context.request-input@0.1.0',
  'idempotency_key',
  'purpose',
  'data_marking',
  'alert_ref = exact closed type/id/version?/digest object',
  'requested_at',
]);
const AUTHORIZATION_BINDING_PROJECTION_TEXT = Object.freeze([
  'schema = cybrik.soc-get-alert-context.authorization-binding@0.1.0',
  'tenant_id = credential-derived',
  'org_scope = exact org_id/include_descendants authorized scope',
  'actor = exact type/id/tenant_id/delegated_by? identity',
  'capability = exact name/version/digest/risk_class/side_effects pin',
  'schema_digest = SHA-256 of exact capability schema bytes',
  'input_digest = SHA-256(JCS(request_input_projection))',
  'policy_digest = exact evaluated policy revision',
]);
const AVAILABLE_RESULT_PROJECTION_TEXT = Object.freeze([
  'schema = cybrik.soc-get-alert-context.available-result@0.1.0',
  'request_id',
  'idempotency_key',
  'authorization_binding_digest',
  'tenant_id',
  'org_scope',
  'authorized_actor',
  'clearance',
  'capability',
  'alert_ref',
  'context',
  'data_marking',
  'policy_digest',
]);

const EXPECTED_MEMBER_COUNT = 13;
const MEMBER_SET_INTEGRITY_KEYS = Object.freeze([
  'algorithm',
  'member_count',
  'member_set_digest',
]);
// The declared aggregate algorithm. Its input is members[] alone, so the digest
// never reads the block that carries it and cannot become self-referential.
const MEMBER_SET_ALGORITHM = 'MEMBER-SET-SHA256/v1: reduce every entry of '
  + 'members[] to exactly {file, kind, contract_version, sha256}, sort the '
  + 'reduced entries by file in Unicode code point order, serialize that array '
  + 'as RFC 8785 (JCS) canonical JSON, and render member_set_digest as '
  + 'sha256:<lowercase hex SHA-256 over those UTF-8 bytes>. The digest input is '
  + 'derived from members[] only: member_set_integrity itself and every other '
  + 'manifest key are excluded, so the aggregate is non-circular and is '
  + 'recomputed without reading its own declared value.';
const VERIFICATION_KEYS = Object.freeze([
  'scope',
  'standalone_validator_command',
  'standalone_test_command',
  'standalone_coverage_command',
  'dependency_root_override_env',
  'coverage_floor',
  'test_case_counts',
  'ci_wiring',
]);
const TEST_CASE_COUNT_KEYS = Object.freeze([
  'adversarial_rejection_cases',
  'positive_cases',
  'total_cases',
]);
const EXPECTED_TEST_CASE_COUNTS = Object.freeze({
  adversarial_rejection_cases: 19,
  positive_cases: 2,
  total_cases: 21,
});
const EXPECTED_VERIFICATION_TEXT = Object.freeze({
  scope: 'Standalone static evidence only. The suite in '
    + 'tools/contract-validation/tests/validate-alert-context.test.mjs holds 19 '
    + 'adversarial rejection cases plus 2 positive checks; several adversarial '
    + 'cases are table-driven over multiple mutations and every mutation must '
    + 'fail closed. It proves packet, schema, fixture, authorization-binding, '
    + 'lifecycle-coherence, member-hash and member-set integrity only: no '
    + 'endpoint, Fabric grant, W2-F delegation, runtime enforcement or release '
    + 'certification is demonstrated, and lifecycle acceptance is a recorded '
    + 'decision rather than evidence.',
  standalone_validator_command: 'node tools/contract-validation/validate-alert-context.mjs',
  standalone_test_command:
    'node --test tools/contract-validation/tests/validate-alert-context.test.mjs',
  standalone_coverage_command: 'node --test --experimental-test-coverage '
    + 'tools/contract-validation/tests/validate-alert-context.test.mjs',
  dependency_root_override_env: 'CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT=<directory '
    + 'whose node_modules already provides ajv 8.20.0 and ajv-formats 3.0.1>. '
    + 'All three commands run from the repository root, install nothing and '
    + 'require no network.',
  coverage_floor: 'Branch coverage of '
    + 'tools/contract-validation/validate-alert-context.mjs must stay at or '
    + 'above 80% under the declared standalone coverage command.',
  ci_wiring: 'NOT WIRED. Canonical CI wiring (npm script registration in '
    + 'tools/contract-validation/package.json plus pipeline invocation) is '
    + 'deliberately out of scope for this acceptance and belongs to a later '
    + 'integration gate. This packet adds no tracked file and modifies none.',
});

const sha256Bytes = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
const sha256File = (path) => sha256Bytes(readFileSync(path));
const digest = (bytes) => `sha256:${sha256Bytes(bytes)}`;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// Fixtures use JSON-compatible values only. Sorting object keys and serializing
// primitives with JSON.stringify implements the RFC 8785/JCS subset exercised
// by this packet (no non-finite numbers or lone surrogate code points).
export const canonicalizeJcs = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeJcs).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJcs(value[key])}`)
    .join(',')}}`;
};

const jcsDigest = (value) => digest(Buffer.from(canonicalizeJcs(value), 'utf8'));

// MEMBER-SET-SHA256/v1. Builds a fresh reduced array from members[] and digests
// only those bytes, so no other manifest key — including the block holding the
// declared result — can participate.
export const memberSetDigest = (members) => jcsDigest(
  (Array.isArray(members) ? members : [])
    .map((member) => ({
      file: member?.file,
      kind: member?.kind,
      contract_version: member?.contract_version,
      sha256: member?.sha256,
    }))
    .sort((left, right) => {
      if (left.file < right.file) return -1;
      return left.file > right.file ? 1 : 0;
    }),
);
const same = (left, right) => canonicalizeJcs(left) === canonicalizeJcs(right);
const setEqual = (actual, expected) =>
  actual.size === expected.size && [...expected].every((item) => actual.has(item));

// Returns packet-relative inventory entries. A symlink is reported as
// `SYMLINK:<packet-relative path>` so the marker stays at the front of the
// rendered entry and can never be buried behind the packet prefix.
const listFiles = (root, prefix) => {
  if (!existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const packetPath = `${prefix}${relative(root, path).split(sep).join('/')}`;
      if (entry.isSymbolicLink()) {
        files.push(`SYMLINK:${packetPath}`);
      } else if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        files.push(packetPath);
      }
    }
  };
  visit(root);
  return files.sort();
};

const exactKeys = (label, value, expected, fail) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label}: must be an object`);
    return;
  }
  const actual = new Set(Object.keys(value));
  const wanted = new Set(expected);
  for (const key of actual) {
    if (!wanted.has(key)) fail(`${label}: unexpected key '${key}'`);
  }
  for (const key of wanted) {
    if (!actual.has(key)) fail(`${label}: missing key '${key}'`);
  }
};

const trustInvariantLabel = (text) =>
  (typeof text === 'string' ? /^(TI-\d+)\s/.exec(text)?.[1] : undefined);

// Fails closed when a negative-schema fixture cites a label that is missing,
// differs from the independent expectation, or is not declared by the
// compatibility manifest's canonical trust_invariants.structural block.
const checkTrustInvariantTraceability = (examplesManifest, compatibility, fail) => {
  const canonical = new Set(
    (compatibility.trust_invariants?.structural || [])
      .map(trustInvariantLabel)
      .filter(Boolean),
  );
  const declaredByFile = new Map(
    (examplesManifest.examples || []).map((example) => [example.file, example.invariant]),
  );
  for (const [file, expected] of Object.entries(EXPECTED_TRUST_INVARIANTS)) {
    const declared = trustInvariantLabel(declaredByFile.get(file));
    if (!declared) {
      fail(`example row ${file}: invariant must start with a canonical TI-<n> label`);
    } else if (declared !== expected) {
      fail(
        `example row ${file}: expected trust invariant must be ${expected}, got ${declared}`,
      );
    } else if (!canonical.has(declared)) {
      fail(
        `example row ${file}: expected trust invariant ${declared} is absent from `
        + 'compatibility trust_invariants.structural',
      );
    }
  }
};

const projectionRequestInput = (request) => ({
  schema: REQUEST_INPUT_SCHEMA,
  idempotency_key: request.idempotency_key,
  purpose: request.purpose,
  data_marking: request.data_marking,
  alert_ref: request.alert_ref,
  requested_at: request.requested_at,
});

const projectionAuthorizationBinding = (binding) => ({
  schema: AUTHORIZATION_BINDING_SCHEMA,
  tenant_id: binding.tenant_id,
  org_scope: binding.org_scope,
  actor: binding.actor,
  capability: binding.capability,
  schema_digest: binding.schema_digest,
  input_digest: binding.input_digest,
  policy_digest: binding.policy_digest,
});

const projectionAvailableResult = (result) => ({
  schema: AVAILABLE_RESULT_SCHEMA,
  request_id: result.request_id,
  idempotency_key: result.idempotency_key,
  authorization_binding_digest: result.authorization_binding?.binding_digest,
  tenant_id: result.tenant_id,
  org_scope: result.org_scope,
  authorized_actor: result.authorized_actor,
  clearance: result.clearance,
  capability: result.capability,
  alert_ref: result.alert_ref,
  context: result.context,
  data_marking: result.data_marking,
  policy_digest: result.policy_digest,
});

const fullAlertRef = (value) => ({
  type: value?.type,
  id: value?.id,
  version: value?.version,
  digest: value?.digest,
});

const classificationRank = Object.freeze({
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
});
const tlpRank = Object.freeze({
  'TLP:CLEAR': 0,
  'TLP:GREEN': 1,
  'TLP:AMBER': 2,
  'TLP:AMBER+STRICT': 3,
  'TLP:RED': 4,
});
const exceeds = (marking, clearance) =>
  classificationRank[marking?.classification] > classificationRank[clearance?.classification]
  || tlpRank[marking?.tlp] > tlpRank[clearance?.tlp];

export function validateAlertContextPacket({
  contractsRoot = join(DEFAULT_ROOT, 'contracts'),
  dependencyRoot = HERE,
} = {}) {
  const errors = [];
  const counts = {};
  const fail = (message) => errors.push(message);
  const bump = (key) => { counts[key] = (counts[key] || 0) + 1; };
  const load = (relativePath) => {
    const path = join(contractsRoot, relativePath);
    if (!existsSync(path)) {
      fail(`missing packet file: contracts/${relativePath}`);
      return null;
    }
    try {
      return readJson(path);
    } catch (error) {
      fail(`contracts/${relativePath}: JSON parse error: ${error.message}`);
      return null;
    }
  };

  const schema = load(SCHEMA_FILE);
  const examplesManifest = load(EXAMPLES_MANIFEST_FILE);
  const compatibility = load(COMPATIBILITY_FILE);
  const lifecycleDocuments = [
    [SCHEMA_FILE, schema],
    [EXAMPLES_MANIFEST_FILE, examplesManifest],
    [COMPATIBILITY_FILE, compatibility],
  ];
  for (const [label, document] of lifecycleDocuments) {
    if (!document) continue;
    if (document['x-cybrik-status'] !== EXPECTED_STATUS) {
      fail(`${label}: x-cybrik-status must stay '${EXPECTED_STATUS}'`);
    }
    if (document['x-cybrik-not-accepted'] !== EXPECTED_NOT_ACCEPTED) {
      fail(`${label}: x-cybrik-not-accepted must stay false`);
    }
    if (document['x-cybrik-contract-version'] !== EXPECTED_VERSION) {
      fail(`${label}: x-cybrik-contract-version must be ${EXPECTED_VERSION}`);
    }
    if (SUPERSEDED_LIFECYCLE_TEXT.test(JSON.stringify(document))) {
      fail(
        `${label}: superseded PROPOSED lifecycle text must not survive the `
        + 'acceptance flip',
      );
    }
  }
  // A half-flip leaves the three lifecycle documents disagreeing even when each
  // one is internally well formed, so compare them against each other too.
  const lifecycleSignatures = new Set(
    lifecycleDocuments
      .filter(([, document]) => document)
      .map(([, document]) =>
        `${document['x-cybrik-status']}/not_accepted=${document['x-cybrik-not-accepted']}`),
  );
  if (lifecycleSignatures.size > 1) {
    fail(
      'lifecycle half-flip: schema, examples manifest and compatibility manifest '
      + `must carry one identical lifecycle pair, got ${[...lifecycleSignatures].join(' vs ')}`,
    );
  }

  if (schema) {
    exactKeys('schema top level', schema, SCHEMA_TOP_LEVEL_KEYS, fail);
    exactKeys('schema $defs', schema.$defs, SCHEMA_DEFS, fail);
    exactKeys('schema request properties', schema.$defs?.request?.properties, REQUEST_PROPERTIES, fail);
    exactKeys('schema result properties', schema.$defs?.result?.properties, RESULT_PROPERTIES, fail);
    exactKeys(
      'schema capabilityPin properties',
      schema.$defs?.capabilityPin?.properties,
      CAPABILITY_PROPERTIES,
      fail,
    );
    exactKeys(
      'schema orgScope properties',
      schema.$defs?.orgScope?.properties,
      ORG_SCOPE_PROPERTIES,
      fail,
    );
    exactKeys(
      'schema safeInternalObjectRef properties',
      schema.$defs?.safeInternalObjectRef?.properties,
      SAFE_INTERNAL_REF_PROPERTIES,
      fail,
    );
    exactKeys(
      'schema alertContext properties',
      schema.$defs?.alertContext?.properties,
      ALERT_CONTEXT_PROPERTIES,
      fail,
    );
    exactKeys(
      'schema unavailableFailure properties',
      schema.$defs?.unavailableFailure?.properties,
      ['code', 'retryable'],
      fail,
    );
    exactKeys(
      'schema idempotencyConflictFailure properties',
      schema.$defs?.idempotencyConflictFailure?.properties,
      ['code', 'retryable'],
      fail,
    );
    exactKeys(
      'schema authorizationBinding properties',
      schema.$defs?.authorizationBinding?.properties,
      AUTHORIZATION_BINDING_PROPERTIES,
      fail,
    );
    if (!setEqual(new Set(schema.$defs?.request?.required || []), new Set(REQUEST_REQUIRED))) {
      fail('schema request required set must match the independent exact allowlist');
    }
    if (!setEqual(new Set(schema.$defs?.result?.required || []), new Set(RESULT_REQUIRED))) {
      fail('schema result required set must match the independent exact allowlist');
    }
    const nestedRequiredSets = [
      ['capabilityPin', CAPABILITY_PROPERTIES],
      ['orgScope', ORG_SCOPE_PROPERTIES],
      ['safeInternalObjectRef', SAFE_INTERNAL_REF_REQUIRED],
      ['alertContext', ALERT_CONTEXT_PROPERTIES],
      ['unavailableFailure', ['code', 'retryable']],
      ['idempotencyConflictFailure', ['code', 'retryable']],
      ['authorizationBinding', AUTHORIZATION_BINDING_PROPERTIES],
    ];
    for (const [definition, expected] of nestedRequiredSets) {
      if (!setEqual(
        new Set(schema.$defs?.[definition]?.required || []),
        new Set(expected),
      )) {
        fail(`schema ${definition} required set must match the independent exact allowlist`);
      }
    }
    for (const definition of [
      'capabilityPin',
      'orgScope',
      'safeInternalObjectRef',
      'alertContext',
      'authorizationBinding',
      'request',
      'result',
    ]) {
      if (schema.$defs?.[definition]?.additionalProperties !== false) {
        fail(`schema $defs.${definition}: additionalProperties must be false`);
      }
    }
    if ('locator' in (schema.$defs?.safeInternalObjectRef?.properties || {})) {
      fail('schema safeInternalObjectRef must forbid locator by omitting it from closed properties');
    }
    for (const field of ['event_refs', 'entity_refs', 'case_refs']) {
      if (schema.$defs?.alertContext?.properties?.[field]?.items?.$ref
          !== '#/$defs/safeInternalObjectRef') {
        fail(`schema alertContext.${field} must use safeInternalObjectRef`);
      }
    }
    if (schema.$defs?.alertRef?.allOf?.[0]?.$ref !== '#/$defs/safeInternalObjectRef') {
      fail('schema alertRef must use safeInternalObjectRef');
    }
    exactKeys('schema alertRef', schema.$defs?.alertRef, ['allOf'], fail);
    if (schema.$defs?.alertRef?.allOf?.length !== 2) {
      fail('schema alertRef allOf must contain exactly safe ref plus alert-type restriction');
    }
    exactKeys(
      'schema alertRef type restriction',
      schema.$defs?.alertRef?.allOf?.[1],
      ['properties'],
      fail,
    );
    exactKeys(
      'schema alertRef restricted properties',
      schema.$defs?.alertRef?.allOf?.[1]?.properties,
      ['type'],
      fail,
    );
    const capability = schema.$defs?.capabilityPin?.properties || {};
    if (capability.name?.const !== 'soc.get_alert_context'
        || capability.version?.const !== EXPECTED_VERSION
        || capability.risk_class?.const !== 'R0'
        || capability.side_effects?.const !== false) {
      fail('schema capability pin must be exact soc.get_alert_context@0.1.0 R0 side_effects=false');
    }
    if (schema.$defs?.unavailableFailure?.properties?.code?.const
        !== 'alert_context_unavailable') {
      fail('schema unavailable response must expose only alert_context_unavailable');
    }
    if (schema.$defs?.idempotencyConflictFailure?.properties?.code?.const
        !== 'idempotency_binding_conflict') {
      fail('schema idempotency conflict must expose only idempotency_binding_conflict');
    }
  }

  let ajv;
  let validate;
  if (schema) {
    try {
      const require = createRequire(join(resolve(dependencyRoot), 'package.json'));
      const AjvModule = require('ajv/dist/2020.js');
      const addFormatsModule = require('ajv-formats');
      const Ajv2020 = AjvModule.default || AjvModule;
      const addFormats = addFormatsModule.default || addFormatsModule;
      ajv = new Ajv2020({
        strict: true,
        strictTypes: false,
        strictRequired: false,
        allErrors: true,
      });
      addFormats(ajv);
      for (const keyword of [
        'x-cybrik-status',
        'x-cybrik-not-accepted',
        'x-cybrik-contract-version',
        'x-cybrik-format-pins',
      ]) ajv.addKeyword({ keyword });
      for (const dependency of [
        'json-schema/cybrik.common-defs.v1.schema.json',
        'json-schema/cybrik.data-marking.v1.schema.json',
      ]) {
        const document = load(dependency);
        if (document) ajv.addSchema(document);
      }
      ajv.addSchema(schema);
      validate = ajv.getSchema(schema.$id) || ajv.compile(schema);
      bump('schemas_compiled');
    } catch (error) {
      fail(`schema compilation failed: ${error.message}`);
    }
  }

  const expectedExampleMap = new Map(EXPECTED_EXAMPLES);
  const fixtures = {};
  if (examplesManifest) {
    exactKeys(
      'examples manifest',
      examplesManifest,
      [
        'x-cybrik-status',
        'x-cybrik-not-accepted',
        'x-cybrik-contract-version',
        'description',
        'examples',
      ],
      fail,
    );
    const seen = new Set();
    for (const example of examplesManifest.examples || []) {
      const allowedKeys = example.kind === 'positive'
        ? ['file', 'kind']
        : ['file', 'kind', 'invariant'];
      exactKeys(`example row ${example.file || '<missing>'}`, example, allowedKeys, fail);
      if (seen.has(example.file)) fail(`duplicate example manifest entry: ${example.file}`);
      seen.add(example.file);
      if (expectedExampleMap.get(example.file) !== example.kind) {
        fail(`example manifest row is outside exact filename/kind allowlist: ${example.file}`);
      }
      const relativePath = `examples/alert-context/${example.file}`;
      const fixture = load(relativePath);
      fixtures[example.file] = fixture;
      if (!fixture || !validate) continue;
      const valid = validate(fixture);
      if (example.kind === 'positive') {
        bump('positive_total');
        if (valid) bump('positive_pass');
        else {
          fail(
            `${relativePath}: positive fixture failed schema validation: `
            + ajv.errorsText(validate.errors),
          );
        }
      } else if (example.kind === 'negative-schema') {
        bump('negative_schema_total');
        if (!valid) bump('negative_schema_reject');
        else fail(`${relativePath}: negative-schema fixture unexpectedly validated`);
      } else if (example.kind === 'negative-semantic') {
        bump('negative_semantic_total');
        if (valid) bump('negative_semantic_structurally_valid');
        else {
          fail(
            `${relativePath}: negative-semantic fixture must remain structurally valid: `
            + ajv.errorsText(validate.errors),
          );
        }
      }
    }
    if (!setEqual(seen, new Set(expectedExampleMap.keys()))) {
      fail('examples manifest must exactly cover the independent expected filename allowlist');
    }
    if (compatibility) {
      checkTrustInvariantTraceability(examplesManifest, compatibility, fail);
    }
  }

  const inventoryRoot = join(contractsRoot, 'examples/alert-context');
  const inventory = new Set(listFiles(inventoryRoot, 'examples/alert-context/'));
  if (!setEqual(inventory, new Set(EXPECTED_EXAMPLE_FILES))) {
    const orphan = [...inventory].filter((file) => !EXPECTED_EXAMPLE_FILES.includes(file));
    const missing = EXPECTED_EXAMPLE_FILES.filter((file) => !inventory.has(file));
    fail(
      `examples filesystem inventory differs from independent allowlist; `
      + `orphan=${orphan.join(',') || 'none'} missing=${missing.join(',') || 'none'}`,
    );
  }

  const positiveRequest = fixtures['positive/request.json'];
  const positiveAvailable = fixtures['positive/result.available.json'];
  const positiveUnavailable = fixtures['positive/result.unavailable.json'];
  // Fail-closed stale-binding guard. Every fixture that carries an authorization
  // binding — positive, structurally rejected or semantic witness alike — must
  // pin the current schema bytes and stay self-consistent under the declared
  // RFC 8785 projections. A schema or lifecycle flip therefore cannot leave a
  // superseded binding behind in any fixture class.
  if (schema) {
    const liveSchemaDigest = `sha256:${sha256File(join(contractsRoot, SCHEMA_FILE))}`;
    for (const [file] of EXPECTED_EXAMPLES) {
      const fixture = fixtures[file];
      const binding = fixture?.authorization_binding;
      if (!binding) continue;
      let bindingOk = true;
      if (binding.schema_digest !== liveSchemaDigest) {
        fail(`${file}: authorization binding schema_digest must pin exact schema bytes`);
        bindingOk = false;
      }
      if (fixture.message_type === 'request'
          && binding.input_digest !== jcsDigest(projectionRequestInput(fixture))) {
        fail(
          `${file}: authorization binding input_digest must match its own RFC 8785 `
          + 'request-input projection',
        );
        bindingOk = false;
      }
      if (binding.binding_digest !== jcsDigest(projectionAuthorizationBinding(binding))) {
        fail(
          `${file}: authorization binding binding_digest must match the RFC 8785 `
          + 'authorization-binding projection',
        );
        bindingOk = false;
      }
      if (bindingOk) bump('fixture_bindings_verified');
    }
  }

  if (positiveRequest && schema) {
    const binding = positiveRequest.authorization_binding;
    const bindingChecks = [
      ['tenant', binding?.tenant_id, positiveRequest.tenant_id],
      ['org scope', binding?.org_scope, positiveRequest.org_scope],
      ['actor', binding?.actor, positiveRequest.actor],
      ['capability', binding?.capability, positiveRequest.capability],
      ['policy digest', binding?.policy_digest, positiveRequest.policy_digest],
    ];
    for (const [label, actual, expected] of bindingChecks) {
      if (!same(actual, expected)) {
        fail(`positive request authorization binding must preserve full ${label}`);
      }
    }
    if (positiveRequest.actor?.tenant_id !== positiveRequest.tenant_id) {
      fail('positive request actor tenant must equal authoritative tenant');
    }
    if (binding?.actor?.tenant_id !== binding?.tenant_id) {
      fail('positive request binding actor tenant must equal binding authoritative tenant');
    }
  }

  const checkCorrelatedResult = (label, result) => {
    if (!positiveRequest || !result) return;
    const checks = [
      ['request_id', result.request_id, positiveRequest.request_id],
      ['idempotency key', result.idempotency_key, positiveRequest.idempotency_key],
      ['tenant', result.tenant_id, positiveRequest.tenant_id],
      ['org scope', result.org_scope, positiveRequest.org_scope],
      ['full actor identity', result.authorized_actor, positiveRequest.actor],
      ['clearance', result.clearance, positiveRequest.clearance],
      ['capability pin', result.capability, positiveRequest.capability],
      ['policy digest', result.policy_digest, positiveRequest.policy_digest],
      [
        'authorization binding',
        result.authorization_binding,
        positiveRequest.authorization_binding,
      ],
    ];
    for (const [field, actual, expected] of checks) {
      if (!same(actual, expected)) fail(`${label} must preserve ${field}`);
    }
    if (result.authorized_actor?.tenant_id !== result.tenant_id) {
      fail(`${label} authorized actor tenant must equal result authoritative tenant`);
    }
    if (result.authorization_binding?.actor?.tenant_id
        !== result.authorization_binding?.tenant_id) {
      fail(`${label} binding actor tenant must equal binding authoritative tenant`);
    }
    if (result.authorization_binding?.tenant_id !== result.tenant_id) {
      fail(`${label} authorization binding tenant must equal result authoritative tenant`);
    }
    if (result.outcome === 'available') {
      if (!same(fullAlertRef(result.alert_ref), fullAlertRef(positiveRequest.alert_ref))) {
        fail(`${label} must preserve full alert ref type/id/version/digest`);
      }
      if (result.context?.alert_id !== positiveRequest.alert_ref?.id
          || result.context?.alert_digest !== positiveRequest.alert_ref?.digest) {
        fail(`${label} context alert_id/alert_digest must match request alert ref`);
      }
      const expectedContextDigest = jcsDigest(projectionAvailableResult(result));
      if (result.context_digest !== expectedContextDigest) {
        fail(`${label} context_digest must match RFC 8785 available-result projection`);
      }
    }
  };
  checkCorrelatedResult('positive available result', positiveAvailable);
  checkCorrelatedResult('positive unavailable/conflict result', positiveUnavailable);

  const semanticCrossTenant =
    fixtures['negative-semantic/request.cross-tenant-actor.json'];
  if (semanticCrossTenant
      && same(semanticCrossTenant.actor, semanticCrossTenant.authorization_binding?.actor)) {
    fail('cross-tenant semantic fixture must differ from authorization binding actor');
  }
  const semanticCrossOrg = fixtures['negative-semantic/result.cross-org.json'];
  if (semanticCrossOrg && positiveRequest
      && same(semanticCrossOrg.org_scope, positiveRequest.org_scope)) {
    fail('cross-org semantic fixture must differ in full org scope including include_descendants');
  }
  const semanticClearance =
    fixtures['negative-semantic/result.clearance-exceeded.json'];
  if (semanticClearance && positiveRequest
      && !exceeds(semanticClearance.data_marking, positiveRequest.clearance)) {
    fail('clearance-exceeded semantic fixture must exceed request clearance');
  }
  const semanticDigest = fixtures['negative-semantic/result.digest-mismatch.json'];
  if (semanticDigest && positiveRequest) {
    const refMatches = same(
      fullAlertRef(semanticDigest.alert_ref),
      fullAlertRef(positiveRequest.alert_ref),
    );
    const contextMatches =
      semanticDigest.context?.alert_id === positiveRequest.alert_ref?.id
      && semanticDigest.context?.alert_digest === positiveRequest.alert_ref?.digest;
    if (refMatches && contextMatches) {
      fail('digest-mismatch semantic fixture must differ in full alert ref or context identity');
    }
  }
  for (const [file, kind] of EXPECTED_EXAMPLES) {
    if (kind !== 'negative-semantic') continue;
    const result = fixtures[file];
    if (result?.outcome === 'available') {
      const expected = jcsDigest(projectionAvailableResult(result));
      if (result.context_digest !== expected) {
        fail(`${file}: semantic witness context_digest must remain valid for its own bytes`);
      }
    }
  }

  if (compatibility) {
    exactKeys('compatibility manifest', compatibility, COMPATIBILITY_KEYS, fail);
    exactKeys('format_pins', compatibility.format_pins, ['jsonSchema'], fail);
    exactKeys(
      'capability_scope',
      compatibility.capability_scope,
      [
        'name',
        'risk_class',
        'side_effects',
        'owner_of_truth',
        'contract_owner',
        'execution_authority_owner',
        'implementation_status',
      ],
      fail,
    );
    exactKeys(
      'authority_boundaries',
      compatibility.authority_boundaries,
      ['fabric', 'w2f', 'soc', 'ai'],
      fail,
    );
    exactKeys(
      'data_and_privacy_boundary',
      compatibility.data_and_privacy_boundary,
      ['digest_binding', 'clearance', 'no_existence_leak', 'org_scope', 'safe_internal_refs'],
      fail,
    );
    exactKeys(
      'canonicalization',
      compatibility.canonicalization,
      [
        'standard',
        'owner',
        'request_input_projection',
        'authorization_binding_projection',
        'available_result_projection',
      ],
      fail,
    );
    exactKeys(
      'idempotency_semantics',
      compatibility.idempotency_semantics,
      ['order', 'cache_partition', 'replay', 'conflict', 'unavailable_derivation'],
      fail,
    );
    exactKeys(
      'compatibility',
      compatibility.compatibility,
      [
        'additive',
        'modifies_existing_packet_bytes',
        'modifies_existing_ids',
        'stable_v1_or_ga',
        'obligations_on_existing_accepted_members',
        'reuses_accepted_unmodified',
      ],
      fail,
    );
    exactKeys(
      'trust_invariants',
      compatibility.trust_invariants,
      ['structural', 'runtime_only_fixture_exercised', 'runtime_only_declared'],
      fail,
    );
    exactKeys(
      'provenance',
      compatibility.provenance,
      [
        'repository',
        'base_commit',
        'worktree',
        'source_decision',
        'generated_on',
        'validator',
        'network_required',
      ],
      fail,
    );
    exactKeys(
      'proof_limits',
      compatibility.proof_limits,
      [
        'static_packet_integrity_proven',
        'runtime_authorization_proven',
        'no_existence_leak_runtime_proven',
        'endpoint_or_transport_implemented',
        'accepted_for_implementation',
        'release_ready',
      ],
      fail,
    );
    exactKeys(
      'acceptance',
      compatibility.acceptance,
      [
        'status',
        'accepted_on',
        'decision_record',
        'scope_of_acceptance',
        'settled_checklist',
        'open_runtime_obligations',
      ],
      fail,
    );
    exactKeys(
      'member_set_integrity',
      compatibility.member_set_integrity,
      MEMBER_SET_INTEGRITY_KEYS,
      fail,
    );
    exactKeys('verification', compatibility.verification, VERIFICATION_KEYS, fail);
    exactKeys(
      'verification.test_case_counts',
      compatibility.verification?.test_case_counts,
      TEST_CASE_COUNT_KEYS,
      fail,
    );
    const verification = compatibility.verification || {};
    for (const [field, expected] of Object.entries(EXPECTED_VERIFICATION_TEXT)) {
      if (verification[field] !== expected) {
        fail(`verification.${field} must match the independent exact declaration`);
      }
    }
    if (!same(verification.test_case_counts, EXPECTED_TEST_CASE_COUNTS)) {
      fail(
        'verification.test_case_counts must match the independent exact counts '
        + `(${EXPECTED_TEST_CASE_COUNTS.adversarial_rejection_cases} adversarial `
        + `rejections plus ${EXPECTED_TEST_CASE_COUNTS.positive_cases} positive checks)`,
      );
    }
    if (compatibility['x-cybrik-packet-version'] !== EXPECTED_VERSION
        || compatibility['x-cybrik-is-bundle-tag'] !== false) {
      fail('compatibility manifest must stay mutable pre-GA packet v0.1.0');
    }
    const acceptance = compatibility.acceptance || {};
    if (acceptance.status !== compatibility['x-cybrik-status']) {
      fail(
        'lifecycle half-flip: acceptance.status must equal the declared x-cybrik-status, '
        + `got '${acceptance.status}' vs '${compatibility['x-cybrik-status']}'`,
      );
    }
    if (acceptance.status !== EXPECTED_STATUS) {
      fail(`compatibility manifest acceptance.status must be ${EXPECTED_STATUS}`);
    }
    if (acceptance.accepted_on !== EXPECTED_ACCEPTED_ON) {
      fail(`acceptance.accepted_on must be ${EXPECTED_ACCEPTED_ON}`);
    }
    if (!same(acceptance.open_runtime_obligations, EXPECTED_OPEN_RUNTIME_OBLIGATIONS)) {
      fail(
        'acceptance.open_runtime_obligations must be exactly '
        + EXPECTED_OPEN_RUNTIME_OBLIGATIONS.join(', '),
      );
    }
    if (compatibility.capability_scope?.implementation_status !== 'NOT IMPLEMENTED') {
      fail('capability implementation_status must stay NOT IMPLEMENTED');
    }
    const proof = compatibility.proof_limits || {};
    for (const field of [
      'runtime_authorization_proven',
      'no_existence_leak_runtime_proven',
      'endpoint_or_transport_implemented',
      'release_ready',
    ]) {
      if (proof[field] !== false) fail(`proof_limits.${field} must stay false`);
    }
    if (proof.static_packet_integrity_proven !== true) {
      fail('proof_limits.static_packet_integrity_proven must be true');
    }
    if (proof.accepted_for_implementation !== true) {
      fail(
        'proof_limits.accepted_for_implementation must be true once the lifecycle is '
        + 'accepted',
      );
    }
    if (proof.accepted_for_implementation !== (compatibility['x-cybrik-not-accepted'] === false)) {
      fail(
        'lifecycle half-flip: proof_limits.accepted_for_implementation must agree with '
        + 'x-cybrik-not-accepted',
      );
    }
    // Acceptance closes no runtime obligation: TR-7/TR-8/TR-9 must stay declared
    // only, and none of them may be promoted into the fixture-exercised set.
    const runtimeLabel = (text) =>
      (typeof text === 'string' ? /^(TR-\d+)\s/.exec(text)?.[1] : undefined);
    const declaredOpen = (compatibility.trust_invariants?.runtime_only_declared || [])
      .map(runtimeLabel);
    const fixtureExercised = (compatibility.trust_invariants?.runtime_only_fixture_exercised || [])
      .map(runtimeLabel);
    if (!same([...declaredOpen].sort(), [...EXPECTED_OPEN_RUNTIME_OBLIGATIONS].sort())) {
      fail(
        'trust_invariants.runtime_only_declared must declare exactly '
        + EXPECTED_OPEN_RUNTIME_OBLIGATIONS.join(', '),
      );
    }
    for (const label of EXPECTED_OPEN_RUNTIME_OBLIGATIONS) {
      if (fixtureExercised.includes(label)) {
        fail(
          `${label} must stay an open runtime obligation and must not be listed as `
          + 'fixture-exercised',
        );
      }
    }
    if (!same([...fixtureExercised].sort(), [...EXPECTED_FIXTURE_EXERCISED_INVARIANTS].sort())) {
      fail(
        'trust_invariants.runtime_only_fixture_exercised must declare exactly '
        + EXPECTED_FIXTURE_EXERCISED_INVARIANTS.join(', '),
      );
    }
    const authority = JSON.stringify(compatibility.authority_boundaries || {});
    for (const phrase of [
      'Fabric tool-grant authority',
      'W2-F inference delegation',
      'cannot authorize',
    ]) {
      if (!authority.includes(phrase)) {
        fail(`compatibility authority boundary must include '${phrase}'`);
      }
    }
    const idempotency = JSON.stringify(compatibility.idempotency_semantics || {});
    for (const phrase of [
      'Authorization-before-cache',
      'tenant-partitioned',
      'exact same binding digest',
      'rejects before target lookup',
      'never derive from target existence',
    ]) {
      if (!idempotency.includes(phrase)) {
        fail(`idempotency semantics must include '${phrase}'`);
      }
    }
    const canonicalization = compatibility.canonicalization || {};
    if (!canonicalization.standard?.includes('RFC 8785')
        || !canonicalization.owner?.startsWith('The authenticated SOC')) {
      fail('canonicalization must pin RFC 8785/JCS and SOC as producer/owner');
    }
    const projectionChecks = [
      [
        'request_input_projection',
        canonicalization.request_input_projection,
        REQUEST_INPUT_PROJECTION_TEXT,
      ],
      [
        'authorization_binding_projection',
        canonicalization.authorization_binding_projection,
        AUTHORIZATION_BINDING_PROJECTION_TEXT,
      ],
      [
        'available_result_projection',
        canonicalization.available_result_projection,
        AVAILABLE_RESULT_PROJECTION_TEXT,
      ],
    ];
    for (const [label, actual, expected] of projectionChecks) {
      if (!same(actual, expected)) {
        fail(`canonicalization.${label} must match the independent exact projection`);
      }
    }
    const manifestText = JSON.stringify(compatibility);
    for (const forbiddenClaim of [
      /runtime verified/i,
      /runtime authorization proven/i,
      /release ready/i,
      /source[ -]marking[ -]floor/i,
    ]) {
      if (forbiddenClaim.test(manifestText)) {
        fail(`compatibility manifest contains forbidden claim ${forbiddenClaim}`);
      }
    }
    if (!manifestText.includes(EXPECTED_STATUS)) {
      fail(`compatibility manifest must carry the declared '${EXPECTED_STATUS}' lifecycle value`);
    }

    const seenMembers = new Set();
    for (const member of compatibility.members || []) {
      exactKeys(
        `compatibility member ${member.file || '<missing>'}`,
        member,
        ['file', 'kind', 'contract_version', 'sha256'],
        fail,
      );
      if (seenMembers.has(member.file)) {
        fail(`duplicate compatibility member: ${member.file}`);
      }
      seenMembers.add(member.file);
      if (MEMBER_KIND[member.file] !== member.kind
          || member.contract_version !== EXPECTED_VERSION) {
        fail(`compatibility member outside exact file/kind/version allowlist: ${member.file}`);
      }
      const path = join(contractsRoot, member.file);
      if (!existsSync(path)) {
        fail(`compatibility member missing: ${member.file}`);
      } else {
        const actualDigest = sha256File(path);
        if (member.sha256 !== actualDigest) {
          fail(`compatibility member ${member.file} sha256 must be ${actualDigest}`);
        } else {
          bump('manifest_member_hashes_verified');
        }
      }
    }
    if (!setEqual(seenMembers, new Set(EXPECTED_MEMBER_FILES))) {
      fail('compatibility members must exactly cover the independent expected allowlist');
    }
    if ((counts.manifest_member_hashes_verified || 0) !== EXPECTED_MEMBER_COUNT) {
      fail(
        `exactly ${EXPECTED_MEMBER_COUNT} member hashes must verify, got `
        + `${counts.manifest_member_hashes_verified || 0}`,
      );
    }

    const integrity = compatibility.member_set_integrity || {};
    if (integrity.algorithm !== MEMBER_SET_ALGORITHM) {
      fail(
        'member_set_integrity.algorithm must match the independent non-circular '
        + 'MEMBER-SET-SHA256/v1 declaration',
      );
    }
    if ((compatibility.members || []).length !== EXPECTED_MEMBER_COUNT) {
      fail(`compatibility members must contain exactly ${EXPECTED_MEMBER_COUNT} entries`);
    }
    if (integrity.member_count !== EXPECTED_MEMBER_COUNT) {
      fail(`member_set_integrity.member_count must be ${EXPECTED_MEMBER_COUNT}`);
    }
    const expectedMemberSetDigest = memberSetDigest(compatibility.members);
    if (integrity.member_set_digest !== expectedMemberSetDigest) {
      fail(`member_set_integrity.member_set_digest must be ${expectedMemberSetDigest}`);
    } else {
      bump('member_set_digest_verified');
    }
  }

  // Derived from the real bytes, never asserted: a half-flip prints a lifecycle
  // pair that differs from the accepted one.
  const status = compatibility
    ? `${String(compatibility['x-cybrik-status'] ?? 'MISSING').replace(/\s+/g, '_')}`
      + `_NOT_ACCEPTED_FLAG=${compatibility['x-cybrik-not-accepted']}`
    : 'MISSING_COMPATIBILITY_MANIFEST';
  return {
    ok: errors.length === 0,
    errors,
    counts,
    status,
    acceptedOn: compatibility?.acceptance?.accepted_on,
    implementationStatus: compatibility?.capability_scope?.implementation_status,
    runtimeAuthorizationProven:
      compatibility?.proof_limits?.runtime_authorization_proven,
    noExistenceLeakRuntimeProven:
      compatibility?.proof_limits?.no_existence_leak_runtime_proven,
  };
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = validateAlertContextPacket({
    dependencyRoot: process.env.CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT || HERE,
  });
  if (!result.ok) {
    console.error(
      `ALERT-CONTEXT CONTRACT VALIDATION: FAIL (${result.errors.length} error(s))`,
    );
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('ALERT-CONTEXT CONTRACT VALIDATION: PASS');
    console.log(JSON.stringify(result.counts, null, 2));
  }
  console.log(`STATUS=${result.status}`);
  console.log(`ACCEPTED_ON=${result.acceptedOn}`);
  console.log(`IMPLEMENTATION_STATUS=${result.implementationStatus}`);
  console.log(`RUNTIME_AUTHORIZATION_PROVEN=${result.runtimeAuthorizationProven}`);
  console.log(
    `NO_EXISTENCE_LEAK_RUNTIME_PROVEN=${result.noExistenceLeakRuntimeProven}`,
  );
}
