"""M3 branch coverage for pure terminal-evidence refusal boundaries.

These tests deliberately call validation helpers with synthetic values.  They
perform no network, listener, database, container, signal, or product-runtime
operation.
"""

from __future__ import annotations

import os
from collections.abc import Callable
from pathlib import Path

import pytest
from cybrik_suite_uat_mtls import runtime_evidence as subject

HEX64 = "a" * 64


def _reason(call: Callable[[], object], expected: str) -> None:
    with pytest.raises(subject.RuntimeEvidenceError) as caught:
        call()
    assert caught.value.reason == expected
    assert str(caught.value) == expected


@pytest.mark.parametrize(
    "value",
    (None, {1: "value"}, {"expected": 1, "extra": 2}),
)
def test_exact_mapping_rejects_non_mapping_non_string_and_wrong_keys(
    value: object,
) -> None:
    _reason(lambda: subject._exact_mapping(value, ("expected",), "bad"), "bad")


@pytest.mark.parametrize(
    ("call", "reason"),
    (
        (lambda: subject._git_sha("not-a-sha"), "repository_tuple_invalid"),
        (lambda: subject._nonnegative_int(True, "bad_integer"), "bad_integer"),
        (lambda: subject._nonnegative_int(-1, "bad_integer"), "bad_integer"),
        (lambda: subject._utc_timestamp("not-a-timestamp"), "timings_invalid"),
        (lambda: subject._utc_timestamp("2026-99-99T00:00:00Z"), "timings_invalid"),
        (
            lambda: subject.canonical_json({"bad": float("nan")}),
            "canonical_json_invalid",
        ),
    ),
)
def test_scalar_validators_collapse_invalid_values(
    call: Callable[[], object], reason: str
) -> None:
    _reason(call, reason)


def _case(
    case_id: object = "N1",
    outcome: object = "passed",
    reason: object = None,
    artifact_name: object = "case-n1",
) -> dict[str, object]:
    return {
        "case_id": case_id,
        "outcome": outcome,
        "reason_code": reason,
        "duration_ms": 1,
        "artifact_name": artifact_name,
    }


@pytest.mark.parametrize(
    ("value", "reason"),
    (
        ("not-a-sequence", "case_inventory_invalid"),
        ([_case()] * 10, "case_inventory_invalid"),
        ([_case(case_id=1)] * 10, "case_inventory_invalid"),
        ([_case(outcome="unknown")] * 10, "case_result_invalid"),
        ([_case(reason="unexpected")] * 10, "case_result_invalid"),
        (
            [_case(outcome="failed", reason="BAD") for _ in range(10)],
            "case_result_invalid",
        ),
    ),
)
def test_case_inventory_invalid_shapes_are_stable(value: object, reason: str) -> None:
    _reason(lambda: subject._validate_cases(value), reason)


def _transport() -> dict[str, object]:
    return {
        "tls_version": "TLSv1.3",
        "mtls_verified": True,
        "cnf_binding_verified": True,
        "asgi_tls_extension_verified": True,
        "ssl_hardened_options_preserved": True,
        "ssl_no_compression_verified": True,
    }


def _postgresql() -> dict[str, object]:
    return {
        "role_rolsuper": False,
        "role_rolbypassrls": False,
        "role_rolcreaterole": False,
        "force_rls_table_count": 5,
        "cross_tenant_row_count": 0,
        "replay_row_count": 1,
    }


@pytest.mark.parametrize(
    ("call", "reason"),
    (
        (
            lambda: subject._validate_transport(
                {**_transport(), "tls_version": "SSLv3"}
            ),
            "transport_invalid",
        ),
        (
            lambda: subject._validate_transport({**_transport(), "mtls_verified": 1}),
            "transport_invalid",
        ),
        (
            lambda: subject._validate_postgresql({**_postgresql(), "role_rolsuper": 0}),
            "postgresql_invalid",
        ),
    ),
)
def test_transport_and_postgresql_type_boundaries(
    call: Callable[[], object], reason: str
) -> None:
    _reason(call, reason)


def _timings() -> dict[str, object]:
    return {
        "started_at": "2026-08-02T08:00:00Z",
        "finished_at": "2026-08-02T08:00:00.001000Z",
        "setup_ms": 0,
        "cases_ms": 1,
        "teardown_ms": 0,
        "total_ms": 1,
    }


@pytest.mark.parametrize(
    "mutations",
    (
        {"finished_at": "2026-08-01T08:00:00Z"},
        {"cases_ms": 2, "total_ms": 2, "finished_at": "2026-08-02T08:00:00.002000Z"},
        {"teardown_ms": 1},
        {"finished_at": "2026-08-02T08:00:00.002000Z"},
    ),
)
def test_timing_reconciliation_refuses_each_independent_mismatch(
    mutations: dict[str, object],
) -> None:
    value = {**_timings(), **mutations}
    _reason(lambda: subject._validate_timings(value, (_case(),)), "timings_invalid")


def _public_artifacts() -> list[dict[str, object]]:
    return [
        {
            "name": name,
            "relative_path": path,
            "sha256": HEX64,
            "size_bytes": 1,
        }
        for name, path, _sealed in subject._PKI_PUBLIC_INVENTORY
    ]


def _pki() -> dict[str, object]:
    return {
        "ephemeral": True,
        "destroyed": True,
        "certificate_count": 4,
        "public_artifact_count": 5,
        "public_artifacts": _public_artifacts(),
    }


