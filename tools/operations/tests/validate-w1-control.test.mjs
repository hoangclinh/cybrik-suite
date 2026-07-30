import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  readW1ReconciliationTopology,
  validateW1CiWiring,
  validateW1ControlDocuments,
  validateW1ControlFiles,
  validateW1ReconciliationTopology,
} from "../validate-w1-control.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, "..", "..", "..");
const boardPath = join(
  repositoryRoot,
  "docs",
  "operations",
  "W1-48-AGENT-ROLLING-BOARD.md",
);
const roadmapPath = join(
  repositoryRoot,
  "docs",
  "strategy",
  "06-ROADMAP-2026-2029.md",
);
const gateA4Path = join(
  repositoryRoot,
  "docs",
  "adr",
  "FOUNDER-DECISION-PACKET-WAVE-2.md",
);
const contractGatePath = join(
  repositoryRoot,
  "docs",
  "adr",
  "FOUNDER-DECISION-PACKET-W1-C1-C2.md",
);
const e2RegisterPath = join(
  repositoryRoot,
  "docs",
  "operations",
  "W1-E2-EVIDENCE-REGISTER.md",
);
const adr0003Path = join(
  repositoryRoot,
  "docs",
  "adr",
  "ADR-0003-durable-agent-orchestration.md",
);
const adr0005Path = join(
  repositoryRoot,
  "docs",
  "adr",
  "ADR-0005-sandbox-substrate.md",
);
const adr0003ApplicationPath = join(
  repositoryRoot,
  "docs",
  "adr",
  "ADR-0003-STATUS-FLIP-APPLICATION.md",
);
const adr0005ApplicationPath = join(
  repositoryRoot,
  "docs",
  "adr",
  "ADR-0005-STATUS-FLIP-APPLICATION.md",
);
const w1C1ApplicationPath = join(
  repositoryRoot,
  "docs",
  "adr",
  "W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md",
);
const w1C2ApplicationPath = join(
  repositoryRoot,
  "docs",
  "adr",
  "W1-C2-INVESTIGATION-LIFECYCLE-ACCEPTANCE-APPLICATION.md",
);
const w1ReconciliationApplicationPath = join(
  repositoryRoot,
  "docs",
  "adr",
  "W1-CONTRACT-RECONCILIATION-APPLICATION.md",
);
const sprintPath = join(
  repositoryRoot,
  "docs",
  "adr",
  "ADR-DECISION-SPRINT-2026-07.md",
);
const adrReadmePath = join(repositoryRoot, "docs", "adr", "README.md");
const packetPath = join(
  repositoryRoot,
  "docs",
  "operations",
  "W1-BLOCKER-4-CANONICAL-INTEGRATION-PACKET.md",
);

const [
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
] = await Promise.all([
  readFile(boardPath, "utf8"),
  readFile(roadmapPath, "utf8"),
  readFile(gateA4Path, "utf8"),
  readFile(contractGatePath, "utf8"),
  readFile(e2RegisterPath, "utf8"),
  readFile(adr0003Path, "utf8"),
  readFile(adr0005Path, "utf8"),
  readFile(adr0003ApplicationPath, "utf8"),
  readFile(adr0005ApplicationPath, "utf8"),
  readFile(w1C1ApplicationPath, "utf8"),
  readFile(w1C2ApplicationPath, "utf8"),
  readFile(w1ReconciliationApplicationPath, "utf8"),
  readFile(sprintPath, "utf8"),
  readFile(adrReadmePath, "utf8"),
  readFile(packetPath, "utf8"),
]);

// Post-acceptance identities, independently recomputed from the committed bytes
// of each accepted local commit.
const W1_C1_COMMIT = "3a2c71555a423465855ffaddcb663c8b704dbfbd";
const W1_C2_COMMIT = "ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4";
const W1_CANDIDATE_PARENT = "3ef8e0536f8210f2739c6fa0e32e37f8dc27d619";
const W1_C1_FINAL_DIGEST =
  "e4cfbf8c6f6ccfe545a91d63b0bee6de4c616a28e3f1a61c320f8fde747e1d35";
const W1_C2_FINAL_DIGEST =
  "0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e";

// Superseded pre-acceptance candidate pins. They stay readable in dated history
// sections but must never reappear inside a live evidence row.
const STALE_W1_C1_PINS = [
  "ce9921d33fc0947efa9e1cf4e588470283e875b7c5f35216cd9e713ee80bb04a",
  "cd872a0e8d25c8de6224bf5f9aecaeba795836cee77355d416690ee47524502c",
];
const STALE_W1_C2_PINS = [
  "f79702c6bed92804259354fde14980dc70ca55611265c86bda79316223959077",
  "16099c17f01e7410e87860f5d9ce084a7fa8e2cad0a3e59b90a1ccb66643dd6f",
];

// ── Dual-state W1-C1 provenance fixtures ──────────────────────────────────
//
// The accepted baseline and the W0-I01C correction candidate are two disjoint
// states of the same lane. Every drift fixture below targets the *candidate*
// anchors, which are unique by construction, so no mutation can silently land
// on an accepted literal by first-occurrence replacement.
// The correction is a commit now — local-only, integrated nowhere, accepted by
// no contract gate. `committed` and `accepted` are independent axes, so the
// fixtures below track the committed generation and never call it uncommitted.
const W1_C1_CANDIDATE_LIFECYCLE =
  "CORRECTION COMMITTED — LOCAL-ONLY — NOT INTEGRATED — NOT ACCEPTED";
const W1_C1_CANDIDATE_BRANCH = "codex/w1-c1-correction-a2-r1";
const W1_C1_CANDIDATE_COMMIT_ABBREV = "20cfa36";
const W1_C1_CANDIDATE_COMMIT_PARENT_ABBREV = "a976a20";
const W1_C1_CANDIDATE_TREE_ABBREV = "380a8f7";
const W1_C1_CANDIDATE_MEMBER_SET =
  "27a6bdeb168599dc4fd05e27f06785315a3b763647826559efe9d721bc0292c8";
const W1_C1_CANDIDATE_AGGREGATE =
  "76ef51d97dced58eda98b1144ca72f98cf81c7caff6cc51ffc3eab50114c940a";
const W1_C1_CANDIDATE_ROW =
  "| W0-I01C — W1-C1 alert-context correction candidate | " +
  `committed local-only at \`${W1_C1_CANDIDATE_COMMIT_ABBREV}\`, parent ` +
  `\`${W1_C1_CANDIDATE_COMMIT_PARENT_ABBREV}\`, tree ` +
  `\`${W1_C1_CANDIDATE_TREE_ABBREV}\`, branch ` +
  `\`${W1_C1_CANDIDATE_BRANCH}\`, on accepted base \`${W1_C1_COMMIT}\` | ` +
  `\`${W1_C1_CANDIDATE_LIFECYCLE}\`; exactly 16 paths, zero staged | ` +
  "candidate `member_set` " +
  `\`sha256:${W1_C1_CANDIDATE_MEMBER_SET}\` (\`MEMBER-SET-SHA256/v1\`, 13/13 ` +
  "member hashes, `member_count` 13); standalone validator `PASS`; candidate " +
  "suite 21/21; 86.99% branch coverage against the declared 80% branch floor; " +
  "independent review `PASS`, no open P0–P2; the downstream alert-context " +
  "transport stale lock is disclosed with this candidate |";

// Replace a fixture string that must be unique in the document. Guards against
// the first-occurrence `.replace` hazard: a drift fixture that silently matched
// a second, unintended site would make the assertion meaningless.
function replaceUnique(text, needle, replacement) {
  const occurrences = text.split(needle).length - 1;
  assert.equal(
    occurrences,
    1,
    `drift fixture anchor is not unique (${occurrences} occurrences): ${needle.slice(0, 96)}`,
  );
  return text.replace(needle, replacement);
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function validate(overrides = {}) {
  return validateW1ControlDocuments({
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
    ...overrides,
  });
}

test("accepts the current fixed 48-agent W1 control documents", () => {
  const result = validate();

  assert.equal(result.taskCount, 48);
  assert.deepEqual(result.categoryCounts, {
    I: 12,
    T: 12,
    R: 6,
    S: 5,
    B: 5,
    IR: 4,
    D: 4,
  });
  assert.deepEqual(result.gateA4Counts, { H: 11, J: 10 });
  assert.deepEqual(result.contractGateCounts, { C1: 10, C2: 10 });
  assert.deepEqual(result.gateA4Disposition, {
    accepted: true,
    acceptedOn: "2026-07-26",
    adr0003: "ACCEPTED",
    adr0005: "ACCEPTED",
    implementationAuthority: false,
  });
  assert.deepEqual(result.contractGateDisposition, {
    accepted: true,
    acceptedOn: "2026-07-26",
    pushed: false,
    merged: false,
    released: false,
    w1C1: {
      commit: W1_C1_COMMIT,
      parent: W1_CANDIDATE_PARENT,
      pathCount: 16,
      digest: W1_C1_FINAL_DIGEST,
    },
    w1C2: {
      commit: W1_C2_COMMIT,
      parent: W1_CANDIDATE_PARENT,
      pathCount: 32,
      digest: W1_C2_FINAL_DIGEST,
    },
  });
});

//
// Historical provenance must survive. This is the regression guard for the
// defect where a global `NOT OPEN` exclusion rejected dated history sections.
//

test("accepts historical `NOT OPEN` and `PROPOSED` wording inside dated history sections", () => {
  const historySuffix =
    "\n## 99. Historical provenance — retained, not current status\n\n" +
    "As recorded on 2026-07-24, GATE A4 remains `NOT OPEN` and both ADRs remain " +
    "`PROPOSED — NOT DECIDED`.\nThat sentence is the state of the record on that date and is " +
    "superseded by the current status block above.\n";

  assert.doesNotThrow(() =>
    validate({ gateA4Text: gateA4Text + historySuffix }),
  );
  assert.doesNotThrow(() =>
    validate({
      contractGateText:
        contractGateText +
        "\n## 99. Historical provenance\n\nAs of 2026-07-25 the W1-C1/C2 contract gate was " +
        "`DECISION READY — CONTRACT GATE NOT OPEN` and both packets were " +
        "`PROPOSED — NOT ACCEPTED`.\n",
    }),
  );
  assert.doesNotThrow(() =>
    validate({
      sprintText:
        sprintText +
        "\n## 99. Historical provenance\n\nAs of 2026-07-25, ADR-0003/ADR-0005 remain `PROPOSED " +
        "— NOT DECIDED` and GATE A4 is NOT open.\n",
    }),
  );
  assert.doesNotThrow(() =>
    validate({
      adrReadmeText:
        adrReadmeText +
        "\nHistorical note (2026-07-25): ADR-0003/ADR-0005 remain `PROPOSED — NOT DECIDED`.\n",
    }),
  );
});

test("still rejects a reverted current-status block even though history may say NOT OPEN", () => {
  const drifted = gateA4Text.replace(
    "- **Status:** `ACCEPTED — GATE A4 CLOSED 2026-07-26 — STATUS FLIP APPLIED — " +
      "NO IMPLEMENTATION AUTHORITY`",
    "- **Status:** `DECISION READY — GATE A4 remains `NOT OPEN``",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /GATE A4.*ACCEPTED.*CLOSED 2026-07-26/i,
  );
});

test("rejects a current-status block that reasserts the pre-closure GATE A4 posture", () => {
  const drifted = gateA4Text.replace(
    "- **Decision scope:** decision record only — GATE A4 is closed and both ADRs are `ACCEPTED`,",
    "- **Decision scope:** GATE A4 remains `NOT OPEN` and both ADRs remain " +
      "`PROPOSED — NOT DECIDED`,",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /current status block.*NOT OPEN|GATE A4 is closed/i,
  );
});

//
// W1-C1/W1-C2 contract acceptance — current state, exact commit and digest pins.
//

test("rejects a W1 contract packet that reverts to the pre-acceptance gate status", () => {
  const drifted = contractGateText.replace(
    "- **Status:** `ACCEPTED — W1-C1/C2 CONTRACT GATE CLOSED 2026-07-26 — " +
      "LOCAL COMMITS ONLY — NOT PUSHED`",
    "- **Status:** `DECISION READY — CONTRACT GATE NOT OPEN`",
  );

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /contract gate.*ACCEPTED.*CLOSED 2026-07-26/i,
  );
});

test("rejects loss of the W1-C1 accepted local commit pin", () => {
  const drifted = contractGateText.replace(W1_C1_COMMIT, "0".repeat(40));

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /W1-C1.*accepted local commit/i,
  );
});

test("rejects loss of the W1-C2 accepted local commit pin", () => {
  const drifted = contractGateText.replace(W1_C2_COMMIT, "0".repeat(40));

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /W1-C2.*accepted local commit/i,
  );
});

test("rejects swapping the W1-C1 and W1-C2 accepted commits between rows", () => {
  const swapped = contractGateText
    .replace(W1_C1_COMMIT, "commit-swap-placeholder")
    .replace(W1_C2_COMMIT, W1_C1_COMMIT)
    .replace("commit-swap-placeholder", W1_C2_COMMIT);

  assert.throws(
    () => validate({ contractGateText: swapped }),
    /W1-C1.*accepted local commit/i,
  );
});

test("rejects drift in the shared parent commit of both accepted lanes", () => {
  const drifted = contractGateText.replaceAll(W1_CANDIDATE_PARENT, "f".repeat(40));

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /W1-C1.*parent/i,
  );
});

test("rejects drift in the W1-C1 final member-set digest", () => {
  const drifted = contractGateText.replace(W1_C1_FINAL_DIGEST, "0".repeat(64));

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /W1-C1.*digest/i,
  );
});

test("rejects drift in the W1-C2 final aggregate digest", () => {
  const drifted = contractGateText.replace(W1_C2_FINAL_DIGEST, "f".repeat(64));

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /W1-C2.*digest/i,
  );
});

test("rejects swapping the W1-C1 and W1-C2 final digests between rows", () => {
  const swapped = contractGateText
    .replace(W1_C1_FINAL_DIGEST, "digest-swap-placeholder")
    .replace(W1_C2_FINAL_DIGEST, W1_C1_FINAL_DIGEST)
    .replace("digest-swap-placeholder", W1_C2_FINAL_DIGEST);

  assert.throws(
    () => validate({ contractGateText: swapped }),
    /W1-C1.*digest/i,
  );
});

test("rejects reintroduction of any superseded W1-C1 aggregate in the live packet row", () => {
  for (const stale of STALE_W1_C1_PINS) {
    const drifted = contractGateText.replace(W1_C1_FINAL_DIGEST, stale);

    assert.throws(
      () => validate({ contractGateText: drifted }),
      /superseded.*W1-C1.*aggregate/i,
    );
  }
});

test("rejects reintroduction of any superseded W1-C2 aggregate in the live packet row", () => {
  for (const stale of STALE_W1_C2_PINS) {
    const drifted = contractGateText.replace(W1_C2_FINAL_DIGEST, stale);

    assert.throws(
      () => validate({ contractGateText: drifted }),
      /superseded.*W1-C2.*aggregate/i,
    );
  }
});

