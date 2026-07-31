// Gate W2-K server-neutral transport peer-evidence proposal validator.
// Static, deterministic and read-only. Green means PROPOSED conformance only.

import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');
const STATUS = 'PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED';

export const EXAMPLES_MANIFEST_PATH =
  'contracts/examples/transport-peer/examples-manifest.json';
export const COMPATIBILITY_MANIFEST_PATH =
  'contracts/compatibility/cybrik-suite-transport-peer-evidence-packet.v1.manifest.json';
const EVIDENCE_SCHEMA_PATH =
  'contracts/json-schema/cybrik.transport-peer-evidence.v1.schema.json';
const ERROR_SCHEMA_PATH =
  'contracts/json-schema/cybrik.transport-peer-evidence-error.v1.schema.json';

const FIXTURE_PATHS = [
  'contracts/examples/transport-peer/negative-schema/peer-evidence-error.leaky-error-body.json',
  'contracts/examples/transport-peer/negative-schema/peer-evidence.client-supplied-thumbprint-source.json',
  'contracts/examples/transport-peer/negative-schema/peer-evidence.conveys-authorization-true.json',
  'contracts/examples/transport-peer/negative-schema/peer-evidence.raw-certificate-material.json',
  'contracts/examples/transport-peer/negative-schema/peer-evidence.root-authority-axis.json',
  'contracts/examples/transport-peer/negative-schema/peer-evidence.sha1-thumbprint-alg.json',
  'contracts/examples/transport-peer/negative-schema/peer-evidence.trusted-boundary-adapter.json',
  'contracts/examples/transport-peer/negative-semantic/peer-evidence.chain-not-verified.json',
  'contracts/examples/transport-peer/negative-semantic/peer-evidence.channel-evidence-absent.json',
  'contracts/examples/transport-peer/negative-semantic/peer-evidence.channel-evidence-held.json',
  'contracts/examples/transport-peer/negative-semantic/peer-evidence.not-mutual-tls.json',
  'contracts/examples/transport-peer/negative-semantic/peer-evidence.peer-thumbprint-absent.json',
  'contracts/examples/transport-peer/negative-semantic/peer-evidence.relying-party-thumbprint-mismatch.json',
  'contracts/examples/transport-peer/negative-semantic/peer-evidence.token-cnf-thumbprint-mismatch.json',
  'contracts/examples/transport-peer/negative-semantic/peer-evidence.unverified-thumbprint-source.json',
  'contracts/examples/transport-peer/positive/peer-evidence-error.chain-not-verified.json',
  'contracts/examples/transport-peer/positive/peer-evidence.verified-chain.json',
  'contracts/examples/transport-peer/positive/truth-table.no-degrade.json',
];

export const expectedPacketPaths = [EXAMPLES_MANIFEST_PATH, ...FIXTURE_PATHS];
export const PACKET_DOC_PATHS = [
  EVIDENCE_SCHEMA_PATH,
  ERROR_SCHEMA_PATH,
  COMPATIBILITY_MANIFEST_PATH,
  'docs/adr/ADR-0013-transport-peer-evidence-adapter-profile.md',
  'docs/adr/DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE.md',
  'docs/architecture/transport-peer-evidence/README.md',
  'docs/architecture/transport-peer-evidence/01-server-candidate-matrix.md',
];

export const ACCEPTED_DEPENDENCY_PINS = Object.freeze({
  'contracts/json-schema/cybrik.svc-common-defs.v1.schema.json':
    'c1c884abd5587b7659b703d98e2b24019dfdb346950732c33541da6482889f40',
});

export const DENIAL_CLASSES = Object.freeze([
  'TPE_CHAIN_NOT_VERIFIED',
  'TPE_CHANNEL_EVIDENCE_ABSENT',
  'TPE_CHANNEL_EVIDENCE_HELD',
  'TPE_NOT_MUTUAL_TLS',
  'TPE_PEER_THUMBPRINT_ABSENT',
  'TPE_RELYING_PARTY_THUMBPRINT_MISMATCH',
  'TPE_TOKEN_CNF_THUMBPRINT_MISMATCH',
  'TPE_UNVERIFIED_THUMBPRINT_SOURCE',
]);

