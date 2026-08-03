"""Deterministic branch coverage for the injected D2 process supervisor.

Every socket, process, filesystem, and control-plane interaction in this file is
an in-memory fake.  These tests never bind a listener, spawn a process, signal a
real PID, or contact a product runtime.
"""

from __future__ import annotations

import stat
import subprocess
from pathlib import Path
from types import SimpleNamespace
from typing import Final

import pytest
from cybrik_suite_uat_mtls import process_control as control
from cybrik_suite_uat_mtls import process_supervisor as supervisor

_AUTHORIZATION_SHA256: Final = "a" * 64
_RUN_ID: Final = "b" * 32
_CAPABILITY: Final = b"c" * 32
_OWNER_UID: Final = 501


def _binding() -> control.ControlBinding:
    return control.ControlBinding(
        authorization_sha256=_AUTHORIZATION_SHA256,
        run_id=_RUN_ID,
        generation=1,
        owner_uid=_OWNER_UID,
    )


def _paths() -> control.ControlPaths:
    return control.derive_control_paths(
        Path("/private/tmp/cybrik-d2-supervisor-coverage"),
        _AUTHORIZATION_SHA256,
    )


def _root_identity(*, inode: int = 11) -> control.RootIdentity:
    return control.RootIdentity(
        device=7,
        inode=inode,
        owner_uid=_OWNER_UID,
        mode=stat.S_IFDIR | 0o700,
    )


def _request_body(
    request_id: str,
    action: object,
    parameters: object,
) -> dict[str, object]:
    return {
        "action": action,
        "binding": _binding().as_payload(),
        "kind": "request",
        "parameters": parameters,
        "request_id": request_id,
        "version": control.PROTOCOL_VERSION,
    }


def _frame(body: dict[str, object]) -> bytes:
    return control.sign_frame(body, _CAPABILITY)


class _FakeOwnedProcess:
    def __init__(
        self,
        *,
        poll_result: int | None = 0,
        wait_results: tuple[object, ...] = (),
    ) -> None:
        self.poll_result = poll_result
        self.wait_results = list(wait_results)
        self.actions: list[object] = []

    def poll(self) -> int | None:
        self.actions.append("poll")
        return self.poll_result

    def terminate(self) -> None:
        self.actions.append("terminate")

    def wait(self, timeout: int) -> int:
        self.actions.append(("wait", timeout))
        result = self.wait_results.pop(0)
        if isinstance(result, BaseException):
            raise result
        return int(result)

    def kill(self) -> None:
        self.actions.append("kill")


def _core(
    *,
    child: _FakeOwnedProcess | None = None,
    receipts: list[dict[str, object]] | None = None,
    replay_cache_capacity: int = supervisor.DEFAULT_REPLAY_CACHE_CAPACITY,
) -> supervisor.SupervisorCore:
    owned = child or _FakeOwnedProcess()
    receipt_records = receipts if receipts is not None else []
    return supervisor.SupervisorCore(
        binding=_binding(),
        capability=_CAPABILITY,
        process_factory=lambda _role, _parameters: owned,
        receipt_writer=lambda receipt: receipt_records.append(receipt),
        replay_cache_capacity=replay_cache_capacity,
    )


def _handle(
    core: supervisor.SupervisorCore,
    request_id: str,
    action: object,
    parameters: object,
) -> bytes:
    return core.handle_frame(
        _frame(_request_body(request_id, action, parameters)),
        peer_uid=_OWNER_UID,
    )


@pytest.mark.parametrize("capacity", (True, 0, 4097, "1"))
def test_replay_cache_capacity_rejects_invalid_boundary_values(
    capacity: object,
) -> None:
    with pytest.raises(control.ProcessControlError) as caught:
        _core(replay_cache_capacity=capacity)  # type: ignore[arg-type]

    assert caught.value.reason == "replay_cache_capacity_invalid"


@pytest.mark.parametrize(
    ("mutate", "reason"),
    (
        (lambda body: body.pop("kind"), "request_shape_invalid"),
        (lambda body: body.__setitem__("version", "wrong"), "request_shape_invalid"),
        (lambda body: body.__setitem__("binding", {}), "binding_mismatch"),
        (lambda body: body.__setitem__("action", 7), "request_shape_invalid"),
    ),
)
def test_request_parser_rejects_each_fail_closed_boundary(
    mutate: object, reason: str
) -> None:
    body = _request_body("invalid-shape", "stop_all", {})
    mutate(body)  # type: ignore[operator]

    with pytest.raises(control.ProcessControlError) as caught:
        _core().handle_frame(_frame(body), peer_uid=_OWNER_UID)

    assert caught.value.reason == reason


