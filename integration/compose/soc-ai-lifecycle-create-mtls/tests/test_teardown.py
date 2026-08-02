"""Static teardown-coverage controls for every D2-created resource kind."""

from __future__ import annotations

import ast
import json
import signal
import subprocess
from pathlib import Path
from types import SimpleNamespace
from typing import Self

import pytest

from cybrik_suite_uat_mtls import harness

_SRC = Path(__file__).resolve().parents[1] / "src/cybrik_suite_uat_mtls"
_EXPECTED_RESOURCES = {
    "ai_process",
    "client_process",
    "postgres_container",
    "ai_listener",
    "postgres_listener",
    "runtime_directory",
    "pki_material",
}


def _text(name: str) -> str:
    path = _SRC / name
    assert path.is_file(), f"D2 runtime module is not authored: {name}"
    return path.read_text(encoding="utf-8")


def test_teardown_registry_covers_every_created_resource() -> None:
    tree = ast.parse(_text("harness.py"), filename="harness.py")
    assignments = {
        target.id: node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign)
        for target in node.targets
        if isinstance(target, ast.Name)
    }
    value = assignments.get("RESOURCE_KINDS")
    assert isinstance(value, (ast.Tuple, ast.Set))
    declared = {
        item.value
        for item in value.elts
        if isinstance(item, ast.Constant) and isinstance(item.value, str)
    }
    assert declared == _EXPECTED_RESOURCES


def test_teardown_implementation_is_idempotent_and_verifies_absence() -> None:
    harness = _text("harness.py")
    store = _text("store.py")
    pki = _text("pki.py")
    for required in ("teardown", "verify_absent", "finally"):
        assert required in harness
    assert '("docker", "container", "inspect", CONTAINER_NAME)' in store
    assert "destroy_ephemeral_pki" in pki


