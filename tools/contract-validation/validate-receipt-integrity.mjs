// Standalone static validator for the F8 receipt-integrity signature profile
// packet. The packet is `PROPOSED` and **NOT ACCEPTED**.
//
// ADR-0004 F8 deferred the receipt-signing envelope. This packet proposes one
// candidate profile and freezes a reproducible test vector for it. Exit 0 proves
// only that the proposed profile is internally consistent, that the frozen vector
// is cryptographically well formed under Ed25519, and that the declared rejection
// inventory really rejects. Exit 0 decides no ADR, implements no runtime, closes
// no F8 deferral, promotes nothing to stable v1/GA, and authorizes no signer,
// issuer, key lifecycle or production deployment.
//
// Declared standalone commands, run from tools/contract-validation:
//
//   node validate-receipt-integrity.mjs
//   node --test tests/validate-receipt-integrity.test.mjs
//
// Neither command installs anything, reads a secret, or reaches the network. The
// validator needs no node_modules: it verifies Ed25519 through node:crypto and
// reuses two already-exported pure helpers from the accepted validators rather
// than re-implementing them (DRY; neither accepted file is modified):
//   * canonicalizeJcs        — RFC 8785 JSON Canonicalization Scheme rendering
//   * validateJsonSchemaValue — the corpus' dependency-free JSON Schema subset
// Set CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT for the test suite only, which pulls
// official Ajv 2020-12 from an existing install to cross-check the two schemas.

import { createHash, createPublicKey, verify as edVerify } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { canonicalizeJcs } from './validate-alert-context.mjs';
import { validateJsonSchemaValue } from './validate-investigation-lifecycle-proposal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '../..');

// ---------------------------------------------------------------------------
// Proposed profile constants. Every one of these is a PROPOSAL, not a decision.
// ---------------------------------------------------------------------------

export const RECEIPT_DIGEST_PROFILE = 'CYBRIK-RECEIPT-JCS/v1';
export const SIGNATURE_ENVELOPE_PROFILE = 'CYBRIK-RECEIPT-JWS/v1';
export const CANONICALIZATION_ID = 'RFC8785-JCS';
export const PROFILE_VERSION = '0.1.0';
export const JWS_TYP = 'application/cybrik-receipt-signature-statement+json';
export const SIGNER_ROLE = 'tool-fabric-control-plane';
export const TRUST_BUNDLE_URI = 'cybrik-trust://receipt-signers/v1';
export const RECEIPT_CONTRACT_ID =
  'https://contracts.cybrik.example/json-schema/cybrik.execution-receipt.v1.schema.json';
export const RECEIPT_CONTRACT_VERSION = '0.1.0';

// Fields stripped from the exact transmitted receipt before canonicalization.
// Nothing else is stripped and no schema `default` is ever injected.
export const RECEIPT_DIGEST_EXCLUDED_KEYS = ['receipt_digest', 'signature'];

// Schema `default: []` sites on cybrik.execution-receipt.v1. The profile MUST
// NOT materialize any of them; an absent array and an explicitly empty array are
// two different receipts with two different digests.
const RECEIPT_DEFAULT_INJECTION_KEYS = ['input_artifact_digests', 'output_artifacts'];

const ALLOWED_HEADER_KEYS = ['alg', 'kid', 'typ'];
// Every JOSE header parameter that would let a verifier take a key from the
// message itself or fetch one over the network, plus the detached/unencoded
// payload switch. The exact-key-set rule above already excludes them; they are
// enumerated so a violation names the specific attack.
const FORBIDDEN_HEADER_KEYS = [
  'b64',
  'crit',
  'epk',
  'jku',
  'jwk',
  'x5c',
  'x5t',
  'x5t#S256',
  'x5u',
];
const KEY_MATERIAL_KEYS = ['d', 'e', 'jwk', 'k', 'n', 'x', 'y'];

const KID_PATTERN = /^cybrik-receipt-signer:v1:[0-9a-f]{64}$/;
const LOCATOR_PATTERN =
  /^cybrik-ledger:\/\/receipt-signatures\/sha256\/[0-9a-f]{64}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const ED25519_SIGNATURE_BYTES = 64;

const PROPOSED_STATUS = 'PROPOSED';
const PACKET_VERSION = '0.1.0';
const PACKET_INTEGRITY_KEY = 'x-cybrik-packet-integrity';
const CONTRACTS_PATH_ROOT = 'contracts/';

// Status-honesty scan. The literals below are the only sanctioned uses of the
// otherwise-forbidden wording, so they are deleted from the scan text first and
// every surviving occurrence is a real overclaim. Keeping the sanctioned forms
// as exact literals is what stops a reviewer-invisible promotion from slipping
// in behind a near-miss paraphrase.
const SANCTIONED_STATUS_LITERALS = [
  'NOT IMPLEMENTED',
  'not stable v1/GA',
  'no stable v1 and no GA claim',
  'no GA claim',
];
const FORBIDDEN_STATUS_TOKENS = [
  'ACCEPTED FOR IMPLEMENTATION',
  'IMPLEMENTED',
  'VERIFIED',
  'PILOTED',
];
const FORBIDDEN_SELF_CLAIM_PATTERNS = [
  /\b(?:closes|closed|closing|resolves|resolved|decides|decided) (?:ADR-0004 )?F8\b/i,
  /\bF8 (?:is |has been )?(?:closed|resolved|decided|implemented)\b/i,
  /(?<!not )(?<!no )\bstable v1\b/,
  /\bGA\b/,
  /\bthis (?:packet|profile|proposal) is (?:accepted|decided|implemented|verified|piloted)\b/i,
  /\b(?:ADR|gate) decision (?:is )?recorded\b/i,
];

const statusHonestyViolations = (text) => {
  let scan = text;
  for (const literal of SANCTIONED_STATUS_LITERALS) scan = scan.split(literal).join(' ');
  const violations = [];
  for (const token of FORBIDDEN_STATUS_TOKENS) {
    if (scan.includes(token)) violations.push(`forbidden status token '${token}'`);
  }
  for (const pattern of FORBIDDEN_SELF_CLAIM_PATTERNS) {
    const match = pattern.exec(scan);
    if (match) violations.push(`forbidden self-promotion wording '${match[0]}'`);
  }
  return violations;
};

