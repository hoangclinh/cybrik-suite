import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  validateW1ControlDocuments,
  validateW1ControlFiles,
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
const sprintPath = join(
  repositoryRoot,
  "docs",
  "adr",
  "ADR-DECISION-SPRINT-2026-07.md",
);
const adrReadmePath = join(repositoryRoot, "docs", "adr", "README.md");

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
  sprintText,
  adrReadmeText,
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
  readFile(sprintPath, "utf8"),
  readFile(adrReadmePath, "utf8"),
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
    sprintText,
    adrReadmeText,
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
// Canonical file read path.
//

test("reads and validates the canonical W1 control files", async () => {
  const result = await validateW1ControlFiles(repositoryRoot);

  assert.equal(result.taskCount, 48);
  assert.deepEqual(result.gateA4Counts, { H: 11, J: 10 });
  assert.equal(result.contractGateDisposition.accepted, true);
  assert.equal(result.contractGateDisposition.pushed, false);
});
