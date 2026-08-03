"""Authenticated, bounded process-control protocol for UAT-MTLS-D2.

Importing this module is inert.  Runtime filesystem and socket operations are
available only through injected adapters, and numeric process identifiers are
never part of the authority model.
"""

from __future__ import annotations

import ctypes
import fcntl
import hashlib
import hmac
import json
import os
import re
import secrets
import socket
import stat
import struct
import sys
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Protocol

PROTOCOL_VERSION: Final = "CYBRIK-D2-PROCESS-CONTROL/v1"
BINDING_RECORD_VERSION: Final = "CYBRIK-D2-CONTROL-BINDING/v1"
READY_RECEIPT_VERSION: Final = "CYBRIK-D2-CONTROL-READY/v1"
SHUTDOWN_RECEIPT_VERSION: Final = "CYBRIK-D2-SHUTDOWN-RECEIPT/v1"
MAX_FRAME_BYTES: Final = 8 * 1024
MAX_BINDING_BYTES: Final = 4 * 1024
MAX_UNIX_SOCKET_PATH_BYTES: Final = 100
CAPABILITY_BYTES: Final = 32
MIN_CAPABILITY_BYTES: Final = CAPABILITY_BYTES
TERMINATE_WAIT_SECONDS: Final = 15
KILL_WAIT_SECONDS: Final = 5
TEARDOWN_STOP_ALL_REQUEST_ID: Final = "coordinated-teardown-stop-all"
TEARDOWN_SHUTDOWN_REQUEST_ID: Final = "coordinated-teardown-shutdown"

_SHA256_HEX: Final = re.compile(r"[0-9a-f]{64}")
_RUN_ID_PATTERN: Final = re.compile(r"[0-9a-f]{32}")
_REQUEST_ID_PATTERN: Final = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
_CONTROL_ROOT_PREFIX: Final = "cybrik-d2-ctl-"


