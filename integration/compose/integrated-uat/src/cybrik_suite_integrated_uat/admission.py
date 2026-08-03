"""Import-inert, one-SSHSIG admission for the Suite integrated UAT."""
# ruff: noqa: SIM905

from __future__ import annotations

import hashlib
import importlib
import os
import re
import stat
import subprocess
import sys
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import MappingProxyType
from typing import Final

from .authorization_packet import (
    MASTER_AUTHORIZATION_FIELDS,
    MASTER_AUTHORIZATION_SCHEMA,
    AuthorizationPacketError,
    MasterBindingInputs,
    aware_utc_timestamp,
    canonical_master_record,
    master_document,
)
from .models import (
    EXPECTED_EXTERNAL_CAPABILITIES,
    EXPECTED_REPOSITORIES,
    ExternalRootBinding,
    MasterAuthorization,
    RepositoryIdentity,
    RepositoryRoot,
    external_roots_digest,
    repository_roots_digest,
    repository_tuple_digest,
)

_AUTHORITY_ENVIRONMENT_NAMES: Final = frozenset(
    "CYBRIK_UAT_SUITE_ROOT CYBRIK_UAT_SOC_ROOT CYBRIK_UAT_CYBER_AI_ROOT "
    "CYBRIK_UAT_TOOL_FABRIC_ROOT CYBRIK_UAT_RUNTIME_ROOT "
    "CYBRIK_UAT_EVIDENCE_ROOT CYBRIK_UAT_STATE_ROOT "
    "CYBRIK_UAT_AUTHORIZATION_FILE CYBRIK_UAT_AUTHORIZATION_SIGNATURE "
    "CYBRIK_UAT_AUTHORIZATION_ALLOWED_SIGNERS CYBRIK_UAT_ALLOWED_SIGNER "
    "CYBRIK_UAT_B1_WHEEL CYBRIK_UAT_PYTHON".split()
)
_MASTER_ENVIRONMENT_NAMES: Final = _AUTHORITY_ENVIRONMENT_NAMES | frozenset(
    "CYBRIK_UAT_MASTER_EVIDENCE_ROOT CYBRIK_UAT_D2_RUNTIME_DIR "
    "CYBRIK_UAT_D2_EVIDENCE_DIR".split()
)
_ROLE_ORDER: Final = ("suite", "soc", "cyber_ai", "tool_fabric")
_HEX40 = re.compile(r"[0-9a-f]{40}\Z")
_HEX64 = re.compile(r"[0-9a-f]{64}\Z")
_RUN_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,127}\Z")
_D2_ROOT_SUFFIX: Final = r"[a-z0-9][a-z0-9._-]{0,63}"
_TRACKED_BLOB_ALGORITHM: Final = "cybrik-uat-tracked-blob-sha256-lines/v1"
HELPER_SCRIPTS: Final = (
    Path(
        "integration/compose/soc-ai-lifecycle-create-mtls/scripts/integrated_uat_stage.py"
    ),
    Path(
        "integration/compose/soc-ai-fabric-alert-context-mtls/scripts/integrated_uat_stage.py"
    ),
    Path("integration/compose/integrated-uat/scripts/inspect_environment.py"),
    Path("integration/compose/integrated-uat/scripts/common_teardown.py"),
)
_D2_MODULES = (
    "__init__",
    "callable_fabric_rehearsal",
    "client",
    "evidence",
    "harness",
    "pki",
    "policy",
    "postgres_stage",
    "procedure",
    "process_control",
    "process_supervisor",
    "runtime_authorization",
    "runtime_evidence",
    "secret_inventory",
    "server",
    "store",
    "terminal_integration",
)
_ALERT_MODULES = (
    "__init__",
    "admission",
    "ai_app",
    "b1_runtime",
    "bootstrap",
    "composition",
    "driver",
    "evidence",
    "fabric_app",
    "integrated_stage",
    "integrated_stage_cli",
    "receipt_identity",
    "runner",
    "runtime_bootstrap",
    "runtime_case_wiring",
    "runtime_cleanup",
    "runtime_cases",
    "runtime_composition",
    "runtime_pki",
    "runtime_process",
    "runtime_supervisor",
    "runtime_wiring",
    "runtime_wiring_admission",
    "runtime_wiring_process",
    "soc_service_app",
    "tls_process",
)
_MASTER_MODULES = tuple(
    "__init__ adapters admission authorization_packet bootstrap cleanup errors models "
    "orchestrator preparation protocols storage".split()
)
_SOC_PATHS = (
    "services/api/src/cybrik_soc/__init__.py",
    "services/api/src/cybrik_soc/config.py",
    "services/api/src/cybrik_soc/modules/alert/__init__.py",
    "services/api/src/cybrik_soc/modules/copilot/__init__.py",
    "services/api/src/cybrik_soc/modules/copilot/lifecycle_create.py",
    "services/api/src/cybrik_soc/modules/copilot/shadow_remote_contract.py",
    "services/api/src/cybrik_soc/modules/org/__init__.py",
    "services/api/src/cybrik_soc/platform/secrets.py",
    "services/api/src/cybrik_soc/platform/__init__.py",
    *(
        f"services/api/src/cybrik_soc/platform/svc_delegation/{name}.py"
        for name in (
            "__init__",
            "algorithms",
            "errors",
            "factory",
            "issuer",
            "models",
            "principal_adapter",
            "scopes",
            "signer",
        )
    ),
    *(
        f"services/api/src/cybrik_soc/modules/alert/context/{name}.py"
        for name in (
            "__init__",
            "authorize",
            "clearance",
            "digest",
            "models",
            "ports",
            "redact",
            "service",
        )
    ),
    "services/api/src/cybrik_soc/modules/org/contract.py",
)
_AI_PATHS = (
    "packages/ai-core/src/cybrik_ai_core/__init__.py",
    *(
        f"packages/ai-core/src/cybrik_ai_core/contract/{name}.py"
        for name in (
            "__init__",
            "common",
            "inference",
            "lifecycle",
            "summarization",
        )
    ),
    *(
        f"packages/ai-core/src/cybrik_ai_core/delegation/{name}.py"
        for name in (
            "__init__",
            "audit",
            "certbind",
            "contract",
            "errors",
            "jose",
            "ports",
            "replay",
            "trust",
            "verifier",
        )
    ),
    "packages/ai-core/src/cybrik_ai_core/errors.py",
    "packages/ai-core/src/cybrik_ai_core/marking.py",
    *(
        f"packages/ai-core/src/cybrik_ai_core/modelrt/{name}.py"
        for name in (
            "__init__",
            "budget",
            "port",
            "resilience",
            "types",
        )
    ),
    *(
        f"packages/ai-core/src/cybrik_ai_core/orchestration/{name}.py"
        for name in (
            "__init__",
            "attempt",
            "checkpoints",
            "controller",
            "durable",
            "errors",
            "memory",
            "ports",
            "state",
        )
    ),
    "packages/ai-core/src/cybrik_ai_core/policy.py",
    "packages/ai-core/src/cybrik_ai_core/prompts.py",
    "packages/ai-core/src/cybrik_ai_core/security/__init__.py",
    "packages/ai-core/src/cybrik_ai_core/security/egress.py",
    "packages/ai-core/src/cybrik_ai_core/security/untrusted.py",
    "packages/ai-core/src/cybrik_ai_core/telemetry.py",
    "services/ai-api/src/cybrik_ai_api/__init__.py",
    "services/ai-api/src/cybrik_ai_api/app.py",
    *(
        f"services/ai-api/src/cybrik_ai_api/investigations/{name}.py"
        for name in (
            "__init__",
            "api",
            "projection",
            "relying_party",
            "service",
        )
    ),
    "services/ai-api/src/cybrik_ai_api/orchestration/__init__.py",
    "services/ai-api/src/cybrik_ai_api/orchestration/postgres.py",
    "services/ai-api/src/cybrik_ai_api/runtime_composition.py",
    "services/ai-api/src/cybrik_ai_api/runtime_settings.py",
    "services/ai-api/src/cybrik_ai_api/summarize/__init__.py",
    "services/ai-api/src/cybrik_ai_api/summarize/service.py",
    "services/ai-api/src/cybrik_ai_api/transport_security.py",
)
_FABRIC_PATHS = (
    "src/control-plane/cybrik_fabric_control/__about__.py",
    "src/control-plane/cybrik_fabric_control/__init__.py",
    *(
        f"src/control-plane/cybrik_fabric_control/contracts/{name}.py"
        for name in (
            "__init__",
            "alert_context",
            "capability",
            "invocation",
            "jcs",
            "loader",
            "provenance",
        )
    ),
    *(
        f"src/control-plane/cybrik_fabric_control/invocation/{name}.py"
        for name in (
            "__init__",
            "bound_receipt",
            "fsync_journal",
            "models",
            "ports",
            "receipt",
            "service",
        )
    ),
    "src/control-plane/cybrik_fabric_control/runtime_adapters.py",
    "src/control-plane/cybrik_fabric_control/runtime_routes.py",
)
_SUITE_PATHS = (
    "integration/compose/soc-ai-lifecycle-create-mtls/pyproject.toml",
    "integration/compose/soc-ai-lifecycle-create-mtls/scripts/integrated_uat_stage.py",
    *(
        f"integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/{name}.py"
        for name in _D2_MODULES
    ),
    "integration/compose/soc-ai-fabric-alert-context-mtls/authorization-trust.json",
    "integration/compose/soc-ai-fabric-alert-context-mtls/pyproject.toml",
    "integration/compose/soc-ai-fabric-alert-context-mtls/scripts/integrated_uat_stage.py",
    *(
        f"integration/compose/soc-ai-fabric-alert-context-mtls/src/cybrik_suite_uat_fabric/{name}.py"
        for name in _ALERT_MODULES
    ),
    "integration/compose/integrated-uat/pyproject.toml",
    "integration/compose/integrated-uat/scripts/common_teardown.py",
    "integration/compose/integrated-uat/scripts/generate_master_authorization.py",
    "integration/compose/integrated-uat/scripts/inspect_environment.py",
    "integration/compose/integrated-uat/scripts/run_integrated_uat.py",
    *(
        f"integration/compose/integrated-uat/src/cybrik_suite_integrated_uat/{name}.py"
        for name in _MASTER_MODULES
    ),
)
MASTER_TRACKED_ALLOWLIST: Final[Mapping[str, tuple[str, ...]]] = MappingProxyType(
    {
        "suite": tuple(sorted(set(_SUITE_PATHS))),
        "soc": tuple(sorted(set(_SOC_PATHS))),
        "cyber_ai": tuple(sorted(set(_AI_PATHS))),
        "tool_fabric": tuple(sorted(set(_FABRIC_PATHS))),
    }
)


