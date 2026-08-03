from __future__ import annotations

import json
from dataclasses import FrozenInstanceError
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from types import ModuleType

import pytest


def _implementation() -> ModuleType:
    try:
        from cybrik_suite_integrated_uat import authorization_packet
    except (ImportError, ModuleNotFoundError) as exc:
        pytest.fail(
            "missing implementation: cybrik_suite_integrated_uat.authorization_packet",
            pytrace=False,
        )
        raise AssertionError from exc
    return authorization_packet


def _inputs(**changes: object) -> object:
    module = _implementation()
    values: dict[str, object] = {
        "authorization_id": "master-uat-20260803-001",
        "authorized_by": "FOUNDER",
        "issued_at": datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
        "expires_at": datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
        "b1_wheel": {
            "path": "/artifacts/cybrik_b1.whl",
            "sha256": "1" * 64,
        },
        "evidence_root": "/private/evidence/master",
        "external_roots": (
            {"capability": "postgres_d2_runtime", "root": "/private/d2-runtime"},
            {"capability": "postgres_d2_evidence", "root": "/private/d2-evidence"},
            {"capability": "alert_context_runtime", "root": "/private/alert-runtime"},
            {"capability": "alert_context_evidence", "root": "/private/alert-evidence"},
            {"capability": "alert_context_state", "root": "/private/alert-state"},
        ),
        "external_roots_sha256": "2" * 64,
        "helper_scripts": (
            {"path": "helper-a.py", "sha256": "3" * 64},
            {"path": "helper-b.py", "sha256": "4" * 64},
        ),
        "python": {"path": "/runtime/python", "sha256": "5" * 64},
        "repository_roots": (
            {"repository": "cybrik-soc-command-center", "root": "/repos/soc"},
            {"repository": "cybrik-cyber-ai-platform", "root": "/repos/ai"},
            {"repository": "cybrik-security-tool-fabric", "root": "/repos/fabric"},
            {"repository": "cybrik-suite", "root": "/repos/suite"},
        ),
        "repository_roots_sha256": "6" * 64,
        "repository_tuple": (
            ("suite", "a" * 40, "1" * 40),
            ("soc", "b" * 40, "2" * 40),
            ("cyber_ai", "c" * 40, "3" * 40),
            ("tool_fabric", "d" * 40, "4" * 40),
        ),
        "tracked_blob_aggregate": {
            "algorithm": "cybrik-uat-tracked-blob-sha256-lines/v1",
            "file_count": 311,
            "sha256": "7" * 64,
        },
    }
    values.update(changes)
    return module.MasterBindingInputs(**values)


def test_master_document_has_exact_runtime_verifier_schema() -> None:
    module = _implementation()

    document = module.master_document(_inputs())

    assert set(document) == {
        "authorization_id",
        "authorized_by",
        "b1_wheel",
        "decision",
        "evidence_root",
        "expires_at",
        "external_roots",
        "external_roots_sha256",
        "helper_scripts",
        "issued_at",
        "one_shot",
        "python",
        "repository_roots",
        "repository_roots_sha256",
        "schema",
        "tracked_blob_aggregate",
        "tuple",
    }
    assert document["schema"] == "CYBRIK-INTEGRATED-UAT-MASTER-AUTH/v1"
    assert document["decision"] == "APPROVE"
    assert document["one_shot"] is True
    assert tuple(document["tuple"]) == ("suite", "soc", "cyber_ai", "tool_fabric")


def test_canonical_payload_is_sorted_utf8_and_has_no_trailing_newline() -> None:
    module = _implementation()
    inputs = _inputs()

    payload = module.canonical_master_payload(inputs)

    assert isinstance(payload, bytes)
    assert not payload.endswith(b"\n")
    assert payload == json.dumps(
        module.master_document(inputs),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def test_builder_is_byte_deterministic_and_does_not_alias_returned_document() -> None:
    module = _implementation()
    inputs = _inputs()
    first = module.master_document(inputs)
    expected = module.canonical_master_payload(inputs)

    first["decision"] = "DENY"
    first["tuple"]["suite"]["commit"] = "f" * 40

    assert module.canonical_master_payload(inputs) == expected
    assert module.master_document(inputs)["decision"] == "APPROVE"


def test_binding_inputs_are_frozen() -> None:
    inputs = _inputs()

    with pytest.raises(FrozenInstanceError):
        inputs.authorization_id = "changed"


def test_timestamp_offsets_normalize_to_identical_utc_bytes() -> None:
    module = _implementation()
    utc_inputs = _inputs()
    offset = timezone(timedelta(hours=7))
    offset_inputs = _inputs(
        issued_at=datetime(2026, 8, 3, 7, 0, tzinfo=offset),
        expires_at=datetime(2026, 8, 3, 8, 0, tzinfo=offset),
    )

    assert module.canonical_master_payload(
        offset_inputs
    ) == module.canonical_master_payload(utc_inputs)


@pytest.mark.parametrize(
    ("issued_at", "expires_at"),
    (
        (
            datetime.fromisoformat("2026-08-03T00:00:00"),
            datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
        ),
        (
            datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
            datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
        ),
        (
            datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
            datetime(2026, 8, 4, 0, 0, 0, 1, tzinfo=UTC),
        ),
    ),
)
def test_timestamp_window_must_be_aware_positive_and_at_most_24_hours(
    issued_at: datetime, expires_at: datetime
) -> None:
    module = _implementation()

    with pytest.raises(
        module.AuthorizationPacketError, match="timestamp_window_invalid"
    ):
        module.canonical_master_payload(
            _inputs(issued_at=issued_at, expires_at=expires_at)
        )


def test_pure_builder_performs_no_filesystem_process_or_signing_effects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _implementation()

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("pure packet builder attempted an external effect")

    monkeypatch.setattr("builtins.open", forbidden)
    monkeypatch.setattr("subprocess.run", forbidden)
    monkeypatch.setattr("subprocess.Popen", forbidden)
    monkeypatch.setattr("os.open", forbidden)

    payload = module.canonical_master_payload(_inputs())

    assert payload.startswith(b'{"authorization_id"')
    assert b"private_key" not in payload.lower()
    assert b"signature" not in payload.lower()
    assert b"consumption" not in payload.lower()


def test_paths_remain_textual_bindings_and_are_not_resolved_by_builder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _implementation()

    def forbidden_resolve(*_args: object, **_kwargs: object) -> Path:
        raise AssertionError("pure packet builder resolved a path")

    monkeypatch.setattr(Path, "resolve", forbidden_resolve)

    document = module.master_document(_inputs())

    assert document["evidence_root"] == "/private/evidence/master"
