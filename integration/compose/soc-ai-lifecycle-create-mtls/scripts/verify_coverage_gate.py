"""Verify the D2 harness coverage gate from pinned Coverage.py JSON.

This module is pure stdlib and import-inert. It does not run Coverage.py, import
the UAT harness, restore B1, open listeners, or grant runtime authority.
"""

from __future__ import annotations

import ast
import io
import json
import os
import re
import secrets
import sys
import tokenize
from dataclasses import dataclass
from pathlib import Path
from typing import Final

PACKAGE_REL: Final = Path(
    "integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls"
)
PINNED_COVERAGE_VERSION: Final = "7.15.2"
PINNED_JSON_FORMAT: Final = 3
MINIMUM_RATIO: Final = 0.8
MAX_JSON_BYTES: Final = 16 * 1024 * 1024
EVIDENCE_ROOT_NAME: Final = re.compile(
    r"^cybrik-uat-d2-coverage-evidence-[a-z0-9][a-z0-9._-]{0,63}$"
)
CRITICAL_SYMBOLS: Final = (
    ("server", "build_patched_ssl_context"),
    ("policy", "parse_loopback_bind"),
    ("policy", "validate_proposed_bind"),
    ("evidence", "secret_reason"),
    ("evidence", "validate_evidence"),
    ("harness", "_assert_ssl_context_evidence"),
    ("harness", "teardown"),
    ("harness", "verify_absent"),
)
STATIC_BRANCH_NODES: Final = (
    ast.If,
    ast.For,
    ast.AsyncFor,
    ast.While,
    ast.Try,
    ast.TryStar,
    ast.Match,
    ast.IfExp,
    ast.comprehension,
)
EXCLUSION_MARKER: Final = re.compile(
    r"#\s*pragma:\s*no\s+(?:cover|branch)\b", re.IGNORECASE
)


class GateFailure(Exception):
    """A stable fail-closed gate reason that carries no caller-controlled text."""


@dataclass(frozen=True)
class CoverageFacts:
    executed_lines: frozenset[int]
    missing_lines: frozenset[int]
    excluded_lines: frozenset[int]
    executed_branches: frozenset[tuple[int, int]]
    missing_branches: frozenset[tuple[int, int]]

    @property
    def line_covered(self) -> int:
        return len(self.executed_lines)

    @property
    def line_total(self) -> int:
        return len(self.executed_lines) + len(self.missing_lines)

    @property
    def branch_covered(self) -> int:
        return len(self.executed_branches)

    @property
    def branch_total(self) -> int:
        return len(self.executed_branches) + len(self.missing_branches)


@dataclass(frozen=True)
class FileCoverage:
    path: Path
    facts: CoverageFacts
    functions: dict[str, object]


def _fail(reason: str) -> None:
    raise GateFailure(reason)


def _pairs_without_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            _fail("duplicate_json_key")
        result[key] = value
    return result


def _reject_nonfinite(_: str) -> object:
    _fail("coverage_json_not_canonical")


def _load_json(path: Path) -> dict[str, object]:
    if path.stat().st_size > MAX_JSON_BYTES:
        _fail("coverage_json_too_large")
    try:
        loaded = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_pairs_without_duplicates,
            parse_constant=_reject_nonfinite,
        )
    except (OSError, UnicodeError, json.JSONDecodeError):
        _fail("coverage_json_invalid")
    if not isinstance(loaded, dict):
        _fail("coverage_json_root_not_object")
    return loaded


def _absolute_canonical_path(raw: str, *, directory: bool) -> Path:
    candidate = Path(raw)
    if not candidate.is_absolute():
        _fail("input_path_not_absolute")
    try:
        resolved = candidate.resolve(strict=True)
    except OSError:
        _fail("input_path_unavailable")
    if resolved != candidate:
        _fail("input_path_not_canonical")
    if candidate.is_symlink():
        _fail("input_path_is_symlink")
    if directory:
        if not candidate.is_dir():
            _fail("suite_root_not_directory")
    elif not candidate.is_file():
        _fail("coverage_json_not_regular_file")
    return candidate


