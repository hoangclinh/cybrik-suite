"""Runtime-memory-only exact secret inventory for D2 N10 support.

The inventory lets a caller register raw runtime secret values -- the
delegation token, the ``cnf`` thumbprint, the ephemeral PostgreSQL DSN
password, private-key bytes/text -- and then scan arbitrary text, bytes or a
bounded artifact tree for those exact values plus the generic classifiers in
:mod:`cybrik_suite_uat_mtls.evidence`. Registered values live only in process
memory: nothing here writes, logs, serializes or reprs a raw secret. Only
stable labels, counts and digests ever leave the inventory. Every scan and
remediation helper is pure local file handling; nothing here opens a socket,
starts a subprocess, or touches Docker, a database or PKI material.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import stat
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from . import evidence

EXACT_SECRET_MATCH: Final = "exact_secret_match"
SYMLINK_NOT_PERMITTED: Final = "symlink_not_permitted"
NON_REGULAR_FILE_NOT_PERMITTED: Final = "non_regular_file_not_permitted"
FILE_TOO_LARGE: Final = "file_too_large"

DELETE: Final = "delete"

MAX_SCAN_FILE_BYTES: Final = 8 * 1024 * 1024
MAX_SCAN_TEXT_BYTES: Final = 1 * 1024 * 1024
MAX_SCAN_FILE_COUNT: Final = 4096

_LABEL_PATTERN: Final = re.compile(r"[a-z][a-z0-9_-]{0,127}")
_OPEN_FLAGS: Final = os.O_RDONLY | os.O_NONBLOCK | getattr(os, "O_NOFOLLOW", 0)
_DIRECTORY_OPEN_FLAGS: Final = (
    _OPEN_FLAGS | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_CLOEXEC", 0)
)


class SecretInventoryError(RuntimeError):
    """A secret-inventory operation refused to proceed rather than risk a leak."""


@dataclass(frozen=True, slots=True)
class SecretHandle:
    """A safe receipt for a registered secret: never the raw value."""

    label: str
    digest_sha256: str
    byte_count: int


class _ArtifactLocator:
    """Private path capability whose repr never exposes its components."""

    __slots__ = ("_parts", "_sealed", "artifact_id")

    def __init__(
        self, relative_path: str, *, artifact_id_key: bytes | None = None
    ) -> None:
        parts = _bounded_parts(relative_path)
        key = secrets.token_bytes(32) if artifact_id_key is None else artifact_id_key
        if len(key) != 32:
            raise SecretInventoryError("artifact-id key shape is invalid")
        canonical = os.fsencode("/".join(parts))
        object.__setattr__(self, "_parts", parts)
        object.__setattr__(
            self,
            "artifact_id",
            hmac.new(key, canonical, hashlib.sha256).hexdigest(),
        )
        object.__setattr__(self, "_sealed", True)

    def __setattr__(self, _name: str, _value: object) -> None:
        if getattr(self, "_sealed", False):
            raise AttributeError("artifact locator capabilities are immutable")
        object.__setattr__(self, _name, _value)

    def __delattr__(self, _name: str) -> None:
        raise AttributeError("artifact locator capabilities are immutable")

    def __repr__(self) -> str:
        return f"<_ArtifactLocator artifact_id={self.artifact_id}>"

    def __deepcopy__(self, _memo: dict[int, object]) -> _ArtifactLocator:
        raise TypeError("artifact locator capabilities cannot be copied")

    def __reduce__(self) -> object:
        raise TypeError("artifact locator capabilities cannot be serialized")

    def __reduce_ex__(self, _protocol: int) -> object:
        raise TypeError("artifact locator capabilities cannot be serialized")


def _entry_identity(status: os.stat_result) -> tuple[int, int, int]:
    return (status.st_dev, status.st_ino, stat.S_IFMT(status.st_mode))


class ScanFinding:
    """A safe public finding plus a private, non-serializable path capability."""

    __slots__ = (
        "_expected_identity",
        "_locator",
        "_sealed",
        "artifact_id",
        "label",
        "reason",
    )

    def __init__(
        self,
        relative_path: str,
        reason: str,
        label: str | None = None,
        *,
        _expected_status: os.stat_result | None = None,
    ) -> None:
        locator = _ArtifactLocator(relative_path)
        object.__setattr__(self, "artifact_id", locator.artifact_id)
        object.__setattr__(self, "reason", reason)
        object.__setattr__(self, "label", label)
        object.__setattr__(self, "_locator", locator)
        object.__setattr__(
            self,
            "_expected_identity",
            _entry_identity(_expected_status) if _expected_status is not None else None,
        )
        object.__setattr__(self, "_sealed", True)

    @classmethod
    def _from_locator(
        cls,
        locator: _ArtifactLocator,
        reason: str,
        label: str | None,
        status: os.stat_result,
    ) -> ScanFinding:
        finding = object.__new__(cls)
        object.__setattr__(finding, "artifact_id", locator.artifact_id)
        object.__setattr__(finding, "reason", reason)
        object.__setattr__(finding, "label", label)
        object.__setattr__(finding, "_locator", locator)
        object.__setattr__(finding, "_expected_identity", _entry_identity(status))
        object.__setattr__(finding, "_sealed", True)
        return finding

    def __setattr__(self, _name: str, _value: object) -> None:
        if getattr(self, "_sealed", False):
            raise AttributeError("scan findings are immutable")
        object.__setattr__(self, _name, _value)

    def __delattr__(self, _name: str) -> None:
        raise AttributeError("scan findings are immutable")

    def __repr__(self) -> str:
        return (
            "ScanFinding("
            f"artifact_id={self.artifact_id!r}, reason={self.reason!r}, "
            f"label={self.label!r})"
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, ScanFinding):
            return NotImplemented
        return (
            self.artifact_id,
            self.reason,
            self.label,
            self._expected_identity,
        ) == (
            other.artifact_id,
            other.reason,
            other.label,
            other._expected_identity,
        )

    def __hash__(self) -> int:
        return hash(
            (
                self.artifact_id,
                self.reason,
                self.label,
                self._expected_identity,
            )
        )

    def __deepcopy__(self, _memo: dict[int, object]) -> ScanFinding:
        raise TypeError("scan findings containing path capabilities cannot be copied")

    def __reduce__(self) -> object:
        raise TypeError(
            "scan findings containing path capabilities cannot be serialized"
        )

    def __reduce_ex__(self, _protocol: int) -> object:
        raise TypeError(
            "scan findings containing path capabilities cannot be serialized"
        )


@dataclass(frozen=True, slots=True)
class RemediationPlan:
    """The safe delete contract for a single :class:`ScanFinding`."""

    artifact_id: str
    action: str
    reason: str
    label: str | None = None


def remediation_plan_for(finding: ScanFinding) -> RemediationPlan:
    return RemediationPlan(
        artifact_id=finding.artifact_id,
        action=DELETE,
        reason=finding.reason,
        label=finding.label,
    )


def _bounded_parts(relative_path: str) -> tuple[str, ...]:
    if "\x00" in relative_path:
        raise SecretInventoryError(
            "remediation target contains an invalid path component"
        )
    relative = Path(relative_path)
    if (
        not relative_path
        or relative.is_absolute()
        or ".." in relative.parts
        or relative.parts in ((), (".",))
    ):
        raise SecretInventoryError("remediation target escapes the bounded root")
    return relative.parts


def _stat_no_follow(name: str, *, dir_fd: int) -> os.stat_result:
    try:
        result = os.stat(name, dir_fd=dir_fd, follow_symlinks=False)
    except OSError:
        result = None
    if result is None:
        raise SecretInventoryError("artifact could not be inspected safely")
    return result


def _fstat_safely(descriptor: int) -> os.stat_result:
    try:
        result = os.fstat(descriptor)
    except OSError:
        result = None
    if result is None:
        raise SecretInventoryError("artifact descriptor could not be inspected safely")
    return result


def _same_inode(left: os.stat_result, right: os.stat_result) -> bool:
    return (left.st_dev, left.st_ino) == (right.st_dev, right.st_ino)


@contextmanager
def _bounded_parent_descriptor(
    root: Path, locator: _ArtifactLocator
) -> Iterator[tuple[int, str]]:
    """Yield the target's parent descriptor after a no-follow root walk.

    Every pathname component is opened relative to the already-open parent.
    The descriptor chain pins the directories reached beneath ``root`` and
    prevents a symlink or pathname rebind from redirecting the final unlink.
    """

    if not root.is_absolute():
        raise SecretInventoryError("remediation root must be an absolute path")
    parts = locator._parts
    try:
        root_status = root.lstat()
    except OSError:
        root_status = None
    if root_status is None:
        raise SecretInventoryError("remediation root could not be inspected safely")
    if stat.S_ISLNK(root_status.st_mode):
        raise SecretInventoryError("remediation path must not contain a symlink")
    if not stat.S_ISDIR(root_status.st_mode):
        raise SecretInventoryError("remediation root must be a directory")

    descriptors: list[int] = []
    try:
        try:
            current = os.open(root, _DIRECTORY_OPEN_FLAGS)
        except OSError:
            current = None
        if current is None:
            raise SecretInventoryError("remediation root could not be opened safely")
        descriptors.append(current)
        if not _same_inode(root_status, _fstat_safely(current)):
            raise SecretInventoryError("remediation root changed during safe traversal")

        for component in parts[:-1]:
            before = _stat_no_follow(component, dir_fd=current)
            if stat.S_ISLNK(before.st_mode):
                raise SecretInventoryError(
                    "remediation path must not contain a symlink"
                )
            if not stat.S_ISDIR(before.st_mode):
                raise SecretInventoryError(
                    "remediation path parent must be a directory"
                )
            try:
                child = os.open(component, _DIRECTORY_OPEN_FLAGS, dir_fd=current)
            except OSError:
                child = None
            if child is None:
                raise SecretInventoryError(
                    "remediation path parent could not be opened safely"
                )
            descriptors.append(child)
            if not _same_inode(before, _fstat_safely(child)):
                raise SecretInventoryError(
                    "remediation path changed during safe traversal"
                )
            current = child

        yield current, parts[-1]
    finally:
        for descriptor in reversed(descriptors):
            os.close(descriptor)


def apply_remediation(
    root: Path,
    finding: ScanFinding,
) -> dict[str, object]:
    """Delete the finding's artifact and return a sanitized record.

    Secret-bearing artifacts are never quarantined.  Deletion is
    descriptor-relative, binds scanner-generated findings to the scanned
    inode/type and never follows a symlink leaf.
    """

    plan = remediation_plan_for(finding)
    with _bounded_parent_descriptor(root, finding._locator) as (parent_fd, leaf):
        before = _stat_no_follow(leaf, dir_fd=parent_fd)
        if (
            finding._expected_identity is not None
            and _entry_identity(before) != finding._expected_identity
        ):
            raise SecretInventoryError("remediation target changed after scanning")

        scanner_bound = finding._expected_identity is not None
        is_symlink = stat.S_ISLNK(before.st_mode)
        is_directory = stat.S_ISDIR(before.st_mode)
        is_regular = stat.S_ISREG(before.st_mode)
        if not scanner_bound:
            if is_symlink and finding.reason != SYMLINK_NOT_PERMITTED:
                raise SecretInventoryError("remediation target must not be a symlink")
            if finding.reason == SYMLINK_NOT_PERMITTED and not is_symlink:
                raise SecretInventoryError("remediation target type changed")
            if finding.reason == NON_REGULAR_FILE_NOT_PERMITTED and (
                is_symlink or is_directory or is_regular
            ):
                raise SecretInventoryError("remediation target type changed")
            if finding.reason not in (
                SYMLINK_NOT_PERMITTED,
                NON_REGULAR_FILE_NOT_PERMITTED,
            ) and not (is_regular or is_directory):
                raise SecretInventoryError("remediation target type is not permitted")

        descriptor: int | None = None
        if is_regular:
            try:
                descriptor = os.open(leaf, _OPEN_FLAGS, dir_fd=parent_fd)
            except OSError:
                descriptor = None
            if descriptor is None:
                raise SecretInventoryError(
                    "remediation target could not be opened safely"
                )
        elif is_directory:
            try:
                descriptor = os.open(leaf, _DIRECTORY_OPEN_FLAGS, dir_fd=parent_fd)
            except OSError:
                descriptor = None
            if descriptor is None:
                raise SecretInventoryError(
                    "remediation target could not be opened safely"
                )
        try:
            if descriptor is not None and not _same_inode(
                before, _fstat_safely(descriptor)
            ):
                raise SecretInventoryError(
                    "remediation target changed during safe traversal"
                )

            current = _stat_no_follow(leaf, dir_fd=parent_fd)
            if not _same_inode(before, current):
                raise SecretInventoryError(
                    "remediation target changed during safe traversal"
                )

            delete_failed = False
            try:
                if is_directory:
                    os.rmdir(leaf, dir_fd=parent_fd)
                else:
                    # POSIX has no compare-and-unlink primitive.  A replacement
                    # made after the final identity check may itself be removed,
                    # but ``dir_fd`` pins the already-validated parent inode and
                    # unlink never follows a symlink leaf, so it cannot escape.
                    os.unlink(leaf, dir_fd=parent_fd)
            except OSError:
                delete_failed = True
            if delete_failed:
                raise SecretInventoryError(
                    "remediation target could not be deleted safely"
                )
        finally:
            if descriptor is not None:
                os.close(descriptor)
    record: dict[str, object] = {
        "action": plan.action,
        "reason": plan.reason,
        "artifact_id": plan.artifact_id,
    }
    if plan.label is not None:
        record["label"] = plan.label
    return record


class SecretInventory:
    """A process-memory-only registry of exact runtime secret values."""

    __slots__ = ("_order", "_values")

    def __init__(self) -> None:
        self._values: dict[str, bytearray] = {}
        self._order: list[str] = []

    def register(self, label: str, value: str | bytes | bytearray) -> SecretHandle:
        if _LABEL_PATTERN.fullmatch(label) is None:
            raise SecretInventoryError("secret label shape is invalid")
        if label in self._values:
            raise SecretInventoryError("secret label is already registered")
        raw = value.encode("utf-8") if isinstance(value, str) else bytes(value)
        if not raw:
            raise SecretInventoryError("registered secret value must not be empty")
        self._values[label] = bytearray(raw)
        self._order.append(label)
        return SecretHandle(
            label=label,
            digest_sha256=hashlib.sha256(raw).hexdigest(),
            byte_count=len(raw),
        )

    def labels(self) -> tuple[str, ...]:
        return tuple(self._order)

    def summary(self) -> dict[str, object]:
        digests = sorted(
            hashlib.sha256(bytes(self._values[label])).hexdigest()
            for label in self._order
        )
        return {
            "registered_digest_sha256_list": digests,
            "registered_label_count": len(self._order),
        }

    def clear(self) -> None:
        for value in self._values.values():
            for index in range(len(value)):
                value[index] = 0
        self._values.clear()
        self._order.clear()

    def __repr__(self) -> str:
        return f"<SecretInventory label_count={len(self._order)}>"

    __str__ = __repr__

    def _exact_label(self, data: bytes) -> str | None:
        for label in self._order:
            if bytes(self._values[label]) in data:
                return label
        return None

    def scan_bytes(self, data: bytes) -> str | None:
        if len(data) > MAX_SCAN_TEXT_BYTES:
            raise SecretInventoryError("scanned input exceeds the bounded size limit")
        if self._exact_label(data) is not None:
            return EXACT_SECRET_MATCH
        return evidence.secret_reason(data.decode("utf-8", errors="replace"))

    def scan_text(self, text: str) -> str | None:
        return self.scan_bytes(text.encode("utf-8", errors="surrogatepass"))

    def _path_match(self, parts: tuple[str, ...]) -> tuple[str, str | None] | None:
        for component in parts:
            data = os.fsencode(component)
            label = self._exact_label(data)
            if label is not None:
                return EXACT_SECRET_MATCH, label
            reason = evidence.secret_reason(component)
            if reason is not None:
                return reason, None
        return None

    def _scan_file(
        self,
        root: Path,
        locator: _ArtifactLocator,
        expected_status: os.stat_result,
    ) -> ScanFinding | None:
        with _bounded_parent_descriptor(root, locator) as (parent_fd, leaf):
            current = _stat_no_follow(leaf, dir_fd=parent_fd)
            if _entry_identity(current) != _entry_identity(expected_status):
                raise SecretInventoryError("artifact changed during safe scanning")
            try:
                descriptor = os.open(leaf, _OPEN_FLAGS, dir_fd=parent_fd)
            except OSError:
                descriptor = None
        if descriptor is None:
            raise SecretInventoryError("artifact could not be opened safely")
        ownership_transferred = False
        try:
            status = _fstat_safely(descriptor)
            if _entry_identity(status) != _entry_identity(expected_status):
                raise SecretInventoryError("artifact changed during safe scanning")
            if not stat.S_ISREG(status.st_mode):
                return ScanFinding._from_locator(
                    locator, NON_REGULAR_FILE_NOT_PERMITTED, None, status
                )
            if status.st_size > MAX_SCAN_FILE_BYTES:
                return ScanFinding._from_locator(locator, FILE_TOO_LARGE, None, status)
            stream = os.fdopen(descriptor, "rb")
            ownership_transferred = True
        finally:
            if not ownership_transferred:
                os.close(descriptor)
        with stream:
            data = stream.read(MAX_SCAN_FILE_BYTES + 1)
        if len(data) > MAX_SCAN_FILE_BYTES:
            return ScanFinding._from_locator(
                locator, FILE_TOO_LARGE, None, expected_status
            )
        label = self._exact_label(data)
        if label is not None:
            return ScanFinding._from_locator(
                locator, EXACT_SECRET_MATCH, label, expected_status
            )
        reason = evidence.secret_reason(data.decode("utf-8", errors="replace"))
        if reason is not None:
            return ScanFinding._from_locator(locator, reason, None, expected_status)
        return None

    def scan_tree(self, root: Path) -> tuple[ScanFinding, ...]:
        if not root.is_absolute():
            raise SecretInventoryError("scan root must be an absolute path")
        if root.is_symlink():
            raise SecretInventoryError("scan root must not be a symlink")
        try:
            resolved_root = root.resolve(strict=True)
        except OSError:
            resolved_root = None
        if resolved_root is None:
            raise SecretInventoryError("scan root could not be resolved safely")
        if not resolved_root.is_dir():
            raise SecretInventoryError("scan root must be a directory")

        paths_list: list[Path] = []
        try:
            for path in resolved_root.rglob("*"):
                paths_list.append(path)
                if len(paths_list) > MAX_SCAN_FILE_COUNT:
                    raise SecretInventoryError(
                        "bounded artifact tree scan exceeded the file-count bound"
                    )
        except OSError:
            paths_list = []
            enumeration_failed = True
        else:
            enumeration_failed = False
        if enumeration_failed:
            raise SecretInventoryError("artifact tree could not be enumerated safely")

        findings: list[ScanFinding] = []
        ordered_paths = sorted(
            paths_list,
            key=lambda path: (
                -len(path.relative_to(resolved_root).parts),
                path.relative_to(resolved_root).as_posix(),
            ),
        )
        artifact_id_key = secrets.token_bytes(32)
        for path in ordered_paths:
            relative_posix = path.relative_to(resolved_root).as_posix()
            locator = _ArtifactLocator(relative_posix, artifact_id_key=artifact_id_key)
            with _bounded_parent_descriptor(resolved_root, locator) as (
                parent_fd,
                leaf,
            ):
                status = _stat_no_follow(leaf, dir_fd=parent_fd)
            path_match = self._path_match(locator._parts)
            if path_match is not None:
                reason, label = path_match
                findings.append(
                    ScanFinding._from_locator(locator, reason, label, status)
                )
                continue
            if stat.S_ISLNK(status.st_mode):
                findings.append(
                    ScanFinding._from_locator(
                        locator, SYMLINK_NOT_PERMITTED, None, status
                    )
                )
                continue
            if stat.S_ISDIR(status.st_mode):
                continue
            if not stat.S_ISREG(status.st_mode):
                finding = ScanFinding._from_locator(
                    locator, NON_REGULAR_FILE_NOT_PERMITTED, None, status
                )
            else:
                finding = self._scan_file(resolved_root, locator, status)
            if finding is not None:
                findings.append(finding)
        return tuple(findings)
