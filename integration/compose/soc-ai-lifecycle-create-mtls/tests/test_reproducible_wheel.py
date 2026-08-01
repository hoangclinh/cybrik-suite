"""D1 lock, wheelhouse, and offline-reinstall integrity checks.

This explicit artifact target performs no resolution or installation.  It
verifies committed and outside-repository evidence produced by the bounded D1
tooling path, while keeping the internal B1 wheel outside the uv solver.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import tomllib
from pathlib import Path

import pytest


_REPO_ROOT = Path(__file__).resolve().parents[4]
_HARNESS_ROOT = Path(__file__).resolve().parents[1]
_PYPROJECT = _HARNESS_ROOT / "pyproject.toml"
_LOCK = _HARNESS_ROOT / "uv.lock"
_LOCK_EVIDENCE = _HARNESS_ROOT / "evidence" / "dependency-lock.json"
_OFFLINE_EVIDENCE = _HARNESS_ROOT / "evidence" / "offline-reinstall.json"

_REQUIRED_DIRECT_DEPENDENCIES = frozenset(
    {
        "alembic",
        "anyio",
        "argon2-cffi",
        "asyncpg",
        "cryptography",
        "email-validator",
        "fastapi",
        "h11",
        "h2",
        "hpack",
        "httpx",
        "maxminddb",
        "priority",
        "psycopg2-binary",
        "pydantic",
        "pydantic-settings",
        "pyjwt",
        "pyyaml",
        "redis",
        "rich-click",
        "sniffio",
        "sqlalchemy",
        "uvicorn",
        "wsproto",
    }
)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _load_json(path: Path) -> dict[str, object]:
    assert path.is_file(), f"required D1 evidence is absent: {path.relative_to(_REPO_ROOT)}"
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def _normalized_name(requirement: str) -> str:
    name = re.split(r"[<>=!~;\[ ]", requirement, maxsplit=1)[0]
    return name.casefold().replace("_", "-")


@pytest.fixture(scope="module")
def artifact_dir() -> Path:
    raw = os.environ.get("CYBRIK_UAT_D1_ARTIFACT_DIR")
    assert raw, "CYBRIK_UAT_D1_ARTIFACT_DIR is required for this explicit D1 target"
    candidate = Path(raw)
    assert candidate.is_absolute()
    resolved = candidate.resolve(strict=True)
    assert resolved.is_dir() and not resolved.is_relative_to(_REPO_ROOT)
    return resolved


def test_registry_lock_contains_the_harness_closure_but_never_anycorn() -> None:
    assert _PYPROJECT.is_file(), "dedicated D1 pyproject is absent; intended lock RED"
    assert _LOCK.is_file(), "dedicated D1 uv.lock is absent; intended lock RED"

    project = tomllib.loads(_PYPROJECT.read_text(encoding="utf-8"))
    dependencies = project["project"]["dependencies"]
    direct_names = {_normalized_name(item) for item in dependencies}
    assert _REQUIRED_DIRECT_DEPENDENCIES <= direct_names
    assert "anycorn" not in direct_names

    lock = tomllib.loads(_LOCK.read_text(encoding="utf-8"))
    packages = lock["package"]
    names = {_normalized_name(package["name"]) for package in packages}
    assert "anycorn" not in names
    assert _REQUIRED_DIRECT_DEPENDENCIES <= names
    for package in packages:
        source = package.get("source")
        if package["name"] == "cybrik-suite-uat-mtls":
            assert source == {"virtual": "."}
            continue
        assert source == {"registry": "https://pypi.org/simple"}


def test_export_and_wheelhouse_are_hash_complete_and_exclude_anycorn(
    artifact_dir: Path,
) -> None:
    evidence = _load_json(_LOCK_EVIDENCE)
    requirements = artifact_dir / "uv-exported-requirements.txt"
    wheelhouse = artifact_dir / "wheelhouse"
    assert requirements.is_file()
    assert wheelhouse.is_dir()

    text = requirements.read_text(encoding="utf-8")
    assert re.search(r"(?im)^anycorn(?:==|\[)", text) is None
    requirement_starts = [
        line for line in text.splitlines() if line and not line[0].isspace() and not line.startswith("#")
    ]
    assert requirement_starts
    assert all("==" in line for line in requirement_starts)
    assert text.count("--hash=sha256:") >= len(requirement_starts)

    wheels = sorted(wheelhouse.glob("*.whl"))
    assert wheels and len(wheels) == evidence["wheel_count"]
    assert all(not wheel.name.casefold().startswith("anycorn-") for wheel in wheels)
    recorded = evidence["wheels"]
    assert isinstance(recorded, list)
    assert recorded == [
        {"filename": wheel.name, "sha256": _sha256(wheel)} for wheel in wheels
    ]
    assert evidence["uv_lock_sha256"] == _sha256(_LOCK)
    assert evidence["requirements_sha256"] == _sha256(requirements)


def test_offline_reinstall_is_fresh_hash_verified_and_keeps_b1_separate(
    artifact_dir: Path,
) -> None:
    evidence = _load_json(_OFFLINE_EVIDENCE)
    assert evidence["result"] == "pass"
    assert evidence["network"] == "disabled"
    assert evidence["fresh_environment"] is True
    assert evidence["requirements_install"] == {
        "no_index": True,
        "find_links": str(artifact_dir / "wheelhouse"),
        "require_hashes": True,
    }
    assert evidence["b1_install"] == {
        "no_deps": True,
        "sha256_verified": True,
        "version": "0.20.0+cybrik.1",
    }
