package client

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/hoangclinh/cybrik-suite/packages/cybrik-sdk-go/models"
	"github.com/hoangclinh/cybrik-suite/packages/cybrik-sdk-go/resilience"
)

func TestClient_GetAlert(t *testing.T) {
	expectedTime := time.Date(2026, 9, 7, 1, 0, 0, 0, time.UTC)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/alerts/alt-101" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(models.Alert{
			ID:        "alt-101",
			Title:     "Unauthorized S3 Access Attempt",
			Severity:  "HIGH",
			Status:    "active",
			Source:    "aws-cloudtrail",
			CreatedAt: expectedTime,
			Labels: map[string]string{
				"env": "prod",
			},
			Metadata: map[string]any{
				"account_id": "123456789012",
			},
		})
	}))
	defer server.Close()

	c, err := New(Config{
		BaseURL: server.URL,
	})
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	alert, err := c.GetAlert(context.Background(), "alt-101")
	if err != nil {
		t.Fatalf("GetAlert failed: %v", err)
	}

	if alert.ID != "alt-101" {
		t.Errorf("expected ID 'alt-101', got '%s'", alert.ID)
	}
	if alert.Title != "Unauthorized S3 Access Attempt" {
		t.Errorf("expected Title 'Unauthorized S3 Access Attempt', got '%s'", alert.Title)
	}
	if alert.Severity != "HIGH" {
		t.Errorf("expected Severity 'HIGH', got '%s'", alert.Severity)
	}
	if alert.Status != "active" {
		t.Errorf("expected Status 'active', got '%s'", alert.Status)
	}
	if alert.Source != "aws-cloudtrail" {
		t.Errorf("expected Source 'aws-cloudtrail', got '%s'", alert.Source)
	}
	if !alert.CreatedAt.Equal(expectedTime) {
		t.Errorf("expected CreatedAt %v, got %v", expectedTime, alert.CreatedAt)
	}
	if alert.Labels["env"] != "prod" {
		t.Errorf("expected label env=prod, got %v", alert.Labels)
	}
	if alert.Metadata["account_id"] != "123456789012" {
		t.Errorf("expected metadata account_id, got %v", alert.Metadata)
	}
}

func TestClient_ListAlerts(t *testing.T) {
	t.Run("ArrayResponse", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/api/v1/alerts" {
				t.Errorf("unexpected path: %s", r.URL.Path)
			}
			query := r.URL.Query()
			if query.Get("status") != "open" {
				t.Errorf("expected query status=open, got %s", query.Get("status"))
			}
			if query.Get("severity") != "CRITICAL" {
				t.Errorf("expected query severity=CRITICAL, got %s", query.Get("severity"))
			}
			if query.Get("limit") != "10" {
				t.Errorf("expected query limit=10, got %s", query.Get("limit"))
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]models.Alert{
				{ID: "alt-01", Title: "Alert 1", Status: "open", Severity: "CRITICAL"},
				{ID: "alt-02", Title: "Alert 2", Status: "open", Severity: "CRITICAL"},
			})
		}))
		defer server.Close()

		c, err := New(Config{BaseURL: server.URL})
		if err != nil {
			t.Fatalf("failed to create client: %v", err)
		}

		alerts, err := c.ListAlerts(
			context.Background(),
			WithStatus("open"),
			WithSeverity("CRITICAL"),
			WithLimit(10),
		)
		if err != nil {
			t.Fatalf("ListAlerts failed: %v", err)
		}
		if len(alerts) != 2 {
			t.Fatalf("expected 2 alerts, got %d", len(alerts))
		}
		if alerts[0].ID != "alt-01" || alerts[1].ID != "alt-02" {
			t.Errorf("unexpected alert IDs: %v", alerts)
		}
	})

	t.Run("EnvelopeResponse", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items": []models.Alert{
					{ID: "alt-10", Title: "Alert 10"},
				},
				"total": 1,
			})
		}))
		defer server.Close()

		c, err := New(Config{BaseURL: server.URL})
		if err != nil {
			t.Fatalf("failed to create client: %v", err)
		}

		alerts, err := c.ListAlerts(context.Background(), WithPage(1), WithPageSize(20))
		if err != nil {
			t.Fatalf("ListAlerts failed: %v", err)
		}
		if len(alerts) != 1 || alerts[0].ID != "alt-10" {
			t.Fatalf("unexpected alerts returned: %v", alerts)
		}
	})
}

