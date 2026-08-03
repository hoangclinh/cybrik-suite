from __future__ import annotations

import base64
import hashlib
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_fabric import runtime_wiring_admission as subject

_KEY = "AAAAC3NzaC1lZDI1NTE5AAAAIKcZW7OQB8DF7rHy8r/PMKwLJeTnoM74+xjk+drNvFGx"  # gitleaks:allow


def _directory(path: Path) -> Path:
    path.mkdir(parents=True, mode=0o700)
    path.chmod(0o700)
    return path.resolve()


def _file(path: Path, payload: bytes, mode: int = 0o600) -> Path:
    path.write_bytes(payload)
    path.chmod(mode)
    return path.resolve()


def _descriptor(suite: Path, allowed: bytes, python: Path) -> None:
    blob = base64.b64decode(_KEY)
    fingerprint = "SHA256:" + base64.b64encode(
        hashlib.sha256(blob).digest()
    ).decode().rstrip("=")
    path = suite / subject.TRUST_DESCRIPTOR_RELATIVE
    path.parent.mkdir(parents=True)
    path.write_text(
        json.dumps(
            {
                "allowed_signers_sha256": hashlib.sha256(allowed).hexdigest(),
                "key_fingerprint": fingerprint,
                "key_type": "ssh-ed25519",
                "namespace": subject.AUTHORIZATION_NAMESPACE,
                "python_sha256": hashlib.sha256(python.read_bytes()).hexdigest(),
                "schema": "CYBRIK-UAT-SSH-AUTHORIZATION-TRUST/v1",
                "signer": "FOUNDER",
            },
            separators=(",", ":"),
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


def _environment(tmp_path: Path) -> dict[str, str]:
    suite = _directory(tmp_path / "repos/suite")
    soc = _directory(tmp_path / "repos/soc")
    ai = _directory(tmp_path / "repos/ai")
    fabric = _directory(tmp_path / "repos/fabric")
    for path in (
        soc / "services/api/src",
        ai / "services/ai-api/src",
        ai / "packages/ai-core/src",
        fabric / "src/control-plane",
    ):
        _directory(path)
    external = _directory(tmp_path / "external")
    python = _file(external / "python", b"python", 0o700)
    allowed = f'FOUNDER namespaces="{subject.AUTHORIZATION_NAMESPACE}" ssh-ed25519 {_KEY}\n'.encode()
    _descriptor(suite, allowed, python)
    subprocess.run(("/usr/bin/git", "-C", str(suite), "init", "-q"), check=True)
    subprocess.run(
        ("/usr/bin/git", "-C", str(suite), "add", subject.TRUST_DESCRIPTOR_RELATIVE),
        check=True,
    )
    subprocess.run(
        (
            "/usr/bin/git",
            "-C",
            str(suite),
            "-c",
            "user.name=UAT Test",
            "-c",
            "user.email=uat@example.invalid",
            "commit",
            "-q",
            "-m",
            "test trust descriptor",
        ),
        check=True,
    )
    values = {
        "CYBRIK_UAT_SUITE_ROOT": suite,
        "CYBRIK_UAT_SOC_ROOT": soc,
        "CYBRIK_UAT_CYBER_AI_ROOT": ai,
        "CYBRIK_UAT_TOOL_FABRIC_ROOT": fabric,
        "CYBRIK_UAT_RUNTIME_ROOT": _directory(external / "runtime"),
        "CYBRIK_UAT_EVIDENCE_ROOT": _directory(external / "evidence"),
        "CYBRIK_UAT_STATE_ROOT": _directory(external / "state"),
        "CYBRIK_UAT_AUTHORIZATION_FILE": _file(external / "authorization.json", b"{}"),
        "CYBRIK_UAT_AUTHORIZATION_SIGNATURE": _file(
            external / "authorization.sig", b"sig"
        ),
        "CYBRIK_UAT_AUTHORIZATION_ALLOWED_SIGNERS": _file(
            external / "allowed_signers", allowed
        ),
        "CYBRIK_UAT_ALLOWED_SIGNER": "FOUNDER",
        "CYBRIK_UAT_B1_WHEEL": _file(external / subject.B1_WHEEL_FILENAME, b"wheel"),
        "CYBRIK_UAT_PYTHON": python,
    }
    return {key: str(value) for key, value in values.items()}


def test_environment_binds_external_allowed_signers_to_tracked_descriptor(
    tmp_path: Path,
) -> None:
    config = subject.load_runtime_environment(_environment(tmp_path))

    assert config.allowed_signer == "FOUNDER"
    assert config.authorization_namespace == subject.AUTHORIZATION_NAMESPACE
    assert (
        config.repositories.cyber_ai_core_source
        == config.repositories.cyber_ai / "packages/ai-core/src"
    )


def test_trust_descriptor_git_read_ignores_ambient_git_config(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    environment = _environment(tmp_path)
    suite = Path(environment["CYBRIK_UAT_SUITE_ROOT"])
    descriptor = suite / subject.TRUST_DESCRIPTOR_RELATIVE
    real_run = subprocess.run
    observed_environments: list[dict[str, str]] = []

    def observe_run(*args: object, **kwargs: object) -> subprocess.CompletedProcess[bytes]:
        observed_environments.append(dict(kwargs["env"]))
        return real_run(*args, **kwargs)

    monkeypatch.setattr(subject.subprocess, "run", observe_run)

    subject._trust_descriptor(descriptor, suite)

    assert observed_environments == [
        {
            "GIT_CONFIG_GLOBAL": "/dev/null",
            "GIT_CONFIG_NOSYSTEM": "1",
            "LC_ALL": "C",
            "PATH": "/usr/bin:/bin",
        }
    ]


def test_tracked_uat_anchor_is_not_the_public_test_fixture_identity() -> None:
    descriptor = json.loads(
        (Path(__file__).parents[1] / "authorization-trust.json").read_text(
            encoding="utf-8"
        )
    )
    fixture_blob = base64.b64decode(_KEY)
    fixture_fingerprint = "SHA256:" + base64.b64encode(
        hashlib.sha256(fixture_blob).digest()
    ).decode().rstrip("=")
    fixture_allowed_signers = (
        f'FOUNDER namespaces="{subject.AUTHORIZATION_NAMESPACE}" '
        f"ssh-ed25519 {_KEY}\n"
    ).encode()

    assert descriptor["key_fingerprint"] != fixture_fingerprint
    assert descriptor["allowed_signers_sha256"] != hashlib.sha256(
        fixture_allowed_signers
    ).hexdigest()


def test_attacker_replacement_key_auth_and_signature_is_rejected_by_tracked_anchor(
    tmp_path: Path,
) -> None:
    environment = _environment(tmp_path)
    allowed = Path(environment["CYBRIK_UAT_AUTHORIZATION_ALLOWED_SIGNERS"])
    allowed.write_text(
        f'FOUNDER namespaces="{subject.AUTHORIZATION_NAMESPACE}" ssh-ed25519 '
        "AAAAC3NzaC1lZDI1NTE5AAAAIOdK+Mp6RLMsRuyLt62WIVaYwPx4f99xtCUwCaHgRd3C\n",
        encoding="ascii",
    )
    allowed.chmod(0o600)
    Path(environment["CYBRIK_UAT_AUTHORIZATION_FILE"]).write_text(
        '{"attacker":true}', encoding="utf-8"
    )
    Path(environment["CYBRIK_UAT_AUTHORIZATION_SIGNATURE"]).write_bytes(
        b"attacker-signature"
    )

    with pytest.raises(
        subject.RuntimeAdmissionWiringError, match="trust_anchor_mismatch"
    ):
        subject.load_runtime_environment(environment)


@pytest.mark.parametrize(
    ("mutate", "reason"),
    (
        (lambda env: env.update({"CYBRIK_UAT_EXTRA": "x"}), "environment_unknown"),
        (lambda env: env.pop("CYBRIK_UAT_PYTHON"), "environment_missing"),
        (
            lambda env: env.update(
                {"CYBRIK_UAT_EVIDENCE_ROOT": env["CYBRIK_UAT_RUNTIME_ROOT"]}
            ),
            "external_roots_not_disjoint",
        ),
        (
            lambda env: env.update({"CYBRIK_UAT_ALLOWED_SIGNER": "ATTACKER"}),
            "signer_not_allowed",
        ),
    ),
)
def test_environment_fails_closed(tmp_path: Path, mutate: object, reason: str) -> None:
    environment = _environment(tmp_path)
    mutate(environment)  # type: ignore[operator]
    with pytest.raises(subject.RuntimeAdmissionWiringError, match=reason):
        subject.load_runtime_environment(environment)


def test_verify_sshsig_builds_exact_identity_namespace_and_tuple(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    environment = _environment(tmp_path)
    authorization = {
        "authorized_by": "FOUNDER",
        "tuple": {
            role: {"commit": character * 40, "tree": character.upper().lower() * 40}
            for role, character in zip(
                ("suite", "soc", "cyber_ai", "tool_fabric"), "abcd", strict=True
            )
        },
    }
    payload = json.dumps(authorization, separators=(",", ":"), sort_keys=True).encode()
    _file(Path(environment["CYBRIK_UAT_AUTHORIZATION_FILE"]), payload)
    config = subject.load_runtime_environment(environment)
    observed: dict[str, object] = {}

    def run(argv: object, **kwargs: object) -> object:
        observed.update({"argv": argv, **kwargs})
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(subject.subprocess, "run", run)
    intent = subject.verify_signed_intent(config)

    assert intent.payload == payload
    assert tuple(item.role for item in intent.expectations) == (
        "suite",
        "soc",
        "cyber_ai",
        "tool_fabric",
    )
    assert observed["input"] == payload
    assert observed["argv"] == (
        "/usr/bin/ssh-keygen",
        "-Y",
        "verify",
        "-f",
        str(config.allowed_signers_file),
        "-I",
        "FOUNDER",
        "-n",
        subject.AUTHORIZATION_NAMESPACE,
        "-s",
        str(config.signature_file),
    )


def test_verify_sshsig_refusal_and_broken_marker_fail_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config = subject.load_runtime_environment(_environment(tmp_path))
    monkeypatch.setattr(
        subject.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=1),
    )
    with pytest.raises(
        subject.RuntimeAdmissionWiringError, match="authorization_signature_invalid"
    ):
        subject.verify_signed_intent(config)

    authorization = SimpleNamespace(authorization_id="attempt-1")
    subject.ensure_one_shot_available(authorization, config.external.state_root)
    marker = config.external.state_root / "attempt-1.consumed.json"
    marker.symlink_to(config.external.state_root / "missing")
    with pytest.raises(
        subject.RuntimeAdmissionWiringError, match="authorization_consumed"
    ):
        subject.ensure_one_shot_available(authorization, config.external.state_root)


def test_trust_descriptor_symlink_is_rejected_even_when_target_bytes_match(
    tmp_path: Path,
) -> None:
    environment = _environment(tmp_path)
    suite = Path(environment["CYBRIK_UAT_SUITE_ROOT"])
    descriptor = suite / subject.TRUST_DESCRIPTOR_RELATIVE
    outside = suite / "outside-trust.json"
    outside.write_bytes(descriptor.read_bytes())
    descriptor.unlink()
    descriptor.symlink_to(outside)

    with pytest.raises(
        subject.RuntimeAdmissionWiringError, match="trust_descriptor_invalid"
    ):
        subject.load_runtime_environment(environment)


def test_real_pinned_python_metadata_and_digest_are_accepted() -> None:
    python = Path(
        "/Users/hoanglinh/.local/share/uv/python/"
        "cpython-3.12.13-macos-aarch64-none/bin/python3.12"
    )

    assert (
        subject._executable(
            str(python),
            "a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623",
        )
        == python
    )
