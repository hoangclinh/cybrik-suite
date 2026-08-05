import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import {
  formatTopologyRehearsalReport,
  isMainModule,
  PINNED_TOPOLOGY_STATE,
  validateTopologyRehearsals as validateTopologyRehearsalsRaw,
} from '../validate-topology-rehearsal.mjs';
// Namespace import for the not-yet-implemented C4 cross-byte helper: a named import of
// a missing export is an ESM link-time error that would abort the whole module, so the
// C3 RED gate reads the export off the namespace and fails as a plain assertion instead.
import * as topologyRehearsal from '../validate-topology-rehearsal.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const SCHEMA_PATH = 'docs/uat/topology-rehearsal.schema.json';
const POLICY_PATH = 'docs/uat/topology-rehearsal-policy.json';
const TRUST_PATH = 'docs/uat/topology-rehearsal-authorization-trust.json';
const ALLOWED_SIGNERS_PATH = 'docs/uat/topology-rehearsal-allowed-signers';
const MASTER_TRUST_PATH =
  'integration/compose/soc-ai-fabric-alert-context-mtls/authorization-trust.json';
const AUTHORIZATION_NAMESPACE = 'cybrik-uat-topology-rehearsal-v1';
const TOPOLOGY_ROOT = 'docs/uat/topology-rehearsals';
const VALIDATOR_PATH = 'tools/contract-validation/validate-topology-rehearsal.mjs';
const RECORD_ID = 'postgres-loopback-internal-v1-r1';
const SERIES_ID = 'postgres-loopback-internal-v1';
const RECORD_DIR = `${TOPOLOGY_ROOT}/${RECORD_ID}`;
const RECORD_PATH = `${RECORD_DIR}/topology-rehearsal.json`;
const NC_SHA = '427423db6d5d5e9f720c5e110a2c9b3cba39ea089dafed4ab936d04dd218bdac';

const CANDIDATES_ROOT = 'docs/uat/candidates';
const CANDIDATE_DIR = `${CANDIDATES_ROOT}/browser-integrated-uat-bridge-r1`;
const CANDIDATE_DIAGNOSIS_PATH =
  `${CANDIDATE_DIR}/G-U2B-POSTGRES-RUNTIME-TOPOLOGY-DIAGNOSIS-R1.md`;
const CANDIDATE_REVIEW_PATH =
  `${CANDIDATE_DIR}/G-U2B-POSTGRES-RUNTIME-TOPOLOGY-DIAGNOSIS-REVIEW-R1.md`;
const CANDIDATE_DIAGNOSIS_SHA256 =
  'b4d9e8cd0ff34b5a99d9b8b3e04419c27b1927d6e61d146d7658454a74c73874';
const CANDIDATE_REVIEW_SHA256 =
  'bba21165cbf1489bed58d5d583577515efa1217ab36982be18f837b32fe532c7';
const REGISTRY_README_PATH = `${TOPOLOGY_ROOT}/README.md`;
const CONTRACT_VALIDATION_README_PATH = 'tools/contract-validation/README.md';
const SUITE_VALIDATOR_PATH = 'tools/contract-validation/validate.mjs';
const STALE_ZERO_RECORD_PROSE = [
  /zero prepared records/iu,
  /no record exists yet/iu,
];
const PROPOSED_RECORD_PROSE = /one proposed HOLD record/iu;

// Reviewed review-scope hardening: the single topology artifact kind
// independent_review is split into a diagnosis-scoped diagnosis_review and a
// record-scoped record_review, and every phase inventory is exhaustive.
const PROPOSED_ARTIFACT_KINDS = ['diagnosis', 'diagnosis_review'];
const AUTHORIZED_ARTIFACT_KINDS = [
  ...PROPOSED_ARTIFACT_KINDS,
  'record_review',
  'grant',
  'authorization_signature',
];
const CLOSED_ARTIFACT_KINDS = [
  ...AUTHORIZED_ARTIFACT_KINDS,
  'result',
  'evidence_manifest',
  'result_review',
];
const SCHEMA_ARTIFACT_KINDS = CLOSED_ARTIFACT_KINDS;
const RETIRED_ARTIFACT_KIND = 'independent_review';
const RECORD_REVIEW_BINDING_KEYS = [
  'review_path',
  'review_sha256',
  'reviewed_phase',
  'reviewed_record_sha256',
];
const RETIRED_ARTIFACT_KIND_TERM = /\bindependent_review\b/u;
const RECORD_REVIEW_TERM = /\brecord_review\b/u;
const RECORD_LEVEL_REVIEW_PROSE = /record-level review/iu;
const RECORD_REVIEW_TRUTH_PROSE_PATHS = [
  REGISTRY_README_PATH,
  CONTRACT_VALIDATION_README_PATH,
];
const RETIRED_TERM_TRUTH_PATHS = [
  SCHEMA_PATH,
  POLICY_PATH,
  RECORD_PATH,
  REGISTRY_README_PATH,
  CONTRACT_VALIDATION_README_PATH,
  SUITE_VALIDATOR_PATH,
  VALIDATOR_PATH,
];
const inventoryFinding = (phase) =>
  `${phase} topology artifact inventory must exactly equal the reviewed phase inventory`;
const bindingRequiredFinding = (phase) =>
  `${phase} topology record requires a record review binding`;
const BINDING_FORBIDDEN_FINDING =
  'proposed topology record cannot carry a record review binding';
const BINDING_MISMATCH_FINDING =
  'record review binding must bind the listed record_review artifact path and digest';
// C4 cross-byte record-review binding findings. The self-attestation finding closes the
// cryptographic fixed point: a binding digest cannot name the bytes that carry it, since
// writing the field changes those bytes. The pinned-proposed finding requires the binding
// to name the prior-state proposed record digest pinned in the policy state history.
const RECORD_REVIEW_SELF_ATTESTATION_FINDING =
  'record review cannot attest the record bytes that contain it';
const RECORD_REVIEW_PINNED_PROPOSED_FINDING =
  'record review must attest the pinned proposed record bytes';
const HISTORY_LENGTH_FINDING = 'state history must pin every prior phase exactly once';
const INVALID_PRIOR_PIN_FINDING = 'state history contains an invalid prior-state pin';
const UNIQUE_PRIOR_DIGEST_FINDING = 'prior-state record digests must be unique';

// C5 RED constants for the future C6 record-review attestation control. Every finding text
// below is exact: C6 must emit these strings verbatim, path-prefixed.
const RECORD_REVIEW_ATTESTATION_SCHEMA = 'CYBRIK-TOPOLOGY-RECORD-REVIEW/v1';
const RECORD_REVIEW_ATTESTATION_KEYS = [
  'schema',
  'record_path',
  'reviewed_phase',
  'reviewed_record_sha256',
  'reviewer_identity',
  'reviewer_independent_of_record_author',
  'reviewer_mode',
  'decision',
  'findings',
  'grants_execution_authority',
];
const RECORD_REVIEW_MAX_BYTES = 65536;
const RECORD_REVIEW_MAX_FINDINGS = 32;
const DECISION_APPROVED = 'RECORD_BYTES_APPROVED';
const DECISION_REJECTED = 'RECORD_BYTES_REJECTED';
const ATTESTATION_SUFFIX_FINDING =
  'record review artifact must be a .json attestation file';
const ATTESTATION_CANONICAL_FINDING =
  'record review artifact must be bounded canonical JSON bytes';
const ATTESTATION_KEY_INVENTORY_FINDING =
  'record review attestation must use the exact ordered attestation key inventory';
const ATTESTATION_SUBJECT_FINDING =
  'record review attestation must name this record path, schema and the proposed phase';
const ATTESTATION_DIGEST_FINDING =
  'record review attestation digest must equal the record review binding digest';
const ATTESTATION_REVIEWER_FINDING =
  'record review attestation must name an independent read-only reviewer claiming no execution authority';
const ATTESTATION_DECISION_FINDING =
  'record review attestation decision and findings must be exact and consistent';
const ATTESTATION_APPROVAL_FINDING =
  'authorized or closed topology record requires an approved record review of the proposed bytes';
const ATTESTATION_CONTENT_FINDINGS = [
  ATTESTATION_CANONICAL_FINDING,
  ATTESTATION_KEY_INVENTORY_FINDING,
  ATTESTATION_SUBJECT_FINDING,
  ATTESTATION_DIGEST_FINDING,
  ATTESTATION_REVIEWER_FINDING,
  ATTESTATION_DECISION_FINDING,
];
const ALL_ATTESTATION_FINDINGS = [
  ATTESTATION_SUFFIX_FINDING,
  ...ATTESTATION_CONTENT_FINDINGS,
  ATTESTATION_APPROVAL_FINDING,
];
// P2-2 robustness finding: a non-object evidence.artifacts entry must fail closed with one
// finding rather than throwing a TypeError out of the validator.
const ARTIFACT_OBJECT_ENTRY_FINDING = 'artifact entries must be objects';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// Committed-truth helpers: assert presence first so a missing future artifact fails
// as a diagnostic assertion instead of an ENOENT that aborts later assertions.
const readCommittedBytes = (path) => {
  assert.ok(
    existsSync(resolve(ROOT, path)),
    `${path}: expected committed file is missing`,
  );
  return readFileSync(resolve(ROOT, path));
};

const readCommittedRecord = () => {
  const bytes = readCommittedBytes(RECORD_PATH);
  let record = null;
  assert.doesNotThrow(() => {
    record = JSON.parse(bytes.toString('utf8'));
  }, `${RECORD_PATH}: committed record must be valid JSON`);
  return { bytes, record };
};

const readCommittedPolicy = () =>
  JSON.parse(readCommittedBytes(POLICY_PATH).toString('utf8'));

const artifactOfKind = (record, kind) => {
  const entry = (record?.evidence?.artifacts ?? []).find((item) => item?.kind === kind);
  assert.ok(entry, `${RECORD_PATH}: committed record must carry a ${kind} artifact`);
  return entry;
};
const validateTopologyRehearsals = (options = {}) => {
  if (options.root && options.root !== ROOT && !Object.hasOwn(options, 'pinnedState')) {
    let policy = { current_state: null, state_history: [] };
    try {
      policy = JSON.parse(readFileSync(resolve(options.root, POLICY_PATH), 'utf8'));
    } catch {
      // Invalid-policy tests still provide an explicit independent zero-state pin.
    }
    return validateTopologyRehearsalsRaw({
      ...options,
      pinnedState: {
        current_state: policy.current_state ?? null,
        state_history: policy.state_history ?? [],
      },
    });
  }
  return validateTopologyRehearsalsRaw(options);
};
const stableWriteJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const createRoot = () => {
  const root = mkdtempSync(join(os.tmpdir(), 'cybrik-topology-rehearsal-'));
  for (const path of [
    SCHEMA_PATH,
    POLICY_PATH,
    TRUST_PATH,
    ALLOWED_SIGNERS_PATH,
    MASTER_TRUST_PATH,
  ]) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    cpSync(resolve(ROOT, path), resolve(root, path));
  }
  mkdirSync(resolve(root, TOPOLOGY_ROOT), { recursive: true });
  return root;
};

const artifact = (root, directory, kind, content = `${kind}\n`) => {
  const path = `${directory}/${kind}.txt`;
  mkdirSync(resolve(root, directory), { recursive: true });
  writeFileSync(resolve(root, path), content, 'utf8');
  return { kind, path, sha256: sha256(content) };
};

const installSignedAuthorization = (root, directory, artifacts) => {
  const keyRoot = mkdtempSync(join(root, '.topology-authorization-key-'));
  const keyPath = join(keyRoot, 'key');
  execFileSync('/usr/bin/ssh-keygen', [
    '-q', '-t', 'ed25519', '-N', '', '-f', keyPath,
  ]);
  const [keyType, encodedKey] = readFileSync(`${keyPath}.pub`, 'utf8')
    .trim()
    .split(/\s+/u);
  const allowedSigners =
    `FOUNDER namespaces="${AUTHORIZATION_NAMESPACE}" ${keyType} ${encodedKey}\n`;
  const allowedSignersSha256 = sha256(allowedSigners);
  const keyFingerprint = `SHA256:${createHash('sha256')
    .update(Buffer.from(encodedKey, 'base64'))
    .digest('base64')
    .replace(/=+$/u, '')}`;
  writeFileSync(resolve(root, ALLOWED_SIGNERS_PATH), allowedSigners, 'utf8');
  stableWriteJson(resolve(root, TRUST_PATH), {
    schema: 'CYBRIK-UAT-TOPOLOGY-AUTHORIZATION-TRUST/v1',
    signer: 'FOUNDER',
    namespace: AUTHORIZATION_NAMESPACE,
    key_type: keyType,
    key_fingerprint: keyFingerprint,
    allowed_signers_path: ALLOWED_SIGNERS_PATH,
    allowed_signers_sha256: allowedSignersSha256,
  });
  stableWriteJson(resolve(root, MASTER_TRUST_PATH), {
    allowed_signers_sha256: '0'.repeat(64),
    key_fingerprint: keyFingerprint,
    key_type: keyType,
    namespace: 'cybrik-uat-soc-ai-fabric-v1',
    python_sha256: '0'.repeat(64),
    schema: 'CYBRIK-UAT-SSH-AUTHORIZATION-TRUST/v1',
    signer: 'FOUNDER',
  });

  const grant = artifacts.find((entry) => entry.kind === 'grant');
  const grantAbsolute = resolve(root, grant.path);
  execFileSync('/usr/bin/ssh-keygen', [
    '-Y', 'sign', '-f', keyPath, '-n', AUTHORIZATION_NAMESPACE, grantAbsolute,
  ], { stdio: 'ignore' });
  const signaturePath = `${grant.path}.sig`;
  const signatureBytes = readFileSync(resolve(root, signaturePath));
  const signature = {
    kind: 'authorization_signature',
    path: signaturePath,
    sha256: sha256(signatureBytes),
  };
  artifacts.push(signature);
  return {
    signer: 'FOUNDER',
    namespace: AUTHORIZATION_NAMESPACE,
    grant_path: grant.path,
    grant_sha256: grant.sha256,
    signature_path: signature.path,
    signature_sha256: signature.sha256,
    allowed_signers_path: ALLOWED_SIGNERS_PATH,
    allowed_signers_sha256: allowedSignersSha256,
    trust_path: TRUST_PATH,
  };
};

