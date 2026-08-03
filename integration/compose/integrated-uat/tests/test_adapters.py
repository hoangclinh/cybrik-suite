from __future__ import annotations

import hashlib
import subprocess
import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from cybrik_suite_integrated_uat.adapters import (
    ALERT_CONTEXT_SCRIPT,
    COMMON_TEARDOWN_SCRIPT,
    ENVIRONMENT_INSPECTOR_SCRIPT,
    POSTGRES_D2_SCRIPT,
    SANITIZED_ENVIRONMENT,
    AdapterFailure,
    AlertContextStage,
    CommonTeardown,
    CompositeCommonTeardown,
    EnvironmentInspector,
    PostgresD2Stage,
)
from cybrik_suite_integrated_uat.cleanup import (
    CompositeCommonTeardown as SplitCompositeCommonTeardown,
)
from cybrik_suite_integrated_uat.models import (
    EXPECTED_EXTERNAL_CAPABILITIES,
    EXPECTED_PORTS,
    EXPECTED_REPOSITORIES,
    ExternalRootBinding,
    MasterAuthorization,
    OrchestrationContext,
    RepositoryIdentity,
    RepositoryRoot,
    canonical_json_bytes,
    external_roots_digest,
    repository_roots_digest,
    repository_tuple_digest,
)

_AGGREGATE = "a" * 64
_AUTHORIZATION = "b" * 64
_GRANT = "c" * 64


def test_adapters_reexports_split_composite_cleanup() -> None:
    assert CompositeCommonTeardown is SplitCompositeCommonTeardown


def _authorization(tmp_path: Path) -> MasterAuthorization:
    suite = tmp_path / "cybrik-suite"
    root_paths = tuple(tmp_path / name for name in EXPECTED_REPOSITORIES[:-1]) + (
        suite,
    )
    for root in root_paths:
        root.mkdir()
    roots = tuple(
        RepositoryRoot(repository=name, root=root)
        for name, root in zip(EXPECTED_REPOSITORIES, root_paths)
    )
    evidence = tmp_path / "evidence"
    evidence.mkdir(mode=0o700)
    external_roots = tuple(
        ExternalRootBinding(capability=capability, root=tmp_path / capability)
        for capability in EXPECTED_EXTERNAL_CAPABILITIES
    )
    for binding in external_roots:
        binding.root.mkdir(mode=0o700)
    identities = tuple(
        RepositoryIdentity(
            repository=name,
            commit=f"{index + 1:x}" * 40,
            tree=f"{index + 5:x}" * 40,
            clean=True,
        )
        for index, name in enumerate(EXPECTED_REPOSITORIES)
    )
    return MasterAuthorization(
        aggregate_sha256=_AGGREGATE,
        authorization_sha256=_AUTHORIZATION,
        evidence_root=evidence,
        exact_head_grant_sha256=_GRANT,
        external_roots=external_roots,
        external_roots_sha256=external_roots_digest(external_roots),
        repository_roots=roots,
        repository_roots_sha256=repository_roots_digest(roots),
        repository_tuple=identities,
        repository_tuple_sha256=repository_tuple_digest(identities),
        run_id="integrated-uat-adapter-0001",
    )


def _context(auth: MasterAuthorization) -> OrchestrationContext:
    marker = auth.evidence_root / "master-authorization-consumed.json"
    marker.write_bytes(b"consumed\n")
    marker.chmod(0o600)
    return OrchestrationContext(
        aggregate_sha256=auth.aggregate_sha256,
        authorization_sha256=auth.authorization_sha256,
        consumption_marker=marker,
        evidence_root=auth.evidence_root,
        external_roots_sha256=auth.external_roots_sha256,
        marker_sha256=hashlib.sha256(b"consumed\n").hexdigest(),
        repository_tuple=auth.repository_tuple,
        repository_tuple_sha256=auth.repository_tuple_sha256,
        repository_roots_sha256=auth.repository_roots_sha256,
        run_id=auth.run_id,
    )


def _suite_root(auth: MasterAuthorization) -> Path:
    return next(
        root.root for root in auth.repository_roots if root.repository == "cybrik-suite"
    )


def _install_script(suite: Path, relative: Path) -> tuple[Path, str]:
    script = suite / relative
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_bytes(b"# inert child seam fixture\n")
    script.chmod(0o644)
    return script, hashlib.sha256(script.read_bytes()).hexdigest()


