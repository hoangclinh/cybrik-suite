#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CATEGORY_SIZES = {
  I: 12,
  T: 12,
  R: 6,
  S: 5,
  B: 5,
  IR: 4,
  D: 4,
};

function taskRange(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `W0-${prefix}${String(index + 1).padStart(2, "0")}`,
  );
}

const EXPECTED_TASKS = Object.entries(CATEGORY_SIZES).flatMap(
  ([prefix, count]) => taskRange(prefix, count),
);

// The single date on which GATE A4 and the separate W1-C1/C2 contract gate were
// both answered under Founder-delegated current-thread authority.
const ACCEPTED_ON = "2026-07-26";

// Current, post-acceptance identities, re-verified from the committed bytes of
// the two accepted path-limited local commits. They supersede the pre-acceptance
// `cd872a0e…`/`16099c17…` pins, which survive only as dated history.
const W1_C1_COMMIT = "3a2c71555a423465855ffaddcb663c8b704dbfbd";
const W1_C2_COMMIT = "ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4";
const W1_CANDIDATE_PARENT = "3ef8e0536f8210f2739c6fa0e32e37f8dc27d619";
const W1_C1_DIGEST =
  "e4cfbf8c6f6ccfe545a91d63b0bee6de4c616a28e3f1a61c320f8fde747e1d35";
const W1_C2_DIGEST =
  "0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e";

const W1_C1_PATH_COUNT = 16;
const W1_C2_PATH_COUNT = 32;

// Accepted current contract state and the exact noncanonical rehearsal graph.
// Historical pins above remain intact because the original acceptance records
// are immutable provenance; this block governs current implementation.
const W1_RECONCILIATION = {
  lifecycle:
    "ACCEPTED-AND-LOCALLY-INTEGRATED — REHEARSAL ONLY — NONCANONICAL",
  controlBase: "b2caf77c3cd96beb7383cc3d93844d771262ea5f",
  c1Correction: "20cfa36c503e5a95341c80653d25d2000d65c9fe",
  c1g1Tip: "71857395332fabe041896ca0700fbf7a2bf612d3",
  correctedC2Tip: "5a1ed0001a5714b7f099aeaff3f5a74cb67c068a",
  mergeOne: "87efae7898bd14e9aa9a2866380a9973d8b3e5bc",
  mergeOneTree: "abb4d16d1c6038ccc33931c009628a47b2b0bd68",
  mergeTwo: "900d83a61515f37ae117e04763da1881cba90b7b",
  mergeTwoTree: "a297646ec6d4901c8861d28b5ec8736f65902b70",
  c1Digest:
    "27a6bdeb168599dc4fd05e27f06785315a3b763647826559efe9d721bc0292c8",
  g1Digest:
    "a285fa8e4850999dc013b03506ed1e62f5c7bb4209d198a4e16fa02c446b43f4",
  c2Digest:
    "d741f22470a59bde5f0761dd6f3309acb9bb9b851970bc95c5228efd135a5449",
  legacyBundleSha:
    "501cb160f2fe7035c824d5b0ab37b74d5624cf99a7c25c7adffa72dff9c53bb1",
};

const W1_RECONCILIATION_HISTORICAL_COMMITS = [
  "3a2c71555a423465855ffaddcb663c8b704dbfbd",
  "a976a205601de22dae59e5112e37ae29707fda0e",
  "ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4",
];

const W1_RECONCILIATION_CONTROL_PATHS = [
  "docs/adr/W1-CONTRACT-RECONCILIATION-APPLICATION.md",
  "docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md",
  "docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md",
  "docs/adr/README.md",
  "docs/operations/W1-48-AGENT-ROLLING-BOARD.md",
  "docs/operations/W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md",
  "docs/operations/W1-E2-EVIDENCE-REGISTER.md",
  "tools/operations/validate-w1-control.mjs",
  "tools/operations/tests/validate-w1-control.test.mjs",
];

const W1_RECONCILIATION_CI_PATHS = [
  ".github/workflows/contracts.yml",
  "tools/contract-validation/package.json",
  "tools/contract-validation/validate.mjs",
];

const CI_ACTION_PINS = new Map([
  [
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    2,
  ],
  [
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    1,
  ],
]);

const W1_RECONCILIATION_GOVERNANCE = {
  decision: "DELEGATED-GOVERNOR-ACCEPTED",
  localCommitAuthorized: true,
  exactPathCount: 12,
  independentRereviewCompleted: false,
  codexFallbackAccepted: true,
  pushed: false,
  merged: false,
  released: false,
};

const W1_RECONCILIATION_SECURITY = {
  lockfileChanged: false,
  auditHigh: 13,
  auditCritical: 0,
  rootAdvisory: "GHSA-mh99-v99m-4gvg",
  localEvidenceCommitBlocked: false,
  ciActivationBlocked: true,
};

// The accepted lifecycle string shared by both contract packets.
const ACCEPTED_CONTRACT_LIFECYCLE =
  "ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY";

const W1_C1_CANDIDATE_ROW =
  "| W1-C1 alert context | " +
  `\`${W1_C1_COMMIT}\` on \`codex/w1-i01-alert-context-proposal-r1\`, ` +
  `parent \`${W1_CANDIDATE_PARENT}\` | exactly 16 paths; standalone validator ` +
  "`PASS`; 21/21 tests; 87.27% branch coverage against the declared 80% branch " +
  `floor; member-set digest \`sha256:${W1_C1_DIGEST}\` (13/13 member hashes ` +
  "match); final independent review W0-R05 `PASS`, no open P0–P2 | " +
  `\`${ACCEPTED_CONTRACT_LIFECYCLE}\` |`;

const W1_C2_CANDIDATE_ROW =
  "| W1-C2 investigation lifecycle | " +
  `\`${W1_C2_COMMIT}\` on \`codex/w1-i02-investigation-lifecycle-proposal-r1\`, ` +
  `parent \`${W1_CANDIDATE_PARENT}\` | exactly 32 paths; standalone validator ` +
  "`PASS`; 31/31 tests; 97.44% branch coverage; official Ajv strict eight clean " +
  "compilations, Spectral/AsyncAPI zero errors; aggregate SHA-256 " +
  `\`${W1_C2_DIGEST}\` (30/30 member digests match); final independent review ` +
  "W0-T01 `PASS`, no open P0–P3 | " +
  `\`${ACCEPTED_CONTRACT_LIFECYCLE}\` |`;

// ── Dual-state W1-C1 provenance ────────────────────────────────────────────
//
// The lane now carries two disjoint states that must never be conflated:
//
//   1. the ACCEPTED baseline — commit `3a2c715…`, member set `e4cfbf8c…`,
//      byte-for-byte unchanged, still the only accepted W1-C1 artifact; and
//   2. the W0-I01C CORRECTION CANDIDATE — an uncommitted working-tree overlay
//      on that same base, with its own member set, its own coverage figure and
//      no commit object at all.
//
// Every rule below is scoped to the *candidate* anchors, which are unique by
// construction. Nothing here rescans the whole corpus for commit-shaped
// digests: the historical SHAs quoted across dated records stay valid.
const W1_C1_CANDIDATE_LANE = "W0-I01C";
// The correction is now a real commit — local-only, unreviewed by any contract
// gate, and integrated nowhere. `committed` and `accepted` are independent
// axes and the lifecycle string names both.
const W1_C1_CANDIDATE_LIFECYCLE =
  "CORRECTION COMMITTED — LOCAL-ONLY — NOT INTEGRATED — NOT ACCEPTED";
const W1_C1_CANDIDATE_BRANCH = "codex/w1-c1-correction-a2-r1";
const W1_C1_CANDIDATE_COMMIT_ABBREV = "20cfa36";
const W1_C1_CANDIDATE_COMMIT_PARENT_ABBREV = "a976a20";
const W1_C1_CANDIDATE_TREE_ABBREV = "380a8f7";
const W1_C1_CANDIDATE_MEMBER_SET =
  "27a6bdeb168599dc4fd05e27f06785315a3b763647826559efe9d721bc0292c8";
const W1_C1_CANDIDATE_MEMBER_COUNT = 13;
const W1_C1_CANDIDATE_DIRTY_PATHS = 16;
const W1_C1_CANDIDATE_STAGED = 0;
const W1_C1_CANDIDATE_WORKING_TREE_AGGREGATE =
  "76ef51d97dced58eda98b1144ca72f98cf81c7caff6cc51ffc3eab50114c940a";

// The candidate row is pinned byte-exact and is byte-identical in the register
// and on the board, so neither document can drift away from the other.
// Abbreviated identities only. The full 40-hex commit, parent and tree live in
// the bounded Lane 5 local-provenance table; this row is republished inside
// regions whose foreign-identity guard forbids any new full digest.
const W1_C1_CORRECTION_ROW =
  `| ${W1_C1_CANDIDATE_LANE} — W1-C1 alert-context correction candidate | ` +
  `committed local-only at \`${W1_C1_CANDIDATE_COMMIT_ABBREV}\`, parent ` +
  `\`${W1_C1_CANDIDATE_COMMIT_PARENT_ABBREV}\`, tree ` +
  `\`${W1_C1_CANDIDATE_TREE_ABBREV}\`, branch ` +
  `\`${W1_C1_CANDIDATE_BRANCH}\`, on accepted base \`${W1_C1_COMMIT}\` | ` +
  `\`${W1_C1_CANDIDATE_LIFECYCLE}\`; exactly ` +
  `${W1_C1_CANDIDATE_DIRTY_PATHS} paths, zero staged | ` +
  `candidate \`member_set\` \`sha256:${W1_C1_CANDIDATE_MEMBER_SET}\` ` +
  `(\`MEMBER-SET-SHA256/v1\`, ${W1_C1_CANDIDATE_MEMBER_COUNT}/` +
  `${W1_C1_CANDIDATE_MEMBER_COUNT} member hashes, \`member_count\` ` +
  `${W1_C1_CANDIDATE_MEMBER_COUNT}); standalone validator \`PASS\`; candidate ` +
  "suite 21/21; 86.99% branch coverage against the declared 80% branch floor; " +
  "independent review `PASS`, no open P0–P2; the downstream alert-context " +
  "transport stale lock is disclosed with this candidate |";

// Values that belong to exactly one of the two states. A value from the other
// column appearing in a row is cross-contamination and fails closed both ways.
const ACCEPTED_ONLY_VALUES = [
  { label: "accepted member-set digest", value: W1_C1_DIGEST },
  { label: "accepted contract lifecycle", value: ACCEPTED_CONTRACT_LIFECYCLE },
  { label: "accepted branch-coverage figure", value: "87.27%" },
];

const CANDIDATE_ONLY_VALUES = [
  { label: "candidate member-set digest", value: W1_C1_CANDIDATE_MEMBER_SET },
  { label: "candidate lifecycle", value: W1_C1_CANDIDATE_LIFECYCLE },
  { label: "candidate branch-coverage figure", value: "86.99%" },
  {
    label: "candidate working-tree aggregate",
    value: W1_C1_CANDIDATE_WORKING_TREE_AGGREGATE,
  },
];

// Affirmative promotion claims only. Negated disclosures ("not accepted", "not
// a superseding value") are exactly what these regions are supposed to say, so
// the patterns match verb forms, never the bare nouns.
//
// The `is committed` pattern was withdrawn on 2026-07-28: the correction *is*
// committed now, local-only, and saying so is a fact rather than a promotion.
// Acceptance, supersession and integration remain the guarded axes.
const CANDIDATE_PROMOTION_CLAIMS = [
  /\bcandidate\b[^.\n]{0,160}\bsupersedes the (accepted|W1-C1 )?/i,
  /\bcandidate\b[^.\n]{0,160}\breplaces the (accepted|W1-C1 )?/i,
  /\bcandidate\b[^.\n]{0,160}\bis accepted\b/i,
  /\bcandidate\b[^.\n]{0,160}\bhas been accepted\b/i,
  /\bcandidate\b[^.\n]{0,160}\bis integrated\b/i,
  /\bcandidate\b[^.\n]{0,160}\bbecomes the accepted\b/i,
  /\bis a superseding value\b/i,
  /\bnew accepted (baseline|artifact|commit|W1-C1)\b/i,
];

// Superseded values. Both the original pre-repair pins and the pre-acceptance
// §14.4 pins are history now: they may still be named in a dated reconciliation
// section, but must never reappear inside a live evidence row.
const STALE_CANDIDATE_PINS = [
  {
    attribute: "aggregate",
    lane: "W1-C1",
    fragment: "ce9921d3",
  },
  {
    attribute: "aggregate",
    lane: "W1-C1",
    fragment: "cd872a0e",
  },
  {
    attribute: "coverage",
    lane: "W1-C1",
    fragment: "90\\.39% line coverage",
  },
  {
    attribute: "coverage",
    lane: "W1-C1",
    fragment: "87\\.87% branch coverage",
  },
  {
    attribute: "test count",
    lane: "W1-C1",
    fragment: "18/18",
  },
  {
    attribute: "aggregate",
    lane: "W1-C2",
    fragment: "f79702c6",
  },
  {
    attribute: "aggregate",
    lane: "W1-C2",
    fragment: "16099c17",
  },
  {
    attribute: "test count",
    lane: "W1-C2",
    fragment: "10/10",
  },
  {
    attribute: "test count",
    lane: "W1-C2",
    fragment: "29/29",
  },
  {
    attribute: "coverage",
    lane: "W1-C2",
    fragment: "86\\.67% line coverage",
  },
  {
    attribute: "coverage",
    lane: "W1-C2",
    fragment: "97\\.39% branch coverage",
  },
];

// Row anchors are regex fragments identifying the live accepted-evidence row of
// each lane in each document. Reconciliation/history tables deliberately do not
// match them, so superseded values stay readable as history.
const CONTRACT_GATE_ROW_ANCHORS = {
  "W1-C1": "\\| W1-C1 alert context \\|",
  "W1-C2": "\\| W1-C2 investigation lifecycle \\|",
};

const E2_REGISTER_ROW_ANCHORS = {
  "W1-C1":
    "\\| W0-I01/T01 — W1-C1 alert context \\|[^\\n]*" +
    `\`${ACCEPTED_CONTRACT_LIFECYCLE}\``,
  "W1-C2":
    "\\| W0-I02/R05 — W1-C2 investigation lifecycle \\|[^\\n]*" +
    `\`${ACCEPTED_CONTRACT_LIFECYCLE}\``,
};

const BOARD_ROW_ANCHORS = {
  "W1-C1": "\\| W0-I01/T01 — W1-C1 alert context \\|",
  "W1-C2": "\\| W0-I02/R05 — W1-C2 investigation lifecycle \\|",
};

// Both W1 contract applications were applied on 2026-07-26; the gate they were
// waiting on (the W1-C1/C2 contract gate) is closed.
const APPLIED_W1_CONTRACT_APPLICATIONS = [
  {
    lane: "W1-C1",
    path: "docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md",
    commit: W1_C1_COMMIT,
    pathCount: W1_C1_PATH_COUNT,
    statusBlock:
      "- **Status:** `APPLIED 2026-07-26 — W1-C1 CONTRACT ACCEPTANCE RECORDED — " +
      "LOCAL COMMIT ONLY — NO PUSH, MERGE OR RELEASE AUTHORITY`",
    resultingStatusBlock:
      "- **Resulting contract status:** `ACCEPTED FOR IMPLEMENTATION v0.1.0` — not stable\n" +
      "  v1/GA; contract-first implementation basis only; no runtime, dependency, database,\n" +
      "  container, endpoint, transport, CI-wiring, push, merge, deployment or release authority\n" +
      "  follows",
  },
  {
    lane: "W1-C2",
    path: "docs/adr/W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md",
    commit: W1_C2_COMMIT,
    pathCount: W1_C2_PATH_COUNT,
    statusBlock:
      "- **Status:** `APPLIED 2026-07-26 — W1-C2 CONTRACT ACCEPTANCE RECORDED — " +
      "LOCAL COMMIT ONLY — NO PUSH, MERGE OR RELEASE AUTHORITY`",
    resultingStatusBlock:
      "- **Resulting contract status:** `ACCEPTED FOR IMPLEMENTATION v0.1.0` — not stable\n" +
      "  v1/GA; contract-first implementation basis only; no runtime, dependency, database,\n" +
      "  container, endpoint, server, transport, CI-wiring, push, merge, deployment or release\n" +
      "  authority follows",
  },
];

const W1_APPLICATION_PATHS = APPLIED_W1_CONTRACT_APPLICATIONS.map(
  ({ path }) => path,
);

// GATE A4 was answered on 2026-07-26 under Founder-delegated current-thread
// authority: ADR-0003 H1..H11 and ADR-0005 J1..J10 accepted, and the two
// docs-only status-flip applications applied. The flip is a *decision* record
// only — every implementation, dependency, spike, runtime, Git, deployment and
// release action stays behind its own separate gate, and the blocks below make
// that non-negotiable.
const GATE_A4_ACCEPTED_ON = ACCEPTED_ON;

const APPLIED_ADR_APPLICATIONS = [
  {
    adr: "ADR-0003",
    label: "ADR-0003 durable agent orchestration",
    path: "docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md",
  },
  {
    adr: "ADR-0005",
    label: "ADR-0005 sandbox substrate",
    path: "docs/adr/ADR-0005-STATUS-FLIP-APPLICATION.md",
  },
];

const ACCEPTED_ADR_STATUS_BLOCK =
  "- Status: `ACCEPTED` (GATE A4, 2026-07-26) — decision only; no implementation, dependency or\n" +
  "  runtime authority";

const GATE_A4_PINNED_BLOCKS = [
  {
    block:
      "- **Status:** `ACCEPTED — GATE A4 CLOSED 2026-07-26 — STATUS FLIP APPLIED — " +
      "NO IMPLEMENTATION AUTHORITY`",
    message:
      "GATE A4 must record `ACCEPTED — GATE A4 CLOSED 2026-07-26` with the status flip applied " +
      "and no implementation authority",
  },
  {
    block:
      "- **Decision:** Option A **accepted 2026-07-26** under Founder-delegated current-thread " +
      "authority;\n  ADR-0003 `H1..H11` accepted and ADR-0005 `J1..J10` accepted; ADR-0003 and " +
      "ADR-0005 are now\n  `ACCEPTED`",
    message:
      "GATE A4 decision line must stay pinned: Option A accepted 2026-07-26 under " +
      "Founder-delegated current-thread authority, H1..H11 and J1..J10 accepted",
  },
  {
    block:
      "- This acceptance flips ADR-0003 and ADR-0005 to `ACCEPTED` and grants nothing else: no\n" +
      "  implementation, no dependency selection or installation, no spike or benchmark run, no " +
      "database,\n  container, microVM, netns or broker start, and no staging, commit, merge, " +
      "push, deployment,\n  release or release-date authority.",
    message:
      "GATE A4 must keep the exact bullet stating the acceptance grants nothing else — no " +
      "implementation, dependency, spike, DB/container/broker, Git, deployment or release authority",
  },
  {
    block:
      "Duyệt GATE A4 Option A: ADR-0003 H1..H11=yes; ADR-0005 J1..J10=yes; ADR-0003 và ADR-0005 " +
      "chuyển sang `ACCEPTED` (docs-only status flip đã áp dụng); không mở implementation, " +
      "không install dependency, không chạy spike/benchmark/DB/container/broker, không " +
      "stage/commit/merge/push, không deploy hoặc release.",
    message:
      "Vietnamese GATE A4 recorded decision shorthand must stay pinned byte-exact with its " +
      "no-implementation, no-dependency, no-spike and no-Git guards",
  },
];

function assertNoStalePins(text, rowAnchors, label) {
  for (const { attribute, lane, fragment } of STALE_CANDIDATE_PINS) {
    const anchor = rowAnchors[lane];
    assertExcludes(
      text,
      new RegExp(`^${anchor}[^\\n]*${fragment}`, "m"),
      `${label} carries the superseded ${lane} ${attribute} pin; the ${lane} row must ` +
        "use the value re-verified from the committed bytes of the accepted commit",
    );
  }
}

