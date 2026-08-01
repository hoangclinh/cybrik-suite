"""Fail-closed validation for authored, not-run UAT evidence.

The module accepts small JSON-like values, produces a detached canonical copy,
and rejects secret-bearing data rather than attempting to redact it.  Rejection
objects carry only stable reason codes and safe structural paths.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Final

SECRET_BEARING_KEY: Final = "secret_bearing_key"
BEARER_TOKEN: Final = "bearer_token"
AUTHORIZATION_HEADER: Final = "authorization_header"
JWT_VALUE: Final = "jwt_value"
PEM_PRIVATE_KEY: Final = "pem_private_key"
PEM_BLOCK_NOT_PERMITTED: Final = "pem_block_not_permitted"
DSN_CREDENTIALS: Final = "dsn_credentials"
INLINE_CREDENTIAL_ASSIGNMENT: Final = "inline_credential_assignment"
DIGEST_SHAPE_INVALID: Final = "digest_shape_invalid"
IDENTIFIER_SHAPE_INVALID: Final = "identifier_shape_invalid"
COUNT_SHAPE_INVALID: Final = "count_shape_invalid"
NON_STRING_KEY: Final = "non_string_key"
KEY_NOT_CANONICAL: Final = "key_not_canonical"
AMBIGUOUS_DUPLICATE_KEY: Final = "ambiguous_duplicate_key"
BINARY_VALUE_NOT_PERMITTED: Final = "binary_value_not_permitted"
UNSUPPORTED_TYPE: Final = "unsupported_type"
NUMBER_NOT_FINITE: Final = "number_not_finite"
VALUE_TOO_LONG: Final = "value_too_long"
MAX_DEPTH_EXCEEDED: Final = "max_depth_exceeded"
CONTAINER_TOO_LARGE: Final = "container_too_large"
INTEGER_OUT_OF_RANGE: Final = "integer_out_of_range"

MAX_DEPTH: Final = 8
MAX_TEXT_LENGTH: Final = 1024
MAX_CONTAINER_ITEMS: Final = 4096
MAX_INTEGER_BITS: Final = 256

_KEY_PATTERN: Final = r"[a-z][a-z0-9_-]{0,127}"
_IDENTIFIER_PATTERN: Final = r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"
_DIGEST_PATTERN: Final = r"[0-9a-f]{64}"
_JWT_PATTERN: Final = (
    r"(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\."
    r"[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])"
)
_BEARER_PATTERN: Final = r"\bbearer[ \t]+\S+"
_AUTHORIZATION_PATTERN: Final = r"\bauthorization\s*[:=]"
_PEM_PRIVATE_PATTERN: Final = r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"
_PEM_PATTERN: Final = r"-----BEGIN [A-Z0-9 ]+-----"
_CREDENTIALED_DSN_PATTERN: Final = r"\b[a-z][a-z0-9+.-]*://[^\s@:]+:[^\s@]+@"
_JSON_CREDENTIAL_PATTERN: Final = (
    r"[\"'](?:authorization|password|passwd|pwd|client_secret|api_key|token|cnf)"
    r"[\"']\s*:"
)
_INLINE_CREDENTIAL_PATTERN: Final = (
    r"(?i)(?:^|[\s;,?&])(?:password|passwd|pwd|client_secret|api_key|token|cnf)\s*[:=]"
)

_SECRET_KEY_EXACT: Final = frozenset(
    {
        "authorization",
        "proxy_authorization",
        "password",
        "pgpassword",
        "client_secret",
        "private_key",
        "api_key",
        "cnf",
        "dsn",
        "token",
        "certificate_pem",
    }
)
_SECRET_KEY_PARTS: Final = frozenset(
    {
        "authorization",
        "bearer",
        "cnf",
        "dsn",
        "jwt",
        "password",
        "passwd",
        "private",
        "secret",
        "token",
    }
)
_SAFE_KEY_EXACT: Final = frozenset(
    {
        "cnf_thumbprint_sha256",
        "dsn_digest_sha256",
        "jwt_fingerprint",
        "token_id",
    }
)


class EvidenceRejected(Exception):
    """A safe, stable refusal that never retains the rejected value."""

    def __init__(self, reason: str, path: str = "$") -> None:
        super().__init__(reason)
        self.reason = reason
        self.path = path


def _canonical_key(key: str) -> str:
    return key.replace("-", "_").casefold()


def _secret_key(key: str) -> bool:
    canonical = _canonical_key(key)
    if canonical in _SAFE_KEY_EXACT:
        return False
    if canonical in _SECRET_KEY_EXACT:
        return True
    parts = frozenset(part for part in canonical.split("_") if part)
    return bool(parts & _SECRET_KEY_PARTS)


def secret_reason(text: object) -> str | None:
    """Return the stable secret class for text, or ``None`` when clean."""

    if not isinstance(text, str):
        return None
    if re.search(_BEARER_PATTERN, text, re.IGNORECASE) is not None:
        return BEARER_TOKEN
    if re.search(_AUTHORIZATION_PATTERN, text, re.IGNORECASE) is not None:
        return AUTHORIZATION_HEADER
    if re.search(_JWT_PATTERN, text) is not None:
        return JWT_VALUE
    if re.search(_PEM_PRIVATE_PATTERN, text, re.IGNORECASE) is not None:
        return PEM_PRIVATE_KEY
    if re.search(_PEM_PATTERN, text, re.IGNORECASE) is not None:
        return PEM_BLOCK_NOT_PERMITTED
    if re.search(_CREDENTIALED_DSN_PATTERN, text, re.IGNORECASE) is not None:
        return DSN_CREDENTIALS
    if re.search(_JSON_CREDENTIAL_PATTERN, text, re.IGNORECASE) is not None:
        return INLINE_CREDENTIAL_ASSIGNMENT
    if re.search(_INLINE_CREDENTIAL_PATTERN, text) is not None:
        return INLINE_CREDENTIAL_ASSIGNMENT
    return None


def _safe_child_path(path: str, key: str) -> str:
    if re.fullmatch(_KEY_PATTERN, key) is None or secret_reason(key) is not None:
        return f"{path}.[rejected]"
    return f"{path}.{key}"


def _validate_key_shape(key: str, value: object, path: str) -> None:
    canonical = _canonical_key(key)
    if _secret_key(key):
        raise EvidenceRejected(SECRET_BEARING_KEY, path)
    if re.fullmatch(_KEY_PATTERN, key) is None:
        raise EvidenceRejected(KEY_NOT_CANONICAL, path)
    if canonical.endswith("_sha256") or canonical.endswith("_fingerprint"):
        if not isinstance(value, str) or re.fullmatch(_DIGEST_PATTERN, value) is None:
            raise EvidenceRejected(DIGEST_SHAPE_INVALID, path)
    if canonical.endswith("_id"):
        if not isinstance(value, str) or re.fullmatch(_IDENTIFIER_PATTERN, value) is None:
            raise EvidenceRejected(IDENTIFIER_SHAPE_INVALID, path)
    if canonical.endswith("_count"):
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise EvidenceRejected(COUNT_SHAPE_INVALID, path)


def _validated(value: object, path: str, depth: int) -> object:
    if depth > MAX_DEPTH:
        raise EvidenceRejected(MAX_DEPTH_EXCEEDED, path)

    if isinstance(value, Mapping):
        if len(value) > MAX_CONTAINER_ITEMS:
            raise EvidenceRejected(CONTAINER_TOO_LARGE, path)
        items = tuple(value.items())
        folded: set[str] = set()
        for key, _ in items:
            if not isinstance(key, str):
                raise EvidenceRejected(NON_STRING_KEY, path)
            canonical = _canonical_key(key)
            if canonical in folded:
                raise EvidenceRejected(AMBIGUOUS_DUPLICATE_KEY, path)
            folded.add(canonical)

        result: dict[str, object] = {}
        for key, child in sorted(items, key=lambda item: item[0]):
            child_path = _safe_child_path(path, key)
            _validate_key_shape(key, child, child_path)
            result[key] = _validated(child, child_path, depth + 1)
        return result

    if isinstance(value, (list, tuple)):
        if len(value) > MAX_CONTAINER_ITEMS:
            raise EvidenceRejected(CONTAINER_TOO_LARGE, path)
        return [
            _validated(child, f"{path}[{index}]", depth + 1)
            for index, child in enumerate(value)
        ]
    if isinstance(value, (bytes, bytearray, memoryview)):
        raise EvidenceRejected(BINARY_VALUE_NOT_PERMITTED, path)
    if isinstance(value, str):
        if len(value) > MAX_TEXT_LENGTH:
            raise EvidenceRejected(VALUE_TOO_LONG, path)
        reason = secret_reason(value)
        if reason is not None:
            raise EvidenceRejected(reason, path)
        return value
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, int):
        if value.bit_length() > MAX_INTEGER_BITS:
            raise EvidenceRejected(INTEGER_OUT_OF_RANGE, path)
        return value
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            raise EvidenceRejected(NUMBER_NOT_FINITE, path)
        return value
    raise EvidenceRejected(UNSUPPORTED_TYPE, path)


def validate_evidence(value: object) -> object:
    """Validate and return a detached, deterministic JSON-like copy."""

    return _validated(value, "$", 0)
