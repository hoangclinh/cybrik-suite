"""Exact Anycorn B1 verification and fail-closed server TLS narrowing.

Importing this module performs no filesystem access, imports no Anycorn module,
and opens no listener.  The runtime caller supplies the externally admitted B1
wheel and an Anycorn ``Config`` instance only after the one-shot UAT gate.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import secrets
import ssl
import threading
import zipfile
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Final

B1_WHEEL_FILENAME: Final = "anycorn-0.20.0+cybrik.1-py3-none-any.whl"
B1_VERSION: Final = "0.20.0+cybrik.1"
B1_WHEEL_SHA256: Final = (
    "d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c"
)
RUNTIME_ROLES: Final = ("soc", "cyber_ai", "tool_fabric")
HTTP11_ALPN: Final = ("http/1.1",)


class B1BoundaryFailure(RuntimeError):
    """Stable, non-reflecting B1 runtime refusal."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class VerifiedB1Artifact:
    path: Path
    filename: str
    version: str
    sha256: str
    module_count: int


@dataclass(frozen=True, slots=True)
class B1RuntimeEvidence:
    issuance_id: str
    role: str
    evidence_domain: str
    wheel_filename: str
    wheel_sha256: str
    anycorn_version: str
    module_count: int
    base_builder_called: bool
    tls_minimum: str
    tls_maximum: str
    verify_mode: str
    alpn_protocols: tuple[str, ...]
    no_compression: bool


@dataclass(frozen=True, slots=True)
class B1ServerContext:
    context: object
    evidence: B1RuntimeEvidence


_EVIDENCE_LOCK: Final = threading.RLock()
_ISSUED_EVIDENCE: Final[dict[str, B1RuntimeEvidence]] = {}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _exact_wheel_path(wheel: object) -> Path:
    if not isinstance(wheel, Path) or not wheel.is_absolute():
        raise B1BoundaryFailure("b1_path_invalid")
    try:
        resolved = wheel.resolve(strict=True)
    except OSError as error:
        raise B1BoundaryFailure("b1_path_invalid") from error
    if resolved != wheel or not wheel.is_file():
        raise B1BoundaryFailure("b1_path_invalid")
    return wheel


def _wheel_module_bytes(wheel: Path) -> dict[str, bytes]:
    try:
        with zipfile.ZipFile(wheel) as archive:
            names = [
                name
                for name in archive.namelist()
                if name.startswith("anycorn/") and name.endswith(".py")
            ]
            if len(names) != len(set(names)):
                raise B1BoundaryFailure("b1_wheel_modules_invalid")
            modules: dict[str, bytes] = {}
            for name in names:
                relative = PurePosixPath(name).relative_to("anycorn")
                if relative.is_absolute() or ".." in relative.parts:
                    raise B1BoundaryFailure("b1_wheel_modules_invalid")
                modules[relative.as_posix()] = archive.read(name)
    except (OSError, KeyError, zipfile.BadZipFile) as error:
        raise B1BoundaryFailure("b1_wheel_modules_invalid") from error
    if not modules or "__init__.py" not in modules or "config.py" not in modules:
        raise B1BoundaryFailure("b1_wheel_modules_invalid")
    return modules


def _installed_module_bytes() -> dict[str, bytes]:
    try:
        import anycorn

        package_file = Path(anycorn.__file__).resolve(strict=True)
        package_root = package_file.parent
        modules = {
            path.relative_to(package_root).as_posix(): path.read_bytes()
            for path in package_root.rglob("*.py")
            if path.is_file()
        }
    except (AttributeError, OSError, TypeError) as error:
        raise B1BoundaryFailure("b1_installed_modules_invalid") from error
    if not modules:
        raise B1BoundaryFailure("b1_installed_modules_invalid")
    return modules


def verify_b1_artifact(wheel: object) -> VerifiedB1Artifact:
    """Verify filename, digest, installed distribution and every Python byte."""

    path = _exact_wheel_path(wheel)
    if path.name != B1_WHEEL_FILENAME:
        raise B1BoundaryFailure("b1_filename_mismatch")
    if _sha256(path) != B1_WHEEL_SHA256:
        raise B1BoundaryFailure("b1_digest_mismatch")
    try:
        version = importlib.metadata.version("anycorn")
    except importlib.metadata.PackageNotFoundError as error:
        raise B1BoundaryFailure("b1_distribution_absent") from error
    if version != B1_VERSION:
        raise B1BoundaryFailure("b1_version_mismatch")
    wheel_modules = _wheel_module_bytes(path)
    if _installed_module_bytes() != wheel_modules:
        raise B1BoundaryFailure("b1_module_bytes_mismatch")
    return VerifiedB1Artifact(
        path=path,
        filename=B1_WHEEL_FILENAME,
        version=B1_VERSION,
        sha256=B1_WHEEL_SHA256,
        module_count=len(wheel_modules),
    )