test("rejects reintroduction of superseded W1-C1 coverage or test-count pins", () => {
  const drifts = [
    ["87.27% branch coverage", "90.39% line coverage", /superseded.*W1-C1.*coverage/i],
    ["87.27% branch coverage", "87.87% branch coverage", /superseded.*W1-C1.*coverage/i],
    ["21/21 tests", "18/18 tests", /superseded.*W1-C1.*test count/i],
  ];

  for (const [pinned, stale, expectedError] of drifts) {
    const drifted = contractGateText.replace(pinned, stale);

    assert.throws(() => validate({ contractGateText: drifted }), expectedError);
  }
});

test("rejects reintroduction of superseded W1-C2 coverage or test-count pins", () => {
  const drifts = [
    ["97.44% branch coverage", "86.67% line coverage", /superseded.*W1-C2.*coverage/i],
    ["97.44% branch coverage", "97.39% branch coverage", /superseded.*W1-C2.*coverage/i],
    ["31/31 tests", "10/10 tests", /superseded.*W1-C2.*test count/i],
    ["31/31 tests", "29/29 tests", /superseded.*W1-C2.*test count/i],
  ];

  for (const [pinned, stale, expectedError] of drifts) {
    const drifted = contractGateText.replace(pinned, stale);

    assert.throws(() => validate({ contractGateText: drifted }), expectedError);
  }
});

test("rejects drift in the exact accepted path counts", () => {
  const c1Drift = contractGateText.replace("exactly 16 paths", "exactly 15 paths");
  const c2Drift = contractGateText.replace("exactly 32 paths", "exactly 33 paths");

  assert.throws(() => validate({ contractGateText: c1Drift }), /W1-C1.*16 paths/i);
  assert.throws(() => validate({ contractGateText: c2Drift }), /W1-C2.*32 paths/i);
});

test("rejects loss of the cross-lane W0-R05 and W0-T01 final review pins", () => {
  const reviewDrifts = [
    [
      "final independent review W0-R05 `PASS`, no open P0–P2",
      "independent review no open P0–P2",
      /W1-C1.*W0-R05 `PASS`/i,
    ],
    [
      "final independent review W0-T01 `PASS`, no open P0–P3",
      "independent review no open P0–P3",
      /W1-C2.*W0-T01 `PASS`/i,
    ],
  ];

  for (const [pinnedWording, driftedWording, expectedError] of reviewDrifts) {
    const drifted = contractGateText.replace(pinnedWording, driftedWording);

    assert.throws(() => validate({ contractGateText: drifted }), expectedError);
  }
});

//
// The Fable W0-R01 Option B rider.
//

test("rejects loss of the W0-R01 Option B LOW-advisory rider", () => {
  // The packet and the register carry the rider as an inline bold lead-in; the
  // W1-C2 application carries it as its own §9 heading. Each anchor is exact.
  const riderTexts = [
    [
      "contractGateText",
      contractGateText,
      "**Rider — W0-R01 Option B (Fable independent review).**",
      "**Note.**",
    ],
    [
      "e2RegisterText",
      e2RegisterText,
      "**Rider — W0-R01 Option B (Fable independent review).**",
      "**Note.**",
    ],
    [
      "w1C2ApplicationText",
      w1C2ApplicationText,
      "## 9. Rider — W0-R01 Option B (Fable independent review)",
      "## 9. Note",
    ],
  ];

  for (const [key, source, pinnedWording, driftedWording] of riderTexts) {
    const drifted = source.replace(pinnedWording, driftedWording);

    assert.notEqual(drifted, source);
    assert.throws(
      () => validate({ [key]: drifted }),
      /W0-R01 Option B rider/i,
    );
  }
});

test("rejects a rider that escalates or downgrades the disclosed LOW advisory", () => {
  const drifted = contractGateText.replace(
    "disclosed as a **LOW advisory** and changed **no accepted contract byte**",
    "disclosed as a **P1 defect** and rewrote accepted contract bytes",
  );

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /LOW advisory.*no accepted contract byte/i,
  );
});

test("rejects a rider that adopts Bundle v0.1.1 or supersedes v0.1.0", () => {
  const bundleDrifts = [
    [
      "Bundle v0.1.1 is only a proposed successor candidate",
      "Bundle v0.1.1 is the adopted successor",
      /v0\.1\.1.*proposed successor candidate/i,
    ],
    [
      "v0.1.0 remains the authoritative Bundle contract",
      "v0.1.1 supersedes v0.1.0 immediately",
      /v0\.1\.0.*authoritative/i,
    ],
    [
      "adoption, supersession and consumer migration require separate future authority",
      "adoption, supersession and consumer migration may proceed without further approval",
      /adoption.*supersession.*consumer migration.*separate/i,
    ],
  ];

  for (const [pinnedWording, driftedWording, expectedError] of bundleDrifts) {
    const drifted = contractGateText.replace(pinnedWording, driftedWording);

    assert.throws(() => validate({ contractGateText: drifted }), expectedError);
  }
});

//
// Contract acceptance applications — APPLIED/ACCEPTED, with their own guards.
//

test("rejects a W1 contract application that is not recorded as APPLIED", () => {
  const applicationDrifts = [
    [
      "w1C1ApplicationText",
      w1C1ApplicationText,
      "- **Status:** `APPLIED 2026-07-26 — W1-C1 CONTRACT ACCEPTANCE RECORDED — " +
        "LOCAL COMMIT ONLY — NO PUSH, MERGE OR RELEASE AUTHORITY`",
      "- **Status:** `APPLICATION READY ONLY — NOT ACCEPTED — NO CONTRACT STATUS FLIP`",
      /W1-C1 application.*APPLIED 2026-07-26/i,
    ],
    [
      "w1C2ApplicationText",
      w1C2ApplicationText,
      "- **Status:** `APPLIED 2026-07-26 — W1-C2 CONTRACT ACCEPTANCE RECORDED — " +
        "LOCAL COMMIT ONLY — NO PUSH, MERGE OR RELEASE AUTHORITY`",
      "- **Status:** `APPLICATION READY ONLY — NOT ACCEPTED — NO CONTRACT STATUS FLIP`",
      /W1-C2 application.*APPLIED 2026-07-26/i,
    ],
  ];

  for (const [key, source, pinned, driftedWording, expectedError] of applicationDrifts) {
    const drifted = source.replace(pinned, driftedWording);

    assert.throws(() => validate({ [key]: drifted }), expectedError);
  }
});

test("rejects a W1 contract application that claims push, merge or release authority", () => {
  // The two resulting-status blocks are not byte-identical: the W1-C2 lane also
  // disclaims `server` authority and wraps one word later.
  const drifts = [
    [
      "w1C1ApplicationText",
      w1C1ApplicationText,
      "  v1/GA; contract-first implementation basis only; no runtime, dependency, database,\n" +
        "  container, endpoint, transport, CI-wiring, push, merge, deployment or release authority\n" +
        "  follows",
      /W1-C1 application.*not stable v1\/GA.*no runtime/i,
    ],
    [
      "w1C2ApplicationText",
      w1C2ApplicationText,
      "  v1/GA; contract-first implementation basis only; no runtime, dependency, database,\n" +
        "  container, endpoint, server, transport, CI-wiring, push, merge, deployment or release\n" +
        "  authority follows",
      /W1-C2 application.*not stable v1\/GA.*no runtime/i,
    ],
  ];

  for (const [key, source, pinnedWording, expectedError] of drifts) {
    const drifted = source.replace(
      pinnedWording,
      "  v1/GA; push, merge, deployment and release may now proceed",
    );

    assert.notEqual(drifted, source);
    assert.throws(() => validate({ [key]: drifted }), expectedError);
  }
});

test("rejects a W1 contract application that drops its accepted commit pin", () => {
  const drifts = [
    ["w1C1ApplicationText", w1C1ApplicationText, W1_C1_COMMIT, /W1-C1 application.*commit/i],
    ["w1C2ApplicationText", w1C2ApplicationText, W1_C2_COMMIT, /W1-C2 application.*commit/i],
  ];

  for (const [key, source, commit, expectedError] of drifts) {
    const drifted = source.replaceAll(commit, "0".repeat(40));

    assert.throws(() => validate({ [key]: drifted }), expectedError);
  }
});

test("rejects packet or register rows that leave the applications at APPLICATION READY ONLY", () => {
  const drifts = [
    [
      "contractGateText",
      contractGateText,
      /contract gate.*W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION\.md.*APPLIED 2026-07-26/i,
    ],
    [
      "e2RegisterText",
      e2RegisterText,
      /E2 register.*W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION\.md.*APPLIED 2026-07-26/i,
    ],
  ];

  for (const [key, source, expectedError] of drifts) {
    const drifted = source.replace(
      "| `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` | `APPLIED 2026-07-26` |",
      "| `docs/adr/W1-C1-ALERT-CONTEXT-ACCEPTANCE-APPLICATION.md` | `APPLICATION READY ONLY` |",
    );

    assert.throws(() => validate({ [key]: drifted }), expectedError);
  }
});

//
// W0 / runtime / release guards must survive the contract acceptance.
//

test("rejects loss of the packet W0 COMPLETE=0 and runtime HOLD posture", () => {
  const drifted = contractGateText.replace(
    "`W0 COMPLETE=0` and W0 closure `NO-GO`. W1 runtime writers remain " +
      "`HOLD`/`NO-GO`.",
    "`W0 COMPLETE=1` and W0 closure `GO`. W1 runtime writers are `GO`.",
  );

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /W0 COMPLETE=0.*runtime writers.*HOLD/i,
  );
});

test("rejects a contract gate that claims push, merge or release authority", () => {
  const drifted = contractGateText.replace(
    "- Nothing was pushed, merged or released. The two accepted packets exist only as local\n" +
      "  commits on their own branches; publication, merge to `main`, release and release-date\n" +
      "  authority each remain separate Founder decisions.",
    "- The accepted packets were pushed and merged to `main`, and release may proceed.",
  );

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /nothing was pushed, merged or released/i,
  );
});

test("rejects a contract gate that promotes W1 product or runtime writers", () => {
  const drifted = contractGateText.replace(
    "- Contract acceptance opened no product or runtime writer. SOC, Cyber AI and Fabric W1\n" +
      "  writers remain `HOLD` until their own exact repo/base/path/test/reviewer authority.",
    "- Contract acceptance opened the SOC, Cyber AI and Fabric W1 writers.",
  );

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /opened no product or runtime writer/i,
  );
});

test("rejects loss of the contract-gate CI NOT WIRED disclosure", () => {
  const drifted = contractGateText.replace("**CI: NOT WIRED**", "**CI: GREEN**");

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /contract gate.*CI: NOT WIRED/i,
  );
});

test("rejects a change to the fixed release window in the contract gate", () => {
  const drifted = contractGateText.replace(
    "2026-12-21 → 2026-12-31",
    "2026-12-14 → 2026-12-24",
  );

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /release window/i,
  );
});

//
// Decision-row wording guards retained from the pre-acceptance gate.
//

test("rejects a missing or duplicate C1/C2 decision", () => {
  const drifted = contractGateText.replace("| C2-10 |", "| C2-9 |");

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /exact C2-1-C2-10/i,
  );
});

test("rejects reintroduction of the unsupported C1-7 source-marking floor", () => {
  const drifted = contractGateText.replace(
    "| C1-7 | **Yes** — result marking never exceeds request clearance; no authoritative " +
      "source-marking floor is claimed by this packet |",
    "| C1-7 | **Yes** — result marking never exceeds request clearance and never downgrades " +
      "authoritative source marking |",
  );

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /C1-7.*source-marking floor/i,
  );
});

test("rejects re-conflation of C2-5 marking with identity/policy-derived scope", () => {
  const drifted = contractGateText.replace(
    "| C2-5 | **Yes** — tenant/org/actor scope derives from authenticated identity/policy and " +
      "advisory body values never expand scope; marking is an authoritative request input and " +
      "artifact marking never downgrades |",
    "| C2-5 | **Yes** — authoritative tenant/org/actor/marking derive from authenticated " +
      "identity/policy; advisory body values never expand scope |",
  );

  assert.throws(
    () => validate({ contractGateText: drifted }),
    /C2-5.*separate.*identity\/policy.*marking/i,
  );
});

test("rejects weakening of the Vietnamese approval shorthand guards", () => {
  const shorthandDrifts = [
    ["không push/merge/release", "cho phép push/merge/release ngay"],
    [
      "adoption/supersession/consumer migration cần quyết định riêng sau",
      "adoption/supersession/consumer migration được phép ngay",
    ],
  ];

  for (const [pinnedWording, driftedWording] of shorthandDrifts) {
    const drifted = contractGateText.replace(pinnedWording, driftedWording);

    assert.throws(
      () => validate({ contractGateText: drifted }),
      /Vietnamese.*shorthand/i,
    );
  }
});

//
// E2 register.
//

test("rejects an E2 register lane row that reverts to the pre-acceptance lifecycle", () => {
  const drifted = e2RegisterText.replace(
    "`ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`; exact 32 paths",
    "`DECISION READY — PROPOSED ONLY`; exact 32 paths",
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /E2 register.*W1-C2.*accepted/i,
  );
});

test("rejects superseded W1-C1/W1-C2 pins in the live E2 register rows", () => {
  const stalePinDrifts = [
    [W1_C1_FINAL_DIGEST, STALE_W1_C1_PINS[0], /superseded.*W1-C1.*aggregate/i],
    [W1_C1_FINAL_DIGEST, STALE_W1_C1_PINS[1], /superseded.*W1-C1.*aggregate/i],
    [W1_C2_FINAL_DIGEST, STALE_W1_C2_PINS[0], /superseded.*W1-C2.*aggregate/i],
    [W1_C2_FINAL_DIGEST, STALE_W1_C2_PINS[1], /superseded.*W1-C2.*aggregate/i],
    ["87.27% branch coverage", "90.39% line coverage", /superseded.*W1-C1.*coverage/i],
    ["21/21 tests", "18/18 tests", /superseded.*W1-C1.*test count/i],
    ["31/31 tests", "10/10 tests", /superseded.*W1-C2.*test count/i],
    ["97.44% branch coverage", "97.39% branch coverage", /superseded.*W1-C2.*coverage/i],
  ];

  for (const [finalWording, staleWording, expectedError] of stalePinDrifts) {
    const drifted = e2RegisterText.replace(finalWording, staleWording);

    assert.throws(() => validate({ e2RegisterText: drifted }), expectedError);
  }
});

test("rejects an E2 register that drops the accepted commit pins", () => {
  const drifts = [
    [W1_C1_COMMIT, /E2 register.*W1-C1.*accepted local commit/i],
    [W1_C2_COMMIT, /E2 register.*W1-C2.*accepted local commit/i],
  ];

  for (const [commit, expectedError] of drifts) {
    const drifted = e2RegisterText.replaceAll(commit, "0".repeat(40));

    assert.throws(() => validate({ e2RegisterText: drifted }), expectedError);
  }
});

