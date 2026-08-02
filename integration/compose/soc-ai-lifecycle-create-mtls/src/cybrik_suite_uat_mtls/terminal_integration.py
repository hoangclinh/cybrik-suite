"""Pure two-phase handoff between the D2 runtime and terminal evidence sealer.

``prepare_terminal_handoff`` runs before teardown.  It binds the admitted
authorization and one-shot marker, removes every secret-bearing artifact,
freezes the exact public PKI inventory, and records descriptor-backed artifact
identities.  ``finalize_terminal_handoff`` runs after teardown.  It rechecks
the same authority, marker, roots, artifact bytes, and a live absence probe
before delegating the only terminal write to :mod:`runtime_evidence`.

Importing this module is inert.  It opens no socket, starts no process, and
touches no database, container, or PKI generator.
"""

from __future__ import annotations

import fcntl
import hashlib
import hmac
import json
import os
import re
import stat
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Final, NoReturn

from . import runtime_authorization, runtime_evidence
from . import secret_inventory as secret_inventory_module

PENDING_HANDOFF_SCHEMA_VERSION: Final = "cybrik.d2.pending-terminal-handoff.v1"
PENDING_HANDOFF_FILENAME: Final = ".cybrik-d2-terminal-handoff.pending.json"
MAX_PENDING_HANDOFF_BYTES: Final = 1024 * 1024
_PUBLIC_PKI_DIRECTORY: Final = "pki-public"

_PUBLIC_PKI: Final = (
    ("ca_certificate", "ca-cert.pem"),
    ("server_certificate", "server-cert.pem"),
    ("client_certificate", "client-cert.pem"),
    ("alternate_client_certificate", "alternate-client-cert.pem"),
    ("jwt_public_jwk", "jwt-public-jwk.json"),
)
_ABSENCE_KEYS: Final = (
    "completed",
    "ai_process_absent",
    "soc_process_absent",
    "postgres_container_absent",
    "ai_listener_absent",
    "postgres_listener_absent",
    "runtime_root_absent",
    "pki_absent",
)
_MARKER_CORE_KEYS: Final = frozenset(
    {
        "authorization_id",
        "authorization_sha256",
        "consumed_at",
        "evidence_root",
        "evidence_root_identity",
        "one_shot",
        "runtime_code_aggregate_sha256",
        "runtime_root",
        "status",
        "suite_admission_base",
    }
)
_TERMINAL_FILENAMES: Final = frozenset(
    {
        runtime_evidence.RESULT_FILENAME,
        runtime_evidence.TEARDOWN_FILENAME,
        runtime_evidence.SUMMARY_FILENAME,
        PENDING_HANDOFF_FILENAME,
    }
)
_HEX40: Final = re.compile(r"[0-9a-f]{40}")
_HEX64: Final = re.compile(r"[0-9a-f]{64}")
_IDENTIFIER: Final = re.compile(r"[a-z0-9][a-z0-9_.-]{0,127}")
_RUNTIME_ROOT: Final = re.compile(r"cybrik-uat-d2-runtime-[a-z0-9][a-z0-9._-]{0,63}")
_EVIDENCE_ROOT: Final = re.compile(r"cybrik-uat-d2-evidence-[a-z0-9][a-z0-9._-]{0,63}")
_DIRECTORY_FLAGS: Final = (
    os.O_RDONLY
    | getattr(os, "O_DIRECTORY", 0)
    | getattr(os, "O_NOFOLLOW", 0)
    | getattr(os, "O_CLOEXEC", 0)
)
_FILE_READ_FLAGS: Final = (
    os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
)


