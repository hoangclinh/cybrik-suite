"""Inert CLI boundary for one admitted SOC, Fabric, or AI UAT process.

The module imports no product or ASGI-server package and performs no I/O at
import time.  Runtime dependencies remain injectable so static tests never
open a socket.  The default path lazily reuses the audited Anycorn B1 SSL
builder from the D2 lifecycle harness.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import ssl
import stat
import sys
from collections.abc import Awaitable, Callable, Mapping, MutableMapping
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Final

from .runtime_composition import (
    AdmittedProductRoots,
    ClientTlsMaterial,
    RoleComposition,
    RuntimeCompositionSettings,
    ServerTlsMaterial,
    build_role_composition,
)

PROCESS_PORTS: Final = {"soc": 58442, "ai": 58443, "fabric": 58444}
_LOOPBACK: Final = "127.0.0.1"
_STRIPPED_ENV: Final = frozenset(
    {
        "ALL_PROXY",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "NO_PROXY",
        "SSLKEYLOGFILE",
        "all_proxy",
        "http_proxy",
        "https_proxy",
        "no_proxy",
    }
)
_CONFIG_ENV: Final = "CYBRIK_UAT_RUNTIME_CONFIG"
METRICS_READINESS_PATH: Final = "/uat/v1/metrics"
_METRICS_COUNTER: Final = {"soc": "soc_calls", "ai": "model_calls"}
_PRODUCT_NAMESPACES: Final = {
    "cybrik_soc": "soc",
    "cybrik_ai_api": "cyber_ai_api",
    "cybrik_ai_core": "cyber_ai_core",
    "cybrik_fabric_control": "tool_fabric",
}


class RuntimeProcessError(RuntimeError):
    """Stable process-composition refusal without collaborator detail."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


SettingsLoader = Callable[[Mapping[str, str]], RuntimeCompositionSettings]
CompositionBuilder = Callable[[str, RuntimeCompositionSettings], RoleComposition]
ConfigFactory = Callable[[object], object]
Serve = Callable[[object, object], Awaitable[None]]
Modules = Callable[[], Mapping[str, ModuleType]]


@dataclass(frozen=True, slots=True)
class RuntimeProcessDependencies:
    settings_loader: SettingsLoader
    composition_builder: CompositionBuilder
    config_factory: ConfigFactory
    serve: Serve
    ssl_context_builder: object
    modules: Modules


@dataclass(frozen=True, slots=True)
class MetricsReadinessObservation:
    role: str
    path: str
    counter: int


def validate_metrics_readiness(
    role: str, response: object
) -> MetricsReadinessObservation:
    """Validate one authenticated AI/SOC metrics response without health inference."""

    counter_name = _METRICS_COUNTER.get(role)
    if counter_name is None or getattr(response, "status_code", None) != 200:
        raise RuntimeProcessError("readiness_response_invalid")
    decoder = getattr(response, "json", None)
    if not callable(decoder):
        raise RuntimeProcessError("readiness_response_invalid")
    try:
        document = decoder()
    except Exception:  # noqa: BLE001 - response detail is not reflected.
        raise RuntimeProcessError("readiness_response_invalid") from None
    if not isinstance(document, dict) or set(document) != {counter_name}:
        raise RuntimeProcessError("readiness_response_invalid")
    counter = document[counter_name]
    if isinstance(counter, bool) or not isinstance(counter, int) or counter < 0:
        raise RuntimeProcessError("readiness_response_invalid")
    return MetricsReadinessObservation(
        role=role, path=METRICS_READINESS_PATH, counter=counter
    )


def probe_metrics_readiness(role: str, client: object) -> MetricsReadinessObservation:
    """Perform one exact authenticated metrics request using an injected client."""

    if role not in _METRICS_COUNTER:
        raise RuntimeProcessError("readiness_response_invalid")
    getter = getattr(client, "get", None)
    if not callable(getter):
        raise RuntimeProcessError("readiness_response_invalid")
    try:
        response = getter(METRICS_READINESS_PATH)
    except Exception:  # noqa: BLE001 - transport detail is not reflected.
        raise RuntimeProcessError("readiness_response_invalid") from None
    return validate_metrics_readiness(role, response)


def _exact_file(path: object, reason: str) -> Path:
    if not isinstance(path, Path) or not path.is_absolute():
        raise RuntimeProcessError(reason)
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise RuntimeProcessError(reason) from exc
    if resolved != path or not path.is_file():
        raise RuntimeProcessError(reason)
    return path


