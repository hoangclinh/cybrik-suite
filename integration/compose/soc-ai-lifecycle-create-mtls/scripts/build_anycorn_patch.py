#!/usr/bin/env python3
"""Build the D1 Anycorn B1 wheel twice from one hash-pinned sdist.

The script is intentionally narrow: it accepts one absolute artifact root,
fetches at most the accepted PyPI metadata and exact sdist, applies the audited
two-line delta without fuzzy patching, and creates two byte-comparable wheels.
It never resolves, downloads, installs, or imports an Anycorn wheel.
"""

from __future__ import annotations

import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import sysconfig
import tarfile
import tempfile
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from typing import Final


ARTIFACT_ENV: Final = "CYBRIK_UAT_D1_ARTIFACT_DIR"
ARTIFACT_ID: Final = "anycorn-cybrik-uat-b1"
VERSION: Final = "0.20.0"
INTERNAL_VERSION: Final = "0.20.0+cybrik.1"
SDIST_NAME: Final = "anycorn-0.20.0.tar.gz"
SDIST_SHA256: Final = "e5555ddc95bc2df13908093ee11eff8f0a05165b9b9a368c28291065eab63927"
PYPI_JSON_URL: Final = "https://pypi.org/pypi/anycorn/0.20.0/json"
SDIST_URL: Final = (
    "https://files.pythonhosted.org/packages/ab/e8/"
    "bb202585a4c3d48ce7a245715fed1b0769e657f49c4626c9036b103a50fe/"
    "anycorn-0.20.0.tar.gz"
)
RAW_WHEEL_SHA256: Final = (
    "43fcf5ade1b727f3a39b5bff0305012262be9b9993150dd312d626126382c8a1"
)
SOURCE_TAG_COMMIT: Final = "f81a302a2cf3ea36093372e2f62283d945d47fe6"
UPSTREAM_FIX_COMMIT: Final = "9eabf20e22bb2fe4987110bebf05eb822517f754"

PINNED_PYTHON_VERSION: Final = "3.12.13"
PINNED_PYTHON_SHA256: Final = (
    "a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623"
)
PINNED_PIP_VERSION: Final = "26.1.1"
PINNED_UV_VERSION: Final = "0.11.16"
PINNED_UV_SHA256: Final = (
    "96e422f83fd306848446170d97c1d1af8290f00e4aacfa7134e130280d573126"
)
UV_EXECUTABLE: Final = Path("/opt/homebrew/bin/uv")

SOURCE_DATE_EPOCH: Final = "315532800"
DETERMINISTIC_ENV: Final = {
    "SOURCE_DATE_EPOCH": SOURCE_DATE_EPOCH,
    "TZ": "UTC",
    "LC_ALL": "C",
    "PYTHONHASHSEED": "0",
}

_VERSION_OLD: Final = 'version = "0.20.0"'
_VERSION_NEW: Final = 'version = "0.20.0+cybrik.1"'
_OPTIONS_OLD: Final = (
    "        context.options = OP_NO_COMPRESSION  # RFC 7540 Section 9.2.1: MUST disable compression"
)
_OPTIONS_NEW: Final = (
    "        context.options |= OP_NO_COMPRESSION  # RFC 7540 Section 9.2.1: MUST disable compression"
)


class BuildRefused(RuntimeError):
    """Stable fail-closed build refusal."""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _artifact_root() -> Path:
    raw = os.environ.get(ARTIFACT_ENV)
    if not raw:
        raise BuildRefused(f"{ARTIFACT_ENV} is required")
    candidate = Path(raw)
    if not candidate.is_absolute():
        raise BuildRefused(f"{ARTIFACT_ENV} must be absolute")
    candidate.mkdir(mode=0o700, parents=False, exist_ok=True)
    root = candidate.resolve(strict=True)
    if root == _repo_root() or root.is_relative_to(_repo_root()):
        raise BuildRefused(f"{ARTIFACT_ENV} must remain outside the repository")
    return root


