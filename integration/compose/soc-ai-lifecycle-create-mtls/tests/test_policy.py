"""Static bind/builder policy tests for the SOC-to-AI lifecycle mTLS preparation.

Every test in this module is pure. It parses text, compares values and inspects
source syntax trees. Nothing here resolves a package, opens a listener, starts a
process, reads a credential or mutates a runtime-admission carrier.
"""

from __future__ import annotations

import ast
import dataclasses
import hashlib
import json
import sys
import types
from pathlib import Path

import pytest

from cybrik_suite_uat_mtls import policy

_SRC_ROOT = Path(__file__).resolve().parents[1] / "src" / "cybrik_suite_uat_mtls"
_HARNESS_ROOT = Path(__file__).resolve().parents[1]
_REPO_ROOT = Path(__file__).resolve().parents[4]
_SOURCE_FILES = tuple(
    sorted(path.relative_to(_SRC_ROOT).as_posix() for path in _SRC_ROOT.rglob("*.py"))
)
_EXPECTED_SOURCE_FILES = ("__init__.py", "evidence.py", "policy.py", "procedure.py")

_ALLOWED_IMPORT_ROOTS = frozenset(
    {"__future__", "collections", "dataclasses", "re", "types", "typing"}
)

_FORBIDDEN_CALL_NAMES = frozenset(
    {
        "__import__",
        "accept",
        "bind",
        "call",
        "check_call",
        "check_output",
        "compile",
        "connect",
        "connect_ex",
        "create_connection",
        "create_default_context",
        "eval",
        "exec",
        "execv",
        "execve",
        "fork",
        "getattr",
        "importlib",
        "import_module",
        "kill",
        "listen",
        "open",
        "popen",
        "Popen",
        "run",
        "serve",
        "serve_forever",
        "spawn",
        "system",
        "wrap_socket",
    }
)

_FORBIDDEN_SOURCE_TEXT = (
    "import anycorn",
    "from anycorn",
    "cybrik_ai_api",
    "cybrik_soc",
    "subprocess",
    "multiprocessing",
    "socketserver",
    "os.system",
    "os.popen",
    "asyncio",
    "psycopg",
    "asyncpg",
    "sqlalchemy",
    "docker",
    "urllib",
    "http.client",
    "httpx",
    "requests",
    "pip install",
    "uv sync",
    "alembic",
)


def _read_source(source_file: str) -> str:
    return (_SRC_ROOT / source_file).read_text(encoding="utf-8")


def _parse_source(source_file: str) -> ast.Module:
    return ast.parse(_read_source(source_file), filename=source_file)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _called_names(tree: ast.Module) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        target = node.func
        if isinstance(target, ast.Name):
            names.add(target.id)
        elif isinstance(target, ast.Attribute):
            names.add(target.attr)
    return names


# --------------------------------------------------------------------------
# Static purity of the authored source package
# --------------------------------------------------------------------------


def test_source_inventory_covers_every_python_module_recursively() -> None:
    assert _SOURCE_FILES
    assert _SOURCE_FILES == _EXPECTED_SOURCE_FILES
    assert _SOURCE_FILES == tuple(
        sorted(path.relative_to(_SRC_ROOT).as_posix() for path in _SRC_ROOT.rglob("*.py"))
    )


@pytest.mark.parametrize("source_file", _SOURCE_FILES)
def test_source_imports_only_pure_standard_library(source_file: str) -> None:
    tree = _parse_source(source_file)
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                continue  # relative import inside this package
            assert node.module is not None
            roots.add(node.module.split(".")[0])
    assert roots <= _ALLOWED_IMPORT_ROOTS, sorted(roots - _ALLOWED_IMPORT_ROOTS)


@pytest.mark.parametrize("source_file", _SOURCE_FILES)
def test_source_declares_no_runtime_execution_call(source_file: str) -> None:
    called = _called_names(_parse_source(source_file))
    assert called.isdisjoint(_FORBIDDEN_CALL_NAMES), sorted(
        called & _FORBIDDEN_CALL_NAMES
    )


@pytest.mark.parametrize("source_file", _SOURCE_FILES)
def test_source_text_excludes_dependency_and_runtime_markers(source_file: str) -> None:
    lowered = _read_source(source_file).lower()
    hits = [marker for marker in _FORBIDDEN_SOURCE_TEXT if marker in lowered]
    assert hits == []