// The record review reviews the proposed record bytes, so its binding pins the
// same synthetic proposed-state digest that the prior-state history pins.
const proposedStateDigest = (recordId) => sha256(`${recordId}:proposed\n`);

const recordReviewBinding = (recordId, reviewArtifact) => ({
  review_path: reviewArtifact.path,
  review_sha256: reviewArtifact.sha256,
  reviewed_phase: 'proposed',
  reviewed_record_sha256: proposedStateDigest(recordId),
});

// ---------------------------------------------------------------------------
// C5 RED fixture algebra for the future C6 record-review attestation.
//
// Every transformation below is pure: helpers return new values and never mutate a
// caller-supplied object, array or Buffer, so a case table cannot leak state into the
// next case.
// ---------------------------------------------------------------------------
const DEFAULT_REVIEWED_RECORD_SHA256 = sha256('c5-default-proposed-record-bytes\n');
const DEFAULT_REVIEWER_IDENTITY = 'CODEX-INDEPENDENT-RECORD-REVIEWER';

const attestationValue = ({
  recordPath = RECORD_PATH,
  reviewedRecordSha256 = DEFAULT_REVIEWED_RECORD_SHA256,
  reviewerIdentity = DEFAULT_REVIEWER_IDENTITY,
  findings = [],
  decision = findings.length === 0 ? DECISION_APPROVED : DECISION_REJECTED,
} = {}) => ({
  schema: RECORD_REVIEW_ATTESTATION_SCHEMA,
  record_path: recordPath,
  reviewed_phase: 'proposed',
  reviewed_record_sha256: reviewedRecordSha256,
  reviewer_identity: reviewerIdentity,
  reviewer_independent_of_record_author: true,
  reviewer_mode: 'read_only',
  decision,
  findings,
  grants_execution_authority: false,
});

const attestationFinding = (id, severity = 'P1', summary = 'reviewed record bytes finding') =>
  ({ id, severity, summary });

// Spread keeps the position of every replaced key and appends genuinely new keys, so
// `withFields` models a field edit and an extra-key injection without reordering.
const withFields = (value, patch) => ({ ...value, ...patch });
const withoutField = (value, key) =>
  Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
const withKeyOrder = (value, keys) =>
  Object.fromEntries(keys.map((key) => [key, value[key]]));
const canonicalBytes = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const canonicalText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const canonicalApprovedBytes = (options = {}) => canonicalBytes(attestationValue(options));

const replaceArtifactOfKind = (artifacts, kind, value) =>
  artifacts.map((entry) => (entry?.kind === kind ? value : entry));
const withArtifacts = (record, artifacts) => ({
  ...record,
  evidence: { ...record.evidence, artifacts },
});
const withRecordReviewBinding = (record, patch) => ({
  ...record,
  evidence: {
    ...record.evidence,
    record_review_binding: { ...record.evidence.record_review_binding, ...patch },
  },
});

const priorStatePin = (phase, recordSha256) => ({
  phase,
  attempt_consumed: false,
  outcome: 'not_run',
  record_sha256: recordSha256,
});

// The record_review artifact is the one artifact whose bytes C6 machine-checks, so the
// synthetic fixture writes a real canonical `.json` attestation instead of placeholder
// text. `fileName` and `bytes` let a case install a deliberately non-conforming review.
const writeRecordReviewArtifact = (root, directory, recordId, {
  fileName = 'record_review.json',
  bytes = null,
  attestation = {},
} = {}) => {
  const content = bytes ?? canonicalApprovedBytes({
    recordPath: `${TOPOLOGY_ROOT}/${recordId}/topology-rehearsal.json`,
    reviewedRecordSha256: proposedStateDigest(recordId),
    ...attestation,
  });
  const path = `${directory}/${fileName}`;
  mkdirSync(resolve(root, directory), { recursive: true });
  writeFileSync(resolve(root, path), content);
  return { kind: 'record_review', path, sha256: sha256(content) };
};

// ---------------------------------------------------------------------------
// C8 exact-action grant fixture.
//
// The grant artifact of an authorized or closed record is a real canonical C8 grant
// document, not placeholder text, so the synthetic root exercises the mandatory grant
// branch end to end instead of an SSHSIG-only shortcut. `fileName`, `bytes` and `grant`
// let a case install a deliberately non-conforming grant. Every helper is pure: it returns
// new values and never mutates a caller-supplied object.
// ---------------------------------------------------------------------------
const GRANT_SCHEMA_VERSION = 'CYBRIK-TOPOLOGY-REHEARSAL-GRANT/v1';
const AUTHORIZED_ACTION = 'topology_rehearsal_single_attempt';
// The record's own deterministic admission instant, and one 180-second window that contains
// it. Admission is judged from the record bytes, never from a wall clock.
const RECORDED_AT = '2026-08-04T12:00:00Z';
const GRANT_WINDOW = Object.freeze({
  not_before: '2026-08-04T11:59:00Z',
  expires_at: '2026-08-04T12:02:00Z',
  runtime_limit_seconds: 180,
  extension_cycles: 0,
});
const GRANT_OBSERVED_AT = '2026-08-04T11:59:30Z';
const GRANT_CONTROL_REPOSITORIES = [
  'cybrik-suite',
  'cybrik-soc-command-center',
  'cybrik-cyber-ai-platform',
  'cybrik-security-tool-fabric',
];
const grantImageIdentity = () => ({
  repository: 'postgres',
  tag: '16-alpine',
  platform: { os: 'linux', architecture: 'arm64', variant: null },
  index_digest: `sha256:${'3'.repeat(64)}`,
  manifest_digest: `sha256:${'4'.repeat(64)}`,
});

const grantValue = ({ recordId = RECORD_ID, ...overrides } = {}) => ({
  schema: GRANT_SCHEMA_VERSION,
  record: { path: RECORD_PATH, sha256: proposedStateDigest(recordId) },
  runner: { aggregate_sha256: sha256('topology-grant-runner-aggregate\n') },
  topology: {
    host_ip: '127.0.0.1',
    host_port: 15433,
    container_port: 5432,
    protocol: 'tcp',
    internal_network: true,
    publish_spec: '127.0.0.1:15433:5432/tcp',
  },
  selected_image_identity: { ...grantImageIdentity(), pull_policy: 'never' },
  observed_image_identity: {
    ...grantImageIdentity(),
    local_image_id: `sha256:${'5'.repeat(64)}`,
    observed_at: GRANT_OBSERVED_AT,
  },
  repositories: Object.fromEntries(GRANT_CONTROL_REPOSITORIES.map((name, index) => [name, {
    commit: String(index + 1).repeat(40),
    tree: ['a', 'b', 'c', 'd'][index].repeat(40),
    clean: true,
  }])),
  tools: {
    docker: {
      path: '/usr/local/bin/docker',
      sha256: sha256('topology-grant-docker\n'),
      version: '29.6.2',
    },
    probe: { path: '/usr/bin/nc', sha256: NC_SHA, argv: ['-z', '-w', '5', '127.0.0.1', '15433'] },
  },
  window: { ...GRANT_WINDOW },
  attempt: { ordinal: 1, max_attempts: 1 },
  authorizes: AUTHORIZED_ACTION,
  grants_no_authority: {
    demo: true,
    merge: true,
    product_runtime: true,
    production: true,
    release: true,
    uat: true,
  },
  ...overrides,
});

const writeGrantArtifact = (root, directory, recordId, {
  fileName = 'grant.json',
  bytes = null,
  grant = {},
} = {}) => {
  const content = bytes ?? canonicalBytes(grantValue({ recordId, ...grant }));
  const path = `${directory}/${fileName}`;
  mkdirSync(resolve(root, directory), { recursive: true });
  writeFileSync(resolve(root, path), content);
  return { kind: 'grant', path, sha256: sha256(content) };
};

// Exact C8 record-path finding texts.
const GRANT_ARTIFACT_SUFFIX_FINDING =
  'grant artifact must be a .json exact-action grant document';
const GRANT_ADMISSION_INSTANT_FINDING =
  'record recorded_at must be one representable UTC instant to admit an exact-action grant';
const GRANT_CANONICAL_BYTES_FINDING =
  'grant bytes must be exact canonical JSON: JSON.stringify(value, null, 2) plus one LF, UTF-8, no BOM and no trailing bytes';
const GRANT_RECORD_BINDING_FINDING =
  'grant record binding must name the exact pinned proposed prior-state record digest';
const GRANT_AUTHORIZES_FINDING = `grant must authorize exactly ${AUTHORIZED_ACTION}`;
const GRANT_WINDOW_ADMISSION_FINDING =
  'now must be inside the authorized grant window, closed at not_before and open at expires_at';
const FOUNDER_SIGNATURE_FINDING =
  'authorized or closed topology record requires a verified Founder SSHSIG';
const grantDocumentError = (finding) => `${RECORD_PATH}: grant document: ${finding}`;

const buildRecord = (root, {
  recordId = RECORD_ID,
  seriesId = SERIES_ID,
  phase = 'proposed',
  recordedAt = RECORDED_AT,
  grantArtifact = {},
  executionAuthorized = false,
  attemptConsumed = false,
  outcome = 'not_run',
  teardownVerified = null,
  residualResources = null,
  externalManifestLocallyVerified = null,
  recordReview = {},
} = {}) => {
  const directory = `${TOPOLOGY_ROOT}/${recordId}`;
  const artifacts = [
    artifact(root, directory, 'diagnosis'),
    artifact(root, directory, 'diagnosis_review'),
  ];
  let binding = null;
  if (phase !== 'proposed') {
    const review = writeRecordReviewArtifact(root, directory, recordId, recordReview);
    artifacts.push(review);
    binding = recordReviewBinding(recordId, review);
  }
  if (phase !== 'proposed') {
    artifacts.push(writeGrantArtifact(root, directory, recordId, grantArtifact));
  }
  if (phase === 'closed') {
    artifacts.push(artifact(root, directory, 'result'));
    artifacts.push(artifact(root, directory, 'evidence_manifest'));
    artifacts.push(artifact(root, directory, 'result_review'));
  }
  const record = {
    schema_version: '1.0.0',
    record_id: recordId,
    recorded_at: recordedAt,
    identity: {
      capability_id: 'cybrik.suite.runtime-topology',
      objective_id: 'postgres-loopback-internal-v1',
    },
    attempt: {
      series_id: seriesId,
      attempt_ordinal: 1,
      max_attempts: 1,
      phase,
      execution_authorized: executionAuthorized,
      attempt_consumed: attemptConsumed,
      outcome,
    },
    topology: {
      host_ip: '127.0.0.1',
      host_port: 15433,
      container_port: 5432,
      internal_network: true,
      runtime_limit_seconds: 180,
      extension_cycles: 0,
      image: {
        resolution_state: 'UNRESOLVED',
        repository: 'postgres',
        tag: '16-alpine',
        platform: null,
        index_digest: null,
        manifest_digest: null,
        pull_policy: 'never',
      },
      probe: {
        executable_path: '/usr/bin/nc',
        executable_sha256: NC_SHA,
        argv: ['-z', '-w', '5', '127.0.0.1', '15433'],
      },
    },
    production_exclusion: {
      no_production_credentials: true,
      no_production_configuration: true,
      no_production_data: true,
      no_production_traffic: true,
    },
    authorization: null,
    evidence: {
      directory,
      external_bytes_ci_verified: false,
      artifacts,
      record_review_binding: binding,
      result_controls: phase === 'closed'
        ? {
            teardown_verified: teardownVerified,
            residual_resources: residualResources,
            external_manifest_locally_verified: externalManifestLocallyVerified,
          }
        : null,
    },
    disposition: {
      profile: 'HOLD',
      rationale: 'Topology-only preflight; no UAT, demo, release or production authority.',
    },
  };
  if (phase !== 'proposed') {
    record.authorization = installSignedAuthorization(root, directory, artifacts);
  }
  return record;
};

