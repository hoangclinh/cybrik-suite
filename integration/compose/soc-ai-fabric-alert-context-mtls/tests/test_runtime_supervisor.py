from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime

import pytest
from cybrik_suite_uat_fabric.runtime_supervisor import (
    AuthenticatedRuntimeSupervisor,
    SignedReceiptWriter,
    SupervisorBinding,
    SupervisorError,
    decode_response,
    encode_request,
)


@dataclass
class _Handle:
    role: str
    events: list[str]
    running: bool = True
    fail_terminate_wait: bool = False
    fail_kill_wait: bool = False

    @property
    def pid(self) -> int:  # pragma: no cover - access is itself a test failure
        raise AssertionError("numeric PID must never become process authority")

    def poll(self) -> int | None:
        return None if self.running else 0

    def terminate(self) -> None:
        self.events.append(f"terminate:{self.role}")

    def wait(self, timeout: float) -> int:
        self.events.append(f"wait:{self.role}:{timeout:g}")
        if self.fail_terminate_wait and timeout == 15:
            raise TimeoutError("synthetic timeout must be collapsed")
        if self.fail_kill_wait and timeout == 5:
            raise TimeoutError("synthetic timeout must be collapsed")
        self.running = False
        return 0

    def kill(self) -> None:
        self.events.append(f"kill:{self.role}")


class _MemoryFS:
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}

    def write_once(self, name: str, payload: bytes) -> None:
        if name in self.files:
            raise FileExistsError(name)
        self.files[name] = payload


CAPABILITY = bytes(range(32))
BINDING = SupervisorBinding(
    authorization_sha256="a" * 64,
    source_tuple_sha256="b" * 64,
    run_id="uat-run-0001",
    owner_uid=501,
)
NOW = datetime(2026, 8, 3, 1, 2, 3, tzinfo=UTC)


def _signature(payload: bytes) -> str:
    return hmac.new(
        b"receipt-key-for-offline-unit-tests", payload, hashlib.sha256
    ).hexdigest()


def _fixture(*, fail_role: str | None = None, fail_reap_role: str | None = None):
    events: list[str] = []
    filesystem = _MemoryFS()
    writer = SignedReceiptWriter(
        filesystem=filesystem,
        signer=_signature,
        clock=lambda: NOW,
    )

    def factory(role: str) -> _Handle:
        events.append(f"start:{role}")
        if role == fail_role:
            raise RuntimeError("synthetic launch detail must not escape")
        return _Handle(
            role=role,
            events=events,
            fail_terminate_wait=role == fail_reap_role,
            fail_kill_wait=role == fail_reap_role,
        )

    def ready(role: str, handle: object) -> None:
        assert isinstance(handle, _Handle)
        events.append(f"ready:{role}")

    supervisor = AuthenticatedRuntimeSupervisor(
        binding=BINDING,
        capability=CAPABILITY,
        process_factory=factory,
        readiness_probe=ready,
        receipt_writer=writer,
    )
    return supervisor, events, filesystem


def _request(request_id: str, action: str) -> bytes:
    return encode_request(
        binding=BINDING,
        capability=CAPABILITY,
        request_id=request_id,
        action=action,
    )


def _role_request(request_id: str, operation: str, role: str) -> bytes:
    return _request(request_id, f"{operation}_{role}")


def _decode(frame: bytes) -> dict[str, object]:
    return decode_response(frame, binding=BINDING, capability=CAPABILITY)


def _receipt(filesystem: _MemoryFS, name: str) -> dict[str, object]:
    return json.loads(filesystem.files[name])


