#!/usr/bin/env bash
# Pre-Founder integrated SOC -> Cyber AI -> Tool Fabric UAT runner.
#
# STATUS: AUTHORED NOT RUN.
#
# This file is the frozen, ordered command contract for the *eventual* D2
# runtime attempt. It has never been executed. It is deliberately not marked
# executable, it starts nothing, it binds nothing, and it refuses to proceed
# past its authorization guard.
#
# Its ordered step identities are pinned by
# scripts/prefounder_uat_scenario.py::RUNNER_COMMAND_CONTRACT and its exact
# bytes are pinned by RUNNER_SCRIPT_SHA256. Any drift in this file, in the step
# order, or in the adjacent integrated-scenario manifest fails the assessor
# closed with runner_command_contract_invalid before any verdict is derived.
#
# Running this script is NOT authorized. Authorization for one bounded D2
# attempt is a separate, exact, signed Founder action recorded outside this
# repository; it does not exist. Until then the only supported command in this
# lane is the read-only assessor in assess mode.

set -euo pipefail

readonly REQUIRED_AUTHORIZATION="CYBRIK_D2_RUNTIME_AUTHORIZATION"
readonly EXIT_UNAUTHORIZED=3

# ---------------------------------------------------------------------------
# Fail-closed guard. This is the first and, today, the only reachable action.
# ---------------------------------------------------------------------------

cybrik_refuse() {
  printf 'runtime_not_authorized\n' >&2
  printf 'This runner is AUTHORED NOT RUN. No D2 runtime authorization exists.\n' >&2
  exit "${EXIT_UNAUTHORIZED}"
}

if [ "${!REQUIRED_AUTHORIZATION:-}" != "granted-exact-one-shot" ]; then
  cybrik_refuse
fi

# No authorization value is admitted by this revision: the guard above is
# unconditional in effect, and the ordered contract below documents what a
# future authorized revision must execute, in exactly this order.
cybrik_refuse

# ---------------------------------------------------------------------------
# Phase 1 - preflight (read-only observation only)
# ---------------------------------------------------------------------------
#
#  1 pin-three-product-identities
#      Check out all three product repositories at their pinned commit and tree
#      identities, detached and clean, and record the read-only observations.
#  2 verify-product-source-roots
#      Confirm every admitted product source root declared in the manifest is
#      present at its pinned path and symbol.
#  3 verify-docker-engine
#      Confirm the container CLI is present and its daemon is reachable.
#  4 verify-pinned-postgres-image
#      Confirm the digest-pinned PostgreSQL image is already present locally.
#  5 verify-loopback-binds-free
#      Confirm 127.0.0.1:55432 and 127.0.0.1:58443 are free.
#  6 run-prefounder-dry-assessment
#      Run scripts/prefounder_uat_scenario.py in assess mode and retain its
#      expected HOLD verdict and complete blocker set as dry evidence.
#  7 require-runtime-launch-admission
#      Before any future authorized launch, require zero runtime-launch
#      blockers. Execution-only HOLD blockers remain terminal obligations.
#
# ---------------------------------------------------------------------------
# Phase 2 - scenario (exact manifest step order)
# ---------------------------------------------------------------------------
#
#  8 soc-lifecycle-create-request
#  9 cyber-ai-delegation-admission
# 10 cyber-ai-durable-replay
# 11 cyber-ai-fabric-invocation
# 12 fabric-policy-admission
# 13 fabric-bounded-execution
# 14 fabric-runtime-receipt-production
# 15 suite-terminal-evidence
#
# ---------------------------------------------------------------------------
# Phase 3 - terminal (negatives, rollback, residual, receipt admission)
# ---------------------------------------------------------------------------
#
# 16 execute-negative-case-inventory
#      Execute N1-N10 plus F1-F2 and retain every fail-closed result.
# 17 capture-rollback-evidence
#      Execute the admitted rollback lifecycle step and capture its receipt.
# 18 verify-no-residual-state
#      Prove no container, listener, ephemeral PKI, repository or restricted
#      material residual remains.
# 19 admit-tool-fabric-runtime-receipt
#      Independently review and digest-pin the accepted bound receipt emitted
#      by the Fabric-owned runtime path. No synthetic artifact and no status
#      edit can stand in for it.
