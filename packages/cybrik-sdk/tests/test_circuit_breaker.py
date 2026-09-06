"""Comprehensive test suite for Circuit Breaker and resilience policy integration.

Covers:
- Basic state transitions: starts CLOSED.
- Transitions to OPEN after failure_threshold consecutive failures.
- can_execute() returns False when OPEN and client raises CircuitBreakerOpenError.
- Transition to HALF_OPEN after recovery_timeout_seconds elapses.
- HALF_OPEN transitions back to CLOSED after consecutive_successes_to_close successes.
- HALF_OPEN trips immediately back to OPEN on single failure.
- reset() manually restores CLOSED state.
- Integration with CybrikClient, AsyncCybrikClient, and SyncCybrikClient.
- End-to-end fast-fail and dynamic recovery through mock transports.
"""

from __future__ import annotations

import httpx
import pytest

from cybrik_sdk import (
    AsyncCybrikClient,
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitBreakerOpenError,
    CircuitState,
    CybrikClient,
    CybrikConfig,
    CybrikError,
    CybrikSDKError,
    SyncCybrikClient,
)


class MockClock:
    """Controllable simulated clock for deterministic time-based testing."""

    def __init__(self, start_time: float = 1000.0) -> None:
        self.current_time = start_time

    def time(self) -> float:
        return self.current_time

    def advance(self, seconds: float) -> None:
        self.current_time += seconds


def test_circuit_breaker_starts_closed() -> None:
    """Verify circuit breaker initializes in CLOSED state with zeroed counters."""
    config = CircuitBreakerConfig(failure_threshold=5, recovery_timeout_seconds=30.0)
    cb = CircuitBreaker(name="test-service", config=config)

    assert cb.name == "test-service"
    assert cb.state == CircuitState.CLOSED
    assert cb.state == "closed"
    assert cb.failure_count == 0
    assert cb.success_count == 0
    assert cb.half_open_in_flight == 0
    assert cb.can_execute() is True

    stats = cb.get_stats()
    assert stats["name"] == "test-service"
    assert stats["state"] == "closed"
    assert stats["failure_count"] == 0
    assert stats["success_count"] == 0
    assert stats["config"]["failure_threshold"] == 5
    assert stats["config"]["recovery_timeout_seconds"] == 30.0


def test_transitions_to_open_after_failure_threshold() -> None:
    """Verify circuit breaker transitions to OPEN after failure_threshold consecutive failures."""
    clock = MockClock(100.0)
    config = CircuitBreakerConfig(failure_threshold=3, recovery_timeout_seconds=20.0)
    cb = CircuitBreaker(name="test-service", config=config, clock=clock.time)

    # 1st failure
    cb.record_failure()
    assert cb.state == CircuitState.CLOSED
    assert cb.failure_count == 1
    assert cb.can_execute() is True

    # 2nd failure
    cb.record_failure()
    assert cb.state == CircuitState.CLOSED
    assert cb.failure_count == 2
    assert cb.can_execute() is True

    # 3rd failure reaches threshold
    clock.advance(1.0)
    cb.record_failure()
    assert cb.state == CircuitState.OPEN
    assert cb.state == "open"
    assert cb.failure_count == 3
    assert cb.last_failure_time == 101.0
    assert cb.can_execute() is False


def test_can_execute_false_when_open() -> None:
    """Verify can_execute() returns False while OPEN before recovery timeout."""
    clock = MockClock(100.0)
    config = CircuitBreakerConfig(failure_threshold=2, recovery_timeout_seconds=30.0)
    cb = CircuitBreaker(name="test-service", config=config, clock=clock.time)

    cb.record_failure()
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    # 10s later (still before 30s recovery timeout)
    clock.advance(10.0)
    assert cb.can_execute() is False

    # 29.9s later
    clock.advance(19.9)
    assert cb.can_execute() is False


def test_transition_to_half_open_after_recovery_timeout() -> None:
    """Verify circuit breaker transitions to HALF_OPEN once recovery timeout elapses."""
    clock = MockClock(100.0)
    config = CircuitBreakerConfig(
        failure_threshold=2,
        recovery_timeout_seconds=30.0,
        half_open_max_calls=2,
    )
    cb = CircuitBreaker(name="test-service", config=config, clock=clock.time)

    cb.record_failure()
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    # Advance past recovery timeout
    clock.advance(30.1)

    # First call transitions to HALF_OPEN and is allowed
    assert cb.can_execute() is True
    assert cb.state == CircuitState.HALF_OPEN
    assert cb.state == "half_open"
    assert cb.half_open_in_flight == 1

    # Second call is also within half_open_max_calls (2)
    assert cb.can_execute() is True
    assert cb.half_open_in_flight == 2

    # Third concurrent call exceeds half_open_max_calls
    assert cb.can_execute() is False


