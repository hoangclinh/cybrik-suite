"""Validate and consume one D2-COV-P0 authorization without running D2.

This pure-stdlib boundary validates the exact Suite checkout, authorization
window, durable paths, interpreter identity, D1 lock-derived distribution
closure, and pinned network client before it creates either one-shot root.
Consumption creates only the two authorized roots, three tool subdirectories,
and bounded authorization evidence.  It performs no network call, package
installation, Coverage.py extraction or measurement, listener, PKI, database,
migration, or N1-N10 runtime action.
"""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Final

EXPECTED_FIELDS: Final = (
    "D2_COV_P0",
    "AUTHORIZATION_ID",
    "AUTHORIZED_BY",
    "AUTHORIZED_AT",
    "AUTHORIZATION_EXPIRES_AT",
    "SUITE_COMMIT",
    "SUITE_TREE",
    "SUITE_ROOT",
    "HEAD_MODE",
    "WORKING_DIRECTORY",
    "HOST_TEMP_ROOT",
    "COVERAGE_ROOT",
    "COVERAGE_EVIDENCE_ROOT",
    "PINNED_PYTHON",
    "PINNED_PYTHON_REALPATH",
    "PINNED_PYTHON_SHA256",
    "PYTHON_VERSION",
    "PYTEST_VERSION",
    "CRYPTOGRAPHY_VERSION",
    "D1_LOCK_SHA256",
    "D1_REQUIREMENTS_SHA256",
    "D1_LOCKED_WHEEL_COUNT",
    "PINNED_CLOSURE_SHA256",
    "WHEEL_FILENAME",
    "WHEEL_URL",
    "WHEEL_SIZE",
    "WHEEL_SHA256",
    "OSV_ENDPOINT",
    "OSV_REQUEST_SHA256",
    "NETWORK_CLIENT",
    "NETWORK_CLIENT_REALPATH",
    "NETWORK_CLIENT_SHA256",
    "NETWORK_CLIENT_VERSION",
    "NETWORK_POLICY",
    "FETCH_COMMAND",
    "OSV_REQUEST_COMMAND",
    "EXTRACTION_COMMAND",
    "AUTHORIZED_TOOL_SUBPATHS",
    "ONE_SHOT",
    "ROLLBACK",
)

PINNED_VALUES: Final = {
    "D2_COV_P0": "APPROVE",
    "AUTHORIZED_BY": "FOUNDER",
    "HEAD_MODE": "detached",
    "PINNED_PYTHON_SHA256": "a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623",
    "PYTHON_VERSION": "3.12.13",
    "PYTEST_VERSION": "9.1.1",
    "CRYPTOGRAPHY_VERSION": "50.0.0",
    "D1_LOCK_SHA256": "e05c5e281e230b2089e356d716212a6d2c2e4320a3a30dc8dfd126216faa3add",
    "D1_REQUIREMENTS_SHA256": "93ec6936e7999ee68e04434b563581ccc5a2e3b4010e252554048b7f75bf1603",
    "D1_LOCKED_WHEEL_COUNT": "56",
    "PINNED_CLOSURE_SHA256": "6d6937112e7598ed13e21a96573c9e57c20dbb5df5d986670252391a40c5f919",
    "WHEEL_FILENAME": "coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl",
    "WHEEL_URL": "https://files.pythonhosted.org/packages/06/d1/da99af464c335d4e023a6efcd7ec30f63b88a43c93745154ab74ffb31cea/coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl",
    "WHEEL_SIZE": "221943",
    "WHEEL_SHA256": "b868acc62aa5de3be7a9d05c2333bf8359ca987e43f9cb30ff8fbda6a024ab73",
    "OSV_ENDPOINT": "https://api.osv.dev/v1/query",
    "OSV_REQUEST_SHA256": "c01011168771934d729261c649c71dadc0d47300cd698c64763cad12a4b7bec7",
    "NETWORK_CLIENT": "/usr/bin/curl",
    "NETWORK_CLIENT_REALPATH": "/usr/bin/curl",
    "NETWORK_CLIENT_SHA256": "5ab042572ea0e068644e3b8f9e8dd1ad197bfcf33d199316615b46ddc4390a41",
    "NETWORK_POLICY": "wheel-url-and-one-osv-post-only-no-other-network",
    "FETCH_COMMAND": "/usr/bin/curl --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --noproxy '*' --connect-timeout 10 --max-time 60 --output <COVERAGE_ROOT>/wheel/<WHEEL_FILENAME> <WHEEL_URL>",
    "OSV_REQUEST_COMMAND": "/usr/bin/curl --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --noproxy '*' --connect-timeout 10 --max-time 60 --request POST --header 'Content-Type: application/json' --data-binary @<COVERAGE_EVIDENCE_ROOT>/osv-request.json --output <COVERAGE_EVIDENCE_ROOT>/osv-response.json --write-out '%{http_code}' <OSV_ENDPOINT>",
    "EXTRACTION_COMMAND": "<PINNED_PYTHON> -m zipfile -e <COVERAGE_ROOT>/wheel/coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl <COVERAGE_ROOT>/site-packages",
    "AUTHORIZED_TOOL_SUBPATHS": "wheel,site-packages,data",
    "ONE_SHOT": "true",
    "ROLLBACK": "remove-only-COVERAGE_ROOT-after-failure-record-preserve-COVERAGE_EVIDENCE_ROOT",
}

