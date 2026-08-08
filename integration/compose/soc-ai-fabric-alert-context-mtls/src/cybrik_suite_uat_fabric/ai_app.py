"""Suite-owned UAT ingress for the pinned Cyber AI summarization service.

This is composition-only test infrastructure.  It creates no production API and
never treats request headers, certificate subjects, or request-body fields as
identity.  The authoritative ``CredentialContext`` is selected only by the
exact SHA-256 fingerprint in the server-owned TLS extension.
"""

from __future__ import annotations

import copy
import hashlib
import json
import re
import threading
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Protocol

from cybrik_ai_api.summarize import (
    AlertContext,
    AlertContextResolutionRequest,
    SummarizationDeps,
    SummarizationService,
)
from cybrik_ai_api.summarize.service import RedactedAlert
from cybrik_ai_core.contract.common import (
    Classification,
    DataMarking,
    HealthState,
    RedactionApplied,
    RedactionPolicy,
    Tlp,
    TokenLimits,
)
from cybrik_ai_core.contract.inference import ModelCapability, ModelHealth
from cybrik_ai_core.contract.summarization import AlertSummarizationRequest
from cybrik_ai_core.errors import InferenceDenied
from cybrik_ai_core.modelrt.port import ModelRuntime
from cybrik_ai_core.policy import CredentialContext
from cybrik_fabric_control.contracts import invocation, jcs
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .tls_process import TlsBoundaryFailure, peer_authority_from_scope

_SHA256 = re.compile(r"sha256:[0-9a-f]{64}\Z")
_FINGERPRINT = re.compile(r"[0-9a-f]{64}\Z")
_RECEIPT_PATH = re.compile(r"/api/v1/receipts/[A-Za-z0-9._:-]{1,200}\Z")
_ROUTE = "/uat/v1/summarizations"
_METRICS_ROUTE = "/uat/v1/metrics"


class FabricResponse(Protocol):
    status_code: int

    def json(self) -> object: ...


class AsyncFabricClient(Protocol):
    async def post(
        self,
        path: str,
        *,
        json: Mapping[str, Any],
        headers: Mapping[str, str],
    ) -> FabricResponse: ...

    async def get(self, path: str) -> FabricResponse: ...


class HttpxAsyncFabricClient:
    """Narrow an injected async HTTP client to Fabric's exact two-route surface."""

    def __init__(self, client: object) -> None:
        if not callable(getattr(client, "post", None)) or not callable(
            getattr(client, "get", None)
        ):
            raise TypeError("async HTTP client is incomplete")
        self._client = client

    async def post(
        self,
        path: str,
        *,
        json: Mapping[str, Any],
        headers: Mapping[str, str],
    ) -> FabricResponse:
        if path != "/api/v1/invocations":
            raise ValueError("fabric route is not admitted")
        body = copy.deepcopy(dict(json))
        isolated_headers = copy.deepcopy(dict(headers))
        if set(isolated_headers) != {"Idempotency-Key"} or isolated_headers[
            "Idempotency-Key"
        ] != body.get("idempotency_key"):
            raise ValueError("fabric idempotency binding is invalid")
        return await self._client.post(
            path,
            json=body,
            headers=isolated_headers,
        )

    async def get(self, path: str) -> FabricResponse:
        if _RECEIPT_PATH.fullmatch(path) is None:
            raise ValueError("fabric route is not admitted")
        return await self._client.get(path)


class _CountingModelRuntime:
    """Narrow UAT-only counter around the injected product runtime port."""

    def __init__(self, runtime: ModelRuntime) -> None:
        self._runtime = runtime
        self._lock = threading.Lock()
        self._model_calls = 0

    @property
    def name(self) -> str:
        return self._runtime.name

    @property
    def model_calls(self) -> int:
        with self._lock:
            return self._model_calls

    async def agenerate(self, request: object) -> object:
        with self._lock:
            self._model_calls += 1
        return await self._runtime.agenerate(request)

    async def capabilities(self, model: str) -> object:
        return await self._runtime.capabilities(model)

    async def health(self) -> object:
        return await self._runtime.health()