def test_half_open_transitions_to_closed_after_consecutive_successes() -> None:
    """Verify HALF_OPEN resets to CLOSED after consecutive_successes_to_close successes."""
    clock = MockClock(100.0)
    config = CircuitBreakerConfig(
        failure_threshold=1,
        recovery_timeout_seconds=10.0,
        consecutive_successes_to_close=2,
    )
    cb = CircuitBreaker(name="test-service", config=config, clock=clock.time)

    # Trip to OPEN
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    # Elapse recovery
    clock.advance(15.0)
    assert cb.can_execute() is True
    assert cb.state == CircuitState.HALF_OPEN

    # First success
    cb.record_success()
    assert cb.state == CircuitState.HALF_OPEN
    assert cb.success_count == 1

    # Second success closes circuit
    cb.record_success()
    assert cb.state == CircuitState.CLOSED
    assert cb.state == "closed"
    assert cb.failure_count == 0
    assert cb.success_count == 0
    assert cb.can_execute() is True


def test_half_open_trips_immediately_to_open_on_single_failure() -> None:
    """Verify single failure during HALF_OPEN immediately trips back to OPEN."""
    clock = MockClock(100.0)
    config = CircuitBreakerConfig(failure_threshold=3, recovery_timeout_seconds=10.0)
    cb = CircuitBreaker(name="test-service", config=config, clock=clock.time)

    # Trip to OPEN
    cb.record_failure()
    cb.record_failure()
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    # Advance past recovery
    clock.advance(11.0)
    assert cb.can_execute() is True
    assert cb.state == CircuitState.HALF_OPEN

    # A single probe failure immediately opens circuit again
    cb.record_failure()
    assert cb.state == CircuitState.OPEN
    assert cb.can_execute() is False


def test_reset_restores_closed_state() -> None:
    """Verify reset() restores CLOSED state regardless of prior failures."""
    clock = MockClock(100.0)
    config = CircuitBreakerConfig(failure_threshold=2, recovery_timeout_seconds=60.0)
    cb = CircuitBreaker(name="test-service", config=config, clock=clock.time)

    cb.record_failure()
    cb.record_failure()
    assert cb.state == CircuitState.OPEN
    assert cb.can_execute() is False

    cb.reset()
    assert cb.state == CircuitState.CLOSED
    assert cb.failure_count == 0
    assert cb.success_count == 0
    assert cb.half_open_in_flight == 0
    assert cb.can_execute() is True


def test_circuit_breaker_open_error_attributes() -> None:
    """Verify CircuitBreakerOpenError carries service_name, recovery_timeout, retry_after."""
    err = CircuitBreakerOpenError(
        service_name="soc-service",
        recovery_timeout=30.0,
        retry_after=15.5,
    )
    assert err.service_name == "soc-service"
    assert err.recovery_timeout == 30.0
    assert err.retry_after == 15.5
    assert err.status_code == 503
    assert "soc-service" in str(err)
    assert isinstance(err, CybrikSDKError)
    assert isinstance(err, CybrikError)


def test_config_validation() -> None:
    """Verify CircuitBreakerConfig validates boundary constraints."""
    with pytest.raises(ValueError, match="failure_threshold"):
        CircuitBreakerConfig(failure_threshold=0)
    with pytest.raises(ValueError, match="failure_threshold"):
        CircuitBreakerConfig(failure_threshold=101)

    with pytest.raises(ValueError, match="recovery_timeout_seconds"):
        CircuitBreakerConfig(recovery_timeout_seconds=0.5)
    with pytest.raises(ValueError, match="recovery_timeout_seconds"):
        CircuitBreakerConfig(recovery_timeout_seconds=601.0)

    with pytest.raises(ValueError, match="half_open_max_calls"):
        CircuitBreakerConfig(half_open_max_calls=0)
    with pytest.raises(ValueError, match="half_open_max_calls"):
        CircuitBreakerConfig(half_open_max_calls=25)

    with pytest.raises(ValueError, match="consecutive_successes_to_close"):
        CircuitBreakerConfig(consecutive_successes_to_close=0)
    with pytest.raises(ValueError, match="consecutive_successes_to_close"):
        CircuitBreakerConfig(consecutive_successes_to_close=25)


@pytest.mark.asyncio
async def test_integration_cybrik_client_blocks_requests_when_open() -> None:
    """Verify CybrikClient raises CircuitBreakerOpenError and blocks downstream HTTP requests."""
    network_calls = 0

    def outage_router(request: httpx.Request) -> httpx.Response:
        nonlocal network_calls
        network_calls += 1
        return httpx.Response(503, text="Service Unavailable")

    cb_config = CircuitBreakerConfig(
        failure_threshold=2,
        recovery_timeout_seconds=60.0,
    )
    cb = CircuitBreaker(name="test-soc", config=cb_config)
    config = CybrikConfig(base_url="http://test.local", max_retries=0)
    transport = httpx.MockTransport(outage_router)

    async with CybrikClient(
        config,
        transport=transport,
        circuit_breaker=cb,
    ) as client:
        assert client.circuit_breaker is cb
        assert cb.state == CircuitState.CLOSED

        # 1st request fails with 503
        with pytest.raises(CybrikError) as exc_info1:
            await client.soc.get_health()
        assert exc_info1.value.status_code == 503
        assert cb.failure_count == 1
        assert network_calls == 1

        # 2nd request fails with 503 -> trips circuit to OPEN
        with pytest.raises(CybrikError) as exc_info2:
            await client.soc.get_health()
        assert exc_info2.value.status_code == 503
        assert cb.state == CircuitState.OPEN
        assert network_calls == 2

        # 3rd request MUST be fast-failed by circuit breaker without making an HTTP request!
        with pytest.raises(CircuitBreakerOpenError) as exc_info3:
            await client.soc.get_health()

        err = exc_info3.value
        assert err.service_name == "test-soc"
        assert err.recovery_timeout == 60.0
        assert err.retry_after <= 60.0
        # Crucial check: network calls did NOT increment
        assert network_calls == 2


