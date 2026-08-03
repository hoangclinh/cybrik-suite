import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_CONDITION_IDS,
  evaluateFabricRuntimeProducerGate,
  validateFabricRuntimeProducerGate,
} from "../validate-fabric-runtime-producer-gate.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, "..", "..", "..");
const packetPath = join(
  repositoryRoot,
  "docs",
  "uat",
  "candidates",
  "runtime-admission-soc-ai-lifecycle-mtls-r1",
  "evidence",
  "04-fabric-runtime-producer-gate.json",
);
const packet = JSON.parse(await readFile(packetPath, "utf8"));
const trustDurabilityPacket = JSON.parse(
  await readFile(
    join(
      repositoryRoot,
      "contracts",
      "compatibility",
      "cybrik-suite-receipt-trust-durability-proposal.v1.manifest.json",
    ),
    "utf8",
  ),
);

function copyPacket() {
  return structuredClone(packet);
}

function validateGate(candidate, designPacket = trustDurabilityPacket) {
  return validateFabricRuntimeProducerGate(candidate, { trustDurabilityPacket: designPacket });
}

test("canonical validation executes the runtime producer gate and its regression suite", async () => {
  const orchestrator = await readFile(
    join(repositoryRoot, "tools", "contract-validation", "validate.mjs"),
    "utf8",
  );
  const stepBlock = orchestrator.match(/const steps = \[([\s\S]*?)\];/);

  assert.ok(stepBlock, "canonical validation must retain a literal closed step inventory");
  assert.match(
    stepBlock[1],
    /'\.\.\/\.\.\/tools\/operations\/validate-fabric-runtime-producer-gate\.mjs'[\s\S]*?'\.\.\/\.\.\/tools\/operations\/tests\/validate-fabric-runtime-producer-gate\.test\.mjs'/,
  );
});

test("committed packet derives implementation GO and runtime HOLD", () => {
  const result = validateGate(copyPacket());

  assert.deepEqual(result, {
    implementationDisposition: "GO",
    runtimeDisposition: "HOLD",
    runtimeAuthorized: false,
    blockerIds: [
      "canonical_tuple_hosted_ci_green",
      "runtime_negative_and_rollback_evidence",
      "coverage_remeasured_current_suite_tree",
    ],
  });
});

test("runtime producer closure is pinned to the reviewed Fabric commit and evidence", () => {
  assert.deepEqual(packet.pins.fabric_candidate, {
    commit: "7f2561e501585bb5d66b9a32d6b9ac2c3a2f94d7",
    tree: "0cd08e52a636ff03586aa30223a623e1f08a836b",
    parent: "e06b19c528c90a375898f8cce6d22ed0124c96da",
    author: "Cybrik Codex Worker <codex-worker@local.invalid>",
    pushed: false,
    merged: false,
  });

  const producer = packet.conditions.find(
    ({ id }) => id === "product_runtime_producer_implemented_reviewed",
  );
  assert.equal(producer.satisfied, true);
  assert.equal(producer.evidence_state, "verified");
  assert.deepEqual(producer.evidence, [
    "cybrik-security-tool-fabric:commit/7f2561e501585bb5d66b9a32d6b9ac2c3a2f94d7",
    "cybrik-security-tool-fabric:tree/0cd08e52a636ff03586aa30223a623e1f08a836b",
    "cybrik-security-tool-fabric:docs/adr/ADR-0005-receipt-trust-durability-runtime-producer-reference.md",
    "cybrik-suite:docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/05-fabric-runtime-producer-review.md",
  ]);
  assert.deepEqual(producer.verification, {
    exact_path_count: 51,
    prospective_patch_sha256:
      "4e52491718b67128f306bf4ab122cb02d962377242bb3c200cd0a87ecd508d1e",
    content_aggregate_sha256:
      "9a54f288348715f0c156437bd974acb6cad62655d6994a96c4ead8a6e75f2f6d",
  });
  assert.match(producer.note, /797 tests/i);
  assert.match(producer.note, /91% branch coverage/i);
  assert.match(producer.note, /P0-P2 clear/i);
  assert.match(producer.note, /not hosted CI or runtime evidence/i);
});

