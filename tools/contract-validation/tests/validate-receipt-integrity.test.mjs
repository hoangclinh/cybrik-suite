// Test suite for the F8 receipt-integrity signature-profile validator.
//
// The packet under test is accepted for implementation and remains explicitly
// NOT IMPLEMENTED. Green here proves only that the accepted contract profile is
// internally consistent and that its frozen vector is cryptographically
// reproducible. It proves no runtime, product, UAT, release or production gate.
//
// The TEST-ONLY Ed25519 signing key is derived at runtime from
// SHA-256("CYBRIK-F8-TEST-ONLY-ED25519-SEED/v1"). No PEM, no PKCS#8 file and no
// private key material exists anywhere in the tree. This key is a fixture-
// reproduction device only: it is public by construction, it is not a signer
// identity, and it must never appear in any real trust bundle.
//
//   node --test tests/validate-receipt-integrity.test.mjs
//   CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT=<dir with node_modules> \
//     node --test tests/validate-receipt-integrity.test.mjs
//
// The `f8` namespace import is deliberate: it lets a test for a not-yet-present
// export fail as a normal assertion instead of as a module link error that would
// take the whole file down and report nothing.

import assert from 'node:assert/strict';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
} from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { canonicalizeJcs } from '../validate-alert-context.mjs';
import * as f8 from '../validate-receipt-integrity.mjs';
import {
  CANONICALIZATION_ID,
  COMPATIBILITY_PATH,
  EXAMPLES_MANIFEST_PATH,
  JWS_TYP,
  RECEIPT_DIGEST_PROFILE,
  REJECTION_INVENTORY,
  canonicalReceiptDigest,
  computeSignatureLocator,
  expectedPacketPaths,
  jwkThumbprintKid,
  mutationProbes,
  trustBundleDigest,
  validateReceiptIntegrityProposal,
  verifyReceiptSignatureEnvelope,
} from '../validate-receipt-integrity.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const DEPENDENCY_ROOT = process.env.CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT
  || resolve(REPO_ROOT, 'tools/contract-validation');

const PACKET_VERSION = '0.2.0';
const ACCEPTED_STATUS = 'ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED';
const ENVELOPE_PROFILE_ID = 'CYBRIK-RECEIPT-JWS/v2';
const DECISION_RECORD_PATH =
  'docs/adr/DELEGATED-GOVERNOR-DECISION-F8-RECEIPT-INTEGRITY.md';
const STATEMENT_SCHEMA_PATH =
  'contracts/json-schema/cybrik.receipt-signature-statement.v1.schema.json';
const ENVELOPE_SCHEMA_PATH =
  'contracts/json-schema/cybrik.receipt-signature-envelope.v1.schema.json';
const ACCEPTED_RECEIPT_SCHEMA_PATH =
  'contracts/json-schema/cybrik.execution-receipt.v1.schema.json';
const POSITIVE_STATEMENT_PATH =
  'contracts/examples/receipt-integrity/positive/receipt-signature-statement.json';
const POSITIVE_ENVELOPE_PATH =
  'contracts/examples/receipt-integrity/positive/receipt-signature-envelope.json';

const TEST_ONLY_SEED_LABEL = 'CYBRIK-F8-TEST-ONLY-ED25519-SEED/v1';
// A second TEST-ONLY key, used only to build a later trust-bundle generation so
// historical verification across a rotation can be exercised with a real curve
// point instead of an invented one. It signs nothing.
const TEST_ONLY_ROTATION_SEED_LABEL = 'CYBRIK-F8-TEST-ONLY-ED25519-SEED/v1#rotation';
// RFC 8410 PKCS#8 prefix for an Ed25519 private key holding a bare 32-byte seed.
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

const readPacketJson = (relativePath) => {
  const absolutePath = join(REPO_ROOT, relativePath);
  if (!existsSync(absolutePath)) return undefined;
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
};
const readRepoText = (relativePath) =>
  readFileSync(join(REPO_ROOT, relativePath), 'utf8');
const readRepoBytes = (relativePath) => readFileSync(join(REPO_ROOT, relativePath));

const jcsBuffer = (value) => Buffer.from(canonicalizeJcs(value), 'utf8');
const b64u = (buffer) => Buffer.from(buffer).toString('base64url');

/** TEST-ONLY. Derived at runtime; never written to disk, never a real signer. */
const deriveTestOnlyKeyPair = (label = TEST_ONLY_SEED_LABEL) => {
  const seed = createHash('sha256').update(label, 'utf8').digest();
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
  const exported = createPublicKey(privateKey).export({ format: 'jwk' });
  return { privateKey, jwk: { crv: exported.crv, kty: exported.kty, x: exported.x } };
};

/** Re-signs the frozen statement from scratch, reproducing the compact JWS. */
const resignStatement = (statement, privateKey) => {
  const header = { alg: 'EdDSA', kid: statement.kid, typ: JWS_TYP };
  const signingInput = `${b64u(jcsBuffer(header))}.${b64u(jcsBuffer(statement))}`;
  return `${signingInput}.${b64u(edSign(null, Buffer.from(signingInput, 'ascii'), privateKey))}`;
};

/** TEST-ONLY. Signs caller-supplied protected-header bytes without normalizing them. */
const resignWithRawProtectedHeader = (statement, privateKey, protectedHeaderText) => {
  const signingInput = `${b64u(Buffer.from(protectedHeaderText, 'utf8'))}.${b64u(jcsBuffer(statement))}`;
  return `${signingInput}.${b64u(edSign(null, Buffer.from(signingInput, 'ascii'), privateKey))}`;
};

