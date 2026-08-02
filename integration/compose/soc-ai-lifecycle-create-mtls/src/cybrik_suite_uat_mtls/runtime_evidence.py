"""Canonical, immutable Phase-B terminal evidence for the bounded D2 attempt.

This module does not run the UAT.  It validates a terminal result and seals its
already-authored artifacts into an existing external evidence directory.  All
filesystem decisions are made relative to open directory descriptors; the
terminal summary is linked last and therefore acts as the completion marker.
A symlinked ancestor in an evidence-root or artifact path fails closed; no
resolved-path fallback is permitted for that boundary.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import ssl
import stat
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, NoReturn

from . import evidence

TERMINAL_SCHEMA_VERSION: Final = "cybrik.d2.phase-b-terminal.v1"
SUMMARY_SCHEMA_VERSION: Final = "cybrik.d2.phase-b-summary.v1"
TEARDOWN_SCHEMA_VERSION: Final = "cybrik.d2.phase-b-teardown.v1"

RESULT_FILENAME: Final = "terminal-result.json"
TEARDOWN_FILENAME: Final = "terminal-teardown.json"
SUMMARY_FILENAME: Final = "terminal-summary.json"

MAX_ARTIFACT_BYTES: Final = 8 * 1024 * 1024
MAX_TERMINAL_BYTES: Final = 1024 * 1024

_HEX40: Final = re.compile(r"[0-9a-f]{40}")
_HEX64: Final = re.compile(r"[0-9a-f]{64}")
_IDENTIFIER: Final = re.compile(r"[a-z0-9][a-z0-9_.-]{0,127}")
_REASON: Final = re.compile(r"[a-z][a-z0-9_]{0,127}")
_EVIDENCE_ROOT: Final = re.compile(r"cybrik-uat-d2-evidence-[a-z0-9][a-z0-9._-]{0,63}")
_TIMESTAMP: Final = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z")
_CASE_IDS: Final = tuple(f"N{number}" for number in range(1, 11))
_REPOSITORIES: Final = ("suite", "soc", "ai", "fabric")
_REQUIRED_ARTIFACT_KINDS: Final = frozenset(
    {"authorization", "b1", "tls", "ssl", "postgresql", "secret_sweep"}
)
_PKI_PUBLIC_INVENTORY: Final = (
    (
        "ca_certificate",
        "pki-public/ca-cert.pem",
        "sealed-pki-00-ca_certificate.snapshot",
    ),
    (
        "server_certificate",
        "pki-public/server-cert.pem",
        "sealed-pki-01-server_certificate.snapshot",
    ),
    (
        "client_certificate",
        "pki-public/client-cert.pem",
        "sealed-pki-02-client_certificate.snapshot",
    ),
    (
        "alternate_client_certificate",
        "pki-public/alternate-client-cert.pem",
        "sealed-pki-03-alternate_client_certificate.snapshot",
    ),
    (
        "jwt_public_jwk",
        "pki-public/jwt-public-jwk.json",
        "sealed-pki-04-jwt_public_jwk.snapshot",
    ),
)
_TERMINAL_FILENAMES: Final = frozenset(
    {RESULT_FILENAME, TEARDOWN_FILENAME, SUMMARY_FILENAME}
)
_TRANSPORT_KEYS: Final = (
    "tls_version",
    "mtls_verified",
    "cnf_binding_verified",
    "asgi_tls_extension_verified",
    "ssl_hardened_options_preserved",
    "ssl_no_compression_verified",
)
_POSTGRESQL_KEYS: Final = (
    "role_rolsuper",
    "role_rolbypassrls",
    "role_rolcreaterole",
    "force_rls_table_count",
    "cross_tenant_row_count",
    "replay_row_count",
)
_TEARDOWN_KEYS: Final = (
    "completed",
    "ai_process_absent",
    "soc_process_absent",
    "postgres_container_absent",
    "ai_listener_absent",
    "postgres_listener_absent",
    "runtime_root_absent",
    "pki_absent",
)


class RuntimeEvidenceError(RuntimeError):
    """Stable fail-closed reason which never contains rejected material."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class PersistedTerminalEvidence:
    """Hashes of the three immutable completion records."""

    evidence_root: Path
    result_sha256: str
    teardown_sha256: str
    summary_sha256: str


def _fail(reason: str) -> NoReturn:
    raise RuntimeEvidenceError(reason)


def _exact_mapping(
    value: object, keys: Sequence[str], reason: str
) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        _fail(reason)
    if not all(isinstance(key, str) for key in value):
        _fail(reason)
    if len(value) != len(keys) or frozenset(value) != frozenset(keys):
        _fail(reason)
    return value  # type: ignore[return-value]


def _digest(value: object) -> str:
    if not isinstance(value, str) or _HEX64.fullmatch(value) is None:
        _fail("digest_invalid")
    return value


