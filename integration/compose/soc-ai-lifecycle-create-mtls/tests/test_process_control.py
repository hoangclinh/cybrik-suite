"""RED contracts for stable cross-invocation D2 process control.

Every test is synthetic.  The transport and child process are in-memory fakes;
the target must never start a process, open a socket, inspect a live PID, touch
Docker, or access the network.  A persistent supervisor may control only child
handles that it owns and has not reaped.  Numeric PID records and command-text
inspection are deliberately outside the authority model.
"""

from __future__ import annotations

import ast
import importlib
import json
import socket
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from types import ModuleType
from typing import Final

import pytest

from cybrik_suite_uat_mtls import harness

_CONTROL_MODULE: Final = "cybrik_suite_uat_mtls.process_control"
_SUPERVISOR_MODULE: Final = "cybrik_suite_uat_mtls.process_supervisor"
_AUTHORIZATION_SHA256: Final = "a" * 64
_RUN_ID: Final = "b" * 32
_CAPABILITY: Final = b"c" * 32
_OTHER_CAPABILITY: Final = b"d" * 32
_OWNER_UID: Final = 501


def _load_modules() -> tuple[ModuleType, ModuleType]:
    """Load the prospective modules with one stable RED for missing code."""

    try:
        control = importlib.import_module(_CONTROL_MODULE)
        supervisor = importlib.import_module(_SUPERVISOR_MODULE)
    except ModuleNotFoundError as exc:
        if exc.name not in {_CONTROL_MODULE, _SUPERVISOR_MODULE}:
            raise
        pytest.fail(
            f"D2 stable process-control implementation is absent: {exc.name}",
            pytrace=False,
        )
    return control, supervisor


def _binding(control: ModuleType) -> object:
    return control.ControlBinding(
        authorization_sha256=_AUTHORIZATION_SHA256,
        run_id=_RUN_ID,
        generation=1,
        owner_uid=_OWNER_UID,
    )


class _FakeOwnedProcess:
    """Popen-shaped child handle retained by exactly one fake supervisor."""

    def __init__(self) -> None:
        self.returncode: int | None = None
        self.actions: list[object] = []

    def poll(self) -> int | None:
        self.actions.append("poll")
        return self.returncode

    def terminate(self) -> None:
        self.actions.append("terminate")

    def wait(self, timeout: int) -> int:
        self.actions.append(("wait", timeout))
        self.returncode = 0
        return self.returncode

    def kill(self) -> None:
        self.actions.append("kill")


class _FakeProcessFactory:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []
        self.children: list[_FakeOwnedProcess] = []

    def __call__(self, role: str, parameters: dict[str, object]) -> _FakeOwnedProcess:
        child = _FakeOwnedProcess()
        self.calls.append((role, dict(parameters)))
        self.children.append(child)
        return child


class _FakeTransport:
    """Authenticated round trip without constructing an operating-system socket."""

    def __init__(
        self,
        core: object,
        *,
        server_uid: int = _OWNER_UID,
        client_uid: int = _OWNER_UID,
    ) -> None:
        self.core = core
        self.peer_uid = server_uid
        self.client_uid = client_uid
        self.frames: list[bytes] = []

    def exchange(self, frame: bytes) -> bytes:
        self.frames.append(frame)
        return self.core.handle_frame(frame, peer_uid=self.client_uid)


def _core_and_client(
    control: ModuleType,
    supervisor: ModuleType,
) -> tuple[object, object, _FakeProcessFactory, _FakeTransport]:
    binding = _binding(control)
    factory = _FakeProcessFactory()
    core = supervisor.SupervisorCore(
        binding=binding,
        capability=_CAPABILITY,
        process_factory=factory,
        receipt_writer=lambda _receipt: None,
    )
    transport = _FakeTransport(core)
    client = control.ControlClient(
        binding=binding,
        capability=_CAPABILITY,
        transport=transport,
    )
    return core, client, factory, transport


