"""TDD contract for three independent descriptor-bound UAT PKI channels."""

from __future__ import annotations

import ipaddress
import os
import stat
from dataclasses import replace
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import ec
from cybrik_suite_uat_fabric import runtime_pki


def _prepared_root(tmp_path: Path) -> tuple[Path, os.stat_result]:
    root = (tmp_path / "runtime-pki").resolve()
    root.mkdir(mode=runtime_pki.PKI_DIRECTORY_MODE)
    root.chmod(runtime_pki.PKI_DIRECTORY_MODE)
    return root, root.stat()


def _create(tmp_path: Path) -> runtime_pki.RuntimePkiMaterial:
    root, observed = _prepared_root(tmp_path)
    with runtime_pki.authorized_pki_root(
        root,
        expected_device=observed.st_dev,
        expected_inode=observed.st_ino,
        expected_uid=observed.st_uid,
        expected_mode=stat.S_IMODE(observed.st_mode),
    ) as capability:
        return runtime_pki.create_runtime_pki(
            capability,
            repository_roots=(),
        )


def test_import_is_inert_and_channel_set_is_exact() -> None:
    assert runtime_pki.PKI_CHANNELS == (
        "driver_to_cyber_ai",
        "cyber_ai_to_tool_fabric",
        "tool_fabric_to_soc",
    )
    assert "cryptography" not in runtime_pki.__dict__


def test_create_three_independent_channels_and_wrong_channel_trust_is_distinct(
    tmp_path: Path,
) -> None:
    material = _create(tmp_path)

    assert (
        tuple(channel.role for channel in material.channels) == runtime_pki.PKI_CHANNELS
    )
    assert runtime_pki.require_disjoint_channel_trust(material) is material
    assert len({channel.ca_sha256 for channel in material.channels}) == 3
    for channel in material.channels:
        assert channel.root.parent == material.root
        assert stat.S_IMODE(channel.client_private_key.stat().st_mode) == 0o600
        assert stat.S_IMODE(channel.server_private_key.stat().st_mode) == 0o600
        assert x509.load_pem_x509_certificate(channel.ca_certificate.read_bytes())

    first, second, _ = material.channels
    first_ca = x509.load_pem_x509_certificate(first.ca_certificate.read_bytes())
    wrong_client = x509.load_pem_x509_certificate(
        second.client_certificate.read_bytes()
    )
    with pytest.raises(InvalidSignature):
        first_ca.public_key().verify(
            wrong_client.signature,
            wrong_client.tbs_certificate_bytes,
            ec.ECDSA(wrong_client.signature_hash_algorithm),
        )

    runtime_pki.destroy_runtime_pki(material)
    assert runtime_pki.verify_absent(material) is True
    runtime_pki.destroy_runtime_pki(material)


def test_server_leaf_binds_dns_identity_and_exact_loopback_transport(
    tmp_path: Path,
) -> None:
    material = _create(tmp_path)

    for channel in material.channels:
        certificate = x509.load_pem_x509_certificate(
            channel.server_certificate.read_bytes()
        )
        names = certificate.extensions.get_extension_for_class(
            x509.SubjectAlternativeName
        ).value
        assert names.get_values_for_type(x509.DNSName) == [channel.server_name]
        assert names.get_values_for_type(x509.IPAddress) == [
            ipaddress.ip_address("127.0.0.1")
        ]

    runtime_pki.destroy_runtime_pki(material)


def test_root_authority_is_absolute_resolved_mode_0700_and_descriptor_bound(
    tmp_path: Path,
) -> None:
    root, observed = _prepared_root(tmp_path)
    root.chmod(0o755)
    with (
        pytest.raises(runtime_pki.PkiBoundaryFailure, match="pki_root_mode_invalid"),
        runtime_pki.authorized_pki_root(
            root,
            expected_device=observed.st_dev,
            expected_inode=observed.st_ino,
            expected_uid=observed.st_uid,
            expected_mode=0o755,
        ),
    ):
        pass

    root.chmod(0o700)
    with (
        pytest.raises(
            runtime_pki.PkiBoundaryFailure, match="pki_root_identity_mismatch"
        ),
        runtime_pki.authorized_pki_root(
            root,
            expected_device=observed.st_dev,
            expected_inode=observed.st_ino + 1,
            expected_uid=observed.st_uid,
            expected_mode=0o700,
        ),
    ):
        pass


def test_creation_refuses_repository_root_and_nonempty_root(tmp_path: Path) -> None:
    root, observed = _prepared_root(tmp_path)
    with (
        runtime_pki.authorized_pki_root(
            root,
            expected_device=observed.st_dev,
            expected_inode=observed.st_ino,
            expected_uid=observed.st_uid,
            expected_mode=0o700,
        ) as capability,
        pytest.raises(
            runtime_pki.PkiBoundaryFailure, match="pki_root_inside_repository"
        ),
    ):
        runtime_pki.create_runtime_pki(
            capability, repository_roots=(tmp_path.resolve(),)
        )

    (root / "sentinel").write_text("preserve\n", encoding="utf-8")
    with (
        runtime_pki.authorized_pki_root(
            root,
            expected_device=observed.st_dev,
            expected_inode=observed.st_ino,
            expected_uid=observed.st_uid,
            expected_mode=0o700,
        ) as capability,
        pytest.raises(runtime_pki.PkiBoundaryFailure, match="pki_root_not_empty"),
    ):
        runtime_pki.create_runtime_pki(capability, repository_roots=())
    assert (root / "sentinel").read_text(encoding="utf-8") == "preserve\n"


