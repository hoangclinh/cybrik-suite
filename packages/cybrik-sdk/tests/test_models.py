"""Unit tests for Pydantic data models."""

from __future__ import annotations

from cybrik_sdk.models import (
    BenchmarkReport,
    Case,
    ContainmentReceipt,
    ContainmentRequest,
)


def test_case_model_validation() -> None:
    data = {
        "id": "case-uuid-1",
        "title": "Unauthorized Privilege Escalation",
        "priority": "critical",
        "status": "investigating",
        "version": 3,
        "custom_field": "preserved_in_extra",
    }
    case = Case.model_validate(data)
    assert case.id == "case-uuid-1"
    assert case.title == "Unauthorized Privilege Escalation"
    assert case.priority == "critical"
    assert case.status == "investigating"
    assert case.version == 3
    # Verify extra fields are allowed
    assert getattr(case, "custom_field", None) == "preserved_in_extra"


def test_containment_request_model() -> None:
    req = ContainmentRequest(
        action="block_ip",
        params={"ip_address": "198.51.100.42", "reason": "C2 Egress"},
        tenant_id="tenant-1",
        actor_id="analyst-1",
        dry_run=True,
    )
    dumped = req.model_dump()
    assert dumped["action"] == "block_ip"
    assert dumped["params"]["ip_address"] == "198.51.100.42"
    assert dumped["dry_run"] is True


def test_containment_receipt_model() -> None:
    data = {
        "receipt_id": "rcpt-12345",
        "action_type": "isolate_host",
        "risk_tier": "CRITICAL",
        "target_entity": "HOST-W10-TURNER",
        "tenant_id": "tenant-corp",
        "dry_run": False,
        "status": "completed",
        "rollback_available": True,
        "rollback_action_type": "unisolate_host",
        "signature": "mock-sig",
    }
    receipt = ContainmentReceipt.model_validate(data)
    assert receipt.receipt_id == "rcpt-12345"
    assert receipt.action_type == "isolate_host"
    assert receipt.risk_tier == "CRITICAL"
    assert receipt.rollback_available is True
    assert receipt.rollback_action_type == "unisolate_host"


def test_benchmark_report_model() -> None:
    data = {
        "benchmark_id": "bench-777",
        "workstream": "WS-08",
        "target_release": "v1.0.0-rc1",
        "status": "QUALIFIED",
        "model_name": "qwen3.6:27b-q4_K_M",
        "overall_fidelity_score": 0.99,
        "metrics": {"ttft_ms": 110.0, "generation_tps": 42.0},
        "scenarios": [{"name": "triage", "score": 1.0}],
    }
    report = BenchmarkReport.model_validate(data)
    assert report.benchmark_id == "bench-777"
    assert report.overall_fidelity_score == 0.99
    assert report.metrics["generation_tps"] == 42.0
    assert len(report.scenarios) == 1
