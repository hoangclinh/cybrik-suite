"""Tests for the runtime-memory-only exact secret inventory (D2 N10 support).

The inventory registers raw runtime secret values (delegation tokens, cnf
thumbprints, DSN passwords, private-key material) only in process memory and
exposes nothing but stable labels/counts/digests. All fixtures below are
synthetic placeholders assembled at runtime; no real credential, key or token
appears in this file, and nothing here performs any runtime action, socket,
subprocess, Docker, database or PKI operation.
"""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path

import pytest

from cybrik_suite_uat_mtls import evidence, secret_inventory as si

_DASHES = "-" * 5
_PEM_PRIVATE = (
    f"{_DASHES}BEGIN {'PRIVATE'} {'KEY'}{_DASHES}\nAAAA\n{_DASHES}END "
    f"{'PRIVATE'} {'KEY'}{_DASHES}"
)
_OPAQUE_DELEGATION_TOKEN = "svc-d2-opaque-" + "A" * 40
_JWT_SHAPED = "AAAAAAAAAA.BBBBBBBBBB.CCCCCCCCCC"
_CNF_THUMBPRINT = "b" * 64
_DB_PASSWORD = "p" * 32


# --------------------------------------------------------------------------
# register / labels / summary
# --------------------------------------------------------------------------


def test_register_returns_a_stable_handle_with_digest_and_byte_count() -> None:
    inventory = si.SecretInventory()

    handle = inventory.register("delegation_token", _OPAQUE_DELEGATION_TOKEN)

    assert handle.label == "delegation_token"
    assert handle.byte_count == len(_OPAQUE_DELEGATION_TOKEN.encode("utf-8"))
    import hashlib

    assert handle.digest_sha256 == hashlib.sha256(
        _OPAQUE_DELEGATION_TOKEN.encode("utf-8")
    ).hexdigest()


def test_register_accepts_both_str_and_bytes_and_normalizes_internally() -> None:
    inventory = si.SecretInventory()

    text_handle = inventory.register("cnf_thumbprint", _CNF_THUMBPRINT)
    byte_handle = inventory.register(
        "private_key_bytes", _PEM_PRIVATE.encode("utf-8")
    )

    assert text_handle.byte_count == len(_CNF_THUMBPRINT)
    assert byte_handle.byte_count == len(_PEM_PRIVATE.encode("utf-8"))


def test_register_rejects_duplicate_label() -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)

    with pytest.raises(si.SecretInventoryError, match="already registered"):
        inventory.register("db_password", _DB_PASSWORD)


def test_register_rejects_empty_value() -> None:
    inventory = si.SecretInventory()

    with pytest.raises(si.SecretInventoryError, match="empty"):
        inventory.register("db_password", "")


@pytest.mark.parametrize("label", ("", "Bad-Label", "1leading-digit", "a" * 129))
def test_register_rejects_invalid_label_shape(label: str) -> None:
    inventory = si.SecretInventory()

    with pytest.raises(si.SecretInventoryError, match="label"):
        inventory.register(label, _DB_PASSWORD)


def test_labels_returns_registration_order() -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    inventory.register("cnf_thumbprint", _CNF_THUMBPRINT)

    assert inventory.labels() == ("db_password", "cnf_thumbprint")


def test_summary_exposes_only_labels_counts_and_digests_and_passes_evidence_gate() -> (
    None
):
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    inventory.register("cnf_thumbprint", _CNF_THUMBPRINT)

    summary = inventory.summary()

    assert summary["secret_label_count"] == 2
    assert _DB_PASSWORD not in json.dumps(summary)
    assert _CNF_THUMBPRINT not in json.dumps(summary)
    validated = evidence.validate_evidence(summary)
    assert validated == summary


# --------------------------------------------------------------------------
# never-leak guarantees
# --------------------------------------------------------------------------


def test_repr_and_str_never_contain_a_raw_registered_secret_value() -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)

    assert _DB_PASSWORD not in repr(inventory)
    assert _DB_PASSWORD not in str(inventory)


