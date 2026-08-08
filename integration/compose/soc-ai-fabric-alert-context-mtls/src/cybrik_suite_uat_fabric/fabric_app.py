"""Suite-owned composition of the Fabric R0 runtime producer for bounded UAT.

Status: UAT-ONLY / NOT PRODUCTION / NO LISTENER.  The product's real route,
domain, receipt and fsync-reference implementations are composed here without
copying their source or changing the Fabric default application.  Every source
of authority and every runtime fact remains injected.
"""

from __future__ import annotations

import copy
import re
import threading
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final, Protocol

from cybrik_fabric_control.invocation.fsync_journal import (
    FsyncAppendOnlyReceiptJournal,
    RetentionMetadata,
)
from cybrik_fabric_control.invocation.models import (
    AlertContextAnswer,
    AlertContextQuery,
)
from cybrik_fabric_control.invocation.ports import (
    IdempotencyStore,
    KillSwitchPort,
    ReceiptVerifier,
    SocAlertContextPort,
)
from cybrik_fabric_control.invocation.service import R0AlertContextInvocationService
from cybrik_fabric_control.runtime_adapters import (
    DispatchEnvironmentFactory,
    ProcessLocalFsyncReceiptReader,
    ProcessLocalFsyncStores,
    R0InvocationProducerAdapter,
)
from cybrik_fabric_control.runtime_routes import (
    PrincipalGrantResolver,
    create_runtime_producer_app,
)
from fastapi import FastAPI

_SOC_PATH: Final = "/uat/v1/alert-context"
_SHA256: Final = re.compile(r"sha256:[0-9a-f]{64}\Z")
_UTC_TIMESTAMP: Final = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z\Z"
)
_MARKING_CLASSIFICATIONS: Final = frozenset(
    {"public", "internal", "confidential", "restricted"}
)
_MARKING_TLP: Final = frozenset(
    {"TLP:CLEAR", "TLP:GREEN", "TLP:AMBER", "TLP:AMBER+STRICT", "TLP:RED"}
)


class SocTransportError(RuntimeError):
    """The bounded Fabric-to-SOC read transport failed closed."""


class SocHttpResponse(Protocol):
    status_code: int

    def json(self) -> object:
        """Return the decoded response document."""
        ...


class SocHttpClient(Protocol):
    """Injected synchronous client; runtime supplies its mTLS configuration."""

    def post(self, path: str, *, json: dict[str, Any]) -> SocHttpResponse:
        """Perform exactly one request with no retry or alternate route."""
        ...


@dataclass(frozen=True, slots=True)
class SocTransportObservation:
    request_id: str
    binding_digest: str
    soc_context_digest: str


def _query_document(query: AlertContextQuery) -> dict[str, Any]:
    if type(query) is not AlertContextQuery:
        raise SocTransportError("SOC query refused")
    return {
        "tenant_id": query.tenant_id,
        "org_scope": copy.deepcopy(query.org_scope),
        "actor": copy.deepcopy(query.actor),
        "clearance": copy.deepcopy(query.clearance),
        "alert_ref": copy.deepcopy(query.alert_ref),
        "request_id": query.request_id,
        "idempotency_key": query.idempotency_key,
        "purpose": query.purpose,
        "requested_at": query.requested_at,
        "binding_digest": query.binding_digest,
    }


def _timestamp(document: Mapping[str, object]) -> str:
    value = document.get("completed_at")
    if not isinstance(value, str) or _UTC_TIMESTAMP.fullmatch(value) is None:
        raise SocTransportError("SOC response refused")
    return value


def _available_answer(document: Mapping[str, object]) -> tuple[AlertContextAnswer, str]:
    if (
        set(document)
        != {
            "outcome",
            "completed_at",
            "context",
            "data_marking",
            "soc_context_digest",
        }
        or document.get("outcome") != "available"
    ):
        raise SocTransportError("SOC response refused")
    context = document.get("context")
    marking = document.get("data_marking")
    digest = document.get("soc_context_digest")
    if (
        not isinstance(context, dict)
        or not isinstance(marking, dict)
        or set(marking) != {"classification", "tlp"}
        or marking.get("classification") not in _MARKING_CLASSIFICATIONS
        or marking.get("tlp") not in _MARKING_TLP
        or not isinstance(digest, str)
        or _SHA256.fullmatch(digest) is None
    ):
        raise SocTransportError("SOC response refused")
    return (
        AlertContextAnswer.available(
            context=copy.deepcopy(context),
            completed_at=_timestamp(document),
            data_marking=copy.deepcopy(marking),
            context_digest=None,
        ),
        digest,
    )


