"""Unit tests for exponential backoff retry logic on 429 and 503."""

from __future__ import annotations

import httpx
import pytest

from cybrik_sdk.client import CybrikClient, SyncCybrikClient
from cybrik_sdk.config import CybrikConfig
from cybrik_sdk.exceptions import CybrikError, CybrikNotFoundError, CybrikRateLimitError


@pytest.mark.asyncio
async def test_retry_on_429_success_second_attempt_async() -> None:
    attempts = 0

    def rate_limit_router(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"Retry-After": "0.001"}, text="Too Many Requests")
        return httpx.Response(200, json={"status": "recovered"})

    config = CybrikConfig(base_url="http://test-cybrik.local", max_retries=2)
    transport = httpx.MockTransport(rate_limit_router)
    async with CybrikClient(config, transport=transport, backoff_factor=0.001) as client:
        resp = await client.soc.get_health()
        assert resp["status"] == "recovered"
        assert attempts == 2


def test_retry_on_429_success_second_attempt_sync() -> None:
    attempts = 0

    def rate_limit_router(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"Retry-After": "0.001"}, text="Rate limited")
        return httpx.Response(200, json={"status": "recovered_sync"})

    config = CybrikConfig(base_url="http://test-cybrik.local", max_retries=2)
    transport = httpx.MockTransport(rate_limit_router)
    with SyncCybrikClient(config, transport=transport, backoff_factor=0.001) as client:
        resp = client.soc.get_health()
        assert resp["status"] == "recovered_sync"
        assert attempts == 2


@pytest.mark.asyncio
async def test_retry_on_429_exhausted_raises_rate_limit_error() -> None:
    attempts = 0

    def persistent_429_router(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(429, headers={"Retry-After": "0.001"}, text="Persistent rate limit")

    config = CybrikConfig(base_url="http://test-cybrik.local", max_retries=2)
    transport = httpx.MockTransport(persistent_429_router)
    async with CybrikClient(config, transport=transport, backoff_factor=0.001) as client:
        with pytest.raises(CybrikRateLimitError) as exc_info:
            await client.soc.get_health()
        assert exc_info.value.status_code == 429
        assert exc_info.value.retry_after == 0.001
        assert attempts == 3  # Initial attempt + 2 retries


@pytest.mark.asyncio
async def test_retry_on_503_success_third_attempt_async() -> None:
    attempts = 0

    def flakey_503_router(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            return httpx.Response(503, text="Service Temporarily Unavailable")
        return httpx.Response(200, json={"status": "ready"})

    config = CybrikConfig(base_url="http://test-cybrik.local", max_retries=3)
    transport = httpx.MockTransport(flakey_503_router)
    async with CybrikClient(config, transport=transport, backoff_factor=0.001) as client:
        resp = await client.fabric.get_health()
        assert resp["status"] == "ready"
        assert attempts == 3


def test_retry_on_503_exhausted_raises_cybrik_error_sync() -> None:
    attempts = 0

    def persistent_503_router(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503, text="Permanent outage")

    config = CybrikConfig(base_url="http://test-cybrik.local", max_retries=2)
    transport = httpx.MockTransport(persistent_503_router)
    with SyncCybrikClient(config, transport=transport, backoff_factor=0.001) as client:
        with pytest.raises(CybrikError) as exc_info:
            client.fabric.get_health()
        assert exc_info.value.status_code == 503
        assert attempts == 3


@pytest.mark.asyncio
async def test_non_retryable_404_fails_immediately_without_retries() -> None:
    attempts = 0

    def not_found_router(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(404, json={"detail": "Resource missing"})

    config = CybrikConfig(base_url="http://test-cybrik.local", max_retries=3)
    transport = httpx.MockTransport(not_found_router)
    async with CybrikClient(config, transport=transport, backoff_factor=0.001) as client:
        with pytest.raises(CybrikNotFoundError):
            await client.soc.get_case("unknown-id")
        assert attempts == 1  # 404 should never retry
