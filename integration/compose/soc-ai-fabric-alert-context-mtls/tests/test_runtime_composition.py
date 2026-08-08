from __future__ import annotations

import base64
import hashlib
import json
import ssl
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.x509.oid import NameOID
from cybrik_suite_uat_fabric.bootstrap import resolve_import_roots
from cybrik_suite_uat_fabric.runtime_composition import (
    FABRIC_BASE_URL,
    HTTP_TIMEOUT_SECONDS,
    SOC_BASE_URL,
    AdmittedProductRoots,
    ClientTlsMaterial,
    ReceiptTrustDescriptor,
    RuntimeCompositionError,
    RuntimeCompositionSettings,
    ServerTlsMaterial,
    build_role_composition,
    create_async_httpx_client,
    create_receipt_public_verifier,
    create_sync_httpx_client,
    load_receipt_trust_descriptor,
)
from fastapi import FastAPI


def _certificate(root: Path, name: str) -> tuple[Path, Path]:
    key = Ed25519PrivateKey.generate()
    subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)])
    now = datetime.now(UTC)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1))
        .add_extension(
            x509.SubjectAlternativeName(
                [x509.IPAddress(__import__("ipaddress").ip_address("127.0.0.1"))]
            ),
            critical=False,
        )
        .sign(key, algorithm=None)
    )
    cert_path = root / f"{name}-cert.pem"
    key_path = root / f"{name}-key.pem"
    cert_path.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    return cert_path, key_path


