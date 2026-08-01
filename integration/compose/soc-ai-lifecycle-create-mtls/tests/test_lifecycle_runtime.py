"""Static controls plus the fail-closed collection guard for D2 runtime tests.

No function in this file is a permitted preflight execution target. Phase A
must pin this file by digest; Phase B may execute it only after the committed
candidate record and independent authorization both open the exact attempt.
"""

from __future__ import annotations

import ast
import os
from pathlib import Path

import pytest
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
        "RUNTIME_ROOT=",
        "EVIDENCE_ROOT=",
    ):
        assert required in source


def test_missing_pinned_trust_factory_is_wrapped_as_authorization_failure() -> None:
    tree = ast.parse(_HARNESS.read_text(encoding="utf-8"), filename=str(_HARNESS))
    compatibility = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef)
        and node.name == "assert_product_api_compatibility"
    )
    guarded = "\n".join(
        ast.unparse(statement)
        for statement in compatibility.body
        if isinstance(statement, ast.Try)
    )
    assert "from_pinned_jwks = PinnedTrustProvider.from_pinned_jwks" in guarded
    assert "from_pinned_jwks" in ast.unparse(compatibility)


def test_runtime_driver_is_collected_but_cannot_run_without_phase_a() -> None:
    source = Path(__file__).read_text(encoding="utf-8")
    harness_source = _HARNESS.read_text(encoding="utf-8") if _HARNESS.is_file() else ""
    assert 'os.environ.get("CYBRIK_UAT_D2_EXECUTION_AUTHORIZED") != "true"' in source
    assert "pytest.skip" in source
    assert "assert_runtime_authorized" in harness_source
    assert "runtime authorization is closed" in harness_source


def test_authorized_runtime_attempt_executes_the_red_green_sequence() -> None:
    """Phase B target. Do not select before the exact authorization opens."""

    if os.environ.get("CYBRIK_UAT_D2_EXECUTION_AUTHORIZED") != "true":
        pytest.skip("D2 Phase A authorization is closed")

    from cybrik_suite_uat_mtls.harness import run_runtime_attempt

    summary = run_runtime_attempt()
    assert summary == {
        "case_count": 10,
        "failed_count": 0,
        "mtls_client_certificate_count": 1,
        "mtls_client_cert_error_absent": True,
        "mtls_server_certificate_present": True,
        "mtls_tls_version": 0x0304,
        "passed_count": 10,
        "postgres_force_rls_table_count": 5,
        "postgres_replay_row_count": 1,
        "postgres_role_posture_verified": True,
        "postgres_rls_isolation_verified": True,
        "relying_party_refusal_count": 9,
        "runtime_red_case_id": "N8",
        "ssl_hardened_options_preserved": True,
        "ssl_no_compression_verified": True,
    }
