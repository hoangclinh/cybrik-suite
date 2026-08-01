"""Static one-to-one witness for the authored N1-N10 runtime implementations."""

from __future__ import annotations

import ast
from pathlib import Path

from cybrik_suite_uat_mtls import procedure

_CLIENT = Path(__file__).resolve().parents[1] / "src/cybrik_suite_uat_mtls/client.py"


def test_every_inventory_case_has_exactly_one_authored_runtime_handler() -> None:
    assert _CLIENT.is_file(), "D2 client module is not authored"
    tree = ast.parse(_CLIENT.read_text(encoding="utf-8"), filename=str(_CLIENT))
    functions = [
        node.name
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]
    expected = [f"run_{case.case_id.casefold()}" for case in procedure.CASE_INVENTORY]
    assert [name for name in functions if name in expected] == expected


def test_negative_runtime_handlers_have_no_skip_or_false_green_marker() -> None:
    source = _CLIENT.read_text(encoding="utf-8") if _CLIENT.is_file() else ""
    assert source
    lowered = source.casefold()
    for marker in ("pytest.skip", "pytest.xfail", "todo", "authored_not_run"):
        assert marker not in lowered


def test_runtime_cases_prove_persistence_outage_and_secret_boundaries() -> None:
    source = _CLIENT.read_text(encoding="utf-8")
    harness = (_CLIENT.parent / "harness.py").read_text(encoding="utf-8")
    for required in (
        "rejection_code",
        "known_runtime_secret",
        "postgres_replay_row_count",
        "postgres_rls_isolation_verified",
    ):
        assert required in source or required in harness
    assert "if not store.verify_absent()" in harness
    assert 'results.append(_run_case("N9"' in harness
    assert "store.pause()" not in harness


def test_every_network_negative_requires_the_generic_relying_party_refusal() -> None:
    source = _CLIENT.read_text(encoding="utf-8")
    harness = (_CLIENT.parent / "harness.py").read_text(encoding="utf-8")

    assert "required_rejection_code" in source
    assert 'required_rejection_code="relying_party_refusal"' in source
    assert '"transport_timeout": "transport_timeout"' in source
    assert '"transport_failure": "transport_failure"' in source
    assert "rejection_codes != {plan.required_rejection_code}" in source
    assert "relying_party_refusal_count" in harness
    assert "relying_party_refusal_count != 9" in harness
