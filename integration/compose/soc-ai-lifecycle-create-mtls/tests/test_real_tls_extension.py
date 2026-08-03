"""Static RED/GREEN controls for the authored D2 Anycorn TLS path.

This target parses source and validates symbolic policy only. It imports no
runtime dependency and opens no socket. The real TLS assertions remain in the
separately authorized runtime target.
"""

from __future__ import annotations

import ast
import asyncio
import base64
import json
import os
import ssl
import stat
import sys
import types
import zipfile
from contextlib import AbstractContextManager
from pathlib import Path
from typing import ClassVar, Self

import pytest
from cybrik_suite_uat_mtls import client as runtime_client
from cybrik_suite_uat_mtls import harness as runtime_harness
from cybrik_suite_uat_mtls import pki as runtime_pki
from cybrik_suite_uat_mtls import policy
from cybrik_suite_uat_mtls import server as runtime_server

_ROOT = Path(__file__).resolve().parents[1]
_SERVER = _ROOT / "src/cybrik_suite_uat_mtls/server.py"
_B1_SHA256 = "d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c"


def _install_fake_anycorn_config(
    monkeypatch: pytest.MonkeyPatch, config_type: type[object]
) -> None:
    anycorn_module = types.ModuleType("anycorn")
    config_module = types.ModuleType("anycorn.config")
    config_module.Config = config_type
    anycorn_module.config = config_module
    monkeypatch.setitem(sys.modules, "anycorn", anycorn_module)
    monkeypatch.setitem(sys.modules, "anycorn.config", config_module)


def _run_async(awaitable: object) -> object:
    return asyncio.run(awaitable)  # type: ignore[arg-type]


def _install_fake_module(
    monkeypatch: pytest.MonkeyPatch, name: str, **attributes: object
) -> types.ModuleType:
    module = types.ModuleType(name)
    for key, value in attributes.items():
        setattr(module, key, value)
    monkeypatch.setitem(sys.modules, name, module)
    return module


def _authorized_pki_root(
    root: Path,
) -> AbstractContextManager[runtime_pki.AuthorizedPkiRoot]:
    """Pre-create the authorized 0700 root and open its live capability."""

    root.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
    os.chmod(root, runtime_pki.PKI_DIRECTORY_MODE)
    prepared = os.lstat(root)
    return runtime_pki.authorized_pki_root(
        root,
        expected_device=prepared.st_dev,
        expected_inode=prepared.st_ino,
        expected_uid=prepared.st_uid,
        expected_mode=stat.S_IMODE(prepared.st_mode),
    )


def _pki_material(root: Path) -> runtime_pki.PkiMaterial:
    prepared = os.lstat(root)
    return runtime_pki.PkiMaterial(
        root=root,
        ca_certificate=root / "ca-cert.pem",
        server_certificate=root / "server-cert.pem",
        server_private_key=root / "server-key.pem",
        client_certificate=root / "client-cert.pem",
        client_private_key=root / "client-key.pem",
        alternate_client_certificate=root / "alternate-client-cert.pem",
        alternate_client_private_key=root / "alternate-client-key.pem",
        jwt_private_key=root / "jwt-signing-key.pem",
        jwt_public_jwk=root / "jwt-public-jwk.json",
        root_identity=runtime_pki.PkiRootIdentity(
            device=prepared.st_dev,
            inode=prepared.st_ino,
            uid=prepared.st_uid,
            mode=stat.S_IMODE(prepared.st_mode),
        ),
    )


def _server_tree() -> ast.Module:
    assert _SERVER.is_file(), "D2 server module is not authored"
    return ast.parse(_SERVER.read_text(encoding="utf-8"), filename=str(_SERVER))


def test_server_declares_the_exact_pinned_b1_builder_reference() -> None:
    source = _SERVER.read_text(encoding="utf-8") if _SERVER.is_file() else ""
    assert source
    assert _B1_SHA256 in source
    assert "installed_modules != wheel_modules" in source
    tree = _server_tree()
    assignments = {
        target.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign)
        for target in node.targets
        if isinstance(target, ast.Name)
    }
    assert "BUILDER_REFERENCE" in assignments


