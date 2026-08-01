// validate-transport.test.mjs — citation/integrity/ownership tests for the W2-I transport-binding
// PROPOSED SUCCESSOR of the ACCEPTED W2-D inference OpenAPI member.
//
// LIFECYCLE (never asserted away by these tests): W2-D is the SOLE CURRENT owner of the four
// inference operations; the W2-I successor is PROPOSED — NOT ACCEPTED; Gate W2-I is NOT OPENED.
// Founder Option A (FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md, 2026-07-26) forbids a second
// independent path owner, so the transport binding enters ONLY as a delta-linked proposed
// successor revision of the W2-D OpenAPI member.
//
// Families:
//   1. zero unresolved ADR reference — every ADR-nnnn cited by the candidate resolves to a real
//      docs/adr record;
//   2. zero wrong-subject citation — every seam citation names the accepted W2-F service-delegation
//      profile ADR-0008; the candidate ADR-0011 is never a seam and never appears in member files;
//   3. D-item resolution — every "(ADR-nnnn Dn)" / "G-W2D-n" / "packet invariant TT-n" citation
//      resolves to a decision item or invariant that verifiably exists in its source document;
//   4. reserved-number exclusion — the ADR number reserved for the W0-I07B capability-name
//      canonicalization record never appears inside the candidate paths;
//   5. digest re-pinning — every delta-pinned SHA-256 (candidate members, examples manifest and the
//      UPSTREAM accepted W2-D bytes) matches the on-disk bytes;
//   6. lifecycle-aware path ownership — exactly one CURRENT owner per (method, path) pair across
//      EVERY OpenAPI document, at most one PROPOSED successor and only when delta-linked, no early
//      status flip, and neither retired second-plane draft nor rogue transport manifest on disk;
//   7. successor equivalence — same pair set, operationIds, request bodies, parameters, 200
//      bindings and status floor as the byte-frozen predecessor, with the POST 422/503 oneOf
//      proven to accept BOTH error shapes and proven disjoint;
//   8. mutation/behaviour proofs — families 1-7 read bytes; family 8 EXECUTES the validator against
//      a disposable packet copy and asserts it actually rejects the mutation. Data mutations run
//      IN-PROCESS (so `node --test --experimental-test-coverage` instruments the validator);
//      validator-SOURCE mutations are spawned, because a module cannot rewrite its own imported
//      source.
//
// Family 8 preserves the three earlier repairs (TX-8 non-vacuity, the TT-4 structural conditional,
// support-fixture digest integrity) and adds ownership, early-half-flip, response-binding,
// operationId-rename, pin-drift, health-coverage, token-drift and unreachable-validator proofs.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

import { formatValidationReport, isMainModule, runValidation } from '../validate-transport.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)); // tools/contract-validation/tests
const ROOT = join(HERE, '..', '..', '..');
const CONTRACTS = join(ROOT, 'contracts');
const ADR_DIR = join(ROOT, 'docs', 'adr');

const SUCCESSOR_REL = 'contracts/openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml';
const PREDECESSOR_REL = 'contracts/openapi/cybrik-ai-inference-plane.v1.openapi.yaml';
const DELTA_REL = 'contracts/compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json';
const W2D_MANIFEST_REL = 'contracts/compatibility/cybrik-suite-inference-packet.v1.manifest.json';

// Paths the arbitrated Option A decision RETIRES. Their continued presence would re-create the
// second-independent-owner shape the Founder rejected.
const FORBIDDEN_RELS = [
  'contracts/openapi/cybrik-ai-inference-transport-plane.v1.openapi.yaml',
  'contracts/compatibility/cybrik-suite-inference-transport-packet.v1.manifest.json',
];

// The candidate-owned content paths (repo-root-relative).
const CONTENT_PATHS = [
  SUCCESSOR_REL,
  'contracts/json-schema/cybrik.transport-common-defs.v1.schema.json',
  'contracts/json-schema/cybrik.inference-transport-binding.v1.schema.json',
  'contracts/json-schema/cybrik.transport-authorization-error.v1.schema.json',
  'contracts/examples/transport/examples-manifest.json',
  DELTA_REL,
  'tools/contract-validation/validate-transport.mjs',
];
const PACKET_PATHS = [...CONTENT_PATHS, 'tools/contract-validation/tests/validate-transport.test.mjs'];

// Member files that must identify the seam only by ADR reference — never carry the candidate id.
// (Everything except the delta, which is the single declaration site for the candidate ADR.)
const MEMBER_PATHS = CONTENT_PATHS.filter((p) => p !== DELTA_REL && !p.startsWith('tools/'));

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const sha256File = (abs) => sha256(readFileSync(abs));
const countOf = (text, needle) => text.split(needle).length - 1;

const texts = new Map(PACKET_PATHS.map((p) => [p, read(p)]));
const delta = JSON.parse(texts.get(DELTA_REL));
const examplesManifestText = texts.get('contracts/examples/transport/examples-manifest.json');
const transportCommonText = texts.get('contracts/json-schema/cybrik.transport-common-defs.v1.schema.json');
const validatorText = texts.get('tools/contract-validation/validate-transport.mjs');
const successorText = texts.get(SUCCESSOR_REL);
const predecessorText = read(PREDECESSOR_REL);
const successor = YAML.parse(successorText);
const predecessor = YAML.parse(predecessorText);

// The ADR number reserved for the W0-I07B capability-name canonicalization record. Built by
// concatenation so this test file itself stays free of the excluded token (family 4 scans it too).
const RESERVED_ADR = ['ADR', '0010'].join('-');
const CANDIDATE_ADR = 'ADR-0011';
const SEAM_ADR = 'ADR-0008';

const adrRecordFiles = readdirSync(ADR_DIR).filter((f) => /^ADR-\d{4}-.*\.md$/.test(f));
const adrRecordExists = (id) => adrRecordFiles.some((f) => f.startsWith(`${id}-`));
const adrRecordText = (id) => {
  const f = adrRecordFiles.find((x) => x.startsWith(`${id}-`));
  return f ? readFileSync(join(ADR_DIR, f), 'utf8') : '';
};

const candidateEntry = (delta.adr_basis || []).find((x) => x.id === CANDIDATE_ADR);

// --- ADR section extraction -------------------------------------------------
//
// Heading-bounded extraction of ONE level-2 markdown section. Three properties make it robust
// enough to assert against:
//   - the opening heading is matched EXACTLY ('## Decision'), so the unrelated '## Decision history'
//     record at the end of the ADR is a different section and never bleeds in;
//   - the section ends at the next level-2 heading, and '###' sub-headings are NOT terminators, so
//     the whole Selected-option / lifecycle / what-it-adds body stays inside the Decision;
//   - lines inside a fenced code block are never read as headings.
// Returns null when the heading does not exist, so a caller can fail closed instead of silently
// asserting over an empty string.
const mdSection = (md, title) => {
  const lines = md.split('\n');
  let fenced = false;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    if (start < 0) {
      if (line.trimEnd() === `## ${title}`) start = i;
      continue;
    }
    if (/^##(?!#)\s+\S/.test(line)) { end = i; break; }
  }
  return start < 0 ? null : lines.slice(start + 1, end).join('\n');
};

// Blank-line-delimited blocks of `text` that mention `needle`. A paragraph is the unit of context:
// it is what carries the sentence that frames the mention.
const paragraphsMentioning = (text, needle) => text.split(/\n[ \t]*\n/).filter((p) => p.includes(needle));

// A mention framed as absence/withdrawal/rejection — the ONLY frame in which a retired artifact path
// may appear in the ADR.
const WITHDRAWN_FRAME = /\b(absent|absence|withdrawn|withdraw|withdrawal|retired|retire|rejected|reject|not\s+selected|never|no\s+longer|must\s+not|forbidden|would\s+have\s+required|does\s+not\s+exist|do\s+not\s+exist|none\s+exists)\b/i;
// A mention framed as the adopted shape. Any overlap with a retired artifact path is the P0 defect.
const SELECTION_FRAME = /\bselected\s+(?:option|shape)\b|\b(?:is|are)\s+(?:explicitly\s+)?\*{0,2}the\s+selected\b|\bthe\s+suite\s+adopts\b|\benters\s+as\b|\bpublished\s+at\b|\bthis\s+ADR\s+(?:selects|adopts)\b/i;

// ---------------------------------------------------------------------------
// 1. Zero unresolved ADR reference.
// ---------------------------------------------------------------------------
test('every ADR reference in the candidate resolves to a real docs/adr record', () => {
  for (const [path, text] of texts) {
    for (const id of text.match(/ADR-\d{4}/g) || []) {
      assert.ok(adrRecordExists(id), `${path}: unresolved ADR reference '${id}' — no docs/adr record exists`);
    }
  }
});

