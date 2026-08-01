"""Tests for the deterministic evidence sanitizer/validator.

The sanitizer rejects secret-bearing shapes instead of redacting them, so no
caller can quietly downgrade a leak into a masked artifact. All fixtures below
are synthetic placeholders assembled at runtime; no real credential, key or
token appears in this file, and nothing here performs any runtime action.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest

from cybrik_suite_uat_mtls import evidence

_SRC_ROOT = Path(__file__).resolve().parents[1] / "src" / "cybrik_suite_uat_mtls"

_DASHES = "-" * 5
_PEM_PRIVATE = f"{_DASHES}BEGIN {'PRIVATE'} {'KEY'}{_DASHES}\nAAAA\n{_DASHES}END {'PRIVATE'} {'KEY'}{_DASHES}"
_PEM_CERTIFICATE = f"{_DASHES}BEGIN CERTIFICATE{_DASHES}\nAAAA\n{_DASHES}END CERTIFICATE{_DASHES}"
_JWT_SHAPED = "AAAAAAAAAA.BBBBBBBBBB.CCCCCCCCCC"
_BEARER = "Bearer AAAAAAAAAAAAAAAAAAAA"
_DSN_WITH_CREDENTIALS = "postgresql://uat_role:PLACEHOLDER@127.0.0.1:55432/uat"
_INLINE_CREDENTIAL = "password=PLACEHOLDER"
_DIGEST = "a" * 64

_CLEAN_EVIDENCE = {
    "case_id": "N1",
    "surface": "ai_mtls",
    "bind": "127.0.0.1:58443",
    "cnf_thumbprint_sha256": _DIGEST,
    "attempt_count": 0,
    "authored_not_run": True,
    "notes": ["replay rejected", None, 1.5],
    "nested": {"tenant_id": "tenant-synthetic-01"},
}


# --------------------------------------------------------------------------
# Accepted shapes
# --------------------------------------------------------------------------


def test_clean_evidence_is_accepted_unchanged() -> None:
    assert evidence.validate_evidence(_CLEAN_EVIDENCE) == _CLEAN_EVIDENCE


def test_validate_evidence_returns_a_detached_copy() -> None:
    payload = {"nested": {"case_id": "N1"}}
    validated = evidence.validate_evidence(payload)
    validated["nested"]["case_id"] = "N2"
    assert payload["nested"]["case_id"] == "N1"


def test_validate_evidence_is_deterministic_under_key_permutation() -> None:
    first = {"alpha": 1, "beta": {"gamma": 2, "delta": 3}}
    second = {"beta": {"delta": 3, "gamma": 2}, "alpha": 1}
    assert json.dumps(evidence.validate_evidence(first)) == json.dumps(
        evidence.validate_evidence(second)
    )


def test_validate_evidence_canonicalises_sequences_to_lists() -> None:
    assert evidence.validate_evidence({"items": ("a", "b")}) == {"items": ["a", "b"]}


@pytest.mark.parametrize(
    "value",
    (
        "loopback bind 127.0.0.1:58443",
        "postgresql://127.0.0.1:55432/uat",
        42,
        -1.5,
        True,
        None,
    ),
)
def test_safe_scalars_are_accepted_at_the_root(value: object) -> None:
    assert evidence.validate_evidence(value) == value


@pytest.mark.parametrize(
    "key",
    ("cnf_thumbprint_sha256", "token_id", "dsn_digest_sha256", "jwt_fingerprint"),
)
def test_safe_digest_and_identifier_keys_are_allowed(key: str) -> None:
    assert evidence.validate_evidence({key: _DIGEST}) == {key: _DIGEST}


def test_secret_reason_returns_none_for_safe_text() -> None:
    assert evidence.secret_reason("case N1 rejected the replay") is None


@pytest.mark.parametrize(
    "text",
    (
        "see https://docs.example/a:b@c for detail",
        "https://example.com/adr:sec@v1",
    ),
)
def test_documentation_urls_are_not_misclassified_as_credentialed_dsns(
    text: str,
) -> None:
    assert evidence.secret_reason(text) is None


# --------------------------------------------------------------------------
# Rejected shapes — fail closed, never redact
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("payload", "expected_reason"),
    (
        ({"authorization": _BEARER}, evidence.SECRET_BEARING_KEY),
        ({"proxy-authorization": "x"}, evidence.SECRET_BEARING_KEY),
        ({"password": "x"}, evidence.SECRET_BEARING_KEY),
        ({"pgpassword": "x"}, evidence.SECRET_BEARING_KEY),
        ({"client_secret": "x"}, evidence.SECRET_BEARING_KEY),
        ({"private_key": "x"}, evidence.SECRET_BEARING_KEY),
        ({"api_key": "x"}, evidence.SECRET_BEARING_KEY),
        ({"cnf": "x"}, evidence.SECRET_BEARING_KEY),
        ({"raw_cnf": "x"}, evidence.SECRET_BEARING_KEY),
        ({"full_cnf": "x"}, evidence.SECRET_BEARING_KEY),
        ({"dsn": "x"}, evidence.SECRET_BEARING_KEY),
        ({"runtime_dsn": "x"}, evidence.SECRET_BEARING_KEY),
        ({"token": "x"}, evidence.SECRET_BEARING_KEY),
        ({"bearer": "x"}, evidence.SECRET_BEARING_KEY),
        ({"jwt": "x"}, evidence.SECRET_BEARING_KEY),
        ({"dbpassword": "x"}, evidence.SECRET_BEARING_KEY),
        ({"apikey": "x"}, evidence.SECRET_BEARING_KEY),
        ({"accesstoken": "x"}, evidence.SECRET_BEARING_KEY),
        ({"clientsecret": "x"}, evidence.SECRET_BEARING_KEY),
        ({"authtoken": "x"}, evidence.SECRET_BEARING_KEY),
        ({"privatekey": "x"}, evidence.SECRET_BEARING_KEY),
        ({"pgpass": "x"}, evidence.SECRET_BEARING_KEY),
        ({"passphrase": "x"}, evidence.SECRET_BEARING_KEY),
        ({"credentials": "x"}, evidence.SECRET_BEARING_KEY),
        ({"x-api-key": "x"}, evidence.SECRET_BEARING_KEY),
        ({"signing_key": "x"}, evidence.SECRET_BEARING_KEY),
        ({"key_material": "x"}, evidence.SECRET_BEARING_KEY),
        ({"cookie": "x"}, evidence.SECRET_BEARING_KEY),
        ({"connection_string": "x"}, evidence.SECRET_BEARING_KEY),
        ({"certificate_pem": "x"}, evidence.SECRET_BEARING_KEY),
        ({"password_sha256": _DIGEST}, evidence.SECRET_BEARING_KEY),
        ({"authorization_id": "abc"}, evidence.SECRET_BEARING_KEY),
        ({"note": _BEARER}, evidence.BEARER_TOKEN),
        ({"note": "authorization: opaque"}, evidence.AUTHORIZATION_HEADER),
        ({"note": _JWT_SHAPED}, evidence.JWT_VALUE),
        ({"note": _PEM_PRIVATE}, evidence.PEM_PRIVATE_KEY),
        ({"note": _PEM_CERTIFICATE}, evidence.PEM_BLOCK_NOT_PERMITTED),
        ({"note": _DSN_WITH_CREDENTIALS}, evidence.DSN_CREDENTIALS),
        (
            {"note": "postgresql://uat:aB3/xY9+kk@127.0.0.1:55432/uat"},
            evidence.DSN_CREDENTIALS,
        ),
        ({"note": _INLINE_CREDENTIAL}, evidence.INLINE_CREDENTIAL_ASSIGNMENT),
        ({"note": "?password=PLACEHOLDER"}, evidence.INLINE_CREDENTIAL_ASSIGNMENT),
        (
            {"note": '{"password":"PLACEHOLDER"}'},
            evidence.INLINE_CREDENTIAL_ASSIGNMENT,
        ),
        (
            {"note": '{"cnf":{"x5t#S256":"opaque"}}'},
            evidence.INLINE_CREDENTIAL_ASSIGNMENT,
        ),
        ({"note": "cnf: opaque-value"}, evidence.INLINE_CREDENTIAL_ASSIGNMENT),
        ({"note": "authorization=opaque-value"}, evidence.AUTHORIZATION_HEADER),
        ({"cnf_thumbprint_sha256": "zz"}, evidence.DIGEST_SHAPE_INVALID),
        ({"cnf_thumbprint_sha256": _DIGEST.upper()}, evidence.DIGEST_SHAPE_INVALID),
        ({"cnf_thumbprint_sha256": 1}, evidence.DIGEST_SHAPE_INVALID),
        ({"token_id": "spaced value"}, evidence.IDENTIFIER_SHAPE_INVALID),
        ({"token_id": 5}, evidence.IDENTIFIER_SHAPE_INVALID),
        ({"attempt_count": "3"}, evidence.COUNT_SHAPE_INVALID),
        ({"attempt_count": True}, evidence.COUNT_SHAPE_INVALID),
        ({1: "x"}, evidence.NON_STRING_KEY),
        ({"bad key!": "x"}, evidence.KEY_NOT_CANONICAL),
        ({"": "x"}, evidence.KEY_NOT_CANONICAL),
        ({"Case_Id": "a", "case_id": "b"}, evidence.AMBIGUOUS_DUPLICATE_KEY),
        ({"blob": b"AAAA"}, evidence.BINARY_VALUE_NOT_PERMITTED),
        ({"blob": bytearray(b"AAAA")}, evidence.BINARY_VALUE_NOT_PERMITTED),
        ({"items": {"a", "b"}}, evidence.UNSUPPORTED_TYPE),
        ({"ratio": float("nan")}, evidence.NUMBER_NOT_FINITE),
        ({"ratio": float("inf")}, evidence.NUMBER_NOT_FINITE),
        ({"note": "x" * 1025}, evidence.VALUE_TOO_LONG),
        (
            {"items": tuple(range(evidence.MAX_CONTAINER_ITEMS + 1))},
            evidence.CONTAINER_TOO_LARGE,
        ),
        (
            {
                f"field_{index}": index
                for index in range(evidence.MAX_CONTAINER_ITEMS + 1)
            },
            evidence.CONTAINER_TOO_LARGE,
        ),
        ({"magnitude": 1 << evidence.MAX_INTEGER_BITS}, evidence.INTEGER_OUT_OF_RANGE),
    ),
)
def test_validate_evidence_rejects_unsafe_shapes(
    payload: object, expected_reason: str
) -> None:
    with pytest.raises(evidence.EvidenceRejected) as caught:
        evidence.validate_evidence(payload)
    assert caught.value.reason == expected_reason


def test_validate_evidence_rejects_a_secret_at_the_root() -> None:
    with pytest.raises(evidence.EvidenceRejected) as caught:
        evidence.validate_evidence(_BEARER)
    assert caught.value.reason == evidence.BEARER_TOKEN
    assert caught.value.path == "$"


def test_validate_evidence_rejects_a_nested_secret_and_reports_its_path() -> None:
    payload = {"outer": {"items": ["ok", {"inner": _JWT_SHAPED}]}}
    with pytest.raises(evidence.EvidenceRejected) as caught:
        evidence.validate_evidence(payload)
    assert caught.value.reason == evidence.JWT_VALUE
    assert caught.value.path == "$.outer.items[1].inner"


def test_validate_evidence_rejects_excessive_depth() -> None:
    payload: dict[str, object] = {"leaf": "ok"}
    for _ in range(evidence.MAX_DEPTH + 2):
        payload = {"nested": payload}
    with pytest.raises(evidence.EvidenceRejected) as caught:
        evidence.validate_evidence(payload)
    assert caught.value.reason == evidence.MAX_DEPTH_EXCEEDED


@pytest.mark.parametrize(
    ("text", "expected_reason"),
    (
        (_BEARER, evidence.BEARER_TOKEN),
        (_JWT_SHAPED, evidence.JWT_VALUE),
        (_PEM_PRIVATE, evidence.PEM_PRIVATE_KEY),
        (_DSN_WITH_CREDENTIALS, evidence.DSN_CREDENTIALS),
    ),
)
def test_secret_reason_classifies_secret_bearing_text(
    text: str, expected_reason: str
) -> None:
    assert evidence.secret_reason(text) == expected_reason


# --------------------------------------------------------------------------
# The rejection itself must never leak
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("payload", "secret"),
    (
        ({"note": _BEARER}, _BEARER),
        ({"note": _JWT_SHAPED}, _JWT_SHAPED),
        ({"note": _PEM_PRIVATE}, "AAAA"),
        ({"note": _DSN_WITH_CREDENTIALS}, "PLACEHOLDER"),
        ({"authorization": _BEARER}, _BEARER),
        ({_JWT_SHAPED: "x"}, _JWT_SHAPED),
    ),
)
def test_rejection_never_echoes_the_offending_value(
    payload: object, secret: str
) -> None:
    with pytest.raises(evidence.EvidenceRejected) as caught:
        evidence.validate_evidence(payload)
    error = caught.value
    rendered = f"{error}|{error!r}|{error.args}|{error.path}|{error.reason}"
    assert secret not in rendered


def test_authorization_result_is_not_an_unconstrained_safe_key() -> None:
    with pytest.raises(evidence.EvidenceRejected) as caught:
        evidence.validate_evidence({"authorization_result": "opaque"})
    assert caught.value.reason == evidence.SECRET_BEARING_KEY


def test_evidence_module_declares_no_output_channel() -> None:
    tree = ast.parse(
        (_SRC_ROOT / "evidence.py").read_text(encoding="utf-8"), filename="evidence.py"
    )
    called = {
        node.func.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    assert "print" not in called
    modules = {
        alias.name.split(".")[0]
        for node in ast.walk(tree)
        if isinstance(node, ast.Import)
        for alias in node.names
    }
    assert "logging" not in modules
    assert "sys" not in modules
