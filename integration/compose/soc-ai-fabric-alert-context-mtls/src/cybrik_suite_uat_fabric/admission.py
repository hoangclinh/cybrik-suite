"""Fail-closed admission for one exact, externally authorized UAT attempt.

All Git operations are read-only.  Authorization and one-shot state live
outside every product repository, avoiding both a Git self-reference and a
mutable in-repository approval.  Importing this module is inert.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import subprocess
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Final, Protocol

REPOSITORY_ROLES: Final = ("suite", "soc", "cyber_ai", "tool_fabric")
AUTHORIZATION_SCHEMA: Final = "CYBRIK-UAT-SOC-AI-FABRIC-AUTH/v1"
TRACKED_BLOB_ALGORITHM: Final = "cybrik-uat-tracked-blob-sha256-lines/v1"
MAX_EXTERNAL_FILE_BYTES: Final = 64 * 1024
MAX_AUTHORIZATION_WINDOW: Final = timedelta(hours=24)
EXTERNAL_FILE_MODE: Final = 0o600
STATE_ROOT_MODE: Final = 0o700

_HEX40 = re.compile(r"[0-9a-f]{40}")
_HEX64 = re.compile(r"[0-9a-f]{64}")
_AUTHORIZATION_ID = re.compile(r"[a-z0-9][a-z0-9._-]{0,127}")
_SIGNER_IDENTITY = re.compile(r"[A-Z][A-Z0-9._-]{0,127}")
_TOP_LEVEL_FIELDS: Final = frozenset(
    {
        "authorization_id",
        "authorized_by",
        "decision",
        "expires_at",
        "issued_at",
        "one_shot",
        "schema",
        "tracked_blob_aggregate",
        "tuple",
    }
)
_GIT_ENV: Final = {
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_CONFIG_NOSYSTEM": "1",
    "LC_ALL": "C",
    "PATH": "/usr/bin:/bin",
}


class AdmissionFailure(RuntimeError):
    """A stable, non-reflecting UAT admission refusal."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class GitReader(Protocol):
    """Injected read-only Git seam used by unit tests and admission."""

    def __call__(self, root: Path, arguments: tuple[str, ...]) -> bytes: ...


SignatureVerifier = Callable[[bytes, bytes], str | None]


@dataclass(frozen=True, slots=True)
class RepoExpectation:
    role: str
    root: Path
    commit: str
    tree: str


@dataclass(frozen=True, slots=True)
class RepositoryObservation:
    role: str
    root: Path
    commit: str
    tree: str


@dataclass(frozen=True, slots=True)
class TrackedBlobAggregate:
    algorithm: str
    file_count: int
    sha256: str


@dataclass(frozen=True, slots=True)
class ExternalAuthorization:
    authorization_id: str
    authorized_by: str
    authorization_sha256: str
    exact: bool
    external: bool
    one_shot: bool
    consumed: bool
    issued_at: datetime
    expires_at: datetime
    aggregate: TrackedBlobAggregate
    observations: tuple[RepositoryObservation, ...]


