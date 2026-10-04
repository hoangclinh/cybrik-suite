import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

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
  assert.equal(adapterManifest.version, '5.0.12-cybrik.1');
  assert.equal(upstreamManifest.version, '5.0.12');
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

// In-process Spectral lint (vendor/spectral-lint-compat) that replaced @stoplight/spectral-cli 6.16.2:
// parity cell, fail-closed plants, the reviewer-command shim, and the dependency pins of the drop.
const { lint } = require('../vendor/spectral-lint-compat/index.cjs');

const TOOL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(TOOL_DIR, '../..');
const OPENAPI_DIR = path.join(REPO_ROOT, 'contracts', 'openapi');
const RULESET = path.join(TOOL_DIR, '.spectral.yaml');
const SHIM_DIR = path.join(TOOL_DIR, 'vendor', 'spectral-lint-compat');
const SHIM_BIN = path.join(SHIM_DIR, 'bin', 'spectral.cjs');
const LIFECYCLE_DOC = 'cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml';
const LIFECYCLE_MANIFEST = path.join(
  REPO_ROOT,
  'contracts',
  'compatibility',
  'cybrik-suite-investigation-lifecycle-proposal.v1.manifest.json',
);
const PINNED_SHIM_ARGV = [
  'lint',
  '--ruleset',
  '.spectral.yaml',
  '--fail-severity',
  'error',
  '--format',
  'stylish',
  `../../contracts/openapi/${LIFECYCLE_DOC}`,
];
const NO_FILES_MESSAGE =
  'No files found to lint. Please check your file path and extension and try again\n';

// @stoplight/spectral-cli 6.16.2 baseline at #94 (79ed0a76), one row per result:
// `rule code|JSON path|0-based range start-end|severity`. Every row equals the CLI's own result, and the
// code, path, start and severity of every row equal #94's CI log of 2026-09-30 (node 24.18.1).
const SPECTRAL_CLI_BASELINE = {
  'cybrik-fabric-control-plane.v1.openapi.yaml': [
    'info-contact|info|10:5-20:30|1',
    'oas3-api-servers||9:0-198:75|1',
    'operation-description|paths./api/v1/approvals/{approval_id}.get|155:8-170:60|1',
    'operation-description|paths./api/v1/approvals/{approval_id}/decision.post|172:9-198:75|1',
    'operation-description|paths./api/v1/capabilities/{name}.get|71:8-86:55|1',
    'operation-description|paths./api/v1/invocations.post|88:9-136:64|1',
    'operation-description|paths./api/v1/receipts/{receipt_id}.get|138:8-153:61|1',
    'operation-tags|paths./api/v1/approvals/{approval_id}.get|155:8-170:60|1',
    'operation-tags|paths./api/v1/approvals/{approval_id}/decision.post|172:9-198:75|1',
    'operation-tags|paths./api/v1/capabilities.get|57:8-69:57|1',
    'operation-tags|paths./api/v1/capabilities/{name}.get|71:8-86:55|1',
    'operation-tags|paths./api/v1/invocations.post|88:9-136:64|1',
    'operation-tags|paths./api/v1/receipts/{receipt_id}.get|138:8-153:61|1',
  ],
  'cybrik-ai-inference-plane.v1.openapi.yaml': [
    'info-contact|info|16:5-26:30|1',
    'oas3-api-servers||15:0-162:55|1',
    'operation-tags|paths./api/v1/inferences.post|107:9-134:55|1',
    'operation-tags|paths./api/v1/model-classes.get|72:8-86:62|1',
    'operation-tags|paths./api/v1/model-classes/{model_class}/health.get|88:8-105:56|1',
    'operation-tags|paths./api/v1/summarizations.post|136:9-162:55|1',
  ],
  'cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml': [
    'info-contact|info|62:5-86:95|1',
    'oas3-api-servers||61:0-358:41|1',
    'oas3-unused-component|components.responses.BadRequest|165:15-170:113|1',
    'oas3-unused-component|components.responses.Conflict|187:13-192:121|1',
    'oas3-unused-component|components.responses.Forbidden|177:14-186:31|1',
    'oas3-unused-component|components.responses.InferenceError|219:19-224:60|1',
    'oas3-unused-component|components.responses.InferenceOrTransportError|199:30-213:95|1',
    'oas3-unused-component|components.responses.RateLimited|193:16-198:119|1',
    'oas3-unused-component|components.responses.Unauthenticated|171:20-176:113|1',
    'oas3-unused-component|components.schemas.TransportAuthorizationError|154:32-155:80|1',
    'operation-tags|paths./api/v1/inferences.post|289:9-323:41|1',
    'operation-tags|paths./api/v1/model-classes.get|234:8-255:41|1',
    'operation-tags|paths./api/v1/model-classes/{model_class}/health.get|260:8-283:41|1',
    'operation-tags|paths./api/v1/summarizations.post|327:9-358:41|1',
  ],
  [LIFECYCLE_DOC]: [
    'info-contact|info|12:5-25:30|1',
    'oas3-api-servers||11:0-211:56|1',
    'operation-tags|paths./api/v1/investigations.post|84:9-118:72|1',
    'operation-tags|paths./api/v1/investigations/{investigation_id}.get|120:8-137:56|1',
    'operation-tags|paths./api/v1/investigations/{investigation_id}/bundle.get|190:8-211:56|1',
    'operation-tags|paths./api/v1/investigations/{investigation_id}/checkpoints.get|139:8-159:56|1',
    'operation-tags|paths./api/v1/investigations/{investigation_id}:cancel.post|161:9-188:56|1',
  ],
};
const GATED_TARGETS = [
  'cybrik-fabric-control-plane.v1.openapi.yaml',
  'cybrik-ai-inference-plane.v1.openapi.yaml',
  'cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml',
];

