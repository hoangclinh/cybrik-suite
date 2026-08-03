from __future__ import annotations

from pathlib import Path

import pytest
from cybrik_suite_uat_fabric import bootstrap


def test_locate_harness_root_and_default_import_roots_match_current_worktree() -> None:
    harness_root = bootstrap.locate_harness_root(Path(__file__))
    assert harness_root == Path(__file__).resolve().parents[1]

    roots = bootstrap.resolve_import_roots(harness_root)

    assert roots["suite"] == harness_root / "src"
    assert roots["soc"] == Path(
        "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/"
        "soc-d2-runtime-tuple-r1/services/api/src"
    )
    assert roots["cyber_ai_api"] == Path(
        "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/"
        "ai-d2-runtime-tuple-r1/services/ai-api/src"
    )
    assert roots["cyber_ai_core"] == Path(
        "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/"
        "ai-d2-runtime-tuple-r1/packages/ai-core/src"
    )
    assert roots["tool_fabric"] == Path(
        "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/"
        "fabric-runtime-producer-r1/src/control-plane"
    )


def test_env_override_replaces_default_product_root(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    harness_root = bootstrap.locate_harness_root(Path(__file__))
    expected = Path(
        "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/"
        "fabric-runtime-producer-r1/src/control-plane"
    )
    monkeypatch.setenv("CYBRIK_UAT_FABRIC_SRC", str(expected))

    roots = bootstrap.resolve_import_roots(harness_root)

    assert roots["tool_fabric"] == expected


def test_prepend_import_roots_rejects_relative_paths() -> None:
    with pytest.raises(bootstrap.BootstrapError, match="import_root_invalid"):
        bootstrap.prepend_import_roots([], [Path("relative")])
