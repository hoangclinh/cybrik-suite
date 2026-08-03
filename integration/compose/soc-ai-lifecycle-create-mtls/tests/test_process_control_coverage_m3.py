"""Deterministic branch coverage for the import-inert D2 control module.

All collaborators are in-memory fakes.  These tests never open a socket, touch
the host filesystem, inspect a process, or deliver a signal.
"""

from __future__ import annotations

import stat
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_mtls import process_control as control

_AUTHORIZATION = "a" * 64
_RUN_ID = "b" * 32
_CAPABILITY = b"c" * control.CAPABILITY_BYTES
_OWNER_UID = 501


def _binding(**changes: object) -> control.ControlBinding:
    values: dict[str, object] = {
        "authorization_sha256": _AUTHORIZATION,
        "run_id": _RUN_ID,
        "generation": 1,
        "owner_uid": _OWNER_UID,
    }
    values.update(changes)
    return control.ControlBinding(**values)  # type: ignore[arg-type]


def _identity(
    *, inode: int = 11, mode: int = stat.S_IFDIR | 0o700
) -> control.RootIdentity:
    return control.RootIdentity(7, inode, _OWNER_UID, mode)


def _material() -> control.ControlMaterial:
    binding = _binding()
    root_identity = _identity()
    paths = control.derive_control_paths(Path("/private/tmp/runtime"), _AUTHORIZATION)
    return control.ControlMaterial(
        paths,
        binding,
        root_identity,
        _CAPABILITY,
        control.PersistedControlBinding(binding, root_identity),
    )


def _stable(data: bytes, identity: control.RootIdentity | None = None) -> object:
    observed = identity or _identity(mode=stat.S_IFREG | 0o600)
    return SimpleNamespace(data=data, before=observed, after=observed)


def _reason(exc: pytest.ExceptionInfo[control.ProcessControlError]) -> str:
    return exc.value.reason


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"authorization_sha256": "bad"}, "binding_authorization_sha256_invalid"),
        ({"run_id": "bad"}, "binding_run_id_invalid"),
        ({"generation": True}, "binding_generation_invalid"),
        ({"owner_uid": -1}, "binding_owner_uid_invalid"),
    ],
)
def test_binding_rejects_each_invalid_authority_component(
    changes: dict[str, object], reason: str
) -> None:
    with pytest.raises(control.ProcessControlError) as exc:
        _binding(**changes)
    assert _reason(exc) == reason


@pytest.mark.parametrize(
    ("operation", "reason"),
    [
        (
            lambda: control.canonical_body_bytes({"bad": object()}),
            "frame_not_canonical_json",
        ),
        (lambda: control.sign_frame([], _CAPABILITY), "frame_payload_not_mapping"),
        (lambda: control.verify_frame("not-bytes", _CAPABILITY), "frame_not_bytes"),
        (
            lambda: control.verify_frame(
                b"x" * (control.MAX_FRAME_BYTES + 1), _CAPABILITY
            ),
            "frame_too_large",
        ),
        (
            lambda: control.verify_frame(b"not-json", _CAPABILITY),
            "frame_authentication_failed",
        ),
        (
            lambda: control.verify_frame(b"{}", _CAPABILITY),
            "frame_authentication_failed",
        ),
        (
            lambda: control.verify_frame(b'{"body":[],"mac":1}', _CAPABILITY),
            "frame_authentication_failed",
        ),
        (lambda: control.encode_wire_frame(b""), "frame_too_large"),
    ],
)
def test_canonical_frame_boundaries_fail_closed(operation: object, reason: str) -> None:
    with pytest.raises(control.ProcessControlError) as exc:
        operation()  # type: ignore[operator]
    assert _reason(exc) == reason


@pytest.mark.parametrize("capability", [b"short", "c" * 32])
def test_capability_requires_secret_bytes(capability: object) -> None:
    with pytest.raises(control.ProcessControlError) as exc:
        control.sign_frame({}, capability)  # type: ignore[arg-type]
    assert _reason(exc) == "capability_invalid"


def test_path_identity_and_stable_leaf_validation_fail_closed() -> None:
    with pytest.raises(control.ProcessControlError) as path_exc:
        control.derive_control_paths(Path("relative"), _AUTHORIZATION)
    assert _reason(path_exc) == "control_path_binding_invalid"

    invalid_leaf = _stable(b"data", _identity(mode=stat.S_IFDIR | 0o600))
    with pytest.raises(control.ProcessControlError) as leaf_exc:
        control._stable_leaf(
            invalid_leaf, expected_mode=0o600, expected_owner_uid=_OWNER_UID
        )
    assert _reason(leaf_exc) == "control_leaf_invalid"


