"""No-socket proof for the exact Anycorn B1 SSL-context patch.

This explicit D1 target imports Anycorn only inside the already-built isolated
environment.  It replaces ``socket.socket`` with a fail-closed sentinel before
the import and never opens a listener or product-runtime connection.
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import subprocess
import zipfile
from pathlib import Path

import pytest


_REPO_ROOT = Path(__file__).resolve().parents[4]
_HARNESS_ROOT = Path(__file__).resolve().parents[1]
_WHEEL_EVIDENCE = _HARNESS_ROOT / "evidence" / "internal-wheel.json"
_INTERNAL_VERSION = "0.20.0+cybrik.1"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _load_json(path: Path) -> dict[str, object]:
    assert path.is_file(), f"required D1 evidence is absent: {path.relative_to(_REPO_ROOT)}"
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


@pytest.fixture(scope="module")
def artifact_dir() -> Path:
    raw = os.environ.get("CYBRIK_UAT_D1_ARTIFACT_DIR")
    assert raw, "CYBRIK_UAT_D1_ARTIFACT_DIR is required for this explicit D1 target"
    candidate = Path(raw)
    assert candidate.is_absolute()
    resolved = candidate.resolve(strict=True)
    assert resolved.is_dir() and not resolved.is_relative_to(_REPO_ROOT)
    return resolved


def _is_context_options(node: ast.expr) -> bool:
    return (
        isinstance(node, ast.Attribute)
        and node.attr == "options"
        and isinstance(node.value, ast.Name)
        and node.value.id == "context"
    )


def test_exact_b1_wheel_contains_augmented_not_replaced_ssl_options(
    artifact_dir: Path,
) -> None:
    evidence = _load_json(_WHEEL_EVIDENCE)
    wheels = sorted(artifact_dir.rglob(evidence["filename"]))
    assert len(wheels) == 2
    assert all(_sha256(wheel) == evidence["sha256"] for wheel in wheels)

    with zipfile.ZipFile(wheels[0]) as archive:
        source = archive.read("anycorn/config.py").decode("utf-8")
    tree = ast.parse(source)
    methods = [
        node
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name == "create_ssl_context"
    ]
    assert len(methods) == 1

    augmented = [
        node
        for node in ast.walk(methods[0])
        if isinstance(node, ast.AugAssign)
        and _is_context_options(node.target)
        and isinstance(node.op, ast.BitOr)
    ]
    replaced = [
        node
        for node in ast.walk(methods[0])
        if isinstance(node, ast.Assign)
        and any(_is_context_options(target) for target in node.targets)
    ]
    assert len(augmented) == 1
    assert replaced == []


def test_no_socket_probe_preserves_seeded_secure_options_and_is_evidence_bound(
    artifact_dir: Path,
) -> None:
    evidence = _load_json(_WHEEL_EVIDENCE)
    python = artifact_dir / "offline-venv-r2" / "bin" / "python"
    assert python.is_file()

    script = r'''
import json
import _socket
import socket
import ssl

socket_calls = []

def forbidden_socket(*args, **kwargs):
    socket_calls.append((args, kwargs))
    raise AssertionError("D1 SSL-context proof may not create a socket")

socket.socket = forbidden_socket
socket.socketpair = forbidden_socket
_socket.socket = forbidden_socket

from importlib.metadata import version
import anycorn.config as anycorn_config

seeded = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
seeded.options |= ssl.OP_NO_TICKET
seeded_options = int(seeded.options)
anycorn_config.create_default_context = lambda purpose: seeded

class ProbeConfig(anycorn_config.Config):
    @property
    def ssl_enabled(self):
        return True

context = ProbeConfig().create_ssl_context()
print(json.dumps({
    "anycorn_version": version("anycorn"),
    "seeded_options": seeded_options,
    "result_options": int(context.options),
    "seeded_options_preserved": (int(context.options) & seeded_options) == seeded_options,
    "no_compression": bool(context.options & ssl.OP_NO_COMPRESSION),
    "no_ticket_seed_preserved": bool(context.options & ssl.OP_NO_TICKET),
    "socket_calls": len(socket_calls),
}, sort_keys=True))
'''
    completed = subprocess.run(
        [str(python), "-I", "-c", script],
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    probe = json.loads(completed.stdout)
    assert probe["anycorn_version"] == _INTERNAL_VERSION
    assert probe["seeded_options_preserved"] is True
    assert probe["no_compression"] is True
    assert probe["no_ticket_seed_preserved"] is True
    assert probe["socket_calls"] == 0
    assert evidence["ssl_context_probe"] == probe
    canonical_probe = json.dumps(probe, sort_keys=True, separators=(",", ":")).encode()
    assert evidence["ssl_context_probe_sha256"] == hashlib.sha256(canonical_probe).hexdigest()
