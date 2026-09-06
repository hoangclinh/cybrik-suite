package resilience

import (
	"sync"
	"testing"
	"time"
)

func TestCircuitBreaker_StateTransitions(t *testing.T) {
	currentTime := time.Date(2026, 9, 7, 0, 0, 0, 0, time.UTC)
	clock := func() time.Time {
		return currentTime
	}

	cfg := CircuitBreakerConfig{
		FailureThreshold: 3,
		RecoveryTimeout:  10 * time.Second,
		HalfOpenMaxCalls: 2,
	}
	cb := NewCircuitBreaker(cfg)
	cb.SetClock(clock)

	// Step 1: Initial state is Closed
	if cb.State() != Closed {
		t.Fatalf("expected initial state %v, got %v", Closed, cb.State())
	}
	if !cb.CanExecute() {
		t.Fatal("expected CanExecute to be true in Closed state")
	}

	// Step 2: Record failures below threshold
	cb.RecordFailure()
	cb.RecordFailure()
	if cb.State() != Closed {
		t.Fatalf("expected state %v after 2 failures, got %v", Closed, cb.State())
	}
	if cb.FailureCount() != 2 {
		t.Fatalf("expected failure count 2, got %d", cb.FailureCount())
	}

	// Step 3: 3rd failure reaches FailureThreshold -> transitions to Open
	cb.RecordFailure()
	if cb.State() != Open {
		t.Fatalf("expected state %v after 3 failures, got %v", Open, cb.State())
	}
	if cb.CanExecute() {
		t.Fatal("expected CanExecute to be false immediately after entering Open")
	}

	// Step 4: Advance time past RecoveryTimeout -> CanExecute transitions to HalfOpen
	currentTime = currentTime.Add(11 * time.Second)
	if !cb.CanExecute() {
		t.Fatal("expected CanExecute to return true after RecoveryTimeout has elapsed")
	}
	if cb.State() != HalfOpen {
		t.Fatalf("expected state %v after CanExecute post-timeout, got %v", HalfOpen, cb.State())
	}

	// Step 5: Record success in HalfOpen -> transitions back to Closed
	cb.RecordSuccess()
	if cb.State() != Closed {
		t.Fatalf("expected state %v after RecordSuccess in HalfOpen, got %v", Closed, cb.State())
	}
	if cb.FailureCount() != 0 {
		t.Fatalf("expected failure count reset to 0, got %d", cb.FailureCount())
	}
	if !cb.CanExecute() {
		t.Fatal("expected CanExecute to be true once back in Closed state")
	}
}

func TestCircuitBreaker_FastRejectionWhenOpen(t *testing.T) {
	currentTime := time.Now()
	clock := func() time.Time { return currentTime }

	cfg := CircuitBreakerConfig{
		FailureThreshold: 2,
		RecoveryTimeout:  30 * time.Second,
		HalfOpenMaxCalls: 1,
	}
	cb := NewCircuitBreaker(cfg)
	cb.SetClock(clock)

	cb.RecordFailure()
	cb.RecordFailure()

	if cb.State() != Open {
		t.Fatalf("expected state %v, got %v", Open, cb.State())
	}

	// Fast rejection without waiting
	for i := 0; i < 10; i++ {
		if cb.CanExecute() {
			t.Fatalf("expected CanExecute to return false while Open on attempt %d", i+1)
		}
	}
}

func TestCircuitBreaker_RecoveryInHalfOpen(t *testing.T) {
	currentTime := time.Date(2026, 9, 7, 0, 0, 0, 0, time.UTC)
	clock := func() time.Time { return currentTime }

	cfg := CircuitBreakerConfig{
		FailureThreshold: 1,
		RecoveryTimeout:  5 * time.Second,
		HalfOpenMaxCalls: 2,
	}
	cb := NewCircuitBreaker(cfg)
	cb.SetClock(clock)

	// Trip to Open
	cb.RecordFailure()
	if cb.State() != Open {
		t.Fatalf("expected state %v, got %v", Open, cb.State())
	}

	// Advance time past recovery timeout
	currentTime = currentTime.Add(6 * time.Second)

	// HalfOpen call 1 permitted
	if !cb.CanExecute() {
		t.Fatal("expected call 1 to be permitted in HalfOpen")
	}
	if cb.State() != HalfOpen {
		t.Fatalf("expected state %v, got %v", HalfOpen, cb.State())
	}

	// HalfOpen call 2 permitted (HalfOpenMaxCalls = 2)
	if !cb.CanExecute() {
		t.Fatal("expected call 2 to be permitted in HalfOpen")
	}

	// HalfOpen call 3 rejected (exceeds HalfOpenMaxCalls = 2)
	if cb.CanExecute() {
		t.Fatal("expected call 3 to be rejected in HalfOpen")
	}

	// If failure occurs while in HalfOpen, immediately trips back to Open
	cb.RecordFailure()
	if cb.State() != Open {
		t.Fatalf("expected state %v after failure in HalfOpen, got %v", Open, cb.State())
	}

	// Advance time again
	currentTime = currentTime.Add(6 * time.Second)
	if !cb.CanExecute() {
		t.Fatal("expected call to be permitted after second recovery period")
	}
	if cb.State() != HalfOpen {
		t.Fatalf("expected state %v, got %v", HalfOpen, cb.State())
	}

	// Now record success -> recover to Closed
	cb.RecordSuccess()
	if cb.State() != Closed {
		t.Fatalf("expected state %v after successful probe, got %v", Closed, cb.State())
	}
}

func TestCircuitBreaker_Reset(t *testing.T) {
	cfg := CircuitBreakerConfig{
		FailureThreshold: 1,
		RecoveryTimeout:  10 * time.Second,
	}
	cb := NewCircuitBreaker(cfg)
	cb.RecordFailure()
	if cb.State() != Open {
		t.Fatalf("expected state %v, got %v", Open, cb.State())
	}

	cb.Reset()
	if cb.State() != Closed {
		t.Fatalf("expected state %v after Reset, got %v", Closed, cb.State())
	}
	if cb.FailureCount() != 0 {
		t.Fatalf("expected failure count 0, got %d", cb.FailureCount())
	}
	if !cb.CanExecute() {
		t.Fatal("expected CanExecute true after Reset")
	}
}

func TestCircuitBreaker_ConcurrentOperations(t *testing.T) {
	cfg := CircuitBreakerConfig{
		FailureThreshold: 100,
		RecoveryTimeout:  50 * time.Millisecond,
		HalfOpenMaxCalls: 10,
	}
	cb := NewCircuitBreaker(cfg)

	var wg sync.WaitGroup
	workers := 20
	iterations := 200

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				cb.CanExecute()
				if j%5 == 0 {
					cb.RecordFailure()
				} else {
					cb.RecordSuccess()
				}
				_ = cb.State()
			}
		}(i)
	}

	wg.Wait()
}
