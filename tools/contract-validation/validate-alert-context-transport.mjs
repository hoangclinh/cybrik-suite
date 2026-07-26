// Standalone static validator for the W1 `soc.get_alert_context` invocation
// transport-binding packet, ACCEPTED FOR IMPLEMENTATION on 2026-07-27 and
// NOT IMPLEMENTED.
//
// Exit 0 proves binding-packet, schema, fixture, correlation, reuse-pin,
// member-hash and member-set integrity plus lifecycle coherence only.
// Acceptance is a recorded contract decision, not evidence: exit 0 implements no
// endpoint, adds no OpenAPI/AsyncAPI/MCP surface, registers no capability,
// authorizes no Fabric invocation, deploys nothing, wires no CI, tags no Bundle
// and proves no runtime authorization, policy completion or kill-switch
// behavior. TR-4…TR-8 stay open runtime obligations and the validator fails
// closed if the packet tries to close them, half-flip the lifecycle, keep stale
// proposal language, claim supersession over the accepted C1 packet, or drift
// from the accepted W2-B envelope and C1 bytes it reuses unchanged.
//
// The bound-receipt profile is enforced here as library rules (`checkBoundReceipt`
// plus the `boundReceipt` schema branch) and is exercised by the standalone test
// suite against synthesized receipt documents, because the packet deliberately
// ships no receipt fixture.
//
// Declared standalone commands, run from the repository root against an existing
// dependency install (nothing is installed and no network is used):
//
//   node tools/contract-validation/validate-alert-context-transport.mjs
//   node --test tools/contract-validation/tests/validate-alert-context-transport.test.mjs
//   node --test --experimental-test-coverage \
//     tools/contract-validation/tests/validate-alert-context-transport.test.mjs
//
// Set CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT to a directory whose node_modules
// already provides ajv 8.20.0 and ajv-formats 3.0.1 when this worktree has no
// local install. The compatibility manifest declares these same commands and the
// validator fails closed if the declaration drifts. Canonical CI wiring is
// deliberately out of scope here and belongs to a later integration gate.

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');

const SCHEMA_FILE = 'json-schema/cybrik.soc-alert-context-invocation-binding.v1.schema.json';
const EXAMPLES_MANIFEST_FILE = 'examples/alert-context-transport/examples-manifest.json';
const COMPATIBILITY_FILE =
  'compatibility/cybrik-suite-alert-context-transport-binding.v1.manifest.json';
const EXAMPLES_DIR = 'examples/alert-context-transport';

// Accepted contracts reused byte-unchanged. None of them may be edited by this
// packet and every one is pinned by digest in the compatibility manifest.
const SOURCE_MANIFEST_FILE = 'compatibility/cybrik-suite-alert-context-packet.v1.manifest.json';
const SOURCE_SCHEMA_FILE = 'json-schema/cybrik.soc-get-alert-context.v1.schema.json';
const SOURCE_REQUEST_FILE = 'examples/alert-context/positive/request.json';
const SOURCE_AVAILABLE_FILE = 'examples/alert-context/positive/result.available.json';
const SOURCE_UNAVAILABLE_FILE = 'examples/alert-context/positive/result.unavailable.json';
const W2F_TOKEN_FILE = 'examples/svc/positive/svc-delegation-token.json';
const ENVELOPE_REQUEST_FILE = 'json-schema/cybrik.tool-execution-request.v1.schema.json';
const ENVELOPE_RESULT_FILE = 'json-schema/cybrik.tool-execution-result.v1.schema.json';
const ENVELOPE_RECEIPT_FILE = 'json-schema/cybrik.execution-receipt.v1.schema.json';
const ENVELOPE_OPENAPI_FILE = 'openapi/cybrik-fabric-control-plane.v1.openapi.yaml';
const COMMON_DEFS_FILE = 'json-schema/cybrik.common-defs.v1.schema.json';
const DATA_MARKING_FILE = 'json-schema/cybrik.data-marking.v1.schema.json';

const DEPENDENCY_SCHEMA_FILES = Object.freeze([
  COMMON_DEFS_FILE,
  DATA_MARKING_FILE,
  ENVELOPE_REQUEST_FILE,
  ENVELOPE_RESULT_FILE,
  ENVELOPE_RECEIPT_FILE,
  SOURCE_SCHEMA_FILE,
]);

// Every reused accepted artifact whose bytes this packet pins. The OpenAPI file
// is pinned to evidence that no new transport surface is proposed: the accepted
// createInvocation/getReceipt operations are reused exactly as they stand.
const REUSED_UNMODIFIED_FILES = Object.freeze([
  COMMON_DEFS_FILE,
  DATA_MARKING_FILE,
  ENVELOPE_REQUEST_FILE,
  ENVELOPE_RESULT_FILE,
  ENVELOPE_RECEIPT_FILE,
  SOURCE_SCHEMA_FILE,
  ENVELOPE_OPENAPI_FILE,
  W2F_TOKEN_FILE,
]);

// Two-state lifecycle table. Exactly one state is expected at a time and every
// lifecycle rule is read from it, so the packet can only ever be coherently in
// one state: a document left behind in the other state is a half-flip, and text
// asserting the other state is stale lifecycle language. Both are fail-closed
// rejections rather than warnings.
//
//   PROPOSED  — the packet is a proposal; the accepted-lifecycle token may not
//               appear anywhere in a lifecycle document and no acceptance record
//               may exist.
//   ACCEPTED  — the lifecycle decision is recorded; no proposal lifecycle
//               assertion may survive and the acceptance record is mandatory.
const LIFECYCLE = Object.freeze({
  PROPOSED: Object.freeze({
    status: 'PROPOSED — NOT ACCEPTED',
    notAccepted: true,
    acceptedForImplementation: false,
    requiresAcceptanceRecord: false,
    // Stale/premature lifecycle assertions for this state, as [pattern, reason].
    staleLifecycleText: Object.freeze([
      Object.freeze([
        /ACCEPTED FOR IMPLEMENTATION/,
        'premature acceptance text must not appear in a proposal-only packet',
      ]),
    ]),
  }),
  ACCEPTED: Object.freeze({
    status: 'ACCEPTED FOR IMPLEMENTATION',
    notAccepted: false,
    acceptedForImplementation: true,
    requiresAcceptanceRecord: true,
    staleLifecycleText: Object.freeze([
      Object.freeze([
        /\bPROPOSED\b/,
        "stale proposal lifecycle text 'PROPOSED' must not survive the acceptance flip",
      ]),
      Object.freeze([
        /\bNOT ACCEPTED\b/,
        "stale proposal lifecycle text 'NOT ACCEPTED' must not survive the acceptance flip",
      ]),
      Object.freeze([
        /proposal-only/i,
        "stale proposal lifecycle text 'proposal-only' must not survive the acceptance flip",
      ]),
      Object.freeze([
        /records no acceptance/i,
        "stale proposal lifecycle text 'records no acceptance' must not survive the "
        + 'acceptance flip',
      ]),
    ]),
  }),
});

// The single lifecycle state this validator enforces. An unknown value leaves
// `LC` null and every lifecycle check below fails closed rather than passing by
// default.
const EXPECTED_STATE = 'ACCEPTED';
const LC = LIFECYCLE[EXPECTED_STATE] || null;

const EXPECTED_VERSION = '0.1.0';
const EXPECTED_ACCEPTED_ON = '2026-07-27';
const EXPECTED_GATE_RECORD = 'docs/releases/GATE-W1-C1-TRANSPORT-BINDING.md';
// This packet builds on the accepted C1 packet and never replaces it, in either
// lifecycle state.
const SUPERSESSION_TEXT = /supersed/i;

const ACCEPTANCE_KEYS = Object.freeze([
  'status',
  'accepted_on',
  'decision_record',
  'scope_of_acceptance',
  'non_claims',
  'settled_checklist',
  'open_runtime_obligations',
]);
// Independent exact allowlist of what this acceptance deliberately does NOT
// accept. Acceptance settles the contract shape and the static evidence; every
// gate below stays closed and needs its own separate decision.
const EXPECTED_NON_CLAIMS = Object.freeze([
  'no runtime implementation or runtime behavior is accepted, verified or demonstrated',
  'no endpoint, path, operation, queue, AsyncAPI channel or MCP transport surface is accepted',
  'no capability-registry entry is accepted or registered',
  'no Fabric tool-execution grant is accepted or minted, and W2-F inference delegation is '
    + 'never Fabric tool authority',
  'no deployment, environment rollout or operational enablement is accepted',
  'no CI wiring or pipeline registration is accepted',
  'no Bundle v0.1.1 membership or bundle tag is accepted',
  'no merge, push, release or release certification is accepted',
]);

const EXPECTED_SOURCE_COMMIT = '3a2c71555a423465855ffaddcb663c8b704dbfbd';
const EXPECTED_SOURCE_MEMBER_COUNT = 13;
const EXPECTED_MEMBER_COUNT = 15;
const KILL_SWITCH_CODE = 'FABRIC_POLICY_KILL_SWITCH_ENGAGED';

