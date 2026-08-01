"""Fail-closed tests for the D2 Coverage.py JSON verifier."""

from __future__ import annotations

import ast
import importlib.util
import json
import shutil
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
ARC_FREE_CRITICAL = {"validate_evidence", "verify_absent"}


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
        "num_partial_branches": len(
            {arc[0] for arc in executed_branches}
            & {arc[0] for arc in missing_branches}
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
        file_report["summary"] = _summary(
            executed_lines,
            missing_lines,
            executed_branches,
            missing_branches,
            excluded_lines,
        )
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
    assert result["line"] == {"covered": 68, "ratio": 1.0, "total": 68}
    assert result["branch"] == {"covered": 12, "ratio": 1.0, "total": 12}
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
    critical = {row["symbol"]: row for row in result["critical"]}
    assert critical["evidence.validate_evidence"]["branch"] == {
        "covered": 0,
        "requirement": "not-applicable-no-static-branch",
        "ratio": None,
        "total": 0,
    }
    assert critical["harness.verify_absent"]["branch"] == {
        "covered": 0,
        "requirement": "not-applicable-no-static-branch",
        "ratio": None,
        "total": 0,
    }
    assert all(
        row["branch"]["ratio"] == 1.0
        for symbol, row in critical.items()
        if symbol not in {"evidence.validate_evidence", "harness.verify_absent"}
    )


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
    assert isinstance(start, int)
    invented = [[start, start + 1], [start + 1, -start]]
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
