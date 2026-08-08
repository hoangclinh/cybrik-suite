"""Inert supervisor core and injected Unix daemon for UAT-MTLS-D2."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import stat
import subprocess
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Final, Protocol

from .process_control import (
    KILL_WAIT_SECONDS,
    PROTOCOL_VERSION,
    SHUTDOWN_RECEIPT_VERSION,
    TERMINATE_WAIT_SECONDS,
    ControlBinding,
    ControlMaterial,
    ControlPaths,
    ControlStore,
    FileSystemAdapter,
    PosixFileSystemAdapter,
    ProcessControlError,
    RootIdentity,
    canonical_body_bytes,
    derive_control_paths,
    encode_response,
    peer_euid,
    read_wire_frame,
    sign_frame,
    validate_request_id,
    verify_frame,
    write_wire_frame,
)

SERVER_ROLE: Final = "ai_server"
SERVER_ARGV_ENV: Final = "CYBRIK_UAT_D2_SUPERVISOR_SERVER_ARGV"
SERVER_LOG_ENV: Final = "CYBRIK_UAT_D2_SUPERVISOR_SERVER_LOG"
DEFAULT_REPLAY_CACHE_CAPACITY: Final = 256
MAX_REPLAY_CACHE_CAPACITY: Final = 4096
_ACTIONS_WITHOUT_PARAMETERS: Final = frozenset({"stop_server", "stop_all", "shutdown"})


def _socket_identity(candidate: object, owner_uid: int) -> RootIdentity:
    try:
        identity = RootIdentity(
            device=int(candidate.device),
            inode=int(candidate.inode),
            owner_uid=int(candidate.owner_uid),
            mode=int(candidate.mode),
        )
    except (AttributeError, TypeError, ValueError) as exc:
        raise ProcessControlError("control_socket_invalid") from exc
    if (
        not stat.S_ISSOCK(identity.mode)
        or stat.S_IMODE(identity.mode) != 0o600
        or identity.owner_uid != owner_uid
    ):
        raise ProcessControlError("control_socket_invalid")
    return identity


class OwnedProcess(Protocol):
    def poll(self) -> int | None: ...

    def terminate(self) -> None: ...

    def wait(self, timeout: int) -> int: ...

    def kill(self) -> None: ...


ProcessFactory = Callable[[str, dict[str, object]], OwnedProcess]
ReceiptWriter = Callable[[dict[str, object]], object]


class SupervisorCore:
    """Single-owner child state machine with bounded canonical replay."""

    def __init__(
        self,
        *,
        binding: ControlBinding,
        capability: bytes,
        process_factory: ProcessFactory,
        receipt_writer: ReceiptWriter,
        replay_cache_capacity: int = DEFAULT_REPLAY_CACHE_CAPACITY,
    ) -> None:
        if (
            isinstance(replay_cache_capacity, bool)
            or not isinstance(replay_cache_capacity, int)
            or replay_cache_capacity < 1
            or replay_cache_capacity > MAX_REPLAY_CACHE_CAPACITY
        ):
            raise ProcessControlError("replay_cache_capacity_invalid")
        self._binding = binding
        self._capability = capability
        self._process_factory = process_factory
        self._receipt_writer = receipt_writer
        self._replay_cache_capacity = replay_cache_capacity
        self._owned: dict[str, OwnedProcess] = {}
        self._responses: dict[str, tuple[bytes, bytes]] = {}
        self._shutdown_requested = False

    @property
    def cached_response_count(self) -> int:
        return len(self._responses)

    @property
    def shutdown_requested(self) -> bool:
        return self._shutdown_requested

    def handle_frame(self, frame: bytes, *, peer_uid: int) -> bytes:
        body = verify_frame(frame, self._capability)
        if peer_uid != self._binding.owner_uid:
            raise ProcessControlError("peer_uid_mismatch")
        request_id, action, parameters = self._parse_request(body)
        request_identity = hashlib.sha256(canonical_body_bytes(body)).digest()
        cached = self._responses.get(request_id)
        if cached is not None:
            cached_identity, cached_response = cached
            if cached_identity != request_identity:
                raise ProcessControlError("request_id_payload_mismatch")
            return cached_response
        if len(self._responses) >= self._replay_cache_capacity:
            raise ProcessControlError("replay_cache_capacity_exhausted")
        result = self._dispatch(action, parameters)
        response = encode_response(
            binding=self._binding,
            capability=self._capability,
            request_id=request_id,
            action=action,
            result=result,
        )
        self._responses = {
            **self._responses,
            request_id: (request_identity, response),
        }
        return response

    def _parse_request(
        self, body: Mapping[str, object]
    ) -> tuple[str, str, dict[str, object]]:
        if set(body) != {
            "action",
            "binding",
            "kind",
            "parameters",
            "request_id",
            "version",
        }:
            raise ProcessControlError("request_shape_invalid")
        if body.get("version") != PROTOCOL_VERSION or body.get("kind") != "request":
            raise ProcessControlError("request_shape_invalid")
        if body.get("binding") != self._binding.as_payload():
            raise ProcessControlError("binding_mismatch")
        request_id = validate_request_id(body.get("request_id"))
        action = body.get("action")
        parameters = body.get("parameters")
        if not isinstance(action, str) or not isinstance(parameters, dict):
            raise ProcessControlError("request_shape_invalid")
        return request_id, action, parameters

    def _dispatch(
        self, action: str, parameters: dict[str, object]
    ) -> dict[str, object]:
        if action == "start_server":
            return self._start_server(parameters)
        if action not in _ACTIONS_WITHOUT_PARAMETERS:
            raise ProcessControlError("unknown_action")
        if parameters:
            raise ProcessControlError("parameters_invalid")
        if action == "stop_server":
            return self._stop_server()
        if action == "stop_all":
            return self._stop_all()
        return self._shutdown()

    def _start_server(self, parameters: dict[str, object]) -> dict[str, object]:
        strip_tls = parameters.get("strip_tls")
        if set(parameters) != {"strip_tls"} or not isinstance(strip_tls, bool):
            raise ProcessControlError("parameters_invalid")
        if SERVER_ROLE in self._owned:
            raise ProcessControlError("child_already_owned")
        child = self._process_factory(SERVER_ROLE, {"strip_tls": strip_tls})
        self._owned = {**self._owned, SERVER_ROLE: child}
        return {"role": SERVER_ROLE, "status": "started"}

    def _stop_server(self) -> dict[str, object]:
        if SERVER_ROLE not in self._owned:
            raise ProcessControlError("child_not_owned")
        returncode = self._reap_owned(SERVER_ROLE)
        return {
            "returncode": returncode,
            "role": SERVER_ROLE,
            "status": "stopped",
        }

    def _stop_all(self) -> dict[str, object]:
        stopped: dict[str, int] = {}
        for role in sorted(self._owned):
            stopped = {**stopped, role: self._reap_owned(role)}
        return {"status": "stopped_all", "stopped": stopped}

    def _shutdown(self) -> dict[str, object]:
        stopped = self._stop_all()
        receipt: dict[str, object] = {
            "all_children_reaped": not self._owned,
            "binding": self._binding.as_payload(),
            "owned_children_remaining": len(self._owned),
            "stopped": stopped["stopped"],
            "version": SHUTDOWN_RECEIPT_VERSION,
        }
        self._receipt_writer(receipt)
        self._shutdown_requested = True
        return {"status": "shutdown", "stopped": stopped["stopped"]}

    def force_shutdown(self) -> dict[str, object]:
        if self._shutdown_requested:
            return {"status": "shutdown", "stopped": {}}
        return self._shutdown()

    def _reap_owned(self, role: str) -> int:
        child = self._owned[role]
        returncode = child.poll()
        if returncode is None:
            child.terminate()
            try:
                returncode = child.wait(TERMINATE_WAIT_SECONDS)
            except Exception:  # noqa: BLE001 - bounded escalation on owned handle
                child.kill()
                try:
                    returncode = child.wait(KILL_WAIT_SECONDS)
                except Exception as exc:
                    raise ProcessControlError("owned_child_unreaped") from exc
        self._owned = {
            owned_role: owned_child
            for owned_role, owned_child in self._owned.items()
            if owned_role != role
        }
        return returncode


class SupervisorDaemon:
    """One injected AF_UNIX listener dispatching bounded frames to the core."""

    def __init__(
        self,
        *,
        core: object,
        binding: ControlBinding,
        capability: bytes,
        paths: ControlPaths,
        filesystem: FileSystemAdapter,
        expected_root_identity: RootIdentity | None = None,
        socket_factory: Callable[[int, int], object] = socket.socket,
        peer_euid_reader: Callable[[object], int] = peer_euid,
        ready_writer: Callable[[object], object],
    ) -> None:
        self._core = core
        self._binding = binding
        self._capability = capability
        self._paths = paths
        self._filesystem = filesystem
        self._expected_root_identity = expected_root_identity
        self._socket_factory = socket_factory
        self._peer_euid_reader = peer_euid_reader
        self._ready_writer = ready_writer
        self._listener: object | None = None
        self._owned_socket_identity: RootIdentity | None = None

    def _verify_root_identity(self) -> None:
        if self._expected_root_identity is not None:
            stat_directory = getattr(self._filesystem, "stat_directory", None)
            if not callable(stat_directory):
                raise ProcessControlError("control_root_identity_unavailable")
            if (
                stat_directory(self._paths.root, nofollow=True)
                != self._expected_root_identity
            ):
                raise ProcessControlError("control_root_replaced")

    def bind_and_mark_ready(self) -> None:
        if self._listener is not None:
            raise ProcessControlError("supervisor_listener_already_bound")
        self._verify_root_identity()
        listener = self._socket_factory(socket.AF_UNIX, socket.SOCK_STREAM)
        binder = getattr(listener, "bind", None)
        listen = getattr(listener, "listen", None)
        if not callable(binder) or not callable(listen):
            raise ProcessControlError("control_socket_invalid")
        bound = False
        owned_socket_identity: RootIdentity | None = None
        try:
            binder(str(self._paths.socket))
            bound = True
            self._verify_root_identity()
            self._filesystem.chmod_socket(self._paths.socket, 0o600)
            owned_socket_identity = _socket_identity(
                self._filesystem.stat_socket(self._paths.socket, nofollow=True),
                self._binding.owner_uid,
            )
            self._verify_root_identity()
            listen(1)
            ready = sign_frame(
                {
                    "binding": self._binding.as_payload(),
                    "status": "ready",
                    "version": PROTOCOL_VERSION,
                },
                self._capability,
            )
            self._ready_writer(ready)
        except BaseException:
            closer = getattr(listener, "close", None)
            if callable(closer):
                closer()
            if bound:
                unlinker = getattr(self._filesystem, "unlink_socket", None)
                if not callable(unlinker):
                    raise ProcessControlError("control_socket_cleanup_unavailable")
                unlinker(
                    self._paths.socket,
                    owner_uid=self._binding.owner_uid,
                    expected_identity=owned_socket_identity,
                )
            raise
        self._listener = listener
        self._owned_socket_identity = owned_socket_identity

    def serve_once(self) -> None:
        if self._listener is None:
            raise ProcessControlError("supervisor_listener_not_bound")
        accept = getattr(self._listener, "accept", None)
        if not callable(accept):
            raise ProcessControlError("control_socket_invalid")
        connection, _address = accept()
        try:
            peer_uid = self._peer_euid_reader(connection)
            frame = read_wire_frame(connection)
            handler = getattr(self._core, "handle_frame", None)
            if not callable(handler):
                raise ProcessControlError("supervisor_core_invalid")
            response = handler(frame, peer_uid=peer_uid)
            write_wire_frame(connection, response)
        finally:
            closer = getattr(connection, "close", None)
            if callable(closer):
                closer()

    def close(self) -> None:
        listener = self._listener
        owned_socket_identity = self._owned_socket_identity
        self._listener = None
        self._owned_socket_identity = None
        if listener is not None:
            closer = getattr(listener, "close", None)
            if callable(closer):
                closer()
            unlinker = getattr(self._filesystem, "unlink_socket", None)
            if callable(unlinker):
                if owned_socket_identity is None:
                    raise ProcessControlError("control_socket_identity_unavailable")
                unlinker(
                    self._paths.socket,
                    owner_uid=self._binding.owner_uid,
                    expected_identity=owned_socket_identity,
                )

    def serve_until_shutdown(self, *, release_liveness: Callable[[], object]) -> None:
        try:
            while not bool(getattr(self._core, "shutdown_requested", False)):
                self.serve_once()
        finally:
            self.close()
            release_liveness()


class _PopenOwnedProcess:
    """Popen handle retained only inside the supervisor process."""

    def __init__(self, process: subprocess.Popen[str], log: object) -> None:
        self._process = process
        self._log = log

    def poll(self) -> int | None:
        return self._process.poll()

    def terminate(self) -> None:
        self._process.terminate()

    def wait(self, timeout: int) -> int:
        try:
            return self._process.wait(timeout=timeout)
        finally:
            if self._process.poll() is not None:
                self._close_log()

    def kill(self) -> None:
        self._process.kill()

    def _close_log(self) -> None:
        closer = getattr(self._log, "close", None)
        if callable(closer):
            closer()


class ServerProcessFactory:
    """Create the admitted server while keeping its handle supervisor-local."""

    def __init__(
        self,
        *,
        argv: tuple[str, ...],
        environment: Mapping[str, str],
        log_path: Path,
        popen: Callable[..., subprocess.Popen[str]] = subprocess.Popen,
    ) -> None:
        if (
            not argv
            or not Path(argv[0]).is_absolute()
            or not Path(log_path).is_absolute()
            or any(not isinstance(item, str) or not item for item in argv)
        ):
            raise ProcessControlError("supervisor_process_spec_invalid")
        self._argv = argv
        self._environment = dict(environment)
        self._log_path = Path(log_path)
        self._popen = popen

    def __call__(self, role: str, parameters: dict[str, object]) -> OwnedProcess:
        strip_tls = parameters.get("strip_tls")
        if role != SERVER_ROLE or not isinstance(strip_tls, bool):
            raise ProcessControlError("supervisor_process_spec_invalid")
        environment = {
            **self._environment,
            "CYBRIK_UAT_D2_STRIP_TLS_EXTENSION": "true" if strip_tls else "false",
        }
        log = self._log_path.open("a", encoding="utf-8")
        try:
            process = self._popen(
                self._argv,
                stdout=log,
                stderr=subprocess.STDOUT,
                text=True,
                env=environment,
                shell=False,
            )
        except BaseException:
            log.close()
            raise
        return _PopenOwnedProcess(process, log)


def launch_supervisor(
    *,
    argv: tuple[str, ...],
    environment: Mapping[str, str],
    log_path: Path,
    popen: Callable[..., subprocess.Popen[str]] = subprocess.Popen,
) -> subprocess.Popen[str]:
    """Launch only the supervisor; no numeric process authority is persisted."""

    if not argv or not Path(argv[0]).is_absolute() or not Path(log_path).is_absolute():
        raise ProcessControlError("supervisor_process_spec_invalid")
    with Path(log_path).open("a", encoding="utf-8") as log:
        return popen(
            argv,
            stdout=log,
            stderr=subprocess.STDOUT,
            text=True,
            env=dict(environment),
            shell=False,
        )


def reap_launched_supervisor(process: OwnedProcess) -> None:
    """Boundedly reap a supervisor that failed its same-invocation bootstrap."""

    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(TERMINATE_WAIT_SECONDS)
    except subprocess.TimeoutExpired:
        process.kill()
        try:
            process.wait(KILL_WAIT_SECONDS)
        except subprocess.TimeoutExpired as exc:
            raise ProcessControlError("supervisor_process_unreaped") from exc


def run_supervisor(
    *,
    material: ControlMaterial,
    store: ControlStore,
    filesystem: FileSystemAdapter,
    process_factory: ProcessFactory,
    socket_factory: Callable[[int, int], object] = socket.socket,
    peer_euid_reader: Callable[[object], int] = peer_euid,
) -> None:
    """Own children and liveness until authenticated shutdown completes."""

    liveness = store.acquire_liveness(material)
    released = False

    def release() -> None:
        nonlocal released
        if not released:
            store.release_liveness(liveness)
            released = True

    core = SupervisorCore(
        binding=material.binding,
        capability=material.capability,
        process_factory=process_factory,
        receipt_writer=lambda receipt: store.write_shutdown_receipt(material, receipt),
    )
    daemon = SupervisorDaemon(
        core=core,
        binding=material.binding,
        capability=material.capability,
        paths=material.paths,
        filesystem=filesystem,
        expected_root_identity=material.root_identity,
        socket_factory=socket_factory,
        peer_euid_reader=peer_euid_reader,
        ready_writer=lambda _record: store.write_ready_receipt(material),
    )
    try:
        daemon.bind_and_mark_ready()
        daemon.serve_until_shutdown(release_liveness=release)
    finally:
        try:
            core.force_shutdown()
        finally:
            daemon.close()
            release()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cybrik-uat-d2-process-supervisor")
    parser.add_argument("--runtime-root", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--generation", type=int, required=True)
    parser.add_argument("--owner-uid", type=int, required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Executable boundary; importing this module remains side-effect free."""

    arguments = _parser().parse_args(argv)
    try:
        binding = ControlBinding(
            authorization_sha256=arguments.authorization_sha256,
            run_id=arguments.run_id,
            generation=arguments.generation,
            owner_uid=arguments.owner_uid,
        )
        paths = derive_control_paths(
            arguments.runtime_root, arguments.authorization_sha256
        )
        raw_argv = json.loads(os.environ[SERVER_ARGV_ENV])
        log_path = Path(os.environ[SERVER_LOG_ENV])
        if not isinstance(raw_argv, list) or not all(
            isinstance(item, str) for item in raw_argv
        ):
            raise ProcessControlError("supervisor_process_spec_invalid")
        filesystem = PosixFileSystemAdapter()
        store = ControlStore(filesystem=filesystem)
        material = store.load(paths=paths, expected_binding=binding)
        process_factory = ServerProcessFactory(
            argv=tuple(raw_argv),
            environment={
                key: value
                for key, value in os.environ.items()
                if key not in {SERVER_ARGV_ENV, SERVER_LOG_ENV}
            },
            log_path=log_path,
        )
        run_supervisor(
            material=material,
            store=store,
            filesystem=filesystem,
            process_factory=process_factory,
        )
    except (KeyError, OSError, ProcessControlError, ValueError):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