def _runtime_role(role: object) -> str:
    if not isinstance(role, str) or role not in RUNTIME_ROLES:
        raise B1BoundaryFailure("b1_role_invalid")
    return role


def build_b1_server_context(
    config: object, *, wheel: Path, role: str
) -> B1ServerContext:
    """Call B1's base builder once, then force the exact UAT TLS boundary."""

    selected_role = _runtime_role(role)
    artifact = verify_b1_artifact(wheel)
    try:
        from anycorn.config import Config
    except (ImportError, AttributeError) as error:
        raise B1BoundaryFailure("b1_config_unavailable") from error
    if not isinstance(config, Config):
        raise B1BoundaryFailure("b1_config_type_mismatch")
    try:
        context = Config.create_ssl_context(config)
    except Exception as error:
        raise B1BoundaryFailure("b1_base_builder_failed") from error
    if context is None:
        raise B1BoundaryFailure("b1_base_builder_returned_none")
    try:
        context.minimum_version = ssl.TLSVersion.TLSv1_3
        context.maximum_version = ssl.TLSVersion.TLSv1_3
        context.verify_mode = ssl.CERT_REQUIRED
        context.options |= ssl.OP_NO_COMPRESSION
        context.set_alpn_protocols(list(HTTP11_ALPN))
    except (AttributeError, TypeError, ValueError) as error:
        raise B1BoundaryFailure("b1_tls_narrowing_failed") from error
    if (
        context.minimum_version is not ssl.TLSVersion.TLSv1_3
        or context.maximum_version is not ssl.TLSVersion.TLSv1_3
        or context.verify_mode is not ssl.CERT_REQUIRED
        or not int(context.options) & ssl.OP_NO_COMPRESSION
    ):
        raise B1BoundaryFailure("b1_tls_narrowing_failed")
    evidence = B1RuntimeEvidence(
        issuance_id=secrets.token_hex(32),
        role=selected_role,
        evidence_domain=f"cybrik-uat-b1/{selected_role}",
        wheel_filename=artifact.filename,
        wheel_sha256=artifact.sha256,
        anycorn_version=artifact.version,
        module_count=artifact.module_count,
        base_builder_called=True,
        tls_minimum="TLSv1.3",
        tls_maximum="TLSv1.3",
        verify_mode="CERT_REQUIRED",
        alpn_protocols=HTTP11_ALPN,
        no_compression=True,
    )
    with _EVIDENCE_LOCK:
        if evidence.issuance_id in _ISSUED_EVIDENCE:
            raise B1BoundaryFailure("b1_evidence_issuance_collision")
        _ISSUED_EVIDENCE[evidence.issuance_id] = evidence
    return B1ServerContext(context=context, evidence=evidence)


def require_role_disjoint_evidence(
    records: Sequence[B1RuntimeEvidence],
) -> tuple[B1RuntimeEvidence, ...]:
    """Require one independently labelled B1 record for every runtime role."""

    observed = tuple(records)
    with _EVIDENCE_LOCK:
        exact_runtime_claims = all(
            isinstance(item, B1RuntimeEvidence)
            and _ISSUED_EVIDENCE.get(item.issuance_id) == item
            and item.wheel_filename == B1_WHEEL_FILENAME
            and item.wheel_sha256 == B1_WHEEL_SHA256
            and item.anycorn_version == B1_VERSION
            and isinstance(item.module_count, int)
            and not isinstance(item.module_count, bool)
            and item.module_count > 0
            and item.base_builder_called is True
            and item.tls_minimum == "TLSv1.3"
            and item.tls_maximum == "TLSv1.3"
            and item.verify_mode == "CERT_REQUIRED"
            and item.alpn_protocols == HTTP11_ALPN
            and item.no_compression is True
            for item in observed
        )
        if (
            len(observed) != len(RUNTIME_ROLES)
            or not exact_runtime_claims
            or tuple(item.role for item in observed) != RUNTIME_ROLES
            or tuple(item.evidence_domain for item in observed)
            != tuple(f"cybrik-uat-b1/{role}" for role in RUNTIME_ROLES)
            or len({item.evidence_domain for item in observed}) != len(RUNTIME_ROLES)
        ):
            for item in observed:
                if isinstance(item, B1RuntimeEvidence):
                    _ISSUED_EVIDENCE.pop(item.issuance_id, None)
            raise B1BoundaryFailure("b1_role_evidence_mismatch")
        for item in observed:
            _ISSUED_EVIDENCE.pop(item.issuance_id, None)
    return observed