@pytest.mark.parametrize(
    ("action", "parameters", "reason"),
    (
        ("not_an_action", {}, "unknown_action"),
        ("stop_all", {"unexpected": True}, "parameters_invalid"),
        ("start_server", {"strip_tls": "false"}, "parameters_invalid"),
        ("stop_server", {}, "child_not_owned"),
    ),
)
def test_dispatch_rejects_unknown_invalid_or_unowned_actions(
    action: str,
    parameters: dict[str, object],
    reason: str,
) -> None:
    with pytest.raises(control.ProcessControlError) as caught:
        _handle(_core(), f"dispatch-{action}", action, parameters)

    assert caught.value.reason == reason


def test_start_rejects_a_second_owned_server() -> None:
    core = _core()
    _handle(core, "start-first", "start_server", {"strip_tls": False})

    with pytest.raises(control.ProcessControlError) as caught:
        _handle(core, "start-second", "start_server", {"strip_tls": True})

    assert caught.value.reason == "child_already_owned"


def test_force_shutdown_reaps_exited_child_writes_receipt_and_is_idempotent() -> None:
    child = _FakeOwnedProcess(poll_result=7)
    receipts: list[dict[str, object]] = []
    core = _core(child=child, receipts=receipts)
    _handle(core, "start-for-shutdown", "start_server", {"strip_tls": False})

    first = core.force_shutdown()
    second = core.force_shutdown()

    assert first == {
        "status": "shutdown",
        "stopped": {supervisor.SERVER_ROLE: 7},
    }
    assert second == {"status": "shutdown", "stopped": {}}
    assert receipts[0]["all_children_reaped"] is True
    assert child.actions == ["poll"]


@pytest.mark.parametrize(
    ("wait_results", "reason"),
    (
        ((TimeoutError("terminate timeout"), -9), None),
        (
            (
                TimeoutError("terminate timeout"),
                TimeoutError("kill timeout"),
            ),
            "owned_child_unreaped",
        ),
    ),
)
def test_owned_child_reap_escalates_to_kill_and_fails_closed(
    wait_results: tuple[object, ...],
    reason: str | None,
) -> None:
    child = _FakeOwnedProcess(poll_result=None, wait_results=wait_results)
    core = _core(child=child)
    _handle(core, "start-escalation", "start_server", {"strip_tls": False})

    if reason is None:
        _handle(core, "stop-escalation", "stop_server", {})
    else:
        with pytest.raises(control.ProcessControlError) as caught:
            _handle(core, "stop-escalation", "stop_server", {})
        assert caught.value.reason == reason

    assert child.actions == [
        "poll",
        "terminate",
        ("wait", control.TERMINATE_WAIT_SECONDS),
        "kill",
        ("wait", control.KILL_WAIT_SECONDS),
    ]


@pytest.mark.parametrize(
    "candidate",
    (
        object(),
        SimpleNamespace(device=7, inode=12, owner_uid=_OWNER_UID, mode=0o600),
    ),
)
def test_socket_identity_rejects_malformed_or_non_socket_candidates(
    candidate: object,
) -> None:
    with pytest.raises(control.ProcessControlError) as caught:
        supervisor._socket_identity(candidate, _OWNER_UID)

    assert caught.value.reason == "control_socket_invalid"


def _daemon(
    *,
    core: object = SimpleNamespace(),
    filesystem: object = SimpleNamespace(),
    expected_root_identity: control.RootIdentity | None = None,
    socket_factory: object = lambda _family, _kind: SimpleNamespace(),
) -> supervisor.SupervisorDaemon:
    return supervisor.SupervisorDaemon(
        core=core,
        binding=_binding(),
        capability=_CAPABILITY,
        paths=_paths(),
        filesystem=filesystem,  # type: ignore[arg-type]
        expected_root_identity=expected_root_identity,
        socket_factory=socket_factory,  # type: ignore[arg-type]
        peer_euid_reader=lambda _connection: _OWNER_UID,
        ready_writer=lambda _record: None,
    )


@pytest.mark.parametrize("observed_inode", (11, 12))
def test_daemon_verifies_expected_root_identity(observed_inode: int) -> None:
    daemon = _daemon(
        filesystem=SimpleNamespace(
            stat_directory=lambda _path, *, nofollow: _root_identity(
                inode=observed_inode
            )
        ),
        expected_root_identity=_root_identity(),
    )

    if observed_inode == 11:
        daemon._verify_root_identity()
    else:
        with pytest.raises(control.ProcessControlError) as caught:
            daemon._verify_root_identity()
        assert caught.value.reason == "control_root_replaced"


def test_daemon_rejects_unavailable_root_identity_adapter() -> None:
    with pytest.raises(control.ProcessControlError) as caught:
        _daemon(expected_root_identity=_root_identity())._verify_root_identity()

    assert caught.value.reason == "control_root_identity_unavailable"


