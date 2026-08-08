from __future__ import annotations

import base64
import copy
import hashlib
from collections.abc import Mapping
from typing import Any

import pytest
from cybrik_ai_core.modelrt.types import (
    FinishReason,
    GenerateRequest,
    GenerateResponse,
    HealthStatus,
    ModelCapabilities,
    RuntimeUsage,
)
from cybrik_fabric_control.contracts import invocation, jcs
from cybrik_suite_uat_fabric.ai_app import (
    FabricResolutionPolicy,
    HttpxAsyncFabricClient,
    PinnedDriverCredentialResolver,
    create_ai_uat_app,
)
from cybrik_suite_uat_fabric.driver import build_summarization_request
from fastapi.testclient import TestClient

DRIVER_DER = b"driver-uat-certificate"
UNKNOWN_DER = b"unknown-uat-certificate"
DRIVER_CERTIFICATE = (
    "-----BEGIN CERTIFICATE-----\n"
    + base64.b64encode(DRIVER_DER).decode("ascii")
    + "\n-----END CERTIFICATE-----\n"
)
UNKNOWN_CERTIFICATE = (
    "-----BEGIN CERTIFICATE-----\n"
    + base64.b64encode(UNKNOWN_DER).decode("ascii")
    + "\n-----END CERTIFICATE-----\n"
)
DRIVER_FINGERPRINT = hashlib.sha256(DRIVER_DER).hexdigest()
UNKNOWN_FINGERPRINT = hashlib.sha256(UNKNOWN_DER).hexdigest()
ALERT_DIGEST = "sha256:" + "3" * 64
CAPABILITY_DIGEST = "sha256:" + "1" * 64
POLICY_DIGEST = "sha256:" + "2" * 64
DELEGATION_REF = "sha256:" + "c" * 64
CONTEXT_DIGEST = "sha256:" + "4" * 64
RECEIPT_DIGEST = "sha256:" + "5" * 64
ARGUMENTS_DIGEST = "sha256:" + "6" * 64


class _TlsScope:
    def __init__(self, app: Any, *, certificate: str) -> None:
        self._app = app
        self._certificate = certificate

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        isolated = dict(scope)
        extensions = dict(scope.get("extensions", {}))
        extensions["tls"] = {
            "tls_version": 0x0304,
            "client_cert_error": None,
            "client_cert_chain": [self._certificate],
        }
        isolated["extensions"] = extensions
        await self._app(isolated, receive, send)


class _Response:
    def __init__(self, status_code: int, document: Mapping[str, Any]) -> None:
        self.status_code = status_code
        self._document = copy.deepcopy(dict(document))

    def json(self) -> dict[str, Any]:
        return copy.deepcopy(self._document)


class _FabricClient:
    def __init__(self, *, mutate_receipt: bool = False, post_status: int = 200) -> None:
        self.calls: list[tuple[str, str, dict[str, Any]]] = []
        self.mutate_receipt = mutate_receipt
        self.post_status = post_status

    async def post(
        self,
        path: str,
        *,
        json: Mapping[str, Any],
        headers: Mapping[str, str],
    ) -> _Response:
        body = copy.deepcopy(dict(json))
        self.calls.append(("POST", path, body))
        assert headers == {"Idempotency-Key": body["idempotency_key"]}
        assert body["actor"] == {
            "type": "agent",
            "id": "membership-analyst-42",
            "tenant_id": "tenant-acme",
        }
        assert body["arguments"]["alert_ref"] == {
            "type": "soc.alert",
            "id": "alert-0001",
            "version": "17",
            "digest": ALERT_DIGEST,
        }
        assert body["purpose"] == "alert_triage"
        assert body["data_marking"] == {
            "classification": "confidential",
            "tlp": "TLP:AMBER",
        }
        if self.post_status != 200:
            return _Response(self.post_status, {"status": "denied"})
        return _Response(200, _fabric_result(body))

    async def get(self, path: str) -> _Response:
        self.calls.append(("GET", path, {}))
        request = self.calls[0][2]
        receipt = _receipt(
            action_id=str(request["action_id"]),
            arguments_digest=jcs.digest(
                invocation.resolved_arguments_projection(request)
            ),
        )
        if self.mutate_receipt:
            receipt["action_id"] = "act-other"
        return _Response(200, receipt)