// Pinned blocks are matched byte-exact and must each stay unique inside the
// packet so drift tests can target them by first-occurrence replacement.
const CONTRACT_GATE_PINNED_BLOCKS = [
  {
    block:
      "| C1-7 | **Yes** — result marking never exceeds request clearance; no " +
      "authoritative source-marking floor is claimed by this packet |",
    message:
      "W1 contract gate C1-7 row must stay pinned byte-exact, including the " +
      "no-authoritative-source-marking-floor clause",
  },
  {
    block:
      "| C1-9 | **Yes** — scope the acceptance to the exact 16-path/hash " +
      "candidate only; no endpoint, transport, registry, product or runtime " +
      "implementation follows automatically |",
    message:
      "W1 contract gate C1-9 row must stay pinned to the exact 16-path/hash " +
      "acceptance scope; no endpoint, transport, registry, product or runtime " +
      "implementation follows automatically",
  },
  {
    block:
      "| C2-4 | **Yes** — endorse create, status, ordered checkpoint list, " +
      "compare-and-set cancel and Bundle-read operations with no declared " +
      "server/runtime binding |",
    message:
      "W1 contract gate C2-4 row must stay pinned to endorse-only operation " +
      "wording with no declared server/runtime binding",
  },
  {
    block:
      "| C2-5 | **Yes** — tenant/org/actor scope derives from authenticated " +
      "identity/policy and advisory body values never expand scope; marking is an " +
      "authoritative request input and artifact marking never downgrades |",
    message:
      "W1 contract gate C2-5 must separate authenticated identity/policy scope " +
      "from the authoritative marking request input and artifact-marking non-downgrade",
  },
  {
    block:
      "| C2-10 | **Yes** — scope the acceptance to the exact 32-path/hash " +
      "candidate; Bundle v0.1.1 is only a proposed successor candidate, v0.1.0 " +
      "remains the authoritative Bundle contract, and v0.1.1 adoption, " +
      "supersession and consumer migration require separate future authority |",
    message:
      "W1 contract gate C2-10 row must stay pinned to the exact 32-path/hash " +
      "acceptance scope and version-guard wording",
  },
  {
    block:
      "Each `Yes` was recorded as an accepted contract decision at `v0.1.0`. No " +
      "row grants endpoint,\ntransport, registry, product or runtime " +
      "implementation authority, and no row grants push, merge or\nrelease " +
      "authority.",
    message:
      "W1 contract gate section 3 preamble must keep its exact accepted-at-v0.1.0, " +
      "no-implementation, no-push/merge/release wording",
  },
  {
    block:
      "Each `Yes` binds the accepted `v0.1.0` contract only. No row adopts Bundle " +
      "v0.1.1 or supersedes\nv0.1.0.",
    message:
      "W1 contract gate section 4 preamble must keep its exact accepted-v0.1.0-only, " +
      "no-adoption, no-supersession wording",
  },
  {
    block:
      "- No contract acceptance proves runtime authorization, no-existence " +
      "timing, durability, live\n  SOC→AI→Fabric execution or a returned Bundle.",
    message:
      "W1 contract gate boundaries must keep the exact " +
      "no-contract-acceptance-proves-runtime bullet",
  },
  {
    block:
      "- W1-C1 evidence supports the request-clearance ceiling on result marking " +
      "only; it does not prove\n  an authoritative source-marking floor.",
    message:
      "W1 contract gate boundaries must keep the exact bullet limiting W1-C1 " +
      "evidence to the request-clearance ceiling with no authoritative " +
      "source-marking floor",
  },
  {
    block:
      "- Even after both acceptances, adopting Bundle v0.1.1, superseding v0.1.0 " +
      "or\n  migrating any consumer each needs its own separate future Founder " +
      "decision; v0.1.0 bytes stay\n  unchanged.",
    message:
      "W1 contract gate boundaries must keep the exact v0.1.1 " +
      "adoption/supersession/consumer-migration bullet with v0.1.0 bytes unchanged",
  },
  {
    block:
      "Duyệt W1-C1/C2 Option A: C1-1..C1-10=yes; C2-1..C2-10=yes; chấp nhận hai " +
      "packet ở mức `ACCEPTED FOR IMPLEMENTATION v0.1.0`, chỉ tồn tại dưới dạng " +
      "local commit trên nhánh riêng; Bundle v0.1.1 chỉ là proposed successor " +
      "candidate, v0.1.0 vẫn authoritative, adoption/supersession/consumer " +
      "migration cần quyết định riêng sau; không push/merge/release, không mở " +
      "product/runtime, không install dependency, chạy DB/container, deploy " +
      "hoặc release.",
    message:
      "Vietnamese W1 contract gate approval shorthand must stay pinned byte-exact " +
      "with its no-push/merge/release and version-migration guards",
  },
];

function assertIncludes(text, pattern, message) {
  if (!pattern.test(text)) throw new Error(message);
}

