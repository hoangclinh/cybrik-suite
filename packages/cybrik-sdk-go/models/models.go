package models

import "time"

// Alert represents an authoritative CYBRIK security detection alert.
type Alert struct {
	ID        string            `json:"id"`
	Title     string            `json:"title"`
	Severity  string            `json:"severity"`
	Status    string            `json:"status"`
	Source    string            `json:"source"`
	CreatedAt time.Time         `json:"created_at"`
	Labels    map[string]string `json:"labels,omitempty"`
	Metadata  map[string]any    `json:"metadata,omitempty"`
}

// Case represents an authoritative SOC incident investigation case record.
type Case struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
	Priority  string    `json:"priority"`
	Assignee  string    `json:"assignee,omitempty"`
	Alerts    []Alert   `json:"alerts,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ContainmentAction defines a SOAR containment action descriptor.
type ContainmentAction struct {
	ActionType       string         `json:"action_type"`
	Target           string         `json:"target"`
	Parameters       map[string]any `json:"parameters,omitempty"`
	RiskTier         string         `json:"risk_tier"`
	RequiresApproval bool           `json:"requires_approval"`
}

// Receipt represents an authoritative execution receipt for a SOAR action.
type Receipt struct {
	Digest     string    `json:"digest"`
	ActionType string    `json:"action_type"`
	Status     string    `json:"status"`
	IsDryRun   bool      `json:"is_dry_run"`
	Timestamp  time.Time `json:"timestamp"`
	Signature  string    `json:"signature"`
}

// HealthStatus represents service or aggregate platform health status.
type HealthStatus struct {
	Status     string         `json:"status"`
	Version    string         `json:"version"`
	Components map[string]any `json:"components,omitempty"`
	Timestamp  time.Time      `json:"timestamp"`
}

// CreateCaseRequest encapsulates parameters for creating a new SOC case.
type CreateCaseRequest struct {
	Title       string            `json:"title"`
	Description string            `json:"description,omitempty"`
	Priority    string            `json:"priority,omitempty"`
	Assignee    string            `json:"assignee,omitempty"`
	AlertIDs    []string          `json:"alert_ids,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	Metadata    map[string]any    `json:"metadata,omitempty"`
}

// ContainmentRequest encapsulates parameters for invoking SOAR containment execution.
type ContainmentRequest struct {
	ActionType      string         `json:"action_type"`
	Target          string         `json:"target,omitempty"`
	Parameters      map[string]any `json:"parameters,omitempty"`
	RiskTier        string         `json:"risk_tier,omitempty"`
	DryRun          bool           `json:"dry_run,omitempty"`
	Reason          string         `json:"reason,omitempty"`
	TenantID        string         `json:"tenant_id,omitempty"`
	ActorID         string         `json:"actor_id,omitempty"`
	ApprovalLeaseID string         `json:"approval_lease_id,omitempty"`
}
