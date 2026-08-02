"""Fake-only RED contracts for portable D2 Unix control and durable state."""

from __future__ import annotations

import importlib
import json
import socket
import stat
import subprocess
import sys
from dataclasses import dataclass, replace
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Final

import pytest

_CONTROL_MODULE: Final = "cybrik_suite_uat_mtls.process_control"
_SUPERVISOR_MODULE: Final = "cybrik_suite_uat_mtls.process_supervisor"
_AUTHORIZATION_SHA256: Final = "a" * 64
_RUN_ID: Final = "b" * 32
_CAPABILITY: Final = b"c" * 32
_OTHER_CAPABILITY: Final = b"d" * 32
_OWNER_UID: Final = 501


def _modules() -> tuple[ModuleType, ModuleType]:
    return (
        importlib.import_module(_CONTROL_MODULE),
        importlib.import_module(_SUPERVISOR_MODULE),
    )


def _binding(control: ModuleType, **changes: object) -> object:
    values: dict[str, object] = {
        "authorization_sha256": _AUTHORIZATION_SHA256,
        "run_id": _RUN_ID,
        "generation": 1,
        "owner_uid": _OWNER_UID,
    }
    values.update(changes)
    return control.ControlBinding(**values)


@dataclass(frozen=True)
class _Identity:
    device: int
    inode: int
    owner_uid: int
    mode: int


@dataclass(frozen=True)
class _StableRead:
    data: bytes
    before: _Identity
    after: _Identity


class _FakeFileSystem:
    def __init__(
        self,
        *,
        owner_uid: int = _OWNER_UID,
        root_mode: int = stat.S_IFDIR | 0o700,
    ) -> None:
        self.events: list[tuple[object, ...]] = []
        self.root_identity = _Identity(7, 11, owner_uid, root_mode)
        self.root_handle = object()
        self.entries: dict[str, tuple[bytes, _Identity]] = {}
        self.read_replacement: _Identity | None = None
        self.socket_identities: list[_Identity] = [
            _Identity(7, 41, owner_uid, stat.S_IFSOCK | 0o600)
        ]

    def mkdir_open(
        self,
        path: Path,
        *,
        mode: int,
        exclusive: bool,
        nofollow: bool,
    ) -> object:
        self.events.append(("mkdir_open", path, mode, exclusive, nofollow))
        return self.root_handle

    def stat_handle(self, handle: object) -> _Identity:
        assert handle is self.root_handle
        self.events.append(("stat_handle", handle))
        return self.root_identity

    def create_at(
        self,
        handle: object,
        name: str,
        data: bytes,
        *,
        mode: int,
        exclusive: bool,
        nofollow: bool,
    ) -> None:
        assert handle is self.root_handle
        self.events.append(("create_at", name, data, mode, exclusive, nofollow))
        if name in self.entries:
            raise FileExistsError(name)
        self.entries[name] = (
            bytes(data),
            _Identity(7, 100 + len(self.entries), _OWNER_UID, stat.S_IFREG | mode),
        )

    def write_atomic_at(
        self,
        handle: object,
        name: str,
        data: bytes,
        *,
        mode: int,
        nofollow: bool,
        fsync_file: bool,
        fsync_directory: bool,
    ) -> None:
        assert handle is self.root_handle
        self.events.append(
            (
                "write_atomic_at",
                name,
                data,
                mode,
                nofollow,
                fsync_file,
                fsync_directory,
            )
        )
        self.entries[name] = (
            bytes(data),
            _Identity(7, 100 + len(self.entries), _OWNER_UID, stat.S_IFREG | mode),
        )

    def read_at_stable(
        self,
        handle: object,
        name: str,
        *,
        max_bytes: int,
        mode: int,
        owner_uid: int,
        nofollow: bool,
    ) -> _StableRead:
        assert handle is self.root_handle
        self.events.append(
            ("read_at_stable", name, max_bytes, mode, owner_uid, nofollow)
        )
        data, identity = self.entries[name]
        after = identity if self.read_replacement is None else self.read_replacement
        return _StableRead(data[: max_bytes + 1], identity, after)

    def stat_socket(self, path: Path, *, nofollow: bool) -> _Identity:
        self.events.append(("stat_socket", path, nofollow))
        if len(self.socket_identities) > 1:
            return self.socket_identities.pop(0)
        return self.socket_identities[0]

    def chmod_socket(self, path: Path, mode: int) -> None:
        self.events.append(("chmod_socket", path, mode))


