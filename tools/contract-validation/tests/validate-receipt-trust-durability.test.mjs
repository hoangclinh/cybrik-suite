import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_MEMBER_PATHS,
  evaluateReceiptTrustDurabilityGate,
  validateReceiptTrustDurabilityPacket,
} from "../validate-receipt-trust-durability.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, "..", "..", "..");
const manifestPath = join(
  repositoryRoot,
  "contracts",
  "compatibility",
  "cybrik-suite-receipt-trust-durability-proposal.v1.manifest.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

function copyManifest() {
  return structuredClone(manifest);
}

async function validate(candidate = copyManifest()) {
  return validateReceiptTrustDurabilityPacket(candidate, { repositoryRoot });
}

test("proposal packet is complete but keeps both design gates closed", async () => {
  const result = await validate();
  assert.deepEqual(result, {
    lifecycle: "PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED",
    keyLifecycleDesignAccepted: false,
    durableStoreDesignAccepted: false,
    implementationAuthorized: false,
    runtimeAuthorized: false,
  });
});

test("member inventory is exact, ordered and closed", async () => {
  assert.deepEqual(
    manifest.members.map(({ file }) => file),
    REQUIRED_MEMBER_PATHS,
  );
  for (const mutate of [
    (candidate) => candidate.members.pop(),
    (candidate) => candidate.members.reverse(),
    (candidate) => candidate.members.push(structuredClone(candidate.members[0])),
    (candidate) => {
      candidate.members[0].file = "json-schema/invented.schema.json";
    },
  ]) {
    const candidate = copyManifest();
    mutate(candidate);
    await assert.rejects(() => validate(candidate), /member inventory/);
  }
});

test("proposal lifecycle cannot be half-flipped or self-accepted", async () => {
  for (const [field, value] of [
    ["x-cybrik-status", "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED"],
    ["x-cybrik-not-accepted", false],
    ["x-cybrik-not-implemented", false],
    ["x-cybrik-is-bundle-tag", true],
  ]) {
    const candidate = copyManifest();
    candidate[field] = value;
    await assert.rejects(() => validate(candidate), /proposal lifecycle/);
  }
});

test("member bytes and declared sha256 digests are bound", async () => {
  const candidate = copyManifest();
  candidate.members[0].sha256 = "0".repeat(64);
  await assert.rejects(() => validate(candidate), /member digest/);
});

test("accepted F8, W2-B and C1 sources are reused without reinterpretation", async () => {
  for (const mutate of [
    (candidate) => candidate.reuse_pins.pop(),
    (candidate) => {
      candidate.reuse_pins[0].sha256 = "f".repeat(64);
    },
    (candidate) => {
      candidate.reuse_pins[0].treatment = "modified";
    },
  ]) {
    const candidate = copyManifest();
    mutate(candidate);
    await assert.rejects(() => validate(candidate), /reuse pin/);
  }
});

test("trust bundles contain public Ed25519 material only and bind kid", async () => {
  for (const fixture of [
    "negative-schema/trust-bundle.private-key-material.json",
    "negative-schema/trust-bundle.kid-thumbprint-mismatch.json",
  ]) {
    const candidate = copyManifest();
    candidate.verification.fixture_expectations[fixture] = [];
    await assert.rejects(() => validate(candidate), /fixture expectation/);
  }
});

test("bundle generation, key state and predecessor retention are monotone", async () => {
  for (const rule of [
    "KL-2-PREDECESSOR-KEY-RETENTION",
    "KL-3-MONOTONE-KEY-STATE",
    "KL-5-SINGLE-ACTIVE-SIGNER",
  ]) {
    const candidate = copyManifest();
    candidate.design_invariants = candidate.design_invariants.filter(({ id }) => id !== rule);
    await assert.rejects(() => validate(candidate), /design invariant inventory/);
  }
});

test("bundle references remain offline provenance with fail-closed freshness", async () => {
  const candidate = copyManifest();
  candidate.authority_boundaries.trust_bundle_fetch = "fetch signed bundle_uri";
  await assert.rejects(() => validate(candidate), /offline trust bundle/);
});

test("durability orders intent before dispatch and receipt before result", async () => {
  for (const rule of [
    "LD-1-INTENT-BEFORE-DISPATCH",
    "LD-2-RECEIPT-BEFORE-RESULT",
    "LD-3-NO-COMPLETED-WITHOUT-DURABLE-RECEIPT",
  ]) {
    const candidate = copyManifest();
    candidate.design_invariants = candidate.design_invariants.filter(({ id }) => id !== rule);
    await assert.rejects(() => validate(candidate), /design invariant inventory/);
  }
});

test("ledger is append-only and idempotent replay never re-signs", async () => {
  for (const forbidden of ["update receipt", "delete receipt", "re-sign replay"] ) {
    const candidate = copyManifest();
    candidate.durable_receipt_semantics.push(forbidden);
    await assert.rejects(() => validate(candidate), /append-only|re-sign/i);
  }
});

test("receipt retention cannot outlive trust-bundle retention", async () => {
  const candidate = copyManifest();
  candidate.retention_coupling.receipt_retention_days = 366;
  candidate.retention_coupling.trust_bundle_retention_days = 365;
  await assert.rejects(() => validate(candidate), /retention coupling/);
});

test("Suite documents contracts while Fabric retains runtime authority", async () => {
  const candidate = copyManifest();
  candidate.ownership.fabric = "Suite-owned signer and ledger";
  await assert.rejects(() => validate(candidate), /ownership/);
});

test("release dates, non-claims and Founder production control are immutable", async () => {
  for (const mutate of [
    (candidate) => {
      candidate.release_constraints.stable_v1_founder_go_no_go = "2026-12-19";
    },
    (candidate) => candidate.non_claims.pop(),
    (candidate) => {
      candidate.production_authorized = true;
    },
  ]) {
    const candidate = copyManifest();
    mutate(candidate);
    await assert.rejects(() => validate(candidate), /release constraints|non_claims|production_authorized/);
  }
});

test("future acceptance derives implementation GO but never runtime or production authority", () => {
  const candidate = copyManifest();
  candidate["x-cybrik-status"] = "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED";
  candidate["x-cybrik-not-accepted"] = false;
  candidate.acceptance = {
    key_lifecycle_design_accepted: true,
    durable_store_design_accepted: true,
  };

  assert.deepEqual(evaluateReceiptTrustDurabilityGate(candidate), {
    lifecycle: "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED",
    keyLifecycleDesignAccepted: true,
    durableStoreDesignAccepted: true,
    implementationAuthorized: true,
    runtimeAuthorized: false,
  });
  assert.equal(candidate.production_authorized, false);
});
