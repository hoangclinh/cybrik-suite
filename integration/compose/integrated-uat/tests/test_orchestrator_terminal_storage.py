from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from test_orchestrator import authorization, orchestrator, snapshot

from cybrik_suite_integrated_uat import (
    CONSUMPTION_MARKER,
    TERMINAL_SEAL,
    OrchestrationFailure,
    storage,
)


def test_exclusive_evidence_readback_handles_short_reads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth = authorization(tmp_path)
    real_read = storage.os.read

    def short_read(descriptor: int, count: int) -> bytes:
        return real_read(descriptor, min(count, 1))

    monkeypatch.setattr(storage.os, "read", short_read)

    seal = orchestrator(auth, []).run(auth)

    assert seal.status == "sealed"


def test_terminal_inspection_failure_still_writes_one_fail_closed_outcome(
    tmp_path: Path,
) -> None:
    auth = authorization(tmp_path)

    with pytest.raises(OrchestrationFailure, match="^terminal_inspection_failed$"):
        orchestrator(auth, [], snapshots=(snapshot(auth),)).run(auth)

    stored = json.loads((auth.evidence_root / TERMINAL_SEAL).read_text())
    assert stored["status"] == "failed"
    assert stored["failure_code"] == "terminal_inspection_failed"
    assert stored["terminal_absence_proof"]["inspection_succeeded"] is False
    assert sorted(path.name for path in auth.evidence_root.iterdir()) == sorted(
        (CONSUMPTION_MARKER, TERMINAL_SEAL)
    )


def test_terminalization_failure_preserves_reserved_interrupted_outcome(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth = authorization(tmp_path)
    events: list[str] = []

    def fail_replace(source: Path, destination: Path) -> None:
        raise OSError("synthetic atomic replacement failure")

    monkeypatch.setattr(storage.os, "replace", fail_replace)

    with pytest.raises(OrchestrationFailure, match="^evidence_write_failed$"):
        orchestrator(auth, events).run(auth)

    marker = auth.evidence_root / CONSUMPTION_MARKER
    outcome = auth.evidence_root / TERMINAL_SEAL
    stored = json.loads(outcome.read_text(encoding="utf-8"))
    assert marker.is_file()
    assert stored["status"] == "reserved_interrupted"
    assert stored["failure_code"] == "attempt_interrupted_before_terminalization"
    assert stored["marker_sha256"] == storage.consumption_marker_digest(auth)
    assert stored["postgres_d2_receipt_sha256"] is None
    assert stored["alert_context_receipt_sha256"] is None
    assert not (auth.evidence_root / storage.PENDING_TERMINAL_SEAL).exists()
    before = tuple(events)
    with pytest.raises(OrchestrationFailure, match="^authorization_already_consumed$"):
        orchestrator(auth, events).run(auth)
    assert tuple(events) == before


def test_consume_failure_preserves_reserved_interrupted_state_and_blocks_retry(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth = authorization(tmp_path)
    events: list[str] = []
    real_open = storage.os.open

    def fail_marker_create(path: Path, flags: int, *args: object) -> int:
        if Path(path).name == CONSUMPTION_MARKER and flags & os.O_CREAT:
            raise OSError("synthetic marker create failure")
        return real_open(path, flags, *args)

    monkeypatch.setattr(storage.os, "open", fail_marker_create)

    with pytest.raises(OrchestrationFailure, match="^evidence_write_failed$"):
        orchestrator(auth, events).run(auth)

    assert events == ["inspect.preflight"]
    assert not (auth.evidence_root / CONSUMPTION_MARKER).exists()
    outcome = auth.evidence_root / TERMINAL_SEAL
    stored = json.loads(outcome.read_text(encoding="utf-8"))
    assert stored["status"] == "reserved_interrupted"
    assert stored["failure_code"] == "attempt_interrupted_before_terminalization"
    with pytest.raises(OrchestrationFailure, match="^terminal_seal_exists$"):
        orchestrator(auth, events).run(auth)
    assert events == ["inspect.preflight"]


def test_preexisting_marker_or_terminal_seal_fails_before_any_effect(
    tmp_path: Path,
) -> None:
    auth = authorization(tmp_path)
    marker = auth.evidence_root / CONSUMPTION_MARKER
    marker.write_text("occupied", encoding="utf-8")
    events: list[str] = []

    with pytest.raises(OrchestrationFailure, match="^authorization_already_consumed$"):
        orchestrator(auth, events).run(auth)
    assert events == []

    marker.unlink()
    (auth.evidence_root / TERMINAL_SEAL).write_text("occupied", encoding="utf-8")
    with pytest.raises(OrchestrationFailure, match="^terminal_seal_exists$"):
        orchestrator(auth, events).run(auth)
    assert events == []