def test_starts_exact_roles_in_order_and_writes_signed_ready_receipts() -> None:
    supervisor, events, filesystem = _fixture()

    response = supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)

    assert _decode(response)["result"] == {
        "roles": ["soc", "fabric", "ai"],
        "status": "started",
    }
    assert events == [
        "start:soc",
        "ready:soc",
        "start:fabric",
        "ready:fabric",
        "start:ai",
        "ready:ai",
    ]
    assert tuple(supervisor.owned_roles) == ("soc", "fabric", "ai")
    assert sorted(filesystem.files) == [
        "ready-01-soc.json",
        "ready-02-fabric.json",
        "ready-03-ai.json",
    ]
    ready = _receipt(filesystem, "ready-03-ai.json")
    assert ready["payload"]["binding"] == BINDING.as_payload()
    assert ready["payload"]["role"] == "ai"
    assert ready["payload"]["observed_at"] == "2026-08-03T01:02:03Z"
    canonical = json.dumps(
        ready["payload"], ensure_ascii=True, separators=(",", ":"), sort_keys=True
    ).encode()
    assert hmac.compare_digest(ready["signature"], _signature(canonical))


def test_rolewise_start_owns_each_handle_in_exact_order() -> None:
    supervisor, events, filesystem = _fixture()

    soc = supervisor.start_role(
        "soc", _role_request("start-soc", "start", "soc"), peer_uid=501
    )
    fabric = supervisor.start_role(
        "fabric", _role_request("start-fabric", "start", "fabric"), peer_uid=501
    )
    ai = supervisor.start_role(
        "ai", _role_request("start-ai", "start", "ai"), peer_uid=501
    )

    assert _decode(soc)["result"] == {"role": "soc", "status": "started"}
    assert _decode(fabric)["result"] == {"role": "fabric", "status": "started"}
    assert _decode(ai)["result"] == {"role": "ai", "status": "started"}
    assert events == [
        "start:soc",
        "ready:soc",
        "start:fabric",
        "ready:fabric",
        "start:ai",
        "ready:ai",
    ]
    assert supervisor.owned_roles == ("soc", "fabric", "ai")
    assert sorted(filesystem.files) == [
        "ready-01-soc.json",
        "ready-02-fabric.json",
        "ready-03-ai.json",
    ]


def test_rolewise_start_out_of_order_is_denied_before_process_effect() -> None:
    supervisor, events, filesystem = _fixture()

    with pytest.raises(SupervisorError, match="start_order_violation"):
        supervisor.start_role(
            "fabric",
            _role_request("start-fabric", "start", "fabric"),
            peer_uid=501,
        )

    assert events == []
    assert filesystem.files == {}
    assert supervisor.owned_roles == ()


def test_rolewise_entrypoint_rejects_action_role_mismatch_before_effect() -> None:
    supervisor, events, filesystem = _fixture()

    with pytest.raises(SupervisorError, match="action_role_mismatch"):
        supervisor.start_role(
            "soc", _role_request("wrong-role", "start", "fabric"), peer_uid=501
        )

    assert events == []
    assert filesystem.files == {}


def test_stops_in_reverse_order_and_writes_complete_shutdown_receipt() -> None:
    supervisor, events, filesystem = _fixture()
    supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)
    events.clear()

    response = supervisor.handle_frame(_request("stop-1", "stop_all"), peer_uid=501)

    assert _decode(response)["result"] == {
        "roles": ["ai", "fabric", "soc"],
        "status": "stopped",
    }
    assert events == [
        "terminate:ai",
        "wait:ai:15",
        "terminate:fabric",
        "wait:fabric:15",
        "terminate:soc",
        "wait:soc:15",
    ]
    assert supervisor.owned_roles == ()
    shutdown = _receipt(filesystem, "shutdown.json")["payload"]
    assert shutdown["complete"] is True
    assert shutdown["reason"] == "requested"
    assert shutdown["stopped_roles"] == ["ai", "fabric", "soc"]


