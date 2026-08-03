"""Fail-closed lifecycle and one-attempt driver for UAT-MTLS-D2.

Status: ``AUTHORED — NOT RUN``. Every mutating entrypoint begins by validating
the committed candidate, exact authorization artifact digest, exact clean Suite
commit and external runtime roots. Importing this module is inert.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import secrets
import socket
import ssl
import stat
import subprocess
import sys
import sysconfig
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Final

from . import (
    evidence,
    pki,
    procedure,
    process_control,
    process_supervisor,
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
_RESERVATION_FRAME_ENV: Final = "CYBRIK_UAT_D2_MASTER_RESERVATION_FRAME"
_CONTROL_RUN_ID_ENV: Final = "CYBRIK_UAT_D2_CONTROL_RUN_ID"
_CONTROL_GENERATION_ENV: Final = "CYBRIK_UAT_D2_CONTROL_GENERATION"
_PASSWORD_FILE: Final = "postgres-password"
_SERVER_LOG: Final = "ai-server.log"
_TLS_EVIDENCE: Final = "tls-extension.json"
_SSL_CONTEXT_EVIDENCE: Final = "ssl-context.json"
_POSTGRES_SECURITY_EVIDENCE: Final = "postgres-security.json"
_AUTHORITY_BINDING_EVIDENCE: Final = "authority-binding.json"
_B1_BINDING_EVIDENCE: Final = "b1-binding.json"
_SECRET_SWEEP_EVIDENCE: Final = "secret-sweep.json"
_CONTROL_GENERATION: Final = 1
_CONTROL_READY_ATTEMPTS: Final = 80
_CONTROL_RELEASE_ATTEMPTS: Final = 80
_PGREP_EXECUTABLE: Final = "/usr/bin/pgrep"
_PROCESS_OBSERVATION_TIMEOUT_SECONDS: Final = 5
_STAGE_EXECUTION_CAPABILITY: Final = object()
_AI_PROCESS_PATTERNS: Final = (
    r"(^|[[:space:]])cybrik_suite_uat_mtls[.]server([[:space:]]|$)",
    r"(^|[[:space:]])cybrik_suite_uat_mtls[.]process_supervisor([[:space:]]|$)",
)
_SOC_PROCESS_PATTERNS: Final = (
    r"(^|[[:space:]])cybrik_suite_uat_mtls[.]client([[:space:]]|$)",
)
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


@dataclass(frozen=True, slots=True)
class _CreatedPassword:
    """Identity of the one password leaf created by this bootstrap call."""

    path: Path
    device: int
    inode: int
    uid: int
    mode: int


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


@contextmanager
def _signed_product_import_scope(
    authorization: runtime_authorization.RuntimeBinding,
) -> Iterator[None]:
    if not isinstance(authorization, runtime_authorization.ReservedRuntimeBinding):
        yield
        return
    try:
        source_roots = runtime_authorization.resolve_import_source_roots(authorization)
    except runtime_authorization.RuntimeAuthorizationFailure as exc:
        raise RuntimeAuthorizationError(
            f"pinned product API import roots are refused: {exc.reason}"
        ) from exc
    original = tuple(sys.path)
    signed = tuple(str(root) for root in source_roots)
    sys.path[:] = [*signed, *(item for item in original if item not in signed)]
    try:
        yield
    finally:
        sys.path[:] = original


def assert_product_api_compatibility(
    authorization: runtime_authorization.RuntimeBinding,
) -> None:
    """Import exact pinned SOC/AI symbols before creating any resource."""

    with _signed_product_import_scope(authorization):
        _assert_product_api_compatibility_loaded(authorization)


def _assert_product_api_compatibility_loaded(
    authorization: runtime_authorization.RuntimeBinding,
) -> None:

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


def _reservation_frame(
    authorization: runtime_authorization.ReservedRuntimeBinding,
    material: process_control.ControlMaterial,
) -> str:
    body = {
        "control_binding": material.binding.as_payload(),
        "kind": "master_reservation",
        "reservation": runtime_authorization.master_reservation_payload(authorization),
    }
    try:
        return base64.b64encode(
            process_control.sign_frame(body, material.capability)
        ).decode("ascii")
    except (UnicodeError, process_control.ProcessControlError) as exc:
        raise RuntimeAuthorizationError(
            "child reservation proof is unavailable"
        ) from exc


def _child_control_material() -> tuple[
    process_control.ControlStore, process_control.ControlMaterial
]:
    try:
        binding = process_control.ControlBinding(
            authorization_sha256=os.environ.get(_AUTHORIZATION_SHA_ENV, ""),
            run_id=os.environ.get(_CONTROL_RUN_ID_ENV, ""),
            generation=int(os.environ.get(_CONTROL_GENERATION_ENV, "")),
            owner_uid=os.geteuid(),
        )
        runtime_root = _absolute_env(_RUNTIME_DIR_ENV, must_exist=True)
        filesystem = process_control.PosixFileSystemAdapter()
        control_store = process_control.ControlStore(filesystem=filesystem)
        material = control_store.load(
            paths=process_control.derive_control_paths(
                runtime_root, binding.authorization_sha256
            ),
            expected_binding=binding,
        )
        ready = control_store.read_ready_receipt(material)
        if not process_control.verify_ready_receipt(ready, material):
            raise process_control.ProcessControlError("control_receipt_mismatch")
        return control_store, material
    except (OSError, ValueError, process_control.ProcessControlError) as exc:
        raise RuntimeAuthorizationError(
            "child process-control authority is closed"
        ) from exc


def _verify_child_environment(
    authorization: runtime_authorization.ReservedRuntimeBinding,
) -> None:
    expected_paths = {
        _RUNTIME_DIR_ENV: authorization.runtime_root,
        _EVIDENCE_DIR_ENV: authorization.evidence_root,
        _SOC_REPO_ENV: authorization.product_roots["soc"],
        _AI_REPO_ENV: authorization.product_roots["cyber_ai"],
        _FABRIC_REPO_ENV: authorization.product_roots["tool_fabric"],
        "CYBRIK_UAT_D2_PKI_ROOT": authorization.runtime_root / "pki",
        "CYBRIK_UAT_D2_JWKS": authorization.runtime_root
        / "pki"
        / "jwt-public-jwk.json",
        "CYBRIK_UAT_D2_B1_WHEEL": authorization.b1_wheel,
    }
    if any(
        _absolute_env(name, must_exist=True) != expected
        for name, expected in expected_paths.items()
    ):
        raise RuntimeAuthorizationError("child reservation environment is mismatched")
    expected_runtime = _bound_postgres_runtime(authorization)
    if (
        os.environ.get(_AUTHORIZATION_SHA_ENV) != authorization.authorization_sha256
        or os.environ.get("CYBRIK_UAT_D2_POSTGRES_DSN") != expected_runtime.admin_dsn
    ):
        raise RuntimeAuthorizationError("child reservation environment is mismatched")


def assert_child_runtime_authorized() -> runtime_authorization.RuntimeBinding:
    """Admit a child through legacy authority or a supervisor-MAC reservation."""

    encoded = os.environ.get(_RESERVATION_FRAME_ENV, "")
    if not encoded:
        return assert_runtime_authorized()
    _control_store, material = _child_control_material()
    try:
        frame = base64.b64decode(encoded.encode("ascii"), validate=True)
        body = process_control.verify_frame(frame, material.capability)
        if (
            set(body) != {"control_binding", "kind", "reservation"}
            or body["control_binding"] != material.binding.as_payload()
            or body["kind"] != "master_reservation"
        ):
            raise process_control.ProcessControlError("frame_authentication_failed")
        facts = runtime_authorization.master_reservation_from_payload(
            body["reservation"]
        )
        if facts.authorization_sha256 != material.binding.authorization_sha256:
            raise process_control.ProcessControlError("frame_authentication_failed")
        authorization = runtime_authorization.authorize_from_master_reservation(facts)
        runtime_authorization.verify_master_consumption(facts)
        _verify_child_environment(authorization)
        if not all(
            entry["clean"] for entry in _stage_repository_tuple(authorization).values()
        ):
            raise RuntimeAuthorizationError("child repository tuple is dirty")
        runtime_authorization.verify_loaded_module_origins(authorization)
        return authorization
    except (
        UnicodeError,
        ValueError,
        process_control.ProcessControlError,
        runtime_authorization.RuntimeAuthorizationFailure,
    ) as exc:
        raise RuntimeAuthorizationError("child reservation proof is closed") from exc


def _isolated_module_argv(
    authorization: runtime_authorization.RuntimeBinding,
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


def _bound_postgres_runtime(
    authorization: runtime_authorization.RuntimeBinding,
) -> store.PostgresRuntime:
    if isinstance(authorization, runtime_authorization.ReservedRuntimeBinding):
        return store.PostgresRuntime(
            password=_password(authorization.runtime_root),
            ai_repository=authorization.product_roots["cyber_ai"],
        )
    return _postgres_runtime(authorization.runtime_root)


def _control_binding(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> process_control.ControlBinding:
    seed = (
        f"{authorization.authorization_id}\0{authorization.authorization_sha256}"
    ).encode()
    return process_control.ControlBinding(
        authorization_sha256=authorization.authorization_sha256,
        run_id=hashlib.sha256(seed).hexdigest()[:32],
        generation=_CONTROL_GENERATION,
        owner_uid=os.geteuid(),
    )


def _control_paths(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> process_control.ControlPaths:
    try:
        return process_control.derive_control_paths(
            authorization.runtime_root,
            authorization.authorization_sha256,
        )
    except process_control.ProcessControlError as exc:
        raise RuntimeAuthorizationError(
            f"stable process-control path is refused: {exc.reason}"
        ) from exc


def _load_control(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> tuple[
    process_control.ControlStore,
    process_control.ControlMaterial,
    process_control.ControlClient,
]:
    try:
        filesystem = process_control.PosixFileSystemAdapter()
        control_store = process_control.ControlStore(filesystem=filesystem)
        material = control_store.load(
            paths=_control_paths(authorization),
            expected_binding=_control_binding(authorization),
        )
        transport = process_control.UnixControlTransport(
            paths=material.paths,
            binding=material.binding,
            capability=material.capability,
            filesystem=filesystem,
            expected_root_identity=material.root_identity,
        )
        client = process_control.ControlClient(
            binding=material.binding,
            capability=material.capability,
            transport=transport,
        )
        return control_store, material, client
    except process_control.ProcessControlError as exc:
        raise RuntimeAuthorizationError(
            f"stable process authority is unavailable: {exc.reason}"
        ) from exc


def _supervisor_argv(
    authorization: runtime_authorization.RuntimeAuthorization,
    binding: process_control.ControlBinding,
) -> tuple[str, ...]:
    return (
        *_isolated_module_argv(
            authorization, "cybrik_suite_uat_mtls.process_supervisor"
        ),
        "--runtime-root",
        str(authorization.runtime_root),
        "--authorization-sha256",
        binding.authorization_sha256,
        "--run-id",
        binding.run_id,
        "--generation",
        str(binding.generation),
        "--owner-uid",
        str(binding.owner_uid),
    )


def _wait_control_ready(
    control_store: process_control.ControlStore,
    material: process_control.ControlMaterial,
    supervisor_process: object,
) -> None:
    for _ in range(_CONTROL_READY_ATTEMPTS):
        try:
            record = control_store.read_ready_receipt(material)
            if process_control.verify_ready_receipt(record, material):
                return
        except process_control.ProcessControlError:
            poll = getattr(supervisor_process, "poll", None)
            if callable(poll) and poll() is not None:
                raise RuntimeAuthorizationError(
                    "stable process supervisor exited before readiness"
                )
            time.sleep(0.25)
    raise RuntimeAuthorizationError("stable process supervisor readiness timed out")


def _start_supervisor(
    authorization: runtime_authorization.RuntimeAuthorization,
    control_store: process_control.ControlStore,
    material: process_control.ControlMaterial,
) -> None:
    environment = _server_environment(
        authorization.runtime_root,
        authorization.evidence_root,
        strip_tls=False,
        authorization=authorization,
        control_material=material,
    )
    environment[process_supervisor.SERVER_ARGV_ENV] = json.dumps(
        _isolated_module_argv(authorization, "cybrik_suite_uat_mtls.server"),
        separators=(",", ":"),
    )
    environment[process_supervisor.SERVER_LOG_ENV] = str(
        authorization.evidence_root / _SERVER_LOG
    )
    supervisor_process = process_supervisor.launch_supervisor(
        argv=_supervisor_argv(authorization, material.binding),
        environment=environment,
        # ``launch_supervisor`` opens this path before it can publish the
        # authenticated ready receipt.  The signed evidence root must retain
        # its exact empty inventory until ``consume_once`` succeeds, while the
        # later server child may create its evidence log only after that gate.
        log_path=Path(os.devnull),
    )
    try:
        _wait_control_ready(control_store, material, supervisor_process)
    except BaseException as primary:
        try:
            process_supervisor.reap_launched_supervisor(supervisor_process)
        except Exception as cleanup_error:  # noqa: BLE001 - preserve readiness cause
            add_note = getattr(primary, "add_note", None)
            if callable(add_note):
                add_note(f"supervisor reap also failed: {type(cleanup_error).__name__}")
        raise


def _verify_prepared_runtime_roots(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> None:
    """Bind the already prepared runtime and PKI roots before any leaf.

    Both roots are signed material this harness never created, so ``start``
    neither requires them absent nor makes, chmods or replaces them.  It only
    proves that the exact signed inodes are still there and still hold their
    signed initial inventory.
    """

    try:
        runtime_authorization.verify_prepared_runtime_roots(authorization)
    except runtime_authorization.RuntimeAuthorizationFailure as exc:
        raise RuntimeAuthorizationError(
            f"prepared D2 runtime roots are refused: {exc.reason}"
        ) from exc


def _signed_pki_root(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> runtime_authorization.RootBinding:
    """Return the signed ``<runtime>/pki`` binding, never an inferred one."""

    try:
        return runtime_authorization.signed_pki_root(authorization)
    except runtime_authorization.RuntimeAuthorizationFailure as exc:
        raise RuntimeAuthorizationError(
            f"signed D2 PKI root is refused: {exc.reason}"
        ) from exc


def _create_password(root: Path) -> _CreatedPassword:
    """Create the one credential leaf exclusively and retain deletion authority."""

    path = root / _PASSWORD_FILE
    descriptor = -1
    created: _CreatedPassword | None = None
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
        identity = os.fstat(descriptor)
        if (
            not stat.S_ISREG(identity.st_mode)
            or identity.st_uid != os.geteuid()
            or stat.S_IMODE(identity.st_mode) != 0o600
            or identity.st_nlink != 1
        ):
            raise OSError("created password leaf identity is invalid")
        created = _CreatedPassword(
            path=path,
            device=identity.st_dev,
            inode=identity.st_ino,
            uid=identity.st_uid,
            mode=stat.S_IMODE(identity.st_mode),
        )
        with os.fdopen(descriptor, "w", encoding="ascii") as stream:
            descriptor = -1
            stream.write(secrets.token_hex(32))
            stream.flush()
            os.fsync(stream.fileno())
        return created
    except OSError as exc:
        if descriptor >= 0:
            os.close(descriptor)
        try:
            _remove_created_password(created)
        except RuntimeAuthorizationError as cleanup_error:
            add_note = getattr(exc, "add_note", None)
            if callable(add_note):
                add_note(
                    f"credential cleanup also failed: {type(cleanup_error).__name__}"
                )
        raise RuntimeAuthorizationError(
            "ephemeral PostgreSQL credential creation failed"
        ) from exc


def _remove_created_password(created: _CreatedPassword | None) -> None:
    """Quarantine then remove only the exact password inode this call created."""

    if created is None:
        return
    directory_descriptor = -1
    password_descriptor = -1
    quarantine = f".{_PASSWORD_FILE}.cleanup-{secrets.token_hex(16)}"
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
    try:
        directory_descriptor = os.open(
            created.path.parent,
            flags | getattr(os, "O_DIRECTORY", 0),
        )
        os.rename(
            created.path.name,
            quarantine,
            src_dir_fd=directory_descriptor,
            dst_dir_fd=directory_descriptor,
        )
    except FileNotFoundError:
        if directory_descriptor >= 0:
            os.close(directory_descriptor)
        return
    except OSError as exc:
        if directory_descriptor >= 0:
            os.close(directory_descriptor)
        raise RuntimeAuthorizationError(
            "ephemeral PostgreSQL credential cleanup failed"
        ) from exc
    try:
        password_descriptor = os.open(
            quarantine,
            flags,
            dir_fd=directory_descriptor,
        )
        observed = os.fstat(password_descriptor)
        matching = (
            stat.S_ISREG(observed.st_mode)
            and observed.st_dev == created.device
            and observed.st_ino == created.inode
            and observed.st_uid == created.uid
            and stat.S_IMODE(observed.st_mode) == created.mode
        )
        if not matching:
            try:
                os.stat(
                    created.path.name,
                    dir_fd=directory_descriptor,
                    follow_symlinks=False,
                )
            except FileNotFoundError:
                os.rename(
                    quarantine,
                    created.path.name,
                    src_dir_fd=directory_descriptor,
                    dst_dir_fd=directory_descriptor,
                )
            raise RuntimeAuthorizationError(
                "ephemeral PostgreSQL credential cleanup authority changed"
            )
        path_observed = os.stat(
            quarantine,
            dir_fd=directory_descriptor,
            follow_symlinks=False,
        )
        if (
            path_observed.st_dev != observed.st_dev
            or path_observed.st_ino != observed.st_ino
        ):
            raise RuntimeAuthorizationError(
                "ephemeral PostgreSQL credential cleanup authority changed"
            )
        os.unlink(quarantine, dir_fd=directory_descriptor)
        if os.fstat(password_descriptor).st_nlink != 0:
            raise RuntimeAuthorizationError(
                "ephemeral PostgreSQL credential cleanup authority changed"
            )
        os.fsync(directory_descriptor)
    except OSError as exc:
        raise RuntimeAuthorizationError(
            "ephemeral PostgreSQL credential cleanup failed"
        ) from exc
    finally:
        if password_descriptor >= 0:
            os.close(password_descriptor)
        if directory_descriptor >= 0:
            os.close(directory_descriptor)


def _cleanup_unready_bootstrap(
    authorization: runtime_authorization.RuntimeAuthorization,
    *,
    control_store: process_control.ControlStore | None,
    material: process_control.ControlMaterial | None,
    password: _CreatedPassword | None,
    store_started: bool,
) -> None:
    """Restore prepared roots, retaining recovery authority on refusal.

    Each destructive step depends on the preceding step having completed.  In
    particular, control material remains available when the credential leaf
    cannot be removed, instead of erasing the only bounded recovery surface.
    """

    failure: BaseException | None = None
    callbacks = (
        *((store.stop,) if store_started else ()),
        (lambda: _remove_created_password(password)),
        *(
            (lambda: control_store.remove_control_root(material),)
            if control_store is not None and material is not None
            else ()
        ),
        (lambda: _verify_prepared_runtime_roots(authorization)),
    )
    for callback in callbacks:
        try:
            callback()
        except Exception as exc:  # noqa: BLE001 - preserve exact recovery state
            failure = exc
            break
    if failure is not None:
        raise RuntimeAuthorizationError(
            "D2 bootstrap cleanup did not restore the prepared roots"
        ) from failure


def _cleanup_ready_bootstrap(
    authorization: runtime_authorization.RuntimeAuthorization,
    *,
    password: _CreatedPassword,
    store_started: bool,
) -> None:
    """Use only stable supervisor authority after readiness was verified."""

    control_store, material, client = _load_control(authorization)

    def load_receipt() -> object:
        try:
            return control_store.read_shutdown_receipt(material)
        except process_control.ProcessControlError:
            return None

    process_control.coordinated_teardown(
        client=client,
        load_shutdown_receipt=load_receipt,
        validate_shutdown_receipt=lambda record: (
            isinstance(record, bytes)
            and process_control.verify_shutdown_receipt(record, material)
        ),
        liveness_lock_released=lambda: _wait_liveness_released(control_store, material),
        stop_store=store.stop if store_started else lambda: None,
        destroy_runtime=lambda: _remove_created_password(password),
        remove_control_root=lambda: control_store.remove_control_root(material),
    )
    _verify_prepared_runtime_roots(authorization)


def _start_runtime(
    authorization: runtime_authorization.RuntimeAuthorization,
    *,
    on_supervisor_ready: Callable[[], None],
) -> None:
    """Start the bounded runtime, optionally consuming legacy child authority."""

    root = authorization.runtime_root
    control_root = _control_paths(authorization).root
    if control_root.exists() or control_root.is_symlink():
        raise RuntimeAuthorizationError("D2 external roots must be fresh")
    _verify_prepared_runtime_roots(authorization)
    password: _CreatedPassword | None = None
    control_store: process_control.ControlStore | None = None
    material: process_control.ControlMaterial | None = None
    store_started = False
    supervisor_ready = False
    try:
        password = _create_password(root)
        filesystem = process_control.PosixFileSystemAdapter()
        control_store = process_control.ControlStore(filesystem=filesystem)
        material = control_store.create(
            paths=_control_paths(authorization),
            binding=_control_binding(authorization),
            random_bytes=secrets.token_bytes,
        )
        store.start(_bound_postgres_runtime(authorization))
        store_started = True
        _start_supervisor(authorization, control_store, material)
        supervisor_ready = True
        on_supervisor_ready()
    except BaseException as primary:
        try:
            if supervisor_ready:
                if password is None:
                    raise RuntimeAuthorizationError(
                        "D2 bootstrap password authority is unavailable"
                    )
                _cleanup_ready_bootstrap(
                    authorization,
                    password=password,
                    store_started=store_started,
                )
            else:
                _cleanup_unready_bootstrap(
                    authorization,
                    control_store=control_store,
                    material=material,
                    password=password,
                    store_started=store_started,
                )
        except Exception as cleanup_error:  # noqa: BLE001 - preserve primary cause
            add_note = getattr(primary, "add_note", None)
            if callable(add_note):
                add_note(
                    f"D2 bootstrap cleanup also failed: {type(cleanup_error).__name__}"
                )
        raise


def start() -> None:
    """Legacy standalone start; preserves child one-shot consumption."""

    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)

    def consume_child_authorization() -> None:
        runtime_authorization.consume_once(authorization)

    _start_runtime(authorization, on_supervisor_ready=consume_child_authorization)


def _stage_start(authorization: runtime_authorization.RuntimeAuthorization) -> None:
    """Start under a validated master reservation without child consumption."""

    assert_product_api_compatibility(authorization)
    _start_runtime(authorization, on_supervisor_ready=lambda: None)


def _seed_runtime(authorization: runtime_authorization.RuntimeAuthorization) -> None:
    signed = _signed_pki_root(authorization)
    product_roots = getattr(authorization, "product_roots", None)
    repositories = (
        (
            product_roots["soc"],
            product_roots["cyber_ai"],
            product_roots["tool_fabric"],
        )
        if product_roots is not None
        else (
            _absolute_env(_SOC_REPO_ENV, must_exist=True),
            _absolute_env(_AI_REPO_ENV, must_exist=True),
            _absolute_env(_FABRIC_REPO_ENV, must_exist=True),
        )
    )
    # The PKI root is prepared, signed and already admitted: seeding opens the
    # exact pinned inode and never creates one or infers a fresh identity.
    with pki.authorized_pki_root(
        signed.path,
        expected_device=signed.identity.st_dev,
        expected_inode=signed.identity.st_ino,
        expected_uid=signed.identity.uid,
        expected_mode=int(signed.identity.mode, 8),
    ) as authorized_root:
        pki.create_ephemeral_pki(
            authorized_root,
            repository_roots=(
                _repo_root(),
                *repositories,
            ),
            jwt_kid="soc-lifecycle-d2-ephemeral",
        )


def seed() -> None:
    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    runtime_authorization.verify_consumed(authorization)
    _seed_runtime(authorization)


def _stage_seed(authorization: runtime_authorization.RuntimeAuthorization) -> None:
    assert_product_api_compatibility(authorization)
    _seed_runtime(authorization)


def _reset_runtime(authorization: runtime_authorization.RuntimeAuthorization) -> None:
    runtime = _bound_postgres_runtime(authorization)
    store.migrate(runtime)
    posture = evidence.validate_evidence(store.audit_security_posture(runtime))
    destination = authorization.evidence_root / _POSTGRES_SECURITY_EVIDENCE
    _write_atomic_evidence(destination, posture)


def reset() -> None:
    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    runtime_authorization.verify_consumed(authorization)
    _reset_runtime(authorization)


def _stage_reset(authorization: runtime_authorization.RuntimeAuthorization) -> None:
    assert_product_api_compatibility(authorization)
    _reset_runtime(authorization)


def stop() -> None:
    authorization = assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    runtime_authorization.verify_consumed(authorization)
    _, _, client = _load_control(authorization)
    client.stop_all(request_id="lifecycle-stop-all")
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


def _signed_pki_material(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> pki.PkiMaterial:
    """Build destructive PKI capability only from the signed preparation receipt."""

    signed = _signed_pki_root(authorization)
    if (
        signed.path
        != authorization.runtime_root / runtime_authorization.PREPARED_PKI_LEAF
    ):
        raise RuntimeAuthorizationError(
            "signed D2 PKI root does not match runtime root"
        )
    unsigned = _pki_material(authorization.runtime_root)
    return pki.PkiMaterial(
        root=unsigned.root,
        ca_certificate=unsigned.ca_certificate,
        server_certificate=unsigned.server_certificate,
        server_private_key=unsigned.server_private_key,
        client_certificate=unsigned.client_certificate,
        client_private_key=unsigned.client_private_key,
        alternate_client_certificate=unsigned.alternate_client_certificate,
        alternate_client_private_key=unsigned.alternate_client_private_key,
        jwt_private_key=unsigned.jwt_private_key,
        jwt_public_jwk=unsigned.jwt_public_jwk,
        root_identity=pki.PkiRootIdentity(
            device=signed.identity.st_dev,
            inode=signed.identity.st_ino,
            uid=signed.identity.uid,
            mode=int(signed.identity.mode, 8),
        ),
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
    teardown(authorization)
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
    root: Path,
    evidence_root: Path,
    *,
    strip_tls: bool,
    authorization: runtime_authorization.RuntimeBinding | None = None,
    control_material: process_control.ControlMaterial | None = None,
) -> dict[str, str]:
    runtime = (
        _bound_postgres_runtime(authorization)
        if authorization is not None
        else _postgres_runtime(root)
    )
    environment = dict(os.environ)
    environment.pop("SSLKEYLOGFILE", None)
    for name in (
        _RESERVATION_FRAME_ENV,
        _CONTROL_RUN_ID_ENV,
        _CONTROL_GENERATION_ENV,
    ):
        environment.pop(name, None)
    environment.update(
        {
            _AUTHORIZATION_SHA_ENV: (
                authorization.authorization_sha256
                if authorization is not None
                else environment.get(_AUTHORIZATION_SHA_ENV, "")
            ),
            "CYBRIK_UAT_D2_PKI_ROOT": str(root / "pki"),
            "CYBRIK_UAT_D2_JWKS": str(root / "pki/jwt-public-jwk.json"),
            "CYBRIK_UAT_D2_POSTGRES_DSN": runtime.admin_dsn,
            "CYBRIK_UAT_D2_STRIP_TLS_EXTENSION": "true" if strip_tls else "false",
            _RUNTIME_DIR_ENV: str(root),
            _EVIDENCE_DIR_ENV: str(evidence_root),
            _SOC_REPO_ENV: (
                str(authorization.product_roots["soc"])
                if authorization is not None
                else environment.get(_SOC_REPO_ENV, "")
            ),
            _AI_REPO_ENV: (
                str(authorization.product_roots["cyber_ai"])
                if authorization is not None
                else environment.get(_AI_REPO_ENV, "")
            ),
            _FABRIC_REPO_ENV: (
                str(authorization.product_roots["tool_fabric"])
                if authorization is not None
                else environment.get(_FABRIC_REPO_ENV, "")
            ),
            "CYBRIK_UAT_D2_B1_WHEEL": (
                str(authorization.b1_wheel)
                if isinstance(
                    authorization, runtime_authorization.ReservedRuntimeBinding
                )
                else environment.get("CYBRIK_UAT_D2_B1_WHEEL", "")
            ),
        }
    )
    if isinstance(authorization, runtime_authorization.ReservedRuntimeBinding):
        if control_material is None:
            raise RuntimeAuthorizationError("child reservation proof is unavailable")
        environment.update(
            {
                _RESERVATION_FRAME_ENV: _reservation_frame(
                    authorization, control_material
                ),
                _CONTROL_RUN_ID_ENV: control_material.binding.run_id,
                _CONTROL_GENERATION_ENV: str(control_material.binding.generation),
            }
        )
    return environment


def _wait_ai_listener(root: Path, process: object | None = None) -> None:
    context = ssl.create_default_context(cafile=str(root / "pki/ca-cert.pem"))
    try:
        context.keylog_filename = None
    except (AttributeError, OSError, TypeError, ValueError) as exc:
        raise RuntimeAuthorizationError(
            "TLS key logging could not be disabled"
        ) from exc
    if context.keylog_filename is not None:
        raise RuntimeAuthorizationError("TLS key logging remained enabled")
    context.minimum_version = ssl.TLSVersion.TLSv1_3
    context.maximum_version = ssl.TLSVersion.TLSv1_3
    context.load_cert_chain(
        str(root / "pki/client-cert.pem"), str(root / "pki/client-key.pem")
    )
    for _ in range(80):
        poll = getattr(process, "poll", None)
        if callable(poll) and poll() is not None:
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


def _terminal_postgresql_posture(
    runtime: store.PostgresRuntime,
    *,
    replay_row_count: int,
) -> dict[str, object]:
    """Observe the exact terminal PostgreSQL fields while the DB is live."""

    role = store._psql(
        runtime,
        "SELECT rolsuper, rolbypassrls, rolcreaterole FROM pg_roles "
        "WHERE rolname = 'cybrik_ai_api_app';",
    )
    cross_tenant = store._psql(
        runtime,
        "BEGIN; "
        "INSERT INTO ai_orchestration.delegation_replay "
        "(tenant_id, jti_hash, expires_at) VALUES "
        "('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', repeat('c', 64), 4102444800) "
        "ON CONFLICT DO NOTHING; "
        "SET LOCAL ROLE cybrik_ai_api_app; "
        "WITH configured AS ("
        "SELECT set_config('app.tenant_id', "
        "'11111111-2222-4333-8444-555555555555', true)"
        ") SELECT count(*) FROM ai_orchestration.delegation_replay, configured "
        "WHERE tenant_id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'; "
        "ROLLBACK;",
    )
    if role != "f|f|f" or cross_tenant != "0" or replay_row_count != 1:
        raise RuntimeAuthorizationError("terminal PostgreSQL posture is inconsistent")
    return {
        "role_rolsuper": False,
        "role_rolbypassrls": False,
        "role_rolcreaterole": False,
        "force_rls_table_count": store.RLS_TABLE_COUNT,
        "cross_tenant_row_count": 0,
        "replay_row_count": replay_row_count,
    }


def _run_case(
    case_id: str,
    root: Path,
    evidence_root: Path,
    authorization: runtime_authorization.RuntimeBinding | None = None,
    control_material: process_control.ControlMaterial | None = None,
) -> dict[str, object]:
    result_path = evidence_root / f"case-{case_id.casefold()}.json"
    if isinstance(authorization, runtime_authorization.ReservedRuntimeBinding):
        environment = _server_environment(
            root,
            evidence_root,
            strip_tls=False,
            authorization=authorization,
            control_material=control_material,
        )
    else:
        environment = _server_environment(root, evidence_root, strip_tls=False)
    environment["CYBRIK_UAT_D2_CASE_ID"] = case_id
    environment["CYBRIK_UAT_D2_CASE_RESULT"] = str(result_path)
    try:
        completed = subprocess.run(
            _isolated_module_argv(
                assert_runtime_authorized() if authorization is None else authorization,
                "cybrik_suite_uat_mtls.client",
            ),
            check=False,
            capture_output=True,
            text=True,
            env=environment,
            timeout=30,
            shell=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeAuthorizationError("D2 client case timed out") from exc
    _assert_secret_free_process_output(root, completed.stdout, completed.stderr)
    if (
        completed.returncode != 0
        or not result_path.is_file()
        or result_path.is_symlink()
    ):
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


def _git_clean(root: Path) -> bool:
    """Observe tracked and non-ignored untracked drift without exposing paths."""

    try:
        completed = subprocess.run(
            (
                "git",
                "-C",
                str(root),
                "status",
                "--porcelain=v1",
                "--untracked-files=all",
                "--ignored=no",
                "--ignore-submodules=none",
            ),
            check=False,
            capture_output=True,
            env={
                "GIT_CONFIG_GLOBAL": "/dev/null",
                "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_OPTIONAL_LOCKS": "0",
                "LC_ALL": "C",
                "PATH": "/usr/bin:/bin",
            },
            text=True,
            timeout=30,
            shell=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeAuthorizationError(
            "stage repository cleanliness is unavailable"
        ) from exc
    if completed.returncode != 0 or completed.stderr:
        raise RuntimeAuthorizationError("stage repository cleanliness is unavailable")
    return completed.stdout == ""


def _repository_tuple(
    authorization: runtime_authorization.RuntimeBinding,
) -> dict[str, dict[str, str]]:
    roots = {
        "suite": authorization.suite_root,
        "soc": authorization.product_roots["soc"],
        "ai": authorization.product_roots["cyber_ai"],
        "fabric": authorization.product_roots["tool_fabric"],
    }
    if isinstance(authorization, runtime_authorization.ReservedRuntimeBinding):
        signed_by_repository = {
            repository: (commit, tree)
            for repository, commit, tree in authorization.repository_tuple
        }
        expected_identities = {
            "suite": signed_by_repository["cybrik-suite"],
            "soc": signed_by_repository["cybrik-soc-command-center"],
            "ai": signed_by_repository["cybrik-cyber-ai-platform"],
            "fabric": signed_by_repository["cybrik-security-tool-fabric"],
        }
    else:
        expected_identities = {
            "soc": (
                runtime_authorization.PINNED_VALUES["SOC_COMMIT"],
                runtime_authorization.PINNED_VALUES["SOC_TREE"],
            ),
            "ai": (
                runtime_authorization.PINNED_VALUES["CYBER_AI_COMMIT"],
                runtime_authorization.PINNED_VALUES["CYBER_AI_TREE"],
            ),
            "fabric": (
                runtime_authorization.PINNED_VALUES["TOOL_FABRIC_COMMIT"],
                runtime_authorization.PINNED_VALUES["TOOL_FABRIC_TREE"],
            ),
        }
    result: dict[str, dict[str, str]] = {}
    for name, root in roots.items():
        commit = _git_value(root, "HEAD")
        tree = _git_value(root, "HEAD^{tree}")
        if name == "suite":
            expected_suite = expected_identities.get("suite")
            if commit != authorization.suite_head or (
                expected_suite is not None and (commit, tree) != expected_suite
            ):
                raise RuntimeAuthorizationError("terminal Suite tuple changed")
        elif (commit, tree) != expected_identities[name]:
            raise RuntimeAuthorizationError(f"terminal {name} repository tuple changed")
        result[name] = {"commit_sha": commit, "tree_sha": tree}
    return result


def _stage_repository_tuple(
    authorization: runtime_authorization.RuntimeBinding,
) -> dict[str, dict[str, object]]:
    """Re-observe the exact tuple plus worktree cleanliness for master UAT."""

    observed: dict[str, dict[str, object]] = {
        role: dict(identity)
        for role, identity in _repository_tuple(authorization).items()
    }
    roots = {
        "suite": authorization.suite_root,
        "soc": authorization.product_roots["soc"],
        "ai": authorization.product_roots["cyber_ai"],
        "fabric": authorization.product_roots["tool_fabric"],
    }
    for role, root in roots.items():
        observed[role]["clean"] = _git_clean(root)
    return observed


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
    authorization: runtime_authorization.RuntimeBinding,
    marker: dict[str, object],
    results: list[dict[str, object]],
    case_durations_ms: list[int],
    summary: dict[str, object],
    started_at: datetime,
    elapsed_ms: int,
    public_pki_paths: dict[str, Path],
    postgresql: dict[str, object],
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
        "postgresql": dict(postgresql),
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
                "control_root_absent",
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


def run_runtime_attempt(
    *,
    _stage_authorization: runtime_authorization.RuntimeBinding | None = None,
    _stage_capability: object | None = None,
) -> dict[str, object]:
    """Execute D2 standalone, or through the private non-consuming stage seam."""

    stage_mode = _stage_capability is _STAGE_EXECUTION_CAPABILITY and isinstance(
        _stage_authorization,
        (
            runtime_authorization.RuntimeAuthorization,
            runtime_authorization.ReservedRuntimeBinding,
        ),
    )
    if (_stage_authorization is None) != (_stage_capability is None):
        raise RuntimeAuthorizationError("D2 stage capability is invalid")
    if _stage_authorization is not None and not stage_mode:
        raise RuntimeAuthorizationError("D2 stage capability is invalid")
    authorization = _stage_authorization if stage_mode else assert_runtime_authorized()
    assert_product_api_compatibility(authorization)
    if stage_mode:
        consumed_marker = None
    else:
        consumed_marker = runtime_authorization.verify_consumed(authorization)

    root = authorization.runtime_root
    evidence_root = authorization.evidence_root
    attempt_started_at = datetime.now(UTC)
    attempt_started_monotonic = time.monotonic()
    _, control_material, control_client = _load_control(authorization)
    server_started = False
    results: list[dict[str, object]] = []
    case_durations_ms: list[int] = []
    inventory: secret_inventory.SecretInventory | None = None

    def execute_case(case_id: str) -> dict[str, object]:
        started = time.monotonic()
        result = _run_case(
            case_id,
            root,
            evidence_root,
            authorization,
            control_material,
        )
        case_durations_ms.append(max(0, round((time.monotonic() - started) * 1000)))
        return result

    try:
        control_client.start_server(
            strip_tls=True,
            request_id="runtime-red-start-server",
        )
        server_started = True
        _wait_ai_listener(root)
        results.append(execute_case("N8"))
        if (evidence_root / _TLS_EVIDENCE).exists():
            raise RuntimeAuthorizationError("N8 unexpectedly retained a TLS extension")
        control_client.stop_server(request_id="runtime-red-stop-server")
        server_started = False

        control_client.start_server(
            strip_tls=False,
            request_id="runtime-green-start-server",
        )
        server_started = True
        _wait_ai_listener(root)
        runtime = _bound_postgres_runtime(authorization)
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
        terminal_postgresql = _terminal_postgresql_posture(
            runtime, replay_row_count=postgres_replay_row_count
        )
        store.stop()
        if not store.verify_absent():
            raise RuntimeAuthorizationError("N9 PostgreSQL outage was not established")
        results.append(execute_case("N9"))
        mtls_summary = _assert_mtls_evidence(evidence_root)
        control_client.stop_server(request_id="runtime-green-stop-server")
        server_started = False
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
        if stage_mode:
            return validated_summary
        if consumed_marker is None:
            raise RuntimeAuthorizationError("consumed marker is required for terminal")
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
            postgresql=terminal_postgresql,
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
        if server_started:
            control_client.stop_server(request_id="runtime-finally-stop-server")
        if inventory is not None:
            inventory.clear()


def _stage_run_runtime_attempt(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> dict[str, object]:
    """Execute D2 without child consumption or child terminal preparation."""

    return run_runtime_attempt(
        _stage_authorization=authorization,
        _stage_capability=_STAGE_EXECUTION_CAPABILITY,
    )


def _wait_liveness_released(
    control_store: process_control.ControlStore,
    material: process_control.ControlMaterial,
) -> bool:
    for _ in range(_CONTROL_RELEASE_ATTEMPTS):
        if control_store.liveness_released(material):
            return True
        time.sleep(0.25)
    return False


def _destroy_runtime_root(
    authorization: runtime_authorization.RuntimeAuthorization,
    *,
    preserve_root: bool = False,
) -> None:
    root = authorization.runtime_root
    if root.is_symlink():
        raise RuntimeAuthorizationError("refusing a symlinked runtime teardown root")
    if not root.exists():
        return
    if preserve_root and not (root / runtime_authorization.PREPARED_PKI_LEAF).exists():
        try:
            if not any(root.iterdir()):
                return
        except OSError as exc:
            raise RuntimeAuthorizationError(
                "runtime root contains unverified material"
            ) from exc
    pki.destroy_ephemeral_pki(_signed_pki_material(authorization))
    (root / _PASSWORD_FILE).unlink(missing_ok=True)
    if preserve_root:
        try:
            if any(root.iterdir()):
                raise RuntimeAuthorizationError(
                    "runtime root contains unverified material"
                )
        except OSError as exc:
            raise RuntimeAuthorizationError(
                "runtime root contains unverified material"
            ) from exc
        return
    try:
        root.rmdir()
    except OSError as exc:
        raise RuntimeAuthorizationError(
            "runtime root contains unverified material"
        ) from exc


def _teardown_runtime(
    admitted: runtime_authorization.RuntimeAuthorization,
    *,
    bind_legacy_environment: bool,
    preserve_runtime_root: bool,
) -> None:
    if bind_legacy_environment:
        environment_root, environment_evidence = _bounded_external_roots(
            repositories_must_exist=False
        )
        admitted_root = getattr(admitted, "runtime_root", environment_root)
        admitted_evidence = getattr(admitted, "evidence_root", environment_evidence)
        if environment_root != admitted_root:
            raise RuntimeAuthorizationError(
                "authorized runtime root does not match the bounded environment root"
            )
        if environment_evidence != admitted_evidence:
            raise RuntimeAuthorizationError(
                "authorized evidence root does not match the bounded environment root"
            )
    else:
        admitted_root = admitted.runtime_root
    root = admitted_root
    control_root = _control_paths(admitted).root
    if root.is_symlink() or control_root.is_symlink():
        raise RuntimeAuthorizationError("refusing a symlinked runtime teardown root")
    if not root.exists() and not control_root.exists():
        return
    if preserve_runtime_root and not control_root.exists():
        _destroy_runtime_root(admitted, preserve_root=True)
        return
    control_store, material, client = _load_control(admitted)

    def load_receipt() -> object:
        try:
            return control_store.read_shutdown_receipt(material)
        except process_control.ProcessControlError:
            return None

    try:
        process_control.coordinated_teardown(
            client=client,
            load_shutdown_receipt=load_receipt,
            validate_shutdown_receipt=lambda record: (
                isinstance(record, bytes)
                and process_control.verify_shutdown_receipt(record, material)
            ),
            liveness_lock_released=lambda: _wait_liveness_released(
                control_store, material
            ),
            stop_store=store.stop,
            destroy_runtime=(
                (lambda: _destroy_runtime_root(admitted, preserve_root=True))
                if preserve_runtime_root
                else (lambda: _destroy_runtime_root(admitted))
            ),
            remove_control_root=lambda: control_store.remove_control_root(material),
        )
    except process_control.ProcessControlError as exc:
        raise RuntimeAuthorizationError(
            f"stable process-control teardown is refused: {exc.reason}"
        ) from exc


def teardown(
    authorization: runtime_authorization.RuntimeAuthorization | None = None,
) -> None:
    """Reap standalone D2 through its legacy environment authority."""

    admitted = assert_runtime_authorized() if authorization is None else authorization
    _teardown_runtime(
        admitted,
        bind_legacy_environment=True,
        preserve_runtime_root=False,
    )


def _stage_teardown(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> None:
    """Reap only roots carried directly by the master stage capability."""

    _teardown_runtime(
        authorization,
        bind_legacy_environment=False,
        preserve_runtime_root=True,
    )


def _listener_absent(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.25)
        return probe.connect_ex(("127.0.0.1", port)) != 0


def _module_process_absent(pattern: str) -> bool:
    """Observe one exact D2 module without reading or retaining process details."""

    try:
        completed = subprocess.run(
            (_PGREP_EXECUTABLE, "-q", "-f", pattern),
            check=False,
            env={"LC_ALL": "C"},
            shell=False,
            stderr=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            text=True,
            timeout=_PROCESS_OBSERVATION_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeAuthorizationError(
            "bounded process absence observation is unavailable"
        ) from exc
    if completed.returncode == 1:
        return True
    if completed.returncode == 0:
        return False
    raise RuntimeAuthorizationError(
        "bounded process absence observation is unavailable"
    )


def _process_absence_state() -> dict[str, bool]:
    """Independently observe the bounded AI and SOC child command signatures."""

    ai_process_absent = all(
        _module_process_absent(pattern) for pattern in _AI_PROCESS_PATTERNS
    )
    soc_process_absent = all(
        _module_process_absent(pattern) for pattern in _SOC_PROCESS_PATTERNS
    )
    return {
        "ai_process_absent": ai_process_absent,
        "soc_process_absent": soc_process_absent,
    }


def _absence_state_for(
    authorization: runtime_authorization.RuntimeAuthorization,
    *,
    preserve_runtime_root: bool,
) -> dict[str, bool]:
    root = authorization.runtime_root
    material = _pki_material(root)
    process_absence = _process_absence_state()
    control_absent = process_control.control_root_absent(
        _control_paths(authorization).root
    )
    observed = {
        **process_absence,
        "postgres_container_absent": not store.container_exists(),
        "ai_listener_absent": _listener_absent(58443),
        "postgres_listener_absent": _listener_absent(store.POSTGRES_PORT),
        "runtime_root_absent": (
            root.is_dir() and not root.is_symlink() and not any(root.iterdir())
            if preserve_runtime_root
            else not root.exists() and not root.is_symlink()
        ),
        "pki_absent": pki.verify_absent(material),
        "control_root_absent": control_absent,
    }
    return {"completed": all(observed.values()), **observed}


def _live_absence_state() -> dict[str, bool]:
    """Observe each legacy environment-bound resource after teardown."""

    root, _ = _bounded_external_roots(repositories_must_exist=False)
    authorization = assert_runtime_authorized()
    if root != authorization.runtime_root:
        raise RuntimeAuthorizationError("authorized runtime root changed")
    return _absence_state_for(authorization, preserve_runtime_root=False)


def _stage_absence_state(
    authorization: runtime_authorization.RuntimeAuthorization,
) -> dict[str, bool]:
    """Observe only resources bound by the direct master stage capability."""

    return _absence_state_for(authorization, preserve_runtime_root=True)


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