@pytest.mark.parametrize("source_file", _SOURCE_FILES)
def test_source_declares_no_executable_entrypoint(source_file: str) -> None:
    tree = _parse_source(source_file)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            assert node.name != "main"
        if isinstance(node, ast.If):
            names = {
                child.id for child in ast.walk(node.test) if isinstance(child, ast.Name)
            }
            assert "__name__" not in names


# --------------------------------------------------------------------------
# Proposed loopback surfaces
# --------------------------------------------------------------------------


def test_proposed_bind_map_is_exactly_the_two_reviewed_surfaces() -> None:
    assert isinstance(policy.PROPOSED_BINDS, types.MappingProxyType)
    assert dict(policy.PROPOSED_BINDS) == {
        policy.AI_MTLS_SURFACE: "127.0.0.1:58443",
        policy.POSTGRES_SURFACE: "127.0.0.1:55432",
    }


def test_proposed_bind_map_is_immutable() -> None:
    with pytest.raises(TypeError):
        policy.PROPOSED_BINDS["extra"] = "127.0.0.1:1"  # type: ignore[index]


@pytest.mark.parametrize(
    ("surface", "host", "port"),
    (
        ("ai_mtls", "127.0.0.1", 58443),
        ("postgres_replay", "127.0.0.1", 55432),
    ),
)
def test_resolve_proposed_surface_parses_the_exact_loopback_tuple(
    surface: str, host: str, port: int
) -> None:
    resolved = policy.resolve_proposed_surface(surface)
    assert (resolved.host, resolved.port) == (host, port)
    assert resolved.bind == f"{host}:{port}"


def test_bind_surface_is_immutable() -> None:
    resolved = policy.resolve_proposed_surface(policy.AI_MTLS_SURFACE)
    with pytest.raises(dataclasses.FrozenInstanceError):
        resolved.port = 1  # type: ignore[misc]


def test_resolve_proposed_surface_rejects_an_unknown_surface() -> None:
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.resolve_proposed_surface("public_ingress")
    assert caught.value.reason == policy.SURFACE_UNKNOWN


def test_validate_proposed_bind_accepts_only_the_exact_declared_bind() -> None:
    resolved = policy.validate_proposed_bind(policy.AI_MTLS_SURFACE, "127.0.0.1:58443")
    assert resolved.port == 58443


def test_validate_proposed_bind_rejects_a_swapped_surface_port() -> None:
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_proposed_bind(policy.AI_MTLS_SURFACE, "127.0.0.1:55432")
    assert caught.value.reason == policy.SURFACE_BIND_MISMATCH


# --------------------------------------------------------------------------
# Bind parsing — fail closed
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("candidate", "expected_reason"),
    (
        (58443, policy.BIND_NOT_A_STRING),
        (None, policy.BIND_NOT_A_STRING),
        ("", policy.BIND_NOT_CANONICAL),
        (" 127.0.0.1:58443", policy.BIND_NOT_CANONICAL),
        ("127.0.0.1:58443\n", policy.BIND_NOT_CANONICAL),
        ("127.0.0.1", policy.BIND_MISSING_PORT_SEPARATOR),
        ("127.0.0.1:58443:1", policy.BIND_MULTIPLE_PORT_SEPARATORS),
        ("[::1]:58443", policy.BIND_AMBIGUOUS_IPV6),
        ("::1:58443", policy.BIND_AMBIGUOUS_IPV6),
        ("[::]:58443", policy.BIND_AMBIGUOUS_IPV6),
        ("fe80:0:0:0:0:0:0:1:58443", policy.BIND_AMBIGUOUS_IPV6),
        ("0.0.0.0:58443", policy.BIND_WILDCARD_HOST),
        ("*:58443", policy.BIND_WILDCARD_HOST),
        (":58443", policy.BIND_WILDCARD_HOST),
        ("localhost:58443", policy.BIND_HOST_NOT_IPV4_LITERAL),
        ("ai.internal.example:58443", policy.BIND_HOST_NOT_IPV4_LITERAL),
        ("999.0.0.1:58443", policy.BIND_HOST_NOT_IPV4_LITERAL),
        ("127.000.000.001:58443", policy.BIND_HOST_NOT_CANONICAL),
        ("10.0.0.5:58443", policy.BIND_HOST_NOT_LOOPBACK),
        ("127.0.0.2:58443", policy.BIND_HOST_NOT_LOOPBACK),
        ("192.168.1.10:55432", policy.BIND_HOST_NOT_LOOPBACK),
        ("127.0.0.1:", policy.BIND_PORT_MALFORMED),
        ("127.0.0.1:-1", policy.BIND_PORT_MALFORMED),
        ("127.0.0.1:+58443", policy.BIND_PORT_MALFORMED),
        ("127.0.0.1:5844x", policy.BIND_PORT_MALFORMED),
        ("127.0.0.1:058443", policy.BIND_PORT_MALFORMED),
        ("127.0.0.1:５８", policy.BIND_PORT_MALFORMED),
        ("127.0.0.1:0", policy.BIND_PORT_OUT_OF_RANGE),
        ("127.0.0.1:65536", policy.BIND_PORT_OUT_OF_RANGE),
        ("127.0.0.1:999999", policy.BIND_PORT_OUT_OF_RANGE),
    ),
)
def test_parse_loopback_bind_rejects_unsafe_candidates(
    candidate: object, expected_reason: str
) -> None:
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.parse_loopback_bind(candidate)
    assert caught.value.reason == expected_reason