const resultKey = (r) =>
  `${r.code}|${r.path.join('.')}|${r.range.start.line}:${r.range.start.character}-` +
  `${r.range.end.line}:${r.range.end.character}|${r.severity}`;
const resultKeys = (results) => results.map(resultKey).sort();
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function withTempDir(callback) {
  // realpath: macOS os.tmpdir() is a symlink, and node reports a main module by its realpath.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'spectral-lint-compat-')));
  return Promise.resolve()
    .then(() => callback(dir))
    .finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

function plant(dir, name, lines) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
}

function runShim(argv) {
  return spawnSync(process.execPath, [SHIM_BIN, ...argv], { cwd: TOOL_DIR, encoding: 'utf8' });
}

test('Spectral parity cell: each gated OpenAPI target equals the spectral-cli 6.16.2 baseline', async () => {
  assert.deepEqual(
    GATED_TARGETS.map((name) => SPECTRAL_CLI_BASELINE[name].length),
    [13, 6, 14],
  );
  for (const name of GATED_TARGETS) {
    const r = await lint({ rulesetPath: RULESET, documentPath: path.join(OPENAPI_DIR, name) });
    const warnings = SPECTRAL_CLI_BASELINE[name].length;

    assert.equal(r.exitCode, 0, name);
    assert.equal(r.stderr, '', name);
    assert.deepEqual(resultKeys(r.results), [...SPECTRAL_CLI_BASELINE[name]].sort(), name);
    assert.equal(r.results.filter((result) => result.severity === 0).length, 0, name);
    assert.match(
      r.stdout,
      new RegExp(` ${warnings} problems \\(0 errors, ${warnings} warnings, 0 infos, 0 hints\\)`),
    );
  }
});

