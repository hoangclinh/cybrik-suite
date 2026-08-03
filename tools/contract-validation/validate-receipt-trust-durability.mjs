#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_MEMBER_PATHS = Object.freeze([
  "json-schema/cybrik.receipt-trust-bundle.v1.schema.json",
  "json-schema/cybrik.receipt-durability-statement.v1.schema.json",
  "examples/receipt-trust-durability/examples-manifest.json",
  "examples/receipt-trust-durability/positive/trust-bundle.generation-1.json",
  "examples/receipt-trust-durability/positive/trust-bundle.generation-2.json",
  "examples/receipt-trust-durability/positive/trust-bundle.generation-3-revoked.json",
  "examples/receipt-trust-durability/positive/durability-statement.json",
  "examples/receipt-trust-durability/negative-schema/trust-bundle.private-key-material.json",
  "examples/receipt-trust-durability/negative-schema/trust-bundle.revoked-missing-facts.json",
  "examples/receipt-trust-durability/negative-schema/trust-bundle.active-with-revocation-facts.json",
  "examples/receipt-trust-durability/negative-schema/trust-bundle.invalid-state.json",
  "examples/receipt-trust-durability/negative-schema/durability-statement.completed-without-durable-receipt.json",
  "examples/receipt-trust-durability/negative-semantic/trust-bundle.kid-thumbprint-mismatch.json",
  "examples/receipt-trust-durability/negative-semantic/trust-bundle.generation-regression.json",
  "examples/receipt-trust-durability/negative-semantic/durability-statement.retention-exceeds-bundle.json",
]);

const PROPOSAL_STATUS = "PROPOSED — NOT ACCEPTED — NOT IMPLEMENTED";
const ACCEPTED_STATUS = "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED";
const SHA256 = /^[0-9a-f]{64}$/;
const REQUIRED_INVARIANTS = Object.freeze([
  "KL-1-MONOTONE-GENERATION",
  "KL-2-PREDECESSOR-KEY-RETENTION",
  "KL-3-MONOTONE-KEY-STATE",
  "KL-4-POSITIVE-REVOCATION-FACT",
  "KL-5-SINGLE-ACTIVE-SIGNER",
  "KL-6-OFFLINE-FAIL-CLOSED-FRESHNESS",
  "KL-7-PUBLIC-MATERIAL-AND-RFC7638-KID",
  "LD-1-INTENT-BEFORE-DISPATCH",
  "LD-2-RECEIPT-BEFORE-RESULT",
  "LD-3-NO-COMPLETED-WITHOUT-DURABLE-RECEIPT",
  "LD-4-UNRESOLVED-EXECUTION-RECONCILIATION",
  "LD-5-APPEND-ONLY",
  "LD-6-DURABLE-ONLY-READ-VISIBILITY",
  "LD-7-RETENTION-COUPLING",
  "LD-8-REPLAY-NEVER-RESIGNS",
]);
const EXPECTED_NON_CLAIMS = Object.freeze([
  "no_runtime_or_product_implementation",
  "no_operational_endpoint_or_deployment",
  "no_signer_key_store_or_ledger_created",
  "no_key_generated_distributed_rotated_or_revoked",
  "no_ci_uat_demo_release_or_ga_claim",
  "no_production_authority",
  "static_validation_is_not_runtime_evidence",
]);
const EXPECTED_REUSE_PATHS = Object.freeze([
  "compatibility/cybrik-suite-receipt-integrity-proposal.v1.manifest.json",
  "openapi/cybrik-fabric-control-plane.v1.openapi.yaml",
  "compatibility/cybrik-suite-alert-context-transport-binding.v1.manifest.json",
]);
const EXPECTED_FIXTURE_PATHS = Object.freeze([
  "negative-schema/trust-bundle.private-key-material.json",
  "negative-schema/trust-bundle.revoked-missing-facts.json",
  "negative-schema/trust-bundle.active-with-revocation-facts.json",
  "negative-schema/trust-bundle.invalid-state.json",
  "negative-schema/durability-statement.completed-without-durable-receipt.json",
  "negative-semantic/trust-bundle.kid-thumbprint-mismatch.json",
  "negative-semantic/trust-bundle.generation-regression.json",
  "negative-semantic/durability-statement.retention-exceeds-bundle.json",
]);
const EXPECTED_CASE_PATHS = Object.freeze([
  "positive/trust-bundle.generation-1.json",
  "positive/trust-bundle.generation-2.json",
  "positive/trust-bundle.generation-3-revoked.json",
  "positive/durability-statement.json",
  ...EXPECTED_FIXTURE_PATHS,
]);
const EXPECTED_CORPUS_PATHS = Object.freeze(["examples-manifest.json", ...EXPECTED_CASE_PATHS]);
const EXPECTED_DURABLE_SEMANTICS = Object.freeze([
  "commit authoritative intent before dispatch",
  "commit and read-after-write verify signed receipt before releasing completed result",
  "return stored receipt bytes on replay",
  "preserve failed uncertain commits for reconciliation without repeating execution",
]);
const KEY_STATES = Object.freeze(["active", "retiring", "retired", "revoked"]);
const EXPECTED_VALIDATOR_DEPENDENCIES = Object.freeze({
  ajv: "8.20.0",
  "ajv-formats": "3.0.1",
});

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJsonStrict(path) {
  const bytes = await readFile(path);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new Error(`raw JSON admission rejected BOM: ${path}`);
  }
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

