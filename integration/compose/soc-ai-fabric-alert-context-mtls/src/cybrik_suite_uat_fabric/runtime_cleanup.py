"""Owned runtime cleanup shared by standalone and master-reserved runs."""

from __future__ import annotations

import os
import shutil
import stat
from pathlib import Path

from .runtime_wiring_admission import RuntimeAdmissionWiringError


def _open_exact_root(root: Path) -> int:
    if not isinstance(root, Path) or not root.is_absolute():
        raise RuntimeAdmissionWiringError("runtime_cleanup_failed")
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC
    nofollow = getattr(os, "O_NOFOLLOW", None)
    if nofollow is None or not shutil.rmtree.avoids_symlink_attacks:
        raise RuntimeAdmissionWiringError("runtime_cleanup_failed")
    descriptor: int | None = None
    try:
        identity = root.lstat()
        if root.resolve(strict=True) != root:
            raise OSError
        descriptor = os.open(root, flags | nofollow)
        opened = os.fstat(descriptor)
    except OSError:
        if descriptor is not None:
            os.close(descriptor)
        raise RuntimeAdmissionWiringError("runtime_cleanup_failed") from None
    if (
        not stat.S_ISDIR(identity.st_mode)
        or identity.st_uid != os.geteuid()
        or stat.S_IMODE(identity.st_mode) != 0o700
        or (identity.st_dev, identity.st_ino) != (opened.st_dev, opened.st_ino)
    ):
        os.close(descriptor)
        raise RuntimeAdmissionWiringError("runtime_cleanup_failed")
    return descriptor


def clear_bound_root(root: Path) -> None:
    """Empty one exact owned root without following links or removing the root."""

    descriptor = _open_exact_root(root)
    try:
        for child in tuple(os.scandir(descriptor)):
            if child.is_symlink() or child.is_file(follow_symlinks=False):
                os.unlink(child.name, dir_fd=descriptor)
            elif child.is_dir(follow_symlinks=False):
                shutil.rmtree(child.name, dir_fd=descriptor)
            else:
                raise OSError
        os.fsync(descriptor)
        if any(os.scandir(descriptor)):
            raise OSError
    except OSError:
        raise RuntimeAdmissionWiringError("runtime_cleanup_failed") from None
    finally:
        os.close(descriptor)


def remove_runtime_root(context: object, *, preserve_root: bool = False) -> None:
    from . import runtime_pki

    root = context.config.external.runtime_root  # type: ignore[attr-defined]
    try:
        identity = root.lstat()
        resolved = root.resolve(strict=True)
    except (AttributeError, OSError):
        raise RuntimeAdmissionWiringError("runtime_cleanup_failed") from None
    if (
        not isinstance(root, Path)
        or resolved != root
        or not stat.S_ISDIR(identity.st_mode)
        or identity.st_uid != os.geteuid()
        or stat.S_IMODE(identity.st_mode) != 0o700
    ):
        raise RuntimeAdmissionWiringError("runtime_cleanup_failed")
    closers = context.closers  # type: ignore[attr-defined]
    for closer in reversed(closers):
        closer()
    closers.clear()
    runtime_pki.destroy_runtime_pki(context.pki)  # type: ignore[attr-defined]
    if not preserve_root:
        shutil.rmtree(root)
        return
    for child in tuple(root.iterdir()):
        if child.is_symlink() or child.is_file():
            child.unlink()
        elif child.is_dir():
            shutil.rmtree(child)
        else:
            raise RuntimeAdmissionWiringError("runtime_cleanup_failed")


def runtime_root_clean(root: Path, *, preserve_root: bool) -> bool:
    if not preserve_root:
        return not root.exists() and not root.is_symlink()
    try:
        identity = root.lstat()
        return (
            root.resolve(strict=True) == root
            and stat.S_ISDIR(identity.st_mode)
            and identity.st_uid == os.geteuid()
            and stat.S_IMODE(identity.st_mode) == 0o700
            and not any(root.iterdir())
        )
    except OSError:
        return False


__all__ = ["clear_bound_root", "remove_runtime_root", "runtime_root_clean"]
