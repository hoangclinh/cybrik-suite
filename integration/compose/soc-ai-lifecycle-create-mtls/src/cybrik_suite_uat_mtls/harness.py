"""Fail-closed lifecycle and one-attempt driver for UAT-MTLS-D2.

Status: ``AUTHORED — NOT RUN``. Every mutating entrypoint begins by validating
the committed candidate, exact authorization artifact digest, exact clean Suite
commit and external runtime roots. Importing this module is inert.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import shutil
import signal
import socket
import ssl
import subprocess
import sys
import sysconfig
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Final

from . import (
    evidence,
    pki,
    procedure,
    runtime_authorization,
    runtime_evidence,
    secret_inventory,
    store,
    terminal_integration,
)

RESOURCE_KINDS = (
    "ai_process",
    "client_process",
    "postgres_container",
    "ai_listener",
    "postgres_listener",
    "runtime_directory",
    "pki_material",
)

_AUTHORIZATION_SHA_ENV: Final = "CYBRIK_UAT_D2_AUTHORIZATION_SHA256"
_RUNTIME_DIR_ENV: Final = "CYBRIK_UAT_D2_RUNTIME_DIR"
_EVIDENCE_DIR_ENV: Final = "CYBRIK_UAT_D2_EVIDENCE_DIR"
_SOC_REPO_ENV: Final = "CYBRIK_UAT_D2_SOC_REPO"
_AI_REPO_ENV: Final = "CYBRIK_UAT_D2_AI_REPO"
_FABRIC_REPO_ENV: Final = "CYBRIK_UAT_D2_FABRIC_REPO"
_PASSWORD_FILE: Final = "postgres-password"
_SERVER_LOG: Final = "ai-server.log"
_SERVER_PID: Final = "ai-server.pid"
_CLIENT_PID: Final = "soc-client.pid"
_TLS_EVIDENCE: Final = "tls-extension.json"
_SSL_CONTEXT_EVIDENCE: Final = "ssl-context.json"
_POSTGRES_SECURITY_EVIDENCE: Final = "postgres-security.json"
_AUTHORITY_BINDING_EVIDENCE: Final = "authority-binding.json"
_B1_BINDING_EVIDENCE: Final = "b1-binding.json"
_SECRET_SWEEP_EVIDENCE: Final = "secret-sweep.json"
_B1_PROVENANCE_SHA256: Final = (
    "ae8cfa7a0b15483377a4344eca37d2b5aefbb2b4030cf70cad9e6ca0175540de"
)
_B1_CONTAINMENT_TEST_SHA256: Final = (
    "10ba8cb192415c52becfe41906f1d36a43ed4720a68d291b10f1702bde80ff14"
)
_B1_LOADER_BASE_SHA256: Final = (
    "d6c7cef7e7d17ef677fe21b3ee1c88df6e1a5c5841c951a60202fbf8db8a39a1"
)
_PUBLIC_PKI_FILES: Final = (
    ("ca_certificate", "ca-cert.pem"),
    ("server_certificate", "server-cert.pem"),
    ("client_certificate", "client-cert.pem"),
    ("alternate_client_certificate", "alternate-client-cert.pem"),
    ("jwt_public_jwk", "jwt-public-jwk.json"),
)
_TERMINAL_ARTIFACTS: Final = (
    *(f"case-n{ordinal}.json" for ordinal in range(1, 11)),
    _AUTHORITY_BINDING_EVIDENCE,
    _B1_BINDING_EVIDENCE,
    _TLS_EVIDENCE,
    _SSL_CONTEXT_EVIDENCE,
    _POSTGRES_SECURITY_EVIDENCE,
    _SECRET_SWEEP_EVIDENCE,
)
_ISOLATED_MODULE_BOOTSTRAP: Final = """
import os
import runpy
import sys

roots = tuple(sys.argv[1].split(os.pathsep))
repositories = tuple(sys.argv[2].split(os.pathsep))
if not sys.flags.isolated or not sys.flags.no_site or not sys.flags.safe_path:
    raise SystemExit("unsafe Python startup flags")
if not sys.dont_write_bytecode:
    raise SystemExit("Python bytecode writes are enabled")
if (
    not roots
    or not repositories
    or len(set(roots)) != len(roots)
    or len(set(repositories)) != len(repositories)
    or any(not item or not os.path.isabs(item) for item in (*roots, *repositories))
):
    raise SystemExit("unsafe Python import roots")
if any(item in {"", ".", os.getcwd()} for item in sys.path):
    raise SystemExit("unsafe Python import path")
interpreter_roots = tuple(
    item for item in sys.path if item and os.path.isabs(item) and item not in roots
)
sys.path[:] = [*roots, *interpreter_roots]
if tuple(sys.path) != (*roots, *interpreter_roots):
    raise SystemExit("effective Python import path mismatch")
for item in sys.path[len(roots):]:
    resolved = os.path.realpath(item)
    if any(
        os.path.commonpath((resolved, os.path.realpath(repository)))
        == os.path.realpath(repository)
        for repository in repositories
    ):
        raise SystemExit("repository import path escaped admitted prefix")