def test_inventory_object_is_not_json_serializable() -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)

    with pytest.raises(TypeError):
        json.dumps(inventory)


def test_secret_handle_repr_never_contains_the_raw_value() -> None:
    inventory = si.SecretInventory()
    handle = inventory.register("db_password", _DB_PASSWORD)

    assert _DB_PASSWORD not in repr(handle)


# --------------------------------------------------------------------------
# clear / zeroize
# --------------------------------------------------------------------------


def test_clear_zeroizes_the_underlying_buffer_in_place_and_empties_the_inventory() -> (
    None
):
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    buffer = inventory._values["db_password"]  # noqa: SLF001 - white-box zeroize proof
    assert bytes(buffer) == _DB_PASSWORD.encode("utf-8")

    inventory.clear()

    assert all(byte == 0 for byte in buffer)
    assert inventory.labels() == ()
    assert inventory.summary()["secret_label_count"] == 0


# --------------------------------------------------------------------------
# scan_text / scan_bytes
# --------------------------------------------------------------------------


def test_scan_text_returns_none_for_secret_free_text() -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)

    assert inventory.scan_text("nothing sensitive here") is None


def test_scan_text_detects_generic_jwt_shape_without_any_registration() -> None:
    inventory = si.SecretInventory()

    assert inventory.scan_text(f"token={_JWT_SHAPED}") == evidence.JWT_VALUE


def test_scan_detects_unlabeled_opaque_delegation_token_via_exact_registration() -> (
    None
):
    inventory = si.SecretInventory()
    inventory.register("delegation_token", _OPAQUE_DELEGATION_TOKEN)
    unlabeled = f"trace: request completed with id {_OPAQUE_DELEGATION_TOKEN} ok"

    assert evidence.secret_reason(unlabeled) is None
    assert inventory.scan_text(unlabeled) == si.EXACT_SECRET_MATCH


def test_scan_detects_unlabeled_cnf_thumbprint_via_exact_registration_only() -> None:
    inventory = si.SecretInventory()
    inventory.register("cnf_thumbprint", _CNF_THUMBPRINT)
    unlabeled = f"observed digest {_CNF_THUMBPRINT} during replay"

    assert evidence.secret_reason(unlabeled) is None
    assert inventory.scan_text(unlabeled) == si.EXACT_SECRET_MATCH


def test_scan_text_does_not_false_positive_on_unregistered_random_hex_digest() -> (
    None
):
    inventory = si.SecretInventory()
    inventory.register("cnf_thumbprint", _CNF_THUMBPRINT)

    assert inventory.scan_text("safe digest " + "c" * 64) is None


def test_scan_text_does_not_false_positive_when_secret_is_split_by_other_content() -> (
    None
):
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    half = len(_DB_PASSWORD) // 2
    split = _DB_PASSWORD[:half] + "\n---\n" + _DB_PASSWORD[half:]

    assert inventory.scan_text(split) is None


def test_scan_bytes_detects_exact_secret_inside_a_binary_payload_without_raising() -> (
    None
):
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    payload = b"\x00\x01\xff\xfe" + _DB_PASSWORD.encode("ascii") + b"\x00\x02"

    assert inventory.scan_bytes(payload) == si.EXACT_SECRET_MATCH


def test_scan_bytes_handles_non_utf8_content_without_raising() -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    payload = b"\xff\xfe\x00\x01not-utf8-and-secret-free"

    assert inventory.scan_bytes(payload) is None


def test_scan_bytes_rejects_oversized_input(monkeypatch: pytest.MonkeyPatch) -> None:
    inventory = si.SecretInventory()
    monkeypatch.setattr(si, "MAX_SCAN_TEXT_BYTES", 8)

    with pytest.raises(si.SecretInventoryError, match="bounded size"):
        inventory.scan_bytes(b"0123456789")