@dataclass(frozen=True, slots=True)
class FabricResolutionPolicy:
    """UAT-only copies of separately issued Fabric authority bindings."""

    org_scope: Mapping[str, Any]
    clearance: Mapping[str, Any]
    capability: Mapping[str, str]
    policy_digest: str
    delegation_ref: str
    purpose: str
    requested_at: Callable[[], str]

    def __post_init__(self) -> None:
        org_scope = copy.deepcopy(dict(self.org_scope))
        clearance = copy.deepcopy(dict(self.clearance))
        capability = copy.deepcopy(dict(self.capability))
        if set(capability) != {"name", "version", "digest"}:
            raise ValueError("fabric capability pin is incomplete")
        if (
            capability["name"] != "soc.get_alert_context"
            or capability["version"] != "0.1.0"
        ):
            raise ValueError("only the read-only alert-context capability is admitted")
        for digest in (capability["digest"], self.policy_digest, self.delegation_ref):
            if not isinstance(digest, str) or _SHA256.fullmatch(digest) is None:
                raise ValueError("fabric policy carries an invalid digest")
        if not isinstance(self.purpose, str) or not self.purpose:
            raise ValueError("fabric policy purpose is invalid")
        if not callable(self.requested_at):
            raise TypeError("requested_at must be injected")
        object.__setattr__(self, "org_scope", MappingProxyType(org_scope))
        object.__setattr__(self, "clearance", MappingProxyType(clearance))
        object.__setattr__(self, "capability", MappingProxyType(capability))


class PinnedDriverCredentialResolver:
    """Resolve one credential from an exact TLS leaf fingerprint allowlist."""

    def __init__(self, expected_fingerprints: Mapping[str, Mapping[str, str]]) -> None:
        admitted: dict[str, CredentialContext] = {}
        for fingerprint, principal in expected_fingerprints.items():
            if _FINGERPRINT.fullmatch(fingerprint) is None or fingerprint in admitted:
                raise ValueError("driver fingerprint allowlist is invalid")
            if set(principal) != {"tenant_id", "actor_id"}:
                raise ValueError(
                    "driver principal must contain only tenant_id and actor_id"
                )
            admitted[fingerprint] = CredentialContext(
                tenant_id=principal["tenant_id"], actor_id=principal["actor_id"]
            )
        if not admitted:
            raise ValueError("at least one driver fingerprint is required")
        self._admitted = admitted

    def resolve(self, request: Request) -> CredentialContext:
        return self.resolve_scope(request.scope)

    def resolve_scope(self, scope: Mapping[str, Any]) -> CredentialContext:
        try:
            authority = peer_authority_from_scope(
                scope,
                {fingerprint: fingerprint for fingerprint in self._admitted},
            )
        except TlsBoundaryFailure:
            raise PermissionError("client certificate is not admitted") from None
        credential = self._admitted.get(authority.certificate_sha256)
        if credential is None:
            raise PermissionError("client certificate is not admitted")
        return CredentialContext(
            tenant_id=credential.tenant_id,
            actor_id=credential.actor_id,
        )


def _action_id(idempotency_key: str) -> str:
    return "act-" + hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()


def _actor(credential: CredentialContext) -> dict[str, str]:
    return {
        "type": "agent",
        "id": credential.actor_id,
        "tenant_id": credential.tenant_id,
    }


def _fabric_request(
    resolution: AlertContextResolutionRequest,
    *,
    credential: CredentialContext,
    policy: FabricResolutionPolicy,
) -> dict[str, Any]:
    marking = {
        "classification": resolution.data_marking.classification.value,
        "tlp": resolution.data_marking.tlp.value,
    }
    alert_ref = resolution.alert_ref.model_dump(mode="json", exclude_none=True)
    return {
        "action_id": _action_id(resolution.idempotency_key),
        "idempotency_key": resolution.idempotency_key,
        "tenant_id": credential.tenant_id,
        "actor": _actor(credential),
        "purpose": policy.purpose,
        "delegation_ref": policy.delegation_ref,
        "capability": copy.deepcopy(dict(policy.capability)),
        "arguments": {
            "request_id": resolution.request_id,
            "org_scope": copy.deepcopy(dict(policy.org_scope)),
            "clearance": copy.deepcopy(dict(policy.clearance)),
            "alert_ref": alert_ref,
            "policy_digest": policy.policy_digest,
            "requested_at": policy.requested_at(),
        },
        "data_marking": marking,
        "execution": {"mode": "execute", "deadline_seconds": 10},
    }


def _mapping(value: object, message: str) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError(message)
    return copy.deepcopy(dict(value))


def _response_document(
    response: FabricResponse, expected_status: int
) -> dict[str, Any]:
    if response.status_code != expected_status:
        raise RuntimeError("fabric response was not admitted")
    try:
        return _mapping(response.json(), "fabric response is not a document")
    except (TypeError, ValueError, json.JSONDecodeError):
        raise RuntimeError("fabric response is not a document") from None


