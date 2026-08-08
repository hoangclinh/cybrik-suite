"""Authenticated, one-shot process supervisor for the local integrated UAT.

Status: UAT-ONLY / NOT PRODUCTION. Importing this module is inert. The core
receives process handles, readiness probes, receipt persistence, signing and a
clock through explicit injection. Numeric PIDs are never used as authority.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final, Protocol

CONTROL_SCHEMA: Final = "CYBRIK-UAT-SOC-AI-FABRIC-CONTROL/v1"
RECEIPT_SCHEMA: Final = "CYBRIK-UAT-SOC-AI-FABRIC-PROCESS-RECEIPT/v1"
START_ORDER: Final = ("soc", "fabric", "ai")
STOP_ORDER: Final = tuple(reversed(START_ORDER))
TERMINATE_TIMEOUT_SECONDS: Final = 15.0
KILL_TIMEOUT_SECONDS: Final = 5.0
MIN_CAPABILITY_BYTES: Final = 32
MAX_FRAME_BYTES: Final = 16 * 1024
DEFAULT_REPLAY_CAPACITY: Final = 64
MAX_REPLAY_CAPACITY: Final = 1024

_HEX64 = re.compile(r"[0-9a-f]{64}")
_RUN_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
_REQUEST_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
_ROLE_ACTIONS: Final = frozenset(
    f"{operation}_{role}" for operation in ("start", "stop") for role in START_ORDER
)
_ACTIONS: Final = frozenset({"start_all", "stop_all", *_ROLE_ACTIONS})


class SupervisorError(RuntimeError):
    """Stable, non-reflecting supervisor refusal."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class SupervisorBinding:
    """Exact runtime authorization and four-repository tuple identity."""

    authorization_sha256: str
    source_tuple_sha256: str
    run_id: str
    owner_uid: int

    def __post_init__(self) -> None:
        if (
            not isinstance(self.authorization_sha256, str)
            or _HEX64.fullmatch(self.authorization_sha256) is None
            or not isinstance(self.source_tuple_sha256, str)
            or _HEX64.fullmatch(self.source_tuple_sha256) is None
            or not isinstance(self.run_id, str)
            or _RUN_ID.fullmatch(self.run_id) is None
            or isinstance(self.owner_uid, bool)
            or not isinstance(self.owner_uid, int)
            or self.owner_uid < 0
        ):
            raise SupervisorError("binding_invalid")

    def as_payload(self) -> dict[str, object]:
        return {
            "authorization_sha256": self.authorization_sha256,
            "owner_uid": self.owner_uid,
            "run_id": self.run_id,
            "source_tuple_sha256": self.source_tuple_sha256,
        }


class OwnedProcess(Protocol):
    """A child handle retained exclusively by the supervisor."""

    def poll(self) -> int | None: ...

    def terminate(self) -> None: ...

    def wait(self, timeout: float) -> int: ...

    def kill(self) -> None: ...


class ReceiptFileSystem(Protocol):
    """No-overwrite external receipt persistence seam."""

    def write_once(self, name: str, payload: bytes) -> None: ...


class ReceiptWriter(Protocol):
    def write_ready(
        self, binding: SupervisorBinding, *, role: str, ordinal: int
    ) -> None: ...

    def write_shutdown(
        self,
        binding: SupervisorBinding,
        *,
        stopped_roles: tuple[str, ...],
        complete: bool,
        reason: str,
    ) -> None: ...


ProcessFactory = Callable[[str], OwnedProcess]
ReadinessProbe = Callable[[str, OwnedProcess], None]
ReceiptSigner = Callable[[bytes], str]
Clock = Callable[[], datetime]


def _canonical(value: object) -> bytes:
    try:
        encoded = json.dumps(
            value,
            allow_nan=False,
            ensure_ascii=True,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError) as exc:
        raise SupervisorError("frame_encoding_failed") from exc
    if len(encoded) > MAX_FRAME_BYTES:
        raise SupervisorError("frame_too_large")
    return encoded


def _validated_capability(capability: object) -> bytes:
    if not isinstance(capability, bytes) or len(capability) < MIN_CAPABILITY_BYTES:
        raise SupervisorError("capability_invalid")
    return capability


