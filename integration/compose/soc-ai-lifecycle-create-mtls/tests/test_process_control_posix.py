"""Synthetic contracts for the concrete POSIX process-control seam.

No test in this module touches the host filesystem, opens a real socket, or
starts a process.  The POSIX adapter receives recording ``os``/``fcntl``
facades so descriptor-relative and no-follow behavior is directly observable.
"""

from __future__ import annotations

import os
import stat
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_mtls import process_control, process_supervisor

_OWNER_UID = 501


def _identity(*, inode: int, mode: int) -> SimpleNamespace:
    return SimpleNamespace(st_dev=7, st_ino=inode, st_uid=_OWNER_UID, st_mode=mode)


class _RecordingOs:
    O_RDONLY = os.O_RDONLY
    O_WRONLY = os.O_WRONLY
    O_RDWR = os.O_RDWR
    O_CREAT = os.O_CREAT
    O_EXCL = os.O_EXCL
    O_TRUNC = os.O_TRUNC
    O_DIRECTORY = getattr(os, "O_DIRECTORY", 0)
    O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)

    def __init__(self) -> None:
        self.calls: list[tuple[object, ...]] = []
        self.next_fd = 20
        self.fd_stats: dict[int, SimpleNamespace] = {
            1: _identity(inode=1, mode=stat.S_IFDIR | 0o755),
            2: _identity(inode=2, mode=stat.S_IFDIR | 0o755),
            3: _identity(inode=3, mode=stat.S_IFDIR | 0o755),
            10: _identity(inode=10, mode=stat.S_IFDIR | 0o700),
            11: _identity(inode=11, mode=stat.S_IFDIR | 0o700),
        }
        self.reads: dict[int, list[bytes]] = {}
        self.directory_entries: list[str] = []
        self.link_error: OSError | None = None

    def geteuid(self) -> int:
        return _OWNER_UID

    def open(
        self,
        path: object,
        flags: int,
        mode: int = 0o777,
        *,
        dir_fd: int | None = None,
    ) -> int:
        self.calls.append(("open", path, flags, mode, dir_fd))
        if path == "/":
            return 1
        if path == "private" and dir_fd == 1:
            return 2
        if path == "tmp" and dir_fd == 2:
            return 3
        if path == "cybrik-uat-test" and dir_fd == 3:
            return 10
        if path == "control" and dir_fd == 10:
            return 11
        descriptor = self.next_fd
        self.next_fd += 1
        leaf_mode = mode & 0o777 if flags & self.O_CREAT else 0o600
        self.fd_stats[descriptor] = _identity(
            inode=descriptor, mode=stat.S_IFREG | leaf_mode
        )
        return descriptor

    def close(self, descriptor: int) -> None:
        self.calls.append(("close", descriptor))

    def fstat(self, descriptor: int) -> SimpleNamespace:
        self.calls.append(("fstat", descriptor))
        return self.fd_stats[descriptor]

    def mkdir(self, name: str, mode: int, *, dir_fd: int) -> None:
        self.calls.append(("mkdir", name, mode, dir_fd))

    def write(self, descriptor: int, data: bytes) -> int:
        self.calls.append(("write", descriptor, data))
        return len(data)

    def read(self, descriptor: int, count: int) -> bytes:
        self.calls.append(("read", descriptor, count))
        values = self.reads.setdefault(descriptor, [b"payload", b""])
        return values.pop(0)

    def fsync(self, descriptor: int) -> None:
        self.calls.append(("fsync", descriptor))

    def stat(
        self,
        path: str,
        *,
        dir_fd: int,
        follow_symlinks: bool,
    ) -> SimpleNamespace:
        self.calls.append(("stat", path, dir_fd, follow_symlinks))
        if path == "s":
            return _identity(inode=40, mode=stat.S_IFSOCK | 0o600)
        if path == "control":
            return _identity(inode=11, mode=stat.S_IFDIR | 0o700)
        raise FileNotFoundError(path)

    def chmod(
        self,
        path: str,
        mode: int,
        *,
        dir_fd: int,
        follow_symlinks: bool,
    ) -> None:
        self.calls.append(("chmod", path, mode, dir_fd, follow_symlinks))

    def link(
        self,
        source: str,
        destination: str,
        *,
        src_dir_fd: int,
        dst_dir_fd: int,
        follow_symlinks: bool,
    ) -> None:
        self.calls.append(
            (
                "link",
                source,
                destination,
                src_dir_fd,
                dst_dir_fd,
                follow_symlinks,
            )
        )
        if self.link_error is not None:
            raise self.link_error

    def unlink(self, name: str, *, dir_fd: int) -> None:
        self.calls.append(("unlink", name, dir_fd))

    def rmdir(self, name: str, *, dir_fd: int) -> None:
        self.calls.append(("rmdir", name, dir_fd))

    def listdir(self, descriptor: int) -> list[str]:
        self.calls.append(("listdir", descriptor))
        return list(self.directory_entries)