function assertExcludes(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertPinnedBlock(text, block, message) {
  assertIncludes(text, new RegExp(`^${escapeRegExp(block)}$`, "m"), message);
}

// Current-status guards apply to the leading status block only — everything
// before the first `##` heading. Dated history sections deeper in a document
// must stay free to quote the superseded `NOT OPEN` / `PROPOSED` wording.
function currentStatusBlock(text) {
  const headingIndex = text.indexOf("\n## ");
  return headingIndex === -1 ? text : text.slice(0, headingIndex);
}

function assertExactIds(actualIds, expectedIds, label) {
  const seen = new Set(actualIds);
  const missing = expectedIds.filter((id) => !seen.has(id));
  const unexpected = [...seen].filter((id) => !expectedIds.includes(id));
  const duplicates = actualIds.length - seen.size;

  if (
    actualIds.length !== expectedIds.length ||
    missing.length ||
    unexpected.length ||
    duplicates
  ) {
    throw new Error(
      `${label} is not the exact 48-task set: count=${actualIds.length}, ` +
        `unique=${seen.size}, missing=${missing.join(",") || "none"}, ` +
        `unexpected=${unexpected.join(",") || "none"}, ` +
        `duplicates=${duplicates}`,
    );
  }
}

function parseBoardTasks(boardText) {
  const rowPattern = /^\| (W0-(?:IR|I|T|R|S|B|D)\d{2}) \|/gm;
  const taskIds = [...boardText.matchAll(rowPattern)].map((match) => match[1]);
  assertExactIds(taskIds, EXPECTED_TASKS, "W1 board");

  const categoryCounts = Object.fromEntries(
    Object.keys(CATEGORY_SIZES).map((category) => [category, 0]),
  );
  for (const taskId of taskIds) {
    const category = taskId.match(/^W0-(IR|I|T|R|S|B|D)\d{2}$/)?.[1];
    categoryCounts[category] += 1;
  }

  for (const [category, expected] of Object.entries(CATEGORY_SIZES)) {
    if (categoryCounts[category] !== expected) {
      throw new Error(
        `W1 board category ${category} count is ${categoryCounts[category]}, expected ${expected}`,
      );
    }
  }
  return { taskIds, categoryCounts };
}

function validateBoardGates(boardText) {
  assertIncludes(
    boardText,
    /\*\*Coordination decision:\*\* `W1 READ-AHEAD\/PACKET PREPARATION GO`/,
    "W1 read-ahead decision must remain GO",
  );
  assertIncludes(
    boardText,
    /\*\*Product-writer decision:\*\* `FAB-C0 BOUNDED HARDENING WRITER GO`; W1 runtime writers remain\s+`NO-GO`/,
    "W1 runtime writers must remain NO-GO",
  );
  assertIncludes(
    boardText,
    /\*\*Integration decision:\*\* `NO-GO FOR DELEGATED ROUTINE INTEGRATION`/,
    "Delegated routine integration must remain NO-GO",
  );
  assertIncludes(
    boardText,
    /\*\*W0 closure:\*\* `NO-GO`; `COMPLETE=0`/,
    "W0 closure must remain NO-GO with COMPLETE=0",
  );
  assertIncludes(
    boardText,
    /W0-T10 proves offline contract\/simulated-consumer conformance only and is not evidence of that\s+live walking skeleton\./,
    "Offline W0-T10 is not evidence of the live W1 walking skeleton and not a substitute",
  );
  assertIncludes(
    boardText,
    /Always label it `RB-001\(contract-forward-gap\)` and label the release blocker\s+`RB-001\(release-disclosure\)`; they are different concerns\./,
    "Both RB-001(contract-forward-gap) and RB-001(release-disclosure) labels are required",
  );
}

function validateRoadmapDates(roadmapText) {
  assertIncludes(
    roadmapText,
    /^\| W1 — Investigation spine \| 2026-08-01 → 2026-08-23 \|/m,
    "W1 formal dates must remain 2026-08-01 through 2026-08-23",
  );
  // Anchored on the roadmap's release-phase heading, which is present in the
  // committed `HEAD` bytes of the roadmap and in the working copy alike. The
  // earlier anchor was the `**Release target:**` summary bullet, which exists
  // only in the uncommitted working copy — pinning it made the guard pass on a
  // dirty tree and fail on the committed document it is supposed to protect.
  assertIncludes(
    roadmapText,
    /^### Release — 2026-12-21 → 2026-12-31$/m,
    "Fixed release window must remain 2026-12-21 through 2026-12-31",
  );
}

function parseGateDecisions(gateA4Text, prefix, count) {
  const ids = [...gateA4Text.matchAll(
    new RegExp(`^\\| (${prefix}\\d{1,2}) \\| \\*\\*Yes\\*\\*`, "gm"),
  )].map((match) => match[1]);
  const expected = Array.from(
    { length: count },
    (_, index) => `${prefix}${index + 1}`,
  );
  const seen = new Set(ids);
  const missing = expected.filter((id) => !seen.has(id));
  const unexpected = [...seen].filter((id) => !expected.includes(id));
  const duplicates = ids.length - seen.size;

  if (
    ids.length !== expected.length ||
    missing.length ||
    unexpected.length ||
    duplicates
  ) {
    throw new Error(
      `GATE A4 must contain exact ${prefix}1-${prefix}${count} Yes decisions: ` +
        `count=${ids.length}, missing=${missing.join(",") || "none"}, ` +
        `unexpected=${unexpected.join(",") || "none"}, duplicates=${duplicates}`,
    );
  }
  return ids.length;
}

function validateGateA4(gateA4Text) {
  for (const { block, message } of GATE_A4_PINNED_BLOCKS) {
    assertPinnedBlock(gateA4Text, block, message);
  }

  const statusBlock = currentStatusBlock(gateA4Text);
  assertIncludes(
    statusBlock,
    /GATE A4 is closed and both ADRs are `ACCEPTED`/,
    "GATE A4 current status block must state that GATE A4 is closed and both ADRs are `ACCEPTED`",
  );
  assertExcludes(
    statusBlock,
    /^[^\n]*GATE A4 (?:remains|stays|is still) `NOT OPEN`/m,
    "GATE A4 current status block must not reassert `NOT OPEN`; the gate was answered on " +
      `${GATE_A4_ACCEPTED_ON} and that record must not be reverted`,
  );
  assertExcludes(
    statusBlock,
    /^[^\n]*both ADRs (?:remain|stay) `PROPOSED — NOT DECIDED`/m,
    "GATE A4 current status block must not reassert that both ADRs remain " +
      "`PROPOSED — NOT DECIDED` after the recorded acceptance",
  );
  assertIncludes(
    gateA4Text,
    /\*\*Recommendation:\*\* Option A; H1–H11=yes and J1–J10=yes/,
    "GATE A4 must retain Option A with H1-H11 and J1-J10 yes",
  );
  const counts = {
    H: parseGateDecisions(gateA4Text, "H", 11),
    J: parseGateDecisions(gateA4Text, "J", 10),
  };
  assertIncludes(
    gateA4Text,
    /flip ADR-0003 and ADR-0005 to `ACCEPTED` through the two docs-only evidence-linked status-flip applications\. Implementation, dependency selection, spike, benchmark, DB\/container\/broker, staging, commit, merge, push, deployment and release each remain separately gated\./,
    "GATE A4 Option A must record the applied docs-only status flip while implementation, " +
      "dependency, spike, benchmark, DB/container/broker, Git, deployment and release each " +
      "remain separately gated",
  );
  for (const { label, path } of APPLIED_ADR_APPLICATIONS) {
    assertIncludes(
      gateA4Text,
      new RegExp(
        `^\\| ${escapeRegExp(label)} \\| \`${escapeRegExp(path)}\` \\| ` +
          "`APPLIED 2026-07-26` \\|$",
        "m",
      ),
      `GATE A4 must record ${path} as \`APPLIED 2026-07-26\``,
    );
  }
  assertIncludes(
    gateA4Text,
    /only policy-approved S0\/R0 metadata workers may be pooled, while S4 remains per-invocation disposable under accepted ADR-0004 F3/,
    "GATE A4 must permit only S0/R0 workers to be pooled and keep S4 disposable under ADR-0004 F3",
  );
  assertIncludes(
    gateA4Text,
    /H11 \| \*\*Yes\*\* — record the ADR-0002 dependency as resolved;/,
    "GATE A4 H11 must record the ADR-0002 dependency as resolved",
  );

  return counts;
}

function validateAcceptedAdr(adrText, adr) {
  assertPinnedBlock(
    adrText,
    ACCEPTED_ADR_STATUS_BLOCK,
    `${adr} status line must read \`ACCEPTED\` (GATE A4, 2026-07-26) and keep the exact ` +
      "decision only; no implementation, dependency or runtime authority clause",
  );
  assertExcludes(
    adrText,
    /^- Status: `PROPOSED/m,
    `${adr} must not revert to a \`PROPOSED\` status line after GATE A4 closed on ` +
      GATE_A4_ACCEPTED_ON,
  );
  assertIncludes(
    adrText,
    /^## Decision recorded at GATE A4 — 2026-07-26$/m,
    `${adr} must carry the recorded GATE A4 decision section dated ${GATE_A4_ACCEPTED_ON}`,
  );
  assertIncludes(
    adrText,
    /Founder-delegated current-thread authority/,
    `${adr} must name the Founder-delegated current-thread authority under which the decision ` +
      "was recorded",
  );
  return "ACCEPTED";
}

function validateAppliedApplication(applicationText, { adr }) {
  assertPinnedBlock(
    applicationText,
    "- **Status:** `APPLIED " +
      `${GATE_A4_ACCEPTED_ON} — ${adr} STATUS FLIP RECORDED — NO IMPLEMENTATION AUTHORITY\``,
    `${adr} application must record \`APPLIED ${GATE_A4_ACCEPTED_ON}\` with the status flip ` +
      "recorded and no implementation authority",
  );
  assertPinnedBlock(
    applicationText,
    "- **Resulting ADR status:** `ACCEPTED` (GATE A4, 2026-07-26) — decision only; no " +
      "implementation,\n  dependency, substrate, spike, benchmark, container, microVM, netns, " +
      "broker, Git, deployment or\n  release authority follows",
    `${adr} application must keep the resulting-status line pinned to decision only, with no ` +
      "implementation, dependency, substrate, spike, container, broker, Git, deployment or " +
      "release authority",
  );
  assertExcludes(
    applicationText,
    /^- \*\*Status:\*\* `APPLICATION READY ONLY/m,
    `${adr} application must not revert to \`APPLICATION READY ONLY\`; the flip is applied`,
  );
}

function validateAdr0005ApplicationS4Rule(applicationText) {
  assertIncludes(
    applicationText,
    /\*\*S4 remains per-invocation disposable under accepted ADR-0004 F3\.\*\* S4 is never pooled/,
    "ADR-0005 application must keep S4 per-invocation disposable and never pooled under accepted " +
      "ADR-0004 F3",
  );
  assertExcludes(
    applicationText,
    /S4 (?:may|can|is) (?:be )?pooled/,
    "ADR-0005 application must never permit pooled S4 under any reading",
  );
}

function validateW1ContractApplication(applicationText, application) {
  const { lane, commit, pathCount, statusBlock, resultingStatusBlock } =
    application;

  assertPinnedBlock(
    applicationText,
    statusBlock,
    `${lane} application must record \`APPLIED ${ACCEPTED_ON}\` with the contract acceptance ` +
      "recorded, local commit only and no push, merge or release authority",
  );
  assertExcludes(
    applicationText,
    /^- \*\*Status:\*\* `APPLICATION READY ONLY/m,
    `${lane} application must not revert to \`APPLICATION READY ONLY\`; the acceptance is applied`,
  );
  assertPinnedBlock(
    applicationText,
    resultingStatusBlock,
    `${lane} application resulting contract status must stay \`ACCEPTED FOR IMPLEMENTATION ` +
      "v0.1.0\` — not stable v1/GA, contract-first basis only, with no runtime, dependency, " +
      "database, container, endpoint, transport, CI-wiring, push, merge, deployment or release " +
      "authority",
  );
  assertIncludes(
    applicationText,
    new RegExp(`^\\| Accepted local commit \\| \`${commit}\` \\|$`, "m"),
    `${lane} application must pin the accepted local commit \`${commit}\``,
  );
  assertIncludes(
    applicationText,
    new RegExp(`^\\| Parent commit \\| \`${W1_CANDIDATE_PARENT}\` \\|$`, "m"),
    `${lane} application must pin the parent commit \`${W1_CANDIDATE_PARENT}\``,
  );
  assertIncludes(
    applicationText,
    new RegExp(`^\\| Accepted paths \\| exactly ${pathCount},`, "m"),
    `${lane} application must pin exactly ${pathCount} accepted paths`,
  );
  assertIncludes(
    applicationText,
    /^\| Pushed \/ merged \/ released \| no \/ no \/ no \|$/m,
    `${lane} application must record pushed / merged / released as no / no / no`,
  );

  return {
    commit,
    parent: W1_CANDIDATE_PARENT,
    pathCount,
    digest: lane === "W1-C1" ? W1_C1_DIGEST : W1_C2_DIGEST,
  };
}

function validateW1C2ApplicationRider(applicationText) {
  assertIncludes(
    applicationText,
    /^## 9\. Rider — W0-R01 Option B \(Fable independent review\)$/m,
    "W1-C2 application must keep the W0-R01 Option B rider section",
  );
  assertIncludes(
    applicationText,
    /the finding is disclosed as a \*\*LOW advisory\*\* and changed \*\*no accepted\ncontract byte\*\*/,
    "W1-C2 application rider must keep the finding disclosed as a LOW advisory that changed no " +
      "accepted contract byte",
  );
  assertIncludes(
    applicationText,
    /\*\*Adopting v0\.1\.1,\nsuperseding v0\.1\.0 and migrating any consumer each require their own separate future Founder\ndecision\.\*\*/,
    "W1-C2 application must keep v0.1.1 adoption, v0.1.0 supersession and consumer migration as " +
      "three separate future Founder decisions",
  );
}

function parseContractGateDecisions(contractGateText, prefix) {
  const ids = [...contractGateText.matchAll(
    new RegExp(`^\\| (${prefix}-\\d{1,2}) \\| \\*\\*Yes\\*\\*`, "gm"),
  )].map((match) => match[1]);
  const expected = Array.from(
    { length: 10 },
    (_, index) => `${prefix}-${index + 1}`,
  );
  const seen = new Set(ids);
  const missing = expected.filter((id) => !seen.has(id));
  const unexpected = [...seen].filter((id) => !expected.includes(id));
  const duplicates = ids.length - seen.size;
  if (
    ids.length !== expected.length ||
    missing.length ||
    unexpected.length ||
    duplicates
  ) {
    throw new Error(
      `W1 contract gate must contain exact ${prefix}-1-${prefix}-10 decisions: ` +
        `count=${ids.length}, missing=${missing.join(",") || "none"}, ` +
        `unexpected=${unexpected.join(",") || "none"}, duplicates=${duplicates}`,
    );
  }
  return ids.length;
}

function assertContractGateLane(contractGateText, lane, expected) {
  const anchor = CONTRACT_GATE_ROW_ANCHORS[lane];
  const rowIncludes = (fragment, message) =>
    assertIncludes(
      contractGateText,
      new RegExp(`^${anchor}[^\\n]*${fragment}`, "m"),
      message,
    );

  rowIncludes(
    `\`${expected.commit}\``,
    `${lane} §1 row must pin the accepted local commit \`${expected.commit}\``,
  );
  rowIncludes(
    `parent \`${W1_CANDIDATE_PARENT}\``,
    `${lane} §1 row must pin the shared parent commit \`${W1_CANDIDATE_PARENT}\``,
  );
  rowIncludes(
    `exactly ${expected.pathCount} paths`,
    `${lane} §1 row must record exactly ${expected.pathCount} paths`,
  );
  rowIncludes(
    "standalone validator `PASS`",
    `${lane} §1 row must record the standalone validator \`PASS\` result`,
  );
  rowIncludes(
    `${expected.testCount} tests`,
    `${lane} §1 row must record the ${expected.testCount} test count re-run on the committed bytes`,
  );
  rowIncludes(
    `${expected.coverage} branch coverage`,
    `${lane} §1 row must record ${expected.coverage} branch coverage`,
  );
  rowIncludes(
    `${expected.digestLabel} \`${expected.digestPrefix}${expected.digest}\``,
    `${lane} §1 row must pin the final ${expected.digestNoun} digest re-verified from the ` +
      "committed bytes of the accepted commit",
  );
  rowIncludes(
    `final independent review ${expected.review} \`PASS\`, no open ${expected.severities}`,
    `${lane} §1 row must record the cross-lane final independent review ${expected.review} \`PASS\``,
  );
  rowIncludes(
    `\`${ACCEPTED_CONTRACT_LIFECYCLE}\``,
    `${lane} §1 row must record the accepted lifecycle \`${ACCEPTED_CONTRACT_LIFECYCLE}\``,
  );
}

const CONTRACT_GATE_LANES = {
  "W1-C1": {
    commit: W1_C1_COMMIT,
    pathCount: W1_C1_PATH_COUNT,
    testCount: "21/21",
    coverage: "87.27%",
    digest: W1_C1_DIGEST,
    digestPrefix: "sha256:",
    digestLabel: "member-set digest",
    digestNoun: "member-set",
    review: "W0-R05",
    severities: "P0–P2",
  },
  "W1-C2": {
    commit: W1_C2_COMMIT,
    pathCount: W1_C2_PATH_COUNT,
    testCount: "31/31",
    coverage: "97.44%",
    digest: W1_C2_DIGEST,
    digestPrefix: "",
    digestLabel: "aggregate SHA-256",
    digestNoun: "aggregate",
    review: "W0-T01",
    severities: "P0–P3",
  },
};

function validateContractGate(contractGateText) {
  assertPinnedBlock(
    contractGateText,
    "- **Status:** `ACCEPTED — W1-C1/C2 CONTRACT GATE CLOSED 2026-07-26 — " +
      "LOCAL COMMITS ONLY — NOT PUSHED`",
    "W1 contract gate must record `ACCEPTED — W1-C1/C2 CONTRACT GATE CLOSED 2026-07-26` with " +
      "local commits only and nothing pushed",
  );
  assertIncludes(
    contractGateText,
    /\*\*Recommendation:\*\* Option A; C1-1–C1-10=yes and C2-1–C2-10=yes/,
    "W1 contract gate must retain Option A with C1-1..10 and C2-1..10 yes",
  );
  assertPinnedBlock(
    contractGateText,
    "- **Decision:** Option A **accepted 2026-07-26** under Founder-delegated current-thread " +
      "authority;\n  `C1-1..C1-10=yes` and `C2-1..C2-10=yes`; both packets are `ACCEPTED FOR " +
      "IMPLEMENTATION v0.1.0`\n  and exist as local commits only",
    "W1 contract gate decision line must stay pinned: Option A accepted 2026-07-26 under " +
      "Founder-delegated current-thread authority, both packets accepted at v0.1.0 as local " +
      "commits only",
  );
  const counts = {
    C1: parseContractGateDecisions(contractGateText, "C1"),
    C2: parseContractGateDecisions(contractGateText, "C2"),
  };
  assertNoStalePins(contractGateText, CONTRACT_GATE_ROW_ANCHORS, "W1 contract gate §1");
  for (const [lane, expected] of Object.entries(CONTRACT_GATE_LANES)) {
    assertContractGateLane(contractGateText, lane, expected);
  }
  assertPinnedBlock(
    contractGateText,
    W1_C1_CANDIDATE_ROW,
    "W1-C1 exact accepted-evidence row with its pinned commit and member-set digest is " +
      "missing, altered or swapped",
  );
  assertPinnedBlock(
    contractGateText,
    W1_C2_CANDIDATE_ROW,
    "W1-C2 exact accepted-evidence row with its pinned commit and aggregate digest is " +
      "missing, altered or swapped",
  );
  for (const applicationPath of W1_APPLICATION_PATHS) {
    assertIncludes(
      contractGateText,
      new RegExp(
        `^\\| [^|\\n]+ \\| \`${escapeRegExp(applicationPath)}\` \\| ` +
          "`APPLIED 2026-07-26` \\|$",
        "m",
      ),
      `W1 contract gate must record ${applicationPath} as \`APPLIED 2026-07-26\``,
    );
  }
  assertIncludes(
    contractGateText,
    /\*\*CI: NOT WIRED\*\*/,
    "W1 contract gate must keep the **CI: NOT WIRED** disclosure; no CI result is claimed",
  );
  assertIncludes(
    contractGateText,
    /`W0 COMPLETE=0` and W0 closure `NO-GO`\. W1 runtime writers remain\s+`HOLD`\/`NO-GO`\./,
    "W1 contract gate must keep W0 COMPLETE=0, W0 closure NO-GO and W1 runtime " +
      "writers HOLD/NO-GO",
  );
  assertPinnedBlock(
    contractGateText,
    "- Nothing was pushed, merged or released. The two accepted packets exist only as local\n" +
      "  commits on their own branches; publication, merge to `main`, release and release-date\n" +
      "  authority each remain separate Founder decisions.",
    "W1 contract gate boundaries must keep the exact bullet recording that nothing was pushed, " +
      "merged or released and that publication, merge, release and release-date authority each " +
      "remain separate Founder decisions",
  );
  assertPinnedBlock(
    contractGateText,
    "- Contract acceptance opened no product or runtime writer. SOC, Cyber AI and Fabric W1\n" +
      "  writers remain `HOLD` until their own exact repo/base/path/test/reviewer authority.",
    "W1 contract gate boundaries must keep the exact bullet recording that contract acceptance " +
      "opened no product or runtime writer",
  );
  assertIncludes(
    contractGateText,
    /W0–W6 dates and the 2026-12-21 → 2026-12-31 release window remain\s+unchanged\./,
    "W1 contract gate must retain the fixed release window",
  );
  assertIncludes(
    contractGateText,
    /\*\*Rider — W0-R01 Option B \(Fable independent review\)\.\*\*/,
    "W1 contract gate must keep the W0-R01 Option B rider disclosure",
  );
  assertIncludes(
    contractGateText,
    /disclosed as a \*\*LOW advisory\*\* and changed \*\*no accepted contract byte\*\*/,
    "W1 contract gate rider must keep the finding disclosed as a LOW advisory that changed no " +
      "accepted contract byte",
  );
  assertIncludes(
    contractGateText,
    /Bundle v0\.1\.1 is only a proposed successor candidate/,
    "W1 contract gate must state Bundle v0.1.1 is only a proposed successor candidate",
  );
  assertIncludes(
    contractGateText,
    /v0\.1\.0 remains the authoritative Bundle contract/,
    "W1 contract gate must keep Bundle v0.1.0 as the authoritative contract",
  );
  assertIncludes(
    contractGateText,
    /adoption, supersession and consumer migration require separate future authority/,
    "W1 contract gate must keep v0.1.1 adoption, supersession and consumer migration " +
      "behind separate future authority",
  );
  assertExcludes(
    contractGateText,
    /^\| C1-7 \|[^\n]*downgrad/im,
    "W1 contract gate C1-7 must not reassert the unsupported authoritative " +
      "source-marking floor; packet evidence supports only the request-clearance ceiling",
  );
  assertIncludes(
    contractGateText,
    /^\| C1-7 \| \*\*Yes\*\* — result marking never exceeds request clearance/m,
    "W1 contract gate C1-7 must retain the request-clearance ceiling on result marking",
  );
  assertPinnedBlock(
    contractGateText,
    "**Application reconciliation — closed 2026-07-26.**",
    "W1 contract gate §9 must record the application reconciliation as closed 2026-07-26; the " +
      "two W1 acceptance applications no longer describe the pinned-row correction as open",
  );
  assertExcludes(
    contractGateText,
    /\*\*Residual gate — application reconciliation wording/,
    "W1 contract gate must not carry the stale P3 residual-gate wording for application " +
      "reconciliation; both applications record the correction as closed",
  );
  assertExcludes(
    contractGateText,
    /their wording is not updated here/,
    "W1 contract gate must not claim the two W1 acceptance applications' reconciliation wording " +
      "is not updated; it was reconciled on 2026-07-26",
  );
  assertPinnedBlock(
    contractGateText,
    "- GATE A4 closed 2026-07-26 with ADR-0003 and ADR-0005 `ACCEPTED` as decisions only; that\n" +
      "  acceptance grants no contract acceptance and no product, runtime or release authority, " +
      "and\n  changes nothing in this gate.",
    "W1 contract gate boundaries must record GATE A4 as closed with ADR-0003/ADR-0005 `ACCEPTED` " +
      "as decisions only, granting no contract acceptance and no product, runtime or release " +
      "authority",
  );
  for (const { block, message } of CONTRACT_GATE_PINNED_BLOCKS) {
    assertPinnedBlock(contractGateText, block, message);
  }
  return counts;
}

function validateE2Register(e2RegisterText) {
  assertNoStalePins(e2RegisterText, E2_REGISTER_ROW_ANCHORS, "E2 register §1");
  assertIncludes(
    e2RegisterText,
    /^\| GATE A4 \|[^\n]*`ACCEPTED — GATE A4 CLOSED 2026-07-26`; ADR-0003 and ADR-0005 are `ACCEPTED` \(decision only; no implementation authority\)/m,
    "E2 register GATE A4 row must record `ACCEPTED — GATE A4 CLOSED 2026-07-26` with ADR-0003 " +
      "and ADR-0005 `ACCEPTED` at decision-only scope",
  );
  for (const { path } of APPLIED_ADR_APPLICATIONS) {
    assertIncludes(
      e2RegisterText,
      new RegExp(
        `^\\| [^|\\n]+ \\| \`${escapeRegExp(path)}\` \\| \`APPLIED 2026-07-26\` \\|$`,
        "m",
      ),
      `E2 register must record ${path} as \`APPLIED 2026-07-26\``,
    );
  }
  for (const [lane, expected] of Object.entries(CONTRACT_GATE_LANES)) {
    const anchor = E2_REGISTER_ROW_ANCHORS[lane];
    assertIncludes(
      e2RegisterText,
      new RegExp(`^${anchor}`, "m"),
      `E2 register ${lane} row must record the accepted lifecycle ` +
        `\`${ACCEPTED_CONTRACT_LIFECYCLE}\``,
    );
    assertIncludes(
      e2RegisterText,
      new RegExp(`^\\| [^|\\n]*${lane}[^\\n]*\`${expected.commit}\``, "m"),
      `E2 register ${lane} row must pin the accepted local commit \`${expected.commit}\``,
    );
    assertIncludes(
      e2RegisterText,
      new RegExp(
        `^${anchor}; exact ${expected.pathCount} paths[^\\n]*` +
          `${expected.digestLabel} \`${expected.digestPrefix}${expected.digest}\``,
        "m",
      ),
      `E2 register ${lane} row must record the exact ${expected.pathCount}-path evidence and ` +
        `the final ${expected.digestNoun} digest`,
    );
    assertIncludes(
      e2RegisterText,
      new RegExp(
        `^${anchor}[^\\n]*final independent review ${expected.review} \`PASS\`, ` +
          `no open ${expected.severities}`,
        "m",
      ),
      `E2 register ${lane} row must record the cross-lane final review ${expected.review} \`PASS\``,
    );
  }
  assertIncludes(
    e2RegisterText,
    /W0-I11[\s\S]*`EVIDENCE READY — UNCOMMITTED`; exact two dirty paths/,
    "E2 register FAB-C0 must remain uncommitted evidence only",
  );
  assertIncludes(
    e2RegisterText,
    /\*\*Rider — W0-R01 Option B \(Fable independent review\)\.\*\*/,
    "E2 register must keep the W0-R01 Option B rider disclosure",
  );
  assertIncludes(
    e2RegisterText,
    /^- \*\*CI: NOT WIRED\*\* for all four applications and both accepted contract lanes\./m,
    "E2 register must keep the CI: NOT WIRED disclosure for all four " +
      "applications and both accepted contract lanes",
  );
  assertIncludes(
    e2RegisterText,
    /\*\*static\/documentary only\*\*/,
    "E2 register must keep the static/documentary only evidence disclosure",
  );
  for (const applicationPath of W1_APPLICATION_PATHS) {
    assertIncludes(
      e2RegisterText,
      new RegExp(
        `^\\| [^|\\n]+ \\| \`${escapeRegExp(applicationPath)}\` \\| ` +
          "`APPLIED 2026-07-26` \\|$",
        "m",
      ),
      `E2 register must record ${applicationPath} as \`APPLIED 2026-07-26\``,
    );
  }
}

function validateBoardGateA4Record(boardText) {
  assertIncludes(
    boardText,
    /^\| GATE A4 — ADR-0003\/ADR-0005 evidence and decision packet \| `ACCEPTED — CLOSED 2026-07-26` \|/m,
    "W1 board §1 GATE A4 disposition must read `ACCEPTED — CLOSED 2026-07-26`",
  );
  assertIncludes(
    boardText,
    /^\| W1-C1 — alert-context capability-specific contract proposal \| `ACCEPTED — CLOSED 2026-07-26` \|/m,
    "W1 board §1 W1-C1 gate disposition must read `ACCEPTED — CLOSED 2026-07-26`",
  );
  assertIncludes(
    boardText,
    /^\| W1-C2 — investigation lifecycle\/create\/status\/cancel\/bundle-read contract proposal \| `ACCEPTED — CLOSED 2026-07-26` \|/m,
    "W1 board §1 W1-C2 gate disposition must read `ACCEPTED — CLOSED 2026-07-26`",
  );
  assertIncludes(
    boardText,
    /^#### 14\.6\.1 Exact write allowlist — twelve paths$/m,
    "W1 board §14.6 must record the exact twelve-path allowlist for the GATE A4 status-flip record",
  );
  assertPinnedBlock(
    boardText,
    "- No implementation, dependency, spike, benchmark, database, container, microVM, netns or\n" +
      "  broker authority follows from this record, and nothing was staged, committed, merged, " +
      "pushed,\n  deployed or released.",
    "W1 board §14.6 must keep the exact bullet denying implementation, dependency, spike, " +
      "DB/container/broker and Git/deployment/release authority",
  );
  assertIncludes(
    boardText,
    /^#### 14\.7\.1 Exact write allowlist — nineteen paths$/m,
    "W1 board §14.7 must record the exact nineteen-path allowlist for the contract-acceptance " +
      "reconciliation",
  );
  assertPinnedBlock(
    boardText,
    "- Nothing was staged, committed, merged, pushed, deployed or released by this " +
      "reconciliation,\n  and no dependency was installed and no database, container or network " +
      "was reached.",
    "W1 board §14.7 must keep the exact bullet recording that nothing was staged, committed, " +
      "merged, pushed, deployed or released by the reconciliation",
  );
  const allowlistRows = [
    ...boardText.matchAll(
      /^#### 14\.6\.1 Exact write allowlist — twelve paths\n[\s\S]*?\n\n/gm,
    ),
  ];
  const allowlistBlock = allowlistRows[0]?.[0] ?? "";
  const pathCount = [...allowlistBlock.matchAll(/^\| \d{1,2} \| `[^`]+` \|/gm)].length;
  if (pathCount !== 12) {
    throw new Error(
      `W1 board §14.6 twelve-path allowlist table lists ${pathCount} paths, expected 12`,
    );
  }
  return pathCount;
}

function validateBoardFinalEvidence(boardText) {
  assertNoStalePins(boardText, BOARD_ROW_ANCHORS, "W1 board §14.7.2");
  assertIncludes(
    boardText,
    new RegExp(`^${BOARD_ROW_ANCHORS["W1-C1"]}[^\\n]*\`${W1_C1_COMMIT}\``, "m"),
    "W1 board W1-C1 accepted-evidence row must pin the accepted local commit",
  );
  assertIncludes(
    boardText,
    new RegExp(`^${BOARD_ROW_ANCHORS["W1-C2"]}[^\\n]*\`${W1_C2_COMMIT}\``, "m"),
    "W1 board W1-C2 accepted-evidence row must pin the accepted local commit",
  );
  assertIncludes(
    boardText,
    new RegExp(`^${BOARD_ROW_ANCHORS["W1-C1"]}[^\\n]*\`${W1_C1_DIGEST}\``, "m"),
    "W1 board W1-C1 final-evidence row must pin the final member-set digest",
  );
  assertIncludes(
    boardText,
    new RegExp(`^${BOARD_ROW_ANCHORS["W1-C2"]}[^\\n]*\`${W1_C2_DIGEST}\``, "m"),
    "W1 board W1-C2 final-evidence row must pin the final aggregate digest",
  );
  assertIncludes(
    boardText,
    /^- \*\*CI: NOT WIRED\*\*; all evidence is static\/documentary only and no CI result is claimed\.$/m,
    "W1 board §14.3 must keep the CI: NOT WIRED and static/documentary only " +
      "disclosure",
  );
  assertIncludes(
    boardText,
    /^- `W0 COMPLETE=0`; W0 closure `NO-GO`\.$/m,
    "W1 board §14.3 must keep W0 COMPLETE=0 and W0 closure NO-GO",
  );
  assertIncludes(
    boardText,
    /^- W1 product implementation and W1 integration\/live shadow remain `HOLD`/m,
    "W1 board §14.3 must keep W1 product implementation and integration/live " +
      "shadow at HOLD",
  );
}

function validateSprint(sprintText) {
  assertIncludes(
    sprintText,
    /\*\*GATE A4 CLOSED 2026-07-26\*\*/,
    "ADR sprint must record GATE A4 CLOSED 2026-07-26",
  );
  assertIncludes(
    sprintText,
    /ADR-0003 and ADR-0005 are `ACCEPTED` \(decision only; no implementation authority\)/,
    "ADR sprint must record ADR-0003 and ADR-0005 as `ACCEPTED` with decision-only scope",
  );
  assertIncludes(
    sprintText,
    /\*\*W1-C1\/C2 CONTRACT GATE CLOSED 2026-07-26\*\*/,
    "ADR sprint must record W1-C1/C2 CONTRACT GATE CLOSED 2026-07-26",
  );
  assertExcludes(
    currentStatusBlock(sprintText),
    /ADR-0003\/ADR-0005 remain `PROPOSED/,
    "ADR sprint progress block must not keep ADR-0003/ADR-0005 at `PROPOSED` after GATE A4 " +
      "closed on " + GATE_A4_ACCEPTED_ON,
  );
  assertIncludes(
    sprintText,
    /GATE A4 — \*\*CLOSED 2026-07-26\*\*: Option A accepted under Founder-delegated current-thread authority; both ADRs `ACCEPTED` \(decision only\)/,
    "ADR sprint §3 wave board must record the GATE A4 closure row with decision-only scope",
  );
}

function validateAdrCatalog(adrReadmeText) {
  const catalogRows = [
    {
      adr: "ADR-0003",
      row:
        "| [ADR-0003](ADR-0003-durable-agent-orchestration.md) | Durable agent orchestration | " +
        "`ACCEPTED` (GATE A4, 2026-07-26) — decision only |",
    },
    {
      adr: "ADR-0005",
      row:
        "| [ADR-0005](ADR-0005-sandbox-substrate.md) | Sandbox substrate | `ACCEPTED` " +
        "(GATE A4, 2026-07-26) — decision only |",
    },
  ];
  for (const { adr, row } of catalogRows) {
    assertPinnedBlock(
      adrReadmeText,
      row,
      `ADR catalog row for ${adr} must read \`ACCEPTED\` (GATE A4, 2026-07-26) — decision only`,
    );
  }
  assertExcludes(
    currentStatusBlock(adrReadmeText),
    /ADR-0003\/ADR-0005 remain\s+`PROPOSED/,
    "ADR catalog header must not keep ADR-0003/ADR-0005 at `PROPOSED` after GATE A4 closed",
  );
  assertIncludes(
    adrReadmeText,
    new RegExp(
      escapeRegExp(
        "`docs/README.md`, the root `README.md` and `docs/operations/README.md` were reconciled " +
          "to this\ncatalog on 2026-07-26 under the nine-path documentation authority recorded in\n" +
          "`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.8.",
      ),
    ),
    "ADR catalog must record the index reconciliation applied on 2026-07-26 under the nine-path " +
      "documentation authority",
  );
  assertIncludes(
    adrReadmeText,
    /\*\*This catalog is\nauthoritative on ADR status\.\*\*/,
    "ADR catalog must keep the statement that it is authoritative on ADR status",
  );
}

