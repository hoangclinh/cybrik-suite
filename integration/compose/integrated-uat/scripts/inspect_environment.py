from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import socket
import stat
import subprocess
import sys
from pathlib import Path
from typing import NoReturn

SCHEMA = "cybrik.integrated-uat.environment-inspection/v1"
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
EXPECTED_PORTS = (55432, 58442, 58443, 58444)
EXPECTED_EMPTY_CAPABILITIES = (
    "postgres_d2_runtime",
    "alert_context_runtime",
    "alert_context_evidence",
    "alert_context_state",
)
OWNED_ARTIFACTS = (
    ("postgres_d2_runtime", "processes_absent", "01-process.marker", "file"),
    ("postgres_d2_evidence", "containers_absent", "02-container.marker", "file"),
    ("postgres_d2_runtime", "postgres_absent", "03-postgres", "directory"),
    ("alert_context_evidence", "private_artifacts_absent", "04-private.json", "file"),
    ("alert_context_runtime", "runtime_artifacts_absent", "05-runtime", "directory"),
    ("alert_context_state", "pki_absent", "06-pki", "directory"),
)
_HEX40 = re.compile(r"^[0-9a-f]{40}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_RUN_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,127}$")
_GIT_ENV = {
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_CONFIG_NOSYSTEM": "1",
    "LANG": "C",
    "LC_ALL": "C",
    "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
}


