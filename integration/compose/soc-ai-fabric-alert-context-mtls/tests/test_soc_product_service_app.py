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
    FABRIC_ACTOR_ID,
    UAT_ALERT_DIGEST,
    UAT_ALERT_ID,
    UAT_ORG_ID,
    UAT_PURPOSE,
    UAT_TENANT_ID,
    PinnedPeerResolver,
    build_soc_uat_composition,
)
from cybrik_suite_uat_fabric.soc_service_app import create_soc_uat_app

SOC_SOURCE = Path(
    "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/"
    "soc-d2-runtime-tuple-r1/services/api/src"
)
NOW = datetime(2026, 8, 3, 12, 0, tzinfo=UTC)
FABRIC_CERT = (
    "-----BEGIN CERTIFICATE-----\nZmFicmljLXVhdC1jZXJ0\n-----END CERTIFICATE-----\n"
)


def _thumbprint(pem: str = FABRIC_CERT) -> str:
    body = "".join(line for line in pem.splitlines() if not line.startswith("-----"))
    return hashlib.sha256(base64.b64decode(body)).hexdigest()


def _body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "tenant_id": UAT_TENANT_ID,
        "org_scope": {"org_id": UAT_ORG_ID, "include_descendants": False},
        "actor": {
            "type": "agent",
            "id": FABRIC_ACTOR_ID,
            "tenant_id": UAT_TENANT_ID,
            "delegated_by": None,
        },
        "clearance": {"classification": "confidential", "tlp": "TLP:AMBER"},
        "alert_ref": {
            "type": "soc.alert",
            "id": UAT_ALERT_ID,
            "version": "17",
            "digest": UAT_ALERT_DIGEST,
        },
        "request_id": "req-uat-positive-0001",
        "idempotency_key": "idem-uat-positive-0001",
        "purpose": UAT_PURPOSE,
        "requested_at": "2026-08-03T12:00:00Z",
        "binding_digest": "sha256:" + "b" * 64,
    }
    body.update(overrides)
    return body


def _tls_app(app: object, *, cert: str = FABRIC_CERT) -> object:
    async def wrapped(scope: dict[str, Any], receive: object, send: object) -> None:
        scoped = dict(scope)
        scoped["extensions"] = {
            "tls": {
                "tls_version": 0x0304,
                "client_cert_error": None,
                "client_cert_chain": [cert],
            }
        }
        await app(scoped, receive, send)  # type: ignore[operator]

    return wrapped


async def _post(
    app: object, body: dict[str, Any], *, cert: str = FABRIC_CERT
) -> httpx.Response:
    transport = httpx.ASGITransport(app=_tls_app(app, cert=cert))  # type: ignore[arg-type]
    async with httpx.AsyncClient(
        transport=transport, base_url="https://soc.uat"
    ) as client:
        return await client.post("/uat/v1/alert-context", json=body)


async def _metrics(app: object, *, cert: str = FABRIC_CERT) -> httpx.Response:
    transport = httpx.ASGITransport(app=_tls_app(app, cert=cert))  # type: ignore[arg-type]
    async with httpx.AsyncClient(
        transport=transport, base_url="https://soc.uat"
    ) as client:
        return await client.get("/uat/v1/metrics")


def _app() -> tuple[object, object]:
    composition = build_soc_uat_composition(SOC_SOURCE, clock=lambda: NOW)
    resolver = PinnedPeerResolver({_thumbprint(): composition.caller})
    app = create_soc_uat_app(
        peer_resolver=resolver,
        service=composition.service,
        fixture=composition.fixture,
        product=composition.product,
        clock=lambda: NOW,
        soc_call_count=lambda: composition.reader.call_count,
    )
    return app, composition