class HttpSocAlertContextPort:
    """Concrete Fabric→SOC R0 port over one injected mTLS-capable HTTP client."""

    def __init__(self, *, client: SocHttpClient) -> None:
        if not callable(getattr(client, "post", None)):
            raise TypeError("SOC HTTP client must provide post")
        self._client = client
        self._lock = threading.Lock()
        self._observations: tuple[SocTransportObservation, ...] = ()

    @property
    def observations(self) -> tuple[SocTransportObservation, ...]:
        with self._lock:
            return self._observations

    def get_alert_context(self, query: AlertContextQuery) -> AlertContextAnswer:
        document = _query_document(query)
        try:
            response = self._client.post(_SOC_PATH, json=copy.deepcopy(document))
            status_code = response.status_code
            decoded = response.json()
        except Exception as exc:
            raise SocTransportError("SOC transport unavailable") from exc
        if not isinstance(decoded, Mapping):
            raise SocTransportError("SOC response refused")
        if status_code == 404:
            if (
                set(decoded) != {"outcome", "completed_at"}
                or decoded.get("outcome") != "unavailable"
            ):
                raise SocTransportError("SOC response refused")
            return AlertContextAnswer.unavailable(completed_at=_timestamp(decoded))
        if status_code != 200:
            raise SocTransportError("SOC transport unavailable")
        answer, soc_digest = _available_answer(decoded)
        observation = SocTransportObservation(
            request_id=query.request_id,
            binding_digest=query.binding_digest,
            soc_context_digest=soc_digest,
        )
        with self._lock:
            self._observations = (*self._observations, observation)
        return answer


@dataclass(frozen=True)
class FabricUatComposition:
    """Observable UAT bundle; constructing it opens no socket or background task."""

    app: FastAPI
    journal: FsyncAppendOnlyReceiptJournal
    stores: ProcessLocalFsyncStores
    receipt_reader: ProcessLocalFsyncReceiptReader
    retention: RetentionMetadata
    service: R0AlertContextInvocationService
    invocation_producer: R0InvocationProducerAdapter


def _identity_snapshot(collaborator: object, *, label: str) -> tuple[Any, ...]:
    """Read only the public, trust-pinned identity required by the F8 profile."""
    try:
        return (
            collaborator.algorithm,
            dict(collaborator.key_type),
            collaborator.kid,
            dict(collaborator.trust_bundle_ref),
        )
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError(
            f"{label} has no usable trust-pinned Ed25519 identity"
        ) from exc


def create_fabric_uat_app(
    *,
    journal_root: Path,
    principal_resolver: PrincipalGrantResolver,
    soc_port: SocAlertContextPort,
    dispatch_factory: DispatchEnvironmentFactory,
    receipt_signer: object,
    receipt_verifier: ReceiptVerifier,
    kill_switch: KillSwitchPort,
    idempotency_store: IdempotencyStore,
    retention: RetentionMetadata,
    receipt_scan_limit: int = 1000,
) -> FabricUatComposition:
    """Compose the real Fabric producer behind an in-process ASGI application.

    ``receipt_signer`` is intentionally structural because its product protocol
    is defined next to the materializer.  The signer and verifier must expose
    the exact same caller-pinned identity before any journal object is created.
    Key material remains inside those injected collaborators.
    """
    if not isinstance(journal_root, Path):
        raise TypeError("journal_root must be an explicit pathlib.Path")
    if type(retention) is not RetentionMetadata:
        raise TypeError("retention must be exact immutable Fabric metadata")
    signer_identity = _identity_snapshot(receipt_signer, label="receipt_signer")
    verifier_identity = _identity_snapshot(receipt_verifier, label="receipt_verifier")
    if signer_identity != verifier_identity:
        raise ValueError("receipt signer and verifier trust identities differ")
    trust_bundle = signer_identity[3]
    if retention.trust_bundle_digest != trust_bundle.get("bundle_digest"):
        raise ValueError("retention metadata is not pinned to the receipt trust bundle")

    journal = FsyncAppendOnlyReceiptJournal(journal_root)
    stores = ProcessLocalFsyncStores(journal=journal, retention=retention)
    receipt_reader = ProcessLocalFsyncReceiptReader(
        journal=journal,
        verifier=receipt_verifier,
        retention=retention,
        scan_limit=receipt_scan_limit,
    )
    service = R0AlertContextInvocationService(
        soc_port=soc_port,
        kill_switch=kill_switch,
        idempotency_store=idempotency_store,
        receipt_signer=receipt_signer,
        receipt_verifier=receipt_verifier,
        receipt_store=stores,
        invocation_intent_store=stores,
    )
    invocation_producer = R0InvocationProducerAdapter(
        service=service,
        dispatch_factory=dispatch_factory,
    )
    app = create_runtime_producer_app(
        invocation_producer=invocation_producer,
        receipt_reader=receipt_reader,
        principal_resolver=principal_resolver,
    )
    return FabricUatComposition(
        app=app,
        journal=journal,
        stores=stores,
        receipt_reader=receipt_reader,
        retention=retention,
        service=service,
        invocation_producer=invocation_producer,
    )
