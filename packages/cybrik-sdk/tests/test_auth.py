"""Unit tests for authentication header injection and authorization errors."""

from __future__ import annotations

import httpx
import pytest

from cybrik_sdk.client import CybrikClient, SyncCybrikClient
from cybrik_sdk.config import CybrikConfig
from cybrik_sdk.exceptions import CybrikAuthError


@pytest.mark.asyncio
async def test_bearer_token_header_injection_async() -> None:
    captured_headers: dict[str, str] = {}

    def capture_router(request: httpx.Request) -> httpx.Response:
        nonlocal captured_headers
        captured_headers = dict(request.headers)
        return httpx.Response(200, json={"status": "authenticated"})

    config = CybrikConfig(base_url="http://test-cybrik.local", token="test-jwt")
    transport = httpx.MockTransport(capture_router)
    async with CybrikClient(config, transport=transport) as client:
        await client.soc.get_health()

    assert captured_headers.get("authorization") == "Bearer test-jwt"
    assert "x-api-key" not in captured_headers


def test_bearer_token_header_injection_sync() -> None:
    captured_headers: dict[str, str] = {}

    def capture_router(request: httpx.Request) -> httpx.Response:
        nonlocal captured_headers
        captured_headers = dict(request.headers)
        return httpx.Response(200, json={"status": "authenticated"})

    config = CybrikConfig(base_url="http://test-cybrik.local", token="test-jwt")
    transport = httpx.MockTransport(capture_router)
    with SyncCybrikClient(config, transport=transport) as client:
        client.soc.get_health()

    assert captured_headers.get("authorization") == "Bearer test-jwt"


@pytest.mark.asyncio
async def test_api_key_header_injection_async() -> None:
    captured_headers: dict[str, str] = {}

    def capture_router(request: httpx.Request) -> httpx.Response:
        nonlocal captured_headers
        captured_headers = dict(request.headers)
        return httpx.Response(200, json={"status": "authenticated"})

    config = CybrikConfig(base_url="http://test-cybrik.local", api_key="test-key")
    transport = httpx.MockTransport(capture_router)
    async with CybrikClient(config, transport=transport) as client:
        await client.fabric.get_health()

    assert captured_headers.get("x-api-key") == "test-key"
    assert captured_headers.get("authorization") == "Bearer test-key"


def test_both_token_and_api_key_headers() -> None:
    captured_headers: dict[str, str] = {}

    def capture_router(request: httpx.Request) -> httpx.Response:
        nonlocal captured_headers
        captured_headers = dict(request.headers)
        return httpx.Response(200, json={"status": "authenticated"})

    config = CybrikConfig(
        base_url="http://test-cybrik.local",
        token="tok-1",
        api_key="key-2",
    )
    transport = httpx.MockTransport(capture_router)
    with SyncCybrikClient(config, transport=transport) as client:
        client.ai.get_health()

    assert captured_headers.get("authorization") == "Bearer tok-1"
    assert captured_headers.get("x-api-key") == "key-2"


@pytest.mark.asyncio
async def test_unauthorized_401_raises_cybrik_auth_error() -> None:
    def auth_401_router(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "Invalid credentials"})

    config = CybrikConfig(base_url="http://test-cybrik.local")
    transport = httpx.MockTransport(auth_401_router)
    async with CybrikClient(config, transport=transport) as client:
        with pytest.raises(CybrikAuthError) as exc_info:
            await client.soc.get_health()
        assert exc_info.value.status_code == 401


def test_forbidden_403_raises_cybrik_auth_error() -> None:
    def auth_403_router(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"detail": "Insufficient clearance"})

    config = CybrikConfig(base_url="http://test-cybrik.local")
    transport = httpx.MockTransport(auth_403_router)
    with SyncCybrikClient(config, transport=transport) as client:
        with pytest.raises(CybrikAuthError) as exc_info:
            client.fabric.get_health()
        assert exc_info.value.status_code == 403