test("rejects loss of the E2 register CI NOT WIRED and static-only disclosure", () => {
  const postureDrifts = [
    [
      "- **CI: NOT WIRED** for all four applications and both accepted contract lanes.",
      "- **CI: WIRED** for all four applications and both accepted contract lanes.",
      /E2 register.*CI: NOT WIRED/i,
    ],
    [
      "**static/documentary only**",
      "**verified in CI**",
      /E2 register.*static\/documentary only/i,
    ],
  ];

  // `replaceAll`, not `replace`: both disclosures legitimately appear more than
  // once in the register, and a first-occurrence replacement would leave the
  // guarded occurrence intact and silently assert nothing.
  for (const [pinnedWording, driftedWording, expectedError] of postureDrifts) {
    const drifted = e2RegisterText.replaceAll(pinnedWording, driftedWording);
    assert.notEqual(
      drifted,
      e2RegisterText,
      `the ${pinnedWording} posture mutation must not be a no-op`,
    );

    assert.throws(() => validate({ e2RegisterText: drifted }), expectedError);
  }
});

test("rejects an E2 register GATE A4 row that does not record the acceptance", () => {
  const drifted = e2RegisterText.replace(
    "`ACCEPTED — GATE A4 CLOSED 2026-07-26`; ADR-0003 and ADR-0005 are `ACCEPTED` " +
      "(decision only; no implementation authority)",
    "`DECISION READY ONLY`; both ADRs remain `PROPOSED — NOT DECIDED`",
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /E2 register.*GATE A4.*ACCEPTED.*2026-07-26/i,
  );
});

//
// Board.
//

test("rejects stale or drifted W1-C1/W1-C2 digests on the board final-evidence rows", () => {
  const staleDrifts = [
    [W1_C1_FINAL_DIGEST, STALE_W1_C1_PINS[1], /superseded W1-C1.*aggregate/i],
    [W1_C2_FINAL_DIGEST, STALE_W1_C2_PINS[1], /superseded W1-C2.*aggregate/i],
    [W1_C1_FINAL_DIGEST, "0".repeat(64), /board.*W1-C1.*digest/i],
    [W1_C2_FINAL_DIGEST, "f".repeat(64), /board.*W1-C2.*digest/i],
  ];

  for (const [finalDigest, replacement, expectedError] of staleDrifts) {
    const drifted = boardText.replace(finalDigest, replacement);

    assert.throws(() => validate({ boardText: drifted }), expectedError);
  }
});

test("rejects loss of the board CI NOT WIRED, static-only and HOLD posture", () => {
  const postureDrifts = [
    [
      "- **CI: NOT WIRED**; all evidence is static/documentary only and no CI " +
        "result is claimed.",
      "- **CI: GREEN**; all evidence is CI-verified.",
      /board.*CI: NOT WIRED.*static\/documentary only/i,
    ],
    [
      "- `W0 COMPLETE=0`; W0 closure `NO-GO`.",
      "- `W0 COMPLETE=1`; W0 closure `GO`.",
      /board.*W0 COMPLETE=0/i,
    ],
    [
      "- W1 product implementation and W1 integration/live shadow remain `HOLD`",
      "- W1 product implementation and W1 integration/live shadow are `GO`",
      /board.*HOLD/i,
    ],
  ];

  for (const [pinnedWording, driftedWording, expectedError] of postureDrifts) {
    const drifted = boardText.replace(pinnedWording, driftedWording);

    assert.throws(() => validate({ boardText: drifted }), expectedError);
  }
});

test("rejects a board GATE A4 disposition row that does not record closure", () => {
  const drifted = boardText.replace(
    "| GATE A4 — ADR-0003/ADR-0005 evidence and decision packet | " +
      "`ACCEPTED — CLOSED 2026-07-26` |",
    "| GATE A4 — ADR-0003/ADR-0005 evidence and decision packet | `DECISION READY` |",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /board.*GATE A4.*ACCEPTED — CLOSED 2026-07-26/i,
  );
});

test("rejects board W1-C1/W1-C2 gate rows that do not record the contract acceptance", () => {
  const gateDrifts = [
    [
      "| W1-C1 — alert-context capability-specific contract proposal | " +
        "`ACCEPTED — CLOSED 2026-07-26` |",
      "| W1-C1 — alert-context capability-specific contract proposal | `PREPARATION GO` |",
      /board.*W1-C1.*ACCEPTED — CLOSED 2026-07-26/i,
    ],
    [
      "| W1-C2 — investigation lifecycle/create/status/cancel/bundle-read contract proposal | " +
        "`ACCEPTED — CLOSED 2026-07-26` |",
      "| W1-C2 — investigation lifecycle/create/status/cancel/bundle-read contract proposal | " +
        "`PREPARATION GO` |",
      /board.*W1-C2.*ACCEPTED — CLOSED 2026-07-26/i,
    ],
  ];

  for (const [pinnedRow, driftedRow, expectedError] of gateDrifts) {
    const drifted = boardText.replace(pinnedRow, driftedRow);

    assert.throws(() => validate({ boardText: drifted }), expectedError);
  }
});

test("rejects a board §14.6 record that loses the exact twelve-path allowlist", () => {
  const drifted = boardText.replace(
    "#### 14.6.1 Exact write allowlist — twelve paths",
    "#### 14.6.1 Exact write allowlist — unbounded",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /board.*twelve-path allowlist/i,
  );
});

test("rejects a board §14.7 record that loses the exact nineteen-path allowlist", () => {
  const drifted = boardText.replace(
    "#### 14.7.1 Exact write allowlist — nineteen paths",
    "#### 14.7.1 Exact write allowlist — unbounded",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /board.*nineteen-path allowlist/i,
  );
});

test("rejects a board §14.7 record that claims push, merge or release authority", () => {
  const drifted = boardText.replace(
    "- Nothing was staged, committed, merged, pushed, deployed or released by this " +
      "reconciliation,\n  and no dependency was installed and no database, container or network " +
      "was reached.",
    "- This reconciliation staged, committed and pushed its changes.",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /board.*nothing was staged, committed, merged, pushed/i,
  );
});

test("rejects a duplicate or missing immutable task ID", () => {
  const drifted = boardText.replace("| W0-D04 |", "| W0-D03 |");

  assert.throws(
    () => validate({ boardText: drifted }),
    /exact 48-task set/i,
  );
});

test("rejects a task 49 or any extra task identity", () => {
  const drifted = boardText.replace(
    "| W0-D04 | W1 decision queue",
    "| W0-D04 | W1 decision queue\n| W0-I49 | Unauthorized extra task",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /exact 48-task set/i,
  );
});

test("rejects loss of the W1 read-ahead GO decision", () => {
  const drifted = boardText.replace(
    "`W1 READ-AHEAD/PACKET PREPARATION GO`",
    "`W1 READ-AHEAD/PACKET PREPARATION HOLD`",
  );

  assert.throws(() => validate({ boardText: drifted }), /read-ahead.*GO/i);
});

test("rejects loss of W0 NO-GO closure or COMPLETE=0", () => {
  const drifted = boardText.replace(
    "- **W0 closure:** `NO-GO`; `COMPLETE=0`",
    "- **W0 closure:** `GO`; `COMPLETE=1`",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /W0.*NO-GO.*COMPLETE=0/i,
  );
});

test("rejects promotion of W1 runtime writers from NO-GO", () => {
  const drifted = boardText.replace(
    "W1 runtime writers remain\n  `NO-GO`",
    "W1 runtime writers are\n  `GO`",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /runtime writers.*NO-GO/i,
  );
});

test("rejects using offline W0-T10 as the live W1 substitute", () => {
  const drifted = boardText.replace(
    "W0-T10 proves offline contract/simulated-consumer conformance only and is not evidence of " +
      "that\n  live walking skeleton.",
    "W0-T10 proves the live walking skeleton.",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /offline W0-T10.*not.*substitute|W0-T10.*not evidence.*live/i,
  );
});

test("rejects conflation of contract and release RB-001 labels", () => {
  const drifted = boardText.replace(
    "`RB-001(contract-forward-gap)`",
    "`RB-001`",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /RB-001\(contract-forward-gap\).*RB-001\(release-disclosure\)/i,
  );
});

//
// Roadmap dates.
//

test("rejects a change to the formal W1 date range", () => {
  const drifted = roadmapText.replace(
    "2026-08-01 → 2026-08-23",
    "2026-07-27 → 2026-08-16",
  );

  assert.throws(
    () => validate({ roadmapText: drifted }),
    /W1.*2026-08-01.*2026-08-23/i,
  );
});

test("rejects a change to the fixed release window", () => {
  // Target the guarded release-phase heading itself, not the first occurrence of
  // the bare date range. An unguarded first-occurrence replacement silently
  // mutated a different line (or nothing at all) depending on which roadmap
  // revision was on disk, so the negative test could pass without ever
  // exercising the guard.
  const releaseHeading = "### Release — 2026-12-21 → 2026-12-31";
  assert.equal(
    roadmapText.split(releaseHeading).length - 1,
    1,
    "the guarded release-window heading must occur exactly once in the roadmap",
  );

  const drifted = roadmapText.replace(
    releaseHeading,
    "### Release — 2026-12-14 → 2026-12-24",
  );
  assert.notEqual(
    drifted,
    roadmapText,
    "the release-window mutation must not be a no-op",
  );

  assert.throws(
    () => validate({ roadmapText: drifted }),
    /release window.*2026-12-21.*2026-12-31/i,
  );
});

//
// GATE A4 record.
//

test("rejects a Gate A4 packet that no longer records the 2026-07-26 acceptance", () => {
  const drifted = gateA4Text.replace(
    "- **Status:** `ACCEPTED — GATE A4 CLOSED 2026-07-26 — STATUS FLIP APPLIED — " +
      "NO IMPLEMENTATION AUTHORITY`",
    "- **Status:** `DECISION READY — GATE A4 NOT OPEN — AWAITING EXPLICIT FOUNDER ANSWER`",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /GATE A4.*ACCEPTED.*CLOSED 2026-07-26/i,
  );
});

test("rejects a Gate A4 packet that drops the recorded delegated-authority decision line", () => {
  const drifted = gateA4Text.replace(
    "- **Decision:** Option A **accepted 2026-07-26** under Founder-delegated current-thread " +
      "authority;",
    "- **Decision:** Option A accepted at some point;",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /decision line.*accepted 2026-07-26.*Founder-delegated/i,
  );
});

test("rejects Gate A4 acceptance wording that leaks implementation authority", () => {
  const drifted = gateA4Text.replace(
    "- This acceptance flips ADR-0003 and ADR-0005 to `ACCEPTED` and grants nothing else: no\n" +
      "  implementation, no dependency selection or installation, no spike or benchmark run, no " +
      "database,\n  container, microVM, netns or broker start, and no staging, commit, merge, " +
      "push, deployment,\n  release or release-date authority.",
    "- This acceptance flips ADR-0003 and ADR-0005 to `ACCEPTED` and opens implementation, " +
      "dependency\n  installation and the spike programme.",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /acceptance.*grants nothing else|no implementation.*authority/i,
  );
});

test("rejects Gate A4 Option A wording that stops gating implementation and Git actions", () => {
  const drifted = gateA4Text.replace(
    "Implementation, dependency selection, spike, benchmark, DB/container/broker, staging, " +
      "commit, merge, push, deployment and release each remain separately gated.",
    "Implementation and release may now proceed.",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /Option A.*separately gated/i,
  );
});

test("rejects weakening of the recorded Vietnamese GATE A4 decision shorthand", () => {
  const shorthandDrifts = [
    ["không mở implementation", "cho phép mở implementation"],
    ["không stage/commit/merge/push", "cho phép stage/commit/merge/push"],
  ];

  for (const [pinnedWording, driftedWording] of shorthandDrifts) {
    const drifted = gateA4Text.replace(pinnedWording, driftedWording);

    assert.throws(
      () => validate({ gateA4Text: drifted }),
      /Vietnamese.*GATE A4.*shorthand/i,
    );
  }
});

test("rejects the two ADR applications losing their APPLIED record in the packet", () => {
  const drifted = gateA4Text.replace(
    "| ADR-0003 durable agent orchestration | `docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md` | " +
      "`APPLIED 2026-07-26` |",
    "| ADR-0003 durable agent orchestration | `docs/adr/ADR-0003-STATUS-FLIP-APPLICATION.md` | " +
      "`APPLICATION READY ONLY` |",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /ADR-0003-STATUS-FLIP-APPLICATION\.md.*APPLIED 2026-07-26/i,
  );
});

test("rejects a Gate A4 recommendation other than Option A", () => {
  const drifted = gateA4Text.replace(
    "**Recommendation:** Option A; H1–H11=yes and J1–J10=yes",
    "**Recommendation:** Option C; defer all decisions",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /Option A.*H1.*H11.*J1.*J10/i,
  );
});

test("rejects Gate A4 sandbox wording that permits pooled S4", () => {
  const drifted = gateA4Text.replace(
    "only policy-approved S0/R0 metadata workers may be pooled, while S4 remains per-invocation " +
      "disposable under accepted ADR-0004 F3",
    "S0/R0 and S4/R3 workers may be pooled",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /S0\/R0.*pooled.*S4.*disposable.*ADR-0004 F3/i,
  );
});

test("rejects carrying the already-resolved ADR-0002 dependency as a deferral", () => {
  const drifted = gateA4Text.replace(
    "record the ADR-0002 dependency as resolved",
    "carry the ADR-0002 dependency as a deferral",
  );

  assert.throws(
    () => validate({ gateA4Text: drifted }),
    /ADR-0002 dependency.*resolved/i,
  );
});

test("rejects missing or duplicate H1-H11 decisions", () => {
  const drifted = gateA4Text.replace("| H11 |", "| H10 |");

  assert.throws(() => validate({ gateA4Text: drifted }), /exact H1-H11/i);
});

test("rejects missing or duplicate J1-J10 decisions", () => {
  const drifted = gateA4Text.replace("| J10 |", "| J09 |");

  assert.throws(() => validate({ gateA4Text: drifted }), /exact J1-J10/i);
});

//
// ADR files, ADR status-flip applications, sprint and catalog.
//

test("rejects an ADR status line that has not been flipped to ACCEPTED", () => {
  const adrDrifts = [
    ["adr0003Text", adr0003Text, /ADR-0003.*ACCEPTED.*GATE A4, 2026-07-26/i],
    ["adr0005Text", adr0005Text, /ADR-0005.*ACCEPTED.*GATE A4, 2026-07-26/i],
  ];

  for (const [key, source, expectedError] of adrDrifts) {
    const drifted = source.replace(
      "- Status: `ACCEPTED` (GATE A4, 2026-07-26) — decision only; no implementation, dependency " +
        "or\n  runtime authority",
      "- Status: `PROPOSED — NOT DECIDED`",
    );

    assert.throws(() => validate({ [key]: drifted }), expectedError);
  }
});

test("rejects an accepted ADR that claims implementation authority", () => {
  const adrDrifts = [
    [
      "adr0003Text",
      adr0003Text,
      "- Status: `ACCEPTED` (GATE A4, 2026-07-26) — implementation authorized",
      /ADR-0003.*decision only.*no implementation/i,
    ],
    [
      "adr0005Text",
      adr0005Text,
      "- Status: `ACCEPTED` (GATE A4, 2026-07-26) — substrate installation authorized",
      /ADR-0005.*decision only.*no implementation/i,
    ],
  ];

  for (const [key, source, driftedWording, expectedError] of adrDrifts) {
    const drifted = source.replace(
      "- Status: `ACCEPTED` (GATE A4, 2026-07-26) — decision only; no implementation, dependency " +
        "or\n  runtime authority",
      driftedWording,
    );

    assert.throws(() => validate({ [key]: drifted }), expectedError);
  }
});