def _tls_from_document(document: object) -> ServerTlsMaterial:
    if not isinstance(document, dict) or set(document) != {
        "ca_certificate",
        "certificate",
        "private_key",
    }:
        raise RuntimeProcessError("runtime_config_invalid")
    if not all(isinstance(value, str) for value in document.values()):
        raise RuntimeProcessError("runtime_config_invalid")
    return ServerTlsMaterial(
        certificate=Path(document["certificate"]),
        private_key=Path(document["private_key"]),
        ca_certificate=Path(document["ca_certificate"]),
    )


def _client_tls_from_document(document: object) -> ClientTlsMaterial:
    tls = _tls_from_document(document)
    return ClientTlsMaterial(
        certificate=tls.certificate,
        private_key=tls.private_key,
        ca_certificate=tls.ca_certificate,
    )


def _secure_config_document(path: Path) -> dict[str, object]:
    _exact_file(path, "runtime_config_invalid")
    try:
        info = path.stat(follow_symlinks=False)
        payload = path.read_bytes()
    except OSError as exc:
        raise RuntimeProcessError("runtime_config_invalid") from exc
    if (
        not stat.S_ISREG(info.st_mode)
        or info.st_uid != os.geteuid()
        or stat.S_IMODE(info.st_mode) != 0o600
        or len(payload) == 0
        or len(payload) > 64 * 1024
    ):
        raise RuntimeProcessError("runtime_config_invalid")
    try:
        parsed = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeProcessError("runtime_config_invalid") from exc
    if not isinstance(parsed, dict):
        raise RuntimeProcessError("runtime_config_invalid")
    return parsed


def load_settings_from_environment(
    environment: Mapping[str, str],
) -> RuntimeCompositionSettings:
    """Read one mode-0600 external runtime config after process admission."""

    raw = environment.get(_CONFIG_ENV)
    if not isinstance(raw, str) or not raw:
        raise RuntimeProcessError("runtime_config_absent")
    path = Path(raw)
    document = _secure_config_document(path)
    if set(document) != {
        "ai_to_fabric",
        "driver_certificate",
        "fabric_to_soc",
        "journal_root",
        "receipt_signing_key",
        "roots",
        "server_tls",
    }:
        raise RuntimeProcessError("runtime_config_invalid")
    roots = document["roots"]
    servers = document["server_tls"]
    if (
        not isinstance(roots, dict)
        or set(roots) != {"soc", "cyber_ai_api", "cyber_ai_core", "tool_fabric"}
        or not all(isinstance(value, str) for value in roots.values())
        or not isinstance(servers, dict)
        or set(servers) != set(PROCESS_PORTS)
        or not isinstance(document["journal_root"], str)
        or not isinstance(document["driver_certificate"], str)
        or not isinstance(document["receipt_signing_key"], str)
    ):
        raise RuntimeProcessError("runtime_config_invalid")
    return RuntimeCompositionSettings(
        roots=AdmittedProductRoots(
            soc=Path(roots["soc"]),
            cyber_ai_api=Path(roots["cyber_ai_api"]),
            cyber_ai_core=Path(roots["cyber_ai_core"]),
            tool_fabric=Path(roots["tool_fabric"]),
        ),
        journal_root=Path(document["journal_root"]),
        server_tls={role: _tls_from_document(servers[role]) for role in PROCESS_PORTS},
        fabric_to_soc=_client_tls_from_document(document["fabric_to_soc"]),
        ai_to_fabric=_client_tls_from_document(document["ai_to_fabric"]),
        driver_certificate=Path(document["driver_certificate"]),
        receipt_signing_key=Path(document["receipt_signing_key"]),
    )


def _module_origin(module: ModuleType, root: Path) -> bool:
    location = getattr(module, "__file__", None)
    if not isinstance(location, str):
        return False
    try:
        Path(location).resolve(strict=True).relative_to(root)
    except (OSError, ValueError):
        return False
    return True


def validate_product_module_origins(
    roots: AdmittedProductRoots, modules: Mapping[str, ModuleType]
) -> None:
    """Reject every loaded CYBRIK product module outside its admitted root."""

    if not isinstance(roots, AdmittedProductRoots) or not isinstance(modules, Mapping):
        raise RuntimeProcessError("product_module_origin_mismatch")
    root_map = roots.as_mapping()
    for name, module in tuple(modules.items()):
        namespace = next(
            (
                prefix
                for prefix in _PRODUCT_NAMESPACES
                if name == prefix or name.startswith(prefix + ".")
            ),
            None,
        )
        if namespace is None:
            continue
        if not isinstance(module, ModuleType) or not _module_origin(
            module, root_map[_PRODUCT_NAMESPACES[namespace]]
        ):
            raise RuntimeProcessError("product_module_origin_mismatch")