const loadVector = () => {
  const examples = readPacketJson(EXAMPLES_MANIFEST_PATH);
  return {
    examples,
    envelope: readPacketJson(POSITIVE_ENVELOPE_PATH),
    statement: readPacketJson(POSITIVE_STATEMENT_PATH),
    receipt: examples?.test_vector?.receipt,
    trustBundle: examples?.trust_bundle,
  };
};

test('the F8 receipt-integrity accepted contract packet is internally consistent', () => {
  const report = validateReceiptIntegrityProposal({ root: REPO_ROOT });

  assert.deepEqual(report.errors, []);
  assert.equal(report.status, ACCEPTED_STATUS);
  assert.equal(report.notAccepted, false);
  assert.equal(report.notImplemented, true);
  assert.equal(report.packetVersion, PACKET_VERSION);
  assert.equal(report.gateStatus, ACCEPTED_STATUS);
  assert.equal(report.counts.packetFiles, expectedPacketPaths.length);
  assert.equal(report.counts.positiveFixtures, 2);
  assert.equal(report.counts.negativeFixtures, 4);
  assert.equal(report.counts.rejectionRules, 7);
  assert.equal(report.counts.mutationProbes, mutationProbes.length);
  assert.equal(report.counts.acceptedContractDivergences, 1);
  assert.equal(report.counts.historicalVerificationCases, 1);
});

test('the rejection inventory covers all seven required categories', () => {
  assert.deepEqual(
    REJECTION_INVENTORY.map((entry) => entry.category),
    [
      'canonicalization',
      'locator',
      'header-grammar',
      'algorithm',
      'embedded-or-remote-key',
      'payload-tampering',
      'signature-tampering',
    ],
  );
  for (const entry of REJECTION_INVENTORY) {
    assert.ok(
      mutationProbes.some((probe) => probe.id === entry.id),
      `${entry.id} (${entry.category}) has no mutation probe`,
    );
  }
});

test('the required JOSE attack surface has executable rejection probes', () => {
  const labels = mutationProbes.map((probe) => probe.label);
  for (const required of [
    'payload detached (empty middle segment)',
    'alg=none with a stripped signature',
    'b64=false unencoded-payload switch',
    'embedded jwk in the protected header',
    'remote jku key-fetch header',
    'remote x5u certificate-fetch header',
    'embedded x5c certificate chain header',
  ]) {
    assert.ok(labels.includes(required), `${required} has no executable rejection probe`);
  }
});

// The enumerated forbidden-header list is the packet's own claim about which
// JOSE key-sourcing parameters it blocks. Deriving the requirement from that
// list — rather than from a second hand-maintained list — is what stops a
// parameter from being declared forbidden while no probe ever proves it is.
test('every enumerated forbidden JOSE header parameter has its own rejection probe', () => {
  const forbidden = f8.FORBIDDEN_HEADER_KEYS;
  assert.ok(Array.isArray(forbidden), 'FORBIDDEN_HEADER_KEYS must be exported');
  assert.deepEqual(
    [...forbidden].sort(),
    ['b64', 'crit', 'epk', 'jku', 'jwk', 'x5c', 'x5t', 'x5t#S256', 'x5u'],
  );

  const vector = loadVector();
  for (const parameter of forbidden) {
    const probe = mutationProbes.find((candidate) => candidate.header === parameter);
    assert.ok(probe, `forbidden header parameter '${parameter}' has no rejection probe`);
    const fired = new Set(
      verifyReceiptSignatureEnvelope(probe.mutate(vector)).map((finding) => finding.id),
    );
    assert.ok(fired.has(probe.id), `probe for '${parameter}' did not fire ${probe.id}`);
  }
});

test('the frozen compact JWS is byte-exactly reproducible from the TEST-ONLY seed', () => {
  const statement = readPacketJson(POSITIVE_STATEMENT_PATH);
  const envelope = readPacketJson(POSITIVE_ENVELOPE_PATH);
  assert.ok(statement && envelope, 'positive fixtures must exist');

  const { privateKey, jwk } = deriveTestOnlyKeyPair();
  assert.equal(jwkThumbprintKid(jwk), statement.kid);
  assert.equal(resignStatement(statement, privateKey), envelope.jws_compact);
  assert.equal(computeSignatureLocator(envelope.jws_compact), envelope.signature_locator);
});