test("rejects an ADR status-flip application that is not recorded as APPLIED", () => {
  const applicationDrifts = [
    [
      "adr0003ApplicationText",
      adr0003ApplicationText,
      "- **Status:** `APPLIED 2026-07-26 — ADR-0003 STATUS FLIP RECORDED — " +
        "NO IMPLEMENTATION AUTHORITY`",
      /ADR-0003 application.*APPLIED 2026-07-26/i,
    ],
    [
      "adr0005ApplicationText",
      adr0005ApplicationText,
      "- **Status:** `APPLIED 2026-07-26 — ADR-0005 STATUS FLIP RECORDED — " +
        "NO IMPLEMENTATION AUTHORITY`",
      /ADR-0005 application.*APPLIED 2026-07-26/i,
    ],
  ];

  for (const [key, source, pinned, expectedError] of applicationDrifts) {
    const drifted = source.replace(
      pinned,
      "- **Status:** `APPLICATION READY ONLY — NO ADR STATUS FLIP`",
    );

    assert.throws(() => validate({ [key]: drifted }), expectedError);
  }
});

test("rejects a status-flip application that grants implementation or spike authority", () => {
  const drifted = adr0005ApplicationText.replace(
    "- **Resulting ADR status:** `ACCEPTED` (GATE A4, 2026-07-26) — decision only; no " +
      "implementation,\n  dependency, substrate, spike, benchmark, container, microVM, netns, " +
      "broker, Git, deployment or\n  release authority follows",
    "- **Resulting ADR status:** `ACCEPTED` (GATE A4, 2026-07-26) — substrate spikes and installs " +
      "may\n  now proceed",
  );

  assert.throws(
    () => validate({ adr0005ApplicationText: drifted }),
    /ADR-0005 application.*decision only.*no implementation/i,
  );
});

test("rejects an ADR-0005 application that permits pooled S4", () => {
  const drifted = adr0005ApplicationText.replace(
    "**S4 remains per-invocation disposable under accepted ADR-0004 F3.** S4 is never pooled",
    "**S4 may be pooled with S0 metadata workers.** S4 is pooled",
  );

  assert.throws(
    () => validate({ adr0005ApplicationText: drifted }),
    /S4.*never pooled|S4.*disposable/i,
  );
});

test("rejects a sprint header that still claims GATE A4 is not open", () => {
  const drifted = sprintText.replace(
    "**GATE A4 CLOSED 2026-07-26**",
    "**GATE A4 NOT OPEN**",
  );

  assert.throws(
    () => validate({ sprintText: drifted }),
    /sprint.*GATE A4 CLOSED 2026-07-26/i,
  );
});

test("rejects a sprint progress block that still lists ADR-0003/ADR-0005 as proposed", () => {
  const drifted = sprintText.replace(
    "ADR-0003 and ADR-0005 are `ACCEPTED` (decision only; no implementation authority)",
    "ADR-0003/ADR-0005 remain `PROPOSED — NOT DECIDED`",
  );

  assert.throws(
    () => validate({ sprintText: drifted }),
    /sprint.*ADR-0003 and ADR-0005.*ACCEPTED/i,
  );
});

test("rejects a sprint progress block that does not record the W1-C1/C2 contract acceptance", () => {
  const drifted = sprintText.replace(
    "**W1-C1/C2 CONTRACT GATE CLOSED 2026-07-26**",
    "**W1-C1/C2 CONTRACT GATE NOT OPEN**",
  );

  assert.throws(
    () => validate({ sprintText: drifted }),
    /sprint.*W1-C1\/C2 CONTRACT GATE CLOSED 2026-07-26/i,
  );
});

test("rejects an ADR catalog row that still shows ADR-0003 or ADR-0005 as PROPOSED", () => {
  const catalogDrifts = [
    [
      "| [ADR-0003](ADR-0003-durable-agent-orchestration.md) | Durable agent orchestration | " +
        "`ACCEPTED` (GATE A4, 2026-07-26) — decision only |",
      "| [ADR-0003](ADR-0003-durable-agent-orchestration.md) | Durable agent orchestration | " +
        "`PROPOSED` |",
      /catalog.*ADR-0003.*ACCEPTED/i,
    ],
    [
      "| [ADR-0005](ADR-0005-sandbox-substrate.md) | Sandbox substrate | `ACCEPTED` " +
        "(GATE A4, 2026-07-26) — decision only |",
      "| [ADR-0005](ADR-0005-sandbox-substrate.md) | Sandbox substrate | `PROPOSED` |",
      /catalog.*ADR-0005.*ACCEPTED/i,
    ],
  ];

  for (const [pinnedRow, driftedRow, expectedError] of catalogDrifts) {
    const drifted = adrReadmeText.replace(pinnedRow, driftedRow);

    assert.throws(() => validate({ adrReadmeText: drifted }), expectedError);
  }
});

test("rejects an ADR catalog that reopens the closed nine-path index reconciliation", () => {
  // The catalog's open residual gate is scoped to the evidence packets, the
  // handoff record, the Wave 1 packet and `contracts/README.md`. The three index
  // files were reconciled on 2026-07-26 and must not be pulled back into it.
  const drifted = adrReadmeText.replace(
    "`docs/README.md`, the root `README.md` and `docs/operations/README.md` were reconciled " +
      "to this\ncatalog on 2026-07-26 under the nine-path documentation authority recorded in\n" +
      "`docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.8.",
    "`docs/README.md`, the root `README.md` and `docs/operations/README.md` are still an " +
      "**open residual reconciliation gate**.",
  );

  assert.notEqual(drifted, adrReadmeText);
  assert.throws(
    () => validate({ adrReadmeText: drifted }),
    /catalog.*index reconciliation applied on 2026-07-26/i,
  );
});

//
// Dual-state W1-C1 provenance — one accepted baseline, one disjoint
// correction now committed local-only. Every rule below must fail closed.
//

test("derives the W0-I01C candidate disposition without disturbing the accepted baseline", () => {
  const result = validate();

  // Deliberately *outside* `contractGateDisposition`: the candidate is not part
  // of the accepted contract gate. `committed: true` with `accepted: false` is
  // the whole point — the two axes are independent.
  assert.equal(result.contractGateDisposition.w1C1Candidate, undefined);
  assert.deepEqual(result.w1C1CandidateDisposition, {
    lane: "W0-I01C",
    lifecycle: W1_C1_CANDIDATE_LIFECYCLE,
    committed: true,
    integrated: false,
    pushed: false,
    accepted: false,
    base: W1_C1_COMMIT,
    branch: W1_C1_CANDIDATE_BRANCH,
    memberSet: W1_C1_CANDIDATE_MEMBER_SET,
    memberCount: 13,
    dirtyPaths: 16,
    staged: 0,
  });
  // The accepted baseline is untouched by the candidate.
  assert.deepEqual(result.contractGateDisposition.w1C1, {
    commit: W1_C1_COMMIT,
    parent: W1_CANDIDATE_PARENT,
    pathCount: 16,
    digest: W1_C1_FINAL_DIGEST,
  });
});

test("rejects an E2 register that drops the W0-I01C candidate row", () => {
  const drifted = replaceUnique(e2RegisterText, W1_C1_CANDIDATE_ROW, "");

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /E2 register.*W0-I01C.*candidate row/i,
  );
});

test("rejects a board that drops the W0-I01C candidate row", () => {
  const drifted = replaceUnique(boardText, W1_C1_CANDIDATE_ROW, "");

  assert.throws(
    () => validate({ boardText: drifted }),
    /board.*W0-I01C.*candidate row/i,
  );
});

test("rejects a duplicated W0-I01C candidate row anchor", () => {
  assert.equal(countOccurrences(e2RegisterText, W1_C1_CANDIDATE_ROW), 1);
  const drifted = replaceUnique(
    e2RegisterText,
    W1_C1_CANDIDATE_ROW,
    `${W1_C1_CANDIDATE_ROW}\n${W1_C1_CANDIDATE_ROW}`,
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /W0-I01C candidate row.*exactly once/i,
  );
});

test("rejects a candidate row that claims the accepted contract lifecycle", () => {
  const drifted = replaceUnique(
    e2RegisterText,
    `\`${W1_C1_CANDIDATE_LIFECYCLE}\`; exactly 16 paths`,
    "`ACCEPTED FOR IMPLEMENTATION v0.1.0 — LOCAL COMMIT ONLY`; exactly 16 paths",
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /candidate row/i,
  );
});

test("rejects a candidate row that carries the accepted member-set digest", () => {
  const drifted = replaceUnique(
    boardText,
    `candidate \`member_set\` \`sha256:${W1_C1_CANDIDATE_MEMBER_SET}\``,
    `candidate \`member_set\` \`sha256:${W1_C1_FINAL_DIGEST}\``,
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /candidate row.*accepted W1-C1 member-set digest|candidate row/i,
  );
});

test("rejects an accepted W1-C1 register row contaminated with the candidate member-set", () => {
  const drifted = replaceUnique(
    e2RegisterText,
    `member-set digest \`sha256:${W1_C1_FINAL_DIGEST}\` (13/13 member hashes match)`,
    `member-set digest \`sha256:${W1_C1_CANDIDATE_MEMBER_SET}\` (13/13 member hashes match)`,
  );

  assert.throws(() => validate({ e2RegisterText: drifted }), /W1-C1/i);
});

test("rejects an accepted W1-C1 board row contaminated with the candidate lifecycle", () => {
  const drifted = replaceUnique(
    boardText,
    "| exactly 16 paths; standalone validator `PASS`; 21/21 tests; 87.27% " +
      "branch coverage against the declared 80% branch floor |",
    "| exactly 16 paths; standalone validator `PASS`; 21/21 tests; 87.27% " +
      `branch coverage; ${W1_C1_CANDIDATE_LIFECYCLE} |`,
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /accepted W1-C1 .*row.*candidate/i,
  );
});

test("rejects a candidate row that drops the exact 16-path / zero-staged measurement", () => {
  const drifted = replaceUnique(
    e2RegisterText,
    `\`${W1_C1_CANDIDATE_LIFECYCLE}\`; exactly 16 paths, zero staged`,
    `\`${W1_C1_CANDIDATE_LIFECYCLE}\`; an unmeasured scope`,
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /candidate row/i,
  );
});

test("rejects a candidate row that drops the 86.99% branch coverage against the 80% floor", () => {
  const drifted = replaceUnique(
    boardText,
    "candidate suite 21/21; 86.99% branch coverage against the declared 80% branch floor",
    "candidate suite 21/21",
  );

  assert.throws(() => validate({ boardText: drifted }), /candidate row/i);
});

test("rejects a candidate row that drops the member_count 13 member-set attestation", () => {
  const drifted = replaceUnique(
    e2RegisterText,
    "(`MEMBER-SET-SHA256/v1`, 13/13 member hashes, `member_count` 13)",
    "(unverified)",
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /candidate row/i,
  );
});

test("rejects a candidate row that asserts a commit identity other than the known base", () => {
  const drifted = replaceUnique(
    e2RegisterText,
    `committed local-only at \`${W1_C1_CANDIDATE_COMMIT_ABBREV}\`, parent`,
    "committed local-only at `1111111111111111111111111111111111111111`, parent",
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /candidate.*commit identity|candidate row/i,
  );
});

test("rejects candidate wording that claims the candidate supersedes the accepted baseline", () => {
  const drifted = replaceUnique(
    boardText,
    "| W0-I01C — W1-C1 alert-context correction candidate | committed local-only",
    "| W0-I01C — W1-C1 alert-context correction candidate | supersedes the " +
      "accepted baseline; committed local-only",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /candidate/i,
  );
});

test("rejects a dual-state section that claims the candidate replaces the accepted baseline", () => {
  const drifted = replaceUnique(
    boardText,
    "#### 14.32.2 Dual state — one accepted baseline, one disjoint candidate",
    "#### 14.32.2 Dual state — one accepted baseline, one disjoint candidate\n\n" +
      "The candidate replaces the accepted baseline.",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /candidate.*(supersed|replac)/i,
  );
});

test("rejects a board that keeps the candidate row but drops the transport stale-lock disclosure", () => {
  const drifted = replaceUnique(
    boardText,
    "#### 14.32.3 Downstream alert-context transport — provenance-stale lock",
    "#### 14.32.3 Reserved",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /stale[- ]lock disclosure/i,
  );
});

test("rejects loss of the packet dual-state provenance overlay section", () => {
  const drifted = replaceUnique(
    packetText,
    "### 2.9 Dual-state W1-C1 provenance — the accepted baseline, and the correction committed on it",
    "### 2.9 Reserved",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /packet.*dual-state/i,
  );
});

test("rejects a packet that relabels the candidate working-tree aggregate", () => {
  assert.equal(countOccurrences(packetText, W1_C1_CANDIDATE_AGGREGATE), 1);
  const drifted = replaceUnique(
    packetText,
    `\`${W1_C1_CANDIDATE_AGGREGATE}\` is the **pre-commit`,
    `\`${W1_C1_CANDIDATE_AGGREGATE}\` is the member-set digest ` +
      `\`${W1_C1_CANDIDATE_AGGREGATE}\`, which is the **pre-commit`,
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /working-tree aggregate.*exactly once/i,
  );
});

test("rejects a packet that drops the aggregate recipe and its not-a-member-set label", () => {
  const drifted = replaceUnique(
    packetText,
    "It is **not** a member-set\ndigest, **not** a commit identity, and **not** " +
      "part of the accepted C1 artifact recipe.",
    "",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /working-tree aggregate/i,
  );
});

test("rejects a packet that breaks the totally ordered LINE 2 commit chain", () => {
  const drifted = replaceUnique(
    packetText,
    "`3a2c715` → `4d5fb4b` → `a976a20` → `20cfa36` → `7185739`.",
    "`3a2c715` → `a976a20` → `4d5fb4b` → `7185739` → `20cfa36`.",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /commit-graph block.*totally ordered `3a2c715` → `4d5fb4b` → `a976a20` → `20cfa36` → `7185739`/i,
  );
});

test("rejects a packet that drops the NO-GO on publishing a976a20 as corrected C1 bytes", () => {
  const drifted = replaceUnique(
    packetText,
    "14. **NO-GO** on publishing, pushing or citing `a976a20` as the current corrected W1-C1",
    "14. Publishing `a976a20` as the current corrected W1-C1",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /NO-GO.*a976a20/i,
  );
});

test("rejects a packet that drops the NO-GO on treating the candidate as committed or accepted", () => {
  const drifted = replaceUnique(
    packetText,
    "15. **NO-GO** on treating the W0-I01C correction as accepted, integrated, pushed, merged or",
    "15. The W0-I01C correction may be treated as accepted, integrated, pushed, merged or",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /NO-GO.*W0-I01C/i,
  );
});

test("rejects a register note that presents the candidate member-set as a superseding value", () => {
  const drifted = replaceUnique(
    e2RegisterText,
    "It is a **pending\ncandidate value**, not a superseding value:",
    "It is a superseding value:",
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /pending candidate value/i,
  );
});

