"""Static teardown-coverage controls for every D2-created resource kind."""

from __future__ import annotations

import ast
from pathlib import Path

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
    assert "container inspect" in store
    assert "destroy_ephemeral_pki" in pki