def test_rolewise_stop_enforces_reverse_order_and_seals_only_after_soc() -> None:
    supervisor, events, filesystem = _fixture()
    supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)
    events.clear()

    with pytest.raises(SupervisorError, match="stop_order_violation"):
        supervisor.stop_role(
            "soc", _role_request("stop-soc-early", "stop", "soc"), peer_uid=501
        )
    assert events == []

    ai = supervisor.stop_role(
        "ai", _role_request("stop-ai", "stop", "ai"), peer_uid=501
    )
    fabric = supervisor.stop_role(
        "fabric", _role_request("stop-fabric", "stop", "fabric"), peer_uid=501
    )
    assert "shutdown.json" not in filesystem.files
    soc = supervisor.stop_role(
        "soc", _role_request("stop-soc", "stop", "soc"), peer_uid=501
    )

    assert _decode(ai)["result"] == {"role": "ai", "status": "stopped"}
    assert _decode(fabric)["result"] == {"role": "fabric", "status": "stopped"}
    assert _decode(soc)["result"] == {"role": "soc", "status": "stopped"}
    assert events == [
        "terminate:ai",
        "wait:ai:15",
        "terminate:fabric",
        "wait:fabric:15",
        "terminate:soc",
        "wait:soc:15",
    ]
    assert _receipt(filesystem, "shutdown.json")["payload"]["stopped_roles"] == [
        "ai",
        "fabric",
        "soc",
    ]


def test_lost_ack_replay_returns_identical_bytes_without_repeating_effects() -> None:
    supervisor, events, filesystem = _fixture()
    request = _request("start-lost-ack", "start_all")

    first = supervisor.handle_frame(request, peer_uid=501)
    event_count = len(events)
    file_count = len(filesystem.files)
    replay = supervisor.handle_frame(request, peer_uid=501)

    assert replay == first
    assert len(events) == event_count
    assert len(filesystem.files) == file_count


def test_rolewise_lost_ack_replay_is_byte_identical_without_effect_replay() -> None:
    supervisor, events, filesystem = _fixture()
    request = _role_request("start-soc-lost-ack", "start", "soc")

    first = supervisor.start_role("soc", request, peer_uid=501)
    replay = supervisor.start_role("soc", request, peer_uid=501)

    assert replay == first
    assert events == ["start:soc", "ready:soc"]
    assert sorted(filesystem.files) == ["ready-01-soc.json"]


def test_request_id_cannot_be_reused_for_different_authenticated_action() -> None:
    supervisor, events, _filesystem = _fixture()
    supervisor.handle_frame(_request("same-id", "start_all"), peer_uid=501)

    with pytest.raises(SupervisorError, match="request_id_payload_mismatch"):
        supervisor.handle_frame(_request("same-id", "stop_all"), peer_uid=501)

    assert "terminate:ai" not in events


@pytest.mark.parametrize("peer_uid", [0, 502])
def test_peer_identity_mismatch_has_no_effect(peer_uid: int) -> None:
    supervisor, events, filesystem = _fixture()

    with pytest.raises(SupervisorError, match="peer_uid_mismatch"):
        supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=peer_uid)

    assert events == []
    assert filesystem.files == {}


def test_bad_authentication_and_binding_have_no_effect() -> None:
    supervisor, events, filesystem = _fixture()
    frame = bytearray(_request("start-1", "start_all"))
    frame[-3] = ord("0") if frame[-3] != ord("0") else ord("1")

    with pytest.raises(SupervisorError, match="frame_authentication_failed"):
        supervisor.handle_frame(bytes(frame), peer_uid=501)

    other = SupervisorBinding(
        authorization_sha256="c" * 64,
        source_tuple_sha256="b" * 64,
        run_id="uat-run-0001",
        owner_uid=501,
    )
    with pytest.raises(SupervisorError, match="binding_mismatch"):
        supervisor.handle_frame(
            encode_request(
                binding=other,
                capability=CAPABILITY,
                request_id="start-2",
                action="start_all",
            ),
            peer_uid=501,
        )

    assert events == []
    assert filesystem.files == {}


def test_noncanonical_authenticated_frame_has_no_effect() -> None:
    supervisor, events, filesystem = _fixture()

    with pytest.raises(SupervisorError, match="frame_invalid"):
        supervisor.handle_frame(b" " + _request("start-1", "start_all"), peer_uid=501)

    assert events == []
    assert filesystem.files == {}


