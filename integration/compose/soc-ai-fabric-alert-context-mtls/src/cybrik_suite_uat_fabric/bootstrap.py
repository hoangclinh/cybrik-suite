"""Local import bootstrap for the Suite-owned three-product UAT harness.

This module exists only to make the harness self-describing for static local
verification. It never starts processes, opens sockets, or weakens the runtime
admission boundary. The bootstrap resolves exact local source roots for the
current UAT worktree family or caller-provided environment overrides.
"""

from __future__ import annotations

import os
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Final

_OVERRIDES: Final = {
    "suite": "CYBRIK_UAT_SUITE_SRC",
    "soc": "CYBRIK_UAT_SOC_SRC",
    "cyber_ai_api": "CYBRIK_UAT_AI_API_SRC",
    "cyber_ai_core": "CYBRIK_UAT_AI_CORE_SRC",
    "tool_fabric": "CYBRIK_UAT_FABRIC_SRC",
}
_SIBLING_DEFAULTS: Final = {
    "soc": ("soc-d2-runtime-tuple-r1", "services", "api", "src"),
    "cyber_ai_api": ("ai-d2-runtime-tuple-r1", "services", "ai-api", "src"),
    "cyber_ai_core": ("ai-d2-runtime-tuple-r1", "packages", "ai-core", "src"),
    "tool_fabric": (
        "fabric-runtime-producer-r1",
        "src",
        "control-plane",
    ),
}


class BootstrapError(RuntimeError):
    """Stable refusal for local source-bootstrap failures."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _resolved_directory(path: Path, *, reason: str) -> Path:
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise BootstrapError(reason) from exc
    if resolved != path or not path.is_dir():
        raise BootstrapError(reason)
    return path


def locate_harness_root(anchor: Path) -> Path:
    """Find the harness root from any path inside this package or test tree."""

    if not isinstance(anchor, Path):
        raise TypeError("anchor must be an explicit pathlib.Path")
    start = anchor.resolve(strict=True)
    candidates = (start,) + tuple(start.parents)
    for candidate in candidates:
        if (
            (candidate / "pyproject.toml").is_file()
            and (candidate / "src" / "cybrik_suite_uat_fabric").is_dir()
            and (candidate / "tests").is_dir()
        ):
            return candidate
    raise BootstrapError("harness_root_unresolved")


def locate_suite_worktree_root(harness_root: Path) -> Path:
    """Resolve the containing Suite worktree for this harness checkout."""

    current = _resolved_directory(harness_root, reason="harness_root_invalid")
    candidates = (current,) + tuple(current.parents)
    for candidate in candidates:
        if (candidate / "docs" / "uat").is_dir() and (
            candidate / "integration" / "compose"
        ).is_dir():
            return candidate
    raise BootstrapError("suite_worktree_root_unresolved")


def resolve_import_roots(harness_root: Path) -> dict[str, Path]:
    """Return the exact local import roots for Suite/SOC/Cyber AI/Fabric."""

    harness = _resolved_directory(harness_root, reason="harness_root_invalid")
    suite_worktree = locate_suite_worktree_root(harness)
    worktree_family = _resolved_directory(
        suite_worktree.parent, reason="worktree_family_root_invalid"
    )
    roots = {
        "suite": _resolved_directory(
            harness / "src", reason="suite_source_root_invalid"
        )
    }
    for role, variable in _OVERRIDES.items():
        if role == "suite":
            continue
        raw = os.environ.get(variable)
        candidate = (
            Path(raw)
            if isinstance(raw, str) and raw
            else worktree_family.joinpath(*_SIBLING_DEFAULTS[role])
        )
        roots[role] = _resolved_directory(
            candidate, reason=f"{role}_source_root_invalid"
        )
    return roots


def prepend_import_roots(sys_path: list[str], roots: Iterable[Path]) -> tuple[str, ...]:
    """Prepend unique roots to ``sys.path`` while preserving caller order."""

    inserted: list[str] = []
    for root in roots:
        if not isinstance(root, Path) or not root.is_absolute():
            raise BootstrapError("import_root_invalid")
        text = str(root)
        if text not in sys_path:
            sys_path.insert(0, text)
            inserted.append(text)
    return tuple(inserted)


def bootstrap_local_imports(anchor: Path) -> tuple[Path, dict[str, Path]]:
    """Install the exact local import roots for static harness verification."""

    harness_root = locate_harness_root(anchor)
    roots = resolve_import_roots(harness_root)
    prepend_import_roots(
        sys.path,
        (
            roots["suite"],
            roots["soc"],
            roots["cyber_ai_api"],
            roots["cyber_ai_core"],
            roots["tool_fabric"],
        ),
    )
    return harness_root, roots
