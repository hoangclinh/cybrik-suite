"""Tests for the required N1-N10 negative-case inventory.

The inventory is an authored description of the ten negative cases the accepted
packet requires at the runtime gate. Every case must appear exactly once, must
declare `authored_not_run`, and must not claim a skipped, deferred or
unexecuted-success state. Nothing here executes a case: these tests read an
immutable description and check its shape.
"""

from __future__ import annotations

import ast
import dataclasses
from pathlib import Path

import pytest

from cybrik_suite_uat_mtls import evidence, policy, procedure

_SRC_ROOT = Path(__file__).resolve().parents[1] / "src" / "cybrik_suite_uat_mtls"

_REQUIRED_CASE_IDS = tuple(f"N{index}" for index in range(1, 11))

# Every state that would let an unrun case read as covered, skipped away or
# already green. Matched by equality, never by substring: `authored_not_run`
# itself legitimately ends in `run`.
_FORBIDDEN_STATUSES = (
    "skip",
    "skipped",
    "xfail",
    "xpass",
    "todo",
    "pending",
    "deferred",
    "pass",
    "passed",
    "success",
    "succeeded",
    "green",
    "ok",
    "verified",
    "executed",
    "complete",
    "completed",
    "not_run",
    "",
)


def _case(case_id: str) -> procedure.NegativeCase:
    for case in procedure.CASE_INVENTORY:
        if case.case_id == case_id:
            return case
    raise AssertionError(f"case {case_id} is absent from the authored inventory")


def _inventory_without(case_id: str) -> tuple[procedure.NegativeCase, ...]:
    return tuple(
        case for case in procedure.CASE_INVENTORY if case.case_id != case_id
    )


# --------------------------------------------------------------------------
# Coverage — every required case exactly once
# --------------------------------------------------------------------------


def test_inventory_declares_exactly_ten_cases() -> None:
    assert isinstance(procedure.CASE_INVENTORY, tuple)
    assert len(procedure.CASE_INVENTORY) == 10


def test_inventory_covers_every_required_case_exactly_once() -> None:
    declared = [case.case_id for case in procedure.CASE_INVENTORY]
    assert declared == list(_REQUIRED_CASE_IDS)
    assert len(set(declared)) == len(declared)


def test_required_case_purposes_are_the_accepted_packet_rows() -> None:
    assert procedure.REQUIRED_CASE_PURPOSES == (
        ("N1", "replayed_delegation"),
        ("N2", "cnf_mismatch"),
        ("N3", "wrong_audience"),
        ("N4", "wrong_scope"),
        ("N5", "wrong_operation"),
        ("N6", "cross_tenant"),
        ("N7", "tenant_org_advisory_mismatch"),
        ("N8", "missing_server_tls_extension"),
        ("N9", "postgresql_unavailable"),
        ("N10", "secret_material_leakage"),
    )


def test_inventory_declares_each_required_purpose_exactly_once() -> None:
    declared = [case.purpose for case in procedure.CASE_INVENTORY]
    required = [purpose for _, purpose in procedure.REQUIRED_CASE_PURPOSES]
    assert declared == required


def test_every_case_carries_a_required_outcome_sentence() -> None:
    for case in procedure.CASE_INVENTORY:
        assert isinstance(case.required_outcome, str)
        assert case.required_outcome.strip() == case.required_outcome
        assert len(case.required_outcome) >= 20


# --------------------------------------------------------------------------
# Authored, never run
# --------------------------------------------------------------------------


def test_every_case_is_authored_not_run() -> None:
    states = {case.status for case in procedure.CASE_INVENTORY}
    assert states == {procedure.CASE_STATUS_AUTHORED_NOT_RUN}
    assert procedure.CASE_STATUS_AUTHORED_NOT_RUN == "authored_not_run"


def test_every_case_defers_to_the_runtime_gate() -> None:
    gates = {case.authorizing_gate for case in procedure.CASE_INVENTORY}
    assert gates == {"D2"}


@pytest.mark.parametrize("status", _FORBIDDEN_STATUSES)
def test_validate_case_rejects_a_skipped_deferred_or_unexecuted_success_state(
    status: str,
) -> None:
    candidate = dataclasses.replace(_case("N1"), status=status)
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case(candidate)
    assert caught.value.reason == procedure.CASE_STATUS_NOT_AUTHORED_NOT_RUN


