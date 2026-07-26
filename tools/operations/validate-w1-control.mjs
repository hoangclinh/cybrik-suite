#!/usr/bin/env node

import { readFile } from "node:fs/promises";
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
  sprintText,
  adrReadmeText,
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
  sprintText: ["docs", "adr", "ADR-DECISION-SPRINT-2026-07.md"],
  adrReadmeText: ["docs", "adr", "README.md"],
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

  return validateW1ControlDocuments(documents);
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
      `CONTRACT_GATE_DISPOSITION=${JSON.stringify(result.contractGateDisposition)}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