def _default_git(root: Path, arguments: tuple[str, ...]) -> bytes:
    try:
        result = subprocess.run(
            ("/usr/bin/git", "-C", str(root), *arguments),
            check=True,
            capture_output=True,
            env=_GIT_ENV,
            timeout=15,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise AdmissionFailure("repository_inspection_failed") from error
    return result.stdout


def _validated_root(root: object) -> Path:
    if not isinstance(root, Path) or not root.is_absolute():
        raise AdmissionFailure("repository_root_invalid")
    try:
        resolved = root.resolve(strict=True)
    except OSError as error:
        raise AdmissionFailure("repository_root_invalid") from error
    if resolved != root or not root.is_dir():
        raise AdmissionFailure("repository_root_invalid")
    return root


def _decode_line(payload: bytes, reason: str) -> str:
    try:
        value = payload.decode("utf-8").removesuffix("\n")
    except UnicodeDecodeError as error:
        raise AdmissionFailure(reason) from error
    if not value or "\n" in value or "\r" in value:
        raise AdmissionFailure(reason)
    return value


def _validate_expectation(expectation: object) -> RepoExpectation:
    if not isinstance(expectation, RepoExpectation):
        raise AdmissionFailure("repository_expectation_invalid")
    if expectation.role not in REPOSITORY_ROLES:
        raise AdmissionFailure("repository_role_set_mismatch")
    if _HEX40.fullmatch(expectation.commit) is None:
        raise AdmissionFailure("repository_commit_invalid")
    if _HEX40.fullmatch(expectation.tree) is None:
        raise AdmissionFailure("repository_tree_invalid")
    _validated_root(expectation.root)
    return expectation


def observe_exact_tuple(
    expectations: Sequence[RepoExpectation], *, git: GitReader = _default_git
) -> tuple[RepositoryObservation, ...]:
    """Observe exactly Suite, SOC, Cyber AI and Tool Fabric at clean pins."""

    items = tuple(_validate_expectation(item) for item in expectations)
    if (
        len(items) != len(REPOSITORY_ROLES)
        or tuple(item.role for item in items) != REPOSITORY_ROLES
    ):
        raise AdmissionFailure("repository_role_set_mismatch")
    if len({item.root for item in items}) != len(items):
        raise AdmissionFailure("repository_root_reused")

    observations: list[RepositoryObservation] = []
    for item in items:
        top_level = _decode_line(
            git(item.root, ("rev-parse", "--show-toplevel")),
            "repository_top_level_invalid",
        )
        if top_level != str(item.root):
            raise AdmissionFailure("repository_top_level_mismatch")
        commit = _decode_line(
            git(item.root, ("rev-parse", "HEAD^{commit}")),
            "repository_commit_invalid",
        )
        tree = _decode_line(
            git(item.root, ("rev-parse", "HEAD^{tree}")),
            "repository_tree_invalid",
        )
        if commit != item.commit:
            raise AdmissionFailure("repository_commit_mismatch")
        if tree != item.tree:
            raise AdmissionFailure("repository_tree_mismatch")
        if git(item.root, ("status", "--porcelain=v1", "--untracked-files=all")):
            raise AdmissionFailure("repository_not_clean")
        observations.append(
            RepositoryObservation(
                role=item.role,
                root=item.root,
                commit=commit,
                tree=tree,
            )
        )
    return tuple(observations)


def _validated_allowlist_path(value: object) -> str:
    if not isinstance(value, str) or not value or "\x00" in value:
        raise AdmissionFailure("allowlist_path_invalid")
    path = PurePosixPath(value)
    if (
        path.is_absolute()
        or path.as_posix() != value
        or any(part in ("", ".", "..", ".git") for part in path.parts)
    ):
        raise AdmissionFailure("allowlist_path_invalid")
    return value


def _tracked_blob(
    observation: RepositoryObservation, relative: str, git: GitReader
) -> bytes:
    listing = git(observation.root, ("ls-tree", "-z", "HEAD", "--", relative))
    try:
        entry = listing.decode("utf-8")
    except UnicodeDecodeError as error:
        raise AdmissionFailure("allowlisted_blob_invalid") from error
    if not entry.endswith("\x00") or entry.count("\x00") != 1:
        raise AdmissionFailure("allowlisted_blob_invalid")
    metadata, separator, observed_path = entry[:-1].partition("\t")
    fields = metadata.split(" ")
    if separator != "\t" or observed_path != relative or len(fields) != 3:
        raise AdmissionFailure("allowlisted_blob_invalid")
    mode, kind, object_id = fields
    if kind != "blob" or mode not in ("100644", "100755"):
        raise AdmissionFailure("allowlisted_blob_invalid")
    if re.fullmatch(r"[0-9a-f]{40,64}", object_id) is None:
        raise AdmissionFailure("allowlisted_blob_invalid")
    return git(observation.root, ("cat-file", "blob", f"HEAD:{relative}"))


def tracked_blob_aggregate(
    observations: Sequence[RepositoryObservation],
    allowlist: Mapping[str, Sequence[str]],
    *,
    git: GitReader = _default_git,
) -> TrackedBlobAggregate:
    """Hash only the exact allowlisted blobs at the observed commits."""

    items = tuple(observations)
    if tuple(item.role for item in items) != REPOSITORY_ROLES:
        raise AdmissionFailure("repository_role_set_mismatch")
    if frozenset(allowlist) != frozenset(REPOSITORY_ROLES):
        raise AdmissionFailure("allowlist_role_set_mismatch")

    lines: list[bytes] = []
    for observation in items:
        raw_paths = tuple(allowlist[observation.role])
        paths = tuple(_validated_allowlist_path(path) for path in raw_paths)
        if not paths or tuple(sorted(set(paths))) != paths:
            raise AdmissionFailure("allowlist_paths_not_unique_sorted")
        for relative in paths:
            blob_sha256 = hashlib.sha256(
                _tracked_blob(observation, relative, git)
            ).hexdigest()
            lines.append(f"{observation.role}\t{relative}\t{blob_sha256}\n".encode())
    framed = TRACKED_BLOB_ALGORITHM.encode("ascii") + b"\n" + b"".join(lines)
    return TrackedBlobAggregate(
        algorithm=TRACKED_BLOB_ALGORITHM,
        file_count=len(lines),
        sha256=hashlib.sha256(framed).hexdigest(),
    )


def _read_external_file(path: object) -> bytes:
    if not isinstance(path, Path) or not path.is_absolute():
        raise AdmissionFailure("external_file_path_invalid")
    try:
        resolved = path.resolve(strict=True)
    except OSError as error:
        raise AdmissionFailure("external_file_invalid") from error
    if resolved != path:
        raise AdmissionFailure("external_file_invalid")
    no_follow = getattr(os, "O_NOFOLLOW", 0)
    close_on_exec = getattr(os, "O_CLOEXEC", 0)
    if not no_follow or not close_on_exec:
        raise AdmissionFailure("external_file_primitives_unavailable")
    try:
        descriptor = os.open(path, os.O_RDONLY | no_follow | close_on_exec)
    except OSError as error:
        raise AdmissionFailure("external_file_invalid") from error
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
            raise AdmissionFailure("external_file_invalid")
        if (
            before.st_uid != os.geteuid()
            or stat.S_IMODE(before.st_mode) != EXTERNAL_FILE_MODE
        ):
            raise AdmissionFailure("external_file_mode_invalid")
        if before.st_size <= 0 or before.st_size > MAX_EXTERNAL_FILE_BYTES:
            raise AdmissionFailure("external_file_size_invalid")
        chunks: list[bytes] = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(descriptor, min(remaining, 64 * 1024))
            if not chunk:
                raise AdmissionFailure("external_file_changed")
            chunks.append(chunk)
            remaining -= len(chunk)
        if os.read(descriptor, 1):
            raise AdmissionFailure("external_file_changed")
        after = os.fstat(descriptor)
        identity_fields = (
            "st_dev",
            "st_ino",
            "st_uid",
            "st_mode",
            "st_nlink",
            "st_size",
            "st_mtime_ns",
            "st_ctime_ns",
        )
        if any(
            getattr(before, field) != getattr(after, field) for field in identity_fields
        ):
            raise AdmissionFailure("external_file_changed")
        if path.resolve(strict=True) != path:
            raise AdmissionFailure("external_file_changed")
        return b"".join(chunks)
    except OSError as error:
        raise AdmissionFailure("external_file_changed") from error
    finally:
        os.close(descriptor)


def _parse_timestamp(value: object) -> datetime:
    if not isinstance(value, str):
        raise AdmissionFailure("authorization_timestamp_invalid")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as error:
        raise AdmissionFailure("authorization_timestamp_invalid") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise AdmissionFailure("authorization_timestamp_invalid")
    return parsed.astimezone(UTC)


def _validated_now(value: object) -> datetime:
    if (
        not isinstance(value, datetime)
        or value.tzinfo is None
        or value.utcoffset() is None
    ):
        raise AdmissionFailure("authorization_clock_invalid")
    return value.astimezone(UTC)


def _canonical_json_object(payload: bytes) -> dict[str, object]:
    try:
        parsed = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AdmissionFailure("authorization_json_invalid") from error
    if not isinstance(parsed, dict) or frozenset(parsed) != _TOP_LEVEL_FIELDS:
        raise AdmissionFailure("authorization_fields_invalid")
    canonical = json.dumps(parsed, sort_keys=True, separators=(",", ":")).encode()
    if canonical != payload:
        raise AdmissionFailure("authorization_not_canonical")
    return parsed


def _tuple_record(
    observations: Sequence[RepositoryObservation],
) -> dict[str, dict[str, str]]:
    return {
        item.role: {"commit": item.commit, "tree": item.tree} for item in observations
    }


def admit_external_authorization(
    *,
    authorization_path: Path,
    signature_path: Path,
    observations: Sequence[RepositoryObservation],
    aggregate: TrackedBlobAggregate,
    verifier: SignatureVerifier,
    now: datetime,
) -> ExternalAuthorization:
    """Validate a detached external approval for the exact observed tuple."""

    payload = _read_external_file(authorization_path)
    signature = _read_external_file(signature_path)
    try:
        signer_identity = verifier(payload, signature)
    except Exception as error:
        raise AdmissionFailure("authorization_signature_invalid") from error
    if (
        not isinstance(signer_identity, str)
        or _SIGNER_IDENTITY.fullmatch(signer_identity) is None
    ):
        raise AdmissionFailure("authorization_signature_invalid")
    record = _canonical_json_object(payload)
    if (
        record["schema"] != AUTHORIZATION_SCHEMA
        or record["decision"] != "APPROVE"
        or record["one_shot"] is not True
    ):
        raise AdmissionFailure("authorization_policy_invalid")
    if record["authorized_by"] != signer_identity:
        raise AdmissionFailure("authorization_signature_invalid")
    authorization_id = record["authorization_id"]
    if (
        not isinstance(authorization_id, str)
        or _AUTHORIZATION_ID.fullmatch(authorization_id) is None
    ):
        raise AdmissionFailure("authorization_id_invalid")
    issued_at = _parse_timestamp(record["issued_at"])
    expires_at = _parse_timestamp(record["expires_at"])
    current = _validated_now(now)
    if (
        issued_at > current
        or current >= expires_at
        or expires_at <= issued_at
        or expires_at - issued_at > MAX_AUTHORIZATION_WINDOW
    ):
        raise AdmissionFailure("authorization_not_current")
    items = tuple(observations)
    if record["tuple"] != _tuple_record(items):
        raise AdmissionFailure("authorization_tuple_mismatch")
    expected_aggregate = {
        "algorithm": aggregate.algorithm,
        "file_count": aggregate.file_count,
        "sha256": aggregate.sha256,
    }
    if record["tracked_blob_aggregate"] != expected_aggregate:
        raise AdmissionFailure("authorization_aggregate_mismatch")
    return ExternalAuthorization(
        authorization_id=authorization_id,
        authorized_by=signer_identity,
        authorization_sha256=hashlib.sha256(payload).hexdigest(),
        exact=True,
        external=True,
        one_shot=True,
        consumed=False,
        issued_at=issued_at,
        expires_at=expires_at,
        aggregate=aggregate,
        observations=items,
    )


def _validated_state_root(state_root: object, repository_roots: Sequence[Path]) -> Path:
    if not isinstance(state_root, Path) or not state_root.is_absolute():
        raise AdmissionFailure("state_root_invalid")
    try:
        resolved = state_root.resolve(strict=True)
        observed = os.lstat(state_root)
    except OSError as error:
        raise AdmissionFailure("state_root_invalid") from error
    if (
        resolved != state_root
        or not stat.S_ISDIR(observed.st_mode)
        or observed.st_uid != os.geteuid()
        or stat.S_IMODE(observed.st_mode) != STATE_ROOT_MODE
    ):
        raise AdmissionFailure("state_root_invalid")
    for repository_root in repository_roots:
        root = repository_root.resolve(strict=True)
        if state_root == root or state_root.is_relative_to(root):
            raise AdmissionFailure("state_root_inside_repository")
    return state_root


def consume_once(
    authorization: ExternalAuthorization,
    *,
    state_root: Path,
    repository_roots: Sequence[Path],
    allowlist: Mapping[str, Sequence[str]],
    git: GitReader = _default_git,
    now: datetime,
) -> Path:
    """Reobserve and atomically consume one exact admitted approval."""

    if not isinstance(authorization, ExternalAuthorization):
        raise AdmissionFailure("authorization_invalid")
    current = _validated_now(now)
    if current < authorization.issued_at or current >= authorization.expires_at:
        raise AdmissionFailure("authorization_not_current")
    expectations = tuple(
        RepoExpectation(
            role=item.role,
            root=item.root,
            commit=item.commit,
            tree=item.tree,
        )
        for item in authorization.observations
    )
    live_observations = observe_exact_tuple(expectations, git=git)
    live_aggregate = tracked_blob_aggregate(live_observations, allowlist, git=git)
    if live_aggregate != authorization.aggregate:
        raise AdmissionFailure("authorization_revalidation_mismatch")
    root = _validated_state_root(state_root, repository_roots)
    marker = root / f"{authorization.authorization_id}.consumed.json"
    record = {
        "authorization_id": authorization.authorization_id,
        "authorization_sha256": authorization.authorization_sha256,
        "consumed_at": current.isoformat(),
        "schema": AUTHORIZATION_SCHEMA,
        "tracked_blob_aggregate_sha256": authorization.aggregate.sha256,
        "tuple": _tuple_record(authorization.observations),
    }
    payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode()
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(marker, flags, EXTERNAL_FILE_MODE)
    except FileExistsError as error:
        raise AdmissionFailure("authorization_already_consumed") from error
    except OSError as error:
        raise AdmissionFailure("authorization_consumption_failed") from error
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fchmod(stream.fileno(), EXTERNAL_FILE_MODE)
            os.fsync(stream.fileno())
        directory_descriptor = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    except BaseException:
        marker.unlink(missing_ok=True)
        raise
    return marker