func TestClient_GetCase(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/cases/case-555" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(models.Case{
			ID:        "case-555",
			Title:     "Ransomware Investigation",
			Status:    "investigating",
			Priority:  "critical",
			Assignee:  "analyst-42",
			Alerts:    []models.Alert{{ID: "alt-01", Title: "Alert 1"}},
			CreatedAt: now,
			UpdatedAt: now,
		})
	}))
	defer server.Close()

	c, err := New(Config{BaseURL: server.URL})
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	socCase, err := c.GetCase(context.Background(), "case-555")
	if err != nil {
		t.Fatalf("GetCase failed: %v", err)
	}
	if socCase.ID != "case-555" {
		t.Errorf("expected ID 'case-555', got '%s'", socCase.ID)
	}
	if socCase.Title != "Ransomware Investigation" {
		t.Errorf("expected Title 'Ransomware Investigation', got '%s'", socCase.Title)
	}
	if socCase.Status != "investigating" {
		t.Errorf("expected Status 'investigating', got '%s'", socCase.Status)
	}
	if socCase.Priority != "critical" {
		t.Errorf("expected Priority 'critical', got '%s'", socCase.Priority)
	}
	if socCase.Assignee != "analyst-42" {
		t.Errorf("expected Assignee 'analyst-42', got '%s'", socCase.Assignee)
	}
	if len(socCase.Alerts) != 1 {
		t.Errorf("expected 1 alert, got %d", len(socCase.Alerts))
	}
}

func TestClient_CreateCase(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/cases" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		var req CreateCaseRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request body: %v", err)
		}

		if req.Title != "Lateral Movement Incident" {
			t.Errorf("expected title 'Lateral Movement Incident', got '%s'", req.Title)
		}
		if req.Priority != "high" {
			t.Errorf("expected priority 'high', got '%s'", req.Priority)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(models.Case{
			ID:        "case-new-777",
			Title:     req.Title,
			Status:    "open",
			Priority:  req.Priority,
			Assignee:  req.Assignee,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}))
	defer server.Close()

	c, err := New(Config{BaseURL: server.URL})
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	created, err := c.CreateCase(context.Background(), CreateCaseRequest{
		Title:       "Lateral Movement Incident",
		Description: "Suspicious Kerberos ticket requests detected",
		Priority:    "high",
		Assignee:    "soc-lead",
		AlertIDs:    []string{"alt-1", "alt-2"},
	})
	if err != nil {
		t.Fatalf("CreateCase failed: %v", err)
	}
	if created.ID != "case-new-777" {
		t.Errorf("expected created ID 'case-new-777', got '%s'", created.ID)
	}
	if created.Title != "Lateral Movement Incident" {
		t.Errorf("expected Title 'Lateral Movement Incident', got '%s'", created.Title)
	}
}