test('kid uses the RFC 7638 base64url thumbprint rendering without padding', () => {
  const { jwk } = deriveTestOnlyKeyPair();
  const kid = jwkThumbprintKid(jwk);

  assert.equal(
    kid,
    'cybrik-receipt-signer:v1:etIRG9HHxXGUMSqZgDhDB7guBAQK1u_YU9Iz8iZfp5U',
  );
  assert.match(kid, /^cybrik-receipt-signer:v1:[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(kid, /^cybrik-receipt-signer:v1:[0-9a-f]{64}$/);
});

test('the positive JWS is literal and its jwt allowlist is exact and fail-closed', () => {
  const raw = readRepoText(POSITIVE_ENVELOPE_PATH);
  const envelope = JSON.parse(raw);

  assert.doesNotMatch(
    raw,
    /"jws_compact"\s*:\s*"\\u0065/,
    'the positive compact JWS must not be hidden behind a JSON source escape',
  );
  assert.ok(
    raw.includes(`  "jws_compact": "${envelope.jws_compact}",`),
    'the source fixture must carry the exact parsed compact JWS bytes literally',
  );
  assert.equal(
    computeSignatureLocator(envelope.jws_compact),
    envelope.signature_locator,
    'the locator must remain the digest of those exact compact JWS bytes',
  );

  // The allowlist is pinned to the signature segment the fixture actually
  // carries, so regenerating the frozen vector without regenerating the
  // allowlist fails here rather than silently widening the exception.
  const signatureSegment = envelope.jws_compact.split('.')[2];
  assert.match(signatureSegment, /^[A-Za-z0-9_-]+$/);

  const config = readRepoText('.gitleaks.toml');
  const jwtBlocks = config
    .split('[[allowlists]]')
    .slice(1)
    .filter((block) => block.includes('targetRules = ["jwt"]'));
  assert.equal(jwtBlocks.length, 1, 'there must be exactly one jwt allowlist');
  const effectiveLines = jwtBlocks[0]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  assert.deepEqual(effectiveLines, [
    'description = "F8 TEST-ONLY positive receipt JWS vector (exact path and signature)"',
    'targetRules = ["jwt"]',
    'condition = "AND"',
    'regexTarget = "line"',
    "paths = ['''^contracts/examples/receipt-integrity/positive/receipt-signature-envelope\\.json$''']",
    `regexes = ['''^\\s*"jws_compact": "[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.${signatureSegment}",$''']`,
  ]);
});

test('Ed25519 verification of the frozen vector succeeds and its trust bundle holds no private key', () => {
  const { examples, envelope, statement, receipt, trustBundle } = loadVector();
  assert.ok(examples, 'examples manifest must exist');

  const { jwk } = deriveTestOnlyKeyPair();
  assert.deepEqual(examples.trust_bundle.keys.map((entry) => entry.jwk), [jwk]);
  assert.equal(examples.trust_bundle_digest, trustBundleDigest(examples.trust_bundle));
  assert.equal(
    JSON.stringify(examples).includes('"d"'),
    false,
    'no private-key component may appear in the examples manifest',
  );

  assert.deepEqual(
    verifyReceiptSignatureEnvelope({ envelope, statement, receipt, trustBundle }),
    [],
  );
});

// ---------------------------------------------------------------------------
// 0.2.0 — strict raw-JSON admission.
// ---------------------------------------------------------------------------

test('strict raw-JSON parsing rejects duplicate keys and trailing content', () => {
  const violations = f8.strictJsonViolations;
  assert.equal(typeof violations, 'function', 'strictJsonViolations must be exported');

  assert.deepEqual(violations('{"a":1,"b":2}'), []);
  assert.deepEqual(violations('{\n  "a": [1, 2, {"b": null}]\n}\n'), []);

  // JSON.parse silently keeps the LAST duplicate, so a reviewer reading the
  // source and a parser reading the same bytes can disagree about the value.
  assert.equal(JSON.parse('{"a":1,"a":2}').a, 2);
  assert.ok(
    violations('{"a":1,"a":2}').some((entry) => /duplicate key 'a'/.test(entry)),
    'a duplicate top-level key must be reported',
  );
  assert.ok(
    violations('{"outer":{"a":1,"a":2}}').some((entry) => /duplicate key 'a'/.test(entry)),
    'a duplicate nested key must be reported',
  );
  // `\u0061` and `a` are the same member name after unescaping.
  assert.ok(
    violations('{"a":1,"\\u0061":2}').some((entry) => /duplicate key 'a'/.test(entry)),
    'duplicate detection must compare unescaped member names',
  );

  assert.ok(
    violations('{"a":1} {"b":2}').some((entry) => /trailing content/i.test(entry)),
    'content after the top-level value must be reported',
  );
  assert.deepEqual(violations('{"a":1}\n  \n'), [], 'trailing whitespace is permitted');
});

test('strict raw-JSON parsing rejects a byte order mark and invalid UTF-8', () => {
  const parseBytes = f8.parseStrictJsonBytes;
  assert.equal(typeof parseBytes, 'function', 'parseStrictJsonBytes must be exported');

  const clean = parseBytes(Buffer.from('{"a":1}\n', 'utf8'));
  assert.deepEqual(clean.violations, []);
  assert.deepEqual(clean.value, { a: 1 });

  const withBom = parseBytes(
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"a":1}\n', 'utf8')]),
  );
  assert.ok(
    withBom.violations.some((entry) => /byte order mark/i.test(entry)),
    'a UTF-8 BOM must be reported',
  );

  // readFileSync(path, 'utf8') replaces an invalid byte with U+FFFD, so text
  // read that way no longer round-trips to the bytes that were on disk — and a
  // digest taken over the re-encoded text is not a digest of the file.
  const invalid = Buffer.concat([Buffer.from('{"a":"', 'utf8'), Buffer.from([0xff]), Buffer.from('"}', 'utf8')]);
  assert.notEqual(Buffer.from(invalid.toString('utf8'), 'utf8').length, invalid.length);
  assert.ok(
    parseBytes(invalid).violations.some((entry) => /utf-8/i.test(entry)),
    'bytes that are not well-formed UTF-8 must be reported',
  );
});

test('a validly signed protected header with duplicate or escaped-alias keys is rejected', () => {
  const vector = loadVector();
  const { privateKey } = deriveTestOnlyKeyPair();

  for (const protectedHeaderText of [
    `{"alg":"EdDSA","alg":"EdDSA","kid":"${vector.statement.kid}","typ":"${JWS_TYP}"}`,
    `{"alg":"EdDSA","\\u0061lg":"EdDSA","kid":"${vector.statement.kid}","typ":"${JWS_TYP}"}`,
  ]) {
    const jws = resignWithRawProtectedHeader(
      vector.statement,
      privateKey,
      protectedHeaderText,
    );
    const findings = verifyReceiptSignatureEnvelope({
      ...vector,
      envelope: {
        ...vector.envelope,
        jws_compact: jws,
        signature_locator: computeSignatureLocator(jws),
      },
    });

    assert.ok(
      findings.some(
        (finding) => finding.id === 'RI-3' && /duplicate key 'alg'/.test(finding.message),
      ),
      `duplicate protected-header alias must fire RI-3; got ${JSON.stringify(findings)}`,
    );
  }
});

test('strict raw-JSON parsing enforces its declared nesting ceiling', () => {
  const tooDeep = `${'['.repeat(66)}0${']'.repeat(66)}`;
  assert.ok(
    f8.strictJsonViolations(tooDeep).some((entry) => /nesting exceeds/i.test(entry)),
    'a document deeper than the admitted 64-level ceiling must be rejected',
  );
});

test('every packet member is admitted under the strict raw-JSON rules', () => {
  for (const relativePath of expectedPacketPaths) {
    const result = f8.parseStrictJsonBytes(readRepoBytes(relativePath));
    assert.deepEqual(result.violations, [], relativePath);
  }
});

test('member digests are taken over exact on-disk bytes and fail closed on a BOM', () => {
  const manifest = readPacketJson(COMPATIBILITY_PATH);
  const integrity = manifest['x-cybrik-packet-integrity'];

  for (const relativePath of expectedPacketPaths) {
    if (relativePath === COMPATIBILITY_PATH) continue;
    const member = relativePath.slice('contracts/'.length);
    const entry = integrity.member_digests.find((candidate) => candidate.file === member);
    assert.ok(entry, `no member digest for ${member}`);
    assert.equal(
      entry.sha256,
      createHash('sha256').update(readRepoBytes(relativePath)).digest('hex'),
      `${member}: digest must be over the exact on-disk bytes`,
    );
  }

  // A BOM-prefixed member changes the bytes, so the digest check must fail
  // rather than be normalized away by a lossy utf8 read.
  const bomOverride = new Map([
    [
      POSITIVE_STATEMENT_PATH,
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        readRepoBytes(POSITIVE_STATEMENT_PATH),
      ]),
    ],
  ]);
  const report = validateReceiptIntegrityProposal({ root: REPO_ROOT, overrides: bomOverride });
  assert.ok(
    report.errors.some((error) => /byte order mark/i.test(error)),
    `a BOM-prefixed member must be rejected; got: ${JSON.stringify(report.errors)}`,
  );
});

