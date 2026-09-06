"""Pydantic data models for CYBRIK Unified SDK."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Case(BaseModel):
    """Authoritative SOC incident case record."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str = Field(description="Unique case identifier or UUID")
    title: str = Field(description="Case title or headline")
    description: str | None = Field(default=None, description="Detailed case narrative")
    priority: str = Field(
        default="medium", description="Priority level: low, medium, high, critical"
    )
    status: str = Field(
        default="open", description="Case status: open, investigating, resolved, closed"
    )
    owner_membership_id: str | None = Field(
        default=None, description="Assigned analyst membership ID"
    )
    created_by_membership_id: str | None = Field(default=None, description="Creator membership ID")
    closure_reason: str | None = Field(default=None, description="Rationale for closing case")
    resolution_summary: str | None = Field(
        default=None, description="Resolution post-mortem summary"
    )
    closed_at: str | None = Field(default=None, description="ISO timestamp when closed")
    version: int = Field(default=1, description="Optimistic locking version")
    created_at: str | None = Field(default=None, description="ISO timestamp when created")


class ContainmentRequest(BaseModel):
    """SOAR containment action invocation request."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    action: str = Field(
        description="Action type (e.g. isolate_host, block_ip, revoke_user_session)"
    )
    params: dict[str, Any] = Field(default_factory=dict, description="Action-specific parameters")
    tenant_id: str | None = Field(default=None, description="Authoritative tenant identifier")
    actor_id: str | None = Field(default=None, description="Executing actor identity")
    reason: str | None = Field(
        default=None, description="Auditable rationale for containment execution"
    )
    dry_run: bool = Field(
        default=False, description="Simulate action execution without active side-effects"
    )
    approval_lease_id: str | None = Field(
        default=None, description="Four-Eyes approval lease token ID"
    )


class ContainmentReceipt(BaseModel):
    """Authoritative execution receipt for a SOAR containment action."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    receipt_id: str = Field(description="Unique receipt identifier")
    action_type: str = Field(description="Containment action executed")
    risk_tier: str = Field(default="MEDIUM", description="Risk tier: LOW, MEDIUM, HIGH, CRITICAL")
    target_entity: str = Field(default="", description="Target host, IP, user, or domain")
    tenant_id: str = Field(default="default", description="Authoritative tenant identifier")
    dry_run: bool = Field(default=False, description="Whether execution was a dry run")
    status: str = Field(
        default="completed", description="Execution status: completed, failed, denied"
    )
    executed_at: str | None = Field(default=None, description="ISO timestamp when action executed")
    parameters_digest: str | None = Field(
        default=None, description="RFC 8785 SHA-256 canonical digest of parameters"
    )
    rollback_available: bool = Field(default=False, description="Whether action is reversible")
    rollback_action_type: str | None = Field(
        default=None, description="Inverse action type for rollback"
    )
    approval_lease_id: str | None = Field(
        default=None, description="Approval lease reference if required"
    )
    signature: str | None = Field(default=None, description="Ed25519 detached digital signature")
    signing_key_id: str | None = Field(
        default=None, description="Key identifier used for receipt signing"
    )


class BenchmarkReport(BaseModel):
    """Empirical AI model benchmark evaluation report."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    benchmark_id: str = Field(description="Canonical benchmark execution identifier")
    workstream: str = Field(default="WS-08", description="Workstream identifier")
    target_release: str = Field(default="v1.0.0-rc1", description="Target software release version")
    status: str = Field(
        default="QUALIFIED", description="Benchmark status: QUALIFIED, FAILED, RUNNING"
    )
    model_name: str = Field(default="qwen3.6:27b-q4_K_M", description="Model name under benchmark")
    overall_fidelity_score: float = Field(
        default=1.0, description="Composite reasoning fidelity score (0.0 - 1.0)"
    )
    timestamp: str | None = Field(default=None, description="ISO timestamp of benchmark completion")
    metrics: dict[str, Any] = Field(
        default_factory=dict, description="Hardware latency, TPS, and memory metrics"
    )
    scenarios: list[dict[str, Any]] = Field(
        default_factory=list, description="Evaluated test scenarios and outcomes"
    )
    details: dict[str, Any] = Field(
        default_factory=dict, description="Additional evaluation breakdown"
    )
