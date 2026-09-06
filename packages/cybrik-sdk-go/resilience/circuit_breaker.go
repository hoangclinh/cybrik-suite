package resilience

import (
	"errors"
	"sync"
	"time"
)

// State represents the operational state of the circuit breaker.
type State string

const (
	StateClosed   State = "Closed"
	StateOpen     State = "Open"
	StateHalfOpen State = "HalfOpen"

	// Convenient aliases matching specification
	Closed   = StateClosed
	Open     = StateOpen
	HalfOpen = StateHalfOpen
)

// ErrCircuitBreakerOpen is returned when an execution is rejected because the circuit breaker is Open.
var ErrCircuitBreakerOpen = errors.New("circuit breaker is open")

// CircuitBreakerConfig holds operational thresholds for the circuit breaker.
type CircuitBreakerConfig struct {
	FailureThreshold int           // consecutive failures to trip from Closed to Open
	RecoveryTimeout  time.Duration // duration to wait in Open state before testing HalfOpen
	HalfOpenMaxCalls int           // maximum permitted calls during HalfOpen state
}

// ResiliencePolicy encapsulates retry and circuit breaker configuration.
type ResiliencePolicy struct {
	MaxRetries           int
	InitialBackoff       time.Duration
	MaxBackoff           time.Duration
	BackoffMultiplier    float64
	Jitter               bool
	CircuitBreaker       CircuitBreakerConfig
	RetryableStatusCodes []int
}

// DefaultResiliencePolicy returns production defaults matching the CYBRIK resilience specification.
func DefaultResiliencePolicy() ResiliencePolicy {
	return ResiliencePolicy{
		MaxRetries:        3,
		InitialBackoff:    500 * time.Millisecond,
		MaxBackoff:        30 * time.Second,
		BackoffMultiplier: 2.0,
		Jitter:            true,
		CircuitBreaker: CircuitBreakerConfig{
			FailureThreshold: 5,
			RecoveryTimeout:  30 * time.Second,
			HalfOpenMaxCalls: 3,
		},
		RetryableStatusCodes: []int{429, 502, 503, 504},
	}
}

// CircuitBreaker provides thread-safe state tracking and failure isolation.
type CircuitBreaker struct {
	mu              sync.RWMutex
	config          CircuitBreakerConfig
	state           State
	failureCount    int
	successCount    int
	halfOpenCalls   int
	lastFailureTime time.Time
	clock           func() time.Time
}

// NewCircuitBreaker initializes a thread-safe CircuitBreaker with the given configuration.
func NewCircuitBreaker(cfg CircuitBreakerConfig) *CircuitBreaker {
	if cfg.FailureThreshold <= 0 {
		cfg.FailureThreshold = 5
	}
	if cfg.RecoveryTimeout <= 0 {
		cfg.RecoveryTimeout = 30 * time.Second
	}
	if cfg.HalfOpenMaxCalls <= 0 {
		cfg.HalfOpenMaxCalls = 3
	}

	return &CircuitBreaker{
		config: cfg,
		state:  StateClosed,
	}
}

// SetClock configures a custom time source for deterministic testing.
func (cb *CircuitBreaker) SetClock(clock func() time.Time) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.clock = clock
}

func (cb *CircuitBreaker) now() time.Time {
	if cb.clock != nil {
		return cb.clock()
	}
	return time.Now()
}

// State returns the current operational state of the circuit breaker.
func (cb *CircuitBreaker) State() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Config returns a copy of the circuit breaker configuration.
func (cb *CircuitBreaker) Config() CircuitBreakerConfig {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.config
}

// FailureCount returns the current consecutive failure counter.
func (cb *CircuitBreaker) FailureCount() int {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.failureCount
}

// CanExecute evaluates whether an outbound request is permitted under policy.
// - Closed: always permitted.
// - Open: permitted only if RecoveryTimeout has elapsed, transitioning state to HalfOpen.
// - HalfOpen: permitted up to HalfOpenMaxCalls.
func (cb *CircuitBreaker) CanExecute() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := cb.now()

	switch cb.state {
	case StateClosed:
		return true

	case StateOpen:
		if now.Sub(cb.lastFailureTime) >= cb.config.RecoveryTimeout {
			cb.state = StateHalfOpen
			cb.halfOpenCalls = 1
			cb.successCount = 0
			return true
		}
		return false

	case StateHalfOpen:
		if cb.halfOpenCalls < cb.config.HalfOpenMaxCalls {
			cb.halfOpenCalls++
			return true
		}
		return false

	default:
		return false
	}
}

// RecordSuccess records a successful execution.
// - HalfOpen: transitions the circuit breaker back to Closed.
// - Closed: resets the failure counter.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateHalfOpen:
		cb.successCount++
		cb.state = StateClosed
		cb.failureCount = 0
		cb.successCount = 0
		cb.halfOpenCalls = 0

	case StateClosed:
		cb.failureCount = 0
	}
}

// RecordFailure records a failed execution.
// - Closed: increments failure counter; if threshold reached, trips to Open.
// - HalfOpen: immediately trips back to Open.
// - Open: updates the last failure timestamp.
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := cb.now()
	cb.lastFailureTime = now

	switch cb.state {
	case StateClosed:
		cb.failureCount++
		if cb.failureCount >= cb.config.FailureThreshold {
			cb.state = StateOpen
		}

	case StateHalfOpen:
		cb.state = StateOpen
		cb.halfOpenCalls = 0
		cb.successCount = 0
		cb.failureCount++

	case StateOpen:
		cb.failureCount++
	}
}

// Reset resets the circuit breaker to Closed state with zeroed counters.
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.state = StateClosed
	cb.failureCount = 0
	cb.successCount = 0
	cb.halfOpenCalls = 0
	cb.lastFailureTime = time.Time{}
}
