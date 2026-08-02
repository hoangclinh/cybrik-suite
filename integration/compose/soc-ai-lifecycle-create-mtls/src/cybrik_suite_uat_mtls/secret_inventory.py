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
import os
import re
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from . import evidence

EXACT_SECRET_MATCH: Final = "exact_secret_match"
SYMLINK_NOT_PERMITTED: Final = "symlink_not_permitted"
NON_REGULAR_FILE_NOT_PERMITTED: Final = "non_regular_file_not_permitted"
FILE_TOO_LARGE: Final = "file_too_large"

QUARANTINE: Final = "quarantine"
DELETE: Final = "delete"

MAX_SCAN_FILE_BYTES: Final = 8 * 1024 * 1024
MAX_SCAN_TEXT_BYTES: Final = 1 * 1024 * 1024
MAX_SCAN_FILE_COUNT: Final = 4096

_LABEL_PATTERN: Final = re.compile(r"[a-z][a-z0-9_-]{0,127}")
_OPEN_FLAGS: Final = os.O_RDONLY | os.O_NONBLOCK | getattr(os, "O_NOFOLLOW", 0)


class SecretInventoryError(RuntimeError):
    """A secret-inventory operation refused to proceed rather than risk a leak."""


@dataclass(frozen=True, slots=True)
class SecretHandle:
    """A safe receipt for a registered secret: never the raw value."""

    label: str
    digest_sha256: str
    byte_count: int


@dataclass(frozen=True, slots=True)
class ScanFinding:
    """A safe, sanitized record of a detected artifact: never the raw match."""

    relative_path: str
    reason: str
    label: str | None = None


@dataclass(frozen=True, slots=True)
class RemediationPlan:
    """The safe delete/quarantine contract for a single :class:`ScanFinding`."""

    relative_path: str
    action: str
    reason: str
    label: str | None = None


def remediation_plan_for(finding: ScanFinding) -> RemediationPlan:
    action = QUARANTINE if finding.reason == EXACT_SECRET_MATCH else DELETE
    return RemediationPlan(
        relative_path=finding.relative_path,
        action=action,
        reason=finding.reason,
        label=finding.label,
    )


def _bounded_target(root: Path, relative_path: str) -> Path:
    relative = Path(relative_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise SecretInventoryError("remediation target escapes the bounded root")
    resolved_root = root.resolve(strict=True)
    target = resolved_root / relative
    if target.is_symlink():
        raise SecretInventoryError("remediation target must not be a symlink")
    return target


def apply_remediation(
    root: Path,
    finding: ScanFinding,
    *,
    quarantine_root: Path | None = None,
) -> dict[str, object]:
    """Delete or quarantine the finding's artifact and return a sanitized record."""

    target = _bounded_target(root, finding.relative_path)
    plan = remediation_plan_for(finding)
    if plan.action == DELETE:
        target.unlink()
    else:
        destination = (quarantine_root or root.resolve(strict=True) / "quarantine") / (
            finding.relative_path
        )
        destination.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        os.replace(target, destination)
        os.chmod(destination, 0o600)
    record: dict[str, object] = {
        "action": plan.action,
        "reason": plan.reason,
        "relative_path": plan.relative_path,
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

    def _scan_file(self, relative_posix: str, path: Path) -> ScanFinding | None:
        try:
            descriptor = os.open(path, _OPEN_FLAGS)
        except OSError as exc:
            raise SecretInventoryError(
                f"artifact could not be opened safely: {relative_posix}"
            ) from exc
        ownership_transferred = False
        try:
            status = os.fstat(descriptor)
            if not stat.S_ISREG(status.st_mode):
                return ScanFinding(relative_posix, NON_REGULAR_FILE_NOT_PERMITTED)
            if status.st_size > MAX_SCAN_FILE_BYTES:
                return ScanFinding(relative_posix, FILE_TOO_LARGE)
            stream = os.fdopen(descriptor, "rb")
            ownership_transferred = True
        finally:
            if not ownership_transferred:
                os.close(descriptor)
        with stream:
            data = stream.read(MAX_SCAN_FILE_BYTES + 1)
        if len(data) > MAX_SCAN_FILE_BYTES:
            return ScanFinding(relative_posix, FILE_TOO_LARGE)
        label = self._exact_label(data)
        if label is not None:
            return ScanFinding(relative_posix, EXACT_SECRET_MATCH, label)
        reason = evidence.secret_reason(data.decode("utf-8", errors="replace"))
        if reason is not None:
            return ScanFinding(relative_posix, reason)
        return None

    def scan_tree(self, root: Path) -> tuple[ScanFinding, ...]:
        if not root.is_absolute():
            raise SecretInventoryError("scan root must be an absolute path")
        if root.is_symlink():
            raise SecretInventoryError("scan root must not be a symlink")
        resolved_root = root.resolve(strict=True)
        if not resolved_root.is_dir():
            raise SecretInventoryError("scan root must be a directory")

        findings: list[ScanFinding] = []
        scanned = 0
        for path in sorted(resolved_root.rglob("*")):
            relative_posix = path.relative_to(resolved_root).as_posix()
            if path.is_symlink():
                findings.append(ScanFinding(relative_posix, SYMLINK_NOT_PERMITTED))
                continue
            if path.is_dir():
                continue
            scanned += 1
            if scanned > MAX_SCAN_FILE_COUNT:
                raise SecretInventoryError(
                    "bounded artifact tree scan exceeded the file-count bound"
                )
            finding = self._scan_file(relative_posix, path)
            if finding is not None:
                findings.append(finding)
        return tuple(findings)
