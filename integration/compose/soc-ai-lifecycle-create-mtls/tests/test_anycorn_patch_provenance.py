"""Fail-closed provenance checks for the D1 Anycorn B1 artifact.

This target deliberately imports no Anycorn module and opens no socket.  It is
run only with an explicit, absolute artifact directory outside the repository.
The first D1 execution is expected to fail because neither the audited patch
nor the internal wheel exists yet; the same target must pass after the bounded
build produces and records the exact artifacts.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

import pytest


_REPO_ROOT = Path(__file__).resolve().parents[4]
_HARNESS_ROOT = Path(__file__).resolve().parents[1]
_PATCH_PATH = _HARNESS_ROOT / "patches" / "anycorn-0.20.0+cybrik.1.patch"
_PATCH_EVIDENCE_PATH = _HARNESS_ROOT / "evidence" / "patch-provenance.json"
_WHEEL_EVIDENCE_PATH = _HARNESS_ROOT / "evidence" / "internal-wheel.json"

_SDIST_NAME = "anycorn-0.20.0.tar.gz"
_SDIST_SHA256 = "e5555ddc95bc2df13908093ee11eff8f0a05165b9b9a368c28291065eab63927"
_RAW_WHEEL_SHA256 = "43fcf5ade1b727f3a39b5bff0305012262be9b9993150dd312d626126382c8a1"
_INTERNAL_VERSION = "0.20.0+cybrik.1"
_SOURCE_TAG_COMMIT = "f81a302a2cf3ea36093372e2f62283d945d47fe6"
_UPSTREAM_FIX_COMMIT = "9eabf20e22bb2fe4987110bebf05eb822517f754"
_PYTHON_VERSION = "3.12.13"
_PYTHON_SHA256 = "a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623"
_SOURCE_DATE_EPOCH = 315532800


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _load_json(path: Path) -> dict[str, object]:
    assert path.is_file(), f"required audited evidence is absent: {path.relative_to(_REPO_ROOT)}"
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict), f"evidence must be a JSON object: {path.name}"
    return payload


@pytest.fixture(scope="module")
def artifact_dir() -> Path:
    raw = os.environ.get("CYBRIK_UAT_D1_ARTIFACT_DIR")
    assert raw, "CYBRIK_UAT_D1_ARTIFACT_DIR is required for this explicit D1 target"
    path = Path(raw)
    assert path.is_absolute(), "CYBRIK_UAT_D1_ARTIFACT_DIR must be absolute"
    resolved = path.resolve(strict=True)
    assert resolved.is_dir(), "CYBRIK_UAT_D1_ARTIFACT_DIR must name an existing directory"
    assert not resolved.is_relative_to(_REPO_ROOT), (
        "CYBRIK_UAT_D1_ARTIFACT_DIR must remain outside the repository"
    )
    return resolved


def test_patch_is_the_exact_two_hunk_b1_delta(artifact_dir: Path) -> None:
    del artifact_dir  # The fixture enforces the bounded explicit-target contract.
    assert _PATCH_PATH.is_file(), (
        "audited two-hunk Anycorn B1 patch is absent; this is the intended D1 RED"
    )
    text = _PATCH_PATH.read_text(encoding="utf-8")

    assert "GIT binary patch" not in text
    assert text.count("diff --git ") == 2
    assert len(re.findall(r"^@@ .+ @@", text, flags=re.MULTILINE)) == 2

    changed_files = re.findall(r"^diff --git a/(\S+) b/(\S+)$", text, flags=re.MULTILINE)
    assert changed_files == [
        ("pyproject.toml", "pyproject.toml"),
        ("src/anycorn/config.py", "src/anycorn/config.py"),
    ]

    removed = [
        line[1:]
        for line in text.splitlines()
        if line.startswith("-") and not line.startswith("---")
    ]
    added = [
        line[1:]
        for line in text.splitlines()
        if line.startswith("+") and not line.startswith("+++")
    ]
    assert removed == [
        'version = "0.20.0"',
        "        context.options = OP_NO_COMPRESSION  # RFC 7540 Section 9.2.1: MUST disable compression",
    ]
    assert added == [
        f'version = "{_INTERNAL_VERSION}"',
        "        context.options |= OP_NO_COMPRESSION  # RFC 7540 Section 9.2.1: MUST disable compression",
    ]


def test_exact_sdist_and_two_clean_builds_are_byte_reproducible(
    artifact_dir: Path,
) -> None:
    sdists = sorted(artifact_dir.rglob(_SDIST_NAME))
    assert len(sdists) == 1, f"expected one exact {_SDIST_NAME}, found {len(sdists)}"
    assert _sha256(sdists[0]) == _SDIST_SHA256

    wheels = sorted(artifact_dir.rglob(f"anycorn-{_INTERNAL_VERSION}-*.whl"))
    assert len(wheels) == 2, "two distinct clean-directory B1 builds are required"
    assert wheels[0].parent.resolve() != wheels[1].parent.resolve()
    assert wheels[0].name == wheels[1].name
    wheel_hashes = {_sha256(wheel) for wheel in wheels}
    assert len(wheel_hashes) == 1, "the two B1 wheels are not byte-identical"

    all_wheels = tuple(artifact_dir.rglob("*.whl"))
    assert all(_sha256(wheel) != _RAW_WHEEL_SHA256 for wheel in all_wheels)
    assert not any(
        re.fullmatch(r"anycorn-0\.20\.0-(?!\+cybrik).*\.whl", wheel.name)
        for wheel in all_wheels
    ), "the official raw Anycorn wheel is forbidden"


def test_committed_evidence_binds_source_patch_build_and_internal_wheel(
    artifact_dir: Path,
) -> None:
    patch = _load_json(_PATCH_EVIDENCE_PATH)
    wheel = _load_json(_WHEEL_EVIDENCE_PATH)

    assert patch["artifact_id"] == "anycorn-cybrik-uat-b1"
    assert patch["source"] == {
        "filename": _SDIST_NAME,
        "sha256": _SDIST_SHA256,
        "tag_commit": _SOURCE_TAG_COMMIT,
    }
    assert patch["upstream_fix_commit"] == _UPSTREAM_FIX_COMMIT
    assert patch["patch_sha256"] == _sha256(_PATCH_PATH)
    assert patch["hunk_count"] == 2
    assert patch["changed_files"] == ["pyproject.toml", "src/anycorn/config.py"]

    build = patch["build"]
    assert isinstance(build, dict)
    assert build["python_version"] == _PYTHON_VERSION
    assert build["python_executable_sha256"] == _PYTHON_SHA256
    assert build["source_date_epoch"] == _SOURCE_DATE_EPOCH
    assert build["tz"] == "UTC"
    assert build["lc_all"] == "C"
    assert build["pythonhashseed"] == "0"
    assert build["umask"] == "022"
    build_dirs = build["build_dirs"]
    assert isinstance(build_dirs, list) and len(build_dirs) == 2
    resolved_dirs = [Path(item).resolve(strict=True) for item in build_dirs]
    assert all(path.is_absolute() and path.is_relative_to(artifact_dir) for path in resolved_dirs)
    assert resolved_dirs[0] != resolved_dirs[1]

    expected_wheels = sorted(artifact_dir.rglob(f"anycorn-{_INTERNAL_VERSION}-*.whl"))
    assert wheel["artifact_id"] == "anycorn-cybrik-uat-b1"
    assert wheel["version"] == _INTERNAL_VERSION
    assert wheel["filename"] == expected_wheels[0].name
    assert wheel["sha256"] == _sha256(expected_wheels[0])
    assert wheel["build_sha256"] == [_sha256(path) for path in expected_wheels]
    assert wheel["install_mode"] == "offline-no-deps-after-sha256-verification"
    assert wheel["product_selected"] is False
