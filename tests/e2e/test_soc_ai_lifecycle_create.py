"""SCAFFOLD / TEST-ONLY / SOSIM SOC -> Cyber AI lifecycle-create harness.

NOT UAT. NOT mTLS. NOT deployment. NOT release proof. The test drives the real
product classes in-process and uses only synthetic values plus process-local stores.
"""

from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from cybrik_ai_api.app import (
    InMemoryCheckpointDocumentStore,
    LifecycleIngressDeps,
    create_app,
)
from cybrik_ai_api.investigations.projection import (
    derive_investigation_id,
    derive_scoped_idempotency_key,
)
from cybrik_ai_api.investigations.relying_party import (
    LifecycleRelyingParty,
    LifecycleRelyingPartyDeps,
)
from cybrik_ai_api.investigations.service import (
    InMemoryInvestigationContextStore,
    InvestigationService,
    InvestigationServiceDeps,
)
from cybrik_ai_api.transport_security import (
    TransportConnection,
    TrustedTransportContext,
    deny_all_transport_resolver,
)
from cybrik_ai_core.delegation import (
    CryptographySignatureVerifier,
    InMemoryReplayStore,
    PinnedTrustProvider,
    ServiceDelegationVerifier,
    TrustMetadata,
)
from cybrik_ai_core.orchestration.checkpoints import InMemoryCheckpointLog
from cybrik_ai_core.orchestration.controller import OrchestrationController
from cybrik_ai_core.orchestration.memory import (
    InMemoryEffectLedger,
    InMemoryIdempotencyRegistry,
    InMemoryOutbox,
    InMemoryRunStateStore,
)
from cybrik_ai_core.orchestration.ports import SystemClock as OrchestrationSystemClock
from cybrik_soc.modules.copilot.lifecycle_create import (  # type: ignore[import-untyped]
    LIFECYCLE_CREATE_AUDIENCE,
    LIFECYCLE_CREATE_OPERATION,
    LIFECYCLE_CREATE_SCOPE,
    CreateBudget,
    CreateCommand,
    LifecycleCreateClient,
    LifecycleCreateError,
    OrgScope,
)
from cybrik_soc.platform.svc_delegation import (  # type: ignore[import-untyped]
    AsymmetricJwtDelegationIssuer,
    CertBinding,
    DataMarking,
    DelegationPolicy,
    IssuerContext,
)

TENANT_ID = uuid.UUID("11111111-2222-4333-8444-555555555555")
USER_ID = uuid.UUID("22222222-3333-4444-8555-666666666666")
MEMBERSHIP_ID = uuid.UUID("33333333-4444-4555-8666-777777777777")
WORKLOAD_ID = "spiffe://soc.internal.cybrik/workload/investigation-api"
ISSUER_ID = "spiffe://soc.internal.cybrik/mint/downstream"
TRUST_DOMAIN = "soc.internal.cybrik"
KEY_ID = "soc-lifecycle-sosim-ephemeral"
THUMBPRINT = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ"
ORG_ID = "org-acme"
ORG_PATH = "org:acme/soc/tier2"
IDEMPOTENCY_KEY = "idem-sosim-create-0001"
FIXTURE = (
    Path(__file__).parents[2]
    / "integration"
    / "fixtures"
    / "soc-ai-lifecycle-create-sosim.v1.json"
)


@dataclass(frozen=True, slots=True)
class _Principal:
    user_id: uuid.UUID = USER_ID
    tenant_id: uuid.UUID = TENANT_ID
    membership_id: uuid.UUID | None = MEMBERSHIP_ID
    identity_id: uuid.UUID | None = None


class _EphemeralEs256Signer:
    """Test signer whose generated private key never leaves process memory."""

    def __init__(self) -> None:
        self._key = ec.generate_private_key(ec.SECP256R1())

    @property
    def kid(self) -> str:
        return KEY_ID

    @property
    def algorithm(self) -> str:
        return "ES256"

    def sign(self, signing_input: bytes) -> bytes:
        der = self._key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
        r, s = decode_dss_signature(der)
        return r.to_bytes(32, "big") + s.to_bytes(32, "big")

    def public_jwk(self) -> dict[str, str]:
        numbers = self._key.public_key().public_numbers()
        return {
            "kty": "EC",
            "crv": "P-256",
            "x": _b64url(numbers.x.to_bytes(32, "big")),
            "y": _b64url(numbers.y.to_bytes(32, "big")),
            "kid": self.kid,
            "alg": self.algorithm,
        }

    def __repr__(self) -> str:
        return "_EphemeralEs256Signer(kid='soc-lifecycle-sosim-ephemeral', algorithm='ES256')"


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


