"""Injected one-attempt orchestrator for the three-process local UAT.

Status: UAT-ONLY / DEFAULT HOLD / NOT PRODUCTION. This module owns sequencing
and terminal evidence, not product composition or process creation. Every
effectful operation is injected. The default CLI supplies none and therefore
always reports HOLD without importing product runtimes or opening a socket.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from .evidence import EvidenceArtifact, EvidenceError, EvidenceWriter

HOLD_EXIT_STATUS: Final = 2
REQUIRED_ABSENCE_CHECKS: Final = (
    "ai_listener_absent",
    "ai_process_absent",
    "fabric_listener_absent",
    "fabric_process_absent",
    "private_material_absent",
    "repository_residual_absent",
    "runtime_root_absent",
    "soc_listener_absent",
    "soc_process_absent",
)
_HEX64 = re.compile(r"[0-9a-f]{64}")
_IDENTIFIER = re.compile(r"[a-z0-9][a-z0-9._-]{0,127}")


class RunnerError(RuntimeError):
    """Stable orchestration failure that never reflects collaborator detail."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class RunnerHold(RunnerError):
    """No exact external one-shot authority exists; no runtime step may begin."""


Effect = Callable[[object], object]
Ready = Callable[[object], None]
Stop = Callable[[object], None]
Case = Callable[[object], Mapping[str, object]]
Absence = Callable[[object], Mapping[str, bool]]
Consume = Callable[[object, str], None]
EvidenceRoot = Callable[[object], Path]
Finalize = Callable[[object], None]


def _authorization_evidence_root(authorization: object) -> Path:
    root = getattr(authorization, "evidence_root", None)
    if not isinstance(root, Path):
        raise RunnerHold("external_exact_authorization_invalid")
    return root


def _noop_finalize(_authorization: object) -> None:
    return None


@dataclass(frozen=True, slots=True)
class RunnerDependencies:
    """Every effect required by one attempt; construction itself is inert."""

    authorize: Callable[[], object | None]
    start_soc: Effect
    wait_soc_ready: Ready
    start_fabric: Effect
    wait_fabric_ready: Ready
    start_ai: Effect
    wait_ai_ready: Ready
    run_positive: Case
    run_f1: Case
    run_f2: Case
    stop_ai: Stop
    stop_fabric: Stop
    stop_soc: Stop
    verify_absent: Absence
    consume_authorization: Consume
    finalize_runtime: Finalize = _noop_finalize
    evidence_root_for: EvidenceRoot = _authorization_evidence_root


@dataclass(frozen=True, slots=True)
class RunResult:
    status: str
    terminal_sha256: str
    artifacts: tuple[EvidenceArtifact, ...]


@dataclass(frozen=True, slots=True)
class _AuthorityView:
    authorization_id: str
    authorization_sha256: str
    source_tuple_sha256: str
    evidence_root: Path


def _source_tuple_digest(authorization: object) -> str | None:
    explicit = getattr(authorization, "source_tuple_sha256", None)
    if isinstance(explicit, str):
        return explicit
    observations = getattr(authorization, "observations", None)
    aggregate = getattr(authorization, "aggregate", None)
    aggregate_sha = getattr(aggregate, "sha256", None)
    if not isinstance(observations, tuple) or not isinstance(aggregate_sha, str):
        return None
    rows: list[str] = []
    for item in observations:
        role = getattr(item, "role", None)
        commit = getattr(item, "commit", None)
        tree = getattr(item, "tree", None)
        if not all(isinstance(value, str) for value in (role, commit, tree)):
            return None
        rows.append(f"{role}\0{commit}\0{tree}\n")
    rows.append(f"tracked_blob_aggregate\0{aggregate_sha}\n")
    return hashlib.sha256("".join(rows).encode("utf-8")).hexdigest()


