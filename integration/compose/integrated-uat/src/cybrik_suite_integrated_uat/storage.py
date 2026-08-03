"""Exclusive durable marker and seal storage for one master attempt."""

from __future__ import annotations

import hashlib
import os
import stat
from pathlib import Path

from .models import (
    EXPECTED_EXTERNAL_CAPABILITIES,
    EXPECTED_REPOSITORIES,
    ExternalRootBinding,
    MasterAuthorization,
    TerminalSeal,
    canonical_json_bytes,
)

CONSUMPTION_MARKER = ".cybrik-integrated-uat-consumed.json"
TERMINAL_SEAL = "combined-terminal-seal.json"
PENDING_TERMINAL_SEAL = ".combined-terminal-seal.pending"


class StorageFailure(Exception):
    """Stable storage failure with no caller-controlled detail."""


def _fail(reason: str) -> None:
    raise StorageFailure(reason)


def _readback(path: Path, expected: bytes) -> None:
    descriptor = -1
    try:
        descriptor = os.open(
            path,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
        )
        identity = os.fstat(descriptor)
        chunks: list[bytes] = []
        remaining = len(expected) + 1
        while remaining > 0:
            chunk = os.read(descriptor, remaining)
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        actual = b"".join(chunks)
    except OSError:
        _fail("evidence_write_failed")
    finally:
        if descriptor >= 0:
            os.close(descriptor)
    if (
        not stat.S_ISREG(identity.st_mode)
        or stat.S_IMODE(identity.st_mode) != 0o600
        or identity.st_uid != os.getuid()
        or identity.st_nlink != 1
        or actual != expected
    ):
        _fail("evidence_write_failed")


def _fsync_parent(path: Path) -> None:
    descriptor = -1
    try:
        descriptor = os.open(
            path.parent,
            os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_CLOEXEC", 0),
        )
        os.fsync(descriptor)
    except OSError:
        _fail("evidence_write_failed")
    finally:
        if descriptor >= 0:
            os.close(descriptor)


def _exclusive_json(path: Path, document: object, *, exists_reason: str) -> str:
    payload = canonical_json_bytes(document)
    descriptor = -1
    try:
        descriptor = os.open(
            path,
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_CLOEXEC", 0),
            0o600,
        )
        offset = 0
        while offset < len(payload):
            written = os.write(descriptor, payload[offset:])
            if written <= 0:
                raise OSError("write made no progress")
            offset += written
        os.fchmod(descriptor, 0o600)
        os.fsync(descriptor)
    except FileExistsError:
        _fail(exists_reason)
    except OSError:
        _fail("evidence_write_failed")
    finally:
        if descriptor >= 0:
            os.close(descriptor)
    _fsync_parent(path)
    _readback(path, payload)
    return hashlib.sha256(payload).hexdigest()


def _canonical_directory(path: Path) -> tuple[Path, os.stat_result]:
    descriptor = -1
    try:
        canonical = path.resolve(strict=True)
        if canonical != path:
            _fail("evidence_root_invalid")
        descriptor = os.open(
            path,
            os.O_RDONLY
            | getattr(os, "O_DIRECTORY", 0)
            | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_CLOEXEC", 0),
        )
        identity = os.fstat(descriptor)
        path_identity = path.lstat()
    except OSError:
        _fail("evidence_root_invalid")
    finally:
        if descriptor >= 0:
            os.close(descriptor)
    if (
        not stat.S_ISDIR(identity.st_mode)
        or stat.S_ISLNK(path_identity.st_mode)
        or (identity.st_dev, identity.st_ino)
        != (path_identity.st_dev, path_identity.st_ino)
    ):
        _fail("evidence_root_invalid")
    return canonical, identity