def test_cleanup_rejects_repository_nested_runtime_root_without_deleting_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    roots = {name: tmp_path / name for name in ("soc", "ai", "fabric")}
    for root in roots.values():
        root.mkdir()
    nested = roots["soc"] / "cybrik-uat-d2-runtime-must-survive"
    nested.mkdir()
    (nested / "marker").write_text("synthetic", encoding="utf-8")
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-reject"
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(nested))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(evidence_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_SOC_REPO", str(roots["soc"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_AI_REPO", str(roots["ai"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_FABRIC_REPO", str(roots["fabric"]))
    with pytest.raises(harness.RuntimeAuthorizationError):
        harness.teardown()
    assert (nested / "marker").read_text(encoding="utf-8") == "synthetic"


def test_runner_reports_cleanup_failure_instead_of_suppressing_it() -> None:
    runner = (
        Path(__file__).resolve().parents[4]
        / "tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh"
    ).read_text(encoding="utf-8")
    assert "rollback >/dev/null 2>&1 || true" not in runner
    assert "cleanup failed" in runner


def test_teardown_removes_only_the_bounded_runtime_root_and_is_idempotent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    roots = {name: tmp_path / name for name in ("soc", "ai", "fabric")}
    for root in roots.values():
        root.mkdir()
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-unit"
    pki_root = runtime_root / "pki"
    pki_root.mkdir(parents=True)
    (pki_root / "server-key.pem").write_text("synthetic", encoding="ascii")
    (runtime_root / "postgres-password").write_text("a" * 64, encoding="ascii")
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-unit"
    evidence_root.mkdir()
    (evidence_root / "preserve.json").write_text("{}", encoding="utf-8")
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(runtime_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(evidence_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_SOC_REPO", str(roots["soc"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_AI_REPO", str(roots["ai"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_FABRIC_REPO", str(roots["fabric"]))
    monkeypatch.setattr(harness.store, "stop", lambda: None)

    harness.teardown()
    harness.teardown()

    assert not runtime_root.exists()
    assert (evidence_root / "preserve.json").read_text(encoding="utf-8") == "{}"


def test_teardown_rejects_symlinked_runtime_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    roots = {name: tmp_path / name for name in ("soc", "ai", "fabric")}
    for root in roots.values():
        root.mkdir()
    target = tmp_path / "runtime-target"
    target.mkdir()
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-symlink"
    runtime_root.symlink_to(target, target_is_directory=True)
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-symlink"
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(runtime_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(evidence_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_SOC_REPO", str(roots["soc"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_AI_REPO", str(roots["ai"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_FABRIC_REPO", str(roots["fabric"]))

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="refusing a symlinked runtime teardown root",
    ):
        harness.teardown()


class _FakeProbe:
    def __init__(self, *, connect_result: int) -> None:
        self.connect_result = connect_result
        self.timeout: float | None = None
        self.address: tuple[str, int] | None = None

    def __enter__(self) -> Self:
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None

    def settimeout(self, value: float) -> None:
        self.timeout = value

    def connect_ex(self, address: tuple[str, int]) -> int:
        self.address = address
        return self.connect_result


class _FakeProcess:
    def __init__(
        self,
        *,
        pid: int = 321,
        poll_values: list[int | None] | None = None,
        communicate_result: tuple[str, str] = ("", ""),
        communicate_exception: Exception | None = None,
        returncode: int = 0,
    ) -> None:
        self.pid = pid
        self._poll_values = list(poll_values or [None, 0])
        self.communicate_result = communicate_result
        self.communicate_exception = communicate_exception
        self.returncode = returncode
        self.signal_sent: int | None = None
        self.kill_called = False
        self.wait_calls: list[int] = []
        self.communicate_calls: list[int] = []

    def poll(self) -> int | None:
        if len(self._poll_values) > 1:
            return self._poll_values.pop(0)
        return self._poll_values[0]

    def communicate(self, timeout: int) -> tuple[str, str]:
        self.communicate_calls.append(timeout)
        if self.communicate_exception is not None:
            raise self.communicate_exception
        return self.communicate_result

    def send_signal(self, value: int) -> None:
        self.signal_sent = value

    def wait(self, timeout: int) -> None:
        self.wait_calls.append(timeout)

    def kill(self) -> None:
        self.kill_called = True


def test_verify_absent_requires_store_pki_root_and_listener_absence(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-verify"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-verify"
    material = SimpleNamespace(root=runtime_root / "pki")
    probe = _FakeProbe(connect_result=1)

    monkeypatch.setattr(
        harness,
        "_bounded_external_roots",
        lambda *, repositories_must_exist: (runtime_root, evidence_root),
    )
    monkeypatch.setattr(harness, "_pki_material", lambda root: material)
    monkeypatch.setattr(harness.store, "verify_absent", lambda: True)
    monkeypatch.setattr(harness.pki, "verify_absent", lambda actual: actual is material)
    monkeypatch.setattr(
        harness.socket,
        "socket",
        lambda family, kind: probe,
    )

    assert harness.verify_absent() is True
    assert probe.timeout == 0.25
    assert probe.address == ("127.0.0.1", 58443)


def test_verify_absent_returns_false_when_ai_listener_is_present(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-verify-busy"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-verify-busy"
    material = SimpleNamespace(root=runtime_root / "pki")
    probe = _FakeProbe(connect_result=0)

    monkeypatch.setattr(
        harness,
        "_bounded_external_roots",
        lambda *, repositories_must_exist: (runtime_root, evidence_root),
    )
    monkeypatch.setattr(harness, "_pki_material", lambda root: material)
    monkeypatch.setattr(harness.store, "verify_absent", lambda: True)
    monkeypatch.setattr(harness.pki, "verify_absent", lambda actual: actual is material)
    monkeypatch.setattr(
        harness.socket,
        "socket",
        lambda family, kind: probe,
    )

    assert harness.verify_absent() is False
    assert probe.timeout == 0.25
    assert probe.address == ("127.0.0.1", 58443)


@pytest.mark.parametrize(
    ("store_absent", "pki_absent", "root_state"),
    (
        (False, True, "absent"),
        (True, False, "absent"),
        (True, True, "directory"),
        (True, True, "broken-symlink"),
    ),
)
def test_verify_absent_requires_every_cleanup_conjunct(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    store_absent: bool,
    pki_absent: bool,
    root_state: str,
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-verify-conjunct"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-verify-conjunct"
    if root_state == "directory":
        runtime_root.mkdir()
    elif root_state == "broken-symlink":
        runtime_root.symlink_to(tmp_path / "missing-target", target_is_directory=True)
    material = SimpleNamespace(root=runtime_root / "pki")

    monkeypatch.setattr(
        harness,
        "_bounded_external_roots",
        lambda *, repositories_must_exist: (runtime_root, evidence_root),
    )
    monkeypatch.setattr(harness, "_pki_material", lambda root: material)
    monkeypatch.setattr(harness.store, "verify_absent", lambda: store_absent)
    monkeypatch.setattr(harness.pki, "verify_absent", lambda actual: pki_absent)
    monkeypatch.setattr(
        harness.socket,
        "socket",
        lambda family, kind: _FakeProbe(connect_result=1),
    )

    assert harness.verify_absent() is False


def test_stop_process_sends_sigterm_and_unlinks_pid_record(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pid_path = tmp_path / "ai-server.pid"
    pid_path.write_text("321", encoding="ascii")
    process = _FakeProcess(poll_values=[None, 0, 0], returncode=0)

    harness._stop_process(process, tmp_path)

    assert process.signal_sent == signal.SIGTERM
    assert process.wait_calls == [15]
    assert not pid_path.exists()


def test_stop_process_kills_after_wait_timeout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pid_path = tmp_path / "ai-server.pid"
    pid_path.write_text("321", encoding="ascii")
    process = _FakeProcess(poll_values=[None, 0, 0], returncode=0)

    def _wait(timeout: int) -> None:
        process.wait_calls.append(timeout)
        if timeout == 15:
            raise subprocess.TimeoutExpired(cmd="proc", timeout=timeout)

    monkeypatch.setattr(process, "wait", _wait)

    harness._stop_process(process, tmp_path)

    assert process.signal_sent == signal.SIGTERM
    assert process.kill_called is True
    assert process.wait_calls == [15, 5]
    assert not pid_path.exists()


def test_stop_recorded_process_rejects_unsafe_and_invalid_pid_files(
    tmp_path: Path,
) -> None:
    pid_path = tmp_path / "ai-server.pid"
    target = tmp_path / "target"
    target.write_text("present", encoding="ascii")
    pid_path.symlink_to(target)
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="AI server process record is unsafe"
    ):
        harness._stop_recorded_process(
            tmp_path,
            pid_filename="ai-server.pid",
            identity="cybrik_suite_uat_mtls.server",
        )

    pid_path.unlink()
    pid_path.write_text("0", encoding="ascii")
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="AI server process record is invalid"
    ):
        harness._stop_recorded_process(
            tmp_path,
            pid_filename="ai-server.pid",
            identity="cybrik_suite_uat_mtls.server",
        )


def test_stop_recorded_process_rejects_identity_mismatch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pid_path = tmp_path / "ai-server.pid"
    pid_path.write_text("4321", encoding="ascii")
    monkeypatch.setattr(
        harness.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="other process\n"),
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError, match="D2 process identity is inconsistent"
    ):
        harness._stop_recorded_process(
            tmp_path,
            pid_filename="ai-server.pid",
            identity="cybrik_suite_uat_mtls.server",
        )


def test_stop_recorded_process_reaps_process_and_unlinks_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pid_path = tmp_path / "ai-server.pid"
    pid_path.write_text("4321", encoding="ascii")
    calls: list[tuple[int, int]] = []
    poll_state = iter([None, ProcessLookupError()])

    monkeypatch.setattr(
        harness.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(
            returncode=0, stdout="python -m cybrik_suite_uat_mtls.server\n"
        ),
    )

    def _kill(pid: int, sig: int) -> None:
        calls.append((pid, sig))
        state = next(poll_state)
        if isinstance(state, Exception):
            raise state

    monkeypatch.setattr(harness.os, "kill", _kill)
    monkeypatch.setattr(harness.time, "sleep", lambda _: None)

    harness._stop_recorded_process(
        tmp_path,
        pid_filename="ai-server.pid",
        identity="cybrik_suite_uat_mtls.server",
    )

    assert calls[0] == (4321, signal.SIGTERM)
    assert not pid_path.exists()


def test_assert_secret_free_process_output_rejects_literal_secret(
    tmp_path: Path,
) -> None:
    (tmp_path / "postgres-password").write_text("a" * 64, encoding="ascii")
    pki_root = tmp_path / "pki"
    pki_root.mkdir()
    (pki_root / "server-key.pem").write_text("secret-key", encoding="ascii")

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="client process output contained a runtime secret",
    ):
        harness._assert_secret_free_process_output(tmp_path, "prefix secret-key suffix")


def test_assert_secret_free_process_output_ignores_nonmatching_jwt_reason_and_rejects_other_secret(
    tmp_path: Path,
) -> None:
    (tmp_path / "postgres-password").write_text("a" * 64, encoding="ascii")
    (tmp_path / "pki").mkdir()
    jwt_shaped_but_not_runtime_token = "AAAAAAAAAA.BBBBBBBBBB.CCCCCCCCCC"

    harness._assert_secret_free_process_output(
        tmp_path, jwt_shaped_but_not_runtime_token
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="client process output was secret-bearing",
    ):
        harness._assert_secret_free_process_output(
            tmp_path, "eyJhbGciOiJFUzI1NiJ9.AAAAAAAAAAAA.BBBBBBBBBBBB"
        )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="client process output was secret-bearing",
    ):
        harness._assert_secret_free_process_output(
            tmp_path,
            jwt_shaped_but_not_runtime_token,
            "Bearer AAAAAAAAAAAAAAAAAAAA",
        )


def test_run_case_rejects_existing_pid_record(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "soc-client.pid").write_text("1", encoding="ascii")
    monkeypatch.setattr(harness, "_server_environment", lambda *args, **kwargs: {})

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="SOC client process record already exists",
    ):
        harness._run_case("N1", tmp_path, tmp_path)


def test_run_case_times_out_and_kills_process(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    process = _FakeProcess(poll_values=[0])
    monkeypatch.setattr(harness, "_server_environment", lambda *args, **kwargs: {})
    monkeypatch.setattr(harness.subprocess, "Popen", lambda *args, **kwargs: process)
    monkeypatch.setattr(harness, "_record_pid", lambda path, pid: None)
    calls = {"count": 0}

    def _communicate(timeout: int) -> tuple[str, str]:
        process.communicate_calls.append(timeout)
        calls["count"] += 1
        if calls["count"] == 1:
            raise subprocess.TimeoutExpired(cmd="client", timeout=30)
        return ("", "")

    monkeypatch.setattr(process, "communicate", _communicate)

    with pytest.raises(
        harness.RuntimeAuthorizationError, match="D2 client case timed out"
    ):
        harness._run_case("N1", tmp_path, tmp_path)

    assert process.kill_called is True
    assert process.communicate_calls == [30, 5]


def test_run_case_returns_validated_result(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    process = _FakeProcess(
        poll_values=[0],
        communicate_result=("stdout", "stderr"),
        returncode=0,
    )
    expected = {"passed": True, "case": "N1"}
    result_path = tmp_path / "case-n1.json"
    result_path.write_text(json.dumps(expected), encoding="utf-8")
    validated: list[object] = []
    real_validate_evidence = harness.evidence.validate_evidence

    def validate_evidence(record: object) -> object:
        validated.append(record)
        return real_validate_evidence(record)

    monkeypatch.setattr(harness, "_server_environment", lambda *args, **kwargs: {})
    monkeypatch.setattr(harness.subprocess, "Popen", lambda *args, **kwargs: process)
    monkeypatch.setattr(
        harness, "_assert_secret_free_process_output", lambda root, *streams: None
    )
    monkeypatch.setattr(harness.evidence, "validate_evidence", validate_evidence)

    assert harness._run_case("N1", tmp_path, tmp_path) == expected
    assert not (tmp_path / "soc-client.pid").exists()
    assert validated == [expected]

    failed = {"passed": False, "case": "N1"}
    result_path.write_text(json.dumps(failed), encoding="utf-8")
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="D2 client case did not pass"
    ):
        harness._run_case("N1", tmp_path, tmp_path)
    assert not (tmp_path / "soc-client.pid").exists()
    assert validated == [expected]
