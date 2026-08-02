"""TDD contract for the D2 pre-teardown/finalization integration boundary.

The tests are deliberately fast and import-inert.  They use only synthetic
temporary files and mocks: no listener, subprocess, Docker, database, network,
or live PKI operation is permitted here.  The pre-teardown and rollback phases
are separate Python processes and therefore share only immutable evidence.
"""

from __future__ import annotations

import ast
import hashlib
import importlib
import inspect
import json
import os
import shutil
import stat
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import ModuleType
from typing import Final

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from cybrik_suite_uat_mtls import procedure, secret_inventory
from cybrik_suite_uat_mtls import runtime_authorization as runtime_auth

_HEX_A: Final = "a" * 40
_HEX_B: Final = "b" * 64
_HEX_C: Final = "c" * 64
_HEX_D: Final = "d" * 64
_RUNTIME_SECRET: Final = "synthetic-d2-runtime-secret-" + "x" * 40


def _make_public_test_certificate() -> bytes:
    private_key = ec.generate_private_key(ec.SECP256R1())
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "d2.synthetic")])
    not_before = datetime(2026, 8, 1, tzinfo=UTC)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(private_key.public_key())
        .serial_number(1)
        .not_valid_before(not_before)
        .not_valid_after(not_before + timedelta(days=1))
        .sign(private_key, hashes.SHA256())
    )
    return certificate.public_bytes(serialization.Encoding.PEM)