func TestClient_ExecuteContainment(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/containment/execute" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		var req ContainmentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode containment request: %v", err)
		}
		if req.ActionType != "isolate_host" {
			t.Errorf("expected ActionType isolate_host, got %s", req.ActionType)
		}
		if req.Target != "192.168.1.50" {
			t.Errorf("expected Target 192.168.1.50, got %s", req.Target)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(models.Receipt{
			Digest:     "sha256:abcd1234ef5678",
			ActionType: req.ActionType,
			Status:     "completed",
			IsDryRun:   req.DryRun,
			Timestamp:  now,
			Signature:  "ed25519:sig-999",
		})
	}))
	defer server.Close()

	c, err := New(Config{BaseURL: server.URL})
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	receipt, err := c.ExecuteContainment(context.Background(), ContainmentRequest{
		ActionType: "isolate_host",
		Target:     "192.168.1.50",
		RiskTier:   "R2",
		DryRun:     false,
		Parameters: map[string]any{"force": true},
	})
	if err != nil {
		t.Fatalf("ExecuteContainment failed: %v", err)
	}
	if receipt.Digest != "sha256:abcd1234ef5678" {
		t.Errorf("expected Digest 'sha256:abcd1234ef5678', got '%s'", receipt.Digest)
	}
	if receipt.ActionType != "isolate_host" {
		t.Errorf("expected ActionType 'isolate_host', got '%s'", receipt.ActionType)
	}
	if receipt.Status != "completed" {
		t.Errorf("expected Status 'completed', got '%s'", receipt.Status)
	}
	if receipt.IsDryRun {
		t.Error("expected IsDryRun to be false")
	}
	if receipt.Signature != "ed25519:sig-999" {
		t.Errorf("expected Signature 'ed25519:sig-999', got '%s'", receipt.Signature)
	}
}

func TestClient_Health(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)

	t.Run("RootHealth", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/health" {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(models.HealthStatus{
				Status:    "healthy",
				Version:   "v1.0.0",
				Timestamp: now,
				Components: map[string]any{
					"soc":    "ok",
					"fabric": "ok",
					"ai":     "ok",
				},
			})
		}))
		defer server.Close()

		c, err := New(Config{BaseURL: server.URL})
		if err != nil {
			t.Fatalf("failed to create client: %v", err)
		}

		status, err := c.Health(context.Background())
		if err != nil {
			t.Fatalf("Health failed: %v", err)
		}
		if status.Status != "healthy" {
			t.Errorf("expected status 'healthy', got '%s'", status.Status)
		}
		if status.Version != "v1.0.0" {
			t.Errorf("expected version 'v1.0.0', got '%s'", status.Version)
		}
		if status.Components["soc"] != "ok" {
			t.Errorf("expected soc ok, got %v", status.Components)
		}
	})

	t.Run("FallbackApiV1Health", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			if r.URL.Path == "/api/v1/health" {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(models.HealthStatus{
					Status:  "healthy",
					Version: "v1.2.0",
				})
				return
			}
			http.NotFound(w, r)
		}))
		defer server.Close()

		c, err := New(Config{BaseURL: server.URL})
		if err != nil {
			t.Fatalf("failed to create client: %v", err)
		}

		status, err := c.Health(context.Background())
		if err != nil {
			t.Fatalf("Health fallback failed: %v", err)
		}
		if status.Status != "healthy" || status.Version != "v1.2.0" {
			t.Errorf("unexpected status: %+v", status)
		}
	})
}

func TestClient_AuthHeaders(t *testing.T) {
	t.Run("BearerToken", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader != "Bearer mock-token" {
				t.Errorf("expected 'Bearer mock-token', got '%s'", authHeader)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"status":"healthy","version":"1.0"}`)
		}))
		defer server.Close()

		c, err := New(Config{
			BaseURL:     server.URL,
			BearerToken: "mock-token",
		})
		if err != nil {
			t.Fatalf("failed to create client: %v", err)
		}

		_, err = c.Health(context.Background())
		if err != nil {
			t.Fatalf("Health request failed: %v", err)
		}
	})

	t.Run("APIKey", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKeyHeader := r.Header.Get("X-API-Key")
			if apiKeyHeader != "mock-key" {
				t.Errorf("expected X-API-Key 'mock-key', got '%s'", apiKeyHeader)
			}
			authHeader := r.Header.Get("Authorization")
			if authHeader != "Bearer mock-key" {
				t.Errorf("expected Authorization 'Bearer mock-key', got '%s'", authHeader)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"status":"healthy","version":"1.0"}`)
		}))
		defer server.Close()

		c, err := New(Config{
			BaseURL: server.URL,
			APIKey:  "mock-key",
		})
		if err != nil {
			t.Fatalf("failed to create client: %v", err)
		}

		_, err = c.Health(context.Background())
		if err != nil {
			t.Fatalf("Health request failed: %v", err)
		}
	})

	t.Run("CustomHeadersViaOptions", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-Tenant-ID") != "tenant-enterprise-1" {
				t.Errorf("expected X-Tenant-ID 'tenant-enterprise-1', got '%s'", r.Header.Get("X-Tenant-ID"))
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `[]`)
		}))
		defer server.Close()

		c, err := New(Config{BaseURL: server.URL})
		if err != nil {
			t.Fatalf("failed to create client: %v", err)
		}

		_, err = c.ListAlerts(context.Background(), WithHeader("X-Tenant-ID", "tenant-enterprise-1"))
		if err != nil {
			t.Fatalf("ListAlerts failed: %v", err)
		}
	})
}

