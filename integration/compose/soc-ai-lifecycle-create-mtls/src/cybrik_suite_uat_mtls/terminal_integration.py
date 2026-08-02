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


def _fail(reason: str) -> NoReturn:
    raise TerminalIntegrationError(reason)


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
        descriptor = os.open(path.anchor, _DIRECTORY_FLAGS)
        for component in path.parts[1:]:
            child = os.open(component, _DIRECTORY_FLAGS, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        metadata = os.fstat(descriptor)
        if not stat.S_ISDIR(metadata.st_mode):
            _fail(reason)
        return descriptor
    except TerminalIntegrationError:
        if descriptor >= 0:
            os.close(descriptor)
        raise
    except (OSError, TypeError, ValueError):
        if descriptor >= 0:
            os.close(descriptor)
        _fail(reason)


def _directory_identity(descriptor: int) -> tuple[int, int, int]:
    metadata = os.fstat(descriptor)
    return (metadata.st_dev, metadata.st_ino, stat.S_IFMT(metadata.st_mode))


def _open_evidence_root(path: Path) -> int:
    descriptor = _open_absolute_directory(path, "evidence_root_changed")
    metadata = os.fstat(descriptor)
    if metadata.st_uid != os.geteuid() or stat.S_IMODE(metadata.st_mode) != 0o700:
        os.close(descriptor)
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
    return relative.parts


def _open_relative_file(root_descriptor: int, parts: tuple[str, ...]) -> int:
    descriptors: list[int] = []
    current = os.dup(root_descriptor)
    descriptors.append(current)
    try:
        for component in parts[:-1]:
            child = os.open(component, _DIRECTORY_FLAGS, dir_fd=current)
            descriptors.append(child)
            current = child
        result = os.open(parts[-1], _FILE_READ_FLAGS, dir_fd=current)
    except OSError:
        result = -1
    finally:
        for descriptor in reversed(descriptors):
            os.close(descriptor)
    if result < 0:
        _fail("terminal_artifact_changed")
    return result


def _read_bound_file(
    descriptor: int, *, reason: str, maximum: int
) -> tuple[bytes, os.stat_result]:
    try:
        before = os.fstat(descriptor)
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
        after = os.fstat(descriptor)
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
        os.close(descriptor)
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
            descriptor = os.open(path.name, _FILE_READ_FLAGS, dir_fd=parent)
        except OSError:
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
            os.close(descriptor)
        return payload
    finally:
        os.close(parent)


def _write_all(descriptor: int, payload: bytes) -> None:
    offset = 0
    while offset < len(payload):
        written = os.write(descriptor, payload[offset:])
        if written <= 0:
            raise OSError("write made no progress")
        offset += written


def _freeze_public_pki(
    root_descriptor: int,
    binding: _AuthorizationBinding,
    public_pki_paths: Mapping[str, Path],
) -> tuple[_ArtifactBinding, ...]:
    if tuple(public_pki_paths) != tuple(name for name, _ in _PUBLIC_PKI):
        _fail("public_pki_invalid")
    expected_source_root = binding.runtime_root / "pki"
    payloads: list[tuple[str, bytes]] = []
    for name, filename in _PUBLIC_PKI:
        source = public_pki_paths.get(name)
        if not isinstance(source, Path) or source != expected_source_root / filename:
            _fail("public_pki_invalid")
        payloads.append((filename, _source_bytes(source)))

    try:
        os.mkdir("pki-public", 0o700, dir_fd=root_descriptor)
        pki_descriptor = os.open("pki-public", _DIRECTORY_FLAGS, dir_fd=root_descriptor)
    except OSError:
        _fail("public_pki_freeze_failed")
    try:
        metadata = os.fstat(pki_descriptor)
        if stat.S_IMODE(metadata.st_mode) != 0o700:
            _fail("public_pki_freeze_failed")
        for filename, payload in payloads:
            try:
                descriptor = os.open(
                    filename,
                    os.O_WRONLY
                    | os.O_CREAT
                    | os.O_EXCL
                    | getattr(os, "O_NOFOLLOW", 0)
                    | getattr(os, "O_CLOEXEC", 0),
                    0o600,
                    dir_fd=pki_descriptor,
                )
            except OSError:
                _fail("public_pki_freeze_failed")
            try:
                _write_all(descriptor, payload)
                os.fchmod(descriptor, 0o600)
                os.fsync(descriptor)
            except OSError:
                _fail("public_pki_freeze_failed")
            finally:
                os.close(descriptor)
        os.fsync(pki_descriptor)
        os.fsync(root_descriptor)
    finally:
        os.close(pki_descriptor)
    bindings: list[_ArtifactBinding] = []
    for (filename, payload), (_, expected_filename) in zip(
        payloads, _PUBLIC_PKI, strict=True
    ):
        if filename != expected_filename:
            _fail("public_pki_freeze_failed")
        binding = _artifact_binding(root_descriptor, ("pki-public", filename))
        if binding.size_bytes != len(payload) or not hmac.compare_digest(
            binding.sha256, hashlib.sha256(payload).hexdigest()
        ):
            _fail("public_pki_freeze_failed")
        bindings.append(binding)
    return tuple(bindings)


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
    return _canonical_json(dict(candidate), "terminal_candidate_invalid")


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
        evidence_identity = _directory_identity(root_descriptor)
        marker_sha256 = _marker_digest(binding, consumed_marker, evidence_identity)
        candidate_payload = _candidate_payload(candidate, binding, marker_sha256)
        _freeze_public_pki(root_descriptor, binding, public_pki_paths)
        receipts = _secret_sweep(
            secret_inventory, binding.evidence_root, candidate_payload
        )
        artifact_bindings = tuple(
            _artifact_binding(root_descriptor, relative)
            for relative in relative_artifacts
        )
        # Rebind public copies after the sweep so a secret-classifier deletion
        # or replacement can never be mistaken for a successful freeze.
        public_bindings = tuple(
            _artifact_binding(root_descriptor, ("pki-public", filename))
            for _, filename in _PUBLIC_PKI
        )
        os.fsync(root_descriptor)
        return PreparedTerminalHandoff(
            _authorization=binding,
            _marker_sha256=marker_sha256,
            _candidate_payload=candidate_payload,
            _evidence_identity=evidence_identity,
            _artifact_bindings=artifact_bindings + public_bindings,
            _public_pki_names=tuple(name for name, _ in _PUBLIC_PKI),
            _remediation_receipts=receipts,
        )
    except TerminalIntegrationError:
        raise
    except OSError:
        _fail("terminal_prepare_failed")
    finally:
        os.close(root_descriptor)


def _verify_artifact_binding(root_descriptor: int, expected: _ArtifactBinding) -> None:
    actual = _artifact_binding(
        root_descriptor, tuple(expected.relative_path.split("/"))
    )
    if actual != expected or not hmac.compare_digest(actual.sha256, expected.sha256):
        _fail("terminal_artifact_changed")


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
    prepared: PreparedTerminalHandoff,
    *,
    authorization: runtime_authorization.RuntimeAuthorization,
    consumed_marker: Mapping[str, object],
    live_absence_probe: Callable[[], Mapping[str, bool]],
) -> runtime_evidence.PersistedTerminalEvidence:
    """Recheck live teardown and delegate the summary-last immutable write."""

    if not isinstance(prepared, PreparedTerminalHandoff):
        _fail("terminal_grant_mismatch")
    binding = _authorization_binding(authorization)
    if binding != prepared._authorization:
        _fail("terminal_grant_mismatch")
    root_descriptor = _open_evidence_root(binding.evidence_root)
    try:
        evidence_identity = _directory_identity(root_descriptor)
        if evidence_identity != prepared._evidence_identity:
            _fail("evidence_root_changed")
        marker_sha256 = _marker_digest(binding, consumed_marker, evidence_identity)
        if not hmac.compare_digest(marker_sha256, prepared._marker_sha256):
            _fail("consumption_marker_mismatch")
        for artifact in prepared._artifact_bindings:
            _verify_artifact_binding(root_descriptor, artifact)
    finally:
        os.close(root_descriptor)

    teardown = _live_absence(live_absence_probe)
    try:
        candidate = json.loads(prepared._candidate_payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        _fail("terminal_candidate_invalid")
    if not isinstance(candidate, dict):
        _fail("terminal_candidate_invalid")
    expected_authority = {
        "phase_a_auth_sha256": binding.authorization_sha256,
        "consumption_sha256": prepared._marker_sha256,
        "one_shot_consumed": True,
    }
    if (
        candidate.get("attempt_id") != binding.authorization_id
        or candidate.get("authority") != expected_authority
    ):
        _fail("terminal_grant_mismatch")
    candidate["teardown"] = teardown
    return runtime_evidence.persist_terminal_evidence(binding.evidence_root, candidate)
