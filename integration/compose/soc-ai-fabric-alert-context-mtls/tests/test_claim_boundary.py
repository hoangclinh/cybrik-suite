from __future__ import annotations

import asyncio
import base64
import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pytest
from cybrik_suite_uat_fabric.composition import (
    PinnedPeerResolver,
    SocCompositionError,
    build_soc_uat_composition,
)
from cybrik_suite_uat_fabric.soc_service_app import create_soc_uat_app

SOC_SOURCE = Path(
    "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/"
    "soc-d2-runtime-tuple-r1/services/api/src"
)
CERT = "-----BEGIN CERTIFICATE-----\nZmFicmljLXVhdC1jZXJ0\n-----END CERTIFICATE-----\n"
OTHER_CERT = (
    "-----BEGIN CERTIFICATE-----\nb3RoZXItY2VydA==\n-----END CERTIFICATE-----\n"
)
NOW = datetime(2026, 8, 3, 12, 0, tzinfo=UTC)


def _thumbprint(pem: str) -> str:
    body = "".join(line for line in pem.splitlines() if not line.startswith("-----"))
    return hashlib.sha256(base64.b64decode(body)).hexdigest()


def _scope(cert: str = CERT, **tls_overrides: Any) -> dict[str, Any]:
    tls = {
        "tls_version": 0x0304,
        "client_cert_error": None,
        "client_cert_chain": [cert, OTHER_CERT],
    }
    tls.update(tls_overrides)
    return {"type": "http", "extensions": {"tls": tls}}


def _body(composition: object) -> dict[str, Any]:
    fixture = composition.fixture
    caller = composition.caller
    return {
        "tenant_id": fixture.tenant_id,
        "org_scope": {"org_id": caller.org_node_id, "include_descendants": False},
        "actor": {
            "type": caller.actor.type,
            "id": caller.actor.id,
            "tenant_id": fixture.tenant_id,
            "delegated_by": caller.actor.delegated_by,
        },
        "clearance": {
            "classification": caller.clearance_ceiling.classification,
            "tlp": caller.clearance_ceiling.tlp,
        },
        "alert_ref": {
            "type": fixture.alert_ref_type,
            "id": fixture.alert_id,
            "version": fixture.alert_version,
            "digest": fixture.alert_digest,
        },
        "request_id": "request-00000001",
        "idempotency_key": "idempotency-00000001",
        "purpose": caller.purpose,
        "requested_at": "2026-08-03T12:00:00Z",
        "binding_digest": "sha256:" + "b" * 64,
    }


async def _request(
    app: object, body: dict[str, Any], scope_extensions: dict[str, Any] | None
) -> Any:
    async def wrapper(scope: dict[str, Any], receive: object, send: object) -> None:
        scoped = dict(scope)
        if scope_extensions is not None:
            scoped["extensions"] = scope_extensions
        await app(scoped, receive, send)  # type: ignore[operator]

    transport = httpx.ASGITransport(app=wrapper)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://soc.uat"
    ) as client:
        return await client.post(
            "/uat/v1/alert-context",
            json=body,
            headers={
                "x-client-cert-sha256": _thumbprint(CERT),
                "x-client-cn": "fabric-uat-service",
            },
        )


@pytest.mark.parametrize(
    "scope",
    [
        None,
        {},
        {"tls": {}},
        {
            "tls": {
                "tls_version": 0x0304,
                "client_cert_error": None,
                "client_cert_chain": [],
            }
        },
        {
            "tls": {
                "tls_version": 0x0304,
                "client_cert_error": None,
                "client_cert_chain": [CERT, "not PEM"],
            }
        },
        {
            "tls": {
                "tls_version": "TLSv1.3",
                "client_cert_error": None,
                "client_cert_chain": [CERT],
            }
        },
        {
            "tls": {
                "tls_version": 0x0304,
                "client_cert_error": "unverified",
                "client_cert_chain": [CERT],
            }
        },
        _scope(OTHER_CERT)["extensions"],
    ],
)
def test_headers_cn_body_and_malformed_tls_cannot_assert_peer_authority(
    scope: dict[str, Any] | None,
) -> None:
    composition = build_soc_uat_composition(SOC_SOURCE, clock=lambda: NOW)
    resolver = PinnedPeerResolver({_thumbprint(CERT): composition.caller})
    app = create_soc_uat_app(
        peer_resolver=resolver,
        service=composition.service,
        fixture=composition.fixture,
        product=composition.product,
        clock=lambda: NOW,
    )

    response = asyncio.run(_request(app, _body(composition), scope))

    assert response.status_code == 401
    assert response.json() == {"code": "uat_peer_unavailable"}
    assert composition.reader.call_count == 0


def test_peer_resolver_returns_only_exact_server_observed_fingerprint_mapping() -> None:
    composition = build_soc_uat_composition(SOC_SOURCE, clock=lambda: NOW)
    resolver = PinnedPeerResolver({_thumbprint(CERT): composition.caller})

    assert resolver.resolve(_scope()) is composition.caller
    assert resolver.resolve(_scope(OTHER_CERT)) is None
    assert resolver.resolve(_scope(client_cert_chain=(CERT,))) is composition.caller
    assert (
        resolver.resolve(_scope(client_cert_chain=[CERT, OTHER_CERT]))
        is composition.caller
    )


@pytest.mark.parametrize(
    "fingerprint",
    (
        _thumbprint(CERT).upper(),
        base64.urlsafe_b64encode(hashlib.sha256(b"legacy").digest())
        .rstrip(b"=")
        .decode("ascii"),
    ),
)
def test_peer_resolver_rejects_noncanonical_fingerprint_formats(
    fingerprint: str,
) -> None:
    composition = build_soc_uat_composition(SOC_SOURCE, clock=lambda: NOW)

    with pytest.raises(SocCompositionError, match="peer_identity_map_invalid"):
        PinnedPeerResolver({fingerprint: composition.caller})


def test_request_model_is_closed_against_caller_supplied_authority_extensions() -> None:
    composition = build_soc_uat_composition(SOC_SOURCE, clock=lambda: NOW)
    resolver = PinnedPeerResolver({_thumbprint(CERT): composition.caller})
    app = create_soc_uat_app(
        peer_resolver=resolver,
        service=composition.service,
        fixture=composition.fixture,
        product=composition.product,
        clock=lambda: NOW,
    )
    injected = _body(composition)
    injected["authorization_binding"] = {"tenant_id": str(composition.caller.tenant_id)}

    response = asyncio.run(_request(app, injected, _scope()["extensions"]))

    assert response.status_code == 422
    assert composition.reader.call_count == 0