// ---------------------------------------------------------------------------
// Rejection inventory. Four negative fixtures live on disk; the inventory below
// is wider than the fixture set on purpose, so every rule is exercised by at
// least one in-process mutation probe even where no fixture exists.
// ---------------------------------------------------------------------------

export const REJECTION_INVENTORY = [
  {
    id: 'RI-1',
    category: 'canonicalization',
    rule: "The declared digest profile must be CYBRIK-RECEIPT-JCS/v1 with canonicalization RFC8785-JCS on both the envelope and the signed statement, and the declared receipt_digest must equal the digest recomputed from the exact transmitted receipt with only receipt_digest and signature removed and no schema default injected.",
  },
  {
    id: 'RI-2',
    category: 'locator',
    rule: 'signature_locator must match cybrik-ledger://receipt-signatures/sha256/<64 lowercase hex> and the hex must equal the SHA-256 of the exact compact JWS bytes.',
  },
  {
    id: 'RI-3',
    category: 'header-grammar',
    rule: 'The compact JWS must have exactly three non-empty strict base64url segments (payload included, never detached), and the protected header must decode to a JSON object whose key set is exactly {alg, kid, typ} with the pinned typ and a kid matching every other kid in the envelope and statement.',
  },
  {
    id: 'RI-4',
    category: 'algorithm',
    rule: 'alg must be EdDSA over an OKP/Ed25519 key in both the protected header and the envelope. alg=none and every other algorithm are rejected, as is b64=false.',
  },
  {
    id: 'RI-5',
    category: 'embedded-or-remote-key',
    rule: 'No embedded or remote key may appear anywhere: jwk, jku, x5u, x5c, x5t, x5t#S256 and epk are forbidden in the header, no key material may appear in the envelope, and kid resolves only against the pinned external trust bundle.',
  },
  {
    id: 'RI-6',
    category: 'payload-tampering',
    rule: 'The decoded payload must be byte-identical to the JCS rendering of its own parse, must deep-equal the signed-statement member, and must bind the same receipt_id and recomputed receipt_digest as the envelope and the receipt.',
  },
  {
    id: 'RI-7',
    category: 'signature-tampering',
    rule: 'The signature segment must be exactly 64 bytes and must verify as Ed25519 over the ASCII bytes of "<protected>.<payload>" under the trust-bundle public key selected by kid.',
  },
];

const REJECTION_IDS = REJECTION_INVENTORY.map((entry) => entry.id);

// ---------------------------------------------------------------------------
// Packet inventory.
// ---------------------------------------------------------------------------

const schemaPaths = [
  'contracts/json-schema/cybrik.receipt-signature-statement.v1.schema.json',
  'contracts/json-schema/cybrik.receipt-signature-envelope.v1.schema.json',
];

const positiveFixturePaths = [
  'contracts/examples/receipt-integrity/positive/receipt-signature-statement.json',
  'contracts/examples/receipt-integrity/positive/receipt-signature-envelope.json',
];

const negativeFixturePaths = [
  'contracts/examples/receipt-integrity/negative/envelope.wrong-canonicalization.json',
  'contracts/examples/receipt-integrity/negative/envelope.alg-none.json',
  'contracts/examples/receipt-integrity/negative/envelope.embedded-jwk.json',
  'contracts/examples/receipt-integrity/negative/envelope.tampered-payload.json',
];

export const COMPATIBILITY_PATH =
  'contracts/compatibility/cybrik-suite-receipt-integrity-proposal.v1.manifest.json';
export const EXAMPLES_MANIFEST_PATH =
  'contracts/examples/receipt-integrity/examples-manifest.json';

export const expectedPacketPaths = [
  ...schemaPaths,
  COMPATIBILITY_PATH,
  EXAMPLES_MANIFEST_PATH,
  ...positiveFixturePaths,
  ...negativeFixturePaths,
];

const PACKET_MEMBER_COUNT = expectedPacketPaths.length;

// Accepted schemas this packet reuses by $ref without changing a byte.
const acceptedRefPaths = [
  'contracts/json-schema/cybrik.common-defs.v1.schema.json',
  'contracts/json-schema/cybrik.execution-receipt.v1.schema.json',
];

export const expectedVerificationCommands = {
  workspace: 'tools/contract-validation',
  workspace_note:
    'Both commands run with tools/contract-validation as the working directory. The standalone validator needs no node_modules; the test suite pulls the already-pinned ajv 8.20.0 / ajv-formats 3.0.1 from the local install, or from the directory named by CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT. This packet installs nothing, adds no dependency, and reaches no network.',
  orchestrator_registration:
    'REGISTERED — validate-receipt-integrity.mjs is a step in tools/contract-validation/validate.mjs and both commands are package.json scripts. Registration is local orchestration only: no CI pipeline was run, no CI result is claimed, and the test file is deliberately NOT added to W1_CONTRACT_TEST_FILES so the pinned W1 contract-test count is unchanged.',
  standalone_validator: 'node validate-receipt-integrity.mjs',
  tests: 'node --test tests/validate-receipt-integrity.test.mjs',
};

export const expectedPacketIntegrityDeclaration = {
  algorithm: 'sha256',
  member_count: PACKET_MEMBER_COUNT,
  path_root: CONTRACTS_PATH_ROOT,
  file_digest_rule: `Every member except this manifest is digested as the lowercase hex SHA-256 of the exact on-disk UTF-8 bytes of '<path_root><file>'.`,
  self_digest_rule: `This manifest's own member digest is deliberately NOT taken over its on-disk bytes. It is the lowercase hex SHA-256 of the UTF-8 encoding of JSON.stringify(this manifest parsed as JSON with the top-level '${PACKET_INTEGRITY_KEY}' key removed). Because the hashed input excludes the integrity block, no digest input ever contains a digest, which is what makes the self entry and the aggregate below non-circular and independently reproducible. Consequence, stated deliberately: for this one member the digest pins the JSON value, not the on-disk byte formatting.`,
  aggregate_algorithm: `Sort all ${PACKET_MEMBER_COUNT} member entries ascending by 'file' using JavaScript default string comparison, render each entry as the line '<sha256>  <file>' (two spaces), join the lines with a single '\\n' and no trailing newline, then take the lowercase hex SHA-256 of the UTF-8 encoding of that string. The aggregate consumes only the ${PACKET_MEMBER_COUNT} member digests, so it never depends on its own value.`,
};