def build_server_config(
    role: str,
    tls: ServerTlsMaterial,
    *,
    config_factory: ConfigFactory,
    ssl_context_builder: object,
) -> object:
    """Build the exact loopback, single-worker Anycorn B1 configuration."""

    if role not in PROCESS_PORTS or not isinstance(tls, ServerTlsMaterial):
        raise RuntimeProcessError("process_role_invalid")
    for path in (tls.certificate, tls.private_key, tls.ca_certificate):
        _exact_file(path, "server_tls_invalid")
    try:
        config = config_factory(ssl_context_builder)
        config.bind = [f"{_LOOPBACK}:{PROCESS_PORTS[role]}"]
        config.certfile = str(tls.certificate)
        config.keyfile = str(tls.private_key)
        config.ca_certs = str(tls.ca_certificate)
        config.verify_mode = ssl.CERT_REQUIRED
        config.alpn_protocols = ["http/1.1"]
        config.accesslog = None
        config.errorlog = "-"
        config.workers = 1
        config.use_reloader = False
    except Exception as exc:
        raise RuntimeProcessError("server_config_invalid") from exc
    return config


def _strip_transport_environment(environment: MutableMapping[str, str]) -> None:
    for name in _STRIPPED_ENV:
        environment.pop(name, None)


def _b1_ssl_context_builder(config: object) -> object:
    from cybrik_suite_uat_mtls.server import build_patched_ssl_context

    return build_patched_ssl_context(config)


def _anycorn_config_factory(builder: object) -> object:
    from anycorn import Config

    if not callable(builder):
        raise RuntimeProcessError("b1_builder_invalid")

    class B1RuntimeConfig(Config):
        def create_ssl_context(self) -> object:
            return builder(self)

    return B1RuntimeConfig()


async def _anycorn_serve(app: object, config: object) -> None:
    from anycorn import serve

    await serve(app, config)


def _default_modules() -> Mapping[str, ModuleType]:
    return {
        name: module
        for name, module in tuple(sys.modules.items())
        if isinstance(module, ModuleType)
    }


def _default_dependencies() -> RuntimeProcessDependencies:
    return RuntimeProcessDependencies(
        settings_loader=load_settings_from_environment,
        composition_builder=build_role_composition,
        config_factory=_anycorn_config_factory,
        serve=_anycorn_serve,
        ssl_context_builder=_b1_ssl_context_builder,
        modules=_default_modules,
    )


async def run_role(
    role: str,
    *,
    dependencies: RuntimeProcessDependencies | None = None,
    environment: MutableMapping[str, str] | None = None,
) -> None:
    """Build and serve one role; callers own authorization and process lifetime."""

    if role not in PROCESS_PORTS:
        raise RuntimeProcessError("process_role_invalid")
    deps = dependencies if dependencies is not None else _default_dependencies()
    if not isinstance(deps, RuntimeProcessDependencies):
        raise RuntimeProcessError("process_dependencies_invalid")
    runtime_environment = os.environ if environment is None else environment
    _strip_transport_environment(runtime_environment)
    settings = deps.settings_loader(runtime_environment)
    composition = deps.composition_builder(role, settings)
    if not isinstance(composition, RoleComposition):
        raise RuntimeProcessError("role_composition_invalid")
    validate_product_module_origins(settings.roots, deps.modules())
    try:
        tls = settings.server_tls[role]
    except (KeyError, TypeError) as exc:
        raise RuntimeProcessError("server_tls_invalid") from exc
    config = build_server_config(
        role,
        tls,
        config_factory=deps.config_factory,
        ssl_context_builder=deps.ssl_context_builder,
    )
    try:
        await deps.serve(composition.app, config)
    finally:
        await composition.close()


def main(
    argv: list[str] | None = None,
    *,
    runner: Callable[[str], Awaitable[None]] | None = None,
) -> int:
    parser = argparse.ArgumentParser(prog="cybrik-uat-runtime-process")
    parser.add_argument("role", choices=tuple(PROCESS_PORTS))
    arguments = parser.parse_args(argv)
    selected_runner = runner if runner is not None else run_role
    asyncio.run(selected_runner(arguments.role))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = [
    "METRICS_READINESS_PATH",
    "PROCESS_PORTS",
    "MetricsReadinessObservation",
    "RuntimeProcessDependencies",
    "RuntimeProcessError",
    "build_server_config",
    "load_settings_from_environment",
    "main",
    "probe_metrics_readiness",
    "run_role",
    "validate_metrics_readiness",
    "validate_product_module_origins",
]