def _git_sha(value: object) -> str:
    if not isinstance(value, str) or _HEX40.fullmatch(value) is None:
        _fail("repository_tuple_invalid")
    return value


def _identifier(value: object) -> str:
    if not isinstance(value, str) or _IDENTIFIER.fullmatch(value) is None:
        _fail("identifier_invalid")
    return value


def _reason_code(value: object) -> str:
    if not isinstance(value, str) or _REASON.fullmatch(value) is None:
        _fail("reason_code_invalid")
    return value


def _nonnegative_int(value: object, reason: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        _fail(reason)
    return value


def _utc_timestamp(value: object) -> datetime:
    if not isinstance(value, str) or _TIMESTAMP.fullmatch(value) is None:
        _fail("timings_invalid")
    try:
        parsed = datetime.fromisoformat(value.removesuffix("Z") + "+00:00")
    except ValueError:
        _fail("timings_invalid")
    if parsed.tzinfo is None or parsed.astimezone(UTC).utcoffset().total_seconds() != 0:
        _fail("timings_invalid")
    return parsed.astimezone(UTC)


def canonical_json(value: object) -> bytes:
    """Return the versioned packet's deterministic UTF-8 representation."""

    try:
        payload = (
            json.dumps(
                value,
                allow_nan=False,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
            + b"\n"
        )
    except (TypeError, ValueError, UnicodeError):
        _fail("canonical_json_invalid")
    if len(payload) > MAX_TERMINAL_BYTES:
        _fail("terminal_record_too_large")
    return payload


def _validate_repository_tuple(value: object) -> dict[str, object]:
    repositories = _exact_mapping(value, _REPOSITORIES, "repository_tuple_invalid")
    result: dict[str, object] = {}
    for name in _REPOSITORIES:
        record = _exact_mapping(
            repositories[name], ("commit_sha", "tree_sha"), "repository_tuple_invalid"
        )
        result[name] = {
            "commit_sha": _git_sha(record["commit_sha"]),
            "tree_sha": _git_sha(record["tree_sha"]),
        }
    return result


def _validate_authority(value: object) -> dict[str, object]:
    record = _exact_mapping(
        value,
        ("phase_a_auth_sha256", "consumption_sha256", "one_shot_consumed"),
        "authority_invalid",
    )
    if record["one_shot_consumed"] is not True:
        _fail("authority_not_consumed")
    return {
        "phase_a_auth_sha256": _digest(record["phase_a_auth_sha256"]),
        "consumption_sha256": _digest(record["consumption_sha256"]),
        "one_shot_consumed": True,
    }


def _validate_b1(value: object) -> dict[str, str]:
    keys = (
        "wheel_sha256",
        "provenance_sha256",
        "containment_test_sha256",
        "loader_base_sha256",
    )
    record = _exact_mapping(value, keys, "b1_invalid")
    return {key: _digest(record[key]) for key in keys}


def _validate_cases(value: object) -> tuple[list[dict[str, object]], dict[str, int]]:
    if isinstance(value, (str, bytes)) or not isinstance(value, Sequence):
        _fail("case_inventory_invalid")
    if len(value) != 10:
        _fail("case_inventory_invalid")
    cases: list[dict[str, object]] = []
    observed_counts = {"passed": 0, "failed": 0, "not_run": 0}
    observed_ids: list[str] = []
    for candidate in value:
        record = _exact_mapping(
            candidate,
            (
                "case_id",
                "outcome",
                "reason_code",
                "duration_ms",
                "artifact_name",
            ),
            "case_result_invalid",
        )
        case_id = record["case_id"]
        if not isinstance(case_id, str):
            _fail("case_inventory_invalid")
        observed_ids.append(case_id)
        outcome = record["outcome"]
        if outcome not in observed_counts:
            _fail("case_result_invalid")
        reason = record["reason_code"]
        if outcome == "passed":
            if reason is not None:
                _fail("case_result_invalid")
            reason_result = None
        else:
            try:
                reason_result = _reason_code(reason)
            except RuntimeEvidenceError:
                _fail("case_result_invalid")
        duration = _nonnegative_int(record["duration_ms"], "case_result_invalid")
        artifact_name = _identifier(record["artifact_name"])
        observed_counts[outcome] += 1
        cases.append(
            {
                "case_id": case_id,
                "outcome": outcome,
                "reason_code": reason_result,
                "duration_ms": duration,
                "artifact_name": artifact_name,
            }
        )
    if tuple(observed_ids) != _CASE_IDS or len(set(observed_ids)) != 10:
        _fail("case_inventory_invalid")
    return cases, observed_counts


def _validate_counts(value: object, observed: Mapping[str, int]) -> dict[str, int]:
    keys = ("case_count", "passed_count", "failed_count", "not_run_count")
    record = _exact_mapping(value, keys, "counts_invalid")
    result = {key: _nonnegative_int(record[key], "counts_invalid") for key in keys}
    expected = {
        "case_count": 10,
        "passed_count": observed["passed"],
        "failed_count": observed["failed"],
        "not_run_count": observed["not_run"],
    }
    if result != expected or sum(result[key] for key in keys[1:]) != 10:
        _fail("counts_do_not_reconcile")
    return result


def _validate_transport(value: object) -> dict[str, object]:
    record = _exact_mapping(value, _TRANSPORT_KEYS, "transport_invalid")
    tls_version = record["tls_version"]
    if tls_version not in {"TLSv1.2", "TLSv1.3", "unavailable"}:
        _fail("transport_invalid")
    result: dict[str, object] = {"tls_version": tls_version}
    for key in _TRANSPORT_KEYS[1:]:
        if not isinstance(record[key], bool):
            _fail("transport_invalid")
        result[key] = record[key]
    return result


def _transport_passes(record: Mapping[str, object]) -> bool:
    return record["tls_version"] == "TLSv1.3" and all(
        record[key] is True for key in _TRANSPORT_KEYS[1:]
    )


def _validate_postgresql(value: object) -> dict[str, object]:
    record = _exact_mapping(value, _POSTGRESQL_KEYS, "postgresql_invalid")
    result: dict[str, object] = {}
    for key in _POSTGRESQL_KEYS[:3]:
        if not isinstance(record[key], bool):
            _fail("postgresql_invalid")
        result[key] = record[key]
    for key in _POSTGRESQL_KEYS[3:]:
        result[key] = _nonnegative_int(record[key], "postgresql_invalid")
    return result


def _postgresql_passes(record: Mapping[str, object]) -> bool:
    return record == {
        "role_rolsuper": False,
        "role_rolbypassrls": False,
        "role_rolcreaterole": False,
        "force_rls_table_count": 5,
        "cross_tenant_row_count": 0,
        "replay_row_count": 1,
    }


def _validate_timings(
    value: object, cases: Sequence[Mapping[str, object]]
) -> dict[str, object]:
    keys = (
        "started_at",
        "finished_at",
        "setup_ms",
        "cases_ms",
        "teardown_ms",
        "total_ms",
    )
    record = _exact_mapping(value, keys, "timings_invalid")
    started = _utc_timestamp(record["started_at"])
    finished = _utc_timestamp(record["finished_at"])
    durations = {
        key: _nonnegative_int(record[key], "timings_invalid") for key in keys[2:]
    }
    if finished < started:
        _fail("timings_invalid")
    if durations["cases_ms"] != sum(int(case["duration_ms"]) for case in cases):
        _fail("timings_invalid")
    if durations["total_ms"] != (
        durations["setup_ms"] + durations["cases_ms"] + durations["teardown_ms"]
    ):
        _fail("timings_invalid")
    elapsed_ms = round((finished - started).total_seconds() * 1000)
    if elapsed_ms != durations["total_ms"]:
        _fail("timings_invalid")
    return {
        "started_at": record["started_at"],
        "finished_at": record["finished_at"],
        **durations,
    }


def _validate_teardown(value: object) -> dict[str, bool]:
    record = _exact_mapping(value, _TEARDOWN_KEYS, "teardown_invalid")
    if any(record[key] is not True for key in _TEARDOWN_KEYS):
        _fail("teardown_incomplete")
    return {key: True for key in _TEARDOWN_KEYS}


def _validate_pki_public(value: object, artifact_state: str) -> dict[str, object]:
    keys = (
        "ephemeral",
        "destroyed",
        "certificate_count",
        "public_artifact_count",
        "public_artifacts",
    )
    record = _exact_mapping(value, keys, "pki_public_invalid")
    if record["ephemeral"] is not True or record["destroyed"] is not True:
        _fail("teardown_incomplete")
    certificate_count = _nonnegative_int(
        record["certificate_count"], "pki_public_invalid"
    )
    public_count = _nonnegative_int(
        record["public_artifact_count"], "pki_public_invalid"
    )
    artifacts = record["public_artifacts"]
    if (
        certificate_count != 4
        or public_count != 5
        or isinstance(artifacts, (str, bytes))
        or not isinstance(artifacts, Sequence)
        or len(artifacts) != public_count
    ):
        _fail("pki_public_invalid")
    public_artifacts: list[dict[str, object]] = []
    observed_paths: list[str] = []
    for candidate, (name, source_path, sealed_path) in zip(
        artifacts, _PKI_PUBLIC_INVENTORY, strict=True
    ):
        artifact = _exact_mapping(
            candidate,
            ("name", "relative_path", "sha256", "size_bytes"),
            "pki_public_inventory_invalid",
        )
        if artifact["name"] != name or artifact["relative_path"] not in {
            source_path,
            sealed_path,
        }:
            _fail("pki_public_inventory_invalid")
        relative_path = _relative_artifact_path(artifact["relative_path"])
        observed_paths.append(relative_path)
        size_bytes = _nonnegative_int(
            artifact["size_bytes"], "pki_public_inventory_invalid"
        )
        if size_bytes > MAX_ARTIFACT_BYTES:
            _fail("pki_public_inventory_invalid")
        public_artifacts.append(
            {
                "name": name,
                "relative_path": relative_path,
                "sha256": _digest(artifact["sha256"]),
                "size_bytes": size_bytes,
            }
        )
    source_paths = [source for _, source, _ in _PKI_PUBLIC_INVENTORY]
    sealed_paths = [sealed for _, _, sealed in _PKI_PUBLIC_INVENTORY]
    expected_paths = source_paths if artifact_state == "raw" else sealed_paths
    if observed_paths != expected_paths:
        _fail("pki_public_inventory_invalid")
    return {
        "ephemeral": True,
        "destroyed": True,
        "certificate_count": certificate_count,
        "public_artifact_count": public_count,
        "public_artifacts": public_artifacts,
    }


def _relative_artifact_path(value: object) -> str:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        _fail("artifact_path_invalid")
    components = value.split("/")
    if value.startswith("/") or any(part in {"", ".", ".."} for part in components):
        _fail("artifact_path_invalid")
    if any(_IDENTIFIER.fullmatch(part) is None for part in components):
        _fail("artifact_path_invalid")
    if value in _TERMINAL_FILENAMES:
        _fail("artifact_path_invalid")
    return value


def _validate_artifacts(
    value: object,
    cases: Sequence[Mapping[str, object]],
    outcome: str,
    artifact_state: str,
) -> list[dict[str, object]]:
    if isinstance(value, (str, bytes)) or not isinstance(value, Sequence) or not value:
        _fail("artifacts_invalid")
    result: list[dict[str, object]] = []
    names: set[str] = set()
    paths: set[str] = set()
    for candidate in value:
        record = _exact_mapping(
            candidate,
            ("name", "kind", "case_id", "relative_path", "sha256", "size_bytes"),
            "artifacts_invalid",
        )
        name = _identifier(record["name"])
        kind = record["kind"]
        if kind not in _REQUIRED_ARTIFACT_KINDS | {"case", "failure"}:
            _fail("artifacts_invalid")
        case_id = record["case_id"]
        if kind == "case":
            if case_id not in _CASE_IDS:
                _fail("artifacts_invalid")
        elif case_id is not None:
            _fail("artifacts_invalid")
        relative_path = _relative_artifact_path(record["relative_path"])
        size_bytes = _nonnegative_int(record["size_bytes"], "artifacts_invalid")
        if size_bytes > MAX_ARTIFACT_BYTES or name in names or relative_path in paths:
            _fail("artifacts_invalid")
        names.add(name)
        paths.add(relative_path)
        result.append(
            {
                "name": name,
                "kind": kind,
                "case_id": case_id,
                "relative_path": relative_path,
                "sha256": _digest(record["sha256"]),
                "size_bytes": size_bytes,
            }
        )
    by_name = {str(artifact["name"]): artifact for artifact in result}
    for case in cases:
        artifact = by_name.get(str(case["artifact_name"]))
        if (
            artifact is None
            or artifact["kind"] != "case"
            or artifact["case_id"] != case["case_id"]
        ):
            _fail("case_artifact_invalid")
    if outcome == "passed":
        observed_kinds = {str(artifact["kind"]) for artifact in result}
        if not _REQUIRED_ARTIFACT_KINDS <= observed_kinds:
            _fail("required_artifact_missing")
    expected_snapshot_paths = [
        f"sealed-artifact-{index:02d}-{artifact['name']}.snapshot"
        for index, artifact in enumerate(result)
    ]
    observed_snapshot_paths = [str(artifact["relative_path"]) for artifact in result]
    if artifact_state == "sealed":
        if observed_snapshot_paths != expected_snapshot_paths:
            _fail("artifact_snapshot_inventory_invalid")
    elif any(path.startswith("sealed-") for path in observed_snapshot_paths):
        _fail("artifact_snapshot_inventory_invalid")
    return result


def validate_terminal_result(candidate: object) -> dict[str, object]:
    """Validate and detach one complete, canonical passed or failed result."""

    keys = (
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
    record = _exact_mapping(candidate, keys, "terminal_schema_invalid")
    if record["schema_version"] != TERMINAL_SCHEMA_VERSION:
        _fail("terminal_schema_invalid")
    artifact_state = record["artifact_state"]
    if artifact_state not in {"raw", "sealed"}:
        _fail("artifact_snapshot_inventory_invalid")
    attempt_id = _identifier(record["attempt_id"])
    outcome = record["outcome"]
    if outcome not in {"passed", "failed"}:
        _fail("terminal_outcome_invalid")
    if outcome == "passed":
        if record["failure_reason_code"] is not None:
            _fail("passed_result_has_failure")
        failure_reason = None
    else:
        failure_reason = _reason_code(record["failure_reason_code"])

    cases, observed_counts = _validate_cases(record["cases"])
    counts = _validate_counts(record["counts"], observed_counts)
    transport = _validate_transport(record["transport"])
    postgresql = _validate_postgresql(record["postgresql"])
    timings = _validate_timings(record["timings"], cases)
    teardown = _validate_teardown(record["teardown"])
    pki_public = _validate_pki_public(record["pki_public"], str(artifact_state))
    artifacts = _validate_artifacts(
        record["artifacts"], cases, str(outcome), str(artifact_state)
    )
    pki_paths = {str(item["relative_path"]) for item in pki_public["public_artifacts"]}
    artifact_paths = {str(item["relative_path"]) for item in artifacts}
    if pki_paths & artifact_paths:
        _fail("artifacts_invalid")

    cases_pass = counts["passed_count"] == 10
    transport_pass = _transport_passes(transport)
    postgresql_pass = _postgresql_passes(postgresql)
    all_pass = cases_pass and transport_pass and postgresql_pass
    if outcome == "passed":
        if not cases_pass:
            _fail("case_result_invalid")
        if not transport_pass:
            _fail("passed_transport_invalid")
        if not postgresql_pass:
            _fail("passed_postgresql_invalid")
    elif all_pass:
        _fail("failed_result_claims_pass")

    result: dict[str, object] = {
        "schema_version": TERMINAL_SCHEMA_VERSION,
        "artifact_state": artifact_state,
        "attempt_id": attempt_id,
        "outcome": outcome,
        "failure_reason_code": failure_reason,
        "repository_tuple": _validate_repository_tuple(record["repository_tuple"]),
        "authority": _validate_authority(record["authority"]),
        "b1": _validate_b1(record["b1"]),
        "counts": counts,
        "cases": cases,
        "transport": transport,
        "postgresql": postgresql,
        "timings": timings,
        "teardown": teardown,
        "pki_public": pki_public,
        "artifacts": artifacts,
    }
    return json.loads(canonical_json(result))  # detached canonical JSON value


def _directory_flags() -> int:
    if not hasattr(os, "O_DIRECTORY") or not hasattr(os, "O_NOFOLLOW"):
        _fail("descriptor_binding_unavailable")
    return os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)


def _open_absolute_directory(path: Path, reason: str) -> int:
    if not isinstance(path, Path) or not path.is_absolute() or ".." in path.parts:
        _fail(reason)
    descriptor = -1
    try:
        descriptor = os.open("/", _directory_flags())
        for component in path.parts[1:]:
            next_descriptor = os.open(component, _directory_flags(), dir_fd=descriptor)
            os.close(descriptor)
            descriptor = next_descriptor
        details = os.fstat(descriptor)
        if not stat.S_ISDIR(details.st_mode):
            _fail(reason)
        return descriptor
    except (OSError, ValueError, TypeError):
        if descriptor >= 0:
            os.close(descriptor)
        _fail(reason)


def _assert_directory_binding(path: Path, descriptor: int, reason: str) -> None:
    rebound = _open_absolute_directory(path, reason)
    try:
        expected = os.fstat(descriptor)
        observed = os.fstat(rebound)
        if (expected.st_dev, expected.st_ino) != (observed.st_dev, observed.st_ino):
            _fail(reason)
    finally:
        os.close(rebound)


def _open_evidence_root(path: Path) -> int:
    if _EVIDENCE_ROOT.fullmatch(path.name) is None:
        _fail("evidence_root_unsafe")
    descriptor = _open_absolute_directory(path, "evidence_root_unsafe")
    details = os.fstat(descriptor)
    if details.st_uid != os.geteuid() or stat.S_IMODE(details.st_mode) != 0o700:
        os.close(descriptor)
        _fail("evidence_root_unsafe")
    return descriptor


def _read_bound_artifact(
    root_fd: int, artifact: Mapping[str, object], *, namespace: str
) -> bytes:
    unsafe_reason = (
        "pki_public_artifact_unsafe" if namespace == "pki" else "artifact_unsafe"
    )
    rebound_reason = (
        "pki_public_artifact_rebound" if namespace == "pki" else "artifact_rebound"
    )
    digest_reason = (
        "pki_public_artifact_digest_mismatch"
        if namespace == "pki"
        else "artifact_digest_mismatch"
    )
    components = str(artifact["relative_path"]).split("/")
    directory_fd = os.dup(root_fd)
    file_fd = -1
    try:
        for component in components[:-1]:
            next_fd = os.open(component, _directory_flags(), dir_fd=directory_fd)
            os.close(directory_fd)
            directory_fd = next_fd
        file_fd = os.open(
            components[-1],
            os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0),
            dir_fd=directory_fd,
        )
        before = os.fstat(file_fd)
        named = os.stat(components[-1], dir_fd=directory_fd, follow_symlinks=False)
        if (
            not stat.S_ISREG(before.st_mode)
            or (before.st_dev, before.st_ino) != (named.st_dev, named.st_ino)
            or before.st_uid != os.geteuid()
            or before.st_mode & (stat.S_IWGRP | stat.S_IWOTH)
            or before.st_size > MAX_ARTIFACT_BYTES
            or before.st_size != artifact["size_bytes"]
        ):
            _fail(unsafe_reason)
        digest = hashlib.sha256()
        content = bytearray()
        remaining = MAX_ARTIFACT_BYTES + 1
        while remaining:
            block = os.read(file_fd, min(1024 * 1024, remaining))
            if not block:
                break
            digest.update(block)
            content.extend(block)
            remaining -= len(block)
        after = os.fstat(file_fd)
        named_after = os.stat(
            components[-1], dir_fd=directory_fd, follow_symlinks=False
        )
        if (
            remaining == 0
            or (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
            != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
            or (after.st_dev, after.st_ino) != (named_after.st_dev, named_after.st_ino)
        ):
            _fail(rebound_reason)
        if digest.hexdigest() != artifact["sha256"]:
            _fail(digest_reason)
        payload = bytes(content)
        if namespace == "artifact":
            try:
                text = payload.decode("utf-8")
            except UnicodeDecodeError:
                _fail("artifact_not_text")
            if evidence.secret_reason(text) is not None:
                _fail("artifact_secret_bearing")
        return payload
    except RuntimeEvidenceError:
        raise
    except (OSError, ValueError, TypeError):
        _fail(unsafe_reason)
    finally:
        if file_fd >= 0:
            os.close(file_fd)
        os.close(directory_fd)


def _validate_public_material(name: str, payload: bytes) -> None:
    try:
        text = payload.decode("ascii")
    except UnicodeDecodeError:
        _fail("pki_public_material_invalid")
    if name != "jwt_public_jwk":
        lines = text.splitlines()
        if (
            not text.endswith("\n")
            or len(lines) < 3
            or lines[0] != "-----BEGIN CERTIFICATE-----"
            or lines[-1] != "-----END CERTIFICATE-----"
            or any(
                re.fullmatch(r"[A-Za-z0-9+/=]+", line) is None for line in lines[1:-1]
            )
            or text.count("-----BEGIN CERTIFICATE-----") != 1
            or text.count("-----END CERTIFICATE-----") != 1
        ):
            _fail("pki_public_material_invalid")
        try:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            context.load_verify_locations(cadata=text)
        except (ssl.SSLError, ValueError):
            _fail("pki_public_material_invalid")
        if context.cert_store_stats().get("x509") != 1:
            _fail("pki_public_material_invalid")
        return

    def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
        if len(pairs) != len({key for key, _ in pairs}):
            _fail("pki_public_material_invalid")
        return dict(pairs)

    try:
        document = json.loads(text, object_pairs_hook=unique_object)
    except (json.JSONDecodeError, RuntimeEvidenceError):
        _fail("pki_public_material_invalid")
    if not isinstance(document, dict) or set(document) != {"keys"}:
        _fail("pki_public_material_invalid")
    keys = document["keys"]
    if not isinstance(keys, list) or len(keys) != 1 or not isinstance(keys[0], dict):
        _fail("pki_public_material_invalid")
    jwk = keys[0]
    if set(jwk) != {"alg", "crv", "kid", "kty", "x", "y"}:
        _fail("pki_public_material_invalid")
    if (
        jwk["alg"] != "ES256"
        or jwk["crv"] != "P-256"
        or jwk["kty"] != "EC"
        or not isinstance(jwk["kid"], str)
        or _IDENTIFIER.fullmatch(jwk["kid"]) is None
        or not isinstance(jwk["x"], str)
        or not isinstance(jwk["y"], str)
        or re.fullmatch(r"[A-Za-z0-9_-]{43}", jwk["x"]) is None
        or re.fullmatch(r"[A-Za-z0-9_-]{43}", jwk["y"]) is None
    ):
        _fail("pki_public_material_invalid")


def _seal_artifact(
    root_fd: int, artifact: Mapping[str, object], index: int
) -> dict[str, object]:
    payload = _read_bound_artifact(root_fd, artifact, namespace="artifact")
    snapshot_path = f"sealed-artifact-{index:02d}-{artifact['name']}.snapshot"
    snapshot_sha256 = _atomic_no_overwrite(root_fd, snapshot_path, payload)
    if snapshot_sha256 != artifact["sha256"] or len(payload) != artifact["size_bytes"]:
        _fail("artifact_digest_mismatch")
    return {**artifact, "relative_path": snapshot_path}


def _seal_pki_public_artifact(
    root_fd: int, artifact: Mapping[str, object], index: int
) -> dict[str, object]:
    name, source_path, snapshot_path = _PKI_PUBLIC_INVENTORY[index]
    if artifact["name"] != name or artifact["relative_path"] != source_path:
        _fail("pki_public_inventory_invalid")
    payload = _read_bound_artifact(root_fd, artifact, namespace="pki")
    _validate_public_material(name, payload)
    snapshot_sha256 = _atomic_no_overwrite(root_fd, snapshot_path, payload)
    if snapshot_sha256 != artifact["sha256"] or len(payload) != artifact["size_bytes"]:
        _fail("pki_public_artifact_digest_mismatch")
    return {**artifact, "relative_path": snapshot_path}


def _terminal_paths_absent(root_fd: int) -> None:
    for name in _TERMINAL_FILENAMES:
        try:
            os.stat(name, dir_fd=root_fd, follow_symlinks=False)
        except FileNotFoundError:
            continue
        except OSError:
            _fail("terminal_path_unsafe")
        _fail("terminal_path_exists")


def _write_all(descriptor: int, payload: bytes) -> None:
    offset = 0
    while offset < len(payload):
        written = os.write(descriptor, payload[offset:])
        if written <= 0:
            raise OSError("short write")
        offset += written


def _atomic_no_overwrite(root_fd: int, name: str, payload: bytes) -> str:
    temporary = f".{name}.{secrets.token_hex(16)}.tmp"
    descriptor = -1
    temporary_identity: tuple[int, int] | None = None
    failure_reason: str | None = None
    cleanup_failed = False
    try:
        descriptor = os.open(
            temporary,
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | os.O_NOFOLLOW
            | getattr(os, "O_CLOEXEC", 0),
            0o600,
            dir_fd=root_fd,
        )
        opened = os.fstat(descriptor)
        temporary_identity = (opened.st_dev, opened.st_ino)
        os.fchmod(descriptor, 0o600)
        _write_all(descriptor, payload)
        os.fsync(descriptor)
        details = os.fstat(descriptor)
        if not stat.S_ISREG(details.st_mode) or stat.S_IMODE(details.st_mode) != 0o600:
            _fail("terminal_write_failed")
        os.link(
            temporary,
            name,
            src_dir_fd=root_fd,
            dst_dir_fd=root_fd,
            follow_symlinks=False,
        )
        os.fsync(root_fd)
    except RuntimeEvidenceError as exc:
        failure_reason = exc.reason
    except FileExistsError:
        failure_reason = "terminal_path_exists"
    except (OSError, ValueError, TypeError):
        failure_reason = "terminal_write_failed"
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        if temporary_identity is not None:
            try:
                named = os.stat(temporary, dir_fd=root_fd, follow_symlinks=False)
                if (named.st_dev, named.st_ino) != temporary_identity:
                    cleanup_failed = True
                else:
                    os.unlink(temporary, dir_fd=root_fd)
                    os.fsync(root_fd)
            except (OSError, ValueError, TypeError):
                cleanup_failed = True
    if cleanup_failed:
        _fail("terminal_write_failed")
    if failure_reason is not None:
        _fail(failure_reason)
    try:
        final = os.stat(name, dir_fd=root_fd, follow_symlinks=False)
    except (OSError, ValueError, TypeError):
        _fail("terminal_write_failed")
    if not stat.S_ISREG(final.st_mode) or stat.S_IMODE(final.st_mode) != 0o600:
        _fail("terminal_write_failed")
    return hashlib.sha256(payload).hexdigest()


def _sealed_projection(raw_result: Mapping[str, object]) -> dict[str, object]:
    """Build and fully validate the deterministic terminal view without I/O."""

    public_artifacts = raw_result["pki_public"]["public_artifacts"]
    artifacts = raw_result["artifacts"]
    assert isinstance(public_artifacts, list)
    assert isinstance(artifacts, list)
    projected_public = [
        {**artifact, "relative_path": _PKI_PUBLIC_INVENTORY[index][2]}
        for index, artifact in enumerate(public_artifacts)
    ]
    projected_artifacts = [
        {
            **artifact,
            "relative_path": (
                f"sealed-artifact-{index:02d}-{artifact['name']}.snapshot"
            ),
        }
        for index, artifact in enumerate(artifacts)
    ]
    projection = {
        **raw_result,
        "artifact_state": "sealed",
        "pki_public": {
            **raw_result["pki_public"],
            "public_artifacts": projected_public,
        },
        "artifacts": projected_artifacts,
    }
    return validate_terminal_result(projection)


def _terminal_payloads(
    result: Mapping[str, object],
) -> tuple[bytes, bytes, bytes, str, str]:
    """Precompute every bounded canonical terminal payload before filesystem writes."""

    result_payload = canonical_json(result)
    teardown_record = {
        "schema_version": TEARDOWN_SCHEMA_VERSION,
        "attempt_id": result["attempt_id"],
        "terminal_outcome": result["outcome"],
        "resources": result["teardown"],
        "pki_public": result["pki_public"],
    }
    teardown_payload = canonical_json(teardown_record)
    result_sha256 = hashlib.sha256(result_payload).hexdigest()
    teardown_sha256 = hashlib.sha256(teardown_payload).hexdigest()
    sealed_artifacts = result["artifacts"]
    sealed_public_artifacts = result["pki_public"]["public_artifacts"]
    assert isinstance(sealed_artifacts, list)
    assert isinstance(sealed_public_artifacts, list)
    summary_record = {
        "schema_version": SUMMARY_SCHEMA_VERSION,
        "attempt_id": result["attempt_id"],
        "outcome": result["outcome"],
        "terminal_passed": result["outcome"] == "passed",
        "case_count": result["counts"]["case_count"],
        "passed_count": result["counts"]["passed_count"],
        "failed_count": result["counts"]["failed_count"],
        "not_run_count": result["counts"]["not_run_count"],
        "artifact_count": len(sealed_artifacts) + len(sealed_public_artifacts),
        "pki_public_artifact_count": len(sealed_public_artifacts),
        "artifact_manifest_sha256": hashlib.sha256(
            canonical_json(
                {
                    "runtime_artifacts": sealed_artifacts,
                    "pki_public_artifacts": sealed_public_artifacts,
                }
            )
        ).hexdigest(),
        "result_sha256": result_sha256,
        "teardown_sha256": teardown_sha256,
    }
    summary_payload = canonical_json(summary_record)
    return (
        result_payload,
        teardown_payload,
        summary_payload,
        result_sha256,
        teardown_sha256,
    )


def persist_terminal_evidence(
    evidence_root: Path, candidate: object
) -> PersistedTerminalEvidence:
    """Seal one terminal packet without overwriting or deleting any evidence."""

    raw_result = validate_terminal_result(candidate)
    if raw_result["artifact_state"] != "raw":
        _fail("artifact_snapshot_inventory_invalid")
    result = _sealed_projection(raw_result)
    (
        result_payload,
        teardown_payload,
        summary_payload,
        projected_result_sha256,
        projected_teardown_sha256,
    ) = _terminal_payloads(result)
    root_fd = _open_evidence_root(evidence_root)
    try:
        _assert_directory_binding(evidence_root, root_fd, "evidence_root_rebound")
        _terminal_paths_absent(root_fd)
        raw_public_artifacts = raw_result["pki_public"]["public_artifacts"]
        assert isinstance(raw_public_artifacts, list)
        sealed_public_artifacts: list[dict[str, object]] = []
        for index, artifact in enumerate(raw_public_artifacts):
            sealed_public_artifacts.append(
                _seal_pki_public_artifact(root_fd, artifact, index)
            )
            _assert_directory_binding(evidence_root, root_fd, "evidence_root_rebound")

        raw_artifacts = raw_result["artifacts"]
        assert isinstance(raw_artifacts, list)
        sealed_artifacts: list[dict[str, object]] = []
        for index, artifact in enumerate(raw_artifacts):
            sealed_artifacts.append(_seal_artifact(root_fd, artifact, index))
            _assert_directory_binding(evidence_root, root_fd, "evidence_root_rebound")

        if (
            sealed_public_artifacts != result["pki_public"]["public_artifacts"]
            or sealed_artifacts != result["artifacts"]
        ):
            _fail("artifact_snapshot_inventory_invalid")
        result_sha256 = _atomic_no_overwrite(root_fd, RESULT_FILENAME, result_payload)
        if result_sha256 != projected_result_sha256:
            _fail("terminal_write_failed")
        _assert_directory_binding(evidence_root, root_fd, "evidence_root_rebound")
        teardown_sha256 = _atomic_no_overwrite(
            root_fd, TEARDOWN_FILENAME, teardown_payload
        )
        if teardown_sha256 != projected_teardown_sha256:
            _fail("terminal_write_failed")
        _assert_directory_binding(evidence_root, root_fd, "evidence_root_rebound")
        summary_sha256 = _atomic_no_overwrite(
            root_fd, SUMMARY_FILENAME, summary_payload
        )
        _assert_directory_binding(evidence_root, root_fd, "evidence_root_rebound")
        os.fsync(root_fd)
        return PersistedTerminalEvidence(
            evidence_root=evidence_root,
            result_sha256=result_sha256,
            teardown_sha256=teardown_sha256,
            summary_sha256=summary_sha256,
        )
    finally:
        os.close(root_fd)
