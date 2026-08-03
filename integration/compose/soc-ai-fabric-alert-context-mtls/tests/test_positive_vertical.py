from __future__ import annotations

import base64
import binascii
import hashlib
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, ClassVar

import httpx
import pytest
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cybrik_ai_core.modelrt.types import (
    FinishReason,
    GenerateRequest,
    GenerateResponse,
    HealthStatus,
    ModelCapabilities,
    RuntimeUsage,
)
from cybrik_fabric_control.invocation import models
from cybrik_fabric_control.invocation.fsync_journal import RetentionMetadata
from cybrik_fabric_control.invocation.ports import DevTestOnlyInMemoryIdempotencyStore
from cybrik_fabric_control.runtime_routes import TransportPrincipal
from cybrik_suite_uat_fabric.ai_app import (
    FabricResolutionPolicy,
    HttpxAsyncFabricClient,
    PinnedDriverCredentialResolver,
    create_ai_uat_app,
)
from cybrik_suite_uat_fabric.composition import (
    PinnedPeerResolver,
    build_soc_uat_composition,
)
from cybrik_suite_uat_fabric.driver import (
    OneShotUatDriver,
    UatDriverError,
    build_summarization_request,
)
from cybrik_suite_uat_fabric.fabric_app import (
    HttpSocAlertContextPort,
    create_fabric_uat_app,
)
from cybrik_suite_uat_fabric.soc_service_app import create_soc_uat_app
from cybrik_suite_uat_fabric.tls_process import (
    TlsBoundaryFailure,
    peer_authority_from_scope,
)
from fastapi.testclient import TestClient

SOC_SOURCE = Path(
    "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/"
    "soc-d2-runtime-tuple-r1/services/api/src"
)
DRIVER_DER = b"positive-driver-certificate"
AI_DER = b"positive-ai-certificate"
FABRIC_DER = b"positive-fabric-certificate"
ISSUER_DER = b"positive-uat-issuer-certificate"


def _pem(raw: bytes) -> str:
    return (
        "-----BEGIN CERTIFICATE-----\n"
        + base64.b64encode(raw).decode("ascii")
        + "\n-----END CERTIFICATE-----\n"
    )


