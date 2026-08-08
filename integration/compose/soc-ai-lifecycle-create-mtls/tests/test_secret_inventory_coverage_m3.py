"""Deterministic M3 coverage for secret-inventory fail-closed behavior.

Only synthetic values, monkeypatched local OS calls, and pytest temporary
paths are used. No credential, network, subprocess, listener, database,
container, signal, or product runtime is accessed.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from cybrik_suite_uat_mtls import secret_inventory as inventory


def _finding(relative_path: str, reason: str) -> inventory.ScanFinding:
    return inventory.ScanFinding(relative_path, reason, None)


def test_artifact_locator_rejects_a_caller_selected_invalid_key() -> None:
    with pytest.raises(inventory.SecretInventoryError, match="key shape"):
        inventory._ArtifactLocator("artifact", artifact_id_key=b"short")


def test_scan_finding_equality_returns_not_implemented_for_foreign_types() -> None:
    finding = _finding("artifact", inventory.EXACT_SECRET_MATCH)
    assert finding.__eq__(object()) is NotImplemented


def test_fstat_failure_is_sanitized(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_fstat(_descriptor: int) -> os.stat_result:
        raise OSError("synthetic fstat failure")

    monkeypatch.setattr(inventory.os, "fstat", fail_fstat)
    with pytest.raises(inventory.SecretInventoryError, match="inspected safely"):
        inventory._fstat_safely(123)


@pytest.mark.parametrize("relative_path", ("", ".", "../escape", "/absolute"))
def test_locator_refuses_paths_outside_the_bounded_root(relative_path: str) -> None:
    with pytest.raises(inventory.SecretInventoryError, match="bounded root"):
        _finding(relative_path, inventory.EXACT_SECRET_MATCH)


def test_parent_descriptor_refuses_relative_root() -> None:
    locator = inventory._ArtifactLocator("artifact")
    with (
        pytest.raises(inventory.SecretInventoryError, match="absolute path"),
        inventory._bounded_parent_descriptor(Path("relative"), locator),
    ):
        pass


def test_parent_descriptor_refuses_missing_root_without_leaking_path(
    tmp_path: Path,
) -> None:
    locator = inventory._ArtifactLocator("artifact")
    with (
        pytest.raises(inventory.SecretInventoryError, match="inspected safely"),
        inventory._bounded_parent_descriptor(tmp_path / "missing", locator),
    ):
        pass


def test_parent_descriptor_refuses_non_directory_root(tmp_path: Path) -> None:
    root = tmp_path / "regular-file"
    root.write_bytes(b"safe")
    locator = inventory._ArtifactLocator("artifact")
    with (
        pytest.raises(inventory.SecretInventoryError, match="must be a directory"),
        inventory._bounded_parent_descriptor(root, locator),
    ):
        pass


def test_parent_descriptor_refuses_root_open_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail_open(*_args: object, **_kwargs: object) -> int:
        raise OSError("synthetic open failure")

    locator = inventory._ArtifactLocator("artifact")
    monkeypatch.setattr(inventory.os, "open", fail_open)
    with (
        pytest.raises(inventory.SecretInventoryError, match="opened safely"),
        inventory._bounded_parent_descriptor(tmp_path, locator),
    ):
        pass


def test_parent_descriptor_refuses_non_directory_intermediate_component(
    tmp_path: Path,
) -> None:
    (tmp_path / "parent").write_bytes(b"safe")
    locator = inventory._ArtifactLocator("parent/artifact")
    with (
        pytest.raises(
            inventory.SecretInventoryError, match="parent must be a directory"
        ),
        inventory._bounded_parent_descriptor(tmp_path, locator),
    ):
        pass


@pytest.mark.parametrize(
    ("reason", "kind"),
    (
        (inventory.SYMLINK_NOT_PERMITTED, "regular"),
        (inventory.NON_REGULAR_FILE_NOT_PERMITTED, "regular"),
        (inventory.EXACT_SECRET_MATCH, "fifo"),
    ),
)
def test_unbound_remediation_refuses_a_reason_type_mismatch(
    tmp_path: Path, reason: str, kind: str
) -> None:
    target = tmp_path / "artifact"
    if kind == "fifo":
        os.mkfifo(target)
    else:
        target.write_bytes(b"safe")

    with pytest.raises(
        inventory.SecretInventoryError, match="type changed|not permitted"
    ):
        inventory.apply_remediation(tmp_path, _finding(target.name, reason))


def test_remediation_refuses_leaf_open_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "artifact"
    target.write_bytes(b"safe")
    real_open = inventory.os.open

    def fail_leaf_open(
        path: object, flags: int, *args: object, **kwargs: object
    ) -> int:
        if path == target.name and flags == inventory._OPEN_FLAGS:
            raise OSError("synthetic leaf open failure")
        return real_open(path, flags, *args, **kwargs)

    monkeypatch.setattr(inventory.os, "open", fail_leaf_open)
    with pytest.raises(inventory.SecretInventoryError, match="opened safely"):
        inventory.apply_remediation(
            tmp_path, _finding(target.name, inventory.EXACT_SECRET_MATCH)
        )
    assert target.exists()


def test_remediation_refuses_delete_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "artifact"
    target.write_bytes(b"safe")

    def fail_unlink(*_args: object, **_kwargs: object) -> None:
        raise OSError("synthetic unlink failure")

    monkeypatch.setattr(inventory.os, "unlink", fail_unlink)
    with pytest.raises(inventory.SecretInventoryError, match="deleted safely"):
        inventory.apply_remediation(
            tmp_path, _finding(target.name, inventory.EXACT_SECRET_MATCH)
        )
    assert target.exists()


def test_scan_tree_refuses_a_regular_file_root(tmp_path: Path) -> None:
    root = tmp_path / "artifact"
    root.write_bytes(b"safe")
    with pytest.raises(inventory.SecretInventoryError, match="must be a directory"):
        inventory.SecretInventory().scan_tree(root)


def test_scan_tree_sanitizes_enumeration_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail_rglob(_self: Path, _pattern: str) -> object:
        raise OSError("synthetic enumeration failure")

    monkeypatch.setattr(Path, "rglob", fail_rglob)
    with pytest.raises(inventory.SecretInventoryError, match="enumerated safely"):
        inventory.SecretInventory().scan_tree(tmp_path)