test("rejects a packet dual-state section that asserts the candidate is accepted", () => {
  const drifted = replaceUnique(
    packetText,
    "### 2.9 Dual-state W1-C1 provenance — the accepted baseline, and the correction committed on it",
    "### 2.9 Dual-state W1-C1 provenance — the accepted baseline, and the correction committed on it\n\n" +
      "The candidate is accepted.",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /candidate.*accepted/i,
  );
});

//
// W0-R06M P2-1 — measured alert-context transport fixture ground truth.
//
// Measured read-only over `contracts/examples/alert-context-transport/` at
// `a976a20` (byte-identical to `4d5fb4b` apart from manifest metadata): the
// examples manifest declares 13 fixtures; 11 of them carry
// `include_descendants` across 17 occurrences, every one `false`; the
// `approval-required` and `kill-switch-denied` fixtures omit the field, and no
// fixture sets it `true`. The withdrawn "all 14 transport fixtures" claim
// counted the manifest itself as a fixture.
//

const TRANSPORT_FIXTURE_COUNT = 13;
const TRANSPORT_FIXTURES_CARRYING_FLAG = 11;
const TRANSPORT_FLAG_OCCURRENCES = 17;

test("records the measured alert-context transport fixture ground truth in the board and the packet", () => {
  for (const [label, text] of [
    ["board", boardText],
    ["packet", packetText],
  ]) {
    for (const required of [
      `**${TRANSPORT_FIXTURE_COUNT}** fixtures`,
      `**${TRANSPORT_FIXTURES_CARRYING_FLAG}** of them carry`,
      `**${TRANSPORT_FLAG_OCCURRENCES}** occurrences`,
      "`approval-required`",
      "`kill-switch-denied`",
      "**no fixture sets it `true`**",
    ]) {
      assert.ok(
        text.includes(required),
        `${label} must state the measured transport fixture fact: ${required}`,
      );
    }
  }

  // The withdrawn count may not survive anywhere in either document.
  for (const text of [boardText, packetText]) {
    assert.equal(/(?:\*\*)?14(?:\*\*)? transport fixtures/.test(text), false);
  }
});

test("rejects a board that restores the withdrawn 14-transport-fixture claim", () => {
  const drifted = replaceUnique(
    boardText,
    "the declared **13** transport fixtures never set",
    "all **14** transport fixtures never set",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /W1 board claims 14 transport fixtures/,
  );
});

test("rejects a packet that restores the withdrawn 14-transport-fixture claim", () => {
  const drifted = replaceUnique(
    packetText,
    "The transport examples manifest declares **13** fixtures;",
    "All **14** transport fixtures carry the flag; the manifest declares",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /blocker-4 packet claims 14 transport fixtures/,
  );
});

test("rejects a board stale-lock disclosure that drops the measured include_descendants detail", () => {
  const drifted = replaceUnique(
    boardText,
    "**11** of them carry\n  `include_descendants` across **17** occurrences, every one `false`.",
    "the fixtures carry `include_descendants`.",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /stale-lock disclosure must stay pinned byte-exact/,
  );
});

test("rejects a packet §2.9 that drops the measured transport fixture detail", () => {
  const drifted = replaceUnique(
    packetText,
    "**11** of them carry\n`include_descendants` across **17** occurrences, every one `false`. The `approval-required` and",
    "the fixtures carry `include_descendants`. The `approval-required` and",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§2\.9 must keep the measured transport fixture disclosure/,
  );
});

//
// W0-R06M P2-2 — §7.1 must republish the live §2.8 measurement.
//

const PACKET_PUSH_DELTA_ROW = "| Suite LINE 1 | `8fe4cb0` | 38 | **25** |";
const PACKET_CANDIDATE_REF_ROW =
  "| 3 | Suite | LINE 1 `codex/w1-d04-founder-gate-repair-r1` | `8fe4cb0` | 25 | control corpus, measured at the immutable base |";

test("records one base-plus-one Suite LINE 1 publication measurement in both §2.8 and §7.1", () => {
  const result = validate();

  // Design C: the record names its immutable base and its own offset, derives
  // the post-commit count, and mints no identity of its own.
  assert.deepEqual(result.line1Publication, {
    base: "8fe4cb02e0119224205a86631db7c481f7638c23",
    abbreviatedBase: "8fe4cb0",
    baseNewCommits: 25,
    laneCommitsAheadOfBase: 1,
    predictedNewCommits: 26,
    selfIdentityStated: false,
  });
  assert.equal(countOccurrences(packetText, PACKET_PUSH_DELTA_ROW), 1);
  assert.equal(countOccurrences(packetText, PACKET_CANDIDATE_REF_ROW), 1);
});

test("rejects a packet §7.1 that proposes publishing Suite LINE 1 at a stale dated tip", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_CANDIDATE_REF_ROW,
    "| 3 | Suite | LINE 1 `codex/w1-d04-founder-gate-repair-r1` | `a3e8cba` | 24 | control corpus |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§7\.1 proposes publishing Suite LINE 1 at `a3e8cba`.*§2\.8 measures the live tip as `8fe4cb0`/s,
  );
});

test("rejects a packet §7.1 that disagrees with §2.8 on the Suite LINE 1 new-commit count", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_CANDIDATE_REF_ROW,
    "| 3 | Suite | LINE 1 `codex/w1-d04-founder-gate-repair-r1` | `8fe4cb0` | 24 | control corpus |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§7\.1 records 24 new Suite LINE 1 commits.*§2\.8 measures 25/s,
  );
});

test("rejects a packet §2.8 push-delta row that drifts off the immutable control base", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_PUSH_DELTA_ROW,
    "| Suite LINE 1 | `a3e8cba` | 38 | **25** |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§2\.8 measures the Suite LINE 1 publication tip as `a3e8cba`, which is not the immutable control base/,
  );
});

test("rejects a packet §2.8 that records a stale Suite LINE 1 new-commit count", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_PUSH_DELTA_ROW,
    "| Suite LINE 1 | `8fe4cb0` | 38 | **24** |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§2\.8 records 24 Suite LINE 1 commits not on any remote-tracking ref; the measurement at the base `8fe4cb0` is 25/,
  );
});

test("rejects a packet that drops the §2.8 Suite LINE 1 push-delta row", () => {
  const drifted = replaceUnique(packetText, PACKET_PUSH_DELTA_ROW, "");

  assert.throws(
    () => validate({ packetText: drifted }),
    /§2\.8 must carry a `Suite LINE 1` push-delta row/,
  );
});

test("rejects a packet that drops the §7.1 Suite LINE 1 candidate-ref row", () => {
  const drifted = replaceUnique(packetText, PACKET_CANDIDATE_REF_ROW, "");

  assert.throws(
    () => validate({ packetText: drifted }),
    /§7\.1 must carry a Suite LINE 1 candidate-ref row/,
  );
});

//
// W0-R06M P3 — the foreign-commit-identity guard runs against every guarded
// candidate region, in every document, not against a module constant.
//

const FABRICATED_SUCCESSOR = "9c1d4e2a7b6f0538ea4197cd3b8025f6417d9e0a";

test("rejects a fabricated successor SHA inside the board §14.32.2 candidate region", () => {
  const drifted = replaceUnique(
    boardText,
    "The `git`-measured basis for the correction row",
    `The correction will land as \`${FABRICATED_SUCCESSOR}\`. The \`git\`-measured basis for the correction row`,
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    new RegExp(
      `W1 board §14\\.32\\.2 asserts the commit identity \`${FABRICATED_SUCCESSOR}\``,
    ),
  );
});

test("rejects a fabricated successor SHA inside the packet §2.9 candidate region", () => {
  const drifted = replaceUnique(
    packetText,
    "**No successor SHA is predicted, reserved or placeholdered anywhere in this corpus.**",
    `The successor is \`${FABRICATED_SUCCESSOR}\`.`,
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    new RegExp(
      `blocker-4 packet §2\\.9 asserts the commit identity \`${FABRICATED_SUCCESSOR}\``,
    ),
  );
});

test("rejects a fabricated successor SHA inside the register §4.4 candidate region", () => {
  const drifted = replaceUnique(
    e2RegisterText,
    "Promotion of the candidate to accepted status needs its own Founder decision on its own bytes.",
    `Promotion is reserved at \`${FABRICATED_SUCCESSOR}\`.`,
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    new RegExp(
      `E2 register §4\\.4 asserts the commit identity \`${FABRICATED_SUCCESSOR}\``,
    ),
  );
});

//
// W1-D04D-R2 — §2.8 must not present the per-line sum as a unique union.
//
// The six per-line counts are measured per ref; the three Suite lines share a
// fork point, so their per-line sum double-counts. The rule derives the sum
// from the rows themselves so a row edit and the stated total cannot drift
// apart, and pins the sum-versus-union framing so the distinction survives.
//

const PACKET_UNION_SENTENCE =
  "Independently measured this\nsession, read-only, the **unique union** across all six candidate " +
  "refs is **59**.";
const PACKET_FABRIC_DELTA_ROW = "| Fabric | `37d9b329` | 14 | **5** |";

test("records the §2.8 per-line push-delta sum and the measured unique union", () => {
  const result = validate();

  // The predicted pair is derived from base + this lane's offset, never a
  // literal, so the measured and predicted figures cannot drift apart.
  assert.deepEqual(result.pushDelta, {
    rows: 6,
    perLineSum: 63,
    suiteUnion: 31,
    uniqueUnion: 59,
    predictedPerLineSum: 64,
    predictedUniqueUnion: 60,
  });
});

test("rejects a packet §2.8 whose per-row counts no longer sum to the stated total", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_FABRIC_DELTA_ROW,
    "| Fabric | `37d9b329` | 14 | **6** |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§2\.8 push-delta rows sum to 64 genuinely-new commits; the section states 63/,
  );
});

test("rejects a packet §2.8 that drifts on the measured unique-union figure", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_UNION_SENTENCE,
    PACKET_UNION_SENTENCE.replace("**59**", "**57**"),
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§2\.8 must keep the sum-versus-union disclosure byte-exact/,
  );
});

test("rejects a packet §2.8 that presents the per-line sum as the unique union", () => {
  const drifted = replaceUnique(
    packetText,
    "**63** is the **sum of the six per-line counts above**, not a unique union:",
    "**63** is the unique union across all six candidate refs:",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§2\.8 must keep the sum-versus-union disclosure byte-exact/,
  );
});

//
// W1-D04D-R2 — the §9 enforcement-surface disclosure.
//
// The withdrawn §9 sentence claimed the validator enforced §2.9 and §8 NO-GO
// 14–15 *only* and that §2–§7 were unenforced prose. Both halves were false:
// §2.8, §7.1 row 3 and a corpus-level packet scan were already enforced. These
// rules fail closed on any drift in the replacement inventory, in either
// direction — overclaim or underclaim.
//

const PACKET_ENFORCEMENT_HEADING =
  "### 9.1 Machine-enforcement surface — exactly what the validator checks";
const PACKET_ENFORCED_RULE_12_ROW =
  "| 12 | §9.1 plus live repository | this table and the live-`git` paragraph " +
  "are pinned byte-exact; the canonical file validator fails closed unless " +
  "the exact two rehearsal merge commits, ordered parents, trees, required " +
  "input objects and tip ancestry exist |";
const PACKET_UNENFORCED_NO_GO_LINE =
  "- §8 NO-GO **1–13**, **16** and **17** — including the runtime/local-stack " +
  "NO-GO 16 and the";
const PACKET_LIVE_GIT_SENTENCE =
  "**Live `git` topology is required and read fail-closed.** The canonical " +
  "file validator invokes";
const PACKET_CURRENT_VERIFICATION_LABEL =
  "**Current — W1 Lane 5 control reconciliation, this record.**";
const PACKET_DATED_HISTORY_ROW =
  "| 2026-07-27 | W1-D04C dual-state provenance refresh | `PASS: tasks=48` | " +
  "RED `tests 100 · pass 78 · fail 22`, then `tests 100 · pass 100 · fail 0` |";

test("records the packet §9.1 machine-enforcement surface disclosure", () => {
  const result = validate();

  assert.deepEqual(result.enforcementSurface, {
    anchor: "§9.1",
    enforcedRules: 21,
    unenforcedNoGo: [16, 17],
    readsLiveGit: false,
  });
  assert.equal(countOccurrences(packetText, PACKET_ENFORCEMENT_HEADING), 1);
});

test("rejects a packet that drops the §9.1 machine-enforcement surface heading", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_ENFORCEMENT_HEADING,
    "### 9.1 Notes on validation",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /blocker-4 packet must carry the §9\.1 machine-enforcement surface disclosure/,
  );
});

test("rejects a packet §9.1 that drifts on the enforced-rule inventory", () => {
  // The row keeps its number so the contiguity check passes and the byte-exact
  // pin is the rule actually under test.
  const drifted = replaceUnique(
    packetText,
    PACKET_ENFORCED_RULE_12_ROW,
    "| 12 | §9.1 plus live repository | this table is pinned |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§9\.1 enforced-rule inventory must stay pinned byte-exact/,
  );
});

test("rejects a packet §9.1 whose enforced-rule numbering is not 1..21 contiguous", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_ENFORCED_RULE_12_ROW,
    PACKET_ENFORCED_RULE_12_ROW.replace(
      "| 12 | §9.1 plus live repository |",
      "| 13 | §9.1 plus live repository |",
    ),
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§9\.1 enforced-rule inventory must be numbered 1..21 contiguously/,
  );
});

test("rejects a packet §9.1 that omits NO-GO 16 and 17 from the unenforced list", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_UNENFORCED_NO_GO_LINE,
    "- §8 NO-GO **1–13** — including the",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§9\.1 must name NO-GO 16 and NO-GO 17 as unenforced/,
  );
});

test("rejects a packet §9.1 that drops the unenforced-section list", () => {
  const drifted = replaceUnique(
    packetText,
    "- §10 in full: every transcript path, byte count and record count.\n",
    "",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§9\.1 unenforced-section list must stay pinned byte-exact/,
  );
});

test("rejects a packet §9.1 that drops the fail-closed live-`git` disclosure", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_LIVE_GIT_SENTENCE,
    "The validator may use document-only inference and",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§9\.1 must keep the fail-closed live-`git` disclosure byte-exact/,
  );
});

test("rejects a packet that restores the withdrawn `NO-GO 14–15 only` enforcement overclaim", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_ENFORCEMENT_HEADING,
    "**The validator now machine-enforces this packet's §2.9 and §8 NO-GO 14–15 only.**\n\n" +
      PACKET_ENFORCEMENT_HEADING,
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /blocker-4 packet restores the withdrawn enforcement overclaim/,
  );
});

test("rejects a packet that claims §2–§7 remain unenforced prose", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_ENFORCEMENT_HEADING,
    "§2–§7 and §9 remain unenforced prose.\n\n" + PACKET_ENFORCEMENT_HEADING,
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /blocker-4 packet understates the enforcement surface/,
  );
});

