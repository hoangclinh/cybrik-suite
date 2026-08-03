"""Real SSHSIG tests for the transported integrated-UAT master reservation."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import subprocess
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import MappingProxyType

import pytest
from cybrik_suite_uat_mtls import runtime_authorization as authorization


def _signed_facts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> authorization.MasterReservationFacts:
    key = tmp_path / "founder-test-key"
    subprocess.run(
        ("/usr/bin/ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(key)),
        check=True,
        capture_output=True,
    )
    key.chmod(0o600)
    key_type, encoded, *_ = key.with_suffix(".pub").read_text(encoding="ascii").split()
    allowed = tmp_path / "allowed-signers"
    allowed_payload = (
        f'FOUNDER namespaces="{authorization.MASTER_AUTHORIZATION_NAMESPACE}" '
        f"{key_type} {encoded}\n"
    ).encode("ascii")
    allowed.write_bytes(allowed_payload)
    allowed.chmod(0o600)

    repositories = (
        ("cybrik-soc-command-center", tmp_path / "soc"),
        ("cybrik-cyber-ai-platform", tmp_path / "ai"),
        ("cybrik-security-tool-fabric", tmp_path / "fabric"),
        ("cybrik-suite", tmp_path / "suite"),
    )
    identities = tuple(
        (name, str(index) * 40, str(index + 4) * 40)
        for index, (name, _root) in enumerate(repositories, 1)
    )
    external = tuple(
        (capability, tmp_path / capability)
        for capability in (
            "postgres_d2_runtime",
            "postgres_d2_evidence",
            "alert_context_runtime",
            "alert_context_evidence",
            "alert_context_state",
        )
    )
    aggregate = "a" * 64
    b1_wheel = tmp_path / "b1.whl"
    b1_wheel.write_bytes(b"pinned B1 wheel fixture")
    b1_wheel.chmod(0o600)
    b1_sha256 = hashlib.sha256(b1_wheel.read_bytes()).hexdigest()
    now = datetime.now(UTC)
    external_sha = authorization._master_external_roots_digest(external)
    repository_sha = hashlib.sha256(
        (
            json.dumps(
                [
                    {"repository": name, "root": str(root)}
                    for name, root in repositories
                ],
                sort_keys=True,
                separators=(",", ":"),
            )
            + "\n"
        ).encode()
    ).hexdigest()
    tuple_sha = authorization._master_repository_tuple_digest(identities)
    record = {
        "authorization_id": "master-sshsig-test",
        "authorized_by": "FOUNDER",
        "b1_wheel": {"path": str(b1_wheel), "sha256": b1_sha256},
        "decision": "APPROVE",
        "evidence_root": str(tmp_path / "master-evidence"),
        "expires_at": (now + timedelta(hours=1)).isoformat(),
        "external_roots": [
            {"capability": capability, "root": str(root)}
            for capability, root in external
        ],
        "external_roots_sha256": external_sha,
        "helper_scripts": [{"path": "test.py", "sha256": "c" * 64}],
        "issued_at": (now - timedelta(minutes=1)).isoformat(),
        "one_shot": True,
        "python": {"path": "/test/python", "sha256": "d" * 64},
        "repository_roots": [
            {"repository": name, "root": str(root)} for name, root in repositories
        ],
        "repository_roots_sha256": repository_sha,
        "schema": authorization.MASTER_AUTHORIZATION_SCHEMA,
        "tracked_blob_aggregate": {
            "algorithm": "cybrik-uat-tracked-blob-sha256-lines/v1",
            "file_count": 1,
            "sha256": aggregate,
        },
        "tuple": {
            "suite": {"commit": identities[3][1], "tree": identities[3][2]},
            "soc": {"commit": identities[0][1], "tree": identities[0][2]},
            "cyber_ai": {"commit": identities[1][1], "tree": identities[1][2]},
            "tool_fabric": {"commit": identities[2][1], "tree": identities[2][2]},
        },
    }
    payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode()
    authorization_file = tmp_path / "master-authorization.json"
    authorization_file.write_bytes(payload)
    authorization_file.chmod(0o600)
    subprocess.run(
        (
            "/usr/bin/ssh-keygen",
            "-Y",
            "sign",
            "-f",
            str(key),
            "-n",
            authorization.MASTER_AUTHORIZATION_NAMESPACE,
            str(authorization_file),
        ),
        check=True,
        capture_output=True,
    )
    signature = Path(f"{authorization_file}.sig")
    signature.chmod(0o600)
    key_blob = base64.b64decode(encoded, validate=True)
    descriptor = MappingProxyType(
        {
            "allowed_signers_sha256": hashlib.sha256(allowed_payload).hexdigest(),
            "key_fingerprint": "SHA256:"
            + base64.b64encode(hashlib.sha256(key_blob).digest()).decode().rstrip("="),
            "key_type": "ssh-ed25519",
            "namespace": authorization.MASTER_AUTHORIZATION_NAMESPACE,
            "python_sha256": "d" * 64,
            "schema": "CYBRIK-UAT-SSH-AUTHORIZATION-TRUST/v1",
            "signer": "FOUNDER",
        }
    )
    monkeypatch.setattr(authorization, "_master_trust_descriptor", lambda _: descriptor)
    return authorization.MasterReservationFacts(
        aggregate_sha256=aggregate,
        b1_wheel=b1_wheel,
        b1_wheel_sha256=b1_sha256,
        authorization_file=authorization_file,
        authorization_sha256=hashlib.sha256(payload).hexdigest(),
        authorization_signature=signature,
        allowed_signers_file=allowed,
        external_roots=external,
        external_roots_sha256=external_sha,
        exact_head_grant_sha256=hashlib.sha256(signature.read_bytes()).hexdigest(),
        master_evidence_root=tmp_path / "master-evidence",
        marker_sha256="e" * 64,
        postgres_evidence_root=external[1][1],
        postgres_runtime_root=external[0][1],
        repository_roots=repositories,
        repository_roots_sha256=repository_sha,
        repository_tuple=identities,
        repository_tuple_sha256=tuple_sha,
        run_id="master-sshsig-test",
    )


def test_master_reservation_requires_valid_founder_sshsig(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    facts = _signed_facts(tmp_path, monkeypatch)

    authorization.verify_signed_master_reservation(facts)

    with pytest.raises(
        authorization.RuntimeAuthorizationFailure,
        match="signed_master_reservation_invalid",
    ):
        authorization.verify_signed_master_reservation(
            replace(facts, aggregate_sha256="f" * 64)
        )
    with pytest.raises(
        authorization.RuntimeAuthorizationFailure,
        match="signed_master_reservation_invalid",
    ):
        authorization.verify_signed_master_reservation(
            replace(facts, b1_wheel_sha256="f" * 64)
        )


def test_master_sshsig_verification_uses_the_already_pinned_inodes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    facts = _signed_facts(tmp_path, monkeypatch)
    original_run = subprocess.run

    def replace_paths_after_open(command: object, **kwargs: object) -> object:
        if isinstance(command, tuple) and command[:3] == (
            "/usr/bin/ssh-keygen",
            "-Y",
            "verify",
        ):
            for destination in (
                facts.allowed_signers_file,
                facts.authorization_signature,
            ):
                replacement = destination.with_name(destination.name + ".replacement")
                replacement.write_bytes(b"path substitution must be inert\n")
                replacement.chmod(0o600)
                os.replace(replacement, destination)
        return original_run(command, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(authorization.subprocess, "run", replace_paths_after_open)

    authorization.verify_signed_master_reservation(facts)


def test_master_trust_descriptor_is_the_exact_tracked_head_blob() -> None:
    suite_root = Path(authorization.__file__).resolve().parents[5]

    descriptor = authorization._master_trust_descriptor(suite_root)

    assert descriptor == {
        "allowed_signers_sha256": (
            "8c0e4e00607c0cbac759f798b0a0c2f2981f93b50b6f72e854d5b40ff52958e7"
        ),
        "key_fingerprint": "SHA256:kzGy03jJRT74lJ0I1UuN+pIF9wDQ0/ofrUDZNH5TB44",
        "key_type": "ssh-ed25519",
        "namespace": "cybrik-uat-soc-ai-fabric-v1",
        "python_sha256": (
            "a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623"
        ),
        "schema": "CYBRIK-UAT-SSH-AUTHORIZATION-TRUST/v1",
        "signer": "FOUNDER",
    }
