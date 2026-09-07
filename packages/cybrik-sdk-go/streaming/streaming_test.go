package streaming

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestEventStreamReadingFromMockSSEHTTPServer verifies end-to-end SSE reading from a mock HTTP server.
func TestEventStreamReadingFromMockSSEHTTPServer(t *testing.T) {
	expectedToken := "test-secret-token"
	expectedTenant := "tenant-cyber-99"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify expected request headers
		if r.Header.Get("Accept") != "text/event-stream" {
			http.Error(w, "expected text/event-stream", http.StatusBadRequest)
			return
		}
		if r.Header.Get("Authorization") != "Bearer "+expectedToken {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if r.Header.Get("X-Tenant-ID") != expectedTenant {
			http.Error(w, "invalid tenant", http.StatusBadRequest)
			return
		}

		// Verify query parameters from AlertFilter
		q := r.URL.Query()
		if q.Get("severity") != "critical" {
			http.Error(w, "missing severity filter", http.StatusBadRequest)
			return
		}
		if q.Get("status") != "open" {
			http.Error(w, "missing status filter", http.StatusBadRequest)
			return
		}
		if q.Get("source") != "edr-agent" {
			http.Error(w, "missing source filter", http.StatusBadRequest)
			return
		}
		if q.Get("label.environment") != "production" {
			http.Error(w, "missing label filter", http.StatusBadRequest)
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		// Event 1: alert.created
		fmt.Fprintf(w, "event: alert.created\nid: evt-001\ndata: {\"id\":\"alt-1\",\"severity\":\"critical\"}\n\n")
		flusher.Flush()

		// Event 2: alert.updated
		fmt.Fprintf(w, "event: alert.updated\nid: evt-002\ndata: {\"id\":\"alt-1\",\"status\":\"investigating\"}\n\n")
		flusher.Flush()

		// Event 3: case.opened
		fmt.Fprintf(w, "event: case.opened\nid: evt-003\ndata: {\"id\":\"case-900\",\"title\":\"Active Ransomware\"}\n\n")
		flusher.Flush()

		// Event 4: heartbeat
		fmt.Fprintf(w, "event: heartbeat\nid: evt-004\ndata: {\"status\":\"healthy\"}\n\n")
		flusher.Flush()

		// Hold connection until client cancels
		<-r.Context().Done()
	}))
	defer server.Close()

	client, err := NewStreamingClient(StreamConfig{
		BaseURL:   server.URL,
		AuthToken: expectedToken,
		TenantID:  expectedTenant,
	})
	if err != nil {
		t.Fatalf("failed to create streaming client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := AlertFilter{
		Severity: "critical",
		Status:   "open",
		Source:   "edr-agent",
		Labels: map[string]string{
			"environment": "production",
		},
	}

	streamer, err := client.SubscribeAlerts(ctx, filter)
	if err != nil {
		t.Fatalf("failed to subscribe alerts: %v", err)
	}
	defer streamer.Close()

	events := streamer.Events()

	// Verify Event 1
	select {
	case ev, ok := <-events:
		if !ok {
			t.Fatal("events channel closed unexpectedly")
		}
		if ev.ID != "evt-001" {
			t.Errorf("expected event ID 'evt-001', got %q", ev.ID)
		}
		if ev.Event != AlertCreated {
			t.Errorf("expected event type %q, got %q", AlertCreated, ev.Event)
		}
		var payload map[string]string
		if err := ev.Unmarshal(&payload); err != nil {
			t.Fatalf("failed to unmarshal event data: %v", err)
		}
		if payload["id"] != "alt-1" || payload["severity"] != "critical" {
			t.Errorf("unexpected payload content: %v", payload)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event 1")
	}

	// Verify Event 2
	select {
	case ev, ok := <-events:
		if !ok {
			t.Fatal("events channel closed unexpectedly")
		}
		if ev.ID != "evt-002" {
			t.Errorf("expected event ID 'evt-002', got %q", ev.ID)
		}
		if ev.Event != AlertUpdated {
			t.Errorf("expected event type %q, got %q", AlertUpdated, ev.Event)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event 2")
	}

	// Verify Event 3
	select {
	case ev, ok := <-events:
		if !ok {
			t.Fatal("events channel closed unexpectedly")
		}
		if ev.ID != "evt-003" {
			t.Errorf("expected event ID 'evt-003', got %q", ev.ID)
		}
		if ev.Event != CaseOpened {
			t.Errorf("expected event type %q, got %q", CaseOpened, ev.Event)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event 3")
	}

	// Verify Event 4
	select {
	case ev, ok := <-events:
		if !ok {
			t.Fatal("events channel closed unexpectedly")
		}
		if ev.ID != "evt-004" {
			t.Errorf("expected event ID 'evt-004', got %q", ev.ID)
		}
		if ev.Event != Heartbeat {
			t.Errorf("expected event type %q, got %q", Heartbeat, ev.Event)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event 4")
	}
}

// TestAutomaticReconnectionAfterServerDisconnect verifies automatic reconnection with backoff and Last-Event-ID propagation.
func TestAutomaticReconnectionAfterServerDisconnect(t *testing.T) {
	var connCount atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		currentConn := connCount.Add(1)

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "flushing unsupported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		if currentConn == 1 {
			// First connection: emit event 1 with retry millis and disconnect
			fmt.Fprintf(w, "event: alert.created\nid: evt-recon-001\nretry: 15\ndata: {\"id\":\"alt-recon-1\"}\n\n")
			flusher.Flush()
			// Returning closes connection abruptly to trigger disconnect
			return
		}

		// Subsequent connection: verify client sent Last-Event-ID header
		lastID := r.Header.Get("Last-Event-ID")
		if lastID != "evt-recon-001" {
			http.Error(w, fmt.Sprintf("expected Last-Event-ID 'evt-recon-001', got %q", lastID), http.StatusBadRequest)
			return
		}

		// Emit event 2 on the reconnected stream
		fmt.Fprintf(w, "event: alert.updated\nid: evt-recon-002\ndata: {\"id\":\"alt-recon-1\",\"status\":\"resolved\"}\n\n")
		flusher.Flush()

		// Hold connection
		<-r.Context().Done()
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	streamer, err := NewSSEStreamer(ctx, server.URL, StreamConfig{
		InitialBackoff:       10 * time.Millisecond,
		MaxBackoff:           100 * time.Millisecond,
		MaxReconnectAttempts: 5,
	})
	if err != nil {
		t.Fatalf("failed to create SSEStreamer: %v", err)
	}
	defer streamer.Close()

	// 1. Read event from first connection
	select {
	case ev := <-streamer.Events():
		if ev.ID != "evt-recon-001" {
			t.Errorf("expected event ID 'evt-recon-001', got %q", ev.ID)
		}
		if ev.RetryMillis != 15 {
			t.Errorf("expected RetryMillis 15, got %d", ev.RetryMillis)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event 1 before disconnect")
	}

	// 2. An error should be emitted on disconnect
	select {
	case err := <-streamer.Errors():
		if err == nil {
			t.Error("expected non-nil error on disconnect")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for disconnect error")
	}

	// 3. Client should automatically reconnect and receive event 2
	select {
	case ev := <-streamer.Events():
		if ev.ID != "evt-recon-002" {
			t.Errorf("expected reconnected event ID 'evt-recon-002', got %q", ev.ID)
		}
		if ev.Event != AlertUpdated {
			t.Errorf("expected event type %q, got %q", AlertUpdated, ev.Event)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for event 2 after reconnection")
	}

	// Verify streamer updated its internal lastEventID
	if streamer.LastEventID() != "evt-recon-002" {
		t.Errorf("expected streamer.LastEventID() to be 'evt-recon-002', got %q", streamer.LastEventID())
	}

	// Verify server saw at least 2 connections
	if connCount.Load() < 2 {
		t.Errorf("expected at least 2 connections, got %d", connCount.Load())
	}
}

// TestContextCancellationTerminatesStreamAndClosesChannels verifies graceful shutdown without leaks.
func TestContextCancellationTerminatesStreamAndClosesChannels(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		// Send initial event
		fmt.Fprintf(w, "event: alert.created\nid: cancel-01\ndata: {}\n\n")
		flusher.Flush()

		// Hold until connection is closed by client
		<-r.Context().Done()
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())

	streamer, err := NewSSEStreamer(ctx, server.URL, StreamConfig{
		InitialBackoff: 10 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("failed to create streamer: %v", err)
	}

	// Receive the initial event
	select {
	case ev := <-streamer.Events():
		if ev.ID != "cancel-01" {
			t.Errorf("expected event ID 'cancel-01', got %q", ev.ID)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for initial event")
	}

	// Cancel context to initiate graceful shutdown
	cancel()

	// Verify Events channel is closed cleanly
	select {
	case _, ok := <-streamer.Events():
		if ok {
			// Drain in case there were leftover events
			for range streamer.Events() {
			}
		}
	case <-time.After(2 * time.Second):
		t.Fatal("events channel did not close within timeout")
	}

	// Verify Errors channel is closed cleanly
	select {
	case _, ok := <-streamer.Errors():
		if ok {
			for range streamer.Errors() {
			}
		}
	case <-time.After(2 * time.Second):
		t.Fatal("errors channel did not close within timeout")
	}

	if !streamer.IsClosed() {
		t.Error("expected streamer to report closed status")
	}
}

// TestParsingSSEFormatting verifies comprehensive SSE line protocol parsing.
func TestParsingSSEFormatting(t *testing.T) {
	raw := strings.Join([]string{
		// Event 1: all standard fields
		"event: alert.created",
		"id: evt-100",
		"retry: 4500",
		"data: {\"name\":\"detection-1\"}",
		"",
		// Event 2: multi-line data
		"event: alert.updated",
		"id: evt-101",
		"data: line 1 of data",
		"data: line 2 of data",
		"data: line 3 of data",
		"",
		// Event 3: no leading space after colon
		"event:case.opened",
		"id:evt-102",
		"data:{\"case_id\":\"c-1\"}",
		"",
		// Event 4: multiple leading spaces preserved (only first stripped)
		"event: heartbeat",
		"id: evt-103",
		"data:  indented content",
		"",
		// Comment line ignored (does not trigger event)
		": this is an sse keep-alive comment",
		": second comment",
		"",
		// Event 5: CRLF line endings
		"event: alert.created\r",
		"id: evt-104\r",
		"data: crlf content\r",
		"\r",
	}, "\n")

	events, err := ParseSSEEvents(raw)
	if err != nil {
		t.Fatalf("ParseSSEEvents failed: %v", err)
	}

	if len(events) != 5 {
		t.Fatalf("expected 5 parsed events, got %d", len(events))
	}

	// Event 1 checks
	e1 := events[0]
	if e1.Event != AlertCreated {
		t.Errorf("e1: expected event %q, got %q", AlertCreated, e1.Event)
	}
	if e1.ID != "evt-100" {
		t.Errorf("e1: expected ID 'evt-100', got %q", e1.ID)
	}
	if e1.RetryMillis != 4500 {
		t.Errorf("e1: expected RetryMillis 4500, got %d", e1.RetryMillis)
	}
	if string(e1.Data) != "{\"name\":\"detection-1\"}" {
		t.Errorf("e1: unexpected data: %s", string(e1.Data))
	}

	// Event 2 checks (multi-line data joined by newline)
	e2 := events[1]
	if e2.Event != AlertUpdated {
		t.Errorf("e2: expected event %q, got %q", AlertUpdated, e2.Event)
	}
	if e2.ID != "evt-101" {
		t.Errorf("e2: expected ID 'evt-101', got %q", e2.ID)
	}
	expectedData2 := "line 1 of data\nline 2 of data\nline 3 of data"
	if string(e2.Data) != expectedData2 {
		t.Errorf("e2: expected multi-line data %q, got %q", expectedData2, string(e2.Data))
	}

	// Event 3 checks (no space after colon)
	e3 := events[2]
	if e3.Event != CaseOpened {
		t.Errorf("e3: expected event %q, got %q", CaseOpened, e3.Event)
	}
	if e3.ID != "evt-102" {
		t.Errorf("e3: expected ID 'evt-102', got %q", e3.ID)
	}
	if string(e3.Data) != "{\"case_id\":\"c-1\"}" {
		t.Errorf("e3: unexpected data: %s", string(e3.Data))
	}

	// Event 4 checks (two spaces after colon -> first removed, second preserved)
	e4 := events[3]
	if e4.Event != Heartbeat {
		t.Errorf("e4: expected event %q, got %q", Heartbeat, e4.Event)
	}
	if string(e4.Data) != " indented content" {
		t.Errorf("e4: expected preserved leading space, got %q", string(e4.Data))
	}

	// Event 5 checks (CRLF)
	e5 := events[4]
	if e5.Event != AlertCreated {
		t.Errorf("e5: expected event %q, got %q", AlertCreated, e5.Event)
	}
	if e5.ID != "evt-104" {
		t.Errorf("e5: expected ID 'evt-104', got %q", e5.ID)
	}
	if string(e5.Data) != "crlf content" {
		t.Errorf("e5: unexpected data: %s", string(e5.Data))
	}
}

// TestExponentialBackoffAndJitter verifies backoff escalation, capping, and retry duration override.
func TestExponentialBackoffAndJitter(t *testing.T) {
	base := 100 * time.Millisecond
	maxB := 1000 * time.Millisecond

	// Attempt 1: backoff in [base, 1.25 * base]
	b1 := CalculateBackoff(1, base, maxB, 0)
	if b1 < base || b1 > 130*time.Millisecond {
		t.Errorf("b1 out of expected range: %v", b1)
	}

	// Attempt 2: base * 2 = 200ms -> [200ms, 250ms]
	b2 := CalculateBackoff(2, base, maxB, 0)
	if b2 < 200*time.Millisecond || b2 > 260*time.Millisecond {
		t.Errorf("b2 out of expected range: %v", b2)
	}

	// Attempt 3: base * 4 = 400ms -> [400ms, 500ms]
	b3 := CalculateBackoff(3, base, maxB, 0)
	if b3 < 400*time.Millisecond || b3 > 520*time.Millisecond {
		t.Errorf("b3 out of expected range: %v", b3)
	}

	// Attempt 10: capped at maxB
	b10 := CalculateBackoff(10, base, maxB, 0)
	if b10 > maxB {
		t.Errorf("b10 should not exceed maxB: %v", b10)
	}

	// Retry millis override
	bRetry := CalculateBackoff(1, base, maxB, 500)
	if bRetry < 500*time.Millisecond || bRetry > 650*time.Millisecond {
		t.Errorf("bRetry out of expected range: %v", bRetry)
	}
}

// TestMaxReconnectAttemptsExceeded verifies that streamer terminates when reconnection limit is reached.
func TestMaxReconnectAttemptsExceeded(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal server failure", http.StatusInternalServerError)
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	streamer, err := NewSSEStreamer(ctx, server.URL, StreamConfig{
		InitialBackoff:       5 * time.Millisecond,
		MaxBackoff:           20 * time.Millisecond,
		MaxReconnectAttempts: 2,
	})
	if err != nil {
		t.Fatalf("failed to create streamer: %v", err)
	}
	defer streamer.Close()

	// Wait for channels to close
	select {
	case _, ok := <-streamer.Events():
		if ok {
			for range streamer.Events() {
			}
		}
	case <-time.After(3 * time.Second):
		t.Fatal("events channel did not close after max reconnect attempts exceeded")
	}

	if !streamer.IsClosed() {
		t.Error("streamer should report closed status after max attempts exceeded")
	}
}

// TestStreamingClient_Validation verifies input validation on client construction and subscription.
func TestStreamingClient_Validation(t *testing.T) {
	// Missing BaseURL
	_, err := NewStreamingClient(StreamConfig{})
	if err == nil {
		t.Error("expected error for empty BaseURL")
	}

	// Malformed BaseURL
	_, err = NewStreamingClient(StreamConfig{BaseURL: "://invalid-url"})
	if err == nil {
		t.Error("expected error for malformed BaseURL")
	}

	// Valid BaseURL
	client, err := NewStreamingClient(StreamConfig{
		BaseURL: "https://api.cybrik.dev",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	cfg := client.Config()
	if cfg.InitialBackoff <= 0 || cfg.MaxBackoff <= 0 || cfg.MaxReconnectAttempts <= 0 {
		t.Errorf("expected default settings to be populated: %+v", cfg)
	}
}

// TestStreamer_CloseIdempotent verifies that calling Close multiple times and concurrently is safe.
func TestStreamer_CloseIdempotent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
		<-r.Context().Done()
	}))
	defer server.Close()

	streamer, err := NewSSEStreamer(context.Background(), server.URL, StreamConfig{
		InitialBackoff: 10 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("failed to create streamer: %v", err)
	}

	// Close sequentially
	if err := streamer.Close(); err != nil {
		t.Errorf("first Close() returned error: %v", err)
	}
	if err := streamer.Close(); err != nil {
		t.Errorf("second Close() returned error: %v", err)
	}

	// Close concurrently
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = streamer.Close()
		}()
	}
	wg.Wait()
}

// TestStreamEvent_Unmarshal verifies unmarshaling and error handling on empty data.
func TestStreamEvent_Unmarshal(t *testing.T) {
	ev := StreamEvent{
		Data: []byte(`{"status":"investigating","priority":"P1"}`),
	}

	var data struct {
		Status   string `json:"status"`
		Priority string `json:"priority"`
	}

	if err := ev.Unmarshal(&data); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if data.Status != "investigating" || data.Priority != "P1" {
		t.Errorf("unexpected unmarshaled data: %+v", data)
	}

	emptyEv := StreamEvent{}
	if err := emptyEv.Unmarshal(&data); err == nil {
		t.Error("expected error unmarshaling empty event data")
	}
}

// TestAlertFilter_ToQueryParams verifies serialization of filter parameters.
func TestAlertFilter_ToQueryParams(t *testing.T) {
	sinceTime := time.Date(2026, 9, 7, 10, 0, 0, 0, time.UTC)
	filter := AlertFilter{
		Severity: "high",
		Status:   "resolved",
		Source:   "cloud-siem",
		TenantID: "tenant-42",
		Since:    sinceTime,
		Labels: map[string]string{
			"env":    "staging",
			"region": "us-east-1",
		},
	}

	values := filter.ToQueryParams()
	if values.Get("severity") != "high" {
		t.Errorf("expected severity 'high', got %q", values.Get("severity"))
	}
	if values.Get("status") != "resolved" {
		t.Errorf("expected status 'resolved', got %q", values.Get("status"))
	}
	if values.Get("source") != "cloud-siem" {
		t.Errorf("expected source 'cloud-siem', got %q", values.Get("source"))
	}
	if values.Get("tenant_id") != "tenant-42" {
		t.Errorf("expected tenant_id 'tenant-42', got %q", values.Get("tenant_id"))
	}
	if values.Get("since") != sinceTime.Format(time.RFC3339) {
		t.Errorf("expected since %q, got %q", sinceTime.Format(time.RFC3339), values.Get("since"))
	}
	if values.Get("label.env") != "staging" {
		t.Errorf("expected label.env 'staging', got %q", values.Get("label.env"))
	}
	if values.Get("label.region") != "us-east-1" {
		t.Errorf("expected label.region 'us-east-1', got %q", values.Get("label.region"))
	}
}