export const FORBIDDEN_CHANNEL_PROPERTY_KEYS = Object.freeze([
  'peer_certificate_pem',
  'peer_certificate_der',
  'peer_public_key',
  'peer_subject',
  'peer_subject_alt_names',
  'header_thumbprint',
  'x_forwarded_client_cert',
]);

export const NEGATIVE_TEST_MAP = Object.freeze([
  { id: 'N1', coverage: 'requires_runtime', basis: 'Durable replay requires a real PostgreSQL-backed round trip.' },
  { id: 'N2', coverage: 'covered_statically', basis: 'Three-way thumbprint mismatch denies deterministically.' },
  { id: 'N3', coverage: 'covered_statically', basis: 'Audience remains an accepted W2-F token validation invariant.' },
  { id: 'N4', coverage: 'covered_statically', basis: 'Scope remains an accepted W2-F token validation invariant.' },
  { id: 'N5', coverage: 'covered_statically', basis: 'Operation binding remains an accepted W2-F token invariant.' },
  { id: 'N6', coverage: 'covered_statically', basis: 'Tenant mismatch remains an accepted W2-F fail-closed invariant.' },
  { id: 'N7', coverage: 'covered_statically', basis: 'Tenant-org advisory mismatch remains fail closed.' },
  { id: 'N8', coverage: 'covered_statically', basis: 'Absent or held channel evidence cannot degrade to accept.' },
  { id: 'N9', coverage: 'requires_runtime', basis: 'Database unavailability requires the future PostgreSQL harness.' },
  { id: 'N10', coverage: 'covered_statically', basis: 'Raw certificate, token and secret material is structurally inexpressible.' },
]);