@pytest.mark.asyncio
async def test_integration_async_cybrik_client_alias() -> None:
    """Verify AsyncCybrikClient alias works identically to CybrikClient."""
    assert AsyncCybrikClient is CybrikClient

    cb = CircuitBreaker(name="async-alias-cb", config=CircuitBreakerConfig(failure_threshold=1))
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    config = CybrikConfig(base_url="http://test.local", max_retries=0)
    transport = httpx.MockTransport(lambda req: httpx.Response(200, json={"ok": True}))

    async with AsyncCybrikClient(config, transport=transport, circuit_breaker=cb) as client:
        assert client.circuit_breaker is cb
        with pytest.raises(CircuitBreakerOpenError) as exc_info:
            await client.request("GET", "http://test.local/health")
        assert exc_info.value.service_name == "async-alias-cb"


def test_integration_sync_cybrik_client_blocks_requests_when_open() -> None:
    """Verify SyncCybrikClient raises CircuitBreakerOpenError and blocks HTTP requests."""
    network_calls = 0

    def outage_router(request: httpx.Request) -> httpx.Response:
        nonlocal network_calls
        network_calls += 1
        return httpx.Response(503, text="Service Unavailable")

    cb_config = CircuitBreakerConfig(
        failure_threshold=2,
        recovery_timeout_seconds=60.0,
    )
    cb = CircuitBreaker(name="test-sync", config=cb_config)
    config = CybrikConfig(base_url="http://test.local", max_retries=0)
    transport = httpx.MockTransport(outage_router)

    with SyncCybrikClient(
        config,
        transport=transport,
        circuit_breaker=cb,
    ) as client:
        assert client.circuit_breaker is cb
        assert cb.state == CircuitState.CLOSED

        # 1st request fails
        with pytest.raises(CybrikError):
            client.soc.get_health()
        assert cb.failure_count == 1
        assert network_calls == 1

        # 2nd request fails -> trips circuit
        with pytest.raises(CybrikError):
            client.soc.get_health()
        assert cb.state == CircuitState.OPEN
        assert network_calls == 2

        # 3rd request blocked by open circuit breaker
        with pytest.raises(CircuitBreakerOpenError) as exc_info:
            client.soc.get_health()

        err = exc_info.value
        assert err.service_name == "test-sync"
        assert network_calls == 2


@pytest.mark.asyncio
async def test_integration_client_recovers_after_outage() -> None:
    """Verify full end-to-end circuit trip, cooldown, HALF_OPEN probe, and CLOSED recovery."""
    clock = MockClock(200.0)
    server_healthy = False
    requests_handled = 0

    def dynamic_service_router(request: httpx.Request) -> httpx.Response:
        nonlocal requests_handled
        requests_handled += 1
        if not server_healthy:
            return httpx.Response(503, text="Under maintenance")
        return httpx.Response(200, json={"status": "healthy", "service": "cybrik-soc"})

    cb_config = CircuitBreakerConfig(
        failure_threshold=2,
        recovery_timeout_seconds=10.0,
        consecutive_successes_to_close=2,
    )
    cb = CircuitBreaker(name="dynamic-soc", config=cb_config, clock=clock.time)
    config = CybrikConfig(base_url="http://test.local", max_retries=0)
    transport = httpx.MockTransport(dynamic_service_router)

    async with CybrikClient(config, transport=transport, circuit_breaker=cb) as client:
        # Phase 1: 2 consecutive failures trip circuit to OPEN
        with pytest.raises(CybrikError):
            await client.soc.get_health()
        with pytest.raises(CybrikError):
            await client.soc.get_health()
        assert cb.state == CircuitState.OPEN
        assert requests_handled == 2

        # Phase 2: Call during OPEN before cooldown is rejected
        with pytest.raises(CircuitBreakerOpenError):
            await client.soc.get_health()
        assert requests_handled == 2

        # Phase 3: Server recovers and recovery cooldown passes
        server_healthy = True
        clock.advance(11.0)

        # Phase 4: Probe call 1 succeeds, transitions to HALF_OPEN
        resp1 = await client.soc.get_health()
        assert resp1["status"] == "healthy"
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.success_count == 1
        assert requests_handled == 3

        # Phase 5: Probe call 2 succeeds, transitions back to CLOSED
        resp2 = await client.soc.get_health()
        assert resp2["status"] == "healthy"
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0
        assert requests_handled == 4
