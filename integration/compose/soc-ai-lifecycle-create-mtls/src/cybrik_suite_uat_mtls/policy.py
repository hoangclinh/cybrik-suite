"""Static bind and TLS-builder policy for the prospective lifecycle-create mTLS UAT.

Status: `NOT IMPLEMENTED` — dependency-neutral preparation only.

This module is a pure decision table over text. It resolves the two reviewed
loopback surfaces, parses a candidate bind fail-closed, and decides whether a
symbolic SSL-context builder reference is admissible. It imports no vendored
server module, resolves no package, opens no listening socket, starts no
process, reads no certificate or key material, and performs no input or output.

Every rejection carries a stable machine reason and nothing else. The rejected
candidate is never placed in the exception message, arguments or representation,
because a rejected bind or reference may itself be credential-bearing text.
"""

from __future__ import annotations

import re
import types
from dataclasses import dataclass
from typing import Final

# --------------------------------------------------------------------------
# Rejection reasons
# --------------------------------------------------------------------------

SURFACE_UNKNOWN: Final = "surface_unknown"
SURFACE_BIND_MISMATCH: Final = "surface_bind_mismatch"

BIND_NOT_A_STRING: Final = "bind_not_a_string"
BIND_NOT_CANONICAL: Final = "bind_not_canonical"
BIND_MISSING_PORT_SEPARATOR: Final = "bind_missing_port_separator"
BIND_MULTIPLE_PORT_SEPARATORS: Final = "bind_multiple_port_separators"
BIND_AMBIGUOUS_IPV6: Final = "bind_ambiguous_ipv6"
BIND_WILDCARD_HOST: Final = "bind_wildcard_host"
BIND_HOST_NOT_IPV4_LITERAL: Final = "bind_host_not_ipv4_literal"
BIND_HOST_NOT_CANONICAL: Final = "bind_host_not_canonical"
BIND_HOST_NOT_LOOPBACK: Final = "bind_host_not_loopback"
BIND_PORT_MALFORMED: Final = "bind_port_malformed"
BIND_PORT_OUT_OF_RANGE: Final = "bind_port_out_of_range"

BUILDER_REFERENCE_NOT_DECLARED: Final = "builder_reference_not_declared"
BUILDER_SYMBOL_MALFORMED: Final = "builder_symbol_malformed"
BUILDER_IS_ANYCORN_BASE: Final = "builder_is_anycorn_base"
BUILDER_SYMBOL_NOT_ALLOWLISTED: Final = "builder_symbol_not_allowlisted"
BUILDER_DELEGATE_MALFORMED: Final = "builder_delegate_malformed"
BUILDER_DELEGATES_TO_ANYCORN_BASE: Final = "builder_delegates_to_anycorn_base"
BUILDER_DELEGATE_NOT_ALLOWLISTED: Final = "builder_delegate_not_allowlisted"
BUILDER_NOT_INTERNAL_PATCHED: Final = "builder_not_internal_patched"