def _settings(tmp_path: Path) -> RuntimeCompositionSettings:
    harness = Path(__file__).resolve().parents[1]
    roots = resolve_import_roots(harness)
    soc_cert, soc_key = _certificate(tmp_path, "soc")
    fabric_cert, fabric_key = _certificate(tmp_path, "fabric")
    ai_cert, ai_key = _certificate(tmp_path, "ai")
    driver_cert, _driver_key = _certificate(tmp_path, "driver")
    ca_cert, _ca_key = _certificate(tmp_path, "ca")
    receipt_signing_key = tmp_path / "receipt-signing-key.pem"
    receipt_signing_key.write_bytes(
        Ed25519PrivateKey.generate().private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    receipt_signing_key.chmod(0o600)
    return RuntimeCompositionSettings(
        roots=AdmittedProductRoots(
            soc=roots["soc"],
            cyber_ai_api=roots["cyber_ai_api"],
            cyber_ai_core=roots["cyber_ai_core"],
            tool_fabric=roots["tool_fabric"],
        ),
        journal_root=tmp_path / "fabric-journal",
        server_tls={
            "soc": ServerTlsMaterial(soc_cert, soc_key, ca_cert),
            "fabric": ServerTlsMaterial(fabric_cert, fabric_key, ca_cert),
            "ai": ServerTlsMaterial(ai_cert, ai_key, ca_cert),
        },
        fabric_to_soc=ClientTlsMaterial(fabric_cert, fabric_key, ca_cert),
        ai_to_fabric=ClientTlsMaterial(ai_cert, ai_key, ca_cert),
        driver_certificate=driver_cert,
        receipt_signing_key=receipt_signing_key,
    )


class _SyncClient:
    def post(self, _path: str, *, json: dict[str, Any]) -> object:
        del json
        raise AssertionError("composition must not perform HTTP while building")

    def close(self) -> None:
        pass


class _AsyncClient:
    async def post(self, _path: str, **_kwargs: Any) -> object:
        raise AssertionError("composition must not perform HTTP while building")

    async def get(self, _path: str) -> object:
        raise AssertionError("composition must not perform HTTP while building")

    async def aclose(self) -> None:
        pass


@pytest.mark.asyncio
async def test_builds_existing_product_apps_with_exact_transport_specs(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)
    sync_specs: list[object] = []
    async_specs: list[object] = []

    soc = build_role_composition("soc", settings)
    fabric = build_role_composition(
        "fabric",
        settings,
        sync_client_factory=lambda spec: sync_specs.append(spec) or _SyncClient(),
    )
    ai = build_role_composition(
        "ai",
        settings,
        async_client_factory=lambda spec: async_specs.append(spec) or _AsyncClient(),
    )

    assert isinstance(soc.app, FastAPI)
    assert isinstance(fabric.app, FastAPI)
    assert isinstance(ai.app, FastAPI)
    assert soc.metadata["service_module"] == "cybrik_soc.modules.alert.context"
    assert fabric.metadata["service_module"].startswith("cybrik_fabric_control.")
    assert ai.metadata["service_module"] == "cybrik_ai_api.summarize.service"
    assert fabric.metadata["journal_root"] == str(settings.journal_root)
    assert fabric.metadata["receipt_algorithm"] == "EdDSA"
    descriptor = ReceiptTrustDescriptor.from_json(
        fabric.metadata["receipt_trust_descriptor"]
    )
    assert descriptor.kid == fabric.metadata["receipt_kid"]
    assert ai.metadata["model_name"] == "deterministic-three-product-uat"

    assert sync_specs[0].base_url == SOC_BASE_URL
    assert async_specs[0].base_url == FABRIC_BASE_URL
    for spec in (*sync_specs, *async_specs):
        assert spec.timeout_seconds == HTTP_TIMEOUT_SECONDS
        assert spec.retries == 0
        assert spec.trust_env is False
        assert (
            spec.verify == settings.fabric_to_soc.ca_certificate
            or spec.verify == settings.ai_to_fabric.ca_certificate
        )
        assert len(spec.peer_certificate_sha256) == 64

    assert {route.path for route in soc.app.routes} >= {"/uat/v1/alert-context"}
    assert {route.path for route in fabric.app.routes} >= {
        "/api/v1/invocations",
        "/api/v1/receipts/{receipt_id}",
    }
    assert {route.path for route in ai.app.routes} >= {"/uat/v1/summarizations"}
    await ai.close()
    await fabric.close()
    await soc.close()


def test_default_httpx_factories_pin_no_proxy_no_retry_and_exact_urls(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)
    sync_calls: list[dict[str, Any]] = []
    async_calls: list[dict[str, Any]] = []

    class _Httpx:
        class HTTPTransport:
            def __init__(self, **kwargs: Any) -> None:
                sync_calls.append({"transport": kwargs})

        class AsyncHTTPTransport:
            def __init__(self, **kwargs: Any) -> None:
                async_calls.append({"transport": kwargs})

        class Client:
            def __init__(self, **kwargs: Any) -> None:
                sync_calls.append(kwargs)

        class AsyncClient:
            def __init__(self, **kwargs: Any) -> None:
                async_calls.append(kwargs)

    sync = create_sync_httpx_client(
        settings.client_spec("fabric", "soc"), httpx_module=_Httpx
    )
    asynchronous = create_async_httpx_client(
        settings.client_spec("ai", "fabric"), httpx_module=_Httpx
    )

    assert isinstance(sync, _Httpx.Client)
    assert isinstance(asynchronous, _Httpx.AsyncClient)
    sync_transport = sync_calls[0]["transport"]
    assert set(sync_transport) == {"retries", "trust_env", "verify"}
    assert sync_transport["retries"] == 0
    assert sync_transport["trust_env"] is False
    assert isinstance(sync_transport["verify"], ssl.SSLContext)
    assert sync_transport["verify"].minimum_version is ssl.TLSVersion.TLSv1_3
    assert sync_transport["verify"].maximum_version is ssl.TLSVersion.TLSv1_3
    assert sync_calls[1]["base_url"] == SOC_BASE_URL
    assert "cert" not in sync_calls[1]
    assert sync_calls[1]["timeout"] == HTTP_TIMEOUT_SECONDS
    assert sync_calls[1]["trust_env"] is False
    assert isinstance(sync_calls[1]["transport"], _Httpx.HTTPTransport)
    async_transport = async_calls[0]["transport"]
    assert set(async_transport) == {"retries", "trust_env", "verify"}
    assert async_transport["retries"] == 0
    assert async_transport["trust_env"] is False
    assert isinstance(async_transport["verify"], ssl.SSLContext)
    assert async_transport["verify"].minimum_version is ssl.TLSVersion.TLSv1_3
    assert async_transport["verify"].maximum_version is ssl.TLSVersion.TLSv1_3
    assert async_calls[1]["base_url"] == FABRIC_BASE_URL
    assert async_calls[1]["trust_env"] is False
    assert async_calls[1]["timeout"] == HTTP_TIMEOUT_SECONDS


def test_settings_reject_inexact_surface_or_repository_journal(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    with pytest.raises(RuntimeCompositionError, match="role_invalid"):
        build_role_composition("tool_fabric", settings)

    invalid = RuntimeCompositionSettings(
        roots=settings.roots,
        journal_root=settings.roots.soc / "journal",
        server_tls=settings.server_tls,
        fabric_to_soc=settings.fabric_to_soc,
        ai_to_fabric=settings.ai_to_fabric,
        driver_certificate=settings.driver_certificate,
        receipt_signing_key=settings.receipt_signing_key,
    )
    with pytest.raises(RuntimeCompositionError, match="journal_root_invalid"):
        build_role_composition(
            "fabric", invalid, sync_client_factory=lambda _spec: _SyncClient()
        )


def test_certificate_fingerprint_is_derived_from_public_certificate(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)
    expected = (
        x509.load_pem_x509_certificate(settings.driver_certificate.read_bytes())
        .fingerprint(hashes.SHA256())
        .hex()
    )
    assert settings.driver_certificate_sha256() == expected
    assert base64.urlsafe_b64decode(
        build_role_composition(
            "fabric",
            settings,
            sync_client_factory=lambda _spec: _SyncClient(),
        )
        .metadata["receipt_kid"]
        .rsplit(":", 1)[1]
        + "=="
    )
    assert (
        hashlib.sha256(settings.driver_certificate.read_bytes()).hexdigest() != expected
    )


def test_external_receipt_key_yields_public_descriptor_and_copied_verifier(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)

    descriptor = load_receipt_trust_descriptor(settings)
    verifier = create_receipt_public_verifier(
        ReceiptTrustDescriptor.from_json(descriptor.to_json())
    )
    fabric = build_role_composition(
        "fabric",
        settings,
        sync_client_factory=lambda _spec: _SyncClient(),
    )
    materialized = ReceiptTrustDescriptor.from_json(
        fabric.metadata["receipt_trust_descriptor"]
    )

    assert materialized == descriptor
    assert descriptor.algorithm == "EdDSA"
    assert descriptor.key_type == {"kty": "OKP", "crv": "Ed25519"}
    assert descriptor.trust_bundle_ref["bundle_digest"].startswith("sha256:")
    assert "PRIVATE" not in descriptor.to_json()
    assert "receipt-signing-key.pem" not in descriptor.to_json()
    signature = fabric.metadata["receipt_probe_signature"]
    assert verifier.verify(b"cybrik-uat-receipt-verifier-probe/v1", signature=signature)
    assert not verifier.verify(
        b"cybrik-uat-receipt-verifier-probe/v1-tampered", signature=signature
    )
    assert set(json.loads(descriptor.to_json())) == {
        "algorithm",
        "key_type",
        "kid",
        "public_key",
        "trust_bundle_ref",
    }


@pytest.mark.parametrize("mutation", ["mode", "hardlink", "symlink", "in_repo"])
def test_receipt_signing_key_is_exact_external_owner_only(
    tmp_path: Path, mutation: str
) -> None:
    settings = _settings(tmp_path)
    key = settings.receipt_signing_key
    if mutation == "mode":
        key.chmod(0o644)
        replacement = key
    elif mutation == "hardlink":
        replacement = tmp_path / "receipt-hardlink.pem"
        replacement.hardlink_to(key)
    elif mutation == "symlink":
        replacement = tmp_path / "receipt-symlink.pem"
        replacement.symlink_to(key)
    else:
        fake_soc_root = tmp_path / "admitted-soc-root"
        fake_soc_root.mkdir()
        replacement = fake_soc_root / "receipt-signing-key.pem"
        replacement.write_bytes(key.read_bytes())
        replacement.chmod(0o600)
        settings = RuntimeCompositionSettings(
            roots=AdmittedProductRoots(
                soc=fake_soc_root,
                cyber_ai_api=settings.roots.cyber_ai_api,
                cyber_ai_core=settings.roots.cyber_ai_core,
                tool_fabric=settings.roots.tool_fabric,
            ),
            journal_root=settings.journal_root,
            server_tls=settings.server_tls,
            fabric_to_soc=settings.fabric_to_soc,
            ai_to_fabric=settings.ai_to_fabric,
            driver_certificate=settings.driver_certificate,
            receipt_signing_key=key,
        )
    invalid = RuntimeCompositionSettings(
        roots=settings.roots,
        journal_root=settings.journal_root,
        server_tls=settings.server_tls,
        fabric_to_soc=settings.fabric_to_soc,
        ai_to_fabric=settings.ai_to_fabric,
        driver_certificate=settings.driver_certificate,
        receipt_signing_key=replacement,
    )

    with pytest.raises(RuntimeCompositionError, match="receipt_signing_key_invalid"):
        load_receipt_trust_descriptor(invalid)


@pytest.mark.parametrize("role", ["soc", "fabric", "ai"])
@pytest.mark.parametrize("mutation", ["symlink", "hardlink", "mode", "wrong_type"])
def test_every_role_fails_before_partial_start_on_invalid_receipt_key(
    tmp_path: Path, role: str, mutation: str
) -> None:
    settings = _settings(tmp_path)
    key = settings.receipt_signing_key
    if mutation == "symlink":
        replacement = tmp_path / "role-receipt-symlink.pem"
        replacement.symlink_to(key)
    elif mutation == "hardlink":
        replacement = tmp_path / "role-receipt-hardlink.pem"
        replacement.hardlink_to(key)
    elif mutation == "mode":
        key.chmod(0o640)
        replacement = key
    else:
        key.write_bytes(
            ec.generate_private_key(ec.SECP256R1()).private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
        )
        replacement = key
    invalid = RuntimeCompositionSettings(
        roots=settings.roots,
        journal_root=settings.journal_root,
        server_tls=settings.server_tls,
        fabric_to_soc=settings.fabric_to_soc,
        ai_to_fabric=settings.ai_to_fabric,
        driver_certificate=settings.driver_certificate,
        receipt_signing_key=replacement,
    )

    with pytest.raises(RuntimeCompositionError, match="receipt_signing_key_invalid"):
        build_role_composition(
            role,
            invalid,
            sync_client_factory=lambda _spec: _SyncClient(),
            async_client_factory=lambda _spec: _AsyncClient(),
        )