class _WireConnection:
    def __init__(self, incoming: bytes = b"") -> None:
        self.incoming = bytearray(incoming)
        self.sent = bytearray()
        self.connected: str | None = None
        self.closed = False

    def connect(self, path: str) -> None:
        self.connected = path

    def sendall(self, payload: bytes) -> None:
        self.sent.extend(payload)

    def recv(self, count: int) -> bytes:
        result = bytes(self.incoming[:count])
        del self.incoming[:count]
        return result

    def close(self) -> None:
        self.closed = True


@pytest.mark.parametrize(
    ("operation", "reason"),
    [
        (lambda: control.write_wire_frame(object(), b"x"), "control_socket_invalid"),
        (lambda: control._recv_exact(object(), 1), "control_socket_invalid"),
        (
            lambda: control._recv_exact(
                SimpleNamespace(recv=lambda _count: "not-bytes"), 1
            ),
            "control_frame_truncated",
        ),
    ],
)
def test_wire_collaborators_are_capability_checked(
    operation: object, reason: str
) -> None:
    with pytest.raises(control.ProcessControlError) as exc:
        operation()  # type: ignore[operator]
    assert _reason(exc) == reason


def test_receipt_semantics_reject_wrong_binding_and_incomplete_shutdown() -> None:
    material = _material()
    wrong_ready = control.sign_frame(
        {
            "binding": _binding(generation=2).as_payload(),
            "root_identity": material.root_identity.as_payload(),
            "status": "ready",
            "version": control.READY_RECEIPT_VERSION,
        },
        _CAPABILITY,
    )
    with pytest.raises(control.ProcessControlError) as ready_exc:
        control.verify_ready_receipt(wrong_ready, material)
    assert _reason(ready_exc) == "control_receipt_mismatch"

    incomplete = control.sign_frame(
        {
            "binding": material.binding.as_payload(),
            "receipt": {"all_children_reaped": False},
            "root_identity": material.root_identity.as_payload(),
            "version": control.SHUTDOWN_RECEIPT_VERSION,
        },
        _CAPABILITY,
    )
    with pytest.raises(control.ProcessControlError) as shutdown_exc:
        control.verify_shutdown_receipt(incomplete, material)
    assert _reason(shutdown_exc) == "shutdown_receipt_invalid"


class _StoreFileSystem:
    def __init__(self, material: control.ControlMaterial) -> None:
        self.material = material
        self.events: list[tuple[object, ...]] = []
        self.reads: list[object] = []
        self.probe_result = True

    def open_directory(self, root: Path, *, nofollow: bool) -> object:
        self.events.append(("open_directory", root, nofollow))
        return "root-handle"

    def stat_handle(self, handle: object) -> control.RootIdentity:
        self.events.append(("stat_handle", handle))
        return self.material.root_identity

    def read_at_stable(self, *_args: object, **_kwargs: object) -> object:
        return self.reads.pop(0)

    def acquire_liveness(self, *args: object, **kwargs: object) -> object:
        self.events.append(("acquire", args, kwargs))
        return "authority"

    def release_liveness(self, authority: object) -> None:
        self.events.append(("release", authority))

    def liveness_released(self, *args: object, **kwargs: object) -> bool:
        self.events.append(("probe", args, kwargs))
        return self.probe_result

    def remove_control_root(self, *args: object, **kwargs: object) -> None:
        self.events.append(("remove", args, kwargs))

    def close_handle(self, handle: object) -> None:
        self.events.append(("close", handle))


def test_store_requires_injected_optional_authorities() -> None:
    material = _material()
    missing = control.ControlStore(filesystem=SimpleNamespace())  # type: ignore[arg-type]
    cases = (
        (
            lambda: missing._handle(material.paths.root),
            "control_root_handle_unavailable",
        ),
        (lambda: missing.acquire_liveness(material), "liveness_authority_unavailable"),
        (lambda: missing.release_liveness(object()), "liveness_authority_unavailable"),
        (lambda: missing.liveness_released(material), "liveness_authority_unavailable"),
        (
            lambda: missing.remove_control_root(material),
            "control_root_cleanup_unavailable",
        ),
    )
    for operation, reason in cases:
        with pytest.raises(control.ProcessControlError) as exc:
            operation()
        assert _reason(exc) == reason


def test_store_optional_authorities_succeed_and_close_remembered_handle() -> None:
    material = _material()
    filesystem = _StoreFileSystem(material)
    store = control.ControlStore(filesystem=filesystem)  # type: ignore[arg-type]
    store._remember(material.paths.root, "remembered")

    assert store.acquire_liveness(material) == "authority"
    store.release_liveness("authority")
    assert store.liveness_released(material) is True
    store.remove_control_root(material)

    assert ("release", "authority") in filesystem.events
    assert ("close", "remembered") in filesystem.events
    assert material.paths.root not in store._handles


