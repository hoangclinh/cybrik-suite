"""Verify the D2 harness coverage gate from pinned Coverage.py JSON.

Admission requires two external artifacts whose SHA-256 the caller states up
front: a canonical coverage authorization, and the measurement receipt that
authorization covers. The authorization pins the producer's wrapper, pinned
interpreter and command digests plus the Suite source tuple; the schema 2.0.0
receipt must repeat every one of them and bind the exact coverage JSON bytes.

The published PASS carries exactly the four keys the runtime admission layer
admits -- ``binding``, ``branch``, ``line`` and ``status`` -- while the pinned
Coverage.py version and JSON format, every critical symbol and both 80% floors
are still enforced before anything is published.

This module is pure stdlib and import-inert. It does not run Coverage.py, import
the UAT harness, restore B1, open listeners, or grant runtime authority.
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import re
import secrets
import stat
import sys
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
    r"#\s*pragma[:\s]?\s*no\s*(?:cover|branch)", re.IGNORECASE
)
MAX_RECEIPT_BYTES: Final = 1024 * 1024
MAX_COVERAGE_AUTHORIZATION_BYTES: Final = 64 * 1024
RECEIPT_SCHEMA_VERSION: Final = "2.0.0"
RECEIPT_POLICY_ID: Final = "cybrik-d2-coverage-receipt/v2"
PRODUCER_IDENTITY: Final = "cybrik-d2-coverage-wrapper"
ADMISSIBLE_STATUS: Final = "PASS"
RECEIPT_KEYS: Final = frozenset(
    {
        "artifacts",
        "authorization",
        "execution_boundary",
        "producer",
        "receipt_id",
        "run",
        "schema_version",
        "source",
    }
)
RECEIPT_ARTIFACT_KEYS: Final = frozenset(
    {"coverage_data_sha256", "coverage_json_sha256"}
)
RECEIPT_AUTHORIZATION_KEYS: Final = frozenset({"id", "sha256"})
RECEIPT_BOUNDARY_KEYS: Final = frozenset({"network_calls", "runtime_executed"})
RECEIPT_PRODUCER_KEYS: Final = frozenset(
    {"executable_sha256", "identity", "wrapper_sha256"}
)
RECEIPT_RUN_KEYS: Final = frozenset({"command_sha256", "id", "nonce"})
RECEIPT_SOURCE_KEYS: Final = frozenset({"suite_commit", "suite_tree"})
COVERAGE_AUTHORIZATION_KEYS: Final = frozenset(
    {
        "authorization_id",
        "measurement_command_sha256",
        "measurement_wrapper_sha256",
        "pinned_python_sha256",
        "receipt_policy_id",
        "suite_commit",
        "suite_tree",
    }
)
COVERAGE_AUTHORIZATION_DIGEST_KEYS: Final = (
    "measurement_command_sha256",
    "measurement_wrapper_sha256",
    "pinned_python_sha256",
)
SHA256_HEX: Final = re.compile(r"^[0-9a-f]{64}$")
GIT_OBJECT_HEX: Final = re.compile(r"^[0-9a-f]{40}$")
AUTHORIZATION_ID: Final = re.compile(r"^[a-z0-9][a-z0-9._-]{0,127}$")
ARGUMENT_KEYS: Final = (
    "--suite-root",
    "--coverage-json",
    "--coverage-authorization",
    "--coverage-authorization-sha256",
    "--measurement-receipt",
    "--measurement-receipt-sha256",
    "--result-json",
)
REQUIRED_BASE_ARGUMENTS: Final = frozenset(
    {"--suite-root", "--coverage-json", "--result-json"}
)
RECEIPT_ARGUMENTS: Final = frozenset(
    {"--measurement-receipt", "--measurement-receipt-sha256"}
)
COVERAGE_AUTHORIZATION_ARGUMENTS: Final = frozenset(
    {"--coverage-authorization", "--coverage-authorization-sha256"}
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


def _read_bounded(
    path: Path, *, max_bytes: int, oversize_reason: str, unreadable_reason: str
) -> bytes:
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags)
    except OSError:
        _fail(unreadable_reason)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode):
            _fail(unreadable_reason)
        if info.st_size > max_bytes:
            _fail(oversize_reason)
        chunks: list[bytes] = []
        read_total = 0
        while True:
            chunk = os.read(descriptor, 65536)
            if not chunk:
                break
            read_total += len(chunk)
            if read_total > max_bytes:
                _fail(oversize_reason)
            chunks.append(chunk)
    except OSError:
        _fail(unreadable_reason)
    finally:
        os.close(descriptor)
    data = b"".join(chunks)
    if len(data) != info.st_size:
        _fail(unreadable_reason)
    return data


def _load_json(data: bytes) -> dict[str, object]:
    try:
        loaded = json.loads(
            data.decode("utf-8"),
            object_pairs_hook=_pairs_without_duplicates,
            parse_constant=_reject_nonfinite,
        )
    except (UnicodeError, ValueError, RecursionError):
        _fail("coverage_json_invalid")
    if not isinstance(loaded, dict):
        _fail("coverage_json_root_not_object")
    return loaded


def _absolute_canonical_path(
    raw: str,
    *,
    directory: bool,
    not_regular_reason: str = "coverage_json_not_regular_file",
) -> Path:
    candidate = Path(raw)
    if not candidate.is_absolute():
        _fail("input_path_not_absolute")
    if candidate.is_symlink():
        _fail("input_path_is_symlink")
    try:
        resolved = candidate.resolve(strict=True)
    except OSError:
        _fail("input_path_unavailable")
    if resolved != candidate:
        _fail("input_path_not_canonical")
    if directory:
        if not candidate.is_dir():
            _fail("suite_root_not_directory")
    elif not candidate.is_file():
        _fail(not_regular_reason)
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
    try:
        parent_mode = parent.stat().st_mode & 0o777
    except OSError:
        _fail("result_json_parent_unavailable")
    if parent_mode != 0o700:
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
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor: int | None = None
    published_identity: tuple[int, int] | None = None
    temporary: Path | None = None
    try:
        temporary = destination.with_name(
            f".{destination.name}.{secrets.token_hex(16)}.tmp"
        )
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
        if temporary is not None:
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
    partial_branch_sources = {arc[:-1] for arc in facts.executed_branches} & {
        arc[:-1] for arc in facts.missing_branches
    }
    expected = {
        "covered_lines": facts.line_covered,
        "num_statements": facts.line_total,
        "missing_lines": len(facts.missing_lines),
        "excluded_lines": len(facts.excluded_lines),
        "num_branches": facts.branch_total,
        "num_partial_branches": len(partial_branch_sources),
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
    try:
        lexical = candidate.resolve(strict=False)
    except OSError:
        _fail("reported_file_unavailable")
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
    return any(
        EXCLUSION_MARKER.search(line) is not None
        for line in source.splitlines()[start - 1 : end]
    )


def _assert_critical_symbol(file: FileCoverage, *, function: str) -> None:
    """Enforce full line and branch coverage of one critical symbol's region."""

    try:
        source = file.path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        _fail("critical_source_unreadable")
    node = _top_level_function(source, function)
    if node.end_lineno is None:
        _fail("critical_symbol_not_exact")
    start = node.lineno
    end = node.end_lineno
    region_start = node.body[0].lineno
    region_end = node.body[-1].end_lineno
    if region_end is None:
        _fail("critical_symbol_not_exact")
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
            line
            for line in file.facts.executed_lines
            if region_start <= line <= region_end
        ),
        missing_lines=frozenset(
            line
            for line in file.facts.missing_lines
            if region_start <= line <= region_end
        ),
        excluded_lines=frozenset(
            line
            for line in file.facts.excluded_lines
            if region_start <= line <= region_end
        ),
        executed_branches=frozenset(
            arc
            for arc in file.facts.executed_branches
            if region_start <= arc[0] <= region_end
        ),
        missing_branches=frozenset(
            arc
            for arc in file.facts.missing_branches
            if region_start <= arc[0] <= region_end
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
        return
    if not has_static_branch:
        _fail("critical_branch_coverage_unexpected")
    if region_facts.branch_covered / region_facts.branch_total != 1.0:
        _fail("critical_branch_coverage_incomplete")


def verify(*, suite_root: Path, report: dict[str, object]) -> dict[str, object]:
    meta = _mapping(report.get("meta"), "coverage_meta_invalid")
    if type(meta.get("format")) is not int or meta["format"] != PINNED_JSON_FORMAT:
        _fail("coverage_json_format_not_three")
    if meta.get("version") != PINNED_COVERAGE_VERSION:
        _fail("coverage_version_mismatch")
    if meta.get("branch_coverage") is not True:
        _fail("branch_coverage_not_enabled")

    try:
        package_root = (suite_root / PACKAGE_REL).resolve(strict=True)
    except OSError:
        _fail("package_root_invalid")
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

    for module, function in CRITICAL_SYMBOLS:
        file = files.get(package_root / f"{module}.py")
        if file is None:
            _fail("critical_module_missing")
        _assert_critical_symbol(file, function=function)
    if aggregate.excluded_lines:
        _fail("package_source_excluded")

    # Only the two admission-compatible ratio objects are published: the pinned
    # version and format, every critical symbol and both floors were enforced
    # above, and restating them would widen the admitted result key set.
    return {
        "branch": {
            "covered": aggregate.branch_covered,
            "ratio": branch_ratio,
            "total": aggregate.branch_total,
        },
        "line": {
            "covered": aggregate.line_covered,
            "ratio": line_ratio,
            "total": aggregate.line_total,
        },
    }


def _receipt_pairs_without_duplicates(
    pairs: list[tuple[str, object]],
) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            _fail("measurement_receipt_invalid")
        result[key] = value
    return result


def _receipt_reject_nonfinite(_: str) -> object:
    _fail("measurement_receipt_invalid")


def _load_receipt(data: bytes) -> dict[str, object]:
    try:
        loaded = json.loads(
            data.decode("utf-8"),
            object_pairs_hook=_receipt_pairs_without_duplicates,
            parse_constant=_receipt_reject_nonfinite,
        )
    except (UnicodeError, ValueError, RecursionError):
        _fail("measurement_receipt_invalid")
    if not isinstance(loaded, dict):
        _fail("measurement_receipt_invalid")
    return loaded


def _nonempty_string(value: object, reason: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        _fail(reason)
    return value


def _hex_digest(value: object, reason: str, *, pattern: re.Pattern[str]) -> str:
    if not isinstance(value, str) or pattern.fullmatch(value) is None:
        _fail(reason)
    return value


def _receipt_section(
    receipt: dict[str, object], key: str, expected_keys: frozenset[str]
) -> dict[str, object]:
    """Return one receipt section, treating any key-set drift as schema drift."""

    reason = "measurement_receipt_schema_invalid"
    section = _mapping(receipt.get(key), reason)
    if set(section) != expected_keys:
        _fail(reason)
    return section


def _verify_coverage_authorization(
    authorization_raw: str, admitted_sha256: str, *, suite_root: Path
) -> tuple[dict[str, object], str]:
    """Admit the canonical coverage authorization from its exact bytes only.

    The digest every downstream binding is stated against is recomputed here
    from the bytes on disk, so no caller-supplied digest can stand in for it.
    """

    if SHA256_HEX.fullmatch(admitted_sha256) is None:
        _fail("coverage_authorization_digest_invalid")
    authorization_path = _absolute_canonical_path(
        authorization_raw,
        directory=False,
        not_regular_reason="coverage_authorization_not_regular_file",
    )
    if authorization_path.is_relative_to(suite_root):
        _fail("coverage_authorization_must_be_outside_suite")
    payload = _read_bounded(
        authorization_path,
        max_bytes=MAX_COVERAGE_AUTHORIZATION_BYTES,
        oversize_reason="coverage_authorization_too_large",
        unreadable_reason="coverage_authorization_unreadable",
    )
    digest = hashlib.sha256(payload).hexdigest()
    if digest != admitted_sha256:
        _fail("coverage_authorization_digest_mismatch")
    try:
        record = json.loads(payload.decode("utf-8"))
    except (UnicodeError, ValueError, RecursionError):
        _fail("coverage_authorization_not_canonical")
    if not isinstance(record, dict):
        _fail("coverage_authorization_not_canonical")
    canonical = json.dumps(record, sort_keys=True, separators=(",", ":"))
    if canonical.encode("utf-8") != payload:
        # A duplicate key, a reordering or any other re-encoding of the same
        # meaning is a different authorization: only the pinned bytes admit.
        _fail("coverage_authorization_not_canonical")

    reason = "coverage_authorization_schema_invalid"
    if set(record) != COVERAGE_AUTHORIZATION_KEYS:
        _fail(reason)
    if record["receipt_policy_id"] != RECEIPT_POLICY_ID:
        _fail(reason)
    authorization_id = _nonempty_string(record["authorization_id"], reason)
    if AUTHORIZATION_ID.fullmatch(authorization_id) is None:
        _fail(reason)
    for key in COVERAGE_AUTHORIZATION_DIGEST_KEYS:
        _hex_digest(record[key], reason, pattern=SHA256_HEX)
    for key in ("suite_commit", "suite_tree"):
        _hex_digest(record[key], reason, pattern=GIT_OBJECT_HEX)
    return record, digest


def _validate_artifacts(receipt: dict[str, object], *, coverage_bytes: bytes) -> None:
    reason = "measurement_receipt_artifacts_invalid"
    artifacts = _receipt_section(receipt, "artifacts", RECEIPT_ARTIFACT_KEYS)
    for key in sorted(RECEIPT_ARTIFACT_KEYS):
        _hex_digest(artifacts[key], reason, pattern=SHA256_HEX)
    if artifacts["coverage_json_sha256"] != hashlib.sha256(coverage_bytes).hexdigest():
        _fail("measurement_receipt_coverage_digest_mismatch")


def _validate_claimed_authorization(
    receipt: dict[str, object],
    *,
    coverage_authorization: dict[str, object],
    coverage_authorization_sha256: str,
) -> None:
    """Require the receipt to name the exact authorization it was measured under."""

    claimed = _receipt_section(receipt, "authorization", RECEIPT_AUTHORIZATION_KEYS)
    if (
        claimed["id"] != coverage_authorization["authorization_id"]
        or claimed["sha256"] != coverage_authorization_sha256
    ):
        _fail("measurement_receipt_authorization_mismatch")


def _validate_execution_boundary(receipt: dict[str, object]) -> None:
    reason = "measurement_receipt_boundary_invalid"
    boundary = _receipt_section(receipt, "execution_boundary", RECEIPT_BOUNDARY_KEYS)
    if not isinstance(boundary["network_calls"], list) or boundary["network_calls"]:
        _fail(reason)
    if boundary["runtime_executed"] is not False:
        _fail(reason)


def _validate_producer(
    receipt: dict[str, object], *, coverage_authorization: dict[str, object]
) -> None:
    reason = "measurement_receipt_producer_invalid"
    producer = _receipt_section(receipt, "producer", RECEIPT_PRODUCER_KEYS)
    if (
        producer["identity"] != PRODUCER_IDENTITY
        or producer["executable_sha256"]
        != coverage_authorization["pinned_python_sha256"]
        or producer["wrapper_sha256"]
        != coverage_authorization["measurement_wrapper_sha256"]
    ):
        _fail(reason)


def _validate_run(
    receipt: dict[str, object], *, coverage_authorization: dict[str, object]
) -> None:
    reason = "measurement_receipt_run_invalid"
    run = _receipt_section(receipt, "run", RECEIPT_RUN_KEYS)
    _nonempty_string(run["id"], reason)
    _hex_digest(run["nonce"], reason, pattern=SHA256_HEX)
    if run["command_sha256"] != coverage_authorization["measurement_command_sha256"]:
        _fail(reason)


def _validate_source(
    receipt: dict[str, object], *, coverage_authorization: dict[str, object]
) -> None:
    reason = "measurement_receipt_source_invalid"
    source = _receipt_section(receipt, "source", RECEIPT_SOURCE_KEYS)
    if (
        source["suite_commit"] != coverage_authorization["suite_commit"]
        or source["suite_tree"] != coverage_authorization["suite_tree"]
    ):
        _fail(reason)


def _verify_receipt(
    receipt_raw: str,
    admitted_sha256: str,
    *,
    suite_root: Path,
    coverage_bytes: bytes,
    coverage_authorization: dict[str, object],
    coverage_authorization_sha256: str,
) -> str:
    """Admit the schema 2.0.0 receipt the coverage authorization covers.

    Every producer, run and source claim must repeat the authorization, and the
    artifacts must bind the exact coverage JSON bytes this gate measured.
    """

    if SHA256_HEX.fullmatch(admitted_sha256) is None:
        _fail("measurement_receipt_digest_invalid")
    receipt_path = _absolute_canonical_path(
        receipt_raw,
        directory=False,
        not_regular_reason="measurement_receipt_not_regular_file",
    )
    if receipt_path.is_relative_to(suite_root):
        _fail("measurement_receipt_must_be_outside_suite")
    receipt_bytes = _read_bounded(
        receipt_path,
        max_bytes=MAX_RECEIPT_BYTES,
        oversize_reason="measurement_receipt_too_large",
        unreadable_reason="measurement_receipt_unreadable",
    )
    digest = hashlib.sha256(receipt_bytes).hexdigest()
    if digest != admitted_sha256:
        _fail("measurement_receipt_digest_mismatch")
    receipt = _load_receipt(receipt_bytes)
    canonical = json.dumps(receipt, sort_keys=True, separators=(",", ":"))
    if canonical.encode("utf-8") != receipt_bytes:
        _fail("measurement_receipt_not_canonical")
    if set(receipt) != RECEIPT_KEYS:
        _fail("measurement_receipt_schema_invalid")
    if receipt["schema_version"] != RECEIPT_SCHEMA_VERSION:
        _fail("measurement_receipt_schema_invalid")
    _nonempty_string(receipt["receipt_id"], "measurement_receipt_schema_invalid")
    _validate_artifacts(receipt, coverage_bytes=coverage_bytes)
    _validate_claimed_authorization(
        receipt,
        coverage_authorization=coverage_authorization,
        coverage_authorization_sha256=coverage_authorization_sha256,
    )
    _validate_execution_boundary(receipt)
    _validate_producer(receipt, coverage_authorization=coverage_authorization)
    _validate_run(receipt, coverage_authorization=coverage_authorization)
    _validate_source(receipt, coverage_authorization=coverage_authorization)
    return digest


@dataclass(frozen=True)
class Arguments:
    """The exact argument tuple every admissible invocation states up front."""

    suite_root: str
    coverage_json: str
    coverage_authorization: str
    coverage_authorization_sha256: str
    measurement_receipt: str
    measurement_receipt_sha256: str
    result_json: str


def _arguments(argv: list[str]) -> Arguments:
    if argv == ["--help"]:
        print(
            "usage: verify_coverage_gate.py --suite-root ABSOLUTE "
            "--coverage-json ABSOLUTE --coverage-authorization ABSOLUTE "
            "--coverage-authorization-sha256 HEX64 --measurement-receipt ABSOLUTE "
            "--measurement-receipt-sha256 HEX64 --result-json ABSOLUTE"
        )
        raise SystemExit(0)
    if len(argv) % 2 != 0 or len(argv) > 2 * len(ARGUMENT_KEYS):
        _fail("arguments_invalid")
    values: dict[str, str] = {}
    for index in range(0, len(argv), 2):
        key = argv[index]
        if key not in ARGUMENT_KEYS or key in values:
            _fail("arguments_invalid")
        values[key] = argv[index + 1]
    if not REQUIRED_BASE_ARGUMENTS <= set(values):
        _fail("arguments_invalid")
    if not COVERAGE_AUTHORIZATION_ARGUMENTS <= set(values):
        _fail("coverage_authorization_missing")
    if not RECEIPT_ARGUMENTS <= set(values):
        _fail("measurement_receipt_missing")
    return Arguments(
        suite_root=values["--suite-root"],
        coverage_json=values["--coverage-json"],
        coverage_authorization=values["--coverage-authorization"],
        coverage_authorization_sha256=values["--coverage-authorization-sha256"],
        measurement_receipt=values["--measurement-receipt"],
        measurement_receipt_sha256=values["--measurement-receipt-sha256"],
        result_json=values["--result-json"],
    )


def main(argv: list[str] | None = None) -> int:
    result_path: Path | None = None
    try:
        arguments = _arguments(list(sys.argv[1:] if argv is None else argv))
        suite_root = _absolute_canonical_path(arguments.suite_root, directory=True)
        coverage_json = _absolute_canonical_path(
            arguments.coverage_json, directory=False
        )
        if coverage_json.is_relative_to(suite_root):
            _fail("coverage_json_must_be_outside_suite")
        coverage_bytes = _read_bounded(
            coverage_json,
            max_bytes=MAX_JSON_BYTES,
            oversize_reason="coverage_json_too_large",
            unreadable_reason="coverage_json_invalid",
        )
        authorization, authorization_sha256 = _verify_coverage_authorization(
            arguments.coverage_authorization,
            arguments.coverage_authorization_sha256,
            suite_root=suite_root,
        )
        receipt_sha256 = _verify_receipt(
            arguments.measurement_receipt,
            arguments.measurement_receipt_sha256,
            suite_root=suite_root,
            coverage_bytes=coverage_bytes,
            coverage_authorization=authorization,
            coverage_authorization_sha256=authorization_sha256,
        )
        result_path = _fresh_result_path(
            arguments.result_json, suite_root=suite_root, coverage_json=coverage_json
        )
        result = {
            "binding": {
                "coverage_authorization_sha256": authorization_sha256,
                "measurement_receipt_sha256": receipt_sha256,
                "suite_commit": authorization["suite_commit"],
                "suite_tree": authorization["suite_tree"],
            },
            **verify(suite_root=suite_root, report=_load_json(coverage_bytes)),
            "status": ADMISSIBLE_STATUS,
        }
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
