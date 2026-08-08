"""TDD contract for the exact Anycorn B1 runtime boundary."""

from __future__ import annotations

import hashlib
import ssl
import sys
import types
from dataclasses import replace
from pathlib import Path
from typing import Self

import pytest
from cybrik_suite_uat_fabric import b1_runtime


class _Archive:
    def __init__(self, payloads: dict[str, bytes]) -> None:
        self._payloads = payloads

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> bool:
        return False

    def namelist(self) -> list[str]:
        return list(self._payloads)

    def read(self, name: str) -> bytes:
        return self._payloads[name]


def _exact_artifact(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> tuple[Path, type[object]]:
    wheel = tmp_path / b1_runtime.B1_WHEEL_FILENAME
    wheel.write_bytes(b"synthetic exact wheel")
    installed = tmp_path / "installed" / "anycorn"
    installed.mkdir(parents=True)
    (installed / "__init__.py").write_bytes(b"# exact\n")
    (installed / "config.py").write_bytes(b"CONFIG = 1\n")

    class Config:
        calls = 0

        @staticmethod
        def create_ssl_context(config: object) -> object:
            Config.calls += 1
            return config.context  # type: ignore[attr-defined]

    package = types.ModuleType("anycorn")
    package.__file__ = str(installed / "__init__.py")
    config_module = types.ModuleType("anycorn.config")
    config_module.Config = Config  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "anycorn", package)
    monkeypatch.setitem(sys.modules, "anycorn.config", config_module)
    monkeypatch.setattr(
        b1_runtime.importlib.metadata,
        "version",
        lambda name: b1_runtime.B1_VERSION,
    )
    monkeypatch.setattr(
        b1_runtime,
        "_sha256",
        lambda path: b1_runtime.B1_WHEEL_SHA256,
    )
    monkeypatch.setattr(
        b1_runtime.zipfile,
        "ZipFile",
        lambda path: _Archive(
            {
                "anycorn/__init__.py": b"# exact\n",
                "anycorn/config.py": b"CONFIG = 1\n",
            }
        ),
    )
    return wheel, Config


def test_import_is_inert_and_b1_identity_is_exact() -> None:
    assert b1_runtime.B1_WHEEL_FILENAME == ("anycorn-0.20.0+cybrik.1-py3-none-any.whl")
    assert b1_runtime.B1_VERSION == "0.20.0+cybrik.1"
    assert b1_runtime.B1_WHEEL_SHA256 == (
        "d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c"
    )
    assert "anycorn" not in b1_runtime.__dict__


