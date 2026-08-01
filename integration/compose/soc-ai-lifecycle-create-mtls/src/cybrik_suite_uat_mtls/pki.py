"""Ephemeral, out-of-repository development PKI for one authorized D2 attempt.

Status: ``AUTHORED — NOT RUN``. Importing this module performs no I/O and
imports no cryptography package. Certificate and signing material is created
only by :func:`create_ephemeral_pki` after the caller has passed the D2 runtime
authorization guard.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Final

PKI_DIRECTORY_MODE: Final = 0o700
PRIVATE_FILE_MODE: Final = 0o600
PUBLIC_FILE_MODE: Final = 0o644
SERVER_NAME: Final = "cybrik-ai-d2.invalid"


class PkiBoundaryError(RuntimeError):
    """The requested PKI root is outside the bounded D2 policy."""


@dataclass(frozen=True, slots=True)
class PkiMaterial:
    root: Path
    ca_certificate: Path
    server_certificate: Path
    server_private_key: Path
    client_certificate: Path
    client_private_key: Path
    alternate_client_certificate: Path
    alternate_client_private_key: Path
    jwt_private_key: Path
    jwt_public_jwk: Path


def _resolved_outside_repositories(
    root: Path, repository_roots: tuple[Path, ...]
) -> Path:
    if not root.is_absolute():
        raise PkiBoundaryError("runtime PKI root must be absolute")
    parent = root.parent.resolve(strict=True)
    candidate = parent / root.name
    for repository_root in repository_roots:
        resolved_repository = repository_root.resolve(strict=True)
        if candidate == resolved_repository or candidate.is_relative_to(
            resolved_repository
        ):
            raise PkiBoundaryError("runtime PKI root must be outside every repository")
    if candidate.exists() or candidate.is_symlink():
        raise PkiBoundaryError("runtime PKI root must not already exist")
    return candidate


def _write(path: Path, payload: bytes, mode: int) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    os.chmod(path, mode)


def _public_jwk(public_key: object, *, kid: str) -> dict[str, str]:
    numbers = public_key.public_numbers()  # type: ignore[attr-defined]

    def encoded(value: int) -> str:
        raw = value.to_bytes(32, "big")
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

    return {
        "alg": "ES256",
        "crv": "P-256",
        "kid": kid,
        "kty": "EC",
        "x": encoded(numbers.x),
        "y": encoded(numbers.y),
    }


def create_ephemeral_pki(
    root: Path,
    *,
    repository_roots: tuple[Path, ...],
    jwt_kid: str,
) -> PkiMaterial:
    """Create one short-lived CA, mTLS identities and ES256 signing key.

    The caller supplies an exact fresh root. No path is inferred from a
    repository, and no existing file is overwritten.
    """

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

    target = _resolved_outside_repositories(root, repository_roots)
    target.mkdir(mode=PKI_DIRECTORY_MODE)
    os.chmod(target, PKI_DIRECTORY_MODE)

    paths = PkiMaterial(
        root=target,
        ca_certificate=target / "ca-cert.pem",
        server_certificate=target / "server-cert.pem",
        server_private_key=target / "server-key.pem",
        client_certificate=target / "client-cert.pem",
        client_private_key=target / "client-key.pem",
        alternate_client_certificate=target / "alternate-client-cert.pem",
        alternate_client_private_key=target / "alternate-client-key.pem",
        jwt_private_key=target / "jwt-signing-key.pem",
        jwt_public_jwk=target / "jwt-public-jwk.json",
    )

    try:
        now = datetime.now(UTC).replace(microsecond=0)
        not_before = now - timedelta(minutes=1)
        not_after = now + timedelta(hours=2)
        ca_key = ec.generate_private_key(ec.SECP256R1())
        ca_name = x509.Name(
            [x509.NameAttribute(NameOID.COMMON_NAME, "Cybrik D2 ephemeral CA")]
        )
        ca_cert = (
            x509.CertificateBuilder()
            .subject_name(ca_name)
            .issuer_name(ca_name)
            .public_key(ca_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(not_before)
            .not_valid_after(not_after)
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=False,
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=True,
                    crl_sign=True,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
            .sign(ca_key, hashes.SHA256())
        )

        def leaf(common_name: str, *, server: bool) -> tuple[object, object]:
            key = ec.generate_private_key(ec.SECP256R1())
            builder = (
                x509.CertificateBuilder()
                .subject_name(
                    x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
                )
                .issuer_name(ca_name)
                .public_key(key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(not_before)
                .not_valid_after(not_after)
                .add_extension(
                    x509.BasicConstraints(ca=False, path_length=None), critical=True
                )
                .add_extension(
                    x509.ExtendedKeyUsage(
                        [
                            ExtendedKeyUsageOID.SERVER_AUTH
                            if server
                            else ExtendedKeyUsageOID.CLIENT_AUTH
                        ]
                    ),
                    critical=True,
                )
            )
            if server:
                builder = builder.add_extension(
                    x509.SubjectAlternativeName(
                        [
                            x509.DNSName(SERVER_NAME),
                            x509.IPAddress(
                                __import__("ipaddress").ip_address("127.0.0.1")
                            ),
                        ]
                    ),
                    critical=False,
                )
            return key, builder.sign(ca_key, hashes.SHA256())

        server_key, server_cert = leaf(SERVER_NAME, server=True)
        client_key, client_cert = leaf("cybrik-soc-d2-client", server=False)
        alternate_key, alternate_cert = leaf("cybrik-soc-d2-alternate", server=False)
        jwt_key = ec.generate_private_key(ec.SECP256R1())

        private_encoding = {
            "encoding": serialization.Encoding.PEM,
            "format": serialization.PrivateFormat.PKCS8,
            "encryption_algorithm": serialization.NoEncryption(),
        }
        _write(
            paths.ca_certificate,
            ca_cert.public_bytes(serialization.Encoding.PEM),
            PUBLIC_FILE_MODE,
        )
        _write(
            paths.server_certificate,
            server_cert.public_bytes(serialization.Encoding.PEM),
            PUBLIC_FILE_MODE,
        )
        _write(
            paths.server_private_key,
            server_key.private_bytes(**private_encoding),
            PRIVATE_FILE_MODE,
        )
        _write(
            paths.client_certificate,
            client_cert.public_bytes(serialization.Encoding.PEM),
            PUBLIC_FILE_MODE,
        )
        _write(
            paths.client_private_key,
            client_key.private_bytes(**private_encoding),
            PRIVATE_FILE_MODE,
        )
        _write(
            paths.alternate_client_certificate,
            alternate_cert.public_bytes(serialization.Encoding.PEM),
            PUBLIC_FILE_MODE,
        )
        _write(
            paths.alternate_client_private_key,
            alternate_key.private_bytes(**private_encoding),
            PRIVATE_FILE_MODE,
        )
        _write(
            paths.jwt_private_key,
            jwt_key.private_bytes(**private_encoding),
            PRIVATE_FILE_MODE,
        )
        jwk = json.dumps(
            {"keys": [_public_jwk(jwt_key.public_key(), kid=jwt_kid)]},
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        _write(paths.jwt_public_jwk, jwk, PUBLIC_FILE_MODE)
        return paths
    except BaseException:
        destroy_ephemeral_pki(
            PkiMaterial(
                root=target,
                ca_certificate=target / "ca-cert.pem",
                server_certificate=target / "server-cert.pem",
                server_private_key=target / "server-key.pem",
                client_certificate=target / "client-cert.pem",
                client_private_key=target / "client-key.pem",
                alternate_client_certificate=target / "alternate-client-cert.pem",
                alternate_client_private_key=target / "alternate-client-key.pem",
                jwt_private_key=target / "jwt-signing-key.pem",
                jwt_public_jwk=target / "jwt-public-jwk.json",
            )
        )
        raise


def certificate_thumbprint_sha256(certificate_path: Path) -> str:
    """Return the RFC 8705 base64url SHA-256 thumbprint of a PEM leaf."""

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes

    certificate = x509.load_pem_x509_certificate(certificate_path.read_bytes())
    return (
        base64.urlsafe_b64encode(certificate.fingerprint(hashes.SHA256()))
        .rstrip(b"=")
        .decode("ascii")
    )


def material_manifest(material: PkiMaterial) -> dict[str, object]:
    """Return secret-free digests and counts for runtime evidence."""

    public_paths = (
        material.ca_certificate,
        material.server_certificate,
        material.client_certificate,
        material.alternate_client_certificate,
        material.jwt_public_jwk,
    )
    return {
        "certificate_count": 4,
        "ephemeral": True,
        "outside_repository": True,
        "public_artifact_count": len(public_paths),
        "public_artifact_sha256": [
            hashlib.sha256(path.read_bytes()).hexdigest() for path in public_paths
        ],
    }


def destroy_ephemeral_pki(material: PkiMaterial) -> None:
    """Idempotently destroy only the exact already-resolved ephemeral root."""

    root = material.root
    if not root.is_absolute() or root.name in {"", ".", ".."}:
        raise PkiBoundaryError("refusing an unsafe PKI teardown root")
    if root.is_symlink():
        raise PkiBoundaryError("refusing a symlinked PKI teardown root")
    if root.exists():
        shutil.rmtree(root)


def verify_absent(material: PkiMaterial) -> bool:
    return not material.root.exists() and not material.root.is_symlink()
