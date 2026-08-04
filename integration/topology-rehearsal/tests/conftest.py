"""Shared mixed-lifecycle harness for the topology-only rehearsal runner specification.

Status: BOUNDED C8 LIBRARY CORE PARTIALLY PRESENT — LATER C8 MODULES RED — NO RUNTIME AUTHORITY.

Every test states final C8 behaviour. `load_c8` / `require_c8_path` transparently load the
modules that are present and fail the absent ones with an exact, non-skipping reason. Tests may
import the injection-only adapters but never open a socket, spawn a process or touch Docker;
the autouse `forbid_real_io` tripwire turns any such attempt into a test failure.
"""

from __future__ import annotations

import importlib
import os
import socket
import subprocess
import sys
from pathlib import Path
from types import ModuleType

import pytest

ROOT = Path(__file__).parents[1]
SRC = ROOT / "src"
SCRIPTS = ROOT / "scripts"
PACKAGE = "cybrik_suite_topology_rehearsal"

# The C8 module inventory. `test_surface_contract` pins it as the complete authored
# surface; every other module here loads exactly the module it specifies.
C8_MODULES = (
    "constants",
    "errors",
    "protocols",
    "adapter",
    "plan",
    "observe",
    "grant",
    "preparation",
    "admission",
    "runner",
)

# Both inert entrypoints are pinned. `prepare_topology_grant.py` renders the unsigned grant
# document for external review and signing; `run_topology_rehearsal.py` executes the one
# authorized attempt. Neither may do anything at import time.
C8_SCRIPT_NAMES = ("prepare_topology_grant.py", "run_topology_rehearsal.py")

_MISSING_C8 = (
    "missing C8 implementation — this RED test states the final runner behaviour and "
    "fails closed until it exists"
)


class MissingC8Module(ModuleType):
    """Collectable sentinel that moves the intentional RED into each test body."""

    def __init__(self, name: str, expected: Path, error: ImportError) -> None:
        super().__init__(f"missing_c8::{name}")
        self._missing_reason = f"{_MISSING_C8}: {name} ({expected}): {error}"

if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


def load_c8(module: str = "") -> ModuleType:
    """Import a C8 runner module, or fail RED with an exact missing-C8 reason.

    The import is deliberately deferred to call time: module-level imports of an absent
    package would break collection, and this project must collect cleanly while RED.
    """
    name = f"{PACKAGE}.{module}" if module else PACKAGE
    expected = SRC / PACKAGE / (f"{module}.py" if module else "__init__.py")
    try:
        return importlib.import_module(name)
    except ImportError as error:
        return MissingC8Module(name, expected, error)


def load_c8_script(name: str) -> ModuleType:
    """Import an inert C8 entrypoint script by file name, or fail RED."""
    path = require_c8_path(SCRIPTS / name)
    if str(SCRIPTS) not in sys.path:
        sys.path.insert(0, str(SCRIPTS))
    try:
        return importlib.import_module(path.stem)
    except ImportError as error:
        pytest.fail(f"{_MISSING_C8}: script {path}: {error}", pytrace=False)


def require_c8_path(path: Path) -> Path:
    """Return an authored C8 path, or fail RED while it is absent."""
    if not path.exists():
        pytest.fail(f"{_MISSING_C8}: {path} does not exist", pytrace=False)
    return path


def require_c8_attr(module: ModuleType, name: str) -> object:
    """Read a required C8 export, or fail RED with the exact missing name."""
    if isinstance(module, MissingC8Module):
        pytest.fail(module._missing_reason, pytrace=False)
    if not hasattr(module, name):
        pytest.fail(f"{_MISSING_C8}: {module.__name__} must export {name}", pytrace=False)
    return getattr(module, name)


def source_paths() -> tuple[Path, ...]:
    """Every authored Python file under the C8 source and script roots."""
    roots = (SRC, SCRIPTS)
    return tuple(
        sorted(path for root in roots if root.exists() for path in root.rglob("*.py"))
    )


class RealIoAttempted(AssertionError):
    """Raised when a test reaches for a real process, socket or Docker effect."""


def _tripwire(label: str):
    def refuse(*args: object, **kwargs: object) -> None:
        raise RealIoAttempted(
            f"{label} is forbidden: the topology rehearsal specification runs entirely "
            "behind injected fakes and performs no real I/O"
        )

    return refuse


@pytest.fixture(autouse=True)
def forbid_real_io(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail any test that attempts a real process, socket or shell effect."""
    for module, attribute in (
        (subprocess, "Popen"),
        (subprocess, "run"),
        (subprocess, "call"),
        (subprocess, "check_call"),
        (subprocess, "check_output"),
        (os, "system"),
        (os, "popen"),
        (os, "fork"),
        (os, "posix_spawn"),
        (os, "posix_spawnp"),
        (socket, "socket"),
        (socket, "socketpair"),
        (socket, "create_connection"),
        (socket, "create_server"),
    ):
        if hasattr(module, attribute):
            monkeypatch.setattr(
                module, attribute, _tripwire(f"{module.__name__}.{attribute}")
            )
    for attribute in (
        "execl",
        "execle",
        "execlp",
        "execlpe",
        "execv",
        "execve",
        "execvp",
        "execvpe",
        "spawnl",
        "spawnle",
        "spawnlp",
        "spawnlpe",
        "spawnv",
        "spawnve",
        "spawnvp",
        "spawnvpe",
    ):
        if hasattr(os, attribute):
            monkeypatch.setattr(os, attribute, _tripwire(f"os.{attribute}"))
