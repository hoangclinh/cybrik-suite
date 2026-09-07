package streaming

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// StreamingClient manages real-time event stream subscriptions for the CYBRIK Platform.
type StreamingClient struct {
	config     StreamConfig
	httpClient *http.Client
}

// NewStreamingClient creates and initializes a new StreamingClient instance with validated settings.
func NewStreamingClient(cfg StreamConfig) (*StreamingClient, error) {
	trimmedURL := strings.TrimSpace(cfg.BaseURL)
	if trimmedURL == "" {
		return nil, errors.New("baseURL is required")
	}

	u, err := url.Parse(trimmedURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, fmt.Errorf("invalid baseURL %q: must be an absolute URL with scheme and host", cfg.BaseURL)
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

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: 0, // Streaming connections must not have global request timeouts
		}
	} else if httpClient.Timeout != 0 {
		cloned := *httpClient
		cloned.Timeout = 0
		httpClient = &cloned
	}

	return &StreamingClient{
		config:     cfg,
		httpClient: httpClient,
	}, nil
}

// Config returns a copy of the client configuration.
func (c *StreamingClient) Config() StreamConfig {
	return c.config
}

// SubscribeAlerts subscribes to the real-time alert event stream matching the provided filter criteria.
func (c *StreamingClient) SubscribeAlerts(ctx context.Context, filter AlertFilter) (AlertStreamer, error) {
	endpoint := "/api/v1/alerts/stream"
	if filter.Endpoint != "" {
		endpoint = filter.Endpoint
	} else if c.config.Endpoint != "" {
		endpoint = c.config.Endpoint
	}

	baseURL := strings.TrimRight(c.config.BaseURL, "/")
	var fullURL string
	if strings.HasPrefix(endpoint, "http://") || strings.HasPrefix(endpoint, "https://") {
		fullURL = endpoint
	} else {
		if !strings.HasPrefix(endpoint, "/") {
			endpoint = "/" + endpoint
		}
		fullURL = baseURL + endpoint
	}

	params := filter.ToQueryParams()
	if len(params) > 0 {
		if strings.Contains(fullURL, "?") {
			fullURL += "&" + params.Encode()
		} else {
			fullURL += "?" + params.Encode()
		}
	}

	cfg := c.config
	if filter.TenantID != "" {
		cfg.TenantID = filter.TenantID
	}
	cfg.HTTPClient = c.httpClient

	return NewSSEStreamer(ctx, fullURL, cfg)
}

// Subscribe opens a generic real-time SSE stream at the specified endpoint with optional query parameters.
func (c *StreamingClient) Subscribe(ctx context.Context, endpoint string, params url.Values) (AlertStreamer, error) {
	baseURL := strings.TrimRight(c.config.BaseURL, "/")
	var fullURL string
	if strings.HasPrefix(endpoint, "http://") || strings.HasPrefix(endpoint, "https://") {
		fullURL = endpoint
	} else {
		if !strings.HasPrefix(endpoint, "/") {
			endpoint = "/" + endpoint
		}
		fullURL = baseURL + endpoint
	}

	if len(params) > 0 {
		if strings.Contains(fullURL, "?") {
			fullURL += "&" + params.Encode()
		} else {
			fullURL += "?" + params.Encode()
		}
	}

	cfg := c.config
	cfg.HTTPClient = c.httpClient

	return NewSSEStreamer(ctx, fullURL, cfg)
}
