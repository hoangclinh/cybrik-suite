// validate-openapi.mjs — OpenAPI 3.1.x lint via Stoplight Spectral (vendor-maintained `oas`
// ruleset). CI gates on ERROR severity only; intentional style warnings (no servers/tags/
// contact/license on non-deployable mapping notes) do not fail the build. See .spectral.yaml.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
// Accepted v0.1 control-plane mapping notes + the ACCEPTED W2-D inference-plane mapping notes
// + the W2-I PROPOSED / NOT ACCEPTED compatible successor. All are non-deployable,
// server-less mapping notes; lint each at fail-severity=error.
const targets = [
  join(ROOT, 'contracts', 'openapi', 'cybrik-fabric-control-plane.v1.openapi.yaml'),
  join(ROOT, 'contracts', 'openapi', 'cybrik-ai-inference-plane.v1.openapi.yaml'),
  join(ROOT, 'contracts', 'openapi', 'cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml'),
];
const spectral = join(HERE, 'node_modules', '.bin', 'spectral');
const ruleset = join(HERE, '.spectral.yaml');

console.log('=== OpenAPI 3.1.x validation (Spectral oas ruleset, fail-severity=error) ===');
let failed = 0;
for (const target of targets) {
  const r = spawnSync(spectral, ['lint', '--ruleset', ruleset, '--fail-severity', 'error', '--format', 'stylish', target], {
    stdio: 'inherit',
  });
  if (r.error) { console.error('spectral failed to run:', r.error.message); process.exit(1); }
  if (r.status !== 0) { console.error(`\nFAIL — Spectral reported OpenAPI error(s) in ${target} (exit ${r.status}).`); failed++; }
}
if (failed) { console.error(`\nFAIL — ${failed}/${targets.length} OpenAPI document(s) reported errors.`); process.exit(1); }
console.log('OK — OpenAPI 3.1.x has no errors at fail-severity=error.');
