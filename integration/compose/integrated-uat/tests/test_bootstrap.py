from __future__ import annotations

import io
from pathlib import Path
from types import SimpleNamespace

from cybrik_suite_integrated_uat.bootstrap import (
    BootstrapDependencies,
    bootstrap_once,
    build_dependencies_from_environment,
    main,
)


def test_concrete_builder_passes_alert_runtime_pins_and_uses_composite(
    monkeypatch,
) -> None:
    from cybrik_suite_integrated_uat import adapters, orchestrator
    from cybrik_suite_integrated_uat.admission import HELPER_SCRIPTS

    records: dict[str, object] = {}

    def constructor(name: str):
        def build(**kwargs: object) -> object:
            value = SimpleNamespace(name=name)
            records[name] = (kwargs, value)
            return value

        return build

    def composite(**kwargs: object) -> object:
        records["composite"] = kwargs
        return SimpleNamespace(name="composite")

    def master(**kwargs: object) -> object:
        records["master"] = kwargs
        return SimpleNamespace(run=lambda _authorization: None)

    monkeypatch.setattr(adapters, "PostgresD2Stage", constructor("postgres"))
    monkeypatch.setattr(adapters, "AlertContextStage", constructor("alert"))
    monkeypatch.setattr(adapters, "EnvironmentInspector", constructor("inspector"))
    monkeypatch.setattr(adapters, "CommonTeardown", constructor("supplemental"))
    monkeypatch.setattr(adapters, "CompositeCommonTeardown", composite)
    monkeypatch.setattr(orchestrator, "IntegratedUatOrchestrator", master)
    admitted = SimpleNamespace(
        authorization=object(),
        authorization_file=Path("/external/master-authorization.json"),
        authorization_signature=Path("/external/master-authorization.sig"),
        allowed_signers_file=Path("/external/allowed-signers"),
        b1_wheel=Path("/external/b1.whl"),
        b1_wheel_sha256="b" * 64,
        helper_sha256={
            path: str(index) * 64 for index, path in enumerate(HELPER_SCRIPTS, 1)
        },
        python_executable=Path("/pinned/python"),
        python_sha256="a" * 64,
        suite_root=Path("/repos/suite"),
    )

    dependencies = build_dependencies_from_environment({})
    dependencies.build_orchestrator(admitted)

    alert_kwargs, alert = records["alert"]
    assert alert_kwargs["b1_wheel"] == admitted.b1_wheel
    assert alert_kwargs["b1_wheel_sha256"] == admitted.b1_wheel_sha256
    assert alert_kwargs["python_executable"] == admitted.python_executable
    assert alert_kwargs["python_sha256"] == admitted.python_sha256
    postgres = records["postgres"][1]
    postgres_kwargs = records["postgres"][0]
    assert postgres_kwargs["authorization_file"] == admitted.authorization_file
    assert (
        postgres_kwargs["authorization_signature"] == admitted.authorization_signature
    )
    assert postgres_kwargs["allowed_signers_file"] == admitted.allowed_signers_file
    assert postgres_kwargs["b1_wheel"] == admitted.b1_wheel
    assert postgres_kwargs["b1_wheel_sha256"] == admitted.b1_wheel_sha256
    assert records["composite"] == {
        "alert_context_stage": alert,
        "postgres_d2_stage": postgres,
        "supplemental": records["supplemental"][1],
    }
    assert records["master"]["common_teardown"].name == "composite"


def test_bootstrap_admits_then_builds_and_runs_exactly_once() -> None:
    calls: list[object] = []
    authorization = object()
    admitted = SimpleNamespace(authorization=authorization)
    seal = SimpleNamespace(to_dict=lambda: {"status": "sealed", "run_id": "run-1"})

    class Orchestrator:
        def run(self, value: object) -> object:
            calls.append(("run", value))
            return seal

    dependencies = BootstrapDependencies(
        admit=lambda: calls.append("admit") or admitted,
        build_orchestrator=lambda value: (
            calls.append(("build", value)) or Orchestrator()
        ),
    )

    assert bootstrap_once(dependencies) is seal
    assert calls == ["admit", ("build", admitted), ("run", authorization)]


def test_main_defaults_to_inert_canonical_hold() -> None:
    output = io.StringIO()
    called = False

    def forbidden(*_args: object, **_kwargs: object) -> object:
        nonlocal called
        called = True
        raise AssertionError

    code = main([], output=output, dependency_builder=forbidden)

    assert code == 2
    assert called is False
    assert (
        output.getvalue()
        == '{"execution_authorized":false,"reason":"external_exact_authorization_absent","status":"HOLD"}\n'
    )


def test_main_accepts_only_exact_execute_and_emits_stable_success() -> None:
    invalid = io.StringIO()
    assert main(["--execute", "extra"], output=invalid) == 2
    assert (
        invalid.getvalue()
        == '{"execution_authorized":false,"reason":"external_exact_authorization_absent","status":"HOLD"}\n'
    )

    success = io.StringIO()
    seal = SimpleNamespace(to_dict=lambda: {"run_id": "run-1", "status": "sealed"})
    dependencies = BootstrapDependencies(
        admit=lambda: SimpleNamespace(authorization=object()),
        build_orchestrator=lambda _value: SimpleNamespace(
            run=lambda _authorization: seal
        ),
    )
    assert (
        main(
            ["--execute"],
            output=success,
            dependency_builder=lambda _environment: dependencies,
        )
        == 0
    )
    assert success.getvalue() == '{"run_id":"run-1","status":"sealed"}\n'