const expectedManifestTopLevelKeys = [
  '$schema',
  '$id',
  'title',
  'description',
  'x-cybrik-status',
  'x-cybrik-not-accepted',
  'x-cybrik-packet-version',
  'x-cybrik-is-bundle-tag',
  'format_pins',
  'collision_status_map',
  'ownership',
  'members',
  'reuses_unmodified',
  'digest_profile',
  'signature_profile',
  'rejection_inventory',
  'runtime_invariants',
  'authority_invariants',
  'future_prerequisites',
  'open_decisions',
  'verification_commands',
  PACKET_INTEGRITY_KEY,
  'gate',
].sort();

// The five prerequisites F8 cannot close by itself. The evidence document and
// the manifest must both carry them; the validator fails closed if one is lost.
export const expectedFuturePrerequisites = [
  'credential-lease',
  'workload-attestation',
  'production-issuer-and-signer',
  'key-lifecycle',
  'receipt-ledger-durability',
];

// ---------------------------------------------------------------------------
// Profile primitives.
// ---------------------------------------------------------------------------

const sha256Hex = (input) => createHash('sha256').update(input).digest('hex');
const utf8 = (text) => Buffer.from(text, 'utf8');
const jcsBytes = (value) => utf8(canonicalizeJcs(value));
const same = (left, right) => canonicalizeJcs(left) === canonicalizeJcs(right);

/**
 * CYBRIK-RECEIPT-JCS/v1. The hash input is the UTF-8 profile id, one NUL byte,
 * then the JCS bytes of the exact transmitted receipt with only `receipt_digest`
 * and `signature` removed. The NUL separator makes the profile id unambiguously
 * non-splittable from the canonical payload, so a receipt can never be replayed
 * under a different profile id.
 */
export const canonicalReceiptDigest = (receipt) => {
  const content = { ...receipt };
  for (const key of RECEIPT_DIGEST_EXCLUDED_KEYS) delete content[key];
  return `sha256:${sha256Hex(
    Buffer.concat([utf8(RECEIPT_DIGEST_PROFILE), Buffer.from([0]), jcsBytes(content)]),
  )}`;
};

/** Lowercase hex SHA-256 of the exact compact JWS bytes, wrapped in the locator. */
export const computeSignatureLocator = (jwsCompact) =>
  `cybrik-ledger://receipt-signatures/sha256/${sha256Hex(Buffer.from(jwsCompact, 'ascii'))}`;

/**
 * kid is the hex-encoded SHA-256 over the RFC 7638 thumbprint input for an OKP
 * key — JCS of exactly {crv, kty, x}. RFC 7638 renders the digest as base64url;
 * this profile deliberately renders it as lowercase hex so the kid grammar stays
 * a single character class. That encoding choice is the only divergence.
 */
export const jwkThumbprintKid = (jwk) =>
  `cybrik-receipt-signer:v1:${sha256Hex(jcsBytes({ crv: jwk?.crv, kty: jwk?.kty, x: jwk?.x }))}`;

/** Digest of the pinned external trust bundle document. */
export const trustBundleDigest = (bundle) => `sha256:${sha256Hex(jcsBytes(bundle))}`;

const strictBase64Url = (segment) =>
  typeof segment === 'string'
  && BASE64URL_PATTERN.test(segment)
  && Buffer.from(segment, 'base64url').toString('base64url') === segment;

const collectKeys = (value, output = []) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, output));
  } else if (value && typeof value === 'object') {
    for (const [name, child] of Object.entries(value)) {
      output.push(name);
      collectKeys(child, output);
    }
  }
  return output;
};

// ---------------------------------------------------------------------------
// The rejection engine. Returns one entry per violated rule, tagged with the
// inventory id that owns it. An empty array means the envelope is accepted.
// ---------------------------------------------------------------------------