const stateHistoryFor = (record) => {
  if (!record.attempt) return [];
  const proposed = {
    phase: 'proposed',
    attempt_consumed: false,
    outcome: 'not_run',
    record_sha256: proposedStateDigest(record.record_id),
  };
  if (record.attempt.phase === 'proposed') return [];
  if (record.attempt.phase === 'authorized') {
    return [proposed];
  }
  return [
    proposed,
    {
      phase: 'authorized',
      attempt_consumed: false,
      outcome: 'not_run',
      record_sha256: sha256(`${record.record_id}:authorized\n`),
    },
  ];
};

// stateHistory overrides the derived prior-state pins so a test can install a controlled
// policy state (for example a missing proposed pin) without mutating the record source or
// rewriting the policy after the fact. Omitting it preserves the derived default exactly.
const writeRecord = (root, record, { stateHistory } = {}) => {
  const path = `${TOPOLOGY_ROOT}/${record.record_id}/topology-rehearsal.json`;
  stableWriteJson(resolve(root, path), record);
  const policy = JSON.parse(readFileSync(resolve(root, POLICY_PATH), 'utf8'));
  if (Object.hasOwn(policy, 'current_state')) {
    policy.current_state = {
      record_id: record.record_id,
      record_sha256: sha256(readFileSync(resolve(root, path))),
      phase: record.attempt?.phase,
      attempt_consumed: record.attempt?.attempt_consumed,
      outcome: record.attempt?.outcome,
      grant_sha256: record.authorization?.grant_sha256 ?? null,
    };
    policy.state_history = stateHistory ?? stateHistoryFor(record);
    stableWriteJson(resolve(root, POLICY_PATH), policy);
  }
  return path;
};

