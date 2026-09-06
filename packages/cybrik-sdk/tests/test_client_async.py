"""Unit tests for asynchronous CybrikClient using httpx.MockTransport."""

from __future__ import annotations

import httpx
import pytest

from cybrik_sdk.client import CybrikClient
from cybrik_sdk.config import CybrikConfig
from cybrik_sdk.exceptions import CybrikNotFoundError
from cybrik_sdk.models import Case, ContainmentReceipt, ContainmentRequest
from tests.conftest import default_mock_router


@pytest.mark.asyncio
async def test_async_client_soc_get_health(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        health = await client.soc.get_health()
        assert health["status"] == "healthy"
        assert health["service"] == "cybrik-soc"


@pytest.mark.asyncio
async def test_async_client_soc_list_cases(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        cases = await client.soc.list_cases(status="open")
        assert len(cases) == 2
        assert isinstance(cases[0], Case)
        assert cases[0].priority == "critical"
        assert cases[0].title == "Suspected Kerberos Ticket Forgery on CYB-DC-01"
        assert cases[1].priority == "high"


@pytest.mark.asyncio
async def test_async_client_soc_list_cases_raw_array(mock_config: CybrikConfig) -> None:
    def raw_array_router(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json=[{"id": "raw-1", "title": "Raw Case", "priority": "low", "status": "open"}]
        )

    transport = httpx.MockTransport(raw_array_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        cases = await client.soc.list_cases()
        assert len(cases) == 1
        assert cases[0].id == "raw-1"
        assert cases[0].title == "Raw Case"


@pytest.mark.asyncio
async def test_async_client_soc_get_case(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        case = await client.soc.get_case("c1a92a54-7128-4444-9333-e5d2b1f89012")
        assert case.id == "c1a92a54-7128-4444-9333-e5d2b1f89012"
        assert case.priority == "critical"
        assert case.version == 1


@pytest.mark.asyncio
async def test_async_client_soc_get_case_not_found(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        with pytest.raises(CybrikNotFoundError) as exc_info:
            await client.soc.get_case("not-found")
        assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_async_client_soc_export_case_json(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        export_data = await client.soc.export_case(
            "c1a92a54-7128-4444-9333-e5d2b1f89012", format="json"
        )
        assert isinstance(export_data, dict)
        assert export_data["format"] == "json"
        assert export_data["exported_case"]["id"] == "c1a92a54-7128-4444-9333-e5d2b1f89012"


@pytest.mark.asyncio
async def test_async_client_soc_export_case_text(mock_config: CybrikConfig) -> None:
    def text_export_router(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, text="id,title,priority\n1,Incident,high", headers={"Content-Type": "text/csv"}
        )

    transport = httpx.MockTransport(text_export_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        result = await client.soc.export_case("c1a92a54-7128-4444-9333-e5d2b1f89012", format="csv")
        assert isinstance(result, str)
        assert "id,title,priority" in result


@pytest.mark.asyncio
async def test_async_client_fabric_get_health(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        health = await client.fabric.get_health()
        assert health["status"] == "healthy"
        assert health["service"] == "cybrik-fabric"


@pytest.mark.asyncio
async def test_async_client_fabric_list_capabilities(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        caps = await client.fabric.list_capabilities()
        assert len(caps) == 2
        assert caps[0]["name"] == "isolate_host"
        assert caps[0]["risk_tier"] == "CRITICAL"


@pytest.mark.asyncio
async def test_async_client_fabric_execute_containment_dict(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        receipt = await client.fabric.execute_containment(
            action="isolate_host",
            params={"hostname": "HOST-W10-TURNER", "reason": "Phishing detection"},
            dry_run=False,
        )
        assert isinstance(receipt, ContainmentReceipt)
        assert receipt.receipt_id == "rcpt-isolate-98421"
        assert receipt.action_type == "isolate_host"
        assert receipt.risk_tier == "CRITICAL"
        assert receipt.rollback_available is True
        assert receipt.rollback_action_type == "unisolate_host"


@pytest.mark.asyncio
async def test_async_client_fabric_execute_containment_model(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        req = ContainmentRequest(
            action="isolate_host",
            params={"hostname": "HOST-W10-TURNER"},
            reason="Active intrusion",
        )
        receipt = await client.fabric.execute_containment(req)
        assert receipt.receipt_id == "rcpt-isolate-98421"
        assert receipt.status == "completed"


@pytest.mark.asyncio
async def test_async_client_ai_get_health(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        health = await client.ai.get_health()
        assert health["status"] == "healthy"
        assert health["service"] == "cybrik-ai"


@pytest.mark.asyncio
async def test_async_client_ai_run_benchmark(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        report = await client.ai.run_benchmark(model="qwen3.6:27b-q4_K_M")
        assert report.benchmark_id == "bench-20260906-001"
        assert report.status == "QUALIFIED"
        assert report.overall_fidelity_score == 0.985
        assert len(report.scenarios) == 2


@pytest.mark.asyncio
async def test_async_client_ai_list_scenarios(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        scenarios = await client.ai.list_scenarios()
        assert len(scenarios) == 2
        assert scenarios[0]["id"] == "triage-01"


@pytest.mark.asyncio
async def test_async_client_aggregate_health(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    async with CybrikClient(mock_config, transport=transport) as client:
        health = await client.get_health()
        assert health["soc"]["status"] == "healthy"
        assert health["fabric"]["status"] == "healthy"
        assert health["ai"]["status"] == "healthy"