def _authority(dependencies: RunnerDependencies) -> tuple[object, _AuthorityView]:
    try:
        authorization = dependencies.authorize()
    except Exception:  # noqa: BLE001 - collapse external verifier detail at the boundary.
        raise RunnerHold("external_exact_authorization_absent") from None
    if authorization is None:
        raise RunnerHold("external_exact_authorization_absent")
    authorization_id = getattr(authorization, "authorization_id", None)
    authorization_sha256 = getattr(authorization, "authorization_sha256", None)
    source_tuple_sha256 = _source_tuple_digest(authorization)
    missing = object()
    exact = getattr(authorization, "exact", missing)
    external = getattr(authorization, "external", missing)
    one_shot = getattr(authorization, "one_shot", missing)
    consumed = getattr(authorization, "consumed", missing)
    try:
        evidence_root = dependencies.evidence_root_for(authorization)
    except Exception:  # noqa: BLE001 - collapse resolver detail at the boundary.
        raise RunnerHold("external_exact_authorization_invalid") from None
    if (
        not isinstance(authorization_id, str)
        or _IDENTIFIER.fullmatch(authorization_id) is None
        or not isinstance(authorization_sha256, str)
        or _HEX64.fullmatch(authorization_sha256) is None
        or not isinstance(source_tuple_sha256, str)
        or _HEX64.fullmatch(source_tuple_sha256) is None
        or not isinstance(evidence_root, Path)
        or exact is not True
        or external is not True
        or one_shot is not True
        or consumed is not False
    ):
        raise RunnerHold("external_exact_authorization_invalid")
    return authorization, _AuthorityView(
        authorization_id=authorization_id,
        authorization_sha256=authorization_sha256,
        source_tuple_sha256=source_tuple_sha256,
        evidence_root=evidence_root,
    )


def _case_record(case_id: str, value: object) -> dict[str, object]:
    if not isinstance(value, Mapping):
        raise RunnerError("case_evidence_invalid")
    record = dict(value)
    required: dict[str, object]
    if case_id == "positive":
        required = {
            "case_id": "positive",
            "passed": True,
            "receipt_verified": True,
            "durable_receipt": True,
            "side_effect_performed": False,
        }
    elif case_id == "F1":
        required = {
            "case_id": "F1",
            "passed": True,
            "fabric_status": 403,
            "soc_call_count_unchanged": True,
            "model_call_count_unchanged": True,
            "journal_unchanged": True,
        }
    else:
        required = {
            "case_id": "F2",
            "passed": True,
            "copied_receipt_rejected": True,
            "authoritative_journal_unchanged": True,
        }
    if any(record.get(key) != expected for key, expected in required.items()):
        raise RunnerError("case_evidence_invalid")
    return record


def _absence_record(value: object) -> dict[str, bool]:
    if not isinstance(value, Mapping) or set(value) != set(REQUIRED_ABSENCE_CHECKS):
        raise RunnerError("absence_evidence_invalid")
    record = {key: value[key] for key in REQUIRED_ABSENCE_CHECKS}
    if any(item is not True for item in record.values()):
        raise RunnerError("residual_state_detected")
    return record


def _artifact_record(artifact: EvidenceArtifact) -> dict[str, object]:
    return {
        "filename": artifact.filename,
        "sha256": artifact.sha256,
        "size_bytes": artifact.size_bytes,
    }


