package models

import (
	"encoding/json"
	"testing"
	"time"
)

func TestModels_JSONSerialization(t *testing.T) {
	now := time.Date(2026, 9, 7, 1, 0, 0, 0, time.UTC)

	t.Run("Alert", func(t *testing.T) {
		alert := Alert{
			ID:        "alt-1",
			Title:     "DDoS Detection",
			Severity:  "CRITICAL",
			Status:    "active",
			Source:    "suricata",
			CreatedAt: now,
			Labels:    map[string]string{"env": "staging"},
			Metadata:  map[string]any{"source_ip": "10.0.0.1"},
		}

		data, err := json.Marshal(alert)
		if err != nil {
			t.Fatalf("failed to marshal alert: %v", err)
		}

		var decoded Alert
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("failed to unmarshal alert: %v", err)
		}

		if decoded.ID != alert.ID || decoded.Title != alert.Title || decoded.Severity != alert.Severity {
			t.Errorf("decoded alert mismatch: %+v", decoded)
		}
	})

	t.Run("Case", func(t *testing.T) {
		c := Case{
			ID:        "case-1",
			Title:     "Credential Theft",
			Status:    "open",
			Priority:  "high",
			Assignee:  "analyst-1",
			Alerts:    []Alert{{ID: "alt-1"}},
			CreatedAt: now,
			UpdatedAt: now,
		}

		data, err := json.Marshal(c)
		if err != nil {
			t.Fatalf("failed to marshal case: %v", err)
		}

		var decoded Case
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("failed to unmarshal case: %v", err)
		}

		if decoded.ID != c.ID || decoded.Title != c.Title || len(decoded.Alerts) != 1 {
			t.Errorf("decoded case mismatch: %+v", decoded)
		}
	})

	t.Run("ContainmentAction", func(t *testing.T) {
		action := ContainmentAction{
			ActionType:       "isolate_host",
			Target:           "10.0.0.99",
			Parameters:       map[string]any{"immediate": true},
			RiskTier:         "R3",
			RequiresApproval: true,
		}

		data, err := json.Marshal(action)
		if err != nil {
			t.Fatalf("failed to marshal containment action: %v", err)
		}

		var decoded ContainmentAction
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("failed to unmarshal containment action: %v", err)
		}

		if decoded.ActionType != action.ActionType || decoded.RequiresApproval != true {
			t.Errorf("decoded action mismatch: %+v", decoded)
		}
	})

	t.Run("Receipt", func(t *testing.T) {
		receipt := Receipt{
			Digest:     "sha256:789abc",
			ActionType: "block_ip",
			Status:     "completed",
			IsDryRun:   false,
			Timestamp:  now,
			Signature:  "ed25519:sig",
		}

		data, err := json.Marshal(receipt)
		if err != nil {
			t.Fatalf("failed to marshal receipt: %v", err)
		}

		var decoded Receipt
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("failed to unmarshal receipt: %v", err)
		}

		if decoded.Digest != receipt.Digest || decoded.Signature != receipt.Signature {
			t.Errorf("decoded receipt mismatch: %+v", decoded)
		}
	})

	t.Run("HealthStatus", func(t *testing.T) {
		health := HealthStatus{
			Status:    "healthy",
			Version:   "1.0.0",
			Timestamp: now,
			Components: map[string]any{
				"soc": "ok",
			},
		}

		data, err := json.Marshal(health)
		if err != nil {
			t.Fatalf("failed to marshal health: %v", err)
		}

		var decoded HealthStatus
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("failed to unmarshal health: %v", err)
		}

		if decoded.Status != "healthy" || decoded.Version != "1.0.0" {
			t.Errorf("decoded health mismatch: %+v", decoded)
		}
	})
}
