// validate-transport.test.mjs — citation/integrity/ownership tests for the W2-I transport-binding
// PROPOSED SUCCESSOR of the ACCEPTED W2-D inference OpenAPI member.
//
// LIFECYCLE (never asserted away by these tests): Gate W2-I was decided ACCEPT at human boundary
// HB-4 on 2026-08-20 and applied on 2026-08-21. The W2-I successor is now the SOLE CURRENT owner of
// the four inference operations and the v0.1.0 predecessor is SUPERSEDED-SUPPORTED and byte-frozen.
// Founder Option A (FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md, 2026-07-26) forbids a second
// independent path owner, so the binding entered ONLY as a delta-linked successor revision of the
// W2-D OpenAPI member — one owner before the flip, one owner after, never two.
//
// The `APPLIED` switch below is derived from the delta's own lifecycle field, exactly as the
// validator derives it. Every state-dependent assertion branches on it, and the pre-flip branches
// are kept rather than deleted: the mutation family (8) still has to prove the validator rejects a
// regression back into a half-flipped or unapplied shape.
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
// The lifecycle these tests run against, read from the SAME field the validator reads. Gate W2-I is
// decided and applied, so the post-flip branch is live; the pre-flip branch is retained because the
// mutation family must still be able to prove the validator rejects a regression back into it.
const APPLIED = delta['x-cybrik-status'] === 'ACCEPTED FOR IMPLEMENTATION';
const MEMBER_STATUS = APPLIED ? 'ACCEPTED FOR IMPLEMENTATION' : 'PROPOSED';

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

test('the transport-binding ADR is declared as ADR-0011 and its status tracks the gate', () => {
  assert.ok(candidateEntry, `the delta adr_basis must declare the candidate ${CANDIDATE_ADR}`);
  assert.ok(adrRecordExists(CANDIDATE_ADR), `${CANDIDATE_ADR} must be authored as a real docs/adr record`);
  const rec = adrRecordText(CANDIDATE_ADR);
  if (APPLIED) {
    // Decided: the delta and the ADR record must BOTH say so, and neither may keep a not-yet
    // qualifier. A record still reading PROPOSED behind an accepted packet is the documentation half
    // of a half-flip, and is exactly as misleading as the byte half.
    assert.equal(candidateEntry.status, 'ACCEPTED');
    assert.doesNotMatch(candidateEntry.status, /NOT (ACCEPTED|DECIDED|APPLIED)/, 'an accepted ADR entry must not keep a not-yet qualifier');
    assert.match(candidateEntry.role, /Inference-plane transport-binding profile, DECIDED ACCEPT at Gate W2-I/);
    assert.match(rec, /^- Status: `ACCEPTED`/m, 'the ADR-0011 record must carry an ACCEPTED status line');
    assert.match(rec, /^- Date decided: 2026-08-20/m, 'the ADR-0011 record must carry the date the gate decided');
    assert.match(rec, /HB-4/, 'the ADR-0011 record must name the human boundary the decision was taken at');
  } else {
    assert.equal(candidateEntry.status, 'PROPOSED — NOT DECIDED — NOT APPLIED');
    assert.match(candidateEntry.role, /^Candidate inference-plane transport-binding profile evaluated by Gate W2-I\./);
    assert.match(rec, /PROPOSED — NOT DECIDED/, 'the ADR-0011 record must carry a PROPOSED — NOT DECIDED status');
  }

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
  // Self-denial survives the flip: an applied delta is a consumed review record, and a record that
  // grew into a manifest would be the second manifest Option A refused, under a delta's filename.
  assert.equal(delta['x-cybrik-applied'], APPLIED, 'x-cybrik-applied must agree with the delta lifecycle');
  for (const forbidden of ['members', 'x-cybrik-packet-version', 'x-cybrik-is-bundle-tag', 'x-cybrik-packet-id']) {
    assert.ok(!(forbidden in delta), `the delta must not grow the manifest-shaped field '${forbidden}'`);
  }
  assert.match(String(delta['x-cybrik-grants']), /NO ACCEPTANCE AUTHORITY/, 'the delta never grants acceptance authority, applied or not');
  if (APPLIED) {
    assert.match(String(delta['x-cybrik-applies-at']), /APPLIED at the Gate W2-I status flip/);
    assert.match(String(delta['x-cybrik-applied-on']), /^\d{4}-\d{2}-\d{2}$/, 'an applied delta records when the flip touched the bytes');
  } else {
    assert.match(String(delta['x-cybrik-applies-at']), /future Gate W2-I status flip/);
  }
});

test('every delta candidate-member sha256 matches its on-disk bytes', () => {
  const members = delta.candidate_members || [];
  assert.equal(members.length, 4, 'the delta pins exactly four candidate member digests (3 schemas + the successor OpenAPI)');
  for (const m of members) {
    assert.equal(sha256File(join(CONTRACTS, m.file)), m.sha256, `candidate member ${m.file}: pinned sha256 is stale — re-pin after any edit`);
    assert.equal(m.status, MEMBER_STATUS, `candidate member ${m.file} must carry the packet lifecycle status`);
    if (APPLIED) {
      // Both digests, so "the flip changed only the lifecycle header" is checkable rather than
      // asserted: the reviewed byte and the applied byte are each recorded, and they must differ.
      assert.match(String(m.sha256_at_proposal), /^[0-9a-f]{64}$/, `candidate member ${m.file} must retain the digest the gate reviewed`);
      assert.notEqual(m.sha256_at_proposal, m.sha256, `candidate member ${m.file} records identical pre- and post-flip digests, so the status flip never touched it`);
    }
  }
});

test('the delta pins the UPSTREAM accepted W2-D manifest and OpenAPI bytes exactly', () => {
  const pins = delta.upstream_pins?.accepted || [];
  assert.equal(pins.length, 2, 'the delta pins exactly the accepted W2-D packet manifest and the accepted W2-D OpenAPI predecessor');
  const byFile = Object.fromEntries(pins.map((p) => [p.file, p]));
  const manifestPin = byFile['compatibility/cybrik-suite-inference-packet.v1.manifest.json'];
  assert.equal(byFile['openapi/cybrik-ai-inference-plane.v1.openapi.yaml']?.sha256, sha256File(join(ROOT, PREDECESSOR_REL)));
  if (APPLIED) {
    // The accepted manifest is the TARGET of the flip, so post-flip it is the one upstream pin whose
    // bytes are expected to have moved. It therefore carries two digests: what was reviewed, and what
    // is on disk. Collapsing them to one would make "reviewed, then applied" indistinguishable from
    // "re-pinned to whatever is there now".
    assert.equal(manifestPin?.byte_frozen_through_flip, false, 'the accepted manifest is the flip target and must say so');
    assert.equal(manifestPin?.sha256_after_flip, sha256File(join(ROOT, W2D_MANIFEST_REL)), 'sha256_after_flip must match the accepted manifest on disk');
    assert.notEqual(manifestPin?.sha256, manifestPin?.sha256_after_flip, 'identical pre/post digests would mean the flip never modified the accepted manifest');
    assert.equal(byFile['openapi/cybrik-ai-inference-plane.v1.openapi.yaml']?.byte_frozen_through_flip, true, 'the predecessor is byte-frozen through the flip');
  } else {
    assert.equal(manifestPin?.sha256, sha256File(join(ROOT, W2D_MANIFEST_REL)));
  }
});