function invariantError(ruleId, message) {
  const error = new Error(message);
  error.ruleId = ruleId;
  return error;
}

function validateSchemaLifecycle(schema, label) {
  if (
    schema["x-cybrik-status"] !== PROPOSAL_STATUS ||
    schema["x-cybrik-not-accepted"] !== true ||
    schema["x-cybrik-not-implemented"] !== true
  ) {
    throw new Error(`${label} lifecycle must match the proposal`);
  }
}

export async function loadReceiptTrustDurabilitySchemas({ repositoryRoot }) {
  const dependencyRoot = process.env.CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT || join(repositoryRoot, "tools", "contract-validation");
  const require = createRequire(join(dependencyRoot, "package.json"));
  const dependencyVersions = {
    ajv: require("ajv/package.json").version,
    "ajv-formats": require("ajv-formats/package.json").version,
  };
  validateValidatorDependencyVersions(dependencyVersions);
  const Ajv2020 = require("ajv/dist/2020").default;
  const addFormats = require("ajv-formats");
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const keyword of ["x-cybrik-status", "x-cybrik-not-accepted", "x-cybrik-not-implemented"]) {
    ajv.addKeyword({ keyword, valid: true });
  }
  const schemaRoot = join(repositoryRoot, "contracts", "json-schema");
  const trustSchema = (await readJsonStrict(join(schemaRoot, "cybrik.receipt-trust-bundle.v1.schema.json"))).value;
  const durabilitySchema = (await readJsonStrict(join(schemaRoot, "cybrik.receipt-durability-statement.v1.schema.json"))).value;
  validateSchemaLifecycle(trustSchema, "trust-bundle schema");
  validateSchemaLifecycle(durabilitySchema, "durability schema");
  return {
    dependencyVersions,
    trustBundle: ajv.compile(trustSchema),
    durability: ajv.compile(durabilitySchema),
  };
}

export function validateValidatorDependencyVersions(versions) {
  for (const [name, expectedVersion] of Object.entries(EXPECTED_VALIDATOR_DEPENDENCIES)) {
    if (versions?.[name] !== expectedVersion) {
      throw new Error(`validator dependency version mismatch: ${name}`);
    }
  }
}

export function validateCorpusInventory(paths) {
  const actual = Array.isArray(paths) ? paths : [];
  const actualSet = new Set(actual);
  const expectedSet = new Set(EXPECTED_CORPUS_PATHS);
  if (
    actual.length !== EXPECTED_CORPUS_PATHS.length ||
    actualSet.size !== actual.length ||
    actual.some((path) => path.startsWith("SYMLINK:")) ||
    [...expectedSet].some((path) => !actualSet.has(path))
  ) {
    throw new Error("example filesystem inventory must be exact and contain no symlinks");
  }
}

function validateLifecycle(packet) {
  if (
    packet["x-cybrik-status"] !== PROPOSAL_STATUS ||
    packet["x-cybrik-not-accepted"] !== true ||
    packet["x-cybrik-not-implemented"] !== true ||
    packet["x-cybrik-is-bundle-tag"] !== false
  ) {
    throw new Error("proposal lifecycle must remain exact and not self-accept");
  }
}