class _ModelRuntime:
    name = "deterministic-uat"

    def __init__(self) -> None:
        self.requests: list[GenerateRequest] = []

    async def agenerate(self, request: GenerateRequest) -> GenerateResponse:
        self.requests.append(request)
        return GenerateResponse(
            content="Credential stuffing against the SSO gateway.",
            finish_reason=FinishReason.stop,
            model_returned="deterministic-uat:v1",
            usage=RuntimeUsage(input_tokens=24, output_tokens=8, total_tokens=32),
        )

    async def capabilities(self, model: str) -> ModelCapabilities:
        raise AssertionError(
            "the application service uses its governed capability resolver"
        )

    async def health(self) -> HealthStatus:
        raise AssertionError(
            "the application service uses its governed health resolver"
        )


def _policy() -> FabricResolutionPolicy:
    return FabricResolutionPolicy(
        org_scope={"org_id": "org-soc-east", "include_descendants": False},
        clearance={"classification": "confidential", "tlp": "TLP:AMBER"},
        capability={
            "name": "soc.get_alert_context",
            "version": "0.1.0",
            "digest": CAPABILITY_DIGEST,
        },
        policy_digest=POLICY_DIGEST,
        delegation_ref=DELEGATION_REF,
        purpose="alert_triage",
        requested_at=lambda: "2026-08-03T00:00:00Z",
    )


def _resolver() -> PinnedDriverCredentialResolver:
    return PinnedDriverCredentialResolver(
        {
            DRIVER_FINGERPRINT: {
                "tenant_id": "tenant-acme",
                "actor_id": "membership-analyst-42",
            }
        }
    )


def _request(*, actor_id: str = "membership-analyst-42") -> dict[str, Any]:
    return build_summarization_request(
        tenant_id="tenant-acme",
        actor_id=actor_id,
        alert_id="alert-0001",
        alert_digest=ALERT_DIGEST,
    )


def _fabric_result(request: Mapping[str, Any]) -> dict[str, Any]:
    result = {
        "action_id": request["action_id"],
        "tenant_id": "tenant-acme",
        "status": "completed",
        "receipt_id": "rcpt-alert-context-0001",
        "policy_decision_id": "pdp-alert-context-0001",
        "output": {
            "data": {
                "message_type": "result",
                "request_id": request["arguments"]["request_id"],
                "idempotency_key": request["idempotency_key"],
                "capability": {
                    **request["capability"],
                    "risk_class": "R0",
                    "side_effects": False,
                },
                "tenant_id": "tenant-acme",
                "org_scope": copy.deepcopy(request["arguments"]["org_scope"]),
                "authorized_actor": copy.deepcopy(request["actor"]),
                "clearance": copy.deepcopy(request["arguments"]["clearance"]),
                "authorization_binding": {
                    "tenant_id": "tenant-acme",
                    "org_scope": copy.deepcopy(request["arguments"]["org_scope"]),
                    "actor": copy.deepcopy(request["actor"]),
                    "capability": {
                        **request["capability"],
                        "risk_class": "R0",
                        "side_effects": False,
                    },
                    "schema_digest": "sha256:" + "7" * 64,
                    "input_digest": ARGUMENTS_DIGEST,
                    "policy_digest": POLICY_DIGEST,
                    "binding_digest": "sha256:" + "8" * 64,
                },
                "idempotency_disposition": "fresh",
                "outcome": "available",
                "alert_ref": copy.deepcopy(request["arguments"]["alert_ref"]),
                "context": {
                    "alert_id": "alert-0001",
                    "alert_digest": ALERT_DIGEST,
                    "title": "Credential stuffing against SSO gateway",
                    "severity": "high",
                    "status": "open",
                },
                "context_digest": CONTEXT_DIGEST,
                "data_marking": {"classification": "confidential", "tlp": "TLP:AMBER"},
                "policy_digest": POLICY_DIGEST,
                "completed_at": "2026-08-03T00:00:01Z",
            },
            "truncated": False,
            "output_digest": "sha256:" + "9" * 64,
        },
        "output_artifacts": [],
    }
    data = result["output"]["data"]
    data["context_digest"] = jcs.digest(invocation.available_result_projection(data))
    result["output"]["output_digest"] = jcs.digest(
        invocation.bound_output_projection(result)
    )
    return result