// ── Dual-state fail-closed rules ───────────────────────────────────────────

const BOARD_DUAL_STATE_HEADING =
  "#### 14.32.2 Dual state — one accepted baseline, one disjoint candidate";
const BOARD_STALE_LOCK_HEADING =
  "#### 14.32.3 Downstream alert-context transport — provenance-stale lock";
const REGISTER_CANDIDATE_NOTE_HEADING =
  "### 4.4 Pending W1-C1 correction candidate — not a superseding value";
const PACKET_DUAL_STATE_HEADING =
  "### 2.9 Dual-state W1-C1 provenance — the accepted baseline, and the correction committed on it";

const REGISTER_CANDIDATE_NOTE_BLOCK =
  `\`sha256:${W1_C1_CANDIDATE_MEMBER_SET}\` is **not** a replacement for the ` +
  "accepted\n`sha256:" +
  `${W1_C1_DIGEST}\` pinned in §1 and §4. It is a **pending\ncandidate ` +
  "value**, not a superseding value: it belongs to a correction that is " +
  "committed local-only\nat `20cfa36`, accepted by no contract gate and " +
  "integrated nowhere, and the accepted W1-C1 row\nabove is byte-unchanged.";

// Measured read-only over `contracts/examples/alert-context-transport/` at
// `a976a20` — byte-identical to `4d5fb4b` apart from manifest metadata. The
// withdrawn "all 14 transport fixtures" claim counted the examples manifest
// itself as a fourteenth fixture and asserted the flag on two fixtures that
// omit it; the conclusion (provenance-stale, not semantically broken) survives
// because no fixture sets `include_descendants` to `true`.
const TRANSPORT_FIXTURE_COUNT = 13;
const TRANSPORT_FIXTURES_CARRYING_FLAG = 11;
const TRANSPORT_FLAG_OCCURRENCES = 17;

const BOARD_STALE_LOCK_BLOCK =
  "- `source_member_set_digest` recorded on `4d5fb4b` and on `a976a20` is " +
  `still\n  \`${W1_C1_DIGEST}\`. Combined with the\n  corrected W1-C1 bytes ` +
  "the transport validator **fails closed** — the lock is real.\n" +
  `- The transport examples manifest declares **${TRANSPORT_FIXTURE_COUNT}** ` +
  `fixtures; **${TRANSPORT_FIXTURES_CARRYING_FLAG}** of them carry\n  ` +
  `\`include_descendants\` across **${TRANSPORT_FLAG_OCCURRENCES}** ` +
  "occurrences, every one `false`. The `approval-required` and\n  " +
  "`kill-switch-denied` fixtures omit the field and **no fixture sets it " +
  "`true`**, so the stale pin\n  is **provenance-stale, not semantically " +
  "broken**.\n" +
  "- **W0-B05 is a distinct lane** — W2I AI inference transport at base " +
  "`55e94c2`. It may proceed\n  **docs/contracts-only, path-disjoint and " +
  "non-integrating**, and it **may not repin W1-C1**.";

const PACKET_TRANSPORT_LOCK_BLOCK =
  `The transport examples manifest declares **${TRANSPORT_FIXTURE_COUNT}** ` +
  `fixtures; **${TRANSPORT_FIXTURES_CARRYING_FLAG}** of them carry\n` +
  `\`include_descendants\` across **${TRANSPORT_FLAG_OCCURRENCES}** ` +
  "occurrences, every one `false`. The `approval-required` and\n" +
  "`kill-switch-denied` fixtures omit the field and **no fixture sets it " +
  "`true`** — so the pin is\n**provenance-stale, not semantically broken**.";

// Any surviving "N transport fixtures" claim must agree with the measurement.
// This is a corpus-level count rule rather than a single pinned string so a
// paraphrase of the withdrawn figure cannot slip past the byte-exact pins.
const TRANSPORT_FIXTURE_CLAIM = /(?:\*\*)?(\d+)(?:\*\*)? transport fixtures/g;

function assertTransportFixtureCount(text, label) {
  for (const [, claimed] of text.matchAll(TRANSPORT_FIXTURE_CLAIM)) {
    if (Number(claimed) !== TRANSPORT_FIXTURE_COUNT) {
      throw new Error(
        `${label} claims ${claimed} transport fixtures; the alert-context ` +
          `transport examples manifest declares ${TRANSPORT_FIXTURE_COUNT}, of ` +
          `which ${TRANSPORT_FIXTURES_CARRYING_FLAG} carry ` +
          `\`include_descendants\` across ${TRANSPORT_FLAG_OCCURRENCES} ` +
          "occurrences, all `false`, and none sets it `true`",
      );
    }
  }
}

// LINE 2 extended twice this lane: the W1-C1 correction landed as `20cfa36`
// and the W1-G1 correction as `7185739`. The chain stays totally ordered and
// every identity in it is named in abbreviated form, because this block is
// republished inside the guarded §2.9 region.
const PACKET_LINE2_DOCUMENTED_CHAIN = [
  "3a2c715",
  "4d5fb4b",
  "a976a20",
  "20cfa36",
  "7185739",
];

const PACKET_COMMIT_GRAPH_BLOCK =
  "The commit graph is **extended, not rewritten**: LINE 2 remains totally " +
  "ordered\n`3a2c715` → `4d5fb4b` → `a976a20` → `20cfa36` → `7185739`. The " +
  "W1-C1 correction is the node\n`20cfa36` and the W1-G1 correction the node " +
  "`7185739`; both are **local-only and integrated\nnowhere**, and neither is " +
  "accepted by any contract gate.";

const PACKET_AGGREGATE_BLOCK =
  `\`${W1_C1_CANDIDATE_WORKING_TREE_AGGREGATE}\` is the **pre-commit\n` +
  "working-tree aggregate** measured on 2026-07-27 and nothing else. It is " +
  "**not** a member-set\ndigest, **not** a commit identity, and **not** part " +
  "of the accepted C1 artifact recipe. The\ncoordinator reproduced it as " +
  "SHA-256 over, for each of the 16 modified tracked paths in sorted\n" +
  "relative-path order, the relative path bytes, a NUL byte, the file bytes, " +
  "and a NUL byte. Those\nsame 16 paths are now the content of commit " +
  "`20cfa36`, so the figure is dated pre-commit\nevidence that is reproducible " +
  "from that commit rather than a superseded one.";

