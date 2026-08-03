"""Suite-owned composition for the SOC side of the integrated UAT.

This module imports the pinned SOC product source only through an explicit,
absolute source-root injection.  It adds no product API: the reader, cache and
HTTP wrapper are UAT adapters around the real ``AlertContextService``.
"""

from __future__ import annotations

import importlib
import sys
import threading
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from types import MappingProxyType, ModuleType
from typing import Any, Final

from . import tls_process

UAT_TENANT_ID: Final = "tenant-acme"
UAT_ALERT_ID: Final = "alert-0001"
UAT_TENANT_UUID: Final = uuid.UUID("11111111-1111-4111-8111-111111111111")
UAT_ALERT_UUID: Final = uuid.UUID("aaaaaaaa-0000-4000-8000-000000000001")
UAT_ORG_ID: Final = "org-soc-east"
UAT_PURPOSE: Final = "alert_triage"
FABRIC_ACTOR_ID: Final = "membership-analyst-42"
UAT_ALERT_DIGEST: Final = "sha256:" + "3" * 64


class SocCompositionError(RuntimeError):
    """Stable, non-reflecting refusal at the Suite/product composition seam."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class SocProductBindings:
    """The exact product symbols used by this UAT composition."""

    source_root: Path
    AlertContextRecord: type
    AlertContextRequest: type
    AlertContextService: type
    AlertContextUnavailable: type[Exception]
    CachedContext: type
    CallerActor: type
    CallerContext: type
    IdempotencyBindingConflict: type[Exception]
    MarkedField: type
    Marking: type
    BoundaryKind: type
    ScopeKind: type


@dataclass(frozen=True, slots=True)
class SocUatFixture:
    """Identity of the single synthetic, read-only UAT alert."""

    tenant_id: str
    tenant_uuid: uuid.UUID
    alert_id: str
    alert_uuid: uuid.UUID
    alert_ref_type: str
    alert_version: str
    alert_digest: str
    org_id: str
    record: object


@dataclass(frozen=True, slots=True)
class SocUatComposition:
    """Collaborators for one inert SOC UAT application."""

    product: SocProductBindings
    caller: object
    fixture: SocUatFixture
    reader: FixedAlertContextReader
    cache: AtomicProcessLocalContextCache
    service: object


def _module_is_from(module: ModuleType, source_root: Path) -> bool:
    location = getattr(module, "__file__", None)
    if not isinstance(location, str):
        return False
    try:
        Path(location).resolve(strict=True).relative_to(source_root)
    except (OSError, ValueError):
        return False
    return True


def load_soc_product(source_root: Path) -> SocProductBindings:
    """Load the real SOC slice from one caller-injected absolute source root.

    A previously imported ``cybrik_soc`` from any other tree is rejected.  This
    prevents Python's module cache from silently substituting a different product
    checkout for the tuple admitted by the outer harness.
    """

    if not isinstance(source_root, Path) or not source_root.is_absolute():
        raise SocCompositionError("soc_source_root_invalid")
    try:
        root = source_root.resolve(strict=True)
    except OSError as exc:
        raise SocCompositionError("soc_source_root_invalid") from exc
    if not root.is_dir() or not (root / "cybrik_soc").is_dir():
        raise SocCompositionError("soc_source_root_invalid")

    loaded = sys.modules.get("cybrik_soc")
    if loaded is not None and not _module_is_from(loaded, root):
        raise SocCompositionError("soc_product_module_origin_mismatch")

    inserted = False
    root_text = str(root)
    if root_text not in sys.path:
        sys.path.insert(0, root_text)
        inserted = True
    try:
        context = importlib.import_module("cybrik_soc.modules.alert.context")
        org_contract = importlib.import_module("cybrik_soc.modules.org.contract")
    except Exception as exc:
        raise SocCompositionError("soc_product_import_failed") from exc
    finally:
        if inserted:
            try:
                sys.path.remove(root_text)
            except (
                ValueError
            ):  # pragma: no cover - defensive against hostile import hooks
                pass

    if not _module_is_from(context, root) or not _module_is_from(org_contract, root):
        raise SocCompositionError("soc_product_module_origin_mismatch")
    names = (
        "AlertContextRecord",
        "AlertContextRequest",
        "AlertContextService",
        "AlertContextUnavailable",
        "CachedContext",
        "CallerActor",
        "CallerContext",
        "IdempotencyBindingConflict",
        "MarkedField",
        "Marking",
    )
    if any(not hasattr(context, name) for name in names):
        raise SocCompositionError("soc_product_surface_incomplete")
    if not hasattr(org_contract, "BoundaryKind") or not hasattr(
        org_contract, "ScopeKind"
    ):
        raise SocCompositionError("soc_product_surface_incomplete")
    return SocProductBindings(
        source_root=root,
        **{name: getattr(context, name) for name in names},
        BoundaryKind=org_contract.BoundaryKind,
        ScopeKind=org_contract.ScopeKind,
    )


class FixedAlertContextReader:
    """Exact implementation of the SOC read port over one immutable fixture."""

    def __init__(self, fixture: SocUatFixture) -> None:
        self._fixture = fixture
        self._lock = threading.Lock()
        self._call_count = 0

    @property
    def call_count(self) -> int:
        with self._lock:
            return self._call_count

    def fetch(
        self,
        *,
        tenant_id: uuid.UUID,
        alert_id: uuid.UUID,
        org_node_id: str | None,
        scope_kind: str | None,
        include_descendants: bool,
    ) -> object | None:
        with self._lock:
            self._call_count += 1
        if (
            tenant_id != self._fixture.tenant_uuid
            or alert_id != self._fixture.alert_uuid
            or org_node_id != self._fixture.org_id
            or scope_kind != "own-node"
            or include_descendants is not False
        ):
            return None
        return self._fixture.record


class AtomicProcessLocalContextCache:
    """Atomic, process-local implementation of the SOC idempotency port.

    It is intentionally not durable and cannot support production or multi-host
    claims.  ``setdefault`` runs under one lock, so the exact canonical winner is
    returned without a get-then-put race.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: dict[tuple[uuid.UUID, str], object] = {}

    @property
    def entry_count(self) -> int:
        with self._lock:
            return len(self._entries)

    def get(self, *, tenant_id: uuid.UUID, idempotency_key: str) -> object | None:
        with self._lock:
            return self._entries.get((tenant_id, idempotency_key))

    def put_if_absent(
        self,
        *,
        tenant_id: uuid.UUID,
        idempotency_key: str,
        entry: object,
    ) -> object:
        with self._lock:
            return self._entries.setdefault((tenant_id, idempotency_key), entry)


