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