const EXPECTED_FIXTURE_EXERCISED_INVARIANTS = Object.freeze(['TR-1', 'TR-2', 'TR-3']);
const EXPECTED_OPEN_RUNTIME_OBLIGATIONS =
  Object.freeze(['TR-4', 'TR-5', 'TR-6', 'TR-7', 'TR-8']);

// The accepted C1 request branch, addressed by its published $id. The
// reconstruction is validated against this branch generically, so the round trip
// is proven against the accepted C1 contract itself and not only against the one
// accepted C1 request fixture the packet compares bytes with.
const C1_BUSINESS_REQUEST_REF = 'https://contracts.cybrik.example/json-schema/'
  + 'cybrik.soc-get-alert-context.v1.schema.json#/$defs/request';

const RESOLVED_ARGUMENTS_SCHEMA =
  'cybrik.soc-alert-context-invocation-binding.resolved-arguments@0.1.0';
const BOUND_OUTPUT_SCHEMA = 'cybrik.soc-alert-context-invocation-binding.bound-output@0.1.0';
const C1_AVAILABLE_RESULT_SCHEMA = 'cybrik.soc-get-alert-context.available-result@0.1.0';

const EXPECTED_EXAMPLES = Object.freeze([
  ['positive/bound-request.json', 'positive'],
  ['positive/bound-result.available.json', 'positive'],
  ['positive/bound-result.unavailable.json', 'positive'],
  ['positive/bound-result.kill-switch-denied.json', 'positive'],
  ['negative-schema/bound-request.authorization-binding-asserted.json', 'negative-schema'],
  ['negative-schema/bound-request.capability-pin-mismatch.json', 'negative-schema'],
  ['negative-schema/bound-result.approval-required.json', 'negative-schema'],
  ['negative-schema/bound-result.output-artifact-locator.json', 'negative-schema'],
  ['negative-schema/bound-result.unavailable-with-output.json', 'negative-schema'],
  ['negative-schema/bound-result.completed-without-receipt.json', 'negative-schema'],
  ['negative-semantic/bound-request.idempotency-key-mismatch.json', 'negative-semantic'],
  ['negative-semantic/bound-request.tenant-mismatch.json', 'negative-semantic'],
  ['negative-semantic/bound-request.w2f-token-as-delegation-ref.json', 'negative-semantic'],
]);

// Independent expectation of which canonical trust invariant each negative
// fixture witnesses. The compatibility manifest owns the label text; the examples
// manifest may only cite a label declared there, so the two documents cannot
// drift into an untraceable mislabel.
const EXPECTED_TRUST_INVARIANTS = Object.freeze({
  'negative-schema/bound-request.authorization-binding-asserted.json': 'TB-3',
  'negative-schema/bound-request.capability-pin-mismatch.json': 'TB-2',
  'negative-schema/bound-result.approval-required.json': 'TB-4',
  'negative-schema/bound-result.output-artifact-locator.json': 'TB-8',
  'negative-schema/bound-result.unavailable-with-output.json': 'TB-6',
  'negative-schema/bound-result.completed-without-receipt.json': 'TB-7',
  'negative-semantic/bound-request.idempotency-key-mismatch.json': 'TR-1',
  'negative-semantic/bound-request.tenant-mismatch.json': 'TR-2',
  'negative-semantic/bound-request.w2f-token-as-delegation-ref.json': 'TR-3',
});