module = sys.argv[3]
sys.argv = [module, *sys.argv[4:]]
runpy.run_module(module, run_name="__main__", alter_sys=True)
"""
_RUNTIME_ROOT_NAME = re.compile(r"^cybrik-uat-d2-runtime-[a-z0-9][a-z0-9._-]{0,63}$")
_EVIDENCE_ROOT_NAME = re.compile(r"^cybrik-uat-d2-evidence-[a-z0-9][a-z0-9._-]{0,63}$")
_JWT_LIKE = re.compile(
    r"(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{5,}\."
    r"[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])"
)


class RuntimeAuthorizationError(RuntimeError):
    """The one exact D2 attempt is closed or its evidence is inconsistent."""


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _absolute_env(name: str, *, must_exist: bool) -> Path:
    raw = os.environ.get(name, "")
    candidate = Path(raw)
    if (
        not raw
        or not candidate.is_absolute()
        or raw.startswith("//")
        or raw != os.path.normpath(raw)
        or raw != str(candidate)
    ):
        raise RuntimeAuthorizationError("required D2 absolute path is absent")
    if must_exist:
        return candidate.resolve(strict=True)
    return candidate.parent.resolve(strict=True) / candidate.name


def _outside_repositories(
    candidate: Path, *, repositories_must_exist: bool = True
) -> None:
    roots = (_repo_root(),) + tuple(
        _absolute_env(name, must_exist=repositories_must_exist)
        for name in (_SOC_REPO_ENV, _AI_REPO_ENV, _FABRIC_REPO_ENV)
    )
    for root in roots:
        if (
            candidate == root
            or candidate.is_relative_to(root)
            or root.is_relative_to(candidate)
        ):
            raise RuntimeAuthorizationError(
                "D2 runtime material must remain outside repositories"
            )


def _bounded_external_roots(*, repositories_must_exist: bool) -> tuple[Path, Path]:
    runtime_root = _absolute_env(_RUNTIME_DIR_ENV, must_exist=False)
    evidence_root = _absolute_env(_EVIDENCE_DIR_ENV, must_exist=False)
    for root, expected_name in (
        (runtime_root, _RUNTIME_ROOT_NAME),
        (evidence_root, _EVIDENCE_ROOT_NAME),
    ):
        if root == Path(root.anchor) or root.name in {"", ".", ".."}:
            raise RuntimeAuthorizationError("D2 external root is unsafe")
        if expected_name.fullmatch(root.name) is None:
            raise RuntimeAuthorizationError(
                "D2 external root name is not purpose-bound"
            )
        _outside_repositories(root, repositories_must_exist=repositories_must_exist)
    if (
        runtime_root == evidence_root
        or runtime_root.is_relative_to(evidence_root)
        or evidence_root.is_relative_to(runtime_root)
    ):
        raise RuntimeAuthorizationError("runtime and evidence roots must be disjoint")
    return runtime_root, evidence_root


def assert_product_api_compatibility(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> None:
    """Import the exact pinned SOC/AI symbols before creating any resource."""

    try:
        from cybrik_ai_api.runtime_composition import (
            LifecycleRuntimeCompositionDeps,
            compose_lifecycle_runtime,
        )
        from cybrik_ai_api.transport_security import AsgiTlsTransportResolver
        from cybrik_ai_core.delegation import PinnedTrustProvider
        from cybrik_soc.modules.copilot.lifecycle_create import LifecycleCreateClient
        from cybrik_soc.platform.svc_delegation import (
            AsymmetricJwtDelegationIssuer,
            MintedToken,
        )

        from_pinned_jwks = PinnedTrustProvider.from_pinned_jwks
    except (ImportError, AttributeError) as exc:
        raise RuntimeAuthorizationError(
            "pinned product API surface is unavailable"
        ) from exc
    required = (
        LifecycleRuntimeCompositionDeps,
        compose_lifecycle_runtime,
        AsgiTlsTransportResolver,
        from_pinned_jwks,
        LifecycleCreateClient,
        AsymmetricJwtDelegationIssuer,
        MintedToken,
    )
    if not all(callable(symbol) for symbol in required):
        raise RuntimeAuthorizationError("pinned product API surface is incompatible")
    module_origins: list[tuple[str, Path]] = []
    for symbol in required:
        module_name = getattr(symbol, "__module__", None)
        if not isinstance(module_name, str):
            raise RuntimeAuthorizationError(
                "pinned product API module origin is unavailable"
            )
        module = sys.modules.get(module_name)
        module_file = getattr(module, "__file__", None)
        if not isinstance(module_file, str):
            raise RuntimeAuthorizationError(
                "pinned product API module origin is unavailable"
            )
        module_origins.append((module_name, Path(module_file)))
    try:
        runtime_authorization.verify_module_origins(authorization, module_origins)
        runtime_authorization.verify_loaded_module_origins(authorization)
    except runtime_authorization.RuntimeAuthorizationFailure as exc:
        raise RuntimeAuthorizationError(
            f"pinned product API module origin is refused: {exc.reason}"
        ) from exc


def assert_runtime_authorized() -> runtime_authorization.RuntimeAuthorization:
    """Validate every Phase A exact binding, returning only an admitted tuple."""

    try:
        return runtime_authorization.authorize_from_environment()
    except runtime_authorization.RuntimeAuthorizationFailure as exc:
        raise RuntimeAuthorizationError(
            f"runtime authorization is closed: {exc.reason}"
        ) from exc


def _isolated_module_argv(
    authorization: runtime_authorization.RuntimeAuthorization,
    module: str,
) -> tuple[str, ...]:
    """Build the same isolated, exact-source bootstrap used by the runner."""

    try:
        source_roots = runtime_authorization.resolve_import_source_roots(authorization)
    except runtime_authorization.RuntimeAuthorizationFailure as exc:
        raise RuntimeAuthorizationError(
            f"isolated child import roots are refused: {exc.reason}"
        ) from exc
    purelib = Path(sysconfig.get_path("purelib")).resolve(strict=True)
    platlib = Path(sysconfig.get_path("platlib")).resolve(strict=True)
    roots = tuple(dict.fromkeys((*source_roots, purelib, platlib)))
    repositories = (
        authorization.suite_root,
        *tuple(authorization.product_roots.values()),
    )
    if (
        not module.startswith("cybrik_suite_uat_mtls.")
        or any(not root.is_absolute() or not root.is_dir() for root in roots)
        or any(not repository.is_absolute() for repository in repositories)
    ):
        raise RuntimeAuthorizationError("isolated child import roots are invalid")
    for dependency_root in roots[len(source_roots) :]:
        resolved_dependency = dependency_root.resolve(strict=True)
        for repository in repositories:
            resolved_repository = repository.resolve(strict=True)
            if resolved_dependency.is_relative_to(resolved_repository):
                raise RuntimeAuthorizationError(
                    "isolated child dependency root escaped confinement"
                )
    return (
        sys.executable,
        "-I",
        "-B",
        "-S",
        "-c",
        _ISOLATED_MODULE_BOOTSTRAP,
        os.pathsep.join(str(root) for root in roots),
        os.pathsep.join(str(root) for root in repositories),
        module,
    )


def _password(root: Path) -> str:
    path = root / _PASSWORD_FILE
    if not path.is_file() or path.is_symlink():
        raise RuntimeAuthorizationError("ephemeral PostgreSQL credential is absent")
    value = path.read_text(encoding="ascii")
    if len(value) < 32:
        raise RuntimeAuthorizationError("ephemeral PostgreSQL credential is invalid")
    return value


def _write_atomic_evidence(destination: Path, record: object) -> None:
    if destination.exists() or destination.is_symlink():
        raise RuntimeAuthorizationError("terminal binding evidence already exists")
    temporary = destination.with_suffix(".tmp")
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except OSError as exc:
        raise RuntimeAuthorizationError(
            "atomic evidence temporary path is unavailable"
        ) from exc
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(json.dumps(record, sort_keys=True, separators=(",", ":")))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def _postgres_runtime(root: Path) -> store.PostgresRuntime:
    return store.PostgresRuntime(
        password=_password(root),
        ai_repository=_absolute_env(_AI_REPO_ENV, must_exist=True),
    )


def start() -> None:
    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    root = authorization.runtime_root
    evidence_root = authorization.evidence_root
    if (
        root.exists()
        or root.is_symlink()
        or evidence_root.exists()
        or evidence_root.is_symlink()
    ):
        raise RuntimeAuthorizationError("D2 external roots must be fresh")
    runtime_authorization.consume_once(authorization)
    root.mkdir(mode=0o700)
    os.chmod(root, 0o700)
    password_path = root / _PASSWORD_FILE
    descriptor = os.open(password_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="ascii") as stream:
            stream.write(secrets.token_hex(32))
            stream.flush()
            os.fsync(stream.fileno())
        store.start(_postgres_runtime(root))
    except BaseException:
        teardown()
        raise


def seed() -> None:
    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    runtime_authorization.verify_consumed(authorization)
    root = authorization.runtime_root
    material_root = root / "pki"
    pki.create_ephemeral_pki(
        material_root,
        repository_roots=(
            _repo_root(),
            _absolute_env(_SOC_REPO_ENV, must_exist=True),
            _absolute_env(_AI_REPO_ENV, must_exist=True),
            _absolute_env(_FABRIC_REPO_ENV, must_exist=True),
        ),
        jwt_kid="soc-lifecycle-d2-ephemeral",
    )


def reset() -> None:
    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    runtime_authorization.verify_consumed(authorization)
    runtime = _postgres_runtime(authorization.runtime_root)
    store.migrate(runtime)
    posture = evidence.validate_evidence(store.audit_security_posture(runtime))
    destination = authorization.evidence_root / _POSTGRES_SECURITY_EVIDENCE
    _write_atomic_evidence(destination, posture)


def stop() -> None:
    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    runtime_authorization.verify_consumed(authorization)
    store.stop()


def _pki_material(root: Path) -> pki.PkiMaterial:
    material_root = root / "pki"
    return pki.PkiMaterial(
        root=material_root,
        ca_certificate=material_root / "ca-cert.pem",
        server_certificate=material_root / "server-cert.pem",
        server_private_key=material_root / "server-key.pem",
        client_certificate=material_root / "client-cert.pem",
        client_private_key=material_root / "client-key.pem",
        alternate_client_certificate=material_root / "alternate-client-cert.pem",
        alternate_client_private_key=material_root / "alternate-client-key.pem",
        jwt_private_key=material_root / "jwt-signing-key.pem",
        jwt_public_jwk=material_root / "jwt-public-jwk.json",
    )


def rollback() -> None:
    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    runtime_root, evidence_root = _bounded_external_roots(repositories_must_exist=False)
    roots_exist = (
        runtime_root.exists()
        or runtime_root.is_symlink()
        or evidence_root.exists()
        or evidence_root.is_symlink()
    )
    if not roots_exist:
        return
    try:
        marker = runtime_authorization.verify_consumed(authorization)
    except runtime_authorization.RuntimeAuthorizationFailure as exc:
        raise RuntimeAuthorizationError(
            f"consumed authorization marker is invalid: {exc.reason}"
        ) from exc
    teardown()
    try:
        terminal_integration.finalize_terminal_handoff(
            authorization=authorization,
            consumed_marker=marker,
            live_absence_probe=_live_absence_state,
        )
    except terminal_integration.TerminalIntegrationError as exc:
        raise RuntimeAuthorizationError(
            f"terminal evidence finalization is refused: {exc.reason}"
        ) from exc


def _server_environment(
    root: Path, evidence_root: Path, *, strip_tls: bool
) -> dict[str, str]:
    runtime = _postgres_runtime(root)
    environment = dict(os.environ)
    environment.update(
        {
            "CYBRIK_UAT_D2_PKI_ROOT": str(root / "pki"),
            "CYBRIK_UAT_D2_JWKS": str(root / "pki/jwt-public-jwk.json"),
            "CYBRIK_UAT_D2_POSTGRES_DSN": runtime.admin_dsn,
            "CYBRIK_UAT_D2_STRIP_TLS_EXTENSION": "true" if strip_tls else "false",
            _RUNTIME_DIR_ENV: str(root),
            _EVIDENCE_DIR_ENV: str(evidence_root),
        }
    )
    return environment


def _spawn_server(
    root: Path,
    evidence_root: Path,
    authorization: runtime_authorization.RuntimeAuthorization,
    *,
    strip_tls: bool,
) -> tuple[subprocess.Popen[str], object]:
    pid_path = root / _SERVER_PID
    if pid_path.exists() or pid_path.is_symlink():
        raise RuntimeAuthorizationError("AI server process record already exists")
    log = (evidence_root / _SERVER_LOG).open("a", encoding="utf-8")
    try:
        process = subprocess.Popen(
            _isolated_module_argv(authorization, "cybrik_suite_uat_mtls.server"),
            stdout=log,
            stderr=subprocess.STDOUT,
            text=True,
            env=_server_environment(root, evidence_root, strip_tls=strip_tls),
            shell=False,
        )
        _record_pid(pid_path, process.pid)
    except BaseException:
        if "process" in locals() and process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        log.close()
        raise
    return process, log


def _record_pid(path: Path, pid: int) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="ascii") as stream:
        stream.write(str(pid))
        stream.flush()
        os.fsync(stream.fileno())


def _wait_ai_listener(root: Path, process: subprocess.Popen[str]) -> None:
    context = ssl.create_default_context(cafile=str(root / "pki/ca-cert.pem"))
    context.minimum_version = ssl.TLSVersion.TLSv1_3
    context.maximum_version = ssl.TLSVersion.TLSv1_3
    context.load_cert_chain(
        str(root / "pki/client-cert.pem"), str(root / "pki/client-key.pem")
    )
    for _ in range(80):
        if process.poll() is not None:
            raise RuntimeAuthorizationError("AI server exited before readiness")
        try:
            with (
                socket.create_connection(("127.0.0.1", 58443), timeout=0.25) as raw,
                context.wrap_socket(raw, server_hostname="127.0.0.1") as secured,
            ):
                if secured.version() == "TLSv1.3":
                    return
        except OSError:
            time.sleep(0.25)
    raise RuntimeAuthorizationError("AI mTLS listener readiness timed out")


def _stop_process(process: subprocess.Popen[str] | None, root: Path) -> None:
    if process is None:
        return
    try:
        if process.poll() is None:
            process.send_signal(signal.SIGTERM)
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
    finally:
        if process.poll() is not None:
            (root / _SERVER_PID).unlink(missing_ok=True)


def _stop_recorded_process(root: Path, *, pid_filename: str, identity: str) -> None:
    pid_path = root / pid_filename
    if not pid_path.exists():
        return
    if pid_path.is_symlink() or not pid_path.is_file():
        raise RuntimeAuthorizationError("AI server process record is unsafe")
    raw_pid = pid_path.read_text(encoding="ascii")
    if not raw_pid.isdecimal() or int(raw_pid) <= 1:
        raise RuntimeAuthorizationError("AI server process record is invalid")
    pid = int(raw_pid)
    inspection = subprocess.run(
        ("ps", "-p", str(pid), "-o", "command="),
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
        shell=False,
    )
    if inspection.returncode == 0:
        command = inspection.stdout.strip()
        if identity not in command:
            raise RuntimeAuthorizationError("D2 process identity is inconsistent")
        os.kill(pid, signal.SIGTERM)
        for _ in range(50):
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                break
            time.sleep(0.1)
        else:
            os.kill(pid, signal.SIGKILL)
            for _ in range(50):
                try:
                    os.kill(pid, 0)
                except ProcessLookupError:
                    break
                time.sleep(0.1)
            else:
                raise RuntimeAuthorizationError("D2 process could not be reaped")
    pid_path.unlink(missing_ok=True)


def _stop_recorded_server(root: Path) -> None:
    _stop_recorded_process(
        root,
        pid_filename=_SERVER_PID,
        identity="cybrik_suite_uat_mtls.server",
    )


def _stop_recorded_client(root: Path) -> None:
    _stop_recorded_process(
        root,
        pid_filename=_CLIENT_PID,
        identity="cybrik_suite_uat_mtls.client",
    )


def _assert_mtls_evidence(evidence_root: Path) -> dict[str, object]:
    path = evidence_root / _TLS_EVIDENCE
    if not path.is_file() or path.is_symlink():
        raise RuntimeAuthorizationError("mTLS extension evidence is absent")
    record = json.loads(path.read_text(encoding="utf-8"))
    exact = {
        "mtls_client_certificate_count": record.get("client_certificate_count"),
        "mtls_client_cert_error_absent": record.get("client_cert_error_absent"),
        "mtls_server_certificate_present": record.get("server_certificate_present"),
        "mtls_tls_version": record.get("tls_version"),
    }
    if exact != {
        "mtls_client_certificate_count": 1,
        "mtls_client_cert_error_absent": True,
        "mtls_server_certificate_present": True,
        "mtls_tls_version": 0x0304,
    }:
        raise RuntimeAuthorizationError("mTLS extension evidence is incomplete")
    cipher_suite = record.get("cipher_suite")
    if (
        isinstance(cipher_suite, bool)
        or not isinstance(cipher_suite, int)
        or cipher_suite <= 0
    ):
        raise RuntimeAuthorizationError("mTLS cipher-suite evidence is invalid")
    return evidence.validate_evidence(exact)  # type: ignore[return-value]


def _assert_ssl_context_evidence(evidence_root: Path) -> dict[str, object]:
    path = evidence_root / _SSL_CONTEXT_EVIDENCE
    if not path.is_file() or path.is_symlink():
        raise RuntimeAuthorizationError("SSL-context evidence is absent")
    record = json.loads(path.read_text(encoding="utf-8"))
    baseline_options = record.get("baseline_options")
    result_options = record.get("result_options")
    if (
        isinstance(baseline_options, bool)
        or not isinstance(baseline_options, int)
        or baseline_options <= 0
        or isinstance(result_options, bool)
        or not isinstance(result_options, int)
        or result_options <= 0
    ):
        raise RuntimeAuthorizationError("SSL-context option evidence is invalid")
    expected_baseline_options = int(
        ssl.create_default_context(ssl.Purpose.CLIENT_AUTH).options
    )
    if baseline_options != expected_baseline_options:
        raise RuntimeAuthorizationError("SSL-context baseline evidence is inconsistent")
    hardened_options_preserved = (result_options & baseline_options) == baseline_options
    no_compression_verified = bool(result_options & ssl.OP_NO_COMPRESSION)
    if record.get("hardened_options_preserved") is not hardened_options_preserved:
        raise RuntimeAuthorizationError(
            "SSL-context hardening evidence is inconsistent"
        )
    if record.get("no_compression_verified") is not no_compression_verified:
        raise RuntimeAuthorizationError("SSL compression evidence is inconsistent")
    if not hardened_options_preserved or not no_compression_verified:
        raise RuntimeAuthorizationError("SSL-context hardening is incomplete")
    return {
        "ssl_hardened_options_preserved": True,
        "ssl_no_compression_verified": True,
    }


def _postgres_security_summary(evidence_root: Path) -> dict[str, object]:
    path = evidence_root / _POSTGRES_SECURITY_EVIDENCE
    if not path.is_file() or path.is_symlink():
        raise RuntimeAuthorizationError("PostgreSQL security evidence is absent")
    record = evidence.validate_evidence(json.loads(path.read_text(encoding="utf-8")))
    expected = {
        "postgres_force_rls_table_count": store.RLS_TABLE_COUNT,
        "postgres_role_posture_verified": True,
        "postgres_rls_isolation_verified": True,
    }
    if record != expected:
        raise RuntimeAuthorizationError("PostgreSQL security evidence is incomplete")
    return expected


def _run_case(
    case_id: str,
    root: Path,
    evidence_root: Path,
    authorization: runtime_authorization.RuntimeAuthorization | None = None,
) -> dict[str, object]:
    result_path = evidence_root / f"case-{case_id.casefold()}.json"
    environment = _server_environment(root, evidence_root, strip_tls=False)
    environment["CYBRIK_UAT_D2_CASE_ID"] = case_id
    environment["CYBRIK_UAT_D2_CASE_RESULT"] = str(result_path)
    pid_path = root / _CLIENT_PID
    if pid_path.exists() or pid_path.is_symlink():
        raise RuntimeAuthorizationError("SOC client process record already exists")
    process = subprocess.Popen(
        _isolated_module_argv(
            assert_runtime_authorized() if authorization is None else authorization,
            "cybrik_suite_uat_mtls.client",
        ),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=environment,
        shell=False,
    )
    try:
        _record_pid(pid_path, process.pid)
        try:
            stdout, stderr = process.communicate(timeout=30)
        except subprocess.TimeoutExpired as exc:
            process.kill()
            process.communicate(timeout=5)
            raise RuntimeAuthorizationError("D2 client case timed out") from exc
    except BaseException:
        if process.poll() is None:
            process.kill()
            process.communicate(timeout=5)
        raise
    finally:
        if process.poll() is not None:
            pid_path.unlink(missing_ok=True)
    _assert_secret_free_process_output(root, stdout, stderr)
    if process.returncode != 0 or not result_path.is_file() or result_path.is_symlink():
        raise RuntimeAuthorizationError("D2 client case failed")
    result = json.loads(result_path.read_text(encoding="utf-8"))
    if result.get("passed") is not True:
        raise RuntimeAuthorizationError("D2 client case did not pass")
    return evidence.validate_evidence(result)  # type: ignore[return-value]


def _assert_secret_free_process_output(root: Path, *streams: str) -> None:
    known_secrets = [
        _password(root),
        *(
            path.read_text(encoding="ascii")
            for path in sorted((root / "pki").glob("*-key.pem"))
        ),
    ]
    for stream in streams:
        if any(secret in stream for secret in known_secrets):
            raise RuntimeAuthorizationError(
                "client process output contained a runtime secret"
            )
        for line in stream.splitlines():
            reason = evidence.secret_reason(line)
            if reason == evidence.JWT_VALUE and _JWT_LIKE.search(line) is None:
                continue
            if reason is not None:
                raise RuntimeAuthorizationError(
                    "client process output was secret-bearing"
                )


def _sha256_file(path: Path) -> str:
    if not path.is_file() or path.is_symlink():
        raise RuntimeAuthorizationError("terminal artifact is unavailable")
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
    except OSError as exc:
        raise RuntimeAuthorizationError("terminal artifact is unavailable") from exc
    return digest.hexdigest()


def _git_value(root: Path, revision: str) -> str:
    try:
        completed = subprocess.run(
            ("git", "-C", str(root), "rev-parse", revision),
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
            shell=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeAuthorizationError(
            "terminal repository tuple is unavailable"
        ) from exc
    value = completed.stdout.strip()
    if re.fullmatch(r"[0-9a-f]{40}", value) is None:
        raise RuntimeAuthorizationError("terminal repository tuple is invalid")
    return value


def _repository_tuple(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> dict[str, dict[str, str]]:
    roots = {
        "suite": authorization.suite_root,
        "soc": authorization.product_roots["soc"],
        "ai": authorization.product_roots["cyber_ai"],
        "fabric": authorization.product_roots["tool_fabric"],
    }
    result: dict[str, dict[str, str]] = {}
    for name, root in roots.items():
        commit = _git_value(root, "HEAD")
        tree = _git_value(root, "HEAD^{tree}")
        if name == "suite" and commit != authorization.suite_head:
            raise RuntimeAuthorizationError("terminal Suite tuple changed")
        result[name] = {"commit_sha": commit, "tree_sha": tree}
    return result


def _public_pki_paths(root: Path) -> dict[str, Path]:
    material_root = root / "pki"
    paths = {name: material_root / filename for name, filename in _PUBLIC_PKI_FILES}
    if any(not path.is_file() or path.is_symlink() for path in paths.values()):
        raise RuntimeAuthorizationError("terminal public PKI inventory is incomplete")
    return paths


def _runtime_secret_inventory(root: Path) -> secret_inventory.SecretInventory:
    inventory = secret_inventory.SecretInventory()
    secret_paths = (
        ("postgres_password", root / _PASSWORD_FILE),
        ("server_private_key", root / "pki/server-key.pem"),
        ("client_private_key", root / "pki/client-key.pem"),
        ("alternate_client_private_key", root / "pki/alternate-client-key.pem"),
        ("jwt_private_key", root / "pki/jwt-signing-key.pem"),
    )
    try:
        for label, path in secret_paths:
            if not path.is_file() or path.is_symlink():
                raise RuntimeAuthorizationError(
                    "terminal runtime secret inventory is incomplete"
                )
            inventory.register(label, path.read_bytes())
    except (OSError, secret_inventory.SecretInventoryError) as exc:
        inventory.clear()
        raise RuntimeAuthorizationError(
            "terminal runtime secret inventory is incomplete"
        ) from exc
    return inventory


def _write_terminal_bindings(
    authorization: runtime_authorization.RuntimeAuthorization,
    inventory: secret_inventory.SecretInventory,
) -> None:
    evidence_root = authorization.evidence_root
    _write_atomic_evidence(
        evidence_root / _AUTHORITY_BINDING_EVIDENCE,
        {
            "authorization_id": authorization.authorization_id,
            "authorization_sha256": authorization.authorization_sha256,
            "exact_head_grant_sha256": authorization.exact_head_grant_sha256,
            "runtime_code_aggregate_sha256": authorization.aggregate_sha256,
            "suite_head": authorization.suite_head,
        },
    )
    _write_atomic_evidence(
        evidence_root / _B1_BINDING_EVIDENCE,
        {
            "containment_test_sha256": _B1_CONTAINMENT_TEST_SHA256,
            "loader_base_sha256": _B1_LOADER_BASE_SHA256,
            "provenance_sha256": _B1_PROVENANCE_SHA256,
            "wheel_sha256": runtime_authorization.policy.PINNED_B1_WHEEL_SHA256,
        },
    )
    _write_atomic_evidence(
        evidence_root / _SECRET_SWEEP_EVIDENCE,
        inventory.summary(),
    )


def _artifact_record(
    evidence_root: Path,
    relative_path: str,
    *,
    name: str,
    kind: str,
    case_id: str | None,
) -> dict[str, object]:
    path = evidence_root / relative_path
    try:
        size_bytes = path.stat(follow_symlinks=False).st_size
    except OSError as exc:
        raise RuntimeAuthorizationError("terminal artifact is unavailable") from exc
    return {
        "name": name,
        "kind": kind,
        "case_id": case_id,
        "relative_path": relative_path,
        "sha256": _sha256_file(path),
        "size_bytes": size_bytes,
    }


def _terminal_artifacts(evidence_root: Path) -> list[dict[str, object]]:
    artifacts = [
        _artifact_record(
            evidence_root,
            f"case-n{ordinal}.json",
            name=f"case-n{ordinal}",
            kind="case",
            case_id=f"N{ordinal}",
        )
        for ordinal in range(1, 11)
    ]
    for relative_path, name, kind in (
        (_AUTHORITY_BINDING_EVIDENCE, "authority-binding", "authorization"),
        (_B1_BINDING_EVIDENCE, "b1-binding", "b1"),
        (_TLS_EVIDENCE, "tls-extension", "tls"),
        (_SSL_CONTEXT_EVIDENCE, "ssl-context", "ssl"),
        (_POSTGRES_SECURITY_EVIDENCE, "postgres-security", "postgresql"),
        (_SECRET_SWEEP_EVIDENCE, "secret-sweep", "secret_sweep"),
    ):
        artifacts.append(
            _artifact_record(
                evidence_root,
                relative_path,
                name=name,
                kind=kind,
                case_id=None,
            )
        )
    return artifacts


def _public_pki_inventory(paths: dict[str, Path]) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    for name, filename in _PUBLIC_PKI_FILES:
        path = paths[name]
        result.append(
            {
                "name": name,
                "relative_path": f"pki-public/{filename}",
                "sha256": _sha256_file(path),
                "size_bytes": path.stat(follow_symlinks=False).st_size,
            }
        )
    return result


def _marker_sha256(marker: object) -> str:
    try:
        payload = json.dumps(
            marker,
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError) as exc:
        raise RuntimeAuthorizationError("consumed marker is not canonical") from exc
    return hashlib.sha256(payload).hexdigest()


def _utc_text(value: datetime) -> str:
    return (
        value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


def _terminal_candidate(
    *,
    authorization: runtime_authorization.RuntimeAuthorization,
    marker: dict[str, object],
    results: list[dict[str, object]],
    case_durations_ms: list[int],
    summary: dict[str, object],
    started_at: datetime,
    elapsed_ms: int,
    public_pki_paths: dict[str, Path],
) -> dict[str, object]:
    if len(results) != 10 or len(case_durations_ms) != 10:
        raise RuntimeAuthorizationError("terminal case inventory is incomplete")
    cases_ms = sum(case_durations_ms)
    total_ms = max(elapsed_ms, cases_ms)
    setup_ms = total_ms - cases_ms
    finished_at = started_at + timedelta(milliseconds=total_ms)
    observed = {
        result.get("case_id"): (result, duration_ms)
        for result, duration_ms in zip(results, case_durations_ms, strict=True)
    }
    if set(observed) != {f"N{ordinal}" for ordinal in range(1, 11)}:
        raise RuntimeAuthorizationError("terminal case inventory is inconsistent")
    cases = []
    for ordinal in range(1, 11):
        case_id = f"N{ordinal}"
        result, duration_ms = observed[case_id]
        if result.get("case_id") != case_id or result.get("passed") is not True:
            raise RuntimeAuthorizationError("terminal case inventory is inconsistent")
        cases.append(
            {
                "case_id": case_id,
                "outcome": "passed",
                "reason_code": None,
                "duration_ms": duration_ms,
                "artifact_name": f"case-n{ordinal}",
            }
        )
    return {
        "schema_version": runtime_evidence.TERMINAL_SCHEMA_VERSION,
        "artifact_state": "raw",
        "attempt_id": authorization.authorization_id,
        "outcome": "passed",
        "failure_reason_code": None,
        "repository_tuple": _repository_tuple(authorization),
        "authority": {
            "phase_a_auth_sha256": authorization.authorization_sha256,
            "consumption_sha256": _marker_sha256(marker),
            "one_shot_consumed": True,
        },
        "b1": {
            "wheel_sha256": runtime_authorization.policy.PINNED_B1_WHEEL_SHA256,
            "provenance_sha256": _B1_PROVENANCE_SHA256,
            "containment_test_sha256": _B1_CONTAINMENT_TEST_SHA256,
            "loader_base_sha256": _B1_LOADER_BASE_SHA256,
        },
        "counts": {
            "case_count": 10,
            "passed_count": 10,
            "failed_count": 0,
            "not_run_count": 0,
        },
        "cases": cases,
        "transport": {
            "tls_version": "TLSv1.3",
            "mtls_verified": summary["mtls_client_certificate_count"] == 1,
            "cnf_binding_verified": summary["relying_party_refusal_count"] == 9,
            "asgi_tls_extension_verified": True,
            "ssl_hardened_options_preserved": summary["ssl_hardened_options_preserved"],
            "ssl_no_compression_verified": summary["ssl_no_compression_verified"],
        },
        "postgresql": {
            "role_rolsuper": False,
            "role_rolbypassrls": False,
            "role_rolcreaterole": False,
            "force_rls_table_count": summary["postgres_force_rls_table_count"],
            "cross_tenant_row_count": 0,
            "replay_row_count": summary["postgres_replay_row_count"],
        },
        "timings": {
            "started_at": _utc_text(started_at),
            "finished_at": _utc_text(finished_at),
            "setup_ms": setup_ms,
            "cases_ms": cases_ms,
            "teardown_ms": 0,
            "total_ms": total_ms,
        },
        "teardown": {
            key: True
            for key in (
                "completed",
                "ai_process_absent",
                "soc_process_absent",
                "postgres_container_absent",
                "ai_listener_absent",
                "postgres_listener_absent",
                "runtime_root_absent",
                "pki_absent",
            )
        },
        "pki_public": {
            "ephemeral": True,
            "destroyed": True,
            "certificate_count": 4,
            "public_artifact_count": 5,
            "public_artifacts": _public_pki_inventory(public_pki_paths),
        },
        "artifacts": _terminal_artifacts(authorization.evidence_root),
    }


def run_runtime_attempt() -> dict[str, object]:
    """Execute the authorized RED→GREEN sequence exactly once."""

    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    consumed_marker = runtime_authorization.verify_consumed(authorization)
    root = authorization.runtime_root
    evidence_root = authorization.evidence_root
    attempt_started_at = datetime.now(UTC)
    attempt_started_monotonic = time.monotonic()
    process: subprocess.Popen[str] | None = None
    log: object | None = None
    results: list[dict[str, object]] = []
    case_durations_ms: list[int] = []
    inventory: secret_inventory.SecretInventory | None = None

    def execute_case(case_id: str) -> dict[str, object]:
        started = time.monotonic()
        result = _run_case(case_id, root, evidence_root, authorization)
        case_durations_ms.append(max(0, round((time.monotonic() - started) * 1000)))
        return result

    try:
        process, log = _spawn_server(root, evidence_root, authorization, strip_tls=True)
        _wait_ai_listener(root, process)
        results.append(execute_case("N8"))
        if (evidence_root / _TLS_EVIDENCE).exists():
            raise RuntimeAuthorizationError("N8 unexpectedly retained a TLS extension")
        _stop_process(process, root)
        process = None
        if hasattr(log, "close"):
            log.close()  # type: ignore[union-attr]
        log = None

        process, log = _spawn_server(
            root, evidence_root, authorization, strip_tls=False
        )
        _wait_ai_listener(root, process)
        runtime = _postgres_runtime(root)
        postgres_replay_row_count = 0
        for case_id in ("N1", "N2", "N3", "N4", "N5", "N6", "N7"):
            results.append(execute_case(case_id))
            if case_id == "N1":
                postgres_replay_row_count = store.replay_row_count(
                    runtime, tenant_id="11111111-2222-4333-8444-555555555555"
                )
                if postgres_replay_row_count != 1:
                    raise RuntimeAuthorizationError(
                        "N1 did not retain exactly one durable replay row"
                    )
        store.stop()
        if not store.verify_absent():
            raise RuntimeAuthorizationError("N9 PostgreSQL outage was not established")
        results.append(execute_case("N9"))
        mtls_summary = _assert_mtls_evidence(evidence_root)
        _stop_process(process, root)
        process = None
        if hasattr(log, "close"):
            log.close()  # type: ignore[union-attr]
        log = None
        results.append(execute_case("N10"))
        relying_party_refusal_count = sum(
            1
            for result in results
            if result.get("rejection_code") == "relying_party_refusal"
        )
        if relying_party_refusal_count != 9:
            raise RuntimeAuthorizationError(
                "D2 negative cases did not all reach the relying party"
            )
        summary = {
            "case_count": len(results),
            "failed_count": sum(
                1 for result in results if result.get("passed") is not True
            ),
            "passed_count": sum(
                1 for result in results if result.get("passed") is True
            ),
            "postgres_replay_row_count": postgres_replay_row_count,
            "relying_party_refusal_count": relying_party_refusal_count,
            "runtime_red_case_id": "N8",
        }
        summary.update(mtls_summary)
        summary.update(_assert_ssl_context_evidence(evidence_root))
        summary.update(_postgres_security_summary(evidence_root))
        validated_summary = evidence.validate_evidence(summary)
        if not isinstance(validated_summary, dict):
            raise RuntimeAuthorizationError("terminal runtime summary is invalid")
        inventory = _runtime_secret_inventory(root)
        _write_terminal_bindings(authorization, inventory)
        public_paths = _public_pki_paths(root)
        candidate = _terminal_candidate(
            authorization=authorization,
            marker=consumed_marker,
            results=results,
            case_durations_ms=case_durations_ms,
            summary=validated_summary,
            started_at=attempt_started_at,
            elapsed_ms=max(
                0, round((time.monotonic() - attempt_started_monotonic) * 1000)
            ),
            public_pki_paths=public_paths,
        )
        runtime_evidence.validate_terminal_result(candidate)
        terminal_integration.prepare_terminal_handoff(
            authorization=authorization,
            consumed_marker=consumed_marker,
            candidate=candidate,
            public_pki_paths=public_paths,
            artifact_paths=tuple(
                evidence_root / relative_path for relative_path in _TERMINAL_ARTIFACTS
            ),
            secret_inventory=inventory,
        )
        inventory = None
        return validated_summary
    finally:
        _stop_process(process, root)
        if hasattr(log, "close"):
            log.close()  # type: ignore[union-attr]
        if inventory is not None:
            inventory.clear()


def teardown() -> None:
    """Idempotently reap every D2-created resource in a fixed order."""

    root, _ = _bounded_external_roots(repositories_must_exist=False)
    if root.is_symlink():
        raise RuntimeAuthorizationError("refusing a symlinked runtime teardown root")
    _stop_recorded_client(root)
    _stop_recorded_server(root)
    try:
        store.stop()
    finally:
        if root.exists() and not root.is_symlink():
            material = _pki_material(root)
            pki.destroy_ephemeral_pki(material)
            password = root / _PASSWORD_FILE
            password.unlink(missing_ok=True)
            shutil.rmtree(root)


def _listener_absent(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.25)
        return probe.connect_ex(("127.0.0.1", port)) != 0


def _live_absence_state() -> dict[str, bool]:
    """Observe each bounded resource separately after teardown."""

    root, _ = _bounded_external_roots(repositories_must_exist=False)
    material = _pki_material(root)
    observed = {
        "ai_process_absent": not (root / _SERVER_PID).exists()
        and not (root / _SERVER_PID).is_symlink(),
        "soc_process_absent": not (root / _CLIENT_PID).exists()
        and not (root / _CLIENT_PID).is_symlink(),
        "postgres_container_absent": not store.container_exists(),
        "ai_listener_absent": _listener_absent(58443),
        "postgres_listener_absent": _listener_absent(store.POSTGRES_PORT),
        "runtime_root_absent": not root.exists() and not root.is_symlink(),
        "pki_absent": pki.verify_absent(material),
    }
    return {"completed": all(observed.values()), **observed}


def verify_absent() -> bool:
    return all(_live_absence_state().values())


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cybrik-suite-uat-mtls-d2")
    subparsers = parser.add_subparsers(dest="step", required=True)
    start_parser = subparsers.add_parser("start")
    start_parser.add_argument("--ai-bind", choices=["127.0.0.1:58443"], required=True)
    start_parser.add_argument(
        "--postgres-bind", choices=["127.0.0.1:55432"], required=True
    )
    for step in ("seed", "reset", "stop", "rollback"):
        subparsers.add_parser(step)
    return parser


def main(argv: list[str] | None = None) -> int:
    arguments = _parser().parse_args(argv)
    dispatch = {
        "start": start,
        "seed": seed,
        "reset": reset,
        "stop": stop,
        "rollback": rollback,
    }
    try:
        procedure.validate_procedure(procedure.LIFECYCLE_BLUEPRINT)
        dispatch[arguments.step]()
    except Exception:  # noqa: BLE001 - CLI emits only one constant exit status
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
