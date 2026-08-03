"""Fail-closed case observers for the additive three-product UAT slice.

The module owns evidence assertions only. Transport, journal copying and
receipt verification are injected by the concrete runtime composition. It does
not open sockets, mutate a journal or claim closure of the separate PostgreSQL
lifecycle gate.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Protocol

_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
_F1_CODE = "ACTOR_BINDING_MISMATCH"


class RuntimeCaseError(RuntimeError):
    """A case did not prove all of its required invariants."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class CaseResponse(Protocol):
    status_code: int

    def json(self) -> object: ...


@dataclass(frozen=True, slots=True)
class CounterSnapshot:
    soc_calls: int
    model_calls: int

    def __post_init__(self) -> None:
        for value in (self.soc_calls, self.model_calls):
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise RuntimeCaseError("counter_snapshot_invalid")


@dataclass(frozen=True, slots=True)
class RuntimeCaseDependencies:
    run_positive_request: Callable[[], Mapping[str, object]]
    run_f1_request: Callable[[], CaseResponse]
    run_copied_receipt_tamper: Callable[[], Mapping[str, object]]
    snapshot_counters: Callable[[], CounterSnapshot]
    snapshot_authoritative_journal: Callable[[], str]


@dataclass(frozen=True, slots=True)
class CaseCallbacks:
    positive: Callable[[object], Mapping[str, object]]
    f1: Callable[[object], Mapping[str, object]]
    f2: Callable[[object], Mapping[str, object]]


def _mapping(value: object, reason: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise RuntimeCaseError(reason)
    return value


def _journal_snapshot(callback: Callable[[], str]) -> str:
    try:
        value = callback()
    except Exception:  # noqa: BLE001 - collapse injected observer detail.
        raise RuntimeCaseError("journal_snapshot_invalid") from None
    if not isinstance(value, str) or _SHA256.fullmatch(value) is None:
        raise RuntimeCaseError("journal_snapshot_invalid")
    return value


def run_positive(dependencies: RuntimeCaseDependencies) -> dict[str, object]:
    """Require a durable verified read-only receipt from the positive path."""

    try:
        proof = _mapping(dependencies.run_positive_request(), "positive_proof_invalid")
    except RuntimeCaseError:
        raise
    except Exception:  # noqa: BLE001 - collapse injected transport detail.
        raise RuntimeCaseError("positive_proof_invalid") from None
    expected = {
        "receipt_verified": True,
        "durable_receipt": True,
        "side_effect_performed": False,
    }
    if any(proof.get(key) is not value for key, value in expected.items()):
        raise RuntimeCaseError("positive_proof_invalid")
    return {"case_id": "positive", "passed": True, **expected}


def run_f1(dependencies: RuntimeCaseDependencies) -> dict[str, object]:
    """Prove that advisory actor widening is denied before every effect."""

    try:
        counters_before = dependencies.snapshot_counters()
        journal_before = _journal_snapshot(dependencies.snapshot_authoritative_journal)
        response = dependencies.run_f1_request()
        document = _mapping(response.json(), "f1_invariant_failed")
        counters_after = dependencies.snapshot_counters()
        journal_after = _journal_snapshot(dependencies.snapshot_authoritative_journal)
    except RuntimeCaseError:
        raise
    except Exception:  # noqa: BLE001 - collapse injected observer detail.
        raise RuntimeCaseError("f1_invariant_failed") from None
    error = document.get("error")
    exact_denial = (
        getattr(response, "status_code", None) == 403
        and document.get("status") == "denied"
        and isinstance(error, Mapping)
        and error.get("code") == _F1_CODE
        and error.get("retryable") is False
    )
    soc_unchanged = counters_before.soc_calls == counters_after.soc_calls
    model_unchanged = counters_before.model_calls == counters_after.model_calls
    journal_unchanged = journal_before == journal_after
    if not (exact_denial and soc_unchanged and model_unchanged and journal_unchanged):
        raise RuntimeCaseError("f1_invariant_failed")
    return {
        "case_id": "F1",
        "passed": True,
        "fabric_status": 403,
        "soc_call_count_unchanged": True,
        "model_call_count_unchanged": True,
        "journal_unchanged": True,
    }


def run_f2(dependencies: RuntimeCaseDependencies) -> dict[str, object]:
    """Prove copied-journal tampering cannot alter authoritative receipt state."""

    try:
        journal_before = _journal_snapshot(dependencies.snapshot_authoritative_journal)
        probe = _mapping(
            dependencies.run_copied_receipt_tamper(), "f2_invariant_failed"
        )
        journal_after = _journal_snapshot(dependencies.snapshot_authoritative_journal)
    except RuntimeCaseError:
        raise
    except Exception:  # noqa: BLE001 - collapse injected tamper-probe detail.
        raise RuntimeCaseError("f2_invariant_failed") from None
    copied_rejected = (
        probe.get("disposition") == "unverifiable" and probe.get("receipt") is None
    )
    authority_unchanged = journal_before == journal_after
    if not copied_rejected or not authority_unchanged:
        raise RuntimeCaseError("f2_invariant_failed")
    return {
        "case_id": "F2",
        "passed": True,
        "copied_receipt_rejected": True,
        "authoritative_journal_unchanged": True,
    }


def build_case_callbacks(dependencies: RuntimeCaseDependencies) -> CaseCallbacks:
    """Adapt the concrete case observers to :mod:`runner` callbacks."""

    if not isinstance(dependencies, RuntimeCaseDependencies):
        raise TypeError("runtime case dependencies are invalid")
    return CaseCallbacks(
        positive=lambda _authorization: run_positive(dependencies),
        f1=lambda _authorization: run_f1(dependencies),
        f2=lambda _authorization: run_f2(dependencies),
    )


__all__ = [
    "CaseCallbacks",
    "CounterSnapshot",
    "RuntimeCaseDependencies",
    "RuntimeCaseError",
    "build_case_callbacks",
    "run_f1",
    "run_f2",
    "run_positive",
]
