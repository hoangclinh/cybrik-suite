"""RED tests for trusted, resource-bounded consumption-marker verification.

These tests use only pytest-owned temporary paths. They do not start the local
stack, invoke a subprocess, read credentials, or access the network.
"""

from __future__ import annotations

import json
import os
import stat
import sys
from dataclasses import fields, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import MappingProxyType

import pytest
from cybrik_suite_uat_mtls import runtime_authorization as authorization

_MAX_CONSUMPTION_MARKER_BYTES = authorization.MAX_CONSUMPTION_MARKER_BYTES
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
    payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode("utf-8")
    assert len(payload) <= size
    return payload + (b" " * (size - len(payload)))


def _identity(path: Path) -> authorization.DirectoryIdentity:
    details = path.stat(follow_symlinks=False)
    return authorization.DirectoryIdentity(
        mode=f"{stat.S_IMODE(details.st_mode):04o}",
        st_dev=details.st_dev,
        st_ino=details.st_ino,
        uid=details.st_uid,
    )


def _root_binding(
    role: str, path: Path, inventory: tuple[str, ...] = ()
) -> authorization.RootBinding:
    return authorization.RootBinding(
        role=role,
        path=path,
        identity=_identity(path),
        inventory=inventory,
    )


def _prepared_runtime_authorization(
    tmp_path: Path,
) -> authorization.RuntimeAuthorization:
    runtime = _runtime_authorization(tmp_path)
    runtime.runtime_root.mkdir(mode=0o700)
    pki_root = runtime.runtime_root / authorization.PREPARED_PKI_LEAF
    pki_root.mkdir(mode=0o700)
    runtime.evidence_root.mkdir(mode=0o700)
    prepared = authorization.PreparedRoots(
        receipt_sha256="7" * 64,
        evidence=_root_binding("evidence", runtime.evidence_root),
        pki=_root_binding("pki", pki_root),
        runtime=_root_binding(
            "runtime", runtime.runtime_root, (authorization.PREPARED_PKI_LEAF,)
        ),
    )
    return replace(runtime, prepared_roots=prepared)


def test_marker_path_uses_no_unsigned_adjacent_receipt_ledger() -> None:
    forbidden = {
        "CONSUMPTION_RECEIPT_SUFFIX",
        "CONSUMPTION_RECEIPT_VERSION",
        "_open_trusted_receipt_parent",
        "_read_consumption_receipt",
        "_trusted_receipt_path",
        "_write_consumption_receipt",
    }
    runtime_fields = {
        field.name for field in fields(authorization.RuntimeAuthorization)
    }

    assert forbidden.isdisjoint(vars(authorization))
    assert "consumption_receipt_path" not in runtime_fields


def test_successful_consume_and_verify_use_the_signed_prepared_evidence_identity(
    tmp_path: Path,
) -> None:
    runtime = _prepared_runtime_authorization(tmp_path)
    expected = runtime.prepared_roots
    assert expected is not None

    record = authorization.consume_once(runtime)

    assert record["evidence_root_identity"] == {
        "st_dev": expected.evidence.identity.st_dev,
        "st_ino": expected.evidence.identity.st_ino,
    }
    assert authorization.verify_consumed(runtime) == record


def test_prepared_evidence_identity_mismatch_has_a_precise_stable_reason(
    tmp_path: Path,
) -> None:
    runtime = _prepared_runtime_authorization(tmp_path)
    prepared = runtime.prepared_roots
    assert prepared is not None
    mismatched_identity = replace(
        prepared.evidence.identity,
        st_ino=prepared.evidence.identity.st_ino + 1,
    )
    mismatched_evidence = replace(
        prepared.evidence,
        identity=mismatched_identity,
    )
    mismatched_runtime = replace(
        runtime,
        prepared_roots=replace(prepared, evidence=mismatched_evidence),
    )

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.consume_once(mismatched_runtime)

    assert caught.value.reason == "authorization_consumption_mismatch"


def test_consume_once_refuses_a_stale_evidence_inventory_before_writing_the_marker(
    tmp_path: Path,
) -> None:
    """A prepared evidence root that already holds material is never consumable."""

    runtime = _prepared_runtime_authorization(tmp_path)
    stale = runtime.evidence_root / "case-n1.json"
    stale.write_text("{}", encoding="utf-8")

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.consume_once(runtime)

    assert caught.value.reason == "authorization_consumption_mismatch"
    assert not (runtime.evidence_root / authorization.CONSUMPTION_MARKER).exists()
    assert stale.read_text(encoding="utf-8") == "{}"


