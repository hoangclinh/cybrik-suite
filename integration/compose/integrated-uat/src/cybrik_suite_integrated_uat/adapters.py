"""Fail-closed, import-inert subprocess adapters for integrated UAT."""

# ruff: noqa: SIM905

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from collections.abc import Callable, Mapping
from pathlib import Path
from types import MappingProxyType
from typing import Final

from .cleanup import CompositeCommonTeardown
from .errors import AdapterFailure
from .models import (
    EXPECTED_EXTERNAL_CAPABILITIES,
    EXPECTED_PORTS,
    EXPECTED_REPOSITORIES,
    EnvironmentSnapshot,
    MasterAuthorization,
    OrchestrationContext,
    RepositoryIdentity,
    StageReceipt,
    canonical_json_bytes,
    external_roots_digest,
    repository_roots_digest,
    repository_tuple_digest,
)

POSTGRES_D2_SCRIPT: Final = Path(
    "integration/compose/soc-ai-lifecycle-create-mtls/scripts/integrated_uat_stage.py"
)
ALERT_CONTEXT_SCRIPT: Final = Path(
    "integration/compose/soc-ai-fabric-alert-context-mtls/scripts/integrated_uat_stage.py"
)
ENVIRONMENT_INSPECTOR_SCRIPT: Final = Path(
    "integration/compose/integrated-uat/scripts/inspect_environment.py"
)
COMMON_TEARDOWN_SCRIPT: Final = Path(
    "integration/compose/integrated-uat/scripts/common_teardown.py"
)
SANITIZED_ENVIRONMENT: Final[Mapping[str, str]] = MappingProxyType(
    {
        "LANG": "C",
        "LC_ALL": "C",
        "PATH": "/usr/bin:/bin",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONHASHSEED": "0",
        "PYTHONSAFEPATH": "1",
    }
)

_STAGE_TIMEOUT_SECONDS: Final = 600
_INSPECTION_TIMEOUT_SECONDS: Final = 30
_MAX_OUTPUT_BYTES: Final = 64 * 1024
_MAX_SCRIPT_BYTES: Final = 1024 * 1024
_MAX_PINNED_ARTIFACT_BYTES: Final = 64 * 1024 * 1024
_MAX_RECEIPT_BYTES: Final = 64 * 1024
_HEX64: Final = re.compile(r"^[0-9a-f]{64}$")
_PUBLIC_RECEIPT_SCHEMA: Final = "cybrik.integrated-uat.public-stage-receipt/v1"
_ABSENCE_SCHEMA: Final = "cybrik.integrated-uat.absence/v1"
_INSPECTION_SCHEMA: Final = "cybrik.integrated-uat.environment-inspection/v1"
_PUBLIC_RECEIPT_KEYS: Final = frozenset(
    "aggregate_sha256 external_roots_sha256 master_authorization_sha256 "
    "master_marker_sha256 repository_roots_sha256 repository_tuple_sha256 "
    "run_id schema stage status".split()
)
_ABSENCE_KEYS: Final = frozenset(
    "absent aggregate_sha256 authorization_sha256 external_roots_sha256 "
    "marker_sha256 repository_roots_sha256 repository_tuple_sha256 run_id "
    "schema scope".split()
)
_INSPECTION_KEYS: Final = frozenset(
    "absent_ports aggregate_sha256 containers_absent external_roots_sha256 "
    "pki_absent postgres_absent private_artifacts_absent processes_absent "
    "repository_roots_sha256 repository_tuple repository_tuple_sha256 run_id "
    "runtime_artifacts_absent schema".split()
)

Executor = Callable[..., object]


def _fail(reason: str) -> None:
    raise AdapterFailure(reason)


def _default_executor(
    argv: tuple[str, ...], *, check: bool, **kwargs: object
) -> object:
    import subprocess

    return subprocess.run(argv, check=check, **kwargs)


def _exact_directory(path: object, reason: str) -> Path:
    if not isinstance(path, Path) or not path.is_absolute():
        _fail(reason)
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise AdapterFailure(reason) from exc
    if resolved != path or not path.is_dir():
        _fail(reason)
    return path


