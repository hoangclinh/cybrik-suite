'use strict';

// In-process `spectral lint` for this toolchain's one invocation shape. It replaces
// @stoplight/spectral-cli 6.16.2 (whose glob and bundler dependencies carried the braces advisory)
// and mirrors that CLI's lint path for one local file: the migrated `spectral:oas` ruleset at
// 'recommended' severity with the CLI's ruleset source, spectral-core's default resolver (the CLI's
// default too), the YAML parser, the stylish formatter without documentation URLs, and the CLI's
// exit codes: 0 when nothing reaches the fail severity, 1 when something does, 2 for usage and
// runtime errors. It fails closed: any ruleset other than `extends: ["spectral:oas"]`, any target
// that is not an existing local file named without glob or URL syntax, and every exception exit 2.
// The path allowlist applies to the resolved absolute path, so the checkout itself must sit under a
// path made of A-Z a-z 0-9 space . _ / - (CI's /home/runner/work/... does).
//
// The Spectral libraries and yaml resolve from the root manifest, which pins them exactly; this
// package declares no dependencies and has no lifecycle scripts.

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { Document, Ruleset, Spectral, getDiagnosticSeverity } = require('@stoplight/spectral-core');
const { stylish } = require('@stoplight/spectral-formatters');
const Parsers = require('@stoplight/spectral-parsers');
const { oas } = require('@stoplight/spectral-rulesets');
const YAML = require('yaml');

const FAIL_SEVERITY = 'error';
const SUPPORTED_RULESET = { extends: ['spectral:oas'] };
// An absolute POSIX path built only from these characters carries no glob, URL or shell syntax.
const SAFE_ABSOLUTE_PATH = /^\/[A-Za-z0-9 ._/-]*$/;
const NO_FILES_MESSAGE = 'No files found to lint. Please check your file path and extension and try again';

class UsageError extends Error {}

function resolveLocalFile(cwd, candidate, kind) {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new UsageError(`A ${kind} path is required.`);
  }
  const absolute = path.resolve(cwd, candidate);
  if (!SAFE_ABSOLUTE_PATH.test(absolute)) {
    throw new UsageError(
      `Unsupported ${kind} path ${JSON.stringify(candidate)}: the absolute path may use only A-Z a-z 0-9 space . _ / - (no glob, URL or shell syntax).`,
    );
  }
  const stats = fs.statSync(absolute, { throwIfNoEntry: false });
  if (stats === undefined || !stats.isFile()) {
    throw new UsageError(kind === 'ruleset' ? `Could not read ruleset at ${absolute}.` : NO_FILES_MESSAGE);
  }
  return absolute;
}

function loadRuleset(rulesetPath) {
  const definition = YAML.parse(fs.readFileSync(rulesetPath, 'utf8'));
  if (!isDeepStrictEqual(definition, SUPPORTED_RULESET)) {
    throw new UsageError(`Unsupported ruleset at ${rulesetPath}: only extends ["spectral:oas"] is accepted.`);
  }
  // The CLI migrates a YAML ruleset to `{ extends: [oas] }` and records it as .spectral.js beside it.
  return new Ruleset(
    { extends: [oas] },
    { severity: 'recommended', source: path.join(path.dirname(rulesetPath), '.spectral.js') },
  );
}

function exitCodeFor(results) {
  const failSeverity = getDiagnosticSeverity(FAIL_SEVERITY);
  return results.some((result) => result.severity <= failSeverity) ? 1 : 0;
}

function stdoutFor(results) {
  if (results.length === 0) {
    return `No results with a severity of '${FAIL_SEVERITY}' found!\n`;
  }
  return stylish(results, { failSeverity: getDiagnosticSeverity(FAIL_SEVERITY) });
}

function stderrFor(error) {
  if (error instanceof UsageError) {
    return `${error.message}\n`;
  }
  const errors = Array.isArray(error?.errors) ? error.errors : [error];
  const lines = errors.map((entry, index) => {
    const actual = entry instanceof Error && 'cause' in entry ? entry.cause : entry;
    return `Error #${index + 1}: ${actual instanceof Error ? actual.message : String(actual)}\n`;
  });
  return `Error running Spectral!\n${lines.join('')}`;
}

// Lints one document. Never rejects: every failure is returned as exit code 2 with a message.
async function lint(options) {
  try {
    const { rulesetPath, documentPath, cwd = process.cwd() } = options;
    const ruleset = loadRuleset(resolveLocalFile(cwd, rulesetPath, 'ruleset'));
    const source = resolveLocalFile(cwd, documentPath, 'document');
    const spectral = new Spectral();
    spectral.setRuleset(ruleset);
    const document = new Document(fs.readFileSync(source, 'utf8'), Parsers.Yaml, source);
    const results = (await spectral.run(document, { ignoreUnknownFormat: false }))
      .map((result) => ({ ...result, documentationUrl: undefined }));
    return { exitCode: exitCodeFor(results), stdout: stdoutFor(results), stderr: '', results };
  } catch (error) {
    return { exitCode: 2, stdout: '', stderr: stderrFor(error), results: [] };
  }
}

exports.lint = lint;