test("rejects a packet that permits document-only fallback when Git objects are missing", () => {
  const drifted = replaceUnique(
    packetText,
    "or degrades a missing Git object to document-only success.",
    "and degrades a missing Git object to document-only success.",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§9\.1 must keep the fail-closed live-`git` disclosure byte-exact/,
  );
});

test("rejects a packet §9 that drops a dated verification-history row", () => {
  const drifted = replaceUnique(packetText, PACKET_DATED_HISTORY_ROW, "");

  assert.throws(
    () => validate({ packetText: drifted }),
    /§9 must keep the dated verification-history table byte-exact/,
  );
});

test("rejects a packet §9 that reports a dated test figure as the current result", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_CURRENT_VERIFICATION_LABEL,
    "**Current.** The suite stands at `tests 100 · pass 100 · fail 0`.\n\n**Superseded.**",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§9 must keep the current W1 Lane 5 verification result byte-exact/,
  );
});

//
// Canonical file read path.
//

test("reads and validates the canonical W1 control files", async () => {
  const result = await validateW1ControlFiles(repositoryRoot);

  assert.equal(result.taskCount, 48);
  assert.deepEqual(result.gateA4Counts, { H: 11, J: 10 });
  assert.equal(result.contractGateDisposition.accepted, true);
  assert.equal(result.contractGateDisposition.pushed, false);
});

//
// ── Lane 5 base-plus-one provenance, design C ─────────────────────────────
//
// A commit cannot contain its own SHA, tree or content aggregate. Lane 5
// therefore records an immutable *base* (`8fe4cb0`, the parent of this record),
// the count measured at that base (**25**), this record's own offset (**+1**)
// and the derived live-after-commit prediction (**26**) — never a self
// identity, and never a literal that could drift away from the derivation.
//

const W1_D04_CONTROL_BASE = "8fe4cb02e0119224205a86631db7c481f7638c23";

const PACKET_LOCAL_PROVENANCE_HEADING =
  "### 2.10 Local-only reviewed provenance — four commits, none integrated";
const BOARD_LOCAL_PROVENANCE_HEADING =
  "### 14.35 W1 Lane 5 local-only reviewed provenance — four commits, none integrated";
const REGISTER_LOCAL_PROVENANCE_HEADING =
  "## 27. W1 Lane 5 local-only reviewed provenance — 2026-07-28, first same-day record";

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
  LANE5_C1_ROW,
  LANE5_G1_ROW,
  LANE5_SOC_ROW,
  LANE5_FABRIC_ROW,
];

//
// Rule group 1 — the two-sided base+1 disclosure in §2.8 and §7.1.
//

test("records the Lane 5 base-plus-one publication disposition", () => {
  const result = validate();

  assert.equal(result.line1Publication.base, W1_D04_CONTROL_BASE);
  assert.equal(result.line1Publication.abbreviatedBase, "8fe4cb0");
  assert.equal(result.line1Publication.baseNewCommits, 25);
  assert.equal(result.line1Publication.laneCommitsAheadOfBase, 1);
  assert.equal(result.line1Publication.predictedNewCommits, 26);
  assert.equal(result.line1Publication.selfIdentityStated, false);
});

test("derives the predicted new-commit count from base plus offset, never a literal", () => {
  const result = validate();

  assert.equal(
    result.line1Publication.predictedNewCommits,
    result.line1Publication.baseNewCommits +
      result.line1Publication.laneCommitsAheadOfBase,
  );
});

test("the validator source derives the predicted count and hardcodes no 26", async () => {
  const source = await readFile(
    join(repositoryRoot, "tools", "operations", "validate-w1-control.mjs"),
    "utf8",
  );

  assert.match(
    source,
    /PACKET_LINE1_PREDICTED_NEW_COMMITS\s*=\s*\n?\s*PACKET_LINE1_BASE_NEW_COMMITS \+ PACKET_LANE_COMMITS_AHEAD_OF_BASE/,
  );
  assert.doesNotMatch(
    source,
    /PACKET_LINE1_PREDICTED_NEW_COMMITS\s*=\s*26\b/,
  );
});

test("rejects a packet §2.8 that drops the base-plus-one disclosure", () => {
  const drifted = replaceUnique(
    packetText,
    "**Base-plus-one disclosure — read with §7.1.**",
    "**Note.**",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§2\.8 must carry the base-plus-one disclosure/,
  );
});

test("rejects a packet §7.1 that drops the base-plus-one disclosure", () => {
  const drifted = replaceUnique(
    packetText,
    "**Base-plus-one disclosure — read with §2.8.**",
    "**Note.**",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§7\.1 must carry the base-plus-one disclosure/,
  );
});

test("rejects a base-plus-one disclosure that omits the mandatory external re-confirmation", () => {
  // Both §2.8 and §7.1 carry this clause, so the anchor is qualified with the
  // §2.8-only sentence ahead of it — a bare clause would silently mutate §2.8
  // by first-occurrence replacement and prove nothing about which side failed.
  const drifted = replaceUnique(
    packetText,
    "corpus** — a commit cannot contain its own identity. A fresh external " +
      "`git rev-list --count`\nre-confirmation is **mandatory before any push**",
    "corpus** — a commit cannot contain its own identity. Re-confirmation is " +
      "optional",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§2\.8 must carry the base-plus-one disclosure/,
  );
});

//
// Rule group 2 — no present-tense current-`HEAD` claim about the base.
//

test("rejects a packet that calls the immutable base the current control HEAD", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_LOCAL_PROVENANCE_HEADING,
    // Inside the Lane 5 region: above the heading it would fall in §2.9, whose
    // narrow allowlist would reject the digest before this rule ran.
    PACKET_LOCAL_PROVENANCE_HEADING +
      "\n\nThe current control `HEAD` is " +
      "`8fe4cb02e0119224205a86631db7c481f7638c23`.",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /names the immutable base as a present-tense current control `HEAD`/,
  );
});

test("rejects a packet that says the control HEAD remains the base", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_LOCAL_PROVENANCE_HEADING,
    PACKET_LOCAL_PROVENANCE_HEADING +
      "\n\nControl `HEAD` remains " +
      "`8fe4cb02e0119224205a86631db7c481f7638c23`.",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /names the immutable base as a present-tense current control `HEAD`/,
  );
});

//
// Rule group 3 — exactly four local-provenance rows, byte-consistent, with the
// mandatory status tokens, in all three control documents.
//

test("records the four local-only reviewed provenance commits", () => {
  const result = validate();

  assert.equal(result.localProvenance.rows, 4);
  assert.equal(result.localProvenance.integrated, false);
  assert.equal(result.localProvenance.pushed, false);
  assert.equal(result.localProvenance.merged, false);
  assert.equal(result.localProvenance.released, false);
  assert.deepEqual(result.localProvenance.lanes, [
    "W1-C1 correction",
    "W1-G1 correction",
    "SOC vendor conformance",
    "Fabric vendor conformance",
  ]);
});

for (const [index, row] of LANE5_PROVENANCE_ROWS.entries()) {
  test(`rejects a packet local-provenance table missing row ${index + 1}`, () => {
    const drifted = replaceUnique(packetText, row + "\n", "");

    assert.throws(
      () => validate({ packetText: drifted }),
      /local-provenance table must carry exactly four rows/,
    );
  });
}

test("rejects a board local-provenance table missing a row", () => {
  const drifted = replaceUnique(boardText, LANE5_G1_ROW + "\n", "");

  assert.throws(
    () => validate({ boardText: drifted }),
    /local-provenance table must carry exactly four rows/,
  );
});

test("rejects a register local-provenance table missing a row", () => {
  const drifted = replaceUnique(e2RegisterText, LANE5_SOC_ROW + "\n", "");

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /local-provenance table must carry exactly four rows/,
  );
});

test("rejects a fifth local-provenance row", () => {
  const drifted = replaceUnique(
    packetText,
    LANE5_FABRIC_ROW + "\n",
    LANE5_FABRIC_ROW +
      "\n| Suite Lane 5 control | `deadbeefdeadbeefdeadbeefdeadbeefdeadbeef`, " +
      "parent `8fe4cb02e0119224205a86631db7c481f7638c23`, tree " +
      "`cafebabecafebabecafebabecafebabecafebabe` | exactly 5 paths | " +
      "`LOCAL-ONLY` |\n",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /local-provenance table must carry exactly four rows/,
  );
});

test("rejects a local-provenance row that drops the NOT INTEGRATED token", () => {
  const drifted = replaceUnique(
    packetText,
    LANE5_G1_ROW,
    LANE5_G1_ROW.replace("`NOT INTEGRATED` · ", ""),
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /local-provenance row .* must carry the `NOT INTEGRATED` status token/,
  );
});

test("rejects a local-provenance row that drops the LOCAL-ONLY token", () => {
  const drifted = replaceUnique(
    packetText,
    LANE5_SOC_ROW,
    LANE5_SOC_ROW.replace("`LOCAL-ONLY` · ", ""),
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /local-provenance row .* must carry the `LOCAL-ONLY` status token/,
  );
});

test("rejects a local-provenance row that drops the independent-review token", () => {
  const drifted = replaceUnique(
    packetText,
    LANE5_C1_ROW,
    LANE5_C1_ROW.replace("`INDEPENDENT REVIEW PASS` · ", ""),
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /local-provenance row .* must carry the `INDEPENDENT REVIEW PASS` status token/,
  );
});

test("rejects a vendor row that drops its conformance-only token", () => {
  const drifted = replaceUnique(
    packetText,
    LANE5_FABRIC_ROW,
    LANE5_FABRIC_ROW.replace(" · `CONFORMANCE-ONLY`", ""),
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /local-provenance row .* must carry the `CONFORMANCE-ONLY` status token/,
  );
});

test("rejects a local-provenance section claiming a commit has been pushed", () => {
  const drifted = replaceUnique(
    packetText,
    LANE5_G1_ROW + "\n",
    LANE5_G1_ROW + "\n\nThe W1-G1 correction has been pushed to `origin`.\n",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /local-provenance section claims a Lane 5 commit is pushed, merged, released or integrated/,
  );
});

test("rejects a local-provenance section claiming a commit is integrated", () => {
  const drifted = replaceUnique(
    boardText,
    LANE5_SOC_ROW + "\n",
    LANE5_SOC_ROW + "\n\nThe SOC vendor commit is integrated.\n",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /local-provenance section claims a Lane 5 commit is pushed, merged, released or integrated/,
  );
});

test("rejects a local-provenance section claiming contract re-acceptance", () => {
  const drifted = replaceUnique(
    packetText,
    LANE5_C1_ROW + "\n",
    LANE5_C1_ROW +
      "\n\nThe W1-C1 correction is contract-reaccepted at v0.1.0.\n",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /local-provenance section claims a contract re-acceptance/,
  );
});

//
// Rule group 4 — no new Lane 5 40-hex identity inside the legacy guarded
// regions. §2.9, §4.4 and board §14.32.2 keep their narrow allowlist; the four
// full identities live only in the bounded Lane 5 sections.
//

test("rejects a Lane 5 commit identity inside the legacy packet §2.9 region", () => {
  const drifted = replaceUnique(
    packetText,
    "**State 2 — the W0-I01C correction, committed local-only.**",
    "**State 2 — the W0-I01C correction, committed local-only at " +
      "`20cfa36c503e5a95341c80653d25d2000d65c9fe`.**",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /must not carry the Lane 5 local-provenance identity/,
  );
});

test("rejects a Lane 5 commit identity inside the legacy register §4.4 region", () => {
  const drifted = replaceUnique(
    e2RegisterText,
    "### 4.4 Pending W1-C1 correction candidate — not a superseding value",
    "### 4.4 Pending W1-C1 correction candidate — not a superseding value\n\n" +
      "See `71857395332fabe041896ca0700fbf7a2bf612d3`.",
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /must not carry the Lane 5 local-provenance identity/,
  );
});

//
// Rule group 5 — no surviving uncommitted-generation claim outside explicitly
// dated history, across all three control documents.
//

test("rejects an undated surviving uncommitted-generation claim in the packet", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_LOCAL_PROVENANCE_HEADING,
    "The W1-C1 correction has no commit object.\n\n" +
      PACKET_LOCAL_PROVENANCE_HEADING,
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /carries the withdrawn uncommitted-generation claim/,
  );
});

test("rejects an undated surviving uncommitted-generation claim on the board", () => {
  const drifted = replaceUnique(
    boardText,
    BOARD_LOCAL_PROVENANCE_HEADING,
    "The correction adds no new commit to the graph.\n\n" +
      BOARD_LOCAL_PROVENANCE_HEADING,
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /carries the withdrawn uncommitted-generation claim/,
  );
});

test("rejects an undated surviving uncommitted-generation claim in the register", () => {
  const drifted = replaceUnique(
    e2RegisterText,
    REGISTER_LOCAL_PROVENANCE_HEADING,
    "It is an uncommitted working-tree overlay.\n\n" +
      REGISTER_LOCAL_PROVENANCE_HEADING,
  );

  assert.throws(
    () => validate({ e2RegisterText: drifted }),
    /carries the withdrawn uncommitted-generation claim/,
  );
});

//
// Rule group 5b — exemption scope. A markdown table carries no blank line, so a
// paragraph-scoped scanner treats the whole table as one unit and a single
// dated or self-withdrawing row exempts every sibling row, including a false
// live one. Each row must carry its own anchor.
//

// A §9 status-and-ceiling row. Its sibling rows carry `2026-07-26`,
// `2026-07-27` and the two window dates, so under whole-table exemption this
// false live claim would pass.
const PACKET_DATED_SIBLING_ROW =
  "| W1 window | **2026-08-01 → 2026-08-23**, unchanged |";

// A §14.9.3 measured-evidence row. Its sibling row dates itself `2026-07-26`.
const BOARD_DATED_SIBLING_ROW =
  "| `git diff --check` | clean — no whitespace or conflict-marker error |";

test("rejects a false live generation claim in a packet table row whose sibling rows are dated", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_DATED_SIBLING_ROW,
    `${PACKET_DATED_SIBLING_ROW}\n` +
      "| Lane 5 generation | this record holds no commit object |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /withdrawn uncommitted-generation claim "no commit object"[\s\S]*sibling row in the same table exempts nothing/,
  );
});

test("rejects a false live generation claim in a board table row whose sibling rows are dated", () => {
  const drifted = replaceUnique(
    boardText,
    BOARD_DATED_SIBLING_ROW,
    `${BOARD_DATED_SIBLING_ROW}\n` +
      "| Lane 5 generation | this reconciliation adds **no commit** to any line |",
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /W1 board carries the withdrawn uncommitted-generation claim "adds \*\*no commit\*\*"/,
  );
});

test("rejects a false live generation claim beside a self-withdrawing row in the same table", () => {
  // The §9.1 inventory has to name the retired phrases verbatim in order to
  // withdraw them, and its rule-18 row carries `withdrawn` itself. That anchor
  // must exempt the row that carries it and nothing else — the defect this
  // guards against is one such row clearing a whole table.
  const drifted = replaceUnique(
    packetText,
    PACKET_DATED_SIBLING_ROW,
    `${PACKET_DATED_SIBLING_ROW}\n` +
      "| Retired wording | the `uncommitted working-tree overlay` phrasing is withdrawn |\n" +
      "| Lane 5 generation | this record is an uncommitted working-tree overlay |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /withdrawn uncommitted-generation claim "uncommitted working-tree overlay"/,
  );
});

