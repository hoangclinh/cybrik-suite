"""External Ed25519 receipt identity and public-only verification helpers.

Importing this module is inert. Key material is opened only by the explicit
loader, never persisted, and never included in the public trust descriptor.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import stat
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Final

FIXED_SIGNED_AT: Final = "2026-08-03T00:00:02Z"
MAX_RECEIPT_KEY_BYTES: Final = 16 * 1024


class ReceiptIdentityError(RuntimeError):
    """Stable descriptor or external-key refusal."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _decode_b64url(value: object) -> bytes:
    if not isinstance(value, str) or not value or "=" in value:
        raise ValueError("noncanonical base64url")
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


@dataclass(frozen=True, slots=True)
class ReceiptTrustDescriptor:
    """Public-only Ed25519 identity used for copied receipt verification."""

    algorithm: str
    key_type: Mapping[str, str]
    kid: str
    public_key: str
    trust_bundle_ref: Mapping[str, str]

    def __post_init__(self) -> None:
        key_type = dict(self.key_type)
        trust = dict(self.trust_bundle_ref)
        if (
            self.algorithm != "EdDSA"
            or key_type != {"kty": "OKP", "crv": "Ed25519"}
            or not isinstance(self.kid, str)
            or not self.kid.startswith("cybrik-receipt-signer:v1:")
            or set(trust) != {"bundle_uri", "bundle_digest"}
            or trust.get("bundle_uri") != "cybrik-trust://receipt-signers/v1"
            or not isinstance(trust.get("bundle_digest"), str)
            or not str(trust["bundle_digest"]).startswith("sha256:")
        ):
            raise ReceiptIdentityError("receipt_trust_descriptor_invalid")
        try:
            public = _decode_b64url(self.public_key)
        except (ValueError, binascii.Error) as exc:
            raise ReceiptIdentityError("receipt_trust_descriptor_invalid") from exc
        expected_kid = "cybrik-receipt-signer:v1:" + self.public_key
        expected_digest = "sha256:" + hashlib.sha256(public).hexdigest()
        if (
            len(public) != 32
            or self.kid != expected_kid
            or trust["bundle_digest"] != expected_digest
        ):
            raise ReceiptIdentityError("receipt_trust_descriptor_invalid")
        object.__setattr__(self, "key_type", MappingProxyType(key_type))
        object.__setattr__(self, "trust_bundle_ref", MappingProxyType(trust))

    def to_json(self) -> str:
        return json.dumps(
            {
                "algorithm": self.algorithm,
                "key_type": dict(self.key_type),
                "kid": self.kid,
                "public_key": self.public_key,
                "trust_bundle_ref": dict(self.trust_bundle_ref),
            },
            ensure_ascii=True,
            separators=(",", ":"),
            sort_keys=True,
        )

    @classmethod
    def from_json(cls, payload: str) -> ReceiptTrustDescriptor:
        try:
            document = json.loads(payload)
        except (TypeError, json.JSONDecodeError) as exc:
            raise ReceiptIdentityError("receipt_trust_descriptor_invalid") from exc
        if not isinstance(document, dict) or set(document) != {
            "algorithm",
            "key_type",
            "kid",
            "public_key",
            "trust_bundle_ref",
        }:
            raise ReceiptIdentityError("receipt_trust_descriptor_invalid")
        try:
            return cls(**document)
        except TypeError as exc:
            raise ReceiptIdentityError("receipt_trust_descriptor_invalid") from exc


class ReceiptPublicVerifier:
    """Public-key-only verifier compatible with Fabric receipt verification."""

    signed_at = FIXED_SIGNED_AT

    def __init__(self, descriptor: ReceiptTrustDescriptor) -> None:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

        if not isinstance(descriptor, ReceiptTrustDescriptor):
            raise ReceiptIdentityError("receipt_trust_descriptor_invalid")
        self.algorithm = descriptor.algorithm
        self.key_type = descriptor.key_type
        self.kid = descriptor.kid
        self.trust_bundle_ref = descriptor.trust_bundle_ref
        self._public = Ed25519PublicKey.from_public_bytes(
            _decode_b64url(descriptor.public_key)
        )

    def verify(self, signing_input: bytes, /, *, signature: str) -> bool:
        from cryptography.exceptions import InvalidSignature

        try:
            self._public.verify(_decode_b64url(signature), signing_input)
        except (InvalidSignature, ValueError, binascii.Error):
            return False
        return True


class ExternalReceiptIdentity(ReceiptPublicVerifier):
    """Short-lived signer whose private key remains only in this object."""

    def __init__(self, private_key: object, descriptor: ReceiptTrustDescriptor) -> None:
        super().__init__(descriptor)
        self._private = private_key
        self.trust_descriptor = descriptor

    def sign(self, signing_input: bytes, /) -> str:
        return _b64url(self._private.sign(signing_input))


