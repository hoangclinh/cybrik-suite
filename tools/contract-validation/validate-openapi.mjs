// validate-openapi.mjs — OpenAPI 3.1.x lint via Stoplight Spectral (vendor-maintained `oas`
// ruleset). CI gates on ERROR severity only; intentional style warnings (no servers/tags/
// contact/license on non-deployable mapping notes) do not fail the build. See .spectral.yaml.
// The lint runs in process through vendor/spectral-lint-compat, which mirrors the dropped
// @stoplight/spectral-cli 6.16.2 lint path, stylish output and exit codes.

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { lint } from './vendor/spectral-lint-compat/index.cjs';

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
const ruleset = join(HERE, '.spectral.yaml');

console.log('=== OpenAPI 3.1.x validation (Spectral oas ruleset, fail-severity=error) ===');
let failed = 0;
for (const target of targets) {
  const r = await lint({ rulesetPath: ruleset, documentPath: target });
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  if (r.exitCode !== 0) { console.error(`\nFAIL — Spectral reported OpenAPI error(s) in ${target} (exit ${r.exitCode}).`); failed++; }
}
// exitCode rather than exit(): stdout to a pipe is asynchronous on macOS, so exit() could truncate it.
if (failed) { console.error(`\nFAIL — ${failed}/${targets.length} OpenAPI document(s) reported errors.`); process.exitCode = 1; }
else { console.log('OK — OpenAPI 3.1.x has no errors at fail-severity=error.'); }
