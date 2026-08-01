"""Static RED/GREEN controls for the authored D2 Anycorn TLS path.

This target parses source and validates symbolic policy only. It imports no
runtime dependency and opens no socket. The real TLS assertions remain in the
separately authorized runtime target.
"""

from __future__ import annotations

import ast
from pathlib import Path

from cybrik_suite_uat_mtls import policy

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