@pytest.mark.parametrize("candidate", ("127.0.0.1:1", "127.0.0.1:65535"))
def test_parse_loopback_bind_accepts_the_exact_loopback_port_bounds(
    candidate: str,
) -> None:
    assert policy.parse_loopback_bind(candidate).bind == candidate


def test_policy_violation_never_echoes_the_rejected_candidate() -> None:
    candidate = "postgresql://uat:PLACEHOLDER-NOT-A-SECRET@10.0.0.5:55432/postgres"
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.parse_loopback_bind(candidate)
    rendered = f"{caught.value}{caught.value!r}{caught.value.args}"
    assert "PLACEHOLDER-NOT-A-SECRET" not in rendered
    assert candidate not in rendered


def test_parse_loopback_bind_rejects_an_extreme_port_without_leaking_value() -> None:
    candidate = "127.0.0.1:" + ("9" * 10_000)
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.parse_loopback_bind(candidate)
    assert caught.value.reason == policy.BIND_PORT_OUT_OF_RANGE
    assert candidate not in f"{caught.value}{caught.value!r}{caught.value.args}"


# --------------------------------------------------------------------------
# SSL-context builder references — symbolic only, no Anycorn import
# --------------------------------------------------------------------------


def test_anycorn_base_builder_is_referenced_symbolically_only() -> None:
    assert (
        policy.ANYCORN_BASE_SSL_CONTEXT_BUILDER
        == "anycorn.config.Config.create_ssl_context"
    )
    imported_roots = {name.split(".")[0] for name in sys.modules}
    assert "anycorn" not in imported_roots
    assert isinstance(policy.ANYCORN_BASE_SSL_CONTEXT_BUILDER, str)


@pytest.mark.parametrize(
    "symbol",
    (
        "anycorn.config.Config.create_ssl_context",
        "anycorn.config.Config",
        "cybrik_suite_uat_mtls.vendor.anycorn.config.Config.create_ssl_context",
        "Config.create_ssl_context",
    ),
)
def test_is_anycorn_base_builder_detects_raw_and_aliased_references(
    symbol: str,
) -> None:
    assert policy.is_anycorn_base_builder(symbol) is True


@pytest.mark.parametrize(
    "symbol",
    (
        "cybrik_suite_uat_mtls.server.build_patched_ssl_context",
        "ssl.SSLContext",
    ),
)
def test_is_anycorn_base_builder_accepts_unrelated_symbols(symbol: str) -> None:
    assert policy.is_anycorn_base_builder(symbol) is False


def test_internal_patched_builder_reference_is_accepted() -> None:
    reference = policy.SslContextBuilderReference(
        symbol=policy.INTERNAL_PATCHED_SSL_CONTEXT_BUILDER,
        delegates_to=("ssl.SSLContext.load_cert_chain", "ssl.SSLContext.load_verify_locations"),
        internal_patched=True,
    )
    assert policy.validate_ssl_context_builder(reference) is reference


@pytest.mark.parametrize(
    ("reference", "expected_reason"),
    (
        (
            "cybrik_suite_uat_mtls.server.build_patched_ssl_context",
            policy.BUILDER_REFERENCE_NOT_DECLARED,
        ),
        (None, policy.BUILDER_REFERENCE_NOT_DECLARED),
    ),
)
def test_validate_ssl_context_builder_requires_a_declared_reference(
    reference: object, expected_reason: str
) -> None:
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_ssl_context_builder(reference)
    assert caught.value.reason == expected_reason