def _validated_binding(binding: object) -> SupervisorBinding:
    if not isinstance(binding, SupervisorBinding):
        raise SupervisorError("binding_invalid")
    try:
        reconstructed = SupervisorBinding(
            authorization_sha256=binding.authorization_sha256,
            source_tuple_sha256=binding.source_tuple_sha256,
            run_id=binding.run_id,
            owner_uid=binding.owner_uid,
        )
    except (AttributeError, SupervisorError) as exc:
        raise SupervisorError("binding_invalid") from exc
    if reconstructed != binding:
        raise SupervisorError("binding_invalid")
    return binding


def _signed_frame(body: Mapping[str, object], capability: bytes) -> bytes:
    body_bytes = _canonical(dict(body))
    signature = hmac.new(capability, body_bytes, hashlib.sha256).hexdigest()
    return _canonical({"body": dict(body), "hmac_sha256": signature})


def _verified_body(frame: object, capability: bytes) -> dict[str, object]:
    if not isinstance(frame, bytes) or not frame or len(frame) > MAX_FRAME_BYTES:
        raise SupervisorError("frame_invalid")
    try:
        document = json.loads(frame)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise SupervisorError("frame_invalid") from None
    if not isinstance(document, dict) or set(document) != {"body", "hmac_sha256"}:
        raise SupervisorError("frame_invalid")
    if not hmac.compare_digest(frame, _canonical(document)):
        raise SupervisorError("frame_invalid")
    body = document.get("body")
    signature = document.get("hmac_sha256")
    if not isinstance(body, dict) or not isinstance(signature, str):
        raise SupervisorError("frame_invalid")
    expected = hmac.new(capability, _canonical(body), hashlib.sha256).hexdigest()
    if _HEX64.fullmatch(signature) is None or not hmac.compare_digest(
        signature, expected
    ):
        raise SupervisorError("frame_authentication_failed")
    return body


def encode_request(
    *,
    binding: SupervisorBinding,
    capability: bytes,
    request_id: str,
    action: str,
) -> bytes:
    """Create one authenticated, parameter-free control request."""

    _validated_binding(binding)
    material = _validated_capability(capability)
    if not isinstance(request_id, str) or _REQUEST_ID.fullmatch(request_id) is None:
        raise SupervisorError("request_id_invalid")
    if action not in _ACTIONS:
        raise SupervisorError("action_invalid")
    return _signed_frame(
        {
            "action": action,
            "binding": binding.as_payload(),
            "kind": "request",
            "parameters": {},
            "request_id": request_id,
            "schema": CONTROL_SCHEMA,
        },
        material,
    )


def decode_response(
    frame: bytes, *, binding: SupervisorBinding, capability: bytes
) -> dict[str, object]:
    """Authenticate and validate a supervisor response for its exact binding."""

    _validated_binding(binding)
    body = _verified_body(frame, _validated_capability(capability))
    if (
        set(body) != {"action", "binding", "kind", "request_id", "result", "schema"}
        or body.get("schema") != CONTROL_SCHEMA
        or body.get("kind") != "response"
        or body.get("binding") != binding.as_payload()
        or body.get("action") not in _ACTIONS
        or not isinstance(body.get("request_id"), str)
        or _REQUEST_ID.fullmatch(str(body["request_id"])) is None
        or not isinstance(body.get("result"), dict)
    ):
        raise SupervisorError("response_invalid")
    return body