def _b1_wheel(tmp_path: Path) -> tuple[Path, str]:
    wheel = tmp_path / "b1.whl"
    wheel.write_bytes(b"pinned wheel fixture")
    wheel.chmod(0o600)
    return wheel, hashlib.sha256(wheel.read_bytes()).hexdigest()


def _master_artifacts(tmp_path: Path) -> dict[str, object]:
    artifacts = {
        "authorization_file": tmp_path / "master-authorization.json",
        "authorization_signature": tmp_path / "master-authorization.sig",
        "allowed_signers_file": tmp_path / "allowed-signers",
    }
    for name, path in artifacts.items():
        path.write_bytes(name.encode())
        path.chmod(0o600)
    wheel, wheel_sha256 = _b1_wheel(tmp_path)
    return {
        **artifacts,
        "b1_wheel": wheel,
        "b1_wheel_sha256": wheel_sha256,
    }


def _parse_real_alert_argv(argv: tuple[str, ...]) -> None:
    source = Path(__file__).parents[4] / ALERT_CONTEXT_SCRIPT.parents[1] / "src"
    sys.path.insert(0, str(source))
    try:
        from cybrik_suite_uat_fabric import integrated_stage

        integrated_stage._command_inputs(integrated_stage._arguments(argv[4:]))
    finally:
        sys.path.pop(0)


class _Executor:
    def __init__(self, effect: Any | None = None) -> None:
        self.calls: list[dict[str, object]] = []
        self.effect = effect

    def __call__(self, argv: tuple[str, ...], **kwargs: object) -> object:
        self.calls.append({"argv": argv, **kwargs})
        if self.effect is not None:
            return self.effect(argv, kwargs)
        return SimpleNamespace(returncode=0, stdout=b"", stderr=b"")


def _public_receipt(
    auth: MasterAuthorization,
    context: OrchestrationContext,
    stage: str,
    *,
    status: str = "passed",
) -> bytes:
    return canonical_json_bytes(
        {
            "aggregate_sha256": auth.aggregate_sha256,
            "external_roots_sha256": auth.external_roots_sha256,
            "master_authorization_sha256": auth.authorization_sha256,
            "master_marker_sha256": context.marker_sha256,
            "repository_roots_sha256": auth.repository_roots_sha256,
            "repository_tuple_sha256": auth.repository_tuple_sha256,
            "run_id": auth.run_id,
            "schema": "cybrik.integrated-uat.public-stage-receipt/v1",
            "stage": stage,
            "status": status,
        }
    )


@pytest.mark.parametrize(
    ("adapter_type", "relative_script", "stage"),
    (
        (PostgresD2Stage, POSTGRES_D2_SCRIPT, "postgres_d2"),
        (AlertContextStage, ALERT_CONTEXT_SCRIPT, "alert_context"),
    ),
)
def test_stage_uses_one_exact_sanitized_command_and_verifies_public_receipt(
    tmp_path: Path,
    adapter_type: type[object],
    relative_script: Path,
    stage: str,
) -> None:
    auth = _authorization(tmp_path)
    context = _context(auth)
    suite_root = _suite_root(auth)
    script, digest = _install_script(suite_root, relative_script)

    def effect(_argv: tuple[str, ...], _kwargs: object) -> object:
        if stage == "alert_context":
            _parse_real_alert_argv(_argv)
        return SimpleNamespace(
            returncode=0,
            stdout=_public_receipt(auth, context, stage),
            stderr=b"",
        )

    executor = _Executor(effect)
    kwargs: dict[str, object] = {}
    stage_extra: tuple[str, ...] = ()
    if adapter_type is AlertContextStage:
        wheel, wheel_digest = _b1_wheel(tmp_path)
        python_digest = hashlib.sha256(
            Path(sys.executable).resolve().read_bytes()
        ).hexdigest()
        kwargs = {
            "b1_wheel": wheel,
            "b1_wheel_sha256": wheel_digest,
            "python_sha256": python_digest,
        }
        stage_extra = (
            "--b1-wheel",
            str(wheel),
            "--pinned-python-sha256",
            python_digest,
        )
    else:
        kwargs = _master_artifacts(tmp_path)
        stage_extra = (
            "--master-authorization-file",
            str(kwargs["authorization_file"]),
            "--master-authorization-signature",
            str(kwargs["authorization_signature"]),
            "--master-allowed-signers",
            str(kwargs["allowed_signers_file"]),
            "--b1-wheel",
            str(kwargs["b1_wheel"]),
            "--b1-wheel-sha256",
            str(kwargs["b1_wheel_sha256"]),
        )
    adapter = adapter_type(
        authorization=auth,
        executor=executor,
        python_executable=Path(sys.executable).resolve(),
        script_sha256=digest,
        suite_root=suite_root,
        **kwargs,
    )

    receipt = adapter.run(context)

    assert receipt.stage == stage
    assert receipt.aggregate_sha256 == auth.aggregate_sha256
    assert receipt.repository_tuple_sha256 == auth.repository_tuple_sha256
    assert (
        receipt.receipt_sha256
        == hashlib.sha256(_public_receipt(auth, context, stage)).hexdigest()
    )
    assert len(executor.calls) == 1
    call = executor.calls[0]
    assert call["argv"] == (
        str(Path(sys.executable).resolve()),
        "-B",
        "-P",
        str(script),
        "run",
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
        *tuple(
            item
            for root in auth.repository_roots
            for item in ("--repository", f"{root.repository}={root.root}")
        ),
        *tuple(
            item
            for identity in auth.repository_tuple
            for item in (
                "--repository-identity",
                f"{identity.repository}={identity.commit}:{identity.tree}",
            )
        ),
        *tuple(
            item
            for root in auth.external_roots
            for item in ("--external-root", f"{root.capability}={root.root}")
        ),
        *stage_extra,
    )
    assert call["cwd"] == str(suite_root)
    assert call["env"] == dict(SANITIZED_ENVIRONMENT)
    assert call["shell"] is False
    assert call["check"] is False
    assert call["capture_output"] is True
    assert call["timeout"] == 600
    assert call["stdin"] == subprocess.DEVNULL