def _exact_external_path(path: object, forbidden_roots: Iterable[Path]) -> Path:
    if not isinstance(path, Path) or not path.is_absolute():
        raise ReceiptIdentityError("receipt_signing_key_invalid")
    try:
        candidate = path.resolve(strict=True)
    except OSError as exc:
        raise ReceiptIdentityError("receipt_signing_key_invalid") from exc
    if candidate != path or not path.is_file():
        raise ReceiptIdentityError("receipt_signing_key_invalid")
    if any(candidate.is_relative_to(root) for root in forbidden_roots):
        raise ReceiptIdentityError("receipt_signing_key_invalid")
    return candidate


def _read_key(path: Path, forbidden_roots: Iterable[Path]) -> bytes:
    candidate = _exact_external_path(path, forbidden_roots)
    no_follow = getattr(os, "O_NOFOLLOW", 0)
    close_on_exec = getattr(os, "O_CLOEXEC", 0)
    if not no_follow or not close_on_exec:
        raise ReceiptIdentityError("receipt_signing_key_invalid")
    try:
        descriptor = os.open(candidate, os.O_RDONLY | no_follow | close_on_exec)
    except OSError as exc:
        raise ReceiptIdentityError("receipt_signing_key_invalid") from exc
    try:
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_uid != os.geteuid()
            or before.st_nlink != 1
            or stat.S_IMODE(before.st_mode) != 0o600
            or before.st_size < 1
            or before.st_size > MAX_RECEIPT_KEY_BYTES
        ):
            raise ReceiptIdentityError("receipt_signing_key_invalid")
        chunks: list[bytes] = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(descriptor, min(remaining, 4096))
            if not chunk:
                raise ReceiptIdentityError("receipt_signing_key_changed")
            chunks.append(chunk)
            remaining -= len(chunk)
        if os.read(descriptor, 1):
            raise ReceiptIdentityError("receipt_signing_key_changed")
        after = os.fstat(descriptor)
        observed = os.stat(candidate, follow_symlinks=False)
        fields = (
            "st_dev",
            "st_ino",
            "st_uid",
            "st_mode",
            "st_nlink",
            "st_size",
            "st_mtime_ns",
            "st_ctime_ns",
        )
        if (
            any(
                getattr(before, field) != getattr(after, field)
                or getattr(before, field) != getattr(observed, field)
                for field in fields
            )
            or candidate.resolve(strict=True) != candidate
        ):
            raise ReceiptIdentityError("receipt_signing_key_changed")
        return b"".join(chunks)
    except OSError as exc:
        raise ReceiptIdentityError("receipt_signing_key_changed") from exc
    finally:
        os.close(descriptor)


def _public_descriptor(public_key: object) -> ReceiptTrustDescriptor:
    from cryptography.hazmat.primitives import serialization

    public = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    encoded = _b64url(public)
    return ReceiptTrustDescriptor(
        algorithm="EdDSA",
        key_type={"kty": "OKP", "crv": "Ed25519"},
        kid="cybrik-receipt-signer:v1:" + encoded,
        public_key=encoded,
        trust_bundle_ref={
            "bundle_uri": "cybrik-trust://receipt-signers/v1",
            "bundle_digest": "sha256:" + hashlib.sha256(public).hexdigest(),
        },
    )


def load_external_receipt_identity(
    key_path: Path, *, forbidden_roots: Iterable[Path]
) -> ExternalReceiptIdentity:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    payload = _read_key(key_path, tuple(forbidden_roots))
    try:
        key = serialization.load_pem_private_key(payload, password=None)
    except (TypeError, ValueError) as exc:
        raise ReceiptIdentityError("receipt_signing_key_invalid") from exc
    if not isinstance(key, Ed25519PrivateKey):
        raise ReceiptIdentityError("receipt_signing_key_invalid")
    return ExternalReceiptIdentity(key, _public_descriptor(key.public_key()))


def validate_external_receipt_key_path(
    key_path: Path, *, forbidden_roots: Iterable[Path]
) -> Path:
    """Validate exact external origin without reading private key bytes."""

    return _exact_external_path(key_path, tuple(forbidden_roots))


def create_receipt_public_verifier(
    descriptor: ReceiptTrustDescriptor,
) -> ReceiptPublicVerifier:
    return ReceiptPublicVerifier(descriptor)


__all__ = [
    "ExternalReceiptIdentity",
    "ReceiptIdentityError",
    "ReceiptPublicVerifier",
    "ReceiptTrustDescriptor",
    "create_receipt_public_verifier",
    "load_external_receipt_identity",
    "validate_external_receipt_key_path",
]