function validateInventory(packet) {
  if (!Array.isArray(packet.members)) throw new Error("member inventory must be an array");
  const paths = packet.members.map(({ file }) => file);
  if (
    paths.length !== REQUIRED_MEMBER_PATHS.length ||
    paths.some((path, index) => path !== REQUIRED_MEMBER_PATHS[index]) ||
    new Set(paths).size !== paths.length
  ) {
    throw new Error("member inventory must be exact, ordered and closed");
  }
}

async function validateMemberDigests(packet, repositoryRoot) {
  for (const member of packet.members) {
    if (!SHA256.test(member.sha256)) throw new Error(`member digest malformed: ${member.file}`);
    const bytes = await readFile(join(repositoryRoot, "contracts", member.file));
    if (digest(bytes) !== member.sha256) throw new Error(`member digest mismatch: ${member.file}`);
  }
}

async function validateReusePins(packet, repositoryRoot) {
  if (
    !Array.isArray(packet.reuse_pins) ||
    packet.reuse_pins.length !== EXPECTED_REUSE_PATHS.length ||
    packet.reuse_pins.some(({ file }, index) => file !== EXPECTED_REUSE_PATHS[index])
  ) {
    throw new Error("reuse pin inventory must remain exact");
  }
  for (const pin of packet.reuse_pins) {
    if (pin.treatment !== "reused-byte-unchanged" || !SHA256.test(pin.sha256)) {
      throw new Error(`reuse pin invalid: ${pin.file}`);
    }
    const bytes = await readFile(join(repositoryRoot, "contracts", pin.file));
    if (digest(bytes) !== pin.sha256) throw new Error(`reuse pin digest mismatch: ${pin.file}`);
  }
}

function thumbprint(key) {
  const canonical = JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x });
  return createHash("sha256").update(canonical).digest("base64url");
}

function validateTrustKey(key) {
  if (Object.hasOwn(key, "d") || key.kty !== "OKP" || key.crv !== "Ed25519") {
    throw invariantError("KL-7-PUBLIC-MATERIAL-AND-RFC7638-KID", "trust bundle contains non-public or non-Ed25519 key material");
  }
  if (key.kid !== thumbprint(key)) {
    throw invariantError("KL-7-PUBLIC-MATERIAL-AND-RFC7638-KID", "trust bundle kid does not match RFC 7638");
  }
  if (!KEY_STATES.includes(key.state)) {
    throw invariantError("KL-3-MONOTONE-KEY-STATE", "trust bundle key state is invalid");
  }
  const revocationFields = [key.revoked_at, key.revocation_reason, key.revocation_effective];
  if (key.state === "revoked") {
    if (revocationFields.some((value) => !value)) {
      throw invariantError("KL-4-POSITIVE-REVOCATION-FACT", "revoked key requires positive revocation facts");
    }
  } else if (revocationFields.some((value) => value !== undefined)) {
    throw invariantError("KL-4-POSITIVE-REVOCATION-FACT", "non-revoked key cannot carry revocation facts");
  }
}

export function isReceiptSignatureAdmissible(key, signedAt) {
  const signed = Date.parse(signedAt);
  const notBefore = Date.parse(key.not_before);
  const notAfter = Date.parse(key.not_after);
  if (![signed, notBefore, notAfter].every(Number.isFinite) || signed < notBefore || signed > notAfter) {
    return false;
  }
  if (key.state !== "revoked") return KEY_STATES.includes(key.state);
  if (key.revocation_effective === "retroactive_all") return false;
  return key.revocation_effective === "from_revocation_time" && signed < Date.parse(key.revoked_at);
}

