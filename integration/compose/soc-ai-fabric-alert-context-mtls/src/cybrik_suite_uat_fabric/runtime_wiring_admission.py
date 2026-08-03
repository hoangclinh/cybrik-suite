"""Strict environment and SSHSIG admission boundary for concrete local UAT."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import stat
import subprocess
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from . import admission
from .b1_runtime import B1_WHEEL_FILENAME

AUTHORIZATION_NAMESPACE: Final = "cybrik-uat-soc-ai-fabric-v1"
TRUST_DESCRIPTOR_RELATIVE: Final = (
    "integration/compose/soc-ai-fabric-alert-context-mtls/authorization-trust.json"
)
_ENVIRONMENT_NAMES: Final = frozenset(
    {
        "CYBRIK_UAT_SUITE_ROOT",
        "CYBRIK_UAT_SOC_ROOT",
        "CYBRIK_UAT_CYBER_AI_ROOT",
        "CYBRIK_UAT_TOOL_FABRIC_ROOT",
        "CYBRIK_UAT_RUNTIME_ROOT",
        "CYBRIK_UAT_EVIDENCE_ROOT",
        "CYBRIK_UAT_STATE_ROOT",
        "CYBRIK_UAT_AUTHORIZATION_FILE",
        "CYBRIK_UAT_AUTHORIZATION_SIGNATURE",
        "CYBRIK_UAT_AUTHORIZATION_ALLOWED_SIGNERS",
        "CYBRIK_UAT_ALLOWED_SIGNER",
        "CYBRIK_UAT_B1_WHEEL",
        "CYBRIK_UAT_PYTHON",
    }
)
_SIGNERS: Final = frozenset({"FOUNDER", "CODEX_GOVERNOR"})
_HEX64 = re.compile(r"[0-9a-f]{64}\Z")
_FINGERPRINT = re.compile(r"SHA256:[A-Za-z0-9+/]{43}\Z")


class RuntimeAdmissionWiringError(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class RepositoryLayout:
    suite: Path
    soc: Path
    cyber_ai: Path
    tool_fabric: Path
    soc_source: Path
    cyber_ai_api_source: Path
    cyber_ai_core_source: Path
    tool_fabric_source: Path

    @property
    def roots(self) -> tuple[Path, ...]:
        return self.suite, self.soc, self.cyber_ai, self.tool_fabric


@dataclass(frozen=True, slots=True)
class ExternalRoots:
    runtime_root: Path
    evidence_root: Path
    state_root: Path


@dataclass(frozen=True, slots=True)
class RuntimeEnvironment:
    repositories: RepositoryLayout
    external: ExternalRoots
    authorization_file: Path
    signature_file: Path
    allowed_signers_file: Path
    allowed_signer: str
    b1_wheel: Path
    python: Path
    trust_descriptor: Path
    authorization_namespace: str


@dataclass(frozen=True, slots=True)
class SignedIntent:
    expectations: tuple[admission.RepoExpectation, ...]
    payload: bytes
    signature: bytes


def _required(environment: Mapping[str, str], name: str) -> str:
    value = environment.get(name)
    if not isinstance(value, str) or not value:
        raise RuntimeAdmissionWiringError("environment_missing")
    return value


def _directory(value: str, *, mode: int | None, reason: str) -> Path:
    path = Path(value)
    if not path.is_absolute() or path.is_symlink():
        raise RuntimeAdmissionWiringError(reason)
    try:
        resolved = path.resolve(strict=True)
        observed = os.lstat(path)
    except OSError as exc:
        raise RuntimeAdmissionWiringError(reason) from exc
    if (
        resolved != path
        or not stat.S_ISDIR(observed.st_mode)
        or observed.st_uid != os.geteuid()
        or (mode is not None and stat.S_IMODE(observed.st_mode) != mode)
    ):
        raise RuntimeAdmissionWiringError(reason)
    return path


def _file(value: str, *, mode: int, maximum: int = 64 * 1024 * 1024) -> Path:
    path = Path(value)
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
    if not path.is_absolute() or path.is_symlink() or not flags:
        raise RuntimeAdmissionWiringError("external_file_invalid")
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise RuntimeAdmissionWiringError("external_file_invalid") from exc
    try:
        observed = os.fstat(descriptor)
        current = os.stat(path, follow_symlinks=False)
        fields = ("st_dev", "st_ino", "st_uid", "st_mode", "st_nlink", "st_size")
        if (
            not stat.S_ISREG(observed.st_mode)
            or observed.st_uid != os.geteuid()
            or observed.st_nlink != 1
            or stat.S_IMODE(observed.st_mode) != mode
            or observed.st_size < 1
            or observed.st_size > maximum
            or any(
                getattr(observed, field) != getattr(current, field) for field in fields
            )
        ):
            raise RuntimeAdmissionWiringError("external_file_invalid")
    finally:
        os.close(descriptor)
    return path


def _executable(value: str, expected_sha256: str) -> Path:
    path = Path(value)
    if not path.is_absolute() or path.is_symlink():
        raise RuntimeAdmissionWiringError("python_executable_invalid")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
    try:
        resolved = path.resolve(strict=True)
        descriptor = os.open(path, flags)
        observed = os.fstat(descriptor)
    except OSError as exc:
        raise RuntimeAdmissionWiringError("python_executable_invalid") from exc
    mode = stat.S_IMODE(observed.st_mode)
    if (
        resolved != path
        or not stat.S_ISREG(observed.st_mode)
        or observed.st_uid not in {0, os.geteuid()}
        or observed.st_nlink != 1
        or mode not in {0o700, 0o755}
        or mode & 0o022
    ):
        raise RuntimeAdmissionWiringError("python_executable_invalid")
    try:
        with os.fdopen(os.dup(descriptor), "rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        after = os.fstat(descriptor)
        current = os.stat(path, follow_symlinks=False)
    finally:
        os.close(descriptor)
    fields = ("st_dev", "st_ino", "st_uid", "st_mode", "st_nlink", "st_size")
    if any(
        getattr(observed, field) != getattr(after, field)
        or getattr(observed, field) != getattr(current, field)
        for field in fields
    ):
        raise RuntimeAdmissionWiringError("python_executable_changed")
    if digest != expected_sha256:
        raise RuntimeAdmissionWiringError("python_executable_mismatch")
    return path


def read_external_bytes(path: Path, *, maximum: int = 64 * 1024) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise RuntimeAdmissionWiringError("external_file_invalid") from exc
    try:
        before = os.fstat(descriptor)
        if before.st_size < 1 or before.st_size > maximum:
            raise RuntimeAdmissionWiringError("external_file_invalid")
        payload = b""
        while len(payload) < before.st_size:
            chunk = os.read(descriptor, before.st_size - len(payload))
            if not chunk:
                raise RuntimeAdmissionWiringError("external_file_changed")
            payload += chunk
        after = os.fstat(descriptor)
        if (before.st_dev, before.st_ino, before.st_size) != (
            after.st_dev,
            after.st_ino,
            after.st_size,
        ):
            raise RuntimeAdmissionWiringError("external_file_changed")
        return payload
    finally:
        os.close(descriptor)


def _overlap(left: Path, right: Path) -> bool:
    return left == right or left.is_relative_to(right) or right.is_relative_to(left)


def _trust_descriptor(path: Path, suite: Path) -> dict[str, str]:
    if path.is_symlink() or not path.is_absolute():
        raise RuntimeAdmissionWiringError("trust_descriptor_invalid")
    try:
        descriptor = os.open(
            path,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
        )
        try:
            before = os.fstat(descriptor)
            payload = os.read(descriptor, 64 * 1024 + 1)
            after = os.fstat(descriptor)
            current = os.stat(path, follow_symlinks=False)
        finally:
            os.close(descriptor)
        fields = ("st_dev", "st_ino", "st_uid", "st_mode", "st_nlink", "st_size")
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_uid != os.geteuid()
            or before.st_nlink != 1
            or stat.S_IMODE(before.st_mode) != 0o644
            or (before.st_dev, before.st_ino, before.st_size)
            != (after.st_dev, after.st_ino, after.st_size)
            or any(
                getattr(before, field) != getattr(current, field) for field in fields
            )
            or len(payload) != before.st_size
        ):
            raise RuntimeAdmissionWiringError("trust_descriptor_invalid")
        blob = subprocess.run(
            (
                "/usr/bin/git",
                "-C",
                str(suite),
                "show",
                f"HEAD:{TRUST_DESCRIPTOR_RELATIVE}",
            ),
            check=True,
            capture_output=True,
            timeout=10,
            env={"LC_ALL": "C", "PATH": "/usr/bin:/bin"},
        ).stdout
        if blob != payload:
            raise RuntimeAdmissionWiringError("trust_descriptor_not_tracked")
        document = json.loads(payload)
    except (
        OSError,
        subprocess.SubprocessError,
        UnicodeDecodeError,
        json.JSONDecodeError,
    ) as exc:
        raise RuntimeAdmissionWiringError("trust_descriptor_invalid") from exc
    expected = {
        "allowed_signers_sha256",
        "key_fingerprint",
        "key_type",
        "namespace",
        "python_sha256",
        "schema",
        "signer",
    }
    canonical = (
        json.dumps(document, separators=(",", ":"), sort_keys=True).encode() + b"\n"
    )
    if (
        not isinstance(document, dict)
        or set(document) != expected
        or payload != canonical
        or document.get("schema") != "CYBRIK-UAT-SSH-AUTHORIZATION-TRUST/v1"
        or document.get("namespace") != AUTHORIZATION_NAMESPACE
        or document.get("key_type") != "ssh-ed25519"
        or document.get("signer") not in _SIGNERS
        or _HEX64.fullmatch(str(document.get("allowed_signers_sha256"))) is None
        or _FINGERPRINT.fullmatch(str(document.get("key_fingerprint"))) is None
        or _HEX64.fullmatch(str(document.get("python_sha256"))) is None
    ):
        raise RuntimeAdmissionWiringError("trust_descriptor_invalid")
    return {str(key): str(value) for key, value in document.items()}


def _allowed_signers_identity(payload: bytes) -> tuple[str, str, str]:
    try:
        line = payload.decode("ascii")
        fields = line.removesuffix("\n").split(" ")
        signer, option, key_type, encoded = fields
        key_blob = base64.b64decode(encoded, validate=True)
    except (UnicodeDecodeError, ValueError) as exc:
        raise RuntimeAdmissionWiringError("allowed_signers_invalid") from exc
    if (
        not line.endswith("\n")
        or "\n" in line[:-1]
        or key_type != "ssh-ed25519"
        or option != f'namespaces="{AUTHORIZATION_NAMESPACE}"'
    ):
        raise RuntimeAdmissionWiringError("allowed_signers_invalid")
    fingerprint = "SHA256:" + base64.b64encode(
        hashlib.sha256(key_blob).digest()
    ).decode().rstrip("=")
    return signer, key_type, fingerprint


def load_runtime_environment(environment: Mapping[str, str]) -> RuntimeEnvironment:
    unknown = {
        name
        for name in environment
        if name.startswith("CYBRIK_UAT_") and name not in _ENVIRONMENT_NAMES
    }
    if unknown:
        raise RuntimeAdmissionWiringError("environment_unknown")
    if any(name not in environment for name in _ENVIRONMENT_NAMES):
        raise RuntimeAdmissionWiringError("environment_missing")
    roots = tuple(
        _directory(
            _required(environment, name), mode=None, reason="repository_root_invalid"
        )
        for name in (
            "CYBRIK_UAT_SUITE_ROOT",
            "CYBRIK_UAT_SOC_ROOT",
            "CYBRIK_UAT_CYBER_AI_ROOT",
            "CYBRIK_UAT_TOOL_FABRIC_ROOT",
        )
    )
    suite, soc, ai, fabric = roots
    repositories = RepositoryLayout(
        suite=suite,
        soc=soc,
        cyber_ai=ai,
        tool_fabric=fabric,
        soc_source=_directory(
            str(soc / "services/api/src"), mode=None, reason="product_source_invalid"
        ),
        cyber_ai_api_source=_directory(
            str(ai / "services/ai-api/src"), mode=None, reason="product_source_invalid"
        ),
        cyber_ai_core_source=_directory(
            str(ai / "packages/ai-core/src"), mode=None, reason="product_source_invalid"
        ),
        tool_fabric_source=_directory(
            str(fabric / "src/control-plane"),
            mode=None,
            reason="product_source_invalid",
        ),
    )
    external = ExternalRoots(
        *(
            _directory(
                _required(environment, name), mode=0o700, reason="external_root_invalid"
            )
            for name in (
                "CYBRIK_UAT_RUNTIME_ROOT",
                "CYBRIK_UAT_EVIDENCE_ROOT",
                "CYBRIK_UAT_STATE_ROOT",
            )
        )
    )
    externals = external.runtime_root, external.evidence_root, external.state_root
    if any(
        _overlap(left, right)
        for index, left in enumerate(externals)
        for right in externals[index + 1 :]
    ):
        raise RuntimeAdmissionWiringError("external_roots_not_disjoint")
    if any(
        _overlap(external_root, repo) for external_root in externals for repo in roots
    ):
        raise RuntimeAdmissionWiringError("external_root_inside_repository")
    signer = _required(environment, "CYBRIK_UAT_ALLOWED_SIGNER")
    descriptor_path = suite / TRUST_DESCRIPTOR_RELATIVE
    descriptor = _trust_descriptor(descriptor_path, suite)
    if signer not in _SIGNERS or signer != descriptor["signer"]:
        raise RuntimeAdmissionWiringError("signer_not_allowed")
    allowed = _file(
        _required(environment, "CYBRIK_UAT_AUTHORIZATION_ALLOWED_SIGNERS"), mode=0o600
    )
    allowed_payload = read_external_bytes(allowed)
    observed_signer, key_type, fingerprint = _allowed_signers_identity(allowed_payload)
    if (
        hashlib.sha256(allowed_payload).hexdigest()
        != descriptor["allowed_signers_sha256"]
        or observed_signer != signer
        or key_type != descriptor["key_type"]
        or fingerprint != descriptor["key_fingerprint"]
    ):
        raise RuntimeAdmissionWiringError("trust_anchor_mismatch")
    wheel = _file(_required(environment, "CYBRIK_UAT_B1_WHEEL"), mode=0o600)
    if wheel.name != B1_WHEEL_FILENAME:
        raise RuntimeAdmissionWiringError("external_file_invalid")
    return RuntimeEnvironment(
        repositories=repositories,
        external=external,
        authorization_file=_file(
            _required(environment, "CYBRIK_UAT_AUTHORIZATION_FILE"), mode=0o600
        ),
        signature_file=_file(
            _required(environment, "CYBRIK_UAT_AUTHORIZATION_SIGNATURE"), mode=0o600
        ),
        allowed_signers_file=allowed,
        allowed_signer=signer,
        b1_wheel=wheel,
        python=_executable(
            _required(environment, "CYBRIK_UAT_PYTHON"), descriptor["python_sha256"]
        ),
        trust_descriptor=descriptor_path,
        authorization_namespace=descriptor["namespace"],
    )


def ensure_one_shot_available(authorization: object, state_root: Path) -> None:
    identifier = getattr(authorization, "authorization_id", None)
    if not isinstance(identifier, str) or not identifier:
        raise RuntimeAdmissionWiringError("authorization_invalid")
    try:
        os.lstat(state_root / f"{identifier}.consumed.json")
    except FileNotFoundError:
        return
    except OSError as exc:
        raise RuntimeAdmissionWiringError("authorization_consumed") from exc
    raise RuntimeAdmissionWiringError("authorization_consumed")


def verify_signed_intent(config: RuntimeEnvironment) -> SignedIntent:
    payload = read_external_bytes(config.authorization_file)
    signature = read_external_bytes(config.signature_file)
    try:
        result = subprocess.run(
            (
                "/usr/bin/ssh-keygen",
                "-Y",
                "verify",
                "-f",
                str(config.allowed_signers_file),
                "-I",
                config.allowed_signer,
                "-n",
                config.authorization_namespace,
                "-s",
                str(config.signature_file),
            ),
            input=payload,
            capture_output=True,
            check=False,
            timeout=10,
            env={"LC_ALL": "C", "PATH": "/usr/bin:/bin"},
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeAdmissionWiringError("authorization_signature_invalid") from exc
    if result.returncode != 0:
        raise RuntimeAdmissionWiringError("authorization_signature_invalid")
    try:
        document = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeAdmissionWiringError("authorization_json_invalid") from exc
    tuple_document = document.get("tuple") if isinstance(document, dict) else None
    if (
        not isinstance(document, dict)
        or document.get("authorized_by") != config.allowed_signer
        or not isinstance(tuple_document, dict)
        or set(tuple_document) != set(admission.REPOSITORY_ROLES)
    ):
        raise RuntimeAdmissionWiringError("authorization_tuple_invalid")
    expectations = []
    for role, root in zip(
        admission.REPOSITORY_ROLES, config.repositories.roots, strict=True
    ):
        pins = tuple_document.get(role)
        if not isinstance(pins, dict) or set(pins) != {"commit", "tree"}:
            raise RuntimeAdmissionWiringError("authorization_tuple_invalid")
        expectations.append(
            admission.RepoExpectation(role, root, pins["commit"], pins["tree"])
        )
    return SignedIntent(tuple(expectations), payload, signature)


__all__ = [
    "AUTHORIZATION_NAMESPACE",
    "B1_WHEEL_FILENAME",
    "TRUST_DESCRIPTOR_RELATIVE",
    "ExternalRoots",
    "RepositoryLayout",
    "RuntimeAdmissionWiringError",
    "RuntimeEnvironment",
    "SignedIntent",
    "ensure_one_shot_available",
    "load_runtime_environment",
    "read_external_bytes",
    "verify_signed_intent",
]
