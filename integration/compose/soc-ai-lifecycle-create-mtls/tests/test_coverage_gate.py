"""Fail-closed tests for the D2 Coverage.py JSON verifier."""

from __future__ import annotations

import ast
import hashlib
import importlib.util
import json
import os
import shutil
import stat
import subprocess
import sys
from collections.abc import Mapping
from pathlib import Path

import pytest

VERIFY = Path(__file__).parents[1] / "scripts" / "verify_coverage_gate.py"
PACKAGE_REL = Path(
    "integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls"
)
CRITICAL = {
    "server.py": ("build_patched_ssl_context",),
    "policy.py": ("parse_loopback_bind", "validate_proposed_bind"),
    "evidence.py": ("secret_reason", "validate_evidence"),
    "harness.py": ("_assert_ssl_context_evidence", "teardown", "verify_absent"),
}
ARC_FREE_CRITICAL = {"validate_evidence", "verify_absent"}
CRITICAL_SYMBOLS = tuple(
    (filename, name) for filename, names in CRITICAL.items() for name in names
)

# The exact v2 coverage-authorization tuple the runtime admission layer admits.
SUITE_COMMIT = "c" * 40
SUITE_TREE = "d" * 40
COVERAGE_AUTHORIZATION_ID = "d2-coverage-gate-authorization"
PINNED_PYTHON_SHA256 = "1" * 64
MEASUREMENT_WRAPPER_SHA256 = "f" * 64
MEASUREMENT_COMMAND_SHA256 = "3" * 64
PRODUCER_IDENTITY = "cybrik-d2-coverage-wrapper"
RECEIPT_POLICY_ID = "cybrik-d2-coverage-receipt/v2"
RECEIPT_SCHEMA_VERSION = "2.0.0"


def _source(function_names: tuple[str, ...]) -> str:
    return "\n\n".join(
        (
            f"def {name}(value):\n    return value\n"
            if name in ARC_FREE_CRITICAL
            else f"def {name}(value):\n    if value:\n        return 1\n    return 0\n"
        )
        for name in function_names
    )


def _summary(
    executed_lines: list[int],
    missing_lines: list[int],
    executed_branches: list[list[int]],
    missing_branches: list[list[int]],
    excluded_lines: list[int] | None = None,
    partial_branches: int | None = None,
) -> dict[str, int | float | str]:
    excluded_lines = excluded_lines or []
    statement_total = len(executed_lines) + len(missing_lines)
    branch_total = len(executed_branches) + len(missing_branches)
    statement_percent = (
        100.0 * len(executed_lines) / statement_total if statement_total else 100.0
    )
    branch_percent = (
        100.0 * len(executed_branches) / branch_total if branch_total else 100.0
    )
    combined_total = statement_total + branch_total
    combined_covered = len(executed_lines) + len(executed_branches)
    combined_percent = (
        100.0 * combined_covered / combined_total if combined_total else 100.0
    )
    return {
        "covered_lines": len(executed_lines),
        "num_statements": statement_total,
        "percent_covered": combined_percent,
        "percent_covered_display": f"{combined_percent:.0f}",
        "missing_lines": len(missing_lines),
        "excluded_lines": len(excluded_lines),
        "percent_statements_covered": statement_percent,
        "percent_statements_covered_display": f"{statement_percent:.0f}",
        "num_branches": branch_total,
        "num_partial_branches": (
            partial_branches
            if partial_branches is not None
            else len(
                {arc[0] for arc in executed_branches}
                & {arc[0] for arc in missing_branches}
            )
        ),
        "covered_branches": len(executed_branches),
        "missing_branches": len(missing_branches),
        "percent_branches_covered": branch_percent,
        "percent_branches_covered_display": f"{branch_percent:.0f}",
    }