class InspectEnvironmentFailure(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _fail(reason: str) -> NoReturn:
    raise InspectEnvironmentFailure(reason)


def _canonical_json(value: object) -> bytes:
    try:
        return (
            json.dumps(value, allow_nan=False, sort_keys=True, separators=(",", ":"))
            + "\n"
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError):
        _fail("canonical_json_invalid")


def _hex40(value: object, reason: str) -> str:
    if not isinstance(value, str) or _HEX40.fullmatch(value) is None:
        _fail(reason)
    return value


def _hex64(value: object, reason: str) -> str:
    if not isinstance(value, str) or _HEX64.fullmatch(value) is None:
        _fail(reason)
    return value


def _run_id(value: object) -> str:
    if not isinstance(value, str) or _RUN_ID.fullmatch(value) is None:
        _fail("run_id_invalid")
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


def _git_binary() -> str:
    candidate = shutil.which("git")
    if candidate is None or not Path(candidate).is_absolute():
        _fail("git_unavailable")
    return candidate


def _git(root: Path, *args: str) -> str:
    try:
        completed = subprocess.run(
            [_git_binary(), *args],
            cwd=root,
            env=_GIT_ENV,
            text=True,
            capture_output=True,
            shell=False,
            check=False,
            stdin=subprocess.DEVNULL,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        _fail("repository_tuple_unavailable")
    if completed.returncode != 0:
        _fail("repository_tuple_unavailable")
    return completed.stdout.strip()


def _repository_tuple(
    roots: tuple[tuple[str, Path], ...],
) -> tuple[dict[str, object], ...]:
    observed: list[dict[str, object]] = []
    for repository, root in roots:
        commit = _git(root, "rev-parse", "HEAD")
        tree = _git(root, "rev-parse", "HEAD^{tree}")
        clean = _git(root, "status", "--porcelain", "--untracked-files=no") == ""
        observed.append(
            {
                "clean": clean,
                "commit": _hex40(commit, "repository_tuple_mismatch"),
                "repository": repository,
                "tree": _hex40(tree, "repository_tuple_mismatch"),
            }
        )
    if not all(item["clean"] is True for item in observed):
        _fail("repository_not_clean")
    return tuple(observed)


def _repository_tuple_digest(repositories: tuple[dict[str, object], ...]) -> str:
    return hashlib.sha256(_canonical_json(list(repositories))).hexdigest()


def _path_state(path: Path, *, kind: str) -> bool:
    try:
        info = path.lstat()
    except FileNotFoundError:
        return False
    except OSError:
        _fail("artifact_observation_invalid")
    if stat.S_ISLNK(info.st_mode):
        _fail("artifact_observation_invalid")
    if kind == "file":
        return stat.S_ISREG(info.st_mode)
    return stat.S_ISDIR(info.st_mode)


def _artifact_absence(external_roots: dict[str, Path]) -> dict[str, bool]:
    observed = {
        "containers_absent": True,
        "pki_absent": True,
        "postgres_absent": True,
        "private_artifacts_absent": True,
        "processes_absent": True,
        "runtime_artifacts_absent": True,
    }
    for capability, field, relative_path, kind in OWNED_ARTIFACTS:
        present = _path_state(external_roots[capability] / relative_path, kind=kind)
        observed[field] = observed[field] and not present
    try:
        required_empty = all(
            not any(external_roots[capability].iterdir())
            for capability in EXPECTED_EMPTY_CAPABILITIES
        )
    except OSError:
        _fail("artifact_observation_invalid")
    if not required_empty:
        _fail("absence_observation_invalid")
    return observed


def _absent_ports(values: list[str]) -> tuple[int, ...]:
    try:
        ports = tuple(int(value) for value in values)
    except ValueError:
        _fail("port_observations_invalid")
    if ports != EXPECTED_PORTS:
        _fail("port_observations_invalid")
    for port in ports:
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            probe.settimeout(0.1)
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                _fail("port_observations_invalid")
        finally:
            probe.close()
    return ports


def inspect(arguments: argparse.Namespace) -> dict[str, object]:
    aggregate_sha256 = _hex64(arguments.aggregate_sha256, "aggregate_mismatch")
    repository_tuple_sha256 = _hex64(
        arguments.repository_tuple_sha256, "repository_tuple_mismatch"
    )
    repository_roots = _repository_roots(arguments.repository)
    repository_roots_sha256 = _hex64(
        arguments.repository_roots_sha256, "repository_roots_mismatch"
    )
    external_roots = _external_roots(arguments.external_root)
    external_roots_sha256 = _hex64(
        arguments.external_roots_sha256, "external_roots_mismatch"
    )
    run_id = _run_id(arguments.run_id)
    if _repository_roots_digest(repository_roots) != repository_roots_sha256:
        _fail("repository_roots_mismatch")
    if _external_roots_digest(external_roots) != external_roots_sha256:
        _fail("external_roots_mismatch")
    observed_tuple = _repository_tuple(repository_roots)
    if _repository_tuple_digest(observed_tuple) != repository_tuple_sha256:
        _fail("repository_tuple_mismatch")
    absent_ports = _absent_ports(arguments.absent_port)
    absent_artifacts = _artifact_absence(dict(external_roots))
    if not all(absent_artifacts.values()):
        _fail("absence_observation_invalid")
    return {
        "absent_ports": list(absent_ports),
        "aggregate_sha256": aggregate_sha256,
        "containers_absent": True,
        "external_roots_sha256": external_roots_sha256,
        "pki_absent": True,
        "postgres_absent": True,
        "private_artifacts_absent": True,
        "processes_absent": True,
        "repository_roots_sha256": repository_roots_sha256,
        "repository_tuple": list(observed_tuple),
        "repository_tuple_sha256": repository_tuple_sha256,
        "run_id": run_id,
        "runtime_artifacts_absent": True,
        "schema": SCHEMA,
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cybrik-integrated-uat-inspect-environment")
    subcommands = parser.add_subparsers(dest="command", required=True)
    inspect_parser = subcommands.add_parser("inspect")
    inspect_parser.add_argument("--run-id", required=True)
    inspect_parser.add_argument("--aggregate-sha256", required=True)
    inspect_parser.add_argument("--repository-tuple-sha256", required=True)
    inspect_parser.add_argument("--repository-roots-sha256", required=True)
    inspect_parser.add_argument("--external-roots-sha256", required=True)
    inspect_parser.add_argument("--absent-port", action="append", required=True)
    inspect_parser.add_argument("--repository", action="append", required=True)
    inspect_parser.add_argument("--external-root", action="append", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    arguments = parser.parse_args(argv)
    try:
        if arguments.command != "inspect":
            _fail("command_invalid")
        sys.stdout.buffer.write(_canonical_json(inspect(arguments)))
        return 0
    except InspectEnvironmentFailure as exc:
        print(exc.reason, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