class IntegratedAdmissionError(RuntimeError): ...


@dataclass(frozen=True, slots=True)
class AdmissionDependencies:
    helper_sha256: Callable[[Path, Path], str]
    load_runtime_environment: Callable[[Mapping[str, str]], object]
    now: Callable[[], datetime]
    observe_exact_tuple: Callable[[Sequence[object]], tuple[object, ...]]
    tracked_blob_aggregate: Callable[..., object]
    verify_signed_intent: Callable[[object], object]


@dataclass(frozen=True, slots=True)
class MasterEnvironment:
    authority: object
    evidence_root: Path
    external_roots: tuple[ExternalRootBinding, ...]


@dataclass(frozen=True, slots=True)
class AdmittedMaster:
    authorization: MasterAuthorization
    b1_wheel: Path
    b1_wheel_sha256: str
    helper_sha256: Mapping[Path, str]
    python_executable: Path
    python_sha256: str
    suite_root: Path


def _fail(reason: str) -> None:
    raise IntegratedAdmissionError(reason)


def _required(environment: Mapping[str, str], name: str) -> str:
    value = environment.get(name)
    if not isinstance(value, str) or not value:
        _fail("master_environment_missing")
    return value


def _empty_private_root(value: object) -> Path:
    if not isinstance(value, (str, Path)):
        _fail("master_external_root_invalid")
    path = Path(value)
    try:
        observed = os.lstat(path)
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise IntegratedAdmissionError("master_external_root_invalid") from exc
    if (
        not path.is_absolute()
        or resolved != path
        or not stat.S_ISDIR(observed.st_mode)
        or observed.st_uid != os.geteuid()
        or stat.S_IMODE(observed.st_mode) != 0o700
    ):
        _fail("master_external_root_invalid")
    try:
        if any(path.iterdir()):
            _fail("master_external_root_not_empty")
    except OSError as exc:
        raise IntegratedAdmissionError("master_external_root_invalid") from exc
    return path


