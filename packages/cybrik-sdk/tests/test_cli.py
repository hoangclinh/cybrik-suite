"""Unit tests for developer CLI utility using typer.testing.CliRunner."""

from __future__ import annotations

from unittest.mock import patch

import httpx
from typer.testing import CliRunner

from cybrik_sdk.cli import app
from cybrik_sdk.client import SyncCybrikClient
from tests.conftest import default_mock_router

runner = CliRunner()


def test_cli_version() -> None:
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert "CYBRIK Unified SDK v0.1.0" in result.output
    assert "Base Gateway:" in result.output
    assert "SOC Center:" in result.output
    assert "Tool Fabric:" in result.output
    assert "AI Platform:" in result.output


def test_cli_version_with_custom_endpoints() -> None:
    result = runner.invoke(
        app,
        [
            "version",
            "--base-url",
            "http://gateway.cybrik.corp:9000",
            "--soc-url",
            "http://soc.cybrik.corp:9001",
        ],
    )
    assert result.exit_code == 0
    assert "http://gateway.cybrik.corp:9000" in result.output
    assert "http://soc.cybrik.corp:9001" in result.output


def test_cli_containment_list_canonical_catalog() -> None:
    result = runner.invoke(app, ["containment", "list", "--offline"])
    assert result.exit_code == 0
    assert "Canonical SOAR Containment Catalog" in result.output
    assert "isolate_host" in result.output
    assert "CRITICAL" in result.output
    assert "block_ip" in result.output
    assert "sinkhole_dns" in result.output


def test_cli_health_all_passing() -> None:
    mock_transport = httpx.MockTransport(default_mock_router)

    with patch(
        "cybrik_sdk.cli.SyncCybrikClient",
        lambda config: SyncCybrikClient(config, transport=mock_transport),
    ):
        result = runner.invoke(app, ["health", "--base-url", "http://test-cybrik.local:8000"])
        assert result.exit_code == 0
        assert "CYBRIK Ecosystem Health Check:" in result.output
        assert "[PASS] SOC Command Center" in result.output
        assert "[PASS] Security Tool Fabric" in result.output
        assert "[PASS] Cyber AI Platform" in result.output


def test_cli_health_service_failure() -> None:
    def failure_router(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "/soc" in url:
            return httpx.Response(500, text="Internal Server Error")
        return httpx.Response(200, json={"status": "healthy"})

    mock_transport = httpx.MockTransport(failure_router)

    with patch(
        "cybrik_sdk.cli.SyncCybrikClient",
        lambda config: SyncCybrikClient(config, transport=mock_transport, backoff_factor=0.001),
    ):
        result = runner.invoke(app, ["health", "--base-url", "http://test-cybrik.local:8000"])
        assert result.exit_code == 1
        assert "[FAIL] SOC Command Center" in result.output


def test_cli_cases_list_with_cases() -> None:
    mock_transport = httpx.MockTransport(default_mock_router)

    with patch(
        "cybrik_sdk.cli.SyncCybrikClient",
        lambda config: SyncCybrikClient(config, transport=mock_transport),
    ):
        result = runner.invoke(app, ["cases", "list", "--status", "open"])
        assert result.exit_code == 0
        assert "Found 2 case(s) [status=open]:" in result.output
        assert "c1a92a54-7128-4444-9333-e5d2b1f89012" in result.output
        assert "CRITICAL" in result.output
        assert "Suspected Kerberos Ticket Forgery" in result.output


def test_cli_cases_list_empty() -> None:
    def empty_cases_router(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"items": [], "total": 0, "page": 1, "page_size": 50})

    mock_transport = httpx.MockTransport(empty_cases_router)

    with patch(
        "cybrik_sdk.cli.SyncCybrikClient",
        lambda config: SyncCybrikClient(config, transport=mock_transport),
    ):
        result = runner.invoke(app, ["cases", "list", "--status", "closed"])
        assert result.exit_code == 0
        assert "No cases found with status 'closed'." in result.output


def test_cli_containment_list_live() -> None:
    mock_transport = httpx.MockTransport(default_mock_router)

    with patch(
        "cybrik_sdk.cli.SyncCybrikClient",
        lambda config: SyncCybrikClient(config, transport=mock_transport),
    ):
        result = runner.invoke(app, ["containment", "list"])
        assert result.exit_code == 0
        assert "Available Tool Fabric Capabilities" in result.output
        assert "isolate_host" in result.output