test('the superseded W2-D predecessor document shows zero diff against HEAD', () => {
  // Byte-freeze is the load-bearing half of supersession (G-W2I-4): the manifest relabels the member
  // row, and the superseded DOCUMENT is never rewritten. The accepted manifest itself is deliberately
  // excluded post-flip — it is the artifact the flip was supposed to change, and its integrity is
  // covered by the two-digest upstream pin above instead.
  const frozen = APPLIED ? [PREDECESSOR_REL] : [PREDECESSOR_REL, W2D_MANIFEST_REL];
  for (const rel of frozen) {
    const r = spawnSync('git', ['diff', '--exit-code', '--', rel], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `${rel}: byte-frozen W2-D bytes must be unchanged (G-W2I-4)\n${r.stdout}`);
    const staged = spawnSync('git', ['diff', '--cached', '--exit-code', '--', rel], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(staged.status, 0, `${rel}: byte-frozen W2-D bytes must be unchanged in the index too\n${staged.stdout}`);
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

test('exactly one owner per (method, path), with supersession read from the accepted manifest', () => {
  // This mirrors the validator's sweep independently, from the same authority: a superseded document
  // keeps its own ACCEPTED FOR IMPLEMENTATION status forever (its bytes are frozen), so ownership
  // cannot be read from the document alone. The accepted manifest's member rows are what say which
  // document was demoted.
  const w2d = JSON.parse(read(W2D_MANIFEST_REL));
  const superseded = new Set((w2d.members || []).filter((m) => m.lifecycle === 'SUPERSEDED-SUPPORTED').map((m) => m.file));
  const dir = join(CONTRACTS, 'openapi');
  const owners = new Map();
  for (const f of readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
    const doc = YAML.parse(readFileSync(join(dir, f), 'utf8'));
    const status = doc.info?.['x-cybrik-status'];
    const declared = doc.info?.['x-cybrik-lifecycle-role'] || (status === 'ACCEPTED FOR IMPLEMENTATION' ? 'CURRENT' : 'PROPOSED-SUCCESSOR');
    const role = superseded.has(`openapi/${f}`) && declared === 'CURRENT' ? 'SUPERSEDED' : declared;
    for (const [p, item] of Object.entries(doc.paths || {})) {
      for (const method of Object.keys(item)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        const key = `${method.toUpperCase()} ${p}`;
        if (!owners.has(key)) owners.set(key, { CURRENT: [], 'PROPOSED-SUCCESSOR': [], SUPERSEDED: [] });
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
    const o = owners.get(k);
    if (APPLIED) {
      // Post-flip: the successor owns, the predecessor is demoted but STILL PRESENT, and no proposal
      // survives. Requiring the predecessor to remain is what stops "delete it" passing as a flip.
      assert.deepEqual(o.CURRENT, ['cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml'], `${k}: the successor is the sole CURRENT owner after the flip`);
      assert.deepEqual(o.SUPERSEDED, ['cybrik-ai-inference-plane.v1.openapi.yaml'], `${k}: the predecessor must remain on disk as SUPERSEDED-SUPPORTED`);
      assert.equal(o['PROPOSED-SUCCESSOR'].length, 0, `${k}: no proposed successor may survive the flip`);
    } else {
      assert.deepEqual(o.CURRENT, ['cybrik-ai-inference-plane.v1.openapi.yaml'], `${k}: the predecessor is the sole CURRENT owner before the flip`);
      assert.equal(o['PROPOSED-SUCCESSOR'].length, 1, `${k}: the four inference pairs each carry exactly one PROPOSED successor`);
    }
  }
});

test('the successor declares its delta link and its lifecycle tracks the gate', () => {
  assert.equal(successor.openapi, '3.1.1');
  assert.equal(successor.info.version, '0.2.0');
  assert.equal(successor.info['x-cybrik-status'], APPLIED ? 'ACCEPTED FOR IMPLEMENTATION' : 'PROPOSED');
  assert.equal(successor.info['x-cybrik-not-accepted'], !APPLIED);
  assert.equal(successor.info['x-cybrik-lifecycle-role'], APPLIED ? 'CURRENT' : 'PROPOSED-SUCCESSOR');
  assert.equal(successor.info['x-cybrik-supersedes'], 'cybrik-ai-inference-plane.v1.openapi.yaml');
  assert.equal(successor.info['x-cybrik-delta-ref'], '../compatibility/cybrik-suite-inference-packet.v1.w2i-proposed-delta.json');
  assert.ok(!('servers' in successor), 'the successor must declare no servers block');
  // The predecessor's OWN status never moves, in either state: supersession is recorded in the
  // manifest, so relabelling it here would be the byte rewrite G-W2I-4 forbids.
  assert.equal(predecessor.info['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION', 'the predecessor document keeps its own accepted status, before and after supersession');
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
  if (APPLIED) {
    assert.match(delta.gate?.status || '', /^DECIDED — ACCEPTED FOR IMPLEMENTATION/);
    assert.doesNotMatch(delta.gate?.status || '', /NOT OPENED|awaiting/i, 'a decided gate must not still read as awaiting a decision');
    assert.match(delta.acceptance?.status || '', /^ACCEPTED FOR IMPLEMENTATION/);
    assert.doesNotMatch(delta.acceptance?.status || '', /\bNOT ACCEPTED\b/);
    for (const k of ['gate', 'decided_by', 'decided_on']) {
      assert.ok(delta.acceptance?.[k], `an accepted delta must record acceptance.${k}`);
    }
    assert.ok((delta.acceptance?.evidence || []).length > 0, 'an accepted delta must record acceptance.evidence[]');
    // The open items acceptance did NOT discharge stay recorded. The W2-F operation-token gap was
    // BLOCKING before the gate and the gate did not amend W2-F, so it must survive as an open item;
    // silently dropping it at the flip is the failure this assertion exists to prevent.
    const open = JSON.stringify(delta.gate?.open_items || []);
    assert.match(open, /W2-F/, 'the undischarged W2-F operation-token amendment must remain an open item after acceptance');
    assert.match(open, /UNDISCHARGED/, 'the W2-F item must be marked undischarged, not quietly reworded into a resolved one');
  } else {
    assert.match(delta.gate?.status || '', /NOT OPENED/);
    assert.match(delta.acceptance?.status || '', /NOT ACCEPTED/);
  }
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
  for (const readToken of ['ai.model_classes.list', 'ai.model_class_health.read']) {
    const vs = byToken[readToken].vocabulary_status;
    if (APPLIED) {
      // The gap the gate did NOT close. Accepting the transport binding accepted these tokens on the
      // transport seam only; the accepted W2-F table still names just the two creates. The status
      // string has to keep saying so, or an implementer reads "ACCEPTED" and issues a delegation
      // token naming an operation the accepted vocabulary cannot resolve.
      assert.match(vs, /^ACCEPTED W2-I transport vocabulary, NOT YET ACCEPTED W2-F delegation vocabulary/, `${readToken}: the W2-F vocabulary gap must survive W2-I acceptance`);
      assert.match(vs, /UNDISCHARGED/, `${readToken}: the W2-F amendment must be recorded as an undischarged obligation`);
    } else {
      assert.match(vs, /^W2-I PROPOSED — NOT ACCEPTED/);
    }
  }
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
  assert.equal(d3.predecessor_byte_frozen, true);
  assert.match(d3.retirement_floor, /180 days/);
  assert.match(d3.retirement_floor, /two subsequent minor releases/);
  assert.match(d3.retirement_floor, /max\(/i);
  if (APPLIED) {
    assert.equal(d3.predecessor_disposition_decided, 'SUPERSEDED-SUPPORTED');
    assert.match(String(d3.effective_on), /^\d{4}-\d{2}-\d{2}$/, 'a decided supersession has an effective date');
    assert.equal(d3.dates_binding, true, 'the decided effective date binds');
    // But the RETIREMENT date still does not exist: D3's floor is max(180 days, two subsequent minor
    // releases), and the release-count bound cannot be met at the flip. Publishing a retirement date
    // here would be fabricating the half of the floor that has not happened.
    assert.equal(d3.retirement_date_fixed, false, 'no retirement date is derivable at the flip — the two-minor-release bound is unmet');
    assert.equal(d3.release_dates_consumed, false, 'a contract supersession consumes no W0-W6 release date');
    assert.match(d3.final_disposition_status, /^DECIDED/);
  } else {
    assert.equal(d3.predecessor_disposition_proposed, 'SUPERSEDED-SUPPORTED');
    assert.equal(d3.dates_binding, false, 'D3 dates are PROPOSED, never binding');
  }
});

test('D6: the accepted W2-D manifest and the candidate agree, in whichever state the gate is in', () => {
  const m = JSON.parse(read(W2D_MANIFEST_REL));
  const files = (m.members || []).map((x) => x.file);
  if (!APPLIED) {
    // D6 proper: an accepted packet may not reference an unaccepted one.
    for (const f of files) {
      assert.doesNotMatch(f, /contract-0\.2\.0|w2i-proposed-delta|transport/, `accepted W2-D manifest must not reference candidate member ${f} before the flip`);
    }
    assert.doesNotMatch(JSON.stringify(m), /w2i-proposed-delta|contract-0\.2\.0/, 'the accepted W2-D manifest must not mention the candidate at all before the flip');
    return;
  }
  // Post-flip the inverse is the invariant: the flip was whole, or it was not a flip. Every absorbed
  // member is declared at a digest agreeing with the delta, the predecessor is relabelled rather than
  // dropped, and the decision that authorized all of it is recorded in the manifest itself.
  const rows = new Map(files.map((f, i) => [f, m.members[i]]));
  for (const cm of delta.candidate_members) {
    const row = rows.get(cm.file);
    assert.ok(row, `the accepted W2-D manifest must declare absorbed member ${cm.file}`);
    assert.equal(row.sha256, cm.sha256, `${cm.file}: the manifest and the delta must pin the same bytes`);
    assert.equal(sha256File(join(ROOT, 'contracts', cm.file)), row.sha256, `${cm.file}: the manifest pin must match the bytes on disk`);
  }
  const predRow = rows.get('openapi/cybrik-ai-inference-plane.v1.openapi.yaml');
  assert.ok(predRow, 'the superseded predecessor row must survive the flip — deleting it would destroy the deprecation window');
  assert.equal(predRow.lifecycle, 'SUPERSEDED-SUPPORTED');
  assert.equal(predRow.superseded_by, 'openapi/cybrik-ai-inference-plane.v1.contract-0.2.0.openapi.yaml');
  assert.equal(predRow.byte_frozen, true);
  const acc = m.w2i_transport_binding_acceptance;
  assert.ok(acc, 'the accepted manifest must record the decision that authorized the absorbed members');
  assert.equal(acc.gate, 'W2-I');
  assert.equal(acc.decision, 'ACCEPT');
  assert.ok(acc.decided_by && acc.decided_on, 'the recorded acceptance names a decider and a date');
  assert.ok((acc.carried_forward_obligations || []).some((o) => /W2-F/.test(o)), 'the undischarged W2-F obligation must be recorded in the accepted manifest, not only in the delta');
  assert.equal(m['x-cybrik-packet-version'], '0.1.0', 'absorbing members is not a packet re-version');
  assert.equal(m['x-cybrik-is-bundle-tag'], false, 'a status flip is not a bundle-tag promotion');
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
    // THIRD DECLARATION SITE, post-flip only. Once the flip is applied the ACCEPTED W2-D manifest
    // declares the absorbed members at their own digests, and validate-transport.mjs §3f cross-checks
    // them against the delta. Re-pinning only the delta would make every successor/schema mutation
    // fail on a manifest-vs-delta pin disagreement instead of on the rule under test — the same
    // vacuity trap the two ownership sites above exist to avoid, one site further out. A real edit
    // has to re-pin all three, so the harness does too. The manifest's own pin inside the delta
    // (upstream_pins / proposed_manifest_changes.sha256_after_flip) is re-pinned last, because
    // rewriting the member rows changes the manifest bytes those two sites describe.
    const tManifestAbs = join(tContracts, 'compatibility', 'cybrik-suite-inference-packet.v1.manifest.json');
    if (existsSync(tManifestAbs)) {
      const tManifest = JSON.parse(readFileSync(tManifestAbs, 'utf8'));
      let touched = false;
      for (const row of tManifest.members || []) {
        if (!row || typeof row.file !== 'string' || typeof row.sha256 !== 'string') continue;
        const abs = join(tContracts, row.file);
        if (!existsSync(abs)) continue;
        const fresh = sha256File(abs);
        if (fresh !== row.sha256) { row.sha256 = fresh; touched = true; }
      }
      if (touched) {
        writeFileSync(tManifestAbs, `${JSON.stringify(tManifest, null, 2)}\n`);
        const manifestSha = sha256File(tManifestAbs);
        if (tDelta.proposed_manifest_changes?.target_manifest?.sha256_after_flip) {
          tDelta.proposed_manifest_changes.target_manifest.sha256_after_flip = manifestSha;
        }
        for (const u of tDelta.upstream_pins?.accepted || []) {
          if (u?.file === 'compatibility/cybrik-suite-inference-packet.v1.manifest.json' && u.sha256_after_flip) u.sha256_after_flip = manifestSha;
        }
      }
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

// A HALF-FLIP is a member and its packet disagreeing about the lifecycle. It has two directions and
// both must fail: the member running ahead of the packet (an early flip, before the gate decided)
// and the member lagging behind it (a stale member the flip missed). Which direction is reachable
// depends on where the packet currently is, so the row mutates AWAY from the current state either
// way — the point is the disagreement, never the particular value.
test('a half-flipped successor status — member and packet disagreeing — is rejected', () => {
  const [from, to] = APPLIED
    ? ['  x-cybrik-status: ACCEPTED FOR IMPLEMENTATION', '  x-cybrik-status: PROPOSED']
    : ['  x-cybrik-status: PROPOSED', '  x-cybrik-status: ACCEPTED FOR IMPLEMENTATION'];
  assert.ok(successorText.includes(from), `the successor must declare '${from.trim()}' today, or this mutation is a no-op`);
  expectFail(
    buildPacket({ successor: (t) => t.replace(from, to) }),
    APPLIED
      ? 'a member left at PROPOSED while the packet is ACCEPTED is a flip that did not finish, and must be rejected'
      : 'flipping the successor to ACCEPTED while the delta is unapplied and Gate W2-I is NOT OPENED must be rejected',
    /PROPOSED|ACCEPTED|flip|lifecycle/i,
  );
});

test('x-cybrik-applied contradicting the delta lifecycle is rejected', () => {
  // The same invariant one level up: applied-ness is not an independent flag a record may set at
  // will. Before the gate decides, claiming applied is a silent flip; after it, claiming unapplied
  // disowns a flip that already touched the accepted manifest.
  expectFail(
    buildPacket({ delta: (c) => { c['x-cybrik-applied'] = !APPLIED; } }),
    APPLIED
      ? 'an ACCEPTED delta that claims to be unapplied contradicts the accepted manifest that already carries its members'
      : 'the delta may only be applied at a recorded Gate W2-I status flip',
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
  // The accepted manifest is the ONE upstream pin whose bytes legitimately move at the flip, so
  // post-flip it is `sha256_after_flip` that has to track the disk. Drifting the pre-flip `sha256`
  // instead would prove nothing there: that field is a historical record of what was reviewed, and
  // it is SUPPOSED to disagree with the current bytes.
  const manifestPin = (c) => c.upstream_pins.accepted.find((x) => x.file.endsWith('cybrik-suite-inference-packet.v1.manifest.json'));
  expectFail(
    buildPacket({
      delta: (c) => {
        const pin = manifestPin(c);
        if (APPLIED) pin.sha256_after_flip = '0'.repeat(64);
        else pin.sha256 = '0'.repeat(64);
      },
    }),
    'the accepted W2-D manifest pin must match its on-disk bytes',
    /upstream|sha-?256/i,
  );
});

test('an applied delta that drops the post-flip manifest pin is rejected', () => {
  if (!APPLIED) return; // the second pin only exists once the flip has moved the manifest bytes
  // Deleting the post-flip pin leaves ONLY the historical pre-flip digest, which no longer describes
  // anything on disk. That is not a weaker binding of the accepted manifest — it is none at all,
  // dressed as one, because a reader sees a 64-hex digest and assumes it was checked.
  expectFail(
    buildPacket({
      delta: (c) => {
        delete c.upstream_pins.accepted.find((x) => x.file.endsWith('cybrik-suite-inference-packet.v1.manifest.json')).sha256_after_flip;
      },
    }),
    'an applied delta must keep pinning the accepted manifest bytes as they are NOW, not only as they were reviewed',
    /sha256_after_flip/,
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
    title: 'a CURRENT owner that is not the document the lifecycle designates is rejected',
    why: 'exactly one document owns the four pairs at every instant — the predecessor before the flip, ' +
      'the successor after it. A different document holding that role, whatever its filename, is an ' +
      'unrecorded flip',
    match: APPLIED
      ? /OpenAPI ownership sweep: GET \/api\/v1\/model-classes names 'openapi\/cybrik-ai-inference-plane\.v1\.rogue-current\.openapi\.yaml' as its CURRENT owner, but once the Gate W2-I flip is applied the successor/
      : /OpenAPI ownership sweep: GET \/api\/v1\/model-classes names 'openapi\/cybrik-ai-inference-plane\.v1\.rogue-current\.openapi\.yaml' as its CURRENT owner, but the accepted predecessor/,
    guard: () => {
      // Whichever document legitimately holds the CURRENT role is demoted, and an illegitimate clone
      // takes it. Exactly ONE document ends up CURRENT, so the sweep reaches the identity branch this
      // row names rather than stopping at the arity branch SW-1 owns.
      const demoted = YAML.parse(APPLIED ? DEMOTED_SUCCESSOR : DEMOTED_PREDECESSOR);
      assert.notEqual(demoted.info['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION', 'the real owner must no longer classify as CURRENT/ACCEPTED');
      assert.notEqual(demoted.info['x-cybrik-lifecycle-role'], 'CURRENT', 'nor may it claim the CURRENT role by the other half of the disjunction');
      assert.equal(Object.keys(demoted.paths).length, 4, 'it must still DECLARE the four owned pairs, or there is no owned pair set to judge');
      const rogue = YAML.parse(APPLIED ? successorText : predecessorText);
      assert.equal(rogue.info['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION', 'the rogue clone must classify as the single CURRENT owner');
    },
    // The rogue clone takes the CURRENT role for the four pairs while the real owner keeps declaring
    // them as a non-CURRENT document. The run ALSO reports the demoted owner as a proposed successor
    // — a true consequence of this arrangement, which is why the row matches the CURRENT-owner
    // sentence and not merely "the run was red".
    packet: () => (APPLIED
      ? buildPacket({
        successor: () => DEMOTED_SUCCESSOR,
        writeContracts: { 'openapi/cybrik-ai-inference-plane.v1.rogue-current.openapi.yaml': successorText },
      })
      : predecessorPacket(DEMOTED_PREDECESSOR, {
        writeContracts: { 'openapi/cybrik-ai-inference-plane.v1.rogue-current.openapi.yaml': predecessorText },
      })),
  },
  {
    id: 'SW-6',
    title: 'a CURRENT owner disagreeing with the owner the delta pins is rejected',
    why: 'the sweep and the delta must name the SAME current owner; a delta pinning some other file ' +
      'records an ownership claim the documents on disk do not support',
    // Which ownership slot the sweep cross-checks against the delta depends on the state: before the
    // flip the delta's current_owner must be the document the sweep found CURRENT; after it, the
    // delta's successor must be. Both are the same rule — the sweep and the delta may not name
    // different owners — read at whichever slot currently holds the owner.
    match: APPLIED
      ? /OpenAPI ownership sweep: GET \/api\/v1\/model-classes CURRENT owner 'openapi\/cybrik-ai-inference-plane\.v1\.contract-0\.2\.0\.openapi\.yaml' is not the successor the delta pins \('openapi\/cybrik-ai-inference-plane\.v1\.not-the-owner\.openapi\.yaml'\)/
      : /OpenAPI ownership sweep: GET \/api\/v1\/model-classes CURRENT owner 'openapi\/cybrik-ai-inference-plane\.v1\.openapi\.yaml' is not the CURRENT owner the delta pins \('openapi\/cybrik-ai-inference-plane\.v1\.not-the-predecessor\.openapi\.yaml'\)/,
    guard: () => {
      for (const ghost of ['cybrik-ai-inference-plane.v1.not-the-predecessor.openapi.yaml', 'cybrik-ai-inference-plane.v1.not-the-owner.openapi.yaml']) {
        assert.equal(existsSync(join(CONTRACTS, 'openapi', ghost)), false, `${ghost}: the pinned-but-wrong owner must NOT exist on disk, so buildPacket leaves its digest untouched and the two ownership pin sites still agree`);
      }
    },
    packet: () => buildPacket({
      delta: (c) => {
        if (APPLIED) c.ownership.proposed_successor.file = 'openapi/cybrik-ai-inference-plane.v1.not-the-owner.openapi.yaml';
        else c.ownership.current_owner.file = 'openapi/cybrik-ai-inference-plane.v1.not-the-predecessor.openapi.yaml';
      },
    }),
  },
  {
    id: 'SW-7',
    title: APPLIED
      ? 'a proposed successor surviving the applied flip is rejected'
      : 'a proposed successor that is not the delta-linked one is rejected',
    why: APPLIED
      ? 'the flip promotes the successor to CURRENT and leaves no proposal behind. A document still ' +
        'classifying as a proposed successor of an already-flipped pair never completed its own ' +
        'flip, or is a second candidate queued against an owner that is no longer taking proposals'
      : 'a successor owning accepted paths with no delta recording the proposal is an unlinked ' +
        'second owner by another name',
    match: APPLIED
      ? /OpenAPI ownership sweep: GET \/api\/v1\/model-classes still carries 1 PROPOSED successor document\(s\) \[openapi\/cybrik-ai-inference-plane\.v1\.residual-successor\.openapi\.yaml\] after the Gate W2-I flip/
      : /OpenAPI ownership sweep: GET \/api\/v1\/model-classes PROPOSED successor 'openapi\/cybrik-ai-inference-plane\.v1\.contract-0\.2\.0\.openapi\.yaml' is not the delta-linked successor 'openapi\/cybrik-ai-inference-plane\.v1\.unlinked-successor\.openapi\.yaml'/,
    guard: () => {
      if (APPLIED) {
        assert.equal(existsSync(join(CONTRACTS, 'openapi', 'cybrik-ai-inference-plane.v1.residual-successor.openapi.yaml')), false, 'the residual successor must not already exist, or writing it is not a mutation');
        assert.notEqual(YAML.parse(DEMOTED_SUCCESSOR).info['x-cybrik-status'], 'ACCEPTED FOR IMPLEMENTATION', 'the residual document must classify as a proposal, not as a second CURRENT owner — otherwise the arity branch fires instead');
        return;
      }
      assert.equal(existsSync(join(CONTRACTS, 'openapi', 'cybrik-ai-inference-plane.v1.unlinked-successor.openapi.yaml')), false, 'the pinned-but-wrong successor must NOT exist on disk, so ownership.proposed_successor keeps the digest candidate_members pins and this row cannot pass on pin drift');
      assert.equal(delta.ownership.proposed_successor.file, SUCCESSOR_IN_CONTRACTS, 'the candidate really does link this successor, so re-pointing the link is a genuine mutation');
    },
    packet: () => (APPLIED
      ? buildPacket({ writeContracts: { 'openapi/cybrik-ai-inference-plane.v1.residual-successor.openapi.yaml': DEMOTED_SUCCESSOR } })
      : buildPacket({ delta: (c) => { c.ownership.proposed_successor.file = 'openapi/cybrik-ai-inference-plane.v1.unlinked-successor.openapi.yaml'; } })),
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
// The post-flip mirror: the successor stripped of BOTH halves of the CURRENT-owner disjunction, so
// it classifies as a proposal rather than an owner. Used by the applied branches of SW-5 (where a
// rogue clone takes the vacated CURRENT role) and SW-7 (where it is the residual proposal).
const DEMOTED_SUCCESSOR = APPLIED
  ? replaceOnce(
    replaceOnce(successorText, '\n  x-cybrik-status: ACCEPTED FOR IMPLEMENTATION\n', '\n  x-cybrik-status: PROPOSED\n', 'SW-5/7 status'),
    '\n  x-cybrik-lifecycle-role: CURRENT\n',
    '\n  x-cybrik-lifecycle-role: PROPOSED-SUCCESSOR\n',
    'SW-5/7 role',
  )
  : successorText;

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
      assert.ok(['PROPOSED', 'ACCEPTED FOR IMPLEMENTATION'].includes(delta['x-cybrik-status']), 'the delta must really declare a supported lifecycle token today, or replacing it is not a mutation');
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
    title: 'a delta whose status and not-accepted halves disagree is rejected',
    why: 'x-cybrik-status and x-cybrik-not-accepted are two statements of ONE fact. Moving one and ' +
      'not the other produces a record that is simultaneously proposed and accepted, and whichever ' +
      'half a reader happens to consult decides what they believe',
    match: APPLIED
      ? /W2-I proposed delta: x-cybrik-not-accepted must be false to match the manifest lifecycle/
      : /W2-I delta: a proposed-delta is PROPOSED \/ not-accepted by construction/,
    guard: () => {
      assert.equal(delta['x-cybrik-not-accepted'], !APPLIED, 'the delta must really declare the not-accepted half that matches its status today');
    },
    packet: () => buildPacket({ delta: (c) => { c['x-cybrik-not-accepted'] = !c['x-cybrik-not-accepted']; } }),
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
  // The ACCEPTED branch demands a decision behind the lifecycle. Whichever state the packet is in,
  // the row constructs the same defect — accepted bytes with no recorded acceptance — and asserts
  // that EVERY missing record is reported. Asserting only the first would let the rest of the branch
  // rot unnoticed.
  if (APPLIED) {
    assert.match(delta.acceptance.status, /^ACCEPTED FOR IMPLEMENTATION/, 'the acceptance record must be the accepted one today, or stripping it is not a mutation');
    for (const k of ['gate', 'decided_by', 'decided_on']) {
      assert.ok(delta.acceptance[k], `acceptance.${k} must be present today, or the row cannot prove the branch demands it`);
    }
    assert.ok(delta.acceptance.evidence.length > 0, 'and the acceptance must cite evidence today');
    assert.match(delta.gate.status, /^DECIDED/, 'Gate W2-I must be recorded as decided');
  } else {
    assert.equal(delta.acceptance.status, 'NOT ACCEPTED — PROPOSED only', 'the acceptance record must still be the honest PROPOSED one');
    assert.deepEqual(delta.acceptance.evidence, [], 'the acceptance record must carry no evidence yet');
    for (const k of ['gate', 'decided_by', 'decided_on']) {
      assert.equal(k in delta.acceptance, false, `acceptance.${k} must be ABSENT today — the row proves the ACCEPTED branch DEMANDS it, so a record that already exists would make that demand vacuous`);
    }
    assert.match(delta.gate.status, /NOT OPENED/, 'Gate W2-I must still be undecided');
  }

  // Self-consistent lifecycle: the delta's own two fields AND every candidate-member status agree, so
  // the run enters the ACCEPTED branch on a coherent lifecycle rather than tripping the
  // member-agreement rule first and never reaching it. Only the ACCEPTANCE RECORD is hollowed out.
  const r = expectFail(
    buildPacket({
      delta: (c) => {
        c['x-cybrik-status'] = 'ACCEPTED FOR IMPLEMENTATION';
        c['x-cybrik-not-accepted'] = false;
        for (const m of c.candidate_members) m.status = 'ACCEPTED FOR IMPLEMENTATION';
        c.acceptance = { status: 'NOT ACCEPTED — PROPOSED only', evidence: [] };
        c.gate = { ...c.gate, status: 'NOT OPENED — awaiting explicit Founder decision.' };
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
  '=== W2-I inference-plane transport binding vs. the ACCEPTED W2-D packet — JSON Schema / fixtures / invariant / integrity / ownership / OpenAPI validation ===';

// The banner clauses, as a function of a counts object: the SAME expected text is asserted against
// the real run (real numbers) and against an empty counts object (every number 0), so a fallback
// that swallowed a real count, or a clause that silently vanished, fails one row or the other.
const bannerClauses = (n) => [
  `all fixtures (${n('positive_pass')} positive + ${n('negative_schema_reject')} negative-schema + ${n('runtime_negative_reject')} negative-semantic); `,
  `integrity (${n('member_sha_verified')} candidate-member + ${n('upstream_pin_verified')} upstream-accepted + ${n('examples_manifest_sha_verified')} examples-manifest + ${n('example_sha_verified')}/${n('example_inventory_on_disk')} support-fixture SHA-256 digests, inventory closed with no duplicate or orphan); `,
  `${n('invariants_checked')} structural assertions (${n('invariants_ok')} ok) covering TT-1..TT-9; `,
  `${n('runtime_negative_declared_match')}/${n('runtime_negative_total')} negative-semantic fixtures rejected on EXACTLY their declared TX rule, witnessing each of TX-1..TX-8 once; `,
  `single-owner ownership + ${n('withdrawn_artifact_absent')} withdrawn second-plane artifacts absent`,
  `a lifecycle-aware sweep of ${n('openapi_documents_swept')} OpenAPI document(s)/${n('openapi_pairs_swept')} declared pairs proving ${n('owned_pair_current_ok')}/${n('ownership_sweep_pairs')} owned pairs keep exactly one CURRENT owner and `,
  `${n('registry_operation_witnessed')}/${n('openapi_operation_bound')} closed-registry operations agreeing across delta, fixtures and the successor bytes; `,
  `response-binding preservation over ${n('response_operations_checked')} accepted operation(s) — ${n('response_status_preserved')} accepted non-error binding(s) preserved verbatim and `,
  `${n('dual_branch_response_ok')}/${n('dual_branch_response_total')} error surfaces on the ${n('response_accepted_error_statuses')} accepted error status(es) carrying EXACTLY the accepted ModelInferenceError + TransportAuthorizationError oneOf branch set; `,
];
// The clauses the banner renders differently per lifecycle. The banner is what an operator and a
// gate read, so it must describe the state actually validated: a report still saying "unapplied"
// after an applied run would be the same defect the validator exists to catch, one level up.
const sweepTailFor = (n, applied) => (applied
  ? `${n('owned_pair_successor_ok')}/${n('ownership_sweep_pairs')} carry no residual proposed successor and ${n('owned_pair_superseded_ok')}/${n('ownership_sweep_pairs')} keep the superseded predecessor on disk`
  : `${n('owned_pair_successor_ok')}/${n('ownership_sweep_pairs')} at most one delta-linked PROPOSED successor`);
const selfDenialFor = (applied) => (applied
  ? 'delta self-denial (consumed applied record, still NOT a manifest) + '
  : 'delta self-denial (proposed-delta, NOT a manifest, unapplied) + ');
const d6ClauseFor = (n, applied) => (applied
  ? `ADR-0001 D5/D6 (the accepted W2-D manifest declares all ${n('applied_member_pin_agreed')} absorbed members at digests agreeing with the delta, relabels the predecessor SUPERSEDED-SUPPORTED byte-frozen, and records the gate decision) + `
  : "ADR-0001 D6 (the accepted W2-D manifest's own bytes reference no candidate material) + ");
const SECURITY_CLAUSE = 'the OpenAPI mTLS+at+jwt security bind. ';
const disclaimerFor = (lifecycle) => (lifecycle === 'ACCEPTED FOR IMPLEMENTATION'
  ? `Lifecycle: ${lifecycle} — schemas/fixtures v0.1.0, successor OpenAPI v0.2.0. Conformance evidence only. ` +
    'This run is NOT the acceptance: Gate W2-I was decided by the recorded gate decision, and this delta ' +
    'was APPLIED into the ACCEPTED W2-D packet. It proves no runtime, endpoint, deployment or release ' +
    'readiness, and it does not discharge the open items the acceptance carried forward — notably the ' +
    'accepted W2-F operation-token table, which this flip did not amend.'
  : `Lifecycle: ${lifecycle} — schemas/fixtures v0.1.0, successor OpenAPI v0.2.0. Conformance evidence only; ` +
    'this is NOT acceptance and NOT implementation authorization, and the delta remains UNAPPLIED against ' +
    'the ACCEPTED W2-D packet.');

const assertOkBannerShape = (banner, counts, lifecycle, why) => {
  const n = (k) => (counts[k] === undefined ? 0 : counts[k]);
  const applied = lifecycle === 'ACCEPTED FOR IMPLEMENTATION';
  assert.equal(banner.startsWith('\nOK — transport-binding candidate passes JSON Schema 2020-12 compile/ref-resolution; '), true, `${why}: the OK banner must open with the blank line + the compile/ref-resolution claim\n${banner}`);
  for (const clause of [...bannerClauses(n), sweepTailFor(n, applied), selfDenialFor(applied), d6ClauseFor(n, applied), SECURITY_CLAUSE]) {
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
  assert.equal(result.lifecycle, MEMBER_STATUS, 'the run must report the lifecycle the delta declares, or the disclaimer this row pins is the wrong one');

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
  assertOkBannerShape(report.stdout[2], result.counts, MEMBER_STATUS, 'real clean run');
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
      APPLIED
        ? 'W2-I delta: proposed_manifest_changes.target_manifest.modified_now must be true once the flip is applied (the accepted W2-D manifest absorbed these changes; claiming otherwise contradicts x-cybrik-applied)'
        : 'W2-I delta: proposed_manifest_changes.target_manifest.modified_now must be false (the accepted W2-D manifest is untouched until a recorded flip)',
      'W2-I delta: proposed_manifest_changes.removes_members must be empty (a compatible successor revision removes no accepted member)',
      'W2-I delta: proposed_manifest_changes.modifies_accepted_members must be empty (no accepted member is modified)',
      // Post-flip the block additionally owes the post-flip manifest pin. Its absence must be its own
      // rejection, not a silent `undefined` that reads as "no pin was required".
      ...(APPLIED ? ['W2-I delta: an applied delta must pin proposed_manifest_changes.target_manifest.sha256_after_flip (the accepted manifest bytes AFTER the flip) alongside the pre-flip sha256 it was reviewed against'] : []),
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
      ...(APPLIED
        ? [
          "W2-I delta: once applied, proposed_disposition.predecessor_disposition_now must OPEN with SUPERSEDED-SUPPORTED — got 'undefined'",
          'W2-I delta: proposed_disposition.predecessor_disposition_decided must record the DECIDED disposition SUPERSEDED-SUPPORTED (ADR-0001 D3 / the recorded gate decision)',
          'W2-I delta: an applied disposition must record effective_on as an ISO date',
          'W2-I delta: proposed_disposition.dates_binding must be true once the disposition is decided (the effective date binds)',
          'W2-I delta: proposed_disposition.retirement_date_fixed must be false — the ADR-0001 D3 floor needs two subsequent minor releases as well as 180 days, so no retirement date is derivable at the flip',
          'W2-I delta: proposed_disposition.release_dates_consumed must be false (a contract supersession consumes no W0-W6 release date)',
          'W2-I delta: proposed_disposition.final_disposition_status must record the disposition as DECIDED once applied',
        ]
        : [
          'W2-I delta: proposed_disposition.predecessor_disposition_now must record that the predecessor is still CURRENT (not yet deprecated or superseded)',
          'W2-I delta: proposed_disposition.dates_binding must be false (every date in a proposal is a planning value and consumes no W0-W6 release date)',
        ]),
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
// Same forgery in both states: a well-formed apply condition that names no gate. Post-flip it must
// still say the flip HAPPENED, or the row would trip the applied-wording rule instead of the
// missing-gate-name rule it exists to prove.
const APPLIES_AT_NO_GATE = APPLIED
  ? 'APPLIED at the status flip recorded on 2026-08-21 with evidence (ADR-0001 D5).'
  : 'APPLY-ONLY-AT a future status flip that is explicitly recorded by the Founder with evidence (ADR-0001 D5).';

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
    match: /W2-I delta: x-cybrik-applies-at must name the explicitly-recorded Gate W2-I status flip as the ONLY point at which this delta applies/,
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
    match: /W2-I delta: x-cybrik-applies-at must name the explicitly-recorded Gate W2-I status flip as the ONLY point at which this delta applies/,
    guard: () => {
      assert.equal(typeof APPLIES_AT_NO_GATE, 'string', 'the replacement must stay a string, or the row would trip the type half of the rule instead of the wording half');
      assert.doesNotMatch(APPLIES_AT_NO_GATE, /Gate W2-I/, 'and must really drop the gate name');
      if (APPLIED) assert.match(APPLIES_AT_NO_GATE, /APPLIED/, 'post-flip the replacement must keep saying the flip HAPPENED, so only the missing gate name is under test');
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
      assert.match(delta.gate?.status || '', APPLIED ? /^DECIDED\b/ : /NOT OPENED|awaiting/i, 'and must state the gate disposition today');
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
// Both ownership slots carry a TWO-PART label, and each half does work the other cannot: the
// position (CURRENT / SUPERSEDED-SUPPORTED / PROPOSED-SUCCESSOR) and the acceptance state. The four
// forged values below each drop exactly ONE half while keeping the other, so every row proves the
// validator reads both. The values are state-dependent because the labels are: before the flip the
// predecessor is the owner and the successor is the proposal; after it, the roles have swapped.
const CURRENT_OWNER_NO_ACCEPTED = APPLIED
  // Post-flip the predecessor slot must OPEN with SUPERSEDED-SUPPORTED. This one keeps the
  // supersession fact but buries it mid-sentence, which is how a demotion reads as a footnote.
  ? 'Relabelled by the Gate W2-I flip; it is now SUPERSEDED-SUPPORTED and no longer the owner.'
  : 'CURRENT — the sole owner of the four inference operations until a recorded Gate W2-I flip.';
const CURRENT_OWNER_NO_CURRENT = APPLIED
  // ...and this one opens correctly but then re-asserts currency, the contradiction that would let a
  // superseded document keep being read as an owner.
  ? 'SUPERSEDED-SUPPORTED — but it remains CURRENT for the four inference operations.'
  : 'ACCEPTED FOR IMPLEMENTATION (v0.1.0; not stable v1/GA), unchanged by this proposal.';
const SUCCESSOR_NO_NOT_ACCEPTED = APPLIED
  ? 'ACCEPTED FOR IMPLEMENTATION (v0.2.0; not stable v1/GA) — the revision the gate accepted.'
  : 'PROPOSED-SUCCESSOR, awaiting the Gate W2-I decision.';
const SUCCESSOR_NO_PROPOSED = APPLIED
  ? 'CURRENT — sole owner of the four inference operations since the Gate W2-I flip.'
  : 'NOT ACCEPTED — a candidate successor revision, undecided at Gate W2-I.';

// The diagnostics those four forgeries must produce, per state.
const DIAG_OW_CURRENT_OWNER = APPLIED
  ? /W2-I delta: once applied, ownership\.current_owner\.lifecycle_now must OPEN with SUPERSEDED-SUPPORTED/
  : /W2-I delta: ownership\.current_owner\.lifecycle_now must record it as CURRENT — ACCEPTED FOR IMPLEMENTATION/;
const DIAG_OW_CURRENT_OWNER_STILL_CURRENT = APPLIED
  ? /W2-I delta: ownership\.current_owner\.lifecycle_now must not still assert that the predecessor IS current after the flip/
  : /W2-I delta: ownership\.current_owner\.lifecycle_now must record it as CURRENT — ACCEPTED FOR IMPLEMENTATION/;
const DIAG_OW_SUCCESSOR = APPLIED
  ? /W2-I delta: once applied, ownership\.proposed_successor\.lifecycle_now must OPEN with CURRENT and record ACCEPTED FOR IMPLEMENTATION/
  : /W2-I delta: ownership\.proposed_successor\.lifecycle_now must record PROPOSED-SUCCESSOR — NOT ACCEPTED/;
const DIAG_OW_DISPOSITION = APPLIED
  ? /W2-I delta: once applied, proposed_disposition\.predecessor_disposition_now must OPEN with SUPERSEDED-SUPPORTED/
  : /W2-I delta: proposed_disposition\.predecessor_disposition_now must record that the predecessor is still CURRENT \(not yet deprecated or superseded\)/;

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
      assert.ok(delta.candidate_members.every((m) => m.status === MEMBER_STATUS), 'every member carries the packet lifecycle status today, which is the status the added row must declare');
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
          status: MEMBER_STATUS,
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
    title: 'a current-owner lifecycle missing the position half of its label is rejected',
    why: 'CURRENT alone is a position in a sequence, not an acceptance state — a document can be the ' +
      'newest thing on disk without ever having been accepted, and the record must state both',
    match: DIAG_OW_CURRENT_OWNER,
    guard: () => {
      const now = delta.ownership.current_owner.lifecycle_now;
      assert.notEqual(now, CURRENT_OWNER_NO_ACCEPTED, 'the forged value must differ from the real one, or the row is not a mutation');
      if (APPLIED) {
        assert.match(now, /^SUPERSEDED-SUPPORTED\b/, 'the record must OPEN with the supersession label today');
        assert.match(CURRENT_OWNER_NO_ACCEPTED, /SUPERSEDED-SUPPORTED/, 'the replacement must still MENTION supersession, so only the anchoring is under test');
        assert.doesNotMatch(CURRENT_OWNER_NO_ACCEPTED, /^SUPERSEDED-SUPPORTED\b/, 'and must really stop leading with it');
      } else {
        assert.match(now, /CURRENT/, 'the record must carry both halves today');
        assert.match(now, /ACCEPTED FOR IMPLEMENTATION/, 'or dropping one of them is not a mutation');
        assert.match(CURRENT_OWNER_NO_ACCEPTED, /CURRENT/, 'the replacement must KEEP the CURRENT half, so only the acceptance half is under test');
        assert.doesNotMatch(CURRENT_OWNER_NO_ACCEPTED, /ACCEPTED FOR IMPLEMENTATION/, 'and must really drop the acceptance half');
      }
    },
    packet: () => buildPacket({ delta: (d) => { d.ownership.current_owner.lifecycle_now = CURRENT_OWNER_NO_ACCEPTED; } }),
  },
  {
    id: 'OW-5',
    title: 'a current-owner lifecycle that contradicts its own position label is rejected',
    why: 'the mirror failure: an accepted document that no longer claims to be the CURRENT owner ' +
      'leaves the owned pairs with an acceptance state and no owner, which is the gap a second owner ' +
      'would move into',
    match: DIAG_OW_CURRENT_OWNER_STILL_CURRENT,
    guard: () => {
      if (APPLIED) {
        assert.match(CURRENT_OWNER_NO_CURRENT, /^SUPERSEDED-SUPPORTED\b/, 'the replacement must KEEP the correct opening label, so only the contradiction is under test');
        assert.match(CURRENT_OWNER_NO_CURRENT, /\bremains CURRENT\b/, 'and must really re-assert currency — the contradiction this row exists to catch');
      } else {
        assert.match(CURRENT_OWNER_NO_CURRENT, /ACCEPTED FOR IMPLEMENTATION/, 'the replacement must KEEP the acceptance half, so only the CURRENT half is under test');
        assert.doesNotMatch(CURRENT_OWNER_NO_CURRENT, /CURRENT/, 'and must really drop the CURRENT half — the validator matches it case-sensitively, so no cased variant may survive');
      }
    },
    packet: () => buildPacket({ delta: (d) => { d.ownership.current_owner.lifecycle_now = CURRENT_OWNER_NO_CURRENT; } }),
  },
  {
    id: 'OW-6',
    title: 'a successor lifecycle missing the acceptance half of its label is rejected',
    why: 'PROPOSED describes how the document arrived; NOT ACCEPTED is what the gate has not yet done ' +
      'about it. A record carrying only the first reads as a proposal in progress rather than as one ' +
      'that has been decided on by nobody',
    match: DIAG_OW_SUCCESSOR,
    guard: () => {
      const now = delta.ownership.proposed_successor.lifecycle_now;
      assert.notEqual(now, SUCCESSOR_NO_NOT_ACCEPTED, 'the forged value must differ from the real one');
      if (APPLIED) {
        assert.match(now, /^CURRENT\b/, 'the successor slot must OPEN with CURRENT today');
        assert.match(SUCCESSOR_NO_NOT_ACCEPTED, /ACCEPTED FOR IMPLEMENTATION/, 'the replacement must KEEP the acceptance half, so only the ownership half is under test');
        assert.doesNotMatch(SUCCESSOR_NO_NOT_ACCEPTED, /^CURRENT\b/, 'and must really drop the CURRENT claim');
      } else {
        assert.match(now, /PROPOSED/, 'the record must carry both halves today');
        assert.match(now, /NOT ACCEPTED/, 'or dropping one of them is not a mutation');
        assert.match(SUCCESSOR_NO_NOT_ACCEPTED, /PROPOSED/, 'the replacement must KEEP the PROPOSED half');
        assert.doesNotMatch(SUCCESSOR_NO_NOT_ACCEPTED, /NOT ACCEPTED/, 'and must really drop the not-accepted half');
      }
    },
    packet: () => buildPacket({ delta: (d) => { d.ownership.proposed_successor.lifecycle_now = SUCCESSOR_NO_NOT_ACCEPTED; } }),
  },
  {
    id: 'OW-7',
    title: 'a successor lifecycle missing the position half of its label is rejected',
    why: 'the mirror failure: dropping PROPOSED leaves a document that is merely not accepted, which ' +
      'is equally true of a withdrawn or never-submitted revision — the record must keep saying that ' +
      'this one is a live proposal',
    match: DIAG_OW_SUCCESSOR,
    guard: () => {
      if (APPLIED) {
        assert.match(SUCCESSOR_NO_PROPOSED, /^CURRENT\b/, 'the replacement must KEEP the ownership half, so only the acceptance half is under test');
        assert.doesNotMatch(SUCCESSOR_NO_PROPOSED, /ACCEPTED FOR IMPLEMENTATION/, 'and must really drop the acceptance half');
      } else {
        assert.match(SUCCESSOR_NO_PROPOSED, /NOT ACCEPTED/, 'the replacement must KEEP the not-accepted half');
        assert.doesNotMatch(SUCCESSOR_NO_PROPOSED, /PROPOSED/, 'and must really drop the PROPOSED half — matched case-sensitively, so PROPOSED-SUCCESSOR may not survive either');
      }
    },
    packet: () => buildPacket({ delta: (d) => { d.ownership.proposed_successor.lifecycle_now = SUCCESSOR_NO_PROPOSED; } }),
  },
  {
    id: 'OW-8',
    title: 'a disposition that no longer records the predecessor position is rejected',
    why: 'the disposition is a PROPOSAL about a future flip; the one thing it must state about today ' +
      'is that the predecessor is not yet deprecated or superseded. Losing that sentence is how a ' +
      'proposed supersession quietly reads as an accomplished one',
    match: DIAG_OW_DISPOSITION,
    guard: () => {
      const d3 = delta.proposed_disposition;
      assert.match(d3.predecessor_disposition_now, APPLIED ? /^SUPERSEDED-SUPPORTED\b/ : /CURRENT/, 'the disposition must state the predecessor position today, or deleting the field is not a mutation');
      // Deleting the WHOLE block would trip the predecessor/byte-frozen/dates rules first and bury the
      // CURRENT rule among them. Removing exactly this field keeps the other three satisfied, so the
      // run reaches the precise CURRENT diagnostic this row names and only that one.
      assert.equal(d3.predecessor, PRED_IN_CONTRACTS, 'the sibling predecessor field must stay satisfied');
      assert.equal(d3.predecessor_byte_frozen, true, 'as must the byte-freeze field');
      assert.equal(d3.dates_binding, APPLIED, 'as must the dates-binding field');
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

// The successor's three lifecycle lines, as they read in the CURRENT state. Deriving the anchors
// rather than hard-coding them is what lets one row body prove the same rule in both states: the
// mutation always moves the document AWAY from whatever the packet lifecycle requires.
const OA_STATUS_LINE = `  x-cybrik-status: ${MEMBER_STATUS}`;
const OA_NOT_ACCEPTED_LINE = `  x-cybrik-not-accepted: ${!APPLIED}`;
const OA_NOT_ACCEPTED_FORGED = `  x-cybrik-not-accepted: ${APPLIED}`;
const OA_ROLE_LINE = `  x-cybrik-lifecycle-role: ${APPLIED ? 'CURRENT' : 'PROPOSED-SUCCESSOR'}`;
const OA_ROLE_FORGED = '  x-cybrik-lifecycle-role: SUCCESSOR-REVISION';

const DIAG_OA_STATUS = `transport OpenAPI: info.x-cybrik-status must be '${MEMBER_STATUS}'`;
const DIAG_OA_NOT_ACCEPTED = 'transport OpenAPI: info.x-cybrik-not-accepted must match the packet lifecycle';
const DIAG_OA_VERSION = "transport OpenAPI: info.version must be 0.2.0 to match the contract_version the delta pins for this member (got '0.1.0')";
const DIAG_OA_ROLE = APPLIED
  ? "transport OpenAPI: once applied, info.x-cybrik-lifecycle-role must be CURRENT (the successor is now the sole owner of the four pairs) — got 'SUCCESSOR-REVISION'"
  : 'transport OpenAPI: info.x-cybrik-lifecycle-role must record it as a PROPOSED-SUCCESSOR';
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
    mutate: (t) => spliceLines(t, [OA_STATUS_LINE], [], 'OA-1'),
    removed: [OA_STATUS_LINE],
    added: [],
    shape: (doc) => {
      assert.equal(doc.info['x-cybrik-status'], undefined, 'the successor must really have lost its status field');
      assert.equal(doc.info['x-cybrik-not-accepted'], !APPLIED, 'its NOT-ACCEPTED sibling must survive untouched, so only the status rule is under test');
      assert.equal(doc.info['x-cybrik-lifecycle-role'], APPLIED ? 'CURRENT' : 'PROPOSED-SUCCESSOR', 'and the lifecycle role must survive, so the ownership sweep still classifies this document the same way and reports nothing');
    },
    errors: [DIAG_OA_STATUS],
  },
  {
    id: 'OA-2',
    title: 'a successor whose x-cybrik-not-accepted contradicts the packet lifecycle is rejected',
    why: 'x-cybrik-not-accepted is the machine-readable half of the status pair. A member flipping it ' +
      'alone asserts a lifecycle no gate recorded — before the flip it claims an acceptance that does ' +
      'not exist, after the flip it disclaims one that does — and the untouched status line is exactly ' +
      'the cover such a claim would hide behind',
    mutate: (t) => spliceLines(t, [OA_NOT_ACCEPTED_LINE], [OA_NOT_ACCEPTED_FORGED], 'OA-2'),
    removed: [OA_NOT_ACCEPTED_LINE],
    added: [OA_NOT_ACCEPTED_FORGED],
    shape: (doc) => {
      assert.equal(doc.info['x-cybrik-not-accepted'], APPLIED, 'the successor must really contradict the packet lifecycle');
      assert.equal(doc.info['x-cybrik-status'], MEMBER_STATUS, 'while its status line still matches the packet, so ONLY the not-accepted rule can fire');
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
    title: 'a successor whose lifecycle role no longer states the role the packet requires is rejected',
    why: 'the role is what says whether this document is a proposal or the owner. A role that states ' +
      'neither is the quiet case: it is a plausible-looking label that no rule but the §6 identity ' +
      'check reads, so that check is all that stands between an unlabelled document and green',
    mutate: (t) => spliceLines(t, [OA_ROLE_LINE], [OA_ROLE_FORGED], 'OA-4'),
    removed: [OA_ROLE_LINE],
    added: [OA_ROLE_FORGED],
    shape: (doc) => {
      const role = doc.info['x-cybrik-lifecycle-role'];
      assert.equal(role, 'SUCCESSOR-REVISION');
      assert.doesNotMatch(role, /PROPOSED/, 'no surviving PROPOSED anywhere in the role, or the pre-flip rule is still satisfied and the row proves nothing');
      assert.doesNotMatch(role, /^CURRENT$/i, 'and no surviving CURRENT, or the post-flip rule is still satisfied');
      assert.equal(doc.info['x-cybrik-status'], MEMBER_STATUS, 'the status must keep matching the packet, so only the role rule can fire');
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
// The three literals track the RECORDED lifecycle of ADR-0011, not a frozen proposal: Gate W2-I was
// DECIDED — ACCEPT at human boundary HB-4 on 2026-08-20 and the status flip was applied to the
// artifact bytes on 2026-08-21, so the catalog rows now read ACCEPTED (HB-4). Pinning them to the
// pre-flip PROPOSED wording would make this guard assert a catalog that contradicts the applied
// acceptance. The base SHA below is unchanged — only the registered W2-I additions moved.
const ADR_README_BASE_SHA256 = 'dee1be038ddfc5b309529b12b4c0cedbd38131b0fbedcb983023d75ced4f7aa0';
const ADR_README_W2I_ADDITIONS = [
  '\nThe W2-I transport binding adds ADR-0011 as `ACCEPTED (HB-4)`; therefore the preceding ten-ADR\n' +
    'statement describes the accepted base catalog before this additive record and is not the acceptance\n' +
    'statement for ADR-0011. Gate W2-I was `DECIDED — ACCEPT` by the Decision Council / Founder at human\n' +
    'boundary `HB-4` on 2026-08-20, and the status flip was applied to the artifact bytes on 2026-08-21.\n' +
    'Acceptance authorizes contract-first implementation only — v0.2.0, not stable v1/GA, and no runtime,\n' +
    'endpoint, deployment or release authority.\n',
  '\n| [ADR-0011](ADR-0011-inference-plane-transport-binding-profile.md) | Inference-plane transport-binding profile | `ACCEPTED (HB-4)` (Gate W2-I `DECIDED — ACCEPT`, 2026-08-20; applied to artifact bytes 2026-08-21) — v0.2.0 successor revision, not stable v1/GA |',
  '\n| [FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md](FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP.md) | W2-I path-ownership record for the compatible inference transport-binding revision | Option A recorded with `G-W2I-1..5=yes`; scope authority only — it decided ownership, never acceptance. Gate W2-I was separately `DECIDED — ACCEPT` under `HB-4` on 2026-08-20 (ADR-0011); the binding is `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED` |',
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
const ADR_README_RECEIPT_TRUST_DURABILITY_ADDITIONS = [
  '\n| [ADR-0014](ADR-0014-receipt-trust-and-durability-profile.md) | Receipt signer trust and durability profile | `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`; design floor only, runtime and production remain unauthorized |',
];
const ADR_README_F8_RECEIPT_INTEGRITY_ADDITIONS = [
  '\nThe ADR-0004 F8 receipt-integrity signature packet is\n' +
    '`ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED` at v0.2.0 under the delegated-Governor F8\n' +
    'decision. Compact JWS + RFC 8785 JCS, RFC 7638 unpadded base64url `kid`, Ed25519-only signatures,\n' +
    'the signed-v1 two-key digest exclusion, and signing-time `trust_bundle_ref` provenance are accepted\n' +
    'contract semantics. All key-lifecycle, runtime, product, UAT, release, deployment, and production\n' +
    'gates remain open; production remains Founder-controlled.\n',
  '\n| [DELEGATED-GOVERNOR-DECISION-F8-RECEIPT-INTEGRITY.md](DELEGATED-GOVERNOR-DECISION-F8-RECEIPT-INTEGRITY.md) | ADR-0004 F8 receipt-integrity contract-profile decision | Records compact JWS + JCS v0.2.0 as `ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED`; key lifecycle and every runtime-through-production gate remain open |',
];
const ADR_README_UAT_MTLS_ADDITIONS = [
  '\nThe UAT mTLS Anycorn decision is `D1 DEPENDENCY ARTIFACT COMPLETE — RUNTIME AUTHORED NOT RUN — D2 HOLD`. K5 records the\n' +
    'W2-K live-fact metadata/control amendment and S1 admits B1 only for bounded isolated UAT evaluation.\n' +
    'At `D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN`, B1 is `installed=true`, `pinned=true`,\n' +
    'product `selected=false` and HOLD; D2 remains HOLD and no release gate opens.\n',
  '\n| [DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md](DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md) | Bounded internal Anycorn B1 evaluation decision for SOC→AI lifecycle mTLS UAT | D1 records the exact isolated B1 artifact as `installed=true`, `pinned=true`, product `selected=false`, and HOLD; D2 and release remain separate gates |',
];
// ADR-0015 (suite deployment priority, data sovereignty and provider-neutral platform boundary):
// registered at PROPOSED on 2026-08-23 and ACCEPTED by explicit Founder decision on 2026-08-23 against
// the exact reviewed R6 bytes (6580a4fc…), applied by ADR-0015-STATUS-FLIP-APPLICATION.md. The four
// literals are the accepted catalog bytes verbatim — one prose block and three rows — and are
// registered here so the fail-closed base-byte guard keeps pinning every other README byte.
const ADR_README_ADR0015_ADDITIONS = [
  '\nADR-0015 (deployment priority, data sovereignty & provider-neutral platform boundary) was registered\n' +
    'as `PROPOSED`, Decider `FOUNDER`, raised 2026-08-23, and is `ACCEPTED` (Founder, 2026-08-23) —\n' +
    'decision record only. The Founder accepted the exact independently reviewed R6 bytes (commit\n' +
    '`6580a4fcdf8d24e203b6e6f98a15dae3c2fea789`, tree `c49f77f2f12eb34fc498f17043b2a223b8bfcef6`;\n' +
    'independent review `PASS`, `FOUNDER_ACCEPTANCE_SAFE = YES`, no findings); the flip is applied by the\n' +
    'docs-only [ADR-0015-STATUS-FLIP-APPLICATION.md](ADR-0015-STATUS-FLIP-APPLICATION.md). Acceptance is\n' +
    'architecture/governance authority only: it grants no implementation, provider, substrate,\n' +
    'Platform Contract, deployment, release or production authority; `PRODUCTION_DEPLOYMENT_AUTHORITY`\n' +
    'remains `CLOSED`, Kubernetes and virtualization remain `UNDECIDED`. Platform Contract acceptance\n' +
    '(2026-08-24, [FOUNDER-DECISION-PACKET-PLATFORM-CONTRACT-2026-08-24.md](FOUNDER-DECISION-PACKET-PLATFORM-CONTRACT-2026-08-24.md))\n' +
    'resolved `OPEN-4` and `OPEN-10`. Founder open-item contract acceptance on 2026-08-29\n' +
    '([FOUNDER-DECISION-PACKET-OPEN-1-OPEN-2-OPEN-5-ACCEPTANCE-2026-08-29.md](FOUNDER-DECISION-PACKET-OPEN-1-OPEN-2-OPEN-5-ACCEPTANCE-2026-08-29.md))\n' +
    'formally resolved `OPEN-1` (offline install/update manifest), `OPEN-2` (S3 compatibility subset),\n' +
    'and `OPEN-5` (optional provider capability negotiation) under Architecture Contract Authority.\n' +
    'Founder infrastructure architecture standards acceptance on 2026-09-02\n' +
    '([FOUNDER-DECISION-PACKET-OPEN-6-OPEN-7-OPEN-8-ACCEPTANCE-2026-09-02.md](FOUNDER-DECISION-PACKET-OPEN-6-OPEN-7-OPEN-8-ACCEPTANCE-2026-09-02.md))\n' +
    'resolved `OPEN-6` (tiered virtualization substrate model), `OPEN-7` (tier-differentiated Kubernetes profile),\n' +
    'and `OPEN-8` (hierarchical sovereign authority model) under Architecture Governance Authority;\n' +
    '`OPEN-3`, `OPEN-9`, and `OPEN-11` remain open. The Founder deployment-priority policy itself\n' +
    'remains rooted in [FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md](FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md)\n' +
    'and is not created by this acceptance. Every earlier statement on this page about the ten-ADR base\n' +
    'catalog describes that catalog before these additive records and flips no existing ADR status.\n',
  '\n| [ADR-0015](ADR-0015-deployment-priority-sovereignty-and-provider-neutral-boundary.md) | Deployment priority, data sovereignty and provider-neutral platform boundary | `ACCEPTED` (Founder, 2026-08-23) — Decider `FOUNDER`; decision record only, exact reviewed R6 `6580a4fc…`; architecture/governance authority, no implementation, provider, substrate, deployment or production authority; `OPEN-1`, `OPEN-2`, `OPEN-4`, `OPEN-5`, `OPEN-6`, `OPEN-7`, `OPEN-8`, `OPEN-10` resolved; `OPEN-3`, `OPEN-9`, `OPEN-11` remain open |',
  '\n| [FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md](FOUNDER-DECISION-PACKET-DEPLOYMENT-PRIORITY-2026-08-23.md) | Founder deployment-priority and provider policy of 2026-08-23; authoritative provenance for that policy | `DECIDED — RECORDED` (Founder, 2026-08-23) — records policy only; accepts no ADR, selects no technology, authorizes no implementation or production rollout |',
  '\n| [FOUNDER-DECISION-PACKET-PLATFORM-CONTRACT-2026-08-24.md](FOUNDER-DECISION-PACKET-PLATFORM-CONTRACT-2026-08-24.md) | Founder acceptance of CYBRIK Platform Contract v0.1.0-proposed; resolves OPEN-4 and OPEN-10 | `DECIDED — RECORDED` (Founder, 2026-08-24) — architecture contract authority only |',
  '\n| [FOUNDER-DECISION-PACKET-OPEN-1-OPEN-2-OPEN-5-ACCEPTANCE-2026-08-29.md](FOUNDER-DECISION-PACKET-OPEN-1-OPEN-2-OPEN-5-ACCEPTANCE-2026-08-29.md) | Founder acceptance of open-item contracts (OPEN-1, OPEN-2, OPEN-5); transitions specifications and schemas to ACCEPTED FOR IMPLEMENTATION | `DECIDED — RECORDED` (Founder, 2026-08-29) — architecture contract authority only |',
  '\n| [FOUNDER-DECISION-PACKET-OPEN-1-OPEN-2-OPEN-5-EDITORIAL-AND-SEMANTIC-RECONCILIATION-2026-09-01.md](FOUNDER-DECISION-PACKET-OPEN-1-OPEN-2-OPEN-5-EDITORIAL-AND-SEMANTIC-RECONCILIATION-2026-09-01.md) | Founder acceptance of OPEN-1/2/5 editorial alignment and semantic validator reconciliation | `DECIDED — RECORDED` (Founder, 2026-09-01) — architecture contract authority only |',
  '\n| [FOUNDER-DECISION-PACKET-OPEN-6-OPEN-7-OPEN-8-ACCEPTANCE-2026-09-02.md](FOUNDER-DECISION-PACKET-OPEN-6-OPEN-7-OPEN-8-ACCEPTANCE-2026-09-02.md) | Founder acceptance of sovereign infrastructure architecture standards (OPEN-6 virtualization, OPEN-7 Kubernetes, OPEN-8 authority model) | `DECIDED — RECORDED` (Founder, 2026-09-02) — architecture governance authority only |',
  '\n| [ADR-0015-STATUS-FLIP-APPLICATION.md](ADR-0015-STATUS-FLIP-APPLICATION.md) | Docs-only application of the ADR-0015 Founder acceptance status flip (exact reviewed R6) | `APPLIED 2026-08-23` — decision record only, architecture/governance authority, no implementation authority |',
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
    ...ADR_README_RECEIPT_TRUST_DURABILITY_ADDITIONS,
    ...ADR_README_F8_RECEIPT_INTEGRITY_ADDITIONS,
    ...ADR_README_UAT_MTLS_ADDITIONS,
    ...ADR_README_ADR0015_ADDITIONS,
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

// Scoped to the one ADR-0011 registry row, for the same reason the ADR-0012 guard below is: a
// catalog-wide regex would be satisfied by any other row carrying the same lifecycle string.
const ADR_0011_ROW_PREFIX = '| [ADR-0011](ADR-0011-inference-plane-transport-binding-profile.md) |';

test('P2-3: the intended ADR-0011 / W2-I registry entries record the HB-4 acceptance', () => {
  const adr = read(ADR_README_REL);
  assert.match(adr, /ADR-0011/, 'P2-3: docs/adr/README.md must still register ADR-0011');
  const rows = adr.split('\n').filter((line) => line.startsWith(ADR_0011_ROW_PREFIX));
  assert.equal(
    rows.length,
    1,
    `P2-3: docs/adr/README.md must register ADR-0011 in exactly one row; found ${rows.length}`,
  );
  const [row] = rows;
  assert.match(
    row,
    /`ACCEPTED \(HB-4\)`/,
    `P2-3: the ADR-0011 row must carry the recorded HB-4 acceptance lifecycle:\n${row}`,
  );
  assert.doesNotMatch(
    row,
    /NOT DECIDED|NOT APPLIED|NOT ACCEPTED|NOT OPENED/,
    `P2-3: the ADR-0011 row must not keep any pre-flip proposal-lifecycle wording:\n${row}`,
  );
  assert.match(
    row,
    /not stable v1\/GA/,
    `P2-3: the ADR-0011 row must still deny stable v1\/GA promotion:\n${row}`,
  );
  assert.match(adr, /FOUNDER-DECISION-PACKET-W2-I-PATH-OWNERSHIP\.md/, 'P2-3: docs/adr/README.md must still register the W2-I Founder path-ownership packet');
  assert.match(
    adr,
    /Gate W2-I was `DECIDED — ACCEPT`/,
    'P2-3: the catalog must state that Gate W2-I was decided ACCEPT rather than leaving it NOT OPENED',
  );
  assert.doesNotMatch(
    adr,
    /Gate W2-I is \*\*`NOT OPENED`\*\*/,
    'P2-3: no residual NOT OPENED claim may survive the applied W2-I flip',
  );
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
const UAT_MTLS_D2_COV_P1_AUTHORING_PATHS = [
  'docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md',
  'integration/compose/soc-ai-lifecycle-create-mtls/README.md',
  'integration/compose/soc-ai-lifecycle-create-mtls/scripts/verify_coverage_gate.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_coverage_gate.py',
  'integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py',
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
    /### Gate UAT-MTLS-D2-P0 — preflight authoring([\s\S]*?)(?=\n### Gate UAT-MTLS-D2-COV-P0 — isolated coverage-tooling proposal)/,
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

test('UAT mTLS D2-COV-P0 is executable without pip and binds one durable one-shot action', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  const match = decision.match(
    /### Gate UAT-MTLS-D2-COV-P0 — isolated coverage-tooling proposal([\s\S]*?)(?=\n### Gate UAT-MTLS-D2-COV-P1 — stdlib verifier authoring)/,
  );
  assert.ok(match, 'the ADR must define one D2-COV-P0 dependency proposal before verifier authoring');
  const section = match[1];

  assert.match(
    section,
    /Current state: `EXECUTED — TOOLING VERIFIED — BASELINE COVERAGE FAIL — AUTHORIZATION CONSUMED — RUNTIME HOLD`/,
  );
  assert.doesNotMatch(section, /<PINNED_PYTHON> -m pip install/);
  assert.doesNotMatch(section, /\bpip install\b|ensurepip|uv pip/);
  assert.match(section, /<PINNED_PYTHON> -m zipfile -e/);
  assert.match(section, /No package installer, index, build frontend or lifecycle script\s+is invoked/);
  assert.match(section, /c01011168771934d729261c649c71dadc0d47300cd698c64763cad12a4b7bec7/);
  assert.match(section, /non-empty OSV vulnerability result is a\s+hard stop before extraction/);
  assert.match(section, /raw\.githubusercontent\.com[^\n]+authoring-time provenance[^\n]+not execution inputs/);
  assert.match(section, /Neither root may be under `\/tmp` or\s+`\/private\/tmp`/);
  assert.match(section, /derive the canonical Darwin user temporary directory at execution/);
  assert.match(section, /must equal the\s+recorded `HOST_TEMP_ROOT`/);
  assert.match(
    section,
    /equal the exact\s+`COVERAGE_ROOT` and `COVERAGE_EVIDENCE_ROOT` values from the Founder/,
  );
  assert.match(section, /neither root may equal or descend from the\s+canonical `HOST_TEMP_ROOT`/i);
  assert.match(section, /owner equals the effective uid/);
  assert.match(section, /mode `0700`/);
  assert.match(section, /`st_dev` and `st_ino`/);
  assert.match(section, /tool-root basename must not\s+begin `cybrik-uat-d2-coverage-evidence-`/);
  assert.match(section, /pre-existing root[\s\S]{0,120}hard\s+stop, not a resume/);
  assert.match(section, /authorization is consumed by the single attempt/);
  assert.match(section, /execution must begin at or after `AUTHORIZED_AT` and strictly before `AUTHORIZATION_EXPIRES_AT`/i);
  assert.match(section, /window wider than 24 hours, are a hard stop/);
  assert.match(section, /`AUTHORIZATION_ID` is the\s+one-shot consumption token/);
  assert.match(section, /exact authorized root values plus fresh `mkdir`[\s\S]{0,80}enforce\s+one-shot consumption/);
  assert.match(section, /Changing either root requires a new Founder artifact and a new `AUTHORIZATION_ID`/);
  assert.match(section, /`coverage\.json` and `coverage-gate\.json` SHA-256 digests/);
  assert.match(section, /exactly one OSV POST must complete and be evaluated before extraction/i);
  assert.match(section, /skipped, non-`200`,\s+timed out or unparsable OSV response is a hard stop/);
  assert.match(section, /PYTHONDONTWRITEBYTECODE=1/);
  assert.match(section, /-p no:cacheprovider/);
  assert.match(section, /git status --porcelain -uall --ignored/);

  const fieldsMatch = section.match(
    /authorization artifact must contain exactly these standalone fields[\s\S]{0,120}:\n\n```text\n([\s\S]*?)\n```/,
  );
  assert.ok(fieldsMatch, 'D2-COV-P0 must expose one exact standalone authorization field set');
  const fields = [...fieldsMatch[1].matchAll(/^([A-Z0-9_]+)=/gm)].map((item) => item[1]);
  assert.deepEqual(fields, [
    'D2_COV_P0',
    'AUTHORIZATION_ID',
    'AUTHORIZED_BY',
    'AUTHORIZED_AT',
    'AUTHORIZATION_EXPIRES_AT',
    'SUITE_COMMIT',
    'SUITE_TREE',
    'SUITE_ROOT',
    'HEAD_MODE',
    'WORKING_DIRECTORY',
    'HOST_TEMP_ROOT',
    'COVERAGE_ROOT',
    'COVERAGE_EVIDENCE_ROOT',
    'PINNED_PYTHON',
    'PINNED_PYTHON_REALPATH',
    'PINNED_PYTHON_SHA256',
    'PYTHON_VERSION',
    'PYTEST_VERSION',
    'CRYPTOGRAPHY_VERSION',
    'D1_LOCK_SHA256',
    'D1_REQUIREMENTS_SHA256',
    'D1_LOCKED_WHEEL_COUNT',
    'PINNED_CLOSURE_SHA256',
    'WHEEL_FILENAME',
    'WHEEL_URL',
    'WHEEL_SIZE',
    'WHEEL_SHA256',
    'OSV_ENDPOINT',
    'OSV_REQUEST_SHA256',
    'NETWORK_CLIENT',
    'NETWORK_CLIENT_REALPATH',
    'NETWORK_CLIENT_SHA256',
    'NETWORK_CLIENT_VERSION',
    'NETWORK_POLICY',
    'FETCH_COMMAND',
    'OSV_REQUEST_COMMAND',
    'EXTRACTION_COMMAND',
    'AUTHORIZED_TOOL_SUBPATHS',
    'ONE_SHOT',
    'ROLLBACK',
  ]);

  const values = new Map(
    fieldsMatch[1].split('\n').map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
  );
  assert.equal(values.get('HEAD_MODE'), 'detached');
  assert.equal(values.get('PYTEST_VERSION'), '9.1.1');
  assert.equal(values.get('CRYPTOGRAPHY_VERSION'), '50.0.0');
  assert.equal(values.get('D1_LOCK_SHA256'), 'e05c5e281e230b2089e356d716212a6d2c2e4320a3a30dc8dfd126216faa3add');
  assert.equal(values.get('D1_REQUIREMENTS_SHA256'), '93ec6936e7999ee68e04434b563581ccc5a2e3b4010e252554048b7f75bf1603');
  assert.equal(values.get('D1_LOCKED_WHEEL_COUNT'), '56');
  assert.equal(values.get('PINNED_CLOSURE_SHA256'), '6d6937112e7598ed13e21a96573c9e57c20dbb5df5d986670252391a40c5f919');
  assert.equal(values.get('NETWORK_CLIENT'), '/usr/bin/curl');
  assert.equal(values.get('NETWORK_CLIENT_REALPATH'), '/usr/bin/curl');
  assert.equal(values.get('NETWORK_CLIENT_SHA256'), '5ab042572ea0e068644e3b8f9e8dd1ad197bfcf33d199316615b46ddc4390a41');
  assert.equal(values.get('NETWORK_POLICY'), 'wheel-url-and-one-osv-post-only-no-other-network');
  assert.equal(values.get('AUTHORIZED_TOOL_SUBPATHS'), 'wheel,site-packages,data');
  assert.equal(values.get('ONE_SHOT'), 'true');
  assert.match(values.get('FETCH_COMMAND'), /^\/usr\/bin\/curl /);
  assert.match(values.get('OSV_REQUEST_COMMAND'), /^\/usr\/bin\/curl /);
  assert.equal(
    values.get('EXTRACTION_COMMAND'),
    '<PINNED_PYTHON> -m zipfile -e <COVERAGE_ROOT>/wheel/coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl <COVERAGE_ROOT>/site-packages',
  );

  assert.match(section, /`<COVERAGE_ROOT>\/wheel`/);
  assert.match(section, /`<COVERAGE_ROOT>\/site-packages`/);
  assert.match(section, /`<COVERAGE_ROOT>\/data`/);
  assert.match(section, /working directory equal to the canonical `SUITE_ROOT`/);
  assert.match(section, /D2 remains \*\*HOLD\*\*/);
  assert.match(section, /Release dates remain unchanged/);
});

test('UAT mTLS D2 closure recovery is a finite one-shot prerequisite and not runtime authority', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  const authority = read(
    'docs/operations/DELEGATED-GOVERNOR-D2-COVERAGE-CLOSURE-RECOVERY-2026-08-02.md',
  );
  const evidence = JSON.parse(
    read('integration/compose/soc-ai-lifecycle-create-mtls/evidence/coverage-closure-recovery.json'),
  );
  assert.equal(evidence.schema_version, '1.3.0');
  const match = decision.match(
    /### Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R1([\s\S]*?)(?=\n### Gate UAT-MTLS-D2 — real runtime execution)/,
  );
  assert.ok(match, 'the ADR must bind the separately authorized closure-recovery prerequisite');
  const section = match[1];
  assert.match(
    decision,
    /^### Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R1\n\nCurrent state: `EXECUTED — FAILED PRE-NETWORK — AUTHORIZATION CONSUMED — RUNTIME HOLD`\.$/m,
  );
  assert.match(
    decision,
    /^### Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R2\n\nCurrent state: `EXECUTED — FAILED AFTER WHEEL ACQUISITION — AUTHORIZATION CONSUMED — RUNTIME HOLD`\.$/m,
  );
  assert.match(
    decision,
    /^### Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R3\n\nCurrent state: `EXECUTED — FAILED AFTER WHEEL ACQUISITION — AUTHORIZATION CONSUMED — RUNTIME HOLD`\.$/m,
  );
  assert.match(
    decision,
    /^### Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R4\n\nCurrent state: `EXECUTED — VERIFIED — AUTHORIZATION CONSUMED — COVERAGE CLOSURE READY — RUNTIME HOLD`\.$/m,
  );
  assert.match(section, /recover_coverage_closure\.py/);
  assert.match(section, /exactly the 56/);
  assert.match(section, /6d6937112e7598ed13e21a96573c9e57c20dbb5df5d986670252391a40c5f919/);
  assert.match(section, /does not install or extract Coverage\.py/);
  assert.match(section, /does not open D2 runtime/);
  assert.match(authority, /repository writes are limited to exactly these ten paths/);
  assert.match(authority, /consumed by the first `--execute` attempt/);
  assert.match(authority, /Production and public GA remain Founder-controlled/);
  assert.equal(evidence.r1.network_calls_started, 0);
  assert.equal(evidence.r1.rollback_status, 'removed');
  assert.equal(evidence.r2.execution_status, 'failed');
  assert.equal(evidence.r2.failure_reason, 'venv_identity_mismatch');
  assert.equal(evidence.r2.network_phase_status, 'wheel_acquisition_and_verification_completed');
  assert.equal(evidence.r2.rollback_status, 'removed');
  assert.equal(evidence.r2.retry_ceiling, 1);
  assert.equal(evidence.r3.execution_status, 'failed');
  assert.equal(evidence.r3.failure_reason, 'venv_identity_mismatch');
  assert.equal(evidence.r3.network_phase_status, 'wheel_acquisition_and_verification_completed');
  assert.equal(evidence.r3.rollback_status, 'removed');
  assert.equal(evidence.r3.retry_ceiling, 1);
  assert.equal(evidence.r3.expected_final_links.python, 'python3.12');
  assert.equal(evidence.r4.execution_status, 'passed');
  assert.equal(evidence.r4.status, 'verified');
  assert.equal(evidence.r4.closure_root_removed, false);
  assert.equal(
    evidence.r4.attempt_id,
    'ab467ae45163e72dc1bdb22c50d0db8cb478eb87b123ca5efdd71269b590e2b6',
  );
  assert.equal(evidence.r4.commit, '3c20de6ff6b44ff8b2c8b6c33d13f2f76672adfb');
  assert.equal(evidence.r4.tree, 'dae9bb5621ecefe10f62c2164dd4e1565cfcb377');
  assert.equal(
    evidence.r4.closure_sha256,
    '6d6937112e7598ed13e21a96573c9e57c20dbb5df5d986670252391a40c5f919',
  );
  assert.equal(evidence.r4.wheel_count, 56);
  assert.equal(
    evidence.r4.recovery_start_sha256,
    '40f57b331949e1ffaa0db73d4903cf631ad6207fd57a7776ef0a2b4dbb24654e',
  );
  assert.equal(
    evidence.r4.recovery_result_sha256,
    '7d8b81036e48e4ffe0bd4ba94545f1aa2cd42d7dc82ba27e4eec68f6c6526b7f',
  );
  assert.equal(
    evidence.r4.recovery_result_digest_file_sha256,
    '900e66a512e8e1ea03ab30c45c8efc23f3216371c5afc620feccea9569ccb861',
  );
  assert.equal(
    evidence.r4.installed_closure_file_sha256,
    '6a83b0ea9693dc69cee4ccce517ac2d953e7df0c55ef8b82d99a877266f16538',
  );
  assert.equal(
    evidence.r4.requirements_file_sha256,
    'bf3fc708b271e245eacc1b0696f6892935fec9f45fda762fd5d041d0bdb7d07d',
  );
  assert.equal(
    evidence.r4.wheel_manifest_sha256,
    'bbec1a442f93066c684590be33560386e62e4257ec9d53a6b0119a92e6e2bc15',
  );
  assert.equal(evidence.r4.started_at, '2026-08-02T03:26:51.384928+00:00');
  assert.equal(evidence.r4.completed_at, '2026-08-02T03:27:07.084539+00:00');
  assert.equal(evidence.r4.retry_ceiling, 1);
  assert.match(evidence.r4.authorized_initial_links.python, /cpython-3\.12-macos-aarch64-none/);
  assert.equal(evidence.r4.expected_final_links.python, 'python3.12');
  assert.deepEqual(evidence.r4.observed_final_links, evidence.r4.expected_final_links);
  assert.equal(
    evidence.r4.pinned_alias.sha256,
    'a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623',
  );
  assert.equal(
    evidence.r4.pinned_alias.alias_parent_literal_target,
    join(
      dirname(dirname(dirname(evidence.r4.pinned_alias.literal_path))),
      'cpython-3.12.13-macos-aarch64-none',
    ),
  );
  assert.equal(evidence.r4.pinned_alias.alias_parent_owner_requirement, 'effective_uid');
  assert.equal(evidence.runtime_status, 'HOLD');
});

test('UAT mTLS D2 coverage measurement chain is terminal while runtime remains held', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  const authority = read(
    'docs/operations/DELEGATED-GOVERNOR-D2-COVERAGE-MEASUREMENT-2026-08-02.md',
  );
  const catalog = read('docs/operations/README.md');
  const harness = read('integration/compose/soc-ai-lifecycle-create-mtls/README.md');
  const evidence = JSON.parse(
    read('integration/compose/soc-ai-lifecycle-create-mtls/evidence/coverage-measurement.json'),
  );
  const runtimeNodeid =
    'tests/test_lifecycle_runtime.py::test_authorized_runtime_attempt_executes_the_red_green_sequence';

  assert.match(decision, new RegExp(`--deselect=${runtimeNodeid.replaceAll('.', '\\.')}`));
  assert.doesNotMatch(
    decision,
    /--deselect=<SUITE_ROOT>\/integration\/compose\/soc-ai-lifecycle-create-mtls\/tests\/test_lifecycle_runtime\.py/,
  );
  assert.match(decision, /Gate UAT-MTLS-D2-COV-M1 — failed command-shape measurement/);
  assert.match(decision, /Gate UAT-MTLS-D2-COV-M2 — terminal coverage measurement/);
  assert.match(decision, /COVERAGE GATE PASS — RUNTIME HOLD/);
  assert.match(authority, /488 passed, 1 deselected/);
  assert.match(authority, /31 passed/);
  assert.match(authority, /Release dates remain unchanged/);
  assert.match(harness, /COVERAGE GATE PASS — RUNTIME HOLD/);
  assert.match(catalog, /DELEGATED-GOVERNOR-D2-COVERAGE-MEASUREMENT-2026-08-02\.md/);

  assert.equal(evidence.schema_version, '1.0.0');
  assert.equal(evidence.status, 'verified');
  assert.equal(evidence.gate, 'UAT-MTLS-D2-COV-M2');
  assert.equal(evidence.disposition, 'COVERAGE_GATE_PASS_RUNTIME_HOLD');
  assert.equal(evidence.suite_commit, '93c8b6efbd141ab3f37ff2f07f331153de5f314a');
  assert.equal(evidence.suite_tree, 'c67470e531dd3345744e3ef48bc11e0b3d3af218');
  assert.equal(evidence.p0.tooling_status, 'verified');
  assert.equal(evidence.p0.baseline_gate_status, 'FAIL');
  assert.equal(evidence.p0.coverage_json_mode_hardening.before, '0644');
  assert.equal(evidence.p0.coverage_json_mode_hardening.after, '0600');
  assert.equal(evidence.p0.coverage_json_mode_hardening.sha256_unchanged, true);
  assert.equal(evidence.m1.status, 'FAIL');
  assert.equal(evidence.m1.failure_class, 'runtime_test_was_not_deselected');
  assert.equal(evidence.m1.runtime_executed, false);
  assert.deepEqual(evidence.m1.network_calls, []);
  assert.deepEqual(evidence.m2.test_result, {
    passed: 488,
    deselected: 1,
    skipped: 0,
    failed: 0,
  });
  assert.deepEqual(evidence.m2.line, { covered: 1366, total: 1568 });
  assert.deepEqual(evidence.m2.branch, { covered: 439, total: 514 });
  assert.equal(evidence.m2.critical_symbols.length, 8);
  assert.ok(evidence.m2.critical_symbols.every((item) => item.line_ratio === 1));
  assert.ok(
    evidence.m2.critical_symbols.every(
      (item) =>
        item.branch_ratio === 1 ||
        item.branch_requirement === 'not-applicable-no-static-branch',
    ),
  );
  assert.equal(
    evidence.m2.verifier_output_sha256,
    '299a9ae6ca6a54f6cac573aa7657e03f3e879b4266658f083db4042ae59c73a4',
  );
  assert.equal(evidence.verifier_tests.passed, 31);
  assert.equal(
    evidence.verifier_tests.junit_sha256,
    '51ab9cdb2c1fddd34393735c4dd5ab9117b1fd4561cac0308e68d27a828907fe',
  );
  assert.equal(
    evidence.historical_corrections.commit_93c8b6e_test_shape,
    '488_passed_1_deselected_not_1_gated_skip',
  );
  assert.doesNotMatch(decision, /Its section 7\.3 coverage gate remains unsatisfied/);
  assert.match(
    decision,
    /At P0 execution time, its section 7\.3 coverage gate remained unsatisfied/,
  );
  assert.doesNotMatch(decision, /Phase A must remain closed until exact commands/);
  assert.match(
    decision,
    /At D2-P0 authoring time, Phase A therefore remained closed/,
  );
  assert.doesNotMatch(
    harness,
    /Phase A remains closed until a separately pinned command/,
  );
  assert.match(
    harness,
    /At D2-P0 authoring time, Phase A remained closed/,
  );
  assert.deepEqual(evidence.independent_reviews, {
    codex_post_execution: 'GO_WITH_REMEDIATED_P3',
    claude_opus_post_execution: 'GO_NO_P0_P2_WITH_8_RECONCILED_ERRATA',
    terminal_packet_r1: 'P2_OVERCLAIM_FIXED_IN_R2',
  });
  assert.equal(evidence.m2.runtime_status, 'HOLD');
});

test('UAT mTLS D2-COV-P2 provides an executable closure-bound one-shot validator', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  const match = decision.match(
    /### Gate UAT-MTLS-D2-COV-P2 — executable authorization hardening([\s\S]*?)(?=\n### Gate UAT-MTLS-D2 — real runtime execution)/,
  );
  assert.ok(match, 'D2-COV-P2 must close the prose-only authorization gap');
  const section = match[1];
  assert.match(section, /validate_coverage_authorization\.py --authorization/);
  assert.match(section, /--check-only/);
  assert.match(section, /--consume/);
  assert.match(section, /PINNED_CLOSURE_SHA256/);
  assert.match(section, /CRYPTOGRAPHY_VERSION=50\.0\.0/);
  assert.match(section, /PYTEST_VERSION=9\.1\.1/);
  assert.match(section, /must not be under `\/tmp`, `\/private\/tmp`/);
  assert.match(section, /does not install or restore the\s+D1 closure/);
  assert.match(section, /D2 remains \*\*HOLD\*\*/);
  assert.match(
    section,
    /Current state: `AUTHORED — VALIDATOR TESTS GREEN — P0 CONSUMED — RUNTIME HOLD`/,
  );
});

test('UAT mTLS D2-COV-P1 authors one fail-closed stdlib verifier without gate credit', () => {
  const decision = read(UAT_MTLS_DECISION_REL);
  const match = decision.match(
    /### Gate UAT-MTLS-D2-COV-P1 — stdlib verifier authoring([\s\S]*?)(?=\n### Gate UAT-MTLS-D2 — real runtime execution)/,
  );
  assert.ok(match, 'the ADR must define one D2-COV-P1 verifier-authoring gate before D2 runtime');
  const section = match[1];
  assert.match(section, /Current state: `AUTHORED — STATIC TESTS GREEN — M2 VERIFIED — RUNTIME HOLD`/);
  const scopeMatch = section.match(
    /maximum authoring scope is exactly:\n\n((?:- `[^`]+`\n){6})\nNo other path/,
  );
  assert.ok(scopeMatch, 'D2-COV-P1 must expose one exact six-path authoring list');
  const paths = [...scopeMatch[1].matchAll(/^- `([^`]+)`$/gm)].map((item) => item[1]);
  assert.deepEqual(paths, UAT_MTLS_D2_COV_P1_AUTHORING_PATHS);
  assert.match(section, /pure stdlib and import-inert/);
  assert.match(section, /Coverage\.py JSON format 3/);
  assert.match(section, /58c5f326cd785026b22123eb99385cad44d026aff64bd96dc0840a1baf26dea2/);
  assert.match(section, /8eb1f796e71ea4a57f4f9919dbbd3a2810182a7fb2cb1cffb861c861173ab754/);
  assert.match(section, /8294b5ef2ade283e167029b7ecf8cabdcbf9e1f527b98ee93c2d6bd1f980be0b/);
  assert.match(section, /from the first body statement through\s+the last body statement/);
  assert.match(section, /no excluded line anywhere in the measured\s+package/);
  assert.match(section, /not-applicable-no-static-branch/);
  assert.match(section, /critical source range may contain no excluded line/);
  assert.match(section, /`# pragma: no cover` or\s+`# pragma: no branch`/);
  assert.match(section, /mode-`0600`/);
  assert.match(section, /PASS and FAIL/);
  assert.match(section, /does not install Coverage\.py/);
  assert.match(section, /does not\s+satisfy the section 7\.3 coverage gate/);
  assert.match(section, /does not open Phase A/);
  assert.match(section, /D2 remains \*\*HOLD\*\*/);
  assert.match(section, /Release dates remain unchanged/);
});
// <<< UAT-MTLS-S1-R2-R3-D1-CONTROLS-END
