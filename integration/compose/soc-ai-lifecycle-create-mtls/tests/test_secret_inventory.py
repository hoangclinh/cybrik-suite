"""Tests for the runtime-memory-only exact secret inventory (D2 N10 support).

The inventory registers raw runtime secret values (delegation tokens, cnf
thumbprints, DSN passwords, private-key material) only in process memory and
exposes nothing but stable labels/counts/digests. All fixtures below are
synthetic placeholders assembled at runtime; no real credential, key or token
appears in this file, and nothing here performs any runtime action, socket,
subprocess, Docker, database or PKI operation.
"""

from __future__ import annotations

import copy
import errno
import hashlib
import hmac
import json
import os
import pickle
from dataclasses import asdict
from pathlib import Path

import pytest

from cybrik_suite_uat_mtls import evidence
from cybrik_suite_uat_mtls import secret_inventory as si

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
    assert (
        handle.digest_sha256
        == hashlib.sha256(_OPAQUE_DELEGATION_TOKEN.encode("utf-8")).hexdigest()
    )


def test_register_accepts_both_str_and_bytes_and_normalizes_internally() -> None:
    inventory = si.SecretInventory()

    text_handle = inventory.register("cnf_thumbprint", _CNF_THUMBPRINT)
    byte_handle = inventory.register("private_key_bytes", _PEM_PRIVATE.encode("utf-8"))

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

    assert summary["registered_label_count"] == 2
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
    buffer = inventory._values["db_password"]
    assert bytes(buffer) == _DB_PASSWORD.encode("utf-8")

    inventory.clear()

    assert all(byte == 0 for byte in buffer)
    assert inventory.labels() == ()
    assert inventory.summary()["registered_label_count"] == 0


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


def test_scan_text_does_not_false_positive_on_unregistered_random_hex_digest() -> None:
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


def test_path_component_matching_and_ids_use_filesystem_encoded_bytes() -> None:
    inventory = si.SecretInventory()
    raw_component = b"artifact-\xff"
    decoded_component = os.fsdecode(raw_component)
    inventory.register("raw_filename_fragment", b"\xff")
    artifact_id_key = b"k" * 32

    assert inventory._path_match((decoded_component,)) == (
        si.EXACT_SECRET_MATCH,
        "raw_filename_fragment",
    )
    locator = si._ArtifactLocator(
        decoded_component, artifact_id_key=artifact_id_key
    )
    assert locator.artifact_id == hmac.new(
        artifact_id_key,
        os.fsencode(decoded_component),
        hashlib.sha256,
    ).hexdigest()


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
    assert findings[0].artifact_id == hashlib.sha256(b"nested/leak.txt").hexdigest()
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
    assert findings[0].artifact_id == hashlib.sha256(b"escape-link.txt").hexdigest()
    assert findings[0].reason == si.SYMLINK_NOT_PERMITTED
    assert findings[0].label is None
    outside.unlink()


def test_scan_tree_flags_a_non_regular_file_without_blocking(tmp_path: Path) -> None:
    inventory = si.SecretInventory()
    fifo_path = tmp_path / "pipe"
    os.mkfifo(fifo_path)

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 1
    assert findings[0].artifact_id == hashlib.sha256(b"pipe").hexdigest()
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