@pytest.mark.parametrize(
    ("mutate", "reason"),
    (
        (
            lambda value: value.__setitem__("certificate_count", 3),
            "pki_public_invalid",
        ),
        (
            lambda value: value["public_artifacts"][0].__setitem__(  # type: ignore[index]
                "size_bytes", subject.MAX_ARTIFACT_BYTES + 1
            ),
            "pki_public_inventory_invalid",
        ),
        (
            lambda value: value["public_artifacts"][0].__setitem__(  # type: ignore[index]
                "relative_path", subject._PKI_PUBLIC_INVENTORY[0][2]
            ),
            "pki_public_inventory_invalid",
        ),
    ),
)
def test_pki_inventory_rejects_count_size_and_state_path_mismatch(
    mutate: Callable[[dict[str, object]], None],
    reason: str,
) -> None:
    value = _pki()
    mutate(value)
    _reason(lambda: subject._validate_pki_public(value, "raw"), reason)


@pytest.mark.parametrize(
    "value",
    (None, "", "bad\\path", "/absolute", "dot/../path", "terminal-result.json"),
)
def test_relative_artifact_path_rejects_unsafe_forms(value: object) -> None:
    _reason(lambda: subject._relative_artifact_path(value), "artifact_path_invalid")


def _artifact(**changes: object) -> dict[str, object]:
    return {
        "name": "case-n1",
        "kind": "case",
        "case_id": "N1",
        "relative_path": "case-n1.json",
        "sha256": HEX64,
        "size_bytes": 1,
        **changes,
    }


@pytest.mark.parametrize(
    ("value", "cases", "outcome", "state", "reason"),
    (
        ([], (), "failed", "raw", "artifacts_invalid"),
        ([_artifact(kind="unknown")], (), "failed", "raw", "artifacts_invalid"),
        ([_artifact(case_id="N99")], (), "failed", "raw", "artifacts_invalid"),
        ([_artifact(kind="failure")], (), "failed", "raw", "artifacts_invalid"),
        (
            [_artifact(size_bytes=subject.MAX_ARTIFACT_BYTES + 1)],
            (),
            "failed",
            "raw",
            "artifacts_invalid",
        ),
        (
            [_artifact()],
            (_case(artifact_name="missing"),),
            "failed",
            "raw",
            "case_artifact_invalid",
        ),
        ([_artifact()], (), "passed", "raw", "required_artifact_missing"),
        (
            [_artifact(relative_path="wrong.snapshot")],
            (),
            "failed",
            "sealed",
            "artifact_snapshot_inventory_invalid",
        ),
        (
            [_artifact(relative_path="sealed-untrusted")],
            (),
            "failed",
            "raw",
            "artifact_snapshot_inventory_invalid",
        ),
    ),
)
def test_artifact_inventory_fail_closed_branches(
    value: object,
    cases: object,
    outcome: str,
    state: str,
    reason: str,
) -> None:
    _reason(
        lambda: subject._validate_artifacts(value, cases, outcome, state),  # type: ignore[arg-type]
        reason,
    )


def _terminal_shell() -> dict[str, object]:
    return {
        key: None
        for key in (
            "schema_version",
            "artifact_state",
            "attempt_id",
            "outcome",
            "failure_reason_code",
            "repository_tuple",
            "authority",
            "b1",
            "counts",
            "cases",
            "transport",
            "postgresql",
            "timings",
            "teardown",
            "pki_public",
            "artifacts",
        )
    }


@pytest.mark.parametrize(
    ("updates", "reason"),
    (
        ({"schema_version": "wrong"}, "terminal_schema_invalid"),
        (
            {
                "schema_version": subject.TERMINAL_SCHEMA_VERSION,
                "artifact_state": "other",
            },
            "artifact_snapshot_inventory_invalid",
        ),
        (
            {
                "schema_version": subject.TERMINAL_SCHEMA_VERSION,
                "artifact_state": "raw",
                "attempt_id": "attempt",
                "outcome": "other",
            },
            "terminal_outcome_invalid",
        ),
        (
            {
                "schema_version": subject.TERMINAL_SCHEMA_VERSION,
                "artifact_state": "raw",
                "attempt_id": "attempt",
                "outcome": "passed",
                "failure_reason_code": "unexpected",
            },
            "passed_result_has_failure",
        ),
    ),
)
def test_terminal_schema_early_refusals(
    updates: dict[str, object], reason: str
) -> None:
    candidate = {**_terminal_shell(), **updates}
    _reason(lambda: subject.validate_terminal_result(candidate), reason)


def test_descriptor_capability_and_root_name_refusals(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delattr(subject.os, "O_DIRECTORY")
    _reason(subject._directory_flags, "descriptor_binding_unavailable")
    _reason(
        lambda: subject._open_absolute_directory(Path("relative"), "unsafe"),
        "unsafe",
    )
    unsafe = tmp_path / "ordinary-name"
    unsafe.mkdir()
    _reason(lambda: subject._open_evidence_root(unsafe), "evidence_root_unsafe")


def test_terminal_helpers_refuse_non_list_projections_and_non_raw_persist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _reason(
        lambda: subject._sealed_projection(
            {"pki_public": {"public_artifacts": ()}, "artifacts": []}
        ),
        "artifact_snapshot_inventory_invalid",
    )
    monkeypatch.setattr(
        subject, "validate_terminal_result", lambda _value: {"artifact_state": "sealed"}
    )
    _reason(
        lambda: subject.persist_terminal_evidence(Path("/unused"), {}),
        "artifact_snapshot_inventory_invalid",
    )


def test_write_all_refuses_no_progress(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(subject.os, "write", lambda _fd, _payload: 0)
    with pytest.raises(OSError, match="short write"):
        subject._write_all(1, b"payload")


def test_terminal_paths_collapse_stat_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_stat(*_args: object, **_kwargs: object) -> os.stat_result:
        raise OSError("synthetic")

    monkeypatch.setattr(subject.os, "stat", fail_stat)
    _reason(lambda: subject._terminal_paths_absent(1), "terminal_path_unsafe")
