from __future__ import annotations

from dataclasses import dataclass

import pytest
from cybrik_suite_uat_fabric import runtime_cases


@dataclass(frozen=True)
class _Response:
    status_code: int
    document: object

    def json(self) -> object:
        return self.document


def _dependencies() -> tuple[runtime_cases.RuntimeCaseDependencies, list[str]]:
    events: list[str] = []
    counters = iter(
        (
            runtime_cases.CounterSnapshot(soc_calls=1, model_calls=1),
            runtime_cases.CounterSnapshot(soc_calls=1, model_calls=1),
        )
    )
    journals = iter(("a" * 64, "a" * 64, "a" * 64, "a" * 64))

    def positive() -> dict[str, object]:
        events.append("positive")
        return {
            "receipt_verified": True,
            "durable_receipt": True,
            "side_effect_performed": False,
        }

    def f1() -> _Response:
        events.append("F1")
        return _Response(
            403,
            {
                "status": "denied",
                "error": {
                    "code": "ACTOR_BINDING_MISMATCH",
                    "retryable": False,
                },
            },
        )

    def f2() -> dict[str, object]:
        events.append("F2")
        return {"disposition": "unverifiable", "receipt": None}

    return (
        runtime_cases.RuntimeCaseDependencies(
            run_positive_request=positive,
            run_f1_request=f1,
            run_copied_receipt_tamper=f2,
            snapshot_counters=lambda: next(counters),
            snapshot_authoritative_journal=lambda: next(journals),
        ),
        events,
    )


def test_positive_f1_and_f2_emit_only_verified_invariants() -> None:
    dependencies, events = _dependencies()

    assert runtime_cases.run_positive(dependencies) == {
        "case_id": "positive",
        "passed": True,
        "receipt_verified": True,
        "durable_receipt": True,
        "side_effect_performed": False,
    }
    assert runtime_cases.run_f1(dependencies) == {
        "case_id": "F1",
        "passed": True,
        "fabric_status": 403,
        "soc_call_count_unchanged": True,
        "model_call_count_unchanged": True,
        "journal_unchanged": True,
    }
    assert runtime_cases.run_f2(dependencies) == {
        "case_id": "F2",
        "passed": True,
        "copied_receipt_rejected": True,
        "authoritative_journal_unchanged": True,
    }
    assert events == ["positive", "F1", "F2"]


@pytest.mark.parametrize(
    "positive",
    (
        {},
        {
            "receipt_verified": False,
            "durable_receipt": True,
            "side_effect_performed": False,
        },
        {
            "receipt_verified": True,
            "durable_receipt": False,
            "side_effect_performed": False,
        },
        {
            "receipt_verified": True,
            "durable_receipt": True,
            "side_effect_performed": True,
        },
    ),
)
def test_positive_fails_closed_on_incomplete_receipt_proof(
    positive: dict[str, object],
) -> None:
    dependencies, _events = _dependencies()
    dependencies = runtime_cases.RuntimeCaseDependencies(
        run_positive_request=lambda: positive,
        run_f1_request=dependencies.run_f1_request,
        run_copied_receipt_tamper=dependencies.run_copied_receipt_tamper,
        snapshot_counters=dependencies.snapshot_counters,
        snapshot_authoritative_journal=dependencies.snapshot_authoritative_journal,
    )

    with pytest.raises(runtime_cases.RuntimeCaseError, match="positive_proof_invalid"):
        runtime_cases.run_positive(dependencies)


def test_f1_requires_exact_denial_and_unchanged_effect_boundaries() -> None:
    dependencies, _events = _dependencies()
    changed = iter(
        (
            runtime_cases.CounterSnapshot(soc_calls=1, model_calls=1),
            runtime_cases.CounterSnapshot(soc_calls=2, model_calls=1),
        )
    )
    dependencies = runtime_cases.RuntimeCaseDependencies(
        run_positive_request=dependencies.run_positive_request,
        run_f1_request=dependencies.run_f1_request,
        run_copied_receipt_tamper=dependencies.run_copied_receipt_tamper,
        snapshot_counters=lambda: next(changed),
        snapshot_authoritative_journal=dependencies.snapshot_authoritative_journal,
    )

    with pytest.raises(runtime_cases.RuntimeCaseError, match="f1_invariant_failed"):
        runtime_cases.run_f1(dependencies)


def test_f2_rejects_any_tamper_answer_that_exposes_a_receipt() -> None:
    dependencies, _events = _dependencies()
    dependencies = runtime_cases.RuntimeCaseDependencies(
        run_positive_request=dependencies.run_positive_request,
        run_f1_request=dependencies.run_f1_request,
        run_copied_receipt_tamper=lambda: {
            "disposition": "unverifiable",
            "receipt": {"status": "failed"},
        },
        snapshot_counters=dependencies.snapshot_counters,
        snapshot_authoritative_journal=dependencies.snapshot_authoritative_journal,
    )

    with pytest.raises(runtime_cases.RuntimeCaseError, match="f2_invariant_failed"):
        runtime_cases.run_f2(dependencies)


def test_callbacks_ignore_runner_authorization_and_preserve_order() -> None:
    dependencies, events = _dependencies()
    callbacks = runtime_cases.build_case_callbacks(dependencies)

    assert callbacks.positive(object())["case_id"] == "positive"
    assert callbacks.f1(object())["case_id"] == "F1"
    assert callbacks.f2(object())["case_id"] == "F2"
    assert events == ["positive", "F1", "F2"]
