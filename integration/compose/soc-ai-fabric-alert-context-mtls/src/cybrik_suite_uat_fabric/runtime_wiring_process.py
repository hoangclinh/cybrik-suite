"""Concrete process/session preparation for the three-process UAT.

Importing this module is inert.  Files, PKI, subprocesses and loopback probes
are created only after :func:`prepare_concrete_runtime` is called by the
admitted outer wiring boundary.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import socket
import ssl
import subprocess
import time
import uuid
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from types import MappingProxyType
from typing import Protocol

from . import admission
from .runtime_cleanup import (
    remove_runtime_root as _remove_runtime_root,
)
from .runtime_cleanup import (
    runtime_root_clean,
)
from .runtime_process import PROCESS_PORTS, validate_metrics_readiness
from .runtime_wiring_admission import RuntimeAdmissionWiringError

_FABRIC_READINESS_PATH = "/api/v1/receipts/uat-readiness-absent"
_METRICS_READINESS_PATH = "/uat/v1/metrics"
_FABRIC_ABSENT_DOCUMENT = {
    "error": {"code": "RECEIPT_UNAVAILABLE", "retryable": False},
    "status": "unavailable",
}
_HARNESS_SOURCE = Path("integration/compose/soc-ai-fabric-alert-context-mtls/src")
_LIFECYCLE_B1_SOURCE = Path("integration/compose/soc-ai-lifecycle-create-mtls/src")


class RuntimeWiringProcessError(RuntimeAdmissionWiringError):
    """Stable refusal without reflecting subprocess or collaborator detail."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class RoleWiseSupervisor(Protocol):
    @property
    def owned_roles(self) -> tuple[str, ...]: ...

    def start_role(self, role: str) -> None: ...

    def stop_role(self, role: str) -> None: ...


class RuntimeAuthorizationBinding(Protocol):
    """Minimal source binding shared by standalone and master-reserved runs."""

    authorization_id: str
    authorization_sha256: str
    aggregate: admission.TrackedBlobAggregate
    observations: tuple[admission.RepositoryObservation, ...]


class AuthenticatedSupervisorController:
    """Own control-frame authority; never expose raw calls to the runner."""

    def __init__(
        self, *, supervisor: object, binding: object, capability: bytes
    ) -> None:
        from .runtime_supervisor import SupervisorBinding

        if not isinstance(binding, SupervisorBinding):
            raise RuntimeWiringProcessError("supervisor_binding_invalid")
        self._supervisor = supervisor
        self._binding = binding
        self._capability = capability
        self._uid = os.geteuid()
        self._ordinal = 0

    @property
    def owned_roles(self) -> tuple[str, ...]:
        roles = getattr(self._supervisor, "owned_roles", None)
        if not isinstance(roles, tuple):
            raise RuntimeWiringProcessError("supervisor_response_invalid")
        return roles

    def _dispatch(self, role: str, operation: str) -> None:
        from .runtime_supervisor import decode_response, encode_request

        self._ordinal += 1
        action = f"{operation}_{role}"
        frame = encode_request(
            binding=self._binding,
            capability=self._capability,
            request_id=f"wiring-{self._ordinal:02d}-{uuid.uuid4().hex}",
            action=action,
        )
        callback = getattr(self._supervisor, f"{operation}_role", None)
        if not callable(callback):
            raise RuntimeWiringProcessError("supervisor_interface_invalid")
        response = callback(role, frame, peer_uid=self._uid)
        document = decode_response(
            response, binding=self._binding, capability=self._capability
        )
        if document.get("action") != action:
            raise RuntimeWiringProcessError("supervisor_response_invalid")

    def start_role(self, role: str) -> None:
        self._dispatch(role, "start")

    def stop_role(self, role: str) -> None:
        self._dispatch(role, "stop")


@dataclass(frozen=True, slots=True)
class RoleHandle:
    role: str


