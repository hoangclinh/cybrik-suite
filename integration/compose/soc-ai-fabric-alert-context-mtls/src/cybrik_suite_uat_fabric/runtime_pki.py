"""Descriptor-bound ephemeral PKI for three independent UAT channels.

Import is inert: cryptography is loaded only after a live, caller-authorized
root capability is supplied.  Each channel receives an independent CA, server
identity and client identity, making cross-channel trust fail closed.
"""

from __future__ import annotations

import hashlib
import ipaddress
import os
import secrets
import stat
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Final

PKI_DIRECTORY_MODE: Final = 0o700
PRIVATE_FILE_MODE: Final = 0o600
PUBLIC_FILE_MODE: Final = 0o644
PKI_CHANNELS: Final = (
    "driver_to_cyber_ai",
    "cyber_ai_to_tool_fabric",
    "tool_fabric_to_soc",
)
_CHANNEL_SERVER_NAMES: Final = {
    "driver_to_cyber_ai": "cyber-ai.uat.cybrik.invalid",
    "cyber_ai_to_tool_fabric": "tool-fabric.uat.cybrik.invalid",
    "tool_fabric_to_soc": "soc.uat.cybrik.invalid",
}
_LOOPBACK_ADDRESS: Final = ipaddress.ip_address("127.0.0.1")
_PUBLIC_LEAVES: Final = ("ca-cert.pem", "server-cert.pem", "client-cert.pem")
_PRIVATE_LEAVES: Final = ("server-key.pem", "client-key.pem")
_ALL_LEAVES: Final = frozenset((*_PUBLIC_LEAVES, *_PRIVATE_LEAVES))
_O_DIRECTORY: Final = getattr(os, "O_DIRECTORY", 0)
_O_NOFOLLOW: Final = getattr(os, "O_NOFOLLOW", 0)