class PolicyViolation(Exception):
    """A bind or builder reference that policy refuses.

    Only the stable reason is carried. The offending candidate is deliberately
    dropped so that no rejection path can become a leak path.
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


# --------------------------------------------------------------------------
# The two reviewed loopback surfaces
# --------------------------------------------------------------------------

AI_MTLS_SURFACE: Final = "ai_mtls"
POSTGRES_SURFACE: Final = "postgres_replay"

LOOPBACK_HOST: Final = "127.0.0.1"
MIN_PORT: Final = 1
MAX_PORT: Final = 65535

PROPOSED_BINDS: Final = types.MappingProxyType(
    {
        AI_MTLS_SURFACE: "127.0.0.1:58443",
        POSTGRES_SURFACE: "127.0.0.1:55432",
    }
)

_WILDCARD_HOSTS: Final = frozenset({"", "*", "0.0.0.0", "0", "::"})
_IPV4_GROUP_PATTERN: Final = r"[0-9]{1,3}"
_PORT_PATTERN: Final = r"[0-9]+"
_WHITESPACE_PATTERN: Final = r"\s"
_MAX_IPV4_GROUP: Final = 255
_IPV4_GROUP_COUNT: Final = 4


@dataclass(frozen=True)
class BindSurface:
    """A parsed, admissible loopback bind."""

    host: str
    port: int
    bind: str


def _reject_host(host: str) -> None:
    if host in _WILDCARD_HOSTS:
        raise PolicyViolation(BIND_WILDCARD_HOST)
    groups = host.split(".")
    if len(groups) != _IPV4_GROUP_COUNT:
        raise PolicyViolation(BIND_HOST_NOT_IPV4_LITERAL)
    for group in groups:
        if re.fullmatch(_IPV4_GROUP_PATTERN, group) is None:
            raise PolicyViolation(BIND_HOST_NOT_IPV4_LITERAL)
        if int(group) > _MAX_IPV4_GROUP:
            raise PolicyViolation(BIND_HOST_NOT_IPV4_LITERAL)
    for group in groups:
        if len(group) > 1 and group.startswith("0"):
            raise PolicyViolation(BIND_HOST_NOT_CANONICAL)
    if host != LOOPBACK_HOST:
        raise PolicyViolation(BIND_HOST_NOT_LOOPBACK)


def _parse_port(port_text: str) -> int:
    if re.fullmatch(_PORT_PATTERN, port_text) is None:
        raise PolicyViolation(BIND_PORT_MALFORMED)
    if len(port_text) > 1 and port_text.startswith("0"):
        raise PolicyViolation(BIND_PORT_MALFORMED)
    if len(port_text) > len(str(MAX_PORT)):
        raise PolicyViolation(BIND_PORT_OUT_OF_RANGE)
    port = int(port_text)
    if port < MIN_PORT or port > MAX_PORT:
        raise PolicyViolation(BIND_PORT_OUT_OF_RANGE)
    return port


def parse_loopback_bind(candidate: object) -> BindSurface:
    """Parse `host:port` and admit it only if it is exactly loopback IPv4.

    Wildcards, IPv6 in any notation, hostnames, non-canonical dotted quads and
    out-of-range ports are all refused. Nothing is normalised on the caller's
    behalf: an accepted bind is byte-identical to the candidate.
    """
    if not isinstance(candidate, str):
        raise PolicyViolation(BIND_NOT_A_STRING)
    if not candidate:
        raise PolicyViolation(BIND_NOT_CANONICAL)
    if re.search(_WHITESPACE_PATTERN, candidate) is not None:
        raise PolicyViolation(BIND_NOT_CANONICAL)
    if "[" in candidate or "]" in candidate or "::" in candidate:
        raise PolicyViolation(BIND_AMBIGUOUS_IPV6)

    separators = candidate.count(":")
    if separators == 0:
        raise PolicyViolation(BIND_MISSING_PORT_SEPARATOR)
    host, _, port_text = candidate.rpartition(":")
    if separators > 1:
        # A colon-rich head with no dotted quad is an IPv6 literal, not a bind
        # that merely repeated the port separator.
        if "." not in host:
            raise PolicyViolation(BIND_AMBIGUOUS_IPV6)
        raise PolicyViolation(BIND_MULTIPLE_PORT_SEPARATORS)

    _reject_host(host)
    return BindSurface(host=host, port=_parse_port(port_text), bind=candidate)


def resolve_proposed_surface(surface: object) -> BindSurface:
    """Resolve a reviewed surface name to its declared loopback bind."""
    if not isinstance(surface, str) or surface not in PROPOSED_BINDS:
        raise PolicyViolation(SURFACE_UNKNOWN)
    return parse_loopback_bind(PROPOSED_BINDS[surface])


def validate_proposed_bind(surface: object, candidate: object) -> BindSurface:
    """Admit a candidate bind only when it equals the surface's declared bind."""
    declared = resolve_proposed_surface(surface)
    resolved = parse_loopback_bind(candidate)
    if resolved != declared:
        raise PolicyViolation(SURFACE_BIND_MISMATCH)
    return resolved