def test_real_soc_service_runs_fixed_read_only_fixture_and_keeps_digests_distinct() -> (
    None
):
    app, composition = _app()

    response = asyncio.run(_post(app, _body()))

    assert response.status_code == 200
    assert response.json() == {
        "outcome": "available",
        "completed_at": "2026-08-03T12:00:00Z",
        "context": {
            "alert_id": "alert-0001",
            "alert_digest": "sha256:" + "3" * 64,
            "title": "Suspicious privileged sign-in",
            "severity": "high",
            "status": "open",
            "observed_at": "2026-07-26T05:58:00Z",
            "event_refs": [
                {
                    "type": "ocsf.event",
                    "id": "event-9001",
                    "digest": "sha256:" + "5" * 64,
                }
            ],
            "entity_refs": [
                {
                    "type": "soc.asset",
                    "id": "asset-77",
                    "digest": "sha256:" + "6" * 64,
                }
            ],
            "case_refs": [],
        },
        "data_marking": {"classification": "internal", "tlp": "TLP:GREEN"},
        "soc_context_digest": response.json()["soc_context_digest"],
    }
    assert response.json()["soc_context_digest"].startswith("sha256:")
    assert response.json()["soc_context_digest"] != _body()["binding_digest"]
    assert set(response.json()["context"]) == {
        "alert_id",
        "alert_digest",
        "title",
        "severity",
        "status",
        "observed_at",
        "event_refs",
        "entity_refs",
        "case_refs",
    }
    assert "hostname" not in response.json()["context"]
    assert type(composition.service).__module__.startswith(
        "cybrik_soc.modules.alert.context"
    )
    assert composition.reader.call_count == 1


def test_replay_uses_atomic_soc_cache_and_returns_exact_packet() -> None:
    app, composition = _app()

    first = asyncio.run(_post(app, _body())).json()
    second = asyncio.run(_post(app, _body())).json()

    assert second == first
    assert composition.reader.call_count == 1
    assert composition.cache.entry_count == 1


def test_metrics_route_is_mtls_protected_and_exposes_only_soc_call_count() -> None:
    app, _composition = _app()
    unknown = (
        "-----BEGIN CERTIFICATE-----\n"
        "dW5rbm93bi11YXQtY2VydA==\n"
        "-----END CERTIFICATE-----\n"
    )

    before = asyncio.run(_metrics(app))
    positive = asyncio.run(_post(app, _body()))
    after = asyncio.run(_metrics(app))
    denied = asyncio.run(_metrics(app, cert=unknown))

    assert before.status_code == 200
    assert before.json() == {"soc_calls": 0}
    assert positive.status_code == 200
    assert after.json() == {"soc_calls": 1}
    assert denied.status_code == 401
    assert denied.json() == {"code": "uat_peer_unavailable"}


@pytest.mark.parametrize(
    "override",
    [
        {"tenant_id": "22222222-2222-4222-8222-222222222222"},
        {
            "actor": {
                "type": "agent",
                "id": "caller-controlled",
                "tenant_id": UAT_TENANT_ID,
                "delegated_by": None,
            }
        },
        {"org_scope": {"org_id": "foreign-org", "include_descendants": False}},
        {"org_scope": {"org_id": UAT_ORG_ID, "include_descendants": True}},
        {"clearance": {"classification": "restricted", "tlp": "TLP:RED"}},
        {"purpose": "caller-selected-purpose"},
        {
            "alert_ref": {
                "type": "soc.alert",
                "id": UAT_ALERT_ID,
                "version": "17",
                "digest": "sha256:" + "f" * 64,
            }
        },
    ],
)
def test_every_advisory_copy_must_equal_server_held_authority(
    override: dict[str, Any],
) -> None:
    app, composition = _app()

    response = asyncio.run(_post(app, _body(**override)))

    assert response.status_code == 403
    assert response.json() == {"code": "uat_authority_mismatch"}
    assert composition.reader.call_count == 0


def test_absent_fixed_alert_is_generic_unavailable_without_existence_detail() -> None:
    app, composition = _app()
    other = _body(
        alert_ref={
            "type": "soc.alert",
            "id": "alert-0002",
            "version": "17",
            "digest": "sha256:" + "a" * 64,
        }
    )

    response = asyncio.run(_post(app, other))

    assert response.status_code == 403
    assert response.json() == {"code": "uat_authority_mismatch"}
    assert composition.reader.call_count == 0