def test_scan_text_rejects_oversized_input(monkeypatch: pytest.MonkeyPatch) -> None:
    inventory = si.SecretInventory()
    monkeypatch.setattr(si, "MAX_SCAN_TEXT_BYTES", 8)

    with pytest.raises(si.SecretInventoryError, match="bounded size"):
        inventory.scan_text("0123456789")


# --------------------------------------------------------------------------
# scan_tree (bounded artifact walk)
# --------------------------------------------------------------------------


def test_scan_tree_returns_no_findings_for_a_clean_tree(tmp_path: Path) -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    (tmp_path / "clean.txt").write_text("nothing sensitive", encoding="utf-8")
    (tmp_path / "nested").mkdir()
    (tmp_path / "nested/also-clean.txt").write_text("still clean", encoding="utf-8")

    assert inventory.scan_tree(tmp_path) == ()


def test_scan_tree_detects_an_exact_secret_in_a_nested_file(tmp_path: Path) -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    (tmp_path / "nested").mkdir()
    artifact = tmp_path / "nested/leak.txt"
    artifact.write_text(f"dsn password was {_DB_PASSWORD}", encoding="utf-8")

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 1
    assert findings[0].relative_path == "nested/leak.txt"
    assert findings[0].reason == si.EXACT_SECRET_MATCH
    assert findings[0].label == "db_password"


def test_scan_tree_detects_generic_secret_shapes_without_registration(
    tmp_path: Path,
) -> None:
    inventory = si.SecretInventory()
    (tmp_path / "leak.txt").write_text(f"token={_JWT_SHAPED}", encoding="utf-8")

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 1
    assert findings[0].reason == evidence.JWT_VALUE
    assert findings[0].label is None


def test_scan_tree_flags_a_symlink_as_a_finding_without_following_it(
    tmp_path: Path,
) -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    outside = tmp_path.parent / "outside-secret.txt"
    outside.write_text(_DB_PASSWORD, encoding="utf-8")
    link = tmp_path / "escape-link.txt"
    link.symlink_to(outside)

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 1
    assert findings[0].relative_path == "escape-link.txt"
    assert findings[0].reason == si.SYMLINK_NOT_PERMITTED
    assert findings[0].label is None
    outside.unlink()


def test_scan_tree_flags_a_non_regular_file_without_blocking(tmp_path: Path) -> None:
    inventory = si.SecretInventory()
    fifo_path = tmp_path / "pipe"
    os.mkfifo(fifo_path)

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 1
    assert findings[0].relative_path == "pipe"
    assert findings[0].reason == si.NON_REGULAR_FILE_NOT_PERMITTED


def test_scan_tree_flags_an_oversized_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    inventory = si.SecretInventory()
    monkeypatch.setattr(si, "MAX_SCAN_FILE_BYTES", 4)
    (tmp_path / "big.txt").write_text("this-is-too-big", encoding="utf-8")

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 1
    assert findings[0].reason == si.FILE_TOO_LARGE


def test_scan_tree_raises_when_the_file_count_bound_is_exceeded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    inventory = si.SecretInventory()
    monkeypatch.setattr(si, "MAX_SCAN_FILE_COUNT", 1)
    (tmp_path / "a.txt").write_text("a", encoding="utf-8")
    (tmp_path / "b.txt").write_text("b", encoding="utf-8")

    with pytest.raises(si.SecretInventoryError, match="file-count bound"):
        inventory.scan_tree(tmp_path)


def test_scan_tree_rejects_a_relative_root() -> None:
    inventory = si.SecretInventory()

    with pytest.raises(si.SecretInventoryError, match="absolute"):
        inventory.scan_tree(Path("relative/root"))


def test_scan_tree_rejects_a_symlinked_root(tmp_path: Path) -> None:
    inventory = si.SecretInventory()
    real_root = tmp_path / "real"
    real_root.mkdir()
    link_root = tmp_path / "link"
    link_root.symlink_to(real_root)

    with pytest.raises(si.SecretInventoryError, match="symlink"):
        inventory.scan_tree(link_root)


