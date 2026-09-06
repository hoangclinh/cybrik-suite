"""Unified asynchronous and synchronous client for CYBRIK."""

from __future__ import annotations

import asyncio
import time
from typing import Any, Callable, Coroutine

import httpx

from cybrik_sdk.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitBreakerOpenError,
)
from cybrik_sdk.config import CybrikConfig
from cybrik_sdk.exceptions import (
    CybrikError,
    CybrikNotFoundError,
    CybrikRateLimitError,
    raise_for_status_code,
)
from cybrik_sdk.models import (
    BenchmarkReport,
    Case,
    ContainmentReceipt,
    ContainmentRequest,
)

AsyncRequester = Callable[..., Coroutine[Any, Any, httpx.Response]]
SyncRequester = Callable[..., httpx.Response]


def _build_auth_headers(config: CybrikConfig) -> dict[str, str]:
    """Inject standard authentication and metadata headers."""
    headers: dict[str, str] = {
        "User-Agent": "cybrik-sdk/0.1.0",
        "Accept": "application/json",
    }
    if config.token:
        headers["Authorization"] = f"Bearer {config.token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"

    if config.api_key:
        headers["X-API-Key"] = config.api_key

    return headers


def _parse_retry_after(response: httpx.Response) -> float | None:
    """Parse numeric Retry-After header if present."""
    header = response.headers.get("Retry-After")
    if header is None:
        return None
    try:
        return float(header)
    except (ValueError, TypeError):
        return None


# -----------------------------------------------------------------------------
# Asynchronous Sub-clients
# -----------------------------------------------------------------------------