class RuntimeSession:
    """Map runner callbacks one-for-one to an owned role-wise supervisor."""

    def __init__(
        self,
        *,
        supervisor: RoleWiseSupervisor,
        cleanup: Callable[[], None],
        absence_probe: Callable[[], Mapping[str, bool]],
        runtime_context: object | None = None,
    ) -> None:
        self._supervisor = supervisor
        self._cleanup = cleanup
        self._absence_probe = absence_probe
        self._runtime_context = runtime_context
        self._started: list[str] = []
        self._finalized = False

    @property
    def runtime_context(self) -> object | None:
        return self._runtime_context

    def start(self, role: str) -> RoleHandle:
        try:
            expected = ("soc", "fabric", "ai")[len(self._started)]
        except IndexError as exc:
            raise RuntimeWiringProcessError("start_order_invalid") from exc
        if role != expected:
            raise RuntimeWiringProcessError("start_order_invalid")
        self._supervisor.start_role(role)
        self._started.append(role)
        return RoleHandle(role)

    def wait_ready(self, handle: RoleHandle) -> None:
        if not isinstance(handle, RoleHandle) or handle.role not in self._started:
            raise RuntimeWiringProcessError("runtime_handle_invalid")
        if handle.role not in self._supervisor.owned_roles:
            raise RuntimeWiringProcessError("runtime_not_ready")

    def stop(self, handle: RoleHandle) -> None:
        if not isinstance(handle, RoleHandle) or not self._started:
            raise RuntimeWiringProcessError("runtime_handle_invalid")
        if self._started[-1] != handle.role:
            raise RuntimeWiringProcessError("stop_order_invalid")
        self._supervisor.stop_role(handle.role)
        self._started.pop()

    def finalize(self) -> None:
        if self._finalized:
            return
        try:
            while self._started:
                self._supervisor.stop_role(self._started.pop())
        finally:
            self._cleanup()
            self._finalized = True

    def verify_absent(self) -> Mapping[str, bool]:
        if not self._finalized:
            raise RuntimeWiringProcessError("runtime_not_finalized")
        return dict(self._absence_probe())