// ---------------------------------------------------------------------------
// 0.2.0 — divergence from the accepted receipt contract (OD-F8-6).
// ---------------------------------------------------------------------------

test('the packet declares exactly its divergences from the accepted receipt contract', () => {
  const declared = f8.ACCEPTED_CONTRACT_DIVERGENCES;
  assert.ok(Array.isArray(declared), 'ACCEPTED_CONTRACT_DIVERGENCES must be exported');
  assert.deepEqual(
    declared.map((entry) => entry.id),
    ['receipt-digest-exclusion-set'],
  );
  for (const entry of declared) {
    for (const field of ['id', 'subject', 'accepted_text', 'profile_text', 'consequence']) {
      assert.equal(typeof entry[field], 'string', `${entry.id}.${field}`);
      assert.ok(entry[field].length > 0, `${entry.id}.${field} must not be empty`);
    }
  }

  const manifest = readPacketJson(COMPATIBILITY_PATH);
  assert.deepEqual(manifest.accepted_contract_divergences, declared);

  // The kid divergence may no longer be described as the only one.
  const manifestText = readRepoText(COMPATIBILITY_PATH);
  assert.doesNotMatch(manifestText, /only deliberate divergence/i);
  assert.doesNotMatch(readRepoText(STATEMENT_SCHEMA_PATH), /only divergence/i);
});

test('the receipt-digest exclusion set really diverges from the accepted contract prose', () => {
  const accepted = readPacketJson(ACCEPTED_RECEIPT_SCHEMA_PATH);
  const acceptedText = accepted.properties.receipt_digest.description;
  assert.equal(
    acceptedText,
    'Digest over the canonical receipt content (all fields except signature).',
    'the divergence claim is pinned to this exact accepted wording',
  );

  const divergence = f8.ACCEPTED_CONTRACT_DIVERGENCES
    .find((entry) => entry.id === 'receipt-digest-exclusion-set');
  assert.equal(divergence.accepted_text, acceptedText);

  // Executable proof that the divergence is material, not cosmetic: following
  // the accepted prose literally — excluding only `signature` — yields a
  // different digest, so a Fabric implementation that read the accepted schema
  // and nothing else would produce receipts this profile rejects.
  const { receipt } = loadVector();
  const proseDigest = f8.acceptedProseReceiptDigest(receipt);
  assert.equal(typeof proseDigest, 'string');
  assert.notEqual(proseDigest, canonicalReceiptDigest(receipt));
  assert.equal(
    proseDigest,
    readPacketJson(EXAMPLES_MANIFEST_PATH).test_vector.digest_evidence.accepted_prose_recipe,
  );
});

test('OD-F8-1 through OD-F8-7 are recorded as delegated-governor decisions', () => {
  const manifest = readPacketJson(COMPATIBILITY_PATH);
  const ids = manifest.decisions.map((entry) => entry.id);
  assert.deepEqual(ids, [
    'OD-F8-1',
    'OD-F8-2',
    'OD-F8-3',
    'OD-F8-4',
    'OD-F8-5',
    'OD-F8-6',
    'OD-F8-7',
  ]);
  for (const decision of manifest.decisions) {
    assert.match(decision.current, /^DECIDED —/, decision.id);
  }
  const byId = Object.fromEntries(manifest.decisions.map((entry) => [entry.id, entry]));
  assert.match(byId['OD-F8-6'].question, /receipt_digest/);
  assert.match(byId['OD-F8-7'].question, /trust bundle|trust_bundle_ref/i);
});