test("runtime producer closure rejects pin, evidence and review-summary drift", () => {
  const mutations = [
    (candidate) => {
      candidate.pins.fabric_candidate.commit = "1".repeat(40);
    },
    (candidate) => {
      candidate.pins.fabric_candidate.author = "Different Reviewer <reviewer@local.invalid>";
    },
    (candidate) => {
      const producer = candidate.conditions.find(
        ({ id }) => id === "product_runtime_producer_implemented_reviewed",
      );
      producer.satisfied = false;
      producer.evidence_state = "missing";
      producer.evidence = [];
    },
    (candidate) => {
      const producer = candidate.conditions.find(
        ({ id }) => id === "product_runtime_producer_implemented_reviewed",
      );
      producer.evidence = ["cybrik-suite:evidence/invented.json"];
    },
    (candidate) => {
      const producer = candidate.conditions.find(
        ({ id }) => id === "product_runtime_producer_implemented_reviewed",
      );
      producer.note = "Reviewed.";
    },
    (candidate) => {
      const producer = candidate.conditions.find(
        ({ id }) => id === "product_runtime_producer_implemented_reviewed",
      );
      producer.verification.content_aggregate_sha256 = "2".repeat(64);
    },
  ];

  for (const mutate of mutations) {
    const candidate = copyPacket();
    mutate(candidate);
    assert.throws(() => validateGate(candidate), /runtime producer closure/);
  }
});

test("design closures are backed by the accepted trust and durability packet", () => {
  assert.equal(
    trustDurabilityPacket["x-cybrik-status"],
    "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED",
  );
  assert.deepEqual(trustDurabilityPacket.acceptance, {
    key_lifecycle_design_accepted: true,
    durable_store_design_accepted: true,
  });
  for (const id of [
    "key_lifecycle_trust_bundle_design_accepted",
    "durable_receipt_store_design_accepted",
  ]) {
    const condition = packet.conditions.find((candidate) => candidate.id === id);
    assert.equal(condition.satisfied, true);
    assert.equal(condition.evidence_state, "verified");
    assert.ok(
      condition.evidence.includes(
        "cybrik-suite:contracts/compatibility/cybrik-suite-receipt-trust-durability-proposal.v1.manifest.json",
      ),
    );
  }

  const proposed = structuredClone(trustDurabilityPacket);
  proposed["x-cybrik-status"] = "PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED";
  proposed["x-cybrik-not-accepted"] = true;
  proposed.acceptance.key_lifecycle_design_accepted = false;
  proposed.acceptance.durable_store_design_accepted = false;
  assert.throws(() => validateGate(copyPacket(), proposed), /accepted not-implemented packet/);
  assert.throws(() => validateGate(copyPacket(), null), /accepted trust\/durability packet/);
});

test("condition inventory is exact, ordered, unique and closed", () => {
  assert.deepEqual(
    packet.conditions.map(({ id }) => id),
    REQUIRED_CONDITION_IDS,
  );

  for (const mutate of [
    (candidate) => candidate.conditions.pop(),
    (candidate) => candidate.conditions.push(structuredClone(candidate.conditions[0])),
    (candidate) => {
      candidate.conditions[0].id = "invented_condition";
    },
    (candidate) => candidate.conditions.reverse(),
  ]) {
    const candidate = copyPacket();
    mutate(candidate);
    assert.throws(
      () => validateGate(candidate),
      /condition inventory/,
    );
  }
});

test("satisfied conditions require non-empty repository-qualified evidence", () => {
  const candidate = copyPacket();
  candidate.conditions[0].evidence = [];
  assert.throws(
    () => validateGate(candidate),
    /satisfied condition.*evidence/,
  );

  const unqualified = copyPacket();
  unqualified.conditions[0].evidence = ["relative/path.md"];
  assert.throws(
    () => validateGate(unqualified),
    /repository-qualified/,
  );
});

