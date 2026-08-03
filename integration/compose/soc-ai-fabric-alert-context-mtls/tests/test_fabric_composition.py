"""Unit/ASGI proof for the Suite-owned Fabric UAT composition.

No listener or network socket is opened.  Product source is imported from the
exact Fabric candidate by the test command's ``PYTHONPATH``.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import copy
import hashlib
import json
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
from cybrik_fabric_control.invocation import models
from cybrik_fabric_control.invocation.fsync_journal import RetentionMetadata
from cybrik_fabric_control.invocation.models import (
    AlertContextAnswer,
    AlertContextQuery,
)
from cybrik_fabric_control.invocation.ports import DevTestOnlyInMemoryIdempotencyStore
from cybrik_fabric_control.runtime_routes import TransportPrincipal
from cybrik_suite_uat_fabric.fabric_app import (
    FabricUatComposition,
    HttpSocAlertContextPort,
    SocTransportError,
    create_fabric_uat_app,
)
from cybrik_suite_uat_fabric.tls_process import (
    TlsBoundaryFailure,
    peer_authority_from_scope,
)

REPO_ROOT = Path(__file__).resolve().parents[4]
REQUEST_PATH = (
    REPO_ROOT / "contracts/examples/alert-context-transport/positive/bound-request.json"
)
RESULT_PATH = (
    REPO_ROOT
    / "contracts/examples/alert-context-transport/positive/bound-result.available.json"
)
TLS_PEER_DER = b"fabric-test-ai-client-certificate"
TLS_ISSUER_DER = b"fabric-test-issuer-certificate"
TLS_PEER_FINGERPRINT = hashlib.sha256(TLS_PEER_DER).hexdigest()


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _pem(raw: bytes) -> str:
    return (
        "-----BEGIN CERTIFICATE-----\n"
        + base64.b64encode(raw).decode("ascii")
        + "\n-----END CERTIFICATE-----\n"
    )


class RealEd25519ReceiptIdentity:
    """Ephemeral UAT-only Ed25519 signer/verifier; no key reaches disk."""

    algorithm = "EdDSA"
    key_type: ClassVar = {"kty": "OKP", "crv": "Ed25519"}
    signed_at = "2026-08-03T00:00:02Z"

    def __init__(self) -> None:
        self._private = Ed25519PrivateKey.generate()
        self._public: Ed25519PublicKey = self._private.public_key()
        public_bytes = self._public.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        self.kid = "cybrik-receipt-signer:v1:" + _b64url(public_bytes)
        self.trust_bundle_ref = {
            "bundle_uri": "cybrik-trust://receipt-signers/v1",
            "bundle_digest": "sha256:" + hashlib.sha256(public_bytes).hexdigest(),
        }

    def sign(self, signing_input: bytes, /) -> str:
        return _b64url(self._private.sign(signing_input))

    def verify(self, signing_input: bytes, /, *, signature: str) -> bool:
        try:
            padded = signature + "=" * (-len(signature) % 4)
            self._public.verify(base64.urlsafe_b64decode(padded), signing_input)
        except (InvalidSignature, ValueError, binascii.Error):
            return False
        return True


class StaticPrincipalResolver:
    def __init__(self, principal: TransportPrincipal) -> None:
        self.principal = principal

    def resolve(self, request: object) -> TransportPrincipal:
        del request
        return self.principal


class PinnedTlsPrincipalResolver:
    """Test transport boundary admitting one server-observed mTLS identity."""

    def __init__(self, principal: TransportPrincipal) -> None:
        self.principal = principal

    def resolve(self, request: Any) -> TransportPrincipal:
        try:
            authority = peer_authority_from_scope(
                request.scope, {TLS_PEER_FINGERPRINT: "cyber-ai-uat"}
            )
        except TlsBoundaryFailure as error:
            raise PermissionError("unrecognized mTLS identity") from error
        if authority.principal != "cyber-ai-uat":
            raise PermissionError("unrecognized mTLS identity")
        return self.principal


class ValidTlsScope:
    def __init__(self, app: Any) -> None:
        self._app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        isolated = dict(scope)
        extensions = dict(scope.get("extensions", {}))
        extensions["tls"] = {
            "tls_version": 0x0304,
            "client_cert_error": None,
            "client_cert_chain": [_pem(TLS_PEER_DER), _pem(TLS_ISSUER_DER)],
        }
        isolated["extensions"] = extensions
        await self._app(isolated, receive, send)


class RecordingSocPort:
    def __init__(self, answer: AlertContextAnswer) -> None:
        self.answer = answer
        self.calls: list[AlertContextQuery] = []

    def get_alert_context(self, query: AlertContextQuery) -> AlertContextAnswer:
        self.calls.append(copy.deepcopy(query))
        return self.answer


class RecordingDispatchFactory:
    def __init__(self, dispatch: models.DispatchEnvironment) -> None:
        self.dispatch = dispatch
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> models.DispatchEnvironment:
        self.calls.append(copy.deepcopy(kwargs))
        return self.dispatch


class PermittedKillSwitch:
    def state(self, *, capability_name: str, tenant_id: str) -> models.KillSwitchState:
        del capability_name, tenant_id
        return models.KillSwitchState.PERMITTED


class FakeSocHttpResponse:
    def __init__(self, status_code: int, document: object) -> None:
        self.status_code = status_code
        self._document = copy.deepcopy(document)

    def json(self) -> object:
        return copy.deepcopy(self._document)


class RecordingSocHttpClient:
    def __init__(self, response: FakeSocHttpResponse) -> None:
        self.response = response
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def post(self, path: str, *, json: dict[str, Any]) -> FakeSocHttpResponse:
        self.calls.append((path, copy.deepcopy(json)))
        return self.response


def accepted_request() -> dict[str, Any]:
    return json.loads(REQUEST_PATH.read_text(encoding="utf-8"))


def available_answer() -> AlertContextAnswer:
    result = json.loads(RESULT_PATH.read_text(encoding="utf-8"))["output"]["data"]
    return AlertContextAnswer.available(
        context=result["context"],
        completed_at=result["completed_at"],
        data_marking=result["data_marking"],
        context_digest=None,
    )


def issued_principal(request: dict[str, Any]) -> TransportPrincipal:
    arguments = request["arguments"]
    grant = models.issue_verified_fabric_grant(
        tenant_id=request["tenant_id"],
        org_scope=arguments["org_scope"],
        actor=request["actor"],
        clearance=arguments["clearance"],
        capability_digest=request["capability"]["digest"],
        policy_digest=arguments["policy_digest"],
        delegation_ref=request["delegation_ref"],
        delegation_kind=models.DelegationKind.FABRIC_TOOL_GRANT,
    )
    return TransportPrincipal(
        tenant_id=request["tenant_id"],
        subject="spiffe://cybrik.example/cyber-ai/uat",
        grant=grant,
    )


def retention(identity: RealEd25519ReceiptIdentity) -> RetentionMetadata:
    return RetentionMetadata(
        retention_class="uat-evidence",
        retain_until="2027-08-03T00:00:00Z",
        policy_ref="policy://fabric/receipt-retention/v1",
        receipt_retention_days=365,
        trust_bundle_retention_days=730,
        trust_bundle_generation=1,
        trust_bundle_digest=identity.trust_bundle_ref["bundle_digest"],
    )


def alert_context_query() -> AlertContextQuery:
    request = accepted_request()
    return AlertContextQuery(
        tenant_id=request["tenant_id"],
        org_scope=request["arguments"]["org_scope"],
        actor=request["actor"],
        clearance=request["arguments"]["clearance"],
        alert_ref=request["arguments"]["alert_ref"],
        request_id=request["arguments"]["request_id"],
        idempotency_key=request["idempotency_key"],
        purpose=request["purpose"],
        requested_at=request["arguments"]["requested_at"],
        binding_digest="sha256:" + "9" * 64,
    )


def build_composition(
    root: Path,
) -> tuple[
    FabricUatComposition,
    dict[str, Any],
    TransportPrincipal,
    RecordingSocPort,
    RecordingDispatchFactory,
    RealEd25519ReceiptIdentity,
]:
    request = accepted_request()
    principal = issued_principal(request)
    soc = RecordingSocPort(available_answer())
    dispatch = RecordingDispatchFactory(
        models.DispatchEnvironment(
            receipt_id="rcpt-alert-context-uat-0001",
            policy_decision_id="pdp-alert-context-uat-0001",
            started_at="2026-08-03T00:00:00Z",
            finished_at="2026-08-03T00:00:01Z",
            executor_id="spiffe://cybrik.example/executor/uat-r0",
            isolation_profile="S0",
        )
    )
    identity = RealEd25519ReceiptIdentity()
    composition = create_fabric_uat_app(
        journal_root=root,
        principal_resolver=PinnedTlsPrincipalResolver(principal),
        soc_port=soc,
        dispatch_factory=dispatch,
        receipt_signer=identity,
        receipt_verifier=identity,
        kill_switch=PermittedKillSwitch(),
        idempotency_store=DevTestOnlyInMemoryIdempotencyStore(),
        retention=retention(identity),
    )
    return composition, request, principal, soc, dispatch, identity


async def asgi_request(
    composition: FabricUatComposition,
    method: str,
    path: str,
    **kwargs: Any,
) -> httpx.Response:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=ValidTlsScope(composition.app)),
        base_url="https://fabric.uat.invalid",
    ) as client:
        return await client.request(method, path, **kwargs)


def test_composes_real_runtime_producer_and_emits_verifiable_receipt(
    tmp_path: Path,
) -> None:
    composition, request, principal, soc, dispatch, _identity = build_composition(
        tmp_path / "journal"
    )

    created = asyncio.run(
        asgi_request(
            composition,
            "POST",
            "/api/v1/invocations",
            headers={"Idempotency-Key": request["idempotency_key"]},
            json=request,
        )
    )
    receipt_id = created.json()["receipt_id"]
    fetched = asyncio.run(
        asgi_request(composition, "GET", f"/api/v1/receipts/{receipt_id}")
    )

    assert created.status_code == 200
    assert created.json()["status"] == "completed"
    assert created.json()["output"]["data"]["outcome"] == "available"
    assert fetched.status_code == 200
    assert fetched.json()["receipt_id"] == receipt_id
    assert fetched.json()["signature"].startswith(
        "cybrik-ledger://receipt-signatures/sha256/"
    )
    assert (
        composition.receipt_reader.get_receipt(
            receipt_id,
            tenant_id=principal.tenant_id,
            principal=principal,
        ).receipt
        == fetched.json()
    )
    assert len(soc.calls) == 1
    assert soc.calls[0].tenant_id == principal.tenant_id
    assert len(dispatch.calls) == 1
    assert len(tuple((tmp_path / "journal").rglob("*.json"))) == 2


def test_composition_refuses_signer_verifier_identity_drift_before_journal(
    tmp_path: Path,
) -> None:
    request = accepted_request()
    signer = RealEd25519ReceiptIdentity()
    verifier = RealEd25519ReceiptIdentity()
    root = tmp_path / "journal"

    with pytest.raises(ValueError, match="trust identities differ"):
        create_fabric_uat_app(
            journal_root=root,
            principal_resolver=StaticPrincipalResolver(issued_principal(request)),
            soc_port=RecordingSocPort(available_answer()),
            dispatch_factory=RecordingDispatchFactory(
                models.DispatchEnvironment(
                    receipt_id="receipt-unused",
                    policy_decision_id="policy-unused",
                    started_at="2026-08-03T00:00:00Z",
                    finished_at="2026-08-03T00:00:01Z",
                    executor_id="executor-unused",
                    isolation_profile="S0",
                )
            ),
            receipt_signer=signer,
            receipt_verifier=verifier,
            kill_switch=PermittedKillSwitch(),
            idempotency_store=DevTestOnlyInMemoryIdempotencyStore(),
            retention=retention(signer),
        )

    assert not root.exists()


def test_composition_refuses_retention_not_pinned_to_signer(tmp_path: Path) -> None:
    request = accepted_request()
    identity = RealEd25519ReceiptIdentity()
    other = RealEd25519ReceiptIdentity()
    root = tmp_path / "journal"

    with pytest.raises(ValueError, match="retention metadata"):
        create_fabric_uat_app(
            journal_root=root,
            principal_resolver=StaticPrincipalResolver(issued_principal(request)),
            soc_port=RecordingSocPort(available_answer()),
            dispatch_factory=RecordingDispatchFactory(
                models.DispatchEnvironment(
                    receipt_id="receipt-unused",
                    policy_decision_id="policy-unused",
                    started_at="2026-08-03T00:00:00Z",
                    finished_at="2026-08-03T00:00:01Z",
                    executor_id="executor-unused",
                    isolation_profile="S0",
                )
            ),
            receipt_signer=identity,
            receipt_verifier=identity,
            kill_switch=PermittedKillSwitch(),
            idempotency_store=DevTestOnlyInMemoryIdempotencyStore(),
            retention=retention(other),
        )

    assert not root.exists()


def test_http_soc_port_posts_exact_query_and_keeps_soc_digest_separate() -> None:
    expected = available_answer()
    soc_digest = "sha256:" + "a" * 64
    client = RecordingSocHttpClient(
        FakeSocHttpResponse(
            200,
            {
                "outcome": "available",
                "completed_at": expected.completed_at,
                "context": expected.context,
                "data_marking": expected.data_marking,
                "soc_context_digest": soc_digest,
            },
        )
    )
    port = HttpSocAlertContextPort(client=client)
    query = alert_context_query()

    answer = port.get_alert_context(query)

    assert answer == expected
    assert answer.context_digest is None
    assert client.calls == [
        (
            "/uat/v1/alert-context",
            {
                "tenant_id": query.tenant_id,
                "org_scope": query.org_scope,
                "actor": query.actor,
                "clearance": query.clearance,
                "alert_ref": query.alert_ref,
                "request_id": query.request_id,
                "idempotency_key": query.idempotency_key,
                "purpose": query.purpose,
                "requested_at": query.requested_at,
                "binding_digest": query.binding_digest,
            },
        )
    ]
    assert port.observations[0].soc_context_digest == soc_digest
    assert port.observations[0].request_id == query.request_id


def test_http_soc_port_maps_generic_unavailable_and_refuses_malformed_success() -> None:
    query = alert_context_query()
    unavailable = HttpSocAlertContextPort(
        client=RecordingSocHttpClient(
            FakeSocHttpResponse(
                404,
                {
                    "outcome": "unavailable",
                    "completed_at": "2026-08-03T00:00:01Z",
                },
            )
        )
    ).get_alert_context(query)
    malformed = HttpSocAlertContextPort(
        client=RecordingSocHttpClient(
            FakeSocHttpResponse(
                200,
                {
                    "outcome": "available",
                    "completed_at": "2026-08-03T00:00:01Z",
                    "context": {},
                    "data_marking": {},
                    "soc_context_digest": "not-a-digest",
                },
            )
        )
    )

    assert unavailable == AlertContextAnswer.unavailable(
        completed_at="2026-08-03T00:00:01Z"
    )
    with pytest.raises(SocTransportError, match="SOC response refused"):
        malformed.get_alert_context(query)
