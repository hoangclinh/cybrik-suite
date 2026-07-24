// validate-asyncapi.mjs — AsyncAPI 3.0.0 validation via the official @asyncapi/parser.
// Fails on any diagnostic of ERROR severity (0). Warnings are printed but non-fatal.

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { Parser, fromFile } from '@asyncapi/parser';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const target = join(ROOT, 'contracts', 'asyncapi', 'cybrik-suite-events.v1.asyncapi.yaml');

console.log('=== AsyncAPI 3.0.0 validation (@asyncapi/parser) ===');
const parser = new Parser();
const { document, diagnostics } = await fromFile(parser, target).parse();

const bySeverity = { 0: [], 1: [], 2: [], 3: [] };
for (const d of diagnostics || []) (bySeverity[d.severity] ||= []).push(d);
const errs = bySeverity[0] || [];
const warns = bySeverity[1] || [];

for (const d of errs) console.error(`  ERROR  ${d.message} @ ${(d.path || []).join('.')}`);
for (const d of warns) console.log(`  warn   ${d.message} @ ${(d.path || []).join('.')}`);

if (!document) { console.error('\nFAIL — parser produced no document (invalid AsyncAPI).'); process.exit(1); }
if (errs.length) { console.error(`\nFAIL — ${errs.length} AsyncAPI error diagnostic(s).`); process.exit(1); }
console.log(`OK — AsyncAPI 3.0.0 valid (version=${document.version?.() ?? 'unknown'}, ${warns.length} warning(s), 0 errors).`);
