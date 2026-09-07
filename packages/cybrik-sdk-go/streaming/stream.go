package streaming

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// AlertStreamer defines the interface for consuming real-time security alert event streams.
type AlertStreamer interface {
	// Events returns a receive-only channel of incoming StreamEvents.
	Events() <-chan StreamEvent

	// Errors returns a receive-only channel of connection and stream errors.
	Errors() <-chan error

	// Close terminates the streaming connection and releases all resources.
	Close() error
}

// SSEStreamer manages a persistent Server-Sent Events (SSE) connection with automatic reconnection.
type SSEStreamer struct {
	cfg        StreamConfig
	httpClient *http.Client
	url        string

	ctx    context.Context
	cancel context.CancelFunc

	eventsChan chan StreamEvent
	errorsChan chan error

	mu          sync.Mutex
	lastEventID string
	retryMillis int
	activeResp  *http.Response
	closed      bool
	closeOnce   sync.Once
	wg          sync.WaitGroup
}

// NewSSEStreamer constructs and starts an SSEStreamer connected to the specified URL.
func NewSSEStreamer(ctx context.Context, streamURL string, cfg StreamConfig) (*SSEStreamer, error) {
	if strings.TrimSpace(streamURL) == "" {
		return nil, errors.New("stream URL is required")
	}

	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{
			Timeout: 0, // SSE streams must not time out globally
		}
	} else if client.Timeout != 0 {
		cloned := *client
		cloned.Timeout = 0
		client = &cloned
	}

	if cfg.InitialBackoff <= 0 {
		cfg.InitialBackoff = 250 * time.Millisecond
	}
	if cfg.MaxBackoff <= 0 {
		cfg.MaxBackoff = 30 * time.Second
	}
	if cfg.MaxReconnectAttempts == 0 {
		cfg.MaxReconnectAttempts = 10
	}

	streamCtx, cancel := context.WithCancel(ctx)

	streamer := &SSEStreamer{
		cfg:         cfg,
		httpClient:  client,
		url:         streamURL,
		ctx:         streamCtx,
		cancel:      cancel,
		eventsChan:  make(chan StreamEvent, 256),
		errorsChan:  make(chan error, 64),
		retryMillis: int(cfg.InitialBackoff / time.Millisecond),
	}

	streamer.wg.Add(1)
	go streamer.run()

	return streamer, nil
}

// Events returns the receive-only channel for real-time events.
func (s *SSEStreamer) Events() <-chan StreamEvent {
	return s.eventsChan
}

// Errors returns the receive-only channel for streaming errors and disconnect notices.
func (s *SSEStreamer) Errors() <-chan error {
	return s.errorsChan
}

// Close gracefully stops the streaming connection, unblocks all readers, and releases goroutines.
func (s *SSEStreamer) Close() error {
	s.closeOnce.Do(func() {
		s.mu.Lock()
		s.closed = true
		if s.activeResp != nil && s.activeResp.Body != nil {
			_ = s.activeResp.Body.Close()
		}
		s.mu.Unlock()
		s.cancel()
	})
	s.wg.Wait()
	return nil
}

// LastEventID returns the most recently received event ID.
func (s *SSEStreamer) LastEventID() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastEventID
}

// RetryMillis returns the current retry backoff in milliseconds.
func (s *SSEStreamer) RetryMillis() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.retryMillis
}

// IsClosed returns true if the streamer has been closed or cancelled.
func (s *SSEStreamer) IsClosed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.closed
}