def test_store_rejects_replaced_root_and_oversized_binding() -> None:
    material = _material()
    replaced_fs = _StoreFileSystem(material)
    replaced_fs.stat_handle = lambda _handle: _identity(inode=99)  # type: ignore[method-assign]
    replaced = control.ControlStore(filesystem=replaced_fs)  # type: ignore[arg-type]
    with pytest.raises(control.ProcessControlError) as replaced_exc:
        replaced._verified_handle(material)
    assert _reason(replaced_exc) == "control_root_replaced"

    filesystem = _StoreFileSystem(material)
    filesystem.reads = [
        _stable(_CAPABILITY),
        _stable(b"x" * (control.MAX_BINDING_BYTES + 1)),
    ]
    store = control.ControlStore(filesystem=filesystem)  # type: ignore[arg-type]
    with pytest.raises(control.ProcessControlError) as binding_exc:
        store.load(paths=material.paths, expected_binding=material.binding)
    assert _reason(binding_exc) == "control_binding_too_large"


class _TransportFileSystem:
    def __init__(self, material: control.ControlMaterial) -> None:
        self.material = material

    def stat_directory(self, _path: Path, *, nofollow: bool) -> control.RootIdentity:
        assert nofollow is True
        return self.material.root_identity

    def stat_socket(self, _path: Path, *, nofollow: bool) -> control.RootIdentity:
        assert nofollow is True
        return _identity(inode=41, mode=stat.S_IFSOCK | 0o600)


def _request(
    material: control.ControlMaterial, binding: control.ControlBinding | None = None
) -> bytes:
    return control.encode_request(
        binding=binding or material.binding,
        capability=_CAPABILITY,
        request_id="request-1",
        action="stop_all",
        parameters={},
    )


def test_transport_rejects_missing_seams_and_mismatched_bindings() -> None:
    material = _material()
    missing_root = control.UnixControlTransport(
        paths=material.paths,
        binding=material.binding,
        capability=_CAPABILITY,
        filesystem=SimpleNamespace(),  # type: ignore[arg-type]
        expected_root_identity=material.root_identity,
    )
    with pytest.raises(control.ProcessControlError) as root_exc:
        missing_root._verify_root_identity()
    assert _reason(root_exc) == "control_root_identity_unavailable"

    transport = control.UnixControlTransport(
        paths=material.paths,
        binding=material.binding,
        capability=_CAPABILITY,
        filesystem=_TransportFileSystem(material),  # type: ignore[arg-type]
        socket_factory=lambda *_args: object(),
        peer_euid_reader=lambda _connection: _OWNER_UID,
    )
    with pytest.raises(control.ProcessControlError) as binding_exc:
        transport.exchange(_request(material, _binding(generation=2)))
    assert _reason(binding_exc) == "binding_mismatch"
    with pytest.raises(control.ProcessControlError) as socket_exc:
        transport.exchange(_request(material))
    assert _reason(socket_exc) == "control_socket_invalid"


def test_transport_and_client_reject_authenticated_response_confusion() -> None:
    material = _material()
    wrong_response = control.encode_response(
        binding=_binding(generation=2),
        capability=_CAPABILITY,
        request_id="request-1",
        action="stop_all",
        result={},
    )
    connection = _WireConnection(control.encode_wire_frame(wrong_response))
    transport = control.UnixControlTransport(
        paths=material.paths,
        binding=material.binding,
        capability=_CAPABILITY,
        filesystem=_TransportFileSystem(material),  # type: ignore[arg-type]
        socket_factory=lambda *_args: connection,
        peer_euid_reader=lambda _connection: _OWNER_UID,
    )
    with pytest.raises(control.ProcessControlError) as response_exc:
        transport.exchange(_request(material))
    assert _reason(response_exc) == "response_binding_mismatch"
    assert connection.closed is True

    bad_body = control.sign_frame(
        {
            "action": "stop_all",
            "binding": material.binding.as_payload(),
            "kind": "request",
            "request_id": "request-1",
            "result": {},
            "version": control.PROTOCOL_VERSION,
        },
        _CAPABILITY,
    )
    client = control.ControlClient(
        binding=material.binding,
        capability=_CAPABILITY,
        transport=SimpleNamespace(exchange=lambda _frame: bad_body),
    )
    with pytest.raises(control.ProcessControlError) as client_exc:
        client.stop_all(request_id="request-1")
    assert _reason(client_exc) == "response_mismatch"


def test_lost_supervisor_ack_without_liveness_probe_blocks_cleanup() -> None:
    events: list[str] = []
    client = SimpleNamespace(
        stop_all=lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("lost"))
    )
    with pytest.raises(control.ProcessControlError) as exc:
        control.coordinated_teardown(
            client=client,
            load_shutdown_receipt=lambda: object(),
            validate_shutdown_receipt=lambda _receipt: True,
            stop_store=lambda: events.append("store"),
            destroy_runtime=lambda: events.append("runtime"),
            remove_control_root=lambda: events.append("control"),
        )
    assert _reason(exc) == "stable_process_authority_lost"
    assert events == []