def test_process_control_modules_are_import_inert(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Importing the control plane must perform no process or socket I/O."""

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("process-control import performed runtime I/O")

    monkeypatch.setattr(subprocess, "Popen", forbidden)
    monkeypatch.setattr(socket, "socket", forbidden)
    sys.modules.pop(_SUPERVISOR_MODULE, None)
    sys.modules.pop(_CONTROL_MODULE, None)

    _load_modules()


def test_numeric_pid_and_ps_are_never_process_control_authority() -> None:
    """No recovery path may convert an inspected numeric PID into a signal."""

    control, supervisor = _load_modules()
    paths = (
        Path(harness.__file__).resolve(),
        Path(control.__file__).resolve(),
        Path(supervisor.__file__).resolve(),
    )
    forbidden_symbols = {
        "_PROCESS_INSPECTION_EXECUTABLE",
        "_record_pid",
        "_stop_recorded_process",
    }
    for path in paths:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source)
        names = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}
        attributes = {
            node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)
        }
        assert forbidden_symbols.isdisjoint(names | attributes), path
        assert "os.kill" not in source, path
        assert '"/bin/ps"' not in source, path
        assert "'/bin/ps'" not in source, path


def test_two_authenticated_invocations_control_one_supervisor_owned_child() -> None:
    """A later client stops the exact child handle created by an earlier client."""

    control, supervisor = _load_modules()
    core, first_client, factory, _ = _core_and_client(control, supervisor)
    second_client = control.ControlClient(
        binding=_binding(control),
        capability=_CAPABILITY,
        transport=_FakeTransport(core),
    )

    first_client.start_server(strip_tls=False, request_id="start-1")
    second_client.stop_server(request_id="stop-1")

    assert factory.calls == [("ai_server", {"strip_tls": False})]
    assert factory.children[0].actions == [
        "poll",
        "terminate",
        ("wait", 15),
    ]


def test_identical_request_id_is_idempotent_and_payload_drift_is_refused() -> None:
    control, supervisor = _load_modules()
    _, client, factory, _ = _core_and_client(control, supervisor)

    first = client.start_server(strip_tls=True, request_id="start-stable")
    replay = client.start_server(strip_tls=True, request_id="start-stable")

    assert replay == first
    assert factory.calls == [("ai_server", {"strip_tls": True})]
    with pytest.raises(control.ProcessControlError) as caught:
        client.start_server(strip_tls=False, request_id="start-stable")
    assert caught.value.reason == "request_id_payload_mismatch"
    assert len(factory.calls) == 1


def test_bad_hmac_and_wrong_peer_uid_fail_before_dispatch() -> None:
    control, supervisor = _load_modules()
    binding = _binding(control)
    factory = _FakeProcessFactory()
    core = supervisor.SupervisorCore(
        binding=binding,
        capability=_CAPABILITY,
        process_factory=factory,
        receipt_writer=lambda _receipt: None,
    )
    wrong_key_frame = control.encode_request(
        binding=binding,
        capability=_OTHER_CAPABILITY,
        request_id="bad-key",
        action="start_server",
        parameters={"strip_tls": False},
    )
    valid_frame = control.encode_request(
        binding=binding,
        capability=_CAPABILITY,
        request_id="bad-peer",
        action="start_server",
        parameters={"strip_tls": False},
    )

    with pytest.raises(control.ProcessControlError) as bad_hmac:
        core.handle_frame(wrong_key_frame, peer_uid=_OWNER_UID)
    assert bad_hmac.value.reason == "frame_authentication_failed"
    with pytest.raises(control.ProcessControlError) as bad_peer:
        core.handle_frame(valid_frame, peer_uid=_OWNER_UID + 1)
    assert bad_peer.value.reason == "peer_uid_mismatch"
    assert factory.calls == []


def test_signed_frames_are_canonical_and_rejected_when_oversized() -> None:
    control, _ = _load_modules()
    left = control.sign_frame({"z": 1, "a": 2}, _CAPABILITY)
    right = control.sign_frame({"a": 2, "z": 1}, _CAPABILITY)

    assert left == right
    assert len(left) <= control.MAX_FRAME_BYTES
    parsed = json.loads(left)
    assert left == json.dumps(parsed, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )
    with pytest.raises(control.ProcessControlError) as oversized:
        control.sign_frame(
            {"payload": "x" * (control.MAX_FRAME_BYTES + 1)},
            _CAPABILITY,
        )
    assert oversized.value.reason == "frame_too_large"


class _TeardownClient:
    def __init__(self, events: list[str], *, crash: bool = False) -> None:
        self.events = events
        self.crash = crash

    def stop_all(self, *, request_id: str) -> None:
        del request_id
        self.events.append("stop_all")
        if self.crash:
            raise ConnectionError("synthetic supervisor crash")

    def shutdown(self, *, request_id: str) -> None:
        del request_id
        self.events.append("shutdown")


def _record(
    events: list[str], name: str, result: object = None
) -> Callable[[], object]:
    def callback() -> object:
        events.append(name)
        return result

    return callback


def test_supervisor_crash_without_receipt_prevents_all_destructive_cleanup() -> None:
    control, _ = _load_modules()
    events: list[str] = []

    with pytest.raises(control.ProcessControlError) as caught:
        control.coordinated_teardown(
            client=_TeardownClient(events, crash=True),
            load_shutdown_receipt=_record(events, "load_receipt", None),
            validate_shutdown_receipt=lambda _receipt: False,
            stop_store=_record(events, "stop_store"),
            destroy_runtime=_record(events, "destroy_runtime"),
            remove_control_root=_record(events, "remove_control_root"),
        )

    assert caught.value.reason == "stable_process_authority_lost"
    assert events == ["stop_all", "load_receipt"]


def test_teardown_order_requires_verified_shutdown_before_resource_deletion() -> None:
    control, _ = _load_modules()
    events: list[str] = []
    receipt = object()

    def validate(candidate: object) -> bool:
        events.append("validate_receipt")
        return candidate is receipt

    control.coordinated_teardown(
        client=_TeardownClient(events),
        load_shutdown_receipt=_record(events, "load_receipt", receipt),
        validate_shutdown_receipt=validate,
        stop_store=_record(events, "stop_store"),
        destroy_runtime=_record(events, "destroy_runtime"),
        remove_control_root=_record(events, "remove_control_root"),
    )

    assert events == [
        "stop_all",
        "shutdown",
        "load_receipt",
        "validate_receipt",
        "stop_store",
        "destroy_runtime",
        "remove_control_root",
    ]


def test_verify_absent_requires_control_root_absence(tmp_path: Path) -> None:
    control, _ = _load_modules()
    control_root = tmp_path / "cybrik-d2-ctl-synthetic"

    control_root.mkdir()
    assert control.control_root_absent(control_root) is False
    control_root.rmdir()
    assert control.control_root_absent(control_root) is True
    control_root.symlink_to(tmp_path / "missing-control-root", target_is_directory=True)
    assert control.control_root_absent(control_root) is False

    harness_source = Path(harness.__file__).read_text(encoding="utf-8")
    assert '"control_root_absent"' in harness_source
    assert "process_control.control_root_absent" in harness_source