@pytest.mark.parametrize(
    ("mutate", "reason"),
    (
        (
            lambda _, d: {**d, "aggregate_sha256": "f" * 64},
            "stage_receipt_binding_invalid",
        ),
        (
            lambda _, d: {**d, "repository_tuple_sha256": "f" * 64},
            "stage_receipt_binding_invalid",
        ),
        (lambda _, d: {**d, "stage": "alert_context"}, "stage_receipt_binding_invalid"),
        (
            lambda _, d: {**d, "master_authorization_sha256": "f" * 64},
            "stage_receipt_binding_invalid",
        ),
        (
            lambda _, d: {**d, "master_marker_sha256": "f" * 64},
            "stage_receipt_binding_invalid",
        ),
        (
            lambda _, d: {**d, "repository_roots_sha256": "f" * 64},
            "stage_receipt_binding_invalid",
        ),
        (
            lambda _, d: {**d, "external_roots_sha256": "f" * 64},
            "stage_receipt_binding_invalid",
        ),
        (lambda _, d: {**d, "run_id": "wrong-run"}, "stage_receipt_binding_invalid"),
        (
            lambda _, d: {**d, "private_key": "not-public"},
            "stage_receipt_invalid",
        ),
    ),
)
def test_stage_rejects_unbound_or_non_public_receipt(
    tmp_path: Path, mutate: Any, reason: str
) -> None:
    auth = _authorization(tmp_path)
    context = _context(auth)
    suite_root = _suite_root(auth)
    _, digest = _install_script(suite_root, POSTGRES_D2_SCRIPT)

    def effect(_argv: tuple[str, ...], _kwargs: object) -> object:
        document = {
            "aggregate_sha256": auth.aggregate_sha256,
            "external_roots_sha256": auth.external_roots_sha256,
            "master_authorization_sha256": auth.authorization_sha256,
            "master_marker_sha256": context.marker_sha256,
            "repository_roots_sha256": auth.repository_roots_sha256,
            "repository_tuple_sha256": auth.repository_tuple_sha256,
            "run_id": auth.run_id,
            "schema": "cybrik.integrated-uat.public-stage-receipt/v1",
            "stage": "postgres_d2",
            "status": "passed",
        }
        return SimpleNamespace(
            returncode=0,
            stdout=canonical_json_bytes(mutate(auth, document)),
            stderr=b"",
        )

    adapter = PostgresD2Stage(
        **_master_artifacts(tmp_path),
        authorization=auth,
        executor=_Executor(effect),
        python_executable=Path(sys.executable).resolve(),
        script_sha256=digest,
        suite_root=suite_root,
    )

    with pytest.raises(AdapterFailure, match=f"^{reason}$"):
        adapter.run(context)