class _TestTransportResolver:
    """TEST-ONLY resolver; it performs no TLS or certificate verification."""

    def __init__(self, *, trusted: bool) -> None:
        self._trusted = trusted

    def __call__(
        self, connection: TransportConnection
    ) -> TrustedTransportContext | None:
        if not self._trusted:
            return deny_all_transport_resolver(connection)
        return TrustedTransportContext(
            audience=LIFECYCLE_CREATE_AUDIENCE,
            trust_domain=TRUST_DOMAIN,
            peer_cert_thumbprint=THUMBPRINT,
        )


def _compose_ai_app(*, signer: _EphemeralEs256Signer, trusted: bool) -> Any:
    state_store = InMemoryRunStateStore()
    orchestration_clock = OrchestrationSystemClock()
    controller = OrchestrationController(
        state_store=state_store,
        idempotency=InMemoryIdempotencyRegistry(),
        ledger=InMemoryEffectLedger(),
        outbox=InMemoryOutbox(),
        clock=orchestration_clock,
    )
    service = InvestigationService(
        InvestigationServiceDeps(
            controller=controller,
            context_store=InMemoryInvestigationContextStore(),
            checkpoint_log=InMemoryCheckpointLog(),
            clock=orchestration_clock,
        )
    )
    trust = TrustMetadata.model_validate(
        {
            "trust_domain": TRUST_DOMAIN,
            "self_audience": LIFECYCLE_CREATE_AUDIENCE,
            "accepted_issuers": [ISSUER_ID],
            "jwks": "cybrik://soc.internal.cybrik/jwks/sosim-ephemeral",
            "accepted_algs": ["ES256"],
            "max_token_ttl_seconds": 120,
            "clock_skew_seconds": 30,
            "require_cnf": True,
            "require_mtls": True,
        }
    )
    verifier = ServiceDelegationVerifier(
        trust_provider=PinnedTrustProvider.from_pinned_jwks(
            trust, {"keys": [signer.public_jwk()]}
        ),
        replay_store=InMemoryReplayStore(),
        signature_verifier=CryptographySignatureVerifier(),
    )
    relying_party = LifecycleRelyingParty(
        LifecycleRelyingPartyDeps(verifier=verifier, service=service)
    )
    app = create_app(
        LifecycleIngressDeps(
            relying_party=relying_party,
            checkpoints=InMemoryCheckpointDocumentStore(),
            transport_resolver=_TestTransportResolver(trusted=trusted),
        )
    )
    return app, state_store


def _issuer(signer: _EphemeralEs256Signer) -> AsymmetricJwtDelegationIssuer:
    return AsymmetricJwtDelegationIssuer(
        context=IssuerContext(
            issuer=ISSUER_ID,
            default_audience=LIFECYCLE_CREATE_AUDIENCE,
            kid=signer.kid,
            algorithm=signer.algorithm,
            signing_key_ref="sosim:ephemeral-process-memory",
            ttl_seconds=120,
        ),
        signer=signer,
        policy=DelegationPolicy(
            allowed_audiences=frozenset({LIFECYCLE_CREATE_AUDIENCE})
        ),
    )


def _command() -> CreateCommand:
    return CreateCommand(
        request_id="soc_lifecycle_create_sosim_0001",
        idempotency_key=IDEMPOTENCY_KEY,
        objective="Investigate the digest-bound synthetic alert without taking action.",
        context_refs=(
            {
                "type": "soc.alert_snapshot",
                "id": "alert-sosim-0001",
                "digest": "sha256:" + "a" * 64,
            },
        ),
        budget=CreateBudget(
            deadline_seconds=60,
            max_model_calls=4,
            max_tool_calls=0,
            max_retrieved_bytes=1_048_576,
        ),
        traceparent="00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
    )