def test_negative_case_declares_no_runtime_result_field() -> None:
    names = tuple(field.name for field in dataclasses.fields(procedure.NegativeCase))
    assert names == (
        "case_id",
        "purpose",
        "surface",
        "required_outcome",
        "status",
        "authorizing_gate",
    )


def test_case_inventory_is_immutable() -> None:
    with pytest.raises(TypeError):
        procedure.CASE_INVENTORY[0] = _case("N2")  # type: ignore[index]
    with pytest.raises(dataclasses.FrozenInstanceError):
        procedure.CASE_INVENTORY[0].status = "passed"  # type: ignore[misc]


# --------------------------------------------------------------------------
# Surfaces — the two reviewed loopback binds only
# --------------------------------------------------------------------------


def test_every_case_binds_a_reviewed_loopback_surface() -> None:
    for case in procedure.CASE_INVENTORY:
        assert case.surface in policy.PROPOSED_BINDS
        resolved = policy.resolve_proposed_surface(case.surface)
        assert resolved.host == "127.0.0.1"


def test_postgresql_unavailable_case_targets_the_replay_surface() -> None:
    case = _case("N9")
    assert case.purpose == "postgresql_unavailable"
    assert case.surface == policy.POSTGRES_SURFACE
    assert policy.resolve_proposed_surface(case.surface).port == 55432


def test_every_other_case_targets_the_mtls_surface() -> None:
    for case in _inventory_without("N9"):
        assert case.surface == policy.AI_MTLS_SURFACE
        assert policy.resolve_proposed_surface(case.surface).port == 58443


# --------------------------------------------------------------------------
# Inventory validation — fail closed
# --------------------------------------------------------------------------


def test_validate_case_inventory_accepts_the_authored_inventory() -> None:
    assert procedure.validate_case_inventory(procedure.CASE_INVENTORY) == (
        procedure.CASE_INVENTORY
    )


@pytest.mark.parametrize("candidate", (None, "N1", ["N1"], {"cases": ()}))
def test_validate_case_inventory_requires_a_declared_inventory(
    candidate: object,
) -> None:
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case_inventory(candidate)
    assert caught.value.reason == procedure.INVENTORY_NOT_DECLARED


def test_validate_case_inventory_rejects_an_undeclared_member() -> None:
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case_inventory(("N1",))
    assert caught.value.reason == procedure.CASE_NOT_DECLARED


def test_validate_case_inventory_rejects_a_duplicated_case() -> None:
    candidate = procedure.CASE_INVENTORY + (_case("N1"),)
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case_inventory(candidate)
    assert caught.value.reason == procedure.DUPLICATE_CASE_ID


@pytest.mark.parametrize("case_id", ("N1", "N8", "N9", "N10"))
def test_validate_case_inventory_rejects_a_missing_case(case_id: str) -> None:
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case_inventory(_inventory_without(case_id))
    assert caught.value.reason == procedure.MISSING_CASE


def test_validate_case_inventory_rejects_an_out_of_order_inventory() -> None:
    reordered = procedure.CASE_INVENTORY[1:] + procedure.CASE_INVENTORY[:1]
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case_inventory(reordered)
    assert caught.value.reason == procedure.CASE_ORDER_NOT_CANONICAL


# --------------------------------------------------------------------------
# Case validation — fail closed
# --------------------------------------------------------------------------


@pytest.mark.parametrize("candidate", (None, "N1", {"case_id": "N1"}))
def test_validate_case_requires_a_declared_case(candidate: object) -> None:
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case(candidate)
    assert caught.value.reason == procedure.CASE_NOT_DECLARED


@pytest.mark.parametrize("case_id", ("N0", "N11", "n1", "", 1))
def test_validate_case_rejects_an_unknown_case_id(case_id: object) -> None:
    candidate = dataclasses.replace(_case("N1"), case_id=case_id)  # type: ignore[arg-type]
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case(candidate)
    assert caught.value.reason == procedure.CASE_ID_UNKNOWN