def _file_report(source: str) -> dict[str, object]:
    tree = ast.parse(source)
    functions: dict[str, object] = {}
    executed_lines: set[int] = set()
    executed_branches: list[list[int]] = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        assert node.end_lineno is not None
        file_lines = list(range(node.lineno, node.end_lineno + 1))
        lines = list(range(node.body[0].lineno, node.body[-1].end_lineno + 1))
        branch_node = next(
            (child for child in ast.walk(node) if isinstance(child, ast.If)), None
        )
        branches = (
            [
                [branch_node.lineno, branch_node.lineno + 1],
                [branch_node.lineno, node.end_lineno],
            ]
            if branch_node is not None
            else []
        )
        executed_lines.update(file_lines)
        executed_branches.extend(branches)
        functions[node.name] = {
            "executed_lines": lines,
            "summary": _summary(lines, [], branches, []),
            "missing_lines": [],
            "excluded_lines": [],
            "start_line": node.lineno,
            "executed_branches": branches,
            "missing_branches": [],
        }
    lines = sorted(executed_lines)
    return {
        "executed_lines": lines,
        "summary": _summary(lines, [], executed_branches, []),
        "missing_lines": [],
        "excluded_lines": [],
        "executed_branches": executed_branches,
        "missing_branches": [],
        "functions": functions,
        "classes": {"": {}},
    }


def _empty_file_report() -> dict[str, object]:
    return {
        "executed_lines": [],
        "summary": _summary([], [], [], []),
        "missing_lines": [],
        "excluded_lines": [],
        "executed_branches": [],
        "missing_branches": [],
        "functions": {"": {}},
        "classes": {"": {}},
    }


def _plain_file_report(line_count: int) -> dict[str, object]:
    lines = list(range(1, line_count + 1))
    return {
        "executed_lines": lines,
        "summary": _summary(lines, [], [], []),
        "missing_lines": [],
        "excluded_lines": [],
        "executed_branches": [],
        "missing_branches": [],
        "functions": {"": {}},
        "classes": {"": {}},
    }


def _sync_report(report: dict[str, object]) -> None:
    files = report["files"]
    assert isinstance(files, dict)
    all_lines: list[int] = []
    all_missing_lines: list[int] = []
    all_excluded_lines: list[int] = []
    all_branches: list[list[int]] = []
    all_missing_branches: list[list[int]] = []
    all_partial_branches = 0
    for file_report in files.values():
        assert isinstance(file_report, dict)
        executed_lines = file_report["executed_lines"]
        missing_lines = file_report["missing_lines"]
        executed_branches = file_report["executed_branches"]
        missing_branches = file_report["missing_branches"]
        excluded_lines = file_report["excluded_lines"]
        assert isinstance(executed_lines, list)
        assert isinstance(missing_lines, list)
        assert isinstance(executed_branches, list)
        assert isinstance(missing_branches, list)
        assert isinstance(excluded_lines, list)
        file_summary = _summary(
            executed_lines,
            missing_lines,
            executed_branches,
            missing_branches,
            excluded_lines,
        )
        file_report["summary"] = file_summary
        all_partial_branches += int(file_summary["num_partial_branches"])
        all_lines.extend(executed_lines)
        all_missing_lines.extend(missing_lines)
        all_excluded_lines.extend(excluded_lines)
        all_branches.extend(executed_branches)
        all_missing_branches.extend(missing_branches)
        functions = file_report["functions"]
        assert isinstance(functions, dict)
        for function_report in functions.values():
            if not isinstance(function_report, dict) or not function_report:
                continue
            function_report["summary"] = _summary(
                function_report["executed_lines"],
                function_report["missing_lines"],
                function_report["executed_branches"],
                function_report["missing_branches"],
                function_report["excluded_lines"],
            )
    report["totals"] = _summary(
        all_lines,
        all_missing_lines,
        all_branches,
        all_missing_branches,
        all_excluded_lines,
        all_partial_branches,
    )


def _fixture(tmp_path: Path) -> tuple[Path, Path, dict[str, object]]:
    suite_root = tmp_path / "suite"
    evidence_root = tmp_path / "cybrik-uat-d2-coverage-evidence-test"
    evidence_root.mkdir(mode=0o700)
    evidence_root.chmod(0o700)
    package_root = suite_root / PACKAGE_REL
    package_root.mkdir(parents=True)
    files: dict[str, object] = {}
    init_path = package_root / "__init__.py"
    init_path.write_text("", encoding="utf-8")
    init_key = (PACKAGE_REL / "__init__.py").as_posix()
    files[init_key] = _empty_file_report()
    support_source = "\n".join(f"support_{index} = {index}" for index in range(1, 41))
    (package_root / "support.py").write_text(support_source, encoding="utf-8")
    files[(PACKAGE_REL / "support.py").as_posix()] = _plain_file_report(40)
    for filename, names in CRITICAL.items():
        source = _source(names)
        (package_root / filename).write_text(source, encoding="utf-8")
        files[(PACKAGE_REL / filename).as_posix()] = _file_report(source)
    report: dict[str, object] = {
        "meta": {
            "format": 3,
            "version": "7.15.2",
            "timestamp": "2026-08-02T00:00:00+00:00",
            "branch_coverage": True,
            "show_contexts": False,
        },
        "files": files,
        "totals": {},
    }
    _sync_report(report)
    report_path = evidence_root / "coverage.json"
    report_path.write_text(json.dumps(report), encoding="utf-8")
    return suite_root, report_path, report