def _overlap(left: Path, right: Path) -> bool:
    return left == right or left.is_relative_to(right) or right.is_relative_to(left)


def _authority_environment(environment: Mapping[str, str]) -> dict[str, str]:
    return {name: _required(environment, name) for name in _AUTHORITY_ENVIRONMENT_NAMES}


def load_master_environment(
    environment: Mapping[str, str], *, dependencies: AdmissionDependencies
) -> MasterEnvironment:
    unknown = {
        name
        for name in environment
        if name.startswith("CYBRIK_UAT_") and name not in _MASTER_ENVIRONMENT_NAMES
    }
    if unknown:
        _fail("master_environment_unknown")
    authority = dependencies.load_runtime_environment(
        _authority_environment(environment)
    )
    try:
        repositories = tuple(authority.repositories.roots)
        alert_roots = (
            authority.external.runtime_root,
            authority.external.evidence_root,
            authority.external.state_root,
        )
    except (AttributeError, TypeError) as exc:
        raise IntegratedAdmissionError("master_environment_invalid") from exc
    configured_alert_roots = tuple(
        Path(_required(environment, name))
        for name in (
            "CYBRIK_UAT_RUNTIME_ROOT",
            "CYBRIK_UAT_EVIDENCE_ROOT",
            "CYBRIK_UAT_STATE_ROOT",
        )
    )
    if alert_roots != configured_alert_roots:
        _fail("master_environment_invalid")
    evidence_root = _empty_private_root(
        _required(environment, "CYBRIK_UAT_MASTER_EVIDENCE_ROOT")
    )
    roots = (
        _empty_private_root(_required(environment, "CYBRIK_UAT_D2_RUNTIME_DIR")),
        _empty_private_root(_required(environment, "CYBRIK_UAT_D2_EVIDENCE_DIR")),
        *(_empty_private_root(root) for root in alert_roots),
    )
    protected = (*repositories, evidence_root)
    if any(
        _overlap(left, right)
        for index, left in enumerate(roots)
        for right in roots[index + 1 :]
    ) or any(_overlap(root, item) for root in roots for item in protected):
        _fail("master_external_roots_not_disjoint")
    return MasterEnvironment(
        authority=authority,
        evidence_root=evidence_root,
        external_roots=tuple(
            ExternalRootBinding(capability, root)
            for capability, root in zip(
                EXPECTED_EXTERNAL_CAPABILITIES, roots, strict=True
            )
        ),
    )


