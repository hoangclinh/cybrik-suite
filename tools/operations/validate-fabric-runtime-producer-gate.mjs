#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_CONDITION_IDS = Object.freeze([
  "business_contract_accepted",
  "transport_binding_accepted",
  "receipt_integrity_profile_accepted",
  "fabric_in_process_boundary_reviewed",
  "runtime_route_profile_implementation_authorized",
  "key_lifecycle_trust_bundle_design_accepted",
  "durable_receipt_store_design_accepted",
  "product_runtime_producer_implemented_reviewed",
  "canonical_tuple_hosted_ci_green",
  "runtime_negative_and_rollback_evidence",
  "coverage_remeasured_current_suite_tree",
]);

const REQUIRED_CONDITION_PHASES = Object.freeze([
  "implementation",
  "implementation",
  "implementation",
  "implementation",
  "implementation",
  "implementation",
  "implementation",
  "runtime",
  "runtime",
  "runtime",
  "runtime",
]);

const EXPECTED_RELEASE_CONSTRAINTS = Object.freeze({
  stable_v1_founder_go_no_go: "2026-12-20",
  release_window: "2026-12-21/2026-12-31",
});

const EXPECTED_NON_CLAIMS = Object.freeze([
  "no_runtime_started",
  "no_uat_pass",
  "no_demo_or_release_promotion",
  "no_production_authority",
  "no_canonical_tuple_ci_claim",
]);

const SHA40 = /^[0-9a-f]{40}$/;
const REPOSITORY_QUALIFIED_EVIDENCE = /^[a-z0-9][a-z0-9._-]*:[^/].+/;
const PLACEHOLDER_AUTHOR = /(?:your name|your@email\.com)/i;
const ACCEPTED_DESIGN_STATUS = "ACCEPTED FOR IMPLEMENTATION — NOT IMPLEMENTED";
const TRUST_DURABILITY_EVIDENCE_PATH =
  "cybrik-suite:contracts/compatibility/cybrik-suite-receipt-trust-durability-proposal.v1.manifest.json";
const EXPECTED_FABRIC_RUNTIME_PRODUCER = Object.freeze({
  commit: "7f2561e501585bb5d66b9a32d6b9ac2c3a2f94d7",
  tree: "0cd08e52a636ff03586aa30223a623e1f08a836b",
  parent: "e06b19c528c90a375898f8cce6d22ed0124c96da",
  author: "Cybrik Codex Worker <codex-worker@local.invalid>",
});
const EXPECTED_RUNTIME_PRODUCER_EVIDENCE = Object.freeze([
  "cybrik-security-tool-fabric:commit/7f2561e501585bb5d66b9a32d6b9ac2c3a2f94d7",
  "cybrik-security-tool-fabric:tree/0cd08e52a636ff03586aa30223a623e1f08a836b",
  "cybrik-security-tool-fabric:docs/adr/ADR-0005-receipt-trust-durability-runtime-producer-reference.md",
  "cybrik-suite:docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/05-fabric-runtime-producer-review.md",
]);
const EXPECTED_RUNTIME_PRODUCER_VERIFICATION = Object.freeze({
  exact_path_count: 51,
  prospective_patch_sha256:
    "4e52491718b67128f306bf4ab122cb02d962377242bb3c200cd0a87ecd508d1e",
  content_aggregate_sha256:
    "9a54f288348715f0c156437bd974acb6cad62655d6994a96c4ead8a6e75f2f6d",
});