def test_scan_tree_raises_on_an_unsafe_toctou_path_change(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    inventory = si.SecretInventory()
    (tmp_path / "artifact.txt").write_text("clean", encoding="utf-8")

    def _raise_open(*_args: object, **_kwargs: object) -> int:
        raise OSError("synthetic symlink race")

    monkeypatch.setattr(si.os, "open", _raise_open)

    with pytest.raises(si.SecretInventoryError, match="safely"):
        inventory.scan_tree(tmp_path)


# --------------------------------------------------------------------------
# remediation contract
# --------------------------------------------------------------------------


def test_remediation_plan_quarantines_exact_matches_and_deletes_generic_matches() -> (
    None
):
    exact = si.ScanFinding("leak.txt", si.EXACT_SECRET_MATCH, "db_password")
    generic = si.ScanFinding("other.txt", evidence.JWT_VALUE, None)

    assert si.remediation_plan_for(exact).action == si.QUARANTINE
    assert si.remediation_plan_for(generic).action == si.DELETE


def test_apply_remediation_deletes_the_artifact_and_returns_a_sanitized_record(
    tmp_path: Path,
) -> None:
    artifact = tmp_path / "leak.txt"
    artifact.write_text(_DB_PASSWORD, encoding="utf-8")
    finding = si.ScanFinding("leak.txt", si.EXACT_SECRET_MATCH, "db_password")

    record = si.apply_remediation(tmp_path, finding)

    assert not artifact.exists()
    assert record == {
        "action": si.QUARANTINE,
        "label": "db_password",
        "reason": si.EXACT_SECRET_MATCH,
        "relative_path": "leak.txt",
    }
    assert evidence.validate_evidence(record) == record


def test_apply_remediation_deletes_a_generic_match_artifact(tmp_path: Path) -> None:
    artifact = tmp_path / "other.txt"
    artifact.write_text(f"token={_JWT_SHAPED}", encoding="utf-8")
    finding = si.ScanFinding("other.txt", evidence.JWT_VALUE, None)

    record = si.apply_remediation(tmp_path, finding)

    assert not artifact.exists()
    assert record["action"] == si.DELETE
    assert "label" not in record


def test_apply_remediation_moves_quarantined_artifacts_into_the_quarantine_root(
    tmp_path: Path,
) -> None:
    root = tmp_path / "evidence"
    root.mkdir()
    quarantine = tmp_path / "quarantine"
    (root / "nested").mkdir()
    artifact = root / "nested/leak.txt"
    artifact.write_text(_DB_PASSWORD, encoding="utf-8")
    finding = si.ScanFinding("nested/leak.txt", si.EXACT_SECRET_MATCH, "db_password")

    si.apply_remediation(root, finding, quarantine_root=quarantine)

    assert not artifact.exists()
    quarantined = quarantine / "nested/leak.txt"
    assert quarantined.is_file()
    assert quarantined.read_text(encoding="utf-8") == _DB_PASSWORD
    assert stat.S_IMODE(quarantined.stat().st_mode) == 0o600


def test_apply_remediation_refuses_a_symlinked_target(tmp_path: Path) -> None:
    outside = tmp_path.parent / "outside-remediation.txt"
    outside.write_text(_DB_PASSWORD, encoding="utf-8")
    link = tmp_path / "leak.txt"
    link.symlink_to(outside)
    finding = si.ScanFinding("leak.txt", si.EXACT_SECRET_MATCH, "db_password")

    with pytest.raises(si.SecretInventoryError, match="symlink"):
        si.apply_remediation(tmp_path, finding)
    outside.unlink()


def test_apply_remediation_refuses_a_path_that_escapes_the_root(
    tmp_path: Path,
) -> None:
    finding = si.ScanFinding("../escape.txt", si.EXACT_SECRET_MATCH, "db_password")

    with pytest.raises(si.SecretInventoryError, match="escapes"):
        si.apply_remediation(tmp_path, finding)
