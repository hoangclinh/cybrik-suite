"""Fail-closed tests for the D2 Coverage.py JSON verifier."""

from __future__ import annotations

import ast
import json
import stat
import subprocess
import sys
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


def _source(function_names: tuple[str, ...]) -> str:
    return "\n\n".join(
        f"def {name}(value):\n    if value:\n        return 1\n    return 0\n"
        for name in function_names
    )


def _summary(
    executed_lines: list[int],
    missing_lines: list[int],
    executed_branches: list[list[int]],
    missing_branches: list[list[int]],
) -> dict[str, int | float | str]:
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
        "excluded_lines": 0,
        "percent_statements_covered": statement_percent,
        "percent_statements_covered_display": f"{statement_percent:.0f}",
        "num_branches": branch_total,
        "num_partial_branches": 0,
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
        lines = list(range(node.lineno, node.end_lineno + 1))
        branch_source = next(
            child.lineno for child in ast.walk(node) if isinstance(child, ast.If)
        )
        branches = [
            [branch_source, branch_source + 1],
            [branch_source, node.end_lineno],
        ]
        executed_lines.update(lines)
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
    all_branches: list[list[int]] = []
    all_missing_branches: list[list[int]] = []
    for file_report in files.values():
        assert isinstance(file_report, dict)
        executed_lines = file_report["executed_lines"]
        missing_lines = file_report["missing_lines"]
        executed_branches = file_report["executed_branches"]
        missing_branches = file_report["missing_branches"]
        assert isinstance(executed_lines, list)
        assert isinstance(missing_lines, list)
        assert isinstance(executed_branches, list)
        assert isinstance(missing_branches, list)
        file_report["summary"] = _summary(
            executed_lines,
            missing_lines,
            executed_branches,
            missing_branches,
        )
        all_lines.extend(executed_lines)
        all_missing_lines.extend(missing_lines)
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
            )
    report["totals"] = _summary(
        all_lines,
        all_missing_lines,
        all_branches,
        all_missing_branches,
    )


def _fixture(tmp_path: Path) -> tuple[Path, Path, dict[str, object]]:
    suite_root = tmp_path / "suite"
    evidence_root = tmp_path / "cybrik-uat-d2-coverage-evidence-test"
    evidence_root.mkdir()
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


def _run(suite_root: Path, report_path: Path) -> subprocess.CompletedProcess[str]:
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


def _rewrite(report_path: Path, report: dict[str, object]) -> None:
    _sync_report(report)
    report_path.write_text(json.dumps(report), encoding="utf-8")


def test_exact_format_three_report_passes_with_separate_line_and_branch_results(
    tmp_path: Path,
) -> None:
    suite_root, report_path, _ = _fixture(tmp_path)

    completed = _run(suite_root, report_path)

    assert completed.returncode == 0, completed.stderr
    result = json.loads(completed.stdout)
    result_path = report_path.with_name("coverage-gate.json")
    assert json.loads(result_path.read_text(encoding="utf-8")) == result
    assert stat.S_IMODE(result_path.stat().st_mode) == 0o600
    assert result["status"] == "PASS"
    assert result["line"] == {"covered": 72, "ratio": 1.0, "total": 72}
    assert result["branch"] == {"covered": 16, "ratio": 1.0, "total": 16}
    assert [row["symbol"] for row in result["critical"]] == [
        "server.build_patched_ssl_context",
        "policy.parse_loopback_bind",
        "policy.validate_proposed_bind",
        "evidence.secret_reason",
        "evidence.validate_evidence",
        "harness._assert_ssl_context_evidence",
        "harness.teardown",
        "harness.verify_absent",
    ]
    assert all(row["line_ratio"] == 1.0 for row in result["critical"])
    assert all(row["branch_ratio"] == 1.0 for row in result["critical"])


@pytest.mark.parametrize(
    ("meta_key", "value", "reason"),
    (
        ("format", 2, "coverage_json_format_not_three"),
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
