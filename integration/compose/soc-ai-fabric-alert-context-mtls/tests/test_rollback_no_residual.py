"""Offline teardown and evidence-boundary tests for the UAT runner."""

from __future__ import annotations

import json
import math
import stat
from dataclasses import dataclass, replace
from pathlib import Path

import pytest
from cybrik_suite_uat_fabric import evidence, runner


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


def _root(tmp_path: Path) -> Path:
    root = tmp_path / "cybrik-uat-soc-ai-fabric-evidence-unit"
    root.mkdir(mode=0o700)
    root.chmod(0o700)
    return root


def test_evidence_writer_uses_atomic_mode_0600_files(tmp_path: Path) -> None:
    root = _root(tmp_path)
    writer = evidence.EvidenceWriter(root, repository_roots=())

    artifact = writer.write(
        "01-positive.json",
        {"case_id": "positive", "passed": True, "receipt_sha256": "a" * 64},
    )

    path = root / artifact.filename
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert json.loads(path.read_text(encoding="utf-8"))["passed"] is True
    with pytest.raises(evidence.EvidenceError) as caught:
        writer.write("01-positive.json", {"passed": True})
    assert caught.value.reason == "evidence_already_exists"


def test_evidence_writer_rejects_unprepared_root_and_invalid_filename(
    tmp_path: Path,
) -> None:
    root = tmp_path / "cybrik-uat-soc-ai-fabric-evidence-insecure"
    root.mkdir(mode=0o755)
    root.chmod(0o755)
    with pytest.raises(evidence.EvidenceError, match="evidence_root_invalid"):
        evidence.EvidenceWriter(root, repository_roots=())

    root.chmod(0o700)
    writer = evidence.EvidenceWriter(root, repository_roots=())
    with pytest.raises(evidence.EvidenceError, match="evidence_filename_invalid"):
        writer.write("../unsafe.json", {"passed": True})
    assert list(root.iterdir()) == []


def test_evidence_writer_rejects_root_inside_suite_repository(
    tmp_path: Path,
) -> None:
    repository_root = tmp_path / "product-repository"
    repository_root.mkdir()
    root = repository_root / "cybrik-uat-soc-ai-fabric-evidence-unit"
    root.mkdir(mode=0o700)
    root.chmod(0o700)

    with pytest.raises(evidence.EvidenceError, match="evidence_root_invalid"):
        evidence.EvidenceWriter(root, repository_roots=(repository_root,))


def test_evidence_writer_rejects_repository_symlink_transition(
    tmp_path: Path,
) -> None:
    repository_root = tmp_path / "product-repository"
    repository_root.mkdir()
    root = _root(tmp_path)
    writer = evidence.EvidenceWriter(root, repository_roots=(repository_root,))
    repository_root.rmdir()
    repository_root.symlink_to(tmp_path, target_is_directory=True)

    with pytest.raises(
        evidence.EvidenceError, match="evidence_repository_transition_failed"
    ):
        writer.write("01-positive.json", {"passed": True})

    assert list(root.iterdir()) == []


@pytest.mark.parametrize(
    ("record", "reason"),
    [
        ({"private_key": "synthetic"}, "secret_bearing_key_rejected"),
        (
            {"detail": "Authorization: Bearer do-not-retain"},
            "authorization_material_rejected",
        ),
        ({"detail": "-----BEGIN PRIVATE KEY-----"}, "pem_material_rejected"),
        ({"detail": "aaaaaaaa.bbbbbbbb.cccccccc"}, "jwt_material_rejected"),
        (
            {"detail": "postgresql://user:password@127.0.0.1/db"},
            "credential_material_rejected",
        ),
        ({"raw": b"binary-not-permitted"}, "binary_evidence_rejected"),
        ({"receipt_sha256": "bad"}, "evidence_digest_invalid"),
        ({"detail": "x" * (evidence.MAX_TEXT + 1)}, "evidence_text_too_long"),
        ({"value": math.nan}, "evidence_number_not_finite"),
        ({"value": 1 << 300}, "evidence_integer_out_of_range"),
        ({"value": object()}, "evidence_type_rejected"),
        ({1: "non-string"}, "evidence_key_invalid"),
    ],
)
def test_secret_or_binary_evidence_is_rejected_without_retention(
    tmp_path: Path, record: dict[object, object], reason: str
) -> None:
    root = _root(tmp_path)

    with pytest.raises(evidence.EvidenceError, match=reason):
        evidence.EvidenceWriter(root, repository_roots=()).write(
            "01-positive.json", record
        )

    assert list(root.iterdir()) == []