// ---------------------------------------------------------------------------
// 0.2.0 — the proposal must not narrow the accepted receipt contract.
// ---------------------------------------------------------------------------

test('neither accepted F8 schema narrows the accepted receipt_id', () => {
  const accepted = readPacketJson(ACCEPTED_RECEIPT_SCHEMA_PATH).properties.receipt_id;
  assert.deepEqual(accepted, { type: 'string', minLength: 1 });

  for (const schemaPath of [STATEMENT_SCHEMA_PATH, ENVELOPE_SCHEMA_PATH]) {
    const proposed = readPacketJson(schemaPath).properties.receipt_id;
    assert.equal(proposed.type, 'string', schemaPath);
    assert.equal(proposed.minLength, accepted.minLength, schemaPath);
    for (const narrowing of ['maxLength', 'pattern', 'format', 'enum', 'const']) {
      assert.equal(
        Object.hasOwn(proposed, narrowing),
        false,
        `${schemaPath}: receipt_id must not narrow the accepted contract with '${narrowing}'`,
      );
    }
  }
});

test('a receipt_id the accepted contract allows is signable under the profile', () => {
  const { envelope, statement, receipt, trustBundle } = loadVector();
  // 512 characters: valid under the accepted schema, and previously unsignable
  // because the proposal capped receipt_id at 128.
  const longId = `rcpt-${'a'.repeat(507)}`;
  assert.equal(longId.length, 512);

  const wideReceipt = { ...receipt, receipt_id: longId };
  const wideStatement = {
    ...statement,
    receipt_id: longId,
    receipt_digest: canonicalReceiptDigest(wideReceipt),
  };
  const { privateKey } = deriveTestOnlyKeyPair();
  const jws = resignStatement(wideStatement, privateKey);
  const wideEnvelope = {
    ...envelope,
    receipt_id: longId,
    receipt_digest: wideStatement.receipt_digest,
    jws_compact: jws,
    signature_locator: computeSignatureLocator(jws),
  };

  assert.deepEqual(
    verifyReceiptSignatureEnvelope({
      envelope: wideEnvelope,
      statement: wideStatement,
      receipt: wideReceipt,
      trustBundle,
    }),
    [],
  );
});

// ---------------------------------------------------------------------------
// 0.2.0 — trust_bundle_ref is bound INSIDE the signed statement (OD-F8-7).
// ---------------------------------------------------------------------------

test('trust_bundle_ref is a required member of the signed statement', () => {
  const schema = readPacketJson(STATEMENT_SCHEMA_PATH);
  assert.ok(
    schema.required.includes('trust_bundle_ref'),
    'the signed statement must require trust_bundle_ref',
  );
  assert.deepEqual(schema.properties.trust_bundle_ref.required, ['bundle_uri', 'bundle_digest']);
  assert.equal(schema.properties.trust_bundle_ref.additionalProperties, false);

  const { envelope, statement } = loadVector();
  assert.deepEqual(statement.trust_bundle_ref, envelope.trust_bundle_ref);

  // The binding must actually be inside the signed bytes, not just alongside them.
  const payload = JSON.parse(
    Buffer.from(envelope.jws_compact.split('.')[1], 'base64url').toString('utf8'),
  );
  assert.deepEqual(payload.trust_bundle_ref, envelope.trust_bundle_ref);
});

test('an envelope trust_bundle_ref that disagrees with the signed statement is rejected', () => {
  const vector = loadVector();
  const rebound = {
    ...vector,
    envelope: {
      ...vector.envelope,
      trust_bundle_ref: {
        ...vector.envelope.trust_bundle_ref,
        bundle_digest: `sha256:${'0'.repeat(64)}`,
      },
    },
  };
  const fired = new Set(verifyReceiptSignatureEnvelope(rebound).map((finding) => finding.id));
  assert.ok(fired.has('RI-5'), `expected RI-5; got ${[...fired].join(', ') || 'nothing'}`);
});

test('a receipt signed under an earlier bundle generation still verifies after a rotation', () => {
  const { envelope, statement, receipt, trustBundle } = loadVector();

  // A later bundle generation: the signing key is retained, a second key is
  // added. The document — and therefore its digest — is not the one the signer
  // bound at signing time.
  const { jwk: rotationJwk } = deriveTestOnlyKeyPair(TEST_ONLY_ROTATION_SEED_LABEL);
  const rotatedBundle = {
    ...trustBundle,
    keys: [...trustBundle.keys, { kid: jwkThumbprintKid(rotationJwk), jwk: rotationJwk }],
  };
  assert.notEqual(trustBundleDigest(rotatedBundle), trustBundleDigest(trustBundle));
  assert.notEqual(trustBundleDigest(rotatedBundle), envelope.trust_bundle_ref.bundle_digest);

  // Historical verification: the bound reference is a provenance record of the
  // generation current at signing time, NOT a precondition the verifier's own
  // bundle must match. Requiring an exact match would make every receipt
  // unverifiable the moment the bundle changed.
  assert.deepEqual(
    verifyReceiptSignatureEnvelope({
      envelope,
      statement,
      receipt,
      trustBundle: rotatedBundle,
    }),
    [],
    'a rotation that retains the signing key must not invalidate a historical receipt',
  );

  // What still fails closed: a generation that no longer carries the kid at all.
  const revokedBundle = { ...trustBundle, keys: [{ kid: jwkThumbprintKid(rotationJwk), jwk: rotationJwk }] };
  const fired = new Set(
    verifyReceiptSignatureEnvelope({ envelope, statement, receipt, trustBundle: revokedBundle })
      .map((finding) => finding.id),
  );
  assert.ok(fired.has('RI-5'), 'an unresolvable kid must still fail closed');
});