def _base_capability(document: object) -> dict[str, Any]:
    capability = _mapping(document, "fabric capability binding is absent")
    return {key: capability.get(key) for key in ("name", "version", "digest")}


def _validate_fabric_result(
    result: Mapping[str, Any],
    request_body: Mapping[str, Any],
    policy: FabricResolutionPolicy,
) -> tuple[str, dict[str, Any]]:
    if (
        result.get("status") != "completed"
        or result.get("action_id") != request_body["action_id"]
        or result.get("tenant_id") != request_body["tenant_id"]
        or not isinstance(result.get("receipt_id"), str)
        or not isinstance(result.get("policy_decision_id"), str)
        or not result.get("policy_decision_id")
        or result.get("output_artifacts") != []
    ):
        raise RuntimeError("fabric result binding mismatch")
    output = _mapping(result.get("output"), "fabric output is absent")
    if output.get("truncated") is not False or output.get(
        "output_digest"
    ) != jcs.digest(invocation.bound_output_projection(dict(result))):
        raise RuntimeError("fabric output binding mismatch")
    data = _mapping(output.get("data"), "fabric business result is absent")
    binding = _mapping(
        data.get("authorization_binding"), "fabric authorization binding is absent"
    )
    expected_actor = request_body["actor"]
    expected_scope = request_body["arguments"]["org_scope"]
    expected_clearance = request_body["arguments"]["clearance"]
    if (
        data.get("outcome") != "available"
        or data.get("request_id") != request_body["arguments"]["request_id"]
        or data.get("idempotency_key") != request_body["idempotency_key"]
        or data.get("tenant_id") != request_body["tenant_id"]
        or data.get("authorized_actor") != expected_actor
        or data.get("org_scope") != expected_scope
        or data.get("clearance") != expected_clearance
        or data.get("policy_digest") != policy.policy_digest
        or data.get("alert_ref") != request_body["arguments"]["alert_ref"]
        or _base_capability(data.get("capability")) != dict(policy.capability)
        or binding.get("tenant_id") != request_body["tenant_id"]
        or binding.get("actor") != expected_actor
        or binding.get("org_scope") != expected_scope
        or binding.get("policy_digest") != policy.policy_digest
        or _base_capability(binding.get("capability")) != dict(policy.capability)
    ):
        raise RuntimeError("fabric business binding mismatch")
    context = _mapping(data.get("context"), "fabric returned no alert context")
    marking = _mapping(data.get("data_marking"), "fabric returned no data marking")
    context_digest = data.get("context_digest")
    if not isinstance(context_digest, str) or context_digest != jcs.digest(
        invocation.available_result_projection(data)
    ):
        raise RuntimeError("fabric context binding mismatch")
    return str(result["receipt_id"]), {"context": context, "marking": marking}


def _validate_receipt(
    receipt: Mapping[str, Any],
    *,
    receipt_id: str,
    result: Mapping[str, Any],
    request_body: Mapping[str, Any],
    policy: FabricResolutionPolicy,
) -> None:
    expected_arguments = jcs.digest(
        invocation.resolved_arguments_projection(dict(request_body))
    )
    if (
        receipt.get("receipt_id") != receipt_id
        or receipt.get("action_id") != request_body["action_id"]
        or receipt.get("tenant_id") != request_body["tenant_id"]
        or receipt.get("status") != "completed"
        or receipt.get("policy_decision_id") != result.get("policy_decision_id")
        or receipt.get("delegation_ref") != policy.delegation_ref
        or receipt.get("resolved_arguments_digest") != expected_arguments
        or _base_capability(receipt.get("capability")) != dict(policy.capability)
        or receipt.get("side_effect") != {"performed": False}
        or not isinstance(receipt.get("signature"), str)
        or not receipt.get("signature")
        or not isinstance(receipt.get("receipt_digest"), str)
        or _SHA256.fullmatch(str(receipt.get("receipt_digest"))) is None
    ):
        raise RuntimeError("fabric receipt binding mismatch")


def _marking(document: Mapping[str, Any]) -> DataMarking:
    try:
        return DataMarking(
            classification=Classification(str(document["classification"])),
            tlp=Tlp(str(document["tlp"])),
            handling=list(document.get("handling", [])),
        )
    except (KeyError, TypeError, ValueError, ValidationError):
        raise RuntimeError("fabric data marking is invalid") from None


