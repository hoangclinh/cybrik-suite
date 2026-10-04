#!/usr/bin/env node
'use strict';

// Reviewer-command shim. The ACCEPTED investigation-lifecycle manifest pins the command
//   node_modules/.bin/spectral lint --ruleset .spectral.yaml --fail-severity error --format stylish
//     ../../contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml
// run from tools/contract-validation. This bin accepts exactly that argument vector and runs the
// same in-process lint as validate-openapi.mjs; any other vector exits 2.

const { isDeepStrictEqual } = require('node:util');
const { lint } = require('../index.cjs');

const PINNED_ARGV = Object.freeze([
  'lint',
  '--ruleset',
  '.spectral.yaml',
  '--fail-severity',
  'error',
  '--format',
  'stylish',
  '../../contracts/openapi/cybrik-ai-investigation-lifecycle-proposal.v1.openapi.yaml',
]);

async function main(argv) {
  if (!isDeepStrictEqual(argv, PINNED_ARGV)) {
    process.stderr.write(`spectral-lint-compat accepts only: spectral ${PINNED_ARGV.join(' ')}\n`);
    return 2;
  }
  const { exitCode, stdout, stderr } = await lint({ rulesetPath: PINNED_ARGV[2], documentPath: PINNED_ARGV[7] });
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return exitCode;
}

main(process.argv.slice(2)).then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error) => {
    process.stderr.write(`spectral-lint-compat failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  },
);
