"""External, secret-free evidence writer for the bounded local UAT.

Status: UAT-ONLY / NOT PRODUCTION. Importing this module is inert. It neither
creates an evidence root nor performs runtime orchestration. Callers must hand
it one pre-created, mode-0700, outside-repository root. Every record is written
once as canonical JSON, mode 0600, fsynced, reread, and never overwritten.
"""

from __future__ import annotations

import errno
import hashlib
import json
import math
import os
import re
import stat
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final

EVIDENCE_ROOT_PREFIX: Final = "cybrik-uat-soc-ai-fabric-evidence-"
EVIDENCE_ROOT_MODE: Final = 0o700
EVIDENCE_FILE_MODE: Final = 0o600
MAX_DEPTH: Final = 8
MAX_ITEMS: Final = 2048
MAX_TEXT: Final = 4096
MAX_RECORD_BYTES: Final = 1024 * 1024

_FILENAME = re.compile(r"[0-9]{2}-[a-z0-9][a-z0-9-]{0,95}\.json")
_KEY = re.compile(r"[a-z][a-z0-9_]{0,127}")
_HEX64 = re.compile(r"[0-9a-f]{64}")
_JWT = re.compile(
    r"(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\."
    r"[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])"
)
_BEARER = re.compile(r"\bbearer[ \t]+\S+", re.IGNORECASE)
_AUTHORIZATION = re.compile(r"\bauthorization\s*[:=]", re.IGNORECASE)
_PRIVATE_PEM = re.compile(
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", re.IGNORECASE
)
_ANY_PEM = re.compile(r"-----BEGIN [A-Z0-9 ]+-----", re.IGNORECASE)
_CREDENTIALED_URI = re.compile(
    r"\b[a-z][a-z0-9+.-]*://[^\s/@:]+:[^\s@]+@", re.IGNORECASE
)
_INLINE_SECRET = re.compile(
    r"(?:^|[\s;,?&])(?:password|passwd|pwd|client_secret|api_key|token|cnf)\s*[:=]",
    re.IGNORECASE,
)
_SECRET_KEY_PARTS: Final = frozenset(
    {
        "authorization",
        "bearer",
        "certificate",
        "cnf",
        "credential",
        "dsn",
        "jwt",
        "password",
        "passwd",
        "private",
        "secret",
        "token",
    }
)
_SAFE_KEYS: Final = frozenset(
    {
        "authorization_id",
        "authorization_sha256",
        "certificate_sha256",
        "private_material_absent",
        "source_tuple_sha256",
        "terminal_sha256",
    }
)
_SUITE_REPOSITORY_ROOT: Final = Path(__file__).resolve().parents[5]