class PinnedPeerResolver:
    """Map the canonical TLS helper's peer authority to a SOC caller."""

    def __init__(self, identities: Mapping[str, object]) -> None:
        copied = dict(identities)
        if not copied:
            raise SocCompositionError("peer_identity_map_invalid")
        fingerprint_to_principal: dict[str, str] = {}
        principal_to_identity: dict[str, object] = {}
        for index, (fingerprint, identity) in enumerate(copied.items()):
            if (
                not isinstance(fingerprint, str)
                or len(fingerprint) != 64
                or fingerprint.lower() != fingerprint
            ):
                raise SocCompositionError("peer_identity_map_invalid")
            try:
                int(fingerprint, 16)
            except ValueError as exc:
                raise SocCompositionError("peer_identity_map_invalid") from exc
            principal = f"soc-pinned-peer-{index:04d}"
            fingerprint_to_principal[fingerprint] = principal
            principal_to_identity[principal] = identity
        self._fingerprint_to_principal = MappingProxyType(fingerprint_to_principal)
        self._principal_to_identity = MappingProxyType(principal_to_identity)

    def resolve(self, scope: Mapping[str, Any]) -> object | None:
        if type(scope) is not dict or scope.get("type") != "http":
            return None
        try:
            authority = tls_process.peer_authority_from_scope(
                scope, self._fingerprint_to_principal
            )
        except tls_process.TlsBoundaryFailure:
            return None
        return self._principal_to_identity.get(authority.principal)


def _default_clock() -> datetime:
    return datetime.now(UTC)


def build_soc_uat_composition(
    source_root: Path,
    *,
    clock: Callable[[], datetime] = _default_clock,
) -> SocUatComposition:
    """Compose the real product service with the one read-only UAT fixture."""

    product = load_soc_product(source_root)
    internal = product.Marking(classification="internal", tlp="TLP:GREEN")
    restricted = product.Marking(classification="restricted", tlp="TLP:RED")
    record = product.AlertContextRecord(
        alert_id=UAT_ALERT_UUID,
        tenant_id=UAT_TENANT_UUID,
        org_node_id=UAT_ORG_ID,
        fields=(
            product.MarkedField(name="alert_id", value=UAT_ALERT_ID, marking=internal),
            product.MarkedField(
                name="alert_digest", value=UAT_ALERT_DIGEST, marking=internal
            ),
            product.MarkedField(
                name="title", value="Suspicious privileged sign-in", marking=internal
            ),
            product.MarkedField(name="severity", value="high", marking=internal),
            product.MarkedField(name="status", value="open", marking=internal),
            product.MarkedField(
                name="observed_at", value="2026-07-26T05:58:00Z", marking=internal
            ),
            product.MarkedField(
                name="event_refs",
                value=(
                    {
                        "type": "ocsf.event",
                        "id": "event-9001",
                        "digest": "sha256:" + "5" * 64,
                    },
                ),
                marking=internal,
            ),
            product.MarkedField(
                name="entity_refs",
                value=(
                    {
                        "type": "soc.asset",
                        "id": "asset-77",
                        "digest": "sha256:" + "6" * 64,
                    },
                ),
                marking=internal,
            ),
            product.MarkedField(name="case_refs", value=(), marking=internal),
            product.MarkedField(
                name="restricted_note", value="redacted-by-product", marking=restricted
            ),
        ),
    )
    fixture = SocUatFixture(
        tenant_id=UAT_TENANT_ID,
        tenant_uuid=UAT_TENANT_UUID,
        alert_id=UAT_ALERT_ID,
        alert_uuid=UAT_ALERT_UUID,
        alert_ref_type="soc.alert",
        alert_version="17",
        alert_digest=UAT_ALERT_DIGEST,
        org_id=UAT_ORG_ID,
        record=record,
    )
    caller = product.CallerContext(
        tenant_id=UAT_TENANT_UUID,
        actor=product.CallerActor(
            type="agent",
            id=FABRIC_ACTOR_ID,
            tenant_id=UAT_TENANT_UUID,
            delegated_by=None,
        ),
        clearance_ceiling=product.Marking(
            classification="confidential", tlp="TLP:AMBER"
        ),
        boundary=product.BoundaryKind.INTERNAL,
        hierarchy_enabled=True,
        org_node_id=UAT_ORG_ID,
        scope_kind=str(product.ScopeKind.OWN_NODE),
        descendant_grant=None,
        purpose=UAT_PURPOSE,
    )
    reader = FixedAlertContextReader(fixture)
    cache = AtomicProcessLocalContextCache()
    service = product.AlertContextService(reader=reader, cache=cache, clock=clock)
    return SocUatComposition(
        product=product,
        caller=caller,
        fixture=fixture,
        reader=reader,
        cache=cache,
        service=service,
    )