test('validate-openapi.mjs lints every gated target in process and exits 0 at fail-severity=error', () => {
  const r = spawnSync(process.execPath, [path.join(TOOL_DIR, 'validate-openapi.mjs')], {
    cwd: TOOL_DIR,
    encoding: 'utf8',
  });

  assert.equal(r.status, 0, r.stderr);
  for (const name of GATED_TARGETS) {
    assert.equal(r.stdout.includes(path.join(OPENAPI_DIR, name)), true, name);
  }
  for (const warnings of [13, 6, 14]) {
    assert.equal(
      r.stdout.includes(`${warnings} problems (0 errors, ${warnings} warnings, 0 infos, 0 hints)`),
      true,
    );
  }
  assert.equal(r.stdout.includes('OK — OpenAPI 3.1.x has no errors at fail-severity=error.'), true);
});

test('Spectral plants: an invalid OpenAPI document and a YAML duplicate key fail with exit 1', async () => {
  await withTempDir(async (dir) => {
    const invalid = plant(dir, 'planted-invalid.openapi.yaml', [
      'openapi: 3.1.0',
      'info:',
      '  title: Planted invalid document',
      '  version: 1.0.0',
      'paths:',
      '  /things:',
      '    get:',
      '      responses: 42',
    ]);
    const duplicate = plant(dir, 'planted-duplicate-key.openapi.yaml', [
      'openapi: 3.1.0',
      'info:',
      '  title: Planted duplicate key',
      '  title: Twice',
      '  version: 1.0.0',
      'paths: {}',
    ]);

    const invalidRun = await lint({ rulesetPath: RULESET, documentPath: invalid });
    assert.equal(invalidRun.exitCode, 1);
    assert.deepEqual(
      resultKeys(invalidRun.results).filter((key) => key.endsWith('|0')),
      ['oas3-schema|paths./things.get.responses|7:17-7:19|0'],
    );

    const duplicateRun = await lint({ rulesetPath: RULESET, documentPath: duplicate });
    assert.equal(duplicateRun.exitCode, 1);
    assert.deepEqual(
      resultKeys(duplicateRun.results).filter((key) => key.endsWith('|0')),
      ['parser|info.title|3:2-3:7|0'],
    );
  });
});

test('Spectral plants: a missing, directory or empty target exits 2 with the CLI message', async () => {
  for (const documentPath of [
    path.join(OPENAPI_DIR, 'does-not-exist.openapi.yaml'),
    OPENAPI_DIR,
  ]) {
    const r = await lint({ rulesetPath: RULESET, documentPath });
    assert.deepEqual(
      { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, results: r.results },
      { exitCode: 2, stdout: '', stderr: NO_FILES_MESSAGE, results: [] },
      documentPath,
    );
  }
  for (const documentPath of ['', undefined]) {
    const r = await lint({ rulesetPath: RULESET, documentPath });
    assert.equal(r.exitCode, 2);
    assert.deepEqual(r.results, []);
  }
});

test('Spectral plants: any ruleset other than extends ["spectral:oas"] exits 2 without linting', async () => {
  await withTempDir(async (dir) => {
    const variants = {
      'extra-rule': ['extends:', '  - "spectral:oas"', 'rules:', '  info-contact: off'],
      'other-ruleset': ['extends:', '  - "spectral:asyncapi"'],
      'scalar-extends': ['extends: "spectral:oas"'],
      'severity-tuple': ['extends:', '  - - "spectral:oas"', '    - all'],
      'two-entries': ['extends:', '  - "spectral:oas"', '  - "spectral:oas"'],
      'duplicate-key': ['extends:', '  - "spectral:oas"', 'extends:', '  - "spectral:oas"'],
      'two-documents': ['extends:', '  - "spectral:oas"', '---', 'extends:', '  - "spectral:oas"'],
      'empty': [''],
    };
    const target = path.join(OPENAPI_DIR, GATED_TARGETS[0]);
    for (const [name, lines] of Object.entries(variants)) {
      const r = await lint({ rulesetPath: plant(dir, `${name}.spectral.yaml`, lines), documentPath: target });
      assert.deepEqual([r.exitCode, r.stdout, r.results], [2, '', []], name);
      assert.notEqual(r.stderr, '', name);
    }
    for (const rulesetPath of [path.join(dir, 'missing.spectral.yaml'), dir]) {
      const r = await lint({ rulesetPath, documentPath: target });
      assert.deepEqual(
        [r.exitCode, r.stderr],
        [2, `Could not read ruleset at ${rulesetPath}.\n`],
        rulesetPath,
      );
    }
  });
});

