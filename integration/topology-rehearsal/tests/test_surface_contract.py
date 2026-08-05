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
    ROOT,
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

# The one status an authored C8 library module may declare. It is reviewed source and
# nothing more: no module here has ever been run against Docker, a listener or a database.
LIBRARY_STATUS = "Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`."
# The project status is deliberately phase-independent. A line naming one lettered phase has
# to be rewritten in lockstep with every slice that lands, and the failure mode of that is a
# status that still names the phase before last — an overstatement of what is present dressed
# as a pinned constant. "Partially present" stays exactly true from the first module until
# the last, and the per-module inventory below is what says which ones those are.
PROJECT_STATUS = (
    "Status: BOUNDED C8 LIBRARY CORE PARTIALLY PRESENT — LATER C8 MODULES RED — "
    "NO RUNTIME AUTHORITY."
)
# Standings this specification cannot evidence. A module that claimed one would present
# unexecuted source as a tested, piloted or released capability.
UNEVIDENCED_STATUS_CLAIMS = r"\b(?:IMPLEMENTED|VERIFIED|PILOTED|GA|PRODUCTION)\b"

# The exact sentences the package front door must carry. They are pinned rather than
# paraphrased so a later edit cannot soften the absence back into an implied whole runner.
FRONT_DOOR_BOUNDED_CLAIM = "Only part of the bounded C8 library core is present"
FRONT_DOOR_ABSENCE_CLAIM = "remain absent, and their tests stay RED"
FRONT_DOOR_SCRIPT_CLAIM = "both entrypoint scripts"
# The modules still absent. Stated here so the front-door control fails if one lands without
# the front door being brought back into line.
FRONT_DOOR_ABSENT_MODULES = (
    "runner",
)
# The modules that are present, in inventory order. Naming both sides explicitly is what
# makes the front door falsifiable: a docstring that merely mentioned every module somewhere
# would satisfy the name-check below while still placing a landed module among the absent.
FRONT_DOOR_PRESENT_MODULES = (
    "constants",
    "errors",
    "protocols",
    "adapter",
    "plan",
    "observe",
    "grant",
    "preparation",
    "admission",
)

# The reviewed per-module size bound, in lines. Strictly under, not up to.
MODULE_LINE_LIMIT = 800

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


def test_project_and_harness_headers_state_the_mixed_c8a_lifecycle_truthfully() -> None:
    """The project may not keep claiming all source is absent after C8-A lands."""
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    harness = (ROOT / "tests" / "conftest.py").read_text(encoding="utf-8")
    assert f"# {PROJECT_STATUS}" in pyproject
    assert PROJECT_STATUS in harness
    stale = "RED — TESTS ONLY — RUNNER NOT IMPLEMENTED"
    assert stale not in pyproject
    assert stale not in harness


def test_the_package_imports_and_names_itself() -> None:
    package = load_c8()
    assert require_c8_attr(package, "__name__") == PACKAGE
    docstring = require_c8_attr(package, "__doc__")
    assert isinstance(docstring, str) and docstring.strip()


def test_the_package_front_door_states_the_bounded_core_and_the_absent_remainder() -> None:
    """The first thing a reader imports may not describe a runner that is not there.

    The front door is where a reader forms their idea of what this package is. Announcing
    an implemented runner while five of its ten modules and both entrypoints are absent is
    the same overstatement the status lines exist to prevent — and it is the one place the
    per-module status control never looks, because `__init__` is not in the inventory.

    Present and absent are read off the tree rather than hard-coded, so the control keeps
    holding as modules land instead of pinning today's split forever.
    """
    docstring = require_c8_attr(load_c8(), "__doc__")
    package_dir = require_c8_path(SRC / PACKAGE)
    unnamed = [
        module for module in C8_MODULES if f"`{module}`" not in docstring
    ]
    assert unnamed == []
    assert FRONT_DOOR_BOUNDED_CLAIM in docstring
    assert FRONT_DOOR_ABSENCE_CLAIM in docstring
    assert FRONT_DOOR_SCRIPT_CLAIM in docstring
    for name in C8_SCRIPT_NAMES:
        assert not (SCRIPTS / name).exists()
    absent = tuple(
        module for module in C8_MODULES if not (package_dir / f"{module}.py").exists()
    )
    present = tuple(module for module in C8_MODULES if module not in absent)
    assert absent == FRONT_DOOR_ABSENT_MODULES
    assert present == FRONT_DOOR_PRESENT_MODULES
    # The overstatement this control replaces: a whole-runner claim from a partial package.
    assert "This package implements the runner specified by" not in docstring


def sentences(text: str) -> tuple[str, ...]:
    """The docstring as flat sentences, so a claim can be located rather than grepped."""
    collapsed = " ".join(text.split())
    return tuple(part.strip() for part in re.split(r"(?<=\.)\s+", collapsed) if part.strip())


def sole_sentence_containing(docstring: str, claim: str) -> str:
    """The one sentence carrying a pinned claim, or a RED failure naming the drift."""
    found = [sentence for sentence in sentences(docstring) if claim in sentence]
    assert len(found) == 1, f"exactly one sentence must carry {claim!r}, found {len(found)}"
    return found[0]


