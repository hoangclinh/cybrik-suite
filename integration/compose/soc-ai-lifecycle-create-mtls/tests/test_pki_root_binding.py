"""RED controls for descriptor-bound ephemeral PKI creation.

The tests install harmless cryptography stand-ins and write only short fixture
sentinels below ``tmp_path``.  They do not create credentials, open sockets, or
invoke the D2 runtime harness.
"""

from __future__ import annotations

import errno
import os
import stat
import sys
import types
from contextlib import AbstractContextManager
from pathlib import Path
from typing import Self

import pytest
from cybrik_suite_uat_mtls import pki as runtime_pki


def _module(
    monkeypatch: pytest.MonkeyPatch, name: str, **attributes: object
) -> types.ModuleType:
    module = types.ModuleType(name)
    for attribute, value in attributes.items():
        setattr(module, attribute, value)
    monkeypatch.setitem(sys.modules, name, module)
    return module


def _install_harmless_crypto_standins(monkeypatch: pytest.MonkeyPatch) -> None:
    """Provide the small API surface used by ``create_ephemeral_pki``."""

    class FakePublicKey:
        def __init__(self, number: int) -> None:
            self.number = number

        def public_numbers(self) -> object:
            return types.SimpleNamespace(x=self.number, y=self.number + 10)

    class FakePrivateKey:
        def __init__(self, number: int) -> None:
            self.number = number

        def public_key(self) -> FakePublicKey:
            return FakePublicKey(self.number)

        def private_bytes(self, **kwargs: object) -> bytes:
            del kwargs
            return f"harmless-private-fixture-{self.number}".encode("ascii")

    class FakeCertificate:
        def __init__(self, label: str) -> None:
            self.label = label

        def public_bytes(self, encoding: object) -> bytes:
            del encoding
            return f"harmless-certificate-fixture-{self.label}".encode("ascii")

    class FakeBuilder:
        def __init__(self) -> None:
            self.subject: object | None = None

        def subject_name(self, value: object) -> Self:
            self.subject = value
            return self

        def issuer_name(self, value: object) -> Self:
            del value
            return self

        def public_key(self, value: object) -> Self:
            del value
            return self

        def serial_number(self, value: object) -> Self:
            del value
            return self

        def not_valid_before(self, value: object) -> Self:
            del value
            return self

        def not_valid_after(self, value: object) -> Self:
            del value
            return self

        def add_extension(self, value: object, critical: bool) -> Self:
            del value, critical
            return self

        def sign(self, key: object, algorithm: object) -> FakeCertificate:
            del key, algorithm
            assert self.subject is not None
            return FakeCertificate(self.subject.attributes[0].value)  # type: ignore[union-attr]

    x509 = _module(
        monkeypatch,
        "cryptography.x509",
        Name=lambda attributes: types.SimpleNamespace(attributes=attributes),
        NameAttribute=lambda oid, value: types.SimpleNamespace(oid=oid, value=value),
        CertificateBuilder=FakeBuilder,
        BasicConstraints=lambda ca, path_length: ("basic", ca, path_length),
        KeyUsage=lambda **kwargs: ("key-usage", kwargs),
        ExtendedKeyUsage=lambda values: ("extended-key-usage", values),
        SubjectAlternativeName=lambda values: ("subject-alternative-name", values),
        DNSName=lambda value: ("dns", value),
        IPAddress=lambda value: ("ip", value),
        random_serial_number=lambda: 42,
    )
    _module(
        monkeypatch,
        "cryptography.x509.oid",
        ExtendedKeyUsageOID=types.SimpleNamespace(
            SERVER_AUTH="server-auth", CLIENT_AUTH="client-auth"
        ),
        NameOID=types.SimpleNamespace(COMMON_NAME="common-name"),
    )
    numbers = iter(range(1, 6))
    ec = _module(
        monkeypatch,
        "cryptography.hazmat.primitives.asymmetric.ec",
        SECP256R1=lambda: "fixture-curve",
        generate_private_key=lambda curve: FakePrivateKey(next(numbers)),
    )
    hashes = _module(
        monkeypatch,
        "cryptography.hazmat.primitives.hashes",
        SHA256=lambda: "fixture-sha256",
    )
    serialization = _module(
        monkeypatch,
        "cryptography.hazmat.primitives.serialization",
        Encoding=types.SimpleNamespace(PEM="fixture-encoding"),
        PrivateFormat=types.SimpleNamespace(PKCS8="fixture-format"),
        NoEncryption=lambda: "fixture-no-encryption",
    )
    primitives = _module(
        monkeypatch,
        "cryptography.hazmat.primitives",
        hashes=hashes,
        serialization=serialization,
    )
    _module(monkeypatch, "cryptography.hazmat.primitives.asymmetric", ec=ec)
    hazmat = _module(monkeypatch, "cryptography.hazmat", primitives=primitives)
    _module(monkeypatch, "cryptography", x509=x509, hazmat=hazmat)