def test_validate_ssl_context_builder_rejects_the_raw_anycorn_base_builder() -> None:
    reference = policy.SslContextBuilderReference(
        symbol=policy.ANYCORN_BASE_SSL_CONTEXT_BUILDER,
        internal_patched=True,
    )
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_ssl_context_builder(reference)
    assert caught.value.reason == policy.BUILDER_IS_ANYCORN_BASE


def test_validate_ssl_context_builder_rejects_delegation_to_the_base_builder() -> None:
    reference = policy.SslContextBuilderReference(
        symbol=policy.INTERNAL_PATCHED_SSL_CONTEXT_BUILDER,
        delegates_to=(policy.ANYCORN_BASE_SSL_CONTEXT_BUILDER,),
        internal_patched=True,
    )
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_ssl_context_builder(reference)
    assert caught.value.reason == policy.BUILDER_DELEGATES_TO_ANYCORN_BASE


def test_validate_ssl_context_builder_rejects_an_unpatched_reference() -> None:
    reference = policy.SslContextBuilderReference(
        symbol=policy.INTERNAL_PATCHED_SSL_CONTEXT_BUILDER,
        internal_patched=False,
    )
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_ssl_context_builder(reference)
    assert caught.value.reason == policy.BUILDER_NOT_INTERNAL_PATCHED


def test_validate_ssl_context_builder_rejects_an_unallowlisted_symbol() -> None:
    reference = policy.SslContextBuilderReference(
        symbol="cybrik_suite_uat_mtls.server.build_other_ssl_context",
        internal_patched=True,
    )
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_ssl_context_builder(reference)
    assert caught.value.reason == policy.BUILDER_SYMBOL_NOT_ALLOWLISTED


def test_validate_ssl_context_builder_rejects_an_unallowlisted_delegate() -> None:
    reference = policy.SslContextBuilderReference(
        symbol=policy.INTERNAL_PATCHED_SSL_CONTEXT_BUILDER,
        delegates_to=("cybrik_suite_uat_mtls.server._private_helper",),
        internal_patched=True,
    )
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_ssl_context_builder(reference)
    assert caught.value.reason == policy.BUILDER_DELEGATE_NOT_ALLOWLISTED


@pytest.mark.parametrize("symbol", ("", "   ", 7))
def test_validate_ssl_context_builder_rejects_a_malformed_symbol(
    symbol: object,
) -> None:
    reference = policy.SslContextBuilderReference(
        symbol=symbol,  # type: ignore[arg-type]
        internal_patched=True,
    )
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_ssl_context_builder(reference)
    assert caught.value.reason == policy.BUILDER_SYMBOL_MALFORMED


@pytest.mark.parametrize("delegates", ("ssl.SSLContext", (7,), ("",)))
def test_validate_ssl_context_builder_rejects_malformed_delegates(
    delegates: object,
) -> None:
    reference = policy.SslContextBuilderReference(
        symbol=policy.INTERNAL_PATCHED_SSL_CONTEXT_BUILDER,
        delegates_to=delegates,  # type: ignore[arg-type]
        internal_patched=True,
    )
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_ssl_context_builder(reference)
    assert caught.value.reason == policy.BUILDER_DELEGATE_MALFORMED


# --------------------------------------------------------------------------
# D1 status truthfulness and dependency-neutral command boundary
# --------------------------------------------------------------------------


def test_d1_readmes_record_artifact_complete_but_runtime_not_run() -> None:
    harness_readme = (_HARNESS_ROOT / "README.md").read_text(encoding="utf-8")
    compose_readme = (_HARNESS_ROOT.parent / "README.md").read_text(encoding="utf-8")

    for text in (harness_readme, compose_readme):
        assert "D1 ARTIFACT COMPLETE — RUNTIME NOT RUN" in text
        assert "UAT-MTLS-D2" in text and "HOLD" in text
        assert "DEMO_READY_LOCAL" in text and "NO-GO" in text
    assert "No Anycorn or product package is imported, installed, resolved, built or downloaded" not in harness_readme
    assert "dependency-neutral preparation only" not in compose_readme


