"""Synthetic branch closure for the D2 lifecycle harness.

Every test in this module is process-, network-, database-, and PKI-inert.  The
few filesystem exercises use only pytest-owned temporary roots; all external
product and control-plane collaborators are replaced with in-memory fakes.
"""

from __future__ import annotations

import builtins
import os
import stat
import sys
from datetime import UTC, datetime
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest
from cybrik_suite_uat_mtls import harness


def _authorization(tmp_path: Path) -> SimpleNamespace:
    roots = {
        "soc": tmp_path / "soc",
        "cyber_ai": tmp_path / "ai",
        "tool_fabric": tmp_path / "fabric",
    }
    suite_root = tmp_path / "suite"
    for root in (suite_root, *roots.values()):
        root.mkdir(parents=True, exist_ok=True)
    return SimpleNamespace(
        authorization_id="m3-synthetic",
        authorization_sha256="a" * 64,
        exact_head_grant_sha256="b" * 64,
        aggregate_sha256="c" * 64,
        suite_head="d" * 40,
        suite_root=suite_root,
        product_roots=roots,
        runtime_root=tmp_path / "runtime",
        evidence_root=tmp_path / "evidence",
    )


def _install_product_api_modules(
    monkeypatch: pytest.MonkeyPatch,
) -> list[object]:
    module_names = (
        "cybrik_ai_api.runtime_composition",
        "cybrik_ai_api.transport_security",
        "cybrik_ai_core.delegation",
        "cybrik_soc.modules.copilot.lifecycle_create",
        "cybrik_soc.platform.svc_delegation",
    )
    for qualified_name in module_names:
        parts = qualified_name.split(".")
        for index in range(1, len(parts) + 1):
            name = ".".join(parts[:index])
            if name in sys.modules:
                continue
            module = ModuleType(name)
            module.__file__ = f"/synthetic/{name.replace('.', '/')}.py"
            if index != len(parts):
                module.__path__ = []  # type: ignore[attr-defined]
            monkeypatch.setitem(sys.modules, name, module)

    def symbol() -> None:
        return None

    specifications = (
        (module_names[0], "LifecycleRuntimeCompositionDeps"),
        (module_names[0], "compose_lifecycle_runtime"),
        (module_names[1], "AsgiTlsTransportResolver"),
        (module_names[2], "from_pinned_jwks"),
        (module_names[3], "LifecycleCreateClient"),
        (module_names[4], "AsymmetricJwtDelegationIssuer"),
        (module_names[4], "MintedToken"),
    )
    symbols: list[object] = []
    for module_name, attribute in specifications:
        generated = type(symbol)(symbol.__code__, {}, attribute)
        generated.__module__ = module_name
        setattr(sys.modules[module_name], attribute, generated)
        symbols.append(generated)

    provider = type(
        "PinnedTrustProvider",
        (),
        {"from_pinned_jwks": staticmethod(symbols[3])},
    )
    sys.modules[module_names[2]].PinnedTrustProvider = provider
    return symbols


def test_absolute_paths_and_repository_containment_cover_admission_edges(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    existing = tmp_path / "existing"
    existing.mkdir()
    monkeypatch.setenv("M3_EXISTING", str(existing))
    assert harness._absolute_env("M3_EXISTING", must_exist=True) == existing

    suite = tmp_path / "suite"
    suite.mkdir()
    repositories = [tmp_path / name for name in ("soc", "ai", "fabric")]
    for repository in repositories:
        repository.mkdir()
    monkeypatch.setattr(harness, "_repo_root", lambda: suite)
    for name, repository in zip(
        (harness._SOC_REPO_ENV, harness._AI_REPO_ENV, harness._FABRIC_REPO_ENV),
        repositories,
        strict=True,
    ):
        monkeypatch.setenv(name, str(repository))
    with pytest.raises(harness.RuntimeAuthorizationError, match="outside repositories"):
        harness._outside_repositories(suite / "nested")

    roots = iter((Path("/"), tmp_path / "cybrik-uat-d2-evidence-m3"))
    monkeypatch.setattr(harness, "_absolute_env", lambda *args, **kwargs: next(roots))
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="external root is unsafe"
    ):
        harness._bounded_external_roots(repositories_must_exist=False)