async def _create(*, signer: _EphemeralEs256Signer, app: Any) -> Any:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="https://cyber-ai.sosim.invalid",
    ) as http_client:
        client = LifecycleCreateClient(
            http_client=http_client,
            issuer=_issuer(signer),
            enabled=True,
        )
        return await client.create(
            principal=_Principal(),
            workload_id=WORKLOAD_ID,
            org_scope=OrgScope(org_id=ORG_ID, org_path=ORG_PATH),
            marking=DataMarking(
                "confidential", "TLP:AMBER", handling=("sosim.synthetic",)
            ),
            cnf=CertBinding(THUMBPRINT),
            command=_command(),
        )


def _expected_investigation_id() -> str:
    scoped = derive_scoped_idempotency_key(
        tenant_id=str(TENANT_ID),
        principal=WORKLOAD_ID,
        idempotency_key=IDEMPOTENCY_KEY,
    )
    return derive_investigation_id(scoped)


@pytest.mark.asyncio
async def test_trusted_create_uses_exact_authority_and_preserves_full_identity() -> None:
    signer = _EphemeralEs256Signer()
    app, state_store = _compose_ai_app(signer=signer, trusted=True)
    result = await _create(signer=signer, app=app)

    assert result.token_provenance.audience == "svc:cyber-ai-lifecycle"
    assert result.token_provenance.operation == "investigation.create"
    assert result.token_provenance.scope == ("investigation.lifecycle:create",)
    assert result.token_provenance.audience == LIFECYCLE_CREATE_AUDIENCE
    assert result.token_provenance.operation == LIFECYCLE_CREATE_OPERATION
    assert result.token_provenance.scope == LIFECYCLE_CREATE_SCOPE

    status = result.status
    assert status.investigation_id == _expected_investigation_id()
    assert status.tenant_id == str(TENANT_ID)
    assert status.org_scope.org_id == ORG_ID
    assert status.org_scope.org_path == ORG_PATH
    assert status.requested_by.actor_type == "service"
    assert status.requested_by.actor_id == WORKLOAD_ID
    assert status.requested_by.tenant_id == str(TENANT_ID)
    assert status.requested_by.delegated_by == str(MEMBERSHIP_ID)
    assert dict(status.data_marking) == {
        "classification": "confidential",
        "tlp": "TLP:AMBER",
        "handling": ["sosim.synthetic"],
    }
    assert state_store.load(status.investigation_id) is not None


@pytest.mark.asyncio
async def test_deny_all_transport_fails_closed_without_producing_a_result() -> None:
    signer = _EphemeralEs256Signer()
    app, state_store = _compose_ai_app(signer=signer, trusted=False)
    result = None

    with pytest.raises(LifecycleCreateError) as captured:
        result = await _create(signer=signer, app=app)

    assert str(captured.value) == "lifecycle create was rejected by the relying party"
    assert result is None
    assert state_store.load(_expected_investigation_id()) is None


def test_soc_client_introduces_no_other_public_lifecycle_surface() -> None:
    public = {name for name in dir(LifecycleCreateClient) if not name.startswith("_")}
    assert public == {"create", "enabled"}
    assert public.isdisjoint({"status", "cancel", "checkpoint", "bundle", "bundle_read"})


def test_synthetic_fixture_pins_lineage_exact_products_and_nonclaims() -> None:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert fixture["status"] == [
        "SCAFFOLD",
        "TEST-ONLY",
        "SOSIM",
        "NOT UAT",
        "NOT mTLS",
        "NOT deployment",
        "NOT release proof",
    ]
    assert fixture["candidate_pins"] == {
        "suite_base": {
            "commit": "ae0998ea7661fd47bb33d7328c4f811671429a72",
            "tree": "3e6a02b12892c25c73bd0d392de0f0c6b6665e10",
        },
        "soc": {
            "commit": "abfdfde96afc6daa2868694de993c623daa8862e",
            "tree": "241ef24a33246918ff5cf133e7d8d004823fdf06",
        },
        "cyber_ai": {
            "commit": "a7defd3a7b41faa8e654d6d7567cb2e59b9363fb",
            "tree": "81e58824d95f800d8e6d424c25207901aceaccfa",
        },
    }