const EXPECTED_EXAMPLE_FILES = Object.freeze([
  EXAMPLES_MANIFEST_FILE,
  ...EXPECTED_EXAMPLES.map(([file]) => `${EXAMPLES_DIR}/${file}`),
]);
const EXPECTED_MEMBER_FILES = Object.freeze([SCHEMA_FILE, ...EXPECTED_EXAMPLE_FILES]);
const MEMBER_KIND = Object.freeze({
  [SCHEMA_FILE]: 'json-schema',
  [EXAMPLES_MANIFEST_FILE]: 'example-manifest',
  ...Object.fromEntries(
    EXPECTED_EXAMPLES.map(([file, kind]) => [`${EXAMPLES_DIR}/${file}`, kind]),
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
  'boundCapabilityPin',
  'callerArguments',
  'boundRequest',
  'boundResult',
  'boundReceipt',
]);
const CALLER_ARGUMENT_PROPERTIES = Object.freeze([
  'request_id',
  'org_scope',
  'clearance',
  'alert_ref',
  'policy_digest',
  'requested_at',
  'traceparent',
]);
const CALLER_ARGUMENT_REQUIRED =
  Object.freeze(CALLER_ARGUMENT_PROPERTIES.filter((key) => key !== 'traceparent'));
const BOUND_CAPABILITY_PROPERTIES = Object.freeze(['name', 'version', 'digest']);
const BOUND_REQUEST_REQUIRED = Object.freeze([
  'action_id',
  'idempotency_key',
  'tenant_id',
  'actor',
  'purpose',
  'delegation_ref',
  'capability',
  'arguments',
  'data_marking',
  'execution',
]);
// Reconstruction bounds. The accepted W2-B envelope declares only a lower bound
// on these two fields, while the accepted C1 business request declares both, so
// this profile narrows the envelope to the C1 bound. Without that narrowing an
// envelope-valid bound request could reconstruct into a C1 business request that
// the accepted C1 contract rejects.
const BOUND_REQUEST_STRING_BOUNDS = Object.freeze({
  idempotency_key: Object.freeze({ minLength: 16, maxLength: 200 }),
  purpose: Object.freeze({ minLength: 1, maxLength: 200 }),
});
const BOUND_RESULT_STATUS_SET = Object.freeze([
  'completed',
  'denied',
  'unavailable',
  'failed',
  'budget_exceeded',
]);
const BOUND_RECEIPT_STATUS_SET = Object.freeze(['completed', 'failed', 'timed_out']);
const BOUND_RECEIPT_REQUIRED = Object.freeze([
  'receipt_id',
  'action_id',
  'tenant_id',
  'status',
  'capability',
  'executor',
  'delegation_ref',
  'resolved_arguments_digest',
  'started_at',
  'finished_at',
  'side_effect',
  'receipt_digest',
  'signature',
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
  'transport_binding',
  'authority_boundaries',
  'completion_semantics',
  'outcome_mapping',
  'canonicalization',
  'idempotency_semantics',
  'receipt_binding',
  'compatibility',
  'source_packet',
  'reused_unmodified',
  'trust_invariants',
  'open_runtime_obligations',
  'members',
  'member_set_integrity',
  'verification',
  'provenance',
  'proof_limits',
  'acceptance',
  'residual_questions',
]);

const RESOLVED_ARGUMENTS_PROJECTION_TEXT = Object.freeze([
  `schema = ${RESOLVED_ARGUMENTS_SCHEMA}`,
  'action_id',
  'idempotency_key',
  'tenant_id = credential-derived',
  'actor = exact type/id/tenant_id/delegated_by? identity',
  'purpose',
  'capability = exact envelope name/version/digest pin',
  'arguments = exact closed caller-argument object',
]);
const BOUND_OUTPUT_PROJECTION_TEXT = Object.freeze([
  `schema = ${BOUND_OUTPUT_SCHEMA}`,
  'action_id',
  'tenant_id',
  'data = exact accepted C1 business result document',
]);
const BUSINESS_REQUEST_RECONSTRUCTION_PROJECTION_TEXT = Object.freeze([
  'target = the accepted C1 business request document itself, not a digest projection',
  'message_type = request',
  'request_id = arguments.request_id',
  'idempotency_key = envelope idempotency_key',
  'capability = envelope name/version/digest pin plus the accepted C1 constants risk_class=R0 and side_effects=false',
  'tenant_id = envelope tenant_id',
  'org_scope = arguments.org_scope',
  'actor = envelope actor',
  'purpose = envelope purpose',
  'clearance = arguments.clearance',
  'data_marking = envelope data_marking',
  'alert_ref = arguments.alert_ref',
  'policy_digest = arguments.policy_digest',
  'authorization_binding = the credential- and policy-derived binding completed by Fabric and returned inside output.data',
  'requested_at = arguments.requested_at',
  'traceparent = arguments.traceparent when present',
]);
// Reused verbatim from the accepted C1 compatibility manifest. The validator
// fails closed if this packet's copy drifts from the accepted declaration.
const C1_AVAILABLE_RESULT_PROJECTION_TEXT = Object.freeze([
  `schema = ${C1_AVAILABLE_RESULT_SCHEMA}`,
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
  + 'as constrained RFC 8785 (JCS) canonical JSON, and render member_set_digest '
  + 'as sha256:<lowercase hex SHA-256 over those UTF-8 bytes>. The digest input '
  + 'is derived from members[] only: member_set_integrity itself and every other '
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
  adversarial_rejection_cases: 32,
  positive_cases: 3,
  total_cases: 35,
});
const EXPECTED_VERIFICATION_TEXT = Object.freeze({
  scope: 'Standalone static evidence only. The suite in '
    + 'tools/contract-validation/tests/validate-alert-context-transport.test.mjs '
    + 'holds 32 adversarial rejection cases plus 3 positive checks; several '
    + 'adversarial cases are table-driven over multiple mutations and every '
    + 'mutation must fail closed. It proves binding-packet, schema, fixture, '
    + 'correlation, reuse-pin, member-hash and member-set integrity plus '
    + 'lifecycle coherence only: no endpoint, transport surface, capability '
    + 'registration, Fabric grant, W2-F delegation authority, policy completion, '
    + 'kill-switch behavior, runtime enforcement, deployment, CI wiring, bundle '
    + 'tag or release readiness is demonstrated, and the lifecycle acceptance '
    + 'the packet carries is a recorded decision rather than evidence.',
  standalone_validator_command:
    'node tools/contract-validation/validate-alert-context-transport.mjs',
  standalone_test_command:
    'node --test tools/contract-validation/tests/validate-alert-context-transport.test.mjs',
  standalone_coverage_command: 'node --test --experimental-test-coverage '
    + 'tools/contract-validation/tests/validate-alert-context-transport.test.mjs',
  dependency_root_override_env: 'CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT=<directory '
    + 'whose node_modules already provides ajv 8.20.0 and ajv-formats 3.0.1>. '
    + 'All three commands run from the repository root, install nothing and '
    + 'require no network.',
  coverage_floor: 'Branch coverage of '
    + 'tools/contract-validation/validate-alert-context-transport.mjs must stay '
    + 'at or above 80% under the declared standalone coverage command.',
  ci_wiring: 'NOT WIRED. Canonical CI wiring (npm script registration in '
    + 'tools/contract-validation/package.json plus pipeline invocation) is '
    + 'deliberately outside this acceptance and belongs to a later integration '
    + 'gate. This packet adds no tracked file to any existing validator entry '
    + 'point and modifies none.',
});

const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha256File = (path) => sha256Bytes(readFileSync(path));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// Constrained RFC 8785/JCS. The declared value set is objects, arrays, strings
// without lone surrogates, booleans, null and safe integers. Non-integer and
// unsafe numbers are deliberately outside the set so that every digest in this
// packet is reproducible without depending on a runtime's float formatting.
export const canonicalizeJcs = (value) => {
  if (value === null) return 'null';
  const kind = typeof value;
  if (kind === 'boolean') return value ? 'true' : 'false';
  if (kind === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        `constrained JCS violation: number ${value} is outside the safe-integer value set`,
      );
    }
    return String(value);
  }
  if (kind === 'string') {
    if (LONE_SURROGATE.test(value)) {
      throw new TypeError('constrained JCS violation: lone surrogate code point in string');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJcs).join(',')}]`;
  if (kind === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeJcs(value[key])}`)
      .join(',')}}`;
  }
  throw new TypeError(`constrained JCS violation: unsupported ${kind} value`);
};

const jcsDigest = (value) =>
  `sha256:${sha256Bytes(Buffer.from(canonicalizeJcs(value), 'utf8'))}`;
// Structural equality is only ever asserted over the declared constrained-JCS
// value set. A side that leaves that set — a deleted schema restriction read
// back as `undefined`, a non-integer number, a lone surrogate — has no
// canonical form, so it can never be *proven* equal to anything: the comparison
// fails closed as unequal and the caller emits its own validation error instead
// of throwing out of the run. Positive comparisons are untouched, because every
// value this packet really pins is canonicalizable. Canonicalization failures on
// digest inputs still surface verbatim through `safeDigest`.
const UNCANONICALIZABLE = Symbol('uncanonicalizable');
const canonicalOrUnequal = (value) => {
  try {
    return canonicalizeJcs(value);
  } catch {
    return UNCANONICALIZABLE;
  }
};
const same = (left, right) => {
  const canonicalLeft = canonicalOrUnequal(left);
  if (canonicalLeft === UNCANONICALIZABLE) return false;
  return canonicalLeft === canonicalOrUnequal(right);
};
const setEqual = (actual, expected) =>
  actual.size === expected.size && [...expected].every((item) => actual.has(item));

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

export const resolvedArgumentsProjection = (boundRequest) => ({
  schema: RESOLVED_ARGUMENTS_SCHEMA,
  action_id: boundRequest?.action_id,
  idempotency_key: boundRequest?.idempotency_key,
  tenant_id: boundRequest?.tenant_id,
  actor: boundRequest?.actor,
  purpose: boundRequest?.purpose,
  capability: boundRequest?.capability,
  arguments: boundRequest?.arguments,
});

export const resolvedArgumentsDigest = (boundRequest) =>
  jcsDigest(resolvedArgumentsProjection(boundRequest));

// Non-circular by construction: only output.data participates, never
// output.output_digest or output.truncated.
export const boundOutputProjection = (boundResult) => ({
  schema: BOUND_OUTPUT_SCHEMA,
  action_id: boundResult?.action_id,
  tenant_id: boundResult?.tenant_id,
  data: boundResult?.output?.data,
});

const c1AvailableResultProjection = (businessResult) => ({
  schema: C1_AVAILABLE_RESULT_SCHEMA,
  request_id: businessResult?.request_id,
  idempotency_key: businessResult?.idempotency_key,
  authorization_binding_digest: businessResult?.authorization_binding?.binding_digest,
  tenant_id: businessResult?.tenant_id,
  org_scope: businessResult?.org_scope,
  authorized_actor: businessResult?.authorized_actor,
  clearance: businessResult?.clearance,
  capability: businessResult?.capability,
  alert_ref: businessResult?.alert_ref,
  context: businessResult?.context,
  data_marking: businessResult?.data_marking,
  policy_digest: businessResult?.policy_digest,
});

// Lossless round trip back into the accepted C1 business request document. The
// transport binding adds only the two C1 capability-profile constants; every
// other field is carried, never re-derived.
export const reconstructBusinessRequest = (boundRequest, completedBinding) => {
  const args = boundRequest?.arguments || {};
  const reconstructed = {
    message_type: 'request',
    request_id: args.request_id,
    idempotency_key: boundRequest?.idempotency_key,
    capability: {
      name: boundRequest?.capability?.name,
      version: boundRequest?.capability?.version,
      digest: boundRequest?.capability?.digest,
      risk_class: 'R0',
      side_effects: false,
    },
    tenant_id: boundRequest?.tenant_id,
    org_scope: args.org_scope,
    actor: boundRequest?.actor,
    purpose: boundRequest?.purpose,
    clearance: args.clearance,
    data_marking: boundRequest?.data_marking,
    alert_ref: args.alert_ref,
    policy_digest: args.policy_digest,
    authorization_binding: completedBinding,
    requested_at: args.requested_at,
  };
  if (args.traceparent !== undefined) reconstructed.traceparent = args.traceparent;
  return reconstructed;
};

// Bound-receipt profile rules that a JSON Schema cannot express: cross-document
// equality with the invocation the receipt claims to record.
export const checkBoundReceipt = (receipt, boundRequest, boundResult) => {
  const errors = [];
  if (!same(receipt?.capability, boundRequest?.capability)) {
    errors.push('receipt capability pin must equal the envelope capability pin exactly');
  }
  if (receipt?.action_id !== boundRequest?.action_id) {
    errors.push('receipt action_id must equal the bound request action_id');
  }
  if (receipt?.tenant_id !== boundRequest?.tenant_id) {
    errors.push('receipt tenant_id must equal the bound request tenant_id');
  }
  if (receipt?.delegation_ref !== boundRequest?.delegation_ref) {
    errors.push('receipt delegation_ref must equal the bound request delegation_ref');
  }
  if (receipt?.receipt_id !== boundResult?.receipt_id) {
    errors.push('receipt_id must equal the completed bound result receipt_id');
  }
  if (receipt?.side_effect?.performed !== false) {
    errors.push('receipt side_effect.performed must be false for this R0 read capability');
  }
  if ((receipt?.output_artifacts || []).length !== 0) {
    errors.push('receipt must carry no output artifacts for an inline R0 business result');
  }
  if (typeof receipt?.signature !== 'string' || receipt.signature.length === 0) {
    errors.push(
      'receipt signature reference must be present even though the signing envelope stays deferred',
    );
  }
  // The digest is only evidence over a canonicalizable bound request. This helper
  // is an exported library entry point in its own right, with no `safeDigest`
  // wrapper around it, so a request outside the declared constrained-JCS value set
  // must become a deterministic rejection here rather than a TypeError thrown out
  // of the caller. The entry is deliberately sanitized: it names the failure class
  // only and never echoes the offending value or the canonicalizer's message, so it
  // is byte-identical for every uncanonicalizable request. Digest failures on the
  // main validator path still surface verbatim through `safeDigest`, and a
  // canonicalizable request is compared exactly as before.
  let expected;
  try {
    expected = resolvedArgumentsDigest(boundRequest);
  } catch {
    expected = UNCANONICALIZABLE;
  }
  if (expected === UNCANONICALIZABLE) {
    errors.push(
      'receipt resolved_arguments_digest cannot be checked: the bound request is outside the '
      + 'declared constrained-JCS value set and has no resolved-arguments projection digest',
    );
  } else if (receipt?.resolved_arguments_digest !== expected) {
    errors.push(
      'receipt resolved_arguments_digest must match the constrained-JCS '
      + `resolved-arguments projection ${expected}`,
    );
  }
  return errors;
};

export function compileBindingSchema({
  contractsRoot = join(DEFAULT_ROOT, 'contracts'),
  dependencyRoot = HERE,
} = {}) {
  const require = createRequire(join(resolve(dependencyRoot), 'package.json'));
  const AjvModule = require('ajv/dist/2020.js');
  const addFormatsModule = require('ajv-formats');
  const Ajv2020 = AjvModule.default || AjvModule;
  const addFormats = addFormatsModule.default || addFormatsModule;
  const ajv = new Ajv2020({
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
  for (const file of DEPENDENCY_SCHEMA_FILES) {
    ajv.addSchema(readJson(join(contractsRoot, file)));
  }
  const schema = readJson(join(contractsRoot, SCHEMA_FILE));
  ajv.addSchema(schema);
  return {
    ajv,
    schema,
    validate: ajv.getSchema(schema.$id) || ajv.compile(schema),
    validateBusinessRequest: ajv.getSchema(C1_BUSINESS_REQUEST_REF),
  };
}

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
      if (entry.isSymbolicLink()) files.push(`SYMLINK:${packetPath}`);
      else if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(packetPath);
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

const invariantLabel = (text) =>
  (typeof text === 'string' ? /^(TB-\d+|TR-\d+)\s/.exec(text)?.[1] : undefined);

// A declared packet path is proposal-relative by construction: one or more
// '/'-separated segments of portable characters, each starting with an
// alphanumeric, so an absolute root, a '.'/'..' traversal segment, an empty
// segment and a platform separator are all outside the shape. Nothing is joined
// to the contracts root until a declared `file` has passed this gate, so an
// omitted, retyped or escaping value fails closed through a normal validator
// error instead of throwing a TypeError out of the run at the filesystem
// boundary. Returns undefined when the value is a safe relative proposal path,
// otherwise the reason the caller folds into its own error.
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const unsafePathReason = (file) => {
  if (typeof file !== 'string') return `must be a string, got ${typeof file}`;
  if (file.length === 0) return 'must be a non-empty string';
  if (!file.split('/').every((segment) => SAFE_PATH_SEGMENT.test(segment))) {
    return 'must be a safe relative proposal path with no absolute root, traversal or '
      + 'non-portable segment';
  }
  return undefined;
};

// A pin is only evidence over the bytes of a regular file. A declared path that
// resolves to a directory is refused here rather than reaching a read that would
// throw EISDIR out of the run.
const isRegularFile = (path) => existsSync(path) && statSync(path).isFile();

export function validateAlertContextTransportBindingPacket({
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
  // Every digest is computed from real bytes; a value outside the declared
  // constrained-JCS set fails closed instead of throwing out of the run.
  const safeDigest = (label, compute) => {
    try {
      return compute();
    } catch (error) {
      fail(`${label}: ${error.message}`);
      return undefined;
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
  if (!LC) {
    fail(
      `lifecycle state '${EXPECTED_STATE}' is not one of the declared states `
      + `${Object.keys(LIFECYCLE).join(', ')}; the packet cannot be validated fail-closed`,
    );
  }
  for (const [label, document] of lifecycleDocuments) {
    if (!document || !LC) continue;
    if (document['x-cybrik-status'] !== LC.status) {
      fail(`${label}: x-cybrik-status must be '${LC.status}'`);
    }
    if (document['x-cybrik-not-accepted'] !== LC.notAccepted) {
      fail(`${label}: x-cybrik-not-accepted must be ${LC.notAccepted}`);
    }
    if (document['x-cybrik-contract-version'] !== EXPECTED_VERSION) {
      fail(`${label}: x-cybrik-contract-version must be ${EXPECTED_VERSION}`);
    }
    const text = JSON.stringify(document);
    for (const [pattern, reason] of LC.staleLifecycleText) {
      if (pattern.test(text)) fail(`${label}: ${reason}`);
    }
    if (SUPERSESSION_TEXT.test(text)) {
      fail(
        `${label}: supersession claim must not appear; this packet builds on the accepted C1 `
        + 'packet and never replaces it',
      );
    }
  }
  const lifecycleSignatures = new Set(
    lifecycleDocuments
      .filter(([, document]) => document)
      .map(([, document]) =>
        `${document['x-cybrik-status']}/not_accepted=${document['x-cybrik-not-accepted']}`),
  );
  if (lifecycleSignatures.size > 1) {
    fail(
      'lifecycle half-flip: schema, examples manifest and compatibility manifest must '
      + `carry one identical lifecycle pair, got ${[...lifecycleSignatures].join(' vs ')}`,
    );
  }

  if (schema) {
    exactKeys('schema top level', schema, SCHEMA_TOP_LEVEL_KEYS, fail);
    exactKeys('schema $defs', schema.$defs, SCHEMA_DEFS, fail);
    const oneOfRefs = (schema.oneOf || []).map((branch) => branch?.$ref);
    if (!same(oneOfRefs, SCHEMA_DEFS.slice(2).map((name) => `#/$defs/${name}`))) {
      fail('schema oneOf must be exactly boundRequest, boundResult, boundReceipt');
    }

    const pin = schema.$defs?.boundCapabilityPin || {};
    exactKeys('schema boundCapabilityPin properties', pin.properties, BOUND_CAPABILITY_PROPERTIES, fail);
    if (pin.additionalProperties !== false) {
      fail('schema $defs.boundCapabilityPin: additionalProperties must be false');
    }
    if (pin.properties?.name?.const !== 'soc.get_alert_context'
        || pin.properties?.version?.const !== EXPECTED_VERSION) {
      fail('schema capability pin must be exact soc.get_alert_context@0.1.0');
    }
    if (pin.properties?.digest?.$ref
        !== 'cybrik.common-defs.v1.schema.json#/$defs/sha256Digest') {
      fail('schema capability descriptor digest must stay an opaque accepted sha256Digest pin');
    }

    const args = schema.$defs?.callerArguments || {};
    exactKeys(
      'schema callerArguments properties',
      args.properties,
      CALLER_ARGUMENT_PROPERTIES,
      fail,
    );
    if (args.additionalProperties !== false) {
      fail('schema $defs.callerArguments: additionalProperties must be false');
    }
    if ('authorization_binding' in (args.properties || {})) {
      fail(
        'schema callerArguments must not admit authorization_binding: the caller may never '
        + 'assert the credential- and policy-derived binding',
      );
    }
    if (!setEqual(new Set(args.required || []), new Set(CALLER_ARGUMENT_REQUIRED))) {
      fail('schema callerArguments required set must match the independent exact allowlist');
    }
    for (const [property, expectedRef] of [
      ['org_scope', 'cybrik.soc-get-alert-context.v1.schema.json#/$defs/orgScope'],
      ['alert_ref', 'cybrik.soc-get-alert-context.v1.schema.json#/$defs/alertRef'],
    ]) {
      if (args.properties?.[property]?.$ref !== expectedRef) {
        fail(`schema callerArguments.${property} must reuse the accepted C1 definition by $ref`);
      }
    }

    const envelopeReuse = [
      ['boundRequest', 'cybrik.tool-execution-request.v1.schema.json'],
      ['boundResult', 'cybrik.tool-execution-result.v1.schema.json'],
      ['boundReceipt', 'cybrik.execution-receipt.v1.schema.json'],
    ];
    for (const [definition, expectedRef] of envelopeReuse) {
      const branch = schema.$defs?.[definition];
      if (branch?.allOf?.[0]?.$ref !== expectedRef || branch?.allOf?.length !== 2) {
        fail(
          `schema ${definition} must reuse the accepted ${expectedRef} envelope byte-unchanged `
          + 'by $ref plus exactly one restriction branch',
        );
      }
      exactKeys(`schema ${definition}`, branch, ['allOf'], fail);
    }

    const request = schema.$defs?.boundRequest?.allOf?.[1] || {};
    if (!setEqual(new Set(request.required || []), new Set(BOUND_REQUEST_REQUIRED))) {
      fail('schema bound request required set must match the independent exact allowlist');
    }
    if (request.properties?.capability?.$ref !== '#/$defs/boundCapabilityPin'
        || request.properties?.arguments?.$ref !== '#/$defs/callerArguments') {
      fail('schema bound request must pin the capability and closed caller-argument channel');
    }
    for (const [property, bounds] of Object.entries(BOUND_REQUEST_STRING_BOUNDS)) {
      const declared = request.properties?.[property] || {};
      if (declared.type !== 'string'
          || declared.minLength !== bounds.minLength
          || declared.maxLength !== bounds.maxLength) {
        fail(
          `schema bound request ${property} must be narrowed to the accepted C1 business-request `
          + `bound ${bounds.minLength}..${bounds.maxLength} so no envelope-valid bound request can `
          + 'reconstruct into a C1 business request the accepted C1 contract rejects',
        );
      }
    }
    if (request.properties?.execution?.properties?.mode?.const !== 'execute') {
      fail('schema bound request execution mode must be exact execute (no dry_run, no queueing)');
    }
    if (!same(request.not, { required: ['resource_scope'] })) {
      fail(
        'schema bound request must forbid resource_scope so authorized scope has exactly one '
        + 'channel',
      );
    }

    const result = schema.$defs?.boundResult?.allOf?.[1] || {};
    if (!same(result.properties?.status?.enum, BOUND_RESULT_STATUS_SET)) {
      fail(
        'schema bound result status set must be exactly '
        + `${BOUND_RESULT_STATUS_SET.join(', ')} (no queued, no approval_required)`,
      );
    }
    if (!same(result.not, { required: ['approval_id'] })) {
      fail('schema bound result must forbid approval_id for this non-approval-gated R0 read');
    }
    if (result.properties?.output_artifacts?.maxItems !== 0) {
      fail('schema bound result must forbid output artifacts (inline business result only)');
    }
    if (result.properties?.output?.properties?.truncated?.const !== false
        || !same(result.properties?.output?.required, ['data', 'output_digest'])) {
      fail('schema bound result inline output must be complete and digest-bound');
    }
    if (result.properties?.output?.properties?.data?.$ref
        !== 'cybrik.soc-get-alert-context.v1.schema.json#/$defs/result') {
      fail('schema bound result business payload must $ref the accepted C1 result definition');
    }
    const completed = result.allOf?.[0];
    if (completed?.if?.properties?.status?.const !== 'completed'
        || !setEqual(new Set(completed?.then?.required || []), new Set(['receipt_id', 'output']))
        || !same(completed?.then?.not, { required: ['error'] })) {
      fail(
        'schema completed bound result must require receipt_id and inline output and forbid an '
        + 'error',
      );
    }
    const nonCompleted = result.allOf?.[1];
    if (!same(nonCompleted?.if?.properties?.status?.enum, BOUND_RESULT_STATUS_SET.slice(1))
        || !same(nonCompleted?.then?.not, { required: ['output'] })) {
      fail('schema non-completed bound result must forbid business output');
    }
    const denied = result.allOf?.[2];
    if (denied?.if?.properties?.status?.const !== 'denied'
        || !same(denied?.then?.not, { required: ['receipt_id'] })
        || denied?.then?.properties?.error?.properties?.retryable?.const !== false) {
      fail(
        'schema denied bound result must forbid receipt_id and stay terminal: a fail-closed '
        + 'pre-dispatch denial executed nothing',
      );
    }
    if ((result.allOf || []).length !== 3) {
      fail('schema bound result must carry exactly the completed, non-completed and denied branches');
    }

    const receipt = schema.$defs?.boundReceipt?.allOf?.[1] || {};
    if (!setEqual(new Set(receipt.required || []), new Set(BOUND_RECEIPT_REQUIRED))) {
      fail('schema bound receipt required set must match the independent exact allowlist');
    }
    if (receipt.properties?.side_effect?.properties?.performed?.const !== false) {
      fail('schema bound receipt side_effect.performed must be exact false');
    }
    if (receipt.properties?.output_artifacts?.maxItems !== 0
        || receipt.properties?.input_artifact_digests?.maxItems !== 0) {
      fail('schema bound receipt must forbid input and output artifacts');
    }
    if (!same(receipt.properties?.status?.enum, BOUND_RECEIPT_STATUS_SET)) {
      fail(`schema bound receipt status set must be exactly ${BOUND_RECEIPT_STATUS_SET.join(', ')}`);
    }
    if (receipt.properties?.capability?.$ref !== '#/$defs/boundCapabilityPin') {
      fail('schema bound receipt must pin the same capability descriptor as the envelope request');
    }
    if ('signature_envelope' in (receipt.properties || {})) {
      fail('schema bound receipt must not invent a signature envelope: it stays deferred');
    }
  }

  let ajv;
  let validate;
  let validateBusinessRequest;
  if (schema) {
    try {
      const compiled = compileBindingSchema({ contractsRoot, dependencyRoot });
      ajv = compiled.ajv;
      validate = compiled.validate;
      validateBusinessRequest = compiled.validateBusinessRequest;
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
      const relativePath = `${EXAMPLES_DIR}/${example.file}`;
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
      const declared = new Set([
        ...(compatibility.trust_invariants?.structural || []),
        ...(compatibility.trust_invariants?.runtime_only_fixture_exercised || []),
      ].map(invariantLabel).filter(Boolean));
      const declaredByFile = new Map(
        (examplesManifest.examples || []).map((example) => [example.file, example.invariant]),
      );
      for (const [file, expected] of Object.entries(EXPECTED_TRUST_INVARIANTS)) {
        const cited = invariantLabel(declaredByFile.get(file));
        if (!cited) {
          fail(`example row ${file}: invariant must start with a canonical TB-<n> or TR-<n> label`);
        } else if (cited !== expected) {
          fail(`example row ${file}: expected trust invariant must be ${expected}, got ${cited}`);
        } else if (!declared.has(cited)) {
          fail(
            `example row ${file}: expected trust invariant ${cited} is absent from the `
            + 'compatibility trust invariants',
          );
        }
      }
    }
  }

  const inventory = new Set(
    listFiles(join(contractsRoot, EXAMPLES_DIR), `${EXAMPLES_DIR}/`),
  );
  if (!setEqual(inventory, new Set(EXPECTED_EXAMPLE_FILES))) {
    const orphan = [...inventory].filter((file) => !EXPECTED_EXAMPLE_FILES.includes(file));
    const missing = EXPECTED_EXAMPLE_FILES.filter((file) => !inventory.has(file));
    fail(
      'examples filesystem inventory differs from independent allowlist; '
      + `orphan=${orphan.join(',') || 'none'} missing=${missing.join(',') || 'none'}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Transport-binding correlation against the accepted C1 packet bytes.
  // ---------------------------------------------------------------------------
  const sourceManifest = load(SOURCE_MANIFEST_FILE);
  const sourceRequest = load(SOURCE_REQUEST_FILE);
  const sourceBusinessResults = {
    'positive/bound-result.available.json': load(SOURCE_AVAILABLE_FILE),
    'positive/bound-result.unavailable.json': load(SOURCE_UNAVAILABLE_FILE),
  };
  const w2fToken = load(W2F_TOKEN_FILE);
  const liveSourceSchemaDigest = existsSync(join(contractsRoot, SOURCE_SCHEMA_FILE))
    ? `sha256:${sha256File(join(contractsRoot, SOURCE_SCHEMA_FILE))}`
    : undefined;

  const boundRequest = fixtures['positive/bound-request.json'];
  const completedResults = [
    'positive/bound-result.available.json',
    'positive/bound-result.unavailable.json',
  ];
  const killSwitch = fixtures['positive/bound-result.kill-switch-denied.json'];

  // Every fixture that declares an inline output digest must stay self-consistent
  // with the declared constrained-JCS projection, whatever its fixture class, so
  // no negative or positive fixture can keep a stale digest.
  for (const [file] of EXPECTED_EXAMPLES) {
    const fixture = fixtures[file];
    if (!fixture?.output?.output_digest) continue;
    const expected = safeDigest(file, () => jcsDigest(boundOutputProjection(fixture)));
    if (expected === undefined) continue;
    if (fixture.output.output_digest !== expected) {
      fail(`${file}: output_digest must match the constrained-JCS bound-output projection`);
    } else {
      bump('bound_output_digests_verified');
    }
    const business = fixture.output.data;
    if (business?.outcome !== 'available') continue;
    const expectedContext =
      safeDigest(file, () => jcsDigest(c1AvailableResultProjection(business)));
    if (expectedContext === undefined) continue;
    if (business.context_digest !== expectedContext) {
      fail(
        `${file}: business context_digest must match the reused C1 available-result projection`,
      );
    } else {
      bump('business_context_digests_verified');
    }
  }

  if (boundRequest) {
    // The resolved-arguments projection must be computable for the caller-asserted
    // arguments; a value outside the constrained set fails closed here.
    safeDigest('positive/bound-request.json', () => resolvedArgumentsDigest(boundRequest));
    if (boundRequest.actor?.tenant_id !== boundRequest.tenant_id) {
      fail(
        'positive/bound-request.json: envelope actor tenant must equal the envelope '
        + 'authoritative tenant',
      );
    }
  }

  for (const file of completedResults) {
    const boundResult = fixtures[file];
    if (!boundResult || !boundRequest) continue;
    if (boundResult.action_id !== boundRequest.action_id) {
      fail(`${file}: bound result action_id must equal the bound request action_id`);
    } else if (boundResult.tenant_id !== boundRequest.tenant_id) {
      fail(`${file}: bound result tenant_id must equal the bound request tenant_id`);
    } else {
      bump('bound_result_correlations_verified');
    }
    if (!boundResult.receipt_id) {
      fail(`${file}: a completed bound result must carry a receipt_id`);
    }
    const business = boundResult.output?.data;
    if (!business) continue;
    const binding = business.authorization_binding;

    // Identity and scope completion: the caller asserts advisory copies, Fabric
    // and SOC complete the authoritative binding, and the two must agree exactly.
    if (!same(binding?.actor, boundRequest.actor)) {
      fail(
        `${file}: identity completion: envelope actor must equal the completed authorization `
        + 'binding actor',
      );
    }
    if (!same(binding?.org_scope, boundRequest.arguments?.org_scope)) {
      fail(
        `${file}: scope completion: caller org_scope must equal the completed authorization `
        + 'binding org_scope',
      );
    }
    if (binding?.tenant_id !== boundRequest.tenant_id) {
      fail(
        `${file}: tenant completion: envelope tenant_id must equal the completed authorization `
        + 'binding tenant_id',
      );
    }
    if (binding?.actor?.tenant_id !== binding?.tenant_id) {
      fail(`${file}: completed binding actor tenant must equal the binding authoritative tenant`);
    }
    if (binding?.policy_digest !== boundRequest.arguments?.policy_digest) {
      fail(`${file}: completed binding policy_digest must equal the caller-argument policy_digest`);
    }
    if (liveSourceSchemaDigest && binding?.schema_digest !== liveSourceSchemaDigest) {
      fail(
        `${file}: completed binding schema_digest must pin the exact accepted C1 schema bytes`,
      );
    }

    // Exact capability pin equality across the transport envelope and the
    // completed business binding, with the R0/no-side-effect classification held.
    for (const [label, pin] of [['business result', business.capability], ['completed binding', binding?.capability]]) {
      if (pin?.name !== boundRequest.capability?.name
          || pin?.version !== boundRequest.capability?.version
          || pin?.digest !== boundRequest.capability?.digest) {
        fail(`${file}: ${label} capability pin must equal the envelope capability pin exactly`);
      }
      if (pin?.risk_class !== 'R0' || pin?.side_effects !== false) {
        fail(`${file}: ${label} capability pin must stay R0 with side_effects=false`);
      }
    }

    if (business.request_id !== boundRequest.arguments?.request_id) {
      fail(`${file}: business request_id must equal the caller-argument request_id`);
    }
    // Trace context is carried, never minted. A business result may omit
    // traceparent — the accepted C1 result contract leaves it optional — but any
    // value it does carry must be exactly the caller-asserted one. The same
    // comparison therefore also rejects a fabricated result-side traceparent
    // when the caller asserted none, because the caller value is then undefined.
    if (business.traceparent !== undefined
        && business.traceparent !== boundRequest.arguments?.traceparent) {
      fail(
        `${file}: traceparent must be identical across the caller arguments and the business `
        + 'result',
      );
    }

    // Quadruple idempotency-key equality across the four bound positions.
    const reconstructed = reconstructBusinessRequest(boundRequest, binding);
    const positions = [
      ['envelope request', boundRequest.idempotency_key],
      ['receipt resolved-arguments projection', resolvedArgumentsProjection(boundRequest).idempotency_key],
      ['reconstructed C1 business request', reconstructed.idempotency_key],
      ['C1 business result inside output.data', business.idempotency_key],
    ];
    if (new Set(positions.map(([, value]) => value)).size !== 1) {
      fail(
        `${file}: quadruple idempotency-key equality failed across `
        + positions.map(([label, value]) => `${label}=${value}`).join(', '),
      );
    }

    // Generic conformance: the reconstruction must satisfy the accepted C1
    // request branch itself, so a bound request that the envelope accepts but
    // that C1 would reject can never round-trip, whatever fixture it is compared
    // with.
    if (validateBusinessRequest && !validateBusinessRequest(reconstructed)) {
      fail(
        `${file}: reconstructed C1 business request must validate against the accepted C1 `
        + `request branch: ${ajv.errorsText(validateBusinessRequest.errors)}`,
      );
    } else if (validateBusinessRequest) {
      bump('business_request_conformance_verified');
    }

    // Losslessness: the reconstruction must be the accepted C1 request bytes.
    if (sourceRequest && safeDigest(file, () => same(reconstructed, sourceRequest)) === false) {
      fail(
        `${file}: reconstructed C1 business request must be byte-identical to the accepted C1 `
        + 'request fixture under constrained JCS',
      );
    } else if (sourceRequest) {
      bump('business_request_reconstructions_verified');
    }

    const expectedBusiness = sourceBusinessResults[file];
    if (expectedBusiness && !same(business, expectedBusiness)) {
      fail(
        `${file}: business result must be byte-identical to the accepted C1 result fixture `
        + 'under constrained JCS',
      );
    }
  }

  if (killSwitch && boundRequest) {
    if (killSwitch.action_id !== boundRequest.action_id
        || killSwitch.tenant_id !== boundRequest.tenant_id) {
      fail(
        'positive/bound-result.kill-switch-denied.json: bound result action_id must equal the '
        + 'bound request action_id and tenant_id',
      );
    } else {
      bump('bound_result_correlations_verified');
    }
    if (killSwitch.status !== 'denied'
        || killSwitch.error?.code !== KILL_SWITCH_CODE
        || killSwitch.error?.retryable !== false) {
      fail(
        'kill-switch denial must carry the declared fail-closed code '
        + `${KILL_SWITCH_CODE} with retryable=false`,
      );
    }
    if ('receipt_id' in killSwitch || 'output' in killSwitch
        || (killSwitch.output_artifacts || []).length !== 0) {
      fail(
        'kill-switch denial must carry no receipt_id, business output or output artifact: it is '
        + 'evaluated pre-dispatch',
      );
    }
  }

  const semanticIdempotency =
    fixtures['negative-semantic/bound-request.idempotency-key-mismatch.json'];
  const businessIdempotencyKey = fixtures['positive/bound-result.available.json']
    ?.output?.data?.idempotency_key;
  if (semanticIdempotency
      && (semanticIdempotency.idempotency_key === boundRequest?.idempotency_key
        || semanticIdempotency.idempotency_key === businessIdempotencyKey)) {
    fail(
      'idempotency-key-mismatch semantic fixture must differ from the bound business '
      + 'idempotency key in every one of the four bound positions',
    );
  }
  const semanticTenant = fixtures['negative-semantic/bound-request.tenant-mismatch.json'];
  if (semanticTenant && semanticTenant.tenant_id === semanticTenant.actor?.tenant_id) {
    fail(
      'tenant-mismatch semantic fixture must differ between the envelope tenant and the actor '
      + 'tenant',
    );
  }
  const semanticW2f =
    fixtures['negative-semantic/bound-request.w2f-token-as-delegation-ref.json'];
  if (semanticW2f && w2fToken) {
    const expected = safeDigest(W2F_TOKEN_FILE, () => jcsDigest(w2fToken));
    if (semanticW2f.delegation_ref !== expected) {
      fail(
        'w2f-token semantic fixture delegation_ref must be the constrained-JCS digest of the '
        + `accepted W2-F delegation token (${expected})`,
      );
    }
    if (semanticW2f.delegation_ref === boundRequest?.delegation_ref) {
      fail(
        'w2f-token semantic fixture must differ from the positive Fabric delegation_ref: a W2-F '
        + 'inference delegation is never a Fabric tool grant',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Compatibility manifest, reuse pins and packet integrity.
  // ---------------------------------------------------------------------------
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
        'dispatch',
        'owner_of_truth',
        'contract_owner',
        'execution_authority_owner',
        'implementation_status',
      ],
      fail,
    );
    exactKeys(
      'transport_binding',
      compatibility.transport_binding,
      [
        'envelope_request',
        'envelope_result',
        'envelope_receipt',
        'envelope_openapi',
        'business_request_channel',
        'business_result_channel',
        'artifact_channel',
        'dispatch_mode',
      ],
      fail,
    );
    exactKeys(
      'authority_boundaries',
      compatibility.authority_boundaries,
      ['fabric', 'w2f', 'soc', 'ai', 'kill_switch'],
      fail,
    );
    exactKeys(
      'completion_semantics',
      compatibility.completion_semantics,
      ['caller_assertion', 'identity_completion', 'scope_completion', 'order', 'capability_pin'],
      fail,
    );
    exactKeys(
      'outcome_mapping',
      compatibility.outcome_mapping,
      ['completed', 'denied', 'unavailable', 'failed', 'budget_exceeded', 'excluded'],
      fail,
    );
    exactKeys(
      'canonicalization',
      compatibility.canonicalization,
      [
        'standard',
        'constrained_value_set',
        'owner',
        'resolved_arguments_projection',
        'bound_output_projection',
        'business_request_reconstruction_projection',
        'reused_c1_available_result_projection',
      ],
      fail,
    );
    exactKeys(
      'idempotency_semantics',
      compatibility.idempotency_semantics,
      ['quadruple_equality', 'order', 'cache_partition', 'conflict'],
      fail,
    );
    exactKeys(
      'receipt_binding',
      compatibility.receipt_binding,
      ['requirement', 'required_fields', 'side_effect', 'signature', 'artifacts'],
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
      'source_packet',
      compatibility.source_packet,
      [
        'packet',
        'source_commit',
        'source_manifest_sha256',
        'source_member_count',
        'source_member_set_digest',
        'source_members',
        'reuse_statement',
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
        'policy_completion_runtime_proven',
        'kill_switch_runtime_proven',
        'endpoint_or_transport_implemented',
        'accepted_for_implementation',
        'release_ready',
      ],
      fail,
    );
    if (LC?.requiresAcceptanceRecord) {
      exactKeys('acceptance', compatibility.acceptance, ACCEPTANCE_KEYS, fail);
    } else if ('acceptance' in compatibility) {
      fail("acceptance: unexpected key 'acceptance' outside the accepted lifecycle state");
    }
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
        + `(${EXPECTED_TEST_CASE_COUNTS.adversarial_rejection_cases} adversarial rejections `
        + `plus ${EXPECTED_TEST_CASE_COUNTS.positive_cases} positive checks)`,
      );
    }
    if (compatibility['x-cybrik-packet-version'] !== EXPECTED_VERSION
        || compatibility['x-cybrik-is-bundle-tag'] !== false) {
      fail('compatibility manifest must stay mutable pre-GA packet v0.1.0');
    }
    if (compatibility.capability_scope?.implementation_status !== 'NOT IMPLEMENTED') {
      fail('capability implementation_status must stay NOT IMPLEMENTED');
    }
    if (compatibility.capability_scope?.risk_class !== 'R0'
        || compatibility.capability_scope?.side_effects !== false) {
      fail('capability_scope must stay R0 with side_effects=false');
    }
    // The acceptance record. It exists only in the accepted state, must agree
    // with the declared lifecycle rather than half-flipping against it, must
    // stay traceable to its gate record, and must keep every non-claim and every
    // open runtime obligation explicit.
    if (LC?.requiresAcceptanceRecord) {
      const acceptance = compatibility.acceptance || {};
      if (acceptance.status !== compatibility['x-cybrik-status']) {
        fail(
          'lifecycle half-flip: acceptance.status must equal the declared x-cybrik-status, '
          + `got '${acceptance.status}' vs '${compatibility['x-cybrik-status']}'`,
        );
      }
      if (acceptance.status !== LC.status) {
        fail(`acceptance.status must be ${LC.status}`);
      }
      if (acceptance.accepted_on !== EXPECTED_ACCEPTED_ON) {
        fail(`acceptance.accepted_on must be ${EXPECTED_ACCEPTED_ON}`);
      }
      if (typeof acceptance.decision_record !== 'string'
          || !acceptance.decision_record.includes(EXPECTED_GATE_RECORD)) {
        fail(`acceptance.decision_record must cite the gate record ${EXPECTED_GATE_RECORD}`);
      }
      if (!same(acceptance.non_claims, EXPECTED_NON_CLAIMS)) {
        fail(
          'acceptance.non_claims must match the independent exact list of gates this '
          + 'acceptance does not open',
        );
      }
      if (!Array.isArray(acceptance.settled_checklist) || acceptance.settled_checklist.length === 0) {
        fail('acceptance.settled_checklist must record at least one settled question');
      }
      // Acceptance closes no runtime obligation: the record must carry exactly
      // the same open set the packet declares.
      if (!same(acceptance.open_runtime_obligations, EXPECTED_OPEN_RUNTIME_OBLIGATIONS)) {
        fail(
          'acceptance.open_runtime_obligations must be exactly '
          + EXPECTED_OPEN_RUNTIME_OBLIGATIONS.join(', '),
        );
      }
    }

    const proof = compatibility.proof_limits || {};
    for (const field of [
      'runtime_authorization_proven',
      'policy_completion_runtime_proven',
      'kill_switch_runtime_proven',
      'endpoint_or_transport_implemented',
      'release_ready',
    ]) {
      if (proof[field] !== false) fail(`proof_limits.${field} must stay false`);
    }
    if (proof.static_packet_integrity_proven !== true) {
      fail('proof_limits.static_packet_integrity_proven must be true');
    }
    if (LC && proof.accepted_for_implementation !== LC.acceptedForImplementation) {
      fail(
        `proof_limits.accepted_for_implementation must be ${LC.acceptedForImplementation} in `
        + `lifecycle state ${EXPECTED_STATE}`,
      );
    }
    if (proof.accepted_for_implementation !== (compatibility['x-cybrik-not-accepted'] === false)) {
      fail(
        'lifecycle half-flip: proof_limits.accepted_for_implementation must agree with '
        + 'x-cybrik-not-accepted',
      );
    }
    for (const field of ['modifies_existing_packet_bytes', 'modifies_existing_ids', 'stable_v1_or_ga']) {
      if (compatibility.compatibility?.[field] !== false) {
        fail(`compatibility.${field} must stay false`);
      }
    }
    if (!same(compatibility.compatibility?.reuses_accepted_unmodified, REUSED_UNMODIFIED_FILES)) {
      fail(
        'compatibility.reuses_accepted_unmodified must list exactly the accepted artifacts this '
        + 'packet reuses byte-unchanged',
      );
    }

    const declaredOpen = (compatibility.trust_invariants?.runtime_only_declared || [])
      .map(invariantLabel);
    const fixtureExercised =
      (compatibility.trust_invariants?.runtime_only_fixture_exercised || []).map(invariantLabel);
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
    if (!same(compatibility.open_runtime_obligations, EXPECTED_OPEN_RUNTIME_OBLIGATIONS)) {
      fail(
        'open_runtime_obligations must be exactly '
        + EXPECTED_OPEN_RUNTIME_OBLIGATIONS.join(', '),
      );
    }

    const authority = JSON.stringify(compatibility.authority_boundaries || {});
    for (const phrase of [
      'Fabric tool-grant authority',
      'W2-F inference delegation',
      'cannot authorize',
      'fail-closed',
    ]) {
      if (!authority.includes(phrase)) {
        fail(`compatibility authority boundary must include '${phrase}'`);
      }
    }
    const completion = JSON.stringify(compatibility.completion_semantics || {});
    for (const phrase of [
      'never assert authorization_binding',
      'credential',
      'before dispatch',
      'exact equality',
    ]) {
      if (!completion.includes(phrase)) {
        fail(`completion semantics must include '${phrase}'`);
      }
    }
    const idempotency = JSON.stringify(compatibility.idempotency_semantics || {});
    for (const phrase of [
      'four bound positions',
      'tenant-partitioned',
      'authorization before any idempotency or cache lookup',
      'rejects before target lookup',
    ]) {
      if (!idempotency.includes(phrase)) {
        fail(`idempotency semantics must include '${phrase}'`);
      }
    }
    const receiptBinding = JSON.stringify(compatibility.receipt_binding || {});
    for (const phrase of ['side_effect.performed=false', 'deferred', 'every completed invocation']) {
      if (!receiptBinding.includes(phrase)) {
        fail(`receipt binding must include '${phrase}'`);
      }
    }
    const canonicalization = compatibility.canonicalization || {};
    if (!canonicalization.standard?.includes('RFC 8785')
        || !canonicalization.constrained_value_set?.includes('safe integer')) {
      fail('canonicalization must pin RFC 8785/JCS with the declared constrained value set');
    }
    const projectionChecks = [
      [
        'resolved_arguments_projection',
        canonicalization.resolved_arguments_projection,
        RESOLVED_ARGUMENTS_PROJECTION_TEXT,
      ],
      [
        'bound_output_projection',
        canonicalization.bound_output_projection,
        BOUND_OUTPUT_PROJECTION_TEXT,
      ],
      [
        'business_request_reconstruction_projection',
        canonicalization.business_request_reconstruction_projection,
        BUSINESS_REQUEST_RECONSTRUCTION_PROJECTION_TEXT,
      ],
      [
        'reused_c1_available_result_projection',
        canonicalization.reused_c1_available_result_projection,
        C1_AVAILABLE_RESULT_PROJECTION_TEXT,
      ],
    ];
    for (const [label, actual, expected] of projectionChecks) {
      if (!same(actual, expected)) {
        fail(`canonicalization.${label} must match the independent exact projection`);
      }
    }
    // The reused C1 projection must still be the accepted C1 declaration.
    if (sourceManifest
        && !same(
          sourceManifest.canonicalization?.available_result_projection,
          C1_AVAILABLE_RESULT_PROJECTION_TEXT,
        )) {
      fail(
        'the reused C1 available-result projection must match the accepted C1 declaration '
        + 'exactly; this packet may not redefine it',
      );
    }

    const manifestText = JSON.stringify(compatibility);
    for (const forbiddenClaim of [
      /runtime verified/i,
      /runtime authorization proven/i,
      /release ready/i,
      /new endpoint/i,
    ]) {
      if (forbiddenClaim.test(manifestText)) {
        fail(`compatibility manifest contains forbidden claim ${forbiddenClaim}`);
      }
    }
    if (LC && !manifestText.includes(LC.status)) {
      fail(`compatibility manifest must carry the declared '${LC.status}' lifecycle value`);
    }

    // Accepted-artifact reuse pins.
    const reused = compatibility.reused_unmodified || [];
    const seenReused = new Set();
    for (const entry of reused) {
      exactKeys(
        `reused_unmodified ${entry.file || '<missing>'}`,
        entry,
        ['file', 'kind', 'reuse', 'sha256'],
        fail,
      );
      seenReused.add(entry.file);
      if (entry.reuse !== 'byte-unchanged') {
        fail(`reused_unmodified ${entry.file} must declare byte-unchanged reuse`);
      }
      const unsafeReason = unsafePathReason(entry.file);
      if (unsafeReason) {
        fail(`reused_unmodified missing accepted artifact: declared file ${unsafeReason}`);
        continue;
      }
      const path = join(contractsRoot, entry.file);
      if (!isRegularFile(path)) {
        fail(`reused_unmodified missing accepted artifact: ${entry.file}`);
        continue;
      }
      const actual = sha256File(path);
      if (entry.sha256 !== actual) {
        fail(`reused_unmodified ${entry.file} sha256 must be ${actual}`);
      } else {
        bump('reused_pins_verified');
      }
    }
    if (!setEqual(seenReused, new Set(REUSED_UNMODIFIED_FILES))) {
      fail('reused_unmodified must exactly cover the independent expected accepted-artifact allowlist');
    }

    // Source C1 packet pins: commit, manifest bytes, member set and every member.
    const source = compatibility.source_packet || {};
    if (source.packet !== SOURCE_MANIFEST_FILE) {
      fail(`source_packet.packet must be ${SOURCE_MANIFEST_FILE}`);
    }
    if (source.source_commit !== EXPECTED_SOURCE_COMMIT) {
      fail(`source_packet.source_commit must be ${EXPECTED_SOURCE_COMMIT}`);
    }
    if (existsSync(join(contractsRoot, SOURCE_MANIFEST_FILE))) {
      const actual = sha256File(join(contractsRoot, SOURCE_MANIFEST_FILE));
      if (source.source_manifest_sha256 !== actual) {
        fail(`source_packet.source_manifest_sha256 must be ${actual}`);
      }
    }
    if (source.source_member_count !== EXPECTED_SOURCE_MEMBER_COUNT) {
      fail(`source_packet.source_member_count must be ${EXPECTED_SOURCE_MEMBER_COUNT}`);
    }
    if (sourceManifest) {
      const recomputed = memberSetDigest(sourceManifest.members);
      if (source.source_member_set_digest !== recomputed) {
        fail(`source_packet.source_member_set_digest must be ${recomputed}`);
      }
      if ((sourceManifest.members || []).length !== EXPECTED_SOURCE_MEMBER_COUNT) {
        fail(
          `the accepted C1 packet must still declare ${EXPECTED_SOURCE_MEMBER_COUNT} members`,
        );
      }
    }
    const declaredSourceMembers = source.source_members || [];
    if (declaredSourceMembers.length !== EXPECTED_SOURCE_MEMBER_COUNT) {
      fail(
        `source_packet.source_members must pin exactly ${EXPECTED_SOURCE_MEMBER_COUNT} accepted `
        + 'C1 members',
      );
    }
    const sourceByFile = new Map(
      (sourceManifest?.members || []).map((member) => [member.file, member.sha256]),
    );
    for (const entry of declaredSourceMembers) {
      exactKeys(
        `source_packet member ${entry.file || '<missing>'}`,
        entry,
        ['file', 'sha256'],
        fail,
      );
      const unsafeReason = unsafePathReason(entry.file);
      if (unsafeReason) {
        fail(`source_packet source member missing: declared file ${unsafeReason}`);
        continue;
      }
      const path = join(contractsRoot, entry.file);
      if (!isRegularFile(path)) {
        fail(`source_packet source member missing: ${entry.file}`);
        continue;
      }
      const actual = sha256File(path);
      if (entry.sha256 !== actual) {
        fail(`source_packet source member ${entry.file} sha256 must be ${actual}`);
      } else if (sourceByFile.get(entry.file) !== actual) {
        fail(
          `source_packet source member ${entry.file} must still match the accepted C1 manifest `
          + 'declaration',
        );
      } else {
        bump('source_member_pins_verified');
      }
    }

    const seenMembers = new Set();
    for (const member of compatibility.members || []) {
      exactKeys(
        `compatibility member ${member.file || '<missing>'}`,
        member,
        ['file', 'kind', 'contract_version', 'sha256'],
        fail,
      );
      // The member path is proven before it is ever joined to the contracts
      // root: a row that omits `file`, retypes it or points outside the packet
      // is a fail-closed validator error, never a crash at the join.
      const unsafeReason = unsafePathReason(member.file);
      if (unsafeReason) {
        fail(`compatibility member file ${unsafeReason}`);
        continue;
      }
      if (!EXPECTED_MEMBER_FILES.includes(member.file)) {
        fail(`compatibility member outside the exact declared member allowlist: ${member.file}`);
        continue;
      }
      if (seenMembers.has(member.file)) {
        fail(`duplicate compatibility member: ${member.file}`);
      }
      seenMembers.add(member.file);
      if (MEMBER_KIND[member.file] !== member.kind
          || member.contract_version !== EXPECTED_VERSION) {
        fail(`compatibility member outside exact file/kind/version allowlist: ${member.file}`);
      }
      const path = join(contractsRoot, member.file);
      if (!isRegularFile(path)) {
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
    // A member row that left the constrained-JCS value set — an omitted `file`
    // read back as undefined — has no canonical form, so the aggregate fails
    // closed with the canonicalization error instead of throwing out of the run.
    const expectedMemberSetDigest = safeDigest(
      'member_set_integrity.member_set_digest',
      () => memberSetDigest(compatibility.members),
    );
    if (expectedMemberSetDigest !== undefined) {
      if (integrity.member_set_digest !== expectedMemberSetDigest) {
        fail(`member_set_integrity.member_set_digest must be ${expectedMemberSetDigest}`);
      } else {
        bump('member_set_digest_verified');
      }
    }
  }

  // Derived from the real bytes, never asserted: a lifecycle regression or
  // half-flip prints a pair that differs from the expected state's pair.
  const status = compatibility
    ? `${String(compatibility['x-cybrik-status'] ?? 'MISSING').replace(/\s+/g, '_')}`
      + `_NOT_ACCEPTED_FLAG=${compatibility['x-cybrik-not-accepted']}`
    : 'MISSING_COMPATIBILITY_MANIFEST';
  return {
    ok: errors.length === 0,
    errors,
    counts,
    status,
    lifecycleState: EXPECTED_STATE,
    implementationStatus: compatibility?.capability_scope?.implementation_status,
    acceptedForImplementation: compatibility?.proof_limits?.accepted_for_implementation,
    acceptedOn: compatibility?.acceptance?.accepted_on,
    runtimeAuthorizationProven: compatibility?.proof_limits?.runtime_authorization_proven,
    killSwitchRuntimeProven: compatibility?.proof_limits?.kill_switch_runtime_proven,
  };
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = validateAlertContextTransportBindingPacket({
    dependencyRoot: process.env.CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT || HERE,
  });
  if (!result.ok) {
    console.error(
      `ALERT-CONTEXT TRANSPORT-BINDING VALIDATION: FAIL (${result.errors.length} error(s))`,
    );
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('ALERT-CONTEXT TRANSPORT-BINDING VALIDATION: PASS');
    console.log(JSON.stringify(result.counts, null, 2));
  }
  console.log(`LIFECYCLE_STATE=${result.lifecycleState}`);
  console.log(`STATUS=${result.status}`);
  console.log(`IMPLEMENTATION_STATUS=${result.implementationStatus}`);
  console.log(`ACCEPTED_FOR_IMPLEMENTATION=${result.acceptedForImplementation}`);
  console.log(`ACCEPTED_ON=${result.acceptedOn}`);
  console.log(`RUNTIME_AUTHORIZATION_PROVEN=${result.runtimeAuthorizationProven}`);
  console.log(`KILL_SWITCH_RUNTIME_PROVEN=${result.killSwitchRuntimeProven}`);
}