class SocClient:
    """Asynchronous client for CYBRIK SOC Command Center."""

    def __init__(self, base_url: str, requester: AsyncRequester) -> None:
        self._base_url = base_url.rstrip("/")
        self._request = requester

    async def get_health(self) -> dict[str, Any]:
        """Fetch health status of SOC service."""
        try:
            resp = await self._request("GET", f"{self._base_url}/health")
        except CybrikNotFoundError:
            resp = await self._request("GET", f"{self._base_url}/api/v1/health")
        return resp.json()  # type: ignore[no-any-return]

    async def list_cases(
        self,
        status: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> list[Case]:
        """List cases with optional status filter and pagination."""
        params: dict[str, Any] = {"page": page, "page_size": page_size}
        if status:
            params["status"] = status
        resp = await self._request("GET", f"{self._base_url}/api/v1/cases", params=params)
        data = resp.json()
        if isinstance(data, dict) and "items" in data:
            return [Case.model_validate(item) for item in data["items"]]
        if isinstance(data, list):
            return [Case.model_validate(item) for item in data]
        return []

    async def get_case(self, case_id: str) -> Case:
        """Fetch single case by ID."""
        resp = await self._request("GET", f"{self._base_url}/api/v1/cases/{case_id}")
        return Case.model_validate(resp.json())

    async def export_case(
        self,
        case_id: str,
        format: str = "json",
    ) -> dict[str, Any] | str:
        """Export case data in requested format (e.g. json, csv, stix)."""
        resp = await self._request(
            "GET",
            f"{self._base_url}/api/v1/cases/{case_id}/export",
            params={"format": format},
        )
        content_type = resp.headers.get("Content-Type", "")
        if format.lower() == "json" or "application/json" in content_type:
            try:
                return resp.json()  # type: ignore[no-any-return]
            except Exception:
                pass
        return resp.text


class FabricClient:
    """Asynchronous client for CYBRIK Security Tool Fabric."""

    def __init__(self, base_url: str, requester: AsyncRequester) -> None:
        self._base_url = base_url.rstrip("/")
        self._request = requester

    async def get_health(self) -> dict[str, Any]:
        """Fetch health status of Tool Fabric service."""
        try:
            resp = await self._request("GET", f"{self._base_url}/health")
        except CybrikNotFoundError:
            resp = await self._request("GET", f"{self._base_url}/api/v1/health")
        return resp.json()  # type: ignore[no-any-return]

    async def list_capabilities(self) -> list[dict[str, Any]]:
        """List registered and authorized tool capabilities."""
        resp = await self._request("GET", f"{self._base_url}/api/v1/capabilities")
        data = resp.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "capabilities" in data:
            return data["capabilities"]  # type: ignore[no-any-return]
        if isinstance(data, dict) and "items" in data:
            return data["items"]  # type: ignore[no-any-return]
        return []

    async def execute_containment(
        self,
        action: str | ContainmentRequest,
        params: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> ContainmentReceipt:
        """Execute or dry-run a SOAR containment action, returning signed receipt."""
        if isinstance(action, ContainmentRequest):
            payload = action.model_dump()
        else:
            payload = {"action": action, "params": params or {}, **kwargs}

        resp = await self._request(
            "POST",
            f"{self._base_url}/api/v1/containment/execute",
            json=payload,
        )
        return ContainmentReceipt.model_validate(resp.json())


class AiClient:
    """Asynchronous client for CYBRIK Cyber AI Platform."""

    def __init__(self, base_url: str, requester: AsyncRequester) -> None:
        self._base_url = base_url.rstrip("/")
        self._request = requester

    async def get_health(self) -> dict[str, Any]:
        """Fetch health status of AI Platform service."""
        try:
            resp = await self._request("GET", f"{self._base_url}/health")
        except CybrikNotFoundError:
            resp = await self._request("GET", f"{self._base_url}/api/v1/health")
        return resp.json()  # type: ignore[no-any-return]

    async def run_benchmark(
        self,
        model: str | None = None,
        scenarios: list[str] | None = None,
        **kwargs: Any,
    ) -> BenchmarkReport:
        """Trigger local model quality and hardware performance benchmark."""
        payload: dict[str, Any] = {
            "model": model,
            "scenarios": scenarios or [],
            **kwargs,
        }
        resp = await self._request(
            "POST",
            f"{self._base_url}/api/v1/benchmarks/run",
            json=payload,
        )
        return BenchmarkReport.model_validate(resp.json())

    async def list_scenarios(self) -> list[dict[str, Any]]:
        """List available AI evaluation and benchmark scenarios."""
        resp = await self._request("GET", f"{self._base_url}/api/v1/scenarios")
        data = resp.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "scenarios" in data:
            return data["scenarios"]  # type: ignore[no-any-return]
        if isinstance(data, dict) and "items" in data:
            return data["items"]  # type: ignore[no-any-return]
        return []


# -----------------------------------------------------------------------------
# Asynchronous Main Client
# -----------------------------------------------------------------------------


class CybrikClient:
    """Unified asynchronous CYBRIK client SDK."""

    def __init__(
        self,
        config: CybrikConfig | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        http_client: httpx.AsyncClient | None = None,
        backoff_factor: float = 0.1,
        circuit_breaker: CircuitBreaker | None = None,
        enable_circuit_breaker: bool = True,
    ) -> None:
        self.config = config or CybrikConfig()
        self._backoff_factor = backoff_factor
        self._owns_client = http_client is None
        self._client = http_client or httpx.AsyncClient(
            transport=transport,
            timeout=self.config.timeout_seconds,
        )

        assert self.config.soc_url is not None
        assert self.config.fabric_url is not None
        assert self.config.ai_url is not None

        if circuit_breaker is not None:
            self.circuit_breaker: CircuitBreaker | None = circuit_breaker
        elif enable_circuit_breaker and getattr(self.config, "circuit_breaker_enabled", True):
            cb_config = (
                getattr(self.config, "circuit_breaker_config", None) or CircuitBreakerConfig()
            )
            self.circuit_breaker = CircuitBreaker(name="cybrik-client", config=cb_config)
        else:
            self.circuit_breaker = None

        self.soc = SocClient(self.config.soc_url, self._request)
        self.fabric = FabricClient(self.config.fabric_url, self._request)
        self.ai = AiClient(self.config.ai_url, self._request)

    async def arequest(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        """Execute async HTTP request with circuit breaker, authentication, and retries."""
        if self.circuit_breaker is not None and not self.circuit_breaker.can_execute():
            recovery_timeout = self.circuit_breaker.config.recovery_timeout_seconds
            elapsed = time.time() - self.circuit_breaker.last_failure_time
            remaining = max(0.0, recovery_timeout - elapsed)
            retry_after = remaining if remaining > 0 else recovery_timeout
            raise CircuitBreakerOpenError(
                service_name=self.circuit_breaker.name,
                recovery_timeout=recovery_timeout,
                retry_after=retry_after,
            )

        req_headers = _build_auth_headers(self.config)
        if headers:
            req_headers.update(headers)

        last_resp: httpx.Response | None = None
        max_attempts = self.config.max_retries

        for attempt in range(max_attempts + 1):
            try:
                resp = await self._client.request(
                    method=method,
                    url=url,
                    headers=req_headers,
                    **kwargs,
                )
            except (httpx.RequestError, TimeoutError, ConnectionError):
                if self.circuit_breaker is not None:
                    self.circuit_breaker.record_failure()
                raise

            last_resp = resp

            if resp.status_code in (429, 503):
                if attempt < max_attempts:
                    retry_after = _parse_retry_after(resp)
                    delay = (
                        retry_after
                        if retry_after is not None
                        else self._backoff_factor * (2**attempt)
                    )
                    await asyncio.sleep(delay)
                    continue

                # Retries exhausted
                if self.circuit_breaker is not None:
                    if resp.status_code in (502, 503, 504):
                        self.circuit_breaker.record_failure()
                    elif 200 <= resp.status_code < 500:
                        self.circuit_breaker.record_success()

                retry_after = _parse_retry_after(resp)
                if resp.status_code == 429:
                    raise CybrikRateLimitError(
                        f"Rate limit exceeded after {max_attempts} retries: {resp.text}",
                        status_code=429,
                        response_body=resp.text,
                        retry_after=retry_after,
                    )
                raise CybrikError(
                    f"Service unavailable after {max_attempts} retries: {resp.text}",
                    status_code=503,
                    response_body=resp.text,
                )

            if resp.is_error:
                if self.circuit_breaker is not None:
                    if resp.status_code in (502, 503, 504):
                        self.circuit_breaker.record_failure()
                    elif 200 <= resp.status_code < 500:
                        self.circuit_breaker.record_success()

                raise_for_status_code(
                    status_code=resp.status_code,
                    message=f"Request failed with status {resp.status_code}: {resp.text}",
                    response_body=resp.text,
                )

            if self.circuit_breaker is not None:
                self.circuit_breaker.record_success()

            return resp

        assert last_resp is not None
        return last_resp

    async def request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        """Alias for arequest."""
        return await self.arequest(method, url, headers=headers, **kwargs)

    async def _request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        return await self.arequest(method, url, headers=headers, **kwargs)

    async def get_health(self) -> dict[str, Any]:
        """Aggregate health check across SOC, Fabric, and AI services."""
        results: list[Any] = list(
            await asyncio.gather(
                self.soc.get_health(),
                self.fabric.get_health(),
                self.ai.get_health(),
                return_exceptions=True,
            )
        )
        soc_res, fabric_res, ai_res = results[0], results[1], results[2]
        return {
            "soc": (
                soc_res
                if not isinstance(soc_res, Exception)
                else {"status": "error", "error": str(soc_res)}
            ),
            "fabric": (
                fabric_res
                if not isinstance(fabric_res, Exception)
                else {"status": "error", "error": str(fabric_res)}
            ),
            "ai": (
                ai_res
                if not isinstance(ai_res, Exception)
                else {"status": "error", "error": str(ai_res)}
            ),
        }

    async def close(self) -> None:
        """Close client and release underlying connections."""
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> CybrikClient:
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()


AsyncCybrikClient = CybrikClient


# -----------------------------------------------------------------------------
# Synchronous Sub-clients
# -----------------------------------------------------------------------------


class SyncSocClient:
    """Synchronous client for CYBRIK SOC Command Center."""

    def __init__(self, base_url: str, requester: SyncRequester) -> None:
        self._base_url = base_url.rstrip("/")
        self._request = requester

    def get_health(self) -> dict[str, Any]:
        """Fetch health status of SOC service."""
        try:
            resp = self._request("GET", f"{self._base_url}/health")
        except CybrikNotFoundError:
            resp = self._request("GET", f"{self._base_url}/api/v1/health")
        return resp.json()  # type: ignore[no-any-return]

    def list_cases(
        self,
        status: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> list[Case]:
        """List cases with optional status filter and pagination."""
        params: dict[str, Any] = {"page": page, "page_size": page_size}
        if status:
            params["status"] = status
        resp = self._request("GET", f"{self._base_url}/api/v1/cases", params=params)
        data = resp.json()
        if isinstance(data, dict) and "items" in data:
            return [Case.model_validate(item) for item in data["items"]]
        if isinstance(data, list):
            return [Case.model_validate(item) for item in data]
        return []

    def get_case(self, case_id: str) -> Case:
        """Fetch single case by ID."""
        resp = self._request("GET", f"{self._base_url}/api/v1/cases/{case_id}")
        return Case.model_validate(resp.json())

    def export_case(
        self,
        case_id: str,
        format: str = "json",
    ) -> dict[str, Any] | str:
        """Export case data in requested format (e.g. json, csv, stix)."""
        resp = self._request(
            "GET",
            f"{self._base_url}/api/v1/cases/{case_id}/export",
            params={"format": format},
        )
        content_type = resp.headers.get("Content-Type", "")
        if format.lower() == "json" or "application/json" in content_type:
            try:
                return resp.json()  # type: ignore[no-any-return]
            except Exception:
                pass
        return resp.text


class SyncFabricClient:
    """Synchronous client for CYBRIK Security Tool Fabric."""

    def __init__(self, base_url: str, requester: SyncRequester) -> None:
        self._base_url = base_url.rstrip("/")
        self._request = requester

    def get_health(self) -> dict[str, Any]:
        """Fetch health status of Tool Fabric service."""
        try:
            resp = self._request("GET", f"{self._base_url}/health")
        except CybrikNotFoundError:
            resp = self._request("GET", f"{self._base_url}/api/v1/health")
        return resp.json()  # type: ignore[no-any-return]

    def list_capabilities(self) -> list[dict[str, Any]]:
        """List registered and authorized tool capabilities."""
        resp = self._request("GET", f"{self._base_url}/api/v1/capabilities")
        data = resp.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "capabilities" in data:
            return data["capabilities"]  # type: ignore[no-any-return]
        if isinstance(data, dict) and "items" in data:
            return data["items"]  # type: ignore[no-any-return]
        return []

    def execute_containment(
        self,
        action: str | ContainmentRequest,
        params: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> ContainmentReceipt:
        """Execute or dry-run a SOAR containment action, returning signed receipt."""
        if isinstance(action, ContainmentRequest):
            payload = action.model_dump()
        else:
            payload = {"action": action, "params": params or {}, **kwargs}

        resp = self._request(
            "POST",
            f"{self._base_url}/api/v1/containment/execute",
            json=payload,
        )
        return ContainmentReceipt.model_validate(resp.json())


class SyncAiClient:
    """Synchronous client for CYBRIK Cyber AI Platform."""

    def __init__(self, base_url: str, requester: SyncRequester) -> None:
        self._base_url = base_url.rstrip("/")
        self._request = requester

    def get_health(self) -> dict[str, Any]:
        """Fetch health status of AI Platform service."""
        try:
            resp = self._request("GET", f"{self._base_url}/health")
        except CybrikNotFoundError:
            resp = self._request("GET", f"{self._base_url}/api/v1/health")
        return resp.json()  # type: ignore[no-any-return]

    def run_benchmark(
        self,
        model: str | None = None,
        scenarios: list[str] | None = None,
        **kwargs: Any,
    ) -> BenchmarkReport:
        """Trigger local model quality and hardware performance benchmark."""
        payload: dict[str, Any] = {
            "model": model,
            "scenarios": scenarios or [],
            **kwargs,
        }
        resp = self._request(
            "POST",
            f"{self._base_url}/api/v1/benchmarks/run",
            json=payload,
        )
        return BenchmarkReport.model_validate(resp.json())

    def list_scenarios(self) -> list[dict[str, Any]]:
        """List available AI evaluation and benchmark scenarios."""
        resp = self._request("GET", f"{self._base_url}/api/v1/scenarios")
        data = resp.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "scenarios" in data:
            return data["scenarios"]  # type: ignore[no-any-return]
        if isinstance(data, dict) and "items" in data:
            return data["items"]  # type: ignore[no-any-return]
        return []


# -----------------------------------------------------------------------------
# Synchronous Main Client
# -----------------------------------------------------------------------------


class SyncCybrikClient:
    """Unified synchronous CYBRIK client SDK using httpx.Client."""

    def __init__(
        self,
        config: CybrikConfig | None = None,
        *,
        transport: httpx.BaseTransport | None = None,
        http_client: httpx.Client | None = None,
        backoff_factor: float = 0.1,
        circuit_breaker: CircuitBreaker | None = None,
        enable_circuit_breaker: bool = True,
    ) -> None:
        self.config = config or CybrikConfig()
        self._backoff_factor = backoff_factor
        self._owns_client = http_client is None
        self._client = http_client or httpx.Client(
            transport=transport,
            timeout=self.config.timeout_seconds,
        )

        assert self.config.soc_url is not None
        assert self.config.fabric_url is not None
        assert self.config.ai_url is not None

        if circuit_breaker is not None:
            self.circuit_breaker: CircuitBreaker | None = circuit_breaker
        elif enable_circuit_breaker and getattr(self.config, "circuit_breaker_enabled", True):
            cb_config = (
                getattr(self.config, "circuit_breaker_config", None) or CircuitBreakerConfig()
            )
            self.circuit_breaker = CircuitBreaker(name="sync-cybrik-client", config=cb_config)
        else:
            self.circuit_breaker = None

        self.soc = SyncSocClient(self.config.soc_url, self._request)
        self.fabric = SyncFabricClient(self.config.fabric_url, self._request)
        self.ai = SyncAiClient(self.config.ai_url, self._request)

    def request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        """Execute sync HTTP request with circuit breaker, authentication, and retries."""
        if self.circuit_breaker is not None and not self.circuit_breaker.can_execute():
            recovery_timeout = self.circuit_breaker.config.recovery_timeout_seconds
            elapsed = time.time() - self.circuit_breaker.last_failure_time
            remaining = max(0.0, recovery_timeout - elapsed)
            retry_after = remaining if remaining > 0 else recovery_timeout
            raise CircuitBreakerOpenError(
                service_name=self.circuit_breaker.name,
                recovery_timeout=recovery_timeout,
                retry_after=retry_after,
            )

        req_headers = _build_auth_headers(self.config)
        if headers:
            req_headers.update(headers)

        last_resp: httpx.Response | None = None
        max_attempts = self.config.max_retries

        for attempt in range(max_attempts + 1):
            try:
                resp = self._client.request(
                    method=method,
                    url=url,
                    headers=req_headers,
                    **kwargs,
                )
            except (httpx.RequestError, TimeoutError, ConnectionError):
                if self.circuit_breaker is not None:
                    self.circuit_breaker.record_failure()
                raise

            last_resp = resp

            if resp.status_code in (429, 503):
                if attempt < max_attempts:
                    retry_after = _parse_retry_after(resp)
                    delay = (
                        retry_after
                        if retry_after is not None
                        else self._backoff_factor * (2**attempt)
                    )
                    time.sleep(delay)
                    continue

                # Retries exhausted
                if self.circuit_breaker is not None:
                    if resp.status_code in (502, 503, 504):
                        self.circuit_breaker.record_failure()
                    elif 200 <= resp.status_code < 500:
                        self.circuit_breaker.record_success()

                retry_after = _parse_retry_after(resp)
                if resp.status_code == 429:
                    raise CybrikRateLimitError(
                        f"Rate limit exceeded after {max_attempts} retries: {resp.text}",
                        status_code=429,
                        response_body=resp.text,
                        retry_after=retry_after,
                    )
                raise CybrikError(
                    f"Service unavailable after {max_attempts} retries: {resp.text}",
                    status_code=503,
                    response_body=resp.text,
                )

            if resp.is_error:
                if self.circuit_breaker is not None:
                    if resp.status_code in (502, 503, 504):
                        self.circuit_breaker.record_failure()
                    elif 200 <= resp.status_code < 500:
                        self.circuit_breaker.record_success()

                raise_for_status_code(
                    status_code=resp.status_code,
                    message=f"Request failed with status {resp.status_code}: {resp.text}",
                    response_body=resp.text,
                )

            if self.circuit_breaker is not None:
                self.circuit_breaker.record_success()

            return resp

        assert last_resp is not None
        return last_resp

    def _request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        return self.request(method, url, headers=headers, **kwargs)

    def get_health(self) -> dict[str, Any]:
        """Aggregate health check across SOC, Fabric, and AI services."""
        try:
            soc_health = self.soc.get_health()
        except Exception as e:
            soc_health = {"status": "error", "error": str(e)}

        try:
            fabric_health = self.fabric.get_health()
        except Exception as e:
            fabric_health = {"status": "error", "error": str(e)}

        try:
            ai_health = self.ai.get_health()
        except Exception as e:
            ai_health = {"status": "error", "error": str(e)}

        return {
            "soc": soc_health,
            "fabric": fabric_health,
            "ai": ai_health,
        }

    def close(self) -> None:
        """Close client and release underlying connections."""
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> SyncCybrikClient:
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.close()