def _exact_empty_private_directory(path: object, reason: str) -> Path:
    admitted = _exact_directory(path, reason)
    directory = getattr(os, "O_DIRECTORY", 0)
    no_follow = getattr(os, "O_NOFOLLOW", 0)
    close_on_exec = getattr(os, "O_CLOEXEC", 0)
    if not directory or not no_follow or not close_on_exec:
        _fail(reason)
    try:
        descriptor = os.open(
            admitted, os.O_RDONLY | directory | no_follow | close_on_exec
        )
    except OSError as exc:
        raise AdapterFailure(reason) from exc
    try:
        before = os.fstat(descriptor)
        entries = os.listdir(descriptor)
        after = os.fstat(descriptor)
        observed = os.stat(admitted, follow_symlinks=False)
    except OSError as exc:
        raise AdapterFailure(reason) from exc
    finally:
        os.close(descriptor)
    fields = ("st_dev", "st_ino", "st_uid", "st_mode", "st_nlink")
    if (
        not stat.S_ISDIR(before.st_mode)
        or before.st_uid != os.geteuid()
        or stat.S_IMODE(before.st_mode) != 0o700
        or entries
        or any(
            getattr(before, field) != getattr(after, field)
            or getattr(before, field) != getattr(observed, field)
            for field in fields
        )
    ):
        _fail(reason)
    return admitted


def _exact_regular_file(path: object, reason: str) -> tuple[Path, os.stat_result]:
    if not isinstance(path, Path) or not path.is_absolute():
        _fail(reason)
    try:
        resolved = path.resolve(strict=True)
        info = path.stat(follow_symlinks=False)
    except OSError as exc:
        raise AdapterFailure(reason) from exc
    if (
        resolved != path
        or not stat.S_ISREG(info.st_mode)
        or info.st_uid != os.geteuid()
        or info.st_nlink != 1
    ):
        _fail(reason)
    return path, info


def _validate_authorization(
    authorization: object, suite_root: object
) -> tuple[MasterAuthorization, Path]:
    if not isinstance(authorization, MasterAuthorization):
        _fail("adapter_authorization_invalid")
    root = _exact_directory(suite_root, "adapter_suite_root_invalid")
    roots_by_name = {
        item.repository: item.root for item in authorization.repository_roots
    }
    if (
        len(authorization.external_roots) != len(EXPECTED_EXTERNAL_CAPABILITIES)
        or tuple(item.capability for item in authorization.external_roots)
        != EXPECTED_EXTERNAL_CAPABILITIES
        or external_roots_digest(authorization.external_roots)
        != authorization.external_roots_sha256
        or not _HEX64.fullmatch(authorization.external_roots_sha256)
        or len(authorization.repository_roots) != len(EXPECTED_REPOSITORIES)
        or tuple(item.repository for item in authorization.repository_roots)
        != EXPECTED_REPOSITORIES
        or tuple(item.repository for item in authorization.repository_tuple)
        != EXPECTED_REPOSITORIES
        or roots_by_name.get("cybrik-suite") != root
        or repository_roots_digest(authorization.repository_roots)
        != authorization.repository_roots_sha256
        or repository_tuple_digest(authorization.repository_tuple)
        != authorization.repository_tuple_sha256
        or not _HEX64.fullmatch(authorization.aggregate_sha256)
        or not _HEX64.fullmatch(authorization.authorization_sha256)
        or not _HEX64.fullmatch(authorization.repository_roots_sha256)
        or not _HEX64.fullmatch(authorization.repository_tuple_sha256)
    ):
        _fail("adapter_authorization_invalid")
    for repository_root in authorization.repository_roots:
        _exact_directory(repository_root.root, "adapter_authorization_invalid")
    evidence_root = _exact_directory(
        authorization.evidence_root, "adapter_authorization_invalid"
    )
    external_paths: list[Path] = []
    for external_root in authorization.external_roots:
        external_paths.append(
            _exact_empty_private_directory(
                external_root.root, "adapter_authorization_invalid"
            )
        )
    repository_paths = tuple(item.root for item in authorization.repository_roots)
    protected_paths = (*repository_paths, evidence_root)
    if (
        len(set(external_paths)) != len(external_paths)
        or any(
            left.is_relative_to(right) or right.is_relative_to(left)
            for index, left in enumerate(external_paths)
            for right in external_paths[index + 1 :]
        )
        or any(
            external.is_relative_to(protected) or protected.is_relative_to(external)
            for external in external_paths
            for protected in protected_paths
        )
    ):
        _fail("adapter_authorization_invalid")
    return authorization, root


