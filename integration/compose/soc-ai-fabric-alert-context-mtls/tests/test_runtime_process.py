from __future__ import annotations

import asyncio
import importlib
import json
import os
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest
from cybrik_suite_uat_fabric.runtime_composition import (
    AdmittedProductRoots,
    RoleComposition,
    ServerTlsMaterial,
)
from cybrik_suite_uat_fabric.runtime_process import (
    PROCESS_PORTS,
    RuntimeProcessDependencies,
    RuntimeProcessError,
    build_server_config,
    load_settings_from_environment,
    main,
    probe_metrics_readiness,
    run_role,
    validate_metrics_readiness,
    validate_product_module_origins,
)


class _Config:
    def __init__(self, builder: object) -> None:
        self.builder = builder


def _roots(tmp_path: Path) -> AdmittedProductRoots:
    roots = {}
    for role in ("soc", "cyber_ai_api", "cyber_ai_core", "tool_fabric"):
        root = tmp_path / role
        root.mkdir()
        roots[role] = root
    return AdmittedProductRoots(**roots)


def _server_tls(tmp_path: Path) -> ServerTlsMaterial:
    paths = []
    for name in ("cert.pem", "key.pem", "ca.pem"):
        path = tmp_path / name
        path.write_text(name, encoding="utf-8")
        paths.append(path)
    return ServerTlsMaterial(*paths)


@pytest.mark.parametrize(
    ("role", "port"), (("soc", 58442), ("ai", 58443), ("fabric", 58444))
)
def test_server_config_is_exact_and_reuses_injected_b1_builder(
    tmp_path: Path, role: str, port: int
) -> None:
    builder = object()
    config = build_server_config(
        role,
        _server_tls(tmp_path),
        config_factory=lambda received: _Config(received),
        ssl_context_builder=builder,
    )

    assert PROCESS_PORTS[role] == port
    assert config.builder is builder
    assert config.bind == [f"127.0.0.1:{port}"]
    assert config.workers == 1
    assert config.accesslog is None
    assert config.errorlog == "-"
    assert config.alpn_protocols == ["http/1.1"]
    assert config.verify_mode == 2