def test_failed_stage_process_is_not_retried_and_cleanup_remains_callable(
    tmp_path: Path,
) -> None:
    auth = _authorization(tmp_path)
    context = _context(auth)
    suite_root = _suite_root(auth)
    _, digest = _install_script(suite_root, ALERT_CONTEXT_SCRIPT)
    wheel, wheel_digest = _b1_wheel(tmp_path)
    outcomes = [
        SimpleNamespace(returncode=7, stdout=b"", stderr=b"child detail"),
        SimpleNamespace(returncode=0, stdout=b"", stderr=b""),
        SimpleNamespace(
            returncode=0,
            stdout=canonical_json_bytes(
                {
                    "absent": True,
                    "aggregate_sha256": auth.aggregate_sha256,
                    "authorization_sha256": auth.authorization_sha256,
                    "external_roots_sha256": auth.external_roots_sha256,
                    "marker_sha256": context.marker_sha256,
                    "repository_roots_sha256": auth.repository_roots_sha256,
                    "repository_tuple_sha256": auth.repository_tuple_sha256,
                    "run_id": auth.run_id,
                    "schema": "cybrik.integrated-uat.absence/v1",
                    "scope": "alert_context",
                }
            ),
            stderr=b"",
        ),
    ]
    executor = _Executor(lambda _argv, _kwargs: outcomes.pop(0))
    adapter = AlertContextStage(
        authorization=auth,
        b1_wheel=wheel,
        b1_wheel_sha256=wheel_digest,
        executor=executor,
        python_executable=Path(sys.executable).resolve(),
        python_sha256=hashlib.sha256(
            Path(sys.executable).resolve().read_bytes()
        ).hexdigest(),
        script_sha256=digest,
        suite_root=suite_root,
    )

    with pytest.raises(AdapterFailure, match="^alert_context_command_failed$"):
        adapter.run(context)
    adapter.teardown(context)
    adapter.verify_absent(context)

    assert [call["argv"][4] for call in executor.calls] == [
        "run",
        "teardown",
        "verify-absent",
    ]


def _inspection_document(
    auth: MasterAuthorization, **overrides: object
) -> dict[str, object]:
    document: dict[str, object] = {
        "absent_ports": list(EXPECTED_PORTS),
        "aggregate_sha256": auth.aggregate_sha256,
        "containers_absent": True,
        "external_roots_sha256": auth.external_roots_sha256,
        "pki_absent": True,
        "postgres_absent": True,
        "private_artifacts_absent": True,
        "processes_absent": True,
        "repository_roots_sha256": auth.repository_roots_sha256,
        "repository_tuple": [item.to_dict() for item in auth.repository_tuple],
        "repository_tuple_sha256": auth.repository_tuple_sha256,
        "run_id": auth.run_id,
        "runtime_artifacts_absent": True,
        "schema": "cybrik.integrated-uat.environment-inspection/v1",
    }
    document.update(overrides)
    return document


def test_environment_inspector_requires_exact_git_aggregate_port_process_container_and_artifact_proof(
    tmp_path: Path,
) -> None:
    auth = _authorization(tmp_path)
    suite_root = _suite_root(auth)
    script, digest = _install_script(suite_root, ENVIRONMENT_INSPECTOR_SCRIPT)
    executor = _Executor(
        lambda _argv, _kwargs: SimpleNamespace(
            returncode=0,
            stdout=canonical_json_bytes(_inspection_document(auth)),
            stderr=b"",
        )
    )
    inspector = EnvironmentInspector(
        authorization=auth,
        executor=executor,
        python_executable=Path(sys.executable).resolve(),
        script_sha256=digest,
        suite_root=suite_root,
    )

    snapshot = inspector.inspect()

    assert snapshot.repository_tuple == auth.repository_tuple
    assert snapshot.aggregate_sha256 == auth.aggregate_sha256
    assert snapshot.external_roots_sha256 == auth.external_roots_sha256
    assert snapshot.absent_ports == EXPECTED_PORTS
    assert snapshot.postgres_absent
    assert snapshot.processes_absent
    assert snapshot.private_artifacts_absent
    assert snapshot.runtime_artifacts_absent
    assert snapshot.pki_absent
    call = executor.calls[0]
    assert call["argv"] == (
        str(Path(sys.executable).resolve()),
        "-B",
        "-P",
        str(script),
        "inspect",
        "--run-id",
        auth.run_id,
        "--aggregate-sha256",
        auth.aggregate_sha256,
        "--repository-tuple-sha256",
        auth.repository_tuple_sha256,
        "--repository-roots-sha256",
        auth.repository_roots_sha256,
        "--external-roots-sha256",
        auth.external_roots_sha256,
        *tuple(
            item for port in EXPECTED_PORTS for item in ("--absent-port", str(port))
        ),
        *tuple(
            item
            for root in auth.repository_roots
            for item in ("--repository", f"{root.repository}={root.root}")
        ),
        *tuple(
            item
            for root in auth.external_roots
            for item in ("--external-root", f"{root.capability}={root.root}")
        ),
    )
    assert call["timeout"] == 30