export function validateTrustBundleSequence(bundles) {
  if (!Array.isArray(bundles) || bundles.length === 0) throw new Error("trust bundle sequence is empty");
  const stateRank = { active: 0, retiring: 1, retired: 2 };
  for (const [index, bundle] of bundles.entries()) {
    if (bundle.bundle_uri !== "cybrik-trust://receipt-signers/v1") {
      throw invariantError("KL-6-OFFLINE-FAIL-CLOSED-FRESHNESS", "offline trust bundle identifier changed");
    }
    if (!Number.isInteger(bundle.generation) || bundle.generation < 1) {
      throw invariantError("KL-1-MONOTONE-GENERATION", "bundle generation is invalid");
    }
    if (
      bundle.predecessor_generation !== undefined &&
      (!Number.isInteger(bundle.predecessor_generation) || bundle.predecessor_generation >= bundle.generation)
    ) {
      throw invariantError("KL-1-MONOTONE-GENERATION", "bundle generation regresses against its predecessor");
    }
    if (!Number.isInteger(bundle.max_staleness_seconds) || bundle.max_staleness_seconds < 1) {
      throw invariantError("KL-6-OFFLINE-FAIL-CLOSED-FRESHNESS", "bundle freshness bound is invalid");
    }
    const keys = Array.isArray(bundle.keys) ? bundle.keys : [];
    if (keys.filter(({ state }) => state === "active").length > 1) {
      throw invariantError("KL-5-SINGLE-ACTIVE-SIGNER", "single active signer invariant violated");
    }
    if (new Set(keys.map(({ kid }) => kid)).size !== keys.length) {
      throw invariantError("KL-7-PUBLIC-MATERIAL-AND-RFC7638-KID", "trust bundle contains duplicate kid");
    }
    keys.forEach(validateTrustKey);
    if (index === 0) continue;
    const previous = bundles[index - 1];
    if (bundle.generation <= previous.generation || bundle.predecessor_generation !== previous.generation) {
      throw invariantError("KL-1-MONOTONE-GENERATION", "monotone bundle generation invariant violated");
    }
    if (Date.parse(bundle.generated_at) <= Date.parse(previous.generated_at)) {
      throw invariantError("KL-1-MONOTONE-GENERATION", "bundle generated_at must increase with generation");
    }
    const currentByKid = new Map(keys.map((key) => [key.kid, key]));
    for (const oldKey of previous.keys) {
      const current = currentByKid.get(oldKey.kid);
      if (!current) throw invariantError("KL-2-PREDECESSOR-KEY-RETENTION", "predecessor key retention invariant violated");
      const backwards =
        oldKey.state === "revoked"
          ? current.state !== "revoked"
          : current.state !== "revoked" && stateRank[current.state] < stateRank[oldKey.state];
      if (backwards) throw invariantError("KL-3-MONOTONE-KEY-STATE", "monotone key state invariant violated");
    }
  }
}

export function validateDurabilityStatement(statement) {
  if (statement.intent_committed_before_dispatch !== true) {
    throw invariantError("LD-1-INTENT-BEFORE-DISPATCH", "intent before dispatch invariant violated");
  }
  if (statement.receipt_committed_before_result !== true) {
    throw invariantError("LD-2-RECEIPT-BEFORE-RESULT", "receipt before result invariant violated");
  }
  if (!["failed", "denied", "unavailable"].includes(statement.completion_without_durable_receipt_status)) {
    throw invariantError("LD-3-NO-COMPLETED-WITHOUT-DURABLE-RECEIPT", "completion failure mapping cannot be completed");
  }
  if (statement.performed_unrecorded_handling !== "alarm_grade_reconciliation_never_completed") {
    throw invariantError("LD-4-UNRESOLVED-EXECUTION-RECONCILIATION", "performed-unrecorded reconciliation invariant violated");
  }
  if (statement.unresolved_intent_terminalization !== "failed_or_timed_out_receipt") {
    throw invariantError("LD-4-UNRESOLVED-EXECUTION-RECONCILIATION", "unresolved intent terminalization invariant violated");
  }
  if (statement.receipt_read_visibility !== "durable_only_unavailable_without_existence_detail") {
    throw invariantError("LD-6-DURABLE-ONLY-READ-VISIBILITY", "durable-only receipt visibility invariant violated");
  }
  if (statement.append_only !== true) throw invariantError("LD-5-APPEND-ONLY", "append-only invariant violated");
  if (statement.replay_resigns !== false) throw invariantError("LD-8-REPLAY-NEVER-RESIGNS", "replay never re-signs invariant violated");
  if (
    !Number.isInteger(statement.receipt_retention_days) ||
    !Number.isInteger(statement.trust_bundle_retention_days) ||
    statement.receipt_retention_days < 1 ||
    statement.trust_bundle_retention_days < 1 ||
    statement.receipt_retention_days > statement.trust_bundle_retention_days
  ) {
    throw invariantError("LD-7-RETENTION-COUPLING", "retention coupling invariant violated");
  }
}