def test_partial_start_failure_cleans_owned_handles_in_reverse_and_seals_shutdown() -> (
    None
):
    supervisor, events, filesystem = _fixture(fail_role="ai")

    with pytest.raises(SupervisorError, match="process_start_failed"):
        supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)

    assert events == [
        "start:soc",
        "ready:soc",
        "start:fabric",
        "ready:fabric",
        "start:ai",
        "terminate:fabric",
        "wait:fabric:15",
        "terminate:soc",
        "wait:soc:15",
    ]
    assert supervisor.owned_roles == ()
    shutdown = _receipt(filesystem, "shutdown.json")["payload"]
    assert shutdown["complete"] is True
    assert shutdown["reason"] == "partial_start_cleanup"
    assert shutdown["stopped_roles"] == ["fabric", "soc"]

    event_count = len(events)
    with pytest.raises(SupervisorError, match="supervisor_lifecycle_complete"):
        supervisor.handle_frame(
            _request("start-after-failure", "start_all"), peer_uid=501
        )
    assert len(events) == event_count


def test_rolewise_start_failure_reverse_cleans_and_permanently_blocks_retry() -> None:
    supervisor, events, filesystem = _fixture(fail_role="fabric")
    supervisor.start_role(
        "soc", _role_request("start-soc", "start", "soc"), peer_uid=501
    )

    with pytest.raises(SupervisorError, match="process_start_failed"):
        supervisor.start_role(
            "fabric",
            _role_request("start-fabric", "start", "fabric"),
            peer_uid=501,
        )

    assert events == [
        "start:soc",
        "ready:soc",
        "start:fabric",
        "terminate:soc",
        "wait:soc:15",
    ]
    assert supervisor.owned_roles == ()
    shutdown = _receipt(filesystem, "shutdown.json")["payload"]
    assert shutdown["reason"] == "partial_start_cleanup"
    assert shutdown["stopped_roles"] == ["soc"]

    effect_count = len(events)
    with pytest.raises(SupervisorError, match="supervisor_lifecycle_complete"):
        supervisor.start_role(
            "soc", _role_request("retry-soc", "start", "soc"), peer_uid=501
        )
    assert len(events) == effect_count


def test_unreaped_child_keeps_authority_and_blocks_complete_shutdown_receipt() -> None:
    supervisor, events, filesystem = _fixture(fail_reap_role="fabric")
    supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)

    with pytest.raises(SupervisorError, match="owned_child_unreaped"):
        supervisor.handle_frame(_request("stop-1", "stop_all"), peer_uid=501)

    assert events[-8:] == [
        "terminate:ai",
        "wait:ai:15",
        "terminate:fabric",
        "wait:fabric:15",
        "kill:fabric",
        "wait:fabric:5",
        "terminate:soc",
        "wait:soc:15",
    ]
    assert supervisor.owned_roles == ("fabric",)
    assert "shutdown.json" not in filesystem.files


def test_start_is_state_idempotent_across_new_request_id() -> None:
    supervisor, events, _filesystem = _fixture()
    supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)
    count = len(events)

    response = supervisor.handle_frame(_request("start-2", "start_all"), peer_uid=501)

    assert _decode(response)["result"]["status"] == "already_started"
    assert len(events) == count


@pytest.mark.parametrize(
    ("binding", "capability", "reason"),
    [
        (
            SupervisorBinding.__new__(SupervisorBinding),
            CAPABILITY,
            "binding_invalid",
        ),
        (BINDING, b"short", "capability_invalid"),
    ],
)
def test_constructor_rejects_invalid_authority_without_effect(
    binding: object, capability: bytes, reason: str
) -> None:
    with pytest.raises((SupervisorError, AttributeError), match=reason):
        AuthenticatedRuntimeSupervisor(
            binding=binding,
            capability=capability,
            process_factory=lambda _role: object(),
            readiness_probe=lambda _role, _handle: None,
            receipt_writer=object(),
        )


def test_receipt_writer_rejects_naive_clock_before_filesystem_effect() -> None:
    filesystem = _MemoryFS()
    writer = SignedReceiptWriter(
        filesystem=filesystem,
        signer=_signature,
        clock=lambda: datetime(2026, 8, 3, 1, 2, 3),  # noqa: DTZ001
    )

    with pytest.raises(SupervisorError, match="clock_invalid"):
        writer.write_ready(BINDING, role="soc", ordinal=1)

    assert filesystem.files == {}