def test_the_front_door_places_every_module_on_the_side_it_is_actually_on() -> None:
    """Naming a module is not enough: it must be named on the correct side of the split.

    The previous control asserted only that every module appeared somewhere in the front
    door and that the two claim fragments were present. That passes unchanged when a module
    lands and stays listed as absent — the exact overstatement the front door exists to
    prevent. Here the present sentence must place `preparation` alongside the seven modules
    that landed before it, and the absence sentence must name `admission`, `runner` and both
    entrypoint scripts and nothing else.
    """
    docstring = require_c8_attr(load_c8(), "__doc__")
    package_dir = require_c8_path(SRC / PACKAGE)
    absent = tuple(
        module for module in C8_MODULES if not (package_dir / f"{module}.py").exists()
    )
    present = tuple(module for module in C8_MODULES if module not in absent)

    present_sentence = sole_sentence_containing(docstring, FRONT_DOOR_BOUNDED_CLAIM)
    unplaced = [module for module in present if f"`{module}`" not in present_sentence]
    assert unplaced == [], "every present module must be named in the present sentence"
    misplaced = [module for module in absent if f"`{module}`" in present_sentence]
    assert misplaced == [], "an absent module may not be listed among the present ones"

    absence_sentence = sole_sentence_containing(docstring, FRONT_DOOR_ABSENCE_CLAIM)
    unnamed = [module for module in absent if f"`{module}`" not in absence_sentence]
    assert unnamed == [], "every absent module must be named in the absence sentence"
    overclaimed = [module for module in present if f"`{module}`" in absence_sentence]
    assert overclaimed == [], "a landed module may not still be described as absent"
    assert FRONT_DOOR_SCRIPT_CLAIM in absence_sentence
    # The front door may not quietly acquire a runtime claim while it is being corrected.
    assert re.findall(UNEVIDENCED_STATUS_CLAIMS, docstring) == []
    assert LIBRARY_STATUS in [line.strip() for line in docstring.splitlines() if line.strip()]


def test_no_authored_module_exceeds_the_reviewed_size_bound() -> None:
    """A module past the bound stops being reviewable in one sitting.

    The limit is stated as a control rather than left to a reviewer's memory, because a file
    drifts over it one honest paragraph at a time.
    """
    oversized = {
        str(path.relative_to(SCRIPTS.parent)): len(module_source(path).splitlines())
        for path in authored_sources()
        if len(module_source(path).splitlines()) >= MODULE_LINE_LIMIT
    }
    assert oversized == {}


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
def test_every_module_declares_the_truthful_bounded_library_status(module: str) -> None:
    """Each authored module states exactly what it is: source with no runtime authority.

    A reader reaching for one of these modules must be told, in the module itself, that
    nothing here has been run against Docker, a listener or a database. The status is
    therefore an exact line rather than free prose, and the words that would claim a
    standing this specification cannot evidence are refused outright.
    """
    docstring = require_c8_attr(load_c8(module), "__doc__")
    declared = [line.strip() for line in docstring.splitlines() if line.strip()]
    assert LIBRARY_STATUS in declared
    assert re.findall(UNEVIDENCED_STATUS_CLAIMS, docstring) == []


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
    """Only the one reviewed entrypoint may name `subprocess`; no other authored file may.

    The expectation is derived from the files that exist, so the same invariant is enforced
    on the tree authored today and, unchanged, on the tree once the entrypoints land.
    """
    authored = authored_sources()
    runner_script = SCRIPTS / "run_topology_rehearsal.py"
    reached = {
        str(path.relative_to(SCRIPTS.parent)): imported_roots(parsed(path))
        & FORBIDDEN_LIBRARY_IMPORTS
        for path in authored
    }
    assert reached == {
        str(path.relative_to(SCRIPTS.parent)): (
            {"subprocess"} if path == runner_script else set()
        )
        for path in authored
    }


def test_the_complete_authored_tree_contains_exactly_one_process_spawn_site() -> None:
    """The whole authored tree spawns a process from exactly one reviewed site.

    While the entrypoints are absent the authored tree must spawn from *no* site at all;
    the exact one-site invariant is retained verbatim and re-asserted the moment the one
    reviewed entrypoint exists.
    """
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
    runner_script = SCRIPTS / "run_topology_rehearsal.py"
    assert sites == (
        [("scripts/run_topology_rehearsal.py", "subprocess.run")]
        if runner_script.exists()
        else []
    )


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
    """Every authored C8 file that exists today, or a RED failure while none do.

    The tree-wide controls must judge the code that is actually authored. Demanding the
    whole future tree here would abort each of them on the first absent root, so a module
    that *is* written would never be read at all and its violations would hide behind an
    unrelated RED. The absent roots stay RED in the inventory tests above, where their
    absence is the fact under test rather than an accident of traversal order.

    An empty tree is still refused: a vacuous "no offending literal found" would silently
    report the absent implementation as compliant.
    """
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