// ---------------------------------------------------------------------------

test('an absent output_artifacts digests differently from an explicitly empty one', () => {
  const examples = readPacketJson(EXAMPLES_MANIFEST_PATH);
  assert.ok(examples, 'examples manifest must exist');
  const receipt = examples.test_vector.receipt;

  assert.equal(
    Object.hasOwn(receipt, 'output_artifacts'),
    false,
    'the frozen receipt must omit output_artifacts',
  );
  const absent = canonicalReceiptDigest(receipt);
  const empty = canonicalReceiptDigest({ ...receipt, output_artifacts: [] });
  assert.notEqual(absent, empty);
  assert.equal(absent, examples.test_vector.digest_evidence.output_artifacts_absent);
  assert.equal(empty, examples.test_vector.digest_evidence.output_artifacts_empty_array);

  // The same distinction must hold for the other `default: []` site, so the rule
  // is a property of the profile and not an accident of one field.
  assert.notEqual(
    absent,
    canonicalReceiptDigest({ ...receipt, input_artifact_digests: [] }),
  );
});

test('the receipt digest binds the profile id and ignores only receipt_digest and signature', () => {
  const examples = readPacketJson(EXAMPLES_MANIFEST_PATH);
  assert.ok(examples, 'examples manifest must exist');
  const receipt = examples.test_vector.receipt;
  const digest = canonicalReceiptDigest(receipt);

  // Stripping the two excluded keys changes nothing.
  const stripped = { ...receipt };
  delete stripped.receipt_digest;
  delete stripped.signature;
  assert.equal(canonicalReceiptDigest(stripped), digest);

  // A different receipt_digest or signature value still changes nothing.
  assert.equal(
    canonicalReceiptDigest({ ...receipt, receipt_digest: `sha256:${'0'.repeat(64)}`, signature: 'x' }),
    digest,
  );

  // Any other field change does change the digest.
  assert.notEqual(canonicalReceiptDigest({ ...receipt, tenant_id: 'other' }), digest);

  // The profile id is inside the hash input, so the same canonical bytes under a
  // different profile label cannot collide.
  const bytes = jcsBuffer(stripped);
  const withProfile = createHash('sha256')
    .update(Buffer.concat([Buffer.from(RECEIPT_DIGEST_PROFILE, 'utf8'), Buffer.from([0]), bytes]))
    .digest('hex');
  assert.equal(digest, `sha256:${withProfile}`);
  assert.notEqual(digest, `sha256:${createHash('sha256').update(bytes).digest('hex')}`);
});

// The digest RECIPE did not move between 0.1.0 and 0.2.0, and this is the check
// that says so in bytes: the frozen receipt still digests to the value the
// 0.1.0 packet froze. The envelope profile id moved to /v2 because the signed
// statement gained a required member; the digest profile id stayed /v1 because
// nothing about the hash input changed.
test('the 0.2.0 packet does not move the digest recipe pinned at 0.1.0', () => {
  const { receipt } = loadVector();
  assert.equal(
    canonicalReceiptDigest(receipt),
    'sha256:39ded94c4b25a4323c1dffcc90e01ca45ae461807b4991185480141a1ce8871e',
  );
  assert.equal(RECEIPT_DIGEST_PROFILE, 'CYBRIK-RECEIPT-JCS/v1');
  assert.equal(f8.SIGNATURE_ENVELOPE_PROFILE, ENVELOPE_PROFILE_ID);
  assert.equal(f8.PROFILE_VERSION, PACKET_VERSION);
});

test('every mutation probe is rejected by the rule it targets', () => {
  const vector = loadVector();
  assert.ok(vector.examples, 'examples manifest must exist');

  for (const probe of mutationProbes) {
    const ids = new Set(verifyReceiptSignatureEnvelope(probe.mutate(vector)).map((f) => f.id));
    assert.ok(ids.has(probe.id), `probe '${probe.label}' did not fire ${probe.id}`);
  }
});

test('each negative fixture is rejected by exactly the rule set it declares', () => {
  const examples = readPacketJson(EXAMPLES_MANIFEST_PATH);
  assert.ok(examples, 'examples manifest must exist');
  const base = {
    statement: readPacketJson(POSITIVE_STATEMENT_PATH),
    receipt: examples.test_vector.receipt,
    trustBundle: examples.trust_bundle,
  };

  const negatives = examples.examples.filter((entry) => entry.kind === 'negative');
  assert.equal(negatives.length, 4);
  for (const declaration of negatives) {
    const envelope = readPacketJson(
      `contracts/examples/receipt-integrity/${declaration.file}`,
    );
    assert.ok(envelope, `${declaration.file} must exist`);
    const fired = [
      ...new Set(verifyReceiptSignatureEnvelope({ ...base, envelope }).map((f) => f.id)),
    ].sort();
    assert.ok(fired.length > 0, `${declaration.file} was accepted`);
    assert.deepEqual(fired, declaration.rejected_by, declaration.file);
  }
});