# --------------------------------------------------------------------------
# SSL-context builder references — symbolic only
# --------------------------------------------------------------------------

# Dotted names, never imported objects. Naming the base builder as text is what
# lets this module refuse it without ever loading the vendored server package.
ANYCORN_BASE_SSL_CONTEXT_BUILDER: Final = "anycorn.config.Config.create_ssl_context"
INTERNAL_PATCHED_SSL_CONTEXT_BUILDER: Final = (
    "cybrik_suite_uat_mtls.server.build_patched_ssl_context"
)

ALLOWED_SSL_CONTEXT_BUILDERS: Final = frozenset(
    {INTERNAL_PATCHED_SSL_CONTEXT_BUILDER}
)
ALLOWED_SSL_CONTEXT_DELEGATES: Final = frozenset(
    {
        "ssl.SSLContext",
        "ssl.SSLContext.load_cert_chain",
        "ssl.SSLContext.load_verify_locations",
        "ssl.SSLContext.set_alpn_protocols",
        "ssl.SSLContext.set_ciphers",
    }
)

_ANYCORN_ROOT: Final = "anycorn"
_BASE_BUILDER_TAIL: Final = ("Config", "create_ssl_context")


@dataclass(frozen=True)
class SslContextBuilderReference:
    """A symbolic claim about which builder the prospective server would use."""

    symbol: str
    delegates_to: tuple[str, ...] = ()
    internal_patched: bool = False


def is_anycorn_base_builder(symbol: object) -> bool:
    """Report whether a dotted name resolves to the unpatched base builder.

    Vendored, re-exported and bare `Config.create_ssl_context` spellings all
    count. Shape validation is a precondition enforced by
    `validate_ssl_context_builder`, so a non-string is simply not that builder.
    """
    if not isinstance(symbol, str):
        return False
    parts = tuple(part for part in symbol.split(".") if part)
    if _ANYCORN_ROOT in {part.lower() for part in parts}:
        return True
    return parts[-2:] == _BASE_BUILDER_TAIL


def validate_ssl_context_builder(
    reference: object,
) -> SslContextBuilderReference:
    """Admit only the explicit internal patched builder reference.

    The raw base builder is refused, and so is an internal reference that
    merely delegates back to it: a hardened option set that a delegate can
    silently rebuild is not a hardened option set.
    """
    if not isinstance(reference, SslContextBuilderReference):
        raise PolicyViolation(BUILDER_REFERENCE_NOT_DECLARED)

    symbol = reference.symbol
    if not isinstance(symbol, str) or not symbol.strip():
        raise PolicyViolation(BUILDER_SYMBOL_MALFORMED)
    if is_anycorn_base_builder(symbol):
        raise PolicyViolation(BUILDER_IS_ANYCORN_BASE)
    if symbol not in ALLOWED_SSL_CONTEXT_BUILDERS:
        raise PolicyViolation(BUILDER_SYMBOL_NOT_ALLOWLISTED)

    delegates = reference.delegates_to
    if not isinstance(delegates, tuple):
        raise PolicyViolation(BUILDER_DELEGATE_MALFORMED)
    for delegate in delegates:
        if not isinstance(delegate, str) or not delegate.strip():
            raise PolicyViolation(BUILDER_DELEGATE_MALFORMED)
    for delegate in delegates:
        if is_anycorn_base_builder(delegate):
            raise PolicyViolation(BUILDER_DELEGATES_TO_ANYCORN_BASE)
        if delegate not in ALLOWED_SSL_CONTEXT_DELEGATES:
            raise PolicyViolation(BUILDER_DELEGATE_NOT_ALLOWLISTED)

    if reference.internal_patched is not True:
        raise PolicyViolation(BUILDER_NOT_INTERNAL_PATCHED)
    return reference
