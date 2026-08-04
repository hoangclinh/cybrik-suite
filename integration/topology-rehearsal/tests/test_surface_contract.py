"""The authored C8 surface: exactly these modules, exactly these scripts, no I/O reach.

Status: `RED — TESTS ONLY — RUNNER NOT IMPLEMENTED`.

This module pins the shape of the implementation rather than its behaviour. It states that
the C8 source tree contains exactly the reviewed module inventory and the two inert
entrypoints, that every module declares an honest `__all__`, and — the structural isolation
control of diagnosis section 7 item 7 — that no authored byte names a non-loopback address
or reaches for a process, socket or network module.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

from conftest import (
    C8_MODULES,
    C8_SCRIPT_NAMES,
    PACKAGE,
    SCRIPTS,
    SRC,
    load_c8,
    load_c8_script,
    require_c8_attr,
    require_c8_path,
    source_paths,
)

# Modules that would give a pure specification module a real effect. The C8 library is
# injection-only: every process, socket and network capability arrives through an injected
# port, so importing any of these inside `src/` is a structural violation, not a style note.
FORBIDDEN_LIBRARY_IMPORTS = frozenset(
    {
        "asyncio",
        "ctypes",
        "http",
        "multiprocessing",
        "pty",
        "requests",
        "shutil",
        "signal",
        "socket",
        "ssl",
        "subprocess",
        "telnetlib",
        "urllib",
    }
)

# Literals that would name something other than the single reviewed loopback publication.
# `127.0.0.1` is the only address any authored byte may contain.
FORBIDDEN_ADDRESS_LITERALS = (
    "0.0.0.0",
    "::1",
    "[::]",
    "host.docker.internal",
    "localhost",
    "--network=host",
    "--network host",
    "docker pull",
    "--pull=always",
    "--pull=missing",
    "apt-get",
    "brew install",
    "pip install",
)


def module_source(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parsed(path: Path) -> ast.Module:
    return ast.parse(module_source(path), filename=str(path))


def imported_roots(tree: ast.Module) -> set[str]:
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            roots.add(node.module.split(".")[0])
    return roots


def test_the_c8_source_root_and_package_exist() -> None:
    require_c8_path(SRC)
    require_c8_path(SRC / PACKAGE)
    require_c8_path(SRC / PACKAGE / "__init__.py")


def test_the_package_imports_and_names_itself() -> None:
    package = load_c8()
    assert require_c8_attr(package, "__name__") == PACKAGE
    docstring = require_c8_attr(package, "__doc__")
    assert isinstance(docstring, str) and docstring.strip()


def test_the_module_inventory_is_exactly_the_reviewed_inventory() -> None:
    package_dir = require_c8_path(SRC / PACKAGE)
    authored = tuple(
        sorted(
            path.stem
            for path in package_dir.glob("*.py")
            if path.stem != "__init__"
        )
    )
    assert authored == tuple(sorted(C8_MODULES))


def test_the_package_directory_holds_no_nested_subpackage() -> None:
    package_dir = require_c8_path(SRC / PACKAGE)
    nested = tuple(
        sorted(
            path.name
            for path in package_dir.iterdir()
            if path.is_dir() and path.name != "__pycache__"
        )
    )
    assert nested == ()


def test_the_source_root_holds_exactly_the_one_package() -> None:
    root = require_c8_path(SRC)
    entries = tuple(sorted(path.name for path in root.iterdir()))
    assert entries == (PACKAGE,)


@pytest.mark.parametrize("module", C8_MODULES)
def test_every_reviewed_module_imports(module: str) -> None:
    loaded = load_c8(module)
    assert require_c8_attr(loaded, "__name__") == f"{PACKAGE}.{module}"


@pytest.mark.parametrize("module", C8_MODULES)
def test_every_module_carries_a_docstring(module: str) -> None:
    docstring = require_c8_attr(load_c8(module), "__doc__")
    assert isinstance(docstring, str) and docstring.strip()


@pytest.mark.parametrize("module", C8_MODULES)
def test_every_module_declares_a_resolvable_all(module: str) -> None:
    loaded = load_c8(module)
    exported = require_c8_attr(loaded, "__all__")
    assert isinstance(exported, (list, tuple)) and exported
    assert sorted(exported) == list(exported), "__all__ must be sorted"
    assert len(set(exported)) == len(exported), "__all__ must not repeat a name"
    missing = [name for name in exported if not hasattr(loaded, name)]
    assert missing == []


@pytest.mark.parametrize("module", C8_MODULES)
def test_no_library_module_reaches_for_a_process_socket_or_network(module: str) -> None:
    path = require_c8_path(SRC / PACKAGE / f"{module}.py")
    reached = sorted(imported_roots(parsed(path)) & FORBIDDEN_LIBRARY_IMPORTS)
    assert reached == []


@pytest.mark.parametrize("name", C8_SCRIPT_NAMES)
def test_entrypoint_imports_expose_only_the_one_reviewed_process_seam(name: str) -> None:
    path = require_c8_path(SCRIPTS / name)
    reached = imported_roots(parsed(path)) & FORBIDDEN_LIBRARY_IMPORTS
    expected = {"subprocess"} if name == "run_topology_rehearsal.py" else set()
    assert reached == expected


def test_every_authored_file_obeys_the_tree_wide_effect_import_policy() -> None:
    reached = {
        str(path.relative_to(SCRIPTS.parent)): imported_roots(parsed(path))
        & FORBIDDEN_LIBRARY_IMPORTS
        for path in authored_sources()
    }
    assert reached == {
        **{
            str(path.relative_to(SCRIPTS.parent)): set()
            for path in authored_sources()
            if path != SCRIPTS / "run_topology_rehearsal.py"
        },
        "scripts/run_topology_rehearsal.py": {"subprocess"},
    }


def test_the_complete_authored_tree_contains_exactly_one_process_spawn_site() -> None:
    spawn_names = {
        "Popen",
        "call",
        "check_call",
        "check_output",
        "exec",
        "execv",
        "execve",
        "execvp",
        "execvpe",
        "fork",
        "popen",
        "posix_spawn",
        "posix_spawnp",
        "run",
        "spawnl",
        "spawnle",
        "spawnlp",
        "spawnlpe",
        "spawnv",
        "spawnve",
        "spawnvp",
        "spawnvpe",
        "system",
    }
    sites: list[tuple[str, str]] = []
    for path in authored_sources():
        tree = parsed(path)
        module_aliases: dict[str, str] = {}
        direct_aliases: dict[str, str] = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    root = alias.name.split(".")[0]
                    if root in {"os", "subprocess"}:
                        module_aliases[alias.asname or root] = root
            elif (
                isinstance(node, ast.ImportFrom)
                and node.level == 0
                and node.module in {"os", "subprocess"}
            ):
                for alias in node.names:
                    if alias.name in spawn_names:
                        direct_aliases[alias.asname or alias.name] = (
                            f"{node.module}.{alias.name}"
                        )
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            if isinstance(node.func, ast.Attribute) and node.func.attr in spawn_names:
                alias = node.func.value.id if isinstance(node.func.value, ast.Name) else ""
                owner = module_aliases.get(alias)
                if owner is not None:
                    sites.append(
                        (
                            str(path.relative_to(SCRIPTS.parent)),
                            f"{owner}.{node.func.attr}",
                        )
                    )
            elif isinstance(node.func, ast.Name) and node.func.id in direct_aliases:
                sites.append(
                    (str(path.relative_to(SCRIPTS.parent)), direct_aliases[node.func.id])
                )
    assert sites == [("scripts/run_topology_rehearsal.py", "subprocess.run")]


@pytest.mark.parametrize("name", C8_SCRIPT_NAMES)
def test_both_inert_entrypoints_exist(name: str) -> None:
    require_c8_path(SCRIPTS / name)


def test_the_scripts_root_holds_exactly_the_two_entrypoints() -> None:
    root = require_c8_path(SCRIPTS)
    authored = tuple(sorted(path.name for path in root.glob("*.py")))
    assert authored == tuple(sorted(C8_SCRIPT_NAMES))
    nested = tuple(
        sorted(
            path.name
            for path in root.iterdir()
            if path.is_dir() and path.name != "__pycache__"
        )
    )
    assert nested == ()


@pytest.mark.parametrize("name", C8_SCRIPT_NAMES)
def test_both_entrypoints_import_and_carry_a_docstring(name: str) -> None:
    script = load_c8_script(name)
    assert isinstance(script.__doc__, str) and script.__doc__.strip()


def authored_sources() -> tuple[Path, ...]:
    """Every authored C8 file, or a RED failure while none exist.

    An empty source tree must never satisfy a source-scan control: a vacuous "no offending
    literal found" would silently report the absent implementation as compliant.
    """
    require_c8_path(SRC)
    require_c8_path(SCRIPTS)
    paths = source_paths()
    if not paths:
        pytest.fail(
            "missing C8 implementation — no authored source file exists, so this "
            "source-scan control cannot be satisfied vacuously",
            pytrace=False,
        )
    return paths


def test_no_authored_byte_names_a_non_loopback_address_or_installer() -> None:
    offences: list[str] = []
    for path in authored_sources():
        text = module_source(path)
        offences.extend(
            f"{path}: {literal}"
            for literal in FORBIDDEN_ADDRESS_LITERALS
            if literal in text
        )
    assert offences == []


def test_the_only_address_literal_in_the_source_tree_is_the_reviewed_loopback() -> None:
    addresses: set[str] = set()
    for path in authored_sources():
        for node in ast.walk(parsed(path)):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                candidate = node.value
                addresses.update(
                    re.findall(
                        r"(?<![0-9])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![0-9])",
                        candidate,
                    )
                )
                ipv6 = re.match(r"^(?:\[(::(?:1)?)\]|(::(?:1)?))(?:[:/]|$)", candidate)
                if ipv6:
                    addresses.add(ipv6.group(1) or ipv6.group(2))
    assert addresses <= {"127.0.0.1"}


@pytest.mark.parametrize("module", ("__init__", *C8_MODULES))
def test_no_module_declares_a_mutable_module_level_global(module: str) -> None:
    """Module-level state must be an exported constant, callable or class.

    A lowercase module-level assignment is a mutable global: it would let one attempt's
    observation leak into the next, which a one-attempt specification cannot permit.
    """
    path = require_c8_path(SRC / PACKAGE / f"{module}.py")
    offending: list[str] = []
    for node in parsed(path).body:
        targets: list[ast.expr] = []
        if isinstance(node, ast.Assign):
            targets = list(node.targets)
        elif isinstance(node, ast.AnnAssign):
            targets = [node.target]
        for target in targets:
            if isinstance(target, ast.Name) and not (
                target.id.isupper() or target.id.startswith("__")
            ):
                offending.append(target.id)
    assert offending == []