def _module_origin(module: object, source_root: Path) -> None:
    origin = getattr(module, "__file__", None)
    if not isinstance(origin, str):
        _fail("master_authority_import_invalid")
    try:
        path = Path(origin).resolve(strict=True)
    except OSError as exc:
        raise IntegratedAdmissionError("master_authority_import_invalid") from exc
    if not path.is_relative_to(source_root):
        _fail("master_authority_import_invalid")


def _descriptor_sha256(path: Path, *, maximum: int, reason: str) -> str:
    no_follow = getattr(os, "O_NOFOLLOW", 0)
    close_on_exec = getattr(os, "O_CLOEXEC", 0)
    if (
        not path.is_absolute()
        or path.is_symlink()
        or not no_follow
        or not close_on_exec
    ):
        _fail(reason)
    try:
        resolved = path.resolve(strict=True)
        descriptor = os.open(path, os.O_RDONLY | no_follow | close_on_exec)
    except OSError as exc:
        raise IntegratedAdmissionError(reason) from exc
    try:
        before = os.fstat(descriptor)
        if (
            resolved != path
            or not stat.S_ISREG(before.st_mode)
            or before.st_nlink != 1
            or before.st_size < 1
            or before.st_size > maximum
        ):
            _fail(reason)
        with os.fdopen(os.dup(descriptor), "rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        after = os.fstat(descriptor)
        current = os.stat(path, follow_symlinks=False)
    except OSError as exc:
        raise IntegratedAdmissionError(reason) from exc
    finally:
        os.close(descriptor)
    fields = (
        "st_dev",
        "st_ino",
        "st_uid",
        "st_mode",
        "st_nlink",
        "st_size",
        "st_mtime_ns",
        "st_ctime_ns",
    )
    if any(
        getattr(before, field) != getattr(after, field)
        or getattr(before, field) != getattr(current, field)
        for field in fields
    ):
        _fail(reason)
    return digest


def _read_helper_sha256(suite_root: Path, relative: Path) -> str:
    path = suite_root / relative
    current_sha256 = _descriptor_sha256(
        path, maximum=1024 * 1024, reason="master_helper_invalid"
    )
    if stat.S_IMODE(os.stat(path, follow_symlinks=False).st_mode) & 0o022:
        _fail("master_helper_invalid")
    try:
        result = subprocess.run(
            (
                "/usr/bin/git",
                "-C",
                str(suite_root),
                "show",
                f"HEAD:{relative.as_posix()}",
            ),
            check=True,
            capture_output=True,
            env={
                "GIT_CONFIG_GLOBAL": "/dev/null",
                "GIT_CONFIG_NOSYSTEM": "1",
                "LC_ALL": "C",
                "PATH": "/usr/bin:/bin",
            },
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise IntegratedAdmissionError("master_helper_invalid") from exc
    if (
        not result.stdout
        or len(result.stdout) > 1024 * 1024
        or hashlib.sha256(result.stdout).hexdigest() != current_sha256
    ):
        _fail("master_helper_drifted")
    return current_sha256


def _pinned_file_sha256(path: object) -> str:
    if not isinstance(path, Path):
        _fail("master_pinned_file_invalid")
    return _descriptor_sha256(
        path, maximum=64 * 1024 * 1024, reason="master_pinned_file_invalid"
    )


def _default_dependencies(suite_root: Path) -> AdmissionDependencies:
    source_root = (
        suite_root / "integration/compose/soc-ai-fabric-alert-context-mtls/src"
    )
    try:
        exact_source = source_root.resolve(strict=True)
    except OSError as exc:
        raise IntegratedAdmissionError("master_authority_import_invalid") from exc
    if exact_source != source_root or not source_root.is_dir():
        _fail("master_authority_import_invalid")
    source_text = str(source_root)
    if source_text not in sys.path:
        sys.path.insert(0, source_text)
    authority_admission = importlib.import_module("cybrik_suite_uat_fabric.admission")
    authority_wiring = importlib.import_module(
        "cybrik_suite_uat_fabric.runtime_wiring_admission"
    )
    _module_origin(authority_admission, source_root)
    _module_origin(authority_wiring, source_root)
    return AdmissionDependencies(
        helper_sha256=_read_helper_sha256,
        load_runtime_environment=authority_wiring.load_runtime_environment,
        now=lambda: datetime.now(UTC),
        observe_exact_tuple=authority_admission.observe_exact_tuple,
        tracked_blob_aggregate=authority_admission.tracked_blob_aggregate,
        verify_signed_intent=authority_wiring.verify_signed_intent,
    )


def _repository_bindings(authority: object) -> tuple[RepositoryRoot, ...]:
    try:
        roots = (
            authority.repositories.soc,
            authority.repositories.cyber_ai,
            authority.repositories.tool_fabric,
            authority.repositories.suite,
        )
    except AttributeError as exc:
        raise IntegratedAdmissionError("master_environment_invalid") from exc
    return tuple(
        RepositoryRoot(name, root)
        for name, root in zip(
            (
                "cybrik-soc-command-center",
                "cybrik-cyber-ai-platform",
                "cybrik-security-tool-fabric",
                "cybrik-suite",
            ),
            roots,
            strict=True,
        )
    )


def _timestamp(value: object) -> datetime:
    try:
        return aware_utc_timestamp(value)
    except AuthorizationPacketError as exc:
        raise IntegratedAdmissionError(
            "master_authorization_timestamp_invalid"
        ) from exc


def _master_record(payload: bytes) -> dict[str, object]:
    try:
        return canonical_master_record(payload)
    except AuthorizationPacketError as exc:
        if str(exc) == "json_invalid":
            raise IntegratedAdmissionError("master_authorization_json_invalid") from exc
        raise IntegratedAdmissionError("master_authorization_not_canonical") from exc


def _validate_master_record(
    *,
    aggregate: object,
    b1_sha256: str,
    config: MasterEnvironment,
    helper_sha256: Mapping[Path, str],
    intent: object,
    now: datetime,
    observations: tuple[object, ...],
    python_sha256: str,
    repository_roots: tuple[RepositoryRoot, ...],
) -> tuple[str, str]:
    record = _master_record(intent.payload)
    authorization_id = record["authorization_id"]
    if (
        record["schema"] != MASTER_AUTHORIZATION_SCHEMA
        or record["decision"] != "APPROVE"
        or record["one_shot"] is not True
        or record["authorized_by"] != config.authority.allowed_signer
        or not isinstance(authorization_id, str)
        or _RUN_ID.fullmatch(authorization_id) is None
    ):
        _fail("master_authorization_policy_invalid")
    issued = _timestamp(record["issued_at"])
    expires = _timestamp(record["expires_at"])
    current = now.astimezone(UTC) if now.tzinfo is not None else None
    if (
        current is None
        or issued > current
        or current >= expires
        or expires <= issued
        or expires - issued > timedelta(hours=24)
    ):
        _fail("master_authorization_not_current")
    expected = master_document(
        MasterBindingInputs(
            authorization_id=authorization_id,
            authorized_by=record["authorized_by"],
            issued_at=issued,
            expires_at=expires,
            b1_wheel={
                "path": str(config.authority.b1_wheel),
                "sha256": b1_sha256,
            },
            evidence_root=str(config.evidence_root),
            external_roots=tuple(item.to_dict() for item in config.external_roots),
            external_roots_sha256=external_roots_digest(config.external_roots),
            helper_scripts=tuple(
                {"path": path.as_posix(), "sha256": helper_sha256[path]}
                for path in HELPER_SCRIPTS
            ),
            python={
                "path": str(config.authority.python),
                "sha256": python_sha256,
            },
            repository_roots=tuple(item.to_dict() for item in repository_roots),
            repository_roots_sha256=repository_roots_digest(repository_roots),
            repository_tuple=tuple(
                (item.role, item.commit, item.tree) for item in observations
            ),
            tracked_blob_aggregate={
                "algorithm": aggregate.algorithm,
                "file_count": aggregate.file_count,
                "sha256": aggregate.sha256,
            },
        )
    )
    binding_fields = MASTER_AUTHORIZATION_FIELDS - {
        "authorization_id",
        "authorized_by",
        "decision",
        "expires_at",
        "issued_at",
        "one_shot",
        "schema",
    }
    if any(record[field] != expected[field] for field in binding_fields):
        _fail("master_authorization_binding_mismatch")
    return authorization_id, hashlib.sha256(intent.payload).hexdigest()


def admit_master_authorization(
    environment: Mapping[str, str] | None = None,
    *,
    dependencies: AdmissionDependencies | None = None,
) -> AdmittedMaster:
    selected_environment = os.environ if environment is None else environment
    selected = dependencies or _default_dependencies(
        Path(_required(selected_environment, "CYBRIK_UAT_SUITE_ROOT"))
    )
    config = load_master_environment(selected_environment, dependencies=selected)
    try:
        intent = selected.verify_signed_intent(config.authority)
        if (
            not isinstance(getattr(intent, "payload", None), bytes)
            or not isinstance(getattr(intent, "signature", None), bytes)
            or not intent.payload
            or not intent.signature
        ):
            _fail("master_external_authorization_invalid")
        observations = selected.observe_exact_tuple(intent.expectations)
        if (
            len(observations) != 4
            or tuple(item.role for item in observations) != _ROLE_ORDER
            or tuple(item.root for item in observations)
            != tuple(config.authority.repositories.roots)
            or any(_HEX40.fullmatch(item.commit) is None for item in observations)
            or any(_HEX40.fullmatch(item.tree) is None for item in observations)
        ):
            _fail("master_repository_tuple_invalid")
        aggregate = selected.tracked_blob_aggregate(
            observations, MASTER_TRACKED_ALLOWLIST
        )
        if (
            getattr(aggregate, "algorithm", None) != _TRACKED_BLOB_ALGORITHM
            or getattr(aggregate, "file_count", None)
            != sum(len(paths) for paths in MASTER_TRACKED_ALLOWLIST.values())
            or _HEX64.fullmatch(str(getattr(aggregate, "sha256", ""))) is None
        ):
            _fail("master_aggregate_invalid")
    except IntegratedAdmissionError:
        raise
    except Exception as exc:
        raise IntegratedAdmissionError("master_external_authorization_invalid") from exc
    identities = tuple(
        RepositoryIdentity(repository, item.commit, item.tree, True)
        for repository, item in zip(
            EXPECTED_REPOSITORIES,
            (*observations[1:], observations[0]),
            strict=True,
        )
    )
    repository_roots = _repository_bindings(config.authority)
    helper_sha256 = {
        relative: selected.helper_sha256(config.authority.repositories.suite, relative)
        for relative in HELPER_SCRIPTS
    }
    if any(_HEX64.fullmatch(value) is None for value in helper_sha256.values()):
        _fail("master_helper_invalid")
    b1_sha256 = _pinned_file_sha256(config.authority.b1_wheel)
    python_sha256 = _pinned_file_sha256(config.authority.python)
    authorization_id, authorization_sha256 = _validate_master_record(
        aggregate=aggregate,
        b1_sha256=b1_sha256,
        config=config,
        helper_sha256=helper_sha256,
        intent=intent,
        now=selected.now(),
        observations=observations,
        python_sha256=python_sha256,
        repository_roots=repository_roots,
    )
    for binding, kind in zip(
        config.external_roots, ("runtime", "evidence"), strict=False
    ):
        if (
            re.fullmatch(rf"cybrik-uat-d2-{kind}-{_D2_ROOT_SUFFIX}", binding.root.name)
            is None
        ):
            _fail("master_postgres_root_not_purpose_bound")
    authorization = MasterAuthorization(
        aggregate_sha256=aggregate.sha256,
        authorization_sha256=authorization_sha256,
        evidence_root=config.evidence_root,
        exact_head_grant_sha256=hashlib.sha256(intent.signature).hexdigest(),
        external_roots=config.external_roots,
        external_roots_sha256=external_roots_digest(config.external_roots),
        repository_roots=repository_roots,
        repository_roots_sha256=repository_roots_digest(repository_roots),
        repository_tuple=identities,
        repository_tuple_sha256=repository_tuple_digest(identities),
        run_id=authorization_id,
    )
    return AdmittedMaster(
        authorization=authorization,
        b1_wheel=config.authority.b1_wheel,
        b1_wheel_sha256=b1_sha256,
        helper_sha256=MappingProxyType(helper_sha256),
        python_executable=config.authority.python,
        python_sha256=python_sha256,
        suite_root=config.authority.repositories.suite,
    )
