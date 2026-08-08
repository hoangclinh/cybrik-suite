"""Hermetic M3 coverage cases for runtime-authorization refusal paths.

The tests exercise only pure parsers and admission-artifact validators with
synthetic in-memory values. They do not inspect the environment, filesystem,
Git, product runtimes, Docker, databases, listeners, signals, or the network.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Mapping

import pytest
from cybrik_suite_uat_mtls import runtime_authorization as authorization

_SUITE_COMMIT = "c" * 40
_SUITE_TREE = "d" * 40
_COMMAND_SHA = "1" * 64
_WRAPPER_SHA = "2" * 64
_PYTHON_SHA = "3" * 64


def _canonical(record: Mapping[str, object]) -> bytes:
    return json.dumps(record, sort_keys=True, separators=(",", ":")).encode()


def _coverage_authorization() -> dict[str, object]:
    return {
        "authorization_id": "d2-coverage-m3",
        "measurement_command_sha256": _COMMAND_SHA,
        "measurement_wrapper_sha256": _WRAPPER_SHA,
        "pinned_python_sha256": _PYTHON_SHA,
        "receipt_policy_id": authorization.COVERAGE_RECEIPT_POLICY_ID,
        "suite_commit": _SUITE_COMMIT,
        "suite_tree": _SUITE_TREE,
    }


def _measurement_receipt(
    coverage_authorization: Mapping[str, object],
) -> dict[str, object]:
    authorization_bytes = _canonical(coverage_authorization)
    return {
        "artifacts": {
            "coverage_data_sha256": "4" * 64,
            "coverage_json_sha256": "5" * 64,
        },
        "authorization": {
            "id": coverage_authorization["authorization_id"],
            "sha256": hashlib.sha256(authorization_bytes).hexdigest(),
        },
        "execution_boundary": {"network_calls": [], "runtime_executed": False},
        "producer": {
            "executable_sha256": _PYTHON_SHA,
            "identity": authorization.COVERAGE_PRODUCER_IDENTITY,
            "wrapper_sha256": _WRAPPER_SHA,
        },
        "receipt_id": "coverage-receipt-m3",
        "run": {
            "command_sha256": _COMMAND_SHA,
            "id": "coverage-run-m3",
            "nonce": "6" * 64,
        },
        "schema_version": authorization.COVERAGE_MEASUREMENT_RECEIPT_SCHEMA,
        "source": {"suite_commit": _SUITE_COMMIT, "suite_tree": _SUITE_TREE},
    }


def _assert_admission_refused(call: Callable[[], object]) -> None:
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        call()
    assert caught.value.reason == authorization.ADMISSION_BINDING_MISMATCH


@pytest.mark.parametrize(
    "malformed",
    (
        object(),
        "\n".join(f"{key}=value" for key in authorization.EXACT_HEAD_GRANT_FIELDS),
        "".join(
            f"{'WRONG' if index == 0 else key}=value\n"
            for index, key in enumerate(authorization.EXACT_HEAD_GRANT_FIELDS)
        ),
        "".join(
            f"{key}={' value' if index == 0 else 'value'}\n"
            for index, key in enumerate(authorization.EXACT_HEAD_GRANT_FIELDS)
        ),
    ),
)
def test_exact_head_grant_parser_refuses_malformed_exact_shape(
    malformed: object,
) -> None:
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.parse_exact_head_grant(malformed)  # type: ignore[arg-type]
    assert caught.value.reason == "exact_head_grant_invalid"


@pytest.mark.parametrize(
    "call",
    (
        lambda: authorization._admitted_digest("caller-selected-digest"),
        lambda: authorization._admitted_canonical_object(b"\xff"),
        lambda: authorization._admitted_canonical_object(b"{"),
        lambda: authorization._admitted_text(" padded"),
        lambda: authorization._admitted_text("not-a-digest", authorization._HEX64),
        lambda: authorization._admitted_count(True),
        lambda: authorization._admitted_count(-1),
    ),
)
def test_admission_scalar_helpers_refuse_ambiguous_or_malformed_values(
    call: Callable[[], object],
) -> None:
    _assert_admission_refused(call)


@pytest.mark.parametrize("mismatch", ("policy", "source"))
def test_coverage_authorization_refuses_re_pinned_contradictory_claims(
    mismatch: str,
) -> None:
    record = _coverage_authorization()
    if mismatch == "policy":
        record["receipt_policy_id"] = "caller-selected-policy"
    else:
        record["suite_tree"] = "9" * 40

    _assert_admission_refused(
        lambda: authorization._admitted_coverage_authorization(
            _canonical(record),
            suite_commit=_SUITE_COMMIT,
            suite_tree=_SUITE_TREE,
        )
    )


@pytest.mark.parametrize(
    "mismatch",
    ("schema", "authorization", "runtime", "network", "producer", "command"),
)
def test_measurement_receipt_refuses_each_security_boundary_mismatch(
    mismatch: str,
) -> None:
    coverage = _coverage_authorization()
    receipt = _measurement_receipt(coverage)
    if mismatch == "schema":
        receipt["schema_version"] = "0.0.0"
    elif mismatch == "authorization":
        claimed = receipt["authorization"]
        assert isinstance(claimed, dict)
        claimed["id"] = "different-authorization"
    elif mismatch == "runtime":
        boundary = receipt["execution_boundary"]
        assert isinstance(boundary, dict)
        boundary["runtime_executed"] = True
    elif mismatch == "network":
        boundary = receipt["execution_boundary"]
        assert isinstance(boundary, dict)
        boundary["network_calls"] = ["synthetic-forbidden-call"]
    elif mismatch == "producer":
        producer = receipt["producer"]
        assert isinstance(producer, dict)
        producer["wrapper_sha256"] = "7" * 64
    else:
        run = receipt["run"]
        assert isinstance(run, dict)
        run["command_sha256"] = "8" * 64

    coverage_bytes = _canonical(coverage)
    _assert_admission_refused(
        lambda: authorization._admitted_measurement_receipt(
            _canonical(receipt),
            coverage_authorization=coverage,
            coverage_authorization_sha256=hashlib.sha256(coverage_bytes).hexdigest(),
            suite_commit=_SUITE_COMMIT,
            suite_tree=_SUITE_TREE,
        )
    )


@pytest.mark.parametrize(
    "ratio",
    (
        {"covered": 2, "ratio": 1.0, "total": 1},
        {"covered": 0, "ratio": True, "total": 1},
        {"covered": 0, "ratio": "0", "total": 1},
        {"covered": 0, "ratio": 1.1, "total": 1},
    ),
)
def test_coverage_ratio_refuses_impossible_or_ambiguous_measurements(
    ratio: dict[str, object],
) -> None:
    _assert_admission_refused(lambda: authorization._admitted_ratio(ratio))


@pytest.mark.parametrize("value", ("relative", "/", "/state/../state/runtime"))
def test_admitted_directory_path_refuses_unbounded_paths(value: str) -> None:
    _assert_admission_refused(lambda: authorization._admitted_directory_path(value))


@pytest.mark.parametrize(
    "inventory",
    (
        (),
        ["duplicate", "duplicate"],
        ["../escape"],
        ["/absolute"],
    ),
)
def test_admitted_inventory_refuses_noncanonical_or_escaping_entries(
    inventory: object,
) -> None:
    _assert_admission_refused(lambda: authorization._admitted_inventory(inventory))