test("keeps a table row that carries both its own date and its own generation claim legal", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_DATED_SIBLING_ROW,
    `${PACKET_DATED_SIBLING_ROW}\n` +
      "| Historical note | recorded 2026-07-27 as **no new commit**; superseded by `20cfa36` |",
  );

  assert.doesNotThrow(() => validate({ packetText: drifted }));
});

test("keeps dated prose history whose date sits in a different sentence from the claim legal", () => {
  // Board §1.24 states the date, and the supersession, in sentences separate
  // from the `no new commit` claim. Prose keeps paragraph-level exemption on
  // purpose; row-level scoping applies to table rows only.
  assert.ok(
    boardText.includes(
      "**no new commit**, exactly 16 modified tracked paths and zero staged",
    ),
    "board §1.24 must retain its dated W1-D04C generation history",
  );

  assert.doesNotThrow(() => validate());
});

//
// Rule group 6 — aggregates and member sets are unique per document and stay
// bound to their own lane. Conflation is the failure mode this prevents.
//

test("rejects a duplicated Lane 5 content aggregate", () => {
  const drifted = replaceUnique(
    packetText,
    LANE5_SOC_ROW + "\n",
    LANE5_SOC_ROW +
      "\n\nThe SOC vendor conformance aggregate is " +
      "`be19bad6d1c6e14edb4e3a5a810806a3670124cb442808abe87a977cc612cfd3`.\n",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /names the SOC vendor conformance content aggregate 2 times/,
  );
});

test("rejects a content aggregate attached to the wrong lane", () => {
  // Swap the two aggregates between rows rather than overwriting one. Each
  // value still appears exactly once, so the once-per-document rule passes and
  // the wrong-lane rule is the one actually under test.
  const G1_AGGREGATE =
    "`54e90e27b546e569156c13c3f7455bd99e1a5168e7e62b139422c5fed95e50cc`";
  const FABRIC_AGGREGATE =
    "`428a7a9b6cb06ed44469e148041ad56b58949a25cd01fb0ef617eb524ac0a44e`";
  const withSwappedG1 = replaceUnique(
    packetText,
    LANE5_G1_ROW,
    LANE5_G1_ROW.replace(G1_AGGREGATE, FABRIC_AGGREGATE),
  );
  const drifted = replaceUnique(
    withSwappedG1,
    LANE5_FABRIC_ROW,
    LANE5_FABRIC_ROW.replace(FABRIC_AGGREGATE, G1_AGGREGATE),
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /is not stated on its own lane row/,
  );
});

test("rejects a member set conflated across the two correction lanes", () => {
  // Exchange two lane-bound digests between the C1 and G1 rows. Both still
  // appear exactly once, so each is caught for sitting on the other lane's row.
  const C1_MANIFEST =
    "`403f7b0df42b9c0768f048bb71dedeebdd3f930d9a39dcf4ac935335b85b7d2e`";
  const G1_MEMBER_SET =
    "`a285fa8e4850999dc013b03506ed1e62f5c7bb4209d198a4e16fa02c446b43f4`";
  const withSwappedG1 = replaceUnique(
    packetText,
    LANE5_G1_ROW,
    LANE5_G1_ROW.replace(G1_MEMBER_SET, C1_MANIFEST),
  );
  const drifted = replaceUnique(
    withSwappedG1,
    LANE5_C1_ROW,
    LANE5_C1_ROW.replace(C1_MANIFEST, G1_MEMBER_SET),
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /is not stated on its own lane row/,
  );
});

test("keeps the C1 pre-commit working-tree aggregate at exactly one full occurrence", () => {
  assert.equal(
    countOccurrences(
      packetText,
      "76ef51d97dced58eda98b1144ca72f98cf81c7caff6cc51ffc3eab50114c940a",
    ),
    1,
  );
  assert.equal(
    countOccurrences(
      boardText,
      "76ef51d97dced58eda98b1144ca72f98cf81c7caff6cc51ffc3eab50114c940a",
    ),
    0,
  );
});

//
// Rule group 7 — §2.8 and §7.1 must agree on the LINE 2 and SOC tips and
// counts, exactly as they already must for Suite LINE 1.
//

test("records the agreed LINE 2 and SOC publication figures", () => {
  const result = validate();

  assert.deepEqual(result.line2Publication, {
    tip: "7185739",
    newCommits: 7,
  });
  assert.deepEqual(result.socPublication, {
    tip: "5da251d",
    newCommits: 11,
  });
});

test("rejects a packet whose §7.1 LINE 2 tip disagrees with §2.8", () => {
  const drifted = replaceUnique(
    packetText,
    "| 2 | Suite | LINE 2 `codex/w1-g1-c1-repin-r1` | `7185739` | 7 |",
    "| 2 | Suite | LINE 2 `codex/w1-g1-c1-repin-r1` | `a976a20` | 7 |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§7\.1 proposes publishing Suite LINE 2 at/,
  );
});

test("rejects a packet whose §7.1 SOC count disagrees with §2.8", () => {
  const drifted = replaceUnique(
    packetText,
    "| `5da251d` | 11 | subsumes all SOC branches",
    "| `5da251d` | 10 | subsumes all SOC branches",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /§7\.1 records 10 new SOC commits while §2\.8 measures 11/,
  );
});

//
// Rule group 8 — no self identity minted for the Lane 5 record itself.
//

test("rejects a minted Lane 5 self commit SHA", () => {
  const drifted = replaceUnique(
    packetText,
    PACKET_LOCAL_PROVENANCE_HEADING,
    // Inserted *inside* the Lane 5 region. Placing it above the heading would
    // land in §2.9, whose narrow allowlist would intercept the digest before
    // the self-identity guard ever ran.
    PACKET_LOCAL_PROVENANCE_HEADING +
      "\n\nThis record's commit " +
      "`1234567890abcdef1234567890abcdef12345678` records the reconciliation.",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /mints a self identity for the Lane 5 record/,
  );
});

test("rejects an embedded Lane 5 scope aggregate value", () => {
  const drifted = replaceUnique(
    boardText,
    BOARD_LOCAL_PROVENANCE_HEADING,
    "`SCOPE-AGG-SHA256/v1` " +
      "`0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`\n\n" +
      BOARD_LOCAL_PROVENANCE_HEADING,
  );

  assert.throws(
    () => validate({ boardText: drifted }),
    /mints a self identity for the Lane 5 record/,
  );
});

//
// Rule group 9 — refreshed §2.8 topology and the derived post-Lane 5
// prediction.
//

test("records the re-measured push-delta topology", () => {
  const result = validate();

  assert.deepEqual(result.pushDelta, {
    rows: 6,
    perLineSum: 63,
    suiteUnion: 31,
    uniqueUnion: 59,
    predictedPerLineSum: 64,
    predictedUniqueUnion: 60,
  });
});

test("derives the post-Lane 5 predictions from the measured figures plus one", () => {
  const result = validate();

  assert.equal(
    result.pushDelta.predictedPerLineSum,
    result.pushDelta.perLineSum + result.line1Publication.laneCommitsAheadOfBase,
  );
  assert.equal(
    result.pushDelta.predictedUniqueUnion,
    result.pushDelta.uniqueUnion + result.line1Publication.laneCommitsAheadOfBase,
  );
});

test("rejects a §2.8 push-delta table whose rows no longer sum to the stated total", () => {
  const drifted = replaceUnique(
    packetText,
    "| Cyber AI | `2baba72` | 23 | **12** |",
    "| Cyber AI | `2baba72` | 23 | **13** |",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /push-delta rows sum to 64 genuinely-new commits/,
  );
});

// The two Lane 5 rules added to the §9.1 inventory by this lane. Rule 21 is the
// last row, so removing it leaves the remaining numbering contiguous and the
// omission is caught only by the byte-exact row pin; rule 19 is a middle row,
// so removing it also breaks the 1..21 contiguity. Both paths are exercised.
const PACKET_ENFORCED_RULE_19_ROW =
  "| 19 | all three control documents | every Lane 5 manifest, member set and content aggregate must appear exactly once and only on its own lane row; no aggregate or member set may be read against two lanes |";
const PACKET_ENFORCED_RULE_21_ROW =
  "| 21 | whole corpus | no self identity for this record — no Lane 5 commit SHA, tree or `SCOPE-AGG-SHA256/v1` value may be stated or predicted anywhere; the predicted count is derived in the validator from base + offset and is never a literal |";

test("reports the full §9.1 machine-enforcement inventory count", () => {
  const result = validate();

  assert.equal(result.enforcementSurface.enforcedRules, 21);
  assert.deepEqual(result.enforcementSurface.unenforcedNoGo, [16, 17]);
  assert.equal(result.enforcementSurface.readsLiveGit, false);
});

test("rejects a §9.1 inventory that omits a Lane 5 enforced rule", () => {
  const drifted = replaceUnique(
    packetText,
    `\n${PACKET_ENFORCED_RULE_21_ROW}`,
    "",
  );

  assert.equal(countOccurrences(drifted, "\n| 21 | "), 0);
  assert.throws(
    () => validate({ packetText: drifted }),
    /rule 21 is missing or has drifted[\s\S]*underclaim of the enforcement surface/,
  );
});

test("rejects a §9.1 inventory that omits a middle rule and breaks the row numbering", () => {
  const drifted = replaceUnique(
    packetText,
    `\n${PACKET_ENFORCED_RULE_19_ROW}`,
    "",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /numbered 1\.\.21 contiguously; row 19 reads 20/,
  );
});

//
// Rule group 10 — W1 C1/G1 + corrected C2 local-integration reconciliation.
// These assertions deliberately precede the production change: they must be
// RED on the two-merge rehearsal tree until CONTROL9 and CI3 are prepared.
//

test("requires the bounded W1 reconciliation application with exact rehearsal identities", async () => {
  const reconciliationText = await readFile(
    join(
      repositoryRoot,
      "docs",
      "adr",
      "W1-CONTRACT-RECONCILIATION-APPLICATION.md",
    ),
    "utf8",
  );

  assert.match(
    reconciliationText,
    /900d83a61515f37ae117e04763da1881cba90b7b/,
  );
  assert.match(
    reconciliationText,
    /a297646ec6d4901c8861d28b5ec8736f65902b70/,
  );
  assert.match(
    reconciliationText,
    /ACCEPTED-AND-LOCALLY-INTEGRATED — REHEARSAL ONLY — NONCANONICAL/,
  );
});

test("requires the delegated governor disposition for one exact local-only commit", () => {
  const result = validate();

  assert.match(
    w1ReconciliationApplicationText,
    /^## 6\. Delegated-governor disposition$/m,
  );
  assert.match(
    w1ReconciliationApplicationText,
    /DELEGATED-GOVERNOR-ACCEPTED/,
  );
  assert.deepEqual(result.w1ReconciliationApplication.governance, {
    decision: "DELEGATED-GOVERNOR-ACCEPTED",
    localCommitAuthorized: true,
    exactPathCount: 12,
    independentRereviewCompleted: false,
    codexFallbackAccepted: true,
    pushed: false,
    merged: false,
    released: false,
  });
});

test("rejects removal of the delegated governor risk disposition", () => {
  const drifted = w1ReconciliationApplicationText.replace(
    "DELEGATED-GOVERNOR-ACCEPTED",
    "FOUNDER-DECISION-PENDING",
  );

  assert.throws(
    () => validate({ w1ReconciliationApplicationText: drifted }),
    /delegated-governor disposition/,
  );
});

test("requires the unchanged-lockfile dependency-audit blocker disclosure", () => {
  const result = validate();

  assert.match(
    w1ReconciliationApplicationText,
    /GHSA-mh99-v99m-4gvg/,
  );
  assert.deepEqual(result.w1ReconciliationApplication.security, {
    lockfileChanged: false,
    auditHigh: 13,
    auditCritical: 0,
    rootAdvisory: "GHSA-mh99-v99m-4gvg",
    localEvidenceCommitBlocked: false,
    ciActivationBlocked: true,
  });
});

test("requires live-Git topology enforcement below the exact two-merge rehearsal tip", async () => {
  const result = await validateW1ControlFiles(repositoryRoot);

  assert.equal(result.enforcementSurface.readsLiveGit, true);
  assert.deepEqual(result.reconciliationTopology, {
    controlBase: "b2caf77c3cd96beb7383cc3d93844d771262ea5f",
    c1g1Tip: "71857395332fabe041896ca0700fbf7a2bf612d3",
    correctedC2Tip: "5a1ed0001a5714b7f099aeaff3f5a74cb67c068a",
    mergeOne: "87efae7898bd14e9aa9a2866380a9973d8b3e5bc",
    mergeOneTree: "abb4d16d1c6038ccc33931c009628a47b2b0bd68",
    mergeTwo: "900d83a61515f37ae117e04763da1881cba90b7b",
    mergeTwoTree: "a297646ec6d4901c8861d28b5ec8736f65902b70",
    canonicalMerge: "28c564eb9b6853b73a18a59a2e84ba58fd67816a",
    canonicalMergeTree: "f222fad6bc6d3682684a0975f47a5415f7f716dc",
    repositoryHeadDescendsFromRehearsal: true,
    repositoryHeadDescendsFromCanonicalMerge: true,
    locallyIntegrated: true,
    canonical: true,
  });
});

test("requires a current canonical-integration supersession record after PR 1", async () => {
  const currentLifecycle =
    "CANONICAL-INTEGRATED — STATIC CONTRACT AND CONTROL EVIDENCE ONLY";
  const canonicalMerge = "28c564eb9b6853b73a18a59a2e84ba58fd67816a";

  for (const [text, label] of [
    [w1ReconciliationApplicationText, "W1 reconciliation application"],
    [boardText, "W1 board"],
    [e2RegisterText, "W1 evidence register"],
    [packetText, "blocker-4 packet"],
    [adrReadmeText, "ADR catalog"],
  ]) {
    assert.match(
      text,
      new RegExp(currentLifecycle),
      `${label} must carry the current canonical-integration lifecycle`,
    );
    assert.match(
      text,
      new RegExp(canonicalMerge),
      `${label} must pin the canonical PR 1 merge`,
    );
  }

  const result = await validateW1ControlFiles(repositoryRoot);
  assert.deepEqual(result.reconciliationTopology, {
    controlBase: "b2caf77c3cd96beb7383cc3d93844d771262ea5f",
    c1g1Tip: "71857395332fabe041896ca0700fbf7a2bf612d3",
    correctedC2Tip: "5a1ed0001a5714b7f099aeaff3f5a74cb67c068a",
    mergeOne: "87efae7898bd14e9aa9a2866380a9973d8b3e5bc",
    mergeOneTree: "abb4d16d1c6038ccc33931c009628a47b2b0bd68",
    mergeTwo: "900d83a61515f37ae117e04763da1881cba90b7b",
    mergeTwoTree: "a297646ec6d4901c8861d28b5ec8736f65902b70",
    canonicalMerge,
    canonicalMergeTree: "f222fad6bc6d3682684a0975f47a5415f7f716dc",
    repositoryHeadDescendsFromRehearsal: true,
    repositoryHeadDescendsFromCanonicalMerge: true,
    locallyIntegrated: true,
    canonical: true,
  });
});