test('contract-only acceptance keeps every implementation and runtime prerequisite open', () => {
  const manifest = readPacketJson(COMPATIBILITY_PATH);
  assert.ok(manifest, 'compatibility manifest must exist');

  assert.equal(manifest['x-cybrik-status'], ACCEPTED_STATUS);
  assert.equal(manifest['x-cybrik-not-accepted'], false);
  assert.equal(manifest['x-cybrik-not-implemented'], true);
  assert.equal(manifest['x-cybrik-packet-version'], PACKET_VERSION);
  assert.equal(manifest.gate.status, ACCEPTED_STATUS);
  assert.match(
    manifest.gate.decision_effective_at,
    /^2026-08-03T\d{2}:\d{2}:\d{2}\+07:00$/,
  );
  assert.match(manifest.gate.decision_authority, /Codex Governor/);
  for (const member of manifest.members) {
    assert.equal(member.status, ACCEPTED_STATUS, member.file);
  }
  // The four prerequisites F8 cannot close by itself must all still be open.
  for (const prerequisite of manifest.future_prerequisites) {
    assert.equal(prerequisite.state, 'OPEN', prerequisite.id);
  }
  assert.deepEqual(
    manifest.future_prerequisites.map((entry) => entry.id),
    [
      'credential-lease',
      'workload-attestation',
      'production-issuer-and-signer',
      'key-lifecycle',
    ],
  );
  assert.match(
    manifest.ownership.fabric,
    /control plane/,
    'receipts remain control-plane observed, never executor-attested',
  );
});

test('the standalone validator pins the local-time decision effective timestamp', () => {
  const manifest = readPacketJson(COMPATIBILITY_PATH);
  const overrides = new Map([
    [
      COMPATIBILITY_PATH,
      `${JSON.stringify({
        ...manifest,
        gate: { ...manifest.gate, decision_effective_at: '2026-08-03T00:00:00Z' },
      }, null, 2)}\n`,
    ],
  ]);
  const report = validateReceiptIntegrityProposal({ root: REPO_ROOT, overrides });
  assert.ok(
    report.errors.some((error) => /decision_effective_at must be 2026-08-03T06:48:44\+07:00/.test(error)),
    report.errors.join('\n'),
  );
});

test('the delegated-governor decision records scope, evidence, residuals, action, and rollback boundary', () => {
  const decision = readRepoText(DECISION_RECORD_PATH);

  assert.match(decision, /ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED/);
  assert.match(decision, /2026-08-03T\d{2}:\d{2}:\d{2}\+07:00/);
  assert.match(decision, /2026-08-03.*Asia\/Ho_Chi_Minh/i);
  for (const heading of ['Scope', 'Evidence', 'Remaining findings', 'Action', 'Rollback']) {
    assert.match(decision, new RegExp(`## \\d+\\. ${heading}`, 'i'), heading);
  }
  for (let question = 1; question <= 7; question += 1) {
    assert.match(decision, new RegExp(`(?:Q|OD-F8-)${question}\\b`), `Q${question}`);
  }
  assert.match(decision, /RFC 8785/);
  assert.match(decision, /RFC 7638/);
  assert.match(decision, /Ed25519-only/i);
  assert.match(decision, /excluding both `?receipt_digest`? and `?signature`?/i);
  assert.match(decision, /signing-time provenance/i);
  assert.match(decision, /accepted `cybrik\.execution-receipt\.v1` and `cybrik\.common-defs\.v1` bytes remain unchanged/i);
  assert.match(decision, /runtime.*NOT AUTHORIZED|NOT AUTHORIZED.*runtime/is);
  assert.match(decision, /production remains Founder-controlled/i);
});

test('the 0.2.0 version bump is applied consistently across the packet', () => {
  for (const relativePath of [STATEMENT_SCHEMA_PATH, ENVELOPE_SCHEMA_PATH, EXAMPLES_MANIFEST_PATH]) {
    assert.equal(
      readPacketJson(relativePath)['x-cybrik-contract-version'],
      PACKET_VERSION,
      relativePath,
    );
  }
  const statement = readPacketJson(POSITIVE_STATEMENT_PATH);
  const envelope = readPacketJson(POSITIVE_ENVELOPE_PATH);
  assert.equal(statement.profile_version, PACKET_VERSION);
  assert.equal(statement.profile, RECEIPT_DIGEST_PROFILE);
  assert.equal(envelope.envelope_profile, ENVELOPE_PROFILE_ID);
  assert.equal(envelope.envelope_version, PACKET_VERSION);
  assert.equal(envelope.digest_profile, RECEIPT_DIGEST_PROFILE);

  // The reused accepted receipt contract is NOT versioned by this packet.
  assert.equal(statement.receipt_contract_version, '0.1.0');
});

