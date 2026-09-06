"""Unit tests for synchronous SyncCybrikClient using httpx.MockTransport."""

from __future__ import annotations

import httpx
import pytest

from cybrik_sdk.client import SyncCybrikClient
from cybrik_sdk.config import CybrikConfig
from cybrik_sdk.exceptions import CybrikNotFoundError
from cybrik_sdk.models import Case, ContainmentReceipt, ContainmentRequest
from tests.conftest import default_mock_router


def test_sync_client_soc_get_health(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        health = client.soc.get_health()
        assert health["status"] == "healthy"
        assert health["service"] == "cybrik-soc"


def test_sync_client_soc_list_cases(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        cases = client.soc.list_cases(status="open")
        assert len(cases) == 2
        assert isinstance(cases[0], Case)
        assert cases[0].priority == "critical"
        assert cases[0].title == "Suspected Kerberos Ticket Forgery on CYB-DC-01"


def test_sync_client_soc_get_case(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        case = client.soc.get_case("c1a92a54-7128-4444-9333-e5d2b1f89012")
        assert case.id == "c1a92a54-7128-4444-9333-e5d2b1f89012"
        assert case.priority == "critical"


def test_sync_client_soc_get_case_not_found(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        with pytest.raises(CybrikNotFoundError) as exc_info:
            client.soc.get_case("not-found")
        assert exc_info.value.status_code == 404


def test_sync_client_soc_export_case(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        export_data = client.soc.export_case("c1a92a54-7128-4444-9333-e5d2b1f89012", format="json")
        assert isinstance(export_data, dict)
        assert export_data["format"] == "json"


def test_sync_client_fabric_get_health(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        health = client.fabric.get_health()
        assert health["status"] == "healthy"


def test_sync_client_fabric_list_capabilities(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        caps = client.fabric.list_capabilities()
        assert len(caps) == 2
        assert caps[0]["name"] == "isolate_host"


def test_sync_client_fabric_execute_containment(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        receipt = client.fabric.execute_containment(
            action="isolate_host",
            params={"hostname": "HOST-W10-TURNER"},
        )
        assert isinstance(receipt, ContainmentReceipt)
        assert receipt.receipt_id == "rcpt-isolate-98421"
        assert receipt.action_type == "isolate_host"


def test_sync_client_fabric_execute_containment_model(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        req = ContainmentRequest(
            action="isolate_host",
            params={"hostname": "HOST-W10-TURNER"},
        )
        receipt = client.fabric.execute_containment(req)
        assert receipt.receipt_id == "rcpt-isolate-98421"


def test_sync_client_ai_get_health(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        health = client.ai.get_health()
        assert health["status"] == "healthy"


def test_sync_client_ai_run_benchmark(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        report = client.ai.run_benchmark(model="qwen3.6:27b-q4_K_M")
        assert report.benchmark_id == "bench-20260906-001"
        assert report.status == "QUALIFIED"


def test_sync_client_ai_list_scenarios(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        scenarios = client.ai.list_scenarios()
        assert len(scenarios) == 2


def test_sync_client_aggregate_health(mock_config: CybrikConfig) -> None:
    transport = httpx.MockTransport(default_mock_router)
    with SyncCybrikClient(mock_config, transport=transport) as client:
        health = client.get_health()
        assert health["soc"]["status"] == "healthy"
        assert health["fabric"]["status"] == "healthy"
        assert health["ai"]["status"] == "healthy"