def test_verify_b1_requires_exact_absolute_resolved_artifact_and_module_bytes(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    wheel, _ = _exact_artifact(monkeypatch, tmp_path)

    verified = b1_runtime.verify_b1_artifact(wheel.resolve())

    assert verified.path == wheel.resolve()
    assert verified.filename == b1_runtime.B1_WHEEL_FILENAME
    assert verified.version == b1_runtime.B1_VERSION
    assert verified.sha256 == b1_runtime.B1_WHEEL_SHA256
    assert verified.module_count == 2

    wrong_name = tmp_path / "wrong.whl"
    wrong_name.write_bytes(wheel.read_bytes())
    with pytest.raises(b1_runtime.B1BoundaryFailure, match="b1_filename_mismatch"):
        b1_runtime.verify_b1_artifact(wrong_name.resolve())

    monkeypatch.setattr(
        b1_runtime, "_sha256", lambda path: hashlib.sha256(b"wrong").hexdigest()
    )
    with pytest.raises(b1_runtime.B1BoundaryFailure, match="b1_digest_mismatch"):
        b1_runtime.verify_b1_artifact(wheel.resolve())


def test_verify_b1_rejects_installed_module_drift(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    wheel, _ = _exact_artifact(monkeypatch, tmp_path)
    monkeypatch.setattr(
        b1_runtime.zipfile,
        "ZipFile",
        lambda path: _Archive(
            {
                "anycorn/__init__.py": b"# exact\n",
                "anycorn/config.py": b"DRIFT = 1\n",
            }
        ),
    )

    with pytest.raises(b1_runtime.B1BoundaryFailure, match="b1_module_bytes_mismatch"):
        b1_runtime.verify_b1_artifact(wheel.resolve())


def test_verify_b1_fails_closed_for_path_version_and_config_boundaries(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    with pytest.raises(b1_runtime.B1BoundaryFailure, match="b1_path_invalid"):
        b1_runtime.verify_b1_artifact(Path("relative.whl"))

    wheel, config_type = _exact_artifact(monkeypatch, tmp_path)
    monkeypatch.setattr(b1_runtime.importlib.metadata, "version", lambda name: "0.20.0")
    with pytest.raises(b1_runtime.B1BoundaryFailure, match="b1_version_mismatch"):
        b1_runtime.verify_b1_artifact(wheel.resolve())

    monkeypatch.setattr(
        b1_runtime.importlib.metadata, "version", lambda name: b1_runtime.B1_VERSION
    )
    with pytest.raises(b1_runtime.B1BoundaryFailure, match="b1_config_type_mismatch"):
        b1_runtime.build_b1_server_context(object(), wheel=wheel.resolve(), role="soc")

    config = config_type()
    config.context = None  # type: ignore[attr-defined]
    with pytest.raises(
        b1_runtime.B1BoundaryFailure, match="b1_base_builder_returned_none"
    ):
        b1_runtime.build_b1_server_context(config, wheel=wheel.resolve(), role="soc")


class _Context:
    def __init__(self) -> None:
        self.minimum_version = ssl.TLSVersion.TLSv1_2
        self.maximum_version = ssl.TLSVersion.MAXIMUM_SUPPORTED
        self.verify_mode = ssl.CERT_NONE
        self.options = 0
        self.alpn: tuple[str, ...] = ()

    def set_alpn_protocols(self, protocols: list[str]) -> None:
        self.alpn = tuple(protocols)


def test_base_builder_runs_once_then_context_is_narrowed_fail_closed(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    wheel, config_type = _exact_artifact(monkeypatch, tmp_path)
    config = config_type()
    config.context = _Context()  # type: ignore[attr-defined]

    result = b1_runtime.build_b1_server_context(
        config, wheel=wheel.resolve(), role="cyber_ai"
    )

    assert config_type.calls == 1  # type: ignore[attr-defined]
    assert result.context is config.context  # type: ignore[attr-defined]
    assert result.context.minimum_version is ssl.TLSVersion.TLSv1_3
    assert result.context.maximum_version is ssl.TLSVersion.TLSv1_3
    assert result.context.verify_mode is ssl.CERT_REQUIRED
    assert result.context.options & ssl.OP_NO_COMPRESSION
    assert result.context.alpn == ("http/1.1",)
    assert result.evidence.role == "cyber_ai"
    assert result.evidence.alpn_protocols == ("http/1.1",)
    assert result.evidence.base_builder_called is True


def test_roles_are_exact_and_evidence_is_disjoint(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    wheel, config_type = _exact_artifact(monkeypatch, tmp_path)
    records = []
    for role in b1_runtime.RUNTIME_ROLES:
        config = config_type()
        config.context = _Context()  # type: ignore[attr-defined]
        records.append(
            b1_runtime.build_b1_server_context(
                config, wheel=wheel.resolve(), role=role
            ).evidence
        )

    assert b1_runtime.require_role_disjoint_evidence(records) == tuple(records)
    assert len({item.evidence_domain for item in records}) == 3
    assert all(item.issuance_id not in b1_runtime._ISSUED_EVIDENCE for item in records)
    with pytest.raises(b1_runtime.B1BoundaryFailure, match="b1_role_invalid"):
        b1_runtime.build_b1_server_context(
            config_type(), wheel=wheel.resolve(), role="unknown"
        )
    with pytest.raises(b1_runtime.B1BoundaryFailure, match="b1_role_evidence_mismatch"):
        b1_runtime.require_role_disjoint_evidence((*records[:-1], records[0]))


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("wheel_filename", "wrong.whl"),
        ("wheel_sha256", "0" * 64),
        ("anycorn_version", "0.20.0"),
        ("module_count", 0),
        ("module_count", 999),
        ("base_builder_called", False),
        ("tls_minimum", "TLSv1.2"),
        ("tls_maximum", "MAXIMUM_SUPPORTED"),
        ("verify_mode", "CERT_NONE"),
        ("alpn_protocols", ("h2",)),
        ("no_compression", False),
    ),
)
def test_role_disjoint_evidence_rejects_forged_b1_and_tls_claims(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    field: str,
    value: object,
) -> None:
    wheel, config_type = _exact_artifact(monkeypatch, tmp_path)
    records = []
    for role in b1_runtime.RUNTIME_ROLES:
        config = config_type()
        config.context = _Context()  # type: ignore[attr-defined]
        records.append(
            b1_runtime.build_b1_server_context(
                config, wheel=wheel.resolve(), role=role
            ).evidence
        )
    records[1] = replace(records[1], **{field: value})

    with pytest.raises(b1_runtime.B1BoundaryFailure, match="b1_role_evidence_mismatch"):
        b1_runtime.require_role_disjoint_evidence(records)