async function readExamplesManifest(repositoryRoot) {
  const root = join(repositoryRoot, "contracts", "examples", "receipt-trust-durability");
  validateCorpusInventory(await listCorpusFiles(root));
  const path = join(root, "examples-manifest.json");
  const manifest = (await readJsonStrict(path)).value;
  if (manifest.status !== PROPOSAL_STATUS) throw new Error("examples manifest lifecycle must match proposal");
  const paths = manifest.cases?.map(({ file }) => file) ?? [];
  if (
    paths.length !== EXPECTED_CASE_PATHS.length ||
    paths.some((pathValue, index) => pathValue !== EXPECTED_CASE_PATHS[index])
  ) {
    throw new Error("example case inventory must remain exact and ordered");
  }
  return manifest;
}

async function listCorpusFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const corpusPath = relative(root, path).split(sep).join("/");
      if (entry.isSymbolicLink()) files.push(`SYMLINK:${corpusPath}`);
      else if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(corpusPath);
    }
  }
  await visit(root);
  return files;
}

async function validateFixtureExpectations(packet, examplesManifest) {
  const expectations = requireRecord(packet.verification?.fixture_expectations, "fixture expectations");
  const expectedPaths = Object.keys(expectations);
  if (
    expectedPaths.length !== EXPECTED_FIXTURE_PATHS.length ||
    expectedPaths.some((pathValue, index) => pathValue !== EXPECTED_FIXTURE_PATHS[index])
  ) {
    throw new Error("fixture expectation inventory must remain exact and ordered");
  }
  const caseByPath = new Map(examplesManifest.cases.map((entry) => [entry.file, entry]));
  for (const [relative, expected] of Object.entries(expectations)) {
    if (typeof expected !== "string" || caseByPath.get(relative)?.expected_rule !== expected) {
      throw new Error(`fixture expectation mismatch: ${relative}`);
    }
  }
}

function runSemanticValidator(schemaName, value) {
  if (schemaName === "trust_bundle") return validateTrustBundleSequence([value]);
  if (schemaName === "durability") return validateDurabilityStatement(value);
  throw new Error(`unknown example schema: ${schemaName}`);
}

async function validateCorpus(repositoryRoot, examplesManifest) {
  const schemas = await loadReceiptTrustDurabilitySchemas({ repositoryRoot });
  const root = join(repositoryRoot, "contracts", "examples", "receipt-trust-durability");
  const positiveTrustBundles = [];
  for (const example of examplesManifest.cases) {
    const value = (await readJsonStrict(join(root, example.file))).value;
    const schemaValidator = example.schema === "trust_bundle" ? schemas.trustBundle : schemas.durability;
    const schemaValid = schemaValidator(value);
    if (example.kind === "positive" && !schemaValid) throw new Error(`positive fixture schema-invalid: ${example.file}`);
    if (example.kind === "negative-schema" && schemaValid) throw new Error(`negative-schema fixture unexpectedly valid: ${example.file}`);
    if (example.kind === "negative-schema") {
      let actualRule = null;
      try {
        runSemanticValidator(example.schema, value);
      } catch (error) {
        actualRule = error.ruleId;
      }
      if (actualRule !== example.expected_rule) throw new Error(`schema-negative fixture rule mismatch: ${example.file}`);
    }
    if (example.kind === "negative-semantic") {
      if (!schemaValid) throw new Error(`negative-semantic fixture schema-invalid: ${example.file}`);
      let actualRule = null;
      try {
        runSemanticValidator(example.schema, value);
      } catch (error) {
        actualRule = error.ruleId;
      }
      if (actualRule !== example.expected_rule) throw new Error(`semantic fixture rule mismatch: ${example.file}`);
    }
    if (example.kind === "positive" && example.schema === "trust_bundle") positiveTrustBundles.push(value);
    if (example.kind === "positive" && example.schema === "durability") validateDurabilityStatement(value);
  }
  validateTrustBundleSequence(positiveTrustBundles);
}

function validateInvariants(packet) {
  const ids = packet.design_invariants?.map(({ id }) => id) ?? [];
  if (
    ids.length !== REQUIRED_INVARIANTS.length ||
    ids.some((id, index) => id !== REQUIRED_INVARIANTS[index])
  ) {
    throw new Error("design invariant inventory must remain exact and ordered");
  }
}