const PACKET_CANDIDATE_NO_GO_BLOCKS = [
  {
    block:
      "14. **NO-GO** on publishing, pushing or citing `a976a20` as the current " +
      "corrected W1-C1\n    bytes. The corrected bytes are the content of " +
      "`20cfa36`, which is local-only and\n    integrated nowhere; `a976a20` is " +
      "its parent, carries the pre-correction bytes and a\n" +
      "    `source_member_set_digest` of `e4cfbf8c…`.",
    message:
      "blocker-4 packet §8 must keep NO-GO 14 — no publishing, pushing or citing " +
      "`a976a20` as the current corrected W1-C1 bytes",
  },
  {
    block:
      "15. **NO-GO** on treating the W0-I01C correction as accepted, " +
      "integrated, pushed, merged or\n    release-bearing. It is committed " +
      "local-only at `20cfa36` with `member_set`\n    `sha256:27a6bdeb…` over " +
      "exactly 16 paths; its lifecycle is `CORRECTION COMMITTED — LOCAL-ONLY\n" +
      "    — NOT INTEGRATED — NOT ACCEPTED`, and the accepted baseline " +
      "`3a2c715…` / `sha256:e4cfbf8c…`\n    is unchanged and remains the only " +
      "accepted W1-C1 artifact. **Being committed is not being\n    accepted.**",
    message:
      "blocker-4 packet §8 must keep NO-GO 15 — no treating the W0-I01C " +
      "correction as accepted, integrated, pushed, merged or release-bearing",
  },
];

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function extractSection(text, heading, label) {
  const index = text.indexOf(heading);
  if (index === -1) {
    throw new Error(`${label} is missing its \`${heading}\` section heading`);
  }
  const rest = text.slice(index + heading.length);
  const end = rest.search(/\n#{2,4} /);
  return heading + (end === -1 ? rest : rest.slice(0, end));
}

// ── Suite LINE 1 publication rows — §2.8 measures, §7.1 must republish ─────
//
// §7.1 proposes publishing the control corpus at the tip §2.8 measured. A
// refresh that updates only one of the two leaves the packet proposing a push
// of dated history while claiming a live re-measurement; that is the P2-2
// defect this rule fails closed on.

// ── Design C: an immutable base, an offset, and a derived prediction ──────
//
// A commit cannot contain its own SHA, tree or content aggregate, so this lane
// records no self identity at all. `PACKET_CONTROL_BASE` is the *base/parent*
// of the Lane 5 record — not a claim about any current tip — and keeps the same
// value the former `PACKET_CONTROL_HEAD` constant carried. The live count after
// this record is committed is **derived** from the base measurement plus this
// lane's own offset; it is never written as a literal, so the two can never
// drift apart, and it is a prediction that must be re-measured externally.
const PACKET_CONTROL_BASE = "8fe4cb02e0119224205a86631db7c481f7638c23";
const PACKET_CONTROL_BASE_ABBREV = "8fe4cb0";
const PACKET_LINE1_BASE_NEW_COMMITS = 25;
const PACKET_LANE_COMMITS_AHEAD_OF_BASE = 1;
const PACKET_LINE1_PREDICTED_NEW_COMMITS =
  PACKET_LINE1_BASE_NEW_COMMITS + PACKET_LANE_COMMITS_AHEAD_OF_BASE;
const PACKET_LINE1_BRANCH = "codex/w1-d04-founder-gate-repair-r1";
const PACKET_PUSH_DELTA_HEADING =
  "### 2.8 What a push would actually add — new objects, not total ahead-counts";
const PACKET_CANDIDATE_REFS_HEADING = "### 7.1 Candidate refs, per repository";

const PACKET_PUSH_DELTA_ROW_PATTERN =
  /^\| Suite LINE 1 \| `([0-9a-f]{7,40})` \| \d+ \| \*\*(\d+)\*\* \|/m;

function validatePacketLine1Publication(packetText) {
  const deltaSection = extractSection(
    packetText,
    PACKET_PUSH_DELTA_HEADING,
    "The blocker-4 packet §2.8 push-delta section",
  );
  const deltaRow = deltaSection.match(PACKET_PUSH_DELTA_ROW_PATTERN);
  if (!deltaRow) {
    throw new Error(
      "blocker-4 packet §2.8 must carry a `Suite LINE 1` push-delta row naming " +
        "the live control tip and its bolded count of commits not on any " +
        "remote-tracking ref",
    );
  }
  const [, measuredTip, measuredCount] = deltaRow;

  const refsSection = extractSection(
    packetText,
    PACKET_CANDIDATE_REFS_HEADING,
    "The blocker-4 packet §7.1 candidate-ref section",
  );
  const refsRow = refsSection.match(
    new RegExp(
      `^\\| \\d+ \\| Suite \\| LINE 1 \`${escapeRegExp(PACKET_LINE1_BRANCH)}\` ` +
        "\\| `([0-9a-f]{7,40})` \\| (\\d+) \\|",
      "m",
    ),
  );
  if (!refsRow) {
    throw new Error(
      "blocker-4 packet §7.1 must carry a Suite LINE 1 candidate-ref row for " +
        `\`${PACKET_LINE1_BRANCH}\` naming its tip and new-commit count`,
    );
  }
  const [, proposedTip, proposedCount] = refsRow;

  // §2.8 is the measured source of truth and is pinned to the immutable base.
  if (!PACKET_CONTROL_BASE.startsWith(measuredTip)) {
    throw new Error(
      `blocker-4 packet §2.8 measures the Suite LINE 1 publication tip as ` +
        `\`${measuredTip}\`, which is not the immutable control base ` +
        `\`${PACKET_CONTROL_BASE}\``,
    );
  }
  if (Number(measuredCount) !== PACKET_LINE1_BASE_NEW_COMMITS) {
    throw new Error(
      `blocker-4 packet §2.8 records ${measuredCount} Suite LINE 1 commits not ` +
        `on any remote-tracking ref; the measurement at the base ` +
        `\`${measuredTip}\` is ${PACKET_LINE1_BASE_NEW_COMMITS}`,
    );
  }

  // §7.1 must republish that measurement rather than a dated earlier reading.
  if (proposedTip !== measuredTip) {
    throw new Error(
      `blocker-4 packet §7.1 proposes publishing Suite LINE 1 at ` +
        `\`${proposedTip}\` while §2.8 measures the live tip as ` +
        `\`${measuredTip}\`; a partial refresh that updates one section and ` +
        "leaves the other on dated history is exactly this drift",
    );
  }
  if (proposedCount !== measuredCount) {
    throw new Error(
      `blocker-4 packet §7.1 records ${proposedCount} new Suite LINE 1 ` +
        `commits while §2.8 measures ${measuredCount}; both sections must ` +
        "carry the same live figure",
    );
  }

  // Both sections must carry the whole two-sided disclosure, not just the
  // figure: base, measured count, this lane's offset, the derived prediction,
  // the prediction-not-measurement warning and the mandatory external
  // re-confirmation before any push.
  assertBasePlusOneDisclosure(
    deltaSection,
    "§7.1",
    "blocker-4 packet §2.8",
  );
  assertBasePlusOneDisclosure(
    refsSection,
    "§2.8",
    "blocker-4 packet §7.1",
  );

  return {
    base: PACKET_CONTROL_BASE,
    abbreviatedBase: measuredTip,
    baseNewCommits: Number(measuredCount),
    laneCommitsAheadOfBase: PACKET_LANE_COMMITS_AHEAD_OF_BASE,
    predictedNewCommits: PACKET_LINE1_PREDICTED_NEW_COMMITS,
    // No commit SHA, tree or content aggregate is minted for this record.
    selfIdentityStated: false,
  };
}

// ── The two-sided base-plus-one disclosure ────────────────────────────────
//
// §2.8 measures at the base and §7.1 republishes it. Both must say the same six
// things, so a partial refresh cannot leave one side implying the base is the
// current tip or the prediction is a measurement.

function assertBasePlusOneDisclosure(section, counterpart, label) {
  const required = [
    {
      pattern: new RegExp(
        `\\*\\*Base-plus-one disclosure — read with ${counterpart}\\.\\*\\*`,
      ),
      what: `its **Base-plus-one disclosure — read with ${counterpart}.** lead-in`,
    },
    {
      pattern: new RegExp(`\`${PACKET_CONTROL_BASE_ABBREV}\``),
      what: `the immutable base \`${PACKET_CONTROL_BASE_ABBREV}\``,
    },
    {
      pattern: /\bparent of this Lane 5 record, not its current tip\b/,
      what: "the base-is-the-parent-not-the-current-tip statement",
    },
    {
      pattern: new RegExp(`\\*\\*${PACKET_LINE1_BASE_NEW_COMMITS}\\*\\*`),
      what: `the measured count **${PACKET_LINE1_BASE_NEW_COMMITS}** at that base`,
    },
    {
      pattern: new RegExp(`\\*\\*\\+${PACKET_LANE_COMMITS_AHEAD_OF_BASE}\\*\\*`),
      what: `this record's own offset **+${PACKET_LANE_COMMITS_AHEAD_OF_BASE}**`,
    },
    {
      pattern: new RegExp(`\\*\\*${PACKET_LINE1_PREDICTED_NEW_COMMITS}\\*\\*`),
      what:
        `the derived live-after-commit count ` +
        `**${PACKET_LINE1_PREDICTED_NEW_COMMITS}**`,
    },
    {
      pattern: /\*\*prediction, not a measurement\*\*/,
      what: "the **prediction, not a measurement** warning",
    },
    {
      pattern: /re-confirmation is \*\*mandatory before any push\*\*/,
      what: "the mandatory external re-confirmation before any push",
    },
    {
      pattern: /No (?:self )?commit SHA, tree or content aggregate/,
      what: "the no-self-identity statement",
    },
  ];
  for (const { pattern, what } of required) {
    assertIncludes(
      section,
      pattern,
      `${label} must carry the base-plus-one disclosure in full; it is missing ` +
        `${what}. A commit cannot contain its own identity, so this lane ` +
        `records the immutable base \`${PACKET_CONTROL_BASE_ABBREV}\`, the ` +
        `measured ${PACKET_LINE1_BASE_NEW_COMMITS}, its own ` +
        `+${PACKET_LANE_COMMITS_AHEAD_OF_BASE} and the derived ` +
        `${PACKET_LINE1_PREDICTED_NEW_COMMITS} — never a self SHA and never a ` +
        "figure presented as measured",
    );
  }
}

// ── §2.8 ↔ §7.1 agreement for LINE 2 and SOC ──────────────────────────────
//
// Suite LINE 1 already had this cross-check. LINE 2 and SOC now move too — the
// G1 correction extended LINE 2 and the SOC vendor commit extended the SOC
// chain — so the same partial-refresh drift is possible on both and is fenced
// the same way.

const PACKET_LINE2_DELTA_ROW_PATTERN =
  /^\| Suite LINE 2 \| `([0-9a-f]{7,40})` \| \d+ \| \*\*(\d+)\*\* \|/m;
const PACKET_LINE2_REFS_ROW_PATTERN =
  /^\| \d+ \| Suite \| LINE 2 `[^`]+` \| `([0-9a-f]{7,40})` \| (\d+) \|/m;
const PACKET_SOC_DELTA_ROW_PATTERN =
  /^\| SOC \| `([0-9a-f]{7,40})` \| \d+ \| \*\*(\d+)\*\* \|/m;
const PACKET_SOC_REFS_ROW_PATTERN =
  /^\| \d+ \| \*\*SOC\*\* \| `[^`]+` \| `([0-9a-f]{7,40})` \| (\d+) \|/m;

function assertSectionsAgree(
  deltaSection,
  refsSection,
  { label, deltaPattern, refsPattern },
) {
  const deltaRow = deltaSection.match(deltaPattern);
  if (!deltaRow) {
    throw new Error(
      `blocker-4 packet §2.8 must carry a ${label} push-delta row naming its ` +
        "tip and its bolded count of commits not on any remote-tracking ref",
    );
  }
  const refsRow = refsSection.match(refsPattern);
  if (!refsRow) {
    throw new Error(
      `blocker-4 packet §7.1 must carry a ${label} candidate-ref row naming ` +
        "its tip and new-commit count",
    );
  }
  const [, measuredTip, measuredCount] = deltaRow;
  const [, proposedTip, proposedCount] = refsRow;

  if (proposedTip !== measuredTip) {
    throw new Error(
      `blocker-4 packet §7.1 proposes publishing ${label} at ` +
        `\`${proposedTip}\` while §2.8 measures the tip as \`${measuredTip}\`; ` +
        "a partial refresh that updates one section and leaves the other on " +
        "dated history is exactly this drift",
    );
  }
  if (proposedCount !== measuredCount) {
    throw new Error(
      `blocker-4 packet §7.1 records ${proposedCount} new ${label} commits ` +
        `while §2.8 measures ${measuredCount}; both sections must carry the ` +
        "same measured figure",
    );
  }
  return { tip: measuredTip, newCommits: Number(measuredCount) };
}

function validatePacketMovedLinePublication(packetText) {
  const deltaSection = extractSection(
    packetText,
    PACKET_PUSH_DELTA_HEADING,
    "The blocker-4 packet §2.8 push-delta section",
  );
  const refsSection = extractSection(
    packetText,
    PACKET_CANDIDATE_REFS_HEADING,
    "The blocker-4 packet §7.1 candidate-ref section",
  );

  return {
    line2Publication: assertSectionsAgree(deltaSection, refsSection, {
      label: "Suite LINE 2",
      deltaPattern: PACKET_LINE2_DELTA_ROW_PATTERN,
      refsPattern: PACKET_LINE2_REFS_ROW_PATTERN,
    }),
    socPublication: assertSectionsAgree(deltaSection, refsSection, {
      label: "SOC",
      deltaPattern: PACKET_SOC_DELTA_ROW_PATTERN,
      refsPattern: PACKET_SOC_REFS_ROW_PATTERN,
    }),
  };
}

// ── §2.8 per-line sum vs unique union ─────────────────────────────────────
//
// The six push-delta rows are measured per ref. The three Suite lines share a
// fork point, so their per-line counts overlap and the six-row sum is *not* a
// unique union. The derived sum is recomputed from the rows themselves, so a
// row edit and the stated total can never drift apart silently.

const PACKET_PUSH_DELTA_ROW_COUNT = 6;
const PACKET_PUSH_DELTA_PER_LINE_SUM = 63;
const PACKET_PUSH_DELTA_SUITE_UNION = 31;
const PACKET_PUSH_DELTA_UNIQUE_UNION = 59;

// Derived, never written as literals: this record adds exactly one commit to
// Suite LINE 1, so both totals move by exactly that offset once it is committed.
const PACKET_PREDICTED_PER_LINE_SUM =
  PACKET_PUSH_DELTA_PER_LINE_SUM + PACKET_LANE_COMMITS_AHEAD_OF_BASE;
const PACKET_PREDICTED_UNIQUE_UNION =
  PACKET_PUSH_DELTA_UNIQUE_UNION + PACKET_LANE_COMMITS_AHEAD_OF_BASE;

const PACKET_PUSH_DELTA_ANY_ROW =
  /^\| [^|\n]+ \| `[0-9a-f]{7,40}` \| \d+ \| \*\*(\d+)\*\* \|/gm;

const PACKET_SUM_VERSUS_UNION_BLOCK =
  `**${PACKET_PUSH_DELTA_PER_LINE_SUM}** is the **sum of the six per-line ` +
  "counts above**, not a unique union: it double-counts the\ncommits the three " +
  "Suite lines share ahead of their common fork point. Independently measured " +
  "this\nsession, read-only, the **unique union** across all six candidate refs " +
  `is **${PACKET_PUSH_DELTA_UNIQUE_UNION}**.\n` +
  "`git rev-list --count 8fe4cb0 7185739 ed95e51 --not --remotes` returns " +
  `**${PACKET_PUSH_DELTA_SUITE_UNION}** for the three Suite\nlines taken ` +
  "together, against a per-line sum of 35; SOC, Cyber AI and Fabric are " +
  "single-ref counts\nin three separate repositories, so 11 + 12 + 5 + " +
  `${PACKET_PUSH_DELTA_SUITE_UNION} = **${PACKET_PUSH_DELTA_UNIQUE_UNION}**.`;

const PACKET_PREDICTED_TOTALS_BLOCK =
  "Predicted after this record is committed, by the base-plus-one rule and by " +
  "nothing measured:\nper-line sum " +
  `**${PACKET_PREDICTED_PER_LINE_SUM}**, unique union ` +
  `**${PACKET_PREDICTED_UNIQUE_UNION}**, Suite LINE 1 not-on-any-remote ` +
  `**${PACKET_LINE1_PREDICTED_NEW_COMMITS}**. All three are\n**derived, not ` +
  "measured**, and must be re-measured externally before any of them is used.";

function validatePacketPushDelta(packetText) {
  const section = extractSection(
    packetText,
    PACKET_PUSH_DELTA_HEADING,
    "The blocker-4 packet §2.8 push-delta section",
  );
  const counts = [...section.matchAll(PACKET_PUSH_DELTA_ANY_ROW)].map(
    ([, count]) => Number(count),
  );
  if (counts.length !== PACKET_PUSH_DELTA_ROW_COUNT) {
    throw new Error(
      `blocker-4 packet §2.8 carries ${counts.length} push-delta rows; the ` +
        `measured topology has exactly ${PACKET_PUSH_DELTA_ROW_COUNT} candidate ` +
        "refs, one per line",
    );
  }
  const perLineSum = counts.reduce((total, count) => total + count, 0);
  if (perLineSum !== PACKET_PUSH_DELTA_PER_LINE_SUM) {
    throw new Error(
      `blocker-4 packet §2.8 push-delta rows sum to ${perLineSum} ` +
        `genuinely-new commits; the section states ` +
        `${PACKET_PUSH_DELTA_PER_LINE_SUM} as the per-line total, and the two ` +
        "must be the same number",
    );
  }
  assertPinnedBlock(
    packetText,
    PACKET_SUM_VERSUS_UNION_BLOCK,
    `blocker-4 packet §2.8 must keep the sum-versus-union disclosure ` +
      `byte-exact — **${PACKET_PUSH_DELTA_PER_LINE_SUM}** is the sum of the six ` +
      "per-line counts and double-counts the commits the three Suite lines " +
      `share ahead of their fork point; the measured unique union is ` +
      `**${PACKET_PUSH_DELTA_UNIQUE_UNION}**`,
  );
  assertPinnedBlock(
    packetText,
    PACKET_PREDICTED_TOTALS_BLOCK,
    "blocker-4 packet §2.8 must keep the post-Lane 5 prediction block " +
      `byte-exact — per-line sum **${PACKET_PREDICTED_PER_LINE_SUM}**, unique ` +
      `union **${PACKET_PREDICTED_UNIQUE_UNION}** and Suite LINE 1 ` +
      `**${PACKET_LINE1_PREDICTED_NEW_COMMITS}**, each derived from the ` +
      "measured figure plus this record's own offset and each labelled derived, " +
      "not measured",
  );

  return {
    rows: counts.length,
    perLineSum,
    suiteUnion: PACKET_PUSH_DELTA_SUITE_UNION,
    uniqueUnion: PACKET_PUSH_DELTA_UNIQUE_UNION,
    predictedPerLineSum: PACKET_PREDICTED_PER_LINE_SUM,
    predictedUniqueUnion: PACKET_PREDICTED_UNIQUE_UNION,
  };
}

// ── Lane 5 local-only reviewed provenance — four commits, none integrated ──
//
// Four reviewed commits exist locally and nowhere else. Each is committed, each
// passed an independent review, and none is integrated, pushed, merged,
// released or contract-reaccepted. The table is byte-identical in all three
// control documents so no document can soften another's wording, and it lives
// in its own bounded section because the legacy §2.9/§4.4 regions forbid any
// new full commit identity.

const PACKET_LOCAL_PROVENANCE_HEADING =
  "### 2.10 Local-only reviewed provenance — four commits, none integrated";
const BOARD_LOCAL_PROVENANCE_HEADING =
  "### 14.35 W1 Lane 5 local-only reviewed provenance — four commits, none integrated";
const REGISTER_LOCAL_PROVENANCE_HEADING =
  "## 27. W1 Lane 5 local-only reviewed provenance — 2026-07-28, first same-day record";

const LANE5_C1_COMMIT = "20cfa36c503e5a95341c80653d25d2000d65c9fe";
const LANE5_G1_COMMIT = "71857395332fabe041896ca0700fbf7a2bf612d3";
const LANE5_SOC_COMMIT = "5da251d92e66968103db4df9d544e2a1f3597b58";
const LANE5_FABRIC_COMMIT = "37d9b3293d26502fcd5be8144dbee78a98067043";

const LANE5_LOCAL_PROVENANCE_COMMITS = [
  LANE5_C1_COMMIT,
  LANE5_G1_COMMIT,
  LANE5_SOC_COMMIT,
  LANE5_FABRIC_COMMIT,
];

const LANE5_BASE_STATUS_TOKENS = [
  "`LOCAL-ONLY`",
  "`INDEPENDENT REVIEW PASS`",
  "`NOT INTEGRATED`",
  "`NOT PUSHED/MERGED/RELEASED`",
];

const LANE5_C1_ROW =
  "| W1-C1 correction | `20cfa36c503e5a95341c80653d25d2000d65c9fe`, parent " +
  "`a976a205601de22dae59e5112e37ae29707fda0e`, tree " +
  "`380a8f77e65b0980d561a94e3615b49bc0e76921` | exactly 16 paths; manifest " +
  "`403f7b0df42b9c0768f048bb71dedeebdd3f930d9a39dcf4ac935335b85b7d2e`; " +
  "`MEMBER-SET-SHA256/v1` " +
  "`27a6bdeb168599dc4fd05e27f06785315a3b763647826559efe9d721bc0292c8`, " +
  "`member_count` 13; pre-commit working-tree aggregate `76ef51d9…`, full value " +
  "and recipe in §2.9 | `LOCAL-ONLY` · `INDEPENDENT REVIEW PASS` · `NOT " +
  "INTEGRATED` · `NOT PUSHED/MERGED/RELEASED`; not contract-reaccepted — the " +
  "accepted W1-C1 baseline `3a2c715…` / `e4cfbf8c…` is unchanged |";

const LANE5_G1_ROW =
  "| W1-G1 correction | `71857395332fabe041896ca0700fbf7a2bf612d3`, parent " +
  "`20cfa36c503e5a95341c80653d25d2000d65c9fe`, tree " +
  "`96a4ecceb054292b1272b7fd38adc6ce7c1ae7f3` | exactly 9 paths; manifest " +
  "`35e767513267bb5ee88a933ab6faf4526162b34dff13460cd3c5a14e6825fbf0`; " +
  "`MEMBER-SET-SHA256/v1` " +
  "`a285fa8e4850999dc013b03506ed1e62f5c7bb4209d198a4e16fa02c446b43f4`, " +
  "`member_count` 15; content aggregate " +
  "`54e90e27b546e569156c13c3f7455bd99e1a5168e7e62b139422c5fed95e50cc` | " +
  "`LOCAL-ONLY` · `INDEPENDENT REVIEW PASS` · `NOT INTEGRATED` · `NOT " +
  "PUSHED/MERGED/RELEASED`; the accepted W1-G1 baseline is unchanged |";

const LANE5_SOC_ROW =
  "| SOC vendor conformance | `5da251d92e66968103db4df9d544e2a1f3597b58`, " +
  "parent `74f9774bfb5a6816cd9f0ddc230673a181a4cfd6`, tree " +
  "`2534201c823c5bde582d1595eea6e22622d6b910` | exactly 16 paths; content " +
  "aggregate " +
  "`be19bad6d1c6e14edb4e3a5a810806a3670124cb442808abe87a977cc612cfd3`; " +
  "post-review `PASS` | `LOCAL-ONLY` · `INDEPENDENT REVIEW PASS` · `NOT " +
  "INTEGRATED` · `NOT PUSHED/MERGED/RELEASED` · `CONFORMANCE-ONLY`; the " +
  "inherited gitleaks red stands and the SOC push remains `NO-GO` |";

const LANE5_FABRIC_ROW =
  "| Fabric vendor conformance | `37d9b3293d26502fcd5be8144dbee78a98067043`, " +
  "parent `d38f910a44d6454285b393cb89df4a6ade4eb855`, tree " +
  "`6c118efd9f1dfc447eae1efb16194261850274e9` | exactly 32 paths; content " +
  "aggregate " +
  "`428a7a9b6cb06ed44469e148041ad56b58949a25cd01fb0ef617eb524ac0a44e`; 403 " +
  "tests; post-review `PASS` | `LOCAL-ONLY` · `INDEPENDENT REVIEW PASS` · `NOT " +
  "INTEGRATED` · `NOT PUSHED/MERGED/RELEASED` · `CONFORMANCE-ONLY`; no runtime " +
  "and no vendor-parity claim |";

const LANE5_PROVENANCE_ROWS = [
  { lane: "W1-C1 correction", row: LANE5_C1_ROW, conformanceOnly: false },
  { lane: "W1-G1 correction", row: LANE5_G1_ROW, conformanceOnly: false },
  { lane: "SOC vendor conformance", row: LANE5_SOC_ROW, conformanceOnly: true },
  {
    lane: "Fabric vendor conformance",
    row: LANE5_FABRIC_ROW,
    conformanceOnly: true,
  },
];

// Aggregates and member sets, each bound to the one lane row it belongs to.
// Conflating a G1 member set onto the C1 row — or reusing one aggregate for two
// lanes — is the failure mode this table prevents.
const LANE5_LANE_BOUND_DIGESTS = [
  {
    lane: "W1-C1 correction",
    label: "W1-C1 correction manifest",
    value: "403f7b0df42b9c0768f048bb71dedeebdd3f930d9a39dcf4ac935335b85b7d2e",
  },
  {
    lane: "W1-G1 correction",
    label: "W1-G1 correction manifest",
    value: "35e767513267bb5ee88a933ab6faf4526162b34dff13460cd3c5a14e6825fbf0",
  },
  {
    lane: "W1-G1 correction",
    label: "W1-G1 correction member set",
    value: "a285fa8e4850999dc013b03506ed1e62f5c7bb4209d198a4e16fa02c446b43f4",
  },
  {
    lane: "W1-G1 correction",
    label: "W1-G1 correction content aggregate",
    value: "54e90e27b546e569156c13c3f7455bd99e1a5168e7e62b139422c5fed95e50cc",
  },
  {
    lane: "SOC vendor conformance",
    label: "SOC vendor conformance content aggregate",
    value: "be19bad6d1c6e14edb4e3a5a810806a3670124cb442808abe87a977cc612cfd3",
  },
  {
    lane: "Fabric vendor conformance",
    label: "Fabric vendor conformance content aggregate",
    value: "428a7a9b6cb06ed44469e148041ad56b58949a25cd01fb0ef617eb524ac0a44e",
  },
];

// Affirmative promotion verbs only. The rows themselves must say `NOT
// INTEGRATED` and `NOT PUSHED/MERGED/RELEASED`, so every pattern is tempered
// with a negative lookahead and cannot run through those disclosures.
const LANE5_PROMOTION_CLAIMS = [
  {
    // The denial forms `none is integrated` / `nothing was pushed` are the
    // status-honest statements this section is required to make, so an
    // explicit negative subject is excluded alongside the `is not` form. Only
    // affirmative promotion still fails.
    pattern:
      /(?<!\b(?:none|neither|nor|nothing)\s{1,8})\b(?:is|are|was|were|has been|have been)\s+(?!not\b)(?:now\s+)?(?:pushed|merged|released|integrated)\b/i,
    message:
      "Lane 5 local-provenance section claims a Lane 5 commit is pushed, " +
      "merged, released or integrated; all four commits are local-only, exist " +
      "on no remote-tracking ref, and are integrated nowhere",
  },
  {
    pattern: /\b(?:is|are|was|were|has been|have been)\s+(?!not\b)(?:now\s+)?contract-re-?accepted\b/i,
    message:
      "Lane 5 local-provenance section claims a contract re-acceptance; the " +
      "W1-C1 and W1-G1 accepted baselines are unchanged and no correction has " +
      "been re-accepted by any contract gate",
  },
  {
    pattern: /\bre-?accepted (?:by|at) the (?:W1-C1|W1-G1|contract)\b/i,
    message:
      "Lane 5 local-provenance section claims a contract re-acceptance; the " +
      "W1-C1 and W1-G1 accepted baselines are unchanged and no correction has " +
      "been re-accepted by any contract gate",
  },
];

const LANE5_PROVENANCE_TABLE_ROW = /^\| [^|\n]+ \| `[0-9a-f]{40}`, parent /gm;

function validateLane5LocalProvenance(text, heading, label) {
  const section = extractSection(text, heading, label);

  const rowCount = [...section.matchAll(LANE5_PROVENANCE_TABLE_ROW)].length;
  if (rowCount !== LANE5_PROVENANCE_ROWS.length) {
    throw new Error(
      `${label} local-provenance table must carry exactly four rows — the ` +
        "W1-C1 correction, the W1-G1 correction, the SOC vendor conformance " +
        `commit and the Fabric vendor conformance commit; it carries ` +
        `${rowCount}. A missing row hides a local commit; an extra row invents ` +
        "one",
    );
  }

  // Each lane-bound digest appears exactly once per document, and only on its
  // own row. Checked before the byte-exact row pin so a digest read against the
  // wrong lane reports the conflation rather than the generic drift message.
  for (const { lane, label: digestLabel, value } of LANE5_LANE_BOUND_DIGESTS) {
    const occurrences = countOccurrences(text, value);
    if (occurrences !== 1) {
      throw new Error(
        `${label} names the ${digestLabel} ${occurrences} times; it must ` +
          "appear exactly once, on its own lane row, so no aggregate or member " +
          "set can be read as belonging to two lanes",
      );
    }
    const carrier = text
      .split("\n")
      .find((line) => line.includes(value));
    if (!carrier || !carrier.startsWith(`| ${lane} |`)) {
      throw new Error(
        `${label} states the ${digestLabel} outside the \`${lane}\` row; it ` +
          "is not stated on its own lane row, and a digest read against the " +
          "wrong lane is exactly the conflation these rows exist to prevent",
      );
    }
  }

  for (const { lane, row, conformanceOnly } of LANE5_PROVENANCE_ROWS) {
    // Status tokens are checked before the byte-exact pin. Both assertions run
    // for every row; ordering them this way means a dropped status token
    // reports the token it lost instead of the generic drift message.
    const tokens = conformanceOnly
      ? [...LANE5_BASE_STATUS_TOKENS, "`CONFORMANCE-ONLY`"]
      : LANE5_BASE_STATUS_TOKENS;
    const rowText = section
      .split("\n")
      .find((line) => line.startsWith(`| ${lane} |`));
    for (const token of tokens) {
      if (!rowText || !rowText.includes(token)) {
        throw new Error(
          `${label} local-provenance row for ${lane} must carry the ${token} ` +
            "status token; the four commits are local-only, independently " +
            "reviewed, integrated nowhere and pushed nowhere, and the vendor " +
            "rows are conformance-only",
        );
      }
    }
    assertPinnedBlock(
      section,
      row,
      `${label} local-provenance row for ${lane} must stay pinned byte-exact ` +
        "and byte-identical across the packet, the board and the register",
    );
  }

  for (const { pattern, message } of LANE5_PROMOTION_CLAIMS) {
    assertExcludes(section, pattern, `${label} ${message}`);
  }

  return { rows: rowCount };
}

// ── No new Lane 5 identity inside the legacy guarded regions ──────────────

function assertNoLane5Identity(region, label) {
  for (const commit of LANE5_LOCAL_PROVENANCE_COMMITS) {
    assertExcludes(
      region,
      new RegExp(escapeRegExp(commit)),
      `${label} must not carry the Lane 5 local-provenance identity ` +
        `\`${commit}\`; the four full identities belong only to the bounded ` +
        "Lane 5 local-provenance table, and this region's allowlist covers the " +
        "accepted W1-C1 baseline and its parent alone",
    );
  }
}

// ── Withdrawn uncommitted-generation claims ───────────────────────────────
//
// The W1-C1 correction is a commit now. Every surviving sentence that says
// otherwise must sit inside explicitly dated history — a paragraph that carries
// a date, or names itself as superseded or withdrawn. Anywhere else it reads as
// a current claim and is false.

const WITHDRAWN_GENERATION_CLAIMS = [
  "CORRECTION EVIDENCE READY — UNCOMMITTED — NOT ACCEPTED",
  "no commit object",
  "no new commit",
  "adds **no commit**",
  "uncommitted working-tree overlay",
  "uncommitted reviewed overlay",
];

const DATED_HISTORY_MARKER = /\b2026-\d{2}-\d{2}\b|dated history|superseded|withdrawn/i;

const MARKDOWN_TABLE_ROW = /^\s*\|/;

// Exemption scope. A markdown table has no blank lines inside it, so a
// paragraph-level scan makes the *whole table* one unit: a single dated or
// self-withdrawing row then exempts every other row, including a false live
// one. That is exactly how the §9.1 rule-6 row kept describing a superseded
// three-node graph while sitting beside a row that carries the word
// `withdrawn`. So a table row is its own exemption unit and must carry its own
// anchor.
//
// Prose keeps paragraph scope on purpose: a dated narrative paragraph
// legitimately states its date in one sentence and the historical claim in
// another, and splitting it per line would reject truthful dated history.
function generationClaimUnits(text) {
  const units = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    const lines = paragraph.split("\n");
    if (!lines.some((line) => MARKDOWN_TABLE_ROW.test(line))) {
      units.push(paragraph);
      continue;
    }
    const prose = [];
    for (const line of lines) {
      if (MARKDOWN_TABLE_ROW.test(line)) {
        units.push(line);
      } else {
        prose.push(line);
      }
    }
    if (prose.length > 0) {
      units.push(prose.join("\n"));
    }
  }
  return units;
}