def _receipt(*, action_id: str, arguments_digest: str) -> dict[str, Any]:
    return {
        "receipt_id": "rcpt-alert-context-0001",
        "action_id": action_id,
        "tenant_id": "tenant-acme",
        "status": "completed",
        "capability": {
            "name": "soc.get_alert_context",
            "version": "0.1.0",
            "digest": CAPABILITY_DIGEST,
        },
        "executor": {"id": "spiffe://cybrik/fabric/uat", "isolation_profile": "S0"},
        "policy_decision_id": "pdp-alert-context-0001",
        "delegation_ref": DELEGATION_REF,
        "resolved_arguments_digest": arguments_digest,
        "started_at": "2026-08-03T00:00:00Z",
        "finished_at": "2026-08-03T00:00:01Z",
        "side_effect": {"performed": False},
        "receipt_digest": RECEIPT_DIGEST,
        "signature": "cybrik-ledger://receipt-signatures/example",
    }


def _app(fabric: _FabricClient, runtime: _ModelRuntime) -> Any:
    return create_ai_uat_app(
        fabric_client=fabric,
        principal_resolver=_resolver(),
        model_runtime=runtime,
        fabric_policy=_policy(),
        clock=lambda: "2026-08-03T00:00:02Z",
    )


def test_positive_route_executes_real_ai_service_after_bound_fabric_receipt() -> None:
    fabric = _FabricClient()
    runtime = _ModelRuntime()
    app = _app(fabric, runtime)

    response = TestClient(_TlsScope(app, certificate=DRIVER_CERTIFICATE)).post(
        "/uat/v1/summarizations",
        json=_request(),
        headers={
            "x-client-cn": "ignored-cn",
            "x-client-cert-sha256": UNKNOWN_FINGERPRINT,
        },
    )

    assert response.status_code == 200
    assert response.json()["outcome"] == "completed"
    assert response.json()["citations"] == [
        {
            "type": "soc.alert",
            "id": "alert-0001",
            "version": "17",
            "digest": ALERT_DIGEST,
            "locator": None,
        }
    ]
    assert [call[:2] for call in fabric.calls] == [
        ("POST", "/api/v1/invocations"),
        ("GET", "/api/v1/receipts/rcpt-alert-context-0001"),
    ]
    assert len(runtime.requests) == 1


def test_metrics_route_is_mtls_protected_and_exposes_only_model_call_count() -> None:
    fabric = _FabricClient()
    runtime = _ModelRuntime()
    app = _app(fabric, runtime)
    admitted = TestClient(_TlsScope(app, certificate=DRIVER_CERTIFICATE))

    before = admitted.get("/uat/v1/metrics")
    summary = admitted.post("/uat/v1/summarizations", json=_request())
    after = admitted.get("/uat/v1/metrics")
    denied = TestClient(_TlsScope(app, certificate=UNKNOWN_CERTIFICATE)).get(
        "/uat/v1/metrics"
    )

    assert before.status_code == 200
    assert before.json() == {"model_calls": 0}
    assert summary.status_code == 200
    assert after.json() == {"model_calls": 1}
    assert denied.status_code == 403
    assert denied.json() == {"status": "denied"}