export const RUNTIME_ONLY_PROPERTIES = Object.freeze([
  'separate_process_boundary',
  'loopback_tls_socket',
  'ephemeral_out_of_repo_dev_pki',
  'postgresql_durable_replay',
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const dependencyRequire = () => {
  const localRequire = createRequire(join(HERE, 'package.json'));
  try {
    localRequire.resolve('ajv/dist/2020.js');
    return localRequire;
  } catch {
    const dotGit = join(DEFAULT_ROOT, '.git');
    let commonGitDir;
    if (lstatSync(dotGit).isDirectory()) {
      commonGitDir = realpathSync(dotGit);
    } else {
      const pointer = readFileSync(dotGit, 'utf8').trim();
      if (!pointer.startsWith('gitdir: ')) throw new Error('unrecognized worktree git pointer');
      const worktreeGitDir = realpathSync(resolve(DEFAULT_ROOT, pointer.slice(8)));
      const commonRelative = readFileSync(join(worktreeGitDir, 'commondir'), 'utf8').trim();
      commonGitDir = realpathSync(resolve(worktreeGitDir, commonRelative));
    }
    return createRequire(join(dirname(commonGitDir), 'tools/contract-validation/package.json'));
  }
};

const requireFromToolchain = dependencyRequire();
const AjvModule = requireFromToolchain('ajv/dist/2020.js');
const Ajv2020 = AjvModule.default || AjvModule;

const deny = (denialClass) => ({
  accepted: false,
  denialClass,
  degraded: false,
});

export const evaluatePeerEvidence = (evidence) => {
  const channel = evidence?.channel;
  if (!channel || channel.evidence_state === 'absent' || !channel.evidence_state) {
    return deny('TPE_CHANNEL_EVIDENCE_ABSENT');
  }
  if (channel.evidence_state === 'held') return deny('TPE_CHANNEL_EVIDENCE_HELD');
  if (channel.mutual_tls !== true) return deny('TPE_NOT_MUTUAL_TLS');
  if (channel.chain_verified !== true) return deny('TPE_CHAIN_NOT_VERIFIED');
  const peer = channel.peer_thumbprint?.value;
  if (!peer) return deny('TPE_PEER_THUMBPRINT_ABSENT');
  if (channel.peer_thumbprint_source !== 'server_verified_chain') {
    return deny('TPE_UNVERIFIED_THUMBPRINT_SOURCE');
  }
  if (evidence?.relying_party?.peer_cert_thumbprint?.value !== peer) {
    return deny('TPE_RELYING_PARTY_THUMBPRINT_MISMATCH');
  }
  if (evidence?.token_confirmation?.cnf?.['x5t#S256'] !== peer) {
    return deny('TPE_TOKEN_CNF_THUMBPRINT_MISMATCH');
  }
  return { accepted: true, denialClass: null, degraded: false };
};

export const noDegradeTruthTable = () => {
  const rows = [];
  for (const mutualTls of [false, true]) {
    for (const chainVerified of [false, true]) {
      for (const thumbprintPresent of [false, true]) {
        let denialClass = null;
        if (!mutualTls) denialClass = 'TPE_NOT_MUTUAL_TLS';
        else if (!chainVerified) denialClass = 'TPE_CHAIN_NOT_VERIFIED';
        else if (!thumbprintPresent) denialClass = 'TPE_PEER_THUMBPRINT_ABSENT';
        rows.push({
          mutual_tls: mutualTls,
          chain_verified: chainVerified,
          thumbprint_present: thumbprintPresent,
          accepted: denialClass === null,
          denialClass,
          degraded: false,
        });
      }
    }
  }
  return rows;
};

export const validateTransportPeerPacket = ({
  root = DEFAULT_ROOT,
  overrides = new Map(),
} = {}) => {
  const errors = [];
  const rootReal = realpathSync(root);
  const isOutsideRoot = (candidateRelative) =>
    candidateRelative === '..' ||
    candidateRelative.startsWith(`..${sep}`) ||
    isAbsolute(candidateRelative);
  const resolveContainedRegularFile = (relativePath) => {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      throw new Error('packet path must be a non-empty string');
    }
    const candidate = resolve(rootReal, relativePath);
    if (isOutsideRoot(relative(rootReal, candidate))) {
      throw new Error(`${relativePath}: path is outside repository root`);
    }
    const stats = lstatSync(candidate);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`${relativePath}: not a regular file`);
    }
    const targetReal = realpathSync(candidate);
    if (isOutsideRoot(relative(rootReal, targetReal))) {
      throw new Error(`${relativePath}: resolved target is outside repository root`);
    }
    return targetReal;
  };
  const readText = (relativePath) => {
    if (overrides.has(relativePath)) return overrides.get(relativePath);
    return readFileSync(resolveContainedRegularFile(relativePath));
  };
  const readJson = (relativePath) => JSON.parse(readText(relativePath).toString('utf8'));
  const requirePath = (relativePath) => {
    try {
      resolveContainedRegularFile(relativePath);
      return true;
    } catch {
      errors.push(`${relativePath}: required W2-K packet path is missing or not a regular file`);
      return false;
    }
  };

  for (const relativePath of [
    ...expectedPacketPaths,
    ...PACKET_DOC_PATHS,
    ...Object.keys(ACCEPTED_DEPENDENCY_PINS),
  ]) requirePath(relativePath);

  let evidenceSchema;
  let errorSchema;
  let examplesManifest;
  let compatibilityManifest;
  let validateEvidence = () => false;
  let validateError = () => false;
  let schemasCompiled = 0;
  let unresolvedRefs = 0;
  try {
    evidenceSchema = readJson(EVIDENCE_SCHEMA_PATH);
    errorSchema = readJson(ERROR_SCHEMA_PATH);
    examplesManifest = readJson(EXAMPLES_MANIFEST_PATH);
    compatibilityManifest = readJson(COMPATIBILITY_MANIFEST_PATH);
    const commonDefs = readJson(Object.keys(ACCEPTED_DEPENDENCY_PINS)[0]);
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    ajv.addSchema(commonDefs);
    validateEvidence = ajv.compile(evidenceSchema);
    schemasCompiled += 1;
    validateError = ajv.compile(errorSchema);
    schemasCompiled += 1;
  } catch (error) {
    unresolvedRefs += 1;
    errors.push(`schema compilation or unresolved reference: ${error.message}`);
  }

  const fixtures = examplesManifest?.fixtures ?? [];
  const byKind = (kind) => fixtures.filter((entry) => entry.kind === kind);
  for (const entry of fixtures) {
    const relativePath = `contracts/examples/transport-peer/${entry.file}`;
    try {
      const bytes = readText(relativePath);
      if (sha256(bytes) !== entry.sha256) errors.push(`${relativePath}: example sha256 mismatch`);
      const value = JSON.parse(bytes.toString('utf8'));
      const validator = entry.schema === 'error' ? validateError : validateEvidence;
      if (entry.kind === 'positive' && entry.schema !== 'truth-table' && !validator(value)) {
        errors.push(`${relativePath}: positive fixture rejected`);
      }
      if (entry.kind === 'negative-schema' && validator(value)) {
        errors.push(`${relativePath}: negative-schema fixture accepted`);
      }
      if (entry.kind === 'negative-semantic') {
        const verdict = evaluatePeerEvidence(value);
        if (verdict.accepted || verdict.denialClass !== entry.expected_denial_class) {
          errors.push(`${relativePath}: semantic denial mismatch`);
        }
      }
    } catch (error) {
      errors.push(`${relativePath}: fixture validation failed: ${error.message}`);
    }
  }

  for (const [relativePath, digest] of Object.entries(ACCEPTED_DEPENDENCY_PINS)) {
    try {
      if (sha256(readText(relativePath)) !== digest) {
        errors.push(`${relativePath}: accepted dependency sha256 mismatch`);
      }
    } catch {
      // requirePath already records the fail-closed finding.
    }
  }

  const integrity = compatibilityManifest?.['x-cybrik-packet-integrity'];
  if (integrity) {
    for (const entry of integrity.member_digests ?? []) {
      const relativePath = `contracts/${entry.file}`;
      try {
        if (sha256(readText(relativePath)) !== entry.sha256) {
          errors.push(`${relativePath}: member sha256 mismatch`);
        }
      } catch (error) {
        errors.push(
          `${relativePath}: member sha256 mismatch because the member is unreadable: ${error.message}`,
        );
      }
    }
    const aggregate = [...(integrity.member_digests ?? [])]
      .sort((left, right) => left.file.localeCompare(right.file))
      .map((entry) => `${entry.sha256}  ${entry.file}`)
      .join('\n');
    if (sha256(Buffer.from(aggregate, 'utf8')) !== integrity.aggregate_sha256) {
      errors.push(`${COMPATIBILITY_MANIFEST_PATH}: aggregate sha256 mismatch`);
    }
  }

  const semanticFixtures = byKind('negative-semantic');
  return {
    status: compatibilityManifest?.['x-cybrik-status']?.split(' — ')[0] ?? 'UNKNOWN',
    notAccepted: compatibilityManifest?.['x-cybrik-status']?.includes('NOT ACCEPTED') ?? false,
    notImplemented: compatibilityManifest?.['x-cybrik-status']?.includes('NOT IMPLEMENTED') ?? false,
    packetVersion: compatibilityManifest?.packet_version,
    gate: compatibilityManifest?.gate?.id,
    gateDisposition: compatibilityManifest?.gate?.disposition,
    errors,
    validateEvidence,
    validateError,
    counts: {
      schemasCompiled,
      unresolvedRefs,
      positiveFixtures: byKind('positive').length,
      negativeSchemaFixtures: byKind('negative-schema').length,
      negativeSemanticFixtures: semanticFixtures.length,
      negativeSemanticDeniedExactly: semanticFixtures.filter((entry) => {
        try {
          const value = readJson(`contracts/examples/transport-peer/${entry.file}`);
          const verdict = evaluatePeerEvidence(value);
          return !verdict.accepted && verdict.denialClass === entry.expected_denial_class;
        } catch {
          return false;
        }
      }).length,
      packetMembers: compatibilityManifest?.members?.length ?? 0,
    },
  };
};

export const formatTransportPeerReport = (report) => {
  if (report.errors.length) {
    return {
      exitCode: 1,
      stdout: `W2-K TRANSPORT PEER: FAIL (${report.errors.length} error(s))\n${report.errors.join('\n')}\n`,
    };
  }
  return {
    exitCode: 0,
    stdout:
      `W2-K TRANSPORT PEER: PASS — ${STATUS}; ` +
      'static conformance only, no runtime, UAT, release or production proof.\n',
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const rendered = formatTransportPeerReport(validateTransportPeerPacket());
  process.stdout.write(rendered.stdout);
  process.exitCode = rendered.exitCode;
}
