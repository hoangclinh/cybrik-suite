package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/hoangclinh/cybrik-suite/packages/cybrik-sdk-go/models"
	"github.com/hoangclinh/cybrik-suite/packages/cybrik-sdk-go/resilience"
)

// Re-export core request models and resilience types for convenience
type CreateCaseRequest = models.CreateCaseRequest
type ContainmentRequest = models.ContainmentRequest
type ResiliencePolicy = resilience.ResiliencePolicy

// ErrCircuitBreakerOpen is returned when a request is blocked by an open circuit breaker.
var ErrCircuitBreakerOpen = resilience.ErrCircuitBreakerOpen

// Config holds client initialization and authentication settings.
type Config struct {
	BaseURL          string
	APIKey           string
	BearerToken      string
	Timeout          time.Duration
	ResiliencePolicy *resilience.ResiliencePolicy
	HTTPClient       *http.Client
}

// APIError represents an error response returned by the CYBRIK API.
type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("cybrik api error: status %d: %s", e.StatusCode, e.Body)
}

// Client is the official Go SDK client for the CYBRIK Platform.
type Client struct {
	baseURL        string
	httpClient     *http.Client
	circuitBreaker *resilience.CircuitBreaker
	config         Config
}

// New creates and initializes a new CYBRIK Client.
func New(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return nil, errors.New("baseURL is required")
	}

	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")

	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: timeout,
		}
	}

	policy := resilience.DefaultResiliencePolicy()
	if cfg.ResiliencePolicy != nil {
		policy = *cfg.ResiliencePolicy
	}

	cb := resilience.NewCircuitBreaker(policy.CircuitBreaker)

	return &Client{
		baseURL:        baseURL,
		httpClient:     httpClient,
		circuitBreaker: cb,
		config:         cfg,
	}, nil
}

// CircuitBreaker returns the underlying circuit breaker instance.
func (c *Client) CircuitBreaker() *resilience.CircuitBreaker {
	return c.circuitBreaker
}

// buildHeaders sets authentication and default headers on outgoing requests.
func (c *Client) buildHeaders(req *http.Request, opts *RequestOptions) {
	req.Header.Set("User-Agent", "cybrik-sdk-go/0.1.0")
	req.Header.Set("Accept", "application/json")

	if c.config.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.BearerToken)
	} else if c.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	}

	if c.config.APIKey != "" {
		req.Header.Set("X-API-Key", c.config.APIKey)
	}

	if opts != nil && opts.Headers != nil {
		for k, values := range opts.Headers {
			for _, v := range values {
				req.Header.Add(k, v)
			}
		}
	}
}

// do executes an HTTP request subject to circuit breaker policy and authentication headers.
func (c *Client) do(ctx context.Context, method, endpoint string, body any, opts *RequestOptions) ([]byte, error) {
	if c.circuitBreaker != nil && !c.circuitBreaker.CanExecute() {
		return nil, resilience.ErrCircuitBreakerOpen
	}

	targetURL := c.baseURL + endpoint
	if opts != nil && len(opts.Params) > 0 {
		targetURL += "?" + opts.Params.Encode()
	}

	var bodyReader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, targetURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	c.buildHeaders(req, opts)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		if c.circuitBreaker != nil {
			c.circuitBreaker.RecordFailure()
		}
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		if c.circuitBreaker != nil {
			c.circuitBreaker.RecordFailure()
		}
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode >= 500 {
		if c.circuitBreaker != nil {
			c.circuitBreaker.RecordFailure()
		}
		return nil, &APIError{
			StatusCode: resp.StatusCode,
			Body:       string(respBody),
		}
	}

	// 2xx and 4xx mean the downstream service was reachable and healthy
	if c.circuitBreaker != nil {
		c.circuitBreaker.RecordSuccess()
	}

	if resp.StatusCode >= 400 {
		return nil, &APIError{
			StatusCode: resp.StatusCode,
			Body:       string(respBody),
		}
	}

	return respBody, nil
}

// GetAlert retrieves a single alert by identifier.
func (c *Client) GetAlert(ctx context.Context, id string) (*models.Alert, error) {
	endpoint := fmt.Sprintf("/api/v1/alerts/%s", url.PathEscape(id))
	body, err := c.do(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return nil, err
	}

	var alert models.Alert
	if err := json.Unmarshal(body, &alert); err != nil {
		return nil, fmt.Errorf("decode alert: %w", err)
	}
	return &alert, nil
}

// ListAlerts lists alerts with optional filtering and pagination.
func (c *Client) ListAlerts(ctx context.Context, opts ...ListOption) ([]models.Alert, error) {
	reqOpts := NewRequestOptions(opts...)
	body, err := c.do(ctx, http.MethodGet, "/api/v1/alerts", nil, reqOpts)
	if err != nil {
		return nil, err
	}

	// Support array response format
	var list []models.Alert
	if err := json.Unmarshal(body, &list); err == nil {
		return list, nil
	}

	// Support wrapped envelope format {"items": [...]} or {"alerts": [...]}
	var envelope struct {
		Items  []models.Alert `json:"items"`
		Alerts []models.Alert `json:"alerts"`
	}
	if err := json.Unmarshal(body, &envelope); err == nil {
		if len(envelope.Alerts) > 0 {
			return envelope.Alerts, nil
		}
		return envelope.Items, nil
	}

	return nil, errors.New("decode alerts: unexpected response structure")
}

// GetCase retrieves a single SOC incident case by identifier.
func (c *Client) GetCase(ctx context.Context, id string) (*models.Case, error) {
	endpoint := fmt.Sprintf("/api/v1/cases/%s", url.PathEscape(id))
	body, err := c.do(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return nil, err
	}

	var socCase models.Case
	if err := json.Unmarshal(body, &socCase); err != nil {
		return nil, fmt.Errorf("decode case: %w", err)
	}
	return &socCase, nil
}

// CreateCase creates a new SOC incident case.
func (c *Client) CreateCase(ctx context.Context, req CreateCaseRequest) (*models.Case, error) {
	body, err := c.do(ctx, http.MethodPost, "/api/v1/cases", req, nil)
	if err != nil {
		return nil, err
	}

	var socCase models.Case
	if err := json.Unmarshal(body, &socCase); err != nil {
		return nil, fmt.Errorf("decode created case: %w", err)
	}
	return &socCase, nil
}

// ExecuteContainment invokes a SOAR containment action, returning an execution receipt.
func (c *Client) ExecuteContainment(ctx context.Context, req ContainmentRequest) (*models.Receipt, error) {
	body, err := c.do(ctx, http.MethodPost, "/api/v1/containment/execute", req, nil)
	if err != nil {
		return nil, err
	}

	var receipt models.Receipt
	if err := json.Unmarshal(body, &receipt); err != nil {
		return nil, fmt.Errorf("decode containment receipt: %w", err)
	}
	return &receipt, nil
}

// Health checks platform health status.
func (c *Client) Health(ctx context.Context) (*models.HealthStatus, error) {
	body, err := c.do(ctx, http.MethodGet, "/health", nil, nil)
	if err != nil {
		// Fallback to /api/v1/health if /health returned a 404 error
		var apiErr *APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusNotFound {
			body, err = c.do(ctx, http.MethodGet, "/api/v1/health", nil, nil)
		}
		if err != nil {
			return nil, err
		}
	}

	var status models.HealthStatus
	if err := json.Unmarshal(body, &status); err != nil {
		return nil, fmt.Errorf("decode health status: %w", err)
	}
	return &status, nil
}