HEX_40: Final = re.compile(r"[0-9a-f]{40}")
HEX_64: Final = re.compile(r"[0-9a-f]{64}")
AUTHORIZATION_ID: Final = re.compile(r"[a-z0-9][a-z0-9._-]{0,127}")
TOOL_ROOT_NAME: Final = re.compile(r"cybrik-uat-d2-coverage-[a-z0-9][a-z0-9._-]{0,63}")
EVIDENCE_ROOT_NAME: Final = re.compile(
    r"cybrik-uat-d2-coverage-evidence-[a-z0-9][a-z0-9._-]{0,63}"
)
MAX_AUTHORIZATION_BYTES: Final = 64 * 1024
DARWIN_USER_TEMP_DIR: Final = 65537


class AuthorizationFailure(Exception):
    """A stable fail-closed reason with no caller-controlled payload."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class ObservedState:
    now: datetime
    suite_commit: str
    suite_tree: str
    suite_root: Path
    working_directory: Path
    head_mode: str
    git_status: str
    host_temp_root: Path
    python_realpath: Path
    python_sha256: str
    python_version: str
    pytest_version: str
    cryptography_version: str
    closure_sha256: str
    locked_wheel_count: int
    d1_lock_sha256: str
    d1_requirements_sha256: str
    network_client_realpath: Path
    network_client_sha256: str
    network_client_version: str


@dataclass(frozen=True)
class ValidatedAuthorization:
    fields: dict[str, str]
    tool_root: Path
    evidence_root: Path
    suite_root: Path
    python_path: Path
    tool_parent_identity: tuple[int, int]
    evidence_parent_identity: tuple[int, int]


def _fail(reason: str) -> None:
    raise AuthorizationFailure(reason)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError:
        _fail("identity_file_unavailable")
    return digest.hexdigest()


def _read_authorization(path: Path) -> bytes:
    if not hasattr(os, "O_NOFOLLOW"):
        _fail("secure_authorization_read_unavailable")
    descriptor = -1
    try:
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        details = os.fstat(descriptor)
        if (
            not stat.S_ISREG(details.st_mode)
            or details.st_uid != os.geteuid()
            or details.st_mode & (stat.S_IWGRP | stat.S_IWOTH)
            or details.st_size > MAX_AUTHORIZATION_BYTES
        ):
            _fail("authorization_artifact_invalid")
        chunks: list[bytes] = []
        remaining = MAX_AUTHORIZATION_BYTES + 1
        while remaining:
            chunk = os.read(descriptor, min(16 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        raw = b"".join(chunks)
        if len(raw) > MAX_AUTHORIZATION_BYTES:
            _fail("authorization_artifact_invalid")
        return raw
    except OSError:
        _fail("authorization_artifact_invalid")
    finally:
        if descriptor >= 0:
            os.close(descriptor)


def parse_authorization(text: str) -> dict[str, str]:
    """Parse one exact ordered KEY=VALUE authorization artifact."""

    if not isinstance(text, str) or len(text.encode("utf-8")) > MAX_AUTHORIZATION_BYTES:
        _fail("authorization_format_invalid")
    if not text.endswith("\n") or "\r" in text or "\x00" in text:
        _fail("authorization_format_invalid")
    pairs: list[tuple[str, str]] = []
    for line in text.splitlines():
        if not line or "=" not in line:
            _fail("authorization_format_invalid")
        key, value = line.split("=", 1)
        if not key or not value or key.strip() != key or value.strip() != value:
            _fail("authorization_format_invalid")
        pairs.append((key, value))
    if tuple(key for key, _ in pairs) != EXPECTED_FIELDS:
        _fail("authorization_fields_invalid")
    return dict(pairs)


def closure_digest(distributions: Iterable[tuple[str, str]]) -> str:
    """Digest a canonical, duplicate-free installed-distribution inventory."""

    records: list[tuple[str, str]] = []
    for name, version in distributions:
        canonical = re.sub(r"[-_.]+", "-", name).lower()
        if not canonical or not version or "\n" in canonical or "\n" in version:
            _fail("distribution_inventory_invalid")
        records.append((canonical, version))
    records.sort()
    if len(records) != len(set(records)) or len({name for name, _ in records}) != len(
        records
    ):
        _fail("distribution_inventory_invalid")
    payload = "".join(f"{name}=={version}\n" for name, version in records).encode()
    return hashlib.sha256(payload).hexdigest()


def _timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        _fail("authorization_timestamp_invalid")
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        _fail("authorization_timestamp_invalid")
    return parsed.astimezone(UTC)


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def _overlap(first: Path, second: Path) -> bool:
    return (
        first == second
        or _is_relative_to(first, second)
        or _is_relative_to(second, first)
    )


def _canonical_existing(raw: str, reason: str) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        _fail(reason)
    try:
        resolved = path.resolve(strict=True)
    except OSError:
        _fail(reason)
    if str(resolved) != raw:
        _fail(reason)
    return resolved


def _canonical_fresh_root(
    raw: str, pattern: re.Pattern[str]
) -> tuple[Path, tuple[int, int]]:
    path = Path(raw)
    wrong_role = pattern is TOOL_ROOT_NAME and path.name.startswith(
        "cybrik-uat-d2-coverage-evidence-"
    )
    if not path.is_absolute() or pattern.fullmatch(path.name) is None or wrong_role:
        _fail("authorization_root_invalid")
    if path.exists() or path.is_symlink():
        _fail("authorization_root_not_fresh")
    try:
        parent = path.parent.resolve(strict=True)
        details = parent.stat()
    except OSError:
        _fail("authorization_root_parent_invalid")
    if parent != path.parent or not parent.is_dir():
        _fail("authorization_root_parent_invalid")
    if details.st_uid != os.geteuid() or details.st_mode & (
        stat.S_IWGRP | stat.S_IWOTH
    ):
        _fail("authorization_root_parent_unsafe")
    return path, (details.st_dev, details.st_ino)


def _has_symlinked_parent(path: Path) -> bool:
    current = Path(path.anchor)
    for part in path.parts[1:-1]:
        current /= part
        if current.is_symlink():
            return True
    return False


def _under_forbidden_temp(path: Path, host_temp: Path) -> bool:
    return any(
        _is_relative_to(path, candidate)
        for candidate in (Path("/tmp"), Path("/private/tmp"), host_temp)
    )


def validate_authorization(
    fields: dict[str, str], observed: ObservedState
) -> ValidatedAuthorization:
    """Validate every non-mutating authorization precondition."""

    if tuple(fields) != EXPECTED_FIELDS:
        _fail("authorization_fields_invalid")
    for key, expected in PINNED_VALUES.items():
        if fields.get(key) != expected:
            _fail("authorization_pinned_value_mismatch")
    if AUTHORIZATION_ID.fullmatch(fields["AUTHORIZATION_ID"]) is None:
        _fail("authorization_id_invalid")
    if (
        HEX_40.fullmatch(fields["SUITE_COMMIT"]) is None
        or HEX_40.fullmatch(fields["SUITE_TREE"]) is None
    ):
        _fail("suite_identity_invalid")
    for key in (
        "PINNED_PYTHON_SHA256",
        "D1_LOCK_SHA256",
        "D1_REQUIREMENTS_SHA256",
        "PINNED_CLOSURE_SHA256",
        "WHEEL_SHA256",
        "OSV_REQUEST_SHA256",
        "NETWORK_CLIENT_SHA256",
    ):
        if HEX_64.fullmatch(fields[key]) is None:
            _fail("authorization_digest_invalid")

    authorized_at = _timestamp(fields["AUTHORIZED_AT"])
    expires_at = _timestamp(fields["AUTHORIZATION_EXPIRES_AT"])
    if expires_at <= authorized_at or expires_at - authorized_at > timedelta(hours=24):
        _fail("authorization_window_invalid")
    now = observed.now.astimezone(UTC)
    if now < authorized_at or now >= expires_at:
        _fail("authorization_not_current")

    suite_root = _canonical_existing(fields["SUITE_ROOT"], "suite_root_invalid")
    working_directory = _canonical_existing(
        fields["WORKING_DIRECTORY"], "working_directory_invalid"
    )
    if suite_root != working_directory:
        _fail("working_directory_mismatch")
    if (
        observed.suite_commit != fields["SUITE_COMMIT"]
        or observed.suite_tree != fields["SUITE_TREE"]
        or observed.suite_root != suite_root
        or observed.working_directory != working_directory
        or observed.head_mode != "detached"
        or observed.git_status
    ):
        _fail("suite_state_mismatch")

    host_temp = Path(fields["HOST_TEMP_ROOT"])
    if not host_temp.is_absolute() or observed.host_temp_root != host_temp:
        _fail("host_temp_root_mismatch")
    tool_root, tool_parent_identity = _canonical_fresh_root(
        fields["COVERAGE_ROOT"], TOOL_ROOT_NAME
    )
    evidence_root, evidence_parent_identity = _canonical_fresh_root(
        fields["COVERAGE_EVIDENCE_ROOT"], EVIDENCE_ROOT_NAME
    )
    if _under_forbidden_temp(tool_root, host_temp) or _under_forbidden_temp(
        evidence_root, host_temp
    ):
        _fail("authorization_root_under_temp")

    python_path = Path(fields["PINNED_PYTHON"])
    if _under_forbidden_temp(python_path, host_temp):
        _fail("pinned_python_under_host_temp")
    if not python_path.is_absolute() or not python_path.is_symlink():
        _fail("pinned_python_symlink_invalid")
    if _has_symlinked_parent(python_path) or os.readlink(python_path) != "python3.12":
        _fail("pinned_python_symlink_invalid")
    python_realpath = _canonical_existing(
        fields["PINNED_PYTHON_REALPATH"], "pinned_python_realpath_invalid"
    )
    if _under_forbidden_temp(python_realpath, host_temp):
        _fail("pinned_python_under_host_temp")
    if python_path.resolve(strict=True) != python_realpath:
        _fail("pinned_python_realpath_invalid")
    if (
        observed.python_realpath != python_realpath
        or observed.python_sha256 != fields["PINNED_PYTHON_SHA256"]
        or observed.python_version != fields["PYTHON_VERSION"]
        or observed.pytest_version != fields["PYTEST_VERSION"]
        or observed.closure_sha256 != fields["PINNED_CLOSURE_SHA256"]
        or observed.locked_wheel_count != int(fields["D1_LOCKED_WHEEL_COUNT"])
        or observed.d1_lock_sha256 != fields["D1_LOCK_SHA256"]
        or observed.d1_requirements_sha256 != fields["D1_REQUIREMENTS_SHA256"]
    ):
        _fail("pinned_closure_mismatch")
    if observed.cryptography_version != fields["CRYPTOGRAPHY_VERSION"]:
        _fail("cryptography_version_mismatch")

    network_client = _canonical_existing(
        fields["NETWORK_CLIENT"], "network_client_invalid"
    )
    if (
        network_client != Path(fields["NETWORK_CLIENT_REALPATH"])
        or observed.network_client_realpath != network_client
        or observed.network_client_sha256 != fields["NETWORK_CLIENT_SHA256"]
        or observed.network_client_version != fields["NETWORK_CLIENT_VERSION"]
    ):
        _fail("network_client_identity_mismatch")

    protected = (suite_root, python_path.parent.parent, network_client)
    if _overlap(tool_root, evidence_root) or any(
        _overlap(root, item)
        for root in (tool_root, evidence_root)
        for item in protected
    ):
        _fail("authorization_root_overlap")

    return ValidatedAuthorization(
        fields=dict(fields),
        tool_root=tool_root,
        evidence_root=evidence_root,
        suite_root=suite_root,
        python_path=python_path,
        tool_parent_identity=tool_parent_identity,
        evidence_parent_identity=evidence_parent_identity,
    )


def _directory_flags() -> int:
    if not hasattr(os, "O_DIRECTORY") or not hasattr(os, "O_NOFOLLOW"):
        _fail("secure_directory_operations_unavailable")
    return os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def _same_identity(first: os.stat_result, second: os.stat_result) -> bool:
    return first.st_dev == second.st_dev and first.st_ino == second.st_ino


def _open_verified_directory(path: Path, expected_identity: tuple[int, int]) -> int:
    descriptor = -1
    try:
        named = os.stat(path, follow_symlinks=False)
        descriptor = os.open(path, _directory_flags())
        opened = os.fstat(descriptor)
    except OSError:
        if descriptor >= 0:
            os.close(descriptor)
        _fail("authorization_directory_identity_mismatch")
    if (
        not stat.S_ISDIR(named.st_mode)
        or not stat.S_ISDIR(opened.st_mode)
        or not _same_identity(named, opened)
        or (opened.st_dev, opened.st_ino) != expected_identity
        or opened.st_uid != os.geteuid()
        or opened.st_mode & (stat.S_IWGRP | stat.S_IWOTH)
    ):
        os.close(descriptor)
        _fail("authorization_directory_identity_mismatch")
    return descriptor


def _recheck_directory_binding(path: Path, descriptor: int) -> None:
    try:
        named = os.stat(path, follow_symlinks=False)
        opened = os.fstat(descriptor)
    except OSError:
        _fail("authorization_directory_identity_mismatch")
    if (
        not stat.S_ISDIR(named.st_mode)
        or not stat.S_ISDIR(opened.st_mode)
        or not _same_identity(named, opened)
        or opened.st_uid != os.geteuid()
        or opened.st_mode & (stat.S_IWGRP | stat.S_IWOTH)
    ):
        _fail("authorization_directory_identity_mismatch")


def _remove_exact_empty_at(
    parent_fd: int, name: str, expected_identity: tuple[int, int]
) -> None:
    try:
        named = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        if (
            not stat.S_ISDIR(named.st_mode)
            or (named.st_dev, named.st_ino) != expected_identity
        ):
            return
        os.rmdir(name, dir_fd=parent_fd)
    except OSError:
        return


def _mkdir_open_at(
    parent: Path, parent_fd: int, name: str
) -> tuple[int, tuple[int, int]]:
    _recheck_directory_binding(parent, parent_fd)
    os.mkdir(name, 0o700, dir_fd=parent_fd)
    descriptor = -1
    created_identity: tuple[int, int] | None = None
    try:
        named = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        created_identity = (named.st_dev, named.st_ino)
        descriptor = os.open(name, _directory_flags(), dir_fd=parent_fd)
        opened = os.fstat(descriptor)
    except OSError:
        if descriptor >= 0:
            os.close(descriptor)
        if created_identity is not None:
            _remove_exact_empty_at(parent_fd, name, created_identity)
        _fail("authorization_root_identity_mismatch")
    if (
        not stat.S_ISDIR(named.st_mode)
        or not stat.S_ISDIR(opened.st_mode)
        or not _same_identity(named, opened)
        or opened.st_uid != os.geteuid()
        or stat.S_IMODE(opened.st_mode) != 0o700
    ):
        os.close(descriptor)
        _remove_exact_empty_at(parent_fd, name, created_identity)
        _fail("authorization_root_identity_mismatch")
    return descriptor, (opened.st_dev, opened.st_ino)


def _write_exclusive_at(directory_fd: int, name: str, payload: bytes) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if not hasattr(os, "O_NOFOLLOW"):
        _fail("secure_directory_operations_unavailable")
    flags |= os.O_NOFOLLOW
    descriptor = os.open(name, flags, 0o600, dir_fd=directory_fd)
    try:
        remaining = memoryview(payload)
        while remaining:
            written = os.write(descriptor, remaining)
            if written <= 0:
                raise OSError("short write")
            remaining = remaining[written:]
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _rollback_tool_root(
    parent: Path,
    parent_fd: int,
    root_fd: int,
    root_name: str,
    root_identity: tuple[int, int],
) -> None:
    """Remove only the still-bound empty tool tree; preserve on any ambiguity."""

    try:
        _recheck_directory_binding(parent, parent_fd)
        named = os.stat(root_name, dir_fd=parent_fd, follow_symlinks=False)
        opened = os.fstat(root_fd)
        if (named.st_dev, named.st_ino) != root_identity or (
            opened.st_dev,
            opened.st_ino,
        ) != root_identity:
            return
        entries = os.listdir(root_fd)
        if any(name not in {"wheel", "site-packages", "data"} for name in entries):
            return
        for name in entries:
            child = os.stat(name, dir_fd=root_fd, follow_symlinks=False)
            if not stat.S_ISDIR(child.st_mode):
                return
        for name in entries:
            os.rmdir(name, dir_fd=root_fd)
        os.rmdir(root_name, dir_fd=parent_fd)
    except (OSError, AuthorizationFailure):
        return


def consume_authorization(
    authorization: ValidatedAuthorization, raw_authorization: bytes
) -> dict[str, object]:
    """Consume the one-shot token by fresh root creation and evidence binding."""

    tool_parent_fd = -1
    evidence_parent_fd = -1
    tool_fd = -1
    evidence_fd = -1
    tool_identity = (-1, -1)
    tool_created = False
    evidence_created = False
    failed = False
    failure_reason = "authorization_consumption_failed"
    try:
        evidence_parent_fd = _open_verified_directory(
            authorization.evidence_root.parent,
            authorization.evidence_parent_identity,
        )
        tool_parent_fd = _open_verified_directory(
            authorization.tool_root.parent,
            authorization.tool_parent_identity,
        )
        evidence_fd, _ = _mkdir_open_at(
            authorization.evidence_root.parent,
            evidence_parent_fd,
            authorization.evidence_root.name,
        )
        evidence_created = True
        tool_fd, tool_identity = _mkdir_open_at(
            authorization.tool_root.parent,
            tool_parent_fd,
            authorization.tool_root.name,
        )
        tool_created = True
        for name in authorization.fields["AUTHORIZED_TOOL_SUBPATHS"].split(","):
            os.mkdir(name, 0o700, dir_fd=tool_fd)
        _write_exclusive_at(evidence_fd, "authorization.env", raw_authorization)
        record = {
            "authorization_id": authorization.fields["AUTHORIZATION_ID"],
            "authorization_sha256": hashlib.sha256(raw_authorization).hexdigest(),
            "closure_sha256": authorization.fields["PINNED_CLOSURE_SHA256"],
            "d1_lock_sha256": authorization.fields["D1_LOCK_SHA256"],
            "d1_locked_wheel_count": int(authorization.fields["D1_LOCKED_WHEEL_COUNT"]),
            "status": "consumed_pre_network",
            "tool_root_identity": {
                "st_dev": tool_identity[0],
                "st_ino": tool_identity[1],
            },
            "evidence_root_identity": {
                "st_dev": os.fstat(evidence_fd).st_dev,
                "st_ino": os.fstat(evidence_fd).st_ino,
            },
        }
        payload = (
            json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n"
        ).encode()
        _write_exclusive_at(evidence_fd, "authorization-consumption.json", payload)
        return record
    except FileExistsError:
        failed = True
        failure_reason = "authorization_root_not_fresh"
    except (OSError, AuthorizationFailure):
        failed = True
        failure_reason = "authorization_consumption_failed"
    finally:
        if failed:
            if tool_created and tool_fd >= 0 and tool_parent_fd >= 0:
                _rollback_tool_root(
                    authorization.tool_root.parent,
                    tool_parent_fd,
                    tool_fd,
                    authorization.tool_root.name,
                    tool_identity,
                )
            if evidence_created and evidence_fd >= 0:
                failure_payload = (
                    json.dumps(
                        {"reason": failure_reason, "status": "failed_pre_network"},
                        sort_keys=True,
                        separators=(",", ":"),
                    )
                    + "\n"
                ).encode()
                try:
                    _write_exclusive_at(
                        evidence_fd, "authorization-failure.json", failure_payload
                    )
                except (OSError, AuthorizationFailure):
                    pass
        for descriptor in (tool_fd, evidence_fd, tool_parent_fd, evidence_parent_fd):
            if descriptor >= 0:
                os.close(descriptor)
    _fail(failure_reason)


def _run(command: list[str], *, cwd: Path | None = None) -> str:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
            env={"PATH": "/usr/bin:/bin", "PYTHONNOUSERSITE": "1"},
        )
    except (OSError, subprocess.CalledProcessError):
        _fail("observation_command_failed")
    return completed.stdout.strip()


def _git_head_mode(suite_root: Path) -> str:
    try:
        completed = subprocess.run(
            ["/usr/bin/git", "symbolic-ref", "-q", "HEAD"],
            cwd=suite_root,
            check=False,
            capture_output=True,
            text=True,
            env={"PATH": "/usr/bin:/bin"},
        )
    except OSError:
        _fail("observation_command_failed")
    if completed.returncode == 0:
        return "attached"
    if completed.returncode == 1 and not completed.stdout and not completed.stderr:
        return "detached"
    _fail("observation_command_failed")


def _darwin_user_temp() -> Path:
    try:
        libc = ctypes.CDLL(None)
        libc.confstr.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_size_t)
        libc.confstr.restype = ctypes.c_size_t
        length = libc.confstr(DARWIN_USER_TEMP_DIR, None, 0)
        if length <= 1 or length > 4096:
            _fail("host_temp_root_unavailable")
        buffer = ctypes.create_string_buffer(length)
        if libc.confstr(DARWIN_USER_TEMP_DIR, buffer, length) != length:
            _fail("host_temp_root_unavailable")
        return Path(os.fsdecode(buffer.value)).resolve(strict=True)
    except (AttributeError, OSError, TypeError, ValueError):
        _fail("host_temp_root_unavailable")


def _distribution_observation(python_path: Path) -> tuple[str, int, str, str]:
    code = (
        "import importlib.metadata as m,json;"
        "rows=sorted((d.metadata['Name'],d.version) for d in m.distributions());"
        "print(json.dumps(rows,separators=(',',':')))"
    )
    raw = _run([str(python_path), "-I", "-c", code])
    try:
        parsed = json.loads(raw)
        rows = [(str(name), str(version)) for name, version in parsed]
    except (TypeError, ValueError):
        _fail("distribution_inventory_invalid")
    versions = {re.sub(r"[-_.]+", "-", name).lower(): version for name, version in rows}
    return (
        closure_digest(rows),
        len(rows),
        versions.get("pytest", ""),
        versions.get("cryptography", ""),
    )


def _d1_evidence_observation(suite_root: Path) -> tuple[str, int]:
    evidence_path = (
        suite_root
        / "integration/compose/soc-ai-lifecycle-create-mtls/evidence/dependency-lock.json"
    )
    try:
        raw = evidence_path.read_bytes()
        if len(raw) > 1024 * 1024:
            _fail("d1_dependency_evidence_invalid")
        document = json.loads(raw)
        requirements_sha256 = document["requirements_sha256"]
        wheel_count = document["wheel_count"]
        uv_lock_sha256 = document["uv_lock_sha256"]
        if (
            not isinstance(requirements_sha256, str)
            or HEX_64.fullmatch(requirements_sha256) is None
            or not isinstance(wheel_count, int)
            or isinstance(wheel_count, bool)
            or wheel_count <= 0
            or not isinstance(uv_lock_sha256, str)
            or HEX_64.fullmatch(uv_lock_sha256) is None
            or document["anycorn_in_lock"] is not False
            or document["anycorn_in_requirements"] is not False
            or document["anycorn_in_wheelhouse"] is not False
            or uv_lock_sha256 != PINNED_VALUES["D1_LOCK_SHA256"]
            or requirements_sha256 != PINNED_VALUES["D1_REQUIREMENTS_SHA256"]
            or wheel_count != int(PINNED_VALUES["D1_LOCKED_WHEEL_COUNT"])
        ):
            _fail("d1_dependency_evidence_invalid")
    except (KeyError, OSError, TypeError, ValueError):
        _fail("d1_dependency_evidence_invalid")
    return requirements_sha256, wheel_count


def _prevalidate_observation_inputs(
    fields: dict[str, str],
) -> tuple[Path, Path, Path]:
    """Reject untrusted command paths before any subprocess can be reached."""

    try:
        if tuple(fields) != EXPECTED_FIELDS:
            _fail("invalid")
        if any(fields.get(key) != expected for key, expected in PINNED_VALUES.items()):
            _fail("invalid")
        if AUTHORIZATION_ID.fullmatch(fields["AUTHORIZATION_ID"]) is None:
            _fail("invalid")
        if (
            HEX_40.fullmatch(fields["SUITE_COMMIT"]) is None
            or HEX_40.fullmatch(fields["SUITE_TREE"]) is None
        ):
            _fail("invalid")
        for key in (
            "PINNED_PYTHON_SHA256",
            "D1_LOCK_SHA256",
            "D1_REQUIREMENTS_SHA256",
            "PINNED_CLOSURE_SHA256",
            "WHEEL_SHA256",
            "OSV_REQUEST_SHA256",
            "NETWORK_CLIENT_SHA256",
        ):
            if HEX_64.fullmatch(fields[key]) is None:
                _fail("invalid")

        authorized_at = _timestamp(fields["AUTHORIZED_AT"])
        expires_at = _timestamp(fields["AUTHORIZATION_EXPIRES_AT"])
        now = datetime.now(UTC)
        if (
            expires_at <= authorized_at
            or expires_at - authorized_at > timedelta(hours=24)
            or now < authorized_at
            or now >= expires_at
        ):
            _fail("invalid")

        suite_root = _canonical_existing(fields["SUITE_ROOT"], "invalid")
        working_directory = _canonical_existing(fields["WORKING_DIRECTORY"], "invalid")
        if (
            not suite_root.is_dir()
            or suite_root != working_directory
            or Path.cwd().resolve(strict=True) != working_directory
        ):
            _fail("invalid")

        host_temp = _darwin_user_temp()
        if Path(fields["HOST_TEMP_ROOT"]) != host_temp:
            _fail("invalid")
        tool_root, _ = _canonical_fresh_root(fields["COVERAGE_ROOT"], TOOL_ROOT_NAME)
        evidence_root, _ = _canonical_fresh_root(
            fields["COVERAGE_EVIDENCE_ROOT"], EVIDENCE_ROOT_NAME
        )
        if (
            _under_forbidden_temp(tool_root, host_temp)
            or _under_forbidden_temp(evidence_root, host_temp)
            or _overlap(tool_root, evidence_root)
        ):
            _fail("invalid")

        python_path = Path(fields["PINNED_PYTHON"])
        if (
            not python_path.is_absolute()
            or not python_path.is_symlink()
            or _under_forbidden_temp(python_path, host_temp)
            or _has_symlinked_parent(python_path)
            or os.readlink(python_path) != "python3.12"
        ):
            _fail("invalid")
        python_realpath = _canonical_existing(
            fields["PINNED_PYTHON_REALPATH"], "invalid"
        )
        if (
            not python_realpath.is_file()
            or _under_forbidden_temp(python_realpath, host_temp)
            or python_path.resolve(strict=True) != python_realpath
            or _sha256_file(python_realpath) != fields["PINNED_PYTHON_SHA256"]
        ):
            _fail("invalid")

        network_client = _canonical_existing(fields["NETWORK_CLIENT"], "invalid")
        if (
            not network_client.is_file()
            or network_client != Path(fields["NETWORK_CLIENT_REALPATH"])
            or _sha256_file(network_client) != fields["NETWORK_CLIENT_SHA256"]
        ):
            _fail("invalid")

        protected = (suite_root, python_path.parent.parent, network_client)
        if any(
            _overlap(root, item)
            for root in (tool_root, evidence_root)
            for item in protected
        ):
            _fail("invalid")
        lock_sha256 = _sha256_file(
            suite_root / "integration/compose/soc-ai-lifecycle-create-mtls/uv.lock"
        )
        requirements_sha256, wheel_count = _d1_evidence_observation(suite_root)
        if (
            lock_sha256 != fields["D1_LOCK_SHA256"]
            or requirements_sha256 != fields["D1_REQUIREMENTS_SHA256"]
            or wheel_count != int(fields["D1_LOCKED_WHEEL_COUNT"])
        ):
            _fail("invalid")
    except (OSError, AuthorizationFailure):
        _fail("observation_input_invalid")
    return suite_root, python_path, network_client


def collect_observed(fields: dict[str, str]) -> ObservedState:
    """Collect current state without creating roots or making network calls."""

    suite_root, python_path, network_client = _prevalidate_observation_inputs(fields)
    closure_sha, _, pytest_version, cryptography_version = _distribution_observation(
        python_path
    )
    python_version = _run(
        [
            str(python_path),
            "-I",
            "-c",
            "import platform;print(platform.python_version())",
        ]
    )
    curl_version_lines = _run([str(network_client), "--version"]).splitlines()
    if not curl_version_lines:
        _fail("network_client_version_unavailable")
    curl_version = curl_version_lines[0]
    requirements_sha256, wheel_count = _d1_evidence_observation(suite_root)
    return ObservedState(
        now=datetime.now(UTC),
        suite_commit=_run(["/usr/bin/git", "rev-parse", "HEAD"], cwd=suite_root),
        suite_tree=_run(["/usr/bin/git", "rev-parse", "HEAD^{tree}"], cwd=suite_root),
        suite_root=suite_root.resolve(strict=True),
        working_directory=Path.cwd().resolve(strict=True),
        head_mode=_git_head_mode(suite_root),
        git_status=_run(
            ["/usr/bin/git", "status", "--porcelain=v1", "-uall", "--ignored"],
            cwd=suite_root,
        ),
        host_temp_root=_darwin_user_temp(),
        python_realpath=python_path.resolve(strict=True),
        python_sha256=_sha256_file(python_path.resolve(strict=True)),
        python_version=python_version,
        pytest_version=pytest_version,
        cryptography_version=cryptography_version,
        closure_sha256=closure_sha,
        locked_wheel_count=wheel_count,
        d1_lock_sha256=_sha256_file(
            suite_root / "integration/compose/soc-ai-lifecycle-create-mtls/uv.lock"
        ),
        d1_requirements_sha256=requirements_sha256,
        network_client_realpath=network_client.resolve(strict=True),
        network_client_sha256=_sha256_file(network_client.resolve(strict=True)),
        network_client_version=curl_version,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--authorization", required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check-only", action="store_true")
    mode.add_argument("--consume", action="store_true")
    args = parser.parse_args(argv)
    try:
        raw = _read_authorization(Path(args.authorization))
        fields = parse_authorization(raw.decode("utf-8"))
        observed = collect_observed(fields)
        validated = validate_authorization(fields, observed)
        record: dict[str, object] = {
            "authorization_id": fields["AUTHORIZATION_ID"],
            "status": "validated_not_consumed",
        }
        if args.consume:
            record = consume_authorization(validated, raw)
        print(json.dumps(record, sort_keys=True, separators=(",", ":")))
        return 0
    except (OSError, UnicodeError, AuthorizationFailure) as error:
        reason = (
            error.reason
            if isinstance(error, AuthorizationFailure)
            else "authorization_artifact_unavailable"
        )
        print(json.dumps({"reason": reason, "status": "refused"}, sort_keys=True))
        return 1


if __name__ == "__main__":
    sys.exit(main())
