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
import time
from pathlib import Path
from typing import Final

from . import evidence, pki, policy, procedure, store

RESOURCE_KINDS = (
    "ai_process",
    "client_process",
    "postgres_container",
    "ai_listener",
    "postgres_listener",
    "runtime_directory",
    "pki_material",
)

_AUTHORIZATION_ENV: Final = "CYBRIK_UAT_D2_EXECUTION_AUTHORIZED"
_AUTHORIZATION_PATH_ENV: Final = "CYBRIK_UAT_D2_AUTHORIZATION_PATH"
_AUTHORIZATION_SHA_ENV: Final = "CYBRIK_UAT_D2_AUTHORIZATION_SHA256"
_RUNTIME_DIR_ENV: Final = "CYBRIK_UAT_D2_RUNTIME_DIR"
_EVIDENCE_DIR_ENV: Final = "CYBRIK_UAT_D2_EVIDENCE_DIR"
_B1_WHEEL_ENV: Final = "CYBRIK_UAT_D2_B1_WHEEL"
_SOC_REPO_ENV: Final = "CYBRIK_UAT_D2_SOC_REPO"
_AI_REPO_ENV: Final = "CYBRIK_UAT_D2_AI_REPO"
_FABRIC_REPO_ENV: Final = "CYBRIK_UAT_D2_FABRIC_REPO"
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_HEX40 = re.compile(r"^[0-9a-f]{40}$")
_CANDIDATE_REL: Final = Path(
    "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/runtime-admission.json"
)
_AUTHORIZATION_REL: Final = Path(
    "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/04-runtime-authorization.md"
)
_PASSWORD_FILE: Final = "postgres-password"
_SERVER_LOG: Final = "ai-server.log"
_SERVER_PID: Final = "ai-server.pid"
_CLIENT_PID: Final = "soc-client.pid"
_TLS_EVIDENCE: Final = "tls-extension.json"
_SSL_CONTEXT_EVIDENCE: Final = "ssl-context.json"
_POSTGRES_SECURITY_EVIDENCE: Final = "postgres-security.json"
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


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _git(*args: str) -> str:
    completed = subprocess.run(
        ("git", "-C", str(_repo_root()), *args),
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
        shell=False,
    )
    return completed.stdout.strip()


def _absolute_env(name: str, *, must_exist: bool) -> Path:
    raw = os.environ.get(name, "")
    candidate = Path(raw)
    if not raw or not candidate.is_absolute():
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


def assert_product_api_compatibility() -> None:
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


def assert_runtime_authorized() -> None:
    """Validate the committed Phase A exact-bit authorization or fail closed."""

    if os.environ.get(_AUTHORIZATION_ENV) != "true":
        raise RuntimeAuthorizationError("runtime authorization is closed")
    authorization = _absolute_env(_AUTHORIZATION_PATH_ENV, must_exist=True)
    expected_authorization_sha = os.environ.get(_AUTHORIZATION_SHA_ENV, "")
    if _HEX64.fullmatch(expected_authorization_sha) is None:
        raise RuntimeAuthorizationError("runtime authorization digest is invalid")
    if authorization != (_repo_root() / _AUTHORIZATION_REL).resolve(strict=True):
        raise RuntimeAuthorizationError("runtime authorization path is not canonical")
    if _sha256(authorization) != expected_authorization_sha:
        raise RuntimeAuthorizationError("runtime authorization digest mismatch")

    candidate_path = _repo_root() / _CANDIDATE_REL
    record = json.loads(candidate_path.read_text(encoding="utf-8"))
    current = record["attempt_accounting"]["current_attempt"]
    if (
        current.get("execution_authorized") is not True
        or current.get("status") != "not_run"
    ):
        raise RuntimeAuthorizationError("runtime authorization is closed")
    if any(
        current.get(field) != 0
        for field in ("executed_checks", "passed_checks", "failed_checks")
    ):
        raise RuntimeAuthorizationError("runtime attempt counters are not zero")
    artifacts = record.get("evidence", {}).get("artifacts", [])
    if not any(
        artifact.get("path") == _AUTHORIZATION_REL.as_posix()
        and artifact.get("sha256") == expected_authorization_sha
        for artifact in artifacts
    ):
        raise RuntimeAuthorizationError(
            "candidate does not pin the authorization artifact"
        )

    head = _git("rev-parse", "HEAD")
    if _HEX40.fullmatch(
        head
    ) is None or f"SUITE_SHA={head}" not in authorization.read_text(encoding="utf-8"):
        raise RuntimeAuthorizationError(
            "authorization does not pin the exact Suite commit"
        )
    if _git("status", "--porcelain", "--untracked-files=all"):
        raise RuntimeAuthorizationError("Suite checkout is not clean")

    runtime_root, evidence_root = _bounded_external_roots(repositories_must_exist=True)
    authorization_lines = set(authorization.read_text(encoding="utf-8").splitlines())
    required_root_lines = {
        f"RUNTIME_ROOT={runtime_root}",
        f"EVIDENCE_ROOT={evidence_root}",
    }
    if not required_root_lines.issubset(authorization_lines):
        raise RuntimeAuthorizationError(
            "authorization does not pin the exact one-shot external roots"
        )
    wheel = _absolute_env(_B1_WHEEL_ENV, must_exist=True)
    if _sha256(wheel) != policy.PINNED_B1_WHEEL_SHA256:
        raise RuntimeAuthorizationError("B1 wheel digest mismatch")