def _validate_python(path: object) -> Path:
    executable, info = _exact_regular_file(path, "adapter_python_invalid")
    mode = stat.S_IMODE(info.st_mode)
    if not mode & 0o111 or mode & 0o022:
        _fail("adapter_python_invalid")
    return executable


def _pinned_file(
    path: object,
    *,
    digest: str | None,
    exact_mode: int | None,
    reason: str,
) -> tuple[Path, str]:
    admitted, info = _exact_regular_file(path, reason)
    if exact_mode is not None and stat.S_IMODE(info.st_mode) != exact_mode:
        _fail(reason)
    payload = _read_bounded(admitted, limit=_MAX_PINNED_ARTIFACT_BYTES, reason=reason)
    observed = hashlib.sha256(payload).hexdigest()
    if digest is not None and (not _HEX64.fullmatch(digest) or observed != digest):
        _fail(reason)
    return admitted, observed


def _script_path(suite_root: Path, relative: Path) -> Path:
    if relative.is_absolute() or ".." in relative.parts:
        _fail("adapter_script_invalid")
    candidate = suite_root / relative
    script, info = _exact_regular_file(candidate, "adapter_script_invalid")
    if (
        info.st_size < 1
        or info.st_size > _MAX_SCRIPT_BYTES
        or stat.S_IMODE(info.st_mode) & 0o022
    ):
        _fail("adapter_script_invalid")
    return script


def _read_bounded(path: Path, *, limit: int, reason: str) -> bytes:
    no_follow = getattr(os, "O_NOFOLLOW", 0)
    close_on_exec = getattr(os, "O_CLOEXEC", 0)
    if not no_follow or not close_on_exec:
        _fail(reason)
    try:
        descriptor = os.open(path, os.O_RDONLY | no_follow | close_on_exec)
    except OSError as exc:
        raise AdapterFailure(reason) from exc
    try:
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_uid != os.geteuid()
            or before.st_nlink != 1
            or before.st_size < 1
            or before.st_size > limit
        ):
            _fail(reason)
        chunks: list[bytes] = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(descriptor, min(4096, remaining))
            if not chunk:
                _fail(reason)
            chunks.append(chunk)
            remaining -= len(chunk)
        if os.read(descriptor, 1):
            _fail(reason)
        after = os.fstat(descriptor)
        observed = os.stat(path, follow_symlinks=False)
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
            or getattr(before, field) != getattr(observed, field)
            for field in fields
        ):
            _fail(reason)
        return b"".join(chunks)
    except OSError as exc:
        raise AdapterFailure(reason) from exc
    finally:
        os.close(descriptor)


def _canonical_document(payload: bytes, *, keys: frozenset[str], reason: str) -> dict:
    if not payload or len(payload) > _MAX_OUTPUT_BYTES:
        _fail(reason)
    try:
        document = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AdapterFailure(reason) from exc
    if (
        not isinstance(document, dict)
        or set(document) != keys
        or canonical_json_bytes(document) != payload
    ):
        _fail(reason)
    return document


def _repository_identity(document: object) -> RepositoryIdentity:
    if (
        not isinstance(document, dict)
        or set(document) != {"clean", "commit", "repository", "tree"}
        or type(document["clean"]) is not bool
        or not all(
            isinstance(document[field], str)
            for field in ("commit", "repository", "tree")
        )
    ):
        _fail("environment_inspection_invalid")
    return RepositoryIdentity(**document)