def test_unknown_tls_fingerprint_is_denied_before_fabric_or_model() -> None:
    fabric = _FabricClient()
    runtime = _ModelRuntime()

    response = TestClient(
        _TlsScope(_app(fabric, runtime), certificate=UNKNOWN_CERTIFICATE)
    ).post("/uat/v1/summarizations", json=_request())

    assert response.status_code == 403
    assert fabric.calls == []
    assert runtime.requests == []


def test_body_actor_cannot_override_tls_credential() -> None:
    fabric = _FabricClient()
    runtime = _ModelRuntime()

    response = TestClient(
        _TlsScope(_app(fabric, runtime), certificate=DRIVER_CERTIFICATE)
    ).post("/uat/v1/summarizations", json=_request(actor_id="body-selected-superuser"))

    assert response.status_code == 403
    assert fabric.calls == []
    assert runtime.requests == []


def test_receipt_binding_mismatch_fails_closed_before_model_dispatch() -> None:
    fabric = _FabricClient(mutate_receipt=True)
    runtime = _ModelRuntime()

    response = TestClient(
        _TlsScope(_app(fabric, runtime), certificate=DRIVER_CERTIFICATE)
    ).post("/uat/v1/summarizations", json=_request())

    assert response.status_code == 502
    assert [call[0] for call in fabric.calls] == ["POST", "GET"]
    assert runtime.requests == []


def test_f1_fabric_policy_denial_prevents_model_dispatch() -> None:
    fabric = _FabricClient(post_status=403)
    runtime = _ModelRuntime()

    response = TestClient(
        _TlsScope(_app(fabric, runtime), certificate=DRIVER_CERTIFICATE)
    ).post("/uat/v1/summarizations", json=_request())

    assert response.status_code == 502
    assert [call[0] for call in fabric.calls] == ["POST"]
    assert runtime.requests == []


@pytest.mark.asyncio
async def test_httpx_fabric_client_allows_only_the_two_product_routes() -> None:
    class RecordingClient:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str, dict[str, Any]]] = []

        async def post(
            self,
            path: str,
            *,
            json: Mapping[str, Any],
            headers: Mapping[str, str],
        ) -> _Response:
            self.calls.append(("POST", path, copy.deepcopy(dict(json))))
            return _Response(200, {"status": "completed"})

        async def get(self, path: str) -> _Response:
            self.calls.append(("GET", path, {}))
            return _Response(200, {"status": "completed"})

    underlying = RecordingClient()
    client = HttpxAsyncFabricClient(underlying)
    request = {
        "action_id": "act-test",
        "idempotency_key": "idem-httpx-wrapper-0001",
        "actor": {
            "type": "agent",
            "id": "membership-analyst-42",
            "tenant_id": "tenant-acme",
        },
        "arguments": {
            "alert_ref": {
                "type": "soc.alert",
                "id": "alert-0001",
                "version": "17",
                "digest": ALERT_DIGEST,
            }
        },
        "purpose": "alert_triage",
    }

    await client.post(
        "/api/v1/invocations",
        json=request,
        headers={"Idempotency-Key": "idem-httpx-wrapper-0001"},
    )
    await client.get("/api/v1/receipts/rcpt-alert-context-0001")

    assert [call[:2] for call in underlying.calls] == [
        ("POST", "/api/v1/invocations"),
        ("GET", "/api/v1/receipts/rcpt-alert-context-0001"),
    ]
    with pytest.raises(ValueError, match="route is not admitted"):
        await client.get("/internal/journal")


@pytest.mark.parametrize(
    "tls_extension",
    [
        {},
        {
            "tls_version": "TLSv1.3",
            "client_cert_error": None,
            "client_cert_chain": [DRIVER_CERTIFICATE],
        },
        {
            "tls_version": 0x0304,
            "client_cert_error": "bad",
            "client_cert_chain": [DRIVER_CERTIFICATE],
        },
    ],
)
def test_resolver_requires_server_owned_tls13_extension(
    tls_extension: dict[str, Any],
) -> None:
    with pytest.raises(PermissionError):
        _resolver().resolve_scope({"extensions": {"tls": tls_extension}})
