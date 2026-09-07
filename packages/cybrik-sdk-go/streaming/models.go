package streaming

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"time"
)

// StreamEventType denotes the semantic classification of a real-time stream event.
type StreamEventType string

const (
	// AlertCreated signifies a newly ingested and indexed security alert.
	AlertCreated StreamEventType = "alert.created"
	// AlertUpdated signifies an update to an existing alert's triage status, severity, or disposition.
	AlertUpdated StreamEventType = "alert.updated"
	// CaseOpened signifies a new SOC incident case opened from one or more alerts.
	CaseOpened StreamEventType = "case.opened"
	// Heartbeat signifies a periodic keep-alive ping emitted by the streaming broker.
	Heartbeat StreamEventType = "heartbeat"
)

// StreamEvent represents a single Server-Sent Event delivered over the streaming channel.
type StreamEvent struct {
	ID          string          `json:"id,omitempty"`
	Event       StreamEventType `json:"event,omitempty"`
	Data        []byte          `json:"data,omitempty"`
	Timestamp   time.Time       `json:"timestamp"`
	RetryMillis int             `json:"retry_millis,omitempty"`
}

// Unmarshal decodes the raw event Data payload into the target value.
func (e *StreamEvent) Unmarshal(v any) error {
	if len(e.Data) == 0 {
		return errors.New("stream event data is empty")
	}
	return json.Unmarshal(e.Data, v)
}

// StreamConfig encapsulates settings for real-time SSE stream connections and resilience policies.
type StreamConfig struct {
	BaseURL              string        `json:"base_url"`
	AuthToken            string        `json:"auth_token,omitempty"`
	TenantID             string        `json:"tenant_id,omitempty"`
	MaxReconnectAttempts int           `json:"max_reconnect_attempts,omitempty"`
	InitialBackoff       time.Duration `json:"initial_backoff,omitempty"`
	MaxBackoff           time.Duration `json:"max_backoff,omitempty"`
	HTTPClient           *http.Client  `json:"-"`
	Endpoint             string        `json:"endpoint,omitempty"`
}

// AlertFilter defines criteria for filtering real-time alert event subscriptions.
type AlertFilter struct {
	Severity string            `json:"severity,omitempty"`
	Status   string            `json:"status,omitempty"`
	Source   string            `json:"source,omitempty"`
	TenantID string            `json:"tenant_id,omitempty"`
	Since    time.Time         `json:"since,omitempty"`
	Labels   map[string]string `json:"labels,omitempty"`
	Endpoint string            `json:"endpoint,omitempty"`
}

// ToQueryParams converts the AlertFilter into standard URL query parameters.
func (f AlertFilter) ToQueryParams() url.Values {
	values := make(url.Values)
	if f.Severity != "" {
		values.Set("severity", f.Severity)
	}
	if f.Status != "" {
		values.Set("status", f.Status)
	}
	if f.Source != "" {
		values.Set("source", f.Source)
	}
	if f.TenantID != "" {
		values.Set("tenant_id", f.TenantID)
	}
	if !f.Since.IsZero() {
		values.Set("since", f.Since.Format(time.RFC3339))
	}
	for k, v := range f.Labels {
		if k != "" && v != "" {
			values.Set("label."+k, v)
		}
	}
	return values
}