class _PinnedCommand:
    def __init__(
        self,
        *,
        authorization: MasterAuthorization,
        executor: Executor = _default_executor,
        python_executable: Path,
        relative_script: Path,
        script_sha256: str,
        suite_root: Path,
    ) -> None:
        admitted, admitted_suite = _validate_authorization(authorization, suite_root)
        if not callable(executor) or not isinstance(script_sha256, str):
            _fail("adapter_configuration_invalid")
        if not _HEX64.fullmatch(script_sha256):
            _fail("adapter_configuration_invalid")
        self._authorization = admitted
        self._suite_root = admitted_suite
        self._python = _validate_python(python_executable)
        self._relative_script = relative_script
        self._script = _script_path(admitted_suite, relative_script)
        self._script_sha256 = script_sha256
        self._executor = executor
        self._verify_script(initial=True)

    def _verify_script(self, *, initial: bool = False) -> None:
        reason = "adapter_script_invalid" if initial else "adapter_script_drifted"
        try:
            script = _script_path(self._suite_root, self._relative_script)
            payload = _read_bounded(script, limit=_MAX_SCRIPT_BYTES, reason=reason)
        except AdapterFailure as exc:
            if initial:
                raise
            raise AdapterFailure(reason) from exc
        if (
            script != self._script
            or hashlib.sha256(payload).hexdigest() != self._script_sha256
        ):
            _fail(reason)

    def _context_argv(self, context: OrchestrationContext) -> tuple[str, ...]:
        self._validate_context(context)
        return (
            "--run-id",
            context.run_id,
            "--aggregate-sha256",
            context.aggregate_sha256,
            "--repository-tuple-sha256",
            context.repository_tuple_sha256,
            "--repository-roots-sha256",
            context.repository_roots_sha256,
            "--external-roots-sha256",
            context.external_roots_sha256,
            "--authorization-sha256",
            context.authorization_sha256,
            "--marker-sha256",
            context.marker_sha256,
            "--consumption-marker",
            str(context.consumption_marker),
            "--evidence-root",
            str(context.evidence_root),
        )

    def _repository_argv(self) -> tuple[str, ...]:
        return tuple(
            item
            for root in self._authorization.repository_roots
            for item in ("--repository", f"{root.repository}={root.root}")
        )

    def _repository_identity_argv(self) -> tuple[str, ...]:
        return tuple(
            item
            for identity in self._authorization.repository_tuple
            for item in (
                "--repository-identity",
                f"{identity.repository}={identity.commit}:{identity.tree}",
            )
        )

    def _external_root_argv(self) -> tuple[str, ...]:
        return tuple(
            item
            for root in self._authorization.external_roots
            for item in ("--external-root", f"{root.capability}={root.root}")
        )

    def _validate_context(self, context: object) -> OrchestrationContext:
        authorization = self._authorization
        if (
            not isinstance(context, OrchestrationContext)
            or context.aggregate_sha256 != authorization.aggregate_sha256
            or context.authorization_sha256 != authorization.authorization_sha256
            or context.evidence_root != authorization.evidence_root
            or context.external_roots_sha256 != authorization.external_roots_sha256
            or context.repository_tuple != authorization.repository_tuple
            or context.repository_tuple_sha256 != authorization.repository_tuple_sha256
            or context.repository_roots_sha256 != authorization.repository_roots_sha256
            or context.run_id != authorization.run_id
            or not _HEX64.fullmatch(context.marker_sha256)
            or context.consumption_marker.parent != authorization.evidence_root
        ):
            _fail("orchestration_context_mismatch")
        marker, info = _exact_regular_file(
            context.consumption_marker, "orchestration_context_mismatch"
        )
        if stat.S_IMODE(info.st_mode) != 0o600:
            _fail("orchestration_context_mismatch")
        payload = _read_bounded(
            marker,
            limit=_MAX_RECEIPT_BYTES,
            reason="orchestration_context_mismatch",
        )
        if hashlib.sha256(payload).hexdigest() != context.marker_sha256:
            _fail("orchestration_context_mismatch")
        return context

    def _execute(
        self,
        argv: tuple[str, ...],
        *,
        reason: str,
        timeout: int,
    ) -> bytes:
        import subprocess

        self._verify_script()
        exact_argv = (str(self._python), "-B", "-P", str(self._script), *argv)
        try:
            result = self._executor(
                exact_argv,
                cwd=str(self._suite_root),
                env=dict(SANITIZED_ENVIRONMENT),
                shell=False,
                check=False,
                capture_output=True,
                timeout=timeout,
                stdin=subprocess.DEVNULL,
            )
        except Exception as exc:
            raise AdapterFailure(reason) from exc
        returncode = getattr(result, "returncode", None)
        stdout = getattr(result, "stdout", None)
        stderr = getattr(result, "stderr", None)
        if (
            isinstance(returncode, bool)
            or not isinstance(returncode, int)
            or returncode != 0
            or not isinstance(stdout, bytes)
            or not isinstance(stderr, bytes)
            or len(stdout) > _MAX_OUTPUT_BYTES
            or len(stderr) > _MAX_OUTPUT_BYTES
        ):
            _fail(reason)
        return stdout


