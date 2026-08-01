"""Static teardown-coverage controls for every D2-created resource kind."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from cybrik_suite_uat_mtls import harness

_SRC = Path(__file__).resolve().parents[1] / "src/cybrik_suite_uat_mtls"
_EXPECTED_RESOURCES = {
    "ai_process",
    "client_process",
    "postgres_container",
    "ai_listener",
    "postgres_listener",
    "runtime_directory",
    "pki_material",
}


def _text(name: str) -> str:
    path = _SRC / name
    assert path.is_file(), f"D2 runtime module is not authored: {name}"
    return path.read_text(encoding="utf-8")


def test_teardown_registry_covers_every_created_resource() -> None:
    tree = ast.parse(_text("harness.py"), filename="harness.py")
    assignments = {
        target.id: node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign)
        for target in node.targets
        if isinstance(target, ast.Name)
    }
    value = assignments.get("RESOURCE_KINDS")
    assert isinstance(value, (ast.Tuple, ast.Set))
    declared = {
        item.value
        for item in value.elts
        if isinstance(item, ast.Constant) and isinstance(item.value, str)
    }
    assert declared == _EXPECTED_RESOURCES


def test_teardown_implementation_is_idempotent_and_verifies_absence() -> None:
    harness = _text("harness.py")
    store = _text("store.py")
    pki = _text("pki.py")
    for required in ("teardown", "verify_absent", "finally"):
        assert required in harness
    assert '("docker", "container", "inspect", CONTAINER_NAME)' in store
    assert "destroy_ephemeral_pki" in pki


def test_cleanup_rejects_repository_nested_runtime_root_without_deleting_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    roots = {name: tmp_path / name for name in ("soc", "ai", "fabric")}
    for root in roots.values():
        root.mkdir()
    nested = roots["soc"] / "must-survive"
    nested.mkdir()
    (nested / "marker").write_text("synthetic", encoding="utf-8")
    evidence_root = tmp_path / "evidence"
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(nested))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(evidence_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_SOC_REPO", str(roots["soc"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_AI_REPO", str(roots["ai"]))
    monkeypatch.setenv("CYBRIK_UAT_D2_FABRIC_REPO", str(roots["fabric"]))
    with pytest.raises(harness.RuntimeAuthorizationError):
        harness.teardown()
    assert (nested / "marker").read_text(encoding="utf-8") == "synthetic"


def test_runner_reports_cleanup_failure_instead_of_suppressing_it() -> None:
    runner = (
        Path(__file__).resolve().parents[4]
        / "tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh"
    ).read_text(encoding="utf-8")
    assert "rollback >/dev/null 2>&1 || true" not in runner
    assert "cleanup failed" in runner
