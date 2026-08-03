"""Ephemeral, out-of-repository development PKI for one authorized D2 attempt.

Status: ``AUTHORED — NOT RUN``. Importing this module performs no I/O and
imports no cryptography package. Certificate and signing material is created
only by :func:`create_ephemeral_pki` after the caller has passed the D2 runtime
authorization guard.

The creation API never creates, adopts or destroys a root directory. The
operator prepares one mode-``0700`` directory, records its ``st_dev``,
``st_ino``, owning uid and permission bits, and opens the live capability with
:func:`authorized_pki_root`. :func:`create_ephemeral_pki` accepts only that
capability, so a pathname substituted before or during creation can neither
redirect a leaf nor be reported as a successful root.
"""

from __future__ import annotations

import base64
import errno
import hashlib
import json
import os
import stat
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Final

PKI_DIRECTORY_MODE: Final = 0o700
PRIVATE_FILE_MODE: Final = 0o600
PUBLIC_FILE_MODE: Final = 0o644
SERVER_NAME: Final = "cybrik-ai-d2.invalid"
_O_DIRECTORY: Final = getattr(os, "O_DIRECTORY", 0)
_O_NOFOLLOW: Final = getattr(os, "O_NOFOLLOW", 0)
_UNSAFE_NAMES: Final = frozenset({"", ".", ".."})
# Captured before any test double can rebind ``os.open``/``os.unlink``: the
# platform capability question is about the real primitives, not the caller's.
_REQUIRED_DIR_FD_FUNCTIONS: Final = (os.open, os.unlink)


class PkiBoundaryError(RuntimeError):
    """The requested PKI root is outside the bounded D2 policy."""


@dataclass(frozen=True, slots=True)
class PkiRootIdentity:
    """The exact filesystem identity an authorized PKI root must keep."""

    device: int
    inode: int
    uid: int
    mode: int


@dataclass(frozen=True, slots=True)
class AuthorizedPkiRoot:
    """A live, descriptor-bound capability for one pre-authorized root.

    Instances are only meaningful inside :func:`authorized_pki_root`, which
    owns ``descriptor`` and closes it on exit.
    """

    path: Path
    identity: PkiRootIdentity
    descriptor: int


@dataclass(frozen=True, slots=True)
class _PinnedLeaf:
    """A single-component leaf name bound to the pinned root descriptor."""

    name: str
    root_descriptor: int

    def __post_init__(self) -> None:
        if self.name in _UNSAFE_NAMES or Path(self.name).name != self.name:
            raise PkiBoundaryError("runtime PKI leaf name must be a single component")


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
    root_identity: PkiRootIdentity | None = None


def _require_secure_directory_primitives() -> None:
    """Fail closed when a mandatory Unix directory primitive is unavailable."""

    if not _O_DIRECTORY:
        raise PkiBoundaryError("runtime PKI requires a non-zero O_DIRECTORY")
    if not _O_NOFOLLOW:
        raise PkiBoundaryError("runtime PKI requires a non-zero O_NOFOLLOW")
    if not hasattr(os, "fchmod"):
        raise PkiBoundaryError("runtime PKI requires descriptor-relative fchmod")
    supported = frozenset(getattr(os, "supports_dir_fd", frozenset()))
    if not supported.issuperset(_REQUIRED_DIR_FD_FUNCTIONS):
        raise PkiBoundaryError("runtime PKI requires dir_fd-relative open and unlink")


def _authorized_root_path(path: object) -> Path:
    if not isinstance(path, Path) or not path.is_absolute():
        raise PkiBoundaryError("authorized PKI root must be an absolute path")
    if path.name in _UNSAFE_NAMES:
        raise PkiBoundaryError("authorized PKI root must be a named directory")
    try:
        resolved = path.resolve(strict=True)
    except OSError as error:
        raise PkiBoundaryError("authorized PKI root must already exist") from error
    if resolved != path:
        raise PkiBoundaryError("authorized PKI root must be supplied already resolved")
    return resolved


def _assert_authorized_identity(identity: PkiRootIdentity) -> PkiRootIdentity:
    if identity.mode != PKI_DIRECTORY_MODE:
        raise PkiBoundaryError("authorized PKI root must be prepared with mode 0700")
    if identity.uid != os.geteuid():
        raise PkiBoundaryError("authorized PKI root must be owned by the running user")
    return identity


def _assert_descriptor_identity(descriptor: int, identity: PkiRootIdentity) -> None:
    try:
        observed = os.fstat(descriptor)
    except OSError as error:
        raise PkiBoundaryError("authorized PKI root descriptor is not live") from error
    if not stat.S_ISDIR(observed.st_mode):
        raise PkiBoundaryError("authorized PKI root descriptor is not a directory")
    if _identity_from_stat(observed) != identity:
        raise PkiBoundaryError("authorized PKI root descriptor identity does not match")


def _open_pinned_directory(root: Path) -> int:
    try:
        return os.open(root, os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW)
    except OSError as error:
        raise PkiBoundaryError(
            "authorized PKI root could not be opened as a no-follow directory"
        ) from error