const EXPECTED_FABRIC_PUBLICATION_KEYS = Object.freeze([
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
const EXPECTED_FABRIC_PUBLICATION_SCALARS = Object.freeze({
  repository: "cybrik-security-tool-fabric",
  provider: "github_actions",
  draft_pull_request: 5,
  draft_pull_request_url: "https://github.com/hoangclinh/cybrik-security-tool-fabric/pull/5",
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
  candidate_reachable_from_head: true,
  candidate_tree_equals_head_tree: false,
  runtime_implementation_modified: false,
  coverage_scope: "single_repository",
});
const EXPECTED_FABRIC_PUBLICATION_JOBS = Object.freeze([
  "scaffold-integrity",
  "secret-scan",
  "detect",
  "control-plane",
  "executor",
  "admission-gate",
]);
const EXPECTED_FABRIC_PUBLICATION_DELTA_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
  ".gitleaks.toml",
  "tests/control-plane/test_ci_admission.py",
]);
const EXPECTED_CANONICAL_TUPLE_EVIDENCE = Object.freeze([
  "cybrik-security-tool-fabric:actions/runs/30797481044",
  "cybrik-security-tool-fabric:commit/50aff1df146d6e98b33d9f82617781595bcf1512",
  "cybrik-security-tool-fabric:tree/2b4d516eef0a3b0ae05b44a225515efef749f25b",
  "cybrik-suite:docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/05-fabric-runtime-producer-review.md",
]);
const CANONICAL_TUPLE_NOTE_RULES = Object.freeze([
  /qualified partial evidence/i,
  /single Fabric repository/i,
  /not canonical four-repository CI/i,
  /remains open and unsatisfied/i,
]);

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireCleanPin(pin, label) {
  const candidate = requireRecord(pin, label);
  if (
    !SHA40.test(candidate.commit) ||
    !SHA40.test(candidate.tree) ||
    typeof candidate.author !== "string" ||
    candidate.author.trim() === "" ||
    PLACEHOLDER_AUTHOR.test(candidate.author)
  ) {
    throw new Error(`${label} must contain clean commit, tree and author provenance`);
  }
  return candidate;
}

function validateConditions(conditions) {
  if (!Array.isArray(conditions)) {
    throw new TypeError("condition inventory must be an array");
  }
  const ids = conditions.map((condition) => condition?.id);
  if (
    ids.length !== REQUIRED_CONDITION_IDS.length ||
    ids.some((id, index) => id !== REQUIRED_CONDITION_IDS[index]) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("condition inventory must be exact, ordered, unique and closed");
  }

  for (const [index, condition] of conditions.entries()) {
    requireRecord(condition, `condition ${condition.id}`);
    if (condition.phase !== REQUIRED_CONDITION_PHASES[index]) {
      throw new Error("condition phase inventory must remain exact and ordered");
    }
    if (typeof condition.satisfied !== "boolean") {
      throw new Error(`condition ${condition.id} satisfied must be boolean`);
    }
    if (!Array.isArray(condition.evidence)) {
      throw new Error(`condition ${condition.id} evidence must be an array`);
    }
    if (condition.satisfied) {
      if (condition.evidence_state !== "verified" || condition.evidence.length === 0) {
        throw new Error(`satisfied condition ${condition.id} requires verified evidence`);
      }
      if (!condition.evidence.every((entry) => REPOSITORY_QUALIFIED_EVIDENCE.test(entry))) {
        throw new Error(`satisfied condition ${condition.id} requires repository-qualified evidence`);
      }
    } else if (!new Set(["missing", "open"]).has(condition.evidence_state)) {
      throw new Error(`open condition ${condition.id} cannot use pass-like evidence_state`);
    } else if (!condition.evidence.every((entry) => REPOSITORY_QUALIFIED_EVIDENCE.test(entry))) {
      throw new Error(`open condition ${condition.id} requires repository-qualified evidence`);
    }
  }
}

function validateAcceptedDesignClosure(conditions, trustDurabilityPacket) {
  const design = requireRecord(trustDurabilityPacket, "accepted trust/durability packet");
  if (
    design.schema_version !== "cybrik.receipt-trust-durability-proposal.v1" ||
    design["x-cybrik-status"] !== ACCEPTED_DESIGN_STATUS ||
    design["x-cybrik-not-accepted"] !== false ||
    design["x-cybrik-not-implemented"] !== true ||
    design.acceptance?.key_lifecycle_design_accepted !== true ||
    design.acceptance?.durable_store_design_accepted !== true ||
    design.production_authorized !== false
  ) {
    throw new Error("runtime producer design closure requires the accepted not-implemented packet");
  }
  for (const id of [
    "key_lifecycle_trust_bundle_design_accepted",
    "durable_receipt_store_design_accepted",
  ]) {
    const condition = conditions.find((candidate) => candidate.id === id);
    if (
      condition?.satisfied !== true ||
      condition.evidence_state !== "verified" ||
      !condition.evidence.includes(TRUST_DURABILITY_EVIDENCE_PATH)
    ) {
      throw new Error(`runtime producer design closure condition is not bound: ${id}`);
    }
  }
}

