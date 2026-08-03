"""Pure TLS/process-boundary helpers for the three UAT loopback surfaces.

This module does not create contexts, certificates, listeners, or processes.
It only narrows injected context objects and derives peer authority from the
verified leaf certificate delivered by the ASGI TLS extension.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import re
import ssl
from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Final

LOOPBACK_HOST: Final = "127.0.0.1"
SOC_PORT: Final = 58442
CYBER_AI_PORT: Final = 58443
TOOL_FABRIC_PORT: Final = 58444
SURFACES: Final = MappingProxyType(
    {
        "soc": f"{LOOPBACK_HOST}:{SOC_PORT}",
        "cyber_ai": f"{LOOPBACK_HOST}:{CYBER_AI_PORT}",
        "tool_fabric": f"{LOOPBACK_HOST}:{TOOL_FABRIC_PORT}",
    }
)
_HEX64 = re.compile(r"[0-9a-f]{64}")
_PRINCIPAL = re.compile(r"[a-z0-9][a-z0-9._-]{0,127}")
_PEM_BEGIN: Final = "-----BEGIN CERTIFICATE-----"
_PEM_END: Final = "-----END CERTIFICATE-----"


class TlsBoundaryFailure(RuntimeError):
    """A stable, non-reflecting TLS authority refusal."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class BindSurface:
    role: str
    host: str
    port: int


@dataclass(frozen=True, slots=True)
class PeerAuthority:
    principal: str
    certificate_sha256: str


def validate_surface(role: object, candidate: object) -> BindSurface:
    """Admit only the role's exact canonical IPv4 loopback bind."""

    if not isinstance(role, str) or role not in SURFACES:
        raise TlsBoundaryFailure("surface_role_invalid")
    if not isinstance(candidate, str) or candidate != SURFACES[role]:
        raise TlsBoundaryFailure("surface_mismatch")
    return BindSurface(
        role=role, host=LOOPBACK_HOST, port=int(candidate.rsplit(":", 1)[1])
    )


def require_server_mtls(context: object) -> object:
    """Narrow an injected server context to TLS 1.3 plus mandatory client cert."""

    for attribute in ("minimum_version", "maximum_version", "verify_mode"):
        if not hasattr(context, attribute):
            raise TlsBoundaryFailure("tls_context_invalid")
    try:
        context.minimum_version = ssl.TLSVersion.TLSv1_3  # type: ignore[attr-defined]
        context.maximum_version = ssl.TLSVersion.TLSv1_3  # type: ignore[attr-defined]
        context.verify_mode = ssl.CERT_REQUIRED  # type: ignore[attr-defined]
    except (AttributeError, TypeError, ValueError) as error:
        raise TlsBoundaryFailure("tls_context_narrowing_failed") from error
    if (
        context.minimum_version is not ssl.TLSVersion.TLSv1_3  # type: ignore[attr-defined]
        or context.maximum_version is not ssl.TLSVersion.TLSv1_3  # type: ignore[attr-defined]
        or context.verify_mode is not ssl.CERT_REQUIRED  # type: ignore[attr-defined]
    ):
        raise TlsBoundaryFailure("tls_context_narrowing_failed")
    return context


def _leaf_der(certificate: object) -> bytes:
    if not isinstance(certificate, str):
        raise TlsBoundaryFailure("client_certificate_chain_invalid")
    lines = certificate.strip().splitlines()
    if len(lines) < 3 or lines[0] != _PEM_BEGIN or lines[-1] != _PEM_END:
        raise TlsBoundaryFailure("client_certificate_chain_invalid")
    encoded = "".join(lines[1:-1])
    try:
        der = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise TlsBoundaryFailure("client_certificate_chain_invalid") from error
    if not der:
        raise TlsBoundaryFailure("client_certificate_chain_invalid")
    return der


def _validated_authorities(authorities: object) -> Mapping[str, str]:
    if not isinstance(authorities, Mapping) or not authorities:
        raise TlsBoundaryFailure("peer_authority_map_invalid")
    for fingerprint, principal in authorities.items():
        if (
            not isinstance(fingerprint, str)
            or _HEX64.fullmatch(fingerprint) is None
            or not isinstance(principal, str)
            or _PRINCIPAL.fullmatch(principal) is None
        ):
            raise TlsBoundaryFailure("peer_authority_map_invalid")
    return authorities


def peer_authority_from_scope(
    scope: object, fingerprint_to_principal: Mapping[str, str]
) -> PeerAuthority:
    """Resolve authority solely from a verified ASGI TLS leaf fingerprint."""

    if not isinstance(scope, Mapping):
        raise TlsBoundaryFailure("tls_scope_invalid")
    extensions = scope.get("extensions")
    if not isinstance(extensions, Mapping):
        raise TlsBoundaryFailure("tls_extension_missing")
    tls = extensions.get("tls")
    if not isinstance(tls, Mapping):
        raise TlsBoundaryFailure("tls_extension_missing")
    tls_version = tls.get("tls_version")
    if type(tls_version) is not int or tls_version != 0x0304:
        raise TlsBoundaryFailure("tls_version_invalid")
    if tls.get("client_cert_error") is not None:
        raise TlsBoundaryFailure("client_certificate_invalid")
    chain = tls.get("client_cert_chain")
    if not isinstance(chain, (list, tuple)) or not chain:
        raise TlsBoundaryFailure("client_certificate_chain_invalid")
    leaf_der = _leaf_der(chain[0])
    for certificate in chain[1:]:
        _leaf_der(certificate)
    fingerprint = hashlib.sha256(leaf_der).hexdigest()
    principal = _validated_authorities(fingerprint_to_principal).get(fingerprint)
    if principal is None:
        raise TlsBoundaryFailure("peer_not_authorized")
    return PeerAuthority(principal=principal, certificate_sha256=fingerprint)
