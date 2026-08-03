"""UAT-only HTTP/ASGI wrapper around SOC's real alert-context service."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from .composition import PinnedPeerResolver, SocProductBindings, SocUatFixture

_Digest = Annotated[str, Field(pattern=r"^sha256:[0-9a-f]{64}$")]
_NonEmpty = Annotated[str, Field(min_length=1, max_length=256)]
_METRICS_ROUTE = "/uat/v1/metrics"


def _zero_calls() -> int:
    return 0


class _ClosedModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class _Actor(_ClosedModel):
    type: Literal["user", "service", "agent"]
    id: _NonEmpty
    tenant_id: _NonEmpty
    delegated_by: str | None = None


class _OrgScope(_ClosedModel):
    org_id: _NonEmpty
    include_descendants: bool


class _Clearance(_ClosedModel):
    classification: Literal["public", "internal", "confidential", "restricted"]
    tlp: Literal["TLP:CLEAR", "TLP:GREEN", "TLP:AMBER", "TLP:AMBER+STRICT", "TLP:RED"]


class _AlertRef(_ClosedModel):
    type: Literal["soc.alert"]
    id: _NonEmpty
    version: _NonEmpty
    digest: _Digest


class _AlertContextQuery(_ClosedModel):
    """Exact JSON projection of Fabric's immutable ``AlertContextQuery``."""

    tenant_id: _NonEmpty
    org_scope: _OrgScope
    actor: _Actor
    clearance: _Clearance
    alert_ref: _AlertRef
    request_id: _NonEmpty
    idempotency_key: Annotated[str, Field(min_length=16, max_length=200)]
    purpose: Annotated[str, Field(min_length=1, max_length=200)]
    requested_at: _NonEmpty
    binding_digest: _Digest


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("clock must return an aware timestamp")
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _actor_copy(caller: object, *, tenant_id: str) -> dict[str, Any]:
    actor = caller.actor
    return {
        "type": actor.type,
        "id": actor.id,
        "tenant_id": tenant_id,
        "delegated_by": actor.delegated_by,
    }


def _copies_agree(
    body: _AlertContextQuery,
    *,
    caller: object,
    fixture: SocUatFixture,
) -> bool:
    ceiling = caller.clearance_ceiling
    if ceiling is None:
        return False
    return (
        body.tenant_id == fixture.tenant_id
        and body.actor.model_dump() == _actor_copy(caller, tenant_id=fixture.tenant_id)
        and body.org_scope.model_dump()
        == {"org_id": caller.org_node_id, "include_descendants": False}
        and body.clearance.model_dump()
        == {"classification": ceiling.classification, "tlp": ceiling.tlp}
        and body.purpose == caller.purpose
        and body.alert_ref.model_dump()
        == {
            "type": fixture.alert_ref_type,
            "id": fixture.alert_id,
            "version": fixture.alert_version,
            "digest": fixture.alert_digest,
        }
    )


def create_soc_uat_app(
    *,
    peer_resolver: PinnedPeerResolver,
    service: object,
    fixture: SocUatFixture,
    product: SocProductBindings,
    clock: Callable[[], datetime],
    soc_call_count: Callable[[], int] = _zero_calls,
) -> FastAPI:
    """Create the inert Suite-owned UAT ingress; no listener is started here."""

    app = FastAPI(title="CYBRIK SOC UAT composition", docs_url=None, redoc_url=None)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(
        _request: Request, _error: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"code": "uat_request_invalid"})

    @app.get(_METRICS_ROUTE, include_in_schema=False)
    async def metrics(request: Request) -> JSONResponse:
        try:
            caller = peer_resolver.resolve(request.scope)
        except Exception:  # noqa: BLE001 - exact generic mTLS denial.
            caller = None
        if caller is None or not isinstance(caller, product.CallerContext):
            return JSONResponse(
                status_code=401, content={"code": "uat_peer_unavailable"}
            )
        try:
            count = soc_call_count()
        except Exception:  # noqa: BLE001 - collaborator detail is not exposed.
            count = None
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            return JSONResponse(
                status_code=503, content={"code": "uat_metrics_unavailable"}
            )
        return JSONResponse(status_code=200, content={"soc_calls": count})

    @app.post("/uat/v1/alert-context")
    async def alert_context(body: _AlertContextQuery, request: Request) -> JSONResponse:
        caller = peer_resolver.resolve(request.scope)
        if caller is None or not isinstance(caller, product.CallerContext):
            return JSONResponse(
                status_code=401, content={"code": "uat_peer_unavailable"}
            )
        if not _copies_agree(body, caller=caller, fixture=fixture):
            return JSONResponse(
                status_code=403, content={"code": "uat_authority_mismatch"}
            )

        product_request = product.AlertContextRequest(
            alert_id=fixture.alert_uuid,
            include_descendants=False,
            idempotency_key=body.idempotency_key,
        )
        try:
            packet = service.get_alert_context(caller, product_request)
        except product.IdempotencyBindingConflict:
            return JSONResponse(
                status_code=409,
                content={
                    "outcome": "idempotency_conflict",
                    "completed_at": _timestamp(clock()),
                },
            )
        except product.AlertContextUnavailable:
            return JSONResponse(
                status_code=404,
                content={"outcome": "unavailable", "completed_at": _timestamp(clock())},
            )
        # The product service intentionally collapses collaborator failures.  The
        # UAT wrapper preserves that non-oracle property across the HTTP seam.
        except Exception:  # noqa: BLE001
            return JSONResponse(
                status_code=503, content={"code": "uat_service_unavailable"}
            )

        # SOC's packet digest covers the SOC projection.  It is intentionally
        # named separately; Fabric computes its own accepted result projection
        # digest and MUST pass context_digest=None to AlertContextAnswer.available.
        return JSONResponse(
            status_code=200,
            content={
                "outcome": "available",
                "completed_at": _timestamp(packet.generated_at),
                "context": dict(packet.payload),
                "data_marking": {
                    "classification": packet.marking.classification,
                    "tlp": packet.marking.tlp,
                },
                "soc_context_digest": packet.digest,
            },
        )

    return app