def test_teardown_refuses_path_identity_substitution(tmp_path: Path) -> None:
    material = _create(tmp_path)
    displaced = tmp_path / "displaced"
    material.root.rename(displaced)
    material.root.mkdir(mode=0o700)

    with pytest.raises(
        runtime_pki.PkiBoundaryFailure, match="pki_root_identity_mismatch"
    ):
        runtime_pki.destroy_runtime_pki(material)
    assert material.root.is_dir()
    assert displaced.is_dir()


def test_material_validation_fails_closed_for_tamper_and_wrong_types(
    tmp_path: Path,
) -> None:
    material = _create(tmp_path)
    material.channels[0].ca_certificate.write_bytes(b"tampered")

    with pytest.raises(runtime_pki.PkiBoundaryFailure, match="pki_channel_ca_invalid"):
        runtime_pki.require_disjoint_channel_trust(material)
    with pytest.raises(runtime_pki.PkiBoundaryFailure, match="pki_material_invalid"):
        runtime_pki.require_disjoint_channel_trust(object())  # type: ignore[arg-type]
    with pytest.raises(runtime_pki.PkiBoundaryFailure, match="pki_material_invalid"):
        runtime_pki.destroy_runtime_pki(object())  # type: ignore[arg-type]
    with pytest.raises(runtime_pki.PkiBoundaryFailure, match="pki_capability_required"):
        runtime_pki.create_runtime_pki(Path("/tmp"), repository_roots=())  # type: ignore[arg-type]


def test_channel_binding_and_recorded_ca_digest_are_exact(tmp_path: Path) -> None:
    material = _create(tmp_path)
    wrong_server = replace(
        material,
        channels=(
            replace(material.channels[0], server_name="wrong.invalid"),
            *material.channels[1:],
        ),
    )
    with pytest.raises(
        runtime_pki.PkiBoundaryFailure, match="pki_channel_binding_invalid"
    ):
        runtime_pki.require_disjoint_channel_trust(wrong_server)

    wrong_digest = replace(
        material,
        channels=(
            replace(material.channels[0], ca_sha256="0" * 64),
            *material.channels[1:],
        ),
    )
    with pytest.raises(runtime_pki.PkiBoundaryFailure, match="pki_channel_ca_invalid"):
        runtime_pki.require_disjoint_channel_trust(wrong_digest)
    runtime_pki.destroy_runtime_pki(material)


def test_failed_creation_never_removes_an_unowned_concurrent_channel(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    root, observed = _prepared_root(tmp_path)

    def concurrent_channel(
        target: Path, descriptor: int, role: str
    ) -> runtime_pki.ChannelPkiMaterial:
        os.mkdir(role, 0o700, dir_fd=descriptor)
        raise runtime_pki.PkiBoundaryFailure("synthetic_failure")

    monkeypatch.setattr(runtime_pki, "_issue_channel", concurrent_channel)
    with (
        runtime_pki.authorized_pki_root(
            root,
            expected_device=observed.st_dev,
            expected_inode=observed.st_ino,
            expected_uid=observed.st_uid,
            expected_mode=0o700,
        ) as capability,
        pytest.raises(runtime_pki.PkiBoundaryFailure, match="synthetic_failure"),
    ):
        runtime_pki.create_runtime_pki(capability, repository_roots=())

    assert (root / runtime_pki.PKI_CHANNELS[0]).is_dir()


@pytest.mark.parametrize("leaf", ("client_certificate", "server_certificate"))
def test_channel_trust_rejects_wrong_channel_leaf(tmp_path: Path, leaf: str) -> None:
    material = _create(tmp_path)
    first, second, _ = material.channels
    getattr(first, leaf).write_bytes(getattr(second, leaf).read_bytes())

    with pytest.raises(
        runtime_pki.PkiBoundaryFailure, match="pki_channel_leaf_invalid"
    ):
        runtime_pki.require_disjoint_channel_trust(material)


def test_channel_trust_rejects_private_key_not_bound_to_leaf(tmp_path: Path) -> None:
    material = _create(tmp_path)
    first, second, _ = material.channels
    first.client_private_key.write_bytes(second.client_private_key.read_bytes())

    with pytest.raises(runtime_pki.PkiBoundaryFailure, match="pki_channel_key_invalid"):
        runtime_pki.require_disjoint_channel_trust(material)


def test_teardown_rejects_forged_material_for_matching_victim_tree(
    tmp_path: Path,
) -> None:
    material = _create(tmp_path)
    victim = (tmp_path / "victim").resolve()
    victim.mkdir(mode=0o700)
    forged_channels = []
    for channel in material.channels:
        channel_root = victim / channel.role
        channel_root.mkdir(mode=0o700)
        paths = {}
        for name in (
            "ca-cert.pem",
            "server-cert.pem",
            "server-key.pem",
            "client-cert.pem",
            "client-key.pem",
        ):
            path = channel_root / name
            path.write_bytes(b"victim data")
            paths[name] = path
        forged_channels.append(
            replace(
                channel,
                root=channel_root,
                ca_certificate=paths["ca-cert.pem"],
                server_certificate=paths["server-cert.pem"],
                server_private_key=paths["server-key.pem"],
                client_certificate=paths["client-cert.pem"],
                client_private_key=paths["client-key.pem"],
            )
        )
    observed = victim.stat()
    forged = replace(
        material,
        root=victim,
        root_identity=runtime_pki.PkiRootIdentity(
            device=observed.st_dev,
            inode=observed.st_ino,
            uid=observed.st_uid,
            mode=stat.S_IMODE(observed.st_mode),
        ),
        channels=tuple(forged_channels),
    )

    with pytest.raises(runtime_pki.PkiBoundaryFailure, match="pki_material_not_issued"):
        runtime_pki.destroy_runtime_pki(forged)
    assert victim.is_dir()
    runtime_pki.destroy_runtime_pki(material)
