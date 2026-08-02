"""Assess the pre-Founder SOC->AI lifecycle mTLS scenario from injected facts.

This module is pure stdlib and import-inert. It probes nothing: every Docker,
daemon, image, loopback-bind and repository fact is supplied by a caller-owned
observations JSON document. It starts no process, opens no socket, runs no
container, touches no repository state and grants no runtime authority.

The only reachable verdict today is ``HOLD``: no Tool Fabric runtime receipt
digest is admitted, so the receipt blocker cannot be cleared and ``READY`` is
structurally unreachable. Execute mode is deliberately not authored and fails
closed before reading any input.
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
BOUND_SUITE_ROOT: Path = Path(__file__).resolve().parents[4]

FROZEN_STATUSES: Final = ("HOLD", "READY")
FROZEN_BLOCKERS: Final = (
    "docker_cli_absent",
    "docker_daemon_not_running",
    "docker_image_missing",
    "loopback_bind_occupied",
    "product_head_not_detached",
    "product_identity_mismatch",
    "product_worktree_not_clean",
    "tool_fabric_runtime_receipt_absent",
)
FROZEN_FAILURE_REASONS: Final = (
    "arguments_invalid",
    "execute_mode_not_authored",
    "observations_json_invalid",
    "observations_json_too_large",
    "observations_receipt_claim_contradicts_tree",
    "observations_schema_invalid",
    "observations_schema_version_mismatch",
    "report_json_exists",
    "report_json_must_be_outside_suite",
    "report_json_write_failed",
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

TOOL_FABRIC_RECEIPT_REL: Final = Path(
    "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/"
    "evidence/05-tool-fabric-runtime-receipt.json"
)
# No Tool Fabric runtime receipt has been produced, reviewed or admitted. While
# this stays None the receipt blocker cannot be cleared by any observation.
ADMITTED_TOOL_FABRIC_RECEIPT_SHA256: Final[str | None] = None

USAGE: Final = (
    "usage: prefounder_uat_scenario.py --suite-root ABSOLUTE "
    "--observations ABSOLUTE --report-json ABSOLUTE [--mode assess]\n"
    "execute mode is not authored and always fails closed"
)
REQUIRED_FLAGS: Final = ("--observations", "--report-json", "--suite-root")
OPTIONAL_FLAGS: Final = ("--mode",)
ASSESS_MODE: Final = "assess"
EXECUTE_MODE: Final = "execute"

_HEX40: Final = re.compile(r"^[0-9a-f]{40}$")
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
        if path.stat().st_size > MAX_OBSERVATIONS_BYTES:
            _fail("observations_json_too_large")
        loaded = json.loads(
            path.read_text(encoding="utf-8"),
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


def _receipt_facts(*, suite_root: Path, claimed_present: bool) -> dict[str, bool]:
    receipt_path = suite_root / TOOL_FABRIC_RECEIPT_REL
    present_in_tree = receipt_path.is_file() and not receipt_path.is_symlink()
    if claimed_present and not present_in_tree:
        _fail("tool_fabric_runtime_receipt_claim_unbacked")
    if not claimed_present and present_in_tree:
        _fail("observations_receipt_claim_contradicts_tree")
    if claimed_present and ADMITTED_TOOL_FABRIC_RECEIPT_SHA256 is None:
        _fail("tool_fabric_runtime_receipt_not_admitted")
    if claimed_present:
        descriptor = -1
        try:
            descriptor = os.open(
                receipt_path,
                os.O_RDONLY
                | getattr(os, "O_NOFOLLOW", 0)
                | getattr(os, "O_CLOEXEC", 0),
            )
            before = os.fstat(descriptor)
            if (
                not stat.S_ISREG(before.st_mode)
                or before.st_nlink != 1
                or before.st_size <= 0
                or before.st_size > MAX_RUNTIME_RECEIPT_BYTES
            ):
                _fail("tool_fabric_runtime_receipt_digest_mismatch")
            chunks: list[bytes] = []
            remaining = MAX_RUNTIME_RECEIPT_BYTES + 1
            while remaining > 0:
                chunk = os.read(descriptor, min(64 * 1024, remaining))
                if not chunk:
                    break
                chunks.append(chunk)
                remaining -= len(chunk)
            payload = b"".join(chunks)
            after = os.fstat(descriptor)
        except OSError:
            _fail("tool_fabric_runtime_receipt_digest_mismatch")
        finally:
            if descriptor >= 0:
                os.close(descriptor)
        if (
            len(payload) != before.st_size
            or len(payload) > MAX_RUNTIME_RECEIPT_BYTES
            or (
                before.st_dev,
                before.st_ino,
                before.st_size,
                before.st_mtime_ns,
                before.st_ctime_ns,
            )
            != (
                after.st_dev,
                after.st_ino,
                after.st_size,
                after.st_mtime_ns,
                after.st_ctime_ns,
            )
            or hashlib.sha256(payload).hexdigest()
            != ADMITTED_TOOL_FABRIC_RECEIPT_SHA256
        ):
            _fail("tool_fabric_runtime_receipt_digest_mismatch")
    return {
        "admitted_digest_pinned": ADMITTED_TOOL_FABRIC_RECEIPT_SHA256 is not None,
        "claimed_present": claimed_present,
        "present_in_tree": present_in_tree,
    }


def assess(*, suite_root: Path, observations: dict[str, object]) -> dict[str, object]:
    """Derive the frozen-vocabulary verdict for one observation document."""
    document = _validate(observations)
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

    blockers = _product_blockers(product_facts) | _docker_blockers(docker_facts)
    if not receipt_facts["admitted_digest_pinned"]:
        blockers.add(_blocker("tool_fabric_runtime_receipt_absent"))

    status = FROZEN_STATUSES[1] if not blockers else FROZEN_STATUSES[0]
    return {
        "blockers": sorted(blockers),
        "docker": docker_facts,
        "execution": {"authorized": False, "runtime_executed": False},
        "mode": ASSESS_MODE,
        "observed_at": document["observed_at"],
        "products": product_facts,
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
    if not candidate.is_absolute():
        _fail("observations_json_invalid")
    try:
        return candidate.resolve(strict=True)
    except OSError:
        _fail("observations_json_invalid")
        raise


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
    return values


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
        )
        _write_report(report_path, report)
    except ScenarioFailure as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(_canonical(report))
    return 0 if report["status"] == FROZEN_STATUSES[1] else 1


if __name__ == "__main__":
    raise SystemExit(main())