test('canonical npm validate directly executes F8 tests without changing W1 inventory', () => {
  const orchestrator = readFileSync(
    join(REPO_ROOT, 'tools/contract-validation/validate.mjs'),
    'utf8',
  );
  const packageJson = JSON.parse(
    readFileSync(join(REPO_ROOT, 'tools/contract-validation/package.json'), 'utf8'),
  );
  assert.equal(packageJson.scripts.validate, 'node validate.mjs');
  assert.match(
    orchestrator,
    /['"]validate-receipt-integrity\.mjs['"],\s*['"]tests\/validate-receipt-integrity\.test\.mjs['"],/,
    'the F8 test suite must be the direct canonical step after its validator',
  );
  const w1Inventory = orchestrator.slice(
    orchestrator.indexOf('const W1_CONTRACT_TEST_FILES'),
    orchestrator.indexOf('const W1_CONTRACT_TEST_COUNT'),
  );
  assert.doesNotMatch(
    w1Inventory,
    /validate-receipt-integrity\.test\.mjs/,
    'the additive F8 suite must not change the accepted W1 98-test inventory',
  );
});

test('F8 additions do not rewrite corpus-wide contract authority wording', () => {
  const contractsReadme = readRepoText('contracts/README.md');
  const schemaReadme = readRepoText('contracts/json-schema/README.md');
  assert.ok(contractsReadme.includes(
    'No contract has been accepted; no product may implement any of these until\n'
      + 'explicit Founder acceptance (ADR-0001 D5).',
  ));
  assert.ok(contractsReadme.includes(
    'Moving a contract out of `PROPOSED` requires explicit Founder approval. Do not scaffold\n'
      + 'placeholder OpenAPI/schema files as if they were accepted contracts.',
  ));
  assert.ok(schemaReadme.includes(
    'Conformance fixtures: `../examples/`. Moving any file out of `PROPOSED` requires explicit Founder approval.',
  ));
  assert.match(contractsReadme, /F8 receipt-integrity signature profile packet/);
  assert.match(schemaReadme, /F8 receipt-integrity signature profile/);
  assert.match(
    contractsReadme,
    /delegated Governor authority.*accepted exception.*F8 contract-only/is,
  );
  assert.match(
    schemaReadme,
    /delegated Governor authority.*accepted exception.*F8 contract-only/is,
  );
  for (const document of [contractsReadme, schemaReadme]) {
    assert.match(document, /production remains Founder-controlled/i);
    assert.match(document, /runtime.*UAT.*release.*remain|runtime.*release.*remain/is);
  }
});

const SCHEMA_ID_BASE = 'https://contracts.cybrik.example/json-schema';

const buildAjv = (options) => {
  const dependencyRequire = createRequire(join(resolve(DEPENDENCY_ROOT), 'package.json'));
  const AjvModule = dependencyRequire('ajv/dist/2020.js');
  const addFormatsModule = dependencyRequire('ajv-formats');
  const Ajv2020 = AjvModule.default || AjvModule;
  const addFormats = addFormatsModule.default || addFormatsModule;

  const ajv = new Ajv2020({ strict: true, allErrors: true, ...options });
  addFormats(ajv);
  for (const keyword of [
    'x-cybrik-status',
    'x-cybrik-not-accepted',
    'x-cybrik-not-implemented',
    'x-cybrik-contract-version',
    'x-cybrik-format-pins',
    'x-cybrik-profile',
  ]) {
    ajv.addKeyword({ keyword });
  }
  return ajv;
};

test('both accepted F8 schemas compile under official Ajv 2020-12 strict mode', () => {
  const names = [
    'cybrik.common-defs.v1.schema.json',
    'cybrik.receipt-signature-statement.v1.schema.json',
    'cybrik.receipt-signature-envelope.v1.schema.json',
  ];
  const documents = names.map((name) => readPacketJson(`contracts/json-schema/${name}`));
  assert.ok(documents.every(Boolean), 'both proposed schemas must exist');

  const ajv = buildAjv();
  for (const document of documents) ajv.addSchema(document);

  for (const [name, fixture] of [
    ['cybrik.receipt-signature-statement.v1.schema.json', readPacketJson(POSITIVE_STATEMENT_PATH)],
    ['cybrik.receipt-signature-envelope.v1.schema.json', readPacketJson(POSITIVE_ENVELOPE_PATH)],
  ]) {
    const validate = ajv.getSchema(`${SCHEMA_ID_BASE}/${name}`);
    assert.ok(validate, `${name} did not compile`);
    assert.equal(validate(fixture), true, `${name}: ${ajv.errorsText(validate.errors)}`);
  }
});

// The accepted cybrik.execution-receipt.v1 writes its conditional requirement as
// a bare `then: {"required": ["target_digest"]}` with no sibling property
// annotation. That is fully JSON Schema 2020-12 conformant; only Ajv's OPTIONAL
// strictRequired house rule objects to it. Relaxing exactly that one option — and
// nothing else — is what lets the frozen receipt be checked against the real
// accepted schema instead of a copy. Repairing the accepted schema is out of this
// proposal's scope and would change accepted bytes.
test('the frozen receipt validates against the accepted execution-receipt schema', () => {
  const examples = readPacketJson(EXAMPLES_MANIFEST_PATH);
  assert.ok(examples, 'examples manifest must exist');

  const ajv = buildAjv({ strictRequired: false });
  for (const name of [
    'cybrik.common-defs.v1.schema.json',
    'cybrik.execution-receipt.v1.schema.json',
  ]) {
    ajv.addSchema(readPacketJson(`contracts/json-schema/${name}`));
  }

  const validate = ajv.getSchema(`${SCHEMA_ID_BASE}/cybrik.execution-receipt.v1.schema.json`);
  assert.ok(validate, 'the accepted receipt schema did not compile');
  assert.equal(
    validate(examples.test_vector.receipt),
    true,
    ajv.errorsText(validate.errors),
  );
});

test('the statement pins the profile, canonicalization and reused receipt contract', () => {
  const statement = readPacketJson(POSITIVE_STATEMENT_PATH);
  assert.ok(statement, 'the signed-statement fixture must exist');

  assert.equal(statement.profile, RECEIPT_DIGEST_PROFILE);
  assert.equal(statement.profile_version, PACKET_VERSION);
  assert.equal(statement.canonicalization, CANONICALIZATION_ID);
  assert.equal(
    statement.receipt_contract_id,
    'https://contracts.cybrik.example/json-schema/cybrik.execution-receipt.v1.schema.json',
  );
  assert.equal(statement.receipt_contract_version, '0.1.0');
  assert.match(statement.kid, /^cybrik-receipt-signer:v1:[A-Za-z0-9_-]{43}$/);
});