function assertNoUndatedGenerationClaim(text, label) {
  for (const unit of generationClaimUnits(text)) {
    const isTableRow = MARKDOWN_TABLE_ROW.test(unit) && !unit.includes("\n");
    for (const claim of WITHDRAWN_GENERATION_CLAIMS) {
      if (!unit.includes(claim)) continue;
      if (DATED_HISTORY_MARKER.test(unit)) continue;
      throw new Error(
        `${label} carries the withdrawn uncommitted-generation claim ` +
          `"${claim}" outside explicitly dated history. The W1-C1 correction ` +
          "is committed local-only at `20cfa36`; a surviving generation claim " +
          "must sit in a " +
          (isTableRow
            ? "table row that dates itself or names itself superseded — a " +
              "dated or withdrawn sibling row in the same table exempts " +
              "nothing"
            : "paragraph that dates itself or names itself superseded") +
          ", or it reads as a current fact and is false",
      );
    }
  }
}

// ── No self identity for the Lane 5 record ────────────────────────────────
//
// A commit cannot contain its own SHA, tree or content aggregate. Minting one
// in advance — or embedding the five-path scope aggregate that measures these
// very bytes — would be fabricated evidence.

const LANE5_SELF_IDENTITY_CLAIMS = [
  {
    pattern:
      /\bthis (?:record|lane|commit|reconciliation)(?:'s)?\b[^.\n]{0,80}\b(?:commit|tree|SHA)\b[^.\n]{0,20}`[0-9a-f]{7,40}`/i,
    what: "a commit, tree or SHA for the Lane 5 record itself",
  },
  {
    pattern: /SCOPE-AGG-SHA256\/v1[^\n]{0,120}`?[0-9a-f]{64}`?/,
    what: "the five-path scope aggregate value that measures these very bytes",
  },
  {
    pattern:
      /\bLane 5\b[^.\n]{0,60}\b(?:commit|tree)\b[^.\n]{0,20}`[0-9a-f]{40}`/i,
    what: "a minted Lane 5 commit or tree identity",
  },
];

function assertNoLane5SelfIdentity(text, label) {
  for (const { pattern, what } of LANE5_SELF_IDENTITY_CLAIMS) {
    assertExcludes(
      text,
      pattern,
      `${label} mints a self identity for the Lane 5 record by stating ` +
        `${what}. A commit cannot contain its own SHA, tree or content ` +
        "aggregate; this lane publishes the measurement recipe and re-measures " +
        "externally after the commit exists",
    );
  }
}

// ── No present-tense current-`HEAD` claim about the immutable base ────────
//
// `8fe4cb0` is the *parent* of this record. Calling it the current control
// `HEAD` in the present tense is the exact confusion design C exists to remove.
// Scoped to the packet: the board's dated records legitimately say the control
// `HEAD` was `8fe4cb02…` on their own date.

const PACKET_PRESENT_TENSE_BASE_CLAIMS = [
  /\b(?:current|live)\b[^\n]{0,60}\bcontrol\s+`?HEAD`?[^\n]{0,140}8fe4cb0/i,
  /\bcontrol\s+`?HEAD`?\s+(?:is|remains|stays)\s+`?8fe4cb0/i,
  /\bThe current control\s+`?HEAD`?\s+is\b/i,
];

function assertNoPresentTenseBaseClaim(packetText) {
  for (const pattern of PACKET_PRESENT_TENSE_BASE_CLAIMS) {
    assertExcludes(
      packetText,
      pattern,
      "blocker-4 packet names the immutable base as a present-tense current " +
        `control \`HEAD\`. \`${PACKET_CONTROL_BASE_ABBREV}\` is the ` +
        "**base/parent** of this Lane 5 record, not its tip; the live tip is " +
        "not knowable from inside the record and is never stated",
    );
  }
}

// ── §9.1 machine-enforcement surface disclosure ───────────────────────────
//
// The withdrawn W1-D04C §9 sentence claimed the validator enforced §2.9 and §8
// NO-GO 14–15 *only*, and that §2–§7 were unenforced prose. Both halves were
// false. The replacement inventory is pinned in both directions: an enforced
// row that disappears is an underclaim, an overclaim sentence that reappears is
// an overclaim, and both fail closed.

const PACKET_ENFORCEMENT_HEADING =
  "### 9.1 Machine-enforcement surface — exactly what the validator checks";
const PACKET_ENFORCED_RULE_ROW = /^\| (\d+) \| /gm;
const PACKET_UNENFORCED_NO_GO = [16, 17];

const PACKET_ENFORCED_RULE_ROWS = [
  "| 1 | §2.8 push-delta table | the `Suite LINE 1` row must exist and name a tip that is a prefix of the pinned immutable control **base**, carrying **25** as its bolded count of commits not on any remote-tracking ref |",
  "| 2 | §2.8 push-delta table | the six bolded per-row counts must sum to the stated per-line total **63**, and the sum-versus-union sentence naming the measured unique union **59** and the Suite-only union **31** is pinned byte-exact |",
  "| 3 | §2.8 ↔ §7.1 row 3 | the §7.1 Suite LINE 1 candidate-ref row must exist for `codex/w1-d04-founder-gate-repair-r1` and republish §2.8's tip and count exactly |",
  "| 4 | §2.9 | the dual-state heading must exist, and the section may name no 40-hex commit identity other than the accepted base `3a2c715…` or its parent `3ef8e05…` |",
  "| 5 | §2.9 | no affirmative promotion claim — the section may not say the W0-I01C candidate is accepted, integrated, superseding or replacing |",
  "| 6 | §2.9 | the commit-graph block — LINE 2 extended, not rewritten, totally ordered `3a2c715` → `4d5fb4b` → `a976a20` → `20cfa36` → `7185739`, with both corrections local-only, integrated nowhere and accepted by no contract gate — is pinned byte-exact |",
  "| 7 | §2.9 | the `76ef51d9…` pre-commit working-tree aggregate must appear **exactly once** in this whole file, and its label block, including the reproduction recipe and its dated pre-commit status, is pinned byte-exact |",
  "| 8 | §2.9 | the measured alert-context transport fixture disclosure block is pinned byte-exact |",
  "| 9 | whole file | corpus-level withdrawn-count guard: every surviving `<n> transport fixtures` claim anywhere in this file, quotation included, must read **13** |",
  "| 10 | §8 | NO-GO **14** and NO-GO **15** are each pinned byte-exact |",
  "| 11 | §9 | the dated verification-history table and the current-result paragraph above are each pinned byte-exact |",
  "| 12 | §9.1 plus live repository | this table and the live-`git` paragraph are pinned byte-exact; the canonical file validator fails closed unless the exact two rehearsal merge commits, ordered parents, trees, required input objects and tip ancestry exist |",
  "| 13 | §2.8 and §7.1 | both sections must carry the full two-sided base-plus-one disclosure — the base `8fe4cb0`, the measured **25**, this record's **+1**, the derived **26**, the prediction-not-measurement warning, the no-self-identity statement and the mandatory external re-confirmation before any push |",
  "| 14 | whole file | no present-tense `current`/`live` control-tip claim may name the immutable base `8fe4cb0`; it is the base/parent of this record, never its tip |",
  "| 15 | §2.10, board §14.35, register §27 | exactly four local-provenance rows, each pinned byte-exact and byte-identical across the three documents, each carrying `LOCAL-ONLY`, `INDEPENDENT REVIEW PASS`, `NOT INTEGRATED` and `NOT PUSHED/MERGED/RELEASED`, with `CONFORMANCE-ONLY` on both vendor rows; a missing or extra row fails closed |",
  "| 16 | §2.10, board §14.35, register §27 | no affirmative claim that a Lane 5 commit is pushed, merged, released, integrated or contract-reaccepted |",
  "| 17 | §2.9, §4.4, board §14.32.2 | none of the four Lane 5 full commit identities may appear inside the legacy guarded regions, whose allowlist stays the accepted base `3a2c715…` and its parent `3ef8e05…` |",
  "| 18 | all three control documents | no withdrawn uncommitted-generation claim — `no commit object`, `no new commit`, `uncommitted working-tree overlay`, the retired lifecycle string — may survive outside a paragraph that dates itself or names itself superseded |",
  "| 19 | all three control documents | every Lane 5 manifest, member set and content aggregate must appear exactly once and only on its own lane row; no aggregate or member set may be read against two lanes |",
  "| 20 | §2.8 ↔ §7.1 | the Suite LINE 2 and SOC rows must agree on tip and count across both sections, exactly as Suite LINE 1 already must |",
  "| 21 | whole corpus | no self identity for this record — no Lane 5 commit SHA, tree or `SCOPE-AGG-SHA256/v1` value may be stated or predicted anywhere; the predicted count is derived in the validator from base + offset and is never a literal |",
];

const PACKET_UNENFORCED_BULLETS = [
  "- §1, §2.1–§2.7, §3, §4, §5 and §6 **in full** — every sentence, table and measured figure in them,\n  including the whole hosted-state audit and the secret-scan findings.",
  "- §2.8 beyond rules 1–2, 13 and 20: the Cyber AI, Fabric and Suite LINE 3 rows' tips and\n  ahead-counts.",
  "- §7 beyond rules 3, 13 and 20: §7.1 rows 1, 4 and 5 and all their figures, and all of §7.2, §7.3 and §7.4.",
  "- §8 NO-GO **1–13**, **16** and **17** — including the runtime/local-stack NO-GO 16 and the\n  release-date NO-GO 17, which stay **prose-only and unpinned**.",
  "- §9 outside §9.1: the status-and-ceiling table above.",
  "- §10 in full: every transcript path, byte count and record count.",
];

const PACKET_LIVE_GIT_BLOCK =
  "**Live `git` topology is required and read fail-closed.** The canonical file validator invokes\n" +
  "read-only `git` commands in the repository root. It requires the exact objects\n" +
  "`b2caf77c3cd96beb7383cc3d93844d771262ea5f`,\n" +
  "`71857395332fabe041896ca0700fbf7a2bf612d3`,\n" +
  "`5a1ed0001a5714b7f099aeaff3f5a74cb67c068a`,\n" +
  "`87efae7898bd14e9aa9a2866380a9973d8b3e5bc` and\n" +
  "`900d83a61515f37ae117e04763da1881cba90b7b`, then checks exact ordered parents, trees, ancestry\n" +
  "and current rehearsal tip. A missing or shallow-history object is a hard failure. The pure\n" +
  "document-validation function remains injectable for negative fixtures, but it never substitutes\n" +
  "for the canonical file validator or degrades a missing Git object to document-only success.";

const PACKET_VERIFICATION_HISTORY_BLOCK =
  "| Date | Lane / record | Validator | Test suite |\n|---|---|---|---|\n" +
  "| 2026-07-27 | W1-D04B, re-run by the W0-R06L review | `PASS: tasks=48` | " +
  "`tests 77 · pass 77 · fail 0` |\n" +
  "| 2026-07-27 | W1-D04C dual-state provenance refresh | `PASS: tasks=48` | " +
  "RED `tests 100 · pass 78 · fail 22`, then `tests 100 · pass 100 · fail 0` |\n" +
  "| 2026-07-27 | W1-D04D W0-R06M bounded repair | `PASS: tasks=48` | RED " +
  "`tests 115 · pass 101 · fail 14`, then `tests 115 · pass 115 · fail 0` |\n" +
  "| 2026-07-27 | W1-D04D-R2 enforcement-surface repair | `PASS: tasks=48` | " +
  "RED `tests 131 · pass 115 · fail 16`, then `tests 131 · pass 131 · fail 0` |";

const PACKET_CURRENT_VERIFICATION_BLOCK =
  "**Current — W1 Lane 5 control reconciliation, this record.** Test-first RED " +
  "before any\nimplementation: `tests 172 · pass 95 · fail 77` — forty-one " +
  "tests added over the 131-test baseline;\nmost of those failures cascaded " +
  "from the first standalone-validator failure rather than being\nindependent " +
  "defects. That first pass reached `tests 172 · pass 172 · fail 0`, and the " +
  "independent\nreview of those bytes returned **NO-GO**. The bounded " +
  "remediation that followed added seven\ntests, three of them measured RED " +
  "against the un-hardened exemption scanner — `tests 179 · pass\n176 · fail " +
  "3` — before the fix landed. Final, against these bytes:\n" +
  "`node tools/operations/validate-w1-control.mjs` → **PASS**, " +
  "`tasks=48`;\n`node --test tools/operations/tests/validate-w1-control.test.mjs` " +
  "→ **`tests 179 · pass 179 · fail 0`**.\nThe `131 · 131` and `172 · 172` " +
  "figures are earlier results, not the current count. CI3 is now\n" +
  "prepared locally; no hosted run is claimed.";

// Affirmative overclaims only. §9.1 itself has to *name* the withdrawn wording
// to withdraw it, so every pattern requires the asserting verb form: the
// live-`git` patterns are tempered so they cannot run through a negation.
const PACKET_ENFORCEMENT_OVERCLAIMS = [
  {
    pattern: /machine-enforces[^\n]{0,240}NO-GO 14[–-]15\s+only/i,
    message:
      "blocker-4 packet restores the withdrawn enforcement overclaim that the " +
      "validator machine-enforces §2.9 and §8 NO-GO 14–15 only; §2.8, §7.1 " +
      "row 3 and a corpus-level scan of the whole file are enforced too — see " +
      "the §9.1 inventory",
  },
  {
    pattern: /§2[–—-]§7[^\n]{0,120}\bremain\b[^\n]{0,24}unenforced/i,
    message:
      "blocker-4 packet understates the enforcement surface by claiming §2–§7 " +
      "remain unenforced prose; §2.8 rules 1–2 and the §2.8↔§7.1 row-3 " +
      "cross-check are machine-enforced — see the §9.1 inventory",
  },
];

function validatePacketEnforcementSurface(packetText) {
  const headings = countOccurrences(packetText, PACKET_ENFORCEMENT_HEADING);
  if (headings !== 1) {
    throw new Error(
      "blocker-4 packet must carry the §9.1 machine-enforcement surface " +
        `disclosure exactly once; found ${headings}. It is the anchor that ` +
        "states what this validator does and does not check, and it may not be " +
        "dropped, renamed or duplicated",
    );
  }
  const section = extractSection(
    packetText,
    PACKET_ENFORCEMENT_HEADING,
    "The blocker-4 packet §9.1 machine-enforcement surface section",
  );

  // Numbering first: a renumbered row reports the numbering defect rather than
  // the generic byte-exact message.
  const numbers = [...section.matchAll(PACKET_ENFORCED_RULE_ROW)].map(
    ([, number]) => Number(number),
  );
  numbers.forEach((number, index) => {
    if (number !== index + 1) {
      throw new Error(
        "blocker-4 packet §9.1 enforced-rule inventory must be numbered " +
          `1..${PACKET_ENFORCED_RULE_ROWS.length} contiguously; row ` +
          `${index + 1} reads ${number}`,
      );
    }
  });

  // The unenforced NO-GOs are checked by name before the byte-exact list pin,
  // so dropping them reports the specific coverage gap being concealed.
  for (const noGo of PACKET_UNENFORCED_NO_GO) {
    assertIncludes(
      section,
      new RegExp(`NO-GO ${noGo}\\b`),
      `blocker-4 packet §9.1 must name NO-GO 16 and NO-GO 17 as unenforced; ` +
        `NO-GO ${noGo} is missing from the list. The runtime/local-stack and ` +
        "release-date NO-GOs are prose-only, and a reader must not infer the " +
        "validator holds them",
    );
  }

  PACKET_ENFORCED_RULE_ROWS.forEach((row, index) => {
    assertPinnedBlock(
      packetText,
      row,
      "blocker-4 packet §9.1 enforced-rule inventory must stay pinned " +
        `byte-exact; rule ${index + 1} is missing or has drifted. An enforced ` +
        "rule dropped from this table is an underclaim of the enforcement " +
        "surface, exactly the W1-D04C defect",
    );
  });

  PACKET_UNENFORCED_BULLETS.forEach((bullet, index) => {
    assertPinnedBlock(
      packetText,
      bullet,
      "blocker-4 packet §9.1 unenforced-section list must stay pinned " +
        `byte-exact; bullet ${index + 1} is missing or has drifted. Silently ` +
        "shortening this list lets a reader infer machine coverage that does " +
        "not exist",
    );
  });

  assertPinnedBlock(
    packetText,
    PACKET_LIVE_GIT_BLOCK,
    "blocker-4 packet §9.1 must keep the fail-closed live-`git` disclosure byte-exact — " +
      "the canonical file validator requires exact objects, ordered parents, " +
      "trees, ancestry and the rehearsal tip",
  );

  assertPinnedBlock(
    packetText,
    PACKET_VERIFICATION_HISTORY_BLOCK,
    "blocker-4 packet §9 must keep the dated verification-history table " +
      "byte-exact — the W1-D04B `77 · 77`, W1-D04C `100 · 100` and W1-D04D " +
      "`115 · 115` results are dated history against the bytes of their own " +
      "records and are not withdrawn",
  );
  assertPinnedBlock(
    packetText,
    PACKET_CURRENT_VERIFICATION_BLOCK,
    "blocker-4 packet §9 must keep the current W1 Lane 5 verification result " +
      "byte-exact — RED `tests 172 · pass 95 · fail 77`, the reviewed-NO-GO " +
      "`tests 172 · pass 172 · fail 0`, the remediation RED `tests 179 · pass " +
      "176 · fail 3`, then `tests 179 · pass 179 · fail 0` with the validator " +
      "`PASS: tasks=48`; an earlier figure may not be presented as the current " +
      "count",
  );

  if (numbers.length !== PACKET_ENFORCED_RULE_ROWS.length) {
    throw new Error(
      `blocker-4 packet §9.1 carries ${numbers.length} enforced-rule rows; the ` +
        `inventory has exactly ${PACKET_ENFORCED_RULE_ROWS.length}`,
    );
  }

  for (const { pattern, message } of PACKET_ENFORCEMENT_OVERCLAIMS) {
    assertExcludes(packetText, pattern, message);
  }

  return {
    anchor: "§9.1",
    enforcedRules: numbers.length,
    unenforcedNoGo: [...PACKET_UNENFORCED_NO_GO],
    readsLiveGit: false,
  };
}

// A guarded candidate region may name the accepted base commit and its parent
// and nothing else commit-shaped. This is deliberately *not* a corpus-wide scan
// — historical 40-hex SHAs elsewhere in these documents stay valid.
const CANDIDATE_ALLOWED_COMMITS = new Set([W1_C1_COMMIT, W1_CANDIDATE_PARENT]);