def test_product_module_origin_validation_is_exact_and_recursive(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    modules: dict[str, ModuleType] = {}
    for name, root in (
        ("cybrik_soc", roots.soc),
        ("cybrik_soc.modules.alert.context", roots.soc),
        ("cybrik_ai_api", roots.cyber_ai_api),
        ("cybrik_ai_core", roots.cyber_ai_core),
        ("cybrik_fabric_control", roots.tool_fabric),
    ):
        location = root / Path(*name.split(".")) / "__init__.py"
        location.parent.mkdir(parents=True, exist_ok=True)
        location.write_text("", encoding="utf-8")
        module = ModuleType(name)
        module.__file__ = str(location)
        modules[name] = module

    validate_product_module_origins(roots, modules)
    modules["cybrik_ai_api.bad"] = ModuleType("cybrik_ai_api.bad")
    modules["cybrik_ai_api.bad"].__file__ = str(tmp_path / "foreign.py")
    with pytest.raises(RuntimeProcessError, match="product_module_origin_mismatch"):
        validate_product_module_origins(roots, modules)


def test_product_module_origin_accepts_only_root_bound_namespace_packages(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    namespace_root = roots.soc / "cybrik_soc/modules"
    namespace_root.mkdir(parents=True)
    namespace = ModuleType("cybrik_soc.modules")
    namespace.__file__ = None
    namespace.__path__ = [str(namespace_root)]

    validate_product_module_origins(roots, {"cybrik_soc.modules": namespace})

    foreign = tmp_path / "foreign/cybrik_soc/modules"
    foreign.mkdir(parents=True)
    namespace.__path__ = [str(namespace_root), str(foreign)]
    with pytest.raises(RuntimeProcessError, match="product_module_origin_mismatch"):
        validate_product_module_origins(roots, {"cybrik_soc.modules": namespace})

    namespace.__path__ = []
    with pytest.raises(RuntimeProcessError, match="product_module_origin_mismatch"):
        validate_product_module_origins(roots, {"cybrik_soc.modules": namespace})


@pytest.mark.asyncio
async def test_run_role_strips_proxy_and_keylog_then_serves_once_with_injected_runtime(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    tls = _server_tls(tmp_path)
    environment = {
        "HTTP_PROXY": "http://untrusted.invalid",
        "https_proxy": "http://untrusted.invalid",
        "NO_PROXY": "*",
        "SSLKEYLOGFILE": str(tmp_path / "keys.log"),
        "CYBRIK_KEEP": "yes",
    }
    events: list[object] = []

    settings = SimpleNamespace(server_tls={"soc": tls}, roots=roots)

    async def close() -> None:
        events.append("closed")

    composition = RoleComposition(app=object(), close_callback=close, metadata={})
    modules = {}

    async def serve(app: object, config: object) -> None:
        events.append(("served", app, config))

    dependencies = RuntimeProcessDependencies(
        settings_loader=lambda observed: (
            events.append(("loaded", dict(observed))) or settings
        ),
        composition_builder=lambda role, settings: (
            events.append(("built", role, settings)) or composition
        ),
        config_factory=lambda builder: _Config(builder),
        serve=serve,
        ssl_context_builder=object(),
        modules=lambda: modules,
    )

    await run_role("soc", dependencies=dependencies, environment=environment)

    assert environment == {"CYBRIK_KEEP": "yes"}
    assert events[0] == ("loaded", {"CYBRIK_KEEP": "yes"})
    assert events[1][0:2] == ("built", "soc")
    assert events[2][0] == "served"
    assert events[3] == "closed"


def test_cli_accepts_only_one_exact_role_and_import_is_inert(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    async def runner(role: str) -> None:
        calls.append(role)

    assert main(["fabric"], runner=runner) == 0
    assert calls == ["fabric"]
    with pytest.raises(SystemExit):
        main(["tool_fabric"], runner=runner)
    with pytest.raises(SystemExit):
        main(["soc", "extra"], runner=runner)

    monkeypatch.setattr(os, "environ", {"SSLKEYLOGFILE": "untouched"})
    before = dict(os.environ)
    importlib.import_module("cybrik_suite_uat_fabric.runtime_process")
    assert dict(os.environ) == before


def test_external_mode_0600_config_loads_the_exact_runtime_shape(
    tmp_path: Path,
) -> None:
    product_roots = _roots(tmp_path)
    server_tls = _server_tls(tmp_path)
    driver = tmp_path / "driver.pem"
    driver.write_text("driver", encoding="utf-8")
    receipt_signing_key = tmp_path / "receipt-signing-key.pem"
    receipt_signing_key.write_text("key", encoding="utf-8")
    document = {
        "roots": {
            "soc": str(product_roots.soc),
            "cyber_ai_api": str(product_roots.cyber_ai_api),
            "cyber_ai_core": str(product_roots.cyber_ai_core),
            "tool_fabric": str(product_roots.tool_fabric),
        },
        "journal_root": str(tmp_path / "journal"),
        "server_tls": {
            role: {
                "certificate": str(server_tls.certificate),
                "private_key": str(server_tls.private_key),
                "ca_certificate": str(server_tls.ca_certificate),
            }
            for role in ("soc", "fabric", "ai")
        },
        "fabric_to_soc": {
            "certificate": str(server_tls.certificate),
            "private_key": str(server_tls.private_key),
            "ca_certificate": str(server_tls.ca_certificate),
        },
        "ai_to_fabric": {
            "certificate": str(server_tls.certificate),
            "private_key": str(server_tls.private_key),
            "ca_certificate": str(server_tls.ca_certificate),
        },
        "driver_certificate": str(driver),
        "receipt_signing_key": str(receipt_signing_key),
    }
    config = tmp_path / "runtime.json"
    config.write_text(json.dumps(document), encoding="utf-8")
    config.chmod(0o600)

    settings = load_settings_from_environment(
        {"CYBRIK_UAT_RUNTIME_CONFIG": str(config)}
    )

    assert settings.roots == product_roots
    assert settings.journal_root == tmp_path / "journal"
    assert settings.server_tls["ai"] == server_tls
    assert settings.fabric_to_soc.certificate == server_tls.certificate
    assert settings.driver_certificate == driver
    assert settings.receipt_signing_key == receipt_signing_key


@pytest.mark.parametrize(
    "environment",
    ({}, {"CYBRIK_UAT_RUNTIME_CONFIG": "relative.json"}),
)
def test_external_config_fails_closed_when_absent_or_not_absolute(
    environment: dict[str, str],
) -> None:
    with pytest.raises(RuntimeProcessError, match="runtime_config"):
        load_settings_from_environment(environment)


def test_external_config_rejects_insecure_mode_and_unknown_fields(
    tmp_path: Path,
) -> None:
    config = tmp_path / "runtime.json"
    config.write_text("{}", encoding="utf-8")
    config.chmod(0o644)
    with pytest.raises(RuntimeProcessError, match="runtime_config_invalid"):
        load_settings_from_environment({"CYBRIK_UAT_RUNTIME_CONFIG": str(config)})
    config.chmod(0o600)
    with pytest.raises(RuntimeProcessError, match="runtime_config_invalid"):
        load_settings_from_environment({"CYBRIK_UAT_RUNTIME_CONFIG": str(config)})


@pytest.mark.parametrize(
    ("role", "document", "counter"),
    (("soc", {"soc_calls": 0}, 0), ("ai", {"model_calls": 7}, 7)),
)
def test_metrics_readiness_accepts_only_exact_authenticated_counter_shape(
    role: str, document: dict[str, int], counter: int
) -> None:
    response = SimpleNamespace(status_code=200, json=lambda: document)
    observation = validate_metrics_readiness(role, response)
    assert observation.role == role
    assert observation.counter == counter
    assert observation.path == "/uat/v1/metrics"


def test_metrics_readiness_probe_performs_one_exact_bounded_get() -> None:
    calls: list[str] = []

    class Client:
        def get(self, path: str) -> object:
            calls.append(path)
            return SimpleNamespace(status_code=200, json=lambda: {"model_calls": 0})

    observation = probe_metrics_readiness("ai", Client())

    assert observation.counter == 0
    assert calls == ["/uat/v1/metrics"]


@pytest.mark.parametrize(
    ("role", "status", "document"),
    (
        ("fabric", 200, {"soc_calls": 0}),
        ("soc", 401, {"soc_calls": 0}),
        ("soc", 200, {"soc_calls": True}),
        ("soc", 200, {"soc_calls": -1}),
        ("soc", 200, {"soc_calls": 0, "health": "ready"}),
        ("ai", 200, {"soc_calls": 0}),
    ),
)
def test_metrics_readiness_rejects_wrong_role_status_or_shape(
    role: str, status: int, document: dict[str, object]
) -> None:
    response = SimpleNamespace(status_code=status, json=lambda: document)
    with pytest.raises(RuntimeProcessError, match="readiness_response_invalid"):
        validate_metrics_readiness(role, response)


def test_injected_anycorn_config_calls_the_same_b1_builder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from cybrik_suite_uat_fabric import runtime_process

    anycorn = ModuleType("anycorn")

    class Config:
        pass

    anycorn.Config = Config
    monkeypatch.setitem(sys.modules, "anycorn", anycorn)
    calls: list[object] = []
    config = runtime_process._anycorn_config_factory(
        lambda received: calls.append(received) or "tls-context"
    )

    assert config.create_ssl_context() == "tls-context"
    assert calls == [config]
    with pytest.raises(RuntimeProcessError, match="b1_builder_invalid"):
        runtime_process._anycorn_config_factory(object())


@pytest.mark.asyncio
async def test_run_role_closes_composition_when_server_fails(tmp_path: Path) -> None:
    roots = _roots(tmp_path)
    tls = _server_tls(tmp_path)
    settings = SimpleNamespace(server_tls={"ai": tls}, roots=roots)
    events: list[str] = []

    async def close() -> None:
        events.append("closed")

    async def serve(_app: object, _config: object) -> None:
        events.append("serve")
        raise RuntimeError("injected failure")

    dependencies = RuntimeProcessDependencies(
        settings_loader=lambda _environment: settings,
        composition_builder=lambda _role, _settings: RoleComposition(
            app=object(), close_callback=close, metadata={}
        ),
        config_factory=lambda builder: _Config(builder),
        serve=serve,
        ssl_context_builder=object(),
        modules=dict,
    )

    with pytest.raises(RuntimeError, match="injected failure"):
        await run_role("ai", dependencies=dependencies, environment={})
    assert events == ["serve", "closed"]


@pytest.mark.asyncio
async def test_run_role_rejects_bad_role_dependencies_and_composition() -> None:
    with pytest.raises(RuntimeProcessError, match="process_role_invalid"):
        await run_role("tool_fabric", environment={})
    with pytest.raises(RuntimeProcessError, match="process_dependencies_invalid"):
        await run_role("soc", dependencies=object(), environment={})  # type: ignore[arg-type]

    dependencies = RuntimeProcessDependencies(
        settings_loader=lambda _environment: SimpleNamespace(
            roots=AdmittedProductRoots(
                soc=Path("/invalid"),
                cyber_ai_api=Path("/invalid"),
                cyber_ai_core=Path("/invalid"),
                tool_fabric=Path("/invalid"),
            )
        ),
        composition_builder=lambda _role, _settings: object(),  # type: ignore[arg-type]
        config_factory=lambda builder: _Config(builder),
        serve=lambda _app, _config: asyncio.sleep(0),
        ssl_context_builder=object(),
        modules=dict,
    )
    with pytest.raises(RuntimeProcessError, match="role_composition_invalid"):
        await run_role("soc", dependencies=dependencies, environment={})
