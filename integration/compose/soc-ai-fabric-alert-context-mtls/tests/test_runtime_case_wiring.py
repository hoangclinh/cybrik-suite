from __future__ import annotations

import copy
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cybrik_suite_uat_fabric import runtime_case_wiring, runtime_cases


@dataclass
class _Response:
    status_code: int
    document: object

    def json(self) -> object:
        return copy.deepcopy(self.document)


class _Client:
    def __init__(self, responses: list[_Response]) -> None:
        self.responses = responses
        self.calls: list[tuple[str, str, dict[str, Any]]] = []

    def post(self, path: str, **kwargs: Any) -> _Response:
        self.calls.append(("POST", path, copy.deepcopy(kwargs)))
        return self.responses.pop(0)

    def get(self, path: str) -> _Response:
        self.calls.append(("GET", path, {}))
        return self.responses.pop(0)


def test_case_adapter_uses_exact_routes_and_proves_positive_f1_f2(
    tmp_path: Path,
) -> None:
    journal = tmp_path / "journal"
    journal.mkdir()
    (journal / "receipt.json").write_text(
        json.dumps({"receipt": "authoritative"}), encoding="utf-8"
    )
    positive = _Client([_Response(200, {"outcome": "completed"})])
    f1 = _Client(
        [
            _Response(
                403,
                {
                    "status": "denied",
                    "error": {
                        "code": "ACTOR_BINDING_MISMATCH",
                        "retryable": False,
                    },
                },
            )
        ]
    )
    soc_metrics = _Client(
        [_Response(200, {"soc_calls": 1}), _Response(200, {"soc_calls": 1})]
    )
    ai_metrics = _Client(
        [_Response(200, {"model_calls": 1}), _Response(200, {"model_calls": 1})]
    )
    wiring = runtime_case_wiring.RuntimeCaseWiring(
        positive_client=positive,
        f1_client=f1,
        soc_metrics_client=soc_metrics,
        ai_metrics_client=ai_metrics,
        positive_request={"request_id": "sum-uat-0001"},
        f1_request={
            "idempotency_key": "idem-f1-actor-mismatch-0001",  # gitleaks:allow
            "actor": {"id": "body-selected-actor"},
        },
        journal_root=journal,
        scratch_root=tmp_path / "scratch",
        authoritative_receipt_probe=lambda: {
            "receipt_verified": True,
            "durable_receipt": True,
            "side_effect_performed": False,
        },
        copied_receipt_tamper_probe=lambda _copy: {
            "disposition": "unverifiable",
            "receipt": None,
        },
    )
    dependencies = runtime_case_wiring.build_runtime_case_dependencies(wiring)

    assert runtime_cases.run_positive(dependencies)["passed"] is True
    assert runtime_cases.run_f1(dependencies)["passed"] is True
    assert runtime_cases.run_f2(dependencies)["passed"] is True
    assert [call[:2] for call in positive.calls] == [("POST", "/uat/v1/summarizations")]
    assert [call[:2] for call in f1.calls] == [("POST", "/api/v1/invocations")]
    assert f1.calls[0][2]["headers"] == {
        "Idempotency-Key": "idem-f1-actor-mismatch-0001"  # gitleaks:allow
    }
    assert all(call[:2] == ("GET", "/uat/v1/metrics") for call in soc_metrics.calls)
    assert all(call[:2] == ("GET", "/uat/v1/metrics") for call in ai_metrics.calls)
    assert not wiring.scratch_root.exists()


def test_journal_snapshot_rejects_symlink_and_metrics_require_exact_shape(
    tmp_path: Path,
) -> None:
    journal = tmp_path / "journal"
    journal.mkdir()
    outside = tmp_path / "outside.json"
    outside.write_text("{}", encoding="utf-8")
    (journal / "linked.json").symlink_to(outside)

    try:
        runtime_case_wiring.snapshot_journal(journal)
    except runtime_case_wiring.RuntimeCaseWiringError as error:
        assert error.reason == "journal_snapshot_invalid"
    else:
        raise AssertionError("symlinked journal entry was accepted")

    client = _Client([_Response(200, {"soc_calls": True})])
    try:
        runtime_case_wiring.read_metric(client, "soc_calls")
    except runtime_case_wiring.RuntimeCaseWiringError as error:
        assert error.reason == "metrics_invalid"
    else:
        raise AssertionError("boolean metric was accepted")


def test_case_wiring_rejects_unknown_metric_and_existing_scratch_root(
    tmp_path: Path,
) -> None:
    client = _Client([_Response(200, {"soc_calls": 0})])
    try:
        runtime_case_wiring.read_metric(client, "unknown")
    except runtime_case_wiring.RuntimeCaseWiringError as error:
        assert error.reason == "metrics_invalid"
    else:
        raise AssertionError("unknown metric was accepted")

    journal = tmp_path / "journal"
    journal.mkdir()
    (journal / "receipt.json").write_text("{}", encoding="utf-8")
    scratch = tmp_path / "scratch"
    scratch.mkdir()
    wiring = runtime_case_wiring.RuntimeCaseWiring(
        positive_client=_Client([]),
        f1_client=_Client([]),
        soc_metrics_client=_Client([]),
        ai_metrics_client=_Client([]),
        positive_request={},
        f1_request={
            "idempotency_key": "idem-f1-actor-mismatch-0001"  # gitleaks:allow
        },
        journal_root=journal.resolve(),
        scratch_root=scratch.resolve(),
        authoritative_receipt_probe=dict,
        copied_receipt_tamper_probe=lambda _copy: {},
    )
    dependencies = runtime_case_wiring.build_runtime_case_dependencies(wiring)
    try:
        dependencies.run_copied_receipt_tamper()
    except runtime_case_wiring.RuntimeCaseWiringError as error:
        assert error.reason == "scratch_root_invalid"
    else:
        raise AssertionError("existing scratch root was accepted")


def test_case_wiring_collapses_invalid_positive_f1_and_relative_journal(
    tmp_path: Path,
) -> None:
    journal = tmp_path / "journal"
    journal.mkdir()
    wiring = runtime_case_wiring.RuntimeCaseWiring(
        positive_client=_Client([_Response(503, {"status": "unavailable"})]),
        f1_client=_Client([]),
        soc_metrics_client=_Client([]),
        ai_metrics_client=_Client([]),
        positive_request={},
        f1_request={},
        journal_root=journal.resolve(),
        scratch_root=tmp_path / "scratch",
        authoritative_receipt_probe=dict,
        copied_receipt_tamper_probe=lambda _copy: {},
    )
    dependencies = runtime_case_wiring.build_runtime_case_dependencies(wiring)

    for callback, reason in (
        (dependencies.run_positive_request, "positive_request_failed"),
        (dependencies.run_f1_request, "f1_request_invalid"),
    ):
        try:
            callback()
        except runtime_case_wiring.RuntimeCaseWiringError as error:
            assert error.reason == reason
        else:
            raise AssertionError(f"{reason} was accepted")

    try:
        runtime_case_wiring.snapshot_journal(Path("relative"))
    except runtime_case_wiring.RuntimeCaseWiringError as error:
        assert error.reason == "journal_snapshot_invalid"
    else:
        raise AssertionError("relative journal was accepted")