class _FakeListener:
    def __init__(self, *, bind_error: BaseException | None = None) -> None:
        self.bind_error = bind_error
        self.events: list[object] = []

    def bind(self, path: str) -> None:
        self.events.append(("bind", path))
        if self.bind_error is not None:
            raise self.bind_error

    def listen(self, backlog: int) -> None:
        self.events.append(("listen", backlog))

    def close(self) -> None:
        self.events.append("close")


def test_bind_rejects_double_bind_and_invalid_listener() -> None:
    already_bound = _daemon()
    already_bound._listener = object()
    with pytest.raises(control.ProcessControlError) as duplicate:
        already_bound.bind_and_mark_ready()

    invalid = _daemon(socket_factory=lambda _family, _kind: SimpleNamespace(bind=1))
    with pytest.raises(control.ProcessControlError) as malformed:
        invalid.bind_and_mark_ready()

    assert duplicate.value.reason == "supervisor_listener_already_bound"
    assert malformed.value.reason == "control_socket_invalid"


def test_bind_failure_before_ownership_needs_no_socket_cleanup() -> None:
    listener = _FakeListener(bind_error=RuntimeError("synthetic bind failure"))
    daemon = _daemon(socket_factory=lambda _family, _kind: listener)

    with pytest.raises(RuntimeError, match="synthetic bind failure"):
        daemon.bind_and_mark_ready()

    assert listener.events[-1] == "close"


def test_bound_socket_cleanup_fails_closed_without_unlink_adapter() -> None:
    listener = _FakeListener()
    filesystem = SimpleNamespace(
        chmod_socket=lambda _path, _mode: (_ for _ in ()).throw(
            RuntimeError("synthetic chmod failure")
        )
    )
    daemon = _daemon(
        filesystem=filesystem,
        socket_factory=lambda _family, _kind: listener,
    )

    with pytest.raises(control.ProcessControlError) as caught:
        daemon.bind_and_mark_ready()

    assert caught.value.reason == "control_socket_cleanup_unavailable"