class ProcessControlError(RuntimeError):
    """Fail-closed rejection carrying only one stable, non-secret reason."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class ControlBinding:
    authorization_sha256: str
    run_id: str
    generation: int
    owner_uid: int

    def __post_init__(self) -> None:
        if not isinstance(self.authorization_sha256, str) or not _SHA256_HEX.fullmatch(
            self.authorization_sha256
        ):
            raise ProcessControlError("binding_authorization_sha256_invalid")
        if not isinstance(self.run_id, str) or not _RUN_ID_PATTERN.fullmatch(
            self.run_id
        ):
            raise ProcessControlError("binding_run_id_invalid")
        if (
            isinstance(self.generation, bool)
            or not isinstance(self.generation, int)
            or self.generation < 1
        ):
            raise ProcessControlError("binding_generation_invalid")
        if (
            isinstance(self.owner_uid, bool)
            or not isinstance(self.owner_uid, int)
            or self.owner_uid < 0
        ):
            raise ProcessControlError("binding_owner_uid_invalid")

    def as_payload(self) -> dict[str, object]:
        return {
            "authorization_sha256": self.authorization_sha256,
            "generation": self.generation,
            "owner_uid": self.owner_uid,
            "run_id": self.run_id,
        }


@dataclass(frozen=True, slots=True)
class ControlPaths:
    root: Path
    socket: Path
    capability: Path
    binding: Path
    ready: Path
    liveness_lock: Path
    shutdown_receipt: Path


@dataclass(frozen=True, slots=True)
class RootIdentity:
    device: int
    inode: int
    owner_uid: int
    mode: int

    def as_payload(self) -> dict[str, int]:
        return {
            "root_device": self.device,
            "root_inode": self.inode,
            "root_mode": self.mode,
            "root_owner_uid": self.owner_uid,
        }


@dataclass(frozen=True, slots=True)
class PersistedControlBinding:
    binding: ControlBinding
    root_identity: RootIdentity

    def as_payload(self) -> dict[str, object]:
        return {
            **self.binding.as_payload(),
            **self.root_identity.as_payload(),
            "version": BINDING_RECORD_VERSION,
        }


@dataclass(frozen=True, slots=True)
class ControlMaterial:
    paths: ControlPaths
    binding: ControlBinding
    root_identity: RootIdentity
    capability: bytes
    persisted_binding: PersistedControlBinding


@dataclass(frozen=True, slots=True)
class StableLeafRead:
    data: bytes
    before: RootIdentity
    after: RootIdentity


class ControlTransport(Protocol):
    def exchange(self, frame: bytes) -> bytes: ...


class FileSystemAdapter(Protocol):
    def open_directory(self, path: Path, *, nofollow: bool) -> object: ...

    def mkdir_open(
        self, path: Path, *, mode: int, exclusive: bool, nofollow: bool
    ) -> object: ...

    def stat_handle(self, handle: object) -> object: ...

    def stat_directory(self, path: Path, *, nofollow: bool) -> object: ...

    def close_handle(self, handle: object) -> None: ...

    def create_at(
        self,
        handle: object,
        name: str,
        data: bytes,
        *,
        mode: int,
        exclusive: bool,
        nofollow: bool,
    ) -> None: ...

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
    ) -> None: ...

    def read_at_stable(
        self,
        handle: object,
        name: str,
        *,
        max_bytes: int,
        mode: int,
        owner_uid: int,
        nofollow: bool,
    ) -> object: ...

    def stat_socket(self, path: Path, *, nofollow: bool) -> object: ...

    def chmod_socket(self, path: Path, mode: int) -> None: ...

    def acquire_liveness(
        self,
        handle: object,
        name: str,
        *,
        mode: int,
        owner_uid: int,
        nofollow: bool,
    ) -> object: ...

    def release_liveness(self, authority: object) -> None: ...

    def liveness_released(
        self,
        handle: object,
        name: str,
        *,
        mode: int,
        owner_uid: int,
        nofollow: bool,
    ) -> bool: ...

    def unlink_socket(
        self,
        path: Path,
        *,
        owner_uid: int,
        expected_identity: RootIdentity,
    ) -> None: ...

    def remove_control_root(
        self,
        path: Path,
        *,
        expected_identity: RootIdentity,
        allowed_leaves: frozenset[str],
    ) -> None: ...


class PosixFileSystemAdapter:
    """Fail-closed descriptor-relative filesystem implementation.

    The only pathname open is the absolute parent-directory bootstrap. Every
    controlled leaf operation is relative to an ``O_DIRECTORY|O_NOFOLLOW``
    descriptor and verifies owner, type, mode, and stable identity.
    """

    def __init__(
        self,
        *,
        os_module: object = os,
        fcntl_module: object = fcntl,
        temporary_name: Callable[[], str] | None = None,
    ) -> None:
        self._os = os_module
        self._fcntl = fcntl_module
        self._temporary_name = temporary_name or (lambda: secrets.token_hex(12))
        if not getattr(self._os, "O_DIRECTORY", 0) or not getattr(
            self._os, "O_NOFOLLOW", 0
        ):
            raise ProcessControlError("posix_nofollow_unavailable")

    def _flags(self, access: int, *, directory: bool = False) -> int:
        flags = access | int(self._os.O_NOFOLLOW)
        if directory:
            flags |= int(self._os.O_DIRECTORY)
        return flags

    @staticmethod
    def _path(path: Path) -> Path:
        candidate = Path(path)
        if (
            not candidate.is_absolute()
            or candidate == Path(candidate.anchor)
            or candidate.name in {"", ".", ".."}
        ):
            raise ProcessControlError("control_path_invalid")
        return candidate

    @staticmethod
    def _leaf(name: str) -> str:
        if (
            not isinstance(name, str)
            or not name
            or name in {".", ".."}
            or Path(name).name != name
        ):
            raise ProcessControlError("control_leaf_name_invalid")
        return name

    def _open_parent(self, path: Path) -> int:
        candidate = self._path(path)
        return self._open_absolute_directory(candidate.parent)

    def _open_absolute_directory(self, path: Path) -> int:
        candidate = Path(path)
        if not candidate.is_absolute():
            raise ProcessControlError("control_path_invalid")
        descriptor: int | None = None
        try:
            descriptor = int(
                self._os.open(
                    candidate.anchor,
                    self._flags(int(self._os.O_RDONLY), directory=True),
                )
            )
            for component in candidate.parts[1:]:
                next_descriptor = int(
                    self._os.open(
                        self._leaf(component),
                        self._flags(int(self._os.O_RDONLY), directory=True),
                        dir_fd=descriptor,
                    )
                )
                self._os.close(descriptor)
                descriptor = next_descriptor
            return descriptor
        except OSError as exc:
            if descriptor is not None:
                self._os.close(descriptor)
            raise ProcessControlError("control_parent_unavailable") from exc

    def open_directory(self, path: Path, *, nofollow: bool) -> int:
        if nofollow is not True:
            raise ProcessControlError("control_nofollow_required")
        candidate = self._path(path)
        parent = self._open_parent(candidate)
        try:
            return int(
                self._os.open(
                    candidate.name,
                    self._flags(int(self._os.O_RDONLY), directory=True),
                    dir_fd=parent,
                )
            )
        except OSError as exc:
            raise ProcessControlError("control_root_unavailable") from exc
        finally:
            self._os.close(parent)

    def mkdir_open(
        self, path: Path, *, mode: int, exclusive: bool, nofollow: bool
    ) -> int:
        if exclusive is not True or nofollow is not True or mode != 0o700:
            raise ProcessControlError("control_root_creation_invalid")
        candidate = self._path(path)
        parent = self._open_parent(candidate)
        try:
            self._os.mkdir(candidate.name, mode, dir_fd=parent)
            handle = int(
                self._os.open(
                    candidate.name,
                    self._flags(int(self._os.O_RDONLY), directory=True),
                    dir_fd=parent,
                )
            )
        except OSError as exc:
            raise ProcessControlError("control_root_creation_failed") from exc
        finally:
            self._os.close(parent)
        return handle

    def stat_handle(self, handle: object) -> RootIdentity:
        try:
            return self._stat_identity(self._os.fstat(int(handle)))
        except (OSError, TypeError, ValueError) as exc:
            raise ProcessControlError("control_identity_invalid") from exc

    def close_handle(self, handle: object) -> None:
        self._os.close(int(handle))

    def stat_directory(self, path: Path, *, nofollow: bool) -> RootIdentity:
        handle = self.open_directory(path, nofollow=nofollow)
        try:
            return self.stat_handle(handle)
        finally:
            self.close_handle(handle)

    @staticmethod
    def _stat_identity(candidate: object) -> RootIdentity:
        try:
            return RootIdentity(
                device=int(candidate.st_dev),
                inode=int(candidate.st_ino),
                owner_uid=int(candidate.st_uid),
                mode=int(candidate.st_mode),
            )
        except (AttributeError, TypeError, ValueError) as exc:
            raise ProcessControlError("control_identity_invalid") from exc

    def _validate_regular_fd(
        self, descriptor: int, *, mode: int, owner_uid: int
    ) -> RootIdentity:
        identity = self._stat_identity(self._os.fstat(descriptor))
        if (
            not stat.S_ISREG(identity.mode)
            or stat.S_IMODE(identity.mode) != mode
            or identity.owner_uid != owner_uid
        ):
            raise ProcessControlError("control_leaf_invalid")
        return identity

    def _write_all(self, descriptor: int, data: bytes) -> None:
        offset = 0
        while offset < len(data):
            written = self._os.write(descriptor, data[offset:])
            if isinstance(written, bool) or not isinstance(written, int) or written < 1:
                raise ProcessControlError("control_leaf_write_failed")
            offset += written

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
        if exclusive is not True or nofollow is not True or not isinstance(data, bytes):
            raise ProcessControlError("control_leaf_creation_invalid")
        descriptor: int | None = None
        try:
            descriptor = int(
                self._os.open(
                    self._leaf(name),
                    self._flags(int(self._os.O_WRONLY))
                    | int(self._os.O_CREAT)
                    | int(self._os.O_EXCL),
                    mode,
                    dir_fd=int(handle),
                )
            )
            self._validate_regular_fd(
                descriptor, mode=mode, owner_uid=int(self._os.geteuid())
            )
            self._write_all(descriptor, data)
            self._os.fsync(descriptor)
            self._validate_regular_fd(
                descriptor, mode=mode, owner_uid=int(self._os.geteuid())
            )
        except OSError as exc:
            raise ProcessControlError("control_leaf_creation_failed") from exc
        finally:
            if descriptor is not None:
                self._os.close(descriptor)

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
        if (
            nofollow is not True
            or fsync_file is not True
            or fsync_directory is not True
            or not isinstance(data, bytes)
        ):
            raise ProcessControlError("control_atomic_write_invalid")
        leaf = self._leaf(name)
        temporary = self._leaf(f".{leaf}.{self._temporary_name()}.tmp")
        descriptor: int | None = None
        temporary_created = False
        try:
            descriptor = int(
                self._os.open(
                    temporary,
                    self._flags(int(self._os.O_WRONLY))
                    | int(self._os.O_CREAT)
                    | int(self._os.O_EXCL),
                    mode,
                    dir_fd=int(handle),
                )
            )
            temporary_created = True
            self._validate_regular_fd(
                descriptor, mode=mode, owner_uid=int(self._os.geteuid())
            )
            self._write_all(descriptor, data)
            self._os.fsync(descriptor)
            self._validate_regular_fd(
                descriptor, mode=mode, owner_uid=int(self._os.geteuid())
            )
            self._os.close(descriptor)
            descriptor = None
            self._os.link(
                temporary,
                leaf,
                src_dir_fd=int(handle),
                dst_dir_fd=int(handle),
                follow_symlinks=False,
            )
            self._os.unlink(temporary, dir_fd=int(handle))
            temporary_created = False
            self._os.fsync(int(handle))
        except FileExistsError as exc:
            raise ProcessControlError("control_leaf_already_exists") from exc
        except ProcessControlError:
            raise
        except OSError as exc:
            raise ProcessControlError("control_atomic_write_failed") from exc
        finally:
            if descriptor is not None:
                self._os.close(descriptor)
            if temporary_created:
                try:
                    self._os.unlink(temporary, dir_fd=int(handle))
                except OSError:
                    pass

    def read_at_stable(
        self,
        handle: object,
        name: str,
        *,
        max_bytes: int,
        mode: int,
        owner_uid: int,
        nofollow: bool,
    ) -> StableLeafRead:
        if nofollow is not True or max_bytes < 1:
            raise ProcessControlError("control_stable_read_invalid")
        descriptor: int | None = None
        try:
            descriptor = int(
                self._os.open(
                    self._leaf(name),
                    self._flags(int(self._os.O_RDONLY)),
                    dir_fd=int(handle),
                )
            )
            before = self._validate_regular_fd(
                descriptor, mode=mode, owner_uid=owner_uid
            )
            chunks: list[bytes] = []
            remaining = max_bytes + 1
            while remaining:
                chunk = self._os.read(descriptor, remaining)
                if not isinstance(chunk, bytes):
                    raise ProcessControlError("control_leaf_read_failed")
                if not chunk:
                    break
                chunks.append(chunk)
                remaining -= len(chunk)
            data = b"".join(chunks)
            after = self._validate_regular_fd(
                descriptor, mode=mode, owner_uid=owner_uid
            )
            if before != after:
                raise ProcessControlError("control_leaf_replaced")
            if len(data) > max_bytes:
                raise ProcessControlError("control_leaf_too_large")
            return StableLeafRead(data=data, before=before, after=after)
        except OSError as exc:
            raise ProcessControlError("control_leaf_read_failed") from exc
        finally:
            if descriptor is not None:
                self._os.close(descriptor)

    def stat_socket(self, path: Path, *, nofollow: bool) -> RootIdentity:
        if nofollow is not True:
            raise ProcessControlError("control_nofollow_required")
        candidate = self._path(path)
        parent = self.open_directory(candidate.parent, nofollow=True)
        try:
            return self._stat_identity(
                self._os.stat(candidate.name, dir_fd=parent, follow_symlinks=False)
            )
        except OSError as exc:
            raise ProcessControlError("control_socket_unavailable") from exc
        finally:
            self._os.close(parent)

    def chmod_socket(self, path: Path, mode: int) -> None:
        candidate = self._path(path)
        parent = self.open_directory(candidate.parent, nofollow=True)
        try:
            before = self._stat_identity(
                self._os.stat(candidate.name, dir_fd=parent, follow_symlinks=False)
            )
            if not stat.S_ISSOCK(before.mode) or before.owner_uid != self._os.geteuid():
                raise ProcessControlError("control_socket_invalid")
            self._os.chmod(
                candidate.name,
                mode,
                dir_fd=parent,
                follow_symlinks=False,
            )
            after = self._stat_identity(
                self._os.stat(candidate.name, dir_fd=parent, follow_symlinks=False)
            )
            if (before.device, before.inode, before.owner_uid) != (
                after.device,
                after.inode,
                after.owner_uid,
            ) or stat.S_IMODE(after.mode) != mode:
                raise ProcessControlError("control_socket_replaced")
        except OSError as exc:
            raise ProcessControlError("control_socket_invalid") from exc
        finally:
            self._os.close(parent)

    def acquire_liveness(
        self,
        handle: object,
        name: str,
        *,
        mode: int,
        owner_uid: int,
        nofollow: bool,
    ) -> int:
        if nofollow is not True:
            raise ProcessControlError("control_nofollow_required")
        descriptor: int | None = None
        try:
            descriptor = int(
                self._os.open(
                    self._leaf(name),
                    self._flags(int(self._os.O_RDWR)),
                    dir_fd=int(handle),
                )
            )
            self._validate_regular_fd(descriptor, mode=mode, owner_uid=owner_uid)
            self._fcntl.flock(
                descriptor,
                int(self._fcntl.LOCK_EX) | int(self._fcntl.LOCK_NB),
            )
            return descriptor
        except (OSError, BlockingIOError) as exc:
            if descriptor is not None:
                self._os.close(descriptor)
            raise ProcessControlError("liveness_authority_unavailable") from exc

    def release_liveness(self, authority: object) -> None:
        descriptor = int(authority)
        try:
            self._fcntl.flock(descriptor, int(self._fcntl.LOCK_UN))
        finally:
            self._os.close(descriptor)

    def liveness_released(
        self,
        handle: object,
        name: str,
        *,
        mode: int,
        owner_uid: int,
        nofollow: bool,
    ) -> bool:
        try:
            authority = self.acquire_liveness(
                handle,
                name,
                mode=mode,
                owner_uid=owner_uid,
                nofollow=nofollow,
            )
        except ProcessControlError as exc:
            if isinstance(exc.__cause__, BlockingIOError):
                return False
            raise
        self.release_liveness(authority)
        return True

    def unlink_socket(
        self,
        path: Path,
        *,
        owner_uid: int,
        expected_identity: RootIdentity,
    ) -> None:
        candidate = self._path(path)
        parent = self.open_directory(candidate.parent, nofollow=True)
        try:
            identity = self._stat_identity(
                self._os.stat(candidate.name, dir_fd=parent, follow_symlinks=False)
            )
            if identity != _identity(expected_identity):
                raise ProcessControlError("control_socket_replaced")
            if (
                not stat.S_ISSOCK(identity.mode)
                or stat.S_IMODE(identity.mode) != 0o600
                or identity.owner_uid != owner_uid
            ):
                raise ProcessControlError("control_socket_invalid")
            self._os.unlink(candidate.name, dir_fd=parent)
            self._os.fsync(parent)
        except FileNotFoundError:
            return
        except OSError as exc:
            raise ProcessControlError("control_socket_cleanup_failed") from exc
        finally:
            self._os.close(parent)

    def remove_control_root(
        self,
        path: Path,
        *,
        expected_identity: RootIdentity,
        allowed_leaves: frozenset[str],
    ) -> None:
        candidate = self._path(path)
        parent = self._open_parent(candidate)
        handle: int | None = None
        try:
            handle = int(
                self._os.open(
                    candidate.name,
                    self._flags(int(self._os.O_RDONLY), directory=True),
                    dir_fd=parent,
                )
            )
            observed = self.stat_handle(handle)
            if observed != expected_identity:
                raise ProcessControlError("control_root_replaced")
            leaves = frozenset(self._os.listdir(handle))
            if not leaves.issubset(allowed_leaves):
                raise ProcessControlError("control_root_contains_unknown_leaf")
            for leaf in sorted(leaves):
                self._os.unlink(self._leaf(leaf), dir_fd=handle)
            self._os.fsync(handle)
            self._os.close(handle)
            handle = None
            current = self._stat_identity(
                self._os.stat(candidate.name, dir_fd=parent, follow_symlinks=False)
            )
            if current != expected_identity:
                raise ProcessControlError("control_root_replaced")
            self._os.rmdir(candidate.name, dir_fd=parent)
            self._os.fsync(parent)
        except OSError as exc:
            raise ProcessControlError("control_root_cleanup_failed") from exc
        finally:
            if handle is not None:
                self._os.close(handle)
            self._os.close(parent)


def canonical_body_bytes(payload: object) -> bytes:
    try:
        rendered = json.dumps(
            payload, sort_keys=True, separators=(",", ":"), allow_nan=False
        )
    except (TypeError, ValueError) as exc:
        raise ProcessControlError("frame_not_canonical_json") from exc
    return rendered.encode("utf-8")


def _require_capability(capability: bytes, *, exact: bool = False) -> bytes:
    valid_length = (
        (
            len(capability) == CAPABILITY_BYTES
            if exact
            else len(capability) >= MIN_CAPABILITY_BYTES
        )
        if isinstance(capability, bytes)
        else False
    )
    if not valid_length:
        raise ProcessControlError("capability_invalid")
    return capability


def _frame_mac(body_bytes: bytes, capability: bytes) -> str:
    return hmac.new(capability, body_bytes, hashlib.sha256).hexdigest()


def sign_frame(payload: Mapping[str, object], capability: bytes) -> bytes:
    _require_capability(capability)
    if not isinstance(payload, Mapping):
        raise ProcessControlError("frame_payload_not_mapping")
    body = dict(payload)
    frame = canonical_body_bytes(
        {"body": body, "mac": _frame_mac(canonical_body_bytes(body), capability)}
    )
    if len(frame) > MAX_FRAME_BYTES:
        raise ProcessControlError("frame_too_large")
    return frame


def verify_frame(frame: bytes, capability: bytes) -> dict[str, object]:
    _require_capability(capability)
    if not isinstance(frame, bytes):
        raise ProcessControlError("frame_not_bytes")
    if len(frame) > MAX_FRAME_BYTES:
        raise ProcessControlError("frame_too_large")
    try:
        parsed = json.loads(frame.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise ProcessControlError("frame_authentication_failed") from exc
    if not isinstance(parsed, dict) or set(parsed) != {"body", "mac"}:
        raise ProcessControlError("frame_authentication_failed")
    body = parsed["body"]
    mac = parsed["mac"]
    if not isinstance(body, dict) or not isinstance(mac, str):
        raise ProcessControlError("frame_authentication_failed")
    expected = _frame_mac(canonical_body_bytes(body), capability)
    if not hmac.compare_digest(expected, mac):
        raise ProcessControlError("frame_authentication_failed")
    return body


def validate_request_id(request_id: object) -> str:
    if not isinstance(request_id, str) or not _REQUEST_ID_PATTERN.fullmatch(request_id):
        raise ProcessControlError("request_id_invalid")
    return request_id


def encode_request(
    *,
    binding: ControlBinding,
    capability: bytes,
    request_id: str,
    action: str,
    parameters: Mapping[str, object],
) -> bytes:
    return sign_frame(
        {
            "action": action,
            "binding": binding.as_payload(),
            "kind": "request",
            "parameters": dict(parameters),
            "request_id": validate_request_id(request_id),
            "version": PROTOCOL_VERSION,
        },
        capability,
    )


def encode_response(
    *,
    binding: ControlBinding,
    capability: bytes,
    request_id: str,
    action: str,
    result: Mapping[str, object],
) -> bytes:
    return sign_frame(
        {
            "action": action,
            "binding": binding.as_payload(),
            "kind": "response",
            "request_id": validate_request_id(request_id),
            "result": dict(result),
            "version": PROTOCOL_VERSION,
        },
        capability,
    )


def derive_control_paths(runtime_root: Path, authorization_sha256: str) -> ControlPaths:
    root_path = Path(runtime_root)
    if not root_path.is_absolute() or not _SHA256_HEX.fullmatch(authorization_sha256):
        raise ProcessControlError("control_path_binding_invalid")
    root = root_path.parent / f"{_CONTROL_ROOT_PREFIX}{authorization_sha256[:20]}"
    paths = ControlPaths(
        root=root,
        socket=root / "s",
        capability=root / "capability.bin",
        binding=root / "binding.json",
        ready=root / "ready.json",
        liveness_lock=root / "liveness.lock",
        shutdown_receipt=root / "shutdown-receipt.json",
    )
    if len(str(paths.socket).encode("utf-8")) > MAX_UNIX_SOCKET_PATH_BYTES:
        raise ProcessControlError("control_socket_path_too_long")
    return paths


def _identity(candidate: object) -> RootIdentity:
    try:
        return RootIdentity(
            device=int(candidate.device),
            inode=int(candidate.inode),
            owner_uid=int(candidate.owner_uid),
            mode=int(candidate.mode),
        )
    except (AttributeError, TypeError, ValueError) as exc:
        raise ProcessControlError("control_identity_invalid") from exc


def _validate_root(identity: RootIdentity, owner_uid: int) -> None:
    if not stat.S_ISDIR(identity.mode):
        raise ProcessControlError("control_root_not_directory")
    if identity.owner_uid != owner_uid:
        raise ProcessControlError("control_root_owner_mismatch")
    if stat.S_IMODE(identity.mode) != 0o700:
        raise ProcessControlError("control_root_mode_mismatch")


def _stable_leaf(
    candidate: object, *, expected_mode: int, expected_owner_uid: int
) -> bytes:
    try:
        data = bytes(candidate.data)
        before = _identity(candidate.before)
        after = _identity(candidate.after)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ProcessControlError("control_leaf_invalid") from exc
    if before != after:
        raise ProcessControlError("control_leaf_replaced")
    if (
        not stat.S_ISREG(before.mode)
        or stat.S_IMODE(before.mode) != expected_mode
        or before.owner_uid != expected_owner_uid
    ):
        raise ProcessControlError("control_leaf_invalid")
    return data


def _binding_record(persisted: PersistedControlBinding, capability: bytes) -> bytes:
    return sign_frame(persisted.as_payload(), capability)


def verify_binding_record(
    record: bytes,
    *,
    capability: bytes,
    expected_binding: ControlBinding,
    expected_root_identity: RootIdentity,
) -> PersistedControlBinding:
    body = verify_frame(record, capability)
    expected = PersistedControlBinding(expected_binding, expected_root_identity)
    if body != expected.as_payload() or record != _binding_record(expected, capability):
        raise ProcessControlError("control_binding_mismatch")
    return expected


class ControlStore:
    """Descriptor-relative control material over one injected filesystem."""

    def __init__(self, *, filesystem: FileSystemAdapter) -> None:
        self._filesystem = filesystem
        self._handles: dict[Path, object] = {}

    def _remember(self, root: Path, handle: object) -> None:
        self._handles = {**self._handles, root: handle}

    def _handle(self, root: Path) -> object:
        handle = self._handles.get(root)
        if handle is None:
            opener = getattr(self._filesystem, "open_directory", None)
            if not callable(opener):
                raise ProcessControlError("control_root_handle_unavailable")
            handle = opener(root, nofollow=True)
            self._remember(root, handle)
        return handle

    def _verified_handle(self, material: ControlMaterial) -> object:
        handle = self._handle(material.paths.root)
        observed = _identity(self._filesystem.stat_handle(handle))
        _validate_root(observed, material.binding.owner_uid)
        if observed != material.root_identity:
            raise ProcessControlError("control_root_replaced")
        return handle

    def create(
        self,
        *,
        paths: ControlPaths,
        binding: ControlBinding,
        random_bytes: Callable[[int], bytes],
    ) -> ControlMaterial:
        if len(str(paths.socket).encode("utf-8")) > MAX_UNIX_SOCKET_PATH_BYTES:
            raise ProcessControlError("control_socket_path_too_long")
        handle = self._filesystem.mkdir_open(
            paths.root, mode=0o700, exclusive=True, nofollow=True
        )
        root_identity = _identity(self._filesystem.stat_handle(handle))
        _validate_root(root_identity, binding.owner_uid)
        capability = _require_capability(random_bytes(CAPABILITY_BYTES), exact=True)
        self._filesystem.create_at(
            handle,
            paths.capability.name,
            capability,
            mode=0o600,
            exclusive=True,
            nofollow=True,
        )
        persisted = PersistedControlBinding(binding, root_identity)
        self._filesystem.write_atomic_at(
            handle,
            paths.binding.name,
            _binding_record(persisted, capability),
            mode=0o600,
            nofollow=True,
            fsync_file=True,
            fsync_directory=True,
        )
        self._filesystem.create_at(
            handle,
            paths.liveness_lock.name,
            b"",
            mode=0o600,
            exclusive=True,
            nofollow=True,
        )
        self._remember(paths.root, handle)
        return ControlMaterial(paths, binding, root_identity, capability, persisted)

    def load(
        self, *, paths: ControlPaths, expected_binding: ControlBinding
    ) -> ControlMaterial:
        handle = self._handle(paths.root)
        root_identity = _identity(self._filesystem.stat_handle(handle))
        _validate_root(root_identity, expected_binding.owner_uid)
        capability_read = self._filesystem.read_at_stable(
            handle,
            paths.capability.name,
            max_bytes=CAPABILITY_BYTES,
            mode=0o600,
            owner_uid=expected_binding.owner_uid,
            nofollow=True,
        )
        capability = _stable_leaf(
            capability_read,
            expected_mode=0o600,
            expected_owner_uid=expected_binding.owner_uid,
        )
        _require_capability(capability, exact=True)
        binding_read = self._filesystem.read_at_stable(
            handle,
            paths.binding.name,
            max_bytes=MAX_BINDING_BYTES,
            mode=0o600,
            owner_uid=expected_binding.owner_uid,
            nofollow=True,
        )
        record = _stable_leaf(
            binding_read,
            expected_mode=0o600,
            expected_owner_uid=expected_binding.owner_uid,
        )
        if len(record) > MAX_BINDING_BYTES:
            raise ProcessControlError("control_binding_too_large")
        persisted = verify_binding_record(
            record,
            capability=capability,
            expected_binding=expected_binding,
            expected_root_identity=root_identity,
        )
        return ControlMaterial(
            paths, expected_binding, root_identity, capability, persisted
        )

    def _write_receipt(
        self, material: ControlMaterial, name: str, payload: Mapping[str, object]
    ) -> bytes:
        record = sign_frame(payload, material.capability)
        self._filesystem.write_atomic_at(
            self._verified_handle(material),
            name,
            record,
            mode=0o600,
            nofollow=True,
            fsync_file=True,
            fsync_directory=True,
        )
        return record

    def write_ready_receipt(self, material: ControlMaterial) -> bytes:
        return self._write_receipt(
            material,
            material.paths.ready.name,
            {
                "binding": material.binding.as_payload(),
                "root_identity": material.root_identity.as_payload(),
                "status": "ready",
                "version": READY_RECEIPT_VERSION,
            },
        )

    def write_shutdown_receipt(
        self, material: ControlMaterial, receipt: Mapping[str, object]
    ) -> bytes:
        return self._write_receipt(
            material,
            material.paths.shutdown_receipt.name,
            {
                "binding": material.binding.as_payload(),
                "receipt": dict(receipt),
                "root_identity": material.root_identity.as_payload(),
                "version": SHUTDOWN_RECEIPT_VERSION,
            },
        )

    def read_ready_receipt(self, material: ControlMaterial) -> bytes:
        return self._read_receipt(material, material.paths.ready.name)

    def read_shutdown_receipt(self, material: ControlMaterial) -> bytes:
        return self._read_receipt(material, material.paths.shutdown_receipt.name)

    def _read_receipt(self, material: ControlMaterial, name: str) -> bytes:
        candidate = self._filesystem.read_at_stable(
            self._verified_handle(material),
            name,
            max_bytes=MAX_FRAME_BYTES,
            mode=0o600,
            owner_uid=material.binding.owner_uid,
            nofollow=True,
        )
        return _stable_leaf(
            candidate,
            expected_mode=0o600,
            expected_owner_uid=material.binding.owner_uid,
        )

    def acquire_liveness(self, material: ControlMaterial) -> object:
        acquire = getattr(self._filesystem, "acquire_liveness", None)
        if not callable(acquire):
            raise ProcessControlError("liveness_authority_unavailable")
        return acquire(
            self._verified_handle(material),
            material.paths.liveness_lock.name,
            mode=0o600,
            owner_uid=material.binding.owner_uid,
            nofollow=True,
        )

    def release_liveness(self, authority: object) -> None:
        release = getattr(self._filesystem, "release_liveness", None)
        if not callable(release):
            raise ProcessControlError("liveness_authority_unavailable")
        release(authority)

    def liveness_released(self, material: ControlMaterial) -> bool:
        probe = getattr(self._filesystem, "liveness_released", None)
        if not callable(probe):
            raise ProcessControlError("liveness_authority_unavailable")
        return bool(
            probe(
                self._verified_handle(material),
                material.paths.liveness_lock.name,
                mode=0o600,
                owner_uid=material.binding.owner_uid,
                nofollow=True,
            )
        )

    def remove_control_root(self, material: ControlMaterial) -> None:
        remover = getattr(self._filesystem, "remove_control_root", None)
        if not callable(remover):
            raise ProcessControlError("control_root_cleanup_unavailable")
        allowed = frozenset(
            path.name
            for path in (
                material.paths.socket,
                material.paths.capability,
                material.paths.binding,
                material.paths.ready,
                material.paths.liveness_lock,
                material.paths.shutdown_receipt,
            )
        )
        remover(
            material.paths.root,
            expected_identity=material.root_identity,
            allowed_leaves=allowed,
        )
        handle = self._handles.get(material.paths.root)
        closer = getattr(self._filesystem, "close_handle", None)
        if handle is not None and callable(closer):
            closer(handle)
        self._handles = {
            root: remembered
            for root, remembered in self._handles.items()
            if root != material.paths.root
        }


def _verify_receipt(
    record: bytes,
    material: ControlMaterial,
    *,
    version: str,
    status: str | None = None,
) -> dict[str, object]:
    body = verify_frame(record, material.capability)
    if (
        body.get("version") != version
        or body.get("binding") != material.binding.as_payload()
        or body.get("root_identity") != material.root_identity.as_payload()
        or (status is not None and body.get("status") != status)
    ):
        raise ProcessControlError("control_receipt_mismatch")
    return body


def verify_ready_receipt(record: bytes, material: ControlMaterial) -> bool:
    _verify_receipt(record, material, version=READY_RECEIPT_VERSION, status="ready")
    return True


def verify_shutdown_receipt(record: bytes, material: ControlMaterial) -> bool:
    body = _verify_receipt(record, material, version=SHUTDOWN_RECEIPT_VERSION)
    receipt = body.get("receipt")
    if not isinstance(receipt, dict) or receipt.get("all_children_reaped") is not True:
        raise ProcessControlError("shutdown_receipt_invalid")
    return True


def encode_wire_frame(frame: bytes) -> bytes:
    if not isinstance(frame, bytes) or not frame or len(frame) > MAX_FRAME_BYTES:
        raise ProcessControlError("frame_too_large")
    return len(frame).to_bytes(4, "big") + frame


def read_wire_frame(connection: object) -> bytes:
    prefix = _recv_exact(connection, 4)
    length = int.from_bytes(prefix, "big")
    if length < 1 or length > MAX_FRAME_BYTES:
        raise ProcessControlError("frame_too_large")
    return _recv_exact(connection, length)


def write_wire_frame(connection: object, frame: bytes) -> None:
    sender = getattr(connection, "sendall", None)
    if not callable(sender):
        raise ProcessControlError("control_socket_invalid")
    sender(encode_wire_frame(frame))


def _recv_exact(connection: object, count: int) -> bytes:
    receiver = getattr(connection, "recv", None)
    if not callable(receiver):
        raise ProcessControlError("control_socket_invalid")
    chunks: list[bytes] = []
    remaining = count
    while remaining:
        chunk = receiver(remaining)
        if not isinstance(chunk, bytes) or not chunk:
            raise ProcessControlError("control_frame_truncated")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _validate_socket_identity(candidate: object, owner_uid: int) -> RootIdentity:
    identity = _identity(candidate)
    if (
        not stat.S_ISSOCK(identity.mode)
        or stat.S_IMODE(identity.mode) != 0o600
        or identity.owner_uid != owner_uid
    ):
        raise ProcessControlError("control_socket_invalid")
    return identity


def peer_euid(connection: object) -> int:
    fileno = getattr(connection, "fileno", None)
    if not callable(fileno):
        raise ProcessControlError("peer_credentials_unavailable")
    descriptor = int(fileno())
    if sys.platform.startswith("linux") and hasattr(socket, "SO_PEERCRED"):
        reader = getattr(connection, "getsockopt", None)
        if not callable(reader):
            raise ProcessControlError("peer_credentials_unavailable")
        raw = reader(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i"))
        _pid, uid, _gid = struct.unpack("3i", raw)
        return int(uid)
    if sys.platform == "darwin":
        uid = ctypes.c_uint()
        gid = ctypes.c_uint()
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.getpeereid(descriptor, ctypes.byref(uid), ctypes.byref(gid)) != 0:
            raise ProcessControlError("peer_credentials_unavailable")
        return int(uid.value)
    raise ProcessControlError("peer_credentials_unavailable")


class UnixControlTransport:
    def __init__(
        self,
        *,
        paths: ControlPaths,
        binding: ControlBinding,
        capability: bytes,
        filesystem: FileSystemAdapter,
        expected_root_identity: RootIdentity | None = None,
        socket_factory: Callable[[int, int], object] = socket.socket,
        peer_euid_reader: Callable[[object], int] = peer_euid,
    ) -> None:
        self._paths = paths
        self._binding = binding
        self._capability = _require_capability(capability, exact=True)
        self._filesystem = filesystem
        self._expected_root_identity = (
            None
            if expected_root_identity is None
            else _identity(expected_root_identity)
        )
        self._socket_factory = socket_factory
        self._peer_euid_reader = peer_euid_reader

    def _verify_root_identity(self) -> None:
        if self._expected_root_identity is not None:
            stat_directory = getattr(self._filesystem, "stat_directory", None)
            if not callable(stat_directory):
                raise ProcessControlError("control_root_identity_unavailable")
            observed_root = _identity(stat_directory(self._paths.root, nofollow=True))
            if observed_root != self._expected_root_identity:
                raise ProcessControlError("control_root_replaced")

    def exchange(self, frame: bytes) -> bytes:
        request = verify_frame(frame, self._capability)
        if request.get("binding") != self._binding.as_payload():
            raise ProcessControlError("binding_mismatch")
        self._verify_root_identity()
        before = _validate_socket_identity(
            self._filesystem.stat_socket(self._paths.socket, nofollow=True),
            self._binding.owner_uid,
        )
        connection = self._socket_factory(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            connector = getattr(connection, "connect", None)
            if not callable(connector):
                raise ProcessControlError("control_socket_invalid")
            connector(str(self._paths.socket))
            if self._peer_euid_reader(connection) != self._binding.owner_uid:
                raise ProcessControlError("peer_uid_mismatch")
            after = _validate_socket_identity(
                self._filesystem.stat_socket(self._paths.socket, nofollow=True),
                self._binding.owner_uid,
            )
            self._verify_root_identity()
            if before != after:
                raise ProcessControlError("control_socket_replaced")
            write_wire_frame(connection, frame)
            response = read_wire_frame(connection)
            body = verify_frame(response, self._capability)
            if body.get("binding") != self._binding.as_payload():
                raise ProcessControlError("response_binding_mismatch")
            return response
        finally:
            closer = getattr(connection, "close", None)
            if callable(closer):
                closer()


class ControlClient:
    def __init__(
        self,
        *,
        binding: ControlBinding,
        capability: bytes,
        transport: ControlTransport,
    ) -> None:
        self._binding = binding
        self._capability = _require_capability(capability)
        self._transport = transport

    def _request(
        self, action: str, request_id: str, parameters: Mapping[str, object]
    ) -> dict[str, object]:
        frame = encode_request(
            binding=self._binding,
            capability=self._capability,
            request_id=request_id,
            action=action,
            parameters=parameters,
        )
        body = verify_frame(self._transport.exchange(frame), self._capability)
        if body.get("binding") != self._binding.as_payload():
            raise ProcessControlError("response_binding_mismatch")
        result = body.get("result")
        if (
            body.get("version") != PROTOCOL_VERSION
            or body.get("kind") != "response"
            or body.get("request_id") != request_id
            or body.get("action") != action
            or not isinstance(result, dict)
        ):
            raise ProcessControlError("response_mismatch")
        return result

    def start_server(self, *, strip_tls: bool, request_id: str) -> dict[str, object]:
        return self._request("start_server", request_id, {"strip_tls": strip_tls})

    def stop_server(self, *, request_id: str) -> dict[str, object]:
        return self._request("stop_server", request_id, {})

    def stop_all(self, *, request_id: str) -> dict[str, object]:
        return self._request("stop_all", request_id, {})

    def shutdown(self, *, request_id: str) -> dict[str, object]:
        return self._request("shutdown", request_id, {})


class TeardownClient(Protocol):
    def stop_all(self, *, request_id: str) -> object: ...

    def shutdown(self, *, request_id: str) -> object: ...


def coordinated_teardown(
    *,
    client: TeardownClient,
    load_shutdown_receipt: Callable[[], object],
    validate_shutdown_receipt: Callable[[object], bool],
    stop_store: Callable[[], object],
    destroy_runtime: Callable[[], object],
    remove_control_root: Callable[[], object],
    liveness_lock_released: Callable[[], object] | None = None,
) -> None:
    supervisor_failure: Exception | None = None
    try:
        client.stop_all(request_id=TEARDOWN_STOP_ALL_REQUEST_ID)
        client.shutdown(request_id=TEARDOWN_SHUTDOWN_REQUEST_ID)
    except Exception as exc:  # noqa: BLE001 - receipt may prove lost acknowledgement
        supervisor_failure = exc
    receipt = load_shutdown_receipt()
    if receipt is None:
        raise ProcessControlError(
            "stable_process_authority_lost"
        ) from supervisor_failure
    if not validate_shutdown_receipt(receipt):
        reason = (
            "stable_process_authority_lost"
            if supervisor_failure is not None
            else "shutdown_receipt_invalid"
        )
        raise ProcessControlError(reason) from supervisor_failure
    if supervisor_failure is not None and liveness_lock_released is None:
        raise ProcessControlError(
            "stable_process_authority_lost"
        ) from supervisor_failure
    if liveness_lock_released is not None and liveness_lock_released() is not True:
        raise ProcessControlError("stable_process_authority_lost")
    stop_store()
    destroy_runtime()
    remove_control_root()


def control_root_absent(control_root: Path) -> bool:
    root = Path(control_root)
    return not (root.is_symlink() or root.exists())