function validateRuntimeProducerClosure(conditions, fabricPin) {
  if (
    fabricPin.commit !== EXPECTED_FABRIC_RUNTIME_PRODUCER.commit ||
    fabricPin.tree !== EXPECTED_FABRIC_RUNTIME_PRODUCER.tree ||
    fabricPin.parent !== EXPECTED_FABRIC_RUNTIME_PRODUCER.parent ||
    fabricPin.author !== EXPECTED_FABRIC_RUNTIME_PRODUCER.author
  ) {
    throw new Error("runtime producer closure must retain the reviewed Fabric commit provenance");
  }

  const condition = conditions.find(
    ({ id }) => id === "product_runtime_producer_implemented_reviewed",
  );
  const verification = requireRecord(
    condition?.verification,
    "runtime producer closure verification",
  );
  if (
    condition?.satisfied !== true ||
    condition.evidence_state !== "verified" ||
    condition.evidence.length !== EXPECTED_RUNTIME_PRODUCER_EVIDENCE.length ||
    condition.evidence.some(
      (entry, index) => entry !== EXPECTED_RUNTIME_PRODUCER_EVIDENCE[index],
    ) ||
    verification.exact_path_count !== EXPECTED_RUNTIME_PRODUCER_VERIFICATION.exact_path_count ||
    verification.prospective_patch_sha256 !==
      EXPECTED_RUNTIME_PRODUCER_VERIFICATION.prospective_patch_sha256 ||
    verification.content_aggregate_sha256 !==
      EXPECTED_RUNTIME_PRODUCER_VERIFICATION.content_aggregate_sha256 ||
    Object.keys(verification).length !==
      Object.keys(EXPECTED_RUNTIME_PRODUCER_VERIFICATION).length ||
    !/797 tests/i.test(condition.note) ||
    !/91% branch coverage/i.test(condition.note) ||
    !/P0-P2 clear/i.test(condition.note) ||
    !/not hosted CI or runtime evidence/i.test(condition.note)
  ) {
    throw new Error("runtime producer closure must retain exact implementation and review evidence");
  }
}

function validateFabricPublication(publication) {
  const record = requireRecord(publication, "fabric publication");
  const keys = Object.keys(record);
  if (
    keys.length !== EXPECTED_FABRIC_PUBLICATION_KEYS.length ||
    keys.some((key, index) => key !== EXPECTED_FABRIC_PUBLICATION_KEYS[index])
  ) {
    throw new Error("fabric publication key inventory must be exact, ordered and closed");
  }

  for (const [key, expected] of Object.entries(EXPECTED_FABRIC_PUBLICATION_SCALARS)) {
    if (record[key] !== expected) {
      throw new Error(`fabric publication field drifted from the verified hosted run: ${key}`);
    }
  }

  const jobs = record.jobs;
  if (
    !Array.isArray(jobs) ||
    jobs.length !== EXPECTED_FABRIC_PUBLICATION_JOBS.length ||
    jobs.some(
      (job, index) =>
        job === null ||
        typeof job !== "object" ||
        Object.keys(job).length !== 2 ||
        job.name !== EXPECTED_FABRIC_PUBLICATION_JOBS[index] ||
        job.conclusion !== "success",
    )
  ) {
    throw new Error(
      "fabric publication job inventory must be the exact ordered six successful jobs",
    );
  }

  const deltaPaths = record.post_candidate_delta_paths;
  if (
    !Array.isArray(deltaPaths) ||
    deltaPaths.length !== EXPECTED_FABRIC_PUBLICATION_DELTA_PATHS.length ||
    deltaPaths.some((path, index) => path !== EXPECTED_FABRIC_PUBLICATION_DELTA_PATHS[index])
  ) {
    throw new Error(
      "fabric publication post-candidate delta must be the exact three non-runtime paths",
    );
  }

  if (!Array.isArray(record.closes_conditions) || record.closes_conditions.length !== 0) {
    throw new Error("fabric publication must close no gate condition");
  }
}