def test_product_api_compatibility_accepts_callable_pinned_origins(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization = _authorization(tmp_path)
    symbols = _install_product_api_modules(monkeypatch)
    observed: list[object] = []
    monkeypatch.setattr(
        harness.runtime_authorization,
        "verify_module_origins",
        lambda actual, origins: observed.append((actual, tuple(origins))),
    )
    monkeypatch.setattr(
        harness.runtime_authorization,
        "verify_loaded_module_origins",
        lambda actual: observed.append(actual),
    )

    harness.assert_product_api_compatibility(authorization)  # type: ignore[arg-type]

    assert len(observed[0][1]) == len(symbols)  # type: ignore[index]
    assert observed[1] is authorization


def test_master_product_api_imports_use_only_signed_source_roots(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization = harness.runtime_authorization.ReservedRuntimeBinding(
        authorization_id="master-import-scope",
        suite_root=tmp_path / "suite",
        suite_head="1" * 40,
        suite_admission_base="1" * 40,
        aggregate_sha256="2" * 64,
        authorization_sha256="3" * 64,
        exact_head_grant_sha256="4" * 64,
        external_roots_sha256="5" * 64,
        repository_roots_sha256="6" * 64,
        runtime_root=tmp_path / "runtime",
        evidence_root=tmp_path / "evidence",
        product_roots={
            "soc": tmp_path / "soc",
            "cyber_ai": tmp_path / "ai",
            "tool_fabric": tmp_path / "fabric",
        },
        repository_tuple=(
            ("cybrik-soc-command-center", "7" * 40, "8" * 40),
            ("cybrik-cyber-ai-platform", "9" * 40, "a" * 40),
            ("cybrik-security-tool-fabric", "b" * 40, "c" * 40),
            ("cybrik-suite", "1" * 40, "d" * 40),
        ),
    )
    signed_source = tmp_path / "signed-source"
    signed_source.mkdir()
    _install_product_api_modules(monkeypatch)
    monkeypatch.setattr(
        harness.runtime_authorization,
        "resolve_import_source_roots",
        lambda actual: (signed_source,),
    )
    monkeypatch.setattr(
        harness.runtime_authorization, "verify_module_origins", lambda *args: None
    )
    monkeypatch.setattr(
        harness.runtime_authorization,
        "verify_loaded_module_origins",
        lambda *args: None,
    )
    original_import = builtins.__import__
    observed: list[bool] = []

    def inspect_import(name: str, *args: object, **kwargs: object) -> object:
        if name.startswith(("cybrik_ai_", "cybrik_soc")):
            observed.append(sys.path[0] == str(signed_source))
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", inspect_import)
    original_path = tuple(sys.path)

    harness.assert_product_api_compatibility(authorization)

    assert observed and all(observed)
    assert tuple(sys.path) == original_path


def test_master_product_api_import_scope_restores_path_after_import_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization = harness.runtime_authorization.ReservedRuntimeBinding(
        authorization_id="master-import-restore",
        suite_root=tmp_path / "suite",
        suite_head="1" * 40,
        suite_admission_base="1" * 40,
        aggregate_sha256="2" * 64,
        authorization_sha256="3" * 64,
        exact_head_grant_sha256="4" * 64,
        external_roots_sha256="5" * 64,
        repository_roots_sha256="6" * 64,
        runtime_root=tmp_path / "runtime",
        evidence_root=tmp_path / "evidence",
        product_roots={
            "soc": tmp_path / "soc",
            "cyber_ai": tmp_path / "ai",
            "tool_fabric": tmp_path / "fabric",
        },
        repository_tuple=(
            ("cybrik-soc-command-center", "7" * 40, "8" * 40),
            ("cybrik-cyber-ai-platform", "9" * 40, "a" * 40),
            ("cybrik-security-tool-fabric", "b" * 40, "c" * 40),
            ("cybrik-suite", "1" * 40, "d" * 40),
        ),
    )
    signed_source = tmp_path / "signed-source"
    signed_source.mkdir()
    monkeypatch.setattr(
        harness.runtime_authorization,
        "resolve_import_source_roots",
        lambda actual: (signed_source,),
    )
    original_import = builtins.__import__
    original_path = tuple(sys.path)

    def fail_import(name: str, *args: object, **kwargs: object) -> object:
        if name == "cybrik_ai_api.runtime_composition":
            raise ImportError("synthetic")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fail_import)

    with pytest.raises(harness.RuntimeAuthorizationError, match="unavailable"):
        harness.assert_product_api_compatibility(authorization)
    assert tuple(sys.path) == original_path


@pytest.mark.parametrize("defect", ("not_callable", "module_name", "module_file"))
def test_product_api_compatibility_refuses_malformed_symbols(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    defect: str,
) -> None:
    authorization = _authorization(tmp_path)
    symbols = _install_product_api_modules(monkeypatch)
    if defect == "not_callable":
        sys.modules[
            "cybrik_ai_api.runtime_composition"
        ].LifecycleRuntimeCompositionDeps = object()
        match = "incompatible"
    elif defect == "module_name":
        symbols[0].__module__ = None  # type: ignore[attr-defined]
        match = "origin is unavailable"
    else:
        sys.modules[symbols[0].__module__].__file__ = None  # type: ignore[attr-defined,index]
        match = "origin is unavailable"

    with pytest.raises(harness.RuntimeAuthorizationError, match=match):
        harness.assert_product_api_compatibility(authorization)  # type: ignore[arg-type]


def test_product_api_compatibility_wraps_origin_refusal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization = _authorization(tmp_path)
    _install_product_api_modules(monkeypatch)
    monkeypatch.setattr(
        harness.runtime_authorization,
        "verify_module_origins",
        lambda *args: (_ for _ in ()).throw(
            harness.runtime_authorization.RuntimeAuthorizationFailure("origin_drift")
        ),
    )

    with pytest.raises(harness.RuntimeAuthorizationError, match="origin_drift"):
        harness.assert_product_api_compatibility(authorization)  # type: ignore[arg-type]


def test_isolated_argv_accepts_confined_roots_and_rejects_bad_module(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization = _authorization(tmp_path)
    source = tmp_path / "sources"
    purelib = tmp_path / "deps" / "purelib"
    platlib = tmp_path / "deps" / "platlib"
    for path in (source, purelib, platlib):
        path.mkdir(parents=True)
    monkeypatch.setattr(
        harness.runtime_authorization,
        "resolve_import_source_roots",
        lambda actual: (source,),
    )
    monkeypatch.setattr(
        harness.sysconfig,
        "get_path",
        lambda name: str({"purelib": purelib, "platlib": platlib}[name]),
    )

    argv = harness._isolated_module_argv(
        authorization,
        "cybrik_suite_uat_mtls.client",  # type: ignore[arg-type]
    )
    assert argv[-1] == "cybrik_suite_uat_mtls.client"

    with pytest.raises(harness.RuntimeAuthorizationError, match="roots are invalid"):
        harness._isolated_module_argv(authorization, "foreign.client")  # type: ignore[arg-type]


def test_isolated_argv_accepts_master_reserved_binding(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization = harness.runtime_authorization.ReservedRuntimeBinding(
        authorization_id="master-isolated-child",
        suite_root=tmp_path / "suite",
        suite_head="1" * 40,
        suite_admission_base="1" * 40,
        aggregate_sha256="2" * 64,
        authorization_sha256="3" * 64,
        exact_head_grant_sha256="4" * 64,
        external_roots_sha256="5" * 64,
        repository_roots_sha256="6" * 64,
        runtime_root=tmp_path / "runtime",
        evidence_root=tmp_path / "evidence",
        product_roots={
            "soc": tmp_path / "soc",
            "cyber_ai": tmp_path / "ai",
            "tool_fabric": tmp_path / "fabric",
        },
        repository_tuple=(
            ("cybrik-soc-command-center", "7" * 40, "8" * 40),
            ("cybrik-cyber-ai-platform", "9" * 40, "a" * 40),
            ("cybrik-security-tool-fabric", "b" * 40, "c" * 40),
            ("cybrik-suite", "1" * 40, "d" * 40),
        ),
    )
    source = tmp_path / "source"
    purelib = tmp_path / "purelib"
    platlib = tmp_path / "platlib"
    for root in (
        authorization.suite_root,
        *authorization.product_roots.values(),
        source,
        purelib,
        platlib,
    ):
        root.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(
        harness.runtime_authorization,
        "resolve_import_source_roots",
        lambda actual: (source,),
    )
    monkeypatch.setattr(
        harness.sysconfig,
        "get_path",
        lambda name: str({"purelib": purelib, "platlib": platlib}[name]),
    )

    argv = harness._isolated_module_argv(
        authorization,
        "cybrik_suite_uat_mtls.server",
    )

    assert argv[-1] == "cybrik_suite_uat_mtls.server"
    assert str(source) in argv[-3]


def test_isolated_argv_rejects_dependency_inside_repository(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization = _authorization(tmp_path)
    source = tmp_path / "sources"
    dependency = authorization.suite_root / "dependency"
    source.mkdir()
    dependency.mkdir()
    monkeypatch.setattr(
        harness.runtime_authorization,
        "resolve_import_source_roots",
        lambda actual: (source,),
    )
    monkeypatch.setattr(harness.sysconfig, "get_path", lambda name: str(dependency))

    with pytest.raises(harness.RuntimeAuthorizationError, match="escaped confinement"):
        harness._isolated_module_argv(
            authorization,
            "cybrik_suite_uat_mtls.client",  # type: ignore[arg-type]
        )


def test_isolated_argv_wraps_source_root_refusal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization = _authorization(tmp_path)
    monkeypatch.setattr(
        harness.runtime_authorization,
        "resolve_import_source_roots",
        lambda actual: (_ for _ in ()).throw(
            harness.runtime_authorization.RuntimeAuthorizationFailure("source_drift")
        ),
    )
    with pytest.raises(harness.RuntimeAuthorizationError, match="source_drift"):
        harness._isolated_module_argv(
            authorization,
            "cybrik_suite_uat_mtls.client",  # type: ignore[arg-type]
        )


def test_ready_wait_times_out_after_unverified_receipts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    store = SimpleNamespace(read_ready_receipt=lambda material: b"unverified")
    monkeypatch.setattr(harness, "_CONTROL_READY_ATTEMPTS", 2)
    monkeypatch.setattr(
        harness.process_control, "verify_ready_receipt", lambda *args: False
    )
    monkeypatch.setattr(harness.time, "sleep", lambda seconds: None)

    with pytest.raises(harness.RuntimeAuthorizationError, match="timed out"):
        harness._wait_control_ready(store, object(), SimpleNamespace(poll=lambda: None))  # type: ignore[arg-type]


def test_password_creation_refuses_an_invalid_created_leaf(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    closed: list[int] = []
    monkeypatch.setattr(harness.os, "open", lambda *args, **kwargs: 91)
    monkeypatch.setattr(
        harness.os,
        "fstat",
        lambda descriptor: SimpleNamespace(
            st_mode=stat.S_IFREG | 0o644,
            st_uid=os.geteuid(),
            st_nlink=1,
            st_dev=1,
            st_ino=2,
        ),
    )
    monkeypatch.setattr(
        harness.os, "close", lambda descriptor: closed.append(descriptor)
    )

    with pytest.raises(harness.RuntimeAuthorizationError, match="creation failed"):
        harness._create_password(tmp_path)
    assert closed == [91]


def test_password_cleanup_handles_absent_and_unrenameable_leaf(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    created = harness._CreatedPassword(
        path=tmp_path / harness._PASSWORD_FILE,
        device=1,
        inode=2,
        uid=os.geteuid(),
        mode=0o600,
    )
    harness._remove_created_password(created)

    created.path.write_text("synthetic", encoding="ascii")
    monkeypatch.setattr(
        harness.os,
        "rename",
        lambda *args, **kwargs: (_ for _ in ()).throw(PermissionError("synthetic")),
    )
    with pytest.raises(harness.RuntimeAuthorizationError, match="cleanup failed"):
        harness._remove_created_password(created)


def test_evidence_and_digest_fail_closed_and_succeed_in_temp_roots(
    tmp_path: Path,
) -> None:
    with pytest.raises(harness.RuntimeAuthorizationError, match="evidence is absent"):
        harness._assert_mtls_evidence(tmp_path)

    (tmp_path / harness._TLS_EVIDENCE).write_text("{}", encoding="utf-8")
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="evidence is incomplete"
    ):
        harness._assert_mtls_evidence(tmp_path)

    missing = tmp_path / "missing"
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="artifact is unavailable"
    ):
        harness._sha256_file(missing)
    artifact = tmp_path / "artifact.json"
    artifact.write_bytes(b"synthetic-artifact")
    assert len(harness._sha256_file(artifact)) == 64


def test_git_value_covers_valid_and_invalid_synthetic_results(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        harness.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(stdout=f"{'a' * 40}\n"),
    )
    assert harness._git_value(Path("/synthetic"), "HEAD") == "a" * 40

    monkeypatch.setattr(
        harness.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(stdout="not-a-commit\n"),
    )
    with pytest.raises(harness.RuntimeAuthorizationError, match="tuple is invalid"):
        harness._git_value(Path("/synthetic"), "HEAD")


def test_public_and_secret_inventories_cover_complete_and_incomplete_roots(
    tmp_path: Path,
) -> None:
    pki_root = tmp_path / "pki"
    pki_root.mkdir()
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="PKI inventory is incomplete"
    ):
        harness._public_pki_paths(tmp_path)

    for _, filename in harness._PUBLIC_PKI_FILES:
        (pki_root / filename).write_bytes(filename.encode())
    public_paths = harness._public_pki_paths(tmp_path)
    assert len(harness._public_pki_inventory(public_paths)) == 5

    with pytest.raises(
        harness.RuntimeAuthorizationError, match="secret inventory is incomplete"
    ):
        harness._runtime_secret_inventory(tmp_path)
    secret_paths = (
        tmp_path / harness._PASSWORD_FILE,
        pki_root / "server-key.pem",
        pki_root / "client-key.pem",
        pki_root / "alternate-client-key.pem",
        pki_root / "jwt-signing-key.pem",
    )
    for index, path in enumerate(secret_paths):
        path.write_bytes(f"secret-{index}".encode())
    inventory = harness._runtime_secret_inventory(tmp_path)
    try:
        assert inventory.summary()["registered_label_count"] == 5
    finally:
        inventory.clear()


def test_terminal_artifact_loop_uses_only_synthetic_records(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    monkeypatch.setattr(
        harness,
        "_artifact_record",
        lambda root, relative_path, **kwargs: (
            calls.append(relative_path),
            {"relative_path": relative_path},
        )[1],
    )
    artifacts = harness._terminal_artifacts(tmp_path)
    assert len(artifacts) == 16
    assert calls[-1] == harness._SECRET_SWEEP_EVIDENCE


def _candidate_inputs(tmp_path: Path) -> dict[str, object]:
    authorization = _authorization(tmp_path)
    results = [{"case_id": f"N{ordinal}", "passed": True} for ordinal in range(1, 11)]
    return {
        "authorization": authorization,
        "marker": {"consumed": True},
        "results": results,
        "case_durations_ms": list(range(1, 11)),
        "summary": {
            "mtls_client_certificate_count": 1,
            "relying_party_refusal_count": 9,
            "ssl_hardened_options_preserved": True,
            "ssl_no_compression_verified": True,
        },
        "started_at": datetime(2026, 8, 3, tzinfo=UTC),
        "elapsed_ms": 10,
        "public_pki_paths": {},
        "postgresql": {"replay_row_count": 1},
    }


def test_terminal_candidate_rejects_length_key_and_result_drift(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    inputs = _candidate_inputs(tmp_path)
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="inventory is incomplete"
    ):
        harness._terminal_candidate(**{**inputs, "results": []})  # type: ignore[arg-type]

    duplicate_results = list(inputs["results"])  # type: ignore[arg-type]
    duplicate_results[-1] = {"case_id": "N9", "passed": True}
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="inventory is inconsistent"
    ):
        harness._terminal_candidate(
            **{**inputs, "results": duplicate_results}  # type: ignore[arg-type]
        )

    failed_results = list(inputs["results"])  # type: ignore[arg-type]
    failed_results[0] = {"case_id": "N1", "passed": False}
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="inventory is inconsistent"
    ):
        harness._terminal_candidate(
            **{**inputs, "results": failed_results}  # type: ignore[arg-type]
        )

    monkeypatch.setattr(harness, "_repository_tuple", lambda authorization: {})
    monkeypatch.setattr(harness, "_public_pki_inventory", lambda paths: [])
    monkeypatch.setattr(harness, "_terminal_artifacts", lambda root: [])
    candidate = harness._terminal_candidate(**inputs)  # type: ignore[arg-type]
    assert candidate["counts"]["passed_count"] == 10  # type: ignore[index]


def test_marker_and_postgresql_posture_refuse_noncanonical_or_drifted_input(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(harness.RuntimeAuthorizationError, match="not canonical"):
        harness._marker_sha256({"bad": float("nan")})

    answers = iter(("f|f|f", "1"))
    monkeypatch.setattr(harness.store, "_psql", lambda *args: next(answers))
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="posture is inconsistent"
    ):
        harness._terminal_postgresql_posture(object(), replay_row_count=1)  # type: ignore[arg-type]


def test_teardown_rejects_environment_evidence_drift_before_control_actions(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization = _authorization(tmp_path)
    monkeypatch.setattr(
        harness,
        "_bounded_external_roots",
        lambda **kwargs: (authorization.runtime_root, tmp_path / "other-evidence"),
    )
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="evidence root does not match"
    ):
        harness.teardown(authorization)  # type: ignore[arg-type]


def test_main_maps_dispatch_success_and_failure_to_constant_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(harness.procedure, "validate_procedure", lambda blueprint: None)
    monkeypatch.setattr(harness, "stop", lambda: None)
    assert harness.main(["stop"]) == 0

    monkeypatch.setattr(
        harness,
        "stop",
        lambda: (_ for _ in ()).throw(harness.RuntimeAuthorizationError("synthetic")),
    )
    assert harness.main(["stop"]) == 2