def preflight_paths(authorization: MasterAuthorization) -> None:
    root = authorization.evidence_root
    canonical, identity = _canonical_directory(root)
    if (
        not root.is_absolute()
        or identity.st_uid != os.getuid()
        or stat.S_IMODE(identity.st_mode) != 0o700
    ):
        _fail("evidence_root_invalid")
    if len(authorization.repository_roots) != len(EXPECTED_REPOSITORIES):
        _fail("repository_root_invalid")
    canonical_repository_roots: set[Path] = set()
    for expected_repository, repository_mapping in zip(
        EXPECTED_REPOSITORIES, authorization.repository_roots, strict=True
    ):
        if repository_mapping.repository != expected_repository:
            _fail("repository_root_invalid")
        repository_root = repository_mapping.root
        try:
            repository_canonical = repository_root.resolve(strict=True)
        except OSError:
            _fail("repository_root_invalid")
        if (
            not repository_root.is_absolute()
            or repository_canonical != repository_root
            or not repository_canonical.is_dir()
        ):
            _fail("repository_root_invalid")
        if repository_canonical in canonical_repository_roots:
            _fail("repository_root_duplicate")
        canonical_repository_roots.add(repository_canonical)
        if (
            canonical == repository_canonical
            or repository_canonical in canonical.parents
        ):
            _fail("evidence_root_inside_repository")
        if canonical in repository_canonical.parents:
            _fail("repository_root_inside_evidence")
    if len(authorization.external_roots) != len(EXPECTED_EXTERNAL_CAPABILITIES):
        _fail("external_root_invalid")
    canonical_external_roots: list[Path] = []
    external_identities: list[os.stat_result] = []
    for expected_capability, external_mapping in zip(
        EXPECTED_EXTERNAL_CAPABILITIES, authorization.external_roots, strict=True
    ):
        if (
            not isinstance(external_mapping, ExternalRootBinding)
            or external_mapping.capability != expected_capability
        ):
            _fail("external_root_invalid")
        external_root = external_mapping.root
        external_canonical, external_identity = _canonical_directory(external_root)
        if (
            not external_root.is_absolute()
            or external_identity.st_uid != os.getuid()
            or stat.S_IMODE(external_identity.st_mode) != 0o700
        ):
            _fail("external_root_invalid")
        if external_canonical in canonical_external_roots:
            _fail("external_root_duplicate")
        canonical_external_roots.append(external_canonical)
        external_identities.append(external_identity)
    if any(
        left == right or left in right.parents or right in left.parents
        for index, left in enumerate(canonical_external_roots)
        for right in canonical_external_roots[index + 1 :]
    ):
        _fail("external_roots_overlap")
    protected_roots = (canonical, *canonical_repository_roots)
    if any(
        external == protected
        or external in protected.parents
        or protected in external.parents
        for external in canonical_external_roots
        for protected in protected_roots
    ):
        _fail("external_root_protected_overlap")
    try:
        if any(any(root.iterdir()) for root in canonical_external_roots):
            _fail("external_root_not_empty")
    except OSError:
        _fail("external_root_invalid")
    if any(identity.st_nlink not in (1, 2) for identity in external_identities):
        _fail("external_root_invalid")
    marker = canonical / CONSUMPTION_MARKER
    seal = canonical / TERMINAL_SEAL
    pending_seal = canonical / PENDING_TERMINAL_SEAL
    if marker.exists() or marker.is_symlink():
        _fail("authorization_already_consumed")
    if seal.exists() or seal.is_symlink():
        _fail("terminal_seal_exists")
    if pending_seal.exists() or pending_seal.is_symlink():
        _fail("terminalization_in_progress")
    try:
        if any(canonical.iterdir()):
            _fail("evidence_root_not_empty")
    except OSError:
        _fail("evidence_root_invalid")
    # Empty-directory link counts are one or two depending on the filesystem.
    if identity.st_nlink not in (1, 2):
        _fail("evidence_root_invalid")


def _consumption_marker_document(
    authorization: MasterAuthorization,
) -> dict[str, object]:
    return {
        "aggregate_sha256": authorization.aggregate_sha256,
        "authorization_sha256": authorization.authorization_sha256,
        "exact_head_grant_sha256": authorization.exact_head_grant_sha256,
        "external_roots_sha256": authorization.external_roots_sha256,
        "one_shot": True,
        "repository_roots_sha256": authorization.repository_roots_sha256,
        "repository_tuple_sha256": authorization.repository_tuple_sha256,
        "run_id": authorization.run_id,
        "status": "consumed",
    }


def consumption_marker_digest(authorization: MasterAuthorization) -> str:
    return hashlib.sha256(
        canonical_json_bytes(_consumption_marker_document(authorization))
    ).hexdigest()


def consume_once(authorization: MasterAuthorization) -> tuple[Path, str]:
    marker = authorization.evidence_root / CONSUMPTION_MARKER
    digest = _exclusive_json(
        marker,
        _consumption_marker_document(authorization),
        exists_reason="authorization_already_consumed",
    )
    return marker, digest


def reserve_terminal_seal(
    authorization: MasterAuthorization, reservation: TerminalSeal
) -> None:
    _exclusive_json(
        authorization.evidence_root / TERMINAL_SEAL,
        reservation.to_dict(),
        exists_reason="terminal_seal_exists",
    )


def _remove_owned_pending(path: Path) -> None:
    try:
        identity = path.lstat()
    except FileNotFoundError:
        return
    except OSError:
        return
    if (
        not stat.S_ISREG(identity.st_mode)
        or stat.S_IMODE(identity.st_mode) != 0o600
        or identity.st_uid != os.getuid()
        or identity.st_nlink != 1
    ):
        return
    try:
        path.unlink()
        _fsync_parent(path)
    except (OSError, StorageFailure):
        return


def replace_terminal_seal(
    authorization: MasterAuthorization,
    reservation: TerminalSeal,
    final_seal: TerminalSeal,
) -> None:
    seal_path = authorization.evidence_root / TERMINAL_SEAL
    pending_path = authorization.evidence_root / PENDING_TERMINAL_SEAL
    _readback(seal_path, canonical_json_bytes(reservation.to_dict()))
    try:
        _exclusive_json(
            pending_path,
            final_seal.to_dict(),
            exists_reason="terminalization_in_progress",
        )
        os.replace(pending_path, seal_path)
        _fsync_parent(seal_path)
        _readback(seal_path, canonical_json_bytes(final_seal.to_dict()))
    except StorageFailure:
        _remove_owned_pending(pending_path)
        raise
    except OSError:
        _remove_owned_pending(pending_path)
        _fail("evidence_write_failed")
