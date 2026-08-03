#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_CONDITION_IDS = Object.freeze([
  "business_contract_accepted",
  "transport_binding_accepted",
  "receipt_integrity_profile_accepted",
  "fabric_in_process_boundary_reviewed",
  "runtime_endpoint_contract_accepted",
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
]);

const SHA40 = /^[0-9a-f]{40}$/;
const REPOSITORY_QUALIFIED_EVIDENCE = /^[a-z0-9][a-z0-9._-]*:[^/].+/;
const PLACEHOLDER_AUTHOR = /(?:your name|your@email\.com)/i;

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
    }
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

export function validateFabricRuntimeProducerGate(packet) {
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
  if (!SHA40.test(fabricPin.parent) || fabricPin.pushed !== false || fabricPin.merged !== false) {
    throw new Error("fabric candidate must retain parent provenance and remain unpushed/unmerged");
  }

  validateConditions(candidate.conditions);
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
  process.stdout.write(`${JSON.stringify(validateFabricRuntimeProducerGate(packet), null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
