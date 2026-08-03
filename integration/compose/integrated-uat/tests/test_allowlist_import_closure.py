from __future__ import annotations

import ast
from collections.abc import Iterable
from pathlib import Path

from cybrik_suite_integrated_uat.admission import MASTER_TRACKED_ALLOWLIST

SUITE_ROOT = Path(__file__).parents[4]
REPOSITORY_ROOTS = {
    "suite": SUITE_ROOT,
    "soc": SUITE_ROOT.parent / "soc-lifecycle-create-r1",
    "cyber_ai": SUITE_ROOT.parent / "ai-d2-runtime-tuple-r1",
    "tool_fabric": SUITE_ROOT.parent / "fabric-runtime-producer-r1",
}
SOURCE_ROOTS = {
    "suite": (
        Path("integration/compose/soc-ai-lifecycle-create-mtls/src"),
        Path("integration/compose/soc-ai-fabric-alert-context-mtls/src"),
        Path("integration/compose/integrated-uat/src"),
    ),
    "soc": (Path("services/api/src"),),
    "cyber_ai": (Path("packages/ai-core/src"), Path("services/ai-api/src")),
    "tool_fabric": (Path("src/control-plane"),),
}


def _module_name(relative: Path, sources: tuple[Path, ...]) -> tuple[str, bool] | None:
    for source in sources:
        if relative.is_relative_to(source):
            local = relative.relative_to(source)
            if local.suffix != ".py":
                return None
            parts = local.with_suffix("").parts
            package = parts[-1] == "__init__"
            if package:
                parts = parts[:-1]
            return ".".join(parts), package
    return None


def _imports(path: Path, module: str, package: bool) -> Iterable[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    current_package = module if package else module.rpartition(".")[0]
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                base = current_package.split(".") if current_package else []
                keep = len(base) - node.level + 1
                prefix = base[: max(keep, 0)]
                if node.module:
                    prefix.extend(node.module.split("."))
                imported = ".".join(prefix)
            else:
                imported = node.module or ""
            if imported:
                yield imported
            for alias in node.names:
                if imported and alias.name != "*":
                    yield f"{imported}.{alias.name}"


def _resolve_local(role: str, module: str) -> str | None:
    repository = REPOSITORY_ROOTS[role]
    for source in SOURCE_ROOTS[role]:
        stem = repository / source / Path(*module.split("."))
        for candidate in (stem.with_suffix(".py"), stem / "__init__.py"):
            if candidate.is_file():
                return candidate.relative_to(repository).as_posix()
    return None


def test_declared_allowlist_is_closed_over_every_resolvable_first_party_import() -> (
    None
):
    missing: list[tuple[str, str, str]] = []
    for role, allowed_paths in MASTER_TRACKED_ALLOWLIST.items():
        repository = REPOSITORY_ROOTS[role]
        assert repository.is_dir(), role
        allowed = set(allowed_paths)
        for relative_text in allowed_paths:
            relative = Path(relative_text)
            path = repository / relative
            assert path.is_file(), (role, relative_text)
            identity = _module_name(relative, SOURCE_ROOTS[role])
            if identity is None:
                continue
            module, package = identity
            for imported in _imports(path, module, package):
                parts = imported.split(".")
                for length in range(1, len(parts) + 1):
                    resolved = _resolve_local(role, ".".join(parts[:length]))
                    if resolved is not None and resolved not in allowed:
                        missing.append((role, relative_text, resolved))

    assert missing == []