def _hex_fingerprint(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


class _TlsScope:
    def __init__(self, app: object, *, certificate: str, tls_version: object) -> None:
        self._app = app
        self._certificate = certificate
        self._tls_version = tls_version

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        isolated = dict(scope)
        extensions = dict(scope.get("extensions", {}))
        extensions["tls"] = {
            "tls_version": self._tls_version,
            "client_cert_error": None,
            "client_cert_chain": [self._certificate, _pem(ISSUER_DER)],
        }
        isolated["extensions"] = extensions
        await self._app(isolated, receive, send)  # type: ignore[operator]


class _ReceiptIdentity:
    algorithm = "EdDSA"
    key_type: ClassVar = {"kty": "OKP", "crv": "Ed25519"}
    signed_at = "2026-08-03T00:00:02Z"

    def __init__(self) -> None:
        self._private = Ed25519PrivateKey.generate()
        self._public: Ed25519PublicKey = self._private.public_key()
        public = self._public.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        encoded = base64.urlsafe_b64encode(public).rstrip(b"=").decode("ascii")
        self.kid = "cybrik-receipt-signer:v1:" + encoded
        self.trust_bundle_ref = {
            "bundle_uri": "cybrik-trust://receipt-signers/v1",
            "bundle_digest": "sha256:" + hashlib.sha256(public).hexdigest(),
        }

    def sign(self, signing_input: bytes, /) -> str:
        return (
            base64.urlsafe_b64encode(self._private.sign(signing_input))
            .rstrip(b"=")
            .decode()
        )

    def verify(self, signing_input: bytes, /, *, signature: str) -> bool:
        try:
            self._public.verify(
                base64.urlsafe_b64decode(signature + "=" * (-len(signature) % 4)),
                signing_input,
            )
        except (InvalidSignature, ValueError, binascii.Error):
            return False
        return True


class _FabricPrincipalResolver:
    def __init__(self, principal: TransportPrincipal) -> None:
        self._principal = principal

    def resolve(self, request: Any) -> TransportPrincipal:
        try:
            authority = peer_authority_from_scope(
                request.scope,
                {_hex_fingerprint(AI_DER): "cyber-ai-uat"},
            )
        except TlsBoundaryFailure:
            raise PermissionError("AI peer is not admitted")
        if authority.principal != "cyber-ai-uat":
            raise PermissionError("AI peer is not admitted")
        return self._principal


class _DispatchFactory:
    def create(self, **_kwargs: Any) -> models.DispatchEnvironment:
        return models.DispatchEnvironment(
            receipt_id="rcpt-alert-context-uat-vertical-0001",
            policy_decision_id="pdp-alert-context-uat-vertical-0001",
            started_at="2026-08-03T00:00:00Z",
            finished_at="2026-08-03T00:00:01Z",
            executor_id="spiffe://cybrik.example/executor/uat-r0",
            isolation_profile="S0",
        )


class _PermittedKillSwitch:
    def state(self, *, capability_name: str, tenant_id: str) -> models.KillSwitchState:
        del capability_name, tenant_id
        return models.KillSwitchState.PERMITTED


class _ModelRuntime:
    name = "deterministic-three-product-uat"

    def __init__(self) -> None:
        self.requests: list[GenerateRequest] = []

    async def agenerate(self, request: GenerateRequest) -> GenerateResponse:
        self.requests.append(request)
        return GenerateResponse(
            content="Verified UAT alert summary.",
            finish_reason=FinishReason.stop,
            model_returned="deterministic-three-product-uat:v1",
            usage=RuntimeUsage(input_tokens=20, output_tokens=6, total_tokens=26),
        )

    async def capabilities(self, model: str) -> ModelCapabilities:
        raise AssertionError("governed capability resolver must be used")

    async def health(self) -> HealthStatus:
        raise AssertionError("governed health resolver must be used")


class _RecordingAsyncClient:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self.responses: list[tuple[str, int, object]] = []

    async def post(self, path: str, **kwargs: Any) -> httpx.Response:
        response = await self._client.post(path, **kwargs)
        self.responses.append(("POST", response.status_code, response.json()))
        return response

    async def get(self, path: str) -> httpx.Response:
        response = await self._client.get(path)
        self.responses.append(("GET", response.status_code, response.json()))
        return response


class _Response:
    status_code = 200

    def json(self) -> dict[str, Any]:
        return {"outcome": "completed", "summary_text": "bounded UAT summary"}


class _Client:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def post(self, path: str, *, json: dict[str, Any]) -> _Response:
        self.calls.append((path, dict(json)))
        return _Response()


def test_driver_is_a_bounded_one_shot_uat_caller() -> None:
    client = _Client()
    driver = OneShotUatDriver(client)
    request = {"request_id": "sum-uat-0001"}

    result = driver.run(request)

    assert result == {"outcome": "completed", "summary_text": "bounded UAT summary"}
    assert client.calls == [("/uat/v1/summarizations", request)]
    with pytest.raises(UatDriverError, match="already consumed"):
        driver.run(request)


def test_driver_fails_closed_on_non_success_without_retry() -> None:
    class RefusingClient(_Client):
        def post(self, path: str, *, json: dict[str, Any]) -> Any:
            response = super().post(path, json=json)
            response.status_code = 503
            return response

    client = RefusingClient()
    driver = OneShotUatDriver(client)

    with pytest.raises(UatDriverError, match="status 503"):
        driver.run({"request_id": "sum-uat-0002"})


def test_driver_consumes_exactly_once_under_concurrency() -> None:
    client = _Client()
    driver = OneShotUatDriver(client)
    barrier = threading.Barrier(2)

    def attempt() -> object:
        barrier.wait()
        try:
            return driver.run({"request_id": "sum-uat-concurrent"})
        except UatDriverError as error:
            return error

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = tuple(executor.map(lambda _index: attempt(), range(2)))

    assert sum(isinstance(item, dict) for item in outcomes) == 1
    assert sum(isinstance(item, UatDriverError) for item in outcomes) == 1
    assert len(client.calls) == 1
    assert len(client.calls) == 1
    with pytest.raises(UatDriverError, match="already consumed"):
        driver.run({"request_id": "sum-uat-0002"})


@pytest.mark.asyncio
async def test_real_three_product_positive_vertical_without_listener(
    tmp_path: Path,
) -> None:
    now = datetime(2026, 8, 3, 0, 0, 2, tzinfo=UTC)
    soc = build_soc_uat_composition(SOC_SOURCE, clock=lambda: now)
    soc_resolver = PinnedPeerResolver({_hex_fingerprint(FABRIC_DER): soc.caller})
    soc_app = create_soc_uat_app(
        peer_resolver=soc_resolver,
        service=soc.service,
        fixture=soc.fixture,
        product=soc.product,
        clock=lambda: now,
    )
    soc_client = TestClient(
        _TlsScope(
            soc_app,
            certificate=_pem(FABRIC_DER),
            tls_version=0x0304,
        ),
        base_url="https://soc.uat.invalid",
    )
    soc_port = HttpSocAlertContextPort(client=soc_client)

    capability_digest = "sha256:" + "1" * 64
    policy_digest = "sha256:" + "2" * 64
    delegation_ref = "sha256:" + "c" * 64
    actor = {
        "type": "agent",
        "id": "membership-analyst-42",
        "tenant_id": "tenant-acme",
    }
    grant = models.issue_verified_fabric_grant(
        tenant_id="tenant-acme",
        org_scope={"org_id": "org-soc-east", "include_descendants": False},
        actor=actor,
        clearance={"classification": "confidential", "tlp": "TLP:AMBER"},
        capability_digest=capability_digest,
        policy_digest=policy_digest,
        delegation_ref=delegation_ref,
        delegation_kind=models.DelegationKind.FABRIC_TOOL_GRANT,
    )
    principal = TransportPrincipal(
        tenant_id="tenant-acme",
        subject="spiffe://cybrik.example/cyber-ai/uat",
        grant=grant,
    )
    identity = _ReceiptIdentity()
    retention = RetentionMetadata(
        retention_class="uat-evidence",
        retain_until="2027-08-03T00:00:00Z",
        policy_ref="policy://fabric/receipt-retention/v1",
        receipt_retention_days=365,
        trust_bundle_retention_days=730,
        trust_bundle_generation=1,
        trust_bundle_digest=identity.trust_bundle_ref["bundle_digest"],
    )
    fabric = create_fabric_uat_app(
        journal_root=tmp_path / "fabric-journal",
        principal_resolver=_FabricPrincipalResolver(principal),
        soc_port=soc_port,
        dispatch_factory=_DispatchFactory(),
        receipt_signer=identity,
        receipt_verifier=identity,
        kill_switch=_PermittedKillSwitch(),
        idempotency_store=DevTestOnlyInMemoryIdempotencyStore(),
        retention=retention,
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(
            app=_TlsScope(
                fabric.app,
                certificate=_pem(AI_DER),
                tls_version=0x0304,
            )
        ),
        base_url="https://fabric.uat.invalid",
    ) as fabric_http:
        observed_fabric_http = _RecordingAsyncClient(fabric_http)
        runtime = _ModelRuntime()
        driver_fingerprint = _hex_fingerprint(DRIVER_DER)
        ai_app = create_ai_uat_app(
            fabric_client=HttpxAsyncFabricClient(observed_fabric_http),
            principal_resolver=PinnedDriverCredentialResolver(
                {
                    driver_fingerprint: {
                        "tenant_id": "tenant-acme",
                        "actor_id": "membership-analyst-42",
                    }
                }
            ),
            model_runtime=runtime,
            fabric_policy=FabricResolutionPolicy(
                org_scope={"org_id": "org-soc-east", "include_descendants": False},
                clearance={"classification": "confidential", "tlp": "TLP:AMBER"},
                capability={
                    "name": "soc.get_alert_context",
                    "version": "0.1.0",
                    "digest": capability_digest,
                },
                policy_digest=policy_digest,
                delegation_ref=delegation_ref,
                purpose="alert_triage",
                requested_at=lambda: "2026-08-03T00:00:00Z",
            ),
            clock=lambda: "2026-08-03T00:00:02Z",
        )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(
                app=_TlsScope(
                    ai_app,
                    certificate=_pem(DRIVER_DER),
                    tls_version=0x0304,
                )
            ),
            base_url="https://ai.uat.invalid",
        ) as ai_http:
            response = await ai_http.post(
                "/uat/v1/summarizations",
                json=build_summarization_request(
                    tenant_id="tenant-acme",
                    actor_id="membership-analyst-42",
                    alert_id="alert-0001",
                    alert_version="17",
                    alert_digest="sha256:" + "3" * 64,
                ),
            )

    soc_client.close()
    assert response.status_code == 200
    assert response.json()["outcome"] == "completed"
    assert response.json()["summary_text"] == "Verified UAT alert summary."
    assert len(runtime.requests) == 1
    assert soc.reader.call_count == 1
    assert len(soc_port.observations) == 1
    assert soc_port.observations[0].soc_context_digest.startswith("sha256:")
    assert [
        (method, status) for method, status, _ in observed_fabric_http.responses
    ] == [
        ("POST", 200),
        ("GET", 200),
    ]