class _SubprocessStage(_PinnedCommand):
    stage: str

    def __init__(self, *, extra_argv: tuple[str, ...] = (), **kwargs: object) -> None:
        self._extra_argv = extra_argv
        super().__init__(**kwargs)

    def _stage_argv(
        self, action: str, context: OrchestrationContext
    ) -> tuple[str, ...]:
        return (
            action,
            *self._context_argv(context),
            *self._repository_argv(),
            *self._repository_identity_argv(),
            *self._external_root_argv(),
            *self._extra_argv,
        )

    def run(self, context: OrchestrationContext) -> StageReceipt:
        admitted = self._validate_context(context)
        payload = self._execute(
            self._stage_argv("run", admitted),
            reason=f"{self.stage}_command_failed",
            timeout=_STAGE_TIMEOUT_SECONDS,
        )
        document = _canonical_document(
            payload, keys=_PUBLIC_RECEIPT_KEYS, reason="stage_receipt_invalid"
        )
        if (
            document["schema"] != _PUBLIC_RECEIPT_SCHEMA
            or document["stage"] != self.stage
            or document["status"] != "passed"
            or document["run_id"] != admitted.run_id
            or document["master_authorization_sha256"] != admitted.authorization_sha256
            or document["master_marker_sha256"] != admitted.marker_sha256
            or document["aggregate_sha256"] != admitted.aggregate_sha256
            or document["external_roots_sha256"] != admitted.external_roots_sha256
            or document["repository_roots_sha256"] != admitted.repository_roots_sha256
            or document["repository_tuple_sha256"] != admitted.repository_tuple_sha256
        ):
            _fail("stage_receipt_binding_invalid")
        return StageReceipt(
            aggregate_sha256=admitted.aggregate_sha256,
            receipt_sha256=hashlib.sha256(payload).hexdigest(),
            repository_tuple_sha256=admitted.repository_tuple_sha256,
            stage=self.stage,
        )

    def teardown(self, context: OrchestrationContext) -> None:
        admitted = self._validate_context(context)
        output = self._execute(
            self._stage_argv("teardown", admitted),
            reason=f"{self.stage}_teardown_failed",
            timeout=_STAGE_TIMEOUT_SECONDS,
        )
        if output:
            _fail(f"{self.stage}_teardown_failed")

    def verify_absent(self, context: OrchestrationContext) -> None:
        admitted = self._validate_context(context)
        output = self._execute(
            self._stage_argv("verify-absent", admitted),
            reason=f"{self.stage}_absence_check_failed",
            timeout=_INSPECTION_TIMEOUT_SECONDS,
        )
        _verify_absence(output, admitted, scope=self.stage)


class PostgresD2Stage(_SubprocessStage):
    stage = "postgres_d2"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(relative_script=POSTGRES_D2_SCRIPT, **kwargs)


class AlertContextStage(_SubprocessStage):
    stage = "alert_context"

    def __init__(
        self,
        *,
        b1_wheel: Path,
        b1_wheel_sha256: str,
        python_sha256: str,
        **kwargs: object,
    ) -> None:
        wheel, _ = _pinned_file(
            b1_wheel,
            digest=b1_wheel_sha256,
            exact_mode=0o600,
            reason="adapter_b1_wheel_invalid",
        )
        python = _validate_python(kwargs.get("python_executable"))
        _, observed_python_sha256 = _pinned_file(
            python,
            digest=python_sha256,
            exact_mode=None,
            reason="adapter_python_invalid",
        )
        super().__init__(
            relative_script=ALERT_CONTEXT_SCRIPT,
            extra_argv=(
                "--b1-wheel",
                str(wheel),
                "--pinned-python-sha256",
                observed_python_sha256,
            ),
            **kwargs,
        )


def _verify_absence(
    payload: bytes, context: OrchestrationContext, *, scope: str
) -> None:
    document = _canonical_document(
        payload, keys=_ABSENCE_KEYS, reason=f"{scope}_absence_check_failed"
    )
    if (
        document["schema"] != _ABSENCE_SCHEMA
        or document["scope"] != scope
        or document["absent"] is not True
        or document["run_id"] != context.run_id
        or document["authorization_sha256"] != context.authorization_sha256
        or document["marker_sha256"] != context.marker_sha256
        or document["aggregate_sha256"] != context.aggregate_sha256
        or document["external_roots_sha256"] != context.external_roots_sha256
        or document["repository_roots_sha256"] != context.repository_roots_sha256
        or document["repository_tuple_sha256"] != context.repository_tuple_sha256
    ):
        _fail(f"{scope}_absence_check_failed")