test("open conditions cannot carry pass-like evidence state", () => {
  const candidate = copyPacket();
  const open = candidate.conditions.find(({ satisfied }) => !satisfied);
  open.evidence_state = "verified";
  assert.throws(
    () => validateGate(candidate),
    /open condition.*evidence_state/,
  );
});

test("condition phases cannot be reassigned to weaken implementation HOLD", () => {
  const candidate = copyPacket();
  const openImplementationCondition = candidate.conditions.find(
    ({ id }) => id === "key_lifecycle_trust_bundle_design_accepted",
  );
  openImplementationCondition.phase = "runtime";

  assert.throws(
    () => validateGate(candidate),
    /condition phase inventory/,
  );
});

test("accepted mapping notes authorize implementation without claiming an operational endpoint", () => {
  const routeProfile = packet.conditions.find(
    ({ id }) => id === "runtime_route_profile_implementation_authorized",
  );

  assert.equal(routeProfile.satisfied, true);
  assert.equal(routeProfile.evidence_state, "verified");
  assert.ok(
    routeProfile.evidence.includes(
      "cybrik-suite:contracts/openapi/cybrik-fabric-control-plane.v1.openapi.yaml",
    ),
  );
  assert.match(routeProfile.note, /not an operational endpoint or deployment authorization/i);
});

test("declared dispositions must equal the derived gate result", () => {
  const implementationDrift = copyPacket();
  implementationDrift.declared.implementation_disposition = "HOLD";
  assert.throws(
    () => validateGate(implementationDrift),
    /implementation disposition/,
  );

  const runtimeDrift = copyPacket();
  runtimeDrift.declared.runtime_disposition = "GO";
  assert.throws(
    () => validateGate(runtimeDrift),
    /runtime disposition/,
  );
});

test("runtime authorization cannot be asserted while any condition is open", () => {
  const candidate = copyPacket();
  candidate.declared.runtime_authorized = true;
  assert.throws(
    () => validateGate(candidate),
    /runtime_authorized/,
  );
});

test("clean commit pins reject placeholder provenance and malformed identities", () => {
  for (const [field, value] of [
    ["author", "Your Name <your@email.com>"],
    ["commit", "e06b19c"],
    ["tree", "not-a-tree"],
  ]) {
    const candidate = copyPacket();
    candidate.pins.fabric_candidate[field] = value;
    assert.throws(
      () => validateGate(candidate),
      /fabric candidate/,
    );
  }
});

test("release dates and Founder production control remain immutable", () => {
  for (const [field, value] of [
    ["stable_v1_founder_go_no_go", "2026-12-19"],
    ["release_window", "2026-12-01/2026-12-02"],
  ]) {
    const candidate = copyPacket();
    candidate.release_constraints[field] = value;
    assert.throws(
      () => validateGate(candidate),
      /release constraints/,
    );
  }

  const production = copyPacket();
  production.production_authorized = true;
  assert.throws(
    () => validateGate(production),
    /production_authorized/,
  );
});

test("non-claims forbid runtime, UAT, release and production promotion", () => {
  const candidate = copyPacket();
  candidate.non_claims.pop();
  assert.throws(
    () => validateGate(candidate),
    /non_claims/,
  );
});

test("future all-green evidence derives GO without authorizing production", () => {
  const candidate = copyPacket();
  for (const condition of candidate.conditions) {
    condition.satisfied = true;
    condition.evidence_state = "verified";
    condition.evidence = [`cybrik-suite:evidence/${condition.id}.json`];
  }
  candidate.declared = {
    implementation_disposition: "GO",
    runtime_disposition: "GO",
    runtime_authorized: true,
  };

  const result = evaluateFabricRuntimeProducerGate(candidate);
  assert.equal(result.implementationDisposition, "GO");
  assert.equal(result.runtimeDisposition, "GO");
  assert.equal(result.runtimeAuthorized, true);
  assert.equal(candidate.production_authorized, false);
});
