"""RED contract tests for authenticated D2 coverage-producer evidence."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

HARNESS_ROOT = Path(__file__).parents[1]
VERIFY = HARNESS_ROOT / "scripts" / "verify_coverage_gate.py"
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
    fixture = getattr(FIXTURES, "_fixture")
    return fixture(tmp_path)


def _run_without_receipt(
    suite_root: Path, report_path: Path
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        (
            sys.executable,
            str(VERIFY),
            "--suite-root",
            str(suite_root),
            "--coverage-json",
            str(report_path),
            "--result-json",
            str(report_path.with_name("coverage-gate.json")),
        ),
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
        shell=False,
    )


def _canonical_bytes(value: dict[str, object]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _receipt(report_path: Path) -> dict[str, object]:
    return {
        "schema_version": "1.0.0",
        "receipt_id": "d2-coverage-receipt-test-0001",
        "policy_id": "d2-coverage-producer-policy-v1",
        "producer": {
            "identity": "cybrik-d2-coverage-wrapper",
            "executable_sha256": "1" * 64,
        },
        "run": {
            "authorization_id": "d2-coverage-test-authorization",
            "id": "d2-coverage-test-run-0001",
            "nonce": "2" * 64,
            "command_sha256": "3" * 64,
            "pytest_exit_code": 0,
            "coverage_exit_codes": {"json": 0, "run": 0},
        },
        "source": {
            "suite_commit": "4" * 40,
            "suite_tree": "5" * 40,
        },
        "artifacts": {
            "coverage_data_sha256": "6" * 64,
            "coverage_json_sha256": _sha256(report_path.read_bytes()),
        },
        "execution_boundary": {
            "network_calls": [],
            "runtime_executed": False,
        },
    }


def _run_with_receipt(
    suite_root: Path,
    report_path: Path,
    receipt_path: Path,
    admitted_receipt_sha256: str,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        (
            sys.executable,
            str(VERIFY),
            "--suite-root",
            str(suite_root),
            "--coverage-json",
            str(report_path),
            "--measurement-receipt",
            str(receipt_path),
            "--measurement-receipt-sha256",
            admitted_receipt_sha256,
            "--result-json",
            str(report_path.with_name("coverage-gate.json")),
        ),
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
        shell=False,
    )


def test_structurally_valid_synthetic_report_without_measurement_receipt_fails_closed(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)

    completed = _run_without_receipt(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "measurement_receipt_missing"
    assert not report_path.with_name("coverage-gate.json").exists()


def test_measurement_receipt_bytes_must_match_the_admitted_digest(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt_path = report_path.with_name("measurement-receipt.json")
    receipt_bytes = _canonical_bytes(_receipt(report_path))
    receipt_path.write_bytes(receipt_bytes + b"\n")

    completed = _run_with_receipt(
        suite_root,
        report_path,
        receipt_path,
        _sha256(receipt_bytes),
    )

    assert completed.returncode == 2
    assert completed.stderr.strip() == "measurement_receipt_digest_mismatch"
    assert not report_path.with_name("coverage-gate.json").exists()


def test_measurement_receipt_must_bind_the_exact_coverage_json_bytes(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = _receipt(report_path)
    artifacts = receipt["artifacts"]
    assert isinstance(artifacts, dict)
    artifacts["coverage_json_sha256"] = "0" * 64
    receipt_bytes = _canonical_bytes(receipt)
    receipt_path = report_path.with_name("measurement-receipt.json")
    receipt_path.write_bytes(receipt_bytes)

    completed = _run_with_receipt(
        suite_root,
        report_path,
        receipt_path,
        _sha256(receipt_bytes),
    )

    assert completed.returncode == 2
    assert completed.stderr.strip() == "measurement_receipt_coverage_digest_mismatch"
    assert not report_path.with_name("coverage-gate.json").exists()


@pytest.mark.parametrize(
    ("section", "field", "reason"),
    (
        ("producer", "identity", "measurement_receipt_producer_invalid"),
        ("producer", "executable_sha256", "measurement_receipt_producer_invalid"),
        ("run", "id", "measurement_receipt_run_invalid"),
        ("run", "command_sha256", "measurement_receipt_run_invalid"),
    ),
)
def test_measurement_receipt_requires_exact_producer_and_run_identity(
    tmp_path: Path, section: str, field: str, reason: str
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    receipt = copy.deepcopy(_receipt(report_path))
    nested = receipt[section]
    assert isinstance(nested, dict)
    nested.pop(field)
    receipt_bytes = _canonical_bytes(receipt)
    receipt_path = report_path.with_name("measurement-receipt.json")
    receipt_path.write_bytes(receipt_bytes)

    completed = _run_with_receipt(
        suite_root,
        report_path,
        receipt_path,
        _sha256(receipt_bytes),
    )

    assert completed.returncode == 2
    assert completed.stderr.strip() == reason
    assert not report_path.with_name("coverage-gate.json").exists()