def _require_toolchain() -> dict[str, str]:
    python = Path(sys.executable).resolve(strict=True)
    if platform.python_version() != PINNED_PYTHON_VERSION:
        raise BuildRefused(
            f"Python {PINNED_PYTHON_VERSION} required, got {platform.python_version()}"
        )
    python_sha256 = _sha256(python)
    if python_sha256 != PINNED_PYTHON_SHA256:
        raise BuildRefused("pinned Python executable digest mismatch")
    if not UV_EXECUTABLE.is_file() or _sha256(UV_EXECUTABLE) != PINNED_UV_SHA256:
        raise BuildRefused("pinned uv executable is absent or has the wrong digest")

    uv_version = subprocess.run(
        [str(UV_EXECUTABLE), "--version"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if uv_version != f"uv {PINNED_UV_VERSION} (Homebrew 2026-05-21 aarch64-apple-darwin)":
        raise BuildRefused(f"unexpected uv version: {uv_version}")

    pip_output = subprocess.run(
        [str(python), "-m", "pip", "--version"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if not pip_output.startswith(f"pip {PINNED_PIP_VERSION} "):
        raise BuildRefused(f"unexpected pip version: {pip_output}")

    return {
        "python_executable": str(python),
        "python_executable_sha256": python_sha256,
        "python_version": platform.python_version(),
        "pip_version": PINNED_PIP_VERSION,
        "uv_executable": str(UV_EXECUTABLE),
        "uv_executable_sha256": PINNED_UV_SHA256,
        "uv_version": PINNED_UV_VERSION,
        "platform_tag": sysconfig.get_platform(),
        "abi_tag": str(sysconfig.get_config_var("SOABI")),
    }


def _download_exact(url: str, destination: Path) -> None:
    parsed = urllib.parse.urlparse(url)
    allowed = {
        ("pypi.org", "/pypi/anycorn/0.20.0/json"),
        (
            "files.pythonhosted.org",
            "/packages/ab/e8/bb202585a4c3d48ce7a245715fed1b0769e657f49c4626c9036b103a50fe/"
            "anycorn-0.20.0.tar.gz",
        ),
    }
    if parsed.scheme != "https" or (parsed.hostname, parsed.path) not in allowed:
        raise BuildRefused(f"outbound URL is outside the D1 allowlist: {url}")
    destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=30) as response:  # noqa: S310 - exact allowlist above
        if response.geturl() != url:
            raise BuildRefused("redirected download is forbidden")
        with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as output:
            shutil.copyfileobj(response, output)
            temporary = Path(output.name)
    temporary.replace(destination)


def _ensure_source(root: Path) -> Path:
    source_dir = root / "source"
    metadata_path = source_dir / "anycorn-0.20.0.json"
    sdist_path = source_dir / SDIST_NAME
    if not metadata_path.exists():
        _download_exact(PYPI_JSON_URL, metadata_path)
    if not sdist_path.exists():
        _download_exact(SDIST_URL, sdist_path)

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    candidates = [
        item
        for item in metadata.get("urls", [])
        if item.get("packagetype") == "sdist" and item.get("filename") == SDIST_NAME
    ]
    if len(candidates) != 1:
        raise BuildRefused("PyPI metadata does not contain one exact Anycorn sdist")
    candidate = candidates[0]
    if candidate.get("url") != SDIST_URL:
        raise BuildRefused("PyPI metadata sdist URL does not match the admitted URL")
    if candidate.get("digests", {}).get("sha256") != SDIST_SHA256:
        raise BuildRefused("PyPI metadata sdist digest does not match the admitted digest")
    if _sha256(sdist_path) != SDIST_SHA256:
        raise BuildRefused("downloaded Anycorn sdist digest mismatch")
    return sdist_path


def _require_canonical_patch() -> tuple[Path, str]:
    patch_path = _repo_root() / (
        "integration/compose/soc-ai-lifecycle-create-mtls/patches/"
        "anycorn-0.20.0+cybrik.1.patch"
    )
    text = patch_path.read_text(encoding="utf-8")
    if text.count("diff --git ") != 2 or sum(
        line.startswith("@@ ") for line in text.splitlines()
    ) != 2:
        raise BuildRefused("B1 patch must contain exactly two files and two hunks")
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
    if removed != [_VERSION_OLD, _OPTIONS_OLD] or added != [_VERSION_NEW, _OPTIONS_NEW]:
        raise BuildRefused("B1 patch contains a change outside the admitted two-line delta")
    expected_files = [
        "diff --git a/pyproject.toml b/pyproject.toml",
        "diff --git a/src/anycorn/config.py b/src/anycorn/config.py",
    ]
    if [line for line in text.splitlines() if line.startswith("diff --git ")] != expected_files:
        raise BuildRefused("B1 patch changes an unapproved source path")
    return patch_path, _sha256(patch_path)


def _safe_extract(sdist: Path, destination: Path) -> Path:
    destination.mkdir(mode=0o700, parents=True)
    with tarfile.open(sdist, mode="r:gz") as archive:
        members = archive.getmembers()
        for member in members:
            parts = PurePosixPath(member.name).parts
            if (
                not parts
                or parts[0] != "anycorn-0.20.0"
                or PurePosixPath(member.name).is_absolute()
                or ".." in parts
                or member.issym()
                or member.islnk()
                or member.isdev()
            ):
                raise BuildRefused(f"unsafe or unexpected sdist member: {member.name}")
        archive.extractall(destination, members=members, filter="data")
    source = destination / "anycorn-0.20.0"
    if not source.is_dir():
        raise BuildRefused("sdist did not produce the exact expected source root")
    return source


def _replace_exact(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if text.count(old) != 1 or new in text:
        raise BuildRefused(f"source preimage mismatch: {path.name}")
    patched = text.replace(old, new)
    if patched.count(new) != 1 or old in patched:
        raise BuildRefused(f"source postimage mismatch: {path.name}")
    path.write_text(patched, encoding="utf-8", newline="")


def _apply_audited_delta(source: Path) -> None:
    _replace_exact(source / "pyproject.toml", _VERSION_OLD, _VERSION_NEW)
    _replace_exact(source / "src" / "anycorn" / "config.py", _OPTIONS_OLD, _OPTIONS_NEW)


def _build_once(root: Path, label: str, sdist: Path, toolchain: dict[str, str]) -> tuple[Path, Path]:
    build_root = root / label
    if build_root.exists():
        raise BuildRefused(f"clean build directory already exists: {build_root}")
    source = _safe_extract(sdist, build_root / "src")
    _apply_audited_delta(source)
    output = build_root / "dist"
    cache = root / f"uv-cache-{label}"
    output.mkdir(mode=0o700)
    cache.mkdir(mode=0o700)

    env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "UV_CACHE_DIR": str(cache),
        "UV_NO_CONFIG": "1",
        **DETERMINISTIC_ENV,
    }
    old_umask = os.umask(0o022)
    try:
        subprocess.run(
            [
                str(UV_EXECUTABLE),
                "build",
                "--wheel",
                "--offline",
                "--no-config",
                "--no-python-downloads",
                "--no-create-gitignore",
                "--clear",
                "--python",
                toolchain["python_executable"],
                "--out-dir",
                str(output),
                str(source),
            ],
            check=True,
            cwd=build_root,
            env=env,
        )
    finally:
        os.umask(old_umask)

    wheels = sorted(output.glob("*.whl"))
    if len(wheels) != 1 or INTERNAL_VERSION not in wheels[0].name:
        raise BuildRefused("build did not produce one exact local-version Anycorn wheel")
    return build_root, wheels[0]


def _verify_wheel(wheel: Path) -> None:
    if _sha256(wheel) == RAW_WHEEL_SHA256:
        raise BuildRefused("official raw Anycorn wheel is forbidden")
    with zipfile.ZipFile(wheel) as archive:
        names = archive.namelist()
        metadata_names = [name for name in names if name.endswith(".dist-info/METADATA")]
        if len(metadata_names) != 1:
            raise BuildRefused("wheel does not contain one METADATA record")
        metadata = archive.read(metadata_names[0]).decode("utf-8")
        if f"Version: {INTERNAL_VERSION}\n" not in metadata:
            raise BuildRefused("wheel metadata does not carry the internal local version")
        config = archive.read("anycorn/config.py").decode("utf-8")
        if config.count(_OPTIONS_NEW) != 1 or _OPTIONS_OLD in config:
            raise BuildRefused("wheel does not contain the exact hardened SSL-options delta")


def main() -> int:
    root = _artifact_root()
    toolchain = _require_toolchain()
    sdist = _ensure_source(root)
    patch_path, patch_sha256 = _require_canonical_patch()

    forbidden = [
        path
        for path in root.rglob("*.whl")
        if _sha256(path) == RAW_WHEEL_SHA256
        or (path.name.startswith("anycorn-0.20.0-") and "+cybrik.1" not in path.name)
    ]
    if forbidden:
        raise BuildRefused("artifact root contains the forbidden official Anycorn wheel")

    first_dir, first_wheel = _build_once(root, "build-a", sdist, toolchain)
    second_dir, second_wheel = _build_once(root, "build-b", sdist, toolchain)
    first_sha256 = _sha256(first_wheel)
    second_sha256 = _sha256(second_wheel)
    if first_wheel.name != second_wheel.name or first_sha256 != second_sha256:
        raise BuildRefused("two clean-directory builds were not byte-identical")
    _verify_wheel(first_wheel)
    _verify_wheel(second_wheel)

    result = {
        "artifact_id": ARTIFACT_ID,
        "source": {
            "filename": SDIST_NAME,
            "sha256": SDIST_SHA256,
            "tag_commit": SOURCE_TAG_COMMIT,
        },
        "upstream_fix_commit": UPSTREAM_FIX_COMMIT,
        "patch_path": str(patch_path.relative_to(_repo_root())),
        "patch_sha256": patch_sha256,
        "hunk_count": 2,
        "changed_files": ["pyproject.toml", "src/anycorn/config.py"],
        "build": {
            **toolchain,
            "backend": "uv_build-fast-path",
            "backend_version": PINNED_UV_VERSION,
            "source_date_epoch": int(SOURCE_DATE_EPOCH),
            "tz": "UTC",
            "lc_all": "C",
            "pythonhashseed": "0",
            "umask": "022",
            "build_dirs": [str(first_dir), str(second_dir)],
        },
        "wheel": {
            "filename": first_wheel.name,
            "sha256": first_sha256,
            "build_sha256": [first_sha256, second_sha256],
            "paths": [str(first_wheel), str(second_wheel)],
        },
    }
    result_path = root / "b1-build-result.json"
    result_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (BuildRefused, OSError, subprocess.CalledProcessError, tarfile.TarError, zipfile.BadZipFile) as error:
        print(f"D1 B1 build refused: {error}", file=sys.stderr)
        raise SystemExit(2) from None