@pytest.mark.parametrize(
    "overrides",
    (
        {"containers_absent": False},
        {"processes_absent": False},
        {"absent_ports": list(EXPECTED_PORTS[:-1])},
        {"private_artifacts_absent": False},
        {"runtime_artifacts_absent": False},
        {"pki_absent": False},
        {"postgres_absent": False},
        {"aggregate_sha256": "f" * 64},
        {"repository_tuple": []},
    ),
)
def test_environment_inspector_fails_closed_on_each_missing_proof(
    tmp_path: Path, overrides: dict[str, object]
) -> None:
    auth = _authorization(tmp_path)
    suite_root = _suite_root(auth)
    _, digest = _install_script(suite_root, ENVIRONMENT_INSPECTOR_SCRIPT)
    inspector = EnvironmentInspector(
        authorization=auth,
        executor=_Executor(
            lambda _argv, _kwargs: SimpleNamespace(
                returncode=0,
                stdout=canonical_json_bytes(_inspection_document(auth, **overrides)),
                stderr=b"",
            )
        ),
        python_executable=Path(sys.executable).resolve(),
        script_sha256=digest,
        suite_root=suite_root,
    )

    with pytest.raises(AdapterFailure, match="^environment_inspection_invalid$"):
        inspector.inspect()


def test_common_teardown_uses_fixed_scope_and_authenticated_absence_report(
    tmp_path: Path,
) -> None:
    auth = _authorization(tmp_path)
    context = _context(auth)
    suite_root = _suite_root(auth)
    _, digest = _install_script(suite_root, COMMON_TEARDOWN_SCRIPT)
    outcomes = [
        SimpleNamespace(returncode=0, stdout=b"", stderr=b""),
        SimpleNamespace(
            returncode=0,
            stdout=canonical_json_bytes(
                {
                    "absent": True,
                    "aggregate_sha256": auth.aggregate_sha256,
                    "authorization_sha256": auth.authorization_sha256,
                    "external_roots_sha256": auth.external_roots_sha256,
                    "marker_sha256": context.marker_sha256,
                    "repository_roots_sha256": auth.repository_roots_sha256,
                    "repository_tuple_sha256": auth.repository_tuple_sha256,
                    "run_id": auth.run_id,
                    "schema": "cybrik.integrated-uat.absence/v1",
                    "scope": "common",
                }
            ),
            stderr=b"",
        ),
    ]
    executor = _Executor(lambda _argv, _kwargs: outcomes.pop(0))
    adapter = CommonTeardown(
        authorization=auth,
        executor=executor,
        python_executable=Path(sys.executable).resolve(),
        script_sha256=digest,
        suite_root=suite_root,
    )

    adapter.teardown(context)
    adapter.verify_absent(context)

    assert [call["argv"][4] for call in executor.calls] == [
        "teardown",
        "verify-absent",
    ]


def test_adapter_rejects_context_or_script_drift_before_subprocess(
    tmp_path: Path,
) -> None:
    auth = _authorization(tmp_path)
    context = _context(auth)
    suite_root = _suite_root(auth)
    script, digest = _install_script(suite_root, POSTGRES_D2_SCRIPT)
    executor = _Executor()
    adapter = PostgresD2Stage(
        **_master_artifacts(tmp_path),
        authorization=auth,
        executor=executor,
        python_executable=Path(sys.executable).resolve(),
        script_sha256=digest,
        suite_root=suite_root,
    )
    script.write_bytes(b"drifted\n")

    with pytest.raises(AdapterFailure, match="^adapter_script_drifted$"):
        adapter.run(context)
    with pytest.raises(AdapterFailure, match="^orchestration_context_mismatch$"):
        adapter.run(replace(context, aggregate_sha256="f" * 64))

    assert executor.calls == []


