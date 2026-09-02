import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('Spectral transitive minimatch retains its callable CommonJS contract', () => {
  const minimatch = require('minimatch');

  assert.equal(typeof minimatch, 'function');
  assert.equal(minimatch('src/api/route.js', 'src/{api,ui}/**/*.js'), true);
  assert.deepEqual(
    minimatch.braceExpand('src/{api,ui}/**/*.js'),
    ['src/api/**/*.js', 'src/ui/**/*.js'],
  );
});

test('brace-expansion exposes both legacy-callable and patched named APIs', () => {
  const braceExpansion = require('brace-expansion');
  const adapterManifest = require('brace-expansion/package.json');
  const upstreamManifest = require('brace-expansion-v5/package.json');

  assert.equal(typeof braceExpansion, 'function');
  assert.equal(typeof braceExpansion.expand, 'function');
  assert.equal(adapterManifest.version, '5.0.9-cybrik.1');
  assert.equal(upstreamManifest.version, '5.0.9');
  assert.equal(braceExpansion.EXPANSION_MAX, 100_000);
  assert.equal(braceExpansion.EXPANSION_MAX_LENGTH, 4_000_000);
  assert.deepEqual(braceExpansion('{alpha,beta}'), ['alpha', 'beta']);
  assert.deepEqual(braceExpansion.expand('{alpha,beta}'), ['alpha', 'beta']);

  const bounded = braceExpansion('{a,b}'.repeat(20), {
    max: 8,
    maxLength: 64,
  });
  assert.equal(bounded.length <= 8, true);
  assert.equal(
    bounded.reduce((total, value) => total + value.length, 0) <= 64,
    true,
  );
});

test('.github/workflows/contracts.yml runner OS and supply-chain immutability invariants', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, '../../..');
  const contractsYmlPath = path.resolve(root, '.github/workflows/contracts.yml');

  const content = fs.readFileSync(contractsYmlPath, 'utf8');
  const lines = content.split('\n');

  // 1. Zero unhashed / unpinned pip install commands
  const pipInstallLines = lines.filter(
    (line) => /\bpip install\b/.test(line) && !line.trim().startsWith('#')
  );
  assert.equal(
    pipInstallLines.length,
    0,
    `.github/workflows/contracts.yml must contain zero pip install commands (found: ${pipInstallLines.join(', ')})`,
  );

  // 2. All runner declarations strictly pinned to ubuntu-24.04
  const runnerLines = lines
    .map((line, idx) => ({ line: line.trim(), lineNo: idx + 1 }))
    .filter(({ line }) => line.startsWith('runs-on:'));
  assert.equal(runnerLines.length >= 3, true, 'Expected at least 3 runs-on declarations');
  for (const { line, lineNo } of runnerLines) {
    const runnerVal = line.replace('runs-on:', '').trim();
    assert.equal(
      runnerVal,
      'ubuntu-24.04',
      `Line ${lineNo}: runner must be pinned to ubuntu-24.04 (got: ${runnerVal})`,
    );
  }

  // 3. All GitHub Actions pinned to 40-char commit SHAs
  const usesLines = lines
    .map((line, idx) => ({ line: line.trim(), lineNo: idx + 1 }))
    .filter(({ line }) => line.startsWith('uses:') || line.startsWith('- uses:'));
  assert.equal(usesLines.length >= 3, true, 'Expected action uses lines');
  for (const { line, lineNo } of usesLines) {
    const actionRef = line.split('uses:')[1].trim().split('#')[0].trim();
    assert.equal(actionRef.includes('@'), true, `Line ${lineNo}: action ref missing @: ${actionRef}`);
    const [actionName, ref] = actionRef.split('@');
    assert.match(
      ref,
      /^[0-9a-f]{40}$/,
      `Line ${lineNo}: action ${actionName} must be pinned to 40-hex commit SHA (got: ${ref})`,
    );
  }
});