def test_scan_tree_counts_directories_and_symlinks_toward_the_entry_bound(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    inventory = si.SecretInventory()
    monkeypatch.setattr(si, "MAX_SCAN_FILE_COUNT", 1)
    directory = tmp_path / "directory"
    directory.mkdir()
    (tmp_path / "link").symlink_to(directory, target_is_directory=True)

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


def test_scan_tree_wraps_resolve_failure_without_exposing_the_root_path(
    tmp_path: Path,
) -> None:
    raw_component = f"missing-{_DB_PASSWORD}"
    missing_root = tmp_path / raw_component

    with pytest.raises(si.SecretInventoryError) as caught:
        si.SecretInventory().scan_tree(missing_root)

    rendered = "|".join(
        (
            str(caught.value),
            repr(caught.value),
            repr(caught.value.args),
            repr(caught.value.__cause__),
            repr(caught.value.__context__),
        )
    )
    assert raw_component not in rendered
    assert _DB_PASSWORD not in rendered


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


@pytest.mark.skipif(os.name != "posix", reason="raw-byte filenames require POSIX")
def test_scan_tree_detects_a_surrogateescape_filename_at_the_filesystem_boundary(
    tmp_path: Path,
) -> None:
    raw_name = b"artifact-\xff"
    raw_path = os.fsencode(tmp_path) + b"/" + raw_name
    try:
        descriptor = os.open(raw_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except OSError as exc:
        if exc.errno in (errno.EILSEQ, errno.ENOTSUP):
            pytest.skip("host filesystem rejects undecodable filename bytes")
        raise
    os.write(descriptor, b"content is clean")
    os.close(descriptor)
    inventory = si.SecretInventory()
    inventory.register("raw_filename_fragment", b"\xff")

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 1
    assert findings[0].reason == si.EXACT_SECRET_MATCH
    assert findings[0].label == "raw_filename_fragment"
    record = si.apply_remediation(tmp_path, findings[0])
    assert not os.path.lexists(raw_path)
    assert evidence.validate_evidence(record) == record


def test_each_scan_uses_a_fresh_non_guessable_artifact_id_key(tmp_path: Path) -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    (tmp_path / "artifact.txt").write_text(_DB_PASSWORD, encoding="utf-8")

    first = inventory.scan_tree(tmp_path)[0]
    second = inventory.scan_tree(tmp_path)[0]

    assert first.artifact_id != second.artifact_id


def test_scan_tree_detects_and_safely_remediates_an_exact_secret_in_a_filename(
    tmp_path: Path,
) -> None:
    inventory = si.SecretInventory()
    inventory.register("db_password", _DB_PASSWORD)
    artifact = tmp_path / f"trace-{_DB_PASSWORD}.txt"
    artifact.write_text("content is clean", encoding="utf-8")

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 1
    finding = findings[0]
    assert finding.reason == si.EXACT_SECRET_MATCH
    assert finding.label == "db_password"
    assert (
        finding.artifact_id == hashlib.sha256(artifact.name.encode("utf-8")).hexdigest()
    )
    assert not hasattr(finding, "relative_path")
    assert _DB_PASSWORD not in repr(finding)
    serialized_finding = json.dumps(asdict(finding), default=repr)
    assert _DB_PASSWORD not in serialized_finding
    assert artifact.name not in serialized_finding
    assert "relative_path" not in serialized_finding

    plan_record = asdict(si.remediation_plan_for(finding))
    assert _DB_PASSWORD not in json.dumps(plan_record)
    assert evidence.validate_evidence(plan_record) == plan_record

    remediation_record = si.apply_remediation(tmp_path, finding)
    assert not artifact.exists()
    assert _DB_PASSWORD not in json.dumps(remediation_record)
    assert remediation_record["artifact_id"] == finding.artifact_id
    assert evidence.validate_evidence(remediation_record) == remediation_record


def test_scan_finding_refuses_dataclass_deepcopy_and_pickle_locator_exfiltration() -> (
    None
):
    raw_component = f"trace-{_DB_PASSWORD}.txt"
    finding = si.ScanFinding(raw_component, si.EXACT_SECRET_MATCH, "db_password")

    with pytest.raises(TypeError):
        asdict(finding)
    with pytest.raises(TypeError):
        copy.deepcopy(finding)
    with pytest.raises((TypeError, pickle.PicklingError)):
        pickle.dumps(finding)
    assert raw_component not in repr(finding)
    assert _DB_PASSWORD not in repr(finding)


def test_scan_finding_equality_and_hash_include_the_scanner_identity(
    tmp_path: Path,
) -> None:
    artifact = tmp_path / "artifact"
    artifact.write_text("safe", encoding="utf-8")
    unbound = si.ScanFinding("artifact", si.EXACT_SECRET_MATCH, "db_password")
    bound = si.ScanFinding._from_locator(
        unbound._locator,
        si.EXACT_SECRET_MATCH,
        "db_password",
        artifact.stat(),
    )

    assert bound != unbound
    assert len({bound, unbound}) == 2


def test_bounded_locator_rejects_nul_without_exposing_the_raw_component() -> None:
    raw_component = f"artifact-{_DB_PASSWORD}\x00tail"

    with pytest.raises(si.SecretInventoryError) as caught:
        si.ScanFinding(raw_component, si.EXACT_SECRET_MATCH, "db_password")

    rendered = f"{caught.value}|{caught.value!r}|{caught.value.args!r}"
    assert _DB_PASSWORD not in rendered
    assert raw_component not in rendered


def test_scan_tree_detects_and_safely_remediates_an_exact_secret_directory_name(
    tmp_path: Path,
) -> None:
    inventory = si.SecretInventory()
    inventory.register("delegation_token", _OPAQUE_DELEGATION_TOKEN)
    secret_directory = tmp_path / f"run-{_OPAQUE_DELEGATION_TOKEN}"
    secret_directory.mkdir()
    nested_artifact = secret_directory / "clean.txt"
    nested_artifact.write_text("content is clean", encoding="utf-8")

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 2
    assert all(finding.reason == si.EXACT_SECRET_MATCH for finding in findings)
    assert all(finding.label == "delegation_token" for finding in findings)
    assert all(_OPAQUE_DELEGATION_TOKEN not in repr(finding) for finding in findings)

    records = [si.apply_remediation(tmp_path, finding) for finding in findings]
    assert not secret_directory.exists()
    assert _OPAQUE_DELEGATION_TOKEN not in json.dumps(records)
    assert evidence.validate_evidence(records) == records


def test_scan_tree_detects_generic_high_risk_text_in_a_path_component(
    tmp_path: Path,
) -> None:
    inventory = si.SecretInventory()
    raw_component = "token=opaque-value.txt"
    artifact = tmp_path / raw_component
    artifact.write_text("content is clean", encoding="utf-8")

    findings = inventory.scan_tree(tmp_path)

    assert len(findings) == 1
    assert findings[0].reason == evidence.INLINE_CREDENTIAL_ASSIGNMENT
    assert findings[0].label is None
    assert raw_component not in repr(findings[0])
    record = si.apply_remediation(tmp_path, findings[0])
    assert not artifact.exists()
    assert raw_component not in json.dumps(record)
    assert evidence.validate_evidence(record) == record


def test_path_bearing_errors_expose_neither_the_raw_path_nor_secret(
    tmp_path: Path,
) -> None:
    raw_component = f"trace-{_DB_PASSWORD}.txt"
    finding = si.ScanFinding(raw_component, si.EXACT_SECRET_MATCH, "db_password")

    with pytest.raises(si.SecretInventoryError) as caught:
        si.apply_remediation(tmp_path, finding)

    rendered = "|".join(
        (
            str(caught.value),
            repr(caught.value),
            repr(caught.value.args),
            repr(caught.value.__cause__),
            repr(caught.value.__context__),
        )
    )
    assert raw_component not in rendered
    assert _DB_PASSWORD not in rendered


# --------------------------------------------------------------------------
# remediation contract
# --------------------------------------------------------------------------


def test_remediation_plan_deletes_exact_and_generic_secret_matches() -> None:
    exact = si.ScanFinding("leak.txt", si.EXACT_SECRET_MATCH, "db_password")
    generic = si.ScanFinding("other.txt", evidence.JWT_VALUE, None)

    assert si.remediation_plan_for(exact).action == si.DELETE
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
        "action": si.DELETE,
        "artifact_id": finding.artifact_id,
        "label": "db_password",
        "reason": si.EXACT_SECRET_MATCH,
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


def test_apply_remediation_does_not_retain_exact_secrets_in_a_quarantine_tree(
    tmp_path: Path,
) -> None:
    root = tmp_path / "evidence"
    root.mkdir()
    (root / "nested").mkdir()
    artifact = root / "nested/leak.txt"
    artifact.write_text(_DB_PASSWORD, encoding="utf-8")
    finding = si.ScanFinding("nested/leak.txt", si.EXACT_SECRET_MATCH, "db_password")

    record = si.apply_remediation(root, finding)

    assert not artifact.exists()
    assert not (root / "quarantine").exists()
    assert record["action"] == si.DELETE


def test_apply_remediation_refuses_a_symlinked_target(tmp_path: Path) -> None:
    outside = tmp_path.parent / "outside-remediation.txt"
    outside.write_text(_DB_PASSWORD, encoding="utf-8")
    link = tmp_path / "leak.txt"
    link.symlink_to(outside)
    finding = si.ScanFinding("leak.txt", si.EXACT_SECRET_MATCH, "db_password")

    with pytest.raises(si.SecretInventoryError, match="symlink"):
        si.apply_remediation(tmp_path, finding)
    outside.unlink()


@pytest.mark.parametrize(
    ("reason", "label"),
    (
        (si.EXACT_SECRET_MATCH, "db_password"),
        (evidence.JWT_VALUE, None),
    ),
)
def test_apply_remediation_refuses_an_intermediate_symlink_without_touching_outside(
    tmp_path: Path,
    reason: str,
    label: str | None,
) -> None:
    root = tmp_path / "evidence"
    outside = tmp_path / "outside"
    (root / "nested").mkdir(parents=True)
    outside.mkdir()
    outside_artifact = outside / "outside.txt"
    outside_artifact.write_text(_DB_PASSWORD, encoding="utf-8")
    (root / "nested/linkdir").symlink_to(outside, target_is_directory=True)
    finding = si.ScanFinding("nested/linkdir/outside.txt", reason, label)

    with pytest.raises(si.SecretInventoryError, match="symlink"):
        si.apply_remediation(root, finding)

    assert outside_artifact.read_text(encoding="utf-8") == _DB_PASSWORD


def test_apply_remediation_refuses_an_intermediate_directory_rebind(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "evidence"
    outside = tmp_path / "outside"
    (root / "nested").mkdir(parents=True)
    outside.mkdir()
    outside_artifact = outside / "outside.txt"
    outside_artifact.write_text(_DB_PASSWORD, encoding="utf-8")
    finding = si.ScanFinding("nested/outside.txt", si.EXACT_SECRET_MATCH, "db_password")
    real_open = si.os.open
    rebound = False

    def _rebind_before_open(
        path: str | bytes | os.PathLike[str] | os.PathLike[bytes],
        flags: int,
        mode: int = 0o777,
        *,
        dir_fd: int | None = None,
    ) -> int:
        nonlocal rebound
        if path == "nested" and dir_fd is not None and not rebound:
            rebound = True
            (root / "nested").rmdir()
            (root / "nested").symlink_to(outside, target_is_directory=True)
        return real_open(path, flags, mode, dir_fd=dir_fd)

    monkeypatch.setattr(si.os, "open", _rebind_before_open)

    with pytest.raises(si.SecretInventoryError, match="opened safely"):
        si.apply_remediation(root, finding)

    assert outside_artifact.read_text(encoding="utf-8") == _DB_PASSWORD


def test_apply_remediation_refuses_a_path_that_escapes_the_root(
    tmp_path: Path,
) -> None:
    with pytest.raises(si.SecretInventoryError, match="escapes"):
        si.ScanFinding("../escape.txt", si.EXACT_SECRET_MATCH, "db_password")


def test_scanner_generated_symlink_finding_unlinks_only_the_leaf(
    tmp_path: Path,
) -> None:
    inventory = si.SecretInventory()
    outside = tmp_path.parent / f"{tmp_path.name}-outside-symlink.txt"
    outside.write_text(_DB_PASSWORD, encoding="utf-8")
    link = tmp_path / "escape-link.txt"
    link.symlink_to(outside)

    finding = inventory.scan_tree(tmp_path)[0]
    assert finding.reason == si.SYMLINK_NOT_PERMITTED

    record = si.apply_remediation(tmp_path, finding)

    assert not link.exists()
    assert not link.is_symlink()
    assert outside.read_text(encoding="utf-8") == _DB_PASSWORD
    assert evidence.validate_evidence(record) == record
    outside.unlink()


def test_scanner_generated_fifo_finding_unlinks_the_leaf_without_opening_it(
    tmp_path: Path,
) -> None:
    inventory = si.SecretInventory()
    fifo = tmp_path / "pipe"
    os.mkfifo(fifo)

    finding = inventory.scan_tree(tmp_path)[0]
    assert finding.reason == si.NON_REGULAR_FILE_NOT_PERMITTED

    record = si.apply_remediation(tmp_path, finding)

    assert not fifo.exists()
    assert evidence.validate_evidence(record) == record


@pytest.mark.parametrize("entry_kind", ("symlink", "fifo"))
def test_special_leaf_remediation_refuses_a_type_rebind_to_a_regular_file(
    tmp_path: Path,
    entry_kind: str,
) -> None:
    inventory = si.SecretInventory()
    artifact = tmp_path / "artifact"
    outside = tmp_path.parent / f"{tmp_path.name}-outside-race.txt"
    outside.write_text(_DB_PASSWORD, encoding="utf-8")
    if entry_kind == "symlink":
        artifact.symlink_to(outside)
    else:
        os.mkfifo(artifact)
    finding = inventory.scan_tree(tmp_path)[0]
    artifact.unlink()
    artifact.write_text("replacement must survive", encoding="utf-8")

    with pytest.raises(si.SecretInventoryError, match="changed"):
        si.apply_remediation(tmp_path, finding)

    assert artifact.read_text(encoding="utf-8") == "replacement must survive"
    assert outside.read_text(encoding="utf-8") == _DB_PASSWORD
    outside.unlink()


def test_special_leaf_remediation_refuses_a_rebind_during_inode_checks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    inventory = si.SecretInventory()
    outside = tmp_path.parent / f"{tmp_path.name}-outside-inode-race.txt"
    outside.write_text(_DB_PASSWORD, encoding="utf-8")
    link = tmp_path / "artifact"
    link.symlink_to(outside)
    finding = inventory.scan_tree(tmp_path)[0]
    real_stat_no_follow = si._stat_no_follow
    rebound = False

    def _rebind_after_stat(name: str, *, dir_fd: int) -> os.stat_result:
        nonlocal rebound
        status = real_stat_no_follow(name, dir_fd=dir_fd)
        if name == "artifact" and not rebound:
            rebound = True
            link.unlink()
            link.write_text("replacement must survive", encoding="utf-8")
        return status

    monkeypatch.setattr(si, "_stat_no_follow", _rebind_after_stat)

    with pytest.raises(si.SecretInventoryError, match="changed"):
        si.apply_remediation(tmp_path, finding)

    assert link.read_text(encoding="utf-8") == "replacement must survive"
    assert outside.read_text(encoding="utf-8") == _DB_PASSWORD
    outside.unlink()


def test_unlink_name_swap_window_remains_bounded_to_the_pinned_parent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    inventory = si.SecretInventory()
    outside_first = tmp_path.parent / f"{tmp_path.name}-outside-first.txt"
    outside_second = tmp_path.parent / f"{tmp_path.name}-outside-second.txt"
    outside_first.write_text("first must survive", encoding="utf-8")
    outside_second.write_text("second must survive", encoding="utf-8")
    link = tmp_path / "artifact"
    link.symlink_to(outside_first)
    finding = inventory.scan_tree(tmp_path)[0]
    real_unlink = si.os.unlink
    swapped = False

    def _swap_leaf_then_unlink(
        path: str | bytes | os.PathLike[str] | os.PathLike[bytes],
        *,
        dir_fd: int | None = None,
    ) -> None:
        nonlocal swapped
        if path == "artifact" and dir_fd is not None and not swapped:
            swapped = True
            real_unlink(path, dir_fd=dir_fd)
            link.symlink_to(outside_second)
        real_unlink(path, dir_fd=dir_fd)

    monkeypatch.setattr(si.os, "unlink", _swap_leaf_then_unlink)

    si.apply_remediation(tmp_path, finding)

    assert not link.is_symlink()
    assert outside_first.read_text(encoding="utf-8") == "first must survive"
    assert outside_second.read_text(encoding="utf-8") == "second must survive"
    outside_first.unlink()
    outside_second.unlink()
