"""Static RED/GREEN controls for the authored D2 Anycorn TLS path.

This target parses source and validates symbolic policy only. It imports no
runtime dependency and opens no socket. The real TLS assertions remain in the
separately authorized runtime target.
"""

from __future__ import annotations

import ast
import json
import ssl
import sys
import types
from pathlib import Path

import pytest
from cybrik_suite_uat_mtls import harness as runtime_harness
from cybrik_suite_uat_mtls import policy
from cybrik_suite_uat_mtls import server as runtime_server

_ROOT = Path(__file__).resolve().parents[1]
_SERVER = _ROOT / "src/cybrik_suite_uat_mtls/server.py"
_B1_SHA256 = "d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c"


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

    for source, minimum_calls in ((server, 3), (harness, 2)):
        assert "_write_atomic_evidence" in source
        assert source.count("_write_atomic_evidence(") >= minimum_calls
        assert "os.O_EXCL" in source
        assert "0o600" in source
        assert "os.fsync" in source


@pytest.mark.parametrize(
    ("writer", "error_type"),
    (
        (runtime_server._write_atomic_evidence, runtime_server.ServerBoundaryError),
        (
            runtime_harness._write_atomic_evidence,
            runtime_harness.RuntimeAuthorizationError,
        ),
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

    anycorn_module = types.ModuleType("anycorn")
    config_module = types.ModuleType("anycorn.config")
    config_module.Config = FakeConfig
    anycorn_module.config = config_module
    monkeypatch.setitem(sys.modules, "anycorn", anycorn_module)
    monkeypatch.setitem(sys.modules, "anycorn.config", config_module)
    monkeypatch.setattr(
        runtime_server, "_verify_b1_artifact", lambda: Path("pinned.whl")
    )
    recorded: list[tuple[int, int]] = []
    monkeypatch.setattr(
        runtime_server,
        "_record_ssl_context_evidence",
        lambda before, after: recorded.append((before, after)),
        raising=False,
    )

    configured = runtime_server.build_patched_ssl_context(FakeConfig())

    assert configured is context
    assert context.minimum_version is ssl.TLSVersion.TLSv1_3
    assert context.maximum_version is ssl.TLSVersion.TLSv1_3
    assert context.verify_mode is ssl.CERT_REQUIRED
    assert context.options & ssl.OP_NO_COMPRESSION
    assert recorded == [(baseline_options, context.options)]