@contextmanager
def authorized_pki_root(
    path: Path,
    *,
    expected_device: int,
    expected_inode: int,
    expected_uid: int,
    expected_mode: int,
) -> Iterator[AuthorizedPkiRoot]:
    """Yield a live capability for one already prepared mode-0700 directory.

    The directory is opened with mandatory ``O_DIRECTORY`` and ``O_NOFOLLOW``
    and its descriptor identity is compared against the caller-supplied
    ``st_dev``, ``st_ino``, uid and permission bits before the capability is
    yielded. The descriptor is closed on every exit path. Nothing is created,
    changed or removed here.
    """

    _require_secure_directory_primitives()
    identity = _assert_authorized_identity(
        PkiRootIdentity(
            device=expected_device,
            inode=expected_inode,
            uid=expected_uid,
            mode=expected_mode,
        )
    )
    root = _authorized_root_path(path)
    descriptor = _open_pinned_directory(root)
    try:
        _assert_descriptor_identity(descriptor, identity)
        yield AuthorizedPkiRoot(path=root, identity=identity, descriptor=descriptor)
    finally:
        os.close(descriptor)


def _live_authorized_root(root: object) -> AuthorizedPkiRoot:
    if not isinstance(root, AuthorizedPkiRoot):
        raise PkiBoundaryError(
            "runtime PKI creation requires a live authorized root capability"
        )
    if not isinstance(root.descriptor, int) or root.descriptor < 0:
        raise PkiBoundaryError("authorized PKI root capability has no live descriptor")
    _assert_authorized_identity(root.identity)
    _assert_descriptor_identity(root.descriptor, root.identity)
    return root


def _assert_outside_repositories(
    root: Path, repository_roots: tuple[Path, ...]
) -> None:
    for repository_root in repository_roots:
        resolved_repository = repository_root.resolve(strict=True)
        if root == resolved_repository or root.is_relative_to(resolved_repository):
            raise PkiBoundaryError("runtime PKI root must be outside every repository")


def _write(leaf: _PinnedLeaf, payload: bytes, mode: int) -> None:
    """Create one leaf exclusively, relative to the pinned root descriptor."""

    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | _O_NOFOLLOW
    descriptor = os.open(leaf.name, flags, mode, dir_fd=leaf.root_descriptor)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fchmod(stream.fileno(), mode)
            os.fsync(stream.fileno())
    except BaseException:
        _unlink_pinned_leaf(leaf)
        raise


def _unlink_pinned_leaf(leaf: _PinnedLeaf) -> None:
    try:
        os.unlink(leaf.name, dir_fd=leaf.root_descriptor)
    except FileNotFoundError:
        pass


def _identity_from_stat(observed: os.stat_result) -> PkiRootIdentity:
    return PkiRootIdentity(
        device=observed.st_dev,
        inode=observed.st_ino,
        uid=observed.st_uid,
        mode=stat.S_IMODE(observed.st_mode),
    )


def _assert_path_identity(
    root: Path, identity: PkiRootIdentity, *, message: str
) -> None:
    try:
        observed = os.lstat(root)
    except OSError as error:
        raise PkiBoundaryError(message) from error
    if not stat.S_ISDIR(observed.st_mode) or _identity_from_stat(observed) != identity:
        raise PkiBoundaryError(message)


def _verify_pinned_root(
    root_descriptor: int, root: Path, identity: PkiRootIdentity
) -> None:
    _assert_descriptor_identity(root_descriptor, identity)
    _assert_path_identity(
        root,
        identity,
        message="runtime PKI root pathname identity changed during creation",
    )


def _list_directory_entries(directory_descriptor: int) -> list[str]:
    entries = os.listdir(directory_descriptor)
    if any(name in _UNSAFE_NAMES or Path(name).name != name for name in entries):
        raise PkiBoundaryError("runtime PKI teardown encountered an unsafe entry name")
    return entries


def _directory_entry_identity(
    parent_descriptor: int, entry: str, *, message: str
) -> PkiRootIdentity:
    try:
        observed = os.stat(entry, dir_fd=parent_descriptor, follow_symlinks=False)
    except OSError as error:
        raise PkiBoundaryError(message) from error
    if not stat.S_ISDIR(observed.st_mode):
        raise PkiBoundaryError(message)
    return _identity_from_stat(observed)