function validateBoundaries(packet) {
  if (packet.authority_boundaries?.trust_bundle_fetch !== "offline local bundle only; bundle_uri is never a fetch instruction") {
    throw new Error("offline trust bundle boundary changed");
  }
  const semantics = packet.durable_receipt_semantics;
  if (
    !Array.isArray(semantics) ||
    semantics.length !== EXPECTED_DURABLE_SEMANTICS.length ||
    semantics.some((entry, index) => entry !== EXPECTED_DURABLE_SEMANTICS[index])
  ) {
    throw new Error(
      "durable receipt semantics must remain exact, append-only, and replay must never re-sign",
    );
  }
  const retention = requireRecord(packet.retention_coupling, "retention coupling");
  if (
    !Number.isInteger(retention.receipt_retention_days) ||
    !Number.isInteger(retention.trust_bundle_retention_days) ||
    retention.receipt_retention_days < 1 ||
    retention.trust_bundle_retention_days < 1 ||
    retention.receipt_retention_days > retention.trust_bundle_retention_days
  ) {
    throw new Error("retention coupling requires receipt retention not to exceed trust-bundle retention");
  }
  if (
    packet.ownership?.suite !== "cross-product contracts and static evidence only" ||
    packet.ownership?.fabric !== "signer, trust distribution, durable ledger and runtime authority" ||
    packet.ownership?.soc !== "alert, case, analyst and tenant truth only" ||
    packet.ownership?.cyber_ai !== "model and orchestration semantics only"
  ) {
    throw new Error("ownership boundary changed");
  }
  const dependencyDeclaration = packet.verification?.validator_dependencies;
  if (
    dependencyDeclaration?.resolution_order !== "repository-local first; explicit CYBRIK_CONTRACT_VALIDATION_DEPS_ROOT override second" ||
    dependencyDeclaration?.external_root_policy !== "allowed only when exact package versions match the lockfile-pinned validator toolchain" ||
    dependencyDeclaration?.packages?.ajv !== EXPECTED_VALIDATOR_DEPENDENCIES.ajv ||
    dependencyDeclaration?.packages?.["ajv-formats"] !== EXPECTED_VALIDATOR_DEPENDENCIES["ajv-formats"]
  ) {
    throw new Error("validator dependency declaration must remain exact");
  }
}

function validateConstraints(packet) {
  const release = packet.release_constraints ?? {};
  if (release.stable_v1_founder_go_no_go !== "2026-12-20" || release.release_window !== "2026-12-21/2026-12-31") {
    throw new Error("release constraints changed");
  }
  if (packet.production_authorized !== false) throw new Error("production_authorized must remain false");
  if (
    !Array.isArray(packet.non_claims) ||
    packet.non_claims.length !== EXPECTED_NON_CLAIMS.length ||
    packet.non_claims.some((claim, index) => claim !== EXPECTED_NON_CLAIMS[index])
  ) {
    throw new Error("non_claims must remain exact");
  }
}

export function evaluateReceiptTrustDurabilityGate(packet) {
  const accepted = packet["x-cybrik-status"] === ACCEPTED_STATUS;
  const keyLifecycleDesignAccepted = accepted && packet.acceptance?.key_lifecycle_design_accepted === true;
  const durableStoreDesignAccepted = accepted && packet.acceptance?.durable_store_design_accepted === true;
  return {
    lifecycle: packet["x-cybrik-status"],
    keyLifecycleDesignAccepted,
    durableStoreDesignAccepted,
    implementationAuthorized: keyLifecycleDesignAccepted && durableStoreDesignAccepted,
    runtimeAuthorized: false,
  };
}

export async function validateReceiptTrustDurabilityPacket(packet, { repositoryRoot }) {
  const candidate = requireRecord(packet, "packet");
  if (candidate.schema_version !== "cybrik.receipt-trust-durability-proposal.v1") {
    throw new Error("packet identity mismatch");
  }
  validateLifecycle(candidate);
  validateInventory(candidate);
  await validateMemberDigests(candidate, repositoryRoot);
  await validateReusePins(candidate, repositoryRoot);
  validateInvariants(candidate);
  const examplesManifest = await readExamplesManifest(repositoryRoot);
  await validateFixtureExpectations(candidate, examplesManifest);
  await validateCorpus(repositoryRoot, examplesManifest);
  validateBoundaries(candidate);
  validateConstraints(candidate);
  return evaluateReceiptTrustDurabilityGate(candidate);
}

async function main() {
  const directory = dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = join(directory, "..", "..");
  const path = join(repositoryRoot, "contracts", "compatibility", "cybrik-suite-receipt-trust-durability-proposal.v1.manifest.json");
  const packet = JSON.parse(await readFile(path, "utf8"));
  process.stdout.write(`${JSON.stringify(await validateReceiptTrustDurabilityPacket(packet, { repositoryRoot }), null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