def test_encoding_rejects_bad_request_identity_and_action() -> None:
    with pytest.raises(SupervisorError, match="request_id_invalid"):
        encode_request(
            binding=BINDING,
            capability=CAPABILITY,
            request_id="contains spaces",
            action="start_all",
        )
    with pytest.raises(SupervisorError, match="action_invalid"):
        encode_request(
            binding=BINDING,
            capability=CAPABILITY,
            request_id="valid-id",
            action="restart_soc",
        )


def test_signed_receipt_failure_is_stable_and_writes_nothing() -> None:
    filesystem = _MemoryFS()
    writer = SignedReceiptWriter(
        filesystem=filesystem,
        signer=lambda _payload: "contains whitespace",
        clock=lambda: NOW,
    )
    with pytest.raises(SupervisorError, match="receipt_signature_invalid"):
        writer.write_ready(BINDING, role="soc", ordinal=1)
    assert filesystem.files == {}


def test_ready_probe_failure_cleans_the_just_started_handle() -> None:
    supervisor, events, filesystem = _fixture()

    def reject_ready(role: str, _handle: object) -> None:
        events.append(f"ready:{role}")
        if role == "fabric":
            raise RuntimeError("synthetic readiness detail")

    supervisor._readiness_probe = reject_ready  # exact injected seam under test
    with pytest.raises(SupervisorError, match="process_start_failed"):
        supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)

    assert events == [
        "start:soc",
        "ready:soc",
        "start:fabric",
        "ready:fabric",
        "terminate:fabric",
        "wait:fabric:15",
        "terminate:soc",
        "wait:soc:15",
    ]
    assert _receipt(filesystem, "shutdown.json")["payload"]["complete"] is True


def test_terminate_timeout_escalates_to_kill_and_can_still_complete() -> None:
    supervisor, events, filesystem = _fixture()
    supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)
    fabric = supervisor._owned["fabric"]
    assert isinstance(fabric, _Handle)
    fabric.fail_terminate_wait = True
    events.clear()

    supervisor.handle_frame(_request("stop-1", "stop_all"), peer_uid=501)

    assert events == [
        "terminate:ai",
        "wait:ai:15",
        "terminate:fabric",
        "wait:fabric:15",
        "kill:fabric",
        "wait:fabric:5",
        "terminate:soc",
        "wait:soc:15",
    ]
    assert _receipt(filesystem, "shutdown.json")["payload"]["complete"] is True


def test_invalid_wait_return_keeps_handle_owned_and_blocks_shutdown_receipt() -> None:
    supervisor, _events, filesystem = _fixture()
    supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)
    handle = supervisor._owned["fabric"]
    handle.wait = lambda _timeout: None  # type: ignore[method-assign,assignment]

    with pytest.raises(SupervisorError, match="owned_child_unreaped"):
        supervisor.handle_frame(_request("stop-1", "stop_all"), peer_uid=501)

    assert supervisor.owned_roles == ("fabric",)
    assert "shutdown.json" not in filesystem.files


def test_stopped_lifecycle_is_idempotent_but_cannot_restart() -> None:
    supervisor, events, _filesystem = _fixture()
    supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)
    supervisor.handle_frame(_request("stop-1", "stop_all"), peer_uid=501)
    count = len(events)

    stopped = supervisor.handle_frame(_request("stop-2", "stop_all"), peer_uid=501)
    assert _decode(stopped)["result"] == {"roles": [], "status": "already_stopped"}
    with pytest.raises(SupervisorError, match="supervisor_lifecycle_complete"):
        supervisor.handle_frame(_request("start-2", "start_all"), peer_uid=501)
    assert len(events) == count


def test_replay_capacity_exhaustion_precedes_new_effect() -> None:
    supervisor, events, _filesystem = _fixture()
    supervisor._replay_capacity = 1
    supervisor.handle_frame(_request("start-1", "start_all"), peer_uid=501)
    count = len(events)

    with pytest.raises(SupervisorError, match="replay_capacity_exhausted"):
        supervisor.handle_frame(_request("start-2", "start_all"), peer_uid=501)

    assert len(events) == count