function assertNoForeignCommitIdentity(region, label) {
  // Specific before general: a Lane 5 provenance identity leaking into a legacy
  // guarded region gets its own diagnostic rather than the generic allowlist
  // message. Both guards still hold — this only orders them.
  assertNoLane5Identity(region, label);
  for (const [digest] of region.matchAll(/\b[0-9a-f]{40}\b/g)) {
    if (!CANDIDATE_ALLOWED_COMMITS.has(digest)) {
      throw new Error(
        `${label} asserts the commit identity \`${digest}\`; this guarded ` +
          "region may name only the accepted base " +
          `\`${W1_C1_COMMIT}\` or its documented parent ` +
          `\`${W1_CANDIDATE_PARENT}\`. The W0-I01C correction is committed, ` +
          "but its full identity belongs solely to the bounded Lane 5 " +
          "local-provenance table",
      );
    }
  }
}

function assertNoPromotionClaim(region, label) {
  for (const pattern of CANDIDATE_PROMOTION_CLAIMS) {
    assertExcludes(
      region,
      pattern,
      `${label} must not claim the W0-I01C candidate is accepted or committed, ` +
        "or that the candidate supersedes or replaces the accepted W1-C1 baseline",
    );
  }
}

function assertCandidateRow(text, label) {
  const occurrences = countOccurrences(text, W1_C1_CORRECTION_ROW);
  if (occurrences > 1) {
    throw new Error(
      `${label} carries the W0-I01C candidate row ${occurrences} times; it must ` +
        "appear exactly once so drift fixtures cannot land on a second site",
    );
  }
  if (occurrences === 0) {
    throw new Error(
      `${label} must carry the ${W1_C1_CANDIDATE_LANE} alert-context correction ` +
        "candidate row byte-exact — lifecycle " +
        `\`${W1_C1_CANDIDATE_LIFECYCLE}\`, base \`${W1_C1_COMMIT}\`, exactly ` +
        `${W1_C1_CANDIDATE_DIRTY_PATHS} modified tracked paths and zero staged, ` +
        `\`member_set\` \`sha256:${W1_C1_CANDIDATE_MEMBER_SET}\` with ` +
        `\`member_count\` ${W1_C1_CANDIDATE_MEMBER_COUNT}, 86.99% branch ` +
        "coverage against the 80% floor, and an independent review `PASS`",
    );
  }
}

function assertNoCrossContamination(text, rowAnchor, kind, label) {
  const forbidden =
    kind === "accepted" ? CANDIDATE_ONLY_VALUES : ACCEPTED_ONLY_VALUES;
  const other = kind === "accepted" ? "candidate" : "accepted";
  for (const { label: valueLabel, value } of forbidden) {
    assertExcludes(
      text,
      new RegExp(`^${rowAnchor}[^\\n]*${escapeRegExp(value)}`, "m"),
      `${label} ${kind} W1-C1 evidence row carries the ${valueLabel}; the ` +
        `${kind} row must stay free of every ${other}-state value`,
    );
  }
}

function validateDualStateW1C1Provenance({
  e2RegisterText,
  boardText,
  packetText,
}) {
  // 1. The candidate row exists exactly once, byte-exact, in both documents.
  assertCandidateRow(e2RegisterText, "E2 register §1");
  assertCandidateRow(boardText, "W1 board §14.32.2");

  // 2. No commit identity may be asserted for an uncommitted candidate, in any
  //    of the three guarded candidate regions. Scanning the module constant
  //    instead of the documents would prove nothing — the constant cannot drift.
  assertNoForeignCommitIdentity(
    extractSection(
      packetText,
      PACKET_DUAL_STATE_HEADING,
      "The blocker-4 packet §2.9 dual-state provenance section",
    ),
    "blocker-4 packet §2.9",
  );
  assertNoForeignCommitIdentity(
    extractSection(
      e2RegisterText,
      REGISTER_CANDIDATE_NOTE_HEADING,
      "E2 register §4.4 candidate note",
    ),
    "E2 register §4.4",
  );

  // 3. Cross-contamination is blocked in both directions.
  assertNoCrossContamination(
    e2RegisterText,
    E2_REGISTER_ROW_ANCHORS["W1-C1"],
    "accepted",
    "E2 register",
  );
  assertNoCrossContamination(
    boardText,
    BOARD_ROW_ANCHORS["W1-C1"],
    "accepted",
    "W1 board",
  );
  for (const [text, label] of [
    [e2RegisterText, "E2 register"],
    [boardText, "W1 board"],
  ]) {
    assertNoCrossContamination(
      text,
      escapeRegExp(
        `| ${W1_C1_CANDIDATE_LANE} — W1-C1 alert-context correction candidate |`,
      ),
      "candidate",
      label,
    );
  }

  // 4. The board dual-state section and the stale-lock disclosure are coupled:
  //    the candidate may not stand without the downstream lock it creates.
  const boardDualState = extractSection(
    boardText,
    BOARD_DUAL_STATE_HEADING,
    "W1 board §14.32.2 dual-state section",
  );
  assertNoForeignCommitIdentity(boardDualState, "W1 board §14.32.2");
  assertNoPromotionClaim(boardDualState, "W1 board §14.32.2 dual-state section");
  if (!boardText.includes(BOARD_STALE_LOCK_HEADING)) {
    throw new Error(
      "W1 board carries the W0-I01C candidate row but no §14.32.3 stale-lock " +
        "disclosure; the candidate and the downstream alert-context transport " +
        "stale-lock disclosure are coupled and must stand or fall together",
    );
  }
  // The corpus-level count rule runs before the byte-exact pin so a restored
  // "14 transport fixtures" claim reports the withdrawn figure by name rather
  // than the generic drifted-block message.
  assertTransportFixtureCount(boardText, "W1 board");
  assertPinnedBlock(
    boardText,
    BOARD_STALE_LOCK_BLOCK,
    "W1 board §14.32.3 stale-lock disclosure must stay pinned byte-exact: the " +
      "`source_member_set_digest` still `e4cfbf8c…` on `4d5fb4b`/`a976a20`, the " +
      `fail-closed transport validator, the measured ${TRANSPORT_FIXTURE_COUNT} ` +
      `declared fixtures with ${TRANSPORT_FIXTURES_CARRYING_FLAG} carrying ` +
      `\`include_descendants\` across ${TRANSPORT_FLAG_OCCURRENCES} ` +
      "occurrences all `false` and none `true`, and the path-disjoint " +
      "non-integrating W0-B05 limit",
  );

  // 5. The register's history-side note keeps the candidate out of the
  //    supersession chain.
  const registerNote = extractSection(
    e2RegisterText,
    REGISTER_CANDIDATE_NOTE_HEADING,
    "E2 register §4.4 candidate note",
  );
  // The byte-exact pin is checked first so a drifted note reports the specific
  // disclosure it lost, rather than the generic promotion-claim message.
  assertPinnedBlock(
    e2RegisterText,
    REGISTER_CANDIDATE_NOTE_BLOCK,
    "E2 register §4.4 must keep the pending candidate value disclosure — " +
      `\`sha256:${W1_C1_CANDIDATE_MEMBER_SET}\` is a **pending candidate ` +
      "value**, not a superseding value",
  );
  assertNoPromotionClaim(registerNote, "E2 register §4.4 candidate note");

  // 6. The packet keeps the graph, the aggregate label and both NO-GOs.
  const packetDualState = extractSection(
    packetText,
    PACKET_DUAL_STATE_HEADING,
    "The blocker-4 packet §2.9 dual-state provenance section",
  );
  assertNoPromotionClaim(
    packetDualState,
    "The blocker-4 packet §2.9 dual-state section",
  );
  assertPinnedBlock(
    packetText,
    PACKET_COMMIT_GRAPH_BLOCK,
    "blocker-4 packet §2.9 must keep the commit-graph block byte-exact — LINE 2 " +
      "**extended, not rewritten**, totally ordered `3a2c715` → `4d5fb4b` → " +
      "`a976a20` → `20cfa36` → `7185739`, with the W1-C1 correction the node " +
      "`20cfa36` and the W1-G1 correction the node `7185739`, both local-only, " +
      "integrated nowhere and accepted by no contract gate",
  );
  const aggregateOccurrences = countOccurrences(
    packetText,
    W1_C1_CANDIDATE_WORKING_TREE_AGGREGATE,
  );
  if (aggregateOccurrences !== 1) {
    throw new Error(
      "blocker-4 packet names the candidate working-tree aggregate " +
        `${aggregateOccurrences} times; it must appear exactly once, inside the ` +
        "§2.9 label block that states its recipe and separates it from any " +
        "member-set or commit identity",
    );
  }
  assertPinnedBlock(
    packetText,
    PACKET_AGGREGATE_BLOCK,
    "blocker-4 packet §2.9 must keep the candidate working-tree aggregate label " +
      "block byte-exact — not a member-set digest, not a commit identity, not " +
      "part of the accepted C1 artifact recipe, and reproduced by sorted " +
      "relative path + NUL + file bytes + NUL over the 16 modified tracked paths",
  );
  assertTransportFixtureCount(packetText, "blocker-4 packet");
  assertPinnedBlock(
    packetText,
    PACKET_TRANSPORT_LOCK_BLOCK,
    "blocker-4 packet §2.9 must keep the measured transport fixture disclosure " +
      `byte-exact — ${TRANSPORT_FIXTURE_COUNT} declared fixtures, ` +
      `${TRANSPORT_FIXTURES_CARRYING_FLAG} carrying \`include_descendants\` ` +
      `across ${TRANSPORT_FLAG_OCCURRENCES} occurrences all \`false\`, the ` +
      "`approval-required` and `kill-switch-denied` fixtures omitting it, and " +
      "none setting it `true`",
  );
  for (const { block, message } of PACKET_CANDIDATE_NO_GO_BLOCKS) {
    assertPinnedBlock(packetText, block, message);
  }

  return {
    lane: W1_C1_CANDIDATE_LANE,
    lifecycle: W1_C1_CANDIDATE_LIFECYCLE,
    // Committed and accepted are independent axes: the correction is a real
    // local commit, and it is still accepted by nothing and integrated nowhere.
    committed: true,
    integrated: false,
    pushed: false,
    accepted: false,
    base: W1_C1_COMMIT,
    branch: W1_C1_CANDIDATE_BRANCH,
    memberSet: W1_C1_CANDIDATE_MEMBER_SET,
    memberCount: W1_C1_CANDIDATE_MEMBER_COUNT,
    dirtyPaths: W1_C1_CANDIDATE_DIRTY_PATHS,
    staged: W1_C1_CANDIDATE_STAGED,
  };
}

function documentedOrderedPaths(sectionText) {
  return [...sectionText.matchAll(/^\d+\. `([^`]+)`$/gm)].map(
    ([, path]) => path,
  );
}

function assertOrderedPaths(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((path, index) => path !== expected[index])
  ) {
    throw new Error(
      `${label} must contain exactly ${expected.length} ordered paths; ` +
        `received ${actual.length}`,
    );
  }
}

function validateW1ReconciliationDocuments({
  boardText,
  e2RegisterText,
  adrReadmeText,
  packetText,
  w1C1ApplicationText,
  w1C2ApplicationText,
  w1ReconciliationApplicationText,
}) {
  assertPinnedBlock(
    w1ReconciliationApplicationText,
    `- **Lifecycle:** \`${W1_RECONCILIATION.lifecycle}\``,
    "W1 reconciliation application must carry the exact rehearsal-only lifecycle",
  );

  for (const value of [
    W1_RECONCILIATION.controlBase,
    W1_RECONCILIATION.c1Correction,
    W1_RECONCILIATION.c1g1Tip,
    W1_RECONCILIATION.correctedC2Tip,
    W1_RECONCILIATION.mergeOne,
    W1_RECONCILIATION.mergeOneTree,
    W1_RECONCILIATION.mergeTwo,
    W1_RECONCILIATION.mergeTwoTree,
    W1_RECONCILIATION.c1Digest,
    W1_RECONCILIATION.g1Digest,
    W1_RECONCILIATION.c2Digest,
    W1_RECONCILIATION.legacyBundleSha,
  ]) {
    assertIncludes(
      w1ReconciliationApplicationText,
      new RegExp(escapeRegExp(value)),
      `W1 reconciliation application is missing exact pin ${value}`,
    );
  }

  for (const historicalCommit of W1_RECONCILIATION_HISTORICAL_COMMITS) {
    assertIncludes(
      w1ReconciliationApplicationText,
      new RegExp(escapeRegExp(historicalCommit)),
      `W1 reconciliation application must preserve historical provenance ${historicalCommit}`,
    );
  }

  const controlSection = extractSection(
    w1ReconciliationApplicationText,
    "### CONTROL9",
    "W1 reconciliation application",
  );
  const ciSection = extractSection(
    w1ReconciliationApplicationText,
    "### CI3",
    "W1 reconciliation application",
  );
  assertOrderedPaths(
    documentedOrderedPaths(controlSection),
    W1_RECONCILIATION_CONTROL_PATHS,
    "W1 reconciliation CONTROL9 scope",
  );
  assertOrderedPaths(
    documentedOrderedPaths(ciSection),
    W1_RECONCILIATION_CI_PATHS,
    "W1 reconciliation CI3 scope",
  );
  const governanceSection = extractSection(
    w1ReconciliationApplicationText,
    "## 6. Delegated-governor disposition",
    "W1 reconciliation application",
  );
  assertPinnedBlock(
    governanceSection,
    `**Decision:** \`${W1_RECONCILIATION_GOVERNANCE.decision}\`.`,
    "W1 reconciliation application must carry the delegated-governor disposition",
  );
  assertIncludes(
    governanceSection,
    /authorizes exactly one local-only commit of the 12 paths in §4/,
    "W1 delegated-governor disposition must preserve the exact local-only commit authority",
  );
  assertIncludes(
    governanceSection,
    /does not claim a\s+completed post-remediation independent review/,
    "W1 delegated-governor disposition must disclose the incomplete independent re-review",
  );
  for (const value of [
    "0 Critical and 13 High",
    W1_RECONCILIATION_SECURITY.rootAdvisory,
    "blocks CI3 activation or push",
    "No dependency or lockfile byte is changed here",
  ]) {
    assertIncludes(
      governanceSection,
      new RegExp(escapeRegExp(value)),
      `W1 delegated-governor disposition must disclose dependency-audit fact: ${value}`,
    );
  }

  assertIncludes(
    w1C1ApplicationText,
    /^## 11\. 2026-07-30 corrected-state reconciliation$/m,
    "W1-C1 application must carry its corrected-state reconciliation",
  );
  for (const value of [
    W1_RECONCILIATION.c1Correction,
    W1_RECONCILIATION.c1g1Tip,
    W1_RECONCILIATION.c1Digest,
    W1_RECONCILIATION.g1Digest,
    W1_RECONCILIATION_HISTORICAL_COMMITS[0],
    W1_RECONCILIATION_HISTORICAL_COMMITS[1],
  ]) {
    assertIncludes(
      w1C1ApplicationText,
      new RegExp(escapeRegExp(value)),
      `W1-C1 reconciliation is missing pin ${value}`,
    );
  }
  assertIncludes(
    w1C2ApplicationText,
    /^## 13\. 2026-07-30 corrected Bundle reconciliation$/m,
    "W1-C2 application must carry its corrected Bundle reconciliation",
  );
  for (const value of [
    W1_RECONCILIATION.correctedC2Tip,
    W1_RECONCILIATION.c2Digest,
    W1_RECONCILIATION.legacyBundleSha,
    W1_RECONCILIATION_HISTORICAL_COMMITS[2],
  ]) {
    assertIncludes(
      w1C2ApplicationText,
      new RegExp(escapeRegExp(value)),
      `W1-C2 reconciliation is missing pin ${value}`,
    );
  }

  const currentSections = [
    [
      extractSection(
        boardText,
        "## 20. W1 C1/G1 + corrected C2 reconciliation rehearsal — 2026-07-30",
        "W1 board",
      ),
      "W1 board",
    ],
    [
      extractSection(
        e2RegisterText,
        "## 32. W1 C1/G1 + corrected C2 reconciliation evidence — 2026-07-30",
        "W1 E2 register",
      ),
      "W1 E2 register",
    ],
    [
      extractSection(
        packetText,
        "## 11. W1 C1/G1 + corrected C2 reconciliation rehearsal — 2026-07-30",
        "blocker-4 packet",
      ),
      "blocker-4 packet",
    ],
  ];
  for (const [section, label] of currentSections) {
    assertIncludes(
      section,
      new RegExp(escapeRegExp(W1_RECONCILIATION.lifecycle)),
      `${label} must carry the current rehearsal-only reconciliation lifecycle`,
    );
    assertExcludes(
      section,
      /\bCI:\s*NOT WIRED\b/i,
      `${label} falsely claims CI is not wired after the bounded CI3 draft`,
    );
    assertExcludes(
      section,
      /\b(?:canonical(?:ly)? integrated|pushed|released|runtime proven)\b/i,
      `${label} overclaims canonical integration, push, release or runtime proof`,
    );
    assertIncludes(
      section,
      new RegExp(escapeRegExp(W1_RECONCILIATION_GOVERNANCE.decision)),
      `${label} must carry the delegated-governor disposition`,
    );
  }

  assertIncludes(
    adrReadmeText,
    /\[W1-CONTRACT-RECONCILIATION-APPLICATION\.md\]\(W1-CONTRACT-RECONCILIATION-APPLICATION\.md\)/,
    "ADR catalog must index the W1 reconciliation application",
  );
  assertIncludes(
    w1ReconciliationApplicationText,
    /every published W0–W6 date and release milestone is unchanged/,
    "W1 reconciliation application must keep all release dates unchanged",
  );
  assertIncludes(
    w1ReconciliationApplicationText,
    /local stack, demo, UAT, POC and RC remain `NO-GO`/,
    "W1 reconciliation application must keep runtime and UAT NO-GO",
  );

  return {
    lifecycle: W1_RECONCILIATION.lifecycle,
    c1: {
      commit: W1_RECONCILIATION.c1Correction,
      tip: W1_RECONCILIATION.c1g1Tip,
      digest: W1_RECONCILIATION.c1Digest,
      pathCount: 16,
      tests: 21,
    },
    g1: {
      tip: W1_RECONCILIATION.c1g1Tip,
      digest: W1_RECONCILIATION.g1Digest,
      pathCount: 9,
      tests: 37,
    },
    c2: {
      tip: W1_RECONCILIATION.correctedC2Tip,
      digest: W1_RECONCILIATION.c2Digest,
      reconciliationPathCount: 7,
      packetPathCount: 32,
      memberCount: 30,
      tests: 40,
    },
    controlDraftPaths: W1_RECONCILIATION_CONTROL_PATHS.length,
    ciDraftPaths: W1_RECONCILIATION_CI_PATHS.length,
    governance: { ...W1_RECONCILIATION_GOVERNANCE },
    security: { ...W1_RECONCILIATION_SECURITY },
    canonical: false,
    pushed: false,
    runtimeProven: false,
  };
}