class _RecordingFcntl:
    LOCK_EX = 2
    LOCK_NB = 4
    LOCK_UN = 8

    def __init__(self) -> None:
        self.calls: list[tuple[int, int]] = []

    def flock(self, descriptor: int, operation: int) -> None:
        self.calls.append((descriptor, operation))


def _adapter() -> tuple[object, _RecordingOs, _RecordingFcntl]:
    operating_system = _RecordingOs()
    locks = _RecordingFcntl()
    adapter = process_control.PosixFileSystemAdapter(
        os_module=operating_system,
        fcntl_module=locks,
        temporary_name=lambda: "tmp-fixed",
    )
    return adapter, operating_system, locks


def test_open_directory_is_parent_descriptor_relative_and_nofollow() -> None:
    adapter, operating_system, _ = _adapter()

    handle = adapter.open_directory(
        Path("/private/tmp/cybrik-uat-test/control"), nofollow=True
    )

    assert handle == 11
    opens = [call for call in operating_system.calls if call[0] == "open"]
    assert [call[1] for call in opens] == [
        "/",
        "private",
        "tmp",
        "cybrik-uat-test",
        "control",
    ]
    assert all(call[2] & operating_system.O_DIRECTORY for call in opens)
    assert all(call[2] & operating_system.O_NOFOLLOW for call in opens)
    assert [call[4] for call in opens[1:]] == [1, 2, 3, 10]
    assert ("close", 10) in operating_system.calls


def test_create_and_stable_read_are_nofollow_descriptor_relative() -> None:
    adapter, operating_system, _ = _adapter()

    adapter.create_at(
        11,
        "capability.bin",
        b"payload",
        mode=0o600,
        exclusive=True,
        nofollow=True,
    )
    created_fd = 20
    opened = next(
        call
        for call in operating_system.calls
        if call[0:2] == ("open", "capability.bin")
    )
    assert opened[2] & operating_system.O_NOFOLLOW
    assert opened[2] & operating_system.O_EXCL
    assert opened[4] == 11
    assert ("fsync", created_fd) in operating_system.calls

    operating_system.next_fd = 30
    result = adapter.read_at_stable(
        11,
        "capability.bin",
        max_bytes=32,
        mode=0o600,
        owner_uid=_OWNER_UID,
        nofollow=True,
    )

    assert result.data == b"payload"
    assert result.before == result.after
    read_open = next(
        call
        for call in operating_system.calls
        if call[0:2] == ("open", "capability.bin")
        and call[4] == 11
        and call[2] & operating_system.O_RDONLY == operating_system.O_RDONLY
    )
    assert read_open[2] & operating_system.O_NOFOLLOW
    assert ("read", 30, 33) in operating_system.calls


def test_socket_stat_and_chmod_are_parent_descriptor_relative() -> None:
    adapter, operating_system, _ = _adapter()
    socket_path = Path("/private/tmp/cybrik-uat-test/control/s")

    before = adapter.stat_socket(socket_path, nofollow=True)
    adapter.chmod_socket(socket_path, 0o600)

    assert stat.S_ISSOCK(before.mode)
    assert ("stat", "s", 11, False) in operating_system.calls
    assert ("chmod", "s", 0o600, 11, False) in operating_system.calls
    assert operating_system.calls.count(("close", 11)) == 2


def test_socket_cleanup_refuses_a_replaced_path_identity() -> None:
    adapter, operating_system, _ = _adapter()
    socket_path = Path("/private/tmp/cybrik-uat-test/control/s")

    with pytest.raises(process_control.ProcessControlError) as caught:
        adapter.unlink_socket(
            socket_path,
            owner_uid=_OWNER_UID,
            expected_identity=process_control.RootIdentity(
                device=7,
                inode=99,
                owner_uid=_OWNER_UID,
                mode=stat.S_IFSOCK | 0o600,
            ),
        )

    assert caught.value.reason == "control_socket_replaced"
    assert not any(call[0:2] == ("unlink", "s") for call in operating_system.calls)


def test_atomic_receipt_write_is_exclusive_and_durable() -> None:
    adapter, operating_system, _ = _adapter()

    adapter.write_atomic_at(
        11,
        "ready.json",
        b"signed-ready",
        mode=0o600,
        nofollow=True,
        fsync_file=True,
        fsync_directory=True,
    )

    temporary_open = next(
        call
        for call in operating_system.calls
        if call[0:2] == ("open", ".ready.json.tmp-fixed.tmp")
    )
    assert temporary_open[1] == ".ready.json.tmp-fixed.tmp"
    assert temporary_open[2] & operating_system.O_NOFOLLOW
    assert temporary_open[2] & operating_system.O_EXCL
    assert temporary_open[4] == 11
    assert (
        "link",
        ".ready.json.tmp-fixed.tmp",
        "ready.json",
        11,
        11,
        False,
    ) in operating_system.calls
    assert ("fsync", 11) in operating_system.calls


