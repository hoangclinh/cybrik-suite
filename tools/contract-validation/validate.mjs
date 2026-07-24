// validate.mjs — orchestrator. Runs the three validators in sequence and aggregates results.
// Exit 0 only if all pass. Deterministic, no side effects.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const steps = ['validate-schemas.mjs', 'validate-inference.mjs', 'validate-svc.mjs', 'validate-org.mjs', 'validate-openapi.mjs', 'validate-asyncapi.mjs'];
let failed = 0;
for (const s of steps) {
  const r = spawnSync(process.execPath, [join(HERE, s)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
  console.log('');
}
if (failed) { console.error(`FAIL — ${failed}/${steps.length} validator(s) reported errors.`); process.exit(1); }
console.log('ALL GREEN — accepted v0.1 packet + ACCEPTED-FOR-IMPLEMENTATION W2-D inference, W2-F service-delegation and W2-G org-hierarchy packets pass JSON Schema 2020-12, OpenAPI 3.1.x, AsyncAPI 3.0.0 and their security/trust invariants.');
