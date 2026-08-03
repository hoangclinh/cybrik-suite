"""Contract tests for authenticated D2 coverage-producer evidence.

The verifier admits a coverage PASS only when the caller states, up front, both
the canonical coverage-authorization bytes and the measurement receipt those
bytes authorize.  Every digest is recomputed here from the exact bytes on disk;
no caller-supplied digest is trusted.

These tests are pure filesystem fixtures below ``tmp_path``.  They do not run
Coverage.py, import the UAT harness, open a listener, or reach the network.
"""

from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
from collections.abc import Mapping
from pathlib import Path

import pytest

FIXTURE_MODULE_PATH = Path(__file__).with_name("test_coverage_gate.py")


def _load_fixture_module() -> object:
    spec = importlib.util.spec_from_file_location(
        "d2_coverage_gate_test_fixtures", FIXTURE_MODULE_PATH
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


FIXTURES = _load_fixture_module()


def _fixture(tmp_path: Path) -> tuple[Path, Path, dict[str, object]]:
    return FIXTURES._fixture(tmp_path)


def _result_path(report_path: Path) -> Path:
    return report_path.with_name("coverage-gate.json")


def _run(
    suite_root: Path,
    report_path: Path,
    *,
    authorization: Mapping[str, object] | None = None,
    authorization_bytes: bytes | None = None,
    authorization_sha256: str | None = None,
    authorization_path: Path | None = None,
    receipt: Mapping[str, object] | None = None,
    with_authorization: bool = True,
    with_receipt: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run the verifier over one deliberately perturbed binding."""

    written_path: Path | None = None
    written_sha256: str | None = None
    if with_authorization:
        if authorization_bytes is not None:
            written_path = authorization_path or report_path.with_name(
                "coverage-authorization.json"
            )
            written_path.write_bytes(authorization_bytes)
            written_sha256 = FIXTURES.sha256_hex(authorization_bytes)
        else:
            written_path, written_sha256 = FIXTURES.write_coverage_authorization(
                report_path, authorization
            )
        if authorization_sha256 is not None:
            written_sha256 = authorization_sha256
    bound_sha256 = (
        written_sha256
        if written_sha256 is not None
        else FIXTURES.sha256_hex(
            FIXTURES.canonical_bytes(FIXTURES.coverage_authorization())
        )
    )
    receipt_path: Path | None = None
    receipt_sha256: str | None = None
    if with_receipt:
        receipt_path, receipt_sha256 = FIXTURES.write_measurement_receipt(
            report_path, bound_sha256, receipt
        )
    return FIXTURES.invoke_gate(
        FIXTURES.gate_command(
            suite_root,
            report_path,
            authorization_path=written_path,
            authorization_sha256=written_sha256,
            receipt_path=receipt_path,
            receipt_sha256=receipt_sha256,
        )
    )


def _assert_failed(
    completed: subprocess.CompletedProcess[str], report_path: Path, reason: str
) -> None:
    assert completed.returncode == 2
    assert completed.stderr.strip() == reason
    assert not _result_path(report_path).exists()


def _mutated_receipt(report_path: Path, authorization_sha256: str) -> dict[str, object]:
    return copy.deepcopy(
        FIXTURES.measurement_receipt(report_path, authorization_sha256)
    )


def _authorization_sha256() -> str:
    return FIXTURES.sha256_hex(
        FIXTURES.canonical_bytes(FIXTURES.coverage_authorization())
    )


def test_missing_measurement_receipt_fails_closed(tmp_path: Path) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)

    completed = _run(suite_root, report_path, with_receipt=False)

    _assert_failed(completed, report_path, "measurement_receipt_missing")


def test_missing_coverage_authorization_fails_closed(tmp_path: Path) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)

    completed = _run(suite_root, report_path, with_authorization=False)

    _assert_failed(completed, report_path, "coverage_authorization_missing")


def test_coverage_authorization_bytes_must_match_the_admitted_digest(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    payload = FIXTURES.canonical_bytes(FIXTURES.coverage_authorization())

    completed = _run(
        suite_root,
        report_path,
        authorization_bytes=payload + b"\n",
        authorization_sha256=FIXTURES.sha256_hex(payload),
    )

    _assert_failed(completed, report_path, "coverage_authorization_digest_mismatch")


def test_semantically_equal_noncanonical_coverage_authorization_is_refused(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)

    completed = _run(
        suite_root,
        report_path,
        authorization_bytes=json.dumps(
            FIXTURES.coverage_authorization(), indent=2
        ).encode("utf-8"),
    )

    _assert_failed(completed, report_path, "coverage_authorization_not_canonical")


def test_coverage_authorization_may_not_live_inside_the_suite(tmp_path: Path) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    inside = suite_root / "coverage-authorization.json"

    completed = _run(
        suite_root,
        report_path,
        authorization_bytes=FIXTURES.canonical_bytes(FIXTURES.coverage_authorization()),
        authorization_path=inside,
    )

    _assert_failed(
        completed, report_path, "coverage_authorization_must_be_outside_suite"
    )


def test_coverage_authorization_read_is_bounded(tmp_path: Path) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)

    completed = _run(
        suite_root,
        report_path,
        authorization_bytes=b"x" * (64 * 1024 + 1),
    )

    _assert_failed(completed, report_path, "coverage_authorization_too_large")


def test_coverage_authorization_path_may_not_be_a_symlink(tmp_path: Path) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    payload = FIXTURES.canonical_bytes(FIXTURES.coverage_authorization())
    target = tmp_path / "external-coverage-authorization.json"
    target.write_bytes(payload)
    link = report_path.with_name("coverage-authorization-link.json")
    link.symlink_to(target)
    authorization_sha256 = FIXTURES.sha256_hex(payload)
    receipt_path, receipt_sha256 = FIXTURES.write_measurement_receipt(
        report_path, authorization_sha256
    )

    completed = FIXTURES.invoke_gate(
        FIXTURES.gate_command(
            suite_root,
            report_path,
            authorization_path=link,
            authorization_sha256=authorization_sha256,
            receipt_path=receipt_path,
            receipt_sha256=receipt_sha256,
        )
    )

    _assert_failed(completed, report_path, "input_path_is_symlink")


def test_coverage_authorization_path_may_not_traverse_a_symlinked_parent(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    payload = FIXTURES.canonical_bytes(FIXTURES.coverage_authorization())
    real_parent = tmp_path / "external-real"
    real_parent.mkdir()
    target = real_parent / "coverage-authorization.json"
    target.write_bytes(payload)
    linked_parent = tmp_path / "external-link"
    linked_parent.symlink_to(real_parent, target_is_directory=True)
    authorization_sha256 = FIXTURES.sha256_hex(payload)
    receipt_path, receipt_sha256 = FIXTURES.write_measurement_receipt(
        report_path, authorization_sha256
    )

    completed = FIXTURES.invoke_gate(
        FIXTURES.gate_command(
            suite_root,
            report_path,
            authorization_path=linked_parent / target.name,
            authorization_sha256=authorization_sha256,
            receipt_path=receipt_path,
            receipt_sha256=receipt_sha256,
        )
    )

    _assert_failed(completed, report_path, "input_path_not_canonical")


@pytest.mark.parametrize(
    "field",
    (
        "authorization_id",
        "measurement_command_sha256",
        "measurement_wrapper_sha256",
        "pinned_python_sha256",
        "receipt_policy_id",
        "suite_commit",
        "suite_tree",
    ),
)
def test_coverage_authorization_requires_the_exact_v2_field_set(
    tmp_path: Path, field: str
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    record = FIXTURES.coverage_authorization()
    record.pop(field)

    completed = _run(suite_root, report_path, authorization=record)

    _assert_failed(completed, report_path, "coverage_authorization_schema_invalid")


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("receipt_policy_id", "cybrik-d2-coverage-receipt/v1"),
        ("pinned_python_sha256", "not-a-digest"),
        ("measurement_wrapper_sha256", "F" * 64),
        ("measurement_command_sha256", "3" * 63),
        ("suite_commit", "c" * 39),
        ("suite_tree", ""),
        ("authorization_id", "D2-Coverage-Auth"),
    ),
)
def test_coverage_authorization_pins_policy_digests_and_source_tuple(
    tmp_path: Path, field: str, value: str
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    record = FIXTURES.coverage_authorization()
    record[field] = value

    completed = _run(suite_root, report_path, authorization=record)

    _assert_failed(completed, report_path, "coverage_authorization_schema_invalid")


def test_measurement_receipt_bytes_must_match_the_admitted_digest(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    authorization_path, authorization_sha256 = FIXTURES.write_coverage_authorization(
        report_path
    )
    receipt_bytes = FIXTURES.canonical_bytes(
        FIXTURES.measurement_receipt(report_path, authorization_sha256)
    )
    receipt_path = report_path.with_name("measurement-receipt.json")
    receipt_path.write_bytes(receipt_bytes + b"\n")

    completed = FIXTURES.invoke_gate(
        FIXTURES.gate_command(
            suite_root,
            report_path,
            authorization_path=authorization_path,
            authorization_sha256=authorization_sha256,
            receipt_path=receipt_path,
            receipt_sha256=FIXTURES.sha256_hex(receipt_bytes),
        )
    )

    _assert_failed(completed, report_path, "measurement_receipt_digest_mismatch")


def test_measurement_receipt_must_bind_the_exact_coverage_json_bytes(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    artifacts = receipt["artifacts"]
    assert isinstance(artifacts, dict)
    artifacts["coverage_json_sha256"] = "0" * 64

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(
        completed, report_path, "measurement_receipt_coverage_digest_mismatch"
    )


def test_measurement_receipt_must_declare_schema_two(tmp_path: Path) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    receipt["schema_version"] = "1.0.0"

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_schema_invalid")


@pytest.mark.parametrize("value", ("", " ", "\t", " padded "))
def test_measurement_receipt_id_must_be_canonical_nonempty_text(
    tmp_path: Path, value: str
) -> None:
    """Every gate PASS must remain acceptable to runtime admission v2."""

    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    receipt["receipt_id"] = value

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_schema_invalid")


def test_legacy_v1_measurement_receipt_key_set_is_refused(tmp_path: Path) -> None:
    """The v1 shape carried a policy_id and per-run exit codes; v2 does not."""

    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    receipt["policy_id"] = "d2-coverage-producer-policy-v1"

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_schema_invalid")


@pytest.mark.parametrize(
    ("section", "field"),
    (
        ("artifacts", "coverage_data_sha256"),
        ("authorization", "sha256"),
        ("execution_boundary", "network_calls"),
        ("producer", "wrapper_sha256"),
        ("run", "nonce"),
        ("source", "suite_tree"),
    ),
)
def test_measurement_receipt_requires_every_v2_section_field(
    tmp_path: Path, section: str, field: str
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    nested = receipt[section]
    assert isinstance(nested, dict)
    nested.pop(field)

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_schema_invalid")


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("identity", "cybrik-d2-other-wrapper"),
        ("executable_sha256", "9" * 64),
        ("wrapper_sha256", "8" * 64),
    ),
)
def test_measurement_receipt_producer_must_repeat_the_authorized_identity(
    tmp_path: Path, field: str, value: str
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    producer = receipt["producer"]
    assert isinstance(producer, dict)
    producer[field] = value

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_producer_invalid")


def test_measurement_receipt_run_must_repeat_the_authorized_command_digest(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    run = receipt["run"]
    assert isinstance(run, dict)
    run["command_sha256"] = "7" * 64

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_run_invalid")


@pytest.mark.parametrize("value", ("", " ", "\t", " padded "))
def test_measurement_receipt_run_id_must_be_canonical_nonempty_text(
    tmp_path: Path, value: str
) -> None:
    """Keep the producer gate aligned with runtime admission's text contract."""

    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    run = receipt["run"]
    assert isinstance(run, dict)
    run["id"] = value

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_run_invalid")


@pytest.mark.parametrize("field", ("id", "sha256"))
def test_measurement_receipt_must_name_its_own_coverage_authorization(
    tmp_path: Path, field: str
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    claimed = receipt["authorization"]
    assert isinstance(claimed, dict)
    claimed[field] = "caller-selected" if field == "id" else "9" * 64

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_authorization_mismatch")


@pytest.mark.parametrize("field", ("suite_commit", "suite_tree"))
def test_measurement_receipt_source_tuple_must_repeat_the_authorization(
    tmp_path: Path, field: str
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    source = receipt["source"]
    assert isinstance(source, dict)
    source[field] = "8" * 40

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_source_invalid")


def test_measurement_receipt_may_not_declare_an_executed_runtime(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _mutated_receipt(report_path, _authorization_sha256())
    boundary = receipt["execution_boundary"]
    assert isinstance(boundary, dict)
    boundary["runtime_executed"] = True

    completed = _run(suite_root, report_path, receipt=receipt)

    _assert_failed(completed, report_path, "measurement_receipt_boundary_invalid")
