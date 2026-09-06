"""Common test fixtures and mock transports for CYBRIK SDK tests."""

from __future__ import annotations

import httpx
import pytest

from cybrik_sdk.config import CybrikConfig

MOCK_CASE_1 = {
    "id": "c1a92a54-7128-4444-9333-e5d2b1f89012",
    "title": "Suspected Kerberos Ticket Forgery on CYB-DC-01",
    "description": (
        "Anomalous TGS requests detected indicating potential Pass-the-Ticket lateral movement."
    ),
    "priority": "critical",
    "status": "open",
    "owner_membership_id": "u-analyst-1",
    "created_by_membership_id": "u-creator-1",
    "closure_reason": None,
    "resolution_summary": None,
    "closed_at": None,
    "version": 1,
    "created_at": "2026-09-06T12:00:00Z",
}

MOCK_CASE_2 = {
    "id": "b2c83d65-8239-5555-0444-f6e3c2a90123",
    "title": "Phishing ISO Execution on HOST-W10-TURNER",
    "description": (
        "Containerized ISO attachment bypassed Mark-of-the-Web and initiated DLL execution."
    ),
    "priority": "high",
    "status": "investigating",
    "owner_membership_id": "u-analyst-2",
    "created_by_membership_id": "u-creator-2",
    "closure_reason": None,
    "resolution_summary": None,
    "closed_at": None,
    "version": 2,
    "created_at": "2026-09-06T12:15:00Z",
}

MOCK_RECEIPT = {
    "receipt_id": "rcpt-isolate-98421",
    "action_type": "isolate_host",
    "risk_tier": "CRITICAL",
    "target_entity": "HOST-W10-TURNER:h-9921",
    "tenant_id": "tenant-corp-1",
    "dry_run": False,
    "status": "completed",
    "executed_at": "2026-09-06T12:20:00Z",
    "parameters_digest": "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "rollback_available": True,
    "rollback_action_type": "unisolate_host",
    "approval_lease_id": "lease-token-8841",
    "signature": "mock-ed25519-signature-string",
    "signing_key_id": "key-fabric-v1",
}

MOCK_BENCHMARK_REPORT = {
    "benchmark_id": "bench-20260906-001",
    "workstream": "WS-08",
    "target_release": "v1.0.0-rc1",
    "status": "QUALIFIED",
    "model_name": "qwen3.6:27b-q4_K_M",
    "overall_fidelity_score": 0.985,
    "timestamp": "2026-09-06T12:30:00Z",
    "metrics": {
        "ttft_ms": 142.5,
        "generation_tps": 38.4,
        "resident_memory_mb": 16420.0,
    },
    "scenarios": [
        {"scenario_id": "triage-01", "passed": True, "score": 1.0},
        {"scenario_id": "root-cause-01", "passed": True, "score": 0.97},
    ],
    "details": {"mode": "local_hardware"},
}

MOCK_CAPABILITIES = [
    {
        "name": "isolate_host",
        "action": "isolate_host",
        "risk_tier": "CRITICAL",
        "description": "Network isolation for compromised endpoint host",
        "reversible": True,
    },
    {
        "name": "block_ip",
        "action": "block_ip",
        "risk_tier": "MEDIUM",
        "description": "Block adversary IP on perimeter firewall",
        "reversible": True,
    },
]


def default_mock_router(request: httpx.Request) -> httpx.Response:
    """Simulate unified CYBRIK ecosystem backend endpoints."""
    url = str(request.url)
    path = request.url.path
    method = request.method

    # SOC endpoints
    if "/soc/health" in url or path == "/health" or path == "/soc/health":
        return httpx.Response(200, json={"status": "healthy", "service": "cybrik-soc"})
    if "/api/v1/cases/c1a92a54-7128-4444-9333-e5d2b1f89012/export" in url:
        return httpx.Response(200, json={"exported_case": MOCK_CASE_1, "format": "json"})
    if "/api/v1/cases/c1a92a54-7128-4444-9333-e5d2b1f89012" in url:
        return httpx.Response(200, json=MOCK_CASE_1)
    if "/api/v1/cases/not-found" in url:
        return httpx.Response(404, json={"detail": "Case not found"})
    if "/api/v1/cases" in url:
        return httpx.Response(
            200, json={"items": [MOCK_CASE_1, MOCK_CASE_2], "total": 2, "page": 1, "page_size": 50}
        )

    # Fabric endpoints
    if "/fabric/health" in url or path == "/fabric/health":
        return httpx.Response(200, json={"status": "healthy", "service": "cybrik-fabric"})
    if "/api/v1/capabilities" in url:
        return httpx.Response(200, json=MOCK_CAPABILITIES)
    if "/api/v1/containment/execute" in url and method == "POST":
        return httpx.Response(200, json=MOCK_RECEIPT)

    # AI endpoints
    if "/ai/health" in url or path == "/ai/health":
        return httpx.Response(200, json={"status": "healthy", "service": "cybrik-ai"})
    if "/api/v1/benchmarks/run" in url and method == "POST":
        return httpx.Response(200, json=MOCK_BENCHMARK_REPORT)
    if "/api/v1/scenarios" in url:
        return httpx.Response(
            200,
            json=[
                {"id": "triage-01", "name": "Incident Triage Evaluation"},
                {"id": "root-cause-01", "name": "Forensic Root Cause Analysis"},
            ],
        )

    return httpx.Response(404, json={"detail": f"Route not found: {method} {url}"})


@pytest.fixture
def mock_config() -> CybrikConfig:
    return CybrikConfig(
        base_url="http://test-cybrik.local:8000",
        soc_url="http://test-cybrik.local:8000/soc",
        fabric_url="http://test-cybrik.local:8000/fabric",
        ai_url="http://test-cybrik.local:8000/ai",
        token="test-token",
        api_key="test-key",
        timeout_seconds=5.0,
        max_retries=2,
    )