def canonical_bytes(value: Mapping[str, object]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_hex(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def coverage_authorization() -> dict[str, object]:
    """The canonical coverage authorization the signed grant would pin."""

    return {
        "authorization_id": COVERAGE_AUTHORIZATION_ID,
        "measurement_command_sha256": MEASUREMENT_COMMAND_SHA256,
        "measurement_wrapper_sha256": MEASUREMENT_WRAPPER_SHA256,
        "pinned_python_sha256": PINNED_PYTHON_SHA256,
        "receipt_policy_id": RECEIPT_POLICY_ID,
        "suite_commit": SUITE_COMMIT,
        "suite_tree": SUITE_TREE,
    }


def measurement_receipt(
    report_path: Path, authorization_sha256: str
) -> dict[str, object]:
    """The exact schema 2.0.0 receipt key set the admission layer accepts."""

    return {
        "artifacts": {
            "coverage_data_sha256": "6" * 64,
            "coverage_json_sha256": sha256_hex(report_path.read_bytes()),
        },
        "authorization": {
            "id": COVERAGE_AUTHORIZATION_ID,
            "sha256": authorization_sha256,
        },
        "execution_boundary": {"network_calls": [], "runtime_executed": False},
        "producer": {
            "executable_sha256": PINNED_PYTHON_SHA256,
            "identity": PRODUCER_IDENTITY,
            "wrapper_sha256": MEASUREMENT_WRAPPER_SHA256,
        },
        "receipt_id": "d2-coverage-receipt-test-0001",
        "run": {
            "command_sha256": MEASUREMENT_COMMAND_SHA256,
            "id": "d2-coverage-test-run-0001",
            "nonce": "2" * 64,
        },
        "schema_version": RECEIPT_SCHEMA_VERSION,
        "source": {"suite_commit": SUITE_COMMIT, "suite_tree": SUITE_TREE},
    }


def write_artifact(path: Path, record: Mapping[str, object]) -> str:
    payload = canonical_bytes(record)
    path.write_bytes(payload)
    return sha256_hex(payload)


def write_coverage_authorization(
    report_path: Path, record: Mapping[str, object] | None = None
) -> tuple[Path, str]:
    path = report_path.with_name("coverage-authorization.json")
    return path, write_artifact(
        path, coverage_authorization() if record is None else record
    )


def write_measurement_receipt(
    report_path: Path,
    authorization_sha256: str,
    record: Mapping[str, object] | None = None,
) -> tuple[Path, str]:
    path = report_path.with_name("measurement-receipt.json")
    return path, write_artifact(
        path,
        measurement_receipt(report_path, authorization_sha256)
        if record is None
        else record,
    )


def gate_command(
    suite_root: Path,
    report_path: Path,
    *,
    authorization_path: Path | None,
    authorization_sha256: str | None,
    receipt_path: Path | None,
    receipt_sha256: str | None,
) -> tuple[str, ...]:
    """Build the verifier argv, omitting any binding the caller withholds."""

    argv = [
        sys.executable,
        str(VERIFY),
        "--suite-root",
        str(suite_root),
        "--coverage-json",
        str(report_path),
    ]
    if authorization_path is not None and authorization_sha256 is not None:
        argv += [
            "--coverage-authorization",
            str(authorization_path),
            "--coverage-authorization-sha256",
            authorization_sha256,
        ]
    if receipt_path is not None and receipt_sha256 is not None:
        argv += [
            "--measurement-receipt",
            str(receipt_path),
            "--measurement-receipt-sha256",
            receipt_sha256,
        ]
    argv += ["--result-json", str(report_path.with_name("coverage-gate.json"))]
    return tuple(argv)


def invoke_gate(argv: tuple[str, ...]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
        shell=False,
    )


def _run(suite_root: Path, report_path: Path) -> subprocess.CompletedProcess[str]:
    authorization_path, authorization_sha256 = write_coverage_authorization(report_path)
    receipt_path, receipt_sha256 = write_measurement_receipt(
        report_path, authorization_sha256
    )
    return invoke_gate(
        gate_command(
            suite_root,
            report_path,
            authorization_path=authorization_path,
            authorization_sha256=authorization_sha256,
            receipt_path=receipt_path,
            receipt_sha256=receipt_sha256,
        )
    )


def _rewrite(report_path: Path, report: dict[str, object]) -> None:
    _sync_report(report)
    report_path.write_text(json.dumps(report), encoding="utf-8")


def test_exact_format_three_report_passes_with_admission_compatible_result_keys(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 0, completed.stderr
    result = json.loads(completed.stdout)
    result_path = report_path.with_name("coverage-gate.json")
    assert json.loads(result_path.read_text(encoding="utf-8")) == result
    assert stat.S_IMODE(result_path.stat().st_mode) == 0o600
    assert set(result) == {"binding", "branch", "line", "status"}
    assert result["status"] == "PASS"
    assert result["line"] == {"covered": 68, "ratio": 1.0, "total": 68}
    assert result["branch"] == {"covered": 12, "ratio": 1.0, "total": 12}
    authorization_sha256 = sha256_hex(canonical_bytes(coverage_authorization()))
    receipt_sha256 = sha256_hex(
        canonical_bytes(measurement_receipt(report_path, authorization_sha256))
    )
    assert result["binding"] == {
        "coverage_authorization_sha256": authorization_sha256,
        "measurement_receipt_sha256": receipt_sha256,
        "suite_commit": SUITE_COMMIT,
        "suite_tree": SUITE_TREE,
    }


def test_published_result_bytes_are_canonical_and_free_of_local_paths(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 0, completed.stderr
    published = report_path.with_name("coverage-gate.json").read_bytes()
    assert published == canonical_bytes(json.loads(published.decode("utf-8")))
    assert str(tmp_path).encode("utf-8") not in published


@pytest.mark.parametrize(("filename", "symbol"), CRITICAL_SYMBOLS)
def test_every_critical_symbol_region_is_still_required(
    tmp_path: Path, filename: str, symbol: str
) -> None:
    """The result no longer enumerates the symbols, so each must still be enforced."""

    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / filename).as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    functions = file_report["functions"]
    assert isinstance(functions, dict)
    functions.pop(symbol)
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "critical_region_missing"


def _install_nested_critical_region(
    suite_root: Path, report: dict[str, object]
) -> tuple[dict[str, object], int]:
    key = (PACKAGE_REL / "harness.py").as_posix()
    source = (
        "def _assert_ssl_context_evidence(value):\n"
        "    if value:\n"
        "        return 1\n"
        "    return 0\n\n"
        "def teardown(value):\n"
        "    def load_receipt():\n"
        "        return value\n"
        "    if value:\n"
        "        return load_receipt()\n"
        "    return 0\n\n"
        "def verify_absent(value):\n"
        "    return value\n"
    )
    source_path = suite_root / PACKAGE_REL / "harness.py"
    source_path.write_text(source, encoding="utf-8")
    file_report = _file_report(source)
    functions = file_report["functions"]
    assert isinstance(functions, dict)
    teardown = functions["teardown"]
    assert isinstance(teardown, dict)
    tree = ast.parse(source)
    teardown_node = next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "teardown"
    )
    nested = next(
        node
        for node in teardown_node.body
        if isinstance(node, ast.FunctionDef) and node.name == "load_receipt"
    )
    assert nested.end_lineno is not None
    nested_body_lines = list(range(nested.body[0].lineno, nested.end_lineno + 1))
    teardown["executed_lines"] = [
        line for line in teardown["executed_lines"] if line not in nested_body_lines
    ]
    functions["teardown.load_receipt"] = {
        "executed_lines": nested_body_lines,
        "summary": _summary(nested_body_lines, [], [], []),
        "missing_lines": [],
        "excluded_lines": [],
        "start_line": nested.lineno,
        "executed_branches": [],
        "missing_branches": [],
    }
    report["files"][key] = file_report
    _sync_report(report)
    return file_report, nested_body_lines[0]


def test_nested_helper_in_critical_symbol_is_aggregated_fail_closed(
    tmp_path: Path,
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    _install_nested_critical_region(suite_root, report)
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 0, completed.stderr


def test_missing_nested_helper_line_fails_critical_coverage(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    file_report, nested_line = _install_nested_critical_region(suite_root, report)
    functions = file_report["functions"]
    assert isinstance(functions, dict)
    nested = functions["teardown.load_receipt"]
    assert isinstance(nested, dict)
    nested["executed_lines"].remove(nested_line)
    nested["missing_lines"].append(nested_line)
    file_report["executed_lines"].remove(nested_line)
    file_report["missing_lines"].append(nested_line)
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "critical_line_coverage_incomplete"


@pytest.mark.parametrize(
    ("meta_key", "value", "reason"),
    (
        ("format", 2, "coverage_json_format_not_three"),
        ("format", 3.0, "coverage_json_format_not_three"),
        ("version", "7.15.1", "coverage_version_mismatch"),
        ("branch_coverage", False, "branch_coverage_not_enabled"),
    ),
)
def test_report_metadata_must_match_the_pinned_branch_capable_format(
    tmp_path: Path, meta_key: str, value: object, reason: str
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    meta = report["meta"]
    assert isinstance(meta, dict)
    meta[meta_key] = value
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == reason
    assert str(tmp_path) not in completed.stderr
    failure = json.loads(
        report_path.with_name("coverage-gate.json").read_text(encoding="utf-8")
    )
    assert failure == {"reason": reason, "status": "FAIL"}


def test_every_package_source_file_must_be_present_exactly_once(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    files = report["files"]
    assert isinstance(files, dict)
    files.pop((PACKAGE_REL / "server.py").as_posix())
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "package_file_set_mismatch"


def test_reported_source_may_not_escape_the_suite_root(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    files = report["files"]
    assert isinstance(files, dict)
    files["../outside.py"] = _empty_file_report()
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "reported_file_outside_package"


def test_reported_source_key_must_be_canonical(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    files = report["files"]
    assert isinstance(files, dict)
    canonical = (PACKAGE_REL / "server.py").as_posix()
    files[(PACKAGE_REL / "unused" / ".." / "server.py").as_posix()] = files.pop(
        canonical
    )
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "reported_file_not_canonical"


def test_package_line_ratio_below_eighty_percent_fails(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "support.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    moved = file_report["executed_lines"][-20:]
    file_report["executed_lines"] = file_report["executed_lines"][:-20]
    file_report["missing_lines"] = moved
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "package_line_coverage_below_80"


def test_package_branch_ratio_below_eighty_percent_fails(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "harness.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    moved = file_report["executed_branches"][-4:]
    file_report["executed_branches"] = file_report["executed_branches"][:-4]
    file_report["missing_branches"] = moved
    functions = file_report["functions"]
    assert isinstance(functions, dict)
    for region in functions.values():
        if not isinstance(region, dict) or not region:
            continue
        region_moved = [arc for arc in region["executed_branches"] if arc in moved]
        region["executed_branches"] = [
            arc for arc in region["executed_branches"] if arc not in moved
        ]
        region["missing_branches"] = region_moved
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "package_branch_coverage_below_80"


def test_package_source_may_not_use_any_excluded_line(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "support.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    line = file_report["executed_lines"].pop()
    file_report["excluded_lines"].append(line)
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "package_source_excluded"


def test_typing_only_default_exclusions_do_not_weaken_the_runtime_gate(
    tmp_path: Path,
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    source = (
        "from typing import TYPE_CHECKING, Protocol\n\n"
        "if TYPE_CHECKING:\n"
        "    from imaginary_module import ImaginaryType\n\n"
        "class Adapter(Protocol):\n"
        "    def invoke(self, value: object) -> object: ...\n\n"
        "runtime_value = 1\n"
    )
    source_path = suite_root / PACKAGE_REL / "support.py"
    source_path.write_text(source, encoding="utf-8")
    key = (PACKAGE_REL / "support.py").as_posix()
    executed = [1, 6, 9]
    # Coverage.py extends Protocol-method exclusions through the following
    # blank separator; the verifier may admit that blank line but no code.
    excluded = [3, 4, 7, 8]
    report["files"][key] = {
        "executed_lines": executed,
        "summary": _summary(executed, [], [], [], excluded),
        "missing_lines": [],
        "excluded_lines": excluded,
        "executed_branches": [],
        "missing_branches": [],
        "functions": {"": {}},
        "classes": {"": {}},
    }
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 0, completed.stderr


def test_canonical_qualified_guard_admits_declarative_type_constructs(
    tmp_path: Path,
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    source = (
        "import typing\n\n"
        "if typing.TYPE_CHECKING:\n"
        "    from imaginary_module import ImaginaryType\n"
        "    type Alias = tuple[ImaginaryType, ...]\n"
        "    declaration: Alias\n\n"
        "runtime_value = 1\n"
    )
    source_path = suite_root / PACKAGE_REL / "support.py"
    source_path.write_text(source, encoding="utf-8")
    key = (PACKAGE_REL / "support.py").as_posix()
    executed = [1, 8]
    excluded = [3, 4, 5, 6]
    report["files"][key] = {
        "executed_lines": executed,
        "summary": _summary(executed, [], [], [], excluded),
        "missing_lines": [],
        "excluded_lines": excluded,
        "executed_branches": [],
        "missing_branches": [],
        "functions": {"": {}},
        "classes": {"": {}},
    }
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 0, completed.stderr


@pytest.mark.parametrize(
    "source",
    (
        (
            "from typing import TYPE_CHECKING\n\n"
            "if TYPE_CHECKING:\n"
            "    dangerous_call()\n\n"
            "runtime_value = 1\n"
        ),
        (
            "from typing import TYPE_CHECKING\n"
            "TYPE_CHECKING = True\n"
            "if TYPE_CHECKING:\n"
            "    from imaginary_module import ImaginaryType\n\n"
            "runtime_value = 1\n"
        ),
        (
            "TYPE_CHECKING = False\n"
            "if TYPE_CHECKING:\n"
            "    from imaginary_module import ImaginaryType\n\n"
            "runtime_value = 1\n"
        ),
        (
            "class FakeTyping:\n"
            "    TYPE_CHECKING = False\n\n"
            "typing = FakeTyping()\n"
            "if typing.TYPE_CHECKING:\n"
            "    from imaginary_module import ImaginaryType\n\n"
            "runtime_value = 1\n"
        ),
    ),
    ids=(
        "executable-body",
        "direct-name-shadowed",
        "direct-name-not-imported",
        "typing-module-shadowed",
    ),
)
def test_type_checking_exclusion_is_fail_closed(tmp_path: Path, source: str) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    source_path = suite_root / PACKAGE_REL / "support.py"
    source_path.write_text(source, encoding="utf-8")
    key = (PACKAGE_REL / "support.py").as_posix()
    tree = ast.parse(source)
    guard = next(node for node in ast.walk(tree) if isinstance(node, ast.If))
    assert guard.end_lineno is not None
    excluded = list(range(guard.lineno, guard.end_lineno + 1))
    executed = [
        line
        for line in range(1, len(source.splitlines()) + 1)
        if source.splitlines()[line - 1].strip() and line not in excluded
    ]
    report["files"][key] = {
        "executed_lines": executed,
        "summary": _summary(executed, [], [], [], excluded),
        "missing_lines": [],
        "excluded_lines": excluded,
        "executed_branches": [],
        "missing_branches": [],
        "functions": {"": {}},
        "classes": {"": {}},
    }
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "package_source_excluded"


def test_pinned_coverage_reporter_cannot_hide_executable_type_checking_body(
    tmp_path: Path,
) -> None:
    python = shutil.which("python3.12")
    site_packages = (
        Path.home() / ".local/share/cybrik-uat/cybrik-uat-d2-coverage-r1/site-packages"
    )
    if python is None or not (site_packages / "coverage-7.15.2.dist-info").is_dir():
        pytest.skip("the authorized local Coverage.py 7.15.2 runtime is unavailable")

    suite_root, report_path, report = _fixture(tmp_path)
    source = (
        "from typing import TYPE_CHECKING\n\n"
        "if TYPE_CHECKING:\n"
        "    dangerous_call()\n\n"
        "runtime_value = 1\n"
    )
    source_path = suite_root / PACKAGE_REL / "support.py"
    source_path.write_text(source, encoding="utf-8")
    data_path = tmp_path / ".coverage"
    actual_report_path = tmp_path / "actual-coverage.json"
    environment = {**os.environ, "PYTHONPATH": str(site_packages)}
    run_result = subprocess.run(
        (
            python,
            "-m",
            "coverage",
            "run",
            "--rcfile=/dev/null",
            "--branch",
            f"--data-file={data_path}",
            str(source_path),
        ),
        cwd=suite_root,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert run_result.returncode == 0, run_result.stderr
    json_result = subprocess.run(
        (
            python,
            "-m",
            "coverage",
            "json",
            "--rcfile=/dev/null",
            f"--data-file={data_path}",
            "--pretty-print",
            "-o",
            str(actual_report_path),
        ),
        cwd=suite_root,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert json_result.returncode == 0, json_result.stderr
    actual_report = json.loads(actual_report_path.read_text(encoding="utf-8"))
    assert actual_report["meta"]["version"] == "7.15.2"
    actual_files = actual_report["files"]
    assert isinstance(actual_files, dict) and len(actual_files) == 1
    actual_file = next(iter(actual_files.values()))
    assert actual_file["excluded_lines"] == [3, 4]
    key = (PACKAGE_REL / "support.py").as_posix()
    report["files"][key] = actual_file
    _sync_report(report)
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "package_source_excluded"


def test_shadowed_protocol_does_not_admit_excluded_ellipsis(
    tmp_path: Path,
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    source = (
        "class Protocol:\n"
        "    pass\n\n"
        "class Adapter(Protocol):\n"
        "    def invoke(self, value: object) -> object: ...\n\n"
        "runtime_value = 1\n"
    )
    source_path = suite_root / PACKAGE_REL / "support.py"
    source_path.write_text(source, encoding="utf-8")
    key = (PACKAGE_REL / "support.py").as_posix()
    executed = [1, 2, 4, 7]
    excluded = [5, 6]
    report["files"][key] = {
        "executed_lines": executed,
        "summary": _summary(executed, [], [], [], excluded),
        "missing_lines": [],
        "excluded_lines": excluded,
        "executed_branches": [],
        "missing_branches": [],
        "functions": {"": {}},
        "classes": {"": {}},
    }
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "package_source_excluded"


@pytest.mark.parametrize(
    ("field", "reason"),
    (
        ("line", "critical_line_coverage_incomplete"),
        ("branch", "critical_branch_coverage_incomplete"),
    ),
)
def test_critical_symbol_requires_one_hundred_percent_line_and_branch_coverage(
    tmp_path: Path, field: str, reason: str
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "server.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    functions = file_report["functions"]
    assert isinstance(functions, dict)
    region = functions["build_patched_ssl_context"]
    assert isinstance(region, dict)
    if field == "line":
        line = region["executed_lines"].pop()
        region["missing_lines"].append(line)
        file_report["executed_lines"].remove(line)
        file_report["missing_lines"].append(line)
    else:
        arc = region["executed_branches"].pop()
        region["missing_branches"].append(arc)
        file_report["executed_branches"].remove(arc)
        file_report["missing_branches"].append(arc)
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == reason


def test_critical_symbol_may_not_exclude_a_source_line(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "server.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    functions = file_report["functions"]
    assert isinstance(functions, dict)
    region = functions["build_patched_ssl_context"]
    assert isinstance(region, dict)
    line = region["executed_lines"].pop()
    region["excluded_lines"].append(line)
    file_report["executed_lines"].remove(line)
    file_report["excluded_lines"].append(line)
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "critical_source_excluded"


@pytest.mark.parametrize(
    "marker",
    (
        "# pragma: no branch",
        "# pragma: nobranch",
        "# pragma nobranch",
        "#pragma:no branch",
        "# pragma: no branchy",
    ),
)
def test_critical_symbol_may_not_use_any_default_no_branch_pragma(
    tmp_path: Path, marker: str
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    source_path = suite_root / PACKAGE_REL / "server.py"
    source_path.write_text(
        source_path.read_text(encoding="utf-8").replace(
            "if value:", f"if value:  {marker}", 1
        ),
        encoding="utf-8",
    )
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "critical_source_exclusion_marker"


def test_critical_symbol_rejects_default_pragma_text_inside_raw_source_line(
    tmp_path: Path,
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    source_path = suite_root / PACKAGE_REL / "server.py"
    source_path.write_text(
        source_path.read_text(encoding="utf-8").replace(
            "if value:", 'if "# pragma: no branch" and value:', 1
        ),
        encoding="utf-8",
    )
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "critical_source_exclusion_marker"


def test_partial_branch_summary_must_match_the_arc_facts(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "server.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    summary = file_report["summary"]
    assert isinstance(summary, dict)
    summary["num_partial_branches"] = 99
    report_path.write_text(json.dumps(report), encoding="utf-8")

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "coverage_summary_mismatch"


def test_arc_free_critical_symbol_rejects_invented_branch_facts(
    tmp_path: Path,
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "evidence.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    functions = file_report["functions"]
    assert isinstance(functions, dict)
    region = functions["validate_evidence"]
    assert isinstance(region, dict)
    start = region["start_line"]
    body = region["executed_lines"][0]
    assert isinstance(start, int) and isinstance(body, int)
    invented = [[body, body], [body, -start]]
    region["executed_branches"] = invented
    file_report["executed_branches"].extend(invented)
    _rewrite(report_path, report)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "critical_branch_coverage_unexpected"


def test_summary_count_mismatch_cannot_create_a_false_green(tmp_path: Path) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "policy.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    summary = file_report["summary"]
    assert isinstance(summary, dict)
    summary["covered_lines"] = 999
    report_path.write_text(json.dumps(report), encoding="utf-8")

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "coverage_summary_mismatch"


def test_duplicate_branch_arc_is_rejected_instead_of_inflating_coverage(
    tmp_path: Path,
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "harness.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    file_report["executed_branches"].append(file_report["executed_branches"][0])
    _sync_report(report)
    report_path.write_text(json.dumps(report), encoding="utf-8")

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "duplicate_coverage_fact"


def test_deeply_nested_json_fails_with_a_stable_reason(tmp_path: Path) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    report_path.write_text("[" * 2_000 + "]" * 2_000, encoding="utf-8")

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "coverage_json_root_not_object"
    assert str(tmp_path) not in completed.stderr


def test_package_root_race_fails_with_a_stable_reason(tmp_path: Path) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    shutil.rmtree(suite_root / PACKAGE_REL)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "package_root_invalid"
    assert str(tmp_path) not in completed.stderr


def test_critical_symbol_range_must_match_the_current_source_ast(
    tmp_path: Path,
) -> None:
    suite_root, report_path, report = _fixture(tmp_path)
    key = (PACKAGE_REL / "evidence.py").as_posix()
    file_report = report["files"][key]
    assert isinstance(file_report, dict)
    functions = file_report["functions"]
    assert isinstance(functions, dict)
    region = functions["secret_reason"]
    assert isinstance(region, dict)
    region["start_line"] = 999
    report_path.write_text(json.dumps(report), encoding="utf-8")

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "critical_ast_range_mismatch"


def test_result_artifact_must_be_fresh_in_the_coverage_evidence_root(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    result_path = report_path.with_name("coverage-gate.json")
    result_path.write_text("preserve", encoding="utf-8")

    completed = _run(suite_root, report_path)

    assert completed.returncode == 2
    assert completed.stderr.strip() == "result_json_must_be_fresh"
    assert result_path.read_text(encoding="utf-8") == "preserve"


def test_result_writer_converts_io_failure_to_a_stable_gate_reason(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    spec = importlib.util.spec_from_file_location("d2_coverage_verifier", VERIFY)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    destination = tmp_path / "coverage-gate.json"

    def fail_fsync(_: int) -> None:
        raise OSError("caller-controlled-path")

    monkeypatch.setattr(module.os, "fsync", fail_fsync)

    with pytest.raises(module.GateFailure) as exc_info:
        module._write_result(destination, {"status": "PASS"})

    assert str(exc_info.value) == "result_json_write_failed"
    assert not destination.exists()
    assert list(tmp_path.iterdir()) == []


def test_result_writer_converts_entropy_failure_to_a_stable_gate_reason(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    spec = importlib.util.spec_from_file_location(
        "d2_coverage_verifier_entropy", VERIFY
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)

    def fail_entropy(_: int) -> str:
        raise OSError("caller-controlled-path")

    monkeypatch.setattr(module.secrets, "token_hex", fail_entropy)

    with pytest.raises(module.GateFailure) as exc_info:
        module._write_result(tmp_path / "coverage-gate.json", {"status": "PASS"})

    assert str(exc_info.value) == "result_json_write_failed"
    assert list(tmp_path.iterdir()) == []


def test_stale_legacy_temp_name_cannot_wedge_a_fresh_result(tmp_path: Path) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)
    stale = report_path.with_name("coverage-gate.tmp")
    stale.write_text("preserve", encoding="utf-8")

    completed = _run(suite_root, report_path)

    assert completed.returncode == 0, completed.stderr
    assert stale.read_text(encoding="utf-8") == "preserve"
