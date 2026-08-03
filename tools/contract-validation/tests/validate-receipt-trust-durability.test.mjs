import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_MEMBER_PATHS,
  evaluateReceiptTrustDurabilityGate,
  isReceiptSignatureAdmissible,
  loadReceiptTrustDurabilitySchemas,
  validateArtifactLifecycleSet,
  validateCorpusInventory,
  validateValidatorDependencyVersions,
  validateDurabilityStatement,
  validateReceiptTrustDurabilityPacket,
  validateTrustBundleSequence,
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

async function readFixture(relativePath) {
  return JSON.parse(
    await readFile(
      join(repositoryRoot, "contracts", "examples", "receipt-trust-durability", relativePath),
      "utf8",
    ),
  );
}

function copyManifest() {
  return structuredClone(manifest);
}

async function validate(candidate = copyManifest()) {
  return validateReceiptTrustDurabilityPacket(candidate, { repositoryRoot });
}

test("accepted packet opens implementation only and keeps runtime closed", async () => {
  const result = await validate();
  assert.deepEqual(result, {
    lifecycle: "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED",
    keyLifecycleDesignAccepted: true,
    durableStoreDesignAccepted: true,
    implementationAuthorized: true,
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

test("official Ajv validates positive, rejects schema-negative, and admits semantic-negative fixtures", async () => {
  const schemas = await loadReceiptTrustDurabilitySchemas({ repositoryRoot });
  for (const path of [
    "positive/trust-bundle.generation-1.json",
    "positive/trust-bundle.generation-2.json",
    "positive/trust-bundle.generation-3-revoked.json",
  ]) {
    assert.equal(schemas.trustBundle(await readFixture(path)), true, path);
  }
  assert.equal(
    schemas.durability(await readFixture("positive/durability-statement.json")),
    true,
  );

  for (const path of [
    "negative-schema/trust-bundle.private-key-material.json",
    "negative-schema/trust-bundle.revoked-missing-facts.json",
    "negative-schema/trust-bundle.active-with-revocation-facts.json",
    "negative-schema/trust-bundle.invalid-state.json",
  ]) {
    assert.equal(schemas.trustBundle(await readFixture(path)), false, path);
  }
  assert.equal(
    schemas.durability(
      await readFixture("negative-schema/durability-statement.completed-without-durable-receipt.json"),
    ),
    false,
  );

  assert.equal(
    schemas.trustBundle(
      await readFixture("negative-semantic/trust-bundle.kid-thumbprint-mismatch.json"),
    ),
    true,
  );
  assert.equal(
    schemas.trustBundle(await readFixture("negative-semantic/trust-bundle.generation-regression.json")),
    true,
  );
  assert.equal(
    schemas.durability(
      await readFixture("negative-semantic/durability-statement.retention-exceeds-bundle.json"),
    ),
    true,
  );
});

test("fixture tree inventory rejects undeclared files and symlinks", () => {
  const declared = manifest.members
    .map(({ file }) => file)
    .filter((path) => path.startsWith("examples/receipt-trust-durability/"))
    .map((path) => path.slice("examples/receipt-trust-durability/".length));
  assert.doesNotThrow(() => validateCorpusInventory(declared));
  assert.throws(
    () => validateCorpusInventory([...declared, "negative-schema/unlisted.json"]),
    /filesystem inventory/,
  );
  assert.throws(
    () => validateCorpusInventory([...declared.slice(0, -1), `SYMLINK:${declared.at(-1)}`]),
    /filesystem inventory/,
  );
});

test("validator dependency provenance is exact and fail closed", async () => {
  const schemas = await loadReceiptTrustDurabilitySchemas({ repositoryRoot });
  assert.deepEqual(schemas.dependencyVersions, {
    ajv: "8.20.0",
    "ajv-formats": "3.0.1",
  });
  assert.throws(
    () => validateValidatorDependencyVersions({ ajv: "8.19.0", "ajv-formats": "3.0.1" }),
    /validator dependency version mismatch: ajv/,
  );

  const candidate = copyManifest();
  candidate.verification.validator_dependencies.packages.ajv = "8.19.0";
  await assert.rejects(() => validate(candidate), /validator dependency declaration/);
});

test("accepted lifecycle cannot be half-flipped or reverted implicitly", async () => {
  for (const [field, value] of [
    ["x-cybrik-status", "PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED"],
    ["x-cybrik-not-accepted", true],
    ["x-cybrik-not-implemented", false],
    ["x-cybrik-is-bundle-tag", true],
  ]) {
    const candidate = copyManifest();
    candidate[field] = value;
    await assert.rejects(() => validate(candidate), /lifecycle/);
  }

  for (const mutate of [
    (candidate) => { candidate.acceptance.key_lifecycle_design_accepted = false; },
    (candidate) => { candidate.acceptance.durable_store_design_accepted = false; },
    (candidate) => { delete candidate.acceptance; },
  ]) {
    const candidate = copyManifest();
    mutate(candidate);
    await assert.rejects(() => validate(candidate), /lifecycle and acceptance flags/);
  }

  assert.throws(
    () => validateArtifactLifecycleSet(
      "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED",
      ["PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED"],
    ),
    /lifecycle must match/,
  );
  assert.throws(
    () => validateArtifactLifecycleSet(
      "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED",
      ["INVENTED"],
    ),
    /lifecycle is invalid/,
  );
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
    "negative-semantic/trust-bundle.kid-thumbprint-mismatch.json",
  ]) {
    const candidate = copyManifest();
    candidate.verification.fixture_expectations[fixture] = "INVENTED-RULE";
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

test("rotation sequence enforces retained kids, monotone states and one active signer", async () => {
  const first = await readFixture("positive/trust-bundle.generation-1.json");
  const second = await readFixture("positive/trust-bundle.generation-2.json");
  assert.doesNotThrow(() => validateTrustBundleSequence([first, second]));

  const dropped = structuredClone(second);
  dropped.keys = dropped.keys.slice(1);
  assert.throws(
    () => validateTrustBundleSequence([first, dropped]),
    /predecessor key retention/,
  );

  const twoActive = structuredClone(second);
  twoActive.keys[0].state = "active";
  assert.throws(() => validateTrustBundleSequence([first, twoActive]), /single active signer/);

  const backwardsFirst = structuredClone(first);
  backwardsFirst.keys[0].state = "retired";
  assert.throws(
    () => validateTrustBundleSequence([backwardsFirst, second]),
    /monotone key state/,
  );

  const invalidState = structuredClone(first);
  invalidState.keys[0].state = "Active";
  assert.throws(() => validateTrustBundleSequence([invalidState]), /key state/);

  const regression = await readFixture("negative-semantic/trust-bundle.generation-regression.json");
  assert.throws(() => validateTrustBundleSequence([regression]), /bundle generation/);
});

test("trust lifecycle rejects every named fail-closed branch", async () => {
  const first = await readFixture("positive/trust-bundle.generation-1.json");
  const second = await readFixture("positive/trust-bundle.generation-2.json");
  const third = await readFixture("positive/trust-bundle.generation-3-revoked.json");

  for (const mutate of [
    (candidate) => { candidate.bundle_uri = "https://example.invalid/bundle"; },
    (candidate) => { candidate.max_staleness_seconds = 0; },
    (candidate) => {
      const duplicate = structuredClone(candidate.keys[0]);
      duplicate.state = "retired";
      candidate.keys.push(duplicate);
    },
    (candidate) => { candidate.keys[0].d = "private-material-forbidden"; },
    (candidate) => { candidate.keys[0].revoked_at = "2026-12-01T00:00:00Z"; },
  ]) {
    const candidate = structuredClone(first);
    mutate(candidate);
    assert.throws(
      () => validateTrustBundleSequence([candidate]),
      /offline trust bundle|freshness bound|duplicate kid|non-public|revocation facts/,
    );
  }

  const sameGeneration = structuredClone(second);
  sameGeneration.generation = first.generation;
  delete sameGeneration.predecessor_generation;
  assert.throws(() => validateTrustBundleSequence([first, sameGeneration]), /monotone bundle generation/);

  const staleGeneratedAt = structuredClone(second);
  staleGeneratedAt.generated_at = first.generated_at;
  assert.throws(() => validateTrustBundleSequence([first, staleGeneratedAt]), /generated_at/);

  const revokedMissingFact = structuredClone(third);
  delete revokedMissingFact.keys.find(({ state }) => state === "revoked").revocation_reason;
  assert.throws(() => validateTrustBundleSequence([revokedMissingFact]), /revocation facts/);

  assert.equal(isReceiptSignatureAdmissible(first.keys[0], "not-a-date"), false);
  assert.equal(isReceiptSignatureAdmissible(first.keys[0], "2025-01-01T00:00:00Z"), false);
});

test("bundle references remain offline provenance with fail-closed freshness", async () => {
  const candidate = copyManifest();
  candidate.authority_boundaries.trust_bundle_fetch = "fetch signed bundle_uri";
  await assert.rejects(() => validate(candidate), /offline trust bundle/);
});

test("revocation effect is verifier-facing and fail closed", async () => {
  const third = await readFixture("positive/trust-bundle.generation-3-revoked.json");
  const revoked = third.keys.find(({ state }) => state === "revoked");
  assert.equal(isReceiptSignatureAdmissible(revoked, "2026-11-15T00:00:00Z"), false);
  assert.equal(isReceiptSignatureAdmissible(revoked, "2026-12-02T00:00:00Z"), false);

  const prospective = { ...revoked, revocation_effective: "from_revocation_time" };
  assert.equal(isReceiptSignatureAdmissible(prospective, "2026-11-15T00:00:00Z"), true);
  assert.equal(isReceiptSignatureAdmissible(prospective, "2026-12-02T00:00:00Z"), false);
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

test("durability statement enforces ordering, failure mapping and retention", async () => {
  const statement = await readFixture("positive/durability-statement.json");
  assert.doesNotThrow(() => validateDurabilityStatement(statement));

  for (const [field, value, message] of [
    ["intent_committed_before_dispatch", false, /intent before dispatch/],
    ["receipt_committed_before_result", false, /receipt before result/],
    ["completion_without_durable_receipt_status", "completed", /completion failure mapping/],
    ["append_only", false, /append-only/],
    ["replay_resigns", true, /replay never re-signs/],
  ]) {
    const candidate = structuredClone(statement);
    candidate[field] = value;
    assert.throws(() => validateDurabilityStatement(candidate), message);
  }

  for (const field of [
    "performed_unrecorded_handling",
    "unresolved_intent_terminalization",
    "receipt_read_visibility",
  ]) {
    const candidate = structuredClone(statement);
    delete candidate[field];
    assert.throws(() => validateDurabilityStatement(candidate), /reconciliation|terminalization|visibility/);
  }
});

test("ledger is append-only and idempotent replay never re-signs", async () => {
  for (const forbidden of ["update receipt", "delete receipt", "re-sign replay"] ) {
    const candidate = copyManifest();
    candidate.durable_receipt_semantics.push(forbidden);
    await assert.rejects(() => validate(candidate), /append-only|re-sign/i);
  }

  for (const field of ["durable_receipt_semantics", "retention_coupling"]) {
    const candidate = copyManifest();
    delete candidate[field];
    await assert.rejects(() => validate(candidate), /durable receipt semantics|retention coupling/);
  }
});

test("negative fixture expectations are exact-path closed", async () => {
  const candidate = copyManifest();
  const expectations = candidate.verification.fixture_expectations;
  const original = Object.keys(expectations)[0];
  const value = expectations[original];
  delete expectations[original];
  expectations["positive/trust-bundle.generation-1.json"] = value;
  await assert.rejects(() => validate(candidate), /fixture expectation inventory/);
});

test("receipt retention cannot outlive trust-bundle retention", async () => {
  const candidate = copyManifest();
  candidate.retention_coupling.receipt_retention_days = 366;
  candidate.retention_coupling.trust_bundle_retention_days = 365;
  await assert.rejects(() => validate(candidate), /retention coupling/);
});

test("Suite documents contracts while Fabric retains runtime authority", async () => {
  for (const [owner, unsafeClaim] of [
    ["suite", "Suite owns product runtime"],
    ["fabric", "Suite-owned signer and ledger"],
    ["soc", "SOC signs Fabric receipts"],
    ["cyber_ai", "Cyber AI authors trust bundles"],
  ]) {
    const candidate = copyManifest();
    candidate.ownership[owner] = unsafeClaim;
    await assert.rejects(() => validate(candidate), /ownership/);
  }
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

test("accepted design derives implementation GO but never runtime or production authority", () => {
  assert.deepEqual(evaluateReceiptTrustDurabilityGate(manifest), {
    lifecycle: "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED",
    keyLifecycleDesignAccepted: true,
    durableStoreDesignAccepted: true,
    implementationAuthorized: true,
    runtimeAuthorized: false,
  });
  assert.equal(manifest.production_authorized, false);
});