def _fresh_result_path(raw: str, *, suite_root: Path, coverage_json: Path) -> Path:
    candidate = Path(raw)
    if not candidate.is_absolute() or candidate.name != "coverage-gate.json":
        _fail("result_json_path_invalid")
    try:
        parent = candidate.parent.resolve(strict=True)
    except OSError:
        _fail("result_json_parent_unavailable")
    if parent != candidate.parent or parent.is_symlink() or not parent.is_dir():
        _fail("result_json_parent_not_canonical")
    if parent != coverage_json.parent:
        _fail("result_json_not_co_located")
    if EVIDENCE_ROOT_NAME.fullmatch(parent.name) is None:
        _fail("coverage_evidence_root_name_invalid")
    if parent.stat().st_mode & 0o777 != 0o700:
        _fail("coverage_evidence_root_mode_invalid")
    if (
        parent == suite_root
        or parent.is_relative_to(suite_root)
        or suite_root.is_relative_to(parent)
    ):
        _fail("result_json_must_be_outside_suite")
    if candidate.exists() or candidate.is_symlink():
        _fail("result_json_must_be_fresh")
    return candidate


def _write_result(destination: Path, record: dict[str, object]) -> None:
    temporary = destination.with_name(
        f".{destination.name}.{secrets.token_hex(16)}.tmp"
    )
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor: int | None = None
    published_identity: tuple[int, int] | None = None
    try:
        descriptor = os.open(temporary, flags, 0o600)
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            descriptor = None
            stream.write(json.dumps(record, sort_keys=True, separators=(",", ":")))
            stream.flush()
            os.fsync(stream.fileno())
        temporary_stat = temporary.stat(follow_symlinks=False)
        published_identity = (temporary_stat.st_dev, temporary_stat.st_ino)
        os.link(temporary, destination, follow_symlinks=False)
        temporary.unlink()
        directory_flags = os.O_RDONLY
        if hasattr(os, "O_DIRECTORY"):
            directory_flags |= os.O_DIRECTORY
        directory_descriptor = os.open(destination.parent, directory_flags)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    except (OSError, ValueError):
        if descriptor is not None:
            try:
                os.close(descriptor)
            except OSError:
                pass
        if published_identity is not None:
            try:
                destination_stat = destination.stat(follow_symlinks=False)
                if (
                    destination_stat.st_dev,
                    destination_stat.st_ino,
                ) == published_identity:
                    destination.unlink()
            except OSError:
                pass
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass
        _fail("result_json_write_failed")


def _mapping(value: object, reason: str) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        _fail(reason)
    return value