def _destroy_pinned_tree(directory_descriptor: int) -> None:
    for entry in _list_directory_entries(directory_descriptor):
        expected_identity: PkiRootIdentity | None = None
        try:
            os.unlink(entry, dir_fd=directory_descriptor)
            continue
        except FileNotFoundError:
            continue
        except IsADirectoryError:
            pass
        except PermissionError as error:
            if error.errno != errno.EPERM:
                raise
            try:
                observed = os.stat(
                    entry, dir_fd=directory_descriptor, follow_symlinks=False
                )
            except OSError:
                raise error
            if not stat.S_ISDIR(observed.st_mode):
                raise
            expected_identity = _identity_from_stat(observed)
        child_descriptor = os.open(
            entry, os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW, dir_fd=directory_descriptor
        )
        try:
            if expected_identity is None:
                observed = os.fstat(child_descriptor)
                if not stat.S_ISDIR(observed.st_mode):
                    raise PkiBoundaryError(
                        "runtime PKI teardown child is not a directory"
                    )
                expected_identity = _identity_from_stat(observed)
            _assert_descriptor_identity(child_descriptor, expected_identity)
            _destroy_pinned_tree(child_descriptor)
            _assert_descriptor_identity(child_descriptor, expected_identity)
            if (
                _directory_entry_identity(
                    directory_descriptor,
                    entry,
                    message="runtime PKI teardown child identity changed",
                )
                != expected_identity
            ):
                raise PkiBoundaryError("runtime PKI teardown child identity changed")
        finally:
            os.close(child_descriptor)
        os.rmdir(entry, dir_fd=directory_descriptor)


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
    root: AuthorizedPkiRoot,
    *,
    repository_roots: tuple[Path, ...],
    jwt_kid: str,
) -> PkiMaterial:
    """Create one short-lived CA, mTLS identities and ES256 signing key.

    ``root`` must be the live capability yielded by :func:`authorized_pki_root`;
    a bare :class:`~pathlib.Path` is refused. Every leaf is created exclusively
    relative to the pinned descriptor, so no path is inferred from a repository
    and no existing file is overwritten. This function creates no directory and
    removes only the leaves it created.
    """

    _require_secure_directory_primitives()
    capability = _live_authorized_root(root)
    target = capability.path
    root_descriptor = capability.descriptor
    _assert_outside_repositories(target, repository_roots)
    _verify_pinned_root(root_descriptor, target, capability.identity)

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

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
        root_identity=capability.identity,
    )

    created: list[_PinnedLeaf] = []
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
        jwk = json.dumps(
            {"keys": [_public_jwk(jwt_key.public_key(), kid=jwt_kid)]},
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        artifacts: tuple[tuple[Path, bytes, int], ...] = (
            (
                paths.ca_certificate,
                ca_cert.public_bytes(serialization.Encoding.PEM),
                PUBLIC_FILE_MODE,
            ),
            (
                paths.server_certificate,
                server_cert.public_bytes(serialization.Encoding.PEM),
                PUBLIC_FILE_MODE,
            ),
            (
                paths.server_private_key,
                server_key.private_bytes(**private_encoding),
                PRIVATE_FILE_MODE,
            ),
            (
                paths.client_certificate,
                client_cert.public_bytes(serialization.Encoding.PEM),
                PUBLIC_FILE_MODE,
            ),
            (
                paths.client_private_key,
                client_key.private_bytes(**private_encoding),
                PRIVATE_FILE_MODE,
            ),
            (
                paths.alternate_client_certificate,
                alternate_cert.public_bytes(serialization.Encoding.PEM),
                PUBLIC_FILE_MODE,
            ),
            (
                paths.alternate_client_private_key,
                alternate_key.private_bytes(**private_encoding),
                PRIVATE_FILE_MODE,
            ),
            (
                paths.jwt_private_key,
                jwt_key.private_bytes(**private_encoding),
                PRIVATE_FILE_MODE,
            ),
            (paths.jwt_public_jwk, jwk, PUBLIC_FILE_MODE),
        )
        for artifact, payload, mode in artifacts:
            leaf = _PinnedLeaf(name=artifact.name, root_descriptor=root_descriptor)
            _verify_pinned_root(root_descriptor, target, capability.identity)
            created.append(leaf)
            _write(leaf, payload, mode)
            _verify_pinned_root(root_descriptor, target, capability.identity)
        _verify_pinned_root(root_descriptor, target, capability.identity)
        return paths
    except BaseException:
        for leaf in created:
            _unlink_pinned_leaf(leaf)
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
    if not root.exists():
        return
    identity = material.root_identity
    if identity is None:
        raise PkiBoundaryError("authorized PKI teardown identity is absent")
    parent = root.parent.resolve(strict=True)
    _assert_path_identity(
        root,
        identity,
        message="runtime PKI teardown root identity changed before destruction",
    )
    parent_descriptor = os.open(parent, os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW)
    try:
        root_descriptor = os.open(
            root.name,
            os.O_RDONLY | _O_DIRECTORY | _O_NOFOLLOW,
            dir_fd=parent_descriptor,
        )
        try:
            _assert_descriptor_identity(root_descriptor, identity)
            _destroy_pinned_tree(root_descriptor)
            _assert_path_identity(
                root,
                identity,
                message="runtime PKI teardown root identity changed during destruction",
            )
        finally:
            os.close(root_descriptor)
        os.rmdir(root.name, dir_fd=parent_descriptor)
    finally:
        os.close(parent_descriptor)


def verify_absent(material: PkiMaterial) -> bool:
    return not material.root.exists() and not material.root.is_symlink()