def test_atomic_receipt_publish_never_overwrites_racing_target() -> None:
    adapter, operating_system, _ = _adapter()
    operating_system.link_error = FileExistsError("ready.json")

    with pytest.raises(process_control.ProcessControlError) as caught:
        adapter.write_atomic_at(
            11,
            "ready.json",
            b"signed-ready",
            mode=0o600,
            nofollow=True,
            fsync_file=True,
            fsync_directory=True,
        )

    assert caught.value.reason == "control_leaf_already_exists"
    assert not any(call[0] == "replace" for call in operating_system.calls)
    assert (
        "unlink",
        ".ready.json.tmp-fixed.tmp",
        11,
    ) in operating_system.calls


def test_liveness_authority_is_an_owned_lock_not_a_pid() -> None:
    adapter, operating_system, locks = _adapter()

    authority = adapter.acquire_liveness(
        11,
        "liveness.lock",
        mode=0o600,
        owner_uid=_OWNER_UID,
        nofollow=True,
    )
    adapter.release_liveness(authority)

    opened = next(
        call
        for call in operating_system.calls
        if call[0:2] == ("open", "liveness.lock")
    )
    assert opened[2] & operating_system.O_NOFOLLOW
    assert opened[4] == 11
    assert locks.calls == [
        (authority, locks.LOCK_EX | locks.LOCK_NB),
        (authority, locks.LOCK_UN),
    ]
    assert ("close", authority) in operating_system.calls


def test_control_root_removal_is_identity_bound_and_allowlisted() -> None:
    adapter, operating_system, _ = _adapter()
    operating_system.directory_entries = ["binding.json", "liveness.lock"]

    adapter.remove_control_root(
        Path("/private/tmp/cybrik-uat-test/control"),
        expected_identity=process_control.RootIdentity(
            device=7,
            inode=11,
            owner_uid=_OWNER_UID,
            mode=stat.S_IFDIR | 0o700,
        ),
        allowed_leaves=frozenset({"binding.json", "liveness.lock"}),
    )

    assert ("unlink", "binding.json", 11) in operating_system.calls
    assert ("unlink", "liveness.lock", 11) in operating_system.calls
    assert ("rmdir", "control", 10) in operating_system.calls


class _LoopCore:
    def __init__(self) -> None:
        self.shutdown_requested = False
        self.calls = 0

    def handle_frame(self, _frame: bytes, *, peer_uid: int) -> bytes:
        del peer_uid
        self.calls += 1
        self.shutdown_requested = True
        return b"response"


class _LoopDaemon(process_supervisor.SupervisorDaemon):
    """Avoids transport details while exercising the lifecycle loop."""

    def __init__(self, core: _LoopCore, events: list[str]) -> None:
        self._core = core
        self._events = events
        self._listener = object()

    def serve_once(self) -> None:
        self._events.append("serve")
        self._core.shutdown_requested = True

    def close(self) -> None:
        self._events.append("close")


def test_serve_until_shutdown_closes_listener_then_releases_liveness() -> None:
    events: list[str] = []
    core = _LoopCore()
    daemon = _LoopDaemon(core, events)

    daemon.serve_until_shutdown(
        release_liveness=lambda: events.append("release_liveness")
    )

    assert events == ["serve", "close", "release_liveness"]


def test_supervisor_main_is_import_inert_and_has_executable_boundary() -> None:
    assert callable(process_supervisor.main)
    assert callable(process_supervisor.run_supervisor)
    assert process_supervisor.__name__ == "cybrik_suite_uat_mtls.process_supervisor"


def test_path_length_preflight_occurs_before_posix_mutation() -> None:
    adapter, operating_system, _ = _adapter()
    store = process_control.ControlStore(filesystem=adapter)
    long_root = Path("/") / ("x" * 180)
    paths = process_control.ControlPaths(
        root=long_root,
        socket=long_root / "s",
        capability=long_root / "capability.bin",
        binding=long_root / "binding.json",
        ready=long_root / "ready.json",
        liveness_lock=long_root / "liveness.lock",
        shutdown_receipt=long_root / "shutdown-receipt.json",
    )
    binding = process_control.ControlBinding(
        authorization_sha256="a" * 64,
        run_id="b" * 32,
        generation=1,
        owner_uid=_OWNER_UID,
    )

    with pytest.raises(process_control.ProcessControlError) as caught:
        store.create(
            paths=paths, binding=binding, random_bytes=lambda count: b"c" * count
        )

    assert caught.value.reason == "control_socket_path_too_long"
    assert operating_system.calls == []