export function verifyReceiptSignatureEnvelope({
  envelope,
  statement,
  receipt,
  trustBundle,
}) {
  const findings = [];
  const fail = (id, message) => findings.push({ id, message });

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    fail('RI-3', 'envelope must be a JSON object');
    return findings;
  }

  // --- RI-1 canonicalization -----------------------------------------------
  const recomputedReceiptDigest = receipt ? canonicalReceiptDigest(receipt) : undefined;
  if (envelope.digest_profile !== RECEIPT_DIGEST_PROFILE) {
    fail('RI-1', `envelope.digest_profile must be ${RECEIPT_DIGEST_PROFILE}`);
  }
  if (envelope.canonicalization !== CANONICALIZATION_ID) {
    fail('RI-1', `envelope.canonicalization must be ${CANONICALIZATION_ID}`);
  }
  if (statement?.profile !== RECEIPT_DIGEST_PROFILE) {
    fail('RI-1', `statement.profile must be ${RECEIPT_DIGEST_PROFILE}`);
  }
  if (statement?.profile_version !== PROFILE_VERSION) {
    fail('RI-1', `statement.profile_version must be ${PROFILE_VERSION}`);
  }
  if (statement?.canonicalization !== CANONICALIZATION_ID) {
    fail('RI-1', `statement.canonicalization must be ${CANONICALIZATION_ID}`);
  }
  if (statement?.receipt_contract_id !== RECEIPT_CONTRACT_ID) {
    fail('RI-1', 'statement.receipt_contract_id must pin the accepted execution-receipt schema $id');
  }
  if (statement?.receipt_contract_version !== RECEIPT_CONTRACT_VERSION) {
    fail('RI-1', `statement.receipt_contract_version must be ${RECEIPT_CONTRACT_VERSION}`);
  }
  if (recomputedReceiptDigest !== undefined) {
    if (envelope.receipt_digest !== recomputedReceiptDigest) {
      fail('RI-1', 'envelope.receipt_digest does not equal the recomputed CYBRIK-RECEIPT-JCS/v1 digest');
    }
    if (statement?.receipt_digest !== recomputedReceiptDigest) {
      fail('RI-1', 'statement.receipt_digest does not equal the recomputed CYBRIK-RECEIPT-JCS/v1 digest');
    }
    // No schema default may be materialized. An absent array and an explicitly
    // empty array are distinct receipts and MUST digest differently.
    for (const key of RECEIPT_DEFAULT_INJECTION_KEYS) {
      if (Object.hasOwn(receipt, key)) continue;
      const injected = canonicalReceiptDigest({ ...receipt, [key]: [] });
      if (injected === recomputedReceiptDigest) {
        fail('RI-1', `default injection of '${key}' is indistinguishable from its absence`);
      }
      if (envelope.receipt_digest === injected || statement?.receipt_digest === injected) {
        fail('RI-1', `declared digest was computed with an injected '${key}' default`);
      }
    }
  }

  // --- RI-3 compact serialization and header grammar ------------------------
  const jws = envelope.jws_compact;
  if (typeof jws !== 'string' || jws.length === 0) {
    fail('RI-3', 'envelope.jws_compact must be a non-empty string');
    return findings;
  }
  const segments = jws.split('.');
  if (segments.length !== 3) {
    fail('RI-3', 'compact JWS must have exactly three dot-separated segments');
    return findings;
  }
  const [protectedSegment, payloadSegment, signatureSegment] = segments;
  if (payloadSegment.length === 0) {
    fail('RI-3', 'payload segment is empty — detached payloads are rejected');
  }
  for (const [label, segment] of [
    ['protected', protectedSegment],
    ['payload', payloadSegment],
    ['signature', signatureSegment],
  ]) {
    if (segment.length === 0) {
      fail('RI-3', `${label} segment is empty`);
    } else if (!strictBase64Url(segment)) {
      fail('RI-3', `${label} segment is not strict unpadded base64url`);
    }
  }

  let header;
  try {
    header = JSON.parse(Buffer.from(protectedSegment, 'base64url').toString('utf8'));
  } catch (error) {
    fail('RI-3', `protected header is not JSON: ${error.message}`);
    return findings;
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) {
    fail('RI-3', 'protected header must be a JSON object');
    return findings;
  }
  const headerKeys = Object.keys(header).sort();
  if (!same(headerKeys, [...ALLOWED_HEADER_KEYS].sort())) {
    fail(
      'RI-3',
      `protected header key set must be exactly {${ALLOWED_HEADER_KEYS.join(', ')}}; got {${headerKeys.join(', ')}}`,
    );
  }
  if (header.typ !== JWS_TYP) {
    fail('RI-3', `protected header typ must be ${JWS_TYP}`);
  }
  if (!KID_PATTERN.test(String(header.kid))) {
    fail('RI-3', 'protected header kid does not match the pinned kid grammar');
  }
  if (header.kid !== envelope.kid || header.kid !== statement?.kid) {
    fail('RI-3', 'kid must be identical in the protected header, the envelope and the statement');
  }

  // --- RI-4 algorithm --------------------------------------------------------
  if (header.alg !== 'EdDSA') {
    fail('RI-4', `protected header alg must be EdDSA; got ${JSON.stringify(header.alg)}`);
  }
  if (envelope.alg !== 'EdDSA') {
    fail('RI-4', `envelope.alg must be EdDSA; got ${JSON.stringify(envelope.alg)}`);
  }
  if (Object.hasOwn(header, 'b64')) {
    fail('RI-4', 'b64 is forbidden — the payload is always base64url-encoded and included');
  }
  if (envelope.key_type?.kty !== 'OKP' || envelope.key_type?.crv !== 'Ed25519') {
    fail('RI-4', 'envelope.key_type must be OKP/Ed25519');
  }

  // --- RI-5 embedded and remote keys ----------------------------------------
  for (const forbidden of FORBIDDEN_HEADER_KEYS) {
    if (Object.hasOwn(header, forbidden)) {
      fail('RI-5', `protected header carries forbidden key-sourcing parameter '${forbidden}'`);
    }
  }
  const envelopeKeys = collectKeys(envelope);
  for (const material of KEY_MATERIAL_KEYS) {
    if (envelopeKeys.includes(material)) {
      fail('RI-5', `envelope carries key material field '${material}'`);
    }
  }
  if (envelope.trust_bundle_ref?.bundle_uri !== TRUST_BUNDLE_URI) {
    fail('RI-5', `envelope.trust_bundle_ref.bundle_uri must pin ${TRUST_BUNDLE_URI}`);
  }
  if (trustBundle && envelope.trust_bundle_ref?.bundle_digest !== trustBundleDigest(trustBundle)) {
    fail('RI-5', 'envelope.trust_bundle_ref.bundle_digest does not match the pinned trust bundle');
  }
  const bundleEntry = (trustBundle?.keys || []).find((entry) => entry.kid === envelope.kid);
  if (!bundleEntry) {
    fail('RI-5', 'kid does not resolve to any key in the pinned external trust bundle');
  } else if (bundleEntry.kid !== jwkThumbprintKid(bundleEntry.jwk)) {
    fail('RI-5', 'trust bundle kid is not the thumbprint of its own public JWK');
  }

  // --- RI-2 signature locator -------------------------------------------------
  if (!LOCATOR_PATTERN.test(String(envelope.signature_locator))) {
    fail('RI-2', 'signature_locator does not match the pinned ledger locator grammar');
  } else if (envelope.signature_locator !== computeSignatureLocator(jws)) {
    fail('RI-2', 'signature_locator is not the SHA-256 of the exact compact JWS bytes');
  }

  // --- RI-6 payload -----------------------------------------------------------
  const payloadBytes = Buffer.from(payloadSegment, 'base64url');
  let payload;
  try {
    payload = JSON.parse(payloadBytes.toString('utf8'));
  } catch (error) {
    fail('RI-6', `payload is not JSON: ${error.message}`);
    return findings;
  }
  if (!payloadBytes.equals(jcsBytes(payload))) {
    fail('RI-6', 'payload bytes are not the JCS rendering of their own parse');
  }
  if (statement && !same(payload, statement)) {
    fail('RI-6', 'payload does not deep-equal the signed-statement packet member');
  }
  if (recomputedReceiptDigest !== undefined && payload.receipt_digest !== recomputedReceiptDigest) {
    fail('RI-6', 'payload receipt_digest does not equal the recomputed receipt digest');
  }
  if (receipt && (payload.receipt_id !== receipt.receipt_id || envelope.receipt_id !== receipt.receipt_id)) {
    fail('RI-6', 'receipt_id must be identical in the payload, the envelope and the receipt');
  }
  if (envelope.signer_role !== SIGNER_ROLE) {
    fail('RI-6', `envelope.signer_role must be ${SIGNER_ROLE} — an executor never signs a receipt`);
  }

  // --- RI-7 signature ----------------------------------------------------------
  const signatureBytes = Buffer.from(signatureSegment, 'base64url');
  if (signatureBytes.length !== ED25519_SIGNATURE_BYTES) {
    fail('RI-7', `Ed25519 signature must be ${ED25519_SIGNATURE_BYTES} bytes; got ${signatureBytes.length}`);
  }
  if (bundleEntry) {
    let verified = false;
    try {
      verified = edVerify(
        null,
        Buffer.from(`${protectedSegment}.${payloadSegment}`, 'ascii'),
        createPublicKey({ key: bundleEntry.jwk, format: 'jwk' }),
        signatureBytes,
      );
    } catch (error) {
      fail('RI-7', `Ed25519 verification threw: ${error.message}`);
    }
    if (!verified) fail('RI-7', 'Ed25519 signature does not verify over the compact signing input');
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Mutation probes. Each proves one inventory rule really rejects, including the
// three rules no on-disk fixture covers.
// ---------------------------------------------------------------------------

const reencodeJws = (header, payload, signatureSegment) =>
  `${jcsBytes(header).toString('base64url')}.${jcsBytes(payload).toString('base64url')}.${signatureSegment}`;

const decodeJwsParts = (jws) => {
  const [protectedSegment, payloadSegment, signatureSegment] = jws.split('.');
  return {
    header: JSON.parse(Buffer.from(protectedSegment, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')),
    signatureSegment,
  };
};

export const mutationProbes = [
  {
    id: 'RI-1',
    label: 'canonicalization id swapped to a non-JCS renderer',
    mutate: (vector) => ({
      ...vector,
      envelope: { ...vector.envelope, canonicalization: 'JSON.stringify/v0' },
    }),
  },
  {
    id: 'RI-1',
    label: 'digest recomputed with the output_artifacts schema default injected',
    mutate: (vector) => {
      const injected = canonicalReceiptDigest({ ...vector.receipt, output_artifacts: [] });
      return {
        ...vector,
        envelope: { ...vector.envelope, receipt_digest: injected },
      };
    },
  },
  {
    id: 'RI-2',
    label: 'locator hex points at a different byte string',
    mutate: (vector) => ({
      ...vector,
      envelope: {
        ...vector.envelope,
        signature_locator: `cybrik-ledger://receipt-signatures/sha256/${'0'.repeat(64)}`,
      },
    }),
  },
  {
    id: 'RI-2',
    label: 'locator scheme replaced by a fetchable https URL',
    mutate: (vector) => ({
      ...vector,
      envelope: {
        ...vector.envelope,
        signature_locator: 'https://ledger.cybrik.example/receipt-signatures/1',
      },
    }),
  },
  {
    id: 'RI-3',
    label: 'payload detached (empty middle segment)',
    mutate: (vector) => {
      const parts = decodeJwsParts(vector.envelope.jws_compact);
      const jws = `${vector.envelope.jws_compact.split('.')[0]}..${parts.signatureSegment}`;
      return {
        ...vector,
        envelope: {
          ...vector.envelope,
          jws_compact: jws,
          signature_locator: computeSignatureLocator(jws),
        },
      };
    },
  },
  {
    id: 'RI-3',
    label: 'unpinned typ in the protected header',
    mutate: (vector) => {
      const parts = decodeJwsParts(vector.envelope.jws_compact);
      const jws = reencodeJws({ ...parts.header, typ: 'JWT' }, parts.payload, parts.signatureSegment);
      return {
        ...vector,
        envelope: { ...vector.envelope, jws_compact: jws, signature_locator: computeSignatureLocator(jws) },
      };
    },
  },
  {
    id: 'RI-4',
    label: 'alg=none with a stripped signature',
    mutate: (vector) => {
      const parts = decodeJwsParts(vector.envelope.jws_compact);
      const jws = reencodeJws({ ...parts.header, alg: 'none' }, parts.payload, '');
      return {
        ...vector,
        envelope: { ...vector.envelope, jws_compact: jws, signature_locator: computeSignatureLocator(jws) },
      };
    },
  },
  {
    id: 'RI-4',
    label: 'b64=false unencoded-payload switch',
    mutate: (vector) => {
      const parts = decodeJwsParts(vector.envelope.jws_compact);
      const jws = reencodeJws({ ...parts.header, b64: false }, parts.payload, parts.signatureSegment);
      return {
        ...vector,
        envelope: { ...vector.envelope, jws_compact: jws, signature_locator: computeSignatureLocator(jws) },
      };
    },
  },
  {
    id: 'RI-5',
    label: 'embedded jwk in the protected header',
    mutate: (vector) => {
      const parts = decodeJwsParts(vector.envelope.jws_compact);
      const jws = reencodeJws(
        { ...parts.header, jwk: vector.trustBundle.keys[0].jwk },
        parts.payload,
        parts.signatureSegment,
      );
      return {
        ...vector,
        envelope: { ...vector.envelope, jws_compact: jws, signature_locator: computeSignatureLocator(jws) },
      };
    },
  },
  {
    id: 'RI-5',
    label: 'remote jku key-fetch header',
    mutate: (vector) => {
      const parts = decodeJwsParts(vector.envelope.jws_compact);
      const jws = reencodeJws(
        { ...parts.header, jku: 'https://keys.cybrik.example/jwks.json' },
        parts.payload,
        parts.signatureSegment,
      );
      return {
        ...vector,
        envelope: { ...vector.envelope, jws_compact: jws, signature_locator: computeSignatureLocator(jws) },
      };
    },
  },
  {
    id: 'RI-5',
    label: 'kid absent from the pinned trust bundle',
    mutate: (vector) => ({
      ...vector,
      trustBundle: { ...vector.trustBundle, keys: [] },
    }),
  },
  {
    id: 'RI-6',
    label: 'signed statement re-bound to a different receipt_id',
    mutate: (vector) => {
      const parts = decodeJwsParts(vector.envelope.jws_compact);
      const jws = reencodeJws(
        parts.header,
        { ...parts.payload, receipt_id: 'rcpt-f8-9999' },
        parts.signatureSegment,
      );
      return {
        ...vector,
        envelope: { ...vector.envelope, jws_compact: jws, signature_locator: computeSignatureLocator(jws) },
      };
    },
  },
  {
    id: 'RI-6',
    label: 'payload re-serialized outside JCS key order',
    mutate: (vector) => {
      const parts = decodeJwsParts(vector.envelope.jws_compact);
      const reversed = Object.fromEntries(Object.entries(parts.payload).reverse());
      const payloadSegment = Buffer.from(JSON.stringify(reversed), 'utf8').toString('base64url');
      const jws = `${vector.envelope.jws_compact.split('.')[0]}.${payloadSegment}.${parts.signatureSegment}`;
      return {
        ...vector,
        envelope: { ...vector.envelope, jws_compact: jws, signature_locator: computeSignatureLocator(jws) },
      };
    },
  },
  {
    id: 'RI-7',
    label: 'last signature byte flipped',
    mutate: (vector) => {
      const [protectedSegment, payloadSegment, signatureSegment] =
        vector.envelope.jws_compact.split('.');
      const bytes = Buffer.from(signatureSegment, 'base64url');
      bytes[bytes.length - 1] ^= 0x01;
      const jws = `${protectedSegment}.${payloadSegment}.${bytes.toString('base64url')}`;
      return {
        ...vector,
        envelope: { ...vector.envelope, jws_compact: jws, signature_locator: computeSignatureLocator(jws) },
      };
    },
  },
  {
    id: 'RI-7',
    label: 'signature truncated below 64 bytes',
    mutate: (vector) => {
      const [protectedSegment, payloadSegment, signatureSegment] =
        vector.envelope.jws_compact.split('.');
      const bytes = Buffer.from(signatureSegment, 'base64url').subarray(0, 32);
      const jws = `${protectedSegment}.${payloadSegment}.${bytes.toString('base64url')}`;
      return {
        ...vector,
        envelope: { ...vector.envelope, jws_compact: jws, signature_locator: computeSignatureLocator(jws) },
      };
    },
  },
];

// ---------------------------------------------------------------------------
// Packet validation.
// ---------------------------------------------------------------------------

const aggregatePacketDigest = (memberDigests) => sha256Hex(
  utf8(
    [...memberDigests]
      .sort((left, right) => {
        if (left.file < right.file) return -1;
        return left.file > right.file ? 1 : 0;
      })
      .map((entry) => `${entry.sha256}  ${entry.file}`)
      .join('\n'),
  ),
);

const manifestSelfDigestInput = (manifest) => {
  const withoutIntegrity = { ...manifest };
  delete withoutIntegrity[PACKET_INTEGRITY_KEY];
  return JSON.stringify(withoutIntegrity);
};

export {
  aggregatePacketDigest as computePacketAggregateDigest,
  manifestSelfDigestInput as computeManifestSelfDigestInput,
};

export function validateReceiptIntegrityProposal({
  root = DEFAULT_ROOT,
  overrides = new Map(),
} = {}) {
  const errors = [];
  const texts = new Map();
  const documents = new Map();

  const readText = (relativePath) => {
    if (overrides.has(relativePath)) return overrides.get(relativePath);
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(`missing expected packet file: ${relativePath}`);
      return undefined;
    }
    return readFileSync(absolutePath, 'utf8');
  };
  const readJson = (relativePath) => {
    const text = readText(relativePath);
    if (text === undefined) return undefined;
    texts.set(relativePath, text);
    try {
      const document = JSON.parse(text);
      documents.set(relativePath, document);
      return document;
    } catch (error) {
      errors.push(`${relativePath}: JSON parse failed: ${error.message}`);
      return undefined;
    }
  };

  for (const relativePath of [...expectedPacketPaths, ...acceptedRefPaths]) readJson(relativePath);

  const manifest = documents.get(COMPATIBILITY_PATH);
  const examples = documents.get(EXAMPLES_MANIFEST_PATH);
  const statement = documents.get(positiveFixturePaths[0]);
  const envelope = documents.get(positiveFixturePaths[1]);

  const fail = (message) => errors.push(message);

  // --- lifecycle honesty ------------------------------------------------------
  for (const [relativePath, document] of documents) {
    if (!expectedPacketPaths.includes(relativePath)) continue;
    if (document?.['x-cybrik-status'] !== undefined && document['x-cybrik-status'] !== PROPOSED_STATUS) {
      fail(`${relativePath}: x-cybrik-status must remain ${PROPOSED_STATUS}`);
    }
    if (document?.['x-cybrik-not-accepted'] !== undefined && document['x-cybrik-not-accepted'] !== true) {
      fail(`${relativePath}: x-cybrik-not-accepted must remain true`);
    }
  }
  for (const [relativePath, text] of texts) {
    if (!expectedPacketPaths.includes(relativePath)) continue;
    for (const violation of statusHonestyViolations(text)) {
      fail(`${relativePath}: ${violation}`);
    }
  }

  // --- manifest shape ---------------------------------------------------------
  if (manifest) {
    if (!same(Object.keys(manifest).sort(), expectedManifestTopLevelKeys)) {
      fail(`${COMPATIBILITY_PATH}: unexpected top-level key set`);
    }
    if (manifest['x-cybrik-packet-version'] !== PACKET_VERSION) {
      fail(`${COMPATIBILITY_PATH}: packet version must be ${PACKET_VERSION}`);
    }
    if (manifest['x-cybrik-is-bundle-tag'] !== false) {
      fail(`${COMPATIBILITY_PATH}: a proposal cannot be an immutable bundle tag`);
    }
    if (!same(manifest.verification_commands, expectedVerificationCommands)) {
      fail(`${COMPATIBILITY_PATH}: verification_commands drifted from the validator's declaration`);
    }
    if (!same(manifest.rejection_inventory, REJECTION_INVENTORY)) {
      fail(`${COMPATIBILITY_PATH}: rejection_inventory drifted from the validator's implemented rules`);
    }
    if (!same((manifest.future_prerequisites || []).map((entry) => entry.id), expectedFuturePrerequisites)) {
      fail(`${COMPATIBILITY_PATH}: future_prerequisites must be exactly ${expectedFuturePrerequisites.join(', ')}`);
    }
    if (!same(manifest.members?.map((member) => member.file), expectedPacketPaths.map((path) => path.slice(CONTRACTS_PATH_ROOT.length)))) {
      fail(`${COMPATIBILITY_PATH}: members must list exactly the ${PACKET_MEMBER_COUNT} packet files in inventory order`);
    }
    if (!same(manifest.reuses_unmodified, acceptedRefPaths.map((path) => path.slice(CONTRACTS_PATH_ROOT.length)))) {
      fail(`${COMPATIBILITY_PATH}: reuses_unmodified must list exactly the accepted schemas reused by $ref`);
    }
    if (manifest.gate?.status !== 'OPEN — NOT DECIDED') {
      fail(`${COMPATIBILITY_PATH}: gate.status must remain 'OPEN — NOT DECIDED'`);
    }

    // --- packet integrity -----------------------------------------------------
    const integrity = manifest[PACKET_INTEGRITY_KEY];
    const declared = { ...integrity };
    delete declared.member_digests;
    delete declared.aggregate_sha256;
    if (!same(declared, expectedPacketIntegrityDeclaration)) {
      fail(`${COMPATIBILITY_PATH}: packet integrity declaration drifted`);
    }
    const memberDigests = integrity?.member_digests || [];
    if (memberDigests.length !== PACKET_MEMBER_COUNT) {
      fail(`${COMPATIBILITY_PATH}: expected ${PACKET_MEMBER_COUNT} member digests; got ${memberDigests.length}`);
    }
    for (const relativePath of expectedPacketPaths) {
      const memberFile = relativePath.slice(CONTRACTS_PATH_ROOT.length);
      const entry = memberDigests.find((candidate) => candidate.file === memberFile);
      if (!entry) {
        fail(`${COMPATIBILITY_PATH}: no member digest for ${memberFile}`);
        continue;
      }
      const actual = relativePath === COMPATIBILITY_PATH
        ? sha256Hex(utf8(manifestSelfDigestInput(manifest)))
        : sha256Hex(utf8(texts.get(relativePath) ?? ''));
      if (entry.sha256 !== actual) {
        fail(`${COMPATIBILITY_PATH}: member digest mismatch for ${memberFile}`);
      }
    }
    const aggregate = aggregatePacketDigest(memberDigests);
    if (integrity?.aggregate_sha256 !== aggregate) {
      fail(`${COMPATIBILITY_PATH}: aggregate_sha256 mismatch (expected ${aggregate})`);
    }
  }

  // --- schema conformance of the two positive fixtures ------------------------
  const schemaContext = {
    schemas: new Map(
      [...schemaPaths, ...acceptedRefPaths]
        .map((relativePath) => [relativePath.split('/').pop(), documents.get(relativePath)])
        .filter(([, document]) => document !== undefined),
    ),
  };
  const validateAgainst = (schemaPath, value, label) => {
    const schema = documents.get(schemaPath);
    if (!schema || value === undefined) return;
    const schemaErrors = validateJsonSchemaValue(schema, value, {
      ...schemaContext,
      currentDocument: schema,
    });
    for (const schemaError of schemaErrors) fail(`${label}: ${schemaError}`);
  };
  validateAgainst(schemaPaths[0], statement, positiveFixturePaths[0]);
  validateAgainst(schemaPaths[1], envelope, positiveFixturePaths[1]);

  // --- the frozen test vector --------------------------------------------------
  const receipt = examples?.test_vector?.receipt;
  const trustBundle = examples?.trust_bundle;
  let probeCount = 0;

  if (!receipt || !trustBundle) {
    fail(`${EXAMPLES_MANIFEST_PATH}: must carry test_vector.receipt and the pinned trust_bundle`);
  } else {
    validateAgainst(
      'contracts/json-schema/cybrik.execution-receipt.v1.schema.json',
      receipt,
      `${EXAMPLES_MANIFEST_PATH}#/test_vector/receipt`,
    );
    if (Object.hasOwn(receipt, 'output_artifacts')) {
      fail(`${EXAMPLES_MANIFEST_PATH}: the frozen receipt must OMIT output_artifacts so absence is provable`);
    }
    const evidence = examples?.test_vector?.digest_evidence || {};
    const absentDigest = canonicalReceiptDigest(receipt);
    const emptyDigest = canonicalReceiptDigest({ ...receipt, output_artifacts: [] });
    if (evidence.output_artifacts_absent !== absentDigest) {
      fail(`${EXAMPLES_MANIFEST_PATH}: digest_evidence.output_artifacts_absent mismatch (expected ${absentDigest})`);
    }
    if (evidence.output_artifacts_empty_array !== emptyDigest) {
      fail(`${EXAMPLES_MANIFEST_PATH}: digest_evidence.output_artifacts_empty_array mismatch (expected ${emptyDigest})`);
    }
    if (absentDigest === emptyDigest) {
      fail('CYBRIK-RECEIPT-JCS/v1 must distinguish an absent array from an explicitly empty array');
    }
    if (examples?.trust_bundle_digest !== trustBundleDigest(trustBundle)) {
      fail(`${EXAMPLES_MANIFEST_PATH}: trust_bundle_digest mismatch`);
    }
    for (const entry of trustBundle.keys || []) {
      if (Object.hasOwn(entry.jwk || {}, 'd')) {
        fail(`${EXAMPLES_MANIFEST_PATH}: the trust bundle may carry public JWKs only`);
      }
    }

    // The two receipt-side bindings. They are checked here rather than inside the
    // rejection engine because the engine is also run against mutated envelopes,
    // where a recomputed locator would otherwise make every fixture trip RI-2.
    if (receipt.receipt_digest !== absentDigest) {
      fail(`${EXAMPLES_MANIFEST_PATH}: the frozen receipt's own receipt_digest is not the profile digest`);
    }
    if (envelope && receipt.signature !== envelope.signature_locator) {
      fail(`${EXAMPLES_MANIFEST_PATH}: receipt.signature must carry exactly the envelope signature_locator`);
    }

    const vector = { envelope, statement, receipt, trustBundle };
    const positiveFindings = verifyReceiptSignatureEnvelope(vector);
    for (const finding of positiveFindings) {
      fail(`positive vector rejected by ${finding.id}: ${finding.message}`);
    }

    // Every inventory rule must be exercised, and each probe must fire its rule.
    const exercised = new Set();
    for (const probe of mutationProbes) {
      probeCount += 1;
      const findings = verifyReceiptSignatureEnvelope(probe.mutate(vector));
      const ids = new Set(findings.map((finding) => finding.id));
      if (!ids.has(probe.id)) {
        fail(`mutation probe '${probe.label}' did not fire ${probe.id} (fired: ${[...ids].join(', ') || 'nothing'})`);
      } else {
        exercised.add(probe.id);
      }
    }
    for (const id of REJECTION_IDS) {
      if (!exercised.has(id)) fail(`rejection rule ${id} has no passing mutation probe`);
    }

    // --- negative fixtures ------------------------------------------------------
    const declaredExamples = examples?.examples || [];
    for (const relativePath of negativeFixturePaths) {
      const fixtureFile = relativePath.slice('contracts/examples/receipt-integrity/'.length);
      const declaration = declaredExamples.find((candidate) => candidate.file === fixtureFile);
      if (!declaration) {
        fail(`${EXAMPLES_MANIFEST_PATH}: negative fixture ${fixtureFile} is not declared`);
        continue;
      }
      const fixture = documents.get(relativePath);
      if (!fixture) continue;
      const findings = verifyReceiptSignatureEnvelope({ ...vector, envelope: fixture });
      const firedIds = [...new Set(findings.map((finding) => finding.id))].sort();
      if (firedIds.length === 0) {
        fail(`${fixtureFile}: negative fixture was ACCEPTED — it must be rejected`);
      }
      if (!same(firedIds, declaration.rejected_by)) {
        fail(
          `${fixtureFile}: declared rejected_by ${JSON.stringify(declaration.rejected_by)} `
          + `differs from the fired rule set ${JSON.stringify(firedIds)}`,
        );
      }
    }
    for (const relativePath of positiveFixturePaths) {
      const fixtureFile = relativePath.slice('contracts/examples/receipt-integrity/'.length);
      if (!declaredExamples.some((candidate) => candidate.file === fixtureFile)) {
        fail(`${EXAMPLES_MANIFEST_PATH}: positive fixture ${fixtureFile} is not declared`);
      }
    }
    if (declaredExamples.length !== positiveFixturePaths.length + negativeFixturePaths.length) {
      fail(`${EXAMPLES_MANIFEST_PATH}: examples must declare exactly the on-disk fixtures`);
    }
  }

  return {
    status: manifest?.['x-cybrik-status'],
    notAccepted: manifest?.['x-cybrik-not-accepted'],
    packetVersion: manifest?.['x-cybrik-packet-version'],
    gateStatus: manifest?.gate?.status,
    errors,
    counts: {
      packetFiles: expectedPacketPaths.filter((relativePath) => texts.has(relativePath)).length,
      positiveFixtures: positiveFixturePaths.length,
      negativeFixtures: negativeFixturePaths.length,
      rejectionRules: REJECTION_IDS.length,
      mutationProbes: probeCount,
    },
  };
}

function main() {
  const report = validateReceiptIntegrityProposal();
  if (report.errors.length > 0) {
    for (const error of report.errors) console.error(`FAIL: ${error}`);
    console.error(`RESULT=RED errors=${report.errors.length}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    [
      'RESULT=PASS',
      `status=${report.status}`,
      `not_accepted=${report.notAccepted}`,
      `gate=${JSON.stringify(report.gateStatus)}`,
      `packet_files=${report.counts.packetFiles}`,
      `positive=${report.counts.positiveFixtures}`,
      `negative=${report.counts.negativeFixtures}`,
      `rejection_rules=${report.counts.rejectionRules}`,
      `mutation_probes=${report.counts.mutationProbes}`,
    ].join(' '),
  );
  console.log(
    'PROPOSED — NOT ACCEPTED. No ADR decision, no runtime implementation, no F8 closure, '
    + 'no stable v1 and no GA claim follows from this result.',
  );
}

// Resolve both sides through realpath so a symlinked invocation path cannot make
// the guard silently false and exit 0 having run nothing.
const invoked = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : undefined;
if (invoked !== undefined
  && invoked === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href) {
  main();
}
