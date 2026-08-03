from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_fabric import runner, runtime_bootstrap


@dataclass(frozen=True)
class _Roots:
    runtime_root: Path
    evidence_root: Path
    state_root: Path


def _authorization(*, consumed: bool = False) -> SimpleNamespace:
    return SimpleNamespace(
        authorization_id="uat-alert-context-r1",
        authorization_sha256="a" * 64,
        source_tuple_sha256="b" * 64,
        exact=True,
        external=True,
        one_shot=True,
        consumed=consumed,
    )


def _dependencies(
    tmp_path: Path,
    events: list[str],
    *,
    verify_error: Exception | None = None,
    consumed: bool = False,
) -> runtime_bootstrap.BootstrapDependencies:
    roots = _Roots(
        runtime_root=tmp_path / "runtime",
        evidence_root=tmp_path / "evidence",
        state_root=tmp_path / "state",
    )
    authorization = _authorization(consumed=consumed)

    def verify_signed_intent() -> object:
        events.append("verify_signed_intent")
        if verify_error is not None:
            raise verify_error
        return object()

    def prepare_runtime(_authorization: object, _roots: object) -> object:
        events.append("prepare_runtime")
        roots.runtime_root.mkdir()
        return object()

    def build_runner_dependencies(
        _authorization: object, _roots: object, _session: object
    ) -> object:
        events.append("build_runner_dependencies")
        return object()

    return runtime_bootstrap.BootstrapDependencies(
        verify_signed_intent=verify_signed_intent,
        observe_exact_tuple=lambda _intent: events.append("observe_exact_tuple") or (),
        calculate_aggregate=lambda _intent, _observations: (
            events.append("calculate_aggregate") or object()
        ),
        bind_authorization=lambda _intent, _observations, _aggregate: (
            events.append("bind_authorization") or authorization
        ),
        validate_external_roots=lambda _authorization: (
            events.append("validate_external_roots") or roots
        ),
        prepare_runtime=prepare_runtime,
        build_runner_dependencies=build_runner_dependencies,
        run_once=lambda _dependencies: (
            events.append("run_once")
            or runner.RunResult(status="passed", terminal_sha256="c" * 64, artifacts=())
        ),
        abort_runtime=lambda _session: events.append("abort_runtime"),
    )


@pytest.mark.parametrize(
    "error",
    (ValueError("invalid"), RuntimeError("expired"), PermissionError("bad signature")),
)
def test_invalid_expired_or_unverified_intent_holds_before_any_effect(
    tmp_path: Path, error: Exception
) -> None:
    events: list[str] = []

    with pytest.raises(runtime_bootstrap.BootstrapHold) as caught:
        runtime_bootstrap.bootstrap_once(
            _dependencies(tmp_path, events, verify_error=error)
        )

    assert caught.value.reason == "external_exact_authorization_absent"
    assert events == ["verify_signed_intent"]
    assert list(tmp_path.iterdir()) == []


def test_consumed_authorization_holds_before_external_roots_or_runtime(
    tmp_path: Path,
) -> None:
    events: list[str] = []

    with pytest.raises(runtime_bootstrap.BootstrapHold) as caught:
        runtime_bootstrap.bootstrap_once(_dependencies(tmp_path, events, consumed=True))

    assert caught.value.reason == "external_exact_authorization_invalid"
    assert events == [
        "verify_signed_intent",
        "observe_exact_tuple",
        "calculate_aggregate",
        "bind_authorization",
    ]
    assert list(tmp_path.iterdir()) == []


def test_bootstrap_is_strictly_ordered_and_reports_additive_scope(
    tmp_path: Path,
) -> None:
    events: list[str] = []

    result = runtime_bootstrap.bootstrap_once(_dependencies(tmp_path, events))

    assert result.status == "passed"
    assert result.runtime_scope == "alert_context_additive"
    assert result.postgresql_closure == "separate_blocking_gate"
    assert result.terminal_sha256 == "c" * 64
    assert events == [
        "verify_signed_intent",
        "observe_exact_tuple",
        "calculate_aggregate",
        "bind_authorization",
        "validate_external_roots",
        "prepare_runtime",
        "build_runner_dependencies",
        "run_once",
    ]


def test_failure_after_runtime_preparation_invokes_idempotent_abort(
    tmp_path: Path,
) -> None:
    events: list[str] = []
    dependencies = _dependencies(tmp_path, events)
    dependencies = runtime_bootstrap.BootstrapDependencies(
        **{
            **dependencies.__dict__,
            "run_once": lambda _dependencies: (_ for _ in ()).throw(
                RuntimeError("runtime detail")
            ),
        }
    )

    with pytest.raises(runtime_bootstrap.BootstrapError) as caught:
        runtime_bootstrap.bootstrap_once(dependencies)

    assert caught.value.reason == "runtime_attempt_failed"
    assert events[-1] == "abort_runtime"


def test_cli_default_holds_and_only_exact_execute_is_accepted(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert runtime_bootstrap.main([]) == runner.HOLD_EXIT_STATUS
    assert json.loads(capsys.readouterr().out) == {
        "execution_authorized": False,
        "reason": "external_exact_authorization_absent",
        "status": "HOLD",
    }

    with pytest.raises(SystemExit) as caught:
        runtime_bootstrap.main(["--other"])
    assert caught.value.code == runner.HOLD_EXIT_STATUS

    events: list[str] = []
    assert (
        runtime_bootstrap.main(
            ["--execute"],
            dependencies_factory=lambda: _dependencies(tmp_path, events),
        )
        == 0
    )
    payload = json.loads(capsys.readouterr().out)
    assert payload == {
        "postgresql_closure": "separate_blocking_gate",
        "runtime_scope": "alert_context_additive",
        "status": "passed",
        "terminal_sha256": "c" * 64,
    }
