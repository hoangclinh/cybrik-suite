"""D2 Cyber AI process composition over the audited Anycorn B1 listener.

Status: ``AUTHORED — NOT RUN``. Third-party and product packages are imported
only inside runtime functions. Importing this module neither resolves B1 nor
opens a listener.
"""

from __future__ import annotations

import asyncio
import hashlib
import importlib.metadata
import json
import os
import signal
import zipfile
from pathlib import Path
from typing import Final

from . import evidence, policy

B1_VERSION: Final = "0.20.0+cybrik.1"
B1_WHEEL_SHA256: Final = (
    "d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c"
)
AI_AUDIENCE: Final = "svc:cyber-ai-lifecycle"
TRUST_DOMAIN: Final = "soc.internal.cybrik"
ISSUER_ID: Final = "spiffe://soc.internal.cybrik/mint/downstream"
_SSL_CONTEXT_EVIDENCE: Final = "ssl-context.json"

BUILDER_REFERENCE = policy.SslContextBuilderReference(
    symbol=policy.INTERNAL_PATCHED_SSL_CONTEXT_BUILDER,
    delegates_to=(policy.ANYCORN_BASE_SSL_CONTEXT_BUILDER,),
    internal_patched=True,
    artifact_sha256=B1_WHEEL_SHA256,
)


class ServerBoundaryError(RuntimeError):
    """The exact D2 server composition could not be established."""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _required_path(name: str) -> Path:
    raw = os.environ.get(name, "")
    if not raw or not Path(raw).is_absolute():
        raise ServerBoundaryError("required D2 runtime path is absent")
    return Path(raw).resolve(strict=True)


def _write_atomic_evidence(destination: Path, record: object) -> None:
    temporary = destination.with_suffix(".tmp")
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except OSError as exc:
        raise ServerBoundaryError(
            "atomic evidence temporary path is unavailable"
        ) from exc
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(json.dumps(record, sort_keys=True, separators=(",", ":")))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def _verify_b1_artifact() -> Path:
    wheel = _required_path("CYBRIK_UAT_D2_B1_WHEEL")
    if wheel.name != "anycorn-0.20.0+cybrik.1-py3-none-any.whl":
        raise ServerBoundaryError("B1 wheel filename is not exact")
    if _sha256(wheel) != B1_WHEEL_SHA256:
        raise ServerBoundaryError("B1 wheel digest mismatch")
    if importlib.metadata.version("anycorn") != B1_VERSION:
        raise ServerBoundaryError("installed Anycorn version mismatch")
    import anycorn

    installed_root = Path(anycorn.__file__).resolve(strict=True).parent
    with zipfile.ZipFile(wheel) as archive:
        wheel_modules = {
            name.removeprefix("anycorn/"): archive.read(name)
            for name in archive.namelist()
            if name.startswith("anycorn/") and name.endswith(".py")
        }
    installed_modules = {
        path.relative_to(installed_root).as_posix(): path.read_bytes()
        for path in installed_root.rglob("*.py")
    }
    if not wheel_modules or installed_modules != wheel_modules:
        raise ServerBoundaryError(
            "installed Anycorn modules differ from the pinned B1 wheel"
        )
    return wheel


def _record_ssl_context_evidence(baseline_options: int, result_options: int) -> None:
    from ssl import OP_NO_COMPRESSION

    record = evidence.validate_evidence(
        {
            "baseline_options": baseline_options,
            "hardened_options_preserved": (result_options & baseline_options)
            == baseline_options,
            "no_compression_verified": bool(result_options & OP_NO_COMPRESSION),
            "result_options": result_options,
        }
    )
    destination = _required_path("CYBRIK_UAT_D2_EVIDENCE_DIR") / _SSL_CONTEXT_EVIDENCE
    _write_atomic_evidence(destination, record)


def build_patched_ssl_context(config: object) -> object:
    """Execute the exact B1 base builder, then narrow it to TLS 1.3 mTLS."""

    from ssl import (
        CERT_REQUIRED,
        OP_NO_COMPRESSION,
        Purpose,
        TLSVersion,
        create_default_context,
    )

    from anycorn.config import Config

    policy.validate_ssl_context_builder(BUILDER_REFERENCE)
    _verify_b1_artifact()
    if not isinstance(config, Config):
        raise ServerBoundaryError("Anycorn config type mismatch")
    baseline_options = int(create_default_context(Purpose.CLIENT_AUTH).options)
    context = Config.create_ssl_context(config)
    if context is None:
        raise ServerBoundaryError("B1 SSL context was not created")
    context.minimum_version = TLSVersion.TLSv1_3
    context.maximum_version = TLSVersion.TLSv1_3
    context.verify_mode = CERT_REQUIRED
    if context.minimum_version is not TLSVersion.TLSv1_3:
        raise ServerBoundaryError("TLS minimum was not retained")
    if context.maximum_version is not TLSVersion.TLSv1_3:
        raise ServerBoundaryError("TLS maximum was not retained")
    if context.verify_mode is not CERT_REQUIRED:
        raise ServerBoundaryError("mutual TLS was not retained")
    result_options = int(context.options)
    if (result_options & baseline_options) != baseline_options:
        raise ServerBoundaryError("B1 SSL context discarded hardened default options")
    if not result_options & OP_NO_COMPRESSION:
        raise ServerBoundaryError("B1 SSL context did not disable TLS compression")
    _record_ssl_context_evidence(baseline_options, result_options)
    return context


