// validate-openapi.mjs — OpenAPI 3.1.x lint via Stoplight Spectral (vendor-maintained `oas`
// ruleset). CI gates on ERROR severity only; intentional style warnings (no servers/tags/
// contact/license on non-deployable mapping notes) do not fail the build. See .spectral.yaml.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const target = join(ROOT, 'contracts', 'openapi', 'cybrik-fabric-control-plane.v1.openapi.yaml');
const spectral = join(HERE, 'node_modules', '.bin', 'spectral');
const ruleset = join(HERE, '.spectral.yaml');

console.log('=== OpenAPI 3.1.x validation (Spectral oas ruleset, fail-severity=error) ===');
const r = spawnSync(spectral, ['lint', '--ruleset', ruleset, '--fail-severity', 'error', '--format', 'stylish', target], {
  stdio: 'inherit',
});
if (r.error) { console.error('spectral failed to run:', r.error.message); process.exit(1); }
if (r.status !== 0) { console.error(`\nFAIL — Spectral reported OpenAPI error(s) (exit ${r.status}).`); process.exit(1); }
console.log('OK — OpenAPI 3.1.x has no errors at fail-severity=error.');
