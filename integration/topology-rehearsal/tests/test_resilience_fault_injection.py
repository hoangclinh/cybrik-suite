"""Fault-injection qualification harness and resilience policy contract tests.

Validates:
1. contracts/json-schema/cybrik.resilience-policy.v1.schema.json strictly conforms
   to JSON Schema Draft 2020-12 and validates payload boundaries.
2. Fault injection scenarios simulating downstream service 503 outage,
   dynamic circuit breaker trip, fast-fail shedding, cooldown, probe recovery,
   and failed probe re-trip behind in-memory injected fakes (zero socket I/O).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest
from cybrik_sdk import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitBreakerOpenError,
    CircuitState,
    CybrikConfig,
    CybrikError,
    ResiliencePolicy,
    SyncCybrikClient,
)
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
SCHEMA_PATH = REPO_ROOT / "contracts" / "json-schema" / "cybrik.resilience-policy.v1.schema.json"


# -----------------------------------------------------------------------------
# Part 1: Schema Draft 2020-12 Validation
# -----------------------------------------------------------------------------


def load_resilience_schema() -> dict[str, Any]:
    """Load and parse cybrik.resilience-policy.v1.schema.json."""
    assert SCHEMA_PATH.exists(), f"Resilience schema not found at {SCHEMA_PATH}"
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        schema: dict[str, Any] = json.load(f)
    return schema


def test_resilience_policy_schema_conforms_to_draft_2020_12() -> None:
    """Validate that resilience policy schema conforms to Draft 2020-12 meta-schema."""
    schema = load_resilience_schema()

    # Meta-schema check
    Draft202012Validator.check_schema(schema)

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["$id"] == (
        "https://schema.cybrik.dev/contracts/json-schema/cybrik.resilience-policy.v1.schema.json"
    )
    assert schema["title"] == "CYBRIK Resilience Policy Contract Schema"
    assert schema["x-cybrik-status"] == "ACCEPTED FOR IMPLEMENTATION"
    assert schema["type"] == "object"
    assert schema["additionalProperties"] is False


def test_resilience_policy_schema_valid_instances() -> None:
    """Verify minimal and complete valid resilience policy instances pass schema validation."""
    schema = load_resilience_schema()
    validator = Draft202012Validator(schema)

    # Minimal valid payload (required fields only)
    minimal_payload = {
        "max_retries": 3,
        "initial_backoff_seconds": 0.5,
        "max_backoff_seconds": 30.0,
        "circuit_breaker": {
            "failure_threshold": 5,
            "recovery_timeout_seconds": 30.0,
        },
    }
    validator.validate(minimal_payload)

    # Complete valid payload (all fields)
    complete_payload = {
        "max_retries": 5,
        "initial_backoff_seconds": 1.0,
        "max_backoff_seconds": 60.0,
        "backoff_multiplier": 2.5,
        "jitter": True,
        "circuit_breaker": {
            "failure_threshold": 10,
            "recovery_timeout_seconds": 45.0,
            "half_open_max_calls": 5,
            "consecutive_successes_to_close": 3,
        },
        "retryable_status_codes": [429, 502, 503, 504],
        "retryable_exceptions": ["TimeoutError", "ConnectionError", "ServiceUnavailableError"],
    }
    validator.validate(complete_payload)


def test_resilience_policy_schema_rejects_invalid_instances() -> None:
    """Verify schema rejects missing required fields and out-of-boundary values."""
    schema = load_resilience_schema()
    validator = Draft202012Validator(schema)

    # Missing required circuit_breaker
    with pytest.raises(ValidationError, match="'circuit_breaker' is a required property"):
        validator.validate({
            "max_retries": 3,
            "initial_backoff_seconds": 0.5,
            "max_backoff_seconds": 30.0,
        })

    # max_retries > 10
    with pytest.raises(ValidationError, match="11 is greater than the maximum of 10"):
        validator.validate({
            "max_retries": 11,
            "initial_backoff_seconds": 0.5,
            "max_backoff_seconds": 30.0,
            "circuit_breaker": {"failure_threshold": 5, "recovery_timeout_seconds": 30.0},
        })

    # initial_backoff_seconds < 0.01
    with pytest.raises(ValidationError, match="is less than the minimum of 0.01"):
        validator.validate({
            "max_retries": 3,
            "initial_backoff_seconds": 0.005,
            "max_backoff_seconds": 30.0,
            "circuit_breaker": {"failure_threshold": 5, "recovery_timeout_seconds": 30.0},
        })

    # failure_threshold < 1
    with pytest.raises(ValidationError, match="0 is less than the minimum of 1"):
        validator.validate({
            "max_retries": 3,
            "initial_backoff_seconds": 0.5,
            "max_backoff_seconds": 30.0,
            "circuit_breaker": {"failure_threshold": 0, "recovery_timeout_seconds": 30.0},
        })

    # Disallowed additional property
    with pytest.raises(ValidationError, match="Additional properties are not allowed"):
        validator.validate({
            "max_retries": 3,
            "initial_backoff_seconds": 0.5,
            "max_backoff_seconds": 30.0,
            "circuit_breaker": {"failure_threshold": 5, "recovery_timeout_seconds": 30.0},
            "unauthorized_field": "disallowed",
        })


def test_resilience_policy_dataclass_parity() -> None:
    """Verify ResiliencePolicy and CircuitBreakerConfig dataclasses match schema defaults."""
    policy = ResiliencePolicy()
    assert policy.max_retries == 3
    assert policy.initial_backoff_seconds == 0.5
    assert policy.max_backoff_seconds == 30.0
    assert policy.backoff_multiplier == 2.0
    assert policy.jitter is True
    assert policy.retryable_status_codes == [429, 502, 503, 504]
    assert policy.retryable_exceptions == [
        "TimeoutError",
        "ConnectionError",
        "ServiceUnavailableError",
    ]

    cb_cfg = policy.circuit_breaker
    assert cb_cfg.failure_threshold == 5
    assert cb_cfg.recovery_timeout_seconds == 30.0
    assert cb_cfg.half_open_max_calls == 3
    assert cb_cfg.consecutive_successes_to_close == 2


# -----------------------------------------------------------------------------
# Part 2: Fault-Injection Qualification Harness (In-Memory Mock Transport)
# -----------------------------------------------------------------------------


class SimulatedClock:
    """Controllable clock for qualification timing."""

    def __init__(self, start_time: float = 10_000.0) -> None:
        self.time_seconds = start_time

    def now(self) -> float:
        return self.time_seconds

    def advance(self, delta: float) -> None:
        self.time_seconds += delta


class DownstreamServiceSimulator:
    """In-memory mock downstream server with dynamic fault injection capabilities."""

    def __init__(self, service_name: str = "cybrik-soc") -> None:
        self.service_name = service_name
        self.injected_status: int | None = None
        self.injected_exception: Exception | None = None
        self.total_requests_received: int = 0

    def inject_http_status(self, status_code: int | None) -> None:
        """Inject HTTP response status code (e.g. 503, 502, 504) or clear fault."""
        self.injected_status = status_code
        self.injected_exception = None

    def inject_network_failure(self, exc: Exception | None) -> None:
        """Inject transport/network level exception (e.g. ConnectError) or clear fault."""
        self.injected_exception = exc
        self.injected_status = None

    def clear_faults(self) -> None:
        """Clear all active faults, restoring normal 200 OK operation."""
        self.injected_status = None
        self.injected_exception = None

    def handler(self, request: httpx.Request) -> httpx.Response:
        """Process incoming HTTP request under current fault condition without real sockets."""
        self.total_requests_received += 1

        if self.injected_exception is not None:
            raise self.injected_exception

        if self.injected_status is not None:
            return httpx.Response(
                self.injected_status,
                text=f"Simulated fault: HTTP {self.injected_status}",
            )

        return httpx.Response(
            200,
            json={
                "status": "healthy",
                "service": self.service_name,
                "request_count": self.total_requests_received,
            },
        )


def test_fault_injection_503_outage_dynamic_trip_and_recovery() -> None:
    """Scenario 1: Downstream 503 outage qualification.

    Verifies:
    1. Baseline traffic succeeds with circuit CLOSED.
    2. Fault injected (HTTP 503 outage): failures accumulate until failure_threshold.
    3. Circuit breaker trips to OPEN; subsequent requests fast-fail with CircuitBreakerOpenError.
    4. Downstream egress load drops to 0 (no packets reach downstream during OPEN).
    5. Downstream recovers, cooldown elapses, trial calls transition to HALF_OPEN.
    6. Consecutive successes close circuit, restoring full throughput.
    """
    clock = SimulatedClock()
    simulator = DownstreamServiceSimulator("cybrik-soc")
    transport = httpx.MockTransport(simulator.handler)

    cb_config = CircuitBreakerConfig(
        failure_threshold=3,
        recovery_timeout_seconds=20.0,
        half_open_max_calls=2,
        consecutive_successes_to_close=2,
    )
    circuit = CircuitBreaker(name="soc-breaker", config=cb_config, clock=clock.now)
    config = CybrikConfig(base_url="http://soc.local", max_retries=0)

    with SyncCybrikClient(config, transport=transport, circuit_breaker=circuit) as client:
        # Phase 1: Baseline healthy execution
        health = client.soc.get_health()
        assert health["status"] == "healthy"
        assert circuit.state == CircuitState.CLOSED
        assert simulator.total_requests_received == 1

        # Phase 2: Inject downstream 503 outage
        simulator.inject_http_status(503)

        # 1st failure
        with pytest.raises(CybrikError) as exc_info:
            client.soc.get_health()
        assert exc_info.value.status_code == 503
        assert circuit.failure_count == 1
        assert circuit.state == CircuitState.CLOSED
        assert simulator.total_requests_received == 2

        # 2nd failure
        with pytest.raises(CybrikError):
            client.soc.get_health()
        assert circuit.failure_count == 2
        assert circuit.state == CircuitState.CLOSED
        assert simulator.total_requests_received == 3

        # 3rd failure trips the circuit to OPEN
        with pytest.raises(CybrikError):
            client.soc.get_health()
        assert circuit.state == CircuitState.OPEN
        assert circuit.failure_count == 3
        assert simulator.total_requests_received == 4

        # Phase 3: Fast-fail qualification (traffic shedded at client)
        for _ in range(5):
            with pytest.raises(CircuitBreakerOpenError) as open_err:
                client.soc.get_health()
            assert open_err.value.service_name == "soc-breaker"
            assert open_err.value.recovery_timeout == 20.0

        # ZERO requests reached the simulator during OPEN state
        assert simulator.total_requests_received == 4

        # Phase 4: Downstream recovers, but cooldown has not passed yet
        simulator.clear_faults()
        clock.advance(10.0)  # Only 10s of 20s recovery timeout
        with pytest.raises(CircuitBreakerOpenError):
            client.soc.get_health()
        assert simulator.total_requests_received == 4  # Still blocked

        # Phase 5: Cooldown elapses (advance past 20.0s)
        clock.advance(11.0)  # Total 21.0s elapsed

        # 1st trial call succeeds -> transitions to HALF_OPEN
        resp_probe1 = client.soc.get_health()
        assert resp_probe1["status"] == "healthy"
        assert circuit.state == CircuitState.HALF_OPEN
        assert circuit.success_count == 1
        assert simulator.total_requests_received == 5

        # 2nd trial call succeeds -> consecutive_successes reached -> CLOSED
        resp_probe2 = client.soc.get_health()
        assert resp_probe2["status"] == "healthy"
        assert circuit.state == CircuitState.CLOSED
        assert circuit.failure_count == 0
        assert circuit.success_count == 0
        assert simulator.total_requests_received == 6

        # Normal traffic continues unobstructed
        normal_resp = client.soc.get_health()
        assert normal_resp["status"] == "healthy"
        assert simulator.total_requests_received == 7


def test_fault_injection_half_open_failure_re_trips_open() -> None:
    """Scenario 2: Failed probe during HALF_OPEN immediately re-trips OPEN.

    Verifies that if downstream is still failing when probing resumes,
    a single failure immediately trips circuit back to OPEN.
    """
    clock = SimulatedClock()
    simulator = DownstreamServiceSimulator("cybrik-ai")
    transport = httpx.MockTransport(simulator.handler)

    cb_config = CircuitBreakerConfig(
        failure_threshold=2,
        recovery_timeout_seconds=15.0,
    )
    circuit = CircuitBreaker(name="ai-breaker", config=cb_config, clock=clock.now)
    config = CybrikConfig(base_url="http://ai.local", max_retries=0)

    with SyncCybrikClient(config, transport=transport, circuit_breaker=circuit) as client:
        # Trip to OPEN with 503 outage
        simulator.inject_http_status(503)
        with pytest.raises(CybrikError):
            client.ai.get_health()
        with pytest.raises(CybrikError):
            client.ai.get_health()
        assert circuit.state == CircuitState.OPEN
        assert simulator.total_requests_received == 2

        # Advance past recovery cooldown
        clock.advance(16.0)

        # Probe fails again because outage is still ongoing
        with pytest.raises(CybrikError):
            client.ai.get_health()

        # Must immediately re-trip to OPEN
        assert circuit.state == CircuitState.OPEN
        assert simulator.total_requests_received == 3

        # Subsequent call is fast-failed
        with pytest.raises(CircuitBreakerOpenError):
            client.ai.get_health()
        assert simulator.total_requests_received == 3


def test_fault_injection_network_connection_error_trips_circuit() -> None:
    """Scenario 3: Network-level connection drops trip circuit breaker.

    Verifies that transport connection drops (ConnectError) are recorded
    as failures and trip the circuit breaker.
    """
    clock = SimulatedClock()
    simulator = DownstreamServiceSimulator("cybrik-fabric")
    transport = httpx.MockTransport(simulator.handler)

    cb_config = CircuitBreakerConfig(
        failure_threshold=2,
        recovery_timeout_seconds=30.0,
    )
    circuit = CircuitBreaker(name="fabric-breaker", config=cb_config, clock=clock.now)
    config = CybrikConfig(base_url="http://fabric.local", max_retries=0)

    with SyncCybrikClient(config, transport=transport, circuit_breaker=circuit) as client:
        # Inject network-level connection drops
        simulator.inject_network_failure(httpx.ConnectError("Connection refused by target peer"))

        with pytest.raises(httpx.ConnectError):
            client.fabric.get_health()
        assert circuit.failure_count == 1
        assert circuit.state == CircuitState.CLOSED

        with pytest.raises(httpx.ConnectError):
            client.fabric.get_health()
        assert circuit.failure_count == 2
        assert circuit.state == CircuitState.OPEN

        # Next call blocked by circuit breaker before network attempt
        with pytest.raises(CircuitBreakerOpenError) as exc_info:
            client.fabric.get_health()
        assert exc_info.value.service_name == "fabric-breaker"
