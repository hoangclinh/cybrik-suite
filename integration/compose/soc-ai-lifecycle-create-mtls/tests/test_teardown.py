"""Static teardown-coverage controls for every D2-created resource kind.

Destructive cleanup is authorized only by an authenticated shutdown receipt and
a released liveness authority.  These tests are offline and fake-only: they
start no process, open no socket, and never convert a numeric process
identifier into deletion or signal authority.
"""

from __future__ import annotations

import ast
import json
import os
import stat
import subprocess
from pathlib import Path
from types import SimpleNamespace
from typing import Self

import pytest
from cybrik_suite_uat_mtls import harness
from cybrik_suite_uat_mtls import runtime_authorization as runtime_auth

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
_AUTHORIZATION_SHA256 = "a" * 64
_SHUTDOWN_RECEIPT = b"signed-shutdown-receipt"


def _authorization(runtime_root: Path, evidence_root: Path) -> SimpleNamespace:
    """The exact admitted tuple every teardown caller must pass explicitly."""

    return SimpleNamespace(
        authorization_id="d2-runtime-auth-teardown",
        authorization_sha256=_AUTHORIZATION_SHA256,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
    )


def _signed_pki_binding(root: Path) -> runtime_auth.RootBinding:
    observed = os.lstat(root)
    return runtime_auth.RootBinding(
        role="pki",
        path=root,
        identity=runtime_auth.DirectoryIdentity(
            mode=f"{stat.S_IMODE(observed.st_mode):04o}",
            st_dev=observed.st_dev,
            st_ino=observed.st_ino,
            uid=observed.st_uid,
        ),
        inventory=(),
    )


class _FakeControlClient:
    def __init__(self, events: list[str]) -> None:
        self.events = events
        self.request_ids: list[str] = []

    def stop_all(self, *, request_id: str) -> None:
        self.request_ids.append(request_id)
        self.events.append("stop_all")

    def shutdown(self, *, request_id: str) -> None:
        self.request_ids.append(request_id)
        self.events.append("shutdown")


class _FakeControlStore:
    """Authenticated control state without any descriptor or socket."""

    def __init__(
        self,
        events: list[str],
        *,
        receipt: bytes | None = _SHUTDOWN_RECEIPT,
        liveness_released: bool = True,
        control_root: Path | None = None,
    ) -> None:
        self.events = events
        self.receipt = receipt
        self._liveness_released = liveness_released
        self.control_root = control_root

    def read_shutdown_receipt(self, material: object) -> bytes:
        del material
        self.events.append("read_receipt")
        if self.receipt is None:
            raise harness.process_control.ProcessControlError(
                "control_leaf_read_failed"
            )
        return self.receipt

    def liveness_released(self, material: object) -> bool:
        del material
        self.events.append("liveness_released")
        return self._liveness_released

    def remove_control_root(self, material: object) -> None:
        del material
        self.events.append("remove_control_root")
        if self.control_root is not None and self.control_root.is_dir():
            self.control_root.rmdir()


def _bind_control(
    monkeypatch: pytest.MonkeyPatch,
    *,
    events: list[str],
    control_root: Path,
    control_store: _FakeControlStore,
    material: object,
    receipt_valid: bool = True,
) -> _FakeControlClient:
    client = _FakeControlClient(events)
    monkeypatch.setattr(
        harness, "_control_paths", lambda actual: SimpleNamespace(root=control_root)
    )
    monkeypatch.setattr(
        harness, "_load_control", lambda actual: (control_store, material, client)
    )
    monkeypatch.setattr(
        harness.process_control,
        "verify_shutdown_receipt",
        lambda actual, expected: (
            events.append("verify_receipt"),
            receipt_valid and actual is control_store.receipt and expected is material,
        )[1],
    )
    monkeypatch.setattr(harness.store, "stop", lambda: events.append("stop_store"))
    return client