def _integer(value: object, reason: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        _fail(reason)
    return value


def _line_set(value: object, *, max_line: int) -> frozenset[int]:
    if not isinstance(value, list):
        _fail("coverage_line_facts_invalid")
    lines: list[int] = []
    for line in value:
        parsed = _integer(line, "coverage_line_facts_invalid", minimum=1)
        if parsed > max_line:
            _fail("coverage_line_out_of_range")
        lines.append(parsed)
    if len(lines) != len(set(lines)):
        _fail("duplicate_coverage_fact")
    return frozenset(lines)


def _branch_set(value: object, *, max_line: int) -> frozenset[tuple[int, int]]:
    if not isinstance(value, list):
        _fail("coverage_branch_facts_invalid")
    arcs: list[tuple[int, int]] = []
    for arc in value:
        if not isinstance(arc, list) or len(arc) != 2:
            _fail("coverage_branch_facts_invalid")
        source = _integer(arc[0], "coverage_branch_facts_invalid", minimum=1)
        target = arc[1]
        if isinstance(target, bool) or not isinstance(target, int) or target == 0:
            _fail("coverage_branch_facts_invalid")
        if source > max_line or abs(target) > max_line:
            _fail("coverage_branch_out_of_range")
        arcs.append((source, target))
    if len(arcs) != len(set(arcs)):
        _fail("duplicate_coverage_fact")
    return frozenset(arcs)


def _facts(record: dict[str, object], *, max_line: int) -> CoverageFacts:
    facts = CoverageFacts(
        executed_lines=_line_set(record.get("executed_lines"), max_line=max_line),
        missing_lines=_line_set(record.get("missing_lines"), max_line=max_line),
        excluded_lines=_line_set(record.get("excluded_lines"), max_line=max_line),
        executed_branches=_branch_set(
            record.get("executed_branches"), max_line=max_line
        ),
        missing_branches=_branch_set(record.get("missing_branches"), max_line=max_line),
    )
    if facts.executed_lines & facts.missing_lines:
        _fail("overlapping_coverage_fact")
    if facts.excluded_lines & (facts.executed_lines | facts.missing_lines):
        _fail("overlapping_coverage_fact")
    if facts.executed_branches & facts.missing_branches:
        _fail("overlapping_coverage_fact")
    return facts


def _check_summary(summary_value: object, facts: CoverageFacts) -> None:
    summary = _mapping(summary_value, "coverage_summary_invalid")
    expected = {
        "covered_lines": facts.line_covered,
        "num_statements": facts.line_total,
        "missing_lines": len(facts.missing_lines),
        "excluded_lines": len(facts.excluded_lines),
        "num_branches": facts.branch_total,
        "covered_branches": facts.branch_covered,
        "missing_branches": len(facts.missing_branches),
    }
    for key, expected_value in expected.items():
        if _integer(summary.get(key), "coverage_summary_invalid") != expected_value:
            _fail("coverage_summary_mismatch")


def _reported_path(key: str, *, suite_root: Path, package_root: Path) -> Path:
    candidate = Path(key)
    if not candidate.is_absolute():
        candidate = suite_root / candidate
    lexical = candidate.resolve(strict=False)
    if lexical.suffix != ".py" or not lexical.is_relative_to(package_root):
        _fail("reported_file_outside_package")
    if lexical != candidate:
        _fail("reported_file_not_canonical")
    try:
        resolved = candidate.resolve(strict=True)
    except OSError:
        _fail("reported_file_unavailable")
    if resolved.suffix != ".py" or not resolved.is_relative_to(package_root):
        _fail("reported_file_outside_package")
    if candidate.is_symlink() or not resolved.is_file():
        _fail("reported_file_not_regular")
    return resolved


def _source_files(package_root: Path) -> dict[Path, int]:
    if package_root.is_symlink() or not package_root.is_dir():
        _fail("package_root_invalid")
    files: dict[Path, int] = {}
    for candidate in package_root.rglob("*.py"):
        if candidate.is_symlink() or not candidate.is_file():
            _fail("package_source_not_regular")
        try:
            resolved = candidate.resolve(strict=True)
            source = candidate.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            _fail("package_source_unreadable")
        if not resolved.is_relative_to(package_root):
            _fail("package_source_outside_root")
        files[resolved] = len(source.splitlines())
    if not files:
        _fail("package_source_empty")
    return files


def _file_coverage(
    files_value: object, *, suite_root: Path, package_root: Path
) -> dict[Path, FileCoverage]:
    records = _mapping(files_value, "coverage_files_invalid")
    expected = _source_files(package_root)
    result: dict[Path, FileCoverage] = {}
    for key, raw_record in records.items():
        path = _reported_path(key, suite_root=suite_root, package_root=package_root)
        if path in result:
            _fail("duplicate_reported_file")
        record = _mapping(raw_record, "coverage_file_record_invalid")
        facts = _facts(record, max_line=max(expected.get(path, 0), 1))
        _check_summary(record.get("summary"), facts)
        functions = _mapping(record.get("functions"), "coverage_functions_invalid")
        result[path] = FileCoverage(path=path, facts=facts, functions=functions)
    if set(result) != set(expected):
        _fail("package_file_set_mismatch")
    return result


def _aggregate(files: dict[Path, FileCoverage]) -> CoverageFacts:
    return CoverageFacts(
        executed_lines=frozenset(
            (index, line)
            for index, file in enumerate(files.values())
            for line in file.facts.executed_lines
        ),
        missing_lines=frozenset(
            (index, line)
            for index, file in enumerate(files.values())
            for line in file.facts.missing_lines
        ),
        excluded_lines=frozenset(
            (index, line)
            for index, file in enumerate(files.values())
            for line in file.facts.excluded_lines
        ),
        executed_branches=frozenset(
            (index, source, target)
            for index, file in enumerate(files.values())
            for source, target in file.facts.executed_branches
        ),
        missing_branches=frozenset(
            (index, source, target)
            for index, file in enumerate(files.values())
            for source, target in file.facts.missing_branches
        ),
    )


def _ratio(covered: int, total: int, empty_reason: str) -> float:
    if total == 0:
        _fail(empty_reason)
    return covered / total


def _top_level_function(
    source: str, name: str
) -> ast.FunctionDef | ast.AsyncFunctionDef:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        _fail("critical_source_syntax_invalid")
    matches = [
        node
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name == name
    ]
    if len(matches) != 1 or matches[0].end_lineno is None:
        _fail("critical_symbol_not_exact")
    return matches[0]


def _has_static_branch(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    return any(
        isinstance(descendant, STATIC_BRANCH_NODES) for descendant in ast.walk(node)
    )


def _has_exclusion_marker(source: str, *, start: int, end: int) -> bool:
    try:
        tokens = tokenize.generate_tokens(io.StringIO(source).readline)
        return any(
            token.type == tokenize.COMMENT
            and start <= token.start[0] <= end
            and EXCLUSION_MARKER.search(token.string) is not None
            for token in tokens
        )
    except (IndentationError, tokenize.TokenError):
        _fail("critical_source_syntax_invalid")


def _critical_result(
    file: FileCoverage, *, module: str, function: str
) -> dict[str, object]:
    try:
        source = file.path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        _fail("critical_source_unreadable")
    node = _top_level_function(source, function)
    if node.end_lineno is None:
        _fail("critical_symbol_not_exact")
    start = node.lineno
    end = node.end_lineno
    if _has_exclusion_marker(source, start=start, end=end):
        _fail("critical_source_exclusion_marker")
    raw_region = file.functions.get(function)
    region = _mapping(raw_region, "critical_region_missing")
    if (
        _integer(region.get("start_line"), "critical_region_invalid", minimum=1)
        != start
    ):
        _fail("critical_ast_range_mismatch")
    region_facts = _facts(region, max_line=max(len(source.splitlines()), 1))
    _check_summary(region.get("summary"), region_facts)

    file_range = CoverageFacts(
        executed_lines=frozenset(
            line for line in file.facts.executed_lines if start <= line <= end
        ),
        missing_lines=frozenset(
            line for line in file.facts.missing_lines if start <= line <= end
        ),
        excluded_lines=frozenset(
            line for line in file.facts.excluded_lines if start <= line <= end
        ),
        executed_branches=frozenset(
            arc for arc in file.facts.executed_branches if start <= arc[0] <= end
        ),
        missing_branches=frozenset(
            arc for arc in file.facts.missing_branches if start <= arc[0] <= end
        ),
    )
    if region_facts != file_range:
        _fail("critical_ast_range_mismatch")
    if region_facts.excluded_lines:
        _fail("critical_source_excluded")
    line_ratio = _ratio(
        region_facts.line_covered,
        region_facts.line_total,
        "critical_line_coverage_empty",
    )
    if line_ratio != 1.0:
        _fail("critical_line_coverage_incomplete")
    has_static_branch = _has_static_branch(node)
    if region_facts.branch_total == 0:
        if has_static_branch:
            _fail("critical_branch_coverage_empty")
        branch_ratio: float | None = None
        branch_requirement = "not-applicable-no-static-branch"
    else:
        if not has_static_branch:
            _fail("critical_branch_coverage_unexpected")
        branch_ratio = region_facts.branch_covered / region_facts.branch_total
        branch_requirement = "one-hundred-percent"
        if branch_ratio != 1.0:
            _fail("critical_branch_coverage_incomplete")
    return {
        "symbol": f"{module}.{function}",
        "start_line": start,
        "end_line": end,
        "line_covered": region_facts.line_covered,
        "line_total": region_facts.line_total,
        "line_ratio": line_ratio,
        "branch": {
            "covered": region_facts.branch_covered,
            "total": region_facts.branch_total,
            "ratio": branch_ratio,
            "requirement": branch_requirement,
        },
    }


def verify(*, suite_root: Path, report: dict[str, object]) -> dict[str, object]:
    meta = _mapping(report.get("meta"), "coverage_meta_invalid")
    if type(meta.get("format")) is not int or meta["format"] != PINNED_JSON_FORMAT:
        _fail("coverage_json_format_not_three")
    if meta.get("version") != PINNED_COVERAGE_VERSION:
        _fail("coverage_version_mismatch")
    if meta.get("branch_coverage") is not True:
        _fail("branch_coverage_not_enabled")

    package_root = (suite_root / PACKAGE_REL).resolve(strict=True)
    files = _file_coverage(
        report.get("files"), suite_root=suite_root, package_root=package_root
    )
    aggregate = _aggregate(files)
    _check_summary(report.get("totals"), aggregate)
    line_ratio = _ratio(
        aggregate.line_covered, aggregate.line_total, "package_line_coverage_empty"
    )
    branch_ratio = _ratio(
        aggregate.branch_covered,
        aggregate.branch_total,
        "package_branch_coverage_empty",
    )
    if line_ratio < MINIMUM_RATIO:
        _fail("package_line_coverage_below_80")
    if branch_ratio < MINIMUM_RATIO:
        _fail("package_branch_coverage_below_80")

    critical: list[dict[str, object]] = []
    for module, function in CRITICAL_SYMBOLS:
        path = package_root / f"{module}.py"
        file = files.get(path)
        if file is None:
            _fail("critical_module_missing")
        critical.append(_critical_result(file, module=module, function=function))

    return {
        "status": "PASS",
        "coverage_json_format": PINNED_JSON_FORMAT,
        "coverage_version": PINNED_COVERAGE_VERSION,
        "package_file_count": len(files),
        "line": {
            "covered": aggregate.line_covered,
            "total": aggregate.line_total,
            "ratio": line_ratio,
        },
        "branch": {
            "covered": aggregate.branch_covered,
            "total": aggregate.branch_total,
            "ratio": branch_ratio,
        },
        "critical": critical,
    }


def _arguments(argv: list[str]) -> tuple[str, str, str]:
    if argv == ["--help"]:
        print(
            "usage: verify_coverage_gate.py --suite-root ABSOLUTE "
            "--coverage-json ABSOLUTE --result-json ABSOLUTE"
        )
        raise SystemExit(0)
    if len(argv) != 6:
        _fail("arguments_invalid")
    values: dict[str, str] = {}
    for index in range(0, len(argv), 2):
        key = argv[index]
        if (
            key not in {"--suite-root", "--coverage-json", "--result-json"}
            or key in values
        ):
            _fail("arguments_invalid")
        values[key] = argv[index + 1]
    if set(values) != {"--suite-root", "--coverage-json", "--result-json"}:
        _fail("arguments_invalid")
    return (
        values["--suite-root"],
        values["--coverage-json"],
        values["--result-json"],
    )


def main(argv: list[str] | None = None) -> int:
    result_path: Path | None = None
    try:
        suite_raw, coverage_raw, result_raw = _arguments(
            list(sys.argv[1:] if argv is None else argv)
        )
        suite_root = _absolute_canonical_path(suite_raw, directory=True)
        coverage_json = _absolute_canonical_path(coverage_raw, directory=False)
        if coverage_json.is_relative_to(suite_root):
            _fail("coverage_json_must_be_outside_suite")
        result_path = _fresh_result_path(
            result_raw, suite_root=suite_root, coverage_json=coverage_json
        )
        result = verify(suite_root=suite_root, report=_load_json(coverage_json))
        _write_result(result_path, result)
    except GateFailure as exc:
        reason = str(exc)
        if result_path is not None:
            try:
                _write_result(result_path, {"reason": reason, "status": "FAIL"})
            except GateFailure:
                reason = "result_json_write_failed"
        print(reason, file=sys.stderr)
        return 2
    if result_path is None:
        print("result_json_path_invalid", file=sys.stderr)
        return 2
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
