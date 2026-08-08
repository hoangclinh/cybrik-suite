"""Pure callable rehearsal for the AI-to-Fabric-to-SOC ownership chain.

These tests start no process, listener, database, container, or product runtime. Product-owned
behavior is represented only by injected callables so the Suite remains an integration harness.
"""

from __future__ import annotations

import asyncio
import dataclasses

import pytest
from cybrik_suite_uat_mtls.callable_fabric_rehearsal import (
    CallableRehearsalDenied,
    rehearse_callable_fabric_resolution,
)


@dataclasses.dataclass(frozen=True, slots=True)
class _AiResolutionRequest:
    alert_id: str


@dataclasses.dataclass(frozen=True, slots=True)
class _FabricAuthority:
    grant_id: str


def test_rehearsal_preserves_product_ownership_without_minting_runtime_evidence() -> None:
    events: list[str] = []
    request = _AiResolutionRequest(alert_id="ALRT-1")
    authority = _FabricAuthority(grant_id="grant-readonly-1")

    def validate_authority(candidate_request: object, candidate_authority: object) -> None:
        events.append("fabric.validate_authority")
        assert candidate_request is request
        assert candidate_authority is authority

    async def soc_alert_owner(candidate_request: object) -> object:
        events.append("soc.resolve_alert_truth")
        assert candidate_request is request
        return {"alert_id": request.alert_id, "digest": "sha256:" + "a" * 64}

    async def fabric_resolver(candidate_request: object, candidate_authority: object) -> object:
        events.append("fabric.resolve_readonly")
        assert candidate_authority is authority
        return await soc_alert_owner(candidate_request)

    observation = asyncio.run(
        rehearse_callable_fabric_resolution(
            ai_resolution_request=request,
            fabric_authority=authority,
            validate_fabric_authority=validate_authority,
            resolve_through_fabric=fabric_resolver,
        )
    )

    assert events == [
        "fabric.validate_authority",
        "fabric.resolve_readonly",
        "soc.resolve_alert_truth",
    ]
    assert dataclasses.asdict(observation) == {
        "authority_validation_completed": True,
        "fabric_resolution_callable_completed": True,
        "non_none_resolution_returned": True,
    }


def test_rehearsal_rejects_ai_request_reused_as_fabric_authority() -> None:
    request = _AiResolutionRequest(alert_id="ALRT-1")

    with pytest.raises(CallableRehearsalDenied, match="distinct identity"):
        asyncio.run(
            rehearse_callable_fabric_resolution(
                ai_resolution_request=request,
                fabric_authority=request,
                validate_fabric_authority=lambda _request, _authority: None,
                resolve_through_fabric=lambda _request, _authority: _never_awaited(),
            )
        )


def test_rehearsal_fails_closed_when_fabric_returns_no_resolution() -> None:
    calls: list[str] = []

    def validate(_request: object, _authority: object) -> None:
        calls.append("validate")

    async def missing(_request: object, _authority: object) -> None:
        calls.append("resolve")

    with pytest.raises(CallableRehearsalDenied, match="no resolution"):
        asyncio.run(
            rehearse_callable_fabric_resolution(
                ai_resolution_request=_AiResolutionRequest(alert_id="ALRT-1"),
                fabric_authority=_FabricAuthority(grant_id="grant-readonly-1"),
                validate_fabric_authority=validate,
                resolve_through_fabric=missing,
            )
        )

    assert calls == ["validate", "resolve"]


async def _never_awaited() -> object:
    raise AssertionError("resolver must not run")


def test_authority_validation_denial_prevents_fabric_resolution() -> None:
    calls: list[str] = []

    def deny(_request: object, _authority: object) -> None:
        calls.append("validate")
        raise CallableRehearsalDenied("authority rejected")

    async def must_not_resolve(_request: object, _authority: object) -> object:
        calls.append("resolve")
        raise AssertionError("resolver must not run")

    with pytest.raises(CallableRehearsalDenied, match="authority rejected"):
        asyncio.run(
            rehearse_callable_fabric_resolution(
                ai_resolution_request=_AiResolutionRequest(alert_id="ALRT-1"),
                fabric_authority=_FabricAuthority(grant_id="grant-denied"),
                validate_fabric_authority=deny,
                resolve_through_fabric=must_not_resolve,
            )
        )

    assert calls == ["validate"]