class SignedReceiptWriter:
    """Write signed public lifecycle receipts through an injected filesystem."""

    def __init__(
        self,
        *,
        filesystem: ReceiptFileSystem,
        signer: ReceiptSigner,
        clock: Clock,
    ) -> None:
        if not callable(getattr(filesystem, "write_once", None)):
            raise SupervisorError("receipt_filesystem_invalid")
        if not callable(signer):
            raise SupervisorError("receipt_signer_invalid")
        if not callable(clock):
            raise SupervisorError("clock_invalid")
        self._filesystem = filesystem
        self._signer = signer
        self._clock = clock

    def _observed_at(self) -> str:
        observed = self._clock()
        if (
            not isinstance(observed, datetime)
            or observed.tzinfo is None
            or observed.utcoffset() is None
        ):
            raise SupervisorError("clock_invalid")
        return (
            observed.astimezone(UTC)
            .isoformat(timespec="seconds")
            .replace("+00:00", "Z")
        )

    def _write(self, name: str, payload: dict[str, object]) -> None:
        canonical = _canonical(payload)
        try:
            signature = self._signer(canonical)
        except Exception as exc:
            raise SupervisorError("receipt_signing_failed") from exc
        if (
            not isinstance(signature, str)
            or not signature
            or len(signature) > 2048
            or any(character.isspace() for character in signature)
        ):
            raise SupervisorError("receipt_signature_invalid")
        envelope = _canonical({"payload": payload, "signature": signature})
        try:
            self._filesystem.write_once(name, envelope)
        except Exception as exc:
            raise SupervisorError("receipt_write_failed") from exc

    def write_ready(
        self, binding: SupervisorBinding, *, role: str, ordinal: int
    ) -> None:
        if role not in START_ORDER or ordinal != START_ORDER.index(role) + 1:
            raise SupervisorError("ready_receipt_invalid")
        self._write(
            f"ready-{ordinal:02d}-{role}.json",
            {
                "binding": binding.as_payload(),
                "kind": "ready",
                "observed_at": self._observed_at(),
                "ordinal": ordinal,
                "role": role,
                "schema": RECEIPT_SCHEMA,
            },
        )

    def write_shutdown(
        self,
        binding: SupervisorBinding,
        *,
        stopped_roles: tuple[str, ...],
        complete: bool,
        reason: str,
    ) -> None:
        if (
            not isinstance(stopped_roles, tuple)
            or any(role not in STOP_ORDER for role in stopped_roles)
            or tuple(role for role in STOP_ORDER if role in stopped_roles)
            != stopped_roles
            or not isinstance(complete, bool)
            or reason not in {"requested", "partial_start_cleanup"}
        ):
            raise SupervisorError("shutdown_receipt_invalid")
        self._write(
            "shutdown.json",
            {
                "binding": binding.as_payload(),
                "complete": complete,
                "kind": "shutdown",
                "observed_at": self._observed_at(),
                "reason": reason,
                "schema": RECEIPT_SCHEMA,
                "stopped_roles": list(stopped_roles),
            },
        )


