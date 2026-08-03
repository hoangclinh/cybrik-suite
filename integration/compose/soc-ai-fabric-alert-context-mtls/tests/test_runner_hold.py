"""Offline tests for the fail-closed UAT orchestration boundary.

No test starts a process, opens a listener, or reads an external authorization.
All lifecycle operations are injected recorders.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import stat
import subprocess
import sys
from dataclasses import dataclass, replace
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_fabric import runner


@dataclass(frozen=True)
class _Authorization:
    authorization_id: str
    authorization_sha256: str
    source_tuple_sha256: str
    evidence_root: Path
    exact: bool = True
    external: bool = True
    one_shot: bool = True
    consumed: bool = False


def _authorization(tmp_path: Path) -> _Authorization:
    root = tmp_path / "cybrik-uat-soc-ai-fabric-evidence-unit"
    root.mkdir(mode=0o700)
    root.chmod(0o700)
    return _Authorization(
        authorization_id="uat-soc-ai-fabric-unit",
        authorization_sha256="a" * 64,
        source_tuple_sha256="b" * 64,
        evidence_root=root,
    )


def _case(case_id: str) -> dict[str, object]:
    common: dict[str, object] = {"case_id": case_id, "passed": True}
    if case_id == "positive":
        return {
            **common,
            "receipt_verified": True,
            "durable_receipt": True,
            "side_effect_performed": False,
        }
    if case_id == "F1":
        return {
            **common,
            "fabric_status": 403,
            "soc_call_count_unchanged": True,
            "model_call_count_unchanged": True,
            "journal_unchanged": True,
        }
    return {
        **common,
        "copied_receipt_rejected": True,
        "authoritative_journal_unchanged": True,
    }


def _dependencies(
    events: list[str], authorization: object | None
) -> runner.RunnerDependencies:
    def start(role: str):
        def callback(_authorization: object) -> object:
            events.append(f"start:{role}")
            return object()

        return callback

    def ready(role: str):
        def callback(_handle: object) -> None:
            events.append(f"ready:{role}")

        return callback

    def stop(role: str):
        def callback(_handle: object) -> None:
            events.append(f"stop:{role}")

        return callback

    def run_case(case_id: str):
        def callback(_authorization: object) -> dict[str, object]:
            events.append(f"case:{case_id}")
            return _case(case_id)

        return callback

    return runner.RunnerDependencies(
        authorize=lambda: authorization,
        start_soc=start("soc"),
        wait_soc_ready=ready("soc"),
        start_fabric=start("fabric"),
        wait_fabric_ready=ready("fabric"),
        start_ai=start("ai"),
        wait_ai_ready=ready("ai"),
        run_positive=run_case("positive"),
        run_f1=run_case("F1"),
        run_f2=run_case("F2"),
        stop_ai=stop("ai"),
        stop_fabric=stop("fabric"),
        stop_soc=stop("soc"),
        verify_absent=lambda _authorization: {
            key: True for key in runner.REQUIRED_ABSENCE_CHECKS
        },
        consume_authorization=lambda _authorization, terminal_sha256: events.append(
            f"consume:{terminal_sha256}"
        ),
    )


def test_missing_external_exact_authorization_holds_before_any_runtime_step(
    tmp_path: Path,
) -> None:
    events: list[str] = []
    dependencies = _dependencies(events, None)

    with pytest.raises(runner.RunnerHold) as caught:
        runner.run_once(dependencies)

    assert caught.value.reason == "external_exact_authorization_absent"
    assert events == []
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    "changes",
    [
        {"exact": False},
        {"external": False},
        {"one_shot": False},
        {"consumed": True},
        {"authorization_sha256": "not-a-digest"},
        {"source_tuple_sha256": "not-a-digest"},
    ],
)
def test_non_exact_or_consumed_authorization_holds(
    tmp_path: Path, changes: dict[str, object]
) -> None:
    base = _authorization(tmp_path)
    authorization = _Authorization(
        **{**base.__dict__, **changes},  # type: ignore[arg-type]
    )
    events: list[str] = []

    with pytest.raises(runner.RunnerHold) as caught:
        runner.run_once(_dependencies(events, authorization))

    assert caught.value.reason == "external_exact_authorization_invalid"
    assert events == []
    assert list(base.evidence_root.iterdir()) == []


def test_duck_typed_authorization_without_explicit_flags_holds(tmp_path: Path) -> None:
    base = _authorization(tmp_path)
    authorization = SimpleNamespace(
        authorization_id=base.authorization_id,
        authorization_sha256=base.authorization_sha256,
        source_tuple_sha256=base.source_tuple_sha256,
        evidence_root=base.evidence_root,
    )
    events: list[str] = []

    with pytest.raises(runner.RunnerHold) as caught:
        runner.run_once(_dependencies(events, authorization))

    assert caught.value.reason == "external_exact_authorization_invalid"
    assert events == []
    assert list(base.evidence_root.iterdir()) == []


def test_success_is_ordered_and_consumes_only_after_terminal_seal(
    tmp_path: Path,
) -> None:
    events: list[str] = []
    authorization = _authorization(tmp_path)

    result = runner.run_once(_dependencies(events, authorization))

    assert result.status == "passed"
    assert events[:-1] == [
        "start:soc",
        "ready:soc",
        "start:fabric",
        "ready:fabric",
        "start:ai",
        "ready:ai",
        "case:positive",
        "case:F1",
        "case:F2",
        "stop:ai",
        "stop:fabric",
        "stop:soc",
    ]
    assert events[-1] == f"consume:{result.terminal_sha256}"
    terminal = authorization.evidence_root / "05-terminal-seal.json"
    assert terminal.is_file()
    assert hashlib.sha256(terminal.read_bytes()).hexdigest() == result.terminal_sha256
    payload = json.loads(terminal.read_text(encoding="utf-8"))
    assert payload["status"] == "passed"
    assert payload["source_tuple_sha256"] == authorization.source_tuple_sha256
    for path in authorization.evidence_root.iterdir():
        assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_invalid_case_proof_fails_closed_and_is_not_consumed(tmp_path: Path) -> None:
    events: list[str] = []
    authorization = _authorization(tmp_path)
    dependencies = _dependencies(events, authorization)
    dependencies = replace(
        dependencies,
        run_f1=lambda _authorization: {
            "case_id": "F1",
            "passed": True,
            "fabric_status": 403,
            "soc_call_count_unchanged": False,
            "model_call_count_unchanged": True,
            "journal_unchanged": True,
        },
    )

    with pytest.raises(runner.RunnerError) as caught:
        runner.run_once(dependencies)

    assert caught.value.reason == "case_evidence_invalid"
    assert events[-3:] == ["stop:ai", "stop:fabric", "stop:soc"]
    assert not any(event.startswith("consume:") for event in events)
    assert not (authorization.evidence_root / "05-terminal-seal.json").exists()
    assert (authorization.evidence_root / "04-rollback-no-residual.json").is_file()


def test_f1_requires_proof_that_model_dispatch_count_did_not_change(
    tmp_path: Path,
) -> None:
    events: list[str] = []
    authorization = _authorization(tmp_path)
    dependencies = replace(
        _dependencies(events, authorization),
        run_f1=lambda _authorization: {
            "case_id": "F1",
            "passed": True,
            "fabric_status": 403,
            "soc_call_count_unchanged": True,
            "journal_unchanged": True,
        },
    )

    with pytest.raises(runner.RunnerError) as caught:
        runner.run_once(dependencies)

    assert caught.value.reason == "case_evidence_invalid"
    assert not any(event.startswith("consume:") for event in events)
    assert (authorization.evidence_root / "04-rollback-no-residual.json").is_file()


def test_cli_default_is_inert_hold(capsys: pytest.CaptureFixture[str]) -> None:
    assert runner.main([]) == runner.HOLD_EXIT_STATUS
    assert json.loads(capsys.readouterr().out) == {
        "execution_authorized": False,
        "reason": "external_exact_authorization_absent",
        "status": "HOLD",
    }


def test_standalone_script_resolves_local_source_without_pythonpath(
    tmp_path: Path,
) -> None:
    script = Path(__file__).resolve().parents[1] / "scripts" / "run_local_uat.py"

    result = subprocess.run(
        (sys.executable, str(script)),
        cwd=tmp_path,
        env={"PATH": "/usr/bin:/bin", "PYTHONPATH": ""},
        capture_output=True,
        check=False,
        text=True,
        timeout=10,
    )

    assert result.returncode == runner.HOLD_EXIT_STATUS
    assert json.loads(result.stdout) == {
        "execution_authorized": False,
        "reason": "external_exact_authorization_absent",
        "status": "HOLD",
    }
    assert result.stderr == ""


def test_standalone_script_holds_stably_when_local_source_is_missing(
    tmp_path: Path,
) -> None:
    source_script = Path(__file__).resolve().parents[1] / "scripts" / "run_local_uat.py"
    copied_script = tmp_path / "scripts" / "run_local_uat.py"
    copied_script.parent.mkdir()
    shutil.copyfile(source_script, copied_script)

    result = subprocess.run(
        (sys.executable, str(copied_script)),
        cwd=tmp_path,
        env={"PATH": "/usr/bin:/bin", "PYTHONPATH": ""},
        capture_output=True,
        check=False,
        text=True,
        timeout=10,
    )

    assert result.returncode == runner.HOLD_EXIT_STATUS
    assert json.loads(result.stdout) == {
        "execution_authorized": False,
        "reason": "local_source_unavailable",
        "status": "HOLD",
    }
    assert result.stderr == ""


def test_runner_rejects_untyped_dependencies_and_cli_arguments() -> None:
    with pytest.raises(runner.RunnerHold, match="external_exact_authorization_absent"):
        runner.run_once(object())  # type: ignore[arg-type]
    with pytest.raises(SystemExit) as caught:
        runner.main(["--run"])
    assert caught.value.code == runner.HOLD_EXIT_STATUS