const withRoot = async (fn) => {
  const root = createRoot();
  try {
    await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('committed topology registry holds one proposed record and still grants no authority', () => {
  const report = validateTopologyRehearsals({ root: ROOT });
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.records, 1);
  assert.equal(report.counts.execution_authorized, 0);
  assert.equal(report.counts.closed, 0);
  const rendered = formatTopologyRehearsalReport(report);
  assert.equal(rendered.exitCode, 0);
  assert.match(rendered.stdout, /records 1, authorized 0, closed 0/u);
  assert.match(rendered.stdout, /static control only/i);
  assert.match(rendered.stdout, /no runtime, UAT, demo, release or production authority/i);
  assert.doesNotMatch(rendered.stdout, /TOPOLOGY_PASS|docker|executed|verified runtime/iu);
});

test('the committed machine record is proposed, HOLD, unauthorized and production-excluded', () => {
  const { record } = readCommittedRecord();
  assert.equal(record.record_id, RECORD_ID);
  assert.equal(record.identity?.capability_id, 'cybrik.suite.runtime-topology');
  assert.equal(record.identity?.objective_id, SERIES_ID);
  assert.equal(record.attempt?.series_id, SERIES_ID);
  assert.equal(record.attempt?.attempt_ordinal, 1);
  assert.equal(record.attempt?.max_attempts, 1);
  assert.equal(record.attempt?.phase, 'proposed');
  assert.equal(record.attempt?.execution_authorized, false);
  assert.equal(record.attempt?.attempt_consumed, false);
  assert.equal(record.attempt?.outcome, 'not_run');
  assert.equal(record.authorization, null);
  assert.equal(record.evidence?.directory, RECORD_DIR);
  assert.equal(record.evidence?.external_bytes_ci_verified, false);
  assert.equal(record.evidence?.result_controls, null);
  assert.equal(record.disposition?.profile, 'HOLD');
  assert.deepEqual(record.production_exclusion, {
    no_production_credentials: true,
    no_production_configuration: true,
    no_production_data: true,
    no_production_traffic: true,
  });
});

test('committed policy current state binds the exact record bytes in exact six-key order', () => {
  const { bytes } = readCommittedRecord();
  const policy = readCommittedPolicy();
  assert.ok(policy.current_state, `${POLICY_PATH}: current_state must pin the proposed record`);
  assert.deepEqual(Object.keys(policy.current_state), [
    'record_id',
    'record_sha256',
    'phase',
    'attempt_consumed',
    'outcome',
    'grant_sha256',
  ]);
  assert.equal(policy.current_state.record_id, RECORD_ID);
  assert.equal(policy.current_state.record_sha256, sha256(bytes));
  assert.equal(policy.current_state.phase, 'proposed');
  assert.equal(policy.current_state.attempt_consumed, false);
  assert.equal(policy.current_state.outcome, 'not_run');
  assert.equal(policy.current_state.grant_sha256, null);
  assert.deepEqual(policy.state_history, []);
});

test('PINNED_TOPOLOGY_STATE exactly mirrors the committed policy state', () => {
  const policy = readCommittedPolicy();
  assert.equal(
    JSON.stringify({
      current_state: policy.current_state ?? null,
      state_history: policy.state_history ?? [],
    }),
    JSON.stringify({
      current_state: PINNED_TOPOLOGY_STATE.current_state,
      state_history: PINNED_TOPOLOGY_STATE.state_history,
    }),
  );
  assert.notEqual(PINNED_TOPOLOGY_STATE.current_state, null);
});

test('the live pinned state accepts the exact committed record and rejects one-byte drift', async () => {
  const { bytes } = readCommittedRecord();
  await withRoot((root) => {
    cpSync(resolve(ROOT, RECORD_DIR), resolve(root, RECORD_DIR), { recursive: true });
    const exact = validateTopologyRehearsalsRaw({
      root,
      pinnedState: PINNED_TOPOLOGY_STATE,
    });
    assert.deepEqual(exact.errors, []);

    writeFileSync(resolve(root, RECORD_PATH), Buffer.concat([bytes, Buffer.from('\n')]));
    const drifted = validateTopologyRehearsalsRaw({
      root,
      pinnedState: PINNED_TOPOLOGY_STATE,
    });
    assert.ok(drifted.errors.some((error) =>
      error.includes('current state must bind the exact record bytes and phase')));
  });
});

test('in-directory diagnosis and review artifacts are byte-identical to the reviewed sources', () => {
  const { record } = readCommittedRecord();
  const cases = [
    ['diagnosis', CANDIDATE_DIAGNOSIS_PATH, CANDIDATE_DIAGNOSIS_SHA256],
    ['diagnosis_review', CANDIDATE_REVIEW_PATH, CANDIDATE_REVIEW_SHA256],
  ];
  for (const [kind, sourcePath, sourceSha256] of cases) {
    const entry = artifactOfKind(record, kind);
    assert.ok(
      entry.path.startsWith(`${RECORD_DIR}/`),
      `${kind}: artifact must live inside the record directory`,
    );
    const sourceBytes = readCommittedBytes(sourcePath);
    assert.equal(sha256(sourceBytes), sourceSha256, sourcePath);
    const inDirectoryBytes = readCommittedBytes(entry.path);
    assert.ok(inDirectoryBytes.equals(sourceBytes), `${entry.path}: must be byte-identical to ${sourcePath}`);
    assert.equal(entry.sha256, sha256(inDirectoryBytes), `${entry.path}: digest must match bytes`);
  }
});

test('the committed diagnosis provenance digest equals the reviewed candidate diagnosis digest', () => {
  const { record } = readCommittedRecord();
  assert.equal(artifactOfKind(record, 'diagnosis').sha256, CANDIDATE_DIAGNOSIS_SHA256);
  assert.equal(sha256(readCommittedBytes(CANDIDATE_DIAGNOSIS_PATH)), CANDIDATE_DIAGNOSIS_SHA256);
});

test('the proposed artifact inventory is exactly diagnosis and diagnosis review', () => {
  const { record } = readCommittedRecord();
  const kinds = (record.evidence?.artifacts ?? []).map((entry) => entry.kind);
  assert.deepEqual([...kinds].sort(), [...PROPOSED_ARTIFACT_KINDS].sort());
  for (const forbidden of [
    'record_review',
    'grant',
    'authorization_signature',
    'result',
    'evidence_manifest',
    'result_review',
  ]) assert.ok(!kinds.includes(forbidden), `proposed record must not carry a ${forbidden} artifact`);
});

test('stale zero-record prose is replaced in registry, tooling and suite validator truth', () => {
  for (const path of [
    REGISTRY_README_PATH,
    CONTRACT_VALIDATION_README_PATH,
    SUITE_VALIDATOR_PATH,
  ]) {
    const text = readCommittedBytes(path).toString('utf8');
    for (const stale of STALE_ZERO_RECORD_PROSE) {
      assert.doesNotMatch(text, stale, `${path}: stale zero-record prose must be removed`);
    }
    assert.match(text, PROPOSED_RECORD_PROSE, `${path}: must state the one proposed HOLD record`);
  }
});

test('no runtime-admission candidate cites a topology prerequisite while the record stays open', () => {
  const candidatePaths = readdirSync(resolve(ROOT, CANDIDATES_ROOT), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${CANDIDATES_ROOT}/${entry.name}/runtime-admission.json`)
    .filter((path) => existsSync(resolve(ROOT, path)));
  assert.ok(candidatePaths.length > 0, `${CANDIDATES_ROOT}: expected runtime-admission candidates`);
  for (const path of candidatePaths) {
    assert.doesNotMatch(
      readFileSync(resolve(ROOT, path), 'utf8'),
      /topology_prerequisite/u,
      `${path}: topology prerequisite requires its own separately reviewed gate`,
    );
  }
  const { record } = readCommittedRecord();
  assert.notEqual(record.attempt?.phase, 'closed');
  assert.notEqual(record.attempt?.outcome, 'TOPOLOGY_PASS');
});

test('one exact proposed singleton record validates while remaining HOLD', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root));
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.records, 1);
    assert.equal(report.counts.execution_authorized, 0);
    assert.equal(report.counts.closed, 0);
  });
});

test('the only authorized shape is one unconsumed not-run record with a grant', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
    });
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.execution_authorized, 1);

    record.attempt.attempt_consumed = true;
    writeRecord(root, record);
    const invalid = validateTopologyRehearsals({ root });
    assert.ok(invalid.errors.some((error) =>
      error.includes('authorized topology record must be not_run and unconsumed')));
  });
});

test('every terminal outcome has exact consumption and teardown semantics', async () => {
  const cases = [
    ['PRECHECK_ABORT', false],
    ['TOPOLOGY_PASS', true],
    ['FAIL_PUBLICATION', true],
    ['FAIL_INTERNAL_INGRESS', true],
    ['STOP_CONTROL', true],
  ];
  for (const [outcome, consumed] of cases) {
    await withRoot((root) => {
      const record = buildRecord(root, {
        phase: 'closed',
        outcome,
        attemptConsumed: consumed,
        teardownVerified: true,
        residualResources: 0,
        externalManifestLocallyVerified: true,
      });
      writeRecord(root, record);
      const report = validateTopologyRehearsals({ root });
      assert.deepEqual(report.errors, [], outcome);
      assert.equal(report.counts.closed, 1);
      assert.equal(report.counts.execution_authorized, 0);
    });
  }
});

test('closed records fail on wrong consumption, residual resources, or missing local manifest review', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'closed',
      outcome: 'TOPOLOGY_PASS',
      attemptConsumed: false,
      teardownVerified: false,
      residualResources: 1,
      externalManifestLocallyVerified: false,
    });
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('consumed outcome must consume')));
    assert.ok(report.errors.some((error) => error.includes('closed topology record requires verified teardown')));
    assert.ok(report.errors.some((error) => error.includes('closed topology record requires zero residual resources')));
    assert.ok(report.errors.some((error) => error.includes('external evidence manifest requires independent local verification')));
  });
});

test('a second record, alias, ordinal, or policy drift fails closed', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root));
    writeRecord(root, buildRecord(root, {
      recordId: 'postgres-loopback-internal-v1-r2',
      seriesId: 'postgres-loopback-internal-v1-alias',
    }));
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('topology policy permits only the exact singleton record')));

    const policy = JSON.parse(readFileSync(resolve(root, POLICY_PATH), 'utf8'));
    policy.allowed_records.push({ ...policy.allowed_records[0], record_id: 'evil-r2' });
    stableWriteJson(resolve(root, POLICY_PATH), policy);
    const drifted = validateTopologyRehearsals({ root });
    assert.ok(drifted.errors.some((error) => error.includes('policy must exactly match the validator-pinned singleton')));
  });
});

test('mislocated and symlinked machine records are rejected', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    const nested = `${RECORD_DIR}/nested/topology-rehearsal.json`;
    stableWriteJson(resolve(root, nested), record);
    let report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('mislocated topology-rehearsal.json')));

    rmSync(resolve(root, RECORD_DIR), { recursive: true, force: true });
    mkdirSync(resolve(root, RECORD_DIR), { recursive: true });
    const outside = resolve(root, 'outside-topology-rehearsal.json');
    stableWriteJson(outside, record);
    symlinkSync(outside, resolve(root, RECORD_PATH));
    report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('symlink entries are forbidden')));
  });
});

test('artifact containment, digest integrity, and external-evidence honesty fail closed', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.evidence.external_bytes_ci_verified = true;
    record.evidence.artifacts[0].sha256 = '0'.repeat(64);
    record.evidence.artifacts[1].path = '../outside-review.txt';
    writeFileSync(resolve(root, 'docs/uat/outside-review.txt'), 'outside\n', 'utf8');
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('external bytes cannot be claimed as CI verified')));
    assert.ok(report.errors.some((error) => error.includes('artifact sha256 must match')));
    assert.ok(report.errors.some((error) => error.includes('artifacts must stay inside the record directory')));
  });
});

test('fixed loopback, internal network, bounded cycle, and exact probe argv are immutable', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.topology.host_ip = '0.0.0.0';
    record.topology.host_port = 55433;
    record.topology.internal_network = false;
    record.topology.runtime_limit_seconds = 600;
    record.topology.extension_cycles = 1;
    record.topology.probe.argv = ['127.0.0.1', '15433'];
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    for (const expected of [
      'host_ip must be exact loopback',
      'host_port must be the reviewed fixed port',
      'network must remain internal',
      'runtime limit must remain one 180-second cycle',
      'extension cycles must remain zero',
      'probe argv must exactly match the reviewed bounded TCP probe',
    ]) assert.ok(report.errors.some((error) => error.includes(expected)), expected);
  });
});

test('unknown authority and production fields are rejected by the schema', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.production_authorized = true;
    record.disposition.profile = 'DEMO_READY_LOCAL';
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('schema / must NOT have additional properties')));
    assert.ok(report.errors.some((error) => error.includes('schema /disposition/profile must be equal to constant')));
  });
});

test('schema-invalid records return fail-closed findings instead of crashing', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    delete record.attempt;
    delete record.evidence;
    writeRecord(root, record);
    let report;
    assert.doesNotThrow(() => {
      report = validateTopologyRehearsals({ root });
    });
    assert.ok(report.errors.some((error) => error.includes("schema / must have required property 'attempt'")));
    assert.ok(report.errors.some((error) => error.includes("schema / must have required property 'evidence'")));
  });
});

test('proposed and authorized phase contradictions fail closed', async () => {
  await withRoot((root) => {
    const proposed = buildRecord(root);
    proposed.attempt.execution_authorized = true;
    proposed.evidence.result_controls = {
      teardown_verified: true,
      residual_resources: 0,
      external_manifest_locally_verified: true,
    };
    proposed.evidence.artifacts.push(artifact(root, RECORD_DIR, 'grant'));
    writeRecord(root, proposed);
    let report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('proposed topology record must be not_run and unauthorized')));
    assert.ok(report.errors.some((error) => error.includes('proposed topology record cannot carry result controls')));
    assert.ok(report.errors.some((error) => error.includes('proposed topology record cannot carry grant or result artifacts')));

    const authorized = buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
    });
    authorized.evidence.artifacts = authorized.evidence.artifacts.filter(
      (entry) => entry.kind !== 'grant',
    );
    authorized.evidence.artifacts.push(artifact(root, RECORD_DIR, 'result'));
    authorized.evidence.result_controls = {
      teardown_verified: true,
      residual_resources: 0,
      external_manifest_locally_verified: true,
    };
    writeRecord(root, authorized);
    report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('authorized topology record cannot carry result controls')));
    assert.ok(report.errors.some((error) => error.includes('required grant artifact is missing')));
    assert.ok(report.errors.some((error) => error.includes('authorized topology record cannot carry result artifacts')));
  });
});

test('artifact inventory and remaining fixed controls reject drift', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.evidence.artifacts.pop();
    record.evidence.artifacts.push({ ...record.evidence.artifacts[0] });
    record.evidence.artifacts.push({
      kind: 'diagnosis_review',
      path: `${RECORD_DIR}/missing-review.txt`,
      sha256: '0'.repeat(64),
    });
    record.topology.container_port = 15432;
    record.topology.probe.executable_path = '/tmp/nc';
    record.production_exclusion.no_production_traffic = false;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('artifact kind values must be unique')));
    assert.ok(report.errors.some((error) => error.includes('artifact path must be a contained regular file')));
    assert.ok(report.errors.some((error) => error.includes('container_port must remain PostgreSQL 5432')));
    assert.ok(report.errors.some((error) => error.includes('probe executable must remain /usr/bin/nc')));
    assert.ok(report.errors.some((error) => error.includes('every production exclusion must remain true')));
  });
});

test('invalid policy and schema render deterministic failures and main-module checks fail closed', async () => {
  await withRoot((root) => {
    writeFileSync(resolve(root, POLICY_PATH), '{', 'utf8');
    stableWriteJson(resolve(root, SCHEMA_PATH), { type: 'not-a-json-schema-type' });
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('cannot read valid contained JSON')));
    assert.ok(report.errors.some((error) => error.includes('schema compile failed')));
    const rendered = formatTopologyRehearsalReport(report);
    assert.equal(rendered.exitCode, 1);
    assert.match(rendered.stdout, /TOPOLOGY REHEARSAL: FAIL/);
  });
  assert.equal(isMainModule(undefined), false);
  assert.equal(isMainModule('/definitely/missing/validator.mjs'), false);
  assert.equal(
    isMainModule(resolve(ROOT, 'tools/contract-validation/validate-topology-rehearsal.mjs')),
    true,
  );
});

test('artifact roles require distinct paths and distinct byte digests', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    record.evidence.artifacts[1].path = record.evidence.artifacts[0].path;
    record.evidence.artifacts[1].sha256 = record.evidence.artifacts[0].sha256;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('artifact paths must be unique')));
    assert.ok(report.errors.some((error) => error.includes('artifact digests must be unique')));
  });
});

test('a prepared record must match a code-and-policy-pinned current state', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    writeRecord(root, record);
    const recordBytes = readFileSync(resolve(root, RECORD_PATH));
    const currentState = {
      record_id: RECORD_ID,
      record_sha256: sha256(recordBytes),
      phase: 'proposed',
      attempt_consumed: false,
      outcome: 'not_run',
      grant_sha256: null,
    };
    const policy = JSON.parse(readFileSync(resolve(root, POLICY_PATH), 'utf8'));
    policy.current_state = currentState;
    policy.state_history = [];
    stableWriteJson(resolve(root, POLICY_PATH), policy);
    const report = validateTopologyRehearsals({
      root,
      pinnedState: { current_state: currentState, state_history: [] },
    });
    assert.deepEqual(report.errors, []);

    policy.current_state = { ...currentState, attempt_consumed: true };
    stableWriteJson(resolve(root, POLICY_PATH), policy);
    const drifted = validateTopologyRehearsals({
      root,
      pinnedState: { current_state: currentState, state_history: [] },
    });
    assert.ok(drifted.errors.some((error) =>
      error.includes('state policy must exactly match the validator-pinned state')));
  });
});

test('an arbitrary grant cannot self-authorize a topology record', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
    });
    const bytes = Buffer.from('I authorize myself.\n', 'utf8');
    writeFileSync(resolve(root, `${RECORD_DIR}/grant.json`), bytes);
    const grant = record.evidence.artifacts.find((entry) => entry.kind === 'grant');
    grant.sha256 = sha256(bytes);
    record.authorization.grant_sha256 = grant.sha256;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      report.errors.some((error) => error === grantDocumentError(GRANT_CANONICAL_BYTES_FINDING)),
      'free-text grant bytes are refused as a grant document, never self-authorizing',
    );
  });
});

test('null records and symlinked or record-named directories fail with findings, never invisibly pass', async () => {
  await withRoot((root) => {
    mkdirSync(resolve(root, RECORD_DIR), { recursive: true });
    writeFileSync(resolve(root, RECORD_PATH), 'null\n', 'utf8');
    let report;
    assert.doesNotThrow(() => {
      report = validateTopologyRehearsals({ root });
    });
    assert.ok(report.errors.some((error) => error.includes('topology record must be an object')));
  });

  await withRoot((root) => {
    const outside = resolve(root, 'outside-record-directory');
    mkdirSync(outside, { recursive: true });
    stableWriteJson(join(outside, 'topology-rehearsal.json'), buildRecord(root));
    rmSync(resolve(root, RECORD_DIR), { recursive: true, force: true });
    symlinkSync(outside, resolve(root, RECORD_DIR));
    let report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes('symlink entries are forbidden')));

    rmSync(resolve(root, RECORD_DIR), { force: true });
    mkdirSync(resolve(root, RECORD_DIR), { recursive: true });
    mkdirSync(resolve(root, RECORD_PATH), { recursive: true });
    report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('topology-rehearsal.json must be a regular file, not a directory')));
  });
});

test('terminal state checks cover unauthorized closure and unconsumed PRECHECK_ABORT', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'closed',
      outcome: 'PRECHECK_ABORT',
      attemptConsumed: true,
      teardownVerified: true,
      residualResources: 0,
      externalManifestLocallyVerified: true,
    });
    record.attempt.execution_authorized = true;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('closed topology record must be unauthorized with a terminal outcome')));
    assert.ok(report.errors.some((error) => error.includes('PRECHECK_ABORT must remain unconsumed')));
  });
});

test('PRECHECK_ABORT history retains both proposed and authorized phase pins', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'closed',
      outcome: 'PRECHECK_ABORT',
      attemptConsumed: false,
      teardownVerified: true,
      residualResources: 0,
      externalManifestLocallyVerified: true,
    });
    writeRecord(root, record);
    const policy = JSON.parse(readFileSync(resolve(root, POLICY_PATH), 'utf8'));
    policy.state_history = [
      {
        phase: 'proposed',
        attempt_consumed: false,
        outcome: 'not_run',
        record_sha256: sha256(`${record.record_id}:proposed\n`),
      },
      {
        phase: 'authorized',
        attempt_consumed: false,
        outcome: 'not_run',
        record_sha256: sha256(`${record.record_id}:authorized\n`),
      },
    ];
    stableWriteJson(resolve(root, POLICY_PATH), policy);
    const report = validateTopologyRehearsals({
      root,
      pinnedState: {
        current_state: policy.current_state,
        state_history: policy.state_history,
      },
    });
    assert.deepEqual(report.errors, []);
  });
});

test('a non-default root cannot derive its own mutable state pin', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root));
    const report = validateTopologyRehearsalsRaw({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('non-default root requires an explicit independently supplied pinned state')));
  });
});

test('topology policy requires the exact four keys, not only a four-key count', async () => {
  await withRoot((root) => {
    const policy = JSON.parse(readFileSync(resolve(root, POLICY_PATH), 'utf8'));
    delete policy.current_state;
    policy.unexpected = null;
    stableWriteJson(resolve(root, POLICY_PATH), policy);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('policy must exactly match the validator-pinned singleton')));
  });
});

test('the topology registry root itself cannot be a symlink', async () => {
  await withRoot((root) => {
    const externalRoot = resolve(root, 'external-topology-registry');
    mkdirSync(externalRoot, { recursive: true });
    rmSync(resolve(root, TOPOLOGY_ROOT), { recursive: true, force: true });
    symlinkSync(externalRoot, resolve(root, TOPOLOGY_ROOT));
    let report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('topology registry root must be a contained non-symlink directory')));

    rmSync(resolve(root, TOPOLOGY_ROOT), { force: true });
    symlinkSync(resolve(root, 'missing-topology-registry'), resolve(root, TOPOLOGY_ROOT));
    report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('topology registry root must be a contained non-symlink directory')));
  });
});

test('zero-record validation still verifies the committed Founder trust triple', async () => {
  await withRoot((root) => {
    const trust = JSON.parse(readFileSync(resolve(root, TRUST_PATH), 'utf8'));
    trust.allowed_signers_sha256 = '0'.repeat(64);
    stableWriteJson(resolve(root, TRUST_PATH), trust);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('allowed-signers SHA-256 must match the topology trust descriptor')));
  });
});

test('dependency fallback pins the system Git executable instead of trusting PATH', () => {
  const source = readFileSync(resolve(ROOT, VALIDATOR_PATH), 'utf8');
  assert.match(source, /execFileSync\(\s*'\/usr\/bin\/git'/u);
  assert.doesNotMatch(source, /execFileSync\(\s*'git'/u);
});

test('T1 committed schema pins exactly eight artifact kinds, retires independent_review and caps at eight', () => {
  const schema = JSON.parse(readCommittedBytes(SCHEMA_PATH).toString('utf8'));
  const kinds = schema.$defs?.artifact?.properties?.kind?.enum;
  assert.ok(Array.isArray(kinds), `${SCHEMA_PATH}: artifact kind enum must be an array`);
  assert.equal(kinds.length, 8, `${SCHEMA_PATH}: artifact kind enum must hold exactly eight kinds`);
  assert.deepEqual([...kinds].sort(), [...SCHEMA_ARTIFACT_KINDS].sort());
  assert.ok(
    !kinds.includes(RETIRED_ARTIFACT_KIND),
    `${SCHEMA_PATH}: retired ${RETIRED_ARTIFACT_KIND} kind must be absent`,
  );

  const artifacts = schema.properties?.evidence?.properties?.artifacts;
  assert.equal(artifacts?.minItems, 2, `${SCHEMA_PATH}: artifacts minItems must remain 2`);
  assert.equal(artifacts?.maxItems, 8, `${SCHEMA_PATH}: artifacts maxItems must be 8`);

  const evidence = schema.properties?.evidence;
  assert.ok(
    (evidence?.required ?? []).includes('record_review_binding'),
    `${SCHEMA_PATH}: evidence must always require record_review_binding`,
  );
  const binding = schema.$defs?.recordReviewBinding;
  assert.ok(binding, `${SCHEMA_PATH}: schema must define the record review binding shape`);
  assert.equal(binding.additionalProperties, false);
  assert.deepEqual([...(binding.required ?? [])].sort(), [...RECORD_REVIEW_BINDING_KEYS].sort());
  assert.deepEqual(Object.keys(binding.properties ?? {}).sort(), [...RECORD_REVIEW_BINDING_KEYS].sort());
  assert.equal(binding.properties?.reviewed_phase?.const, 'proposed');
});

test('T2 the committed proposed record carries diagnosis plus diagnosis_review and a present null binding', () => {
  const { record } = readCommittedRecord();
  const kinds = (record.evidence?.artifacts ?? []).map((entry) => entry.kind);
  assert.deepEqual(kinds, PROPOSED_ARTIFACT_KINDS);
  assert.ok(
    Object.hasOwn(record.evidence ?? {}, 'record_review_binding'),
    `${RECORD_PATH}: evidence must always carry the record_review_binding key`,
  );
  assert.equal(
    record.evidence.record_review_binding,
    null,
    `${RECORD_PATH}: a proposed record must pin a null record review binding`,
  );
});

test('T3 an authorized record missing its record_review artifact fails closed', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, { phase: 'authorized', executionAuthorized: true });
    record.evidence.artifacts = record.evidence.artifacts.filter(
      (entry) => entry.kind !== 'record_review',
    );
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error.includes('required record_review artifact is missing')));
    assert.ok(report.errors.some((error) => error.includes(inventoryFinding('authorized'))));
  });
});

test('T4 a proposed record smuggling a record_review and its binding fails with two distinct findings', async () => {
  await withRoot((root) => {
    const record = buildRecord(root);
    const review = artifact(root, RECORD_DIR, 'record_review');
    record.evidence.artifacts.push(review);
    record.evidence.record_review_binding = recordReviewBinding(RECORD_ID, review);
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    const findings = report.errors.filter((error) =>
      error.includes(inventoryFinding('proposed')) || error.includes(BINDING_FORBIDDEN_FINDING));
    assert.ok(report.errors.some((error) => error.includes(inventoryFinding('proposed'))));
    assert.ok(report.errors.some((error) => error.includes(BINDING_FORBIDDEN_FINDING)));
    assert.equal(new Set(findings).size, 2, 'record review smuggling must raise two distinct findings');
  });
});

test('T5 an authorized record with a null record review binding fails closed', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, { phase: 'authorized', executionAuthorized: true });
    record.evidence.record_review_binding = null;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes(bindingRequiredFinding('authorized'))));
  });
});

test('T6 the record review binding must bind the listed record_review path and digest', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, { phase: 'authorized', executionAuthorized: true });
    record.evidence.record_review_binding.review_path = `${RECORD_DIR}/diagnosis_review.txt`;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      report.errors.some((error) => error.includes(BINDING_MISMATCH_FINDING)),
      'binding path drift must fail closed',
    );
  });

  await withRoot((root) => {
    const record = buildRecord(root, { phase: 'authorized', executionAuthorized: true });
    record.evidence.record_review_binding.review_sha256 = '0'.repeat(64);
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      report.errors.some((error) => error.includes(BINDING_MISMATCH_FINDING)),
      'binding digest drift must fail closed',
    );
  });
});

test('T7 reviewed_phase drift in the record review binding is rejected by the schema', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, { phase: 'authorized', executionAuthorized: true });
    record.evidence.record_review_binding.reviewed_phase = 'authorized';
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) => error.includes(
      'schema /evidence/record_review_binding/reviewed_phase must be equal to constant',
    )));
  });
});

test('T8 a closed record retains all eight artifacts at the exact maxItems boundary', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'closed',
      outcome: 'TOPOLOGY_PASS',
      attemptConsumed: true,
      teardownVerified: true,
      residualResources: 0,
      externalManifestLocallyVerified: true,
    });
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(report.errors, []);
    assert.equal(record.evidence.artifacts.length, 8);
    assert.deepEqual(
      record.evidence.artifacts.map((entry) => entry.kind).sort(),
      [...CLOSED_ARTIFACT_KINDS].sort(),
    );

    const ninthPath = `${RECORD_DIR}/ninth-artifact.txt`;
    writeFileSync(resolve(root, ninthPath), 'ninth artifact\n', 'utf8');
    record.evidence.artifacts.push({
      kind: 'result',
      path: ninthPath,
      sha256: sha256('ninth artifact\n'),
    });
    writeRecord(root, record);
    const overflowed = validateTopologyRehearsals({ root });
    assert.ok(overflowed.errors.some((error) => error.includes(
      'schema /evidence/artifacts must NOT have more than 8 items',
    )));
  });
});

test('T9 an in-enum but phase-forbidden artifact raises the exact exhaustive-inventory finding', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, { phase: 'authorized', executionAuthorized: true });
    record.evidence.artifacts.push(artifact(root, RECORD_DIR, 'evidence_manifest'));
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    const findings = report.errors.filter((error) =>
      error.includes(inventoryFinding('authorized')));
    assert.equal(findings.length, 1, 'exhaustive inventory must raise exactly one finding');
    assert.equal(findings[0], `${RECORD_PATH}: ${inventoryFinding('authorized')}`);
  });
});

test('T10 record rationale and registry truth prose name the owed record-level review', () => {
  const { record } = readCommittedRecord();
  const rationale = record.disposition?.rationale ?? '';
  assert.match(rationale, RECORD_LEVEL_REVIEW_PROSE, `${RECORD_PATH}: rationale must name record-level review`);
  assert.match(rationale, RECORD_REVIEW_TERM, `${RECORD_PATH}: rationale must name the record_review artifact`);
  for (const path of RECORD_REVIEW_TRUTH_PROSE_PATHS) {
    const text = readCommittedBytes(path).toString('utf8');
    assert.match(text, RECORD_LEVEL_REVIEW_PROSE, `${path}: must name record-level review`);
    assert.match(text, RECORD_REVIEW_TERM, `${path}: must name the record_review artifact kind`);
  }
});

test('T11 no topology truth surface retains the standalone independent_review term', () => {
  for (const path of RETIRED_TERM_TRUTH_PATHS) {
    assert.doesNotMatch(
      readCommittedBytes(path).toString('utf8'),
      RETIRED_ARTIFACT_KIND_TERM,
      `${path}: retired ${RETIRED_ARTIFACT_KIND} term must be replaced by the split review kinds`,
    );
  }
});

// C3 RED gate for the future C4 cross-byte record-review binding control.
//
// The control cannot be proven black-box through committed record bytes alone: a binding
// whose reviewed_record_sha256 equals the SHA-256 of the record containing it is a
// cryptographic fixed point, because writing the field changes the very bytes being
// hashed. So the control is expected as a pure, side-effect-free helper exported from the
// validator, exercised directly here and through the record path integration surface.
//
// Expected C4 contract:
//   validateRecordReviewByteBinding({
//     path,                        // record path used to prefix every finding
//     phase,                       // 'proposed' | 'authorized' | 'closed'
//     reviewedRecordSha256,        // evidence.record_review_binding.reviewed_record_sha256
//     pinnedProposedRecordSha256,  // proposed prior-state digest pinned in state_history
//     currentRecordSha256,         // SHA-256 of the current record bytes
//   }) => string[]                 // path-prefixed findings, empty when the binding holds
const recordReviewByteBindingInput = ({
  path = RECORD_PATH,
  phase = 'authorized',
  reviewedRecordSha256 = null,
  pinnedProposedRecordSha256 = null,
  currentRecordSha256 = null,
}) => ({
  path,
  phase,
  reviewedRecordSha256,
  pinnedProposedRecordSha256,
  currentRecordSha256,
});

// Reads the helper off the namespace so a missing C4 export fails as a diagnostic
// assertion rather than aborting module linking for the whole suite.
const recordReviewByteBindingFindings = (input) => {
  const validate = topologyRehearsal.validateRecordReviewByteBinding;
  assert.equal(
    typeof validate,
    'function',
    `${VALIDATOR_PATH}: must export a pure validateRecordReviewByteBinding helper`,
  );
  const findings = validate(input);
  assert.ok(
    Array.isArray(findings),
    `${VALIDATOR_PATH}: validateRecordReviewByteBinding must return an array of findings`,
  );
  for (const finding of findings) {
    assert.equal(typeof finding, 'string', `${VALIDATOR_PATH}: findings must be strings`);
    assert.ok(
      finding.startsWith(`${input.path}: `),
      `${finding}: record review byte findings must be path-prefixed`,
    );
  }
  return findings;
};

test('T12 a record review binding naming its own current record bytes fails the fixed-point check', () => {
  const currentRecordSha256 = sha256('t12-current-record-bytes\n');
  const findings = recordReviewByteBindingFindings(recordReviewByteBindingInput({
    phase: 'authorized',
    reviewedRecordSha256: currentRecordSha256,
    pinnedProposedRecordSha256: sha256('t12-pinned-proposed-record-bytes\n'),
    currentRecordSha256,
  }));
  assert.ok(
    findings.includes(`${RECORD_PATH}: ${RECORD_REVIEW_SELF_ATTESTATION_FINDING}`),
    'a binding digest equal to the current record digest must fail closed',
  );
});

test('T13 a record review binding attesting neither the pinned proposed nor the current bytes fails closed', () => {
  const findings = recordReviewByteBindingFindings(recordReviewByteBindingInput({
    phase: 'authorized',
    reviewedRecordSha256: sha256('t13-unrelated-record-bytes\n'),
    pinnedProposedRecordSha256: sha256('t13-pinned-proposed-record-bytes\n'),
    currentRecordSha256: sha256('t13-current-record-bytes\n'),
  }));
  assert.ok(
    findings.includes(`${RECORD_PATH}: ${RECORD_REVIEW_PINNED_PROPOSED_FINDING}`),
    'a binding that names no pinned proposed digest must fail closed',
  );
  assert.ok(
    !findings.includes(`${RECORD_PATH}: ${RECORD_REVIEW_SELF_ATTESTATION_FINDING}`),
    'a binding differing from the current record digest must not raise the fixed-point finding',
  );
});

test('T13B a binding on the pinned proposed digest differing from the current bytes returns no findings', () => {
  const pinnedProposedRecordSha256 = sha256('t13b-pinned-proposed-record-bytes\n');
  assert.deepEqual(
    recordReviewByteBindingFindings(recordReviewByteBindingInput({
      phase: 'authorized',
      reviewedRecordSha256: pinnedProposedRecordSha256,
      pinnedProposedRecordSha256,
      currentRecordSha256: sha256('t13b-current-record-bytes\n'),
    })),
    [],
    'attesting the pinned proposed bytes from later bytes is the only valid binding',
  );
  assert.deepEqual(
    recordReviewByteBindingFindings(recordReviewByteBindingInput({
      phase: 'proposed',
      reviewedRecordSha256: null,
      pinnedProposedRecordSha256: null,
      currentRecordSha256: sha256('t13b-proposed-record-bytes\n'),
    })),
    [],
    'a proposed record owes no record review binding, so it owes no byte findings',
  );
});

test('T14 an authorized record with no pinned proposed prior state fails the record review byte binding', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, { phase: 'authorized', executionAuthorized: true });
    writeRecord(root, record, { stateHistory: [] });
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      report.errors.some((error) => error.includes(HISTORY_LENGTH_FINDING)),
      'the existing history-length control must still fire',
    );
    assert.ok(
      report.errors.some((error) =>
        error === `${RECORD_PATH}: ${RECORD_REVIEW_PINNED_PROPOSED_FINDING}`),
      'a record review binding with no pinned proposed digest to attest must fail closed',
    );
  });
});

test('T15 a closed record review binding on the authorized prior-state digest fails closed', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'closed',
      outcome: 'TOPOLOGY_PASS',
      attemptConsumed: true,
      teardownVerified: true,
      residualResources: 0,
      externalManifestLocallyVerified: true,
    });
    record.evidence.record_review_binding.reviewed_record_sha256 =
      sha256(`${record.record_id}:authorized\n`);
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      !report.errors.some((error) => error.includes(HISTORY_LENGTH_FINDING)),
      'the pinned prior-state history itself must remain well formed',
    );
    assert.ok(
      report.errors.some((error) =>
        error === `${RECORD_PATH}: ${RECORD_REVIEW_PINNED_PROPOSED_FINDING}`),
      'attesting the authorized prior-state digest is not attesting the proposed bytes',
    );
  });
});

// ---------------------------------------------------------------------------
// C5 RED — P2-1: prior-state history robustness.
//
// The state-history loop reads `entry.record_sha256` off every slot before it has
// established that the slot is an object, so a malformed pin is a crash surface rather
// than a finding, and two malformed slots collide on `undefined` into a spurious
// uniqueness finding. A control that fails closed must fail with findings.
// ---------------------------------------------------------------------------
const MALFORMED_PRIOR_STATE_PINS = [
  ['null pin', null],
  ['string pin', 'proposed'],
  ['number pin', 1],
  ['array pin', []],
  ['empty object pin', {}],
  ['extra-key pin', withFields(priorStatePin('proposed', sha256('t16-extra-key-pin\n')), {
    unreviewed_note: 'extra',
  })],
];

test('T16 every malformed prior-state pin yields an invalid-pin finding and never throws', async () => {
  for (const [label, pin] of MALFORMED_PRIOR_STATE_PINS) {
    await withRoot((root) => {
      const record = buildRecord(root, { phase: 'authorized', executionAuthorized: true });
      writeRecord(root, record, { stateHistory: [pin] });
      let report;
      assert.doesNotThrow(() => {
        report = validateTopologyRehearsals({ root });
      }, `${label}: a malformed prior-state pin must fail closed with a finding, never throw`);
      assert.ok(
        report.errors.some((error) =>
          error === `${POLICY_PATH}: ${INVALID_PRIOR_PIN_FINDING}`),
        `${label}: must raise the exact invalid prior-state pin finding`,
      );
    });
  }
});

test('T17 duplicate proposed prior-state pins supply no attestable digest', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'closed',
      outcome: 'TOPOLOGY_PASS',
      attemptConsumed: true,
      teardownVerified: true,
      residualResources: 0,
      externalManifestLocallyVerified: true,
    });
    writeRecord(root, record, {
      stateHistory: [
        priorStatePin('proposed', proposedStateDigest(record.record_id)),
        priorStatePin('proposed', sha256(`${record.record_id}:proposed-duplicate\n`)),
      ],
    });
    let report;
    assert.doesNotThrow(() => {
      report = validateTopologyRehearsals({ root });
    });
    assert.ok(
      report.errors.some((error) =>
        error === `${RECORD_PATH}: ${RECORD_REVIEW_PINNED_PROPOSED_FINDING}`),
      'two proposed pins pin nothing, so the record review has no attestable digest',
    );
  });
});

test('T18 a prior-state digest reused across proposed and authorized fails uniqueness', async () => {
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'closed',
      outcome: 'TOPOLOGY_PASS',
      attemptConsumed: true,
      teardownVerified: true,
      residualResources: 0,
      externalManifestLocallyVerified: true,
    });
    const shared = proposedStateDigest(record.record_id);
    writeRecord(root, record, {
      stateHistory: [priorStatePin('proposed', shared), priorStatePin('authorized', shared)],
    });
    let report;
    assert.doesNotThrow(() => {
      report = validateTopologyRehearsals({ root });
    });
    assert.ok(
      report.errors.some((error) =>
        error === `${POLICY_PATH}: ${UNIQUE_PRIOR_DIGEST_FINDING}`),
      'a digest reused across two prior phases must fail closed',
    );
  });
});

test('T19 a malformed later prior-state slot neither crashes nor forges a uniqueness finding', async () => {
  const closedRecordOptions = {
    phase: 'closed',
    outcome: 'TOPOLOGY_PASS',
    attemptConsumed: true,
    teardownVerified: true,
    residualResources: 0,
    externalManifestLocallyVerified: true,
  };

  await withRoot((root) => {
    const record = buildRecord(root, closedRecordOptions);
    writeRecord(root, record, {
      stateHistory: [priorStatePin('proposed', proposedStateDigest(record.record_id)), null],
    });
    let report;
    assert.doesNotThrow(() => {
      report = validateTopologyRehearsals({ root });
    }, 'a malformed second prior-state slot must not crash the validator');
    assert.ok(
      report.errors.some((error) =>
        error === `${POLICY_PATH}: ${INVALID_PRIOR_PIN_FINDING}`),
      'a malformed second slot must raise the invalid prior-state pin finding',
    );
    assert.ok(
      !report.errors.some((error) => error.includes(UNIQUE_PRIOR_DIGEST_FINDING)),
      'one malformed slot carries no digest, so it cannot collide with a real digest',
    );
  });

  await withRoot((root) => {
    const record = buildRecord(root, closedRecordOptions);
    writeRecord(root, record, { stateHistory: [{}, {}] });
    let report;
    assert.doesNotThrow(() => {
      report = validateTopologyRehearsals({ root });
    });
    assert.ok(
      !report.errors.some((error) => error.includes(UNIQUE_PRIOR_DIGEST_FINDING)),
      'two absent digests are not a duplicated digest and must not forge a uniqueness finding',
    );
    assert.equal(
      report.errors.filter((error) =>
        error === `${POLICY_PATH}: ${INVALID_PRIOR_PIN_FINDING}`).length,
      2,
      'each malformed slot must raise its own invalid prior-state pin finding',
    );
  });
});

// ---------------------------------------------------------------------------
// C5 RED — P2-2: artifact entry robustness.
//
// `requireArtifactKinds` maps `entry.kind` over every listed artifact before proving the
// entry is an object, so a null entry throws a TypeError out of the validator instead of
// producing a finding. A non-object entry must fail closed exactly once, alongside the
// existing inventory and phase findings.
// ---------------------------------------------------------------------------
const NON_OBJECT_ARTIFACT_ENTRIES = [
  ['null entry', null],
  ['string entry', `${RECORD_DIR}/record_review.json`],
  ['array entry', []],
];
const NON_OBJECT_ARTIFACT_PHASES = [
  ['proposed', 'diagnosis_review', {}],
  ['authorized', 'record_review', { phase: 'authorized', executionAuthorized: true }],
  ['closed', 'result', {
    phase: 'closed',
    outcome: 'TOPOLOGY_PASS',
    attemptConsumed: true,
    teardownVerified: true,
    residualResources: 0,
    externalManifestLocallyVerified: true,
  }],
];

test('T20 a non-object artifact entry fails closed with one finding in every phase', async () => {
  for (const [phase, replacedKind, options] of NON_OBJECT_ARTIFACT_PHASES) {
    for (const [label, entry] of NON_OBJECT_ARTIFACT_ENTRIES) {
      await withRoot((root) => {
        const built = buildRecord(root, options);
        const record = withArtifacts(
          built,
          replaceArtifactOfKind(built.evidence.artifacts, replacedKind, entry),
        );
        writeRecord(root, record);
        let report;
        assert.doesNotThrow(() => {
          report = validateTopologyRehearsals({ root });
        }, `${phase}/${label}: a non-object artifact entry must fail closed, never throw`);
        assert.equal(
          report.errors.filter((error) =>
            error === `${RECORD_PATH}: ${ARTIFACT_OBJECT_ENTRY_FINDING}`).length,
          1,
          `${phase}/${label}: must raise exactly one artifact-entry-object finding`,
        );
        assert.ok(
          report.errors.some((error) => error.includes(inventoryFinding(phase))),
          `${phase}/${label}: the exhaustive inventory finding must still fire`,
        );
        assert.ok(
          report.errors.some((error) =>
            error === `${RECORD_PATH}: required ${replacedKind} artifact is missing`),
          `${phase}/${label}: the replaced artifact kind must still be reported missing`,
        );
      });
    }
  }
});

// ---------------------------------------------------------------------------
// C5 RED — P2-3: the future C6 record-review attestation control.
//
// C4 proves only that the binding names the pinned proposed record digest. It says
// nothing about what the reviewed bytes actually contain: today a record_review artifact
// may be any bytes at all, so an "independent record review" is an unverified claim. C6
// must machine-check the review artifact itself as a bounded canonical JSON attestation.
//
// Expected C6 contract — pure and side-effect free, every input caller-supplied:
//   validateRecordReviewAttestation({
//     path,                        // record path used to prefix every finding
//     phase,                       // 'proposed' | 'authorized' | 'closed'
//     recordPath,                  // record path the attestation must name
//     reviewPath,                  // listed record_review artifact path
//     reviewBytes,                 // Buffer of the review bytes, or null when unreadable
//     bindingReviewedRecordSha256, // binding.reviewed_record_sha256, null when no binding
//   }) => string[]                 // path-prefixed findings, empty when the review holds
//
// Reporting discipline, so every failure names its exact cause:
//   * a proposed record owes no record review, so it owes no attestation findings;
//   * a non-.json review path raises the suffix finding independently;
//   * failing the canonical-bytes gate is terminal — nothing downstream can be trusted,
//     so the canonical finding is reported alone;
//   * failing the exact ordered key inventory is likewise terminal;
//   * the digest and approval findings are derivative of the record review binding, so a
//     null binding suppresses both and leaves the binding controls to report the cause.
const DEFAULT_REVIEW_PATH = `${RECORD_DIR}/record_review.json`;
const ATTESTATION_FINDING_SEVERITIES = ['P0', 'P1', 'P2', 'P3'];

const withCrlf = (text) => text.replace(/\n/gu, '\r\n');
const withBom = (text) => `\uFEFF${text}`;
// Injects a second copy of one key immediately after the opening brace: the bytes still
// parse, but they no longer round-trip to the canonical serialization of what they mean.
const withDuplicateKey = (value, key) =>
  canonicalText(value).replace(
    '{\n',
    `{\n  ${JSON.stringify(key)}: ${JSON.stringify(value[key])},\n`,
  );

const recordReviewAttestationInput = ({
  path = RECORD_PATH,
  phase = 'authorized',
  recordPath = RECORD_PATH,
  reviewPath = DEFAULT_REVIEW_PATH,
  reviewBytes = canonicalApprovedBytes(),
  bindingReviewedRecordSha256 = DEFAULT_REVIEWED_RECORD_SHA256,
} = {}) => ({
  path,
  phase,
  recordPath,
  reviewPath,
  reviewBytes,
  bindingReviewedRecordSha256,
});

// Reads the helper off the namespace so a missing C6 export fails as a diagnostic
// assertion rather than aborting module linking for the whole suite. Returns findings
// with the path prefix stripped, after asserting every finding is prefixed and is one of
// the exact reviewed attestation finding texts.
const recordReviewAttestationFindings = (input) => {
  const validate = topologyRehearsal.validateRecordReviewAttestation;
  assert.equal(
    typeof validate,
    'function',
    `${VALIDATOR_PATH}: must export a pure validateRecordReviewAttestation helper`,
  );
  const findings = validate(input);
  assert.ok(
    Array.isArray(findings),
    `${VALIDATOR_PATH}: validateRecordReviewAttestation must return an array of findings`,
  );
  const prefix = `${input.path}: `;
  return findings.map((finding) => {
    assert.equal(typeof finding, 'string', `${VALIDATOR_PATH}: findings must be strings`);
    assert.ok(
      finding.startsWith(prefix),
      `${finding}: record review attestation findings must be path-prefixed`,
    );
    const text = finding.slice(prefix.length);
    assert.ok(
      ALL_ATTESTATION_FINDINGS.includes(text),
      `${finding}: must be one of the exact reviewed attestation finding texts`,
    );
    return text;
  });
};

test('T21 a proposed record owes nothing and a canonical approved review passes clean', () => {
  assert.deepEqual(
    recordReviewAttestationFindings(recordReviewAttestationInput({
      phase: 'proposed',
      reviewPath: null,
      reviewBytes: null,
      bindingReviewedRecordSha256: null,
    })),
    [],
    'a proposed record carries no record review, so it owes no attestation findings',
  );
  for (const phase of ['authorized', 'closed']) {
    assert.deepEqual(
      recordReviewAttestationFindings(recordReviewAttestationInput({ phase })),
      [],
      `${phase}: a canonical approved attestation of the bound bytes must pass clean`,
    );
  }
});

test('T22 only bounded canonical JSON review bytes are accepted', () => {
  const cases = [
    ['missing review bytes', null],
    ['invalid JSON', Buffer.from('{\n', 'utf8')],
    ['compact JSON', Buffer.from(JSON.stringify(attestationValue()), 'utf8')],
    ['CRLF line endings', Buffer.from(withCrlf(canonicalText(attestationValue())), 'utf8')],
    ['UTF-8 BOM', Buffer.from(withBom(canonicalText(attestationValue())), 'utf8')],
    ['trailing bytes', Buffer.concat([
      canonicalBytes(attestationValue()),
      Buffer.from('\n', 'utf8'),
    ])],
    ['duplicate keys', Buffer.from(withDuplicateKey(attestationValue(), 'schema'), 'utf8')],
    ['oversize bytes', canonicalBytes(attestationValue({
      findings: [attestationFinding('OVERSIZE-1', 'P1', 'x'.repeat(RECORD_REVIEW_MAX_BYTES))],
    }))],
  ];
  for (const [label, reviewBytes] of cases) {
    assert.deepEqual(
      recordReviewAttestationFindings(recordReviewAttestationInput({ reviewBytes })),
      [ATTESTATION_CANONICAL_FINDING],
      `${label}: must fail the bounded canonical bytes gate and report it alone`,
    );
  }
  assert.ok(
    canonicalBytes(attestationValue({
      findings: [attestationFinding('OVERSIZE-1', 'P1', 'x'.repeat(RECORD_REVIEW_MAX_BYTES))],
    })).length > RECORD_REVIEW_MAX_BYTES,
    'the oversize fixture must actually exceed the reviewed byte bound',
  );
});

test('T23 the attestation must use the exact ordered ten-key inventory', () => {
  const cases = [
    ['extra key', withFields(attestationValue(), { reviewer_notes: 'unreviewed extra key' })],
    ['missing key', withoutField(attestationValue(), 'reviewer_mode')],
    ['reordered keys', withKeyOrder(
      attestationValue(),
      [...RECORD_REVIEW_ATTESTATION_KEYS].reverse(),
    )],
  ];
  assert.deepEqual(
    Object.keys(attestationValue()),
    RECORD_REVIEW_ATTESTATION_KEYS,
    'the clean fixture must itself carry the exact ordered key inventory',
  );
  for (const [label, value] of cases) {
    assert.deepEqual(
      recordReviewAttestationFindings(recordReviewAttestationInput({
        reviewBytes: canonicalBytes(value),
      })),
      [ATTESTATION_KEY_INVENTORY_FINDING],
      `${label}: must fail the exact ordered key inventory and report it alone`,
    );
  }
});

test('T24 the attestation must name this record path, schema and the proposed phase', () => {
  const cases = [
    ['wrong schema', { schema: 'CYBRIK-TOPOLOGY-RECORD-REVIEW/v2' }],
    ['wrong record path', {
      record_path: `${TOPOLOGY_ROOT}/postgres-loopback-internal-v1-r2/topology-rehearsal.json`,
    }],
    ['wrong reviewed phase', { reviewed_phase: 'authorized' }],
  ];
  for (const [label, patch] of cases) {
    assert.deepEqual(
      recordReviewAttestationFindings(recordReviewAttestationInput({
        reviewBytes: canonicalBytes(withFields(attestationValue(), patch)),
      })),
      [ATTESTATION_SUBJECT_FINDING],
      `${label}: must fail the attestation subject check`,
    );
  }
});

test('T25 the attested digest must be a lowercase digest equal to the binding digest', () => {
  const cases = [
    [
      'uppercase digest',
      DEFAULT_REVIEWED_RECORD_SHA256.toUpperCase(),
      DEFAULT_REVIEWED_RECORD_SHA256.toUpperCase(),
    ],
    ['truncated digest', 'abc123', 'abc123'],
    [
      'binding mismatch',
      sha256('t25-unrelated-record-bytes\n'),
      DEFAULT_REVIEWED_RECORD_SHA256,
    ],
  ];
  for (const [label, attested, bound] of cases) {
    assert.deepEqual(
      recordReviewAttestationFindings(recordReviewAttestationInput({
        reviewBytes: canonicalBytes(attestationValue({ reviewedRecordSha256: attested })),
        bindingReviewedRecordSha256: bound,
      })),
      [ATTESTATION_DIGEST_FINDING],
      `${label}: must fail the attestation digest check`,
    );
  }
});

test('T26 a null record review binding suppresses the derivative digest and approval findings', () => {
  assert.deepEqual(
    recordReviewAttestationFindings(recordReviewAttestationInput({
      reviewBytes: canonicalBytes(attestationValue({
        reviewedRecordSha256: sha256('t26-unrelated-record-bytes\n'),
      })),
      bindingReviewedRecordSha256: null,
    })),
    [],
    'with no binding there is no bound digest to contradict, so the digest finding is owed elsewhere',
  );
  assert.deepEqual(
    recordReviewAttestationFindings(recordReviewAttestationInput({
      reviewBytes: canonicalBytes(attestationValue({
        findings: [attestationFinding('T26-1')],
      })),
      bindingReviewedRecordSha256: null,
    })),
    [],
    'with no binding the approval finding is derivative and the binding control reports the cause',
  );
});

test('T27 the attestation must name an independent read-only reviewer claiming no authority', () => {
  const cases = [
    ['blank reviewer identity', { reviewer_identity: '   ' }],
    ['non-string reviewer identity', { reviewer_identity: null }],
    ['non-independent reviewer', { reviewer_independent_of_record_author: false }],
    ['non read-only reviewer mode', { reviewer_mode: 'read_write' }],
    ['claimed execution authority', { grants_execution_authority: true }],
  ];
  for (const [label, patch] of cases) {
    assert.deepEqual(
      recordReviewAttestationFindings(recordReviewAttestationInput({
        reviewBytes: canonicalBytes(withFields(attestationValue(), patch)),
      })),
      [ATTESTATION_REVIEWER_FINDING],
      `${label}: must fail the reviewer identity and authority check`,
    );
  }
});

test('T28 attestation findings must be exact bounded three-key entries with unique ids', () => {
  const cases = [
    ['non-array findings', { findings: {}, decision: DECISION_REJECTED }],
    ['non-object finding entry', { findings: ['reviewed record bytes finding'] }],
    ['finding key order drift', {
      findings: [withKeyOrder(attestationFinding('T28-1'), ['summary', 'severity', 'id'])],
    }],
    ['extra finding key', {
      findings: [withFields(attestationFinding('T28-1'), { owner: 'reviewer' })],
    }],
    ['blank finding id', { findings: [attestationFinding('   ')] }],
    ['unknown severity', { findings: [attestationFinding('T28-1', 'BLOCKER')] }],
    ['blank summary', { findings: [attestationFinding('T28-1', 'P1', '   ')] }],
    ['too many findings', {
      findings: Array.from(
        { length: RECORD_REVIEW_MAX_FINDINGS + 1 },
        (_, index) => attestationFinding(`T28-${index}`),
      ),
    }],
    ['duplicate finding ids', {
      findings: [
        attestationFinding('T28-1'),
        attestationFinding('T28-1', 'P2', 'second reviewed finding'),
      ],
    }],
  ];
  assert.ok(
    ATTESTATION_FINDING_SEVERITIES.includes(attestationFinding('T28-0').severity),
    'the clean finding fixture must use a reviewed severity',
  );
  for (const [label, patch] of cases) {
    assert.deepEqual(
      recordReviewAttestationFindings(recordReviewAttestationInput({
        reviewBytes: canonicalBytes(withFields(attestationValue(), patch)),
      })),
      [ATTESTATION_DECISION_FINDING],
      `${label}: must fail the exact decision and findings check`,
    );
  }
});

test('T29 the decision value must be exact and coherent with the findings list', () => {
  const cases = [
    ['unknown decision', { decision: 'RECORD_BYTES_MAYBE', findings: [] }],
    ['non-string decision', { decision: null, findings: [] }],
    ['approved while carrying findings', {
      decision: DECISION_APPROVED,
      findings: [attestationFinding('T29-1')],
    }],
    ['rejected while carrying no findings', { decision: DECISION_REJECTED, findings: [] }],
  ];
  for (const [label, patch] of cases) {
    assert.deepEqual(
      recordReviewAttestationFindings(recordReviewAttestationInput({
        reviewBytes: canonicalBytes(withFields(attestationValue(), patch)),
      })),
      [ATTESTATION_DECISION_FINDING],
      `${label}: must fail the exact decision and findings check`,
    );
  }
});

test('T30 a well-formed rejected review blocks authorization with exactly the approval finding', () => {
  for (const phase of ['authorized', 'closed']) {
    assert.deepEqual(
      recordReviewAttestationFindings(recordReviewAttestationInput({
        phase,
        reviewBytes: canonicalBytes(attestationValue({
          findings: [attestationFinding('T30-1')],
        })),
      })),
      [ATTESTATION_APPROVAL_FINDING],
      `${phase}: a well-formed rejection is not malformed, it is a refusal to approve`,
    );
  }
});

// ---------------------------------------------------------------------------
// C5 RED — P2-4: the attestation control on the record path integration surface.
// ---------------------------------------------------------------------------
const CLOSED_RECORD_OPTIONS = Object.freeze({
  phase: 'closed',
  outcome: 'TOPOLOGY_PASS',
  attemptConsumed: true,
  teardownVerified: true,
  residualResources: 0,
  externalManifestLocallyVerified: true,
});

const attestationErrors = (report) =>
  report.errors.filter((error) =>
    ALL_ATTESTATION_FINDINGS.some((finding) => error === `${RECORD_PATH}: ${finding}`));

test('T31 an authorized record with a canonical approved review raises no attestation finding', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, { phase: 'authorized', executionAuthorized: true }));
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(report.errors, []);
    assert.deepEqual(attestationErrors(report), []);
  });
});

test('T32 a plain-text record review artifact fails the canonical bytes gate', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
      recordReview: { bytes: Buffer.from('An independent reviewer approved this.\n', 'utf8') },
    }));
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      report.errors.some((error) =>
        error === `${RECORD_PATH}: ${ATTESTATION_CANONICAL_FINDING}`),
      'prose is not a machine-checkable attestation of the reviewed record bytes',
    );
  });
});

test('T33 a markdown record review artifact fails the .json attestation suffix gate', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
      recordReview: { fileName: 'record_review.md' },
    }));
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      report.errors.some((error) =>
        error === `${RECORD_PATH}: ${ATTESTATION_SUFFIX_FINDING}`),
      'the record review artifact must be a .json attestation file',
    );
  });
});

test('T34 a closed record carrying a rejected record review fails closed and renders exit 1', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...CLOSED_RECORD_OPTIONS,
      recordReview: { attestation: { findings: [attestationFinding('T34-1')] } },
    }));
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      report.errors.some((error) =>
        error === `${RECORD_PATH}: ${ATTESTATION_APPROVAL_FINDING}`),
      'a rejected record review cannot support an authorized or closed record',
    );
    const rendered = formatTopologyRehearsalReport(report);
    assert.equal(rendered.exitCode, 1);
    assert.match(rendered.stdout, /TOPOLOGY REHEARSAL: FAIL/u);
  });
});

test('T35 the C4 byte-binding findings and the C6 attestation digest finding stay distinct', async () => {
  assert.equal(
    new Set([
      RECORD_REVIEW_SELF_ATTESTATION_FINDING,
      RECORD_REVIEW_PINNED_PROPOSED_FINDING,
      ATTESTATION_DIGEST_FINDING,
    ]).size,
    3,
    'three distinct controls must carry three distinct finding texts',
  );

  // The binding drifts off the pinned proposed digest while the attestation agrees with
  // the binding: the C4 control fires and the C6 digest control has nothing to say.
  const drift = sha256('t35-unpinned-record-bytes\n');
  await withRoot((root) => {
    const record = buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
      recordReview: { attestation: { reviewedRecordSha256: drift } },
    });
    writeRecord(root, withRecordReviewBinding(record, { reviewed_record_sha256: drift }));
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      report.errors.some((error) =>
        error === `${RECORD_PATH}: ${RECORD_REVIEW_PINNED_PROPOSED_FINDING}`),
      'a binding off the pinned proposed digest must still fail the C4 control',
    );
    assert.ok(
      !report.errors.some((error) => error.includes(ATTESTATION_DIGEST_FINDING)),
      'an attestation agreeing with its binding must not also fail the C6 digest control',
    );
  });

  // The binding is exactly right and only the attestation bytes disagree: the C6 digest
  // control fires alone, and no C4 byte-binding finding is raised.
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      phase: 'authorized',
      executionAuthorized: true,
      recordReview: { attestation: { reviewedRecordSha256: drift } },
    }));
    const report = validateTopologyRehearsals({ root });
    assert.ok(
      report.errors.some((error) =>
        error === `${RECORD_PATH}: ${ATTESTATION_DIGEST_FINDING}`),
      'a review attesting bytes other than the bound proposed digest must fail closed',
    );
    for (const finding of [
      RECORD_REVIEW_SELF_ATTESTATION_FINDING,
      RECORD_REVIEW_PINNED_PROPOSED_FINDING,
    ]) {
      assert.ok(
        !report.errors.some((error) => error.includes(finding)),
        `an exact binding must not raise the C4 finding: ${finding}`,
      );
    }
  });
});

test('T36 a missing record_review artifact raises no derivative attestation finding', async () => {
  await withRoot((root) => {
    const built = buildRecord(root, { phase: 'authorized', executionAuthorized: true });
    const record = withArtifacts(
      built,
      built.evidence.artifacts.filter((entry) => entry?.kind !== 'record_review'),
    );
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.ok(report.errors.some((error) =>
      error === `${RECORD_PATH}: required record_review artifact is missing`));
    assert.deepEqual(
      attestationErrors(report),
      [],
      'with no review artifact there are no review bytes to judge, so the cause is the missing artifact',
    );
  });
});

// ---------------------------------------------------------------------------
// C5 RED — P2-5: documented truth and process guards.
// ---------------------------------------------------------------------------
const README_ATTESTATION_PROSE = [
  new RegExp(RECORD_REVIEW_ATTESTATION_SCHEMA, 'u'),
  /canonical JSON/iu,
  /exact ordered ten-key inventory/iu,
  new RegExp(DECISION_APPROVED, 'u'),
  new RegExp(DECISION_REJECTED, 'u'),
  /grants no execution, runtime, UAT, demo, release or production authority/iu,
];
const PINNED_COMMITTED_BYTES = [
  [RECORD_PATH, '135d1232cb33bd6b1ca97dccff597ee16071142e8a58507bd0f99d9e1a671dfe'],
  [POLICY_PATH, 'c22d81a942911b2471f9a2856be14c9e046f6e6b8a450ab8447d37504b542b37'],
  [SCHEMA_PATH, '7c34a2b79e7a29d6bea3d24d062fc7b67583204c97a41cae2496ffa4d9d0ad79'],
  [TRUST_PATH, 'd844c4764066dff1e8eefe67a4feb1c1fd14f45bc7565696264eafcafa93aa77'],
  [ALLOWED_SIGNERS_PATH, '04c1d4274218a6ba8adb971a5f6f5360d3ff8ce4aac83ab06be1437b195859e0'],
];
const FORBIDDEN_VALIDATOR_IMPORTS = [
  /node:net/u,
  /node:http\b/u,
  /node:https/u,
  /node:dgram/u,
];

test('T37 both READMEs document the record review attestation contract and its non-claim', () => {
  for (const path of RECORD_REVIEW_TRUTH_PROSE_PATHS) {
    const text = readCommittedBytes(path).toString('utf8');
    for (const pattern of README_ATTESTATION_PROSE) {
      assert.match(text, pattern, `${path}: must document ${pattern}`);
    }
    for (const key of RECORD_REVIEW_ATTESTATION_KEYS) {
      assert.match(
        text,
        new RegExp(`\\b${key}\\b`, 'u'),
        `${path}: must name the ${key} attestation key`,
      );
    }
  }
});

test('T38 the committed record, policy, schema and trust bytes remain exactly pinned', () => {
  for (const [path, digest] of PINNED_COMMITTED_BYTES) {
    assert.equal(
      sha256(readCommittedBytes(path)),
      digest,
      `${path}: committed bytes must remain exactly as reviewed`,
    );
  }
  assert.equal(
    PINNED_TOPOLOGY_STATE.current_state.record_sha256,
    PINNED_COMMITTED_BYTES[0][1],
    'the validator-pinned current state must keep naming the committed record bytes',
  );
});

test('T39 the validator keeps exact process targets and opens no network surface', () => {
  const source = readCommittedBytes(VALIDATOR_PATH).toString('utf8');
  assert.match(source, /'\/usr\/bin\/git'/u);
  assert.match(source, /'\/usr\/bin\/ssh-keygen'/u);
  assert.doesNotMatch(source, /execFileSync\(\s*'ssh-keygen'/u);
  assert.doesNotMatch(source, /spawnSync\(\s*'ssh-keygen'/u);
  for (const forbidden of FORBIDDEN_VALIDATOR_IMPORTS) {
    assert.doesNotMatch(source, forbidden, `${VALIDATOR_PATH}: must open no network surface`);
  }
});

// ---------------------------------------------------------------------------
// C8-C2 RED — the mandatory exact-action grant document on the record path.
//
// Every authorized or closed grant artifact is a C8 exact-action grant document. There is
// no SSHSIG-only fallback for free-text or non-`.json` grants; the grant's record binding
// names the one pinned proposed prior-state digest rather than the current record's own
// hash; the admission instant is the record's own canonical `recorded_at`, never a wall
// clock; and a grant-document refusal names its exact cause instead of collapsing into the
// generic signature message, which stays reserved for real signature or trust failure.
// ---------------------------------------------------------------------------
const AUTHORIZED_OPTIONS = Object.freeze({ phase: 'authorized', executionAuthorized: true });

// Reads the helper off the namespace so a missing export fails as a diagnostic assertion
// rather than aborting module linking for the whole suite.
const canonicalRecordInstant = (value) => {
  const canonicalise = topologyRehearsal.canonicalRecordInstant;
  assert.equal(
    typeof canonicalise,
    'function',
    `${VALIDATOR_PATH}: must export a pure canonicalRecordInstant helper`,
  );
  return canonicalise(value);
};

test('T40 recorded_at becomes one exact canonical UTC Z instant or is refused', () => {
  for (const [label, value, expected] of [
    ['already canonical', '2026-08-04T12:00:00Z', '2026-08-04T12:00:00Z'],
    ['positive offset', '2026-08-04T14:00:00+02:00', '2026-08-04T12:00:00Z'],
    ['negative offset', '2026-08-04T07:00:00-05:00', '2026-08-04T12:00:00Z'],
    ['zero offset', '2026-08-04T12:00:00+00:00', '2026-08-04T12:00:00Z'],
    ['lowercase designators', '2026-08-04t12:00:00z', '2026-08-04T12:00:00Z'],
    ['zero fraction', '2026-08-04T12:00:00.000Z', '2026-08-04T12:00:00Z'],
    ['non-zero fraction is unrepresentable', '2026-08-04T12:00:00.500Z', null],
    ['no timezone designator', '2026-08-04T12:00:00', null],
    ['date only', '2026-08-04', null],
    ['expanded year', '+020260-08-04T12:00:00Z', null],
    ['free text', 'shortly after noon', null],
    ['empty string', '', null],
    ['null', null, null],
    ['epoch milliseconds', 1785844800000, null],
    ['object', {}, null],
  ]) {
    assert.equal(canonicalRecordInstant(value), expected, label);
  }
  assert.equal(
    canonicalRecordInstant('2026-08-04T14:00:00+02:00'),
    canonicalRecordInstant('2026-08-04T12:00:00Z'),
    'an offset and a Z rendering of the same instant must canonicalise identically',
  );
});

test('T41 an exact canonical grant reaches signature verification and yields no errors', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, AUTHORIZED_OPTIONS));
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(report.errors, []);
    assert.equal(report.counts.execution_authorized, 1);
  });

  // Proof the verifier is genuinely reached rather than skipped: the same exactly valid
  // document under a signature over other bytes fails with the signature finding alone.
  await withRoot((root) => {
    const record = buildRecord(root, AUTHORIZED_OPTIONS);
    const resigned = canonicalBytes(grantValue({
      runner: { aggregate_sha256: sha256('t41-unsigned-runner-aggregate\n') },
    }));
    writeFileSync(resolve(root, `${RECORD_DIR}/grant.json`), resigned);
    const grant = record.evidence.artifacts.find((entry) => entry.kind === 'grant');
    grant.sha256 = sha256(resigned);
    record.authorization.grant_sha256 = grant.sha256;
    writeRecord(root, record);
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(
      report.errors,
      [`${RECORD_PATH}: ${FOUNDER_SIGNATURE_FINDING}`],
      'a real signature failure keeps exactly the generic signature finding',
    );
  });
});

test('T42 a grant binding any digest but the pinned proposed one refuses', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      grantArtifact: {
        grant: {
          record: { path: RECORD_PATH, sha256: sha256('t42-unpinned-record-bytes\n') },
        },
      },
    }));
    assert.deepEqual(
      validateTopologyRehearsals({ root }).errors,
      [grantDocumentError(GRANT_RECORD_BINDING_FINDING)],
      'a drifted proposed-record binding must refuse with exactly its own cause',
    );
  });

  // The current record's own digest is the fixed point the pinned proposed digest exists to
  // avoid: the record embeds grant_sha256 and the grant embeds the record digest, so naming
  // the current hash can only ever name stale bytes.
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, AUTHORIZED_OPTIONS));
    const currentRecordSha256 = sha256(readFileSync(resolve(root, RECORD_PATH)));
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      grantArtifact: {
        grant: { record: { path: RECORD_PATH, sha256: currentRecordSha256 } },
      },
    }));
    assert.ok(
      validateTopologyRehearsals({ root }).errors
        .some((error) => error === grantDocumentError(GRANT_RECORD_BINDING_FINDING)),
      'a self-binding grant must fail closed on the record binding',
    );
  });
});

test('T43 a grant authorizing a different action refuses with its exact cause', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      grantArtifact: { grant: { authorizes: 'different_action' } },
    }));
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(report.errors, [grantDocumentError(GRANT_AUTHORIZES_FINDING)]);
    assert.equal(formatTopologyRehearsalReport(report).exitCode, 1);
  });
});

test('T44 compact grant bytes refuse before any ssh-keygen verification', async () => {
  await withRoot((root) => {
    // The compact bytes are the bytes that were actually signed, so the detached SSHSIG over
    // them is valid. The absence of the generic signature finding is the proof that the
    // canonical-bytes gate refused the grant before the verifier could ever run.
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      grantArtifact: { bytes: Buffer.from(JSON.stringify(grantValue())) },
    }));
    assert.deepEqual(
      validateTopologyRehearsals({ root }).errors,
      [grantDocumentError(GRANT_CANONICAL_BYTES_FINDING)],
    );
  });
});

test('T45 an offset recorded_at admits identically and an out-of-window one refuses', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      recordedAt: '2026-08-04T14:00:00+02:00',
    }));
    assert.deepEqual(
      validateTopologyRehearsals({ root }).errors,
      [],
      'an offset rendering of the admitted instant must behave exactly like its Z rendering',
    );
  });

  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      recordedAt: '2026-08-04T12:02:00Z',
    }));
    assert.deepEqual(
      validateTopologyRehearsals({ root }).errors,
      [grantDocumentError(GRANT_WINDOW_ADMISSION_FINDING)],
      'the authorized window is open at expires_at, so that instant admits nothing',
    );
  });

  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      recordedAt: '2026-08-04T13:00:00+02:00',
    }));
    assert.ok(
      validateTopologyRehearsals({ root }).errors
        .some((error) => error === grantDocumentError(GRANT_WINDOW_ADMISSION_FINDING)),
      'an offset instant genuinely before not_before must still refuse',
    );
  });
});

test('T46 an unrepresentable recorded_at refuses admission with its exact cause', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      recordedAt: '2026-08-04T12:00:00.500Z',
    }));
    assert.ok(
      validateTopologyRehearsals({ root }).errors
        .some((error) => error === `${RECORD_PATH}: ${GRANT_ADMISSION_INSTANT_FINDING}`),
      'a sub-second admission instant cannot be truncated into the canonical instant',
    );
  });
});

test('T47 a free-text or non-.json grant never falls back to SSHSIG-only acceptance', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      grantArtifact: {
        fileName: 'grant.txt',
        bytes: Buffer.from('The Founder said yes.\n', 'utf8'),
      },
    }));
    const report = validateTopologyRehearsals({ root });
    assert.deepEqual(
      report.errors,
      [`${RECORD_PATH}: ${GRANT_ARTIFACT_SUFFIX_FINDING}`],
      'the path suffix is a terminal document cause before bytes or signature are judged',
    );
  });

  // A conforming grant document wearing another suffix is still refused on its path alone.
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      grantArtifact: { fileName: 'grant.txt' },
    }));
    assert.deepEqual(
      validateTopologyRehearsals({ root }).errors,
      [`${RECORD_PATH}: ${GRANT_ARTIFACT_SUFFIX_FINDING}`],
    );
  });
});

test('T47.1 a canonical grant wearing a non-.json suffix never reaches signature verification', async () => {
  await withRoot((root) => {
    const built = buildRecord(root, {
      ...AUTHORIZED_OPTIONS,
      grantArtifact: { fileName: 'grant.txt' },
    });
    const signature = built.evidence.artifacts.find(
      (entry) => entry.kind === 'authorization_signature',
    );
    const invalidSignatureBytes = Buffer.from('not an ssh signature\n', 'utf8');
    const invalidSignatureSha256 = sha256(invalidSignatureBytes);
    writeFileSync(resolve(root, signature.path), invalidSignatureBytes);
    const record = {
      ...built,
      authorization: {
        ...built.authorization,
        signature_sha256: invalidSignatureSha256,
      },
      evidence: {
        ...built.evidence,
        artifacts: built.evidence.artifacts.map((entry) => (
          entry.kind === 'authorization_signature'
            ? { ...entry, sha256: invalidSignatureSha256 }
            : entry
        )),
      },
    };
    writeRecord(root, record);
    assert.deepEqual(
      validateTopologyRehearsals({ root }).errors,
      [`${RECORD_PATH}: ${GRANT_ARTIFACT_SUFFIX_FINDING}`],
      'an invalid signature must remain unobserved when the grant path is already terminally invalid',
    );
  });
});

test('T48 every closed grant artifact is judged by the same mandatory contract', async () => {
  await withRoot((root) => {
    writeRecord(root, buildRecord(root, CLOSED_RECORD_OPTIONS));
    assert.deepEqual(validateTopologyRehearsals({ root }).errors, []);
  });

  await withRoot((root) => {
    writeRecord(root, buildRecord(root, {
      ...CLOSED_RECORD_OPTIONS,
      grantArtifact: { grant: { authorizes: 'different_action' } },
    }));
    assert.deepEqual(
      validateTopologyRehearsals({ root }).errors,
      [grantDocumentError(GRANT_AUTHORIZES_FINDING)],
      'a closed record is judged by the same exact-action grant contract as an authorized one',
    );
  });
});
