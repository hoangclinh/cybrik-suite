// validate.mjs — canonical static-contract orchestrator. Runs every registered
// validator in sequence and aggregates results.
// Exit 0 only if all pass. Deterministic, no side effects.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const W1_CONTRACT_TEST_FILES = [
  'tests/validate-alert-context.test.mjs',
  'tests/validate-alert-context-transport.test.mjs',
  'tests/validate-investigation-lifecycle-proposal.test.mjs',
];
const W1_CONTRACT_TEST_COUNT = 98;

function runW1ContractTests() {
  const result = spawnSync(
    process.execPath,
    ['--test', ...W1_CONTRACT_TEST_FILES.map((file) => join(HERE, file))],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error || result.status !== 0) {
    console.error(
      `FAIL — W1 contract tests exited ${result.status ?? 'without a status'}.`,
    );
    return 1;
  }
  const counts = [
    ...(result.stdout ?? '').matchAll(/^(?:#|ℹ) tests (\d+)$/gm),
  ].map((match) => Number(match[1]));
  if (counts.length !== 1 || counts[0] !== W1_CONTRACT_TEST_COUNT) {
    console.error(
      `FAIL — expected exactly ${W1_CONTRACT_TEST_COUNT} completed W1 contract tests; ` +
        `observed ${counts.length === 1 ? counts[0] : JSON.stringify(counts)}.`,
    );
    return 1;
  }
  console.log(
    `W1 CONTRACT TEST COUNT: PASS (${W1_CONTRACT_TEST_COUNT}/${W1_CONTRACT_TEST_COUNT})`,
  );
  return 0;
}

if (process.argv.includes('--test-w1-contracts')) {
  process.exit(runW1ContractTests());
}

// These 25 validators cover the accepted corpus and additive proposal checks.
const steps = [
  'validate-schemas.mjs',
  'validate-inference.mjs',
  'validate-svc.mjs',
  'validate-org.mjs',
  'tests/dependency-compat.test.mjs',
  'validate-openapi.mjs',
  'validate-asyncapi.mjs',
  'validate-alert-context.mjs',
  'validate-alert-context-transport.mjs',
  'validate-investigation-lifecycle-proposal.mjs',
  // F8 receipt-integrity signature profile — PROPOSED, NOT ACCEPTED. Registered
  // here so the proposal cannot silently rot; its test file is deliberately kept
  // out of W1_CONTRACT_TEST_FILES so the pinned W1 contract-test count above is
  // unchanged by a non-W1 proposal.
  'validate-receipt-integrity.mjs',
  'tests/validate-receipt-integrity.test.mjs',
  // W2-I inference transport-binding profile — PROPOSED, NOT ACCEPTED and
  // NOT IMPLEMENTED. Registration prevents proposal drift; it opens no gate.
  'validate-transport.mjs',
  'tests/validate-transport.test.mjs',
  // W2-H resource-bounds packet — ACCEPTED FOR IMPLEMENTATION but NOT
  // IMPLEMENTED. L1/L2 checks are deterministic Suite-side static evidence;
  // they are never runtime, T10/T11, release or production proof.
  'validate-resource-bounds.mjs',
  'tests/validate-resource-bounds.test.mjs',
  'validate-svc-lifecycle.mjs',
  'tests/validate-svc-lifecycle.test.mjs',
  'validate-runtime-admission.mjs',
  'tests/validate-runtime-admission.test.mjs',
  // W2-K transport peer-evidence profile — ACCEPTED FOR IMPLEMENTATION but
  // NOT IMPLEMENTED. Server-neutral, fail-closed static conformance only; it
  // opens no socket, selects no server, and grants no runtime, UAT, release,
  // deployment or production authority.
  'validate-transport-peer.mjs',
  'tests/validate-transport-peer.test.mjs',
  // Receipt trust-bundle and durability design — ACCEPTED FOR IMPLEMENTATION
  // and NOT IMPLEMENTED. Static packet and semantic-fixture evidence only.
  'validate-receipt-trust-durability.mjs',
  'tests/validate-receipt-trust-durability.test.mjs',
  '../../tools/operations/validate-w1-control.mjs',
];
let failed = 0;
for (const s of steps) {
  const r = spawnSync(process.execPath, [join(HERE, s)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
  console.log('');
}
if (failed) { console.error(`FAIL — ${failed}/${steps.length} validator(s) reported errors.`); process.exit(1); }
console.log('ALL GREEN — the mixed-lifecycle static contract corpus passes its registered JSON Schema 2020-12, OpenAPI 3.1.x, AsyncAPI 3.0.0 and security/trust invariants, including validate-transport for W2-I PROPOSED / NOT ACCEPTED, validate-resource-bounds for W2-H ACCEPTED FOR IMPLEMENTATION / NOT IMPLEMENTED, validate-transport-peer for W2-K ACCEPTED FOR IMPLEMENTATION / NOT IMPLEMENTED, and receipt trust/durability as ACCEPTED FOR IMPLEMENTATION / NOT IMPLEMENTED. This is static conformance only, not runtime or release proof; it also proves no UAT, T10/T11, deployment or production readiness.');
