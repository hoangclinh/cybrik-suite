from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path
from typing import NoReturn

ABSENCE_SCHEMA = "cybrik.integrated-uat.absence/v1"
EXPECTED_REPOSITORIES = (
    "cybrik-soc-command-center",
    "cybrik-cyber-ai-platform",
    "cybrik-security-tool-fabric",
    "cybrik-suite",
)
EXPECTED_EXTERNAL_CAPABILITIES = (
    "postgres_d2_runtime",
    "postgres_d2_evidence",
    "alert_context_runtime",
    "alert_context_evidence",
    "alert_context_state",
)
OWNED_ARTIFACTS = (
    ("postgres_d2_runtime", "01-process.marker", "file"),
    ("postgres_d2_evidence", "02-container.marker", "file"),
    ("postgres_d2_runtime", "03-postgres", "directory"),
    ("alert_context_evidence", "04-private.json", "file"),
    ("alert_context_runtime", "05-runtime", "directory"),
    ("alert_context_state", "06-pki", "directory"),
)

_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_RUN_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,127}$")

last_teardown_order: tuple[str, ...] = ()


class CommonTeardownFailure(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _fail(reason: str) -> NoReturn:
    raise CommonTeardownFailure(reason)


def _canonical_json(value: object) -> bytes:
    try:
        return (
            json.dumps(value, allow_nan=False, sort_keys=True, separators=(",", ":"))
            + "\n"
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError):
        _fail("canonical_json_invalid")


def _hex64(value: object, reason: str) -> str:
    if not isinstance(value, str) or _HEX64.fullmatch(value) is None:
        _fail(reason)
    return value


def _run_id(value: object) -> str:
    if not isinstance(value, str) or _RUN_ID.fullmatch(value) is None:
        _fail("context_invalid")
    return value


def _exact_directory(path: object, reason: str) -> Path:
    if not isinstance(path, Path) or not path.is_absolute():
        _fail(reason)
    try:
        resolved = path.resolve(strict=True)
        info = path.lstat()
    except OSError:
        _fail(reason)
    if resolved != path or stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        _fail(reason)
    return path


def _repository_roots(values: list[str]) -> tuple[tuple[str, Path], ...]:
    parsed: list[tuple[str, Path]] = []
    for value in values:
        if "=" not in value:
            _fail("repository_roots_invalid")
        name, raw_path = value.split("=", maxsplit=1)
        parsed.append(
            (name, _exact_directory(Path(raw_path), "repository_roots_invalid"))
        )
    if tuple(name for name, _ in parsed) != EXPECTED_REPOSITORIES:
        _fail("repository_roots_invalid")
    return tuple(parsed)


def _repository_roots_digest(roots: tuple[tuple[str, Path], ...]) -> str:
    payload = [{"repository": name, "root": str(root)} for name, root in roots]
    return hashlib.sha256(_canonical_json(payload)).hexdigest()


def _external_roots(values: list[str]) -> tuple[tuple[str, Path], ...]:
    parsed: list[tuple[str, Path]] = []
    for value in values:
        if "=" not in value:
            _fail("external_roots_invalid")
        capability, raw_path = value.split("=", maxsplit=1)
        parsed.append(
            (capability, _exact_directory(Path(raw_path), "external_roots_invalid"))
        )
    if tuple(capability for capability, _ in parsed) != EXPECTED_EXTERNAL_CAPABILITIES:
        _fail("external_roots_invalid")
    return tuple(parsed)


def _external_roots_digest(roots: tuple[tuple[str, Path], ...]) -> str:
    payload = [
        {"capability": capability, "root": str(root)} for capability, root in roots
    ]
    return hashlib.sha256(_canonical_json(payload)).hexdigest()


def _marker_matches(path: Path, marker_sha256: str, evidence_root: Path) -> None:
    if not path.is_absolute() or path.parent != evidence_root:
        _fail("context_invalid")
    try:
        payload = path.read_bytes()
    except OSError:
        _fail("context_invalid")
    if hashlib.sha256(payload).hexdigest() != marker_sha256:
        _fail("context_invalid")


def _context(arguments: argparse.Namespace) -> dict[str, object]:
    repository_roots = _repository_roots(arguments.repository)
    repository_roots_sha256 = _hex64(
        arguments.repository_roots_sha256, "repository_roots_mismatch"
    )
    external_roots = _external_roots(arguments.external_root)
    external_roots_sha256 = _hex64(
        arguments.external_roots_sha256, "external_roots_mismatch"
    )
    if _repository_roots_digest(repository_roots) != repository_roots_sha256:
        _fail("repository_roots_mismatch")
    if _external_roots_digest(external_roots) != external_roots_sha256:
        _fail("external_roots_mismatch")
    evidence_root = _exact_directory(Path(arguments.evidence_root), "context_invalid")
    marker_sha256 = _hex64(arguments.marker_sha256, "context_invalid")
    _marker_matches(Path(arguments.consumption_marker), marker_sha256, evidence_root)
    return {
        "aggregate_sha256": _hex64(arguments.aggregate_sha256, "context_invalid"),
        "authorization_sha256": _hex64(
            arguments.authorization_sha256, "context_invalid"
        ),
        "external_roots": dict(external_roots),
        "external_roots_sha256": external_roots_sha256,
        "marker_sha256": marker_sha256,
        "repository_roots_sha256": repository_roots_sha256,
        "repository_tuple_sha256": _hex64(
            arguments.repository_tuple_sha256, "context_invalid"
        ),
        "run_id": _run_id(arguments.run_id),
    }


def _path_state(path: Path, *, kind: str) -> str:
    try:
        info = path.lstat()
    except FileNotFoundError:
        return "missing"
    except OSError:
        _fail("resource_path_invalid")
    if stat.S_ISLNK(info.st_mode):
        _fail("resource_path_invalid")
    if kind == "file" and stat.S_ISREG(info.st_mode):
        return "present"
    if kind == "directory" and stat.S_ISDIR(info.st_mode):
        return "present"
    _fail("resource_path_invalid")


def _remove(path: Path, *, kind: str) -> None:
    state = _path_state(path, kind=kind)
    if state == "missing":
        return
    try:
        if kind == "file":
            os.unlink(path)
        else:
            os.rmdir(path)
    except OSError:
        _fail("resource_remove_failed")


def teardown(arguments: argparse.Namespace) -> None:
    global last_teardown_order
    context = _context(arguments)
    external_roots = context["external_roots"]
    if not isinstance(external_roots, dict):
        _fail("context_invalid")
    order: list[str] = []
    for capability, relative_path, kind in reversed(OWNED_ARTIFACTS):
        root = external_roots.get(capability)
        if not isinstance(root, Path):
            _fail("external_roots_invalid")
        path = root / relative_path
        _remove(path, kind=kind)
        order.append(f"{capability}:{path.name}")
    last_teardown_order = tuple(order)


def verify_absent(arguments: argparse.Namespace) -> dict[str, object]:
    context = _context(arguments)
    external_roots = context["external_roots"]
    if not isinstance(external_roots, dict):
        _fail("context_invalid")
    absent = True
    for capability, relative_path, kind in OWNED_ARTIFACTS:
        root = external_roots.get(capability)
        if not isinstance(root, Path):
            _fail("external_roots_invalid")
        absent = absent and _path_state(root / relative_path, kind=kind) == "missing"
    return {
        "absent": absent,
        "aggregate_sha256": context["aggregate_sha256"],
        "authorization_sha256": context["authorization_sha256"],
        "external_roots_sha256": context["external_roots_sha256"],
        "marker_sha256": context["marker_sha256"],
        "repository_roots_sha256": context["repository_roots_sha256"],
        "repository_tuple_sha256": context["repository_tuple_sha256"],
        "run_id": context["run_id"],
        "schema": ABSENCE_SCHEMA,
        "scope": "common",
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cybrik-integrated-uat-common-teardown")
    subcommands = parser.add_subparsers(dest="command", required=True)
    for command in ("teardown", "verify-absent"):
        subcommand = subcommands.add_parser(command)
        subcommand.add_argument("--run-id", required=True)
        subcommand.add_argument("--aggregate-sha256", required=True)
        subcommand.add_argument("--repository-tuple-sha256", required=True)
        subcommand.add_argument("--repository-roots-sha256", required=True)
        subcommand.add_argument("--external-roots-sha256", required=True)
        subcommand.add_argument("--authorization-sha256", required=True)
        subcommand.add_argument("--marker-sha256", required=True)
        subcommand.add_argument("--consumption-marker", required=True)
        subcommand.add_argument("--evidence-root", required=True)
        subcommand.add_argument("--repository", action="append", required=True)
        subcommand.add_argument("--external-root", action="append", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    arguments = parser.parse_args(argv)
    try:
        if arguments.command == "teardown":
            teardown(arguments)
            return 0
        if arguments.command == "verify-absent":
            sys.stdout.buffer.write(_canonical_json(verify_absent(arguments)))
            return 0
        _fail("command_invalid")
    except CommonTeardownFailure as exc:
        print(exc.reason, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