def test_serve_once_rejects_unbound_invalid_listener_or_invalid_core(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(control.ProcessControlError) as unbound:
        _daemon().serve_once()

    invalid_listener = _daemon()
    invalid_listener._listener = SimpleNamespace(accept=1)
    with pytest.raises(control.ProcessControlError) as malformed:
        invalid_listener.serve_once()

    connection_events: list[str] = []
    connection = SimpleNamespace(close=lambda: connection_events.append("close"))
    invalid_core = _daemon(core=object())
    invalid_core._listener = SimpleNamespace(accept=lambda: (connection, None))
    monkeypatch.setattr(supervisor, "read_wire_frame", lambda _connection: b"frame")
    with pytest.raises(control.ProcessControlError) as core_error:
        invalid_core.serve_once()

    assert unbound.value.reason == "supervisor_listener_not_bound"
    assert malformed.value.reason == "control_socket_invalid"
    assert core_error.value.reason == "supervisor_core_invalid"
    assert connection_events == ["close"]


def test_close_handles_absent_cleanup_hooks_and_missing_socket_identity() -> None:
    no_listener = _daemon()
    no_listener.close()

    close_events: list[str] = []
    no_unlink = _daemon()
    no_unlink._listener = SimpleNamespace(close=lambda: close_events.append("close"))
    no_unlink.close()

    missing_identity = _daemon(
        filesystem=SimpleNamespace(unlink_socket=lambda *_a, **_k: None)
    )
    missing_identity._listener = object()
    with pytest.raises(control.ProcessControlError) as caught:
        missing_identity.close()

    assert close_events == ["close"]
    assert caught.value.reason == "control_socket_identity_unavailable"


def test_close_unlinks_only_the_owned_socket_identity() -> None:
    unlink_calls: list[tuple[object, ...]] = []
    filesystem = SimpleNamespace(
        unlink_socket=lambda path, *, owner_uid, expected_identity: unlink_calls.append(
            (path, owner_uid, expected_identity)
        )
    )
    daemon = _daemon(filesystem=filesystem)
    identity = control.RootIdentity(
        device=7,
        inode=22,
        owner_uid=_OWNER_UID,
        mode=stat.S_IFSOCK | 0o600,
    )
    daemon._listener = object()
    daemon._owned_socket_identity = identity

    daemon.close()

    assert unlink_calls == [(_paths().socket, _OWNER_UID, identity)]


class _FakePopen:
    def __init__(self) -> None:
        self.returncode: int | None = None
        self.actions: list[object] = []

    def poll(self) -> int | None:
        self.actions.append("poll")
        return self.returncode

    def terminate(self) -> None:
        self.actions.append("terminate")

    def wait(self, *, timeout: int) -> int:
        self.actions.append(("wait", timeout))
        self.returncode = 0
        return 0

    def kill(self) -> None:
        self.actions.append("kill")


def test_popen_owned_process_delegates_and_closes_log_after_exit() -> None:
    process = _FakePopen()
    log = SimpleNamespace(closed=False)

    def close_log() -> None:
        log.closed = True

    log.close = close_log
    owned = supervisor._PopenOwnedProcess(process, log)

    assert owned.poll() is None
    owned.terminate()
    owned.kill()
    assert owned.wait(3) == 0
    assert log.closed is True


def test_popen_owned_process_tolerates_log_without_close() -> None:
    supervisor._PopenOwnedProcess(_FakePopen(), object())._close_log()


@pytest.mark.parametrize(
    ("argv", "log_path"),
    (
        ((), Path("/private/tmp/server.log")),
        (("python",), Path("/private/tmp/server.log")),
        (("/usr/bin/python3",), Path("relative.log")),
        (("/usr/bin/python3", ""), Path("/private/tmp/server.log")),
    ),
)
def test_server_process_factory_rejects_invalid_specs(
    argv: tuple[str, ...],
    log_path: Path,
) -> None:
    with pytest.raises(control.ProcessControlError) as caught:
        supervisor.ServerProcessFactory(
            argv=argv,
            environment={},
            log_path=log_path,
        )

    assert caught.value.reason == "supervisor_process_spec_invalid"


def test_server_process_factory_rejects_role_before_opening_log(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    open_calls: list[object] = []
    monkeypatch.setattr(
        Path,
        "open",
        lambda *_args, **_kwargs: open_calls.append("open"),
    )
    factory = supervisor.ServerProcessFactory(
        argv=("/usr/bin/python3",),
        environment={},
        log_path=Path("/private/tmp/synthetic-server.log"),
        popen=lambda *_args, **_kwargs: pytest.fail("popen must not be called"),
    )

    with pytest.raises(control.ProcessControlError) as caught:
        factory("other_role", {"strip_tls": False})

    assert caught.value.reason == "supervisor_process_spec_invalid"
    assert open_calls == []


def test_server_process_factory_injects_tls_mode_into_copied_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    base_environment = {"UNCHANGED": "yes"}
    calls: list[tuple[object, dict[str, object]]] = []
    process = _FakePopen()
    log = SimpleNamespace(closed=False)
    log.close = lambda: setattr(log, "closed", True)
    monkeypatch.setattr(Path, "open", lambda *_args, **_kwargs: log)

    def fake_popen(argv: object, **kwargs: object) -> _FakePopen:
        calls.append((argv, kwargs))
        return process

    factory = supervisor.ServerProcessFactory(
        argv=("/usr/bin/python3", "-m", "synthetic_server"),
        environment=base_environment,
        log_path=Path("/private/tmp/synthetic-server.log"),
        popen=fake_popen,  # type: ignore[arg-type]
    )

    owned = factory(supervisor.SERVER_ROLE, {"strip_tls": True})
    owned.wait(1)

    assert calls[0][1]["env"] == {
        "UNCHANGED": "yes",
        "CYBRIK_UAT_D2_STRIP_TLS_EXTENSION": "true",
    }
    assert calls[0][1]["shell"] is False
    assert base_environment == {"UNCHANGED": "yes"}
    assert log.closed is True


def test_server_process_factory_closes_log_when_popen_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    log = SimpleNamespace(closed=False)
    log.close = lambda: setattr(log, "closed", True)
    monkeypatch.setattr(Path, "open", lambda *_args, **_kwargs: log)
    factory = supervisor.ServerProcessFactory(
        argv=("/usr/bin/python3",),
        environment={},
        log_path=tmp_path / "server.log",
        popen=lambda *_args, **_kwargs: (_ for _ in ()).throw(
            RuntimeError("synthetic popen failure")
        ),
    )

    with pytest.raises(RuntimeError, match="synthetic popen failure"):
        factory(supervisor.SERVER_ROLE, {"strip_tls": False})

    assert log.closed is True


def test_reap_launched_supervisor_returns_for_exited_handle() -> None:
    process = _FakeOwnedProcess(poll_result=0)

    supervisor.reap_launched_supervisor(process)

    assert process.actions == ["poll"]


def test_reap_launched_supervisor_fails_after_bounded_kill_timeout() -> None:
    process = _FakeOwnedProcess(
        poll_result=None,
        wait_results=(
            subprocess.TimeoutExpired("synthetic", 15),
            subprocess.TimeoutExpired("synthetic", 5),
        ),
    )

    with pytest.raises(control.ProcessControlError) as caught:
        supervisor.reap_launched_supervisor(process)

    assert caught.value.reason == "supervisor_process_unreaped"
    assert process.actions[-1] == ("wait", control.KILL_WAIT_SECONDS)