def create_ai_uat_app(
    *,
    fabric_client: AsyncFabricClient,
    principal_resolver: PinnedDriverCredentialResolver,
    model_runtime: ModelRuntime,
    fabric_policy: FabricResolutionPolicy,
    clock: Callable[[], str],
) -> FastAPI:
    """Compose the real pinned AI application service behind one UAT-only route."""

    app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)
    counted_runtime = _CountingModelRuntime(model_runtime)

    @app.get(_METRICS_ROUTE, include_in_schema=False)
    async def metrics(request: Request) -> JSONResponse:
        try:
            principal_resolver.resolve(request)
        except Exception:  # noqa: BLE001 - exact generic mTLS denial.
            return JSONResponse(status_code=403, content={"status": "denied"})
        return JSONResponse(
            status_code=200, content={"model_calls": counted_runtime.model_calls}
        )

    @app.post(_ROUTE, include_in_schema=False)
    async def summarize(request: Request) -> JSONResponse:
        try:
            credential = principal_resolver.resolve(request)
        except Exception:  # noqa: BLE001 - credential backend failure is one generic denial
            return JSONResponse(status_code=403, content={"status": "denied"})
        try:
            body = await request.json()
            wire_request = AlertSummarizationRequest.model_validate(body)
        except (ValidationError, ValueError, TypeError, json.JSONDecodeError):
            return JSONResponse(status_code=422, content={"status": "invalid"})
        if (
            wire_request.tenant_id != credential.tenant_id
            or wire_request.actor.tenant_id != credential.tenant_id
            or wire_request.actor.id != credential.actor_id
        ):
            return JSONResponse(status_code=403, content={"status": "denied"})

        async def resolve_alert(
            resolution: AlertContextResolutionRequest,
        ) -> AlertContext:
            fabric_request = _fabric_request(
                resolution,
                credential=credential,
                policy=fabric_policy,
            )
            posted = _response_document(
                await fabric_client.post(
                    "/api/v1/invocations",
                    json=fabric_request,
                    headers={"Idempotency-Key": resolution.idempotency_key},
                ),
                200,
            )
            receipt_id, resolved = _validate_fabric_result(
                posted, fabric_request, fabric_policy
            )
            receipt = _response_document(
                await fabric_client.get(f"/api/v1/receipts/{receipt_id}"),
                200,
            )
            _validate_receipt(
                receipt,
                receipt_id=receipt_id,
                result=posted,
                request_body=fabric_request,
                policy=fabric_policy,
            )
            return AlertContext(
                ref=resolution.alert_ref.model_copy(deep=True),
                content=json.dumps(
                    resolved["context"],
                    ensure_ascii=True,
                    separators=(",", ":"),
                    sort_keys=True,
                ),
                marking=_marking(resolved["marking"]),
            )

        async def legacy_alert_resolver(_ref: object) -> None:
            raise RuntimeError("legacy alert resolver is disabled")

        async def capability_resolver(model_class: str) -> ModelCapability:
            return ModelCapability(
                model_class=model_class,
                contract_version="0.1.0",
                modalities={"input": ["text"], "output": ["text"]},
                limits=TokenLimits(
                    max_input_tokens=16000,
                    max_output_tokens=2048,
                    max_context_tokens=32000,
                ),
                supported_features=["structured_output"],
                tool_calling="disabled",
                data_residency="local",
                default_health=HealthState.unavailable,
            )

        async def health_resolver(model_class: str) -> ModelHealth:
            return ModelHealth(
                model_class=model_class,
                state=HealthState.ready,
                observed_at=clock(),
            )

        async def redactor(content: str, policy: RedactionPolicy) -> RedactedAlert:
            return RedactedAlert(
                content=content,
                proof=RedactionApplied(profile=policy.profile, enforced=True),
            )

        service = SummarizationService(
            SummarizationDeps(
                runtime=counted_runtime,
                credential=credential,
                alert_resolver=legacy_alert_resolver,
                alert_resolution_resolver=resolve_alert,
                allow_legacy_alert_resolver=False,
                capability_resolver=capability_resolver,
                health_resolver=health_resolver,
                redactor=redactor,
                clock=clock,
            )
        )
        try:
            result = await service.summarize(wire_request)
        except InferenceDenied:
            return JSONResponse(
                status_code=502, content={"status": "dependency_denied"}
            )
        return JSONResponse(status_code=200, content=result.model_dump(mode="json"))

    return app


__all__ = [
    "AsyncFabricClient",
    "FabricResolutionPolicy",
    "HttpxAsyncFabricClient",
    "PinnedDriverCredentialResolver",
    "create_ai_uat_app",
]