class _FakeConnectedSocket:
    def __init__(self, incoming: bytes = b"") -> None:
        self.incoming = bytearray(incoming)
        self.sent = bytearray()

    def connect(self, path: str) -> None:
        del path

    def sendall(self, payload: bytes) -> None:
        self.sent.extend(payload)

    def recv(self, count: int) -> bytes:
        result = bytes(self.incoming[:count])
        del self.incoming[:count]
        return result


class _FakeListener:
    def __init__(self, connection: _FakeConnectedSocket) -> None:
        self.connection = connection
        self.bound_to: str | None = None

    def bind(self, path: str) -> None:
        self.bound_to = path

    def listen(self, backlog: int) -> None:
        del backlog

    def accept(self) -> tuple[_FakeConnectedSocket, str]:
        return self.connection, ""


class _SocketFactory:
    def __init__(self, result: object) -> None:
        self.result = result
        self.calls: list[tuple[int, int]] = []

    def __call__(self, family: int, kind: int) -> object:
        self.calls.append((family, kind))
        return self.result


class _FakeCore:
    def __init__(self, response: bytes) -> None:
        self.response = response
        self.calls: list[tuple[bytes, int]] = []

    def handle_frame(self, frame: bytes, *, peer_uid: int) -> bytes:
        self.calls.append((frame, peer_uid))
        return self.response


def _supervisor_core(
    control: ModuleType,
    supervisor: ModuleType,
    *,
    replay_cache_capacity: int | None = None,
) -> tuple[object, list[tuple[str, dict[str, object]]]]:
    calls: list[tuple[str, dict[str, object]]] = []

    def factory(role: str, parameters: dict[str, object]) -> object:
        calls.append((role, dict(parameters)))
        return SimpleNamespace(
            poll=lambda: 0,
            terminate=lambda: pytest.fail("exited child was signalled"),
            wait=lambda _timeout: 0,
            kill=lambda: pytest.fail("exited child was killed"),
        )

    kwargs: dict[str, object] = {
        "binding": _binding(control),
        "capability": _CAPABILITY,
        "process_factory": factory,
        "receipt_writer": lambda _receipt: None,
    }
    if replay_cache_capacity is not None:
        kwargs["replay_cache_capacity"] = replay_cache_capacity
    return supervisor.SupervisorCore(**kwargs), calls


