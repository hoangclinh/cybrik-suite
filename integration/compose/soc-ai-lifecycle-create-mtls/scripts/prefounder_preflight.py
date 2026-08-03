"""Collect read-only facts and run the dry pre-Founder UAT assessor.

This command is deliberately unable to start a product runtime.  Its sole
subprocess seam admits five frozen, read-only Git commands.  Docker, image and
bind facts remain operator-produced prerequisites; they are never probed here.
The existing assessor remains the only verdict authority and currently forces
``HOLD`` while the Tool Fabric runtime path and receipt gate are open.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import stat
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Final

PREREQUISITES_SCHEMA_VERSION: Final = "CYBRIK-D2-PREFOUNDER-PREREQUISITES/v1"
MAX_PREREQUISITES_BYTES: Final = 64 * 1024
BOUND_SUITE_ROOT: Path = Path(__file__).resolve().parents[4]
GIT_BINARY: Final = Path("/usr/bin/git")
_HEX40: Final = re.compile(r"^[0-9a-f]{40}$")
_OBSERVED_AT: Final = re.compile(
    r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$"
)
_PREREQUISITE_FIELDS: Final = (
    "docker",
    "observed_at",
    "schema_version",
    "tool_fabric_runtime_receipt",
)
_DOCKER_FIELDS: Final = (
    "binds_free",
    "cli_present",
    "daemon_running",
    "images_present",
)
_RECEIPT_FIELDS: Final = ("claimed_present",)

READ_ONLY_GIT_COMMANDS: Final = (
    ("rev-parse", "--show-toplevel"),
    ("rev-parse", "--verify", "HEAD^{commit}"),
    ("rev-parse", "--verify", "HEAD^{tree}"),
    ("symbolic-ref", "--quiet", "HEAD"),
    ("status", "--porcelain=v1", "--untracked-files=all"),
)

_FULL_FLAGS: Final = (
    "--cyber-ai-root",
    "--observations-json",
    "--prerequisites",
    "--report-json",
    "--soc-root",
    "--suite-root",
    "--tool-fabric-root",
)
_PRODUCT_FLAGS: Final = {
    "cybrik-cyber-ai-platform": "--cyber-ai-root",
    "cybrik-security-tool-fabric": "--tool-fabric-root",
    "cybrik-soc-command-center": "--soc-root",
}


class PreflightFailure(RuntimeError):
    """Stable, non-reflecting refusal from the preflight boundary."""


def _fail(reason: str) -> None:
    raise PreflightFailure(reason)


def _load_scenario() -> object:
    path = Path(__file__).with_name("prefounder_uat_scenario.py")
    spec = importlib.util.spec_from_file_location("cybrik_prefounder_scenario", path)
    if spec is None or spec.loader is None:
        _fail("scenario_import_failed")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


SCENARIO = _load_scenario()


def _existing_directory(raw: str | Path, *, reason: str) -> Path:
    candidate = Path(raw)
    if not candidate.is_absolute():
        _fail(reason)
    try:
        resolved = candidate.resolve(strict=True)
    except OSError:
        _fail(reason)
    if not resolved.is_dir():
        _fail(reason)
    return resolved


def _fresh_external_path(
    path: Path, *, suite_root: Path, other_roots: tuple[Path, ...] = ()
) -> Path:
    if not path.is_absolute() or path.name in ("", ".", ".."):
        _fail("output_path_invalid")
    try:
        parent = path.parent.resolve(strict=True)
    except OSError:
        _fail("output_path_invalid")
    resolved = parent / path.name
    if any(resolved.is_relative_to(root) for root in (suite_root, *other_roots)):
        _fail("output_must_be_external")
    if resolved.exists() or resolved.is_symlink():
        _fail("output_exists")
    return resolved


def _read_regular_file(path: Path, *, limit: int) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_nlink != 1
            or before.st_size < 1
            or before.st_size > limit
        ):
            _fail("prerequisites_invalid")
        chunks: list[bytes] = []
        remaining = limit + 1
        while remaining:
            chunk = os.read(descriptor, min(remaining, 8192))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        after = os.fstat(descriptor)
    except OSError:
        _fail("prerequisites_invalid")
    finally:
        if "descriptor" in locals():
            os.close(descriptor)
    if (
        before.st_dev,
        before.st_ino,
        before.st_size,
        before.st_ctime_ns,
        before.st_mtime_ns,
    ) != (
        after.st_dev,
        after.st_ino,
        after.st_size,
        after.st_ctime_ns,
        after.st_mtime_ns,
    ):
        _fail("prerequisites_invalid")
    payload = b"".join(chunks)
    if len(payload) != before.st_size or len(payload) > limit:
        _fail("prerequisites_invalid")
    return payload


def _strict_json(payload: bytes) -> object:
    def closed_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                _fail("prerequisites_invalid")
            result[key] = value
        return result

    try:
        if payload.startswith(b"\xef\xbb\xbf"):
            _fail("prerequisites_invalid")
        return json.loads(payload.decode("utf-8"), object_pairs_hook=closed_object)
    except (UnicodeError, json.JSONDecodeError):
        _fail("prerequisites_invalid")


def _load_prerequisites(path: Path) -> dict[str, object]:
    document = _strict_json(_read_regular_file(path, limit=MAX_PREREQUISITES_BYTES))
    if (
        not isinstance(document, dict)
        or tuple(sorted(document)) != _PREREQUISITE_FIELDS
    ):
        _fail("prerequisites_invalid")
    if (
        document["schema_version"] != PREREQUISITES_SCHEMA_VERSION
        or not isinstance(document["observed_at"], str)
        or _OBSERVED_AT.fullmatch(document["observed_at"]) is None
    ):
        _fail("prerequisites_invalid")

    docker = document["docker"]
    receipt = document["tool_fabric_runtime_receipt"]
    if (
        not isinstance(docker, dict)
        or tuple(sorted(docker)) != _DOCKER_FIELDS
        or type(docker["cli_present"]) is not bool
        or type(docker["daemon_running"]) is not bool
        or not isinstance(docker["images_present"], list)
        or any(
            not isinstance(item, str) or not item for item in docker["images_present"]
        )
        or len(set(docker["images_present"])) != len(docker["images_present"])
        or not isinstance(docker["binds_free"], dict)
        or tuple(sorted(docker["binds_free"])) != tuple(SCENARIO.PROSPECTIVE_BINDS)
        or any(type(value) is not bool for value in docker["binds_free"].values())
        or not isinstance(receipt, dict)
        or tuple(sorted(receipt)) != _RECEIPT_FIELDS
        or type(receipt["claimed_present"]) is not bool
    ):
        _fail("prerequisites_invalid")
    return document


def _git(root: Path, args: tuple[str, ...]) -> tuple[int, str]:
    if args not in READ_ONLY_GIT_COMMANDS:
        _fail("git_command_refused")
    if not GIT_BINARY.is_absolute() or not GIT_BINARY.is_file():
        _fail("git_observation_failed")
    command = [
        str(GIT_BINARY),
        "--no-optional-locks",
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.untrackedCache=false",
        "-c",
        "submodule.recurse=false",
        "-C",
        str(root),
        *args,
    ]
    environment = {
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_OPTIONAL_LOCKS": "0",
        "HOME": "/var/empty",
        "LC_ALL": "C",
        "PATH": "/usr/bin:/bin",
        "XDG_CONFIG_HOME": "/var/empty",
    }
    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            encoding="utf-8",
            errors="strict",
            env=environment,
            stdin=subprocess.DEVNULL,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError, UnicodeError):
        _fail("git_observation_failed")
    return completed.returncode, completed.stdout.rstrip("\n")


def _collect_product(root: Path) -> dict[str, object]:
    resolved = _existing_directory(root, reason="product_root_invalid")
    results = {args: _git(resolved, args) for args in READ_ONLY_GIT_COMMANDS}
    top_code, top = results[READ_ONLY_GIT_COMMANDS[0]]
    commit_code, commit = results[READ_ONLY_GIT_COMMANDS[1]]
    tree_code, tree = results[READ_ONLY_GIT_COMMANDS[2]]
    symbolic_code, symbolic = results[READ_ONLY_GIT_COMMANDS[3]]
    status_code, status_text = results[READ_ONLY_GIT_COMMANDS[4]]
    try:
        top_root = Path(top).resolve(strict=True)
    except OSError:
        _fail("git_observation_failed")
    if (
        top_code != 0
        or top_root != resolved
        or commit_code != 0
        or _HEX40.fullmatch(commit) is None
        or tree_code != 0
        or _HEX40.fullmatch(tree) is None
        or symbolic_code not in (0, 1)
        or (symbolic_code == 1 and symbolic)
        or status_code != 0
    ):
        _fail("git_observation_failed")
    return {
        "commit": commit,
        "tree": tree,
        "head_detached": symbolic_code == 1,
        "worktree_clean": status_text == "",
    }


def _collect_products(roots: dict[str, Path]) -> dict[str, dict[str, object]]:
    if tuple(sorted(roots)) != tuple(sorted(SCENARIO.PINNED_PRODUCTS)):
        _fail("product_roots_invalid")
    return {name: _collect_product(roots[name]) for name in sorted(roots)}


def _write_json_exclusive(path: Path, document: dict[str, object]) -> None:
    payload = (
        json.dumps(document, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
    except OSError:
        _fail("output_write_failed")


def _template() -> dict[str, object]:
    return {
        "schema_version": PREREQUISITES_SCHEMA_VERSION,
        "observed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "docker": {
            "cli_present": False,
            "daemon_running": False,
            "images_present": [],
            "binds_free": {bind: False for bind in SCENARIO.PROSPECTIVE_BINDS},
        },
        "tool_fabric_runtime_receipt": {"claimed_present": False},
    }


def _arguments(argv: list[str]) -> dict[str, str]:
    if len(argv) != len(_FULL_FLAGS) * 2 or len(argv) % 2:
        _fail("arguments_invalid")
    values: dict[str, str] = {}
    for index in range(0, len(argv), 2):
        key = argv[index]
        if key not in _FULL_FLAGS or key in values:
            _fail("arguments_invalid")
        values[key] = argv[index + 1]
    if set(values) != set(_FULL_FLAGS):
        _fail("arguments_invalid")
    return values


def _summary(report: dict[str, object]) -> None:
    products = report.get("products")
    pinned_tuple = (
        isinstance(products, dict)
        and set(products) == set(SCENARIO.PINNED_PRODUCTS)
        and all(
            isinstance(item, dict)
            and item.get("identity_matches") is True
            and item.get("head_detached") is True
            and item.get("worktree_clean") is True
            for item in products.values()
        )
    )
    print(f"status={report.get('status')}")
    print(f"pinned_tuple={'true' if pinned_tuple else 'false'}")
    for blocker in report.get("blockers", []):
        print(f"blocker={blocker}")
    execution_plan = report.get("execution_plan")
    if isinstance(execution_plan, dict):
        next_step = execution_plan.get("next_step")
        steps = execution_plan.get("steps")
        if isinstance(next_step, int) and isinstance(steps, list):
            selected = next(
                (step for step in steps if step.get("step") == next_step), None
            )
            if isinstance(selected, dict):
                print(f"next_step={next_step}:{selected.get('action')}")
    runtime_launch = report.get("runtime_launch")
    admitted = (
        isinstance(runtime_launch, dict) and runtime_launch.get("admitted") is True
    )
    print(f"runtime_launch_admitted={'true' if admitted else 'false'}")


def _run(values: dict[str, str]) -> int:
    suite_root = _existing_directory(
        values["--suite-root"], reason="suite_root_invalid"
    )
    if suite_root != BOUND_SUITE_ROOT:
        _fail("suite_root_identity_mismatch")
    roots = {
        name: _existing_directory(values[flag], reason="product_root_invalid")
        for name, flag in _PRODUCT_FLAGS.items()
    }
    product_roots = tuple(roots.values())
    observations_path = _fresh_external_path(
        Path(values["--observations-json"]),
        suite_root=suite_root,
        other_roots=product_roots,
    )
    report_path = _fresh_external_path(
        Path(values["--report-json"]),
        suite_root=suite_root,
        other_roots=product_roots,
    )
    if observations_path == report_path:
        _fail("output_paths_overlap")
    prerequisite_path = Path(values["--prerequisites"])
    if not prerequisite_path.is_absolute():
        _fail("prerequisites_invalid")
    try:
        prerequisite_parent = prerequisite_path.parent.resolve(strict=True)
    except OSError:
        _fail("prerequisites_invalid")
    if any(
        (prerequisite_parent / prerequisite_path.name).is_relative_to(root)
        for root in (suite_root, *product_roots)
    ):
        _fail("prerequisites_must_be_external")
    prerequisites = _load_prerequisites(prerequisite_path)
    observations = {
        "schema_version": SCENARIO.OBSERVATIONS_SCHEMA_VERSION,
        "observed_at": prerequisites["observed_at"],
        "products": _collect_products(roots),
        "docker": prerequisites["docker"],
        "tool_fabric_runtime_receipt": prerequisites["tool_fabric_runtime_receipt"],
    }
    _write_json_exclusive(observations_path, observations)
    report = SCENARIO.assess(suite_root=suite_root, observations=observations)
    _write_json_exclusive(report_path, report)
    _summary(report)
    return 0 if report["status"] == SCENARIO.FROZEN_STATUSES[1] else 1


def main(argv: list[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    try:
        if len(arguments) == 2 and arguments[0] == "--emit-prerequisites-template":
            target = _fresh_external_path(
                Path(arguments[1]), suite_root=BOUND_SUITE_ROOT
            )
            _write_json_exclusive(target, _template())
            return 0
        return _run(_arguments(arguments))
    except (PreflightFailure, SCENARIO.ScenarioFailure) as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