export function validateW1CiWiring({
  workflowText,
  packageText,
  orchestratorText,
}) {
  const packageDocument = JSON.parse(packageText);
  const expectedScripts = {
    "validate:w1:alert-context": "node validate-alert-context.mjs",
    "validate:w1:alert-context-transport":
      "node validate-alert-context-transport.mjs",
    "validate:w1:investigation-lifecycle":
      "node validate-investigation-lifecycle-proposal.mjs",
    "validate:dependency-compat":
      "node --test tests/dependency-compat.test.mjs",
    "test:w1-contracts": "node validate.mjs --test-w1-contracts",
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (packageDocument.scripts?.[name] !== command) {
      throw new Error(`CI3 package script ${name} is missing or drifted`);
    }
  }

  function workflowJob(name) {
    const heading = `  ${name}:\n`;
    const occurrences = countOccurrences(workflowText, heading);
    if (occurrences !== 1) {
      throw new Error(
        `CI3 workflow job ${name} must occur exactly once; found ${occurrences}`,
      );
    }
    const start = workflowText.indexOf(heading);
    const bodyStart = start + heading.length;
    const remainder = workflowText.slice(bodyStart);
    const nextJobOffset = remainder.search(/^  [a-zA-Z0-9_-]+:\n/m);
    return nextJobOffset === -1
      ? remainder
      : remainder.slice(0, nextJobOffset);
  }

  const contractsJob = workflowJob("contracts");
  const secretScanJob = workflowJob("secret-scan");
  for (const pattern of [
    /name: contract standards validation/,
    /name: Checkout contract topology/,
    /fetch-depth: 0/,
    /node-version: "24\.18\.1"/,
    /run: npm ci/,
    /run: npm audit --audit-level=high/,
    /run: npm run validate/,
    /run: npm run test:w1-contracts/,
  ]) {
    assertIncludes(
      contractsJob,
      pattern,
      `CI3 workflow contracts job is missing ${pattern}`,
    );
  }
  assertIncludes(
    secretScanJob,
    /name: secret-scan \(gitleaks 8\.30\.1\)/,
    "CI3 workflow must preserve the rendered secret-scan required-check name",
  );
  assertExcludes(
    workflowText,
    /^ {4,}if:\s*false\s*$/m,
    "CI3 workflow must not suppress a required job or step with if: false",
  );
  for (const pattern of [
    /fetch-depth: 0/,
    /gitleaks dir \./,
    /gitleaks git \./,
  ]) {
    assertIncludes(
      secretScanJob,
      pattern,
      `CI3 workflow secret-scan job is missing ${pattern}`,
    );
  }
  assertIncludes(
    workflowText,
    /^permissions:\n  contents: read$/m,
    "CI3 workflow must preserve read-only token permissions",
  );
  assertIncludes(
    workflowText,
    /^  secret-scan:$/m,
    "CI3 workflow must preserve the secret-scan job",
  );
  const permissionsBlocks = [...workflowText.matchAll(/^permissions:/gm)];
  if (permissionsBlocks.length !== 1) {
    throw new Error(
      "CI3 workflow must carry exactly one workflow-level permissions block",
    );
  }
  assertExcludes(
    workflowText,
    /^ {4}permissions:/m,
    "CI3 workflow must not add a job-scoped permissions override",
  );
  assertExcludes(
    workflowText,
    /\bwrite-all\b/,
    "CI3 workflow must not grant write-all permissions",
  );
  const actionLines = [
    ...workflowText.matchAll(
      /^[^\S\n]*uses:[^\S\n]*(\S+)(?:[^\S\n]+#.*)?[^\S\n]*$/gm,
    ),
  ];
  if (actionLines.length === 0) {
    throw new Error("CI3 workflow must contain pinned GitHub actions");
  }
  for (const [, action] of actionLines) {
    if (!/@[0-9a-f]{40}(?:\s|$)/.test(action)) {
      throw new Error(`CI3 workflow action is not pinned by commit SHA: ${action}`);
    }
  }
  assertExcludes(
    workflowText,
    /actions\/(?:checkout@11bd71901bbe5b1630ceea73d27597364c9af683|setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af)/,
    "CI3 workflow must not reintroduce a superseded Node 20 action-runtime pin",
  );
  if (actionLines.length !== 3) {
    throw new Error(
      `CI3 workflow must contain exactly 3 reviewed GitHub action uses; found ${actionLines.length}`,
    );
  }
  for (const [action, expectedCount] of CI_ACTION_PINS) {
    const actualCount = actionLines.filter(([, candidate]) => candidate === action).length;
    if (actualCount !== expectedCount) {
      throw new Error(
        `CI3 workflow action pin ${action} must occur exactly ${expectedCount} time${expectedCount === 1 ? "" : "s"}; found ${actualCount}`,
      );
    }
  }
  assertExcludes(
    workflowText,
    /members are all PROPOSED — NOT ACCEPTED/,
    "CI3 workflow must not retain the stale all-proposed lifecycle claim",
  );

  for (const validator of [
    "validate-alert-context.mjs",
    "validate-alert-context-transport.mjs",
    "validate-investigation-lifecycle-proposal.mjs",
  ]) {
    assertIncludes(
      orchestratorText,
      new RegExp(`['"]${escapeRegExp(validator)}['"]`),
      `canonical contract orchestrator is missing ${validator}`,
    );
  }
  assertIncludes(
    orchestratorText,
    /'\.\.\/\.\.\/tools\/operations\/validate-w1-control\.mjs'/,
    "canonical contract orchestrator must execute the live-Git W1 control validator",
  );
  assertIncludes(
    orchestratorText,
    /'tests\/dependency-compat\.test\.mjs'/,
    "canonical contract orchestrator must execute the dependency compatibility tests",
  );
  assertIncludes(
    orchestratorText,
    /static conformance only, not runtime or release proof/,
    "canonical contract orchestrator success banner must stay static-only",
  );
  assertIncludes(
    orchestratorText,
    /const W1_CONTRACT_TEST_COUNT = 98;/,
    "canonical contract orchestrator must pin the exact W1 test count",
  );
  assertIncludes(
    orchestratorText,
    /matchAll\(\/\^\(\?:#\|ℹ\) tests \(\\d\+\)\$\/gm\)/,
    "canonical contract orchestrator must measure the completed TAP test count",
  );
  assertIncludes(
    orchestratorText,
    /counts\.length !== 1 \|\| counts\[0\] !== W1_CONTRACT_TEST_COUNT/,
    "canonical contract orchestrator must fail closed on count drift",
  );

  return {
    validators: 3,
    tests: 98,
    fetchDepth: 0,
    node: "24.18.1",
    dependencyCompatibilityTests: 2,
    dependencyAuditLevel: "high",
    hostedRunClaimed: false,
  };
}

export function validateW1ReconciliationTopology(snapshot) {
  const expected = {
    mergeOneParents: [
      W1_RECONCILIATION.controlBase,
      W1_RECONCILIATION.c1g1Tip,
    ],
    mergeOneTree: W1_RECONCILIATION.mergeOneTree,
    mergeTwoParents: [
      W1_RECONCILIATION.mergeOne,
      W1_RECONCILIATION.correctedC2Tip,
    ],
    mergeTwoTree: W1_RECONCILIATION.mergeTwoTree,
  };
  for (const [key, value] of Object.entries(expected)) {
    const actual = snapshot[key];
    const matches = Array.isArray(value)
      ? Array.isArray(actual) &&
        actual.length === value.length &&
        actual.every((item, index) => item === value[index])
      : actual === value;
    if (!matches) {
      throw new Error(
        `W1 reconciliation live Git ${key} is wrong; expected ` +
          `${JSON.stringify(value)}, received ${JSON.stringify(actual)}`,
      );
    }
  }
  if (!snapshot.ancestryComplete) {
    throw new Error(
      "W1 reconciliation live Git ancestry is incomplete or in the wrong direction",
    );
  }
  if (!snapshot.headDescendsFromRehearsal) {
    throw new Error(
      "W1 reconciliation live Git repository HEAD does not descend from the exact rehearsal tip",
    );
  }
  return {
    controlBase: W1_RECONCILIATION.controlBase,
    c1g1Tip: W1_RECONCILIATION.c1g1Tip,
    correctedC2Tip: W1_RECONCILIATION.correctedC2Tip,
    mergeOne: W1_RECONCILIATION.mergeOne,
    mergeOneTree: W1_RECONCILIATION.mergeOneTree,
    mergeTwo: W1_RECONCILIATION.mergeTwo,
    mergeTwoTree: W1_RECONCILIATION.mergeTwoTree,
    repositoryHeadDescendsFromRehearsal: true,
    locallyIntegrated: true,
    canonical: false,
  };
}

function runGitRead(repositoryRoot, args, label) {
  const result = spawnSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `W1 reconciliation live Git ${label} failed closed: ` +
        `${result.stderr.trim() || `exit ${result.status}`}`,
    );
  }
  return result.stdout.trim();
}

export function readW1ReconciliationTopology(repositoryRoot) {
  for (const objectId of [
    W1_RECONCILIATION.controlBase,
    W1_RECONCILIATION.c1g1Tip,
    W1_RECONCILIATION.correctedC2Tip,
    W1_RECONCILIATION.mergeOne,
    W1_RECONCILIATION.mergeTwo,
  ]) {
    runGitRead(
      repositoryRoot,
      ["cat-file", "-e", `${objectId}^{commit}`],
      `required object ${objectId}`,
    );
  }

  const ancestryPairs = [
    [W1_RECONCILIATION.controlBase, W1_RECONCILIATION.mergeOne],
    [W1_RECONCILIATION.c1g1Tip, W1_RECONCILIATION.mergeOne],
    [W1_RECONCILIATION.mergeOne, W1_RECONCILIATION.mergeTwo],
    [W1_RECONCILIATION.correctedC2Tip, W1_RECONCILIATION.mergeTwo],
  ];
  let ancestryComplete = true;
  for (const [ancestor, descendant] of ancestryPairs) {
    try {
      runGitRead(
        repositoryRoot,
        ["merge-base", "--is-ancestor", ancestor, descendant],
        `ancestry ${ancestor} -> ${descendant}`,
      );
    } catch {
      ancestryComplete = false;
      break;
    }
  }
  let headDescendsFromRehearsal = true;
  try {
    runGitRead(
      repositoryRoot,
      [
        "merge-base",
        "--is-ancestor",
        W1_RECONCILIATION.mergeTwo,
        "HEAD",
      ],
      `ancestry ${W1_RECONCILIATION.mergeTwo} -> HEAD`,
    );
  } catch {
    headDescendsFromRehearsal = false;
  }

  return validateW1ReconciliationTopology({
    mergeOneParents: runGitRead(
      repositoryRoot,
      ["show", "-s", "--format=%P", W1_RECONCILIATION.mergeOne],
      "merge 1 parents",
    ).split(" "),
    mergeOneTree: runGitRead(
      repositoryRoot,
      ["rev-parse", `${W1_RECONCILIATION.mergeOne}^{tree}`],
      "merge 1 tree",
    ),
    mergeTwoParents: runGitRead(
      repositoryRoot,
      ["show", "-s", "--format=%P", W1_RECONCILIATION.mergeTwo],
      "merge 2 parents",
    ).split(" "),
    mergeTwoTree: runGitRead(
      repositoryRoot,
      ["rev-parse", `${W1_RECONCILIATION.mergeTwo}^{tree}`],
      "merge 2 tree",
    ),
    ancestryComplete,
    headDescendsFromRehearsal,
  });
}

export function validateW1ControlDocuments({
  boardText,
  roadmapText,
  gateA4Text,
  contractGateText,
  e2RegisterText,
  adr0003Text,
  adr0005Text,
  adr0003ApplicationText,
  adr0005ApplicationText,
  w1C1ApplicationText,
  w1C2ApplicationText,
  w1ReconciliationApplicationText,
  sprintText,
  adrReadmeText,
  packetText,
}) {
  const { taskIds, categoryCounts } = parseBoardTasks(boardText);
  validateBoardGates(boardText);
  validateBoardGateA4Record(boardText);
  validateBoardFinalEvidence(boardText);
  validateRoadmapDates(roadmapText);
  const gateA4Counts = validateGateA4(gateA4Text);
  const adr0003 = validateAcceptedAdr(adr0003Text, "ADR-0003");
  const adr0005 = validateAcceptedAdr(adr0005Text, "ADR-0005");
  validateAppliedApplication(adr0003ApplicationText, { adr: "ADR-0003" });
  validateAppliedApplication(adr0005ApplicationText, { adr: "ADR-0005" });
  validateAdr0005ApplicationS4Rule(adr0005ApplicationText);
  const contractGateCounts = validateContractGate(contractGateText);
  const [w1C1, w1C2] = [
    validateW1ContractApplication(
      w1C1ApplicationText,
      APPLIED_W1_CONTRACT_APPLICATIONS[0],
    ),
    validateW1ContractApplication(
      w1C2ApplicationText,
      APPLIED_W1_CONTRACT_APPLICATIONS[1],
    ),
  ];
  validateW1C2ApplicationRider(w1C2ApplicationText);
  validateE2Register(e2RegisterText);
  validateSprint(sprintText);
  validateAdrCatalog(adrReadmeText);
  const w1C1Candidate = validateDualStateW1C1Provenance({
    e2RegisterText,
    boardText,
    packetText,
  });
  const line1Publication = validatePacketLine1Publication(packetText);
  const { line2Publication, socPublication } =
    validatePacketMovedLinePublication(packetText);
  const pushDelta = validatePacketPushDelta(packetText);
  const enforcementSurface = validatePacketEnforcementSurface(packetText);
  const w1ReconciliationApplication = validateW1ReconciliationDocuments({
    boardText,
    e2RegisterText,
    adrReadmeText,
    packetText,
    w1C1ApplicationText,
    w1C2ApplicationText,
    w1ReconciliationApplicationText,
  });

  // Design C's own invariant: the prediction is derived, never asserted. If a
  // future edit replaces the derivation with a literal, this fails closed
  // before any document is consulted.
  if (
    PACKET_LINE1_PREDICTED_NEW_COMMITS !==
    PACKET_LINE1_BASE_NEW_COMMITS + PACKET_LANE_COMMITS_AHEAD_OF_BASE
  ) {
    throw new Error(
      "the predicted Suite LINE 1 count must be derived as the base " +
        "measurement plus this lane's offset, never written as a literal",
    );
  }

  assertNoPresentTenseBaseClaim(packetText);

  const localProvenanceSections = [
    [packetText, PACKET_LOCAL_PROVENANCE_HEADING, "blocker-4 packet §2.10"],
    [boardText, BOARD_LOCAL_PROVENANCE_HEADING, "W1 board §14.35"],
    [e2RegisterText, REGISTER_LOCAL_PROVENANCE_HEADING, "E2 register §27"],
  ];
  const localProvenance = localProvenanceSections.map(
    ([text, heading, label]) =>
      validateLane5LocalProvenance(text, heading, label),
  );

  for (const [text, label] of [
    [packetText, "blocker-4 packet"],
    [boardText, "W1 board"],
    [e2RegisterText, "E2 register"],
  ]) {
    assertNoUndatedGenerationClaim(text, label);
    assertNoLane5SelfIdentity(text, label);
  }

  // The legacy guarded regions keep their narrow allowlist.
  assertNoLane5Identity(
    extractSection(
      packetText,
      PACKET_DUAL_STATE_HEADING,
      "The blocker-4 packet §2.9 dual-state provenance section",
    ),
    "blocker-4 packet §2.9",
  );
  assertNoLane5Identity(
    extractSection(
      e2RegisterText,
      REGISTER_CANDIDATE_NOTE_HEADING,
      "E2 register §4.4 candidate note",
    ),
    "E2 register §4.4",
  );
  assertNoLane5Identity(
    extractSection(
      boardText,
      BOARD_DUAL_STATE_HEADING,
      "W1 board §14.32.2 dual-state section",
    ),
    "W1 board §14.32.2",
  );

  return {
    taskCount: taskIds.length,
    categoryCounts,
    gateA4Counts,
    contractGateCounts,
    gateA4Disposition: {
      accepted: true,
      acceptedOn: GATE_A4_ACCEPTED_ON,
      adr0003,
      adr0005,
      implementationAuthority: false,
    },
    contractGateDisposition: {
      accepted: true,
      acceptedOn: ACCEPTED_ON,
      pushed: false,
      merged: false,
      released: false,
      w1C1,
      w1C2,
    },
    // Derived separately from `contractGateDisposition`: the correction
    // candidate is *not* part of the accepted contract gate, and folding it in
    // there would be the very conflation these rules exist to prevent.
    w1C1CandidateDisposition: w1C1Candidate,
    w1ReconciliationApplication,
    // The Suite LINE 1 publication measurement taken at the immutable base,
    // with this lane's offset and the derived post-commit prediction. Proposed
    // only — nothing here is push authority, and no self identity is stated.
    line1Publication,
    // LINE 2 and SOC both moved this lane, so both now carry the same
    // §2.8 ↔ §7.1 agreement requirement Suite LINE 1 already had.
    line2Publication,
    socPublication,
    // Four reviewed commits that exist locally and nowhere else.
    localProvenance: {
      rows: localProvenance[0].rows,
      lanes: LANE5_PROVENANCE_ROWS.map(({ lane }) => lane),
      integrated: false,
      pushed: false,
      merged: false,
      released: false,
      contractReaccepted: false,
    },
    // §2.8's six per-line counts, summed from the rows themselves, alongside
    // the separately measured unique union they are not.
    pushDelta,
    // Pure document validation is injectable for negative fixtures and has
    // not itself spawned Git. The canonical file wrapper replaces this flag
    // with true only after exact live-object and topology validation passes.
    enforcementSurface,
  };
}

const CONTROL_DOCUMENT_PATHS = {
  boardText: ["docs", "operations", "W1-48-AGENT-ROLLING-BOARD.md"],
  roadmapText: ["docs", "strategy", "06-ROADMAP-2026-2029.md"],
  gateA4Text: ["docs", "adr", "FOUNDER-DECISION-PACKET-WAVE-2.md"],
  contractGateText: ["docs", "adr", "FOUNDER-DECISION-PACKET-W1-C1-C2.md"],
  e2RegisterText: ["docs", "operations", "W1-E2-EVIDENCE-REGISTER.md"],
  adr0003Text: ["docs", "adr", "ADR-0003-durable-agent-orchestration.md"],
  adr0005Text: ["docs", "adr", "ADR-0005-sandbox-substrate.md"],
  adr0003ApplicationText: ["docs", "adr", "ADR-0003-STATUS-FLIP-APPLICATION.md"],
  adr0005ApplicationText: ["docs", "adr", "ADR-0005-STATUS-FLIP-APPLICATION.md"],
  w1C1ApplicationText: [
    "docs",
    "adr",
    "W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md",
  ],
  w1C2ApplicationText: [
    "docs",
    "adr",
    "W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md",
  ],
  w1ReconciliationApplicationText: [
    "docs",
    "adr",
    "W1-CONTRACT-RECONCILIATION-APPLICATION.md",
  ],
  sprintText: ["docs", "adr", "ADR-DECISION-SPRINT-2026-07.md"],
  adrReadmeText: ["docs", "adr", "README.md"],
  packetText: [
    "docs",
    "operations",
    "W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md",
  ],
  workflowText: [".github", "workflows", "contracts.yml"],
  packageText: ["tools", "contract-validation", "package.json"],
  orchestratorText: ["tools", "contract-validation", "validate.mjs"],
};

export async function validateW1ControlFiles(repositoryRoot) {
  const entries = Object.entries(CONTROL_DOCUMENT_PATHS);
  const texts = await Promise.all(
    entries.map(([, segments]) =>
      readFile(join(repositoryRoot, ...segments), "utf8"),
    ),
  );
  const documents = Object.fromEntries(
    entries.map(([key], index) => [key, texts[index]]),
  );

  const result = validateW1ControlDocuments(documents);
  const ciWiring = validateW1CiWiring(documents);
  const reconciliationTopology = readW1ReconciliationTopology(repositoryRoot);

  return {
    ...result,
    enforcementSurface: {
      ...result.enforcementSurface,
      readsLiveGit: true,
    },
    ciWiring,
    reconciliationTopology,
  };
}

async function main() {
  const toolDirectory = dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = join(toolDirectory, "..", "..");
  const result = await validateW1ControlFiles(repositoryRoot);
  process.stdout.write(
    `W1 control PASS: tasks=${result.taskCount}, ` +
      `categories=${JSON.stringify(result.categoryCounts)}, ` +
      `GATE_A4=${JSON.stringify(result.gateA4Counts)}, ` +
      `CONTRACT_GATE=${JSON.stringify(result.contractGateCounts)}, ` +
      `GATE_A4_DISPOSITION=${JSON.stringify(result.gateA4Disposition)}, ` +
      `CONTRACT_GATE_DISPOSITION=${JSON.stringify(result.contractGateDisposition)}, ` +
      `W1_C1_CANDIDATE=${JSON.stringify(result.w1C1CandidateDisposition)}, ` +
      `W1_RECONCILIATION=${JSON.stringify(result.w1ReconciliationApplication)}, ` +
      `W1_TOPOLOGY=${JSON.stringify(result.reconciliationTopology)}, ` +
      `W1_CI=${JSON.stringify(result.ciWiring)}, ` +
      `LINE1_PUBLICATION=${JSON.stringify(result.line1Publication)}, ` +
      `PUSH_DELTA=${JSON.stringify(result.pushDelta)}, ` +
      `ENFORCEMENT_SURFACE=${JSON.stringify(result.enforcementSurface)}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