def test_transport_modules_import_without_runtime_io(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("process-control import performed runtime I/O")

    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(subprocess, "Popen", forbidden)
    monkeypatch.setattr(Path, "mkdir", forbidden)
    monkeypatch.setattr(Path, "write_bytes", forbidden)
    sys.modules.pop(_SUPERVISOR_MODULE, None)
    sys.modules.pop(_CONTROL_MODULE, None)

    _modules()


def test_control_paths_are_deterministic_bounded_and_disjoint(tmp_path: Path) -> None:
    control, _ = _modules()
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-transport"

    first = control.derive_control_paths(runtime_root, _AUTHORIZATION_SHA256)
    second = control.derive_control_paths(runtime_root, _AUTHORIZATION_SHA256)
    changed = control.derive_control_paths(runtime_root, "e" * 64)

    assert first == second and first != changed
    assert first.root.parent == runtime_root.parent and first.root != runtime_root
    assert first.socket.parent == first.root
    assert len(str(first.socket).encode()) <= control.MAX_UNIX_SOCKET_PATH_BYTES


def test_socket_path_overflow_fails_before_any_filesystem_mutation() -> None:
    control, _ = _modules()
    filesystem = _FakeFileSystem()
    runtime_root = Path("/") / ("very-long-parent-" + "x" * 150) / "runtime"

    with pytest.raises(control.ProcessControlError) as caught:
        control.ControlStore(filesystem=filesystem).create(
            paths=control.derive_control_paths(runtime_root, _AUTHORIZATION_SHA256),
            binding=_binding(control),
            random_bytes=lambda count: b"r" * count,
        )

    assert caught.value.reason == "control_socket_path_too_long"
    assert filesystem.events == []


@pytest.mark.parametrize(
    ("owner_uid", "root_mode", "reason"),
    (
        (_OWNER_UID + 1, stat.S_IFDIR | 0o700, "control_root_owner_mismatch"),
        (_OWNER_UID, stat.S_IFDIR | 0o750, "control_root_mode_mismatch"),
        (_OWNER_UID, stat.S_IFLNK | 0o700, "control_root_not_directory"),
    ),
)
def test_control_root_identity_is_descriptor_bound_before_leaf_creation(
    tmp_path: Path,
    owner_uid: int,
    root_mode: int,
    reason: str,
) -> None:
    control, _ = _modules()
    filesystem = _FakeFileSystem(owner_uid=owner_uid, root_mode=root_mode)
    paths = control.derive_control_paths(
        tmp_path / "cybrik-uat-d2-runtime-root-check", _AUTHORIZATION_SHA256
    )

    with pytest.raises(control.ProcessControlError) as caught:
        control.ControlStore(filesystem=filesystem).create(
            paths=paths,
            binding=_binding(control),
            random_bytes=lambda count: b"r" * count,
        )

    assert caught.value.reason == reason
    assert [event[0] for event in filesystem.events] == [
        "mkdir_open",
        "stat_handle",
    ]
    assert filesystem.events[0][2:] == (0o700, True, True)


def test_capability_is_exact_exclusive_and_stably_read(tmp_path: Path) -> None:
    control, _ = _modules()
    filesystem = _FakeFileSystem()
    paths = control.derive_control_paths(
        tmp_path / "cybrik-uat-d2-runtime-capability", _AUTHORIZATION_SHA256
    )
    counts: list[int] = []

    def entropy(count: int) -> bytes:
        counts.append(count)
        return _CAPABILITY

    store = control.ControlStore(filesystem=filesystem)
    material = store.create(
        paths=paths, binding=_binding(control), random_bytes=entropy
    )
    loaded = store.load(paths=paths, expected_binding=_binding(control))

    assert counts == [32]
    assert material.capability == loaded.capability == _CAPABILITY
    capability_create = next(
        event
        for event in filesystem.events
        if event[:2] == ("create_at", paths.capability.name)
    )
    assert capability_create[3:] == (0o600, True, True)
    capability_read = next(
        event
        for event in filesystem.events
        if event[:2] == ("read_at_stable", paths.capability.name)
    )
    assert capability_read[2:] == (32, 0o600, _OWNER_UID, True)

    filesystem.read_replacement = _Identity(7, 999, _OWNER_UID, stat.S_IFREG | 0o600)
    with pytest.raises(control.ProcessControlError) as replaced:
        store.load(paths=paths, expected_binding=_binding(control))
    assert replaced.value.reason == "control_leaf_replaced"


def test_persisted_binding_is_canonical_hmac_and_root_identity_bound(
    tmp_path: Path,
) -> None:
    control, _ = _modules()
    filesystem = _FakeFileSystem()
    paths = control.derive_control_paths(
        tmp_path / "cybrik-uat-d2-runtime-binding", _AUTHORIZATION_SHA256
    )
    binding = _binding(control)
    store = control.ControlStore(filesystem=filesystem)
    material = store.create(
        paths=paths,
        binding=binding,
        random_bytes=lambda _count: _CAPABILITY,
    )
    binding_bytes = filesystem.entries[paths.binding.name][0]
    parsed = json.loads(binding_bytes)

    assert binding_bytes == json.dumps(
        parsed, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    assert parsed["body"] == {
        "authorization_sha256": _AUTHORIZATION_SHA256,
        "generation": 1,
        "owner_uid": _OWNER_UID,
        "root_device": filesystem.root_identity.device,
        "root_inode": filesystem.root_identity.inode,
        "run_id": _RUN_ID,
        "version": control.BINDING_RECORD_VERSION,
    }
    assert (
        control.verify_binding_record(
            binding_bytes,
            capability=_CAPABILITY,
            expected_binding=binding,
            expected_root_identity=material.root_identity,
        )
        == material.persisted_binding
    )
    with pytest.raises(control.ProcessControlError):
        control.verify_binding_record(
            binding_bytes,
            capability=_OTHER_CAPABILITY,
            expected_binding=binding,
            expected_root_identity=material.root_identity,
        )


def test_unix_transport_verifies_peer_binding_and_response_hmac(
    tmp_path: Path,
) -> None:
    control, _ = _modules()
    binding = _binding(control)
    paths = control.derive_control_paths(
        tmp_path / "cybrik-uat-d2-runtime-transport", _AUTHORIZATION_SHA256
    )
    request = control.encode_request(
        binding=binding,
        capability=_CAPABILITY,
        request_id="transport-1",
        action="stop_all",
        parameters={},
    )
    response = control.encode_response(
        binding=binding,
        capability=_CAPABILITY,
        request_id="transport-1",
        action="stop_all",
        result={"status": "stopped_all"},
    )
    connection = _FakeConnectedSocket(control.encode_wire_frame(response))
    factory = _SocketFactory(connection)
    filesystem = _FakeFileSystem()
    transport = control.UnixControlTransport(
        paths=paths,
        binding=binding,
        capability=_CAPABILITY,
        filesystem=filesystem,
        socket_factory=factory,
        peer_euid_reader=lambda _socket: _OWNER_UID,
    )

    assert transport.exchange(request) == response
    assert connection.sent == control.encode_wire_frame(request)

    bad_peer = control.UnixControlTransport(
        paths=paths,
        binding=binding,
        capability=_CAPABILITY,
        filesystem=_FakeFileSystem(),
        socket_factory=_SocketFactory(
            _FakeConnectedSocket(control.encode_wire_frame(response))
        ),
        peer_euid_reader=lambda _socket: _OWNER_UID + 1,
    )
    with pytest.raises(control.ProcessControlError) as peer_error:
        bad_peer.exchange(request)
    assert peer_error.value.reason == "peer_uid_mismatch"

    bad_response = control.encode_response(
        binding=binding,
        capability=_OTHER_CAPABILITY,
        request_id="transport-1",
        action="stop_all",
        result={"status": "stopped_all"},
    )
    connection.incoming.extend(control.encode_wire_frame(bad_response))
    with pytest.raises(control.ProcessControlError) as hmac_error:
        transport.exchange(request)
    assert hmac_error.value.reason == "frame_authentication_failed"


def test_socket_path_swap_is_rejected_even_with_a_parseable_response(
    tmp_path: Path,
) -> None:
    control, _ = _modules()
    binding = _binding(control)
    paths = control.derive_control_paths(
        tmp_path / "cybrik-uat-d2-runtime-swap", _AUTHORIZATION_SHA256
    )
    response = control.encode_response(
        binding=binding,
        capability=_CAPABILITY,
        request_id="swap-1",
        action="stop_all",
        result={},
    )
    filesystem = _FakeFileSystem()
    filesystem.socket_identities = [
        _Identity(7, 41, _OWNER_UID, stat.S_IFSOCK | 0o600),
        _Identity(7, 42, _OWNER_UID, stat.S_IFSOCK | 0o600),
    ]
    transport = control.UnixControlTransport(
        paths=paths,
        binding=binding,
        capability=_CAPABILITY,
        filesystem=filesystem,
        socket_factory=_SocketFactory(
            _FakeConnectedSocket(control.encode_wire_frame(response))
        ),
        peer_euid_reader=lambda _socket: _OWNER_UID,
    )
    request = control.encode_request(
        binding=binding,
        capability=_CAPABILITY,
        request_id="swap-1",
        action="stop_all",
        parameters={},
    )

    with pytest.raises(control.ProcessControlError) as caught:
        transport.exchange(request)
    assert caught.value.reason == "control_socket_replaced"


def test_supervisor_daemon_uses_only_bounded_mode_0600_unix_transport(
    tmp_path: Path,
) -> None:
    control, supervisor = _modules()
    binding = _binding(control)
    paths = control.derive_control_paths(
        tmp_path / "cybrik-uat-d2-runtime-daemon", _AUTHORIZATION_SHA256
    )
    request = control.encode_request(
        binding=binding,
        capability=_CAPABILITY,
        request_id="daemon-1",
        action="stop_all",
        parameters={},
    )
    response = control.encode_response(
        binding=binding,
        capability=_CAPABILITY,
        request_id="daemon-1",
        action="stop_all",
        result={"status": "stopped_all"},
    )
    connection = _FakeConnectedSocket(control.encode_wire_frame(request))
    listener = _FakeListener(connection)
    factory = _SocketFactory(listener)
    filesystem = _FakeFileSystem()
    core = _FakeCore(response)
    daemon = supervisor.SupervisorDaemon(
        core=core,
        binding=binding,
        capability=_CAPABILITY,
        paths=paths,
        filesystem=filesystem,
        socket_factory=factory,
        peer_euid_reader=lambda _socket: _OWNER_UID,
        ready_writer=lambda _record: None,
    )

    daemon.bind_and_mark_ready()
    daemon.serve_once()

    assert factory.calls == [(socket.AF_UNIX, socket.SOCK_STREAM)]
    assert listener.bound_to == str(paths.socket)
    assert ("chmod_socket", paths.socket, 0o600) in filesystem.events
    assert core.calls == [(request, _OWNER_UID)]
    assert connection.sent == control.encode_wire_frame(response)

    oversized = _FakeConnectedSocket((control.MAX_FRAME_BYTES + 1).to_bytes(4, "big"))
    bounded_core = _FakeCore(response)
    bounded_daemon = supervisor.SupervisorDaemon(
        core=bounded_core,
        binding=binding,
        capability=_CAPABILITY,
        paths=paths,
        filesystem=_FakeFileSystem(),
        socket_factory=_SocketFactory(_FakeListener(oversized)),
        peer_euid_reader=lambda _socket: _OWNER_UID,
        ready_writer=lambda _record: None,
    )
    bounded_daemon.bind_and_mark_ready()
    with pytest.raises(control.ProcessControlError) as caught:
        bounded_daemon.serve_once()
    assert caught.value.reason == "frame_too_large"
    assert bounded_core.calls == []


def test_ready_and_shutdown_receipts_are_hmac_bound_and_durable(
    tmp_path: Path,
) -> None:
    control, _ = _modules()
    filesystem = _FakeFileSystem()
    paths = control.derive_control_paths(
        tmp_path / "cybrik-uat-d2-runtime-receipts", _AUTHORIZATION_SHA256
    )
    store = control.ControlStore(filesystem=filesystem)
    material = store.create(
        paths=paths,
        binding=_binding(control),
        random_bytes=lambda _count: _CAPABILITY,
    )

    ready = store.write_ready_receipt(material)
    shutdown = store.write_shutdown_receipt(
        material,
        {"all_children_reaped": True, "stopped": ["ai_server", "soc_client"]},
    )

    assert control.verify_ready_receipt(ready, material) is True
    assert control.verify_shutdown_receipt(shutdown, material) is True
    durable_writes = [
        event
        for event in filesystem.events
        if event[0] == "write_atomic_at"
        and event[1] in {paths.ready.name, paths.shutdown_receipt.name}
    ]
    assert len(durable_writes) == 2 and all(
        event[4:] == (True, True, True) for event in durable_writes
    )


class _LostAckClient:
    def __init__(self, events: list[str]) -> None:
        self.events = events

    def stop_all(self, *, request_id: str) -> None:
        del request_id
        self.events.append("stop_all")

    def shutdown(self, *, request_id: str) -> None:
        del request_id
        self.events.append("shutdown_ack_lost")
        raise ConnectionError("synthetic acknowledgement loss")


def test_lost_shutdown_ack_recovers_only_from_receipt_and_released_lock() -> None:
    control, _ = _modules()
    events: list[str] = []
    receipt = object()

    def record(name: str, value: object = None):  # type: ignore[no-untyped-def]
        def callback():  # type: ignore[no-untyped-def]
            events.append(name)
            return value

        return callback

    control.coordinated_teardown(
        client=_LostAckClient(events),
        load_shutdown_receipt=record("load_receipt", receipt),
        validate_shutdown_receipt=lambda candidate: candidate is receipt,
        liveness_lock_released=record("lock_released", True),
        stop_store=record("stop_store"),
        destroy_runtime=record("destroy_runtime"),
        remove_control_root=record("remove_control_root"),
    )

    assert events == [
        "stop_all",
        "shutdown_ack_lost",
        "load_receipt",
        "lock_released",
        "stop_store",
        "destroy_runtime",
        "remove_control_root",
    ]


@pytest.mark.parametrize("request_id", ("", "x" * 129, "bad/request", "snowman-☃"))
def test_server_rejects_invalid_request_id_before_cache_or_dispatch(
    request_id: str,
) -> None:
    control, supervisor = _modules()
    core, process_calls = _supervisor_core(control, supervisor)
    frame = control.sign_frame(
        {
            "action": "start_server",
            "binding": _binding(control).as_payload(),
            "kind": "request",
            "parameters": {"strip_tls": False},
            "request_id": request_id,
            "version": control.PROTOCOL_VERSION,
        },
        _CAPABILITY,
    )

    with pytest.raises(control.ProcessControlError) as caught:
        core.handle_frame(frame, peer_uid=_OWNER_UID)
    assert caught.value.reason == "request_id_invalid"
    assert core.cached_response_count == 0
    assert process_calls == []


def test_replay_identity_uses_verified_canonical_body_not_envelope_bytes() -> None:
    control, supervisor = _modules()
    core, process_calls = _supervisor_core(control, supervisor)
    canonical = control.encode_request(
        binding=_binding(control),
        capability=_CAPABILITY,
        request_id="canonical-replay",
        action="start_server",
        parameters={"strip_tls": False},
    )
    envelope = json.loads(canonical)
    noncanonical = json.dumps(envelope, indent=2, sort_keys=False).encode("utf-8")

    first = core.handle_frame(canonical, peer_uid=_OWNER_UID)
    replay = core.handle_frame(noncanonical, peer_uid=_OWNER_UID)

    assert replay == first
    assert process_calls == [("ai_server", {"strip_tls": False})]


@pytest.mark.parametrize(
    "response_binding",
    (
        {"generation": 2},
        {"authorization_sha256": "e" * 64},
        {"run_id": "f" * 32},
    ),
)
def test_response_replay_from_other_binding_is_refused(
    response_binding: dict[str, object],
) -> None:
    control, _ = _modules()
    binding = _binding(control)
    wrong_binding = replace(binding, **response_binding)
    response = control.encode_response(
        binding=wrong_binding,
        capability=_CAPABILITY,
        request_id="response-binding",
        action="stop_all",
        result={},
    )

    class Transport:
        peer_uid = _OWNER_UID

        def exchange(self, _frame: bytes) -> bytes:
            return response

    client = control.ControlClient(
        binding=binding,
        capability=_CAPABILITY,
        transport=Transport(),
    )
    with pytest.raises(control.ProcessControlError) as caught:
        client.stop_all(request_id="response-binding")
    assert caught.value.reason == "response_binding_mismatch"


def test_response_without_authenticated_binding_is_refused() -> None:
    control, _ = _modules()
    response = control.sign_frame(
        {
            "action": "stop_all",
            "kind": "response",
            "request_id": "response-missing-binding",
            "result": {},
            "version": control.PROTOCOL_VERSION,
        },
        _CAPABILITY,
    )

    transport = SimpleNamespace(exchange=lambda _frame: response)
    client = control.ControlClient(
        binding=_binding(control),
        capability=_CAPABILITY,
        transport=transport,
    )
    with pytest.raises(control.ProcessControlError) as caught:
        client.stop_all(request_id="response-missing-binding")
    assert caught.value.reason == "response_binding_mismatch"


def test_replay_cache_has_explicit_bound_or_fails_closed_at_capacity() -> None:
    control, supervisor = _modules()
    core, _ = _supervisor_core(control, supervisor, replay_cache_capacity=2)

    outcomes: list[str] = []
    for index in range(3):
        frame = control.encode_request(
            binding=_binding(control),
            capability=_CAPABILITY,
            request_id=f"bounded-{index}",
            action="stop_all",
            parameters={},
        )
        try:
            core.handle_frame(frame, peer_uid=_OWNER_UID)
            outcomes.append("accepted")
        except control.ProcessControlError as exc:
            assert exc.reason == "replay_cache_capacity_exhausted"
            outcomes.append("refused")

    assert core.cached_response_count <= 2
    assert outcomes in (
        ["accepted", "accepted", "accepted"],
        ["accepted", "accepted", "refused"],
    )