class _TlsEvidenceMiddleware:
    def __init__(self, app: object, *, evidence_path: Path, strip_tls: bool) -> None:
        self._app = app
        self._evidence_path = evidence_path
        self._strip_tls = strip_tls

    async def __call__(
        self, scope: dict[str, object], receive: object, send: object
    ) -> None:
        runtime_scope = dict(scope)
        extensions = runtime_scope.get("extensions")
        extension_map = dict(extensions) if isinstance(extensions, dict) else {}
        tls = extension_map.get("tls")
        if self._strip_tls:
            extension_map.pop("tls", None)
            runtime_scope["extensions"] = extension_map
        elif isinstance(tls, dict):
            chain = tls.get("client_cert_chain")
            summary = {
                "cipher_suite": tls.get("cipher_suite"),
                "client_cert_error_absent": tls.get("client_cert_error") is None,
                "client_certificate_count": len(chain)
                if isinstance(chain, (list, tuple))
                else 0,
                "server_certificate_present": isinstance(tls.get("server_cert"), str),
                "tls_version": tls.get("tls_version"),
            }
            validated = evidence.validate_evidence(summary)
            _write_atomic_evidence(self._evidence_path, validated)
        await self._app(runtime_scope, receive, send)  # type: ignore[operator]


def _investigation_service() -> object:
    from cybrik_ai_api.investigations.service import (
        InMemoryInvestigationContextStore,
        InvestigationService,
        InvestigationServiceDeps,
    )
    from cybrik_ai_core.orchestration.checkpoints import InMemoryCheckpointLog
    from cybrik_ai_core.orchestration.controller import OrchestrationController
    from cybrik_ai_core.orchestration.memory import (
        InMemoryEffectLedger,
        InMemoryIdempotencyRegistry,
        InMemoryOutbox,
        InMemoryRunStateStore,
    )
    from cybrik_ai_core.orchestration.ports import SystemClock

    clock = SystemClock()
    controller = OrchestrationController(
        state_store=InMemoryRunStateStore(),
        idempotency=InMemoryIdempotencyRegistry(),
        ledger=InMemoryEffectLedger(),
        outbox=InMemoryOutbox(),
        clock=clock,
    )
    return InvestigationService(
        InvestigationServiceDeps(
            controller=controller,
            context_store=InMemoryInvestigationContextStore(),
            checkpoint_log=InMemoryCheckpointLog(),
            clock=clock,
        )
    )


def _application() -> object:
    from cybrik_ai_api.runtime_composition import (
        LifecycleRuntimeCompositionDeps,
        compose_lifecycle_runtime,
    )
    from cybrik_ai_api.runtime_settings import LifecycleRuntimeSettings
    from cybrik_ai_api.transport_security import AsgiTlsTransportResolver
    from cybrik_ai_core.delegation import (
        CryptographySignatureVerifier,
        PinnedTrustProvider,
        TrustMetadata,
    )

    jwks = json.loads(_required_path("CYBRIK_UAT_D2_JWKS").read_text(encoding="utf-8"))
    trust = TrustMetadata.model_validate(
        {
            "trust_domain": TRUST_DOMAIN,
            "self_audience": AI_AUDIENCE,
            "accepted_issuers": [ISSUER_ID],
            "jwks": "cybrik://soc.internal.cybrik/jwks/d2-ephemeral",
            "accepted_algs": ["ES256"],
            "max_token_ttl_seconds": 120,
            "clock_skew_seconds": 30,
            "require_cnf": True,
            "require_mtls": True,
        }
    )
    settings = LifecycleRuntimeSettings(
        enabled=True,
        runtime_dsn=os.environ["CYBRIK_UAT_D2_POSTGRES_DSN"],
        runtime_role_name="cybrik_ai_api_app",
    )
    app = compose_lifecycle_runtime(
        settings,
        LifecycleRuntimeCompositionDeps(
            service=_investigation_service(),
            transport_resolver=AsgiTlsTransportResolver(
                audience=AI_AUDIENCE,
                trust_domain=TRUST_DOMAIN,
            ),
            trust_provider=PinnedTrustProvider.from_pinned_jwks(trust, jwks),
            signature_verifier=CryptographySignatureVerifier(),
        ),
    )
    if app is None:
        raise ServerBoundaryError("Cyber AI runtime composition remained disabled")
    return app


async def _serve() -> None:
    from ssl import CERT_REQUIRED

    from anycorn import Config, serve

    from .harness import assert_runtime_authorized

    assert_runtime_authorized()
    _verify_b1_artifact()

    class RuntimeConfig(Config):
        def create_ssl_context(self) -> object:
            return build_patched_ssl_context(self)

    pki_root = _required_path("CYBRIK_UAT_D2_PKI_ROOT")
    config = RuntimeConfig()
    config.bind = ["127.0.0.1:58443"]
    config.certfile = str(pki_root / "server-cert.pem")
    config.keyfile = str(pki_root / "server-key.pem")
    config.ca_certs = str(pki_root / "ca-cert.pem")
    config.verify_mode = CERT_REQUIRED
    config.alpn_protocols = ["http/1.1"]
    config.accesslog = None
    config.errorlog = "-"
    config.workers = 1

    evidence_path = _required_path("CYBRIK_UAT_D2_EVIDENCE_DIR") / "tls-extension.json"
    app = _TlsEvidenceMiddleware(
        _application(),
        evidence_path=evidence_path,
        strip_tls=os.environ.get("CYBRIK_UAT_D2_STRIP_TLS_EXTENSION") == "true",
    )
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for member in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(member, stop.set)
    await serve(app, config, shutdown_trigger=stop.wait, mode="asgi")


def main() -> int:
    try:
        asyncio.run(_serve())
    except (KeyError, OSError, ServerBoundaryError, ValueError):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