test('the candidate transport-binding ADR is declared as ADR-0011, authored but NOT DECIDED', () => {
  assert.ok(candidateEntry, `the delta adr_basis must declare the candidate ${CANDIDATE_ADR}`);
  assert.equal(candidateEntry.status, 'PROPOSED — NOT DECIDED — NOT APPLIED');
  assert.match(candidateEntry.role, /^Candidate inference-plane transport-binding profile evaluated by Gate W2-I\./);
  assert.ok(adrRecordExists(CANDIDATE_ADR), `${CANDIDATE_ADR} must now be authored as a real docs/adr record`);
  const rec = adrRecordText(CANDIDATE_ADR);
  assert.match(rec, /PROPOSED — NOT DECIDED/, 'the ADR-0011 record must carry a PROPOSED — NOT DECIDED status');

  // The claim under test is about the DECISION, so it is asserted against the Decision section and
  // nothing else. A whole-record doesNotMatch over the retired path was the wrong instrument: the
  // ADR truthfully names the two withdrawn artifacts in order to assert that they are ABSENT, and a
  // record-wide ban would have forced that honest absence assertion out of the document to go green.
  const decision = mdSection(rec, 'Decision');
  assert.ok(decision !== null, 'the ADR-0011 record must carry a level-2 "## Decision" section');

  // Non-vacuity of the extraction, four ways: it is substantial, it really is bounded (strictly
  // smaller than the record), it kept its own sub-headings, and it did not swallow the sections that
  // follow it — otherwise "the Decision does not select X" could pass over an empty string.
  assert.ok(decision.trim().length > 500, `the extracted Decision section is too small to be the real one (${decision.trim().length} chars)`);
  assert.ok(decision.length < rec.length, 'the Decision extraction is not bounded — it is the whole record');
  assert.match(decision, /^### Selected option/m, 'the extracted Decision must contain its "Selected option" sub-heading');
  for (const later of ['## Alternatives considered', '## Consequences', '## Decision history']) {
    assert.ok(!decision.includes(later), `the Decision extraction leaked into '${later}' — the section bound is wrong`);
  }

  // POSITIVE: the Decision SELECTS the W2-D-owned successor revision.
  assert.match(decision, /cybrik-ai-inference-plane\.v1\.contract-0\.2\.0\.openapi\.yaml/, 'the ADR-0011 Decision must name the W2-D successor OpenAPI revision');
  assert.match(decision, SELECTION_FRAME, 'the ADR-0011 Decision must actually state a selection, or there is nothing to check the retired shape against');

  // NEGATIVE: it does not select or describe the retired independent second-plane shape. Every
  // paragraph of the Decision that names a withdrawn artifact must frame it as absent/withdrawn/
  // rejected and must NOT read as a selection; and no paragraph that states a selection may name a
  // withdrawn artifact at all.
  for (const rel of FORBIDDEN_RELS) {
    for (const para of paragraphsMentioning(decision, rel)) {
      assert.match(para, WITHDRAWN_FRAME, `the ADR-0011 Decision names '${rel}' outside an absence/withdrawal frame:\n${para}`);
      assert.doesNotMatch(para, SELECTION_FRAME, `the ADR-0011 Decision describes '${rel}' as a selected shape:\n${para}`);
    }
  }
  for (const para of decision.split(/\n[ \t]*\n/).filter((p) => SELECTION_FRAME.test(p))) {
    for (const rel of FORBIDDEN_RELS) {
      assert.ok(!para.includes(rel), `the ADR-0011 Decision selects the retired second-plane artifact '${rel}':\n${para}`);
    }
  }
});

test('the ADR-0011 record names the withdrawn second-plane artifacts ONLY as absent/withdrawn', () => {
  const rec = adrRecordText(CANDIDATE_ADR);
  assert.ok(rec.length > 0, `${CANDIDATE_ADR} must be a real docs/adr record`);

  // The guard stays STRONG rather than merely permissive: the withdrawn artifacts must be named at
  // least once — that mention is what makes Option A's "and none exists" claim auditable — and every
  // mention, anywhere in the record (Context, Decision, Alternatives, Consequences alike), must sit
  // in a paragraph that frames it as absent/withdrawn/retired/rejected and never as an adopted one.
  let mentions = 0;
  for (const rel of FORBIDDEN_RELS) {
    const paras = paragraphsMentioning(rec, rel);
    assert.ok(
      paras.length > 0,
      `${CANDIDATE_ADR} must name the withdrawn artifact '${rel}' to assert its absence — dropping the mention would make the Option A absence claim unauditable`,
    );
    for (const para of paras) {
      mentions += 1;
      assert.match(para, WITHDRAWN_FRAME, `${CANDIDATE_ADR} mentions '${rel}' outside an absence/withdrawal frame:\n${para}`);
      assert.doesNotMatch(para, SELECTION_FRAME, `${CANDIDATE_ADR} mentions '${rel}' in a selection frame:\n${para}`);
    }
  }
  assert.ok(mentions >= FORBIDDEN_RELS.length, `every withdrawn artifact must be accounted for (saw ${mentions} framed mentions)`);

  // And the on-disk absence the ADR asserts is real — the prose claim and the filesystem agree.
  for (const rel of FORBIDDEN_RELS) {
    assert.ok(!existsSync(join(ROOT, rel)), `${rel} is asserted ABSENT by ${CANDIDATE_ADR} but exists on disk`);
  }
});

// ---------------------------------------------------------------------------
// 2. Zero wrong-subject citation.
// ---------------------------------------------------------------------------
test('every seam citation names the accepted W2-F service-delegation profile ADR-0008', () => {
  for (const [path, text] of texts) {
    for (const m of text.match(/seam \(ADR-\d{4}\)/g) || []) {
      assert.equal(m, `seam (${SEAM_ADR})`, `${path}: seam citation '${m}' does not name the W2-F seam profile ${SEAM_ADR}`);
    }
  }
  const seamTotal = CONTENT_PATHS.reduce((n, p) => n + countOf(texts.get(p), `seam (${SEAM_ADR})`), 0);
  assert.equal(seamTotal, 5, `expected exactly 5 short-form 'seam (${SEAM_ADR})' citations across the candidate content files (got ${seamTotal})`);
  assert.equal(
    countOf(transportCommonText, `seam (ADR-0006 E2/E3; ${SEAM_ADR}).`),
    1,
    'transport-common-defs must cite the seam list-form as (ADR-0006 E2/E3; ADR-0008) with no third number',
  );
});

test('adr_basis attributes the seam to ADR-0008 and the candidate role only to ADR-0011', () => {
  const basis = delta.adr_basis || [];
  const seamEntry = basis.find((x) => x.id === SEAM_ADR);
  assert.ok(seamEntry, `adr_basis must include the accepted seam profile ${SEAM_ADR}`);
  assert.equal(seamEntry.status, 'ACCEPTED FOR IMPLEMENTATION');
  assert.match(seamEntry.role, /service-delegation|workload-identity/i);
  const candidateRoles = basis.filter((x) => /transport-binding profile/i.test(x.role || ''));
  assert.deepEqual(candidateRoles.map((x) => x.id), [CANDIDATE_ADR], 'exactly one adr_basis entry may carry the candidate transport-binding role, and it must be ADR-0011');
});

test('member files and the examples manifest never carry the candidate ADR id', () => {
  for (const path of MEMBER_PATHS) {
    assert.equal(
      countOf(texts.get(path), CANDIDATE_ADR),
      0,
      `${path}: member files cite the seam (${SEAM_ADR}); only the delta identifies the candidate ${CANDIDATE_ADR}`,
    );
  }
});

// ---------------------------------------------------------------------------
// 3. D-item / gate-decision / packet-invariant resolution.
// ---------------------------------------------------------------------------
test('every (ADR-nnnn Dn) citation resolves to a decision item that exists in that ADR', () => {
  for (const [path, text] of texts) {
    for (const [, id, n] of text.matchAll(/(ADR-\d{4}) D(\d+)/g)) {
      assert.ok(adrRecordExists(id), `${path}: '${id} D${n}' cites a decision item of a nonexistent ADR record`);
      assert.match(
        adrRecordText(id),
        new RegExp(`(###|\\*\\*)\\s*D${n} —`),
        `${path}: '${id} D${n}' does not resolve — ${id} defines no decision item D${n}`,
      );
    }
  }
});

test('every G-W2D-n citation resolves to a recorded Gate W2-D decision', () => {
  const inferenceManifest = JSON.parse(read(W2D_MANIFEST_REL));
  const decided = inferenceManifest.gate?.decisions_resolved || [];
  for (const [path, text] of texts) {
    for (const [g] of text.matchAll(/G-W2D-\d+/g)) {
      assert.ok(
        decided.some((d) => d.startsWith(`${g} ACCEPTED`)),
        `${path}: '${g}' is not a recorded, accepted Gate W2-D decision`,
      );
    }
  }
});

test('every G-W2I-n citation resolves to a recorded Founder path-ownership answer', () => {
  const packetText = readFileSync(join(ADR_DIR, 'FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md'), 'utf8');
  for (const [path, text] of texts) {
    for (const [g] of text.matchAll(/G-W2I-\d+/g)) {
      assert.ok(packetText.includes(g), `${path}: '${g}' is not a recorded Founder gate answer in the W2-I path-ownership decision packet`);
    }
  }
});

test('every packet-invariant citation resolves to a structural TT invariant this candidate owns', () => {
  const structural = delta.trust_invariants?.structural || [];
  for (const [path, text] of texts) {
    for (const [, n] of text.matchAll(/packet invariant TT-(\d+)/g)) {
      assert.ok(
        structural.some((s) => s.startsWith(`TT-${n} `)),
        `${path}: 'packet invariant TT-${n}' does not resolve to a structural trust invariant of this candidate`,
      );
    }
  }
});

test('the corrected D-item resolutions are present at their citation sites', () => {
  assert.equal(countOf(transportCommonText, 'versioned REST/JSON is the compatibility authority (packet invariant TT-1)'), 1);
  assert.equal(countOf(transportCommonText, `audited under a decision_id (${SEAM_ADR} D3; packet invariant TT-9)`), 1);
  assert.equal(countOf(examplesManifestText, `structurally inexpressible on this seam (${SEAM_ADR} D1).`), 1);
  assert.equal(countOf(examplesManifestText, `grants no model/vendor/tool/agent authority (${SEAM_ADR} D4; W2-D G-W2D-1).`), 1);
  assert.equal(countOf(validatorText, `structurally inexpressible (${SEAM_ADR} D1).`), 1);
  assert.equal(countOf(successorText, 'Format pin: OpenAPI 3.1.x (ADR-0001 D4)'), 1);
});

// ---------------------------------------------------------------------------
// 4. Reserved-number residual exclusion inside the candidate paths.
// ---------------------------------------------------------------------------
test('the reserved capability-name canonicalization ADR number never appears in the candidate', () => {
  for (const [path, text] of texts) {
    assert.equal(
      countOf(text, RESERVED_ADR),
      0,
      `${path}: residual '${RESERVED_ADR}' — that number is reserved for the W0-I07B capability-name canonicalization record and must not be cited by this candidate`,
    );
  }
});

// ---------------------------------------------------------------------------
// 5. Digest re-pinning: candidate members, examples manifest and UPSTREAM accepted bytes.
// ---------------------------------------------------------------------------
test('the delta is NOT a manifest and says so in machine-readable form', () => {
  assert.ok(!DELTA_REL.endsWith('.manifest.json'), 'the delta filename must not end in .manifest.json');
  assert.equal(delta['x-cybrik-is-manifest'], false, 'the delta must self-deny manifest status');
  assert.equal(delta['x-cybrik-artifact-kind'], 'proposed-delta');
  assert.match(String(delta['x-cybrik-manifest-self-denial']), /NOT a compatibility manifest/);
  assert.equal(delta['x-cybrik-applied'], false, 'the delta must record that it is NOT applied');
  assert.match(String(delta['x-cybrik-applies-at']), /future Gate W2-I status flip/);
});

test('every delta candidate-member sha256 matches its on-disk bytes', () => {
  const members = delta.candidate_members || [];
  assert.equal(members.length, 4, 'the delta pins exactly four candidate member digests (3 schemas + the successor OpenAPI)');
  for (const m of members) {
    assert.equal(sha256File(join(CONTRACTS, m.file)), m.sha256, `candidate member ${m.file}: pinned sha256 is stale — re-pin after any edit`);
    assert.equal(m.status, 'PROPOSED', `candidate member ${m.file} must stay PROPOSED`);
  }
});

test('the delta pins the UPSTREAM accepted W2-D manifest and OpenAPI bytes exactly', () => {
  const pins = delta.upstream_pins?.accepted || [];
  assert.equal(pins.length, 2, 'the delta pins exactly the accepted W2-D packet manifest and the accepted W2-D OpenAPI predecessor');
  const byFile = Object.fromEntries(pins.map((p) => [p.file, p]));
  assert.equal(byFile['compatibility/cybrik-suite-inference-packet.v1.manifest.json']?.sha256, sha256File(join(ROOT, W2D_MANIFEST_REL)));
  assert.equal(byFile['openapi/cybrik-ai-inference-plane.v1.openapi.yaml']?.sha256, sha256File(join(ROOT, PREDECESSOR_REL)));
});

test('the accepted W2-D predecessor and manifest show zero diff against HEAD', () => {
  for (const rel of [PREDECESSOR_REL, W2D_MANIFEST_REL]) {
    const r = spawnSync('git', ['diff', '--exit-code', '--', rel], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `${rel}: accepted W2-D bytes must be unchanged (G-W2I-4)\n${r.stdout}`);
    const staged = spawnSync('git', ['diff', '--cached', '--exit-code', '--', rel], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(staged.status, 0, `${rel}: accepted W2-D bytes must be unchanged in the index too\n${staged.stdout}`);
  }
});

test('the examples manifest is digest-pinned and the pin matches its on-disk bytes', () => {
  const pin = delta.examples_manifest_sha256;
  assert.match(String(pin), /^[0-9a-f]{64}$/, 'the delta must pin examples_manifest_sha256 (64-hex)');
  const emBytes = readFileSync(join(CONTRACTS, delta.examples_manifest));
  assert.equal(sha256(emBytes), pin, 'examples_manifest_sha256 is stale — re-pin after any examples-manifest change');
  assert.notEqual(sha256(Buffer.concat([emBytes, Buffer.from('\n')])), pin, 'a changed examples manifest must no longer match the pinned digest');
});

test('the conformance validator enforces the examples-manifest and upstream digest pins', () => {
  assert.ok(validatorText.includes('examples_manifest_sha256'), 'validate-transport.mjs must verify examples_manifest_sha256');
  assert.ok(validatorText.includes('upstream_pins'), 'validate-transport.mjs must verify the upstream accepted-byte pins');
});

// ---------------------------------------------------------------------------
// 6. Lifecycle-aware path ownership (Founder Option A).
// ---------------------------------------------------------------------------
test('the retired second-plane draft and the rogue transport manifest are gone from disk', () => {
  for (const rel of FORBIDDEN_RELS) {
    assert.equal(existsSync(join(ROOT, rel)), false, `${rel} must not exist — Option A forbids a second independent path owner / a separate transport manifest`);
  }
});

test('exactly one CURRENT owner and at most one delta-linked PROPOSED successor per (method, path)', () => {
  const dir = join(CONTRACTS, 'openapi');
  const owners = new Map();
  for (const f of readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
    const doc = YAML.parse(readFileSync(join(dir, f), 'utf8'));
    const status = doc.info?.['x-cybrik-status'];
    const role = doc.info?.['x-cybrik-lifecycle-role'] || (status === 'ACCEPTED FOR IMPLEMENTATION' ? 'CURRENT' : 'PROPOSED-SUCCESSOR');
    for (const [p, item] of Object.entries(doc.paths || {})) {
      for (const method of Object.keys(item)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        const key = `${method.toUpperCase()} ${p}`;
        if (!owners.has(key)) owners.set(key, { CURRENT: [], 'PROPOSED-SUCCESSOR': [] });
        owners.get(key)[role].push(f);
      }
    }
  }
  for (const [key, o] of owners) {
    assert.equal(o.CURRENT.length, 1, `${key}: expected exactly one CURRENT owner, got ${JSON.stringify(o.CURRENT)}`);
    assert.ok(o['PROPOSED-SUCCESSOR'].length <= 1, `${key}: at most one PROPOSED successor is permitted, got ${JSON.stringify(o['PROPOSED-SUCCESSOR'])}`);
    for (const s of o['PROPOSED-SUCCESSOR']) {
      assert.equal(`openapi/${s}`, delta.ownership?.proposed_successor?.file, `${key}: PROPOSED successor '${s}' is not the delta-linked successor`);
      assert.equal(`openapi/${o.CURRENT[0]}`, delta.ownership?.current_owner?.file, `${key}: the CURRENT owner is not the delta-linked predecessor`);
    }
  }
  const four = ['GET /api/v1/model-classes', 'GET /api/v1/model-classes/{model_class}/health', 'POST /api/v1/inferences', 'POST /api/v1/summarizations'];
  for (const k of four) {
    assert.equal(owners.get(k)['PROPOSED-SUCCESSOR'].length, 1, `${k}: the four inference pairs each carry exactly one PROPOSED successor`);
  }
});

test('the successor declares its delta link and stays PROPOSED — NOT ACCEPTED', () => {
  assert.equal(successor.openapi, '3.1.1');
  assert.equal(successor.info.version, '0.2.0');
  assert.equal(successor.info['x-cybrik-status'], 'PROPOSED');
  assert.equal(successor.info['x-cybrik-not-accepted'], true);
  assert.equal(successor.info['x-cybrik-lifecycle-role'], 'PROPOSED-SUCCESSOR');
  assert.equal(successor.info['x-cybrik-supersedes'], 'cybrik-ai-inference-plane.v1.openapi.yaml');
  assert.equal(successor.info['x-cybrik-delta-ref'], '../compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json');
  assert.ok(!('servers' in successor), 'the successor must declare no servers block');
  assert.equal(predecessor.info['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION', 'the predecessor stays the CURRENT accepted owner');
});

test('the delta records the resolved path-ownership decision and cites the Founder packet', () => {
  const open = JSON.stringify(delta.gate?.open_items || []);
  assert.doesNotMatch(open, /Resolve path ownership/i, 'the stale path-ownership open item must be resolved, not still open');
  const resolved = JSON.stringify(delta.gate?.resolved_items || []);
  assert.match(resolved, /path ownership/i, 'path ownership must be recorded as RESOLVED');
  assert.match(resolved, /G-W2I-1/, 'the resolution must cite the recorded Founder gate answers');
  assert.equal(delta.founder_decision?.option, 'A — Single-owner compatible revision');
  assert.equal(delta.founder_decision?.decided_by, 'Founder');
  assert.equal(delta.founder_decision?.decided_on, '2026-07-26');
  assert.match(String(delta.founder_decision?.packet), /FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP\.md$/);
  assert.match(delta.gate?.status || '', /NOT OPENED/);
  assert.match(delta.acceptance?.status || '', /NOT ACCEPTED/);
});

// The in-scope copy of the Founder path-ownership arbitration, and the exact full digest of the
// bytes this candidate was built against. The witness below is CHECKOUT-RELATIVE and FAIL-CLOSED:
// it reads only inside this worktree, so it is portable to CI and to any reviewer's clone, and it
// fails if the packet is absent OR byte-drifted rather than skipping. An earlier generation compared
// against an absolute path in a sibling clone and returned silently when that path was missing —
// on CI that made the test a no-op that reported green without asserting anything.
const FOUNDER_PACKET_REL = 'docs/adr/FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md';
const FOUNDER_PACKET_SHA256 = '96f1a58cba2d72588d02a37d34ac4059251ca1e8e124de7651f37d3b286ff07f';

// The five gate items the Founder answered. All five must read `Yes`, and the recorded option must
// be A — single-owner compatible revision. Nothing here accepts anything: the same packet is the
// source of the NOT-ACCEPTED lifecycle asserted alongside it.
const FOUNDER_GATE_ITEMS = ['G-W2I-1', 'G-W2I-2', 'G-W2I-3', 'G-W2I-4', 'G-W2I-5'];
const FOUNDER_ANSWER = '**Yes — Founder, 2026-07-26**';

test('the in-scope Founder decision packet is present, byte-pinned, and records Option A with G-W2I-1..5 all Yes', () => {
  const abs = join(ROOT, FOUNDER_PACKET_REL);
  assert.ok(
    existsSync(abs),
    `${FOUNDER_PACKET_REL} is ABSENT from this checkout. The candidate exists only because of the ` +
      'Founder path-ownership arbitration, so a missing packet must fail the suite, never skip it.',
  );

  // Never read outside this worktree: resolve both sides and prove containment.
  const realRoot = realpathSync(ROOT);
  const realPacket = realpathSync(abs);
  assert.ok(
    realPacket === join(realRoot, ...FOUNDER_PACKET_REL.split('/')),
    `the packet witness must read the in-scope copy at ${FOUNDER_PACKET_REL} and nothing outside ` +
      `this checkout — resolved to '${realPacket}', outside '${realRoot}'`,
  );

  const bytes = readFileSync(abs);
  assert.equal(
    sha256(bytes),
    FOUNDER_PACKET_SHA256,
    `${FOUNDER_PACKET_REL} has BYTE-DRIFTED from the arbitration this candidate was built against. ` +
      'The packet is decision evidence, not editable context: any drift invalidates every claim ' +
      'the candidate makes about Option A.',
  );

  // Option A semantics, read from the pinned bytes.
  const text = bytes.toString('utf8');
  assert.match(text, /^- Status: `DECIDED — OPTION A — W2-D SINGLE OWNER`$/m, 'the packet must record the decided Option A single-owner outcome');
  assert.match(text, /^- Option: \*\*A — Single-owner compatible revision\*\*$/m, 'the recorded decision must be Option A — single-owner compatible revision');
  assert.match(text, /^- Decided by: \*\*Founder\*\*$/m, 'the decision must be recorded as the Founder\'s');
  assert.match(text, /^- Decided on: \*\*2026-07-26\*\*$/m, 'the decision date must be the recorded 2026-07-26');

  // The five decisions, each individually witnessed on its own row.
  for (const item of FOUNDER_GATE_ITEMS) {
    const row = text.split('\n').find((l) => l.includes(`| ${item} —`));
    assert.ok(row, `the packet must carry a decision row for ${item}`);
    assert.ok(
      row.includes(FOUNDER_ANSWER),
      `${item} must be recorded as ${FOUNDER_ANSWER} — got: ${row}`,
    );
  }

  // Option A forecloses a second independent path owner and keeps W2-I unaccepted. Both are the
  // lifecycle this whole harness exists to protect.
  assert.match(text, /G-W2I-2 — W2-I may not be accepted as an independent second OpenAPI path owner/, 'G-W2I-2 must foreclose a second independent OpenAPI path owner');
  assert.match(text, /G-W2I-4 — accepted W2-D bytes remain unchanged/, 'G-W2I-4 must keep the accepted W2-D bytes unchanged');
  assert.match(text, /^- W2-I lifecycle: `PROPOSED — NOT ACCEPTED`; Gate `NOT OPENED`$/m, 'the packet must keep W2-I PROPOSED — NOT ACCEPTED with the gate NOT OPENED');
  assert.match(text, /W2-I remains `PROPOSED — NOT ACCEPTED`; W2-D is the sole accepted owner/, 'the packet must close by restating W2-D as the sole accepted owner');

  // The delta cites this same packet, so the two agree on which arbitration governs.
  assert.match(String(delta.founder_decision?.packet), new RegExp(`${FOUNDER_PACKET_REL.split('/').pop().replace(/\./g, '\\.')}$`));
});

// ---------------------------------------------------------------------------
// 7. Successor equivalence against the byte-frozen predecessor.
// ---------------------------------------------------------------------------
const OPS = ['listModelClasses', 'getModelClassHealth', 'createInference', 'createAlertSummarization'];
const opsOf = (doc) => {
  const out = {};
  for (const [p, item] of Object.entries(doc.paths || {})) {
    for (const [method, op] of Object.entries(item)) {
      if (!['get', 'post'].includes(method)) continue;
      out[`${method.toUpperCase()} ${p}`] = op;
    }
  }
  return out;
};

test('the successor pair set equals the predecessor pair set exactly', () => {
  assert.deepEqual(Object.keys(opsOf(successor)).sort(), Object.keys(opsOf(predecessor)).sort());
});

test('the successor preserves the four operationIds verbatim (no Bound suffix)', () => {
  const s = opsOf(successor);
  const p = opsOf(predecessor);
  for (const key of Object.keys(p)) {
    assert.equal(s[key].operationId, p[key].operationId, `${key}: operationId must be preserved verbatim`);
  }
  assert.deepEqual(Object.values(s).map((o) => o.operationId).sort(), [...OPS].sort());
});

test('the successor preserves request bodies, parameters and 200 bindings verbatim', () => {
  const s = opsOf(successor);
  const p = opsOf(predecessor);
  for (const key of Object.keys(p)) {
    assert.deepEqual(s[key].requestBody, p[key].requestBody, `${key}: requestBody must be preserved verbatim`);
    assert.deepEqual(s[key].parameters, p[key].parameters, `${key}: parameters must be preserved verbatim`);
    assert.deepEqual(s[key].responses['200'], p[key].responses['200'], `${key}: the 200 binding must be preserved verbatim`);
  }
});

// The two tests below close the gap the assertion above leaves open. An operation's `parameters`
// entry is a `$ref` POINTER, and a `responses` entry may be a named component: comparing the
// operation objects verbatim compares the pointers, so a component the pointer NAMES can drift while
// every assertion above stays green. These resolve the pointer and compare the component itself.
const localRef = (doc, ref) => ref.slice(2).split('/')
  .map((seg) => decodeURIComponent(seg).replace(/~1/g, '/').replace(/~0/g, '~'))
  .reduce((o, seg) => (o && typeof o === 'object' ? o[seg] : undefined), doc);
const resolveLocal = (doc, node) => (
  node && typeof node === 'object' && typeof node.$ref === 'string' && node.$ref.startsWith('#/')
    ? localRef(doc, node.$ref)
    : node
);

test('every accepted parameter component the successor reuses is preserved exactly, resolved', () => {
  const predParams = predecessor.components?.parameters || {};
  const succParams = successor.components?.parameters || {};
  assert.ok(Object.keys(predParams).includes('Traceparent'), 'the accepted predecessor must declare components.parameters.Traceparent, or this test proves nothing');
  for (const name of Object.keys(predParams)) {
    assert.ok(succParams[name], `the successor drops the accepted named parameter component '${name}'`);
    assert.deepEqual(
      succParams[name],
      predParams[name],
      `components.parameters.${name} drifted from the byte-frozen accepted predecessor — a named component both documents publish must stay structurally identical; an appended sentence is undisclosed consumer-visible drift`,
    );
  }

  // The four operations bind those components through pointers, so prove the RESOLVED operation
  // parameter list — not the pointer list — is identical on both sides.
  const s = opsOf(successor);
  const p = opsOf(predecessor);
  let resolved = 0;
  for (const key of Object.keys(p)) {
    const want = (p[key].parameters || []).map((n) => resolveLocal(predecessor, n));
    const got = (s[key].parameters || []).map((n) => resolveLocal(successor, n));
    for (const [i, node] of want.entries()) {
      assert.ok(node && typeof node === 'object', `${key}: accepted parameter #${i} does not resolve — the comparison would be vacuous`);
    }
    for (const [i, node] of got.entries()) {
      assert.ok(node && typeof node === 'object', `${key}: successor parameter #${i} does not resolve — a dangling pointer is not preservation`);
    }
    assert.deepEqual(got, want, `${key}: the RESOLVED operation parameter list must equal the accepted predecessor's`);
    resolved += want.length;
  }
  assert.equal(resolved, 5, `the resolved comparison must inspect all five accepted operation parameters (saw ${resolved})`);
});

test('every accepted named response component is still available in the successor, exactly', () => {
  const predResponses = predecessor.components?.responses || {};
  const succResponses = successor.components?.responses || {};
  assert.ok(Object.keys(predResponses).includes('InferenceError'), 'the accepted predecessor must declare components.responses.InferenceError, or this test proves nothing');
  for (const name of Object.keys(predResponses)) {
    assert.ok(
      succResponses[name],
      `the successor drops the accepted named response component '${name}' — a compatible successor revision keeps every named component the accepted document publishes available, even when its own operations bind the wider dual-branch surface`,
    );
    assert.deepEqual(succResponses[name], predResponses[name], `components.responses.${name} drifted from the byte-frozen accepted predecessor`);
  }
  // Preserved by NAME is not enough: it must still resolve, inside the successor's own document, to
  // the same accepted error schema FILE the predecessor binds.
  const fileOf = (doc, name) => resolveLocal(doc, doc.components.responses[name].content['application/json'].schema)?.$ref;
  assert.equal(fileOf(successor, 'InferenceError'), '../json-schema/cybrik.model-inference-error.v1.schema.json');
  assert.equal(fileOf(successor, 'InferenceError'), fileOf(predecessor, 'InferenceError'));
});

test('the successor status floor covers every predecessor status', () => {
  const s = opsOf(successor);
  const p = opsOf(predecessor);
  for (const key of Object.keys(p)) {
    for (const code of Object.keys(p[key].responses)) {
      assert.ok(code in s[key].responses, `${key}: predecessor status ${code} must still be bound in the successor`);
    }
  }
});

test('POST 422/503 are a two-branch oneOf carrying BOTH error shapes', () => {
  const s = opsOf(successor);
  for (const key of ['POST /api/v1/inferences', 'POST /api/v1/summarizations']) {
    for (const code of ['422', '503']) {
      const resp = s[key].responses[code];
      const schema = resp?.content?.['application/json']?.schema;
      assert.ok(Array.isArray(schema?.oneOf), `${key} ${code}: must be a oneOf`);
      const refs = schema.oneOf.map((b) => b.$ref);
      assert.ok(refs.some((r) => /model-inference-error\.v1\.schema\.json$/.test(r)), `${key} ${code}: must retain the predecessor ModelInferenceError branch`);
      assert.ok(refs.some((r) => /transport-authorization-error\.v1\.schema\.json$/.test(r)), `${key} ${code}: must add the TransportAuthorizationError branch`);
      assert.equal(schema.oneOf.length, 2, `${key} ${code}: exactly two branches`);
    }
  }
});

test('the successor AND-requires mutualTLS and delegationToken globally', () => {
  const ss = successor.components?.securitySchemes || {};
  const mtls = Object.keys(ss).find((k) => ss[k]?.type === 'mutualTLS');
  const jwt = Object.keys(ss).find((k) => ss[k]?.type === 'http' && String(ss[k]?.scheme).toLowerCase() === 'bearer' && /at\+jwt/i.test(ss[k]?.bearerFormat || ''));
  assert.ok(mtls && jwt, 'both securitySchemes must be declared');
  assert.ok((successor.security || []).some((r) => r && mtls in r && jwt in r), 'top-level security must AND-require both schemes in ONE requirement object');
  assert.equal(successor.security.length, 1, 'a second requirement object would make the bind an OR');
});

// Authority is carried by STRUCTURE, not by vocabulary. The accepted W2-D predecessor legitimately
// RETURNS ModelCapability descriptors, so a blanket ban on the word `capability` would forbid the
// very 200 binding the successor is required to preserve verbatim — and would still let an
// authority-bearing field through under any other name. These helpers walk the successor's path
// surface and judge what the document can actually EXPRESS.
const AUTHORITY_SEGMENTS = new Set([
  // approval / decision authority
  'approval', 'approvals', 'approve', 'approver', 'authorize', 'authorization', 'decision',
  // tool authority + delegation-of-tool
  'tool', 'tools', 'toolcall', 'toolcalls', 'toolcalling', 'tooluse', 'toolchain', 'delegationoftool',
  // agent / orchestration authority
  'agent', 'agents', 'orchestration', 'orchestrator',
  // MCP: a Tool/Agent gateway adapter, never this trust boundary
  'mcp',
  // execution authority + its evidence
  'invocation', 'invocations', 'invoke', 'execute', 'execution', 'exec', 'dispatch',
  'receipt', 'receipts',
  // capability GRANT/REFERENCE (a capability *descriptor* is a read result, not a grant — but no
  // KEY or extension may name a capability at all, which is strictly stronger)
  'capability', 'capabilities', 'grant', 'grants', 'granted', 'entitlement', 'entitlements',
  // model runtime / vendor identity
  'runtime', 'runtimes', 'vendor', 'vendors', 'provider', 'providers', 'weights', 'engine',
]);
// Out-of-band call surfaces: a document that can call out can carry authority regardless of naming.
const CALL_SURFACE_KEYS = new Set(['callbacks', 'webhooks', 'servers']);
// The ONLY operation-level extension this candidate is permitted to declare. A closed allowlist
// means any new `x-` extension must be argued at the gate rather than arriving silently.
const ALLOWED_OPERATION_EXTENSIONS = new Set(['x-cybrik-operation-token']);
// $ref targets that would import authority from another schema.
const AUTHORITY_REF = /(tool|approval|receipt|mcp|invocation|execution|agent|entitlement|grant|capability[-_]?(grant|ref|token))/i;

const segmentsOf = (key) => String(key)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .split(/[^A-Za-z0-9]+/)
  .filter(Boolean)
  .map((s) => s.toLowerCase());

/** Depth-first walk yielding [jsonPointer, key, value] for every object member under `node`. */
function* walkMembers(node, at = '') {
  if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) yield* walkMembers(v, `${at}/${i}`);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    const where = `${at}/${k}`;
    yield [where, k, v];
    yield* walkMembers(v, where);
  }
}

test('the successor grants no tool/agent/model/approval/runtime authority', () => {
  const members = [...walkMembers(successor.paths, '#/paths')];
  assert.ok(members.length > 0, 'the walk must actually traverse the successor path surface');

  // (a) No member KEY anywhere under paths may name an authority-bearing concern. Segment matching
  //     (snake_case, kebab-case and camelCase all normalise) means `tool_call`, `toolCall`,
  //     `x-cybrik-tool-calls` and `granted_capabilities` are all caught, not just literal spellings.
  //     Path templates are keys too, so `/api/v1/tools` could never be introduced here either.
  for (const [where, key] of members) {
    for (const seg of segmentsOf(key)) {
      assert.equal(
        AUTHORITY_SEGMENTS.has(seg),
        false,
        `${where}: member key '${key}' names the authority-bearing concern '${seg}' — the transport ` +
          'binding presents a request; it grants no tool/agent/model/approval/runtime authority ' +
          `(${SEAM_ADR} D4; W2-D G-W2D-1)`,
      );
    }
  }

  // (b) No out-of-band call surface: a callbacks/webhooks/servers block lets the plane originate
  //     calls, which is execution authority however it is spelled.
  for (const [where, key] of members) {
    assert.equal(CALL_SURFACE_KEYS.has(key.toLowerCase()), false, `${where}: '${key}' is an out-of-band call surface and must not appear in the successor`);
  }
  for (const key of Object.keys(successor)) {
    assert.equal(CALL_SURFACE_KEYS.has(key.toLowerCase()), false, `the successor document must declare no top-level '${key}' block`);
  }

  // (c) Operation extensions are a CLOSED allowlist — an unreviewed `x-` field is the cheapest place
  //     to smuggle an authority hook.
  for (const [where, key] of members) {
    if (!key.startsWith('x-')) continue;
    assert.ok(
      ALLOWED_OPERATION_EXTENSIONS.has(key),
      `${where}: undeclared operation extension '${key}' — only ${[...ALLOWED_OPERATION_EXTENSIONS].join(', ')} is permitted on this seam`,
    );
  }

  // (d) No $ref may import an authority-bearing schema. The accepted ModelCapability descriptor is
  //     PERMITTED — it is the predecessor's own 200 result — but only as a read RESULT, and only
  //     under the exact accepted reference. A capability GRANT/REFERENCE ref is still refused by
  //     AUTHORITY_REF, and a ModelCapability appearing in a requestBody would be a caller-supplied
  //     capability claim, which is authority input rather than a read result.
  const CAPABILITY_REF = '#/components/schemas/ModelCapability';
  const refs = members.filter(([, k]) => k === '$ref');
  assert.ok(refs.length > 0, 'the successor path surface must actually carry $ref bindings');
  let capabilityBindings = 0;
  for (const [where, , ref] of refs) {
    assert.equal(AUTHORITY_REF.test(ref), false, `${where}: $ref '${ref}' imports an authority-bearing schema`);
    if (!/capabilit/i.test(ref)) continue;
    assert.equal(ref, CAPABILITY_REF, `${where}: the only permitted capability reference is the accepted ${CAPABILITY_REF} descriptor`);
    assert.match(
      where,
      /\/responses\/200\//,
      `${where}: ${CAPABILITY_REF} may only be a 200 read RESULT; anywhere else (a requestBody, a parameter, an error binding) it would be a caller-asserted capability claim`,
    );
    assert.doesNotMatch(where, /\/(post|requestBody|parameters)\//, `${where}: ${CAPABILITY_REF} must not be reachable from a request surface`);
    capabilityBindings += 1;
  }
  // Non-vacuity: the accepted descriptor binding must actually be present, so this test is proven to
  // PERMIT it rather than passing because nothing named capability exists.
  assert.equal(capabilityBindings, 1, `the accepted ${CAPABILITY_REF} 200 binding must be present exactly once — this check permits it and must be proven to do so`);
  const listGet = successor.paths['/api/v1/model-classes']?.get;
  assert.equal(
    listGet?.responses?.['200']?.content?.['application/json']?.schema?.items?.$ref,
    CAPABILITY_REF,
    'the permitted capability reference is the predecessor listModelClasses 200 array item, unchanged',
  );

  // (e) No vendor/runtime identity anywhere in the bytes (comments included — a commented-out
  //     runtime name is still a named runtime).
  assert.doesNotMatch(successorText, /vendor|ollama|vllm|openai|qwen|llama\.cpp/i, 'no vendor/runtime is named');
});

test('the delta operation registry is closed and maps every token to its operation', () => {
  const reg = delta.operation_registry;
  assert.equal(reg?.closed, true, 'the operation registry must be CLOSED');
  assert.equal(reg.operations.length, 4);
  const s = opsOf(successor);
  const tokens = new Set();
  for (const o of reg.operations) {
    assert.equal(tokens.has(o.token), false, `duplicate registry token ${o.token}`);
    tokens.add(o.token);
    const key = `${o.method} ${o.path}`;
    assert.ok(s[key], `registry entry ${o.token} points at a pair the successor does not declare: ${key}`);
    assert.equal(s[key].operationId, o.operationId, `${o.token}: operationId mismatch`);
    assert.equal(s[key]['x-cybrik-operation-token'], o.token, `${key}: the successor must declare x-cybrik-operation-token ${o.token}`);
  }
  // Vocabulary provenance: the two POST tokens are accepted W2-F vocabulary; the two GET tokens are
  // W2-I PROPOSED vocabulary and are NOT accepted until the later gate.
  const byToken = Object.fromEntries(reg.operations.map((o) => [o.token, o]));
  assert.match(byToken['ai.inference.create'].vocabulary_status, /^ACCEPTED — W2-F vocabulary/);
  assert.match(byToken['ai.summarization.create'].vocabulary_status, /^ACCEPTED — W2-F vocabulary/);
  assert.match(byToken['ai.model_classes.list'].vocabulary_status, /^W2-I PROPOSED — NOT ACCEPTED/);
  assert.match(byToken['ai.model_class_health.read'].vocabulary_status, /^W2-I PROPOSED — NOT ACCEPTED/);
  const svcDefs = JSON.parse(read('contracts/json-schema/cybrik.svc-common-defs.v1.schema.json'));
  const acceptedVocab = svcDefs.$defs.operationRef.properties.name.description;
  assert.ok(acceptedVocab.includes("'ai.inference.create'") && acceptedVocab.includes("'ai.summarization.create'"), 'the accepted W2-F vocabulary must actually contain the two POST tokens');
});

test('exactly one positive transport fixture per registry operation, including health', () => {
  const em = JSON.parse(examplesManifestText);
  const bindingPositives = em.examples.filter((e) => e.kind === 'positive' && e.schema === 'cybrik.inference-transport-binding.v1.schema.json');
  assert.equal(bindingPositives.length, 4, 'four operations => four positive transport-binding fixtures');
  const tokens = bindingPositives.map((e) => JSON.parse(readFileSync(join(CONTRACTS, 'examples', 'transport', e.file), 'utf8')).rest_binding.operation.name);
  assert.deepEqual([...tokens].sort(), delta.operation_registry.operations.map((o) => o.token).sort());
  const health = delta.operation_registry.operations.find((o) => o.operationId === 'getModelClassHealth');
  assert.equal(health.positive_fixture, 'positive/model-class-health-transport-binding.json');
  assert.ok(existsSync(join(CONTRACTS, 'examples', 'transport', health.positive_fixture)), 'the health positive fixture must exist');
});

test('the D2 compatibility/break disclosure and the D3 disposition are explicit and non-binding on dates', () => {
  const d2 = delta.compatibility_disclosure;
  assert.equal(d2?.id, 'D2');
  assert.equal(d2.modifies_accepted_v0_1, false);
  assert.ok(Array.isArray(d2.breaking_changes) && d2.breaking_changes.length > 0, 'D2 must disclose the breaks honestly, not claim a pure-additive change');
  assert.ok(Array.isArray(d2.consumer_matrix) && d2.consumer_matrix.length > 0, 'D2 must carry a consumer compatibility matrix');
  const d3 = delta.proposed_disposition;
  assert.equal(d3?.id, 'D3');
  assert.equal(d3.predecessor_disposition_proposed, 'SUPERSEDED-SUPPORTED');
  assert.equal(d3.predecessor_byte_frozen, true);
  assert.equal(d3.dates_binding, false, 'D3 dates are PROPOSED, never binding');
  assert.match(d3.retirement_floor, /180 days/);
  assert.match(d3.retirement_floor, /two subsequent minor releases/);
  assert.match(d3.retirement_floor, /max\(/i);
});

test('D6: the accepted W2-D manifest references no proposed/delta/successor member', () => {
  const m = JSON.parse(read(W2D_MANIFEST_REL));
  const files = (m.members || []).map((x) => x.file);
  for (const f of files) {
    assert.doesNotMatch(f, /contract-0\.2\.0|w2i-proposed-delta|transport/, `accepted W2-D manifest must not reference candidate member ${f} before the flip`);
  }
  assert.doesNotMatch(JSON.stringify(m), /w2i-proposed-delta|contract-0\.2\.0/, 'the accepted W2-D manifest must not mention the candidate at all before the flip');
});

// ---------------------------------------------------------------------------
// 8. Mutation / behaviour proofs against a disposable candidate copy.
//
//    buildPacket() materialises contracts/ under the OS temp directory, applies the requested
//    mutation, RE-PINS every digest (so integrity checks never mask the rule under test), and
//    returns a runner. Data mutations run the validator IN-PROCESS via runValidation({root}) so
//    coverage instrumentation sees the failure branches; validator-SOURCE mutations spawn a copy.
// ---------------------------------------------------------------------------
const NODE_MODULES = join(ROOT, 'tools', 'contract-validation', 'node_modules');
const EXAMPLES_REL = 'examples/transport/examples-manifest.json';
const DELTA_IN_CONTRACTS = 'compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json';
const tempRoots = [];
after(() => { for (const d of tempRoots) rmSync(d, { recursive: true, force: true }); });

// The support fixtures are IMMUTABLE in this change except for the ONE added health positive.
// Aggregate recipe (SCOPE-AGG-SHA256/v1): for each repo-relative path in ascending byte order,
// `sha256hex + "  " + path + "\n"`; SHA-256 over that concatenation.
//
// Computed 2026-07-28 over the 22 support fixtures then on disk, two independent ways that agree:
//   (a) the algorithm this file implements below (node:crypto over the sorted digest lines);
//   (b) the equivalent shell recipe
//       `ls contracts/examples/transport/positive/*.json contracts/examples/transport/negative/*.json \
//          | sort | xargs shasum -a 256 | shasum -a 256`
//       (`shasum -a 256` emits exactly `<hex>  <path>\n`, the same line form).
// Both yield 5fad48769ec979137186fa3fdecf1fbd3b23b13d4a099e87a833fb57487e6515.
// Re-derive with (b) after any deliberate fixture change; never relax this to a computed value.
const SUPPORT_FIXTURE_AGGREGATE = '5fad48769ec979137186fa3fdecf1fbd3b23b13d4a099e87a833fb57487e6515';

const supportFixtureRelPaths = () => {
  const out = [];
  for (const sub of ['positive', 'negative']) {
    for (const f of readdirSync(join(CONTRACTS, 'examples', 'transport', sub))) {
      if (f.endsWith('.json')) out.push(`contracts/examples/transport/${sub}/${f}`);
    }
  }
  return out.sort();
};

/**
 * @param {object} [opts]
 * @param {(text: string) => string} [opts.validator]  mutate validate-transport.mjs source (spawn mode)
 * @param {(manifest: object) => void} [opts.examples] mutate the parsed examples manifest in place
 * @param {(delta: object) => void} [opts.delta]       mutate the parsed proposed delta in place
 * @param {(delta: object) => void} [opts.deltaAfterRepin] mutate the parsed proposed delta AFTER the
 *        digest re-pin step, so a row may leave a deliberately MALFORMED digest the re-pin would
 *        otherwise overwrite
 * @param {(text: string) => string} [opts.successor]  mutate the successor OpenAPI text
 * @param {Record<string, unknown>} [opts.writeFixtures] extra/replacement fixture files, keyed by
 *        path relative to contracts/examples/transport/ (value is JSON-serialised)
 * @param {Record<string, string>} [opts.writeContracts] extra/replacement files under contracts/
 * @param {Record<string, string>} [opts.writeContractsLate] files under contracts/ written AFTER the
 *        examples-manifest/delta re-pin step, so a row may leave UNPARSEABLE bytes (which the
 *        re-pin step itself would otherwise choke on) at a path the harness normally re-serialises
 * @param {string[]} [opts.removeContracts] files/directories under contracts/ to delete
 * @param {boolean} [opts.repinEntryDigests=true] recompute each examples-manifest entry digest
 */
function buildPacket(opts = {}) {
  const {
    validator: mutateValidator, examples: mutateExamples, writeFixtures = {},
    writeContracts = {}, writeContractsLate = {}, removeContracts = [], repinEntryDigests = true,
  } = opts;
  const dir = mkdtempSync(join(tmpdir(), 'cybrik-w2i-'));
  tempRoots.push(dir);

  cpSync(CONTRACTS, join(dir, 'contracts'), { recursive: true });
  const tContracts = join(dir, 'contracts');
  const toolDir = join(dir, 'tools', 'contract-validation');
  mkdirSync(toolDir, { recursive: true });
  symlinkSync(NODE_MODULES, join(toolDir, 'node_modules'));

  let vText = validatorText;
  if (mutateValidator) {
    vText = mutateValidator(validatorText);
    assert.notEqual(
      vText,
      validatorText,
      'validator mutation was a NO-OP — its anchor is absent from validate-transport.mjs, so the ' +
        'mutation proves nothing. The rule under test is not present in a mutable, identifiable form.',
    );
  }
  const validatorPath = join(toolDir, 'validate-transport.mjs');
  writeFileSync(validatorPath, vText);

  // Every write/removal below is NON-VACUITY GUARDED: a row whose "mutation" reproduces the bytes
  // already on disk, or removes something that was never there, proves nothing about the rule it
  // names — it must fail loudly here rather than be reported as a green mutation proof.
  const writeChanged = (abs, body, what) => {
    const before = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    assert.notEqual(body, before, `${what} was a NO-OP — the bytes it writes are already on disk, so the mutation proves nothing`);
    writeFileSync(abs, body);
  };

  const tExamplesDir = join(tContracts, 'examples', 'transport');
  for (const [rel, body] of Object.entries(writeFixtures)) {
    writeChanged(join(tExamplesDir, rel), typeof body === 'string' ? body : `${JSON.stringify(body, null, 2)}\n`, `writeFixtures ${rel}`);
  }
  for (const [rel, body] of Object.entries(writeContracts)) writeChanged(join(tContracts, rel), body, `writeContracts ${rel}`);
  for (const rel of removeContracts) {
    const abs = join(tContracts, rel);
    assert.ok(existsSync(abs), `removeContracts ${rel} was a NO-OP — nothing was on disk to remove, so the absence the row asserts was never created by this mutation`);
    rmSync(abs, { recursive: true, force: true });
  }

  if (opts.successor) {
    const rel = 'openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml';
    const before = readFileSync(join(tContracts, rel), 'utf8');
    const afterText = opts.successor(before);
    assert.notEqual(afterText, before, 'successor mutation was a NO-OP — its anchor is absent');
    writeFileSync(join(tContracts, rel), afterText);
  }

  const em = JSON.parse(readFileSync(join(tContracts, EXAMPLES_REL), 'utf8'));
  if (mutateExamples) {
    const beforeEm = JSON.stringify(em);
    mutateExamples(em);
    assert.notEqual(JSON.stringify(em), beforeEm, 'examples-manifest mutation was a NO-OP — the entry/field it targets is absent, so the mutation proves nothing');
  }
  if (repinEntryDigests) {
    for (const ex of em.examples || []) ex.sha256 = sha256File(join(tExamplesDir, ex.file));
  }
  writeFileSync(join(tContracts, EXAMPLES_REL), `${JSON.stringify(em, null, 2)}\n`);

  // Re-pin the candidate-level digests last, so an integrity failure can only come from a digest
  // the test deliberately left stale.
  const tDelta = JSON.parse(readFileSync(join(tContracts, DELTA_IN_CONTRACTS), 'utf8'));
  if (opts.delta) {
    const beforeDelta = JSON.stringify(tDelta);
    opts.delta(tDelta);
    assert.notEqual(JSON.stringify(tDelta), beforeDelta, 'delta mutation was a NO-OP — the field it targets is absent from the proposed delta, so the mutation proves nothing');
  }
  if (opts.repinDelta !== false) {
    tDelta.examples_manifest_sha256 = sha256File(join(tContracts, EXAMPLES_REL));
    for (const m of tDelta.candidate_members || []) {
      const abs = join(tContracts, m.file);
      if (existsSync(abs)) m.sha256 = sha256File(abs);
    }
    // ATOMIC TWO-SITE RE-PIN. Each OpenAPI digest is declared TWICE: the successor in
    // candidate_members AND in ownership.proposed_successor, the predecessor in
    // upstream_pins.accepted AND in ownership.current_owner. validate-transport.mjs §3c rejects a
    // one-sided re-pin, so re-pinning candidate_members alone would make EVERY successor mutation
    // fail on pin disagreement instead of on the rule under test — a response-binding proof would
    // then be vacuous. Both ownership sites are re-pinned here from the same bytes, in the same
    // step, exactly as a real edit must re-pin them. upstream_pins.accepted is deliberately NOT
    // touched: it is the authoritative table a row may forge on purpose (section 8.6).
    for (const site of [tDelta.ownership?.proposed_successor, tDelta.ownership?.current_owner]) {
      if (!site || typeof site.file !== 'string') continue;
      const abs = join(tContracts, site.file);
      if (existsSync(abs)) site.sha256 = sha256File(abs);
    }
  }
  // Post-re-pin delta mutation. The ONLY way a row can leave a deliberately MALFORMED digest in the
  // delta: opts.delta runs BEFORE the re-pin above, which would overwrite it with a well-formed one
  // and turn the row into a no-op proof. Deliberately separate from opts.delta so no existing row
  // changes behaviour, and NO-OP-guarded like every other mutation hook.
  if (opts.deltaAfterRepin) {
    const beforeLate = JSON.stringify(tDelta);
    opts.deltaAfterRepin(tDelta);
    assert.notEqual(JSON.stringify(tDelta), beforeLate, 'deltaAfterRepin mutation was a NO-OP — the field it targets is absent from the proposed delta, so the mutation proves nothing');
  }
  writeFileSync(join(tContracts, DELTA_IN_CONTRACTS), `${JSON.stringify(tDelta, null, 2)}\n`);
  // Late writes land after every re-pin, so a row may leave deliberately unparseable bytes at a path
  // the re-pin step reads (the examples manifest, the accepted W2-D manifest, the predecessor).
  for (const [rel, body] of Object.entries(writeContractsLate)) writeChanged(join(tContracts, rel), body, `writeContractsLate ${rel}`);

  const spawnMode = Boolean(mutateValidator);
  const run = spawnMode
    ? () => {
      const r = spawnSync(process.execPath, [validatorPath], { encoding: 'utf8' });
      return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
    }
    : () => {
      const { errors, counts } = runValidation({ root: dir });
      return {
        status: errors.length ? 1 : 0,
        out: `counts: ${JSON.stringify(counts)}\n` + errors.map((e) => `  - ${e}`).join('\n'),
      };
    };
  return { dir, run };
}

const expectPass = (packet, why) => {
  const r = packet.run();
  assert.equal(r.status, 0, `${why}\n--- validator output ---\n${r.out}`);
  return r;
};
// A successor mutation that is not re-pinned at BOTH declaration sites fails §3c pin agreement
// before any rule about its CONTENT is reached, so the run would be red for a reason that has
// nothing to do with the rule the row names. Every expectFail asserts that noise is absent unless
// the row is the dedicated pin-drift proof itself.
const SUCCESSOR_PIN_DISAGREEMENT = /ownership\.proposed_successor\.sha256[\s\S]{0,400}?disagrees with candidate_members/;
const expectFail = (packet, why, matcher, { allowSuccessorPinDrift = false } = {}) => {
  const r = packet.run();
  assert.equal(r.status, 1, `${why}\n--- validator output ---\n${r.out}`);
  if (matcher) assert.match(r.out, matcher, `${why} — wrong failure reason\n--- validator output ---\n${r.out}`);
  if (!allowSuccessorPinDrift) {
    assert.doesNotMatch(
      r.out,
      SUCCESSOR_PIN_DISAGREEMENT,
      `${why} — the run ALSO reported an ownership.proposed_successor / candidate_members pin ` +
        'disagreement, so this proof may be passing on a stale digest rather than on the rule under ' +
        'test. buildPacket must re-pin BOTH successor digest sites atomically.' +
        `\n--- validator output ---\n${r.out}`,
    );
  }
  return r;
};
const countsOf = (out) => {
  const m = out.match(/^counts: (\{.*\})$/m);
  assert.ok(m, `validator did not print a counts line\n--- validator output ---\n${out}`);
  return JSON.parse(m[1]);
};

const fixture = (rel) => JSON.parse(readFileSync(join(CONTRACTS, 'examples', 'transport', rel), 'utf8'));

// --- 8.0 harness sanity + support-fixture immutability -----------------------
test('the unmutated candidate copy passes the validator (harness sanity)', () => {
  expectPass(buildPacket(), 'a faithful copy of the candidate must validate; otherwise every mutation test below is meaningless');
});

test('the repository itself passes the validator in-process', () => {
  const { errors } = runValidation({ root: ROOT });
  assert.deepEqual(errors, [], 'the in-repo candidate must validate');
});

test('the 22 support fixtures are byte-identical to their pinned aggregate', () => {
  const rels = supportFixtureRelPaths();
  assert.equal(rels.length, 22, 'the candidate carries exactly 22 support fixtures besides the examples manifest');
  const lines = rels.map((rel) => `${sha256File(join(ROOT, rel))}  ${rel}\n`).join('');
  assert.equal(
    createHash('sha256').update(lines).digest('hex'),
    SUPPORT_FIXTURE_AGGREGATE,
    'a support fixture changed — the 21 pre-existing support fixtures are IMMUTABLE and the one added health positive is pinned',
  );
});

// --- 8.1 TX-8 non-vacuity and declared-TX exactness (preserved) --------------
test('every negative-semantic fixture is rejected by EXACTLY its declared TX-* invariant', () => {
  const counts = countsOf(expectPass(buildPacket(), 'baseline candidate must validate').out);
  for (let n = 1; n <= 8; n += 1) {
    assert.equal(
      counts[`tx_witness_TX-${n}`],
      1,
      `TX-${n} is not proven by exactly one declared negative-semantic witness — the validator must ` +
        `report which TX id each fixture actually returned, not merely that something rejected it ` +
        `(counts: ${JSON.stringify(counts)})`,
    );
  }
  assert.equal(counts.runtime_negative_declared_match, 8, 'all 8 negative-semantic fixtures must reject on their declared TX id');
});

test('TX-8 is not vacuous: neutralising its witness makes the candidate fail', () => {
  const witness = fixture('negative/inference-transport-binding.feature-disabled-served.json');
  witness.feature_flag.enabled = true;
  expectFail(
    buildPacket({ writeFixtures: { 'negative/inference-transport-binding.feature-disabled-served.json': witness } }),
    'with its feature flag flipped on, the declared TX-8 witness no longer exercises TX-8 — the ' +
      'validator must fail instead of silently accepting the TX-7 rejection that shadows it',
    /TX-8/,
  );
});

test('bypassing the TX-8 predicate makes the candidate fail', () => {
  expectFail(
    buildPacket({ validator: (t) => t.replace("d.feature_flag?.enabled === false", "d.feature_flag?.enabled === 'never'") }),
    'a TX-8 predicate that can never match must be caught — the feature-flag rule is dead code otherwise',
    /TX-8/,
  );
});

test('removing the TX-8 rule makes the candidate fail', () => {
  expectFail(
    buildPacket({ validator: (t) => t.replace(/\/\* TX-8:BEGIN \*\/[\s\S]*?\/\* TX-8:END \*\//, '') }),
    'deleting the TX-8 rule outright must be caught by its declared witness',
    /TX-8/,
  );
});

test('evaluating TX-7 before TX-8 (mis-ordering) makes the candidate fail', () => {
  const swap = (t) => {
    const tx8 = t.match(/\/\* TX-8:BEGIN \*\/[\s\S]*?\/\* TX-8:END \*\//)?.[0];
    const tx7 = t.match(/\/\* TX-7:BEGIN \*\/[\s\S]*?\/\* TX-7:END \*\//)?.[0];
    if (!tx8 || !tx7) return t; // no-op -> buildPacket asserts the anchors exist
    return t.replace(tx8, '/* TX-8:MOVED */').replace(tx7, tx8).replace('/* TX-8:MOVED */', tx7);
  };
  expectFail(
    buildPacket({ validator: swap }),
    'TX-8 must be evaluated before TX-7: every negative-semantic fixture reuses the canonical ' +
      'jti + idempotency_key, so a replay-first order returns TX-7 for the declared TX-8 witness',
    /TX-8/,
  );
});

test('the delta documents the fixed TX evaluation order', () => {
  const order = delta.trust_invariants?.runtime_evaluation_order || '';
  assert.match(order, /TX-8[\s\S]*TX-7/, 'the delta must record that TX-8 is evaluated before TX-7');
  assert.match(order, /disabled/i, 'the delta must explain WHY the feature-flag rule precedes the replay rule');
  assert.match(order, /primary/i, 'the delta must record that a fixture may match several rules and rejects on its declared primary rule');
});

test('the validator requires the delta to document the TX evaluation order', () => {
  expectFail(
    buildPacket({ delta: (c) => { delete c.trust_invariants.runtime_evaluation_order; } }),
    'dropping runtime_evaluation_order must fail — an undocumented ordering makes the ' +
      'declared-primary-rule contract unverifiable',
    /runtime_evaluation_order/,
  );
  expectFail(
    buildPacket({ delta: (c) => { c.trust_invariants.runtime_evaluation_order = c.trust_invariants.runtime_evaluation_order.replace(/TX-8 feature flag, TX-7 replay/, 'TX-7 replay, TX-8 feature flag'); } }),
    'a delta documenting replay-before-feature-flag contradicts the enforced order and must fail',
    /TX-8.*before.*TX-7|runtime_evaluation_order/,
  );
});

// --- 8.2 TT-4 structural conditional (preserved) -----------------------------
const CANON_POST = 'positive/inference-transport-binding.json';
const CANON_GET = 'positive/model-classes-transport-binding.json';
const derive = (rel, mutate) => { const d = fixture(rel); mutate(d); return d; };
const entry = (file, kind, invariant) => ({ file, schema: 'cybrik.inference-transport-binding.v1.schema.json', kind, invariant });

test('TT-4: a create presentation with no root idempotency_key is structurally rejected', () => {
  const missing = derive(CANON_POST, (d) => { d.binding_id = 'itb-tt4-missing'; delete d.idempotency_key; });
  expectPass(
    buildPacket({
      writeFixtures: { 'negative/tt4.missing-idempotency-key.json': missing },
      examples: (em) => em.examples.push(entry('negative/tt4.missing-idempotency-key.json', 'negative-schema', 'TT-4 REPLAY CONTROL: a POST create declaring requires_idempotency_key=true MUST carry a root idempotency_key.')),
    }),
    'a POST create with requires_idempotency_key=true and NO root idempotency_key must fail JSON ' +
      'Schema validation — minLength alone never fires on an absent property',
  );
});

test('TT-4: a create presentation with a short idempotency_key is structurally rejected', () => {
  const short = derive(CANON_POST, (d) => { d.binding_id = 'itb-tt4-short'; d.idempotency_key = 'short'; });
  expectPass(
    buildPacket({
      writeFixtures: { 'negative/tt4.short-key.json': short },
      examples: (em) => em.examples.push(entry('negative/tt4.short-key.json', 'negative-schema', 'TT-4 REPLAY CONTROL: idempotency_key minLength 16.')),
    }),
    'a create retry key shorter than 16 characters must be rejected',
  );
});

test('TT-4: an inconsistent create (POST declaring requires_idempotency_key=false) is rejected', () => {
  const inconsistent = derive(CANON_POST, (d) => { d.binding_id = 'itb-tt4-post-false'; d.rest_binding.requires_idempotency_key = false; });
  expectPass(
    buildPacket({
      writeFixtures: { 'negative/tt4.post-flag-false.json': inconsistent },
      examples: (em) => em.examples.push(entry('negative/tt4.post-flag-false.json', 'negative-schema', 'TT-4 REPLAY CONTROL: a POST create cannot declare itself exempt from the mandatory Idempotency-Key.')),
    }),
    'a POST create that declares requires_idempotency_key=false would escape mandatory replay ' +
      'control; the method/flag pair must be structurally forced to agree',
  );
});

test('TT-4: an inconsistent read (GET declaring requires_idempotency_key=true) is rejected', () => {
  const inconsistent = derive(CANON_GET, (d) => { d.binding_id = 'itb-tt4-get-true'; d.rest_binding.requires_idempotency_key = true; });
  expectPass(
    buildPacket({
      writeFixtures: { 'negative/tt4.get-flag-true.json': inconsistent },
      examples: (em) => em.examples.push(entry('negative/tt4.get-flag-true.json', 'negative-schema', 'TT-4 REPLAY CONTROL: a safe GET read cannot declare a create-only idempotency-key policy.')),
    }),
    'a GET read declaring requires_idempotency_key=true is an inconsistent method/flag pair',
  );
});

test('TT-4: a safe read that declares no key policy is NOT forced to carry an idempotency_key', () => {
  const read2 = derive(CANON_GET, (d) => { d.binding_id = 'itb-tt4-get-ok'; });
  assert.equal(read2.rest_binding.method, 'GET');
  assert.equal(read2.rest_binding.requires_idempotency_key, false);
  assert.equal(read2.idempotency_key, undefined);
  expectPass(
    buildPacket({
      writeFixtures: { 'positive/tt4.get-read.json': read2 },
      examples: (em) => em.examples.push(entry('positive/tt4.get-read.json', 'positive')),
    }),
    'the TT-4 conditional must not accidentally force a key onto a safe read whose policy says none',
  );
});

// --- 8.3 support-fixture integrity binding (preserved) -----------------------
test('every examples-manifest entry carries a lowercase sha256 pin for its fixture bytes', () => {
  const em = JSON.parse(examplesManifestText);
  assert.equal(em.examples.length, 22, 'the examples manifest indexes all 22 support fixtures');
  for (const ex of em.examples) {
    assert.match(String(ex.sha256), /^[0-9a-f]{64}$/, `examples-manifest entry ${ex.file} must pin a lowercase sha256 of its fixture bytes`);
    assert.equal(sha256File(join(CONTRACTS, 'examples', 'transport', ex.file)), ex.sha256, `examples-manifest entry ${ex.file}: pinned sha256 is stale`);
  }
});

test('a self-consistent fixture edit that is not re-pinned fails closed', () => {
  const rel = 'negative/inference-transport-binding.replay.json';
  const reserialised = `${JSON.stringify(fixture(rel), null, 4)}\n`;
  assert.notEqual(reserialised, readFileSync(join(CONTRACTS, 'examples', 'transport', rel), 'utf8'), 're-serialisation must actually change the bytes');
  expectFail(
    buildPacket({ writeFixtures: { [rel]: reserialised }, repinEntryDigests: false }),
    'a support fixture whose bytes changed without a digest re-pin must be rejected — otherwise the ' +
      'delta does not bind the fixture bytes the gate evaluates',
    /replay\.json/,
  );
});

test('a missing or malformed entry digest is rejected', () => {
  expectFail(
    buildPacket({ examples: (em) => { delete em.examples[0].sha256; }, repinEntryDigests: false }),
    'an examples-manifest entry with no sha256 must be rejected (fail closed, not skipped)',
    /sha256/i,
  );
  expectFail(
    buildPacket({ examples: (em) => { em.examples[0].sha256 = 'NOTAHEXDIGEST'; }, repinEntryDigests: false }),
    'an examples-manifest entry whose sha256 is not 64 lowercase hex must be rejected',
    /sha256/i,
  );
});

test('a duplicate examples-manifest entry is rejected', () => {
  expectFail(
    buildPacket({ examples: (em) => { em.examples.push({ ...em.examples[0] }); } }),
    'the same fixture listed twice must be rejected — a duplicate makes the inventory count a lie',
    /duplicate/i,
  );
});

test('an orphan fixture on disk with no examples-manifest entry is rejected', () => {
  expectFail(
    buildPacket({ writeFixtures: { 'positive/orphan.json': fixture(CANON_GET) } }),
    'a fixture present on disk but absent from the manifest must be rejected — an unindexed fixture ' +
      'is unpinned bytes inside the candidate',
    /orphan\.json/,
  );
});

// --- 8.4 ownership / lifecycle mutation proofs -------------------------------
const successorRaw = () => readFileSync(join(CONTRACTS, 'openapi', 'cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml'), 'utf8');

test('a SECOND accepted/CURRENT owner of the four pairs is rejected', () => {
  const clone = successorRaw()
    .replace('x-cybrik-status: PROPOSED', 'x-cybrik-status: ACCEPTED FOR IMPLEMENTATION')
    .replace('x-cybrik-not-accepted: true', 'x-cybrik-not-accepted: false')
    .replace('x-cybrik-lifecycle-role: PROPOSED-SUCCESSOR', 'x-cybrik-lifecycle-role: CURRENT');
  expectFail(
    buildPacket({ writeContracts: { 'openapi/cybrik-ai-inference-plane.v1.rogue.openapi.yaml': clone } }),
    'two CURRENT owners of the same (method, path) pair must be rejected — Founder Option A permits exactly one',
    /CURRENT owner/i,
  );
});

test('a SECOND proposed successor of the four pairs is rejected', () => {
  const clone = successorRaw().replace('title: CYBRIK AI model-inference plane', 'title: CYBRIK AI model-inference plane (second candidate)');
  expectFail(
    buildPacket({ writeContracts: { 'openapi/cybrik-ai-inference-plane.v1.contract-0.3.0.openapi.yaml': clone } }),
    'only ONE delta-linked proposed successor may duplicate the accepted path declarations',
    /successor/i,
  );
});

test('an early half-flip of the successor status is rejected', () => {
  expectFail(
    buildPacket({ successor: (t) => t.replace('  x-cybrik-status: PROPOSED', '  x-cybrik-status: ACCEPTED FOR IMPLEMENTATION') }),
    'flipping the successor to ACCEPTED while the delta is unapplied and Gate W2-I is NOT OPENED must be rejected',
    /PROPOSED|flip|lifecycle/i,
  );
});

test('marking the delta applied while the gate is not decided is rejected', () => {
  expectFail(
    buildPacket({ delta: (c) => { c['x-cybrik-applied'] = true; } }),
    'the delta may only be applied at a future recorded Gate W2-I status flip',
    /applied/i,
  );
});

test('the retired second-plane draft reappearing on disk is rejected', () => {
  expectFail(
    buildPacket({ writeContracts: { 'openapi/cybrik-ai-inference-transport-plane.v1.openapi.yaml': successorRaw() } }),
    'the retired second-plane sidecar must never come back — it re-creates the rejected second-owner shape',
    /cybrik-ai-inference-transport-plane/,
  );
});

test('a rogue separate transport manifest reappearing on disk is rejected', () => {
  expectFail(
    buildPacket({ writeContracts: { 'compatibility/cybrik-suite-inference-transport-packet.v1.manifest.json': '{"x-cybrik-status":"PROPOSED"}\n' } }),
    'a separate transport packet manifest is forbidden — the candidate enters through the delta only',
    /cybrik-suite-inference-transport-packet/,
  );
});

test('renaming the delta to a .manifest.json filename is rejected', () => {
  expectFail(
    buildPacket({ delta: (c) => { c['x-cybrik-is-manifest'] = true; } }),
    'the delta must self-deny manifest status; claiming to be a manifest must fail',
    /manifest/i,
  );
});

// --- 8.5 successor equivalence mutation proofs -------------------------------
test('renaming a successor operationId is rejected', () => {
  expectFail(
    buildPacket({ successor: (t) => t.replace('operationId: createInference', 'operationId: createInferenceBound') }),
    'the successor must preserve the accepted operationIds verbatim; a rename breaks every generated client',
    /operationId/i,
  );
});

// The 422/503 error surface is declared ONCE, as the YAML anchor
//   InferenceOrTransportError: &inferenceOrTransportError
// under components.responses, and aliased (*inferenceOrTransportError) by every bound status. The
// mutation therefore has to edit that anchored block: it removes ONLY the accepted-W2-D
// ModelInferenceError branch from its `oneOf`, leaving the proposed transport branch and every other
// byte intact. That is a REAL changed successor file (one deleted line), which is what makes the
// validator's rejection meaningful. buildPacket's notEqual guard still catches a no-op if the block
// is ever restructured — the anchor must then be re-derived, not loosened.
const dropModelInferenceErrorBranch = (t) => t.replace(
  /(InferenceOrTransportError: &inferenceOrTransportError\n[\s\S]*?\n {12}oneOf:\n)((?: {14}- \$ref: '[^']+'\n)+)/,
  (_whole, head, branches) => head + branches
    .split('\n')
    .filter((l) => l.trim() && !l.includes('cybrik.model-inference-error.v1.schema.json'))
    .map((l) => `${l}\n`)
    .join(''),
);

test('dropping the ModelInferenceError branch from the POST 422 oneOf is rejected', () => {
  const mutated = dropModelInferenceErrorBranch(successorRaw());
  // Prove the mutation is exactly the intended one-line deletion before spending a validator run.
  assert.notEqual(mutated, successorRaw(), 'the InferenceOrTransportError anchor block was not matched — re-derive the anchor');
  assert.equal(
    countOf(successorRaw(), "\n              - $ref: '../json-schema/cybrik.model-inference-error.v1.schema.json'\n")
      - countOf(mutated, "\n              - $ref: '../json-schema/cybrik.model-inference-error.v1.schema.json'\n"),
    1,
    'the mutation must remove exactly the ModelInferenceError oneOf branch',
  );
  assert.ok(mutated.includes("- $ref: '../json-schema/cybrik.transport-authorization-error.v1.schema.json'"), 'the proposed transport branch must survive the mutation');
  expectFail(
    buildPacket({ successor: dropModelInferenceErrorBranch }),
    'a 422/503 that no longer accepts the accepted W2-D ModelInferenceError shape is a response-binding regression',
    /422|503|oneOf|ModelInferenceError/i,
  );
});

test('dropping a successor path is rejected', () => {
  expectFail(
    buildPacket({ successor: (t) => t.replace(/  \/api\/v1\/summarizations:[\s\S]*$/, '') }),
    'the successor pair set must equal the predecessor pair set exactly',
    /pair|path|summarizations/i,
  );
});

test('weakening the global AND security bind to an OR is rejected', () => {
  expectFail(
    buildPacket({ successor: (t) => t.replace('security:\n  - mutualTLS: []\n    delegationToken: []', 'security:\n  - mutualTLS: []\n  - delegationToken: []') }),
    'two requirement objects mean mTLS OR token; the bind must be a single AND requirement',
    /AND-require|security/i,
  );
});

// --- 8.6 pin-drift proofs ----------------------------------------------------
test('upstream pin drift on the accepted W2-D OpenAPI is rejected', () => {
  expectFail(
    buildPacket({ delta: (c) => { c.upstream_pins.accepted.find((p) => p.file.endsWith('cybrik-ai-inference-plane.v1.openapi.yaml')).sha256 = 'f'.repeat(64); } }),
    'a stale/forged upstream pin must be rejected — the delta binds the accepted bytes it was reviewed against',
    /upstream|sha-?256/i,
  );
});

test('upstream pin drift on the accepted W2-D manifest is rejected', () => {
  expectFail(
    buildPacket({ delta: (c) => { c.upstream_pins.accepted.find((p) => p.file.endsWith('cybrik-suite-inference-packet.v1.manifest.json')).sha256 = '0'.repeat(64); } }),
    'the accepted W2-D manifest pin must match its on-disk bytes',
    /upstream|sha-?256/i,
  );
});

test('candidate member pin drift is rejected', () => {
  expectFail(
    buildPacket({
      delta: (c) => { c.candidate_members[0].sha256 = 'a'.repeat(64); },
      repinDelta: false,
    }),
    'a candidate member whose bytes drifted from its pin must be rejected',
    /sha-?256/i,
    // THIS row is the pin-drift proof: candidate_members[0] IS the successor, so the two-site
    // disagreement is the expected consequence, not masking noise.
    { allowSuccessorPinDrift: true },
  );
});

test('D6: an accepted W2-D manifest that references a candidate member is rejected', () => {
  const mutatedManifest = (() => {
    const m = JSON.parse(read(W2D_MANIFEST_REL));
    m.members.push({ file: 'openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml', title: 'rogue', contract_version: '0.2.0', format: 'openapi', kind: 'rest-mapping' });
    return `${JSON.stringify(m, null, 2)}\n`;
  })();
  // The upstream pin must be re-pinned to the ACTUAL bytes this test writes into the temp packet.
  // A placeholder ('SKIP') is not a 64-hex digest, so the validator's pin-format rule fires first
  // and the run fails for malformed-pin reasons — masking D6 entirely and leaving the rule unproven.
  // Re-pinning weakens nothing: the byte-frozen-upstream rule keeps its own dedicated proofs in 8.6.
  const mutatedSha = sha256(mutatedManifest);
  assert.match(mutatedSha, /^[0-9a-f]{64}$/, 'the re-pinned D6 digest must be a valid 64-hex sha256');
  assert.notEqual(mutatedSha, sha256File(join(ROOT, W2D_MANIFEST_REL)), 'the D6 mutation must actually change the accepted manifest bytes');
  expectFail(
    buildPacket({
      writeContracts: { 'compatibility/cybrik-suite-inference-packet.v1.manifest.json': mutatedManifest },
      delta: (c) => { c.upstream_pins.accepted.find((p) => p.file.endsWith('cybrik-suite-inference-packet.v1.manifest.json')).sha256 = mutatedSha; },
    }),
    'the accepted manifest must not reference a proposed/delta/successor member before the flip (D6)',
    /D6|accepted W2-D manifest/i,
  );
});

// --- 8.7 registry / coverage mutation proofs ---------------------------------
test('removing the health positive fixture is rejected (missing operation coverage)', () => {
  expectFail(
    buildPacket({
      examples: (em) => { em.examples = em.examples.filter((e) => e.file !== 'positive/model-class-health-transport-binding.json'); },
      removeContracts: ['examples/transport/positive/model-class-health-transport-binding.json'],
    }),
    'every registry operation, health included, needs exactly one positive transport fixture',
    /health|coverage|positive fixture/i,
  );
});

test('a fixture operation token outside the closed registry is rejected (token drift)', () => {
  const drifted = derive(CANON_GET, (d) => { d.rest_binding.operation.name = 'ai.model_classes.enumerate'; });
  expectFail(
    buildPacket({ writeFixtures: { [CANON_GET]: drifted } }),
    'a fixture whose operation token is not in the closed registry must be rejected',
    /token|registry/i,
  );
});

test('a registry entry pointing at an operationId the successor does not declare is rejected', () => {
  expectFail(
    buildPacket({ delta: (c) => { c.operation_registry.operations[0].operationId = 'listModelClassesV2'; } }),
    'the registry must resolve against the successor operations',
    /registry|operationId/i,
  );
});

test('closing the registry over fewer than the four operations is rejected', () => {
  expectFail(
    buildPacket({ delta: (c) => { c.operation_registry.operations = c.operation_registry.operations.slice(0, 3); } }),
    'the registry is CLOSED over all four operations; a short registry hides an unmapped operation',
    /registry|four|operation/i,
  );
});

// --- 8.8 unreachable-validator proof (ESM main-guard false-green) ------------
test('the validator main guard survives a symlinked invocation path (no false green)', () => {
  const p = buildPacket();
  const realDir = p.dir;
  const linkDir = mkdtempSync(join(tmpdir(), 'cybrik-w2i-link-')) + '-link';
  tempRoots.push(linkDir);
  symlinkSync(realDir, linkDir);
  const viaLink = join(linkDir, 'tools', 'contract-validation', 'validate-transport.mjs');

  const good = spawnSync(process.execPath, [viaLink], { encoding: 'utf8' });
  const goodOut = `${good.stdout || ''}${good.stderr || ''}`;
  assert.match(goodOut, /^counts: /m, 'the real main guard must actually RUN the validator when invoked through a symlinked path');
  assert.equal(good.status, 0, goodOut);

  // The naive guard (raw argv[1] vs import.meta.url, no realpath) silently exits 0 having run
  // NOTHING through a symlinked path. This proves the realpath guard is load-bearing.
  const naive = buildPacket({
    validator: (t) => t.replace(
      'export function isMainModule(metaUrl, argv1 = process.argv[1]) {',
      'export function isMainModule(metaUrl, argv1 = process.argv[1]) {\n  return argv1 === fileURLToPath(metaUrl); // NAIVE',
    ),
  });
  const naiveLink = mkdtempSync(join(tmpdir(), 'cybrik-w2i-naive-')) + '-link';
  tempRoots.push(naiveLink);
  symlinkSync(naive.dir, naiveLink);
  const naiveRun = spawnSync(process.execPath, [join(naiveLink, 'tools', 'contract-validation', 'validate-transport.mjs')], { encoding: 'utf8' });
  const naiveOut = `${naiveRun.stdout || ''}${naiveRun.stderr || ''}`;
  assert.doesNotMatch(
    naiveOut,
    /^counts: /m,
    'a naive argv[1]===import.meta.url guard must be demonstrably broken under a symlinked path; ' +
      'if it still ran, this proof no longer protects the realpath guard and must be re-derived',
  );
});

// --- 8.10 §6b response-binding and §7 ownership-sweep failure-path rows -------
//
// Sections 8.4/8.5 prove the HEADLINE rejections (a dropped ModelInferenceError branch, a second
// CURRENT owner). The rows below drive the remaining §6b/§7 REJECTION paths — the ones a reader
// would otherwise have to take on trust: an unevaluable accepted floor, a derivation that came back
// empty, a re-composed or unresolvable branch set, and every ownership-sweep verdict other than
// "two CURRENT owners".
//
// Three properties hold for every row, and none of them is optional:
//   (a) IN-PROCESS. Each row runs the validator through buildPacket's runValidation path, so
//       `node --test --experimental-test-coverage` instruments the branch the row drives. A spawned
//       row would be invisible to the coverage gate in 8.9.
//   (b) EXACT DIAGNOSTIC. Each row matches the specific sentence its rule emits, never merely "the
//       run was red" — a row that accepts any failure would be certified by a stale pin or a missing
//       member while the rule it names never executed.
//   (c) NON-VACUITY, TWICE OVER. buildPacket already refuses a mutation that reproduces the bytes on
//       disk. On top of that, every anchor below is asserted UNIQUE before it is replaced (a drifted
//       anchor would otherwise yield the unmutated document), and every row parses its own mutated
//       document and asserts the SHAPE it means to present (anyOf rather than oneOf, a third branch,
//       no paths at all, …). A row proves its rule only if the document really carries the defect.
//
// Rows that touch the byte-frozen accepted PREDECESSOR re-pin upstream_pins.accepted to the bytes
// they actually write (buildPacket re-pins ownership.current_owner from the same bytes, so both pin
// sites still agree). Without that, every such row would ALSO report an upstream SHA-256 mismatch
// and could not distinguish its own rule from that noise — the byte-frozen-upstream rule keeps its
// dedicated proofs in 8.6. The ONE exception is the unreadable-predecessor row: bytes that cannot be
// parsed cannot be pinned as reviewed accepted bytes either, so its upstream mismatch is a
// CONSEQUENCE of the row, not masking noise, and the row still asserts the §6b sentence exactly.
const PRED_IN_CONTRACTS = 'openapi/cybrik-ai-inference-plane.v1.openapi.yaml';
const SUCCESSOR_IN_CONTRACTS = 'openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml';

// Documents whose PARSE outcome is the point of the row.
const UNPARSEABLE_YAML = 'openapi: 3.1.1\ninfo: {title: unterminated flow map\n';
const NULL_YAML = '# comment-only: parses to null, which is not an OpenAPI document object\n';
const SCALAR_YAML = 'not an OpenAPI document, only a scalar\n';

// The successor declares its 422/503 error surface ONCE, as the YAML anchor
// `InferenceOrTransportError: &inferenceOrTransportError`, aliased by every bound status. These are
// the two mutable sub-anchors inside it: the media type it binds, and the oneOf branch list.
const ERROR_SURFACE_MEDIA = [
  '    InferenceOrTransportError: &inferenceOrTransportError',
  '      content:',
  '        application/json:',
  '',
].join('\n');
const TRANSPORT_BRANCH = "              - $ref: '../json-schema/cybrik.transport-authorization-error.v1.schema.json'\n";
const ACCEPTED_BRANCH = "              - $ref: '../json-schema/cybrik.model-inference-error.v1.schema.json'\n";
const ERROR_SURFACE_ONEOF = `            oneOf:\n${TRANSPORT_BRANCH}${ACCEPTED_BRANCH}`;
// The accepted NON-error-surface status the drop-a-status row removes (GET /api/v1/model-classes).
const LIST_200_BLOCK = [
  '      responses:',
  "        '200':",
  '          description: Capability descriptors.',
  '          content:',
  '            application/json:',
  '              schema:',
  '                type: array',
  '                items:',
  "                  $ref: '#/components/schemas/ModelCapability'",
  "        '401': *unauthenticated",
  '',
].join('\n');
// The accepted predecessor binds its 422/503 through this one component reference; re-pointing it
// is how a row makes the ModelInferenceError-status derivation come back empty.
const PRED_ERROR_REF = "$ref: '#/components/schemas/ModelInferenceError'";

test('every §6b/§7 mutation anchor occurs exactly once in the document it mutates', () => {
  for (const [what, text, anchor] of [
    ['successor error-surface media type', successorText, ERROR_SURFACE_MEDIA],
    ['successor error-surface oneOf', successorText, ERROR_SURFACE_ONEOF],
    ['successor GET /api/v1/model-classes 200 block', successorText, LIST_200_BLOCK],
    ['predecessor error-response component reference', predecessorText, PRED_ERROR_REF],
    ['predecessor paths block', predecessorText, '\npaths:\n'],
    ['predecessor accepted status line', predecessorText, '\n  x-cybrik-status: ACCEPTED FOR IMPLEMENTATION\n'],
  ]) {
    assert.equal(countOf(text, anchor), 1, `${what}: the mutation anchor is not unique — a replace() against it would silently rewrite the wrong site or nothing at all, and every row built on it would prove nothing. Re-derive the anchor; never loosen it.`);
  }
});

// Replace an anchor that has already been proven unique in THIS text (the temp copy is a faithful
// copy, so the module-level uniqueness test covers it), using a function replacement so a '$' in the
// body is never read as a replacement pattern.
const replaceOnce = (text, anchor, body, what) => {
  assert.equal(countOf(text, anchor), 1, `${what}: anchor absent/ambiguous in the document under mutation`);
  return text.replace(anchor, () => body);
};

// The 422 response object of POST /api/v1/inferences, after YAML alias expansion — i.e. the error
// surface every bound status shares.
const errorSurfaceOf = (doc) => doc.paths['/api/v1/inferences'].post.responses['422'];
const jsonSchemaOfResponse = (response) => response.content?.['application/json']?.schema;

// A row that mutates the SUCCESSOR: prove the mutated document carries the intended defect, then
// prove the validator rejects it with that rule's own sentence.
const successorRow = ({ id, title, why, mutate, shape, match }) => ({
  id,
  title,
  why,
  match,
  guard: () => {
    const text = mutate(successorText);
    assert.notEqual(text, successorText, `${id}: the successor mutation was a NO-OP`);
    const doc = YAML.parse(text);
    shape(errorSurfaceOf(doc), doc);
  },
  packet: () => buildPacket({ successor: mutate }),
});

// A row that rewrites the accepted PREDECESSOR, keeping both upstream pin sites truthful.
const predecessorPacket = (bytes, opts = {}) => buildPacket({
  ...opts,
  writeContracts: { [PRED_IN_CONTRACTS]: bytes, ...(opts.writeContracts || {}) },
  delta: (c) => {
    const pin = (c.upstream_pins?.accepted || []).find((p) => p.file === PRED_IN_CONTRACTS);
    assert.ok(pin, 'the delta must pin the accepted predecessor in upstream_pins.accepted');
    pin.sha256 = sha256(bytes);
    opts.delta?.(c);
  },
});

const RESPONSE_BINDING_ROWS = [
  {
    id: 'RB-1',
    title: 'an unreadable accepted predecessor is a rejection, never a skip',
    why: 'with no parseable accepted floor, response preservation is UNEVALUABLE — and unevaluable ' +
      'must fail closed, not be skipped as "nothing to compare"',
    match: /response-binding preservation: the ACCEPTED predecessor openapi\/cybrik-ai-inference-plane\.v1\.openapi\.yaml cannot be read\/parsed/,
    guard: () => {
      assert.throws(() => YAML.parse(UNPARSEABLE_YAML), 'the row must leave bytes YAML.parse actually rejects, or it proves nothing about the unreadable-predecessor path');
    },
    // LATE write: the bytes land after every re-pin, so the predecessor is unparseable at validation
    // time at a path the re-pin step reads.
    packet: () => buildPacket({ writeContractsLate: { [PRED_IN_CONTRACTS]: UNPARSEABLE_YAML } }),
  },
  {
    id: 'RB-2',
    title: 'an accepted predecessor binding NO ModelInferenceError status is a rejection',
    why: 'the 422/503 oneOf rule derives WHICH statuses carry the accepted error shape from the ' +
      'predecessor bytes; if that derivation comes back empty the rule is vacuous and must fail ' +
      'closed rather than assume 422/503',
    match: /response-binding preservation: no status of the ACCEPTED predecessor openapi\/cybrik-ai-inference-plane\.v1\.openapi\.yaml resolves to cybrik\.model-inference-error\.v1\.schema\.json/,
    guard: () => {
      const bytes = replaceOnce(predecessorText, PRED_ERROR_REF, "$ref: '#/components/schemas/ModelHealth'", 'RB-2');
      const doc = YAML.parse(bytes);
      assert.equal(doc.components.responses.InferenceError.content['application/json'].schema.$ref, '#/components/schemas/ModelHealth');
      assert.doesNotMatch(JSON.stringify(doc.components.responses), /model-inference-error/, 'no predecessor response may still resolve to the accepted error shape, or the derivation is not empty and the row tests nothing');
      assert.equal(Object.keys(doc.paths).length, 4, 'the predecessor must still declare its four operations — only the error-shape derivation may change');
    },
    packet: () => predecessorPacket(replaceOnce(predecessorText, PRED_ERROR_REF, "$ref: '#/components/schemas/ModelHealth'", 'RB-2')),
  },
  {
    id: 'RB-3',
    title: 'a successor that drops an accepted NON-error status is rejected',
    why: 'a compatible successor revision may ADD statuses, never remove one the ACCEPTED plane binds',
    match: /response-binding preservation: GET \/api\/v1\/model-classes drops the accepted predecessor response status 200/,
    guard: () => {
      const text = replaceOnce(successorText, LIST_200_BLOCK, "      responses:\n        '401': *unauthenticated\n", 'RB-3');
      const doc = YAML.parse(text);
      assert.equal(doc.paths['/api/v1/model-classes'].get.responses['200'], undefined, 'the successor must really have lost the 200');
      assert.ok(predecessor.paths['/api/v1/model-classes'].get.responses['200'], 'the accepted predecessor must bind that 200, or nothing was dropped');
      assert.ok(doc.paths['/api/v1/model-classes'].get.responses['503'], 'only the 200 may be dropped — the row must not also remove the error surface');
    },
    packet: () => buildPacket({ successor: (t) => replaceOnce(t, LIST_200_BLOCK, "      responses:\n        '401': *unauthenticated\n", 'RB-3') }),
  },
  successorRow({
    id: 'RB-4',
    title: 'an accepted-error status binding no resolvable application/json schema is rejected',
    why: 'a status whose JSON binding cannot be resolved cannot be SHOWN to retain the accepted ' +
      'ModelInferenceError branch, and unshowable is not preserved',
    match: /response-binding preservation: POST \/api\/v1\/inferences response 422 binds no resolvable application\/json schema/,
    mutate: (t) => replaceOnce(t, ERROR_SURFACE_MEDIA, ERROR_SURFACE_MEDIA.replace('application/json:', 'application/problem+json:'), 'RB-4'),
    shape: (response) => {
      assert.equal(response.content['application/json'], undefined, 'the error surface must no longer bind application/json');
      assert.ok(Array.isArray(response.content['application/problem+json'].schema.oneOf), 'the two-branch oneOf must survive under the other media type, so ONLY resolvability is under test');
    },
  }),
  successorRow({
    id: 'RB-5',
    title: 'replacing the oneOf with anyOf is rejected',
    why: 'anyOf admits a value matching BOTH branches; the accepted surface is an exclusive choice, ' +
      'and re-composing it changes which shapes the response admits',
    match: /must bind a oneOf of the two typed error branches, but binds anyOf/,
    mutate: (t) => replaceOnce(t, ERROR_SURFACE_ONEOF, ERROR_SURFACE_ONEOF.replace('oneOf:', 'anyOf:'), 'RB-5'),
    shape: (response) => {
      const schema = jsonSchemaOfResponse(response);
      assert.ok(Array.isArray(schema.anyOf) && schema.anyOf.length === 2, 'the surface must present a two-branch anyOf');
      assert.equal(schema.oneOf, undefined, 'no oneOf may survive, or the row does not exercise the re-composition path');
    },
  }),
  successorRow({
    id: 'RB-6',
    title: 'replacing the oneOf with allOf is rejected',
    why: 'allOf requires BOTH shapes at once, which no typed error response can satisfy — a ' +
      'collapsed composition is not the accepted surface',
    match: /must bind a oneOf of the two typed error branches, but binds allOf/,
    mutate: (t) => replaceOnce(t, ERROR_SURFACE_ONEOF, ERROR_SURFACE_ONEOF.replace('oneOf:', 'allOf:'), 'RB-6'),
    shape: (response) => {
      const schema = jsonSchemaOfResponse(response);
      assert.ok(Array.isArray(schema.allOf) && schema.allOf.length === 2, 'the surface must present a two-branch allOf');
      assert.equal(schema.oneOf, undefined, 'no oneOf may survive');
    },
  }),
  successorRow({
    id: 'RB-7',
    title: 'collapsing the oneOf to a single non-composed shape is rejected',
    why: 'a single-shape binding silently narrows the accepted surface to one error vocabulary — ' +
      'exactly the regression §6b exists to catch, expressed as a collapse instead of a deletion',
    match: /must bind a oneOf of the two typed error branches, but binds a single non-composed shape/,
    mutate: (t) => replaceOnce(t, ERROR_SURFACE_ONEOF, `            ${TRANSPORT_BRANCH.trim().replace(/^- /, '')}\n`, 'RB-7'),
    shape: (response) => {
      const schema = jsonSchemaOfResponse(response);
      assert.equal(typeof schema.$ref, 'string', 'the surface must bind one plain $ref');
      for (const kw of ['oneOf', 'anyOf', 'allOf']) assert.equal(schema[kw], undefined, `${kw} must be absent, or this is not the single-shape path`);
    },
  }),
  successorRow({
    id: 'RB-8',
    title: 'a duplicated oneOf branch is rejected',
    why: 'a duplicated branch pads the branch set the accepted surface pins; the rule is EXACTLY ' +
      'two branches, counted with multiplicity, not "at least these two"',
    match: /DUPLICATED branch/,
    mutate: (t) => replaceOnce(t, ERROR_SURFACE_ONEOF, ERROR_SURFACE_ONEOF + ACCEPTED_BRANCH, 'RB-8'),
    shape: (response) => {
      const schema = jsonSchemaOfResponse(response);
      assert.equal(schema.oneOf.length, 3, 'the surface must present three branches');
      assert.equal(new Set(schema.oneOf.map((b) => b.$ref)).size, 2, 'exactly one branch must be a duplicate — no branch may be missing or unexpected, so DUPLICATED is what the row proves');
    },
  }),
  successorRow({
    id: 'RB-9',
    title: 'an unexpected third oneOf branch is rejected',
    why: 'widening the branch set admits a shape the ACCEPTED plane never promised, which a ' +
      'compatible successor revision may not do',
    match: /UNEXPECTED cybrik\.transport-common-defs\.v1\.schema\.json/,
    mutate: (t) => replaceOnce(t, ERROR_SURFACE_ONEOF, `${ERROR_SURFACE_ONEOF}              - $ref: '../json-schema/cybrik.transport-common-defs.v1.schema.json'\n`, 'RB-9'),
    shape: (response) => {
      const schema = jsonSchemaOfResponse(response);
      assert.equal(schema.oneOf.length, 3, 'the surface must present three branches');
      assert.equal(new Set(schema.oneOf.map((b) => b.$ref)).size, 3, 'all three branches must be distinct, so UNEXPECTED — not DUPLICATED — is what the row proves');
    },
  }),
  successorRow({
    id: 'RB-10',
    title: 'an unresolvable oneOf branch is rejected',
    why: 'a branch naming a component the document does not define binds NO shape; an unresolvable ' +
      'branch cannot be the retained accepted one, so it fails closed rather than being ignored',
    match: /UNRESOLVABLE/,
    mutate: (t) => replaceOnce(t, ERROR_SURFACE_ONEOF, `            oneOf:\n${TRANSPORT_BRANCH}              - $ref: '#/components/schemas/NoSuchErrorShape'\n`, 'RB-10'),
    shape: (response, doc) => {
      const schema = jsonSchemaOfResponse(response);
      assert.equal(schema.oneOf.length, 2, 'the surface must still present two branches — only their resolvability is under test');
      assert.equal(schema.oneOf[1].$ref, '#/components/schemas/NoSuchErrorShape');
      assert.equal(doc.components.schemas.NoSuchErrorShape, undefined, 'the named component must genuinely not exist, or the branch resolves and the row proves nothing');
    },
  }),
];

for (const row of RESPONSE_BINDING_ROWS) {
  test(`${row.id}: ${row.title}`, () => {
    row.guard();
    // allowSuccessorPinDrift stays FALSE explicitly: every successor row above relies on
    // buildPacket's atomic two-site re-pin (candidate_members AND ownership.proposed_successor). If
    // that re-pin regressed, the run would go red on §3c pin disagreement BEFORE reaching §6b and
    // the row would be a vacuous green. expectFail asserts that sentence is absent from the output.
    expectFail(row.packet(), row.why, row.match, { allowSuccessorPinDrift: false });
  });
}

const OWNERSHIP_SWEEP_ROWS = [
  {
    id: 'SW-1',
    title: 'a discovered OpenAPI document that cannot be parsed is rejected, never skipped',
    why: 'an unparseable document may be declaring the very same owned pairs and we would never ' +
      'know — the sweep is name-blind, so it cannot dismiss a document it failed to read',
    match: /OpenAPI ownership sweep: openapi\/cybrik-w2i-unparseable\.openapi\.yaml could not be parsed/,
    guard: () => { assert.throws(() => YAML.parse(UNPARSEABLE_YAML), 'the row must write bytes YAML.parse actually rejects'); },
    packet: () => buildPacket({ writeContracts: { 'openapi/cybrik-w2i-unparseable.openapi.yaml': UNPARSEABLE_YAML } }),
  },
  {
    id: 'SW-2',
    title: 'a discovered OpenAPI document that parses to null is rejected',
    why: 'a document that yields no object declares UNKNOWN paths; unknown is not "declares nothing"',
    match: /OpenAPI ownership sweep: openapi\/cybrik-w2i-null\.openapi\.yaml did not parse to an OpenAPI document object/,
    guard: () => { assert.equal(YAML.parse(NULL_YAML), null, 'the row must write bytes that parse to null'); },
    packet: () => buildPacket({ writeContracts: { 'openapi/cybrik-w2i-null.openapi.yaml': NULL_YAML } }),
  },
  {
    id: 'SW-3',
    title: 'a discovered OpenAPI document that parses to a non-object scalar is rejected',
    why: 'the same fail-closed stance must hold for a document that parses SUCCESSFULLY into ' +
      'something that is not an OpenAPI document at all',
    match: /OpenAPI ownership sweep: openapi\/cybrik-w2i-scalar\.openapi\.yaml did not parse to an OpenAPI document object/,
    guard: () => { assert.equal(typeof YAML.parse(SCALAR_YAML), 'string', 'the row must write bytes that parse to a scalar, not to null — the null case is SW-2'); },
    packet: () => buildPacket({ writeContracts: { 'openapi/cybrik-w2i-scalar.openapi.yaml': SCALAR_YAML } }),
  },
  {
    id: 'SW-4',
    title: 'an accepted predecessor declaring zero (method, path) pairs is rejected',
    why: 'the owned inference surface IS whatever the accepted predecessor declares; if it declares ' +
      'nothing, single ownership cannot be proven and the sweep must fail closed instead of ' +
      'sweeping an empty pair set to green',
    match: /OpenAPI ownership sweep: the accepted predecessor openapi\/cybrik-ai-inference-plane\.v1\.openapi\.yaml declares no \(method, path\) pair on disk/,
    guard: () => {
      const doc = YAML.parse(PATHLESS_PREDECESSOR);
      assert.deepEqual(Object.keys(doc.paths || {}), [], 'the rewritten predecessor must declare no path at all');
      assert.equal(doc.info['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION', 'it must still classify as the CURRENT/ACCEPTED document — only its pair set may change');
    },
    packet: () => predecessorPacket(PATHLESS_PREDECESSOR),
  },
  {
    id: 'SW-5',
    title: 'a CURRENT owner that is not the accepted predecessor is rejected',
    why: 'the accepted predecessor is the SOLE CURRENT owner until a recorded Gate W2-I flip; a ' +
      'different document holding that role — whatever its filename — is an unrecorded flip',
    match: /OpenAPI ownership sweep: GET \/api\/v1\/model-classes names 'openapi\/cybrik-ai-inference-plane\.v1\.rogue-current\.openapi\.yaml' as its CURRENT owner, but the accepted predecessor/,
    guard: () => {
      const demoted = YAML.parse(DEMOTED_PREDECESSOR);
      assert.equal(demoted.info['x-cybrik-status'], 'PROPOSED', 'the predecessor must no longer classify as CURRENT/ACCEPTED');
      assert.equal(demoted.info['x-cybrik-lifecycle-role'], undefined, 'nor may it claim the CURRENT role by the other half of the disjunction');
      assert.equal(Object.keys(demoted.paths).length, 4, 'it must still DECLARE the four owned pairs, or there is no owned pair set to judge');
      const rogue = YAML.parse(predecessorText);
      assert.equal(rogue.info['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION', 'the rogue clone must classify as the single CURRENT owner');
    },
    // The rogue clone takes the CURRENT role for the four pairs while the predecessor keeps
    // declaring them as a non-CURRENT document. The run ALSO reports two proposed successors (the
    // demoted predecessor is now classified as one) — a true consequence of this arrangement, which
    // is why the row matches the CURRENT-owner sentence and not merely "the run was red".
    packet: () => predecessorPacket(DEMOTED_PREDECESSOR, {
      writeContracts: { 'openapi/cybrik-ai-inference-plane.v1.rogue-current.openapi.yaml': predecessorText },
    }),
  },
  {
    id: 'SW-6',
    title: 'a CURRENT owner disagreeing with the delta-pinned current owner is rejected',
    why: 'the sweep and the delta must name the SAME current owner; a delta pinning some other file ' +
      'records an ownership claim the documents on disk do not support',
    match: /OpenAPI ownership sweep: GET \/api\/v1\/model-classes CURRENT owner 'openapi\/cybrik-ai-inference-plane\.v1\.openapi\.yaml' is not the CURRENT owner the delta pins \('openapi\/cybrik-ai-inference-plane\.v1\.not-the-predecessor\.openapi\.yaml'\)/,
    guard: () => {
      assert.equal(existsSync(join(CONTRACTS, 'openapi', 'cybrik-ai-inference-plane.v1.not-the-predecessor.openapi.yaml')), false, 'the pinned-but-wrong current owner must NOT exist on disk, so buildPacket leaves its digest untouched and the two ownership pin sites still agree');
    },
    packet: () => buildPacket({ delta: (c) => { c.ownership.current_owner.file = 'openapi/cybrik-ai-inference-plane.v1.not-the-predecessor.openapi.yaml'; } }),
  },
  {
    id: 'SW-7',
    title: 'a proposed successor that is not the delta-linked one is rejected',
    why: 'a successor owning accepted paths with no delta recording the proposal is an unlinked ' +
      'second owner by another name',
    match: /OpenAPI ownership sweep: GET \/api\/v1\/model-classes PROPOSED successor 'openapi\/cybrik-ai-inference-plane\.v1\.contract-0\.2\.0\.openapi\.yaml' is not the delta-linked successor 'openapi\/cybrik-ai-inference-plane\.v1\.unlinked-successor\.openapi\.yaml'/,
    guard: () => {
      assert.equal(existsSync(join(CONTRACTS, 'openapi', 'cybrik-ai-inference-plane.v1.unlinked-successor.openapi.yaml')), false, 'the pinned-but-wrong successor must NOT exist on disk, so ownership.proposed_successor keeps the digest candidate_members pins and this row cannot pass on pin drift');
      assert.equal(delta.ownership.proposed_successor.file, SUCCESSOR_IN_CONTRACTS, 'the candidate really does link this successor, so re-pointing the link is a genuine mutation');
    },
    packet: () => buildPacket({ delta: (c) => { c.ownership.proposed_successor.file = 'openapi/cybrik-ai-inference-plane.v1.unlinked-successor.openapi.yaml'; } }),
  },
  {
    id: 'SW-8',
    title: 'a missing contracts/openapi directory is rejected',
    why: 'with no OpenAPI documents on disk at all, single ownership of the four inference ' +
      'operations is unevaluable — the sweep must fail closed rather than sweep zero documents to green',
    match: /OpenAPI ownership sweep: contracts\/openapi is missing, so single ownership of the four inference operations cannot be evaluated/,
    guard: () => {
      assert.ok(existsSync(join(CONTRACTS, 'openapi')), 'contracts/openapi must exist in the candidate, or removing it is not a mutation');
    },
    // Removing the directory is safe HERE only because buildPacket's re-pin step guards every
    // digest site with existsSync and never parses these documents, so the packet still materialises
    // and the validator is genuinely reached. Every other rule that reads an OpenAPI document also
    // reports (the successor member is gone, the upstream pin has no file); the row matches the
    // sweep's own sentence, which no other rule emits.
    packet: () => buildPacket({ removeContracts: ['openapi'] }),
  },
];

// Predecessor variants used by the sweep rows above (declared here so the rows read as one table).
const PATHLESS_PREDECESSOR = predecessorText.replace(/\npaths:\n[\s\S]*$/, '\npaths: {}\n');
const DEMOTED_PREDECESSOR = replaceOnce(
  predecessorText,
  '\n  x-cybrik-status: ACCEPTED FOR IMPLEMENTATION\n',
  '\n  x-cybrik-status: PROPOSED\n',
  'SW-5',
);

for (const row of OWNERSHIP_SWEEP_ROWS) {
  test(`${row.id}: ${row.title}`, () => {
    row.guard();
    expectFail(row.packet(), row.why, row.match, { allowSuccessorPinDrift: false });
  });
}

// --- 8.11 residual fail-closed paths (lifecycle, schema load, fixture kinds, digests) ---------
//
// Sections 8.0–8.10 drive the headline rejections. The table below drives the REMAINING non-CLI
// rejection paths of validate-transport.mjs — the ones a reader would otherwise take on trust: an
// unsupported delta lifecycle token, a transport schema that cannot be compiled at all, each of the
// four fixture-kind verdicts (a positive that does not validate, a negative-schema that does, a
// negative-semantic that is structurally broken, an unknown kind), the accepted-lifecycle acceptance
// metadata branch, the two malformed-digest paths, an unparseable ACCEPTED W2-D manifest, the TT-4
// unavailability path, and a negative-semantic fixture no runtime invariant rejects any more.
//
// The three properties of section 8.10 hold here too, and none is optional:
//   (a) IN-PROCESS. Every row runs through buildPacket's runValidation path, so
//       `node --test --experimental-test-coverage` instruments the branch it drives. A spawned row
//       would be invisible to the coverage gate in 8.9.
//   (b) EXACT DIAGNOSTIC. Every row matches the specific sentence its rule emits, never merely "the
//       run was red" — a row that accepted any failure would be certified by unrelated noise while
//       the rule it names never executed.
//   (c) NON-VACUITY. buildPacket already refuses a mutation that reproduces the bytes on disk; on top
//       of that each row asserts the PRE-mutation state it depends on (the field really carries the
//       honest value, the fixture really is indexed with that kind/invariant, the ref target really
//       is absent), so a drifted anchor fails loudly instead of certifying a mutation that never
//       presented the defect.

const ERROR_SCHEMA_REL = 'json-schema/cybrik.transport-authorization-error.v1.schema.json';
const ERROR_SCHEMA_TEXT = read(`contracts/${ERROR_SCHEMA_REL}`);
const DANGLING_POINTER = '#/$defs/thisFragmentIsNotDefinedAnywhere';

// A transport schema whose one $ref target does not exist. addSchema still accepts it (Ajv resolves
// nothing there); the compile/getSchema step in validator section 1 is where it throws.
const DANGLING_ERROR_SCHEMA = (() => {
  const s = JSON.parse(ERROR_SCHEMA_TEXT);
  s.properties.detail = { $ref: DANGLING_POINTER };
  return `${JSON.stringify(s, null, 2)}\n`;
})();

// The canonical POSITIVE presentation re-issued under a fresh binding/jti/idempotency triple: still
// structurally valid, still internally consistent, so NO runtime invariant rejects it — including
// TX-7, whose predicate needs the canonical (jti, idempotency_key) pair.
const UNREJECTED_SEMANTIC = derive(CANON_POST, (d) => {
  d.binding_id = 'itb-inf-9999-unrejected';
  d.idempotency_key = ['idem-inf', '9999-unrejected01'].join('-');
  d.presented_token.claims.jti = 'jti-soc-9999888877776666';
});

const AUDIENCE_MISMATCH_REL = 'negative/inference-transport-binding.audience-mismatch.json';
const POP_MISMATCH_REL = 'negative/inference-transport-binding.pop-mismatch.json';
const BAD_STATUS_REL = 'negative/transport-authorization-error.bad-status.json';
const POSITIVE_ERROR_REL = 'positive/transport-authorization-error.json';
const W2D_MANIFEST_IN_CONTRACTS = 'compatibility/cybrik-suite-inference-packet.v1.manifest.json';
const UNPARSEABLE_JSON = '{ "x-cybrik-status": "ACCEPTED FOR IMPLEMENTATION",\n';

const manifestEntry = (file) => {
  const em = JSON.parse(examplesManifestText);
  const ex = (em.examples || []).find((e) => e.file === file);
  assert.ok(ex, `the examples manifest must index ${file}, or the row that mutates it proves nothing`);
  return ex;
};

const RESIDUAL_ROWS = [
  {
    id: 'RS-1',
    title: 'an unsupported delta x-cybrik-status is rejected (only two truthful states exist)',
    why: 'the delta is the single source of truth for the candidate lifecycle; a token outside ' +
      "{PROPOSED, ACCEPTED FOR IMPLEMENTATION} — a stable v1/GA claim above all — must be rejected, " +
      'never silently adopted as the candidate-wide state',
    match: /W2-I proposed delta: x-cybrik-status must be one of 'PROPOSED' \| 'ACCEPTED FOR IMPLEMENTATION' \(got 'GA'\)/,
    guard: () => {
      assert.equal(delta['x-cybrik-status'], 'PROPOSED', 'the delta must really declare a supported lifecycle token today, or replacing it is not a mutation');
    },
    packet: () => buildPacket({ delta: (c) => { c['x-cybrik-status'] = 'GA'; } }),
  },
  {
    id: 'RS-2',
    title: 'a transport schema with a dangling $ref is rejected at compile/ref-resolution',
    why: 'compiling every transport schema is what proves each cross-file $ref/$defs fragment ' +
      'actually resolves; a schema that cannot be compiled must be reported as such, not skipped ' +
      'into a run where its fixtures simply find "no compiled validator"',
    match: /json-schema\/cybrik\.transport-authorization-error\.v1\.schema\.json: compile\/ref-resolution failed:/,
    guard: () => {
      assert.equal(ERROR_SCHEMA_TEXT.includes(DANGLING_POINTER), false, 'the dangling pointer must be absent from the accepted-shape schema, or the row asserts nothing new');
      assert.equal(JSON.parse(DANGLING_ERROR_SCHEMA).properties.detail.$ref, DANGLING_POINTER, 'the mutated schema must really carry the unresolvable $ref');
      assert.equal(JSON.parse(DANGLING_ERROR_SCHEMA).$defs, undefined, 'the mutated schema must define no $defs at all, so the pointer really cannot resolve');
    },
    packet: () => buildPacket({ writeContracts: { [ERROR_SCHEMA_REL]: DANGLING_ERROR_SCHEMA } }),
  },
  {
    id: 'RS-3',
    title: 'a POSITIVE fixture that no longer validates is rejected',
    why: 'a positive fixture is the witness that the schema ADMITS the shape the packet claims to ' +
      'support; if it stops validating the packet is asserting a shape its own schema rejects',
    match: /positive example positive\/inference-transport-binding\.json FAILED validation against cybrik\.inference-transport-binding\.v1\.schema\.json/,
    guard: () => {
      assert.equal(manifestEntry(CANON_POST).kind, 'positive', 'the canonical create presentation must be indexed as a positive');
      assert.equal(fixture(CANON_POST).transport.mutual_tls, true, 'the canonical positive must present mutual_tls=true, or flipping it is not a mutation');
    },
    packet: () => buildPacket({ writeFixtures: { [CANON_POST]: derive(CANON_POST, (d) => { d.transport.mutual_tls = false; }) } }),
  },
  {
    id: 'RS-4',
    title: 'a NEGATIVE-SCHEMA fixture that unexpectedly validates is rejected',
    why: 'a negative-schema fixture exists to prove a structural rule actually FIRES; a fixture the ' +
      'schema accepts proves the opposite and must never be counted as a rejection',
    match: /negative-schema example negative\/transport-authorization-error\.bad-status\.json unexpectedly VALIDATED against cybrik\.transport-authorization-error\.v1\.schema\.json \(must be rejected\)/,
    guard: () => {
      const ex = manifestEntry(BAD_STATUS_REL);
      assert.equal(ex.kind, 'negative-schema', 'the row must replace a fixture the manifest still declares negative-schema');
      assert.match(ex.invariant, /^TT-8\b/, 'the entry must keep DECLARING its structural rule, so the unexpected-pass path is what fires and not the missing-declaration path');
      assert.equal(fixture(BAD_STATUS_REL).status, 500, 'the bad-status fixture must really carry the out-of-enum status today');
      assert.notEqual(fixture(POSITIVE_ERROR_REL).status, 500, 'the replacement must be a presentation the schema ACCEPTS, or the row cannot reach the unexpected-pass path');
    },
    packet: () => buildPacket({ writeFixtures: { [BAD_STATUS_REL]: fixture(POSITIVE_ERROR_REL) } }),
  },
  {
    id: 'RS-5',
    title: 'a NEGATIVE-SEMANTIC fixture that is structurally invalid is rejected',
    why: 'a negative-semantic fixture must be rejected by a RELYING-PARTY invariant a schema cannot ' +
      'express; if the schema already rejects it, it witnesses TT-* and proves nothing about its ' +
      'declared TX-* rule',
    match: /negative-semantic example negative\/inference-transport-binding\.pop-mismatch\.json failed STRUCTURAL validation \(must be structurally valid; only a runtime invariant rejects it\)/,
    guard: () => {
      const ex = manifestEntry(POP_MISMATCH_REL);
      assert.equal(ex.kind, 'negative-semantic', 'the row must break a fixture the manifest still declares negative-semantic');
      assert.match(ex.invariant, /^TX-1\b/, 'the entry must keep DECLARING its runtime rule, so the structural-invalidity path is what fires');
      assert.equal(fixture(POP_MISMATCH_REL).transport.mutual_tls, true, 'the fixture must be structurally valid today, or the row is not a mutation');
    },
    packet: () => buildPacket({ writeFixtures: { [POP_MISMATCH_REL]: derive(POP_MISMATCH_REL, (d) => { d.transport.mutual_tls = false; }) } }),
  },
  {
    id: 'RS-6',
    title: 'an examples-manifest entry with an unknown kind is rejected, never ignored',
    why: 'the manifest drives which verdict each fixture must produce; an unrecognised kind is a ' +
      'fixture with NO declared verdict, and silently ignoring it would drop a support fixture out ' +
      'of the evidence set while the inventory still counts it',
    match: /example positive\/inference-transport-binding\.json: unknown kind 'exploratory'/,
    guard: () => {
      assert.equal(manifestEntry(CANON_POST).kind, 'positive', 'the entry must carry a recognised kind today, or re-labelling it is not a mutation');
    },
    packet: () => buildPacket({
      examples: (em) => { em.examples.find((e) => e.file === CANON_POST).kind = 'exploratory'; },
    }),
  },
  {
    id: 'RS-7',
    title: 'a delta that keeps its PROPOSED status but denies being unaccepted is rejected',
    why: 'a proposed-delta is PROPOSED / not-accepted BY CONSTRUCTION — it records a proposal and can ' +
      'never be the record of its own acceptance, so a half-flipped self-declaration must fail',
    match: /W2-I delta: a proposed-delta is PROPOSED \/ not-accepted by construction/,
    guard: () => {
      assert.equal(delta['x-cybrik-not-accepted'], true, 'the delta must really declare itself not-accepted today');
    },
    packet: () => buildPacket({ delta: (c) => { c['x-cybrik-not-accepted'] = false; } }),
  },
  {
    id: 'RS-9',
    title: 'a candidate member whose sha256 is not a 64-hex digest is rejected',
    why: 'an unparseable digest is not a weaker pin, it is NO pin — the member bytes would be ' +
      'unverified while the delta still claims to bind them',
    match: /transport manifest: member json-schema\/cybrik\.transport-common-defs\.v1\.schema\.json sha256 missing\/not a 64-hex digest/,
    guard: () => {
      const m = delta.candidate_members.find((x) => x.file === 'json-schema/cybrik.transport-common-defs.v1.schema.json');
      assert.ok(m, 'transport-common-defs must be a candidate member');
      assert.match(m.sha256, /^[0-9a-f]{64}$/, 'it must carry a well-formed digest today, or malforming it is not a mutation');
      assert.notEqual(delta.candidate_members[0].file, m.file, 'the row must NOT malform the successor digest, whose two-site disagreement would mask this rule');
    },
    // AFTER the re-pin: opts.delta runs before it, so a malformed digest set there would simply be
    // overwritten with a well-formed one and the row would prove nothing.
    packet: () => buildPacket({
      deltaAfterRepin: (c) => { c.candidate_members.find((m) => m.file === 'json-schema/cybrik.transport-common-defs.v1.schema.json').sha256 = 'not-a-64-hex-digest'; },
    }),
  },
  {
    id: 'RS-10',
    title: 'an examples_manifest_sha256 that is not a 64-hex digest is rejected',
    why: 'the pinned fixture catalog is part of the candidate bytes; an unparseable pin leaves the ' +
      'whole support-fixture inventory unbound while the delta still claims to bind it',
    match: /transport manifest: examples_manifest_sha256 missing\/not a 64-hex digest \(the examples manifest is an integrity-pinned packet artifact\)/,
    guard: () => {
      assert.match(delta.examples_manifest_sha256, /^[0-9a-f]{64}$/, 'the examples-manifest pin must be well-formed today, or malforming it is not a mutation');
    },
    packet: () => buildPacket({ deltaAfterRepin: (c) => { c.examples_manifest_sha256 = 'NOTAHEXDIGEST'; } }),
  },
  {
    id: 'RS-11',
    title: 'an ACCEPTED W2-D manifest that cannot be parsed is a D6 rejection, never a skip',
    why: 'D6 is evaluated on the accepted manifest\'s OWN BYTES, independently of the upstream digest ' +
      'pin; bytes that cannot be parsed make its freedom from candidate material UNVERIFIABLE, and ' +
      'unverifiable must fail closed rather than be skipped as "nothing to check"',
    match: /ADR-0001 D6: the accepted W2-D manifest \(compatibility\/cybrik-suite-inference-packet\.v1\.manifest\.json\) cannot be read\/parsed, so its freedom from candidate material is UNVERIFIABLE \(fail closed, never skipped\)/,
    guard: () => {
      assert.throws(() => JSON.parse(UNPARSEABLE_JSON), 'the row must leave bytes JSON.parse actually rejects, or it proves nothing about the unparseable-manifest path');
      assert.doesNotThrow(() => JSON.parse(read(W2D_MANIFEST_REL)), 'the accepted manifest must parse today, or the row is not a mutation');
    },
    // LATE write: the bytes land after every re-pin, so the manifest is unparseable at validation
    // time. The upstream SHA-256 pin necessarily mismatches too — bytes that cannot be parsed cannot
    // be pinned as the reviewed accepted bytes either — so that mismatch is a CONSEQUENCE of the row,
    // not masking noise, and the row still matches the D6 sentence exactly. No other rule emits it.
    packet: () => buildPacket({ writeContractsLate: { [W2D_MANIFEST_IN_CONTRACTS]: UNPARSEABLE_JSON } }),
  },
  {
    id: 'RS-12',
    title: 'TT-4 with no canonical presentation available fails closed rather than skipping',
    why: 'the TT-4 conditional cases no on-disk fixture can express are derived IN MEMORY from the ' +
      'canonical presentations; if the compiled validator or either canonical presentation is ' +
      'unavailable the conditional was never exercised, and a silent skip would leave TT-4 vacuous ' +
      'while the run stayed green on it',
    match: /TT-4 non-vacuity: the compiled binding validator or a canonical positive presentation is unavailable, so the TT-4 conditional could not be exercised \(fail closed rather than skip\)/,
    guard: () => {
      assert.equal(manifestEntry(CANON_GET).kind, 'positive', 'the canonical safe-read presentation must be an indexed positive today');
      assert.ok(existsSync(join(CONTRACTS, 'examples', 'transport', CANON_GET)), 'it must be on disk, or removing it is not a mutation');
    },
    packet: () => buildPacket({
      examples: (em) => { em.examples = em.examples.filter((e) => e.file !== CANON_GET); },
      removeContracts: [`examples/transport/${CANON_GET}`],
    }),
  },
];

for (const row of RESIDUAL_ROWS) {
  test(`${row.id}: ${row.title}`, () => {
    row.guard();
    expectFail(row.packet(), row.why, row.match);
  });
}

// RS-8 is a table row with MORE than one intended diagnostic, so it is written out longhand: entering
// the ACCEPTED-lifecycle branch must report EVERY piece of acceptance metadata the flip did not
// record. Asserting only the first would let the rest of the branch rot unnoticed.
test('RS-8: an ACCEPTED-lifecycle candidate with no acceptance metadata reports every missing record', () => {
  assert.equal(delta['x-cybrik-status'], 'PROPOSED', 'the candidate must be PROPOSED today, or flipping it is not a mutation');
  assert.equal(delta.acceptance.status, 'NOT ACCEPTED — PROPOSED only', 'the acceptance record must still be the honest PROPOSED one');
  assert.deepEqual(delta.acceptance.evidence, [], 'the acceptance record must carry no evidence yet');
  for (const k of ['gate', 'decided_by', 'decided_on']) {
    assert.equal(k in delta.acceptance, false, `acceptance.${k} must be ABSENT today — the row proves the ACCEPTED branch DEMANDS it, so a record that already exists would make that demand vacuous`);
  }
  assert.match(delta.gate.status, /NOT OPENED/, 'Gate W2-I must still be undecided');

  // Self-consistent flip: the delta's own two lifecycle fields AND every candidate-member status move
  // together, so the run enters the ACCEPTED branch on a coherent lifecycle rather than tripping the
  // member-agreement rule first and never reaching it.
  const r = expectFail(
    buildPacket({
      delta: (c) => {
        c['x-cybrik-status'] = 'ACCEPTED FOR IMPLEMENTATION';
        c['x-cybrik-not-accepted'] = false;
        for (const m of c.candidate_members) m.status = 'ACCEPTED FOR IMPLEMENTATION';
      },
    }),
    'a candidate that declares itself ACCEPTED FOR IMPLEMENTATION while recording none of the ' +
      'acceptance metadata has flipped its own lifecycle without a decision behind it',
    /transport manifest: acceptance\.status must state ACCEPTED FOR IMPLEMENTATION/,
  );
  for (const [what, matcher] of [
    ['the stale NOT ACCEPTED wording', /transport manifest: acceptance\.status must not still say NOT ACCEPTED once accepted/],
    ['the deciding gate', /transport manifest: accepted packet must record acceptance\.gate/],
    ['the deciding authority', /transport manifest: accepted packet must record acceptance\.decided_by \(Founder-delegated; not agent-inferred\)/],
    ['the decision date', /transport manifest: accepted packet must record acceptance\.decided_on/],
    ['the acceptance evidence', /transport manifest: accepted packet must record acceptance\.evidence\[\]/],
    ['the recorded gate decision', /transport manifest: gate\.status must record the Gate W2-I decision once accepted/],
  ]) {
    assert.match(r.out, matcher, `the ACCEPTED-lifecycle branch must also report ${what}\n--- validator output ---\n${r.out}`);
  }
});

// RS-13 is longhand for the same reason: besides the diagnostic it drives, it must prove the fixture
// it writes stayed STRUCTURALLY valid and kept its declared TX-*, or the row would be reaching the
// unrejected path by breaking the fixture instead of by neutralising the invariant.
test('RS-13: a negative-semantic fixture no runtime invariant rejects any more is rejected', () => {
  const ex = manifestEntry(AUDIENCE_MISMATCH_REL);
  assert.equal(ex.kind, 'negative-semantic', 'the row must replace a fixture the manifest still declares negative-semantic');
  assert.match(ex.invariant, /^TX-2\b/, 'the entry must keep DECLARING TX-2, so the diagnostic names the rule left unexercised');
  const canon = fixture(CANON_POST);
  assert.notEqual(UNREJECTED_SEMANTIC.binding_id, canon.binding_id, 'the replacement must be a DIFFERENT presentation, not the canonical one');
  for (const [what, got, was] of [
    ['jti', UNREJECTED_SEMANTIC.presented_token.claims.jti, canon.presented_token.claims.jti],
    ['idempotency_key', UNREJECTED_SEMANTIC.idempotency_key, canon.idempotency_key],
  ]) {
    assert.notEqual(got, was, `the replacement must NOT reuse the canonical ${what}, or TX-7 replay would reject it and the row would never reach the no-rule-rejects path`);
  }

  const r = expectFail(
    buildPacket({ writeFixtures: { [AUDIENCE_MISMATCH_REL]: UNREJECTED_SEMANTIC } }),
    'a negative-semantic fixture that no runtime invariant rejects any more witnesses nothing — its ' +
      'declared TX rule is unproven, and the packet would count a vacuous witness as evidence',
    /negative-semantic example negative\/inference-transport-binding\.audience-mismatch\.json was NOT rejected by any runtime invariant \(its declared TX-2 invariant is not enforced\/exercised\)/,
  );
  assert.doesNotMatch(
    r.out,
    /negative-semantic example negative\/inference-transport-binding\.audience-mismatch\.json failed STRUCTURAL validation/,
    `the replacement must stay STRUCTURALLY valid — a structurally broken fixture would reach a different rule and leave the no-rule-rejects path unproven\n--- validator output ---\n${r.out}`,
  );
});

// --- 8.12 main-guard predicate, driven directly and in-process ----------------
// Section 8.8 proves the guard end-to-end through a spawned, symlinked invocation — which is exactly
// what a coverage run CANNOT see. isMainModule is exported, so its fail-closed branches are driven
// here as a plain predicate, in-process: every unusable (metaUrl, argv1) pair returns false rather
// than throwing or guessing, and the one pair that legitimately IS a direct invocation returns true.
// The positive case matters as much as the negatives: a guard that only ever returns false would pass
// every fail-closed assertion while making the CLI permanently unreachable.
test('isMainModule fails closed on every unusable metaUrl/argv pair and still admits a real self-invocation', () => {
  const validatorAbs = join(ROOT, 'tools', 'contract-validation', 'validate-transport.mjs');
  assert.ok(existsSync(validatorAbs), 'the validator module must be on disk, or the positive case below proves nothing');
  const validatorUrl = pathToFileURL(validatorAbs).href;
  const ghost = join(ROOT, 'tools', 'contract-validation', '__no-such-module__.mjs');
  assert.equal(existsSync(ghost), false, 'the ghost path must really be absent, or the unresolvable-path cases prove nothing');
  const ghostUrl = pathToFileURL(ghost).href;

  for (const [what, got] of [
    ['a missing import.meta.url', isMainModule(undefined, validatorAbs)],
    ['an empty import.meta.url', isMainModule('', validatorAbs)],
    ['a missing process.argv[1]', isMainModule(validatorUrl, null)],
    ['an empty process.argv[1]', isMainModule(validatorUrl, '')],
    ['an unparseable module URL', isMainModule('not-a-url', validatorAbs)],
    ['a non-file: module URL', isMainModule('https://example.invalid/validate-transport.mjs', validatorAbs)],
    ['a self path that does not resolve', isMainModule(ghostUrl, validatorAbs)],
    ['an argv path that does not resolve', isMainModule(validatorUrl, ghost)],
    ['two different real paths', isMainModule(validatorUrl, join(ROOT, 'tools', 'contract-validation', 'validate.mjs'))],
  ]) {
    assert.equal(got, false, `${what} must FAIL CLOSED (return false), never throw and never be guessed into a main-module match`);
  }

  assert.equal(
    isMainModule(validatorUrl, validatorAbs),
    true,
    'the validator invoked as itself IS the main module — the guard must still admit the one case it ' +
      'exists to admit, or the CLI would be permanently unreachable and every fail-closed assertion above vacuous',
  );
});

// --- 8.12b the operator-visible report, rendered in-process ------------------
// The banner, the counts line, the FAIL block and the exit code are what an operator and a gate
// actually read; before formatValidationReport existed they lived inside `if (isMainModule(...))`,
// which no in-process caller can reach and no coverage run can instrument. The rows below drive the
// formatter directly:
//   (a) the REAL run — the header, the counts line and every count clause of the OK banner must
//       carry the numbers runValidation actually produced, not the `|| 0` fallbacks;
//   (b) a failing result — every error on stderr, an exit code of 1, and NO OK claim anywhere;
//   (c) a sparse/absent result — every fallback renders a literal 0 / UNKNOWN, never `undefined`;
//   (d) the CLI itself — a spawned `node validate-transport.mjs` must emit EXACTLY the formatter's
//       stdout lines and exit with the formatter's exit code, so the formatter is the shipping
//       presentation path and not a parallel test-only rendering.
const REPORT_HEADER_TEXT =
  '=== W2-I inference-plane transport-binding candidate (PROPOSED delta vs. the ACCEPTED W2-D packet) — JSON Schema / fixtures / invariant / integrity / ownership / OpenAPI validation ===';

// The banner clauses, as a function of a counts object: the SAME expected text is asserted against
// the real run (real numbers) and against an empty counts object (every number 0), so a fallback
// that swallowed a real count, or a clause that silently vanished, fails one row or the other.
const bannerClauses = (n) => [
  `all fixtures (${n('positive_pass')} positive + ${n('negative_schema_reject')} negative-schema + ${n('runtime_negative_reject')} negative-semantic); `,
  `integrity (${n('member_sha_verified')} candidate-member + ${n('upstream_pin_verified')} upstream-accepted + ${n('examples_manifest_sha_verified')} examples-manifest + ${n('example_sha_verified')}/${n('example_inventory_on_disk')} support-fixture SHA-256 digests, inventory closed with no duplicate or orphan); `,
  `${n('invariants_checked')} structural assertions (${n('invariants_ok')} ok) covering TT-1..TT-9; `,
  `${n('runtime_negative_declared_match')}/${n('runtime_negative_total')} negative-semantic fixtures rejected on EXACTLY their declared TX rule, witnessing each of TX-1..TX-8 once; `,
  `single-owner ownership + ${n('withdrawn_artifact_absent')} withdrawn second-plane artifacts absent`,
  `a lifecycle-aware sweep of ${n('openapi_documents_swept')} OpenAPI document(s)/${n('openapi_pairs_swept')} declared pairs proving ${n('owned_pair_current_ok')}/${n('ownership_sweep_pairs')} owned pairs keep exactly one CURRENT owner and ${n('owned_pair_successor_ok')}/${n('ownership_sweep_pairs')} at most one delta-linked PROPOSED successor`,
  `${n('registry_operation_witnessed')}/${n('openapi_operation_bound')} closed-registry operations agreeing across delta, fixtures and the successor bytes; `,
  `response-binding preservation over ${n('response_operations_checked')} accepted operation(s) — ${n('response_status_preserved')} accepted non-error binding(s) preserved verbatim and `,
  `${n('dual_branch_response_ok')}/${n('dual_branch_response_total')} error surfaces on the ${n('response_accepted_error_statuses')} accepted error status(es) carrying EXACTLY the accepted ModelInferenceError + proposed TransportAuthorizationError oneOf branch set; `,
];
// Fixed text no count can move: the self-denial clause and the closing lifecycle disclaimer.
const SELF_DENIAL_CLAUSE = 'delta self-denial (proposed-delta, NOT a manifest, unapplied) + ';
const D6_CLAUSE = "ADR-0001 D6 (the accepted W2-D manifest's own bytes reference no candidate material) + ";
const SECURITY_CLAUSE = 'the OpenAPI mTLS+at+jwt security bind. ';
const disclaimerFor = (lifecycle) =>
  `Lifecycle: ${lifecycle} — schemas/fixtures v0.1.0, successor OpenAPI v0.2.0. Conformance evidence only; ` +
  'this is NOT acceptance and NOT implementation authorization, and the delta remains UNAPPLIED against ' +
  'the ACCEPTED W2-D packet.';

const assertOkBannerShape = (banner, counts, lifecycle, why) => {
  const n = (k) => (counts[k] === undefined ? 0 : counts[k]);
  assert.equal(banner.startsWith('\nOK — transport-binding candidate passes JSON Schema 2020-12 compile/ref-resolution; '), true, `${why}: the OK banner must open with the blank line + the compile/ref-resolution claim\n${banner}`);
  for (const clause of [...bannerClauses(n), SELF_DENIAL_CLAUSE, D6_CLAUSE, SECURITY_CLAUSE]) {
    assert.equal(banner.includes(clause), true, `${why}: the OK banner dropped or altered a clause:\n  expected substring: ${clause}\n  banner: ${banner}`);
  }
  assert.equal(banner.endsWith(disclaimerFor(lifecycle)), true, `${why}: the banner must END with the lifecycle + non-acceptance disclaimer for '${lifecycle}'\n${banner}`);
  for (const poison of ['undefined', 'NaN', 'null', '[object Object]']) {
    assert.equal(banner.includes(poison), false, `${why}: the banner rendered '${poison}' — a fallback did not hold\n${banner}`);
  }
};

test('formatValidationReport renders the REAL clean run: exit 0, header, counts line, OK banner carrying the run\'s own numbers', () => {
  const result = runValidation();
  assert.deepEqual(result.errors, [], `the checked-in candidate must validate, or this row proves nothing about the OK path:\n${result.errors.join('\n')}`);
  assert.equal(result.lifecycle, 'PROPOSED', 'the candidate lifecycle must still be PROPOSED, or the disclaimer this row pins is the wrong one');

  const report = formatValidationReport(result);
  assert.equal(report.exitCode, 0, 'a run with no errors must exit 0');
  assert.deepEqual(report.stderr, [], 'a clean run must write NOTHING to stderr');
  assert.equal(report.stdout.length, 3, `a clean run writes exactly header + counts + OK banner:\n${JSON.stringify(report.stdout, null, 2)}`);
  assert.equal(report.stdout[0], REPORT_HEADER_TEXT, 'the header must be reproduced verbatim');
  assert.equal(report.stdout[1], `counts: ${JSON.stringify(result.counts)}`, 'the counts line must serialise the run\'s own counts object');
  assert.deepEqual(JSON.parse(report.stdout[1].slice('counts: '.length)), result.counts, 'the counts line must round-trip to the counts runValidation returned');

  // Non-vacuity: the clauses below are only a proof of "real numbers, not fallbacks" if the real
  // numbers are actually non-zero.
  for (const k of ['positive_pass', 'member_sha_verified', 'invariants_ok', 'runtime_negative_declared_match', 'openapi_documents_swept', 'ownership_sweep_pairs', 'dual_branch_response_ok']) {
    assert.ok(result.counts[k] > 0, `count '${k}' is ${result.counts[k]} on a clean run — the OK banner clause that renders it could not tell a real value from the || 0 fallback`);
  }
  assertOkBannerShape(report.stdout[2], result.counts, 'PROPOSED', 'real clean run');
});

test('formatValidationReport renders a failing result: exit 1, the FAIL count and EVERY error on stderr, no OK claim', () => {
  const errors = [
    'section 3a: the delta must declare artifact_kind proposed-delta',
    'section 6b: GET /api/v1/model-classes 503 lost the accepted ModelInferenceError branch',
    'section 7: POST /api/v1/inferences must have exactly ONE CURRENT owner, found 2',
  ];
  const counts = { positive_pass: 5, openapi_checked: 1 };
  const report = formatValidationReport({ errors, counts, lifecycle: 'PROPOSED' });

  assert.equal(report.exitCode, 1, 'any error must exit 1');
  assert.deepEqual(report.stdout, [REPORT_HEADER_TEXT, `counts: ${JSON.stringify(counts)}`], 'a failing run still prints the header and the counts it reached — and NOTHING else on stdout');
  assert.deepEqual(
    report.stderr,
    ['\nFAIL — 3 error(s):', ...errors.map((e) => `  - ${e}`)],
    'the FAIL block must be the blank-line + count header followed by every error, in order, one "  - " line each',
  );

  const everything = [...report.stdout, ...report.stderr].join('\n');
  for (const e of errors) assert.equal(everything.includes(e), true, `error text was dropped from the report: ${e}`);
  assert.doesNotMatch(everything, /\bOK — /, 'a failing run must make NO OK claim anywhere in the report');
  assert.doesNotMatch(everything, /Conformance evidence only/, 'the pass-only conformance banner must not be emitted for a failing run');

  // The count in the FAIL header is the error count, not a hard-coded one.
  assert.equal(formatValidationReport({ errors: [errors[0]], counts, lifecycle: 'PROPOSED' }).stderr[0], '\nFAIL — 1 error(s):', 'the FAIL header must report the ACTUAL number of errors');
});

test('formatValidationReport falls back deterministically: sparse counts and a null lifecycle render 0 / UNKNOWN, never undefined', () => {
  const empty = formatValidationReport({ errors: [], counts: {}, lifecycle: null });
  assert.equal(empty.exitCode, 0, 'no errors is a pass however empty the counts are');
  assert.deepEqual(empty.stderr, [], 'a pass writes nothing to stderr');
  assert.equal(empty.stdout[1], 'counts: {}', 'an empty counts object must serialise as {}');
  assertOkBannerShape(empty.stdout[2], {}, 'UNKNOWN', 'empty counts + null lifecycle');

  // Per-key independence: one present count must render its own value while every OTHER clause
  // still falls back to 0 — a shared fallback would zero the present one or leak the present one.
  const sparse = { positive_pass: 5, ownership_sweep_pairs: 4, response_accepted_error_statuses: 2 };
  const partial = formatValidationReport({ errors: [], counts: sparse, lifecycle: undefined });
  assertOkBannerShape(partial.stdout[2], sparse, 'UNKNOWN', 'sparse counts + undefined lifecycle');
  assert.equal(partial.stdout[2].includes('all fixtures (5 positive + 0 negative-schema + 0 negative-semantic); '), true, `a present count must survive next to absent ones:\n${partial.stdout[2]}`);
  assert.equal(partial.stdout[2].includes('proving 0/4 owned pairs keep exactly one CURRENT owner and 0/4 at most one delta-linked PROPOSED successor'), true, `the ownership clause must render the present denominator with fallen-back numerators:\n${partial.stdout[2]}`);

  // A count present but zero must render as 0 and must not be confused with an absent one.
  const zeroed = formatValidationReport({ errors: [], counts: { positive_pass: 0 }, lifecycle: 'ACCEPTED FOR IMPLEMENTATION' });
  assertOkBannerShape(zeroed.stdout[2], { positive_pass: 0 }, 'ACCEPTED FOR IMPLEMENTATION', 'a present-but-zero count');
  assert.equal(zeroed.stdout[1], 'counts: {"positive_pass":0}', 'a zero count must still be disclosed in the counts line');

  // The empty banner must NOT be the real banner: if these matched, the fallbacks would be
  // indistinguishable from a real run and row (a) above would prove nothing.
  const real = formatValidationReport(runValidation());
  assert.notEqual(empty.stdout[2], real.stdout[2], 'the all-fallback banner must differ from the real banner, or the counts are not being rendered at all');
});

test('formatValidationReport is total on an absent/partial result object — no throw, and the report still discloses UNKNOWN', () => {
  for (const [what, result] of [
    ['no argument at all', undefined],
    ['a null result', null],
    ['a result with no keys', {}],
    ['a result whose errors and counts are undefined', { errors: undefined, counts: undefined, lifecycle: undefined }],
  ]) {
    const report = formatValidationReport(result);
    assert.equal(report.exitCode, 0, `${what}: no errors were reported, so the exit code is 0`);
    assert.deepEqual(report.stderr, [], `${what}: nothing to report on stderr`);
    assert.deepEqual(report.stdout.slice(0, 2), [REPORT_HEADER_TEXT, 'counts: {}'], `${what}: the header and an empty counts line must still be emitted rather than 'counts: undefined'`);
    assertOkBannerShape(report.stdout[2], {}, 'UNKNOWN', what);
  }
});

test('the shipping CLI prints EXACTLY the formatter output and exits with the formatter exit code', () => {
  const report = formatValidationReport(runValidation());
  const r = spawnSync(process.execPath, ['validate-transport.mjs'], {
    cwd: join(ROOT, 'tools', 'contract-validation'),
    encoding: 'utf8',
  });
  assert.equal(
    r.stdout,
    report.stdout.map((l) => `${l}\n`).join(''),
    'the CLI must print the formatter\'s stdout lines verbatim, one console.log per line — if these diverge the formatter is a parallel rendering and not the shipping one',
  );
  assert.equal(r.stderr, report.stderr.map((l) => `${l}\n`).join(''), 'the CLI must print the formatter\'s stderr lines verbatim');
  assert.equal(r.status, report.exitCode, 'the CLI exit code must be the formatter exit code');
  assert.equal(r.status, 0, `the checked-in candidate must still pass end to end:\n${r.stdout}${r.stderr}`);
});

// --- 8.12c whole-block absence: every nested rule must fail CLOSED ------------
// The delta carries three blocks whose members are read through a `?.`/`|| {}` guard:
// proposed_manifest_changes (the not-yet-applied proof), format_pins (the format floor) and
// proposed_disposition (the byte-freeze and non-binding-dates proof). Individual FIELD drift inside
// them is proved elsewhere; what is proved here is the harder case — the whole block going missing.
// A guard that reads `x?.y` or `(x || {}).y` silently yields undefined, so a delta that simply
// DELETED one of these blocks could sail past every rule it carries unless each rule rejects the
// absent value on its own. Each row therefore removes one block and asserts EVERY diagnostic that
// block's rules owe, so the removal is a rejection on all of them rather than a crash, a skip, or a
// single incidental complaint.
const ABSENT_BLOCK_ROWS = [
  {
    key: 'proposed_manifest_changes',
    why: 'a delta that deleted its proposed_manifest_changes block would carry NO record of what the future flip would change, and every not-yet-applied rule reads through `pmc.…` — all of them must reject the absence',
    diagnostics: [
      "W2-I delta: proposed_manifest_changes.target_manifest.file must be the ACCEPTED W2-D packet manifest compatibility/cybrik-suite-inference-packet.v1.manifest.json",
      'W2-I delta: proposed_manifest_changes.target_manifest.modified_now must be false (the accepted W2-D manifest is untouched until a recorded flip)',
      'W2-I delta: proposed_manifest_changes.removes_members must be empty (a compatible successor revision removes no accepted member)',
      'W2-I delta: proposed_manifest_changes.modifies_accepted_members must be empty (no accepted member is modified)',
    ],
  },
  {
    key: 'format_pins',
    why: 'a delta that deleted its format_pins block would pin no JSON Schema / OpenAPI / AsyncAPI dialect at all, and an unpinned dialect is not a weaker pin, it is no pin',
    diagnostics: [
      'transport manifest: jsonSchema pin must be 2020-12',
      'transport manifest: openApi pin must be 3.1.x',
      'transport manifest: asyncApi pin must be 3.0.0',
    ],
  },
  {
    key: 'proposed_disposition',
    why: 'a delta that deleted its proposed_disposition block would stop declaring the predecessor byte-frozen, still CURRENT, and its dates non-binding — the three claims that keep the successor a proposal rather than a silent supersession',
    diagnostics: [
      'W2-I delta: proposed_disposition.predecessor must be openapi/cybrik-ai-inference-plane.v1.openapi.yaml',
      'W2-I delta: proposed_disposition.predecessor_byte_frozen must be true',
      'W2-I delta: proposed_disposition.predecessor_disposition_now must record that the predecessor is still CURRENT (not yet deprecated or superseded)',
      'W2-I delta: proposed_disposition.dates_binding must be false (every date in a proposal is a planning value and consumes no W0-W6 release date)',
    ],
  },
  {
    key: 'adr_out_of_scope',
    why: 'a delta that deleted its adr_out_of_scope list would stop declaring ADR-0004 tool-execution authority and the ADR-0007 org-hierarchy delta out of scope — the disjointness stance would become an unstated assumption',
    diagnostics: [
      'transport manifest: ADR-0004 (tool execution authority) MUST be declared out of scope (the transport binding grants no tool/agent authority; MCP is an adapter, not this trust boundary)',
      'transport manifest: ADR-0007 (org-hierarchy delta) MUST be declared out of scope (org_scope is opaque/advisory here; the delta is not applied)',
    ],
  },
  {
    key: 'trust_invariants',
    why: 'a delta that deleted its trust_invariants block would declare no structural or runtime rule at all, and the invariants the fixtures witness would answer to nothing in the record',
    diagnostics: [
      'transport manifest: trust_invariants.structural missing/empty',
      'transport manifest: trust_invariants.runtime_only missing/empty',
      'transport manifest: trust_invariants must reference TT-1 (mTLS-bound)',
      'transport manifest: trust_invariants must reference TX-1 (proof-of-possession)',
      'transport manifest: trust_invariants.runtime_evaluation_order missing — the runtime TX evaluation order must be documented, because a fixture may match several rules and the validator requires each to reject on its declared primary rule',
    ],
  },
];

for (const row of ABSENT_BLOCK_ROWS) {
  test(`a delta missing its whole '${row.key}' block is rejected by every rule that block carries`, () => {
    assert.ok(delta[row.key] && typeof delta[row.key] === 'object', `'${row.key}' must really be a block on the checked-in delta, or removing it proves nothing`);
    const r = expectFail(
      buildPacket({ delta: (d) => { delete d[row.key]; } }),
      row.why,
    );
    for (const diagnostic of row.diagnostics) {
      assert.ok(
        r.out.includes(diagnostic),
        `removing '${row.key}' must ALSO be rejected on this rule, or that rule reads the absent block as satisfied:\n` +
          `  expected diagnostic: ${diagnostic}\n--- validator output ---\n${r.out}`,
      );
    }
  });
}

// --- 8.13 self-denial / scope-declaration / catalog fail-closed rows ----------
// Section 3a of the validator is what keeps the status-honesty stance load-bearing rather than
// prose, and sections 3a/3e also carry the scope declarations and the catalogs the gate reads. Every
// one of those rules is a single `if` over a field that can simply GO MISSING, or stay present while
// losing the one phrase that made it a declaration. A packet that lost either would still parse,
// still digest-match and still pass every other proof in this file.
//
// Each row below is DELTA-ONLY: it mutates the proposed delta and nothing else, so buildPacket's
// re-pin step re-derives every digest from unchanged member bytes and no integrity failure can stand
// in for the rule under test. Rows come in two kinds, deliberately:
//   - ABSENT  — the field is deleted outright;
//   - PRESENT-BUT-EMPTY OF THE DECLARATION — the field survives with prose that no longer carries the
//     phrase the rule requires, which is the failure a `missing field` check alone would not catch.
// `guard()` is the non-vacuity proof for each: it asserts the field is really there TODAY, in the
// shape the row removes, so the mutation cannot be a no-op dressed as a green proof; for the
// present-but-wrong rows it also asserts the replacement text still fails ONLY the phrase under test.
// The baseline pass is established once by the 8.0 harness-sanity row, so a red run here is the
// mutation's doing.
const SELF_DENIAL_KEY = 'x-cybrik-manifest-self-denial';
const GRANTS_KEY = 'x-cybrik-grants';
const APPLIES_AT_KEY = 'x-cybrik-applies-at';
// Replacement prose for the present-but-wrong rows. Each keeps the field a plausible declaration and
// drops EXACTLY ONE required phrase, so the run reaches exactly the diagnostic the row names.
const SELF_DENIAL_NO_MANIFEST_DENIAL = 'This artifact must never be read, indexed, released, or renamed as a manifest, and carries no packet identity of its own.';
const SELF_DENIAL_NO_RENAME_BAN = 'This artifact is NOT a compatibility manifest and carries no packet identity of its own.';
const GRANTS_NO_ACCEPTANCE_PHRASE = 'NO RUNTIME AUTHORITY, NO ENDPOINT AUTHORITY. This delta certifies no runtime and declares no deployment.';
const APPLIES_AT_NO_GATE = 'APPLY-ONLY-AT a future status flip that is explicitly recorded by the Founder with evidence (ADR-0001 D5).';

const DECLARATION_ROWS = [
  {
    id: 'DI-1',
    title: 'a delta with no manifest self-denial at all is rejected',
    why: 'the self-denial is the field that keeps the artifact declining to be a manifest; deleting it ' +
      'leaves a delta that denies nothing while every digest still matches',
    match: /W2-I delta: x-cybrik-manifest-self-denial must state that this artifact is NOT a compatibility manifest/,
    guard: () => {
      assert.equal(typeof delta[SELF_DENIAL_KEY], 'string', 'the self-denial must be a string today, or deleting it is not a mutation');
      assert.match(delta[SELF_DENIAL_KEY], /NOT a compatibility manifest/i, 'it must carry the denial today, or the rule is already unsatisfied at baseline');
    },
    packet: () => buildPacket({ delta: (d) => { delete d[SELF_DENIAL_KEY]; } }),
  },
  {
    id: 'DI-2',
    title: 'a self-denial that never says NOT a compatibility manifest is rejected',
    why: 'a present-but-hollow self-denial is the harder failure: the field exists, reads like a denial, ' +
      'and no longer denies the one thing it exists to deny',
    match: /W2-I delta: x-cybrik-manifest-self-denial must state that this artifact is NOT a compatibility manifest/,
    guard: () => {
      assert.doesNotMatch(SELF_DENIAL_NO_MANIFEST_DENIAL, /NOT a compatibility manifest/i, 'the replacement must really drop the manifest denial');
      assert.match(SELF_DENIAL_NO_MANIFEST_DENIAL, /renamed/i, 'it must still satisfy the renaming half of the rule, so the row reaches DI-2\'s diagnostic and only that one');
    },
    packet: () => buildPacket({ delta: (d) => { d[SELF_DENIAL_KEY] = SELF_DENIAL_NO_MANIFEST_DENIAL; } }),
  },
  {
    id: 'DI-3',
    title: 'a self-denial that omits the renaming prohibition is rejected',
    why: 'renaming is how a proposal silently becomes a packet, so denying manifest-hood without ' +
      'forbidding the rename leaves the one move the denial exists to block wide open',
    match: /W2-I delta: x-cybrik-manifest-self-denial must forbid renaming the delta into a manifest \(renaming is how a proposal silently becomes a packet\)/,
    guard: () => {
      assert.match(SELF_DENIAL_NO_RENAME_BAN, /NOT a compatibility manifest/i, 'the replacement must still satisfy the denial rule, or the row would fail on DI-2\'s diagnostic instead');
      assert.doesNotMatch(SELF_DENIAL_NO_RENAME_BAN, /renamed/i, 'and must really drop the renaming prohibition');
    },
    packet: () => buildPacket({ delta: (d) => { d[SELF_DENIAL_KEY] = SELF_DENIAL_NO_RENAME_BAN; } }),
  },
  {
    id: 'DI-4',
    title: 'a delta with no grants declaration is rejected',
    why: 'x-cybrik-grants is where the delta records that it accepts nothing and authorizes nothing; ' +
      'a delta that grants nothing IN SILENCE has stopped saying so',
    match: /W2-I delta: x-cybrik-grants must declare NO ACCEPTANCE AUTHORITY \(a delta accepts nothing and authorizes no implementation\)/,
    guard: () => {
      assert.equal(typeof delta[GRANTS_KEY], 'string', 'the grants declaration must be a string today');
      assert.match(delta[GRANTS_KEY], /NO ACCEPTANCE AUTHORITY/i, 'it must declare NO ACCEPTANCE AUTHORITY today');
    },
    packet: () => buildPacket({ delta: (d) => { delete d[GRANTS_KEY]; } }),
  },
  {
    id: 'DI-5',
    title: 'a grants declaration that drops NO ACCEPTANCE AUTHORITY is rejected',
    why: 'disclaiming runtime and endpoint authority while going quiet on ACCEPTANCE authority is ' +
      'exactly the disclaimer a self-accepting delta would keep',
    match: /W2-I delta: x-cybrik-grants must declare NO ACCEPTANCE AUTHORITY \(a delta accepts nothing and authorizes no implementation\)/,
    guard: () => {
      assert.doesNotMatch(GRANTS_NO_ACCEPTANCE_PHRASE, /NO ACCEPTANCE AUTHORITY/i, 'the replacement must really drop the acceptance disclaimer');
      assert.match(GRANTS_NO_ACCEPTANCE_PHRASE, /NO RUNTIME AUTHORITY/, 'and must still read as a grants declaration');
    },
    packet: () => buildPacket({ delta: (d) => { d[GRANTS_KEY] = GRANTS_NO_ACCEPTANCE_PHRASE; } }),
  },
  {
    id: 'DI-6',
    title: 'a delta with no applies-at record is rejected',
    why: 'x-cybrik-applies-at is what pins the delta to a FUTURE recorded flip; without it the delta ' +
      'carries no statement of when — or whether — it takes effect',
    match: /W2-I delta: x-cybrik-applies-at must record that the delta applies ONLY at a future explicitly-recorded Gate W2-I status flip/,
    guard: () => {
      assert.equal(typeof delta[APPLIES_AT_KEY], 'string', 'the applies-at record must be a string today');
      assert.match(delta[APPLIES_AT_KEY], /Gate W2-I/, 'it must name Gate W2-I today');
    },
    packet: () => buildPacket({ delta: (d) => { delete d[APPLIES_AT_KEY]; } }),
  },
  {
    id: 'DI-7',
    title: 'an applies-at record that names no Gate W2-I flip is rejected',
    why: 'an apply condition that names no gate is satisfiable by any flip at all, which is not an ' +
      'apply condition — the string must keep naming the gate that decides it',
    match: /W2-I delta: x-cybrik-applies-at must record that the delta applies ONLY at a future explicitly-recorded Gate W2-I status flip/,
    guard: () => {
      assert.equal(typeof APPLIES_AT_NO_GATE, 'string', 'the replacement must stay a string, or the row would trip the type half of the rule instead of the wording half');
      assert.doesNotMatch(APPLIES_AT_NO_GATE, /Gate W2-I/, 'and must really drop the gate name');
    },
    packet: () => buildPacket({ delta: (d) => { d[APPLIES_AT_KEY] = APPLIES_AT_NO_GATE; } }),
  },
  {
    id: 'DI-8',
    title: 'a delta with no wire_scope declaration is rejected',
    why: 'NO SERVER / NO ENDPOINT is the declaration that keeps the successor OpenAPI mapping notes ' +
      'rather than an operational contract; deleting it deletes the claim, not the risk',
    match: /transport manifest: wire_scope must declare NO SERVER \/ NO ENDPOINT \(the OpenAPI is mapping notes only, no operational server\/URL\/secret\)/,
    guard: () => {
      assert.equal(typeof delta.wire_scope, 'string', 'wire_scope must be a string today, or deleting it is not a mutation');
      assert.match(delta.wire_scope, /NO SERVER|NO ENDPOINT/i, 'it must carry the no-server declaration today');
    },
    packet: () => buildPacket({ delta: (d) => { delete d.wire_scope; } }),
  },
  {
    id: 'DI-9',
    title: 'a delta with no mcp_scope declaration is rejected',
    why: 'MCP OUT OF SCOPE is the boundary statement that keeps this seam from being read as a ' +
      'Tool/Agent gateway; an absent statement is not an implicit one',
    match: /transport manifest: mcp_scope must declare MCP OUT OF SCOPE \(MCP is a Tool\/Agent gateway adapter, NOT this trust boundary\)/,
    guard: () => {
      assert.equal(typeof delta.mcp_scope, 'string', 'mcp_scope must be a string today, or deleting it is not a mutation');
      assert.match(delta.mcp_scope, /OUT OF SCOPE/i, 'it must declare MCP out of scope today');
    },
    packet: () => buildPacket({ delta: (d) => { delete d.mcp_scope; } }),
  },
  {
    id: 'DI-10',
    title: 'a delta with no gate object is rejected',
    why: 'the gate block is where the candidate names the gate that decides it and records that the ' +
      'gate is undecided; with the whole object gone there is no gate identity to check at all',
    match: /transport manifest: gate\.id must be 'W2-I'/,
    guard: () => {
      assert.equal(delta.gate?.id, 'W2-I', 'the gate must be identified as W2-I today, or deleting the block is not a mutation');
      assert.match(delta.gate?.status || '', /NOT OPENED|awaiting/i, 'and must record the gate as undecided today');
    },
    packet: () => buildPacket({ delta: (d) => { delete d.gate; } }),
  },
  {
    id: 'DI-11',
    title: 'a delta with no adr_basis array is rejected',
    why: 'the ADR basis is what ties the binding to the ACCEPTED ADR-0008 seam; with the array gone ' +
      'the candidate rests on no recorded decision at all',
    match: /transport manifest: adr_basis must include the accepted ADR-0008 service-delegation\/workload-identity seam profile/,
    guard: () => {
      assert.ok(Array.isArray(delta.adr_basis) && delta.adr_basis.length > 0, 'adr_basis must be a non-empty array today');
      assert.ok(delta.adr_basis.some((x) => x.id === SEAM_ADR), `it must cite the accepted seam ${SEAM_ADR} today`);
    },
    packet: () => buildPacket({ delta: (d) => { delete d.adr_basis; } }),
  },
  {
    id: 'DI-12',
    title: 'an empty structural trust-invariant catalog is rejected',
    why: 'an empty catalog is not a fail-closed stance with nothing to say — it is the documented ' +
      'structural surface (TT-1..TT-9) silently reduced to nothing while every fixture still passes',
    match: /transport manifest: trust_invariants\.structural missing\/empty/,
    guard: () => {
      assert.ok(Array.isArray(delta.trust_invariants?.structural) && delta.trust_invariants.structural.length > 0, 'the structural catalog must be non-empty today');
    },
    packet: () => buildPacket({ delta: (d) => { d.trust_invariants.structural = []; } }),
  },
  {
    id: 'DI-13',
    title: 'an empty runtime-only trust-invariant catalog is rejected',
    why: 'the runtime TX-1..TX-8 catalog is the half no schema can enforce, so emptying it erases ' +
      'precisely the obligations the relying party is the only one able to carry',
    match: /transport manifest: trust_invariants\.runtime_only missing\/empty/,
    guard: () => {
      assert.ok(Array.isArray(delta.trust_invariants?.runtime_only) && delta.trust_invariants.runtime_only.length > 0, 'the runtime-only catalog must be non-empty today');
    },
    packet: () => buildPacket({ delta: (d) => { d.trust_invariants.runtime_only = []; } }),
  },
  {
    id: 'DI-14',
    title: 'a delta whose operation registry declares no operations is rejected',
    why: 'a CLOSED registry with no entries closes over nothing: every fixture token becomes ' +
      'unregistered vocabulary, and the registry stops being the single site that pins this seam',
    // Deleting the array and replacing it with a non-array both funnel through the validator's
    // `Array.isArray(...) ? ... : []` normalisation to the same empty-registry diagnostic. Deletion is
    // the stronger of the two — the field is gone entirely, not merely mistyped — so it is the
    // mutation this row runs.
    match: /W2-I delta: operation_registry\.operations must not be empty/,
    guard: () => {
      assert.ok(Array.isArray(delta.operation_registry?.operations) && delta.operation_registry.operations.length > 0, 'the registry must declare operations today');
      assert.equal(delta.operation_registry.closed, true, 'and must already be CLOSED, so the row proves the emptiness rule rather than the closed-flag rule');
    },
    packet: () => buildPacket({ delta: (d) => { delete d.operation_registry.operations; } }),
  },
];

for (const row of DECLARATION_ROWS) {
  test(`${row.id}: ${row.title}`, () => {
    row.guard();
    expectFail(row.packet(), row.why, row.match);
  });
}

// --- 8.14 upstream-pin / ownership-record / registry fail-closed rows ---------
// Sections 3b, 3c and 3e of the validator are the delta's OWN bookkeeping: the table of accepted
// bytes the candidate was reviewed against, the single-owner ownership record, and the closed
// operation registry. Section 8.6 proves the two DRIFT paths (a forged digest on an otherwise
// well-formed pin row); section 8.13 proves the declaration fields. What is left is the shape of
// those blocks themselves — a pin table that is absent, empty, short a required row, pointing at a
// path that is not on disk, re-labelling accepted bytes, claiming an accepted document as candidate
// material or carrying an unparseable digest; an ownership record whose halves are missing or whose
// lifecycle prose has lost one required half; a registry that is not closed or counts a token twice.
// Every one of these leaves a delta that still parses, still digest-matches and still passes every
// other proof in this file.
//
// The three properties of sections 8.10/8.11 hold here too, and none is optional:
//   (a) IN-PROCESS, through buildPacket's runValidation path, so the coverage gate in 8.9 sees the
//       branch each row drives;
//   (b) EXACT DIAGNOSTIC — each row matches the sentence its own rule emits, never merely "the run
//       was red";
//   (c) NON-VACUITY — `guard()` asserts the PRE-mutation state the row depends on (the pin row really
//       is there, the field really carries the phrase being removed, the replacement prose really
//       drops exactly one required half and keeps the other), so a drifted anchor fails loudly
//       instead of certifying a mutation that never presented the defect.
//
// Every row is DELTA-ONLY: buildPacket re-pins each digest from unchanged member bytes, so no
// integrity failure can stand in for the rule under test. Two rows delete an ownership half that
// carries a successor digest; their `ownership.proposed_successor.sha256` disagreement is a direct
// CONSEQUENCE of the deletion rather than masking noise, so they set allowSuccessorPinDrift and still
// match their own sentence exactly.
const ABSENT_UPSTREAM_FILE = 'compatibility/cybrik-suite-inference-packet.v1.absent.manifest.json';
// Replacement lifecycle prose. Each keeps the field a plausible record and drops EXACTLY ONE required
// half, so the run reaches exactly the diagnostic the row names. `CURRENT` and `PROPOSED` are matched
// case-sensitively by the validator, so neither word may survive in the row that removes it.
const CURRENT_OWNER_NO_ACCEPTED = 'CURRENT — the sole owner of the four inference operations until a recorded Gate W2-I flip.';
const CURRENT_OWNER_NO_CURRENT = 'ACCEPTED FOR IMPLEMENTATION (v0.1.0; not stable v1/GA), unchanged by this proposal.';
const SUCCESSOR_NO_NOT_ACCEPTED = 'PROPOSED-SUCCESSOR, awaiting the Gate W2-I decision.';
const SUCCESSOR_NO_PROPOSED = 'NOT ACCEPTED — a candidate successor revision, undecided at Gate W2-I.';

const upstreamPin = (file) => {
  const p = (delta.upstream_pins?.accepted || []).find((x) => x.file === file);
  assert.ok(p, `upstream_pins.accepted must pin ${file} today, or the row that mutates that pin proves nothing`);
  return p;
};

const PIN_OWNERSHIP_ROWS = [
  {
    id: 'UP-1',
    title: 'a delta with no upstream_pins block at all is rejected',
    why: 'upstream_pins.accepted is the table that makes "does not modify accepted" EVALUABLE; with ' +
      'the block gone the candidate names no accepted bytes it was reviewed against, and the ' +
      'byte-frozen claim becomes an assertion nothing can check',
    match: /W2-I delta: upstream_pins\.accepted must pin the ACCEPTED W2-D bytes this delta was authored against/,
    guard: () => {
      assert.ok(delta.upstream_pins && typeof delta.upstream_pins === 'object', 'the delta must carry an upstream_pins block today, or deleting it is not a mutation');
      for (const file of [W2D_MANIFEST_IN_CONTRACTS, PRED_IN_CONTRACTS]) upstreamPin(file);
    },
    packet: () => buildPacket({ delta: (d) => { delete d.upstream_pins; } }),
  },
  {
    id: 'UP-2',
    title: 'an upstream_pins block that survives WITHOUT its accepted table is rejected',
    why: 'the harder shape: the block is still there and still reads like a pin record, while the one ' +
      'array that pins anything is gone — a missing-container check alone would not catch it',
    match: /W2-I delta: upstream_pins\.accepted must pin the ACCEPTED W2-D bytes this delta was authored against/,
    guard: () => {
      const keys = Object.keys(delta.upstream_pins || {});
      assert.ok(keys.includes('accepted'), 'the accepted table must exist today');
      assert.ok(keys.some((k) => k !== 'accepted'), 'upstream_pins must carry at least one other key today, so deleting ONLY accepted leaves a surviving container and this row is distinguishable from UP-1');
    },
    packet: () => buildPacket({ delta: (d) => { delete d.upstream_pins.accepted; } }),
  },
  {
    id: 'UP-3',
    title: 'an EMPTY upstream accepted table is rejected, never read as "nothing to pin"',
    why: 'an empty table pins zero accepted bytes while still presenting itself as the pin record — ' +
      'fail closed, because a candidate reviewed against nothing was reviewed against nothing',
    match: /W2-I delta: upstream_pins\.accepted must pin the ACCEPTED W2-D bytes this delta was authored against/,
    guard: () => {
      assert.equal(delta.upstream_pins.accepted.length, 2, 'the delta must pin exactly the two accepted W2-D artifacts today, or emptying the table is not a mutation');
    },
    packet: () => buildPacket({ delta: (d) => { d.upstream_pins.accepted = []; } }),
  },
  {
    id: 'UP-4',
    title: 'an upstream table missing the accepted predecessor OpenAPI row is rejected',
    why: 'the predecessor is the byte-frozen document the successor claims equivalence against; a pin ' +
      'table that simply omits it leaves the one artifact this candidate is a revision OF unpinned, ' +
      'while the remaining rows still verify and the run would otherwise look complete',
    match: /W2-I delta: upstream_pins\.accepted must pin the byte-frozen accepted openapi\/cybrik-ai-inference-plane\.v1\.openapi\.yaml/,
    guard: () => {
      assert.equal(
        delta.upstream_pins.accepted.filter((p) => p.file === PRED_IN_CONTRACTS).length,
        1,
        'exactly one row must pin the predecessor today, so filtering it out is a genuine mutation',
      );
      assert.ok(
        delta.upstream_pins.accepted.some((p) => p.file === W2D_MANIFEST_IN_CONTRACTS),
        'the accepted-manifest row must SURVIVE the filter, so the table stays non-empty and the row reaches the missing-required-pin rule rather than UP-3\'s empty-table rule',
      );
    },
    packet: () => buildPacket({ delta: (d) => { d.upstream_pins.accepted = d.upstream_pins.accepted.filter((p) => p.file !== PRED_IN_CONTRACTS); } }),
  },
  {
    id: 'UP-5',
    title: 'an upstream pin naming a path that is not on disk is rejected',
    why: 'a pin whose file does not exist verifies nothing at all; the digest can never mismatch, so ' +
      'the row would sit in the table looking like evidence forever',
    match: /W2-I delta: upstream accepted pin missing on disk: compatibility\/cybrik-suite-inference-packet\.v1\.absent\.manifest\.json/,
    guard: () => {
      upstreamPin(W2D_MANIFEST_IN_CONTRACTS);
      assert.equal(existsSync(join(CONTRACTS, ABSENT_UPSTREAM_FILE)), false, 'the re-pointed path must genuinely be absent from the candidate, or the row proves nothing about the missing-on-disk path');
    },
    // Re-pointing the row necessarily ALSO drops the required accepted-manifest pin (the table is
    // keyed by file), so the run reports that too — a true consequence of the same edit. The row
    // matches the missing-on-disk sentence, which no other rule emits.
    packet: () => buildPacket({ delta: (d) => { d.upstream_pins.accepted.find((p) => p.file === W2D_MANIFEST_IN_CONTRACTS).file = ABSENT_UPSTREAM_FILE; } }),
  },
  {
    id: 'UP-6',
    title: 're-labelling an upstream ACCEPTED pin as PROPOSED is rejected',
    why: 'the candidate never re-labels accepted bytes: a pin row that calls the ACCEPTED predecessor ' +
      'PROPOSED has demoted an accepted artifact inside the proposal that depends on it',
    match: /W2-I delta: upstream pin openapi\/cybrik-ai-inference-plane\.v1\.openapi\.yaml must stay ACCEPTED FOR IMPLEMENTATION \(the candidate never re-labels accepted bytes\) — got 'PROPOSED'/,
    guard: () => {
      assert.equal(upstreamPin(PRED_IN_CONTRACTS).status, 'ACCEPTED FOR IMPLEMENTATION', 'the predecessor pin must carry the accepted status today, or demoting it is not a mutation');
    },
    packet: () => buildPacket({ delta: (d) => { d.upstream_pins.accepted.find((p) => p.file === PRED_IN_CONTRACTS).status = 'PROPOSED'; } }),
  },
  {
    id: 'UP-7',
    title: 'an upstream ACCEPTED artifact also declared a candidate member is rejected',
    why: 'accepted bytes and candidate bytes are disjoint by construction: a document that is both ' +
      'would be carried INTO the packet by the very delta that pins it as unchanged upstream, which ' +
      'is how accepted material silently becomes proposed material',
    match: /W2-I delta: upstream accepted pin compatibility\/cybrik-suite-inference-packet\.v1\.manifest\.json must NOT also be a candidate member \(an accepted document cannot be candidate material\)/,
    guard: () => {
      upstreamPin(W2D_MANIFEST_IN_CONTRACTS);
      assert.equal(
        delta.candidate_members.some((m) => m.file === W2D_MANIFEST_IN_CONTRACTS),
        false,
        'the accepted manifest must NOT be a candidate member today, or the overlap already exists and the row asserts nothing new',
      );
      // The added row must satisfy every OTHER member rule, or the run would stop at a version/status
      // complaint and never reach the overlap rule this row exists to prove. Both values are read off
      // the members already in the delta rather than restated as literals.
      const others = delta.candidate_members.filter((m) => m.file !== SUCCESSOR_IN_CONTRACTS);
      assert.ok(others.length > 0, 'there must be a non-successor member to read the expected version/status from');
      assert.ok(others.every((m) => m.contract_version === '0.1.0'), 'every non-successor member is pinned at 0.1.0 today, which is the version the added row must declare');
      assert.ok(delta.candidate_members.every((m) => m.status === 'PROPOSED'), 'every member is PROPOSED today, which is the status the added row must declare');
    },
    // Claiming the accepted manifest as candidate material also makes its OWN name a candidate needle,
    // so D6 reports the manifest referencing itself. That is a direct consequence of the overlap, not
    // masking noise, and the row matches the overlap sentence, which no other rule emits.
    packet: () => buildPacket({
      delta: (d) => {
        d.candidate_members.push({
          file: W2D_MANIFEST_IN_CONTRACTS,
          title: 'the ACCEPTED W2-D packet manifest, wrongly claimed as candidate material',
          contract_version: '0.1.0',
          status: 'PROPOSED',
          sha256: '0'.repeat(64), // re-pinned from the on-disk bytes by buildPacket
        });
      },
    }),
  },
  {
    id: 'UP-8',
    title: 'an upstream pin whose sha256 is not a 64-hex digest is rejected',
    why: 'an unparseable digest is not a weaker pin, it is NO pin: the accepted bytes would be ' +
      'unverified while the table still presents them as the reviewed ones',
    match: /W2-I delta: upstream pin compatibility\/cybrik-suite-inference-packet\.v1\.manifest\.json sha256 missing\/not a 64-hex digest/,
    guard: () => {
      assert.match(upstreamPin(W2D_MANIFEST_IN_CONTRACTS).sha256, /^[0-9a-f]{64}$/, 'the accepted-manifest pin must be well-formed today, or malforming it is not a mutation');
      assert.notEqual(delta.ownership.current_owner.file, W2D_MANIFEST_IN_CONTRACTS, 'the row must malform a pin NO ownership site also declares, so the two-site agreement rule cannot stand in for the digest-format rule');
    },
    // AFTER the re-pin, like every other deliberately-malformed digest in this file: a row that leaves
    // a malformed digest before the re-pin step would be silently overwritten with a well-formed one.
    packet: () => buildPacket({ deltaAfterRepin: (d) => { d.upstream_pins.accepted.find((p) => p.file === W2D_MANIFEST_IN_CONTRACTS).sha256 = 'not-a-64-hex-digest'; } }),
  },
  {
    id: 'OW-1',
    title: 'a delta with no ownership record at all is rejected',
    why: 'the ownership record is where single ownership is DECLARED; with the block gone the sweep ' +
      'has nothing to reconcile against and the Option A single-owner stance rests on prose',
    match: /W2-I delta: ownership\.current_owner\.file must be the accepted W2-D-owned openapi\/cybrik-ai-inference-plane\.v1\.openapi\.yaml \(it remains the sole CURRENT owner until a recorded flip\) — got 'undefined'/,
    guard: () => {
      assert.equal(delta.ownership?.current_owner?.file, PRED_IN_CONTRACTS, 'the record must name the predecessor as CURRENT owner today');
      assert.equal(delta.ownership?.proposed_successor?.file, SUCCESSOR_IN_CONTRACTS, 'and the successor as the proposed one, or deleting the block is not a mutation');
    },
    // Deleting the block takes the successor digest site with it, so the two-site agreement rule fires
    // as a CONSEQUENCE of this row rather than masking it.
    allowSuccessorPinDrift: true,
    packet: () => buildPacket({ delta: (d) => { delete d.ownership; } }),
  },
  {
    id: 'OW-2',
    title: 'an ownership record with no current_owner half is rejected',
    why: 'the successor half alone records a proposal with no owner it succeeds; the CURRENT owner is ' +
      'the half that keeps the accepted predecessor sole owner until a recorded flip',
    match: /W2-I delta: ownership\.current_owner\.file must be the accepted W2-D-owned openapi\/cybrik-ai-inference-plane\.v1\.openapi\.yaml \(it remains the sole CURRENT owner until a recorded flip\) — got 'undefined'/,
    guard: () => {
      assert.ok(delta.ownership.current_owner, 'the current_owner half must exist today');
      assert.ok(delta.ownership.proposed_successor, 'and the successor half must SURVIVE the deletion, so this row isolates the current_owner rule and needs no pin-drift allowance');
    },
    packet: () => buildPacket({ delta: (d) => { delete d.ownership.current_owner; } }),
  },
  {
    id: 'OW-3',
    title: 'an ownership record with no proposed_successor half is rejected',
    why: 'without the successor half the delta pins no successor at all, so the sweep can never bind ' +
      'the PROPOSED document on disk to a recorded proposal — an unlinked successor by omission',
    match: /W2-I delta: ownership\.proposed_successor\.file must be openapi\/cybrik-ai-inference-plane\.v1\.contract-0\.2\.0\.openapi\.yaml — got 'undefined'/,
    guard: () => {
      assert.equal(delta.ownership.proposed_successor.file, SUCCESSOR_IN_CONTRACTS, 'the successor half must name the candidate revision today');
      assert.match(delta.ownership.proposed_successor.sha256, /^[0-9a-f]{64}$/, 'and must carry the second successor digest site, whose disappearance is what the pin-drift allowance below covers');
    },
    allowSuccessorPinDrift: true,
    packet: () => buildPacket({ delta: (d) => { delete d.ownership.proposed_successor; } }),
  },
  {
    id: 'OW-4',
    title: 'a current-owner lifecycle that says CURRENT but not ACCEPTED FOR IMPLEMENTATION is rejected',
    why: 'CURRENT alone is a position in a sequence, not an acceptance state — a document can be the ' +
      'newest thing on disk without ever having been accepted, and the record must state both',
    match: /W2-I delta: ownership\.current_owner\.lifecycle_now must record it as CURRENT — ACCEPTED FOR IMPLEMENTATION/,
    guard: () => {
      assert.match(delta.ownership.current_owner.lifecycle_now, /CURRENT/, 'the record must carry both halves today');
      assert.match(delta.ownership.current_owner.lifecycle_now, /ACCEPTED FOR IMPLEMENTATION/, 'or dropping one of them is not a mutation');
      assert.match(CURRENT_OWNER_NO_ACCEPTED, /CURRENT/, 'the replacement must KEEP the CURRENT half, so only the acceptance half is under test');
      assert.doesNotMatch(CURRENT_OWNER_NO_ACCEPTED, /ACCEPTED FOR IMPLEMENTATION/, 'and must really drop the acceptance half');
    },
    packet: () => buildPacket({ delta: (d) => { d.ownership.current_owner.lifecycle_now = CURRENT_OWNER_NO_ACCEPTED; } }),
  },
  {
    id: 'OW-5',
    title: 'a current-owner lifecycle that says ACCEPTED FOR IMPLEMENTATION but not CURRENT is rejected',
    why: 'the mirror failure: an accepted document that no longer claims to be the CURRENT owner ' +
      'leaves the owned pairs with an acceptance state and no owner, which is the gap a second owner ' +
      'would move into',
    match: /W2-I delta: ownership\.current_owner\.lifecycle_now must record it as CURRENT — ACCEPTED FOR IMPLEMENTATION/,
    guard: () => {
      assert.match(CURRENT_OWNER_NO_CURRENT, /ACCEPTED FOR IMPLEMENTATION/, 'the replacement must KEEP the acceptance half, so only the CURRENT half is under test');
      assert.doesNotMatch(CURRENT_OWNER_NO_CURRENT, /CURRENT/, 'and must really drop the CURRENT half — the validator matches it case-sensitively, so no cased variant may survive');
    },
    packet: () => buildPacket({ delta: (d) => { d.ownership.current_owner.lifecycle_now = CURRENT_OWNER_NO_CURRENT; } }),
  },
  {
    id: 'OW-6',
    title: 'a successor lifecycle that says PROPOSED but not NOT ACCEPTED is rejected',
    why: 'PROPOSED describes how the document arrived; NOT ACCEPTED is what the gate has not yet done ' +
      'about it. A record carrying only the first reads as a proposal in progress rather than as one ' +
      'that has been decided on by nobody',
    match: /W2-I delta: ownership\.proposed_successor\.lifecycle_now must record PROPOSED-SUCCESSOR — NOT ACCEPTED/,
    guard: () => {
      assert.match(delta.ownership.proposed_successor.lifecycle_now, /PROPOSED/, 'the record must carry both halves today');
      assert.match(delta.ownership.proposed_successor.lifecycle_now, /NOT ACCEPTED/, 'or dropping one of them is not a mutation');
      assert.match(SUCCESSOR_NO_NOT_ACCEPTED, /PROPOSED/, 'the replacement must KEEP the PROPOSED half');
      assert.doesNotMatch(SUCCESSOR_NO_NOT_ACCEPTED, /NOT ACCEPTED/, 'and must really drop the not-accepted half');
    },
    packet: () => buildPacket({ delta: (d) => { d.ownership.proposed_successor.lifecycle_now = SUCCESSOR_NO_NOT_ACCEPTED; } }),
  },
  {
    id: 'OW-7',
    title: 'a successor lifecycle that says NOT ACCEPTED but not PROPOSED is rejected',
    why: 'the mirror failure: dropping PROPOSED leaves a document that is merely not accepted, which ' +
      'is equally true of a withdrawn or never-submitted revision — the record must keep saying that ' +
      'this one is a live proposal',
    match: /W2-I delta: ownership\.proposed_successor\.lifecycle_now must record PROPOSED-SUCCESSOR — NOT ACCEPTED/,
    guard: () => {
      assert.match(SUCCESSOR_NO_PROPOSED, /NOT ACCEPTED/, 'the replacement must KEEP the not-accepted half');
      assert.doesNotMatch(SUCCESSOR_NO_PROPOSED, /PROPOSED/, 'and must really drop the PROPOSED half — matched case-sensitively, so PROPOSED-SUCCESSOR may not survive either');
    },
    packet: () => buildPacket({ delta: (d) => { d.ownership.proposed_successor.lifecycle_now = SUCCESSOR_NO_PROPOSED; } }),
  },
  {
    id: 'OW-8',
    title: 'a proposed disposition that no longer records the predecessor as still CURRENT is rejected',
    why: 'the disposition is a PROPOSAL about a future flip; the one thing it must state about today ' +
      'is that the predecessor is not yet deprecated or superseded. Losing that sentence is how a ' +
      'proposed supersession quietly reads as an accomplished one',
    match: /W2-I delta: proposed_disposition\.predecessor_disposition_now must record that the predecessor is still CURRENT \(not yet deprecated or superseded\)/,
    guard: () => {
      const d3 = delta.proposed_disposition;
      assert.match(d3.predecessor_disposition_now, /CURRENT/, 'the disposition must record the predecessor as still CURRENT today, or deleting the field is not a mutation');
      // Deleting the WHOLE block would trip the predecessor/byte-frozen/dates rules first and bury the
      // CURRENT rule among them. Removing exactly this field keeps the other three satisfied, so the
      // run reaches the precise CURRENT diagnostic this row names and only that one.
      assert.equal(d3.predecessor, PRED_IN_CONTRACTS, 'the sibling predecessor field must stay satisfied');
      assert.equal(d3.predecessor_byte_frozen, true, 'as must the byte-freeze field');
      assert.equal(d3.dates_binding, false, 'as must the non-binding-dates field');
    },
    packet: () => buildPacket({ delta: (d) => { delete d.proposed_disposition.predecessor_disposition_now; } }),
  },
  {
    id: 'OR-1',
    title: 'an operation registry that is not CLOSED is rejected',
    why: 'CLOSED is what makes the registry the single site that pins this seam\'s vocabulary; an open ' +
      'registry admits any token a fixture cares to present, and the closure check in the other ' +
      'direction stops meaning anything',
    match: /W2-I delta: operation_registry\.closed must be true \(a token outside the registry is unaccepted vocabulary, not an operation\)/,
    guard: () => {
      assert.equal(delta.operation_registry.closed, true, 'the registry must be CLOSED today, or flipping the flag is not a mutation');
      assert.ok(delta.operation_registry.operations.length > 0, 'and must declare operations, so this row proves the closed-flag rule rather than the emptiness rule DI-14 owns');
    },
    packet: () => buildPacket({ delta: (d) => { d.operation_registry.closed = false; } }),
  },
  {
    id: 'OR-2',
    title: 'an operation registry declaring the same token twice is rejected',
    why: 'a closed registry counts each token ONCE; a duplicated entry makes the registry size a lie ' +
      'and lets one witness fixture stand in for two claimed operations',
    match: /W2-I delta: operation_registry declares 'ai\.inference\.create' twice \(a closed registry counts each token once\)/,
    guard: () => {
      const ops = delta.operation_registry.operations;
      assert.equal(ops[0].token, 'ai.inference.create', 'the first registry entry must be the create token, or the duplicated-token diagnostic below names the wrong operation');
      assert.equal(new Set(ops.map((o) => o.token)).size, ops.length, 'no token may already be duplicated today, or the row asserts nothing new');
      // The duplicate is a FULL copy, so its method/path/fixture/token-spelling checks all still pass:
      // the ONLY thing wrong with the mutated registry is that it counts one token twice.
      assert.ok(ops[0].positive_fixture && ops[0].method && ops[0].path, 'the copied entry must carry a complete witness binding, or the run would fail on the witness rules instead');
    },
    packet: () => buildPacket({ delta: (d) => { d.operation_registry.operations.push({ ...d.operation_registry.operations[0] }); } }),
  },
];

for (const row of PIN_OWNERSHIP_ROWS) {
  test(`${row.id}: ${row.title}`, () => {
    row.guard();
    expectFail(row.packet(), row.why, row.match, { allowSuccessorPinDrift: Boolean(row.allowSuccessorPinDrift) });
  });
}

// --- 8.15 evaluation-order and MCP-boundary declaration rows ------------------
// Section 3a carries two prose declarations that nothing else in the packet can stand in for:
//
//   trust_invariants.runtime_evaluation_order — the ORDER decision. A single presentation can violate
//   several runtime rules at once, so WHICH typed rule comes back is a choice, and section 8.1 already
//   proves the CODE makes that choice (TX-8 before TX-7) and that inverting it is caught. What is
//   proven here is the other half: that the delta keeps SAYING so, in all three of the ways the
//   validator reads it — both rule ids present and in order, the reason the feature-flag rule precedes
//   the replay rule, and the declared-primary-rule contract the exactness check in section 5 rests on.
//
//   mcp_scope — the BOUNDARY declaration. Section 8.13 (DI-9) proves the field cannot go missing and
//   that OUT OF SCOPE must survive; the validator additionally requires the field to name MCP as a
//   Tool/Agent ADAPTER and to deny that it is the inference trust boundary. Those are separate claims:
//   "out of scope for this candidate" is a statement about this document, while "an adapter, not this
//   trust boundary" is a statement about what MCP is — a packet that kept only the first would still
//   read as a seam whose MCP silence is merely an omission awaiting a later revision.
//
// Every rule above is a single `if` over prose that can go missing, go blank, or stay present while
// losing exactly one required phrase — none of which any digest, schema or fixture would notice.
//
// The three properties of sections 8.10/8.11/8.13/8.14 hold here too:
//   (a) IN-PROCESS, through buildPacket's runValidation path (delta-only mutations, so the re-pin step
//       re-derives every digest from unchanged member bytes and no integrity failure can stand in for
//       the rule under test), which is also what lets the 8.9 coverage gate see the branch;
//   (b) EXACT DIAGNOSTIC — each row matches the sentence its own rule emits;
//   (c) NON-VACUITY — `guard()` asserts the anchor really is in the delta TODAY and that the mutated
//       prose has exactly the defect the row names AND still satisfies every sibling rule, and each
//       row additionally asserts that the sibling diagnostics are ABSENT from the run. A row that
//       broke two rules at once would still be red, and would prove neither.
//
// Every mutated string is DERIVED from the live delta text by replacing a named anchor, never
// hand-authored: if the delta's wording drifts, the anchor stops matching, the derived string equals
// the original and buildPacket's no-op guard fails loudly rather than certifying a mutation that never
// presented the defect.
const EVAL_ORDER = delta.trust_invariants?.runtime_evaluation_order || '';
const MCP_SCOPE = delta.mcp_scope || '';

// Anchors — the exact substrings of the current delta prose each mutation rewrites.
const ANCHOR_ORDER_PAIR = 'TX-8 feature flag, TX-7 replay';
const ANCHOR_ORDER_PRECEDES = 'TX-8 precedes TX-7 deliberately';
const ANCHOR_WHY_REFUSED = 'whose feature flag is disabled must be refused';
const ANCHOR_WHY_ADMITTED = 'a disabled operation is never admitted';
const ANCHOR_PRIMARY_CONTRACT = 'declares the primary rule it exists to witness';
const ANCHOR_MCP_ADAPTER = 'gateway adapter and NOT the inference trust boundary';
const ANCHOR_MCP_BOUNDARY_DENIAL = ' and NOT the inference trust boundary';

// A field that is present, is a string, and carries nothing — the failure a `field missing` check
// alone would not catch, because `typeof '' === 'string'` and JSON preserves it faithfully.
const EVAL_ORDER_BLANK = ' \t\n  ';
// Order prose with one of the two rule ids spelled out of existence. The enumerated list entry is
// rewritten first so the remaining sweep leaves readable prose rather than a doubled label.
const EVAL_ORDER_NO_TX8 = EVAL_ORDER
  .replace(ANCHOR_ORDER_PAIR, 'the feature-flag rule, TX-7 replay')
  .replace(/TX-8/g, 'the feature-flag rule');
const EVAL_ORDER_NO_TX7 = EVAL_ORDER
  .replace(ANCHOR_ORDER_PAIR, 'TX-8 feature flag, the replay rule')
  .replace(/TX-7/g, 'the replay rule');
// A SELF-CONSISTENT inversion: both the enumerated list and the sentence that justifies the order are
// flipped together, so the document reads as a coherent replay-first policy rather than as prose that
// merely contradicts itself. This is the stronger shape — a validator that only diffed the two
// sentences against each other would pass it, and the enforced order in section 8.1 would then be
// documented backwards with nothing objecting.
const EVAL_ORDER_REVERSED = EVAL_ORDER
  .replace(ANCHOR_ORDER_PAIR, 'TX-7 replay, TX-8 feature flag')
  .replace(ANCHOR_ORDER_PRECEDES, 'TX-7 precedes TX-8 deliberately');
// Order and primary-rule contract intact; the WHY is gone. Both mentions of the disabled state are
// rewritten, because the validator matches the word case-insensitively anywhere in the field.
const EVAL_ORDER_NO_WHY = EVAL_ORDER
  .replace(ANCHOR_WHY_REFUSED, 'whose feature flag is switched off must be refused')
  .replace(ANCHOR_WHY_ADMITTED, 'an operation in that state is never admitted');
// Order and WHY intact; the declared-primary-rule contract is gone.
const EVAL_ORDER_NO_PRIMARY = EVAL_ORDER.replace(ANCHOR_PRIMARY_CONTRACT, 'declares the one rule it exists to witness');
// MCP prose keeping OUT OF SCOPE and the boundary denial, minus the word that names what MCP IS.
const MCP_SCOPE_NO_ADAPTER = MCP_SCOPE.replace(ANCHOR_MCP_ADAPTER, 'gateway and NOT the inference trust boundary');
// The mirror: MCP is still named an adapter and still declared out of scope, but the packet no longer
// denies that it is this trust boundary.
const MCP_SCOPE_NO_BOUNDARY_DENIAL = MCP_SCOPE.replace(ANCHOR_MCP_BOUNDARY_DENIAL, '');

const EVAL_ORDER_MISSING_DIAG = /transport manifest: trust_invariants\.runtime_evaluation_order missing — the runtime TX evaluation order must be documented/;
const EVAL_ORDER_SEQUENCE_DIAG = /transport manifest: trust_invariants\.runtime_evaluation_order must record that TX-8 \(feature flag\) is evaluated BEFORE TX-7 \(replay\)/;
const EVAL_ORDER_WHY_DIAG = /transport manifest: runtime_evaluation_order must explain WHY the feature-flag rule precedes the replay rule/;
const EVAL_ORDER_PRIMARY_DIAG = /transport manifest: runtime_evaluation_order must record the declared-primary-rule contract/;
const MCP_BOUNDARY_DIAG = /transport manifest: mcp_scope must record that MCP is a Tool\/Agent adapter and NOT the inference trust boundary/;
const MCP_OUT_OF_SCOPE_DIAG = /transport manifest: mcp_scope must declare MCP OUT OF SCOPE/;

// The validator compares FIRST occurrences, so every guard about ordering must do the same.
const firstIndexes = (text) => ({ tx8: text.indexOf('TX-8'), tx7: text.indexOf('TX-7') });
// Shared non-vacuity floor: the four sub-rules are all satisfied by the delta TODAY. Asserted by every
// row, so a delta that had already lost one of them could not let a row pass on the wrong sentence.
const assertEvalOrderHealthyToday = () => {
  const { tx8, tx7 } = firstIndexes(EVAL_ORDER);
  assert.ok(EVAL_ORDER.trim(), 'runtime_evaluation_order must be non-blank today, or every row below mutates nothing');
  assert.ok(tx8 >= 0 && tx7 >= 0 && tx8 < tx7, 'it must name TX-8 before TX-7 today');
  assert.match(EVAL_ORDER, /disabled/i, 'it must explain the disabled-operation reason today');
  assert.match(EVAL_ORDER, /primary/i, 'it must record the declared-primary-rule contract today');
};
const assertMcpScopeHealthyToday = () => {
  assert.match(MCP_SCOPE, /OUT OF SCOPE/i, 'mcp_scope must declare MCP out of scope today');
  assert.match(MCP_SCOPE, /adapter/i, 'it must name MCP an adapter today');
  assert.match(MCP_SCOPE, /NOT.*(trust boundary|inference)/i, 'and must deny that MCP is the inference trust boundary today');
};

const TRUST_DECLARATION_ROWS = [
  {
    id: 'EO-1',
    title: 'a delta with no runtime_evaluation_order at all is rejected',
    why: 'the evaluation order is what makes the declared-primary-rule contract checkable: without it, ' +
      'a fixture rejecting on TX-7 instead of its declared TX-8 is indistinguishable from correct ' +
      'behaviour, and the feature-flag rule can be shadowed into vacuity with nothing to object',
    match: EVAL_ORDER_MISSING_DIAG,
    // With the field absent the validator never reaches the three prose rules, so all three of their
    // diagnostics must be absent — their presence would mean the run failed somewhere else entirely.
    absent: { 'the ordering diagnostic': EVAL_ORDER_SEQUENCE_DIAG, 'the WHY diagnostic': EVAL_ORDER_WHY_DIAG, 'the primary-rule diagnostic': EVAL_ORDER_PRIMARY_DIAG },
    guard: () => {
      assertEvalOrderHealthyToday();
      assert.equal(typeof delta.trust_invariants?.runtime_evaluation_order, 'string', 'the field must be a string today, or deleting it is not a mutation');
    },
    packet: () => buildPacket({ delta: (d) => { delete d.trust_invariants.runtime_evaluation_order; } }),
  },
  {
    id: 'EO-2',
    title: 'a runtime_evaluation_order that is present but blank is rejected',
    why: 'a whitespace-only string is the shape a deletion takes when someone is trying to keep the ' +
      'field list intact: it type-checks, round-trips through JSON unchanged, and documents nothing — ' +
      'so the rule must reject on emptiness, not merely on absence',
    match: EVAL_ORDER_MISSING_DIAG,
    absent: { 'the ordering diagnostic': EVAL_ORDER_SEQUENCE_DIAG, 'the WHY diagnostic': EVAL_ORDER_WHY_DIAG, 'the primary-rule diagnostic': EVAL_ORDER_PRIMARY_DIAG },
    guard: () => {
      assertEvalOrderHealthyToday();
      assert.equal(typeof EVAL_ORDER_BLANK, 'string', 'the replacement must stay a STRING, or this row proves the type half of the rule rather than the emptiness half');
      assert.notEqual(EVAL_ORDER_BLANK, '', 'and must be non-empty characters, so only trim() can tell it apart from documentation');
      assert.equal(EVAL_ORDER_BLANK.trim(), '', 'while carrying no content at all');
    },
    packet: () => buildPacket({ delta: (d) => { d.trust_invariants.runtime_evaluation_order = EVAL_ORDER_BLANK; } }),
  },
  {
    id: 'EO-3',
    title: 'an order that never names TX-8 is rejected',
    why: 'prose that reads like an evaluation order but never names the feature-flag rule documents an ' +
      'order the relying party cannot be held to at that rule — the one rule that is otherwise ' +
      'shadowed by replay for every negative-semantic fixture in this candidate',
    match: EVAL_ORDER_SEQUENCE_DIAG,
    absent: { 'the missing-field diagnostic': EVAL_ORDER_MISSING_DIAG, 'the WHY diagnostic': EVAL_ORDER_WHY_DIAG, 'the primary-rule diagnostic': EVAL_ORDER_PRIMARY_DIAG },
    guard: () => {
      assertEvalOrderHealthyToday();
      assert.ok(EVAL_ORDER.includes(ANCHOR_ORDER_PAIR), `the enumerated order must still contain '${ANCHOR_ORDER_PAIR}' today, or the derived mutation is not the one this row describes`);
      assert.doesNotMatch(EVAL_ORDER_NO_TX8, /TX-8/, 'the replacement must really drop every TX-8 mention — the validator looks for the id anywhere in the field');
      assert.match(EVAL_ORDER_NO_TX8, /TX-7/, 'and must KEEP TX-7, so the row proves the missing-TX-8 half rather than an empty order');
      assert.match(EVAL_ORDER_NO_TX8, /disabled/i, 'the WHY sibling must stay satisfied');
      assert.match(EVAL_ORDER_NO_TX8, /primary/i, 'as must the declared-primary-rule sibling');
      assert.ok(EVAL_ORDER_NO_TX8.trim(), 'and the field must stay non-blank, or this row would trip EO-2\'s rule instead');
    },
    packet: () => buildPacket({ delta: (d) => { d.trust_invariants.runtime_evaluation_order = EVAL_ORDER_NO_TX8; } }),
  },
  {
    id: 'EO-4',
    title: 'an order that never names TX-7 is rejected',
    why: 'the mirror failure: an order naming only the feature-flag rule says nothing about where the ' +
      'replay rule sits relative to it, so the precedence the validator enforces would rest on prose ' +
      'that mentions only one of the two rules it orders',
    match: EVAL_ORDER_SEQUENCE_DIAG,
    absent: { 'the missing-field diagnostic': EVAL_ORDER_MISSING_DIAG, 'the WHY diagnostic': EVAL_ORDER_WHY_DIAG, 'the primary-rule diagnostic': EVAL_ORDER_PRIMARY_DIAG },
    guard: () => {
      assertEvalOrderHealthyToday();
      assert.ok(EVAL_ORDER.includes(ANCHOR_ORDER_PAIR), `the enumerated order must still contain '${ANCHOR_ORDER_PAIR}' today`);
      assert.doesNotMatch(EVAL_ORDER_NO_TX7, /TX-7/, 'the replacement must really drop every TX-7 mention');
      assert.match(EVAL_ORDER_NO_TX7, /TX-8/, 'and must KEEP TX-8, so the row proves the missing-TX-7 half');
      assert.match(EVAL_ORDER_NO_TX7, /disabled/i, 'the WHY sibling must stay satisfied');
      assert.match(EVAL_ORDER_NO_TX7, /primary/i, 'as must the declared-primary-rule sibling');
      assert.ok(EVAL_ORDER_NO_TX7.trim(), 'and the field must stay non-blank');
    },
    packet: () => buildPacket({ delta: (d) => { d.trust_invariants.runtime_evaluation_order = EVAL_ORDER_NO_TX7; } }),
  },
  {
    id: 'EO-5',
    title: 'an order documenting TX-7 before TX-8 is rejected even when it is internally consistent',
    why: 'a delta whose list AND whose justifying sentence are both flipped is a coherent replay-first ' +
      'policy — and it is exactly backwards from the order the code enforces. Documented order and ' +
      'enforced order must agree, or the declared-primary-rule contract is decided by whichever of ' +
      'the two a reader happens to consult',
    match: EVAL_ORDER_SEQUENCE_DIAG,
    absent: { 'the missing-field diagnostic': EVAL_ORDER_MISSING_DIAG, 'the WHY diagnostic': EVAL_ORDER_WHY_DIAG, 'the primary-rule diagnostic': EVAL_ORDER_PRIMARY_DIAG },
    guard: () => {
      assertEvalOrderHealthyToday();
      assert.ok(EVAL_ORDER.includes(ANCHOR_ORDER_PAIR), `the enumerated order must still contain '${ANCHOR_ORDER_PAIR}' today`);
      assert.ok(EVAL_ORDER.includes(ANCHOR_ORDER_PRECEDES), `the justifying sentence must still read '${ANCHOR_ORDER_PRECEDES}' today, or the inversion below is only half applied`);
      const { tx8, tx7 } = firstIndexes(EVAL_ORDER_REVERSED);
      assert.ok(tx7 >= 0 && tx8 >= 0, 'the replacement must keep BOTH rule ids, or this row proves EO-3/EO-4 instead');
      assert.ok(tx7 < tx8, 'and must really present TX-7 first — the validator compares FIRST occurrences');
      assert.doesNotMatch(EVAL_ORDER_REVERSED, new RegExp(ANCHOR_ORDER_PRECEDES.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the old justifying sentence must not survive, or the inverted document contradicts itself and stops being the stronger shape');
      assert.match(EVAL_ORDER_REVERSED, /disabled/i, 'the WHY sibling must stay satisfied');
      assert.match(EVAL_ORDER_REVERSED, /primary/i, 'as must the declared-primary-rule sibling');
    },
    packet: () => buildPacket({ delta: (d) => { d.trust_invariants.runtime_evaluation_order = EVAL_ORDER_REVERSED; } }),
  },
  {
    id: 'EO-6',
    title: 'an order that states the sequence but never explains it is rejected',
    why: 'the reason IS the rule: a disabled operation is never admitted to the replay cache, so a ' +
      'replay verdict on it would be a fiction. An order recorded without it reads as an arbitrary ' +
      'convention that a later revision may reorder for convenience',
    match: EVAL_ORDER_WHY_DIAG,
    absent: { 'the missing-field diagnostic': EVAL_ORDER_MISSING_DIAG, 'the ordering diagnostic': EVAL_ORDER_SEQUENCE_DIAG, 'the primary-rule diagnostic': EVAL_ORDER_PRIMARY_DIAG },
    guard: () => {
      assertEvalOrderHealthyToday();
      for (const anchor of [ANCHOR_WHY_REFUSED, ANCHOR_WHY_ADMITTED]) {
        assert.ok(EVAL_ORDER.includes(anchor), `the delta must still contain '${anchor}' today, or the WHY is not being removed where this row says it is`);
      }
      assert.doesNotMatch(EVAL_ORDER_NO_WHY, /disabled/i, 'the replacement must really drop every mention of the disabled state — matched case-insensitively, so no cased variant may survive');
      const { tx8, tx7 } = firstIndexes(EVAL_ORDER_NO_WHY);
      assert.ok(tx8 >= 0 && tx7 >= 0 && tx8 < tx7, 'the ordering sibling must stay satisfied, so the run reaches the WHY diagnostic and only that one');
      assert.match(EVAL_ORDER_NO_WHY, /primary/i, 'as must the declared-primary-rule sibling');
    },
    packet: () => buildPacket({ delta: (d) => { d.trust_invariants.runtime_evaluation_order = EVAL_ORDER_NO_WHY; } }),
  },
  {
    id: 'EO-7',
    title: 'an order that documents sequence and reason but drops the declared-primary-rule contract is rejected',
    why: 'section 5 requires every negative-semantic fixture to reject on EXACTLY its declared TX rule; ' +
      'that obligation is only meaningful because the delta declares it. Order plus reason without it ' +
      'leaves the exactness check enforcing a contract the packet never states',
    match: EVAL_ORDER_PRIMARY_DIAG,
    absent: { 'the missing-field diagnostic': EVAL_ORDER_MISSING_DIAG, 'the ordering diagnostic': EVAL_ORDER_SEQUENCE_DIAG, 'the WHY diagnostic': EVAL_ORDER_WHY_DIAG },
    guard: () => {
      assertEvalOrderHealthyToday();
      assert.ok(EVAL_ORDER.includes(ANCHOR_PRIMARY_CONTRACT), `the delta must still contain '${ANCHOR_PRIMARY_CONTRACT}' today`);
      assert.doesNotMatch(EVAL_ORDER_NO_PRIMARY, /primary/i, 'the replacement must really drop the word the rule matches, anywhere in the field');
      const { tx8, tx7 } = firstIndexes(EVAL_ORDER_NO_PRIMARY);
      assert.ok(tx8 >= 0 && tx7 >= 0 && tx8 < tx7, 'the ordering sibling must stay satisfied');
      assert.match(EVAL_ORDER_NO_PRIMARY, /disabled/i, 'as must the WHY sibling, so the run reaches the declared-primary-rule diagnostic and only that one');
    },
    packet: () => buildPacket({ delta: (d) => { d.trust_invariants.runtime_evaluation_order = EVAL_ORDER_NO_PRIMARY; } }),
  },
  {
    id: 'MB-1',
    title: 'an mcp_scope that declares MCP out of scope but never names it an adapter is rejected',
    why: 'out-of-scope is a statement about THIS document; adapter is a statement about what MCP is. A ' +
      'packet keeping only the first leaves the reader to infer that MCP might be a peer trust ' +
      'boundary this candidate simply has not gotten to yet',
    match: MCP_BOUNDARY_DIAG,
    absent: { 'the OUT OF SCOPE diagnostic': MCP_OUT_OF_SCOPE_DIAG },
    guard: () => {
      assertMcpScopeHealthyToday();
      assert.ok(MCP_SCOPE.includes(ANCHOR_MCP_ADAPTER), `mcp_scope must still contain '${ANCHOR_MCP_ADAPTER}' today, or the derived mutation is not the one this row describes`);
      assert.doesNotMatch(MCP_SCOPE_NO_ADAPTER, /adapter/i, 'the replacement must really drop the adapter characterisation');
      assert.match(MCP_SCOPE_NO_ADAPTER, /OUT OF SCOPE/i, 'and must KEEP the out-of-scope declaration, so the row reaches the boundary diagnostic and not the out-of-scope one');
      assert.match(MCP_SCOPE_NO_ADAPTER, /NOT.*(trust boundary|inference)/i, 'as well as the boundary denial, so only the adapter half is under test');
    },
    packet: () => buildPacket({ delta: (d) => { d.mcp_scope = MCP_SCOPE_NO_ADAPTER; } }),
  },
  {
    id: 'MB-2',
    title: 'an mcp_scope that names MCP an adapter but never denies it is the inference trust boundary is rejected',
    why: 'the mirror half: calling MCP an adapter says what it is, and the denial says what it is NOT ' +
      'for this seam. Without the denial, an adapter declared out of scope still reads as something ' +
      'that could carry inference trust once it is in scope — which is the exact confusion this ' +
      'candidate exists to foreclose',
    match: MCP_BOUNDARY_DIAG,
    absent: { 'the OUT OF SCOPE diagnostic': MCP_OUT_OF_SCOPE_DIAG },
    guard: () => {
      assertMcpScopeHealthyToday();
      assert.ok(MCP_SCOPE.includes(ANCHOR_MCP_BOUNDARY_DENIAL), `mcp_scope must still contain '${ANCHOR_MCP_BOUNDARY_DENIAL.trim()}' today`);
      assert.match(MCP_SCOPE_NO_BOUNDARY_DENIAL, /adapter/i, 'the replacement must KEEP the adapter characterisation, so the row proves the denial half');
      assert.match(MCP_SCOPE_NO_BOUNDARY_DENIAL, /OUT OF SCOPE/i, 'and must KEEP the out-of-scope declaration');
      // The rule is a NEGATED-PHRASE match, not a word count: any surviving "not ... trust boundary"
      // or "not ... inference" anywhere in the string would satisfy it and make the row vacuous.
      assert.doesNotMatch(MCP_SCOPE_NO_BOUNDARY_DENIAL, /NOT.*(trust boundary|inference)/i, 'and must leave NO surviving denial the rule could match');
    },
    packet: () => buildPacket({ delta: (d) => { d.mcp_scope = MCP_SCOPE_NO_BOUNDARY_DENIAL; } }),
  },
];

for (const row of TRUST_DECLARATION_ROWS) {
  test(`${row.id}: ${row.title}`, () => {
    row.guard();
    const r = expectFail(row.packet(), row.why, row.match);
    for (const [what, diagnostic] of Object.entries(row.absent || {})) {
      assert.doesNotMatch(
        r.out,
        diagnostic,
        `${row.id} must fail on the rule it names and ONLY that rule — the run ALSO reported ${what}, ` +
          'so the mutation broke a sibling declaration and this proof would stay green even if the ' +
          `rule under test were deleted\n--- validator output ---\n${r.out}`,
      );
    }
  });
}

// --- 8.16 §6 successor-identity and mTLS + at+jwt security-bind failure rows ---
//
// Section 8.4 proves the ONE headline §6 identity rejection (the early half-flip of the successor
// status to ACCEPTED) and 8.5 proves the ONE headline bind rejection (the global AND weakened to an
// OR). Everything else §6 asserts about the successor's own identity block and its two-layer
// authorization bind — that it declares the pinned revision, says what it supersedes, records
// itself a PROPOSED successor, declares BOTH security schemes, documents the RFC 8705
// certificate-bound proof-of-possession on the token scheme, and AND-requires both schemes in ONE
// requirement object — is asserted by rules a reader would otherwise take on trust. The twelve rows
// below drive each of those rejection paths.
//
// The properties of 8.10/8.11 hold here too, and none is optional:
//   (a) IN-PROCESS. Every row mutates DATA (the successor bytes) and runs through buildPacket's
//       runValidation path, so `node --test --experimental-test-coverage` instruments the branch it
//       drives. No row spawns, so none is invisible to the 8.9 gate.
//   (b) ATOMIC TWO-SITE RE-PIN. Every row rewrites the successor, whose digest is declared at BOTH
//       candidate_members and ownership.proposed_successor. buildPacket re-pins the two sites from
//       the same bytes in the same step and expectFail asserts no pin-disagreement diagnostic
//       appears, so a row can never pass on stale-digest noise instead of the rule it names.
//   (c) EXACT BYTES, EXACT SHAPE, EXACT DIAGNOSTICS. Each row declares the MINIMAL whole-line delta
//       it makes (`removed`/`added`, after a common head/tail trim) — so a row cannot claim to
//       change only what it names while quietly rewriting a sibling line — then parses its own
//       mutated document and asserts the shape it means to present, then asserts the validator's
//       error list EXACTLY, string for string. Rows 6-8 list INVARIANT#OA-both as an expected
//       CONSEQUENCE: a scheme that is not declared cannot be AND-required, so that second sentence
//       is entailed by the row's own defect, not masking noise — and listing it exactly is what
//       proves nothing ELSE fired.
const OA_MTLS_SCHEME_LINES = [
  '    mutualTLS:',
  '      type: mutualTLS',
  '      description: >-',
  '        E2 mutually-authenticated TLS. The client presents an X.509 workload certificate; its',
  '        SHA-256 thumbprint MUST equal the delegation token cnf x5t#S256 (proof-of-possession). A',
  '        bearer-only, non-mTLS inference channel is not expressible on this seam (ADR-0008 D1).',
];
const OA_JWT_HEAD_LINES = [
  '    delegationToken:',
  '      type: http',
  '      scheme: bearer',
  '      bearerFormat: at+jwt',
];
const OA_JWT_DESCRIPTION_LINES = [
  '      description: >-',
  '        E3 short-lived W2-F delegation token — an asymmetric RFC 9068 at+jwt (no HS*/none),',
  '        certificate-bound per RFC 8705 (cnf/x5t#S256), <=120s, with strict iss/aud/jti/time',
  '        validation and the CYBRIK tenant/actor/operation/marking authorization claims. The relying',
  '        party validates AND re-authorizes the named operation (ADR-0008 D3); it never trusts the',
  '        request body over the token, nor the token over the mTLS peer certificate. This is NOT a',
  '        forwarded end-user token and NOT a static bearer.',
];
const OA_JWT_SCHEME_LINES = [...OA_JWT_HEAD_LINES, ...OA_JWT_DESCRIPTION_LINES];
const OA_SECURITY_SCHEMES_LINES = ['  securitySchemes:', ...OA_MTLS_SCHEME_LINES, ...OA_JWT_SCHEME_LINES];
const OA_SECURITY_REQUIREMENT_LINES = ['security:', '  - mutualTLS: []', '    delegationToken: []'];
// The neutralised token-scheme description of row OA-9: a description that still documents a
// short-lived asymmetric at+jwt but names NONE of the five proof-of-possession tokens §6 accepts.
const OA_NEUTRAL_JWT_DESCRIPTION =
  '      description: E3 short-lived W2-F delegation token — asymmetric RFC 9068 at+jwt, <=120s, never a forwarded end-user token.';
// The five alternatives §6 accepts as documentation of the two-layer bind. Row OA-9 is meaningful
// only if its replacement matches NONE of them and the untouched mTLS scheme still matches.
const OA_POP_TOKENS = /8705|cnf|x5t#S256|certificate-bound|proof-of-possession/i;

// Replace an exact, whole-line block with exact whole lines. The block is asserted UNIQUE in the
// text under mutation (a drifted anchor would otherwise rewrite the wrong site or nothing at all)
// and the replacement is asserted different from it, so no row can be a silent no-op.
const spliceLines = (text, block, replacement, what) => {
  const anchor = `${block.join('\n')}\n`;
  assert.equal(countOf(text, anchor), 1, `${what}: the block is absent or not unique in the document under mutation — re-derive it; never loosen it`);
  const body = replacement.length ? `${replacement.join('\n')}\n` : '';
  assert.notEqual(body, anchor, `${what}: the splice reproduces the bytes already on disk, so the mutation proves nothing`);
  return text.replace(anchor, () => body);
};

// The MINIMAL whole-line delta between two documents: the lines that a common head/tail trim leaves
// as genuinely removed and genuinely added.
const lineDelta = (before, after) => {
  const b = before.split('\n');
  const a = after.split('\n');
  let head = 0;
  while (head < b.length && head < a.length && b[head] === a[head]) head++;
  let tail = 0;
  while (tail < b.length - head && tail < a.length - head && b[b.length - 1 - tail] === a[a.length - 1 - tail]) tail++;
  return { removed: b.slice(head, b.length - tail), added: a.slice(head, a.length - tail) };
};

// The validator's error sentences, in order, stripped of the in-process runner's '  - ' bullet.
const errorList = (out) => out.split('\n').filter((l) => l.startsWith('  - ')).map((l) => l.slice(4));
const literalRx = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const DIAG_OA_STATUS = "transport OpenAPI: info.x-cybrik-status must be 'PROPOSED'";
const DIAG_OA_NOT_ACCEPTED = 'transport OpenAPI: info.x-cybrik-not-accepted must match the packet lifecycle';
const DIAG_OA_VERSION = "transport OpenAPI: info.version must be 0.2.0 to match the contract_version the delta pins for this member (got '0.1.0')";
const DIAG_OA_ROLE = 'transport OpenAPI: info.x-cybrik-lifecycle-role must record it as a PROPOSED-SUCCESSOR';
const DIAG_OA_SUPERSEDES =
  "transport OpenAPI: info.x-cybrik-supersedes must name the accepted predecessor 'cybrik-ai-inference-plane.v1.openapi.yaml' " +
  '(a compatible successor revision of the W2-D-owned plane, not a second plane) — ' +
  "got 'cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml'";
const DIAG_OA_MTLS = 'INVARIANT#OA-mtls: transport OpenAPI: a securityScheme of type mutualTLS must be declared (E2 mutually-authenticated channel)';
const DIAG_OA_JWT = 'INVARIANT#OA-jwt: transport OpenAPI: a securityScheme of type http/bearer with bearerFormat at+jwt must be declared (W2-F certificate-bound delegation token)';
const DIAG_OA_BOTH = 'INVARIANT#OA-both: transport OpenAPI: top-level security must AND-require BOTH the mutualTLS and the at+jwt delegation-token schemes together (bind mTLS + certificate-bound token)';
const DIAG_OA_POP = 'transport OpenAPI: the at+jwt delegation-token scheme description must document the RFC 8705 certificate-bound (cnf/x5t#S256) proof-of-possession';

const oaSchemes = (doc) => doc.components?.securitySchemes || {};
const oaSchemeOfType = (doc, pred) => Object.keys(oaSchemes(doc)).find((k) => pred(oaSchemes(doc)[k]));
const oaMtlsName = (doc) => oaSchemeOfType(doc, (s) => s?.type === 'mutualTLS');
const oaJwtName = (doc) => oaSchemeOfType(doc, (s) => s?.type === 'http' && String(s?.scheme).toLowerCase() === 'bearer' && /at\+jwt/i.test(s?.bearerFormat || ''));

const OPENAPI_BIND_ROWS = [
  {
    id: 'OA-1',
    title: 'a successor whose info block declares no x-cybrik-status at all is rejected',
    why: 'section 8.4 proves the EARLY HALF-FLIP (status already ACCEPTED). Its mirror — a successor ' +
      'that states no lifecycle at all — must fail just as closed: an unstated status is not a ' +
      'PROPOSED one, and a member that declares nothing cannot be shown to agree with the packet ' +
      'lifecycle the delta pins',
    mutate: (t) => spliceLines(t, ['  x-cybrik-status: PROPOSED'], [], 'OA-1'),
    removed: ['  x-cybrik-status: PROPOSED'],
    added: [],
    shape: (doc) => {
      assert.equal(doc.info['x-cybrik-status'], undefined, 'the successor must really have lost its status field');
      assert.equal(doc.info['x-cybrik-not-accepted'], true, 'its NOT-ACCEPTED sibling must survive untouched, so only the status rule is under test');
      assert.equal(doc.info['x-cybrik-lifecycle-role'], 'PROPOSED-SUCCESSOR', 'and the lifecycle role must survive, so the ownership sweep still classifies this document as a successor and reports nothing');
    },
    errors: [DIAG_OA_STATUS],
  },
  {
    id: 'OA-2',
    title: 'a successor claiming x-cybrik-not-accepted: false while the packet is PROPOSED is rejected',
    why: 'x-cybrik-not-accepted is the machine-readable half of the status pair. A member flipping it ' +
      'alone claims acceptance no gate recorded, and a status line still reading PROPOSED is exactly ' +
      'the cover such a claim would hide behind',
    mutate: (t) => spliceLines(t, ['  x-cybrik-not-accepted: true'], ['  x-cybrik-not-accepted: false'], 'OA-2'),
    removed: ['  x-cybrik-not-accepted: true'],
    added: ['  x-cybrik-not-accepted: false'],
    shape: (doc) => {
      assert.equal(doc.info['x-cybrik-not-accepted'], false, 'the successor must really claim it is accepted');
      assert.equal(doc.info['x-cybrik-status'], 'PROPOSED', 'while its status line still says PROPOSED, so ONLY the not-accepted rule can fire');
    },
    errors: [DIAG_OA_NOT_ACCEPTED],
  },
  {
    id: 'OA-3',
    title: 'a successor whose info.version is not the revision the delta pins is rejected',
    why: 'the delta pins this member at contract_version 0.2.0. A document declaring 0.1.0 in its own ' +
      'info block presents itself as the ACCEPTED predecessor revision while occupying the successor ' +
      'path — the two SemVer statements about one artifact must never disagree (ADR-0001 D1)',
    mutate: (t) => spliceLines(t, ['  version: 0.2.0'], ['  version: 0.1.0'], 'OA-3'),
    removed: ['  version: 0.2.0'],
    added: ['  version: 0.1.0'],
    shape: (doc) => {
      assert.equal(doc.info.version, '0.1.0', 'the successor must really declare the predecessor revision');
      assert.equal(
        delta.candidate_members.find((m) => m.file === SUCCESSOR_IN_CONTRACTS)?.contract_version,
        '0.2.0',
        'while the delta still pins 0.2.0 for this member — the disagreement the row proves',
      );
    },
    errors: [DIAG_OA_VERSION],
  },
  {
    id: 'OA-4',
    title: 'a successor whose lifecycle role no longer says PROPOSED is rejected',
    why: 'the role is what makes this document a PROPOSED successor rather than an owner. A role that ' +
      'drops the word without claiming CURRENT is the quiet case: the ownership sweep still counts it ' +
      'as a successor, so ONLY the §6 identity rule stands between an unlabelled document and green',
    mutate: (t) => spliceLines(t, ['  x-cybrik-lifecycle-role: PROPOSED-SUCCESSOR'], ['  x-cybrik-lifecycle-role: SUCCESSOR-REVISION'], 'OA-4'),
    removed: ['  x-cybrik-lifecycle-role: PROPOSED-SUCCESSOR'],
    added: ['  x-cybrik-lifecycle-role: SUCCESSOR-REVISION'],
    shape: (doc) => {
      const role = doc.info['x-cybrik-lifecycle-role'];
      assert.equal(role, 'SUCCESSOR-REVISION');
      assert.doesNotMatch(role, /PROPOSED/, 'no surviving PROPOSED anywhere in the role, or the rule under test is still satisfied and the row proves nothing');
      assert.doesNotMatch(role, /^CURRENT$/i, 'and the role must NOT claim CURRENT, so the ownership sweep keeps classifying this document as a successor and its verdict cannot mask the identity rule');
      assert.equal(doc.info['x-cybrik-status'], 'PROPOSED', 'the status must stay PROPOSED for the same reason');
    },
    errors: [DIAG_OA_ROLE],
  },
  {
    id: 'OA-5',
    title: 'a successor that names ITSELF as the document it supersedes is rejected',
    why: 'a successor that does not name the accepted predecessor it succeeds is a second plane by ' +
      'another name. Self-supersession is the sharpest form: the document claims a lineage that ' +
      'terminates in itself, leaving the accepted v0.1.0 with no declared successor at all',
    mutate: (t) => spliceLines(
      t,
      ['  x-cybrik-supersedes: cybrik-ai-inference-plane.v1.openapi.yaml'],
      ['  x-cybrik-supersedes: cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml'],
      'OA-5',
    ),
    removed: ['  x-cybrik-supersedes: cybrik-ai-inference-plane.v1.openapi.yaml'],
    added: ['  x-cybrik-supersedes: cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml'],
    shape: (doc) => {
      assert.equal(doc.info['x-cybrik-supersedes'], 'cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml');
      assert.equal(`openapi/${doc.info['x-cybrik-supersedes']}`, SUCCESSOR_IN_CONTRACTS, 'the forged value must be this document itself, or the row is not the self-supersession case it describes');
    },
    errors: [DIAG_OA_SUPERSEDES],
  },
  {
    id: 'OA-6',
    title: 'a successor declaring NO securitySchemes at all is rejected',
    why: 'the whole point of this revision is that every operation is authorized under BOTH layers of ' +
      'the accepted W2-F seam. A components block with no securitySchemes leaves a document that ' +
      'still LOOKS bound (its top-level security names both schemes) but defines neither, so nothing ' +
      'on the wire is actually required',
    mutate: (t) => spliceLines(t, OA_SECURITY_SCHEMES_LINES, [], 'OA-6'),
    removed: OA_SECURITY_SCHEMES_LINES,
    added: [],
    shape: (doc) => {
      assert.equal(doc.components.securitySchemes, undefined, 'the successor must really declare no securitySchemes');
      assert.ok(doc.components.parameters?.IdempotencyKey, 'the rest of the components block must survive — only the schemes may go');
      assert.deepEqual(doc.security, [{ mutualTLS: [], delegationToken: [] }], 'and the top-level requirement must survive verbatim, so the row proves the DECLARATION rules and not the bind rule');
    },
    // OA-both is ENTAILED: schemes that are not declared cannot be AND-required. Listing all three
    // sentences exactly is what proves no FOURTH rule fired.
    errors: [DIAG_OA_MTLS, DIAG_OA_JWT, DIAG_OA_BOTH],
  },
  {
    id: 'OA-7',
    title: 'a successor that drops the mutualTLS scheme is rejected',
    why: 'E2 is the transport half of the two-layer seam (ADR-0008 D1). A document keeping only the ' +
      'token scheme describes a bearer-only inference channel — precisely the shape the accepted seam ' +
      'says is not expressible on it',
    mutate: (t) => spliceLines(t, OA_MTLS_SCHEME_LINES, [], 'OA-7'),
    removed: OA_MTLS_SCHEME_LINES,
    added: [],
    shape: (doc) => {
      assert.equal(oaMtlsName(doc), undefined, 'no scheme of type mutualTLS may survive');
      assert.equal(oaJwtName(doc), 'delegationToken', 'while the at+jwt scheme must survive intact, so the OA-jwt rule cannot fire and only the mTLS half is under test');
      assert.deepEqual(Object.keys(oaSchemes(doc)), ['delegationToken'], 'exactly one scheme may remain');
    },
    errors: [DIAG_OA_MTLS, DIAG_OA_BOTH],
  },
  {
    id: 'OA-8',
    title: 'a successor that drops the at+jwt delegation-token scheme is rejected',
    why: 'the mirror half: E3 is the certificate-bound delegation token that carries the authoritative ' +
      'tenant/actor/operation/marking claims. mTLS alone authenticates a workload and authorizes ' +
      'nothing, so a document keeping only the transport layer binds no authorization at all',
    mutate: (t) => spliceLines(t, OA_JWT_SCHEME_LINES, [], 'OA-8'),
    removed: OA_JWT_SCHEME_LINES,
    added: [],
    shape: (doc) => {
      assert.equal(oaJwtName(doc), undefined, 'no http/bearer at+jwt scheme may survive');
      assert.equal(oaMtlsName(doc), 'mutualTLS', 'while the mutualTLS scheme must survive intact, so the OA-mtls rule cannot fire');
      assert.deepEqual(Object.keys(oaSchemes(doc)), ['mutualTLS'], 'exactly one scheme may remain');
    },
    errors: [DIAG_OA_JWT, DIAG_OA_BOTH],
  },
  {
    id: 'OA-9',
    title: 'an at+jwt scheme whose description documents no certificate binding is rejected',
    why: 'two schemes being CO-PRESENT is not the same as the token being BOUND to the certificate. ' +
      'The proof-of-possession requirement lives in the token scheme\'s own description, and a ' +
      'description that drops it leaves a reader — and a generated client — with a plain bearer ' +
      'token that happens to travel over mTLS',
    mutate: (t) => spliceLines(t, OA_JWT_DESCRIPTION_LINES, [OA_NEUTRAL_JWT_DESCRIPTION], 'OA-9'),
    removed: OA_JWT_DESCRIPTION_LINES,
    added: [OA_NEUTRAL_JWT_DESCRIPTION],
    shape: (doc) => {
      const name = oaJwtName(doc);
      assert.equal(name, 'delegationToken', 'the at+jwt scheme must still RESOLVE, or the OA-jwt declaration rule fires instead of the rule under test');
      assert.doesNotMatch(oaSchemes(doc)[name].description, OA_POP_TOKENS, 'the replacement must name NONE of the five documentation alternatives, or the rule stays satisfied and the row proves nothing');
      assert.match(
        oaSchemes(doc).mutualTLS.description,
        OA_POP_TOKENS,
        'while the mTLS scheme description keeps its own proof-of-possession sentence UNTOUCHED — that is what proves the rule reads the token scheme\'s own description rather than the document at large',
      );
      assert.deepEqual(doc.security, [{ mutualTLS: [], delegationToken: [] }], 'and the AND requirement must survive, so the bind rule cannot fire');
    },
    errors: [DIAG_OA_POP],
  },
  {
    id: 'OA-10',
    title: 'a top-level security that is not a list of requirement objects is rejected',
    why: 'the bind rule reads top-level security as a LIST. A scalar in that position is not an empty ' +
      'bind that fails loudly on its own — OpenAPI tooling would simply find no requirement it can ' +
      'evaluate — so the rule must fail closed on a non-list rather than treat it as unset',
    mutate: (t) => spliceLines(t, OA_SECURITY_REQUIREMENT_LINES, ['security: both-layers-are-required'], 'OA-10'),
    removed: OA_SECURITY_REQUIREMENT_LINES,
    added: ['security: both-layers-are-required'],
    shape: (doc) => {
      assert.equal(Array.isArray(doc.security), false, 'top-level security must really not be a list');
      assert.equal(typeof doc.security, 'string', 'it must parse to a scalar — the case the rule normalises to "no requirement at all"');
      assert.equal(oaMtlsName(doc), 'mutualTLS', 'both schemes must stay DECLARED, so only the bind rule can fire');
      assert.equal(oaJwtName(doc), 'delegationToken');
    },
    errors: [DIAG_OA_BOTH],
  },
  {
    id: 'OA-11',
    title: 'two single-scheme requirement objects, token first, are rejected as an OR bind',
    why: 'section 8.5 proves the canonically-ordered OR (mTLS object, then token object). This row ' +
      'proves the rule is a search for ONE object holding BOTH keys and not a positional check of ' +
      'the first entry: reversing the two objects still yields mTLS OR token, and a call presenting ' +
      'only a delegation token over an unauthenticated channel would satisfy the first entry alone',
    mutate: (t) => spliceLines(t, OA_SECURITY_REQUIREMENT_LINES, ['security:', '  - delegationToken: []', '  - mutualTLS: []'], 'OA-11'),
    removed: ['  - mutualTLS: []', '    delegationToken: []'],
    added: ['  - delegationToken: []', '  - mutualTLS: []'],
    shape: (doc) => {
      assert.deepEqual(doc.security, [{ delegationToken: [] }, { mutualTLS: [] }], 'the document must present exactly two single-scheme requirement objects, token first');
      assert.equal(doc.security.some((r) => 'mutualTLS' in r && 'delegationToken' in r), false, 'and NO object may hold both keys, or the AND bind survives and the row proves nothing');
    },
    errors: [DIAG_OA_BOTH],
  },
  {
    id: 'OA-12',
    title: 'a single requirement object that omits the delegation token is rejected',
    why: 'the nearest miss of all: ONE requirement object, correctly shaped, naming a scheme that is ' +
      'really declared — it just stops one key short. Dropping the TOKEN rather than the transport ' +
      'is the branch that forces the rule to evaluate both membership tests instead of short-circuiting ' +
      'on the first, so this is the row that proves the requirement object is checked for BOTH keys',
    mutate: (t) => spliceLines(t, OA_SECURITY_REQUIREMENT_LINES, ['security:', '  - mutualTLS: []'], 'OA-12'),
    removed: ['    delegationToken: []'],
    added: [],
    shape: (doc) => {
      assert.deepEqual(doc.security, [{ mutualTLS: [] }], 'exactly one requirement object naming exactly the transport layer');
      assert.equal(oaJwtName(doc), 'delegationToken', 'the token scheme must stay DECLARED but UNREQUIRED — declared-but-unbound is the defect, and it is invisible to the two declaration rules');
      assert.equal(oaMtlsName(doc), 'mutualTLS');
    },
    errors: [DIAG_OA_BOTH],
  },
];

for (const row of OPENAPI_BIND_ROWS) {
  test(`${row.id}: ${row.title}`, () => {
    const mutated = row.mutate(successorText);
    const changed = lineDelta(successorText, mutated);
    assert.deepEqual(
      changed,
      { removed: row.removed, added: row.added },
      `${row.id}: the mutation does not change EXACTLY the lines the row declares. A row that also ` +
        'rewrites a sibling line proves nothing about the rule it names, because the extra edit could ' +
        'be what the validator rejected.',
    );
    row.shape(YAML.parse(mutated));
    const r = expectFail(buildPacket({ successor: row.mutate }), row.why, literalRx(row.errors[0]));
    assert.deepEqual(
      errorList(r.out),
      row.errors,
      `${row.id} must fail on the rule it names and on nothing beyond the consequences it declares — ` +
        'the validator reported a different error set, so this proof could be certified by a rule the ' +
        `row never intended to break\n--- validator output ---\n${r.out}`,
    );
  });
}

// --- 8.17 structural TT operand mutations ------------------------------------
//
// Sections 8.2/8.11 drive the TT-4 conditional and the fixture-verdict paths. The table below drives
// the REMAINING structural TT assertions of validator section 4 at the OPERAND level: each row edits
// exactly one constant, enum member, anyOf branch or default inside a candidate (or reused accepted)
// JSON Schema, and requires the run to emit that rule's own INVARIANT# sentence.
//
// Why operand-level and not "delete the rule": every H(...) here is a CONJUNCTION or a quantifier
// over a set. A row that removed the whole $def would trip the compile step in validator section 1
// and never reach H() at all, so the assertion it names would stay unexercised. Every mutation below
// therefore keeps the schema parseable AND compilable — the packet still loads, the fixtures still
// run, and the only thing that changed is the one operand the row names.
//
// The section 8.11 properties hold here too:
//   (a) IN-PROCESS. Every row goes through buildPacket's runValidation path (no validator-source
//       mutation), so the coverage gate in 8.9 instruments the branch each row drives.
//   (b) EXACT DIAGNOSTIC. Every row matches the specific INVARIANT# sentence of the rule it names.
//       Several rows also break fixture verdicts as a declared CONSEQUENCE (a positive that no longer
//       validates, a negative-schema fixture the relaxed shape now admits); that collateral is
//       expected noise, never the thing being proven, which is why the matcher is the rule sentence.
//   (c) NON-VACUITY. Each row asserts the PRE-mutation operand really carries the honest value AND
//       the POST-mutation document really carries the defect, on top of buildPacket's own refusal of
//       a mutation that reproduces the bytes already on disk. Digests are re-pinned by buildPacket
//       for every candidate member it rewrites, so no row can pass on an integrity error instead.
const TT_TCOMMON_REL = 'json-schema/cybrik.transport-common-defs.v1.schema.json';
const TT_BINDING_REL = 'json-schema/cybrik.inference-transport-binding.v1.schema.json';
const TT_SVC_COMMON_REL = 'json-schema/cybrik.svc-common-defs.v1.schema.json';
const ttSvcCommonText = read(`contracts/${TT_SVC_COMMON_REL}`);
const ttBindingText = texts.get(`contracts/${TT_BINDING_REL}`);
const ttSerialize = (schema) => `${JSON.stringify(schema, null, 2)}\n`;

// The retryDisposition if/then whose anyOf carries the two escape branches TT-5 quantifies over.
const ttRetryThen = (schema) => {
  const allOf = schema.$defs.retryDisposition.allOf || [];
  const clause = allOf.find((s) => s?.if?.properties?.retriable?.const === true);
  assert.ok(clause, 'retryDisposition must carry the retriable=true if/then clause, or the branch rows have nothing to drop');
  return clause.then;
};
const ttRetryBranchIndex = (schema, prop) => {
  const i = (ttRetryThen(schema).anyOf || []).findIndex((s) => s?.properties?.[prop]?.const === true);
  assert.notEqual(i, -1, `the retriable=true anyOf must carry a ${prop}=true branch today, or dropping it is not a mutation`);
  return i;
};

const TT_OPERAND_ROWS = [
  {
    id: 'TT-OP-1',
    rel: TT_TCOMMON_REL,
    source: () => transportCommonText,
    title: "the transportProtocol const moved off 'rest/json' is rejected",
    why: 'versioned REST/JSON is the compatibility authority of this seam; if the const can be ' +
      'retargeted, an MCP-style or vendor-framed channel becomes structurally expressible and the ' +
      'trust boundary moves without a recorded decision',
    diag: "INVARIANT#TT-1b: transport-common-defs transportProtocol must be const 'rest/json' (versioned REST/JSON is the compatibility authority; MCP is not this trust boundary)",
    guard: (s) => {
      assert.equal(s.$defs.transportProtocol.const, 'rest/json', "transportProtocol must really be const 'rest/json' today, or retargeting it is not a mutation");
    },
    mutate: (s) => { s.$defs.transportProtocol.const = 'mcp/jsonrpc'; },
    shape: (s) => {
      assert.equal(s.$defs.transportProtocol.const, 'mcp/jsonrpc', 'the mutated schema must really declare the retargeted protocol const');
      assert.equal(typeof s.$defs.transportProtocol.type, 'string', 'the $def must stay a compilable string schema, or the run never reaches the structural assertion');
    },
  },
  {
    id: 'TT-OP-2',
    rel: TT_BINDING_REL,
    source: () => ttBindingText,
    title: 'body_advisory relaxed to additionalProperties:true is rejected',
    why: 'additionalProperties:false is the ONLY thing that denies a forwarded end-user token, a ' +
      'static bearer or a model/vendor/tool authority field a place to live in the advisory body; ' +
      'relaxed to true, every one of them becomes expressible without adding a single property',
    // TT-2 and TT-3 are BOTH conjunctions over this one operand, so relaxing it fires both. TT-2 is
    // the declared primary diagnostic of this row (the forwarded-token stance); TT-3 is listed as a
    // declared consequence rather than left to chance, so a future split of the two rules is visible
    // here instead of silently halving what this row proves.
    diag: 'INVARIANT#TT-2: inference-transport-binding body_advisory must be additionalProperties:false (no forwarded end-user token / static bearer)',
    also: ['INVARIANT#TT-3: inference-transport-binding body_advisory must forbid model/vendor/tool authority fields (additionalProperties:false; no model/tools property)'],
    guard: (s) => {
      assert.equal(s.properties.body_advisory.additionalProperties, false, 'body_advisory must really be closed today, or opening it is not a mutation');
      assert.equal('model' in s.properties.body_advisory.properties, false, 'body_advisory must declare no model property, so TT-3 can only fall over on the relaxed additionalProperties operand');
      assert.equal('tools' in s.properties.body_advisory.properties, false, 'body_advisory must declare no tools property, for the same reason');
    },
    mutate: (s) => { s.properties.body_advisory.additionalProperties = true; },
    shape: (s) => {
      assert.equal(s.properties.body_advisory.additionalProperties, true, 'the mutated schema must really admit undeclared advisory-body members');
      assert.equal(s.additionalProperties, false, 'the ROOT must stay closed, so this row proves the body_advisory operand and not the root one');
    },
  },
  {
    id: 'TT-OP-3',
    rel: TT_BINDING_REL,
    source: () => ttBindingText,
    title: 'an idempotency_key minLength shortened below 16 is rejected',
    why: 'the root idempotency_key mirrors the mandatory Idempotency-Key header; a shortened floor ' +
      'makes a create retry key guessable/forgeable, which is replay control in name only',
    diag: 'INVARIANT#TT-4a: inference-transport-binding idempotency_key minLength must be 16 (a create retry cannot be forged short)',
    guard: (s) => {
      assert.equal(s.properties.idempotency_key.minLength, 16, 'the key floor must really be 16 today, or lowering it is not a mutation');
      assert.equal(fixture('negative/inference-transport-binding.short-idempotency-key.json').idempotency_key.length, 5, 'the short-key witness must stay below the LOWERED floor too, so this row fires TT-4a alone and does not also flip that fixture verdict');
    },
    // 8, not 1: still a real weakening of the floor, still above the 5-char short-key witness, so the
    // negative-schema fixture keeps rejecting and TT-4a is the only rule this row disturbs.
    mutate: (s) => { s.properties.idempotency_key.minLength = 8; },
    shape: (s) => {
      assert.equal(s.properties.idempotency_key.minLength, 8, 'the mutated schema must really carry the lowered floor');
      assert.equal(s.properties.idempotency_key.maxLength, 200, 'the sibling ceiling must be untouched, so only the floor operand is under test');
    },
  },
  {
    id: 'TT-OP-4',
    rel: TT_TCOMMON_REL,
    source: () => transportCommonText,
    title: 'the retriable=true anyOf losing its is_safe branch is rejected',
    why: 'TT-5 quantifies over BOTH escape branches; with only the idempotency-guarded branch left, ' +
      'a safe read can no longer declare itself retriable, so the rule the packet documents is not ' +
      'the rule the schema encodes',
    diag: 'INVARIANT#TT-5: retryDisposition must force retriable=true => (is_safe OR idempotency_guarded) via if/then (no blind retry of a non-safe, non-idempotent op)',
    guard: (s) => {
      const anyOf = ttRetryThen(s).anyOf || [];
      assert.equal(anyOf.length, 2, 'the retriable=true then-clause must really offer both escape branches today');
      ttRetryBranchIndex(s, 'is_safe');
      ttRetryBranchIndex(s, 'idempotency_guarded');
    },
    mutate: (s) => { ttRetryThen(s).anyOf.splice(ttRetryBranchIndex(s, 'is_safe'), 1); },
    shape: (s) => {
      const anyOf = ttRetryThen(s).anyOf;
      assert.equal(anyOf.length, 1, 'exactly one escape branch must survive');
      assert.equal(anyOf[0].properties.idempotency_guarded.const, true, 'the SURVIVING branch must be the idempotency-guarded one, so this row proves the is_safe quantifier and not an empty anyOf');
    },
  },
  {
    id: 'TT-OP-5',
    rel: TT_TCOMMON_REL,
    source: () => transportCommonText,
    title: 'the retriable=true anyOf losing its idempotency_guarded branch is rejected',
    why: 'the mirror of the row above: with only the is_safe branch left, a key-guarded create can ' +
      'no longer be retriable, and the half of TT-5 that protects billed, side-effecting inferences ' +
      'is gone — one surviving branch must never be enough to satisfy the rule',
    diag: 'INVARIANT#TT-5: retryDisposition must force retriable=true => (is_safe OR idempotency_guarded) via if/then (no blind retry of a non-safe, non-idempotent op)',
    guard: (s) => {
      assert.equal((ttRetryThen(s).anyOf || []).length, 2, 'the retriable=true then-clause must really offer both escape branches today');
      ttRetryBranchIndex(s, 'idempotency_guarded');
    },
    mutate: (s) => { ttRetryThen(s).anyOf.splice(ttRetryBranchIndex(s, 'idempotency_guarded'), 1); },
    shape: (s) => {
      const anyOf = ttRetryThen(s).anyOf;
      assert.equal(anyOf.length, 1, 'exactly one escape branch must survive');
      assert.equal(anyOf[0].properties.is_safe.const, true, 'the SURVIVING branch must be the is_safe one, so this row proves the OTHER quantifier than the row above');
    },
  },
  {
    id: 'TT-OP-6',
    rel: TT_SVC_COMMON_REL,
    source: () => ttSvcCommonText,
    title: 'the composed token jwtAlg enum admitting a symmetric HS* algorithm is rejected',
    why: 'the delegation token is verified against pinned public trust; a shared-secret algorithm in ' +
      'the enum means anyone holding the verification secret can MINT a token, which collapses the ' +
      'mint-authority/relying-party split this seam is built on',
    diag: 'INVARIANT#TT-6b: the composed token jwtAlg enum must be asymmetric-only (no HS* symmetric, no unsecured none)',
    guard: (s) => {
      const e = s.$defs.jwtAlg.enum;
      assert.equal(e.some((a) => /^HS/i.test(a)), false, 'the accepted enum must really be free of symmetric algorithms today');
      assert.equal(e.includes('none'), false, 'the accepted enum must really be free of the unsecured algorithm today, so this row drives the HS operand alone');
    },
    mutate: (s) => { s.$defs.jwtAlg.enum.push('HS256'); },
    shape: (s) => {
      assert.equal(s.$defs.jwtAlg.enum.includes('HS256'), true, 'the mutated enum must really admit the symmetric algorithm');
      assert.equal(s.$defs.jwtAlg.enum.includes('none'), false, 'the mutated enum must NOT also admit the unsecured algorithm — that is the separate row below');
      assert.equal(s['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION', 'the reused accepted primitive must keep its lifecycle, so the run fails on the enum operand and not on a base-primitive relabel');
    },
  },
  {
    id: 'TT-OP-7',
    rel: TT_SVC_COMMON_REL,
    source: () => ttSvcCommonText,
    title: "the composed token jwtAlg enum admitting the unsecured 'none' algorithm is rejected",
    why: "'none' is a separate operand of the same conjunction: an unsecured token is not a weak " +
      'signature, it is NO signature, and it must be refused even by an enum that is otherwise free ' +
      'of symmetric algorithms',
    diag: 'INVARIANT#TT-6b: the composed token jwtAlg enum must be asymmetric-only (no HS* symmetric, no unsecured none)',
    guard: (s) => {
      assert.equal(s.$defs.jwtAlg.enum.includes('none'), false, "the accepted enum must really exclude 'none' today, or adding it is not a mutation");
    },
    mutate: (s) => { s.$defs.jwtAlg.enum.push('none'); },
    shape: (s) => {
      assert.equal(s.$defs.jwtAlg.enum.includes('none'), true, 'the mutated enum must really admit the unsecured algorithm');
      assert.equal(s.$defs.jwtAlg.enum.some((a) => /^HS/i.test(a)), false, 'no symmetric algorithm may ride along — this row must fall over on the none operand ALONE, which is what makes it distinct from the row above');
    },
  },
  {
    id: 'TT-OP-8',
    rel: TT_TCOMMON_REL,
    source: () => transportCommonText,
    title: 'an httpErrorStatus enum that drops a required status is rejected',
    why: 'the closed status set is what makes the typed error surface predictable; dropping 409 ' +
      'silently removes the idempotency-conflict status a relying party is told it can rely on',
    // The rule is length AND full coverage AND no 500. Swapping 409 for 410 preserves the LENGTH, so
    // the row is decided by the coverage quantifier rather than by an arity mismatch — the operand the
    // title names. (The trailing no-500 operand is unreachable at length 7: seven distinct members
    // cannot both cover the seven-status set and include 500, so no row can drive it in isolation.)
    diag: 'INVARIANT#TT-8a: httpErrorStatus enum must be exactly {400,401,403,409,422,429,503} (no 500 or other 5xx leaked)',
    guard: (s) => {
      const e = s.$defs.httpErrorStatus.enum;
      assert.deepEqual(e, [400, 401, 403, 409, 422, 429, 503], 'the accepted status enum must really be the closed seven-member set today');
      assert.equal(fixture('negative/transport-authorization-error.bad-status.json').status, 500, 'the out-of-set witness must stay 500, which the mutated enum still excludes, so this row does not also flip that fixture verdict');
    },
    mutate: (s) => { s.$defs.httpErrorStatus.enum = s.$defs.httpErrorStatus.enum.map((x) => (x === 409 ? 410 : x)); },
    shape: (s) => {
      const e = s.$defs.httpErrorStatus.enum;
      assert.equal(e.length, 7, 'the mutated enum must keep the accepted ARITY, so the row is decided by coverage and not by a length mismatch');
      assert.equal(e.includes(409), false, 'the mutated enum must really have lost the required status');
      assert.equal(e.includes(500), false, 'the mutated enum must NOT leak a 5xx, so the no-500 operand is not what this row trips');
    },
  },
  {
    id: 'TT-OP-9',
    rel: TT_TCOMMON_REL,
    source: () => transportCommonText,
    title: 'a transportErrorClass enum that drops a required class is rejected',
    why: 'the typed class set is the vocabulary a relying party maps to its fail-closed handling; a ' +
      'missing class does not become untyped, it becomes UNREPRESENTABLE, so the condition it names ' +
      'has to be reported as something else or not at all',
    diag: 'INVARIANT#TT-8c: transportErrorClass enum must carry the complete typed 400/401/403/409/422/429/503 class set (incl. the fail-closed internal class)',
    guard: (s) => {
      const e = s.$defs.transportErrorClass.enum;
      assert.equal(e.includes('replay_detected'), true, 'the class this row drops must really be declared today');
      for (const rel of ['positive/transport-authorization-error.json', 'negative/transport-authorization-error.fail-closed-false.json', 'negative/transport-authorization-error.leaked-token.json', 'negative/transport-authorization-error.bad-status.json']) {
        assert.notEqual(fixture(rel).error_class, 'replay_detected', `${rel} must not present the dropped class, so this row fires TT-8c alone and does not also flip a fixture verdict`);
      }
    },
    mutate: (s) => { s.$defs.transportErrorClass.enum = s.$defs.transportErrorClass.enum.filter((c) => c !== 'replay_detected'); },
    shape: (s) => {
      const e = s.$defs.transportErrorClass.enum;
      assert.equal(e.includes('replay_detected'), false, 'the mutated enum must really have lost the required class');
      assert.equal(e.includes('internal'), true, 'the fail-closed catch-all must survive, so this row proves the quantifier over the SET and not the absence of the terminal class');
    },
  },
  {
    id: 'TT-OP-10',
    rel: TT_TCOMMON_REL,
    source: () => transportCommonText,
    title: 'a featureFlagState.enabled default flipped ON is rejected',
    why: 'default OFF is what keeps a newly declared operation dark until someone turns it on; a ' +
      'default of true means an operation added to this seam is SERVED the moment it is declared, ' +
      'and the disabled_behavior the packet documents would never be reached',
    diag: 'INVARIANT#TT-flag-off: featureFlagState.enabled must DEFAULT false (feature flag default OFF) and require a fail-closed disabled_behavior',
    guard: (s) => {
      assert.equal(s.$defs.featureFlagState.properties.enabled.default, false, 'the flag default must really be OFF today, or flipping it is not a mutation');
      assert.equal(s.$defs.featureFlagState.required.includes('disabled_behavior'), true, 'the fail-closed disposition must really be required today, so the OTHER operand of this conjunction stays satisfied');
    },
    mutate: (s) => { s.$defs.featureFlagState.properties.enabled.default = true; },
    shape: (s) => {
      assert.equal(s.$defs.featureFlagState.properties.enabled.default, true, 'the mutated schema must really default the flag ON');
      assert.equal(s.$defs.featureFlagState.required.includes('disabled_behavior'), true, 'disabled_behavior must STILL be required, so this row is decided by the default operand alone');
    },
  },
];

for (const row of TT_OPERAND_ROWS) {
  test(`${row.id}: ${row.title}`, () => {
    const before = row.source();
    row.guard(JSON.parse(before));
    const mutated = JSON.parse(before);
    row.mutate(mutated);
    row.shape(mutated);
    const r = expectFail(
      buildPacket({ writeContracts: { [row.rel]: ttSerialize(mutated) } }),
      row.why,
      literalRx(row.diag),
    );
    for (const extra of row.also || []) {
      assert.match(
        r.out,
        literalRx(extra),
        `${row.id}: the row declares this diagnostic as a consequence of the same operand, but the ` +
          `run did not report it — the two rules no longer share the operand this row mutates\n` +
          `--- validator output ---\n${r.out}`,
      );
    }
  });
}

// --- 8.9 coverage gate -------------------------------------------------------
// When this file is itself run by `node --test`, the runner marks the file's process as a reporting
// CHILD via NODE_TEST_CONTEXT (=child-v8) and NODE_TEST_WORKER_ID. Those are inherited by anything we
// spawn, and a node:test process that believes it is a reporting child streams events to a parent
// runner instead of rendering its own summary — including the coverage table. The gate below then
// finds NO table and cannot distinguish "validator uncovered" from "table suppressed".
// Stripping the sentinels makes the spawned process a real top-level runner that renders a real
// coverage table; CYBRIK_W2I_COVERAGE_CHILD then skips ONLY this outer gate in that run, so the
// child executes the whole suite exactly once and cannot recurse.
const NODE_TEST_RECURSION_SENTINELS = ['NODE_TEST_CONTEXT', 'NODE_TEST_WORKER_ID'];

const coverageChildEnv = () => {
  const env = { ...process.env };
  for (const sentinel of NODE_TEST_RECURSION_SENTINELS) delete env[sentinel];
  env.CYBRIK_W2I_COVERAGE_CHILD = '1';
  return env;
};

test('validate-transport.mjs appears in the coverage table at >=80% line and branch', { skip: process.env.CYBRIK_W2I_COVERAGE_CHILD ? 'coverage child run' : false }, () => {
  const env = coverageChildEnv();
  for (const sentinel of NODE_TEST_RECURSION_SENTINELS) {
    assert.equal(sentinel in env, false, `${sentinel} must be removed from the child env, or the child reports as a runner child and emits no coverage table`);
  }
  const r = spawnSync(
    process.execPath,
    ['--test', '--experimental-test-coverage', 'tests/validate-transport.test.mjs'],
    { cwd: join(ROOT, 'tools', 'contract-validation'), encoding: 'utf8', env },
  );
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  assert.match(out, /file *\|/, `the coverage child emitted no coverage table at all — it did not run as a top-level runner:\n${out.slice(-4000)}`);
  const row = out.split('\n').find((l) => /validate-transport\.mjs/.test(l) && /\|/.test(l));
  assert.ok(row, `validate-transport.mjs is ABSENT from the coverage table — the validator was never instrumented:\n${out.slice(-4000)}`);
  const cols = row.split('|').map((c) => c.trim());
  const [line, branch, func] = [cols[1], cols[2], cols[3]].map(Number);
  assert.ok(Number.isFinite(line) && Number.isFinite(branch) && Number.isFinite(func), `unparsable coverage row: ${row}`);
  assert.ok(line >= 80, `validator line coverage ${line}% < 80%`);
  assert.ok(branch >= 80, `validator branch coverage ${branch}% < 80%`);
  assert.equal(r.status, 0, `the instrumented child suite must be green:\n${out.slice(-4000)}`);
});

// ---------------------------------------------------------------------------
// 9. Orchestrator disclosure, registry-diff minimality and harness portability.
//
// These families assert properties of the SURROUNDING evidence surface rather than of the
// candidate contract bytes. None of them touches lifecycle: W2-D stays the sole CURRENT owner,
// the successor stays PROPOSED — NOT ACCEPTED, and Gate W2-I stays NOT OPENED.
//
//   9.2 (P2-2) the orchestrator's success banner must disclose that one of its validation steps
//       covers the W2-I PROPOSED / NOT ACCEPTED candidate, so ALL GREEN can never be read as
//       acceptance or integration; and its header commentary must state the true step count.
//   9.3 (P2-3) the ADR registry README hunk must be minimal and purely additive against HEAD --
//       asserted from git diff, never from prose -- carrying the intended ADR-0011 / W2-I rows
//       and no unrelated status-backfill.
//   9.4 (P2-4) this harness must read nothing outside the checkout, must pin the in-scope Founder
//       packet by exact digest, and must never skip or silently return instead of witnessing it.
//
// The r2-generation family 9.1, which asserted the internal labelling of a docs/releases gate
// recorder document, is deliberately ABSENT: that recorder is outside this proposal's declared
// path scope, so a harness that read it would fail closed on a file this change never authored.
// Removing it narrows the evidence surface and relaxes no lifecycle rule. The docs/releases
// registry hunk is out of scope for the same reason and is no longer asserted.
// ---------------------------------------------------------------------------

const ORCHESTRATOR_REL = 'tools/contract-validation/validate.mjs';
const ADR_README_REL = 'docs/adr/README.md';
const SELF_REL = 'tools/contract-validation/tests/validate-transport.test.mjs';

const orchestratorText = read(ORCHESTRATOR_REL);
const selfText = texts.get(SELF_REL);

// --- 9.2 (P2-2) orchestrator disclosure and step-count honesty ---------------
const NUM_WORDS = new Map([
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
]);

const orchestratorStepCount = () => {
  const m = orchestratorText.match(/const steps = \[([\s\S]*?)\];/);
  assert.ok(m, 'the orchestrator must declare its validation steps as a literal array');
  return [...m[1].matchAll(/'([^']+\.mjs)'/g)].length;
};

test('P2-2: the orchestrator commentary states the true number of validators it runs', () => {
  const actual = orchestratorStepCount();
  assert.ok(actual > 0, 'the orchestrator must run at least one validation step');
  const claims = [...orchestratorText.matchAll(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b[^\n]{0,24}?\bvalidators?\b/gi)]
    .map((m) => ({ text: m[0], n: NUM_WORDS.get(m[1].toLowerCase()) ?? Number(m[1]) }));
  assert.ok(
    claims.length >= 1,
    `P2-2: the orchestrator states no validator count at all; it must state the accurate one (${actual})`,
  );
  for (const claim of claims) {
    assert.equal(
      claim.n,
      actual,
      `P2-2: the orchestrator claims "${claim.text.trim()}" but actually runs ${actual} validation steps — the stated count must be accurate`,
    );
  }
});

test('P2-2: the ALL GREEN banner discloses the W2-I PROPOSED / NOT ACCEPTED candidate step', () => {
  const m = orchestratorText.match(/console\.log\((['"`])(ALL GREEN[\s\S]*?)\1\)/);
  assert.ok(m, 'P2-2: the orchestrator must emit an ALL GREEN success banner to disclose against');
  const banner = m[2];
  assert.match(
    banner,
    /\bW2-I\b/,
    `P2-2: the success banner must name W2-I, because one validation step covers the W2-I candidate:\n${banner}`,
  );
  assert.match(
    banner,
    /PROPOSED/,
    `P2-2: the success banner must state that the W2-I candidate is PROPOSED:\n${banner}`,
  );
  assert.match(
    banner,
    /NOT ACCEPTED/,
    `P2-2: the success banner must state that the W2-I candidate is NOT ACCEPTED, so ALL GREEN can ` +
      `never be read as acceptance:\n${banner}`,
  );
  assert.match(
    banner,
    /validate-transport/,
    `P2-2: the success banner must name the specific step that covers the candidate:\n${banner}`,
  );
  assert.doesNotMatch(
    banner,
    /\b(integrated|deployed|released|runtime[- ]verified|authoriz)/i,
    `P2-2: the success banner must claim no integration, deployment, release or runtime result:\n${banner}`,
  );
});

// --- 9.3 (P2-3) registry README additive-byte preservation -------------------
// The check must survive a clean checkout and a later canonical merge. Comparing the worktree to
// HEAD is vacuous after commit, so remove only the three exact W2-I additions and pin every
// remaining base byte. Any unrelated edit, deletion, status backfill or duplicate then fails.
const ADR_README_BASE_SHA256 = 'dee1be038ddfc5b309529b12b4c0cedbd38131b0fbedcb983023d75ced4f7aa0';
const ADR_README_W2I_ADDITIONS = [
  '\nThe W2-I transport-binding candidate adds ADR-0011 as\n' +
    '`PROPOSED — NOT DECIDED — NOT APPLIED`; therefore the preceding ten-ADR statement describes the\n' +
    'accepted base catalog before this additive proposal and is not an acceptance statement for\n' +
    'ADR-0011. Gate W2-I is **`NOT OPENED`**.\n',
  '\n| [ADR-0011](ADR-0011-inference-plane-transport-binding-profile.md) | Inference-plane transport-binding profile | `PROPOSED — NOT DECIDED — NOT APPLIED`; Gate W2-I is **`NOT OPENED`** |',
  '\n| [FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md](FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md) | W2-I path-ownership record for the compatible inference transport-binding proposal | Option A recorded with `G-W2I-1..5=yes`; scope authority only. Gate W2-I is **`NOT OPENED`** and the proposal remains `PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED` |',
];
// W2-H/R5 §10.2 accepts ADR-0012 for implementation. The registry is a catalog,
// so it moves only its W2-H lifecycle wording; the base bytes below it are still
// pinned by ADR_README_BASE_SHA256. The literals mirror the accepted W2-K shape
// so one reading of this catalog covers both accepted packets.
const ADR_README_W2H_ADDITIONS = [
  '\nThe W2-H resource-bounds packet adds ADR-0012 as\n' +
    '`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`. Gate W2-H accepts the exact v0.1.0 packet for\n' +
    'implementation only under the delegated Governor R5 decision; it authorizes no runtime, UAT,\n' +
    'release, deployment, or production work.\n',
  '\n| [ADR-0012](ADR-0012-resource-bounds-contract-profile.md) | Conserved resource-bounds contract profile | `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`; Gate W2-H accepts the exact v0.1.0 packet for implementation only |',
  '\n| [DELEGATED-GOVERNOR-DECISION-W2-H-RESOURCE-BOUNDS-PROPOSAL.md](DELEGATED-GOVERNOR-DECISION-W2-H-RESOURCE-BOUNDS-PROPOSAL.md) | Gate W2-H bounded writer authorization for the W0-T11/RB resource-bounds contract packet | R5 records `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`; exact-path governance metadata and digest changes only, with no runtime, UAT, release, deployment, or production authority |',
];
const ADR_README_W2K_ADDITIONS = [
  '\nThe W2-K transport peer-evidence packet adds ADR-0013 as\n' +
    '`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`. Gate W2-K accepts the exact v0.1.0 packet for\n' +
    'implementation only under the delegated Governor R4 decision; it authorizes no runtime, UAT,\n' +
    'release, deployment, or production work.\n',
  '\n| [ADR-0013](ADR-0013-transport-peer-evidence-adapter-profile.md) | Transport peer-evidence adapter profile | `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`; Gate W2-K accepts the exact v0.1.0 packet for implementation only |',
  '\n| [DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE.md](DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE.md) | Gate W2-K bounded proposal, registration, wire-cleanup, and atomic-acceptance authority for the server-neutral transport peer-evidence packet | R4 records `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`; exact-path governance metadata and digest changes only, with no runtime, UAT, release, deployment, or production authority |',
];
const ADR_README_UAT_MTLS_ADDITIONS = [
  '\nThe UAT mTLS Anycorn decision is `D1 DEPENDENCY ARTIFACT COMPLETE — RUNTIME AUTHORED NOT RUN — D2 HOLD`. K5 records the\n' +
    'W2-K live-fact metadata/control amendment and S1 admits B1 only for bounded isolated UAT evaluation.\n' +
    'At `D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN`, B1 is `installed=true`, `pinned=true`,\n' +
    'product `selected=false` and HOLD; D2 remains HOLD and no release gate opens.\n',
  '\n| [DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md](DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md) | Bounded internal Anycorn B1 evaluation decision for SOC→AI lifecycle mTLS UAT | D1 records the exact isolated B1 artifact as `installed=true`, `pinned=true`, product `selected=false`, and HOLD; D2 and release remain separate gates |',
];
const ADR_README_DELEGATION_RECONCILIATION = {
  current:
    'Lifecycle: `PROPOSED` → `ACCEPTED` / `REJECTED` → (`SUPERSEDED`). Only the Founder or a\n' +
    'specifically delegated Governor decision moves an ADR out of `PROPOSED`; production remains\n' +
    'Founder-controlled. Product repositories may not implement against a `PROPOSED` ADR, and an\n' +
    '`ACCEPTED` ADR is a decision record — it is not by itself implementation authority.',
  base:
    'Lifecycle: `PROPOSED` → `ACCEPTED` / `REJECTED` → (`SUPERSEDED`). Only the Founder moves an\n' +
    'ADR out of `PROPOSED`. Product repositories may not implement against a `PROPOSED` ADR, and an\n' +
    '`ACCEPTED` ADR is a decision record — it is not by itself implementation authority.',
};

test(`P2-3: ${ADR_README_REL} preserves every byte outside exact registered additions`, () => {
  let normalized = read(ADR_README_REL);
  for (const addition of [
    ...ADR_README_W2I_ADDITIONS,
    ...ADR_README_W2H_ADDITIONS,
    ...ADR_README_W2K_ADDITIONS,
    ...ADR_README_UAT_MTLS_ADDITIONS,
  ]) {
    const occurrences = normalized.split(addition).length - 1;
    assert.ok(occurrences <= 1, `P2-3: duplicate registered addition:\n${addition}`);
    normalized = normalized.replace(addition, '');
  }
  assert.equal(
    normalized.split(ADR_README_DELEGATION_RECONCILIATION.current).length - 1,
    1,
    'P2-3: delegated-Governor lifecycle reconciliation must occur exactly once',
  );
  normalized = normalized.replace(
    ADR_README_DELEGATION_RECONCILIATION.current,
    ADR_README_DELEGATION_RECONCILIATION.base,
  );
  assert.equal(
    sha256(normalized),
    ADR_README_BASE_SHA256,
    'P2-3: docs/adr/README.md changed bytes outside the exact W2-I/W2-H additions and authority reconciliation',
  );
});

test('P2-3: the intended ADR-0011 / W2-I registry entries are retained', () => {
  const adr = read(ADR_README_REL);
  assert.match(adr, /ADR-0011/, 'P2-3: docs/adr/README.md must still register ADR-0011');
  assert.match(adr, /PROPOSED — NOT DECIDED — NOT APPLIED/, 'P2-3: the ADR-0011 entry must carry its PROPOSED lifecycle verbatim');
  assert.match(adr, /FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP\.md/, 'P2-3: docs/adr/README.md must still register the W2-I Founder path-ownership packet');
  assert.match(adr, /Gate W2-I is \*\*`NOT OPENED`\*\*/, 'P2-3: the ADR-0011 entry must state that Gate W2-I is NOT OPENED');
});

// The guard is scoped to the one ADR-0012 registry row. A catalog-wide regex
// would be satisfied by any other row carrying the same lifecycle string — the
// W2-I rows still do — so it would read green whatever ADR-0012 itself says.
const ADR_0012_ROW_PREFIX = '| [ADR-0012](ADR-0012-resource-bounds-contract-profile.md) |';

test('P2-3: the intended ADR-0012 / W2-H registry entries record bounded acceptance', () => {
  const adr = read(ADR_README_REL);
  const rows = adr.split('\n').filter((line) => line.startsWith(ADR_0012_ROW_PREFIX));
  assert.equal(
    rows.length,
    1,
    `P2-3: docs/adr/README.md must register ADR-0012 in exactly one row; found ${rows.length}`,
  );
  const [row] = rows;
  assert.match(
    row,
    /ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED/,
    `P2-3: the ADR-0012 row itself must carry the R5 accepted lifecycle:\n${row}`,
  );
  assert.doesNotMatch(
    row,
    /PROPOSED|NOT ACCEPTED/,
    `P2-3: the ADR-0012 row must not keep any proposal-lifecycle wording:\n${row}`,
  );
  assert.match(
    row,
    /Gate W2-H accepts the exact v0\.1\.0 packet for implementation only/,
    `P2-3: the ADR-0012 row must state the exact bounded acceptance:\n${row}`,
  );
  assert.match(adr, /DELEGATED-GOVERNOR-DECISION-W2-H-RESOURCE-BOUNDS-PROPOSAL\.md/);
  assert.match(adr, /production remains\s+Founder-controlled/i);
});

test('P2-3: the intended ADR-0013 / W2-K registry entries record bounded acceptance', () => {
  const adr = read(ADR_README_REL);
  assert.match(adr, /ADR-0013/, 'P2-3: docs/adr/README.md must register ADR-0013');
  assert.match(
    adr,
    /\[ADR-0013\]\(ADR-0013-transport-peer-evidence-adapter-profile\.md\)/,
    'P2-3: docs/adr/README.md must link the ADR-0013 document',
  );
  assert.match(adr, /Gate W2-K accepts the exact v0\.1\.0 packet for implementation only/);
  assert.match(adr, /ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED/);
  assert.match(adr, /DELEGATED-GOVERNOR-DECISION-W2-K-TRANSPORT-PEER-EVIDENCE\.md/);
  assert.match(adr, /production remains\s+Founder-controlled/i);
});

// --- 9.4 (P2-4) harness portability and the fail-closed Founder-packet witness ----
const ABS_ROOTS = ['U' + 'sers', 'home', 'root', 'var', 'tmp', 'opt', 'private'];
const ABS_LITERAL = new RegExp(`(['"\`])(/(?:${ABS_ROOTS.join('|')})/[^'"\`\\n]*)\\1`, 'g');

test('P2-4: this harness contains no machine-specific absolute path literal', () => {
  const offenders = [...selfText.matchAll(ABS_LITERAL)].map((m) => m[2]);
  assert.deepEqual(
    offenders,
    [],
    'P2-4: absolute path literal(s) in the harness. Every path must be derived from this ' +
      `checkout, so the suite is portable and reads nothing outside the worktree:\n${offenders.join('\n')}`,
  );
});

test('P2-4: this harness never short-circuits a witness on a missing file', () => {
  assert.doesNotMatch(
    selfText,
    /if\s*\(\s*!\s*existsSync\([^)]*\)\s*\)\s*return\s*;/,
    'P2-4: a witness returns silently when its subject is missing. On CI that renders the test a ' +
      'no-op that reports green without asserting anything; it must fail closed instead.',
  );
  const skipOpts = [...selfText.matchAll(/\{\s*skip:\s*([^\n]*)/g)].map((m) => m[1]);
  assert.equal(
    skipOpts.length,
    1,
    `P2-4: exactly one declared skip is expected (the coverage-child re-entry guard); got ${skipOpts.length}:\n${skipOpts.join('\n')}`,
  );
  assert.match(
    skipOpts[0],
    /CYBRIK_W2I_COVERAGE_CHILD/,
    `P2-4: the only permitted skip is the coverage-child re-entry guard; got: ${skipOpts[0]}`,
  );
});

test('P2-4: the Founder packet is pinned by an exact full SHA-256 constant in this harness', () => {
  assert.match(
    selfText,
    /const FOUNDER_PACKET_SHA256 = '[0-9a-f]{64}';/,
    'P2-4: the harness must pin the in-scope Founder decision packet by its exact full SHA-256, so ' +
      'byte drift fails the witness rather than passing unnoticed.',
  );
});

test('P2-4: any executable main guard compares normalized real paths', () => {
  assert.match(
    validatorText,
    /realpathSync\(self\) === realpathSync\(resolve\(argv1\)\)/,
    'P2-4: the validator main guard must compare normalized REAL paths on both sides. A raw ' +
      'string comparison lets a symlinked or non-normalized direct invocation skip the run and ' +
      'still exit 0 — a false green without ever validating.',
  );
});

// >>> UAT-MTLS-S1-R2-R3-D1-CONTROLS-BEGIN
// These witnesses keep the accepted K5/S1 boundary executable while D1 remains HOLD. They read
// governance bytes only: no package resolution, artifact, process, listener or runtime is needed.
const UAT_MTLS_DECISION_REL =
  'docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md';
const UAT_MTLS_GATE_REL =
  'docs/releases/GATE-UAT-MTLS-K5-S1-ACCEPTANCE-2026-08-01.md';
const UAT_MTLS_D1_R2_ADDITIONS = [
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/README.md',
  'integration/compose/README.md',
];
const UAT_MTLS_D1_EXPECTED_PATHS = [
  'integration/compose/soc-ai-lifecycle-create-mtls/pyproject.toml',
  'integration/compose/soc-ai-lifecycle-create-mtls/uv.lock',
  'integration/compose/soc-ai-lifecycle-create-mtls/patches/anycorn-0.20.0+cybrik.1.patch',
  'integration/compose/soc-ai-lifecycle-create-mtls/scripts/build_anycorn_patch.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/server.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/client.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_anycorn_patch_provenance.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_reproducible_wheel.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_patched_ssl_context.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_real_tls_extension.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py',
  ...UAT_MTLS_D1_R2_ADDITIONS,
  'tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh',
  'integration/compose/soc-ai-lifecycle-create-mtls/evidence/dependency-lock.json',
  'integration/compose/soc-ai-lifecycle-create-mtls/evidence/patch-provenance.json',
  'integration/compose/soc-ai-lifecycle-create-mtls/evidence/internal-wheel.json',
  'integration/compose/soc-ai-lifecycle-create-mtls/evidence/licenses.json',
  'integration/compose/soc-ai-lifecycle-create-mtls/evidence/sbom.cdx.json',
  'integration/compose/soc-ai-lifecycle-create-mtls/evidence/vex.cdx.json',
  'integration/compose/soc-ai-lifecycle-create-mtls/evidence/offline-reinstall.json',
  'docs/uat/candidates/README.md',
  'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/01-hold-status.md',
  'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/02-architecture-and-acceptance.md',
  'docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/runtime-admission.json',
];
const UAT_MTLS_D2_P0_AUTHORING_PATHS = [
  'docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md',
  'integration/compose/README.md',
  'integration/compose/soc-ai-lifecycle-create-mtls/README.md',
  'integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/policy.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/client.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/harness.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/pki.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/server.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/store.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_real_tls_extension.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_negative_cases.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_teardown.py',
  'tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh',
  'tools/contract-validation/tests/validate-transport.test.mjs',
];

const extractD1R2Additions = (decision) => {
  const section = mdSection(decision, '6. Prospective owner paths split by gate');
  assert.ok(section !== null, 'the mTLS decision must retain its exact section 6');
  const match = section.match(
    /S1 R2 expands the D1 maximum prospective allowlist by exactly these three existing paths and no others:\n\n((?:- `[^`]+`\n){3})\n`test_policy\.py` must separate/,
  );
  assert.ok(match, 'S1 R2 must declare one exact three-path D1 allowlist amendment');
  return [...match[1].matchAll(/^- `([^`]+)`$/gm)].map((item) => item[1]);
};

test('UAT mTLS S1 R2 keeps uv.lock registry-only and pins B1 outside the solver', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  assert.doesNotMatch(
    decision,
    /Only the internally versioned,[\s\S]{0,120}B1 wheel may enter this isolated lock/,
    'S1 R2 must remove the contradictory rule that an ephemeral B1 wheel enters uv.lock',
  );
  assert.match(decision, /registry-only third-party closure/);
  assert.match(decision, /`anycorn` is absent from the solver\s+and `uv\.lock`/);
  assert.match(decision, /`evidence\/internal-wheel\.json`/);
  assert.match(decision, /installed offline with `--no-deps` only after a\s+fail-closed SHA-256 check/);
  assert.match(
    decision,
    /No raw Anycorn distribution may enter the solver, `uv\.lock` or the\s+installed environment/,
  );
  assert.match(decision, /official `0\.20\.0` sdist is fetched only as hashed build input/);
  const sdistSha = 'e5555ddc95bc2df13908093ee11eff8f0a05165b9b9a368c28291065eab63927';
  assert.equal(
    countOf(decision, sdistSha),
    2,
    'the official source-fact pin and D1 endpoint gate must carry the same exact sdist SHA-256',
  );
});

test('UAT mTLS S1 R2 expands D1 by exactly the three required existing paths', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  const section = mdSection(decision, '6. Prospective owner paths split by gate');
  assert.ok(section !== null, 'the mTLS decision must retain its exact section 6');
  const fullList = section.match(
    /dependency installation\/build\s+authority:\n\n((?:- `[^`]+`\n)+)\nS1 R2 expands/,
  );
  assert.ok(fullList, 'section 6.2 must expose one finite D1 maximum-path list');
  const paths = [...fullList[1].matchAll(/^- `([^`]+)`$/gm)].map((item) => item[1]);
  assert.deepEqual(paths, UAT_MTLS_D1_EXPECTED_PATHS);
  assert.deepEqual(extractD1R2Additions(decision), UAT_MTLS_D1_R2_ADDITIONS);
  assert.match(decision, /dependency-neutral modules from the D1 runtime modules/);
  assert.match(decision, /removes no fail-closed purity, inventory or import coverage/);
  assert.match(decision, /Both README files must replace\s+their dependency-neutral-only claims/);
  assert.match(decision, /remain valid pre-D1 §6\.1 preparation paths/);
  assert.match(decision, /does not retroactively classify their already-accepted dependency-neutral bytes as D1 work/);
});

test('UAT mTLS S1 R2 makes clean-checkout, evidence and deterministic-build rules fail closed', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  assert.match(decision, /Committed-byte provenance tests must never import `anycorn`/);
  assert.match(decision, /`CYBRIK_UAT_D1_ARTIFACT_DIR`/);
  assert.match(decision, /not `skip`, `xfail` or\s+`todo`/);
  assert.match(decision, /`umask 022`/);
  assert.match(decision, /two\s+distinct absolute build directories/);
  assert.match(decision, /same-path rebuild does not satisfy reproducibility/);
  assert.match(decision, /CycloneDX SBOM and VEX documents are validated against their own schemas/);
  assert.match(decision, /Only bounded digests and\s+summaries enter the custom evidence sanitizer/);
  assert.match(decision, /must not weaken that sanitizer/);
  assert.match(decision, /wheelhouse, cache and clean build workspaces remain outside the repository/);
  assert.match(decision, /offline reinstall proof is scoped to the exact recorded platform/);
  assert.match(decision, /ephemeral gitignored `dist\/`/);
  assert.match(decision, /dependency-neutral command must name its four existing test files explicitly/);
  assert.match(decision, /collection-time imports may not turn an\s+unselected test into a missing-dependency failure/);
});

test('UAT mTLS S1 R3 controls remain pinned after D1 live-fact supersession', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  const gate = read(UAT_MTLS_GATE_REL);
  const executionSection = mdSection(decision, '10. Execution and evidence gates');
  assert.ok(executionSection !== null, 'the mTLS decision must retain its exact section 10');
  const d1Match = executionSection.match(
    /### Gate UAT-MTLS-D1 — dependency installation([\s\S]*?)(?=\n### Gate UAT-MTLS-D2)/,
  );
  assert.ok(d1Match, 'section 10 must retain one bounded D1 gate before D2');
  const d1 = d1Match[1];
  const outboundMatch = d1.match(
    /closed D1 HTTPS set:\n\n([\s\S]*?)\n\nD1 also permits/,
  );
  assert.ok(outboundMatch, 'Gate D1 must expose one finite closed HTTPS bullet list');
  const outboundBullets = outboundMatch[1]
    .split('\n')
    .filter((line) => line.startsWith('- '));
  assert.deepEqual(
    outboundBullets,
    [
      '- `https://pypi.org/pypi/anycorn/0.20.0/json` for release metadata;',
      '- the one exact `files.pythonhosted.org` sdist URL returned for `0.20.0`, accepted only when its',
      '- `https://api.osv.dev/v1/query` for the per-package advisory-database query; and',
      '- `https://pypi.org/simple` plus only the exact hash-pinned `files.pythonhosted.org` wheels needed',
    ],
  );

  for (const required of [
    'https://pypi.org/pypi/anycorn/0.20.0/json',
    'files.pythonhosted.org',
    'https://api.osv.dev/v1/query',
    'https://pypi.org/simple',
    'build-backend child processes',
    'SBOM/license/audit tooling',
  ]) {
    assert.ok(d1.includes(required), `S1 R3 must pin D1 outbound authority for ${required}`);
  }
  assert.doesNotMatch(d1, /querybatch/);
  assert.doesNotMatch(decision, /querybatch/);
  assert.match(decision, /vulnerability scan, recording each finding's severity/);
  assert.match(d1, /`pip-audit==2\.10\.1`/);
  assert.match(d1, /exact-hash tooling closure containing `pip-audit==2\.10\.1`/);
  assert.match(d1, /every tooling requirement is `==` pinned with at least one `--hash=sha256:`/);
  assert.match(d1, /same recorded CPython executable downloads only wheels with `--require-hashes` and\s+`--only-binary=:all:`/);
  assert.match(d1, /offline tooling install uses `--no-index`, `--find-links` and `--require-hashes`/);
  assert.match(d1, /tooling requirements and every tooling-wheel digest enter D1 evidence/);
  const auditCommandMatch = d1.match(/its audit command is exactly:\n\n```text\n([\s\S]*?)\n```/);
  assert.ok(auditCommandMatch, 'S1 R3 must retain one exact pip-audit command block');
  assert.equal(
    auditCommandMatch[1],
    [
      'pip-audit \\',
      '  --vulnerability-service osv \\',
      '  --osv-url https://api.osv.dev/v1/query \\',
      '  --require-hashes \\',
      '  --disable-pip \\',
      '  --no-deps \\',
      '  -r <OUTSIDE_REPO>/uv-exported-requirements.txt',
    ].join('\n'),
  );
  const wheelhouseCommandMatch = d1.match(/must create the wheelhouse with this exact command:\n\n```text\n([\s\S]*?)\n```/);
  assert.ok(wheelhouseCommandMatch, 'S1 R3 must retain one exact wheelhouse command block');
  assert.equal(
    wheelhouseCommandMatch[1],
    [
      'umask 022',
      '<PINNED_PYTHON_3_12_13> -m pip download \\',
      '  --require-hashes \\',
      '  --only-binary=:all: \\',
      '  --index-url https://pypi.org/simple \\',
      '  --cache-dir <OUTSIDE_REPO>/pip-cache \\',
      '  --dest <OUTSIDE_REPO>/wheelhouse \\',
      '  -r <OUTSIDE_REPO>/uv-exported-requirements.txt',
    ].join('\n'),
  );
  assert.match(d1, /CPython `3\.12\.13`/);
  assert.match(d1, /pip `26\.1\.1`/);
  assert.match(d1, /uv `0\.11\.16`/);
  assert.match(d1, /resolved to one recorded absolute executable path/);
  assert.doesNotMatch(d1, /uv pip download/);
  assert.match(d1, /registry-only UAT transitive-closure wheelhouse and the isolated/);
  assert.match(d1, /R2 opened the endpoint categories; S1 R3 corrects the OSV path and makes the\s+wheelhouse purpose explicit/);
  assert.match(d1, /pip-audit output records affected package\/version, vulnerability IDs and fix versions/);
  assert.match(d1, /raw OSV response for every audited package\/version/);
  assert.match(d1, /`database_specific\.severity`/);
  assert.match(d1, /missing, unrecognized or conflicting severity is `UNKNOWN`/);
  assert.match(d1, /Any `CRITICAL`, `HIGH` or `UNKNOWN` finding keeps the candidate `HOLD`/);
  for (const provenanceControl of [
    'independently recomputed per-wheel SHA-256 values',
    'every wheelhouse member is a wheel',
    '`anycorn` is absent',
    'no extra index or host',
    '`--no-index`, `--find-links` and `--require-hashes`',
    'fresh cache',
    '`Suite Integration/Release` owner must delete the outside-repository D1 artifact root within 24 hours after D1 merge',
    'raw Anycorn wheel is never downloaded or installed',
  ]) {
    assert.ok(d1.includes(provenanceControl), `S1 R3 must retain provenance control: ${provenanceControl}`);
  }
  assert.match(d1, /no listener, server, database, migration or product-runtime\s+authority/i);
  const r2 = mdSection(gate, 'S1 R2 D1 clarification');
  assert.ok(r2 !== null, 'the gate record must retain one exact S1 R2 clarification section');
  assert.match(r2, /S1-R2-D1-CLARIFICATION=ACCEPTED-BY-DELEGATED-GOVERNOR-D1-STILL-HOLD-PENDING-FOUNDER/);
  assert.match(r2, /Historical pre-D1 record/);
  assert.match(r2, /At R2 acceptance, D1 remained \*\*HOLD\*\*/);
  assert.match(r2, /D2 remains \*\*HOLD\*\*/);
  assert.match(r2, /UAT\/DEMO\/POC\/RC\/stable-v1\/GA remain NO-GO/);
  assert.match(r2, /Release dates remain\s+unchanged/);
  assert.match(r2, /`https:\/\/api\.osv\.dev\/v1\/querybatch`/);
  const r3 = mdSection(gate, 'S1 R3 D1 endpoint correction');
  assert.ok(r3 !== null, 'the gate record must add one exact S1 R3 endpoint-correction section');
  assert.match(r3, /S1-R3-D1-ENDPOINT-CORRECTION=ACCEPTED-BY-DELEGATED-GOVERNOR-D1-STILL-HOLD-PENDING-FOUNDER/);
  assert.match(r3, /`https:\/\/api\.osv\.dev\/v1\/query`/);
  assert.doesNotMatch(r3, /querybatch/);
  assert.match(r3, /Historical pre-D1 record/);
  assert.match(r3, /At R3 acceptance, D1 remained \*\*HOLD\*\*/);
  assert.match(r3, /D2 remains \*\*HOLD\*\*/);
  assert.match(r3, /UAT\/DEMO\/POC\/RC\/stable-v1\/GA remain NO-GO/);
  assert.match(r3, /Release dates remain\s+unchanged/);
  assert.match(
    decision,
    /- \*\*S1 R3 endpoint correction \(historical pre-D1\):\*\* `ACCEPTED BY DELEGATED GOVERNOR — D1 STILL HOLD PENDING FOUNDER`/,
  );
  assert.match(
    decision,
    /- `S1-R3-D1-ENDPOINT-CORRECTION=HISTORICAL-PRE-D1-ACCEPTED-BY-DELEGATED-GOVERNOR-D1-STILL-HOLD-PENDING-FOUNDER`/,
  );
  const self = read('tools/contract-validation/tests/validate-transport.test.mjs');
  assert.equal((self.match(/^\/\/ >>> UAT-MTLS-S1-R2-R3-D1-CONTROLS-BEGIN$/gm) ?? []).length, 1);
  assert.equal((self.match(/^\/\/ <<< UAT-MTLS-S1-R2-R3-D1-CONTROLS-END$/gm) ?? []).length, 1);
  assert.match(gate, /Decision date: 2026-08-01 \(Asia\/Ho_Chi_Minh\)\./);
  assert.match(gate, /Base commit: `76eea6a988251f3c5faf19169154e7bf0f4d7cc4`\./);
  assert.match(
    gate,
    /Outcome: \*\*K5 IMPLEMENTED BY D1 ARTIFACT ONLY; S1 HISTORICAL ACCEPTANCE; D2 HOLD — RUNTIME NOT RUN\*\*\./,
  );
  const d1Live = mdSection(gate, 'D1 live-fact supersession');
  assert.ok(d1Live !== null, 'the S1 gate must carry one current D1 live-fact supersession');
  assert.match(d1Live, /D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN/);
  assert.match(d1Live, /installed=true/);
  assert.match(d1Live, /pinned=true/);
  assert.match(d1Live, /D2 remains \*\*HOLD\*\*/);
  assert.match(d1Live, /UAT\/DEMO\/POC\/RC\/stable-v1\/GA remain NO-GO/);
});

test('UAT mTLS D2-P0 authoring reconciles the closed D1 scope without opening runtime', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  const match = decision.match(
    /### Gate UAT-MTLS-D2-P0 — preflight authoring([\s\S]*?)(?=\n### Gate UAT-MTLS-D2 — real runtime execution)/,
  );
  assert.ok(match, 'the ADR must define one D2-P0 authoring gate immediately before D2 runtime');
  const section = match[1];
  assert.match(section, /Current state: `AUTHORIZED — AUTHORING ONLY — RUNTIME HOLD`/);
  assert.match(section, /D1 remains complete for its consumed dependency\/build\/evidence action/);
  assert.match(section, /no D1 dependency authority is reused or reopened/);
  assert.match(section, /must not open a socket, start PostgreSQL, run a migration, generate PKI, or execute N1–N10/);
  assert.match(section, /D2 remains \*\*HOLD\*\*/);
  assert.match(section, /Release dates remain unchanged/);
  const scopeMatch = section.match(
    /maximum prospective authoring scope is exactly:\n\n((?:- `[^`]+`\n)+)\nNo other path/,
  );
  assert.ok(scopeMatch, 'D2-P0 must expose one exact finite authoring path list');
  const paths = [...scopeMatch[1].matchAll(/^- `([^`]+)`$/gm)].map((item) => item[1]);
  assert.deepEqual(paths, UAT_MTLS_D2_P0_AUTHORING_PATHS);
  assert.match(section, /`anycorn\.config\.Config\.create_ssl_context`/);
  assert.match(section, /`d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c`/);
  assert.match(section, /TLSv1\.3/);
});
// <<< UAT-MTLS-S1-R2-R3-D1-CONTROLS-END