def test_dependency_neutral_readme_command_names_only_the_four_static_files() -> None:
    readme = (_HARNESS_ROOT / "README.md").read_text(encoding="utf-8")
    expected = (
        "test_policy.py",
        "test_evidence.py",
        "test_procedure.py",
        "test_case_inventory.py",
    )
    for filename in expected:
        assert f"integration/compose/soc-ai-lifecycle-create-mtls/tests/{filename}" in readme
    assert "python3 -m pytest integration/compose/soc-ai-lifecycle-create-mtls/tests\n" not in readme
    assert "CYBRIK_UAT_D1_ARTIFACT_DIR" in readme


def test_d1_delegated_authority_is_recorded_without_opening_runtime() -> None:
    decision = (
        _REPO_ROOT / "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md"
    ).read_text(encoding="utf-8")
    assert "Current state: `AUTHORIZED — D1 DEPENDENCY ARTIFACT COMPLETE — RUNTIME NOT RUN`" in decision
    assert "Current state: `ACCEPTED AND IMPLEMENTED BY D1 ARTIFACT ONLY — NO RUNTIME`" in decision
    assert (
        "Current state: `ACCEPTED — B1 BOUNDED EVALUATION ARTIFACT IMPLEMENTED — RUNTIME NOT RUN`"
        in decision
    )
    assert (
        "Current B1 live facts: `installed=true`, `pinned=true`, product `selected=false`"
        in decision
    )
    assert "Founder-delegated Codex Governor operating authority" in decision
    assert "DELEGATED-GOVERNOR-RUNTIME-UAT-RECONCILIATION-2026-07-31.md" in decision
    assert "D2 remains **HOLD**" in decision


def test_d1_authority_provenance_reconciles_the_controlling_records() -> None:
    claude = (_REPO_ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    reconciliation = (
        _REPO_ROOT
        / "docs/operations/DELEGATED-GOVERNOR-RUNTIME-UAT-RECONCILIATION-2026-07-31.md"
    ).read_text(encoding="utf-8")

    assert "UAT-MTLS-D1 exact-action exception" in claude
    assert "D1 dependency/build/evidence scope only" in claude
    assert "Appendix B. Exact UAT-MTLS-D1 dependency authorization" in reconciliation
    assert "anh cho em quyền review và thay founder quyết định" in reconciliation
    assert "Production vẫn do anh" in reconciliation
    assert "UAT-MTLS-D1=AUTHORIZED-EXACT-ACTION" in reconciliation
    assert "UAT-MTLS-D2=HOLD" in reconciliation


def test_runtime_admission_carriers_pin_d1_but_retain_zero_runtime_state() -> None:
    candidate_root = (
        _REPO_ROOT / "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1"
    )
    hold_path = candidate_root / "evidence/01-hold-status.md"
    architecture_path = candidate_root / "evidence/02-architecture-and-acceptance.md"
    record_path = candidate_root / "runtime-admission.json"
    registry_path = _REPO_ROOT / "docs/uat/candidates/README.md"

    expected_digests = {
        "wheel": "d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c",
        "patch": "1090569a745fc8cf9aa543505fc6616ebc724e6a16864ecb122cf4888954394e",
        "lock": "e05c5e281e230b2089e356d716212a6d2c2e4320a3a30dc8dfd126216faa3add",
        "probe": "91ddea52e76a1334724b187d5ea0a90e8fdf7a84bd3108b8057689de9092dc45",
    }
    carrier_texts = [
        hold_path.read_text(encoding="utf-8"),
        architecture_path.read_text(encoding="utf-8"),
        registry_path.read_text(encoding="utf-8"),
    ]
    for text in carrier_texts:
        assert "D1_ARTIFACT_COMPLETE_RUNTIME_AUTHORED_NOT_RUN" in text
        for digest in expected_digests.values():
            assert digest in text

    record = json.loads(record_path.read_text(encoding="utf-8"))
    current = record["attempt_accounting"]["current_attempt"]
    assert current["status"] == "not_run"
    assert current["execution_authorized"] is False
    assert (current["executed_checks"], current["passed_checks"], current["failed_checks"]) == (0, 0, 0)
    assert record["disposition"]["profile"] == "HOLD"
    assert record["evidence"]["final_profile_verdict"] == "HOLD"
    assert current["evidence_sha256"] == _sha256(hold_path)
    assert record["evidence"]["artifacts"] == [
        {"path": hold_path.relative_to(_REPO_ROOT).as_posix(), "sha256": _sha256(hold_path)},
        {
            "path": architecture_path.relative_to(_REPO_ROOT).as_posix(),
            "sha256": _sha256(architecture_path),
        },
    ]
