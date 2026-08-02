"""RED contract for the D2 pre-teardown/finalization integration boundary.

The tests are deliberately fast and import-inert.  They use only synthetic
temporary files and mocks: no listener, subprocess, Docker, database, network,
or live PKI operation is permitted here.  The missing implementation is the
pure ``cybrik_suite_uat_mtls.terminal_integration`` module.
"""

from __future__ import annotations

import hashlib
import importlib
import inspect
import json
import shutil
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import ModuleType
from typing import Final

import pytest
from cybrik_suite_uat_mtls import procedure, secret_inventory
from cybrik_suite_uat_mtls import runtime_authorization as runtime_auth

_HEX_A: Final = "a" * 40
_HEX_B: Final = "b" * 64
_HEX_C: Final = "c" * 64
_HEX_D: Final = "d" * 64
_RUNTIME_SECRET: Final = "synthetic-d2-runtime-secret-" + "x" * 40

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
    for index, (name, filename) in enumerate(_PUBLIC_PKI):
        path = pki_root / filename
        path.write_bytes(f"synthetic-public-material-{index}\n".encode("ascii"))
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
    persisted = object()
    captured: dict[str, object] = {}

    def persist(root: Path, candidate: object) -> object:
        captured["root"] = root
        captured["candidate"] = candidate
        return persisted

    monkeypatch.setattr(terminal.runtime_evidence, "persist_terminal_evidence", persist)

    result = terminal.finalize_terminal_handoff(
        prepared,
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
            prepared,
            authorization=forged_grant,
            consumed_marker=marker,
            live_absence_probe=lambda: _absence(),
        )
    assert caught.value.reason == "terminal_grant_mismatch"

    forged_marker = dict(marker)
    forged_marker["runtime_root"] = str(tmp_path / "other-runtime-root")
    with pytest.raises(terminal.TerminalIntegrationError) as caught:
        terminal.finalize_terminal_handoff(
            prepared,
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
    prepared = _prepare(
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
            prepared,
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
    prepared = _prepare(
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
            prepared,
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
    prepared = _prepare(
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
        prepared,
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