test("requires canonical CI wiring for all three W1 validators and exactly 98 tests", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);

  assert.match(workflowText, /name: Checkout contract topology/);
  assert.match(workflowText, /fetch-depth: 0/);
  assert.match(workflowText, /npm run test:w1-contracts/);
  assert.match(packageText, /"validate:w1:alert-context"/);
  assert.match(packageText, /"validate:w1:alert-context-transport"/);
  assert.match(packageText, /"validate:w1:investigation-lifecycle"/);
  assert.match(packageText, /"test:w1-contracts"/);
  assert.match(orchestratorText, /validate-alert-context\.mjs/);
  assert.match(orchestratorText, /validate-alert-context-transport\.mjs/);
  assert.match(
    orchestratorText,
    /validate-investigation-lifecycle-proposal\.mjs/,
  );
});

test("rejects live Git topology with the first merge parents reversed", () => {
  assert.throws(
    () =>
      validateW1ReconciliationTopology({
        mergeOneParents: [
          "71857395332fabe041896ca0700fbf7a2bf612d3",
          "b2caf77c3cd96beb7383cc3d93844d771262ea5f",
        ],
        mergeOneTree: "abb4d16d1c6038ccc33931c009628a47b2b0bd68",
        mergeTwoParents: [
          "87efae7898bd14e9aa9a2866380a9973d8b3e5bc",
          "5a1ed0001a5714b7f099aeaff3f5a74cb67c068a",
        ],
        mergeTwoTree: "a297646ec6d4901c8861d28b5ec8736f65902b70",
        ancestryComplete: true,
        headDescendsFromRehearsal: true,
      }),
    /mergeOneParents is wrong/,
  );
});

test("rejects live Git topology with the second merge parents reversed", () => {
  assert.throws(
    () =>
      validateW1ReconciliationTopology({
        mergeOneParents: [
          "b2caf77c3cd96beb7383cc3d93844d771262ea5f",
          "71857395332fabe041896ca0700fbf7a2bf612d3",
        ],
        mergeOneTree: "abb4d16d1c6038ccc33931c009628a47b2b0bd68",
        mergeTwoParents: [
          "5a1ed0001a5714b7f099aeaff3f5a74cb67c068a",
          "87efae7898bd14e9aa9a2866380a9973d8b3e5bc",
        ],
        mergeTwoTree: "a297646ec6d4901c8861d28b5ec8736f65902b70",
        ancestryComplete: true,
        headDescendsFromRehearsal: true,
      }),
    /mergeTwoParents is wrong/,
  );
});

test("rejects a repository HEAD outside the exact rehearsal ancestry", () => {
  assert.throws(
    () =>
      validateW1ReconciliationTopology({
        mergeOneParents: [
          "b2caf77c3cd96beb7383cc3d93844d771262ea5f",
          "71857395332fabe041896ca0700fbf7a2bf612d3",
        ],
        mergeOneTree: "abb4d16d1c6038ccc33931c009628a47b2b0bd68",
        mergeTwoParents: [
          "87efae7898bd14e9aa9a2866380a9973d8b3e5bc",
          "5a1ed0001a5714b7f099aeaff3f5a74cb67c068a",
        ],
        mergeTwoTree: "a297646ec6d4901c8861d28b5ec8736f65902b70",
        ancestryComplete: true,
        headDescendsFromRehearsal: false,
      }),
    /repository HEAD does not descend from the exact rehearsal tip/,
  );
});

test("fails closed when required live Git objects cannot be read", () => {
  assert.throws(
    () =>
      readW1ReconciliationTopology(
        join(repositoryRoot, "path-that-is-not-a-git-repository"),
      ),
    /required object b2caf77c3cd96beb7383cc3d93844d771262ea5f failed closed/,
  );
});

test("rejects stale pre-BSR1 ed95e51 as the current corrected C2 tip", () => {
  const drifted = w1ReconciliationApplicationText.replaceAll(
    "5a1ed0001a5714b7f099aeaff3f5a74cb67c068a",
    "ed95e5102603ccc0c8313c670e6f07fdf0d6f7b4",
  );

  assert.throws(
    () => validate({ w1ReconciliationApplicationText: drifted }),
    /missing exact pin 5a1ed0001a5714b7f099aeaff3f5a74cb67c068a/,
  );
});

test("rejects a stale or fabricated corrected C2 aggregate", () => {
  const drifted = replaceUnique(
    w1ReconciliationApplicationText,
    "d741f22470a59bde5f0761dd6f3309acb9bb9b851970bc95c5228efd135a5449",
    "0fcac6ede9b2c3712bb7e989c227c91c6bd37c115a2bce4cb41996587f24b42e",
  );

  assert.throws(
    () => validate({ w1ReconciliationApplicationText: drifted }),
    /missing exact pin d741f224/,
  );
});

test("rejects candidate-only wording for the accepted rehearsal lifecycle", () => {
  const drifted = replaceUnique(
    w1ReconciliationApplicationText,
    "- **Lifecycle:** `ACCEPTED-AND-LOCALLY-INTEGRATED — REHEARSAL ONLY — NONCANONICAL`",
    "- **Lifecycle:** `CANDIDATE ONLY — NOT ACCEPTED`",
  );

  assert.throws(
    () => validate({ w1ReconciliationApplicationText: drifted }),
    /exact rehearsal-only lifecycle/,
  );
});

test("rejects a current reconciliation record that falsely says CI is not wired", () => {
  const drifted = replaceUnique(
    packetText,
    "CI3 locally wires the three standalone",
    "CI: NOT WIRED. CI3 locally wires the three standalone",
  );

  assert.throws(
    () => validate({ packetText: drifted }),
    /falsely claims CI is not wired/,
  );
});

test("rejects missing immutable historical provenance", () => {
  const drifted = replaceUnique(
    w1ReconciliationApplicationText,
    "3a2c71555a423465855ffaddcb663c8b704dbfbd",
    "0000000000000000000000000000000000000000",
  );

  assert.throws(
    () => validate({ w1ReconciliationApplicationText: drifted }),
    /must preserve historical provenance 3a2c715/,
  );
});

test("rejects CI3 when a required W1 validator is absent from the orchestrator", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);
  const drifted = orchestratorText.replace(
    "  'validate-alert-context-transport.mjs',\n",
    "",
  );

  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText,
        packageText,
        orchestratorText: drifted,
      }),
    /orchestrator is missing validate-alert-context-transport\.mjs/,
  );
});

test("rejects CI3 shallow checkout that can hide required merge objects", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);
  const drifted = workflowText.replace(
    "      - name: Checkout contract topology\n" +
      "        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (Node 24 action runtime)\n" +
      "        with:\n" +
      "          fetch-depth: 0",
    "      - name: Checkout contract topology\n" +
      "        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (Node 24 action runtime)",
  );

  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: drifted,
        packageText,
        orchestratorText,
      }),
    /missing \/fetch-depth: 0\//,
  );
});

test("requires the CI3 test command to measure and enforce exactly 98 completed tests", async () => {
  const packageDocument = JSON.parse(
    await readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
  );

  assert.equal(
    packageDocument.scripts["test:w1-contracts"],
    "node validate.mjs --test-w1-contracts",
  );
});

test("requires CI3 to gate the patched dependency adapter and a high-severity audit", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);

  assert.deepEqual(
    validateW1CiWiring({ workflowText, packageText, orchestratorText }),
    {
      validators: 3,
      tests: 98,
      fetchDepth: 0,
      node: "24.18.1",
      dependencyCompatibilityTests: 2,
      dependencyAuditLevel: "high",
      hostedRunClaimed: false,
    },
  );

  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: workflowText.replace(
          "        run: npm audit --audit-level=high\n",
          "",
        ),
        packageText,
        orchestratorText,
      }),
    /npm audit --audit-level=high/,
  );
});

test("rejects a required contract command moved into a later sibling job", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);
  const drifted = workflowText
    .replace(
      "      - name: Test accepted W1 static contract lines (exactly 98 tests)\n" +
        "        working-directory: tools/contract-validation\n" +
        "        run: npm run test:w1-contracts\n",
      "",
    )
    .concat(
      "\n  unrelated:\n" +
        "    runs-on: ubuntu-latest\n" +
        "    steps:\n" +
        "      - run: npm run test:w1-contracts\n",
    );

  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: drifted,
        packageText,
        orchestratorText,
      }),
    /contracts job is missing \/run: npm run test:w1-contracts\//,
  );
});

test("rejects a suppressed secret-scan job", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);
  const drifted = workflowText.replace(
    "  secret-scan:\n",
    "  secret-scan:\n    if: false\n",
  );

  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: drifted,
        packageText,
        orchestratorText,
      }),
    /must not suppress a required job or step/,
  );
});

test("requires canonical validation to execute the live-Git W1 control validator", async () => {
  const orchestratorText = await readFile(
    join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
    "utf8",
  );

  assert.match(
    orchestratorText,
    /'\.\.\/\.\.\/tools\/operations\/validate-w1-control\.mjs'/,
  );
});

test("pins CI actions to reviewed Node 24 runtime commits", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);

  assert.equal(
    (
      workflowText.match(
        /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/g,
      ) ?? []
    ).length,
    2,
  );
  assert.equal(
    (
      workflowText.match(
        /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/g,
      ) ?? []
    ).length,
    1,
  );
  assert.doesNotMatch(
    workflowText,
    /actions\/(?:checkout@11bd71901bbe5b1630ceea73d27597364c9af683|setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af)/,
  );
  assert.match(workflowText, /node-version: "24\.18\.1"/);

  const drifted = workflowText.replace(
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    "actions/cache@0000000000000000000000000000000000000000",
  );
  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: drifted,
        packageText,
        orchestratorText,
      }),
    /action is outside the reviewed allowlist: actions\/cache@/,
  );

  const additiveNode20 = workflowText.replace(
    "      - name: Install validators (reproducible, no lifecycle scripts)",
    "      - name: Deprecated additive checkout\n" +
      "        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683\n\n" +
      "      - name: Install validators (reproducible, no lifecycle scripts)",
  );
  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: additiveNode20,
        packageText,
        orchestratorText,
      }),
    /must not reintroduce a superseded Node 20 action-runtime pin/,
  );

  const additivePinnedAction = workflowText.replace(
    "      - name: Install validators (reproducible, no lifecycle scripts)",
    "      - name: Unexpected pinned action\n" +
      "        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020\n\n" +
      "      - name: Install validators (reproducible, no lifecycle scripts)",
  );
  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: additivePinnedAction,
        packageText,
        orchestratorText,
      }),
    /must contain exactly 3 reviewed GitHub action uses; found 4/,
  );

  const trailingWhitespaceBypass = workflowText.replace(
    "      - name: Install validators (reproducible, no lifecycle scripts)",
    "      - name: Trailing-whitespace action\n" +
      "        uses: attacker/action@v1" +
      " \n\n" +
      "      - name: Install validators (reproducible, no lifecycle scripts)",
  );
  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: trailingWhitespaceBypass,
        packageText,
        orchestratorText,
      }),
    /action is not pinned by commit SHA: attacker\/action@v1/,
  );

  const missingCheckout = workflowText.replace(
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  );
  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: missingCheckout,
        packageText,
        orchestratorText,
      }),
    /checkout@.* must occur exactly 2 times; found 1/,
  );

  const renamedRequiredCheck = workflowText.replace(
    "name: contract standards validation",
    "name: renamed contract validation",
  );
  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: renamedRequiredCheck,
        packageText,
        orchestratorText,
      }),
    /must preserve the rendered contracts required-check name/,
  );

  const renamedSecretScanCheck = workflowText.replace(
    "name: secret-scan (gitleaks 8.30.1)",
    "name: renamed secret scan",
  );
  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: renamedSecretScanCheck,
        packageText,
        orchestratorText,
      }),
    /must preserve the rendered secret-scan required-check name/,
  );
});

test("rejects an unreviewed inline GitHub action step", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);
  const inlineAction = workflowText.replace(
    "      - name: Install validators (reproducible, no lifecycle scripts)",
    "      - uses: attacker/action@main\n\n" +
      "      - name: Install validators (reproducible, no lifecycle scripts)",
  );

  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: inlineAction,
        packageText,
        orchestratorText,
      }),
    /action is not pinned by commit SHA: attacker\/action@main/,
  );
});

test("rejects noncanonical GitHub action step syntax", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);
  for (const actionStep of [
    '      - { uses: "attacker/action@main" }',
    '      - "uses": attacker/action@main',
  ]) {
    const drifted = workflowText.replace(
      "      - name: Install validators (reproducible, no lifecycle scripts)",
      `${actionStep}\n\n` +
        "      - name: Install validators (reproducible, no lifecycle scripts)",
    );
    assert.throws(
      () =>
        validateW1CiWiring({
          workflowText: drifted,
          packageText,
          orchestratorText,
        }),
      /action is not pinned by commit SHA: attacker\/action@main/,
    );
  }
});

test("rejects YAML-split and explicit action keys", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);
  for (const actionStep of [
    "      - { uses\n          : attacker/action@main }",
    "      - ? uses\n        : attacker/action@main",
    '      - "\\u0075ses": attacker/action@main',
  ]) {
    const drifted = workflowText.replace(
      "      - name: Install validators (reproducible, no lifecycle scripts)",
      `${actionStep}\n\n` +
        "      - name: Install validators (reproducible, no lifecycle scripts)",
    );
    assert.throws(
      () =>
        validateW1CiWiring({
          workflowText: drifted,
          packageText,
          orchestratorText,
        }),
      /action is not pinned by commit SHA: attacker\/action@main/,
    );
  }

  const reusableJob = workflowText.replace(
    "jobs:\n",
    "jobs:\n  injected:\n    uses: attacker/workflow@main\n\n",
  );
  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: reusableJob,
        packageText,
        orchestratorText,
      }),
    /action is not pinned by commit SHA: attacker\/workflow@main/,
  );

  const aliasedAction = workflowText
    .replace(
      "jobs:\n",
      "x-injected-action: &injected-action\n" +
        "  uses: attacker/action@main\n\n" +
        "jobs:\n",
    )
    .replace(
      "      - name: Install validators (reproducible, no lifecycle scripts)",
      "      - *injected-action\n\n" +
        "      - name: Install validators (reproducible, no lifecycle scripts)",
    );
  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: aliasedAction,
        packageText,
        orchestratorText,
      }),
    /action is not pinned by commit SHA: attacker\/action@main/,
  );
});

test("rejects an unpinned GitHub action even when the line carries a comment", async () => {
  const [workflowText, packageText, orchestratorText] = await Promise.all([
    readFile(join(repositoryRoot, ".github", "workflows", "contracts.yml"), "utf8"),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "package.json"),
      "utf8",
    ),
    readFile(
      join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
      "utf8",
    ),
  ]);
  const drifted = workflowText.replace(
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (Node 24 action runtime)",
    "actions/checkout@v4 # unpinned",
  );

  assert.throws(
    () =>
      validateW1CiWiring({
        workflowText: drifted,
        packageText,
        orchestratorText,
      }),
    /action is not pinned by commit SHA/,
  );
});