test('Spectral plants: glob, brace, URL and other non-path targets exit 2 without linting', async () => {
  for (const documentPath of [
    path.join(OPENAPI_DIR, '*.openapi.yaml'),
    path.join(OPENAPI_DIR, 'cybrik-ai-inference-plane.v1.{openapi,contract-0.2.0.openapi}.yaml'),
    path.join(OPENAPI_DIR, 'cybrik-fabric-control-plane.v1.openapi.yam?'),
    path.join(OPENAPI_DIR, '[c]ybrik-fabric-control-plane.v1.openapi.yaml'),
    path.join(OPENAPI_DIR, '!(x).yaml'),
    'https://example.invalid/openapi.yaml',
    `file://${path.join(OPENAPI_DIR, GATED_TARGETS[0])}`,
  ]) {
    const r = await lint({ rulesetPath: RULESET, documentPath });
    assert.deepEqual([r.exitCode, r.stdout, r.results], [2, '', []], documentPath);
    assert.match(r.stderr, /^Unsupported document path /, documentPath);
  }
});

test('Spectral plants: an unexpected exception exits 2 instead of escaping', async () => {
  for (const options of [{ rulesetPath: RULESET, documentPath: 'x.yaml', cwd: 42 }, undefined, null]) {
    const r = await lint(options);

    assert.equal(r.exitCode, 2, String(options));
    assert.deepEqual(r.results, [], String(options));
    assert.match(r.stderr, /^Error running Spectral!\nError #1: /, String(options));
  }
});

test('validate-openapi.mjs fails the gate when any target lints at exit 1 or exit 2', async () => {
  await withTempDir(async (root) => {
    const toolDir = path.join(root, 'tools', 'contract-validation');
    const openapiDir = path.join(root, 'contracts', 'openapi');
    fs.mkdirSync(toolDir, { recursive: true });
    fs.mkdirSync(openapiDir, { recursive: true });
    fs.copyFileSync(path.join(TOOL_DIR, 'validate-openapi.mjs'), path.join(toolDir, 'validate-openapi.mjs'));
    fs.copyFileSync(RULESET, path.join(toolDir, '.spectral.yaml'));
    fs.symlinkSync(path.join(TOOL_DIR, 'vendor'), path.join(toolDir, 'vendor'));
    // Target 1 lints at exit 1 (oas3-schema error), target 2 is missing (exit 2), target 3 is a clean
    // self-contained plant (the real targets $ref files outside this temporary tree).
    plant(openapiDir, GATED_TARGETS[0], [
      'openapi: 3.1.0',
      'info:',
      '  title: Planted invalid document',
      '  version: 1.0.0',
      'paths:',
      '  /things:',
      '    get:',
      '      responses: 42',
    ]);
    plant(openapiDir, GATED_TARGETS[2], [
      'openapi: 3.1.0',
      'info:',
      '  title: Planted clean document',
      '  version: 1.0.0',
      'paths: {}',
    ]);

    const r = spawnSync(process.execPath, [path.join(toolDir, 'validate-openapi.mjs')], {
      cwd: toolDir,
      encoding: 'utf8',
    });

    assert.equal(r.status, 1, r.stderr);
    assert.equal(r.stdout.includes('OK — OpenAPI 3.1.x'), false);
    for (const [name, code] of [[GATED_TARGETS[0], 1], [GATED_TARGETS[1], 2]]) {
      assert.equal(
        r.stderr.includes(`FAIL — Spectral reported OpenAPI error(s) in ${path.join(openapiDir, name)} (exit ${code}).`),
        true,
        name,
      );
    }
    assert.equal(r.stderr.includes(`in ${path.join(openapiDir, GATED_TARGETS[2])} `), false);
    assert.equal(r.stderr.includes('FAIL — 2/3 OpenAPI document(s) reported errors.'), true);
  });
});

test('the ACCEPTED lifecycle manifest reviewer command runs the shim, without a shell, at parity', async () => {
  const manifest = JSON.parse(fs.readFileSync(LIFECYCLE_MANIFEST, 'utf8'));
  const command = manifest.verification_commands.spectral_openapi;
  const [bin, ...argv] = command.split(' ');

  assert.equal(bin, 'node_modules/.bin/spectral');
  assert.deepEqual(argv, PINNED_SHIM_ARGV);
  assert.equal([bin, ...argv].every((token) => /^[A-Za-z0-9._/-]+$/.test(token)), true);
  assert.equal(fs.realpathSync(path.join(TOOL_DIR, bin)), fs.realpathSync(SHIM_BIN));

  const reviewerRun = spawnSync(path.join(TOOL_DIR, bin), argv, { cwd: TOOL_DIR, encoding: 'utf8' });
  const inProcess = await lint({ rulesetPath: argv[2], documentPath: argv[7], cwd: TOOL_DIR });

  assert.equal(reviewerRun.status, 0, reviewerRun.stderr);
  // Colour follows each process's own stdout (a terminal here, a pipe for the child), so compare text.
  assert.equal(stripVTControlCharacters(reviewerRun.stdout), stripVTControlCharacters(inProcess.stdout));
  assert.equal(reviewerRun.stderr, '');
  assert.deepEqual(resultKeys(inProcess.results), [...SPECTRAL_CLI_BASELINE[LIFECYCLE_DOC]].sort());
});

test('the spectral shim accepts only the pinned argument vector', () => {
  assert.equal(runShim(PINNED_SHIM_ARGV).status, 0);
  const swap = (index, value) => PINNED_SHIM_ARGV.map((arg, i) => (i === index ? value : arg));
  for (const argv of [
    [],
    ['--version'],
    ['lint'],
    PINNED_SHIM_ARGV.slice(0, -1),
    [...PINNED_SHIM_ARGV, '--verbose'],
    swap(2, RULESET),
    swap(4, 'warn'),
    swap(6, 'json'),
    swap(7, `../../contracts/openapi/${GATED_TARGETS[0]}`),
  ]) {
    const r = runShim(argv);
    assert.equal(r.status, 2, JSON.stringify(argv));
    assert.equal(r.stdout, '', JSON.stringify(argv));
    assert.equal(
      r.stderr,
      `spectral-lint-compat accepts only: spectral ${PINNED_SHIM_ARGV.join(' ')}\n`,
      JSON.stringify(argv),
    );
  }
});

test('the spectral shim is golden-pinned, script-free and dependency-free, with allowlisted requires', () => {
  const files = fs
    .readdirSync(SHIM_DIR, { recursive: true })
    .filter((file) => !fs.lstatSync(path.join(SHIM_DIR, file)).isDirectory())
    .sort();
  assert.deepEqual(
    Object.fromEntries(files.map((file) => [file, sha256(path.join(SHIM_DIR, file))])),
    {
      'bin/spectral.cjs': 'fbf9c97426e0f45e93cef844bf83dd88458c094f3ec13db5f2054ea7f0d6a8c5',
      'index.cjs': '5a5650e8db02464134aa0a23ee877d9b7819e4b2ecb1f1478f4d6e57e1085268',
      'package.json': '936f202d8954cbcae40b9e8f9bea8dd831afa91c0b3227b9a5ee1b524a84da0d',
    },
  );
  assert.notEqual(fs.statSync(SHIM_BIN).mode & 0o111, 0);

  const shimManifest = JSON.parse(fs.readFileSync(path.join(SHIM_DIR, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(shimManifest), [
    'name',
    'version',
    'private',
    'description',
    'type',
    'main',
    'bin',
    'license',
    'engines',
  ]);
  assert.deepEqual(shimManifest.bin, { spectral: 'bin/spectral.cjs' });

  const requiresOf = (file) =>
    [...fs.readFileSync(path.join(SHIM_DIR, file), 'utf8').matchAll(/require\('([^']+)'\)/g)].map(
      (match) => match[1],
    );
  assert.deepEqual(requiresOf('index.cjs'), [
    'node:fs',
    'node:path',
    'node:util',
    '@stoplight/spectral-core',
    '@stoplight/spectral-formatters',
    '@stoplight/spectral-parsers',
    '@stoplight/spectral-rulesets',
    'yaml',
  ]);
  assert.deepEqual(requiresOf('bin/spectral.cjs'), ['node:util', '../index.cjs']);
});

test('the lock drops spectral-cli and its glob chain and links only the two vendored shims', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(TOOL_DIR, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(TOOL_DIR, 'package-lock.json'), 'utf8'));
  const spectralPins = {
    '@stoplight/spectral-core': '1.23.1',
    '@stoplight/spectral-formatters': '1.5.1',
    '@stoplight/spectral-parsers': '1.0.5',
    '@stoplight/spectral-rulesets': '1.22.6',
  };

  assert.deepEqual(manifest.overrides, { 'brace-expansion': '$brace-expansion' });
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  for (const [name, version] of Object.entries(spectralPins)) {
    assert.equal(manifest.dependencies[name], version, name);
    assert.equal(lock.packages[`node_modules/${name}`].version, version, name);
  }

  const entries = Object.entries(lock.packages).filter(([location]) => location !== '');
  const packageName = (location) => {
    const index = location.lastIndexOf('node_modules/');
    return index < 0 ? location : location.slice(index + 'node_modules/'.length);
  };
  const removed = new Set([
    '@stoplight/spectral-cli',
    '@stoplight/spectral-ruleset-bundler',
    '@stoplight/spectral-ruleset-migrator',
    '@rollup/plugin-commonjs',
    '@rollup/pluginutils',
    'braces',
    'fast-glob',
    'fill-range',
    'fsevents',
    'glob',
    'micromatch',
    'picomatch',
    'rollup',
    'to-regex-range',
  ]);
  assert.deepEqual(
    entries.filter(([location]) => removed.has(packageName(location))).map(([location]) => location),
    [],
  );

  const nonRegistry = entries.filter(
    ([, entry]) => !String(entry.resolved).startsWith('https://registry.npmjs.org/'),
  );
  assert.deepEqual(Object.fromEntries(nonRegistry), {
    'node_modules/brace-expansion': { resolved: 'vendor/brace-expansion-compat', link: true },
    'node_modules/spectral-lint-compat': { resolved: 'vendor/spectral-lint-compat', link: true },
    'vendor/brace-expansion-compat': {
      name: 'brace-expansion',
      version: '5.0.12-cybrik.1',
      license: 'MIT',
      dependencies: { 'brace-expansion-v5': 'npm:brace-expansion@5.0.12' },
      engines: { node: '20 || >=22' },
    },
    'vendor/spectral-lint-compat': {
      version: '1.0.0-cybrik.1',
      license: 'UNLICENSED',
      bin: { spectral: 'bin/spectral.cjs' },
      engines: { node: '20 || >=22' },
    },
  });
  const nonRegistryLocations = new Set(nonRegistry.map(([location]) => location));
  const registry = entries.filter(([location]) => !nonRegistryLocations.has(location));
  for (const [location, entry] of registry) {
    assert.match(entry.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/, location);
  }
  // A-1: the registry entries are exactly #94's (lock 6c748a6d) minus the 67 the drop made unreachable,
  // every field unchanged. Any added, removed or altered registry entry changes this digest.
  const registryDigest = createHash('sha256')
    .update(registry.map(([location, entry]) => `${location} ${JSON.stringify(entry)}`).sort().join('\n'))
    .digest('hex');
  assert.deepEqual([registry.length, registryDigest], [198, 'e87687cbfdc3cbd4263cb2332dc243dbb9495c603f88a5cf8cf008a0128c7eb7']);
});