def _dependencies(
    authorization: _Authorization,
    events: list[str],
    *,
    ai_stop_error: bool = False,
    absence: dict[str, bool] | None = None,
) -> runner.RunnerDependencies:
    handles = {role: object() for role in ("soc", "fabric", "ai")}

    def stop(role: str):
        def callback(handle: object) -> None:
            assert handle is handles[role]
            events.append(f"stop:{role}")
            if role == "ai" and ai_stop_error:
                raise RuntimeError("synthetic stop detail must not escape")

        return callback

    def case(case_id: str) -> dict[str, object]:
        if case_id == "positive":
            return {
                "case_id": case_id,
                "passed": True,
                "receipt_verified": True,
                "durable_receipt": True,
                "side_effect_performed": False,
            }
        if case_id == "F1":
            return {
                "case_id": case_id,
                "passed": True,
                "fabric_status": 403,
                "soc_call_count_unchanged": True,
                "model_call_count_unchanged": True,
                "journal_unchanged": True,
            }
        return {
            "case_id": case_id,
            "passed": True,
            "copied_receipt_rejected": True,
            "authoritative_journal_unchanged": True,
        }

    return runner.RunnerDependencies(
        authorize=lambda: authorization,
        start_soc=lambda _authorization: events.append("start:soc") or handles["soc"],
        wait_soc_ready=lambda _handle: events.append("ready:soc"),
        start_fabric=lambda _authorization: (
            events.append("start:fabric") or handles["fabric"]
        ),
        wait_fabric_ready=lambda _handle: events.append("ready:fabric"),
        start_ai=lambda _authorization: events.append("start:ai") or handles["ai"],
        wait_ai_ready=lambda _handle: events.append("ready:ai"),
        run_positive=lambda _authorization: case("positive"),
        run_f1=lambda _authorization: case("F1"),
        run_f2=lambda _authorization: case("F2"),
        stop_ai=stop("ai"),
        stop_fabric=stop("fabric"),
        stop_soc=stop("soc"),
        verify_absent=lambda _authorization: (
            absence
            if absence is not None
            else {key: True for key in runner.REQUIRED_ABSENCE_CHECKS}
        ),
        consume_authorization=lambda _authorization, _terminal_sha256: events.append(
            "consume"
        ),
    )


def test_teardown_attempts_every_started_process_in_reverse_on_start_failure(
    tmp_path: Path,
) -> None:
    authorization = _Authorization(
        authorization_id="uat-unit",
        authorization_sha256="a" * 64,
        source_tuple_sha256="b" * 64,
        evidence_root=_root(tmp_path),
    )
    events: list[str] = []
    dependencies = _dependencies(authorization, events)

    def fail_ai(_authorization: object) -> object:
        events.append("start:ai")
        raise RuntimeError("synthetic launch detail must not escape")

    dependencies = replace(dependencies, start_ai=fail_ai)

    with pytest.raises(runner.RunnerError) as caught:
        runner.run_once(dependencies)

    assert caught.value.reason == "runtime_step_failed"
    assert events[-2:] == ["stop:fabric", "stop:soc"]
    assert "stop:ai" not in events
    assert "consume" not in events
    assert (authorization.evidence_root / "04-rollback-no-residual.json").is_file()


