"""F1: an authenticated peer cannot widen actor authority by body copy."""

from __future__ import annotations

import asyncio
from pathlib import Path

from test_fabric_composition import asgi_request, build_composition


def test_actor_copy_mismatch_is_403_without_soc_or_journal_mutation(
    tmp_path: Path,
) -> None:
    journal_root = tmp_path / "journal"
    composition, request, _principal, soc, _dispatch, _identity = build_composition(
        journal_root
    )
    request["actor"] = {
        "type": "service",
        "id": "body-asserted-actor",
        "tenant_id": request["tenant_id"],
    }

    response = asyncio.run(
        asgi_request(
            composition,
            "POST",
            "/api/v1/invocations",
            headers={"Idempotency-Key": request["idempotency_key"]},
            json=request,
        )
    )

    assert response.status_code == 403
    assert response.json()["status"] == "denied"
    assert response.json()["error"] == {
        "code": "ACTOR_BINDING_MISMATCH",
        "retryable": False,
    }
    assert soc.calls == []
    assert not journal_root.exists() or tuple(journal_root.rglob("*.json")) == ()
