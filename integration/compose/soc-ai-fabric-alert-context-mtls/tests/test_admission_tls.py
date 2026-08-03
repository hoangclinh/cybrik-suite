"""Synthetic tests for the loopback mTLS admission boundary."""

from __future__ import annotations

import base64
import hashlib

import pytest
from cybrik_suite_uat_fabric import tls_process


def _certificate_pem(der: bytes) -> str:
    payload = base64.b64encode(der).decode()
    return f"-----BEGIN CERTIFICATE-----\n{payload}\n-----END CERTIFICATE-----\n"


def _tls_scope(der: bytes = b"synthetic DER") -> dict[str, object]:
    return {
        "headers": [(b"x-client-cn", b"untrusted")],
        "extensions": {
            "tls": {
                "client_cert_chain": (
                    _certificate_pem(der),
                    _certificate_pem(b"synthetic issuer DER"),
                ),
                "client_cert_error": None,
                "tls_version": 0x0304,
            }
        },
    }


def test_tls_surfaces_are_exact_loopback_ports() -> None:
    assert tls_process.SURFACES == {
        "soc": "127.0.0.1:58442",
        "cyber_ai": "127.0.0.1:58443",
        "tool_fabric": "127.0.0.1:58444",
    }
    assert tls_process.validate_surface("tool_fabric", "127.0.0.1:58444").port == 58444
    with pytest.raises(tls_process.TlsBoundaryFailure, match="surface_mismatch"):
        tls_process.validate_surface("tool_fabric", "0.0.0.0:58444")
    with pytest.raises(tls_process.TlsBoundaryFailure, match="surface_role_invalid"):
        tls_process.validate_surface("unknown", "127.0.0.1:58444")


def test_tls_context_is_narrowed_to_tls13_and_client_certificate_required() -> None:
    class Context:
        minimum_version: object | None = None
        maximum_version: object | None = None
        verify_mode: object | None = None

    context = Context()
    assert tls_process.require_server_mtls(context) is context
    assert context.minimum_version is tls_process.ssl.TLSVersion.TLSv1_3
    assert context.maximum_version is tls_process.ssl.TLSVersion.TLSv1_3
    assert context.verify_mode is tls_process.ssl.CERT_REQUIRED
    with pytest.raises(tls_process.TlsBoundaryFailure, match="tls_context_invalid"):
        tls_process.require_server_mtls(object())


def test_peer_authority_uses_only_tls_leaf_fingerprint() -> None:
    der = b"synthetic DER"
    fingerprint = hashlib.sha256(der).hexdigest()

    authority = tls_process.peer_authority_from_scope(
        _tls_scope(der), {fingerprint: "soc-uat-driver"}
    )

    assert authority.principal == "soc-uat-driver"
    assert authority.certificate_sha256 == fingerprint


@pytest.mark.parametrize(
    "scope,reason",
    (
        ({"headers": [(b"x-client-cn", b"soc-uat-driver")]}, "tls_extension_missing"),
        (
            {
                "extensions": {
                    "tls": {
                        "client_cert_chain": (),
                        "client_cert_error": None,
                        "tls_version": 0x0304,
                    }
                }
            },
            "client_certificate_chain_invalid",
        ),
        (
            {
                "extensions": {
                    "tls": {
                        "client_cert_chain": (_certificate_pem(b"one"),),
                        "client_cert_error": "verify failed",
                        "tls_version": 0x0304,
                    }
                }
            },
            "client_certificate_invalid",
        ),
        (
            {
                "extensions": {
                    "tls": {
                        "client_cert_chain": (_certificate_pem(b"one"),),
                        "client_cert_error": None,
                        "tls_version": "TLSv1.3",
                    }
                }
            },
            "tls_version_invalid",
        ),
    ),
)
def test_tls_peer_authority_fails_closed(scope: dict[str, object], reason: str) -> None:
    with pytest.raises(tls_process.TlsBoundaryFailure, match=reason):
        tls_process.peer_authority_from_scope(scope, {"0" * 64: "soc-uat-driver"})


def test_unknown_tls_fingerprint_is_not_replaced_by_cn_or_header_authority() -> None:
    with pytest.raises(tls_process.TlsBoundaryFailure, match="peer_not_authorized"):
        tls_process.peer_authority_from_scope(
            _tls_scope(), {"0" * 64: "soc-uat-driver"}
        )


def test_tls_authority_rejects_malformed_certificate_and_authority_map() -> None:
    malformed = _tls_scope()
    malformed["extensions"]["tls"]["client_cert_chain"] = (  # type: ignore[index]
        _certificate_pem(b"valid leaf"),
        "not PEM",
    )
    with pytest.raises(
        tls_process.TlsBoundaryFailure, match="client_certificate_chain_invalid"
    ):
        tls_process.peer_authority_from_scope(malformed, {"0" * 64: "soc-uat-driver"})

    fingerprint = hashlib.sha256(b"synthetic DER").hexdigest()
    with pytest.raises(
        tls_process.TlsBoundaryFailure, match="peer_authority_map_invalid"
    ):
        tls_process.peer_authority_from_scope(
            _tls_scope(), {fingerprint: "Invalid Name"}
        )