class PkiBoundaryFailure(RuntimeError):
    """Stable, non-reflecting PKI boundary refusal."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class PkiRootIdentity:
    device: int
    inode: int
    uid: int
    mode: int


@dataclass(frozen=True, slots=True)
class AuthorizedPkiRoot:
    path: Path
    identity: PkiRootIdentity
    descriptor: int


@dataclass(frozen=True, slots=True)
class ChannelPkiMaterial:
    role: str
    root: Path
    root_identity: PkiRootIdentity
    server_name: str
    ca_certificate: Path
    server_certificate: Path
    server_private_key: Path
    client_certificate: Path
    client_private_key: Path
    ca_sha256: str


@dataclass(frozen=True, slots=True)
class RuntimePkiMaterial:
    root: Path
    root_identity: PkiRootIdentity
    channels: tuple[ChannelPkiMaterial, ...]
    issuance_id: str


_ISSUED_LOCK: Final = threading.RLock()
_ISSUED_MATERIALS: Final[dict[str, RuntimePkiMaterial]] = {}


def _identity(observed: os.stat_result) -> PkiRootIdentity:
    return PkiRootIdentity(
        device=observed.st_dev,
        inode=observed.st_ino,
        uid=observed.st_uid,
        mode=stat.S_IMODE(observed.st_mode),
    )


def _require_primitives() -> None:
    supported = frozenset(getattr(os, "supports_dir_fd", frozenset()))
    if (
        not _O_DIRECTORY
        or not _O_NOFOLLOW
        or not hasattr(os, "fchmod")
        or not supported.issuperset((os.open, os.unlink, os.mkdir, os.rmdir))
    ):
        raise PkiBoundaryFailure("pki_descriptor_primitives_unavailable")


def _assert_descriptor(descriptor: int, expected: PkiRootIdentity) -> None:
    try:
        observed = os.fstat(descriptor)
    except OSError as error:
        raise PkiBoundaryFailure("pki_root_descriptor_invalid") from error
    if not stat.S_ISDIR(observed.st_mode) or _identity(observed) != expected:
        raise PkiBoundaryFailure("pki_root_identity_mismatch")


def _exact_root_path(path: object) -> Path:
    if (
        not isinstance(path, Path)
        or not path.is_absolute()
        or path.name in ("", ".", "..")
    ):
        raise PkiBoundaryFailure("pki_root_path_invalid")
    try:
        resolved = path.resolve(strict=True)
    except OSError as error:
        raise PkiBoundaryFailure("pki_root_path_invalid") from error
    if resolved != path or not path.is_dir() or path.is_symlink():
        raise PkiBoundaryFailure("pki_root_path_invalid")
    return path


@contextmanager
def authorized_pki_root(
    path: Path,
    *,
    expected_device: int,
    expected_inode: int,
    expected_uid: int,
    expected_mode: int,
) -> Iterator[AuthorizedPkiRoot]:
    """Pin one pre-created 0700 root by descriptor and exact identity."""

    _require_primitives()
    root = _exact_root_path(path)
    expected = PkiRootIdentity(
        device=expected_device,
        inode=expected_inode,
        uid=expected_uid,
        mode=expected_mode,
    )
    if expected.mode != PKI_DIRECTORY_MODE or expected.uid != os.geteuid():
        raise PkiBoundaryFailure("pki_root_mode_invalid")
    try:
        descriptor = os.open(root, os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW)
    except OSError as error:
        raise PkiBoundaryFailure("pki_root_descriptor_invalid") from error
    try:
        _assert_descriptor(descriptor, expected)
        yield AuthorizedPkiRoot(path=root, identity=expected, descriptor=descriptor)
    finally:
        os.close(descriptor)


def _live_capability(root: object) -> AuthorizedPkiRoot:
    if not isinstance(root, AuthorizedPkiRoot):
        raise PkiBoundaryFailure("pki_capability_required")
    _assert_descriptor(root.descriptor, root.identity)
    try:
        observed = os.lstat(root.path)
    except OSError as error:
        raise PkiBoundaryFailure("pki_root_identity_mismatch") from error
    if not stat.S_ISDIR(observed.st_mode) or _identity(observed) != root.identity:
        raise PkiBoundaryFailure("pki_root_identity_mismatch")
    return root


def _assert_outside_repositories(
    root: Path, repository_roots: tuple[Path, ...]
) -> None:
    for repository in repository_roots:
        if not isinstance(repository, Path) or not repository.is_absolute():
            raise PkiBoundaryFailure("repository_root_invalid")
        try:
            resolved = repository.resolve(strict=True)
        except OSError as error:
            raise PkiBoundaryFailure("repository_root_invalid") from error
        if resolved != repository or not repository.is_dir():
            raise PkiBoundaryFailure("repository_root_invalid")
        if root == resolved or root.is_relative_to(resolved):
            raise PkiBoundaryFailure("pki_root_inside_repository")


def _open_channel(root_descriptor: int, role: str) -> tuple[int, PkiRootIdentity]:
    try:
        os.mkdir(role, PKI_DIRECTORY_MODE, dir_fd=root_descriptor)
    except OSError as error:
        raise PkiBoundaryFailure("pki_channel_creation_failed") from error
    try:
        descriptor = os.open(
            role,
            os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW,
            dir_fd=root_descriptor,
        )
    except OSError as error:
        try:
            os.rmdir(role, dir_fd=root_descriptor)
        except OSError:
            pass
        raise PkiBoundaryFailure("pki_channel_creation_failed") from error
    observed = os.fstat(descriptor)
    identity = _identity(observed)
    if not stat.S_ISDIR(observed.st_mode) or identity.mode != PKI_DIRECTORY_MODE:
        os.close(descriptor)
        raise PkiBoundaryFailure("pki_channel_identity_invalid")
    return descriptor, identity


def _write_leaf(descriptor: int, name: str, payload: bytes, mode: int) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | _O_NOFOLLOW
    try:
        leaf = os.open(name, flags, mode, dir_fd=descriptor)
        with os.fdopen(leaf, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fchmod(stream.fileno(), mode)
            os.fsync(stream.fileno())
    except OSError as error:
        try:
            os.unlink(name, dir_fd=descriptor)
        except OSError:
            pass
        raise PkiBoundaryFailure("pki_leaf_creation_failed") from error


def _issue_channel(root: Path, root_descriptor: int, role: str) -> ChannelPkiMaterial:
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

    descriptor, identity = _open_channel(root_descriptor, role)
    channel_root = root / role
    try:
        now = datetime.now(UTC).replace(microsecond=0)
        not_before = now - timedelta(minutes=1)
        not_after = now + timedelta(hours=2)
        ca_key = ec.generate_private_key(ec.SECP256R1())
        ca_name = x509.Name(
            [x509.NameAttribute(NameOID.COMMON_NAME, f"Cybrik UAT {role} CA")]
        )
        ca = (
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
                            x509.DNSName(_CHANNEL_SERVER_NAMES[role]),
                            x509.IPAddress(_LOOPBACK_ADDRESS),
                        ]
                    ),
                    critical=False,
                )
            return key, builder.sign(ca_key, hashes.SHA256())

        server_key, server_certificate = leaf(_CHANNEL_SERVER_NAMES[role], server=True)
        client_key, client_certificate = leaf(f"{role}-client", server=False)
        private_encoding = {
            "encoding": serialization.Encoding.PEM,
            "format": serialization.PrivateFormat.PKCS8,
            "encryption_algorithm": serialization.NoEncryption(),
        }
        ca_payload = ca.public_bytes(serialization.Encoding.PEM)
        payloads = (
            ("ca-cert.pem", ca_payload, PUBLIC_FILE_MODE),
            (
                "server-cert.pem",
                server_certificate.public_bytes(serialization.Encoding.PEM),
                PUBLIC_FILE_MODE,
            ),
            (
                "server-key.pem",
                server_key.private_bytes(**private_encoding),
                PRIVATE_FILE_MODE,
            ),
            (
                "client-cert.pem",
                client_certificate.public_bytes(serialization.Encoding.PEM),
                PUBLIC_FILE_MODE,
            ),
            (
                "client-key.pem",
                client_key.private_bytes(**private_encoding),
                PRIVATE_FILE_MODE,
            ),
        )
        for name, payload, mode in payloads:
            _assert_descriptor(descriptor, identity)
            _write_leaf(descriptor, name, payload, mode)
        _assert_descriptor(descriptor, identity)
        return ChannelPkiMaterial(
            role=role,
            root=channel_root,
            root_identity=identity,
            server_name=_CHANNEL_SERVER_NAMES[role],
            ca_certificate=channel_root / "ca-cert.pem",
            server_certificate=channel_root / "server-cert.pem",
            server_private_key=channel_root / "server-key.pem",
            client_certificate=channel_root / "client-cert.pem",
            client_private_key=channel_root / "client-key.pem",
            ca_sha256=hashlib.sha256(ca_payload).hexdigest(),
        )
    except BaseException:
        _remove_channel(root_descriptor, role, expected_identity=identity)
        raise
    finally:
        os.close(descriptor)


def _remove_channel(
    root_descriptor: int,
    role: str,
    *,
    expected_identity: PkiRootIdentity | None = None,
) -> None:
    try:
        descriptor = os.open(
            role,
            os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW,
            dir_fd=root_descriptor,
        )
    except FileNotFoundError:
        return
    try:
        if expected_identity is not None:
            _assert_descriptor(descriptor, expected_identity)
        entries = frozenset(os.listdir(descriptor))
        if not entries.issubset(_ALL_LEAVES):
            raise PkiBoundaryFailure("pki_teardown_unexpected_entry")
        for name in sorted(entries):
            try:
                os.unlink(name, dir_fd=descriptor)
            except OSError as error:
                raise PkiBoundaryFailure("pki_teardown_leaf_failed") from error
    finally:
        os.close(descriptor)
    try:
        os.rmdir(role, dir_fd=root_descriptor)
    except OSError as error:
        raise PkiBoundaryFailure("pki_teardown_channel_failed") from error


def create_runtime_pki(
    root: AuthorizedPkiRoot, *, repository_roots: tuple[Path, ...]
) -> RuntimePkiMaterial:
    """Create three independent CAs and endpoint identities under one root."""

    _require_primitives()
    capability = _live_capability(root)
    _assert_outside_repositories(capability.path, repository_roots)
    if os.listdir(capability.descriptor):
        raise PkiBoundaryFailure("pki_root_not_empty")
    channels: list[ChannelPkiMaterial] = []
    try:
        for role in PKI_CHANNELS:
            _assert_descriptor(capability.descriptor, capability.identity)
            channels.append(
                _issue_channel(capability.path, capability.descriptor, role)
            )
        material = RuntimePkiMaterial(
            root=capability.path,
            root_identity=capability.identity,
            channels=tuple(channels),
            issuance_id=secrets.token_hex(32),
        )
        validated = require_disjoint_channel_trust(material)
        with _ISSUED_LOCK:
            if validated.issuance_id in _ISSUED_MATERIALS:
                raise PkiBoundaryFailure("pki_issuance_collision")
            _ISSUED_MATERIALS[validated.issuance_id] = validated
        return validated
    except BaseException:
        for channel in reversed(channels):
            _remove_channel(
                capability.descriptor,
                channel.role,
                expected_identity=channel.root_identity,
            )
        raise


def _channel_artifacts(
    material: RuntimePkiMaterial, channel: ChannelPkiMaterial
) -> dict[str, bytes]:
    expected_root = material.root / channel.role
    expected_paths = {
        "ca-cert.pem": channel.ca_certificate,
        "server-cert.pem": channel.server_certificate,
        "server-key.pem": channel.server_private_key,
        "client-cert.pem": channel.client_certificate,
        "client-key.pem": channel.client_private_key,
    }
    if (
        channel.role not in PKI_CHANNELS
        or channel.root != expected_root
        or channel.server_name != _CHANNEL_SERVER_NAMES[channel.role]
        or any(path != expected_root / name for name, path in expected_paths.items())
    ):
        raise PkiBoundaryFailure("pki_channel_binding_invalid")
    try:
        descriptor = os.open(channel.root, os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW)
    except OSError as error:
        raise PkiBoundaryFailure("pki_channel_binding_invalid") from error
    try:
        _assert_descriptor(descriptor, channel.root_identity)
        if frozenset(os.listdir(descriptor)) != _ALL_LEAVES:
            raise PkiBoundaryFailure("pki_channel_binding_invalid")
        payloads: dict[str, bytes] = {}
        for name in sorted(_ALL_LEAVES):
            expected_mode = (
                PRIVATE_FILE_MODE if name in _PRIVATE_LEAVES else PUBLIC_FILE_MODE
            )
            try:
                leaf = os.open(name, os.O_RDONLY | _O_NOFOLLOW, dir_fd=descriptor)
            except OSError as error:
                raise PkiBoundaryFailure("pki_channel_binding_invalid") from error
            try:
                before = os.fstat(leaf)
                if (
                    not stat.S_ISREG(before.st_mode)
                    or stat.S_IMODE(before.st_mode) != expected_mode
                    or before.st_nlink != 1
                    or before.st_size <= 0
                    or before.st_size > 64 * 1024
                ):
                    raise PkiBoundaryFailure("pki_channel_binding_invalid")
                with os.fdopen(leaf, "rb", closefd=False) as stream:
                    payloads[name] = stream.read(64 * 1024 + 1)
                after = os.fstat(leaf)
                if (before.st_dev, before.st_ino, before.st_size) != (
                    after.st_dev,
                    after.st_ino,
                    after.st_size,
                ) or len(payloads[name]) != before.st_size:
                    raise PkiBoundaryFailure("pki_channel_binding_invalid")
            finally:
                os.close(leaf)
        _assert_descriptor(descriptor, channel.root_identity)
        return payloads
    finally:
        os.close(descriptor)


def _validate_channel_certificates(
    channel: ChannelPkiMaterial, payloads: dict[str, bytes]
) -> bytes:
    from cryptography import x509
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

    try:
        ca = x509.load_pem_x509_certificate(payloads["ca-cert.pem"])
        ca_key = ca.public_key()
        if not isinstance(ca_key, ec.EllipticCurvePublicKey):
            raise TypeError
        ca_key.verify(
            ca.signature,
            ca.tbs_certificate_bytes,
            ec.ECDSA(ca.signature_hash_algorithm),
        )
        constraints = ca.extensions.get_extension_for_class(x509.BasicConstraints).value
        if (
            not constraints.ca
            or constraints.path_length != 0
            or ca.subject != ca.issuer
        ):
            raise ValueError
    except (InvalidSignature, TypeError, ValueError, x509.ExtensionNotFound) as error:
        raise PkiBoundaryFailure("pki_channel_ca_invalid") from error

    leaf_specs = (
        (
            "server-cert.pem",
            "server-key.pem",
            channel.server_name,
            ExtendedKeyUsageOID.SERVER_AUTH,
        ),
        (
            "client-cert.pem",
            "client-key.pem",
            f"{channel.role}-client",
            ExtendedKeyUsageOID.CLIENT_AUTH,
        ),
    )
    for certificate_name, key_name, common_name, expected_usage in leaf_specs:
        try:
            certificate = x509.load_pem_x509_certificate(payloads[certificate_name])
            if certificate.issuer != ca.subject:
                raise ValueError
            ca_key.verify(
                certificate.signature,
                certificate.tbs_certificate_bytes,
                ec.ECDSA(certificate.signature_hash_algorithm),
            )
            names = certificate.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
            usages = certificate.extensions.get_extension_for_class(
                x509.ExtendedKeyUsage
            ).value
            if (
                len(names) != 1
                or names[0].value != common_name
                or usages != x509.ExtendedKeyUsage([expected_usage])
            ):
                raise ValueError
            if certificate_name == "server-cert.pem":
                sans = certificate.extensions.get_extension_for_class(
                    x509.SubjectAlternativeName
                ).value
                if sans.get_values_for_type(x509.DNSName) != [
                    channel.server_name
                ] or sans.get_values_for_type(x509.IPAddress) != [_LOOPBACK_ADDRESS]:
                    raise ValueError
        except (
            InvalidSignature,
            TypeError,
            ValueError,
            x509.ExtensionNotFound,
        ) as error:
            raise PkiBoundaryFailure("pki_channel_leaf_invalid") from error
        try:
            private_key = serialization.load_pem_private_key(
                payloads[key_name], password=None
            )
            if not isinstance(private_key, ec.EllipticCurvePrivateKey):
                raise TypeError
            certificate_public = certificate.public_key().public_bytes(
                serialization.Encoding.DER,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            )
            private_public = private_key.public_key().public_bytes(
                serialization.Encoding.DER,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            )
            if certificate_public != private_public:
                raise ValueError
        except (TypeError, ValueError) as error:
            raise PkiBoundaryFailure("pki_channel_key_invalid") from error
    return payloads["ca-cert.pem"]


def require_disjoint_channel_trust(material: RuntimePkiMaterial) -> RuntimePkiMaterial:
    """Validate channel paths, leaves, keys and byte-distinct trust anchors."""

    if not isinstance(material, RuntimePkiMaterial):
        raise PkiBoundaryFailure("pki_material_invalid")
    if tuple(channel.role for channel in material.channels) != PKI_CHANNELS:
        raise PkiBoundaryFailure("pki_channel_set_invalid")
    observed: list[str] = []
    for channel in material.channels:
        payloads = _channel_artifacts(material, channel)
        payload = _validate_channel_certificates(channel, payloads)
        digest = hashlib.sha256(payload).hexdigest()
        if digest != channel.ca_sha256:
            raise PkiBoundaryFailure("pki_channel_ca_invalid")
        observed.append(digest)
    if len(set(observed)) != len(PKI_CHANNELS):
        raise PkiBoundaryFailure("pki_channel_trust_not_disjoint")
    return material


def destroy_runtime_pki(material: RuntimePkiMaterial) -> None:
    """Remove only the exact descriptor-pinned material and its prepared root."""

    if not isinstance(material, RuntimePkiMaterial):
        raise PkiBoundaryFailure("pki_material_invalid")
    if not isinstance(material.root, Path):
        raise PkiBoundaryFailure("pki_material_invalid")
    if not material.root.exists() and not material.root.is_symlink():
        with _ISSUED_LOCK:
            issued = _ISSUED_MATERIALS.get(material.issuance_id)
            if issued == material:
                _ISSUED_MATERIALS.pop(material.issuance_id, None)
        return
    with _ISSUED_LOCK:
        issued = _ISSUED_MATERIALS.get(material.issuance_id)
        if issued != material:
            raise PkiBoundaryFailure("pki_material_not_issued")
        root = material.root
        _exact_root_path(root)
        try:
            observed = os.lstat(root)
        except OSError as error:
            raise PkiBoundaryFailure("pki_root_identity_mismatch") from error
        if _identity(observed) != material.root_identity:
            raise PkiBoundaryFailure("pki_root_identity_mismatch")
        parent = root.parent.resolve(strict=True)
        parent_descriptor = os.open(parent, os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW)
        try:
            root_descriptor = os.open(
                root.name,
                os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW,
                dir_fd=parent_descriptor,
            )
            try:
                _assert_descriptor(root_descriptor, material.root_identity)
                entries = frozenset(os.listdir(root_descriptor))
                if entries != frozenset(PKI_CHANNELS):
                    raise PkiBoundaryFailure("pki_teardown_unexpected_entry")
                by_role = {channel.role: channel for channel in material.channels}
                if set(by_role) != set(PKI_CHANNELS):
                    raise PkiBoundaryFailure("pki_channel_set_invalid")
                for role in reversed(PKI_CHANNELS):
                    _remove_channel(
                        root_descriptor,
                        role,
                        expected_identity=by_role[role].root_identity,
                    )
                _assert_descriptor(root_descriptor, material.root_identity)
            finally:
                os.close(root_descriptor)
            os.rmdir(root.name, dir_fd=parent_descriptor)
        finally:
            os.close(parent_descriptor)
        _ISSUED_MATERIALS.pop(material.issuance_id, None)


def verify_absent(material: RuntimePkiMaterial) -> bool:
    return not material.root.exists() and not material.root.is_symlink()