def test_teardown_failure_is_not_suppressed_and_still_stops_remaining_processes(
    tmp_path: Path,
) -> None:
    authorization = _Authorization(
        authorization_id="uat-unit",
        authorization_sha256="a" * 64,
        source_tuple_sha256="b" * 64,
        evidence_root=_root(tmp_path),
    )
    events: list[str] = []

    with pytest.raises(runner.RunnerError) as caught:
        runner.run_once(_dependencies(authorization, events, ai_stop_error=True))

    assert caught.value.reason == "teardown_failed"
    assert events[-3:] == ["stop:ai", "stop:fabric", "stop:soc"]
    assert "consume" not in events
    assert not (authorization.evidence_root / "05-terminal-seal.json").exists()


def test_false_no_residual_check_blocks_terminal_seal_and_consumption(
    tmp_path: Path,
) -> None:
    authorization = _Authorization(
        authorization_id="uat-unit",
        authorization_sha256="a" * 64,
        source_tuple_sha256="b" * 64,
        evidence_root=_root(tmp_path),
    )
    events: list[str] = []
    absence = {key: True for key in runner.REQUIRED_ABSENCE_CHECKS}
    absence["fabric_listener_absent"] = False

    with pytest.raises(runner.RunnerError) as caught:
        runner.run_once(_dependencies(authorization, events, absence=absence))

    assert caught.value.reason == "residual_state_detected"
    assert "consume" not in events
    assert not (authorization.evidence_root / "05-terminal-seal.json").exists()


def test_authorization_and_effect_exceptions_are_collapsed_to_stable_reasons(
    tmp_path: Path,
) -> None:
    authorization = _Authorization(
        authorization_id="uat-unit",
        authorization_sha256="a" * 64,
        source_tuple_sha256="b" * 64,
        evidence_root=_root(tmp_path),
    )
    events: list[str] = []
    dependencies = _dependencies(authorization, events)

    with pytest.raises(runner.RunnerHold, match="external_exact_authorization_absent"):
        runner.run_once(
            replace(
                dependencies,
                authorize=lambda: (_ for _ in ()).throw(RuntimeError("synthetic")),
            )
        )

    with pytest.raises(runner.RunnerHold, match="external_exact_authorization_invalid"):
        runner.run_once(
            replace(
                dependencies,
                evidence_root_for=lambda _authorization: (_ for _ in ()).throw(
                    RuntimeError("synthetic")
                ),
            )
        )

    with pytest.raises(runner.RunnerError, match="runtime_step_failed"):
        runner.run_once(replace(dependencies, start_soc=lambda _authorization: None))


def test_probe_terminal_and_consumption_failures_remain_fail_closed(
    tmp_path: Path,
) -> None:
    authorization = _Authorization(
        authorization_id="uat-unit",
        authorization_sha256="a" * 64,
        source_tuple_sha256="b" * 64,
        evidence_root=_root(tmp_path),
    )
    events: list[str] = []
    dependencies = _dependencies(authorization, events)

    with pytest.raises(runner.RunnerError, match="absence_observation_failed"):
        runner.run_once(
            replace(
                dependencies,
                verify_absent=lambda _authorization: (_ for _ in ()).throw(
                    RuntimeError("synthetic")
                ),
            )
        )

    second_root = tmp_path / "cybrik-uat-soc-ai-fabric-evidence-consume"
    second_root.mkdir(mode=0o700)
    second_root.chmod(0o700)
    second_authorization = replace(authorization, evidence_root=second_root)
    consume_dependencies = _dependencies(second_authorization, [])
    consume_dependencies = replace(
        consume_dependencies,
        consume_authorization=lambda _authorization, _terminal_sha256: (
            _ for _ in ()
        ).throw(RuntimeError("synthetic")),
    )
    with pytest.raises(runner.RunnerError, match="authorization_consumption_failed"):
        runner.run_once(consume_dependencies)
    assert (second_root / "05-terminal-seal.json").is_file()
