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
    pushed: true,
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

test("non-claims forbid runtime, UAT, release, production and canonical CI promotion", () => {
  assert.deepEqual(packet.non_claims, [
    "no_runtime_started",
    "no_uat_pass",
    "no_demo_or_release_promotion",
    "no_production_authority",
    "no_canonical_tuple_ci_claim",
  ]);

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

test("fabric candidate pin records the pushed, unmerged publication state", () => {
  assert.equal(packet.pins.fabric_candidate.pushed, true);
  assert.equal(packet.pins.fabric_candidate.merged, false);

  for (const [field, value] of [
    ["pushed", false],
    ["merged", true],
  ]) {
    const candidate = copyPacket();
    candidate.pins.fabric_candidate[field] = value;
    assert.throws(() => validateGate(candidate), /fabric candidate/);
  }
});

test("fabric publication records the exact hosted run, job inventory and post-candidate delta", () => {
  assert.deepEqual(packet.fabric_publication, {
    repository: "cybrik-security-tool-fabric",
    provider: "github_actions",
    draft_pull_request: 5,
    draft_pull_request_url:
      "https://github.com/hoangclinh/cybrik-security-tool-fabric/pull/5",
    observed_at: "2026-08-03T09:04:35Z",
    state_is_snapshot: true,
    draft_pull_request_state_observed: "OPEN",
    draft_pull_request_mergeable_state_observed: "CLEAN",
    run_id: 30797481044,
    run_url:
      "https://github.com/hoangclinh/cybrik-security-tool-fabric/actions/runs/30797481044",
    run_conclusion: "success",
    head_commit: "50aff1df146d6e98b33d9f82617781595bcf1512",
    head_tree: "2b4d516eef0a3b0ae05b44a225515efef749f25b",
    jobs: [
      { name: "scaffold-integrity", conclusion: "success" },
      { name: "secret-scan", conclusion: "success" },
      { name: "detect", conclusion: "success" },
      { name: "control-plane", conclusion: "success" },
      { name: "executor", conclusion: "success" },
      { name: "admission-gate", conclusion: "success" },
    ],
    candidate_reachable_from_head: true,
    candidate_tree_equals_head_tree: false,
    post_candidate_delta_paths: [
      ".github/workflows/ci.yml",
      ".gitleaks.toml",
      "tests/control-plane/test_ci_admission.py",
    ],
    runtime_implementation_modified: false,
    coverage_scope: "single_repository",
    closes_conditions: [],
  });

  assert.deepEqual(Object.keys(packet.fabric_publication), [
    "repository",
    "provider",
    "draft_pull_request",
    "draft_pull_request_url",
    "observed_at",
    "state_is_snapshot",
    "draft_pull_request_state_observed",
    "draft_pull_request_mergeable_state_observed",
    "run_id",
    "run_url",
    "run_conclusion",
    "head_commit",
    "head_tree",
    "jobs",
    "candidate_reachable_from_head",
    "candidate_tree_equals_head_tree",
    "post_candidate_delta_paths",
    "runtime_implementation_modified",
    "coverage_scope",
    "closes_conditions",
  ]);
});

test("fabric publication fails closed on every field, key, job and delta drift", () => {
  const mutations = [
    (candidate) => delete candidate.fabric_publication,
    (candidate) => {
      candidate.fabric_publication = null;
    },
    (candidate) => {
      candidate.fabric_publication.repository = "cybrik-suite";
    },
    (candidate) => {
      candidate.fabric_publication.provider = "local_runner";
    },
    (candidate) => {
      candidate.fabric_publication.draft_pull_request = 6;
    },
    (candidate) => {
      candidate.fabric_publication.draft_pull_request_url = "https://github.com/hoangclinh/cybrik-suite/pull/5";
    },
    (candidate) => {
      candidate.fabric_publication.observed_at = "2026-08-03T09:04:36Z";
    },
    (candidate) => {
      candidate.fabric_publication.state_is_snapshot = false;
    },
    (candidate) => {
      candidate.fabric_publication.draft_pull_request_state_observed = "MERGED";
    },
    (candidate) => {
      candidate.fabric_publication.draft_pull_request_mergeable_state_observed = "DIRTY";
    },
    (candidate) => {
      candidate.fabric_publication.run_id = 30797481045;
    },
    (candidate) => {
      candidate.fabric_publication.run_url = "https://example.invalid/run";
    },
    (candidate) => {
      candidate.fabric_publication.run_conclusion = "failure";
    },
    (candidate) => {
      candidate.fabric_publication.head_commit = "1".repeat(40);
    },
    (candidate) => {
      candidate.fabric_publication.head_tree = "not-a-tree";
    },
    (candidate) => {
      candidate.fabric_publication.candidate_reachable_from_head = false;
    },
    (candidate) => {
      candidate.fabric_publication.candidate_tree_equals_head_tree = true;
    },
    (candidate) => {
      candidate.fabric_publication.runtime_implementation_modified = true;
    },
    (candidate) => {
      candidate.fabric_publication.coverage_scope = "canonical_tuple";
    },
    (candidate) => {
      candidate.fabric_publication.closes_conditions = ["canonical_tuple_hosted_ci_green"];
    },
    (candidate) => {
      candidate.fabric_publication.extra_field = "unexpected";
    },
    (candidate) => {
      delete candidate.fabric_publication.coverage_scope;
    },
    (candidate) => {
      candidate.fabric_publication.jobs.pop();
    },
    (candidate) => {
      candidate.fabric_publication.jobs.reverse();
    },
    (candidate) => {
      candidate.fabric_publication.jobs[2].conclusion = "skipped";
    },
    (candidate) => {
      candidate.fabric_publication.jobs[0].name = "scaffold_integrity";
    },
    (candidate) => {
      candidate.fabric_publication.jobs[0].duration_seconds = 12;
    },
    (candidate) => {
      candidate.fabric_publication.jobs.push({ name: "extra", conclusion: "success" });
    },
    (candidate) => {
      candidate.fabric_publication.post_candidate_delta_paths.pop();
    },
    (candidate) => {
      candidate.fabric_publication.post_candidate_delta_paths.reverse();
    },
    (candidate) => {
      candidate.fabric_publication.post_candidate_delta_paths.push("src/control-plane/cybrik_fabric_control/invocation/service.py");
    },
    (candidate) => {
      candidate.fabric_publication.post_candidate_delta_paths[1] = ".gitleaks.toml.bak";
    },
  ];

  for (const [index, mutate] of mutations.entries()) {
    const candidate = copyPacket();
    mutate(candidate);
    assert.throws(
      () => validateGate(candidate),
      /fabric publication/,
      "fabric publication mutation " + index + " must fail closed",
    );
  }
});

test("fabric-only hosted CI is qualified partial evidence that cannot satisfy the canonical tuple", () => {
  const canonical = packet.conditions.find(
    ({ id }) => id === "canonical_tuple_hosted_ci_green",
  );

  assert.equal(canonical.satisfied, false);
  assert.equal(canonical.evidence_state, "open");
  assert.deepEqual(canonical.evidence, [
    "cybrik-security-tool-fabric:actions/runs/30797481044",
    "cybrik-security-tool-fabric:commit/50aff1df146d6e98b33d9f82617781595bcf1512",
    "cybrik-security-tool-fabric:tree/2b4d516eef0a3b0ae05b44a225515efef749f25b",
    "cybrik-suite:docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/05-fabric-runtime-producer-review.md",
  ]);
  assert.match(canonical.note, /qualified partial evidence/i);
  assert.match(canonical.note, /single Fabric repository/i);
  assert.match(canonical.note, /not canonical four-repository CI/i);
  assert.match(canonical.note, /remains open and unsatisfied/i);

  const promoted = copyPacket();
  const promotedCondition = promoted.conditions.find(
    ({ id }) => id === "canonical_tuple_hosted_ci_green",
  );
  promotedCondition.satisfied = true;
  promotedCondition.evidence_state = "verified";
  promoted.declared.runtime_disposition = "HOLD";
  promoted.declared.runtime_authorized = false;
  assert.throws(() => validateGate(promoted), /canonical tuple/i);

  const strippedNote = copyPacket();
  strippedNote.conditions.find(
    ({ id }) => id === "canonical_tuple_hosted_ci_green",
  ).note = "Hosted CI is green.";
  assert.throws(() => validateGate(strippedNote), /canonical tuple/i);

  const strippedEvidence = copyPacket();
  strippedEvidence.conditions.find(
    ({ id }) => id === "canonical_tuple_hosted_ci_green",
  ).evidence = ["cybrik-security-tool-fabric:actions/runs/30797481044"];
  assert.throws(() => validateGate(strippedEvidence), /canonical tuple/i);

  const closedState = copyPacket();
  closedState.conditions.find(
    ({ id }) => id === "canonical_tuple_hosted_ci_green",
  ).evidence_state = "missing";
  assert.throws(() => validateGate(closedState), /canonical tuple/i);
});

test("open conditions still require repository-qualified evidence entries", () => {
  const candidate = copyPacket();
  candidate.conditions.find(
    ({ id }) => id === "canonical_tuple_hosted_ci_green",
  ).evidence[0] = "actions/runs/30797481044";
  assert.throws(() => validateGate(candidate), /repository-qualified/);
});

test("runtime remains HOLD on the same three blockers after publication", () => {
  const result = validateGate(copyPacket());

  assert.equal(result.runtimeDisposition, "HOLD");
  assert.equal(result.runtimeAuthorized, false);
  assert.deepEqual(result.blockerIds, [
    "canonical_tuple_hosted_ci_green",
    "runtime_negative_and_rollback_evidence",
    "coverage_remeasured_current_suite_tree",
  ]);
  assert.equal(packet.production_authorized, false);
  assert.deepEqual(packet.release_constraints, {
    stable_v1_founder_go_no_go: "2026-12-20",
    release_window: "2026-12-21/2026-12-31",
  });
});

test("review packet records Fabric-only hosted CI and its explicit non-claims", async () => {
  const review = await readFile(
    join(
      repositoryRoot,
      "docs",
      "uat",
      "candidates",
      "runtime-admission-soc-ai-lifecycle-mtls-r1",
      "evidence",
      "05-fabric-runtime-producer-review.md",
    ),
    "utf8",
  );

  assert.match(review, /## Hosted CI publication \(Fabric repository only\)/);
  assert.match(review, /30797481044/);
  assert.match(review, /50aff1df146d6e98b33d9f82617781595bcf1512/);
  assert.match(review, /2b4d516eef0a3b0ae05b44a225515efef749f25b/);
  for (const job of [
    "scaffold-integrity",
    "secret-scan",
    "detect",
    "control-plane",
    "executor",
    "admission-gate",
  ]) {
    assert.match(review, new RegExp("`" + job + "`"));
  }
  for (const path of [
    "\\.github/workflows/ci\\.yml",
    "\\.gitleaks\\.toml",
    "tests/control-plane/test_ci_admission\\.py",
  ]) {
    assert.match(review, new RegExp(path));
  }
  assert.match(review, /not canonical four-repository CI/i);
  assert.match(review, /not runtime evidence/i);
  assert.match(review, /not a UAT pass/i);
  assert.match(review, /not a demo authorization/i);
  assert.match(review, /not a release promotion/i);
  assert.match(review, /not production authorization/i);
  assert.match(review, /no\s+runtime implementation file changed/i);
  assert.match(review, /runtime implementation bytes/i);
  assert.match(review, /workflow and\s+secret-scan allowlist changed after the candidate/i);
  assert.match(review, /snapshot observed at `2026-08-03T09:04:35Z`/i);
  assert.match(review, /27\/27 registered validators passed/i);
  assert.match(review, /43c7990b6b65d1aaeb1353ba82821dd887cf7202151088b4c88d4475393563b9/);
});

test("packet identity and draft status fail closed", () => {
  for (const [field, value] of [
    ["schema_version", "cybrik.fabric-runtime-producer-gate.v2"],
    ["status", "VERIFIED"],
    ["candidate_id", "different-candidate"],
  ]) {
    const candidate = copyPacket();
    candidate[field] = value;
    assert.throws(() => validateGate(candidate), /packet identity/);
  }
});