class CommonTeardown(_PinnedCommand):
    def __init__(self, **kwargs: object) -> None:
        super().__init__(relative_script=COMMON_TEARDOWN_SCRIPT, **kwargs)

    def teardown(self, context: OrchestrationContext) -> None:
        admitted = self._validate_context(context)
        output = self._execute(
            (
                "teardown",
                *self._context_argv(admitted),
                *self._repository_argv(),
                *self._external_root_argv(),
            ),
            reason="common_teardown_failed",
            timeout=_STAGE_TIMEOUT_SECONDS,
        )
        if output:
            _fail("common_teardown_failed")

    def verify_absent(self, context: OrchestrationContext) -> None:
        admitted = self._validate_context(context)
        output = self._execute(
            (
                "verify-absent",
                *self._context_argv(admitted),
                *self._repository_argv(),
                *self._external_root_argv(),
            ),
            reason="common_absence_check_failed",
            timeout=_INSPECTION_TIMEOUT_SECONDS,
        )
        _verify_absence(output, admitted, scope="common")


class EnvironmentInspector(_PinnedCommand):
    def __init__(self, **kwargs: object) -> None:
        super().__init__(relative_script=ENVIRONMENT_INSPECTOR_SCRIPT, **kwargs)

    def inspect(self) -> EnvironmentSnapshot:
        authorization = self._authorization
        output = self._execute(
            (
                "inspect",
                "--run-id",
                authorization.run_id,
                "--aggregate-sha256",
                authorization.aggregate_sha256,
                "--repository-tuple-sha256",
                authorization.repository_tuple_sha256,
                "--repository-roots-sha256",
                authorization.repository_roots_sha256,
                "--external-roots-sha256",
                authorization.external_roots_sha256,
                *tuple(
                    item
                    for port in EXPECTED_PORTS
                    for item in ("--absent-port", str(port))
                ),
                *self._repository_argv(),
                *self._external_root_argv(),
            ),
            reason="environment_inspection_failed",
            timeout=_INSPECTION_TIMEOUT_SECONDS,
        )
        document = _canonical_document(
            output, keys=_INSPECTION_KEYS, reason="environment_inspection_invalid"
        )
        try:
            raw_repositories = document["repository_tuple"]
            if not isinstance(raw_repositories, list):
                _fail("environment_inspection_invalid")
            observed_repositories = tuple(
                _repository_identity(item) for item in raw_repositories
            )
            absent_ports = tuple(document["absent_ports"])
        except (KeyError, TypeError, ValueError) as exc:
            raise AdapterFailure("environment_inspection_invalid") from exc
        required_true = (
            document["containers_absent"],
            document["pki_absent"],
            document["postgres_absent"],
            document["private_artifacts_absent"],
            document["processes_absent"],
            document["runtime_artifacts_absent"],
        )
        if (
            document["schema"] != _INSPECTION_SCHEMA
            or document["run_id"] != authorization.run_id
            or document["aggregate_sha256"] != authorization.aggregate_sha256
            or document["external_roots_sha256"] != authorization.external_roots_sha256
            or document["repository_tuple_sha256"]
            != authorization.repository_tuple_sha256
            or document["repository_roots_sha256"]
            != authorization.repository_roots_sha256
            or observed_repositories != authorization.repository_tuple
            or repository_tuple_digest(observed_repositories)
            != authorization.repository_tuple_sha256
            or absent_ports != EXPECTED_PORTS
            or not all(value is True for value in required_true)
        ):
            _fail("environment_inspection_invalid")
        return EnvironmentSnapshot(
            absent_ports=absent_ports,
            aggregate_sha256=authorization.aggregate_sha256,
            external_roots_sha256=authorization.external_roots_sha256,
            pki_absent=True,
            postgres_absent=True,
            private_artifacts_absent=True,
            processes_absent=True,
            repository_roots_sha256=authorization.repository_roots_sha256,
            repository_tuple=observed_repositories,
            repository_tuple_sha256=authorization.repository_tuple_sha256,
            runtime_artifacts_absent=True,
        )


__all__ = [
    "ALERT_CONTEXT_SCRIPT",
    "COMMON_TEARDOWN_SCRIPT",
    "ENVIRONMENT_INSPECTOR_SCRIPT",
    "POSTGRES_D2_SCRIPT",
    "SANITIZED_ENVIRONMENT",
    "AdapterFailure",
    "AlertContextStage",
    "CommonTeardown",
    "CompositeCommonTeardown",
    "EnvironmentInspector",
    "PostgresD2Stage",
]