// run executes the persistent connection lifecycle loop.
func (s *SSEStreamer) run() {
	defer s.wg.Done()
	defer s.cleanup()

	attempts := 0

	for {
		if s.ctx.Err() != nil {
			return
		}

		eventsReceived := 0
		err := s.connectAndRead(&eventsReceived)
		if s.ctx.Err() != nil {
			return
		}

		if eventsReceived > 0 {
			attempts = 0
		}

		if err == nil {
			err = errors.New("unexpected server disconnect (EOF)")
		}

		s.sendError(err)

		attempts++
		if s.cfg.MaxReconnectAttempts > 0 && attempts > s.cfg.MaxReconnectAttempts {
			s.sendError(fmt.Errorf("max reconnection attempts (%d) exceeded: %w", s.cfg.MaxReconnectAttempts, err))
			return
		}

		backoff := s.calculateBackoff(attempts)
		timer := time.NewTimer(backoff)
		select {
		case <-s.ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}

// connectAndRead executes a single HTTP SSE streaming connection attempt and reads events until disconnect.
func (s *SSEStreamer) connectAndRead(eventsReceived *int) error {
	req, err := http.NewRequestWithContext(s.ctx, http.MethodGet, s.url, nil)
	if err != nil {
		return fmt.Errorf("create stream request: %w", err)
	}

	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Connection", "keep-alive")

	if s.cfg.AuthToken != "" {
		auth := s.cfg.AuthToken
		if !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
			auth = "Bearer " + auth
		}
		req.Header.Set("Authorization", auth)
	}

	if s.cfg.TenantID != "" {
		req.Header.Set("X-Tenant-ID", s.cfg.TenantID)
	}

	s.mu.Lock()
	lastID := s.lastEventID
	s.mu.Unlock()
	if lastID != "" {
		req.Header.Set("Last-Event-ID", lastID)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("connect to sse stream: %w", err)
	}

	s.mu.Lock()
	if s.closed || s.ctx.Err() != nil {
		s.mu.Unlock()
		_ = resp.Body.Close()
		return errors.New("stream closed")
	}
	s.activeResp = resp
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.activeResp = nil
		s.mu.Unlock()
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		bodySnippet, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("unexpected http status %d: %s", resp.StatusCode, string(bodySnippet))
	}

	return s.readLines(resp.Body, eventsReceived)
}

// readLines parses the SSE byte stream line-by-line and dispatches parsed events.
func (s *SSEStreamer) readLines(r io.Reader, eventsReceived *int) error {
	reader := bufio.NewReader(r)

	var (
		eventID   string
		eventType StreamEventType
		dataLines [][]byte
		hasData   bool
	)

	dispatch := func() error {
		if !hasData && eventType == "" && eventID == "" {
			return nil
		}

		s.mu.Lock()
		currentRetry := s.retryMillis
		s.mu.Unlock()

		var data []byte
		if len(dataLines) > 0 {
			data = bytes.Join(dataLines, []byte("\n"))
		}

		ev := StreamEvent{
			ID:          eventID,
			Event:       eventType,
			Data:        data,
			Timestamp:   time.Now().UTC(),
			RetryMillis: currentRetry,
		}

		select {
		case s.eventsChan <- ev:
			if eventsReceived != nil {
				*eventsReceived++
			}
		case <-s.ctx.Done():
			return s.ctx.Err()
		}

		eventID = ""
		eventType = ""
		dataLines = nil
		hasData = false
		return nil
	}

	for {
		if s.ctx.Err() != nil {
			return s.ctx.Err()
		}

		lineBytes, err := reader.ReadBytes('\n')
		if err != nil && len(lineBytes) == 0 {
			_ = dispatch()
			return err
		}

		line := string(bytes.TrimRight(lineBytes, "\r\n"))

		if len(line) == 0 {
			if dispatchErr := dispatch(); dispatchErr != nil {
				return dispatchErr
			}
			if err != nil {
				return err
			}
			continue
		}

		// Comment line: starts with ':'
		if strings.HasPrefix(line, ":") {
			if err != nil {
				_ = dispatch()
				return err
			}
			continue
		}

		var field, value string
		colonIdx := strings.IndexByte(line, ':')
		if colonIdx >= 0 {
			field = line[:colonIdx]
			value = line[colonIdx+1:]
			if len(value) > 0 && value[0] == ' ' {
				value = value[1:]
			}
		} else {
			field = line
			value = ""
		}

		switch field {
		case "event":
			eventType = StreamEventType(value)
		case "data":
			hasData = true
			dataLines = append(dataLines, []byte(value))
		case "id":
			if !strings.ContainsRune(value, '\x00') {
				eventID = value
				s.mu.Lock()
				s.lastEventID = value
				s.mu.Unlock()
			}
		case "retry":
			if millis, parseErr := strconv.Atoi(strings.TrimSpace(value)); parseErr == nil && millis >= 0 {
				s.mu.Lock()
				s.retryMillis = millis
				s.mu.Unlock()
			}
		}

		if err != nil {
			_ = dispatch()
			return err
		}
	}
}

// calculateBackoff determines the delay before the next reconnect attempt.
func (s *SSEStreamer) calculateBackoff(attempt int) time.Duration {
	s.mu.Lock()
	retry := s.retryMillis
	s.mu.Unlock()
	return CalculateBackoff(attempt, s.cfg.InitialBackoff, s.cfg.MaxBackoff, retry)
}