class SecureReceiptFileSystem:
    """Write public supervisor receipts once with mode 0600 and fsync."""

    def __init__(self, root: Path) -> None:
        self._root = _exact_directory(root, mode=0o700, reason="receipt_root_invalid")

    def write_once(self, name: str, payload: bytes) -> None:
        if not isinstance(name, str) or not name or Path(name).name != name:
            raise RuntimeWiringProcessError("receipt_write_failed")
        if not isinstance(payload, bytes):
            raise RuntimeWiringProcessError("receipt_write_failed")
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
        try:
            descriptor = os.open(self._root / name, flags, 0o600)
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(payload)
                stream.flush()
                os.fchmod(stream.fileno(), 0o600)
                os.fsync(stream.fileno())
            root_descriptor = os.open(self._root, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(root_descriptor)
            finally:
                os.close(root_descriptor)
        except OSError as exc:
            raise RuntimeWiringProcessError("receipt_write_failed") from exc


@dataclass(slots=True)
class RuntimeProcessContext:
    config: object
    authorization: RuntimeAuthorizationBinding
    pki: object
    settings: object
    config_path: Path
    journal_root: Path
    scratch_root: Path
    receipt_key: Path
    handles: dict[str, object]
    closers: list[Callable[[], None]]
    clients: Mapping[str, PinnedHttpsClient]


class _OwnedChild:
    def __init__(self, process: subprocess.Popen[bytes], log: object) -> None:
        self._process = process
        self._log = log

    @property
    def pid(self) -> int:
        return self._process.pid

    def poll(self) -> int | None:
        return self._process.poll()

    def terminate(self) -> None:
        self._process.terminate()

    def wait(self, timeout: float) -> int:
        result = self._process.wait(timeout=timeout)
        closer = getattr(self._log, "close", None)
        if callable(closer):
            closer()
        return result

    def kill(self) -> None:
        self._process.kill()


@dataclass(frozen=True, slots=True)
class HttpResponse:
    status_code: int
    document: object

    def json(self) -> object:
        return dict(self.document) if isinstance(self.document, dict) else self.document


class PinnedHttpsClient:
    """Minimal TLS 1.3 client pinned to loopback and one runtime CA."""

    def __init__(
        self,
        *,
        port: int,
        server_name: str,
        ca: Path,
        certificate: Path,
        private_key: Path,
    ) -> None:
        self._port = port
        self._server_name = server_name
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version = ssl.TLSVersion.TLSv1_3
        context.maximum_version = ssl.TLSVersion.TLSv1_3
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
        context.load_verify_locations(cafile=str(ca))
        context.load_cert_chain(certfile=str(certificate), keyfile=str(private_key))
        context.set_alpn_protocols(["http/1.1"])
        self._context = context

    def _request(self, method: str, path: str, **kwargs: object) -> HttpResponse:
        if method not in {"GET", "POST"} or not path.startswith("/"):
            raise RuntimeWiringProcessError("http_request_invalid")
        body = b""
        headers = kwargs.get("headers", {})
        if not isinstance(headers, Mapping):
            raise RuntimeWiringProcessError("http_request_invalid")
        normalized = {str(key): str(value) for key, value in headers.items()}
        if method == "POST":
            try:
                body = json.dumps(
                    kwargs.get("json"), separators=(",", ":"), sort_keys=True
                ).encode("utf-8")
            except (TypeError, ValueError) as exc:
                raise RuntimeWiringProcessError("http_request_invalid") from exc
            normalized["Content-Type"] = "application/json"
        normalized.update(
            {
                "Content-Length": str(len(body)),
                "Connection": "close",
                "Host": self._server_name,
            }
        )
        head = (
            f"{method} {path} HTTP/1.1\r\n"
            + "".join(
                f"{key}: {value}\r\n" for key, value in sorted(normalized.items())
            )
            + "\r\n"
        ).encode("ascii")
        try:
            with (
                socket.create_connection(("127.0.0.1", self._port), timeout=2.0) as raw,
                self._context.wrap_socket(
                    raw, server_hostname=self._server_name
                ) as connection,
            ):
                connection.settimeout(5.0)
                connection.sendall(head + body)
                chunks: list[bytes] = []
                total = 0
                while total <= 1024 * 1024:
                    chunk = connection.recv(64 * 1024)
                    if not chunk:
                        break
                    chunks.append(chunk)
                    total += len(chunk)
        except (OSError, ssl.SSLError) as exc:
            raise RuntimeWiringProcessError("http_request_failed") from exc
        payload = b"".join(chunks)
        header, separator, response_body = payload.partition(b"\r\n\r\n")
        first = header.split(b"\r\n", 1)[0].split(b" ")
        if separator != b"\r\n\r\n" or len(first) < 2:
            raise RuntimeWiringProcessError("http_response_invalid")
        try:
            return HttpResponse(int(first[1]), json.loads(response_body))
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeWiringProcessError("http_response_invalid") from exc

    def get(self, path: str) -> HttpResponse:
        return self._request("GET", path)

    def post(self, path: str, **kwargs: object) -> HttpResponse:
        return self._request("POST", path, **kwargs)

    def close(self) -> None:
        return None


def _exact_directory(path: Path, *, mode: int, reason: str) -> Path:
    if not path.is_absolute() or path.is_symlink():
        raise RuntimeWiringProcessError(reason)
    try:
        observed = os.lstat(path)
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise RuntimeWiringProcessError(reason) from exc
    if (
        resolved != path
        or not path.is_dir()
        or observed.st_uid != os.geteuid()
        or (observed.st_mode & 0o777) != mode
    ):
        raise RuntimeWiringProcessError(reason)
    return path


def _existing_source(path: Path) -> Path:
    if not path.is_absolute() or path.is_symlink():
        raise RuntimeWiringProcessError("product_source_invalid")
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise RuntimeWiringProcessError("product_source_invalid") from exc
    if resolved != path or not path.is_dir():
        raise RuntimeWiringProcessError("product_source_invalid")
    return path


def build_child_environment(config: object, config_path: Path) -> dict[str, str]:
    """Build the exact allowlisted child environment, including the D2 B1 source."""

    repositories = getattr(config, "repositories", None)
    suite = getattr(repositories, "suite", None)
    if (
        not isinstance(suite, Path)
        or not suite.is_absolute()
        or not config_path.is_absolute()
    ):
        raise RuntimeWiringProcessError("child_environment_invalid")
    sources = (
        _existing_source(suite / _HARNESS_SOURCE),
        _existing_source(suite / _LIFECYCLE_B1_SOURCE),
        _existing_source(getattr(repositories, "soc_source", Path())),
        _existing_source(getattr(repositories, "cyber_ai_api_source", Path())),
        _existing_source(getattr(repositories, "cyber_ai_core_source", Path())),
        _existing_source(getattr(repositories, "tool_fabric_source", Path())),
    )
    return {
        "CYBRIK_UAT_RUNTIME_CONFIG": str(config_path),
        "LC_ALL": "C",
        "PATH": "/usr/bin:/bin",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONPATH": os.pathsep.join(str(source) for source in sources),
        "PYTHONSAFEPATH": "1",
    }


def build_child_argv(config: object, role: str) -> tuple[str, ...]:
    """Return the exact safe-mode interpreter invocation for one owned role."""

    python = getattr(config, "python", None)
    if (
        role not in PROCESS_PORTS
        or not isinstance(python, Path)
        or not python.is_absolute()
    ):
        raise RuntimeWiringProcessError("process_role_invalid")
    return (
        str(python),
        "-B",
        "-P",
        "-m",
        "cybrik_suite_uat_fabric.runtime_process",
        role,
    )


def validate_readiness_response(role: str, response: object) -> None:
    """Accept only exact authenticated responses from the role's real route."""

    if role in {"soc", "ai"}:
        try:
            validate_metrics_readiness(role, response)
        except Exception:  # noqa: BLE001 - collaborator detail is not reflected.
            raise RuntimeWiringProcessError("readiness_response_invalid") from None
        return
    if role != "fabric" or getattr(response, "status_code", None) != 404:
        raise RuntimeWiringProcessError("readiness_response_invalid")
    decoder = getattr(response, "json", None)
    if not callable(decoder):
        raise RuntimeWiringProcessError("readiness_response_invalid")
    try:
        document = decoder()
    except Exception:  # noqa: BLE001 - collaborator detail is not reflected.
        raise RuntimeWiringProcessError("readiness_response_invalid") from None
    if document != _FABRIC_ABSENT_DOCUMENT:
        raise RuntimeWiringProcessError("readiness_response_invalid")


def _mkdir(path: Path) -> Path:
    try:
        path.mkdir(mode=0o700)
        path.chmod(0o700)
    except OSError as exc:
        raise RuntimeWiringProcessError("runtime_preparation_failed") from exc
    return path


def _write_private(path: Path, payload: bytes) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags, 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fchmod(stream.fileno(), 0o600)
            os.fsync(stream.fileno())
    except OSError as exc:
        raise RuntimeWiringProcessError("runtime_preparation_failed") from exc


def _source_tuple_sha256(authorization: RuntimeAuthorizationBinding) -> str:
    rows = [
        f"{item.role}\0{item.commit}\0{item.tree}\n"
        for item in authorization.observations
    ]
    rows.append(f"tracked_blob_aggregate\0{authorization.aggregate.sha256}\n")
    return hashlib.sha256("".join(rows).encode()).hexdigest()


def _client_document(material: object) -> dict[str, str]:
    return {
        "certificate": str(material.client_certificate),  # type: ignore[attr-defined]
        "private_key": str(material.client_private_key),  # type: ignore[attr-defined]
        "ca_certificate": str(material.ca_certificate),  # type: ignore[attr-defined]
    }


def prepare_concrete_runtime(
    config: object,
    authorization: RuntimeAuthorizationBinding,
    *,
    preserve_runtime_root: bool = False,
    tracked_allowlist: Mapping[str, Sequence[str]],
) -> RuntimeSession:  # pragma: no cover - requires the separately authorized live UAT.
    """Prepare admitted runtime material and return an inert role-wise session."""

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    from . import b1_runtime, receipt_identity, runtime_composition, runtime_pki
    from .runtime_supervisor import (
        AuthenticatedRuntimeSupervisor,
        SignedReceiptWriter,
        SupervisorBinding,
    )

    b1_runtime.verify_b1_artifact(config.b1_wheel)  # type: ignore[attr-defined]
    external = config.external  # type: ignore[attr-defined]
    repositories = config.repositories  # type: ignore[attr-defined]
    root = external.runtime_root
    if any(root.iterdir()):
        raise RuntimeWiringProcessError("external_root_not_empty")
    pki_root = _mkdir(root / "pki")
    journal_root = _mkdir(root / "journal")
    logs_root = _mkdir(root / "logs")
    receipts_root = _mkdir(root / "receipts")
    scratch_parent = _mkdir(root / "scratch")
    receipt_key = root / "receipt-signing-key.pem"
    private = Ed25519PrivateKey.generate()
    _write_private(
        receipt_key,
        private.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ),
    )
    observed = os.lstat(pki_root)
    with runtime_pki.authorized_pki_root(
        pki_root,
        expected_device=observed.st_dev,
        expected_inode=observed.st_ino,
        expected_uid=observed.st_uid,
        expected_mode=0o700,
    ) as capability:
        pki = runtime_pki.create_runtime_pki(
            capability, repository_roots=repositories.roots
        )
    channels = {item.role: item for item in pki.channels}
    driver_ai = channels["driver_to_cyber_ai"]
    ai_fabric = channels["cyber_ai_to_tool_fabric"]
    fabric_soc = channels["tool_fabric_to_soc"]
    settings = runtime_composition.RuntimeCompositionSettings(
        roots=runtime_composition.AdmittedProductRoots(
            soc=repositories.soc_source,
            cyber_ai_api=repositories.cyber_ai_api_source,
            cyber_ai_core=repositories.cyber_ai_core_source,
            tool_fabric=repositories.tool_fabric_source,
        ),
        journal_root=journal_root,
        server_tls={
            "soc": runtime_composition.ServerTlsMaterial(
                fabric_soc.server_certificate,
                fabric_soc.server_private_key,
                fabric_soc.ca_certificate,
            ),
            "fabric": runtime_composition.ServerTlsMaterial(
                ai_fabric.server_certificate,
                ai_fabric.server_private_key,
                ai_fabric.ca_certificate,
            ),
            "ai": runtime_composition.ServerTlsMaterial(
                driver_ai.server_certificate,
                driver_ai.server_private_key,
                driver_ai.ca_certificate,
            ),
        },
        fabric_to_soc=runtime_composition.ClientTlsMaterial(
            fabric_soc.client_certificate,
            fabric_soc.client_private_key,
            fabric_soc.ca_certificate,
        ),
        ai_to_fabric=runtime_composition.ClientTlsMaterial(
            ai_fabric.client_certificate,
            ai_fabric.client_private_key,
            ai_fabric.ca_certificate,
        ),
        driver_certificate=driver_ai.client_certificate,
        receipt_signing_key=receipt_key,
    )
    config_path = root / "runtime-config.json"
    document = {
        "roots": {
            key: str(value) for key, value in settings.roots.as_mapping().items()
        },
        "journal_root": str(journal_root),
        "server_tls": {
            role: {
                "certificate": str(material.certificate),
                "private_key": str(material.private_key),
                "ca_certificate": str(material.ca_certificate),
            }
            for role, material in settings.server_tls.items()
        },
        "fabric_to_soc": _client_document(fabric_soc),
        "ai_to_fabric": _client_document(ai_fabric),
        "driver_certificate": str(driver_ai.client_certificate),
        "receipt_signing_key": str(receipt_key),
    }
    _write_private(
        config_path,
        json.dumps(document, separators=(",", ":"), sort_keys=True).encode(),
    )
    handles: dict[str, object] = {}
    clients = {
        "soc": PinnedHttpsClient(
            port=PROCESS_PORTS["soc"],
            server_name=fabric_soc.server_name,
            ca=fabric_soc.ca_certificate,
            certificate=fabric_soc.client_certificate,
            private_key=fabric_soc.client_private_key,
        ),
        "fabric": PinnedHttpsClient(
            port=PROCESS_PORTS["fabric"],
            server_name=ai_fabric.server_name,
            ca=ai_fabric.ca_certificate,
            certificate=ai_fabric.client_certificate,
            private_key=ai_fabric.client_private_key,
        ),
        "ai": PinnedHttpsClient(
            port=PROCESS_PORTS["ai"],
            server_name=driver_ai.server_name,
            ca=driver_ai.ca_certificate,
            certificate=driver_ai.client_certificate,
            private_key=driver_ai.client_private_key,
        ),
    }
    context = RuntimeProcessContext(
        config=config,
        authorization=authorization,
        pki=pki,
        settings=settings,
        config_path=config_path,
        journal_root=journal_root,
        scratch_root=scratch_parent / "tampered-copy",
        receipt_key=receipt_key,
        handles=handles,
        closers=[],
        clients=MappingProxyType(clients),
    )
    context.closers.extend(client.close for client in clients.values())
    child_environment = build_child_environment(config, config_path)

    def process_factory(role: str) -> _OwnedChild:
        descriptor = os.open(
            logs_root / f"{role}.log",
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
            0o600,
        )
        log = os.fdopen(descriptor, "wb")
        try:
            process = subprocess.Popen(
                build_child_argv(config, role),
                cwd=repositories.suite,
                env=child_environment,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=subprocess.STDOUT,
                close_fds=True,
            )
        except BaseException:
            log.close()
            raise
        child = _OwnedChild(process, log)
        handles[role] = child
        return child

    def readiness(role: str, handle: object) -> None:
        path = (
            _METRICS_READINESS_PATH if role in {"soc", "ai"} else _FABRIC_READINESS_PATH
        )
        for _attempt in range(50):
            if handle.poll() is not None:  # type: ignore[attr-defined]
                raise RuntimeWiringProcessError("process_exited_before_ready")
            try:
                validate_readiness_response(role, clients[role].get(path))
                return
            except RuntimeWiringProcessError:
                time.sleep(0.1)
        raise RuntimeWiringProcessError("process_readiness_timeout")

    identity = receipt_identity.load_external_receipt_identity(
        receipt_key, forbidden_roots=repositories.roots
    )
    capability_bytes = secrets.token_bytes(32)
    binding = SupervisorBinding(
        authorization_sha256=authorization.authorization_sha256,
        source_tuple_sha256=_source_tuple_sha256(authorization),
        run_id=authorization.authorization_id,
        owner_uid=os.geteuid(),
    )
    supervisor = AuthenticatedRuntimeSupervisor(
        binding=binding,
        capability=capability_bytes,
        process_factory=process_factory,
        readiness_probe=readiness,
        receipt_writer=SignedReceiptWriter(
            filesystem=SecureReceiptFileSystem(receipts_root),
            signer=identity.sign,
            clock=lambda: datetime.now(UTC),
        ),
    )
    controller = AuthenticatedSupervisorController(
        supervisor=supervisor, binding=binding, capability=capability_bytes
    )

    def absence() -> Mapping[str, bool]:
        process_absent = {
            role: handle.poll() is not None  # type: ignore[attr-defined]
            for role, handle in handles.items()
        }
        listeners: dict[str, bool] = {}
        for role, port in PROCESS_PORTS.items():
            probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                probe.settimeout(0.2)
                listeners[role] = probe.connect_ex(("127.0.0.1", port)) != 0
            finally:
                probe.close()
        try:
            observations = admission.observe_exact_tuple(
                tuple(
                    admission.RepoExpectation(
                        item.role, item.root, item.commit, item.tree
                    )
                    for item in authorization.observations
                )
            )
            clean = (
                admission.tracked_blob_aggregate(observations, tracked_allowlist)
                == authorization.aggregate
            )
        except Exception:  # noqa: BLE001 - absence is fail-closed.
            clean = False
        root_clean = runtime_root_clean(root, preserve_root=preserve_runtime_root)
        return {
            "ai_listener_absent": listeners["ai"],
            "ai_process_absent": process_absent.get("ai", True),
            "fabric_listener_absent": listeners["fabric"],
            "fabric_process_absent": process_absent.get("fabric", True),
            "private_material_absent": root_clean,
            "repository_residual_absent": clean,
            "runtime_root_absent": root_clean,
            "soc_listener_absent": listeners["soc"],
            "soc_process_absent": process_absent.get("soc", True),
        }

    return RuntimeSession(
        supervisor=controller,
        cleanup=lambda: _remove_runtime_root(
            context, preserve_root=preserve_runtime_root
        ),
        absence_probe=absence,
        runtime_context=context,
    )


__all__ = [
    "AuthenticatedSupervisorController",
    "PinnedHttpsClient",
    "RoleHandle",
    "RuntimeAuthorizationBinding",
    "RuntimeProcessContext",
    "RuntimeSession",
    "RuntimeWiringProcessError",
    "SecureReceiptFileSystem",
    "build_child_argv",
    "build_child_environment",
    "prepare_concrete_runtime",
    "validate_readiness_response",
]