class EvidenceError(RuntimeError):
    """Stable refusal that retains neither rejected content nor a filesystem path."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class EvidenceArtifact:
    filename: str
    sha256: str
    size_bytes: int


def _secret_key(key: str) -> bool:
    if key in _SAFE_KEYS or key.endswith("_sha256"):
        return False
    parts = frozenset(part for part in key.casefold().split("_") if part)
    flattened = key.casefold().replace("_", "")
    return bool(parts & _SECRET_KEY_PARTS) or any(
        word in flattened
        for word in ("privatekey", "clientsecret", "apikey", "connectionstring")
    )


def _validate_text(value: str) -> str:
    if len(value) > MAX_TEXT:
        raise EvidenceError("evidence_text_too_long")
    if _BEARER.search(value) or _AUTHORIZATION.search(value):
        raise EvidenceError("authorization_material_rejected")
    if _PRIVATE_PEM.search(value) or _ANY_PEM.search(value):
        raise EvidenceError("pem_material_rejected")
    if _JWT.search(value):
        raise EvidenceError("jwt_material_rejected")
    if _CREDENTIALED_URI.search(value) or _INLINE_SECRET.search(value):
        raise EvidenceError("credential_material_rejected")
    return value


def _validated(value: object, *, depth: int = 0) -> object:
    if depth > MAX_DEPTH:
        raise EvidenceError("evidence_depth_exceeded")
    if isinstance(value, Mapping):
        if len(value) > MAX_ITEMS:
            raise EvidenceError("evidence_container_too_large")
        result: dict[str, object] = {}
        folded: set[str] = set()
        for key, child in sorted(value.items(), key=lambda item: str(item[0])):
            if not isinstance(key, str) or _KEY.fullmatch(key) is None:
                raise EvidenceError("evidence_key_invalid")
            canonical = key.casefold()
            if canonical in folded:
                raise EvidenceError("evidence_key_ambiguous")
            folded.add(canonical)
            if _secret_key(key):
                raise EvidenceError("secret_bearing_key_rejected")
            if key.endswith("_sha256") and (
                not isinstance(child, str) or _HEX64.fullmatch(child) is None
            ):
                raise EvidenceError("evidence_digest_invalid")
            result[key] = _validated(child, depth=depth + 1)
        return result
    if isinstance(value, (list, tuple)):
        if len(value) > MAX_ITEMS:
            raise EvidenceError("evidence_container_too_large")
        return [_validated(item, depth=depth + 1) for item in value]
    if isinstance(value, (bytes, bytearray, memoryview)):
        raise EvidenceError("binary_evidence_rejected")
    if isinstance(value, str):
        return _validate_text(value)
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, int):
        if value.bit_length() > 256:
            raise EvidenceError("evidence_integer_out_of_range")
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise EvidenceError("evidence_number_not_finite")
        return value
    raise EvidenceError("evidence_type_rejected")


def _canonical(value: object) -> bytes:
    validated = _validated(value)
    try:
        payload = (
            json.dumps(
                validated,
                allow_nan=False,
                ensure_ascii=True,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
            + b"\n"
        )
    except (TypeError, ValueError, UnicodeError):
        raise EvidenceError("evidence_encoding_failed") from None
    if len(payload) > MAX_RECORD_BYTES:
        raise EvidenceError("evidence_record_too_large")
    return payload


class EvidenceWriter:
    """Descriptor-bound, no-overwrite writer for one prepared external root."""

    def __init__(self, root: Path, *, repository_roots: tuple[Path, ...]) -> None:
        if (
            not isinstance(root, Path)
            or not root.is_absolute()
            or not root.name.startswith(EVIDENCE_ROOT_PREFIX)
            or root.is_symlink()
        ):
            raise EvidenceError("evidence_root_invalid")
        try:
            resolved = root.resolve(strict=True)
            metadata = root.stat()
        except OSError:
            raise EvidenceError("evidence_root_invalid") from None
        if not isinstance(repository_roots, tuple):
            raise EvidenceError("evidence_repository_root_invalid")
        bound_repositories: list[tuple[Path, tuple[int, int, int]]] = []
        seen: set[Path] = set()
        for repository_root in (_SUITE_REPOSITORY_ROOT, *repository_roots):
            if (
                not isinstance(repository_root, Path)
                or not repository_root.is_absolute()
                or repository_root.is_symlink()
            ):
                raise EvidenceError("evidence_repository_root_invalid")
            try:
                repository_resolved = repository_root.resolve(strict=True)
                repository_metadata = repository_root.stat()
            except OSError:
                raise EvidenceError("evidence_repository_root_invalid") from None
            if repository_resolved != repository_root or not stat.S_ISDIR(
                repository_metadata.st_mode
            ):
                raise EvidenceError("evidence_repository_root_invalid")
            if resolved == repository_root or resolved.is_relative_to(repository_root):
                raise EvidenceError("evidence_root_invalid")
            if repository_root not in seen:
                seen.add(repository_root)
                bound_repositories.append(
                    (
                        repository_root,
                        (
                            repository_metadata.st_dev,
                            repository_metadata.st_ino,
                            repository_metadata.st_uid,
                        ),
                    )
                )
        if (
            resolved != root
            or not stat.S_ISDIR(metadata.st_mode)
            or stat.S_IMODE(metadata.st_mode) != EVIDENCE_ROOT_MODE
            or metadata.st_uid != os.getuid()
        ):
            raise EvidenceError("evidence_root_invalid")
        self._root = root
        self._identity = (metadata.st_dev, metadata.st_ino, metadata.st_uid)
        self._repositories = tuple(bound_repositories)

    def _verify_repositories(self) -> None:
        flags = (
            os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
        )
        for path, identity in self._repositories:
            try:
                descriptor = os.open(path, flags)
                try:
                    metadata = os.fstat(descriptor)
                finally:
                    os.close(descriptor)
            except OSError:
                raise EvidenceError("evidence_repository_transition_failed") from None
            if (
                not stat.S_ISDIR(metadata.st_mode)
                or (metadata.st_dev, metadata.st_ino, metadata.st_uid) != identity
            ):
                raise EvidenceError("evidence_repository_transition_failed")

    def _open_root(self) -> int:
        self._verify_repositories()
        flags = (
            os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
        )
        try:
            descriptor = os.open(self._root, flags)
            metadata = os.fstat(descriptor)
        except OSError:
            raise EvidenceError("evidence_root_transition_failed") from None
        if (metadata.st_dev, metadata.st_ino, metadata.st_uid) != self._identity:
            os.close(descriptor)
            raise EvidenceError("evidence_root_identity_changed")
        return descriptor

    def write(self, filename: str, value: object) -> EvidenceArtifact:
        """Write one canonical record exactly once and return its public digest."""

        if not isinstance(filename, str) or _FILENAME.fullmatch(filename) is None:
            raise EvidenceError("evidence_filename_invalid")
        payload = _canonical(value)
        root_fd = self._open_root()
        file_fd: int | None = None
        created = False
        try:
            flags = (
                os.O_RDWR
                | os.O_CREAT
                | os.O_EXCL
                | getattr(os, "O_NOFOLLOW", 0)
                | getattr(os, "O_CLOEXEC", 0)
            )
            try:
                file_fd = os.open(filename, flags, EVIDENCE_FILE_MODE, dir_fd=root_fd)
                created = True
            except FileExistsError:
                raise EvidenceError("evidence_already_exists") from None
            metadata = os.fstat(file_fd)
            if (
                not stat.S_ISREG(metadata.st_mode)
                or metadata.st_nlink != 1
                or stat.S_IMODE(metadata.st_mode) != EVIDENCE_FILE_MODE
            ):
                raise EvidenceError("evidence_file_invalid")
            view = memoryview(payload)
            while view:
                written = os.write(file_fd, view)
                if written < 1:
                    raise EvidenceError("evidence_write_failed")
                view = view[written:]
            os.fsync(file_fd)
            os.lseek(file_fd, 0, os.SEEK_SET)
            persisted = b""
            while len(persisted) < len(payload):
                chunk = os.read(file_fd, len(payload) - len(persisted))
                if not chunk:
                    break
                persisted += chunk
            if persisted != payload:
                raise EvidenceError("evidence_read_after_write_failed")
            os.fsync(root_fd)
            return EvidenceArtifact(
                filename=filename,
                sha256=hashlib.sha256(payload).hexdigest(),
                size_bytes=len(payload),
            )
        except EvidenceError:
            if created:
                try:
                    os.unlink(filename, dir_fd=root_fd)
                except OSError:
                    pass
            raise
        except OSError as error:
            reason = (
                "evidence_already_exists"
                if error.errno == errno.EEXIST
                else "evidence_write_failed"
            )
            if created:
                try:
                    os.unlink(filename, dir_fd=root_fd)
                except OSError:
                    pass
            raise EvidenceError(reason) from None
        finally:
            if file_fd is not None:
                os.close(file_fd)
            os.close(root_fd)


__all__ = ["EvidenceArtifact", "EvidenceError", "EvidenceWriter"]
