"""M3 branch coverage for terminal-integration pure refusal helpers."""

from __future__ import annotations

import json
import os
import stat
from collections.abc import Callable
from pathlib import Path

import pytest
from cybrik_suite_uat_mtls import terminal_integration as subject

HEX64 = "a" * 64


def _reason(call: Callable[[], object], expected: str) -> None:
    with pytest.raises(subject.TerminalIntegrationError) as caught:
        call()
    assert caught.value.reason == expected
    assert str(caught.value) == expected


@pytest.mark.parametrize("descriptor", (True, -1, "fd"))
def test_descriptor_open_rejects_invalid_return_values(
    descriptor: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(subject.os, "open", lambda *_args, **_kwargs: descriptor)
    _reason(
        lambda: subject._descriptor_open("ignored", os.O_RDONLY),
        "descriptor_transition_failed",
    )


@pytest.mark.parametrize("operation", ("open", "close", "fstat", "dup"))
def test_descriptor_wrappers_collapse_type_errors(
    operation: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*_args: object, **_kwargs: object) -> object:
        raise TypeError("synthetic")

    monkeypatch.setattr(subject.os, operation, fail)
    call = {
        "open": lambda: subject._descriptor_open("ignored", os.O_RDONLY),
        "close": lambda: subject._descriptor_close(1),
        "fstat": lambda: subject._descriptor_fstat(1),
        "dup": lambda: subject._descriptor_dup(1),
    }[operation]
    _reason(call, "descriptor_transition_failed")


def test_descriptor_metadata_and_duplicate_types_are_checked(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(subject.os, "fstat", lambda _fd: object())
    _reason(lambda: subject._descriptor_fstat(1), "descriptor_transition_failed")
    monkeypatch.setattr(subject.os, "dup", lambda _fd: True)
    _reason(lambda: subject._descriptor_dup(1), "descriptor_transition_failed")


@pytest.mark.parametrize(
    ("call", "reason"),
    (
        (lambda: subject._canonical_json({"bad": float("nan")}, "invalid"), "invalid"),
        (
            lambda: subject._canonical_record(
                "x" * subject.MAX_PENDING_HANDOFF_BYTES, "too_large"
            ),
            "too_large",
        ),
    ),
)
def test_canonical_serialization_boundaries(
    call: Callable[[], object], reason: str
) -> None:
    _reason(call, reason)


@pytest.mark.parametrize(
    "value",
    ("not-a-path", Path("relative"), Path("//tmp/value"), Path("/tmp/wrong-name")),
)
def test_safe_absolute_path_requires_canonical_matching_path(value: object) -> None:
    _reason(
        lambda: subject._safe_absolute_path(value, subject._RUNTIME_ROOT),
        "terminal_grant_mismatch",
    )


@pytest.mark.parametrize(
    "value",
    (None, True, -1),
)
def test_record_integer_rejects_non_integer_and_negative(value: object) -> None:
    _reason(lambda: subject._record_integer(value, "invalid"), "invalid")


@pytest.mark.parametrize(
    "value",
    (
        None,
        {"file_type": stat.S_IFDIR, "st_dev": 1, "st_ino": 2},
        {"file_type": stat.S_IFREG, "st_dev": True, "st_ino": 2},
    ),
)
def test_record_identity_requires_exact_regular_identity(value: object) -> None:
    _reason(
        lambda: subject._record_identity(
            value,
            expected_type=stat.S_IFREG,
            reason="invalid",
        ),
        "invalid",
    )


def _artifact(**changes: object) -> dict[str, object]:
    return {
        "file_type": stat.S_IFREG,
        "relative_path": "artifact.json",
        "sha256": HEX64,
        "size_bytes": 1,
        "st_dev": 1,
        "st_ino": 2,
        **changes,
    }


@pytest.mark.parametrize(
    "value",
    (
        None,
        _artifact(relative_path="/absolute"),
        _artifact(relative_path="dot/../path"),
        _artifact(relative_path=subject.PENDING_HANDOFF_FILENAME),
        _artifact(sha256="bad"),
        _artifact(size_bytes=subject.runtime_evidence.MAX_ARTIFACT_BYTES + 1),
        _artifact(file_type=stat.S_IFDIR),
    ),
)
def test_loaded_artifact_rejects_untrusted_pending_records(value: object) -> None:
    _reason(lambda: subject._loaded_artifact(value), "pending_handoff_invalid")


@pytest.mark.parametrize(
    "path",
    (
        Path("relative"),
        Path("/tmp/outside.json"),
        Path("/tmp/cybrik-uat-d2-evidence-unit"),
        Path("/tmp/cybrik-uat-d2-evidence-unit/terminal-result.json"),
        Path("/tmp/cybrik-uat-d2-evidence-unit/PKI-PUBLIC/file.json"),
    ),
)
def test_relative_artifact_rejects_outside_reserved_and_root_paths(path: Path) -> None:
    root = Path("/tmp/cybrik-uat-d2-evidence-unit")
    expected = (
        "artifact_reserved_namespace"
        if path.name == "file.json"
        else "artifact_outside_evidence_root"
    )
    _reason(lambda: subject._relative_artifact(path, root), expected)


@pytest.mark.parametrize(
    ("probe", "expected"),
    (
        (None, "live_teardown_probe_failed"),
        (
            lambda: (_ for _ in ()).throw(RuntimeError("synthetic")),
            "live_teardown_probe_failed",
        ),
        (dict, "live_teardown_incomplete"),
        (
            lambda: {key: False for key in subject._ABSENCE_KEYS},
            "live_teardown_incomplete",
        ),
    ),
)
def test_live_absence_probe_refusals_are_stable(probe: object, expected: str) -> None:
    _reason(lambda: subject._live_absence(probe), expected)  # type: ignore[arg-type]


def test_live_absence_returns_detached_exact_mapping() -> None:
    observed = {key: True for key in subject._ABSENCE_KEYS}
    result = subject._live_absence(lambda: observed)
    assert result == observed
    assert result is not observed


def test_candidate_rejects_non_mapping_and_wrong_authority() -> None:
    binding = subject._AuthorizationBinding(
        authorization_id="attempt",
        authorization_sha256=HEX64,
        exact_head_grant_sha256=None,
        suite_head=None,
        suite_admission_base="b" * 40,
        aggregate_sha256="c" * 64,
        runtime_root=Path("/tmp/cybrik-uat-d2-runtime-unit"),
        evidence_root=Path("/tmp/cybrik-uat-d2-evidence-unit"),
    )
    _reason(
        lambda: subject._candidate_payload([], binding, HEX64),
        "terminal_candidate_invalid",
    )
    _reason(
        lambda: subject._candidate_payload(
            {"attempt_id": "other", "authority": {}}, binding, HEX64
        ),
        "terminal_grant_mismatch",
    )


def test_marker_rejects_non_mapping_and_noncanonical_timestamp() -> None:
    binding = subject._AuthorizationBinding(
        authorization_id="attempt",
        authorization_sha256=HEX64,
        exact_head_grant_sha256=None,
        suite_head=None,
        suite_admission_base="b" * 40,
        aggregate_sha256="c" * 64,
        runtime_root=Path("/tmp/cybrik-uat-d2-runtime-unit"),
        evidence_root=Path("/tmp/cybrik-uat-d2-evidence-unit"),
    )
    _reason(
        lambda: subject._marker_digest(binding, [], (1, 2, stat.S_IFDIR)),
        "consumption_marker_mismatch",
    )
    marker = {
        "authorization_id": "attempt",
        "authorization_sha256": HEX64,
        # ``fromisoformat`` accepts ``Z`` but normalizes it to ``+00:00``.
        # The marker digest intentionally rejects that alternate spelling.
        "consumed_at": "2026-08-02T08:00:00Z",
        "evidence_root": str(binding.evidence_root),
        "evidence_root_identity": {"st_dev": 1, "st_ino": 2},
        "one_shot": True,
        "runtime_code_aggregate_sha256": binding.aggregate_sha256,
        "runtime_root": str(binding.runtime_root),
        "status": "consumed",
        "suite_admission_base": binding.suite_admission_base,
    }
    _reason(
        lambda: subject._marker_digest(binding, marker, (1, 2, stat.S_IFDIR)),
        "consumption_marker_mismatch",
    )


def test_read_bound_file_rejects_directory_and_os_read_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    directory_fd = os.open(tmp_path, os.O_RDONLY)
    try:
        _reason(
            lambda: subject._read_bound_file(
                directory_fd, reason="changed", maximum=10
            ),
            "changed",
        )
    finally:
        os.close(directory_fd)

    file_path = tmp_path / "artifact"
    file_path.write_bytes(b"x")
    file_fd = os.open(file_path, os.O_RDONLY)
    monkeypatch.setattr(
        subject.os, "read", lambda *_args: (_ for _ in ()).throw(OSError("synthetic"))
    )
    try:
        _reason(
            lambda: subject._read_bound_file(file_fd, reason="changed", maximum=10),
            "changed",
        )
    finally:
        os.close(file_fd)


def test_write_all_refuses_no_progress(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(subject.os, "write", lambda _fd, _payload: 0)
    with pytest.raises(OSError, match="write made no progress"):
        subject._write_all(1, b"payload")


def test_pending_candidate_json_requires_mapping(tmp_path: Path) -> None:
    root_fd = os.open(tmp_path, os.O_RDONLY)
    binding = subject._AuthorizationBinding(
        authorization_id="attempt",
        authorization_sha256=HEX64,
        exact_head_grant_sha256=None,
        suite_head=None,
        suite_admission_base="b" * 40,
        aggregate_sha256="c" * 64,
        runtime_root=Path("/tmp/cybrik-uat-d2-runtime-unit"),
        evidence_root=Path("/tmp/cybrik-uat-d2-evidence-unit"),
    )
    try:
        _reason(
            lambda: subject._persist_pending_handoff(
                root_fd,
                binding,
                (1, 2, stat.S_IFDIR),
                HEX64,
                json.dumps([]).encode() + b"\n",
                (),
                (),
            ),
            "terminal_candidate_invalid",
        )
        pending = tmp_path / subject.PENDING_HANDOFF_FILENAME
        # A failed immutable write is intentionally preserved as non-retryable
        # evidence.  The mutation is contained by pytest's temporary root.
        assert pending.is_file()
        assert stat.S_IMODE(pending.stat().st_mode) == 0o600
    finally:
        os.close(root_fd)