function validateCanonicalTupleBoundary(conditions) {
  const canonical = conditions.find(
    ({ id }) => id === "canonical_tuple_hosted_ci_green",
  );
  if (canonical.satisfied !== false || canonical.evidence_state !== "open") {
    throw new Error(
      "canonical tuple hosted CI cannot be satisfied by single-repository Fabric evidence",
    );
  }
  if (
    canonical.evidence.length !== EXPECTED_CANONICAL_TUPLE_EVIDENCE.length ||
    canonical.evidence.some((entry, index) => entry !== EXPECTED_CANONICAL_TUPLE_EVIDENCE[index])
  ) {
    throw new Error(
      "canonical tuple partial evidence must cite the exact Fabric hosted run and review packet",
    );
  }
  if (CANONICAL_TUPLE_NOTE_RULES.some((rule) => !rule.test(canonical.note))) {
    throw new Error(
      "canonical tuple note must disclaim four-repository CI and keep the condition open",
    );
  }
}

export function evaluateFabricRuntimeProducerGate(packet) {
  const conditions = packet.conditions;
  const implementationOpen = conditions.some(
    ({ phase, satisfied }) => phase === "implementation" && !satisfied,
  );
  const blockerIds = conditions.filter(({ satisfied }) => !satisfied).map(({ id }) => id);
  const runtimeAuthorized = blockerIds.length === 0;

  return {
    implementationDisposition: implementationOpen ? "HOLD" : "GO",
    runtimeDisposition: runtimeAuthorized ? "GO" : "HOLD",
    runtimeAuthorized,
    blockerIds,
  };
}

export function validateFabricRuntimeProducerGate(packet, { trustDurabilityPacket } = {}) {
  const candidate = requireRecord(packet, "packet");
  if (
    candidate.schema_version !== "cybrik.fabric-runtime-producer-gate.v1" ||
    candidate.status !== "DRAFT" ||
    candidate.candidate_id !== "runtime-admission-soc-ai-lifecycle-mtls-r1"
  ) {
    throw new Error("packet identity is not the bounded Fabric runtime producer gate");
  }

  const constraints = requireRecord(candidate.release_constraints, "release constraints");
  if (
    constraints.stable_v1_founder_go_no_go !==
      EXPECTED_RELEASE_CONSTRAINTS.stable_v1_founder_go_no_go ||
    constraints.release_window !== EXPECTED_RELEASE_CONSTRAINTS.release_window
  ) {
    throw new Error("release constraints must keep the approved dates unchanged");
  }

  const pins = requireRecord(candidate.pins, "pins");
  requireCleanPin(pins.suite_base, "suite base");
  const fabricPin = requireCleanPin(pins.fabric_candidate, "fabric candidate");
  if (!SHA40.test(fabricPin.parent) || fabricPin.pushed !== true || fabricPin.merged !== false) {
    throw new Error(
      "fabric candidate must retain parent provenance and remain published but unmerged",
    );
  }

  validateConditions(candidate.conditions);
  validateFabricPublication(candidate.fabric_publication);
  validateCanonicalTupleBoundary(candidate.conditions);
  validateAcceptedDesignClosure(candidate.conditions, trustDurabilityPacket);
  validateRuntimeProducerClosure(candidate.conditions, fabricPin);
  const evaluated = evaluateFabricRuntimeProducerGate(candidate);
  const declared = requireRecord(candidate.declared, "declared dispositions");
  if (declared.implementation_disposition !== evaluated.implementationDisposition) {
    throw new Error("declared implementation disposition does not match the derived gate");
  }
  if (declared.runtime_disposition !== evaluated.runtimeDisposition) {
    throw new Error("declared runtime disposition does not match the derived gate");
  }
  if (declared.runtime_authorized !== evaluated.runtimeAuthorized) {
    throw new Error("declared runtime_authorized does not match the derived gate");
  }
  if (candidate.production_authorized !== false) {
    throw new Error("production_authorized must remain false and Founder-controlled");
  }
  if (
    !Array.isArray(candidate.non_claims) ||
    candidate.non_claims.length !== EXPECTED_NON_CLAIMS.length ||
    candidate.non_claims.some((claim, index) => claim !== EXPECTED_NON_CLAIMS[index])
  ) {
    throw new Error("non_claims must preserve the exact runtime, UAT, release and production limits");
  }

  return evaluated;
}

async function main() {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = join(moduleDirectory, "..", "..");
  const packetPath =
    process.argv[2] ??
    join(
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
  process.stdout.write(
    `${JSON.stringify(validateFabricRuntimeProducerGate(packet, { trustDurabilityPacket }), null, 2)}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