_PUBLIC_TEST_CERTIFICATE: Final = _make_public_test_certificate()
_PUBLIC_TEST_JWK: Final = (
    json.dumps(
        {
            "keys": [
                {
                    "alg": "ES256",
                    "crv": "P-256",
                    "kid": "d2-public-key",
                    "kty": "EC",
                    "x": "A" * 43,
                    "y": "B" * 43,
                }
            ]
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("ascii")
    + b"\n"
)
_PRIVATE_KEY_LABEL: Final = "PRIVATE" + " KEY"
_PRIVATE_KEY_PEM: Final = (
    f"-----BEGIN {_PRIVATE_KEY_LABEL}-----\n"
    "synthetic-test-material\n"
    f"-----END {_PRIVATE_KEY_LABEL}-----\n"
).encode("ascii")

_PUBLIC_PKI: Final = (
    ("ca_certificate", "ca-cert.pem"),
    ("server_certificate", "server-cert.pem"),
    ("client_certificate", "client-cert.pem"),
    ("alternate_client_certificate", "alternate-client-cert.pem"),
    ("jwt_public_jwk", "jwt-public-jwk.json"),
)

_ABSENCE_KEYS: Final = (
    "completed",
    "ai_process_absent",
    "soc_process_absent",
    "postgres_container_absent",
    "ai_listener_absent",
    "postgres_listener_absent",
    "runtime_root_absent",
    "pki_absent",
)

_PENDING_KEYS: Final = {
    "artifact_bindings",
    "authorization",
    "candidate",
    "candidate_payload_sha256",
    "consumption_marker_sha256",
    "evidence_root_identity",
    "pending_file_identity",
    "public_pki_names",
    "remediation_receipt_sha256",
    "schema_version",
}

_PENDING_AUTHORIZATION_KEYS: Final = {
    "authorization_id",
    "authorization_sha256",
    "exact_head_grant_sha256",
    "runtime_code_aggregate_sha256",
    "suite_admission_base",
    "suite_head",
}

_PENDING_ARTIFACT_KEYS: Final = {
    "file_type",
    "relative_path",
    "sha256",
    "size_bytes",
    "st_dev",
    "st_ino",
}


def _terminal_integration() -> ModuleType:
    """Load the intentionally missing GREEN module inside the test body."""

    try:
        return importlib.import_module("cybrik_suite_uat_mtls.terminal_integration")
    except ModuleNotFoundError as exc:
        pytest.fail(f"D2 terminal integration symbols are not authored: {exc}")


def _roots(tmp_path: Path) -> tuple[Path, Path]:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-red-contract"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-red-contract"
    runtime_root.mkdir(mode=0o700)
    evidence_root.mkdir(mode=0o700)
    runtime_root.chmod(0o700)
    evidence_root.chmod(0o700)
    return runtime_root, evidence_root


def _authorization(
    tmp_path: Path,
    runtime_root: Path,
    evidence_root: Path,
) -> runtime_auth.RuntimeAuthorization:
    now = datetime(2026, 8, 2, 8, 0, tzinfo=UTC)
    return runtime_auth.RuntimeAuthorization(
        authorization_id="d2-terminal-red-contract-r1",
        authorized_at=now - timedelta(minutes=1),
        expires_at=now + timedelta(minutes=30),
        now=now,
        suite_root=tmp_path / "suite",
        suite_head=_HEX_A,
        suite_admission_base=_HEX_A,
        aggregate_sha256=_HEX_B,
        authorization_sha256=_HEX_C,
        exact_head_grant_sha256=_HEX_D,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        product_roots={},
    )


def _consumed_marker(
    authorization: runtime_auth.RuntimeAuthorization,
) -> dict[str, object]:
    root_status = authorization.evidence_root.stat()
    return {
        "authorization_id": authorization.authorization_id,
        "authorization_sha256": authorization.authorization_sha256,
        "exact_head_grant_sha256": authorization.exact_head_grant_sha256,
        "consumed_at": authorization.now.isoformat(),
        "evidence_root": str(authorization.evidence_root),
        "evidence_root_identity": {
            "st_dev": root_status.st_dev,
            "st_ino": root_status.st_ino,
        },
        "one_shot": True,
        "runtime_code_aggregate_sha256": authorization.aggregate_sha256,
        "runtime_root": str(authorization.runtime_root),
        "status": "consumed",
        "suite_admission_base": authorization.suite_admission_base,
        "suite_head": authorization.suite_head,
    }


def _marker_sha256(marker: dict[str, object]) -> str:
    payload = json.dumps(marker, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _canonical_record(value: object) -> bytes:
    return (
        json.dumps(
            value,
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        + b"\n"
    )


def _pending_path(module: ModuleType, evidence_root: Path) -> Path:
    return evidence_root / module.PENDING_HANDOFF_FILENAME


def _absence(*, value: bool = True) -> dict[str, bool]:
    return {key: value for key in _ABSENCE_KEYS}


def _candidate(
    authorization: runtime_auth.RuntimeAuthorization,
    marker: dict[str, object],
) -> dict[str, object]:
    """Minimal integration-shaped record; the evidence sealer owns full schema."""

    return {
        "attempt_id": authorization.authorization_id,
        "authority": {
            "phase_a_auth_sha256": authorization.authorization_sha256,
            "consumption_sha256": _marker_sha256(marker),
            "one_shot_consumed": True,
        },
        # This caller claim is intentionally untrusted.  The finalizer must
        # establish it again through the injected live absence probe.
        "teardown": _absence(),
    }


def _public_pki(runtime_root: Path) -> dict[str, Path]:
    pki_root = runtime_root / "pki"
    pki_root.mkdir()
    result: dict[str, Path] = {}
    for name, filename in _PUBLIC_PKI:
        path = pki_root / filename
        payload = (
            _PUBLIC_TEST_JWK if name == "jwt_public_jwk" else _PUBLIC_TEST_CERTIFICATE
        )
        path.write_bytes(payload)
        result[name] = path
    return result


def _prepare(
    module: ModuleType,
    *,
    authorization: runtime_auth.RuntimeAuthorization,
    marker: dict[str, object],
    public_pki_paths: dict[str, Path],
    artifact_paths: tuple[Path, ...] = (),
    inventory: secret_inventory.SecretInventory | None = None,
) -> object:
    return module.prepare_terminal_handoff(
        authorization=authorization,
        consumed_marker=marker,
        candidate=_candidate(authorization, marker),
        public_pki_paths=public_pki_paths,
        artifact_paths=artifact_paths,
        secret_inventory=(
            secret_inventory.SecretInventory() if inventory is None else inventory
        ),
    )


def test_pre_teardown_freezes_exact_five_public_pki_before_runtime_deletion(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    public_pki_paths = _public_pki(runtime_root)
    expected = {name: path.read_bytes() for name, path in public_pki_paths.items()}

    prepared = _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=public_pki_paths,
    )
    shutil.rmtree(runtime_root)

    assert tuple(prepared.public_pki_names) == tuple(name for name, _ in _PUBLIC_PKI)
    for name, filename in _PUBLIC_PKI:
        frozen = evidence_root / "pki-public" / filename
        assert frozen.is_file() and not frozen.is_symlink()
        assert frozen.read_bytes() == expected[name]


def test_pre_teardown_remediates_private_key_pem_beside_public_copies(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    leaked_private_key = evidence_root / "runtime-private-key.pem"
    leaked_private_key.write_bytes(_PRIVATE_KEY_PEM)

    prepared = _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=_public_pki(runtime_root),
    )

    assert not leaked_private_key.exists()
    assert len(prepared.remediation_receipts) == 1
    assert prepared.remediation_receipts[0]["reason"] == "pem_private_key"
    assert _PRIVATE_KEY_PEM.decode("ascii") not in repr(prepared)
    for _name, filename in _PUBLIC_PKI:
        assert (evidence_root / "pki-public" / filename).is_file()


def test_pre_teardown_rejects_corrupt_public_certificate_before_freeze(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    public_pki_paths = _public_pki(runtime_root)
    corrupt = _PUBLIC_TEST_CERTIFICATE[: len(_PUBLIC_TEST_CERTIFICATE) // 2]
    public_pki_paths["server_certificate"].write_bytes(corrupt)

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        _prepare(
            terminal,
            authorization=authorization,
            marker=marker,
            public_pki_paths=public_pki_paths,
        )

    assert caught.value.reason == "public_pki_invalid"
    assert str(public_pki_paths["server_certificate"]) not in str(caught.value)
    assert not (evidence_root / "pki-public").exists()
    assert not _pending_path(terminal, evidence_root).exists()


def test_pre_teardown_secret_sweep_remediates_content_and_filename_without_locator_leak(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    inventory = secret_inventory.SecretInventory()
    inventory.register("runtime_secret", _RUNTIME_SECRET)
    content_leak = evidence_root / "runtime-trace.log"
    filename_leak = evidence_root / f"trace-{_RUNTIME_SECRET}.log"
    content_leak.write_text(f"value={_RUNTIME_SECRET}\n", encoding="utf-8")
    filename_leak.write_text("safe payload\n", encoding="utf-8")

    prepared = _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=_public_pki(runtime_root),
        inventory=inventory,
    )

    assert not content_leak.exists()
    assert not filename_leak.exists()
    assert len(prepared.remediation_receipts) == 2
    receipt_text = json.dumps(prepared.remediation_receipts, sort_keys=True)
    for forbidden in (
        _RUNTIME_SECRET,
        content_leak.name,
        filename_leak.name,
        str(evidence_root),
    ):
        assert forbidden not in receipt_text
        assert forbidden not in repr(prepared.remediation_receipts)
    assert all(
        set(receipt) <= {"action", "artifact_id", "label", "reason"}
        for receipt in prepared.remediation_receipts
    )


def test_finalizer_reverifies_matching_consumed_marker_roots_and_exact_grant(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    prepared = _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=_public_pki(runtime_root),
    )
    del prepared
    terminal = importlib.reload(terminal)
    persisted = object()
    captured: dict[str, object] = {}

    def persist(root: Path, candidate: object) -> object:
        captured["root"] = root
        captured["candidate"] = candidate
        return persisted

    monkeypatch.setattr(terminal.runtime_evidence, "persist_terminal_evidence", persist)

    result = terminal.finalize_terminal_handoff(
        authorization=authorization,
        consumed_marker=marker,
        live_absence_probe=lambda: _absence(),
    )

    assert result is persisted
    assert captured["root"] == evidence_root
    captured_candidate = captured["candidate"]
    assert isinstance(captured_candidate, dict)
    assert captured_candidate["attempt_id"] == authorization.authorization_id
    assert captured_candidate["authority"] == {
        "phase_a_auth_sha256": authorization.authorization_sha256,
        "consumption_sha256": _marker_sha256(marker),
        "one_shot_consumed": True,
    }

    forged_grant = replace(authorization, authorization_sha256="d" * 64)
    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        terminal.finalize_terminal_handoff(
            authorization=forged_grant,
            consumed_marker=marker,
            live_absence_probe=lambda: _absence(),
        )
    assert caught.value.reason == "terminal_grant_mismatch"

    forged_marker = dict(marker)
    forged_marker["runtime_root"] = str(tmp_path / "other-runtime-root")
    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        terminal.finalize_terminal_handoff(
            authorization=authorization,
            consumed_marker=forged_marker,
            live_absence_probe=lambda: _absence(),
        )
    assert caught.value.reason == "consumption_marker_mismatch"


def test_finalizer_refuses_caller_forged_teardown_when_live_absence_is_false(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=_public_pki(runtime_root),
    )
    persisted = False

    def persist(_root: Path, _candidate: object) -> object:
        nonlocal persisted
        persisted = True
        return object()

    monkeypatch.setattr(terminal.runtime_evidence, "persist_terminal_evidence", persist)
    live_absence = _absence()
    live_absence["runtime_root_absent"] = False

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        terminal.finalize_terminal_handoff(
            authorization=authorization,
            consumed_marker=marker,
            live_absence_probe=lambda: live_absence,
        )

    assert caught.value.reason == "live_teardown_incomplete"
    assert persisted is False


def test_late_artifact_mutation_after_candidate_creation_fails_closed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    artifact = evidence_root / "tls-extension.json"
    artifact.write_bytes(b'{"verified":true}\n')
    _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=_public_pki(runtime_root),
        artifact_paths=(artifact,),
    )
    artifact.write_bytes(b'{"verified":false}\n')
    persisted = False

    def persist(_root: Path, _candidate: object) -> object:
        nonlocal persisted
        persisted = True
        return object()

    monkeypatch.setattr(terminal.runtime_evidence, "persist_terminal_evidence", persist)

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        terminal.finalize_terminal_handoff(
            authorization=authorization,
            consumed_marker=marker,
            live_absence_probe=lambda: _absence(),
        )

    assert caught.value.reason == "terminal_artifact_changed"
    assert persisted is False


def test_pre_teardown_rejects_any_runtime_artifact_outside_evidence_root(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    escaped_artifact = tmp_path / "outside-evidence.json"
    escaped_artifact.write_bytes(b'{"unsafe":true}\n')

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        _prepare(
            terminal,
            authorization=authorization,
            marker=marker,
            public_pki_paths=_public_pki(runtime_root),
            artifact_paths=(escaped_artifact,),
        )

    assert caught.value.reason == "artifact_outside_evidence_root"


def test_finalizer_delegates_summary_last_only_after_live_absence(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=_public_pki(runtime_root),
    )
    events: list[str] = []
    persisted = object()

    def absence_probe() -> dict[str, bool]:
        events.append("live_absence")
        return _absence()

    def persist(_root: Path, _candidate: object) -> object:
        events.append("persist_terminal_evidence")
        return persisted

    monkeypatch.setattr(terminal.runtime_evidence, "persist_terminal_evidence", persist)

    result = terminal.finalize_terminal_handoff(
        authorization=authorization,
        consumed_marker=marker,
        live_absence_probe=absence_probe,
    )

    assert result is persisted
    assert events == ["live_absence", "persist_terminal_evidence"]
    source = inspect.getsource(terminal.finalize_terminal_handoff)
    assert source.count("runtime_evidence.persist_terminal_evidence(") == 1
    assert "SUMMARY_FILENAME" not in source
    assert ".write_text(" not in source
    assert ".write_bytes(" not in source


def test_prepare_persists_a_bounded_canonical_path_free_pending_handoff(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    artifact = evidence_root / "tls-extension.json"
    artifact.write_bytes(b'{"verified":true}\n')

    prepared = _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=_public_pki(runtime_root),
        artifact_paths=(artifact,),
    )

    pending_path = _pending_path(terminal, evidence_root)
    metadata = pending_path.lstat()
    raw = pending_path.read_bytes()
    document = json.loads(raw)
    assert stat.S_ISREG(metadata.st_mode)
    assert not pending_path.is_symlink()
    assert metadata.st_nlink == 1
    assert stat.S_IMODE(metadata.st_mode) == 0o600
    assert 0 < len(raw) <= terminal.MAX_PENDING_HANDOFF_BYTES
    assert raw == _canonical_record(document)
    assert set(document) == _PENDING_KEYS
    assert document["schema_version"] == terminal.PENDING_HANDOFF_SCHEMA_VERSION
    assert set(document["authorization"]) == _PENDING_AUTHORIZATION_KEYS
    assert document["authorization"] == {
        "authorization_id": authorization.authorization_id,
        "authorization_sha256": authorization.authorization_sha256,
        "exact_head_grant_sha256": authorization.exact_head_grant_sha256,
        "runtime_code_aggregate_sha256": authorization.aggregate_sha256,
        "suite_admission_base": authorization.suite_admission_base,
        "suite_head": authorization.suite_head,
    }
    assert document["evidence_root_identity"] == {
        "file_type": stat.S_IFDIR,
        "st_dev": evidence_root.stat().st_dev,
        "st_ino": evidence_root.stat().st_ino,
    }
    assert document["pending_file_identity"] == {
        "file_type": stat.S_IFREG,
        "st_dev": metadata.st_dev,
        "st_ino": metadata.st_ino,
    }
    assert document["consumption_marker_sha256"] == _marker_sha256(marker)
    assert (
        document["candidate_payload_sha256"]
        == hashlib.sha256(_canonical_record(document["candidate"])).hexdigest()
    )
    assert document["public_pki_names"] == [name for name, _ in _PUBLIC_PKI]
    assert len(document["artifact_bindings"]) == 6
    assert all(
        set(binding) == _PENDING_ARTIFACT_KEYS
        for binding in document["artifact_bindings"]
    )
    assert str(runtime_root).encode() not in raw
    assert str(evidence_root).encode() not in raw
    assert _RUNTIME_SECRET.encode() not in raw
    receipt_payload = _canonical_record(list(prepared.remediation_receipts))
    assert (
        document["remediation_receipt_sha256"]
        == hashlib.sha256(receipt_payload).hexdigest()
    )


def test_finalizer_loads_pending_handoff_after_all_prepare_process_state_is_gone(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    prepared = _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=_public_pki(runtime_root),
    )
    pending_path = _pending_path(terminal, evidence_root)
    pending_before = pending_path.read_bytes()
    pending_identity = pending_path.stat().st_ino
    del prepared
    terminal = importlib.reload(terminal)
    captured: dict[str, object] = {}

    def persist(root: Path, candidate: object) -> object:
        captured["root"] = root
        captured["candidate"] = candidate
        return captured

    monkeypatch.setattr(terminal.runtime_evidence, "persist_terminal_evidence", persist)

    result = terminal.finalize_terminal_handoff(
        authorization=authorization,
        consumed_marker=marker,
        live_absence_probe=lambda: _absence(),
    )

    assert result is captured
    assert captured["root"] == evidence_root
    assert pending_path.read_bytes() == pending_before
    assert pending_path.stat().st_ino == pending_identity
    assert not (evidence_root / terminal.runtime_evidence.SUMMARY_FILENAME).exists()


@pytest.mark.parametrize(
    ("mutation", "expected_reason"),
    (
        ("corrupt", "pending_handoff_invalid"),
        ("noncanonical", "pending_handoff_noncanonical"),
        ("replaced", "pending_handoff_replaced"),
    ),
)
def test_corrupt_noncanonical_or_replaced_pending_handoff_fails_without_summary(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    mutation: str,
    expected_reason: str,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    _prepare(
        terminal,
        authorization=authorization,
        marker=marker,
        public_pki_paths=_public_pki(runtime_root),
    )
    pending_path = _pending_path(terminal, evidence_root)
    raw = pending_path.read_bytes()
    if mutation == "corrupt":
        pending_path.write_bytes(b"{")
    elif mutation == "noncanonical":
        pending_path.write_text(json.dumps(json.loads(raw), indent=2), encoding="utf-8")
    else:
        pending_path.unlink()
        pending_path.write_bytes(raw)
        pending_path.chmod(0o600)
    persisted = False

    def persist(_root: Path, _candidate: object) -> object:
        nonlocal persisted
        persisted = True
        return object()

    monkeypatch.setattr(terminal.runtime_evidence, "persist_terminal_evidence", persist)

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        terminal.finalize_terminal_handoff(
            authorization=authorization,
            consumed_marker=marker,
            live_absence_probe=lambda: _absence(),
        )

    assert caught.value.reason == expected_reason
    assert persisted is False
    assert not (evidence_root / terminal.runtime_evidence.SUMMARY_FILENAME).exists()


@pytest.mark.parametrize(
    ("operation", "wrapper", "arguments"),
    (
        ("open", "_descriptor_open", ("ignored", os.O_RDONLY)),
        ("close", "_descriptor_close", (12345,)),
        ("fstat", "_descriptor_fstat", (12345,)),
        ("dup", "_descriptor_dup", (12345,)),
    ),
)
def test_descriptor_transition_oserrors_are_stable_and_path_free(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
    wrapper: str,
    arguments: tuple[object, ...],
) -> None:
    terminal = _terminal_integration()
    sensitive_locator = tmp_path / "must-not-leak"

    def fail_transition(*_args: object, **_kwargs: object) -> object:
        raise OSError(str(sensitive_locator))

    monkeypatch.setattr(terminal.os, operation, fail_transition)

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        getattr(terminal, wrapper)(*arguments)

    assert caught.value.reason == "descriptor_transition_failed"
    assert str(sensitive_locator) not in str(caught.value)
    assert not isinstance(caught.value, OSError)


def test_whole_module_uses_descriptor_wrappers_for_open_close_fstat_and_dup() -> None:
    terminal = _terminal_integration()
    tree = ast.parse(inspect.getsource(terminal))
    wrappers = {
        "open": "_descriptor_open",
        "close": "_descriptor_close",
        "fstat": "_descriptor_fstat",
        "dup": "_descriptor_dup",
    }
    violations: list[tuple[str, str]] = []
    for function in (
        node
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ):
        for call in (node for node in ast.walk(function) if isinstance(node, ast.Call)):
            target = call.func
            if (
                isinstance(target, ast.Attribute)
                and isinstance(target.value, ast.Name)
                and target.value.id == "os"
                and target.attr in wrappers
                and function.name != wrappers[target.attr]
            ):
                violations.append((function.name, target.attr))
    assert violations == []


def _leaked_private_key(evidence_root: Path) -> Path:
    """Plant one sweepable artifact that proves no mutation phase ran."""

    leaked = evidence_root / "runtime-private-key.pem"
    leaked.write_bytes(_PRIVATE_KEY_PEM)
    return leaked


def test_prepare_reentry_refuses_before_any_sweep_freeze_or_persist_mutation(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    pending_path = _pending_path(terminal, evidence_root)
    prior_bytes = b'{"prior":"handoff"}\n'
    pending_path.write_bytes(prior_bytes)
    pending_path.chmod(0o600)
    leaked = _leaked_private_key(evidence_root)

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        _prepare(
            terminal,
            authorization=authorization,
            marker=marker,
            public_pki_paths=_public_pki(runtime_root),
        )

    assert caught.value.reason == "terminal_handoff_already_prepared"
    assert pending_path.read_bytes() == prior_bytes
    assert leaked.read_bytes() == _PRIVATE_KEY_PEM
    assert not os.path.lexists(evidence_root / "pki-public")


def test_prepare_reentry_preserves_a_dangling_reserved_public_directory_entry(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    reserved = evidence_root / "pki-public"
    dangling_target = tmp_path / "absent-reserved-target"
    reserved.symlink_to(dangling_target)
    leaked = _leaked_private_key(evidence_root)

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        _prepare(
            terminal,
            authorization=authorization,
            marker=marker,
            public_pki_paths=_public_pki(runtime_root),
        )

    assert caught.value.reason == "terminal_handoff_already_prepared"
    assert reserved.is_symlink()
    assert os.readlink(reserved) == str(dangling_target)
    assert not reserved.exists()
    assert leaked.read_bytes() == _PRIVATE_KEY_PEM
    assert not os.path.lexists(_pending_path(terminal, evidence_root))


def test_public_payload_with_registered_exact_marker_is_refused_before_freeze(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    inventory = secret_inventory.SecretInventory()
    embedded_marker = json.loads(_PUBLIC_TEST_JWK)["keys"][0]["kid"]
    inventory.register("runtime_secret", embedded_marker)
    leaked = _leaked_private_key(evidence_root)

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        _prepare(
            terminal,
            authorization=authorization,
            marker=marker,
            public_pki_paths=_public_pki(runtime_root),
            inventory=inventory,
        )

    assert caught.value.reason == "public_pki_secret_detected"
    assert embedded_marker not in str(caught.value)
    # Every public certificate carries a generic PEM classification.  The four
    # certificates ahead of the marked JWK were accepted, so that generic class
    # alone never refuses a public payload.
    assert inventory.scan_bytes(_PUBLIC_TEST_CERTIFICATE) is not None
    assert not os.path.lexists(evidence_root / "pki-public")
    assert leaked.read_bytes() == _PRIVATE_KEY_PEM


@pytest.mark.parametrize(
    ("failure", "expected_reason"),
    (
        ("oversized", "public_pki_too_large"),
        ("inventory", "public_pki_scan_failed"),
    ),
)
def test_public_payload_size_and_inventory_errors_map_to_stable_reasons(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
    expected_reason: str,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    public_pki_paths = _public_pki(runtime_root)
    sensitive_locator = tmp_path / "must-not-leak"
    if failure == "oversized":
        oversized = b"A" * (secret_inventory.MAX_SCAN_TEXT_BYTES + 1)
        public_pki_paths["ca_certificate"].write_bytes(oversized)
    else:

        def fail_scan(_self: object, _data: bytes) -> str | None:
            raise secret_inventory.SecretInventoryError(str(sensitive_locator))

        monkeypatch.setattr(
            secret_inventory.SecretInventory, "_exact_label", fail_scan
        )
    leaked = _leaked_private_key(evidence_root)

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        _prepare(
            terminal,
            authorization=authorization,
            marker=marker,
            public_pki_paths=public_pki_paths,
        )

    assert caught.value.reason == expected_reason
    assert str(sensitive_locator) not in str(caught.value)
    assert caught.value.__cause__ is None
    assert caught.value.__context__ is None
    assert not os.path.lexists(evidence_root / "pki-public")
    assert leaked.read_bytes() == _PRIVATE_KEY_PEM


def test_caller_supplied_reserved_public_namespace_artifact_is_refused(
    tmp_path: Path,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    public_pki_paths = _public_pki(runtime_root)
    reserved_root = evidence_root / "pki-public"

    for reserved in (reserved_root, reserved_root / "ca-cert.pem"):
        with pytest.raises(terminal.TerminalIntegrationError) as caught:
            _prepare(
                terminal,
                authorization=authorization,
                marker=marker,
                public_pki_paths=public_pki_paths,
                artifact_paths=(reserved,),
            )
        assert caught.value.reason == "artifact_reserved_namespace"

    assert not os.path.lexists(reserved_root)
    assert not os.path.lexists(_pending_path(terminal, evidence_root))


def test_reserved_directory_creation_failure_is_stable_and_path_free(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    terminal = _terminal_integration()
    runtime_root, evidence_root = _roots(tmp_path)
    authorization = _authorization(tmp_path, runtime_root, evidence_root)
    marker = _consumed_marker(authorization)
    public_pki_paths = _public_pki(runtime_root)
    sensitive_locator = tmp_path / "must-not-leak"

    def fail_mkdir(*_args: object, **_kwargs: object) -> None:
        raise OSError(str(sensitive_locator))

    monkeypatch.setattr(terminal.os, "mkdir", fail_mkdir)

    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        _prepare(
            terminal,
            authorization=authorization,
            marker=marker,
            public_pki_paths=public_pki_paths,
        )

    assert caught.value.reason == "public_pki_freeze_failed"
    assert str(sensitive_locator) not in str(caught.value)
    assert caught.value.__cause__ is None
    assert caught.value.__context__ is None
    assert not isinstance(caught.value, OSError)
    assert not os.path.lexists(_pending_path(terminal, evidence_root))


def test_terminal_handoff_adds_no_operator_lifecycle_command() -> None:
    assert procedure.LIFECYCLE_STEPS == (
        "start",
        "seed",
        "reset",
        "stop",
        "rollback",
    )
    assert "finalize" not in procedure.LIFECYCLE_STEPS
    assert "terminal" not in procedure.LIFECYCLE_STEPS
