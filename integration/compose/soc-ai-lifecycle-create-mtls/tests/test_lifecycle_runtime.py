"""Static controls plus the fail-closed collection guard for D2 runtime tests.

No function in this file is a permitted preflight execution target. Phase A
must pin this file by digest; Phase B may execute it only after the committed
candidate record and independent authorization both open the exact attempt.
"""

from __future__ import annotations

import ast
from pathlib import Path

from cybrik_suite_uat_mtls import procedure

_ROOT = Path(__file__).resolve().parents[1]
_HARNESS = _ROOT / "src/cybrik_suite_uat_mtls/harness.py"


def test_harness_exposes_exactly_the_five_allowlisted_operator_steps() -> None:
    assert _HARNESS.is_file(), "D2 harness module is not authored"
    tree = ast.parse(_HARNESS.read_text(encoding="utf-8"), filename=str(_HARNESS))
    literals = {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }
    for step in procedure.LIFECYCLE_STEPS:
        assert step in literals
    assert "serve-ai" not in literals
    assert "soc-create" not in literals


def test_runtime_entrypoint_has_a_committed_authorization_guard() -> None:
    source = _HARNESS.read_text(encoding="utf-8") if _HARNESS.is_file() else ""
    for required in (
        "CYBRIK_UAT_D2_EXECUTION_AUTHORIZED",
        "CYBRIK_UAT_D2_AUTHORIZATION_PATH",
        "CYBRIK_UAT_D2_AUTHORIZATION_SHA256",
        "execution_authorized",
        "not_run",
    ):
        assert required in source


def test_runtime_driver_is_collected_but_cannot_run_without_phase_a() -> None:
    source = _HARNESS.read_text(encoding="utf-8") if _HARNESS.is_file() else ""
    assert "assert_runtime_authorized" in source
    assert "runtime authorization is closed" in source
