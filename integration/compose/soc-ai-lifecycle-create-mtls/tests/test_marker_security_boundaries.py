"""RED tests for trusted, resource-bounded consumption-marker verification.

These tests use only pytest-owned temporary paths. They do not start the local
stack, invoke a subprocess, read credentials, or access the network.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import MappingProxyType

import pytest

from cybrik_suite_uat_mtls import runtime_authorization as authorization


_MAX_CONSUMPTION_MARKER_BYTES = 16 * 1024
_NOW = datetime(2026, 8, 2, 12, 0, tzinfo=UTC)


def _runtime_authorization(tmp_path: Path) -> authorization.RuntimeAuthorization:
    external_root = tmp_path / "outside"
    external_root.mkdir()
    return authorization.RuntimeAuthorization(
        authorization_id="d2-runtime-marker-boundaries",
        authorized_at=_NOW - timedelta(hours=1),
        expires_at=_NOW + timedelta(hours=1),
        now=_NOW,
        suite_root=tmp_path / "suite",
        suite_head="c" * 40,
        suite_admission_base="b" * 40,
        aggregate_sha256="d" * 64,
        authorization_sha256="a" * 64,
        exact_head_grant_sha256="e" * 64,
        runtime_root=external_root / "cybrik-uat-d2-runtime-marker-boundaries",
        evidence_root=external_root / "cybrik-uat-d2-evidence-marker-boundaries",
        product_roots=MappingProxyType({}),
    )


def _canonical_marker(record: dict[str, object], size: int) -> bytes:
    payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )
    assert len(payload) <= size
    return payload + (b" " * (size - len(payload)))


def test_marker_at_exact_size_limit_remains_accepted(tmp_path: Path) -> None:
    runtime = _runtime_authorization(tmp_path)
    record = authorization.consume_once(runtime)
    marker = runtime.evidence_root / authorization.CONSUMPTION_MARKER
    marker.write_bytes(_canonical_marker(record, _MAX_CONSUMPTION_MARKER_BYTES))

    assert authorization.verify_consumed(runtime) == record


def test_marker_over_size_limit_is_rejected_before_json_parsing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime = _runtime_authorization(tmp_path)
    record = authorization.consume_once(runtime)
    marker = runtime.evidence_root / authorization.CONSUMPTION_MARKER
    marker.write_bytes(
        _canonical_marker(record, _MAX_CONSUMPTION_MARKER_BYTES + 1)
    )
    parser_reached = False

    def unexpected_parse(payload: bytes) -> object:
        nonlocal parser_reached
        parser_reached = True
        raise AssertionError("oversized marker reached JSON parsing")

    monkeypatch.setattr(authorization.json, "loads", unexpected_parse)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumed(runtime)

    assert caught.value.reason == "authorization_consumption_mismatch"
    assert parser_reached is False


def test_rebuilt_marker_in_replaced_real_root_cannot_prove_consumption(
    tmp_path: Path,
) -> None:
    runtime = _runtime_authorization(tmp_path)
    original_record = authorization.consume_once(runtime)
    original_identity = original_record["evidence_root_identity"]

    preserved_original = runtime.evidence_root.with_name(
        "cybrik-uat-d2-evidence-marker-original"
    )
    runtime.evidence_root.rename(preserved_original)
    runtime.evidence_root.mkdir(mode=0o700)
    replacement_identity = runtime.evidence_root.stat()
    rebuilt_record = authorization._marker_record(runtime, replacement_identity)
    rebuilt_marker = runtime.evidence_root / authorization.CONSUMPTION_MARKER
    rebuilt_marker.write_bytes(
        json.dumps(
            rebuilt_record, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
    )
    rebuilt_marker.chmod(0o600)

    assert rebuilt_record["evidence_root_identity"] != original_identity
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumed(runtime)

    assert caught.value.reason == "authorization_consumption_mismatch"
