// Test suite for the F8 receipt-integrity signature-profile validator.
//
// The packet under test is `PROPOSED` and **NOT ACCEPTED**. Green here proves
// the proposed profile is internally consistent and that its frozen vector is
// cryptographically reproducible. It decides no ADR, closes no F8 deferral,
// implements nothing, and promotes nothing.
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
import {
  CANONICALIZATION_ID,
  COMPATIBILITY_PATH,
  EXAMPLES_MANIFEST_PATH,
  JWS_TYP,
  PROFILE_VERSION,
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

const TEST_ONLY_SEED_LABEL = 'CYBRIK-F8-TEST-ONLY-ED25519-SEED/v1';
// RFC 8410 PKCS#8 prefix for an Ed25519 private key holding a bare 32-byte seed.
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

const readPacketJson = (relativePath) => {
  const absolutePath = join(REPO_ROOT, relativePath);
  if (!existsSync(absolutePath)) return undefined;
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
};

const jcsBuffer = (value) => Buffer.from(canonicalizeJcs(value), 'utf8');
const b64u = (buffer) => Buffer.from(buffer).toString('base64url');

/** TEST-ONLY. Derived at runtime; never written to disk, never a real signer. */
const deriveTestOnlyKeyPair = () => {
  const seed = createHash('sha256').update(TEST_ONLY_SEED_LABEL, 'utf8').digest();
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

test('the F8 receipt-integrity proposal packet is internally consistent', () => {
  const report = validateReceiptIntegrityProposal({ root: REPO_ROOT });

  assert.deepEqual(report.errors, []);
  assert.equal(report.status, 'PROPOSED');
  assert.equal(report.notAccepted, true);
  assert.equal(report.packetVersion, '0.1.0');
  assert.equal(report.gateStatus, 'OPEN — NOT DECIDED');
  assert.equal(report.counts.packetFiles, expectedPacketPaths.length);
  assert.equal(report.counts.positiveFixtures, 2);
  assert.equal(report.counts.negativeFixtures, 4);
  assert.equal(report.counts.rejectionRules, 7);
  assert.equal(report.counts.mutationProbes, mutationProbes.length);
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

test('the frozen compact JWS is byte-exactly reproducible from the TEST-ONLY seed', () => {
  const statement = readPacketJson(
    'contracts/examples/receipt-integrity/positive/receipt-signature-statement.json',
  );
  const envelope = readPacketJson(
    'contracts/examples/receipt-integrity/positive/receipt-signature-envelope.json',
  );
  assert.ok(statement && envelope, 'positive fixtures must exist');

  const { privateKey, jwk } = deriveTestOnlyKeyPair();
  assert.equal(jwkThumbprintKid(jwk), statement.kid);
  assert.equal(resignStatement(statement, privateKey), envelope.jws_compact);
  assert.equal(computeSignatureLocator(envelope.jws_compact), envelope.signature_locator);
});

test('Ed25519 verification of the frozen vector succeeds and its trust bundle holds no private key', () => {
  const examples = readPacketJson(EXAMPLES_MANIFEST_PATH);
  assert.ok(examples, 'examples manifest must exist');

  const { jwk } = deriveTestOnlyKeyPair();
  assert.deepEqual(examples.trust_bundle.keys.map((entry) => entry.jwk), [jwk]);
  assert.equal(examples.trust_bundle_digest, trustBundleDigest(examples.trust_bundle));
  assert.equal(
    JSON.stringify(examples).includes('"d"'),
    false,
    'no private-key component may appear in the examples manifest',
  );

  const findings = verifyReceiptSignatureEnvelope({
    envelope: readPacketJson(
      'contracts/examples/receipt-integrity/positive/receipt-signature-envelope.json',
    ),
    statement: readPacketJson(
      'contracts/examples/receipt-integrity/positive/receipt-signature-statement.json',
    ),
    receipt: examples.test_vector.receipt,
    trustBundle: examples.trust_bundle,
  });
  assert.deepEqual(findings, []);
});

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

test('every mutation probe is rejected by the rule it targets', () => {
  const examples = readPacketJson(EXAMPLES_MANIFEST_PATH);
  assert.ok(examples, 'examples manifest must exist');
  const vector = {
    envelope: readPacketJson(
      'contracts/examples/receipt-integrity/positive/receipt-signature-envelope.json',
    ),
    statement: readPacketJson(
      'contracts/examples/receipt-integrity/positive/receipt-signature-statement.json',
    ),
    receipt: examples.test_vector.receipt,
    trustBundle: examples.trust_bundle,
  };

  for (const probe of mutationProbes) {
    const ids = new Set(verifyReceiptSignatureEnvelope(probe.mutate(vector)).map((f) => f.id));
    assert.ok(ids.has(probe.id), `probe '${probe.label}' did not fire ${probe.id}`);
  }
});

test('each negative fixture is rejected by exactly the rule set it declares', () => {
  const examples = readPacketJson(EXAMPLES_MANIFEST_PATH);
  assert.ok(examples, 'examples manifest must exist');
  const base = {
    statement: readPacketJson(
      'contracts/examples/receipt-integrity/positive/receipt-signature-statement.json',
    ),
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

test('the packet stays PROPOSED and claims no decision, closure or promotion', () => {
  const manifest = readPacketJson(COMPATIBILITY_PATH);
  assert.ok(manifest, 'compatibility manifest must exist');

  assert.equal(manifest['x-cybrik-status'], 'PROPOSED');
  assert.equal(manifest['x-cybrik-not-accepted'], true);
  assert.equal(manifest.gate.status, 'OPEN — NOT DECIDED');
  assert.match(manifest.gate.decision_authority, /Founder/);
  for (const member of manifest.members) {
    assert.equal(member.status, 'PROPOSED', member.file);
  }
  // The five prerequisites F8 cannot close by itself must all still be open.
  for (const prerequisite of manifest.future_prerequisites) {
    assert.equal(prerequisite.state, 'OPEN', prerequisite.id);
  }
  assert.match(
    manifest.ownership.fabric,
    /control plane/,
    'receipts remain control-plane observed, never executor-attested',
  );
});

test('the two proposed schemas compile under official Ajv 2020-12 strict mode', () => {
  const dependencyRequire = createRequire(join(resolve(DEPENDENCY_ROOT), 'package.json'));
  const AjvModule = dependencyRequire('ajv/dist/2020.js');
  const addFormatsModule = dependencyRequire('ajv-formats');
  const Ajv2020 = AjvModule.default || AjvModule;
  const addFormats = addFormatsModule.default || addFormatsModule;

  const names = [
    'cybrik.common-defs.v1.schema.json',
    'cybrik.execution-receipt.v1.schema.json',
    'cybrik.receipt-signature-statement.v1.schema.json',
    'cybrik.receipt-signature-envelope.v1.schema.json',
  ];
  const documents = names.map((name) => readPacketJson(`contracts/json-schema/${name}`));
  assert.ok(documents.every(Boolean), 'both proposed schemas must exist');

  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  for (const keyword of [
    'x-cybrik-status',
    'x-cybrik-not-accepted',
    'x-cybrik-contract-version',
    'x-cybrik-format-pins',
    'x-cybrik-profile',
  ]) {
    ajv.addKeyword({ keyword });
  }
  for (const document of documents) ajv.addSchema(document);

  const examples = readPacketJson(EXAMPLES_MANIFEST_PATH);
  assert.ok(examples, 'examples manifest must exist');
  for (const [name, fixture] of [
    [
      'cybrik.receipt-signature-statement.v1.schema.json',
      readPacketJson('contracts/examples/receipt-integrity/positive/receipt-signature-statement.json'),
    ],
    [
      'cybrik.receipt-signature-envelope.v1.schema.json',
      readPacketJson('contracts/examples/receipt-integrity/positive/receipt-signature-envelope.json'),
    ],
    ['cybrik.execution-receipt.v1.schema.json', examples.test_vector.receipt],
  ]) {
    const validate = ajv.getSchema(
      `https://contracts.cybrik.example/json-schema/${name}`,
    );
    assert.ok(validate, `${name} did not compile`);
    assert.equal(validate(fixture), true, `${name}: ${ajv.errorsText(validate.errors)}`);
  }
});

test('the statement pins the profile, canonicalization and reused receipt contract', () => {
  const statement = readPacketJson(
    'contracts/examples/receipt-integrity/positive/receipt-signature-statement.json',
  );
  assert.ok(statement, 'the signed-statement fixture must exist');

  assert.equal(statement.profile, RECEIPT_DIGEST_PROFILE);
  assert.equal(statement.profile_version, PROFILE_VERSION);
  assert.equal(statement.canonicalization, CANONICALIZATION_ID);
  assert.equal(
    statement.receipt_contract_id,
    'https://contracts.cybrik.example/json-schema/cybrik.execution-receipt.v1.schema.json',
  );
  assert.equal(statement.receipt_contract_version, '0.1.0');
  assert.match(statement.kid, /^cybrik-receipt-signer:v1:[0-9a-f]{64}$/);
});