def test_consume_once_refuses_a_symlinked_leaf_in_the_prepared_evidence_root(
    tmp_path: Path,
) -> None:
    """A symlinked leaf is unverifiable material, never an empty prepared root."""

    runtime = _prepared_runtime_authorization(tmp_path)
    target = tmp_path / "outside-target"
    target.mkdir()
    link = runtime.evidence_root / "escape"
    link.symlink_to(target, target_is_directory=True)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.consume_once(runtime)

    assert caught.value.reason == "authorization_consumption_mismatch"
    assert not (runtime.evidence_root / authorization.CONSUMPTION_MARKER).exists()
    assert link.is_symlink()
    assert target.is_dir()


def test_consume_once_refuses_a_receipt_that_understates_the_runtime_inventory(
    tmp_path: Path,
) -> None:
    """The bound receipt itself must declare the exact one-shot initial roots."""

    runtime = _prepared_runtime_authorization(tmp_path)
    prepared = runtime.prepared_roots
    assert prepared is not None
    understated = replace(
        runtime,
        prepared_roots=replace(
            prepared, runtime=replace(prepared.runtime, inventory=())
        ),
    )

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.consume_once(understated)

    assert caught.value.reason == "authorization_consumption_mismatch"
    assert not (runtime.evidence_root / authorization.CONSUMPTION_MARKER).exists()


def test_second_consumption_keeps_its_precise_one_shot_reason(tmp_path: Path) -> None:
    """The marker this boundary wrote is not read back as foreign drift."""

    runtime = _prepared_runtime_authorization(tmp_path)
    record = authorization.consume_once(runtime)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.consume_once(runtime)

    assert caught.value.reason == "authorization_already_consumed"
    assert authorization.verify_consumed(runtime) == record


@pytest.mark.skipif(sys.platform != "darwin", reason="macOS canonical-path contract")
def test_private_var_canonical_path_opens_without_var_symlink_traversal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    canonical = tmp_path.resolve(strict=True)
    assert str(canonical).startswith("/private/var/")
    opened: list[str] = []
    real_open = os.open

    def observe_open(
        path: os.PathLike[str] | str | bytes,
        flags: int,
        mode: int = 0o777,
        *,
        dir_fd: int | None = None,
    ) -> int:
        opened.append(os.fsdecode(path))
        if dir_fd is None:
            return real_open(path, flags, mode)
        return real_open(path, flags, mode, dir_fd=dir_fd)

    monkeypatch.setattr(authorization.os, "open", observe_open)
    descriptor = authorization._open_directory_without_symlinks(canonical)
    os.close(descriptor)

    assert opened[0] == "/"
    assert opened[1] == "private"
    assert opened[1] != "var"


def test_marker_at_exact_size_limit_remains_accepted(tmp_path: Path) -> None:
    runtime = _prepared_runtime_authorization(tmp_path)
    record = authorization.consume_once(runtime)
    marker = runtime.evidence_root / authorization.CONSUMPTION_MARKER
    marker.write_bytes(_canonical_marker(record, _MAX_CONSUMPTION_MARKER_BYTES))

    assert authorization.verify_consumed(runtime) == record


def test_marker_over_size_limit_is_rejected_before_json_parsing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime = _prepared_runtime_authorization(tmp_path)
    record = authorization.consume_once(runtime)
    marker = runtime.evidence_root / authorization.CONSUMPTION_MARKER
    marker.write_bytes(_canonical_marker(record, _MAX_CONSUMPTION_MARKER_BYTES + 1))
    parser_reached = False
    real_loads = json.loads

    def unexpected_parse(payload: bytes) -> object:
        nonlocal parser_reached
        if len(payload) > _MAX_CONSUMPTION_MARKER_BYTES:
            parser_reached = True
            raise AssertionError("oversized marker reached JSON parsing")
        return real_loads(payload)

    monkeypatch.setattr(authorization.json, "loads", unexpected_parse)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumed(runtime)

    assert caught.value.reason == "authorization_consumption_mismatch"
    assert parser_reached is False


def test_rebuilt_marker_in_replaced_real_root_cannot_prove_consumption(
    tmp_path: Path,
) -> None:
    runtime = _prepared_runtime_authorization(tmp_path)
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
        json.dumps(rebuilt_record, sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
    )
    rebuilt_marker.chmod(0o600)

    assert rebuilt_record["evidence_root_identity"] != original_identity
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumed(runtime)

    assert caught.value.reason == "authorization_consumption_mismatch"