def _runtime_root(*, exists: bool) -> Path:
    return _absolute_env(_RUNTIME_DIR_ENV, must_exist=exists)


def _evidence_root(*, exists: bool) -> Path:
    return _absolute_env(_EVIDENCE_DIR_ENV, must_exist=exists)


def _password(root: Path) -> str:
    path = root / _PASSWORD_FILE
    if not path.is_file() or path.is_symlink():
        raise RuntimeAuthorizationError("ephemeral PostgreSQL credential is absent")
    value = path.read_text(encoding="ascii")
    if len(value) < 32:
        raise RuntimeAuthorizationError("ephemeral PostgreSQL credential is invalid")
    return value


def _postgres_runtime(root: Path) -> store.PostgresRuntime:
    return store.PostgresRuntime(
        password=_password(root),
        ai_repository=_absolute_env(_AI_REPO_ENV, must_exist=True),
    )


def start() -> None:
    assert_runtime_authorized()
    assert_product_api_compatibility()
    root = _runtime_root(exists=False)
    evidence_root = _evidence_root(exists=False)
    if (
        root.exists()
        or root.is_symlink()
        or evidence_root.exists()
        or evidence_root.is_symlink()
    ):
        raise RuntimeAuthorizationError("D2 external roots must be fresh")
    root.mkdir(mode=0o700)
    evidence_root.mkdir(mode=0o700)
    os.chmod(root, 0o700)
    os.chmod(evidence_root, 0o700)
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
    assert_runtime_authorized()
    root = _runtime_root(exists=True)
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
    assert_runtime_authorized()
    runtime = _postgres_runtime(_runtime_root(exists=True))
    store.migrate(runtime)
    posture = evidence.validate_evidence(store.audit_security_posture(runtime))
    destination = _evidence_root(exists=True) / _POSTGRES_SECURITY_EVIDENCE
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(posture, sort_keys=True, separators=(",", ":")), encoding="utf-8"
    )
    os.replace(temporary, destination)


def stop() -> None:
    assert_runtime_authorized()
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
    teardown()
    if not verify_absent():
        raise RuntimeAuthorizationError("D2 rollback did not verify resource absence")


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
    root: Path, evidence_root: Path, *, strip_tls: bool
) -> tuple[subprocess.Popen[str], object]:
    pid_path = root / _SERVER_PID
    if pid_path.exists() or pid_path.is_symlink():
        raise RuntimeAuthorizationError("AI server process record already exists")
    log = (evidence_root / _SERVER_LOG).open("a", encoding="utf-8")
    try:
        process = subprocess.Popen(
            (sys.executable, "-m", "cybrik_suite_uat_mtls.server"),
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


def _run_case(case_id: str, root: Path, evidence_root: Path) -> dict[str, object]:
    result_path = evidence_root / f"case-{case_id.casefold()}.json"
    environment = _server_environment(root, evidence_root, strip_tls=False)
    environment["CYBRIK_UAT_D2_CASE_ID"] = case_id
    environment["CYBRIK_UAT_D2_CASE_RESULT"] = str(result_path)
    pid_path = root / _CLIENT_PID
    if pid_path.exists() or pid_path.is_symlink():
        raise RuntimeAuthorizationError("SOC client process record already exists")
    process = subprocess.Popen(
        (sys.executable, "-m", "cybrik_suite_uat_mtls.client"),
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
    if process.returncode != 0 or not result_path.is_file():
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


def run_runtime_attempt() -> dict[str, object]:
    """Execute the authorized RED→GREEN sequence exactly once."""

    assert_runtime_authorized()
    root = _runtime_root(exists=True)
    evidence_root = _evidence_root(exists=True)
    process: subprocess.Popen[str] | None = None
    log: object | None = None
    results: list[dict[str, object]] = []
    try:
        process, log = _spawn_server(root, evidence_root, strip_tls=True)
        _wait_ai_listener(root, process)
        results.append(_run_case("N8", root, evidence_root))
        if (evidence_root / _TLS_EVIDENCE).exists():
            raise RuntimeAuthorizationError("N8 unexpectedly retained a TLS extension")
        _stop_process(process, root)
        process = None
        if hasattr(log, "close"):
            log.close()  # type: ignore[union-attr]
        log = None

        process, log = _spawn_server(root, evidence_root, strip_tls=False)
        _wait_ai_listener(root, process)
        runtime = _postgres_runtime(root)
        postgres_replay_row_count = 0
        for case_id in ("N1", "N2", "N3", "N4", "N5", "N6", "N7"):
            results.append(_run_case(case_id, root, evidence_root))
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
        results.append(_run_case("N9", root, evidence_root))
        mtls_summary = _assert_mtls_evidence(evidence_root)
        _stop_process(process, root)
        process = None
        if hasattr(log, "close"):
            log.close()  # type: ignore[union-attr]
        log = None
        results.append(_run_case("N10", root, evidence_root))
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
        return evidence.validate_evidence(summary)  # type: ignore[return-value]
    finally:
        _stop_process(process, root)
        if hasattr(log, "close"):
            log.close()  # type: ignore[union-attr]


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


def verify_absent() -> bool:
    root, _ = _bounded_external_roots(repositories_must_exist=False)
    material = _pki_material(root)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.25)
        ai_listener_absent = probe.connect_ex(("127.0.0.1", 58443)) != 0
    return (
        store.verify_absent()
        and pki.verify_absent(material)
        and not root.exists()
        and not root.is_symlink()
        and ai_listener_absent
    )


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