class TerminalIntegrationError(RuntimeError):
    """Stable refusal that never reflects rejected paths or secret material."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class _AuthorizationBinding:
    authorization_id: str
    authorization_sha256: str
    exact_head_grant_sha256: str | None
    suite_head: str | None
    suite_admission_base: str
    aggregate_sha256: str
    runtime_root: Path
    evidence_root: Path


@dataclass(frozen=True, slots=True)
class _ArtifactBinding:
    relative_path: str
    sha256: str
    size_bytes: int
    identity: tuple[int, int, int]


@dataclass(frozen=True, slots=True, repr=False)
class PreparedTerminalHandoff:
    """Opaque, immutable authority and artifact snapshot for phase two."""

    _authorization: _AuthorizationBinding
    _marker_sha256: str
    _candidate_payload: bytes
    _evidence_identity: tuple[int, int, int]
    _artifact_bindings: tuple[_ArtifactBinding, ...]
    _public_pki_names: tuple[str, ...]
    _remediation_receipts: tuple[tuple[tuple[str, object], ...], ...]

    @property
    def public_pki_names(self) -> tuple[str, ...]:
        return self._public_pki_names

    @property
    def remediation_receipts(self) -> tuple[dict[str, object], ...]:
        """Return detached path-free receipts; never expose path capabilities."""

        return tuple(dict(receipt) for receipt in self._remediation_receipts)

    def __repr__(self) -> str:
        return (
            "<PreparedTerminalHandoff "
            f"artifact_count={len(self._artifact_bindings)} "
            f"remediation_count={len(self._remediation_receipts)}>"
        )


@dataclass(frozen=True, slots=True, repr=False)
class _LoadedPendingHandoff:
    """Validated, path-free state recovered by the rollback process."""

    candidate: dict[str, object]
    marker_sha256: str
    artifact_bindings: tuple[_ArtifactBinding, ...]


def _fail(reason: str) -> NoReturn:
    raise TerminalIntegrationError(reason)


def _descriptor_open(
    path: str | bytes | os.PathLike[str] | os.PathLike[bytes],
    flags: int,
    mode: int = 0o777,
    *,
    dir_fd: int | None = None,
) -> int:
    """Open one descriptor or collapse the transition to a stable refusal."""

    try:
        descriptor = os.open(path, flags, mode, dir_fd=dir_fd)
    except (OSError, TypeError, ValueError):
        raise TerminalIntegrationError("descriptor_transition_failed") from None
    if (
        isinstance(descriptor, bool)
        or not isinstance(descriptor, int)
        or descriptor < 0
    ):
        _fail("descriptor_transition_failed")
    return descriptor


def _descriptor_close(descriptor: int) -> None:
    """Close one descriptor without ever exposing an OS error or locator."""

    try:
        os.close(descriptor)
    except (OSError, TypeError, ValueError):
        raise TerminalIntegrationError("descriptor_transition_failed") from None


def _descriptor_fstat(descriptor: int) -> os.stat_result:
    """Inspect one descriptor through the stable transition boundary."""

    try:
        metadata = os.fstat(descriptor)
    except (OSError, TypeError, ValueError):
        raise TerminalIntegrationError("descriptor_transition_failed") from None
    if not isinstance(metadata, os.stat_result):
        _fail("descriptor_transition_failed")
    return metadata


def _descriptor_dup(descriptor: int) -> int:
    """Duplicate one descriptor through the stable transition boundary."""

    try:
        duplicate = os.dup(descriptor)
    except (OSError, TypeError, ValueError):
        raise TerminalIntegrationError("descriptor_transition_failed") from None
    if isinstance(duplicate, bool) or not isinstance(duplicate, int) or duplicate < 0:
        _fail("descriptor_transition_failed")
    return duplicate


def _canonical_json(value: object, reason: str) -> bytes:
    try:
        return json.dumps(
            value,
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError):
        _fail(reason)


def _canonical_record(value: object, reason: str) -> bytes:
    payload = _canonical_json(value, reason) + b"\n"
    if len(payload) > MAX_PENDING_HANDOFF_BYTES:
        _fail(reason)
    return payload


def _identity_record(identity: tuple[int, int, int]) -> dict[str, int]:
    return {
        "file_type": identity[2],
        "st_dev": identity[0],
        "st_ino": identity[1],
    }


def _authorization_record(binding: _AuthorizationBinding) -> dict[str, object]:
    return {
        "authorization_id": binding.authorization_id,
        "authorization_sha256": binding.authorization_sha256,
        "exact_head_grant_sha256": binding.exact_head_grant_sha256,
        "runtime_code_aggregate_sha256": binding.aggregate_sha256,
        "suite_admission_base": binding.suite_admission_base,
        "suite_head": binding.suite_head,
    }


def _artifact_record(binding: _ArtifactBinding) -> dict[str, object]:
    return {
        "file_type": binding.identity[2],
        "relative_path": binding.relative_path,
        "sha256": binding.sha256,
        "size_bytes": binding.size_bytes,
        "st_dev": binding.identity[0],
        "st_ino": binding.identity[1],
    }


def _safe_absolute_path(value: object, pattern: re.Pattern[str]) -> Path:
    if not isinstance(value, Path):
        _fail("terminal_grant_mismatch")
    rendered = str(value)
    if (
        not value.is_absolute()
        or rendered.startswith("//")
        or rendered != os.path.normpath(rendered)
        or rendered != str(Path(rendered))
        or pattern.fullmatch(value.name) is None
    ):
        _fail("terminal_grant_mismatch")
    return value


def _authorization_binding(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> _AuthorizationBinding:
    if not isinstance(authorization, runtime_authorization.RuntimeAuthorization):
        _fail("terminal_grant_mismatch")
    authorization_id = authorization.authorization_id
    authorization_sha256 = authorization.authorization_sha256
    aggregate_sha256 = authorization.aggregate_sha256
    suite_admission_base = authorization.suite_admission_base
    if (
        not isinstance(authorization_id, str)
        or _IDENTIFIER.fullmatch(authorization_id) is None
        or not isinstance(authorization_sha256, str)
        or _HEX64.fullmatch(authorization_sha256) is None
        or not isinstance(aggregate_sha256, str)
        or _HEX64.fullmatch(aggregate_sha256) is None
        or not isinstance(suite_admission_base, str)
        or _HEX40.fullmatch(suite_admission_base) is None
    ):
        _fail("terminal_grant_mismatch")

    suite_head = getattr(authorization, "suite_head", None)
    exact_head_grant_sha256 = getattr(authorization, "exact_head_grant_sha256", None)
    if suite_head is not None and (
        not isinstance(suite_head, str) or _HEX40.fullmatch(suite_head) is None
    ):
        _fail("terminal_grant_mismatch")
    if exact_head_grant_sha256 is not None and (
        not isinstance(exact_head_grant_sha256, str)
        or _HEX64.fullmatch(exact_head_grant_sha256) is None
    ):
        _fail("terminal_grant_mismatch")
    if (suite_head is None) != (exact_head_grant_sha256 is None):
        _fail("terminal_grant_mismatch")

    runtime_root = _safe_absolute_path(authorization.runtime_root, _RUNTIME_ROOT)
    evidence_root = _safe_absolute_path(authorization.evidence_root, _EVIDENCE_ROOT)
    if (
        runtime_root == evidence_root
        or runtime_root.is_relative_to(evidence_root)
        or evidence_root.is_relative_to(runtime_root)
    ):
        _fail("terminal_grant_mismatch")
    return _AuthorizationBinding(
        authorization_id=authorization_id,
        authorization_sha256=authorization_sha256,
        exact_head_grant_sha256=exact_head_grant_sha256,
        suite_head=suite_head,
        suite_admission_base=suite_admission_base,
        aggregate_sha256=aggregate_sha256,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
    )


def _open_absolute_directory(path: Path, reason: str) -> int:
    descriptor = -1
    try:
        descriptor = _descriptor_open(path.anchor, _DIRECTORY_FLAGS)
        for component in path.parts[1:]:
            child = _descriptor_open(component, _DIRECTORY_FLAGS, dir_fd=descriptor)
            _descriptor_close(descriptor)
            descriptor = child
        metadata = _descriptor_fstat(descriptor)
        if not stat.S_ISDIR(metadata.st_mode):
            _fail(reason)
        return descriptor
    except TerminalIntegrationError:
        if descriptor >= 0:
            _descriptor_close(descriptor)
        raise
    except (OSError, TypeError, ValueError):
        if descriptor >= 0:
            _descriptor_close(descriptor)
        _fail(reason)


def _directory_identity(descriptor: int) -> tuple[int, int, int]:
    metadata = _descriptor_fstat(descriptor)
    return (metadata.st_dev, metadata.st_ino, stat.S_IFMT(metadata.st_mode))


def _open_evidence_root(path: Path) -> int:
    descriptor = _open_absolute_directory(path, "evidence_root_changed")
    metadata = _descriptor_fstat(descriptor)
    if metadata.st_uid != os.geteuid() or stat.S_IMODE(metadata.st_mode) != 0o700:
        _descriptor_close(descriptor)
        _fail("evidence_root_changed")
    return descriptor


def _marker_digest(
    binding: _AuthorizationBinding,
    marker: object,
    evidence_identity: tuple[int, int, int],
) -> str:
    if not isinstance(marker, Mapping) or not all(
        isinstance(key, str) for key in marker
    ):
        _fail("consumption_marker_mismatch")
    optional: dict[str, object] = {}
    if binding.suite_head is not None:
        optional["suite_head"] = binding.suite_head
    if binding.exact_head_grant_sha256 is not None:
        optional["exact_head_grant_sha256"] = binding.exact_head_grant_sha256
    expected_keys = _MARKER_CORE_KEYS | frozenset(optional)
    if frozenset(marker) != expected_keys:
        _fail("consumption_marker_mismatch")
    expected = {
        "authorization_id": binding.authorization_id,
        "authorization_sha256": binding.authorization_sha256,
        "evidence_root": str(binding.evidence_root),
        "evidence_root_identity": {
            "st_dev": evidence_identity[0],
            "st_ino": evidence_identity[1],
        },
        "one_shot": True,
        "runtime_code_aggregate_sha256": binding.aggregate_sha256,
        "runtime_root": str(binding.runtime_root),
        "status": "consumed",
        "suite_admission_base": binding.suite_admission_base,
        **optional,
    }
    if any(marker.get(key) != value for key, value in expected.items()):
        _fail("consumption_marker_mismatch")
    consumed_at = marker.get("consumed_at")
    if not isinstance(consumed_at, str):
        _fail("consumption_marker_mismatch")
    try:
        parsed_consumed_at = runtime_authorization._consumed_at(marker)
    except runtime_authorization.RuntimeAuthorizationFailure:
        _fail("consumption_marker_mismatch")
    if parsed_consumed_at.isoformat() != consumed_at:
        # Reject alternate spellings so the digest binds one canonical marker.
        _fail("consumption_marker_mismatch")
    return hashlib.sha256(
        _canonical_json(dict(marker), "consumption_marker_mismatch")
    ).hexdigest()


def _relative_artifact(path: Path, evidence_root: Path) -> tuple[str, ...]:
    if not isinstance(path, Path) or not path.is_absolute():
        _fail("artifact_outside_evidence_root")
    rendered = str(path)
    if (
        rendered.startswith("//")
        or rendered != os.path.normpath(rendered)
        or rendered != str(Path(rendered))
    ):
        _fail("artifact_outside_evidence_root")
    try:
        relative = path.relative_to(evidence_root)
    except ValueError:
        _fail("artifact_outside_evidence_root")
    if (
        relative.parts in ((), (".",))
        or any(part in {"", ".", ".."} for part in relative.parts)
        or relative.as_posix() in _TERMINAL_FILENAMES
    ):
        _fail("artifact_outside_evidence_root")
    if relative.parts[0].casefold() == _PUBLIC_PKI_DIRECTORY.casefold():
        _fail("artifact_reserved_namespace")
    return relative.parts


def _open_relative_file(root_descriptor: int, parts: tuple[str, ...]) -> int:
    descriptors: list[int] = []
    current = _descriptor_dup(root_descriptor)
    descriptors.append(current)
    try:
        for component in parts[:-1]:
            child = _descriptor_open(component, _DIRECTORY_FLAGS, dir_fd=current)
            descriptors.append(child)
            current = child
        result = _descriptor_open(parts[-1], _FILE_READ_FLAGS, dir_fd=current)
    except TerminalIntegrationError:
        result = -1
    finally:
        for descriptor in reversed(descriptors):
            _descriptor_close(descriptor)
    if result < 0:
        _fail("terminal_artifact_changed")
    return result


def _read_bound_file(
    descriptor: int, *, reason: str, maximum: int
) -> tuple[bytes, os.stat_result]:
    try:
        before = _descriptor_fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_nlink != 1
            or before.st_size > maximum
        ):
            _fail(reason)
        chunks: list[bytes] = []
        remaining = maximum + 1
        while remaining > 0:
            chunk = os.read(descriptor, min(1024 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        payload = b"".join(chunks)
        after = _descriptor_fstat(descriptor)
    except TerminalIntegrationError:
        raise
    except OSError:
        _fail(reason)
    stable = (
        before.st_dev,
        before.st_ino,
        stat.S_IFMT(before.st_mode),
        before.st_size,
        before.st_mtime_ns,
        before.st_ctime_ns,
    ) == (
        after.st_dev,
        after.st_ino,
        stat.S_IFMT(after.st_mode),
        after.st_size,
        after.st_mtime_ns,
        after.st_ctime_ns,
    )
    if not stable or len(payload) != before.st_size or len(payload) > maximum:
        _fail(reason)
    return payload, before


def _artifact_binding(
    root_descriptor: int, relative_parts: tuple[str, ...]
) -> _ArtifactBinding:
    descriptor = _open_relative_file(root_descriptor, relative_parts)
    try:
        payload, metadata = _read_bound_file(
            descriptor,
            reason="terminal_artifact_changed",
            maximum=runtime_evidence.MAX_ARTIFACT_BYTES,
        )
    finally:
        _descriptor_close(descriptor)
    return _ArtifactBinding(
        relative_path="/".join(relative_parts),
        sha256=hashlib.sha256(payload).hexdigest(),
        size_bytes=len(payload),
        identity=(metadata.st_dev, metadata.st_ino, stat.S_IFMT(metadata.st_mode)),
    )


def _source_bytes(path: Path) -> bytes:
    parent = _open_absolute_directory(path.parent, "public_pki_invalid")
    try:
        try:
            descriptor = _descriptor_open(path.name, _FILE_READ_FLAGS, dir_fd=parent)
        except TerminalIntegrationError:
            descriptor = -1
        if descriptor < 0:
            _fail("public_pki_invalid")
        try:
            payload, _ = _read_bound_file(
                descriptor,
                reason="public_pki_invalid",
                maximum=runtime_evidence.MAX_ARTIFACT_BYTES,
            )
        finally:
            _descriptor_close(descriptor)
        return payload
    finally:
        _descriptor_close(parent)


def _write_all(descriptor: int, payload: bytes) -> None:
    offset = 0
    while offset < len(payload):
        written = os.write(descriptor, payload[offset:])
        if written <= 0:
            raise OSError("write made no progress")
        offset += written


def _validated_public_pki_payloads(
    binding: _AuthorizationBinding,
    public_pki_paths: Mapping[str, Path],
    inventory: secret_inventory_module.SecretInventory,
) -> tuple[tuple[str, bytes], ...]:
    if tuple(public_pki_paths) != tuple(name for name, _ in _PUBLIC_PKI):
        _fail("public_pki_invalid")
    expected_source_root = binding.runtime_root / "pki"
    payloads: list[tuple[str, bytes]] = []
    for name, filename in _PUBLIC_PKI:
        source = public_pki_paths.get(name)
        if not isinstance(source, Path) or source != expected_source_root / filename:
            _fail("public_pki_invalid")
        payload = _source_bytes(source)
        if len(payload) > secret_inventory_module.MAX_SCAN_TEXT_BYTES:
            _fail("public_pki_too_large")
        try:
            runtime_evidence._validate_public_material(name, payload)
        except runtime_evidence.RuntimeEvidenceError:
            _fail("public_pki_invalid")
        scan_failed = False
        try:
            exact_label = inventory._exact_label(payload)
        except secret_inventory_module.SecretInventoryError:
            scan_failed = True
            exact_label = None
        if scan_failed:
            _fail("public_pki_scan_failed")
        if exact_label is not None:
            _fail("public_pki_secret_detected")
        payloads.append((filename, payload))
    return tuple(payloads)


def _freeze_public_pki(
    root_descriptor: int,
    payloads: tuple[tuple[str, bytes], ...],
) -> tuple[_ArtifactBinding, ...]:
    directory_created = False
    try:
        os.mkdir(_PUBLIC_PKI_DIRECTORY, 0o700, dir_fd=root_descriptor)
        directory_created = True
    except (OSError, TypeError, ValueError):
        pass
    if not directory_created:
        _fail("public_pki_freeze_failed")

    try:
        pki_descriptor = _descriptor_open(
            _PUBLIC_PKI_DIRECTORY, _DIRECTORY_FLAGS, dir_fd=root_descriptor
        )
    except TerminalIntegrationError:
        _fail("public_pki_freeze_failed")
    try:
        metadata = _descriptor_fstat(pki_descriptor)
        if stat.S_IMODE(metadata.st_mode) != 0o700:
            _fail("public_pki_freeze_failed")
        for filename, payload in payloads:
            try:
                descriptor = _descriptor_open(
                    filename,
                    os.O_WRONLY
                    | os.O_CREAT
                    | os.O_EXCL
                    | getattr(os, "O_NOFOLLOW", 0)
                    | getattr(os, "O_CLOEXEC", 0),
                    0o600,
                    dir_fd=pki_descriptor,
                )
            except TerminalIntegrationError:
                _fail("public_pki_freeze_failed")
            try:
                _write_all(descriptor, payload)
                os.fchmod(descriptor, 0o600)
                os.fsync(descriptor)
            except OSError:
                _fail("public_pki_freeze_failed")
            finally:
                _descriptor_close(descriptor)
        durability_failed = False
        try:
            os.fsync(pki_descriptor)
            os.fsync(root_descriptor)
        except (OSError, TypeError, ValueError):
            durability_failed = True
        if durability_failed:
            _fail("public_pki_freeze_failed")
    finally:
        _descriptor_close(pki_descriptor)
    bindings: list[_ArtifactBinding] = []
    for (filename, payload), (_, expected_filename) in zip(
        payloads, _PUBLIC_PKI, strict=True
    ):
        if filename != expected_filename:
            _fail("public_pki_freeze_failed")
        binding = _artifact_binding(root_descriptor, (_PUBLIC_PKI_DIRECTORY, filename))
        if binding.size_bytes != len(payload) or not hmac.compare_digest(
            binding.sha256, hashlib.sha256(payload).hexdigest()
        ):
            _fail("public_pki_freeze_failed")
        bindings.append(binding)
    return tuple(bindings)


def _refuse_existing_handoff(root_descriptor: int) -> None:
    """Refuse re-entry before a sweep can mutate preserved terminal evidence."""

    for entry in (PENDING_HANDOFF_FILENAME, _PUBLIC_PKI_DIRECTORY):
        observation_failed = False
        try:
            os.stat(entry, dir_fd=root_descriptor, follow_symlinks=False)
        except FileNotFoundError:
            continue
        except (OSError, TypeError, ValueError):
            observation_failed = True
        if observation_failed:
            _fail("terminal_reentry_observation_failed")
        _fail("terminal_handoff_already_prepared")


def _acquire_prepare_lock(root_descriptor: int) -> None:
    """Serialize prepare calls on one evidence-root inode without a lock file."""

    acquired = False
    try:
        fcntl.flock(root_descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        acquired = True
    except (OSError, TypeError, ValueError):
        pass
    if not acquired:
        _fail("terminal_handoff_busy")


def _secret_sweep(
    inventory: secret_inventory_module.SecretInventory,
    evidence_root: Path,
    candidate_payload: bytes,
) -> tuple[tuple[tuple[str, object], ...], ...]:
    if not isinstance(inventory, secret_inventory_module.SecretInventory):
        _fail("secret_sweep_failed")
    receipts: list[tuple[tuple[str, object], ...]] = []
    try:
        if inventory.scan_bytes(candidate_payload) is not None:
            _fail("candidate_secret_detected")
        findings = inventory.scan_tree(evidence_root)
        for finding in findings:
            record = secret_inventory_module.apply_remediation(evidence_root, finding)
            if not isinstance(record, dict) or set(record) - {
                "action",
                "artifact_id",
                "label",
                "reason",
            }:
                _fail("secret_sweep_failed")
            receipts.append(tuple(sorted(record.items())))
        if inventory.scan_tree(evidence_root):
            _fail("secret_sweep_failed")
        return tuple(receipts)
    except TerminalIntegrationError:
        raise
    except secret_inventory_module.SecretInventoryError:
        _fail("secret_sweep_failed")
    finally:
        inventory.clear()


def _candidate_payload(
    candidate: object,
    binding: _AuthorizationBinding,
    marker_sha256: str,
) -> bytes:
    if not isinstance(candidate, Mapping) or not all(
        isinstance(key, str) for key in candidate
    ):
        _fail("terminal_candidate_invalid")
    expected_authority = {
        "phase_a_auth_sha256": binding.authorization_sha256,
        "consumption_sha256": marker_sha256,
        "one_shot_consumed": True,
    }
    if (
        candidate.get("attempt_id") != binding.authorization_id
        or candidate.get("authority") != expected_authority
    ):
        _fail("terminal_grant_mismatch")
    return _canonical_record(dict(candidate), "terminal_candidate_invalid")


def _persist_pending_handoff(
    root_descriptor: int,
    binding: _AuthorizationBinding,
    evidence_identity: tuple[int, int, int],
    marker_sha256: str,
    candidate_payload: bytes,
    artifact_bindings: tuple[_ArtifactBinding, ...],
    receipts: tuple[tuple[tuple[str, object], ...], ...],
) -> None:
    """Create the immutable prepare-to-rollback handoff exactly once."""

    descriptor = -1
    try:
        descriptor = _descriptor_open(
            PENDING_HANDOFF_FILENAME,
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_CLOEXEC", 0),
            0o600,
            dir_fd=root_descriptor,
        )
        metadata = _descriptor_fstat(descriptor)
        if (
            not stat.S_ISREG(metadata.st_mode)
            or metadata.st_nlink != 1
            or stat.S_IMODE(metadata.st_mode) != 0o600
        ):
            _fail("pending_handoff_write_failed")
        pending_identity = (
            metadata.st_dev,
            metadata.st_ino,
            stat.S_IFMT(metadata.st_mode),
        )
        try:
            candidate = json.loads(candidate_payload)
        except (json.JSONDecodeError, UnicodeDecodeError):
            _fail("terminal_candidate_invalid")
        if not isinstance(candidate, dict):
            _fail("terminal_candidate_invalid")
        receipt_payload = _canonical_record(
            [dict(receipt) for receipt in receipts], "pending_handoff_write_failed"
        )
        document = {
            "artifact_bindings": [
                _artifact_record(artifact) for artifact in artifact_bindings
            ],
            "authorization": _authorization_record(binding),
            "candidate": candidate,
            "candidate_payload_sha256": hashlib.sha256(candidate_payload).hexdigest(),
            "consumption_marker_sha256": marker_sha256,
            "evidence_root_identity": _identity_record(evidence_identity),
            "pending_file_identity": _identity_record(pending_identity),
            "public_pki_names": [name for name, _ in _PUBLIC_PKI],
            "remediation_receipt_sha256": hashlib.sha256(receipt_payload).hexdigest(),
            "schema_version": PENDING_HANDOFF_SCHEMA_VERSION,
        }
        payload = _canonical_record(document, "pending_handoff_write_failed")
        if (
            str(binding.runtime_root).encode("utf-8") in payload
            or str(binding.evidence_root).encode("utf-8") in payload
        ):
            _fail("pending_handoff_write_failed")
        _write_all(descriptor, payload)
        os.fchmod(descriptor, 0o600)
        os.fsync(descriptor)
        after = _descriptor_fstat(descriptor)
        if (
            (after.st_dev, after.st_ino, stat.S_IFMT(after.st_mode)) != pending_identity
            or after.st_nlink != 1
            or after.st_size != len(payload)
            or stat.S_IMODE(after.st_mode) != 0o600
        ):
            _fail("pending_handoff_write_failed")
        os.fsync(root_descriptor)
    except TerminalIntegrationError:
        raise
    except (OSError, TypeError, ValueError):
        _fail("pending_handoff_write_failed")
    finally:
        if descriptor >= 0:
            _descriptor_close(descriptor)


def prepare_terminal_handoff(
    *,
    authorization: runtime_authorization.RuntimeAuthorization,
    consumed_marker: Mapping[str, object],
    candidate: Mapping[str, object],
    public_pki_paths: Mapping[str, Path],
    artifact_paths: Sequence[Path],
    secret_inventory: secret_inventory_module.SecretInventory,
) -> PreparedTerminalHandoff:
    """Freeze the exact pre-teardown state without executing runtime behavior."""

    binding = _authorization_binding(authorization)
    if isinstance(artifact_paths, (str, bytes)) or not isinstance(
        artifact_paths, Sequence
    ):
        _fail("artifact_outside_evidence_root")
    relative_artifacts = tuple(
        _relative_artifact(path, binding.evidence_root) for path in artifact_paths
    )
    if len(relative_artifacts) != len(set(relative_artifacts)):
        _fail("artifact_outside_evidence_root")

    root_descriptor = _open_evidence_root(binding.evidence_root)
    try:
        _acquire_prepare_lock(root_descriptor)
        _refuse_existing_handoff(root_descriptor)
        evidence_identity = _directory_identity(root_descriptor)
        marker_sha256 = _marker_digest(binding, consumed_marker, evidence_identity)
        candidate_payload = _candidate_payload(candidate, binding, marker_sha256)
        if not isinstance(secret_inventory, secret_inventory_module.SecretInventory):
            _fail("secret_sweep_failed")
        public_payloads = _validated_public_pki_payloads(
            binding, public_pki_paths, secret_inventory
        )
        receipts = _secret_sweep(
            secret_inventory, binding.evidence_root, candidate_payload
        )
        _freeze_public_pki(root_descriptor, public_payloads)
        artifact_bindings = tuple(
            _artifact_binding(root_descriptor, relative)
            for relative in relative_artifacts
        )
        # Bind the validated public copies after the secret sweep and freeze so
        # neither a classifier action nor a later replacement can be accepted.
        public_bindings = tuple(
            _artifact_binding(root_descriptor, (_PUBLIC_PKI_DIRECTORY, filename))
            for _, filename in _PUBLIC_PKI
        )
        all_artifact_bindings = artifact_bindings + public_bindings
        _persist_pending_handoff(
            root_descriptor,
            binding,
            evidence_identity,
            marker_sha256,
            candidate_payload,
            all_artifact_bindings,
            receipts,
        )
        os.fsync(root_descriptor)
        return PreparedTerminalHandoff(
            _authorization=binding,
            _marker_sha256=marker_sha256,
            _candidate_payload=candidate_payload,
            _evidence_identity=evidence_identity,
            _artifact_bindings=all_artifact_bindings,
            _public_pki_names=tuple(name for name, _ in _PUBLIC_PKI),
            _remediation_receipts=receipts,
        )
    except TerminalIntegrationError:
        raise
    except OSError:
        _fail("terminal_prepare_failed")
    finally:
        _descriptor_close(root_descriptor)


def _verify_artifact_binding(root_descriptor: int, expected: _ArtifactBinding) -> None:
    actual = _artifact_binding(
        root_descriptor, tuple(expected.relative_path.split("/"))
    )
    if actual != expected or not hmac.compare_digest(actual.sha256, expected.sha256):
        _fail("terminal_artifact_changed")


def _record_integer(value: object, reason: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        _fail(reason)
    return value


def _record_identity(
    value: object,
    *,
    expected_type: int,
    reason: str,
) -> tuple[int, int, int]:
    if not isinstance(value, dict) or set(value) != {"file_type", "st_dev", "st_ino"}:
        _fail(reason)
    file_type = _record_integer(value.get("file_type"), reason)
    if file_type != expected_type:
        _fail(reason)
    return (
        _record_integer(value.get("st_dev"), reason),
        _record_integer(value.get("st_ino"), reason),
        file_type,
    )


def _loaded_artifact(value: object) -> _ArtifactBinding:
    keys = {"file_type", "relative_path", "sha256", "size_bytes", "st_dev", "st_ino"}
    if not isinstance(value, dict) or set(value) != keys:
        _fail("pending_handoff_invalid")
    relative_path = value.get("relative_path")
    sha256 = value.get("sha256")
    if (
        not isinstance(relative_path, str)
        or not relative_path
        or relative_path.startswith("/")
        or "\\" in relative_path
        or any(part in {"", ".", ".."} for part in relative_path.split("/"))
        or relative_path in _TERMINAL_FILENAMES
        or not isinstance(sha256, str)
        or _HEX64.fullmatch(sha256) is None
    ):
        _fail("pending_handoff_invalid")
    size_bytes = _record_integer(value.get("size_bytes"), "pending_handoff_invalid")
    if size_bytes > runtime_evidence.MAX_ARTIFACT_BYTES:
        _fail("pending_handoff_invalid")
    identity = _record_identity(
        {
            "file_type": value.get("file_type"),
            "st_dev": value.get("st_dev"),
            "st_ino": value.get("st_ino"),
        },
        expected_type=stat.S_IFREG,
        reason="pending_handoff_invalid",
    )
    return _ArtifactBinding(
        relative_path=relative_path,
        sha256=sha256,
        size_bytes=size_bytes,
        identity=identity,
    )


def _load_pending_handoff(
    root_descriptor: int,
    binding: _AuthorizationBinding,
    evidence_identity: tuple[int, int, int],
) -> _LoadedPendingHandoff:
    """Descriptor-load and fully validate the preserved pending handoff."""

    descriptor = _descriptor_open(
        PENDING_HANDOFF_FILENAME, _FILE_READ_FLAGS, dir_fd=root_descriptor
    )
    try:
        payload, metadata = _read_bound_file(
            descriptor,
            reason="pending_handoff_invalid",
            maximum=MAX_PENDING_HANDOFF_BYTES,
        )
    finally:
        _descriptor_close(descriptor)
    if stat.S_IMODE(metadata.st_mode) != 0o600 or not payload:
        _fail("pending_handoff_invalid")
    try:
        document = json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        _fail("pending_handoff_invalid")
    if not isinstance(document, dict):
        _fail("pending_handoff_invalid")
    canonical = _canonical_record(document, "pending_handoff_invalid")
    if not hmac.compare_digest(payload, canonical):
        _fail("pending_handoff_noncanonical")
    if (
        str(binding.runtime_root).encode("utf-8") in payload
        or str(binding.evidence_root).encode("utf-8") in payload
    ):
        _fail("pending_handoff_invalid")

    expected_keys = {
        "artifact_bindings",
        "authorization",
        "candidate",
        "candidate_payload_sha256",
        "consumption_marker_sha256",
        "evidence_root_identity",
        "pending_file_identity",
        "public_pki_names",
        "remediation_receipt_sha256",
        "schema_version",
    }
    if set(document) != expected_keys:
        _fail("pending_handoff_invalid")
    if document.get("schema_version") != PENDING_HANDOFF_SCHEMA_VERSION:
        _fail("pending_handoff_invalid")

    actual_pending_identity = (
        metadata.st_dev,
        metadata.st_ino,
        stat.S_IFMT(metadata.st_mode),
    )
    recorded_pending_identity = _record_identity(
        document.get("pending_file_identity"),
        expected_type=stat.S_IFREG,
        reason="pending_handoff_invalid",
    )
    if recorded_pending_identity != actual_pending_identity:
        _fail("pending_handoff_replaced")
    recorded_evidence_identity = _record_identity(
        document.get("evidence_root_identity"),
        expected_type=stat.S_IFDIR,
        reason="pending_handoff_invalid",
    )
    if recorded_evidence_identity != evidence_identity:
        _fail("evidence_root_changed")

    authorization_record = document.get("authorization")
    if (
        not isinstance(authorization_record, dict)
        or set(authorization_record)
        != {
            "authorization_id",
            "authorization_sha256",
            "exact_head_grant_sha256",
            "runtime_code_aggregate_sha256",
            "suite_admission_base",
            "suite_head",
        }
        or authorization_record != _authorization_record(binding)
    ):
        _fail("terminal_grant_mismatch")

    marker_sha256 = document.get("consumption_marker_sha256")
    candidate_sha256 = document.get("candidate_payload_sha256")
    receipt_sha256 = document.get("remediation_receipt_sha256")
    if any(
        not isinstance(digest, str) or _HEX64.fullmatch(digest) is None
        for digest in (marker_sha256, candidate_sha256, receipt_sha256)
    ):
        _fail("pending_handoff_invalid")
    candidate = document.get("candidate")
    if not isinstance(candidate, dict) or not all(
        isinstance(key, str) for key in candidate
    ):
        _fail("terminal_candidate_invalid")
    actual_candidate_sha256 = hashlib.sha256(
        _canonical_record(candidate, "terminal_candidate_invalid")
    ).hexdigest()
    if not hmac.compare_digest(candidate_sha256, actual_candidate_sha256):
        _fail("terminal_candidate_invalid")

    public_names = document.get("public_pki_names")
    expected_public_names = [name for name, _ in _PUBLIC_PKI]
    if public_names != expected_public_names:
        _fail("public_pki_invalid")
    artifact_values = document.get("artifact_bindings")
    if not isinstance(artifact_values, list) or len(artifact_values) < len(_PUBLIC_PKI):
        _fail("pending_handoff_invalid")
    artifact_bindings = tuple(_loaded_artifact(value) for value in artifact_values)
    expected_public_paths = tuple(
        f"pki-public/{filename}" for _, filename in _PUBLIC_PKI
    )
    if (
        tuple(
            artifact.relative_path
            for artifact in artifact_bindings[-len(_PUBLIC_PKI) :]
        )
        != expected_public_paths
    ):
        _fail("public_pki_invalid")
    if len({artifact.relative_path for artifact in artifact_bindings}) != len(
        artifact_bindings
    ):
        _fail("pending_handoff_invalid")
    return _LoadedPendingHandoff(
        candidate=dict(candidate),
        marker_sha256=marker_sha256,
        artifact_bindings=artifact_bindings,
    )


def _live_absence(
    probe: Callable[[], Mapping[str, bool]],
) -> dict[str, bool]:
    if not callable(probe):
        _fail("live_teardown_probe_failed")
    try:
        observed = probe()
    except Exception:  # noqa: BLE001 - collapse a live probe into one stable refusal
        _fail("live_teardown_probe_failed")
    if (
        not isinstance(observed, Mapping)
        or len(observed) != len(_ABSENCE_KEYS)
        or frozenset(observed) != frozenset(_ABSENCE_KEYS)
        or any(observed.get(key) is not True for key in _ABSENCE_KEYS)
    ):
        _fail("live_teardown_incomplete")
    return {key: True for key in _ABSENCE_KEYS}


def finalize_terminal_handoff(
    *,
    authorization: runtime_authorization.RuntimeAuthorization,
    consumed_marker: Mapping[str, object],
    live_absence_probe: Callable[[], Mapping[str, bool]],
) -> runtime_evidence.PersistedTerminalEvidence:
    """Recheck live teardown and delegate the summary-last immutable write."""

    binding = _authorization_binding(authorization)
    root_descriptor = _open_evidence_root(binding.evidence_root)
    try:
        evidence_identity = _directory_identity(root_descriptor)
        pending = _load_pending_handoff(root_descriptor, binding, evidence_identity)
        marker_sha256 = _marker_digest(binding, consumed_marker, evidence_identity)
        if not hmac.compare_digest(marker_sha256, pending.marker_sha256):
            _fail("consumption_marker_mismatch")
        for artifact in pending.artifact_bindings:
            _verify_artifact_binding(root_descriptor, artifact)
    finally:
        _descriptor_close(root_descriptor)

    teardown = _live_absence(live_absence_probe)
    candidate = pending.candidate
    expected_authority = {
        "phase_a_auth_sha256": binding.authorization_sha256,
        "consumption_sha256": pending.marker_sha256,
        "one_shot_consumed": True,
    }
    if (
        candidate.get("attempt_id") != binding.authorization_id
        or candidate.get("authority") != expected_authority
    ):
        _fail("terminal_grant_mismatch")
    candidate["teardown"] = teardown
    return runtime_evidence.persist_terminal_evidence(binding.evidence_root, candidate)