def _authorized_fixture_root(
    tmp_path: Path,
) -> AbstractContextManager[runtime_pki.AuthorizedPkiRoot]:
    """Pre-create the authorized 0700 root and open its live capability.

    Root preparation belongs to the caller, never to ``create_ephemeral_pki``.
    """

    root = tmp_path / "ephemeral-pki"
    root.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
    os.chmod(root, runtime_pki.PKI_DIRECTORY_MODE)
    prepared = os.lstat(root)
    return runtime_pki.authorized_pki_root(
        root,
        expected_device=prepared.st_dev,
        expected_inode=prepared.st_ino,
        expected_uid=prepared.st_uid,
        expected_mode=stat.S_IMODE(prepared.st_mode),
    )


def _create_fixture_pki(tmp_path: Path) -> runtime_pki.PkiMaterial:
    repository_root = tmp_path / "repository"
    repository_root.mkdir()
    with _authorized_fixture_root(tmp_path) as capability:
        return runtime_pki.create_ephemeral_pki(
            capability,
            repository_roots=(repository_root,),
            jwt_kid="fixture-kid",
        )


def test_pki_creation_rejects_root_replacement_between_sequential_writes(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """A renamed root must not redirect leaves or be reported as successful."""

    _install_harmless_crypto_standins(monkeypatch)
    visible_root = tmp_path / "ephemeral-pki"
    displaced_root = tmp_path / "ephemeral-pki-pinned"
    replacement_marker = "replacement-owned.txt"
    leaf_opens = 0
    original_open = os.open

    def replace_before_second_leaf_open(
        path: os.PathLike[str] | str | bytes,
        flags: int,
        mode: int = 0o777,
        *,
        dir_fd: int | None = None,
    ) -> int:
        nonlocal leaf_opens
        if flags & os.O_CREAT:
            leaf_opens += 1
            if leaf_opens == 2:
                visible_root.rename(displaced_root)
                visible_root.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
                (visible_root / replacement_marker).write_text(
                    "harmless replacement sentinel\n", encoding="utf-8"
                )
        if dir_fd is None:
            return original_open(path, flags, mode)
        return original_open(path, flags, mode, dir_fd=dir_fd)

    monkeypatch.setattr(runtime_pki.os, "open", replace_before_second_leaf_open)

    error: runtime_pki.PkiBoundaryError | None = None
    try:
        _create_fixture_pki(tmp_path)
    except runtime_pki.PkiBoundaryError as caught:
        error = caught

    expected_leaves = {
        "ca-cert.pem",
        "server-cert.pem",
        "server-key.pem",
        "client-cert.pem",
        "client-key.pem",
        "alternate-client-cert.pem",
        "alternate-client-key.pem",
        "jwt-signing-key.pem",
        "jwt-public-jwk.json",
    }
    redirected = expected_leaves.intersection(
        child.name for child in visible_root.iterdir()
    )
    assert not redirected, (
        "root pathname replacement redirected PKI leaf creation into the "
        f"replacement directory: {sorted(redirected)}"
    )
    assert error is not None, "a changed visible PKI root identity must fail closed"
    assert (visible_root / replacement_marker).is_file(), (
        "failure cleanup must not delete a directory that replaced the pinned root"
    )
    assert not expected_leaves.intersection(
        child.name for child in displaced_root.iterdir()
    ), "tentative leaves must be removed from the pinned root after identity failure"


def test_pki_leaf_creation_is_descriptor_relative_and_no_follow(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Every leaf open must be relative to the no-follow pinned root descriptor."""

    _install_harmless_crypto_standins(monkeypatch)
    calls: list[tuple[os.PathLike[str] | str | bytes, int, int | None]] = []
    original_open = os.open

    def record_open(
        path: os.PathLike[str] | str | bytes,
        flags: int,
        mode: int = 0o777,
        *,
        dir_fd: int | None = None,
    ) -> int:
        calls.append((path, flags, dir_fd))
        if dir_fd is None:
            return original_open(path, flags, mode)
        return original_open(path, flags, mode, dir_fd=dir_fd)

    monkeypatch.setattr(runtime_pki.os, "open", record_open)
    material = _create_fixture_pki(tmp_path)

    root_opens = [
        (path, flags, dir_fd)
        for path, flags, dir_fd in calls
        if not flags & os.O_CREAT and Path(path) == material.root
    ]
    leaf_opens = [entry for entry in calls if entry[1] & os.O_CREAT]
    no_follow = getattr(os, "O_NOFOLLOW", 0)

    assert root_opens, "the created PKI root must be pinned by an open descriptor"
    assert all(flags & getattr(os, "O_DIRECTORY", 0) for _, flags, _ in root_opens)
    assert no_follow and all(flags & no_follow for _, flags, _ in root_opens)
    assert len(leaf_opens) == 9
    assert all(dir_fd is not None for _, _, dir_fd in leaf_opens)
    assert all(
        isinstance(path, str) and Path(path).name == path for path, _, _ in leaf_opens
    ), "leaf opens must use validated single-component names"
    assert all(flags & no_follow for _, flags, _ in leaf_opens)


def test_pki_creation_cannot_self_bind_a_replacement_before_the_initial_open(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """The creation API must not adopt a directory substituted before pinning."""

    _install_harmless_crypto_standins(monkeypatch)
    visible_root = tmp_path / "ephemeral-pki"
    displaced_root = tmp_path / "ephemeral-pki-created"
    replacement_marker = "replacement-owned.txt"
    original_open = os.open
    replaced = False

    def replace_before_root_open(
        path: os.PathLike[str] | str | bytes,
        flags: int,
        mode: int = 0o777,
        *,
        dir_fd: int | None = None,
    ) -> int:
        nonlocal replaced
        if (
            not replaced
            and dir_fd is None
            and Path(path) == visible_root
            and not flags & os.O_CREAT
        ):
            replaced = True
            visible_root.rename(displaced_root)
            visible_root.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
            (visible_root / replacement_marker).write_text(
                "harmless replacement sentinel\n", encoding="utf-8"
            )
        if dir_fd is None:
            return original_open(path, flags, mode)
        return original_open(path, flags, mode, dir_fd=dir_fd)

    monkeypatch.setattr(runtime_pki.os, "open", replace_before_root_open)

    with pytest.raises(runtime_pki.PkiBoundaryError):
        _create_fixture_pki(tmp_path)

    assert replaced, "the fixture must exercise the initial pre-open race"
    assert (visible_root / replacement_marker).is_file()
    assert [path.name for path in visible_root.iterdir()] == [replacement_marker]
    assert list(displaced_root.iterdir()) == []


def test_pki_creation_rejects_same_inode_mode_drift_between_leaf_writes(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """A chmod drift on the pinned root must fail even when inode/device stay equal."""

    _install_harmless_crypto_standins(monkeypatch)
    visible_root = tmp_path / "ephemeral-pki"
    original_open = os.open
    leaf_opens = 0

    def chmod_after_first_leaf_open(
        path: os.PathLike[str] | str | bytes,
        flags: int,
        mode: int = 0o777,
        *,
        dir_fd: int | None = None,
    ) -> int:
        nonlocal leaf_opens
        descriptor = (
            original_open(path, flags, mode)
            if dir_fd is None
            else original_open(path, flags, mode, dir_fd=dir_fd)
        )
        if flags & os.O_CREAT:
            leaf_opens += 1
            if leaf_opens == 1:
                os.chmod(visible_root, 0o755)
        return descriptor

    monkeypatch.setattr(runtime_pki.os, "open", chmod_after_first_leaf_open)

    with pytest.raises(
        runtime_pki.PkiBoundaryError, match="descriptor identity does not match"
    ):
        _create_fixture_pki(tmp_path)

    assert leaf_opens >= 1
    assert stat.S_IMODE(os.lstat(visible_root).st_mode) == 0o755
    assert list(visible_root.iterdir()) == []


def test_live_authorized_root_rejects_same_inode_uid_drift_on_revalidation(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Descriptor revalidation must compare uid in addition to inode/device."""

    repository_root = tmp_path / "repository"
    repository_root.mkdir()
    with _authorized_fixture_root(tmp_path) as capability:
        original_fstat = os.fstat

        def drifted_uid_stat(descriptor: int) -> os.stat_result:
            observed = original_fstat(descriptor)
            if descriptor != capability.descriptor:
                return observed
            mutated = list(observed)
            mutated[4] = observed.st_uid + 1
            return os.stat_result(mutated)

        monkeypatch.setattr(runtime_pki.os, "fstat", drifted_uid_stat)
        with pytest.raises(
            runtime_pki.PkiBoundaryError, match="descriptor identity does not match"
        ):
            runtime_pki.create_ephemeral_pki(
                capability,
                repository_roots=(repository_root,),
                jwt_kid="fixture-kid",
            )


def test_pki_destruction_refuses_to_self_bind_an_existing_root(
    tmp_path: Path,
) -> None:
    """A current lstat is observation, never destructive authorization."""

    root = tmp_path / "ephemeral-pki"
    root.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
    marker = root / "preserve.txt"
    marker.write_text("preserve", encoding="ascii")
    unbound = runtime_pki.PkiMaterial(
        root=root,
        ca_certificate=root / "ca-cert.pem",
        server_certificate=root / "server-cert.pem",
        server_private_key=root / "server-key.pem",
        client_certificate=root / "client-cert.pem",
        client_private_key=root / "client-key.pem",
        alternate_client_certificate=root / "alternate-client-cert.pem",
        alternate_client_private_key=root / "alternate-client-key.pem",
        jwt_private_key=root / "jwt-signing-key.pem",
        jwt_public_jwk=root / "jwt-public-jwk.json",
    )

    with pytest.raises(
        runtime_pki.PkiBoundaryError,
        match="authorized PKI teardown identity is absent",
    ):
        runtime_pki.destroy_ephemeral_pki(unbound)

    assert marker.read_text(encoding="ascii") == "preserve"


def test_pki_destruction_refuses_and_preserves_a_preexisting_replacement(
    tmp_path: Path,
) -> None:
    """Only the externally supplied original identity may authorize deletion."""

    root = tmp_path / "ephemeral-pki"
    displaced = tmp_path / "ephemeral-pki-authorized"
    root.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
    os.chmod(root, runtime_pki.PKI_DIRECTORY_MODE)
    observed = os.lstat(root)
    material = runtime_pki.PkiMaterial(
        root=root,
        ca_certificate=root / "ca-cert.pem",
        server_certificate=root / "server-cert.pem",
        server_private_key=root / "server-key.pem",
        client_certificate=root / "client-cert.pem",
        client_private_key=root / "client-key.pem",
        alternate_client_certificate=root / "alternate-client-cert.pem",
        alternate_client_private_key=root / "alternate-client-key.pem",
        jwt_private_key=root / "jwt-signing-key.pem",
        jwt_public_jwk=root / "jwt-public-jwk.json",
        root_identity=runtime_pki.PkiRootIdentity(
            device=observed.st_dev,
            inode=observed.st_ino,
            uid=observed.st_uid,
            mode=stat.S_IMODE(observed.st_mode),
        ),
    )
    root.rename(displaced)
    root.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
    replacement_marker = root / "replacement-owned.txt"
    replacement_marker.write_text("preserve replacement", encoding="ascii")

    with pytest.raises(
        runtime_pki.PkiBoundaryError,
        match="identity changed before destruction",
    ):
        runtime_pki.destroy_ephemeral_pki(material)

    assert replacement_marker.read_text(encoding="ascii") == "preserve replacement"
    assert displaced.is_dir()


def test_destroy_pinned_tree_accepts_darwin_eperm_only_for_a_real_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Darwin reports EPERM, not EISDIR, when unlink targets a directory."""

    root = tmp_path / "ephemeral-pki"
    nested = root / "nested"
    nested.mkdir(parents=True)
    (nested / "fixture.txt").write_text("fixture", encoding="ascii")
    original_unlink = os.unlink

    def darwin_unlink(
        path: os.PathLike[str] | str | bytes, *, dir_fd: int | None = None
    ) -> None:
        if path == "nested":
            raise PermissionError(errno.EPERM, "operation not permitted", path)
        if dir_fd is None:
            original_unlink(path)
        else:
            original_unlink(path, dir_fd=dir_fd)

    monkeypatch.setattr(runtime_pki.os, "unlink", darwin_unlink)
    descriptor = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        runtime_pki._destroy_pinned_tree(descriptor)
    finally:
        os.close(descriptor)

    assert list(root.iterdir()) == []


def test_destroy_pinned_tree_preserves_a_file_on_genuine_eperm(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A permission denial for a non-directory must remain a hard failure."""

    root = tmp_path / "ephemeral-pki"
    root.mkdir()
    protected = root / "protected.txt"
    protected.write_text("preserve", encoding="ascii")
    original_unlink = os.unlink

    def denied_unlink(
        path: os.PathLike[str] | str | bytes, *, dir_fd: int | None = None
    ) -> None:
        if path == "protected.txt":
            raise PermissionError(errno.EPERM, "operation not permitted", path)
        if dir_fd is None:
            original_unlink(path)
        else:
            original_unlink(path, dir_fd=dir_fd)

    monkeypatch.setattr(runtime_pki.os, "unlink", denied_unlink)
    descriptor = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        with pytest.raises(PermissionError) as caught:
            runtime_pki._destroy_pinned_tree(descriptor)
    finally:
        os.close(descriptor)

    assert caught.value.errno == errno.EPERM
    assert protected.read_text(encoding="ascii") == "preserve"


def test_create_ephemeral_pki_refuses_a_bare_path_without_an_authorized_capability(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """PKI creation must consume a pre-bound descriptor capability, not a Path."""

    _install_harmless_crypto_standins(monkeypatch)
    root = tmp_path / "ephemeral-pki"
    repository_root = tmp_path / "repository"
    repository_root.mkdir()

    with pytest.raises(runtime_pki.PkiBoundaryError):
        runtime_pki.create_ephemeral_pki(
            root,
            repository_roots=(repository_root,),
            jwt_kid="fixture-kid",
        )

    assert not root.exists()


@pytest.mark.parametrize("missing_primitive", ("O_DIRECTORY", "O_NOFOLLOW", "dir_fd"))
def test_missing_secure_directory_primitive_fails_before_root_mutation(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    missing_primitive: str,
) -> None:
    """Unix security flags are required capabilities, never zero-valued fallbacks."""

    _install_harmless_crypto_standins(monkeypatch)
    root = tmp_path / "ephemeral-pki"
    repository_root = tmp_path / "repository"
    repository_root.mkdir()
    if missing_primitive == "O_DIRECTORY":
        monkeypatch.setattr(runtime_pki, "_O_DIRECTORY", 0)
    elif missing_primitive == "O_NOFOLLOW":
        monkeypatch.setattr(runtime_pki, "_O_NOFOLLOW", 0)
    else:
        monkeypatch.setattr(runtime_pki.os, "supports_dir_fd", set())

    with pytest.raises(runtime_pki.PkiBoundaryError):
        runtime_pki.create_ephemeral_pki(
            root,
            repository_roots=(repository_root,),
            jwt_kid="fixture-kid",
        )

    assert not root.exists()
