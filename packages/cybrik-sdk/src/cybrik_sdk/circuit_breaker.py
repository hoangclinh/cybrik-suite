"""Circuit breaker implementation for CYBRIK SDK clients.

Provides thread-safe and async-compatible circuit breaker state management,
exponential backoff resilience policy definitions, and open-circuit errors.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Callable

from cybrik_sdk.exceptions import CybrikSDKError


class CircuitState(StrEnum):
    """Operational states of the circuit breaker."""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpenError(CybrikSDKError):
    """Raised when a call is rejected because the circuit breaker is OPEN."""

    def __init__(
        self,
        service_name: str,
        recovery_timeout: float,
        retry_after: float | None = None,
        message: str | None = None,
    ) -> None:
        self.service_name = service_name
        self.recovery_timeout = recovery_timeout
        self.retry_after = retry_after if retry_after is not None else recovery_timeout
        msg = message or (
            f"Circuit breaker for service '{service_name}' is OPEN. "
            f"Recovery timeout: {recovery_timeout}s, retry after: {self.retry_after}s"
        )
        super().__init__(msg, status_code=503)


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker operational configuration matching JSON schema."""

    failure_threshold: int = 5
    recovery_timeout_seconds: float = 30.0
    half_open_max_calls: int = 3
    consecutive_successes_to_close: int = 2

    def __post_init__(self) -> None:
        if self.failure_threshold < 1 or self.failure_threshold > 100:
            raise ValueError("failure_threshold must be between 1 and 100")
        if self.recovery_timeout_seconds < 1.0 or self.recovery_timeout_seconds > 600.0:
            raise ValueError("recovery_timeout_seconds must be between 1.0 and 600.0")
        if self.half_open_max_calls < 1 or self.half_open_max_calls > 20:
            raise ValueError("half_open_max_calls must be between 1 and 20")
        if self.consecutive_successes_to_close < 1 or self.consecutive_successes_to_close > 20:
            raise ValueError("consecutive_successes_to_close must be between 1 and 20")


@dataclass
class ResiliencePolicy:
    """Full cross-product resilience policy matching cybrik.resilience-policy.v1 schema."""

    max_retries: int = 3
    initial_backoff_seconds: float = 0.5
    max_backoff_seconds: float = 30.0
    backoff_multiplier: float = 2.0
    jitter: bool = True
    circuit_breaker: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    retryable_status_codes: list[int] = field(default_factory=lambda: [429, 502, 503, 504])
    retryable_exceptions: list[str] = field(
        default_factory=lambda: ["TimeoutError", "ConnectionError", "ServiceUnavailableError"]
    )


class CircuitBreaker:
    """Thread-safe and async-compatible circuit breaker."""

    def __init__(
        self,
        name: str = "default",
        config: CircuitBreakerConfig | None = None,
        *,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self.name: str = name
        self.config: CircuitBreakerConfig = config or CircuitBreakerConfig()
        self._clock: Callable[[], float] = clock or time.time
        self._lock = threading.Lock()

        self.state: CircuitState = CircuitState.CLOSED
        self.failure_count: int = 0
        self.success_count: int = 0
        self.last_failure_time: float = 0.0
        self.last_state_change: float = self._clock()
        self.half_open_in_flight: int = 0

    def can_execute(self) -> bool:
        """Evaluate if an outbound request is permitted under circuit breaker policy.

        - CLOSED: returns True.
        - OPEN: if recovery_timeout_seconds has elapsed, transitions to HALF_OPEN and returns True.
                Otherwise returns False.
        - HALF_OPEN: allows up to half_open_max_calls in flight.
        """
        with self._lock:
            now = self._clock()
            if self.state == CircuitState.CLOSED:
                return True

            if self.state == CircuitState.OPEN:
                if now - self.last_failure_time >= self.config.recovery_timeout_seconds:
                    self.state = CircuitState.HALF_OPEN
                    self.last_state_change = now
                    self.success_count = 0
                    self.half_open_in_flight = 1
                    return True
                return False

            if self.state == CircuitState.HALF_OPEN:
                if self.half_open_in_flight < self.config.half_open_max_calls:
                    self.half_open_in_flight += 1
                    return True
                return False

            return False

    def record_success(self) -> None:
        """Record a successful request execution.

        - HALF_OPEN: increments success_count. If threshold reached, transitions to CLOSED.
        - CLOSED: resets failure_count to 0.
        """
        with self._lock:
            now = self._clock()
            if self.state == CircuitState.HALF_OPEN:
                self.half_open_in_flight = max(0, self.half_open_in_flight - 1)
                self.success_count += 1
                if self.success_count >= self.config.consecutive_successes_to_close:
                    self.state = CircuitState.CLOSED
                    self.last_state_change = now
                    self.failure_count = 0
                    self.success_count = 0
                    self.half_open_in_flight = 0
            elif self.state == CircuitState.CLOSED:
                self.failure_count = 0

    def record_failure(self) -> None:
        """Record a failed request execution.

        - CLOSED: increments failure_count. If failure_threshold reached, transitions to OPEN.
        - HALF_OPEN: immediately transitions back to OPEN.
        - OPEN: updates last_failure_time and increments failure_count.
        """
        with self._lock:
            now = self._clock()
            self.last_failure_time = now
            if self.state == CircuitState.CLOSED:
                self.failure_count += 1
                if self.failure_count >= self.config.failure_threshold:
                    self.state = CircuitState.OPEN
                    self.last_state_change = now
            elif self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.OPEN
                self.last_state_change = now
                self.half_open_in_flight = 0
                self.success_count = 0
                self.failure_count += 1
            elif self.state == CircuitState.OPEN:
                self.failure_count += 1

    def reset(self) -> None:
        """Manually reset the circuit breaker to CLOSED state with zeroed counters."""
        with self._lock:
            now = self._clock()
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            self.success_count = 0
            self.half_open_in_flight = 0
            self.last_state_change = now

    def get_stats(self) -> dict[str, Any]:
        """Return a snapshot of current circuit breaker operational statistics."""
        with self._lock:
            return {
                "name": self.name,
                "state": self.state.value,
                "failure_count": self.failure_count,
                "success_count": self.success_count,
                "last_failure_time": self.last_failure_time,
                "last_state_change": self.last_state_change,
                "half_open_in_flight": self.half_open_in_flight,
                "config": {
                    "failure_threshold": self.config.failure_threshold,
                    "recovery_timeout_seconds": self.config.recovery_timeout_seconds,
                    "half_open_max_calls": self.config.half_open_max_calls,
                    "consecutive_successes_to_close": self.config.consecutive_successes_to_close,
                },
            }