// CalculateBackoff computes exponential backoff with randomized jitter.
func CalculateBackoff(attempt int, base, maxB time.Duration, retryMillis int) time.Duration {
	if retryMillis > 0 {
		base = time.Duration(retryMillis) * time.Millisecond
	}
	if base <= 0 {
		base = 100 * time.Millisecond
	}
	if maxB <= 0 {
		maxB = 30 * time.Second
	}
	if maxB < base {
		maxB = base
	}

	multiplier := 1
	if attempt > 1 {
		shift := attempt - 1
		if shift > 30 {
			shift = 30
		}
		multiplier = 1 << shift
	}

	backoff := base * time.Duration(multiplier)
	if backoff > maxB || backoff <= 0 {
		backoff = maxB
	}

	// Jitter: add between 0% and 25% random jitter
	jitterFraction := rand.Float64() * 0.25
	jitter := time.Duration(float64(backoff) * jitterFraction)
	total := backoff + jitter
	if total > maxB {
		total = maxB
	}
	return total
}

// sendError sends an error to the errors channel without blocking if the channel is full.
func (s *SSEStreamer) sendError(err error) {
	if err == nil || errors.Is(err, context.Canceled) || s.ctx.Err() != nil {
		return
	}
	select {
	case s.errorsChan <- err:
	case <-s.ctx.Done():
	default:
	}
}

// cleanup closes the event and error channels once the worker loop has exited.
func (s *SSEStreamer) cleanup() {
	s.mu.Lock()
	s.closed = true
	s.mu.Unlock()
	close(s.eventsChan)
	close(s.errorsChan)
}

// ParseSSEEvents parses a raw string containing SSE formatted text into a slice of StreamEvents.
func ParseSSEEvents(raw string) ([]StreamEvent, error) {
	return ParseSSEStream(strings.NewReader(raw))
}

// ParseSSEStream reads and parses SSE events from an io.Reader until EOF.
func ParseSSEStream(r io.Reader) ([]StreamEvent, error) {
	var events []StreamEvent
	reader := bufio.NewReader(r)

	var (
		eventID     string
		eventType   StreamEventType
		dataLines   [][]byte
		hasData     bool
		retryMillis int
	)

	dispatch := func() {
		if !hasData && eventType == "" && eventID == "" {
			return
		}

		var data []byte
		if len(dataLines) > 0 {
			data = bytes.Join(dataLines, []byte("\n"))
		}

		events = append(events, StreamEvent{
			ID:          eventID,
			Event:       eventType,
			Data:        data,
			Timestamp:   time.Now().UTC(),
			RetryMillis: retryMillis,
		})

		eventID = ""
		eventType = ""
		dataLines = nil
		hasData = false
	}

	for {
		lineBytes, err := reader.ReadBytes('\n')
		if err != nil && len(lineBytes) == 0 {
			dispatch()
			if errors.Is(err, io.EOF) {
				return events, nil
			}
			return events, err
		}

		line := string(bytes.TrimRight(lineBytes, "\r\n"))
		if len(line) == 0 {
			dispatch()
			if err != nil {
				if errors.Is(err, io.EOF) {
					return events, nil
				}
				return events, err
			}
			continue
		}

		if strings.HasPrefix(line, ":") {
			if err != nil {
				dispatch()
				if errors.Is(err, io.EOF) {
					return events, nil
				}
				return events, err
			}
			continue
		}

		var field, value string
		colonIdx := strings.IndexByte(line, ':')
		if colonIdx >= 0 {
			field = line[:colonIdx]
			value = line[colonIdx+1:]
			if len(value) > 0 && value[0] == ' ' {
				value = value[1:]
			}
		} else {
			field = line
			value = ""
		}

		switch field {
		case "event":
			eventType = StreamEventType(value)
		case "data":
			hasData = true
			dataLines = append(dataLines, []byte(value))
		case "id":
			if !strings.ContainsRune(value, '\x00') {
				eventID = value
			}
		case "retry":
			if millis, parseErr := strconv.Atoi(strings.TrimSpace(value)); parseErr == nil && millis >= 0 {
				retryMillis = millis
			}
		}

		if err != nil {
			dispatch()
			if errors.Is(err, io.EOF) {
				return events, nil
			}
			return events, err
		}
	}
}