def _bind_live_absence(
    monkeypatch: pytest.MonkeyPatch,
    *,
    runtime_root: Path,
    evidence_root: Path,
    control_root: Path,
) -> None:
    monkeypatch.setattr(
        harness,
        "_bounded_external_roots",
        lambda *, repositories_must_exist: (runtime_root, evidence_root),
    )
    monkeypatch.setattr(
        harness,
        "assert_runtime_authorized",
        lambda: _authorization(runtime_root, evidence_root),
    )
    monkeypatch.setattr(
        harness, "_control_paths", lambda actual: SimpleNamespace(root=control_root)
    )
    monkeypatch.setattr(
        harness,
        "_process_absence_state",
        lambda: {"ai_process_absent": True, "soc_process_absent": True},
    )


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
    assert all(
        required in store
        for required in (
            "DOCKER_EXECUTABLE",
            "executable.is_absolute()",
            '_docker_argv("container", "inspect", CONTAINER_NAME)',
        )
    )
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


def _bind_external_roots(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    *,
    runtime_root: Path,
    evidence_root: Path,
) -> None:
    roots = {name: tmp_path / name for name in ("soc", "ai", "fabric")}
    for root in roots.values():
        root.mkdir(exist_ok=True)
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(runtime_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(evidence_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_SOC_REPO", str(roots["soc"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_AI_REPO", str(roots["ai"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_FABRIC_REPO", str(roots["fabric"]))


def test_teardown_refuses_environment_runtime_root_mismatch_before_control_access(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The admitted runtime root is the only teardown root; env may not redirect it."""

    admitted_root = tmp_path / "cybrik-uat-d2-runtime-admitted"
    environment_root = tmp_path / "cybrik-uat-d2-runtime-environment"
    admitted_root.mkdir()
    environment_root.mkdir()
    (admitted_root / "preserve.txt").write_text("admitted", encoding="ascii")
    (environment_root / "preserve.txt").write_text("environment", encoding="ascii")
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-mismatch"
    _bind_external_roots(
        tmp_path,
        monkeypatch,
        runtime_root=environment_root,
        evidence_root=evidence_root,
    )
    monkeypatch.setattr(
        harness,
        "_load_control",
        lambda actual: (_ for _ in ()).throw(
            AssertionError("control authority must not be touched on root mismatch")
        ),
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="authorized runtime root does not match the bounded environment root",
    ):
        harness.teardown(_authorization(admitted_root, evidence_root))  # type: ignore[arg-type]

    assert (admitted_root / "preserve.txt").read_text(encoding="ascii") == "admitted"
    assert (environment_root / "preserve.txt").read_text(encoding="ascii") == (
        "environment"
    )


def test_destroy_runtime_root_uses_only_the_signed_pki_identity(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-signed-pki"
    pki_root = runtime_root / "pki"
    pki_root.mkdir(parents=True, mode=0o700)
    os.chmod(pki_root, 0o700)
    signed = _signed_pki_binding(pki_root)
    displaced = tmp_path / "signed-pki-displaced"
    pki_root.rename(displaced)
    pki_root.mkdir(mode=0o700)
    replacement_marker = pki_root / "replacement-owned.txt"
    replacement_marker.write_text("preserve", encoding="ascii")
    authorization = _authorization(
        runtime_root, tmp_path / "cybrik-uat-d2-evidence-signed-pki"
    )
    signed_calls: list[object] = []
    monkeypatch.setattr(
        harness.runtime_authorization,
        "signed_pki_root",
        lambda actual: (signed_calls.append(actual), signed)[1],
    )

    with pytest.raises(
        harness.pki.PkiBoundaryError,
        match="identity changed before destruction",
    ):
        harness._destroy_runtime_root(authorization)  # type: ignore[arg-type]

    assert signed_calls == [authorization]
    assert replacement_marker.read_text(encoding="ascii") == "preserve"
    assert displaced.is_dir()


def test_teardown_removes_only_the_bounded_runtime_root_and_is_idempotent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-unit"
    pki_root = runtime_root / "pki"
    pki_root.mkdir(parents=True)
    os.chmod(pki_root, 0o700)
    (pki_root / "server-key.pem").write_text("synthetic", encoding="ascii")
    (runtime_root / "postgres-password").write_text("a" * 64, encoding="ascii")
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-unit"
    evidence_root.mkdir()
    (evidence_root / "preserve.json").write_text("{}", encoding="utf-8")
    control_root = tmp_path / f"cybrik-d2-ctl-{_AUTHORIZATION_SHA256[:20]}"
    control_root.mkdir()
    _bind_external_roots(
        tmp_path, monkeypatch, runtime_root=runtime_root, evidence_root=evidence_root
    )
    events: list[str] = []
    material = object()
    control_store = _FakeControlStore(events, control_root=control_root)
    client = _bind_control(
        monkeypatch,
        events=events,
        control_root=control_root,
        control_store=control_store,
        material=material,
    )
    destroy = harness._destroy_runtime_root
    signed = _signed_pki_binding(pki_root)
    monkeypatch.setattr(
        harness.runtime_authorization,
        "signed_pki_root",
        lambda actual: signed,
    )
    monkeypatch.setattr(
        harness,
        "_destroy_runtime_root",
        lambda admitted: (events.append("destroy_runtime"), destroy(admitted))[0],
    )
    authorization = _authorization(runtime_root, evidence_root)

    harness.teardown(authorization)  # type: ignore[arg-type]
    harness.teardown(authorization)  # type: ignore[arg-type]

    assert events == [
        "stop_all",
        "shutdown",
        "read_receipt",
        "verify_receipt",
        "liveness_released",
        "stop_store",
        "destroy_runtime",
        "remove_control_root",
    ]
    assert client.request_ids == [
        harness.process_control.TEARDOWN_STOP_ALL_REQUEST_ID,
        harness.process_control.TEARDOWN_SHUTDOWN_REQUEST_ID,
    ]
    assert not runtime_root.exists()
    assert not control_root.exists()
    assert (evidence_root / "preserve.json").read_text(encoding="utf-8") == "{}"


@pytest.mark.parametrize("symlinked", ("runtime", "control"))
def test_teardown_rejects_a_symlinked_runtime_or_control_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, symlinked: str
) -> None:
    target = tmp_path / "runtime-target"
    target.mkdir()
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-symlink"
    control_root = tmp_path / f"cybrik-d2-ctl-{_AUTHORIZATION_SHA256[:20]}"
    if symlinked == "runtime":
        runtime_root.symlink_to(target, target_is_directory=True)
    else:
        runtime_root.mkdir()
        control_root.symlink_to(target, target_is_directory=True)
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-symlink"
    _bind_external_roots(
        tmp_path, monkeypatch, runtime_root=runtime_root, evidence_root=evidence_root
    )
    events: list[str] = []
    _bind_control(
        monkeypatch,
        events=events,
        control_root=control_root,
        control_store=_FakeControlStore(events, control_root=control_root),
        material=object(),
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="refusing a symlinked runtime teardown root",
    ):
        harness.teardown(  # type: ignore[arg-type]
            _authorization(runtime_root, evidence_root)
        )

    assert events == []
    assert target.is_dir()


@pytest.mark.parametrize("failure", ("absent_receipt", "invalid_receipt", "liveness"))
def test_teardown_deletes_nothing_without_a_verified_shutdown_and_released_liveness(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    """Neither the store, the runtime root, nor the control root may be freed."""

    runtime_root = tmp_path / "cybrik-uat-d2-runtime-refuse"
    runtime_root.mkdir()
    (runtime_root / "postgres-password").write_text("a" * 64, encoding="ascii")
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-refuse"
    control_root = tmp_path / f"cybrik-d2-ctl-{_AUTHORIZATION_SHA256[:20]}"
    control_root.mkdir()
    _bind_external_roots(
        tmp_path, monkeypatch, runtime_root=runtime_root, evidence_root=evidence_root
    )
    events: list[str] = []
    control_store = _FakeControlStore(
        events,
        receipt=None if failure == "absent_receipt" else _SHUTDOWN_RECEIPT,
        liveness_released=failure != "liveness",
        control_root=control_root,
    )
    _bind_control(
        monkeypatch,
        events=events,
        control_root=control_root,
        control_store=control_store,
        material=object(),
        receipt_valid=failure != "invalid_receipt",
    )
    monkeypatch.setattr(
        harness,
        "_destroy_runtime_root",
        lambda root: events.append("destroy_runtime"),
    )

    with pytest.raises(harness.RuntimeAuthorizationError):
        harness.teardown(  # type: ignore[arg-type]
            _authorization(runtime_root, evidence_root)
        )

    assert "stop_store" not in events
    assert "destroy_runtime" not in events
    assert "remove_control_root" not in events
    assert (runtime_root / "postgres-password").is_file()
    assert control_root.is_dir()


def test_teardown_never_signals_a_stale_numeric_pid_record(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An unknown PID file is unverified material, never signal authority."""

    runtime_root = tmp_path / "cybrik-uat-d2-runtime-stale-pid"
    runtime_root.mkdir()
    pki_root = runtime_root / "pki"
    pki_root.mkdir(mode=0o700)
    os.chmod(pki_root, 0o700)
    (runtime_root / "ai-server.pid").write_text("4321", encoding="ascii")
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-stale-pid"
    control_root = tmp_path / f"cybrik-d2-ctl-{_AUTHORIZATION_SHA256[:20]}"
    control_root.mkdir()
    _bind_external_roots(
        tmp_path, monkeypatch, runtime_root=runtime_root, evidence_root=evidence_root
    )
    events: list[str] = []
    _bind_control(
        monkeypatch,
        events=events,
        control_root=control_root,
        control_store=_FakeControlStore(events, control_root=control_root),
        material=object(),
    )
    signed = _signed_pki_binding(pki_root)
    monkeypatch.setattr(
        harness.runtime_authorization,
        "signed_pki_root",
        lambda actual: signed,
    )

    def forbidden(*args: object, **kwargs: object) -> object:
        raise AssertionError("numeric process authority was exercised")

    monkeypatch.setattr(harness.os, "kill", forbidden)
    monkeypatch.setattr(harness.subprocess, "run", forbidden)

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="runtime root contains unverified material",
    ):
        harness.teardown(  # type: ignore[arg-type]
            _authorization(runtime_root, evidence_root)
        )

    assert (runtime_root / "ai-server.pid").read_text(encoding="ascii") == "4321"
    assert "remove_control_root" not in events


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


def test_process_absence_state_observes_each_owned_role_with_quiet_pgrep(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[tuple[str, ...], dict[str, object]]] = []

    def fake_run(
        argv: tuple[str, ...], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        calls.append((argv, kwargs))
        return subprocess.CompletedProcess(argv, 1, "", "")

    monkeypatch.setattr(harness.subprocess, "run", fake_run)

    assert harness._process_absence_state() == {
        "ai_process_absent": True,
        "soc_process_absent": True,
    }
    assert len(calls) == 3
    patterns = tuple(call[0][-1] for call in calls)
    assert any("cybrik_suite_uat_mtls[.]server" in pattern for pattern in patterns)
    assert any(
        "cybrik_suite_uat_mtls[.]process_supervisor" in pattern for pattern in patterns
    )
    assert any("cybrik_suite_uat_mtls[.]client" in pattern for pattern in patterns)
    for argv, kwargs in calls:
        assert argv[:3] == ("/usr/bin/pgrep", "-q", "-f")
        assert kwargs == {
            "check": False,
            "env": {"LC_ALL": "C"},
            "shell": False,
            "stderr": subprocess.PIPE,
            "stdout": subprocess.DEVNULL,
            "text": True,
            "timeout": 5,
        }


@pytest.mark.parametrize(
    ("present_module", "expected"),
    (
        (
            "cybrik_suite_uat_mtls[.]server",
            {"ai_process_absent": False, "soc_process_absent": True},
        ),
        (
            "cybrik_suite_uat_mtls[.]process_supervisor",
            {"ai_process_absent": False, "soc_process_absent": True},
        ),
        (
            "cybrik_suite_uat_mtls[.]client",
            {"ai_process_absent": True, "soc_process_absent": False},
        ),
    ),
)
def test_process_absence_state_reports_each_present_role_without_aliasing(
    monkeypatch: pytest.MonkeyPatch,
    present_module: str,
    expected: dict[str, bool],
) -> None:
    def fake_run(
        argv: tuple[str, ...], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        del kwargs
        return subprocess.CompletedProcess(
            argv,
            0 if present_module in argv[-1] else 1,
            "",
            "",
        )

    monkeypatch.setattr(harness.subprocess, "run", fake_run)

    assert harness._process_absence_state() == expected


@pytest.mark.parametrize("returncode", (-1, 2, 127))
def test_process_absence_state_fails_closed_when_observation_is_unavailable(
    monkeypatch: pytest.MonkeyPatch, returncode: int
) -> None:
    monkeypatch.setattr(
        harness.subprocess,
        "run",
        lambda argv, **kwargs: subprocess.CompletedProcess(
            argv, returncode, "", "unavailable"
        ),
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="bounded process absence observation is unavailable",
    ):
        harness._process_absence_state()


def test_verify_absent_requires_store_pki_root_and_listener_absence(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-verify"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-verify"
    material = SimpleNamespace(root=runtime_root / "pki")
    probes = (_FakeProbe(connect_result=1), _FakeProbe(connect_result=1))
    probe_iterator = iter(probes)

    _bind_live_absence(
        monkeypatch,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        control_root=tmp_path / "cybrik-d2-ctl-absent",
    )
    monkeypatch.setattr(harness, "_pki_material", lambda root: material)
    monkeypatch.setattr(harness.store, "container_exists", lambda: False)
    monkeypatch.setattr(harness.pki, "verify_absent", lambda actual: actual is material)
    monkeypatch.setattr(
        harness.socket,
        "socket",
        lambda family, kind: next(probe_iterator),
    )

    assert harness.verify_absent() is True
    assert [probe.address for probe in probes] == [
        ("127.0.0.1", 58443),
        ("127.0.0.1", 55432),
    ]


def test_live_absence_state_reports_exact_eight_actual_checks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-live-absence"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-live-absence"
    material = SimpleNamespace(root=runtime_root / "pki")
    probes = iter((_FakeProbe(connect_result=1), _FakeProbe(connect_result=1)))

    _bind_live_absence(
        monkeypatch,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        control_root=tmp_path / "cybrik-d2-ctl-absent",
    )
    monkeypatch.setattr(harness, "_pki_material", lambda root: material)
    monkeypatch.setattr(harness.store, "container_exists", lambda: False)
    monkeypatch.setattr(harness.pki, "verify_absent", lambda actual: actual is material)
    monkeypatch.setattr(harness.socket, "socket", lambda family, kind: next(probes))

    assert harness._live_absence_state() == {
        "completed": True,
        "ai_process_absent": True,
        "soc_process_absent": True,
        "postgres_container_absent": True,
        "ai_listener_absent": True,
        "postgres_listener_absent": True,
        "runtime_root_absent": True,
        "pki_absent": True,
        "control_root_absent": True,
    }


def test_rollback_reauthorizes_then_finalizes_from_only_live_checks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-terminal"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-terminal"
    runtime_root.mkdir()
    evidence_root.mkdir()
    authorization = SimpleNamespace(
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        authorization_sha256="a" * 64,
        exact_head_grant_sha256="b" * 64,
    )
    marker = {"status": "consumed"}
    live = {
        "completed": True,
        "ai_process_absent": True,
        "soc_process_absent": True,
        "postgres_container_absent": True,
        "ai_listener_absent": True,
        "postgres_listener_absent": True,
        "runtime_root_absent": True,
        "pki_absent": True,
        "control_root_absent": True,
    }
    events: list[str] = []
    torn_down: list[object] = []

    monkeypatch.setattr(
        harness,
        "_bounded_external_roots",
        lambda *, repositories_must_exist: (runtime_root, evidence_root),
    )
    monkeypatch.setattr(
        harness,
        "assert_runtime_authorized",
        lambda: (events.append("authorize"), authorization)[1],
    )
    monkeypatch.setattr(
        harness,
        "assert_product_api_compatibility",
        lambda actual: events.append("origins"),
    )
    monkeypatch.setattr(
        harness.runtime_authorization,
        "verify_consumed",
        lambda actual: (events.append("marker"), marker)[1],
    )
    monkeypatch.setattr(
        harness,
        "teardown",
        lambda admitted: (events.append("teardown"), torn_down.append(admitted))[0],
    )
    monkeypatch.setattr(
        harness,
        "_live_absence_state",
        lambda: (events.append("live"), live)[1],
    )

    def finalize(**kwargs: object) -> object:
        events.append("finalize")
        assert kwargs["authorization"] is authorization
        assert kwargs["consumed_marker"] is marker
        probe = kwargs["live_absence_probe"]
        assert callable(probe)
        assert probe() == live
        return object()

    monkeypatch.setattr(
        harness.terminal_integration, "finalize_terminal_handoff", finalize
    )

    harness.rollback()

    assert events == [
        "authorize",
        "origins",
        "marker",
        "teardown",
        "finalize",
        "live",
    ]
    assert torn_down == [authorization]


def test_verify_absent_returns_false_when_ai_listener_is_present(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-verify-busy"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-verify-busy"
    material = SimpleNamespace(root=runtime_root / "pki")
    probes = (_FakeProbe(connect_result=0), _FakeProbe(connect_result=1))
    probe_iterator = iter(probes)

    _bind_live_absence(
        monkeypatch,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        control_root=tmp_path / "cybrik-d2-ctl-absent",
    )
    monkeypatch.setattr(harness, "_pki_material", lambda root: material)
    monkeypatch.setattr(harness.store, "container_exists", lambda: False)
    monkeypatch.setattr(harness.pki, "verify_absent", lambda actual: actual is material)
    monkeypatch.setattr(
        harness.socket,
        "socket",
        lambda family, kind: next(probe_iterator),
    )

    assert harness.verify_absent() is False
    assert [probe.address for probe in probes] == [
        ("127.0.0.1", 58443),
        ("127.0.0.1", 55432),
    ]


@pytest.mark.parametrize(
    ("store_absent", "pki_absent", "root_state", "control_state"),
    (
        (False, True, "absent", "absent"),
        (True, False, "absent", "absent"),
        (True, True, "directory", "absent"),
        (True, True, "broken-symlink", "absent"),
        (True, True, "absent", "directory"),
        (True, True, "absent", "broken-symlink"),
    ),
)
def test_verify_absent_requires_every_cleanup_conjunct(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    store_absent: bool,
    pki_absent: bool,
    root_state: str,
    control_state: str,
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-verify-conjunct"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-verify-conjunct"
    control_root = tmp_path / f"cybrik-d2-ctl-{_AUTHORIZATION_SHA256[:20]}"
    for root, state in ((runtime_root, root_state), (control_root, control_state)):
        if state == "directory":
            root.mkdir()
        elif state == "broken-symlink":
            root.symlink_to(tmp_path / "missing-target", target_is_directory=True)
    material = SimpleNamespace(root=runtime_root / "pki")

    _bind_live_absence(
        monkeypatch,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        control_root=control_root,
    )
    monkeypatch.setattr(harness, "_pki_material", lambda root: material)
    monkeypatch.setattr(harness.store, "container_exists", lambda: not store_absent)
    monkeypatch.setattr(harness.pki, "verify_absent", lambda actual: pki_absent)
    monkeypatch.setattr(
        harness.socket,
        "socket",
        lambda family, kind: _FakeProbe(connect_result=1),
    )

    assert harness.verify_absent() is False


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


_ISOLATED_ARGV = (
    "/isolated/python",
    "-I",
    "-B",
    "-S",
    "cybrik_suite_uat_mtls.client",
)


def _forbidden_process_handle(*args: object, **kwargs: object) -> None:
    raise AssertionError("a D2 client case must never own a process handle")


def _forbidden_signal(*args: object, **kwargs: object) -> None:
    raise AssertionError("a numeric process identifier is never signal authority")


def _case_roots(tmp_path: Path) -> tuple[Path, Path]:
    """Fresh runtime and evidence roots holding only fake, non-runtime material."""

    runtime_root = tmp_path / "cybrik-uat-d2-runtime-case"
    (runtime_root / "pki").mkdir(parents=True)
    (runtime_root / "postgres-password").write_text("p" * 64, encoding="ascii")
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-case"
    evidence_root.mkdir()
    return runtime_root, evidence_root


class _FakeIsolatedRunner:
    """A ``subprocess.run``-shaped fake: nothing is spawned, waited on, or killed."""

    def __init__(
        self,
        *,
        returncode: int = 0,
        stdout: str = "",
        stderr: str = "",
        timeout: subprocess.TimeoutExpired | None = None,
    ) -> None:
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr
        self.timeout = timeout
        self.argv_calls: list[tuple[object, str]] = []
        self.runs: list[dict[str, object]] = []
        self.screened: list[tuple[object, ...]] = []

    def isolated_module_argv(
        self, authorization: object, module: str
    ) -> tuple[str, ...]:
        self.argv_calls.append((authorization, module))
        return _ISOLATED_ARGV

    def run(
        self, argv: tuple[str, ...], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        self.runs.append({"argv": argv, **kwargs})
        if self.timeout is not None:
            raise self.timeout
        return subprocess.CompletedProcess(
            argv, self.returncode, self.stdout, self.stderr
        )


def _bind_isolated_runner(
    monkeypatch: pytest.MonkeyPatch, runner: _FakeIsolatedRunner
) -> list[object]:
    """Bind the fake child while keeping every real check and refusing PID authority."""

    validated: list[object] = []
    real_validate_evidence = harness.evidence.validate_evidence
    real_screen = harness._assert_secret_free_process_output

    def _validate_evidence(record: object) -> object:
        validated.append(record)
        return real_validate_evidence(record)

    def _screen(root: Path, *streams: str) -> None:
        runner.screened.append((root, *streams))
        real_screen(root, *streams)

    monkeypatch.setattr(
        harness,
        "_server_environment",
        lambda root, evidence_root, *, strip_tls: {},
    )
    monkeypatch.setattr(harness, "_isolated_module_argv", runner.isolated_module_argv)
    monkeypatch.setattr(harness.subprocess, "run", runner.run)
    monkeypatch.setattr(harness.subprocess, "Popen", _forbidden_process_handle)
    monkeypatch.setattr(harness.os, "kill", _forbidden_signal)
    monkeypatch.setattr(harness, "_assert_secret_free_process_output", _screen)
    monkeypatch.setattr(harness.evidence, "validate_evidence", _validate_evidence)
    return validated


def test_run_case_ignores_a_numeric_pid_record_and_runs_the_isolated_child(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A numeric identifier left on disk is inert: never read, signalled, or deleted."""

    runtime_root, evidence_root = _case_roots(tmp_path)
    stale_record = runtime_root / "soc-client.pid"
    stale_record.write_text("4321", encoding="ascii")
    expected = {"passed": True, "case": "N1"}
    (evidence_root / "case-n1.json").write_text(json.dumps(expected), encoding="utf-8")
    authorization = _authorization(runtime_root, evidence_root)
    runner = _FakeIsolatedRunner(returncode=0)
    _bind_isolated_runner(monkeypatch, runner)

    assert (
        harness._run_case(
            "N1",
            runtime_root,
            evidence_root,
            authorization,  # type: ignore[arg-type]
        )
        == expected
    )

    # The caller's admitted tuple alone builds the exact isolated argv.
    assert runner.argv_calls == [(authorization, "cybrik_suite_uat_mtls.client")]
    call = runner.runs[0]
    assert call["argv"] == _ISOLATED_ARGV
    assert call["shell"] is False
    assert call["check"] is False
    assert call["capture_output"] is True
    assert call["text"] is True
    assert call["timeout"] == 30
    assert call["env"]["CYBRIK_UAT_D2_CASE_ID"] == "N1"
    assert call["env"]["CYBRIK_UAT_D2_CASE_RESULT"] == str(
        evidence_root / "case-n1.json"
    )

    # No owned process handle, no signal, and the stale record survives untouched.
    assert stale_record.read_text(encoding="ascii") == "4321"


def test_run_case_fails_closed_when_the_isolated_child_times_out(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root, evidence_root = _case_roots(tmp_path)
    (evidence_root / "case-n1.json").write_text(
        json.dumps({"passed": True, "case": "N1"}), encoding="utf-8"
    )
    authorization = _authorization(runtime_root, evidence_root)
    runner = _FakeIsolatedRunner(
        timeout=subprocess.TimeoutExpired(cmd=_ISOLATED_ARGV, timeout=30)
    )
    validated = _bind_isolated_runner(monkeypatch, runner)

    with pytest.raises(
        harness.RuntimeAuthorizationError, match="D2 client case timed out"
    ):
        harness._run_case(
            "N1",
            runtime_root,
            evidence_root,
            authorization,  # type: ignore[arg-type]
        )

    assert runner.runs[0]["timeout"] == 30
    # A timed-out case never yields evidence and never leaves a process record.
    assert validated == []
    assert not (runtime_root / "soc-client.pid").exists()


def test_run_case_returns_validated_result_and_refuses_every_failure_shape(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root, evidence_root = _case_roots(tmp_path)
    expected = {"passed": True, "case": "N1"}
    result_path = evidence_root / "case-n1.json"
    result_path.write_text(json.dumps(expected), encoding="utf-8")
    authorization = _authorization(runtime_root, evidence_root)
    runner = _FakeIsolatedRunner(returncode=0, stdout="stdout", stderr="stderr")
    validated = _bind_isolated_runner(monkeypatch, runner)

    assert (
        harness._run_case(
            "N1",
            runtime_root,
            evidence_root,
            authorization,  # type: ignore[arg-type]
        )
        == expected
    )
    # Both captured streams are screened for secrets before any result is read.
    assert runner.screened == [(runtime_root, "stdout", "stderr")]
    assert validated == [expected]
    assert not (runtime_root / "soc-client.pid").exists()

    failed = {"passed": False, "case": "N1"}
    result_path.write_text(json.dumps(failed), encoding="utf-8")
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="D2 client case did not pass"
    ):
        harness._run_case(
            "N1",
            runtime_root,
            evidence_root,
            authorization,  # type: ignore[arg-type]
        )

    result_path.write_text(json.dumps(expected), encoding="utf-8")
    runner.returncode = 1
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="D2 client case failed"
    ):
        harness._run_case(
            "N1",
            runtime_root,
            evidence_root,
            authorization,  # type: ignore[arg-type]
        )

    runner.returncode = 0
    result_path.unlink()
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="D2 client case failed"
    ):
        harness._run_case(
            "N1",
            runtime_root,
            evidence_root,
            authorization,  # type: ignore[arg-type]
        )

    assert validated == [expected]
    assert not (runtime_root / "soc-client.pid").exists()