func TestClient_CircuitBreakerIntegration(t *testing.T) {
	var requestCount int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requestCount, 1)
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, `{"error":"service unavailable"}`)
	}))
	defer server.Close()

	failureThreshold := 3
	recoveryTimeout := 50 * time.Millisecond

	policy := resilience.ResiliencePolicy{
		CircuitBreaker: resilience.CircuitBreakerConfig{
			FailureThreshold: failureThreshold,
			RecoveryTimeout:  recoveryTimeout,
			HalfOpenMaxCalls: 1,
		},
	}

	c, err := New(Config{
		BaseURL:          server.URL,
		ResiliencePolicy: &policy,
	})
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	ctx := context.Background()

	// 1. Send failureThreshold requests that fail with 503
	for i := 0; i < failureThreshold; i++ {
		_, err := c.GetAlert(ctx, "alt-test")
		if err == nil {
			t.Fatalf("call %d: expected error, got nil", i+1)
		}
		var apiErr *APIError
		if !errors.As(err, &apiErr) || apiErr.StatusCode != http.StatusServiceUnavailable {
			t.Fatalf("call %d: expected 503 APIError, got %v", i+1, err)
		}
	}

	// Verify server received exactly failureThreshold requests
	if atomic.LoadInt32(&requestCount) != int32(failureThreshold) {
		t.Fatalf("expected %d requests to server, got %d", failureThreshold, atomic.LoadInt32(&requestCount))
	}

	// Verify circuit breaker state transitioned to Open
	if c.CircuitBreaker().State() != resilience.Open {
		t.Fatalf("expected circuit breaker state Open, got %v", c.CircuitBreaker().State())
	}

	// 2. Next request should immediately fail fast with ErrCircuitBreakerOpen
	// WITHOUT reaching the network server!
	_, err = c.GetAlert(ctx, "alt-test")
	if !errors.Is(err, resilience.ErrCircuitBreakerOpen) {
		t.Fatalf("expected ErrCircuitBreakerOpen, got: %v", err)
	}

	// Server request count must remain unchanged
	if atomic.LoadInt32(&requestCount) != int32(failureThreshold) {
		t.Fatalf("circuit breaker did not fast-reject: server received extra request: count = %d", atomic.LoadInt32(&requestCount))
	}

	// 3. Wait for recovery timeout to elapse
	time.Sleep(recoveryTimeout + 20*time.Millisecond)

	// In HalfOpen, next trial call is allowed through.
	// Since server still returns 503, it should fail and trip immediately back to Open.
	_, err = c.GetAlert(ctx, "alt-test")
	if err == nil {
		t.Fatal("expected 503 error on trial probe call")
	}
	if c.CircuitBreaker().State() != resilience.Open {
		t.Fatalf("expected circuit breaker to trip back to Open after failed probe, got %v", c.CircuitBreaker().State())
	}
	if atomic.LoadInt32(&requestCount) != int32(failureThreshold+1) {
		t.Fatalf("expected %d server requests after probe call, got %d", failureThreshold+1, atomic.LoadInt32(&requestCount))
	}
}
