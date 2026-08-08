"""One-shot Suite UAT caller for the AI composition ingress.

The caller is deliberately not a SOC product client and contains no credential
or authority logic.  Transport identity is supplied by the bounded harness.
"""

from __future__ import annotations

import copy
import threading
from collections.abc import Mapping
from typing import Any, Protocol

from cybrik_ai_core.contract.common import (
    Actor,
    ActorType,
    Classification,
    Correlation,
    DataMarking,
    ObjectRef,
    RedactionPolicy,
    Tlp,
    TokenLimits,
)
from cybrik_ai_core.contract.summarization import (
    AlertSummarizationRequest,
    SummaryStyle,
)
from cybrik_ai_core.prompts import SUMMARIZATION_V1

_ROUTE = "/uat/v1/summarizations"


class UatDriverError(RuntimeError):
    """The bounded driver was reused or its only attempt was not admitted."""


class DriverResponse(Protocol):
    status_code: int

    def json(self) -> object: ...


class DriverClient(Protocol):
    def post(self, path: str, *, json: dict[str, Any]) -> DriverResponse: ...


def build_summarization_request(
    *,
    tenant_id: str,
    actor_id: str,
    alert_id: str,
    alert_digest: str,
    alert_version: str = "17",
) -> dict[str, Any]:
    """Build the fixed, digest-bound request used by the local UAT driver."""

    request = AlertSummarizationRequest(
        request_id="sum-uat-0001",
        idempotency_key="idem-sum-uat-alert-context-0001",
        tenant_id=tenant_id,
        actor=Actor(type=ActorType.agent, id=actor_id, tenant_id=tenant_id),
        purpose="alert_triage_summary",
        model_class="summarization.soc_alert",
        prompt_template={
            "id": SUMMARIZATION_V1.id,
            "version": SUMMARIZATION_V1.version,
            "digest": SUMMARIZATION_V1.digest,
        },
        alert_refs=[
            ObjectRef(
                type="soc.alert",
                id=alert_id,
                version=alert_version,
                digest=alert_digest,
            )
        ],
        summary_style=SummaryStyle.triage,
        data_marking=DataMarking(
            classification=Classification.confidential,
            tlp=Tlp.amber,
        ),
        redaction_policy=RedactionPolicy(profile="soc.pii_strip", on_unresolved="deny"),
        requested_features=[],
        limits=TokenLimits(
            max_input_tokens=16000,
            max_output_tokens=1200,
            max_context_tokens=32000,
        ),
        deadline_seconds=90,
        correlation=Correlation(correlation_id="corr-uat-alert-context-0001"),
    )
    return request.model_dump(mode="json")


class OneShotUatDriver:
    """Perform exactly one POST; failures are terminal and never retried."""

    def __init__(self, client: DriverClient) -> None:
        self._client = client
        self._consumed = False
        self._lock = threading.Lock()

    def run(self, request: Mapping[str, Any]) -> dict[str, Any]:
        with self._lock:
            if self._consumed:
                raise UatDriverError("UAT driver is already consumed")
            self._consumed = True
        if not isinstance(request, Mapping):
            raise UatDriverError("UAT request must be a mapping")
        response = self._client.post(_ROUTE, json=copy.deepcopy(dict(request)))
        if response.status_code != 200:
            raise UatDriverError(f"UAT attempt returned status {response.status_code}")
        try:
            document = response.json()
        except (TypeError, ValueError):
            raise UatDriverError("UAT response is not JSON") from None
        if not isinstance(document, Mapping) or document.get("outcome") != "completed":
            raise UatDriverError("UAT response was not a completed result")
        return copy.deepcopy(dict(document))


__all__ = ["OneShotUatDriver", "UatDriverError", "build_summarization_request"]
