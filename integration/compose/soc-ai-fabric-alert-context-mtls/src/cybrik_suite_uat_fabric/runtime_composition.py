"""Runtime-only composition for the bounded three-process UAT.

Importing this module performs no filesystem, product-import, client, key, or
listener operation.  Product services, ephemeral receipt identity and exact
HTTP clients are created only by :func:`build_role_composition`.
"""

from __future__ import annotations

import inspect
import ssl
import sys
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from types import MappingProxyType
from typing import Any, Final

from .receipt_identity import (
    ExternalReceiptIdentity,
    ReceiptIdentityError,
    ReceiptPublicVerifier,
    ReceiptTrustDescriptor,
    create_receipt_public_verifier,
    load_external_receipt_identity,
)

LOOPBACK_HOST: Final = "127.0.0.1"
SOC_BASE_URL: Final = "https://127.0.0.1:58442"
AI_BASE_URL: Final = "https://127.0.0.1:58443"
FABRIC_BASE_URL: Final = "https://127.0.0.1:58444"
HTTP_TIMEOUT_SECONDS: Final = 5.0
ROLES: Final = ("soc", "fabric", "ai")

_CAPABILITY_DIGEST: Final = "sha256:" + "1" * 64
_POLICY_DIGEST: Final = "sha256:" + "2" * 64
_DELEGATION_REF: Final = "sha256:" + "c" * 64
_FIXED_TIME: Final = "2026-08-03T00:00:02Z"
_RECEIPT_PROBE: Final = b"cybrik-uat-receipt-verifier-probe/v1"