class AuthenticatedRuntimeSupervisor:
    """One-shot exact-role state machine with bounded request replay."""

    def __init__(
        self,
        *,
        binding: SupervisorBinding,
        capability: bytes,
        process_factory: ProcessFactory,
        readiness_probe: ReadinessProbe,
        receipt_writer: ReceiptWriter,
        replay_capacity: int = DEFAULT_REPLAY_CAPACITY,
    ) -> None:
        _validated_binding(binding)
        material = _validated_capability(capability)
        if not callable(process_factory):
            raise SupervisorError("process_factory_invalid")
        if not callable(readiness_probe):
            raise SupervisorError("readiness_probe_invalid")
        if not callable(getattr(receipt_writer, "write_ready", None)) or not callable(
            getattr(receipt_writer, "write_shutdown", None)
        ):
            raise SupervisorError("receipt_writer_invalid")
        if (
            isinstance(replay_capacity, bool)
            or not isinstance(replay_capacity, int)
            or replay_capacity < 1
            or replay_capacity > MAX_REPLAY_CAPACITY
        ):
            raise SupervisorError("replay_capacity_invalid")
        self._binding = binding
        self._capability = material
        self._process_factory = process_factory
        self._readiness_probe = readiness_probe
        self._receipt_writer = receipt_writer
        self._replay_capacity = replay_capacity
        self._owned: dict[str, OwnedProcess] = {}
        self._responses: dict[str, tuple[bytes, bytes]] = {}
        self._ever_started = False
        self._stop_begun = False
        self._stopped_roles: tuple[str, ...] = ()
        self._stopped = False

    @property
    def owned_roles(self) -> tuple[str, ...]:
        return tuple(role for role in START_ORDER if role in self._owned)

    def handle_frame(self, frame: bytes, *, peer_uid: int) -> bytes:
        """Authenticate and execute an exact all-role or role-wise request."""

        return self._handle_frame(frame, peer_uid=peer_uid, expected_action=None)

    def start_role(self, role: str, frame: bytes, *, peer_uid: int) -> bytes:
        """Start exactly one role through an authenticated, binding-bound frame."""

        self._validate_role(role)
        return self._handle_frame(
            frame, peer_uid=peer_uid, expected_action=f"start_{role}"
        )

    def stop_role(self, role: str, frame: bytes, *, peer_uid: int) -> bytes:
        """Stop exactly one owned role through an authenticated binding frame."""

        self._validate_role(role)
        return self._handle_frame(
            frame, peer_uid=peer_uid, expected_action=f"stop_{role}"
        )

    def _handle_frame(
        self,
        frame: bytes,
        *,
        peer_uid: int,
        expected_action: str | None,
    ) -> bytes:
        body = _verified_body(frame, self._capability)
        if (
            isinstance(peer_uid, bool)
            or not isinstance(peer_uid, int)
            or peer_uid != self._binding.owner_uid
        ):
            raise SupervisorError("peer_uid_mismatch")
        request_id, action = self._parse_request(body)
        if expected_action is not None and action != expected_action:
            raise SupervisorError("action_role_mismatch")
        identity = hashlib.sha256(_canonical(body)).digest()
        cached = self._responses.get(request_id)
        if cached is not None:
            if not hmac.compare_digest(cached[0], identity):
                raise SupervisorError("request_id_payload_mismatch")
            return cached[1]
        if len(self._responses) >= self._replay_capacity:
            raise SupervisorError("replay_capacity_exhausted")
        result = self._dispatch(action)
        response = _signed_frame(
            {
                "action": action,
                "binding": self._binding.as_payload(),
                "kind": "response",
                "request_id": request_id,
                "result": result,
                "schema": CONTROL_SCHEMA,
            },
            self._capability,
        )
        self._responses = {**self._responses, request_id: (identity, response)}
        return response

    @staticmethod
    def _validate_role(role: object) -> str:
        if not isinstance(role, str) or role not in START_ORDER:
            raise SupervisorError("role_invalid")
        return role

    def _dispatch(self, action: str) -> dict[str, object]:
        if action == "start_all":
            return self._start_all()
        if action == "stop_all":
            return self._stop_all()
        operation, role = action.split("_", maxsplit=1)
        if operation == "start":
            return self._start_role(role)
        return self._stop_role(role)

    def _parse_request(self, body: Mapping[str, object]) -> tuple[str, str]:
        if (
            set(body)
            != {
                "action",
                "binding",
                "kind",
                "parameters",
                "request_id",
                "schema",
            }
            or body.get("schema") != CONTROL_SCHEMA
            or body.get("kind") != "request"
            or body.get("parameters") != {}
        ):
            raise SupervisorError("request_invalid")
        if body.get("binding") != self._binding.as_payload():
            raise SupervisorError("binding_mismatch")
        request_id = body.get("request_id")
        action = body.get("action")
        if not isinstance(request_id, str) or _REQUEST_ID.fullmatch(request_id) is None:
            raise SupervisorError("request_id_invalid")
        if not isinstance(action, str) or action not in _ACTIONS:
            raise SupervisorError("action_invalid")
        return request_id, action

    @staticmethod
    def _validate_handle(handle: object) -> OwnedProcess:
        if any(
            not callable(getattr(handle, method, None))
            for method in ("poll", "terminate", "wait", "kill")
        ):
            raise SupervisorError("process_handle_invalid")
        return handle  # type: ignore[return-value]

    def _start_all(self) -> dict[str, object]:
        if self.owned_roles == START_ORDER:
            return {"roles": list(START_ORDER), "status": "already_started"}
        if (
            self._stop_begun
            or self._stopped
            or (self._ever_started and not self._owned)
        ):
            raise SupervisorError("supervisor_lifecycle_complete")
        for role in START_ORDER[len(self.owned_roles) :]:
            self._start_role(role)
        return {"roles": list(START_ORDER), "status": "started"}

    def _start_role(self, role: str) -> dict[str, object]:
        if role in self._owned:
            return {"role": role, "status": "already_started"}
        if (
            self._stop_begun
            or self._stopped
            or (self._ever_started and not self._owned)
        ):
            raise SupervisorError("supervisor_lifecycle_complete")
        expected_index = len(self.owned_roles)
        if expected_index >= len(START_ORDER) or role != START_ORDER[expected_index]:
            raise SupervisorError("start_order_violation")
        self._ever_started = True
        try:
            handle = self._validate_handle(self._process_factory(role))
            self._owned = {**self._owned, role: handle}
            self._readiness_probe(role, handle)
            self._receipt_writer.write_ready(
                self._binding, role=role, ordinal=expected_index + 1
            )
        except Exception as exc:
            stopped, failures = self._reap_all()
            self._stopped_roles = (*self._stopped_roles, *stopped)
            self._stopped = not self._owned
            if not failures:
                try:
                    self._receipt_writer.write_shutdown(
                        self._binding,
                        stopped_roles=stopped,
                        complete=True,
                        reason="partial_start_cleanup",
                    )
                except Exception as receipt_exc:
                    raise SupervisorError(
                        "partial_start_receipt_failed"
                    ) from receipt_exc
            if failures:
                raise SupervisorError("partial_start_cleanup_failed") from exc
            raise SupervisorError("process_start_failed") from exc
        return {"role": role, "status": "started"}

    def _stop_all(self) -> dict[str, object]:
        if not self._owned:
            if self._stopped:
                return {"roles": [], "status": "already_stopped"}
            raise SupervisorError("children_not_started")
        self._stop_begun = True
        stopped, failures = self._reap_all()
        self._stopped_roles = (*self._stopped_roles, *stopped)
        if failures:
            raise SupervisorError("owned_child_unreaped")
        self._receipt_writer.write_shutdown(
            self._binding,
            stopped_roles=self._stopped_roles,
            complete=True,
            reason="requested",
        )
        self._stopped = True
        return {"roles": list(stopped), "status": "stopped"}

    def _stop_role(self, role: str) -> dict[str, object]:
        if role not in self._owned:
            if self._stopped or role in self._stopped_roles:
                return {"role": role, "status": "already_stopped"}
            raise SupervisorError("children_not_started")
        expected = next(
            owned_role for owned_role in STOP_ORDER if owned_role in self._owned
        )
        if role != expected:
            raise SupervisorError("stop_order_violation")
        self._stop_begun = True
        handle = self._owned[role]
        try:
            self._reap(handle)
        except Exception as exc:
            raise SupervisorError("owned_child_unreaped") from exc
        self._owned = {
            owned_role: owned_handle
            for owned_role, owned_handle in self._owned.items()
            if owned_role != role
        }
        self._stopped_roles = (*self._stopped_roles, role)
        if not self._owned:
            self._receipt_writer.write_shutdown(
                self._binding,
                stopped_roles=self._stopped_roles,
                complete=True,
                reason="requested",
            )
            self._stopped = True
        return {"role": role, "status": "stopped"}

    def _reap_all(self) -> tuple[tuple[str, ...], tuple[str, ...]]:
        stopped: list[str] = []
        failures: list[str] = []
        for role in STOP_ORDER:
            handle = self._owned.get(role)
            if handle is None:
                continue
            try:
                self._reap(handle)
            except Exception:  # noqa: BLE001 - arbitrary injected handle boundary
                failures.append(role)
                continue
            self._owned = {
                owned_role: owned_handle
                for owned_role, owned_handle in self._owned.items()
                if owned_role != role
            }
            stopped.append(role)
        return tuple(stopped), tuple(failures)

    @staticmethod
    def _reap(handle: OwnedProcess) -> None:
        try:
            returncode = handle.poll()
        except Exception as exc:
            raise SupervisorError("owned_child_poll_failed") from exc
        if returncode is not None and (
            isinstance(returncode, bool) or not isinstance(returncode, int)
        ):
            raise SupervisorError("owned_child_returncode_invalid")
        if returncode is not None:
            return
        try:
            handle.terminate()
            returncode = handle.wait(TERMINATE_TIMEOUT_SECONDS)
            if isinstance(returncode, bool) or not isinstance(returncode, int):
                raise SupervisorError("owned_child_returncode_invalid")
            return
        except Exception:  # noqa: BLE001, S110 - bounded escalation is mandatory
            pass
        try:
            handle.kill()
            returncode = handle.wait(KILL_TIMEOUT_SECONDS)
            if isinstance(returncode, bool) or not isinstance(returncode, int):
                raise SupervisorError("owned_child_returncode_invalid")
        except Exception as exc:
            raise SupervisorError("owned_child_unreaped") from exc