def test_server_builder_calls_the_patched_base_then_pins_tls13_and_mtls() -> None:
    tree = _server_tree()
    functions = {
        node.name: node
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    builder = functions.get("build_patched_ssl_context")
    assert builder is not None
    text = ast.unparse(builder)
    assert "Config.create_ssl_context" in text
    assert "TLSVersion.TLSv1_3" in text
    assert "CERT_REQUIRED" in text
    assert "minimum_version" in text and "maximum_version" in text


def test_server_never_names_an_alternate_asgi_server() -> None:
    source = _SERVER.read_text(encoding="utf-8") if _SERVER.is_file() else ""
    assert source
    assert "uvicorn" not in source.casefold()


def test_policy_accepts_only_the_digest_bound_b1_delegate() -> None:
    reference = policy.SslContextBuilderReference(
        symbol=policy.INTERNAL_PATCHED_SSL_CONTEXT_BUILDER,
        delegates_to=(policy.ANYCORN_BASE_SSL_CONTEXT_BUILDER,),
        internal_patched=True,
        artifact_sha256=_B1_SHA256,
    )
    assert policy.validate_ssl_context_builder(reference) is reference


def test_tls_extension_evidence_is_preserved_and_asserted_before_rollback() -> None:
    server = _SERVER.read_text(encoding="utf-8")
    harness = (_SERVER.parent / "harness.py").read_text(encoding="utf-8")
    assert "CYBRIK_UAT_D2_EVIDENCE_DIR" in server
    assert 'CYBRIK_UAT_D2_RUNTIME_DIR") / "tls-extension.json"' not in server
    for required in (
        "_assert_mtls_evidence",
        "0x0304",
        "client_certificate_count",
        "cipher_suite",
        "client_cert_error_absent",
        "server_certificate_present",
    ):
        assert required in harness


def test_ssl_context_hardening_bits_are_recorded_and_asserted() -> None:
    server = _SERVER.read_text(encoding="utf-8")
    harness = (_SERVER.parent / "harness.py").read_text(encoding="utf-8")
    for required in (
        "ssl-context.json",
        "OP_NO_COMPRESSION",
        "baseline_options",
        "hardened_options_preserved",
        "no_compression_verified",
    ):
        assert required in server
    assert "_assert_ssl_context_evidence" in harness
    assert "ssl_hardened_options_preserved" in harness
    assert "ssl_no_compression_verified" in harness


def test_ssl_context_evidence_is_recomputed_instead_of_trusting_booleans(
    tmp_path: Path,
) -> None:
    baseline = int(ssl.create_default_context(ssl.Purpose.CLIENT_AUTH).options)
    result = baseline | int(ssl.OP_NO_COMPRESSION)
    path = tmp_path / "ssl-context.json"
    path.write_text(
        json.dumps(
            {
                "baseline_options": baseline,
                "hardened_options_preserved": True,
                "no_compression_verified": True,
                "result_options": result,
            }
        ),
        encoding="utf-8",
    )

    assert runtime_harness._assert_ssl_context_evidence(tmp_path) == {
        "ssl_hardened_options_preserved": True,
        "ssl_no_compression_verified": True,
    }

    path.write_text(
        json.dumps(
            {
                "baseline_options": int(ssl.OP_NO_COMPRESSION),
                "hardened_options_preserved": True,
                "no_compression_verified": True,
                "result_options": result,
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(runtime_harness.RuntimeAuthorizationError):
        runtime_harness._assert_ssl_context_evidence(tmp_path)

    path.write_text(
        json.dumps(
            {
                "baseline_options": baseline,
                "hardened_options_preserved": True,
                "no_compression_verified": True,
                "result_options": result & ~int(ssl.OP_NO_COMPRESSION),
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(runtime_harness.RuntimeAuthorizationError):
        runtime_harness._assert_ssl_context_evidence(tmp_path)


def test_every_runtime_evidence_write_is_exclusive_durable_and_mode_bounded() -> None:
    server = _SERVER.read_text(encoding="utf-8")
    harness = (_SERVER.parent / "harness.py").read_text(encoding="utf-8")
    client = (_SERVER.parent / "client.py").read_text(encoding="utf-8")

    for source, minimum_calls in ((server, 3), (harness, 2), (client, 3)):
        assert "_write_atomic_evidence" in source
        assert source.count("_write_atomic_evidence(") >= minimum_calls
        assert "os.O_EXCL" in source
        assert "0o600" in source
        assert "os.fsync" in source
        assert ".write_text(" not in source
    assert "or result_path.is_symlink()" in harness


@pytest.mark.parametrize(
    ("writer", "error_type"),
    (
        (runtime_server._write_atomic_evidence, runtime_server.ServerBoundaryError),
        (
            runtime_harness._write_atomic_evidence,
            runtime_harness.RuntimeAuthorizationError,
        ),
        (runtime_client._write_atomic_evidence, runtime_client.ClientBoundaryError),
    ),
)
def test_atomic_evidence_writer_rejects_a_preexisting_temporary_symlink(
    tmp_path: Path, writer: object, error_type: type[Exception]
) -> None:
    destination = tmp_path / "evidence.json"
    writer(destination, {"case_count": 1})  # type: ignore[operator]
    assert json.loads(destination.read_text(encoding="utf-8")) == {"case_count": 1}
    assert destination.stat().st_mode & 0o777 == 0o600
    assert not destination.with_suffix(".tmp").exists()

    destination.unlink()
    sentinel = tmp_path / "sentinel"
    sentinel.write_text("unchanged", encoding="utf-8")
    destination.with_suffix(".tmp").symlink_to(sentinel)
    with pytest.raises(error_type):
        writer(destination, {"case_count": 2})  # type: ignore[operator]
    assert sentinel.read_text(encoding="utf-8") == "unchanged"
    assert not destination.exists()


def test_ssl_context_wrapper_executes_the_pinned_base_then_applies_exact_floor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    baseline_options = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH).options

    class FakeContext:
        minimum_version: object | None = None
        maximum_version: object | None = None
        verify_mode: object | None = None
        options = baseline_options | ssl.OP_NO_COMPRESSION

    context = FakeContext()

    class FakeConfig:
        def create_ssl_context(self) -> FakeContext:
            return context

    _install_fake_anycorn_config(monkeypatch, FakeConfig)
    monkeypatch.setattr(
        runtime_server, "_verify_b1_artifact", lambda: Path("pinned.whl")
    )
    recorded: list[tuple[int, int]] = []
    monkeypatch.setattr(
        runtime_server,
        "_record_ssl_context_evidence",
        lambda before, after: recorded.append((before, after)),
    )

    configured = runtime_server.build_patched_ssl_context(FakeConfig())

    assert configured is context
    assert context.minimum_version is ssl.TLSVersion.TLSv1_3
    assert context.maximum_version is ssl.TLSVersion.TLSv1_3
    assert context.verify_mode is ssl.CERT_REQUIRED
    assert context.options & ssl.OP_NO_COMPRESSION
    assert recorded == [(baseline_options, context.options)]


def test_ssl_context_wrapper_rejects_a_non_anycorn_config_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeConfig:
        def create_ssl_context(self) -> object:
            raise AssertionError("should not be called")

    _install_fake_anycorn_config(monkeypatch, FakeConfig)
    monkeypatch.setattr(
        runtime_server, "_verify_b1_artifact", lambda: Path("pinned.whl")
    )

    with pytest.raises(
        runtime_server.ServerBoundaryError, match="config type mismatch"
    ):
        runtime_server.build_patched_ssl_context(object())


def test_ssl_context_wrapper_rejects_a_missing_base_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeConfig:
        def create_ssl_context(self) -> None:
            return None

    _install_fake_anycorn_config(monkeypatch, FakeConfig)
    monkeypatch.setattr(
        runtime_server, "_verify_b1_artifact", lambda: Path("pinned.whl")
    )

    with pytest.raises(runtime_server.ServerBoundaryError, match="was not created"):
        runtime_server.build_patched_ssl_context(FakeConfig())


@pytest.mark.parametrize(
    ("regression", "message"),
    (
        ("minimum", "TLS minimum was not retained"),
        ("maximum", "TLS maximum was not retained"),
        ("verify", "mutual TLS was not retained"),
        ("options", "discarded hardened default options"),
        ("compression", "did not disable TLS compression"),
    ),
)
def test_ssl_context_wrapper_rejects_post_build_regressions(
    monkeypatch: pytest.MonkeyPatch,
    regression: str,
    message: str,
) -> None:
    if regression == "compression":
        monkeypatch.setattr(
            ssl,
            "create_default_context",
            lambda purpose: types.SimpleNamespace(options=0),
        )
    baseline_options = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH).options

    class FakeContext:
        def __init__(self) -> None:
            self._minimum_version: object | None = None
            self._maximum_version: object | None = None
            self._verify_mode: object | None = None
            self.options = (
                0
                if regression == "options"
                else baseline_options
                | (0 if regression == "compression" else int(ssl.OP_NO_COMPRESSION))
            )

        @property
        def minimum_version(self) -> object | None:
            return self._minimum_version

        @minimum_version.setter
        def minimum_version(self, value: object) -> None:
            self._minimum_version = (
                ssl.TLSVersion.TLSv1_2 if regression == "minimum" else value
            )

        @property
        def maximum_version(self) -> object | None:
            return self._maximum_version

        @maximum_version.setter
        def maximum_version(self, value: object) -> None:
            self._maximum_version = (
                ssl.TLSVersion.TLSv1_2 if regression == "maximum" else value
            )

        @property
        def verify_mode(self) -> object | None:
            return self._verify_mode

        @verify_mode.setter
        def verify_mode(self, value: object) -> None:
            self._verify_mode = ssl.CERT_NONE if regression == "verify" else value

    class FakeConfig:
        def create_ssl_context(self) -> FakeContext:
            return FakeContext()

    _install_fake_anycorn_config(monkeypatch, FakeConfig)
    monkeypatch.setattr(
        runtime_server, "_verify_b1_artifact", lambda: Path("pinned.whl")
    )
    monkeypatch.setattr(
        runtime_server, "_record_ssl_context_evidence", lambda before, after: None
    )

    with pytest.raises(runtime_server.ServerBoundaryError, match=message):
        runtime_server.build_patched_ssl_context(FakeConfig())


def test_record_ssl_context_evidence_writes_validated_json(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(tmp_path))
    runtime_server._record_ssl_context_evidence(7, 7 | int(ssl.OP_NO_COMPRESSION))

    payload = json.loads((tmp_path / "ssl-context.json").read_text(encoding="utf-8"))
    assert payload == {
        "baseline_options": 7,
        "hardened_options_preserved": True,
        "no_compression_verified": True,
        "result_options": 7 | int(ssl.OP_NO_COMPRESSION),
    }


def test_server_required_path_rejects_missing_and_relative_values(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("CYBRIK_REQUIRED_PATH", raising=False)
    with pytest.raises(runtime_server.ServerBoundaryError, match="path is absent"):
        runtime_server._required_path("CYBRIK_REQUIRED_PATH")

    monkeypatch.setenv("CYBRIK_REQUIRED_PATH", "relative/path")
    with pytest.raises(runtime_server.ServerBoundaryError, match="path is absent"):
        runtime_server._required_path("CYBRIK_REQUIRED_PATH")

    absolute = tmp_path / "artifact.json"
    absolute.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("CYBRIK_REQUIRED_PATH", str(absolute))
    assert runtime_server._required_path("CYBRIK_REQUIRED_PATH") == absolute.resolve(
        strict=True
    )


def test_tls_evidence_middleware_strips_tls_extension_before_calling_app(
    tmp_path: Path,
) -> None:
    observed: list[dict[str, object]] = []

    async def app(scope: dict[str, object], receive: object, send: object) -> None:
        del receive, send
        observed.append(scope)

    middleware = runtime_server._TlsEvidenceMiddleware(
        app,
        evidence_path=tmp_path / "tls-extension.json",
        strip_tls=True,
    )
    original_scope = {
        "type": "http",
        "extensions": {"tls": {"tls_version": 0x0304}, "other": {"ok": True}},
    }

    _run_async(middleware(original_scope, object(), object()))

    assert original_scope["extensions"] == {
        "tls": {"tls_version": 0x0304},
        "other": {"ok": True},
    }
    assert observed == [
        {"type": "http", "extensions": {"other": {"ok": True}}},
    ]
    assert not (tmp_path / "tls-extension.json").exists()


def test_tls_evidence_middleware_records_validated_tls_summary(tmp_path: Path) -> None:
    observed: list[dict[str, object]] = []

    async def app(scope: dict[str, object], receive: object, send: object) -> None:
        del receive, send
        observed.append(scope)

    evidence_path = tmp_path / "tls-extension.json"
    middleware = runtime_server._TlsEvidenceMiddleware(
        app,
        evidence_path=evidence_path,
        strip_tls=False,
    )
    scope = {
        "type": "http",
        "extensions": {
            "tls": {
                "cipher_suite": 0x1301,
                "client_cert_chain": ("leaf", "issuer"),
                "client_cert_error": None,
                "server_cert": "pem",
                "tls_version": 0x0304,
            }
        },
    }

    _run_async(middleware(scope, object(), object()))

    assert observed == [scope]
    assert json.loads(evidence_path.read_text(encoding="utf-8")) == {
        "cipher_suite": 0x1301,
        "client_cert_error_absent": True,
        "client_certificate_count": 2,
        "server_certificate_present": True,
        "tls_version": 0x0304,
    }


def test_tls_evidence_middleware_skips_non_mapping_tls_payload(tmp_path: Path) -> None:
    observed: list[dict[str, object]] = []

    async def app(scope: dict[str, object], receive: object, send: object) -> None:
        del receive, send
        observed.append(scope)

    evidence_path = tmp_path / "tls-extension.json"
    middleware = runtime_server._TlsEvidenceMiddleware(
        app,
        evidence_path=evidence_path,
        strip_tls=False,
    )
    scope = {"type": "http", "extensions": {"tls": "not-a-dict"}}

    _run_async(middleware(scope, object(), object()))

    assert observed == [scope]
    assert not evidence_path.exists()


def test_pki_root_must_be_an_absolute_prepared_directory_outside_repositories(
    tmp_path: Path,
) -> None:
    repository_root = tmp_path / "repo"
    repository_root.mkdir()

    with pytest.raises(runtime_pki.PkiBoundaryError, match="must be an absolute path"):
        runtime_pki._authorized_root_path(Path("relative"))

    with pytest.raises(runtime_pki.PkiBoundaryError, match="must be a named directory"):
        runtime_pki._authorized_root_path(Path("/"))

    with pytest.raises(runtime_pki.PkiBoundaryError, match="must already exist"):
        runtime_pki._authorized_root_path(tmp_path / "missing-pki")

    existing = tmp_path / "existing-pki"
    existing.mkdir()
    symlink_root = tmp_path / "symlink-pki"
    symlink_root.symlink_to(existing)
    with pytest.raises(
        runtime_pki.PkiBoundaryError, match="must be supplied already resolved"
    ):
        runtime_pki._authorized_root_path(symlink_root)

    assert runtime_pki._authorized_root_path(existing) == existing

    nested = repository_root / "nested"
    nested.mkdir()
    for inside in (repository_root, nested):
        with pytest.raises(
            runtime_pki.PkiBoundaryError, match="outside every repository"
        ):
            runtime_pki._assert_outside_repositories(
                inside, repository_roots=(repository_root,)
            )

    runtime_pki._assert_outside_repositories(
        existing, repository_roots=(repository_root,)
    )


def test_pki_write_removes_the_partial_leaf_when_the_stream_fails(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    root = tmp_path / "pki-root"
    root.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
    destination = root / "key.pem"

    class BrokenStream:
        def __enter__(self) -> Self:
            return self

        def __exit__(self, exc_type: object, exc: object, tb: object) -> bool:
            return False

        def write(self, payload: bytes) -> None:
            del payload
            raise RuntimeError("boom")

        def flush(self) -> None:
            raise AssertionError("flush should not be called")

        def fileno(self) -> int:
            return 0

    monkeypatch.setattr(runtime_pki.os, "fdopen", lambda fd, mode: BrokenStream())

    root_descriptor = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for unsafe in ("", ".", "..", "nested/key.pem"):
            with pytest.raises(runtime_pki.PkiBoundaryError, match="single component"):
                runtime_pki._PinnedLeaf(name=unsafe, root_descriptor=root_descriptor)

        leaf = runtime_pki._PinnedLeaf(name="key.pem", root_descriptor=root_descriptor)
        with pytest.raises(RuntimeError, match="boom"):
            runtime_pki._write(leaf, b"secret", runtime_pki.PRIVATE_FILE_MODE)
    finally:
        os.close(root_descriptor)

    assert not destination.exists()


def test_certificate_thumbprint_sha256_uses_base64url_without_padding(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    certificate_path = tmp_path / "leaf.pem"
    certificate_path.write_text("PEM", encoding="utf-8")
    digest = b"\x01" * 32
    captured: list[bytes] = []

    class FakeCertificate:
        def fingerprint(self, algorithm: object) -> bytes:
            assert algorithm.__class__.__name__ == "FakeSha256"
            return digest

    def load_pem_x509_certificate(payload: bytes) -> FakeCertificate:
        captured.append(payload)
        return FakeCertificate()

    fake_x509 = types.ModuleType("cryptography.x509")
    fake_x509.load_pem_x509_certificate = load_pem_x509_certificate
    fake_hashes = types.ModuleType("cryptography.hazmat.primitives.hashes")

    class FakeSha256:
        pass

    fake_hashes.SHA256 = FakeSha256
    fake_cryptography = types.ModuleType("cryptography")
    fake_cryptography.x509 = fake_x509
    fake_hazmat = types.ModuleType("cryptography.hazmat")
    fake_primitives = types.ModuleType("cryptography.hazmat.primitives")
    fake_primitives.hashes = fake_hashes
    fake_hazmat.primitives = fake_primitives

    monkeypatch.setitem(sys.modules, "cryptography", fake_cryptography)
    monkeypatch.setitem(sys.modules, "cryptography.x509", fake_x509)
    monkeypatch.setitem(sys.modules, "cryptography.hazmat", fake_hazmat)
    monkeypatch.setitem(sys.modules, "cryptography.hazmat.primitives", fake_primitives)
    monkeypatch.setitem(
        sys.modules, "cryptography.hazmat.primitives.hashes", fake_hashes
    )

    result = runtime_pki.certificate_thumbprint_sha256(certificate_path)

    assert captured == [b"PEM"]
    assert result == base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    assert "=" not in result


def test_material_manifest_hashes_only_public_artifacts(tmp_path: Path) -> None:
    material = runtime_pki.PkiMaterial(
        root=tmp_path,
        ca_certificate=tmp_path / "ca-cert.pem",
        server_certificate=tmp_path / "server-cert.pem",
        server_private_key=tmp_path / "server-key.pem",
        client_certificate=tmp_path / "client-cert.pem",
        client_private_key=tmp_path / "client-key.pem",
        alternate_client_certificate=tmp_path / "alternate-client-cert.pem",
        alternate_client_private_key=tmp_path / "alternate-client-key.pem",
        jwt_private_key=tmp_path / "jwt-signing-key.pem",
        jwt_public_jwk=tmp_path / "jwt-public-jwk.json",
    )
    public_payloads = {
        material.ca_certificate: b"ca",
        material.server_certificate: b"server",
        material.client_certificate: b"client",
        material.alternate_client_certificate: b"alternate",
        material.jwt_public_jwk: b'{"keys":[]}',
    }
    for path, payload in public_payloads.items():
        path.write_bytes(payload)

    manifest = runtime_pki.material_manifest(material)

    assert manifest == {
        "certificate_count": 4,
        "ephemeral": True,
        "outside_repository": True,
        "public_artifact_count": 5,
        "public_artifact_sha256": [
            runtime_pki.hashlib.sha256(public_payloads[path]).hexdigest()
            for path in (
                material.ca_certificate,
                material.server_certificate,
                material.client_certificate,
                material.alternate_client_certificate,
                material.jwt_public_jwk,
            )
        ],
    }


def test_destroy_ephemeral_pki_rejects_unsafe_roots_and_is_idempotent(
    tmp_path: Path,
) -> None:
    unsafe = runtime_pki.PkiMaterial(
        root=Path("."),
        ca_certificate=Path("a"),
        server_certificate=Path("b"),
        server_private_key=Path("c"),
        client_certificate=Path("d"),
        client_private_key=Path("e"),
        alternate_client_certificate=Path("f"),
        alternate_client_private_key=Path("g"),
        jwt_private_key=Path("h"),
        jwt_public_jwk=Path("i"),
    )
    with pytest.raises(runtime_pki.PkiBoundaryError, match="unsafe PKI teardown root"):
        runtime_pki.destroy_ephemeral_pki(unsafe)

    target = tmp_path / "pki-root"
    target.mkdir()
    (target / "leaf.pem").write_text("leaf", encoding="utf-8")
    material = _pki_material(target)
    runtime_pki.destroy_ephemeral_pki(material)
    assert not target.exists()
    runtime_pki.destroy_ephemeral_pki(material)

    symlink_root = tmp_path / "symlink-root"
    symlink_root.symlink_to(tmp_path / "missing-target")
    with pytest.raises(runtime_pki.PkiBoundaryError, match="symlinked PKI teardown"):
        runtime_pki.destroy_ephemeral_pki(
            runtime_pki.PkiMaterial(
                root=symlink_root,
                ca_certificate=symlink_root / "ca-cert.pem",
                server_certificate=symlink_root / "server-cert.pem",
                server_private_key=symlink_root / "server-key.pem",
                client_certificate=symlink_root / "client-cert.pem",
                client_private_key=symlink_root / "client-key.pem",
                alternate_client_certificate=symlink_root / "alternate-client-cert.pem",
                alternate_client_private_key=symlink_root / "alternate-client-key.pem",
                jwt_private_key=symlink_root / "jwt-signing-key.pem",
                jwt_public_jwk=symlink_root / "jwt-public-jwk.json",
            )
        )


def test_verify_absent_reports_false_for_existing_root_and_symlink(
    tmp_path: Path,
) -> None:
    root = tmp_path / "pki-root"
    root.mkdir()
    material = _pki_material(root)
    assert runtime_pki.verify_absent(material) is False

    runtime_pki.destroy_ephemeral_pki(material)
    assert runtime_pki.verify_absent(material) is True

    symlink_root = tmp_path / "symlink-root"
    symlink_root.symlink_to(tmp_path / "target")
    symlink_material = runtime_pki.PkiMaterial(
        root=symlink_root,
        ca_certificate=symlink_root / "ca-cert.pem",
        server_certificate=symlink_root / "server-cert.pem",
        server_private_key=symlink_root / "server-key.pem",
        client_certificate=symlink_root / "client-cert.pem",
        client_private_key=symlink_root / "client-key.pem",
        alternate_client_certificate=symlink_root / "alternate-client-cert.pem",
        alternate_client_private_key=symlink_root / "alternate-client-key.pem",
        jwt_private_key=symlink_root / "jwt-signing-key.pem",
        jwt_public_jwk=symlink_root / "jwt-public-jwk.json",
    )
    assert runtime_pki.verify_absent(symlink_material) is False


def test_destroy_ephemeral_pki_rejects_root_replacement_during_teardown(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Teardown must not delete a directory that replaced the authorized root."""

    target = tmp_path / "pki-root"
    displaced_root = tmp_path / "pki-root-pinned"
    replacement_marker = "replacement-owned.txt"
    target.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
    os.chmod(target, runtime_pki.PKI_DIRECTORY_MODE)
    (target / "leaf.pem").write_text("leaf", encoding="utf-8")
    material = _pki_material(target)
    original_unlink = os.unlink
    replaced = False

    def replace_after_leaf_unlink(
        path: os.PathLike[str] | str | bytes,
        *args: object,
        dir_fd: int | None = None,
    ) -> None:
        nonlocal replaced
        if dir_fd is None:
            original_unlink(path, *args)
        else:
            original_unlink(path, *args, dir_fd=dir_fd)
        if not replaced and Path(path).name == "leaf.pem":
            replaced = True
            target.rename(displaced_root)
            target.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
            os.chmod(target, runtime_pki.PKI_DIRECTORY_MODE)
            (target / replacement_marker).write_text(
                "replacement sentinel\n", encoding="utf-8"
            )

    monkeypatch.setattr(runtime_pki.os, "unlink", replace_after_leaf_unlink)

    with pytest.raises(
        runtime_pki.PkiBoundaryError, match="identity changed during destruction"
    ):
        runtime_pki.destroy_ephemeral_pki(material)

    assert replaced is True
    assert (target / replacement_marker).is_file()
    assert list(displaced_root.iterdir()) == []


def test_verify_b1_artifact_rejects_filename_digest_and_version_mismatches(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    wrong_name = tmp_path / "wrong-name.whl"
    wrong_name.write_bytes(b"wheel")
    monkeypatch.setattr(runtime_server, "_required_path", lambda name: wrong_name)
    with pytest.raises(
        runtime_server.ServerBoundaryError, match="filename is not exact"
    ):
        runtime_server._verify_b1_artifact()

    pinned_name = tmp_path / "anycorn-0.20.0+cybrik.1-py3-none-any.whl"
    pinned_name.write_bytes(b"wheel")
    monkeypatch.setattr(runtime_server, "_required_path", lambda name: pinned_name)
    monkeypatch.setattr(runtime_server, "_sha256", lambda path: "bad-digest")
    with pytest.raises(runtime_server.ServerBoundaryError, match="digest mismatch"):
        runtime_server._verify_b1_artifact()

    monkeypatch.setattr(
        runtime_server, "_sha256", lambda path: runtime_server.B1_WHEEL_SHA256
    )
    monkeypatch.setattr(
        runtime_server.importlib.metadata, "version", lambda name: "0.0"
    )
    with pytest.raises(
        runtime_server.ServerBoundaryError, match="installed Anycorn version mismatch"
    ):
        runtime_server._verify_b1_artifact()


def test_verify_b1_artifact_rejects_module_mismatch_and_accepts_exact_match(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    wheel = tmp_path / "anycorn-0.20.0+cybrik.1-py3-none-any.whl"
    wheel.write_bytes(b"wheel")
    installed_root = tmp_path / "installed-anycorn"
    installed_root.mkdir()
    init_file = installed_root / "__init__.py"
    init_file.write_text("# anycorn\n", encoding="utf-8")
    (installed_root / "config.py").write_text("installed = 1\n", encoding="utf-8")

    monkeypatch.setattr(runtime_server, "_required_path", lambda name: wheel)
    monkeypatch.setattr(
        runtime_server, "_sha256", lambda path: runtime_server.B1_WHEEL_SHA256
    )
    monkeypatch.setattr(
        runtime_server.importlib.metadata,
        "version",
        lambda name: runtime_server.B1_VERSION,
    )
    monkeypatch.setitem(
        sys.modules, "anycorn", types.SimpleNamespace(__file__=str(init_file))
    )

    class FakeArchive:
        def __init__(self, payloads: dict[str, bytes]) -> None:
            self._payloads = payloads

        def __enter__(self) -> Self:
            return self

        def __exit__(self, exc_type: object, exc: object, tb: object) -> bool:
            return False

        def namelist(self) -> list[str]:
            return list(self._payloads)

        def read(self, name: str) -> bytes:
            return self._payloads[name]

    monkeypatch.setattr(
        zipfile,
        "ZipFile",
        lambda path: FakeArchive(
            {
                "anycorn/__init__.py": b"# anycorn\n",
                "anycorn/config.py": b"wheel = 1\n",
            }
        ),
    )

    with pytest.raises(runtime_server.ServerBoundaryError, match="modules differ"):
        runtime_server._verify_b1_artifact()

    (installed_root / "config.py").write_text("wheel = 1\n", encoding="utf-8")
    assert runtime_server._verify_b1_artifact() == wheel


def test_investigation_service_uses_in_memory_dependencies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeStore:
        pass

    class FakeCheckpointLog:
        pass

    class FakeLedger:
        pass

    class FakeRegistry:
        pass

    class FakeOutbox:
        pass

    class FakeRunStateStore:
        pass

    class FakeClock:
        pass

    class FakeController:
        def __init__(self, **kwargs: object) -> None:
            self.kwargs = kwargs

    class FakeDeps:
        def __init__(
            self,
            controller: object,
            context_store: object,
            checkpoint_log: object,
            clock: object,
        ) -> None:
            self.controller = controller
            self.context_store = context_store
            self.checkpoint_log = checkpoint_log
            self.clock = clock

    class FakeService:
        def __init__(self, deps: object) -> None:
            self.deps = deps

    _install_fake_module(
        monkeypatch,
        "cybrik_ai_api.investigations.service",
        InMemoryInvestigationContextStore=FakeStore,
        InvestigationService=FakeService,
        InvestigationServiceDeps=FakeDeps,
    )
    _install_fake_module(
        monkeypatch,
        "cybrik_ai_core.orchestration.checkpoints",
        InMemoryCheckpointLog=FakeCheckpointLog,
    )
    _install_fake_module(
        monkeypatch,
        "cybrik_ai_core.orchestration.controller",
        OrchestrationController=FakeController,
    )
    _install_fake_module(
        monkeypatch,
        "cybrik_ai_core.orchestration.memory",
        InMemoryEffectLedger=FakeLedger,
        InMemoryIdempotencyRegistry=FakeRegistry,
        InMemoryOutbox=FakeOutbox,
        InMemoryRunStateStore=FakeRunStateStore,
    )
    _install_fake_module(
        monkeypatch,
        "cybrik_ai_core.orchestration.ports",
        SystemClock=FakeClock,
    )

    service = runtime_server._investigation_service()

    assert isinstance(service, FakeService)
    assert isinstance(service.deps.controller, FakeController)
    assert isinstance(service.deps.context_store, FakeStore)
    assert isinstance(service.deps.checkpoint_log, FakeCheckpointLog)
    assert isinstance(service.deps.clock, FakeClock)
    assert isinstance(service.deps.controller.kwargs["state_store"], FakeRunStateStore)
    assert isinstance(service.deps.controller.kwargs["idempotency"], FakeRegistry)
    assert isinstance(service.deps.controller.kwargs["ledger"], FakeLedger)
    assert isinstance(service.deps.controller.kwargs["outbox"], FakeOutbox)
    assert service.deps.controller.kwargs["clock"] is service.deps.clock


def test_application_builds_runtime_and_rejects_disabled_composition(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    jwks_path = tmp_path / "jwks.json"
    jwks_path.write_text('{"keys":[{"kid":"k1"}]}', encoding="utf-8")
    monkeypatch.setattr(runtime_server, "_required_path", lambda name: jwks_path)
    monkeypatch.setenv("CYBRIK_UAT_D2_POSTGRES_DSN", "postgres://runtime")
    monkeypatch.setattr(runtime_server, "_investigation_service", lambda: "service")

    class FakeTrustMetadata:
        received: dict[str, object] | None = None

        @classmethod
        def model_validate(cls, payload: dict[str, object]) -> dict[str, object]:
            cls.received = payload
            return {"validated": payload}

    class FakePinnedTrustProvider:
        calls: ClassVar[list[tuple[object, object]]] = []

        @classmethod
        def from_pinned_jwks(cls, trust: object, jwks: object) -> dict[str, object]:
            cls.calls.append((trust, jwks))
            return {"trust": trust, "jwks": jwks}

    class FakeSettings:
        def __init__(
            self, *, enabled: bool, runtime_dsn: str, runtime_role_name: str
        ) -> None:
            self.enabled = enabled
            self.runtime_dsn = runtime_dsn
            self.runtime_role_name = runtime_role_name

    class FakeDeps:
        def __init__(self, **kwargs: object) -> None:
            self.kwargs = kwargs

    class FakeResolver:
        def __init__(self, *, audience: str, trust_domain: str) -> None:
            self.audience = audience
            self.trust_domain = trust_domain

    class FakeVerifier:
        pass

    captured: list[tuple[object, object]] = []

    def compose_lifecycle_runtime(settings: object, deps: object) -> object:
        captured.append((settings, deps))
        return {"app": True, "deps": deps}

    _install_fake_module(
        monkeypatch,
        "cybrik_ai_api.runtime_composition",
        LifecycleRuntimeCompositionDeps=FakeDeps,
        compose_lifecycle_runtime=compose_lifecycle_runtime,
    )
    _install_fake_module(
        monkeypatch,
        "cybrik_ai_api.runtime_settings",
        LifecycleRuntimeSettings=FakeSettings,
    )
    _install_fake_module(
        monkeypatch,
        "cybrik_ai_api.transport_security",
        AsgiTlsTransportResolver=FakeResolver,
    )
    _install_fake_module(
        monkeypatch,
        "cybrik_ai_core.delegation",
        CryptographySignatureVerifier=FakeVerifier,
        PinnedTrustProvider=FakePinnedTrustProvider,
        TrustMetadata=FakeTrustMetadata,
    )

    app = runtime_server._application()

    assert app["app"] is True
    settings, deps = captured[0]
    assert settings.enabled is True
    assert settings.runtime_dsn == "postgres://runtime"
    assert settings.runtime_role_name == "cybrik_ai_api_app"
    assert deps.kwargs["service"] == "service"
    assert deps.kwargs["transport_resolver"].audience == runtime_server.AI_AUDIENCE
    assert deps.kwargs["transport_resolver"].trust_domain == runtime_server.TRUST_DOMAIN
    assert isinstance(deps.kwargs["signature_verifier"], FakeVerifier)
    assert FakeTrustMetadata.received is not None
    assert FakeTrustMetadata.received["accepted_issuers"] == [runtime_server.ISSUER_ID]
    assert FakePinnedTrustProvider.calls == [
        ({"validated": FakeTrustMetadata.received}, {"keys": [{"kid": "k1"}]})
    ]

    _install_fake_module(
        monkeypatch,
        "cybrik_ai_api.runtime_composition",
        LifecycleRuntimeCompositionDeps=FakeDeps,
        compose_lifecycle_runtime=lambda settings, deps: None,
    )
    with pytest.raises(
        runtime_server.ServerBoundaryError, match="composition remained disabled"
    ):
        runtime_server._application()


def test_serve_wires_config_middleware_signal_handlers_and_shutdown(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    events: dict[str, object] = {"signals": []}

    class FakeBaseConfig:
        def __init__(self) -> None:
            self.bind: list[str] | None = None
            self.certfile: str | None = None
            self.keyfile: str | None = None
            self.ca_certs: str | None = None
            self.verify_mode: object | None = None
            self.alpn_protocols: list[str] | None = None
            self.accesslog: object = "sentinel"
            self.errorlog: object = "sentinel"
            self.workers: int | None = None

    async def fake_serve(
        app: object, config: object, *, shutdown_trigger: object, mode: str
    ) -> None:
        events["app"] = app
        events["config"] = config
        events["mode"] = mode
        events["shutdown_trigger"] = shutdown_trigger
        await shutdown_trigger()

    class FakeLoop:
        def add_signal_handler(self, member: object, handler: object) -> None:
            events["signals"].append(member)
            handler()

    _install_fake_module(
        monkeypatch,
        "anycorn",
        Config=FakeBaseConfig,
        serve=fake_serve,
    )
    _install_fake_module(
        monkeypatch,
        "cybrik_suite_uat_mtls.harness",
        assert_runtime_authorized=lambda: events.setdefault("authorized", True),
    )
    monkeypatch.setattr(runtime_server, "_verify_b1_artifact", lambda: Path("wheel"))
    monkeypatch.setattr(runtime_server, "_application", lambda: {"inner": True})
    monkeypatch.setattr(runtime_server.asyncio, "get_running_loop", lambda: FakeLoop())

    pki_root = tmp_path / "pki"
    pki_root.mkdir()
    evidence_root = tmp_path / "evidence"
    evidence_root.mkdir()
    monkeypatch.setattr(
        runtime_server,
        "_required_path",
        lambda name: pki_root if name == "CYBRIK_UAT_D2_PKI_ROOT" else evidence_root,
    )
    monkeypatch.setenv("CYBRIK_UAT_D2_STRIP_TLS_EXTENSION", "true")

    _run_async(runtime_server._serve())

    config = events["config"]
    assert events["authorized"] is True
    assert config.bind == ["127.0.0.1:58443"]
    assert config.certfile == str(pki_root / "server-cert.pem")
    assert config.keyfile == str(pki_root / "server-key.pem")
    assert config.ca_certs == str(pki_root / "ca-cert.pem")
    assert config.verify_mode is ssl.CERT_REQUIRED
    assert config.alpn_protocols == ["http/1.1"]
    assert config.accesslog is None
    assert config.errorlog == "-"
    assert config.workers == 1
    assert events["mode"] == "asgi"
    assert events["signals"] == [
        runtime_server.signal.SIGINT,
        runtime_server.signal.SIGTERM,
    ]

    middleware = events["app"]
    assert isinstance(middleware, runtime_server._TlsEvidenceMiddleware)
    assert middleware._app == {"inner": True}
    assert middleware._evidence_path == evidence_root / "tls-extension.json"
    assert middleware._strip_tls is True

    build_calls: list[object] = []
    monkeypatch.setattr(
        runtime_server,
        "build_patched_ssl_context",
        lambda current: build_calls.append(current) or "ssl",
    )
    assert config.create_ssl_context() == "ssl"
    assert build_calls == [config]


def test_main_returns_zero_or_two_based_on_serve_outcome(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def consume(awaitable: object) -> None:
        awaitable.close()  # type: ignore[attr-defined]

    monkeypatch.setattr(runtime_server.asyncio, "run", consume)
    assert runtime_server.main() == 0

    for exc in (
        runtime_server.ServerBoundaryError("boom"),
        KeyError("x"),
        OSError("x"),
        ValueError("x"),
    ):

        def raise_exc(awaitable: object, *, _exc: BaseException = exc) -> None:
            awaitable.close()  # type: ignore[attr-defined]
            raise _exc

        monkeypatch.setattr(runtime_server.asyncio, "run", raise_exc)
        assert runtime_server.main() == 2


def test_public_jwk_encodes_coordinates_as_base64url_without_padding() -> None:
    class FakeNumbers:
        x = 1
        y = 255

    class FakeKey:
        def public_numbers(self) -> FakeNumbers:
            return FakeNumbers()

    assert runtime_pki._public_jwk(FakeKey(), kid="kid-1") == {
        "alg": "ES256",
        "crv": "P-256",
        "kid": "kid-1",
        "kty": "EC",
        "x": base64.urlsafe_b64encode((1).to_bytes(32, "big"))
        .rstrip(b"=")
        .decode("ascii"),
        "y": base64.urlsafe_b64encode((255).to_bytes(32, "big"))
        .rstrip(b"=")
        .decode("ascii"),
    }


def test_create_ephemeral_pki_writes_expected_artifacts_with_faked_cryptography(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls: list[tuple[str, bytes, int]] = []
    repository_root = tmp_path / "repo"
    repository_root.mkdir()

    class FakePublicKey:
        def __init__(self, label: str) -> None:
            self.label = label

        def public_numbers(self) -> object:
            base = {"ca": 1, "server": 2, "client": 3, "alternate": 4, "jwt": 5}[
                self.label
            ]
            return types.SimpleNamespace(x=base, y=base + 10)

    class FakePrivateKey:
        def __init__(self, label: str) -> None:
            self.label = label

        def public_key(self) -> FakePublicKey:
            return FakePublicKey(self.label)

        def private_bytes(self, **kwargs: object) -> bytes:
            return f"private:{self.label}:{kwargs['format']}".encode("ascii")

    class FakeCertificate:
        def __init__(self, label: str) -> None:
            self.label = label

        def public_bytes(self, encoding: object) -> bytes:
            return f"cert:{self.label}:{encoding}".encode("ascii")

    class FakeBuilder:
        def __init__(self) -> None:
            self.subject: object | None = None

        def subject_name(self, value: object) -> Self:
            self.subject = value
            return self

        def issuer_name(self, value: object) -> Self:
            return self

        def public_key(self, value: object) -> Self:
            return self

        def serial_number(self, value: object) -> Self:
            return self

        def not_valid_before(self, value: object) -> Self:
            return self

        def not_valid_after(self, value: object) -> Self:
            return self

        def add_extension(self, value: object, critical: bool) -> Self:
            return self

        def sign(self, key: object, algorithm: object) -> FakeCertificate:
            common_name = self.subject.attributes[0].value
            if common_name == "Cybrik D2 ephemeral CA":
                return FakeCertificate("ca")
            if common_name == runtime_pki.SERVER_NAME:
                return FakeCertificate("server")
            if common_name == "cybrik-soc-d2-client":
                return FakeCertificate("client")
            return FakeCertificate("alternate")

    _install_fake_module(
        monkeypatch,
        "cryptography.x509",
        Name=lambda attributes: types.SimpleNamespace(attributes=attributes),
        NameAttribute=lambda oid, value: types.SimpleNamespace(oid=oid, value=value),
        CertificateBuilder=FakeBuilder,
        BasicConstraints=lambda ca, path_length: ("basic", ca, path_length),
        KeyUsage=lambda **kwargs: ("key_usage", kwargs),
        ExtendedKeyUsage=lambda values: ("eku", values),
        SubjectAlternativeName=lambda values: ("san", values),
        DNSName=lambda value: ("dns", value),
        IPAddress=lambda value: ("ip", value),
        random_serial_number=lambda: 42,
    )
    _install_fake_module(
        monkeypatch,
        "cryptography.x509.oid",
        ExtendedKeyUsageOID=types.SimpleNamespace(
            SERVER_AUTH="server-auth", CLIENT_AUTH="client-auth"
        ),
        NameOID=types.SimpleNamespace(COMMON_NAME="common-name"),
    )
    key_labels = iter(["ca", "server", "client", "alternate", "jwt"])
    fake_ec = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat.primitives.asymmetric.ec",
        SECP256R1=lambda: "curve",
        generate_private_key=lambda curve: FakePrivateKey(next(key_labels)),
    )
    fake_hashes = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat.primitives.hashes",
        SHA256=lambda: "sha256",
    )
    fake_serialization = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat.primitives.serialization",
        Encoding=types.SimpleNamespace(PEM="pem"),
        PrivateFormat=types.SimpleNamespace(PKCS8="pkcs8"),
        NoEncryption=lambda: "no-encryption",
    )
    fake_primitives = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat.primitives",
        hashes=fake_hashes,
        serialization=fake_serialization,
    )
    _install_fake_module(
        monkeypatch, "cryptography.hazmat.primitives.asymmetric", ec=fake_ec
    )
    fake_hazmat = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat",
        primitives=fake_primitives,
    )
    _install_fake_module(
        monkeypatch,
        "cryptography",
        x509=sys.modules["cryptography.x509"],
        hazmat=fake_hazmat,
    )
    monkeypatch.setattr(
        runtime_pki,
        "_write",
        lambda leaf, payload, mode: calls.append((leaf.name, payload, mode)),
    )

    with _authorized_pki_root(tmp_path / "ephemeral-pki") as capability:
        material = runtime_pki.create_ephemeral_pki(
            capability,
            repository_roots=(repository_root,),
            jwt_kid="jwt-kid",
        )

    assert material.root == (tmp_path / "ephemeral-pki").resolve(strict=True)
    assert [name for name, _, _ in calls] == [
        "ca-cert.pem",
        "server-cert.pem",
        "server-key.pem",
        "client-cert.pem",
        "client-key.pem",
        "alternate-client-cert.pem",
        "alternate-client-key.pem",
        "jwt-signing-key.pem",
        "jwt-public-jwk.json",
    ]
    assert any(
        name == "jwt-public-jwk.json" and b'"kid":"jwt-kid"' in payload
        for name, payload, _ in calls
    )
    assert all(
        mode in {runtime_pki.PUBLIC_FILE_MODE, runtime_pki.PRIVATE_FILE_MODE}
        for _, _, mode in calls
    )


def test_create_ephemeral_pki_removes_only_created_leaves_when_a_write_fails(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Failure must retract the created leaves and keep the authorized root."""

    destroyed: list[Path] = []
    written: list[str] = []
    repository_root = tmp_path / "repo"
    repository_root.mkdir()

    class FakePrivateKey:
        def public_key(self) -> object:
            return types.SimpleNamespace(
                public_numbers=lambda: types.SimpleNamespace(x=1, y=2)
            )

        def private_bytes(self, **kwargs: object) -> bytes:
            return b"private"

    class FakeCertificate:
        def public_bytes(self, encoding: object) -> bytes:
            return b"cert"

    class FakeBuilder:
        def subject_name(self, value: object) -> Self:
            self.subject = value
            return self

        def issuer_name(self, value: object) -> Self:
            return self

        def public_key(self, value: object) -> Self:
            return self

        def serial_number(self, value: object) -> Self:
            return self

        def not_valid_before(self, value: object) -> Self:
            return self

        def not_valid_after(self, value: object) -> Self:
            return self

        def add_extension(self, value: object, critical: bool) -> Self:
            return self

        def sign(self, key: object, algorithm: object) -> FakeCertificate:
            return FakeCertificate()

    _install_fake_module(
        monkeypatch,
        "cryptography.x509",
        Name=lambda attributes: types.SimpleNamespace(attributes=attributes),
        NameAttribute=lambda oid, value: types.SimpleNamespace(oid=oid, value=value),
        CertificateBuilder=FakeBuilder,
        BasicConstraints=lambda ca, path_length: ("basic", ca, path_length),
        KeyUsage=lambda **kwargs: ("key_usage", kwargs),
        ExtendedKeyUsage=lambda values: ("eku", values),
        SubjectAlternativeName=lambda values: ("san", values),
        DNSName=lambda value: ("dns", value),
        IPAddress=lambda value: ("ip", value),
        random_serial_number=lambda: 42,
    )
    _install_fake_module(
        monkeypatch,
        "cryptography.x509.oid",
        ExtendedKeyUsageOID=types.SimpleNamespace(
            SERVER_AUTH="server-auth", CLIENT_AUTH="client-auth"
        ),
        NameOID=types.SimpleNamespace(COMMON_NAME="common-name"),
    )
    fake_ec = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat.primitives.asymmetric.ec",
        SECP256R1=lambda: "curve",
        generate_private_key=lambda curve: FakePrivateKey(),
    )
    fake_hashes = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat.primitives.hashes",
        SHA256=lambda: "sha256",
    )
    fake_serialization = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat.primitives.serialization",
        Encoding=types.SimpleNamespace(PEM="pem"),
        PrivateFormat=types.SimpleNamespace(PKCS8="pkcs8"),
        NoEncryption=lambda: "no-encryption",
    )
    fake_primitives = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat.primitives",
        hashes=fake_hashes,
        serialization=fake_serialization,
    )
    _install_fake_module(
        monkeypatch, "cryptography.hazmat.primitives.asymmetric", ec=fake_ec
    )
    fake_hazmat = _install_fake_module(
        monkeypatch,
        "cryptography.hazmat",
        primitives=fake_primitives,
    )
    _install_fake_module(
        monkeypatch,
        "cryptography",
        x509=sys.modules["cryptography.x509"],
        hazmat=fake_hazmat,
    )
    real_write = runtime_pki._write

    def fail_after_two_leaves(leaf: object, payload: bytes, mode: int) -> None:
        if len(written) == 2:
            raise RuntimeError("write failed")
        written.append(leaf.name)  # type: ignore[attr-defined]
        real_write(leaf, payload, mode)

    monkeypatch.setattr(runtime_pki, "_write", fail_after_two_leaves)
    monkeypatch.setattr(
        runtime_pki,
        "destroy_ephemeral_pki",
        lambda material: destroyed.append(material.root),
    )

    root = tmp_path / "pki-root"
    with (
        _authorized_pki_root(root) as capability,
        pytest.raises(RuntimeError, match="write failed"),
    ):
        runtime_pki.create_ephemeral_pki(
            capability,
            repository_roots=(repository_root,),
            jwt_kid="jwt-kid",
        )

    assert written == ["ca-cert.pem", "server-cert.pem"]
    assert destroyed == []
    assert root.is_dir()
    assert list(root.iterdir()) == []