def test_validate_case_rejects_a_swapped_purpose() -> None:
    candidate = dataclasses.replace(_case("N1"), purpose="wrong_audience")
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case(candidate)
    assert caught.value.reason == procedure.CASE_PURPOSE_MISMATCH


@pytest.mark.parametrize("surface", ("public_ingress", "", None))
def test_validate_case_rejects_an_unknown_surface(surface: object) -> None:
    candidate = dataclasses.replace(_case("N1"), surface=surface)  # type: ignore[arg-type]
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case(candidate)
    assert caught.value.reason == procedure.CASE_SURFACE_UNKNOWN


@pytest.mark.parametrize("outcome", ("", "   ", "too short", 7))
def test_validate_case_rejects_a_missing_required_outcome(outcome: object) -> None:
    candidate = dataclasses.replace(_case("N1"), required_outcome=outcome)  # type: ignore[arg-type]
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case(candidate)
    assert caught.value.reason == procedure.CASE_OUTCOME_MISSING


@pytest.mark.parametrize("gate", ("D1", "D3", "", None))
def test_validate_case_rejects_a_gate_other_than_the_runtime_gate(
    gate: object,
) -> None:
    candidate = dataclasses.replace(_case("N1"), authorizing_gate=gate)  # type: ignore[arg-type]
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case(candidate)
    assert caught.value.reason == procedure.CASE_GATE_NOT_RUNTIME


def test_case_violation_never_echoes_the_rejected_case() -> None:
    candidate = dataclasses.replace(
        _case("N1"), required_outcome="postgresql://uat:PLACEHOLDER-NOT-A-SECRET@h/d"
    )
    with pytest.raises(procedure.ProcedureViolation) as caught:
        procedure.validate_case(candidate)
    rendered = f"{caught.value}{caught.value!r}{caught.value.args}"
    assert "PLACEHOLDER-NOT-A-SECRET" not in rendered


# --------------------------------------------------------------------------
# Case evidence — sanitizer-clean, result-free
# --------------------------------------------------------------------------


@pytest.mark.parametrize("case_id", _REQUIRED_CASE_IDS)
def test_case_evidence_passes_the_sanitizer(case_id: str) -> None:
    record = procedure.case_evidence(_case(case_id))
    assert evidence.validate_evidence(record) == record


@pytest.mark.parametrize("case_id", _REQUIRED_CASE_IDS)
def test_case_evidence_records_no_attempt_and_no_result(case_id: str) -> None:
    record = procedure.case_evidence(_case(case_id))
    assert record["attempt_count"] == 0
    assert record["authored_not_run"] is True
    assert record["status"] == procedure.CASE_STATUS_AUTHORED_NOT_RUN
    assert "result" not in record
    assert "observed_outcome" not in record


@pytest.mark.parametrize("case_id", _REQUIRED_CASE_IDS)
def test_case_evidence_carries_no_secret_bearing_text(case_id: str) -> None:
    record = procedure.case_evidence(_case(case_id))
    for key, value in record.items():
        assert evidence.secret_reason(key) is None
        if isinstance(value, str):
            assert evidence.secret_reason(value) is None


def test_case_evidence_returns_a_detached_mapping() -> None:
    first = procedure.case_evidence(_case("N1"))
    first["status"] = "tampered"
    assert procedure.case_evidence(_case("N1"))["status"] == (
        procedure.CASE_STATUS_AUTHORED_NOT_RUN
    )
    assert _case("N1").status == procedure.CASE_STATUS_AUTHORED_NOT_RUN


# --------------------------------------------------------------------------
# The inventory offers no way to run a case
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "attribute", ("run", "execute", "invoke", "assert_outcome", "__call__")
)
def test_negative_case_exposes_no_execution_method(attribute: str) -> None:
    assert not hasattr(procedure.CASE_INVENTORY[0], attribute)


def test_inventory_defines_no_case_execution_helper() -> None:
    tree = ast.parse(
        (_SRC_ROOT / "procedure.py").read_text(encoding="utf-8"),
        filename="procedure.py",
    )
    forbidden = {
        "run_case",
        "execute_case",
        "invoke_case",
        "assert_case",
        "record_result",
        "mark_passed",
    }
    defined = {
        node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)
    }
    assert defined.isdisjoint(forbidden), sorted(defined & forbidden)