def run_once(dependencies: RunnerDependencies) -> RunResult:
    """Run positive/F1/F2 once, teardown in reverse, seal, then consume authority."""

    if not isinstance(dependencies, RunnerDependencies):
        raise RunnerHold("external_exact_authorization_absent")
    authorization, authority = _authority(dependencies)
    observations = getattr(authorization, "observations", ())
    forbidden_roots = tuple(
        root
        for item in observations
        if isinstance((root := getattr(item, "root", None)), Path)
    )
    try:
        writer = EvidenceWriter(
            authority.evidence_root,
            repository_roots=forbidden_roots,
        )
    except EvidenceError:
        raise RunnerHold("external_exact_authorization_invalid") from None

    started: list[tuple[str, object, Stop]] = []
    artifacts: list[EvidenceArtifact] = []
    primary: RunnerError | None = None
    teardown_failed = False

    def start(role: str, launch: Effect, ready: Ready, stop: Stop) -> None:
        try:
            handle = launch(authorization)
            if handle is None:
                raise RuntimeError
            started.append((role, handle, stop))
            ready(handle)
        except Exception:  # noqa: BLE001 - injected process detail must not escape.
            raise RunnerError("runtime_step_failed") from None

    try:
        start(
            "soc",
            dependencies.start_soc,
            dependencies.wait_soc_ready,
            dependencies.stop_soc,
        )
        start(
            "fabric",
            dependencies.start_fabric,
            dependencies.wait_fabric_ready,
            dependencies.stop_fabric,
        )
        start(
            "ai",
            dependencies.start_ai,
            dependencies.wait_ai_ready,
            dependencies.stop_ai,
        )
        for filename, case_id, callback in (
            ("01-positive.json", "positive", dependencies.run_positive),
            ("02-f1.json", "F1", dependencies.run_f1),
            ("03-f2.json", "F2", dependencies.run_f2),
        ):
            try:
                record = _case_record(case_id, callback(authorization))
                artifacts.append(writer.write(filename, record))
            except RunnerError:
                raise
            except Exception:  # noqa: BLE001 - collaborator detail is never evidence.
                raise RunnerError("runtime_step_failed") from None
    except RunnerError as error:
        primary = error
    finally:
        for _role, handle, stop in reversed(started):
            try:
                stop(handle)
            except Exception:  # noqa: BLE001 - try every remaining reverse stop.
                teardown_failed = True
        try:
            dependencies.finalize_runtime(authorization)
        except Exception:  # noqa: BLE001 - finalizer detail is never evidence.
            teardown_failed = True

    absence: dict[str, bool] | None = None
    try:
        absence = _absence_record(dependencies.verify_absent(authorization))
    except RunnerError as error:
        if primary is None:
            primary = error
    except Exception:  # noqa: BLE001 - absence probes expose only a stable refusal.
        if primary is None:
            primary = RunnerError("absence_observation_failed")

    rollback_evidence_failed = False
    if absence is not None:
        try:
            artifacts.append(writer.write("04-rollback-no-residual.json", absence))
        except EvidenceError:
            rollback_evidence_failed = True

    if teardown_failed:
        raise RunnerError("teardown_failed")
    if rollback_evidence_failed:
        raise RunnerError("terminal_evidence_failed")
    if primary is not None:
        raise primary

    try:
        terminal = writer.write(
            "05-terminal-seal.json",
            {
                "artifacts": [_artifact_record(item) for item in artifacts],
                "authorization_id": authority.authorization_id,
                "authorization_sha256": authority.authorization_sha256,
                "source_tuple_sha256": authority.source_tuple_sha256,
                "status": "passed",
            },
        )
        artifacts.append(terminal)
    except EvidenceError:
        raise RunnerError("terminal_evidence_failed") from None

    try:
        dependencies.consume_authorization(authorization, terminal.sha256)
    except Exception:  # noqa: BLE001 - consumption backend detail must not escape.
        raise RunnerError("authorization_consumption_failed") from None
    return RunResult(
        status="passed",
        terminal_sha256=terminal.sha256,
        artifacts=tuple(artifacts),
    )


def main(argv: list[str] | None = None) -> int:
    """Inert CLI boundary. Runtime composition remains externally gated."""

    if argv not in (None, []):
        raise SystemExit(HOLD_EXIT_STATUS)
    print(
        json.dumps(
            {
                "execution_authorized": False,
                "reason": "external_exact_authorization_absent",
                "status": "HOLD",
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )
    return HOLD_EXIT_STATUS


__all__ = [
    "HOLD_EXIT_STATUS",
    "REQUIRED_ABSENCE_CHECKS",
    "RunResult",
    "RunnerDependencies",
    "RunnerError",
    "RunnerHold",
    "main",
    "run_once",
]