class RuntimeCompositionError(RuntimeError):
    """Stable fail-closed refusal at the runtime composition boundary."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class AdmittedProductRoots:
    soc: Path
    cyber_ai_api: Path
    cyber_ai_core: Path
    tool_fabric: Path

    def as_mapping(self) -> Mapping[str, Path]:
        return MappingProxyType(
            {
                "soc": self.soc,
                "cyber_ai_api": self.cyber_ai_api,
                "cyber_ai_core": self.cyber_ai_core,
                "tool_fabric": self.tool_fabric,
            }
        )


@dataclass(frozen=True, slots=True)
class ServerTlsMaterial:
    certificate: Path
    private_key: Path
    ca_certificate: Path


@dataclass(frozen=True, slots=True)
class ClientTlsMaterial:
    certificate: Path
    private_key: Path
    ca_certificate: Path


@dataclass(frozen=True, slots=True)
class HttpClientSpec:
    source_role: str
    destination_role: str
    base_url: str
    certificate: Path
    private_key: Path
    verify: Path
    peer_certificate_sha256: str
    timeout_seconds: float = HTTP_TIMEOUT_SECONDS
    retries: int = 0
    trust_env: bool = False


@dataclass(frozen=True, slots=True)
class RuntimeCompositionSettings:
    roots: AdmittedProductRoots
    journal_root: Path
    server_tls: Mapping[str, ServerTlsMaterial]
    fabric_to_soc: ClientTlsMaterial
    ai_to_fabric: ClientTlsMaterial
    driver_certificate: Path
    receipt_signing_key: Path

    def client_spec(self, source_role: str, destination_role: str) -> HttpClientSpec:
        if (source_role, destination_role) == ("fabric", "soc"):
            material = self.fabric_to_soc
            base_url = SOC_BASE_URL
        elif (source_role, destination_role) == ("ai", "fabric"):
            material = self.ai_to_fabric
            base_url = FABRIC_BASE_URL
        else:
            raise RuntimeCompositionError("client_surface_invalid")
        _validate_client_material(material)
        return HttpClientSpec(
            source_role=source_role,
            destination_role=destination_role,
            base_url=base_url,
            certificate=material.certificate,
            private_key=material.private_key,
            verify=material.ca_certificate,
            peer_certificate_sha256=_certificate_sha256(material.certificate),
        )

    def driver_certificate_sha256(self) -> str:
        _exact_file(self.driver_certificate, "driver_certificate_invalid")
        return _certificate_sha256(self.driver_certificate)


CloseCallback = Callable[[], Awaitable[None] | None]


@dataclass(frozen=True, slots=True)
class RoleComposition:
    app: object
    close_callback: CloseCallback
    metadata: Mapping[str, str]

    async def close(self) -> None:
        result = self.close_callback()
        if inspect.isawaitable(result):
            await result


SyncClientFactory = Callable[[HttpClientSpec], object]
AsyncClientFactory = Callable[[HttpClientSpec], object]


def _exact_directory(path: object, reason: str) -> Path:
    if not isinstance(path, Path) or not path.is_absolute():
        raise RuntimeCompositionError(reason)
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise RuntimeCompositionError(reason) from exc
    if resolved != path or not path.is_dir():
        raise RuntimeCompositionError(reason)
    return path


def _exact_file(path: object, reason: str) -> Path:
    if not isinstance(path, Path) or not path.is_absolute():
        raise RuntimeCompositionError(reason)
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise RuntimeCompositionError(reason) from exc
    if resolved != path or not path.is_file():
        raise RuntimeCompositionError(reason)
    return path


def _validate_server_material(material: object) -> ServerTlsMaterial:
    if not isinstance(material, ServerTlsMaterial):
        raise RuntimeCompositionError("server_tls_invalid")
    _exact_file(material.certificate, "server_tls_invalid")
    _exact_file(material.private_key, "server_tls_invalid")
    _exact_file(material.ca_certificate, "server_tls_invalid")
    return material


def _validate_client_material(material: object) -> ClientTlsMaterial:
    if not isinstance(material, ClientTlsMaterial):
        raise RuntimeCompositionError("client_tls_invalid")
    _exact_file(material.certificate, "client_tls_invalid")
    _exact_file(material.private_key, "client_tls_invalid")
    _exact_file(material.ca_certificate, "client_tls_invalid")
    return material


def _validated_roots(roots: object) -> AdmittedProductRoots:
    if not isinstance(roots, AdmittedProductRoots):
        raise RuntimeCompositionError("product_roots_invalid")
    for root in roots.as_mapping().values():
        _exact_directory(root, "product_roots_invalid")
    return roots


def _validated_journal_root(path: object, roots: AdmittedProductRoots) -> Path:
    if not isinstance(path, Path) or not path.is_absolute():
        raise RuntimeCompositionError("journal_root_invalid")
    try:
        resolved = path.resolve(strict=False)
        parent = path.parent.resolve(strict=True)
    except OSError as exc:
        raise RuntimeCompositionError("journal_root_invalid") from exc
    if resolved != path or not parent.is_dir():
        raise RuntimeCompositionError("journal_root_invalid")
    if any(path.is_relative_to(root) for root in roots.as_mapping().values()):
        raise RuntimeCompositionError("journal_root_invalid")
    return path


def _validated_settings(settings: object) -> RuntimeCompositionSettings:
    if not isinstance(settings, RuntimeCompositionSettings):
        raise RuntimeCompositionError("settings_invalid")
    roots = _validated_roots(settings.roots)
    if set(settings.server_tls) != set(ROLES):
        raise RuntimeCompositionError("server_tls_invalid")
    for material in settings.server_tls.values():
        _validate_server_material(material)
    _validate_client_material(settings.fabric_to_soc)
    _validate_client_material(settings.ai_to_fabric)
    _exact_file(settings.driver_certificate, "driver_certificate_invalid")
    _validated_journal_root(settings.journal_root, roots)
    _load_receipt_identity(settings)
    return settings


def _certificate_sha256(path: Path) -> str:
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes

        certificate = x509.load_pem_x509_certificate(path.read_bytes())
        return certificate.fingerprint(hashes.SHA256()).hex()
    except Exception as exc:
        raise RuntimeCompositionError("certificate_invalid") from exc


def _client_ssl_context(spec: HttpClientSpec) -> ssl.SSLContext:
    try:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version = ssl.TLSVersion.TLSv1_3
        context.maximum_version = ssl.TLSVersion.TLSv1_3
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
        context.load_verify_locations(cafile=str(spec.verify))
        context.load_cert_chain(
            certfile=str(spec.certificate), keyfile=str(spec.private_key)
        )
        context.set_alpn_protocols(["http/1.1"])
    except (OSError, ssl.SSLError) as exc:
        raise RuntimeCompositionError("client_tls_invalid") from exc
    return context


def create_sync_httpx_client(
    spec: HttpClientSpec, *, httpx_module: object | None = None
) -> object:
    """Create one exact synchronous mTLS client with no env/proxy or retry."""

    if not isinstance(spec, HttpClientSpec):
        raise RuntimeCompositionError("client_spec_invalid")
    if httpx_module is None:
        import httpx as httpx_module
    transport = httpx_module.HTTPTransport(  # type: ignore[attr-defined]
        retries=0,
        trust_env=False,
        verify=_client_ssl_context(spec),
    )
    return httpx_module.Client(  # type: ignore[attr-defined]
        base_url=spec.base_url,
        timeout=spec.timeout_seconds,
        transport=transport,
        trust_env=False,
    )


def create_async_httpx_client(
    spec: HttpClientSpec, *, httpx_module: object | None = None
) -> object:
    """Create one exact asynchronous mTLS client with no env/proxy or retry."""

    if not isinstance(spec, HttpClientSpec):
        raise RuntimeCompositionError("client_spec_invalid")
    if httpx_module is None:
        import httpx as httpx_module
    transport = httpx_module.AsyncHTTPTransport(  # type: ignore[attr-defined]
        retries=0,
        trust_env=False,
        verify=_client_ssl_context(spec),
    )
    return httpx_module.AsyncClient(  # type: ignore[attr-defined]
        base_url=spec.base_url,
        timeout=spec.timeout_seconds,
        transport=transport,
        trust_env=False,
    )


def _install_product_roots(roots: AdmittedProductRoots) -> None:
    from .bootstrap import prepend_import_roots

    prepend_import_roots(
        sys.path,
        (
            roots.soc,
            roots.cyber_ai_api,
            roots.cyber_ai_core,
            roots.tool_fabric,
        ),
    )


def _fixed_datetime() -> datetime:
    return datetime(2026, 8, 3, 0, 0, 2, tzinfo=UTC)


def _suite_root() -> Path:
    return Path(__file__).absolute().parents[5]


def _receipt_forbidden_roots(roots: AdmittedProductRoots) -> tuple[Path, ...]:
    return (*roots.as_mapping().values(), _suite_root())


def _load_receipt_identity(
    settings: RuntimeCompositionSettings,
) -> ExternalReceiptIdentity:
    try:
        return load_external_receipt_identity(
            settings.receipt_signing_key,
            forbidden_roots=_receipt_forbidden_roots(settings.roots),
        )
    except ReceiptIdentityError as exc:
        raise RuntimeCompositionError(exc.reason) from exc


def load_receipt_trust_descriptor(
    settings: RuntimeCompositionSettings,
) -> ReceiptTrustDescriptor:
    """Load an exact external signer and retain only its public descriptor."""

    if not isinstance(settings, RuntimeCompositionSettings):
        raise RuntimeCompositionError("settings_invalid")
    _validated_roots(settings.roots)
    return _load_receipt_identity(settings).trust_descriptor


class _PinnedFabricPrincipalResolver:
    def __init__(self, fingerprint: str, principal: object) -> None:
        self._fingerprint = fingerprint
        self._principal = principal

    def resolve(self, request: object) -> object:
        from .tls_process import peer_authority_from_scope

        scope = getattr(request, "scope", None)
        authority = peer_authority_from_scope(
            scope, {self._fingerprint: "cyber-ai-uat"}
        )
        if authority.principal != "cyber-ai-uat":
            raise PermissionError("peer is not admitted")
        return self._principal


class _DispatchFactory:
    def create(self, **_kwargs: Any) -> object:
        from cybrik_fabric_control.invocation.models import DispatchEnvironment

        return DispatchEnvironment(
            receipt_id="rcpt-alert-context-uat-runtime-0001",
            policy_decision_id="pdp-alert-context-uat-runtime-0001",
            started_at="2026-08-03T00:00:00Z",
            finished_at="2026-08-03T00:00:01Z",
            executor_id="spiffe://cybrik.example/executor/uat-r0",
            isolation_profile="S0",
        )


class _PermittedKillSwitch:
    def state(self, *, capability_name: str, tenant_id: str) -> object:
        del capability_name, tenant_id
        from cybrik_fabric_control.invocation.models import KillSwitchState

        return KillSwitchState.PERMITTED


class _DeterministicModelRuntime:
    name = "deterministic-three-product-uat"

    def __init__(self) -> None:
        self.requests: list[object] = []

    async def agenerate(self, request: object) -> object:
        from cybrik_ai_core.modelrt.types import (
            FinishReason,
            GenerateResponse,
            RuntimeUsage,
        )

        self.requests.append(request)
        return GenerateResponse(
            content="Verified UAT alert summary.",
            finish_reason=FinishReason.stop,
            model_returned="deterministic-three-product-uat:v1",
            usage=RuntimeUsage(input_tokens=20, output_tokens=6, total_tokens=26),
        )

    async def capabilities(self, model: str) -> object:
        del model
        raise RuntimeError("governed capability resolver must be used")

    async def health(self) -> object:
        raise RuntimeError("governed health resolver must be used")


def _closed_sync(client: object) -> CloseCallback:
    def close() -> None:
        closer = getattr(client, "close", None)
        if callable(closer):
            closer()

    return close


def _closed_async(client: object) -> CloseCallback:
    async def close() -> None:
        closer = getattr(client, "aclose", None)
        if callable(closer):
            result = closer()
            if inspect.isawaitable(result):
                await result

    return close


def _build_soc(settings: RuntimeCompositionSettings) -> RoleComposition:
    from .composition import PinnedPeerResolver, build_soc_uat_composition
    from .soc_service_app import create_soc_uat_app

    composition = build_soc_uat_composition(settings.roots.soc, clock=_fixed_datetime)
    fingerprint = settings.client_spec("fabric", "soc").peer_certificate_sha256
    app = create_soc_uat_app(
        peer_resolver=PinnedPeerResolver({fingerprint: composition.caller}),
        service=composition.service,
        fixture=composition.fixture,
        product=composition.product,
        clock=_fixed_datetime,
        soc_call_count=lambda: composition.reader.call_count,
    )
    return RoleComposition(
        app=app,
        close_callback=lambda: None,
        metadata=MappingProxyType(
            {
                "peer_certificate_sha256": fingerprint,
                "service_module": "cybrik_soc.modules.alert.context",
            }
        ),
    )


def _build_fabric(
    settings: RuntimeCompositionSettings, client_factory: SyncClientFactory
) -> RoleComposition:
    from cybrik_fabric_control.invocation import models
    from cybrik_fabric_control.invocation.fsync_journal import RetentionMetadata
    from cybrik_fabric_control.invocation.ports import (
        DevTestOnlyInMemoryIdempotencyStore,
    )
    from cybrik_fabric_control.runtime_routes import TransportPrincipal

    from .fabric_app import HttpSocAlertContextPort, create_fabric_uat_app

    spec = settings.client_spec("fabric", "soc")
    client = client_factory(spec)
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
        capability_digest=_CAPABILITY_DIGEST,
        policy_digest=_POLICY_DIGEST,
        delegation_ref=_DELEGATION_REF,
        delegation_kind=models.DelegationKind.FABRIC_TOOL_GRANT,
    )
    principal = TransportPrincipal(
        tenant_id="tenant-acme",
        subject="spiffe://cybrik.example/cyber-ai/uat",
        grant=grant,
    )
    identity = _load_receipt_identity(settings)
    retention = RetentionMetadata(
        retention_class="uat-evidence",
        retain_until="2036-08-03T00:00:00Z",
        policy_ref="policy://fabric/receipt-retention/v1",
        receipt_retention_days=365,
        trust_bundle_retention_days=730,
        trust_bundle_generation=1,
        trust_bundle_digest=identity.trust_bundle_ref["bundle_digest"],
    )
    composition = create_fabric_uat_app(
        journal_root=settings.journal_root,
        principal_resolver=_PinnedFabricPrincipalResolver(
            settings.client_spec("ai", "fabric").peer_certificate_sha256,
            principal,
        ),
        soc_port=HttpSocAlertContextPort(client=client),
        dispatch_factory=_DispatchFactory(),
        receipt_signer=identity,
        receipt_verifier=identity,
        kill_switch=_PermittedKillSwitch(),
        idempotency_store=DevTestOnlyInMemoryIdempotencyStore(),
        retention=retention,
    )
    return RoleComposition(
        app=composition.app,
        close_callback=_closed_sync(client),
        metadata=MappingProxyType(
            {
                "journal_root": str(settings.journal_root),
                "receipt_algorithm": identity.algorithm,
                "receipt_kid": identity.kid,
                "receipt_probe_signature": identity.sign(_RECEIPT_PROBE),
                "receipt_trust_descriptor": identity.trust_descriptor.to_json(),
                "service_module": composition.service.__class__.__module__,
            }
        ),
    )


def _build_ai(
    settings: RuntimeCompositionSettings, client_factory: AsyncClientFactory
) -> RoleComposition:
    from .ai_app import (
        FabricResolutionPolicy,
        HttpxAsyncFabricClient,
        PinnedDriverCredentialResolver,
        create_ai_uat_app,
    )

    spec = settings.client_spec("ai", "fabric")
    client = client_factory(spec)
    runtime = _DeterministicModelRuntime()
    app = create_ai_uat_app(
        fabric_client=HttpxAsyncFabricClient(client),
        principal_resolver=PinnedDriverCredentialResolver(
            {
                settings.driver_certificate_sha256(): {
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
                "digest": _CAPABILITY_DIGEST,
            },
            policy_digest=_POLICY_DIGEST,
            delegation_ref=_DELEGATION_REF,
            purpose="alert_triage",
            requested_at=lambda: "2026-08-03T00:00:00Z",
        ),
        clock=lambda: _FIXED_TIME,
    )
    return RoleComposition(
        app=app,
        close_callback=_closed_async(client),
        metadata=MappingProxyType(
            {
                "model_name": runtime.name,
                "service_module": "cybrik_ai_api.summarize.service",
            }
        ),
    )


def build_role_composition(
    role: str,
    settings: RuntimeCompositionSettings,
    *,
    sync_client_factory: SyncClientFactory = create_sync_httpx_client,
    async_client_factory: AsyncClientFactory = create_async_httpx_client,
) -> RoleComposition:
    """Build exactly one role without opening a listener or making a request."""

    if role not in ROLES:
        raise RuntimeCompositionError("role_invalid")
    admitted = _validated_settings(settings)
    _install_product_roots(admitted.roots)
    if role == "soc":
        return _build_soc(admitted)
    if role == "fabric":
        return _build_fabric(admitted, sync_client_factory)
    return _build_ai(admitted, async_client_factory)


__all__ = [
    "AI_BASE_URL",
    "FABRIC_BASE_URL",
    "HTTP_TIMEOUT_SECONDS",
    "SOC_BASE_URL",
    "AdmittedProductRoots",
    "ClientTlsMaterial",
    "HttpClientSpec",
    "ReceiptPublicVerifier",
    "ReceiptTrustDescriptor",
    "RoleComposition",
    "RuntimeCompositionError",
    "RuntimeCompositionSettings",
    "ServerTlsMaterial",
    "build_role_composition",
    "create_async_httpx_client",
    "create_receipt_public_verifier",
    "create_sync_httpx_client",
    "load_receipt_trust_descriptor",
]
