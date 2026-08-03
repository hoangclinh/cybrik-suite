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

function copyPacket() {
  return structuredClone(packet);
}

test("committed packet derives HOLD without minting runtime evidence", () => {
  const result = validateFabricRuntimeProducerGate(copyPacket());

  assert.deepEqual(result, {
    implementationDisposition: "HOLD",
    runtimeDisposition: "HOLD",
    runtimeAuthorized: false,
    blockerIds: [
      "runtime_endpoint_contract_accepted",
      "key_lifecycle_trust_bundle_design_accepted",
      "durable_receipt_store_design_accepted",
      "product_runtime_producer_implemented_reviewed",
      "canonical_tuple_hosted_ci_green",
      "runtime_negative_and_rollback_evidence",
      "coverage_remeasured_current_suite_tree",
    ],
  });
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
      () => validateFabricRuntimeProducerGate(candidate),
      /condition inventory/,
    );
  }
});

test("satisfied conditions require non-empty repository-qualified evidence", () => {
  const candidate = copyPacket();
  candidate.conditions[0].evidence = [];
  assert.throws(
    () => validateFabricRuntimeProducerGate(candidate),
    /satisfied condition.*evidence/,
  );

  const unqualified = copyPacket();
  unqualified.conditions[0].evidence = ["relative/path.md"];
  assert.throws(
    () => validateFabricRuntimeProducerGate(unqualified),
    /repository-qualified/,
  );
});

test("open conditions cannot carry pass-like evidence state", () => {
  const candidate = copyPacket();
  const open = candidate.conditions.find(({ satisfied }) => !satisfied);
  open.evidence_state = "verified";
  assert.throws(
    () => validateFabricRuntimeProducerGate(candidate),
    /open condition.*evidence_state/,
  );
});

test("declared dispositions must equal the derived gate result", () => {
  const implementationDrift = copyPacket();
  implementationDrift.declared.implementation_disposition = "GO";
  assert.throws(
    () => validateFabricRuntimeProducerGate(implementationDrift),
    /implementation disposition/,
  );

  const runtimeDrift = copyPacket();
  runtimeDrift.declared.runtime_disposition = "GO";
  assert.throws(
    () => validateFabricRuntimeProducerGate(runtimeDrift),
    /runtime disposition/,
  );
});

test("runtime authorization cannot be asserted while any condition is open", () => {
  const candidate = copyPacket();
  candidate.declared.runtime_authorized = true;
  assert.throws(
    () => validateFabricRuntimeProducerGate(candidate),
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
      () => validateFabricRuntimeProducerGate(candidate),
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
      () => validateFabricRuntimeProducerGate(candidate),
      /release constraints/,
    );
  }

  const production = copyPacket();
  production.production_authorized = true;
  assert.throws(
    () => validateFabricRuntimeProducerGate(production),
    /production_authorized/,
  );
});

test("non-claims forbid runtime, UAT, release and production promotion", () => {
  const candidate = copyPacket();
  candidate.non_claims.pop();
  assert.throws(
    () => validateFabricRuntimeProducerGate(candidate),
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
