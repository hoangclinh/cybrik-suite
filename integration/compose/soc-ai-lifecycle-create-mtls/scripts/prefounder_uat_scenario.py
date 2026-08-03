"""Assess the pre-Founder SOC->AI lifecycle mTLS scenario from injected facts.

This module is pure stdlib and import-inert. It probes nothing: every Docker,
daemon, image, loopback-bind and repository fact is supplied by a caller-owned
observations JSON document. It starts no process, opens no socket, runs no
container, touches no repository state and grants no runtime authority.

The only reachable verdict today is ``HOLD``: no Tool Fabric runtime receipt
digest is admitted, so the receipt blocker cannot be cleared and ``READY`` is
structurally unreachable. Execute mode is deliberately not authored and fails
closed before reading any input.

``EXECUTION_PLAN`` is the frozen pre-Founder admission-rehearsal contract: an
exact ordered partition of the assessor's frozen blockers into coordinator
steps whose terminal gate is admission of an accepted bound Tool Fabric
runtime receipt.
It prepares a future integrated run; it is not the integrated run itself.
Every report embeds the plan with per-step progress; a tampered plan fails
closed before any verdict is derived.

The adjacent digest-pinned integrated-scenario manifest specifies the complete
SOC -> Cyber AI -> Tool Fabric rehearsal, negative-case ownership and terminal
evidence contract. Its declared states are evidence inputs, never live probes.

An optional, digest-pinned synthetic Tool Fabric attestation may be supplied to
record that the Fabric UAT lane produced a read-only, non-executing artifact.
It is external evidence and is refused inside the Suite checkout. It is read
exact-byte through the same bounded, no-follow, stable-identity descriptor as
the runtime receipt, and is admitted into a *separate*
``prefounder_rehearsal`` report dimension with
its own ``REHEARSAL_BLOCKERS`` vocabulary, and it can never touch the frozen
assessment: ``FROZEN_BLOCKERS``, ``status``, ``execution_plan``,
``next_blocker``, plan step 10, ``tool_fabric_runtime_receipt_absent`` and the
process exit code are all derived without it. The artifact contract requires
``runtime_executed`` false, ``is_runtime_receipt`` false, ``synthetic`` true,
``read_only`` true, ``execution_authority`` false and ``side_effect_performed``
false by identity, so no synthetic artifact can ever read as runtime evidence.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path
from typing import Final

SCHEMA_VERSION: Final = "CYBRIK-D2-PREFOUNDER-SCENARIO/v1"
OBSERVATIONS_SCHEMA_VERSION: Final = "CYBRIK-D2-PREFOUNDER-OBSERVATIONS/v1"
MAX_OBSERVATIONS_BYTES: Final = 64 * 1024
MAX_RUNTIME_RECEIPT_BYTES: Final = 1024 * 1024
MAX_MANIFEST_BYTES: Final = 64 * 1024
MAX_FABRIC_ATTESTATION_BYTES: Final = 256 * 1024
BOUND_SUITE_ROOT: Path = Path(__file__).resolve().parents[4]

FROZEN_STATUSES: Final = ("HOLD", "READY")
FROZEN_BLOCKERS: Final = (
    "docker_cli_absent",
    "docker_daemon_not_running",
    "docker_image_missing",
    "integrated_step_not_implemented",
    "integrated_step_not_run",
    "loopback_bind_occupied",
    "negative_case_not_run",
    "product_head_not_detached",
    "product_identity_mismatch",
    "product_source_root_absent",
    "product_worktree_not_clean",
    "runner_command_contract_not_run",
    "runtime_wiring_absent",
    "terminal_evidence_not_captured",
    "tool_fabric_negative_gap_open",
    "tool_fabric_runtime_producer_absent",
    "tool_fabric_runtime_receipt_absent",
)
# Deliberately *not* part of FROZEN_BLOCKERS. The execution plan partitions the
# frozen blockers exactly, and the frozen assessment must stay byte-identical
# whether or not synthetic rehearsal evidence is supplied, so this dimension
# carries its own disjoint vocabulary and never reaches ``status`` or the plan.
REHEARSAL_BLOCKERS: Final = ("fabric_synthetic_attestation_absent",)
FROZEN_FAILURE_REASONS: Final = (
    "arguments_invalid",
    "execute_mode_not_authored",
    "execution_plan_invalid",
    "fabric_attestation_claim_inconsistent",
    "fabric_attestation_digest_mismatch",
    "fabric_attestation_invalid",
    "fabric_attestation_must_be_outside_suite",
    "fabric_attestation_path_invalid",
    "fabric_attestation_schema_version_mismatch",
    "integrated_scenario_invalid",
    "integrated_scenario_manifest_digest_mismatch",
    "observations_json_invalid",
    "observations_json_too_large",
    "observations_receipt_claim_contradicts_tree",
    "observations_schema_invalid",
    "observations_schema_version_mismatch",
    "report_json_exists",
    "report_json_must_be_outside_suite",
    "report_json_write_failed",
    "runner_command_contract_invalid",
    "suite_root_identity_mismatch",
    "suite_root_invalid",
    "tool_fabric_runtime_receipt_claim_unbacked",
    "tool_fabric_runtime_receipt_digest_mismatch",
    "tool_fabric_runtime_receipt_not_admitted",
    "vocabulary_violation",
)

# The pinned base tuple of
# docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/
# 02-architecture-and-acceptance.md section 1, product repositories only.
PINNED_PRODUCTS: Final[dict[str, tuple[str, str]]] = {
    "cybrik-cyber-ai-platform": (
        "789614144686dab88500dd2bfecdd608ef0a8b8f",
        "244140e3aacd783b1bea7542f9f56ffc46cedc86",
    ),
    "cybrik-security-tool-fabric": (
        "49583be00235a0f8ad7da8cb4ea99108ad201a69",
        "ca8b4a03116bea979de89b92b2f8fef4fd31e001",
    ),
    "cybrik-soc-command-center": (
        "abfdfde96afc6daa2868694de993c623daa8862e",
        "241ef24a33246918ff5cf133e7d8d004823fdf06",
    ),
}
# Mirrors src/cybrik_suite_uat_mtls/store.py POSTGRES_IMAGE. The runner cannot
# import the harness package and stay import-inert, so the pin is duplicated and
# bound back to its source by test_prefounder_scenario.py.
REQUIRED_IMAGE_REFERENCES: Final = (
    "postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777",
)
# Mirrors src/cybrik_suite_uat_mtls/policy.py PROPOSED_BINDS, sorted.
PROSPECTIVE_BINDS: Final = ("127.0.0.1:55432", "127.0.0.1:58443")

INTEGRATED_SCENARIO_SCHEMA_VERSION: Final = (
    "CYBRIK-D2-PREFOUNDER-INTEGRATED-SCENARIO/v2"
)
EVIDENCE_CLASS: Final = "rehearsal_only"
# The ownership roles of the three pinned product repositories, mirroring the
# governing ownership table in cybrik-suite:CLAUDE.md. A manifest that gives a
# product another product's role fails closed.
PRODUCT_ROLES: Final[dict[str, str]] = {
    "cybrik-cyber-ai-platform": "ai_runtime",
    "cybrik-security-tool-fabric": "tool_execution",
    "cybrik-soc-command-center": "soc_truth",
}
TOOL_FABRIC_REPOSITORY: Final = "cybrik-security-tool-fabric"
RUNTIME_WIRING_STATUSES: Final = ("not_wired", "wired_and_run")
TOOL_FABRIC_RUNTIME_WIRING_STATUS: Final = "not_wired"
TOOL_FABRIC_RUNTIME_PRODUCER_STATUS: Final = "not_implemented"
_TOOL_FABRIC_RUNTIME_FIELDS: Final = (
    "current_invocation_boundary",
    "current_receipt_form",
    "receipt_signature_envelope",
    "responsibility",
    "runtime_receipt_producer_status",
    "runtime_wiring_status",
)
_TOOL_FABRIC_RESPONSIBILITY_FIELDS: Final = (
    "execution",
    "invocation",
    "policy",
    "receipt",
)
_PRODUCT_ENTRY_FIELDS: Final = (
    "admitted_source_roots",
    "repository",
    "role",
    "runtime_wiring",
    "surfaces",
)
_SOURCE_ROOT_FIELDS: Final = ("identity", "path", "symbol")
_RUNTIME_WIRING_FIELDS: Final = ("identity", "requirement", "status")
_KEBAB: Final = re.compile(r"^[a-z][a-z0-9-]*$")
_SOURCE_ROOT_PATH: Final = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_./-]*$")
PRODUCT_FLOW: Final = (
    "cybrik-soc-command-center",
    "cybrik-cyber-ai-platform",
    "cybrik-security-tool-fabric",
    "cybrik-suite",
)
SCENARIO_SURFACES: Final = (
    "ai_mtls",
    "postgres_replay",
    "soc_client",
    "suite_evidence",
    "tool_fabric_delegation",
    "tool_fabric_receipt",
)
STEP_STATUSES: Final = (
    "authored_not_run",
    "implemented_and_run",
    "not_implemented",
)
NEGATIVE_CASE_STATUSES: Final = (
    "authored_not_run",
    "executed_failed_closed",
    "not_implemented",
)
TERMINAL_EVIDENCE_STATUSES: Final = ("captured", "not_captured")
TERMINAL_EVIDENCE_CHECKS: Final = (
    "rollback_executed",
    "no_container_residual",
    "no_listener_residual",
    "no_ephemeral_pki_residual",
    "no_repository_residual",
    "no_secret_material_residual",
)
REQUIRED_NEGATIVE_CASE_PURPOSES: Final = (
    ("N1", "replayed_delegation"),
    ("N2", "cnf_mismatch"),
    ("N3", "wrong_audience"),
    ("N4", "wrong_scope"),
    ("N5", "wrong_operation"),
    ("N6", "cross_tenant"),
    ("N7", "tenant_org_advisory_mismatch"),
    ("N8", "missing_server_tls_extension"),
    ("N9", "postgresql_unavailable"),
    ("N10", "secret_material_leakage"),
)
INTEGRATED_SCENARIO_MANIFEST_PATH: Path = (
    Path(__file__).parent / "prefounder_integrated_scenario.manifest.json"
)
INTEGRATED_SCENARIO_MANIFEST_SHA256: str = (
    "b69331ee620823581930b3fb4cfd05e589c9f5f6655829c17d7d1a97d22f8ebd"
)

# Only blockers that must be closed before launching a future authorized
# runtime belong here. Expected HOLD blockers that can clear only by executing
# the frozen scenario remain outside this set, so the dry assessment is
# reachable and truthful before a runtime attempt.
RUNTIME_LAUNCH_BLOCKERS: Final = (
    "docker_cli_absent",
    "docker_daemon_not_running",
    "docker_image_missing",
    "integrated_step_not_implemented",
    "loopback_bind_occupied",
    "product_head_not_detached",
    "product_identity_mismatch",
    "product_source_root_absent",
    "product_worktree_not_clean",
    "runtime_wiring_absent",
    "tool_fabric_negative_gap_open",
    "tool_fabric_runtime_producer_absent",
)

# ---------------------------------------------------------------------------
# Frozen runner command contract
# ---------------------------------------------------------------------------
#
# The adjacent shell runner is AUTHORED NOT RUN. This tuple is the exact
# ordered runtime contract it documents: a preflight phase of read-only
# observations, the scenario phase in exact manifest step order, and a terminal
# phase ending at admission of a reviewed Tool Fabric runtime receipt. The
# runner's exact bytes, its identity order and its execution status are all
# validated on every assessment.
RUNNER_CONTRACT_VERSION: Final = "CYBRIK-D2-PREFOUNDER-RUNNER-CONTRACT/v1"
RUNNER_PHASES: Final = ("preflight", "scenario", "terminal")
RUNNER_EXECUTION_STATUSES: Final = ("authored_not_run", "executed")
# The runner has never been executed. While this is not "executed", the runner
# blocker cannot be cleared by any observation or manifest edit.
RUNNER_EXECUTION_STATUS: Final = "authored_not_run"
# The contract's terminal command mirrors the execution plan's terminal step:
# nothing may be appended after receipt admission, and it may not be dropped.
RUNNER_TERMINAL_COMMAND: Final = "admit-tool-fabric-runtime-receipt"
RUNNER_SCRIPT_PATH: Path = Path(__file__).parent / "run_prefounder_integrated_uat.sh"
RUNNER_SCRIPT_SHA256: str = (
    "345e68c9a5111505109a709e7e34f3cdc05216598c92521ecc722f125fa5ecb2"
)
MAX_RUNNER_SCRIPT_BYTES: Final = 64 * 1024
_RUNNER_COMMAND_FIELDS: Final = ("identity", "order", "phase", "requirement")
RUNNER_COMMAND_CONTRACT: Final[tuple[dict[str, object], ...]] = (
    {
        "order": 1,
        "phase": "preflight",
        "identity": "pin-three-product-identities",
        "requirement": (
            "Check out all three product repositories at their pinned commit "
            "and tree identities, detached and clean."
        ),
    },
    {
        "order": 2,
        "phase": "preflight",
        "identity": "verify-product-source-roots",
        "requirement": (
            "Confirm every admitted product source root declared in the "
            "manifest is present at its pinned path and symbol."
        ),
    },
    {
        "order": 3,
        "phase": "preflight",
        "identity": "verify-docker-engine",
        "requirement": (
            "Confirm by read-only observation that the container CLI is "
            "present and its daemon is reachable."
        ),
    },
    {
        "order": 4,
        "phase": "preflight",
        "identity": "verify-pinned-postgres-image",
        "requirement": (
            "Confirm the digest-pinned PostgreSQL image is already present "
            "locally; pulling it is outside this contract."
        ),
    },
    {
        "order": 5,
        "phase": "preflight",
        "identity": "verify-loopback-binds-free",
        "requirement": (
            "Confirm 127.0.0.1:55432 and 127.0.0.1:58443 are free without "
            "opening a socket."
        ),
    },
    {
        "order": 6,
        "phase": "preflight",
        "identity": "run-prefounder-dry-assessment",
        "requirement": (
            "Run this assessor in assess mode and retain its expected HOLD "
            "verdict and complete blocker set without treating HOLD as a dry "
            "assessment failure."
        ),
    },
    {
        "order": 7,
        "phase": "preflight",
        "identity": "require-runtime-launch-admission",
        "requirement": (
            "Before any future authorized runtime launch, require zero "
            "runtime-launch blockers; execution-only HOLD blockers remain "
            "terminal evidence obligations."
        ),
    },
    {
        "order": 8,
        "phase": "scenario",
        "identity": "soc-lifecycle-create-request",
        "requirement": "Execute the SOC-produced manifest step in exact order.",
    },
    {
        "order": 9,
        "phase": "scenario",
        "identity": "cyber-ai-delegation-admission",
        "requirement": "Execute the Cyber AI-produced manifest step in exact order.",
    },
    {
        "order": 10,
        "phase": "scenario",
        "identity": "cyber-ai-durable-replay",
        "requirement": "Execute the Cyber AI-produced manifest step in exact order.",
    },
    {
        "order": 11,
        "phase": "scenario",
        "identity": "cyber-ai-fabric-invocation",
        "requirement": "Execute the Cyber AI-produced manifest step in exact order.",
    },
    {
        "order": 12,
        "phase": "scenario",
        "identity": "fabric-policy-admission",
        "requirement": "Execute the Tool Fabric-produced manifest step in exact order.",
    },
    {
        "order": 13,
        "phase": "scenario",
        "identity": "fabric-bounded-execution",
        "requirement": "Execute the Tool Fabric-produced manifest step in exact order.",
    },
    {
        "order": 14,
        "phase": "scenario",
        "identity": "fabric-runtime-receipt-production",
        "requirement": "Execute the Tool Fabric-produced manifest step in exact order.",
    },
    {
        "order": 15,
        "phase": "scenario",
        "identity": "suite-terminal-evidence",
        "requirement": "Execute the Suite-produced manifest step in exact order.",
    },
    {
        "order": 16,
        "phase": "terminal",
        "identity": "execute-negative-case-inventory",
        "requirement": (
            "Execute N1-N10 plus every admitted Tool Fabric negative case and "
            "retain the fail-closed results."
        ),
    },
    {
        "order": 17,
        "phase": "terminal",
        "identity": "capture-rollback-evidence",
        "requirement": (
            "Execute the admitted rollback lifecycle step and capture its "
            "terminal receipt."
        ),
    },
    {
        "order": 18,
        "phase": "terminal",
        "identity": "verify-no-residual-state",
        "requirement": (
            "Prove no container, listener, ephemeral PKI, repository or "
            "restricted-material residual remains."
        ),
    },
    {
        "order": 19,
        "phase": "terminal",
        "identity": "admit-tool-fabric-runtime-receipt",
        "requirement": (
            "Independently review and digest-pin an accepted bound receipt "
            "emitted by the Fabric-owned runtime path. No synthetic artifact "
            "and no status edit stands in for it."
        ),
    },
)

# The frozen pre-Founder admission-rehearsal contract. Steps are an exact ordered
# partition of FROZEN_BLOCKERS: every blocker is cleared by exactly one step,
# and the terminal step is admission of an accepted bound runtime receipt, so
# READY is structurally unreachable before that receipt exists.
EXECUTION_PLAN_VERSION: Final = "CYBRIK-D2-PREFOUNDER-EXECUTION-PLAN/v1"
_PLAN_STEP_FIELDS: Final = ("action", "clears", "instruction", "step")
_PLAN_ACTION: Final = re.compile(r"^[a-z][a-z0-9_]*$")
EXECUTION_PLAN: Final[tuple[dict[str, object], ...]] = (
    {
        "step": 1,
        "action": "pin_three_product_identities",
        "clears": (
            "product_head_not_detached",
            "product_identity_mismatch",
            "product_worktree_not_clean",
        ),
        "instruction": (
            "Check out cybrik-soc-command-center, cybrik-security-tool-fabric "
            "and cybrik-cyber-ai-platform at their pinned commit and tree "
            "identities, each with a detached HEAD and a clean worktree, and "
            "record the read-only observations."
        ),
    },
    {
        "step": 2,
        "action": "verify_product_source_roots",
        "clears": ("product_source_root_absent",),
        "instruction": (
            "Confirm every product declares at least one reviewed, admitted "
            "source root at its pinned path and symbol. Tool Fabric declares "
            "no emittable runtime receipt producer today; its current R0 "
            "domain boundary is recorded separately as a limitation."
        ),
    },
    {
        "step": 3,
        "action": "verify_docker_engine",
        "clears": ("docker_cli_absent", "docker_daemon_not_running"),
        "instruction": (
            "Confirm by read-only observation that the Docker CLI is present "
            "and the daemon is running; do not start, install or repair "
            "anything from this scenario."
        ),
    },
    {
        "step": 4,
        "action": "verify_pinned_postgres_image",
        "clears": ("docker_image_missing",),
        "instruction": (
            "Confirm the digest-pinned PostgreSQL image is already present "
            "locally; pulling images is outside this scenario's authority."
        ),
    },
    {
        "step": 5,
        "action": "verify_loopback_binds_free",
        "clears": ("loopback_bind_occupied",),
        "instruction": (
            "Confirm loopback binds 127.0.0.1:55432 and 127.0.0.1:58443 are "
            "free by read-only observation; no socket is opened here."
        ),
    },
    {
        "step": 6,
        "action": "wire_product_owned_runtime_surfaces",
        "clears": ("runtime_wiring_absent",),
        "instruction": (
            "Wire and independently review each product-owned runtime surface: "
            "the SOC client process, Cyber AI mTLS listener and PostgreSQL "
            "replay, and the Fabric-owned invocation and receipt path."
        ),
    },
    {
        "step": 7,
        "action": "implement_fabric_owned_runtime_producer",
        "clears": ("tool_fabric_runtime_producer_absent",),
        "instruction": (
            "Implement and independently review invocation, policy, execution "
            "and bound-receipt production inside cybrik-security-tool-fabric. "
            "Suite supplies only the contract and integration harness."
        ),
    },
    {
        "step": 8,
        "action": "implement_cross_product_integrated_path",
        "clears": ("integrated_step_not_implemented",),
        "instruction": (
            "Implement and independently review every declared SOC, Cyber AI "
            "and Tool Fabric scenario step before any runtime attempt."
        ),
    },
    {
        "step": 9,
        "action": "author_tool_fabric_negative_coverage",
        "clears": ("tool_fabric_negative_gap_open",),
        "instruction": (
            "Author and review fail-closed negative coverage for Tool Fabric "
            "delegation, policy, execution and receipt boundaries."
        ),
    },
    {
        "step": 10,
        "action": "execute_integrated_rehearsal_steps",
        "clears": ("integrated_step_not_run", "runner_command_contract_not_run"),
        "instruction": (
            "Execute the frozen runner command contract once, in its exact "
            "order, and retain exact step outcomes without promoting "
            "rehearsal evidence."
        ),
    },
    {
        "step": 11,
        "action": "execute_negative_case_inventory",
        "clears": ("negative_case_not_run",),
        "instruction": (
            "Execute N1-N10 and every admitted Tool Fabric negative case and "
            "retain the fail-closed results."
        ),
    },
    {
        "step": 12,
        "action": "capture_rollback_and_no_residual_evidence",
        "clears": ("terminal_evidence_not_captured",),
        "instruction": (
            "Capture rollback plus container, listener, PKI, repository and "
            "restricted-material no-residual evidence."
        ),
    },
    {
        "step": 13,
        "action": "admit_real_tool_fabric_runtime_receipt",
        "clears": ("tool_fabric_runtime_receipt_absent",),
        "instruction": (
            "Require the Fabric-owned runtime path to emit an accepted bound "
            "receipt, then independently review and digest-pin its exact bytes. "
            "No synthetic observation can clear this distinct terminal gate."
        ),
    },
)

TOOL_FABRIC_RECEIPT_REL: Final = Path(
    "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/"
    "evidence/05-tool-fabric-runtime-receipt.json"
)
# No Tool Fabric runtime receipt has been produced, reviewed or admitted. While
# this stays None the receipt blocker cannot be cleared by any observation.
ADMITTED_TOOL_FABRIC_RECEIPT_SHA256: Final[str | None] = None

# ---------------------------------------------------------------------------
# Synthetic Tool Fabric attestation contract (rehearsal dimension only)
# ---------------------------------------------------------------------------

PREFOUNDER_REHEARSAL_VERSION: Final = "CYBRIK-D2-PREFOUNDER-REHEARSAL/v1"
FABRIC_ATTESTATION_SCHEMA_VERSION: Final = "CYBRIK-D2-PREFOUNDER-FABRIC-ATTESTATION/v1"
FABRIC_ATTESTATION_ARTIFACT_CLASS: Final = "synthetic_read_only_attestation"
FABRIC_ATTESTATION_PRODUCER: Final = "cybrik-security-tool-fabric"
FABRIC_ATTESTATION_ENVIRONMENT: Final = "UAT"
# The Fabric UAT lane's local, non-contract, self-describing schema tag. It is
# quoted here so a drifted or renamed producer artifact fails closed rather than
# being read as this Suite's rehearsal evidence. Source of the tag:
# cybrik-security-tool-fabric:src/control-plane/cybrik_fabric_control/
# invocation/receipt.py ATTESTATION_SCHEMA_TAG.
FABRIC_ATTESTATION_SCHEMA_TAG: Final = (
    "cybrik-fabric.local-uat-only.readonly-attestation@0.0.0-synthetic"
)
# Claim pins checked by identity, never by truthiness: a truthy stand-in is not
# an assertion. The two false pins the Suite adds beyond the Fabric lane's own
# set -- ``is_runtime_receipt`` and ``runtime_executed`` -- are what keep this
# artifact from ever being mistaken for the terminal TR-6 runtime receipt.
FABRIC_ATTESTATION_TRUE_CLAIMS: Final = ("read_only", "synthetic")
FABRIC_ATTESTATION_FALSE_CLAIMS: Final = (
    "execution_authority",
    "is_runtime_receipt",
    "runtime_executed",
    "side_effect_performed",
)
_FABRIC_CLAIM_FIELDS: Final = tuple(
    sorted(FABRIC_ATTESTATION_TRUE_CLAIMS + FABRIC_ATTESTATION_FALSE_CLAIMS)
)
_FABRIC_ATTESTATION_FIELDS: Final = (
    "artifact_class",
    "claims",
    "claims_digest",
    "environment",
    "evidence_class",
    "producer",
    "schema_tag",
    "schema_version",
)

USAGE: Final = (
    "usage: prefounder_uat_scenario.py --suite-root ABSOLUTE "
    "--observations ABSOLUTE --report-json ABSOLUTE [--mode assess]\n"
    "optional synthetic rehearsal evidence: --fabric-attestation ABSOLUTE "
    "--fabric-attestation-sha256 HEX64\n"
    "both or neither; the artifact must be outside the Suite checkout; a "
    "synthetic attestation is never runtime evidence and never changes the "
    "frozen verdict\n"
    "execute mode is not authored and always fails closed"
)
REQUIRED_FLAGS: Final = ("--observations", "--report-json", "--suite-root")
OPTIONAL_FLAGS: Final = (
    "--fabric-attestation",
    "--fabric-attestation-sha256",
    "--mode",
)
FABRIC_ATTESTATION_FLAGS: Final = (
    "--fabric-attestation",
    "--fabric-attestation-sha256",
)
ASSESS_MODE: Final = "assess"
EXECUTE_MODE: Final = "execute"

_HEX40: Final = re.compile(r"^[0-9a-f]{40}$")
_HEX64: Final = re.compile(r"^[0-9a-f]{64}$")
_TIMESTAMP: Final = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
_PRODUCT_FIELDS: Final = ("commit", "head_detached", "tree", "worktree_clean")
_DOCKER_FIELDS: Final = (
    "binds_free",
    "cli_present",
    "daemon_running",
    "images_present",
)
_TOP_FIELDS: Final = (
    "docker",
    "observed_at",
    "products",
    "schema_version",
    "tool_fabric_runtime_receipt",
)


class ScenarioFailure(Exception):
    """A stable fail-closed reason that carries no caller-controlled text."""


def _fail(reason: str) -> None:
    if reason not in FROZEN_FAILURE_REASONS:
        raise ScenarioFailure("vocabulary_violation")
    raise ScenarioFailure(reason)


def _blocker(code: str) -> str:
    if code not in FROZEN_BLOCKERS:
        _fail("vocabulary_violation")
    return code


def _rehearsal_blocker(code: str) -> str:
    if code not in REHEARSAL_BLOCKERS:
        _fail("vocabulary_violation")
    return code


# ---------------------------------------------------------------------------
# Bounded, no-follow, identity-stable exact-byte reading
# ---------------------------------------------------------------------------


def _identity(info: os.stat_result) -> tuple[int, ...]:
    return (
        info.st_dev,
        info.st_ino,
        info.st_size,
        info.st_mtime_ns,
        info.st_ctime_ns,
    )


def _read_exact_bytes(
    path: Path, *, limit: int, reason: str, too_large_reason: str | None = None
) -> bytes:
    """Read one regular file's exact bytes, or fail closed with ``reason``.

    The descriptor is opened no-follow, so a symlinked final component is never
    traversed. It must name a single-linked, non-empty regular file within
    ``limit``, and its ``fstat`` identity must be unchanged across the read, so
    a file replaced, extended or truncated underneath the reader fails closed
    rather than yielding bytes that were never atomically present.
    """
    descriptor = -1
    try:
        descriptor = os.open(
            path,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
        )
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_nlink != 1
            or before.st_size <= 0
        ):
            _fail(reason)
        if before.st_size > limit:
            _fail(too_large_reason or reason)
        chunks: list[bytes] = []
        remaining = limit + 1
        while remaining > 0:
            chunk = os.read(descriptor, min(64 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        payload = b"".join(chunks)
        after = os.fstat(descriptor)
    except OSError:
        _fail(reason)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
    if (
        len(payload) != before.st_size
        or len(payload) > limit
        or _identity(before) != _identity(after)
    ):
        _fail(reason)
    return payload


# ---------------------------------------------------------------------------
# Safe observations preflight
# ---------------------------------------------------------------------------


def _pairs_without_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            _fail("observations_json_invalid")
        result[key] = value
    return result


def _reject_nonfinite(_: str) -> object:
    _fail("observations_json_invalid")
    return None


def _load_observations(path: Path) -> dict[str, object]:
    try:
        payload = _read_exact_bytes(
            path,
            limit=MAX_OBSERVATIONS_BYTES,
            reason="observations_json_invalid",
            too_large_reason="observations_json_too_large",
        )
        loaded = json.loads(
            payload.decode("utf-8"),
            object_pairs_hook=_pairs_without_duplicates,
            parse_constant=_reject_nonfinite,
        )
    except (OSError, UnicodeError, ValueError, RecursionError):
        _fail("observations_json_invalid")
    if not isinstance(loaded, dict):
        _fail("observations_json_invalid")
        return {}
    return loaded


def _mapping(value: object, keys: tuple[str, ...]) -> dict[str, object]:
    if not isinstance(value, dict) or tuple(sorted(value)) != keys:
        _fail("observations_schema_invalid")
        return {}
    return value


def _boolean(value: object) -> bool:
    if type(value) is not bool:
        _fail("observations_schema_invalid")
    return bool(value)


def _digest(value: object) -> str:
    if not isinstance(value, str) or not _HEX40.match(value):
        _fail("observations_schema_invalid")
        return ""
    return value


def _validate(observations: dict[str, object]) -> dict[str, object]:
    document = _mapping(observations, _TOP_FIELDS)
    if document["schema_version"] != OBSERVATIONS_SCHEMA_VERSION:
        _fail("observations_schema_version_mismatch")
    stamp = document["observed_at"]
    if not isinstance(stamp, str) or not _TIMESTAMP.match(stamp):
        _fail("observations_schema_invalid")

    products = _mapping(document["products"], tuple(sorted(PINNED_PRODUCTS)))
    for name in products:
        product = _mapping(products[name], _PRODUCT_FIELDS)
        _digest(product["commit"])
        _digest(product["tree"])
        _boolean(product["head_detached"])
        _boolean(product["worktree_clean"])

    docker = _mapping(document["docker"], _DOCKER_FIELDS)
    _boolean(docker["cli_present"])
    _boolean(docker["daemon_running"])
    images = docker["images_present"]
    if not isinstance(images, list) or not all(
        isinstance(image, str) for image in images
    ):
        _fail("observations_schema_invalid")
    binds = _mapping(docker["binds_free"], PROSPECTIVE_BINDS)
    for bind in binds:
        _boolean(binds[bind])

    receipt = _mapping(document["tool_fabric_runtime_receipt"], ("claimed_present",))
    _boolean(receipt["claimed_present"])
    return document


# ---------------------------------------------------------------------------
# Integrated rehearsal manifest
# ---------------------------------------------------------------------------


def _load_integrated_scenario() -> dict[str, object]:
    payload = _read_exact_bytes(
        INTEGRATED_SCENARIO_MANIFEST_PATH,
        limit=MAX_MANIFEST_BYTES,
        reason="integrated_scenario_manifest_digest_mismatch",
    )
    if hashlib.sha256(payload).hexdigest() != INTEGRATED_SCENARIO_MANIFEST_SHA256:
        _fail("integrated_scenario_manifest_digest_mismatch")
    try:
        loaded = json.loads(
            payload.decode("utf-8"),
            object_pairs_hook=_pairs_without_duplicates,
            parse_constant=_reject_nonfinite,
        )
    except (UnicodeError, ValueError, RecursionError, ScenarioFailure):
        _fail("integrated_scenario_invalid")
    if not isinstance(loaded, dict):
        _fail("integrated_scenario_invalid")
    canonical = (json.dumps(loaded, sort_keys=True, indent=2) + "\n").encode("utf-8")
    if payload != canonical:
        _fail("integrated_scenario_invalid")
    return _validate_integrated_scenario(loaded)


def _manifest_mapping(value: object, keys: tuple[str, ...]) -> dict[str, object]:
    if not isinstance(value, dict) or tuple(sorted(value)) != keys:
        _fail("integrated_scenario_invalid")
    return value


def _manifest_text(value: object) -> str:
    if not isinstance(value, str) or not value or value.strip() != value:
        _fail("integrated_scenario_invalid")
    return value


def _validate_tool_fabric_runtime(value: object) -> dict[str, object]:
    """Validate the frozen, product-owned runtime limitation statement.

    This v2 contract accepts only the current truthful state. A status edit is
    not implementation evidence and requires a future reviewed schema revision,
    not a locally re-pinned rehearsal manifest.
    """
    runtime = _manifest_mapping(value, _TOOL_FABRIC_RUNTIME_FIELDS)
    responsibility = _manifest_mapping(
        runtime["responsibility"], _TOOL_FABRIC_RESPONSIBILITY_FIELDS
    )
    if any(owner != TOOL_FABRIC_REPOSITORY for owner in responsibility.values()):
        _fail("integrated_scenario_invalid")
    if (
        runtime["current_invocation_boundary"]
        != "in_process_R0AlertContextInvocationService.invoke"
        or runtime["current_receipt_form"] != "unsigned_ReceiptPlan"
        or runtime["receipt_signature_envelope"] != "proposed_not_implemented"
        or runtime["runtime_wiring_status"] != TOOL_FABRIC_RUNTIME_WIRING_STATUS
        or runtime["runtime_receipt_producer_status"]
        != TOOL_FABRIC_RUNTIME_PRODUCER_STATUS
    ):
        _fail("integrated_scenario_invalid")
    return runtime


def _validate_products(
    products: object, surfaces_by_producer: dict[str, list[str]]
) -> list[dict[str, object]]:
    """Admit the three-product role, surface, seam and wiring declarations.

    The declared surfaces must be exactly the surfaces that product produces in
    the same manifest, so the two halves of the document cannot drift apart.
    Product source roots remain evidence declarations; they never transfer
    runtime ownership into Suite and never clear the Fabric producer gate.
    """
    expected = [name for name in PRODUCT_FLOW if name in PRODUCT_ROLES]
    if not isinstance(products, list) or len(products) != len(expected):
        _fail("integrated_scenario_invalid")
        return []
    validated: list[dict[str, object]] = []
    wiring_identities: set[str] = set()
    seam_identities: set[str] = set()
    for repository, raw_product in zip(expected, products, strict=True):
        product = _manifest_mapping(raw_product, _PRODUCT_ENTRY_FIELDS)
        surfaces = product["surfaces"]
        if (
            product["repository"] != repository
            or product["role"] != PRODUCT_ROLES[repository]
            or not isinstance(surfaces, list)
            or surfaces != surfaces_by_producer.get(repository, [])
        ):
            _fail("integrated_scenario_invalid")

        roots = product["admitted_source_roots"]
        if not isinstance(roots, list):
            _fail("integrated_scenario_invalid")
            return []
        for raw_root in roots:
            root = _manifest_mapping(raw_root, _SOURCE_ROOT_FIELDS)
            identity = _manifest_text(root["identity"])
            path = _manifest_text(root["path"])
            _manifest_text(root["symbol"])
            if (
                not _KEBAB.match(identity)
                or identity in seam_identities
                or not _SOURCE_ROOT_PATH.match(path)
                or ".." in path.split("/")
            ):
                _fail("integrated_scenario_invalid")
            seam_identities.add(identity)

        wiring_entries = product["runtime_wiring"]
        if not isinstance(wiring_entries, list) or not wiring_entries:
            _fail("integrated_scenario_invalid")
            return []
        for raw_wiring in wiring_entries:
            wiring = _manifest_mapping(raw_wiring, _RUNTIME_WIRING_FIELDS)
            identity = _manifest_text(wiring["identity"])
            _manifest_text(wiring["requirement"])
            if (
                not _KEBAB.match(identity)
                or identity in wiring_identities
                or wiring["status"] not in RUNTIME_WIRING_STATUSES
            ):
                _fail("integrated_scenario_invalid")
            wiring_identities.add(identity)
        validated.append(product)
    return validated


def _validate_integrated_scenario(document: dict[str, object]) -> dict[str, object]:
    manifest = _manifest_mapping(
        document,
        (
            "evidence_class",
            "negative_cases",
            "products",
            "schema_version",
            "steps",
            "terminal_evidence",
            "tool_fabric_runtime",
        ),
    )
    if (
        manifest["schema_version"] != INTEGRATED_SCENARIO_SCHEMA_VERSION
        or manifest["evidence_class"] != EVIDENCE_CLASS
    ):
        _fail("integrated_scenario_invalid")

    _validate_tool_fabric_runtime(manifest["tool_fabric_runtime"])

    steps = manifest["steps"]
    if not isinstance(steps, list) or not steps:
        _fail("integrated_scenario_invalid")
    order = {name: index for index, name in enumerate(PRODUCT_FLOW)}
    identities: set[str] = set()
    producer_ordinals: list[int] = []
    validated_steps: dict[int, dict[str, object]] = {}
    for index, raw_step in enumerate(steps, start=1):
        step = _manifest_mapping(
            raw_step,
            (
                "consumer",
                "identity",
                "producer",
                "purpose",
                "status",
                "step",
                "surface",
            ),
        )
        producer = step["producer"]
        consumer = step["consumer"]
        identity = _manifest_text(step["identity"])
        _manifest_text(step["purpose"])
        if (
            type(step["step"]) is not int
            or step["step"] != index
            or producer not in order
            or consumer not in order
            or order[str(consumer)] < order[str(producer)]
            or step["surface"] not in SCENARIO_SURFACES
            or step["status"] not in STEP_STATUSES
            or not re.fullmatch(r"[a-z][a-z0-9-]*", identity)
            or identity in identities
        ):
            _fail("integrated_scenario_invalid")
        identities.add(identity)
        producer_ordinals.append(order[str(producer)])
        validated_steps[index] = step
    if (
        producer_ordinals != sorted(producer_ordinals)
        or steps[0]["producer"] != PRODUCT_FLOW[0]
        or steps[-1]["producer"] != PRODUCT_FLOW[-1]
        or {step["producer"] for step in validated_steps.values()} != set(PRODUCT_FLOW)
    ):
        _fail("integrated_scenario_invalid")

    surfaces_by_producer = {
        name: sorted(
            {
                str(step["surface"])
                for step in validated_steps.values()
                if step["producer"] == name
            }
        )
        for name in PRODUCT_ROLES
    }
    _validate_products(manifest["products"], surfaces_by_producer)

    cases = manifest["negative_cases"]
    if not isinstance(cases, list) or not cases:
        _fail("integrated_scenario_invalid")
    expected_n = dict(REQUIRED_NEGATIVE_CASE_PURPOSES)
    seen_cases: set[str] = set()
    n_order: list[str] = []
    fabric_cases = 0
    for raw_case in cases:
        case = _manifest_mapping(
            raw_case, ("case_id", "purpose", "reason", "status", "step")
        )
        case_id = _manifest_text(case["case_id"])
        purpose = _manifest_text(case["purpose"])
        _manifest_text(case["reason"])
        step_number = case["step"]
        if (
            case_id in seen_cases
            or type(step_number) is not int
            or step_number not in validated_steps
            or case["status"] not in NEGATIVE_CASE_STATUSES
        ):
            _fail("integrated_scenario_invalid")
        seen_cases.add(case_id)
        if case_id in expected_n:
            n_order.append(case_id)
            if purpose != expected_n[case_id] or case["status"] not in {
                "authored_not_run",
                "executed_failed_closed",
            }:
                _fail("integrated_scenario_invalid")
        elif case_id.startswith("F") and case_id[1:].isdigit():
            fabric_cases += 1
            linked_step = validated_steps[int(step_number)]
            if "cybrik-security-tool-fabric" not in (
                linked_step["producer"],
                linked_step["consumer"],
            ) or case["status"] not in {"not_implemented", "executed_failed_closed"}:
                _fail("integrated_scenario_invalid")
        else:
            _fail("integrated_scenario_invalid")
    if n_order != list(expected_n) or fabric_cases == 0:
        _fail("integrated_scenario_invalid")

    terminal = manifest["terminal_evidence"]
    if not isinstance(terminal, list) or len(terminal) != len(TERMINAL_EVIDENCE_CHECKS):
        _fail("integrated_scenario_invalid")
    for expected, raw_check in zip(TERMINAL_EVIDENCE_CHECKS, terminal, strict=True):
        check = _manifest_mapping(raw_check, ("check", "requirement", "status"))
        _manifest_text(check["requirement"])
        if (
            check["check"] != expected
            or check["status"] not in TERMINAL_EVIDENCE_STATUSES
        ):
            _fail("integrated_scenario_invalid")
    return manifest


def _integrated_facts(
    manifest: dict[str, object],
) -> tuple[dict[str, object], set[str]]:
    steps = manifest["steps"]
    cases = manifest["negative_cases"]
    terminal = manifest["terminal_evidence"]
    products = manifest["products"]
    fabric_runtime = manifest["tool_fabric_runtime"]
    assert isinstance(steps, list)
    assert isinstance(cases, list)
    assert isinstance(terminal, list)
    assert isinstance(products, list)
    assert isinstance(fabric_runtime, dict)

    case_ids_by_step: dict[int, list[str]] = {int(step["step"]): [] for step in steps}
    for case in cases:
        case_ids_by_step[int(case["step"])].append(str(case["case_id"]))
    reported_steps = [
        {**step, "case_ids": sorted(case_ids_by_step[int(step["step"])])}
        for step in steps
    ]
    negative_by_status = {
        status: [case["case_id"] for case in cases if case["status"] == status]
        for status in NEGATIVE_CASE_STATUSES
    }
    terminal_by_status = {
        status: [check["check"] for check in terminal if check["status"] == status]
        for status in TERMINAL_EVIDENCE_STATUSES
    }
    reported_products = [
        {
            "admitted_source_roots": [
                str(root["identity"]) for root in product["admitted_source_roots"]
            ],
            "repository": product["repository"],
            "role": product["role"],
            "surfaces": product["surfaces"],
            "wiring_not_wired": [
                str(wiring["identity"])
                for wiring in product["runtime_wiring"]
                if wiring["status"] != "wired_and_run"
            ],
        }
        for product in products
    ]

    blockers: set[str] = set()
    if any(not product["admitted_source_roots"] for product in reported_products):
        blockers.add(_blocker("product_source_root_absent"))
    if any(product["wiring_not_wired"] for product in reported_products):
        blockers.add(_blocker("runtime_wiring_absent"))
    if (
        fabric_runtime["runtime_wiring_status"] != "wired_and_run"
        or fabric_runtime["runtime_receipt_producer_status"] != "implemented_and_run"
    ):
        blockers.add(_blocker("tool_fabric_runtime_producer_absent"))
    if any(step["status"] == "not_implemented" for step in steps):
        blockers.add(_blocker("integrated_step_not_implemented"))
    if any(step["status"] == "authored_not_run" for step in steps):
        blockers.add(_blocker("integrated_step_not_run"))
    if any(
        str(case["case_id"]).startswith("N") and case["status"] == "authored_not_run"
        for case in cases
    ):
        blockers.add(_blocker("negative_case_not_run"))
    if any(
        str(case["case_id"]).startswith("F") and case["status"] == "not_implemented"
        for case in cases
    ):
        blockers.add(_blocker("tool_fabric_negative_gap_open"))
    if any(check["status"] == "not_captured" for check in terminal):
        blockers.add(_blocker("terminal_evidence_not_captured"))

    facts = {
        "evidence_class": EVIDENCE_CLASS,
        "manifest_sha256": INTEGRATED_SCENARIO_MANIFEST_SHA256,
        "manifest_version": INTEGRATED_SCENARIO_SCHEMA_VERSION,
        "negative_cases": negative_by_status,
        "product_flow": list(PRODUCT_FLOW),
        "products": reported_products,
        "steps": reported_steps,
        "steps_authored_not_run": [
            step["step"] for step in steps if step["status"] == "authored_not_run"
        ],
        "steps_not_implemented": [
            step["step"] for step in steps if step["status"] == "not_implemented"
        ],
        "terminal_evidence": terminal_by_status,
        "tool_fabric_negative_gap": negative_by_status["not_implemented"],
        "tool_fabric_runtime": {
            **fabric_runtime,
            "responsibility": dict(fabric_runtime["responsibility"]),
        },
    }
    return facts, blockers


# ---------------------------------------------------------------------------
# Execution-plan contract
# ---------------------------------------------------------------------------


def _validated_execution_plan() -> tuple[dict[str, object], ...]:
    plan = EXECUTION_PLAN
    if not isinstance(plan, tuple) or not plan:
        _fail("execution_plan_invalid")
    covered: list[str] = []
    actions: set[str] = set()
    for index, step in enumerate(plan):
        if not isinstance(step, dict) or tuple(sorted(step)) != _PLAN_STEP_FIELDS:
            _fail("execution_plan_invalid")
        if type(step["step"]) is not int or step["step"] != index + 1:
            _fail("execution_plan_invalid")
        action = step["action"]
        instruction = step["instruction"]
        if (
            not isinstance(action, str)
            or not _PLAN_ACTION.match(action)
            or action in actions
            or not isinstance(instruction, str)
            or not instruction
        ):
            _fail("execution_plan_invalid")
        actions.add(action)
        clears = step["clears"]
        if (
            not isinstance(clears, tuple)
            or not clears
            or list(clears) != sorted(set(clears))
            or not set(clears) <= set(FROZEN_BLOCKERS)
            or set(clears) & set(covered)
        ):
            _fail("execution_plan_invalid")
        covered.extend(clears)
    if set(covered) != set(FROZEN_BLOCKERS):
        _fail("execution_plan_invalid")
    if plan[-1]["clears"] != ("tool_fabric_runtime_receipt_absent",):
        _fail("execution_plan_invalid")
    return plan


def _plan_progress(
    plan: tuple[dict[str, object], ...], blockers: set[str]
) -> dict[str, object]:
    steps: list[dict[str, object]] = []
    next_step: int | None = None
    for step in plan:
        clears = step["clears"]
        assert isinstance(clears, tuple)
        blocked_by = sorted(set(clears) & blockers)
        if blocked_by and next_step is None:
            next_step = int(step["step"])  # type: ignore[arg-type]
        steps.append(
            {
                "action": step["action"],
                "blocked_by": blocked_by,
                "clears": list(clears),
                "instruction": step["instruction"],
                "satisfied": not blocked_by,
                "step": step["step"],
            }
        )
    return {
        "next_step": next_step,
        "plan_version": EXECUTION_PLAN_VERSION,
        "steps": steps,
    }


# ---------------------------------------------------------------------------
# Assessment
# ---------------------------------------------------------------------------


def _product_facts(products: dict[str, object]) -> dict[str, dict[str, bool]]:
    facts: dict[str, dict[str, bool]] = {}
    for name, pinned in PINNED_PRODUCTS.items():
        observed = products[name]
        assert isinstance(observed, dict)
        facts[name] = {
            "head_detached": bool(observed["head_detached"]),
            "identity_matches": (observed["commit"], observed["tree"]) == pinned,
            "worktree_clean": bool(observed["worktree_clean"]),
        }
    return facts


def _product_blockers(facts: dict[str, dict[str, bool]]) -> set[str]:
    blockers: set[str] = set()
    for product in facts.values():
        if not product["identity_matches"]:
            blockers.add(_blocker("product_identity_mismatch"))
        if not product["head_detached"]:
            blockers.add(_blocker("product_head_not_detached"))
        if not product["worktree_clean"]:
            blockers.add(_blocker("product_worktree_not_clean"))
    return blockers


def _docker_facts(docker: dict[str, object]) -> dict[str, object]:
    images = docker["images_present"]
    assert isinstance(images, list)
    binds = docker["binds_free"]
    assert isinstance(binds, dict)
    return {
        "cli_present": bool(docker["cli_present"]),
        "daemon_running": bool(docker["daemon_running"]),
        "missing_images": sorted(
            set(REQUIRED_IMAGE_REFERENCES) - {str(image) for image in images}
        ),
        "occupied_binds": sorted(bind for bind in binds if not binds[bind]),
    }


def _docker_blockers(facts: dict[str, object]) -> set[str]:
    blockers: set[str] = set()
    if not facts["cli_present"]:
        blockers.add(_blocker("docker_cli_absent"))
    if not facts["daemon_running"]:
        blockers.add(_blocker("docker_daemon_not_running"))
    if facts["missing_images"]:
        blockers.add(_blocker("docker_image_missing"))
    if facts["occupied_binds"]:
        blockers.add(_blocker("loopback_bind_occupied"))
    return blockers


def _artifact_facts(
    *,
    artifact_path: Path,
    admitted_digest: str | None,
    claimed_present: bool,
    limit: int,
    reasons: tuple[str, str, str, str],
) -> dict[str, bool]:
    """Bind one reviewed artifact gate to its exact bytes, or fail closed.

    ``reasons`` are, in order: the claim has no backing artifact, the tree
    contradicts an absence claim, no reviewed digest is admitted, and the exact
    bytes do not hash to the admitted digest. Presence alone never clears a
    gate, and an admitted digest alone never clears one either: the caller must
    also claim the artifact, and the tree must actually hold it.
    """
    unbacked, contradicts, not_admitted, mismatch = reasons
    present_in_tree = artifact_path.is_file() and not artifact_path.is_symlink()
    if claimed_present and not present_in_tree:
        _fail(unbacked)
    if not claimed_present and present_in_tree:
        _fail(contradicts)
    if claimed_present and admitted_digest is None:
        _fail(not_admitted)
    if claimed_present:
        payload = _read_exact_bytes(artifact_path, limit=limit, reason=mismatch)
        if hashlib.sha256(payload).hexdigest() != admitted_digest:
            _fail(mismatch)
    return {
        "admitted_digest_pinned": admitted_digest is not None,
        "claimed_present": claimed_present,
        "present_in_tree": present_in_tree,
    }


def _receipt_facts(*, suite_root: Path, claimed_present: bool) -> dict[str, bool]:
    return _artifact_facts(
        artifact_path=suite_root / TOOL_FABRIC_RECEIPT_REL,
        admitted_digest=ADMITTED_TOOL_FABRIC_RECEIPT_SHA256,
        claimed_present=claimed_present,
        limit=MAX_RUNTIME_RECEIPT_BYTES,
        reasons=(
            "tool_fabric_runtime_receipt_claim_unbacked",
            "observations_receipt_claim_contradicts_tree",
            "tool_fabric_runtime_receipt_not_admitted",
            "tool_fabric_runtime_receipt_digest_mismatch",
        ),
    )


# ---------------------------------------------------------------------------
# Frozen runner command contract
# ---------------------------------------------------------------------------


def _validated_runner_contract(
    step_identities: list[str],
) -> tuple[dict[str, object], ...]:
    """Admit the ordered runner contract and bind it to the authored script."""
    contract = RUNNER_COMMAND_CONTRACT
    if not isinstance(contract, tuple) or not contract:
        _fail("runner_command_contract_invalid")
    if RUNNER_EXECUTION_STATUS not in RUNNER_EXECUTION_STATUSES:
        _fail("runner_command_contract_invalid")
    identities: list[str] = []
    phase_ordinals: list[int] = []
    for index, command in enumerate(contract):
        if (
            not isinstance(command, dict)
            or tuple(sorted(command)) != _RUNNER_COMMAND_FIELDS
            or type(command["order"]) is not int
            or command["order"] != index + 1
            or command["phase"] not in RUNNER_PHASES
        ):
            _fail("runner_command_contract_invalid")
        identity = command["identity"]
        requirement = command["requirement"]
        if (
            not isinstance(identity, str)
            or not _KEBAB.match(identity)
            or identity in identities
            or not isinstance(requirement, str)
            or not requirement
        ):
            _fail("runner_command_contract_invalid")
        identities.append(identity)
        phase_ordinals.append(RUNNER_PHASES.index(str(command["phase"])))
    scenario_identities = [
        str(command["identity"])
        for command in contract
        if command["phase"] == RUNNER_PHASES[1]
    ]
    if (
        phase_ordinals != sorted(phase_ordinals)
        or set(phase_ordinals) != set(range(len(RUNNER_PHASES)))
        or scenario_identities != step_identities
        or identities[-1] != RUNNER_TERMINAL_COMMAND
    ):
        _fail("runner_command_contract_invalid")
    _bind_runner_script(identities)
    return contract


def _bind_runner_script(identities: list[str]) -> None:
    """The authored runner must hold every identity once, in contract order."""
    payload = _read_exact_bytes(
        RUNNER_SCRIPT_PATH,
        limit=MAX_RUNNER_SCRIPT_BYTES,
        reason="runner_command_contract_invalid",
    )
    if hashlib.sha256(payload).hexdigest() != RUNNER_SCRIPT_SHA256:
        _fail("runner_command_contract_invalid")
    try:
        text = payload.decode("utf-8")
    except UnicodeError:
        _fail("runner_command_contract_invalid")
        return
    positions: list[int] = []
    for identity in identities:
        if text.count(identity) != 1:
            _fail("runner_command_contract_invalid")
        positions.append(text.index(identity))
    if positions != sorted(positions):
        _fail("runner_command_contract_invalid")


def _runner_facts(
    contract: tuple[dict[str, object], ...],
) -> tuple[dict[str, object], set[str]]:
    executed = RUNNER_EXECUTION_STATUS == RUNNER_EXECUTION_STATUSES[1]
    facts = {
        "commands": [dict(command) for command in contract],
        "contract_version": RUNNER_CONTRACT_VERSION,
        "execution_status": RUNNER_EXECUTION_STATUS,
        "runner_sha256": RUNNER_SCRIPT_SHA256,
        "runtime_executed": executed,
    }
    blockers = set() if executed else {_blocker("runner_command_contract_not_run")}
    return facts, blockers


# ---------------------------------------------------------------------------
# Synthetic Tool Fabric attestation (rehearsal dimension only)
# ---------------------------------------------------------------------------


def _canonical_claims(claims: dict[str, object]) -> bytes:
    return json.dumps(claims, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _validate_fabric_attestation(payload: bytes) -> dict[str, bool]:
    """Admit only a self-consistent, correctly versioned synthetic artifact."""
    try:
        loaded = json.loads(
            payload.decode("utf-8"),
            object_pairs_hook=_pairs_without_duplicates,
            parse_constant=_reject_nonfinite,
        )
    except (UnicodeError, ValueError, RecursionError, ScenarioFailure):
        _fail("fabric_attestation_invalid")
    if (
        not isinstance(loaded, dict)
        or tuple(sorted(loaded)) != _FABRIC_ATTESTATION_FIELDS
    ):
        _fail("fabric_attestation_invalid")
        return {}
    if loaded["schema_version"] != FABRIC_ATTESTATION_SCHEMA_VERSION:
        _fail("fabric_attestation_schema_version_mismatch")
    if (
        loaded["artifact_class"] != FABRIC_ATTESTATION_ARTIFACT_CLASS
        or loaded["environment"] != FABRIC_ATTESTATION_ENVIRONMENT
        or loaded["evidence_class"] != EVIDENCE_CLASS
        or loaded["producer"] != FABRIC_ATTESTATION_PRODUCER
        or loaded["schema_tag"] != FABRIC_ATTESTATION_SCHEMA_TAG
    ):
        _fail("fabric_attestation_invalid")

    claims = loaded["claims"]
    claims_digest = loaded["claims_digest"]
    if (
        not isinstance(claims, dict)
        or tuple(sorted(claims)) != _FABRIC_CLAIM_FIELDS
        or not isinstance(claims_digest, str)
        or not _HEX64.match(claims_digest)
    ):
        _fail("fabric_attestation_invalid")
        return {}
    # Identity, not truthiness: ``1`` is not an assertion and ``[]`` is not a
    # denial, so a stand-in can never stand in for one of these pins.
    for name in FABRIC_ATTESTATION_TRUE_CLAIMS:
        if claims[name] is not True:
            _fail("fabric_attestation_claim_inconsistent")
    for name in FABRIC_ATTESTATION_FALSE_CLAIMS:
        if claims[name] is not False:
            _fail("fabric_attestation_claim_inconsistent")
    if hashlib.sha256(_canonical_claims(claims)).hexdigest() != claims_digest:
        _fail("fabric_attestation_claim_inconsistent")
    return {name: bool(claims[name]) for name in _FABRIC_CLAIM_FIELDS}


def _fabric_attestation_facts(
    admitted: tuple[Path, str] | None,
) -> tuple[dict[str, object], set[str]]:
    """Derive the rehearsal-dimension facts, or the one rehearsal blocker."""
    if admitted is None:
        facts: dict[str, object] = {
            "artifact_sha256": None,
            "attestation_admitted": False,
            "claims": None,
            "contract_version": FABRIC_ATTESTATION_SCHEMA_VERSION,
            "producer": FABRIC_ATTESTATION_PRODUCER,
            "schema_tag": FABRIC_ATTESTATION_SCHEMA_TAG,
        }
        return facts, {_rehearsal_blocker("fabric_synthetic_attestation_absent")}

    path, expected_sha256 = admitted
    payload = _read_exact_bytes(
        path,
        limit=MAX_FABRIC_ATTESTATION_BYTES,
        reason="fabric_attestation_invalid",
    )
    if hashlib.sha256(payload).hexdigest() != expected_sha256:
        _fail("fabric_attestation_digest_mismatch")
    return {
        "artifact_sha256": expected_sha256,
        "attestation_admitted": True,
        "claims": _validate_fabric_attestation(payload),
        "contract_version": FABRIC_ATTESTATION_SCHEMA_VERSION,
        "producer": FABRIC_ATTESTATION_PRODUCER,
        "schema_tag": FABRIC_ATTESTATION_SCHEMA_TAG,
    }, set()


def _prefounder_rehearsal(
    admitted: tuple[Path, str] | None,
) -> dict[str, object]:
    """The separate rehearsal dimension. It never reaches the frozen verdict."""
    facts, blockers = _fabric_attestation_facts(admitted)
    return {
        "blockers": sorted(blockers),
        "dimension_version": PREFOUNDER_REHEARSAL_VERSION,
        "fabric_attestation": facts,
        "grants_runtime_evidence": False,
        "is_runtime_receipt": False,
        "runtime_executed": False,
    }


def _artifact_admitted(facts: dict[str, bool]) -> bool:
    return (
        facts["admitted_digest_pinned"]
        and facts["claimed_present"]
        and facts["present_in_tree"]
    )


def assess(
    *,
    suite_root: Path,
    observations: dict[str, object],
    fabric_attestation: tuple[Path, str] | None = None,
) -> dict[str, object]:
    """Derive the frozen-vocabulary verdict for one observation document."""
    plan = _validated_execution_plan()
    document = _validate(observations)
    integrated_manifest = _load_integrated_scenario()
    manifest_steps = integrated_manifest["steps"]
    assert isinstance(manifest_steps, list)
    runner_contract = _validated_runner_contract(
        [str(step["identity"]) for step in manifest_steps]
    )
    products = document["products"]
    docker = document["docker"]
    receipt = document["tool_fabric_runtime_receipt"]
    assert isinstance(products, dict)
    assert isinstance(docker, dict)
    assert isinstance(receipt, dict)

    product_facts = _product_facts(products)
    docker_facts = _docker_facts(docker)
    receipt_facts = _receipt_facts(
        suite_root=suite_root, claimed_present=bool(receipt["claimed_present"])
    )
    integrated_facts, integrated_blockers = _integrated_facts(integrated_manifest)
    runner_facts, runner_blockers = _runner_facts(runner_contract)
    # Derived last and kept in its own dimension: the union below is over the
    # frozen blockers only, so synthetic evidence cannot reach status, the plan,
    # next_blocker, step 10, the receipt gate or the exit code.
    rehearsal = _prefounder_rehearsal(fabric_attestation)

    blockers = (
        _product_blockers(product_facts)
        | _docker_blockers(docker_facts)
        | integrated_blockers
        | runner_blockers
    )
    # An admitted digest alone never clears an artifact gate: the reviewed
    # artifact must also be claimed and actually present in the tree, where
    # _artifact_facts has already bound it byte-exactly to the admitted digest.
    if not _artifact_admitted(receipt_facts):
        blockers.add(_blocker("tool_fabric_runtime_receipt_absent"))

    status = FROZEN_STATUSES[1] if not blockers else FROZEN_STATUSES[0]
    runtime_launch_blockers = sorted(set(RUNTIME_LAUNCH_BLOCKERS) & blockers)
    plan_progress = _plan_progress(plan, blockers)
    next_blocker: str | None = None
    for step in plan_progress["steps"]:
        assert isinstance(step, dict)
        blocked_by = step["blocked_by"]
        assert isinstance(blocked_by, list)
        if blocked_by:
            next_blocker = str(blocked_by[0])
            break
    return {
        "blockers": sorted(blockers),
        "docker": docker_facts,
        "evidence_class": EVIDENCE_CLASS,
        "execution": {"authorized": False, "runtime_executed": False},
        "execution_plan": plan_progress,
        "integrated_scenario": integrated_facts,
        "mode": ASSESS_MODE,
        "next_blocker": next_blocker,
        "observed_at": document["observed_at"],
        "prefounder_rehearsal": rehearsal,
        "products": product_facts,
        "runner_contract": runner_facts,
        "runtime_launch": {
            "admitted": not runtime_launch_blockers,
            "blockers": runtime_launch_blockers,
        },
        "schema_version": SCHEMA_VERSION,
        "status": status,
        "tool_fabric_runtime_receipt": receipt_facts,
    }


# ---------------------------------------------------------------------------
# Command line
# ---------------------------------------------------------------------------


def _canonical(report: dict[str, object]) -> str:
    return json.dumps(report, sort_keys=True, separators=(",", ":"))


def _write_report(path: Path, report: dict[str, object]) -> None:
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(_canonical(report) + "\n")
    except OSError:
        _fail("report_json_write_failed")


def _absolute_directory(raw: str) -> Path:
    candidate = Path(raw)
    if not candidate.is_absolute():
        _fail("suite_root_invalid")
    try:
        resolved = candidate.resolve(strict=True)
    except OSError:
        _fail("suite_root_invalid")
        raise
    if not resolved.is_dir():
        _fail("suite_root_invalid")
    if resolved != BOUND_SUITE_ROOT:
        _fail("suite_root_identity_mismatch")
    return resolved


def _observations_path(raw: str) -> Path:
    candidate = Path(raw)
    segments = raw.split("/")
    if (
        not raw
        or not candidate.is_absolute()
        or "." in segments
        or ".." in segments
        or "" in segments[1:]
    ):
        _fail("observations_json_invalid")
    try:
        # Resolve only the parent. The final component is opened O_NOFOLLOW by
        # _read_exact_bytes, so a caller cannot smuggle a symlink through path
        # normalization before the descriptor-safety checks run.
        return candidate.parent.resolve(strict=True) / candidate.name
    except OSError:
        _fail("observations_json_invalid")
        raise


def _fabric_attestation_path(raw: str, *, suite_root: Path) -> Path:
    """An absolute, non-traversing literal path outside the Suite checkout.

    The raw segments are inspected rather than :attr:`Path.parts`, because
    pathlib silently normalises away a ``.`` segment before it can be refused.

    The artifact is external Tool Fabric UAT-lane evidence, so it is refused
    inside the Suite checkout both lexically and after resolving its parent --
    otherwise a directory link could place synthetic evidence in the tree that
    a later reader mistakes for reviewed Suite evidence. A final-component
    symlink still dies at the no-follow open, not here.
    """
    candidate = Path(raw)
    segments = raw.split("/")
    if (
        not raw
        or not candidate.is_absolute()
        or "." in segments
        or ".." in segments
        or "" in segments[1:]
    ):
        _fail("fabric_attestation_path_invalid")
    try:
        resolved = candidate.parent.resolve() / candidate.name
    except OSError:
        _fail("fabric_attestation_path_invalid")
        raise
    if candidate.is_relative_to(suite_root) or resolved.is_relative_to(suite_root):
        _fail("fabric_attestation_must_be_outside_suite")
    return candidate


def _fresh_report_path(raw: str, *, suite_root: Path) -> Path:
    candidate = Path(raw)
    if not candidate.is_absolute() or not candidate.parent.is_dir():
        _fail("report_json_write_failed")
    resolved = candidate.parent.resolve() / candidate.name
    if resolved.is_relative_to(suite_root):
        _fail("report_json_must_be_outside_suite")
    if resolved.exists():
        _fail("report_json_exists")
    return resolved


def _arguments(argv: list[str]) -> dict[str, str]:
    if argv == ["--help"]:
        print(USAGE)
        raise SystemExit(0)
    if len(argv) % 2 != 0:
        _fail("arguments_invalid")
    values: dict[str, str] = {}
    for index in range(0, len(argv), 2):
        key = argv[index]
        if key not in REQUIRED_FLAGS + OPTIONAL_FLAGS or key in values:
            _fail("arguments_invalid")
        values[key] = argv[index + 1]
    if not set(REQUIRED_FLAGS) <= set(values):
        _fail("arguments_invalid")
    if values.get("--mode", ASSESS_MODE) != ASSESS_MODE:
        _fail("arguments_invalid")
    # The artifact and its digest pin are one indivisible argument: an artifact
    # without a pin would be admitted on its own say-so.
    supplied = set(FABRIC_ATTESTATION_FLAGS) & set(values)
    if supplied and supplied != set(FABRIC_ATTESTATION_FLAGS):
        _fail("arguments_invalid")
    if supplied and not _HEX64.match(values["--fabric-attestation-sha256"]):
        _fail("arguments_invalid")
    return values


def _admitted_attestation(
    values: dict[str, str], *, suite_root: Path
) -> tuple[Path, str] | None:
    raw = values.get("--fabric-attestation")
    if raw is None:
        return None
    return (
        _fabric_attestation_path(raw, suite_root=suite_root),
        values["--fabric-attestation-sha256"],
    )


def _reject_execute_mode(argv: list[str]) -> None:
    for index, token in enumerate(argv):
        if token == "--mode" and argv[index + 1 : index + 2] == [EXECUTE_MODE]:
            _fail("execute_mode_not_authored")


def main(argv: list[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    try:
        # Execute mode is unauthored: refuse before reading any caller input.
        _reject_execute_mode(arguments)
        values = _arguments(arguments)
        suite_root = _absolute_directory(values["--suite-root"])
        report_path = _fresh_report_path(values["--report-json"], suite_root=suite_root)
        report = assess(
            suite_root=suite_root,
            observations=_load_observations(
                _observations_path(values["--observations"])
            ),
            fabric_attestation=_admitted_attestation(values, suite_root=suite_root),
        )
        _write_report(report_path, report)
    except ScenarioFailure as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(_canonical(report))
    return 0 if report["status"] == FROZEN_STATUSES[1] else 1


if __name__ == "__main__":
    raise SystemExit(main())