def test_adapter_maps_timeout_without_retry_or_child_detail(tmp_path: Path) -> None:
    auth = _authorization(tmp_path)
    context = _context(auth)
    suite_root = _suite_root(auth)
    _, digest = _install_script(suite_root, COMMON_TEARDOWN_SCRIPT)

    def timeout(_argv: tuple[str, ...], _kwargs: object) -> object:
        raise subprocess.TimeoutExpired(cmd="redacted", timeout=600)

    executor = _Executor(timeout)
    adapter = CommonTeardown(
        authorization=auth,
        executor=executor,
        python_executable=Path(sys.executable).resolve(),
        script_sha256=digest,
        suite_root=suite_root,
    )

    with pytest.raises(AdapterFailure, match="^common_teardown_failed$"):
        adapter.teardown(context)

    assert len(executor.calls) == 1


def test_stage_rejects_malformed_or_noncanonical_stdout(tmp_path: Path) -> None:
    auth = _authorization(tmp_path)
    context = _context(auth)
    suite_root = _suite_root(auth)
    _, digest = _install_script(suite_root, POSTGRES_D2_SCRIPT)
    adapter = PostgresD2Stage(
        **_master_artifacts(tmp_path),
        authorization=auth,
        executor=_Executor(
            lambda _argv, _kwargs: SimpleNamespace(
                returncode=0, stdout=b'{"schema":"wrong"}\n', stderr=b""
            )
        ),
        python_executable=Path(sys.executable).resolve(),
        script_sha256=digest,
        suite_root=suite_root,
    )

    with pytest.raises(AdapterFailure, match="^stage_receipt_invalid$"):
        adapter.run(context)


def test_constructor_rejects_wrong_script_digest(
    tmp_path: Path,
) -> None:
    auth = _authorization(tmp_path)
    suite_root = _suite_root(auth)
    _install_script(suite_root, ALERT_CONTEXT_SCRIPT)
    wheel, wheel_digest = _b1_wheel(tmp_path)

    with pytest.raises(AdapterFailure, match="^adapter_script_invalid$"):
        AlertContextStage(
            authorization=auth,
            b1_wheel=wheel,
            b1_wheel_sha256=wheel_digest,
            executor=_Executor(),
            python_executable=Path(sys.executable).resolve(),
            python_sha256=hashlib.sha256(
                Path(sys.executable).resolve().read_bytes()
            ).hexdigest(),
            script_sha256="f" * 64,
            suite_root=suite_root,
        )


def test_alert_constructor_rejects_replaced_python_and_other_invalid_pins(
    tmp_path: Path,
) -> None:
    auth = _authorization(tmp_path)
    suite_root = _suite_root(auth)
    _, script_digest = _install_script(suite_root, ALERT_CONTEXT_SCRIPT)
    wheel, wheel_digest = _b1_wheel(tmp_path)
    python = tmp_path / "signed-python"
    python.write_bytes(b"admitted-python")
    python.chmod(0o700)
    admitted_sha256 = hashlib.sha256(python.read_bytes()).hexdigest()
    python.write_bytes(b"replacement-python")

    with pytest.raises(AdapterFailure, match="^adapter_python_invalid$"):
        AlertContextStage(
            authorization=auth,
            b1_wheel=wheel,
            b1_wheel_sha256=wheel_digest,
            executor=_Executor(),
            python_executable=python.resolve(),
            python_sha256=admitted_sha256,
            script_sha256=script_digest,
            suite_root=suite_root,
        )

    wheel.chmod(0o644)
    with pytest.raises(AdapterFailure, match="^adapter_b1_wheel_invalid$"):
        AlertContextStage(
            authorization=auth,
            b1_wheel=wheel,
            b1_wheel_sha256=wheel_digest,
            executor=_Executor(),
            python_executable=Path(sys.executable).resolve(),
            python_sha256=hashlib.sha256(
                Path(sys.executable).resolve().read_bytes()
            ).hexdigest(),
            script_sha256=script_digest,
            suite_root=suite_root,
        )
    wheel.chmod(0o600)
    writable_python = tmp_path / "python"
    writable_python.write_bytes(b"inert")
    writable_python.chmod(0o777)
    with pytest.raises(AdapterFailure, match="^adapter_python_invalid$"):
        AlertContextStage(
            authorization=auth,
            b1_wheel=wheel,
            b1_wheel_sha256=wheel_digest,
            executor=_Executor(),
            python_executable=writable_python,
            python_sha256=hashlib.sha256(writable_python.read_bytes()).hexdigest(),
            script_sha256="f" * 64,
            suite_root=suite_root,
        )
